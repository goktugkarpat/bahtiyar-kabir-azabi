/* KABİR AZABI — III / IV environment kit.
   Static scenery is BAKED per room and material into a few merged meshes (vertex colour = tint + contact darkening + stone variation),
   floor decals come from one painted atlas, and every living effect (flames, embers, steam, dust motes, light shafts, light pools)
   is a shader-animated sprite in ONE mesh per room (premultiplied blend: additive for light, normal for smoke).
   No lights, no per-frame allocation, nothing is created after build(); the warm-up already draws every room. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, PI = Math.PI;
  var SPR = { glow: 0, flame: 1, smoke: 2, ember: 3, mote: 4, beam: 5, pool: 6 };

  function create(env) {
    var forge = env.forge, root = env.root, materials = env.materials, textures = env.textures, groups = env.groups, shapes = env.shapes,
      clock = env.clock, solid = env.solid, sources = env.sources, flames = env.flames, geometries = env.geometries;
    var K = { forge: forge, SPR: SPR, solid: solid };
    K.materials = materials; K.shapes = shapes;
    K.addShape = function (name, g) { shapes[name] = g; geometries.push(g); return g; };   // extra baked shapes (forge props), built at setup only
    var seedBase = forge ? 4417 : 7331;
    K.rng = function (id, salt) { var s = (seedBase + id * 7919 + (salt || 0) * 104729) >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
    var cc = new T.Color();
    K.hex = function (h) { cc.setHex(h); return [cc.r, cc.g, cc.b]; };
    function mul(a, b) { return a && b ? [a[0] * b[0], a[1] * b[1], a[2] * b[2]] : a || b; }
    function mulT(a, b) { return a ? [a[0] * b[0], a[1] * b[1], a[2] * b[2]] : b; }

    /* ───────────── baked meshes ───────────── */
    function Grow(Type) { this.a = new Type(8192); this.n = 0; }
    Grow.prototype.room = function (m) { if (this.n + m > this.a.length) { var b = new this.a.constructor(Math.max(this.a.length * 2, this.n + m)); b.set(this.a.subarray(0, this.n)); this.a = b; } };
    Grow.prototype.add3 = function (x, y, z) { this.room(3); var a = this.a, n = this.n; a[n] = x; a[n + 1] = y; a[n + 2] = z; this.n = n + 3; };
    Grow.prototype.add2 = function (x, y) { this.room(2); var a = this.a, n = this.n; a[n] = x; a[n + 1] = y; this.n = n + 2; };
    Grow.prototype.add1 = function (x) { this.room(1); this.a[this.n++] = x; };
    Grow.prototype.done = function () { var o = this.a.slice(0, this.n); this.a = null; return o; };
    var buckets = Object.create(null), mm = new T.Matrix4(), nm = new T.Matrix3(), eo = new T.Object3D();
    function bucket(room, key, cast) {
      var k = room + '|' + key + '|' + (cast ? 1 : 0);
      return buckets[k] || (buckets[k] = { room: room, key: key, cast: cast, pos: new Grow(Float32Array), nor: new Grow(Float32Array), uv: new Grow(Float32Array), col: new Grow(Float32Array), idx: new Grow(Uint32Array), n: 0 });
    }
    function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
    function bake(room, key, geo, m, tint, ao, aoH, cast, kind) {
      var b = bucket(room, key, cast), P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, I = geo.index, e = m.elements;
      nm.getNormalMatrix(m); var n = nm.elements, base = b.n, special = key === 'lava';
      var tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
      // Wear belongs to the real chamfers, not to a new decal or a brighter room.
      // Bake it into the existing colour stream once; the runtime shader and draw list stay identical.
      var cut = (key === 'stone' || key === 'wall' || key === 'floor') && (kind === 'block' || kind === 'tile');
      var turned = (key === 'stone' || key === 'iron') && (kind === 'column' || kind === 'vat');
      for (var v = 0; v < P.count; v++) {
        var x = P.getX(v), y = P.getY(v), z = P.getZ(v);
        var wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        b.pos.add3(wx, wy, wz);
        var nx = N.getX(v), ny = N.getY(v), nz = N.getZ(v), ax = n[0] * nx + n[3] * ny + n[6] * nz, ay = n[1] * nx + n[4] * ny + n[7] * nz, az = n[2] * nx + n[5] * ny + n[8] * nz, l = 1 / (Math.hypot(ax, ay, az) || 1);
        b.nor.add3(ax * l, ay * l, az * l);
        b.uv.add2(U ? U.getX(v) : 0, U ? U.getY(v) : 0);
        if (special) { b.col.add3(tr, tg, tb); continue; }
        var f = (1 - ao * (1 - smooth(0, aoH, wy))) * (.9 + .2 * (.5 + .5 * Math.sin(wx * .71 + Math.sin(wz * .43) * 2.1 + wy * .8)));
        var edge = cut ? Math.min(1, (1 - Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz))) * 4.8) :
          turned ? Math.min(1, Math.abs(ny) * (1 - Math.abs(ny)) * 4) : 0;
        if (edge > 0) {
          var broken = .64 + .36 * Math.sin(wx * 4.1 + wy * 3.7 + wz * 5.3) * Math.sin(wx * 1.9 - wz * 2.7);
          var wear = edge * broken * (key === 'iron' ? .23 : .19);
          // Slightly cooler rubbed metal; mineral edges retain their room's original colour.
          b.col.add3(tr * f * (1 + wear * (key === 'iron' ? .78 : 1)), tg * f * (1 + wear * .97), tb * f * (1 + wear));
        } else b.col.add3(tr * f, tg * f, tb * f);
      }
      if (I) for (var i = 0; i < I.count; i++) b.idx.add1(base + I.getX(i)); else for (var j = 0; j < P.count; j++) b.idx.add1(base + j);
      b.n += P.count;
    }
    var NOCAST = { lamp: 1, lava: 1, floor: 1, earth: 1, hot: 1 };
    K.putM = function (id, kind, key, m, tint, ao, aoH, cast) {
      if (kind === 'box' && ['stone', 'wall'].indexOf(key) >= 0 && m.elements[5] > .2) kind = 'block';
      var g = shapes[kind]; if (!g) throw new Error('ruins-kit: shape ' + kind);
      var top = m.elements[13] + Math.abs(m.elements[5]) * .5;
      bake(id, key, g, m, tint, ao == null ? .5 : ao, aoH || 1.6, cast == null ? (!NOCAST[key] && top > .55) : cast, kind);
    };
    K.put = function (id, kind, key, x, y, z, w, h, d, a, rx, rz, tint, ao, aoH) {
      eo.position.set(x, y, z); eo.rotation.set(rx || 0, a || 0, rz || 0); eo.scale.set(w, h, d); eo.updateMatrix();
      K.putM(id, kind, key, eo.matrix, tint, ao, aoH);
    };
    var up = new T.Vector3(0, 1, 0), qd = new T.Quaternion(), dv = new T.Vector3(), one = new T.Vector3(1, 1, 1), mid = new T.Vector3(), sv = new T.Vector3();
    // a cylinder / box bar between two points
    K.bar = function (id, kind, key, x1, y1, z1, x2, y2, z2, r, tint, ao) {
      dv.set(x2 - x1, y2 - y1, z2 - z1); var len = dv.length(); if (len < 1e-4) return; dv.multiplyScalar(1 / len);
      qd.setFromUnitVectors(up, dv); mid.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); sv.set(r * 2, len, r * 2);
      mm.compose(mid, qd, sv); K.putM(id, kind || 'cyl', key, mm, tint, ao);
    };

    K.finish = function () {
      var meshes = [];
      Object.keys(buckets).forEach(function (k) {
        var b = buckets[k]; if (!b.n) return;
        var g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(b.pos.done(), 3)); g.setAttribute('normal', new T.BufferAttribute(b.nor.done(), 3));
        g.setAttribute('uv', new T.BufferAttribute(b.uv.done(), 2)); g.setAttribute('color', new T.BufferAttribute(b.col.done(), 3));
        var ix = b.idx.done(); g.setIndex(b.n > 65535 ? new T.BufferAttribute(ix, 1) : new T.BufferAttribute(new Uint16Array(ix), 1));
        g.computeBoundingSphere(); geometries.push(g);
        var mesh = new T.Mesh(g, materials[b.key]); mesh.castShadow = b.cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.name = 'ruins-' + k;
        groups[b.room].add(mesh); meshes.push(mesh);
      });
      buckets = null; return meshes;
    };

    /* ───────────── decal atlas (4x4 cells of 256 px) ───────────── */
    var atlas = null;
    function paintAtlas() {
      var cv = document.createElement('canvas'); cv.width = cv.height = 1024; var g = cv.getContext('2d');
      var s = 1337; function r() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }
      function cell(i, fn) { g.save(); g.beginPath(); g.rect((i % 4) * 256, Math.floor(i / 4) * 256, 256, 256); g.clip(); g.translate((i % 4) * 256, Math.floor(i / 4) * 256); fn(); g.restore(); }
      function crack(x, y, a, len, w, d) {
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y); var px = x, py = y, spawn = [];
        for (var k = 0; k < len / 7; k++) { a += (r() - .5) * .9; px += Math.cos(a) * 7; py += Math.sin(a) * 7; g.lineTo(px, py); if (d > 0 && r() < .13) spawn.push([px, py, a + (r() < .5 ? -1 : 1) * (.5 + r() * .6), len * (.3 + r() * .3)]); }
        g.stroke(); spawn.forEach(function (q) { crack(q[0], q[1], q[2], q[3], Math.max(.8, w * .62), d - 1); });
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      cell(0, function () { g.strokeStyle = 'rgba(10,8,7,.6)'; for (var k = 0; k < 3; k++) crack(128 + (r() - .5) * 60, 128 + (r() - .5) * 60, r() * 6.28, 100, 2.2, 2); });
      cell(1, function () {
        var a = r() * 6.28, x = 20, y = 128 + (r() - .5) * 40, pts = [];
        for (var k = 0; k < 22; k++) { a += (r() - .5) * .55; x += 10 + r() * 3; y += Math.sin(a) * 9; pts.push([x, y]); }
        [[18, 'rgba(14,11,9,.16)'], [9, 'rgba(0,0,0,.5)'], [4.5, 'rgba(0,0,0,.95)']]   /* (visual-dark) soot edge, not a pale outline */.forEach(function (p) { g.lineWidth = p[0]; g.strokeStyle = p[1]; g.beginPath(); pts.forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); });
        g.strokeStyle = 'rgba(5,4,3,.9)'; for (var k = 3; k < pts.length - 3; k += 4) crack(pts[k][0], pts[k][1], r() * 6.28, 55, 2, 1);
      });
      cell(2, function () {
        for (var k = 0; k < 16; k++) { var x = 128 + (r() - .5) * 130, y = 128 + (r() - .5) * 130, rr = 8 + r() * 30 * (1 - k / 22), gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(70,6,5,.95)'); gr.addColorStop(.7, 'rgba(48,4,4,.85)'); gr.addColorStop(1, 'rgba(40,3,3,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
        g.strokeStyle = 'rgba(52,5,4,.8)'; for (var k = 0; k < 9; k++) { var a = r() * 6.28, d = 40 + r() * 70; g.lineWidth = 1.5 + r() * 3; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); g.stroke(); g.fillStyle = 'rgba(60,5,4,.9)'; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2 + r() * 3.5, 0, 6.3); g.fill(); }
      });
      cell(3, function () { for (var k = 0; k < 26; k++) { var x = 128 + (r() - .5) * 180, y = 128 + (r() - .5) * 180, rr = 14 + r() * 52, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(8,7,6,.34)'); gr.addColorStop(1, 'rgba(8,7,6,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); } });
      cell(4, function () {
        for (var k = 0; k < 52; k++) {
          var x = 128 + (r() - .5) * 220, y = 128 + (r() - .5) * 220, rr = 3 + r() * 11 * (1 - Math.hypot(x - 128, y - 128) / 190), a = r() * 6.28, sides = 4 + Math.floor(r() * 3);
          [[2, 2, 'rgba(0,0,0,.45)'], [0, 0, 'hsl(' + (28 + r() * 20) + ',' + (6 + r() * 10) + '%,' + (30 + r() * 28) + '%)']].forEach(function (p) { g.fillStyle = p[2]; g.beginPath(); for (var q = 0; q < sides; q++) { var aa = a + q / sides * 6.28, rd = rr * (.65 + r() * .5); g.lineTo(x + p[0] + Math.cos(aa) * rd, y + p[1] + Math.sin(aa) * rd); } g.closePath(); g.fill(); });
        }
      });
      cell(5, function () {
        g.strokeStyle = '#fff'; g.fillStyle = '#fff';
        [[120, 5], [106, 2.5], [74, 3.5], [60, 2]].forEach(function (p) { g.lineWidth = p[1]; g.beginPath(); g.arc(128, 128, p[0], 0, 6.3); g.stroke(); });
        g.lineWidth = 3; for (var k = 0; k < 36; k++) { var a = k / 36 * 6.28, ra = k % 3 ? 108 : 100; g.beginPath(); g.moveTo(128 + Math.cos(a) * ra, 128 + Math.sin(a) * ra); g.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.stroke(); }
        g.lineWidth = 3.5; for (var k = 0; k < 8; k++) { var a = k / 8 * 6.28 + .2; g.save(); g.translate(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90); g.rotate(a + 1.57); g.beginPath(); g.moveTo(-9, 10); g.lineTo(0, -12); g.lineTo(9, 10); g.moveTo(-6, 2); g.lineTo(6, 2); g.moveTo(0, -12); g.lineTo(0, 12); g.stroke(); g.restore(); }
        g.lineWidth = 2.5; for (var k = 0; k < 8; k++) { var a = k / 8 * 6.28 + .39; g.beginPath(); g.moveTo(128 + Math.cos(a) * 24, 128 + Math.sin(a) * 24); g.lineTo(128 + Math.cos(a) * 56, 128 + Math.sin(a) * 56); g.stroke(); } g.beginPath(); g.arc(128, 128, 14, 0, 6.3); g.stroke();
      });
      cell(6, function () {
        g.fillStyle = '#fff'; g.strokeStyle = '#fff';
        g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 118, 0, 6.3); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 98, 0, 6.3); g.stroke(); g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 40, 0, 6.3); g.stroke();
        for (var k = 0; k < 16; k++) { var a = k / 16 * 6.28, a2 = a + .13; g.globalAlpha = k % 2 ? .9 : .5; g.beginPath(); g.moveTo(128 + Math.cos(a) * 46, 128 + Math.sin(a) * 46); g.lineTo(128 + Math.cos(a - .05) * 94, 128 + Math.sin(a - .05) * 94); g.lineTo(128 + Math.cos(a2 + .05) * 94, 128 + Math.sin(a2 + .05) * 94); g.lineTo(128 + Math.cos(a2) * 46, 128 + Math.sin(a2) * 46); g.closePath(); g.fill(); }
        g.globalAlpha = 1;
      });
      cell(7, function () {
        g.fillStyle = 'rgba(0,0,0,.82)'; g.fillRect(8, 8, 240, 240); g.fillStyle = 'rgb(88,84,80)'; g.fillRect(4, 4, 248, 10); g.fillRect(4, 242, 248, 10); g.fillRect(4, 4, 10, 248); g.fillRect(242, 4, 10, 248);
        for (var k = 0; k < 7; k++) { g.fillStyle = 'rgb(76,72,68)'; g.fillRect(14 + k * 33 + 8, 8, 10, 240); g.fillStyle = 'rgb(112,106,100)'; g.fillRect(14 + k * 33 + 8, 8, 3, 240); }
        for (var k = 0; k < 3; k++) { g.fillStyle = 'rgb(70,66,62)'; g.fillRect(8, 56 + k * 66, 240, 8); }
      });
      cell(8, function () {
        g.fillStyle = 'rgb(62,60,58)'; g.fillRect(6, 6, 244, 244); g.strokeStyle = 'rgba(120,114,108,.6)'; g.lineWidth = 2; g.strokeRect(10, 10, 236, 236);
        g.strokeStyle = 'rgba(20,18,16,.8)'; g.lineWidth = 3; for (var k = -8; k < 10; k++) { g.beginPath(); g.moveTo(14 + k * 28, 14); g.lineTo(14 + k * 28 + 230, 244); g.stroke(); }
        for (var q = 0; q < 4; q++) { g.fillStyle = 'rgb(30,28,26)'; g.beginPath(); g.arc(q % 2 ? 232 : 24, q < 2 ? 24 : 232, 8, 0, 6.3); g.fill(); g.fillStyle = 'rgb(130,122,114)'; g.beginPath(); g.arc(q % 2 ? 231 : 23, q < 2 ? 23 : 231, 4.5, 0, 6.3); g.fill(); }
      });
      cell(9, function () {
        g.beginPath(); for (var k = 0; k <= 40; k++) { var a = k / 40 * 6.28, rd = 78 + 22 * Math.sin(a * 3 + 1) + 14 * Math.sin(a * 5 + 2) + r() * 6; g.lineTo(128 + Math.cos(a) * rd * 1.1, 128 + Math.sin(a) * rd * .85); } g.closePath();
        var gr = g.createRadialGradient(128, 128, 20, 128, 128, 112); gr.addColorStop(0, 'rgba(4,6,9,.95)'); gr.addColorStop(.75, 'rgba(6,8,11,.88)'); gr.addColorStop(1, 'rgba(8,10,13,0)'); g.fillStyle = gr; g.fill();
      });
      cell(10, function () { g.save(); g.translate(128, 128); g.scale(1, .3); var gr = g.createRadialGradient(0, 0, 0, 0, 0, 120); gr.addColorStop(0, 'rgba(220,210,190,.55)'); gr.addColorStop(1, 'rgba(220,210,190,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 120, 0, 6.3); g.fill(); g.restore(); });
      cell(11, function () {
        function bone(x, y, a, l, w) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-l / 2 + 2, -w / 2 + 2, l, w); g.fillStyle = 'rgb(200,188,160)'; g.fillRect(-l / 2, -w / 2, l, w); g.beginPath(); g.arc(-l / 2, 0, w * .8, 0, 6.3); g.arc(l / 2, 0, w * .8, 0, 6.3); g.fill(); g.restore(); }
        for (var k = 0; k < 11; k++) bone(40 + r() * 176, 40 + r() * 176, r() * 6.28, 30 + r() * 30, 5 + r() * 3);
        for (var k = 0; k < 2; k++) { var x = 70 + r() * 116, y = 70 + r() * 116; g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x + 3, y + 3, 17, 0, 6.3); g.fill(); g.fillStyle = 'rgb(206,194,168)'; g.beginPath(); g.arc(x, y, 16, 0, 6.3); g.fill(); g.fillStyle = 'rgb(30,24,20)'; g.beginPath(); g.arc(x - 6, y - 2, 4.5, 0, 6.3); g.arc(x + 6, y - 2, 4.5, 0, 6.3); g.fill(); }
        g.strokeStyle = 'rgb(196,184,156)'; g.lineWidth = 4; for (var k = 0; k < 7; k++) { g.beginPath(); g.arc(128 + 8, 190 - k * 9, 26 - k * 2, 3.4, 6.0); g.stroke(); }
      });
      cell(12, function () {
        function root(x, y, a, len, w, d) { g.lineWidth = w; g.beginPath(); g.moveTo(x, y); var px = x, py = y; for (var k = 0; k < len / 6; k++) { a += (r() - .5) * .7; px += Math.cos(a) * 6; py += Math.sin(a) * 6; g.lineTo(px, py); if (d > 0 && r() < .15) root(px, py, a + (r() < .5 ? -.9 : .9), len * .45, w * .6, d - 1); } g.stroke(); }
        g.strokeStyle = 'rgba(34,24,16,.95)'; for (var k = 0; k < 3; k++) root(128 + (r() - .5) * 90, 128 + (r() - .5) * 90, r() * 6.28, 130, 5, 2);
      });
      cell(13, function () { for (var k = 0; k < 46; k++) { var x = 128 + (r() - .5) * 230, y = 128 + (r() - .5) * 230, rr = 3 + r() * 9, a = r() * 6.28; g.fillStyle = 'rgba(' + (6 + r() * 14) + ',' + (5 + r() * 12) + ',' + (5 + r() * 10) + ',.95)'; g.beginPath(); for (var q = 0; q < 5; q++) { var aa = a + q / 5 * 6.28, rd = rr * (.6 + r() * .6); g.lineTo(x + Math.cos(aa) * rd, y + Math.sin(aa) * rd); } g.closePath(); g.fill(); } });
      cell(14, function () { var gr = g.createRadialGradient(128, 128, 0, 128, 128, 126); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(.7, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
      cell(15, function () {
        g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 5;
        for (var k = 0; k < 4; k++) crack(128 + (r() - .5) * 60, 128 + (r() - .5) * 60, r() * 6.28, 130, 2.0, 2);
      });
      var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8; tex.name = 'kara:decal-atlas'; textures.push(tex); return tex;
    }
    atlas = paintAtlas();
    var decalMat = { matte: null, wet: null, glow: null };
    function decalMaterial(kind) {
      var common = { map: atlas, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, m;
      if (kind === 'glow') m = new T.MeshBasicMaterial(Object.assign(common, { blending: T.AdditiveBlending, toneMapped: false, fog: false }));
      else { m = new T.MeshStandardMaterial(Object.assign(common, kind === 'wet' ? { roughness: .16, metalness: 0, envMapIntensity: 1 } : { roughness: .94, metalness: 0 })); m.defines = { KARA_FULLMIST: '' }; }
      m.name = 'ruins-decal-' + kind; return m;
    }
    var decalBuf = {};
    // cell, centre, size, rotation, colour [r,g,b], alpha, mode: 'matte' | 'wet' | 'glow'
    K.dec = function (id, cell, x, z, w, d, rot, col, alpha, mode, y) {
      mode = mode || 'matte'; var k = id + '|' + mode, b = decalBuf[k] || (decalBuf[k] = { room: id, mode: mode, pos: [], uv: [], col: [], idx: [], n: 0, count: 0 });
      var u0 = (cell % 4) * .25, v0 = 1 - (Math.floor(cell / 4) + 1) * .25, c = Math.cos(rot || 0), s = Math.sin(rot || 0), yy = (y == null ? .055 : y) + (b.count++ % 40) * .0004 + (mode === 'glow' ? .008 : 0), base = b.n;
      var cx = [[-1, -1, 0, 1], [1, -1, 1, 1], [1, 1, 1, 0], [-1, 1, 0, 0]];
      cx.forEach(function (q) {
        var lx = q[0] * w / 2, lz = q[1] * d / 2; b.pos.push(x + lx * c + lz * s, yy, z - lx * s + lz * c);
        b.uv.push(u0 + q[2] * .25, v0 + q[3] * .25); b.col.push(col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1, alpha == null ? 1 : alpha);
      });
      b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2); b.n += 4;
    };

    /* ───────────── sprites ───────────── */
    var spr = { pos: [], corner: [], size: [], col: [], kind: [], idx: [], n: {} }, sprRooms = {};
    var CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    // kind: SPR.*; w/h = half size in metres; col [r,g,b] (HDR allowed); ex = rise height / wander radius
    K.spr = function (id, kind, x, y, z, w, h, col, a, phase, speed, ex) {
      // Chapter III: retain the light sources, but keep large atmospheric quads from veiling the floor.
      if (!forge) {
        a = a == null ? 1 : a;
        if (kind === SPR.beam) { w *= .72; a *= .55; }
        else if (kind === SPR.glow && Math.max(w, h) > 2) { w *= .80; h *= .80; a *= .65; }
        else if (kind === SPR.smoke) a *= .65;
      }
      var R = sprRooms[id] || (sprRooms[id] = { pos: [], corner: [], size: [], col: [], kind: [], idx: [], n: 0 }), base = R.n;
      for (var q = 0; q < 4; q++) {
        var c = CORNERS[q]; R.pos.push(x, y, z);
        if (kind === SPR.beam) R.corner.push(c[0], q < 2 ? 0 : 1); else R.corner.push(c[0], c[1]);
        R.size.push(w, h); R.col.push(col[0], col[1], col[2], (a == null ? 1 : a) * (kind === SPR.pool ? .45 : kind === SPR.smoke ? .75 : 1)); R.kind.push(kind, phase == null ? Math.random() : phase, speed == null ? 1 : speed, ex == null ? 1 : ex);
      }
      R.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); R.n += 4;
    };
    var spriteMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, toneMapped: false, fog: false, side: T.DoubleSide,
      blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor,
      uniforms: { uTime: clock },
      vertexShader: [
        'attribute vec2 aCorner; attribute vec2 aSize; attribute vec4 aCol; attribute vec4 aKind; uniform float uTime; varying vec2 vC; varying vec4 vCol; varying vec4 vK;',
        'void main(){ float kind=aKind.x, ph=aKind.y, sp=aKind.z, ex=aKind.w; vec3 c=position; vec2 sz=aSize; float life=1., t=0.;',
        ' if(kind>1.5&&kind<2.5){ t=fract(uTime*sp+ph); c.y+=t*ex; c.x+=sin(ph*47.+t*2.3)*.55*t; c.z+=cos(ph*31.+t*1.9)*.55*t; sz*=' + (forge ? 'vec2(.42+t*.9,.5+t*1.35)' : '(.5+t*1.15)') + '; life=sin(t*3.14159); }',
        ' else if(kind>2.5&&kind<3.5){ t=fract(uTime*sp+ph); c.y+=t*ex; c.x+=sin(uTime*1.3+ph*40.)*.6*t; c.z+=cos(uTime*1.1+ph*29.)*.6*t; life=smoothstep(0.,.08,t)*(1.-t)*(.55+.45*sin(uTime*9.+ph*80.)); }',
        ' else if(kind>3.5&&kind<4.5){ c+=ex*vec3(sin(uTime*sp+ph*40.),sin(uTime*sp*.7+ph*23.)*.45,cos(uTime*sp*.8+ph*31.)); life=.5+.5*sin(uTime*sp*1.7+ph*60.); }',
        ' else if(kind>5.5){ life=1.+.1*sin(uTime*6.7+ph*30.)+.06*sin(uTime*12.3+ph*11.); }',
        ' else if(kind<.5){ life=1.+.07*sin(uTime*5.3+ph*30.); }',
        ' vCol=vec4(aCol.rgb,aCol.a*life); vK=vec4(kind,ph,t,0.);',
        forge ? ' vec2 cr=aCorner*(kind>5.5?.75:(kind>1.5&&kind<2.5)?.88:1.); vC=cr;' : ' vec2 cr=aCorner; vC=cr;',   // forge: pools / smoke quads are trimmed to where they are still visible (less overdraw)
        ' if(kind>5.5){ c+=vec3(cr.x*sz.x,0.,cr.y*sz.y); gl_Position=projectionMatrix*viewMatrix*vec4(c,1.); }',
        ' else if(kind>4.5){ vec3 tc=cameraPosition-c; vec3 rt=normalize(vec3(tc.z,0.,-tc.x)+vec3(1e-4,0.,0.)); c+=rt*cr.x*sz.x+vec3(0.,cr.y*sz.y,0.); gl_Position=projectionMatrix*viewMatrix*vec4(c,1.); }',
        ' else { vec4 mv=viewMatrix*vec4(c,1.); mv.xy+=cr*sz; gl_Position=projectionMatrix*mv; } }'].join('\n'),
      fragmentShader: [
        'precision highp float; uniform float uTime; varying vec2 vC; varying vec4 vCol; varying vec4 vK;',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
        'void main(){ float kind=vK.x, ph=vK.y; vec3 col=vCol.rgb; float a=0., ao=0.; vec2 q=vC; float r2=dot(q,q), rr=sqrt(r2);',
        forge ? ' if(kind>5.5){ a=exp(-r2*6.5)*(1.-smoothstep(.45,.75,rr)); }' : ' if(kind>5.5){ a=exp(-r2*6.5)*(1.-smoothstep(.7,1.,rr)); }',
        ' else if(kind<.5){ a=exp(-r2*3.4)*(1.-smoothstep(.78,1.,rr)); }',
        ' else if(kind<1.5){ vec2 p=vec2(q.x,q.y*.5+.5); float sway=(n(vec2(p.y*2.6-uTime*3.1,ph*9.))-.5)*.7*p.y; float wd=pow(max(1.-p.y,0.),1.15)*.82+.04; float d=abs(p.x-sway)/wd;',
        '  float shape=(1.-smoothstep(.25,1.,d))*(1.-smoothstep(.55,1.,p.y))*smoothstep(0.,.1,p.y); float fl=.65+.7*n(vec2(p.x*3.+ph*7.,p.y*4.-uTime*5.5)); a=shape*fl; col=mix(col,vec3(1.35,1.05,.62),pow(shape,3.)*.85); }',
        forge ? ' else if(kind<2.5){ vec2 p=q+vec2(.10*sin(q.y*3.5+uTime*.37+ph*9.),.06*sin(q.x*3.+uTime*.28+ph*17.)); float v=n(p*3.2+ph*13.+vec2(uTime*.04,uTime*.1))*.53+n(p*7.1+ph*7.+vec2(-uTime*.06,uTime*.08))*.31+n(p*12.4-ph*11.+vec2(uTime*.03,-uTime*.11))*.16; float edge=1.-smoothstep(.24,.92,length(p)+(v-.5)*.15); a=pow(smoothstep(.18,.82,v),1.25)*edge*.82; col*=.65+.45*v; ao=a; }'   // forge: softer, no hard holes
          : ' else if(kind<2.5){ float v=n(q*2.4+ph*13.+vec2(uTime*.05,uTime*.11))*.62+n(q*5.1-ph*7.+vec2(-uTime*.07,uTime*.09))*.38; a=smoothstep(.22,.82,v)*(1.-smoothstep(.45,1.,rr)); ao=a; }',
        ' else if(kind<3.5){ a=exp(-r2*8.)*1.5; }',
        ' else if(kind<4.5){ a=exp(-r2*7.); }',
        ' else { float ac=exp(-q.x*q.x*3.2)*(1.-smoothstep(.72,1.,abs(q.x))); float al=smoothstep(0.,.22,q.y)*(1.-smoothstep(.38,1.,q.y)*.985); float dust=.62+.55*n(vec2(q.x*2.2+ph*6.,q.y*3.2-uTime*.2)); a=ac*al*dust; }',
        ' a*=vCol.a; if(a<.002) discard; gl_FragColor=vec4(col*a, ao*vCol.a); }'].join('\n')
    });
    spriteMat.name = 'ruins-sprites';

    K.finishFx = function () {
      var out = [];
      Object.keys(sprRooms).forEach(function (id) {
        var R = sprRooms[id], g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(R.pos, 3)); g.setAttribute('aCorner', new T.Float32BufferAttribute(R.corner, 2)); g.setAttribute('aSize', new T.Float32BufferAttribute(R.size, 2));
        g.setAttribute('aCol', new T.Float32BufferAttribute(R.col, 4)); g.setAttribute('aKind', new T.Float32BufferAttribute(R.kind, 4)); g.setIndex(new T.Uint32BufferAttribute(R.idx, 1));
        g.boundingSphere = new T.Sphere(new T.Vector3(env.rooms[id].x, 3, env.rooms[id].z), 30); geometries.push(g);
        var m = new T.Mesh(g, spriteMat); m.frustumCulled = true; m.renderOrder = 8; m.matrixAutoUpdate = false; m.name = 'ruins-fx'; groups[+id].add(m); out.push(m);
      });
      Object.keys(decalBuf).forEach(function (k) {
        var b = decalBuf[k], g = new T.BufferGeometry(), nor = new Float32Array(b.n * 3); for (var i = 0; i < b.n; i++) nor[i * 3 + 1] = 1;
        g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(b.col, 4));
        g.setIndex(b.n > 65535 ? new T.Uint32BufferAttribute(b.idx, 1) : new T.Uint16BufferAttribute(b.idx, 1)); g.computeBoundingSphere(); geometries.push(g);
        if (!decalMat[b.mode]) decalMat[b.mode] = decalMaterial(b.mode);
        var m = new T.Mesh(g, decalMat[b.mode]); m.renderOrder = b.mode === 'glow' ? 4 : 2; m.receiveShadow = b.mode !== 'glow'; m.matrixAutoUpdate = false; m.name = 'ruins-decal-' + b.mode; groups[b.room].add(m); out.push(m);
      });
      return out;
    };
    K.fxMaterials = function () { var l = [spriteMat]; ['matte', 'wet', 'glow'].forEach(function (k) { if (decalMat[k]) l.push(decalMat[k]); }); return l; };

    /* ───────────── lights (pooled elsewhere: these only describe them) ───────────── */
    K.light = function (id, x, y, z, color, intensity, distance, o) {
      o = o || {}; var c = new T.Color(color);
      var s = { x: x, y: y, z: z, color: c, intensity: intensity, distance: distance, flicker: o.flicker == null ? .3 : o.flicker, phase: o.phase == null ? id * 1.7 + sources.length * .9 : o.phase, score: 0, kind: 'lantern', scatter: o.scatter == null ? .5 : o.scatter, glowRadius: Math.min(o.glow || 1.0, 1.6) * .7,
        shadowNear: null, group: 'ruins', tintGroup: null, dim: c.clone(), live: 1, liveColor: c.clone(), livePos: { x: x, y: y, z: z }, spotW: 0, room: id, pool: o.pool !== false };
      sources.push(s); return s;
    };
    K.heat = function (x, y, z, w, h, gain) { flames.push({ x: x, y: y, z: z, w: w, h: h, heatGain: gain == null ? 1 : gain, hidden: false }); };

    /* ───────────── composite props (all coordinates are world metres) ───────────── */
    var WARM = [1.6, .72, .26];
    K.brazier = function (id, x, z, o) {
      o = o || {}; var s = o.s || 1, col = o.col || [1.5, .62, .2], ph = o.phase == null ? x * .37 + z * .21 : o.phase;
      if (o.solid !== false && solid) solid(x, z, .8 * s, .8 * s);
      K.put(id, 'column', 'stone', x, .22 * s, z, .9 * s, .44 * s, .9 * s, 0, 0, 0, o.tint);
      K.put(id, 'cyl', 'iron', x, .9 * s, z, .16 * s, 1.0 * s, .16 * s);
      for (var k = 0; k < 3; k++) { var a = k * 2.094 + .5; K.bar(id, 'cyl', 'iron', x, .55 * s, z, x + Math.sin(a) * .5 * s, .05, z + Math.cos(a) * .5 * s, .045 * s); }
      K.put(id, 'vat', 'iron', x, 1.5 * s, z, .95 * s, .5 * s, .95 * s);
      K.put(id, 'rim', 'iron', x, 1.74 * s, z, .98 * s, .98 * s, .98 * s, 0, PI / 2);
      K.put(id, 'disc', 'hot', x, 1.7 * s, z, .8 * s, 1, .8 * s, 0, 0, 0, [1.6, .5, .12], 0);
      if (o.noFire) return;
      var fs=o.fireScale==null?1:o.fireScale,gg=o.glowGain==null?1:o.glowGain;
      K.spr(id, SPR.flame, x, 1.72 * s + .85 * s * fs, z, .52 * s * fs, .85 * s * fs, col, 1, ph, 1, 1); K.spr(id, SPR.flame, x + .05, 1.72 * s + .7 * s * fs, z - .04, .4 * s * fs, .7 * s * fs, col, .9, ph + .31, 1, 1);
      K.spr(id, SPR.glow, x, 2.0 * s, z, 1.5 * s, 1.5 * s, [col[0] * .5, col[1] * .5, col[2] * .5], .8 * gg, ph, 1, 1);
      K.spr(id, SPR.pool, x, .14, z, 4.2 * s, 4.2 * s, [col[0] * .28, col[1] * .28, col[2] * .28], .5 * gg, ph, 1, 1);
      for (var e = 0; e < (o.embers == null ? 4 : o.embers); e++) K.spr(id, SPR.ember, x, 1.8 * s, z, .05, .05, [1.8, .7, .2], 1, (ph * 3 + e * .237) % 1, .45 + e * .06, 2.4);
      if (o.light !== false) K.light(id, x, 2.3 * s, z, o.lightColor || 0xff9a52, o.intensity || 34, 13, { phase: ph });
    };
    K.sconce = function (id, x, y, z, nx, nz, o) {
      o = o || {}; var col = o.col || [1.5, .62, .2], ph = x * .31 + z * .17;
      K.put(id, 'box', 'iron', x - nx * .1, y - .12, z - nz * .1, .22 + Math.abs(nz) * .1, .12, .22 + Math.abs(nx) * .1, Math.atan2(nx, nz));
      K.put(id, 'cyl', 'iron', x + nx * .08, y + .12, z + nz * .08, .1, .5, .1, 0, 0, 0, [.9, .8, .7]);
      K.put(id, 'disc', 'hot', x + nx * .08, y + .36, z + nz * .08, .14, 1, .14, 0, 0, 0, [1.8, .6, .1], 0);
      K.spr(id, SPR.flame, x + nx * .1, y + .4 + .52, z + nz * .1, .26, .52, col, 1, ph, 1, 1); K.spr(id, SPR.glow, x + nx * .2, y + .55, z + nz * .2, .9, .9, [col[0] * .4, col[1] * .4, col[2] * .4], .7, ph, 1, 1);
      if (o.light) K.light(id, x + nx * .6, y + .4, z + nz * .6, o.lightColor || 0xff9650, o.intensity || 22, 11, { phase: ph });
    };
    K.rubble = function (id, x, z, rad, n, hmax, key, tint, rng) {
      for (var k = 0; k < n; k++) {
        var a = rng() * 6.28, d = Math.sqrt(rng()) * rad, s = .25 + rng() * .5, h = hmax * (1 - d / (rad + .01)) * (.4 + rng() * .8) + .08;
        K.put(id, rng() < .15 ? 'crag' : 'rock', key || 'rock', x + Math.cos(a) * d, h * .35, z + Math.sin(a) * d, s * (1 + rng() * .6), h, s * (.8 + rng() * .8), rng() * 6.28, (rng() - .5) * .5, (rng() - .5) * .5, tint, .55);
      }
    };
    K.column = function (id, x, z, h, w, key, o) {
      o = o || {}; var tint = o.tint, topH = o.broken ? h * (.5 + (o.cut || 0)) : h;
      K.put(id, 'box', key, x, .17, z, w * 1.35, .34, w * 1.35, o.rot || 0, 0, 0, tint);
      K.put(id, 'column', key, x, .34 + (topH - .34) / 2, z, w, topH - .34, w, 0, 0, 0, tint, .55, 2.2);
      if (!o.broken) { K.put(id, 'box', key, x, topH + .1, z, w * 1.3, .22, w * 1.3, o.rot || 0, 0, 0, tint, .3); K.put(id, 'box', key, x, topH + .3, z, w * 1.6, .2, w * 1.6, o.rot || 0, 0, 0, tint, .2); }
      else { K.put(id, 'crag', key, x, topH, z, w * 1.05, .3, w * 1.05, 0, 0, 0, tint); }
    };
    K.statue = function (id, x, z, rot, o) {
      o = o || {}; var s = o.s || 1, key = o.key || 'stone', t = o.tint, pose = o.pose || 0, c = Math.cos(rot), sn = Math.sin(rot), kneel = pose === 1;
      function P(kind, lx, y, lz, w, h, d, rx, rz, k2, tt, yaw) { K.put(id, kind, k2 || key, x + (lx * c + lz * sn) * s, y * s, z + (-lx * sn + lz * c) * s, w * s, h * s, d * s, rot + (yaw || 0), rx || 0, rz || 0, tt || t, .5, 2.2); }
      var dy = kneel ? -.62 : 0;
      P('box', 0, .2, 0, 1.5, .4, 1.5); P('box', 0, .56, 0, 1.2, .32, 1.2);
      if (kneel) { P('box', -.22, .98, .2, .3, .26, .75); P('box', .22, .98, .2, .3, .26, .75); P('box', -.22, 1.18, -.1, .32, .5, .34); P('box', .22, 1.18, -.1, .32, .5, .34); }
      else { P('box', -.22, 1.2, 0, .3, .9, .34); P('box', .22, 1.2, 0, .3, .9, .34); P('box', -.22, .8, .12, .32, .12, .5); P('box', .22, .8, .12, .32, .12, .5); }
      P('box', 0, 1.78 + dy, 0, .62, .5, .46, 0, 0, null, mulT(t, [.92, .92, .92]));            // tabard / hips
      P('box', 0, 2.3 + dy, 0, .84, .72, .44);                                                  // chest
      P('urn', 0, 2.38 + dy, .1, .8, .6, .5);                                                   // breastplate
      P('urn', -.5, 2.62 + dy, 0, .36, .3, .36); P('urn', .5, 2.62 + dy, 0, .36, .3, .36);      // pauldrons
      if (pose !== 2) { P('urn', 0, 2.98 + dy, .02, .36, .4, .38); P('cyl', 0, 3.1 + dy, .02, .4, .26, .42); P('box', 0, 2.96 + dy, .2, .1, .3, .06); } else P('crag', 0, 2.78 + dy, 0, .3, .2, .3);   // head, helm, visor slit / broken neck
      if (pose === 0 || pose === 3) { P('box', -.55, 2.2, .12, .2, .8, .24); P('box', .55, 2.2, .12, .2, .8, .24); P('box', 0, 1.4, .46, .1, 2.4, .04); P('box', 0, 2.25, .46, .6, .09, .1); P('box', 0, 2.38, .46, .1, .24, .1); }   // arms on a planted sword
      if (kneel) { P('box', -.26, 2.2 + dy, .3, .22, .5, .26, .5); P('box', .26, 2.2 + dy, .3, .22, .5, .26, -.5); P('box', 0, 2.1 + dy, .45, .3, .22, .2); }
      if (pose === 2) { P('box', -.55, 2.2, .1, .2, .8, .24); P('crag', .62, 2.2, .2, .3, .5, .3); P('crag', .9, .25, .5, .5, .3, .4); }
      if (pose === 3) { P('cyl', .72, 2.0, .3, .86, .09, .86, PI / 2, 0, null, mulT(t, [.85, .85, .85])); P('urn', .72, 2.0, .36, .26, .2, .12); }
      if (o.cloak !== false && !kneel) P('box', 0, 1.8, -.3, .9, 2.0, .12, -.05, 0, null, mulT(t, [.9, .9, .9]));
    };
    K.sarcophagus = function (id, x, z, rot, o) {
      o = o || {}; var t = o.tint, key = o.key || 'stone', c = Math.cos(rot), sn = Math.sin(rot), L = o.len || 3, W = o.wid || 1.35;
      function P(kind, lx, y, lz, w, h, d, a2, k2, tt) { K.put(id, kind, k2 || key, x + lx * c + lz * sn, y, z - lx * sn + lz * c, w, h, d, rot + (a2 || 0), 0, 0, tt || t, .5); }
      P('box', 0, .16, 0, W + .1, .32, L + .1); P('box', 0, .62, 0, W, .62, L);
      if (o.broken) { P('box', .1, 1.05, -.25, W + .05, .28, L * .6, .12); P('crag', -.3, .98, L * .38, .6, .3, .7); P('box', .5, .98, .95, W * .6, .22, 1.0, -.4); }
      else { P('box', 0, 1.02, 0, W + .08, .26, L + .08); P('box', 0, 1.2, -.1, W * .52, .16, L * .72, 0, 'wall'); P('urn', 0, 1.3, -L * .3, .4, .26, .4, 0, key); }
      P('box', W * .46, .08, L * .46, .22, .16, .22); P('box', -W * .46, .08, L * .46, .22, .16, .22); P('box', W * .46, .08, -L * .46, .22, .16, .22); P('box', -W * .46, .08, -L * .46, .22, .16, .22);
    };
    K.crystals = function (id, x, z, n, spread, hmin, hmax, mat, rng, o) {
      o = o || {}; var glowCol = o.glowCol || [.2, 1.1, 1];
      if (o.solid !== false && solid) solid(x, z, spread * 2.1, spread * 2.1);
      K.put(id, 'crag', 'rock', x, .25, z, spread * 1.5, .6, spread * 1.5, rng() * 6, 0, 0, o.rockTint || [.5, .55, .6], .6);
      for (var k = 0; k < n; k++) {
        var a = rng() * 6.28, d = Math.sqrt(rng()) * spread, h = hmin + rng() * (hmax - hmin), w = h * (.13 + rng() * .08), lean = (rng() - .5) * .6;
        K.put(id, 'crystal', mat, x + Math.cos(a) * d, .2 + h * .45, z + Math.sin(a) * d, w, h, w, rng() * 6.28, (rng() - .5) * .7 + Math.sin(a) * lean, Math.cos(a) * lean, null, .1);
      }
      K.spr(id, SPR.pool, x, .14, z, spread * 5.5, spread * 5.5, [glowCol[0] * .3, glowCol[1] * .3, glowCol[2] * .3], .45, rng(), 1, 1);
      K.spr(id, SPR.glow, x, hmax * .5, z, spread * 2.2, spread * 2.2, [glowCol[0] * .2, glowCol[1] * .2, glowCol[2] * .2], .6, rng(), 1, 1);
      if (o.light) K.light(id, x, hmax * .8, z, o.lightColor || 0x58d6e0, o.intensity || 26, 12, { scatter: .5, glow: 1.6, flicker: .08 });
    };
    K.chain = function (id, x, y, z, len, tint) {
      var n = Math.floor(len / .26); for (var k = 0; k < n; k++) K.put(id, 'link', 'iron', x, y - k * .26, z, .34, .34, .34, k % 2 ? PI / 2 : 0, 0, 0, tint || [.8, .74, .7], .2);
    };
    // (ajan:secondary) Hanging banners: a swallow-tailed pennant (one subdivided sheet, own cloned wall material) that sways in the shared clock in the
    // vertex shader: pinned at the rod, free toward the tips, a slow swell plus a small ripple. Nothing runs on the CPU; 1 extra draw per room that has banners.
    function bannerShape() {
      var cols = 4, rows = 10, pos = [], uv = [], nor = [], idx = [];
      for (var j = 0; j <= rows; j++) for (var i = 0; i <= cols; i++) {
        var v = j / rows, fx = i / cols - .5, tail = v > .8 ? (v - .8) / .2 : 0, y = .5 - v - tail * tail * .06 * (1 - Math.abs(fx) * 2);
        pos.push(fx, y - (Math.abs(fx) < .17 ? tail * .09 * 0 : 0), 0); uv.push(i / cols, 1 - v); nor.push(0, 0, 1);
      }
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) { var q = j * (cols + 1) + i; idx.push(q, q + cols + 1, q + 1, q + 1, q + cols + 1, q + cols + 2); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      // swallow tail: the centre of the lowest rows is cut away upward (vertices pulled up)
      var p = g.attributes.position; for (j = rows - 2; j <= rows; j++) { var c = (j - (rows - 3)) / 3; for (i = 1; i < cols; i++) { var k = j * (cols + 1) + i; p.setY(k, p.getY(k) + c * .07 * (1 - Math.abs(i / cols - .5) * 2)); } }
      geometries.push(g); return g;
    }
    function bannerMaterial(src) {
      var m = src.clone(), before = src.onBeforeCompile, ck = src.customProgramCacheKey;
      m.defines = Object.assign({}, src.defines); m.userData = src.userData; m.name = (src.name || 'wall') + '-banner'; m.side = T.DoubleSide;
      var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]nophys(&|$)/.test(location.search);
      m.onBeforeCompile = function (sh, r) {
        if (before) before.call(this, sh, r); sh.uniforms.kBannerT = clock; sh.uniforms.kBannerA = { value: calm ? 0 : 1 };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float kBannerT;uniform float kBannerA;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n{float sw=pow(clamp(1.-uv.y,0.,1.),1.35)*kBannerA,ph=position.x*.55+position.z*.6+position.y*.08;' +
            'float a=sin(kBannerT*1.15+ph)*.55+sin(kBannerT*2.7+ph*2.3+uv.x*3.)*.22+sin(kBannerT*.43+ph*.5)*.35;' +
            'transformed+=normalize(normal)*sw*a*.2;transformed.y+=sw*(abs(a)*-.025);}');
      };
      m.customProgramCacheKey = function () { return (ck ? ck.call(this) : '') + '|banner-1'; };
      return m;
    }
    K.banner = function (id, x, y, z, w, h, rot, tint) {
      K.put(id, 'box', 'iron', x, y + h / 2 + .06, z, w + .24, .1, .1, rot, 0, 0);
      if (!shapes.banner && materials.wall) shapes.banner = bannerShape();
      if (shapes.banner && materials.wall && !/[?&]nophys(&|$)/.test(location.search)) {
        if (!materials.banner) materials.banner = bannerMaterial(materials.wall);
        K.put(id, 'banner', 'banner', x, y, z, w, h, 1, rot, 0, 0, tint || [.5, .12, .1], .3, h); return;
      }
      K.put(id, 'box', 'wall', x, y, z, w, h, .05, rot, .03, 0, tint || [.5, .12, .1], .3, h);
      K.put(id, 'spike', 'wall', x, y - h / 2 - .1, z, w * .5, .5, .05, rot, PI, 0, tint || [.5, .12, .1], .3);
    };
    K.stalactite = function (id, x, y, z, w, h, tint) { K.put(id, 'spike', 'rock', x, y, z, w, h, w, 0, PI, 0, tint, .1); };
    /* ───────────── floors, walls, arches ───────────── */
    // Tiled floor: every slab has its own tint, tilt and level, so no two rooms (and no two slabs) look alike.
    K.floor = function (id, r, o) {
      o = o || {}; var R = K.rng(id, 1), cols = o.cols || Math.round(r.w / 2.4), rows = o.rows || Math.round(r.d / 2.7), cw = r.w / cols, ch = r.d / rows, key = o.key || 'floor', tint = o.tint || [1, 1, 1], vary = o.vary == null ? .14 : o.vary, warm = o.warm == null ? .06 : o.warm;
      for (var gz = 0; gz < rows; gz++) for (var gx = 0; gx < cols; gx++) {
        var px = r.x - r.w / 2 + (gx + .5) * cw + (gz % 2 ? .13 : -.13) * (o.stagger == null ? 1 : o.stagger), pz = r.z - r.d / 2 + (gz + .5) * ch;
        if (o.skip && o.skip(px - r.x, pz - r.z)) { R(); R(); R(); R(); continue; }
        var b = 1 + (R() - .5) * 2 * vary, hs = (R() - .5) * warm, t = [tint[0] * b * (1 + hs), tint[1] * b, tint[2] * b * (1 - hs)], lv = R(), y = lv < .1 ? -.079 : lv > .94 ? -.045 : -.067, a = (R() - .5) * (o.tilt == null ? .03 : o.tilt);
        if (o.zone) { var zm = o.zone(px - r.x, pz - r.z); if (zm) t = [t[0] * zm[0], t[1] * zm[1], t[2] * zm[2]]; }
        var hh = .18; K.put(id, 'tile', key, px, y, pz, cw - .05 - R() * .04, hh, ch - .05 - R() * .04, a, 0, 0, t, 0);
      }
    };
    // Flat natural stone plates, for cave floors.
    K.patches = function (id, r, o) {
      var R = K.rng(id, 2), tint = o.tint ? [o.tint[0] * 1.25, o.tint[1] * 1.25, o.tint[2] * 1.25] : [1.2, 1.2, 1.2];
      for (var k = 0; k < o.n; k++) {
        var x = r.x + (R() - .5) * (r.w - 2), z = r.z + (R() - .5) * (r.d - 2), s = (o.min || 1.4) + R() * (o.max || 3), b = 1 + (R() - .5) * .5;
        if (o.skip && o.skip(x - r.x, z - r.z)) continue;
        K.put(id, 'rock', o.key || 'rock', x, .0 + R() * .02, z, s, .06 + R() * .05, s * (.6 + R() * .6), R() * 6.28, 0, 0, [tint[0] * b, tint[1] * b, tint[2] * b * (1 + (R() - .5) * .1)], 0);
      }
    };
    // A wall run along z (alongX false: fx = which side the room is on) or along x (fz = direction towards the room): plinth, courses, cornice, pilasters, recessed panels.
    K.wall = function (id, cx, cz, len, thick, h, alongX, fx, fz, o) {
      o = o || {}; var key = o.key || 'wall', tint = o.tint || [1, 1, 1], R = K.rng(id, 11 + Math.floor(Math.abs(cx) * 3 + Math.abs(cz) * 7)), seg = o.seg || 2.4, n = Math.max(1, Math.round(len / seg)), sl = len / n, ruin = o.ruin || 0;
      function P(u, y, v, wa, hh, da, k2, tt, ao, rot) {
        var x, z, sx, sz; if (alongX) { x = cx + u; z = cz + v * fz; sx = wa; sz = da; } else { x = cx + v * fx; z = cz + u; sx = da; sz = wa; }
        K.put(id, 'box', k2 || key, x, y, z, sx, hh, sz, rot || 0, 0, 0, tt || tint, ao == null ? .5 : ao, o.aoH || 3);
      }
      P(0, .32, .1, len, .64, thick + .3, o.plinthKey || 'stone', mul(tint, [.95, .95, .95]));
      for (var k = 0; k < n; k++) {
        var u = -len / 2 + (k + .5) * sl, hi = h * (1 - ruin * R() * .55), b = .9 + R() * .2, tt = [tint[0] * b, tint[1] * b, tint[2] * b];
        // neighbouring segments overlap by 2 cm; every other one is a hair deeper / taller so the overlap strip is not coplanar (it z-fought between two tints)
        var od = k % 2 ? .03 : 0;
        P(u, hi / 2 + od / 3, 0, sl + .02, hi + od * 2 / 3, thick + od, key, tt);
        if (hi >= h - .01) P(u, hi + .1 + od / 2, .1, sl + .02, .28 + od, thick + .4 + od, o.plinthKey || 'stone', mul(tt, [1.05, 1.05, 1.05]), .2);
        else K.put(id, 'crag', 'rock', alongX ? cx + u : cx, hi, alongX ? cz : cz + u, sl * .9, .8 + R() * .7, thick * .9, R() * 6, 0, 0, mul(tt, [.9, .9, .9]), .3);
        if (o.niche && k % 2 === 0 && hi >= h - .01) {
          P(u, h * .5, thick / 2 + .03, sl * .62, h * .48, .1, 'wall', [.32, .33, .37], 0);
          P(u, h * .5 + h * .26, thick / 2 + .12, sl * .72, .22, .26, o.plinthKey || 'stone', tt, .1);
          P(u - sl * .34, h * .5, thick / 2 + .1, .2, h * .5, .24, o.plinthKey || 'stone', tt, .1); P(u + sl * .34, h * .5, thick / 2 + .1, .2, h * .5, .24, o.plinthKey || 'stone', tt, .1);
        }
      }
      var ps = o.pil || 4.8, pn = Math.max(0, Math.floor(len / ps)), ph = h * (o.pilH || .96);
      for (var q = 0; q <= pn && ps > 0 && !o.noPil; q++) { var pu = -len / 2 + (q + (pn ? 0 : .5)) * (pn ? len / pn : len); P(pu, ph / 2, thick / 2 + .22, .9, ph, .48, o.plinthKey || 'stone', mul(tint, [1.04, 1.04, 1.04]), .55); P(pu, ph + .12, thick / 2 + .22, 1.15, .24, .7, o.plinthKey || 'stone', tint, .15); }
    };
    // Semicircular arch of cut blocks in the plane z = const (facing +z), springing at `spring`.
    K.arch = function (id, x, z, radius, spring, o) {
      o = o || {}; var R = K.rng(id, 21), n = 13, tint = o.tint || [1, 1, 1], key = o.key || 'stone';
      for (var k = 0; k < n; k++) {
        if (o.gap && k >= o.gap[0] && k <= o.gap[1]) continue;
        var a = (k + .5) * PI / n, b = .88 + R() * .2;
        K.put(id, 'block', key, x + Math.cos(a) * radius, spring + Math.sin(a) * radius, z, .9, .75, o.depth || 1.1, 0, 0, a - PI / 2, [tint[0] * b, tint[1] * b, tint[2] * b], .3);
      }
      if (!o.gap || o.gap[0] > 6 || o.gap[1] < 6) K.put(id, 'block', key, x, spring + radius + .2, z, .95, 1.1, (o.depth || 1.1) + .2, 0, 0, 0, tint, .2);
    };
    // Slowly turning gears (a handful of real meshes per chapter, matrices updated by the world each frame).
    K.spinners = [];
    K.gear = function (id, shape, key, x, y, z, r, depth, orient, rate) {
      var g = shapes[shape]; if (!g.attributes.color) {
        var P = g.attributes.position, n = P.count, c = new Float32Array(n * 3);
        for (var v = 0; v < n; v++) {
          var radius = Math.hypot(P.getX(v), P.getY(v)), rim = smooth(.385, .49, radius), hub = 1 - smooth(.15, .29, radius);
          var worn = .92 + rim * .20 - hub * .17;
          c[v * 3] = worn * (1 - rim * .035); c[v * 3 + 1] = worn; c[v * 3 + 2] = worn * (1 + rim * .025);
        }
        g.setAttribute('color', new T.BufferAttribute(c, 3));
      }
      var holder = new T.Group(); holder.position.set(x, y, z); if (orient) holder.rotation.set(orient[0], orient[1], orient[2]); holder.matrixAutoUpdate = true;
      var m = new T.Mesh(g, materials[key]); m.scale.set(r * 2, r * 2, depth); m.castShadow = true; m.receiveShadow = true; m.userData.rate = rate; m.rotation.z = Math.random() * 6;
      holder.add(m); groups[id].add(holder); K.spinners.push(m); return m;
    };
    K.dispose = function () { spriteMat.dispose(); ['matte', 'wet', 'glow'].forEach(function (k) { if (decalMat[k]) decalMat[k].dispose(); }); };
    return K;
  }
  /* ───────────── moods (fog, ambient, key, grade) ───────────── */
  var COLORS = { fog: 1, mist: 1, sky: 1, ground: 1, key: 1, rim: 1, charRim: 1 }, VECS = { lift: 1, gain: 1, shadowTint: 1, highTint: 1, vigColor: 1, bloomTint: 1 };
  function makeMood(s) {
    var m = {};
    Object.keys(s).forEach(function (k) { var v = s[k]; if (COLORS[k]) m[k] = new T.Color(v); else if (VECS[k]) m[k] = new T.Vector3(v[0], v[1], v[2]); else if (Array.isArray(v)) m[k] = v.slice(); else m[k] = v; });
    m.room = 0; m.keyIntensity = m.keyI; m.rimIntensity = m.rimI; m.saturation = m.sat; return m;
  }
  function makeMoods(base, specs) { return specs.map(function (sp) { return makeMood(Object.assign({}, base, sp)); }); }
  function blendMood(o, a, b, f, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], x = a[k], y = b[k];
      if (typeof x === 'number') o[k] = x + (y - x) * f;
      else if (x && (x.isColor || x.isVector3)) o[k].copy(x).lerp(y, f);
      else if (Array.isArray(x)) for (var j = 0; j < x.length; j++) o[k][j] = x[j] + (y[j] - x[j]) * f;
    }
  }
  B.RuinsKit = { create: create, makeMood: makeMood, makeMoods: makeMoods, blendMood: blendMood };
}());
