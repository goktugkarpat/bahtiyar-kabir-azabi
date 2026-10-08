/* KABİR AZABI — V: Son Mahkeme. İki yeni mahkeme düşmanı (ajan: EN5).
     sealwright  Mühür Kazıcı  (Seal Engraver)  — tuzak kurucu / alan kapatıcı: yere mühür kazır; hero kaçmazsa mühür patlar ve iz bırakır.
     voidwitness Boşluk Tanığı (Void Witness)   — kontrolcü: Boşluk Kuyusu ile kahramanı içeri çeker, ardından kuyu çöker; yürüyen adım izleri.
   Tüm kolay-ayar sayıları TUNE tablosunda (denge ajanı yalnız burayı değiştirir). Yeni kod bu dosyada; mevcut dosyalarda yalnız kancalar var:
   finale-models.js (B.FinaleExtra.pre/tints/build/weapon + FinaleModels.make), finale-world.js (B.MobsC5.place), target-hud.js, audio.js, telegraphs.js.
   Saldırılar finale-combat.js'in create()'i sarılarak eklenir (attack()). Kahraman bloklayamaz; her saldırı uyarı alanıyla gelir (>=.55 sn). */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, TAU = Math.PI * 2, tr = function (s) { return KabirI18n.t(s); };

  // ---------- KOLAY AYAR (tek yer) ----------
  var TUNE = {
    sealwright: { hp: 215, speed: 2.05, radius: .5, reach: 13, cooldown: 2.1, stamp: 17, ring: 15, trap: 15, burn: 3, bind: 17, bindEnd: 12 },
    voidwitness: { hp: 232, speed: 2.7, radius: .5, reach: 10, cooldown: 1.8, claw: 17, well: 6, implode: 21, steps: 13 }
  };

  // ---------- Çeviriler ----------
  Object.assign(KabirI18n.dictionary, {
    'Mühür Kazıcı': 'Seal Engraver', 'Boşluk Tanığı': 'Void Witness',
    'Damga Vuruşu': 'Stamp Blow', 'Damga Halkası': 'Stamp Ring', 'Mühür Tuzağı': 'Seal Trap', 'Mühür İzi': 'Seal Scar', 'Mühür Bağı': 'Seal Tether', 'Mühür Düğümü': 'Seal Knot',
    'Tanığın Pençesi': 'Witness Claw', 'Boşluk Kuyusu': 'Void Well', 'Kuyunun Çöküşü': 'Well Collapse', 'Tanığın Adımları': 'Witness Steps',
    'Mühür Kazıcı mühürleri senin altına kazır. Gölgesi açılan daireden yürü; iz kalan yerde durma.': 'The Seal Engraver carves sigils under your feet. Walk out of every marked circle and do not stand on the scar it leaves.',
    'Mühür Bağı iki daireyi bir çizgiyle bağlar. Çizgiyi yandan, ince yönden kes; ortada durma.': 'The Seal Tether joins two circles with a line. Cut across the thin side of the line and never stand in its middle.',
    'Kuyu seni içine çeker, sonra çöker. Çekimden önce yuvarlan ya da halkanın dışında kal; çökme dairesinden çık.': 'The well drags you in, then collapses. Roll before the pull or stay outside the ring, then leave the collapse circle.'
  });
  if (B.FinaleCombat && B.FinaleCombat.deathTips) B.FinaleCombat.deathTips.push(
    [/Mühür Tuzağı|Mühür İzi|Damga/i, tr('Mühür Kazıcı mühürleri senin altına kazır. Gölgesi açılan daireden yürü; iz kalan yerde durma.')],
    [/Mühür Bağı|Mühür Düğümü/i, tr('Mühür Bağı iki daireyi bir çizgiyle bağlar. Çizgiyi yandan, ince yönden kes; ortada durma.')],
    [/Boşluk Kuyusu|Kuyunun|Tanığın/i, tr('Kuyu seni içine çeker, sonra çöker. Çekimden önce yuvarlan ya da halkanın dışında kal; çökme dairesinden çık.')]);

  // ---------- İstatistikler ----------
  function stat(id, name, color, extra) { var t = TUNE[id]; return Object.assign({ name: name, hp: t.hp, speed: t.speed, radius: t.radius, reach: t.reach, cooldown: t.cooldown, color: color, forge: true, finale: true }, extra || {}); }
  var STATS = { sealwright: stat('sealwright', tr('Mühür Kazıcı'), 0xa6867a, { ranged: true }), voidwitness: stat('voidwitness', tr('Boşluk Tanığı'), 0x8e98bc) };
  if (B.FinaleCombat) Object.assign(B.FinaleCombat.stats, STATS);

  // ---------- Hareket profili (authored-motion.js LATE) ----------
  if (B.AuthoredMotion && B.AuthoredMotion.late) Object.assign(B.AuthoredMotion.late, {
    sealwright: { hunch: .16, sink: .26, lunge: .07, death: 1.25, buckle: .22, thud: 1, hurt: .8 },
    voidwitness: { sink: .08, lunge: .02, death: 1.9, buckle: 0, thud: 0, hurt: 1.2 }
  });

  // ---------- Yerleşim: mevcut formasyonlara karışır (yerlerini almaz) ----------
  var PLACE = {   // oda -> [[tür, x, z], ...] (oda merkezine göre)
    1: [['sealwright', 0, -1.5]], 2: [['voidwitness', 0, 1]], 3: [['sealwright', -5, 0]], 4: [['voidwitness', 0, -6.5]], 5: [['sealwright', -6, -1], ['voidwitness', 6, 2]],
    6: [['sealwright', 0, 0]], 7: [['voidwitness', 0, 3]], 8: [['sealwright', -2, 0]], 9: [['voidwitness', -1, -3]], 10: [['sealwright', 5, -4], ['voidwitness', -4, -3]],
    12: [['sealwright', 0, -6], ['voidwitness', 0, 4]]
  };
  B.MobsC5 = { tune: TUNE, stats: STATS, placement: PLACE, place: function (FORM) { Object.keys(PLACE).forEach(function (k) { if (FORM[k]) PLACE[k].forEach(function (q) { FORM[k].push(q.slice()); }); }); } };

  // ---------- Saldırılar ----------
  var BLOOD = 'ember';
  function hit(at, warn, shape, r, dmg, pose, more) { return Object.assign({ at: at, warn: warn, shape: shape, radius: r, dmg: dmg, pose: pose, style: BLOOD, fill: 'radial' }, more || {}); }
  var MOVES = {};
  MOVES.sealwright = function (e, d, api) {
    var t = TUNE.sealwright, P = api.player;
    function burst(o, r, col) { return function () { api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: r, color: col || 0xff3a22, duration: .55 }); api.emit('impact', { x: o.x, z: o.z, strength: .3, radius: 5 }); }; }
    function walk(o, r) { return api.walkable(o.x, o.z, r || .6); }
    function stamp() {   // yakın: damga vuruşu + etrafında halka
      var m = { id: 'sealStamp', name: tr('Damga Vuruşu'), duration: 2.9, pose: 'overhead', hits: [
        hit(.95, .95, 'cone', 3.3, t.stamp, 'overhead', { arc: 1.7, style: 'blunt', fill: 'forward', knockback: 1.4, attack: tr('Damga Vuruşu') }),
        hit(1.85, .85, 'ring', 4.6, t.ring, 'overhead', { inner: 1.6, arc: TAU, style: 'quake', fill: 'radial', beat: false, attack: tr('Damga Halkası') })] };
      return m;
    }
    function trap() {   // 3 mühür: biri kahramanın altında, ikisi çevresinde; patlayınca iz bırakır
      var p = { x: P.x, z: P.z }, hits = [], base = Math.atan2(p.x - e.x, p.z - e.z), spots = [p];
      for (var i = 1; i <= 2; i++) for (var dist = 3.1; dist > 1.5; dist -= .7) { var a = base + (i === 1 ? 1 : -1) * (1.15 + i * .18), o = { x: p.x + Math.sin(a) * dist, z: p.z + Math.cos(a) * dist }; if (walk(o, .5)) { spots.push(o); break; } }
      spots.forEach(function (o, k) {
        var at = 1.55 + k * .5;
        hits.push(hit(at, 1.5, 'circle', 1.6, t.trap, 'castHigh', { origin: o, style: 'rune', fill: 'radial', beat: k === 0, attack: tr('Mühür Tuzağı'), scar: true, onActive: burst(o, 2.2) }));
        hits.push(hit(at + .12, .3, 'circle', 1.3, t.burn, 'castHigh', { origin: o, persistent: true, periodic: true, interval: .8, duration: 3.2, pool: 'lava', style: 'rune', fill: 'radial', beat: false, near: false, attack: tr('Mühür İzi') }));
      });
      return { id: 'sealTrap', name: tr('Mühür Tuzağı'), duration: 1.55 + spots.length * .5 + .9, pose: 'castHigh', cooldown: 1.2, hits: hits };
    }
    function bindPts() {   // kahramanın iki yanında iki mühür; aralarındaki çizgi hero'dan geçer
      var p = { x: P.x, z: P.z }, a = Math.atan2(p.x - e.x, p.z - e.z) + Math.PI / 2;
      for (var R = 3.8; R >= 2.2; R -= .8) { var A = { x: p.x + Math.sin(a) * R, z: p.z + Math.cos(a) * R }, Bp = { x: p.x - Math.sin(a) * R, z: p.z - Math.cos(a) * R }; if (walk(A, .5) && walk(Bp, .5)) return { A: A, B: Bp, R: R, face: a + Math.PI }; }
      return null;
    }
    function bind(g) {
      var nm = tr('Mühür Bağı');
      return { id: 'sealBind', name: nm, duration: 3.1, pose: 'castHigh', cooldown: 1.2, hits: [
        hit(1.6, 1.6, 'line', 0, t.bind, 'castHigh', { origin: g.A, face: g.face, width: 1.15, length: g.R * 2, style: 'chain', fill: 'forward', beat: true, attack: nm }),
        hit(1.6, 1.6, 'circle', 1.35, t.bindEnd, 'castHigh', { origin: g.A, style: 'rune', fill: 'radial', beat: false, attack: tr('Mühür Düğümü'), onActive: burst(g.A, 1.9) }),
        hit(1.6, 1.6, 'circle', 1.35, t.bindEnd, 'castHigh', { origin: g.B, style: 'rune', fill: 'radial', beat: false, attack: tr('Mühür Düğümü'), onActive: burst(g.B, 1.9) })] };
    }
    var now = api.game.elapsed || 0, cd = e.c5cd || (e.c5cd = {});
    function ready(id) { return !(cd[id] > now && cd[id] < now + 12); }   // (a checkpoint reload may rewind the clock: far-future stamps count as expired)
    var g = d > 3 && d < 12 && ready('bind') ? bindPts() : null;
    // both specials are plain moves on their own clocks: a caster that holds range must be able to act, then strafe in the lulls
    return [
      { id: 'sealStamp', ok: d < 4.2, w: 4, move: stamp },
      { id: 'sealTrap', ok: d > 2.2 && d < 14 && ready('trap'), w: 4, move: function () { cd.trap = now + 6.5; return trap(); } },
      { id: 'sealBind', ok: !!g, w: 3.5, move: function () { cd.bind = now + 8.5; return bind(g); } }
    ];
  };
  MOVES.voidwitness = function (e, d, api) {
    var t = TUNE.voidwitness, P = api.player;
    function claw() {
      var a = hit(.72, .72, 'cone', 3.1, t.claw, 'clawR', { arc: 1.8, style: 'shadow', fill: 'sweep', attack: tr('Tanığın Pençesi'), knockback: .8 });
      var b = hit(1.22, .55, 'cone', 3.2, t.claw - 4, 'clawL', { arc: 1.6, face: e.face + .25, style: 'shadow', fill: 'sweep', sweepDir: -1, beat: false, attack: tr('Tanığın Pençesi') });
      return { id: 'witnessClaw', name: tr('Tanığın Pençesi'), duration: 2.0, pose: 'clawR', hits: [a, b] };
    }
    function well() {   // gri halka çeker (kuyunun merkezine), 1.3 sn sonra merkezde kızıl daire çöker
      var a = Math.atan2(P.x - e.x, P.z - e.z), dist = Math.min(5, Math.max(2.6, d * .55)), W = { x: e.x + Math.sin(a) * dist, z: e.z + Math.cos(a) * dist };
      if (!api.walkable(W.x, W.z, .8)) W = { x: e.x, z: e.z };
      var pull = hit(1.35, 1.35, 'ring', 8.0, t.well, 'castHigh', { origin: W, inner: 1.3, arc: TAU, pull: true, pullTo: 1.5, style: 'shadow', fill: 'inward', attack: tr('Boşluk Kuyusu'), onActive: function () { api.fx('glowBurst', { x: W.x, y: .05, z: W.z, radius: 4.6, color: 0x2a3cb8, duration: .6 }); } });
      var boom = hit(2.7, 1.3, 'circle', 2.3, t.implode, 'castHigh', { origin: W, style: 'shadow', fill: 'inward', unblockable: true, beat: false, attack: tr('Kuyunun Çöküşü'), onActive: function () { api.fx('glowBurst', { x: W.x, y: .05, z: W.z, radius: 3.0, color: 0x5a6cff, duration: .5 }); api.emit('impact', { x: W.x, z: W.z, strength: .55, radius: 7 }); } });
      return { id: 'voidWell', name: tr('Boşluk Kuyusu'), duration: 3.8, pose: 'castHigh', cooldown: 1.4, hits: [pull, boom] };
    }
    function steps() {   // tanıktan kahramana doğru yürüyen 4 daire
      var a = Math.atan2(P.x - e.x, P.z - e.z), hits = [], L = Math.max(3, d), n = 4;
      for (var i = 0; i < n; i++) (function (i) { var s = d >= 5 ? L * (i + 1) / n : 1.5 + i * 1.5, o = { x: e.x + Math.sin(a) * s, z: e.z + Math.cos(a) * s }; if (!api.walkable(o.x, o.z, .5)) return;
        hits.push(hit(1.1 + i * .3, 1.0, 'circle', 1.45, t.steps, 'castHigh', { origin: o, style: 'shadow', fill: 'radial', beat: i === 0, attack: tr('Tanığın Adımları'), onActive: function () { api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: 1.8, color: 0x4a66ff, duration: .4 }); } })); })(i);
      if (!hits.length) return null;
      return { id: 'witnessSteps', name: tr('Tanığın Adımları'), duration: 1.1 + n * .3 + .8, pose: 'castHigh', cooldown: 1.2, hits: hits };
    }
    return [
      { id: 'witnessClaw', ok: d < 3.4, w: 4, move: claw },
      { id: 'voidWell', sp: 1, ok: d > 1.6 && d < 11, w: 3.5, move: well },
      { id: 'witnessSteps', sp: 1, ok: d > 1.8 && d < 12, w: 3, move: function () { return steps() || claw(); } }
    ];
  };
  if (B.FinaleCombat && B.FinaleCombat.create) {
    var baseCreate = B.FinaleCombat.create;
    B.FinaleCombat.create = function (api) {
      var self = baseCreate(api), baseAttack = self.attack;
      self.attack = function (e, d) { var f = MOVES[e.type]; return f ? api.pick(e, f(e, d, api)) : baseAttack(e, d); };
      return self;
    };
  }

  // ---------- Modeller (finale-models.js kancaları) ----------
  var X = B.FinaleExtra = B.FinaleExtra || { pre: {}, tints: {}, build: {}, weapon: {} };
  X.tints.sealwright = { cloth: [.07, .065, .1], skin: [.82, .74, .7] };
  X.tints.voidwitness = { cloth: [.09, .1, .17], skin: [.7, .7, .86] };
  X.pre.voidwitness = function (A, skin, spine) { A.lengthen({ lowerarm_l: 1.7, lowerarm_r: 1.7, hand_l: 1.5, hand_r: 1.5 }); var s = {}; s[spine] = .74; A.slim(skin, s, 1); };
  X.pre.sealwright = function (A, skin, spine) { var s = {}; s[spine] = .9; A.slim(skin, s, 1); };
  function mats(c, id, defs) {   // ek malzemeler: mürekkep, mum, kurşun
    var C = c.C, T_ = c.T, M = c.materials;
    if (defs.ink) M.ink = C.bodyMaterial(C.gearMaterial('leather'), 'finale-' + id + '-ink', { cls: 'leather', tint: [.1, .09, .13], grime: .15, blood: 0, scale: 8 }, { roughness: .26, color: new T_.Color(0x17141f) });
    if (defs.wax) M.wax = C.bodyMaterial(C.gearMaterial('leather'), 'finale-' + id + '-wax', { cls: 'leather', tint: [.6, .05, .06], grime: .12, blood: .2, scale: 10 }, { roughness: .36, color: new T_.Color(0x86101a), emissive: new T_.Color(0x2c0405), emissiveIntensity: .6 });
    if (defs.lead) M.lead = C.bodyMaterial(C.gearMaterial('iron'), 'finale-' + id + '-lead', { cls: 'metal', tint: [.5, .53, .6], rust: .08, grime: .32, wear: .4, scale: 8 }, { roughness: .4, metalness: .85 });
  }
  X.build.sealwright = function (c) {
    var A = c.A, C = c.C, G = c.G, V = c.V, T_ = c.T, fitted = c.fitted, fb = c.fb, hip = c.hip, chest = c.chest, p = c.p, head = c.head, spine = c.spine, TAU_ = TAU;
    mats(c, 'sealwright', { ink: 1, wax: 1, lead: 1 });
    c.robe(.05, .14, .03);
    var shell = G.sheet(32, 14, function (u, v) { return fitted.at(u * TAU_, fb.max.y - .012 - v * (fb.max.y - fb.min.y - .075), .03); }, true, true); G.uvScale(shell, 2.5, 2); fitted.attach('rag', shell);
    var h = c.hood(.05);
    // kurşun mühür-yüz: gözleri yarık, alnında mum mühür, ağzında perçinli kayış; gözlerden mürekkep süzülür
    var fz = h.center.z + .105;
    A.rigid('lead', G.sphere(.11, [h.center.x, h.center.y, h.center.z + .06], [.88, 1.16, .44], 16, 12), head);
    A.rigid('glow', G.merge([G.box(.032, .008, .012, [h.center.x - .044, h.center.y + .03, fz + .06]), G.box(.032, .008, .012, [h.center.x + .044, h.center.y + .03, fz + .06])]), head);
    A.rigid('wax', G.sphere(.034, [h.center.x, h.center.y + .095, fz + .03], [1, 1, .45], 10, 8), head);
    A.rigid('iron', G.merge([G.box(.1, .014, .012, [h.center.x, h.center.y - .055, fz + .062]), G.sphere(.009, [h.center.x - .04, h.center.y - .055, fz + .07], [1, 1, 1], 6, 4), G.sphere(.009, [h.center.x + .04, h.center.y - .055, fz + .07], [1, 1, 1], 6, 4)]), head);
    var drips = []; [-1, 1].forEach(function (s) { drips.push(G.tube([[h.center.x + s * .044, h.center.y + .026, fz + .064], [h.center.x + s * .05, h.center.y - .02, fz + .062], [h.center.x + s * .048, h.center.y - .13, fz + .03], [h.center.x + s * .05, h.center.y - .24, fz - .02]], function (t) { return .007 * (1 - t * .6) + .002; }, 5, 14, true)); });
    A.rigid('ink', G.merge(drips), head);
    // omuz pelerini
    var mantle = G.shell(30, 8, function (u, v) { var a = u * TAU_; return fitted.at(a, fb.max.y + .02 - v * .3, .05 + v * .08 + .012 * Math.sin(a * 8)); }, .006, true, true); G.uvScale(mantle, 2, 1); G.wear(mantle, { edge: 0, border: 0, cavity: 0, curv: 0, tear: { amount: .3, width: .02, bottom: .06, base: .01 } }); fitted.attach('rag', mantle);
    // sırtta taşıdığı kanun levhası: demir çerçeve, oyma parlak satırlar ve mühür halkası; kayışlarla gövdeye bağlı
    var tx = fitted.cx, ty = chest.y - .02, tz = fb.min.z - .17;
    A.rigid('bone', G.box(.5, .64, .07, [tx, ty, tz]), spine);
    A.rigid('iron', G.merge([G.box(.57, .045, .095, [tx, ty + .34, tz]), G.box(.57, .045, .095, [tx, ty - .34, tz]), G.box(.045, .64, .095, [tx - .27, ty, tz]), G.box(.045, .64, .095, [tx + .27, ty, tz])]), spine);
    var eng = []; for (var k = 0; k < 5; k++) eng.push(G.box(.36 - (k % 2) * .13, .016, .01, [tx, ty + .24 - k * .075, tz - .04]));
    eng.push(G.ring(.085, .008, [tx, ty - .17, tz - .042], [0, 0, 0], 5, 22), G.box(.012, .15, .01, [tx, ty - .17, tz - .042]));
    A.rigid('glow', G.merge(eng), spine);
    var straps = [fb.max.y - .1, fb.min.y + .2].map(function (y) { var pts = []; for (var i = 0; i <= 24; i++) pts.push(V.apply(null, fitted.at(i / 24 * TAU_, y, .036))); return G.tube(pts, .017, 5, 28, false); });
    fitted.attach('leather', G.merge(straps));
    // kemerde mum mühürler zincirle sallanır; sol kalçada mürekkep hokkası + tüy kalem
    var chains = [], waxes = [];
    for (var m = 0; m < 9; m++) { var a = m / 9 * TAU_ + .25, x = hip.x + Math.sin(a) * .36, z = hip.z + Math.cos(a) * .36, len = 2 + (m % 3);
      for (var j = 0; j < len; j++) chains.push(G.ring(.02, .006, [x, hip.y - .02 - j * .045, z], [j % 2 ? Math.PI / 2 : 0, 0, 0], 4, 8));
      waxes.push(G.sphere(.05, [x, hip.y - .06 - len * .045, z], [1, 1, .5], 10, 8)); }
    var wt = C.clothWeights(A, 'pelvis', c.thighL, c.thighR, hip.y, hip.y - .55, .5);
    A.weighted('iron', G.merge(chains), wt); A.weighted('wax', G.merge(waxes), C.clothWeights(A, 'pelvis', c.thighL, c.thighR, hip.y, hip.y - .55, .5));
    var ix = hip.x - .36, iy = hip.y - .1, iz = hip.z + .1;
    A.rigid('ink', G.sphere(.08, [ix, iy, iz], [1, 1.1, 1], 12, 10), 'pelvis'); A.rigid('iron', G.cyl(.03, .036, .05, 8, [ix, iy + .09, iz]), 'pelvis'); A.rigid('bone', G.merge([G.cyl(.026, .026, .03, 8, [ix, iy + .13, iz]), G.spike(.012, V(ix, iy + .14, iz), V(ix - .06, iy + .42, iz + .05))]), 'pelvis');
    // mürekkeple kararmış kollar, geniş kollar
    ['l', 'r'].forEach(function (s) { c.limbCover('rag', 'upperarm_' + s, 'lowerarm_' + s, .06, .94, .03, .002, .05); c.limbCover('ink', 'lowerarm_' + s, 'hand_' + s, .02, .9, .028, .002, .02); });
    ['l', 'r'].forEach(function (s) { c.limbCover('rag', 'thigh_' + s, 'calf_' + s, -.02, 1.06, .028, .003, .01); c.limbCover('rag', 'calf_' + s, 'foot_' + s, -.05, .94, .024, .003, .008); c.boot('foot_' + s, 'ball_' + s); });
    c.shackle(c.handL, .052, 3); c.shackle(c.handR, .052, 3);
  };
  X.weapon.sealwright = function (c) {
    var G = c.G, V = c.V, T_ = c.T;
    return { parts: {
      leather: [G.cyl(.036, .036, .34, 8, [0, .05, 0])],
      iron: [G.cyl(.026, .032, 1.05, 10, [0, .4, 0]), G.sphere(.055, [0, -.16, 0], [1, 1, 1], 8, 6), G.cyl(.075, .06, .07, 10, [0, .93, 0]), G.cyl(.23, .23, .1, 28, [0, 1.12, 0])].concat([0, 1, 2, 3].map(function (k) { var a = k * Math.PI / 2 + .78; return G.sphere(.034, [Math.sin(a) * .21, 1.18, Math.cos(a) * .21], [1, 1, 1], 8, 6); })),
      glow: [G.ring(.17, .012, [0, 1.066, 0], [Math.PI / 2, 0, 0], 5, 28), G.box(.32, .012, .012, [0, 1.064, 0]), G.box(.012, .012, .32, [0, 1.064, 0])]
    }, tip: new T_.Vector3(0, 1.22, 0) };
  };
  X.build.voidwitness = function (c) {
    var A = c.A, C = c.C, G = c.G, V = c.V, T_ = c.T, fitted = c.fitted, fb = c.fb, hip = c.hip, chest = c.chest, head = c.head, spine = c.spine, torsoH = c.torsoH, M = c.materials;
    c.robe(0, .24, .26);
    // kefen şeritleri: omuzdan yere sarkan yırtık bezler (kumaş gibi sallanır)
    var strips = [];
    for (var k = 0; k < 12; k++) (function (k) { var ang = k / 12 * TAU + .2, bx = fitted.at(ang, fb.max.y - .05, .06), tx = Math.cos(ang), tz = -Math.sin(ang), rx = Math.sin(ang), rz = Math.cos(ang);
      var g = G.sheet(4, 12, function (u, v) { var w = (u - .5) * (.09 + v * .04); return [bx[0] + tx * w + rx * v * .24 + Math.sin(v * 7 + k) * .02, fb.max.y - .05 - v * 1.45, bx[2] + tz * w + rz * v * .24 + Math.cos(v * 6 + k * 2) * .02]; }, true);
      G.uvScale(g, .5, 2.5); G.wear(g, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .5, width: .03, bottom: .16, base: .02 } }); strips.push(g); })(k);
    A.weighted('rag', G.merge(strips), C.clothWeights(A, 'pelvis', c.thighL, c.thighR, fb.max.y, fb.max.y - 1.45, .6));
    var h = c.hood(.02);
    // yüzsüz kemik maske: dikilmiş ağız, soğuk yarık gözler, alnında çatlak
    var fz = h.center.z + .105;
    A.rigid('bone', G.sphere(.108, [h.center.x, h.center.y, h.center.z + .06], [.88, 1.2, .5], 16, 12), head);
    A.rigid('cold', G.merge([G.box(.034, .007, .012, [h.center.x - .046, h.center.y + .035, fz + .05]), G.box(.034, .007, .012, [h.center.x + .046, h.center.y + .035, fz + .05]), G.box(.007, .13, .01, [h.center.x, h.center.y + .07, fz + .035])]), head);
    var st = []; for (var q = 0; q < 6; q++) st.push(G.box(.008, .034, .008, [h.center.x - .05 + q * .02, h.center.y - .06, fz + .06])); st.push(G.box(.11, .006, .008, [h.center.x, h.center.y - .06, fz + .062]));
    A.rigid('iron', G.merge(st), head);
    // kırık hüküm halesi: gözlerle dolu zincirli halka başının arkasında
    var halo = [], eyes = [], spikes = [], hc = h.center, hy = hc.y + .08, hz = hc.z - .17;
    for (var i = 0; i <= 20; i++) { var a = .35 + i / 20 * (TAU - 1.0); halo.push(new T_.Vector3(hc.x + Math.cos(a) * .34, hy + Math.sin(a) * .34, hz)); }
    A.rigid('iron', G.tube(halo, .016, 6, 36, true), head);
    for (var e2 = 0; e2 < 7; e2++) { var ea = .55 + e2 / 6 * (TAU - 1.4); eyes.push(G.sphere(.034, [hc.x + Math.cos(ea) * .34, hy + Math.sin(ea) * .34, hz + .015], [1, 1.35, .6], 8, 6)); }
    A.rigid('cold', G.merge(eyes), head);
    for (var s2 = 0; s2 < 6; s2++) { var sa = .4 + s2 * 1.0, from = V(hc.x + Math.cos(sa) * .36, hy + Math.sin(sa) * .36, hz), to = from.clone().add(V(Math.cos(sa) * .12, Math.sin(sa) * .12, -.02)); spikes.push(G.spike(.014, from, to)); }
    A.rigid('bone', G.merge(spikes), head);
    // açık kaburgalar ve soğuk çatlaklar; omuzlarda kemik dikenler; uzun pençeler; bileklerde zincir
    var ribs = []; for (var r = 0; r < 5; r++) { var pts = []; for (var j = 0; j <= 8; j++) pts.push(V.apply(null, fitted.at(-1.05 + j / 8 * 2.1, fb.max.y - .16 - r * torsoH * .14, .05 + .018 * Math.sin(j / 8 * Math.PI)))); ribs.push(G.tube(pts, .011 - r * .001, 5, 18, false)); }
    fitted.attach('bone', G.merge(ribs));
    var fc = []; for (var m = 0; m < 4; m++) { var a0 = (m - 1.5) * .5, pp = []; for (var j2 = 0; j2 < 5; j2++) pp.push(V.apply(null, fitted.at(a0 + Math.sin(j2 * 2.1 + m * 1.7) * .14, fb.max.y - .04 - j2 * torsoH * .17, .03))); fc.push(G.tube(pp, .0065, 5, 16, false)); }
    fitted.attach('cold', G.merge(fc));
    [[c.armL, -1], [c.armR, 1]].forEach(function (pair) { var q = A.P(pair[0]), sp = []; for (var n = 0; n < 3; n++) sp.push(G.spike(.032 - n * .006, V(q.x + pair[1] * (.04 + n * .035), q.y + .05, q.z - n * .02), V(q.x + pair[1] * (.16 + n * .07), q.y + .32 - n * .06, q.z - .12 - n * .04))); A.rigid('bone', G.merge(sp), pair[0]); });
    [c.handL, c.handR].forEach(function (hand) { var o = A.P(hand), parts = []; for (var kk = 0; kk < 4; kk++) { var q2 = o.clone().add(V((kk - 1.5) * .025, -.08, .03)), tip = q2.clone().add(V((kk - 1.5) * .012, -.17, .07)); parts.push(G.tube([q2, q2.clone().lerp(tip, .5).add(V(0, 0, .025)), tip], function (t) { return .011 * Math.pow(1 - t, 1.2) + .001; }, 6, 10, true)); } A.rigid('bone', G.merge(parts), hand); });
    c.shackle(c.handL, .06, 4); c.shackle(c.handR, .06, 4);
    // beline asılı kırık terazi: tartılmış ruhlar
    var sx = hip.x + .3, sy = hip.y - .1, sz = hip.z + .12, bal = [G.box(.34, .014, .014, [sx, sy, sz]), G.sphere(.022, [sx, sy + .03, sz], [1, 1, 1], 8, 6)];
    [-1, 1].forEach(function (s) { bal.push(G.ring(.08, .01, [sx + s * .15, sy - .2 - (s > 0 ? .04 : 0), sz], [Math.PI / 2, 0, 0], 5, 16)); bal.push(G.cyl(.004, .004, .2, 4, [sx + s * .15, sy - .1, sz])); });
    A.weighted('iron', G.merge(bal), C.clothWeights(A, 'pelvis', c.thighL, c.thighR, hip.y, hip.y - .6, .5));
    A.weighted('cold', G.merge([G.sphere(.045, [sx - .15, sy - .19, sz], [1, .5, 1], 10, 6), G.sphere(.05, [sx + .15, sy - .23, sz], [1, .55, 1], 10, 6)]), C.clothWeights(A, 'pelvis', c.thighL, c.thighR, hip.y, hip.y - .6, .5));
  };
  if (B.FinaleModels && B.FinaleModels.make) {
    B.FinaleModels.make('sealwright', { base: 'ubc', height: 2.4, radius: .5, motionType: 'guard' });
    B.FinaleModels.make('voidwitness', { base: 'ubc', height: 2.95, radius: .5, motionType: 'cultist' });
    B.FinaleModels.types.push('sealwright', 'voidwitness');
  }
}());
