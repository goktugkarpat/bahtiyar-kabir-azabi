/* KABİR AZABI — III: Sessiz Taht, second dressing pass (ajan: world-a).
   Runs after ruins-rooms.js has composed each room, with the same baked kit (ruins-kit.js): everything here is merged into
   the rooms' existing static buckets, decal and sprite batches, so it adds no draw calls of its own.
   - Cave threshholds (rooms 6..10) open into broad passages instead of 7 m corridors (extra floor rectangles, crags pushed back).
   - Lived-in floors: grit, bone, skulls, stains; skull heaps and votive candles at the edges; hanging chains.
   - Caves: stalagmite clusters along the walls, glowing mineral veins, bone drifts, dripping stalactites.
   - The golden halls: scattered offerings (coins, cups), wax and candle rows by the statues.
   The fighting centre (room centre ±8 x ±6) and the quest anchors stay clear. */
(function () {
  'use strict';
  var B = window.BABA, PI = Math.PI;
  var BONE = [1.28, 1.18, .96], DARK = [.25, .24, .26];
  // Rooms whose north threshold becomes a broad cave passage (index of the room south of the gap).
  var WIDE = { 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 }, WIDE_W = 13;
  // Side nooks off the ruined city's halls (room index -> wall side): a doorway in the arcade wall opens into a small shrine.
  var NOOK = { 0: 1, 1: -1, 5: 1 };
  // Open courts: the north facade of these halls is broken wide (half-width in metres) and the 7 m corridor becomes a broad forecourt.
  var OPEN = { 1: 8.6, 2: 6.6, 3: 8.6, 4: 8.6 };

  function dress(K, rooms, env) {
    var S = K.SPR || {}, solid = env.solid, floors = env.floors;
    function skull(i, x, y, z, s, rot, R) {
      K.put(i, 'urn', 'stone', x, y + .12 * s, z, .24 * s, .22 * s, .27 * s, rot, (R() - .5) * .4, (R() - .5) * .4, BONE, .2);
      var fx = Math.sin(rot), fz = Math.cos(rot), sx = Math.cos(rot), sz = -Math.sin(rot);
      [-1, 1].forEach(function (k) { K.put(i, 'urn', 'iron', x + fx * .1 * s + sx * k * .055 * s, y + .14 * s, z + fz * .1 * s + sz * k * .055 * s, .07 * s, .07 * s, .05 * s, rot, 0, 0, DARK, 0); });
      K.put(i, 'box', 'stone', x + fx * .08 * s, y + .04 * s, z + fz * .08 * s, .14 * s, .05 * s, .1 * s, rot, 0, 0, BONE, .2);
    }
    function bone(i, x, z, len, a, y, R) { K.bar(i, 'cyl', 'stone', x - Math.cos(a) * len / 2, (y || 0) + .05, z - Math.sin(a) * len / 2, x + Math.cos(a) * len / 2, (y || 0) + .05 + (R() - .5) * .06, z + Math.sin(a) * len / 2, .032, BONE, .2); }
    function skullHeap(i, x, z, rad, n, R) {
      for (var k = 0; k < n; k++) { var a = R() * 6.28, d = Math.sqrt(R()) * rad, h = (1 - d / rad) * rad * .55; skull(i, x + Math.cos(a) * d, h, z + Math.sin(a) * d, .9 + R() * .3, R() * 6.28, R); }
      for (var j = 0; j < n; j++) { var b = R() * 6.28, e = Math.sqrt(R()) * rad * 1.15; bone(i, x + Math.cos(b) * e, z + Math.sin(b) * e, .3 + R() * .35, R() * 6.28, (1 - e / rad / 1.15) * rad * .35, R); }
      K.dec(i, 11, x, z, rad * 3, rad * 3, R() * 6.28, [.55, .5, .42], .85);
      if (rad > .8) solid(x, z, rad * 1.3, rad * 1.3);
    }
    function candles(i, x, z, n, R, col) {
      col = col || [1.5, .7, .25];
      for (var k = 0; k < n; k++) {
        var px = x + (R() - .5) * .9, pz = z + (R() - .5) * .8, h = .12 + R() * .32;
        K.put(i, 'cyl', 'stone', px, h / 2, pz, .07, h, .07, 0, 0, 0, [1.25, 1.12, .9], 0);
        K.spr(i, S.flame, px, h + .14, pz, .045, .14, col, 1, R(), 1, 1);
      }
      K.spr(i, S.glow, x, .45, z, .9, .9, [col[0] * .3, col[1] * .3, col[2] * .3], .8, R(), 1, 1);
      K.spr(i, S.pool, x, .1, z, 2.2, 2.2, [col[0] * .18, col[1] * .18, col[2] * .18], .55, R(), 1, 1);
      K.dec(i, 3, x, z, 1.4, 1.4, R() * 6.28, [1.1, 1, .8], .5);
    }
    function stalagmites(i, x, z, n, R, tint) {
      for (var k = 0; k < n; k++) { var a = R() * 6.28, d = Math.sqrt(R()) * 1.1, h = .7 + R() * 2.2 * (1 - d / 1.4);
        K.put(i, 'tooth', 'rock', x + Math.cos(a) * d, h / 2, z + Math.sin(a) * d, .35 + h * .18, h, .35 + h * .18, R() * 6, (R() - .5) * .15, (R() - .5) * .15, tint, .5); }
      K.put(i, 'crag', 'rock', x, .15, z, 2.4, .5, 2.2, R() * 6, 0, 0, tint, .6);
      solid(x, z, 2, 2);
    }
    function pebbles(i, r, n, R, key, tint, clear) {
      for (var k = 0; k < n; k++) {
        var x = r.x + (R() - .5) * (r.w - 2), z = r.z + (R() - .5) * (r.d - 2), s = .08 + R() * .2;
        if (clear && Math.abs(x - r.x) < clear[0] && Math.abs(z - r.z) < clear[1] && R() < .6) continue;
        K.put(i, 'rock', key || 'rock', x, .02, z, s * 1.4, s * .5, s, R() * 6.28, 0, 0, tint, .3);
      }
    }

    // ---- open forecourts between halls ----
    Object.keys(OPEN).forEach(function (key) {
      var i = +key, r = rooms[i], n2 = rooms[i + 1], R = K.rng(i, 515), half = OPEN[i], t = [.86, .88, .94];
      var a = r.z - r.d / 2, b = n2.z + n2.d / 2, mid = (a + b) / 2, d = a - b + .1;
      if (env.colliders) for (var c = env.colliders.length - 1; c >= 0; c--) { var q = env.colliders[c]; if (Math.abs(Math.abs(q.x) - 3.8) < .01 && Math.abs(q.z - mid) < .2) env.colliders.splice(c, 1); }
      floors.push({ x: 0, z: mid, w: half * 2, d: d });
      for (var gx = -3; gx <= 3; gx++) for (var gz = 0; gz < 2; gz++) { var bb = .82 + R() * .26; K.put(i, 'tile', 'floor', gx * 2.45, -.07, b + 1 + gz * 2, 2.38, .18, 1.94, (R() - .5) * .04, 0, 0, [.8 * bb, .84 * bb, .94 * bb], 0); }
      K.put(i, 'box', 'earth', 0, -.2, mid, half * 2 + 1, .36, d + .4, 0, 0, 0, [.7, .7, .72], 0);
      // broad steps down into the next court (flush with the floor: purely a change of material and rhythm)
      for (var st = 0; st < 3; st++) K.put(i, 'box', 'stone', 0, -.035 - st * .01, a - .3 - st * .5, half * 2 - 1 - st * .6, .08, .5, 0, 0, 0, [.92 - st * .05, .93 - st * .05, .98 - st * .05], .3);
      [-1, 1].forEach(function (s) {
        // broken facade stubs and fallen blocks close the forecourt's flanks
        K.put(i, 'block', 'wall', s * (half + .5), 1.6, mid, 1.2, 3.2 + R() * 1.6, d + .6, 0, 0, s * .05, t, .5, 3);
        solid(s * (half + .5), mid, 1.2, d + .6);
        K.rubble(i, s * (half - .6), mid + (R() - .5) * 2, 1.4, 12, 1.0, 'stone', t, R);
        K.column(i, s * (half - 1.4), b + .9, 2.2 + R() * 1.6, 1.0, 'stone', { tint: t, broken: true, cut: .2 }); solid(s * (half - 1.4), b + .9, 1.1, 1.1);
        K.brazier(i, s * 3.6, mid, { s: .8, col: [1.4, .66, .26], intensity: 18 });
      });
      K.dec(i, 10, 0, mid, half * 1.6, d + 3, 0, [.7, .72, .78], .8); K.dec(i, 0, (R() - .5) * 4, mid, 6, 5, R() * 6, [1, 1, 1], .8);
      if (i === 3) [-1, 1].forEach(function (s) { [4.3, 7.4].forEach(function (cx) { solid(s * cx, r.z - 11.1, 1.25, 1.25); }); });   // the portico's columns now stand in the way
    });
    // ---- landmarks seen from afar: a colossal fallen king outside the ruined city, a moon shaft on his head ----
    (function () {
      var i = 4, r = rooms[4], x = r.x - 24, z = r.z - 6, t = [.78, .8, .86];
      K.put(i, 'box', 'stone', x, 1.2, z, 7, 2.4, 7, .2, 0, 0, t, .5, 3); K.put(i, 'box', 'stone', x, 2.7, z, 5.6, .6, 5.6, .2, 0, 0, t, .3);
      K.statue(i, x, z, PI / 2 + .2, { tint: t, pose: 3, s: 4.4 });
      K.spr(i, S.beam, x + .5, 0, z, 3.4, 24, [.45, .6, 1.0], .32, .3, 1, 1);
      K.spr(i, S.glow, x, 15, z, 6, 6, [.25, .32, .5], .5, .2, 1, 1);
      K.rubble(i, x + 5, z + 3, 3.5, 22, 2.2, 'stone', t, K.rng(4, 77));
    }());
    // ---- a broken watchtower east of the lost colonnade: a lit window still burns near its top ----
    (function () {
      var i = 1, r = rooms[1], x = r.x + 22, z = r.z - 3, t = [.72, .74, .82], R = K.rng(1, 88);
      for (var c = 0; c < 9; c++) { var w = 5.2 - c * .18; K.put(i, 'block', 'wall', x, .9 + c * 1.8, z, w, 1.8, w, (R() - .5) * .04, 0, 0, [t[0] * (.9 + R() * .2), t[1] * (.9 + R() * .2), t[2] * (.9 + R() * .2)], .4, 3); }
      for (var k = 0; k < 6; k++) { var a = k / 6 * 6.28; if (k === 2 || k === 3) continue; K.put(i, 'block', 'stone', x + Math.cos(a) * 1.9, 17.4 + R() * .6, z + Math.sin(a) * 1.9, 1.1, 1.2 + R(), 1.1, a, 0, 0, t, .3); }
      K.put(i, 'box', 'hot', x - 2.45, 13.6, z, .1, 1.3, .7, 0, 0, 0, [1.6, .8, .35], 0);
      K.spr(i, S.glow, x - 2.9, 13.6, z, 2.4, 2.4, [.9, .45, .15], .8, .4, 1, 1);
      K.rubble(i, x - 3, z + 3, 3.2, 20, 2.0, 'stone', t, R);
    }());
    // ---- a crystal spire breaking through the cavern roof east of the blind crystals ----
    (function () {
      var i = 7, r = rooms[7], x = r.x + 21, z = r.z - 2, R = K.rng(7, 99);
      K.put(i, 'crag', 'rock', x, 2, z, 8, 4, 7, R() * 6, 0, 0, [.5, .58, .66], .5, 3);
      K.put(i, 'crystal', 'crystal', x, 8, z, 2.2, 15, 2.2, .3, .08, -.05, null, 0);
      for (var k = 0; k < 7; k++) { var a = R() * 6.28, d = 1.6 + R() * 1.8, h = 3 + R() * 6; K.put(i, 'crystal', R() < .3 ? 'crystalV' : 'crystal', x + Math.cos(a) * d, h * .45 + 1.5, z + Math.sin(a) * d, h * .17, h, h * .17, R() * 6, Math.cos(a) * .35, Math.sin(a) * .35, null, 0); }
      K.spr(i, S.glow, x, 9, z, 7, 7, [.1, .5, .55], .7, .1, 1, 1);
      K.spr(i, S.beam, x, 0, z, 3, 22, [.2, .8, .9], .25, .2, 1, 1);
      K.light(i, x - 6, 4, z, 0x58d6e0, 20, 14, { scatter: .6, glow: 1.6, flicker: .05 });
    }());
    // ---- first screen: the kings' road. A colossal fallen head, broken drums of giant columns, ground mist, a far moon shaft ----
    (function () {
      var i = 0, r = rooms[0], R = K.rng(0, 61), t = [.78, .82, .92];
      var hx = -10.2, hz = r.z + 8.4;
      K.put(i, 'urn', 'stone', hx, 1.1, hz, 2.6, 2.4, 2.4, .4, .15, .35, t, .5, 3);                 // the head, face-up in the dust
      K.put(i, 'box', 'stone', hx + .9, 1.45, hz + .7, 1.2, .5, .5, .4, .2, .3, t, .2);               // brow ridge
      K.put(i, 'cone4', 'stone', hx - .2, 2.6, hz - .3, .9, 1.3, .9, .4, .3, .2, t, .2);             // a crown spike, snapped
      K.solid(hx, hz, 2.8, 2.6);
      [[9.6, r.z + 7.2, 2.4], [10.8, r.z + 4.4, 1.6]].forEach(function (d) {
        K.put(i, 'column', 'stone', d[0], .7, d[1], 1.9, d[2], 1.9, R() * 3, PI / 2, 0, t, .5, 2.4); K.solid(d[0], d[1], 2.2, d[2] + .4); });
      for (var m = 0; m < 10; m++) K.spr(i, S.smoke, (R() - .5) * 20, .25, r.z + 2 + R() * 9, 3.4, 3.4, [.32, .38, .48], .12, R(), .05, 1.2);
      K.spr(i, S.beam, 2.5, 0, r.z - 7, 2.6, 16, [.5, .66, 1.05], .22, .5, 1, 1);
      K.spr(i, S.pool, 2.5, .12, r.z - 7, 5, 5, [.2, .26, .4], .5, .5, 1, 1);
    }());
    // ---- the throne's staging: a gold shaft from the broken dome, dust turning in it, the dais lit from below ----
    (function () {
      var i = 13, r = rooms[13], R = K.rng(13, 62);
      K.spr(i, S.beam, 0, 0, r.z - 9.4, 3.4, 18, [1.0, .78, .4], .3, .2, 1, 1);
      K.spr(i, S.pool, 0, .6, r.z - 8, 7, 7, [.6, .42, .16], .5, .2, 1, 1);
      for (var m = 0; m < 40; m++) K.spr(i, S.mote, (R() - .5) * 5, .5 + R() * 7, r.z - 9 + (R() - .5) * 5, .04, .04, [1.3, 1.05, .6], .7, R(), .2 + R() * .3, 1.6);
      [-1, 1].forEach(function (s) { K.light(i, s * 3, .8, r.z - 7.6, 0xffb060, 12, 8, { scatter: .7, glow: 1.2, flicker: .15 }); });
      // spilled royal gold before the steps
      for (var gp = 0; gp < 3; gp++) { var gx = (gp - 1) * 4.2, gz = r.z - 6.4; for (var c = 0; c < 9; c++) K.put(i, 'rock', 'crystalA', gx + (R() - .5) * 1.4, .05 + R() * .12, gz + (R() - .5) * 1.0, .32, .14, .26, R() * 6, 0, 0, [1.2, .85, .4], 0); }
    }());
    // ---- tombs of the kings / oathbreakers' court: gold heaps at the sarcophagi, a burning offering bowl ----
    [3, 4].forEach(function (i) { var r = rooms[i], R = K.rng(i, 63);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { var gx = r.x + c[0] * 8 + c[0] * -1.6, gz = r.z + c[1] * 4 + 2.1;
        for (var k = 0; k < 7; k++) K.put(i, 'rock', 'crystalA', gx + (R() - .5) * 1.1, .04 + R() * .1, gz + (R() - .5) * .8, .26, .12, .22, R() * 6, 0, 0, [1.15, .8, .38], 0);
        K.put(i, 'vat', 'iron', gx + .6, .16, gz - .2, .26, .32, .26, R(), PI / 2, 0, [1.3, 1, .55], .2); });
      K.brazier(i, r.x + (i === 3 ? 0 : -3), r.z + 8.6, { s: .7, col: [1.5, .6, .2], intensity: 14, solid: true }); });
    // ---- caves: glowing moss and mushroom clusters along the walls, standing water ----
    [6, 7, 8, 9].forEach(function (i) { var r = rooms[i], R = K.rng(i, 64), glowC = [[.2, .9, .6], [.2, .8, 1], [.6, .35, 1], [.3, 1, .4]][i - 6];
      for (var k = 0; k < 6; k++) { var s = k % 2 ? 1 : -1, mx = r.x + s * (8.6 + R() * 2), mz = r.z + (R() - .5) * (r.d - 5);
        K.dec(i, 12, mx, mz, 2.4, 2.4, R() * 6, [glowC[0] * .5, glowC[1] * .5, glowC[2] * .5], .6, 'glow');
        for (var q = 0; q < 5; q++) { var px = mx + (R() - .5) * 1.2, pz = mz + (R() - .5) * 1.2, h = .12 + R() * .2;
          K.put(i, 'cyl', 'stone', px, h / 2, pz, .05, h, .05, 0, 0, 0, [1.1, 1.05, .95], 0);
          K.put(i, 'urn', i === 8 ? 'crystalV' : 'crystal', px, h, pz, .18, .08, .18, 0, 0, 0, null, 0); }
        K.spr(i, S.glow, mx, .5, mz, .9, .9, [glowC[0] * .3, glowC[1] * .3, glowC[2] * .3], .7, R(), 1, 1); }
      for (var w = 0; w < 2; w++) K.dec(i, 9, r.x + (R() - .5) * 12, r.z + (R() - .5) * 12, 3.5, 2.6, R() * 6, [1, 1, 1], .95, 'wet'); });
    // ---- the cave mouth: the roof fell in. A rock shelf (upper gallery) rises on the east side with a broken rail and side steps;
    //      daylight-blue falls through the hole onto the scree it left ----
    (function () {
      var i = 6, r = rooms[6], R = K.rng(6, 71), t = [.6, .68, .74], x0 = r.x + 7, x1 = r.x + 11.6, z0 = r.z - 3, z1 = r.z + 5.5, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      K.put(i, 'crag', 'rock', cx + .6, .9, cz, x1 - x0 + 1.6, 2.2, z1 - z0 + 1.2, R() * .3, 0, 0, t, .5, 3);
      for (var gx = 0; gx < 2; gx++) for (var gz = 0; gz < 4; gz++) K.put(i, 'tile', 'floor', x0 + 1.1 + gx * 2.2, 2.0, z0 + 1.05 + gz * 2.1, 2.1, .2, 2.0, (R() - .5) * .06, 0, 0, [.62, .68, .74], .3);
      for (var st = 0; st < 4; st++) K.put(i, 'block', 'stone', x0 - .5 - st * .02, .25 + st * .45, z1 + .4 + (3 - st) * .55, 1.6, .5, .6, 0, 0, 0, [.7, .74, .8], .4);   // side steps
      for (var p = 0; p < 5; p++) { var pz = z0 + .4 + p * (z1 - z0 - .8) / 4; if (p === 2) continue; K.put(i, 'cyl', 'stone', x0 + .2, 2.55, pz, .14, .9, .14, 0, 0, 0, [.8, .82, .88], .3); }
      K.put(i, 'box', 'stone', x0 + .2, 3.0, (z0 + z1) / 2 - 1, .2, .14, (z1 - z0) * .45, 0, 0, .06, [.8, .82, .88], .2);
      K.rubble(i, x0 + .4, z0 + (z1 - z0) * .55, .8, 6, .4, 'stone', t, R);                       // the rail's broken gap
      K.statue(i, cx + .6, cz, -PI / 2, { tint: [.66, .72, .78], pose: 2, s: .7 });
      K.solid(cx + .2, cz + .6, x1 - x0 + .8, z1 - z0 + 2.6);
      // the fallen roof
      var fx = r.x + 1.5, fz = r.z - 7.6;
      K.rubble(i, fx, fz, 1.6, 22, 1.5, 'rock', t, R); K.solid(fx, fz, 2.2, 2.2);
      K.spr(i, S.beam, fx, 0, fz, 3.2, 20, [.5, .7, .95], .3, .4, 1, 1); K.spr(i, S.pool, fx, .12, fz, 6, 6, [.22, .3, .42], .55, .4, 1, 1);
      for (var m = 0; m < 24; m++) K.spr(i, S.mote, fx + (R() - .5) * 3, .5 + R() * 7, fz + (R() - .5) * 3, .04, .04, [.9, 1, 1.2], .7, R(), .2 + R() * .3, 1.4);
      K.light(i, fx, 4, fz, 0x9ac0ff, 14, 12, { scatter: .6, glow: 1.4, flicker: .03 });
    }());
    // ---- falling drops and their rings in the caves (one GPU-animated instanced draw) ----
    if (env.root && B.WorldADrips) { var dp = []; [6, 7, 8, 9].forEach(function (i) { var r = rooms[i], R = K.rng(i, 72); for (var k = 0; k < 7; k++) dp.push([r.x + (R() - .5) * (r.w - 6), 5.6 + R() * 1.2, r.z + (R() - .5) * (r.d - 6)]); });
      B.WorldADrips.create(window.THREE, env.root, dp, [.55, .8, 1.0]); }
    // ---- bats in the caverns and over the ruined city; mineral motes drifting through the crystal light ----
    if (env.root && B.WorldABats) B.WorldABats.create(window.THREE, env.root, [[0, 7, 8], [-4, 7.5, -18], [-3, 6.5, -148], [4, 6.5, -174], [-4, 6.5, -200], [5, 6.5, -226]], 30);
    [6, 7, 8, 9].forEach(function (i) { var r = rooms[i], R = K.rng(i, 31);
      for (var k = 0; k < 16; k++) K.spr(i, S.mote, r.x + (R() - .5) * (r.w - 4), .5 + R() * 4, r.z + (R() - .5) * (r.d - 4), .045, .045, [.4, 1.1, 1.2], .7, R(), .3 + R() * .4, 2.2); });
    // ---- side nooks: open the wall collider, add the nook's floor, walls and shrine ----
    Object.keys(NOOK).forEach(function (key) {
      var i = +key, r = rooms[i], s = NOOK[i], R = K.rng(i, 909), wx = r.x + s * r.w / 2, t = [.86, .88, .94];
      if (env.colliders) for (var c = env.colliders.length - 1; c >= 0; c--) { var q = env.colliders[c]; if (Math.abs(q.x - wx) < .01 && Math.abs(q.z - r.z) < .01 && Math.abs(q.d - r.d) < .01) env.colliders.splice(c, 1); }
      var seg = (r.d - 4) / 2; [-1, 1].forEach(function (k) { solid(wx, r.z + k * (2 + seg / 2), .7, seg); });
      var nx0 = wx, nx1 = wx + s * 6.6, ncx = (nx0 + nx1) / 2;
      floors.push({ x: ncx, z: r.z, w: 6.8, d: 4 });
      for (var gx = 0; gx < 3; gx++) for (var gz = 0; gz < 2; gz++) { var b = .85 + R() * .25; K.put(i, 'tile', 'floor', wx + s * (1.1 + gx * 2.2), -.07, r.z - 1 + gz * 2, 2.12, .18, 1.92, (R() - .5) * .03, 0, 0, [.8 * b, .84 * b, .94 * b], 0); }
      K.put(i, 'box', 'earth', ncx, -.2, r.z, 7, .36, 4.6, 0, 0, 0, [.7, .7, .72], 0);
      [-1, 1].forEach(function (k) { K.wall(i, ncx, r.z + k * 2.45, 6.8, .9, k < 0 ? 3.8 : 1.2, true, 0, -k, { tint: t, ruin: k < 0 ? .3 : 0, pil: k < 0 ? 3.2 : 0, noPil: k > 0 }); solid(ncx, r.z + k * 2.45, 6.8, .9); });
      K.wall(i, nx1 + s * .45, r.z, 5.8, .9, 3.8, false, -s, 0, { tint: t, ruin: .2, niche: true, noPil: true }); solid(nx1 + s * .45, r.z, .9, 5.8);
      // collapsed masonry heaped against the nook's outer walls blends it into the ruin
      [-1, 1].forEach(function (k) { K.rubble(i, ncx + (R() - .5) * 3, r.z + k * 3.6, 1.8, 14, 1.4, 'stone', t, R); }); K.rubble(i, nx1 + s * 1.6, r.z + (R() - .5) * 2, 1.8, 12, 1.6, 'stone', t, R);
      // lintel over the doorway
      K.put(i, 'block', 'stone', wx, 4.4, r.z, 1.4, .8, 4.8, 0, 0, 0, t, .3);
      // the shrine: a weathered saint at the far end, votive candles, bones of those who prayed here
      K.put(i, 'box', 'stone', nx1 - s * .5, .3, r.z, 1.2, .6, 2.2, 0, 0, 0, t, .5);
      K.statue(i, nx1 - s * .5, r.z, s > 0 ? -PI / 2 : PI / 2, { tint: t, pose: 1, s: .62 });
      solid(nx1 - s * .5, r.z, 1.2, 2.2);
      candles(i, nx1 - s * 1.6, r.z - 1.2, 6, R); candles(i, nx1 - s * 1.6, r.z + 1.3, 5, R);
      skullHeap(i, wx + s * 1.6, r.z + 1.4, .55, 7, R);
      K.dec(i, 3, ncx, r.z, 6, 3.6, 0, [1, 1, 1], .6); K.dec(i, 0, ncx, r.z, 4, 3, R() * 6, [1, 1, 1], .8);
      K.light(i, nx1 - s * 1.8, 1.4, r.z, 0xffa860, 14, 8, { scatter: .7, glow: 1.2, flicker: .25 });
      for (var m = 0; m < 10; m++) K.spr(i, S.mote, ncx + (R() - .5) * 5, .4 + R() * 3, r.z + (R() - .5) * 3, .04, .04, [1.1, .9, .7], .6, R(), .4 + R() * .4, 1.2);
    });
    rooms.forEach(function (r, i) {
      var R = K.rng(i, 4242), cave = i >= 6 && i <= 9, gold = i >= 10, X = function (v) { return r.x + v; }, Z = function (v) { return r.z + v; };
      // ---- broad cave passage to the next room ----
      if (WIDE[i] && i < rooms.length - 1) {
        var n2 = rooms[i + 1], a = r.z - r.d / 2, b = n2.z + n2.d / 2, mid = (a + b) / 2, d = a - b + .1;
        floors.push({ x: 0, z: mid, w: WIDE_W, d: d });
        K.put(i, 'box', 'earth', 0, -.2, mid, WIDE_W + 1, .36, d + .3, 0, 0, 0, [.92, .92, .95], 0);
        for (var p = 0; p < 7; p++) K.put(i, 'rock', 'rock', (R() - .5) * (WIDE_W - 2), .0, mid + (R() - .5) * d, 1.2 + R() * 1.6, .07, 1 + R() * 1.2, R() * 6, 0, 0, [.8, .85, .9], 0);
        [-1, 1].forEach(function (s) {
          // broken shoulders of rock frame the passage; low enough not to hide the fight
          K.rubble(i, s * (WIDE_W / 2 + .3), mid + (R() - .5) * 1.5, 1.6, 12, 1.1, 'rock', [.62, .68, .72], R);
          K.put(i, 'tooth', 'rock', s * (WIDE_W / 2 - .2), .9, mid + (R() - .5) * 2, 1.0, 1.8 + R(), 1.0, R() * 6, 0, s * .15, [.6, .66, .7], .5);
          solid(s * (WIDE_W / 2 - .2), mid, 1.3, 1.6);
        });
        K.dec(i, 4, 0, mid, 6, d + 2, 0, [.55, .54, .52], .8); K.dec(i, 0, (R() - .5) * 4, mid, 5, 5, R() * 6, [1, 1, 1], .8);
      }
      // ---- macro variation: broad soot / dust / damp fields break the slab and plate rhythm ----
      for (var mv = 0; mv < 7; mv++) { var mt = mv % 3; K.dec(i, mt === 0 ? 3 : mt === 1 ? 4 : 9, X((R() - .5) * (r.w - 4)), Z((R() - .5) * (r.d - 4)), 5 + R() * 5, 5 + R() * 5, R() * 6.28, mt === 1 ? [.5, .49, .47] : [1, 1, 1], mt === 2 ? .5 : .55, mt === 2 ? 'wet' : 'matte'); }
      [-1, 1].forEach(function (s) { for (var wb = 0; wb < 5; wb++) K.dec(i, 4, X(s * (r.w / 2 - 1)), Z(-r.d / 2 + 2.2 + wb * (r.d - 4.4) / 4), 2.4, 3.4, R() * .6, [.42, .41, .4], .8); });
      // ---- lived-in floor ----
      pebbles(i, r, cave ? 70 : 46, R, cave ? 'rock' : 'stone', cave ? [.7, .74, .8] : [.85, .84, .82], [7, 5]);
      for (var k = 0; k < (cave ? 18 : 10); k++) { var bx = X((R() - .5) * (r.w - 3)), bz = Z((R() - .5) * (r.d - 3)); bone(i, bx, bz, .25 + R() * .4, R() * 6.28, 0, R); }
      for (var q = 0; q < 4; q++) { var sx = X((R() - .5) * (r.w - 4)), sz = Z((R() - .5) * (r.d - 4)); if (Math.abs(sx - r.x) < 6 && Math.abs(sz - r.z) < 4) continue; skull(i, sx, 0, sz, 1, R() * 6.28, R); }
      for (var c = 0; c < 6; c++) K.dec(i, c % 3 === 0 ? 2 : c % 3 === 1 ? 0 : 3, X((R() - .5) * (r.w - 4)), Z((R() - .5) * (r.d - 4)), 2 + R() * 2.5, 2 + R() * 2.5, R() * 6.28, [1, 1, 1], .7, c % 3 === 0 ? 'wet' : 'matte');
      // ---- edge furniture: skull heaps and votive candles in two corners, chains hanging from the dark ----
      var sgn = i % 2 ? 1 : -1;
      if (i !== 11 && i !== 13) {
        skullHeap(i, X(sgn * (r.w / 2 - 3.4)), Z(r.d / 2 - 2.2), 1.0, 14, R);
        candles(i, X(sgn * (r.w / 2 - 5.2)), Z(r.d / 2 - 1.8), 7, R, gold ? [1.5, .78, .3] : cave ? [1.2, .9, .6] : [1.5, .7, .25]);
        candles(i, X(-sgn * (r.w / 2 - 3.6)), Z(-r.d / 2 + 2.6), 5, R);
      }
      if (!cave) for (var h = 0; h < 4; h++) K.chain(i, X((h % 2 ? 1 : -1) * (r.w / 2 - 1.6 - R())), 7.4, Z((R() - .5) * (r.d - 6)), 2.2 + R() * 2.6, [.55, .5, .46]);
      // ---- caves: stalagmites, mineral veins, drifting bones ----
      if (cave) {
        var tint = [[.62, .72, .78], [.55, .62, .8], [.62, .58, .78], [.6, .76, .68]][i - 6];
        var vein = [[.15, .7, .75], [.2, .7, .9], [.55, .25, .95], [.25, .85, .45]][i - 6];
        [-1, 1].forEach(function (s) {
          stalagmites(i, X(s * 10.4), Z(-6.5 + (s > 0 ? 1.5 : 0)), 5, R, tint);
          stalagmites(i, X(s * 10.8), Z(4.8 - (s > 0 ? 1.2 : 0)), 4, R, tint);
          for (var v = 0; v < 3; v++) K.dec(i, 1, X(s * (8 + R() * 3)), Z((R() - .5) * (r.d - 4)), 4 + R() * 3, 1.2 + R(), R() * 6.28, vein, .55, 'glow');
        });
        skullHeap(i, X(-sgn * (r.w / 2 - 3.2)), Z(1.5), .9, 10, R);
        for (var pd = 0; pd < 3; pd++) K.dec(i, 9, X((R() - .5) * 16), Z((R() - .5) * 14), 2 + R() * 2, 1.6 + R() * 1.6, R() * 6.28, [1, 1, 1], .85, 'wet');
        for (var dr = 0; dr < 10; dr++) K.spr(i, S.ember, X((R() - .5) * (r.w - 4)), .3, Z((R() - .5) * (r.d - 4)), .035, .035, [vein[0] * 1.6, vein[1] * 1.6, vein[2] * 1.6], .9, R(), .05 + R() * .05, 3.5);
      }
      // ---- ruined city: toppled masonry along the wall feet, pottery shards ----
      if (i <= 5) {
        [-1, 1].forEach(function (s) { for (var w = 0; w < 3; w++) K.rubble(i, X(s * (r.w / 2 - .9)), Z(-7 + w * 7 + (R() - .5) * 2), .9, 6, .45, 'stone', [.8, .8, .82], R); });
        // heaved and broken paving: slabs lifted at an angle by roots and collapse, with the earth showing between them
        for (var hv = 0; hv < 9; hv++) { var hx = X((R() > .5 ? 1 : -1) * (5 + R() * 6)), hz = Z((R() - .5) * (r.d - 4)), ha = R() * 6.28;
          K.put(i, 'tile', 'floor', hx, .02 + R() * .12, hz, 1.1 + R() * .9, .16, .9 + R() * .8, ha, (R() - .5) * .5, (R() - .5) * .5, [.8, .8, .84], .4);
          K.dec(i, 4, hx, hz, 2.2, 2.2, ha, [.3, .28, .26], .9); if (R() < .5) K.rubble(i, hx + .6, hz + .4, .5, 4, .2, 'stone', [.8, .8, .82], R); }
        for (var u = 0; u < 5; u++) { var ux = X((R() > .5 ? 1 : -1) * (9.5 + R() * 2)), uz = Z((R() - .5) * (r.d - 5)); K.put(i, 'urn', 'stone', ux, .02 + R() * .05, uz, .3 + R() * .2, .2, .25, R() * 6, PI / 2 * R(), 0, [.75, .58, .45], .3); }
      }
      // ---- the golden halls: scattered offerings ----
      if (gold) {
        for (var g = 0; g < 26; g++) { var gx = X((R() > .5 ? 1 : -1) * (6.5 + R() * 5)), gz = Z((R() - .5) * (r.d - 3));
          K.put(i, 'cyl', 'crystalA', gx, .015, gz, .09, .02, .09, 0, (R() - .5) * .3, (R() - .5) * .3, [1.2, .9, .5], 0); }
        for (var cu = 0; cu < 4; cu++) { var cx = X((cu % 2 ? 1 : -1) * (7 + R() * 3)), cz = Z((R() - .5) * (r.d - 6));
          K.put(i, 'vat', 'iron', cx, .14, cz, .2, .28, .2, R() * 6, R() < .5 ? PI / 2 : 0, 0, [1.3, 1.0, .55], .2); }
        if (i !== 11) [-1, 1].forEach(function (s) { candles(i, X(s * 6.6), Z(-r.d / 2 + 3), 6, R, [1.5, .8, .3]); });
      }
    });
  }
  // Quest anchors (STORY.md: world.questSites), chapter 3 only.
  var SITES = {
    'c3.page1': { x: -21.2, z: -18 },       // Yitik Sütunlar: in the saint's nook behind the west arcade
    'c3.page2': { x: -9.4, z: -145.2 },     // Mağaranın Ağzı: by the crystal seam, west wall
    'c3.chest': { x: 3, z: -297.6 },        // Tahtın Nöbeti: on the red carpet before the throne arch
    'c3.altar': { x: 16.6, z: 8 },          // the hidden altar sits in the shrine nook off the ash road
    'c3.escape': { x: 5, z: -221 },         // Taşın İçindeki Ölüler: the flight starts among the dead in the stone
    'c3.escape-goal': { x: -2.5, z: -270 },   // ... through the broad cave passages to the oath shrine
    'c3.seal1': { x: -4, z: -246 },         // Yutulan Saray: three seals around the swallowed palace floor
    'c3.seal2': { x: -10, z: -252 },
    'c3.seal3': { x: 2, z: -252.5 }
  };
  B.WorldARuins = { active: !/[?&]nowa\b/.test(location.search), dress: dress, wide: WIDE, nook: NOOK, open: OPEN, sites: SITES };
}());
