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
    'c3.page1': { x: -9.4, z: -12 },        // Yitik Sütunlar: by the fallen colonnade shaft
    'c3.page2': { x: -9.4, z: -145.2 },     // Mağaranın Ağzı: by the crystal seam, west wall
    'c3.chest': { x: 3, z: -297.6 }         // Tahtın Nöbeti: on the red carpet before the throne arch
  };
  B.WorldARuins = { active: !/[?&]nowa\b/.test(location.search), dress: dress, wide: WIDE, sites: SITES };
}());
