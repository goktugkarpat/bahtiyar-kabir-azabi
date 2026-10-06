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
    WINGS.forEach(function (W) { for (var z = W.z1 - 3; z > W.z0; z -= 6) [4, 9, 14].forEach(function (t) { seed(W.side * (21 + t), z); }); });
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
    var sites = {}; [['c4.page1', -30, -10], ['c4.page2', 31, -152], ['c4.page3', -26, -210], ['c4.altar', -35, -230], ['c4.chest', 33, -262], ['c4.hunt', 28, -100]].forEach(function (q) { for (var k = 0; k < 60; k++) { var a = k * 2.4, d = k ? .45 * Math.sqrt(k) : 0, x = q[1] + Math.cos(a) * d, z = q[2] + Math.sin(a) * d; if (isWalkable(x, z, 1.3) && pathTo({ x: 0, z: 12 }, { x: x, z: z }, .5).length) { sites[q[0]] = { x: x, z: z }; break; } } });
    w.questSites = Object.assign(w.questSites || {}, sites);
    w.rooms = rooms.concat(wingRooms); w.colliders = colliders;
    w.isWalkable = isWalkable; w.move = move; w.hasClearPath = hasClearPath; w.pathTo = pathTo; w.roomAt = roomAt;
    return w;
  }
  B.ForgeWorld = { build: build };
}());
