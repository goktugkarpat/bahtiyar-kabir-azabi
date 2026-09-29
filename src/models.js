/* KARA GEÇİT — forged gear, armour and prop geometry (original, procedural).
 * Publishes BABA.Gear. authored-models.js turns these pieces into skinned or bone-attached meshes.
 * Every builder returns { parts: { <materialKey>: [BufferGeometry, ...] }, ...anchors } in metres:
 * hand-held items point along +Y with the grip at the origin; worn items use the local frame given by the caller.
 * Material keys: iron, edge, dark, brass, leather, cloth, rope, wood, bone, fur, ember, glow, void, paint. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE;
  var PI = Math.PI, TAU = PI * 2;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // ---------- deterministic noise ----------
  function hash(x, y, z) { var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  function noise(x, y, z) {
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    function h(a, b, c) { return hash(ix + a, iy + b, iz + c); }
    return mix(mix(mix(h(0, 0, 0), h(1, 0, 0), fx), mix(h(0, 1, 0), h(1, 1, 0), fx), fy),
      mix(mix(h(0, 0, 1), h(1, 0, 1), fx), mix(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
  }
  function fbm(x, y, z, oct) { var s = 0, a = .5, f = 1; for (var i = 0; i < (oct || 3); i++) { s += a * noise(x * f, y * f, z * f); f *= 2.03; a *= .5; } return s / (1 - Math.pow(.5, oct || 3)); }

  // ---------- geometry helpers ----------
  function indexed(g) {
    if (g.index) return g;
    var n = g.attributes.position.count, idx = new Uint32Array(n); for (var i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new T.BufferAttribute(idx, 1)); return g;
  }
  // Merge geometries that carry position/normal/uv (uv is synthesised when missing). The per-vertex wear
  // attribute "kwear" (see wear()) is carried when any input has it (zeros elsewhere).
  function merge(list) {
    list = list.filter(Boolean); var total = 0, totalIndex = 0, anyWear = false;
    list.forEach(function (g) { indexed(g); total += g.attributes.position.count; totalIndex += g.index.count; if (g.attributes.kwear) anyWear = true; });
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), kw = anyWear ? new Float32Array(total * 4) : null, index = new Uint32Array(totalIndex), v = 0, k = 0;
    list.forEach(function (g) {
      if (!g.attributes.normal) g.computeVertexNormals();
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, w = g.attributes.kwear, c = p.count;
      for (var i = 0; i < c; i++) {
        pos[(v + i) * 3] = p.getX(i); pos[(v + i) * 3 + 1] = p.getY(i); pos[(v + i) * 3 + 2] = p.getZ(i);
        nor[(v + i) * 3] = n.getX(i); nor[(v + i) * 3 + 1] = n.getY(i); nor[(v + i) * 3 + 2] = n.getZ(i);
        if (u) { uv[(v + i) * 2] = u.getX(i); uv[(v + i) * 2 + 1] = u.getY(i); }
        if (w) for (var q = 0; q < 4; q++) kw[(v + i) * 4 + q] = w.getComponent(i, q);
      }
      for (var j = 0; j < g.index.count; j++) index[k + j] = g.index.getX(j) + v;
      v += c; k += g.index.count; g.dispose();
    });
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (kw) out.setAttribute('kwear', new T.BufferAttribute(kw, 4));
    out.setIndex(new T.BufferAttribute(index, 1)); return out;
  }

  // ---------- per-vertex wear ----------
  // kwear (vec4): x edge wear (hard edges, open borders, tight convex curvature: bare metal, scuffed leather),
  // y cavity / contact occlusion (concave curvature), z blood paint, w gloss (eyes, wet flesh, glass) or, on cloth, tear.
  // Computed once at build time from the geometry itself; the character shader turns it into colour, roughness and holes.
  // o: { edge, border, curv, cavity, paint: number|fn(p)->0..1, gloss: number|fn(p), tear: { amount, width, bottom, base } }
  function wear(g, o) {
    o = o || {}; indexed(g); if (!g.attributes.normal) g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal, count = p.count, ids = new Int32Array(count), keyMap = new Map(), groups = [];
    for (var i = 0; i < count; i++) {
      var key = Math.round(p.getX(i) * 4e3) + ',' + Math.round(p.getY(i) * 4e3) + ',' + Math.round(p.getZ(i) * 4e3), id = keyMap.get(key);
      if (id === undefined) { id = groups.length; keyMap.set(key, id); groups.push([]); } ids[i] = id; groups[id].push(i);
    }
    var G = groups.length, sharp = new Float32Array(G), gn = new Float32Array(G * 3), gp = new Float32Array(G * 3), curv = new Float32Array(G), cc = new Float32Array(G), bound = new Float32Array(G);
    groups.forEach(function (list, id) {
      var mn = 1, sx = 0, sy = 0, sz = 0;
      for (var a = 0; a < list.length; a++) {
        var ia = list[a], ax = n.getX(ia), ay = n.getY(ia), az = n.getZ(ia); sx += ax; sy += ay; sz += az;
        for (var b = a + 1; b < list.length; b++) { var ib = list[b]; mn = Math.min(mn, ax * n.getX(ib) + ay * n.getY(ib) + az * n.getZ(ib)); }
      }
      var l = Math.hypot(sx, sy, sz) || 1; gn[id * 3] = sx / l; gn[id * 3 + 1] = sy / l; gn[id * 3 + 2] = sz / l;
      gp[id * 3] = p.getX(list[0]); gp[id * 3 + 1] = p.getY(list[0]); gp[id * 3 + 2] = p.getZ(list[0]);
      sharp[id] = clamp((1 - mn) * 1.3, 0, 1);
    });
    var idx = g.index.array, edges = new Map();
    for (var t = 0; t < idx.length; t += 3) for (var e = 0; e < 3; e++) {
      var a0 = ids[idx[t + e]], b0 = ids[idx[t + (e + 1) % 3]]; if (a0 === b0) continue;
      var ek = a0 < b0 ? a0 * G + b0 : b0 * G + a0; edges.set(ek, (edges.get(ek) || 0) + 1);
    }
    var list2 = [];
    edges.forEach(function (c, ek) {
      var a = Math.floor(ek / G), b = ek - a * G; list2.push(a, b);
      if (c === 1) { bound[a] = 1; bound[b] = 1; }
      var dx = gp[b * 3] - gp[a * 3], dy = gp[b * 3 + 1] - gp[a * 3 + 1], dz = gp[b * 3 + 2] - gp[a * 3 + 2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < 1e-12) return;
      var k = ((gn[b * 3] - gn[a * 3]) * dx + (gn[b * 3 + 1] - gn[a * 3 + 1]) * dy + (gn[b * 3 + 2] - gn[a * 3 + 2]) * dz) / d2;
      curv[a] += k; curv[b] += k; cc[a]++; cc[b]++;
    });
    var ed = new Float32Array(G), cav = new Float32Array(G), border = o.border === undefined ? .75 : o.border, kc = o.curv === undefined ? .011 : o.curv, kv = o.cavity === undefined ? .012 : o.cavity;
    for (i = 0; i < G; i++) { var cu = curv[i] / Math.max(1, cc[i]); ed[i] = clamp(sharp[i] + bound[i] * border + Math.min(.42, Math.max(0, cu) * kc), 0, 1); cav[i] = clamp(-cu * kv, 0, 1); }
    // one smoothing pass: wear spreads a little around the edge it follows
    var e2 = ed.slice(); for (i = 0; i < list2.length; i += 2) { var A = list2[i], Bq = list2[i + 1]; e2[A] = Math.max(e2[A], ed[Bq] * .45); e2[Bq] = Math.max(e2[Bq], ed[A] * .45); } ed = e2;
    // tear: fades in from the open borders near the bottom of the piece (hems), relaxed along the mesh
    var tear = null;
    if (o.tear) {
      g.computeBoundingBox(); var bb = g.boundingBox, sy2 = Math.max(1e-4, bb.max.y - bb.min.y), T0 = o.tear, width = T0.width || .06, bottom = T0.bottom === undefined ? .35 : T0.bottom;
      tear = new Float32Array(G);
      for (i = 0; i < G; i++) if (bound[i]) tear[i] = (T0.amount || .7) * (1 - smooth((gp[i * 3 + 1] - bb.min.y) / (sy2 * bottom)));
      for (var pass = 0; pass < 24; pass++) {
        var changed = false;
        for (i = 0; i < list2.length; i += 2) {
          var u0 = list2[i], v0 = list2[i + 1], len = Math.hypot(gp[v0 * 3] - gp[u0 * 3], gp[v0 * 3 + 1] - gp[u0 * 3 + 1], gp[v0 * 3 + 2] - gp[u0 * 3 + 2]), dec = len / width * (T0.amount || .7);
          if (tear[u0] - dec > tear[v0] + 1e-4) { tear[v0] = tear[u0] - dec; changed = true; } if (tear[v0] - dec > tear[u0] + 1e-4) { tear[u0] = tear[v0] - dec; changed = true; }
        }
        if (!changed) break;
      }
      for (i = 0; i < G; i++) tear[i] = Math.max(tear[i], T0.base || 0);
    }
    var out = new Float32Array(count * 4), v = new T.Vector3(), edgeK = o.edge === undefined ? 1 : o.edge;
    for (i = 0; i < count; i++) {
      var id2 = ids[i]; v.fromBufferAttribute(p, i);
      out[i * 4] = ed[id2] * edgeK; out[i * 4 + 1] = cav[id2];
      out[i * 4 + 2] = typeof o.paint === 'function' ? o.paint(v) : (o.paint || 0);
      out[i * 4 + 3] = tear ? tear[id2] : typeof o.gloss === 'function' ? o.gloss(v) : (o.gloss || 0);
    }
    g.setAttribute('kwear', new T.BufferAttribute(out, 4)); return g;
  }
  // Constant wear values (x, y, z, w) for a whole geometry.
  function fillWear(g, x, y, z, w) { var c = g.attributes.position.count, a = new Float32Array(c * 4); for (var i = 0; i < c; i++) { a[i * 4] = x || 0; a[i * 4 + 1] = y || 0; a[i * 4 + 2] = z || 0; a[i * 4 + 3] = w || 0; } g.setAttribute('kwear', new T.BufferAttribute(a, 4)); return g; }
  var m4 = new T.Matrix4(), q4 = new T.Quaternion(), e4 = new T.Euler(), v4 = new T.Vector3(), s4 = new T.Vector3();
  // Move a geometry: position [x,y,z], rotation [rx,ry,rz] (XYZ euler), scale number|[sx,sy,sz].
  function put(g, p, r, s) {
    e4.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); q4.setFromEuler(e4);
    if (s === undefined || s === null) s4.set(1, 1, 1); else if (typeof s === 'number') s4.set(s, s, s); else s4.set(s[0], s[1], s[2]);
    m4.compose(v4.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0), q4, s4); g.applyMatrix4(m4); return g;
  }
  // Stretch a unit-height, origin-centred +Y geometry so it runs from a to b.
  function between(g, a, b) {
    var A = a.isVector3 ? a.clone() : new T.Vector3().fromArray(a), Bv = b.isVector3 ? b.clone() : new T.Vector3().fromArray(b), d = Bv.clone().sub(A), len = d.length() || 1e-6;
    g.applyMatrix4(new T.Matrix4().compose(A.clone().add(Bv).multiplyScalar(.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.multiplyScalar(1 / len)), new T.Vector3(1, len, 1)));
    return g;
  }
  // Cone with its base at a and point at b.
  function spike(r, a, b, seg) { return between(new T.ConeGeometry(r, 1, seg || 7), a, b); }
  // Smooth shading across coincident vertices whose normals differ by less than maxAngle (keeps hard edges).
  function smoothNormals(g, maxAngle) {
    g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal, groups = new Map(), cos = Math.cos(maxAngle || .9), a = new T.Vector3(), b = new T.Vector3();
    for (var i = 0; i < p.count; i++) { var k = Math.round(p.getX(i) * 2e3) + ',' + Math.round(p.getY(i) * 2e3) + ',' + Math.round(p.getZ(i) * 2e3); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    var out = new Float32Array(n.count * 3);
    groups.forEach(function (list) { list.forEach(function (i2) { a.fromBufferAttribute(n, i2); var sum = new T.Vector3(); list.forEach(function (j2) { b.fromBufferAttribute(n, j2); if (a.dot(b) >= cos) sum.add(b); }); sum.normalize(); out[i2 * 3] = sum.x; out[i2 * 3 + 1] = sum.y; out[i2 * 3 + 2] = sum.z; }); });
    g.setAttribute('normal', new T.BufferAttribute(out, 3)); return g;
  }
  function uvScale(g, su, sv) { var u = g.attributes.uv; if (!u) return g; for (var i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * su, u.getY(i) * (sv === undefined ? su : sv)); return g; }
  function displace(g, fn) {
    var p = g.attributes.position, n = g.attributes.normal, a = new T.Vector3(), b = new T.Vector3();
    for (var i = 0; i < p.count; i++) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(n, i); var d = fn(a, b, i); if (d) { a.addScaledVector(b, d); p.setXYZ(i, a.x, a.y, a.z); } }
    g.computeVertexNormals(); return g;
  }
  function lathe(profile, segments, phiStart, phiLength) {
    var pts = profile.map(function (p) { return new T.Vector2(Math.max(0, p[0]), p[1]); });
    var g = new T.LatheGeometry(pts, segments || 24, phiStart || 0, phiLength === undefined ? TAU : phiLength); return g;
  }
  function shape(points, holes) {
    var s = new T.Shape(); points.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); });
    (holes || []).forEach(function (h) { var path = new T.Path(); h.forEach(function (p, i) { if (i) path.lineTo(p[0], p[1]); else path.moveTo(p[0], p[1]); }); s.holes.push(path); });
    return s;
  }
  function extrude(points, depth, bevel, holes, curveSegments) {
    var g = new T.ExtrudeGeometry(shape(points, holes), { depth: depth, bevelEnabled: bevel > 0, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 2, curveSegments: curveSegments || 6 });
    g.translate(0, 0, -depth / 2); return g;
  }
  function circle(r, n, cx, cy, start, sweep) { var out = []; n = n || 12; for (var i = 0; i < n; i++) { var a = (start || 0) + (sweep === undefined ? TAU : sweep) * i / (sweep === undefined ? n : n - 1); out.push([(cx || 0) + Math.cos(a) * r, (cy || 0) + Math.sin(a) * r]); } return out; }
  function box(w, h, d, p, r) { return put(new T.BoxGeometry(w, h, d), p, r); }
  function cyl(r0, r1, h, seg, p, rot, open) { return put(new T.CylinderGeometry(r1, r0, h, seg || 12, 1, !!open), p, rot); }
  function sphere(r, p, s, ws, hs) { return put(new T.SphereGeometry(r, ws || 14, hs || 10), p, null, s); }
  // Tapered tube along a Catmull-Rom path. radius: number or function(t 0..1).
  function tube(points, radius, radial, tubular, caps) {
    var curve = new T.CatmullRomCurve3(points.map(function (p) { return p.isVector3 ? p : new T.Vector3().fromArray(p); }), false, 'centripetal');
    tubular = tubular || Math.max(4, points.length * 5); radial = radial || 8;
    var frames = curve.computeFrenetFrames(tubular, false), pos = [], nor = [], uv = [], index = [], P = new T.Vector3(), N = new T.Vector3(), length = curve.getLength();
    for (var i = 0; i <= tubular; i++) {
      var t = i / tubular, r = typeof radius === 'function' ? radius(t) : radius; curve.getPointAt(t, P);
      for (var j = 0; j <= radial; j++) {
        var a = j / radial * TAU, s = Math.sin(a), c = -Math.cos(a);
        N.set(c * frames.normals[i].x + s * frames.binormals[i].x, c * frames.normals[i].y + s * frames.binormals[i].y, c * frames.normals[i].z + s * frames.binormals[i].z).normalize();
        pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z); nor.push(N.x, N.y, N.z); uv.push(j / radial, t * length * 4);
      }
    }
    for (i = 0; i < tubular; i++) for (j = 0; j < radial; j++) { var a0 = i * (radial + 1) + j, b0 = a0 + radial + 1; index.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
    if (caps) [0, tubular].forEach(function (i2) {
      var t2 = i2 / tubular, center = pos.length / 3; curve.getPointAt(t2, P); var tan = curve.getTangentAt(t2).multiplyScalar(i2 ? 1 : -1);
      pos.push(P.x, P.y, P.z); nor.push(tan.x, tan.y, tan.z); uv.push(.5, .5);
      for (var j2 = 0; j2 < radial; j2++) { var ra = i2 * (radial + 1) + j2; if (i2) index.push(center, ra, ra + 1); else index.push(center, ra + 1, ra); }
    });
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(index);
    return g;
  }
  // A ring (torus) oriented around the local Y axis.
  function ring(r, t, p, rot, radial, tubular) { var g = new T.TorusGeometry(r, t, radial || 6, tubular || 20); g.rotateX(PI / 2); return put(g, p, rot); }
  function link(size) { var g = new T.TorusGeometry(.5 * size, .16 * size, 5, 12); g.scale(1, 1.55, 1); return g; }
  // Chain of alternating links along a path (static).
  function chain(points, size, sag) {
    var curve = new T.CatmullRomCurve3(points.map(function (p) { return new T.Vector3().fromArray(p); })), len = curve.getLength(), n = Math.max(2, Math.round(len / (size * 1.25))), out = [];
    for (var i = 0; i < n; i++) {
      var t = (i + .5) / n, P = curve.getPointAt(t), tan = curve.getTangentAt(t), g = link(size);
      var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), tan); q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), i % 2 ? PI / 2 : 0));
      g.applyMatrix4(new T.Matrix4().compose(P, q, new T.Vector3(1, 1, 1))); out.push(g);
    }
    return merge(out);
  }
  function rivets(list, r) { return merge(list.map(function (p) { return sphere(r, p, [1, 1, .55], 8, 6); })); }
  // Clumpy displaced blob (organic lumps, pustules, coals, rocks).
  function blob(r, p, s, rough, seed, ws) {
    var g = new T.SphereGeometry(r, ws || 16, Math.max(6, (ws || 16) * .7 | 0)); if (s) g.scale(s[0], s[1], s[2]);
    displace(g, function (a) { return (fbm(a.x * 9 / r * .12 + (seed || 0), a.y * 9 / r * .12, a.z * 9 / r * .12, 3) - .5) * (rough || .3) * r; });
    return put(g, p);
  }

  // ---------- sculpted details: rivets, straps, buckles, rope, skulls, tufts ----------
  var Y_UP = new T.Vector3(0, 1, 0);
  function vec(a) { return a.isVector3 ? a.clone() : new T.Vector3(a[0], a[1], a[2]); }
  // Place a local +Y-up geometry at p with +Y turned toward dir (optional twist about dir).
  function orient(g, p, dir, twist) {
    var q = new T.Quaternion().setFromUnitVectors(Y_UP, vec(dir).normalize()); if (twist) q.multiply(new T.Quaternion().setFromAxisAngle(Y_UP, twist));
    g.applyMatrix4(new T.Matrix4().compose(vec(p), q, new T.Vector3(1, 1, 1))); return g;
  }
  // Domed rivet head sitting on a surface (p on the surface, n outward).
  function stud(r, p, n, h) { var g = new T.SphereGeometry(r, 8, 4, 0, TAU, 0, PI / 2); g.scale(1, h || .55, 1); return orient(g, p, n); }
  // Pyramid-cut nail head (square, for crude iron work).
  function nail(r, p, n) { var g = new T.ConeGeometry(r * 1.2, r * .9, 4, 1); g.translate(0, r * .45, 0); g.rotateY(PI / 4); return orient(g, p, n); }
  // Flat strap along a path. normals: outward surface normal per point (array) or fn(t, point) -> Vector3.
  // Rounded rectangular section (width across, thick outward); o.studs = spacing of rivets along the strap.
  function band(points, width, thick, normals, o) {
    o = o || {};
    if (o.closed && points.length > 3 && vec(points[0]).distanceTo(vec(points[points.length - 1])) < 1e-6) points = points.slice(0, -1);
    var curve = new T.CatmullRomCurve3(points.map(vec), !!o.closed, 'centripetal'), len = curve.getLength(), segs = o.segments || Math.max(6, Math.ceil(len / .025));
    var b = Math.min(thick * .45, width * .2), prof = [[-width / 2 + b, 0], [width / 2 - b, 0], [width / 2, b], [width / 2, thick - b], [width / 2 - b, thick], [-width / 2 + b, thick], [-width / 2, thick - b], [-width / 2, b]];
    var pos = [], uv = [], idx = [], P = new T.Vector3(), Tn = new T.Vector3(), N = new T.Vector3(), S = new T.Vector3(), ring = prof.length + 1, studsAt = [];
    function nrmAt(t, pt) {
      if (typeof normals === 'function') return normals(t, pt).clone().normalize();
      var f = t * (normals.length - 1), i0 = Math.min(normals.length - 2, Math.floor(f)), a = vec(normals[i0]), c = vec(normals[i0 + 1]); return a.lerp(c, f - i0).normalize();
    }
    for (var i = 0; i <= segs; i++) {
      var t = i / segs; curve.getPointAt(o.closed && i === segs ? 0 : t, P); curve.getTangentAt(o.closed && i === segs ? 0 : t, Tn);
      N.copy(nrmAt(t, P)); S.crossVectors(Tn, N).normalize(); N.crossVectors(S, Tn).normalize();
      for (var k = 0; k < ring; k++) { var pr = prof[k % prof.length]; pos.push(P.x + S.x * pr[0] + N.x * pr[1], P.y + S.y * pr[0] + N.y * pr[1], P.z + S.z * pr[0] + N.z * pr[1]); uv.push(k / prof.length, t * len * 3); }
      if (o.studs && (i % Math.max(1, Math.round(o.studs / (len / segs))) === 0) && i > 0 && i < segs) studsAt.push([P.clone().addScaledVector(N, thick), N.clone()]);
    }
    for (i = 0; i < segs; i++) for (k = 0; k < prof.length; k++) { var a = i * ring + k, c = a + ring; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    if (!o.closed) [0, segs].forEach(function (i2) { var base = pos.length / 3, cx = 0, cy = 0, cz = 0; for (var k2 = 0; k2 < prof.length; k2++) { cx += pos[(i2 * ring + k2) * 3]; cy += pos[(i2 * ring + k2) * 3 + 1]; cz += pos[(i2 * ring + k2) * 3 + 2]; } pos.push(cx / prof.length, cy / prof.length, cz / prof.length); uv.push(.5, .5); for (k2 = 0; k2 < prof.length; k2++) { var r0 = i2 * ring + k2, r1 = i2 * ring + k2 + 1; if (i2) idx.push(base, r0, r1); else idx.push(base, r1, r0); } });
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData.studs = studsAt; g.userData.curve = curve; return g;
  }
  // Rectangular buckle frame with prong, local frame: +Z out of the strap, +Y along it. w across, h along.
  function buckle(w, h, r) {
    r = r || .006; var c = Math.min(w, h) * .22;
    var loop = [[-w / 2 + c, -h / 2, 0], [w / 2 - c, -h / 2, 0], [w / 2, -h / 2 + c, 0], [w / 2, h / 2 - c, 0], [w / 2 - c, h / 2, 0], [-w / 2 + c, h / 2, 0], [-w / 2, h / 2 - c, 0], [-w / 2, -h / 2 + c, 0], [-w / 2 + c, -h / 2, 0]];
    var frame = tube(loop, r, 6, 40, false), bar = between(cyl(r * .85, r * .85, 1, 6), [-w / 2, 0, r * .2], [w / 2, 0, r * .2]), prong = between(cyl(r * .7, r * .45, 1, 5), [0, 0, r * .8], [0, h / 2 + r * .6, r * 1.6]);
    return merge([frame, bar, prong]);
  }
  // Twisted rope: strands wound around a path.
  function rope(points, r, strands, pitch) {
    strands = strands || 3; pitch = pitch || r * 7;
    var curve = new T.CatmullRomCurve3(points.map(vec), false, 'centripetal'), len = curve.getLength(), n = Math.max(8, Math.ceil(len / (r * 2.2))), frames = curve.computeFrenetFrames(n, false), out = [];
    for (var s = 0; s < strands; s++) {
      var path = [];
      for (var i = 0; i <= n; i++) { var t = i / n, P = curve.getPointAt(t), a = s / strands * TAU + t * len / pitch * TAU, off = r * .52; path.push(P.clone().addScaledVector(frames.normals[i], Math.cos(a) * off).addScaledVector(frames.binormals[i], Math.sin(a) * off)); }
      out.push(tube(path, r * .56, 4, n, true));
    }
    return merge(out);
  }
  // Human skull trophy (local: +Z face, +Y up; s = cranium height). Returns parts { bone, void }.
  function skull(s, jaw) {
    var P = { bone: [], void: [] }, g = new T.SphereGeometry(.5, 22, 16), p = g.attributes.position, d = new T.Vector3();
    for (var i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize(); var x = d.x, y = d.y, z = d.z, r = .5;
      r *= 1 + .06 * Math.max(0, -z) - .05 * Math.pow(Math.abs(x), 3);                   // long back, flat temples
      if (z > .2 && y > -.1 && y < .25) r *= 1 + .07 * Math.exp(-Math.pow((y - .08) / .08, 2)); // brow ridge
      if (y < -.1) r *= 1 - .22 * Math.min(1, (-.1 - y) / .6) * (1 - .6 * Math.max(0, z));   // narrow cheeks/base
      var q = d.multiplyScalar(r); q.x *= .78; q.y *= .92; p.setXYZ(i, q.x, q.y, q.z);
    }
    g.computeVertexNormals(); g.scale(s, s, s); P.bone.push(g);
    P.bone.push(blob(s * .21, [0, -s * .33, s * .27], [1.35, .8, 1], .15, 4, 12));          // maxilla
    [-1, 1].forEach(function (sd) { P.bone.push(blob(s * .1, [sd * s * .26, -s * .22, s * .24], [1.1, .7, 1.2], .2, 7 + sd, 10)); }); // cheekbones
    [-1, 1].forEach(function (sd) { P.void.push(sphere(s * .115, [sd * s * .16, -s * .06, s * .37], [1, .9, .55], 12, 10)); });
    P.void.push(put(new T.ConeGeometry(s * .055, s * .11, 3), [0, -s * .2, s * .45], [.35, 0, PI]));
    for (i = 0; i < 8; i++) { var a = (i - 3.5) * .17; P.bone.push(box(s * .038, s * .07, s * .03, [Math.sin(a) * s * .2, -s * .47, s * .13 + Math.cos(a) * s * .2 - s * .05], [0, a, 0])); }
    if (jaw) P.bone.push(put(extrude([[-.2, 0], [.2, 0], [.19, -.06], [.1, -.13], [-.1, -.13], [-.19, -.06]].map(function (q2) { return [q2[0] * s, q2[1] * s]; }), s * .16, s * .02), [0, -s * .52, s * .18], [0, 0, 0]));
    return { parts: P };
  }
  // Hanging tuft of hair/fur: crossed alpha cards (fringe texture), local +Y up, hanging along -Y.
  function tuft(len, width, bend, seed) {
    var out = [];
    for (var c = 0; c < 2; c++) {
      var a = c * PI / 2 + (hash(seed || 0, c, 1) - .5) * .6, ca = Math.cos(a), sa = Math.sin(a), u0 = hash(seed || 0, c, 2) * .75;
      var g = sheet(2, 4, function (u, v) { var x = (u - .5) * width * (1 - v * .55), yy = -v * len, zz = bend * v * v * len; return [x * ca + zz * sa, yy, -x * sa + zz * ca]; }, false);
      var uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * .25, uv.getY(i));
      out.push(g);
    }
    return merge(out);
  }
  // Rectangle decal quad using one cell of the decal atlas (0 sigil, 1 handprint, 2 claw marks, 3 splatter).
  function decal(cell, w, h, seg) {
    var g = new T.PlaneGeometry(w, h, seg || 4, seg || 4), uv = g.attributes.uv, cx = (cell % 2) * .5, cy = cell < 2 ? .5 : 0;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) * .5, cy + uv.getY(i) * .5);
    return g;
  }

  // Parametric sheet: fn(u 0..1, v 0..1) -> [x,y,z]; closedU wraps the last column onto the first.
  function sheet(nu, nv, fn, closedU, flip) {
    var pos = [], uv = [], idx = [], cols = nu + 1;
    for (var j = 0; j <= nv; j++) for (var i = 0; i <= nu; i++) { var p = fn(closedU && i === nu ? 0 : i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, j / nv); }
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) { var a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (closedU) seamNormals(g, nu, nv);
    return g;
  }
  function seamNormals(g, nu, nv) { var n = g.attributes.normal, cols = nu + 1, a = new T.Vector3(), b = new T.Vector3(); for (var j = 0; j <= nv; j++) { a.fromBufferAttribute(n, j * cols); b.fromBufferAttribute(n, j * cols + nu); a.add(b).normalize(); n.setXYZ(j * cols, a.x, a.y, a.z); n.setXYZ(j * cols + nu, a.x, a.y, a.z); } }
  // Solid shell with thickness along the inward normal and closed borders (armour plates, mantles).
  function shell(nu, nv, fn, thickness, closedU, flip) {
    var outer = sheet(nu, nv, fn, closedU, flip), p = outer.attributes.position, n = outer.attributes.normal, cols = nu + 1, count = p.count;
    var inner = outer.clone(), ip = inner.attributes.position, t = typeof thickness === 'function' ? thickness : function () { return thickness; };
    for (var k = 0; k < count; k++) { var u = (k % cols) / nu, v = Math.floor(k / cols) / nv, d = t(u, v); ip.setXYZ(k, p.getX(k) - n.getX(k) * d, p.getY(k) - n.getY(k) * d, p.getZ(k) - n.getZ(k) * d); }
    var ii = inner.index.array; for (k = 0; k < ii.length; k += 3) { var tmp = ii[k + 1]; ii[k + 1] = ii[k + 2]; ii[k + 2] = tmp; } inner.computeVertexNormals();
    var parts = [outer, inner];
    function strip(list) { // list of vertex indices along a border
      var pos = [], idx = [], uv = [];
      list.forEach(function (k2, i) { pos.push(p.getX(k2), p.getY(k2), p.getZ(k2), ip.getX(k2), ip.getY(k2), ip.getZ(k2)); uv.push(i / list.length, 0, i / list.length, .03); });
      for (var i = 0; i < list.length - 1; i++) { var a = i * 2, b = a + 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    }
    var top = [], bottom = [], left = [], right = [];
    for (var i = 0; i <= nu; i++) { bottom.push(i); top.push(nv * cols + (nu - i)); }
    for (var j = 0; j <= nv; j++) { left.push((nv - j) * cols); right.push(j * cols + nu); }
    [bottom, top].concat(closedU ? [] : [left, right]).forEach(function (l) { var s = strip(l); if (flip) { var a2 = s.index.array; for (var q = 0; q < a2.length; q += 3) { var tt = a2[q + 1]; a2[q + 1] = a2[q + 2]; a2[q + 2] = tt; } s.computeVertexNormals(); } parts.push(s); });
    // rolled rims: a tube over the chosen borders so plates read as forged, with a rounded bevelled edge
    // opts.rim = radius, opts.rimSides = string of b/t/l/r (default 'bt' closed, 'btlr' open)
    var opts = arguments[6] || {};
    if (opts.rim) {
      var sides = opts.rimSides || (closedU ? 'bt' : 'btlr'), rimPts = function (list) { return list.map(function (k2) { var t2 = t(0, 0) * .5 - opts.rim * .15; return [p.getX(k2) - n.getX(k2) * t2, p.getY(k2) - n.getY(k2) * t2, p.getZ(k2) - n.getZ(k2) * t2]; }); };
      if (!closedU && sides.length === 4) { var loop = bottom.concat(right.slice(1), top.slice(1), left.slice(1)); parts.push(tube(rimPts(loop), opts.rim, 6, loop.length * 2, false)); }
      else { var map = { b: bottom, t: top, l: left, r: right }; sides.split('').forEach(function (sd) { var l2 = map[sd]; if (l2) parts.push(tube(rimPts(l2), opts.rim, 6, l2.length * 2, !closedU)); }); }
    }
    return merge(parts);
  }

  // ---------- blades ----------
  // Blade lies in the XY plane, spine at -X, edge at +X; outline(y) -> [spineX, edgeX].
  // Cross section: flat faces, optional fuller groove, bevelled cutting edge (separate "edge" geometry).
  function blade(y0, y1, rows, outline, thick, bevelFrac, fuller) {
    var bodyU = [0, .07, .22, .36, .5, .64, 1 - bevelFrac], edgeU = [1 - bevelFrac, 1];
    function zAt(u) {
      var z = thick * .5 * (1 - .3 * u);
      if (fuller && u > fuller[0] && u < fuller[1]) z -= thick * .26 * Math.sin((u - fuller[0]) / (fuller[1] - fuller[0]) * PI);
      if (u > 1 - bevelFrac) z *= 1 - (u - (1 - bevelFrac)) / bevelFrac * .94;
      return z;
    }
    function point(i, u, side) { var y = mix(y0, y1, i / rows), o = outline(y); return [mix(o[0], o[1], u), y, zAt(u) * side]; }
    function sheet(us) {
      var pos = [], uv = [], idx = [], nc = us.length;
      [1, -1].forEach(function (side, si) {
        for (var i = 0; i <= rows; i++) for (var c = 0; c < nc; c++) { var p = point(i, us[c], side); pos.push(p[0], p[1], p[2]); uv.push(p[0] * 3, p[1] * 3); }
        var base = si * (rows + 1) * nc;
        for (i = 0; i < rows; i++) for (c = 0; c < nc - 1; c++) {
          var a = base + i * nc + c, b = a + nc;
          if (side > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      });
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    function cap(u, outward) {
      var pos = [], uv = [], idx = [];
      for (var i = 0; i <= rows; i++) { var f = point(i, u, 1), k = point(i, u, -1); pos.push(f[0], f[1], f[2], k[0], k[1], k[2]); uv.push(0, f[1] * 3, .05, f[1] * 3); }
      for (i = 0; i < rows; i++) { var fa = i * 2, ba = fa + 1, fb = fa + 2, bb = fa + 3; if (outward < 0) idx.push(ba, fa, fb, ba, fb, bb); else idx.push(fa, ba, bb, fa, bb, fb); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    function endCap(i, down) {
      var us = bodyU.concat([1]), pos = [], uv = [], idx = [];
      us.forEach(function (u) { var f = point(i, u, 1), k = point(i, u, -1); pos.push(f[0], f[1], f[2], k[0], k[1], k[2]); uv.push(f[0] * 3, 0, f[0] * 3, .05); });
      for (var c = 0; c < us.length - 1; c++) { var fa = c * 2, ba = fa + 1, fb = fa + 2, bb = fa + 3; if (down) idx.push(fa, ba, bb, fa, bb, fb); else idx.push(ba, fa, fb, ba, fb, bb); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    return { body: merge([sheet(bodyU), cap(0, -1), endCap(0, true), endCap(rows, false)]), edge: merge([sheet(edgeU), cap(1, 1)]) };
  }
  // Leather grip: dark core, a spiral ribbon whose turns overlap, wire bindings at both ends.
  function grip(length, r, wraps, y0) {
    var parts = { leather: [], dark: [], iron: [] }, y = y0 === undefined ? -length * .5 : y0;
    parts.dark.push(cyl(r * .9, r * .9, length, 10, [0, y + length / 2, 0]));
    var turns = wraps, pts = [], nrm = [], steps = turns * 12;
    for (var i = 0; i <= steps; i++) { var t = i / steps, a = t * turns * TAU; pts.push([Math.cos(a) * r, y + .008 + t * (length - .016), Math.sin(a) * r]); nrm.push([Math.cos(a), 0, Math.sin(a)]); }
    parts.leather.push(band(pts, length / turns * 1.18, r * .2, nrm, { segments: steps }));
    [y + .005, y + length - .005].forEach(function (yy) { for (var k = -1; k <= 1; k++) parts.iron.push(put(new T.TorusGeometry(r * 1.17, r * .1, 4, 14), [0, yy + k * r * .22, 0], [PI / 2, 0, 0])); });
    return parts;
  }
  function add(dst, src) { Object.keys(src).forEach(function (k) { (dst[k] = dst[k] || []).push.apply(dst[k], src[k]); }); return dst; }
  // V-shaped notches along a cutting edge: list of [y, depth, halfWidth].
  function chipper(list) { return function (y) { var d = 0; list.forEach(function (c) { d = Math.max(d, c[1] * Math.max(0, 1 - Math.abs(y - c[0]) / c[2])); }); return d; }; }
  // Blood toward the tip and along the edge (kwear.z), for blades in the weapon frame (+Y along the blade, edge +X).
  function bloodied(g, y0, y1, edgeBias) { return wear(g, { paint: function (p) { return smooth((p.y - y0) / (y1 - y0)) * (.45 + .55 * fbm(p.x * 30, p.y * 9, p.z * 30, 2)) * (p.x > 0 ? 1 : 1 - (edgeBias || .5)); } }); }

  // Hero: two-handed cleaver greatsword. Broad squared blade, broken-back spine, fuller with engraved runes
  // (material 'blade-runes'), chipped edge, leather-wrapped ricasso, spiral-wrapped grip, iron pommel with a thong.
  function cleaver() {
    var P = { blade: [], edge: [], iron: [], dark: [], brass: [], leather: [] };
    var chip = chipper([[.47, .011, .02], [.66, .006, .011], [.86, .017, .026], [1.03, .008, .013], [1.19, .013, .02], [1.3, .006, .011]]);
    var b = blade(.17, 1.43, 64, function (y) {
      var t = (y - .17) / 1.26, spine = -.066 - t * .018 - (t > .62 ? (t - .62) * .09 : 0);
      spine += (Math.sin(y * 57) > .93 ? .008 : 0) + (y > .95 && y < .99 ? .006 : 0); // notches in the spine
      var edgeX = .072 + t * .07 + (fbm(y * 31, 0, 0, 2) - .5) * .004 - chip(y);
      if (y > 1.33) { var k = (y - 1.33) / .10; spine = mix(spine, edgeX - .03, smooth(k)); }
      return [spine, edgeX];
    }, .026, .24, [.18, .5]);
    P.blade.push(bloodied(b.body, .55, 1.4, .6)); P.edge.push(bloodied(b.edge, .45, 1.3, 0));
    P.dark.push(extrude([[-.19, .115], [.19, .115], [.215, .15], [.12, .175], [-.12, .175], [-.215, .15]], .052, .008));
    P.iron.push(extrude([[-.085, .165], [.095, .165], [.085, .225], [-.07, .225]], .036, .004));
    [-1, 1].forEach(function (s) {
      [-.15, -.05, .05, .15].forEach(function (x) { P.brass.push(stud(.0095, [x, .142, s * .0265], [0, 0, s])); });
      P.dark.push(box(.02, .075, .005, [0, .085, s * .0285])); P.brass.push(stud(.006, [0, .07, s * .031], [0, 0, s])); // langets
    });
    for (var i = 0; i < 3; i++) P.leather.push(box(.158, .024, .034, [.004, .245 + i * .03, 0], [0, 0, .1 - i * .05])); // ricasso wrap
    add(P, grip(.36, .024, 7, -.25));
    P.dark.push(lathe([[0, -.372], [.03, -.366], [.047, -.34], [.05, -.31], [.04, -.285], [.026, -.265], [0, -.255]], 8));
    P.iron.push(put(new T.TorusGeometry(.036, .009, 5, 14), [0, -.323, 0]));
    P.leather.push(tube([[.035, -.33, 0], [.052, -.36, .01], [.056, -.42, .02], [.05, -.48, .015]], .0045, 5, 14, true));
    P.brass.push(blob(.011, [.05, -.49, .015], [1, 1.3, 1], .2, 3, 8));
    return { parts: P, tip: new T.Vector3(.02, 1.40, 0), length: 1.43, materialKeys: { blade: 'blade-runes' } };
  }
  // Tomb warden falchion: broad clip-point single edge, chipped, wrapped grip, disc pommel.
  function falchion() {
    var P = { blade: [], edge: [], iron: [], dark: [], brass: [], leather: [] }, chip = chipper([[.36, .007, .012], [.6, .01, .016], [.79, .006, .01]]);
    var b = blade(.12, .98, 40, function (y) {
      var t = (y - .12) / .86, edgeX = .045 + Math.sin(t * PI * .85) * .05 + t * .02 - chip(y), spine = -.032 + (t > .72 ? (t - .72) * .30 : 0);
      if (y > .93) spine = mix(spine, edgeX - .006, (y - .93) / .05);
      return [spine, edgeX];
    }, .02, .28, [.14, .42]);
    P.blade.push(bloodied(b.body, .4, .98, .7)); P.edge.push(bloodied(b.edge, .3, .9, 0));
    P.dark.push(extrude([[-.11, .085], [.11, .085], [.13, .105], [-.13, .105]], .042, .006), sphere(.017, [-.135, .095, 0], null, 8, 6), sphere(.017, [.135, .095, 0], null, 8, 6));
    P.brass.push(put(new T.TorusGeometry(.03, .008, 5, 12), [0, .118, 0], [PI / 2, 0, 0]));
    [-1, 1].forEach(function (s) { P.brass.push(stud(.007, [-.08, .095, s * .021], [0, 0, s]), stud(.007, [.08, .095, s * .021], [0, 0, s])); });
    add(P, grip(.2, .021, 5, -.19));
    P.dark.push(lathe([[0, -.26], [.03, -.255], [.04, -.235], [.036, -.21], [.024, -.2], [0, -.195]], 10));
    return { parts: P, tip: new T.Vector3(.03, .96, 0), length: .98 };
  }
  // Tall curved tower shield. Local frame: +Z outward face, +Y up, origin at the forearm strap.
  // Planks with dark seams, iron rim with nails, riveted bands, boss, broken arrows, claw gouges and a bloody
  // handprint (decal atlas cells) over the painted broken-chain sigil.
  function towerShield() {
    var P = { wood: [], iron: [], dark: [], brass: [], leather: [], paint: [], edge: [], void: [] }, W = .66, H = 1.12, R = .95, cy = -.02;
    function bendPt(x, y, z) { var a = x / R; return [Math.sin(a) * (R + z), y, Math.cos(a) * (R + z) - R]; }
    function bend(g) { var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var q = bendPt(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0], q[1], q[2]); } g.computeVertexNormals(); return g; }
    function outline(w, h) {
      var pts = [], n = 10; pts.push([-w / 2, h * .5 - .10]);
      for (var i = 0; i <= n; i++) { var a = PI - i / n * PI; pts.push([Math.cos(a) * w / 2, h * .5 - .10 + Math.sin(a) * .10]); }
      pts.push([w / 2, -h * .5 + .16]); pts.push([w * .18, -h * .5]); pts.push([-w * .18, -h * .5]); pts.push([-w / 2, -h * .5 + .16]);
      return pts;
    }
    function topAt(x) { var c = Math.min(1, Math.abs(x) / (W / 2)); return H * .5 - .10 + Math.sqrt(Math.max(0, 1 - c * c)) * .10; }
    function bottomAt(x) { var ax = Math.abs(x); return ax < W * .18 ? -H * .5 : mix(-H * .5, -H * .5 + .16, (ax - W * .18) / (W / 2 - W * .18)); }
    var face = extrude(outline(W, H), .045, .006, null, 8); face.translate(0, cy, 0);
    face = subdivideForBend(face); bend(face); uvScale(face, 1.4); P.wood.push(face);
    [-.26, -.13, .13, .26].forEach(function (x, i) { var y0 = bottomAt(x) + .015, y1 = topAt(x) - .015, g = put(new T.BoxGeometry(.0045, y1 - y0, .004, 1, 14, 1), [x + (hash(i, 2, 2) - .5) * .01, (y0 + y1) / 2 + cy, .0235]); P.void.push(bend(g)); });
    var rimPts = outline(W + .012, H + .012).map(function (p) { return [p[0], p[1] + cy, .03]; }); rimPts.push(rimPts[0]);
    P.iron.push(tube(rimPts.map(function (p) { return bendPt(p[0], p[1], p[2]); }), .018, 6, 90));
    var rimCurve = new T.CatmullRomCurve3(rimPts.map(function (p) { return new T.Vector3().fromArray(bendPt(p[0], p[1], p[2])); }));
    for (var k = 0; k < 26; k++) { var rp = rimCurve.getPointAt(k / 26); P.dark.push(nail(.006, [rp.x, rp.y, rp.z + .016], [Math.sin(rp.x / R) * .3, 0, 1])); }
    [.30, -.22].forEach(function (y) { var g = box(W * .96, .055, .012, [0, y + cy, .036]); P.iron.push(bend(subdivideForBend(g))); });
    var spine = box(.07, H * .9, .012, [0, cy - .02, .038]); P.dark.push(bend(subdivideForBend(spine)));
    var boss = lathe([[0, .11], [.10, .1], [.13, .05], [.14, 0]], 18); boss.rotateX(PI / 2); boss.translate(0, .06 + cy, .03); P.iron.push(boss);
    P.iron.push(put(new T.TorusGeometry(.137, .01, 5, 24), [0, .06 + cy, .034]));
    P.edge.push(put(new T.ConeGeometry(.03, .12, 8), [0, .06 + cy, .17], [PI / 2, 0, 0]));
    var rv = []; [-.27, -.14, .14, .27].forEach(function (x) { [.30, -.22].forEach(function (y) { rv.push(stud(.011, bendPt(x, y + cy, .042), [Math.sin(x / R), 0, Math.cos(x / R)])); }); });
    for (k = 0; k < 8; k++) { var ba = k / 8 * TAU; rv.push(stud(.008, [Math.cos(ba) * .115, .06 + cy + Math.sin(ba) * .115, .056], [0, 0, 1])); }
    P.brass.push(merge(rv));
    var sig = decal(0, .46, .46, 8); sig.translate(0, -.32 + cy, .05); P.paint.push(bend(sig));
    var claw = decal(2, .34, .30, 6); claw.rotateZ(-.35); claw.translate(-.1, .34 + cy, .052); P.paint.push(bend(claw));
    var hand = decal(1, .15, .19, 4); hand.rotateZ(.25); hand.translate(.19, -.05 + cy, .052); P.paint.push(bend(hand));
    // two broken arrows stuck in the planks (splintered shaft, torn fletching)
    [[-.17, .1, .5, .3], [.12, -.36, -.4, .5]].forEach(function (a, i) {
      var base = bendPt(a[0], a[1] + cy, .03), dir = new T.Vector3(Math.sin(a[2]) * .5, .25, 1).normalize(), tip = new T.Vector3().fromArray(base).addScaledVector(dir, .2 + i * .06);
      P.wood.push(between(cyl(.0055, .0055, 1, 6), base, tip));
      P.wood.push(spike(.0065, tip.clone(), tip.clone().addScaledVector(dir, .018).add(new T.Vector3(.004, .003, 0)), 5));
      if (i === 0) for (var f = 0; f < 3; f++) { var fa = f / 3 * TAU + a[3], side = new T.Vector3(Math.cos(fa), Math.sin(fa), 0), p0 = tip.clone().addScaledVector(dir, -.06); P.leather.push(sheet(1, 2, function (u, v) { var q = p0.clone().addScaledVector(dir, v * .055).addScaledVector(side, u * .018 * (1 - v * .3)); return [q.x, q.y, q.z]; }, false)); }
    });
    P.leather.push(box(.36, .05, .02, [0, .08, -.035]), box(.36, .05, .02, [0, -.14, -.035]), box(.05, .3, .018, [0, -.03, -.045]));
    [.08, -.14].forEach(function (y) { var bk = buckle(.034, .04, .0035); bk.rotateY(PI); bk.translate(.12, y, -.047); P.iron.push(bk); });
    return { parts: P, width: W, height: H };
  }
  function subdivideForBend(g, cell) {
    // Extrude/Box faces are large; tessellate along X so bending reads as a curve.
    g = g.index ? g.toNonIndexed() : g; var p = g.attributes.position, uv = g.attributes.uv, pos = [], uvs = [];
    var slices = 10;
    for (var i = 0; i < p.count; i += 3) {
      var tri = [0, 1, 2].map(function (k) { return { p: new T.Vector3().fromBufferAttribute(p, i + k), u: uv ? new T.Vector2().fromBufferAttribute(uv, i + k) : new T.Vector2() }; });
      var span = Math.max(tri[0].p.distanceTo(tri[1].p), tri[1].p.distanceTo(tri[2].p), tri[0].p.distanceTo(tri[2].p));
      var n = Math.max(1, Math.min(cell ? 24 : slices, Math.round(span / (cell || .06))));
      // barycentric subdivision into n^2 triangles
      for (var a = 0; a < n; a++) for (var b = 0; b < n - a; b++) {
        var c = [[a, b], [a + 1, b], [a, b + 1]], d = [[a + 1, b], [a + 1, b + 1], [a, b + 1]];
        [c, (a + b < n - 1) ? d : null].forEach(function (set) {
          if (!set) return;
          set.forEach(function (ab) {
            var w1 = ab[0] / n, w2 = ab[1] / n, w0 = 1 - w1 - w2;
            pos.push(tri[0].p.x * w0 + tri[1].p.x * w1 + tri[2].p.x * w2, tri[0].p.y * w0 + tri[1].p.y * w1 + tri[2].p.y * w2, tri[0].p.z * w0 + tri[1].p.z * w1 + tri[2].p.z * w2);
            uvs.push(tri[0].u.x * w0 + tri[1].u.x * w1 + tri[2].u.x * w2, tri[0].u.y * w0 + tri[1].u.y * w1 + tri[2].u.y * w2);
          });
        });
      }
    }
    // weld identical corners so the tessellation stays indexed and light
    var map = new Map(), P2 = [], U2 = [], I2 = [];
    for (var v = 0; v < pos.length / 3; v++) {
      var key = Math.round(pos[v * 3] * 1e4) + ',' + Math.round(pos[v * 3 + 1] * 1e4) + ',' + Math.round(pos[v * 3 + 2] * 1e4) + ',' + Math.round(uvs[v * 2] * 1e3) + ',' + Math.round(uvs[v * 2 + 1] * 1e3);
      var id = map.get(key); if (id === undefined) { id = P2.length / 3; map.set(key, id); P2.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); U2.push(uvs[v * 2], uvs[v * 2 + 1]); } I2.push(id);
    }
    var out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(P2, 3)); out.setAttribute('uv', new T.Float32BufferAttribute(U2, 2)); out.setIndex(I2); out.computeVertexNormals();
    g.dispose(); return out;
  }
  // Warden great helm fitted around a head of radius r (local: origin head centre, +Z face, +Y up).
  // Riveted brow band and seams, a few hammered dents, breaths, eye slit and a crown of iron spikes.
  function greatHelm(r, h) {
    var P = { iron: [], dark: [], edge: [], void: [], brass: [] }, R = r * 1.08, top = h * .55, bottom = -h * .62;
    var slitY = h * .05, slitH = .022;
    function prof(y0, y1) { var pts = []; for (var i = 0; i <= 6; i++) { var y = mix(y0, y1, i / 6); pts.push([R * (1 - .05 * Math.pow((y - bottom) / (top - bottom) - .5, 2) * 4) * (y > top - .03 ? .96 : 1), y]); } return pts; }
    function dents(g) { return displace(g, function (a) { var d = 0; [[.6, .25, .7], [-.8, .1, .4], [.1, .35, -.9], [-.3, -.4, .85]].forEach(function (c, i) { var dx = a.x / R - c[0], dy = a.y / R - c[1], dz = a.z / R - c[2]; d -= .006 * Math.exp(-(dx * dx + dy * dy + dz * dz) / .025) * (1 + i * .2); }); return d; }); }
    var upper = lathe(prof(slitY + slitH / 2, top).concat([[R * .7, top + .02], [0, top + .03]]), 32); P.iron.push(dents(upper));
    P.iron.push(lathe(prof(slitY - slitH / 2, slitY + slitH / 2), 22, PI / 2 + .75, TAU - 1.5));
    var lower = lathe([[R * .80, bottom - .01]].concat(prof(bottom, slitY - slitH / 2)), 32); P.iron.push(dents(lower));
    P.void.push(lathe([[R * .93, bottom], [R * .95, top - .01], [0, top - .01]], 20));
    P.dark.push(between(cyl(.018, .018, 1, 6), [0, bottom + .01, R + .006], [0, top - .01, R * .97 + .006]));
    P.dark.push(lathe([[R + .012, slitY + slitH / 2 + .002], [R + .018, slitY + slitH / 2 + .016], [R + .016, slitY + slitH / 2 + .03], [R + .004, slitY + slitH / 2 + .036]], 32));
    P.dark.push(lathe([[R * .8 + .002, bottom - .012], [R * .8 + .012, bottom - .004], [R * .8 + .01, bottom + .012], [R * .8, bottom + .016]], 32));
    for (var i = 0; i < 7; i++) { var a = (i - 3) * .15; P.void.push(put(new T.CircleGeometry(.0085, 6), [Math.sin(a) * (R + .002), bottom + .07 + (i % 2) * .03, Math.cos(a) * (R + .002)], [0, a, 0])); }
    var st = [];
    for (i = 0; i < 16; i++) { var b2 = i / 16 * TAU; if (Math.abs(Math.atan2(Math.sin(b2), Math.cos(b2))) < .3) continue; st.push(stud(.0075, [Math.sin(b2) * (R + .017), slitY + slitH / 2 + .018, Math.cos(b2) * (R + .017)], [Math.sin(b2), 0, Math.cos(b2)])); }
    for (i = 0; i < 12; i++) { var b3 = i / 12 * TAU; st.push(stud(.0065, [Math.sin(b3) * (R * .8 + .012), bottom + .004, Math.cos(b3) * (R * .8 + .012)], [Math.sin(b3), -.2, Math.cos(b3)])); }
    [-1, 1].forEach(function (s) { for (var k = 0; k < 4; k++) { var y = mix(bottom + .05, top - .06, k / 3); st.push(stud(.006, [0, y, R + .024 - Math.abs(k - 1.5) * .004], [0, 0, 1])); } });
    P.brass.push(merge(st));
    for (i = 0; i < 9; i++) { var b = i / 9 * TAU, base = [Math.sin(b) * R * .86, top - .005, Math.cos(b) * R * .86]; P.edge.push(spike(.016, base, [Math.sin(b) * R * 1.02, top + .06 + (i % 3 === 0 ? .04 : 0), Math.cos(b) * R * 1.02])); P.dark.push(put(new T.CylinderGeometry(.02, .022, .012, 7), base)); }
    return { parts: P };
  }
  // Ash priest staff: gnarled haft with rope bindings, iron crescent, brazier of live coals, skull fetishes on chains.
  function priestStaff() {
    var P = { wood: [], iron: [], dark: [], ember: [], bone: [], rope: [], void: [] }, pts = [];
    for (var i = 0; i <= 12; i++) { var y = mix(-.95, 1.02, i / 12); pts.push([(fbm(y * 3, 1, 0) - .5) * .06, y, (fbm(y * 3, 7, 0) - .5) * .06]); }
    var haft = tube(pts, function (t) { return .027 + .007 * Math.sin(t * 31) * Math.sin(t * 7) + (t > .92 ? (t - .92) * .2 : 0); }, 9, 60, true);
    P.wood.push(displace(haft, function (a) { return (fbm(a.x * 60, a.y * 14, a.z * 60, 2) - .5) * .006; }));
    var hc = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3().fromArray(p); }));
    function haftAt(y) { return hc.getPointAt(clamp((y + .95) / 1.97, 0, 1)); }
    [[-.14, 7], [.5, 5]].forEach(function (w) { var c0 = haftAt(w[0]), path = []; for (var k = 0; k <= w[1] * 10; k++) { var t = k / (w[1] * 10), a = t * w[1] * TAU, yy = w[0] + t * w[1] * .014, c = haftAt(yy); path.push([c.x + Math.cos(a) * .033, yy, c.z + Math.sin(a) * .033]); } P.rope.push(rope(path, .0065, 3, .03)); });
    [-.25, .38, .95].forEach(function (y) { var c = haftAt(y); P.dark.push(ring(.032, .008, [c.x, y, c.z])); });
    var crescent = extrude(circle(.24, 16, 0, 0, .15, PI - .3).concat(circle(.18, 16, 0, .045, PI - .38, -(PI - .76))), .02, .005); crescent.translate(0, 1.06, 0); P.iron.push(crescent);
    var bowl = lathe([[0, 1.03], [.06, 1.035], [.1, 1.08], [.11, 1.14], [.095, 1.145], [.08, 1.1], [0, 1.09]], 16); P.dark.push(bowl);
    for (i = 0; i < 8; i++) { var ba = i / 8 * TAU; P.dark.push(spike(.008, [Math.cos(ba) * .105, 1.14, Math.sin(ba) * .105], [Math.cos(ba) * .125, 1.2, Math.sin(ba) * .125], 5)); }
    for (i = 0; i < 13; i++) P.ember.push(blob(.024, [(hash(i, 1, 1) - .5) * .12, 1.12 + hash(i, 2, 1) * .035, (hash(i, 3, 1) - .5) * .12], null, .5, i, 8));
    [-1, 1].forEach(function (s) {
      P.dark.push(chain([[s * .2, 1.12, 0], [s * .21, .98, .01], [s * .2, .86, 0]], .032));
      var sk = skull(.07, s > 0); Object.keys(sk.parts).forEach(function (k) { sk.parts[k].forEach(function (g) { g.rotateY(s * .4); g.translate(s * .2, .8, 0); P[k].push(g); }); });
    });
    P.dark.push.apply(P.dark, P.void); delete P.void;
    return { parts: P, tip: new T.Vector3(0, 1.14, 0), length: 1.15 };
  }
  // Curved hooked claws for one hand (local: +Y along fingers, +Z palm-forward): jointed, ridged, bound with iron.
  function claws(n, length) {
    var P = { bone: [], dark: [] };
    for (var i = 0; i < n; i++) {
      var x = (i - (n - 1) / 2) * .026, pts = [], L = length * (1 - Math.abs(i - (n - 1) / 2) * .08);
      for (var k = 0; k <= 8; k++) { var t = k / 8; pts.push([x * (1 + t * .8), .05 + t * L, -Math.pow(t, 2) * L * .32]); }
      var cl = tube(pts, function (t) { return mix(.011, .0012, Math.pow(t, .8)) * (1 + .12 * Math.sin(t * 40)); }, 6, 28, true);
      P.bone.push(cl);
      [.25, .55].forEach(function (t) { var j = Math.floor(t * 8), p = pts[j]; P.bone.push(sphere(mix(.012, .004, t), p, [1, .8, 1], 8, 6)); });
    }
    P.dark.push(box(.11, .03, .06, [0, .03, -.01]), put(new T.TorusGeometry(.05, .007, 5, 16), [0, .045, -.01], [PI / 2, 0, 0]));
    return { parts: P };
  }
  // Executioner's great axe-cleaver for the boss (world metres): bevelled head with a chipped crescent edge,
  // riveted langets, leather-wrapped haft, iron butt spike and a hanging chain.
  function bossAxe() {
    var P = { wood: [], iron: [], edge: [], dark: [], brass: [], leather: [] };
    var shaft = tube([[0, -.75, 0], [0, 0, 0], [0, .9, 0], [0, 1.55, 0]], .042, 10, 24, true); uvScale(shaft, 1, .4); P.wood.push(shaft);
    [-.66, -.5, .95].forEach(function (y) { P.dark.push(ring(.047, .012, [0, y, 0])); });
    var wr = [], wn = [], turns = 9; for (var i = 0; i <= turns * 10; i++) { var t = i / (turns * 10), a = t * turns * TAU; wr.push([Math.cos(a) * .043, -.46 + t * .4, Math.sin(a) * .043]); wn.push([Math.cos(a), 0, Math.sin(a)]); }
    P.leather.push(band(wr, .4 / turns * 1.15, .006, wn, { segments: turns * 10 }));
    [-1, 1].forEach(function (s) { P.dark.push(box(.032, .5, .008, [0, .76, s * .046])); for (var k = 0; k < 4; k++) P.brass.push(stud(.008, [0, .56 + k * .13, s * .051], [0, 0, s])); });
    var head = [[-.05, 1.05], [.12, 1.02], [.38, .80], [.56, .86], [.60, 1.18], [.56, 1.52], [.38, 1.58], [.12, 1.42], [-.05, 1.47]];
    P.iron.push(extrude(head, .05, .012, [circle(.07, 12, .30, 1.30)], 4));
    var chip = chipper([[.97, .014, .03], [1.14, .008, .016], [1.36, .018, .035]]), outer = [], inner = [];
    for (i = 0; i <= 16; i++) { var tt = i / 16, y = mix(.86, 1.52, tt), bow = Math.sin(tt * PI) * .06; outer.push([.60 + bow - chip(y), y]); inner.unshift([.545 + bow * .7, y]); }
    P.edge.push(extrude(outer.concat(inner), .018, .004));
    P.dark.push(extrude([[-.09, 1.0], [.02, 1.0], [.02, 1.5], [-.09, 1.5]], .1, .01));
    P.iron.push(put(new T.ConeGeometry(.045, .3, 6), [-.2, 1.25, 0], [0, 0, PI / 2]));
    [-1, 1].forEach(function (s) { [[-.04, 1.1], [-.04, 1.4], [.2, .98], [.2, 1.5], [.45, 1.2]].forEach(function (q) { P.brass.push(stud(.013, [q[0], q[1], s * .038], [0, 0, s])); }); });
    P.dark.push(lathe([[0, -.9], [.03, -.86], [.05, -.8], [.05, -.76], [.044, -.74], [0, -.74]], 8));
    P.dark.push(chain([[0, -.62, .05], [.06, -.8, .08], [.02, -1.0, .06], [-.06, -1.12, .02]], .06));
    P.edge = P.edge.map(function (g) { return bloodied(g, .9, 1.5, 0); }); P.iron = P.iron.map(function (g, k) { return k === 0 ? bloodied(g, 1.0, 1.6, .3) : g; });
    return { parts: P, tip: new T.Vector3(.58, 1.2, 0), length: 1.6 };
  }
  // Heavy hook for the end of the boss's dragging chain.
  function hook() {
    var P = { iron: [], edge: [] }, pts = [];
    for (var i = 0; i <= 12; i++) { var a = i / 12 * PI * 1.35; pts.push([Math.sin(a) * .11, -.05 - (1 - Math.cos(a)) * .11 + (i < 2 ? .05 : 0), 0]); }
    P.iron.push(bloodied(tube([[0, .06, 0], [0, -.02, 0]].concat(pts.slice(1)), function (t) { return mix(.03, .006, t) * (1 + .15 * Math.max(0, 1 - Math.abs(t - .45) * 6)); }, 8, 36, true), .05, -.25, 0));
    P.iron.push(ring(.035, .01, [0, .09, 0], [0, 0, PI / 2]), ring(.034, .007, [0, .035, 0]));
    return { parts: P };
  }

  // ---------- canvas textures (no image files) ----------
  function canvas(size) { var c = document.createElement('canvas'); c.width = c.height = size; return c; }
  function rng(seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var textureCache = {};
  // Fur: dense downward strands; returns {map, bump}.
  function furTexture() {
    if (textureCache.fur) return textureCache.fur;
    var S = 512, a = canvas(S), b = canvas(S), ca = a.getContext('2d'), cb = b.getContext('2d'), r = rng(7);
    ca.fillStyle = '#231c17'; ca.fillRect(0, 0, S, S); cb.fillStyle = '#202020'; cb.fillRect(0, 0, S, S);
    var palette = [[44, 35, 28], [54, 43, 34], [64, 52, 41], [74, 62, 50], [86, 74, 60], [60, 54, 48]];
    ca.lineCap = cb.lineCap = 'round';
    // locks of hair: strands start spread out and converge to a tip, lighter toward the tip
    for (var i = 0; i < 1500; i++) {
      var cx = r() * S, cy = r() * S, ang = PI / 2 + (r() - .5) * .6, len = 16 + r() * 26, spread = 3 + r() * 5, col = palette[Math.floor(r() * palette.length)], n = 8 + Math.floor(r() * 9);
      var tx = cx + Math.cos(ang) * len, ty = cy + Math.sin(ang) * len, bend = (r() - .5) * 16;
      for (var k = 0; k < n; k++) {
        var o = (r() - .5) * 2 * spread, sx = cx + Math.cos(ang + PI / 2) * o, sy = cy + Math.sin(ang + PI / 2) * o, ex = tx + (r() - .5) * 3, ey = ty + (r() - .5) * 3, l = .75 + r() * .5;
        var mx = (sx + ex) / 2 + bend, my = (sy + ey) / 2;
        for (var ox = -S; ox <= S; ox += S) for (var oy = -S; oy <= S; oy += S) {
          if (Math.max(sx, ex) + ox < -20 || Math.min(sx, ex) + ox > S + 20 || Math.max(sy, ey) + oy < -20 || Math.min(sy, ey) + oy > S + 20) continue;
          ca.lineWidth = cb.lineWidth = 1.1 + r() * 1.3;
          ca.strokeStyle = 'rgba(' + (col[0] * l | 0) + ',' + (col[1] * l | 0) + ',' + (col[2] * l | 0) + ',.85)';
          ca.beginPath(); ca.moveTo(sx + ox, sy + oy); ca.quadraticCurveTo(mx + ox, my + oy, ex + ox, ey + oy); ca.stroke();
          var h = 100 + (k / n) * 40 + l * 30 | 0; cb.strokeStyle = 'rgba(' + h + ',' + h + ',' + h + ',.8)';
          cb.beginPath(); cb.moveTo(sx + ox, sy + oy); cb.quadraticCurveTo(mx + ox, my + oy, ex + ox, ey + oy); cb.stroke();
        }
      }
    }
    var map = new T.CanvasTexture(a), bump = new T.CanvasTexture(b);
    map.colorSpace = T.SRGBColorSpace; [map, bump].forEach(function (t) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; });
    return (textureCache.fur = { map: map, bump: bump });
  }
  // Hanging strand fringe (RGBA, alpha-tested cards) for fur hems.
  function fringeTexture() {
    if (textureCache.fringe) return textureCache.fringe;
    var W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d'), r = rng(11);
    g.clearRect(0, 0, W, H); g.lineCap = 'round';
    for (var i = 0; i < 700; i++) {
      var x = r() * W, len = H * (.35 + r() * .65), l = r(), w = 1.5 + r() * 3.5, bend = (r() - .5) * 18;
      g.strokeStyle = l < .2 ? '#221a15' : l < .6 ? '#4d4036' : l < .88 ? '#6e5e4d' : '#95836c'; g.lineWidth = w;
      for (var ox = -W; ox <= W; ox += W) { g.beginPath(); g.moveTo(x + ox, -2); g.quadraticCurveTo(x + ox + bend * .4, len * .5, x + ox + bend, len); g.stroke(); }
    }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping; t.repeat.set(4, 1); return (textureCache.fringe = t);
  }
  // Decal atlas (512 px, four 256 px cells, alpha-tested): 0 faded broken-chain sigil, 1 bloody handprint,
  // 2 claw gouges, 3 blood splatter. Geometry picks a cell with decal(cell, w, h).
  function decalTexture() {
    if (textureCache.decals) return textureCache.decals;
    var S = 512, c = canvas(S), g = c.getContext('2d'), r = rng(3);
    g.clearRect(0, 0, S, S); g.lineCap = 'round'; g.lineJoin = 'round';
    function erode(x0, y0, n, big) { g.save(); g.beginPath(); g.rect(x0, y0, 256, 256); g.clip(); g.globalCompositeOperation = 'destination-out'; for (var i = 0; i < n; i++) { g.globalAlpha = r() * .8; g.beginPath(); g.arc(x0 + r() * 256, y0 + r() * 256, 1 + r() * (big || 5), 0, TAU); g.fill(); } g.restore(); }
    // 0: sigil
    g.strokeStyle = '#7a1c16'; g.lineWidth = 15; g.beginPath(); g.arc(128, 128, 84, -1.2, 4.3); g.stroke();
    for (var i = 0; i < 7; i++) { var a = -1.2 + i * .78; g.lineWidth = 9; g.beginPath(); g.ellipse(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84, 20, 11, a + PI / 2, 0, TAU); g.stroke(); }
    g.lineWidth = 12; g.beginPath(); g.moveTo(128, 70); g.lineTo(128, 196); g.moveTo(92, 110); g.lineTo(164, 110); g.stroke();
    erode(0, 0, 900);
    // 1: handprint, dragged downward
    var hx = 256 + 128, hy = 150; g.fillStyle = '#5a0906'; g.strokeStyle = '#5a0906';
    g.beginPath(); g.ellipse(hx, hy, 40, 48, 0, 0, TAU); g.fill();
    [[-30, -1.9, 62], [-11, -1.66, 74], [9, -1.5, 70], [27, -1.3, 56]].forEach(function (f) { g.lineWidth = 17; g.beginPath(); g.moveTo(hx + f[0], hy - 30); g.lineTo(hx + f[0] + Math.cos(f[1]) * f[2] * .35, hy - 30 + Math.sin(f[1]) * f[2]); g.stroke(); });
    g.lineWidth = 18; g.beginPath(); g.moveTo(hx - 34, hy + 8); g.lineTo(hx - 70, hy - 22); g.stroke();
    for (i = 0; i < 9; i++) { var dx = hx - 34 + r() * 70, len = 20 + r() * 50; g.lineWidth = 2 + r() * 4; g.beginPath(); g.moveTo(dx, hy + 30); g.lineTo(dx + (r() - .5) * 4, hy + 30 + len); g.stroke(); g.beginPath(); g.arc(dx, hy + 30 + len, g.lineWidth * .8, 0, TAU); g.fill(); }
    erode(256, 0, 500, 3);
    // 2: four claw gouges: dark torn groove with a pale fresh edge
    for (i = 0; i < 4; i++) {
      var x0 = 50 + i * 42, y0 = 256 + 40 + i * 6, x1 = x0 + 50, y1 = 256 + 226 - i * 4;
      for (var k = 0; k < 6; k++) { var t = k / 5; g.lineWidth = mix(13, 2, t); g.strokeStyle = 'rgba(' + (18 + k * 2) + ',13,9,1)'; g.beginPath(); g.moveTo(mix(x0, x1, t * .5), mix(y0, y1, t * .5)); g.quadraticCurveTo(x0 + 34, (y0 + y1) / 2, x1, y1 - t * 20); g.stroke(); }
      g.lineWidth = 2; g.strokeStyle = '#8c7055'; g.beginPath(); g.moveTo(x0 + 7, y0 + 4); g.quadraticCurveTo(x0 + 41, (y0 + y1) / 2, x1 + 5, y1 - 6); g.stroke();
    }
    erode(0, 256, 260, 2.5);
    // 3: splatter with droplets and drips
    var sx = 256 + 128, sy = 256 + 110; g.fillStyle = '#4e0705';
    for (i = 0; i < 26; i++) { var ang = r() * TAU, d = r() * 34; g.beginPath(); g.arc(sx + Math.cos(ang) * d, sy + Math.sin(ang) * d * .8, 10 + r() * 16, 0, TAU); g.fill(); }
    for (i = 0; i < 60; i++) { var ang2 = r() * TAU, d2 = 50 + r() * 70, rr = 1 + r() * 5; g.beginPath(); g.arc(sx + Math.cos(ang2) * d2, sy + Math.sin(ang2) * d2 * .85, rr, 0, TAU); g.fill(); }
    g.strokeStyle = '#4e0705'; for (i = 0; i < 6; i++) { var dx2 = sx - 40 + r() * 80, l2 = 30 + r() * 80; g.lineWidth = 3 + r() * 4; g.beginPath(); g.moveTo(dx2, sy + 10); g.lineTo(dx2 + (r() - .5) * 3, sy + 10 + l2); g.stroke(); g.beginPath(); g.arc(dx2, sy + 10 + l2, g.lineWidth * .9, 0, TAU); g.fill(); }
    erode(256, 256, 300, 2);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return (textureCache.decals = t);
  }
  // Engraving height map for blades (white = surface, dark = cut). rect maps weapon-local x,y onto it:
  // u = (x - rect.x) / rect.z, v = (y - rect.y) / rect.w. A column of runes along the fuller with border lines,
  // plus fine random scratches over the whole blade.
  function runeTexture() {
    if (textureCache.runes) return textureCache.runes;
    var Wd = 128, Ht = 1024, c = document.createElement('canvas'); c.width = Wd; c.height = Ht; var g = c.getContext('2d'), r = rng(19);
    g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, Ht); g.lineCap = 'round'; g.lineJoin = 'round';
    var rect = new T.Vector4(-.075, .28, .165, 1.02);
    function px(x) { return (x - rect.x) / rect.z * Wd; } function py(y) { return Ht - (y - rect.y) / rect.w * Ht; }
    for (var i = 0; i < 140; i++) { var x = r() * Wd, y = r() * Ht, a = (r() - .5) * 1.2 + (r() < .5 ? 0 : PI / 2), l = 6 + r() * 40; g.strokeStyle = 'rgba(0,0,0,' + (.15 + r() * .25) + ')'; g.lineWidth = .7 + r() * .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    var cx = px(-.021), top = py(1.16), bottom = py(.36);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.6; [-12, 12].forEach(function (o) { g.beginPath(); g.moveTo(cx + o, bottom); g.lineTo(cx + o, top); g.stroke(); });
    g.lineWidth = 2.1; g.strokeStyle = '#000';
    for (var yy = top + 8; yy < bottom - 26; yy += 29) {
      var w = 7, h = 22, y0 = yy, stem = cx + (r() - .5) * 3; g.beginPath(); g.moveTo(stem, y0); g.lineTo(stem, y0 + h);
      var n = 1 + Math.floor(r() * 3);
      for (var k = 0; k < n; k++) { var sy = y0 + r() * h * .7, dir = r() < .5 ? -1 : 1, ey = sy + (r() < .5 ? -1 : 1) * (5 + r() * 7); g.moveTo(stem, sy); g.lineTo(stem + dir * w, ey); if (r() < .35) g.lineTo(stem + dir * w, ey + 6); }
      g.stroke();
      if (r() < .3) { g.beginPath(); g.arc(stem + (r() < .5 ? -8 : 8), y0 + h + 3, 1.6, 0, TAU); g.fillStyle = '#000'; g.fill(); }
    }
    var t = new T.CanvasTexture(c); t.anisotropy = 4; t.userData.rect = rect;
    return (textureCache.runes = t);
  }
  // Compatibility: the painted sigil now lives in cell 0 of the decal atlas.
  function sigilTexture() { return decalTexture(); }
  function disposeTextures() { Object.keys(textureCache).forEach(function (k) { var t = textureCache[k]; if (t.isTexture) t.dispose(); else { t.map.dispose(); t.bump.dispose(); } }); textureCache = {}; }

  B.Gear = {
    noise: noise, fbm: fbm, hash: hash, merge: merge, put: put, between: between, spike: spike, smoothNormals: smoothNormals, uvScale: uvScale, displace: displace,
    lathe: lathe, extrude: extrude, circle: circle, box: box, cyl: cyl, sphere: sphere, tube: tube, ring: ring, link: link, chain: chain,
    rivets: rivets, blob: blob, sheet: sheet, shell: shell, blade: blade, grip: grip, add: add, subdivide: subdivideForBend,
    wear: wear, fillWear: fillWear, orient: orient, stud: stud, nail: nail, band: band, buckle: buckle, rope: rope, skull: skull, tuft: tuft, decal: decal, chipper: chipper, bloodied: bloodied,
    cleaver: cleaver, falchion: falchion, towerShield: towerShield, greatHelm: greatHelm, priestStaff: priestStaff, claws: claws, bossAxe: bossAxe, hook: hook,
    furTexture: furTexture, fringeTexture: fringeTexture, sigilTexture: sigilTexture, decalTexture: decalTexture, runeTexture: runeTexture, disposeTextures: disposeTextures
  };
})();
