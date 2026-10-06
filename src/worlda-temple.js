/* KABİR AZABI — I: Kurban Tapınağı, side crypts (ajan: world-a).
   The six side chambers used to be bare boxes. They are rebuilt here with the temple's own kit (world.js passes its
   batched put/box/rod, decals, pooled light sources and prop helpers), so every stone shares the main rooms' shaders,
   instancing and chunk culling. Each chamber has its own story, an uneven silhouette (buttresses, collapsed corners,
   a sunken pit or a raised dais), and its centre stays open for the fight and the quest relics (room centre ±7 x ±5).
   Floors / encounters / navigation rectangles still come from chapter-expansion.js; this file only draws and adds colliders. */
(function () {
  'use strict';
  var B = window.BABA;
  var ROOMS = [
    { id: 7, x: -28, z: -21, w: 22, d: 22, parent: 1, theme: 'ossuary' },
    { id: 8, x: 32, z: -74, w: 26, d: 24, parent: 3, theme: 'lamps' },
    { id: 9, x: 30, z: 4, w: 28, d: 22, parent: 0, theme: 'graves' },
    { id: 10, x: -31, z: -47, w: 28, d: 24, parent: 2, theme: 'flesh' },
    { id: 11, x: 32, z: -101, w: 28, d: 24, parent: 4, theme: 'shroud' },
    { id: 12, x: -30, z: -125, w: 28, d: 20, parent: 5, theme: 'oaths' }
  ];
  var seed = 770131;
  function R() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function U(a, b) { return a + R() * (b - a); }

  function dress(K) {
    var T = K.T, PI = Math.PI, CELL = K.CELL, COL = K.COL, G = K.geometries;
    // ---- extra shapes (owned by world.js' geometry table, so they are disposed with it) -----------------------
    if (!G['wa-rock']) {
      var rk = new T.IcosahedronGeometry(.5, 1), rp = rk.attributes.position;
      for (var v = 0; v < rp.count; v++) { var x = rp.getX(v), y = rp.getY(v), z = rp.getZ(v), f = 1 + .22 * Math.sin(x * 19 + y * 11) * Math.cos(z * 13 - x * 5); rp.setXYZ(v, x * f, y * f * .8, z * f); }
      rk.computeVertexNormals(); G['wa-rock'] = rk;
      G['wa-pebble'] = new T.IcosahedronGeometry(.5, 0);
      var sk = new T.SphereGeometry(1, 7, 5), sp = sk.attributes.position;
      for (var q = 0; q < sp.count; q++) { var qx = sp.getX(q), qy = sp.getY(q), qz = sp.getZ(q), tp = qy < -.1 ? .7 + (qy + 1) * .33 : 1; sp.setXYZ(q, qx * tp, qy, qz * (qz > 0 && qy < 0 ? .8 : 1)); }
      sk.computeVertexNormals(); G['wa-skull'] = sk;
      G['wa-socket'] = new T.IcosahedronGeometry(1, 0);
      G['wa-drum'] = new T.CylinderGeometry(.5, .5, 1, 10, 1);
      var flute = new T.CylinderGeometry(.5, .5, 1, 16, 1), fp = flute.attributes.position;
      for (var w = 0; w < fp.count; w++) { var fx = fp.getX(w), fz = fp.getZ(w), a = Math.atan2(fz, fx), k = 1 - .07 * Math.max(0, Math.cos(a * 8)); fp.setXYZ(w, fx * k, fp.getY(w), fz * k); }
      flute.computeVertexNormals(); G['wa-flute'] = flute;
      G['wa-spike'] = new T.ConeGeometry(.5, 1, 6, 1);
      G['wa-frame'] = new T.TorusGeometry(.5, .06, 4, 16);
      var wedge = new T.Shape(); wedge.moveTo(-.5, -.5); wedge.lineTo(.5, -.5); wedge.lineTo(-.5, .5); wedge.closePath();
      var wg = new T.ExtrudeGeometry(wedge, { depth: 1, bevelEnabled: false }); wg.translate(0, 0, -.5); G['wa-wedge'] = wg;
      var urn = new T.LatheGeometry([new T.Vector2(0, -.5), new T.Vector2(.28, -.5), new T.Vector2(.42, -.25), new T.Vector2(.5, .05), new T.Vector2(.36, .32), new T.Vector2(.22, .4), new T.Vector2(.27, .5), new T.Vector2(0, .5)], 10);
      G['wa-urn'] = urn;
    }
    if (!K.materials['wa-linen']) { var lin = K.materials.shroud.clone(); lin.vertexColors = false; lin.color.copy(K.linear(.55, .47, .34)); lin.roughness = 1; K.materials['wa-linen'] = lin; }
    var put = K.put, box = K.box, rod = K.rod, solid = K.solid;
    function rock(mat, x, y, z, s, sy) { put('wa-rock', mat, x, y, z, s * U(.8, 1.25), (sy || s) * U(.7, 1.1), s * U(.8, 1.25), U(-.4, .4), R() * 6.28, U(-.4, .4), 1); }
    function pile(x, z, r, n, mat) {
      for (var i = 0; i < n; i++) { var a = R() * 6.28, d = Math.sqrt(R()) * r, s = U(.22, .62) * (1 - d / r * .5); rock(i % 4 ? (mat || 'stone') : 'dark', x + Math.cos(a) * d, s * .3 + (1 - d / r) * r * .22, z + Math.sin(a) * d, s); }
      K.floorDecal('matte', CELL.ashPile, x, z, r * 2.7, r * 2.7, null, COL.dust, 1);
    }
    function skull(x, z, s, yaw, y) {
      y = y || 0; var fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
      put('wa-skull', 'bone', x, y + .2 * s, z, .17 * s, .2 * s, .19 * s, U(-.2, .2), yaw, U(-.2, .2), 2);
      [-1, 1].forEach(function (k) { put('wa-socket', 'foundation', x + fx * .14 * s + sx * k * .065 * s, y + .21 * s, z + fz * .14 * s + sz * k * .065 * s, .05 * s, .045 * s, .03 * s, 0, yaw, 0, 2); });
      put('box', 'bone', x + fx * .1 * s, y + .06 * s, z + fz * .1 * s, .14 * s, .06 * s, .1 * s, 0, yaw, 0, 2);
    }
    function skulls(x, z, r, n, y0) {
      // A heap: skulls stacked into a rough cone; bones underneath.
      for (var i = 0; i < n; i++) { var a = R() * 6.28, d = Math.sqrt(R()) * r, h = (1 - d / r) * r * .7; skull(x + Math.cos(a) * d, z + Math.sin(a) * d, U(.85, 1.1), U(-2.4, 2.4), (y0 || 0) + h); }
      for (var j = 0; j < n; j++) { var b = R() * 6.28, e = Math.sqrt(R()) * r * 1.1, l = U(.3, .62), dx = Math.cos(b) * l * .5, dz = Math.sin(b) * l * .5, px = x + Math.cos(b * 1.7) * e, pz = z + Math.sin(b * 1.7) * e, py = (y0 || 0) + .06 + (1 - e / r / 1.1) * r * .45;
        rod('bone', [px - dx, py, pz - dz], [px + dx, py + U(-.08, .08), pz + dz], .032, 2); }
      K.floorDecal('matte', CELL.specks, x, z, r * 3, r * 3, null, COL.dust, 1);
      if (r >= .9) solid(x, z, r * 1.3, r * 1.3);
    }
    function brokenColumn(x, z, h, fallen) {
      put('slab1', 'dark', x, .16, z, 1.25, .32, 1.25, 0, R() * .3, 0);
      put('wa-flute', 'stone', x, .32 + h / 2, z, .72, h, .72, U(-.03, .03), R() * 6, U(-.03, .03));
      put('wa-rock', 'stone', x, .32 + h + .05, z, .66, .3, .66, U(-.3, .3), R() * 6, U(-.3, .3), 1);
      solid(x, z, 1.1, 1.1);
      if (fallen) {
        var a = R() * 6.28;
        for (var i = 0; i < 3; i++) put('wa-flute', i % 2 ? 'stone' : 'pale', x + Math.cos(a) * (1.3 + i * 1.05), .36, z + Math.sin(a) * (1.3 + i * 1.05), .7, .98, .7, PI / 2, -a + PI / 2 + U(-.15, .15), 0, 1);
        pile(x + Math.cos(a) * 1.4, z + Math.sin(a) * 1.4, 1, 7);
      }
      K.floorDecal('matte', CELL.mould, x, z, 2.6, 2.6, null, COL.grime, 1);
    }
    function candleStand(x, z, h, lit) {
      put('wa-drum', 'iron', x, h / 2, z, .07, h, .07, 0, 0, 0);
      put('wa-drum', 'iron', x, .03, z, .5, .06, .5, 0, 0, 0, 1);
      put('bowl', 'iron', x, h, z, .22, .16, .22, 0, 0, 0, 1);
      for (var i = 0; i < 3; i++) { var a = i * 2.09 + .3, ch = U(.12, .3); put('pole', 'wax', x + Math.cos(a) * .1, h + .03 + ch / 2, z + Math.sin(a) * .1, .045, ch, .045, 0, 0, 0, 1);
        if (lit) K.flame(x + Math.cos(a) * .1, h + .09 + ch, z + Math.sin(a) * .1, .07, .14, 'fire', false, false); }
      // wax tears running down the stand
      put('pole', 'wax', x + .05, h - .12, z, .03, .26, .03, .1, 0, 0, 2);
      if (lit) K.lightSource(x, h + .5, z, '#ffab5c', 4.5, 5.5, .5, { kind: 'candle' });
      K.floorDecal('matte', CELL.wax, x, z, .9, .9, null, COL.wax, 1);
    }
    function urnRow(x, z, n, dx, dz) { for (var i = 0; i < n; i++) put('wa-urn', i % 3 ? 'pale' : 'dark', x + dx * i, .33, z + dz * i, U(.42, .55), U(.55, .75), U(.42, .55), 0, R() * 6, 0, 1); }
    function chainsUp(x, z, y, len) { K.chain(x, y, z, len, 'y', 1); }
    function bloodTrail(x0, z0, x1, z1) { var n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.3); for (var i = 0; i <= n; i++) K.floorDecal('wet', i % 3 ? CELL.bloodSmear : CELL.bloodDrip, x0 + (x1 - x0) * i / n + U(-.2, .2), z0 + (z1 - z0) * i / n, U(.8, 1.3), U(1.1, 1.7), Math.atan2(x1 - x0, z1 - z0) + U(-.3, .3), i % 2 ? COL.oldBlood : COL.blood, 1); }

    // Floor slabs, skipping holes (pits). Same chipped slab kit as the main halls, its own row rhythm.
    function floorTiles(x, z, w, d, holes, rowD, pale) {
      var rows = Math.ceil(d / (rowD || 1.4)), td = d / rows;
      // foundation under the slabs, cut open around pits so their shafts stay visible
      if (!holes.length) K.box('foundation', x, -.34, z, w + .24, .54, d + .24);
      else { var o = holes[0], x0 = x - w / 2 - .12, x1 = x + w / 2 + .12, z0 = z - d / 2 - .12, z1 = z + d / 2 + .12, hx0 = o.x - o.w / 2, hx1 = o.x + o.w / 2, hz0 = o.z - o.d / 2, hz1 = o.z + o.d / 2;
        [[x0, x1, z0, hz0], [x0, x1, hz1, z1], [x0, hx0, hz0, hz1], [hx1, x1, hz0, hz1]].forEach(function (q) { if (q[1] - q[0] > .01 && q[3] - q[2] > .01) K.box('foundation', (q[0] + q[1]) / 2, -.34, (q[2] + q[3]) / 2, q[1] - q[0], .54, q[3] - q[2]); }); }      for (var iz = 0; iz < rows; iz++) {
        var laid = 0, ix = 0;
        while (laid < w - .001) {
          var tw = Math.min(w - laid, U(1.1, 2.4)); if (ix === 0 && iz % 2) tw *= .6; if (w - laid - tw < .35) tw = w - laid;
          var px = x - w / 2 + laid + tw / 2, pz = z - d / 2 + (iz + .5) * td, skip = false;
          for (var h = 0; h < holes.length; h++) { var o = holes[h]; if (Math.abs(px - o.x) < o.w / 2 + tw / 2 - .05 && Math.abs(pz - o.z) < o.d / 2 + td / 2 - .05) skip = true; }
          if (!skip) {
            var v = U(.7, 1.04), shade = new T.Color().setRGB(v * U(.95, 1.03), v, v * U(.96, 1.02));
            var broken = R() < .07, sink = broken ? -.03 : U(-.005, .005);
            put('slab' + Math.floor(R() * 4), pale && R() < .1 ? 'pale' : 'floor', px, -.141 + sink, pz, tw - .045, .24, td - .045, broken ? U(-.03, .03) : 0, Math.floor(R() * 2) * PI, broken ? U(-.03, .03) : 0, 0, shade);
            if (R() < .16) K.floorDecal('matte', CELL.cracks, px + U(-.4, .4), pz + U(-.3, .3), U(.7, 1.4), U(.7, 1.4), null, COL.crack, 1);
          }
          laid += tw; ix++;
        }
      }
    }
    // Pit: masonry shaft going down into darkness, coping stones and a collider around it.
    function pit(o, depth, glow) {
      var hx = o.w / 2, hz = o.d / 2;
      solid(o.x, o.z, o.w + .3, o.d + .3);
      [[0, -hz, o.w, 'x'], [0, hz, o.w, 'x'], [-hx, 0, o.d, 'z'], [hx, 0, o.d, 'z']].forEach(function (s) {
        var cx = o.x + s[0], cz = o.z + s[1], len = s[2];
        for (var c = 0; c < Math.ceil(depth / .55); c++) {
          var y = -.3 - c * .55;
          for (var p = 0; p < Math.ceil(len / 1.3); p++) {
            var off = -len / 2 + (p + .5) * len / Math.ceil(len / 1.3) + (c % 2 ? .3 : 0);
            if (Math.abs(off) > len / 2) continue;
            var col = new T.Color().setScalar(U(.55, .95) * (1 - c / Math.ceil(depth / .55) * .6));
            if (s[3] === 'x') put('box', 'stone', cx + off, y, cz, len / Math.ceil(len / 1.3) - .05, .5, .5, 0, 0, 0, 1, col);
            else put('box', 'stone', cx, y, cz + off, .5, .5, len / Math.ceil(len / 1.3) - .05, 0, 0, 0, 1, col);
          }
        }
        // coping: chipped rim stones
        for (var q = 0; q < Math.ceil(len / 1.1); q++) {
          var o2 = -len / 2 + (q + .5) * len / Math.ceil(len / 1.1);
          if (s[3] === 'x') put('slab' + q % 4, 'pale', cx + o2, .1, cz, len / Math.ceil(len / 1.1) - .04, .26, .62, 0, 0, U(-.04, .04), 0, new T.Color().setScalar(U(.7, 1)));
          else put('slab' + q % 4, 'pale', cx, .1, cz + o2, .62, .26, len / Math.ceil(len / 1.1) - .04, U(-.04, .04), 0, 0, 0, new T.Color().setScalar(U(.7, 1)));
        }
      });
      K.box('foundation', o.x, -depth - .3, o.z, o.w, .2, o.d);
      // What was thrown down: a slope of bones and skulls at the bottom.
      for (var i = 0; i < 18; i++) skull(o.x + U(-hx + .4, hx - .4), o.z + U(-hz + .4, hz - .4), U(.9, 1.2), U(-3, 3), -depth - .2 + U(0, .4));
      for (var j = 0; j < 30; j++) { var bx = o.x + U(-hx + .3, hx - .3), bz = o.z + U(-hz + .3, hz - .3), ba = R() * 6.28, by = -depth - .12 + U(0, .35);
        rod('bone', [bx - Math.cos(ba) * .3, by, bz - Math.sin(ba) * .3], [bx + Math.cos(ba) * .3, by + U(-.1, .1), bz + Math.sin(ba) * .3], .035, 2); }
      if (glow) {
        K.decal('glow', CELL.glow, o.x, -depth - .18, o.z, o.w * 1.3, o.d * 1.1, 0, glow, 0);
        K.lightSource(o.x, -depth + 1.2, o.z, '#ff3a12', 14, 9, .5, { kind: 'special', scatter: .9, glowRadius: 1.6 });
        K.emberSources.push({ x: o.x, y: -depth + .3, z: o.z, count: 10, spread: Math.min(hx, hz) * .8, rise: depth + 2.5 });
      }
    }
    function niches(r, axisX, at, from, to, angle, kind) {
      // A row of pointed burial niches along a wall face.
      var step = 2.6;
      for (var p = from; p <= to + .01; p += step) {
        var x = axisX ? p : at, z = axisX ? at : p;
        K.alcove(x, z, 2.0, 3.3, angle, kind === 'saint' ? 'saint' : kind === 'bones');
        var nx = Math.sin(angle), nz = Math.cos(angle);
        if (kind === 'bones') { for (var s = 0; s < 3; s++) skull(x + Math.cos(angle) * (s - 1) * .45 + nx * .2, z - Math.sin(angle) * (s - 1) * .45 + nz * .2, .95, angle + U(-.4, .4), .5 + (s === 1 ? .32 : 0)); }
        else if (kind === 'urns') urnRow(x - Math.cos(angle) * .5 + nx * .22, z + Math.sin(angle) * .5 + nz * .22, 3, Math.cos(angle) * .5, -Math.sin(angle) * .5);
        K.wallDecal('matte', CELL.grimeStreak, x + nx * .41, U(1.4, 2.4), z + nz * .41, U(1.2, 1.8), U(2.2, 3.4), angle, COL.grime, 1);
      }
    }
    // Light masonry wall: one solid core (collider + shadow) with a brick skin on the face(s) the camera sees.
    // ~12 triangles per brick instead of the chipped-slab kit (keeps the side crypts cheap in the shadow passes).
    function wallLite(x, z, length, axis, height, face) {
      var w = axis === 'x' ? length : .75, d = axis === 'z' ? length : .75;
      solid(x, z, w, d);
      box('dark', x, height / 2, z, w, height, d);
      var courses = Math.max(1, Math.floor(height / .56)), h = height / courses, pieces = Math.ceil(length / 1.5), step = length / pieces;
      [-1, 1].forEach(function (side) {
        if (face && side !== face) return;
        for (var row = 0; row < courses; row++) for (var j = 0; j <= pieces; j++) {
          var left = Math.max(-length / 2, -length / 2 + (j - (row % 2) * .5) * step), right = Math.min(length / 2, -length / 2 + (j + 1 - (row % 2) * .5) * step);
          if (right - left < .05) continue;
          var off = (left + right) / 2, bl = right - left - .05, shade = new T.Color().setScalar(U(.7, 1.08)), pr = U(.0, .035);
          if (axis === 'x') put('box', 'stone', x + off, (row + .5) * h, z + side * (.39 + pr), bl, h - .05, .08, 0, 0, 0, 1, shade);
          else put('box', 'stone', x + side * (.39 + pr), (row + .5) * h, z + off, .08, h - .05, bl, 0, 0, 0, 1, shade);
        }
      });
      box('dark', x, .19, z, w + (axis === 'z' ? .25 : 0), .38, d + (axis === 'x' ? .25 : 0));
      var caps = Math.ceil(length / 1.42), span = length / caps;
      for (var q = 0; q < caps; q++) { var o = -length / 2 + (q + .5) * span;
        put('box', 'stone', x + (axis === 'x' ? o : 0), height + .045, z + (axis === 'z' ? o : 0), axis === 'x' ? span - .04 : .94, .19, axis === 'z' ? span - .04 : .94, 0, 0, 0, 0, new T.Color().setScalar(.7 + q % 3 * .06)); }
    }
    // Shell: masonry walls (collider), the doorway towards the main hall, a low front parapet, buttresses and corner collapse.
    function shell(r) {
      var s = r.x < 0 ? 1 : -1, edge = r.x + s * r.w / 2, back = r.x - s * r.w / 2, north = r.z - r.d / 2, south = r.z + r.d / 2;
      var main = K.rooms[r.parent], mainEdge = main.x - s * main.w / 2;
      // passage floor and walls
      var cx = (edge + mainEdge) / 2, clen = Math.abs(edge - mainEdge);
      floorTiles(cx, r.z, clen + .1, 6, [], 1.2);
      wallLite(cx, r.z - 3.5, clen - .1, 'x', 2.6, 1);
      wallLite(cx, r.z + 3.5, clen - .1, 'x', 1.0, -1);
      K.floorDecal('matte', CELL.mould, cx, r.z, clen + 1, 4.4, 0, COL.grime, 0);
      // solid masonry between the two halls on either side of the passage (no dark slot between the walls)
      var mainHalf = main.d / 2, fillLen = Math.max(r.d / 2, mainHalf) - 3.9;
      [-1, 1].forEach(function (k) {
        var h = k < 0 ? 4.25 : 1.0, fz = r.z + k * (3.9 + fillLen / 2), fw = Math.max(.1, clen - .75);
        box('dark', cx, h / 2, fz, fw, h, fillLen);
        for (var q = 0; q < Math.ceil(fillLen / 1.4); q++) put('box', 'stone', cx, h + .045, r.z + k * (3.9 + (q + .5) * fillLen / Math.ceil(fillLen / 1.4)), fw + .2, .19, fillLen / Math.ceil(fillLen / 1.4) - .04, 0, 0, 0, 0, new T.Color().setScalar(.62 + q % 3 * .06));
        solid(cx, fz, fw, fillLen);
      });
      // doorway frame: two heavy jambs and a lintel with hanging chain
      [-1, 1].forEach(function (k) {
        put('slab2', 'dark', edge, 1.6, r.z + k * 3.25, 1.2, 3.2, .9, 0, 0, 0);
        put('slab0', 'pale', edge, 3.3, r.z + k * 3.25, 1.35, .3, 1.05, 0, 0, 0);
      });
      put('slab1', 'stone', edge, 3.75, r.z, 1.15, .65, 7.4, 0, 0, 0);
      K.chain(edge - s * .2, 3.35, r.z + 1.4, 1.2, 'y', 1);
      // walls
      [-1, 1].forEach(function (k) { var len = (r.d - 6) / 2; wallLite(edge, r.z + k * (3 + len / 2), len, 'z', 4.25, -s); });
      wallLite(back, r.z, r.d, 'z', 4.8, s);
      wallLite(r.x, north, r.w + .75, 'x', 4.8, 1);
      wallLite(r.x, south, r.w + .75, 'x', 1.15, 0);
      // vault springers along the two long walls (with their footprint as collider)
      [r.z - r.d * .3, r.z + r.d * .3].forEach(function (z) {
        K.vaultRib(r, z, -s); solid(back + s * .55, z, 1.1, 1.3);
        K.vaultRib(r, z, s); solid(edge - s * .55, z, 1.1, 1.3);
      });
      // north-wall buttresses with stepped plinths break the straight line
      [-.32, .32].forEach(function (f) {
        var bx = r.x + f * r.w;
        put('slab0', 'dark', bx, 2.3, north + .75, 1.3, 4.6, 1.1, 0, 0, 0);
        put('slab2', 'pale', bx, 4.7, north + .75, 1.5, .3, 1.3, 0, 0, 0);
        put('slab1', 'stone', bx, .3, north + 1.05, 1.7, .6, 1.5, 0, 0, 0);
        put('wa-wedge', 'stone', bx, 1.0, north + 1.45, 1.3, .8, .6, 0, PI / 2, 0);
        solid(bx, north + .9, 1.7, 1.6);
      });
      // collapsed back corner: fallen vault stones and a heap against the wall
      var cz = R() < .5 ? north + 2.2 : south - 2.4;
      pile(back + s * 1.9, cz, 1.9, 18);
      put('slab3', 'stone', back + s * 2.6, .35, cz + .6, 2.4, .5, 1.1, .3, .7, .2, 0);
      put('slab1', 'pale', back + s * 1.5, .55, cz - .5, 1.8, .45, .9, -.4, -.4, .3, 0);
      solid(back + s * 1.7, cz, 3, 3.2);
      // wall stains, soot and cracks
      for (var i = 0; i < 7; i++) {
        var wz = r.z + U(-r.d / 2 + 1.5, r.d / 2 - 1.5);
        K.wallDecal('matte', i % 2 ? CELL.grimeStreak : CELL.rustStreak, back + s * .4, U(1.8, 3.2), wz, U(1, 1.8), U(2, 3.4), s * PI / 2, i % 2 ? COL.grime : COL.rust, 1);
        var wx = r.x + U(-r.w / 2 + 1.5, r.w / 2 - 1.5);
        K.wallDecal('matte', i % 3 ? CELL.grimeStreak : CELL.bloodDrip, wx, U(1.8, 3.2), north + .4, U(1, 1.8), U(2, 3.2), 0, i % 3 ? COL.grime : COL.oldBlood, 1);
      }
      // grime and dust collect along the wall feet
      for (var e = 0; e < 6; e++) {
        K.floorDecal('matte', CELL.mould, back + s * 1.1, r.z + (e - 2.5) * r.d / 6, 2.4, 3.6, null, COL.grime, 1);
        K.floorDecal('matte', CELL.ashPile, r.x + (e - 2.5) * r.w / 6, north + 1.2, 3, 2, null, COL.dust, 1);
      }
      return { s: s, edge: edge, back: back, north: north, south: south };
    }


    function lamp(x, z, y, sick) {
      // a hanging cage lamp on a chain from the dark vault
      var parts = { iron: [], hot: [] };
      for (var i = 0; i < 6; i++) parts.iron.push(K.part('link', 0, -i * .19, 0, .085, .15, .085, 0, i % 2 * PI / 2, 0));
      parts.iron.push(K.part('cone', 0, -1.25, 0, .24, .2, .24));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { parts.iron.push(K.part('box', c[0] * .15, -1.55, c[1] * .15, .03, .5, .03)); });
      parts.iron.push(K.part('octagon', 0, -1.82, 0, .22, .05, .22));
      parts[sick ? 'sickEmber' : 'hot'] = [K.part('octagon', 0, -1.77, 0, .07, .06, .07)];
      if (sick) delete parts.hot;
      var g = K.hangerGroup(x, y, z, parts, false);
      var f = K.flame(x, y - 1.62, z, .24, .4, sick ? 'sick' : 'fire', true, true);
      var src = K.lightSource(x, y - 1.55, z, sick ? '#a9d75c' : '#ff8a3c', sick ? 14 : 18, 10, .9, { kind: sick ? 'lamp' : 'lantern' });
      K.swinging(g, src, f, .025, U(.8, 1.2));
    }
    function deadLamp(x, z, y, links, into) {
      // parts are relative to the shared group origin (into.x0, 5.4, into.z0): one mesh per material for the whole hall
      if (into.x0 == null) { into.x0 = x; into.y0 = y; into.z0 = z; }
      var ox = x - into.x0, oy = y - into.y0, oz = z - into.z0, parts = { iron: [] };
      parts.iron.push(K.part('pole', 0, (11 - y) / 2, 0, .028, 11 - y, .028));
      for (var i = 0; i < (links || 6); i++) parts.iron.push(K.part('link', 0, -i * .19, 0, .085, .15, .085, 0, i % 2 * PI / 2, 0));
      var b = -(links || 6) * .19 - .3;
      parts.iron.push(K.part('cone', 0, b, 0, .22, .18, .22));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { parts.iron.push(K.part('box', c[0] * .14, b - .3, c[1] * .14, .03, .46, .03)); });
      parts.iron.push(K.part('octagon', 0, b - .55, 0, .2, .05, .2));
      parts.wax = [K.part('pole', 0, b - .44, 0, .06, .18, .06)];
      var off = new T.Matrix4().makeTranslation(ox, oy, oz);
      parts.iron.forEach(function (p) { p.matrix.premultiply(off); into.iron.push(p); });
      parts.wax.forEach(function (p) { p.matrix.premultiply(off); into.wax.push(p); });
    }

    var THEMES = {
      // Unutulanların Mahzeni — skull walls, a bone pit along the back wall, ossuary heaps.
      ossuary: function (r, S, holes) {
        pit(holes[0], 5.5, K.linear(.16, .03, .01));
        niches(r, false, S.back + S.s * .39, r.z - 8, r.z - 6.5, S.s * PI / 2, 'bones');
        niches(r, false, S.back + S.s * .39, r.z + 6, r.z + 7, S.s * PI / 2, 'bones');
        niches(r, true, S.north + .39, r.x - 3.2, r.x + 3.2, 0, 'bones');
        // skull walls: stacked rows of skulls on shelves against the north wall corners
        [-1, 1].forEach(function (k) {
          var bx = r.x + k * (r.w / 2 - 1.9);
          for (var row = 0; row < 4; row++) {
            put('slab' + row % 4, 'dark', bx, .4 + row * .62, S.north + .62, 2.6, .08, .5, 0, 0, 0, 1);
            for (var c = 0; c < 6; c++) skull(bx - 1.1 + c * .44, S.north + .66, .95, U(-.25, .25), .44 + row * .62);
          }
          solid(bx, S.north + .7, 2.8, .9);
        });
        skulls(S.back + S.s * 3.4, r.z + 5.6, 1.1, 16);
        skulls(r.x + S.s * 6.3, r.z - 7.6, .9, 11);
        K.ribCage(r.x - S.s * 2.5, r.z + 7.2, .7);
        K.boneScatter(r.x + 2, r.z - 4.5, 7, 1.1);
        brokenColumn(r.x + S.s * 6.5, r.z + 6.5, 2.1, true);
        candleStand(S.back + S.s * 5.8, r.z - 6.3, 1.3, true);
        candleStand(S.back + S.s * 5.8, r.z + 3.6, 1.1, true);
        K.candleCluster(r.x - 1.5, S.north + 2.1, 7);
        K.candleCluster(r.x + 2.6, S.north + 2.0, 5);
        K.sconce(S.edge - S.s * .44, r.z - 7, 2.4, -S.s * PI / 2, false);
        K.sconce(S.edge - S.s * .44, r.z + 7, 2.4, -S.s * PI / 2, false);
        chainsUp(S.back + S.s * 3.4, r.z - 3, 4.6, 3.4); chainsUp(S.back + S.s * 3.0, r.z + 1.6, 4.6, 4.2);
        K.hangingIron(S.back + S.s * 3.8, r.z - .5, 4.9, false, 13);
        for (var b = 0; b < 8; b++) K.floorDecal('wet', b % 2 ? CELL.bloodSpatter : CELL.bloodPool, r.x + U(-6, 6), r.z + U(-6, 6), U(.8, 1.8), U(.8, 1.8), null, COL.oldBlood, 1);
        K.decal('glow', CELL.glow, holes[0].x, .02, holes[0].z, 4.5, 10, 0, K.linear(.05, .012, .004), 1);
      },
      // Sönmüş Kandiller — a forest of dead hanging lamps, a fallen chandelier, rows of guttered candles.
      lamps: function (r, S) {
        var deadParts = { iron: [], wax: [], x0: null };
        for (var i = 0; i < 12; i++) {
          var lx = r.x + U(-r.w / 2 + 2.5, r.w / 2 - 2.5), lz = r.z + U(-r.d / 2 + 2.5, r.d / 2 - 2.5);
          if (i < 3) lamp(lx, lz, 5.2, false); else deadLamp(lx, lz, U(4.6, 5.6), Math.floor(U(4, 12)), deadParts, r);
        }
        if (deadParts.iron.length) K.hangerGroup(deadParts.x0, deadParts.y0, deadParts.z0, { iron: deadParts.iron, wax: deadParts.wax }, false);
        // fallen chandelier: a great iron ring cracked into the floor, candles spilled
        var cx = r.x - S.s * 6.5, cz = r.z - 6.5;
        put('wa-frame', 'iron', cx, .12, cz, 4.2, 4.2, 3.2, PI / 2 - .05, .3, .04);
        put('wa-frame', 'rust', cx, .1, cz, 2.6, 2.6, 2.4, PI / 2 + .04, .3, -.03);
        for (var sp = 0; sp < 8; sp++) { var a = sp / 8 * 6.28; rod('iron', [cx, .2, cz], [cx + Math.cos(a) * 2.05, .12, cz + Math.sin(a) * 2.05], .04, 1);
          put('bowl', 'iron', cx + Math.cos(a) * 2.1, .14, cz + Math.sin(a) * 2.1, .16, .12, .16, U(-.5, .5), 0, U(-.5, .5), 1); }
        K.chain(cx + .3, .1, cz - .6, 3.3, 'x', 1);
        K.floorDecal('matte', CELL.cracks, cx, cz, 5, 5, null, COL.crack, 0);
        K.floorDecal('matte', CELL.wax, cx, cz, 4.6, 4.6, null, COL.wax, 1);
        solid(cx, cz, 3.2, 3.2);
        // rows of candle stands along the walls, most dead
        for (var k = 0; k < 7; k++) {
          var z = r.z - r.d / 2 + 2.6 + k * (r.d - 5.2) / 6;
          candleStand(S.back + S.s * 1.6, z, U(1, 1.4), k % 2 === 0);
        }
        for (var n = 0; n < 6; n++) candleStand(r.x + (n - 2.5) * 3.3, S.north + 2.4, U(1.1, 1.5), n % 2 === 0);
        // wax-buried altar against the north wall
        var ax = r.x + S.s * 3;
        put('slab3', 'dark', ax, .5, S.north + 1.5, 3.2, 1, 1.4, 0, 0, 0); put('slab1', 'pale', ax, 1.05, S.north + 1.5, 3.5, .15, 1.6, 0, 0, 0);
        solid(ax, S.north + 1.5, 3.6, 1.7);
        for (var c = 0; c < 22; c++) { var h = U(.1, .55); put('pole', 'wax', ax + U(-1.6, 1.6), 1.12 + h / 2, S.north + 1.5 + U(-.6, .6), U(.05, .09), h, .07, 0, 0, 0, 1); }
        for (var m = 0; m < 5; m++) put('pole', 'wax', ax + U(-1.6, 1.6), .55, S.north + 2.25, .06, U(.4, 1), .04, .05, 0, 0, 2);
        K.candleCluster(ax - .8, S.north + 3.0, 6); K.candleCluster(ax + 1.3, S.north + 2.9, 4);
        K.sconce(S.back + S.s * .44, r.z, 2.5, S.s * PI / 2, false);
        urnRow(r.x - S.s * 8.4, S.north + 1.1, 5, S.s * .7, 0);
        // a heap of fallen lanterns swept against the south-west wall, one still smouldering
        var hx = r.x + S.s * 8.6, hz = r.z + 3.2;
        for (var lh = 0; lh < 14; lh++) { var la = R() * 6.28, ld = Math.sqrt(R()) * 1.3, ly = (1 - ld / 1.3) * .5;
          put('cone', 'iron', hx + Math.cos(la) * ld, .12 + ly, hz + Math.sin(la) * ld, .2, .16, .2, U(-1.4, 1.4), R() * 6, U(-1.4, 1.4), 1);
          put('octagon', lh % 3 ? 'iron' : 'rust', hx + Math.cos(la + 1) * ld, .05 + ly * .8, hz + Math.sin(la + 1) * ld, .18, .04, .18, U(-1, 1), 0, U(-1, 1), 1); }
        solid(hx, hz, 2.2, 2.2);
        K.flame(hx + .2, .55, hz - .2, .16, .3, 'fire', true, true); K.lightSource(hx, .9, hz, '#ff7a30', 10, 7, 1, { kind: 'candle' });
        K.decal('glow', CELL.glow, hx, .02, hz, 3.2, 3.2, 0, K.linear(.06, .022, .006), 1);
        K.candleCluster(r.x + S.s * 4.2, r.z + 7.6, 6); K.candleCluster(r.x - S.s * 3.6, r.z + 7.9, 5);
        for (var wr = 0; wr < 6; wr++) K.floorDecal('matte', CELL.wax, r.x + S.s * (3 + wr * .9), S.north + 3.2 + wr * .5, .9, 1.4, U(-.4, .4), COL.wax, 1);
        pile(r.x + S.s * 7.5, r.z + 7.6, 1.4, 12);
        brokenColumn(r.x - S.s * 8, r.z + 7, 1.6, false);
        for (var d = 0; d < 9; d++) K.floorDecal('matte', CELL.wax, r.x + U(-9, 9), r.z + U(-8, 8), U(.6, 1.2), U(.6, 1.2), null, COL.wax, 1);
        for (var e = 0; e < 7; e++) K.floorDecal('matte', CELL.soot, r.x + U(-10, 10), r.z + U(-9, 9), U(1, 2), U(1, 2), null, COL.soot, 1);
      },
      // İsimsizlerin Mezarı — rows of sunken sarcophagi, toppled grave monuments, an open mass grave.
      graves: function (r, S, holes) {
        pit(holes[0], 2.4, null);
        // mourners' candles along the rim of the open grave; a cold glow from the bodies below
        for (var mc = 0; mc < 4; mc++) K.candleCluster(holes[0].x - 3 + mc * 2, holes[0].z + 2.2, 3);
        K.decal('glow', CELL.glow, holes[0].x, -2.5, holes[0].z, 7, 3.2, 0, K.linear(.03, .04, .06), 0);
        K.lightSource(holes[0].x, -.6, holes[0].z, '#8aa6d8', 8, 6, .2, { kind: 'special', scatter: .6, glowRadius: 1.2 });
        if (K.ritualPavement) { K.ritualPavement(r.x, r.z + 2.5, 3.2, true); K.floorRing(r.x, r.z + 2.5, 3.28, .1, 'dark~p'); }
        // bodies in the mass grave: shrouded shapes half-buried
        for (var b = 0; b < 4; b++) put('wa-drum', 'wa-linen', holes[0].x - 2.4 + b * 1.6, -2.35, holes[0].z + U(-.6, .6), .55, 1.7, .5, PI / 2, U(-.3, .3), 0, 1);
        // sarcophagi rows on either side of the open centre
        [-1, 1].forEach(function (k) {
          for (var n = 0; n < 3; n++) {
            var x = r.x + k * (r.w / 2 - 3.2), z = r.z - 4.6 + n * 4.6;
            if (Math.abs(z - r.z) < 1 && k === S.s) continue;
            K.slab(x, z, U(-.08, .08), n === 1 && k < 0);
            put('slab2', 'stone', x, 1.75, z - 1.25, 1.3, 1.5, .26, U(-.12, .12), 0, U(-.08, .08));   // grave marker
            put('wa-rock', 'stone', x, 2.55, z - 1.25, .5, .4, .26, 0, 0, 0, 1);
            if (n !== 1) K.candleCluster(x + k * -1.4, z + 1.2, 3);
          }
        });
        // toppled monuments and a mourning statue at the north wall
        K.funeraryEffigy(r.x + 4.4, S.north + .55, 0, 1.15);
        K.funeraryEffigy(r.x - 6.6, S.north + .55, 0, 1.0);
        solid(r.x + 4.4, S.north + .9, 1.4, 1.4); solid(r.x - 6.6, S.north + .9, 1.4, 1.4);
        put('slab2', 'stone', r.x + 9, .45, S.north + 2.6, 1.3, .7, 3, .1, .5, 1.45); solid(r.x + 9, S.north + 2.6, 2, 2.8);
        brokenColumn(r.x - 10.6, r.z + 7.6, 2.4, true);
        brokenColumn(r.x + 10.6, r.z + 7.4, 1.4, false);
        K.torch(holes[0].x - 4.4, holes[0].z + 1.5, 2.0, true);
        K.torch(holes[0].x + 4.4, holes[0].z + 1.5, 2.0, false);
        for (var g = 0; g < 10; g++) K.floorDecal('matte', g % 2 ? CELL.mould : CELL.ashPile, r.x + U(-11, 11), r.z + U(-8, 8), U(1.6, 3), U(1.6, 3), null, g % 2 ? COL.mould : COL.dust, 1);
        bloodTrail(holes[0].x + 2.5, holes[0].z + 2, r.x + 1, r.z + 6);
        urnRow(S.back + S.s * 1.2, r.z - 7.2, 4, 0, .75);
        K.hangingIron(r.x - 2, r.z + 2.5, 5, true);
      },
      // Yitik Etler Reviri — mortuary tables with shrouded dead, cages, hanging bodies, blood channels, sickly lamps.
      flesh: function (r, S) {
        [-1, 1].forEach(function (k) {
          for (var n = 0; n < 2; n++) {
            var x = r.x + k * 6.4, z = r.z + (n ? 6.2 : -6.4);
            // stone mortuary table
            put('slab3', 'dark', x, .45, z, 1.5, .9, 2.6, 0, 0, 0); put('slab1', 'pale', x, .95, z, 1.9, .14, 3.0, 0, 0, 0);
            put('box', 'groove', x, 1.03, z, .14, .02, 2.6, 0, 0, 0, 1);
            K.shroudedRemains(x, z, U(-.05, .05));
            solid(x, z, 2, 3.1);
          }
        });
        K.cage(S.back + S.s * 2.2, r.z - 7.4, 2.4, 3.2, 2.8);
        K.cage(S.back + S.s * 2.2, r.z + 6.8, 2.4, 3.2, 2.8);
        K.hangedBody(r.x - S.s * 2.2, r.z - 2.5, 5.2, .4);
        K.hangedBody(r.x + S.s * 3.6, r.z + 3.2, 5.0, -.8);
        lamp(r.x, r.z - 4, 5.2, true); lamp(r.x - S.s * 4, r.z + 5, 5.2, true);
        K.puddle(r.x + 1.2, r.z + 1.4, 1.6, 1.2, 'blood');
        // iron drain in the floor: the blood runs here
        put('slab2', 'dark', r.x + .6, -.115, r.z + .9, 1.6, .24, 1.6, 0, .2, 0, 0); put('box', 'foundation', r.x + .6, -.06, r.z + .9, 1.1, .1, 1.1, 0, .2, 0);
        for (var gr = -2; gr <= 2; gr++) put('box', 'rust', r.x + .6 + Math.cos(.2) * gr * .22, .012, r.z + .9 - Math.sin(.2) * gr * .22, .06, .04, 1.15, 0, .2, 0, 1);
        bloodTrail(r.x + 6.4, r.z - 5, r.x + 1.5, r.z + .6);
        bloodTrail(r.x - 6.4, r.z + 5, r.x + .6, r.z + 1.8);
        // blood gutter along the north wall with a drain
        box('groove', r.x, .012, S.north + 1.6, r.w - 4, .02, .35, 0, 1);
        K.floorDecal('wet', CELL.bloodSmear, r.x - 3, S.north + 1.6, 1, 6, PI / 2, COL.blood, 1);
        // shelves with jars against the north wall
        [-1, 1].forEach(function (k) { var bx = r.x + k * 8.6;
          for (var row = 0; row < 3; row++) { put('box', 'wood', bx, .6 + row * .8, S.north + .7, 3, .07, .6, 0, 0, 0); urnRow(bx - 1.2, S.north + .7, 5, .6, 0); }
          for (var j = 0; j < 2; j++) put('box', 'wood', bx + (j ? 1.45 : -1.45), 1.2, S.north + .7, .08, 2.4, .6, 0, 0, 0);
          solid(bx, S.north + .7, 3.2, 1);
        });
        K.ribCage(r.x + S.s * 9.5, r.z + .4, 1.2);
        skulls(S.back + S.s * 1.6, r.z - 1.2, .8, 8);
        K.sconce(S.edge - S.s * .44, r.z - 7.5, 2.4, -S.s * PI / 2, true);
        K.sconce(S.back + S.s * .44, r.z + 1.6, 2.4, S.s * PI / 2, true);
        for (var f = 0; f < 6; f++) K.floorDecal('matte', CELL.mould, r.x + U(-11, 11), r.z + U(-9, 9), U(2, 3.4), U(2, 3.4), null, COL.bile, 1);
      },
      // Kefen Dokuma Odası — looms strung with grey shrouds, shroud bolts, spindles, a wall of hung linen.
      shroud: function (r, S) {
        function loom(x, z, yaw) {
          var c = Math.cos(yaw), sn = Math.sin(yaw);
          function at(dx, dz) { return [x + c * dx + sn * dz, z - sn * dx + c * dz]; }
          [-1, 1].forEach(function (k) { var p = at(k * 1.25, 0); put('box', 'wood', p[0], 1.2, p[1], .16, 2.4, .16, 0, yaw, 0); put('box', 'wood', p[0], .08, p[1], .3, .16, 1.2, 0, yaw, 0); });
          [.35, 2.25].forEach(function (y) { var p = at(0, 0); put('wa-drum', 'wood', p[0], y, p[1], .12, 2.6, .12, 0, yaw, PI / 2); });
          var q = at(0, -.04); put('box', 'wa-linen', q[0], 1.3, q[1], 2.3, 1.85, .02, 0, yaw, 0);
          for (var t = -5; t <= 5; t++) { var p2 = at(t * .2, .05); put('box', 'iron', p2[0], 1.3, p2[1], .008, 1.9, .008, 0, yaw, 0, 2); }
          var b = at(0, .9); put('wa-drum', 'wa-linen', b[0], .35, b[1], .5, 1.4, .5, PI / 2, yaw, PI / 2, 1);
          var bp = at(0, .2); solid(bp[0], bp[1], Math.abs(c) * 2.8 + Math.abs(sn) * 1.6, Math.abs(sn) * 2.8 + Math.abs(c) * 1.6);
        }
        loom(r.x - 6.6, r.z - 6.8, 0); loom(r.x + 6.6, r.z - 6.8, 0);
        loom(S.back + S.s * 2.2, r.z + 1.5, S.s * PI / 2);
        loom(r.x + 7.2, r.z + 7.2, .2);
        // linen hung from beams across the north part of the hall
        for (var h = 0; h < 6; h++) {
          var hx = r.x + (h - 2.5) * 3.6, hz = S.north + 3.8 + (h % 2) * 1.2;
          put('wa-drum', 'wood', hx, 3.9, hz, .1, 3.2, .1, 0, 0, PI / 2, 1);
          for (var q = 0; q < 2; q++) put('box', 'wa-linen', hx + (q ? .75 : -.75), 2.75, hz + U(-.05, .05), 1.25, U(1.8, 2.5), .02, U(-.04, .04), 0, U(-.03, .03), 1);
        }
        // shroud bolts, spindle baskets and a cutting table
        for (var bb = 0; bb < 7; bb++) put('wa-drum', bb % 3 ? 'wa-linen' : 'cloth', r.x + S.s * 9.3, .3 + Math.floor(bb / 3) * .55, r.z - 4 + (bb % 3) * .62 + (bb > 2 ? .3 : 0), .5, 1.6, .5, PI / 2, 0, PI / 2);
        solid(r.x + S.s * 9.3, r.z - 3.4, 1.8, 2.2);
        put('box', 'wood', r.x - S.s * 2, .9, r.z + 8, 3.6, .12, 1.4, 0, 0, 0); [-1, 1].forEach(function (k) { put('box', 'wood', r.x - S.s * 2 + k * 1.6, .45, r.z + 8, .14, .9, 1.2, 0, 0, 0); });
        put('box', 'wa-linen', r.x - S.s * 2, .98, r.z + 8, 3, .05, 1.1, 0, .1, 0, 1); put('box', 'iron', r.x - S.s * 1.4, 1.02, r.z + 7.9, .5, .02, .06, 0, .7, 0, 2);
        solid(r.x - S.s * 2, r.z + 8, 3.8, 1.6);
        for (var sp = 0; sp < 5; sp++) { var sx = r.x - S.s * 6 + sp * .5, sz = r.z + 8.4; put('wa-urn', 'wood', sx, .3, sz, .45, .55, .45, 0, 0, 0, 1); put('wa-drum', 'wa-linen', sx, .66, sz, .2, .25, .2, 0, 0, 0, 2); }
        K.candleCluster(r.x - S.s * 3, r.z + 6.4, 5);
        K.sconce(S.edge - S.s * .44, r.z - 7.5, 2.4, -S.s * PI / 2, false);
        K.sconce(S.back + S.s * .44, r.z - 6, 2.4, S.s * PI / 2, false);
        lamp(r.x + 1.4, r.z - 1.5, 5.1, false); lamp(r.x - S.s * 6, r.z + 3.5, 5.0, false);
        // folded and dumped shrouds: soft linen mounds along the walls, some stained
        for (var md = 0; md < 9; md++) { var mx = r.x + (md % 2 ? 1 : -1) * U(8.2, 10.6), mz = r.z + U(-8, 8);
          put('wa-rock', 'wa-linen', mx, .12, mz, U(.9, 1.6), U(.25, .45), U(.7, 1.2), 0, R() * 6, 0, 1);
          if (md % 3 === 0) K.floorDecal('wet', CELL.bloodDrip, mx, mz, 1.1, 1.1, null, COL.oldBlood, 1); }
        candleStand(r.x - 4.2, r.z - 4.6, 1.2, true); candleStand(r.x + 4.4, r.z + 5.2, 1.2, true);
        K.ribCage(r.x - S.s * 8.6, r.z + 3.6, -1.1);
        for (var f = 0; f < 10; f++) K.floorDecal('matte', f % 2 ? CELL.specks : CELL.ashPile, r.x + U(-11, 11), r.z + U(-9, 9), U(1.4, 2.6), U(1.4, 2.6), null, COL.dust, 1);
        K.floorDecal('wet', CELL.bloodDrip, r.x - 6.6, r.z - 5.6, 1.2, 1.8, 0, COL.oldBlood, 1);
      },
      // Kırık Yeminler — split oath monoliths, chains torn from the floor, a red-veined broken altar on a dais.
      oaths: function (r, S) {
        // raised dais at the north wall with three low steps (collider covers the top)
        var dz = S.north + 2.4;
        for (var st = 0; st < 3; st++) put('slab' + st, st % 2 ? 'pale' : 'stone', r.x, .06 + st * .12, dz + 1.5 - st * .6, 10 - st * 1.2, .14, 3.6 - st * .6, 0, 0, 0, 0, new T.Color().setScalar(.8 + st * .07));
        solid(r.x, dz + .3, 8.4, 2.6);
        // the broken altar: split block with glowing seams
        put('slab3', 'dark', r.x - .55, 1.0, dz, 1.4, 1.4, 1.6, 0, 0, .06); put('slab1', 'dark', r.x + .7, .9, dz + .1, 1.3, 1.2, 1.6, 0, .1, -.12);
        put('box', 'ember', r.x + .06, .9, dz, .07, 1.3, 1.5, 0, 0, -.03, 1);
        K.decal('glow', CELL.glow, r.x, .5, dz + .2, 4, 3, 0, K.linear(.2, .03, .01), 0);
        K.lightSource(r.x, 1.4, dz + 1, '#ff3818', 12, 8, .4, { kind: 'special', scatter: 1.1, glowRadius: 1.5 });
        K.emberSources.push({ x: r.x, y: 1.6, z: dz, count: 8, spread: .5, rise: 2.4 });
        // monoliths, cracked in two
        [[-8.6, -4], [8.4, -3.2], [-9.2, 5.4], [9, 5.8]].forEach(function (p, i) {
          var x = r.x + p[0], z = r.z + p[1];
          put('slab1', 'dark', x, .2, z, 1.6, .4, 1.6, 0, 0, 0);
          put('slab2', 'stone', x, 1.25, z, 1.05, 1.7, .55, 0, i * .4, U(-.05, .05));
          put('slab3', 'stone', x + .5, .45 + (i % 2) * .2, z + .9, 1.05, .9, .55, 1.2, i * .4 + .3, .4);
          put('box', 'ember', x, 1.9, z + .28, .55, .05, .01, 0, i * .4, .3, 2);
          solid(x, z, 1.7, 1.7);
          // chains torn from rings in the floor
          put('link', 'iron', x - 1.2, .06, z, .26, .26, .26, PI / 2, 0, 0, 1);
          K.chain(x - 1.2, .07, z + .1, U(1.8, 2.6), 'z');
          K.floorDecal('matte', CELL.claws, x, z + 1.2, 1.5, 1.5, null, COL.crack, 1);
        });
        // kneeling penitents: effigies facing the altar
        K.funeraryEffigy(r.x - 6, dz + .4, .5, .72); K.funeraryEffigy(r.x + 6, dz + .4, -.5, .72);
        solid(r.x - 6, dz + .5, 1.2, 1.2); solid(r.x + 6, dz + .5, 1.2, 1.2);
        K.torch(r.x - 4.2, dz + 2.6, 2.1, true); K.torch(r.x + 4.2, dz + 2.6, 2.1, false);
        K.censer(r.x + S.s * 3, r.z + 4, 4.6);
        K.candleCluster(r.x - 2.3, dz + 2.4, 6); K.candleCluster(r.x + 2.3, dz + 2.4, 6);
        // the floor oath circle, cracked
        K.floorRing(r.x, r.z + 1, 4.2, .1, 'dark~p'); K.floorRing(r.x, r.z + 1, 3.6, .05, 'pale~p', 1);
        K.floorDecal('matte', CELL.runes, r.x, r.z + 1, 6.4, 6.4, 0, COL.chalk, 1);
        K.floorDecal('matte', CELL.cracks, r.x + 1.6, r.z + 1.8, 4, 4, null, COL.crack, 0);
        // the broken oath still burns in the cracks: red seams run from the altar across the hall
        for (var fs = 0; fs < 7; fs++) { var fa = (fs - 3) * .3 + U(-.08, .08);
          for (var fq = 0; fq < 3; fq++) { var fd = 2.6 + fq * 1.7, sx2 = r.x + Math.sin(fa) * fd, sz2 = dz + 1.6 + Math.cos(fa) * fd;
            K.decal('glow', CELL.cracks, sx2, .012, sz2, 1.9, 1.9, fa + R(), K.linear(.55, .06, .015), 1);
            K.floorDecal('matte', CELL.cracks, sx2, sz2, 2, 2, fa, COL.crack, 1); } }
        pile(S.back + S.s * 2.2, r.z + 6.4, 1.6, 14);
        for (var b = 0; b < 6; b++) K.floorDecal('wet', CELL.bloodSpatter, r.x + U(-9, 9), r.z + U(-6, 6), U(.8, 1.5), U(.8, 1.5), null, COL.oldBlood, 1);
      }
    };
    ROOMS.forEach(function (r) {
      if (K.setChunkBias) K.setChunkBias(r.x > 0 ? 500 : 700);
      var holes = [];
      var s = r.x < 0 ? 1 : -1, back = r.x - s * r.w / 2, north = r.z - r.d / 2;
      if (r.theme === 'ossuary') holes.push({ x: back + s * 3.2, z: r.z - 1, w: 3.2, d: 9 });
      if (r.theme === 'graves') holes.push({ x: r.x - 1, z: north + 3.1, w: 7, d: 3.2 });
      floorTiles(r.x, r.z, r.w, r.d, holes, r.theme === 'oaths' ? 1.7 : 1.32, r.theme === 'graves');
      var S = shell(r);
      THEMES[r.theme](r, S, holes);
      floorLife(r, holes);
      if (K.setChunkBias) K.setChunkBias(0);
    });
    // Main halls: grit and stray bones on the floor, fallen vault stones heaped into the dark corners (no colliders: walls already bound them).
    K.rooms.forEach(function (r) {
      floorLife({ x: r.x, z: r.z, w: r.w - 2, d: r.d - 2, theme: 'oaths' }, []);
      if (r.id === 6) {
        // the executioner's court: the condemned's remains swept to the edges, dried blood running to the drains
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { skulls(r.x + c[0] * (r.w / 2 - 2.2), r.z + c[1] * (r.d / 2 - 2.4), .75, 12); });
        for (var bt = 0; bt < 6; bt++) { var ba = bt / 6 * 6.28 + .3; bloodTrail(r.x + Math.cos(ba) * 4, r.z - 2 + Math.sin(ba) * 4, r.x + Math.cos(ba) * 11, r.z - 2 + Math.sin(ba) * 11); }
        for (var bb = 0; bb < 10; bb++) K.ribCage(r.x + (bb % 2 ? 1 : -1) * U(10.5, 12.5), r.z + U(-12, 10), R() * 6);
      }
      [[-1, -1], [1, -1]].forEach(function (c) { if (r.id === 6 || r.id === 3) return; pile(r.x + c[0] * (r.w / 2 - 1.3), r.z + c[1] * (r.d / 2 - 1.3), 1.0, 9); });
    });
    function inHole(holes, x, z, m) { for (var i = 0; i < holes.length; i++) { var o = holes[i]; if (Math.abs(x - o.x) < o.w / 2 + m && Math.abs(z - o.z) < o.d / 2 + m) return true; } return false; }
    // Lived-in floor: grit, chips of fallen vault, stray bones, stains that run under the furniture.
    function floorLife(r, holes) {
      for (var i = 0; i < 34; i++) { var x = r.x + U(-r.w / 2 + .8, r.w / 2 - .8), z = r.z + U(-r.d / 2 + .8, r.d / 2 - .8); if (inHole(holes, x, z, .5)) continue;
        put('wa-pebble', i % 3 ? 'stone' : 'dark', x, .03, z, U(.08, .22), U(.05, .12), U(.08, .2), U(-.3, .3), R() * 6, U(-.3, .3), 2); }
      for (var j = 0; j < 9; j++) { var bx = r.x + U(-r.w / 2 + 1, r.w / 2 - 1), bz = r.z + U(-r.d / 2 + 1, r.d / 2 - 1), a = R() * 6.28, l = U(.25, .5); if (inHole(holes, bx, bz, .5)) continue;
        rod('bone', [bx - Math.cos(a) * l / 2, .05, bz - Math.sin(a) * l / 2], [bx + Math.cos(a) * l / 2, .05, bz + Math.sin(a) * l / 2], .03, 2); }
      for (var k = 0; k < 14; k++) { var dx = r.x + U(-r.w / 2 + 1, r.w / 2 - 1), dz = r.z + U(-r.d / 2 + 1, r.d / 2 - 1); if (inHole(holes, dx, dz, 0)) continue;
        var t = k % 4; K.floorDecal('matte', t === 0 ? CELL.cracks : t === 1 ? CELL.mould : t === 2 ? CELL.specks : CELL.bloodSmear, dx, dz, U(1.6, 3.6), U(1.6, 3.6), null, t === 0 ? COL.crack : t === 1 ? COL.grime : t === 2 ? COL.dust : COL.oldBlood, 1); }
      // ledger stones set into the floor between the fighting lanes
      if (r.theme !== 'oaths' && r.theme !== 'flesh') for (var n = 0; n < 3; n++) {
        var lx = r.x + (n - 1) * 4.2, lz = r.z + (n % 2 ? 1.8 : -1.2) + (r.theme === 'graves' ? 2 : 0); if (inHole(holes, lx, lz, 1.5)) continue;
        put('slab' + n, 'pale', lx, -.118, lz, 1.5, .24, 2.5, 0, U(-.05, .05), 0, 0, new T.Color().setScalar(U(.75, .95)));
        put('slab' + (n + 1) % 4, 'dark', lx, -.112, lz, 1.1, .24, 2.05, 0, U(-.04, .04), 0, 1);
        K.floorDecal('matte', CELL.runes, lx, lz, 1.2, 1.9, 0, COL.chalk, 1);
        K.floorDecal('matte', CELL.cracks, lx + U(-.3, .3), lz, 1.4, 1.4, null, COL.crack, 1);
      }
    }
  }
  // Quest anchors (STORY.md: world.questSites) — open, reachable spots that match each relic's story.
  var SITES = {
    'names': { x: -27.2, z: -28.8 },          // ossuary: under the skull niches of the north wall
    'c1.hunt': { x: 32, z: -106.4 },          // shroud hall: between the two looms
    'c1.captive': { x: -34.6, z: -52.6 },     // lost-flesh infirmary: beside a mortuary table
    'c1.page1': { x: 22, z: 7.6 },            // nameless graves: at the foot of a grave marker
    'c1.page2': { x: -41.6, z: -122.4 },      // broken oaths: the far corner by the fallen stones
    'c1.chest': { x: -30, z: -129.4 }         // broken oaths: before the split altar's dais
  };
  B.WorldATemple = { active: !/[?&]nowa\b/.test(location.search), rooms: ROOMS, dress: dress, sites: SITES };
}());
