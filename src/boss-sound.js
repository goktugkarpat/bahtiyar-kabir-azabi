/* KABİR AZABI — heavy boss sound layers (ajan: bosses). WebAudio synthesis only (no samples, no licences).
   Contract: BABA.BossSound.play(ctx, dry, wet, t, k, opts, noise) — called by audio.js H.bossLayer (so mute, ?sessiz, volume and the
   effects bus all apply). opts = { kind: 'chain'|'tide'|'crystal'|'forge', size: 'intro'|'phase'|'cast'|'fall' }.
   Every layer: a sub-bass drop (felt more than heard), a body crack, and one identity layer per boss:
     chain   inharmonic iron ring (struck chain / bell-metal partials)          tide     low-passed surge swelling and receding
     crystal glassy high partials with slow beating                             forge    roaring band-passed furnace breath + crackle */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var SIZE = { intro: 1, phase: 1, cast: .45, fall: 1.25 };
  function play(ctx, dry, wet, t, k, opts, noise) {
    opts = opts || {}; var s = (SIZE[opts.size] || .6) * (k == null ? 1 : k), nodes = [];
    function g(v, to) { var n = ctx.createGain(); n.gain.value = v; if (to) n.connect(to); nodes.push(n); return n; }
    function f(type, fr, q, to) { var n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = fr; if (q != null) n.Q.value = q; if (to) n.connect(to); return n; }
    function env(gn, t0, peak, a, rel) { gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(peak, t0 + a); gn.gain.setTargetAtTime(0, t0 + a, rel / 3.2); }
    function osc(type, fr, t0, t1, to) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.connect(to); o.start(t0); o.stop(t1); return o; }
    function nz(buf, t0, t1, to) { if (!buf) return null; var b = ctx.createBufferSource(); b.buffer = buf; b.loop = true; b.connect(to); b.start(t0, Math.random() * .5); b.stop(t1); return b; }
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .35; comp.connect(dry);
    var out = g(.55 * s, comp), send = wet ? g(.28, wet) : null, air = g(1, out); if (send) air.connect(send);
    var white = noise && noise.white, pink = noise && noise.pink || white, long = opts.size === 'fall' ? 1.6 : 1;
    // 1. sub drop
    var sg = g(0, out), so = osc('sine', 78, t, t + 2.4 * long, sg); so.frequency.setValueAtTime(78, t); so.frequency.exponentialRampToValueAtTime(29, t + 1.1 * long); env(sg, t, .95, .012, 1.5 * long);
    // 2. body crack (noise through a falling low-pass)
    var cg = g(0, air), cl = f('lowpass', 2400, .8, cg); cl.frequency.setValueAtTime(2400, t); cl.frequency.exponentialRampToValueAtTime(180, t + .5); nz(white, t, t + .9, cl); env(cg, t, .55, .004, .45);
    // 3. identity
    var kind = opts.kind, i;
    if (kind === 'chain') {
      var parts = [211, 347, 529, 788, 1093];
      for (i = 0; i < parts.length; i++) { var pg = g(0, air), po = osc('sine', parts[i] * (.98 + Math.random() * .04), t + .02, t + 3.2, pg); env(pg, t + .02, .07 / (1 + i * .35), .003, (2.6 - i * .3) * long); }
      var rg = g(0, air), rb = f('bandpass', 1400, 6, rg); nz(white, t + .05, t + .5, rb); env(rg, t + .05, .25, .002, .25);
    } else if (kind === 'tide') {
      var tg = g(0, air), tl = f('lowpass', 300, .7, tg); tl.frequency.setValueAtTime(300, t); tl.frequency.linearRampToValueAtTime(1100, t + .9); tl.frequency.linearRampToValueAtTime(260, t + 2.6 * long);
      nz(pink, t, t + 3 * long, tl); tg.gain.setValueAtTime(0, t); tg.gain.linearRampToValueAtTime(.6, t + .8); tg.gain.setTargetAtTime(0, t + 1.1, .6 * long);
      var bg = g(0, air), bo = osc('triangle', 98, t, t + 2.5, bg); env(bg, t + .1, .12, .3, 1.6);
    } else if (kind === 'crystal') {
      var cp = [1318, 1975, 2637, 3520];
      for (i = 0; i < cp.length; i++) { var xg = g(0, air), xo = osc('sine', cp[i], t + i * .04, t + 3, xg), xo2 = osc('sine', cp[i] * 1.006, t + i * .04, t + 3, xg); env(xg, t + i * .04, .05, .003, 2.2 * long); }
      var hg = g(0, air), hb = f('highpass', 3000, .7, hg); nz(white, t, t + .3, hb); env(hg, t, .18, .002, .12);
    } else {
      var fg = g(0, air), fb = f('bandpass', 220, 1.2, fg); nz(pink, t, t + 2.8 * long, fb); fb.frequency.setValueAtTime(160, t); fb.frequency.linearRampToValueAtTime(420, t + .7); fb.frequency.linearRampToValueAtTime(140, t + 2.4 * long);
      fg.gain.setValueAtTime(0, t); fg.gain.linearRampToValueAtTime(.9, t + .25); fg.gain.setTargetAtTime(0, t + .6, .55 * long);
      for (i = 0; i < 6; i++) { var kg = g(0, air), kb = f('highpass', 2500, .8, kg), tt = t + .1 + Math.random() * .9; nz(white, tt, tt + .05, kb); env(kg, tt, .16, .001, .03); }
    }
  }
  B.BossSound = { play: play };
}());
