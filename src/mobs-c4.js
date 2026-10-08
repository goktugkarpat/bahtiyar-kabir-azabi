/* KABİR AZABI — IV: Kızıl Ocak, iki yeni düşman türü (ajan EN4). Tek dosya: kimlik, model, yetenek/AI, yerleşim, ses katmanı.
     bellowsmaster  Körük Ustası   DESTEK. Sırtında deri körük torbası, elinde el körüğü. Geriden durur; "Tavlama" ile yakındaki düşmanları iyileştirir ve
                                   8 sn öfkelendirir (kor gibi parlarlar, +%25 hasar), "Körük Alevi" ile iki darbede kızgın alev şeridi üfler.
     shackler       Pranga Ustası  TUZAKÇI. Boynu/bileği prangalı, uzun maşalı. "Pranga Mayınları" ile kahramanın etrafına gecikmeli kor tuzakları döşer
                                   (patlayınca yanık zemin bırakır), "Zincir Ağı" ile üstüne çapraz iki zincir şeridi çeker.
   Kolay ayar: aşağıdaki TUNE tek yerdir (HP/hız/hasar/bekleme/yerleşim). Yeni kod bu dosyada; mevcut dosyalarda yalnız tek satırlık kancalar var:
   forge-models.js (B.ForgeModels.ext + make), index.html/sw.js (bu dosya), target-hud.js (portre takma adı). Ses: yeni dosya yok, B.Audio.sample katmanları. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, TAU = Math.PI * 2, tr = function (s) { return KabirI18n.t(s); };
  if (!B.ForgeCombat || !B.ForgeModels) return;

  // ------------------------------------------------------------------------------------------------ KOLAY AYAR
  var TUNE = {
    bellowsmaster: { hp: 176, speed: 2.3, cooldown: 2.2, reach: 12, radius: .46, smack: 14, gust: 15, healFrac: .14, buffSec: 8, stokeCd: 15, stokeRadius: 8.5 },
    shackler: { hp: 214, speed: 2.8, cooldown: 1.8, reach: 12, radius: .5, tongs: 17, mine: 18, web: 16, poolDmg: 3 },
    // tür başına en çok kaç tane yerleşsin (bölümün tamamında)
    placeMax: 8
  };
  // oda -> hangi tür eklensin (forge-<oda no> / forge-wing-<kanat no>); 11 ve 13 (boss) yok
  var PLACE = {
    'forge-1': ['shackler'], 'forge-2': ['bellowsmaster'], 'forge-3': ['shackler'], 'forge-4': ['bellowsmaster'],
    'forge-5': ['shackler'], 'forge-6': ['bellowsmaster'], 'forge-7': ['shackler'], 'forge-8': ['bellowsmaster'],
    'forge-9': ['shackler'], 'forge-10': ['bellowsmaster', 'shackler'], 'forge-12': ['bellowsmaster', 'shackler'],
    'forge-wing-14': ['shackler'], 'forge-wing-15': ['bellowsmaster'], 'forge-wing-16': ['shackler'], 'forge-wing-17': ['bellowsmaster*']
  };
  var TYPES = ['bellowsmaster', 'shackler'];

  // ------------------------------------------------------------------------------------------------ KİMLİK / ÇEVİRİ
  var D = window.KabirI18n && KabirI18n.dictionary;
  if (D) Object.assign(D, {
    'Körük Ustası': 'Bellows Keeper', 'Pranga Ustası': 'Shackle Warden', 'Tavlama': 'Tempering', 'Körük Alevi': 'Bellows Jet', 'Körük Darbesi': 'Bellows Slap',
    'Körük Alevi · ikinci': 'Bellows Jet · second', 'Pranga Mayınları': 'Shackle Mines', 'Pranga Mayını': 'Shackle Mine', 'Zincir Ağı': 'Chain Web', 'Zincir Ağı · ikinci': 'Chain Web · second',
    'Kızgın Maşa': 'Hot Tongs', 'Körüklerin Ustabaşısı': 'Foreman of the Bellows', 'Pranga Közü': 'Shackle Embers'
  });
  B.ForgeCombat.stats.bellowsmaster = { name: tr('Körük Ustası'), hp: TUNE.bellowsmaster.hp, speed: TUNE.bellowsmaster.speed, radius: TUNE.bellowsmaster.radius, reach: TUNE.bellowsmaster.reach, cooldown: TUNE.bellowsmaster.cooldown, color: 0xc79566, forge: true, ranged: true };
  B.ForgeCombat.stats.shackler = { name: tr('Pranga Ustası'), hp: TUNE.shackler.hp, speed: TUNE.shackler.speed, radius: TUNE.shackler.radius, reach: TUNE.shackler.reach, cooldown: TUNE.shackler.cooldown, color: 0xa88f7a, forge: true };

  // ------------------------------------------------------------------------------------------------ MODEL
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function axisRot(a, b) { var q = new T.Quaternion().setFromUnitVectors(V(0, 0, 1), b.clone().sub(a).normalize()), e = new T.Euler().setFromQuaternion(q); return [e.x, e.y, e.z]; }
  function chainDown(G, x, y, z, n, size) { var l = []; for (var i = 0; i < n; i++) l.push(G.ring(size, size * .3, [x, y - i * size * 1.5, z], [i % 2 ? Math.PI / 2 : 0, i % 2 ? 0 : Math.PI / 2, .2], 5, 9)); return l; }
  B.ForgeModels.ext.bellowsmaster = function (c) {
    var A = c.A, G = c.G, p = c.p, chest = c.chest, hip = c.hip, head = c.head, spine = c.spine, fitted = c.fitted, fb = c.fb, limbCover = c.limbCover;
    ['l', 'r'].forEach(function (s) {
      var up = 'upperarm_' + s, fo = 'lowerarm_' + s, th = 'thigh_' + s, ca = 'calf_' + s, ft = 'foot_' + s;
      limbCover('rag', up, fo, .11, .92, .015, .002, .008); limbCover('rag', th, ca, .06, 1.035, .021, .002, .010); limbCover('rag', ca, ft, -.04, .96, .021, .002, .005);
      limbCover('leather', fo, 'hand_' + s, .30, .98, .028, .006, .020);       // sengi-yanık deri kolluk
      limbCover('leather', ca, ft, .26, .85, .030, .006, .020); c.boot(ft, 'ball_' + s);
    });
    // deri başlık + gözlük + yüz bezi
    var hc = A.cloud([head], ['skin'], .55), hb = A.box(hc), h = hc.length ? hb.getCenter(new T.Vector3()) : p.clone(), hs = hb.getSize(new T.Vector3());
    var top = (hc.length ? hb.max.y : p.y + .17) + .06, bottom = (hc.length ? hb.min.y : p.y - .13) - .04;
    var cap = G.shell(26, 9, function (u, v) { var a = .9 + u * (TAU - 1.8), r = Math.max(.13, hs.x * .54) * Math.sin(v * Math.PI * .62) + .014 + Math.pow(v, 4) * .05; return [h.x + Math.sin(a) * r, top + (bottom - top) * v, h.z + Math.cos(a) * r - .012]; }, .004, false, true);
    G.uvScale(cap, .8, .8); G.fillWear(cap); A.rigid('leather', cap, head);
    var scarf = G.tube([[h.x - .12, bottom + .05, h.z + .02], [h.x - .09, bottom + .01, h.z + .11], [h.x + .09, bottom + .01, h.z + .11], [h.x + .12, bottom + .05, h.z + .02]], .034, 7, 18, false);
    G.wear(scarf, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .4, width: .03, bottom: .05, base: .02 } }); A.rigid('rag', scarf, head);
    var fy = h.y + .018, fz = h.z + Math.max(.105, hs.z * .5 - .004), gl = [], gi = [];
    [-1, 1].forEach(function (s) { gi.push(G.ring(.036, .0095, [h.x + s * .052, fy, fz], [0, 0, 0], 6, 16)); gl.push(G.sphere(.027, [h.x + s * .052, fy, fz - .004], [1, 1, .3], 8, 6)); });
    gi.push(G.tube([[h.x - .09, fy, fz - .028], [h.x - .045, fy + .004, fz + .006], [h.x + .045, fy + .004, fz + .006], [h.x + .09, fy, fz - .028]], .006, 5, 10, false));
    gi.push(G.ring(Math.max(.115, hs.x * .52), .006, [h.x, fy, h.z - .01], [Math.PI / 2, 0, 0], 5, 22));
    A.rigid('iron', G.merge(gi), head); A.rigid('glow', G.merge(gl), head);
    // sırttaki körük torbası: deri kese, demir bantlar, baca ve ağzı kızaran boru
    var bk = fitted.at(Math.PI, chest.y - .02, .03), bag = [G.sphere(.19, [bk[0], bk[1], bk[2] - .13], [1, 1.28, .62], 16, 11), G.sphere(.12, [bk[0] - .2, bk[1] - .12, bk[2] - .07], [1, 1.2, .6], 12, 8)];
    G.uvScale(bag[0], 1.2, 1.2); bag.forEach(function (g) { c.plateWear(g, .25); }); A.rigid('leather', G.merge(bag), spine);
    var bands = []; for (var i = 0; i < 3; i++) bands.push(G.ring(.195 - Math.abs(i - 1) * .04, .011, [bk[0], bk[1] - .17 + i * .17, bk[2] - .13], [0, 0, 0], 5, 24));
    var flue = G.tube([[bk[0] + .06, bk[1] + .20, bk[2] - .18], [bk[0] + .14, bk[1] + .46, bk[2] - .2], [bk[0] + .2, bk[1] + .66, bk[2] - .12], [bk[0] + .17, bk[1] + .82, bk[2] - .02]], function (t) { return .03 + .012 * t; }, 8, 18, true);
    A.rigid('iron', G.merge(bands.concat([flue])), spine);
    A.rigid('glow', G.merge([G.ring(.042, .009, [bk[0] + .17, bk[1] + .83, bk[2] - .02], [Math.PI / 2 - .3, 0, 0], 5, 14), G.sphere(.03, [bk[0] + .17, bk[1] + .82, bk[2] - .02], [1, .6, 1], 8, 5)]), spine);
    // körük hortumu: torbadan sağ kalçaya sarkar; sol kalçada kor feneri
    var hose = G.tube([[bk[0] - .12, bk[1] - .2, bk[2] - .1], [bk[0] - .24, bk[1] - .36, bk[2] + .02], [hip.x - .26, hip.y - .02, hip.z + .06], [hip.x - .24, hip.y - .16, hip.z + .17]], .022, 6, 20, false); G.fillWear(hose); A.rigid('leather', hose, 'pelvis');
    var lan = [G.ring(.045, .008, [hip.x + .24, hip.y - .06, hip.z + .1], [0, 0, 0], 5, 14), G.ring(.045, .008, [hip.x + .24, hip.y - .17, hip.z + .1], [0, 0, 0], 5, 14), G.cyl(.01, .01, .13, 6, [hip.x + .24, hip.y - .115, hip.z + .1])];
    A.rigid('iron', G.merge(lan), 'pelvis'); A.rigid('glow', G.sphere(.034, [hip.x + .24, hip.y - .115, hip.z + .1], [1, 1.2, 1], 8, 6), 'pelvis');
    // göğüste kızgın perçinler
    var rv = []; for (var k = 0; k < 6; k++) rv.push(G.sphere(.014, [chest.x + (k % 2 ? -.15 : .15), chest.y + .13 - k * .05, chest.z + .14], [1, .8, 1], 7, 5)); A.rigid('glow', G.merge(rv), spine);
    // elinde el körüğü: ağaç tutamaklar, deri körük kıvrımları, demir lüle ve kızgın ağız (kıvrımlar oyunda nefes alır)
    var folds = [], bands2 = [];
    for (var f = 0; f < 7; f++) { var y = .15 + f * .066, R = .135 - Math.abs(f - 3) * -.004 - (f % 2 ? 0 : .012); folds.push(G.ring(R, .026, [0, y, 0], [Math.PI / 2, 0, 0], 6, 20)); }
    bands2.push(G.ring(.176, .009, [0, .105, 0], [Math.PI / 2, 0, 0], 5, 20), G.ring(.176, .009, [0, .645, 0], [Math.PI / 2, 0, 0], 5, 20));
    return { weapon: { parts: {
      wood: [G.cyl(.17, .17, .036, 16, [0, .1, 0]), G.cyl(.17, .17, .036, 16, [0, .66, 0]), G.cyl(.019, .019, .30, 8, [0, -.1, 0]), G.cyl(.018, .018, .20, 8, [.07, -.2, 0])],
      leather: folds.concat([G.cyl(.11, .11, .5, 14, [0, .38, 0])]),
      iron: bands2.concat([G.cyl(.022, .05, .36, 10, [0, .87, 0]), G.ring(.034, .012, [0, 1.05, 0], [Math.PI / 2, 0, 0], 5, 14)]),
      glow: [G.sphere(.034, [0, 1.06, 0], [1, .8, 1], 8, 6), G.ring(.05, .007, [0, .70, 0], [Math.PI / 2, 0, 0], 5, 20)]
    }, tip: V(0, 1.1, 0) } };
  };

  B.ForgeModels.ext.shackler = function (c) {
    var A = c.A, G = c.G, p = c.p, chest = c.chest, hip = c.hip, head = c.head, spine = c.spine, fitted = c.fitted, fb = c.fb, limbCover = c.limbCover;
    ['l', 'r'].forEach(function (s) {
      var up = 'upperarm_' + s, fo = 'lowerarm_' + s, th = 'thigh_' + s, ca = 'calf_' + s, ft = 'foot_' + s;
      limbCover('rag', up, fo, .11, .92, .015, .002, .008); limbCover('rag', th, ca, .06, 1.035, .021, .002, .010); limbCover('rag', ca, ft, -.04, .96, .021, .002, .005);
      limbCover('leather', fo, 'hand_' + s, .28, .98, .028, .006, .020); limbCover('iron', ca, ft, .30, .86, .032, .007, .022); c.boot(ft, 'ball_' + s);
      // bilek prangası: dış demir halka + içte kızaran ince halka + sarkan zincir
      var pa = A.P(fo), pb = A.P('hand_' + s), mid = pa.clone().lerp(pb, .84), rot = axisRot(pa, pb), ax = pb.clone().sub(pa).normalize();
      A.rigid('iron', G.merge([G.ring(.064, .018, [mid.x, mid.y, mid.z], rot, 6, 18)].concat(chainDown(G, mid.x, mid.y - .07, mid.z + .04, 5, .02))), 'hand_' + s);
      var m2 = mid.clone().addScaledVector(ax, .026); A.rigid('glow', G.ring(.061, .006, [m2.x, m2.y, m2.z], rot, 5, 18), 'hand_' + s);
      // bacak prangası
      var qa = A.P(ca), qb = A.P(ft), qm = qa.clone().lerp(qb, .8), qr = axisRot(qa, qb);
      A.rigid('iron', G.merge([G.ring(.074, .02, [qm.x, qm.y, qm.z], qr, 6, 18)].concat(chainDown(G, qm.x, qm.y - .06, qm.z + .05, 3, .02))), ft);
      A.rigid('glow', G.ring(.071, .006, [qm.x, qm.y + .022, qm.z], qr, 5, 18), ft);
    });
    // kovalı miğfer: demir silindir + kubbe, kızgın siper yarığı, ağız delikleri
    var cx = p.x, cy = p.y + .035, cz = p.z - .004;
    var helm = [G.cyl(.135, .142, .27, 18, [cx, cy, cz]), G.sphere(.135, [cx, cy + .135, cz], [1, .55, 1], 16, 8), G.ring(.14, .014, [cx, cy - .125, cz], [Math.PI / 2, 0, 0], 5, 22), G.ring(.137, .011, [cx, cy + .13, cz], [Math.PI / 2, 0, 0], 5, 22)];
    for (var r = 0; r < 4; r++) helm.push(G.box(.012, .02, .012, [cx + (r - 1.5) * .045, cy - .1, cz + .138]));
    helm.forEach(function (g) { c.plateWear(g, .3); }); A.rigid('iron', G.merge(helm), head);
    A.rigid('glow', G.merge([G.box(.17, .018, .014, [cx, cy + .035, cz + .137]), G.box(.012, .06, .012, [cx, cy - .015, cz + .139])]), head);
    // demir tasma (boyunluk) ve çapraz iki zincir bandolye
    A.rigid('iron', G.ring(.092, .022, [p.x, p.y - .11, p.z], [Math.PI / 2, 0, 0], 6, 20), spine);
    var band = [];
    for (var k = 0; k < 13; k++) { var t = k / 12; band.push(G.ring(.03, .008, fitted.at(-1.0 + t * 1.9, fb.max.y - .04 - t * c.torsoH * .72, .05), [k % 2 ? Math.PI / 2 : 0, k % 2 ? 0 : Math.PI / 2, .4], 4, 9)); }
    for (var k2 = 0; k2 < 13; k2++) { var t2 = k2 / 12; band.push(G.ring(.03, .008, fitted.at(1.0 - t2 * 1.9, fb.max.y - .04 - t2 * c.torsoH * .72, .056), [k2 % 2 ? Math.PI / 2 : 0, k2 % 2 ? 0 : Math.PI / 2, -.4], 4, 9)); }
    fitted.attach('iron', G.merge(band));
    // ortada kızgın kilit ve kalçada anahtar halkası + asma kilitler
    A.rigid('glow', G.merge([G.sphere(.036, fitted.at(0, fb.max.y - .04 - c.torsoH * .36, .075), [1, 1, .6], 10, 7)]), spine);
    var keys = [G.ring(.05, .008, [hip.x + .23, hip.y - .02, hip.z + .05], [0, Math.PI / 2, 0], 5, 16)];
    for (var q = 0; q < 4; q++) keys.push(G.cyl(.012, .012, .1 + q * .012, 6, [hip.x + .23 + (q - 1.5) * .014, hip.y - .1 - q * .01, hip.z + .05 + (q % 2 ? .02 : -.02)]));
    keys.push(G.box(.07, .06, .03, [hip.x + .23, hip.y - .22, hip.z + .06]), G.ring(.022, .007, [hip.x + .23, hip.y - .17, hip.z + .06], [0, 0, 0], 5, 10));
    A.rigid('iron', G.merge(keys), 'pelvis');
    var chains = []; for (var s2 = -1; s2 <= 1; s2 += 2) chains = chains.concat(chainDown(G, hip.x + s2 * .12, hip.y - .02, hip.z + .2, 6, .024));
    A.rigid('iron', G.merge(chains), 'pelvis');
    // omuz: yarım kızgın demir kalkan plakası
    var sh = c.armL; var sp = A.P(sh);
    A.rigid('iron', G.merge([c.plateWear(G.sphere(.15, [sp.x, sp.y + .03, sp.z], [1.1, .5, 1.05], 12, 6), .4), c.plateWear(G.sphere(.12, [sp.x, sp.y - .04, sp.z], [1.1, .45, 1.0], 12, 6), .4)]), sh);
    A.rigid('glow', G.ring(.138, .007, [sp.x, sp.y - .005, sp.z], [0, 0, 0], 5, 26), sh);
    // elinde uzun kızgın maşa: iki kol çapraz, uçta kızgın külçe
    var jaw = function (s) { return G.tube([[s * .03, .52, 0], [s * .045, .85, 0], [s * .07, 1.02, 0], [s * .026, 1.16, 0]], .014, 6, 16, true); };
    return { weapon: { parts: {
      iron: [jaw(-1), jaw(1), G.cyl(.016, .02, .46, 8, [0, .24, 0]), G.ring(.04, .012, [0, .56, 0], [Math.PI / 2, 0, 0], 5, 14), G.ring(.034, .01, [0, .13, 0], [Math.PI / 2, 0, 0], 5, 12), G.sphere(.032, [0, -.02, 0], [1, 1.5, 1], 8, 6)],
      leather: [C0(G)],
      glow: [G.box(.08, .13, .08, [0, 1.13, 0]), G.sphere(.034, [0, 1.2, 0], [1.1, .8, 1.1], 8, 6)]
    }, tip: V(0, 1.25, 0) } };
  };
  B.ForgeModels.make('bellowsmaster', { base: 'ubc', height: 2.35, radius: TUNE.bellowsmaster.radius, motionType: 'cultist' });
  B.ForgeModels.make('shackler', { base: 'ubc', height: 2.4, radius: TUNE.shackler.radius, motionType: 'guard' });
  B.ForgeModels.types.push('bellowsmaster', 'shackler');
  function C0(G) { return G.cyl(.026, .026, .24, 8, [0, -.02, 0]); }   // tutamak sargısı

  // ------------------------------------------------------------------------------------------------ DAVRANIŞ
  var origCreate = B.ForgeCombat.create, tinted = 0;
  B.ForgeCombat.create = function (api) {
    var base = origCreate.apply(this, arguments), core = null, time = 0;
    function hit(at, warn, shape, r, dmg, pose, more) { return Object.assign({ at: at, warn: warn, shape: shape, radius: r, dmg: dmg, pose: pose, style: 'ember', fill: 'radial' }, more || {}); }
    function point() { return { x: api.player.x, z: api.player.z }; }
    function angTo(e, p) { return Math.atan2(p.x - e.x, p.z - e.z); }
    function spot(x, z, fx, fz) { var n = 0; while (n++ < 6 && !api.walkable(x, z, .4)) { x = x + (fx - x) * .3; z = z + (fz - z) * .3; } return { x: x, z: z }; }
    function cdOk(e, id) { return !e.c4cd || !(e.c4cd[id] > time); }
    function cdSet(e, id, s) { (e.c4cd || (e.c4cd = {}))[id] = time + s; }
    function allies(e, radius) {
      var list = core ? core.ext.enemies : [], out = [];
      for (var i = 0; i < list.length; i++) { var o = list[i]; if (o === e || o.dead || !o.active || o.boss || o.reserve) continue; if (Math.hypot(o.x - e.x, o.z - e.z) <= radius) out.push(o); }
      return out;
    }

    // ---- Körük Ustası
    var KB = TUNE.bellowsmaster;
    function stoke(e) {
      cdSet(e, 'stoke', KB.stokeCd); e.face = angTo(e, point());
      return { id: 'stoke', name: tr('Tavlama'), duration: 2.3, pose: 'castHigh', cooldown: 1.0,
        hits: [hit(1.7, 1.7, 'circle', KB.stokeRadius, 0, 'castHigh', { origin: { x: e.x, z: e.z }, harmless: true, style: 'ember', fill: 'radial', tellGain: .5,
          onActive: function () {
            if (e.dead || !e.action || e.action.moveId !== 'stoke' || e.stagger > 0) return;
            var list = allies(e, KB.stokeRadius);
            for (var i = 0; i < list.length; i++) {
              var o = list[i]; o.hp = Math.min(o.maxHp, o.hp + o.maxHp * KB.healFrac); o.buff = Math.max(o.buff || 0, KB.buffSec); o.c4temper = KB.buffSec;
              api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: (o.radius || .6) * 2.6, color: 0xff7a2a, duration: .9 });
            }
            api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 3.2, color: 0xff9a3a, duration: 1.0 });
            api.sound('enemyWindup', { type: e.type, x: e.x, z: e.z, style: 'ember' });
          } })] };
    }
    function jet(e) {
      cdSet(e, 'jet', 7);
      var a = angTo(e, point()), org = { x: e.x, z: e.z }, hits = [];
      e.face = a;
      for (var i = 0; i < 2; i++) {
        var f = a + (i ? .26 : -.26);
        hits.push(hit(1.05 + i * .62, i ? .72 : 1.05, 'line', 0, KB.gust, 'roar', { origin: org, face: f, width: 1.5, length: api.clipLine(e, f, 11), style: 'ember', fill: 'forward', unblockable: true, knockback: 1.8, beat: i === 0, attack: tr(i ? 'Körük Alevi · ikinci' : 'Körük Alevi') }));
      }
      return { id: 'bellowsJet', name: tr('Körük Alevi'), duration: 2.9, pose: 'roar', hits: hits, cooldown: 1.6 };
    }
    function smack(e) {
      var m = { id: 'bellowsSmack', name: tr('Körük Darbesi'), duration: 1.7, pose: 'sweep', hits: [hit(.8, .8, 'cone', 3.0, KB.smack, 'sweep', { arc: 1.9, style: 'blunt', fill: 'sweep', knockback: 2.2 })] };
      return m;
    }
    // ---- Pranga Ustası
    var SH = TUNE.shackler;
    function tongs(e) {
      return { id: 'hotTongs', name: tr('Kızgın Maşa'), duration: 1.9, pose: 'sweep', hits: [hit(.78, .78, 'cone', 3.5, SH.tongs, 'sweep', { arc: 1.7, style: 'chain', fill: 'sweep', knockback: 1.4 })] };
    }
    function pool(hits, o, t) {
      hits.push(hit(t + .18, .3, 'circle', 1.45, SH.poolDmg, 'throw', { origin: o, persistent: true, periodic: true, interval: .8, duration: 3.4, pool: 'lava', style: 'ember', fill: 'radial', beat: false, near: false, attack: tr('Pranga Közü') }));
    }
    function mines(e) {
      var p = point(), a = angTo(e, p), hits = [], sides = [0, 1, -1], times = [1.15, 1.55, 1.95];
      e.face = a;
      for (var i = 0; i < 3; i++) {
        var o = i ? spot(p.x + Math.sin(a + sides[i] * 1.75) * 3.3, p.z + Math.cos(a + sides[i] * 1.75) * 3.3, p.x, p.z) : spot(p.x, p.z, e.x, e.z);
        hits.push(hit(times[i], i ? .85 : 1.15, 'circle', 1.7, SH.mine, 'throw', { origin: o, style: 'chain', fill: 'inward', unblockable: true, beat: i === 0, attack: tr('Pranga Mayını'), scar: true,
          projectile: { kind: 'vial', fromY: 1.6, flight: .5, height: 2.4 } }));
        pool(hits, o, times[i]);
      }
      return { id: 'shackleMines', name: tr('Pranga Mayınları'), duration: 3.0, pose: 'throw', hits: hits, cooldown: 1.9 };
    }
    function web(e) {
      var p = point(), a = angTo(e, p), hits = [], L = 10, c = spot(p.x, p.z, e.x, e.z);
      e.face = a;
      for (var i = 0; i < 2; i++) {
        var f = a + i * Math.PI / 2, org = { x: c.x - Math.sin(f) * L / 2, z: c.z - Math.cos(f) * L / 2 };
        hits.push(hit(1.2 + i * .6, i ? .95 : 1.2, 'line', 0, SH.web, 'chainLash', { origin: org, face: f, width: 1.5, length: L, style: 'chain', fill: 'forward', unblockable: true, beat: i === 0, attack: tr(i ? 'Zincir Ağı · ikinci' : 'Zincir Ağı') }));
      }
      return { id: 'chainWeb', name: tr('Zincir Ağı'), duration: 3.0, pose: 'chainLash', hits: hits, cooldown: 1.9 };
    }
    var attack0 = base.attack;
    base.attack = function (e, d) {
      if (e.type !== 'bellowsmaster' && e.type !== 'shackler') return attack0.apply(this, arguments);
      var list = [];
      if (e.type === 'bellowsmaster') {
        var near = allies(e, KB.stokeRadius + 2), need = 0; for (var i = 0; i < near.length; i++) if (near[i].hp < near[i].maxHp * .85 || !(near[i].buff > 2)) need++;
        list = [
          { id: 'stoke', ok: need > 0 && cdOk(e, 'stoke') && d < 16, w: 5, move: function () { return stoke(e); } },
          { id: 'bellowsJet', ok: d > 2.2 && d < 11 && cdOk(e, 'jet') && api.clipLine(e, angTo(e, point()), 11) > 5, w: 3, move: function () { return jet(e); } },
          { id: 'bellowsSmack', ok: d < 3.2, w: 4, move: function () { return smack(e); } }
        ];
      } else list = [
        { id: 'hotTongs', ok: d < 3.7, w: 4, move: function () { return tongs(e); } },
        { id: 'shackleMines', sp: 1, ok: d > 2 && d < 13, w: 3, move: function () { return mines(e); } },
        { id: 'chainWeb', sp: 1, ok: d > 2 && d < 12, w: 3, move: function () { return web(e); } }
      ];
      return api.pick(e, list);
    };
    // ---- her adımda: nefes alan körük, kor kıvılcımı, tavlanmış (öfkeli) müttefiklerin parıltısı
    var attach0 = base.attach;
    base.attach = function (c) {
      if (attach0) attach0.apply(this, arguments); core = c;
      if (c.chapter === 4) c.hooks.push({ tick: function (dt) { time += dt; tickFx(dt); }, reset: function () { var l = core.ext.enemies; for (var i = 0; i < l.length; i++) { var e = l[i]; e.c4cd = null; e.c4temper = 0; e.buff = 0; if (e._c4w && e._c4s) e._c4w.scale.copy(e._c4s); } } });
      wrapAudio();
    };
    function ember(x, y, z, n, col, rise) { var o = B.Boss2 && B.Boss2.out; if (o && o.emit) o.emit(x, y, z, 4, col, (Math.random() - .5) * .3, rise, (Math.random() - .5) * .3, .8 + Math.random() * .5, .04); }
    function tickFx(dt) {
      var list = core.ext.enemies, pl = api.player;
      for (var i = 0; i < list.length; i++) {
        var e = list[i]; if (e.dead || !e.model || !e.model.root.visible) continue;
        if (Math.abs(e.x - pl.x) > 22 || Math.abs(e.z - pl.z) > 22) continue;
        if (e.type === 'bellowsmaster') {
          var w = e._c4w || (e._c4w = e.model.root.getObjectByName('weapon')); if (!w) continue;
          if (!e._c4s) e._c4s = w.scale.clone();
          var act = e.action && (e.action.moveId === 'stoke' || e.action.moveId === 'bellowsJet') ? e.action : null, ph = time * 2.4 + e.index, k = 1 + .045 * Math.sin(ph);
          if (act) { var f = act.moveId === 'stoke' ? 5.5 : 8; k = 1 + (.07 + .16 * Math.min(1, act.age * 1.2)) * Math.abs(Math.sin(act.age * f * 1.6)) - .1; }
          w.scale.set(e._c4s.x, e._c4s.y * k, e._c4s.z);
          if (act && act.age < 2.4) { e._c4a = (e._c4a || 0) + dt * (act.moveId === 'stoke' ? 22 : 30); while (e._c4a >= 1) { e._c4a -= 1; var an = Math.random() * TAU; ember(e.x + Math.sin(e.face) * .8 + Math.sin(an) * .15, 1.55 + Math.random() * .3, e.z + Math.cos(e.face) * .8 + Math.cos(an) * .15, 1, [2.4, .9, .25], .5 + Math.random()); } }
        }
        if (e.c4temper > 0) {
          e.c4temper -= dt; e._c4t = (e._c4t || 0) + dt * 14;
          while (e._c4t >= 1) { e._c4t -= 1; var a2 = Math.random() * TAU; ember(e.x + Math.sin(a2) * .5, .4 + Math.random() * (e.model.height || 2.2), e.z + Math.cos(a2) * .5, 1, [2.6, .7, .2], .7); }
        }
      }
    }
    // ---- ses: yeni dosya yok; mevcut kayıtlardan karakter katmanları (kilitliyken/?sessiz'de B.Audio.sample sessizce 0 döner)
    function wrapAudio() {
      var A = B.Audio; if (!A || A.__c4 || !A.play) return; A.__c4 = 1; var play0 = A.play;
      A.play = function (name, o) {
        var r = play0.apply(this, arguments);
        if (o && (o.type === 'bellowsmaster' || o.type === 'shackler') && (name === 'enemyWindup' || name === 'enemyAttack' || name === 'kill') && A.sample) {
          var at = { x: o.x, z: o.z }, bm = o.type === 'bellowsmaster';
          if (name === 'enemyWindup') { if (bm) { A.sample('swish', { vol: .3, at: at, rate: .52 }); A.sample('winch', { vol: .2, at: at, rate: .78, delay: .1 }); } else { A.sample('chain', { vol: .42, at: at, rate: .88 }); A.sample('metal', { vol: .16, at: at, rate: 1.25, delay: .08 }); } }
          else if (name === 'enemyAttack') { if (bm) { A.sample('swish', { vol: .5, at: at, rate: .45 }); A.sample('metal', { vol: .16, at: at, rate: 1.35, delay: .05 }); } else { A.sample('chain', { vol: .5, at: at, rate: .8 }); A.sample('swish', { vol: .3, at: at, rate: .72 }); } }
          else { A.sample(bm ? 'winch' : 'chain', { vol: .4, at: at, rate: bm ? .6 : .72, delay: .3 }); A.sample('metal', { vol: .3, at: at, rate: bm ? 1.1 : .7, delay: .45 }); }
        }
        return r;
      };
    }
    return base;
  };

  // ------------------------------------------------------------------------------------------------ YERLEŞİM (forge-world.js kanca: sarma)
  if (B.ForgeWorld && B.ForgeWorld.build) {
    var build0 = B.ForgeWorld.build;
    B.ForgeWorld.build = function () {
      var w = build0.apply(this, arguments);
      try { place(w); } catch (e) { if (window.console) console.warn('mobs-c4 place', e); }
      return w;
    };
  }
  function place(w) {
    var used = { bellowsmaster: 0, shackler: 0 }, ring = [[-6, 0], [6, 1], [0, 6], [-5, 5], [5, -5], [0, -7], [-8, 3], [8, -3], [-3, -6], [3, 7], [-9, -4], [9, 4]];
    (w.encounters || []).forEach(function (enc) {
      var want = PLACE[enc.id]; if (!want || !enc.spawns || !enc.spawns.length) return;
      var cx = 0, cz = 0, n = 0; enc.spawns.forEach(function (s) { if (!s.boss) { cx += s.x; cz += s.z; n++; } }); if (!n) return; cx /= n; cz /= n;
      want.forEach(function (type0, wi) {
        var elite = /\*$/.test(type0), type = type0.replace('*', '');   // '*' = adlandırılmış elit (mob-mods şampiyon sistemi)
        if (used[type] >= TUNE.placeMax) return;
        for (var i = 0; i < ring.length; i++) {
          var o = ring[(i + wi * 5 + (enc.id.length * 3)) % ring.length], x = cx + o[0], z = cz + o[1];
          if (w.isWalkable && !w.isWalkable(x, z, .8)) continue;
          if (enc.spawns.some(function (s) { return Math.hypot(s.x - x, s.z - z) < 2.8; })) continue;
          var sp = { type: type, x: x, z: z }; if (elite) { sp.elite = true; sp.name = tr('Körüklerin Ustabaşısı'); } enc.spawns.push(sp); used[type]++; return;
        }
      });
    });
    w.c4Placed = used;
  }
  B.MobsC4 = { TUNE: TUNE, PLACE: PLACE, TYPES: TYPES };
}());
