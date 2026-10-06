/* KABİR AZABI — story boss gate. The geometry stays chapter-specific and shares
   the world's scanned materials. Two completed story objectives release the leaf;
   defeated enemies never replace either objective. sync() follows restored quest
   state, refresh() handles an accepted interaction, kill() only updates QA counts.
   All resources are built before warm-up; no new lights or runtime GPU resources. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE;
  var LEGACY_KILLS = 45; // only for migrating already-open pre-quest saves
  var OPEN_TIME = 2.6, HEIGHT = 3.5, UVM = 1.5;
  var HINT_RANGE = 6.5, HINT_EVERY = 7;

  function create(api) {
    var world = api.world, enemies = api.enemies, chapter = api.chapter, root = api.root;
    var boss = null, regular = 0, i;
    for (i = 0; i < enemies.length; i++) { if (enemies[i].reserve) continue; if (enemies[i].boss) boss = boss || enemies[i]; else regular++; }
    if (!boss || !regular || !world || !world.rooms) return null;
    var bossRoom = null, prevRoom = null;
    for (i = 0; i < world.rooms.length; i++) { var rm = world.rooms[i]; if (String(rm.id) === String(boss.encounter.room)) bossRoom = rm; }
    if (!bossRoom) return null;
    for (i = 0; i < world.rooms.length; i++) if (world.rooms[i].id === bossRoom.id - 1) prevRoom = world.rooms[i];
    var need = 2;
    var info = { chapter: chapter, room: bossRoom.id, need: need, total: 2, kills: 0, completed: 0,
      open: false, bossName: boss.name || '', mode: 'quests' };

    // Where the door stands: in the passage between the last room and the boss room, as wide as the passage is.
    var bossEdge = bossRoom.z + bossRoom.d / 2, z = bossEdge + .6;
    if (prevRoom) { var gap = prevRoom.z - prevRoom.d / 2 - bossEdge; z = gap > .8 ? bossEdge + gap / 2 : bossEdge + .6; }
    var cx = bossRoom.x || 0, xl = cx, xr = cx;
    if (world.isWalkable && world.isWalkable(cx, z, .3)) {
      while (xl > cx - 12 && world.isWalkable(xl - .25, z, .3)) xl -= .25;
      while (xr < cx + 12 && world.isWalkable(xr + .25, z, .3)) xr += .25;
    } else { xl = cx - 3; xr = cx + 3; }
    cx = (xl + xr) / 2;
    var hw = (xr - xl) / 2 + .55;
    info.x = cx; info.z = z; info.hw = hw;

    /* ───────── geometry: boxes / cylinders / links merged per material ───────── */
    var materials = world.materials || {}, ownMaterials = [], geometries = [];
    function mat(key) {
      if (materials[key]) return materials[key];
      var m = new T.MeshStandardMaterial({ color: key === 'hot' || key === 'lamp' ? 0xff7a3a : 0x3a3532, roughness: .8, metalness: key === 'iron' || key === 'rust' ? .7 : .1 });
      if (key === 'hot' || key === 'lamp') m.emissive = new T.Color(0xff5a20);
      ownMaterials.push(m); materials[key] = m; return m;
    }
    function Set_() { this.buckets = {}; }
    var m4 = new T.Matrix4(), eul = new T.Euler(), quat = new T.Quaternion(), pos = new T.Vector3(), one = new T.Vector3(1, 1, 1), tmp = new T.Vector3();
    Set_.prototype.add = function (key, g, x, y, z_, rx, ry, rz) {
      var ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose();
      eul.set(rx || 0, ry || 0, rz || 0); quat.setFromEuler(eul); pos.set(x, y, z_); m4.compose(pos, quat, one);
      ng.applyMatrix4(m4); (this.buckets[key] = this.buckets[key] || []).push(ng);
    };
    Set_.prototype.box = function (key, w, h, d, x, y, z_, rx, ry, rz) {
      var g = new T.BoxGeometry(w, h, d).toNonIndexed(), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      for (var k = 0; k < p.count; k++) {
        var ax = Math.abs(n.getX(k)), ay = Math.abs(n.getY(k)), su = ax > .5 ? d : w, sv = ay > .5 ? d : h;
        uv.setXY(k, uv.getX(k) * su / UVM, uv.getY(k) * sv / UVM);
      }
      this.add(key, g, x, y, z_, rx, ry, rz);
    };
    Set_.prototype.cyl = function (key, r0, r1, h, seg, x, y, z_, rx, ry, rz) {
      var g = new T.CylinderGeometry(r1, r0, h, seg || 7, 1), uv = g.attributes.uv;
      for (var k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.max(r0, r1) * 6.3 / UVM, uv.getY(k) * h / UVM);
      this.add(key, g, x, y, z_, rx, ry, rz);
    };
    // A run of chain links from (x0,y0) to (x1,y1) in the gate plane, every second link turned 90 degrees.
    Set_.prototype.chain = function (key, x0, y0, x1, y1, z_, r, step) {
      var len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / (step || .15))), ang = Math.atan2(y1 - y0, x1 - x0);
      for (var k = 0; k <= n; k++) {
        var f = k / n, g = new T.TorusGeometry(r, r * .3, 5, 8); g.scale(1.45, 1, 1);
        this.add(key, g, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, z_, k % 2 ? Math.PI / 2 : 0, 0, ang);
      }
    };
    Set_.prototype.build = function (parent, castShadow) {
      var out = [], keys = Object.keys(this.buckets);
      for (var a = 0; a < keys.length; a++) {
        var list = this.buckets[keys[a]], total = 0, b, j;
        for (b = 0; b < list.length; b++) total += list[b].attributes.position.count;
        var P = new Float32Array(total * 3), N = new Float32Array(total * 3), U = new Float32Array(total * 2), o = 0;
        for (b = 0; b < list.length; b++) {
          var s = list[b], c = s.attributes.position.count;
          P.set(s.attributes.position.array, o * 3); N.set(s.attributes.normal.array, o * 3); U.set(s.attributes.uv.array, o * 2); o += c; s.dispose();
        }
        var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('uv', new T.BufferAttribute(U, 2));
        // chapter III / IV surfaces use vertex colours (a missing attribute would draw black): white, glow parts tinted
        var tint = keys[a] === 'hot' ? [.9, .3, .07] : keys[a] === 'rock' && chapter === 3 ? [.42, .4, .45] : [1, 1, 1], C = new Float32Array(total * 3);
        for (j = 0; j < total; j++) { C[j * 3] = tint[0]; C[j * 3 + 1] = tint[1]; C[j * 3 + 2] = tint[2]; }
        g.setAttribute('color', new T.BufferAttribute(C, 3));
        g.computeBoundingSphere(); geometries.push(g);
        var mesh = new T.Mesh(g, mat(keys[a])); mesh.name = 'Boss gate ' + keys[a];
        var glow = keys[a] === 'hot' || keys[a] === 'ember' || keys[a] === 'lamp' || keys[a] === 'oath' || keys[a] === 'slag';
        mesh.castShadow = !!castShadow && !glow; mesh.receiveShadow = !glow;
        parent.add(mesh); out.push(mesh);
      }
      return out;
    };

    var frame = new Set_(), leaf = new Set_(), H = HEIGHT, k;
    function jit(n) { return Math.sin(n * 12.9898 + chapter * 4.1) * .5 + .5; }
    function bars(pitch, r, spike) {
      var n = Math.max(3, Math.round(hw * 2 / pitch));
      for (k = 0; k < n; k++) {
        var x = -hw + .3 + (2 * hw - .6) * (k / (n - 1));
        leaf.cyl('iron', r, r, H, 7, x, H / 2, 0);
        if (spike) leaf.cyl('iron', .008, r * 1.5, .38, 6, x, .19, 0);
      }
    }
    if (chapter === 1) {
      // Kurban Tapınağı: iron portcullis, chained across a glowing blood seal, in worn stone piers.
      for (k = -1; k <= 1; k += 2) frame.box('dark', .8, H + .5, 1.1, k * (hw - .35), (H + .5) / 2, 0);
      frame.box('rust', 2 * hw, .34, .6, 0, H + .1, .05);
      bars(.42, .062, true);
      for (k = 0; k < 4; k++) leaf.box('iron', 2 * hw - .3, .12, .12, 0, .55 + k * .9, .09);
      leaf.box('rust', 1.7, 1.7, .1, 0, 1.75, .15);
      leaf.cyl('ember', .5, .5, .08, 18, 0, 1.75, .22, Math.PI / 2);
      for (k = 0; k < 3; k++) leaf.box('ember', .07, .5, .02, (k - 1) * .26, 1.75, .28, 0, 0, (k - 1) * .5);
      leaf.chain('rust', -hw + .3, H - .2, -.35, 2.15, .24, .075); leaf.chain('rust', hw - .3, H - .2, .35, 2.15, .24, .075);
      leaf.chain('rust', -hw + .3, .35, -.35, 1.35, .24, .075); leaf.chain('rust', hw - .3, .35, .35, 1.35, .24, .075);
    } else if (chapter === 2) {
      // Kara Kıyı: a rotten sea-gate of tarred planks, rust bands and heavy chains; a drowned lantern hangs over it.
      for (k = -1; k <= 1; k += 2) { frame.box('wood', .75, H + .6, .8, k * (hw - .3), (H + .6) / 2, 0, 0, 0, k * .015); frame.box('rock', 1.1, .6, 1.1, k * (hw - .35), .3, 0); }
      frame.box('wood', 2 * hw, .5, .62, 0, H + .15, 0, 0, 0, .012);
      frame.cyl('rust', .015, .015, .9, 4, 0, H - .55, .35); frame.box('rust', .4, .5, .4, 0, H - 1.25, .36); frame.box('oath', .3, .44, .3, 0, H - 1.25, .37);
      var np = Math.max(4, Math.round(hw * 2 / .78));
      for (k = 0; k < np; k++) {
        var ph = H * (.9 + jit(k) * .1), px = -hw + (2 * hw) * (k + .5) / np;
        leaf.box('wood', 2 * hw / np - .03, ph, .2, px, ph / 2, (k % 2) * .06, 0, 0, (jit(k + 7) - .5) * .02);
      }
      for (k = 0; k < 3; k++) leaf.box('rust', 2 * hw - .2, .22, .08, 0, .6 + k * 1.1, .2);
      leaf.chain('rust', -hw + .25, H - .3, hw - .25, .45, .26, .11, .2); leaf.chain('rust', hw - .25, H - .3, -hw + .25, .45, .26, .11, .2);
      leaf.box('rust', .7, .7, .12, 0, 1.75, .27);
    } else if (chapter === 3 || chapter === 5) {   // V: the same rune-sealed slabs, burning blood-red (the court's lamp)
      // Sessiz Taht: two slabs of cut stone shut with a ring of glowing runes.
      for (k = -1; k <= 1; k += 2) frame.box('stone', .85, H + .8, 1.1, k * (hw - .3), (H + .8) / 2, 0);
      frame.box('stone', 2 * hw, .8, 1.1, 0, H + .4, 0);
      for (k = -1; k <= 1; k += 2) {
        leaf.box('rock', hw - .12, H, .55, k * hw / 2, H / 2, 0);
        leaf.box('iron', .16, H - .2, .1, k * (hw - .3), H / 2, .3);
      }
      for (k = 0; k < 12; k++) { var a = k / 12 * Math.PI * 2; leaf.box('lamp', .14, .62, .04, Math.sin(a) * 1.25, 1.95 + Math.cos(a) * 1.25, .3, 0, 0, -a); }
      leaf.box('lamp', .12, 2.3, .04, 0, 1.95, .3); leaf.box('lamp', 1.8, .12, .04, 0, 1.95, .3);
      for (k = 0; k < 5; k++) for (var sd = -1; sd <= 1; sd += 2) leaf.box('lamp', .06 + (k % 2) * .16, .06, .03, sd * (hw - .85), .6 + k * .55, .29);
      leaf.box('lamp', 1.1, .06, .03, 0, .55, .29);
    } else {
      // Kızıl Ocak: a riveted furnace blast door, hot seams burning through its ribs.
      for (k = -1; k <= 1; k += 2) frame.box('iron', .9, H + .8, 1, k * (hw - .35), (H + .8) / 2, 0);
      frame.box('iron', 2 * hw, .9, 1, 0, H + .35, 0);
      leaf.box('iron', 2 * hw - .1, H, .4, 0, H / 2, 0);
      for (k = 0; k < 4; k++) leaf.box('rock', 2 * hw - .3, .24, .12, 0, .5 + k * .85, .25);
      leaf.box('hot', .16, H - .3, .05, 0, H / 2, .22);
      for (k = 0; k < 3; k++) leaf.box('hot', hw * 2 - .9, .06, .05, 0, .93 + k * .85, .32);
      for (k = 0; k < 4; k++) for (var bx = -1; bx <= 1; bx += 2) for (var cnt = 1; cnt <= 3; cnt++) leaf.cyl('rock', .085, .085, .1, 6, bx * (cnt * .45 + .3 + (cnt > 2 ? .6 : 0)), .5 + k * .85, .33, Math.PI / 2);
      leaf.cyl('slag', .3, .3, .06, 12, -hw + .85, H - .35, .22, Math.PI / 2); leaf.cyl('slag', .3, .3, .06, 12, hw - .85, H - .35, .22, Math.PI / 2);
    }

    var group = new T.Group(); group.name = 'Boss gate'; group.position.set(cx, 0, z);
    var leafGroup = new T.Group(); group.add(leafGroup);
    frame.build(group, true); leaf.build(leafGroup, true);
    frame = leaf = null;
    root.add(group);

    /* ───────── state ───────── */
    var openT = OPEN_TIME + 1, opening = false, hintCd = 0, burstCd = 0, blocking = true, leafShown = true;
    function count() { var c = 0, e; for (var q = 0; q < enemies.length; q++) { e = enemies[q]; if (e.dead && !e.boss && !e.reserve) c++; } return c; }
    function setLeaf(y, shown) { leafGroup.position.y = y; leafGroup.position.x = 0; if (shown !== leafShown) { leafShown = shown; leafGroup.visible = shown; } }
    var gate = { info: info };
    // After every reset / load: restored objective completion opens the leaf without replaying its sound.
    gate.sync = function () {
      info.kills = count(); info.completed = api.quests ? api.quests.completed : 0;
      info.open = !!boss.dead || !!(api.quests && api.quests.ready); opening = false; hintCd = 0;
      if (info.open) { openT = OPEN_TIME + 1; blocking = false; setLeaf(H + .4, false); }
      else { openT = 0; blocking = true; setLeaf(0, true); }
    };
    gate.refresh = function () {
      info.kills = count(); info.completed = api.quests ? api.quests.completed : 0;
      if (!info.open && (boss.dead || api.quests && api.quests.ready)) {
        info.open = true; opening = true; openT = 0; burstCd = 0;
        var p = api.player;
        api.sound('gateOpen'); api.emit('gateOpen', { name: info.bossName, x: cx, z: z, need: need });
        if (p) api.emit('impact', { x: p.x, z: p.z, strength: .38, radius: 9 });
        api.fx('parry', { x: cx - hw * .5, y: 1.8, z: z + .4 }); api.fx('parry', { x: cx + hw * .5, y: 2.6, z: z + .4 });
        api.fx('slam', { x: cx, z: z + .5, radius: Math.min(5, hw * 1.3) });
      }
    };
    gate.kill = function () { info.kills = count(); };
    // The visual seal is also a combat obstacle: ranged strikes and travelling tells stop here.
    gate.blocks = function (ax, az, bx, bz, radius) {
      if (!blocking || Math.abs(bz - az) < 1e-7) return false;
      var u = (z - az) / (bz - az);
      return u > 0 && u < 1 && Math.abs(ax + (bx - ax) * u - cx) < hw + (radius || 0);
    };
    gate.clipLine = function (x, z0, face, length) {
      if (!blocking) return length;
      var dz = Math.cos(face); if (Math.abs(dz) < 1e-7) return length;
      var distance = (z - z0) / dz;
      return distance > 0 && distance < length && Math.abs(x + Math.sin(face) * distance - cx) < hw + .15 ? Math.max(.05, distance - .18) : length;
    };
    gate.clamp = function (body, prevZ, radius) {
      if (!blocking || Math.abs(body.x - cx) > hw + radius) return;
      if (prevZ < z && body.z > z - radius) body.z = z - radius;
      else if (prevZ >= z && body.z < z + radius) body.z = z + radius;
    };
    gate.update = function (dt, p) {
      var near = Math.abs(p.z - z) < 52;
      if (group.visible !== near) group.visible = near;
      if (!near) return;
      if (opening) {
        openT += dt;
        var u = Math.min(1, Math.max(0, (openT - .5) / (OPEN_TIME - .5))), ease = u * u * (3 - 2 * u);
        if (openT > .55) blocking = false;
        // a short rattle first, then the leaf grinds up into the lintel
        var shake = openT < .5 ? Math.sin(openT * 90) * .025 * (openT / .5) : u < 1 ? Math.sin(openT * 55) * .012 : 0;
        leafGroup.position.x = shake; leafGroup.position.y = (H + .4) * ease;
        burstCd -= dt;
        if (u > 0 && u < 1 && burstCd <= 0) {
          burstCd = .32; api.fx('slam', { x: cx + (jit(openT * 9) - .5) * hw * 1.6, z: z + .5, radius: 2, small: true });
        }
        if (openT >= OPEN_TIME) { opening = false; blocking = false; setLeaf(H + .4, false); api.fx('slam', { x: cx, z: z + .5, radius: 3, small: true }); }
        return;
      }
      if (!info.open) {
        hintCd -= dt;
        if (hintCd <= 0 && p.z > z && p.z - z < HINT_RANGE && Math.abs(p.x - cx) < hw + 2.5) {
          hintCd = HINT_EVERY; api.emit('toast', { text: KabirI18n.t('Kapı mühürlü · ') + info.completed + KabirI18n.t(' / 2 görev tamamlandı. ') + (api.quests ? api.quests.objective : '') });
        }
      }
    };
    gate.dispose = function () {
      root.remove(group); geometries.forEach(function (g) { g.dispose(); }); ownMaterials.forEach(function (m) { m.dispose(); });
    };
    gate.sync();
    return gate;
  }

  B.Gate = { LEGACY_KILLS: LEGACY_KILLS, create: create };
})();
