/* KABİR AZABI — BÖLÜM 1 (Kurban Tapınağı) için iki yeni düşman türü (ajan EN1).
     shacklewarden  Pranga Bekçisi  — TUZAK KURUCU / alan kontrolü. Zindan bekçisi: kanca-sopa, sırtında demir kapan.
        Kanca Darbesi  (altın)  kısa kanca savurma           Anahtar Topuzu (altın) yakın itme
        Pranga Tuzağı  (özel)   kahramanın durduğu yere + iki yanına 3 demir pranga düşer (daire uyarısı 1.2-1.6 sn),
                                ilki kapandıktan sonra kısa süre dikenli kalır ("Açık Pranga")
        Zincir Çarkı   (özel)   etrafında dönen zincir halkası, KIRMIZI = engellenemez; halkanın içine/dışına yuvarlan
     dirgeweeper    Ağıtçı          — DESTEK / menzilli. Peçeli yas tutucu; arkada durur.
        Matem Mührü    (özel)   diz çöküp 1.4 sn ağıt: yakındaki 3 dosta 6 sn "yas kalkanı" (aldıkları hasar -%45). Sersemlerse ya da ölürse bozulur.
        Yas Çığlığı    (özel)   üç çizgilik uzun yelpaze, çizgiler arasından geç
        Ağıt Nefesi    (altın)  yakına gelene itme halkası
   TÜM SAYILAR AŞAĞIDAKİ `TUNE` NESNESİNDE (denge ajanı yalnız burayı değiştirir).
   Kancalar: combat.js (STATS birleştirme, create, dağıtım), world.js (yerleştirme), target-hud.js (portre), audio.js (tablolar), index.html/sw.js. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, TAU = Math.PI * 2;
  var tr = function (s) { return window.KabirI18n ? KabirI18n.t(s) : s; };

  // ================================================================= KOLAY AYAR (tek yer)
  var TUNE = {
    shacklewarden: { hp: 165, speed: 2.05, radius: .52, reach: 7, cooldown: 1.7,
      hook: { dmg: 12, warn: .85, radius: 3.6, arc: 1.5 }, pommel: { dmg: 9, warn: .7 },
      trap: { dmg: 14, warn: 1.25, radius: 1.35, count: 3, linger: 3, lingerDmg: 3 },
      whirl: { dmg: 18, warn: 1.15, outer: 4.4, inner: 1.1 } },
    dirgeweeper: { hp: 120, speed: 1.9, radius: .46, reach: 12, cooldown: 2.6,
      ward: { cut: .45, secs: 6, max: 3, range: 9, warn: 1.4, cd: 11 },
      wail: { dmg: 13, warn: 1.05, width: 1.2, length: 12, fan: .3 }, breath: { dmg: 10, warn: .9, radius: 3.4 } },
    // Yerleşim: oda kimliği -> eklenecek türler (kısaltma: S pranga bekçisi, D ağıtçı). Eğitim odaları (eşik, avlu) hariç.
    place: { infirmary: 'D', offering: 'SD', ossuary: 'SD', 'temple-side-7': 'D', 'temple-side-8': 'SD', 'temple-side-10': 'S', 'temple-side-11': 'SD', 'temple-side-12': 'S*D' },
    eliteName: 'Zindan Bekçibaşı'
  };

  // ================================================================= çeviriler
  var L = {
    'Pranga Bekçisi': 'Shackle Warden', 'Ağıtçı': 'Dirge-Weeper', 'Zindan Bekçibaşı': 'Head Gaoler',
    'Kanca Darbesi': 'Hook Strike', 'Anahtar Topuzu': 'Key Pommel', 'Pranga Tuzağı': 'Shackle Trap', 'Açık Pranga': 'Open Shackle', 'Zincir Çarkı': 'Chain Wheel',
    'Matem Mührü': 'Mourning Ward', 'Yas Çığlığı': 'Wail of Grief', 'Ağıt Nefesi': 'Dirge Breath', 'Yas Kalkanı': 'Mourning Shield',
    'Pranga Bekçisi · kanca': 'Shackle Warden · hook'
  };
  (function () { var d = window.KabirI18n && KabirI18n.dictionary; if (d) for (var k in L) if (d[k] === undefined) d[k] = L[k]; })();

  // ================================================================= istatistikler (combat.js STATS'a eklenir)
  var stats = {
    shacklewarden: { name: tr('Pranga Bekçisi'), hp: TUNE.shacklewarden.hp, speed: TUNE.shacklewarden.speed, radius: TUNE.shacklewarden.radius, reach: TUNE.shacklewarden.reach, cooldown: TUNE.shacklewarden.cooldown, color: 0x9a8f86, c1: true },
    dirgeweeper: { name: tr('Ağıtçı'), hp: TUNE.dirgeweeper.hp, speed: TUNE.dirgeweeper.speed, radius: TUNE.dirgeweeper.radius, reach: TUNE.dirgeweeper.reach, cooldown: TUNE.dirgeweeper.cooldown, color: 0xb7a9b8, c1: true, ranged: true }
  };

  // ================================================================= animasyon / sarkan parçalar / ses takma adları
  if (B.AuthoredMotion && B.AuthoredMotion.late) {
    B.AuthoredMotion.late.shacklewarden = { hunch: .12, sink: .34, lunge: .09, death: 1.15, buckle: .22, thud: 1, hurt: .8 };
    B.AuthoredMotion.late.dirgeweeper = { sink: .08, lunge: .02, death: 1.8, buckle: 0, thud: 0, hurt: 1.2 };
  }
  if (B.EnemyDread && B.EnemyDread.kit) {
    // c zincir, k zincir+kanca, p zincir+asma kilit, s sarkan şerit, g zincir+parlayan mühür
    B.EnemyDread.kit.shacklewarden = [['p', 'pelvis', 1.25, 0, .34], ['k', 'pelvis', -1.2, 0, .5], ['c', 's3', 3.14, 0, .55], ['c', 'foreL', 0, 0, .3]];
    B.EnemyDread.kit.dirgeweeper = [['s', 's3', 2.9, .08, .85], ['s', 's3', 3.4, .08, .9], ['s', 'foreL', 0, 0, .42], ['s', 'foreR', 0, 0, .42], ['g', 'pelvis', .4, 0, .4]];
    if (B.EnemyDread.posture) {
      B.EnemyDread.posture.shacklewarden = { s2: .18, s3: .12, neck: -.06, head: -.14 };
      B.EnemyDread.posture.dirgeweeper = { s3: .1, neck: .2, head: -.1 };
    }
  }
  var ALIAS = { shacklewarden: 'ashwarden', dirgeweeper: 'shardseer' };   // enemyWindup / enemyAttack seslerinde mevcut ses karakterleri

  // ================================================================= modeller
  var G = B.Gear;
  function arr(p) { return [p.x, p.y, p.z]; }
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function safe(label, fn) { try { fn(); } catch (e) { if (window.console) console.warn('mobs-c1: ' + label, e); } }
  function torsoFit(A, chest) {
    var bones = ['spine_01', 'spine_02', 'spine_03'];
    var points = A.cloud ? A.cloud(bones, ['skin'], .25) : [], box = points.length ? A.box(points) : new T.Box3(new T.Vector3(chest.x - .24, chest.y - .28, chest.z - .18), new T.Vector3(chest.x + .24, chest.y + .22, chest.z + .18));
    var cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    function at(a, y, pad) { var best = 0, fb = 0, score = Infinity; for (var i = 0; i < points.length; i++) { var p = points[i], dx = p.x - cx, dz = p.z - cz, r = Math.hypot(dx, dz), delta = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))), dy = Math.abs(p.y - y); if (dy < .065 && delta < .24) best = Math.max(best, r); var s = dy * 3 + delta * .15; if (s < score) { score = s; fb = r; } } var r2 = (best || fb || .2) + (pad || .024); return [cx + Math.sin(a) * r2, y, cz + Math.cos(a) * r2]; }
    function attach(key, g) { if (A.transfer) A.transfer(key, g, ['skin'], { bones: bones }); else A.rigid(key, g, 'spine_03'); }
    return { box: box, cx: cx, cz: cz, at: at, attach: attach };
  }
  function plateWear(g, edge) { return G.wear(g, { edge: edge == null ? .42 : edge, border: .35, curv: .006, cavity: .02 }); }

  function make(type, cfg, build) {
    B.Models.register(type, cfg, function (A, C) {
      var head = 'Head', spine = 'spine_03', handL = 'hand_l', handR = 'hand_r', armL = 'upperarm_l', armR = 'upperarm_r', thighL = 'thigh_l', thighR = 'thigh_r';
      var skin = A.addFrom(C.bases.ubc, function () { return true; }, 'skin')[0];
      var ward = type === 'shacklewarden';
      if (ward) { A.lengthen({ upperarm_l: 1.08, upperarm_r: 1.08, lowerarm_l: 1.1, lowerarm_r: 1.1, hand_l: 1.12, hand_r: 1.12 }); var fat = {}; fat[spine] = 1.14; fat.spine_02 = 1.1; fat.upperarm_l = 1.12; fat.upperarm_r = 1.12; A.slim(skin, fat, 1); }
      else { A.lengthen({ spine_02: 1.06, spine_03: 1.06, neck_01: 1.14, lowerarm_l: 1.12, lowerarm_r: 1.12, hand_l: 1.16, hand_r: 1.16 }); var thin = {}; thin[spine] = .82; thin.spine_02 = .84; thin.upperarm_l = .8; thin.upperarm_r = .8; thin.lowerarm_l = .86; thin.lowerarm_r = .86; A.slim(skin, thin, 1); }
      var p = A.P(head), chest = A.P(spine), hip = A.P('pelvis');
      var fitted = torsoFit(A, chest), fb = fitted.box, bw = Math.max(.34, fb.max.x - fb.min.x), torsoH = fb.max.y - fb.min.y;
      var materials = {
        skin: C.bodyMaterial(A.srcMaterial('SuperHero_Male', C.bases.ubc), 'c1-' + type + '-skin', { cls: 'skin', skin: 1, sat: ward ? .05 : .16, tint: ward ? [.6, .62, .68] : [.95, .93, 1.05], grime: ward ? .62 : .35, blood: ward ? .42 : .18, scale: 8, fresh: true }, { roughness: .72 }),
        iron: C.bodyMaterial(C.gearMaterial('iron'), 'c1-' + type + '-iron', { cls: 'metal', sat: ward ? .12 : .4, tint: ward ? [.46, .52, .66] : [.7, .72, .8], rust: ward ? .05 : .2, grime: ward ? .5 : .45, wear: .6, scale: 8 }, { roughness: .6 }),
        bright: C.bodyMaterial(C.gearMaterial('iron'), 'c1-' + type + '-bright', { cls: 'metal', sat: .2, tint: [1.1, 1.15, 1.3], rust: .05, grime: .25, wear: .7, scale: 8 }, { roughness: .5 }),
        leather: C.bodyMaterial(C.gearMaterial('leather'), 'c1-' + type + '-leather', { cls: 'leather', sat: ward ? .3 : 1, tint: ward ? [.2, .17, .15] : [.46, .27, .16], grime: .5, blood: ward ? .3 : .1, scale: 7 }, { roughness: .88 }),
        rag: C.bodyMaterial(C.gearMaterial('rag'), 'c1-' + type + '-linen', { cls: 'cloth', tear: true, sat: .2, tint: ward ? [.09, .09, .10] : [.15, .14, .18], grime: .55, blood: ward ? .3 : .12, scale: 7 }, { roughness: .94, side: T.DoubleSide }),
        bone: C.bodyMaterial(C.gearMaterial('bone'), 'c1-' + type + '-bone', { cls: 'bone', tint: [1.0, .92, .76], grime: .45, blood: .2, scale: 9 }, { roughness: .78 }),
        ash: C.bodyMaterial(C.gearMaterial('ash'), 'c1-' + type + '-ash', { cls: 'bone', tint: [.42, .4, .38], grime: .8, scale: 6 }, { roughness: .92 }),
        glow: new T.MeshStandardMaterial({ color: 0x3a2a16, emissive: ward ? 0xff7a2c : 0xe8b66a, emissiveIntensity: ward ? .55 : 1.6, roughness: .5, metalness: .1 })
      };
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
      var ctx = { A: A, C: C, G: G, T: T, V: V, arr: arr, safe: safe, materials: materials, head: head, spine: spine, handL: handL, handR: handR, armL: armL, armR: armR, thighL: thighL, thighR: thighR,
        p: p, chest: chest, hip: hip, fitted: fitted, fb: fb, bw: bw, torsoH: torsoH, limbCover: limbCover, boot: boot, plateWear: plateWear, skin: skin };
      var weapon = build(ctx);
      if (weapon) weapon.materials = { bright: materials.bright, iron: materials.iron, leather: materials.leather, bone: materials.bone, glow: materials.glow, ash: materials.ash };
      return { materials: materials, weapon: weapon };
    });
  }

  // ---- Pranga Bekçisi: kapüşonsuz kaba bekçi; demir kova miğfer, sol omuzda koca pranga halkası, sırtta dişli kapan, belde anahtar halkası
  function buildWarden(x) {
    var A = x.A, C = x.C, T_ = x.T, V_ = x.V, fitted = x.fitted, fb = x.fb, chest = x.chest, hip = x.hip, p = x.p, arr_ = x.arr, mat = x.materials, safe_ = x.safe;
    safe_('cuirass', function () {
      var cuirass = G.sheet(32, 14, function (u, v) { return fitted.at(u * TAU, fb.max.y - .012 - v * (fb.max.y - fb.min.y - .075), .028); }, true, true); G.uvScale(cuirass, 2.5, 2); fitted.attach('leather', cuirass);
      var belt = G.sheet(28, 3, function (u, v) { var a = u * TAU; return [hip.x + Math.sin(a) * .24, hip.y + .05 - v * .10, hip.z + Math.cos(a) * .20]; }, true, true); G.uvScale(belt, 3, 1); A.rigid('leather', belt, 'pelvis');
      fitted.attach('leather', G.sheet(4, 16, function (u, v) { var a = -.95 + v * 1.9, y = fb.max.y - .04 - v * (x.torsoH * .7); return fitted.at(a, y + (u - .5) * .07, .046); }, false, true));
    });
    safe_('lames', function () {
      var list = [];
      for (var i = 0; i < 3; i++) (function (i) { var yTop = fb.max.y - .16 - i * .10; list.push(plateWear(G.shell(24, 2, function (u, v) { var a = u * TAU, front = Math.max(0, Math.cos(a)), crest = Math.pow(front, 8) * .014 * Math.sin(v * Math.PI); return fitted.at(a, yTop - v * .11 - .014 * front * front * Math.sin(v * Math.PI), .032 + i * .004 + v * .03 + crest); }, .011, true, true), .38)); })(i);
      fitted.attach('iron', G.merge(list));
    });
    safe_('pauldron + shackle ring', function () {
      var qL = A.P(x.armL), qR = A.P(x.armR), plates = [];
      for (var i = 0; i < 3; i++) plates.push(plateWear(G.sphere(.16 - i * .022, arr_(qL.clone().add(V_(0, .03 - i * .05, 0))), [1.12, .52, 1.04], 12, 6), .4));
      for (var s = 0; s < 3; s++) plates.push(G.spike(.022, qL.clone().add(V_(-.1 + s * .1, .07, 0)), qL.clone().add(V_(-.12 + s * .12, .22 + s % 2 * .05, -.03))));
      A.rigid('iron', G.merge(plates), x.armL);
      A.rigid('bright', G.ring(.075, .016, arr_(qL.clone().add(V_(-.02, -.05, .09))), [.3, .4, 0], 6, 18), x.armL);   // pranga halkası omuza kaynaklı
      A.rigid('leather', G.sphere(.12, arr_(qR.clone().add(V_(0, .015, 0))), [1.05, .5, .95], 12, 6), x.armR);
      var collar = G.tube([[chest.x - .21, chest.y + .20, chest.z], [chest.x - .10, chest.y + .27, chest.z - .09], [chest.x + .10, chest.y + .27, chest.z - .09], [chest.x + .21, chest.y + .20, chest.z]], .028, 8, 20, true); A.rigid('iron', collar, x.spine);
      A.rigid('iron', G.ring(.055, .010, [chest.x - .045, chest.y + .05, chest.z + .17], [0, 0, .3], 6, 20), x.spine);
    });
    safe_('helm', function () {
      var hp = A.cloud([x.head], ['skin'], .6), hb = A.box(hp), hc = hb.getCenter(new T_.Vector3()), hs = hb.getSize(new T_.Vector3());
      var helm = G.greatHelm(Math.max(hs.x, hs.z) * .5 + .014, hs.y + .03), M = new T_.Matrix4().makeTranslation(hc.x, hc.y + .005, hc.z + .006), map = { iron: 'iron', edge: 'iron', brass: 'iron', dark: 'ash', 'void': 'ash' };
      Object.keys(helm.parts).forEach(function (k) { helm.parts[k].forEach(function (g) { g.applyMatrix4(M); A.rigid(map[k] || 'iron', g, x.head); }); });
      // kasket kenarından sarkan kan lekeli bez (yüz perdesi değil, boyun örtüsü)
      var nape = G.sheet(14, 8, function (u, v) { var a = Math.PI + (u - .5) * 2.2; return [hc.x + Math.sin(a) * (hs.x * .56 + v * .02), hb.min.y + .02 - v * .22, hc.z + Math.cos(a) * (hs.z * .56 + v * .025)]; }, false, true); G.uvScale(nape, 1.5, 1.5);
      G.wear(nape, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .5, width: .04, bottom: .1, base: .02 } }); A.rigid('rag', nape, x.head);
    });
    safe_('back trap', function () {
      // sırtta dişli demir kapan (iki yarım halka + dişler), deri kayışla bağlı
      var cx = fitted.cx, cy = chest.y - .06, cz = fb.min.z - .11, parts = [], teeth = [];
      parts.push(plateWear(G.ring(.21, .024, [cx, cy, cz], [Math.PI / 2 - .2, 0, 0], 6, 26), .35));
      parts.push(G.ring(.21, .016, [cx, cy - .05, cz + .012], [Math.PI / 2 - .2, 0, 0], 5, 26));
      for (var i = 0; i < 12; i++) { var a = i / 12 * TAU, b = V_(cx + Math.cos(a) * .2, cy + Math.sin(a) * .2 * Math.sin(Math.PI / 2 - .2) + .0, cz - Math.sin(a) * .0); teeth.push(G.spike(.018, V_(cx + Math.cos(a) * .2, cy + .02, cz + Math.sin(a) * .2 * Math.cos(.2) * -1), V_(cx + Math.cos(a) * .12, cy + .06 + (i % 2) * .03, cz + Math.sin(a) * .12 * -1))); }
      parts.push(G.merge(teeth)); parts.push(G.cyl(.02, .02, .42, 8, [cx + .0, cy + .0, cz], [0, 0, Math.PI / 2]));
      A.rigid('bright', G.merge(parts), x.spine);
      var straps = []; [-1, 1].forEach(function (s) { straps.push(G.tube([[chest.x + s * .20, chest.y + .26, fb.min.z - .015], [cx + s * .15, cy + .1, cz + .02], [chest.x + s * .18, chest.y - .2, fb.min.z - .015]], .016, 6, 14, false)); });
      A.rigid('leather', G.merge(straps), x.spine);
    });
    safe_('keys', function () {
      var base = V_(hip.x + .22, hip.y - .01, hip.z + .05), ks = [G.ring(.055, .009, arr_(base), [0, 0, 0], 6, 18)];
      for (var i = 0; i < 5; i++) { var a = i / 5 * TAU, q = base.clone().add(V_(Math.sin(a) * .055, -.045 - (i % 2) * .02, Math.cos(a) * .055)); ks.push(G.cyl(.006, .006, .07, 5, arr_(q))); ks.push(G.box(.022, .018, .006, arr_(q.clone().add(V_(0, -.045, 0))))); }
      A.rigid('bright', G.merge(ks), 'pelvis');
    });
    safe_('cloth + limbs', function () {
      var skirt = G.sheet(28, 10, function (u, v) { var a = u * TAU, r = .22 + v * .06; return [hip.x + Math.sin(a) * r, hip.y + .06 - v * .5 + Math.sin(a * 9) * .03 * v, hip.z + Math.cos(a) * r]; }, true); G.uvScale(skirt, 3, 2);
      G.wear(skirt, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .5, width: .04, bottom: .1, base: .03 } }); A.rigid('rag', skirt, 'pelvis');
      x.limbCover('iron', 'lowerarm_l', 'hand_l', .1, .86, .026, .004, .02);
      x.limbCover('leather', 'lowerarm_r', 'hand_r', .08, .86, .022, .003, .012);
      x.limbCover('iron', 'lowerarm_r', 'hand_r', .78, .98, .03, .006, .02);   // sağ bilekte pranga
      x.limbCover('rag', 'upperarm_r', 'lowerarm_r', .12, .9, .02, .002, .012);
      ['l', 'r'].forEach(function (s) { x.limbCover('leather', 'thigh_' + s, 'calf_' + s, .05, 1.0, .02, .003, .01); x.limbCover('iron', 'calf_' + s, 'foot_' + s, .45, .78, .02, .005, .02); x.boot('foot_' + s, 'ball_' + s); });
    });
    // kanca-sopa: uzun sap, demir kanca, kilit halkası
    var T2 = T_.Vector3;
    return { parts: { leather: [G.cyl(.03, .038, 1.5, 8, [0, .55, 0]), G.tube([[.0, 0, 0], [0, .12, 0]], .045, 6, 4, true)],
      iron: [G.tube([[0, 1.25, 0], [0, 1.40, .0], [0, 1.50, .09], [0, 1.44, .21], [0, 1.30, .22]], function (t) { return .026 * (1 - t * .55); }, 6, 22, true), G.ring(.062, .013, [0, 1.22, 0], [Math.PI / 2, 0, 0], 6, 18), G.cyl(.045, .04, .09, 8, [0, 1.17, 0]), G.spike(.04, new T2(0, 1.28, 0), new T2(0, 1.44, -.02)), G.ring(.05, .008, [.0, .92, .0], [0, 0, 0], 6, 14)] },
      tip: new T2(0, 1.45, .12) };
  }

  // ---- Ağıtçı: peçeli, ince, yas tutan; yere değen kefen, omuzlarda yırtık manto, göğüste zincirli yemin levhaları, elinde mum-asa
  function buildMourner(x) {
    var A = x.A, C = x.C, T_ = x.T, V_ = x.V, fitted = x.fitted, fb = x.fb, chest = x.chest, hip = x.hip, p = x.p, arr_ = x.arr, safe_ = x.safe;
    safe_('shroud', function () {
      var top = hip.y + .07, bottom = Math.min(A.P('foot_l').y, A.P('foot_r').y) + .06, cloud = A.cloud(['pelvis', x.thighL, x.thighR, 'calf_l', 'calf_r'], ['skin'], .25);
      function radial(a, y) { var best = 0, fb2 = .24, score = Infinity; for (var i = 0; i < cloud.length; i++) { var q = cloud[i], dx = q.x - hip.x, dz = q.z - hip.z, r = Math.hypot(dx, dz), df = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - a), Math.cos(Math.atan2(dx, dz) - a))), dy = Math.abs(q.y - y); if (dy < .07 && df < .3) best = Math.max(best, r); var sc = dy * 4 + df * .2; if (sc < score) { score = sc; fb2 = r; } } return Math.max(.24, best || fb2) + .05; }
      var robe = G.shell(32, 12, function (u, v) { var gap = .10 + v * .17, a = gap + u * (TAU - gap * 2), y = top + (bottom - top) * v, r = radial(a, y) + v * .03 + Math.sin(a * 8 + v) * .03 * v * v; return [hip.x + Math.sin(a) * r, y + Math.sin(a * 9) * .016 * v * v, hip.z + Math.cos(a) * r]; }, .003, false, true);
      G.uvScale(robe, 1, .9); G.wear(robe, { edge: 0, tear: { amount: .3, width: .02, bottom: .035, base: .01 } }); A.weighted('rag', robe, C.clothWeights(A, 'pelvis', x.thighL, x.thighR, top, bottom, .40));
      var cuirass = G.sheet(32, 14, function (u, v) { return fitted.at(u * TAU, fb.max.y - .014 - v * (fb.max.y - fb.min.y - .07), .028); }, true, true); G.uvScale(cuirass, 1, 1); fitted.attach('rag', cuirass);
    });
    safe_('hood + veil', function () {
      var hc = A.cloud([x.head], ['skin'], .3), hb = A.box(hc), h = hb.getCenter(new T_.Vector3()), hs = hb.getSize(new T_.Vector3()), R = Math.min(.17, Math.max(.11, hs.x * .5));
      // sivri, arkaya devrik kukuleta: konik kesit, tepe arkaya kayık; önü geniş açık (yüz gölgede)
      var hood = G.shell(26, 10, function (u, v) { var a = .95 + u * (TAU - 1.9), tt = v, r = R * (1.2 - .95 * Math.pow(tt, 1.2)) + .035 * (1 - tt) + Math.sin(a * 5 + tt * 3) * .006; var back = tt * tt * .13; return [h.x + Math.sin(a) * r, hb.min.y + .0 + tt * (hs.y + .2), h.z + Math.cos(a) * r - back - .012]; }, .003, false, true);
      G.uvScale(hood, .8, .8); G.fillWear(hood); A.rigid('rag', hood, x.head);
      // omuzlara dökülen kıvrımlı arka kumaş
      var drape = G.sheet(16, 10, function (u, v) { var across = (u - .5) * (.3 + v * .18); return [h.x + across, hb.min.y + .02 - v * .42, h.z - R * .95 - v * .06 + Math.sin(u * 14 + v * 4) * .018 * v]; }, false, true); G.uvScale(drape, 1.5, 1.5);
      G.wear(drape, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .6, width: .04, bottom: .12, base: .02 } }); A.rigid('rag', drape, x.head);
      // yüzü örten ince peçe (kenarı yırtık), arkasında iki ışık
      var veil = G.sheet(14, 9, function (u, v) { var a = (u - .5) * 1.5, y = hb.max.y - .06 - v * (hs.y * .8), r = R * .95 + .05 + v * .015 + Math.sin(u * 18) * .004 * v; return [h.x + Math.sin(a) * r, y + Math.sin(u * 13) * .01 * v, h.z + Math.cos(a) * r * 1.02]; }, false, true);
      G.uvScale(veil, 1.4, 1.2); G.wear(veil, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .55, width: .03, bottom: .12, base: .02 } }); A.rigid('rag', veil, x.head);
      A.rigid('glow', G.merge([G.sphere(.016, [h.x - .045, h.y + .02, h.z + R * .74], [1.8, .55, .6], 8, 6), G.sphere(.016, [h.x + .045, h.y + .02, h.z + R * .74], [1.8, .55, .6], 8, 6)]), x.head);
      // alnında kırık yemin tacı (üç demir diş)
      var sp = []; for (var i = 0; i < 5; i++) { var a = (i - 2) * .32; sp.push(G.spike(.012, V_(h.x + Math.sin(a) * (R + .03), hb.max.y - .02, h.z + Math.cos(a) * (R + .03)), V_(h.x + Math.sin(a) * (R + .05), hb.max.y + .05 + (i % 2) * .04, h.z + Math.cos(a) * (R + .05)))); }
      A.rigid('iron', G.merge(sp), x.head);
    });
    safe_('mantle + tablets', function () {
      var mantle = G.sheet(18, 14, function (u, v) { var across = (u - .5) * (x.bw * 1.05 + v * .16); return [fitted.cx + across, fb.max.y - .02 - v * .72 + Math.sin(u * 21) * .03 * v, fb.min.z - .035 - .06 * v + Math.sin(u * 13 + v * 5) * .012]; }, true);
      G.uvScale(mantle, 2, 2); G.wear(mantle, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .7, width: .05, bottom: .2, base: .04 } }); A.rigid('rag', mantle, x.spine);
      // göğüste çapraz zincir ve asılı yemin levhaları
      var cpts = [], tabs = [], chains = [];
      for (var k = 0; k <= 8; k++) { var t = k / 8; cpts.push([chest.x - .2 + t * .4, chest.y + .22 - t * .30 - Math.sin(t * Math.PI) * -.03, chest.z + .17 + Math.sin(t * Math.PI) * .03]); }
      chains.push(G.tube(cpts, .008, 5, 28, false));
      for (var j = 1; j < 8; j += 2) { var q = cpts[j]; tabs.push(plateWear(G.box(.055, .075, .012, [q[0], q[1] - .06, q[2] + .004], [.1, 0, (j - 4) * .05]), .3)); chains.push(G.tube([q, [q[0], q[1] - .02, q[2] + .004]], .005, 4, 4, false)); }
      A.rigid('iron', G.merge(chains.concat(tabs)), x.spine);
      A.rigid('glow', G.sphere(.022, [chest.x + .0, chest.y - .02, chest.z + .19], [1, 1.3, .7], 8, 6), x.spine);
      A.rigid('iron', G.ring(.04, .008, [chest.x, chest.y - .02, chest.z + .185], [Math.PI / 2.4, 0, 0], 6, 16), x.spine);
    });
    safe_('limbs', function () {
      ['l', 'r'].forEach(function (s) { x.limbCover('rag', 'upperarm_' + s, 'lowerarm_' + s, .06, .94, .026, .002, .017); x.limbCover('rag', 'lowerarm_' + s, 'hand_' + s, .02, .8, .026, .002, .02); x.boot('foot_' + s, 'ball_' + s, 'rag'); });
      x.limbCover('iron', 'lowerarm_r', 'hand_r', .8, .98, .03, .006, .02);
    });
    var T2 = T_.Vector3;
    // mum-asa: kemik sap, tepede demir halka ve ince alev
    return { parts: { bone: [G.cyl(.024, .034, 1.3, 8, [0, .5, 0])], iron: [G.ring(.06, .012, [0, 1.12, 0], [Math.PI / 2, 0, 0], 6, 18), G.cyl(.045, .03, .09, 8, [0, 1.08, 0]), G.spike(.03, new T2(.06, 1.1, 0), new T2(.15, 1.3, 0)), G.spike(.03, new T2(-.06, 1.1, 0), new T2(-.15, 1.28, 0.02))],
      glow: [G.sphere(.03, [0, 1.17, 0], [.8, 1.8, .8], 8, 6)] }, tip: new T2(0, 1.25, 0) };
  }
  if (B.Models && B.Models.register && G) {
    make('shacklewarden', { base: 'ubc', height: 2.36, radius: .52, motionType: 'guard' }, buildWarden);
    make('dirgeweeper', { base: 'ubc', height: 2.5, radius: .46, motionType: 'cultist' }, buildMourner);
  }

  // ================================================================= çarpışma / yetenekler
  function create(api) {
    var player = api.player, enemies = api.enemies, game = api.game, tw = TUNE.shacklewarden, td = TUNE.dirgeweeper;
    var hyp = function (x, z) { return Math.sqrt(x * x + z * z); };
    function clock() { return game.elapsed || 0; }
    function hit(at, warn, shape, extra) { var h = { at: at, warn: warn, shape: shape, style: 'blade', fill: 'radial' }; for (var k in extra) h[k] = extra[k]; return h; }
    function cone(id, name, radius, arc, dmg, at, pose, extra) { return { id: id, name: name, duration: at + .8, pose: pose, hits: [hit(at, at, 'cone', Object.assign({ radius: radius, arc: arc, dmg: dmg, fill: 'sweep', sweepDir: 1, pose: pose }, extra || {}))] }; }

    // ---- Pranga Tuzağı: üç demir pranga; her biri önce daire olarak görünür
    function snare(e) {
      var base = { x: player.x, z: player.z }, spots = [base], a0 = e.face + Math.PI / 2 + (e.index % 2 ? 0 : Math.PI);
      for (var k = 0; k < tw.trap.count - 1; k++) {
        for (var tries = 0; tries < 4; tries++) {
          var a = a0 + (k ? Math.PI : 0) + tries * .5, pt = { x: base.x + Math.sin(a) * 2.7, z: base.z + Math.cos(a) * 2.7 };
          if (api.walkable(pt.x, pt.z, .5)) { spots.push(pt); break; }
        }
      }
      var hits = spots.map(function (s, i) {
        return hit(tw.trap.warn + .3 + i * .28, tw.trap.warn + i * .22, 'circle', { origin: s, radius: tw.trap.radius, dmg: tw.trap.dmg, knockback: 1.6, style: 'chain', fill: 'inward', pose: 'overhead', beat: i === 0, attack: tr('Pranga Tuzağı'),
          onActive: i === 0 ? function () { api.addHazard({ owner: e, enemy: e.name, x: s.x, z: s.z, radius: tw.trap.radius * .9, warn: .6, duration: tw.trap.linger, damage: tw.trap.lingerDmg, periodic: true, interval: .9, persistent: true, style: 'chain', fill: 'radial', near: false, attack: tr('Açık Pranga') }); } : undefined });
      });
      return { id: 'snare', name: tr('Pranga Tuzağı'), duration: tw.trap.warn + .3 + spots.length * .28 + .9, pose: 'overhead', hits: hits, cooldown: 1.3 };
    }
    function whirl(e) {
      var o = { x: e.x, z: e.z };
      return { id: 'whirl', name: tr('Zincir Çarkı'), duration: tw.whirl.warn + 1.3, pose: 'spin', cooldown: 1.2, hits: [hit(tw.whirl.warn, tw.whirl.warn, 'ring', { origin: o, radius: tw.whirl.outer, inner: tw.whirl.inner, arc: TAU, dmg: tw.whirl.dmg, unblockable: true, style: 'chain', fill: 'sweep', sweepDir: 1, pose: 'spin', knockback: 2.4 })] };
    }
    // ---- Ağıtçı
    function wardTargets(e) {
      var list = [];
      for (var i = 0; i < enemies.length; i++) { var o = enemies[i]; if (o === e || o.dead || !o.active || o.boss || o.reserve || o.wardT > 0 || hyp(o.x - e.x, o.z - e.z) > td.ward.range) continue; list.push(o); }
      list.sort(function (a, b) { return hyp(a.x - e.x, a.z - e.z) - hyp(b.x - e.x, b.z - e.z); });
      return list.slice(0, td.ward.max);
    }
    function wardMove(e) {
      return { id: 'ward', name: tr('Matem Mührü'), duration: td.ward.warn + .9, pose: 'kneel', cooldown: .9, hits: [hit(td.ward.warn, td.ward.warn, 'circle', { origin: { x: e.x, z: e.z }, radius: td.ward.range, dmg: 0, harmless: true, style: 'rune', fill: 'radial', pose: 'kneel', tellGain: .35,
        onActive: function () {
          if (e.dead || !e.action || e.action.moveId !== 'ward' || e.stagger > 0) return;
          var ts = wardTargets(e);
          for (var i = 0; i < ts.length; i++) { ts[i].wardT = td.ward.secs; ts[i].wardSrc = e; ts[i].wardPulse = 0; api.fx('glowBurst', { x: ts[i].x, y: .05, z: ts[i].z, radius: (ts[i].radius || .6) * 3, color: 0xe0b060, duration: .9 }); }
          api.sound('enemyWindup', { type: e.type, x: e.x, z: e.z, style: 'rune' });
        } })] };
    }
    function wail(e) {
      var hits = [], base = e.face;
      for (var i = 0; i < 3; i++) { var a = base + (i - 1) * td.wail.fan; hits.push(hit(td.wail.warn + i * .26, td.wail.warn, 'line', { face: a, width: td.wail.width, length: api.clipLine(e, a, td.wail.length), dmg: td.wail.dmg, style: 'roar', fill: 'forward', pose: 'castHigh', beat: i === 0, knockback: 1.2 })); }
      return { id: 'wail', name: tr('Yas Çığlığı'), duration: td.wail.warn + .9, pose: 'castHigh', hits: hits, cooldown: 1.6 };
    }

    function attack(e, d) {
      var list = [];
      if (e.type === 'shacklewarden') list = [
        { id: 'hook', ok: d < 4.2, w: 4, move: function () { return cone('hook', tr('Kanca Darbesi'), tw.hook.radius, tw.hook.arc, tw.hook.dmg, tw.hook.warn, 'chainWhip', { style: 'chain' }); } },
        { id: 'pommel', ok: d < 2.8, w: 2, move: function () { return cone('pommel', tr('Anahtar Topuzu'), 2.7, 2.2, tw.pommel.dmg, tw.pommel.warn, 'bash', { style: 'blunt', knockback: 2.2 }); } },
        { id: 'snare', sp: 1, ok: d > 1.4 && d < 11 && api.clearStrike(e, player), w: 4, move: function () { return snare(e); } },
        { id: 'whirl', sp: 1, ok: d < 4.6, w: 3, move: function () { return whirl(e); } }
      ];
      else if (e.type === 'dirgeweeper') list = [
        { id: 'wail', ok: d > 3.2 && d < 13 && api.clearStrike(e, player), w: 3, move: function () { return wail(e); } },
        { id: 'breath', ok: d < 3.8, w: 5, move: function () { return { id: 'breath', name: tr('Ağıt Nefesi'), duration: td.breath.warn + .8, pose: 'roar', hits: [hit(td.breath.warn, td.breath.warn, 'circle', { origin: { x: e.x, z: e.z }, radius: td.breath.radius, dmg: td.breath.dmg, knockback: 5, style: 'roar', fill: 'radial', pose: 'roar' })] }; } }
      ];
      var ok = api.pick(e, list);
      if (ok && !(e.spWait >= 0)) e.spWait = 1;   // pick() tablo dışı türlerde spWait'i boş bırakır; özel hamle sonrası bir düz darbe bekle
      return ok;
    }

    // ---- yas kalkanı: hasarı kıs, aralıklı halka, kaynak ölünce ya da sersemleyince bozul
    function ward(dt) {
      // Matem Mührü kendi saatinde başlar (harmanlı bir saldırı yuvası beklemez; hasar vermediği için) — yine de beginMove'un ritim kuralları geçerli
      for (var j = 0; j < enemies.length; j++) {
        var c = enemies[j];
        if (c.type !== 'dirgeweeper' || c.dead || !c.active || c.action || c.stagger > 0 || c.fear > 0 || c.returning || c.wardCd > clock()) continue;
        if (hyp(player.x - c.x, player.z - c.z) > 16 || !wardTargets(c).length) { c.wardCd = clock() + 1; continue; }
        if (api.beginMove(c, wardMove(c))) c.wardCd = clock() + td.ward.cd; else c.wardCd = clock() + .4;
      }
      for (var i = 0; i < enemies.length; i++) {
        var o = enemies[i]; if (!(o.wardT > 0)) continue;
        o.wardT -= dt;
        if (o.dead || !o.wardSrc || o.wardSrc.dead || o.wardSrc.stagger > 0) o.wardT = 0;
        else if ((o.wardPulse = (o.wardPulse || 0) - dt) <= 0 && o.model && o.model.root.visible) { o.wardPulse = .85; api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: (o.radius || .6) * 2.1, color: 0xd8a458, duration: .55 }); }
        if (o.wardT <= 0) o.wardSrc = null;
      }
    }
    function hurt(e, damage) {
      if (e.wardT > 0) { damage = Math.max(1, Math.round(damage * (1 - td.ward.cut))); api.fx('spark', { x: e.x, y: 1.3, z: e.z, face: e.face, glance: true }); }
      return damage;
    }
    function reset() { for (var i = 0; i < enemies.length; i++) { enemies[i].wardT = 0; enemies[i].wardSrc = null; enemies[i].wardCd = 0; } }

    // MobAbilities'in update/hurt/reset kancalarına bağlan (combat.js'te ek satır gerekmesin): create() her oyunda bir kez çağrılır
    var MA = B.MobAbilities, inst = { attack: attack, ward: ward, hurt: hurt, reset: reset };
    if (MA && MA.create && !MA._c1) {
      var orig = MA.create; MA._c1 = true;
      MA.create = function (a) {
        var m = orig.call(MA, a), u = m.update, h = m.hurt, r = m.reset;
        m.update = function (dt) { u(dt); if (game.state === 'playing') ward(dt); };
        m.hurt = function (e, dmg, face) { return hurt(e, h(e, dmg, face)); };
        m.reset = function () { r(); reset(); };
        return m;
      };
    }
    // ses: pencere / saldırı seslerinde mevcut karakterleri ödünç al
    var AU = B.Audio;
    if (AU && AU.play && !AU._c1) {
      var play = AU.play; AU._c1 = true;
      AU.play = function (name, o) { if (o && ALIAS[o.type] && (name === 'enemyWindup' || name === 'enemyAttack')) { o = Object.assign({}, o, { type: ALIAS[o.type] }); arguments[1] = o; } return play.apply(this, arguments); };
    }
    return inst;
  }

  // ================================================================= yerleşim (world.js, odalar kurulduktan sonra bir kez çağrılır)
  function place(encounters) {
    var main = { infirmary: { D: [-7.5, -52] }, offering: { S: [7.5, -70], D: [-7.5, -78] }, ossuary: { S: [6.2, -99], D: [-6.5, -105] } };
    encounters.forEach(function (enc) {
      var plan = TUNE.place[enc.id]; if (!plan || enc.__c1 || !enc.spawns) return; enc.__c1 = true;
      var tab = main[enc.id], cx = 0, cz = 0;
      if (!tab) { enc.spawns.forEach(function (s) { cx += s.x; cz += s.z; }); cx /= Math.max(1, enc.spawns.length); cz /= Math.max(1, enc.spawns.length); }
      String(plan).split('').forEach(function (ch) {
        if (ch === '*') return;
        var s = { type: ch === 'S' ? 'shacklewarden' : 'dirgeweeper' }, pos = tab ? tab[ch] : [cx + (ch === 'S' ? 1.5 : -1.5), cz + (ch === 'S' ? -6.4 : 6.4)];
        if (!pos) return;
        s.x = pos[0]; s.z = pos[1];
        if (plan.indexOf('*') >= 0 && ch === 'S') { s.elite = true; s.name = tr(TUNE.eliteName); }
        enc.spawns.push(s);
      });
    });
  }

  // ses tabloları (audio.js'in sabit nesnelerine yeni satırlar)
  function audio(t) {
    if (t.MATERIAL) { t.MATERIAL.shacklewarden = 'armor'; t.MATERIAL.dirgeweeper = 'flesh'; }
    if (t.PAIN) { t.PAIN.shacklewarden = 'guardGrunt'; t.PAIN.dirgeweeper = 'hurt'; }
    if (t.PAIN_RATE) { t.PAIN_RATE.shacklewarden = .8; t.PAIN_RATE.dirgeweeper = .88; }
    if (t.DEATH_MATERIAL) { t.DEATH_MATERIAL.shacklewarden = ['guardDeath', .78, 'chain', .8]; t.DEATH_MATERIAL.dirgeweeper = ['cultistDeath', .92, 'bone', 1.22]; }
  }

  B.MobsC1 = { TUNE: TUNE, stats: stats, create: create, place: place, audio: audio, types: ['shacklewarden', 'dirgeweeper'] };
}());
