/* KARA GEÇİT — ses motoru.
   Kayıtlı sesler: src/narration.js içindeki BABA.SoundBank (CC0 paketlerden işlenmiş, dört MP3 "sprite")
   ve BABA.Narration (tr-TR-AhmetNeural anlatıcı). Müzik ve ortam sesleri Web Audio ile üretilir.
   Kılıç darbelerinin çelik/gövde/çınlama katmanları açılışta düz JS ile hesaplanıp `bank` içine konur (bakeKit).
   Sözleşme: BABA.Audio = {unlock, set, play, update, suspend, resume, say, resetNarration, onCaption, silent}.
   ?sessiz: hiçbir AudioContext açılmaz, hiç ses çalınmaz (altyazılar yine görünür).
   Test: BABA.Audio.renderOffline(...) yalnızca OfflineAudioContext kullanır; hoparlöre ses göndermez. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const silent = new URLSearchParams(location.search).has('sessiz');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = p => Math.random() < p;

  let ctx = null, offline = false, unlocked = false, suspended = false;
  let N = {};                          // ses grafiği düğümleri
  let volume = { master: .65, music: .42, sfx: .75, ambient: .5, voice: .85 };
  let qaMusic = false;    // QA renders only: renderOffline({music:true}) plays the composed score too
  let extMusic = false;   // true when src/music.js (BABA.Music, the composed adaptive score) drives the music bus
  let kitTask = null, tortTask = null, bankTask = null, preparedContext = null;
  let audioInitTask = null, contextStateTask = null;
  let warningUntil = 0;
  const VOICE_TRIM = .7;               // anlatıcı sessiz ortamın ~12 LU üstünde; daha fazlası irkiltir
  let testGame = null;                 // çevrimdışı testte sahte oyun durumu
  const game = () => testGame || (B.app && B.app.game) || null;
  const now = () => ctx ? ctx.currentTime : 0;

  // Steady controls need a new automation event only when the target or fade changes.
  // Keep note/envelope scheduling separate: AudioParam.value may still be mid-fade.
  let steadyTargets = new WeakMap();
  function targetParam(param, value, t, tc) {
    const prev = steadyTargets.get(param);
    if (prev && prev.value === value && prev.tc === tc) return;
    param.setTargetAtTime(value, t, tc);
    if (prev) { prev.value = value; prev.tc = tc; }
    else steadyTargets.set(param, { value, tc });
  }

  // ------------------------------------------------------------------ grafik
  function gainNode(v, to) { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  function filter(type, f, q, to) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (to) b.connect(to); return b; }
  function panner(p, to) {
    if (!ctx.createStereoPanner) { const g = gainNode(1, to); g.pan = null; return g; }
    const s = ctx.createStereoPanner(); s.pan.value = clamp(p || 0, -1, 1); if (to) s.connect(to); return s;
  }
  function makeNoise(seconds, color) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') { last = (last + w * .02) / 1.02; d[i] = last * 3.5; }
      else if (color === 'pink') { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .18; }
      else d[i] = w * .7;
    }
    return buf;
  }
  function makeIR(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate, early = t < .09 && Math.random() < .004 ? 2.5 : 1;
        lp += ((Math.random() * 2 - 1) - lp) * (t < .25 ? .55 : .28);   // taş: yüksek frekanslar daha hızlı söner
        d[i] = lp * early * Math.pow(1 - i / len, 1.4) * Math.exp(-decay * t) * (t < .012 ? t / .012 : 1);
      }
    }
    return buf;
  }
  function build(context, isOffline) {
    ctx = context; offline = !!isOffline; N = {}; steadyTargets = new WeakMap(); muffleUntil = 0;
    N.limiter = ctx.createDynamicsCompressor();
    N.limiter.threshold.value = -2.5; N.limiter.knee.value = 0; N.limiter.ratio.value = 20; N.limiter.attack.value = .0015; N.limiter.release.value = .12;
    // A compressor's non-zero attack can let a coincident metal transient
    // overshoot full scale. Preserve ordinary samples exactly, then bend only
    // the highest peaks into a fixed ceiling instead of digital clipping.
    N.ceiling = ctx.createWaveShaper(); const safety = new Float32Array(2049);
    for (let i = 0; i < safety.length; i++) {
      const x = i / 1024 - 1, a = Math.abs(x);
      safety[i] = Math.sign(x) * (a <= .7 ? a : .7 + .25 * (1 - Math.exp(-(a - .7) / .25)));
    }
    N.ceiling.curve = safety; N.ceiling.oversample = '2x'; N.ceiling.connect(ctx.destination); N.limiter.connect(N.ceiling);
    N.glue = ctx.createDynamicsCompressor(); N.glue.threshold.value = -15; N.glue.knee.value = 8; N.glue.ratio.value = 2.6; N.glue.attack.value = .012; N.glue.release.value = .22;
    N.glue.connect(N.limiter);
    N.master = gainNode(volume.master, N.glue);
    // "Dünya" zinciri: müzik/ortam/efekt ve yankı; ağır darbede ve ölümde boğuklaşır. Anlatıcı bunu atlar.
    N.world = filter('lowpass', 20000, .5, N.master);
    N.voice = gainNode(volume.voice * VOICE_TRIM, N.master);
    N.warningDuck = gainNode(1, N.world);
    N.musicDuck = gainNode(1, N.warningDuck); N.music = gainNode(volume.music, N.musicDuck);
    N.ambDuck = gainNode(1, N.warningDuck); N.amb = gainNode(volume.ambient, N.ambDuck);
    N.sfx = gainNode(volume.sfx, N.world);
    N.reverb = ctx.createConvolver(); N.reverb.buffer = makeIR(2.4, 2.1);
    N.reverbOut = gainNode(.55, N.world); N.reverb.connect(N.reverbOut);
    N.wetSfx = gainNode(volume.sfx, N.reverb); N.wetAmb = gainNode(volume.ambient, N.reverb); N.wetMusic = gainNode(volume.music * .6, N.reverb);
    N.noise = makeNoise(2.5, 'white'); N.pink = makeNoise(4, 'pink'); N.brown = makeNoise(6, 'brown');
    voices = 0; lastPlayed = {}; lastIndex = {};
    warningUntil = 0; preparedContext = null;
    try { kitTask = bakeKit(); } catch (e) { kitTask = null; console.warn('Audio kit', e); }
    // The composed score (src/music.js) plays on the same music bus (narrator ducking and the music slider keep working);
    // the built-in synth music below stays as the fallback and for offline QA renders.
    extMusic = (!isOffline || qaMusic) && !!(B.Music && B.Music.init) && B.Music.init(ctx, N.music, { lite: !isOffline && matchMedia('(pointer: coarse)').matches, sync: isOffline }) !== false;
    if (!extMusic) buildMusic();
    buildAmbience();
    T.log = []; T.busV = gainNode(1, N.amb); T.busF = gainNode(1, N.sfx);
    // A separate ambient return lets urgent cues silence the existing echo,
    // rather than merely stopping new sends into the shared combat reverb.
    T.verb = ctx.createConvolver(); T.verb.buffer = N.reverb.buffer;
    T.verbOut = gainNode(.55, N.world); T.verb.connect(T.verbOut);
    T.wetV = gainNode(volume.ambient, T.verb); T.wetF = gainNode(volume.sfx, T.verb);
    T.gate = 1; T.player = null; T.resetSerial = null; T.until = 0; T.recent = [];
    try { tortTask = bakeTort(); } catch (e) { tortTask = null; console.warn('Audio torture', e); }
    /* ajan:audio */ if (B.AudioPlus) try { B.AudioPlus.build(CORE); } catch (e) { console.warn('AudioPlus', e); } /* /ajan:audio */
  }
  const busOf = name => name === 'music' ? [N.music, N.wetMusic] : name === 'amb' ? [N.amb, N.wetAmb] : name === 'tort' ? [T.busV, T.wetV] : name === 'tortf' ? [T.busF, T.wetF] : [N.sfx, N.wetSfx];

  // ------------------------------------------------------------------ kayıtlı sesler
  const bank = {}, bankShift = {}; let bankState = 'none';
  function b64(data) { const s = atob(data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  function decode(data) {
    return new Promise((ok, fail) => { const p = ctx.decodeAudioData(data, ok, fail); if (p && p.then) p.then(ok, fail); });
  }
  // MP3 kodlayıcı gecikmesini bazı çözücüler kırpar, bazıları kırpmaz. Üretici her sprite'ın başına bilinen anda
  // (SoundBank.mark) kısa bir ton koyar: çözülmüş verideki tepe noktası kaymayı verir ve bütün dizine uygulanır.
  function spriteShift(buf, list, mark) {
    const d = buf.getChannelData(0), sr = buf.sampleRate, found = [];
    if (Number.isFinite(mark)) {
      let at = 0, peak = 0; const end = Math.min(d.length, Math.floor((mark + .16) * sr));
      for (let i = 0; i < end; i++) { const a = Math.abs(d[i]); if (a > peak) { peak = a; at = i; } }
      if (peak > .2) return clamp(at / sr - mark, -.04, .15);
    }
    for (const [, start, dur] of list.slice(0, 12)) {   // işaretsiz eski bankalar için: parçaların ilk yükselişleri
      const a = Math.max(0, Math.floor((start - .06) * sr)), b = Math.min(d.length, Math.floor((start + Math.min(dur, .3) + .08) * sr));
      let peak = 0; for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(d[i]));
      for (let i = a; i < b; i++) if (Math.abs(d[i]) > peak * .05) { found.push(i / sr - start); break; }
    }
    found.sort((x, y) => x - y);
    return found.length ? clamp(found[found.length >> 1], -.02, .08) : 0;
  }
  async function loadBank() {
    const SB = B.SoundBank; if (!SB || !SB.sprites || bankState !== 'none') return;
    bankState = 'loading';
    const my = ctx;
    try {
      for (const [group, data] of Object.entries(SB.sprites)) {
        const buf = await decode(b64(data)); if (ctx !== my) return;
        const entries = []; for (const [name, list] of Object.entries(SB.clips)) for (const c of list) if (c[0] === group) entries.push([name, c[1], c[2]]);
        const shift = spriteShift(buf, entries, SB.mark), sr = buf.sampleRate, src = buf.getChannelData(0); bankShift[group] = +shift.toFixed(4);
        for (const [name, start, dur] of entries) {
          const a = Math.max(0, Math.round((start + shift) * sr)), n = Math.max(1, Math.min(src.length - a, Math.round(dur * sr)));
          const clip = ctx.createBuffer(1, n, sr); clip.getChannelData(0).set(src.subarray(a, a + n));
          (bank[name] = bank[name] || []).push(clip);
        }
      }
      bankState = 'ready';
    } catch (e) { bankState = 'failed'; console.warn('SoundBank', e); }
  }

  // ------------------------------------------------------------------ darbe seti
  // The layers of the blade/body impacts (steel bite, flesh slap, body punch, sub boom, metal ring, blood spray, clang, parry ping)
  // are computed once with plain JS DSP into small AudioBuffers (a few variants each) and registered in `bank` next to the recorded
  // clips, so a hit is a handful of cheap buffer sources played through sample(): no per-hit oscillators, filters or allocation.
  let kitSeed = 7;
  const krand = () => { kitSeed = (kitSeed + 0x6D2B79F5) | 0; let t = Math.imul(kitSeed ^ (kitSeed >>> 15), 1 | kitSeed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function biq(type, f, q, sr) {          // RBJ biquad as a closure: lp / hp / bp (peak gain 1)
    const w = 2 * Math.PI * f / sr, c = Math.cos(w), a = Math.sin(w) / (2 * q); let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a, a1 = -2 * c / a0, a2 = (1 - a) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  // Adds ringing modes [freq, amp, seconds to -60 dB] to `o` (decaying phasors: one complex multiply per sample and mode).
  function modes(o, sr, list) {
    for (const [f, a, dec] of list) {
      const w = 2 * Math.PI * f / sr, r = Math.exp(-6.9 / (dec * sr)), cr = r * Math.cos(w), ci = r * Math.sin(w), n = Math.min(o.length, Math.ceil(dec * sr));
      let re = a, im = 0;   // sine start: no click at the strike
      for (let i = 0; i < n; i++) { o[i] += im; const x = re * cr - im * ci; im = re * ci + im * cr; re = x; }
    }
  }
  // Mode list of struck steel: plate-like partial ratios with jitter, each doubled by a slightly detuned twin (shimmer); higher modes fade faster.
  function steelModes(f, dec, gain) {
    const out = [];
    [1, 1.59, 2.14, 2.65, 3.4, 4.3, 5.4].forEach((r, i) => { const fr = f * r * (1 + (krand() - .5) * .04), a = gain / (1 + i * .55), d = dec / (1 + i * .4); out.push([fr, a, d], [fr * 1.0035, a * .6, d * .9]); });
    return out;
  }
  // Sine body with a fast pitch drop (f0 -> f1), soft-clipped so its harmonics carry on small speakers, plus a low-passed noise knock.
  function punchBuf(sr, f0, f1, tp, ta, dur, drive, kf, kw) {
    const n = Math.round(dur * sr), o = new Float32Array(n), lp = biq('lp', kf, .7, sr), w0 = 2 * Math.PI / sr, td = Math.tanh(drive);
    const dp = Math.exp(-1 / (tp * sr)), da = Math.exp(-1 / (ta * sr)), dk = Math.exp(-1 / (.01 * sr)), dr = Math.exp(-1 / (.0012 * sr));
    let ph = 0, ep = 1, ea = 1, ek = 1, er = 1;
    for (let i = 0; i < n; i++) {
      ph += w0 * (f1 + (f0 - f1) * ep); const a = (1 - er) * ea, s = Math.sin(ph) + .3 * Math.sin(2 * ph + .6) * ea;
      o[i] = Math.tanh(drive * s * a) / td + (kw && ek > .01 ? kw * lp(krand() * 2 - 1) * ek : 0);
      ep *= dp; ea *= da; ek *= dk; er *= dr;
    }
    return o;
  }
  const KIT = {
    hitCut: [3, (sr, i) => {              // flesh bite: bright noise "shk" over a short knock
      const n = Math.round(.13 * sr), o = new Float32Array(n), hp = biq('hp', 1400, .7, sr), bp = biq('bp', 3400 * (.88 + .12 * i), .8, sr), lp = biq('lp', 900, .7, sr);
      for (let k = 0; k < n; k++) { const t = k / sr, w = krand() * 2 - 1; o[k] = (1 - Math.exp(-t / .0004)) * (bp(hp(w)) * 1.7 * (.6 * Math.exp(-t / .006) + .4 * Math.exp(-t / .028)) + lp(w) * .9 * Math.exp(-t / .018)); }
      return o;
    }],
    hitCutSteel: [3, (sr, i) => {         // steel bite: hard tick with a short inharmonic shimmer
      const n = Math.round(.16 * sr), o = new Float32Array(n), bp = biq('bp', 4800, 1.1, sr), hp = biq('hp', 2500, .7, sr), f = 2100 * (.9 + .1 * i);
      for (let k = 0, m = Math.round(.07 * sr); k < m; k++) { const t = k / sr, w = krand() * 2 - 1; o[k] = (1 - Math.exp(-t / .00015)) * (bp(w) * 2.4 * Math.exp(-t / .0035) + hp(w) * .5 * Math.exp(-t / .012)); }
      modes(o, sr, [[f, .5, .08], [f * 1.52, .4, .06], [f * 2.41, .3, .045], [f * 3.37, .22, .03]]);
      return o;
    }],
    hitSlap: [3, (sr, i) => {             // wet slap of a blow on flesh
      const n = Math.round(.1 * sr), o = new Float32Array(n), a = biq('bp', 1300 * (.85 + .15 * i), .7, sr), b = biq('bp', 420, 1.2, sr), c = biq('lp', 3200, .7, sr);
      for (let k = 0; k < n; k++) { const t = k / sr, w = krand() * 2 - 1; o[k] = (1 - Math.exp(-t / .0005)) * c(a(w) * 1.5 * Math.exp(-t / .012) + b(w) * Math.exp(-t / .03)); }
      return o;
    }],
    hitCrack: [2, (sr, i) => {            // bone snap: two quick cracks and a knock
      const n = Math.round(.09 * sr), o = new Float32Array(n), a = biq('bp', 2400 * (.9 + .15 * i), 2.5, sr), b = biq('bp', 5200, 2, sr), d = Math.round(.011 * sr);
      for (let k = 0; k < n; k++) { const w = krand() * 2 - 1; o[k] = a(w) * 2 + b(w); }
      for (let k = n - 1; k >= 0; k--) { const t = k / sr, u = (k - d) / sr; o[k] = (1 - Math.exp(-t / .0003)) * o[k] * Math.exp(-t / .005) + (k >= d ? .6 * o[k - d] * Math.exp(-u / .004) : 0) + .35 * Math.sin(2 * Math.PI * 310 * t) * Math.exp(-t / .02); }
      return o;
    }],
    hitPunchL: [3, (sr, i) => punchBuf(sr, 200 + 15 * i, 85, .018, .055, .28, 2, 700, .35)],
    hitPunchH: [2, (sr, i) => punchBuf(sr, 165 + 12 * i, 66, .03, .11, .5, 2.3, 600, .4)],
    hitBody: [2, (sr, i) => punchBuf(sr, 140 + 8 * i, 70, .025, .085, .38, 2.1, 800, .6)],   // hit on the hero: dull chest thump
    hitSub: [1, sr => punchBuf(sr, 62, 38, .09, .15, .6, 1, 200, 0)],
    hitRingA: [3, (sr, i) => {            // short steel ring
      const o = new Float32Array(Math.round(.6 * sr)); modes(o, sr, steelModes(1560 + 120 * i, .5, 1)); return o;
    }],
    hitRingB: [2, (sr, i) => {            // heavy plate ring: lower, longer
      const o = new Float32Array(Math.round(1 * sr)); modes(o, sr, steelModes(440 + 70 * i, .9, 1)); return o;
    }],
    hitSpray: [2, (sr, i) => {            // blood spray: sizzling noise sweeping down
      const n = Math.round(.45 * sr), o = new Float32Array(n), bp = biq('bp', 3200, 1.1, sr); let gate = 1, g0 = 1, cnt = 0;
      for (let k = 0; k < n; k++) {
        const t = k / sr; if (cnt-- <= 0) { g0 = .45 + .55 * krand(); cnt = Math.round(sr / 190); } gate += (g0 - gate) * .2;
        o[k] = bp(krand() * 2 - 1) * gate * (1 - Math.exp(-t / .006)) * Math.exp(-t / (.08 + .04 * i));
      }
      return o;
    }],
    hitClang: [2, (sr, i) => {            // bright block clang
      const n = Math.round(.9 * sr), o = new Float32Array(n), bp = biq('bp', 4200, 1.4, sr), f = 840 + 170 * i;
      for (let k = 0, m = Math.round(.03 * sr); k < m; k++) { const t = k / sr; o[k] = bp(krand() * 2 - 1) * 2 * Math.exp(-t / .004) * (1 - Math.exp(-t / .0002)); }
      modes(o, sr, steelModes(f, .6, 1).concat([[f * .5, .6, .12]])); return o;
    }],
    hitPing: [2, (sr, i) => {             // parry: high, long, shimmering steel ring
      const n = Math.round(1.6 * sr), o = new Float32Array(n), bp = biq('bp', 5600, 2.5, sr), f = 1900 + 250 * i;
      for (let k = 0, m = Math.round(.04 * sr); k < m; k++) { const t = k / sr; o[k] = bp(krand() * 2 - 1) * 1.5 * Math.exp(-t / .006) * (1 - Math.exp(-t / .0002)); }
      modes(o, sr, [[f, 1, 1.3], [f * 1.004, .3, 1.2], [f * 2.32, .6, .9], [f * 3.87, .4, .6]].concat(steelModes(f * .7, .5, .18))); return o;
    }],
    swingRasp: [3, (sr, i) => {           // hero swing: leather/cloth drag (180-500 Hz) with a short steel rasp (>5 k); both clear of the enemy-tell rings (1.18 k, 2.7 k, 3.2 k, 4.6 k)
      const n = Math.round(.24 * sr), o = new Float32Array(n), cl = biq('lp', 480, .7, sr), cl2 = biq('lp', 520, .7, sr), ch = biq('hp', 180, .7, sr), st = biq('bp', 6600 * (.92 + .08 * i), 1.2, sr), n1 = biq('bp', 1180, 1.2, sr);
      for (let k = 0; k < n; k++) {
        const t = k / sr, w = krand() * 2 - 1, e = (1 - Math.exp(-t / .025)) * Math.exp(-t / .07), scr = .55 + .45 * Math.abs(Math.sin(2 * Math.PI * (70 + 25 * i) * t));
        const x = ch(cl2(cl(w))) * 2.4 * e + st(w) * .22 * scr * e * Math.exp(-t / .05); o[k] = x - n1(x);
      }
      return o;
    }],
    swingWump: [2, (sr, i) => punchBuf(sr, 82 + 8 * i, 38, .11, .17, .55, 1.5, 190, .45)]   // heavy swing: deep air-pressure "whump"
  };
  // Live context: one family per timer tick (~1-3 ms each) so unlocking the audio never stalls a frame; offline renders bake everything at once.
  function bakeKit() {
    const sr = ctx.sampleRate, my = ctx, names = Object.keys(KIT); let n = 0; kitSeed = 7;
    const bake = name => {
      const [count, make] = KIT[name], list = bank[name] = [];
      for (let i = 0; i < count; i++) {
        const d = make(sr, i); let pk = 0; for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); if (a > pk) pk = a; }
        const fade = Math.min(d.length >> 2, Math.round(sr * .02)), g = pk > 0 ? .9 / pk : 0;
        for (let k = 0; k < d.length; k++) d[k] *= g * (k >= d.length - fade ? (d.length - k) / fade : 1);
        const buf = ctx.createBuffer(1, d.length, sr); buf.getChannelData(0).set(d); list.push(buf);
      }
    };
    if (offline) { names.forEach(bake); return; }
    return new Promise(resolve => {
      const next = () => {
        if (ctx !== my || n >= names.length) { resolve(); return; }
        try { bake(names[n++]); } catch (e) { console.warn('Audio kit', e); resolve(); return; }
        setTimeout(next, 0);
      };
      setTimeout(next, 0);
    });
  }

  // ------------------------------------------------------------------ çalıcılar
  let voices = 0, lastPlayed = {}, lastIndex = {};
  const MAX_VOICES = 56;
  function track(node, extra) { const my = ctx; voices++; node.onended = () => { if (ctx === my) voices = Math.max(0, voices - 1); try { node.disconnect(); } catch (e) {} if (extra) for (const x of extra) try { x.disconnect(); } catch (e) {} }; }
  function throttle(key, gap) { const t = now(); if (lastPlayed[key] != null && t - lastPlayed[key] < gap) return false; lastPlayed[key] = t; return true; }
  function spatial(x, z) {
    const g = game(), p = g && g.player;
    if (!p || !Number.isFinite(x) || !Number.isFinite(z)) return { pan: 0, gain: 1, lp: 0, send: .12, d: 0 };
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    return { pan: clamp(dx / 11, -.75, .75), gain: 1 / (1 + Math.max(0, d - 3.5) * .11), lp: d > 9 ? clamp(15000 / (1 + (d - 9) * .3), 900, 15000) : 0, send: clamp(.1 + d * .018, .1, .5), d };
  }
  // Kayıtlı bir parçayı çalar. o: vol, rate, delay, pan, lp, hp, send, bus, index, detune, at(x,z) ve prio.
  function sample(name, o = {}) {
    const list = bank[name]; if (!ctx || !list || !list.length) return 0;
    if (voices > MAX_VOICES && !o.prio) return 0;
    let i = o.index != null ? o.index % list.length : Math.floor(Math.random() * list.length);
    if (o.index == null && list.length > 1 && i === lastIndex[name]) i = (i + 1) % list.length;
    lastIndex[name] = i;
    const buf = list[i], t = now() + (o.delay || 0);
    let vol = o.vol == null ? 1 : o.vol, pan = o.pan || 0, lp = o.lp || 0, send = o.send == null ? .14 : o.send;
    if (o.at) { const s = spatial(o.at.x, o.at.z); vol *= s.gain; pan = o.pan == null ? s.pan : pan; lp = lp || s.lp; send = Math.max(send, s.send); }
    if (vol < .004) return 0;
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * (1 + (o.detune == null ? .035 : o.detune) * (Math.random() * 2 - 1));
    const [bus, wet] = busOf(o.bus), g = gainNode(vol), p = panner(pan, bus);
    let head = src; const extra = [g, p];
    if (lp) { const f = filter('lowpass', lp, .7); head.connect(f); head = f; extra.push(f); }
    if (o.hp) { const f = filter('highpass', o.hp, .7); head.connect(f); head = f; extra.push(f); }
    head.connect(g); g.connect(p);
    if (send > 0) { const s = gainNode(send, wet); g.connect(s); extra.push(s); }
    src.start(t); track(src, extra);
    return buf.duration / src.playbackRate.value;
  }
  function noiseSrc(buf) { const s = ctx.createBufferSource(); s.buffer = buf || N.noise; s.loop = true; return s; }
  // Kılıç/nesne rüzgârı: bant geçiren gürültü; frekans ve sağ-sol hareketi bıçağın yolunu izler.
  function whoosh(t, o) {
    const dur = o.dur || .3, pk = t + dur * (o.peak == null ? .65 : o.peak), end = t + dur;
    const src = noiseSrc(), bp = filter('bandpass', o.f0 || 400, o.q || 1.2), g = gainNode(0), [bus, wet] = busOf(o.bus), p = panner(o.pan0 || 0, bus);
    bp.frequency.setValueAtTime(o.f0 || 400, t); bp.frequency.exponentialRampToValueAtTime(o.f1 || 1600, pk); bp.frequency.exponentialRampToValueAtTime(o.f2 || 500, end);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, o.vol), pk); g.gain.exponentialRampToValueAtTime(.0001, end);
    if (p.pan) { p.pan.setValueAtTime(clamp(o.pan0 || 0, -1, 1), t); p.pan.linearRampToValueAtTime(clamp(o.pan1 == null ? o.pan0 || 0 : o.pan1, -1, 1), end); }
    src.connect(bp); bp.connect(g); g.connect(p);
    const extra = [bp, g, p];
    if (o.edge) {   // bıçak ağzının ince ıslığı
      const e = filter('bandpass', (o.f1 || 1600) * 2.2, 7), eg = gainNode(0);
      e.frequency.setValueAtTime((o.f0 || 400) * 2.2, t); e.frequency.exponentialRampToValueAtTime((o.f1 || 1600) * 2.4, pk); e.frequency.exponentialRampToValueAtTime((o.f2 || 500) * 2, end);
      eg.gain.setValueAtTime(.0001, t); eg.gain.exponentialRampToValueAtTime(Math.max(.0002, o.vol * o.edge), pk); eg.gain.exponentialRampToValueAtTime(.0001, end);
      src.connect(e); e.connect(eg); eg.connect(p); extra.push(e, eg);
    }
    if (o.low) {    // ağır silahın yer değiştirdiği hava
      const l = filter('lowpass', o.low, .8), lg = gainNode(0);
      lg.gain.setValueAtTime(.0001, t); lg.gain.exponentialRampToValueAtTime(Math.max(.0002, o.vol * 1.1), pk); lg.gain.exponentialRampToValueAtTime(.0001, end + .05);
      src.connect(l); l.connect(lg); lg.connect(p); extra.push(l, lg);
    }
    if (o.send) { const s = gainNode(o.send, wet); g.connect(s); extra.push(s); }
    src.start(t, Math.random() * 2); src.stop(end + .1); track(src, extra);
  }
  // Pes gövde darbesi (et ve kemik hissinin "ağırlığı").
  function thud(t, o) {
    const osc = ctx.createOscillator(), g = gainNode(0), [bus, wet] = busOf(o.bus), dur = o.dur || .2;
    osc.type = 'sine'; osc.frequency.setValueAtTime(o.f0 || 95, t); osc.frequency.exponentialRampToValueAtTime(o.f1 || 38, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, o.vol), t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    const p = panner(o.pan || 0, bus); osc.connect(g); g.connect(p);
    const extra = [g, p]; if (o.send) { const s = gainNode(o.send, wet); g.connect(s); extra.push(s); }
    osc.start(t); osc.stop(t + dur + .05); track(osc, extra);
  }
  // Uyumsuz kısmi tınılar: metal çınlaması, çan.
  function ring(t, o) {
    const [bus, wet] = busOf(o.bus), out = gainNode(1), p = panner(o.pan || 0, bus); out.connect(p);
    const extra = [out, p]; if (o.send) { const s = gainNode(o.send, wet); out.connect(s); extra.push(s); }
    const parts = o.partials || [1, 2.76, 5.4, 8.93], last = [];
    parts.forEach((r, i) => {
      const osc = ctx.createOscillator(), g = gainNode(0), dec = (o.decay || 1) / Math.sqrt(1 + i * .8);
      osc.frequency.value = o.f * r * (1 + (Math.random() - .5) * .004);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, o.vol / (1 + i * .6)), t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
      osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dec + .05); last.push(osc, g);
    });
    track(last[0], extra.concat(last.slice(1)));
  }
  function tone(t, f, dur, vol, o = {}) {
    const osc = ctx.createOscillator(), g = gainNode(0), [bus, wet] = busOf(o.bus), p = panner(o.pan || 0, bus);
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t); if (o.bend) osc.frequency.exponentialRampToValueAtTime(Math.max(15, f * o.bend), t + dur);
    const a = o.attack || .01;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let head = osc; const extra = [g, p];
    if (o.lp) { const f2 = filter('lowpass', o.lp, o.q || .7); osc.connect(f2); head = f2; extra.push(f2); }
    head.connect(g); g.connect(p); if (o.send) { const s = gainNode(o.send, wet); g.connect(s); extra.push(s); }
    osc.start(t); osc.stop(t + dur + .05); track(osc, extra);
  }
  // Throat growl for the war cry: two detuned saws through a moving vowel formant, with a fast rough vibrato.
  function growl(t, dur, vol, o = {}) {
    const [bus, wet] = busOf(o.bus), out = gainNode(0), p = panner(o.pan || 0, bus); out.connect(p);
    const f1 = filter('bandpass', 520, 3.2), f2 = filter('bandpass', 1150, 5), mix = gainNode(1), low = filter('lowpass', 2600, .7);
    f1.connect(mix); f2.connect(gainNode(.55, mix)); mix.connect(low); low.connect(out);
    const extra = [out, p, f1, f2, mix, low]; if (o.send) { const s = gainNode(o.send, wet); out.connect(s); extra.push(s); }
    const base = o.f || 78, oscs = [-11, 9].map(det => { const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(base * 1.12, t);
      osc.frequency.exponentialRampToValueAtTime(base, t + .12); osc.frequency.exponentialRampToValueAtTime(base * .82, t + dur); osc.detune.value = det; osc.connect(f1); osc.connect(f2); return osc; });
    const vib = ctx.createOscillator(), vg = gainNode(28); vib.frequency.value = 23; vib.connect(vg); oscs.forEach(osc => vg.connect(osc.detune));
    f1.frequency.setValueAtTime(420, t); f1.frequency.linearRampToValueAtTime(700, t + .15); f1.frequency.linearRampToValueAtTime(480, t + dur);
    out.gain.setValueAtTime(.0001, t); out.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + .05); out.gain.setValueAtTime(vol, t + dur * .55); out.gain.exponentialRampToValueAtTime(.0001, t + dur);
    oscs.concat([vib]).forEach(osc => { osc.start(t); osc.stop(t + dur + .05); });
    track(oscs[0], extra.concat([oscs[1], vib, vg]));
  }
  function burst(t, dur, vol, f, o = {}) {   // kısa gürültü patlaması (kıvılcım, toz, kıpırtı)
    const src = noiseSrc(o.buf), bp = filter(o.type || 'bandpass', f, o.q || .8), g = gainNode(0), [bus, wet] = busOf(o.bus), p = panner(o.pan || 0, bus);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + (o.attack || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    if (o.f1) bp.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    src.connect(bp); bp.connect(g); g.connect(p); const extra = [bp, g, p];
    if (o.send) { const s = gainNode(o.send, wet); g.connect(s); extra.push(s); }
    src.start(t, Math.random() * 2); src.stop(t + dur + .05); track(src, extra);
  }
  function swell(t, dur, vol, o = {}) {      // ters dönen nefes: bir darbeye doğru yükselen gürültü
    const src = noiseSrc(N.pink), bp = filter('bandpass', o.f0 || 300, 1.1), g = gainNode(0), [bus, wet] = busOf(o.bus), p = panner(o.pan || 0, bus);
    bp.frequency.setValueAtTime(o.f0 || 300, t); bp.frequency.exponentialRampToValueAtTime(o.f1 || 2400, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .03);
    src.connect(bp); bp.connect(g); g.connect(p); const extra = [bp, g, p];
    if (o.send) { const s = gainNode(o.send, wet); g.connect(s); extra.push(s); }
    src.start(t, Math.random() * 2); src.stop(t + dur + .06); track(src, extra);
  }
  // Dünya zincirini kısa süre boğuklaştırır (ağır yara, savuşturma anı).
  let muffleUntil = 0;
  function muffle(freq, hold, release, delay = 0) {   // delay: lets the bite of the blow through before the world dulls
    const t = now() + delay, f = N.world.frequency;
    steadyTargets.delete(f); // the impact envelope temporarily owns this filter; reapply the current state after it
    f.cancelScheduledValues(t); f.setValueAtTime(Math.max(f.value, 200), t); f.exponentialRampToValueAtTime(freq, t + .03);
    f.setTargetAtTime(20000, t + hold, release); muffleUntil = t + hold + release * 3;
  }
  function duck(node, depth, hold, release) {
    const t = now(), g = node.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(depth, t + .03); g.setTargetAtTime(1, t + hold, release);
  }

  // ------------------------------------------------------------------ oyun bilgisi
  const MATERIAL = { prisoner: 'flesh', cultist: 'flesh', stalker: 'bone', carrier: 'wet', guard: 'armor', boss: 'armor', drowned: 'wet', rootborn: 'bone', crawler: 'bone', urchin: 'wet', lantern: 'flesh', bell: 'armor', ashbound:'flesh', shardseer:'bone', cavefang:'bone', gravemason:'stone', ruinwarden:'armor', hollowking:'armor', emberbound:'flesh', chainseer:'flesh', slagcrawler:'stone', forgesentinel:'armor', ashwarden:'armor', furnaceheart:'armor', damned:'flesh', verdictseer:'flesh', voidcrawler:'bone', chainjailer:'armor', verdictwarden:'armor', lastjudge:'armor' };
  function player() { const g = game(); return g && g.player; }
  function struckEnemies() {
    const g = game(), p = player(); if (!g || !p || !g.enemies) return [];
    return g.enemies.filter(e => e.hurt >= .999 && (!e.dead || !e.deadAge) && Math.hypot(e.x - p.x, e.z - p.z) < 6.5);
  }
  function enemyNear(x, z, living = true) {
    const g = game(); if (!g || !g.enemies) return null; let best = null, bd = 1.5;
    for (const e of g.enemies) { if (living && e.dead) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function justKilled() { const g = game(); return g && g.enemies ? g.enemies.find(e => e.dead && !e.deadAge) : null; }
  const actionName = e => (e && e.action && e.action.attack) || '';

  // ------------------------------------------------------------------ kahraman
  let comboGuess = 0, lastSwing = -9, stepCount = 0;
  function heroSwing(heavy, o, k) {
    const t = now(), p = player(), a = p && p.attack;
    let combo = o.combo != null ? o.combo : a && !a.heavy ? a.combo : (t - lastSwing < .95 ? (comboGuess + 1) % 3 : 0);
    const strike = o.strike != null ? o.strike : a && a.strike != null ? a.strike : heavy ? .57 : [.2, .23, .29][combo];
    comboGuess = combo; lastSwing = t;
    const hit = t + strike;
    if (!heavy) {
      const side = combo === 1 ? -1 : 1, low = combo === 2;
      sample('cloth', { vol: .22 * k, rate: rand(1, 1.15), send: .05 });
      if (chance(.45)) sample('gear', { vol: .12 * k, delay: .03 });
      whoosh(hit - .15, { dur: .3, peak: .5, f0: low ? 260 : 380, f1: low ? 1100 : 1700, f2: 520, q: 1.3, vol: (low ? .72 : .62) * k, pan0: .5 * side, pan1: -.5 * side, edge: .5, low: low ? 260 : 0, send: .12 });
      sample('swish', { vol: .65 * k, delay: Math.max(0, strike - .06), rate: low ? .85 : rand(.95, 1.08), pan: -.1 * side, send: .1 });
      swingWeight(false, strike, k, side, low);
      if (combo === 2 || chance(.22)) sample('effort', { vol: (combo === 2 ? .55 : .38) * k, delay: .02, rate: rand(.97, 1.03), send: .08, detune: .02 });
    } else {
      sample('strain', { vol: .6 * k, delay: .01, send: .1, detune: .02 });
      sample('cloth', { vol: .35 * k, rate: .8, send: .05 });
      sample('gear', { vol: .2 * k, delay: .08 });
      whoosh(t + .12, { dur: Math.max(.2, strike - .1), peak: 1, f0: 120, f1: 360, f2: 360, q: .8, vol: .12 * k, low: 180 });   // hazırlanış
      whoosh(hit - .22, { dur: .48, peak: .46, f0: 220, f1: 1250, f2: 300, q: 1, vol: .72 * k, pan0: .55, pan1: -.6, edge: .4, low: 320, send: .16 });
      sample('swish', { vol: .5 * k, delay: Math.max(0, strike - .08), rate: .72, send: .12 });
      thud(hit - .02, { f0: 70, f1: 32, dur: .28, vol: .15 * k });
      swingWeight(true, strike, k, 1, false);
    }
  }
  // Mass for the hero's swings (Kor ve Kül: swing weight): a low air-push sweep (blade mass, 80-200 Hz), a leather/steel rasp and, on heavy blows,
  // a deep pressure "whump" with a longer tail. Kept out of the enemy-tell bands (rasp is band-limited away from the tell rings, the rest sits below ~300 Hz)
  // and backed off when a tell fired within 0.3 s.
  function swingWeight(heavy, strike, k, side, low) {
    const t = now(), w = (nclock - lastTellN < .3 ? .5 : 1) * k, sd = rand(.92, 1.1);
    if (!heavy) {
      whoosh(t + strike - rand(.17, .21), { dur: .38, peak: .5, f0: 95 * sd, f1: (low ? 190 : 225) * sd, f2: 115 * sd, q: .75, vol: (low ? .95 : .85) * w, low: 260, pan0: .25 * side, pan1: -.25 * side, send: .1 });
      sample('swingRasp', { vol: .4 * w, delay: Math.max(0, strike - .15), rate: rand(.9, 1.1), pan: -.2 * side, send: .05, detune: .04 });
      sample('swingWump', { lp: 420, vol: (low ? .34 : .26) * w, delay: Math.max(0, strike - .1), rate: low ? 1.15 : 1.3, send: .05 });
    } else {
      whoosh(t + strike - .32, { dur: .7, peak: .5, f0: 70 * sd, f1: 185 * sd, f2: 78 * sd, q: .7, vol: .8 * w, low: 210, pan0: .3, pan1: -.3, send: .2 });
      whoosh(t + strike - .04, { dur: .55, peak: .12, f0: 140 * sd, f1: 125, f2: 68, q: .8, vol: .26 * w, low: 150, send: .32 });   // tail
      sample('swingRasp', { vol: .46 * w, delay: Math.max(0, strike - .24), rate: rand(.78, .9), send: .08, detune: .04 });
      sample('swingWump', { lp: 420, vol: .6 * w, delay: Math.max(0, strike - .13), rate: rand(.92, 1.06), send: .14 });
    }
  }
  // A blade lands on a foe (layers: steel/flesh bite, wet slap, material body, bone crack, metal ring; the body punch is added once per blow in H.hit).
  // tier: 0 light, 1 finisher, 2 heavy attack.
  function impact(type, heavy, k, at, tier = heavy ? 2 : 0) {
    const m = MATERIAL[type] || 'flesh', boss = type === 'boss' || type === 'bell' || type === 'hollowking' || type === 'furnaceheart' || type === 'lastjudge', w = tier === 2 ? 1 : tier === 1 ? .8 : .55, o = { at, send: tier ? .16 : .1, detune: .02 };
    const L = (name, vol, x) => sample(name, Object.assign({ vol: vol * k }, o, x)), fi = 1 + Math.floor(Math.random() * 3);   // flesh variant 0 is a hissy squelch: skipped
    if (m === 'armor') {
      L('hitCutSteel', .5 + .25 * w, { rate: rand(.95, 1.08) });
      L('armor', .8 + .4 * w, { rate: boss ? .8 : rand(.92, 1.04), delay: .005 });
      if (throttle('hitring', .06)) L(tier || boss ? 'hitRingB' : 'hitRingA', tier || boss ? .3 : .26, { delay: .008, rate: rand(.96, 1.05) });
      if (!tier) L('thump', .3, { rate: .9 });
      if (tier === 2) { L('metal', .4, { rate: .78, delay: .01 }); L('bone', .3, { delay: .015, lp: 6500 }); }
      if (boss) L('chain', .3, { delay: .03, rate: .85 });
    } else if (m === 'stone') {   // combat feel round: carved / slag bodies crack like masonry (grit, a dull crack, a low thud)
      L('hitCrack', .5 + .25 * w, { rate: rand(.62, .72) });
      L('debris', .45 + .3 * w, { delay: .006, rate: rand(.85, 1.05) });
      L('thump', .9 + .4 * w, { delay: .003, rate: rand(.7, .8) });
      if (tier) L('bone', .3, { rate: .7, delay: .014, lp: 5000 });
    } else if (m === 'wet') {
      L('hitCut', .45 + .2 * w, { rate: rand(.8, .9) });
      L('hitSlap', .65 + .3 * w, { rate: rand(.7, .8), delay: .003 });
      L('flesh', .5 + .25 * w, { rate: .78, delay: .008, index: fi, lp: 6000 }); L('flesh', .3, { rate: .62, delay: .03, index: (fi % 3) + 1, lp: 5000 });
      L('thump', .4);
      if (tier) { L('spit', .35, { rate: .7, delay: .04 }); L('hitSpray', .12, { delay: .02, rate: .85 }); }
    } else {
      L(m === 'bone' ? 'hitCrack' : 'hitCut', (m === 'bone' ? .4 : .5) + .25 * w, { rate: rand(.94, 1.08) });
      L('hitSlap', .9 + .3 * w, { delay: .003, rate: rand(.9, 1.1) });
      L('thump', 1 + .4 * w, { delay: .003, rate: rand(.9, 1) });
      L('flesh', .45 + .3 * w, { rate: rand(.85, 1), delay: .01, index: fi, lp: 6000 });
      if (tier || m === 'bone' || chance(.3)) L('bone', tier ? .5 : .28, { rate: m === 'bone' ? 1.1 : rand(.85, 1), delay: .012, lp: 6500 });
      if (tier === 2 && m !== 'bone') L('hitCrack', .35, { delay: .006, rate: .9 });
      if (type === 'cultist') L('cloth', .25, { rate: 1.2 });
    }
  }
  const PAIN = { prisoner: 'prisonerYell', guard: 'guardGrunt', cultist: 'hurt', stalker: 'stalkerShriek', carrier: 'carrierGurgle', boss: 'bossRoar', ashbound:'prisonerYell', shardseer:'hurt', cavefang:'stalkerShriek', gravemason:'guardGrunt', ruinwarden:'guardGrunt', hollowking:'bossRoar', emberbound:'prisonerYell', chainseer:'hurt', slagcrawler:'carrierGurgle', forgesentinel:'guardGrunt', ashwarden:'guardGrunt', furnaceheart:'bossRoar', damned:'prisonerYell', verdictseer:'hurt', voidcrawler:'stalkerShriek', chainjailer:'guardGrunt', verdictwarden:'guardGrunt', lastjudge:'bossRoar' };
  const PAIN_RATE = {ashbound:.84,shardseer:.92,cavefang:1.08,gravemason:.76,ruinwarden:.8,hollowking:.72,emberbound:.8,chainseer:.8,slagcrawler:.72,forgesentinel:.72,ashwarden:.8,furnaceheart:.65,damned:.86,verdictseer:.82,voidcrawler:1.02,chainjailer:.72,verdictwarden:.76,lastjudge:.6};
  function painVocal(e, heavy) {
    if (!e || e.dead || !throttle('pain_' + e.type, e.boss ? 2.4 : .75) || !chance(heavy ? .8 : .45)) return;
    const n = PAIN[e.type] || 'prisonerYell';
    sample(n, { vol: e.boss ? .45 : .5, at: e, rate: PAIN_RATE[e.type] || (e.type === 'cultist' ? 1.12 : rand(1, 1.12)), delay: .05, send: .15 });
  }

  // ------------------------------------------------------------------ olaylar
  let lastEnemyBlock = -9, lastHp = null;
  const H = {};
  H.attack = H.light = H.swing = (o, k) => heroSwing(false, o, k);
  H.heavy = (o, k) => heroSwing(true, o, k);
  // An enemy's release follows its own contact time and position. It must
  // never borrow the hero's combo, breath or delayed blade envelope.
  H.enemySwing = (o, k) => {
    const t = now(), s = spatial(o.x, o.z), boss = o.type === 'boss';
    const heavy = o.heavy == null ? boss || o.type === 'guard' : !!o.heavy;
    const strike = Number.isFinite(o.strikeIn) ? clamp(o.strikeIn, 0, .4) : heavy ? .2 : .13;
    const lead = Math.max(.008, Math.min(strike, heavy ? .18 : .11));
    const start = t + Math.max(0, strike - lead), dur = lead + (heavy ? .16 : .11);
    whoosh(start, { dur, peak: lead / dur, f0: heavy ? 180 : 580, f1: heavy ? 1050 : 2200,
      f2: heavy ? 260 : 700, q: heavy ? .85 : 1.35, vol: (boss ? .34 : heavy ? .24 : .18) * k * s.gain,
      pan0: s.pan + .12, pan1: s.pan - .12, low: heavy ? 180 : 0, edge: boss ? .12 : 0, send: .1 });
  };
  H.hit = H.heavyHit = H.blood = (o, k, name) => {
    const t = now(), p = player(), pa = (p || {}).attack;
    const tier = o.heavy ? 2 : o.finisher ? 1 : pa ? (pa.heavy ? 2 : pa.combo === 2 ? 1 : 0) : name === 'heavyHit' ? (k >= .99 ? 1 : 2) : 0;
    const weapon = o.weaponType || (p && p.model && p.model.equipment && p.model.equipment.weaponType) || 'sword';
    k *= weapon === 'axe' ? 1.07 : weapon === 'spear' ? .96 : 1;
    let targets = struckEnemies();
    if (!targets.length) { if (t - lastEnemyBlock < .08) return; targets = [{ type: o.type || 'prisoner', x: NaN, z: NaN }]; }
    k *= [1.22, .95, .8][tier] * rand(.92, 1.08);   // loudness ladder: light < finisher < heavy < kill, all under the boss slam and the war cry; a little level jitter per blow
    const scale = k * (targets.length > 1 ? .8 : 1), seen = new Set(), kill = targets.some(e => e.dead);
    for (const e of targets) { if (seen.has(e.type) || seen.size >= 2) continue; seen.add(e.type); impact(e.type, tier > 0, scale, e, tier); if (Number.isFinite(e.x)) painVocal(e, tier > 0); }
    // One body punch per blow (dry, centred), deeper and longer for heavy blows; a sub boom under finisher / heavy / kill.
    sample(tier === 2 ? 'hitPunchH' : 'hitPunchL', { vol: (tier === 2 ? .9 : tier === 1 ? .8 : .65) * k, rate: rand(.95, 1.06), send: tier ? .12 : .06, detune: .02 });
    if (weapon === 'axe' && throttle('axeBite', .08)) sample('hitCrack', { vol: .22*k, rate: .76, delay: .005, send: .06 });
    if (weapon === 'spear' && throttle('spearBite', .08)) sample('hitCut', { vol: .20*k, rate: 1.2, lp: 4900, send: .03 });
    if (o.critical && throttle('criticalBite', .16)) { sample('hitCutSteel', { vol: .18*k, rate: 1.14, delay: .003 }); sample('hitRingA', { vol: .10*k, rate: .93, delay: .012, send: .13 }); }
    if (tier || kill) sample('hitSub', { vol: (tier === 2 ? .45 : tier === 1 ? .3 : .22) * k * (kill ? 1.3 : 1), send: .1, detune: .03, delay: .004 });
    if (kill) thud(t + .008, { f0: 82, f1: 30, dur: .42, vol: .42 * k, send: .15 });   // the body's weight gives out (render: kills had the least sub of any blow)
    if (kill) {   // the finishing blow: bone and wet crunch, a spray, a heavier ring
      const dead = targets.find(e => e.dead), armor = dead && MATERIAL[dead.type] === 'armor', at = dead && Number.isFinite(dead.x) ? dead : null;
      if (armor) { sample('hitRingB', { vol: .55 * k, at, send: .2, rate: .9, delay: .01 }); sample('metal', { vol: .6 * k, at, rate: .72, delay: .02 }); sample('armor', { vol: .65 * k, at, rate: .6, delay: .02 }); }
      else { sample('hitSpray', { vol: .22 * k, at, send: .2, delay: .015, rate: rand(.9, 1.1) }); sample('bone', { vol: .5 * k, at, rate: rand(.8, .95), delay: .02 }); sample('flesh', { vol: .4 * k, at, rate: .7, delay: .03 }); }
    }
  };
  H.block = (o, k) => {
    const t = now();
    if (o.enemy) {          // the hero's blade bites a raised shield: steel bite, wood thud, short clang
      lastEnemyBlock = t;
      sample('hitCutSteel', { vol: .7 * k, rate: rand(.9, 1), send: .12 }); sample('shield', { vol: 1.15 * k, rate: rand(.9, 1.05), delay: .004, send: .12 });
      sample('hitPunchL', { vol: .8 * k, rate: .9, send: .05 }); sample('hitClang', { vol: .3 * k, rate: rand(1.05, 1.2), delay: .006, send: .22 }); sample('clank', { vol: .45 * k, rate: 1.15 });
      return;
    }
    // an enemy blade on the hero's guard: bright clang over the shock through the arms
    k *= .93 * rand(.92, 1.08);
    sample('hitCutSteel', { vol: .8 * k, rate: rand(.9, 1), send: .12 }); sample('hitClang', { vol: .9 * k, rate: rand(.92, 1.06), delay: .004, send: .22 });
    sample('clank', { vol: .6 * k, rate: rand(.9, 1), send: .18 }); sample('metal', { vol: .3 * k, rate: .8, send: .2 });
    sample('hitPunchL', { vol: .8 * k, rate: rand(.85, .95), send: .06 }); sample('thump', { vol: .4 * k, rate: .8 });
  };
  H.parry = (o, k) => {
    k *= .8 * rand(.94, 1.06);
    sample('hitPing', { vol: 2 * k, rate: rand(.97, 1.05), send: .4, prio: 1 }); sample('metal', { vol: .7 * k, rate: rand(.95, 1.02), send: .35, prio: 1 });
    sample('shing', { vol: .8 * k, send: .35, delay: .01 }); sample('hitCutSteel', { vol: .5 * k, rate: rand(1.1, 1.25), send: .2 });
    sample('clank', { vol: .3 * k, rate: 1.3, send: .2 }); sample('hitPunchL', { vol: .5 * k, rate: 1.15, send: .08 });
    sample('hitClang', { vol: .8 * k, rate: rand(.75, .85), send: .4, delay: .004 });
    if (throttle('hitring', .06)) sample('hitRingA', { vol: .4 * k, rate: 1.25, send: .3, delay: .004 });
    duck(N.musicDuck, .35, .35, .25); duck(N.ambDuck, .45, .35, .25);
  };
  H.guardBreak = (o, k) => {
    const p = player(), b = k * .7;   // b: the physical layers, k: the voices
    if (p && p.stagger > .45) {        // oyuncunun savunması kırıldı
      sample('clank', { vol: 1 * b, rate: .7, send: .25 }); sample('metal', { vol: .55 * b, rate: .6, send: .3 }); sample('hitCutSteel', { vol: .7 * b, rate: .9 });
      sample('strain', { vol: .55 * k, rate: 1.05, delay: .04 }); sample('hitPunchH', { vol: 1 * b, rate: .95, send: .12 }); sample('hitSub', { vol: .4 * b, send: .1 });
      muffle(1400, .12, .3, .05);
    } else {                            // muhafızın kalkanı kırıldı
      sample('armor', { vol: 1 * b, rate: .7, send: .25 }); sample('shield', { vol: .9 * b, rate: .6 }); sample('metal', { vol: .5 * b, rate: .7, send: .25 });
      sample('hitCutSteel', { vol: .7 * b, rate: .85 }); sample('hitRingB', { vol: .28 * b, send: .25, delay: .01 });
      sample('guardGrunt', { vol: .6 * k, delay: .06 }); sample('hitPunchH', { vol: .95 * b, rate: .9, send: .12 }); sample('hitSub', { vol: .4 * b, send: .1 });
    }
  };
  H.hurt = (o, k) => {
    // Enemy blow on the hero: a dull, painful body hit. The chest thump, slap and rattle stand on their own (the grunt is throttled and random),
    // the bite stays a little dark so it reads as pain rather than as the hero's own blade.
    const p = player(), dmg = p && lastHp != null ? Math.max(0, lastHp - p.hp) : 15, w = clamp(dmg / 32, .3, 1), b = k * (.82 - .05 * w) * rand(.92, 1.08);
    if (throttle('herohurt', .3) && chance(.9)) sample('hurt', { vol: .7 * k, delay: .02, send: .08, detune: .02, prio: 1 });
    sample('hitBody', { vol: (.75 + .3 * w) * b, rate: rand(.94, 1.05), send: .08, detune: .02 });
    sample('hitSlap', { vol: (.4 + .3 * w) * b, rate: rand(.8, .9), lp: 2600, delay: .002 }); sample('flesh', { vol: (.35 + .25 * w) * b, rate: .85, lp: 2800, delay: .008 });
    sample('thump', { vol: (.4 + .3 * w) * b, rate: .85 }); sample('hitCut', { vol: (.3 + .25 * w) * b, rate: rand(.85, .95), lp: 4500 });
    sample('gear', { vol: .2 * b, rate: rand(.85, 1), delay: .012 });
    if (dmg >= 18) { sample('hitSub', { vol: .35 * b, send: .1 }); sample('hitCrack', { vol: .28 * b, rate: .8, delay: .006 }); muffle(dmg >= 28 ? 700 : 1300, .08, .35, .05); }
  };
  // Hücum wind-up: a quiet, short rising breath and cloth rustle (src/charge.js); the dash itself uses 'dodge', the impact 'specialHit' / 'slam'.
  H.chargeWind = (o, k) => {
    const t = now(), tier = o.tier || 1; swell(t, .13 + .05 * tier, (.1 + .04 * tier) * k, { f0: 160 - 30 * tier, f1: 900 - 120 * tier, send: .08 }); sample('cloth', { vol: .3 * k, rate: .8 });
    if (tier === 2) { burst(t, .16, .07 * k, 3200, { q: 1.5, attack: .1, send: .1 }); tone(t, 90, .2, .06 * k, { type: 'sawtooth', bend: 1.6, lp: 420, attack: .15, send: .1 }); }
    if (tier === 3) { tone(t, 52, .26, .16 * k, { type: 'sawtooth', bend: 1.8, lp: 300, attack: .2, send: .25 }); sample('chain', { vol: .5 * k, rate: .7, delay: .05 }); }
  };
  // Tier III roar at the start of Mahşer Hücumu: a deep throat growl, a gut thud and a dark dissonant ring.
  H.chargeRoar = (o, k) => {
    const t = now() + .02; growl(t, .55, .3 * k, { f: 64, send: .35 }); thud(t + .03, { f0: 60, f1: 24, dur: .6, vol: .6 * k, send: .3 });
    ring(t + .05, { f: 98, partials: [1, 2.03, 2.97, 4.2], decay: 1.4, vol: .05 * k, send: .5 }); burst(t, .5, .1 * k, 700, { q: .6, f1: 180, send: .3 });
  };
  // Dash layers: I the plain rush (dodge), II + hissing molten crackle and a brighter whoosh, III + a heavy battering-ram rumble and iron scrape.
  H.chargeDash = (o, k) => {
    const tier = o.tier || 1, t = now(); H.dodge(o, k * (1 + .12 * (tier - 1)));
    if (tier >= 2) {
      burst(t, .4, .1 * k, 3800, { q: 1.1, f1: 1400, send: .1 }); whoosh(t, { dur: .45, peak: .3, f0: 500, f1: 3000, f2: 700, q: 1.2, vol: .3 * k, edge: .4, send: .1 });
      for (let i = 0; i < 6; i++) burst(t + .04 + i * .055, .03, .05 * k, rand(3000, 7000), { q: 2.5 });
    }
    if (tier === 3) {
      tone(t, 56, .55, .2 * k, { type: 'sawtooth', bend: .75, lp: 260, attack: .06, send: .3 }); sample('chain', { vol: .6 * k, rate: .6, delay: .02 }); sample('metal', { vol: .35 * k, rate: .55, delay: .08 });
      thud(t + .04, { f0: 70, f1: 26, dur: .5, vol: .5 * k, send: .25 });
    }
  };
  // Impact layers: I the old iron crack and floor thud; II + stone fissures cracking and a molten ring; III a deep, long boom with tumbling rubble.
  H.chargeImpact = (o, k) => {
    const tier = o.tier || 1, t = now(), at = { x: o.x, z: o.z }; H.specialHit(o, k * (tier === 3 ? 1.1 : .95));
    // identity tails (offline render showed I and II nearly identical): I Kül = a dry ash crumble settling; II Kor = molten hiss with ember crackle
    if (tier === 1) { sample('debris', { vol: .5 * k, at, rate: 1.15, delay: .06 }); burst(t + .04, .7, .09 * k, 900, { q: .5, f1: 260, attack: .08, send: .25 }); }
    if (tier === 2) {
      burst(t + .05, 1.3, .11 * k, 5200, { q: .7, f1: 2400, attack: .06, send: .2 }); ring(t + .02, { f: 523, partials: [1, 2.76, 5.4], decay: 1.2, vol: .03 * k, send: .5 });
      for (let i = 0; i < 9; i++) burst(t + .12 + i * rand(.07, .13), .025, .045 * k, rand(3500, 8000), { q: 3 });
    }
    if (tier >= 2) {
      sample('debris', { vol: .8 * k, at, rate: .7, delay: .03 }); sample('hitCrack', { vol: .6 * k, rate: .7, delay: .01 }); sample('bone', { vol: .4 * k, at, rate: .6, delay: .06 });
      burst(t + .02, .5, .13 * k, 2600, { q: 1, f1: 700, send: .2 }); ring(t + .04, { f: 262, partials: [1, 2.4, 3.9, 5.7], decay: 1.1, vol: .035 * k, send: .5 });
    }
    if (tier === 3) {
      thud(t, { f0: 56, f1: 18, dur: 1.1, vol: 1.25 * k, send: .4 }); sample('stomp', { vol: .9 * k, at, rate: .6, prio: 1 }); sample('debris', { vol: .7 * k, at, rate: .6, delay: .22 });
      burst(t, .9, .3 * k, 240, { q: .45, f1: 70, send: .45 }); ring(t + .03, { f: 110, partials: [1, 2.03, 3.05, 4.1], decay: 1.6, vol: .05 * k, send: .55 }); muffle(1500, .06, .3);
    }
  };
  H.chargeSlam2 = (o, k) => {
    const t = now(), at = { x: o.x, z: o.z };
    thud(t, { f0: 52, f1: 16, dur: 1.3, vol: 1.5 * k, send: .45 }); sample('stomp', { vol: 1 * k, at, rate: .55, prio: 1 }); sample('debris', { vol: .9 * k, at, rate: .55, delay: .03 }); sample('debris', { vol: .6 * k, at, rate: .8, delay: .24 });
    sample('hitCrack', { vol: .8 * k, rate: .6 }); sample('metal', { vol: .5 * k, at, rate: .5, delay: .02 }); burst(t, 1, .34 * k, 200, { q: .4, f1: 60, send: .5 });
    ring(t + .03, { f: 87, partials: [1, 2.03, 3.05, 4.1, 5.9], decay: 2, vol: .06 * k, send: .6 }); muffle(1100, .1, .4);
  };
  // Whirlwind tier layers: II Ölüm Biçeni = bright scythe whooshes and gold ringing steel; III Son Hüküm = dark drone, violent thuds and a final boom.
  H.whirlStart = (o, k) => {
    const tier = o.tier || 2, t = now();
    if (tier === 2) { whoosh(t, { dur: .5, peak: .5, f0: 400, f1: 3000, f2: 600, q: 1.3, vol: .4 * k, edge: .5, send: .15 }); ring(t + .02, { f: 392, partials: [1, 2.76, 5.4], decay: .9, vol: .03 * k, send: .5 }); }
    else { growl(t, .5, .22 * k, { f: 70, send: .35 }); tone(t, 49, 1.6, .16 * k, { type: 'sawtooth', bend: 1.4, lp: 240, attack: .5, send: .35 }); thud(t, { f0: 62, f1: 24, dur: .7, vol: .8 * k, send: .3 }); sample('debris', { vol: .6 * k, rate: .6, delay: .03 }); }
  };
  H.whirlTick = (o, k) => {
    const tier = o.tier || 2, t = now(), at = { x: o.x, z: o.z };
    if (tier === 2) {
      whoosh(t - .05, { dur: .25, peak: .5, f0: 700, f1: 3400, f2: 800, q: 1.6, vol: .32 * k, edge: .6 });
      ring(t, { f: 523, partials: [1, 2.76, 5.4], decay: .6, vol: .022 * k, send: .4 });
      if (o.last) { thud(t, { f0: 66, f1: 22, dur: .8, vol: .9 * k, send: .35 }); sample('debris', { vol: .7 * k, at, rate: .65, delay: .02 }); ring(t, { f: 262, partials: [1, 2.4, 3.9], decay: 1.3, vol: .05 * k, send: .5 }); }
    } else {
      thud(t, { f0: 58 + (o.last ? 0 : 10), f1: 20, dur: o.last ? 1.3 : .35, vol: (o.last ? 1.5 : .6) * k, send: o.last ? .45 : .2 });
      sample('debris', { vol: (o.last ? .9 : .4) * k, at, rate: .6 + .05 * (o.n || 0), delay: .02 }); sample('chain', { vol: .5 * k, at, rate: .55 });
      whoosh(t - .05, { dur: .3, peak: .5, f0: 160, f1: 1200, f2: 220, q: 1, vol: .4 * k, low: 220 });
      if (o.last) { burst(t, 1, .38 * k, 220, { q: .4, f1: 60, send: .5 }); ring(t + .02, { f: 82, partials: [1, 2.03, 3.05, 4.1, 5.9], decay: 2.2, vol: .07 * k, send: .6 }); sample('hitCrack', { vol: .8 * k, rate: .55 }); muffle(1000, .1, .45); }
    }
  };
  H.dodge = (o, k) => {
    const t = now(), p = player(), pan = p && Number.isFinite(p.face) ? Math.sin(p.face) * .45 : 0;
    sample('cloth', { vol: .75 * k, rate: rand(.9, 1.05) });
    whoosh(t, { dur: .38, peak: .35, f0: 200, f1: 950, f2: 240, q: .9, vol: .75 * k, pan0: -pan * .6, pan1: pan, low: 260, send: .06 });
    thud(t + .02, { f0: 110, f1: 55, dur: .16, vol: .35 * k });   // ağır gövdenin yer değiştirmesi
    if (chance(.25)) sample('effort', { vol: .25 * k, rate: 1.08, delay: .03, detune: .02 });
    sample('scuff', { vol: .38 * k, delay: .3 }); if (chance(.5)) sample('gear', { vol: .14 * k, delay: .05 });
  };
  H.step = (o, k) => {
    if (!throttle('step', .045)) return;
    const v = o.volume == null ? .4 : o.volume, dodge = v > .5;
    stepCount++;
    sample('step', { vol: (dodge ? 1.1 : .85) * k, rate: rand(.92, 1.05), lp: 7000, send: .06 });   // ajan:audio: was 1.3/1.1 — every step peaked at -4.6 dBFS, almost a sword hit (-1.6)
    if (room() === 2 && chance(.6)) sample('wetStep', { vol: .22 * k, rate: rand(.9, 1.1) });
    if (stepCount % 3 === 0) sample('gear', { vol: .07 * k, rate: rand(.9, 1.1) });
    if (dodge) sample('scuff', { vol: .6 * k });
  };
  H.enemyWindup = (o, k) => {
    const e = enemyNear(o.x, o.z), type = o.type || (e && e.type), at = { x: o.x, z: o.z }, act = actionName(e), t = now();
    const vocal = (n, v, extra) => { if (throttle('wind_' + type, .7)) sample(n, Object.assign({ vol: v * k, at, send: .16, prio: 1 }, extra)); };
    // Unblockable blow coming: a deep bell under the usual wind-up.
    if (o.unblockable && throttle('ubell', .45)) { const s = spatial(o.x, o.z); sample('bell', { vol: .32 * k, rate: .55, at, send: .5, prio: 1 }); ring(t, { f: 98, partials: [1, 2.4, 3.9, 5.3], decay: 2.2, vol: .05 * k * s.gain, pan: s.pan, send: .6 }); }
    switch (type) {
      case 'ashbound': vocal('prisonerYell', .58, {rate:.8,lp:3100}); sample('armorStep',{vol:.18*k,at,rate:.9}); break;
      case 'shardseer': vocal('tortWhisper', .33, {rate:.83,lp:2300,send:.28}); sample('rune',{vol:.2*k,at,rate:1.18,send:.2}); break;
      case 'cavefang': vocal('stalkerShriek', .62, {rate:1.12}); sample('bone',{vol:.15*k,at,rate:1.1}); break;
      case 'gravemason': vocal('guardGrunt', .6, {rate:.72,lp:2900}); sample('debris',{vol:.22*k,at,rate:.8}); break;
      case 'ruinwarden': vocal('guardGrunt', .72, {rate:.8}); sample('armorStep',{vol:.3*k,at,rate:.72}); break;
      case 'hollowking': vocal('bossRoar', .68, {rate:.68,lp:3800}); sample('bone',{vol:.24*k,at,rate:.7}); break;
      case 'emberbound': vocal('prisonerYell', .55, {rate:.74,lp:2600}); sample('metal',{vol:.15*k,at,rate:.85}); break;
      case 'chainseer': vocal('tortWhisper', .34, {rate:.7,lp:1800}); sample('winch',{vol:.28*k,at,rate:.82}); sample('chain',{vol:.25*k,at,rate:1.08,delay:.08}); break;
      case 'slagcrawler': vocal('carrierGurgle', .45, {rate:.66,lp:1900}); sample('scuff',{vol:.18*k,at,rate:.7}); break;
      case 'forgesentinel': vocal('guardGrunt', .58, {rate:.65,lp:2400}); sample('metal',{vol:.3*k,at,rate:.62}); break;
      case 'ashwarden': vocal('bossRoar', .52, {rate:.8,lp:3200}); sample('chain',{vol:.36*k,at,rate:.78}); break;
      case 'furnaceheart': vocal('bossRoar', .74, {rate:.61,lp:2900}); sample('winch',{vol:.32*k,at,rate:.65}); break;
      case 'drowned': vocal('carrierGurgle', .7, {rate:.7}); break;
      case 'rootborn': sample('winch',{vol:.3*k,at,rate:.55}); break;
      case 'crawler': vocal('stalkerShriek', .5, {rate:1.15}); break;
      case 'urchin': vocal('carrierGurgle', .7, {rate:.55}); break;
      case 'lantern': vocal('tortWhisper', .35, {rate:.75,lp:1800,send:.5}); break;
      case 'bell': vocal('bossRoar',.7,{rate:.62}); if(/Çan|YEMİN/.test(o.attack||''))sample('bell',{vol:.4*k,at,rate:.45,send:.6}); break;
      case 'prisoner': vocal('prisonerYell', 1.15, { rate: rand(.95, 1.1) }); sample('chain', { vol: .22 * k, at, rate: rand(1, 1.25) }); break;
      case 'guard': vocal('guardGrunt', .8); sample('armorStep', { vol: .35 * k, at, rate: .75 }); break;
      case 'cultist':
        if (act.includes('Kan')) sample('chant3', { vol: .85 * k, at, send: .35, prio: 1, detune: .01 });
        else sample(chance(.5) ? 'chant1' : 'chant2', { vol: .8 * k, at, send: .35, prio: 1, detune: .01 });
        tone(t + .1, 55, 1.3, .06 * k, { type: 'sawtooth', lp: 240, attack: .9, send: .3 }); break;
      case 'stalker':
        vocal('stalkerShriek', .7, { rate: rand(.95, 1.1) });
        if (act.includes('Sıçray')) whoosh(t + .35, { dur: .75, peak: .95, f0: 180, f1: 900, f2: 900, q: 1.4, vol: .18 * k, pan0: spatial(o.x, o.z).pan, send: .2 });
        break;
      case 'carrier': vocal('carrierGurgle', 1.2, { rate: rand(.85, 1) }); sample('flesh', { vol: .25 * k, at, rate: .55, delay: .15 }); break;
      case 'boss':
        if (act.includes('Zincir')) { sample('winch', { vol: .6 * k, at, prio: 1 }); sample('chain', { vol: .8 * k, at, prio: 1 }); sample('chain', { vol: .5 * k, at, delay: .18, rate: .85 }); vocal('bossRoar', .55); }
        else if (act.includes('Mezar')) { vocal('bossRoar', 1, { rate: .9 }); sample('chain', { vol: .55 * k, at, delay: .2 }); swell(t + .2, Math.max(.4, (act.includes('Kıran') ? 1.3 : 1)), .12 * k, { f0: 90, f1: 700, send: .3 }); }
        else { vocal('bossRoar', .85); whoosh(t + .2, { dur: .9, peak: 1, f0: 90, f1: 300, f2: 300, q: .7, vol: .14 * k, low: 160 }); }
        break;
      default: if (type) vocal('prisonerYell', .5);
    }
  };
  H.enemyAttack = (o, k) => {
    const at = { x: o.x, z: o.z }, t = now(), a = o.attack || '', s = spatial(o.x, o.z), pan = s.pan;
    switch (o.type) {
      case 'ashbound': sample('swish',{vol:.38*k,at,rate:.9});sample('armor',{vol:.16*k,at,rate:.9});break;
      case 'shardseer': sample('rune',{vol:.38*k,at,rate:1.22,send:.18});sample('bone',{vol:.2*k,at,rate:1.24});break;
      case 'cavefang': sample('swish',{vol:.43*k,at,rate:1.4});sample('bone',{vol:.22*k,at,rate:1.12});break;
      case 'gravemason': sample('stomp',{vol:.52*k,at,rate:.8});sample('debris',{vol:.42*k,at,rate:.9});thud(t,{f0:105,f1:42,dur:.24,vol:.35*k*s.gain,pan});break;
      case 'ruinwarden': sample('swish',{vol:.5*k,at,rate:.73});sample('armor',{vol:.3*k,at,rate:.76});break;
      case 'hollowking': sample('swish',{vol:.58*k,at,rate:.61});sample('bone',{vol:.28*k,at,rate:.72});thud(t,{f0:82,f1:35,dur:.27,vol:.34*k*s.gain,pan});break;
      case 'emberbound': sample('swish',{vol:.4*k,at,rate:.88});sample('metal',{vol:.22*k,at,rate:.92});break;
      case 'chainseer': sample('chain',{vol:.5*k,at,rate:1.08});sample('winch',{vol:.24*k,at,rate:.83});break;
      case 'slagcrawler': sample('scuff',{vol:.3*k,at,rate:.72});sample('bone',{vol:.26*k,at,rate:.67});sample('swish',{vol:.28*k,at,rate:1.17});break;
      case 'forgesentinel': sample('metal',{vol:.48*k,at,rate:.64});sample('stomp',{vol:.36*k,at,rate:.73});thud(t,{f0:91,f1:33,dur:.28,vol:.4*k*s.gain,pan});break;
      case 'ashwarden': sample('chain',{vol:.4*k,at,rate:.8});sample('swish',{vol:.48*k,at,rate:.66});sample('metal',{vol:.26*k,at,rate:.75});break;
      case 'furnaceheart': sample('metal',{vol:.55*k,at,rate:.57});sample('winch',{vol:.28*k,at,rate:.63});thud(t,{f0:68,f1:27,dur:.34,vol:.48*k*s.gain,pan,send:.15});break;
      case 'drowned': sample('swish',{vol:.45*k,at,rate:.75});sample('wetStep',{vol:.20*k,at,rate:.6});break;
      case 'rootborn': sample('debris',{vol:.40*k,at,rate:.7});sample('winch',{vol:.2*k,at,rate:.6});break;
      case 'crawler': sample('swish',{vol:.4*k,at,rate:1.25});sample('bone',{vol:.17*k,at,rate:1.1});break;
      case 'urchin': sample('spit',{vol:.55*k,at,rate:.8});break;
      case 'lantern': sample('rune',{vol:.45*k,at,rate:.7,send:.3});break;
      case 'bell': sample(o.style==='root'?'debris':o.style==='tide'?'carrierGurgle':'metal',{vol:.55*k,at,rate:.6});sample('bell',{vol:.24*k,at,rate:.5,send:.5});thud(t,{f0:65,f1:25,dur:.35,vol:.45*k*s.gain,pan});break;
      case 'prisoner': whoosh(t - .05, { dur: .2, peak: .6, f0: 700, f1: 2400, f2: 900, q: 1.6, vol: .3 * k * s.gain, pan0: pan - .2, pan1: pan + .2 }); sample('swish', { vol: .4 * k, at, rate: 1.25 }); break;
      case 'guard':
        if (/Kalkan|Darbe/i.test(a)) { sample('shield', { vol: .8 * k, at, rate: .8 }); thud(t, { f0: 110, f1: 45, dur: .18, vol: .45 * k * s.gain, pan }); }
        whoosh(t - .1, { dur: .34, peak: .6, f0: 240, f1: 1100, f2: 400, q: 1, vol: .45 * k * s.gain, pan0: pan + .3, pan1: pan - .3, low: 280 }); sample('swish', { vol: .38 * k, at, rate: .8 }); break;
      case 'cultist':
        sample('rune', { vol: .95 * k, at, send: .3, prio: 1 }); thud(t, { f0: 70, f1: 30, dur: .45, vol: .6 * k * s.gain, pan, send: .2 });
        ring(t, { f: 97, partials: [1, 2.4, 3.9], decay: 1.4, vol: .05 * k * s.gain, pan, send: .4 }); sample('debris', { vol: .35 * k, at, rate: 1.2 }); break;
      case 'stalker': whoosh(t - .06, { dur: .22, peak: .6, f0: 800, f1: 2600, f2: 1100, q: 1.8, vol: .35 * k * s.gain, pan0: pan + .25, pan1: pan - .25 }); sample('swish', { vol: .45 * k, at, rate: 1.35 }); break;
      case 'carrier': sample('spit', { vol: 1 * k, at, prio: 1 }); sample('flesh', { vol: .3 * k, at, rate: .7, delay: .08 }); break;
      case 'boss':
        if (a.includes('Zincir')) { sample('chain', { vol: 1 * k, at, prio: 1 }); sample('metal', { vol: .3 * k, at, rate: .65 }); whoosh(t - .08, { dur: .3, peak: .5, f0: 500, f1: 2200, f2: 700, q: 1.5, vol: .45 * k * s.gain, pan0: pan, pan1: 0 }); }
        else whoosh(t - .15, { dur: .5, peak: .5, f0: 150, f1: 900, f2: 250, q: .9, vol: .7 * k * s.gain, pan0: pan + .4, pan1: pan - .4, low: 250, send: .2 });
        break;
      default: sample('swish', { vol: .4 * k, at });
    }
  };
  H.slam = H.explosion = (o, k) => {
    const at = { x: o.x, z: o.z }, t = now(), a = o.attack || '', s = spatial(o.x, o.z), v = k * Math.max(.45, s.gain);
    if (a.includes('Patlama') || o.type === 'carrier') {        // çürüyen bedenin patlaması
      sample('flesh', { vol: 1 * v, at, rate: .6, prio: 1 }); sample('flesh', { vol: .8 * v, at, rate: .85, delay: .03 }); sample('bone', { vol: .6 * v, at, rate: .8, delay: .02 });
      sample('carrierGurgle', { vol: .6 * v, at, rate: .6, delay: .05 }); thud(t, { f0: 75, f1: 28, dur: .5, vol: .9 * v, pan: s.pan, send: .25 });
      burst(t, .5, .25 * v, 500, { q: .5, f1: 150, pan: s.pan, send: .25 });
      return;
    }
    if (a.includes('Mezar') || a.includes('artçı')) {         // yeri yaran tepe darbesi
      thud(t, { f0: 68, f1: 24, dur: .75, vol: 1.1 * v, pan: s.pan, send: .35 }); sample('stomp', { vol: 1 * v, at, rate: .75, prio: 1 });
      sample('debris', { vol: .9 * v, at, delay: .04 }); sample('debris', { vol: .5 * v, at, delay: .22, rate: .8 }); sample('chain', { vol: .45 * v, at, delay: .05, rate: .8 });
      burst(t, .9, .35 * v, 300, { q: .4, f1: 90, pan: s.pan, send: .4 }); muffle(1800, .05, .25);
      return;
    }
    // biçme ve savuruşlar
    whoosh(t - .18, { dur: .55, peak: .45, f0: 140, f1: 800, f2: 200, q: .8, vol: .8 * v, pan0: s.pan + .5, pan1: s.pan - .5, low: 240, send: .25 });
    sample('chain', { vol: .6 * v, at, delay: .02, rate: .75 }); thud(t, { f0: 80, f1: 30, dur: .4, vol: .6 * v, pan: s.pan });
  };
  // Physical mechanism contacts: one short material signature at the actual endpoint.
  H.boss2Shatter = (o, k) => {
    if (B.app && B.app.warming) return;
    if (!throttle('boss2Shatter', .045)) return;
    const t=now(), at={x:o.x,z:o.z}, s=spatial(o.x,o.z);
    sample('hitCrack',{vol:.48*k,at,rate:.82,prio:1});
    sample('debris',{vol:.55*k,at,rate:1.05,delay:.035,send:.16});
    thud(t,{f0:112,f1:48,dur:.23,vol:.33*k*s.gain,pan:s.pan,send:.1});
  };
  H.boss2Nova = (o, k) => {
    if (B.app && B.app.warming) return;
    if (!throttle('boss2Nova', .18)) return;
    const t=now(), s=spatial(o.x,o.z), at={x:o.x,z:o.z};
    thud(t,{f0:62,f1:23,dur:.48,vol:.78*k*s.gain,pan:s.pan,send:.24});
    burst(t,.25,.11*k*s.gain,410,{f1:110,q:.5,pan:s.pan,send:.18});
    sample('debris',{vol:.26*k,at,rate:.78,delay:.045});
  };
  H.boss2OrbImpact = (o, k) => {
    if (B.app && B.app.warming) return;
    if (!throttle('boss2OrbImpact', .06)) return;
    const t=now(), s=spatial(o.x,o.z), at={x:o.x,z:o.z};
    sample(o.forge?'metal':'hitCrack',{vol:.36*k,at,rate:o.forge?.86:1.16,send:.12});
    sample('debris',{vol:.20*k,at,rate:o.forge?.85:1.25,delay:.02});
    thud(t,{f0:o.forge?98:146,f1:48,dur:.17,vol:.24*k*s.gain,pan:s.pan});
  };
  H.poison = (o, k) => {
    const at = { x: o.x, z: o.z }, t = now(), s = spatial(o.x, o.z);
    sample('spit', { vol: .75 * k, at, rate: .65 });
    for (let i = 0; i < 7; i++) tone(t + .05 + i * rand(.04, .09), rand(180, 520), .08, .08 * k * s.gain, { bend: rand(1.4, 2.2), pan: s.pan + rand(-.2, .2), lp: 1400 });
    burst(t, .6, .08 * k * s.gain, 2600, { q: 1.5, pan: s.pan });
  };
  const DEATH = { prisoner: 'prisonerDeath', guard: 'guardDeath', cultist: 'cultistDeath', stalker: 'stalkerDeath', carrier: 'carrierDeath' };
  // Existing voice recordings, shaped by anatomy and the material that lands.
  const DEATH_MATERIAL = {
    drowned:['carrierDeath',.78,'wetStep',.7], rootborn:['guardDeath',.72,'debris',.65],
    crawler:['stalkerDeath',1.12,'bone',1.1], urchin:['carrierDeath',.86,'bone',.85], lantern:['cultistDeath',.9,'chain',1.15],
    ashbound:['prisonerDeath',.84,'armorStep',.85], shardseer:['cultistDeath',.86,'bone',1.25],
    cavefang:['stalkerDeath',1.08,'bone',1.12], gravemason:['guardDeath',.72,'debris',.82], ruinwarden:['guardDeath',.8,'armor',.74],
    emberbound:['prisonerDeath',.8,'metal',.88], chainseer:['cultistDeath',.76,'chain',.82],
    slagcrawler:['carrierDeath',.67,'scuff',.72], forgesentinel:['guardDeath',.66,'metal',.62], ashwarden:['guardDeath',.76,'chain',.72]
  };
  H.kill = (o, k) => {
    const e = justKilled(), type = o.type || (e && e.type) || 'prisoner',
      at = Number.isFinite(o.x) && Number.isFinite(o.z) ? o : e || null,
      t = now(), s = at ? spatial(at.x, at.z) : { pan: 0, gain: 1 }, signature = DEATH_MATERIAL[type];
    sample(signature ? signature[0] : DEATH[type] || 'prisonerDeath', { vol: .85 * k, at, delay: .04, send: .2, prio: 1, rate: signature ? signature[1] : 1 });
    if (signature) sample(signature[2], {vol:.38*k,at,delay:.46,rate:signature[3],send:.12});
    sample('thump', { vol: .6 * k, at, delay: .42, rate: .7 }); thud(t + .44, { f0: 90, f1: 35, dur: .25, vol: .5 * k * s.gain, pan: s.pan });
    if (type === 'guard') { sample('armor', { vol: .55 * k, at, delay: .47, rate: .72 }); sample('armorStep', { vol: .4 * k, at, delay: .6, rate: .7 }); }
    if (type === 'prisoner') sample('chain', { vol: .35 * k, at, delay: .45, rate: .9 });
    if (type === 'carrier') sample('flesh', { vol: .5 * k, at, delay: .4, rate: .65 });
  };
  H.bossDeath = (o, k) => {
    const t = now();
    sample('bossDeath', { vol: 1 * k, send: .35, prio: 1 }); sample('bossRoar', { vol: .5 * k, rate: .7, delay: .5, send: .4 });
    for (let i = 0; i < 4; i++) sample('chain', { vol: (.7 - i * .12) * k, delay: .7 + i * .21, rate: .8 + i * .05 });
    sample('stomp', { vol: 1 * k, delay: 1.35, rate: .7 }); thud(t + 1.35, { f0: 60, f1: 22, dur: .9, vol: 1 * k, send: .4 });
    sample('debris', { vol: .8 * k, delay: 1.4 }); sample('armor', { vol: .6 * k, delay: 1.45, rate: .6 });
    stinger('victory', 1.6);
  };
  H.boss = (o, k) => {
    const t = now();
    sample('bossRoar', { vol: .9 * k, send: .4, prio: 1, rate: .92 }); sample('chain', { vol: .6 * k, delay: .3 }); sample('winch', { vol: .45 * k, delay: .4 });
    stinger('boss', 0);
  };
  H.bossPhase = (o, k) => {
    const t = now();
    sample('metal', { vol: .9 * k, rate: .55, send: .4, prio: 1 }); sample('chain', { vol: 1 * k, delay: .02 }); sample('chain', { vol: .7 * k, delay: .16, rate: .8 });
    sample('bossRoar', { vol: 1 * k, delay: .25, rate: .85, send: .4, prio: 1 }); thud(t, { f0: 60, f1: 22, dur: .9, vol: 1 * k, send: .35 });
    M.phase2 = true; stinger('phase', 0);
  };
  H.rage = (o, k) => {
    const t = now();
    if (o.enemy) {                // Kül Rahibi'nin kan ayini
      swell(t, .6, .15 * k, { f0: 200, f1: 1800, send: .4 }); tone(t + .55, 73.4, 1.6, .12 * k, { type: 'sawtooth', lp: 500, send: .4 });
      ring(t + .6, { f: 146.8, partials: [1, 2.02, 3.6], decay: 1.8, vol: .06 * k, send: .5 }); return;
    }
    if (o.tier > 1 && H['shoutT' + o.tier]) return H['shoutT' + o.tier](o, k);   // tiers II / III have their own layers (below)
    // The father's war cry: a breath drawn in, then the roar (CC0 roar clip pitched down and doubled, a synthesized
    // throat growl and a sub drop) lands with the shockwave at o.release (combat.js ROAR.release, .3 s by default);
    // the cleaver rings and the heart pounds after.
    const r = o.release > 0 ? o.release : .3;
    swell(t, r - .02, .1 * k, { f0: 160, f1: 900, send: .15 }); sample('strain', { vol: .35 * k, rate: .85, send: .1, detune: .01 });
    sample('roar', { vol: 1.1 * k, rate: .8, delay: r - .03, send: .35, prio: 1, detune: .01 }); sample('roar', { vol: .75 * k, rate: .62, delay: r + .01, send: .5, prio: 1, detune: .01 });
    growl(t + r - .03, 1.0, .16 * k, { f: 76, send: .35 });
    thud(t + r, { f0: 66, f1: 22, dur: 1.1, vol: 1 * k, send: .35 }); burst(t + r, .7, .22 * k, 260, { q: .5, f1: 80, send: .4 });
    ring(t + r + .01, { f: 196, partials: [1, 2.02, 2.97, 4.1], decay: 1.6, vol: .06 * k, send: .5 });
    for (let i = 0; i < 3; i++) thud(t + r + .65 + i * .42, { f0: 62, f1: 40, dur: .2, vol: .45 * k });
    duck(N.musicDuck, .45, .6, .4); duck(N.ambDuck, .5, .6, .4);
    stinger('rage', .25);
  };
  // Special ability "Zincir Girdabı": chain paying out during the wind-up (o.wind s), then a heavy iron crack and floor thud at contact.
  H.specialWind = (o, k) => {
    const t = now(), at = { x: o.x, z: o.z }, w = o.wind > 0 ? o.wind : .5;
    sample('chain', { vol: .9 * k, at, rate: .85, prio: 1 }); sample('chain', { vol: .6 * k, at, rate: 1.05, delay: w * .4 });
    swell(t, w - .03, .12 * k, { f0: 220, f1: 1400, send: .15 }); sample('effort', { vol: .3 * k, rate: .8, delay: .05, send: .1 });
  };
  H.specialHit = (o, k) => {
    const t = now(), at = { x: o.x, z: o.z };
    whoosh(t - .06, { dur: .22, peak: .6, f0: 400, f1: 2600, f2: 500, q: 1.4, vol: .6 * k, low: 200 });
    sample('metal', { vol: .9 * k, at, rate: .7, prio: 1 }); sample('chain', { vol: .8 * k, at, rate: .8, delay: .02 }); sample('stomp', { vol: .8 * k, at, rate: .8, delay: .03 });
    thud(t + .02, { f0: 72, f1: 26, dur: .6, vol: 1 * k, send: .3 }); burst(t + .02, .35, .22 * k, 420, { q: .5, f1: 120, send: .3 });
    if (o.hits) { sample('debris', { vol: .5 * k, at, delay: .08 }); sample('flesh', { vol: .6 * k, at, rate: .8, delay: .04 }); }
    ring(t + .03, { f: 174, partials: [1, 2.4, 3.9], decay: 1.0, vol: .04 * k, send: .5 });
  };
  // ---- Skill tiers (round 7): every tier of the heavy-strike and shout lines gets its own layers, so they can be told apart with the eyes shut.
  // Tier II strike: wind-up scrape of metal on bone and a rising wind, impact = deep thud + bright metal ring + bone crack.
  // Tier III strike: crouch grunt and a low rumble, a fast whoosh at take-off and a falling wind in the air, impact = sub-bass boom, stone crack, low choir-like open fifth.
  H.strikeWind2 = (o, k) => {
    const t = now(), w = o.strike > 0 ? o.strike : .72;
    sample('chain', { vol: .35 * k, rate: 1.3, send: .1, delay: .02 }); swell(t + .05, w - .1, .13 * k, { f0: 240, f1: 2200, send: .15 });
    ring(t + w * .45, { f: 880, partials: [1, 2.76], decay: .5, vol: .012 * k, send: .3 }); sample('effort', { vol: .35 * k, rate: .75, delay: w * .5, send: .1 });
  };
  H.strikeWind3 = (o, k) => {
    const t = now(), w = o.strike > 0 ? o.strike : .7, air = o.air > 0 ? o.air : .38, up = t + w - air;
    sample('strain', { vol: .5 * k, rate: .7, send: .12 }); swell(t, w - air, .11 * k, { f0: 50, f1: 520, send: .2 });
    thud(up, { f0: 120, f1: 40, dur: .22, vol: .55 * k, send: .15 }); burst(up, .12, .12 * k, 500, { q: .6, f1: 150 });
    whoosh(up + .02, { dur: air + .05, peak: .25, f0: 900, f1: 1600, f2: 260, q: .8, vol: .5 * k, low: 300, send: .12 });
  };
  H.strikeHit2 = (o, k) => {
    const t = now(), at = { x: o.x, z: o.z };
    thud(t, { f0: 92, f1: 28, dur: .75, vol: 1.05 * k, send: .3 }); thud(t + .01, { f0: 190, f1: 70, dur: .18, vol: .5 * k });
    ring(t + .004, { f: 330, partials: [1, 2.76, 5.4, 8.9], decay: 1.5, vol: .075 * k, send: .45 }); sample('hitClang', { vol: .6 * k, at, rate: .78, delay: .006, send: .3 });
    sample('bone', { vol: .7 * k, at, rate: .8, delay: .02 }); burst(t + .01, .35, .24 * k, 380, { q: .5, f1: 110, send: .3 }); sample('debris', { vol: .5 * k, at, delay: .06, rate: .9 });
    for (let i = 0; i < 2; i++) ring(t + .17 + i * .05, { f: 230, partials: [1, 2.4], decay: .5, vol: .02 * k, send: .4 });   // the aftershock ring
    // fx-impact.js layers: the falling blade of light (a dark steel shing pitched down) and the torn air of the shock wall rushing outward
    sample('shing', { vol: .32 * k, at, rate: .6, send: .35 }); whoosh(t + .01, { dur: .5, peak: .14, f0: 1100, f1: 320, f2: 120, q: .7, vol: .34 * k, low: 180, send: .25 });
  };
  H.strikeHit3 = (o, k) => {
    const t = now(), at = { x: o.x, z: o.z };
    thud(t, { f0: 56, f1: 18, dur: 1.5, vol: 1.5 * k, send: .35 }); thud(t + .02, { f0: 130, f1: 36, dur: .4, vol: .7 * k }); thud(t + .24, { f0: 64, f1: 24, dur: .8, vol: .6 * k, send: .35 });
    burst(t, .28, .45 * k, 1700, { q: .5, f1: 240, send: .3 }); sample('debris', { vol: .8 * k, at, rate: .7, delay: .01 }); sample('debris', { vol: .6 * k, at, rate: .55, delay: .09 });
    sample('stomp', { vol: .8 * k, at, rate: .6, delay: .005 }); sample('bone', { vol: .5 * k, at, rate: .6, delay: .03 });
    growl(t + .02, 1.4, .13 * k, { f: 52, send: .45 });
    for (const [f, d] of [[65.4, 0], [98, .05], [130.8, .1]]) tone(t + .08 + d, f, 2.2, .05 * k, { type: 'sawtooth', lp: 520, attack: .35, send: .5 });   // low open-fifth choir
    ring(t + .03, { f: 110, partials: [1, 2.4, 3.9], decay: 2.2, vol: .05 * k, send: .55 });
    burst(t + .35, 1.1, .1 * k, 160, { q: .6, attack: .2, bus: 'amb', send: .3, buf: N.brown });
    whoosh(t + .02, { dur: .75, peak: .12, f0: 760, f1: 220, f2: 90, q: .6, vol: .42 * k, low: 150, send: .3 });   // the grave wall rushing outward
    sample('chain', { vol: .28 * k, at, rate: .5, delay: .14 });
    duck(N.musicDuck, .5, .5, .5);
  };
  // Tier II shout "Ölüm Çığlığı": a high wail rises over the roar (sawtooth bending upward through a formant), bright bone-like ring, hiss of air.
  H.shoutT2 = (o, k) => {
    k *= 1.15; const t = now(), r = o.release > 0 ? o.release : .44;
    swell(t, r - .02, .12 * k, { f0: 220, f1: 1500, send: .15 }); sample('strain', { vol: .4 * k, rate: 1.0, send: .1 });
    sample('roar', { vol: 1 * k, rate: .98, delay: r - .03, send: .4, prio: 1, detune: .01 }); sample('roar', { vol: .6 * k, rate: .76, delay: r, send: .5, prio: 1, detune: .01 });
    growl(t + r - .02, 1.1, .16 * k, { f: 118, send: .4 });
    tone(t + r, 360, .95, .05 * k, { type: 'sawtooth', bend: 1.9, lp: 2600, q: 2, attack: .05, send: .4 }); tone(t + r + .02, 540, .8, .03 * k, { type: 'sawtooth', bend: 1.6, lp: 3200, q: 2, attack: .06, send: .4 });
    thud(t + r, { f0: 84, f1: 26, dur: .9, vol: 1 * k, send: .35 }); burst(t + r, .8, .2 * k, 2400, { q: .5, f1: 500, send: .4 });
    ring(t + r + .01, { f: 587, partials: [1, 2.4, 3.9, 5.4], decay: 1.7, vol: .06 * k, send: .55 });
    for (let i = 0; i < 3; i++) ring(t + r + .12 + i * .14, { f: 440 - i * 40, partials: [1, 2.76], decay: .7, vol: .025 * k, send: .5 });   // the spreading rings
    whoosh(t + r + .01, { dur: .7, peak: .1, f0: 1500, f1: 480, f2: 180, q: .6, vol: .3 * k, low: 200, send: .3 });   // the pressure wall (fx-impact.js)
    // the death cry must outlast the first cry (render: its tail was 1.25 s against 1.75 s): a low rolling echo of bone and stone
    thud(t + r + .02, { f0: 58, f1: 19, dur: 1.5, vol: .7 * k, send: .35 });   // a deeper floor than Kan Nidası
    burst(t + r + .25, 1.5, .1 * k, 200, { q: .6, attack: .25, bus: 'amb', send: .35, buf: N.brown }); thud(t + r + .5, { f0: 70, f1: 30, dur: .7, vol: .45 * k, send: .4 });
    sample('bone', { vol: .3 * k, rate: .55, delay: r + .45, send: .4 });
    duck(N.musicDuck, .45, .7, .4); duck(N.ambDuck, .5, .7, .4); stinger('rage', .25);
  };
  // Tier III shout "Kıyamet Narası": stage 1 = very low roar + sub-boom + choir fifth + rumble; stage 2 (+.34 s) a second blast; the third ring (+.68 s) closes with a stone crack.
  H.shoutT3 = (o, k) => {
    const t = now(), r = o.release > 0 ? o.release : .62;
    swell(t, r - .02, .15 * k, { f0: 70, f1: 900, send: .2 }); sample('strain', { vol: .5 * k, rate: .72, send: .1 });
    sample('roar', { vol: 1.15 * k, rate: .66, delay: r - .03, send: .45, prio: 1, detune: .01 }); sample('roar', { vol: .9 * k, rate: .52, delay: r + .01, send: .55, prio: 1, detune: .01 });
    sample('bossRoar', { vol: .45 * k, rate: .78, delay: r + .03, send: .5, prio: 1 });
    growl(t + r - .03, 1.5, .2 * k, { f: 56, send: .45 });
    thud(t + r, { f0: 54, f1: 17, dur: 1.9, vol: 1.5 * k, send: .35 }); burst(t + r, .9, .3 * k, 300, { q: .5, f1: 70, send: .4 });
    for (const [f, d] of [[65.4, 0], [98, .05], [196, .1]]) tone(t + r + d, f, 2.6, .05 * k, { type: 'sawtooth', lp: 560, attack: .4, send: .55 });
    ring(t + r, { f: 98, partials: [1, 2.02, 2.97, 4.1], decay: 2.4, vol: .06 * k, send: .55 });
    thud(t + r + .34, { f0: 70, f1: 24, dur: .9, vol: 1.1 * k, send: .3 }); sample('roar', { vol: .7 * k, rate: .58, delay: r + .34, send: .5, prio: 1 }); burst(t + r + .34, .3, .2 * k, 1400, { q: .5, f1: 300, send: .3 });
    thud(t + r + .68, { f0: 76, f1: 28, dur: .8, vol: 1 * k, send: .3 }); sample('debris', { vol: .7 * k, rate: .6, delay: r + .68 }); sample('stomp', { vol: .6 * k, rate: .55, delay: r + .68 });
    burst(t + r + .1, 1.6, .12 * k, 150, { q: .6, attack: .25, bus: 'amb', send: .3, buf: N.brown });
    whoosh(t + r + .01, { dur: .85, peak: .1, f0: 1100, f1: 300, f2: 110, q: .55, vol: .38 * k, low: 160, send: .35 });   // the bone-white wall (fx-impact.js)
    for (let i = 0; i < 4; i++) thud(t + r + 1.1 + i * .42, { f0: 60, f1: 38, dur: .2, vol: .4 * k });   // the heart
    duck(N.musicDuck, .4, .9, .5); duck(N.ambDuck, .45, .9, .5); stinger('rage', .25);
  };
  // Rage ends: the fire gutters out with an exhale and a falling ember hiss, so the hero knows the bonus is gone.
  H.rageEnd = (o, k) => {
    const t = now();
    sample('effort', { vol: .3 * k, rate: .78, send: .12, detune: .01 }); burst(t, .8, .07 * k, 1700, { q: .6, f1: 420, attack: .05, send: .2 });
    tone(t, 110, 1.0, .05 * k, { type: 'sawtooth', bend: .5, lp: 520, attack: .02, send: .3 }); ring(t + .05, { f: 293.7, partials: [1, 2.4], decay: .9, vol: .025 * k, send: .5 });
  };
  // Commit cue, .18 s before an enemy blow lands (the tell flares at the same moment).
  H.tellCommit = (o, k) => {
    if (!throttle('commit', .05)) return;
    const t = now(), at = { x: o.x, z: o.z }, s = spatial(o.x, o.z), v = k * .8;
    switch (o.style) {
      case 'blade': case 'grab': case 'thrust': sample('shing', { vol: .22 * v, at, rate: rand(1.05, 1.2), send: .15 }); whoosh(t, { dur: .18, peak: .9, f0: 900, f1: 3200, f2: 3200, q: 2.2, vol: .05 * v * s.gain, pan0: s.pan }); break;
      case 'chain': case 'fall': sample('chain', { vol: .35 * v, at, rate: rand(1.15, 1.3) }); break;
      case 'rune': case 'ember': burst(t, .18, .05 * v * s.gain, 5200, { q: 1.2, pan: s.pan, attack: .12 }); break;
      case 'bile': sample('flesh', { vol: .3 * v, at, rate: .55 }); break;
      case 'quake': swell(t, .18, .09 * v * s.gain, { f0: 60, f1: 380, pan: s.pan, send: .3 }); break;
      default: thud(t + .02, { f0: 150, f1: 70, dur: .12, vol: .22 * v * s.gain, pan: s.pan }); burst(t, .12, .04 * v * s.gain, 900, { q: .7, pan: s.pan });
    }
    if (o.unblockable) ring(t, { f: 740, partials: [1, 2.76, 5.4], decay: .5, vol: .045 * v * s.gain, pan: s.pan, send: .45 });
  };
  // A tell broken before contact (parry, stagger, war cry, a broken rite): ash crumbling.
  H.tellCancel = (o, k) => {
    if (!throttle('cancel', .08)) return;
    const t = now(), s = spatial(o.x, o.z);
    burst(t, .28, .06 * k * s.gain, 900, { q: .5, f1: 280, pan: s.pan }); sample('debris', { vol: .16 * k, at: { x: o.x, z: o.z }, rate: 1.4 });
  };
  H.healStart = (o, k) => { sample('cork', { vol: .6 * k }); sample('cloth', { vol: .2 * k, rate: 1.2 }); };
  H.heal = (o, k) => {
    const t = now();
    sample('drink', { vol: .7 * k }); sample('drink', { vol: .45 * k, delay: .3, rate: .9 });
    for (const [f, d] of [[146.8, 0], [220, .06], [293.7, .12]]) tone(t + .2 + d, f, 1.4, .035 * k, { attack: .35, send: .4 });
  };
  // Health globes: a soft wet plop when one drops, a warm liquid chime when it is drunk. Both stay quiet (no masking of enemy warnings).
  H.globeDrop = (o, k) => {
    if (!throttle('globeDrop', .12)) return;
    const t = now(), s = spatial(o.x, o.z);
    tone(t, 330, .16, .022 * k * s.gain, { bend: 1.9, attack: .012, pan: s.pan, send: .2 }); burst(t, .07, .012 * k * s.gain, 1800, { q: 1.2, pan: s.pan });
  };
  H.globe = (o, k) => {
    if (!throttle('globe', .1)) return;
    const t = now();
    tone(t, 520, .34, .03 * k, { bend: 1.5, attack: .02, send: .35 });
    for (const [f, d] of [[784, .05], [1174.7, .12]]) tone(t + d, f, .7, .022 * k, { attack: .015, send: .5 });
    burst(t, .09, .012 * k, 900, { q: 1.4, f1: 2400 });
  };
  H.death = (o, k) => {
    const t = now();
    sample('herodeath', { vol: 1 * k, send: .3, prio: 1, detune: .01 }); sample('thump', { vol: .8 * k, delay: .55, rate: .6 });
    thud(t + .55, { f0: 80, f1: 25, dur: .6, vol: .9 * k }); sample('armor', { vol: .4 * k, delay: .6, rate: .6 });
    stinger('death', .3);
  };
  H.win = () => stinger('win', 2.4);
  H.sealOpen = (o, k) => {
    const t = now();
    sample('bell', { vol: .55 * k, rate: .82, send: .5, prio: 1 });
    burst(t + .1, 1.6, .16 * k, 180, { q: .7, attack: .3, bus: 'amb', send: .3, buf: N.brown });
    thud(t + .05, { f0: 55, f1: 30, dur: 1, vol: .4 * k, send: .3 });
  };
  // Boss gate opening (src/gate.js): winch and chains grinding, falling rubble, one deep stone thud. Existing samples only.
  H.gateOpen = (o, k) => {
    const t = now();
    sample('winch', { vol: .6 * k, rate: .72, send: .4, prio: 1 }); sample('chain', { vol: .5 * k, delay: .12, rate: .78 }); sample('chain', { vol: .4 * k, delay: .7, rate: .7 });
    sample('debris', { vol: .5 * k, delay: 1.5, rate: .8 });
    thud(t + 2.1, { f0: 62, f1: 26, dur: .8, vol: .7 * k, send: .3 });
  };
  // Level-up: ONE dramatic event on the effects channel (no bells, no melody): sub-bass impact, stone crack, rough metallic shimmer, rising air,
  // low choir-like open fifth, short low-passed gust and spark crackle. Synthesised in src/levelup.js (B.LevelUp.sound); the music dips a little.
  H.levelUp = (o, k) => {
    const t = now(), LU = B.LevelUp;
    if (LU && LU.sound) {
      const [bus, wet] = busOf();
      LU.sound(ctx, bus, wet, t, .5 * k, { white: N.noise, pink: N.pink });
      if (!current) { duck(N.musicDuck, .62, .6, .55); duck(N.ambDuck, .75, .6, .55); }
      return;
    }
    whoosh(t, { dur: 1.05, peak: .30, f0: 320, f1: 1450, f2: 240, q: .85, low: 240, vol: 1.05 * k, send: .15 });
    tone(t, 140, .43, .20 * k, { type: 'sine', attack: .20, bend: 2, send: .12, lp: 700 });
    tone(t + .28, 280, .64, .19 * k, { type: 'sine', attack: .04, bend: .45, send: .14, lp: 700 });
  };
  // Physical handling of the collected piece, kept quieter than combat information.
  H.lootPickup = (o, k) => {
    if(!throttle('lootPickup',.10))return;
    const cloth=o.slot==='chest'||o.slot==='head'||o.slot==='boots';
    sample(cloth?'cloth':'gear',{vol:(cloth?.19:.22)*k,rate:cloth?.88:1.03,send:.04});
    if(o.weaponType)sample('metal',{vol:.12*k,rate:o.weaponType==='axe'?.82:1.13,lp:4200,delay:.025,send:.06});
    if(o.rarity==='epic'||o.rarity==='boss'||o.signature)sample('hitRingA',{vol:.085*k,rate:.70,lp:2500,delay:.035,send:.18});
  };
  H.checkpoint = (o, k) => {
    if (extMusic) B.Music.sting('checkpoint');
    const t = now();
    sample('bell', { vol: .45 * k, rate: 1.05, send: .6 });
    for (const [f, d] of [[73.4, 0], [110, .15], [146.8, .3], [220, .45]]) tone(t + d, f, 2.8, .045 * k, { type: 'triangle', attack: .8, send: .5, bus: 'music' });
  };
  // Ekran dışı ağır saldırı: kısa, keskin iki metal vuruşu; başka hiçbir sese benzemez.
  H.warning = (o, k) => {
    const t = now();
    const at = Number.isFinite(o.x) ? spatial(o.x, o.z) : { pan: 0 };
    for (const [d, v] of [[0, .36], [.11, .3]]) ring(t + d, { f: 1180, partials: [1, 2.32, 3.9], decay: .4, vol: v * k, send: .3, pan: at.pan });
    thud(t, { f0: 170, f1: 70, dur: .18, vol: 1 * k, pan: at.pan }); burst(t, .05, .2 * k, 3200, { q: 1.4, pan: at.pan });
  };
  // Round 7 boss mechanics (boss-mech.js, coast-combat.js): synthesized only. Orbs hum (ember = low and dry, brine = higher and wet), the fuse is four rising blips, anchors clang and snap.
  H.boss1Orb = (o, k) => {
    if (!throttle('b1orb', .25)) return;
    const t = now(), s = spatial(o.x, o.z), brine = o.kind === 'brine';
    swell(t, .7, .1 * k * s.gain, { f0: brine ? 220 : 130, f1: brine ? 1100 : 640, pan: s.pan, send: .3 });
    tone(t + .6, brine ? 247 : 98, 1.0, .08 * k * s.gain, { type: 'triangle', lp: 900, pan: s.pan, send: .4 }); thud(t + .6, { f0: 110, f1: 48, dur: .3, vol: .35 * k * s.gain, pan: s.pan });
  };
  H.boss1OrbFuse = (o, k) => {
    const t = now(), s = spatial(o.x, o.z), brine = o.kind === 'brine';
    for (let i = 0; i < 4; i++) tone(t + i * .2, (brine ? 392 : 220) * (1 + i * .12), .16, .1 * k * s.gain, { type: 'triangle', lp: 2400, pan: s.pan, send: .3 });
  };
  H.boss1Pop = (o, k) => { const t = now(), s = spatial(o.x, o.z); burst(t, .18, .22 * k * s.gain, 1800, { q: 1, f1: 500, pan: s.pan }); tone(t, 340, .2, .06 * k * s.gain, { bend: .4, pan: s.pan }); };
  H.boss1Rite = (o, k) => {
    const t = now(), at = { x: o.x, z: o.z }, s = spatial(o.x, o.z);
    sample('chain', { vol: .9 * k, at, rate: .7, prio: 1 }); sample('chain', { vol: .6 * k, at, rate: .85, delay: .2 }); sample('winch', { vol: .5 * k, at, delay: .1 });
    thud(t + .3, { f0: 70, f1: 26, dur: .9, vol: 1 * k * s.gain, pan: s.pan, send: .35 }); ring(t + .32, { f: 98, partials: [1, 2.4, 3.9, 5.3], decay: 2.6, vol: .06 * k, pan: s.pan, send: .6 });
  };
  H.boss1Anchor = (o, k) => { const at = { x: o.x, z: o.z }; sample('metal', { vol: .55 * k, at, rate: 1.05 }); sample('chain', { vol: .4 * k, at, rate: 1.1, delay: .03 }); };
  H.boss1Snap = (o, k) => {
    const t = now(), at = { x: o.x, z: o.z }, s = spatial(o.x, o.z);
    sample('metal', { vol: .8 * k, at, rate: .7, prio: 1 }); sample('chain', { vol: .9 * k, at, rate: .8, delay: .02 }); sample('debris', { vol: .5 * k, at, delay: .05 });
    thud(t, { f0: 90, f1: 34, dur: .5, vol: .7 * k * s.gain, pan: s.pan }); burst(t, .3, .2 * k * s.gain, 1400, { q: .6, f1: 300, pan: s.pan });
  };
  H.boss1Toll = (o, k) => {   // the drowned bell: one deep, wet toll (a long inharmonic ring with a thud and a gurgle under it)
    const t = now(), at = { x: o.x, z: o.z }, s = spatial(o.x, o.z);
    ring(t, { f: 82.4, partials: [1, 2.4, 3.9, 5.3, 6.9], decay: 3.2, vol: .1 * k * s.gain, pan: s.pan, send: .65 }); sample('bell', { vol: .5 * k, at, rate: .5, send: .5 });
    thud(t, { f0: 70, f1: 30, dur: .55, vol: .7 * k * s.gain, pan: s.pan, send: .3 }); sample('carrierGurgle', { vol: .25 * k, at, rate: .55, delay: .05 });
  };
  // ajan:bosses — heavy boss layers (intro / phase / signature / fall), synthesised in src/boss-sound.js.
  H.bossLayer = (o, k) => { const BS = B.BossSound; if (!BS) return; const [bus, wet] = busOf(); BS.play(ctx, bus, wet, now(), k, o, { white: N.noise, pink: N.pink }); };
  // Menü: taş üstünde kısa, kuru bir tık.
  H.ui = (o, k) => { const t = now(); burst(t, .02, .4 * k, 2300, { q: 1.1 }); thud(t, { f0: 190, f1: 90, dur: .07, vol: .4 * k }); };

  function play(name, opts = {}) {
    if (TELLS.has(name)) lastTellN = nclock;
    if (name === 'sealOpen' && B.Narration && B.Narration.seal) say(B.app && B.app.world.chapter === 2 ? 'coastSeal' : 'seal');   // anlatıcı/altyazı sessiz modda da çalışır
    if (!ctx || !unlocked || suspended || (silent && !offline) || volume.master <= 0) return;
    if ((name === 'enemyWindup' && opts.unblockable) || name === 'warning' || name === 'tellCommit') {
      warningUntil = Math.max(warningUntil, ctx.currentTime + .8);
      if (N.warningDuck) targetParam(N.warningDuck.gain, .48, ctx.currentTime, .035);
      updateVoiceWarning();
    }
    const k = opts.volume == null ? 1 : opts.volume;
    try {
      const h = H[name] || (B.TalentAudio && B.TalentAudio.has(name) ? (o, k2) => { const [bus, wet] = busOf(); B.TalentAudio.play(name, ctx, bus, wet, now(), k2, o, N); } : null) || (/slam|explosion/.test(name) ? H.slam : null);   // talent tree 3 sounds: src/talent-audio.js
      if (h) h(opts, k, name);
      /* ajan:audio */ if (B.AudioPlus) B.AudioPlus.after(name, opts, k); /* /ajan:audio */
    } catch (e) { console.warn('Audio', name, e); }
  }

  // ------------------------------------------------------------------ müzik
  // Re minör (frigyen renkli). Katmanlar: dip uğultu, karanlık koro, kalp atışı, çatışma ostinatosu, cellat katmanı.
  const M = { beat: 0, next: 0, bpm: 64, chord: -1, phase2: false, level: { drone: 0, pad: 0, pulse: 0, combat: 0, boss: 0 } };
  const CHORDS = [[0, 3, 7], [-4, 0, 3], [1, 5, 8], [-5, -1, 2]];   // i · VI · ♭II · V (armonik minör gerilimi)
  const midiHz = st => 73.42 * Math.pow(2, st / 12);                  // st=0 -> D2
  function buildMusic() {
    const L = M.layers = {};
    for (const k of ['drone', 'pad', 'combat', 'boss']) L[k] = gainNode(0, N.music);
    L.pad.connect(gainNode(.5, N.wetMusic));
    M.oscs = [];
    const osc = (type, f, det, to, v) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det || 0; o.__base = det || 0; o.connect(gainNode(v == null ? 1 : v, to)); o.start(); M.oscs.push(o); return o; };
    // dip uğultu: D1 ve A1, yavaşça nefes alan bir alçak geçirgen, altında taş gürlemesi
    M.droneFilter = filter('lowpass', 190, 2.2, filter('highpass', 30, .7, L.drone));
    M.droneOscs = [[36.71, .5, -7], [36.71, .5, 6], [55, .22, 3], [73.42, .08, -4]].map(([f, v, det]) => osc('sawtooth', f, det, M.droneFilter, v));
    const lfo = ctx.createOscillator(), lg = gainNode(55); lfo.frequency.value = .045; lfo.connect(lg); lg.connect(M.droneFilter.frequency); lfo.start(); M.oscs.push(lfo);
    const rumble = noiseSrc(N.brown), rf = filter('lowpass', 90, 1, gainNode(.45, L.drone)); rumble.connect(rf); rumble.start(); M.oscs.push(rumble);
    // karanlık koro: üç ses; her biri iki testere dişi ve iki formant süzgeci ("o" ünlüsü)
    M.voices = [];
    for (let i = 0; i < 3; i++) {
      const out = gainNode(.33, L.pad), pre = gainNode(.5);
      pre.connect(filter('bandpass', 420, 4, out)); pre.connect(filter('bandpass', 880, 6, gainNode(.5, out)));
      const f = midiHz([0, 3, 7][i] + (i ? 12 : 0)), oscs = [-9, 8].map(det => osc('sawtooth', f, det, pre));
      const vib = ctx.createOscillator(), vg = gainNode(3 + i); vib.frequency.value = 4.3 + i * .37; vib.connect(vg); oscs.forEach(o => vg.connect(o.detune)); vib.start(); M.oscs.push(vib);
      M.voices.push({ oscs });
    }
    // çatışma: tremololu yay kümesi (A2, D3, E♭3) — küçük ikilinin gerilimi
    M.trem = gainNode(.5, filter('lowpass', 1500, .7, L.combat));
    const tl = ctx.createOscillator(), tg = gainNode(.5); tl.frequency.value = 7.2; tl.connect(tg); tg.connect(M.trem.gain); tl.start(); M.oscs.push(tl);
    M.tremOscs = [146.8, 155.6, 110].map(f => osc('sawtooth', f, 0, M.trem, .12));
    // cellat katmanı: bakır benzeri pes nefes (D1+D2+A2); zarfı her ölçüde açılır
    M.brassFilter = filter('lowpass', 200, 3, L.boss);
    M.brass = [36.71, 73.42, 110].map((f, i) => osc('sawtooth', f, i * 4 - 4, M.brassFilter, [.5, .35, .2][i]));
    M.next = ctx.currentTime + .1; M.beat = 0; M.chord = -1; M.phase2 = false;
  }
  function setChord(i, t) {
    const c = CHORDS[i % CHORDS.length];
    M.voices.forEach((v, n) => { const f = midiHz(c[n] + (n ? 12 : 0)); v.oscs.forEach(o => o.frequency.setTargetAtTime(f, t, .35)); });
    M.brass.forEach((o, n) => o.frequency.setTargetAtTime(n === 2 ? midiHz(c[0] + 7) : midiHz(c[0] - 12 * (1 - n)) , t, .08));
  }
  function drum(t, vol, f0 = 72, dur = .35, bus = 'music') {
    thud(t, { f0, f1: f0 * .45, dur, vol, bus, send: .25 });
    thud(t, { f0: f0 * 2.1, f1: f0 * 1.3, dur: dur * .4, vol: vol * .3, bus });      // gövde tınısı: küçük hoparlörde de duyulur
    burst(t, .07, vol * .2, 240, { q: .9, f1: 130, bus });                              // deri
    burst(t, .04, vol * .12, 1800, { q: .8, bus });
  }
  // Çatışma ostinatosu: kısa, sert yay vuruşları (iki hafif akort dışı testere dişi, alçak geçiren).
  function bow(t, f, dur, vol, pan) {
    const [bus, wet] = busOf('music'), g = gainNode(0), lp = filter('lowpass', 1500, 1.3), p = panner(pan || 0, bus), s = gainNode(.2, wet);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.setTargetAtTime(vol * .4, t + .012, .07); g.gain.setTargetAtTime(0, t + dur * .75, dur * .12);
    lp.frequency.setValueAtTime(1500, t); lp.frequency.setTargetAtTime(560, t + .01, .09);   // yay sürtünmesi: parlak başlar, koyulaşır
    const extra = [lp, g, p, s];
    const oscs = [[-7, .5], [6, .5], [1200, .22]].map(([det, v]) => {
      const o = ctx.createOscillator(), og = gainNode(v, lp); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(og);
      o.start(t); o.stop(t + dur + .25); extra.push(og); return o;
    });
    lp.connect(g); g.connect(p); g.connect(s); extra.push(oscs[1], oscs[2]);
    track(oscs[0], extra);
  }
  const OSTINATO = [0, 0, 7, 0, 1, 0, 7, -2], ACCENT = [1, .55, .7, .5, .9, .55, .7, .6];
  function anvil(t, vol) { ring(t, { f: 392, partials: [1, 2.63, 4.1, 6.9], decay: .9, vol, bus: 'music', send: .45, pan: rand(-.4, .4) }); }
  function scheduleBeat(b, t) {   // 8'lik vuruşlar: ölçü = 8 adım
    const step = b % 8, bar = Math.floor(b / 8), L = M.level;
    if (step === 0 && bar % 2 === 0) { const ci = (bar / 2) % CHORDS.length; if (ci !== M.chord) { M.chord = ci; setChord(ci, t); } }
    // kalp atışı: keşifte seyrek, çatışmada her vuruşta
    if (L.pulse > .05) {
      const combat = L.combat > .35;
      if (!combat && step === 0 && bar % 2 === 0) { drum(t, .5 * L.pulse, 60, .4); drum(t + .24, .32 * L.pulse, 55, .35); }
      if (combat && (step === 0 || step === 4 || (step === 7 && bar % 2))) drum(t, (step === 0 ? .9 : .6) * L.pulse, step === 0 ? 64 : 80, .3);
    }
    const drive = Math.max(L.combat, L.boss * .8);
    if (drive > .05) {
      const root = CHORDS[Math.max(0, M.chord) % CHORDS.length][0], eighth = 60 / M.bpm / 2;
      bow(t, midiHz(root + OSTINATO[step]), .3, .62 * ACCENT[step] * drive, step % 2 ? -.25 : .25);
      if (ACCENT[step] > .8) bow(t, midiHz(root + OSTINATO[step] + 12), .22, .22 * drive, step ? .4 : -.4);   // vurgu: bir oktav üstte
      if (step % 4 === 3) bow(t + eighth / 2, midiHz(root + OSTINATO[step]), .16, .25 * drive, 0);   // on altılık süs
      if ([2, 3, 6].includes(step)) drum(t, .4 * L.combat, 120, .16);
      if (step === 6 && bar % 2 === 1) anvil(t, .05 * L.combat);
    }
    if (L.boss > .05) {
      const pat = M.phase2 ? [1, 0, 1, 1, 1, 0, 1, 1] : [1, 0, 0, 1, 1, 0, 1, 0];
      if (pat[step]) drum(t, (step === 0 ? .95 : .55) * L.boss, step === 0 ? 50 : 66, step === 0 ? .6 : .3);
      if (step === 0 || (step === 3 && bar % 2 === 1)) {
        const f = M.brassFilter.frequency; f.setValueAtTime(220, t); f.exponentialRampToValueAtTime(M.phase2 ? 1500 : 1100, t + .12); f.exponentialRampToValueAtTime(220, t + (step ? .5 : 1.1));
      }
      if (step === 6 && bank.chain) sample('chain', { vol: .22 * L.boss, delay: Math.max(0, t - now()), bus: 'music', rate: rand(.7, .85), send: .4 });
      if (M.phase2 && step % 2 === 1) burst(t, .03, .06 * L.boss, 6500, { q: 2, bus: 'music', pan: rand(-.5, .5) });
    }
  }
  const smooth = (cur, target, dt, up, down) => cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? up : down)));
  function musicStep(dt, st) {
    const t = ctx.currentTime, L = M.level, g = game(), dead = st.dead, won = st.won;
    const target = {
      drone: st.title ? .55 : dead ? .8 : st.boss ? .85 : st.combat ? .8 : 1,
      pad: st.title ? .5 : dead ? .9 : st.boss ? 1 : st.combat ? .75 : .6,
      pulse: st.playing ? (st.combat || st.boss ? 1 : .55) : 0,
      combat: st.playing && st.combat && !st.boss ? 1 : 0,
      boss: st.playing && st.boss ? 1 : 0
    };
    if (won) { target.combat = target.boss = target.pulse = 0; target.pad = .7; }
    for (const k of Object.keys(target)) L[k] = smooth(L[k], target[k], dt, k === 'combat' || k === 'boss' ? .9 : 2.5, k === 'combat' ? 5 : 3.5);
    const lay = M.layers;
    targetParam(lay.drone.gain, .22 * L.drone, t, .2);
    targetParam(lay.pad.gain, .12 * L.pad, t, .2);
    targetParam(lay.combat.gain, .75 * L.combat + .3 * L.boss, t, .2);
    targetParam(lay.boss.gain, .24 * L.boss, t, .2);
    targetParam(M.tremOscs[1].frequency, M.phase2 ? 164.8 : 155.6, t, .5);
    // ölüm: uğultu aşağı süzülür
    const bend = dead ? -120 : 0; for (const o of M.droneOscs) targetParam(o.detune, bend + o.__base, t, 1.2);
    targetParam(M.droneFilter.Q, st.boss ? 4 : 2.2, t, .5);
    if (M.next < t - .2) M.next = t + .05;                // askıdan dönüş: yeniden hizala
    const eighth = 60 / (M.bpm * (M.phase2 && st.boss ? 1.12 : 1)) / 2;
    while (M.next < t + .3) { scheduleBeat(M.beat, M.next); M.next += eighth; M.beat++; }
  }
  function stinger(kind, delay) {
    if (extMusic) { const m = { death: 'death', victory: 'victory', win: 'victory', boss: 'bossStart' }[kind]; if (m) B.Music.sting(m); return; }
    const t = now() + (delay || 0); if (!M.layers) return;
    const opts = { bus: 'music', send: .5 };
    if (kind === 'encounter') { swell(t, .8, .09, Object.assign({ f0: 120, f1: 1400 }, opts)); drum(t + .8, .9, 48, .8); }
    else if (kind === 'boss') { swell(t, 1.2, .12, Object.assign({ f0: 90, f1: 1600 }, opts)); drum(t + 1.2, 1, 42, 1.1); anvil(t + 1.2, .08); }
    else if (kind === 'phase') { drum(t, 1, 40, 1.2); anvil(t, .1); anvil(t + .4, .06); }
    else if (kind === 'rage') { drum(t, .8, 55, .5); drum(t + .25, .6, 55, .4); }
    else if (kind === 'death') { for (const [f, d] of [[73.4, 0], [69.3, .2], [55, .5]]) tone(t + d, f, 4, .08, { type: 'sawtooth', lp: 400, attack: .6, bend: .7, bus: 'music', send: .5 }); }
    else if (kind === 'victory' || kind === 'win') {
      for (const [f, d] of [[36.71, 0], [73.42, .05], [110, .1], [146.8, .6], [174.6, 1.2], [220, 1.8]]) tone(t + d, f, 6 - d, .05, { type: 'triangle', attack: 1.2, lp: 1800, bus: 'music', send: .6 });
      ring(t + .2, { f: 146.8, partials: [1, 2.01, 3.02, 4.2], decay: 5, vol: .05, bus: 'music', send: .6 });
    }
  }

  // ------------------------------------------------------------------ ortam
  const A = { next: 3, dripNext: 1.5, crackleNext: 0, room: -1, calm: 0, heart: 0 };
  function buildAmbience() {
    A.bus = gainNode(1, N.amb);
    const air = noiseSrc(N.brown), lp = filter('lowpass', 150, .7, filter('highpass', 40, .7, gainNode(.26, A.bus))); air.connect(lp); air.start();   // ajan:audio: was .4 / 32 Hz — the constant sub rumble was as loud as the combat score (-27 LUFS)
    const wind = noiseSrc(N.pink), bp = filter('bandpass', 430, 1.4), wg = gainNode(.0, A.bus); wind.connect(bp); bp.connect(wg); wind.start();
    const wl = ctx.createOscillator(), wlg = gainNode(.028); wl.frequency.value = .061; wl.connect(wlg); wlg.connect(wg.gain); wl.start();
    const wf = ctx.createOscillator(), wfg = gainNode(160); wf.frequency.value = .037; wf.connect(wfg); wfg.connect(bp.frequency); wf.start();
    wg.gain.value = .05; A.nodes = [air, wind, wl, wf]; A.wind = wg; A.next = now() + 4; A.dripNext = now() + 1.5; A.crackleNext = now();
  }
  function room() {
    const g = game(), p = g && g.player, w = B.app && B.app.world;
    if (testGame && testGame.room != null) return testGame.room;
    if (!p || !w || !w.roomAt) return -1;
    const r = w.roomAt(p.x, p.z); if(!r)return -1; if(Number.isInteger(r.parent))return r.parent; const id=typeof r.id==='number'?r.id:w.rooms.indexOf(r);return w.chapter>=3?Math.min(6,Math.floor(id/2)):Math.min(6,id);
  }
  function drip(t, pan, vol) {
    const f = rand(900, 1900), osc = ctx.createOscillator(), g = gainNode(0), p = panner(pan, N.amb), s = gainNode(.55, N.wetAmb);
    osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f * rand(1.6, 2.4), t + .035);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .07);
    osc.connect(g); g.connect(p); g.connect(s); osc.start(t); osc.stop(t + .1); track(osc, [g, p, s]);
  }
  function coastAmbience(t, r, st) {
    targetParam(A.wind.gain, .055 + Math.sin(t * .16) * .008, t, 2);
    if (!st.playing && !st.title) return;
    // Slow surf is scheduled sparingly; no audio nodes are created on every frame.
    if (t > A.coastWaveNext || A.coastWaveNext == null) {
      A.coastWaveNext = t + rand(5, 8);
      burst(t, rand(4, 6), .09, 420, { attack: 1.7, f1: 110, q: .45, buf: N.brown, bus: 'amb', pan: .45, send: .18 });
      burst(t + .8, 3.1, .021, 2300, { attack: .9, f1: 700, q: .6, bus: 'amb', pan: .7 });
    }
    if (t > A.next) {
      A.next = t + (st.combat ? rand(24, 38) : rand(12, 24));
      const n = r === 1 || r === 4 ? 'winch' : chance(.5) ? 'carrierGurgle' : 'moan';
      sample(n, { bus: 'amb', vol: .13, rate: rand(.55, .72), lp: 950, send: .8, pan: rand(-.85, .85) });
      if (r === 3 && !st.combat) sample('chain', { bus: 'amb', vol: .11, rate: .6, lp: 1200, delay: .6, send: .65, pan: -.5 });
    }
  }
  // Critical-health feedback belongs to the hero, before any biome can return.
  function heartbeatStep(dt, st, t) {
    const p = player();
    if (!st.playing || st.dead || st.won || !p || !p.maxHp || p.hp <= 0 || p.hp / p.maxHp >= .3) { A.heart = 0; return; }
    A.heart -= dt;
    if (A.heart <= 0) { const bpm = 70 + (1 - p.hp / p.maxHp / .3) * 35; A.heart = 60 / bpm; thud(t, { f0: 58, f1: 38, dur: .16, vol: .32 }); thud(t + .2, { f0: 54, f1: 36, dur: .14, vol: .22 }); }
  }
  // Later chapters have their own physical space: settling mineral, old machinery and furnace heat.
  function campaignAmbience(t, r, st, forge) {
    targetParam(A.wind.gain, forge ? .035 : r === 4 ? .045 : .032, t, 2);
    if (!st.playing && !st.title) return;
    if (!forge && t > A.dripNext) { A.dripNext = t + rand(3, 7); drip(t, rand(-.7, .7), rand(.009, .018)); }
    if (forge && t > A.crackleNext) { A.crackleNext = t + rand(.18, .5); burst(t, rand(.012, .03), rand(.005, .011), rand(1600, 2800), { q: 1.2, bus: 'amb', pan: rand(-.65, .65) }); }
    // Leave room for attack tells and narration; ambience does not add another voice.
    if (t <= A.next || st.combat || st.boss || st.dead || st.won || current || queue.length || nclock - lastTellN < 4 || A.calm < 4) return;
    A.next = t + rand(18, 32);
    const far = (name, o) => sample(name, Object.assign({ bus: 'amb', send: .65, lp: forge ? 1100 : 1400, pan: rand(-.75, .75) }, o));
    if (forge) {
      if (r === 1 || r === 4 || chance(.5)) far('winch', { vol: .12, rate: rand(.55, .7) });
      else far('metal', { vol: .1, rate: rand(.55, .75) });
      if (r === 3) far('chain', { vol: .07, rate: .65, delay: .7 });
    } else {
      far(r === 1 || r === 4 ? 'debris' : chance(.6) ? 'bone' : 'chain', { vol: .1, rate: rand(.55, .8) });
      if (r === 4) burst(t, 1.6, .035, 75, { q: .8, attack: .5, bus: 'amb', send: .5, buf: N.brown });
    }
  }
  function ambienceStep(dt, st) {
    const t = ctx.currentTime, r = room();
    heartbeatStep(dt, st, t);
    const chapter = B.app && B.app.world.chapter;
    if (chapter >= 3) { campaignAmbience(t, r, st, chapter >= 4); return; }
    if (B.app && B.app.world.chapter === 2) { coastAmbience(t, r, st); return; }
    targetParam(A.wind.gain, r === 4 ? .075 : r === 6 ? .065 : .05, t, 2);
    if (!st.playing && !st.title) return;
    const far = (n, o) => sample(n, Object.assign({ bus: 'amb', send: .7, lp: 1300, pan: rand(-.8, .8) }, o));
    // damlalar (revirde daha sık)
    if (t > A.dripNext) { A.dripNext = t + (r === 2 ? rand(.5, 1.8) : rand(1.4, 4.5)); drip(t, rand(-.8, .8), rand(.012, .035)); }
    // meşale çıtırtısı: çok hafif
    if (t > A.crackleNext) { A.crackleNext = t + rand(.05, .3); burst(t, rand(.008, .025), rand(.004, .014), rand(2200, 4200), { q: 2, bus: 'amb', pan: rand(-.6, .6) }); }
    // uzak olaylar: zincir, inilti, çığlık, vinç, taş gürlemesi, rahip ilahileri
    if (t > A.next) {
      const quiet = !st.combat;
      A.next = t + (quiet ? rand(9, 20) : rand(18, 34));
      const roll = Math.random();
      if (r === 3 && roll < .5) far(chance(.5) ? 'chant1' : 'chant2', { vol: .22, rate: rand(.75, .9), lp: 900, send: .8 });
      else if (r === 4 && roll < .4) { far('bone', { vol: .18, rate: rand(.6, .8) }); far('bone', { vol: .12, rate: .7, delay: .3 }); }
      else if (roll < .3) far('chain', { vol: .22, rate: rand(.6, .8), delay: 0 });
      else if (roll < .5) far('moan', { vol: .3, rate: rand(.75, 1.05) });
      else if (roll < .65 && quiet) far(chance(.5) ? 'prisonerMoan' : 'prisonerYell', { vol: .16, rate: rand(.6, .75), lp: 1000 });
      else if (roll < .8) far('winch', { vol: .2, rate: rand(.55, .75) });
      else { burst(t, 2.2, .07, 70, { q: .8, attack: .7, bus: 'amb', send: .6, buf: N.brown }); far('debris', { vol: .12, rate: .6, delay: 1 }); }
    }
  }
  // ------------------------------------------------------------------ zindan işkence ortamı
  // Sparse "someone is suffering behind the walls" layer over the score: muffled screams, moans, sobs, gurgles, whispers, chains, scraping, whip cracks,
  // wet blows and a far hammer. Voices are formant-filtered saw/noise (vibrato, pitch glides, rough AM) baked ONCE into small 22 kHz buffers, one buffer
  // per timer tick after unlock (offline renders bake at once); at play time each event gets random rate (pitch + formants), pan, low-pass and reverb send.
  // Never in the first 30 s of a run, never in combat / boss fight / the boss court, never while the narrator speaks or a line is queued.
  const TSR = 22050, TORT_SEED = 9137;
  function resonator(sr) {   // 2-pole formant resonator, coefficients refreshed every 32 samples
    let y1 = 0, y2 = 0, a0 = 0, b1 = 0, b2 = 0, n = 0;
    return (x, f, bw) => {
      if ((n++ & 31) === 0) { const r = Math.exp(-Math.PI * bw / sr), w = 2 * Math.PI * f / sr; b1 = 2 * r * Math.cos(w); b2 = -r * r; a0 = (1 - r) * 1.6; }
      const y = a0 * x + b1 * y1 + b2 * y2; y2 = y1; y1 = y; return y;
    };
  }
  const kr = (a, b) => a + krand() * (b - a);
  const shape = (u, a, r) => Math.min(1, u / a, (1 - u) / r);
  // p: dur, f0(u), form(u) -> [F1, F2, F3], env(u), breath, jit, vib [Hz, depth], rough [Hz, depth], lp
  function voiceBuf(sr, p) {
    const n = Math.round(p.dur * sr), o = new Float32Array(n), rs = [resonator(sr), resonator(sr), resonator(sr)], bw = [90, 120, 190], am = [1, .55, .25], lp = biq('lp', p.lp || 3600, .7, sr);
    let ph = 0, jit = 0, vph = kr(0, 6), aph = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n, e = p.env(u); if (e <= 0) continue;
      jit += (krand() * 2 - 1 - jit) * .03; vph += 2 * Math.PI * p.vib[0] / sr; aph += 2 * Math.PI * p.rough[0] / sr;
      ph += p.f0(u) * (1 + p.vib[1] * Math.sin(vph) + jit * p.jit) / sr; if (ph >= 1) ph -= 1;
      const g = (1 - ph) * 2 - 1, x = g * (1 - p.breath) + (krand() * 2 - 1) * p.breath * 1.3, F = p.form(u);
      let y = 0; for (let k = 0; k < 3; k++) y += rs[k](x, F[k], bw[k]) * am[k];
      o[i] = lp(y) * e * (1 - p.rough[1] * (.5 + .5 * Math.sin(aph)));
    }
    return o;
  }
  const mixInto = (o, piece, at, g = 1) => { const s = Math.round(at * TSR); for (let i = 0; i < piece.length && s + i < o.length; i++) o[s + i] += piece[i] * g; };
  const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  const VOW = { a: [800, 1250, 2700], o: [520, 900, 2550], u: [330, 760, 2400], e: [520, 1800, 2600], i: [300, 2200, 3000], ae: [700, 1650, 2600] };
  function screamBuf(sr, v) {
    const dur = kr(1.5, 2.8), base = v % 3 === 2 ? kr(150, 230) : kr(240, 520), fs = kr(.9, 1.14), a = VOW.a.map(x => x * fs), b = VOW.o.map(x => x * fs), crackAt = kr(.4, .8), pulses = v % 3 === 1;
    return voiceBuf(sr, { dur, breath: kr(.1, .25), jit: kr(1, 2.4), vib: [kr(5.5, 7.5), .018], rough: [kr(38, 75), v % 3 === 2 ? kr(.35, .55) : kr(.15, .35)], lp: 3400,
      f0: u => base * (.78 + .4 * Math.min(1, u * 7)) * (1 - .22 * u * u) * (u > crackAt && u < crackAt + .05 ? 1.32 : 1),
      form: u => lerp3(a, b, u * u * .8), 
      env: u => pulses ? shape(u, .03, .25) * (.55 + .45 * Math.max(0, Math.sin(u * Math.PI * 3.2))) * (u < .06 ? u / .06 : 1) : Math.pow(shape(u, .04, .5), .8) });
  }
  function moanBuf(sr, v) {
    const dur = kr(1.6, 3.2), base = v % 2 ? kr(100, 150) : kr(160, 240), fs = kr(.92, 1.1), a = VOW.o.map(x => x * fs), b = VOW.u.map(x => x * fs);
    return voiceBuf(sr, { dur, breath: kr(.25, .45), jit: 1.2, vib: [kr(3.5, 5), .012], rough: [kr(24, 45), .18], lp: 2600,
      f0: u => base * (1 + .1 * Math.sin(u * Math.PI)) * (1 - .14 * u), form: u => lerp3(a, b, u), env: u => Math.pow(shape(u, .3, .55), 1.2) });
  }
  function sobBuf(sr, v) {
    const cnt = 3 + (v % 4), o = new Float32Array(Math.round(4.2 * sr)), base = kr(190, 300); let t = 0, gap = kr(.34, .5);
    for (let s = 0; s < cnt && t < 3.6; s++) {
      const inh = voiceBuf(sr, { dur: .13, breath: .95, jit: 0, vib: [5, 0], rough: [30, 0], lp: 3000, f0: () => 150, form: u => lerp3(VOW.e, VOW.a, u), env: u => shape(u, .7, .25) * .55 });
      mixInto(o, inh, t, 1);
      const hu = voiceBuf(sr, { dur: kr(.14, .24), breath: .35, jit: 2, vib: [7, .02], rough: [30, .2], lp: 3000, f0: u => base * (1.08 - .3 * u) * (1 - s * .02), form: u => lerp3(VOW.ae, VOW.o, u), env: u => shape(u, .1, .6) });
      mixInto(o, hu, t + .12, 1.1 - s * .05); t += gap; gap = Math.max(.22, gap * kr(.92, 1.05));
    }
    return o.subarray(0, Math.round(Math.min(4.2, t + .4) * sr));
  }
  function gurgleBuf(sr, v) {
    const dur = kr(1.2, 2.4), base = kr(85, 130), rate = kr(13, 26), f2 = kr(1.4, 2.6), v0 = voiceBuf(sr, { dur, breath: .5, jit: 5, vib: [kr(3, 6), .03], rough: [rate, .85], lp: 2200,
      f0: u => base * (1 + .25 * Math.sin(u * 9 * f2)), form: u => [350 + 250 * Math.sin(u * 11), 700 + 300 * Math.sin(u * 7 + 1), 1800], env: u => shape(u, .1, .4) });
    const bp = biq('bp', kr(500, 900), 3, sr); let ph = 0;
    for (let i = 0; i < v0.length; i++) { ph += 2 * Math.PI * rate / sr; const b = Math.pow(.5 + .5 * Math.sin(ph), 2); v0[i] += bp(krand() * 2 - 1) * b * shape(i / v0.length, .1, .4) * 1.6; }
    return v0;
  }
  function whisperBuf(sr, v) {
    const dur = kr(1.6, 3.2), n = Math.round(dur * sr), o = new Float32Array(n), rs = [resonator(sr), resonator(sr), resonator(sr)], hp = biq('hp', 3800, .7, sr), keys = Object.keys(VOW), sy = Math.round(dur * kr(3.6, 6));
    let cur = VOW[keys[Math.floor(krand() * keys.length)]], nxt = cur, sib = 0; const fs = kr(.9, 1.2);
    for (let i = 0; i < n; i++) {
      const u = i / n, sp = u * sy, ix = Math.floor(sp), fr = sp - ix;
      if (fr < 1e-3 || (i === 0)) { cur = nxt; nxt = VOW[keys[Math.floor(krand() * keys.length)]]; sib = krand() < .3 ? 1 : 0; }
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, fr * 1.15)), 1.5) * shape(u, .05, .15), w = krand() * 2 - 1, F = lerp3(cur, nxt, fr);
      let y = 0; for (let k = 0; k < 3; k++) y += rs[k](w, F[k] * fs, 220 + 80 * k) * [1, .8, .5][k];
      o[i] = (y + (sib ? hp(w) * .6 : 0)) * env;
    }
    return o;
  }
  function chainBuf(sr, v) {
    const dur = kr(1.1, 2.2), o = new Float32Array(Math.round(dur * sr)), cnt = 10 + Math.floor(krand() * 16), ts = [];
    for (let i = 0; i < cnt; i++) ts.push(Math.pow(krand(), 1.5) * dur * .8);
    ts.sort((a, b) => a - b);
    ts.forEach((t, i) => {
      const f = kr(1500, 3600), dec = kr(.03, .09), a = kr(.3, 1), p = new Float32Array(Math.round((dec * 1.3 + .01) * sr));
      modes(p, sr, [[f, a, dec], [f * 1.58, a * .6, dec * .7], [f * 2.4, a * .35, dec * .5]]);
      for (let k = 0; k < Math.min(p.length, 60); k++) p[k] += (krand() * 2 - 1) * a * .6 * (1 - k / 60);
      mixInto(o, p, t, 1);
    });
    for (let j = 0; j < 1 + (v & 1); j++) { const f = kr(560, 900), p = new Float32Array(Math.round(.32 * sr)); modes(p, sr, [[f, .9, .25], [f * 1.5, .5, .15], [f * 2.3, .3, .1]]); mixInto(o, p, kr(0, dur * .5), .8); }
    return o;
  }
  function scrapeBuf(sr, v) {
    const dur = kr(1.0, 2.0), n = Math.round(dur * sr), o = new Float32Array(n), r1 = resonator(sr), r2 = resonator(sr), fa = kr(600, 1300), fb = kr(1500, 3000), sf = kr(45, 110);
    for (let i = 0; i < n; i++) {
      const u = i / n, t = i / sr, w = krand() * 2 - 1, f = fa * Math.pow(fb / fa, Math.pow(u, .8)), gate = Math.pow(Math.abs(Math.sin(Math.PI * sf * t * (1 + .15 * Math.sin(t * 7)))), 1.6) * (.6 + .4 * krand());
      o[i] = (r1(w, f, 260) + r2(w, f * 1.9, 400) * .5) * gate * shape(u, .1, .35);
    }
    const f = kr(700, 1200), p = new Float32Array(Math.round(.5 * sr)); modes(p, sr, steelModes(f, .3, .12)); mixInto(o, p, dur * .7, 1);
    return o;
  }
  function whipBuf(sr, v) {
    const o = new Float32Array(Math.round(1.6 * sr)), cracks = 1 + (v % 3 === 2 ? 1 : 0) + (v % 3 === 1 ? 0 : 0);
    let t = kr(.05, .12);
    for (let c = 0; c < cracks + (v > 3 ? 1 : 0); c++) {
      const p = new Float32Array(Math.round(.5 * sr)), hp = biq('hp', 2200, .7, sr), bp = biq('bp', kr(900, 1600), 1, sr), sw = biq('lp', 1800, .7, sr), pre = Math.round(.1 * sr);
      for (let k = 0; k < pre; k++) p[k] = sw(krand() * 2 - 1) * .5 * Math.pow(k / pre, 2.2);
      for (let k = pre; k < p.length; k++) { const q = (k - pre) / sr, w = krand() * 2 - 1; p[k] = hp(w) * 2.4 * Math.exp(-q / .004) + bp(w) * 1.4 * Math.exp(-q / .03); }
      mixInto(o, p, t, 1); const th = punchBuf(sr, 200, 80, .02, .06, .25, 2, 900, .3); mixInto(o, th, t + .1 + .015, .5);
      t += kr(.42, .8);
    }
    return o;
  }
  function wetBuf(sr, v) {
    const o = new Float32Array(Math.round(3.4 * sr)), cnt = 1 + (v % 3); let t = kr(.05, .2);
    for (let c = 0; c < cnt; c++) {
      mixInto(o, punchBuf(sr, kr(120, 180), 52, .03, .09, .4, 2, 500, .55), t, 1);
      const sq = new Float32Array(Math.round(.2 * sr)), bp = biq('bp', kr(350, 800), 2, sr);
      for (let k = 0; k < sq.length; k++) { const q = k / sr; sq[k] = bp(krand() * 2 - 1) * Math.exp(-q / .07) * (.5 + .5 * krand()) * 1.4; }
      mixInto(o, sq, t + .01, .8);
      const gr = voiceBuf(sr, { dur: kr(.22, .4), breath: .4, jit: 2, vib: [6, .02], rough: [32, .2], lp: 2500, f0: u => kr(105, 105) * (1.15 - .3 * u) * 1.15, form: u => lerp3(VOW.a, VOW.o, u), env: u => shape(u, .08, .6) });
      mixInto(o, gr, t + .07, .9); t += kr(.45, .9) + .3 * c;
    }
    return o.subarray(0, Math.round(Math.min(3.4, t + .5) * sr));
  }
  function hammerBuf(sr, v) {
    const o = new Float32Array(Math.round(4.6 * sr)), cnt = 4 + (v % 5), f = kr(500, 900), slow = krand() < .5; let t = kr(.05, .2);
    for (let c = 0; c < cnt && t < 4; c++) {
      const p = new Float32Array(Math.round(.7 * sr)), bp = biq('bp', 3000, 1.2, sr);
      for (let k = 0; k < 120; k++) p[k] = bp(krand() * 2 - 1) * (1 - k / 120) * 1.5;
      modes(p, sr, [[f * kr(.97, 1.03), .9, .35], [f * 1.59, .5, .25], [f * 2.14, .35, .18], [f * 3.4, .2, .1]]);
      mixInto(o, p, t, kr(.7, 1)); mixInto(o, punchBuf(sr, 130, 62, .02, .07, .25, 1.6, 400, .3), t, .7);
      t += (slow ? kr(.9, 1.4) : (c % 2 ? kr(.3, .42) : kr(.7, 1.0)));
    }
    return o.subarray(0, Math.round(Math.min(4.6, t + .4) * sr));
  }
  const TORT = { tortScream: [8, screamBuf], tortMoan: [8, moanBuf], tortSob: [8, sobBuf], tortGurgle: [7, gurgleBuf], tortWhisper: [8, whisperBuf], tortChain: [7, chainBuf],
    tortScrape: [7, scrapeBuf], tortWhip: [6, whipBuf], tortWet: [6, wetBuf], tortHammer: [6, hammerBuf] };
  function bakeTort() {
    const my = ctx, jobs = [];
    for (const name of Object.keys(TORT)) {
      // Recorded performers replace the old synthetic vocals. Keep synthesis
      // only as a fallback when a bank from an older saved page is loaded.
      if (B.SoundBank && B.SoundBank.clips && B.SoundBank.clips[name]) continue;
      for (let i = 0; i < TORT[name][0]; i++) jobs.push([name, i]);
    }
    const one = ([name, i]) => {
      const keep = kitSeed; kitSeed = TORT_SEED + i * 131 + name.length * 977;   // own random stream: the hit kit stays as it was
      try {
        const d = TORT[name][1](TSR, i); let pk = 0; for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); if (a > pk) pk = a; }
        const fade = Math.min(d.length >> 2, Math.round(TSR * .05)), g = pk > 0 ? .9 / pk : 0;
        for (let k = 0; k < d.length; k++) d[k] *= g * (k >= d.length - fade ? (d.length - k) / fade : 1);
        const buf = ctx.createBuffer(1, d.length, TSR); buf.getChannelData(0).set(d); (bank[name] = bank[name] || []).push(buf);
      } finally { kitSeed = keep; }
    };
    if (offline) { jobs.forEach(one); return; }
    let n = 0;
    return new Promise(resolve => {
      const next = () => {
        if (ctx !== my || n >= jobs.length) { resolve(); return; }
        try { one(jobs[n++]); } catch (e) { console.warn('Audio torture', e); resolve(); return; }
        setTimeout(next, 0);
      };
      setTimeout(next, 0);
    });
  }
  // How close the suffering is per room: Zincir Avlusu (1), Adak Salonu (3) and Çürüyen Revir (2) are the cells / torture rooms; the court (6) and the chapel (5) stay silent.
  const TORT_NEAR = { 0: .25, 1: .9, 2: .65, 3: .9, 4: .45, 5: 0, 6: 0 };
  const TORT_MIX = {   // event weights per room
    0: { chain: 2, moan: 2, hammer: 1, whisper: 1, sob: 1 },
    1: { chain: 3, scrape: 2, whip: 3, scream: 3, sob: 2, moan: 2, hammer: 2, wet: 1 },
    2: { gurgle: 3, sob: 3, moan: 3, wet: 2, whisper: 2, scream: 1 },
    3: { whisper: 3, moan: 2, scream: 3, wet: 2, sob: 2, scrape: 1, gurgle: 1 },
    4: { scrape: 3, whisper: 2, hammer: 2, moan: 2, chain: 1 }
  };
  const COAST_MIX = { 0: {whisper: 3, moan: 2, sob: 1}, 1: {scrape: 3, whisper: 2, scream: 1}, 2: {gurgle: 4, moan: 2, sob: 2}, 3: {gurgle: 4, chain: 2, scream: 1}, 4: {scrape: 3, whisper: 3, moan: 2} };
  const T = { clock: 0, next: 0, player: null, resetSerial: null, until: 0, recent: [], gate: 1, log: [] };
  function tortEvent(kind, near) {
    const side = chance(.5) ? -1 : 1, pan = side * rand(.35, .95), V = .45 + .55 * near, lpB = 650 + 1700 * near, sendB = .78 - .34 * near;
    let dur = 0;
    const tp = (name, o) => {
      const foley = /Chain|Scrape|Whip|Wet|Hammer/.test(name), lp = (o.lp || lpB) * rand(.8, 1.25);
      const d = sample(name, Object.assign({ bus: foley ? 'tortf' : 'tort', hp: 70, pan: clamp(pan + rand(-.08, .08), -1, 1), lp, send: sendB, detune: foley ? .035 : .015, rate: rand(.94, 1.06) }, o, { lp, vol: (o.vol || .2) * V }));
      dur = Math.max(dur, d + (o.delay || 0)); return d;
    };
    switch (kind) {
      case 'scream': { const d = tp('tortScream', { vol: .5, rate: rand(.96, 1.04) }); if (chance(.5)) tp('tortSob', { vol: .3, delay: d * .9 + rand(.4, 1.2), rate: rand(.96, 1.03) }); if (chance(.3)) tp('tortChain', { vol: .16, delay: rand(.3, 1) }); break; }
      case 'moan': tp('tortMoan', { vol: .55 }); if (chance(.25)) tp('tortMoan', { vol: .4, delay: rand(1.8, 3.2), rate: rand(.8, 1) }); break;
      case 'sob': tp('tortSob', { vol: .48 }); if (chance(.3)) tp('tortWhisper', { vol: .2, delay: rand(.5, 1.5), rate: rand(.9, 1.1) }); break;
      case 'gurgle': tp('tortGurgle', { vol: .55 }); if (chance(.4)) tp('tortWet', { vol: .3, delay: rand(.8, 1.8) }); break;
      case 'whisper': tp('tortWhisper', { vol: .5, lp: lpB * .8 }); if (chance(.4)) tp('tortWhisper', { vol: .35, delay: rand(2, 4), pan: -pan }); break;
      case 'chain': tp('tortChain', { vol: .32 }); break;
      case 'scrape': tp('tortScrape', { vol: .32 }); break;
      case 'whip': { const d = tp('tortWhip', { vol: .4 }); if (chance(.7)) tp(chance(.5) ? 'tortScream' : 'tortMoan', { vol: .4, delay: rand(.25, .6), rate: rand(1, 1.2) }); break; }
      case 'wet': tp('tortWet', { vol: .42 }); if (chance(.5)) tp('tortMoan', { vol: .3, delay: rand(1, 2), rate: rand(1, 1.15) }); break;
      case 'hammer': tp('tortHammer', { vol: .36, lp: lpB * .7 }); break;
    }
    return dur;
  }
  function tortureStep(dt, st) {
    const g = game(), p = g && g.player, t = ctx.currentTime, r = room();
    // Game resets preserve the player object. Its reset serial marks a new
    // journey/respawn and keeps already scheduled suffering muted in the grace period.
    if (p && (T.player !== p || T.resetSerial !== g.resetSerial)) {
      T.player = p; T.resetSerial = g.resetSerial; T.clock = 0; T.next = 30 + rand(3, 14); T.until = 0; T.recent = [];
    }
    // narrator: the dry layer fades out when a line starts and returns after it (a queued or urgent line also postpones new events)
    const laterChapter = B.app && B.app.world.chapter >= 3;
    const want = laterChapter || !st.playing || st.title || !TORT_NEAR[r] || T.clock < 30 || current || st.combat || st.boss || st.dead || st.won || nclock - lastTellN < 1.5 ? 0 : 1;
    if (want !== T.gate && T.busV) {
      T.gate = want;
      for (const bus of [T.busV, T.busF]) if (bus) targetParam(bus.gain, want, t, want ? .25 : .055);
      if (T.verbOut) targetParam(T.verbOut.gain, .55 * want, t, want ? .25 : .055);
    }
    if (laterChapter || !p || !st.playing || st.title || st.dead || st.won) return;
    T.clock += dt;
    if (T.clock < T.next) return;
    const near = TORT_NEAR[r], mix = B.app && B.app.world.chapter === 2 ? COAST_MIX[r] : TORT_MIX[r];
    if (!mix || !near || st.boss) { T.next = T.clock + rand(3, 6); return; }
    if (st.combat || A.calm < 4 || nclock - lastTellN < 4 || current || queue.length || t < T.until) { T.next = T.clock + rand(2, 4); return; }
    let sum = 0; const list = Object.keys(mix).filter(k => !T.recent.includes(k)); list.forEach(k => sum += mix[k]);
    let pick = rand(0, sum), kind = list[0]; for (const k of list) { pick -= mix[k]; if (pick <= 0) { kind = k; break; } }
    T.recent.push(kind); if (T.recent.length > 2) T.recent.shift();
    T.until = t + tortEvent(kind, near) + 1; T.log.push([+t.toFixed(1), kind, r]); if (T.log.length > 40) T.log.shift();   // debug()
    T.next = T.clock + rand(8, 25) * (near >= .6 ? 1 : near >= .4 ? 1.4 : 1.9);
  }
  // Düşman adımları ve boşta sesleri (model ayak basışları, BABA.app.game üzerinden okunur).
  const E = new WeakMap(); let idleNext = 0, enemySteps = 0;
  function enemiesStep(dt, st) {
    const g = game(), p = g && g.player; if (!g || !p || !g.enemies || !st.playing) return;
    const t = ctx.currentTime; enemySteps = 0;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const ff = e.model && e.model.root && e.model.root.userData && e.model.root.userData.footfall;
      let s = E.get(e);
      if (!s) { s = { serial: ff ? ff.serial : 0, n: 0, resetSerial: g.resetSerial }; E.set(e, s); }
      else if (s.resetSerial !== g.resetSerial) {
        // The reused model resets its footfall counter to zero. Compare from
        // that baseline so reset itself is silent and a first real step survives.
        s.serial = 0; s.n = 0; s.resetSerial = g.resetSerial;
      }
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (ff && ff.serial !== s.serial) {
        s.serial = ff.serial; s.n++;
        const a = e.action, burrow = a && a.burrow, underground = burrow && a.age >= burrow.from && a.age < burrow.to;
        if (e.active && !underground && (d < 15 || e.boss && d < 32) && enemySteps < 3) { enemySteps++; enemyStep(e, s.n, ff.kind); }
      }
      if (e.active && !e.action && d < 13 && t > idleNext && chance(dt * .35)) {
        idleNext = t + rand(1.6, 3.2); idleVocal(e);
      }
    }
  }
  function enemyStep(e, n, kind) {
    const at = e;
    switch (e.type) {
      case 'drowned': case 'urchin': sample('wetStep', { vol: .30, at, rate: rand(.65, .85) }); break;
      case 'crawler': sample('bone', { vol: .13, at, rate: 1.15 }); sample('wetStep', { vol: .15, at, rate: 1.1 }); break;
      case 'rootborn': sample('winch', { vol: .15, at, rate: .8 }); break;
      case 'lantern': sample('step', { vol: .17, at, rate: .65 }); break;
      case 'bell': sample('stomp', { vol: .65, at, rate: .65, send: .3 }); sample('chain', { vol: .15, at, rate: .6 }); break;
      case 'guard': sample('armorStep', { vol: .32, at, rate: rand(.75, .85) }); if (n % 2) sample('step', { vol: .3, at, rate: .8 }); break;
      case 'boss': sample('stomp', { vol: .75, at, rate: rand(.85, .95), send: .3 }); thud(now(), { f0: 55, f1: 30, dur: .3, vol: .45 * spatial(e.x, e.z).gain }); if (n % 3 === 0) sample('chain', { vol: .24, at, rate: rand(.75, .9) }); break;
      case 'carrier': sample('wetStep', { vol: .45, at, rate: rand(.75, .9) }); break;
      case 'prisoner': sample('step', { vol: .22, at, rate: rand(1, 1.15), lp: 3500 }); if (n % 4 === 0) sample('chain', { vol: .12, at, rate: rand(1.1, 1.3) }); break;
      case 'cultist': if (n % 2) sample('step', { vol: .16, at, rate: 1.1, lp: 3000 }); break;
      case 'ashbound': sample('step', {vol:.18,at,rate:.88,lp:4000}); if(n%4===0) sample('gear',{vol:.07,at,rate:.88}); break;
      case 'shardseer': sample('step',{vol:.14,at,rate:.94,lp:3400}); if(n%2===0) sample('bone',{vol:.06,at,rate:1.2}); break;
      case 'cavefang': sample('scuff',{vol:.13,at,rate:1.12}); sample('bone',{vol:.07,at,rate:1.18}); break;
      case 'gravemason': sample('armorStep',{vol:.26,at,rate:.77}); if(n%2===0) sample('debris',{vol:.08,at,rate:.82}); break;
      case 'ruinwarden': sample('armorStep',{vol:.28,at,rate:.72}); if(n%3===0) sample('chain',{vol:.08,at,rate:.8}); break;
      case 'hollowking': sample('stomp',{vol:.46,at,rate:.76,send:.20}); thud(now(),{f0:49,f1:29,dur:.25,vol:.24*spatial(e.x,e.z).gain,pan:spatial(e.x,e.z).pan}); if(n%3===0) sample('bone',{vol:.08,at,rate:.76}); break;
      case 'emberbound': sample('armorStep',{vol:.19,at,rate:.9}); if(n%3===0) sample('metal',{vol:.07,at,rate:.93}); break;
      case 'chainseer': sample('step',{vol:.14,at,rate:.82,lp:3200}); if(n%2===0) sample('chain',{vol:.09,at,rate:1.12}); break;
      case 'slagcrawler': sample('scuff',{vol:.18,at,rate:.72}); sample('metal',{vol:.07,at,rate:1.13}); break;
      case 'forgesentinel': sample('armorStep',{vol:.30,at,rate:.67}); if(n%2===0) sample('metal',{vol:.10,at,rate:.72}); break;
      case 'ashwarden': sample('armorStep',{vol:.28,at,rate:.74}); if(n%3===0) sample('chain',{vol:.09,at,rate:.68}); break;
      case 'furnaceheart': sample('stomp',{vol:.50,at,rate:.68,send:.22}); thud(now(),{f0:44,f1:25,dur:.28,vol:.26*spatial(e.x,e.z).gain,pan:spatial(e.x,e.z).pan}); if(n%3===0) sample('chain',{vol:.12,at,rate:.65}); break;
      default: break;   // pusucu sessiz yürür
    }
  }
  function idleVocal(e) {
    const at = e, o = { at, send: .25, rate: rand(.85, 1) };
    switch (e.type) {
      case 'prisoner': sample('prisonerMoan', Object.assign({ vol: .3 }, o)); break;
      case 'guard': sample('guardGrunt', Object.assign({ vol: .22, rate: rand(.8, .9) }, o)); break;
      case 'cultist': sample(chance(.5) ? 'chant1' : 'chant2', Object.assign({ vol: .2, lp: 2200, send: .5 }, o)); break;
      case 'stalker': if (chance(.4)) sample('stalkerShriek', Object.assign({ vol: .12, rate: rand(.6, .7), lp: 1800 }, o)); break;
      case 'drowned': case 'urchin': sample('carrierGurgle', Object.assign({ vol: .2, rate: .8 }, o)); break;
      case 'crawler': sample('stalkerShriek', Object.assign({ vol: .12, rate: .85 }, o)); break;
      case 'rootborn': sample('winch', Object.assign({ vol: .1, rate: .55 }, o)); break;
      case 'lantern': sample('tortWhisper', Object.assign({ vol: .12, rate: .65 }, o)); break;
      case 'bell': sample('bossRoar', Object.assign({ vol: .22, rate: .6 }, o)); break;
      case 'carrier': sample('carrierGurgle', Object.assign({ vol: .3 }, o)); break;
      case 'boss': sample('bossRoar', Object.assign({ vol: .25, rate: rand(.7, .8), lp: 2000 }, o)); sample('chain', { vol: .25, at, delay: .3 }); break;
    }
  }

  // ------------------------------------------------------------------ anlatıcı
  // Anlatıcı savaş uyarılarını örtmez. Oda cümleleri yalnızca sakin anda başlar (yakında canlı düşman yok, 1.5 sn
  // içinde saldırı uyarısı yok); beklerken kuyrukta kalır ve oda temizlenince okunur. Açılış ve cellat cümleleri
  // hemen başlar. Başlayan bir cümle bitene kadar kesilmez; yeni oda yalnızca henüz başlamamış oda cümlesini
  // değiştirir. Ölüm ve zafer sırada önceliklidir, mevcut cümle bittikten sonra başlar. Saldırı uyarısı sırasında
  // anlatıcı kısa süre hafif kısılır, kayıt ve altyazı sürer. Zamanlama ses bağlamından bağımsızdır:
  // ?sessiz ve ses kapalıyken altyazılar aynı anlarda görünür.
  const ROOM_LINES = new Set(['chains', 'ritual', 'crypt', 'rot', 'checkpoint', 'coastRoots', 'coastStreet', 'coastPier', 'coastSquare', 'coastCheckpoint', 'ruinsCheckpoint', 'forgeCheckpoint']), URGENT = new Set(['intro', 'boss', 'cellat', 'coastIntro', 'coastBoss', 'ruinsBoss', 'forgeBoss']);
  const QUEST_CHAPTER = Object.freeze({ questNames: 1, questVerdict: 1, questBell: 2, questMemory: 2, questKing: 3, questEcho: 3, questPrisoner: 4, questHeart: 4 });
  const TELLS = new Set(['enemyWindup', 'enemyAttack', 'slam', 'explosion', 'poison', 'warning', 'hurt', 'guardBreak', 'tellCommit']);
  let caption = null, voiceNode = null, voiceGain = null, current = null, queue = [], nclock = 0, lastTellN = -9;
  const heard = new Set(), recent = {}, voiceBuffers = {};
  const voiceLanguage = () => window.KabirI18n && window.KabirI18n.lang === 'en' ? 'en' : 'tr';
  const narrationLines = () => voiceLanguage() === 'en' ? (B.NarrationEN || {}) : (B.Narration || {});
  const voiceKey = key => voiceLanguage() + ':' + key;
  let deathTurn = 0, narrationMode = 'essential', lastNarrationEnd = -60;
  const INCIDENTAL_LINES = new Set(['chains','ritual','crypt','rot','coastRoots','coastStreet','coastPier','coastSquare','seal','coastSeal']);
  function updateNarrationDuck() {
    if (!ctx) return;
    const audible = !!(current && voiceNode && volume.voice > 0), tc = audible ? .18 : .6;
    N.musicDuck.gain.setTargetAtTime(audible ? .33 : 1, ctx.currentTime, tc);
    N.ambDuck.gain.setTargetAtTime(audible ? .28 : 1, ctx.currentTime, tc);
  }
  function updateVoiceWarning() {
    if (!ctx || !voiceNode || !voiceGain) return;
    const warning = ctx.currentTime < warningUntil;
    targetParam(voiceGain.gain, warning ? .65 : 1, ctx.currentTime, warning ? .035 : .18);
  }
  function finishVoice() {
    voiceNode = null; voiceGain = null;
    current = null; lastNarrationEnd = nclock; if (caption) caption('');
    updateNarrationDuck();
  }
  function say(key, force = false) {
    if (narrationMode === 'off' || (narrationMode === 'essential' && INCIDENTAL_LINES.has(key))) return;
    const lines = narrationLines();
    if ((key === 'death' || key === 'coastDeath') && force) { const v = (key === 'coastDeath' ? ['coastDeath', 'coastDeath2', 'coastDeath3'] : ['death', 'death2', 'death3']).filter(k => lines[k]); key = v[deathTurn++ % v.length] || key; }
    const line = lines[key]; if (!line) return;
    if (!force && (heard.has(key) || queue.some(q => q.key === key) || current && current.key === key)) return;
    if (!force && key !== 'intro' && recent[key] && Date.now() - recent[key] < 150000) return;   // yeniden doğunca aynı oda cümlesi tekrar etmesin
    if (force) queue = [];   // öncelik sıradadır; başlamış cümleye dokunma
    if ((key === 'seal' || key === 'coastSeal') && queue.some(q => ROOM_LINES.has(q.key))) return;                       // bir oda cümlesi zaten bekliyor
    if (key !== 'seal') queue = queue.filter(q => q.key !== 'seal');
    if (ROOM_LINES.has(key) || key === 'boss' || key === 'coastBoss' || key === 'ruinsBoss' || key === 'forgeBoss') queue = queue.filter(q => !ROOM_LINES.has(q.key)); // yalnızca son odanın cümlesi bekler
    // III/IV yemin noktasının henüz başlamamış yanıtı savaşta boss'u bekletmesin; current cümlesi korunur.
    if (key === 'ruinsBoss' || key === 'forgeBoss') queue = queue.filter(q => q.key !== 'heroOath');
    const entry = { key, cacheKey: voiceKey(key), line, force, age: 0, ready: false, buffer: null };
    // Each chapter has two one-shot completions. Keep them through room changes,
    // but never put a calm-only quest line in front of a boss/death announcement.
    const at = QUEST_CHAPTER[key] ? queue.findIndex(q => !q.force && !URGENT.has(q.key) && !QUEST_CHAPTER[q.key]) : URGENT.has(key) ? queue.findIndex(q => QUEST_CHAPTER[q.key]) : -1;
    if (at < 0) queue.push(entry); else queue.splice(at, 0, entry);
    while (queue.filter(q => QUEST_CHAPTER[q.key]).length > 2) queue.splice(queue.findIndex(q => QUEST_CHAPTER[q.key]), 1);
    while (queue.filter(q => !QUEST_CHAPTER[q.key]).length > 2) {
      const discard = queue.findIndex(q => !QUEST_CHAPTER[q.key] && !q.force && !URGENT.has(q.key));
      queue.splice(discard < 0 ? queue.findIndex(q => !QUEST_CHAPTER[q.key]) : discard, 1);
    }
    prepare(entry);
  }
  function sayQuest(key) { if (QUEST_CHAPTER[key]) say(key); }
  async function prepare(entry) {
    if (!ctx || (silent && !offline)) { entry.ready = true; return; }
    try {
      const my = ctx;
      let buf = voiceBuffers[entry.cacheKey];
      if (!buf) { buf = await decode(b64(entry.line.audio)); if (ctx !== my) return; voiceBuffers[entry.cacheKey] = buf; }
      entry.buffer = buf; entry.ready = true;
    } catch (e) { entry.ready = true; console.warn('Narration', e); }
  }
  function startVoice(entry) {
    heard.add(entry.key); recent[entry.key] = Date.now();
    if (!entry.buffer && ctx && voiceBuffers[entry.cacheKey]) entry.buffer = voiceBuffers[entry.cacheKey];
    const total = (entry.buffer ? entry.buffer.duration : entry.line.duration || 4) + .15;
    current = { key: entry.key, force: entry.force, left: total };
    if (caption) caption(entry.line.text, entry.line.speaker || 'Anlatıcı');
    if (!ctx || !entry.buffer || (silent && !offline)) return;
    const src = ctx.createBufferSource(), g = gainNode(1, N.voice); src.buffer = entry.buffer; src.connect(g);
    voiceNode = src; voiceGain = g;
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) {} if (voiceNode === src) finishVoice(); };
    src.start();
    updateVoiceWarning();
    updateNarrationDuck();
  }
  function calmAround() {
    const g = game(), p = g && g.player; if (!p || !g.enemies) return true;
    return !g.enemies.some(e => !e.dead && Number.isFinite(e.x) && Math.hypot(e.x - p.x, e.z - p.z) < 13);
  }
  function narrationStep(dt, st) {
    nclock += dt;
    const tellRecent = nclock - lastTellN < 1.5;
    if (current) {
      current.left -= dt;
      // Kayıtlı seste bitişi yalnızca onended belirler; düşük FPS veya sekme
      // duraklaması oyun sayacıyla ses saatini ayırsa da kaydı erken kesme.
      if (!voiceNode && current.left <= 0) finishVoice();
    }
    const settings = !!(B.app && B.app.view === 'settings');
    // Volume preview keeps audio running, but a waiting story beat belongs to the journey.
    for (const q of queue) if (!settings || q.force || URGENT.has(q.key)) q.age += dt;
    queue = queue.filter(q => q.force || q.age < 150);
    const next = queue[0];
    const breathingRoom = next && (next.force || URGENT.has(next.key) || nclock - lastNarrationEnd >= (narrationMode === 'essential' ? 24 : 9));
    if (!current && next && next.ready && !suspended && breathingRoom) {
      const calm = !settings && !st.combat && !tellRecent && calmAround() && !(ctx && ctx.currentTime < T.until);
      if (next.force || calm || (URGENT.has(next.key) && !tellRecent)) { queue.shift(); startVoice(next); }
    }
  }

  // ------------------------------------------------------------------ genel arayüz
  function stateFrom(st) {
    const g = game();
    return {
      playing: !!st.playing, combat: !!st.combat, boss: !!st.boss,
      dead: g ? g.state === 'dead' : false, won: g ? g.state === 'won' : false,
      title: B.app ? B.app.view === 'title' : !!st.title
    };
  }
  // State for BABA.Music: room id, danger 0..1 (awake + close enemies), combat, boss + phase, dead/won, title = muffled Kül Eşiği bed.
  function musicState() {
    const a = B.app, g = game();
    if (!g || !g.player || (a && a.view === 'title')) return { room: 5, paused: true, title: !!(a && a.view === 'title') };   // ajan:audio: title theme = the chapel bed + src/music-chapters.js
    const P = g.player, scoreRoom = room(), list = g.enemies || [];
    const boss = g.boss || list.find(e => e.boss);
    let danger = 0, combat = false;
    for (const e of list) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - P.x, e.z - P.z);
      const k = e.active ? clamp((20 - d) / 12, 0, 1) : clamp((16 - d) / 10, 0, 1) * .35;
      if (k > danger) danger = k;
      if (e.active && d < 10) combat = true;
    }
    return { room: scoreRoom, danger, combat,
      boss: !!boss && !boss.dead && !!(boss.active || boss.activated) && g.state === 'playing',
      bossPhase: boss && boss.phase >= 2 ? 2 : 1, dead: g.state === 'dead', won: g.state === 'won', paused: false,
      bossPhaseRaw: boss && boss.phase || 1, bossHp: boss && boss.maxHp ? clamp(boss.hp / boss.maxHp, 0, 1) : 1, heroHp: P.maxHp ? clamp(P.hp / P.maxHp, 0, 1) : 1 };   // ajan:audio
  }
  function update(dt, raw = {}) {
    if (suspended) return;
    const st = stateFrom(raw);
    narrationStep(dt, st);
    if (!ctx || !unlocked) return;
    const g = game(), p = g && g.player;
    try {
      if (extMusic) B.Music.update(dt, musicState()); else musicStep(dt, st);
      ambienceStep(dt, st); tortureStep(dt, st); enemiesStep(dt, st);
      /* ajan:audio */ if (B.AudioPlus) B.AudioPlus.update(dt, st); /* /ajan:audio */
      if (st.combat && A.calm > 8 && st.playing) stinger('encounter', 0);
      A.calm = st.combat ? 0 : A.calm + dt;
      const t = ctx.currentTime;
      if (N.warningDuck) targetParam(N.warningDuck.gain, t < warningUntil ? .48 : 1, t, t < warningUntil ? .035 : .28);
      updateVoiceWarning();
      if (t > muffleUntil) targetParam(N.world.frequency, st.dead ? 650 : 20000, t, st.dead ? .8 : .3);
      if (p) lastHp = p.hp;
      if (g && g.state === 'playing' && !st.boss) M.phase2 = false;
    } catch (e) { console.warn('Audio update', e); }
  }
  // Suspend/resume are asynchronous. A rapid pause/resume must follow the
  // latest intent after the operation already in flight has completed.
  // With no pending operation, resume is called in the gesture itself.
  function syncContextState() {
    if (silent || offline || !ctx) return;
    const my = ctx;
    if (contextStateTask && contextStateTask.context === my) return contextStateTask.promise;
    const running = unlocked && !suspended;
    if (running ? my.state === 'running' : my.state !== 'running') return;
    let operation;
    try { operation = running ? my.resume() : my.suspend(); } catch (_) { return; }
    const task = { context: my, promise: null }; contextStateTask = task;
    task.promise = Promise.resolve(operation).then(() => {
      if (contextStateTask === task) contextStateTask = null;
      if (ctx === my) return syncContextState();
    }, () => { if (contextStateTask === task) contextStateTask = null; });
    return task.promise;
  }
  // Keep synthesis, decoded buffers and the three reverbs at a predictable
  // full-bandwidth rate. A 96/192 kHz output device must not multiply the game
  // sound graph's work; the browser resamples the final output when necessary.
  function createLiveContext(C) {
    try { return new C({ latencyHint: 'interactive', sampleRate: 48000 }); }
    catch (e) {
      if (e.name !== 'NotSupportedError') throw e;
      return new C({ latencyHint: 'interactive', sampleRate: 44100 });
    }
  }
  function unlock() {
    unlocked = true; suspended = false;
    if (silent) return;
    if (!ctx && audioInitTask) {
      audioInitTask.then(syncContextState);
      return;
    }
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      try { build(createLiveContext(C), false); } catch (e) { console.warn('Audio', e); ctx = null; return; }
      bankTask = loadBank();
    }
    syncContextState();
  }
  // Await under the loading cover after a user gesture. A suspended context
  // can decode/build buffers without being resumed. Silent tests create none.
  async function prepareAudio(progress) {
    if (silent && !offline) { if (progress) progress(1); return true; }
    if (!ctx) {
      // No oscillator/buffer source exists before this suspension completes.
      // Loading may prepare sound before a gesture, but cannot start playback.
      if (!audioInitTask) audioInitTask = (async () => {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        const c = createLiveContext(C);
        if (c.state === 'running') await c.suspend();
        build(c, false); bankTask = loadBank();
        if (unlocked) syncContextState();
      })().catch(e => { console.warn('Audio preparation', e); });
      await audioInitTask;
    }
    const my = ctx; if (!my) return false;
    if (preparedContext === my) { if (progress) progress(1); return true; }
    if (progress) progress(0);
    await Promise.all([kitTask, tortTask, bankTask]);
    if (ctx !== my) return false;
    if (progress) progress(.4);
    if (extMusic && B.Music.prepare) await B.Music.prepare(v => { if (progress) progress(.4 + .25 * v); });
    // Only this chapter's two added quest voices need decoded buffers. Existing
    // narration keeps its established preparation; chapter transitions reload.
    const lines = Object.entries(narrationLines()).filter(([key, line]) => (!QUEST_CHAPTER[key] || QUEST_CHAPTER[key] === (B.ActiveChapter || 1)) && (!line.chapter || line.chapter === (B.ActiveChapter || 1)));   // ajan:quests: story lines carry their chapter
    for (let i = 0; i < lines.length; i++) {
      const [key, line] = lines[i];
      if (!voiceBuffers[voiceKey(key)] && line.audio) {
        try {
          const buf = await decode(b64(line.audio)); if (ctx !== my) return false; voiceBuffers[voiceKey(key)] = buf;
        } catch (e) {
          if (ctx !== my) return false;
          console.warn('Narration preparation', key, e);   // keep other records warm; say() can retry or show captions
        }
      }
      if (progress) progress(.65 + .35 * (i + 1) / Math.max(1, lines.length));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    preparedContext = my; if (progress) progress(1); return true;
  }
  function saySequence(keys) {
    for (const key of (Array.isArray(keys) ? keys : [keys]).slice(0, 2)) say(key);
  }
  function set(v) {
    if (v && ['essential','story','off'].includes(v.narrationMode) && v.narrationMode !== narrationMode) {
      narrationMode = v.narrationMode;
      queue = queue.filter(q => narrationMode !== 'off' && (narrationMode !== 'essential' || !INCIDENTAL_LINES.has(q.key)));
      if (narrationMode === 'off') { if (voiceNode) { try { voiceNode.stop(); } catch (_) {} } finishVoice(); }
    }
    const voiceWasAudible = volume.voice > 0;
    for (const key of Object.keys(volume)) if (Number.isFinite(v && v[key])) volume[key] = clamp(v[key], 0, 1);
    if (!ctx) return;
    const t = ctx.currentTime;
    targetParam(N.master.gain, volume.master, t, .08); targetParam(N.music.gain, volume.music, t, .08);
    targetParam(N.amb.gain, volume.ambient, t, .08); targetParam(N.sfx.gain, volume.sfx, t, .08); targetParam(N.voice.gain, volume.voice * VOICE_TRIM, t, .08);
    targetParam(N.wetSfx.gain, volume.sfx, t, .08); targetParam(N.wetAmb.gain, volume.ambient, t, .08); targetParam(N.wetMusic.gain, volume.music * .6, t, .08);
    if (T.wetV) targetParam(T.wetV.gain, volume.ambient, t, .08);
    if (T.wetF) targetParam(T.wetF.gain, volume.sfx, t, .08);
    if (current && voiceWasAudible !== (volume.voice > 0)) updateNarrationDuck();
  }
  // Çevrimdışı işleme (test): olay listesini OfflineAudioContext içinde çalar, AudioBuffer döndürür.
  // events: [[zaman_sn, 'play', ad, seçenekler] | [zaman_sn, 'say', anahtar, zorla] | [zaman_sn, 'state', {...}] | [zaman_sn, 'fn', f]]
  async function renderOffline(o = {}) {
    if (ctx && !offline) throw Error('Canlı ses bağlamı açıkken çevrimdışı işleme yapılmaz.');
    const sr = o.sampleRate || 44100, seconds = o.seconds || 4, step = o.step || .02;
    const O = window.OfflineAudioContext || window.webkitOfflineAudioContext, octx = new O(2, Math.ceil(sr * seconds), sr);
    const saved = { volume: Object.assign({}, volume), unlocked };
    testGame = o.game || null; qaMusic = !!o.music; if (o.volume) Object.assign(volume, o.volume);
    for (const k of Object.keys(bank)) delete bank[k]; bankState = 'none';
    build(octx, true); unlocked = true; suspended = false;
    await loadBank();
    // Anlatıcı kayıtlarını önceden çöz: çevrimdışı işleme gerçek zamandan hızlı ilerler, geç çözülen cümle kayardı.
    const lines = narrationLines();
    for (const k of Object.keys(lines)) if (!voiceBuffers[voiceKey(k)] && lines[k].audio) { try { voiceBuffers[voiceKey(k)] = await decode(b64(lines[k].audio)); } catch (e) {} }
    let state = Object.assign({ playing: true, combat: false, boss: false }, o.state || {});
    const events = (o.events || []).slice().sort((a, b) => a[0] - b[0]); let ei = 0;
    const tick = t => {
      while (ei < events.length && events[ei][0] <= t + 1e-6) {
        const [, kind, a, b] = events[ei++];
        if (kind === 'play') play(a, b || {}); else if (kind === 'say') say(a, b); else if (kind === 'state') state = Object.assign({}, state, a); else if (kind === 'fn') a(testGame);
      }
      if (o.drive) o.drive(t); else update(step, state);   // drive: gerçek oyunu kare kare ilerletir (oyun kendi update çağrısını yapar)
    };
    for (let t = step; t < seconds - step; t += step) octx.suspend(Math.round(t / step) * step).then(() => { tick(octx.currentTime); octx.resume(); });
    tick(0);
    const out = await octx.startRendering();
    if (extMusic && B.Music.dispose) B.Music.dispose();
    // test bağlamını tamamen bırak
    ctx = null; offline = false; unlocked = saved.unlocked; N = {}; testGame = null; qaMusic = false; extMusic = false;
    kitTask = tortTask = bankTask = preparedContext = audioInitTask = contextStateTask = null; Object.assign(volume, saved.volume);
    for (const k of Object.keys(bank)) delete bank[k]; bankState = 'none';
    queue = []; current = null; voiceNode = null; heard.clear();
    for (const k of Object.keys(voiceBuffers)) delete voiceBuffers[k];
    return out;
  }
  // İlk kullanıcı dokunuşunda (tık/tuş) ses açılır: ana menüde de karanlık müzik ve arayüz sesleri duyulur.
  if (!silent && window.addEventListener) {
    const first = () => { for (const ev of ['click', 'keydown', 'touchend']) window.removeEventListener(ev, first, true); unlock(); };
    for (const ev of ['click', 'keydown', 'touchend']) window.addEventListener(ev, first, true);
  }
  function diagnostics() {
    return { context: ctx ? ctx.state : 'none', sampleRate: ctx ? ctx.sampleRate : null,
      baseLatency: ctx ? ctx.baseLatency ?? null : null, outputLatency: ctx ? ctx.outputLatency ?? null : null };
  }
  /* ajan:audio — src/audio-plus.js (BABA.AudioPlus) adds chapter ambience beds, surface footsteps, hero breath, UI cues; this is its window into the engine. */
  const CORE = { gainNode, filter, panner, sample, burst, thud, ring, tone, swell, whoosh, growl, noiseSrc, busOf, track, throttle, spatial, room, player, game, rand, chance, clamp,
    get ctx() { return ctx; }, get N() { return N; }, get volume() { return volume; }, get offline() { return offline; }, get voices() { return voices; },
    get narrating() { return !!current; }, get bank() { return bank; } };
  /* /ajan:audio */
  B.Audio = {
    say, saySequence, sayQuest, prepare: prepareAudio, onCaption(fn) { caption = fn; },
    resetNarration() { queue = []; heard.clear(); },   // yeni yolculukta bekleyenleri at; mevcut cümle bitsin
    unlock, set, play, update,
    sample(name, o) { if (ctx && unlocked && !suspended && (!silent || offline)) return sample(name, o || {}); return 0; },   // tek bir kayıtlı parça (test ve ileride oyun kodu için)
    suspend() { suspended = true; if (extMusic) B.Music.suspend(); return syncContextState(); },
    resume() { if (!unlocked) return; suspended = false; if (silent || !ctx) return; if (extMusic) B.Music.resume(); return syncContextState(); },
    renderOffline,
    diagnostics,
    debug() { return { ...diagnostics(), bank: bankState, shift: bankShift, clips: Object.keys(bank).length, voices, tort: T.log, queue: queue.map(q => q.key), current: current && current.key, music: Object.assign({}, M.level) }; },
    get paused() { return suspended; },
    get silent() { return silent; }
  };
})();
