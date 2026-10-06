/* KARA GEÇİT — Bölüm I: Kurban Tapınağı — adaptive dark score (src/music.js)
 *
 * Classic script, no modules, no build step, works from file://. Zero bytes of audio data: everything is composed
 * and synthesised at runtime. One-shot instruments (church bells, taiko, frame drums, anvil, iron plate, chains,
 * bone rattles, heartbeat, sub impact, string marcato, low pizzicato, cathedral reverb impulse) are computed once
 * into small AudioBuffers with plain JS DSP (spread over the first frames). Sustained voices (sub/organ drone, low
 * male choir through a shared formant bank, strings/cello with vibrato and tremolo, brass swells, overtone chant,
 * sul-ponticello clusters) are live Web Audio nodes. All music runs on one transport (96 BPM, 104 in boss phase 2).
 *
 * API  window.BABA.Music
 *   init(ctx, outNode[, opts])  Use the game's AudioContext and its music bus (GainNode). Never creates an AudioContext.
 *                               Does nothing with ?sessiz, unless ctx is an OfflineAudioContext (QA renders, no output).
 *                               opts = {lite:true (fewer oscillators per note, shorter reverb: low-end tablets),
 *                                       seed:int, sync:true (QA: build every instrument buffer at once)}
 *                               Instrument buffers are then built in ~4 ms slices over the next ~15 update() calls.
 *   update(dt, s)               Call every frame while a run is on screen (also on the death / victory screens).
 *     s.room       0..6 world room id (or a room / encounter name). -1 or null = no room bed.
 *     s.danger     0..1 how close / aware the enemies are  -> tension layer (clusters, heartbeat, cello tremolo)
 *     s.combat     true while fighting. Held 4.5 s after it drops, then the combat layer ends on a beat.
 *     s.boss       true while the Zincir Celladı fight is active; s.bossPhase 1|2 (2 = harsher, faster variant)
 *     s.dead       true while the hero is dead (rising edge -> death sting; falling edge -> room bed fades back)
 *     s.paused     true -> muffled and lowered (menus over a running context, e.g. the title screen after a run:
 *                  {room: 0, paused: true}). Prefer suspend() when the whole AudioContext is suspended.
 *     s.won        true after the executioner dies (rising edge -> ~55 s ending piece, then near silence)
 *   sting(name)                 'death' | 'checkpoint' | 'victory' | 'bossStart'. update() edges never double a sting.
 *   stop()                      Fade out (~1.5 s), release every voice, reset. Silent until resume().
 *   suspend() / resume()        Fast fade out / fade in around pause menus and hidden tabs. resume() also ends stop().
 *   stats()                     {sources, voices, partVoices, buffers, pending, bpm, parts:{name:level}} for F3 / QA.
 *
 * Levels at outNode gain 1 (offline renders, integrated LUFS): exploration -31..-27, tension -26, combat -23,
 * boss phase 1 -22 / phase 2 -19, death sting -24, ending -24; sample peaks below -10 dBFS, so with the default music
 * volume the score never reaches the threshold of the game's shared compressor. The narrator ducks the whole music bus.
 */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const SILENT = (() => { try { return new URLSearchParams(location.search).has('sessiz'); } catch (e) { return false; } })();
  const TAU = Math.PI * 2, LOOKAHEAD = 0.3;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const semi = n => Math.pow(2, n / 12);
  function mkRng(s) {
    return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  let rnd = mkRng(7331);
  const rr = (a, b) => a + (b - a) * rnd(), pick = a => a[(rnd() * a.length) | 0], chance = p => rnd() < p;

  let ctx = null, out = null, ready = false, offline = false, halted = false, susp = false;
  const N = {}, I = {}, BUF = {}, VOICES = new Set();
  let live = 0, WAVE = null, queue = [], QA_ONLY = null, QA_NOIR = false, LITE = false;
  const SHOTS = new Set();
  const SHOT_META = new Map(), PART_OUTPUTS = new WeakMap();

  /* ------------------------------------------------------------------ DSP for one-shot instrument buffers */
  function newBuf(sec, div, ch) {
    const rate = Math.round(ctx.sampleRate / (div || 1));
    return ctx.createBuffer(ch || 1, Math.max(2, Math.ceil(sec * rate)), rate);
  }
  function finish(b, peak) { // normalise, zero the first sample, 20 ms fade at the end (no clicks when a buffer stops)
    let m = 0; const chs = [];
    for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); chs.push(d); for (let i = 0; i < d.length; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > m) m = a; } }
    const k = m > 0 ? peak / m : 0, fo = Math.min(chs[0].length >> 2, Math.round(b.sampleRate * .02));
    for (const d of chs) { for (let i = 0; i < d.length; i++) d[i] *= k; for (let i = 0; i < fo; i++) d[d.length - 1 - i] *= i / fo; d[0] = 0; }
    return b;
  }
  // exponentially decaying sine partial, recursive oscillator (no Math.sin per sample)
  function partial(d, rate, f, amp, decay, start, att, phase) {
    if (f <= 0 || f >= rate * .46 || !amp) return;
    const w = TAU * f / rate, c2 = 2 * Math.cos(w), ph = phase || 0; let y1 = Math.sin(ph - w), y2 = Math.sin(ph - 2 * w);
    const k = Math.exp(-1 / (decay * rate)), attN = Math.max(1, Math.round((att || .001) * rate)); let e = amp;
    for (let i = Math.round((start || 0) * rate), n = 0; i < d.length; i++, n++) {
      const y = c2 * y1 - y2; y2 = y1; y1 = y;
      d[i] += y * e * (n < attN ? n / attN : 1); e *= k; if (e < amp * 1e-4) break;
    }
  }
  function biq(type, f, q, rate) { // RBJ cookbook, band-pass with 0 dB peak
    const w = TAU * Math.min(f, rate * .45) / rate, cs = Math.cos(w), al = Math.sin(w) / (2 * q); let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al; return [b0 / a0, b1 / a0, b2 / a0, -2 * cs / a0, (1 - al) / a0];
  }
  function filt(d, c) { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < d.length; i++) { const x = d[i], y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y; } return d; }
  // time-varying biquad, coefficients refreshed every 32 samples: spec(t) -> [type, f, q]
  function sweepFilt(d, rate, spec) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, c = null;
    for (let i = 0; i < d.length; i++) {
      if ((i & 31) === 0) { const s = spec(i / rate); c = biq(s[0], s[1], s[2], rate); }
      const x = d[i], y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
    }
    return d;
  }
  function noiseBurst(d, rate, R, start, len, amp, dec, type, f, q, att) {
    const o = Math.round(start * rate), n = Math.min(d.length - o, Math.round(len * rate)); if (n <= 0) return;
    const tmp = new Float32Array(n), a = Math.max(1, (att || .0005) * rate), k = Math.exp(-1 / (dec * rate)); let e = amp;
    for (let i = 0; i < n; i++) { tmp[i] = (R() * 2 - 1) * e * (i < a ? i / a : 1); e *= k; }
    if (type) { filt(tmp, biq(type, f, q || .7, rate)); if (type === 'bp') filt(tmp, biq('bp', f, q || .7, rate)); }
    for (let i = 0; i < n; i++) d[o + i] += tmp[i];
  }
  // sine gliding from f0 to f1 (time constant ptc), exponential amplitude decay, optional 2nd harmonic
  function sweep(d, rate, f0, f1, ptc, amp, dec, start, att, harm) {
    let ph = 0; const o = Math.round((start || 0) * rate), a = Math.max(1, (att || .002) * rate), k = Math.exp(-1 / (dec * rate)); let e = amp;
    for (let i = o, n = 0; i < d.length; i++, n++) {
      const f = f1 + (f0 - f1) * Math.exp(-n / rate / ptc); ph += TAU * f / rate;
      let s = Math.sin(ph); if (harm) s += harm * Math.sin(2 * ph);
      d[i] += s * e * (n < a ? n / a : 1); e *= k; if (e < 1e-5 * amp) break;
    }
  }
  function sawAdd(d, rate, f, amp, phase) { // polyBLEP band-limited sawtooth
    let p = phase || 0; const inc = f / rate;
    for (let i = 0; i < d.length; i++) {
      let v = 2 * p - 1;
      if (p < inc) { const x = p / inc; v -= x + x - x * x - 1; } else if (p > 1 - inc) { const x = (p - 1) / inc; v -= x * x + x + x + 1; }
      d[i] += v * amp; p += inc; if (p >= 1) p -= 1;
    }
  }

  /* ------------------------------------------------------------------ instrument recipes (deterministic) */
  function bell(prime, sec, bright, sd) { // church bell: hum, prime, minor tierce, quint, nominal... each partial a beating pair
    const b = newBuf(sec, 3), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd), T = sec / 5.5; // 1/3 rate: partials stay below 2 kHz
    const P = [[.5, .3, .95], [1, .42, .62], [1.183, .4, .5], [1.5, .2, .38], [2, .48, .32], [2.5, .18, .22], [2.66, .15, .2], [3.01, .14, .16], [4.07, .11 * bright, .11], [5.33, .06 * bright, .08], [6.6, .035 * bright, .06]];
    for (const [r, a, dk] of P) {
      const f = prime * r, split = 1 + .0005 + R() * .0016;
      partial(d, rate, f, a * .62, dk * T, 0, .002, R() * TAU); partial(d, rate, f * split, a * .38, dk * T * .9, 0, .002, R() * TAU);
    }
    noiseBurst(d, rate, R, 0, .05, .22 * bright, .008, 'bp', Math.min(prime * 14, 4200), 1.2);
    return finish(b, .9);
  }
  function taiko(f0, dec, sd, slap) {
    const b = newBuf(dec * 4 + .25, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd);
    sweep(d, rate, f0 * 1.55, f0, .028, 1, dec, 0, .0015, .12);
    for (const [r, a, k] of [[1.59, .42, .34], [2.14, .26, .2], [2.65, .16, .13], [3.16, .08, .09]]) sweep(d, rate, f0 * r * 1.4, f0 * r, .02, a, dec * k, 0, .001);
    noiseBurst(d, rate, R, 0, .12, .9 * slap, .009, 'lp', 1400, .7);
    noiseBurst(d, rate, R, 0, .45, .6, .07, 'lp', 220, .7);
    for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * 1.4);
    return finish(b, .95);
  }
  function rim(sd, f) {
    const b = newBuf(.25, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd);
    noiseBurst(d, rate, R, 0, .06, 1, .004, 'bp', 2300, 1.6); partial(d, rate, f, .5, .03, 0, .0005); partial(d, rate, f * 1.83, .3, .018, 0, .0005);
    return finish(b, .9);
  }
  function doum(sd, f0) {
    const b = newBuf(1, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd);
    sweep(d, rate, f0 * 1.3, f0, .02, 1, .26, 0, .002, .08); partial(d, rate, f0 * 2.3, .2, .08, 0, .001);
    noiseBurst(d, rate, R, 0, .15, .35, .03, 'bp', 600, .9);
    return finish(b, .92);
  }
  function tek(sd) {
    const b = newBuf(.35, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd);
    noiseBurst(d, rate, R, 0, .08, 1, .012, 'bp', 1900, 1.1);
    partial(d, rate, 380, .45, .06, 0, .0005); partial(d, rate, 640, .3, .04, 0, .0005); partial(d, rate, 1210, .15, .025, 0, .0005);
    return finish(b, .9);
  }
  function metal(sd, f, ratios, sec, thud) { // anvil (free-bar modes) or the executioner's iron plate
    const b = newBuf(sec, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd);
    for (const [r, a, dk] of ratios) { partial(d, rate, f * r, a * .6, dk, 0, .0008, R() * TAU); partial(d, rate, f * r * (1.0007 + R() * .002), a * .4, dk * .85, 0, .0008, R() * TAU); }
    noiseBurst(d, rate, R, 0, .04, .7, .004, 'hp', 2600, .7);
    if (thud) { sweep(d, rate, 90, 58, .03, thud, .16, 0, .002, .2); noiseBurst(d, rate, R, 0, .2, thud * .5, .04, 'lp', 400, .7); }
    return finish(b, .9);
  }
  function chain(sd, sec) {
    const b = newBuf(sec, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd), shakes = 2 + (R() * 3 | 0);
    for (let s = 0; s < shakes; s++) {
      const c = .08 + R() * (sec - .6), n = 5 + (R() * 9 | 0), spread = .05 + R() * .12;
      for (let k = 0; k < n; k++) {
        const t = clamp(c + (R() + R() + R() - 1.5) * spread, 0, sec - .25), a = .25 + R() * .75;
        for (let p = 0; p < 3; p++) partial(d, rate, 1900 + R() * 3500, a * (.5 + R() * .5), .008 + R() * .035, t, .0003, R() * TAU);
        if (R() < .3) partial(d, rate, 700 + R() * 900, a * .6, .05 + R() * .04, t, .0005);
        noiseBurst(d, rate, R, t, .02, a * .35, .003, 'hp', 2500);
      }
      noiseBurst(d, rate, R, Math.max(0, c - spread), spread * 2.5, .05, spread, 'bp', 3200, .8, spread);
    }
    return finish(b, .85);
  }
  function bones(sd, sec) {
    const b = newBuf(sec, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd); let t = .01;
    while (t < sec - .15) {
      const a = .3 + R() * .7;
      noiseBurst(d, rate, R, t, .02, a, .0025, 'bp', 1200 + R() * 1400, 1.5);
      partial(d, rate, 650 + R() * 700, a * .5, .006 + R() * .008, t, .0003); partial(d, rate, 1500 + R() * 900, a * .25, .004, t, .0003);
      t += .025 + R() * R() * .17;
    }
    return finish(b, .85);
  }
  function stab(sd, bright) { // low string section marcato at D2 (re-pitched with playbackRate)
    const b = newBuf(.62, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd), tmp = new Float32Array(d.length);
    for (const [c, a] of [[-9, .45], [0, .5], [8, .45], [-1203, .35], [1198, .16]]) sawAdd(tmp, rate, 73.42 * Math.pow(2, c / 1200), a, R());
    sweepFilt(tmp, rate, t => ['lp', 400 + 2400 * bright * Math.exp(-t / .1), .9]);
    for (let i = 0; i < d.length; i++) { const t = i / rate; d[i] = tmp[i] * Math.min(1, t / .004) * (t < .07 ? 1 : Math.exp(-(t - .07) / .12)); }
    noiseBurst(d, rate, R, 0, .06, .12 * bright, .02, 'bp', 2600, 1);
    return finish(b, .9);
  }
  function pizz(sd) { // Karplus-Strong low pizzicato at D2
    const b = newBuf(2.6, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd), P = rate / 73.42 - .5, n = Math.floor(P), fr = P - n;
    const ex = new Float32Array(n + 2); let lp = 0; for (let i = 0; i < ex.length; i++) { lp += .35 * ((R() * 2 - 1) - lp); ex[i] = lp; }
    for (let i = 0; i < d.length; i++) {
      const x = i < ex.length ? ex[i] : 0, a = i >= n ? d[i - n] : 0, bb = i > n ? d[i - n - 1] : 0, c = i > n + 1 ? d[i - n - 2] : 0;
      d[i] = x + .9955 * .5 * (a * (1 - fr) + bb * fr + bb * (1 - fr) + c * fr);
    }
    filt(d, biq('lp', 2000, .7, rate));
    return finish(b, .9);
  }
  function funeralWire(sd) { // hand-struck iron wire with sympathetic strings; D3
    const b = newBuf(3.2, 2), d = b.getChannelData(0), rate = b.sampleRate, R = mkRng(sd);
    const f = 146.83, period = Math.round(rate / f), ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = (R() * 2 - 1) * Math.sin(Math.PI * i / period);
    let prev = 0;
    for (let i = 0; i < d.length; i++) {
      const j = i % period, x = ring[j]; ring[j] = .997 * (x + prev) * .5; prev = x;
      d[i] = x * Math.min(1, i / (rate * .003));
    }
    // Slightly stretched, beating modes make the instrument recognisable
    // without occupying the 1.2-4.6 kHz band used by enemy warnings.
    partial(d, rate, f * 2.003, .11, .8, 0, .005, .4);
    partial(d, rate, f * 3.012, .07, .55, 0, .005, .9);
    partial(d, rate, f * 4.026, .04, .32, 0, .005, 1.3);
    filt(d, biq('lp', 1050, .7, rate)); return finish(b, .82);
  }
  function irJob() { // stone cathedral: 21 ms pre-delay, early reflections, ~3.9 s RT60 with the highs dying first
    const sec = LITE ? 2.8 : 4.2, b = newBuf(sec, 1, 2), rate = b.sampleRate, R = mkRng(99), pd = Math.round(.021 * rate), fade = .07 * rate;
    const kCut = Math.exp(-1 / (.9 * rate)), kAmp = Math.exp(-6.9 / (3.9 * rate)); let c = 0, i = pd, lp = 0, a = 0, eCut = 1, eAmp = 1;
    return function step(maxN) { // returns the finished buffer, or null while there is more to compute
      if (c < 2) {
        const d = b.getChannelData(c), end = Math.min(d.length, i + maxN);
        for (; i < end; i++) {
          if (((i - pd) & 63) === 0) a = 1 - Math.exp(-TAU * (900 + 6500 * eCut) / rate);
          lp += a * ((R() * 2 - 1) - lp); d[i] = lp * eAmp * Math.min(1, (i - pd) / fade); eCut *= kCut; eAmp *= kAmp;
        }
        if (i < d.length) return null;
        for (let k = 0; k < 9; k++) { const j = pd + Math.round((.006 + R() * .085) * rate); d[j] += (R() < .5 ? -1 : 1) * (.5 - k * .04); }
        c++; i = pd; lp = 0; eCut = eAmp = 1; if (c < 2) return null;
      }
      return finish(b, .8);
    };
  }
  const RECIPES = {
    noise() { const b = newBuf(2.5, 1), d = b.getChannelData(0), R = mkRng(5); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; return b; },
    bellD3: () => bell(146.83, 9, .8, 11), bellD4: () => bell(293.66, 6.5, .6, 12), bellBig: () => bell(73.42, 12, 1, 13),
    taikoL1: () => taiko(58, .5, 21, 1), taikoL2: () => taiko(55, .55, 22, .8), taikoM1: () => taiko(92, .3, 23, 1), taikoM2: () => taiko(98, .28, 24, .9),
    rim1: () => rim(31, 820), rim2: () => rim(32, 900), doum1: () => doum(33, 105), doum2: () => doum(34, 98), tek1: () => tek(35), tek2: () => tek(36),
    anvil: () => metal(41, 620, [[1, 1, 1.7], [2.76, .55, .9], [5.4, .3, .5], [8.93, .18, .28]], 2.4, 0),
    plate: () => metal(42, 146.8, [[1, .8, 1.6], [1.47, .6, 1.2], [2.09, .7, 1], [2.56, .4, .8], [3.14, .45, .6], [3.9, .3, .5], [4.73, .25, .4], [5.66, .2, .3], [6.8, .12, .25]], 3, .9),
    chain1: () => chain(51, 1.8), chain2: () => chain(52, 2.3), chain3: () => chain(53, 1.4),
    bone1: () => bones(61, 1.1), bone2: () => bones(62, .8), bone3: () => bones(63, 1.4),
    heart() {
      const b = newBuf(.9, 4), d = b.getChannelData(0), r = b.sampleRate, R = mkRng(72);
      sweep(d, r, 70, 42, .035, 1, .085, 0, .004, .35); sweep(d, r, 62, 40, .03, .62, .075, .27, .004, .3);
      noiseBurst(d, r, R, 0, .08, .9, .02, 'bp', 230, 1.1, .003); noiseBurst(d, r, R, .27, .07, .6, .018, 'bp', 205, 1.1, .003); // valve knock
      for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * 1.8); // odd harmonics: audible where the sub is not
      return finish(b, .9);
    },
    boom() {
      const b = newBuf(4, 2), d = b.getChannelData(0), r = b.sampleRate, R = mkRng(71);
      sweep(d, r, 62, 30, .22, 1, 1, 0, .004, .25); noiseBurst(d, r, R, 0, 3.6, .5, .75, 'lp', 160, .7, .01); noiseBurst(d, r, R, 0, .08, .3, .02, 'bp', 700, .8);
      for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * 1.6);
      return finish(b, .95);
    },
    stab1: () => stab(91, 1), stab2: () => stab(92, .7), pizz: () => pizz(95), wire1: () => funeralWire(101), wire2: () => funeralWire(102)
  };
  const ORDER = ['ir', 'noise', 'bellD3', 'heart', 'doum1', 'tek1', 'chain1', 'taikoL1', 'taikoM1', 'rim1', 'stab1', 'boom', 'bellD4', 'pizz', 'bone1', 'anvil', 'plate',
    'doum2', 'tek2', 'chain2', 'chain3', 'bone2', 'bone3', 'taikoL2', 'taikoM2', 'rim2', 'stab2', 'bellBig', 'wire1', 'wire2'];
  let irStep = null;
  function buildSome(all) { // all: everything now (QA renders, stings); otherwise about 4 ms of work per call (one per frame)
    const t0 = performance.now();
    while (queue.length) {
      const k = queue[0];
      if (k === 'ir') {
        if (!irStep) irStep = irJob();
        const b = irStep(all ? Infinity : 24000);
        if (b) { BUF.ir = b; irStep = null; queue.shift(); if (!QA_NOIR) N.verb.buffer = b; }
      } else { BUF[k] = RECIPES[k](); queue.shift(); }
      if (!all && performance.now() - t0 > 4) break;
    }
  }

  /* ------------------------------------------------------------------ mix graph */
  const OUT_TRIM = .708;
  const MIX = { master: .5, verb: 1.3, drone: .08, choir: .4, strings: .5, cello: .15, hi: .5, brass: .16, perc: .35, far: .4, bell: .5, fx: .7 };
  function G(v, to) { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  function F(type, f, q, to) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q !== undefined) n.Q.value = q; if (to) n.connect(to); return n; }
  // Busses are pinned to 2 channels: when a panned (stereo) one-shot joined a mono bus, Chrome re-initialised the
  // downstream filters (mono->stereo) and the reset state produced a click. Explicit stereo keeps every filter's state.
  function st2(n) { n.channelCount = 2; n.channelCountMode = 'explicit'; n.channelInterpretation = 'speakers'; return n; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function setP(p, v, t, tc) { tc = Math.max(.005, tc); p.cancelScheduledValues(t); p.setTargetAtTime(v, t, tc); p.setValueAtTime(v, t + tc * 8); }
  function glide(p, v, t, tc) { p.setTargetAtTime(v, t, tc); p.setValueAtTime(v, t + tc * 8); } // attack-style ramps inside a note
  function chainNodes(input, list) { let a = input; for (const n of list) { a.connect(n); a = n; } return a; }
  const VOWELS = { // male bass formants [Hz, amplitude, bandwidth]
    a: [[600, 1, 90], [1040, .42, 110], [2250, .2, 160], [2450, .16, 170]],
    o: [[400, 1, 70], [750, .32, 90], [2400, .06, 140], [2600, .05, 160]],
    u: [[350, 1, 60], [600, .14, 80], [2400, .025, 140], [2675, .025, 160]],
    e: [[400, 1, 70], [1620, .22, 110], [2400, .22, 140], [2800, .14, 170]]
  };
  function formantBank(input) { // one shared vocal tract per choir section: formants do not follow pitch
    const o = G(1), bank = [];
    for (let k = 0; k < 4; k++) { const f = F('bandpass', 500, 4), g = G(.3, o); input.connect(f); f.connect(g); bank.push({ f, g }); }
    const body = F('lowpass', 300, .5), bg = G(.2, o); input.connect(body); body.connect(bg);
    o.bank = bank; return o;
  }
  function vowel(name, v, t, glide) {
    const bank = I[name] && I[name].post.bank, V = VOWELS[v]; if (!bank || !V) return;
    for (let k = 0; k < 4; k++) { setP(bank[k].f.frequency, V[k][0], t, glide); setP(bank[k].f.Q, V[k][0] / (V[k][2] * 1.6), t, glide); setP(bank[k].g.gain, V[k][1] * 1.4, t, glide); }
  }
  function shaperCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
  function bus(name, dry, send, chain) {
    const input = st2(G(MIX[name.replace(/[AB]$/, '')] || 1)), post = chain ? chain(input) : input;
    const d = G(dry, N.sum), s = G(send, N.verbIn); post.connect(d); post.connect(s); I[name] = { in: input, post, d, s };
  }
  function buildGraph() {
    // OUT_TRIM: fixed -3 dB after the dynamics, so that the score's peaks stay under the game's shared compressor
    N.master = G(0, G(OUT_TRIM, out)); N.duck = G(1, N.master); N.muffle = F('lowpass', 20000, .5, N.duck);
    const c = N.comp = ctx.createDynamicsCompressor();
    c.threshold.value = -20; c.knee.value = 12; c.ratio.value = 3; c.attack.value = .015; c.release.value = .3;
    const l = N.lim = ctx.createDynamicsCompressor(); l.threshold.value = -9; l.knee.value = 2; l.ratio.value = 20; l.attack.value = .002; l.release.value = .12; c.connect(l);
    // Chrome adds automatic makeup gain (0.6 x full-range reduction = +5.1 dB here); undo it so the limiter only catches peaks
    l.connect(G(Math.pow(10, -5.1 / 20), N.muffle));
    N.hp = F('highpass', 30, .7, c);
    // master tilt: a little less sub (room for the game's impact sounds), a little more presence (tablet / laptop speakers)
    const lo = F('lowshelf', 60), pr = F('peaking', 1800, .8); lo.gain.value = -3; pr.gain.value = 3; lo.connect(pr); pr.connect(N.hp);
    N.sum = st2(G(MIX.master, lo));
    N.verbIn = st2(G(1)); N.verb = ctx.createConvolver(); N.verbOut = G(MIX.verb, N.sum);
    chainNodes(N.verbIn, [F('highpass', 110, .6), F('lowpass', 5200, .5), N.verb, N.verbOut]);
    bus('drone', 1, .1);
    bus('choirA', 1, .75, formantBank); bus('choirB', 1, .55, formantBank);
    bus('strings', 1, .45, x => { const a = F('peaking', 240, 1), b = F('highshelf', 2800), d = F('lowpass', 5500, .5); a.gain.value = 3; b.gain.value = -5; return chainNodes(x, [a, b, d]); });
    bus('cello', 1, .35, x => { const a = F('peaking', 190, 1), b = F('peaking', 3000, 1), d = F('lowpass', 3200, .5); a.gain.value = 4; b.gain.value = -4; return chainNodes(x, [a, b, d]); });
    bus('hi', 1, .8, x => chainNodes(x, [F('highpass', 900, .6), F('lowpass', 5200, .5)]));
    bus('brass', 1, .3, x => { N.drive = G(.5); const sh = ctx.createWaveShaper(); sh.curve = shaperCurve(2); sh.oversample = '2x'; return chainNodes(x, [N.drive, sh, F('lowpass', 2600, .6), G(.6)]); });
    bus('perc', 1, .2, x => { const s = F('lowshelf', 90), h = F('highpass', 38, .7); s.gain.value = -3; return chainNodes(x, [h, s]); }); bus('far', .5, 1.1, x => chainNodes(x, [F('lowpass', 3400, .6)])); bus('bell', .6, 1.1, x => chainNodes(x, [F('lowpass', 5000, .5)])); bus('fx', 1, .6);
    vowel('choirA', 'u', 0, .01); vowel('choirB', 'a', 0, .01);
    const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = Math.pow(k, -1.2) * (k % 2 ? 1 : .85);
    WAVE = ctx.createPeriodicWave(re, im);
    buildDrone();
  }

  /* ------------------------------------------------------------------ parts (layers) and voices */
  const INSTS = ['drone', 'choirA', 'choirB', 'strings', 'cello', 'hi', 'brass', 'perc', 'far', 'bell', 'fx'];
  function Part(name) { return { name, level: 0, target: 0, tc: 1, g: {}, voices: new Set() }; }
  function dest(p, inst) { let g = p.g[inst]; if (!g) { g = p.g[inst] = st2(G(p.level, I[inst].in)); PART_OUTPUTS.set(g, p); if (p.target !== p.level) setP(g.gain, p.target, ctx.currentTime, p.tc); } return g; }
  function setPart(p, target, tc, dt) {
    const t = ctx.currentTime;
    if (Math.abs(target - p.target) > .002 || (tc !== p.tc && target !== p.level)) { p.target = target; p.tc = tc; for (const k in p.g) setP(p.g[k].gain, target, t, tc); }
    p.level += (p.target - p.level) * (1 - Math.exp(-(dt || 0) / Math.max(.01, p.tc)));
    if (Math.abs(p.level - p.target) < .001) p.level = p.target;
  }
  function relV(at, rel) {
    at = Math.max(at, ctx.currentTime); if (at >= this.end) return; this.end = at;
    const g = this.env.gain; g.cancelScheduledValues(at); g.setTargetAtTime(0, at, Math.max(.01, rel / 5)); g.setValueAtTime(0, at + rel * 1.7);
    const stop = at + rel * 1.8 + .05; for (const s of this.srcs) try { s.stop(stop); } catch (e) { }
  }
  function voice(p, srcs, others, env) {
    const my = ctx, v = { p, srcs, others, env, end: Infinity, release: relV };
    p.voices.add(v); VOICES.add(v); live += srcs.length;
    srcs[0].onended = () => { if (ctx === my) live = Math.max(0, live - srcs.length); p.voices.delete(v); VOICES.delete(v); for (const n of srcs.concat(others)) try { n.disconnect(); } catch (e) { } };
    return v;
  }
  function releaseAll(p, at, rel) { for (const v of p.voices) v.release(at, rel); }
  function releaseShots(p, at, rel) {
    at = Math.max(at, ctx.currentTime);
    for (const [s, shot] of SHOT_META) {
      if (shot.part !== p) continue;
      const g = shot.gain.gain;
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(at); else g.cancelScheduledValues(at);
      g.setTargetAtTime(0, at, Math.max(.01, rel / 5)); g.setValueAtTime(0, at + rel * 1.7);
      try { s.stop(at + rel * 1.8 + .05); } catch (e) { }
    }
  }
  function playBuf(name, t, to, o) {
    o = o || {};
    if (QA_ONLY && QA_ONLY.indexOf(name) < 0) return null;
    let b = BUF[name];
    if (!b) { const vs = []; for (let i = 1; i < 4; i++) if (BUF[name + i]) vs.push(BUF[name + i]); if (!vs.length) return null; b = pick(vs); }
    const s = ctx.createBufferSource(), rate = o.rate || 1; s.buffer = b; s.playbackRate.value = rate;
    const g = G(o.gain === undefined ? 1 : o.gain), extra = [g]; s.connect(g); let last = g;
    if (o.pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = clamp(o.pan, -1, 1); g.connect(pn); last = pn; extra.push(pn); }
    last.connect(to);
    const my = ctx; SHOTS.add(s); SHOT_META.set(s, { part: PART_OUTPUTS.get(to), gain: g, nodes: extra }); s.start(Math.max(t, ctx.currentTime)); live++;
    s.onended = () => { if (ctx === my) live = Math.max(0, live - 1); SHOTS.delete(s); SHOT_META.delete(s); try { s.disconnect(); } catch (e) {} for (const n of extra) try { n.disconnect(); } catch (e) {} };
    return s;
  }
  function choirNote(p, bus, midi, t, o) {
    o = o || {}; const f = mtof(midi), n = Math.min(o.n || 3, LITE ? 2 : 3), vel = (o.vel || .4) * (n === 2 && !o.n ? 1.2 : 1), att = o.att || 1.2;
    const env = G(0, dest(p, bus)); env.gain.setValueAtTime(0, t); glide(env.gain, vel, t, att / 3);
    const lA = osc('sine', rr(4.3, 5.2)), lB = osc('sine', rr(4.7, 5.7)), dep = o.vib === undefined ? 12 : o.vib, vd = t + (o.vibDelay === undefined ? .4 : o.vibDelay);
    const gA = G(0), gB = G(0), gC = G(0); lA.connect(gA); lA.connect(gC); lB.connect(gB);
    for (const [g, s] of [[gA, 1], [gB, 1], [gC, -1]]) { g.gain.setValueAtTime(0, t); glide(g.gain, s * dep * rr(.7, 1.2), vd, .5); }
    const srcs = [lA, lB], dets = [-11, 2, 12], mods = [gA, gB, gC];
    for (let k = 0; k < n; k++) {
      const s = ctx.createOscillator(), d0 = dets[k % 3] + rr(-4, 4) + (o.detune || 0);
      s.setPeriodicWave(WAVE); s.frequency.value = f; s.detune.value = d0; mods[k % 3].connect(s.detune); s.connect(env); srcs.push(s);
      if (o.glide) { const ga = t + (o.glideAt || 0); s.detune.setValueAtTime(d0, ga); s.detune.linearRampToValueAtTime(d0 + o.glide, ga + (o.glideTime || 3)); }
    }
    for (const s of srcs) s.start(t);
    const v = voice(p, srcs, [env, gA, gB, gC], env); if (o.dur) v.release(t + o.dur, o.rel || 1.6); return v;
  }
  function stringNote(p, bus, midi, t, o) {
    o = o || {}; const f = mtof(midi), n = LITE ? Math.min(2, o.n || 3) : o.n || 3, vel = (o.vel || .3) * (LITE && (o.n || 3) > 2 ? 1.2 : 1), att = o.att || .8, br = o.bright === undefined ? 1 : o.bright;
    const env = G(0, dest(p, bus)); env.gain.setValueAtTime(0, t); glide(env.gain, vel, t, att / 3);
    let head = env; const others = [env], srcs = [];
    if (o.trem) { const am = G(1 - o.trem / 2, env), tl = osc('sine', o.tremRate || rr(8, 10)), tg = G(o.trem / 2); tl.connect(tg); tg.connect(am.gain); head = am; srcs.push(tl); others.push(am, tg); }
    const lp = F('lowpass', 260, .6, head); lp.frequency.setValueAtTime(260, t);
    glide(lp.frequency, Math.min(8000, (420 + 1300 * br) * Math.pow(2, (midi - 38) / 16)), t, att / 2.5);
    const lfo = osc('sine', rr(4.8, 5.6)), lg = G(0), li = G(0), dep = o.vib === undefined ? 9 : o.vib; lfo.connect(lg); lfo.connect(li);
    lg.gain.setValueAtTime(0, t); glide(lg.gain, dep, t + .3, .5); li.gain.setValueAtTime(0, t); glide(li.gain, -dep * .8, t + .3, .5);
    srcs.unshift(lfo); others.push(lp, lg, li);
    for (let k = 0; k < n; k++) {
      const s = osc('sawtooth', f), d0 = (n > 1 ? (k / (n - 1) - .5) * 16 : 0) + rr(-2, 2) + (o.detune || 0);
      s.detune.value = d0; (k % 2 ? li : lg).connect(s.detune); s.connect(lp); srcs.push(s);
      if (o.gliss) { const ga = t + (o.glissAt || 0); s.detune.setValueAtTime(d0, ga); s.detune.linearRampToValueAtTime(d0 + o.gliss, ga + (o.glissTime || 2)); }
    }
    for (const s of srcs) s.start(t);
    const v = voice(p, srcs, others, env); if (o.dur) v.release(t + o.dur, o.rel || 1.2); return v;
  }
  function brassNote(p, midi, t, o) {
    o = o || {}; const f = mtof(midi), vel = o.vel || .5, att = o.att || .9;
    const env = G(0, dest(p, 'brass')); env.gain.setValueAtTime(0, t); glide(env.gain, vel, t, att / 3);
    const lp = F('lowpass', 140, 1.1, env); lp.frequency.setValueAtTime(140, t);
    lp.frequency.setTargetAtTime(240 + 1500 * vel * (o.bright || 1), t, att / 2); glide(lp.frequency, 420 + 500 * vel, t + att * 1.3, 1.4);
    const a = osc('sawtooth', f), b = osc('sawtooth', f), c = osc('square', f / 2), cg = G(.35, lp);
    a.detune.value = -6; b.detune.value = 7; a.connect(lp); b.connect(lp); c.connect(cg);
    const srcs = [a, b, c]; for (const s of srcs) s.start(t);
    const v = voice(p, srcs, [env, lp, cg], env); if (o.dur) v.release(t + o.dur, o.rel || 1.4); return v;
  }
  function overtone(p, t) { // throat-singing drone on D2: body + a narrow band walking over harmonics 6..12
    const f = mtof(38), env = G(0, dest(p, 'fx')), s = osc('sawtooth', f), lp = F('lowpass', 240, .7), gl = G(.45, env), bp = F('bandpass', f * 8, 24), gb = G(2.4, env);
    s.connect(lp); lp.connect(gl); s.connect(bp); bp.connect(gb);
    const l = osc('sine', 4.7), lg = G(6); l.connect(lg); lg.connect(s.detune);
    env.gain.setValueAtTime(0, t); glide(env.gain, .15, t, 1.6); s.start(t); l.start(t);
    const v = voice(p, [s, l], [env, lp, gl, bp, gb, lg], env); v.bp = bp; v.f = f; return v;
  }
  function noiseSwell(p, bus, t, dur, f0, f1, vel, q) { // wind / breath through a moving band
    if (!BUF.noise) return;
    const s = ctx.createBufferSource(), bp = F('bandpass', f0, q || 1.2), g = G(0, dest(p, bus)); s.buffer = BUF.noise; s.loop = true; s.connect(bp); bp.connect(g);
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur * .6); bp.frequency.exponentialRampToValueAtTime(f0 * .8, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + dur * .45); g.gain.linearRampToValueAtTime(0, t + dur);
    const my = ctx; SHOTS.add(s); SHOT_META.set(s, { part: p, gain: g, nodes: [bp, g] }); s.start(t, rnd() * 2); s.stop(t + dur + .05); live++;
    s.onended = () => { if (ctx === my) live = Math.max(0, live - 1); SHOTS.delete(s); SHOT_META.delete(s); for (const n of [s, bp, g]) try { n.disconnect(); } catch (e) {} };
  }
  function buildDrone() { // global sub/organ drone: D1 saw pair (beating), D2 sine, A1, Eb2 rub, Ab1 tritone
    const D = N.drone = { out: G(0, I.drone.in) }; D.wob = G(1, D.out); D.lp = F('lowpass', 130, .8, D.wob);
    const mk = (type, m, det, direct) => { const o = osc(type, mtof(m)); o.detune.value = det || 0; const g = G(0, direct ? D.wob : D.lp); o.connect(g); o.start(); live++; return { o, g }; };
    D.a = mk('sawtooth', 26, -4); D.b = mk('sawtooth', 26, 5); D.s = mk('sine', 38, 0, true); D.fifth = mk('triangle', 33, 0, true); D.rub = mk('sawtooth', 39, 0); D.trit = mk('sawtooth', 32, 0);
    const l2 = osc('sine', .047), l2g = G(.15); l2.connect(l2g); l2g.connect(D.wob.gain); l2.start(); live += 1; D.mod = l2; D.modGain = l2g;
  }
  function droneSet(c, t, tc) {
    const D = N.drone; if (D.cfg === c) return; D.cfg = c;
    setP(D.a.g.gain, c.d1 * .5, t, tc); setP(D.b.g.gain, c.d1 * .5, t, tc); setP(D.s.g.gain, c.d2 * .6, t, tc); setP(D.fifth.g.gain, c.fifth * .5, t, tc);
    setP(D.rub.g.gain, c.rub * .35, t, tc); setP(D.trit.g.gain, c.trit * .35, t, tc); setP(D.lp.frequency, c.cut, t, tc); setP(D.out.gain, (c.lvl === undefined ? 1 : c.lvl), t, tc);
  }

  /* ------------------------------------------------------------------ composition: D phrygian, tritone Ab, pedal D */
  const D1 = 26, G1 = 31, Ab1 = 32, A1 = 33, Bb1 = 34, C2 = 36, D2 = 38, Eb2 = 39, F2 = 41, G2 = 43, Ab2 = 44, A2 = 45, Bb2 = 46,
    C3 = 48, Cs3 = 49, D3 = 50, Eb3 = 51, E3 = 52, F3 = 53;
  // The chapter's motif ("the gate"): D Eb D | Ab A — semitone sigh, tritone fall, resolving to the fifth.
  const GATE = [[D3, 3], [Eb3, 1.5], [D3, 2], [Ab2, 2.5], [A2, 5]];
  // Bahtiyar's answer to the gate: the same falling semitone, ending in an
  // open fifth. Sparse, asymmetric phrases leave the dungeon audible.
  const OATH = [
    [[D3, 2], [F3, 1], [E3, 1], [D3, 3], [null, 2], [A2, 3]],
    [[A2, 3], [D3, 1.5], [Eb3, .5], [D3, 3], [null, 2], [A2, 2]],
    [[D3, 2], [Eb3, 1], [D3, 2], [null, 2], [A2, 3], [D3, 2]]
  ];
  function oath(p, t, level) {
    const variant = p.oathVariant === undefined ? 0 : (p.oathVariant + 1 + (chance(.3) ? 1 : 0)) % OATH.length;
    p.oathVariant = variant; let at = t;
    for (const [m, beats] of OATH[variant]) {
      if (m !== null) playBuf('wire', at, dest(p, 'cello'), { gain: (level || .23) * rr(.92, 1.06), rate: semi(m - D3), pan: rr(-.3, .3) });
      at += beats * .63;
    }
  }
  function phrase(p, bus, notes, t, o) {
    const beat = o.beat || .75; let at = t;
    for (const [m, b] of notes) {
      if (m !== null) {
        const dur = b * beat + .12;
        if (bus === 'brass') brassNote(p, m, at, { vel: o.vel, att: o.att || .5, dur, rel: o.rel || 1, bright: o.bright });
        else stringNote(p, bus, m, at, { vel: o.vel, att: o.att || .35, dur, rel: o.rel || .9, n: o.n || 2, vib: o.vib || 14, bright: o.bright });
      }
      at += b * beat;
    }
    return at;
  }
  function toll(p, t, o) {
    const n = o.n || 1;
    for (let i = 0; i < n; i++) playBuf(o.buf || 'bellD3', t + i * (o.gap || 3.4), dest(p, 'bell'), { gain: (o.vel || .5) * Math.pow(.8, i), rate: o.rate || 1, pan: o.pan || 0 });
  }
  function chant(p, t) { // "prayer of the rotting": reciting tone D3 with neighbours, slightly flat, syllable vowels
    const n = 6 + (rnd() * 5 | 0), line = [D3, D3, D3, Eb3, D3, C3, D3, D3, Eb3, D3]; let at = t;
    const hold = choirNote(p, 'choirA', D2, t, { vel: .16, att: 1, n: 2, vib: 6 });
    for (let i = 0; i < n; i++) {
      const last = i === n - 1, d = last ? 1.8 : pick([.45, .6, .6, .9]);
      vowel('choirA', last ? 'o' : pick(['a', 'o', 'u', 'e']), at, .05);
      choirNote(p, 'choirA', line[i % line.length], at, { vel: .28, att: .12, dur: d * .92, rel: last ? 1.4 : .35, detune: rr(-25, 5), vib: 8, vibDelay: .2 });
      at += d;
    }
    hold.release(at, 2.5); vowel('choirA', 'u', at + .4, .5);
  }
  function creep(p, t) { // bone passage: low pizzicato random walk on the 16th grid
    const notes = [D2, F2, Eb2, A1, Ab1, D2, Eb2, C2], sx = 60 / 96 / 4, n = 3 + (rnd() * 4 | 0); let at = t, i = rnd() * 3 | 0;
    for (let k = 0; k < n; k++) {
      playBuf('pizz', at, dest(p, 'cello'), { gain: .55 * rr(.7, 1), rate: semi(notes[i % notes.length] - D2) });
      at += sx * pick([2, 3, 3, 4, 5]); i += pick([1, 1, 2, 3]);
    }
  }
  const SCENES = [
    { name: KabirI18n.t('Kül Eşiği'), // ash threshold: low drone, far tolling, the motif on a lone cello, ash wind
      drone: { d1: 1, d2: .35, fifth: .3, rub: 0, trit: 0, cut: 125 },
      pads: { bus: 'choirA', vowel: 'u', inst: 'choir', chords: [[D2, A2], [D2, A2, D3], [Bb1, F2, D3], [D2, A2]], len: [14, 22], rest: .45, att: 4, rel: 5, vel: .16 },
      gens: [
        { every: [17, 27], first: [3, 6], fn: (p, t) => toll(p, t, { vel: .45, pan: rr(-.4, .4), n: chance(.3) ? 2 : 1 }) },
        { every: [34, 52], first: [12, 18], fn: (p, t) => { if (chance(.5)) oath(p, t); else phrase(p, 'cello', GATE, t, { beat: .8, vel: .18, n: 2 }); } },
        { every: [11, 19], first: [1, 4], fn: (p, t) => noiseSwell(p, 'fx', t, rr(5, 8), 280, 700, .25) }
      ] },
    { name: KabirI18n.t('Zincir Nöbeti'), // chain watch: processional frame drum, rubbing low strings, chains, a far anvil
      drone: { d1: .9, d2: .25, fifth: .1, rub: .4, trit: 0, cut: 155 },
      pads: { bus: 'strings', inst: 'string', chords: [[D2, Eb2, A2], [D2, A2, Eb3], [Bb1, D3, Eb3], [D2, A2, D3]], len: [10, 16], rest: .35, att: 3, rel: 4, vel: .05, bright: .6 },
      steps(p, st, t) {
        const s = st % 32, far = dest(p, 'far');
        if (s === 0) playBuf('doum', t, far, { gain: .55 }); else if (s === 16) playBuf('doum', t, far, { gain: .38, rate: .94 });
        else if ((s === 8 || s === 24) && chance(.55)) playBuf('tek', t, far, { gain: .2, rate: rr(.96, 1.04) });
        if (st % 128 === 96 && chance(.6)) playBuf('anvil', t, far, { gain: .25, rate: rr(.97, 1.03), pan: rr(-.5, .5) });
      },
      gens: [
        { every: [6, 13], first: [2, 5], fn: (p, t) => playBuf('chain', t, dest(p, 'far'), { gain: rr(.25, .45), rate: rr(.8, 1.05), pan: rr(-.8, .8) }) },
        { every: [26, 38], first: [8, 14], fn: (p, t) => toll(p, t, { vel: .35, pan: rr(-.3, .3) }) },
        { every: [40, 58], first: [16, 24], fn: (p, t) => phrase(p, 'brass', GATE, t, { beat: .7, vel: .16, att: .6, rel: 1.2, bright: .5 }) } // the watch horn: the gate motif
      ] },
    { name: KabirI18n.t('Çürüyenlerin Duası'), // prayer of the rotting: low male chant, cracked flat bell, groaning cello
      drone: { d1: .8, d2: .3, fifth: .35, rub: .1, trit: 0, cut: 140 },
      gens: [
        { every: [10, 16], first: [2, 4], fn: chant },
        { every: [28, 40], first: [12, 18], fn: (p, t) => toll(p, t, { vel: .35, rate: semi(1) * .985, pan: rr(-.4, .4) }) },
        { every: [20, 30], first: [8, 12], fn: (p, t) => stringNote(p, 'cello', D2, t, { vel: .2, att: 1.5, dur: 4.5, rel: 2, n: 2, gliss: -100, glissAt: 2, glissTime: 2.5 }) }
      ] },
    { name: KabirI18n.t('Adak Ayini'), // offering rite: 7/8 frame drums, overtone chant, open-vowel clusters
      drone: { d1: 1, d2: .3, fifth: .35, rub: 0, trit: .15, cut: 175 },
      pads: { bus: 'choirA', vowel: 'a', inst: 'choir', chords: [[D2, A2, Eb3], [D2, Ab2, D3], [C2, G2, Eb3], [D2, A2, D3]], len: [12, 18], rest: .35, att: 3, rel: 4, vel: .11 },
      enter(p, t) { p.ot = overtone(p, t); }, exit(p, t) { if (p.ot) p.ot.release(t, 3); p.ot = null; },
      steps(p, st, t) {
        if (st % 2) return; const e = (st / 2) % 7, far = dest(p, 'far'), vel = [.55, .12, .38, .14, .36, .12, .16][e], kind = e === 0 || e === 2 || e === 4 ? 'doum' : 'tek';
        if (e === 0 || chance(.8)) playBuf(kind, t, far, { gain: .36 * vel * rr(.85, 1.1), rate: kind === 'doum' ? 1 : rr(.95, 1.05) });
        if (e === 0 && (st / 2) % 28 === 0) playBuf('taikoM', t, far, { gain: .3 });
      },
      gens: [
        { every: [1.8, 3.6], first: [3, 4], fn: (p, t) => { if (p.ot) glide(p.ot.bp.frequency, p.ot.f * pick([6, 7, 8, 8, 9, 10, 12]), t, .18); } },
        { every: [24, 36], first: [10, 16], fn: (p, t) => toll(p, t, { vel: .35, pan: rr(-.3, .3) }) }
      ] },
    { name: KabirI18n.t('Kemik Geçidi'), // bone passage: creeping pizzicato, bone rattles, glassy sul-ponticello clusters, falling cello
      drone: { d1: .75, d2: .2, fifth: 0, rub: 0, trit: .35, cut: 115 },
      pads: { bus: 'hi', inst: 'string', chords: [[74, 75], [80, 81], [74, 80]], len: [8, 12], rest: .55, att: 3, rel: 3, vel: .05, trem: .8, n: 2, bright: 1 },
      gens: [
        { every: [9, 16], first: [2, 4], fn: creep },
        { every: [5, 11], first: [1, 3], fn: (p, t) => playBuf('bone', t, dest(p, 'far'), { gain: rr(.4, .7), rate: rr(.85, 1.15), pan: rr(-.9, .9) }) },
        { every: [22, 34], first: [10, 14], fn: (p, t) => stringNote(p, 'cello', D3, t, { vel: .16, att: 1, dur: 4.5, rel: 1.5, n: 2, gliss: -300, glissAt: 1, glissTime: 4, vib: 4 }) }
      ] },
    { name: KabirI18n.t('Sessiz Şapel'), // silent chapel (oath stone): almost nothing — soft "o" chords, long rests, a small high bell
      drone: { d1: .4, d2: .25, fifth: .15, rub: 0, trit: 0, cut: 105 },
      pads: { bus: 'choirA', vowel: 'o', inst: 'choir', chords: [[D2, A2, D3, F3], [Bb1, F2, D3, F3], [G1, D2, Bb2, D3], [A1, A2, Cs3, E3]], len: [12, 18], rest: .5, att: 4, rel: 6, vel: .11 },
      gens: [{ every: [30, 44], first: [6, 10], fn: (p, t) => toll(p, t, { buf: 'bellD4', vel: .28, pan: rr(-.5, .5) }) },
        { every: [37, 55], first: [12, 18], fn: (p, t) => oath(p, t, .18) }] },
    { name: KabirI18n.t('Zincir Mahkemesi'), // chain court before the executioner wakes: heartbeat, hummed tritone, chains, a far brass breath
      drone: { d1: .9, d2: .3, fifth: 0, rub: .3, trit: .3, cut: 150 },
      pads: { bus: 'choirA', vowel: 'u', inst: 'choir', chords: [[D2, Ab2], [D2, A2], [Eb2, A2], [D2, Ab2, D3]], len: [12, 18], rest: .5, att: 4, rel: 5, vel: .1 },
      gens: [
        { every: [1.25, 1.35], first: [.5, 1], fn: (p, t) => { if (!(PT.target > .05)) playBuf('heart', t, dest(p, 'perc'), { gain: .6 }); } },
        { every: [7, 12], first: [2, 4], fn: (p, t) => playBuf('chain', t, dest(p, 'far'), { gain: rr(.45, .7), rate: rr(.7, .9), pan: rr(-.8, .8) }) },
        { every: [16, 24], first: [5, 8], fn: (p, t) => brassNote(p, D2, t, { vel: .2, att: 2.5, dur: 5, rel: 3, bright: .6 }) }
      ] }
  ];
  // A separate coastal score: unsettled low strings, drowned choir and the distant bell.
  const COAST_SCENES = SCENES.map((sc, i) => ({
    name: [KabirI18n.t('Yanmış Mezarlık'),KabirI18n.t('Köklerin Yolu'),KabirI18n.t('Boğulmuş Sokak'),KabirI18n.t('Çürük İskele'),KabirI18n.t('Kara Kök Meydanı'),KabirI18n.t('Son Fener'),KabirI18n.t('Boğulmuş Çanlık')][i],
    drone: {d1:.8, d2:.4, fifth:i === 5 ? .3 : .12, rub:.25, trit:i === 4 ? .22 : .08, cut:125 + i * 7},
    pads: {bus: i === 2 || i === 5 ? 'choirA' : 'strings', vowel:'u', inst:i === 2 || i === 5 ? 'choir' : 'string',
      chords:[[D2,A2,Eb3],[Bb1,D2,Ab2],[D2,Ab2,E3],[D2,A2,D3]], len:[16,25], rest:.38, att:4, rel:6, vel:.07, bright:.38, trem:.15},
    gens: [
      {every:[21,34],first:[5,9],fn:(p,t)=>toll(p,t,{vel:i === 6 ? .45 : .23,rate:.72,pan:rr(-.5,.7)})},
      {every:[16,29],first:[3,8],fn:(p,t)=>stringNote(p,'cello',i === 4 ? Eb2 : D2,t,{vel:.17,att:2,dur:5,rel:3,n:2,gliss:-65,glissAt:2,glissTime:3})},
      {every:[13,23],first:[1,5],fn:(p,t)=>noiseSwell(p,'fx',t,rr(5,9),140,450,.20)}
    ]
  }));
  // The buried court breathes through cold strings and sparse, distant bells;
  // the forge uses struck iron and an uneven furnace pulse. Reuse the prepared
  // instrument bank: changing chapters adds no synthesis buffers or audio bus.
  const RUINS_SCENES = SCENES.map((sc, i) => ({
    name:[KabirI18n.t('Yitik Sütunlar'),KabirI18n.t('Kralların Mezarları'),KabirI18n.t('Çöken Anıt'),KabirI18n.t('Kör Kristaller'),KabirI18n.t('Taşın İçindeki Ölüler'),KabirI18n.t('Yutulan Saray'),KabirI18n.t('Sessiz Taht')][i],
    drone:{d1:.55,d2:.25,fifth:i===5?.3:.12,rub:i===3?.12:.04,trit:i===6?.2:0,cut:105+i*5},
    pads:{bus:i===2||i===5?'choirA':'strings',vowel:'o',inst:i===2||i===5?'choir':'string',
      chords:i===3?[[D3,Eb3,A2+12],[D3,Ab2+12],[Bb2,F3,D3]]:[[D2,A2],[Bb1,D3,F3],[G1,D2,A2],[D2,A2,D3]],
      len:[18,28],rest:.55,att:5,rel:6,vel:i===3?.035:.065,bright:.25,trem:i===3?.12:0},
    gens:[
      {every:[26,42],first:[7,12],fn:(p,t)=>toll(p,t,{buf:i===3?'bellD4':'bellD3',vel:i===6?.25:.15,rate:i===3?1:.88,pan:rr(-.55,.55)})},
      {every:[29,46],first:[9,16],fn:(p,t)=>stringNote(p,'cello',i===4?Eb2:D2,t,{vel:.12,att:2.8,dur:5,rel:3,n:2,gliss:i===4?-80:-25,glissAt:2,glissTime:3})}
    ]
  }));
  const FORGE_SCENES = SCENES.map((sc, i) => ({
    name:[KabirI18n.t('Kör Körükler'),KabirI18n.t('Kızgın Nakliye'),KabirI18n.t('Sönen Dökümhane'),KabirI18n.t('Zincir Kuyuları'),KabirI18n.t('Cüruf Meydanı'),KabirI18n.t('Köz Yemini'),KabirI18n.t('Kızıl Ocak')][i],
    drone:{d1:.8,d2:.18,fifth:i===5?.25:.08,rub:i===4?.2:.12,trit:i===6?.2:.05,cut:i===5?105:145},
    pads:{bus:i===5?'choirA':'strings',vowel:'o',inst:i===5?'choir':'string',
      chords:[[D2,A2],[Eb2,A2],[Bb1,D3],[D2,Ab2]],len:[12,21],rest:.48,att:3.5,rel:5,vel:i===5?.07:.045,bright:.3},
    steps(p,st,t){
      if(i===5)return;
      const beat=st%64,far=dest(p,'far');
      if(beat===0||beat===24)playBuf('doum',t,far,{gain:beat===0?.24:.13,rate:.85});
      if(beat===40&&chance(.55))playBuf('anvil',t,far,{gain:.10,rate:.72,pan:rr(-.45,.45)});
    },
    gens:[
      {every:[19,31],first:[6,10],fn:(p,t)=>playBuf(i===3?'chain':'plate',t,dest(p,'far'),{gain:i===3?.18:.12,rate:rr(.62,.79),pan:rr(-.7,.7)})},
      {every:[30,47],first:[12,19],fn:(p,t)=>stringNote(p,'cello',D2,t,{vel:.13,att:2,dur:4.5,rel:3,n:2,bright:.3})}
    ]
  }));
  // Chapter V — Son Mahkeme: the void court. Choir instead of strings, a far judgement bell, the D–Ab tritone held open; the final court sings.
  const FINALE_SCENES = SCENES.map((sc, i) => ({
    name:[KabirI18n.t('Kırık Gök'),KabirI18n.t('Asılı Zincirler'),KabirI18n.t('Tanıkların Köprüsü'),KabirI18n.t('Dört Efendinin Gölgesi'),KabirI18n.t('Boşluk Kürsüsü'),KabirI18n.t('Son Tanıklık'),KabirI18n.t('Son Mahkeme')][i],
    drone:{d1:.9,d2:.22,fifth:i===5?.2:.04,rub:i>=3?.24:.14,trit:i===6?.32:.16,cut:i===5?95:125},
    pads:{bus:'choirA',vowel:i===6?'a':'o',inst:'choir',
      chords:[[D2,Ab2],[Eb2,A2],[D2,A2],[Bb1,Eb2]],len:[14,24],rest:.42,att:4.5,rel:6,vel:i===5?.08:.06,bright:.22},
    steps(p,st,t){
      if(i===5)return;
      const beat=st%64,far=dest(p,'far');
      if(beat===0)playBuf('doum',t,far,{gain:.2,rate:.7});
      if(beat===32&&chance(.6))playBuf('chain',t,far,{gain:.09,rate:.6,pan:rr(-.6,.6)});
    },
    gens:[
      {every:[24,38],first:[5,9],fn:(p,t)=>toll(p,t,{buf:'bellD3',vel:i===6?.24:.13,rate:.74,pan:rr(-.5,.5)})},
      {every:[28,44],first:[11,17],fn:(p,t)=>stringNote(p,'cello',i>=4?D1+12:D2,t,{vel:.12,att:3,dur:5.5,rel:3.5,n:2,gliss:-60,glissAt:2.5,glissTime:3})}
    ]
  }));
  // app.js restores the campaign chapter after this script loads.
  const roomScore = i => (B.ActiveChapter===5?FINALE_SCENES:B.ActiveChapter===4?FORGE_SCENES:B.ActiveChapter===3?RUINS_SCENES:B.ActiveChapter===2?COAST_SCENES:SCENES)[i];
  const DRONE_OFF = { d1: 0, d2: 0, fifth: 0, rub: 0, trit: 0, cut: 90, lvl: 0 }, DRONE_QUIET = { d1: .3, d2: .2, fifth: 0, rub: 0, trit: 0, cut: 95, lvl: .6 };
  const DRONE_BOSS = { 1: { d1: 1, d2: .4, fifth: .2, rub: .2, trit: .25, cut: 190 }, 2: { d1: 1, d2: .45, fifth: 0, rub: .35, trit: .45, cut: 240 } };

  function runPads(p, sc, t, until) {
    const P = sc.pads; if (!P) return; const st = p.pad || (p.pad = { next: t + rr(1, 3), i: 0, v: [] });
    while (st.next < until) {
      const at = Math.max(st.next, t);
      for (const v of st.v) v.release(at, P.rel); st.v = [];
      if (!chance(P.rest)) { // otherwise: a rest the length of a chord — silence is part of the score
        const ch = P.chords[st.i % P.chords.length]; st.i += chance(.25) ? 2 : 1; if (P.vowel) vowel(P.bus, P.vowel, at, 2);
        for (const m of ch) st.v.push(P.inst === 'choir' ? choirNote(p, P.bus, m, at + rr(0, .6), { vel: P.vel, att: P.att, vib: 9 })
          : stringNote(p, P.bus, m, at + rr(0, .6), { vel: P.vel, att: P.att, n: P.n || 3, bright: P.bright, trem: P.trem, vib: 6 }));
      }
      st.next = at + rr(P.len[0], P.len[1]);
    }
  }
  function runGens(p, sc, t, until) {
    if (!sc.gens) return;
    if (!p.gt) p.gt = sc.gens.map(g => t + rr(g.first[0], g.first[1]));
    sc.gens.forEach((g, i) => { while (p.gt[i] < until) { const at = Math.max(p.gt[i], t); g.fn(p, at); p.gt[i] = at + rr(g.every[0], g.every[1]); } });
  }
  function sceneLife(p, i, t) {
    const sc = roomScore(i);
    if (p.target > 0 && !p.on) { p.on = true; p.gt = null; p.pad = null; if (sc.enter) sc.enter(p, t); }
    else if (p.target === 0 && p.on && p.level < .015) { p.on = false; if (sc.exit) sc.exit(p, t); releaseAll(p, t, .2); p.pad = null; p.gt = null; }
  }

  /* ------------------------------------------------------------------ transport: 16th steps, tempo changes on bar lines */
  const T = { bpm: 96, want: 96, step: 0, next: 0 };
  const stepDur = () => 60 / T.bpm / 4;
  function transport(t, until) {
    if (T.next < t - .05) { const sd = stepDur(), n = Math.ceil((t - T.next) / sd); T.step += n; T.next += n * sd; } // stalled frames: skip, never burst
    while (T.next < until) {
      const st = T.step, at = T.next;
      if (st % 16 === 0 && T.want !== T.bpm) T.bpm = T.want;
      onStep(st, at); T.step++; T.next += stepDur();
    }
  }
  function stepTime(st) { return T.next + (st - T.step) * stepDur(); }
  function nextStep(mod, minTime) { let st = T.step; while (st % mod || stepTime(st) < minTime) st++; return st; }

  /* ------------------------------------------------------------------ combat layer: ritual percussion + low string ostinato */
  const PROGS = [[0, 0, -4, -5], [0, 1, 0, -2], [0, 0, -4, -6], [0, -2, -4, -5]]; // bar roots over D: D D Bb A / D Eb D C / D D Bb Ab ...
  const OST = [ // [16th step, semitone, velocity]
    [[0, 0, 1], [2, 0, .55], [3, 0, .7], [4, 1, .9], [6, 0, .6], [8, 0, 1], [10, 0, .55], [11, 0, .7], [12, -2, .9], [14, -4, .7]],
    [[0, 0, 1], [3, 0, .75], [6, 0, .85], [8, 1, .9], [11, 0, .75], [14, -1, .8]],
    [[0, 0, 1], [2, 0, .6], [4, 0, .8], [6, 1, .7], [8, 0, 1], [10, 0, .6], [12, 6, .8], [14, 7, .9]]
  ];
  const DR = { // drum lanes, digit = velocity/9: L low taiko, M mid taiko, k rim, x frame-drum edge
    A: { L: '9.......7.......', M: '....6.....5..6..', k: '..3...3...3...3.', x: '.2.2.2.2.2.2.2.2' },
    B: { L: '9.....7.9.......', M: '....6.......6.5.', k: '..3...3...3..33.', x: '.2.2.2.2.2.2.2.2' },
    F: { L: '9.......9...9.9.', M: '....6.6.6.6.6676', k: '..3...3.........', x: '................' }
  };
  const lane = (s, i) => { const c = s.charCodeAt(i) - 48; return c > 0 && c <= 9 ? c / 9 : 0; };
  const CB = {}, BS = { phase: 1 };
  function hit(p, t, v) {
    const perc = dest(p, 'perc'), str = dest(p, 'strings');
    playBuf('taikoL', t, perc, { gain: .95 * v }); playBuf('boom', t, perc, { gain: .45 * v });
    playBuf('stab1', t, str, { gain: .6 * v }); playBuf('stab1', t, str, { gain: .35 * v, rate: 2 });
  }
  function combatEnter(t) { CB.start = nextStep(4, t + .02); CB.bar0 = Math.floor(CB.start / 16); CB.prog = pick(PROGS); CB.ost = pick(OST); CB.pat = DR.A; CB.ending = false; }
  function combatExit(t) { if (CB.start === undefined) return; CB.end = nextStep(4, t + .02); CB.ending = true; }
  function combatStep(p, st, t) {
    if (CB.start === undefined || st < CB.start) return;
    if (CB.ending && st >= CB.end) { // wind down on a beat: one last blow, a low held D, then the layer fades
      hit(p, t, .7); stringNote(p, 'cello', D2, t, { vel: .2, att: .05, dur: 2, rel: 2, n: 2 });
      CB.start = undefined; CB.ending = false; CB.tail = t + .15; return;
    }
    const s = st % 16, bar = Math.floor(st / 16), rel = bar - CB.bar0, pb = rel % 4;
    if (st === CB.start) hit(p, t, 1);
    if (s === 0 && st !== CB.start) { if (pb === 0) { CB.prog = pick(PROGS); CB.ost = pick(OST); } CB.pat = pb === 3 ? DR.F : chance(.6) ? DR.A : DR.B; }
    const pat = CB.pat, perc = dest(p, 'perc'), build = rel < 1 ? .6 : 1, room = S.room; let v;
    if ((v = lane(pat.L, s)) && st !== CB.start) playBuf('taikoL', t, perc, { gain: .85 * v * build, pan: rr(-.15, .15) });
    if ((v = lane(pat.M, s))) playBuf('taikoM', t, perc, { gain: .65 * v * build, pan: rr(-.4, .4) });
    if ((v = lane(pat.k, s))) playBuf('rim', t, perc, { gain: .5 * v, pan: rr(-.5, .5) });
    if ((v = lane(pat.x, s)) && rel >= 1) playBuf('tek', t, perc, { gain: .35 * v, pan: .3 });
    const root = CB.prog[pb], note = CB.ost.find(n => n[0] === s);
    if (note) {
      const m = D2 + root + note[1]; playBuf(chance(.5) ? 'stab1' : 'stab2', t, dest(p, 'strings'), { gain: .5 * note[2], rate: semi(m - D2) });
      if (note[2] >= .9) playBuf('stab1', t, dest(p, 'strings'), { gain: .2, rate: semi(m - D2 + 12) });
    }
    if (s === 0) stringNote(p, 'cello', D2 + root, t, { vel: .3, att: .25, dur: 60 / T.bpm * 4 - .15, rel: .4, n: 2, trem: .9, tremRate: 12, vib: 3 });
    // colour of the room the fight happens in
    if (room === 1 && (s === 4 || s === 12) && pb % 2 === 1) playBuf('anvil', t, perc, { gain: .2, rate: rr(.98, 1.02), pan: rr(-.3, .3) });
    if (room === 2 && s === 0 && pb % 2 === 0) { vowel('choirB', 'a', t, .05); for (const m of [D3 + root, A2 + root]) choirNote(p, 'choirB', m, t, { vel: .26, att: .08, dur: 1.1, rel: .8, vib: 5 }); }
    if (room === 3 && s % 2 === 0) { const e = (st / 2) % 7; if (e === 0 || e === 2 || e === 4) playBuf('doum', t, perc, { gain: .28 }); }
    if (room === 4 && s % 2 === 1 && chance(.2)) playBuf('bone', t, dest(p, 'far'), { gain: .18, pan: rr(-.8, .8) });
    if (s === 0 && pb === 0 && rel > 0 && chance(.5)) playBuf('chain', t, dest(p, 'far'), { gain: .3, pan: rr(-.7, .7) });
  }

  /* ------------------------------------------------------------------ boss: Zincir Celladı */
  const BD = {
    1: { L: '9.....8.9.......', M: '....7.......7.7.', k: '..4.......4...4.', a: '....8.......8...' },
    2: { L: '9...8...9...8...', M: '..6...6...6...66', k: '.3.3.3.3.3.3.3.3', a: '....8.......8.7.' }
  };
  const BOST = { 1: [0, 0, 1, 0, 0, 0, -6, -5], 2: [0, 0, 1, 0, 0, 0, 1, 0, 6, 6, 7, 6, 0, 0, -1, 0] };
  function bossBegin(t) { BS.start = nextStep(16, t + 1.1); BS.bar0 = Math.floor(BS.start / 16); BS.phase = 1; BS.pend2 = undefined; T.want = 96; setP(N.drive.gain, .5, t, .5); }
  function bossPhase2(t) { if (BS.start === undefined) bossBegin(t); BS.pend2 = nextStep(16, t + .05); T.want = 104; }
  function bossEnd(t) { if (BS.start === undefined && BS.pend2 === undefined) return; BS.start = BS.pend2 = undefined; BS.phase = 1; T.want = 96; if (BS.ch) for (const v of BS.ch) v.release(t, .8); BS.ch = null; setP(N.drive.gain, .5, t, 1); }
  function bossChoir(p, t, notes, o) { if (BS.ch) for (const v of BS.ch) v.release(t, o.cut || 1.2); BS.ch = notes.map(m => choirNote(p, 'choirB', m, t + rr(0, .08), o)); }
  function bossStep(p, st, t) {
    if (BS.pend2 !== undefined && st >= BS.pend2) { // phase 2 breaks in on a bar line
      BS.pend2 = undefined; BS.phase = 2; BS.bar0 = Math.floor(st / 16); setP(N.drive.gain, 1.7, t, .3);
      hit(p, t, 1); playBuf('plate', t, dest(p, 'perc'), { gain: .6 }); playBuf('chain', t, dest(p, 'perc'), { gain: .5 });
      for (const m of [D1, D2, Ab2]) brassNote(p, m, t, { vel: .55, att: .15, dur: 2.2, rel: 1.5, bright: 1.3 });
    }
    if (BS.start === undefined || st < BS.start) return;
    const s = st % 16, rel = Math.floor(st / 16) - BS.bar0, ph = BS.phase, D = BD[ph], perc = dest(p, 'perc'), str = dest(p, 'strings'), bar = 60 / T.bpm * 4; let v;
    if ((v = lane(D.L, s))) playBuf('taikoL', t, perc, { gain: .95 * v, pan: rr(-.1, .1) });
    if ((v = lane(D.M, s))) playBuf('taikoM', t, perc, { gain: .7 * v, pan: rr(-.4, .4) });
    if ((v = lane(D.k, s))) playBuf('rim', t, perc, { gain: .45 * v, pan: rr(-.5, .5) });
    if ((v = lane(D.a, s))) playBuf(ph === 2 && s === 14 ? 'anvil' : 'plate', t, perc, { gain: .45 * v, rate: rr(.98, 1.02), pan: rr(-.2, .2) });
    const root = ph === 1 ? [0, 0, -4, -6][rel % 4] : [0, 0, 6, 6][rel % 4];
    if (ph === 1) { if (s % 2 === 0) playBuf(chance(.5) ? 'stab1' : 'stab2', t, str, { gain: .48 * (s % 8 === 0 ? 1 : .7), rate: semi(root + BOST[1][s / 2]) }); }
    else {
      const d = BOST[2][s]; playBuf(s % 4 === 0 ? 'stab1' : 'stab2', t, str, { gain: .42 * (s % 4 === 0 ? 1 : .6), rate: semi(root + d) });
      if (s % 4 === 0) playBuf('stab1', t, str, { gain: .18, rate: semi(root + d + 12) });
    }
    if (ph === 1 && s === 0) {
      const r8 = rel % 8;
      if (r8 === 0 || r8 === 4) for (const [m, vv] of [[D2, .5], [A2, .32], [D1, .32]]) brassNote(p, m + root, t, { vel: vv, att: .9, dur: bar * 2 - .3, rel: 1.2 });
      if (r8 === 2) phrase(p, 'brass', [[D3, 2], [Eb3, 1], [D3, 1], [Ab2, 2], [A2, 2]], t, { beat: 60 / T.bpm, vel: .4, att: .25, rel: .8 });
      if (rel % 2 === 0) { vowel('choirB', rel % 4 ? 'o' : 'a', t, .6); bossChoir(p, t, [D3 + root, Eb3 + root, A2 + root + 12], { vel: .15, att: 1.2, vib: 10 }); }
      if (rel % 2 === 1) playBuf('chain', t + bar * .87, perc, { gain: .4, rate: rr(.8, 1), pan: rr(-.6, .6) });
    } else if (ph === 2 && (s === 0 || s === 8)) { // shouted cluster + tritone on beats 1 and 3
      vowel('choirB', 'a', t, .04); bossChoir(p, t, [D3 + root % 12, Eb3 + root % 12, Ab2 + 12 + root % 12], { vel: .2, att: .05, dur: bar / 2 - .08, rel: .5, vib: 14, cut: .3 });
      if (s === 0 && rel % 2 === 0) for (const m of [D1, D2, Ab2]) brassNote(p, m + root, t, { vel: .45, att: .35, dur: bar * 2 - .3, rel: 1 });
      if (s === 0 && rel % 4 === 0) for (const m of [74, 75, 80]) stringNote(p, 'hi', m, t, { vel: .09, att: .3, dur: bar * 2, rel: 1, n: 2, gliss: -700, glissAt: .5, glissTime: bar * 1.8, trem: .7, tremRate: 13, vib: 20 });
      if (s === 8 && rel % 2 === 1) playBuf('chain', t, perc, { gain: .5, rate: rr(.9, 1.1), pan: rr(-.6, .6) });
    }
  }

  /* ------------------------------------------------------------------ tension: noticed / closing in */
  function tensionRun(p, t, until) {
    const dg = S.danger;
    if (p.target > .01 && !p.sus) p.sus = [
      stringNote(p, 'hi', 74, t, { vel: .065, att: 3, n: 2, trem: .9, tremRate: 11, vib: 3 }),
      stringNote(p, 'hi', 75, t + .7, { vel: .055, att: 3, n: 2, trem: .9, tremRate: 10.3, vib: 3 }),
      stringNote(p, 'cello', D2, t, { vel: .3, att: 2, n: 2, trem: .8, tremRate: 7.5, vib: 4 })];
    if (p.target <= .01 && p.sus && p.level < .01) { for (const v of p.sus) v.release(t, .5); p.sus = null; if (p.sus3) p.sus3.release(t, .5); p.sus3 = null; }
    if (dg > .6 && p.sus && !p.sus3) p.sus3 = stringNote(p, 'hi', 80, t, { vel: .04, att: 2, n: 2, trem: .9, tremRate: 12.5, vib: 3 });
    if (dg < .45 && p.sus3) { p.sus3.release(t, 2); p.sus3 = null; }
    if (p.target > .05 && !S.combatOn && !S.boss) {
      if (!p.hb || p.hb < t - .2) p.hb = t + .1;
      while (p.hb < until) { playBuf('heart', p.hb, dest(p, 'perc'), { gain: .25 + .45 * dg }); p.hb += 60 / (54 + 40 * dg); }
    }
  }

  /* ------------------------------------------------------------------ stings */
  const LATER = [];
  function later(at, fn) { LATER.push([at, fn]); }
  function runLater(until) { for (let i = 0; i < LATER.length;) { if (LATER[i][0] < until) { const e = LATER.splice(i, 1)[0]; e[1](Math.max(e[0], ctx.currentTime)); } else i++; } }
  function stDeath(p, t) {
    playBuf('boom', t, dest(p, 'perc'), { gain: .8 }); playBuf('taikoL', t, dest(p, 'perc'), { gain: .8 });
    vowel('choirB', 'a', t, .05); vowel('choirB', 'u', t + 2.5, 1.5);
    for (const m of [D2, Eb2, Ab2, A2]) choirNote(p, 'choirB', m, t + .02, { vel: .24, att: .15, dur: 3.2, rel: 3, glide: -500, glideAt: .6, glideTime: 4, vib: 16 });
    stringNote(p, 'cello', D2, t, { vel: .24, att: .1, dur: 5, rel: 3, n: 3, gliss: -200, glissAt: 1, glissTime: 4 });
    playBuf('bellBig', t + 1.4, dest(p, 'bell'), { gain: .5 });
    playBuf('heart', t + 5.2, dest(p, 'perc'), { gain: .42 }); playBuf('heart', t + 6.7, dest(p, 'perc'), { gain: .26 }); // a heart that gives out
  }
  function stCheckpoint(p, t) { // respite: iv - V - i in D minor on soft "o", the only major third of the chapter
    oath(p, t + 1, .3);
    vowel('choirA', 'o', t, .3);
    for (const [dt, ch] of [[0, [G2, Bb2, D3]], [3.2, [A2, Cs3, E3]], [6.4, [D2, A2, D3, F3]]])
      for (const m of ch) choirNote(p, 'choirA', m, t + dt + rr(0, .2), { vel: .12, att: 1.4, dur: dt > 6 ? 5.5 : 3.1, rel: dt > 6 ? 5 : 1.6, vib: 8 });
    stringNote(p, 'strings', D2, t, { vel: .09, att: 2, dur: 11, rel: 4, n: 3, bright: .4 });
    playBuf('bellD4', t + .2, dest(p, 'bell'), { gain: .24, pan: -.2 }); playBuf('bellD4', t + 6.5, dest(p, 'bell'), { gain: .18, rate: semi(-5), pan: .25 });
  }
  function stBossStart(p, t) {
    const perc = dest(p, 'perc');
    playBuf('boom', t, perc, { gain: .8 }); playBuf('taikoL', t, perc, { gain: .95 }); playBuf('taikoL', t + .47, perc, { gain: .7 });
    playBuf('plate', t, perc, { gain: .5 }); playBuf('chain', t + .1, perc, { gain: .5 });
    for (const m of [D1, D2, Ab2]) brassNote(p, m, t, { vel: .55, att: .12, dur: 1.4, rel: 1.6, bright: 1.2 });
    vowel('choirB', 'a', t, .05); for (const m of [D3, Eb3, Ab2 + 12]) choirNote(p, 'choirB', m, t, { vel: .24, att: .1, dur: 1.3, rel: 1.5, vib: 14 });
  }
  function stVictory(p, t) { // grim requiem: Dm Bb Gm Eb Dm/A A -> open fifth; the motif resolves; something still breathes
    oath(p, t + 8, .3);
    playBuf('boom', t, dest(p, 'perc'), { gain: .55 }); playBuf('bellBig', t, dest(p, 'bell'), { gain: .6 }); playBuf('taikoL', t, dest(p, 'perc'), { gain: .7 });
    vowel('choirA', 'o', t, .3);
    const prog = [[1.5, [D2, A2, F3]], [7.5, [Bb1, F2, D3]], [13.5, [G1, D2, Bb2]], [19.5, [Eb2, G2, Bb2]], [25.5, [A1, D2, F2]], [30.5, [A1, E3 - 12, Cs3]], [35.5, [D1, D2, A2, D3]]];
    prog.forEach(([dt, ch], i) => later(t + dt, at => {
      const last = i === prog.length - 1, len = last ? 12 : prog[i + 1][0] - dt + .4;
      for (const m of ch) choirNote(p, 'choirA', m, at + rr(0, .25), { vel: .13, att: 2, dur: len, rel: last ? 7 : 2, vib: 8 });
      for (const m of ch.slice(0, 2)) stringNote(p, 'strings', m, at, { vel: .08, att: 2.2, dur: len, rel: last ? 7 : 2, n: 3, bright: .5 });
    }));
    let at = t + 3; // the motif, resolving: D Eb D A . F E D
    for (const [m, b] of [[D3, 4], [Eb3, 2], [D3, 4], [A2, 6], [null, 4], [F3, 4], [E3, 2], [D3, 8]]) { if (m) later(at, a => stringNote(p, 'cello', m, a, { vel: .17, att: .35, dur: b + .12, rel: .9, n: 2, vib: 14 })); at += b; }
    later(t + 13.5, a => toll(p, a, { vel: .35 })); later(t + 36, a => toll(p, a, { vel: .45, n: 2, gap: 4 }));
    later(t + 46, a => stringNote(p, 'cello', Eb2, a, { vel: .07, att: 3, dur: 4, rel: 4, n: 2 }));
    later(t + 47, a => { playBuf('heart', a, dest(p, 'perc'), { gain: .34 }); playBuf('heart', a + 1.4, dest(p, 'perc'), { gain: .26 }); });
  }

  /* ------------------------------------------------------------------ state machine */
  const S = {};
  let SCP = [], PT, PC, PB, PS;
  function resetState() {
    Object.assign(S, { room: -1, danger: 0, hold: 0, combatOn: false, boss: false, dead: false, won: false, paused: false, duckUntil: 0, duckAmt: 1, quietUntil: 0,
      deathAt: -99, wonAt: -1, last: {}, started: false, noRoom: 0 });
    for (const k of Object.keys(CB)) delete CB[k];
    BS.start = BS.pend2 = undefined; BS.phase = 1; BS.ch = null; T.want = T.bpm = 96;
  }
  const ROOM_NAMES = [[KabirI18n.t('kül eşiği'), 'threshold', KabirI18n.t('eşikteki mahkûmlar')], ['zincir avlusu', KabirI18n.t('zincir nöbeti'), 'courtyard'], [KabirI18n.t('çürüyen revir'), KabirI18n.t('çürüyenlerin duası'), 'infirmary'],
    ['adak salonu', 'adak ayini', 'offering'], [KabirI18n.t('kemik geçidi'), 'son alay', 'ossuary'], [KabirI18n.t('sessiz şapel'), 'chapel'], ['zincir mahkemesi', KabirI18n.t('zincir celladı'), 'executioner']];
  function resolveRoom(r) {
    if (r === null || r === undefined) return -1;
    if (typeof r === 'object') return resolveRoom(r.id !== undefined ? r.id : r.name);
    if (typeof r === 'number') return r >= 0 && r < 7 ? Math.floor(r) : -1;
    const s = String(r).trim().toLocaleLowerCase('tr'); if (/^\d+$/.test(s)) return resolveRoom(+s);
    for (let i = 0; i < 7; i++) if (ROOM_NAMES[i].indexOf(s) >= 0) return i;
    return -1;
  }
  function update(dt, s) {
    if (!ready || halted) return;
    s = s || {}; dt = clamp(+dt || 0, 0, .25); const t = ctx.currentTime;
    buildSome(offline);
    if (!S.started) { S.started = true; if (!susp) setP(N.master.gain, 1, t, .6); }
    let room = resolveRoom(s.room); const dead = !!s.dead, won = !!s.won, boss = !!s.boss && !dead && !won, phase = s.bossPhase === 2 ? 2 : 1;
    if (room < 0 && S.room >= 0 && (S.noRoom += dt) < 1.5) room = S.room; else if (room >= 0) S.noRoom = 0; // app resets roomId for a frame on respawn
    S.room = room;
    if (dead && !S.dead) sting('death');
    if (!dead && S.dead) { S.quietUntil = 0; S.hold = 0; S.danger = 0; }
    S.dead = dead;
    if (won && !S.won) sting('victory');
    if (!won && S.won) { S.wonAt = -1; LATER.length = 0; releaseAll(PS, t, 1.5); releaseShots(PS, t, .35); } // new run: fade the ending, including its future one-shot notes
    S.won = won;
    if (boss && !S.boss) { sting('bossStart'); if (BS.start === undefined) bossBegin(t); }
    if (!boss && S.boss) bossEnd(t);
    S.boss = boss;
    if (boss && phase === 2 && BS.phase === 1 && BS.pend2 === undefined) bossPhase2(t);
    S.hold = s.combat && !dead && !won ? 4.5 : S.hold - dt;
    const combatOn = S.hold > 0 && !boss && !dead && !won;
    if (combatOn && !S.combatOn) combatEnter(t);
    if (!combatOn && S.combatOn) combatExit(t);
    S.combatOn = combatOn;
    const dg = clamp(+s.danger || 0, 0, 1); S.danger += (dg - S.danger) * (1 - Math.exp(-dt / (dg > S.danger ? .7 : 3)));
    if (!!s.paused !== S.paused) { S.paused = !!s.paused; setP(N.muffle.frequency, S.paused ? 650 : 20000, t, .2); setP(N.duck.gain, S.paused ? .45 : 1, t, .25); }
    if (S.wonAt >= 0 && !won && t > S.wonAt + 60) S.wonAt = -1;
    const quiet = dead || won || t < S.quietUntil || S.wonAt >= 0, duck = t < S.duckUntil ? S.duckAmt : 1;
    for (let i = 0; i < 7; i++) { const p = SCP[i]; setPart(p, !quiet && !boss && room === i ? (combatOn ? .55 : 1) * duck : 0, quiet ? .3 : 2.2, dt); sceneLife(p, i, t); }
    setPart(PT, quiet ? 0 : Math.pow(S.danger, 1.2) * (combatOn ? .45 : 1) * (boss ? .2 : 1), quiet ? .2 : .9, dt);
    setPart(PC, !quiet && (combatOn || CB.ending || t < (CB.tail || 0)) ? 1 : 0, quiet ? .2 : combatOn ? .05 : 1.3, dt);
    setPart(PB, boss && !quiet ? .85 : 0, boss ? .2 : quiet ? .25 : 2.5, dt);
    const late = (S.wonAt >= 0 && t > S.wonAt + 50) || (dead && t > S.deathAt + 7);
    droneSet(quiet ? (late ? DRONE_QUIET : DRONE_OFF) : boss ? DRONE_BOSS[BS.phase] : room >= 0 ? roomScore(room).drone : DRONE_QUIET, t, quiet && !late ? .6 : 2.5);
    if (susp) return; // faded out: schedule nothing new
    const until = t + LOOKAHEAD;
    transport(t, until);
    for (let i = 0; i < 7; i++) { const p = SCP[i]; if (p.target > 0) { runPads(p, roomScore(i), t, until); runGens(p, roomScore(i), t, until); } }
    tensionRun(PT, t, until); runLater(until);
  }
  function onStep(st, t) {
    for (let i = 0; i < 7; i++) { const p = SCP[i], sc = roomScore(i); if (sc.steps && p.target > 0) sc.steps(p, st, t); }
    combatStep(PC, st, t); bossStep(PB, st, t);
  }
  function sting(name) {
    if (!ready || halted) return false;
    const t = ctx.currentTime;
    if (S.last[name] !== undefined && t - S.last[name] < 4) return false;
    S.last[name] = t; buildSome(true);
    if (name === 'death') { LATER.length = 0; S.deathAt = t; S.quietUntil = t + 7; bossEnd(t); CB.start = undefined; CB.ending = false; S.hold = 0; stDeath(PS, t + .03); }
    else if (name === 'checkpoint') { S.duckUntil = t + 9; S.duckAmt = .5; stCheckpoint(PS, t + .05); }
    else if (name === 'victory') { S.wonAt = t; bossEnd(t); CB.start = undefined; stVictory(PS, t + .05); }
    else if (name === 'bossStart') { stBossStart(PS, t + .03); bossBegin(t); }
    else return false;
    return true;
  }
  function init(c, o, opts) {
    if (ready && ctx === c) return true;
    if (ready) dispose();
    if (!c || !o) return false;
    offline = typeof c.startRendering === 'function';
    if (SILENT && !offline) return false;
    ctx = c; out = o; opts = opts || {}; LITE = !!opts.lite; halted = susp = false;
    rnd = mkRng(opts.seed || 7331);
    buildGraph();
    SCP = SCENES.map((sc, i) => Part('room' + i)); PT = Part('tension'); PC = Part('combat'); PB = Part('boss'); PS = Part('sting'); PS.target = PS.level = 1;
    queue = ORDER.slice(); irStep = null; buildSome(!!opts.sync);
    QA_ONLY = opts.only || null; QA_NOIR = !!opts.noIR;
    if (opts.noVerb) N.verbOut.gain.value = 0; if (opts.noComp) { N.comp.threshold.value = 0; N.comp.ratio.value = 1; } // QA only
    if (opts.solo) for (const k in I) if (opts.solo.indexOf(k) < 0) { I[k].d.gain.value = 0; I[k].s.gain.value = 0; } // QA only
    resetState(); T.step = 0; T.next = ctx.currentTime + .1;
    ready = true; return true;
  }
  function allParts() { return SCP.concat([PT, PC, PB, PS]); }
  async function prepare(progress) {
    if (!ready) return false;
    const my = ctx, total = queue.length;
    while (ctx === my && queue.length) {
      buildSome(false); if (progress) progress(total ? 1 - queue.length / total : 1);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (progress) progress(1); return ctx === my;
  }
  function dispose() {
    if (!ready) return;
    for (const v of VOICES) for (const n of v.srcs.concat(v.others)) { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) {} }
    for (const s of SHOTS) try { s.stop(); s.disconnect(); } catch (e) {}
    for (const shot of SHOT_META.values()) for (const n of shot.nodes) try { n.disconnect(); } catch (e) {}
    if (N.drone) for (const k of ['a', 'b', 's', 'fifth', 'rub', 'trit']) try { N.drone[k].o.stop(); } catch (e) {}
    if (N.drone) {
      try { N.drone.mod.stop(); } catch (e) {}
      for (const k of ['out', 'wob', 'lp', 'mod', 'modGain']) try { N.drone[k].disconnect(); } catch (e) {}
    }
    for (const bus of Object.values(I)) for (const n of Object.values(bus)) try { n.disconnect(); } catch (e) {}
    for (const k of Object.keys(N)) try { if (N[k].disconnect) N[k].disconnect(); } catch (e) {}
    for (const k of Object.keys(BUF)) delete BUF[k]; for (const k of Object.keys(I)) delete I[k]; for (const k of Object.keys(N)) delete N[k];
    VOICES.clear(); SHOTS.clear(); SHOT_META.clear(); LATER.length = 0; queue = []; irStep = null; ctx = out = null; ready = false; live = 0;
  }
  B.Music = {
    init, update, sting, prepare, dispose,
    stop() {
      if (!ready) return; const t = ctx.currentTime; halted = true;
      setP(N.master.gain, 0, t, .35); for (const v of VOICES) v.release(t + 1.5, .3);
      for (const p of allParts()) { if (p !== PS) { setPart(p, 0, .3, 0); p.on = false; p.pad = p.gt = null; } }
      if (PT) { PT.sus = PT.sus3 = null; PT.hb = 0; }
      if (SCP[3]) SCP[3].ot = null;
      LATER.length = 0; resetState();
    },
    suspend() { if (!ready) return; susp = true; setP(N.master.gain, 0, ctx.currentTime, .04); },
    resume() { if (!ready) return; const t = ctx.currentTime; halted = false; susp = false; if (S.started) setP(N.master.gain, 1, t, .3); },
    stats() { const parts = {}, pv = {}; if (ready) for (const p of allParts()) { parts[p.name] = Math.round(p.level * 1000) / 1000; if (p.voices.size) pv[p.name] = p.voices.size; } return { ready, sources: live, voices: VOICES.size, partVoices: pv, buffers: Object.keys(BUF).length, pending: queue.length, bpm: T.bpm, parts }; },
    get ready() { return ready; }
  };
})();
