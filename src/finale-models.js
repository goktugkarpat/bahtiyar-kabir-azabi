/* KABİR AZABI — V: Son Mahkeme. The court's cast on the licensed rigs (same toolkit as forge-models.js): the condemned in sack hoods and
   shackles, verdict scribes in tall mitres, void crawlers, chain jailers in cage helms, the blind verdict warden and the Last Judge himself
   (a towering robed executioner of the sky with a broken halo, a chained mask and the sword of the final verdict). Glow = blood-red hot iron. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, G = B.Gear, TAU = Math.PI * 2;
  function arr(p) { return [p.x, p.y, p.z]; }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function safe(label, fn) { try { fn(); } catch (e) { if (window.console) console.warn('finale-models: ' + label, e); } }
  function torsoFit(A, exec, chest) {
    var bones = exec ? ['spine01', 'spine02', 'spine03'] : ['spine_01', 'spine_02', 'spine_03'];
    var points = A.cloud ? A.cloud(bones, ['skin'], .25) : [], box = points.length ? A.box(points) : new T.Box3(new T.Vector3(chest.x - .24, chest.y - .28, chest.z - .18), new T.Vector3(chest.x + .24, chest.y + .22, chest.z + .18));
    var cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    function at(a, y, pad) { var best = 0, fallback = 0, score = Infinity; for (var i = 0; i < points.length; i++) { var p = points[i], dx = p.x - cx, dz = p.z - cz, r = Math.hypot(dx, dz), delta = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))), dy = Math.abs(p.y - y); if (dy < .065 && delta < .24) best = Math.max(best, r); var s = dy * 3 + delta * .15; if (s < score) { score = s; fallback = r; } } var r = (best || fallback || .2) + (pad || .024); return [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r]; }
    function attach(key, g) { if (A.transfer) A.transfer(key, g, ['skin'], { bones: bones }); else A.rigid(key, g, exec ? 'spine03' : 'spine_03'); }
    return { box: box, cx: cx, cz: cz, at: at, attach: attach };
  }
  function plateWear(g, edge) { return G.wear(g, { edge: edge == null ? .42 : edge, border: .35, curv: .006, cavity: .02 }); }
  var GLOW = [];
  function make(type, cfg) {
    cfg.chapter = 5;
    B.Models.register(type, cfg, function (A, C) {
      var exec = cfg.base === 'executioner', head = exec ? 'head' : 'Head', spine = exec ? 'spine03' : 'spine_03', handL = exec ? 'handL' : 'hand_l', handR = exec ? 'handR' : 'hand_r', armL = exec ? 'upper_armL' : 'upperarm_l', armR = exec ? 'upper_armR' : 'upperarm_r', foreL = exec ? 'forearmL' : 'lowerarm_l', foreR = exec ? 'forearmR' : 'lowerarm_r', thighL = exec ? 'thighL' : 'thigh_l', thighR = exec ? 'thighR' : 'thigh_r';
      var skin = A.addFrom(C.bases[cfg.base], function () { return true; }, 'skin')[0]; if (exec) A.remapBone('neutral_bone', 'pelvis');
      var p = A.P(head), chest = A.P(spine), hip = A.P('pelvis');
      if (type === 'voidcrawler') { A.lengthen({ lowerarm_l: 1.5, lowerarm_r: 1.5, hand_l: 1.35, hand_r: 1.35 }); var slim = {}; slim[spine] = .7; A.slim(skin, slim, 1); }
      if (type === 'damned') { var thin = {}; thin[spine] = .82; A.slim(skin, thin, 1); }
      var fitted = torsoFit(A, exec, chest), fb = fitted.box, bw = Math.max(.34, fb.max.x - fb.min.x), torsoH = fb.max.y - fb.min.y;
      var boss = type === 'lastjudge', elite = type === 'verdictwarden', armour = type === 'chainjailer' || elite || boss;
      var clothTint = type === 'verdictseer' ? [.2, .03, .03] : boss ? [.13, .018, .02] : elite ? [.04, .035, .035] : type === 'damned' ? [.32, .27, .22] : [.12, .1, .1];
      var skinTint = type === 'voidcrawler' ? [.3, .28, .3] : type === 'damned' ? [.78, .64, .58] : [.86, .7, .62];
      var materials = {
        skin: C.bodyMaterial(A.srcMaterial(exec ? 'Exec_mesh' : 'SuperHero_Male', C.bases[cfg.base]), 'finale-' + type + '-skin', { cls: 'skin', skin: 1, skinMap: exec, tint: skinTint, sat: .36, grime: type === 'voidcrawler' ? .75 : .55, blood: type === 'damned' ? .4 : .22, scale: 9, fresh: true }, { roughness: .78 }),
        iron: C.bodyMaterial(C.gearMaterial('iron'), 'finale-' + type + '-iron', { cls: 'metal', tint: boss ? [.5, .44, .42] : [.66, .6, .58], rust: .4, grime: .45, wear: .5, scale: 8 }, { roughness: .64 }),
        leather: C.bodyMaterial(C.gearMaterial('leather'), 'finale-' + type + '-leather', { cls: 'leather', tint: [.26, .18, .15], grime: .45, blood: .3, scale: 8 }, { roughness: .92 }),
        rag: C.bodyMaterial(C.gearMaterial('rag'), 'finale-' + type + '-linen', { cls: 'cloth', tear: true, sat: .5, tint: clothTint, grime: .5, blood: .25, scale: 8 }, { roughness: .95, side: T.DoubleSide }),
        bone: C.bodyMaterial(C.gearMaterial('bone'), 'finale-' + type + '-bone', { cls: 'bone', tint: [.9, .84, .74], grime: .3, blood: .18, scale: 10 }, { roughness: .76 }),
        glow: C.bodyMaterial(C.gearMaterial('iron'), 'finale-' + type + '-verdict-fire', { cls: 'metal', tint: [.6, .2, .16], rust: .2, grime: .3, wear: .6, scale: 10 }, { color: new T.Color(0x3a0e0a), emissive: new T.Color(0xff2a14), emissiveIntensity: boss ? 1.7 : 1.15, roughness: .6, metalness: .5 })
      };
      GLOW.push({ mat: materials.glow, base: materials.glow.emissiveIntensity, type: type });
      function limbCover(key, from, to, t0, t1, pad, thickness, flare) {
        var q = C.sleeve(A, from, to, t0, t1, pad, thickness, ['skin'], flare, { u: 20, v: 6 });
        G.uvScale(q.geometry, .8, .7); G.wear(q.geometry, { edge: key === 'iron' ? .18 : 0, border: .2, cavity: .025, curv: .004 });
        A.transfer(key, q.geometry, ['skin'], { bones: [from, to] }); return q;
      }
      function boot(foot, toe) {
        var pts = A.cloud([foot, toe], ['skin'], .35), box = A.box(pts), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
        if (!pts.length) return;
        var w = Math.max(.054, sz.x * .54), len = Math.max(.13, sz.z * .55), base = box.min.y + .005;
        var shoe = G.shell(20, 7, function (u, v) { var a = u * TAU, e = v * Math.PI / 2, r = Math.pow(Math.max(0, Math.cos(e)), .35), toeShape = .92 + .08 * Math.cos(a); return [c.x + Math.sin(a) * w * toeShape * r, base + .018 + Math.sin(e) * Math.max(.12, sz.y * 1.02), c.z + Math.cos(a) * len * r]; }, .004, false, true);
        G.uvScale(shoe, .8, .7); A.rigid('leather', shoe, foot);
      }
      function lames(key, count, top, gap, height, pad, flare) {
        var list = [];
        for (var i = 0; i < count; i++) (function (i) { var yTop = top - i * gap; list.push(plateWear(G.shell(24, 2, function (u, v) { var a = u * TAU, front = Math.max(0, Math.cos(a)), rib = .010 * Math.pow(Math.max(0, Math.cos(a * 4)), 4) * Math.sin(v * Math.PI); return fitted.at(a, yTop - v * height - .01 * front * front, pad + i * .004 + v * flare + rib); }, .011, true, true), .38)); })(i);
        fitted.attach(key, G.merge(list));
      }
      function seam(bone, off, radius, wob) {
        var a = A.P(bone), b = A.tail(bone) || a.clone().add(V(0, -.25, 0)), pts = [], n = 5, d = b.clone().sub(a), side = V(d.z, 0, -d.x).normalize().multiplyScalar(off);
        for (var i = 0; i <= n; i++) { var t = i / n; pts.push(a.clone().lerp(b, t).add(side.clone().multiplyScalar(1 + Math.sin(i * 2.3 + off * 40) * (wob || .4)))); }
        return G.tube(pts, radius, 5, 16, false);
      }
      // shackle ring + dangling chain at a bone
      function shackle(bone, r, links, key) {
        var q = A.P(bone), parts = [G.ring(r, r * .22, arr(q), [Math.PI / 2, 0, 0], 6, 18)];
        for (var c = 0; c < (links || 0); c++) parts.push(G.ring(.026, .007, [q.x, q.y - r - .03 - c * .05, q.z + .02], [c % 2 ? Math.PI / 2 : 0, 0, 0], 4, 9));
        A.rigid(key || 'iron', G.merge(parts), bone);
      }
      // long robe from the hips to the ankles (the scribes and the judge)
      function robe(len, flare, gapFront) {
        var footY = Math.min(A.P(exec ? 'tarsalL' : 'foot_l').y, A.P(exec ? 'tarsalR' : 'foot_r').y), top = hip.y + .07, bottom = footY + (len == null ? .1 : len), robeCloud = A.cloud(['pelvis', thighL, thighR], ['skin'], .25);
        function robeRadius(a, y) { var best = 0, fallback = 0, score = Infinity; for (var k = 0; k < robeCloud.length; k++) { var q = robeCloud[k], dx = q.x - hip.x, dz = q.z - hip.z, r = Math.hypot(dx, dz), df = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))), dy = Math.abs(q.y - y); if (dy < .07 && df < .3) best = Math.max(best, r); var sc = dy * 4 + df * .2; if (sc < score) { score = sc; fallback = r; } } return Math.max(exec ? .3 : .25, best || fallback) + .04; }
        var g = G.shell(32, 12, function (u, v) { var gap = (gapFront || .12) + v * .2, a = gap + u * (TAU - gap * 2), fold = (Math.sin(a * 7 + v * 2) * .035 + Math.sin(a * 13 - v * 3) * .01) * v * v, y = top + (bottom - top) * v, rr = robeRadius(a, Math.max(y, hip.y - .3)) + v * (flare || .1) + fold; return [hip.x + Math.sin(a) * rr, y + Math.sin(a * 9) * .02 * v * v, hip.z + Math.cos(a) * rr]; }, .003, false, true);
        G.uvScale(g, .9, .9); G.wear(g, { edge: 0, border: 0, cavity: 0, curv: 0, tear: { amount: .42, width: .03, bottom: .06, base: .014 } });
        A.weighted('rag', g, C.clothWeights(A, 'pelvis', thighL, thighR, top, bottom, .65));
      }
      function hood(tall, key) {
        var hc = A.cloud([head], ['skin'], .55), hb = A.box(hc), h = hc.length ? hb.getCenter(new T.Vector3()) : p.clone(), hs = hb.getSize(new T.Vector3());
        var top = (hc.length ? hb.max.y : p.y + .17) + .09 + (tall || 0), bottom = (hc.length ? hb.min.y : p.y - .13) - .07;
        var g = G.shell(28, 11, function (u, v) { var a = .6 + u * (TAU - 1.2), peak = Math.pow(1 - v, 3) * (tall || 0) * .0, r = Math.max(.14, hs.x * .56) * Math.sin(Math.min(1, v * 1.15 + (tall ? .08 : 0)) * Math.PI * .75) + .014 + Math.pow(v, 4) * .07; return [h.x + Math.sin(a) * r, top + (bottom - top) * v + peak, h.z + Math.cos(a) * r - .015]; }, .003, false, true);
        G.uvScale(g, .8, .8); G.fillWear(g); A.rigid(key || 'rag', g, head); return { center: h, size: hs, top: top, bottom: bottom };
      }
      if (type === 'damned') safe('the condemned', function () {
        // sack hood with a burnt verdict mark, iron collar and wrist shackles, a ragged loincloth, bare bloodied legs
        var hc = A.cloud([head], ['skin'], .55), hb = A.box(hc), c = hc.length ? hb.getCenter(new T.Vector3()) : p.clone(), hs = hb.getSize(new T.Vector3());
        var sack = G.shell(24, 10, function (u, v) { var a = u * TAU, r = (Math.max(.12, hs.x * .55) + .018) * Math.sin(Math.min(1, .15 + v * .95) * Math.PI * .62) + .006 * Math.sin(a * 9 + v * 7), y = (hb.max.y + .05) - v * (hs.y + .16); return [c.x + Math.sin(a) * r * (1 + .08 * Math.cos(a)), y, c.z + Math.cos(a) * r]; }, .003, true, true);
        G.uvScale(sack, .9, .9); G.wear(sack, { edge: 0, border: 0, cavity: 0, curv: 0, tear: { amount: .3, width: .02, bottom: .05, base: .01 } }); A.rigid('rag', sack, head);
        A.rigid('rag', G.tube([[c.x - .1, hb.min.y - .02, c.z + .06], [c.x, hb.min.y - .05, c.z + .12], [c.x + .1, hb.min.y - .02, c.z + .06]], .016, 5, 12, false), head);
        A.rigid('glow', G.merge([G.box(.07, .012, .006, [c.x, c.y + .02, c.z + Math.max(.12, hs.z * .55) + .02]), G.box(.012, .07, .006, [c.x, c.y + .02, c.z + Math.max(.12, hs.z * .55) + .02])]), head);
        var collar = G.ring(.12, .028, [chest.x, chest.y + .26, chest.z + .01], [Math.PI / 2 + .15, 0, 0], 6, 22); A.rigid('iron', collar, spine);
        var neck = []; for (var k = 0; k < 9; k++) neck.push(G.ring(.024, .007, [chest.x, chest.y + .2 - k * .045, chest.z + .16 + k * .006], [k % 2 ? Math.PI / 2 : 0, 0, 0], 4, 9)); A.rigid('iron', G.merge(neck), spine);
        shackle(handL, .055, 5); shackle(handR, .055, 5);
        var brand = fitted.at(.15, chest.y - .02, .012); A.rigid('glow', G.merge([G.box(.11, .012, .01, brand), G.box(.012, .11, .01, brand)]), spine);
        var cloth = G.sheet(18, 12, function (u, v) { return [hip.x + (u - .5) * (.4 + v * .1), hip.y + .05 - v * .42 + Math.sin(u * 17) * .04 * v * v, hip.z + .2 + Math.sin(u * 12 + v * 5) * .012]; }, true); G.uvScale(cloth, 2.5, 2); G.wear(cloth, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .7, width: .05, bottom: .14, base: .04 } }); A.rigid('rag', cloth, 'pelvis');
        var belt = G.shell(30, 2, function (u, v) { return fitted.at(u * TAU, hip.y + .08 - v * .05, .03); }, .008, true, true); A.rigid('rag', belt, 'pelvis');
        ['l', 'r'].forEach(function (side) { limbCover('rag', 'lowerarm_' + side, 'hand_' + side, .05, .7, .02, .002, .01); limbCover('rag', 'calf_' + side, 'foot_' + side, .2, .9, .02, .002, .006); });
      });
      if (type === 'verdictseer') safe('verdict scribe', function () {
        var h = hood(.0); robe(.06, .14, .1);
        // a tall split mitre above the hood, with a burning verdict seam
        var mt = G.shell(16, 6, function (u, v) { var a = u * TAU, r = (.1 + .02 * Math.cos(a * 2)) * (1 - v * .55), y = h.top - .02 + v * .34; return [h.center.x + Math.sin(a) * r, y + (Math.abs(Math.sin(a)) < .3 ? v * .05 : 0), h.center.z + Math.cos(a) * r * .8 - .01]; }, .005, true, true);
        G.uvScale(mt, .7, .7); plateWear(mt, .2); A.rigid('iron', mt, head); A.rigid('glow', G.box(.014, .3, .008, [h.center.x, h.top + .15, h.center.z + .085]), head);
        A.rigid('iron', G.sphere(.11, arr(p.clone().add(V(0, .02, .075))), [.84, 1.12, .48], 14, 10), head);
        A.rigid('glow', G.merge([G.box(.03, .007, .012, [p.x - .04, p.y + .05, p.z + .13]), G.box(.03, .007, .012, [p.x + .04, p.y + .05, p.z + .13])]), head);
        // a stone ledger chained to the belt; a stole of names
        A.rigid('bone', G.box(.24, .3, .06, [hip.x - .26, hip.y - .12, hip.z + .06]), 'pelvis'); A.rigid('glow', G.merge([0, 1, 2, 3].map(function (k) { return G.box(.15, .008, .004, [hip.x - .26, hip.y - .03 - k * .055, hip.z + .093]); })), 'pelvis');
        var stole = []; for (var s = -1; s <= 1; s += 2) stole.push(G.sheet(5, 12, function (u, v) { return [chest.x + s * (.1 + u * .07), fb.max.y - .02 - v * .95, fb.max.z + .03 + v * .02 + Math.sin(v * 6) * .006]; }, true)); var sg = G.merge(stole); G.uvScale(sg, .5, 2); A.weighted('rag', sg, C.clothWeights(A, 'pelvis', 'thigh_l', 'thigh_r', fb.max.y, fb.max.y - .95, .4));
        ['l', 'r'].forEach(function (side) { limbCover('rag', 'upperarm_' + side, 'lowerarm_' + side, .06, .94, .026, .002, .02); limbCover('rag', 'lowerarm_' + side, 'hand_' + side, .03, .8, .034, .002, .03); limbCover('rag', 'thigh_' + side, 'calf_' + side, -.02, 1.06, .026, .003, .006); limbCover('rag', 'calf_' + side, 'foot_' + side, -.05, .94, .022, .003, .005); boot('foot_' + side, 'ball_' + side); });
        var shell = G.sheet(32, 14, function (u, v) { return fitted.at(u * TAU, fb.max.y - .012 - v * (fb.max.y - fb.min.y - .075), .03); }, true, true); G.uvScale(shell, 2.5, 2); fitted.attach('rag', shell);
      });
      if (type === 'voidcrawler') safe('void crawler', function () {
        // a flayed thing of the void: basalt plates over grey skin, blood-red cracks, a spine of bone shards
        var ridge = []; for (var k = 0; k < 10; k++) { var y = chest.y + .22 - k * .062, base = V(chest.x, y, fb.min.z - .01), h2 = .17 - k * .011; ridge.push(G.spike(.036 - k * .0019, base, base.clone().add(V(0, h2 * .5, -h2)))); } A.rigid('bone', G.merge(ridge), spine);
        var panels = []; for (var row = 0; row < 4; row++) for (var side = -1; side <= 1; side += 2) (function (row, side) { var center = side * .68, width = .57 - row * .045, top = fb.max.y - .03 - row * torsoH * .19; panels.push(G.shell(9, 4, function (u, v) { var a = center + (u - .5) * width, y = top - v * torsoH * .18; return fitted.at(a, y, .017 + .02 * Math.sin(v * Math.PI)); }, .009, false, true)); })(row, side);
        var sh = G.merge(panels); G.uvScale(sh, 1.4, 1.3); plateWear(sh, .18); fitted.attach('iron', sh);
        var cracks = [seam(armL, .03, .007), seam(armR, -.03, .007), seam(foreL, .028, .006), seam(foreR, -.028, .006)];
        A.rigid('glow', cracks[0], armL); A.rigid('glow', cracks[1], armR); A.rigid('glow', cracks[2], foreL); A.rigid('glow', cracks[3], foreR);
        A.rigid('glow', seam(thighL, .04, .008), thighL); A.rigid('glow', seam(thighR, -.04, .008), thighR);
        var fc = []; for (var m = 0; m < 5; m++) { var a0 = (m - 2) * .55, pts = []; for (var j = 0; j < 5; j++) pts.push(fitted.at(a0 + Math.sin(j * 2.1 + m * 1.7) * .16, fb.max.y - .04 - j * torsoH * .17, .02)); fc.push(G.tube(pts, .0065, 5, 16, false)); } fitted.attach('glow', G.merge(fc));
        // talons
        [handL, handR].forEach(function (hand) { var o = A.P(hand), parts = []; for (var k = 0; k < 4; k++) { var q = o.clone().add(V((k - 1.5) * .025, -.08, .03)), tip = q.clone().add(V((k - 1.5) * .01, -.13, .06)); parts.push(G.tube([q, q.clone().lerp(tip, .5).add(V(0, 0, .02)), tip], function (t) { return .012 * Math.pow(1 - t, 1.2) + .001; }, 6, 10, true)); } A.rigid('bone', G.merge(parts), hand); });
        // the head: a cracked basalt helm-skull with a glowing split
        var hc = A.cloud([head], ['skin'], .4), hb = A.box(hc), c = hc.length ? hb.getCenter(new T.Vector3()) : p.clone();
        A.rigid('iron', G.sphere(.115, arr(c.clone().add(V(0, .03, -.01))), [1.0, .9, 1.12], 14, 10), head); A.rigid('glow', G.box(.008, .12, .01, [c.x, c.y + .04, c.z + .12]), head);
        A.rigid('glow', G.merge([G.sphere(.012, [c.x - .04, c.y, c.z + .11], [1.6, .5, .6], 8, 5), G.sphere(.012, [c.x + .04, c.y, c.z + .11], [1.6, .5, .6], 8, 5)]), head);
        for (var s2 = -1; s2 <= 1; s2 += 2) A.rigid('bone', G.tube([[c.x + s2 * .08, c.y + .08, c.z], [c.x + s2 * .17, c.y + .16, c.z - .05], [c.x + s2 * .2, c.y + .3, c.z - .12]], function (t) { return .025 * (1 - t * .85) + .003; }, 6, 14, true), head);
      });
      if (armour) safe('armour', function () {
        [armL, armR].forEach(function (b) { var q = A.P(b), plates = []; for (var i = 0; i < 3; i++) plates.push(plateWear(G.sphere(.15 - i * .018, arr(q.clone().add(V(0, -i * .055, 0))), [1.1, .5, 1], 12, 6), .4)); A.rigid('iron', G.merge(plates), b); });
        var n = boss ? 6 : elite ? 5 : 4; lames('iron', n, fb.max.y - .08, (torsoH - .14) / n, .105, .04, .016);
        var upper = hip.y + .085, lower = hip.y - (boss ? .42 : .32), parts = [];
        var cloud = A.cloud(['pelvis', thighL, thighR], ['skin'], .25), near = cloud.filter(function (q) { return q.y < upper + .03 && q.y > lower - .04; }), hb = A.box(near.length ? near : cloud), cx = (hb.min.x + hb.max.x) * .5, cz = (hb.min.z + hb.max.z) * .5;
        function surface(a, y, pad) { var best = 0, fallback = .25, score = Infinity; for (var k = 0; k < cloud.length; k++) { var q = cloud[k], dx = q.x - cx, dz = q.z - cz, r = Math.hypot(dx, dz), df = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))), dy = Math.abs(q.y - y); if (dy < .065 && df < .25) best = Math.max(best, r); var sc = dy * 4 + df * .18; if (sc < score) { score = sc; fallback = r; } } var r = Math.max(.21, best || fallback) + pad; return [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r]; }
        for (var i = 0; i < 8; i++) (function (i) { var center = (i + .5) * TAU / 8, half = TAU / 8 * .43; var panel = G.shell(10, 5, function (u, v) { var a = center + (u - .5) * half * 2 * (1 - v * .12), y = upper + (lower - upper) * v; return surface(a, y, .03 + .027 * v); }, .010, false, true); G.uvScale(panel, .7, .8); parts.push(plateWear(panel, .28)); })(i);
        A.weighted('iron', G.merge(parts), C.clothWeights(A, 'pelvis', thighL, thighR, upper, lower, .24));
      });
      if (type === 'chainjailer') safe('chain jailer', function () {
        // a cage helm over the head, chains wound round the torso, a hanging lantern-cage on the back with a blood flame
        var hc = A.cloud([head], ['skin'], .4), hb = A.box(hc), c = hc.length ? hb.getCenter(new T.Vector3()) : p.clone(), cage = [];
        for (var k = 0; k < 8; k++) { var a = k / 8 * TAU; cage.push(G.box(.016, .3, .016, [c.x + Math.sin(a) * .15, c.y + .02, c.z + Math.cos(a) * .15])); }
        cage.push(G.ring(.155, .014, [c.x, c.y + .17, c.z], [Math.PI / 2, 0, 0], 6, 20), G.ring(.155, .014, [c.x, c.y - .12, c.z], [Math.PI / 2, 0, 0], 6, 20), G.sphere(.05, [c.x, c.y + .2, c.z], [1, .6, 1], 8, 5));
        A.rigid('iron', G.merge(cage), head); A.rigid('glow', G.merge([G.sphere(.014, [c.x - .045, c.y + .01, c.z + .1], [1.5, .5, .6], 8, 5), G.sphere(.014, [c.x + .045, c.y + .01, c.z + .1], [1.5, .5, .6], 8, 5)]), head);
        var band = []; for (var w = 0; w < 2; w++) for (var k = 0; k < 16; k++) { var t = k / 15; band.push(G.ring(.032, .009, fitted.at((w ? 1 : -1) * (-1.1 + t * 2.2), fb.max.y - .05 - t * torsoH * .75, .06), [k % 2 ? Math.PI / 2 : 0, k % 2 ? 0 : Math.PI / 2, .4], 4, 9)); }
        fitted.attach('iron', G.merge(band));
        var bc = [G.ring(.11, .013, [fitted.cx, chest.y - .02, fb.min.z - .16], [Math.PI / 2, 0, 0], 6, 18), G.ring(.11, .013, [fitted.cx, chest.y - .28, fb.min.z - .16], [Math.PI / 2, 0, 0], 6, 18)];
        for (var i = 0; i < 6; i++) { var a2 = i / 6 * TAU; bc.push(G.box(.014, .28, .014, [fitted.cx + Math.sin(a2) * .1, chest.y - .15, fb.min.z - .16 + Math.cos(a2) * .1])); }
        A.rigid('iron', G.merge(bc), spine); A.rigid('glow', G.sphere(.06, [fitted.cx, chest.y - .15, fb.min.z - .16], [1, 1.3, 1], 10, 8), spine);
        ['L', 'R'].forEach(function (side) { limbCover('rag', 'thigh' + side, 'shin' + side, .16, .94, .02, .003, .01); limbCover('iron', 'shin' + side, 'tarsal' + side, .12, .82, .029, .009, .025); });
      });
      if (elite) safe('verdict warden', function () {
        // a blind great-helm stitched shut with chain, a long black cloak, a verdict tabard
        var hc = A.cloud([head], ['skin'], .4), hb = A.box(hc), c = hc.length ? hb.getCenter(new T.Vector3()) : p.clone();
        A.rigid('iron', plateWear(G.shell(20, 8, function (u, v) { var a = u * TAU, r = .15 + .01 * Math.cos(a * 2), y = c.y + .2 - v * .36; return [c.x + Math.sin(a) * r * (1 - v * .05), y, c.z + Math.cos(a) * r * 1.08]; }, .006, true, true), .3), head);
        A.rigid('iron', G.sphere(.15, [c.x, c.y + .2, c.z], [1, .45, 1.08], 14, 6), head);
        var st = []; for (var k = 0; k < 7; k++) st.push(G.ring(.012, .004, [c.x - .09 + k * .03, c.y + .03, c.z + .165], [0, Math.PI / 2, 0], 4, 8)); A.rigid('iron', G.merge(st), head);
        A.rigid('glow', G.box(.2, .01, .01, [c.x, c.y + .03, c.z + .16]), head);
        var cloak = G.sheet(20, 14, function (u, v) { var across = (u - .5) * (bw * 1.0 + v * .36); return [fitted.cx + across, fb.max.y - .04 - v * 1.2 + Math.sin(u * 23) * .04 * v * v, fb.min.z - .05 - .07 * v + Math.sin(u * 15 + v * 5) * .016]; }, true); G.uvScale(cloak, 2.4, 3); G.wear(cloak, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .34, width: .025, bottom: .08, base: .015 } }); A.rigid('rag', cloak, spine);
        var tab = G.sheet(8, 12, function (u, v) { return [hip.x + (u - .5) * .3, hip.y + .05 - v * .6, hip.z + .27 + Math.sin(v * 5) * .01]; }, true); G.uvScale(tab, 1, 2); A.weighted('rag', tab, C.clothWeights(A, 'pelvis', thighL, thighR, hip.y + .05, hip.y - .55, .3));
        A.rigid('glow', G.merge([G.box(.14, .012, .006, [hip.x, hip.y - .2, hip.z + .285]), G.box(.012, .14, .006, [hip.x, hip.y - .2, hip.z + .285])]), 'pelvis');
      });
      if (boss) safe('the last judge', function () {
        robe(.02, .22, .16);
        // judge's mantle over the shoulders, a chained mask, a tall broken crown and a halo ring behind the head
        var mantle = G.shell(30, 8, function (u, v) { var a = u * TAU; var q = fitted.at(a, fb.max.y + .02 - v * .36, .05 + v * .09 + .012 * Math.sin(a * 8)); return q; }, .006, true, true); G.uvScale(mantle, 2, 1); G.wear(mantle, { edge: 0, border: 0, cavity: 0, curv: 0, tear: { amount: .25, width: .02, bottom: .06, base: .01 } }); fitted.attach('rag', mantle);
        var hc = A.cloud([head], ['skin'], .4), hb = A.box(hc), c = hc.length ? hb.getCenter(new T.Vector3()) : p.clone();
        A.rigid('bone', plateWear(G.shell(16, 8, function (u, v) { var a = -1.25 + u * 2.5, r = .155 + .01 * Math.cos(a * 3), y = c.y + .17 - v * .3; return [c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r + .01]; }, .008, false, true), .2), head);
        A.rigid('glow', G.merge([G.box(.05, .01, .012, [c.x - .055, c.y + .05, c.z + .16]), G.box(.05, .01, .012, [c.x + .055, c.y + .05, c.z + .16]), G.box(.008, .1, .012, [c.x, c.y - .06, c.z + .165])]), head);
        var mk = []; for (var s = -1; s <= 1; s += 2) for (var k = 0; k < 6; k++) mk.push(G.ring(.02, .006, [c.x + s * .15, c.y + .1 - k * .04, c.z + .05], [k % 2 ? Math.PI / 2 : 0, 0, 0], 4, 8)); A.rigid('iron', G.merge(mk), head);
        var crown = []; for (var k = 0; k < 9; k++) { var a = k / 9 * TAU, b0 = V(c.x + Math.sin(a) * .14, c.y + .17, c.z + Math.cos(a) * .14), hgt = (k % 3 === 0 ? .32 : .18) * (k === 4 ? .5 : 1); crown.push(G.spike(.03, b0, b0.clone().add(V(Math.sin(a) * .04, hgt, Math.cos(a) * .04)))); }
        crown.push(G.ring(.15, .02, [c.x, c.y + .17, c.z], [Math.PI / 2, 0, 0], 6, 22)); A.rigid('iron', G.merge(crown), head);
        A.rigid('glow', G.ring(.42, .018, [c.x, c.y + .1, c.z - .3], [0, 0, 0], 6, 48), spine);
        A.rigid('iron', G.merge([0, 1, 2, 3, 4, 5].map(function (k) { var a = k / 6 * TAU + .3; return G.box(.04, .12, .03, [c.x + Math.sin(a) * .42, c.y + .1 + Math.cos(a) * .42, c.z - .3]); })), spine);
        // the verdict's chains: four heavy chains hanging from the belt (one per fallen lord), each ending in a seal
        var ch = [], seals = []; [[-.26, .1], [.26, .1], [-.18, -.2], [.18, -.2]].forEach(function (o, n) { for (var k = 0; k < 11; k++) ch.push(G.ring(.035, .01, [hip.x + o[0], hip.y - .02 - k * .065, hip.z + o[1]], [k % 2 ? Math.PI / 2 : 0, 0, 0], 5, 10)); seals.push(G.sphere(.05, [hip.x + o[0], hip.y - .76, hip.z + o[1]], [1, 1, .4], 10, 6)); });
        A.rigid('iron', G.merge(ch), 'pelvis'); A.rigid('glow', G.merge(seals), 'pelvis');
        var cr = []; for (var m = 0; m < 4; m++) { var a0 = (m - 1.5) * .45, pts = []; for (var j = 0; j < 6; j++) pts.push(fitted.at(a0 + Math.sin(j * 1.9 + m * 2.1) * .12, fb.max.y - .1 - j * torsoH * .14, .064)); cr.push(G.tube(pts, .007, 5, 18, false)); } fitted.attach('glow', G.merge(cr));
        A.rigid('glow', seam(foreL, .04, .009, .5), foreL); A.rigid('glow', seam(foreR, -.04, .009, .5), foreR);
        var cloak = G.sheet(22, 16, function (u, v) { var across = (u - .5) * (bw * .9 + v * .3); return [fitted.cx + across, fb.max.y - .05 - v * 1.25 + Math.sin(u * 23) * .05 * v * v, fb.min.z - .1 - .12 * v + Math.sin(u * 15 + v * 5) * .03]; }, true); G.uvScale(cloak, 2.4, 3); G.wear(cloak, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .36, width: .028, bottom: .1, base: .02 } }); A.rigid('rag', cloak, spine);
      });
      if (type === 'verdictseer' || type === 'damned') safe('covered thigh skin', function () {
        if (type === 'damned') return;
        var knee = Math.max(A.P('calf_l').y, A.P('calf_r').y) + .035;
        function covered(q) { return /^thigh_[lr]$/.test(q.bone) && q.p.y < hip.y - .025 && q.p.y > knee; }
        A.trim(skin, function (a, b, c) { return !(covered(a) && covered(b) && covered(c)); });
      });
      var weapon;
      if (type === 'verdictseer') weapon = { parts: { iron: [G.cyl(.022, .03, 1.2, 10, [0, .42, 0]), G.box(.5, .025, .025, [0, 1.06, 0]), G.ring(.07, .01, [-.22, .86, 0], [Math.PI / 2, 0, 0], 5, 14), G.ring(.07, .01, [.22, .86, 0], [Math.PI / 2, 0, 0], 5, 14), G.cyl(.004, .004, .2, 4, [-.22, .96, 0]), G.cyl(.004, .004, .2, 4, [.22, .96, 0])], glow: [G.sphere(.04, [0, 1.12, 0], [1, 1.3, 1], 10, 8), G.disc ? G.sphere(.05, [.22, .86, 0], [1, .25, 1], 10, 4) : G.sphere(.05, [.22, .86, 0], [1, .25, 1], 10, 4)] }, tip: new T.Vector3(0, 1.15, 0) };
      else if (type === 'chainjailer') weapon = { parts: { wood: [G.cyl(.04, .05, 1.0, 10, [0, .3, 0])], iron: [G.sphere(.17, [0, 1.18, 0], [1, 1, 1], 12, 8), G.ring(.03, .009, [0, .84, 0], [0, 0, 0], 4, 9), G.ring(.03, .009, [0, .92, 0], [Math.PI / 2, 0, 0], 4, 9), G.ring(.03, .009, [0, 1.0, 0], [0, 0, 0], 4, 9)].concat([0, 1, 2, 3, 4, 5].map(function (k) { var a = k / 6 * TAU; return G.spike(.04, V(Math.sin(a) * .15, 1.18, Math.cos(a) * .15), V(Math.sin(a) * .27, 1.18, Math.cos(a) * .27)); })), glow: [G.ring(.172, .008, [0, 1.18, 0], [Math.PI / 2, 0, 0], 5, 22)] }, tip: new T.Vector3(0, 1.3, 0) };
      else if (elite || boss) weapon = { parts: { iron: [C.forgedBlade(boss ? 1.5 : 1.2, boss ? .2 : .16, true), C.forgedBlock(boss ? .5 : .38, .06, .09, [0, .05, 0], .012), G.cyl(.045, .05, .05, 8, [0, -.36, 0])], leather: [C.forgedGrip(.035, .34, -.2)], glow: [G.extrude([[-.01, .16], [.006, .16], [.02, .5], [.01, .85], [.014, (boss ? 1.3 : 1.0)], [.002, (boss ? 1.25 : .95)], [.0, .5]], .04, .001)] }, tip: new T.Vector3(.22, boss ? 1.45 : 1.15, 0) };
      else if (type === 'damned') weapon = { parts: { iron: [G.cyl(.02, .025, .55, 8, [0, .25, 0]), G.ring(.04, .01, [0, .55, 0], [0, 0, 0], 4, 10)].concat([0, 1, 2, 3, 4, 5, 6].map(function (k) { return G.ring(.028, .008, [0, .6 + k * .05, .01 * (k % 2)], [k % 2 ? Math.PI / 2 : 0, 0, 0], 4, 9); })), glow: [G.sphere(.05, [0, .98, 0], [1, 1.3, 1], 8, 6)] }, tip: new T.Vector3(0, 1.0, 0) };
      if (weapon) weapon.materials = { iron: materials.iron, leather: materials.leather, glow: materials.glow, wood: materials.leather };
      return { materials: materials, weapon: weapon };
    });
  }
  make('damned', { base: 'ubc', height: 2.3, radius: .46, motionType: 'guard' });
  make('verdictseer', { base: 'ubc', height: 2.6, radius: .45, motionType: 'cultist' });
  make('voidcrawler', { base: 'ubc', height: 1.85, radius: .56, motionType: 'stalker' });
  make('chainjailer', { base: 'executioner', height: 3.0, radius: .74, motionType: 'carrier' });
  make('verdictwarden', { base: 'executioner', height: 3.3, radius: .84, motionType: 'guard' });
  make('lastjudge', { base: 'executioner', height: 4.7, radius: 1.15, motionType: 'boss' });
  B.FinaleModels = { types: ['damned', 'verdictseer', 'voidcrawler', 'chainjailer', 'verdictwarden', 'lastjudge'], glow: GLOW };
}());
