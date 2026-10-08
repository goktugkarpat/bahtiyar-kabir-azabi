/* KABİR AZABI — BÖLÜM III yeni düşman modelleri: Taht Yasçısı (mourner) ve Mezar Kapancısı (snarer).
   ruins-models.js ile aynı yöntem: lisanslı ubc gövde + ölçülü (torsoFit / sleeve) kaplamalar; her parça `safe` bloğunda (biri patlarsa kadro düşmez).
   Yasçı: kemik-beyazı yas cüppesi, kafatası maskesi, kırık kemik taç, kaburga yakası, sarkan kemik çıngıraklar, çan asası, turkuaz-soluk ışık.
   Kapancı: kambur deri-koşum, sırtında üç demir diş-kapan, çapraz kemik-çivi kayışı, kolunda zincir, kemik boynuzlu başlık, kancalı kazma. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, G = B.Gear, TAU = Math.PI * 2;
  if (!B.Models || !B.Models.register) return;
  function arr(p) { return [p.x, p.y, p.z]; }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function safe(label, fn) { try { fn(); } catch (e) { if (window.console) console.warn('mobs-c3-models: ' + label, e); } }
  function torsoFit(A, chest) {
    var bones = ['spine_01', 'spine_02', 'spine_03'];
    var points = A.cloud ? A.cloud(bones, ['skin'], .25) : [], box = points.length ? A.box(points) : new T.Box3(new T.Vector3(chest.x - .24, chest.y - .28, chest.z - .18), new T.Vector3(chest.x + .24, chest.y + .22, chest.z + .18));
    var cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    function at(a, y, pad) { var best = 0, fallback = 0, score = Infinity; for (var i = 0; i < points.length; i++) { var p = points[i], dx = p.x - cx, dz = p.z - cz, r = Math.hypot(dx, dz), delta = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))), dy = Math.abs(p.y - y); if (dy < .065 && delta < .24) best = Math.max(best, r); var s = dy * 3 + delta * .15; if (s < score) { score = s; fallback = r; } } var r2 = (best || fallback || .2) + (pad || .024); return [cx + Math.sin(a) * r2, y, cz + Math.cos(a) * r2]; }
    function attach(key, g) { if (A.transfer) A.transfer(key, g, ['skin'], { bones: bones }); else A.rigid(key, g, 'spine_03'); }
    return { box: box, cx: cx, cz: cz, at: at, attach: attach };
  }
  function plateWear(g, edge) { return G.wear(g, { edge: edge == null ? .42 : edge, border: .35, curv: .006, cavity: .02 }); }
  var GLOW = [];
  function make(type, cfg) {
    cfg.chapter = 3; cfg.base = 'ubc';
    B.Models.register(type, cfg, function (A, C) {
      var mourner = type === 'mourner';
      var skin = A.addFrom(C.bases[cfg.base], function () { return true; }, 'skin')[0];
      var p = A.P('Head'), chest = A.P('spine_03'), hip = A.P('pelvis'), fitted = torsoFit(A, chest), fb = fitted.box, bw = Math.max(.34, fb.max.x - fb.min.x), torsoH = fb.max.y - fb.min.y;
      var tint = mourner ? [.72, .76, .76] : [.98, .80, .62], clothTint = mourner ? [.17, .17, .16] : [.20, .15, .10];
      var materials = {
        skin: C.bodyMaterial(A.srcMaterial('SuperHero_Male', C.bases[cfg.base]), 'c3-' + type + '-skin', { cls: 'skin', skin: 1, skinMap: false, sat: mourner ? .32 : .5, tint: tint, grime: mourner ? .3 : .55, blood: mourner ? .08 : .22, scale: 8, fresh: true }, { roughness: .72 }),
        iron: C.bodyMaterial(C.gearMaterial('iron'), 'c3-' + type + '-iron', { cls: 'metal', tint: mourner ? [.9, .92, .96] : [1.0, .88, .76], rust: mourner ? .22 : .46, grime: .42, wear: .5, scale: 8 }, { roughness: .64 }),
        leather: C.bodyMaterial(C.gearMaterial('leather'), 'c3-' + type + '-leather', { cls: 'leather', tint: mourner ? [.34, .32, .30] : [.58, .34, .18], grime: .4, blood: .16, scale: 7 }, { roughness: .86 }),
        rag: C.bodyMaterial(C.gearMaterial('rag'), 'c3-' + type + '-linen', { cls: 'cloth', tear: true, sat: .25, tint: clothTint, grime: mourner ? .32 : .55, blood: mourner ? .08 : .25, scale: 7 }, { roughness: .92, side: T.DoubleSide }),
        bone: C.bodyMaterial(C.gearMaterial('bone'), 'c3-' + type + '-bone', { cls: 'bone', tint: mourner ? [1.18, 1.14, .98] : [.95, .86, .66], grime: mourner ? .22 : .5, blood: .1, scale: 9 }, { roughness: .74 }),
        glow: new T.MeshStandardMaterial({ color: mourner ? 0x1f3a37 : 0x3a2a1a, emissive: mourner ? 0x58d0bc : 0xd8873a, emissiveIntensity: mourner ? .95 : .7, roughness: .45, metalness: .1 }),
        ash: C.bodyMaterial(C.gearMaterial('ash'), 'c3-' + type + '-ash', { cls: 'bone', tint: [.46, .45, .43], grime: .75, scale: 6 }, { roughness: .92 }),
        wood: C.bodyMaterial(C.gearMaterial('wood') || C.gearMaterial('leather'), 'c3-' + type + '-wood', { cls: 'leather', tint: [.5, .4, .3], grime: .5, scale: 7 }, { roughness: .88 })
      };
      GLOW.push({ mat: materials.glow, base: materials.glow.emissiveIntensity, type: type });
      function limbCover(key, from, to, t0, t1, pad, thickness, flare) {
        var q = C.sleeve(A, from, to, t0, t1, pad, thickness, ['skin'], flare, { u: 20, v: 6 });
        G.uvScale(q.geometry, .8, .7); G.wear(q.geometry, { edge: key === 'iron' ? .18 : 0, border: .2, cavity: .025, curv: .004 });
        A.transfer(key, q.geometry, ['skin'], { bones: [from, to] }); return q;
      }
      function boot(foot, toe, key) {
        var pts = A.cloud([foot, toe], ['skin'], .35), box = A.box(pts), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
        if (!pts.length) return;
        var w = Math.max(.054, sz.x * .54), len = Math.max(.13, sz.z * .55), base = box.min.y + .005;
        var shoe = G.shell(20, 7, function (u, v) { var a = u * TAU, e = v * Math.PI / 2, r = Math.pow(Math.max(0, Math.cos(e)), .35), toeShape = .92 + .08 * Math.cos(a); return [c.x + Math.sin(a) * w * toeShape * r, base + .018 + Math.sin(e) * Math.max(.12, sz.y * 1.02), c.z + Math.cos(a) * len * r]; }, .004, false, true);
        G.uvScale(shoe, .8, .7); A.rigid(key || 'leather', shoe, foot);
      }
      var weapon;
      if (mourner) {
        safe('mourner robe', function () {
          var top = hip.y + .07, bottom = Math.min(A.P('foot_l').y, A.P('foot_r').y) + .12, cloud = A.cloud(['pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'], ['skin'], .25);
          function radial(a, y) { var best = 0, fallback = .24, score = Infinity; for (var i = 0; i < cloud.length; i++) { var q = cloud[i], dx = q.x - hip.x, dz = q.z - hip.z, r = Math.hypot(dx, dz), df = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))), dy = Math.abs(q.y - y); if (dy < .07 && df < .3) best = Math.max(best, r); var sc = dy * 4 + df * .2; if (sc < score) { score = sc; fallback = r; } } return Math.max(.24, best || fallback) + .05; }
          // Wide funeral robe: heavy folds, a trailing hem, split up the front like a pall.
          var robe = G.shell(34, 14, function (u, v) { var gap = .08 + v * .22, a = gap + u * (TAU - gap * 2), y = top + (bottom - top) * v, r = radial(a, y) + v * .05 + Math.sin(a * 7 + v * 2) * .03 * v * v; return [hip.x + Math.sin(a) * r, y + Math.sin(a * 9) * .016 * v * v, hip.z + Math.cos(a) * r]; }, .003, false, true);
          G.uvScale(robe, 1, .9); G.wear(robe, { edge: 0, tear: { amount: .3, width: .02, bottom: .03, base: .01 } }); A.weighted('rag', robe, C.clothWeights(A, 'pelvis', 'thigh_l', 'thigh_r', top, bottom, .40));
          var cuirass = G.sheet(32, 14, function (u, v) { return fitted.at(u * TAU, fb.max.y - .014 - v * (torsoH - .07), .027); }, true, true); G.uvScale(cuirass, 1, 1); G.fillWear(cuirass); fitted.attach('rag', cuirass);
          ['l', 'r'].forEach(function (s) { limbCover('rag', 'upperarm_' + s, 'lowerarm_' + s, .07, .94, .026, .002, .02); limbCover('rag', 'lowerarm_' + s, 'hand_' + s, .02, .87, .028, .002, .02); boot('foot_' + s, 'ball_' + s, 'rag'); });
        });
        safe('mourner veil and hood', function () {
          var hc = A.cloud(['Head'], ['skin'], .55), hb = A.box(hc), h = hb.getCenter(new T.Vector3()), hs = hb.getSize(new T.Vector3());
          var hood = G.shell(28, 10, function (u, v) { var a = .8 + u * (TAU - 1.6), r = Math.max(.14, hs.x * .56) * Math.sin(v * Math.PI * .65) + .03 + v * v * .05; return [h.x + Math.sin(a) * r, hb.max.y + .05 + (hb.min.y - hb.max.y - .09) * v, h.z + Math.cos(a) * r - .014]; }, .003, false, true);
          G.uvScale(hood, .8, .8); G.fillWear(hood); A.rigid('rag', hood, 'Head');
          // long grave veil falling over the back from the crown
          var veil = G.sheet(16, 14, function (u, v) { var across = (u - .5) * (.34 + v * .30); return [h.x + across, hb.max.y + .02 - v * (hb.max.y - hip.y + .55), h.z - .17 - .08 * v + Math.sin(u * 15 + v * 5) * .014]; }, true);
          G.uvScale(veil, 2, 2.5); G.wear(veil, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .6, width: .04, bottom: .12, base: .03 } }); A.rigid('rag', veil, 'spine_03');
        });
        safe('mourner skull mask and crown', function () {
          var sk = G.skull(.24, true), q = V(p.x, p.y + .015, p.z + .105);
          var bone = G.merge(sk.parts.bone.map(function (g) { return g.translate(q.x, q.y, q.z); })), voids = G.merge(sk.parts.void.map(function (g) { return g.translate(q.x, q.y, q.z); }));
          G.uvScale(bone, 1, 1); plateWear(bone, .2); A.rigid('bone', bone, 'Head'); A.rigid('ash', voids, 'Head');
          // pale grief-light inside the eye sockets
          A.rigid('glow', G.merge([G.sphere(.016, [p.x - .038, p.y + .0, p.z + .152], [1.2, .9, .6], 8, 6), G.sphere(.016, [p.x + .038, p.y + .0, p.z + .152], [1.2, .9, .6], 8, 6)]), 'Head');
          // Broken royal crown: unequal bone tines, one snapped short.
          var tines = [];
          for (var i = 0; i < 7; i++) { var a = i / 7 * TAU, rr = .125, base = p.clone().add(V(Math.sin(a) * rr, .12, Math.cos(a) * rr)), tall = [.30, .12, .24, .08, .33, .16, .21][i]; tines.push(G.spike(.03, base, base.clone().add(V(Math.sin(a) * .06, tall, Math.cos(a) * .06)))); }
          tines.push(G.ring(.128, .014, [p.x, p.y + .125, p.z], [0, 0, 0], 6, 22));
          A.rigid('bone', G.merge(tines), 'Head');
        });
        safe('mourner rib collar and chimes', function () {
          // Exposed rib cage worn like a gorget over the robe: five bone ribs wrapping the front of the chest.
          var ribs = [];
          for (var i = 0; i < 6; i++) { var pts = []; for (var j = 0; j < 9; j++) { var a = -1.25 + j * (2.5 / 8); pts.push(fitted.at(a, fb.max.y - .035 - i * .075 - Math.abs(Math.sin(a)) * .018, .05 + (i % 2) * .006 + Math.cos(a) * .008)); } ribs.push(G.tube(pts, .0105, 5, 20, false)); }
          ribs.push(G.tube([fitted.at(0, fb.max.y - .01, .056), fitted.at(0, fb.max.y - .2, .062), fitted.at(0, fb.max.y - .45, .058)], .014, 6, 12, true));
          fitted.attach('bone', G.merge(ribs));
          // Chimes: bone plates and tiny iron bells on cords hanging from the belt, they sway with the pelvis.
          var cords = [], plates = [], bells = [];
          for (var k = 0; k < 7; k++) { var a2 = -2.2 + k * .72, bx = hip.x + Math.sin(a2) * .26, bz = hip.z + Math.cos(a2) * .22, len = .26 + (k % 3) * .11; cords.push(G.tube([[bx, hip.y + .04, bz], [bx, hip.y - len * .5, bz], [bx, hip.y - len, bz]], .004, 4, 8, false)); plates.push(G.box(.045, .09, .012, [bx, hip.y - len - .04, bz], [0, a2, 0])); if (k % 2) bells.push(G.sphere(.022, [bx, hip.y - len + .02, bz], [1, 1.1, 1], 8, 6)); }
          A.rigid('leather', G.merge(cords), 'pelvis'); A.rigid('bone', G.merge(plates), 'pelvis'); A.rigid('iron', G.merge(bells), 'pelvis');
          // glowing keening-knot at the breastbone
          A.rigid('iron', G.ring(.05, .009, [chest.x, chest.y + .08, chest.z + .165], [Math.PI / 2.2, 0, 0], 6, 18), 'spine_03'); A.rigid('glow', G.sphere(.021, [chest.x, chest.y + .08, chest.z + .176], [1, 1.2, .7], 8, 6), 'spine_03');
        });
        // Staff with a cracked grave bell, hanging bone clapper, grief-light inside.
        var bell = G.lathe ? null : null;
        var bellGeo = G.merge([G.cyl(.05, .19, .26, 16, [0, 1.12, 0], null, true), G.cyl(.19, .20, .03, 16, [0, .985, 0], null, true), G.ring(.19, .014, [0, .985, 0], [0, 0, 0], 6, 22), G.sphere(.06, [0, 1.27, 0], [1, .8, 1], 10, 6)]);
        plateWear(bellGeo, .3);
        weapon = { parts: { wood: [G.cyl(.024, .036, 1.45, 9, [0, .5, 0])], iron: [bellGeo, G.ring(.045, .012, [0, 1.36, 0], [Math.PI / 2, 0, 0], 6, 16), G.cyl(.04, .03, .09, 8, [0, .06, 0])], bone: [G.spike(.02, V(0, 1.1, 0), V(0, .94, .0)), G.sphere(.032, [0, .93, 0], [1, 1.1, 1], 8, 6)], glow: [G.sphere(.026, [0, 1.09, 0], [1, 1.2, 1], 8, 6)] }, tip: new T.Vector3(0, 1.45, 0) };
      } else {
        safe('snarer leather', function () {
          ['l', 'r'].forEach(function (s) { limbCover('leather', 'thigh_' + s, 'calf_' + s, .04, 1.02, .018, .003, .012); limbCover('leather', 'calf_' + s, 'foot_' + s, -.02, .88, .02, .003, .008); limbCover('rag', 'upperarm_' + s, 'lowerarm_' + s, .12, .9, .02, .002, .012); boot('foot_' + s, 'ball_' + s); });
          var cuirass = G.sheet(32, 14, function (u, v) { return fitted.at(u * TAU, fb.max.y - .012 - v * (torsoH - .075), .028); }, true, true); G.uvScale(cuirass, 2.5, 2); fitted.attach('leather', cuirass);
          var belt = G.sheet(28, 3, function (u, v) { var a = u * TAU; return [hip.x + Math.sin(a) * .235, hip.y + .05 - v * .10, hip.z + Math.cos(a) * .20]; }, true, true); G.uvScale(belt, 3, 1); A.rigid('leather', belt, 'pelvis');
          // short hanging skirt of rag strips
          var skirt = G.sheet(28, 10, function (u, v) { var a = u * TAU, r = .22 + v * .06; return [hip.x + Math.sin(a) * r, hip.y + .06 - v * .42 + Math.sin(a * 9) * .04 * v, hip.z + Math.cos(a) * r]; }, true); G.uvScale(skirt, 3, 2); A.rigid('rag', skirt, 'pelvis');
        });
        safe('snarer hood and bone horns', function () {
          var hc = A.cloud(['Head'], ['skin'], .55), hb = A.box(hc), h = hb.getCenter(new T.Vector3()), hs = hb.getSize(new T.Vector3());
          var hood = G.shell(28, 10, function (u, v) { var a = .62 + u * (TAU - 1.24), r = Math.max(.14, hs.x * .56) * Math.sin(v * Math.PI * .65) + .028 + v * v * .05; return [h.x + Math.sin(a) * r, hb.max.y + .045 + (hb.min.y - hb.max.y - .08) * v, h.z + Math.cos(a) * r - .01]; }, .003, false, true);
          G.uvScale(hood, .8, .8); G.fillWear(hood); A.rigid('leather', hood, 'Head');
          // lower-face jaw plate of bone, lashed on: only the eyes show
          var jaw = G.shell(14, 6, function (u, v) { var a = (u - .5) * 2.0, y = hb.min.y + hs.y * (.36 - v * .30); return [h.x + Math.sin(a) * (hs.x * .55 + .03 + v * .01), y, h.z + Math.cos(a) * (hs.z * .55 + .02 + .02 * Math.sin(v * 3))]; }, .008, false, true);
          G.uvScale(jaw, 1, 1); plateWear(jaw, .2); A.rigid('bone', jaw, 'Head');
          var teeth = []; for (var i = 0; i < 7; i++) { var a = (i - 3) * .22, q = V(h.x + Math.sin(a) * (hs.x * .56 + .04), hb.min.y + hs.y * .27, h.z + Math.cos(a) * (hs.z * .56 + .035)); teeth.push(G.spike(.011, q, q.clone().add(V(0, -.04 - (i % 2) * .02, .012)))); }
          A.rigid('bone', G.merge(teeth), 'Head');
          // two curved bone horns rising from the hood
          var horns = []; [-1, 1].forEach(function (s) { horns.push(G.tube([[h.x + s * .1, hb.max.y + .02, h.z - .02], [h.x + s * .19, hb.max.y + .12, h.z - .03], [h.x + s * .20, hb.max.y + .26, h.z + .02], [h.x + s * .14, hb.max.y + .33, h.z + .07]], function (t) { return .024 * (1 - t) + .004; }, 6, 16, true)); });
          A.rigid('bone', G.merge(horns), 'Head');
          // warm amber eye-glints under the cowl
          A.rigid('glow', G.merge([G.sphere(.012, [p.x - .04, p.y + .03, p.z + .108], [1.3, .6, .6], 6, 4), G.sphere(.012, [p.x + .04, p.y + .03, p.z + .108], [1.3, .6, .6], 6, 4)]), 'Head');
        });
        safe('snarer back traps', function () {
          // Three iron tooth-traps strapped to the back, stacked and tilted: the toothed rings read from the isometric camera.
          var iron = [], teeth = [], straps = [];
          for (var k = 0; k < 3; k++) {
            var cy = chest.y + .16 - k * .17, cz = fb.min.z - .09 - k * .035, cx = fitted.cx + (k - 1) * .13, tilt = -.35 + k * .1;
            var disc = G.merge([G.ring(.15, .018, [0, 0, 0], [Math.PI / 2, 0, 0], 6, 22), G.ring(.09, .012, [0, 0, 0], [Math.PI / 2, 0, 0], 6, 16), G.cyl(.012, .012, .30, 6, [0, 0, 0], [0, 0, Math.PI / 2])]);
            disc.rotateX(tilt).translate(cx, cy, cz); iron.push(disc);
            for (var i = 0; i < 10; i++) { var a = i / 10 * TAU, r0 = .15, bp = V(Math.sin(a) * r0, 0, Math.cos(a) * r0 * 1.0), tp = V(Math.sin(a) * r0 * .55, .085, Math.cos(a) * r0 * .55); var tooth = G.spike(.014, bp, tp, 4); tooth.rotateX(tilt).translate(cx, cy, cz); teeth.push(tooth); }
          }
          straps.push(G.tube([[chest.x - .22, chest.y + .22, chest.z + .1], [chest.x - .2, chest.y + .14, fb.min.z - .06], [chest.x + .02, chest.y - .05, fb.min.z - .06], [chest.x + .22, chest.y - .24, chest.z + .1]], .017, 6, 16, false));
          straps.push(G.tube([[chest.x + .22, chest.y + .22, chest.z + .1], [chest.x + .2, chest.y + .14, fb.min.z - .06], [chest.x - .02, chest.y - .05, fb.min.z - .06], [chest.x - .22, chest.y - .24, chest.z + .1]], .017, 6, 16, false));
          A.rigid('iron', G.merge(iron), 'spine_03'); A.rigid('bone', G.merge(teeth), 'spine_03'); A.rigid('leather', G.merge(straps), 'spine_03');
        });
        safe('snarer spike bandolier and chain', function () {
          // bandolier of bone pegs across the chest
          var pegs = [], band = fitted.at(0, fb.max.y - .06, .05);
          for (var i = 0; i < 7; i++) { var t = i / 6, a = -.95 + t * 1.8, y = fb.max.y - .05 - t * (torsoH * .6), q = fitted.at(a, y, .062); pegs.push(G.spike(.011, V(q[0], q[1], q[2]), V(q[0] + .01, q[1] + .12, q[2] + .022), 5)); }
          fitted.attach('bone', G.merge(pegs));
          fitted.attach('leather', G.sheet(4, 16, function (u, v) { var a = -.95 + v * 1.8, y = fb.max.y - .04 - v * (torsoH * .6); return fitted.at(a, y + (u - .5) * .055, .046); }, false, true));
          // heavy chain coiled from the left shoulder down the forearm
          var sh = A.P('upperarm_l'), lo = A.P('lowerarm_l'), pts = []; for (var j = 0; j < 14; j++) { var t2 = j / 13, a2 = t2 * 9; pts.push([sh.x - .02 + Math.sin(a2) * .075, sh.y - .06 - t2 * (sh.y - lo.y) * .95, sh.z + Math.cos(a2) * .075]); }
          A.rigid('iron', G.merge(G.chain ? [].concat(G.chain(pts, .03, 0)) : [G.tube(pts, .01, 5, 28, false)]), 'upperarm_l');
          A.rigid('iron', G.merge([G.sphere(.12, arr(A.P('upperarm_l').clone().add(V(0, .015, 0))), [1.05, .45, .95], 14, 8)]), 'upperarm_l');
          // iron collar with a tooth-trap ring at the throat
          A.rigid('iron', G.tube([[chest.x - .2, chest.y + .2, chest.z], [chest.x - .1, chest.y + .27, chest.z - .085], [chest.x + .1, chest.y + .27, chest.z - .085], [chest.x + .2, chest.y + .2, chest.z]], .026, 8, 20, true), 'spine_03');
        });
        // Hooked trapper's pick: a long haft, an iron hook and a bone barb; reads as the tool that sets the jaws.
        var hook = G.merge([G.tube([[0, .98, 0], [0, 1.08, .0], [0, 1.16, .1], [0, 1.08, .19], [0, .98, .17]], function (t) { return .032 * (1 - t) + .008; }, 7, 20, true), G.spike(.034, V(0, 1.0, 0), V(0, 1.25, 0), 6)]);
        plateWear(hook, .35);
        weapon = { parts: { wood: [G.cyl(.03, .042, 1.06, 9, [0, .46, 0])], iron: [hook, G.ring(.05, .012, [0, .96, 0], [Math.PI / 2, 0, 0], 6, 18), G.cyl(.045, .04, .08, 8, [0, -.1, 0])], bone: [G.spike(.02, V(.0, .94, -.02), V(0, 1.02, -.16), 5)], leather: [G.cyl(.043, .043, .2, 8, [0, .08, 0])] }, tip: new T.Vector3(0, 1.22, .1) };
      }
      weapon.materials = { ash: materials.ash, glow: materials.glow, iron: materials.iron, leather: materials.leather, wood: materials.wood, bone: materials.bone };
      return { materials: materials, weapon: weapon };
    });
  }
  make('mourner', { height: 2.55, radius: .46, motionType: 'cultist' });
  make('snarer', { height: 2.0, radius: .5, motionType: 'stalker' });
  B.MobsC3Models = { types: ['mourner', 'snarer'], glow: GLOW };
}());
