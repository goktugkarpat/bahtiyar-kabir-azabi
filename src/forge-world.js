/* The forge shares only the prepared geometry/navigation machinery, with its own art, cast and story.
   world-b: the open foundry wings (forge-rooms.js WINGS) are walkable halls beside the chain of rooms, reached through side doors.
   Navigation is rebuilt here over the same floors + the wings, with the wall runs at each door split around the opening. */
(function () {
  'use strict';
  var B = window.BABA;
  function build(scene, options) {
    var w = B.RuinsWorld.build(scene, Object.assign({}, options, { chapter: 4 }));
    var FR = B.ForgeRooms, WINGS = FR.wings || [], DOORS = FR.doors || {}, HW = FR.doorHalf || 2.2, GH = FR.gateHalf || 3.5;
    if (!WINGS.length) return w;
    var rooms = w.rooms.slice(0, 14), floors = [];
    rooms.forEach(function (r, i) {
      floors.push({ x: r.x, z: r.z, w: r.w, d: r.d });
      if (i < rooms.length - 1) { var n = rooms[i + 1], a = r.z - r.d / 2, b = n.z + n.d / 2; floors.push({ x: 0, z: (a + b) / 2, w: GH * 2, d: a - b + .08 }); }
    });
    var wingRooms = WINGS.map(function (W) { return { id: W.id, name: KabirI18n.t(W.name), x: W.x, z: W.z, w: W.w, d: W.d, wing: true }; });
    WINGS.forEach(function (W) { floors.push({ x: W.x, z: W.z, w: W.w, d: W.d }); });
    // door causeways: from inside the room wall to the wing's inner edge
    Object.keys(DOORS).forEach(function (k) {
      var r = rooms[+k], s = DOORS[k], wallX = r.x + s * r.w / 2, xi = s * 21, x0 = Math.min(wallX - s * 1.2, xi + s * .6), x1 = Math.max(wallX - s * 1.2, xi + s * .6);
      floors.push({ x: (x0 + x1) / 2, z: r.z, w: x1 - x0, d: HW * 2 });
    });
    // the long wall colliders at each door are split around the opening
    var colliders = [];
    w.colliders.forEach(function (c) {
      if (GH > 3.5 && Math.abs(Math.abs(c.x) - 3.8) < .05 && Math.abs(c.w - .65) < .05) return;   // old 7 m corridor curbs: the gates are wider now
      for (var k in DOORS) {
        var r = rooms[+k], s = DOORS[k];
        if (Math.abs(c.x - (r.x + s * r.w / 2)) < .05 && Math.abs(c.z - r.z) < .05 && c.d >= r.d - .5 && c.w < 1.2) {
          var seg = c.d / 2 - HW;
          colliders.push({ x: c.x, z: r.z - HW - seg / 2, w: c.w, d: seg }, { x: c.x, z: r.z + HW + seg / 2, w: c.w, d: seg });
          return;
        }
      }
      colliders.push(c);
    });
    var grid = new Map(), cell = 8, lastF = 0, nf = floors.length;
    colliders.forEach(function (c) { c.x0 = c.x - c.w / 2; c.x1 = c.x + c.w / 2; c.z0 = c.z - c.d / 2; c.z1 = c.z + c.d / 2; for (var x = Math.floor(c.x0 / cell); x <= Math.floor(c.x1 / cell); x++) for (var z = Math.floor(c.z0 / cell); z <= Math.floor(c.z1 / cell); z++) { var key = x * 4096 + z, l = grid.get(key); if (!l) grid.set(key, l = []); l.push(c); } });
    function isWalkable(x, z, r) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false; r = r == null ? .46 : Math.max(.01, r);
      var f = floors[lastF];
      if (!(Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2)) { var hit = -1; for (var i = 0; i < nf; i++) { f = floors[i]; if (Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2) { hit = i; break; } } if (hit < 0) return false; lastF = hit; }
      var rr = r * r - 1e-6, g1 = Math.floor((x + r) / cell), h1 = Math.floor((z + r) / cell), h0 = Math.floor((z - r) / cell);
      for (var gx = Math.floor((x - r) / cell); gx <= g1; gx++) for (var gz = h0; gz <= h1; gz++) { var list = grid.get(gx * 4096 + gz); if (!list) continue; for (var j = 0; j < list.length; j++) { var c = list[j], dx = x - (x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x), dz = z - (z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z); if (dx * dx + dz * dz < rr) return false; } }
      return true;
    }
    function move(p, dx, dz, r) { if (!Number.isFinite(dx) || !Number.isFinite(dz)) return p; var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .18)), sx = dx / n, sz = dz / n; for (var i = 0; i < n; i++) { if (isWalkable(p.x + sx, p.z + sz, r)) { p.x += sx; p.z += sz; } else { if (isWalkable(p.x + sx, p.z, r)) p.x += sx; if (isWalkable(p.x, p.z + sz, r)) p.z += sz; } } return p; }
    function hasClearPath(ax, az, bx, bz, r) { var n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / .3)); for (var i = 0; i <= n; i++) if (!isWalkable(ax + (bx - ax) * i / n, az + (bz - az) * i / n, r)) return false; return true; }
    var nodes = [];
    function seed(x, z) { if (isWalkable(x, z, 1.05)) nodes.push({ x: x, z: z, edges: [] }); }
    rooms.forEach(function (r) { [-6, 0, 6].forEach(function (x) { [-7, 0, 7].forEach(function (z) { seed(x, r.z + z); }); }); });
    WINGS.forEach(function (W) { for (var z = W.z1 - 3; z > W.z0; z -= 6) [3.5, 8.5, 13.5].forEach(function (t) { seed(W.side * (21 + t), z); }); });
    WINGS.forEach(function (W) { if (W.kind !== 'river') return; W.hosts.forEach(function (h) { var r = rooms[h], rz = r.z + (h % 2 ? 4 : -4), bx = W.side * (21 + (h % 2 ? 6 : 12)); seed(bx, rz - 2.8); seed(bx, rz); seed(bx, rz + 2.8); }); });
    Object.keys(DOORS).forEach(function (k) { var r = rooms[+k], s = DOORS[k], wallX = r.x + s * r.w / 2; seed(wallX - s * 3, r.z); seed(wallX + s * .8, r.z); seed(s * 22.5, r.z); seed((wallX + s * 21) / 2, r.z); });
    for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) < 30 && hasClearPath(nodes[i].x, nodes[i].z, nodes[j].x, nodes[j].z, 1.05)) { nodes[i].edges.push(j); nodes[j].edges.push(i); }
    var dist = new Float64Array(nodes.length), prev = new Int16Array(nodes.length), used = new Uint8Array(nodes.length);
    function pathTo(from, to, r) {
      if (!isWalkable(to.x, to.z, r)) return []; if (hasClearPath(from.x, from.z, to.x, to.z, r)) return [{ x: to.x, z: to.z }];
      dist.fill(Infinity); prev.fill(-1); used.fill(0);
      for (var i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].x - from.x, nodes[i].z - from.z) < 24 && hasClearPath(from.x, from.z, nodes[i].x, nodes[i].z, r)) dist[i] = Math.hypot(nodes[i].x - from.x, nodes[i].z - from.z);
      var end = -1; for (var k = 0; k < nodes.length; k++) { var at = -1, best = Infinity; for (i = 0; i < nodes.length; i++) if (!used[i] && dist[i] < best) { best = dist[i]; at = i; } if (at < 0) break; used[at] = 1; var n = nodes[at]; if (Math.hypot(to.x - n.x, to.z - n.z) < 24 && hasClearPath(n.x, n.z, to.x, to.z, r)) { end = at; break; } for (var j = 0; j < n.edges.length; j++) { var id = n.edges[j], next = nodes[id], cost = best + Math.hypot(next.x - n.x, next.z - n.z); if (cost < dist[id]) { dist[id] = cost; prev[id] = at; } } }
      if (end < 0) return []; var path = [{ x: to.x, z: to.z }]; for (var at2 = end, guard = 0; at2 >= 0 && guard++ < nodes.length; at2 = prev[at2]) path.unshift({ x: nodes[at2].x, z: nodes[at2].z }); return path;
    }
    var baseRoomAt = w.roomAt;
    function roomAt(x, z) { for (var i = 0; i < wingRooms.length; i++) { var r = wingRooms[i]; if (Math.abs(x - r.x) <= r.w / 2 + .5 && Math.abs(z - r.z) <= r.d / 2) return r; } return baseRoomAt(x, z); }
    // one fight per wing, in its middle hall
    var types = [['slagcrawler', 'emberbound', 'chainseer', 'emberbound'], ['forgesentinel', 'emberbound', 'slagcrawler', 'chainseer'], ['slagcrawler', 'chainseer', 'emberbound', 'forgesentinel'], ['emberbound', 'forgesentinel', 'slagcrawler', 'chainseer']];
    WINGS.forEach(function (W, n) {
      var host = rooms[W.hosts[1]], zc = host.z, cx = W.side * 30, list = types[n].map(function (t, k) { return { type: t, x: cx + (k % 2 ? -3 : 3), z: zc + (k < 2 ? -3.5 : 3.5) }; });
      list = list.filter(function (s) { return isWalkable(s.x, s.z, .6); });
      if (n === 1 || n === 3) list.push({ type: 'ashwarden', x: cx, z: zc + 9, elite: true, name: KabirI18n.t(n === 1 ? 'Körüklerin Bekçisi' : 'Hurdanın Efendisi') });
      list = list.filter(function (s) { return isWalkable(s.x, s.z, .6); });
      if (list.length) w.encounters.push({ id: 'forge-wing-' + W.id, room: W.id, name: KabirI18n.t(W.name), clearText: KabirI18n.t('Dökümhanenin bu kanadı sustu. Ana yola dön.'), stage: 1.1 + W.hosts[1] * .016, spawns: list });
    });
    var sites = {}; [['c4.page1', -30, -10], ['c4.page2', 31, -152], ['c4.page3', -26, -210], ['c4.altar', -35, -230], ['c4.chest', 33, -262], ['c4.hunt', 28, -100], ['c4.siege', 27, -121], ['c4.hunt2', -27, -182], ['c4.escape', -31, -63], ['c4.escape-goal', 2, -116], ['c4.captive', -27, -72]].forEach(function (q) { for (var k = 0; k < 60; k++) { var a = k * 2.4, d = k ? .45 * Math.sqrt(k) : 0, x = q[1] + Math.cos(a) * d, z = q[2] + Math.sin(a) * d; if (isWalkable(x, z, 1.3) && pathTo({ x: 0, z: 12 }, { x: x, z: z }, .5).length) { sites[q[0]] = { x: x, z: z }; break; } } });
    w.questSites = Object.assign(w.questSites || {}, sites);
    /* ---- living foundry set pieces (few meshes, animated here): a travelling casting ladle that stops and pours, spark showers,
       and the great bellows' breathing furnace glow. Own resources only; disposed with the world. ---- */
    var T = window.THREE, own = [], live = [], fxRoot = new T.Group(); fxRoot.name = 'forge-setpieces'; w.root.add(fxRoot);
    var ironM = new T.MeshStandardMaterial({ color: 0x4e423c, roughness: .5, metalness: .75, emissive: 0x1a0702, emissiveIntensity: 1 }), hotM = new T.MeshBasicMaterial({ color: 0xc8380a, toneMapped: false, fog: false }), glowTex = (function () { var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })(),
      glowM = new T.MeshBasicMaterial({ map: glowTex, color: 0xe04a10, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide });
    own.push(ironM, hotM, glowM, glowTex);
    var cyl = new T.CylinderGeometry(1, .82, 1, 16, 1, true), disc = new T.CircleGeometry(1, 16), rodG = new T.CylinderGeometry(1, 1, 1, 6), plane = new T.PlaneGeometry(1, 1); disc.rotateX(-Math.PI / 2); plane.rotateX(-Math.PI / 2); own.push(cyl, disc, rodG, plane);
    var SPN = 140, spPos = new Float32Array(SPN * 3), spSeed = new Float32Array(SPN);
    for (var q = 0; q < SPN; q++) { spPos[q * 3] = (Math.random() - .5) * 1.4; spPos[q * 3 + 1] = 0; spPos[q * 3 + 2] = (Math.random() - .5) * 1.4; spSeed[q] = Math.random(); }
    var spG = new T.BufferGeometry(); spG.setAttribute('position', new T.BufferAttribute(spPos, 3)); spG.setAttribute('seed', new T.BufferAttribute(spSeed, 1)); own.push(spG);
    var spM = new T.ShaderMaterial({ uniforms: { t: { value: 0 }, gain: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: 'attribute float seed;uniform float t;uniform float gain;varying float vA;void main(){float k=fract(t*.9+seed);vec3 p=position*(1.+k*3.);p.y=k*(2.6+seed*1.5)-k*k*4.6;p.x+=sin(seed*40.)*k*1.8;p.z+=cos(seed*31.)*k*1.8;vA=(1.-k)*gain;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(90./max(1.,-mv.z),1.5,6.);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){vec2 c=gl_PointCoord-.5;float a=exp(-dot(c,c)*20.)*vA;gl_FragColor=vec4(vec3(1.,.55,.18)*a,a);}' }); own.push(spM);
    WINGS.forEach(function (W) {
      if (W.kind !== 'slag' && W.kind !== 'river') return;
      var g = new T.Group(), ladle = new T.Group(), x = W.side * 30.5;
      var shell = new T.Mesh(cyl, ironM); shell.scale.set(1.1, 1.2, 1.1); ladle.add(shell);
      var bottom = new T.Mesh(disc, ironM); bottom.position.y = -.6; bottom.rotation.x = Math.PI; bottom.scale.setScalar(.9); ladle.add(bottom);
      var meltM = new T.MeshBasicMaterial({ color: 0x9a2406, toneMapped: false, fog: false }); own.push(meltM); var melt = new T.Mesh(disc, meltM); melt.position.y = .45; melt.scale.setScalar(1.0); ladle.add(melt);
      [-1, 1].forEach(function (s2) { var r = new T.Mesh(rodG, ironM); r.scale.set(.05, 2.6, .05); r.position.set(s2 * 1.05, 1.6, 0); r.rotation.z = -s2 * .38; ladle.add(r); });
      var hook = new T.Mesh(rodG, ironM); hook.scale.set(.06, 7, .06); hook.position.y = 4.1; ladle.add(hook);
      var streamM = new T.MeshBasicMaterial({ color: 0xd8480e, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }); own.push(streamM); var stream = new T.Mesh(rodG, streamM); stream.scale.set(.16, 1, .16); g.add(stream);
      var splash = new T.Mesh(plane, glowM); splash.scale.set(3, 1, 3); splash.position.y = .12; g.add(splash);
      var sparks = new T.Points(spG, spM); sparks.frustumCulled = false; g.add(sparks);
      var beam = new T.Mesh(rodG, ironM); beam.scale.set(.18, W.d - 8, .18); beam.rotation.x = Math.PI / 2; beam.position.set(x + W.side * 2.5, 13.7, W.z); g.add(beam);
      g.add(ladle); fxRoot.add(g);
      live.push({ kind: 'ladle', W: W, g: g, ladle: ladle, stream: stream, splash: splash, sparks: sparks, x: x, z0: W.z0 + 6, z1: W.z1 - 6, phase: W.id * 1.7 });
    });
    WINGS.forEach(function (W) {
      if (W.kind !== 'bellows') return;
      W.hosts.forEach(function (h) { var r = rooms[h]; [-1, 1].forEach(function (q2) {
        var k = (h === W.hosts[1] && q2 > 0) ? .95 : .75, gx = W.side * (21 + 14.2) + W.side * 1.4 * k, gz = r.z + q2 * 6.5;
        var m = new T.Mesh(plane, glowM.clone()); own.push(m.material); m.position.set(gx, .14, gz); m.scale.set(4 * k, 1, 3.4 * k); fxRoot.add(m);
        live.push({ kind: 'breath', m: m, x: gx, z: gz, phase: h + q2 * .8 });
      }); });
    });
    // Giant foundry gates closing the far ends of the slag field and the scrap graveyard (one merged mesh each, seam glow apart).
    [[WINGS[0], WINGS[0].z0 - .9], [WINGS[3], WINGS[3].z0 - .9]].forEach(function (gz) {
      var W = gz[0], z = gz[1], cx = W.x, parts = [], box = function (x, y, zz, sx, sy, sz, ry) { var b = new T.BoxGeometry(sx, sy, sz); if (ry) b.rotateY(ry); b.translate(x, y, zz); parts.push(b); };
      box(cx - 8.6, 6, z, 1.8, 12, 1.8); box(cx + 8.6, 6, z, 1.8, 12, 1.8); box(cx, 12.6, z, 19.6, 1.6, 2.2); box(cx, 11.4, z, 16, .5, 1.6);
      box(cx - 4.1, 5, z + .4, 7.6, 10, .35, .18); box(cx + 4.4, 5, z - .3, 7.6, 10, .35, -.42);   // the two leaves, one ajar
      for (var r = 0; r < 5; r++) { box(cx - 4.1, 1.2 + r * 2, z + .62, 7.4, .22, .12, .18); box(cx + 4.4, 1.2 + r * 2, z - .52, 7.4, .22, .12, -.42); }
      for (var p2 = -1; p2 <= 1; p2 += 2) for (var b2 = 0; b2 < 5; b2++) box(cx + p2 * 8.6, 1 + b2 * 2.4, z, 2.1, .3, 2.1);
      var gm = new T.Mesh(B.Gear.merge(parts), ironM); gm.name = 'forge-great-gate'; own.push(gm.geometry); fxRoot.add(gm);
      var seam = new T.Mesh(new T.BoxGeometry(.14, 9.6, .5), hotM); seam.position.set(cx + .2, 5, z); seam.rotation.y = -.1; own.push(seam.geometry); fxRoot.add(seam);
      var back = new T.Mesh(new T.PlaneGeometry(22, 15), new T.MeshBasicMaterial({ map: glowTex, color: 0xd04010, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); back.position.set(cx, 6.5, z - 1.6); own.push(back.geometry, back.material); fxRoot.add(back);
      live.push({ kind: 'gate', m: gm, seam: seam, back: back, z: z });
    });
    // Hanging chains that sway over the wings (instanced links, updated only near the hero).
    var linkG = new T.TorusGeometry(.12, .035, 5, 10), chainSpots = []; own.push(linkG);
    WINGS.forEach(function (W) { for (var c2 = 0; c2 < 3; c2++) chainSpots.push({ x: W.side * (21 + 5 + c2 * 4.5), z: W.z + (c2 - 1) * 18, top: 10, n: 14 + c2 * 3, ph: W.id + c2 * 1.3 }); });
    var LINKS = chainSpots.reduce(function (s, c) { return s + c.n; }, 0), chains = new T.InstancedMesh(linkG, ironM, LINKS); chains.frustumCulled = false; chains.name = 'forge-swaying-chains'; fxRoot.add(chains);
    var cM = new T.Matrix4(), cQ = new T.Quaternion(), cE = new T.Euler(), cP = new T.Vector3(), cS = new T.Vector3(1, 1, 1);
    // Ember rain drifting down around the hero; its strength follows slow "heat waves".
    var ER = 420, erP = new Float32Array(ER * 3); for (q = 0; q < ER; q++) { erP[q * 3] = (Math.random() - .5) * 40; erP[q * 3 + 1] = Math.random() * 14; erP[q * 3 + 2] = (Math.random() - .5) * 34; }
    var erG = new T.BufferGeometry(); erG.setAttribute('position', new T.BufferAttribute(erP, 3)); own.push(erG);
    var erM = new T.ShaderMaterial({ uniforms: { t: { value: 0 }, heat: { value: .5 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: 'uniform float t;uniform float heat;varying float vA;void main(){vec3 p=position;float s=fract(sin(dot(p.xz,vec2(12.9,78.2)))*43758.5);p.y=mod(p.y-t*(.6+s*.9),14.);p.x+=sin(t*.7+s*20.)*.8;p.z+=cos(t*.5+s*13.)*.6;vA=heat*(.35+.65*fract(s*7.3+t*.3))*smoothstep(0.,1.5,p.y);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(70./max(1.,-mv.z),1.2,4.);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){vec2 c=gl_PointCoord-.5;float a=exp(-dot(c,c)*18.)*vA;gl_FragColor=vec4(vec3(1.,.42,.1)*a,a);}' }); own.push(erM);
    var emberRain = new T.Points(erG, erM); emberRain.frustumCulled = false; emberRain.name = 'forge-ember-rain'; fxRoot.add(emberRain);
    var heatNow = .5, baseAtmo = w.atmosphereAt;
    w.atmosphereAt = function (x, z) { var a = baseAtmo.apply(w, arguments); if (a) { if (a.exposure != null) a.exposure *= 1 + (heatNow - .5) * .12; if (a.bloom != null) a.bloom *= 1 + (heatNow - .5) * .3; } return a; };
    var baseUpdate = w.update, baseDispose = w.dispose;
    w.update = function (dt, time, p) {
      baseUpdate.apply(w, arguments); var t = time || 0; p = p || { x: 0, z: 0 }; spM.uniforms.t.value = t;
      // heat waves: the foundry breathes over ~2 minutes (ember rain, bloom, exposure)
      heatNow = .3 + .7 * Math.pow(.5 + .5 * Math.sin(t * .05 + .7), 2); erM.uniforms.t.value = t; erM.uniforms.heat.value = heatNow; emberRain.position.set(p.x, 0, p.z);
      var li = 0, anyChain = false;
      for (var ci = 0; ci < chainSpots.length; ci++) { var C = chainSpots[ci], vis = Math.abs(C.z - p.z) < 34 && Math.abs(C.x - p.x) < 34; if (vis) anyChain = true;
        var sw = Math.sin(t * .9 + C.ph) * .12, sw2 = Math.cos(t * .7 + C.ph * 1.7) * .08;
        for (var k2 = 0; k2 < C.n; k2++) { var d2 = k2 * .36; cP.set(C.x + Math.sin(sw) * d2, C.top - Math.cos(sw) * d2, C.z + Math.sin(sw2) * d2); cQ.setFromEuler(cE.set(sw2, k2 % 2 ? Math.PI / 2 : 0, sw)); if (!vis) cS.set(0, 0, 0); else cS.set(1.8, 1.8, 1.8); chains.setMatrixAt(li++, cM.compose(cP, cQ, cS)); } }
      if (anyChain) chains.instanceMatrix.needsUpdate = true; chains.visible = anyChain;
      for (var i = 0; i < live.length; i++) { var L = live[i];
        if (L.kind === 'ladle') {
          var near = Math.abs(p.z - (L.z0 + L.z1) / 2) < (L.z1 - L.z0) / 2 + 30; L.g.visible = near; if (!near) continue;
          // travel 14 s, pour 6 s, repeat; the pour point moves along the wing
          var cyc = (t + L.phase * 7) % 40, leg = Math.floor(cyc / 20), u = cyc % 20, span = L.z1 - L.z0, z;
          var travel = Math.min(1, u / 14), ease = travel * travel * (3 - 2 * travel); z = leg === 0 ? L.z0 + span * ease : L.z1 - span * ease;
          var pour = u > 14 ? Math.sin((u - 14) / 6 * Math.PI) : 0, sway = Math.sin(t * 1.3 + L.phase) * .04 * (1 - pour);
          L.ladle.position.set(L.x + L.W.side * 2.5, 6.4, z); L.ladle.rotation.set(0, 0, sway + pour * .55 * (L.W.side));
          L.stream.visible = L.splash.visible = pour > .15; L.sparks.visible = pour > .05;
          if (pour > .15) { var sx = L.x + L.W.side * (2.5 + 1.2 * pour), top = 6.1; L.stream.position.set(sx, top / 2, z); L.stream.scale.set(.12 + pour * .08, top, .12 + pour * .08); L.splash.position.set(sx, .12, z); L.splash.material.opacity = .45 * pour; L.sparks.position.set(sx, .1, z); }
          spM.uniforms.gain.value = Math.max(spM.uniforms.gain.value * .98, pour);
        } else if (L.kind === 'gate') {
          var gv = Math.abs(p.z - L.z) < 60; L.m.visible = L.seam.visible = L.back.visible = gv; if (gv) L.back.material.opacity = .45 + .4 * heatNow; if (gv) L.seam.material.color.setRGB(.55 + .25 * heatNow + .1 * Math.sin(t * 2.3), .14 + .06 * heatNow, .03);
        } else {
          var on = Math.abs(p.z - L.z) < 40; L.m.visible = on; if (!on) continue;
          var br = .5 + .5 * Math.sin(t * 2.1 + L.phase); L.m.material.opacity = .18 + .5 * br * br; L.m.scale.x = L.m.scale.z * (1.05 + br * .2) / 1.05 * 4 / 3.4;
        }
      }
    };
    w.dispose = function () { own.forEach(function (o) { o.dispose(); }); fxRoot.removeFromParent(); return baseDispose.apply(w, arguments); };
    w.rooms = rooms.concat(wingRooms); w.colliders = colliders;
    w.isWalkable = isWalkable; w.move = move; w.hasClearPath = hasClearPath; w.pathTo = pathTo; w.roomAt = roomAt;
    return w;
  }
  B.ForgeWorld = { build: build };
}());
