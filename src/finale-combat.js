/* KABİR AZABI — V: Son Mahkeme. Move tables of the court and of Kara Kadı, the judge who sealed every verdict.
   Stats carry forge:true (so every chapter III/IV rule of combat.js applies: boss pacing, special gaps, boss2 machinery) plus finale:true
   (combat.js routes attack/phase here). Damage and health scale from the chapter index in combat.js; the numbers below are the base. */
(function () {
  'use strict'; var B = window.BABA, TAU = Math.PI * 2;
  var BLOOD = 'ember';
  B.FinaleCombat = {
    stats: {
      damned: { name: KabirI18n.t('Hükümlü'), hp: 236, speed: 2.75, radius: .46, reach: 8, cooldown: 1.55, color: 0xb88a78, forge: true, finale: true },
      verdictseer: { name: KabirI18n.t('Hüküm Kâtibi'), hp: 205, speed: 2.1, radius: .45, reach: 14, cooldown: 2.15, color: 0xa88878, forge: true, finale: true, ranged: true },
      voidcrawler: { name: KabirI18n.t('Boşluk Sürüngeni'), hp: 224, speed: 3.25, radius: .56, reach: 9, cooldown: 1.7, color: 0x9a8a88, forge: true, finale: true },
      chainjailer: { name: KabirI18n.t('Zincir Gardiyanı'), hp: 340, speed: 1.9, radius: .74, reach: 11, cooldown: 2.2, color: 0xb0948a, forge: true, finale: true },
      verdictwarden: { name: KabirI18n.t('Hüküm Bekçisi'), hp: 1220, speed: 2.25, radius: .84, reach: 14, cooldown: 1.85, color: 0xc09a88, forge: true, finale: true, elite: true },
      lastjudge: { name: KabirI18n.t('Kara Kadı'), hp: 4500, speed: 2.05, radius: 1.15, reach: 18, cooldown: 1.2, color: 0xd09088, forge: true, finale: true, boss: true }
    },
    // dormant adds of the last court (boss2.js wakes them during the fight)
    reserve: [['damned', KabirI18n.t('Kadı’nın Hükümlüsü')], ['verdictseer', KabirI18n.t('Kadı’nın Kâtibi')], ['voidcrawler', KabirI18n.t('Boşluğun Çocuğu')], ['damned', KabirI18n.t('Adı Silinen')]],
    deathTips: [
      [/Son Hüküm/i, KabirI18n.t('Güvenli dilim her dalgada yer değiştirir. Soluk mavi dilimde kal; sonraki dalgada bir sonrakine geç.')],
      [/Mühür Basışı|Kadı’nın Mührü/i, KabirI18n.t('Mühür önce ayağının altına iner, ardından halka genişler. İçeri değil, halkanın dışına çık.')],
      [/Terazi/i, KabirI18n.t('Terazinin iki kefesi sırayla iner. Kızaran kefeden uzaklaş; diğeri bir an sonra iner.')],
      [/Zincir Hükmü|Zincir Seli/i, KabirI18n.t('Zincir hatları paralel düşer. Hatların arasındaki boşluğa geç; geriye kaçmak seni hatta tutar.')],
      [/Efendilerin Yankısı|Çanın Yankısı/i, KabirI18n.t('Yankı halkaları dalga dalga genişler. Halkaların arasındaki karanlık bantta bekle.')],
      [/Mürekkep|Kara Defter/i, KabirI18n.t('Mürekkep damlaları işaretli dairelere düşer. Dairelerin arasından yürü; durduğun yer bir sonraki hedef olabilir.')],
      [/Hüküm Kılıcı|Kılıç/i, KabirI18n.t('Kılıç iki kez savrulur. İlk darbeden sonra içeri girmek dönüş darbesine yakalatır.')],
      [/Boşluk Sıçrayışı/i, KabirI18n.t('Sürüngen sıçramadan önce çömelir. İşaretli daireden yana çık.')]
    ],
    create: function (api) {
      function hit(at, warn, shape, r, dmg, pose, more) { return Object.assign({ at: at, warn: warn, shape: shape, radius: r, dmg: dmg, pose: pose, style: BLOOD, fill: 'radial' }, more || {}); }
      function point() { return { x: api.player.x, z: api.player.z }; }
      function cone(id, name, r, arc, dmg, at, pose) { return { id: id, name: name, duration: at + .8, pose: pose, hits: [hit(at, at, 'cone', r, dmg, pose, { arc: arc, style: 'blade', fill: 'sweep' })] }; }
      function sweep(e, id, name, r, dmg) { var m = cone(id, name, r, 2.8, dmg, .9, 'sweep'); m.hits.push(hit(1.7, .8, 'cone', r + .2, dmg - 3, 'sweepBack', { arc: 2.5, face: e.face - .4, style: 'blade', fill: 'sweep', sweepDir: -1 })); m.duration = 2.5; return m; }
      function lanes(e, count, name, dmg) { var hits = []; for (var i = 0; i < count; i++) { var a = e.face + (i - (count - 1) / 2) * .26; hits.push(hit(1.1 + i * .26, 1, 'line', 0, dmg || 20, 'hookSwing', { face: a, width: .85, length: api.clipLine(e, a, 14), style: 'chain', fill: 'forward', beat: i === 0, knockback: 1.2 })); } return { id: 'verdictChains', name: name || KabirI18n.t('Zincir Hükmü'), duration: 1.9 + count * .26, pose: 'hookSwing', hits: hits }; }
      function ink(e, count, name) { var p = point(), hits = []; for (var i = 0; i < count; i++) { var a = e.face + i * TAU / count + .4, d = i ? 2.6 + (i % 2) * 1.4 : 0, o = { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d }; if (api.walkable(o.x, o.z, .5)) hits.push(hit(1.35 + i * .16, 1.2, 'circle', 1.6, 22, 'castHigh', { origin: o, style: 'ember', unblockable: true, beat: i === 0 })); } return { id: 'inkRain', name: name || KabirI18n.t('Mürekkep Yağmuru'), duration: 2.2 + count * .16, pose: 'castHigh', hits: hits, cooldown: 2.0 }; }
      function leap(e) { var p = point(), a = Math.atan2(p.x - e.x, p.z - e.z), end = { x: p.x - Math.sin(a), z: p.z - Math.cos(a) }; return { id: 'voidLeap', name: KabirI18n.t('Boşluk Sıçrayışı'), duration: 2.1, pose: 'crouch', movement: { start: 1, duration: .3, fromX: e.x, fromZ: e.z, x: end.x, z: end.z, leap: true }, hits: [hit(1.3, 1.1, 'circle', 1.95, 22, 'leap', { origin: p, style: 'ember', unblockable: true })] }; }
      function verdictRing(e, count) { var hits = [], o = { x: e.x, z: e.z }; for (var i = 0; i < count; i++) hits.push(hit(1.35 + i * .72, i ? .72 : 1.35, 'ring', 4.8 + i * 2.9, 24, 'roar', { origin: o, inner: 2.5 + i * 2.9, arc: TAU, style: 'ember', unblockable: true })); return { id: 'echoRings', name: KabirI18n.t('Çanın Yankısı'), duration: 2.0 + count * .72, pose: 'roar', hits: hits, cooldown: 2.0 }; }
      var core = null, self;
      function track(id) { var m = B.Boss2 && B.Boss2.moves; if (m) m[id] = (m[id] || 0) + 1; }
      function cd(e, id, sec) { var c = e.b2cd || (e.b2cd = {}); c[id] = (core ? core.time : 0) + sec; }
      function ready(e, id) { return !e.b2cd || !(e.b2cd[id] > (core ? core.time : 0)); }
      // Kadı's seal: lands on the hero's spot, then the seal's ring spreads (safe band between).
      function seal(e) {
        track('kadiSeal'); var p = point();
        return { id: 'kadiSeal', name: KabirI18n.t('Kadı’nın Mührü'), duration: 3.2, pose: 'overhead', hits: [
          hit(1.25, 1.25, 'circle', 2.5, 26, 'overhead', { origin: p, style: 'quake', fill: 'inward', unblockable: true, scar: true, attack: KabirI18n.t('Mühür Basışı') }),
          hit(2.0, 1.0, 'ring', 6.6, 18, 'overhead', { origin: p, inner: 4.4, arc: TAU, style: 'quake', unblockable: true, beat: false, attack: KabirI18n.t('Mühür Basışı · halka') })] };
      }
      // The scales: two pans either side of the judge, they fall in turn (the heavier, bloodier one first).
      function scales(e) {
        track('scales'); var side = e.face + Math.PI / 2, a = { x: e.x + Math.sin(side) * 4.4, z: e.z + Math.cos(side) * 4.4 }, b = { x: e.x - Math.sin(side) * 4.4, z: e.z - Math.cos(side) * 4.4 }, p = point();
        var first = Math.hypot(p.x - a.x, p.z - a.z) < Math.hypot(p.x - b.x, p.z - b.z) ? a : b, second = first === a ? b : a, hits = [];
        hits.push(hit(1.45, 1.45, 'circle', 4.1, 27, 'castHigh', { origin: first, style: 'quake', fill: 'inward', unblockable: true, attack: KabirI18n.t('Terazi · ağır kefe') }));
        hits.push(hit(2.5, 1.0, 'circle', 4.1, 22, 'castHigh', { origin: second, style: 'quake', fill: 'inward', unblockable: true, beat: false, attack: KabirI18n.t('Terazi · hafif kefe') }));
        if (e.phase >= 2) hits.push(hit(3.3, .8, 'ring', 9, 16, 'roar', { origin: { x: e.x, z: e.z }, inner: 6.6, arc: TAU, style: 'ember', unblockable: true, beat: false, attack: KabirI18n.t('Terazi · denge') }));
        return { id: 'scales', name: KabirI18n.t('Kanlı Terazi'), duration: e.phase >= 2 ? 4.1 : 3.3, pose: 'castHigh', hits: hits, cooldown: 1.6 };
      }
      // Echo of the four lords (phase 2+): the executioner's charge leaves a burning wake, the bell's rings, the king's orbs, the furnace's lanes.
      function echo(e, d) {
        track('lordsEcho'); var k = (e.echoTurn = ((e.echoTurn || 0) + 1) % 4);
        if (k === 0) { var f = e.face, L = api.clipLine(e, f, Math.min(16, d + 4)), run = Math.max(1, L - 1.5); while (run > 1.5 && !api.walkable(e.x + Math.sin(f) * run, e.z + Math.cos(f) * run, e.radius)) run -= .5; var end = { x: e.x + Math.sin(f) * run, z: e.z + Math.cos(f) * run };
          return { id: 'echoCharge', name: KabirI18n.t('Efendilerin Yankısı · Cellat'), duration: 2.5, pose: 'charge', movement: { start: 1.15, duration: .4, fromX: e.x, fromZ: e.z, x: end.x, z: end.z }, hits: [
            hit(1.15, 1.15, 'line', 0, 21, 'charge', { face: f, width: 2.3, length: L, style: 'blunt', fill: 'forward', unblockable: true, knockback: 2.2, duration: .5 }),
            hit(1.55, .3, 'line', 0, 4, 'charge', { face: f, width: 2.0, length: L, persistent: true, periodic: true, interval: .7, duration: 4.0, b2ground: true, pool: 'lava', style: 'ember', fill: 'forward', beat: false, near: false, attack: KabirI18n.t('Kanlı İz') })] }; }
        if (k === 1) { var m = verdictRing(e, e.phase >= 3 ? 3 : 2); m.name = KabirI18n.t('Efendilerin Yankısı · Çancı'); return m; }
        if (k === 2 && core && core.orbs.free() >= 2) { for (var i = 0; i < 2; i++) core.orbs.spawn(e, { kind: 'slag', hold: 1.1 + i * .2, speed: e.phase >= 3 ? 4.3 : 3.9, turn: 1.7, life: 4.6, damage: 5, name: KabirI18n.t('Kralın Küresi'), off: (i - .5) * .75 });
          return { id: 'echoOrbs', name: KabirI18n.t('Efendilerin Yankısı · Kral'), duration: 1.9, pose: 'castHigh', cooldown: 1.5, hits: [hit(1.1, 1.1, 'ring', 2, 0, 'castHigh', { origin: { x: e.x, z: e.z }, inner: 0, arc: TAU, harmless: true })] }; }
        // furnace: three burning lanes towards the hero
        var p = point(), base = Math.atan2(p.x - e.x, p.z - e.z), hits = [], cx = Math.cos(base), cz = -Math.sin(base);
        for (var j = 0; j < 3; j++) { var off = (j - 1) * 3.4, org = { x: e.x + cx * off, z: e.z + cz * off }; if (!api.walkable(org.x, org.z, .3)) org = { x: e.x, z: e.z }; var L2 = api.clipLine(org, base, 15);
          (function (org, L2, j) { hits.push(hit(1.3 + j * .14, 1.3 + j * .14, 'line', 0, 15, 'overhead', { origin: org, face: base, width: 1.9, length: L2, style: 'quake', fill: 'forward', unblockable: true, beat: j === 0, attack: KabirI18n.t('Efendilerin Yankısı · Ocak'), onActive: function () { api.fx('boss2Geyser', { x: org.x, z: org.z, face: base, length: L2, width: 1.9, forge: true }); } }));
            hits.push(hit(1.47 + j * .14, .3, 'line', 0, 4, 'overhead', { origin: org, face: base, width: 1.9, length: L2, persistent: true, periodic: true, interval: .8, duration: 3.6, b2ground: true, pool: 'lava', style: 'ember', fill: 'forward', beat: false, near: false, attack: KabirI18n.t('Kanlı İz') })); })(org, L2, j); }
        return { id: 'echoLanes', name: KabirI18n.t('Efendilerin Yankısı · Ocak'), duration: 3.0, pose: 'overhead', hits: hits, cooldown: 1.9 };
      }
      // The last verdict (phase 3): the court is cut in four; one wedge stays safe and turns each wave (fans show the safe wedge).
      function lastVerdict(e) {
        track('lastVerdict'); var c = core.arena, p = point(), a0 = Math.atan2(p.x - c.x, p.z - c.z), safe = ((Math.round(a0 / (Math.PI / 2)) % 4) + 4) % 4, steps = 4, hits = [];
        cd(e, 'lastVerdict', 19);
        for (var j = 0; j < steps; j++) { var t = 1.8 + j * 1.5, warn = j ? 1.25 : 1.8, s = (safe + (j % 2 ? 1 : 3) * j) % 4;
          for (var q = 0; q < 4; q++) { if (q === s) continue; hits.push(hit(t, warn, 'ring', 22, 17, 'roar', { origin: { x: c.x, z: c.z }, inner: 0, arc: Math.PI / 2, face: q * Math.PI / 2, style: 'blunt', fill: 'radial', unblockable: true, beat: j === 0 && hits.length === 0, attack: KabirI18n.t('Son Hüküm'), scar: false })); } }
        return { id: 'lastVerdict', name: KabirI18n.t('Son Hüküm'), duration: 1.8 + steps * 1.5 + .8, pose: 'roar', hits: hits, cooldown: 1.4 };
      }
      function call(e) {
        track('kadiCall'); cd(e, 'kadiCall', (e.phase >= 3 ? 17 : e.phase >= 2 ? 20 : 24) * (core.ext.game.difficulty === 'easy' ? 1.25 : 1)); e.spWait = 1; e.spStreak = 0;
        var p = point(), hits = [], found = 0, have = core ? core.freeReserve(e) : 0;
        for (var k = 0; k < (e.phase >= 2 ? 2 : 1) && k < have; k++) for (var tries = 0; tries < 8; tries++) { var a = e.face + (k ? 1 : -1) * (1.1 + tries * .22), o = { x: e.x + Math.sin(a) * (6.5 + tries * .4), z: e.z + Math.cos(a) * (6.5 + tries * .4) };
          if (core.inArena(o, 3) && api.walkable(o.x, o.z, .7) && Math.hypot(o.x - p.x, o.z - p.z) > 3.4) { (function (o) { hits.push(hit(1.4, 1.4, 'circle', 2.3, 14, 'roar', { origin: o, style: 'ember', beat: found === 0, attack: KabirI18n.t('Kadı’nın Çağrısı'), onActive: function () { core.summon(e, o.x, o.z); } })); }(o)); found++; break; } }
        if (!found) hits.push(hit(1.0, 1.0, 'ring', 3, 0, 'roar', { origin: { x: e.x, z: e.z }, inner: 0, arc: TAU, harmless: true }));
        return { id: 'kadiCall', name: KabirI18n.t('Kadı’nın Çağrısı'), duration: 2.6, pose: 'roar', hits: hits, cooldown: 1.2 };
      }
      return self = {
        attach: function (c) { core = c; if (c.chapter === 5) c.hooks.push({ tick: function () { self.tick(); } }); },
        tick: function () {
          var list = core.ext.enemies, hz = core.ext.hazards, on = false;
          for (var c = 0; c < list.length; c++) {
            var ce = list[c]; if (ce.dead || !ce.action || ce.action.moveId !== 'lastVerdict') continue;
            var best = 9, deadly = [false, false, false, false], j;
            for (j = 0; j < hz.length; j++) { var h = hz[j]; if (h.owner === ce && h.moveId === 'lastVerdict' && !h.active && h.age >= 0 && h.warn - h.age < best) best = h.warn - h.age; }
            if (best < 9) { for (j = 0; j < hz.length; j++) { var g = hz[j]; if (g.owner === ce && g.moveId === 'lastVerdict' && !g.active && g.age >= 0 && g.warn - g.age < best + .06) deadly[((Math.round(g.face / (Math.PI / 2)) % 4) + 4) % 4] = true; }
              var shown = 0, ar = core.arena; for (var q = 0; q < 4 && shown < 2; q++) if (!deadly[q]) { core.fanSet(shown, ar.x, ar.z, 21, q * Math.PI / 2 - Math.PI / 4 + .05, q * Math.PI / 2 + Math.PI / 4 - .05); shown++; }
              for (; shown < 2; shown++) core.fans[shown].visible = false; on = true; }
          }
          if (!on && core.fans[0] && core.fans[0].visible) core.fanHide();
          for (var i = 0; i < list.length; i++) { var e = list[i]; if (e.dead || !e.active || !e.boss || e.phase < 3) continue;
            if (core.time - (e.b2fx || 0) > .12 && B.Boss2.out && B.Boss2.out.emit) { e.b2fx = core.time; var a = Math.random() * TAU; B.Boss2.out.emit(e.x + Math.sin(a) * 1.0, .3 + Math.random() * 3, e.z + Math.cos(a) * 1.0, 4, [3.0, .35, .2], 0, .9, 0, .7, .1); } }
        },
        attack: function (e, d) {
          if (core && e.boss && !e.dead && core.freeReserve(e) > 0 && core.orbs.count() === 0 && core.groundCount() === 0 && !core.nova.on && (e.forceMove === 'kadiCall' || e.b2 && e.b2.t >= 12 && ready(e, 'kadiCall'))) { e.forceMove = null; return api.beginMove(e, call(e)); }
          if (e.forceMove === 'kadiCall' && core && core.freeReserve(e) === 0) e.forceMove = null;
          var list = [];
          if (e.type === 'damned') list = [
            { id: 'chainFlail', ok: d < 4, w: 4, move: function () { return sweep(e, 'chainFlail', KabirI18n.t('Pranga Savuruşu'), 3.6, 19); } },
            { id: 'damnedLunge', ok: d < 2.6, w: 2, move: function () { var m = cone('damnedLunge', KabirI18n.t('Hükümlünün Atılışı'), 3.0, 1.6, 16, .62, 'kick'); m.hits[0].knockback = 2.2; return m; } },
            { id: 'brandBurst', sp: 1, ok: d > 2 && d < 7, w: 2, move: function () { return { id: 'brandBurst', name: KabirI18n.t('Damganın Yanışı'), duration: 2.0, pose: 'roar', hits: [hit(1.2, 1.2, 'cone', 6.5, 23, 'roar', { arc: 1.2, style: 'ember', fill: 'forward', unblockable: true })] }; } }
          ];
          else if (e.type === 'verdictseer') list = [
            { id: 'verdictChains', ok: d > 3 && d < 14, w: 4, move: function () { return lanes(e, 3); } },
            { id: 'quill', ok: d < 3.7, w: 3, move: function () { return cone('quill', KabirI18n.t('Kâtibin Kalemi'), 3.3, 2.0, 16, .72, 'chainLash'); } },
            { id: 'inkRain', sp: 1, ok: d < 13, w: 2, move: function () { return ink(e, 3); } }
          ];
          else if (e.type === 'voidcrawler') list = [
            { id: 'voidBite', ok: d < 3.3, w: 4, move: function () { var m = cone('voidBite', KabirI18n.t('Boşluk Çenesi'), 3, 1.7, 19, .66, 'clawR'); m.hits.push(hit(1.22, .55, 'cone', 3.1, 13, 'clawL', { arc: 1.5, face: e.face + .25, style: 'blade', fill: 'sweep', sweepDir: -1 })); m.duration = 2; return m; } },
            { id: 'voidLeap', sp: 1, ok: d > 3 && d < 9, w: 3, move: function () { return leap(e); } },
            { id: 'voidTail', ok: d < 5, w: 2, move: function () { return { id: 'voidTail', name: KabirI18n.t('Boşluk Kuyruğu'), duration: 2.0, pose: 'sweep', hits: [hit(1.05, 1.05, 'ring', 4.6, 16, 'sweep', { inner: 1.9, arc: TAU, style: 'chain', fill: 'sweep' })] }; } }
          ];
          else if (e.type === 'chainjailer') list = [
            { id: 'jailFlail', ok: d < 5, w: 4, move: function () { return cone('jailFlail', KabirI18n.t('Gardiyanın Topuzu'), 4.8, 2.0, 26, 1.05, 'overhead'); } },
            { id: 'jailBash', ok: d < 3, w: 2, move: function () { var mv = cone('jailBash', KabirI18n.t('Demir Omuz'), 3.3, 2.1, 15, .82, 'bash'); mv.hits[0].style = 'blunt'; mv.hits[0].knockback = 1.8; return mv; } },
            { id: 'jailChains', sp: 1, ok: d > 3 && d < 11, w: 3, move: function () { return lanes(e, 2, KabirI18n.t('Zincir Seli'), 23); } },
            { id: 'inkRain', sp: 1, ok: d < 8, w: 2, move: function () { return ink(e, 4); } }
          ];
          else if (e.type === 'verdictwarden') list = [
            { id: 'wardenVerdict', ok: d < 5.5, w: 4, move: function () { return sweep(e, 'wardenVerdict', KabirI18n.t('Hüküm Kılıcı'), 5.2, 26); } },
            { id: 'verdictChains', sp: 1, ok: d > 4 && d < 14, w: 3, move: function () { return lanes(e, 5); } },
            { id: 'kadiSeal', sp: 1, ok: !!core && d > 2.5 && d < 13 && ready(e, 'kadiSeal'), w: 2.5, move: function () { cd(e, 'kadiSeal', 9); return seal(e); } },
            { id: 'echoRings', sp: 1, ok: d < 9, w: 2, move: function () { return verdictRing(e, 2); } }
          ];
          else if (e.type === 'lastjudge') list = [
            { id: 'judgeBlade', ok: d < 6.8, w: 4, move: function () { var m = sweep(e, 'judgeBlade', KabirI18n.t('Hüküm Kılıcı'), 6.4, 31); if (e.phase >= 2) { m.hits.push(hit(2.6, .9, 'circle', 2.6, 24, 'overhead', { origin: point(), style: 'quake', unblockable: true })); m.duration = 3.4; } return m; } },
            { id: 'kadiSeal', sp: 1, ok: !!core && d > 2 && d < 15 && ready(e, 'kadiSeal'), w: 2.5, move: function () { cd(e, 'kadiSeal', e.phase >= 3 ? 7 : 10); return seal(e); } },
            { id: 'scales', sp: 1, ok: !!core && d < 12 && ready(e, 'scales'), w: 2.5, move: function () { cd(e, 'scales', 11); return scales(e); } },
            { id: 'verdictChains', sp: 1, ok: d > 3 && d < 15, w: 2, move: function () { return lanes(e, e.phase >= 2 ? 5 : 3, KabirI18n.t('Zincir Hükmü'), 22); } },
            { id: 'inkRain', sp: 1, ok: d < 16, w: 2, move: function () { return ink(e, e.phase >= 3 ? 6 : 4, KabirI18n.t('Kara Defter’in Mürekkebi')); } },
            { id: 'lordsEcho', sp: 1, ok: !!core && e.phase >= 2 && d < 16 && core.groundCount() < 4 && ready(e, 'lordsEcho'), w: 3, move: function () { cd(e, 'lordsEcho', 6); return echo(e, d); } },
            { id: 'lastVerdict', sp: 1, ok: !!core && e.phase >= 3 && ready(e, 'lastVerdict'), w: 3, move: function () { return lastVerdict(e); } },
            { id: 'kadiCall', sp: 1, ok: false, w: 1, move: function () { return call(e); } },
            { id: 'judgeKick', ok: d < 2.6, w: 2, move: function () { return cone('judgeKick', KabirI18n.t('Kürsünün Tekmesi'), 3.3, 2.5, 19, .72, 'kick'); } }
          ];
          if (core && (e.boss || e.type === 'verdictwarden') && (core.orbs.count() > 0 || core.groundCount() > 1)) for (var li = 0; li < list.length; li++) if (list[li].sp && list[li].id !== 'kadiSeal') list[li].ok = false;
          if (e.summoned && core && core.ext.game.boss && core.ext.game.boss.action && core.ext.game.boss.action.moveId === 'lastVerdict') for (var lj = 0; lj < list.length; lj++) if (list[lj].sp) list[lj].ok = false;
          return api.pick(e, list);
        },
        phase: function (e) {
          if (!e.boss || e.dead) return; var f = e.hp / e.maxHp, next = f < .3 ? 3 : f < .65 ? 2 : 1; if (next <= e.phase) return;
          e.phase = next; e.enraged = next === 3; e.action = null; e.stagger = 0; e.faceLocked = false; api.cancelHazards(e, false);
          if (core) { var hz = core.ext.hazards; for (var i = hz.length - 1; i >= 0; i--) if (hz[i].b2ground && hz[i].owner === e && !hz[i].active) hz.splice(i, 1); }
          e.forceMove = 'kadiCall'; if (next === 3) { e.overheat = true; api.fx('boss2Overheat', { x: e.x, z: e.z }); }
          api.bonus(e.x, e.z, 2); api.emit('warning', { x: e.x, z: e.z, text: next === 2 ? KabirI18n.t('EFENDİLERİN YANKISI') : KabirI18n.t('SON HÜKÜM') });
          api.sound('bossPhase'); api.fx('bossPhase', { x: e.x, y: 1.8, z: e.z, phase: next }); api.emit('impact', { x: e.x, z: e.z, strength: 1, radius: 10 });
          api.beginMove(e, { id: 'roar', name: KabirI18n.t('Kadı’nın Hükmü'), duration: 2.3, pose: 'roar', hits: [hit(1.3, 1.3, 'ring', 5, 0, 'roar', { inner: 0, arc: TAU, harmless: true })] });
        }
      };
    }
  };
}());
