/* KABİR AZABI — secondary motion (ajan:secondary). Publishes BABA.Secondary. ?nophys turns it all off (every chain then rests rigid,
   exactly like the old fixed gear). Cheap spring chains with simple body collision for capes, tabards, skirts, sashes, tassels,
   straps and chain ends — no extra draw call, no extra mesh, no per-frame allocation.

   BUILD (authored-models.js Assembly, once per blueprint):
     var X = B.Secondary.begin(A)           -> builder, also stored as A.secondary
     X.sheet(id, { parent, cols:[[J0,J1..JN], ...], ring, preset })  columns of joints (bind space, J0 = anchor on `parent`), one helper
                                            bone per link (name sx:<id>:<col>:<link>), parent chain under the anchor bone
     X.chain(id, parent, joints, preset)    a single-column sheet (tassel, strap, chain loop)
     X.skin(sheet, { hinge, pin })          -> weights function for A.weighted / heroEquipment part(opts.skin): vertices follow the
                                            columns (lateral blend) and the links (depth blend); the top stays on `parent`.
     X.own(id, name)                        the sheet is simulated only while a mesh with that name / equipment id is visible
     X.proxy(bone, a, b, r)                 body collision capsule (bind-space ends) on a bone
   RUN (authored-models.js create(), after authored-motion and the dread posture):
     B.Secondary.attach(info, { root, scene, native, extras, hero })
       Verlet per particle (time-corrected), damping, gravity, a small wind, a spring back to the rigid pose, link-length constraints
       (3 passes), a bend limit, lateral cloth coupling, capsule collision (+ ground clamp). The result is written back as bone
       rotations: the GPU skins the cloth, the CPU never touches a vertex.
   Presets: cloth (cape), light (sash/tassel), skirt (waist hem), heavy (chain, plates: stiff, quickly damped). */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE;
  var OFF = /[?&]nophys(&|$)/.test(location.search);
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  // g gravity scale, damp 1/s, ks spring (1/s^2) toward the rigid pose, wind scale, margin collision offset (m), bend min distance factor
  var PRESET = {
    cloth: { g: 1, damp: 2.3, ks: 6, wind: 1, margin: .03, bend: .72, lat: .4, flut: 5 },
    light: { g: 1, damp: 3, ks: 8, wind: .9, margin: .02, bend: .6, lat: .4, flut: 3 },
    skirt: { g: 1, damp: 3.2, ks: 18, wind: .6, margin: .022, bend: .7, lat: .45, flut: 2 },
    heavy: { g: 1.3, damp: 7, ks: 90, wind: .1, margin: .018, bend: .7, lat: .5, flut: 0 },
    rag: { g: 1, damp: 2.3, ks: 6, wind: 1.3, margin: .02, bend: .6, lat: .35, flut: 4 }
  };
  var V3 = T.Vector3, Q4 = T.Quaternion, M4 = T.Matrix4;
  var sV = new V3(), sQ = new Q4(), sQ2 = new Q4(), sS = new V3(), sP = new V3(), sM = new M4(), sQs = new Q4(), sQsi = new Q4(), sQp = new Q4(), sW = new Q4(), sD = new V3(), sR = new V3();
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  // frame counter + wind (one rAF callback for the whole game)
  var S = { prof: false, ms: 0, calls: 0, frame: 0, time: 0, wx: 0, wz: 0, used: 0, usedFrame: -1, quality: 'high' };
  (function loop(t) { S.frame++; S.time = t * .001; S.wx = Math.sin(S.time * .63) * .5 + Math.sin(S.time * 1.7 + 1) * .25; S.wz = Math.sin(S.time * .41 + 2) * .4 + Math.sin(S.time * 2.3) * .2; window.requestAnimationFrame(loop); })(0);

  // ------------------------------------------------------------------------------------------------ build
  function Builder(A) {
    this.A = A; this.info = { chains: [], links: [], proxies: [], sheets: {} }; this.sheets = this.info.sheets; this.byId = {}; A.secondary = this;
  }
  Builder.prototype.local = function (parent, p) {   // bind-space point -> the parent bone's bind-local coordinates
    var m = this.A.world(this.A.index[parent]).invert(); return new V3(p[0], p[1], p[2]).applyMatrix4(m).toArray();
  };
  Builder.prototype.sheet = function (id, spec) {
    if (this.sheets[id]) return this.sheets[id];
    var A = this.A, X = this, parent = spec.parent, sh = { id: id, parent: parent, ring: !!spec.ring, preset: spec.preset || 'cloth', cols: [], row: [], centre: spec.centre || null, owners: [], N: spec.cols[0].length - 1 };
    if (A.index[parent] === undefined) throw Error('Kemik yok: ' + parent);
    spec.cols.forEach(function (joints, c) {
      var names = [], prev = parent, ch = { id: id + ':' + c, sheet: id, col: c, parent: parent, joints: joints.map(function (j) { return j.slice(); }), bones: names, preset: sh.preset, owners: sh.owners, loc: [], dirs: [], lens: [], nrm: [0, 0, 1] };
      if (sh.ring && sh.centre) { var rx0 = joints[0][0] - sh.centre[0], rz0 = joints[0][2] - sh.centre[2], rl0 = Math.hypot(rx0, rz0) || 1; ch.nrm = [rx0 / rl0, 0, rz0 / rl0]; }
      for (var k = 1; k < joints.length; k++) {
        var nm = 'sx:' + id + ':' + c + ':' + k; A.addBone(nm, prev, new V3(joints[k - 1][0], joints[k - 1][1], joints[k - 1][2])); names.push(nm); prev = nm;
        var d = new V3(joints[k][0] - joints[k - 1][0], joints[k][1] - joints[k - 1][1], joints[k][2] - joints[k - 1][2]), L = d.length(); ch.lens.push(L); ch.dirs.push(d.multiplyScalar(1 / (L || 1)).toArray());
      }
      joints.forEach(function (j) { ch.loc.push(X.local(parent, j)); });
      ch.index = X.info.chains.length; X.info.chains.push(ch); sh.cols.push(ch); sh.row.push(joints[0].slice());
    });
    // lateral coupling: same level of neighbouring columns keeps its bind distance
    var n = sh.cols.length, pairs = sh.ring ? n : n - 1;
    for (var i = 0; i < pairs && n > 1; i++) {
      var a = sh.cols[i], b = sh.cols[(i + 1) % n], rest = [];
      for (var k2 = 1; k2 <= sh.N; k2++) rest.push(Math.hypot(a.joints[k2][0] - b.joints[k2][0], a.joints[k2][1] - b.joints[k2][1], a.joints[k2][2] - b.joints[k2][2]));
      this.info.links.push({ a: a.index, b: b.index, rest: rest, ks: PRESET[sh.preset].lat });
    }
    this.sheets[id] = sh; return sh;
  };
  Builder.prototype.chain = function (id, parent, joints, preset) { return this.sheet(id, { parent: parent, cols: [joints], preset: preset }); };
  Builder.prototype.own = function (id, name) { var sh = this.sheets[id]; if (sh && sh.owners.indexOf(name) < 0) sh.owners.push(name); };
  Builder.prototype.proxy = function (bone, a, b, r) {
    if (this.A.index[bone] === undefined) return;
    this.info.proxies.push({ bone: bone, a: this.local(bone, a), b: this.local(bone, b || a), r: r, r0: r, wa: a, wb: b || a });
  };
  // Shrink every capsule so no cloth joint starts inside it (the rest pose is collision-free by construction).
  Builder.prototype.finalize = function () {
    var info = this.info, tp = { t: 0 };
    info.proxies.forEach(function (p) {
      var best = 1e9; info.chains.forEach(function (ch) { for (var k = 1; k < ch.joints.length; k++) { var j = ch.joints[k]; sV.set(j[0], j[1], j[2]); var d2 = segParam(sV, p.wa, p.wb, tp); if (d2 < best) best = d2; } });
      p.r = clamp(Math.min(p.r0, Math.sqrt(best) - .036), .03, p.r0);
    });
  };
  // Capsule along a bone toward its child; radius from the body's own skin vertices.
  Builder.prototype.autoProxy = function (bone, tail, k, from, to, fallbackR) {
    var A = this.A; if (A.index[bone] === undefined) return;
    var a = A.P(bone), b = typeof tail === 'string' ? (A.index[tail] === undefined ? null : A.P(tail)) : tail; if (!b) return; var d = b.clone().sub(a), L = d.length(); if (L < 1e-4) return; d.divideScalar(L);
    var cl = A.cloud([bone], ['skin'], .5), rs = [];
    cl.forEach(function (p) { var q = p.clone().sub(a), t = q.dot(d); if (t < -.02 || t > L + .02) return; rs.push(q.addScaledVector(d, -t).length()); });
    rs.sort(function (x, y) { return x - y; }); var r = (rs.length ? rs[Math.floor(rs.length * .5)] : (fallbackR || .07)) * (k || .9);
    var a2 = a.clone().lerp(b, from || 0), b2 = a.clone().lerp(b, to === undefined ? 1 : to);
    this.proxy(bone, a2.toArray(), b2.toArray(), Math.max(.035, r));
  };
  // ---- skinning weights
  function segParam(v, p0, p1, out) {   // closest param on segment, returns distance squared
    var ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], l2 = ax * ax + ay * ay + az * az || 1e-9;
    var t = clamp(((v.x - p0[0]) * ax + (v.y - p0[1]) * ay + (v.z - p0[2]) * az) / l2, 0, 1);
    var dx = v.x - (p0[0] + ax * t), dy = v.y - (p0[1] + ay * t), dz = v.z - (p0[2] + az * t); out.t = t; return dx * dx + dy * dy + dz * dz;
  }
  var tmpT = { t: 0 };
  function depthOf(ch, v) {   // continuous link coordinate of a point along the column (0 = anchor)
    var best = 1e9, s = 0;
    for (var k = 0; k < ch.joints.length - 1; k++) { var d2 = segParam(v, ch.joints[k], ch.joints[k + 1], tmpT); if (d2 < best) { best = d2; s = k + tmpT.t; } }
    return s;
  }
  Builder.prototype.skin = function (sh, opts) {
    var A = this.A, parent = A.index[sh.parent], n = sh.cols.length, hinge = opts && opts.hinge, pin = opts && opts.pin, pinned = null, centre = sh.centre;
    var cols = sh.cols.map(function (c) { return c.bones.map(function (nm) { return A.index[nm]; }); });
    function lateral(v) {
      if (n === 1) return [0, 0, 0];
      if (sh.ring) {
        var a = Math.atan2(v.x - centre[0], v.z - centre[2]); if (a < 0) a += Math.PI * 2;
        var f = a / (Math.PI * 2) * n, i0 = Math.floor(f) % n; return [i0, (i0 + 1) % n, f - Math.floor(f)];
      }
      var best = 1e9, bi = 0, bt = 0;
      for (var i = 0; i < n - 1; i++) { var d2 = segParam(v, sh.row[i], sh.row[i + 1], tmpT); if (d2 < best) { best = d2; bi = i; bt = tmpT.t; } }
      return [bi, bi + 1, bt];
    }
    function colW(ci, s, out, mul) {   // add this column's bone weights at link coordinate s
      var N = cols[ci].length;
      if (hinge) { var w1 = sstep(0, .55, s); out.push([parent, (1 - w1) * mul], [cols[ci][0], w1 * mul]); return; }
      if (s <= 0) { out.push([parent, mul]); return; }
      if (s >= N) { out.push([cols[ci][N - 1], mul]); return; }
      var i = Math.floor(s), f = s - i;
      if (i === 0) out.push([parent, (1 - f) * mul], [cols[ci][0], f * mul]); else out.push([cols[ci][i - 1], (1 - f) * mul], [cols[ci][i], f * mul]);
    }
    return function (v) {
      var lat = pin && pinned ? pinned : lateral(v); if (pin && !pinned) pinned = lat;
      var out = [], c0 = lat[0], c1 = lat[1], t = lat[2];
      colW(c0, depthOf(sh.cols[c0], v), out, 1 - t); if (n > 1 && t > 1e-4) colW(c1, depthOf(sh.cols[c1], v), out, t);
      var m = {}, list = [];
      out.forEach(function (e) { if (e[1] <= 1e-5) return; if (m[e[0]] === undefined) { m[e[0]] = list.length; list.push([e[0], 0]); } list[m[e[0]]][1] += e[1]; });
      list.sort(function (a, b) { return b[1] - a[1]; }); return list.slice(0, 4);
    };
  };
  // pinned weights: one lateral choice (taken at `centre`) for a whole rigid plate
  Builder.prototype.skinAt = function (sh, centre, opts) { var f = this.skin(sh, Object.assign({}, opts, { pin: true })); f(new V3(centre[0], centre[1], centre[2])); return f; };
  // Blend an existing body part (e.g. the loincloth) toward a sheet below a height: h(v) 0..1.
  Builder.prototype.blend = function (part, sh, h) {
    var g = part.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, f = this.skin(sh), v = new V3(), changed = 0;
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); var k = h(v); if (k <= .003) continue;
      var cur = []; for (var j = 0; j < 4; j++) if (sw.getComponent(i, j) > 0) cur.push([si.getComponent(i, j), sw.getComponent(i, j)]);
      cur.sort(function (a, b) { return b[1] - a[1]; }); cur = cur.slice(0, 2); var cs = 0; cur.forEach(function (e) { cs += e[1]; });
      var add = f(v).slice(0, 2), as = 0; add.forEach(function (e) { as += e[1]; });
      var res = []; cur.forEach(function (e) { res.push([e[0], e[1] / cs * (1 - k)]); }); add.forEach(function (e) { res.push([e[0], e[1] / as * k]); });
      var m = {}, list = []; res.forEach(function (e) { if (m[e[0]] === undefined) { m[e[0]] = list.length; list.push([e[0], 0]); } list[m[e[0]]][1] += e[1]; });
      list.sort(function (a, b) { return b[1] - a[1]; });
      for (j = 0; j < 4; j++) { var e = list[j]; si.setComponent(i, j, e ? e[0] : 0); sw.setComponent(i, j, e ? e[1] : 0); }
      changed++;
    }
    si.needsUpdate = sw.needsUpdate = true; return changed;
  };
  // A loose piece (GEARMETAL / own parts with userData.dyn = { mass, anchor, len }): one small column per anchor cell, shared.
  Builder.prototype.dyn = function (geometry, dyn) {
    var A = this.A, anchor = dyn.anchor || 'spine02'; if (A.index[anchor] === undefined) return null;
    geometry.computeBoundingBox(); var bb = geometry.boundingBox, len = Math.max(.05, dyn.len || (bb.max.y - bb.min.y)), N = clamp(Math.ceil(len / .075), 1, 3);
    var cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, top = bb.max.y, cell = .05;
    var id = 'dyn:' + anchor + ':' + Math.round(cx / cell) + ':' + Math.round(top / cell) + ':' + Math.round(cz / cell) + ':' + N + ':' + (dyn.mass === 'heavy' ? 'h' : 'l'), sh = this.sheets[id];
    if (!sh) {
      var joints = []; for (var k = 0; k <= N; k++) joints.push([Math.round(cx / cell) * cell, Math.round(top / cell) * cell - len / N * k, Math.round(cz / cell) * cell]);
      sh = this.chain(id, anchor, joints, dyn.mass === 'heavy' ? 'heavy' : 'light');
    }
    return { id: id, skin: this.skin(sh) };
  };
  B.Secondary = { begin: function (A) { return new Builder(A); }, state: S, preset: PRESET, off: OFF };

  // ------------------------------------------------------------------------------------------------ run
  function P0f(ch) { return ch.P.flut || 0; }
  function attach(info, ctx) {
    if (OFF || !info || !info.chains.length) return null;
    var root = ctx.root, scene = ctx.scene, native = ctx.native, hero = !!ctx.hero, chains = [], total = 0, ok = true;
    var owners = {};
    scene.traverse(function (n) { if (!n.isMesh) return; (owners[n.name] = owners[n.name] || []).push(n); if (n.userData && n.userData.equipmentId) (owners[n.userData.equipmentId] = owners[n.userData.equipmentId] || []).push(n); });
    info.chains.forEach(function (d) {
      var par = native[d.parent], bs = d.bones.map(function (nm) { return native[nm]; });
      if (!par || bs.some(function (b) { return !b; })) { ok = false; return; }
      var meshes = []; d.owners.forEach(function (nm) { (owners[nm] || []).forEach(function (m) { if (meshes.indexOf(m) < 0) meshes.push(m); }); });
      var P = PRESET[d.preset] || PRESET.cloth;
      chains.push({ d: d, par: par, bones: bs, n: bs.length, base: total, meshes: meshes, always: !d.owners.length, live: false, lx: 0, ly: 0, lz: 0, air: 0, P: P, restQ: bs.map(function (b) { return b.quaternion.clone(); }), a0x: 0, a0y: 0, a0z: 0 });
      total += bs.length + 1;
    });
    if (!ok || chains.length !== info.chains.length) return null;
    var pos = new Float64Array(total * 3), prev = new Float64Array(total * 3), rest = new Float64Array(total * 3);
    var prox = info.proxies.map(function (p) { return { bone: native[p.bone], a: new V3().fromArray(p.a), b: new V3().fromArray(p.b), r: p.r }; }).filter(function (p) { return p.bone; });
    var pw = new Float64Array(prox.length * 6), pr = new Float64Array(prox.length);
    var links = info.links, dtPrev = 1 / 60, acc = 0, revision = -1, wasOff = false, sleepFar = 0, simTime = Math.random() * 20, order = 0;
    var cam = null;
    function reduceNow() { return reduced.matches || (B.app && B.app.settings && B.app.settings.quality === 'low' && !hero); }
    function resetRest() { for (var c = 0; c < chains.length; c++) { var ch = chains[c]; for (var i = 0; i < ch.n; i++) { ch.bones[i].quaternion.copy(ch.restQ[i]); ch.bones[i].updateMatrixWorld(false); } ch.live = false; } }
    function step(dt, state) {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 1 / 20);
      if (reduceNow()) { if (!wasOff) { resetRest(); wasOff = true; } return; }
      if (wasOff) { wasOff = false; }
      if (!root.visible) { for (var q = 0; q < chains.length; q++) chains[q].live = false; return; }
      // far / crowded foes: nearest few only, 30 Hz beyond ~12 m
      var ultra = !!(B.app && B.app.settings && B.app.settings.quality === 'ultra');   // Azami: every active foe, out to 40 m, never below the display rate
      if (!hero) {
        if (!cam && B.app) cam = B.app.camera; if (!cam) return;
        var e = root.matrixWorld.elements, dx = e[12] - cam.position.x, dz = e[14] - cam.position.z, dd = Math.sqrt(dx * dx + dz * dz);
        if (dd > (ultra ? 40 : 26)) { for (q = 0; q < chains.length; q++) chains[q].live = false; return; }
        if (S.usedFrame !== S.frame) { S.usedFrame = S.frame; S.used = 0; }
        if (S.used >= (ultra ? 24 : B.app && B.app.settings && B.app.settings.quality === 'medium' ? 4 : 8)) return; S.used++;
        acc += dt; if (dd > 12 && acc < 1 / 30 && !ultra) return; dt = Math.min(acc, 1 / 20); acc = 0;
      }
      var rev = root.userData.equipmentRevision || 0; var resetAll = !!(state && state.reset) || rev !== revision; revision = rev;
      scene.matrixWorld.decompose(sP, sQs, sS); var sc = sS.x; sQsi.copy(sQs).invert();
      var groundY = ctx.ground ? ctx.ground() : root.matrixWorld.elements[13] - (root.position.y || 0);
      // collision capsules in world space
      for (var i = 0; i < prox.length; i++) {
        var p = prox[i], m = p.bone.matrixWorld; sV.copy(p.a).applyMatrix4(m); pw[i * 6] = sV.x; pw[i * 6 + 1] = sV.y; pw[i * 6 + 2] = sV.z;
        sV.copy(p.b).applyMatrix4(m); pw[i * 6 + 3] = sV.x; pw[i * 6 + 4] = sV.y; pw[i * 6 + 5] = sV.z; pr[i] = p.r * sc;
      }
      simTime += dt; var windX = S.wx, windZ = S.wz + Math.sin(simTime * 2.9 + order) * .15;
      var dt2 = dt * dt, tRatio = dt / dtPrev; if (tRatio > 3) tRatio = 3; if (tRatio < .3) tRatio = .3;
      var any = false;
      for (var c = 0; c < chains.length; c++) {
        var ch = chains[c], live = ch.always, ms = ch.meshes;
        if (!live) for (var k = 0; k < ms.length; k++) if (ms[k].visible) { live = true; break; }
        if (!live) { ch.live = false; continue; }
        var base = ch.base, n = ch.n, loc = ch.d.loc, M = ch.par.matrixWorld;
        // rigid pose of every joint (where it would hang if the cloth were part of the body)
        for (k = 0; k <= n; k++) { sV.fromArray(loc[k]).applyMatrix4(M); var o = (base + k) * 3; rest[o] = sV.x; rest[o + 1] = sV.y; rest[o + 2] = sV.z; }
        var o0 = base * 3, jump = Math.abs(rest[o0] - pos[o0]) + Math.abs(rest[o0 + 1] - pos[o0 + 1]) + Math.abs(rest[o0 + 2] - pos[o0 + 2]);
        if (!ch.live || resetAll || jump > 2.2) { for (k = 0; k <= n; k++) { o = (base + k) * 3; pos[o] = prev[o] = rest[o]; pos[o + 1] = prev[o + 1] = rest[o + 1]; pos[o + 2] = prev[o + 2] = rest[o + 2]; } ch.live = true; }
        any = true;
        var spx = (rest[o0] - ch.lx), spy = (rest[o0 + 1] - ch.ly), spz = (rest[o0 + 2] - ch.lz); ch.lx = rest[o0]; ch.ly = rest[o0 + 1]; ch.lz = rest[o0 + 2];
        var air = clamp(Math.sqrt(spx * spx + spy * spy + spz * spz) / dt / 4.5, 0, 1.4); ch.air += (air - ch.air) * Math.min(1, dt * 8);
        sV.set(ch.d.nrm[0], ch.d.nrm[1], ch.d.nrm[2]).applyQuaternion(sQs); var nx = sV.x, ny = sV.y, nz = sV.z, fl = P0f(ch) * (.12 + .88 * ch.air), fph = simTime * 4.3 + ch.d.col * 1.7;
        pos[o0] = rest[o0]; pos[o0 + 1] = rest[o0 + 1]; pos[o0 + 2] = rest[o0 + 2]; prev[o0] = pos[o0] - (rest[o0] - prev[o0]) * 0 ; prev[o0] = pos[o0]; prev[o0 + 1] = pos[o0 + 1]; prev[o0 + 2] = pos[o0 + 2];
        var P = ch.P, decay = Math.exp(-P.damp * dt) * tRatio, gy = -9.8 * P.g * dt2, wx = windX * P.wind * dt2, wz = windZ * P.wind * dt2, ks = P.ks * dt2, maxStep = .35 * sc + 2 * ch.d.lens[0] * sc;
        for (k = 1; k <= n; k++) {
          o = (base + k) * 3; var x = pos[o], y = pos[o + 1], z = pos[o + 2];
          var vx = (x - prev[o]) * decay, vy = (y - prev[o + 1]) * decay, vz = (z - prev[o + 2]) * decay, vl = vx * vx + vy * vy + vz * vz;
          if (vl > maxStep * maxStep) { var sk = maxStep / Math.sqrt(vl); vx *= sk; vy *= sk; vz *= sk; }
          prev[o] = x; prev[o + 1] = y; prev[o + 2] = z;
          var fk = Math.sin(fph + k * 1.1) * fl * dt2;
          pos[o] = x + vx + wx + (rest[o] - x) * ks + nx * fk; pos[o + 1] = y + vy + gy + (rest[o + 1] - y) * ks + ny * fk; pos[o + 2] = z + vz + wz + (rest[o + 2] - z) * ks + nz * fk;
        }
      }
      if (!any) { dtPrev = dt; return; }
      var iters = B.app && B.app.settings && B.app.settings.quality === 'low' ? 2 : ultra ? 4 : 3;
      for (var it = 0; it < iters; it++) {
        for (c = 0; c < chains.length; c++) {
          ch = chains[c]; if (!ch.live) continue; base = ch.base; n = ch.n; var lens = ch.d.lens, bend = ch.P.bend;
          for (k = 1; k <= n; k++) {   // length
            var ia = (base + k - 1) * 3, ib = ia + 3, ex = pos[ib] - pos[ia], ey = pos[ib + 1] - pos[ia + 1], ez = pos[ib + 2] - pos[ia + 2], el = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6, L = lens[k - 1] * sc, f = (el - L) / el;
            if (k === 1) { pos[ib] -= ex * f; pos[ib + 1] -= ey * f; pos[ib + 2] -= ez * f; }
            else { f *= .5; pos[ia] += ex * f; pos[ia + 1] += ey * f; pos[ia + 2] += ez * f; pos[ib] -= ex * f; pos[ib + 1] -= ey * f; pos[ib + 2] -= ez * f; }
          }
          for (k = 2; k <= n; k++) {   // bend limit: a link may not fold back on the one above
            var i0 = (base + k - 2) * 3, i2 = (base + k) * 3, fx = pos[i2] - pos[i0], fy = pos[i2 + 1] - pos[i0 + 1], fz = pos[i2 + 2] - pos[i0 + 2], fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1e-6, minD = (lens[k - 2] + lens[k - 1]) * sc * bend;
            if (fl < minD) { var push = (minD - fl) / fl * .5; if (k - 2 === 0) push *= 2; else { pos[i0] -= fx * push; pos[i0 + 1] -= fy * push; pos[i0 + 2] -= fz * push; } pos[i2] += fx * push; pos[i2 + 1] += fy * push; pos[i2 + 2] += fz * push; }
          }
        }
        for (var l = 0; l < links.length; l++) {   // sheet: neighbouring columns keep their distance
          var lk = links[l], ca = chains[lk.a], cb = chains[lk.b]; if (!ca.live || !cb.live) continue;
          for (k = 1; k <= ca.n; k++) {
            var ja = (ca.base + k) * 3, jb = (cb.base + k) * 3, gx = pos[jb] - pos[ja], gy2 = pos[jb + 1] - pos[ja + 1], gz = pos[jb + 2] - pos[ja + 2], gl = Math.sqrt(gx * gx + gy2 * gy2 + gz * gz) || 1e-6, ff = (gl - lk.rest[k - 1] * sc) / gl * .5 * lk.ks;
            pos[ja] += gx * ff; pos[ja + 1] += gy2 * ff; pos[ja + 2] += gz * ff; pos[jb] -= gx * ff; pos[jb + 1] -= gy2 * ff; pos[jb + 2] -= gz * ff;
          }
        }
        for (c = 0; c < chains.length; c++) {   // collision: body capsules and the floor
          ch = chains[c]; if (!ch.live) continue; var mg = ch.P.margin, fy0 = groundY + .025;
          for (k = 1; k <= ch.n; k++) {
            o = (ch.base + k) * 3; var qx = pos[o], qy = pos[o + 1], qz = pos[o + 2];
            for (i = 0; i < prox.length; i++) {
              var w = i * 6, abx = pw[w + 3] - pw[w], aby = pw[w + 4] - pw[w + 1], abz = pw[w + 5] - pw[w + 2], ab2 = abx * abx + aby * aby + abz * abz || 1e-9;
              var tt = clamp(((qx - pw[w]) * abx + (qy - pw[w + 1]) * aby + (qz - pw[w + 2]) * abz) / ab2, 0, 1), cx = pw[w] + abx * tt, cy = pw[w + 1] + aby * tt, cz = pw[w + 2] + abz * tt;
              var ox = qx - cx, oy = qy - cy, oz = qz - cz, od2 = ox * ox + oy * oy + oz * oz, R = pr[i] + mg;
              if (od2 < R * R) { var od = Math.sqrt(od2); if (od < 1e-5) { ox = 0; oy = 0; oz = -1; od = 1; } var sc2 = R / od; qx = cx + ox * sc2; qy = cy + oy * sc2; qz = cz + oz * sc2; }
            }
            if (qy < fy0) { qy = fy0; prev[o] = prev[o] + (qx - prev[o]) * .25; prev[o + 2] = prev[o + 2] + (qz - prev[o + 2]) * .25; }
            pos[o] = qx; pos[o + 1] = qy; pos[o + 2] = qz;
          }
        }
      }
      // write the chain back as bone rotations (scene space; position of every bone follows from the rigid link offsets)
      for (c = 0; c < chains.length; c++) {
        ch = chains[c]; if (!ch.live) continue; base = ch.base;
        ch.par.matrixWorld.decompose(sV, sQp, sD); sW.copy(sQsi).multiply(sQp);   // parent rotation in scene space
        var dirs = ch.d.dirs;
        for (k = 1; k <= ch.n; k++) {
          var ia2 = (base + k - 1) * 3, ib2 = ia2 + 3;
          sR.set(pos[ib2] - pos[ia2], pos[ib2 + 1] - pos[ia2 + 1], pos[ib2 + 2] - pos[ia2 + 2]).applyQuaternion(sQsi).normalize();
          sD.set(dirs[k - 1][0], dirs[k - 1][1], dirs[k - 1][2]);
          sQ2.setFromUnitVectors(sD, sR);                          // rotation from the bind direction (scene space)
          sQ.copy(sW).invert().multiply(sQ2);                      // local to the parent bone
          var bone = ch.bones[k - 1]; bone.quaternion.copy(sQ); bone.updateMatrixWorld(false);
          sW.copy(sQ2);
        }
      }
      dtPrev = dt;
    }
    ctx.extras.push(function (dt, state) { if (S.prof) { var t0 = performance.now(); step(dt, state); S.ms += performance.now() - t0; S.calls++; } else step(dt, state); });
    var inst = { chains: chains, step: step, pos: pos, prev: prev, rest: rest, prox: prox, pw: pw, reset: function () { for (var c = 0; c < chains.length; c++) chains[c].live = false; } };
    root.userData.secondary = inst; return inst;
  }
  B.Secondary.attach = attach;

  // ------------------------------------------------------------------------------------------------ hero rigs
  // Bind-space columns hung from the hero's own armour surface (equipment-art.js chest(u, v, lift): u 0 = front, .5 = back; v 0..1 up the
  // torso). Built once per blueprint, before the first gear piece; every gear family then skins its flexible parts onto them.
  B.Secondary.heroRigs = function (A, c) {
    if (OFF) return null;
    var X = A.secondary || new Builder(A); if (X.heroDone) return X; X.heroDone = true;
    var chest = c.chest, hc = c.hc, ry = c.ry, TAU = Math.PI * 2, i, k, cols;
    // body collision capsules (bind space)
    [['pelvis', [0, .98, -.03], [0, 1.12, -.05], .17], ['spine01', [0, 1.1, -.1], [0, 1.25, -.115], .155], ['spine02', [0, 1.25, -.117], [0, 1.4, -.148], .165], ['spine03', [0, 1.4, -.148], [0, 1.52, -.12], .15],
      ['neck', [0, 1.5, -.1], [0, 1.62, -.04], .095], ['shoulderL', [.09, 1.55, -.05], [.27, 1.45, -.1], .09], ['shoulderR', [-.09, 1.55, -.05], [-.27, 1.45, -.1], .09]].forEach(function (p) { X.proxy(p[0], p[1], p[2], p[3]); });
    [1, -1].forEach(function (s) {
      var n = s > 0 ? 'L' : 'R';
      X.proxy('thigh' + n, [s * .128, .93, -.005], [s * .165, .55, .02], .125); X.proxy('shin' + n, [s * .165, .524, .02], [s * .182, .12, -.009], .085);
      X.proxy('upper_arm' + n, [s * .268, 1.426, -.097], [s * .327, 1.203, -.123], .072); X.proxy('forearm' + n, [s * .327, 1.203, -.123], [s * .396, .976, -.034], .06);
    });
    // back cape: 5 columns x 4 links across the shoulder blades
    var us = [.35, .425, .5, .575, .65]; cols = us.map(function (u) { var J = []; for (k = 0; k <= 4; k++) { var v = k / 4, p = chest(u, .97, .05), fl = 1 + v * .28; J.push([p[0] * fl, p[1] - v * .52, p[2] - .03 * v - .05 * v * v]); } return J; });
    X.sheet('cape', { parent: 'spine03', cols: cols, preset: 'cloth' });
    // front tabard / loin flap: 3 columns x 4 links from the chest down to the knees
    var top = chest(0, .62, .058), xs = [-.065, 0, .065]; cols = xs.map(function (x) { var J = []; for (k = 0; k <= 4; k++) { var v = k / 4; J.push([x * (1 + v * .2), top[1] + (.62 - top[1]) * v, top[2] + .01 + .015 * v]); } return J; });
    X.sheet('tab', { parent: 'spine02', cols: cols, preset: 'skirt' });
    // waist rings: soft hem (sash tails, loincloth) and a heavy one (hanging plates, chain fringe)
    var cz = (chest(0, .5, 0)[2] + chest(.5, .5, 0)[2]) / 2;
    function ring(id, links, drop, preset, parent) {
      var cs = []; for (i = 0; i < 8; i++) { var p = chest(i / 8, .07, .056), ox = p[0], oz = p[2] - cz, ol = Math.hypot(ox, oz) || 1, J = []; for (k = 0; k <= links; k++) J.push([p[0] + ox / ol * .018 * k, p[1] - drop * k, p[2] + oz / ol * .018 * k]); cs.push(J); }
      return X.sheet(id, { parent: parent || 'pelvis', cols: cs, ring: true, centre: [0, 0, cz], preset: preset });
    }
    ring('hip', 3, .13, 'skirt'); ring('plate', 2, .1, 'heavy');
    // neck mantle: ragged strips round the collar
    cols = []; for (i = 0; i < 8; i++) { var a = i / 8 * TAU, J = []; for (k = 0; k <= 2; k++) { var r = .2 + .03 * k; J.push([hc.x + Math.sin(a) * r, hc.y - ry * .56 - .1 - .13 * k, hc.z + Math.cos(a) * r * .8]); } cols.push(J); }
    X.sheet('mant', { parent: 'spine03', cols: cols, ring: true, centre: [hc.x, 0, hc.z], preset: 'rag' });
    // the old loincloth and war sash follow the waist rings below the belt
    A.parts.forEach(function (pt) {
      if (pt.key === 'base-skirt') { X.own('hip', 'base-skirt'); X.blend(pt, X.sheets.hip, function (v) { return sstep(1.02, .9, v.y) * (Math.abs(v.x) < .3 ? 1 : 0); }); }
      if (pt.key === 'tabard') { X.own('hip', 'tabard'); X.blend(pt, X.sheets.hip, function (v) { return sstep(1.04, .86, v.y); }); }
      // cloth hems of the armour cores / named chests (the old rigid "barrel" round the hips) hang on the same ring below the belt
      if (/^equipment:chest:(variant@[a-z0-9-]+|torn-chest|coast-chest|brigandine-chest|sailcoat-chest):(cloth|rag|strap|leather)$/.test(pt.key) && !/^equipment:chest:variant@.*:(leather)$/.test(pt.key) || /^equipment:chest:variant@[a-z0-9-]+:leather$/.test(pt.key)) {
        var n = X.blend(pt, X.sheets.hip, function (v) { return v.y > .985 || Math.abs(v.x) > .5 ? 0 : sstep(.975, .8, v.y); }); if (n) X.own('hip', pt.key);
      }
    });
    return X;
  };
})();
