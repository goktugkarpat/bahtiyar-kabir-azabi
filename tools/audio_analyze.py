"""Analyse rendered WAVs: loudness (EBU R128), peak, RMS, crest, spectral centroid, low-end share,
click count, tail, envelope repetition and dynamic range. Pure python + ffmpeg.
usage: python analyze.py <dir> [out.json]"""
import sys, os, re, wave, array, math, json, subprocess

def ff(path, af):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', af, '-f', 'null', '-'], capture_output=True, text=True)
    return r.stderr

def loud(path):
    e = ff(path, 'ebur128=peak=true')
    s = e[e.rfind('Summary:'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+|-inf)', s).group(1).replace('-inf', '-99')) if re.search(k + r':\s+(-?[\d.]+|-inf)', s) else None
    return {'lufs': g('I'), 'lra': g('LRA'), 'tp': g('Peak')}

def centroid(path):
    e = ff(path, 'aformat=channel_layouts=mono,aspectralstats=measure=centroid,ametadata=print:file=-')
    vals = [float(v) for v in re.findall(r'centroid=([\d.]+)', e)]
    if not vals:
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'aformat=channel_layouts=mono,aspectralstats=measure=centroid,ametadata=print:file=-', '-f', 'null', '-'], capture_output=True, text=True)
        vals = [float(v) for v in re.findall(r'centroid=([\d.]+)', r.stdout)]
    vals = [v for v in vals if v > 0]
    return sum(vals) / len(vals) if vals else 0

def band_rms(path, af):
    e = ff(path, af + ',astats=measure_overall=RMS_level:measure_perchannel=none')
    m = re.findall(r'RMS level dB:\s+(-?[\d.]+|-inf)', e)
    return float(m[-1].replace('-inf', '-120')) if m else -120

def read(path):
    with wave.open(path) as w:
        sr, n = w.getframerate(), w.getnframes(); a = array.array('h', w.readframes(n))
    L = [a[i] / 32768 for i in range(0, len(a), 2)]; R = [a[i] / 32768 for i in range(1, len(a), 2)]
    return sr, L, R

def analyse(path):
    sr, L, R = read(path)
    m = [(l + r) * .5 for l, r in zip(L, R)]
    peak = max(max(abs(x) for x in L), max(abs(x) for x in R)) if L else 0
    rms = math.sqrt(sum(x * x for x in m) / max(1, len(m)))
    clip = sum(1 for x in L if abs(x) > .995) + sum(1 for x in R if abs(x) > .995)
    # clicks: sample jump far above the local average slope
    clicks = 0; hop = 64
    d = [abs(m[i] - m[i - 1]) for i in range(1, len(m))]
    for i in range(hop, len(d) - hop, 1):
        if d[i] > .08:
            loc = sum(d[i - hop:i]) / hop
            if d[i] > 12 * loc + .02: clicks += 1
    # envelope (50 ms frames) -> dynamic range + tail + repetition
    fr = sr // 20; env = []
    for i in range(0, len(m) - fr, fr):
        s = m[i:i + fr]; env.append(20 * math.log10(math.sqrt(sum(x * x for x in s) / fr) + 1e-9))
    act = sorted(e for e in env if e > -80)
    dr = (act[int(len(act) * .95)] - act[int(len(act) * .10)]) if len(act) > 10 else 0
    last = max([i for i, e in enumerate(env) if e > -60] or [0]); tail = (len(env) - 1 - last) * .05
    rep = 0; best_lag = 0
    if len(env) > 200:
        x = [e - sum(env) / len(env) for e in env]; v = sum(a * a for a in x) or 1
        for lag in range(40, min(len(x) // 2, 400)):
            c = sum(x[i] * x[i + lag] for i in range(len(x) - lag)) / v
            if c > rep: rep, best_lag = c, lag
    width = 0
    sL = sum(l * l for l in L); sR = sum(r * r for r in R); sLR = sum(l * r for l, r in zip(L, R))
    corr = sLR / math.sqrt(sL * sR) if sL > 0 and sR > 0 else 1
    o = {'peak_db': round(20 * math.log10(peak + 1e-9), 1), 'rms_db': round(20 * math.log10(rms + 1e-9), 1),
         'crest_db': round(20 * math.log10((peak + 1e-9) / (rms + 1e-9)), 1), 'clip': clip, 'clicks': clicks,
         'dyn_range_db': round(dr, 1), 'silent_tail_s': round(tail, 2), 'rep_corr': round(rep, 2), 'rep_lag_s': round(best_lag * .05, 1),
         'lr_corr': round(corr, 2)}
    o.update(loud(path))
    o['centroid_hz'] = round(centroid(path))
    full = band_rms(path, 'anull'); sub = band_rms(path, 'lowpass=f=120,lowpass=f=120'); hi = band_rms(path, 'highpass=f=4000,highpass=f=4000')
    o['sub120_share_db'] = round(sub - full, 1); o['hi4k_share_db'] = round(hi - full, 1)
    return o

if __name__ == '__main__':
    D = sys.argv[1]; res = {}
    for f in sorted(os.listdir(D)):
        if not f.endswith('.wav'): continue
        res[f[:-4]] = r = analyse(os.path.join(D, f))
        print(f'{f[:-4]:16s}', ' '.join(f'{k}={v}' for k, v in r.items()), flush=True)
    if len(sys.argv) > 2: json.dump(res, open(sys.argv[2], 'w'), indent=1)
