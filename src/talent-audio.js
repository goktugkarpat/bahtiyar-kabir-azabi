/* KABİR AZABI — sounds of talent tree 3, pure WebAudio synthesis (no samples): ignite, seal, knell, rot burst, fire burst,
   chain lash, blood price, execution. audio.js routes every name starting with "talent" here (one line in play()):
   B.TalentAudio.play(name, ctx, dry, wet, t, k, opts, noise) — dry/wet are the effects bus and its reverb send. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const NAMES = new Set(['talentIgnite', 'talentSeal', 'talentKnell', 'talentRot', 'talentBurst', 'talentChain', 'talentChainMiss', 'talentBlood', 'talentExecute', 'talentLearn', 'talentKeystone']);
  const cache = new WeakMap();
  function noiseOf(ctx) {
    let b = cache.get(ctx); if (b) return b;
    const len = Math.floor(ctx.sampleRate * 2); b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0); let s = 987654321;
    for (let i = 0; i < len; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
    cache.set(ctx, b); return b;
  }
  function play(name, ctx, dry, wet, t, k, o, N) {
    k = (k == null ? 1 : k) * .9;
    const noise = (N && N.noise) || noiseOf(ctx);
    const out = ctx.createGain(); out.gain.value = 1; out.connect(dry);
    if (wet) { const s = ctx.createGain(); s.gain.value = .32; out.connect(s); s.connect(wet); }
    const stopAll = [];
    const g = (v, to) => { const n = ctx.createGain(); n.gain.value = v; n.connect(to || out); return n; };
    const f = (type, freq, q, to) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; if (q != null) n.Q.value = q; n.connect(to); return n; };
    const env = (gain, t0, peak, a, rel) => { gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(peak, t0 + a); gain.gain.setTargetAtTime(0, t0 + a, rel / 3.5); };
    const osc = (type, fr, t0, dur, to) => { const n = ctx.createOscillator(); n.type = type; n.frequency.setValueAtTime(fr, t0); n.connect(to); n.start(t0); n.stop(t0 + dur); stopAll.push(n); return n; };
    const hiss = (t0, dur, to, off) => { const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true; n.connect(to); n.start(t0, off || Math.random()); n.stop(t0 + dur); stopAll.push(n); return n; };
    // building blocks
    const thump = (t0, f0, f1, dur, v) => { const a = g(0); const o1 = osc('sine', f0, t0, dur + .1, a); o1.frequency.exponentialRampToValueAtTime(f1, t0 + dur * .7); env(a, t0, v * k, .005, dur); };
    const whoosh = (t0, dur, from, to, v, q) => { const a = g(0), bp = f('bandpass', from, q || .9, a); hiss(t0, dur + .1, bp); bp.frequency.setValueAtTime(from, t0); bp.frequency.exponentialRampToValueAtTime(to, t0 + dur); a.gain.setValueAtTime(0, t0); a.gain.linearRampToValueAtTime(v * k, t0 + dur * .35); a.gain.linearRampToValueAtTime(0, t0 + dur); };
    const crackle = (t0, dur, n, v, fr) => { for (let i = 0; i < n; i++) { const at = t0 + Math.random() * dur, a = g(0), hp = f('bandpass', (fr || 2600) * (.6 + Math.random()), 3, a); hiss(at, .03, hp); env(a, at, v * k * (.4 + Math.random() * .6), .001, .02); } };
    const metal = (t0, fr, v, dec, ratios) => { for (const r of ratios) { const a = g(0), o1 = osc('sine', fr * r, t0, dec + .2, a); env(a, t0, v * k / ratios.length * 2, .002, dec / (1 + r * .25)); o1.detune.value = (Math.random() - .5) * 14; } };
    switch (name) {
      case 'talentIgnite':
        whoosh(t, .38, 300, 2200, .22, 1.1); crackle(t + .05, .5, 9, .16); thump(t, 120, 60, .18, .18); break;
      case 'talentSeal':
        thump(t, 92, 34, .9, .62); whoosh(t, .7, 160, 1500, .3, .7); crackle(t + .1, 1.2, 22, .2);
        { const a = g(0), lp = f('lowpass', 220, .7, a); hiss(t, 1.6, lp); env(a, t + .05, .3 * k, .08, 1.3); }
        metal(t + .02, 74, .12, 1.4, [1, 2.4, 3.9]); break;
      case 'talentKnell': {
        // a cracked funeral bell: low inharmonic partials, a hum, a slow beat and a second, distant strike
        const strike = (t0, v) => { metal(t0, 98, v, 3.2, [.5, 1, 1.19, 1.56, 2.0, 2.74, 3.76]); thump(t0, 70, 40, .6, v * .6); const a = g(0), hp = f('highpass', 1800, .7, a); hiss(t0, .05, hp); env(a, t0, v * .4 * k, .001, .04); };
        strike(t, .3); strike(t + .62, .13);
        { const a = g(0), o1 = osc('sine', 49, t, 3.4, a), lfo = osc('sine', 3.1, t, 3.4, g(.3 * k, a.gain)); env(a, t, .09 * k, .2, 2.8); void o1; void lfo; }
        break;
      }
      case 'talentRot':
        thump(t, 140, 48, .35, .5); { const a = g(0), bp = f('bandpass', 420, 1.6, a); hiss(t, .45, bp); bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(180, t + .4); env(a, t, .42 * k, .004, .4); }
        crackle(t, .25, 7, .12, 900); whoosh(t + .02, .5, 600, 120, .12, 2); break;
      case 'talentBurst':
        thump(t, 110, 30, .8, .5); whoosh(t, .55, 900, 140, .26, .6); crackle(t, .9, 26, .22);
        { const a = g(0), lp = f('lowpass', 900, .6, a); hiss(t, 1.2, lp); env(a, t, .45 * k, .005, .9); } break;
      case 'talentChain':
      case 'talentChainMiss': {
        const n = name === 'talentChain' ? 9 : 4;
        whoosh(t, .25, 500, 3200, .2, 1.4);
        for (let i = 0; i < n; i++) metal(t + .06 + i * .028 + Math.random() * .02, 1400 + Math.random() * 900, .07, .18, [1, 1.47, 2.31]);
        if (name === 'talentChain') thump(t + .3, 90, 50, .25, .32);
        break;
      }
      case 'talentBlood':
        thump(t, 62, 40, .25, .55); thump(t + .26, 58, 38, .3, .42); { const a = g(0), bp = f('bandpass', 700, 2, a); hiss(t, .3, bp); env(a, t, .18 * k, .01, .25); } break;
      case 'talentLearn':
        // a seal pressed into hot iron: low knock, short metallic ring, a breath of sparks
        thump(t, 130, 70, .22, .4); metal(t + .01, 520, .09, .7, [1, 1.52, 2.33, 3.1]); whoosh(t, .3, 2400, 600, .08, 1.2); crackle(t + .04, .3, 6, .08); break;
      case 'talentKeystone':
        thump(t, 80, 32, .9, .55); metal(t, 147, .2, 2.4, [.5, 1, 1.2, 1.5, 2, 2.76]); whoosh(t, 1.1, 180, 1800, .14, .7); crackle(t + .2, 1.1, 18, .1);
        { const a = g(0), o1 = osc('sawtooth', 55, t, 2.4, f('lowpass', 300, .8, a)); env(a, t + .05, .08 * k, .4, 1.8); void o1; } break;
      case 'talentExecute':
        whoosh(t, .16, 1200, 5200, .3, 2); thump(t + .05, 150, 40, .4, .55); metal(t + .04, 420, .12, .5, [1, 2.1, 3.3]); crackle(t + .05, .1, 5, .18, 1500); break;
    }
    const end = t + 4;
    const cleanup = () => { try { out.disconnect(); } catch (_) { /* gone */ } };
    if (stopAll.length) stopAll[stopAll.length - 1].onended = () => setTimeout(cleanup, Math.max(0, (end - ctx.currentTime) * 1000));
    return 4;
  }
  B.TalentAudio = Object.freeze({ has: name => NAMES.has(name), play, names: Array.from(NAMES) });
}());
