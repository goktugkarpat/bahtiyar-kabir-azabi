/* KABİR AZABI — Chapter II open coast (ajan world-b).
   The side areas are no longer boxed rooms: organic footprints, a western cliff trail that ties them into
   loops, a gallows hill and a broken mole out into the sea. A continuous sculpted terrain rises around every
   walkable area (hills, banks, cliffs) so edges read as landscape, not walls. Everything is static and
   batched at load; wisps, mist and grass sway run in shaders on a shared clock. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, PI = Math.PI;
  function tr(s) { return KabirI18n.t(s); }
  function trailX(z) { return -48 + 2.4 * Math.sin(z * .055) + 1.2 * Math.sin(z * .13 + 1); }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ---------- pure layout: rooms + walkable predicate (no meshes) ---------- */
  function layout(baseRooms) {
    var rooms = [
      { id: 7, name: tr('Batık Gümrük Avlusu'), x: -30, z: -59, w: 24, d: 22, parent: 2, entryZ: -63 },
      { id: 8, name: tr('Kara Ağacın Mezarlığı'), x: -32, z: -112, w: 24, d: 24, parent: 4, entryZ: -113 },
      { id: 9, name: tr('Kül Balıkçılarının Evleri'), x: -30, z: 4, w: 28, d: 22, parent: 0, entryZ: 4 },
      { id: 10, name: tr('Köksüzlerin Çukuru'), x: -33, z: -23, w: 28, d: 22, parent: 1, entryZ: -25 },
      { id: 11, name: tr('Çürümüş Tersane'), x: -32, z: -81, w: 28, d: 20, parent: 3, entryZ: -80 },
      { id: 12, name: tr('Fenersiz Sığınak'), x: -32, z: -140, w: 28, d: 24, parent: 5, entryZ: -139 },
      { id: 13, name: tr('Asılmışlar Tepesi'), x: -64, z: -96, w: 18, d: 18, hill: true },
      { id: 14, name: tr('Kırık Mendirek'), x: 19, z: -86.4, w: 24, d: 12, mole: true },
      { id: 15, name: tr('Sarp Patika'), x: -48, z: -69, w: 12, d: 158, trail: true }
    ];
    var rects = [], blobs = [], circles = [];
    rooms.forEach(function (r) {
      if (r.trail || r.mole) return;
      if (r.hill) { circles.push({ x: r.x, z: r.z, r: 8.4 }); return; }
      blobs.push({ x: r.x, z: r.z, a: r.w / 2, b: r.d / 2 });
      // Wide, funnel-shaped mouths to the main road (the old 6 m doorways read as corridors).
      var main = baseRooms[r.parent], mainEdge = -main.w / 2 + 1.2;
      rects.push({ x0: r.x + r.w / 2 - 5, x1: mainEdge, z0: r.entryZ - 4.3, z1: r.entryZ + 4.3 });
      rects.push({ x0: r.x + r.w / 2 - 3, x1: mainEdge - 1.5, z0: r.entryZ - 6, z1: r.entryZ + 6 });
      // Every yard also opens west onto the cliff trail.
      rects.push({ x0: r.x - r.w / 2 - 6, x1: r.x - r.w / 2 + 4, z0: r.z - 4.5, z1: r.z + 4.5 });
    });
    // Main road: the rooms flow into each other (not 6 m gaps); the boss approach stays narrow for the gate.
    for (var i = 0; i < 5; i++) { var a = baseRooms[i], b = baseRooms[i + 1]; rects.push({ x0: -9.5, x1: 5.5, z0: b.z + b.d / 2 - 1, z1: a.z - a.d / 2 + 1 }); }
    // Gallows hill path (two bends) and the broken mole into the sea with its beacon platform.
    rects.push({ x0: -58, x1: -46, z0: -97.6, z1: -93.6 }); rects.push({ x0: -60.5, x1: -55, z0: -99, z1: -92 });
    rects.push({ x0: 6, x1: 25, z0: -87.9, z1: -84.9 }); rects.push({ x0: 23, x1: 31, z0: -91, z1: -82 });
    function floorTest(x, z, r) {
      r = r || 0;
      for (var i = 0; i < rects.length; i++) { var q = rects[i]; if (x >= q.x0 + r && x <= q.x1 - r && z >= q.z0 + r && z <= q.z1 - r) return true; }
      for (i = 0; i < blobs.length; i++) { var o = blobs[i], dx = Math.abs(x - o.x) / Math.max(.5, o.a - r), dz = Math.abs(z - o.z) / Math.max(.5, o.b - r); if (dx * dx * dx * dx + dz * dz * dz * dz <= 1) return true; }
      for (i = 0; i < circles.length; i++) { var c = circles[i]; if (Math.hypot(x - c.x, z - c.z) <= c.r - r) return true; }
      if (z <= 9 - r && z >= -147 + r && Math.abs(x - trailX(z)) <= 2.9 - r) return true;
      return false;
    }
    // Navigation seeds for the waypoint graph.
    var seeds = [];
    rooms.forEach(function (r) {
      if (r.trail) { for (var z = 6; z >= -144; z -= 6) seeds.push([trailX(z), z]); return; }
      if (r.mole) { [8, 13, 18, 23, 27, 29].forEach(function (x) { seeds.push([x, -86.4]); }); seeds.push([27, -82.5], [27, -90]); return; }
      if (r.hill) { seeds.push([r.x, r.z], [r.x + 4, r.z], [r.x - 4, r.z], [r.x, r.z + 4], [r.x, r.z - 4], [-56, -95.6], [-50, -95.6]); return; }
      [-7, 0, 7].forEach(function (dx) { [-6, 0, 6].forEach(function (dz) { seeds.push([r.x + dx, r.z + dz]); }); });
      seeds.push([r.x + r.w / 2 + 1, r.entryZ], [-10.5, r.entryZ], [r.x - r.w / 2 - 1, r.z]);
    });
    for (i = 0; i < 5; i++) { var za = baseRooms[i].z - baseRooms[i].d / 2 - 2; seeds.push([-6, za], [3, za]); }
    var paths = baseRooms.slice(1, 7).map(function (r, i) { return { a: baseRooms[i], b: r, width: 6.6 }; }).concat(rooms.filter(function (r) { return r.parent != null; }).map(function (r) { return { a: { x: -10, z: r.entryZ }, b: { x: r.x + r.w / 2 - 2, z: r.entryZ }, width: 8.6 }; }));
    return { rooms: rooms, floorTest: floorTest, seeds: seeds, paths: paths };
  }

  /* ---------- encounters for the open areas ---------- */
  function encounters(L, list) {
    L.rooms.forEach(function (r, i) {
      if (r.trail) {
        list.push({ id: 'coast-trail', room: r.id, name: tr('Uçurumdaki Nöbetçiler'), stage: 1.16, clearText: tr('Patika sustu. Kıyı boyunca keşfe devam et.'),
          spawns: [{ type: 'rootborn', x: trailX(-42), z: -42 }, { type: 'crawler', x: trailX(-45) + 1, z: -45 }, { type: 'drowned', x: trailX(-39) - 1, z: -39 }] });
        return;
      }
      if (r.hill) {
        list.push({ id: 'coast-gallows', room: r.id, name: r.name, stage: 1.2, clearText: tr('Darağacı boşaldı. Tepeden kıyı görünüyor.'),
          spawns: [{ type: 'lantern', x: r.x - 3, z: r.z + 3 }, { type: 'rootborn', x: r.x + 3, z: r.z + 2 }, { type: 'urchin', x: r.x, z: r.z - 4 },
            { type: 'drowned', x: r.x + 1, z: r.z + 5, elite: true, name: tr('Asılmışların Bekçisi') }] });
        return;
      }
      if (r.mole) {
        list.push({ id: 'coast-mole', room: r.id, name: r.name, stage: 1.14, clearText: tr('Mendirek temizlendi. Fenerin közü hâlâ yanıyor.'),
          spawns: [{ type: 'drowned', x: 14, z: -86.4 }, { type: 'urchin', x: 26, z: -84 }, { type: 'drowned', x: 28, z: -88.5 }] });
        return;
      }
      var k = i, types = k % 2 ? ['rootborn', 'crawler', 'urchin', 'lantern'] : ['drowned', 'urchin', 'crawler', 'lantern'];
      var elite = r.id === 8 || r.id === 11;
      list.push({ id: 'coast-side-' + r.id, room: r.id, name: r.name, stage: 1.1 + r.parent * .025, clearText: tr('Bu alan sustu. Ana yola geri dön.'),
        spawns: types.concat(types[(k + 1) % 4]).map(function (type, n) { return { type: type, x: r.x + (n === 4 ? 0 : n % 2 ? -3 : 3), z: r.z + (n === 4 ? 0 : n < 2 ? -4 : 4), elite: n === 4 && elite,
          name: n === 4 && elite ? (r.id === 8 ? tr('Köklerin Adsız Bekçisi') : tr('Tuz İçindeki Yeminli')) : undefined }; }) });
    });
  }

  /* ---------- canvas textures ---------- */
  function grassTexture() {
    var c = document.createElement('canvas'); c.width = 128; c.height = 128; var g = c.getContext('2d');
    for (var i = 0; i < 46; i++) {
      var x = 8 + Math.random() * 112, h = 50 + Math.random() * 76, lean = (Math.random() - .5) * 34, w = 1.6 + Math.random() * 2.6;
      var shade = 60 + Math.random() * 60;
      g.strokeStyle = 'rgb(' + (shade * 1.05 | 0) + ',' + (shade * 1.0 | 0) + ',' + (shade * .62 | 0) + ')'; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + lean * .3, 128 - h * .6, x + lean, 128 - h); g.stroke();
    }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function mistTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    for (var i = 0; i < 70; i++) {
      var x = 30 + Math.random() * 196, y = 30 + Math.random() * 196, r = 20 + Math.random() * 46, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    var fade = g.createRadialGradient(128, 128, 60, 128, 128, 128); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(c);
  }

  /* ---------- terrain height field (built once) ---------- */
  function heightField(L) {
    var X0 = -96, X1 = 0, Z0 = -200, Z1 = 24, S = 1, nx = Math.round((X1 - X0) / S) + 1, nz = Math.round((Z1 - Z0) / S) + 1;
    var walk = new Uint8Array(nx * nz), dOut = new Float32Array(nx * nz), dIn = new Float32Array(nx * nz), h = new Float32Array(nx * nz), INF = 1e9;
    for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++) {
      var x = X0 + i * S, z = Z0 + j * S, w = L.mainTest(x, z) || L.floorTest(x, z, 0);
      walk[j * nx + i] = w ? 1 : 0; dOut[j * nx + i] = w ? 0 : INF; dIn[j * nx + i] = w ? INF : 0;
    }
    function chamfer(d) {
      var a = 1, b = 1.414;
      for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++) { var k = j * nx + i, v = d[k];
        if (i > 0) v = Math.min(v, d[k - 1] + a); if (j > 0) v = Math.min(v, d[k - nx] + a); if (i > 0 && j > 0) v = Math.min(v, d[k - nx - 1] + b); if (i < nx - 1 && j > 0) v = Math.min(v, d[k - nx + 1] + b); d[k] = v; }
      for (j = nz - 1; j >= 0; j--) for (i = nx - 1; i >= 0; i--) { k = j * nx + i; v = d[k];
        if (i < nx - 1) v = Math.min(v, d[k + 1] + a); if (j < nz - 1) v = Math.min(v, d[k + nx] + a); if (i < nx - 1 && j < nz - 1) v = Math.min(v, d[k + nx + 1] + b); if (i > 0 && j < nz - 1) v = Math.min(v, d[k + nx - 1] + b); d[k] = v; }
    }
    chamfer(dOut); chamfer(dIn);
    for (j = 0; j < nz; j++) for (i = 0; i < nx; i++) {
      var k = j * nx + i, x = X0 + i * S, z = Z0 + j * S, d = dOut[k] * S;
      if (d <= 0) { h[k] = -.02; continue; }
      var n = .5 + .25 * Math.sin(x * .13 + z * .07) + .17 * Math.sin(x * .31 - z * .23 + 2) + .08 * Math.sin(z * .61 + x * .4);
      // Cliffs read stronger west of the trail; the low banks by the main road stay gentle.
      var westCliff = smooth(-54, -70, x) * 3.2, nearRoad = smooth(-9, -20, x);
      var hh = smooth(0, 1.4, d) * .28 + (1 - Math.exp(-d / 4.2)) * (1.2 + 2.6 * n) * (.45 + .55 * nearRoad) + westCliff * smooth(1, 6, d);
      // Broken terraces: quantise part of the rise into ledges.
      var ledge = Math.floor(hh / .9) * .9; hh = hh * .55 + ledge * .45 + .1 * Math.sin(x * 1.7 + z * 1.3) * smooth(0, 2, d);
      h[k] = hh;
    }
    function at(arr, x, z) {
      var fx = (x - X0) / S, fz = (z - Z0) / S; if (fx < 0 || fz < 0 || fx >= nx - 1 || fz >= nz - 1) return 0;
      var i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * nx + i;
      return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + nx] * (1 - u) + arr[k + nx + 1] * u) * v;
    }
    return { X0: X0, Z0: Z0, S: S, nx: nx, nz: nz, h: h, dOut: dOut, dIn: dIn, walk: walk,
      y: function (x, z) { return Math.max(0, at(h, x, z)); }, inner: function (x, z) { return at(dIn, x, z); }, outer: function (x, z) { return at(dOut, x, z); } };
  }

  /* ---------- dressing ---------- */
  function dress(K, L, H) {
    var add = K.add, beam = K.beam, G = K.G, M = K.materials, rnd = K.rnd, solid = K.collision, geo = K.geo;
    function R(a, b) { return a + rnd() * (b - a); }
    function gy(x, z) { return H.y(x, z); }
    function onGround(room, g, mat, x, y, z, sx, sy, sz, rx, ry, rz) { add(room, g, mat, x, y + gy(x, z), z, sx, sy, sz, rx, ry, rz); }
    function nearestRoom(x, z) { var best = 0, bd = 1e9; K.allRooms().forEach(function (r) { if (r.trail) return; var d = Math.hypot(x - r.x, z - r.z); if (d < bd) { bd = d; best = r.id; } }); return best; }

    // Terrain: one mesh, vertex-tinted (moss in hollows, salt-pale on ridges, dark wet mud by the paths).
    var nx = H.nx, nz = H.nz, pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
    for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++) {
      var k = j * nx + i, x = H.X0 + i * H.S, z = H.Z0 + j * H.S, y = H.h[k], d = H.dOut[k], din = H.dIn[k];
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x * .3; uv[k * 2 + 1] = z * .3;
      var n = .5 + .5 * Math.sin(x * .21 + z * .17) * Math.sin(x * .07 - z * .11), moss = smooth(.4, 3, d) * (1 - smooth(2.5, 5, y)) * n, wet = (1 - smooth(0, 2.2, din)) * (1 - smooth(0, 1, d)) * .6;
      var r0 = .78, g0 = .74, b0 = .66;
      r0 = r0 * (1 - moss * .35) - wet * .2; g0 = g0 * (1 - moss * .12) - wet * .14; b0 = b0 * (1 - moss * .38) - wet * .1;
      var crest = smooth(2.5, 5.5, y) * .2; col[k * 3] = r0 + crest; col[k * 3 + 1] = g0 + crest; col[k * 3 + 2] = b0 + crest * .9;
    }
    for (j = 0; j < nz - 1; j++) for (i = 0; i < nx - 1; i++) {
      var a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
      // Skip quads fully under the main road slabs (x > -11 and walkable): they are never seen.
      if (H.walk[a] && H.walk[b] && H.walk[c] && H.walk[e] && H.X0 + i * H.S > -11.5 && H.X0 + i * H.S < -1) continue;
      idx.push(a, c, b, b, c, e);
    }
    var tg = geo(new T.BufferGeometry()); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('color', new T.BufferAttribute(col, 3)); tg.setAttribute('uv', new T.BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
    M.terrain = M.earth.clone(); M.terrain.vertexColors = true; M.terrain.name = 'coast-terrain'; M.terrain.onBeforeCompile = M.earth.onBeforeCompile; M.terrain.customProgramCacheKey = function () { return 'kara-coast-terrain-1'; };
    var terrain = new T.Mesh(tg, M.terrain); terrain.receiveShadow = true; terrain.castShadow = false; terrain.name = 'coast-open-terrain'; terrain.matrixAutoUpdate = false; K.root.add(terrain);

    // Ridge stones and exposed rock shelves along the slopes (the landscape keeps a hard skeleton).
    for (var q = 0; q < 520; q++) {
      var x = R(-94, -2), z = R(-198, 22), d = H.outer(x, z); if (d < .8 || d > 14) continue;
      var big = d > 4 && rnd() < .35, s = big ? R(1.4, 3.4) : R(.35, 1.2);
      onGround(nearestRoom(x, z), G.rock, 'rock', x, -.15 * s, z, s * R(.8, 1.4), s * R(.45, .9), s * R(.8, 1.3), R(-.2, .2), R(0, 6), R(-.2, .2));
    }

    // Dead grass: one instanced draw, wind sway in the vertex shader, never on the fighting floor.
    var gt = grassTexture(); K.textures.push(gt);
    M.grass = new T.MeshStandardMaterial({ map: gt, alphaTest: .42, side: T.DoubleSide, color: 0x8c8466, roughness: .95 });
    M.grass.onBeforeCompile = function (sh) {
      sh.uniforms.gTime = K.clock;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float gTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat gw=uv.y*uv.y;vec3 gp=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;transformed.x+=gw*(sin(gTime*1.3+gp.x*.4+gp.z*.3)*.10+.05);transformed.z+=gw*sin(gTime*.9+gp.z*.5)*.06;');
    };
    M.grass.customProgramCacheKey = function () { return 'kara-coast-grass-1'; };
    var blade = new T.PlaneGeometry(1, 1, 1, 2); blade.translate(0, .5, 0); var blade2 = blade.clone(); blade2.rotateY(PI / 2); var tuft = geo(B.Gear.merge([blade, blade2]));
    var grassM = [], m4 = new T.Matrix4(), qv = new T.Quaternion(), sv = new T.Vector3(), pv = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    for (q = 0; q < 9000 && grassM.length < 4200; q++) {
      x = R(-94, -1); z = R(-198, 22); d = H.outer(x, z); var di = H.inner(x, z);
      if (d <= 0 && di > 1.3) continue; if (d > 9) continue; if (x > -10 && d <= 0) continue;
      var yy = gy(x, z); if (yy > 4.5) continue;
      var hs = R(.35, .8) * (d > 0 ? 1.15 : .75); pv.set(x, yy - .03, z); qv.setFromAxisAngle(up, R(0, PI)); sv.set(hs * R(.9, 1.5), hs, hs * R(.9, 1.5));
      grassM.push(m4.compose(pv, qv, sv).clone());
    }
    var grass = new T.InstancedMesh(tuft, M.grass, grassM.length); grassM.forEach(function (m, i) { grass.setMatrixAt(i, m); });
    grass.instanceMatrix.needsUpdate = true; grass.castShadow = false; grass.receiveShadow = true; grass.computeBoundingSphere(); grass.name = 'coast-open-grass'; grass.matrixAutoUpdate = false; K.root.add(grass);

    // Forest edge: charred trees on the slopes frame each area and the trail.
    for (q = 0; q < 900; q++) {
      x = R(-94, -12); z = R(-196, 20); d = H.outer(x, z); if (d < 2.2 || d > 18) continue;
      if (rnd() < .45) continue;
      K.tree(nearestRoom(x, z), x, z, R(5, 11), R(.18, .42), R(-1.5, 1.5), gy(x, z) - .2);
    }

    /* ---- trail: cairns, way-shrines, fence, lanterns, bones ---- */
    for (z = 4; z > -146; z -= 7.5) {
      var cx = trailX(z), s = (Math.floor(-z / 7.5) % 2) ? 1 : -1, ex = cx + s * 3.35;
      if (L.floorTest(ex, z, -.2)) continue;
      // broken rope fence on the cliff side
      if (s < 0) { onGround(15, G.cylinder, 'wood', ex, .55, z, .09, 1.1, .09, R(-.1, .1), 0, R(-.12, .12)); beam(15, 'rope', [ex, .85 + gy(ex, z), z], [trailX(z - 3.7) - 3.35, .7 + gy(trailX(z - 3.7) - 3.35, z - 3.7), z - 3.7], .018); }
      else { for (var c2 = 0; c2 < 4; c2++) onGround(15, G.rock, 'rock', ex + R(-.3, .3), .1 + c2 * .28, z + R(-.3, .3), .42 - c2 * .07, .2, .38 - c2 * .06, 0, R(0, 6), 0); }
    }
    [[-20, 'warm'], [-66, 'cold'], [-104, 'cold'], [-131, 'warm']].forEach(function (p, n) {
      var z = p[0], x = trailX(z) + 3.6; if (L.floorTest(x, z, -.3)) x += 1.2;
      onGround(15, G.cylinder, 'rust', x, 1.2, z, .07, 2.4, .07); onGround(15, G.box, 'rust', x - .35, 2.35, z, .8, .06, .06);
      K.lantern(15, x - .7, 2.0 + gy(x, z), z, 'coast', p[1] === 'warm');
    });
    for (q = 0; q < 14; q++) { z = R(-140, 0); x = trailX(z) + R(-2, 2); K.skull(15, x, .09, z, R(0, 6)); add(15, G.cylinder, 'bone', x + R(-.6, .6), .05, z + R(-.6, .6), .04, R(.4, .7), .04, PI / 2, R(0, 6), 0); }
    // Way-shrine: a weathered stone niche with an offering bowl at the trail's mid-point.
    (function () { var z = -46, x = trailX(z) - 4.2; onGround(15, G.masonry, 'stone', x, .9, z, 1.4, 1.8, .9); onGround(15, G.masonry, 'stone', x, 1.95, z, 1.8, .3, 1.2); onGround(15, G.box, 'dark', x + .4, 1.0, z, .2, .9, .6); onGround(15, G.cylinder, 'rust', x + .65, .3, z, .25, .12, .25); onGround(15, G.sphere, 'oath', x + .65, .42, z, .08, .08, .08); })();

    /* ---- 9: ash fishers' houses ---- */
    var r9 = { x: -30, z: 4 };
    K.building(9, -40, 11, 5.4, 6, 3.2, .35); K.building(9, -21, 13.5, 4.6, 5, 2.8, -.12);
    fishRack(9, -38, -3, .2); fishRack(9, -23.5, -3.5, -.3); fishRack(9, -35.5, -6.5, .9);
    K.boat(9, -19.5, 9.2, 5.2, PI / 2 + .3, false, true); K.boat(9, -41.5, 1, 4.6, .4, false, true, true);
    netFrame(9, -26, 11.5, .1); barrels(9, -36, 7.5, 4); barrels(9, -21, -5, 3); campfire(9, -30, -8.5);
    K.corpse(9, -33.5, 9.2, 1.2);

    /* ---- 10: pit of the rootless ---- */
    var r10 = { x: -33, z: -23 };
    for (q = 0; q < 7; q++) { var a = q / 7 * PI * 2 + .3, rx = r10.x + Math.cos(a) * 11.6, rz = r10.z + Math.sin(a) * 9.6; rootArch(10, rx, rz, a); }
    for (q = 0; q < 10; q++) { var a2 = q / 10 * PI * 2, gx = r10.x + Math.cos(a2) * 8.3, gz = r10.z + Math.sin(a2) * 6.6; K.grave(10, gx, gz, -a2 + PI / 2, q % 3 === 0); }
    stump(10, -42, -16.5, 1.25); stump(10, -24, -30, .9);
    for (q = 0; q < 10; q++) K.skull(10, r10.x + R(-9, 9), .1, r10.z + R(-8, 8), R(0, 6));

    /* ---- 7: drowned customs yard with the bell tower (landmark) ---- */
    bellTower(7, -39, -51.5);
    K.building(7, -22, -68.5, 5.2, 5.4, 3.6, -.06);
    for (q = 0; q < 5; q++) { var cx7 = -38 + q * 3.2, cz7 = -67.5; arcadePier(7, cx7, cz7, q === 2); }
    crateStack(7, -20.5, -52, .2); crateStack(7, -24, -50, -.3); barrels(7, -36, -64, 3);
    for (q = 0; q < 5; q++) add(7, G.rock, 'puddle', -30 + R(-8, 8), -.045, -59 + R(-7, 7), R(1, 2.4), .05, R(.8, 1.8), 0, R(0, 6), 0);
    K.corpse(7, -27, -66, .4); K.cargo(7, -36.5, -55, .5);

    /* ---- 11: rotten shipyard with a ship skeleton (landmark) ---- */
    shipSkeleton(11, -36.5, -84.5, .12);
    timberStack(11, -22, -75, .1); timberStack(11, -22.5, -88, -.2); barrels(11, -42, -76, 4);
    crane(11, -24.5, -81.5);
    for (q = 0; q < 4; q++) add(11, G.ring, 'rope', -27 + q * 1.1, .06, -73.5 + (q % 2) * .8, .35, .35, .9, PI / 2, 0, 0);

    /* ---- 8: graveyard of the black tree ---- */
    K.tree(8, -40.5, -104.5, 15, .9, 1.2, 0, true); solid(-40.5, -104.5, 1.6, 1.6);
    for (q = 0; q < 6; q++) { var a3 = q / 6 * PI * 2 + .4; var pts = [[-40.5, .2, -104.5]]; for (var s3 = 1; s3 <= 5; s3++) pts.push([-40.5 + Math.cos(a3) * s3 * 1.9, .1 + Math.sin(s3 * 1.3 + q) * .08, -104.5 + Math.sin(a3) * s3 * 1.6]); add(8, geo(K.rootTube(pts, function (t) { return .02 + .3 * Math.pow(1 - t, 1.2); }, q * 1.9)), 'root', 0, 0, 0, 1, 1, 1); }
    for (var gr = 0; gr < 3; gr++) for (var gc = 0; gc < 5; gc++) { var gx8 = -40 + gc * 3.4, gz8 = -117.5 + gr * 3; if (Math.abs(gx8 - -32) < 4.5 && Math.abs(gz8 - -112) < 4.5) continue; K.grave(8, gx8, gz8, R(-.15, .15), (gr + gc) % 3 === 0); }
    mausoleum(8, -23, -104.5);
    ironFence(8, -44, -120.5, -20, -120.5); ironFence(8, -44, -103, -44, -120.5);

    /* ---- 12: the lightless refuge ---- */
    for (q = 0; q < 26; q++) { var a4 = PI * .5 + q / 25 * PI, px = -32 + Math.cos(a4) * 13.4, pz = -140 + Math.sin(a4) * 11.2; if (Math.abs(pz - -139) < 6.5 && px > -25) continue; if (Math.abs(pz + 140) < 4.4 && px < -40) continue; stake(12, px, pz, a4); }
    K.building(12, -39.5, -131, 4.8, 5.6, 3.1, .25); campfire(12, -27, -133); campfire(12, -38, -147);
    for (q = 0; q < 5; q++) { add(12, G.box, 'cloth', -30 + q * 1.7, .06, -147.5, .9, .1, 2, 0, R(-.3, .3), 0); }
    crateStack(12, -22.5, -146, .4); barrels(12, -43, -138, 3);

    /* ---- 13: gallows hill ---- */
    var hx = -64, hz = -96;
    for (q = 0; q < 9; q++) { var a5 = q / 9 * PI * 2 + .2, mx = hx + Math.cos(a5) * 9.6, mz = hz + Math.sin(a5) * 9.6; if (Math.abs(a5 - PI) < .3 + 0 || (mx > -57 && Math.abs(mz - hz) < 4)) continue; onGround(13, G.masonry, 'stone', mx, 1.5, mz, 1.1, 3.4 + R(-.6, 1.2), .8, R(-.06, .06), -a5, R(-.08, .08)); }
    gallows(13, hx - 1.5, hz - 3);
    for (q = 0; q < 6; q++) K.skull(13, hx + R(-5, 5), .1, hz + R(-5, 5), R(0, 6));
    K.lantern(13, hx + 5.5, 2.3, hz + 4.5, 'coast');

    /* ---- 14: broken mole and the ember beacon (landmark from the pier) ---- */
    for (x = 6.5; x < 31; x += 1.05) { var zl = x > 23 ? -91 : -87.9, zh = x > 23 ? -82 : -84.9; for (var zz = zl + .5; zz < zh; zz += 1.02) add(14, G.plank, 'wood', x, .02, zz, 1.0, .07, .98, 0, R(-.03, .03), R(-.02, .02)); }
    for (x = 7; x < 31; x += 3.1) for (var sd = -1; sd <= 1; sd += 2) { var pzz = x > 23 ? (sd < 0 ? -91.3 : -81.7) : (sd < 0 ? -88.2 : -84.6); add(14, G.cylinder, 'wood', x, -.3, pzz, .17, 2.4, .17, R(-.05, .05), 0, R(-.06, .06)); if (rnd() < .7) beam(14, 'rope', [x, .7, pzz], [x + 3.1, .6, pzz], .02); }
    beacon(14, 29.2, -86.4);
    K.boat(14, 33, -78.5, 6.5, -.9, true); K.boat(14, 16, -96, 5, .4, true);

    /* ---- sea landmarks: hulk of a galleon, sea stacks, a far beacon ---- */
    galleon(1, 37, -28, -.5); galleon(4, 41, -128, .7);
    [[26, 2, 9], [33, -58, 12], [46, -100, 16], [30, -160, 10], [55, -40, 14], [52, -150, 18]].forEach(function (p) {
      var room = nearestMain(p[1]); add(room, G.rock, 'rock', p[0], p[2] * .35 - 1, p[1], p[2] * .28, p[2], p[2] * .3, R(-.08, .08), R(0, 6), R(-.08, .08));
      add(room, G.rock, 'rock', p[0] + 1.6, -.4, p[1] + 1.2, 2.2, 1.4, 1.8, 0, R(0, 6), 0);
    });
    function nearestMain(z) { var b = 0; for (var i = 0; i < 7; i++) if (Math.abs(K.mainRooms[i].z - z) < Math.abs(K.mainRooms[b].z - z)) b = i; return b; }

    /* ---- wisps over the graves, the pit and the trail; low mist banks ---- */
    var wispN = 90, wp = new Float32Array(wispN * 3), wph = new Float32Array(wispN);
    var spots = [[-33, -23, 9], [-32, -112, 9], [-64, -96, 6], [-30, -59, 8], [0, 4, 8], [0, -112, 7]];
    for (q = 0; q < wispN; q++) { var sp = q < 30 ? null : spots[q % spots.length]; if (sp) { wp[q * 3] = sp[0] + R(-sp[2], sp[2]); wp[q * 3 + 2] = sp[1] + R(-sp[2], sp[2]); } else { var tz = R(-144, 6); wp[q * 3] = trailX(tz) + R(-3, 3); wp[q * 3 + 2] = tz; } wp[q * 3 + 1] = R(.5, 2.2); wph[q] = R(0, 6.28); }
    var wg = geo(new T.BufferGeometry()); wg.setAttribute('position', new T.BufferAttribute(wp, 3)); wg.setAttribute('phase', new T.BufferAttribute(wph, 1));
    M.wisp = new T.ShaderMaterial({ uniforms: { time: K.clock }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: 'attribute float phase;uniform float time;varying float vA;void main(){vec3 p=position;p.x+=sin(time*.31+phase*3.)*.9;p.z+=cos(time*.27+phase*2.)*.9;p.y+=sin(time*.8+phase)*.35;vec4 mv=modelViewMatrix*vec4(p,1.);vA=.55+.45*sin(time*1.7+phase*5.);gl_PointSize=clamp(26.*900./max(1.,-mv.z)/40.,2.,40.);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c);float a=exp(-d*28.)*vA+exp(-d*7.)*.18*vA;gl_FragColor=vec4(vec3(.42,.95,.78)*a,a);}' });
    var wisps = new T.Points(wg, M.wisp); wisps.name = 'coast-open-wisps'; wisps.frustumCulled = false; K.root.add(wisps);
    var mt = mistTexture(); K.textures.push(mt);
    M.mist = new T.MeshBasicMaterial({ map: mt, color: 0x8fa9a6, transparent: true, opacity: .55, depthWrite: false, fog: true });
    var mists = [], mistG = geo(new T.PlaneGeometry(1, 1)); mistG.rotateX(-PI / 2);
    [[-33, -23, 18], [-32, -112, 18], [-48, -70, 16], [-48, -10, 14], [-48, -128, 14], [-64, -96, 14], [-30, -59, 16], [-4, -112, 14], [-30, 4, 16], [-32, -140, 16], [-4, -24, 12], [-32, -81, 16]].forEach(function (m, n) {
      for (var l = 0; l < 2; l++) { var me = new T.Mesh(mistG, M.mist); me.position.set(m[0] + l * 3, .35 + l * .45, m[1] - l * 2); me.scale.set(m[2] * (1 - l * .2), 1, m[2] * .8); me.rotation.y = n + l; me.renderOrder = 3; me.name = 'coast-mist'; K.root.add(me); mists.push({ m: me, x: me.position.x, z: me.position.z, p: n * 1.7 + l }); }
    });

    function update(time, p) {
      for (var i = 0; i < mists.length; i++) { var o = mists[i]; o.m.position.x = o.x + Math.sin(time * .05 + o.p) * 2.2; o.m.position.z = o.z + Math.cos(time * .04 + o.p) * 1.6; o.m.rotation.y += .0004; o.m.visible = Math.abs(o.z - p.z) < 46; }
    }
    return { update: update };

    /* ---- prop builders ---- */
    function fishRack(room, x, z, a) {
      var c = Math.cos(a), s = Math.sin(a);
      for (var k = -1; k <= 1; k += 2) { add(room, G.cylinder, 'wood', x + k * 1.6 * c, 1.0, z - k * 1.6 * s, .07, 2, .07, 0, 0, k * .05); }
      beam(room, 'wood', [x - 1.65 * c, 1.85, z + 1.65 * s], [x + 1.65 * c, 1.85, z - 1.65 * s], .045);
      beam(room, 'wood', [x - 1.65 * c, 1.25, z + 1.65 * s], [x + 1.65 * c, 1.25, z - 1.65 * s], .035);
      for (var f = 0; f < 7; f++) { var t = -1.3 + f * .43; add(room, G.sphere, 'flesh', x + t * c, 1.55 - (f % 2) * .55, z - t * s, .07, .22, .03, 0, a, R(-.2, .2)); }
      solid(x, z, 3.4, .6);
    }
    function netFrame(room, x, z, a) {
      add(room, G.cylinder, 'wood', x - 1.5, 1.2, z, .07, 2.4, .07); add(room, G.cylinder, 'wood', x + 1.5, 1.2, z, .07, 2.4, .07);
      beam(room, 'wood', [x - 1.5, 2.3, z], [x + 1.5, 2.3, z], .05);
      add(room, G.box, 'cloth', x, 1.45, z, 2.8, 1.6, .02, R(-.05, .05), a, 0); solid(x, z, 3.3, .5);
    }
    function barrels(room, x, z, n) {
      for (var b = 0; b < n; b++) { var bx = x + (b % 2) * .75 + R(-.1, .1), bz = z + Math.floor(b / 2) * .75; var tip = b === n - 1 && n > 2;
        if (tip) { add(room, G.cylinder, 'wood', bx + .4, .3, bz + .5, .3, .78, .3, PI / 2, R(0, 6), 0); continue; }
        add(room, G.cylinder, 'wood', bx, .4, bz, .32, .8, .32); add(room, G.ring, 'rust', bx, .22, bz, .33, .33, .33, PI / 2); add(room, G.ring, 'rust', bx, .6, bz, .33, .33, .33, PI / 2); }
      solid(x + .35, z + .35, 1.5, 1.6);
    }
    function crateStack(room, x, z, a) {
      for (var b = 0; b < 4; b++) { var cx = x + (b % 2) * .95 * Math.cos(a), cz = z - (b % 2) * .95 * Math.sin(a), cy = b < 2 ? .42 : 1.24; if (b === 3) continue; add(room, G.box, 'wood', cx + (b > 1 ? .45 : 0), cy, cz, .85, .82, .85, 0, a + R(-.1, .1), 0); add(room, G.box, 'rust', cx + (b > 1 ? .45 : 0), cy, cz, .87, .05, .87, 0, a, 0); }
      solid(x + .45, z, 2.1, 1.2);
    }
    function campfire(room, x, z) {
      for (var k = 0; k < 8; k++) { var a = k / 8 * PI * 2; add(room, G.rock, 'rock', x + Math.cos(a) * .62, .08, z + Math.sin(a) * .62, .2, .14, .18, 0, a, 0); }
      for (k = 0; k < 4; k++) { var a2 = k * .8; beam(room, 'char', [x + Math.cos(a2) * .5, .05, z + Math.sin(a2) * .5], [x - Math.cos(a2) * .1, .4, z - Math.sin(a2) * .1], .06); }
      add(room, G.sphere, 'ember', x, .1, z, .38, .1, .38);
      K.lightSources.push({ x: x, y: .9, z: z, color: new T.Color(0xff8a3c), intensity: 3.2, scatter: .5, glowRadius: 1.4, live: 1, group: 'coast', room: room });
      solid(x, z, 1.2, 1.2);
    }
    function rootArch(room, x, z, a) {
      var dx = -Math.cos(a), dz = -Math.sin(a), px = -dz, pz = dx, base = gy(x, z);
      var pts = [[x + px * 2.6, base - .2, z + pz * 2.6], [x + px * 1.6 + dx * 1.2, 2.8, z + pz * 1.6 + dz * 1.2], [x - px * .6 + dx * 2.2, 3.6, z - pz * .6 + dz * 2.2], [x - px * 2.4 + dx * 1.8, 1.4, z - pz * 2.4 + dz * 1.8], [x - px * 3.4 + dx * 2.6, -.1, z - pz * 3.4 + dz * 2.6]];
      add(room, geo(K.rootTube(pts, function (t) { return .06 + .34 * Math.sin(PI * (.15 + t * .7)) * (1 - t * .4); }, a * 3)), 'root', 0, 0, 0, 1, 1, 1);
      var end = pts[4]; if (L.floorTest(end[0], end[2], -.3)) solid(end[0], end[2], .9, .9);
    }
    function stump(room, x, z, r) {
      add(room, G.branch, 'char', x, .7 * r, z, r, 1.4 * r, r, 0, R(0, 6), 0);
      for (var k = 0; k < 5; k++) { var a = k / 5 * PI * 2 + R(-.2, .2); beam(room, 'char', [x + Math.cos(a) * r * .6, .4 * r, z + Math.sin(a) * r * .6], [x + Math.cos(a) * r * 2.1, -.05, z + Math.sin(a) * r * 2.1], .22 * r); }
      solid(x, z, r * 1.9, r * 1.9);
    }
    function bellTower(room, x, z) {
      var W = 3.6, Hh = 13;
      for (var lvl = 0; lvl < 9; lvl++) { var y = lvl * 1.25 + .62, inset = lvl * .03;
        for (var sd = 0; sd < 4; sd++) { var a = sd * PI / 2, ox = Math.sin(a) * (W / 2 - inset), oz = Math.cos(a) * (W / 2 - inset);
          var gap = lvl === 7 || lvl === 8; if (gap && sd % 2 === 0) { add(room, G.masonry, 'wall', x + ox + Math.cos(a) * 1.35, y, z + oz - Math.sin(a) * 1.35, .9, 1.25, .5, 0, a, 0); add(room, G.masonry, 'wall', x + ox - Math.cos(a) * 1.35, y, z + oz + Math.sin(a) * 1.35, .9, 1.25, .5, 0, a, 0); continue; }
          if (lvl === 0 && sd === 1) { add(room, G.masonry, 'wall', x + ox + Math.cos(a) * 1.3, y, z + oz - Math.sin(a) * 1.3, 1.0, 1.25, .5, 0, a, 0); add(room, G.masonry, 'wall', x + ox - Math.cos(a) * 1.3, y, z + oz + Math.sin(a) * 1.3, 1.0, 1.25, .5, 0, a, 0); continue; }
          add(room, G.masonry, 'wall', x + ox, y, z + oz, W - inset * 2, 1.25, .5, 0, a, (lvl % 3 - 1) * .006);
        }
        if (lvl % 3 === 2) add(room, G.masonry, 'stone', x, y + .62, z, W + .35, .2, W + .35);
      }
      for (var c = 0; c < 4; c++) { var a2 = c * PI / 2 + PI / 4; add(room, G.masonry, 'stone', x + Math.sin(a2) * W * .7, Hh * .5 - .5, z + Math.cos(a2) * W * .7, .7, Hh - 1, .7, 0, a2, 0); }
      for (var k = 0; k < 10; k++) add(room, G.archStone, 'stone', x, 9.8, z + W / 2, 1.2, 1.2, 1.3, 0, 0, k * PI / 10);
      // broken roof: charred rafters and a few slates, the bell still hanging
      for (k = 0; k < 6; k++) beam(room, 'char', [x - W / 2 + k * .7, 11.5, z - W / 2], [x - W / 2 + k * .7 + R(-.3, .3), 13.6 - (k % 3) * .7, z + R(-.4, .3)], .07);
      add(room, G.masonry, 'stone', x, 11.35, z, W + .5, .28, W + .5);
      add(room, G.cone, 'rust', x, 9.5, z, 1.05, 1.5, 1.05); add(room, G.ring, 'gold', x, 8.8, z, 1.0, 1.0, 1.0, PI / 2); add(room, G.cylinder, 'char', x, 10.5, z, .1, .9, .1);
      beam(room, 'wood', [x - W / 2, 10.3, z], [x + W / 2, 10.3, z], .14);
      for (k = 0; k < 7; k++) add(room, G.masonry, 'stone', x + R(-3, 3), .18, z + R(1.5, 4), R(.3, .7), R(.2, .4), R(.3, .6), R(-.3, .3), R(0, 6), 0);
      K.lightSources.push({ x: x, y: 9.6, z: z, color: new T.Color(0x8fc9b8), intensity: 1.6, scatter: 1, glowRadius: 2.2, live: 1, group: 'coast', room: room });
      solid(x, z, W + .6, W + .6);
    }
    function arcadePier(room, x, z, broken) {
      add(room, G.masonry, 'stone', x, .15, z, 1.1, .3, 1.1);
      var h = broken ? 1.6 : 3.4; add(room, G.masonry, 'wall', x, .3 + h / 2, z, .72, h, .72, 0, 0, broken ? .08 : 0);
      if (!broken) { add(room, G.masonry, 'stone', x, 3.85, z, 1.0, .25, 1.0); if (x < -27) for (var k = 0; k < 10; k++) add(room, G.archStone, 'stone', x + 1.6, 3.95, z, 1.6, 1.6, .9, 0, 0, k * PI / 10); }
      else add(room, G.masonry, 'wall', x + .9, .25, z + .7, .7, .5, 1.6, 0, .6, PI / 2 - .2);
      solid(x, z, 1.0, 1.0);
    }
    function shipSkeleton(room, x, z, a) {
      var len = 13, c = Math.cos(a), s = Math.sin(a);
      // slipway rails
      for (var sd = -1; sd <= 1; sd += 2) add(room, G.box, 'wood', x + sd * 1.6 * s, .08, z + sd * 1.6 * c, .3, .16, len + 4, 0, a + PI / 2, 0);
      beam(room, 'wood', [x - len / 2 * c, .5, z + len / 2 * s], [x + len / 2 * c, .5, z - len / 2 * s], .22);
      var ribs = [];
      for (var k = 0; k < 12; k++) { var t = k / 11 - .5, w = 2.6 * Math.pow(Math.cos(t * 2.8), .6) + .3, px = x + t * len * c, pz = z - t * len * s;
        var rib = new T.TorusGeometry(w, .1, 5, 14, PI * (k === 4 || k === 9 ? .62 : 1)); rib.rotateZ(PI); rib.scale(1, 1.25, 1); rib.rotateY(a + PI / 2); rib.translate(px, w * 1.25 + .5, pz); ribs.push(rib); }
      add(room, geo(B.Gear.merge(ribs)), 'char', 0, 0, 0, 1, 1, 1);
      // stem post and a fallen strake
      beam(room, 'char', [x + len / 2 * c, .4, z - len / 2 * s], [x + (len / 2 + 1.2) * c, 5.2, z - (len / 2 + 1.2) * s], .16);
      add(room, G.plank, 'wood', x - 2 * c, .2, z + 3.4, 6, .1, .3, 0, a + .3, .2);
      // scaffold
      for (k = -1; k <= 1; k += 2) { add(room, G.cylinder, 'wood', x + k * 3 * c + 3.4 * s, 2.2, z - k * 3 * s + 3.4 * c, .1, 4.4, .1); add(room, G.cylinder, 'wood', x + k * 3 * c - 3.4 * s, 2.2, z - k * 3 * s - 3.4 * c, .1, 4.4, .1); }
      beam(room, 'wood', [x - 3 * c + 3.4 * s, 4.2, z + 3 * s + 3.4 * c], [x + 3 * c + 3.4 * s, 4.2, z - 3 * s + 3.4 * c], .08);
      solid(x, z, 13.4 * Math.abs(c) + 3.6 * Math.abs(s), 3.6 * Math.abs(c) + 13.4 * Math.abs(s));
    }
    function timberStack(room, x, z, a) {
      for (var k = 0; k < 9; k++) { var row = Math.floor(k / 3), col = k % 3 - 1 + row * .5; if (col > 1.2) continue; add(room, G.cylinder, 'wood', x + col * .42 * Math.sin(a), .2 + row * .36, z + col * .42 * Math.cos(a), .2, 4.2, .2, PI / 2, a + PI / 2, 0); }
      solid(x, z, 4.4 * Math.abs(Math.cos(a)) + 1.4, 4.4 * Math.abs(Math.sin(a)) + 1.4);
    }
    function crane(room, x, z) {
      add(room, G.cylinder, 'wood', x, 3, z, .22, 6, .22); beam(room, 'wood', [x, 5.6, z], [x - 4.6, 6.4, z - .4], .12); beam(room, 'wood', [x, 3.5, z], [x - 2.4, 6.0, z - .2], .07);
      beam(room, 'rope', [x - 4.4, 6.3, z - .4], [x - 4.4, 2.2, z - .4], .02); add(room, G.box, 'rust', x - 4.4, 2.0, z - .4, .5, .4, .5);
      for (var k = 0; k < 3; k++) { var a = k * 2.1; beam(room, 'wood', [x, 1.6, z], [x + Math.cos(a) * 1.4, 0, z + Math.sin(a) * 1.4], .08); }
      solid(x, z, 1.4, 1.4);
    }
    function mausoleum(room, x, z) {
      add(room, G.masonry, 'stone', x, .2, z, 4.6, .4, 5.2); add(room, G.masonry, 'stone', x, .5, z, 4.0, .25, 4.6);
      add(room, G.masonry, 'wall', x + .3, 2.0, z, 3.0, 2.8, 4.0);
      for (var k = -1; k <= 1; k += 2) { add(room, G.cylinder, 'stone', x - 1.6, 1.9, z + k * 1.5, .22, 2.8, .22); add(room, G.masonry, 'stone', x - 1.6, 3.4, z + k * 1.5, .5, .2, .5); }
      add(room, G.masonry, 'stone', x, 3.55, z, 4.2, .3, 4.8);
      add(room, G.cone, 'stone', x, 4.6, z, 3.1, 1.9, 3.6, 0, PI / 4, 0);
      add(room, G.box, 'dark', x - 1.21, 1.6, z, .1, 2.0, 1.2); add(room, G.plank, 'rust', x - 1.4, 1.5, z + .35, .06, 1.9, .55, 0, .5, 0);
      add(room, G.headstone, 'stone', x, 3.7, z - 2.42, 1.6, 1.2, 1); add(room, G.cone, 'gold', x, 6.0, z, .12, .5, .12);
      solid(x, z, 4.6, 5.2);
    }
    function ironFence(room, x0, z0, x1, z1) {
      var len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / .42);
      for (var k = 0; k <= n; k++) { var t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (k % 9 === 4) continue; var lean = Math.sin(k * 1.7) * .12; add(room, G.cylinder, 'rust', x, .7, z, .025, 1.4, .025, lean, 0, Math.cos(k * 2.1) * .1); add(room, G.cone, 'rust', x, 1.47, z, .045, .14, .045, lean, 0, 0); }
      beam(room, 'rust', [x0, 1.15, z0], [x1, 1.15, z1], .025); beam(room, 'rust', [x0, .3, z0], [x1, .3, z1], .025);
    }
    function stake(room, x, z, a) {
      var h = R(1.6, 2.6), y0 = gy(x, z); add(room, G.cylinder, 'char', x, y0 + h / 2, z, .13, h, .13, R(-.12, .12), 0, R(-.12, .12)); add(room, G.cone, 'wood', x, y0 + h + .2, z, .13, .4, .13);
      if (L.floorTest(x, z, -.4)) solid(x, z, .5, .5);
    }
    function gallows(room, x, z) {
      add(room, G.masonry, 'stone', x, .25, z, 4.8, .5, 2.6);
      for (var k = 0; k < 3; k++) add(room, G.box, 'wood', x + 1.4 + k * .25, .1 + k * .1, z + 1.6 + k * .3, 1.4, .2, .3);
      add(room, G.cylinder, 'char', x - 2, 2.6, z, .18, 4.6, .18); add(room, G.cylinder, 'char', x + 2, 2.6, z, .18, 4.6, .18);
      beam(room, 'char', [x - 2.2, 4.8, z], [x + 2.2, 4.8, z], .17); beam(room, 'char', [x - 2, 3.4, z], [x - .8, 4.75, z], .09);
      for (k = 0; k < 3; k++) { var hx = x - 1 + k * 1.1, len = 1.1 + (k % 2) * .4; beam(room, 'rope', [hx, 4.75, z], [hx, 4.75 - len, z], .025); add(room, G.ring, 'rope', hx, 4.6 - len, z, .14, .14, .14, PI / 2); }
      // a gibbet cage with remains
      var gx = x + 1.1, gyy = 2.4; for (k = 0; k < 8; k++) { var a = k / 8 * PI * 2; add(room, G.cylinder, 'rust', gx + Math.cos(a) * .35, gyy, z + Math.sin(a) * .35, .02, 1.5, .02); }
      add(room, G.ring, 'rust', gx, gyy + .75, z, .36, .36, .36, PI / 2); add(room, G.ring, 'rust', gx, gyy - .75, z, .36, .36, .36, PI / 2); K.skull(room, gx, gyy - .55, z, 1.2);
      solid(x, z, 4.8, 2.6);
    }
    function beacon(room, x, z) {
      add(room, G.cylinder, 'stone', x, .3, z, 2.0, .6, 2.0);
      for (var k = 0; k < 6; k++) add(room, G.cylinder, 'wall', x, .9 + k * 1.1, z, 1.25 - k * .07, 1.1, 1.25 - k * .07, 0, k * .4, 0);
      add(room, G.cylinder, 'stone', x, 7.6, z, 1.35, .3, 1.35);
      for (k = 0; k < 6; k++) { var a = k / 6 * PI * 2; add(room, G.cylinder, 'rust', x + Math.cos(a) * 1.05, 8.3, z + Math.sin(a) * 1.05, .04, 1.3, .04); }
      add(room, G.cylinder, 'rust', x, 7.95, z, .8, .3, .8); add(room, G.sphere, 'ember', x, 8.3, z, .6, .45, .6);
      add(room, G.cone, 'rust', x, 9.35, z, 1.4, .9, 1.4);
      for (k = 0; k < 9; k++) add(room, G.rock, 'rock', x + R(-2.6, 2.6), -.3, z + R(-2.6, 2.6), R(.6, 1.3), R(.5, .9), R(.6, 1.2), 0, R(0, 6), 0);
      K.lightSources.push({ x: x, y: 8.6, z: z, color: new T.Color(0xff9348), intensity: 4.2, scatter: 1.2, glowRadius: 3, live: 1, group: 'coast', room: room });
      solid(x, z, 2.6, 2.6);
    }
    function galleon(room, x, z, a) {
      K.boat(room, x, z, 20, a, true, false, false, true);
      add(room, G.cylinder, 'char', x + Math.cos(a) * 2, 5, z - Math.sin(a) * 2, .28, 13, .28, .15, 0, .22);
      add(room, G.cylinder, 'char', x - Math.cos(a) * 5, 3.4, z + Math.sin(a) * 5, .22, 8, .22, -.2, 0, -.35);
      beam(room, 'char', [x + Math.cos(a) * 1, 9.5, z], [x + Math.cos(a) * 5, 8.9, z - 1.2], .1);
      beam(room, 'rope', [x + Math.cos(a) * 2.6, 11, z - Math.sin(a) * 2], [x + Math.cos(a) * 9.5, 1.0, z - Math.sin(a) * 9.5], .03);
    }
  }
  B.CoastOpen = { layout: layout, encounters: encounters, heightField: heightField, dress: dress, trailX: trailX };
}());
