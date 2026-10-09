/* Selvi — an adult captive scribe on the existing chapter-V human rig.
   Register before Models.prepare; no enemy type is replaced. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, G = B.Gear, PI = Math.PI, TAU = PI * 2;
  B.Models.register('selvi', { base: 'ubc', chapter: 5, height: 2.12, radius: .38, motionType: 'guard', idleClip: 'idle', narrativeActor: true }, function (A, C) {
    var skin = A.addFrom(C.bases.ubc, function () { return true; }, 'skin')[0];
    A.slim(skin, { spine_01: .83, spine_02: .86, spine_03: .87, pelvis: 1.015, clavicle_l: .76, clavicle_r: .76,
      upperarm_l: .65, upperarm_r: .65, lowerarm_l: .74, lowerarm_r: .74,
      thigh_l: .91, thigh_r: .91, calf_l: .91, calf_r: .91, Head: .96 }, 1);
    A.lengthen({ clavicle_l: .88, clavicle_r: .88 });
    var headCloud = A.cloud(['Head'], ['skin'], .5), headBox = A.box(headCloud), hc = headBox.getCenter(new T.Vector3()), hs = headBox.getSize(new T.Vector3());
    // Recontour the adult face and jaw, without altering the animated skeleton.
    var p = skin.geometry.attributes.position, si = skin.geometry.attributes.skinIndex, sw = skin.geometry.attributes.skinWeight, headIndex = A.index.Head;
    for (var i = 0; i < p.count; i++) {
      var headWeight = 0;
      for (var j = 0; j < 4; j++) if (si.getComponent(i, j) === headIndex) headWeight += sw.getComponent(i, j);
      if (headWeight < .35) continue;
      var lower = Math.max(0, Math.min(1, (hc.y + hs.y * .12 - p.getY(i)) / Math.max(.01, hs.y * .45)));
      p.setX(i, hc.x + (p.getX(i) - hc.x) * (1 - .115 * lower * headWeight));
    }
    skin.geometry.computeVertexNormals();
    headCloud = A.cloud(['Head'], ['skin'], .5); headBox = A.box(headCloud); hc = headBox.getCenter(new T.Vector3()); hs = headBox.getSize(new T.Vector3());
    var hip = A.P('pelvis'), torsoBones = ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'neck_01'], torso = A.cloud(torsoBones, ['skin'], .25), tb = A.box(torso), tc = tb.getCenter(new T.Vector3());
    var materials = {
      skin: C.bodyMaterial(A.srcMaterial('SuperHero_Male', C.bases.ubc), 'selvi-skin', { cls: 'skin', tint: [.79, .68, .62], sat: .36, grime: .24, blood: .07, scale: 9, fresh: true }, { roughness: .78 }),
      dress: C.bodyMaterial(C.gearMaterial('rag'), 'selvi-dress', { cls: 'cloth', tint: [.105, .12, .135], grime: .28, blood: .10, scale: 8 }, { roughness: .95, side: T.DoubleSide }),
      apron: C.bodyMaterial(C.gearMaterial('rag'), 'selvi-apron', { cls: 'cloth', tint: [.27, .235, .20], grime: .42, blood: .09, scale: 9 }, { roughness: .96, side: T.DoubleSide }),
      leather: C.bodyMaterial(C.gearMaterial('leather'), 'selvi-leather', { cls: 'leather', tint: [.105, .075, .055], grime: .3, scale: 8 }, { roughness: .90 }),
      hair: C.bodyMaterial(C.gearMaterial('leather'), 'selvi-hair', { cls: 'leather', tint: [.060, .042, .032], grime: .08, scale: 11 }, { roughness: .75, side: T.DoubleSide }),
      'phase-selvi-cuffs': C.bodyMaterial(C.gearMaterial('iron'), 'selvi-cuffs', { cls: 'metal', tint: [.30, .27, .245], rust: .48, grime: .35, scale: 8 }, { roughness: .78, metalness: .55 })
    };
    function at(a, y, pad) {
      var best = 0, fallback = .2, score = Infinity;
      for (var k = 0; k < torso.length; k++) {
        var v = torso[k], dx = v.x - tc.x, dz = v.z - tc.z, r = Math.hypot(dx, dz), dy = Math.abs(v.y - y), da = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a)));
        if (dy < .065 && da < .24) best = Math.max(best, r);
        var distance = dy * 4 + da * .18;
        if (distance < score) { score = distance; fallback = r; }
      }
      var radius = Math.max(.12, best || fallback) + pad;
      return [tc.x + Math.sin(a) * radius, y, tc.z + Math.cos(a) * radius];
    }
    var top = A.P('neck_01').y - .015, waist = hip.y + .06, bottom = Math.min(A.P('foot_l').y, A.P('foot_r').y) + .17;
    // The fitted blouse retains the artist body's topology and exact weights.
    // A radial shoulder field makes a funnel; it is unsuitable for a neckline.
    function fitted(key, keep, offset) {
      var part = { geometry: skin.geometry.clone() }; A.trim(part, keep);
      var g = part.geometry, pos = g.attributes.position, normal = g.attributes.normal;
      var index = g.attributes.skinIndex.clone(), weight = g.attributes.skinWeight.clone();
      for (var n = 0; n < pos.count; n++) pos.setXYZ(n, pos.getX(n) + normal.getX(n) * offset, pos.getY(n) + normal.getY(n) * offset, pos.getZ(n) + normal.getZ(n) * offset);
      g.computeVertexNormals(); G.fillWear(g);
      A.weighted(key, g, function (v, i) { var out = []; for (var k = 0; k < 4; k++) if (weight.getComponent(i, k) > 0) out.push([index.getComponent(i, k), weight.getComponent(i, k)]); return out; });
      return g;
    }
    var sleeveBones = /^(spine_|clavicle_|upperarm_|lowerarm_|neck_01|pelvis)/;
    fitted('dress', function (a, b, c) {
      var nodes = [a, b, c], y = (a.p.y + b.p.y + c.p.y) / 3;
      return y >= waist - .045 && y <= top + .04 && nodes.some(function (n) { return sleeveBones.test(n.bone); }) && !nodes.every(function (n) { return /^(Head|hand_|[a-z]+_0[123]_)/.test(n.bone); });
    }, .013);
    // Overlapping front/back gores follow their own leg, including the calves.
    // The split opens during a stride instead of pinning both knees to one tube.
    function panelWeights(side, point) {
      var knee = A.P('calf_' + side).y, ankle = A.P('foot_' + side).y;
      var leg = Math.max(0, Math.min(1, (waist - point.y) / Math.max(.01, waist - knee))) * .98;
      var calf = Math.max(0, Math.min(1, (knee + .10 - point.y) / Math.max(.01, knee + .10 - ankle))) * .94;
      return [[A.index.pelvis, 1 - leg], [A.index['thigh_' + side], leg * (1 - calf)], [A.index['calf_' + side], leg * calf]];
    }
    ['l', 'r'].forEach(function (side) {
      var left = side === 'l', a0 = left ? -.11 : PI - .11;
      var panel = G.sheet(24, 24, function (u, v) {
        var a = a0 + u * (PI + .22), base = at(a, waist, .036), radial = Math.hypot(base[0] - hip.x, base[2] - hip.z);
        var r = Math.max(.245, radial) + .13 * v + (.014 * Math.sin(a * 10 + v) + .006 * Math.sin(a * 17 - v * 2)) * v;
        return [hip.x + Math.sin(a) * r, waist + (bottom - waist) * v + .012 * Math.sin(a * 7) * v * v, hip.z + Math.cos(a) * r];
      }, true);
      G.uvScale(panel, .7, 1.3); G.wear(panel, { edge: 0, border: 0, cavity: 0, curv: 0, tear: { amount: .08, width: .008, bottom: .01, base: .002 } });
      A.weighted('dress', panel, function (point) { return panelWeights(side, point); });
    });
    // Modest dark underlayers are cut from the same rig, not floating cylinders.
    fitted('dress', function (a, b, c) { return [a, b, c].every(function (n) { return n.p.y < waist + .015 && !/^(foot_|ball_)/.test(n.bone); }); }, .008);
    // A worn linen writing apron with real folded edges, rather than armour trim.
    var apron = G.sheet(16, 16, function (u, v) {
      var a = (u - .5) * 1.30, y = waist + .025 - v * Math.min(.64, waist - bottom - .08), r = .28 + .045 * v + .009 * Math.sin(u * 19 + v * 2);
      return [hip.x + Math.sin(a) * r, y + .013 * Math.sin(u * 9) * v * v, hip.z + Math.cos(a) * r + .045];
    }, true);
    G.uvScale(apron, 1.0, 1.2); G.fillWear(apron); A.weighted('apron', apron, function (point) { return panelWeights(point.x >= hip.x ? 'l' : 'r', point); });
    var belt = G.shell(32, 2, function (u, v) { return at(u * TAU, waist + .025 - v * .048, .043); }, .006, true, true);
    G.uvScale(belt, 2, .5); A.transfer('leather', belt, ['skin'], { bones: ['pelvis', 'spine_01'] });
    ['l', 'r'].forEach(function (side) {
      var wrist = A.P('hand_' + side), cuff = C.sleeve(A, 'lowerarm_' + side, 'hand_' + side, .85, .96, .034, .009, ['skin'], 0, { u: 20, v: 2 });
      A.rigid('phase-selvi-cuffs', cuff.geometry, 'hand_' + side);
      var links = [];
      for (var link = 0; link < 3; link++) links.push(G.ring(.023, .006, [wrist.x, wrist.y - .06 - link * .047, wrist.z + .035], [link % 2 ? PI / 2 : 0, 0, 0], 5, 12));
      A.rigid('phase-selvi-cuffs', G.merge(links), 'hand_' + side);
      fitted('leather', function (a, b, c) {
        return [a, b, c].every(function (n) { return /^(foot_|ball_)/.test(n.bone) && n.bone.endsWith('_' + side); });
      }, .019);

    });
    // Open face, uneven centre-part hair and two loose locks. All hair is rigid
    // on the head: it cannot drag the shoulders or turn into a stretched cone.
    var rx = Math.max(.10, hs.x * .51) + .018, rz = Math.max(.095, hs.z * .50) + .018, scalpTop = headBox.max.y + .021;
    var hairCenter = hc.clone(), headRadii = new T.Vector3(Math.max(.10, hs.x * .5), Math.max(.12, hs.y * .5), Math.max(.10, hs.z * .5));
    var raySamples = headCloud.map(function (point) { var delta = point.clone().sub(hairCenter); return { direction: delta.clone().normalize(), length: delta.length() }; });
    function scalpRadius(direction) {
      var best = 0, limit = Math.cos(.33);
      for (var n = 0; n < raySamples.length; n++) if (raySamples[n].direction.dot(direction) > limit) best = Math.max(best, raySamples[n].length);
      var ellipsoid = 1 / Math.sqrt(Math.pow(direction.x / headRadii.x, 2) + Math.pow(direction.y / headRadii.y, 2) + Math.pow(direction.z / headRadii.z, 2));
      return (best || ellipsoid) + .018;
    }
    var hair = G.shell(40, 18, function (u, v) {
      var a = u * TAU, front = Math.max(0, Math.cos(a)), theta = v * (1.95 - .94 * Math.pow(front, 1.4));
      var direction = new T.Vector3(Math.sin(a) * Math.sin(theta), Math.cos(theta), Math.cos(a) * Math.sin(theta));
      var radius = scalpRadius(direction) + .002 * Math.cos(a * 11) * Math.sin(v * PI);
      return [hairCenter.x + direction.x * radius, hairCenter.y + direction.y * radius, hairCenter.z + direction.z * radius];
    }, .002, true, true);
    G.uvScale(hair, 1.1, 1.0); G.fillWear(hair); A.rigid('hair', hair, 'Head');
    var locks = [];
    for (var side = -1; side <= 1; side += 2) {
      var points = [[hc.x + side * rx * .83, hc.y + hs.y * .19, hc.z + .025], [hc.x + side * rx * 1.04, hc.y - hs.y * .26, hc.z - .015], [hc.x + side * rx * .92, headBox.min.y - .11, hc.z - .045], [hc.x + side * rx * .74, headBox.min.y - .20, hc.z - .09]];
      locks.push(G.tube(points, function (t) { return .027 * (1 - .57 * t); }, 8, 18, true));
    }
    // Short gathered hair falls behind the neck; it does not cover the face.
    locks.push(G.tube([[hc.x, hc.y + .02, hc.z - rz], [hc.x + .013, headBox.min.y - .09, hc.z - rz * .94], [hc.x - .015, headBox.min.y - .23, hc.z - .10]], function (t) { return .067 * (1 - .40 * t); }, 10, 20, true));
    A.rigid('hair', G.merge(locks), 'Head');
    return { materials: materials, weapon: null };
  });
})();
