/* KABİR AZABI — V: Son Mahkeme. Fourteen floating platforms over a bleeding void: the broken-sky threshold, hanging chains, the witnesses'
   bridge, the well of the condemned, the four lords' shadows (executioner, bell-ringer, king, furnace), floating stones, the ledger of verdicts,
   the bloody scales, the last testimony, the stair of the dais and the last court. Everything is baked into the room's merged meshes by
   ruins-kit.js; glow is emissive geometry and shader sprites (bloom does the rest), light comes from the three pooled point lights. */
(function () {
  'use strict';
  var B = window.BABA, PI = Math.PI;
  var BASALT = [.42, .39, .38], BONE = [.92, .86, .78], PALE = [.78, .73, .68], SOOT = [.3, .28, .28], IRONT = [.6, .55, .53], RUST = [.55, .42, .36],
    BLOOD = [1.7, .22, .12], EMBER = [1.6, .42, .14], DEEP = [.9, .08, .05];

  // Grade: bone-pale stone under a cold, near-white key; the void is black; red lives only in fire, blood and verdict glow.
  var moodBase = { fog: '#09080a', fogDensity: .0095, mist: '#161214', mistA: .08, mistH: .8, mistGlow: .45, scatter: .65, wind: [.03, -.02], sky: '#a8a0a8', ground: '#2a2426', hemi: .9, env: .3, key: '#e2d8d4', keyI: 1.7, keyDir: [-12, 24, -8],
    rim: '#c04a34', rimI: 1.2, charRim: '#ead8d0', charRimI: 1.35, rimDir: [.4, .6, -1], rimWrap: 1, charFill: .26, lift: [.004, .003, .004], gain: [1.04, 1.0, .98], sat: .74, contrast: .25, shadowTint: [.98, .95, 1.0], highTint: [1.08, 1.02, .96],
    vignette: .52, vigColor: [.006, .002, .003], bloom: .46, bloomTint: [1.04, .98, .96], exposure: 1.28 };
  var moodSpecs = [
    { key: '#d4d0dc', keyI: 1.7, sky: '#a8a4b4', mist: '#141218', sat: .7, rim: '#a85040' },
    { key: '#ddd4d0', keyI: 1.7 },
    { key: '#e6dcd4', keyI: 1.75, bloom: .44 },
    { key: '#dcc8c4', keyI: 1.65, mist: '#1e1012', mistA: .1, mistGlow: .6, bloom: .52, gain: [1.07, .98, .96], sat: .8, rim: '#d04030' },
    { key: '#e4ccc4', keyI: 1.7, mist: '#1c1012', gain: [1.08, .98, .96], sat: .8, rim: '#d83828', bloom: .5 },
    { key: '#bcc8d0', keyI: 1.65, sky: '#90a0a8', fog: '#07090a', mist: '#10161a', gain: [.98, 1.0, 1.04], sat: .7, rim: '#6a8a96', bloom: .44 },
    { key: '#d0c4e0', keyI: 1.65, sky: '#9a8cb0', mist: '#16101e', gain: [1.0, .98, 1.05], sat: .76, rim: '#8a50c0', bloom: .48 },
    { key: '#f0c8a8', keyI: 1.7, fog: '#0c0807', mist: '#21130c', gain: [1.08, 1.0, .9], sat: .86, rim: '#e06030', bloom: .52 },
    { key: '#ddd4d4', keyI: 1.7 },
    { key: '#e8dcd0', keyI: 1.75, gain: [1.06, 1.0, .95], bloom: .48 },
    { key: '#e8c4bc', keyI: 1.7, mist: '#1e0e10', mistA: .1, gain: [1.1, .97, .95], sat: .84, rim: '#e03424', bloom: .54, vignette: .56 },
    { key: '#f2e0cc', keyI: 1.8, hemi: 1.0, sky: '#b8a8a0', mist: '#1e1612', mistGlow: .55, bloom: .5, exposure: 1.32, vignette: .46, sat: .82, gain: [1.08, 1.0, .94], rim: '#e07a50' },
    { key: '#e8ccc4', keyI: 1.7, mist: '#1c0e10', bloom: .52, gain: [1.08, .98, .95], sat: .82, rim: '#e03a28' },
    { key: '#f4dcd4', keyI: 1.8, sky: '#c0a8a8', fog: '#0b0607', mist: '#220c0e', mistA: .1, mistGlow: .65, bloom: .56, gain: [1.1, .97, .95], contrast: .3, vignette: .58, exposure: 1.3, shadowTint: [1.0, .92, .95], highTint: [1.14, 1.0, .94], rim: '#ff4030', charRim: '#ffe0d4', sat: .86 }
  ];

  function setupOnce(K) {
    if (K.finaleSetup) return; K.finaleSetup = true;
    // Cosmetic heat halos only. Keep the baked geometry, pooled sources and hazard art unchanged.
    var heatSpr = K.spr, heatDec = K.dec, heatPut = K.putM;
    K.spr = function(id,kind,x,y,z,w,h,col,a,phase,speed,ex) {
      var gain = kind === K.SPR.pool ? 0.74 : kind === K.SPR.glow ? 0.84 : 1;
      return heatSpr.call(K,id,kind,x,y,z,w,h,col,(a == null ? 1 : a)*gain,phase,speed,ex);
    };
    K.dec = function(id,cell,x,z,w,d,rot,col,alpha,mode,y) {
      return heatDec.call(K,id,cell,x,z,w,d,rot,col,(alpha == null ? 1 : alpha)*(mode === 'glow' ? 0.72 : 1),mode,y);
    };
    K.putM = function(id,kind,key,m,tint,ao,aoH,cast) {
      if(key === 'hot' && tint) { var s = Math.min(0.9,1.2/Math.max(.001,tint[0],tint[1],tint[2])); tint=[tint[0]*s,tint[1]*s,tint[2]*s]; }
      return heatPut.call(K,id,kind,key,m,tint,ao,aoH,cast);
    };
    var T = window.THREE;
    K.addShape('pebble', new T.IcosahedronGeometry(.5, 0));
    K.addShape('hemi', new T.SphereGeometry(.5, 12, 5, 0, PI * 2, 0, PI / 2));
    K.addShape('bell', new T.LatheGeometry([new T.Vector2(.0, .5), new T.Vector2(.18, .5), new T.Vector2(.24, .42), new T.Vector2(.27, .2), new T.Vector2(.31, -.1), new T.Vector2(.42, -.38), new T.Vector2(.5, -.5), new T.Vector2(.46, -.5), new T.Vector2(.38, -.38), new T.Vector2(.27, -.1), new T.Vector2(.23, .2), new T.Vector2(.0, .44)], 18));
    K.addShape('halo', new T.TorusGeometry(.5, .04, 6, 48));
    K.addShape('blade', (function () { var s = new T.Shape(); s.moveTo(-.5, -.5); s.lineTo(.5, -.5); s.quadraticCurveTo(.62, .1, .3, .5); s.lineTo(-.5, .38); s.closePath(); var g = new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -.5); return g; }()));
    // A giant forged chain link with rounded ends (baked; one per link, the same buffer for every chain).
    var path = new T.CurvePath(), lr = .22, ly = .3, lc = lr * .55228475;
    function lp(x, y) { return new T.Vector3(x, y, 0); }
    path.add(new T.LineCurve3(lp(lr, -ly), lp(lr, ly))); path.add(new T.CubicBezierCurve3(lp(lr, ly), lp(lr, ly + lc), lp(lc, ly + lr), lp(0, ly + lr))); path.add(new T.CubicBezierCurve3(lp(0, ly + lr), lp(-lc, ly + lr), lp(-lr, ly + lc), lp(-lr, ly)));
    path.add(new T.LineCurve3(lp(-lr, ly), lp(-lr, -ly))); path.add(new T.CubicBezierCurve3(lp(-lr, -ly), lp(-lr, -ly - lc), lp(-lc, -ly - lr), lp(0, -ly - lr))); path.add(new T.CubicBezierCurve3(lp(0, -ly - lr), lp(lc, -ly - lr), lp(lr, -ly - lc), lp(lr, -ly)));
    K.addShape('biglink', new T.TubeGeometry(path, 20, .075, 6, true));
  }

  // A colossal chain between two points (link size s): every link along the line, alternate links turned 90 degrees about it.
  var cq = null;
  function bigChain(K, id, x1, y1, z1, x2, y2, z2, s, tint, sag) {
    var T = window.THREE; if (!cq) cq = { up: new T.Vector3(0, 1, 0), d: new T.Vector3(), q: new T.Quaternion(), q2: new T.Quaternion(), p: new T.Vector3(), sc: new T.Vector3(), m: new T.Matrix4(), prev: new T.Vector3() };
    var L = Math.hypot(x2 - x1, y2 - y1, z2 - z1), step = .6 * s, n = Math.max(1, Math.floor(L / step)); sag = sag || 0;
    function at(t, o) { return o.set(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - sag * 4 * t * (1 - t), z1 + (z2 - z1) * t); }
    at(0, cq.prev);
    for (var k = 1; k <= n; k++) {
      at(k / n, cq.p); cq.d.subVectors(cq.p, cq.prev); var len = cq.d.length(); if (len < 1e-4) continue; cq.d.multiplyScalar(1 / len);
      cq.q.setFromUnitVectors(cq.up, cq.d); if (k % 2) { cq.q2.setFromAxisAngle(cq.d, Math.PI / 2); cq.q.premultiply(cq.q2); }
      cq.sc.set(s, s, s); cq.m.compose(cq.prev.clone().add(cq.p).multiplyScalar(.5), cq.q, cq.sc); K.putM(id, 'biglink', 'iron', cq.m, tint || [.5, .44, .42], .15);
      cq.prev.copy(cq.p);
    }
  }

  function dress(K, r, i, info) {
    setupOnce(K);
    var S = K.SPR, R = K.rng(i, 5), R2 = K.rng(i, 9);
    function X(x) { return r.x + x; } function Z(z) { return r.z + z; }
    function inRoom(lx, lz, m) { m = m || 0; for (var k = 0; k < r.rects.length; k++) { var q = r.rects[k]; if (Math.abs(r.x + lx - q.x) <= q.w / 2 - m && Math.abs(r.z + lz - q.z) <= q.d / 2 - m) return true; } return false; }
    function BX(kind, key, x, y, z, w, h, d, a, tint, ao, rx, rz) { K.put(i, kind, key, X(x), y, Z(z), w, h, d, a || 0, rx || 0, rz || 0, tint, ao); }
    function HOT(x, y, z, w, h, d, col, a) { K.put(i, 'box', 'hot', X(x), y, Z(z), w, h, d, a || 0, 0, 0, col || BLOOD, 0); }
    function SP(kind, x, y, z, w, h, col, al, spd, ex) { K.spr(i, kind, X(x), y, Z(z), w, h, col, al, R2(), spd, ex); }
    function solidL(x, z, w, d) { K.solid(X(x), Z(z), w, d); }
    function embers(n, x0, x1, z0, z1, rise, bright) { for (var k = 0; k < n; k++) K.spr(i, S.ember, X(x0 + R() * (x1 - x0)), .3, Z(z0 + R() * (z1 - z0)), .05, .05, [2 * (bright || 1), .5 * (bright || 1), .2], 1, R(), .12 + R() * .18, rise || 5); }
    function smoke(n, col, a, h, size, rise) { for (var k = 0; k < n; k++) K.spr(i, S.smoke, X((R() - .5) * (r.w - 4)), h || .5, Z((R() - .5) * (r.d - 4)), (size || 3) * .92, (size || 3) * .92, col, a, R(), .05 + R() * .05, rise || 4); }
    function decals(o) {
      var k, tries;
      function spot(m) { for (tries = 0; tries < 8; tries++) { var lx = (R() - .5) * (r.w - m), lz = (R() - .5) * (r.d - m); if (inRoom(lx, lz, 1)) return [lx, lz]; } return null; }
      for (k = 0; k < (o.cracks || 0); k++) { var p = spot(4); if (p) K.dec(i, 0, X(p[0]), Z(p[1]), 3.5 + R() * 2.5, 3.5 + R() * 2.5, R() * 6.28, [1, 1, 1], .9); }
      for (k = 0; k < (o.soot || 0); k++) { p = spot(2); if (p && k % 3 !== 2) K.dec(i, 3, X(p[0]), Z(p[1]), 4 + R() * 4, 4 + R() * 4, R() * 6.28, [1, .9, .9], .8); }
      for (k = 0; k < (o.chips || 0); k++) { p = spot(4); if (p) K.dec(i, 13, X(p[0]), Z(p[1]), 3 + R() * 2.5, 3 + R() * 2.5, R() * 6.28, [1, 1, 1], .95); }
      for (k = 0; k < (o.blood || 0); k++) { p = spot(6); if (p) K.dec(i, 2, X(p[0]), Z(p[1]), 2.5 + R() * 2.5, 2.5 + R() * 2.5, R() * 6.28, [1, 1, 1], .9, 'wet'); }
      for (k = 0; k < (o.bones || 0); k++) { p = spot(6); if (p) K.dec(i, 11, X(p[0]), Z(p[1]), 2 + R() * 1.5, 2 + R() * 1.5, R() * 6.28, [.6, .55, .5], .85); }
      for (k = 0; k < (o.heat || 0); k++) { p = spot(4); if (p) K.dec(i, 15, X(p[0]), Z(p[1]), 5 + R() * 3, 5 + R() * 3, R() * 6.28, [.4, .05, .03], .3, 'glow'); }
    }
    // Blood-fire brazier (the kit's brazier with a crimson flame and light).
    function pyre(x, z, s, inten, opt) { K.brazier(i, X(x), Z(z), Object.assign({ s: s || 1, col: [1.7, .32, .14], lightColor: 0xff5a3a, intensity: inten == null ? 30 : inten, tint: PALE }, opt || {})); }
    function candleCluster(x, z, n) { for (var k = 0; k < n; k++) { var a = R() * 6.28, d = R() * .55, h = .2 + R() * .45, cx = X(x) + Math.cos(a) * d, cz = Z(z) + Math.sin(a) * d; K.put(i, 'cyl', 'stone', cx, h / 2, cz, .09, h, .09, 0, 0, 0, BONE, .2); K.spr(i, S.flame, cx, h + .09, cz, .05, .1, [1.6, .55, .2], 1, R(), 1.4, 1); } K.spr(i, S.pool, X(x), .1, Z(z), 1.8, 1.8, [.6, .2, .06], .5, R(), 1, 1); }
    // Hooded stone witnesses of the court (robed, faceless, two embers under the hood); pose 1 kneels.
    function statueL(x, z, rot, pose, s, tint) {
      s = s || 1; tint = tint || PALE; var kneel = pose === 1, h = kneel ? 1.55 : 2.6, c = Math.cos(rot), sn = Math.sin(rot), fx = Math.sin(rot), fz = Math.cos(rot);
      function P(kind, key, lx, y, lz, w, hh, d, rx, tt, ao) { K.put(i, kind, key, X(x) + (lx * c + lz * sn) * s, y * s, Z(z) + (-lx * sn + lz * c) * s, w * s, hh * s, d * s, rot, rx || 0, 0, tt || tint, ao == null ? .4 : ao); }
      P('box', 'stone', 0, .2, 0, 1.7, .4, 1.7, 0, [tint[0] * .8, tint[1] * .8, tint[2] * .8], .5);
      P('tooth', 'stone', 0, .4 + h * .5, 0, 1.25, h, 1.05, 0, tint, .55);
      P('urn', 'stone', 0, .4 + h * .92, -.04, 1.0, .5, .78, 0, tint, .3);
      P('urn', 'stone', 0, .4 + h * 1.04, .02, .62, .66, .6, 0, [tint[0] * .9, tint[1] * .9, tint[2] * .9], .3);
      P('spike', 'stone', 0, .4 + h * 1.04 + .48, -.12, .6, .55, .55, -.35, [tint[0] * .9, tint[1] * .9, tint[2] * .9], .2);
      P('box', 'rock', 0, .4 + h * 1.0, .27, .34, .3, .06, 0, [.05, .04, .04], 0);
      K.put(i, 'box', 'hot', X(x) + (-.08 * c + .3 * sn) * s, (.4 + h * 1.02) * s, Z(z) + (.08 * sn + .3 * c) * s, .05 * s, .025 * s, .02, rot, 0, 0, [1.6, .12, .06], 0);
      K.put(i, 'box', 'hot', X(x) + (.08 * c + .3 * sn) * s, (.4 + h * 1.02) * s, Z(z) + (-.08 * sn + .3 * c) * s, .05 * s, .025 * s, .02, rot, 0, 0, [1.6, .12, .06], 0);
      if (!kneel) { P('box', 'stone', 0, .4 + h * .62, .4, .62, .34, .3, .2, tint, .3); K.bar(i, 'cyl', 'iron', X(x) + (.2 * c + .55 * sn) * s, (.4 + h * .6) * s, Z(z) + (-.2 * sn + .55 * c) * s, X(x) + (.2 * c + .62 * sn) * s, .1, Z(z) + (-.2 * sn + .62 * c) * s, .03 * s, RUST, .1); }
      else P('box', 'stone', 0, .4 + h * .7, .36, .5, .3, .26, .4, tint, .3);
      solidL(x, z, 1.4 * s, 1.4 * s);
    }
    function obelisk(x, z, h, rot) {
      BX('box', 'stone', x, .3, z, 1.9, .6, 1.9, rot, PALE, .5); BX('box', 'rock', x, h / 2 + .5, z, 1.0, h, 1.0, rot, BASALT, .6); BX('cone4', 'rock', x, h + .5 + .6, z, 1.4, 1.2, 1.4, rot + PI / 4, BASALT, .2);
      for (var q = 0; q < 4; q++) HOT(x + Math.sin(rot) * .51, 1.2 + q * h * .2, z + Math.cos(rot) * .51, .5, .06, .04, BLOOD, rot);
      SP(S.glow, x, h * .5, z, 1.2, h * .5, [.5, .05, .03], .5, 1, 1); solidL(x, z, 1.5, 1.5);
    }
    function cage(x, z, y0, chainTop) {
      K.chain(i, X(x), chainTop, Z(z), chainTop - y0 - 1.5, IRONT); BX('box', 'iron', x, y0 + 1.5, z, 1.4, .12, 1.4, 0, IRONT, .1); BX('box', 'iron', x, y0, z, 1.4, .12, 1.4, 0, IRONT, .1);
      for (var b = 0; b < 8; b++) { var a = b / 8 * 6.28; BX('cyl6', 'iron', x + Math.cos(a) * .64, y0 + .75, z + Math.sin(a) * .64, .06, 1.5, .06, 0, RUST, 0); }
      BX('rock', 'stone', x, y0 + .2, z, .5, .25, .4, R() * 6, BONE, .2);
    }
    /* ---- the floating island: floor tiles, exposed rim, hanging underside, void glow ---- */
    var rimR = K.rng(i, 31);
    function island(o) {
      o = o || {};
      var ft = o.tint || [.62, .58, .56]; K.floor(i, r, { key: o.key || 'floor', tint: [ft[0] * 1.3, ft[1] * 1.3, ft[2] * 1.3], vary: .16, tilt: .035, skip: function (lx, lz) { return !inRoom(lx, lz, -.15); }, zone: o.zone });
      // Rim: walk every rectangle edge; where the void is just outside, break the edge with blocks and hang basalt below it.
      r.rects.forEach(function (q) {
        var edges = [[q.x - q.w / 2, q.z - q.d / 2, q.x + q.w / 2, q.z - q.d / 2, 0, -1], [q.x - q.w / 2, q.z + q.d / 2, q.x + q.w / 2, q.z + q.d / 2, 0, 1], [q.x - q.w / 2, q.z - q.d / 2, q.x - q.w / 2, q.z + q.d / 2, -1, 0], [q.x + q.w / 2, q.z - q.d / 2, q.x + q.w / 2, q.z + q.d / 2, 1, 0]];
        edges.forEach(function (e) {
          var len = Math.hypot(e[2] - e[0], e[3] - e[1]), n = Math.max(1, Math.round(len / 1.7));
          for (var k = 0; k <= n; k++) {
            var t = k / n, px = e[0] + (e[2] - e[0]) * t, pz = e[1] + (e[3] - e[1]) * t;
            if (info.onFloor(px + e[4] * .7, pz + e[5] * .7)) continue;    // interior seam / bridge mouth: no rim
            var s = .8 + rimR() * .9, ox = e[4] * (.15 + rimR() * .3), oz = e[5] * (.15 + rimR() * .3);
            K.put(i, 'block', 'rock', px + ox, -.35 - rimR() * .25, pz + oz, 1.5 + rimR() * .6, .9 + rimR() * .4, 1.3 + rimR() * .5, rimR() * .4 + (e[4] ? PI / 2 : 0), (rimR() - .5) * .2, (rimR() - .5) * .2, BASALT, .3);
            if (k % 2 === 0) K.put(i, 'crag', 'rock', px + e[4] * .6, -1.6 - rimR() * 1.4, pz + e[5] * .6, 2.6 * s, 2.4 * s, 2.6 * s, rimR() * 6, 0, 0, [.34, .31, .31], .5);
            if (k % 3 === 1) K.put(i, 'spike', 'rock', px + e[4] * .4, -3.6 - rimR() * 2, pz + e[5] * .4, 1.2 * s, 3.6 * s, 1.2 * s, rimR() * 6, PI + (rimR() - .5) * .3, (rimR() - .5) * .3, [.3, .28, .28], .2);
            if (k % 4 === 2 && !o.noKerb) K.put(i, 'block', 'stone', px - e[4] * .35, .18, pz - e[5] * .35, e[4] ? .45 : 1.2, .36 + rimR() * .2, e[4] ? 1.2 : .45, (rimR() - .5) * .2, 0, 0, PALE, .3);
            if (k % 6 === 0) K.spr(i, S.glow, px + e[4] * 3, -7, pz + e[5] * 3, 3.6, 3.6, [.28, .03, .015], .35, rimR(), .5, 1);
            if (k % 3 === 0) K.spr(i, S.ember, px + e[4] * 1.5, -3, pz + e[5] * 1.5, .05, .05, [2.2, .4, .15], 1, rimR(), .1 + rimR() * .12, 9);
          }
        });
        // underside: stacked basalt masses and one long hanging fang per rectangle
        K.put(i, 'crag', 'rock', q.x, -3.4, q.z, q.w * .86, 5.2, q.d * .86, rimR() * 6, 0, 0, [.28, .26, .26], .4);
        K.put(i, 'spike', 'rock', q.x + (rimR() - .5) * q.w * .3, -9.5, q.z + (rimR() - .5) * q.d * .3, q.w * .5, 11, q.d * .5, rimR() * 6, PI, 0, [.24, .22, .22], .2);
      });
    }
    // Floor life: thin blood veins creep through the stone joints (molten seams, baked), carved rune inlays catch gold or void light.
    function floorLife(nVein, nRune, runeCol) {
      var RV = K.rng(i, 57);
      for (var k = 0; k < nVein; k++) { var x = (RV() - .5) * (r.w - 6), z = (RV() - .5) * (r.d - 6), a = RV() * PI * 2;
        for (var sgm = 0; sgm < 7; sgm++) { var L = .8 + RV() * 1.4, nx = x + Math.cos(a) * L, nz = z + Math.sin(a) * L; if (!inRoom(nx, nz, .8)) break;
          K.put(i, 'box', 'hot', X((x + nx) / 2), .025, Z((z + nz) / 2), L + .05, .012, .045 + RV() * .04, -a, 0, 0, [.3 + RV() * .18, .022, .014], 0);
          if (RV() < .35) { var b = a + (RV() < .5 ? 1 : -1) * (.6 + RV()), bl = .5 + RV() * .7; K.put(i, 'box', 'hot', X(nx + Math.cos(b) * bl / 2), .025, Z(nz + Math.sin(b) * bl / 2), bl, .012, .03, -b, 0, 0, [.26, .02, .012], 0); }
          x = nx; z = nz; a += (RV() - .5) * 1.1; } }
      for (var k = 0; k < nRune; k++) { var x = (RV() - .5) * (r.w - 8), z = (RV() - .5) * (r.d - 8); if (!inRoom(x, z, 2)) continue; var rr = .9 + RV() * .8;
        K.put(i, 'inlay', 'hot', X(x), .03, Z(z), rr * 2, 1, rr * 2, 0, 0, 0, runeCol, 0); K.put(i, 'inlay', 'hot', X(x), .03, Z(z), rr * 1.4, 1, rr * 1.4, 0, 0, 0, [runeCol[0] * .7, runeCol[1] * .7, runeCol[2] * .7], 0);
        for (var q = 0; q < 6; q++) { var qa = q / 6 * PI * 2 + RV(); K.put(i, 'box', 'hot', X(x + Math.cos(qa) * rr * .85), .03, Z(z + Math.sin(qa) * rr * .85), .16, .01, .05, -qa, 0, 0, runeCol, 0); }
        K.spr(i, S.pool, X(x), .1, Z(z), rr * 3, rr * 3, [runeCol[0] * .25, runeCol[1] * .25, runeCol[2] * .25], .4, RV(), 1, 1); }
    }
    // Floating debris around the platform (out in the void, never walkable).
    function debris(n, minD, maxD) {
      for (var k = 0; k < n; k++) {
        var side = k % 2 ? 1 : -1, x = side * (r.w / 2 + minD + R() * (maxD - minD)), z = (R() - .5) * r.d * 1.3, y = -2.5 + R() * 5.5, s = 1.2 + R() * 2.6;
        K.put(i, 'crag', 'rock', X(x), y, Z(z), s * 1.6, s * .8, s * 1.4, R() * 6, (R() - .5) * .6, (R() - .5) * .6, BASALT, .4);
        K.put(i, 'spike', 'rock', X(x), y - s * 1.1, Z(z), s * 1.1, s * 1.9, s * 1.0, R() * 6, PI, 0, [.3, .28, .28], .2);
        if (R() < .5) K.put(i, 'tile', 'floor', X(x), y + s * .42, Z(z), s * 1.3, .3, s * 1.1, R() * 6, 0, 0, [.5, .47, .45], 0);
        if (R() < .35) K.put(i, 'block', 'stone', X(x + (R() - .5)), y + s * .5 + .5, Z(z), .7, 1.2 + R() * 1.4, .7, R() * 6, 0, (R() - .5) * .3, PALE, .3);
      }
    }
    // A colossal chain rising from a floor anchor into the dark above (local coordinates).
    function skyChain(x, z, lean, s) {
      s = s || 2.4; BX('cyl', 'iron', x, .35, z, 2.2, .7, 2.2, 0, IRONT, .5); BX('rim', 'iron', x, .8, z, 1.4 * s / 2.4, 1.4 * s / 2.4, 1.4 * s / 2.4, 0, RUST, .2, PI / 2); solidL(x, z, 2.0, 2.0);
      bigChain(K, i, X(x), .9, Z(z), X(x + lean[0]), 30, Z(z + lean[1]), s, [.52, .46, .44]);
      SP(S.glow, x, .5, z, 1.8, 1.8, [.4, .05, .03], .4, 1, 1);
    }
    function voidChain(x, z, dir, len) { bigChain(K, i, X(x), .2, Z(z), X(x + dir[0] * 2), -len, Z(z + dir[1] * 2), 1.6, [.42, .36, .34]); }
    // The void is not only red: cold violet light falls through the broken sky at the platform's edge, dust hangs in it, and far below
    // a second layer of ruins (arches, pillars, chained slabs) drifts in the dark, so the drop reads as deep instead of flat.
    var VOID = [.32, .36, 1.0], GOLD = [1.5, 1.05, .45];
    function voidLight() {
      var RB = K.rng(i, 41);
      for (var k = 0; k < 2; k++) { var s = k ? 1 : -1, x = s * (r.w / 2 - 1.5 - RB() * 3), z = (RB() - .5) * (r.d - 6); if (!inRoom(x, z, .5)) continue;
        K.spr(i, S.beam, X(x), 0, Z(z), 1.6 + RB() * .8, 13, [VOID[0] * .45, VOID[1] * .45, VOID[2] * .45], .5, RB(), 1, 1);
        K.spr(i, S.pool, X(x), .12, Z(z), 3.6, 3.6, [VOID[0] * .3, VOID[1] * .3, VOID[2] * .3], .45, RB(), 1, 1);
        for (var m = 0; m < 10; m++) K.spr(i, S.mote, X(x + (RB() - .5) * 3), .5 + RB() * 5, Z(z + (RB() - .5) * 3), .04, .04, [.6, .65, 1.4], .8, RB(), .3 + RB() * .4, 1.6); }
      // ember clouds drifting in the drop beside the platform (lit from below by the abyss)
      for (var k = 0; k < 5; k++) { var s2 = k % 2 ? 1 : -1, x = s2 * (r.w / 2 + 3 + RB() * 9), z = (RB() - .5) * r.d * 1.2;
        K.spr(i, S.smoke, X(x), -5 - RB() * 5, Z(z), 7 + RB() * 5, 7 + RB() * 5, k % 3 ? [.32, .07, .05] : [.12, .1, .26], .5, RB(), .03 + RB() * .03, 3);
        K.spr(i, S.ember, X(x), -6, Z(z), .06, .06, [2.4, .4, .15], 1, RB(), .08 + RB() * .1, 12); }
      // deep ruins
      for (var k = 0; k < 4; k++) { var s = k % 2 ? 1 : -1, x = s * (r.w / 2 + 5 + RB() * 12), z = (RB() - .5) * r.d * 1.4, y = -12 - RB() * 14, sc = 1.4 + RB() * 1.6;
        if (k < 2) { for (var q = 0; q < 7; q++) { var a = q / 7 * PI; K.put(i, 'block', 'stone', X(x + Math.cos(a) * 3.2 * sc), y + Math.sin(a) * 3.2 * sc, Z(z), 1.1 * sc, .9 * sc, 1.3 * sc, 0, 0, a - PI / 2, [.42, .4, .44], .3); }
          K.put(i, 'column', 'stone', X(x - 3.2 * sc), y - 2.2 * sc, Z(z), .9 * sc, 4.4 * sc, .9 * sc, 0, 0, 0, [.4, .38, .42], .4); K.put(i, 'column', 'stone', X(x + 3.2 * sc), y - 1.4 * sc, Z(z), .9 * sc, 2.8 * sc, .9 * sc, 0, .2, 0, [.4, .38, .42], .4); }
        else { K.put(i, 'tile', 'floor', X(x), y, Z(z), 5 * sc, .5, 4 * sc, RB() * 6, (RB() - .5) * .3, (RB() - .5) * .3, [.36, .34, .36], 0); K.put(i, 'crag', 'rock', X(x), y - 2 * sc, Z(z), 4.4 * sc, 3.6 * sc, 3.6 * sc, RB() * 6, 0, 0, [.24, .22, .25], .4);
          bigChain(K, i, X(x), y + .2, Z(z), X(x + s * 2), y + 30, Z(z + 3), 1.6, [.34, .3, .34]); }
        K.spr(i, S.glow, X(x), y - 1, Z(z), 6, 6, k % 2 ? [.08, .09, .3] : [.3, .03, .02], .45, RB(), .4, 1); }
    }
    var ROOM = [];
    /* 0 Kırık Gök Eşiği — broken stair rising from the void, two shattered pillars, a fallen ring of the sky */
    ROOM[0] = function () {
      island({ tint: [.6, .57, .56] });
      for (var k = 0; k < 7; k++) { var z = r.d / 2 + 1 + k * 1.3; BX('block', 'stone', 0, -.4 - k * .75, z, 7 - k * .3, .7, 1.4, (R() - .5) * .06, [PALE[0] * (1 - k * .06), PALE[1] * (1 - k * .06), PALE[2] * (1 - k * .06)], .4); }
      [-1, 1].forEach(function (s) { K.column(i, X(s * 9), Z(-5), 7.5, 1.4, 'stone', { tint: PALE, broken: s > 0, cut: .1 }); solidL(s * 9, -5, 1.6, 1.6); K.column(i, X(s * 9), Z(5), 6, 1.2, 'stone', { tint: PALE, broken: true, cut: -.15 }); solidL(s * 9, 5, 1.4, 1.4); });
      // fallen ring of the sky: arc blocks leaning out into the void
      for (var q = 0; q < 9; q++) { var a = q / 9 * PI * .9 + .2, rr = 7; BX('block', 'stone', -13 + Math.cos(a) * 1.2, .5 + Math.sin(a) * rr * .55, -2 + Math.cos(a) * rr, 1.2, 1.0, 1.6, .1, PALE, .3, 0, a - PI / 2); }
      statueL(-5, -8, .3, 1, .9); statueL(5, -8, -.3, 1, .9);
      pyre(-4, 2, 1, 26); pyre(4, 2, 1, 26);
      candleCluster(-6.5, -2, 6); candleCluster(6.5, -2, 6);
      decals({ cracks: 5, soot: 3, chips: 4, bones: 2 }); debris(8, 4, 16); embers(12, -12, 12, -9, 9, 5, 1); smoke(4, [.3, .22, .22], .18, .5, 3.5, 4);
      voidChain(-14, 6, [-1, .2], 14); voidChain(14, -6, [1, -.2], 14);
    };
    /* 1 Asılı Zincirler — colossal chains from the dark sky, a hanging cage over the edge */
    ROOM[1] = function () {
      island({ tint: [.56, .53, .52] });
      skyChain(-9, -5, [-3, -4]); skyChain(9, 5, [3, 3]); skyChain(-8, 6, [-4, 2], 2.0); skyChain(10, -6, [4, -3], 2.0);
      cage(-15.5, 0, -2.5, 14); cage(15.5, 2, -1.2, 14);
      // fallen links lying across the stone
      for (var k = 0; k < 6; k++) BX('biglink', 'iron', -2 + k * 1.2, .25, 7 - k * .3, 2.2, 2.2, 2.2, .3, [.45, .4, .38], .3, PI / 2 * (k % 2 ? 1 : .15));
      pyre(0, -7, 1.1, 30); obelisk(-12, -7, 4.5, .4);
      decals({ cracks: 6, soot: 4, chips: 4, blood: 1 }); debris(8, 4, 18); embers(14, -14, 14, -9, 9, 6, 1); smoke(5, [.3, .2, .2], .18, .5, 3.5, 4);
    };
    /* 2 Tanıkların Köprüsü — a broad causeway lined with hooded witnesses who watch the accused pass */
    ROOM[2] = function () {
      island({ tint: [.66, .62, .6] });
      [-1, 1].forEach(function (s) { for (var k = 0; k < 4; k++) { var z = -8 + k * 5.4; statueL(s * 5.2, z, s > 0 ? -PI / 2 : PI / 2, k % 2 ? 1 : 0, 1.05, [.7, .66, .62]); if (k % 2) candleCluster(s * 3.9, z + 2.6, 4); } });
      [-1, 1].forEach(function (s) { pyre(s * 8, -3.6, 1.0, 28); });
      decals({ cracks: 4, chips: 4, soot: 2, bones: 2 }); debris(10, 3, 14); embers(10, -8, 8, -10, 10, 5, 1);
      voidChain(-7.5, -10, [-1, -.5], 12); voidChain(7.5, 10, [1, .5], 12);
    };
    /* 3 Mahkûmlar Kuyusu — a ring around a bleeding well; bound figures kneel at the rim, chains plunge into the pit */
    ROOM[3] = function () {
      island({ tint: [.52, .48, .48] });
      // the well's inner rim
      [[0, -4.3, 10.4, .8], [0, 4.3, 10.4, .8], [-5.3, 0, .8, 8.6], [5.3, 0, .8, 8.6]].forEach(function (q) { BX('box', 'stone', q[0], .12, q[1], q[2], .5, q[3], 0, PALE, .3); });
      for (var lv = 0; lv < 5; lv++) { var y = -1.1 - lv * 2.2, sh = 1 - lv * .1, tn = [.5 - lv * .07, .46 - lv * .07, .45 - lv * .07]; BX('box', 'stone', 0, y, -4.1 * sh, 10 * sh, 2.1, .5, (R() - .5) * .04, tn, .4); BX('box', 'stone', 0, y, 4.1 * sh, 10 * sh, 2.1, .5, (R() - .5) * .04, tn, .4); BX('box', 'stone', -5.1 * sh, y, 0, .5, 2.1, 8.2 * sh, (R() - .5) * .04, tn, .4); BX('box', 'stone', 5.1 * sh, y, 0, .5, 2.1, 8.2 * sh, (R() - .5) * .04, tn, .4); if (lv % 2) for (var q = 0; q < 4; q++) HOT((q < 2 ? -1 : 1) * (q % 2 ? 2.2 : -2.2) * sh, y + .3, (q < 2 ? -3.84 : 3.84) * sh, .9, .06, .04, [.9, .08, .04]); }
      SP(S.glow, 0, -11, 0, 7, 6, [1.0, .1, .04], .7, .3, 1); SP(S.glow, 0, -6, 0, 5, 4, [.5, .05, .02], .5, .5, 1); SP(S.pool, 0, -12, 0, 8, 7, [1.2, .12, .05], .8, .4, 1);
      for (var k = 0; k < 18; k++) K.spr(i, S.ember, X((R() - .5) * 8), -6, Z((R() - .5) * 6), .06, .06, [2.4, .4, .15], 1, R(), .15 + R() * .2, 11);
      K.light(i, X(0), -1.5, Z(0), 0xff2a18, 26, 14, { scatter: .9, glow: 1.6, flicker: .2 });
      [[-4.6, -3.6], [4.6, -3.6], [-4.6, 3.6], [4.6, 3.6]].forEach(function (p) { bigChain(K, i, X(p[0] * 2.2), 9, Z(p[1] * 2.2), X(p[0] * .4), -8, Z(p[1] * .4), 1.4, [.44, .38, .36]); });
      [[-7.2, -7.8, .2], [7.2, -7.8, -.2], [-12.5, 0, PI / 2], [12.5, 0, -PI / 2], [-7, 7.8, PI], [7, 7.8, PI]].forEach(function (p) { statueL(p[0], p[1], p[2] + PI, 1, .85, [.6, .55, .52]); });
      pyre(-12, -8, 1, 26); pyre(12, 8, 1, 26);
      decals({ cracks: 6, blood: 4, soot: 3, bones: 3 }); debris(8, 4, 14); smoke(4, [.34, .16, .14], .2, .3, 3.5, 4);
    };
    /* 4 Celladın Gölgesi — the executioner's shadow: an enormous axe driven into a block, gallows, blood channels */
    ROOM[4] = function () {
      island({ tint: [.55, .5, .5] });
      BX('box', 'stone', 0, .55, -7.6, 5, 1.1, 2.6, 0, [.5, .44, .42], .5); solidL(0, -7.6, 5, 2.6);
      BX('box', 'iron', 0, 4.2, -8.0, .5, 6.6, .5, .08, [.4, .34, .32], .3, 0, .1);
      BX('blade', 'iron', .35, 1.95, -8.0, 3.6, 3.2, .26, .08, [.62, .54, .52], .3, 0, -.25);
      HOT(.3, 1.4, -7.85, 2.8, .05, .05, BLOOD, .08); SP(S.glow, 0, 2, -7.4, 3.2, 3.2, [.6, .05, .03], .5, 1, 1);
      // gallows frames
      [-1, 1].forEach(function (s) { BX('box', 'wood', s * 10, 3, 5, .45, 6, .45, 0, [.5, .4, .38], .5); BX('box', 'wood', s * 10 - s * 1.6, 5.9, 5, 3.6, .4, .4, 0, [.5, .4, .38], .3); K.chain(i, X(s * 10 - s * 3), 5.7, Z(5), 2.4, RUST); solidL(s * 10, 5, .7, .7); });
      // blood channels cut into the floor leading to the block
      for (var k = 0; k < 3; k++) { var x0 = (k - 1) * 4.5; HOT(x0 * .5, .02, -2.4 + Math.abs(k - 1) * .6, .22, .03, 9, [.75, .05, .03], (k - 1) * .35); }
      K.dec(i, 5, X(0), Z(-2), 11, 11, .4, [.5, .05, .04], .25, 'glow');
      pyre(-7, -6, 1.1, 30); pyre(7, -6, 1.1, 30); obelisk(-14, 2, 5, .3); obelisk(14, -2, 5, -.3);
      decals({ cracks: 6, blood: 7, soot: 4, bones: 3 }); debris(8, 4, 16); embers(14, -12, 12, -10, 9, 5, 1);
    };
    /* 5 Çancının Gölgesi — the bell-ringer's shadow: a colossal cracked bell sunk into the platform, brine and dead lanterns */
    ROOM[5] = function () {
      island({ tint: [.5, .52, .54] });
      BX('bell', 'iron', -8.2, 2.1, -6.0, 7.2, 7.2, 7.2, .3, [.42, .46, .44], .4, .22, .1); solidL(-8.2, -5.8, 6.2, 4.4);
      BX('crag', 'rock', -5.6, .3, -3.6, 3, 1.1, 2.4, .5, BASALT, .5); BX('block', 'iron', -11.4, .4, -3.4, 1.4, .3, 1.0, .9, [.4, .44, .42], .2, .4, .2);
      SP(S.glow, -8.2, 1.5, -5, 3.4, 2.5, [.12, .3, .34], .4, 1, 1);
      for (var k = 0; k < 6; k++) { var a = k / 6 * PI * 2 + .3, x = Math.cos(a) * 11.5, z = Math.sin(a) * 6.5; if (!inRoom(x, z, 1)) continue; BX('box', 'iron', x, 1.4, z, .18, 2.8, .18, 0, RUST, .3); BX('box', 'iron', x, 2.9, z, .5, .55, .5, 0, [.35, .4, .4], .2); SP(S.glow, x, 2.9, z, .8, .8, [.1, .26, .3], .5, 1, 1); solidL(x, z, .4, .4); }
      K.light(i, X(-7.5), 3, Z(-2.5), 0x6ab0c0, 16, 13, { flicker: .06 });
      decals({ cracks: 5, soot: 2, chips: 4, blood: 2 }); for (var k = 0; k < 4; k++) K.dec(i, 2, X((R() - .5) * 18), Z((R() - .5) * 12), 3.5, 3.5, R() * 6, [.5, .8, .8], .6, 'wet');
      pyre(-10, 5, 1, 24); pyre(10, 5, 1, 24); debris(8, 4, 16); smoke(6, [.2, .26, .3], .2, .4, 4, 3);
    };
    /* 6 Kralın Gölgesi — the king's shadow: a shattered throne on a dais, violet grave crystals growing through the stone */
    ROOM[6] = function () {
      island({ tint: [.54, .52, .56] });
      for (var k = 0; k < 3; k++) BX('box', 'stone', 0, .15 + k * .3, -7.4 + k * .4, 9 - k * 2, .3, 4.2 - k * .8, 0, PALE, .3);
      solidL(0, -8.2, 5, 2.4);
      BX('box', 'stone', 0, 1.6, -8.2, 2.6, 1.4, 1.8, 0, [.6, .56, .6], .4); BX('box', 'stone', 0, 3.6, -9.0, 2.6, 4.2, .5, 0, [.6, .56, .6], .4, -.08, .12);
      BX('box', 'stone', -1.3, 2.6, -8.2, .4, 1.2, 1.8, 0, PALE, .3); BX('crag', 'stone', 1.6, .8, -6.6, 1.4, .8, 1.2, .4, PALE, .4);
      K.crystals(i, X(-9), Z(-5), 6, 1.4, 1.2, 3.6, 'crystalV', R, { glowCol: [.7, .3, 1.2], light: true, lightColor: 0x9a60e0, intensity: 20 });
      K.crystals(i, X(11.5), Z(5.5), 5, 1.2, 1.0, 3.0, 'crystalV', R, { glowCol: [.7, .3, 1.2] });
      K.crystals(i, X(12), Z(-6), 4, 1.0, .8, 2.4, 'crystalV', R, { glowCol: [.7, .3, 1.2] });
      // the broken crown lying on the steps
      for (var q = 0; q < 7; q++) { var a = q / 7 * PI * 2; BX('cone4', 'iron', 2.8 + Math.cos(a) * .55, .62, -5.4 + Math.sin(a) * .55, .18, .5, .18, a, [.8, .66, .4], .1, .3, 0); }
      BX('rim', 'iron', 2.8, .45, -5.4, 1.2, 1.2, 1.2, 0, [.8, .66, .4], .1, PI / 2 + .3);
      [-1, 1].forEach(function (s) { K.column(i, X(s * 6.5), Z(-6.5), 6.5, 1.1, 'stone', { tint: PALE, broken: s < 0 }); solidL(s * 6.5, -6.5, 1.3, 1.3); });
      pyre(-6, 5, 1, 24); pyre(6, 5, 1, 24);
      decals({ cracks: 6, soot: 3, chips: 5, bones: 2 }); debris(8, 4, 16); smoke(4, [.24, .2, .3], .18, .5, 3.5, 4);
    };
    /* 7 Ocağın Gölgesi — the furnace's shadow: a cold anvil, a molten blood-iron channel crossing the platform, slag mounds */
    ROOM[7] = function () {
      island({ tint: [.5, .46, .44] });
      K.put(i, 'panel', 'lava', X(-9), .085, Z(0), 3, 1, 13, 0, 0, 0, [1.5, 6.5, 0], 0); solidL(-9, 0, 2.6, 13);
      [-1, 1].forEach(function (sd) { BX('box', 'iron', -9 + sd * 1.7, .2, 0, .3, .4, 13.2, 0, IRONT, .3); });
      SP(S.pool, -9, .2, -3, 7, 7, [.5, .07, .03], .35, 1, 1); SP(S.pool, -9, .2, 4, 7, 7, [.5, .07, .03], .35, 1, 1);
      K.heat(X(-9), .6, Z(0), 2.5, 10, 1);
      // anvil altar
      BX('box', 'iron', 3, .3, -6, 2.2, .6, 1.5, .2, IRONT, .5); BX('box', 'iron', 3, .85, -6, 1.2, .6, .8, .2, IRONT, .4); BX('box', 'iron', 3, 1.4, -6, 2.6, .5, 1.1, .2, IRONT, .3); solidL(3, -6, 2.6, 1.8);
      HOT(3, 1.66, -6, 1.6, .03, .5, [1.3, .3, .08], .2);
      for (var k = 0; k < 3; k++) { var x = [4, 8, 11][k], z = [8.5, 8, 5.6][k]; BX('crag', 'rock', x, .3, z, 2.2, 1.2, 2, R() * 6, [.3, .27, .26], .5); BX('rock', 'slag', x + .3, .7, z, .7, .4, .6, R() * 6, [.6, .45, .4], .2); SP(S.pool, x, .14, z, 3.5, 3.5, [.8, .14, .05], .45, 1, 1); solidL(x, z, 1.8, 1.6); }
      pyre(10, -6, 1, 26);
      decals({ cracks: 5, soot: 6, chips: 4, heat: 3 }); debris(8, 4, 16); embers(30, -14, 14, -9, 9, 6.5, 1.2); smoke(6, [.36, .24, .2], .24, .6, 3.6, 5);
    };
    /* 8 Yüzen Taşlar — the court breaks apart: islands linked by narrow stone, rune obelisks, many shards adrift */
    ROOM[8] = function () {
      island({ tint: [.56, .52, .52] });
      obelisk(-13, -6, 5.5, .2); obelisk(13, 6, 5.5, -.2); obelisk(0, -9.4, 4.4, 0);
      for (var k = 0; k < 6; k++) { var s = k % 2 ? 1 : -1, x = s * (14 + R() * 10), z = (R() - .5) * 20, y = -1 - R() * 3, sz = 3 + R() * 3;
        K.put(i, 'tile', 'floor', X(x), y, Z(z), sz, .5, sz * .8, R() * 6, 0, 0, [.5, .47, .46], 0); K.put(i, 'crag', 'rock', X(x), y - 1.8, Z(z), sz, 3.2, sz * .8, R() * 6, 0, 0, BASALT, .4); K.put(i, 'spike', 'rock', X(x), y - 5, Z(z), sz * .6, 5, sz * .5, R() * 6, PI, 0, [.28, .26, .26], .2);
        if (k % 2) K.statue(i, X(x), Z(z), R() * 6, { key: 'stone', tint: PALE, pose: 1, s: .8 }); }
      pyre(-4, 6, 1, 24); pyre(4, -6, 1, 24);
      decals({ cracks: 6, chips: 6, soot: 2 }); debris(10, 8, 22); embers(16, -14, 14, -10, 10, 7, 1);
    };
    /* 9 Hüküm Defteri — the ledger of verdicts: standing stone pages carved with burning names, lecterns, ink-black blood */
    ROOM[9] = function () {
      island({ tint: [.6, .56, .54] });
      var PAGES = [[-12.5, -5.4, .95], [-8, -8.6, .45], [8, -8.6, -.45], [12.5, -5.4, -.95], [-13.4, 3, 1.35]];
      for (var k = 0; k < 5; k++) { var x = PAGES[k][0], z = PAGES[k][1], rot = PAGES[k][2];
        BX('box', 'stone', x, 2.6, z, 3.4, 5.2, .5, rot, [.72, .68, .64], .5); BX('box', 'stone', x, 5.35, z, 3.6, .3, .7, rot, PALE, .2); solidL(x, z, 2.6, 1.8);
        for (var l = 0; l < 6; l++) HOT(x, 1.2 + l * .62, z + .27, 2.2 - (l % 3) * .4, .05, .02, [1.4, .16, .08], rot); }
      SP(S.glow, -10, 3, -7, 6, 3.4, [.4, .04, .02], .5, 1, 1); SP(S.glow, 10, 3, -7, 6, 3.4, [.4, .04, .02], .5, 1, 1);
      [[-6, 0], [6, 0], [0, 5]].forEach(function (p) { BX('box', 'wood', p[0], .55, p[1], .3, 1.1, .3, 0, [.45, .38, .36], .4); BX('box', 'stone', p[0], 1.15, p[1], 1.0, .12, .7, .3, BONE, .2, -.3, 0); candleCluster(p[0] + .7, p[1] + .5, 3); solidL(p[0], p[1], .6, .6); });
      // the Ledger itself hovers over the platform, open, chained to four anchors: its pages burn with names
      var by = 4.4, bz = .5;
      BX('box', 'wood', -2.1, by, bz, 4.0, .35, 5.4, 0, [.22, .1, .09], .3, 0, .16); BX('box', 'wood', 2.1, by, bz, 4.0, .35, 5.4, 0, [.22, .1, .09], .3, 0, -.16);
      BX('box', 'stone', -2.0, by + .3, bz, 3.7, .18, 5.0, 0, [.9, .84, .74], .2, 0, .16); BX('box', 'stone', 2.0, by + .3, bz, 3.7, .18, 5.0, 0, [.9, .84, .74], .2, 0, -.16);
      for (var l = 0; l < 9; l++) { HOT(-2.0, by + .55 - .02 * l, bz - 2 + l * .5, 2.6 - (l % 3) * .5, .02, .06, [1.3, .1, .05], 0); HOT(2.0, by + .55 - .02 * l, bz - 2 + l * .5, 2.4 - (l % 2) * .6, .02, .06, [1.3, .1, .05], 0); }
      SP(S.glow, 0, by + .8, bz, 5, 3, [.6, .06, .03], .6, .6, 1); for (var q = 0; q < 16; q++) K.spr(i, S.ember, X((R() - .5) * 7), by + .6, Z(bz + (R() - .5) * 5), .05, .05, [2.4, .3, .15], 1, R(), .2, 4);
      [[-4.5, -6.5], [4.5, -6.5], [-4.5, .5], [4.5, .5]].forEach(function (q) { BX('cyl', 'iron', q[0] * 2.2, .25, q[1] + (q[1] > 0 ? 3 : -2), 1, .5, 1, 0, IRONT, .4); bigChain(K, i, X(q[0] * 2.2), .4, Z(q[1] + (q[1] > 0 ? 3 : -2)), X(q[0] * .85), by - .1, Z(bz + q[1] * .55), .9, [.46, .4, .38], .5); });
      pyre(-12, 4, 1, 26); pyre(12, 4, 1, 26);
      decals({ cracks: 5, soot: 4, chips: 4, blood: 3 }); debris(8, 4, 16); embers(10, -12, 12, -9, 9, 5, 1); smoke(4, [.3, .22, .2], .18, .5, 3.5, 4);
    };
    /* 10 Kanlı Terazi — the bloody scales: a colossal balance, one pan heavy with blood */
    ROOM[10] = function () {
      island({ tint: [.52, .48, .48] });
      BX('box', 'stone', 0, .4, -4, 3.2, .8, 3.2, 0, PALE, .5); BX('column', 'stone', 0, 4.8, -4, 1.3, 8, 1.3, 0, PALE, .5); solidL(0, -4, 3.2, 3.2);
      BX('box', 'iron', 0, 8.6, -4, 16, .45, .6, 0, [.6, .5, .42], .2, 0, .09); BX('cone4', 'iron', 0, 9.4, -4, .9, 1.2, .9, PI / 4, [.6, .5, .42], .2);
      [[-7.8, 9.3, 4.2], [7.8, 7.9, 5.4]].forEach(function (p, k) {
        for (var c = 0; c < 3; c++) { var a = c / 3 * PI * 2; K.bar(i, 'cyl', 'iron', X(p[0]), p[1], Z(-4), X(p[0] + Math.cos(a) * 1.5), p[1] - p[2], Z(-4 + Math.sin(a) * 1.5), .045, RUST, .1); }
        BX('vat', 'iron', p[0], p[1] - p[2] - .35, -4, 3.4, .7, 3.4, 0, [.55, .46, .4], .2);
        if (k === 1) { BX('disc', 'hot', p[0], p[1] - p[2] - .05, -4, 2.9, 1, 2.9, 0, [1.0, .05, .03], 0); SP(S.glow, p[0], p[1] - p[2] + .4, -4, 3, 2, [.8, .05, .03], .6, 1, 1); for (var d = 0; d < 6; d++) K.spr(i, S.ember, X(p[0] + (R() - .5)), p[1] - p[2] - .5, Z(-4 + (R() - .5)), .05, .05, [2, .2, .1], 1, R(), .4, -3); }
        else BX('rock', 'stone', p[0], p[1] - p[2] + .1, -4, 1.4, .5, 1.2, .3, BONE, .2);
      });
      K.dec(i, 2, X(7.8), Z(-4), 5, 5, 0, [1, 1, 1], .95, 'wet'); K.dec(i, 2, X(6.5), Z(-1.5), 3, 3, 1, [1, 1, 1], .85, 'wet');
      K.light(i, X(5), 3, Z(-3), 0xff3020, 18, 14, { flicker: .1 });
      pyre(-10, 5, 1, 26); pyre(10, 5, 1, 26); obelisk(-14, -5, 4.5, .4);
      decals({ cracks: 6, blood: 5, soot: 3, bones: 2 }); debris(8, 4, 16); embers(12, -12, 12, -9, 9, 5, 1);
    };
    /* 11 Son Tanıklık — the last testimony: a round dais, a ring of testimonies and the oath crystal (checkpoint) */
    ROOM[11] = function () {
      island({ tint: [.66, .62, .6] });
      for (var k = 0; k < 3; k++) K.put(i, 'cyl', 'stone', X(0), .09 + k * .17, Z(0), 12.2 - k * 1.6, .18, 12.2 - k * 1.6, 0, 0, 0, [PALE[0] * (1 - k * .05), PALE[1] * (1 - k * .05), PALE[2]], .1);
      K.dec(i, 5, X(0), Z(0), 9, 9, .2, [.6, .12, .06], .26, 'glow', .56); K.dec(i, 6, X(0), Z(0), 5.6, 5.6, 0, [.6, .14, .06], .22, 'glow', .57);
      for (var q = 0; q < 6; q++) { var a = q / 6 * PI * 2, x = Math.cos(a) * 9, z = Math.sin(a) * 6.6; BX('box', 'stone', x, 1.6, z, .7, 3.2, .7, a, PALE, .5); BX('box', 'stone', x, 3.3, z, 1.0, .25, 1.0, a, BONE, .2); HOT(x, 2.4, z, .74, .08, .74, EMBER, a); candleCluster(x * .82, z * .82, 3); solidL(x, z, .9, .9); }
      for (var q = 0; q < 4; q++) { var a = q * PI / 2 + PI / 4; pyre(Math.cos(a) * 12.2, Math.sin(a) * 7.4, .9, 22); }
      for (var q = 0; q < 26; q++) K.spr(i, S.ember, X((R() - .5) * 9), .7, Z((R() - .5) * 9), .05, .05, [2, .9, .4], 1, R(), .15 + R() * .15, 6);
      K.spr(i, S.beam, X(0), 0, Z(0), 2.6, 16, [GOLD[0] * .35, GOLD[1] * .35, GOLD[2] * .35], .55, .3, 1, 1); K.spr(i, S.pool, X(0), .7, Z(0), 6, 6, [GOLD[0] * .35, GOLD[1] * .3, GOLD[2] * .2], .5, .1, 1, 1);
      for (var q = 0; q < 24; q++) K.spr(i, S.mote, X((R() - .5) * 5), 1 + R() * 6, Z((R() - .5) * 5), .04, .04, [1.6, 1.2, .6], .9, R(), .3 + R() * .3, 2);
      decals({ cracks: 3, chips: 3 }); debris(8, 4, 16); smoke(4, [.3, .24, .22], .16, .6, 3.4, 5);
    };
    /* 12 Kürsü Merdiveni — the stair of the dais: colossal judges line the climb, banners of the four lords */
    ROOM[12] = function () {
      island({ tint: [.6, .56, .54] });
      for (var k = 0; k < 4; k++) BX('box', 'stone', 0, .02 + k * .015, 8 - k * 5.4, 15.5, .1, .6, 0, [.75, .7, .66], .2);
      [-1, 1].forEach(function (s) { for (var k = 0; k < 3; k++) { var z = 7 - k * 7; statueL(s * 6.8, z, s > 0 ? -PI / 2 : PI / 2, 0, 1.45, [.62, .58, .56]); } });
      var cols = [[.42, .05, .04], [.12, .2, .24], [.24, .1, .3], [.42, .16, .04]];
      [-1, 1].forEach(function (s) { for (var k = 0; k < 2; k++) K.banner(i, X(s * 8.3), 3.6, Z(-3.5 + k * 7), 1.4, 3.6, PI / 2, cols[(s > 0 ? 2 : 0) + k]); });
      pyre(-4.5, -8, 1, 26); pyre(4.5, -8, 1, 26);
      decals({ cracks: 5, chips: 5, blood: 2, soot: 2 }); debris(8, 4, 16); embers(14, -10, 10, -10, 10, 6, 1.1);
      skyChain(-10, -7, [-3, -3], 2.0); skyChain(10, 7, [3, 3], 2.0);
    };
    /* 13 Son Mahkeme — the last court: concentric judgement rings, the judge's pulpit, a broken halo of the sky, the four lords' chained sigils */
    ROOM[13] = function () {
      island({ tint: [.54, .5, .5], noKerb: true });
      K.dec(i, 5, X(0), Z(0), 14, 14, .2, [.5, .08, .05], .07, 'glow'); K.dec(i, 6, X(0), Z(0), 22, 22, .4, [.4, .06, .04], .05, 'glow');
      // the pulpit (kürsü) at the north edge
      var pz = -13.2;
      for (var k = 0; k < 3; k++) BX('box', 'stone', 0, .3 + k * .6, pz + .6 - k * .4, 10 - k * 1.8, .6, 3.0 - k * .5, 0, [.6 - k * .04, .55 - k * .04, .52], .4);
      BX('box', 'rock', 0, 3.6, pz - .6, 3.4, 3.6, 1.2, 0, BASALT, .5); BX('box', 'stone', 0, 5.6, pz - .6, 4.2, .4, 1.6, 0, PALE, .2);
      HOT(0, 3.6, pz - .0, 2.4, .06, .04, BLOOD); HOT(0, 2.6, pz - .0, 1.6, .06, .04, BLOOD);
      // the pulpit's dressing: the open Black Ledger on a lectern, tall candles on every step, braziers and hanging verdict banners
      BX('box', 'stone', 0, 2.25, pz + .9, 1.2, 1.3, .8, 0, PALE, .4); BX('box', 'wood', 0, 2.98, pz + .9, 1.9, .12, 1.2, 0, [.16, .1, .1], .2, -.32, 0);
      BX('box', 'stone', -.48, 3.08, pz + .92, .82, .05, 1.0, 0, BONE, .1, -.32, .05); BX('box', 'stone', .48, 3.08, pz + .92, .82, .05, 1.0, 0, BONE, .1, -.32, -.05);
      for (var l = 0; l < 5; l++) { HOT(-.48, 3.13, pz + .62 + l * .13, .55 - (l % 2) * .15, .01, .02, [1.2, .1, .05], 0); HOT(.48, 3.13, pz + .62 + l * .13, .5 - (l % 3) * .1, .01, .02, [1.2, .1, .05], 0); }
      SP(S.glow, 0, 3.3, pz + .9, 1.4, 1.0, [.6, .06, .03], .6, 1, 1);
      for (var k = 0; k < 3; k++) { candleCluster(-4.4 + k * .6, pz + 1.6 - k * .4, 3); candleCluster(4.4 - k * .6, pz + 1.6 - k * .4, 3); }
      pyre(-7, pz + 1.2, 1.2, 30); pyre(7, pz + 1.2, 1.2, 30);
      K.banner(i, X(-3.2), 6.2, Z(pz - 1.3), 1.4, 4.4, 0, [.36, .04, .04]); K.banner(i, X(3.2), 6.2, Z(pz - 1.3), 1.4, 4.4, 0, [.36, .04, .04]);
      for (var k = 0; k < 4; k++) BX('rock', 'stone', -2 + k * 1.3, .9 + (k % 2) * .15, pz + 2.6, .5, .25, .4, R() * 6, BONE, .2);
      // the broken halo standing in the void behind the pulpit
      BX('halo', 'stone', 0, 9, pz - 4.5, 22, 22, 22, 0, PALE, .2);
      for (var q = 0; q < 14; q++) { var a = q / 14 * PI * 2; if (q === 3 || q === 4 || q === 10) continue; BX('block', 'stone', Math.cos(a) * 10.6, 9 + Math.sin(a) * 10.6, pz - 4.5, 1.4, 1.0, 1.4, 0, PALE, .2, 0, a - PI / 2); }
      for (var q = 0; q < 24; q++) { var a = q / 24 * PI * 2; HOT(Math.cos(a) * 11.4, 9 + Math.sin(a) * 11.4, pz - 4.3, .5, .12, .1, BLOOD, 0); }
      SP(S.glow, 0, 9, pz - 4.8, 12, 12, [.45, .04, .03], .45, .5, 1);
      K.light(i, X(0), 4.5, Z(pz + 3), 0xff3424, 24, 18, { scatter: .6, glow: 1.2, flicker: .12 });
      // four sigil pillars of the fallen lords, chained to the centre
      var lords = [[-14, -9, [.9, .1, .05]], [14, -9, [.15, .5, .6]], [-14, 9, [.6, .25, 1.0]], [14, 9, [1.2, .45, .1]]];
      lords.forEach(function (L) {
        BX('box', 'stone', L[0], .4, L[1], 2.4, .8, 2.4, 0, PALE, .5); BX('box', 'rock', L[0], 3.4, L[1], 1.3, 5.6, 1.3, 0, BASALT, .5); BX('box', 'stone', L[0], 6.3, L[1], 1.9, .4, 1.9, 0, PALE, .2); solidL(L[0], L[1], 2.2, 2.2);
        HOT(L[0], 4.6, L[1] + (L[1] < 0 ? .66 : -.66), .7, .7, .04, L[2]); SP(S.glow, L[0], 6.9, L[1], 1.6, 1.6, [L[2][0] * .5, L[2][1] * .5, L[2][2] * .5], .7, 1, 1); K.spr(i, S.flame, X(L[0]), 7.3, Z(L[1]), .5, .9, L[2], .9, R(), 1, 1);
        bigChain(K, i, X(L[0] * .93), 5.6, Z(L[1] * .93), X(L[0] * .45), .3, Z(L[1] * .45), .95, [.5, .44, .42], .6); BX('cyl', 'iron', L[0] * .45, .2, L[1] * .45, 1.1, .4, 1.1, 0, IRONT, .4);
        K.light(i, X(L[0]), 5, Z(L[1]), new window.THREE.Color(L[2][0] / 1.3, L[2][1] / 1.3, L[2][2] / 1.3).getHex(), 18, 12, { flicker: .1 });
      });
      
      decals({ cracks: 8, blood: 6, soot: 6, chips: 6, bones: 3 }); debris(12, 5, 22); embers(50, -16, 16, -13, 13, 8, 1.3); smoke(8, [.34, .14, .12], .24, .6, 4, 5.5);
      skyChain(-17, -2, [-5, -3], 2.6); skyChain(17, 2, [5, 3], 2.6);
    };
    ROOM[i]();
    voidLight();
    floorLife(i === 13 ? 2 : 5, i === 11 || i === 13 ? 0 : 2, [5, 6, 8].indexOf(i) >= 0 ? [.16, .2, .66] : i % 3 === 0 ? [.62, .4, .14] : [.56, .07, .035]);
  }
  // Causeways across every gap: cut slabs, low kerbs, a hanging underside and chains dropping into the void.
  function bridges(K, info) {
    setupOnce(K);
    var S = K.SPR;
    info.bridges.forEach(function (b) {
      var i = b.room, R = K.rng(i, 77), n = Math.max(2, Math.round(b.d / 1.6));
      for (var k = 0; k < n; k++) { var z = b.z - b.d / 2 + (k + .5) * b.d / n; for (var c = 0; c < 3; c++) { var x = b.x + (c - 1) * b.w / 3; K.put(i, 'tile', 'stone', x + (R() - .5) * .08, -.07 + (R() - .5) * .02, z, b.w / 3 - .06, .2, b.d / n - .06, (R() - .5) * .03, 0, 0, [.62 * (.9 + R() * .2), .58 * (.9 + R() * .2), .55], 0); } }
      [-1, 1].forEach(function (s) {
        K.put(i, 'box', 'stone', b.x + s * (b.w / 2 + .2), .12, b.z, .55, .55, b.d + .4, 0, 0, 0, [.66, .6, .56], .3);
        K.put(i, 'box', 'rock', b.x + s * (b.w / 2 + .1), -.9, b.z, 1.2, 1.6, b.d + .6, 0, 0, 0, [.34, .31, .31], .4);
        for (var k = 0; k < 2; k++) { var z = b.z + (k ? 1 : -1) * b.d * .3; K.put(i, 'box', 'stone', b.x + s * (b.w / 2 + .25), .9, z, .7, 1.8, .7, 0, 0, 0, [.7, .64, .6], .4); K.put(i, 'cone4', 'stone', b.x + s * (b.w / 2 + .25), 2.1, z, .9, .6, .9, PI / 4, 0, 0, [.7, .64, .6], .2);
          // a cold void lantern hangs from every post: the route reads at a glance, and red is not the only light
          var lx = b.x + s * (b.w / 2 - .25); K.bar(i, 'cyl', 'iron', b.x + s * (b.w / 2 + .25), 2.2, z, lx, 2.2, z, .03, [.5, .44, .42], .1); K.chain(i, lx, 2.15, z, .5, [.5, .44, .42]);
          K.put(i, 'box', 'iron', lx, 1.42, z, .26, .34, .26, PI / 4, 0, 0, [.4, .36, .36], .2); K.put(i, 'box', 'hot', lx, 1.42, z, .16, .24, .16, PI / 4, 0, 0, [.3, .38, 1.4], 0);
          K.spr(i, S.glow, lx, 1.42, z, .9, .9, [.18, .22, .7], .7, R(), 1, 1); K.spr(i, S.pool, lx, .1, z, 2.6, 2.6, [.1, .12, .4], .45, R(), 1, 1); }
        if (R() < .7) bigChain(K, i, b.x + s * (b.w / 2 + .3), -.2, b.z + (R() - .5) * b.d * .5, b.x + s * (b.w / 2 + 2.5), -14, b.z + (R() - .5) * 4, 1.3, [.4, .34, .32]);
        K.spr(i, S.glow, b.x + s * (b.w / 2 + 3), -7, b.z, 3.6, 3.6, [.28, .03, .015], .35, R(), .5, 1);
      });
      K.put(i, 'crag', 'rock', b.x, -2.6, b.z, b.w * .9, 3.4, b.d * .9, R() * 6, 0, 0, [.28, .26, .26], .4);
      K.put(i, 'spike', 'rock', b.x, -7, b.z, b.w * .5, 7, b.d * .6, R() * 6, PI, 0, [.24, .22, .22], .2);
      // runes along the causeway's spine (faint)
      K.dec(i, 6, b.x, b.z, Math.min(4, b.w * .45), Math.min(4, b.w * .45), R() * 6, [.5, .06, .04], .05, 'glow');
    });
  }
  // Hidden platforms: cracked judgement stone on a hanging basalt fang, a stepping-stone causeway, a gold shaft that catches the eye from the route.
  function secrets(K, info) {
    var S = K.SPR;
    info.secrets.forEach(function (q, n) {
      var i = q.room, R = K.rng(i, 91 + n), cols = 4, rows = 4, cw = q.w / cols, ch = q.d / rows;
      for (var gz = 0; gz < rows; gz++) for (var gx = 0; gx < cols; gx++) { var b = .9 + R() * .2; K.put(i, 'tile', 'floor', q.x - q.w / 2 + (gx + .5) * cw, -.07 + (R() - .5) * .02, q.z - q.d / 2 + (gz + .5) * ch, cw - .06, .2, ch - .06, (R() - .5) * .04, 0, 0, [.82 * b, .77 * b, .74 * b], 0); }
      for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2, ex = q.x + Math.sin(a) * (q.w / 2 + .2), ez = q.z + Math.cos(a) * (q.d / 2 + .2);
        if (Math.abs(ez - q.bridge.z) < 2 && Math.abs(ex - q.bridge.x) < q.bridge.w / 2 + 1.5) continue;
        K.put(i, 'block', 'rock', ex, -.35, ez, 1.6, 1, 1.4, a, 0, 0, [.42, .39, .38], .3); if (k % 2) K.put(i, 'crag', 'rock', ex, -1.8, ez, 2.4, 2.4, 2.4, R() * 6, 0, 0, [.34, .31, .31], .5); }
      K.put(i, 'crag', 'rock', q.x, -3.4, q.z, q.w * .86, 5, q.d * .86, R() * 6, 0, 0, [.28, .26, .26], .4); K.put(i, 'spike', 'rock', q.x, -10, q.z, q.w * .55, 12, q.d * .55, R() * 6, Math.PI, 0, [.24, .22, .22], .2);
      var br = q.bridge, steps = Math.round(br.w / 1.5);
      for (var t = 0; t < steps; t++) { var sx = br.x - br.w / 2 + (t + .5) * br.w / steps; K.put(i, 'tile', 'stone', sx, -.08 + Math.sin(t * 1.7) * .03, br.z + (R() - .5) * .2, br.w / steps - .25, .22, br.d - .2, (R() - .5) * .08, 0, 0, [.7, .66, .62], 0);
        K.put(i, 'crag', 'rock', sx, -1.1, br.z, 1.1, 1.6, 2, R() * 6, 0, 0, [.3, .28, .28], .4); K.spr(i, S.glow, sx, -2.5, br.z, 1.6, 1.6, [.12, .14, .5], .5, R(), .6, 1); }
      K.spr(i, S.beam, q.x, 0, q.z, 2.4, 15, [.5, .38, .16], .55, R(), 1, 1); K.spr(i, S.pool, q.x, .1, q.z, 5, 5, [.45, .32, .12], .45, R(), 1, 1);
      for (var m = 0; m < 18; m++) K.spr(i, S.mote, q.x + (R() - .5) * 4, 1 + R() * 6, q.z + (R() - .5) * 4, .04, .04, [1.6, 1.2, .6], .9, R(), .3 + R() * .3, 2);
      K.brazier(i, q.x + (q.cx < 0 ? -3.6 : 3.6), q.z - 3, { s: .9, col: [1.7, .32, .14], lightColor: 0xff5a3a, intensity: 24, tint: [.78, .73, .68] });
      K.statue(i, q.x + (q.cx < 0 ? -4 : 4), q.z + 3, q.cx < 0 ? Math.PI / 2 : -Math.PI / 2, { key: 'stone', tint: [.78, .73, .68], pose: 1, s: .85 }); K.solid(q.x + (q.cx < 0 ? -4 : 4), q.z + 3, 1.2, 1.2);
    });
  }
  B.FinaleRooms = { dress: dress, bridges: bridges, secrets: secrets, moodBase: moodBase, moodSpecs: moodSpecs };
}());
