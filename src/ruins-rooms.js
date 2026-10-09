/* KABİR AZABI — III: Sessiz Taht. The identity of each of the fourteen rooms: cold ash-grey mortuary city under moon shafts, warm torch-lit tombs,
   a luminous crystal cavern, the swallowed palace and the gold-lit court. Everything here is built once (ruins-kit.js bakes it); collision comes from
   ruins-world.js and the props below sit exactly on those footprints. */
(function () {
  'use strict';
  var B = window.BABA, PI = Math.PI;
  var COLD = [.84, .9, 1.04], ASH = [.9, .9, .93], WARM = [1.1, .94, .8], CRIM = [1.1, .84, .8], CAVEC = [.82, .95, 1.0], CAVEV = [.9, .85, 1.1], CAVEG = [.86, 1.02, .92], GOLD = [1.16, 1.02, .8], WHITE = [1.05, 1.03, 1.0];

  var moodBase = { fog: '#0c0e12', fogDensity: 0.0102, mist: '#141820', mistA: 0.084, mistH: .7, mistGlow: 0.325, scatter: 0.4875, wind: [.025, -.015], sky: '#9eacb8', ground: '#302e2b', hemi: .85, env: .28, key: '#b2bfd0', keyI: 1.65, keyDir: [-12, 24, -8],
    rim: '#7a9abc', rimI: 1.15, charRim: '#c3d4df', charRimI: 1.3, rimDir: [.4, .6, -1], rimWrap: 1, charFill: .23, lift: [.003, .005, .008], gain: [1, 1.03, 1.07], sat: .82, contrast: .2, shadowTint: [.9, 1, 1.1], highTint: [1.08, 1.02, .9],
    vignette: .5, vigColor: [.005, .005, .01], bloom: 0.285, bloomTint: [.94, 1, 1.05], exposure: 1.25 };
  var moodSpecs = [
    { key: '#a9bde0', keyI: 1.75, sky: '#a8b8d0', hemi: .92, fog: '#0b0e15', gain: [.98, 1.02, 1.1], sat: .78, mistA: 0.091 },
    { key: '#a4b8e0', keyI: 1.7, sky: '#a2b4d2', hemi: .9, fog: '#0a0d16', gain: [.97, 1.02, 1.12], sat: .78, mistA: 0.119, mist: '#151922' },
    { key: '#c8c6d4', keyI: 1.6, sky: '#b0aeb8', fog: '#12100f', mist: '#1d1917', mistA: 0.147, gain: [1.03, 1.0, 1.03], sat: .8, ground: '#322d2a' },
    { key: '#e0b88a', keyI: 1.5, sky: '#b8a08a', ground: '#3a2d24', hemi: .82, fog: '#120d0a', mist: '#271b12', mistA: 0.105, gain: [1.1, 1, .9], highTint: [1.14, 1.02, .84], sat: .92, bloom: 0.345, rim: '#c88050', rimI: 1.1 },
    { key: '#dca08c', keyI: 1.45, sky: '#aa8a82', ground: '#341f1c', fog: '#140b0a', mist: '#2a1512', mistA: 0.112, gain: [1.1, .97, .9], vignette: .6, sat: .88, rim: '#c06a50', bloom: 0.33 },
    { key: '#d0c6b0', keyI: 1.55, sky: '#b0a898', fog: '#15130f', mist: '#2c261d', mistA: 0.189, gain: [1.04, 1.01, .96], sat: .8, hemi: .95, bloom: 0.315 },
    { key: '#9fc4cc', keyI: 1.35, sky: '#8ea8b4', ground: '#242a2c', fog: '#0a1012', mist: '#122428', mistA: 0.161, gain: [.96, 1.04, 1.07], sat: .8, hemi: .86, rim: '#6ab0b8' },
    { key: '#80b2dc', keyI: 1.2, sky: '#7094c4', ground: '#241c34', hemi: 1.0, env: .4, fog: '#07101a', mist: '#0e2432', mistA: 0.119, mistGlow: 0.3575, bloom: 0.375, gain: [.93, 1.06, 1.16], highTint: [.94, 1.06, 1.16], shadowTint: [.9, .95, 1.26], sat: 1.0, vignette: .55, rim: '#6a9ee0', charRim: '#a8d0f0' },
    { key: '#9496d0', keyI: 1.15, sky: '#7274a8', ground: '#1f1a30', fog: '#0a0814', mist: '#1a1530', mistA: 0.196, mistGlow: 0.52, bloom: 0.405, gain: [1.0, .97, 1.12], sat: .9, rim: '#8a70d0', hemi: .92 },
    { key: '#94c8b4', keyI: 1.2, sky: '#7ca494', ground: '#1c2a24', fog: '#08100d', mist: '#112219', mistA: 0.217, mistGlow: 0.455, gain: [.95, 1.08, 1.02], sat: .88, bloom: 0.36, rim: '#58a890' },
    { key: '#e0c492', keyI: 1.45, sky: '#a89674', ground: '#3a3024', fog: '#100c08', mist: '#261d12', mistA: 0.14, gain: [1.07, 1.02, .93], sat: .95, bloom: 0.39, hemi: .9, rim: '#c89050' },
    { key: '#f0d8a4', keyI: 1.6, sky: '#c8b08a', ground: '#403424', hemi: 1.02, fog: '#14100a', mist: '#2e2314', mistA: 0.119, mistGlow: 0.6175, bloom: 0.495, exposure: 1.34, vignette: .42, sat: 1.0, gain: [1.1, 1.03, .9], highTint: [1.14, 1.04, .84], rim: '#e0a860', charRim: '#f0dcb4' },
    { key: '#ecca8c', keyI: 1.55, sky: '#b8a07c', ground: '#382c20', hemi: .92, fog: '#120d08', mist: '#2a1f12', mistA: 0.126, gain: [1.05, 1.01, .94], bloom: 0.39, vignette: .5, sat: .86, rim: '#d89a58', shadowTint: [.92, .98, 1.14], gain: [1.05, 1.01, .94] },
    { key: '#f4d294', keyI: 1.7, sky: '#b49e82', ground: '#2c2234', hemi: .95, fog: '#0e0a10', mist: '#22171c', mistA: 0.133, mistGlow: 0.5525, gain: [1.06, 1.01, .94], shadowTint: [.9, .94, 1.22], highTint: [1.15, 1.04, .84], contrast: .24, vignette: .56, bloom: 0.465, sat: 1.0, exposure: 1.3, rim: '#e0a050', charRim: '#f4dcb0' }
  ];

  function dress(K, r, i, info) {
    var S = K.SPR, R = K.rng(i, 5);
    // additive floor decals are not alpha-weighted (HDR, untonemapped): scale their colour so rune circles and mosaics never glare
    function DEC(id, cell, x, z, w, d, rot, col, alpha, mode, y) { if (mode === 'glow' && col) col = [col[0] * .55, col[1] * .55, col[2] * .55]; return K.dec(id, cell, x, z, w, d, rot, col, alpha, mode, y); }
    function X(x) { return r.x + x; } function Z(z) { return r.z + z; }
    function dust(n, col, a, h0, h1, rad) { for (var k = 0; k < n; k++) K.spr(i, S.mote, X((R() - .5) * (r.w - 3)), h0 + R() * (h1 - h0), Z((R() - .5) * (r.d - 3)), .05, .05, col, a, R(), .35 + R() * .5, rad || 1.8); }
    function shaft(x, z, col, a, w, h, light) {
      K.spr(i, S.beam, X(x), 0, Z(z), w, h || 9, col, a, R(), 1, 1);
      K.spr(i, S.pool, X(x), .14, Z(z), w * 2.4, w * 2.4, [col[0] * .8, col[1] * .8, col[2] * .8], a * .9, R(), 1, 1);
      if (light) K.light(i, X(x), 3.2, Z(z), light.color, light.intensity || 16, 13, { scatter: .15, glow: 1.5, flicker: .04 });
    }
    function decals(o) {
      var rr = R, k, d;
      for (k = 0; k < (o.cracks || 0); k++) DEC(i, 0, X((rr() - .5) * (r.w - 4)), Z((rr() - .5) * (r.d - 4)), 3.5 + rr() * 2.5, 3.5 + rr() * 2.5, rr() * 6.28, [1, 1, 1], .9);
      for (k = 0; k < (o.fissures || 0); k++) DEC(i, 1, X((rr() - .5) * (r.w - 6)), Z((rr() - .5) * (r.d - 6)), 6 + rr() * 3, 6 + rr() * 3, rr() * 6.28, [1, 1, 1], .95);
      for (k = 0; k < (o.soot || 0); k++) DEC(i, 3, X((rr() - .5) * (r.w - 2)), Z((rr() - .5) * (r.d - 2)), 4 + rr() * 4, 4 + rr() * 4, rr() * 6.28, [1, 1, 1], .8);
      for (k = 0; k < (o.rubble || 0); k++) DEC(i, 4, X((rr() - .5) * (r.w - 4)), Z((rr() - .5) * (r.d - 4)), 2.5 + rr() * 2.5, 2.5 + rr() * 2.5, rr() * 6.28, o.rubbleTint || [.55, .54, .52], .95);
      for (k = 0; k < (o.blood || 0); k++) DEC(i, 2, X((rr() - .5) * (r.w - 6)), Z((rr() - .5) * (r.d - 6)), 2.5 + rr() * 2.5, 2.5 + rr() * 2.5, rr() * 6.28, [1, 1, 1], .9, 'wet');
      for (k = 0; k < (o.bones || 0); k++) DEC(i, 11, X((rr() - .5) * (r.w - 6)), Z((rr() - .5) * (r.d - 6)), 2 + rr() * 1.5, 2 + rr() * 1.5, rr() * 6.28, [.55, .5, .42], .85);
      for (k = 0; k < (o.puddles || 0); k++) DEC(i, 9, X((rr() - .5) * (r.w - 6)), Z((rr() - .5) * (r.d - 6)), 3 + rr() * 2.5, 3 + rr() * 2.5, rr() * 6.28, [1, 1, 1], .92, 'wet');
      for (k = 0; k < (o.roots || 0); k++) DEC(i, 12, X((rr() - .5) * (r.w - 4)), Z((rr() - .5) * (r.d - 4)), 4.5 + rr() * 2, 4.5 + rr() * 2, rr() * 6.28, [1, 1, 1], .8);
      if (o.wear) DEC(i, 10, X(0), Z(0), 5, r.d - 1, 0, o.wear, .9);
    }
    // side walls, columns on the collision footprints, north facade with the gate towards the next room
    function arcade(tint, o) {
      o = o || {};
      [-1, 1].forEach(function (s) {
        var nook = B.WorldARuins && B.WorldARuins.nook && B.WorldARuins.nook[i] === s;   // ajan:world-a: a doorway into a side nook
        if (nook) { var nl = (r.d + .2 - 4) / 2; [-1, 1].forEach(function (k) { K.wall(i, X(s * (r.w / 2 + .45)), Z(k * (2 + nl / 2)), nl, .9, o.wallH || 6.6, false, -s, 0, { tint: tint, ruin: o.ruin == null ? .35 : o.ruin, niche: true, pil: 5.2 }); }); }
        else K.wall(i, X(s * (r.w / 2 + .45)), Z(0), r.d + .2, .9, o.wallH || 6.6, false, -s, 0, { tint: tint, ruin: o.ruin == null ? .35 : o.ruin, niche: true, pil: 5.2 });
        for (var n = 0; n < 4; n++) {
          var z = (n - 1.5) * 5.2, h = [4.6, 3.5, 5.3, 2.7][(n + i + (s > 0 ? 1 : 0)) % 4], broken = ((n + i + (s > 0 ? 0 : 2)) % 3 === 2) || o.broken;
          K.column(i, X(s * (r.w / 2 - 2.2)), Z(z), h, 1.15, 'stone', { tint: tint, broken: broken, cut: R() * .25 });
          if (!broken && o.lintel) K.put(i, 'box', 'stone', X(s * (r.w / 2 - 1.1)), h + .55, Z(z + 2.6), 1.0, .5, 5.2, 0, 0, 0, tint, .2);
          if (n % 2 === 0) { K.put(i, 'block', 'stone', X(s * (r.w / 2 - 2.8)), .3, Z(z + 1.2), 2.4, .6, 1.5, .3 * s, 0, 0, tint, .5); }
        }
      });
    }
    function facade(tint, o) {
      o = o || {}; var zf = r.z - r.d / 2 - .75, h = o.h || 7.2;
      var op = B.WorldARuins && B.WorldARuins.open && B.WorldARuins.open[i] || 3.9;   // ajan:world-a: open forecourt
      var lx0 = r.x - r.w / 2 - .9, lx1 = -op, rx0 = op, rx1 = r.x + r.w / 2 + .9;
      K.wall(i, (lx0 + lx1) / 2, zf, lx1 - lx0, 1.3, h, true, 0, 1, { tint: tint, ruin: o.ruin == null ? .25 : o.ruin, niche: true, pil: 4.6 });
      K.wall(i, (rx0 + rx1) / 2, zf, rx1 - rx0, 1.3, h, true, 0, 1, { tint: tint, ruin: o.ruin == null ? .25 : o.ruin, niche: true, pil: 4.6 });
      if (!o.noGate && op <= 3.9) {   // ajan:world-a: an opened forecourt has no gate left
        [-1, 1].forEach(function (s) {
          var ph = Math.min(h + .6, 7.4);
          K.put(i, 'box', 'wall', s * 4.75, ph / 2, zf + .4, 1.7, ph, 1.9, 0, 0, 0, mulT(tint, [1.05, 1.05, 1.05]), .5, 3.5);
          K.put(i, 'box', 'stone', s * 4.75, ph + .25, zf + .4, 2.3, .5, 2.5, 0, 0, 0, tint, .2);
          K.put(i, 'box', 'stone', s * 4.75, .3, zf + .4, 2.3, .6, 2.5, 0, 0, 0, tint, .6);
        });
        K.arch(i, 0, zf + .4, 3.85, o.spring || 3.0, { tint: tint, depth: 1.5, gap: o.gap });
      }
    }
    function mulT(a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
    // wall torches on the inner faces of both side walls (flame + glow sprites; the middle ones also feed the pooled light)
    function sconces(zs, o) { o = o || {}; [-1, 1].forEach(function (s) { zs.forEach(function (z, q) { K.sconce(i, X(s * (r.w / 2 - .12)), o.y || 2.5, Z(z), -s, 0, { col: o.col, light: q === 1 && o.light !== false, lightColor: o.lightColor, intensity: o.intensity || 18 }); }); }); }
    // props that stand on the four tomb footprints (+-8, +-4)
    function slot(sx, sz, type, tint, o) {
      var x = X(sx * 8), z = Z(sz * 4); o = o || {};
      if (type === 'sarc') { K.put(i, 'box', 'stone', x, .12, z, 2.4, .24, 3.6, 0, 0, 0, tint, .5); K.sarcophagus(i, x, z, 0, { tint: tint, broken: o.broken, len: 3.1, wid: 1.4 }); if (o.statue) K.statue(i, x, z, 0, { tint: tint, s: .5, pose: 1 }); }
      else if (type === 'statue') { K.put(i, 'box', 'stone', x, .35, z, 2.2, .7, 2.2, 0, 0, 0, tint, .5); K.statue(i, x, z, sx > 0 ? -PI / 2 : PI / 2, { tint: tint, pose: o.pose || 0, s: .78 * (o.s || 1) }); }
      else if (type === 'rubble') { K.rubble(i, x, z, 1.7, 15, 1.7, 'stone', tint, R); K.put(i, 'block', 'wall', x, .5, z, 1.6, 1.0, 2.6, R() * 3, .1, .2, tint, .5); }
      else if (type === 'fallen') { K.put(i, 'column', 'stone', x, .66, z, 1.3, 3.5, 1.3, 0, PI / 2, 0, tint, .6); K.put(i, 'block', 'stone', x, .3, z + 1.2, 1.7, .6, 1.2, .3, 0, 0, tint, .6); K.rubble(i, x + sx * .6, z - 1.1, .9, 5, .7, 'stone', tint, R); }
      else if (type === 'wagon') {
        K.put(i, 'box', 'wood', x, .75, z, 1.8, .22, 3.0, .08, 0, 0, [.5, .42, .36], .5); K.put(i, 'box', 'wood', x - .85, 1.15, z - .1, .14, .8, 2.9, .08, .1, 0, [.5, .42, .36], .5); K.put(i, 'box', 'wood', x + .85, 1.0, z + .2, .14, .5, 2.4, .08, -.2, .3, [.5, .42, .36], .5);
        K.put(i, 'rim', 'iron', x - 1.0, .8, z + .9, 1.5, 1.5, 1.5, PI / 2, 0, 0, [.7, .66, .6], .3); K.put(i, 'rim', 'iron', x + 1.0, .5, z - .8, 1.5, 1.5, 1.5, PI / 2, .4, .3, [.7, .66, .6], .3); K.put(i, 'cyl', 'wood', x + .8, .3, z + 1.7, .18, 2.2, .18, 0, PI / 2, .7, [.45, .38, .32], .5);
        K.rubble(i, x, z, 1.4, 8, .5, 'stone', tint, R);
      }
      else if (type === 'altar') { K.put(i, 'box', 'stone', x, .45, z, 2.1, .9, 3.2, 0, 0, 0, tint, .5); K.put(i, 'box', 'stone', x, .96, z, 2.3, .16, 3.4, 0, 0, 0, tint, .3); K.brazier(i, x, z, { s: .7, lightColor: o.lightColor, intensity: o.intensity, solid: false }); }
      else if (type === 'milestone') { K.put(i, 'box', 'stone', x, .9, z, 1.1, 1.8, .9, .3, 0, 0, tint, .5); K.put(i, 'block', 'stone', x, 1.95, z, .9, .5, .7, .3, 0, .2, tint, .3); K.rubble(i, x, z, 1.5, 9, .5, 'stone', tint, R); }
    }

    var ROOM = [];
    /* 0 Kıyının Ardındaki Yol — the ash road behind the coast: moon-blue, wind, a broken gate */
    ROOM[0] = function () {
      var t = COLD; K.floor(i, r, { tint: [.78, .84, .96], vary: .17, cols: 11, rows: 8, skip: function (x, z) { return Math.abs(x) > 4.4 && R() < .22; } });
      arcade(t, { ruin: .5, lintel: false }); facade(t, { gap: [5, 8], ruin: .5, spring: 3.0 });
      slot(1, -1, 'wagon', t); slot(-1, -1, 'rubble', t); slot(1, 1, 'milestone', t); slot(-1, 1, 'fallen', t);
      K.put(i, 'block', 'stone', X(-2.4), 1.2, Z(-12.6), 1.2, .9, 1.2, .5, .6, .5, t, .3);
      decals({ cracks: 9, fissures: 3, soot: 6, rubble: 7, wear: [.7, .72, .78] }); DEC(i, 3, X(-3), Z(2), 11, 7, .4, [1, 1, 1], .5);
      shaft(-6, 3, [.45, .62, 1.05], .26, 2.2, 10, { color: 0x9ab6ff, intensity: 18 }); shaft(5.5, -5, [.45, .62, 1.05], .22, 1.9, 10, { color: 0x9ab6ff, intensity: 14 });
      K.brazier(i, X(-5), Z(-9), { s: .85, col: [1.3, .62, .3], intensity: 22 }); K.brazier(i, X(5), Z(-9), { s: .85, col: [1.3, .62, .3], intensity: 22 });
      dust(36, [.8, .9, 1.1], .5, .4, 4, 2.2);
    };
    /* 1 Yitik Sütunlar — the lost colonnade: a long arcade, fallen shafts, a giant arch */
    ROOM[1] = function () {
      var t = [.82, .9, 1.06]; K.floor(i, r, { tint: [.8, .86, .98], vary: .16, cols: 10, rows: 8 });
      arcade(t, { ruin: .3, lintel: true }); facade(t, { noGate: true });
      K.arch(i, 0, Z(-8), 4, 2.8, { tint: t, depth: 1.4 }); [-1, 1].forEach(function (s) { K.column(i, X(s * 4) - r.x, Z(-8), 3.1, 1.1, 'stone', { tint: t }); });
      slot(1, -1, 'fallen', t); slot(-1, -1, 'statue', t, { pose: 2 }); slot(1, 1, 'statue', t, { pose: 0 }); slot(-1, 1, 'fallen', t);
      [-1, 1].forEach(function (s) { for (var q = 0; q < 3; q++) K.rubble(i, X(s * 10.2), Z(-6 + q * 6), 1.2, 7, .45, 'stone', t, R); });
      decals({ cracks: 8, fissures: 3, soot: 5, rubble: 7, wear: [.7, .72, .8] });
      shaft(-4, -2, [.45, .62, 1.05], .24, 2.3, 10, { color: 0x9ab6ff, intensity: 18 }); shaft(6.5, 4, [.45, .62, 1.05], .2, 2, 10);
      K.brazier(i, X(-8.5), Z(7.5), { s: .8, col: [1.2, .6, .3], intensity: 20 }); K.brazier(i, X(8.5), Z(-8), { s: .8, col: [1.2, .6, .3], intensity: 20 });
      dust(32, [.8, .9, 1.1], .5, .4, 4.5, 2.2);
    };
    /* 2 Kül Kapısı — the ash gate: towers, a half-raised portcullis, braziers, falling ash */
    ROOM[2] = function () {
      var t = ASH; K.floor(i, r, { tint: [.86, .86, .9], vary: .15, cols: 10, rows: 8, zone: function (x, z) { return Math.abs(x) < 3.5 && z < -3 ? [.8, .78, .78] : null; } });
      arcade(t, { ruin: .25 }); facade(t, { h: 7, spring: 3.2 });
      var TX = B.WorldARuins && B.WorldARuins.open && B.WorldARuins.open[i] ? 13.4 : 9.6;   // ajan:world-a: towers step aside for the open forecourt
      [-1, 1].forEach(function (s) { if (TX > 10) K.solid(X(s * TX), Z(-12.4), 5, 3.6); var TH = TX > 10 ? .5 : 1;   // opened: the towers have fallen to half their height, rubble at their feet
        K.put(i, 'box', 'wall', X(s * TX), 3.7 * TH, Z(-12.4), 5.0, 7.4 * TH, 3.6, 0, 0, 0, t, .5, 4); if (TH < 1) { K.rubble(i, X(s * TX - s * 1.6), Z(-10.6), 1.8, 14, 1.2, 'stone', t, R); K.put(i, 'crag', 'stone', X(s * TX), 3.9, Z(-12.4), 5.2, 1.0, 3.8, R() * 3, 0, 0, t, .3); }
        else { K.put(i, 'box', 'stone', X(s * TX), 7.6, Z(-12.4), 5.6, .6, 4.2, 0, 0, 0, t, .2); for (var q = 0; q < 5; q++) K.put(i, 'box', 'stone', X(s * TX + (q - 2) * 1.1), 8.1, Z(-12.4), .6, .6, 4.2, 0, 0, 0, t, 0); } });
      if (!(B.WorldARuins && B.WorldARuins.open && B.WorldARuins.open[i])) for (var q = -3; q <= 3; q++) { K.put(i, 'cyl', 'iron', q * .95, 5.2, Z(-12.2), .16, 2.2, .16, 0, 0, 0, [.7, .68, .66], .1); K.put(i, 'cone4', 'iron', q * .95, 3.95, Z(-12.2), .24, .5, .24, PI / 4, PI, 0, [.7, .68, .66], .1); }
      if (!(B.WorldARuins && B.WorldARuins.open && B.WorldARuins.open[i])) K.put(i, 'box', 'iron', 0, 6.4, Z(-12.2), 7, .2, .24, 0, 0, 0, [.7, .68, .66], .1); if (!(B.WorldARuins && B.WorldARuins.open && B.WorldARuins.open[i])) K.put(i, 'box', 'iron', 0, 4.6, Z(-12.2), 7, .14, .2, 0, 0, 0, [.7, .68, .66], .1);
      slot(1, -1, 'statue', t, { pose: 3 }); slot(-1, -1, 'statue', t, { pose: 3 }); slot(1, 1, 'rubble', t); slot(-1, 1, 'rubble', t);
      K.brazier(i, X(-4.6), Z(-9.6), { s: 1.05, col: [1.5, .66, .24], intensity: 36 }); K.brazier(i, X(4.6), Z(-9.6), { s: 1.05, col: [1.5, .66, .24], intensity: 36 });
      decals({ cracks: 8, fissures: 2, soot: 12, rubble: 6, blood: 2, wear: [.7, .7, .72] });
      for (var k = 0; k < 14; k++) K.spr(i, S.smoke, X((R() - .5) * 24), .3, Z((R() - .5) * 18), 2.4, 2.4, [.34, .33, .33], .14, R(), .08 + R() * .06, 3.5);
      sconces([-7, 0, 7], { col: [1.4, .6, .24] });
      dust(30, [.9, .86, .8], .45, .4, 5, 2.4);
    };
    /* 3 Kralların Mezarları — warm torch-lit royal tombs, sarcophagi, mausoleum portico, gold rune circle */
    ROOM[3] = function () {
      var t = WARM; K.floor(i, r, { tint: [1.0, .9, .78], vary: .12, cols: 10, rows: 8, zone: function (x, z) { var d = Math.hypot(x, z); return d < 3.4 ? [1.15, 1.05, .9] : null; } });
      arcade(t, { ruin: .15, lintel: true }); facade(t, { noGate: true, h: 7.6 });
      [-1, 1].forEach(function (s) { [4.3, 7.4].forEach(function (cx, q) { K.column(i, X(s * cx) - r.x, Z(-11.1), 5.0, 1.2, 'stone', { tint: t }); }); });
      K.put(i, 'box', 'stone', 0, 5.7, Z(-11.1), 17.4, .8, 1.9, 0, 0, 0, t, .2); K.put(i, 'box', 'stone', 0, 6.3, Z(-11.1), 18.2, .5, 2.2, 0, 0, 0, t, .1);
      K.put(i, 'wedge', 'stone', -4.2, 7.2, Z(-11.1), 8.4, 1.4, 1.7, 0, 0, 0, t, .1); K.put(i, 'wedge', 'stone', 4.2, 7.2, Z(-11.1), 8.4, 1.4, 1.7, PI, 0, 0, t, .1);
      slot(1, -1, 'sarc', t, { statue: true }); slot(-1, -1, 'sarc', t, { statue: true }); slot(1, 1, 'sarc', t); slot(-1, 1, 'sarc', t, { broken: true });
      DEC(i, 5, X(0), Z(0), 9, 9, 0, [.8, .52, .2], .6, 'glow'); DEC(i, 5, X(0), Z(0), 9, 9, 0, [.9, .72, .45], .5);
      decals({ cracks: 5, fissures: 1, soot: 5, rubble: 4, wear: [.8, .7, .6] });
      K.brazier(i, X(-6.2), Z(-5), { s: 1.1, col: [1.5, .62, .2], intensity: 34 }); K.brazier(i, X(6.2), Z(-5), { s: 1.1, col: [1.5, .62, .2], intensity: 34 }); K.brazier(i, X(-4.8), Z(8), { s: .9, col: [1.5, .62, .2], intensity: 28 }); K.brazier(i, X(4.8), Z(8), { s: .9, col: [1.5, .62, .2], intensity: 28 });
      for (var k = 0; k < 7; k++) { var cx = X((R() - .5) * 18), cz = Z((R() - .5) * 14); if (Math.abs(cx - r.x) > 6) { K.put(i, 'cyl', 'stone', cx, .14, cz, .12, .28, .12, 0, 0, 0, [1.2, 1.1, .9], 0); K.spr(i, S.flame, cx, .3 + .2, cz, .07, .2, [1.5, .7, .25], 1, R(), 1, 1); K.spr(i, S.glow, cx, .5, cz, .5, .5, [.5, .24, .08], .7, R(), 1, 1); } }
      sconces([-7, 0, 7], { col: [1.5, .62, .2] });
      dust(28, [1.1, .9, .7], .5, .4, 3.5, 2);
    };
    /* 4 Yemin Bozan Avlu — the oathbreakers' court: blood circle, chains, kneeling statues, broken tablet */
    ROOM[4] = function () {
      var t = CRIM; K.floor(i, r, { tint: [1.0, .84, .8], vary: .15, cols: 10, rows: 8, zone: function (x, z) { return Math.hypot(x, z) < 3.3 ? [.8, .62, .6] : null; } });
      arcade(t, { ruin: .2 }); facade(t, { h: 7, spring: 3.0 });
      K.put(i, 'box', 'stone', X(0), 1.35, Z(-9.5), 5, 2.7, 1.2, 0, 0, 0, t, .5, 3); K.put(i, 'block', 'stone', X(-1.1), 3.1, Z(-9.5), 2.2, 1.7, .9, .1, 0, -.12, t, .3); K.put(i, 'block', 'stone', X(1.3), 3.05, Z(-9.4), 2.0, 1.2, .9, -.15, .08, .2, t, .3); K.put(i, 'box', 'stone', X(0), .1, Z(-9.5), 6, .2, 2.2, 0, 0, 0, t, .4);
      DEC(i, 1, X(0), Z(-9.2), 7, 4.5, 0, [.55, .1, .08], .5, 'glow', .35);
      slot(1, -1, 'statue', t, { pose: 1 }); slot(-1, -1, 'statue', t, { pose: 1 }); slot(1, 1, 'statue', t, { pose: 2 }); slot(-1, 1, 'statue', t, { pose: 1 });
      DEC(i, 2, X(0), Z(0), 8.5, 8.5, 1.3, [1, 1, 1], .95, 'wet'); DEC(i, 5, X(0), Z(0), 9, 9, 0, [.8, .12, .08], .5, 'glow'); DEC(i, 5, X(0), Z(0), 9, 9, 0, [.55, .22, .2], .6);
      for (var k = 0; k < 6; k++) { var a = k / 6 * 6.283 + .4; K.put(i, 'cyl', 'iron', X(Math.cos(a) * 4.9), 1.0, Z(Math.sin(a) * 4.9), .12, 2.0, .12, 0, 0, 0, [.8, .7, .66], .3); K.put(i, 'cone4', 'iron', X(Math.cos(a) * 4.9), 2.1, Z(Math.sin(a) * 4.9), .26, .4, .26, PI / 4, 0, 0, [.8, .7, .66], .1); K.bar(i, 'cyl', 'iron', X(Math.cos(a) * 4.9), 1.5, Z(Math.sin(a) * 4.9), X(Math.cos(a) * 1.6), .06, Z(Math.sin(a) * 1.6), .035, [.7, .62, .58]); }
      decals({ cracks: 6, fissures: 2, soot: 7, rubble: 5, blood: 5, wear: [.7, .6, .58] });
      K.brazier(i, X(-6.3), Z(-3), { s: 1, col: [1.5, .45, .16], lightColor: 0xff7040, intensity: 30 }); K.brazier(i, X(6.3), Z(5), { s: 1, col: [1.5, .45, .16], lightColor: 0xff7040, intensity: 30 });
      sconces([-7, 0, 7], { col: [1.5, .4, .14], lightColor: 0xff6a3a });
      dust(26, [1.1, .7, .6], .45, .4, 3.5, 2);
    };
    /* 5 Çöken Anıt — the collapsed monument: a toppled colossus, a hole in the vault, falling dust */
    ROOM[5] = function () {
      var t = [.96, .94, .9]; K.floor(i, r, { tint: [.92, .9, .86], vary: .17, cols: 10, rows: 8, tilt: .06 });
      arcade(t, { ruin: .45, broken: true }); facade(t, { h: 7, ruin: .4, spring: 3.0, gap: [8, 12] });
      [-1, 1].forEach(function (s) { K.column(i, X(s * 4), Z(-7), 5.6, 1.4, 'stone', { tint: t, broken: s < 0, cut: .3 }); });
      var cx = 7.6, cz = -8.4; K.solid(X(cx), Z(cz), 3.6, 3.6); K.solid(X(-8), Z(-7), 2.8, 6.2); [-1, 1].forEach(function (s) { K.solid(s * 4, Z(-7), 1.5, 1.5); });
      K.put(i, 'urn', 'stone', X(cx), 1.7, Z(cz), 3.6, 3.4, 3.6, 0, 0, 0, t, .5, 3); K.put(i, 'box', 'stone', X(cx + .2), 2.1, Z(cz - 2.2), .7, .5, .5, 0, 0, 0, t, .3); K.put(i, 'box', 'stone', X(cx), 1.3, Z(cz + .1), 3.5, 1.0, 1.6, .3, 0, 0, t, .3);
      K.put(i, 'block', 'stone', X(-8), 1.3, Z(-7), 2.8, 2.6, 6.5, .35, 0, .15, t, .5, 3);
      slot(1, -1, 'rubble', t); slot(-1, -1, 'rubble', t); slot(1, 1, 'fallen', t); slot(-1, 1, 'rubble', t);
      K.rubble(i, X(-2.5), Z(-6.6), 3.2, 30, 1.2, 'stone', t, R); K.rubble(i, X(3.5), Z(-4.5), 2.8, 24, 1.0, 'stone', t, R);
      decals({ cracks: 6, fissures: 4, soot: 6, rubble: 14, wear: [.8, .78, .72] });
      shaft(-1, -1, [.55, .62, .85], .3, 3.4, 11, { color: 0xb4c4ff, intensity: 12 });
      K.brazier(i, X(-8), Z(7.5), { s: .85, col: [1.3, .62, .3], intensity: 22 });
      for (var k = 0; k < 16; k++) K.spr(i, S.smoke, X(-1 + (R() - .5) * 8), .4, Z(-1 + (R() - .5) * 8), 2.2, 2.2, [.5, .48, .44], .14, R(), .1 + R() * .05, 3);
      dust(44, [.9, .9, .9], .55, .4, 6, 2.6);
    };
    /* cave helpers */
    function caveGap() {
      var zg = r.z - r.d / 2 - 2;
      [-1, 1].forEach(function (s) { var x0 = B.WorldARuins && B.WorldARuins.wide && B.WorldARuins.wide[i] ? 8.2 : 5.6; /* ajan:world-a: broad cave passages */ for (var q = 0; q < 4; q++) K.put(i, 'crag', 'rock', s * (x0 + q * 3.3), 2.0, zg + (R() - .5) * 1.2, 4.4, 4.0 + R() * 2, 4.2, R() * 6, .1, 0, [.55, .62, .66], .5, 3); });
    }
    function caveRoom(o) { caveGap();
      K.patches(i, r, { n: Math.round((o.patches || 46) * .6), tint: o.tint ? [o.tint[0] * .8, o.tint[1] * .8, o.tint[2] * .8] : [.8, .8, .8], min: 1.7, max: 3.8 });   /* ajan:world-a: plates blend into the cave floor */
      [-1, 1].forEach(function (s) {
        for (var q = 0; q < 4; q++) K.stalactite(i, X(s * (11.2 + R() * 1.6)), 6.1 + R() * .6, Z((q - 1.5) * 5.2 + (R() - .5) * 2), .5 + R() * .5, 1.6 + R() * 2, o.tint);
      });
    }
    /* 6 Mağaranın Ağzı — where the ruins break into raw limestone */
    ROOM[6] = function () {
      var t = CAVEC; caveRoom({ tint: [.78, .9, .96] });
      K.rubble(i, X(-4), Z(6), 2.6, 18, .7, 'stone', t, R); K.rubble(i, X(4.5), Z(7), 2.2, 14, .6, 'stone', t, R); K.rubble(i, X(-9), Z(-4.5), 1.8, 12, .6, 'stone', t, R);
      [-1, 1].forEach(function (s) { K.column(i, X(s * 10.4), Z(9.4), 1.6, 1.1, 'stone', { tint: t, broken: true }); K.solid(X(s * 10.4), Z(9.4), 1.4, 1.4); });
      decals({ cracks: 6, fissures: 3, soot: 4, rubble: 12, puddles: 4, roots: 3 });
      K.crystals(i, X(-10), Z(-3), 5, .8, .9, 1.9, 'crystal', R, { glowCol: [.2, .9, .9], light: true, intensity: 14 }); K.crystals(i, X(10.4), Z(6), 4, .7, .8, 1.6, 'crystal', R, { glowCol: [.2, .9, .9] });
      shaft(-3, -4, [.4, .75, .85], .22, 2.8, 10, { color: 0x8fd0e0, intensity: 16 });
      for (var k = 0; k < 8; k++) K.spr(i, S.smoke, X((R() - .5) * 24), .5, Z((R() - .5) * 18), 3, 3, [.3, .45, .5], .14, R(), .07, 3);
      K.brazier(i, X(-6), Z(7.6), { s: .85, col: [.9, .9, 1.0], lightColor: 0x88c0d8, intensity: 20 });
      dust(30, [.7, 1, 1.05], .5, .4, 4, 2.2);
    };
    /* 7 Kör Kristaller — the blind crystals: teal and violet clusters glowing in the dark */
    ROOM[7] = function () {
      caveRoom({ tint: [.7, .84, 1.0], patches: 40 });
      K.crystals(i, X(-9.2), Z(-1), 9, 1.4, 1.5, 3.6, 'crystal', R, { glowCol: [.2, 1.0, 1.0], light: true, intensity: 34, lightColor: 0x38d8e4, rockTint: [.45, .6, .72] });
      K.crystals(i, X(9.6), Z(4.5), 8, 1.3, 1.4, 3.2, 'crystalV', R, { glowCol: [.7, .35, 1.2], light: true, intensity: 30, lightColor: 0x9a5cf0, rockTint: [.5, .46, .7] });
      K.crystals(i, X(9.4), Z(-8.6), 6, 1.1, 1.2, 2.8, 'crystal', R, { glowCol: [.2, 1.0, 1.0], rockTint: [.45, .6, .72] }); K.crystals(i, X(-6), Z(8), 5, 1.0, 1.0, 2.2, 'crystalV', R, { glowCol: [.7, .35, 1.2], rockTint: [.5, .46, .7] });
      K.crystals(i, X(3.2), Z(-9.2), 10, 1.5, 2.0, 5.0, 'crystal', R, { glowCol: [.2, 1.0, 1.0], light: true, intensity: 34, lightColor: 0x38d8e4, rockTint: [.45, .6, .72] });
      for (var k = 0; k < 18; k++) { var a = R() * 6.28, d = 8 + R() * 5; K.put(i, 'crystal', R() < .5 ? 'crystal' : 'crystalV', X(Math.cos(a) * d), .3 + R() * .3, Z(Math.sin(a) * d * .8), .12 + R() * .1, .5 + R() * .8, .12 + R() * .1, R() * 6, (R() - .5), (R() - .5), null, 0); }
      decals({ cracks: 5, fissures: 2, soot: 3, rubble: 8, puddles: 5, roots: 2 });
      for (var k = 0; k < 10; k++) K.spr(i, S.smoke, X((R() - .5) * 24), .5, Z((R() - .5) * 18), 3.2, 3.2, [.16, .44, .56], .17, R(), .06, 3);
      dust(60, [.5, 1, 1.1], .8, .4, 5, 2.8);
    };
    /* 8 Fısıltı Geçidi — the whispering passage: violet glow, hanging roots, bone drifts */
    ROOM[8] = function () {
      caveRoom({ tint: [.84, .78, 1.0] });
      [-1, 1].forEach(function (s) { for (var q = 0; q < 5; q++) { var z = (q - 2) * 4.4 + (R() - .5); K.put(i, 'crag', 'rock', X(s * 12.6), 2.2, Z(z), 3.6, 4.4, 3.4, R() * 6, .1, s * .2, [.7, .68, .86], .5, 3); K.chain(i, X(s * (10.6 + R() * 1.2)), 6.6, Z(z + (R() - .5) * 2), 2 + R() * 2, [.3, .24, .2]); } });
      K.crystals(i, X(-10.5), Z(2), 5, .8, 1.0, 2.2, 'crystalV', R, { glowCol: [.7, .35, 1.2], light: true, intensity: 22, lightColor: 0x8a52e8 }); K.crystals(i, X(10.5), Z(-4), 5, .8, 1.0, 2.2, 'crystalV', R, { glowCol: [.7, .35, 1.2] });
      decals({ cracks: 6, fissures: 2, soot: 5, rubble: 9, bones: 8, puddles: 3, roots: 4 });
      for (var k = 0; k < 14; k++) K.spr(i, S.smoke, X((R() - .5) * 26), .6, Z((R() - .5) * 18), 3.2, 3.2, [.26, .2, .44], .18, R(), .06, 3.2);
      K.brazier(i, X(-5.5), Z(-8), { s: .8, col: [.9, .6, 1.3], lightColor: 0x9a74ff, intensity: 24 });
      dust(54, [.8, .7, 1.2], .8, .4, 5, 2.8);
    };
    /* 9 Taşın İçindeki Ölüler — the dead inside the stone: skulls, reaching hands, sickly green light */
    ROOM[9] = function () {
      var t = CAVEG; caveRoom({ tint: [.78, .96, .88] });
      for (var n = 0; n < 4; n++) { var s = n % 2 ? 1 : -1, x = s * 7.7, z = (n < 2 ? -5 : 5); K.put(i, 'box', 'stone', X(x), .5, Z(z), 2.3, 1.0, 3.2, 0, 0, 0, t, .5); K.sarcophagus(i, X(x), Z(z), 0, { tint: t, broken: n === 1, len: 2.7, wid: 1.2 }); }
      [-1, 1].forEach(function (s) {
        for (var q = 0; q < 6; q++) { var z = (q - 2.5) * 3.6, x = s * (12.4 + R()); K.put(i, 'box', 'stone', X(x), 1.8, Z(z), 1.4, 3.2, 2.2, 0, 0, 0, [.62, .74, .7], .4); K.put(i, 'urn', 'stone', X(x - s * .8), 2.5, Z(z), .6, .55, .55, 0, 0, 0, [1.3, 1.25, 1.05], 0); K.put(i, 'box', 'stone', X(x - s * .8), 2.0, Z(z), .5, .24, .4, 0, 0, 0, [1.2, 1.15, 1], 0);
          for (var f = 0; f < 3; f++) { K.put(i, 'cyl', 'stone', X(x - s * 1.0), 1.1 + f * .3, Z(z + (f - 1) * .7), .08, .8, .08, 0, 0, s * .8, [1.3, 1.22, 1.0], 0); } }
        for (var q = 0; q < 5; q++) { var hx = s * (6.4 + R() * 4.5), hz = (R() - .5) * 18; K.put(i, 'cyl', 'stone', X(hx), .45, Z(hz), .07, .9, .07, 0, (R() - .5) * .5, (R() - .5) * .5, [1.3, 1.2, 1], 0); for (var f = 0; f < 4; f++) K.put(i, 'cyl', 'stone', X(hx + (f - 1.5) * .06), .98, Z(hz), .03, .26, .03, 0, 0, (f - 1.5) * .35, [1.3, 1.2, 1], 0); }
      });
      for (var k = 0; k < 5; k++) { var px = X((R() - .5) * 20), pz = Z((R() - .5) * 14); if (Math.abs(px - r.x) > 5.5) for (var q = 0; q < 6; q++) K.put(i, 'urn', 'stone', px + (R() - .5) * 1.2, .16 + R() * .25, pz + (R() - .5) * 1.2, .3, .26, .3, 0, 0, 0, [1.3, 1.2, 1], 0); }
      K.crystals(i, X(-2.6), Z(-9.6), 6, .9, 1.2, 2.6, 'crystal', R, { glowCol: [.3, 1.1, .6], light: true, intensity: 22, lightColor: 0x58e8a0, rockTint: [.5, .65, .55] });
      decals({ cracks: 6, fissures: 3, soot: 5, rubble: 8, bones: 12, blood: 3, puddles: 3 });
      for (var k = 0; k < 14; k++) K.spr(i, S.smoke, X((R() - .5) * 26), .6, Z((R() - .5) * 18), 3.2, 3.2, [.18, .38, .26], .18, R(), .06, 3);
      K.brazier(i, X(-6), Z(7.5), { s: .85, col: [.6, 1.1, .7], lightColor: 0x58d890, intensity: 22 });
      dust(40, [.6, 1.1, .8], .7, .4, 4.5, 2.6);
    };
    /* 10 Yutulan Saray — the swallowed palace: marble tiles, palace columns, broken arches, gold torches under stalactites */
    ROOM[10] = function () {
      caveGap(); var t = GOLD; K.floor(i, r, { key: 'floor', tint: [1.0, .92, .78], vary: .16, cols: 10, rows: 8, skip: function (x, z) { return Math.abs(x) > 8.5 && R() < .45; } });
      K.patches(i, r, { n: 22, tint: [.7, .66, .6], min: 1.4, max: 2.8, skip: function (x, z) { return Math.abs(x) < 8; } });
      [-1, 1].forEach(function (s) {
        for (var q = 0; q < 4; q++) { var z = (q - 1.5) * 5.2; K.column(i, X(s * 11.8), Z(z), [5.2, 3.8, 6.0, 4.4][(q + (s > 0 ? 1 : 0)) % 4], 1.25, 'stone', { tint: t, broken: q === 1 || (q === 3 && s > 0), cut: .1 }); }
        K.stalactite(i, X(s * 12), 6.3, Z(-5), 1.0, 3.2, [.7, .66, .6]); K.stalactite(i, X(s * 11.5), 6.3, Z(4), .9, 2.6, [.7, .66, .6]);
      });
      K.arch(i, 0, Z(-9), 5.5, 2.4, { tint: t, depth: 1.5, gap: [7, 12] }); [-1, 1].forEach(function (s) { K.column(i, s * 5.5, Z(-9), 2.4, 1.3, 'stone', { tint: t }); K.solid(s * 5.5, Z(-9), 1.5, 1.5); });
      for (var n = 0; n < 4; n++) { var s = n % 2 ? 1 : -1, x = s * 7.7, z = (n < 2 ? -5 : 5); K.put(i, 'box', 'stone', X(x), .55, Z(z), 2.1, 1.1, 3.0, 0, 0, 0, t, .5); K.put(i, 'box', 'stone', X(x), 1.2, Z(z), 1.8, .24, 2.7, 0, 0, 0, [1.25, 1.1, .8], .2); K.put(i, 'urn', 'crystalA', X(x), 1.55, Z(z), .5, .5, .5, 0, 0, 0, null, 0); }
      decals({ cracks: 8, fissures: 3, soot: 5, rubble: 8, blood: 2 });
      DEC(i, 6, X(0), Z(0), 11, 11, .2, [.8, .62, .3], .45);
      K.brazier(i, X(-6.4), Z(6.5), { s: 1, col: [1.5, .66, .22], intensity: 32 }); K.brazier(i, X(6.4), Z(-6.5), { s: 1, col: [1.5, .66, .22], intensity: 32 }); K.brazier(i, X(0), Z(8.5), { s: .8, col: [1.4, .7, .26], intensity: 22 });
      K.crystals(i, X(-10), Z(-9), 4, .6, .8, 1.6, 'crystalA', R, { glowCol: [1.2, .8, .3], rockTint: [.6, .56, .5] });
      sconces([-6, 0, 6], { col: [1.5, .66, .22] });
      dust(36, [1.1, .95, .7], .55, .4, 4, 2.4);
    };
    /* 11 Son Yemin — the oath shrine: circular dais, four fires, a glowing oath monolith */
    ROOM[11] = function () {
      var t = GOLD; K.floor(i, r, { tint: [.86, .78, .66], vary: .1, cols: 10, rows: 8 });
      [-1, 1].forEach(function (s) { K.wall(i, X(s * (r.w / 2 + .45)), Z(0), r.d + .2, .9, 6.2, false, -s, 0, { tint: t, ruin: .2, niche: true, pil: 5.2 }); });
      K.wall(i, (r.x - r.w / 2 - .9 - 3.9) / 2, r.z - 11.75, 3.9 - (r.x - r.w / 2 - .9) , 1.3, 6.2, true, 0, 1, { tint: t, ruin: .2, niche: true }); K.wall(i, (3.9 + r.x + r.w / 2 + .9) / 2, r.z - 11.75, r.x + r.w / 2 + .9 - 3.9, 1.3, 6.2, true, 0, 1, { tint: t, ruin: .2, niche: true });
      for (var k = 0; k < 3; k++) { K.put(i, 'cyl', 'stone', X(0), .09 + k * .17, Z(0), 12.4 - k * 1.6, .18, 12.4 - k * 1.6, 0, 0, 0, [.4, .35, .28], .1); }
      K.put(i, 'cyl', 'stone', X(0), .56, Z(0), 6.8, .18, 6.8, 0, 0, 0, [.42, .37, .3], 0);
      DEC(i, 5, X(0), Z(0), 12, 12, 0, [.9, .62, .26], .4, 'glow'); DEC(i, 6, X(0), Z(0), 5.6, 5.6, 0, [.7, .5, .22], .24, 'glow');
      K.put(i, 'column', 'stone', X(0), 1.2, Z(0), 1.5, 1.3, 1.5, 0, 0, 0, t, .3); K.put(i, 'box', 'stone', X(0), 2.2, Z(0), 1.0, 1.6, 1.0, PI / 4, 0, 0, t, .1); K.put(i, 'crystal', 'crystalA', X(0), 3.4, Z(0), .9, 1.9, .9, .3, 0, 0, null, 0);
      K.spr(i, S.glow, X(0), 3.2, Z(0), 3.4, 3.4, [.9, .6, .2], .9, 0, 1, 1); K.spr(i, S.pool, X(0), .7, Z(0), 7, 7, [.7, .5, .2], .45, .2, 1, 1); K.light(i, X(0), 3.4, Z(0), 0xffc878, 17, 14, { scatter: .9, glow: 2.2, flicker: .1 });
      for (var q = 0; q < 4; q++) { var a = q * PI / 2 + PI / 4; K.brazier(i, X(Math.cos(a) * 7.6), Z(Math.sin(a) * 7.6), { s: 1.0, col: [1.5, .8, .3], lightColor: 0xffb060, intensity: 26 }); }
      for (var q = 0; q < 24; q++) K.spr(i, S.ember, X((R() - .5) * 8), .7, Z((R() - .5) * 8), .05, .05, [1.8, 1.3, .5], 1, R(), .2 + R() * .2, 5);
      decals({ cracks: 3, soot: 2, rubble: 2 });
      dust(36, [1.2, 1.0, .7], .5, .4, 4.5, 2.4);
    };
    /* 12 Tahtın Nöbeti — the throne's watch: a hall of guardian statues, banners and a carpet of dark red */
    ROOM[12] = function () {
      var t = GOLD; K.floor(i, r, { key: 'floor', tint: [1.04, .96, .8], vary: .1, cols: 10, rows: 8, tilt: .015 });
      K.patches(i, r, { n: 14, tint: [.7, .66, .6], min: 1.5, max: 2.4, skip: function (x, z) { return Math.abs(x) < 9; } });
      DEC(i, 10, X(0), Z(0), 6.2, r.d - 2, 0, [.62, .1, .1], .85); DEC(i, 10, X(-2.9), Z(0), .5, r.d - 2, 0, [1.4, 1, .4], .8, 'glow'); DEC(i, 10, X(2.9), Z(0), .5, r.d - 2, 0, [1.4, 1, .4], .8, 'glow');
      [-1, 1].forEach(function (s) {
        K.wall(i, X(s * (r.w / 2 + .45)), Z(0), r.d + .2, .9, 7, false, -s, 0, { tint: t, ruin: .1, niche: true, pil: 5.2, key: 'wall' });
        for (var q = 0; q < 4; q++) { var z = (q - 1.5) * 5.2; K.put(i, 'box', 'stone', X(s * 8.7), .4, Z(z), 2, .8, 2, 0, 0, 0, t, .5); K.statue(i, X(s * 8.7), Z(z), s > 0 ? -PI / 2 : PI / 2, { tint: t, pose: q % 3 === 1 ? 3 : 0, s: 1.0 }); K.solid(X(s * 8.7), Z(z), 2, 2); K.solid(X(s * 11.8), Z(z + 2.6), 1.5, 1.5); K.column(i, X(s * 11.8), Z(z + 2.6), 6.6, 1.2, 'stone', { tint: t }); K.banner(i, X(s * 13.2), 5.2, Z(z), 1.5, 4, s > 0 ? -PI / 2 : PI / 2, [.5, .08, .08]); }
      });
      K.wall(i, (r.x - r.w / 2 - .9 - 3.9) / 2, r.z - 11.75, 3.9 - (r.x - r.w / 2 - .9), 1.3, 7.4, true, 0, 1, { tint: t, ruin: .1, niche: true }); K.wall(i, (3.9 + r.x + r.w / 2 + .9) / 2, r.z - 11.75, r.x + r.w / 2 + .9 - 3.9, 1.3, 7.4, true, 0, 1, { tint: t, ruin: .1, niche: true });
      K.arch(i, 0, Z(-11.35), 3.85, 3.0, { tint: t, depth: 1.5 });
      K.brazier(i, X(-4.2), Z(-8), { s: 1.1, col: [1.5, .72, .26], intensity: 34 }); K.brazier(i, X(4.2), Z(-8), { s: 1.1, col: [1.5, .72, .26], intensity: 34 }); K.brazier(i, X(-4.2), Z(5), { s: 1.0, col: [1.5, .72, .26], intensity: 28 }); K.brazier(i, X(4.2), Z(5), { s: 1.0, col: [1.5, .72, .26], intensity: 28 });
      decals({ cracks: 4, soot: 3, rubble: 3, blood: 1 });
      sconces([-7.5, 0, 7.5], { col: [1.5, .72, .26] });
      dust(36, [1.2, 1.0, .7], .55, .4, 4.5, 2.4);
    };
    /* 13 Sessiz Taht — the throne court: a stepped dais and throne, a ring of guardian statues, the golden sun on the floor */
    ROOM[13] = function () {
      var t = GOLD; K.floor(i, r, { key: 'floor', tint: [.88, .8, .66], vary: .09, cols: 12, rows: 9, tilt: .01 });
      K.patches(i, r, { n: 16, tint: [.7, .66, .6], min: 1.5, max: 2.6, skip: function (x, z) { return Math.abs(x) < 10.5; } });
      DEC(i, 6, X(0), Z(2), 13, 13, 0, [.4, .28, .12], .065, 'glow'); DEC(i, 6, X(0), Z(2), 13, 13, 0, [.8, .66, .4], .12); DEC(i, 5, X(0), Z(2), 17, 17, 0, [.4, .28, .12], .04, 'glow');
      DEC(i, 10, X(0), Z(-5.5), 5.4, 10, 0, [.62, .1, .1], .85);
      var tz = -9;
      for (var k = 0; k < 3; k++) K.put(i, 'box', 'stone', X(0), .09 + k * .2, Z(-8.0 - k * .6 - 1.6), 11.5 - k * 1.6, .18 + k * .2, 1.0 + k * .3, 0, 0, 0, [1.1, 1.0, .85], .2);
      K.put(i, 'box', 'stone', X(0), .5, Z(-10.6), 11, 1.0, 3.2, 0, 0, 0, [1.12, 1.0, .84], .3);
      K.put(i, 'box', 'stone', X(0), 1.2, Z(-9.1), 3.6, .9, 2.0, 0, 0, 0, t, .3); K.put(i, 'box', 'stone', X(0), 2.9, Z(-9.9), 3.8, 5.6, .9, 0, 0, 0, t, .3, 4); K.put(i, 'box', 'stone', X(-2.1), 2.0, Z(-9.1), .7, 1.7, 1.8, 0, 0, 0, t, .3); K.put(i, 'box', 'stone', X(2.1), 2.0, Z(-9.1), .7, 1.7, 1.8, 0, 0, 0, t, .3);
      for (var q = -2; q <= 2; q++) K.put(i, 'cone4', 'stone', X(q * .85), 6.1 + (2 - Math.abs(q)) * .3, Z(-9.9), .5, 1.2 + (2 - Math.abs(q)) * .5, .5, PI / 4, 0, 0, [1.2, 1.05, .8], .1);
      K.put(i, 'box', 'crystalA', X(0), 3.2, Z(-9.4), .5, .5, .1, PI / 4, 0, 0, null, 0); K.spr(i, S.glow, X(0), 3.3, Z(-9.2), 2.6, 2.6, [.8, .55, .2], .9, 0, 1, 1);
      [-1, 1].forEach(function (s) {
        for (var q = 0; q < 5; q++) { var a = (s > 0 ? 0 : PI) + (q - 2) * .5 * (s > 0 ? 1 : -1), rx = Math.cos(a) * 13.2, rz = Math.sin(a) * 8.2 + 1; if (q === 2 && false) continue; K.put(i, 'box', 'stone', X(rx), .5, Z(rz), 2.1, 1.0, 2.1, 0, 0, 0, t, .5); K.statue(i, X(rx), Z(rz), Math.atan2(-rx, -rz), { tint: t, pose: q % 2 ? 3 : 0, s: 1.25 }); }
        for (var q = 0; q < 3; q++) { var z = -3 + q * 6; K.column(i, X(s * 13.6), Z(z), 7.2, 1.3, 'stone', { tint: t }); K.banner(i, X(s * 15.2), 5.4, Z(z), 1.8, 4.6, s > 0 ? -PI / 2 : PI / 2, [.5, .08, .08]); }
        K.wall(i, X(s * (r.w / 2 + .45)), Z(0), r.d + .2, .9, 8, false, -s, 0, { tint: t, ruin: .05, niche: true, pil: 5.2 });
      });
      K.wall(i, X(-9.3), r.z - 13.4, 13.4, 1.4, 8, true, 0, 1, { tint: t, ruin: .05, niche: true }); K.wall(i, X(9.3), r.z - 13.4, 13.4, 1.4, 8, true, 0, 1, { tint: t, ruin: .05, niche: true });
      [[-5.2, 2], [5.2, 2], [-5.2, -4], [5.2, -4]].forEach(function (p) { K.brazier(i, X(p[0]), Z(p[1]), { s: 1.3, col: [1.25, .64, .24], lightColor: 0xffb458, intensity: 18, fireScale: .58, glowGain: .38 }); });
      for (var q = 0; q < 6; q++) K.chain(i, X(-6 + q * 2.4), 8.6, Z(-12 + (q % 2) * 2), 3 + R() * 2, [.8, .72, .6]);
      decals({ cracks: 4, soot: 3, rubble: 3, blood: 2 });
      for (var q = 0; q < 30; q++) K.spr(i, S.ember, X((R() - .5) * 20), .6, Z((R() - .5) * 18), .05, .05, [1.8, 1.2, .5], 1, R(), .12 + R() * .15, 6);
      sconces([-8, 0, 8], { col: [1.6, .74, .26], intensity: 22 });
      dust(46, [1.2, 1.0, .7], .6, .4, 5, 2.6);
    };
    ROOM[i]();
  }
  B.RuinsRooms = { dress: dress, moodBase: moodBase, moodSpecs: moodSpecs };
}());
