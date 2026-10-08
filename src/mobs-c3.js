/* KABİR AZABI — BÖLÜM III (Sessiz Taht) İKİ YENİ DÜŞMAN: Taht Yasçısı (mourner) ve Mezar Kapancısı (snarer).
   Bu dosya: istatistik + yerleşim + saldırı tabloları + yetenekler + çeviriler. Modeller: mobs-c3-models.js.
   Hiçbir mevcut dosyanın içini değiştirmez; RuinsCombat.create / MobAbilities.create sarılır (combat.js bunları zaten çağırıyor).
   Yeni GPU yüzeyi yok: yalnız mevcut uyarı alanları + havuzlanmış glowBurst/spark efektleri.

   Taht Yasçısı (destek): "Koruyucu Ağıt" — 1.5 sn'lik ağıtla yakındaki dostlarına 6 sn "ağıt koruması" (hasar x0.45) verir ve %9 can onarır;
        yasçı sersemletilirse/ölürse koruma çözülür. "Çınlayan Yas" — kendi çevresinde genişleyen halka (ortası güvenli, yuvarlan ya da yaklaş).
   Mezar Kapancısı (tuzak kurucu): "Kapan Ekimi" — kahramanın çevresine 3 diş-kapan (altın daire, sırayla patlar, ardından 4 sn kemik tozu bırakır);
        "Geri Sıçrayış" — arkaya sıçrar, durduğu yeri patlayan kapana çevirir. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, TAU = Math.PI * 2;
  var tr = function (s) { return KabirI18n.t(s); };
  var hyp = function (x, z) { return Math.sqrt(x * x + z * z); };

  /* ------------------------------------------------------------------ KOLAY AYAR (denge ajanı için tek yer) */
  var TUNE = {
    mourner: { hp: 160, speed: 1.95, radius: .46, reach: 12, cooldown: 2.3 },
    snarer:  { hp: 168, speed: 3.0, radius: .5, reach: 10, cooldown: 1.85 },
    dmg: { touch: 13, dirgeRing: 14, hook: 15, trap: 14, trapPool: 4, snapTrap: 17 },
    ward: { mult: .45, seconds: 6, heal: .09, radius: 8, channel: 1.5 },
    dirge: { radius: 5.6, inner: 1.7, warn: 1.1 },
    trap: { count: 3, spread: 3.0, radius: 1.45, warn: 1.2, poolSeconds: 4 },
    // her odada kaç tane (oda indeksi -> [yasçı, kapancı]); toplam yasçı 7, kapancı 7
    rooms: { 1: [0, 1], 2: [1, 0], 3: [0, 1], 4: [1, 1], 5: [0, 1], 6: [1, 0], 7: [0, 1], 8: [1, 0], 9: [1, 1], 10: [1, 0], 12: [1, 1] }
  };

  /* ------------------------------------------------------------------ çeviriler */
  if (window.KabirI18n && KabirI18n.dictionary) Object.assign(KabirI18n.dictionary, {
    'Taht Yasçısı': 'Throne Mourner', 'Mezar Kapancısı': 'Grave Snarer',
    'Koruyucu Ağıt': 'Warding Dirge', 'Çınlayan Yas': 'Tolling Grief', 'Kemik Dokunuşu': 'Bone Touch',
    'Kapan Ekimi': 'Trap Sowing', 'Geri Sıçrayış': 'Spring Back', 'Kanca Yırtışı': 'Hook Rip', 'Diş Kapanı': 'Tooth Trap', 'Kemik Tozu': 'Bone Dust',
    'Ağıt Koruması': 'Dirge Ward', 'Patlayan Kapan': 'Springing Trap'
  });

  var X = null;   // MobAbilities.create(bfApi) ile gelen tam api (enemies, addHazard, fx, sound...)

  /* ------------------------------------------------------------------ istatistik */
  var rc = B.RuinsCombat;
  if (rc && rc.stats) {
    rc.stats.mourner = { name: tr('Taht Yasçısı'), hp: TUNE.mourner.hp, speed: TUNE.mourner.speed, radius: TUNE.mourner.radius, reach: TUNE.mourner.reach, cooldown: TUNE.mourner.cooldown, color: 0x9fc9bd, ruins: true, ranged: true };
    rc.stats.snarer = { name: tr('Mezar Kapancısı'), hp: TUNE.snarer.hp, speed: TUNE.snarer.speed, radius: TUNE.snarer.radius, reach: TUNE.snarer.reach, cooldown: TUNE.snarer.cooldown, color: 0xb59a74, ruins: true };
  }
  B.MobsC3 = { TUNE: TUNE, types: ['mourner', 'snarer'] };

  /* ------------------------------------------------------------------ yerleşim: ruins-world.js tek satırla çağırır */
  B.MobsC3.addSpawns = function (spawns, room, r) {
    var cfg = TUNE.rooms[room]; if (!cfg) return;
    var list = [];
    for (var k = 0; k < cfg[0]; k++) list.push('mourner');
    for (k = 0; k < cfg[1]; k++) list.push('snarer');
    // yasçı arka sırada (kuzeye doğru), kapancı yan kenarlarda
    var slots = { mourner: [[-4.6, -7.2], [5.2, -6.4]], snarer: [[6.1, 1.2], [-6.1, -.8]] }, used = { mourner: 0, snarer: 0 };
    list.forEach(function (type) {
      var s = slots[type][used[type]++ % 2], dx = s[0] * (room % 2 ? -1 : 1);
      spawns.push({ type: type, x: r.x + dx, z: r.z + s[1] });
    });
  };

  // Yerleşim çarpışmaya (sütun, kaya) denk gelirse en yakın yürünebilir noktaya kaydır (dünya kurulduktan sonra çağrılır).
  B.MobsC3.fixSpawns = function (encounters, walkable) {
    encounters.forEach(function (enc) {
      (enc.spawns || []).forEach(function (s) {
        if (s.type !== 'mourner' && s.type !== 'snarer') return;
        var r = s.type === 'mourner' ? TUNE.mourner.radius : TUNE.snarer.radius;
        if (walkable(s.x, s.z, r + .35)) return;
        for (var ring = 1; ring <= 10; ring++) for (var k = 0; k < 12; k++) {
          var a = k / 12 * TAU, x = s.x + Math.sin(a) * ring * .6, z = s.z + Math.cos(a) * ring * .6;
          if (walkable(x, z, r + .35)) { s.x = x; s.z = z; return; }
        }
      });
    });
  };

  /* ------------------------------------------------------------------ saldırılar */
  function hit(at, warn, shape, radius, damage, pose, extra) { return Object.assign({ at: at, warn: warn, shape: shape, radius: radius, dmg: damage, pose: pose, style: 'blade', fill: 'radial' }, extra || {}); }
  function cone(id, name, radius, arc, damage, at, pose) { return { id: id, name: name, duration: at + .75, pose: pose, hits: [hit(at, at, 'cone', radius, damage, pose, { arc: arc, fill: 'sweep', sweepDir: 1 })] }; }
  function allies(e, radius) {
    var out = [], list = X ? X.enemies : [];
    for (var i = 0; i < list.length; i++) { var o = list[i]; if (o === e || o.dead || !o.active || o.boss || o.reserve) continue; if (hyp(o.x - e.x, o.z - e.z) <= radius) out.push(o); }
    return out;
  }
  function build(api) {
    function point() { return { x: api.player.x, z: api.player.z }; }

    // Taht Yasçısı: Koruyucu Ağıt — sersemleyen yasçı bu hamleyi kesmiş olur (stagger kontrolü).
    function dirgeWard(e) {
      var R = TUNE.ward.radius;
      return { id: 'dirgeWard', name: tr('Koruyucu Ağıt'), duration: TUNE.ward.channel + .95, pose: 'kneel', cooldown: .9,
        hits: [hit(TUNE.ward.channel, TUNE.ward.channel, 'circle', R, 0, 'kneel', { origin: { x: e.x, z: e.z }, harmless: true, style: 'rune', fill: 'radial', tellGain: .4,
          onActive: function () {
            if (e.dead || !e.action || e.action.moveId !== 'dirgeWard' || e.stagger > 0) return;
            var list = allies(e, R), i;
            for (i = 0; i < list.length; i++) {
              var o = list[i]; o.c3ward = TUNE.ward.seconds; o.c3wardBy = e; o.c3pulse = 0;
              o.hp = Math.min(o.maxHp, o.hp + o.maxHp * TUNE.ward.heal);
              api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: (o.radius || .6) * 2.6, color: 0x7fd9c8, duration: .9 });
            }
            api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 2.4, color: 0x9fe0d0, duration: .8 });
            api.sound('enemyWindup', { type: e.type, x: e.x, z: e.z, style: 'rune' });
          } })] };
    }
    // Çınlayan Yas: kendi etrafında genişleyen halka; ortası (iç yarıçap) güvenli.
    function tolling(e) {
      var o = { x: e.x, z: e.z }, d = TUNE.dirge;
      return { id: 'tolling', name: tr('Çınlayan Yas'), duration: d.warn + 1.25, pose: 'roar', cooldown: 1.1,
        hits: [hit(d.warn, d.warn, 'ring', d.radius, TUNE.dmg.dirgeRing, 'roar', { origin: o, inner: d.inner, arc: TAU, style: 'shadow', fill: 'radial', knockback: 1.6, tellGain: 1 })] };
    }
    // Mezar Kapancısı: Kapan Ekimi — kahramanın çevresine sırayla patlayan diş-kapanlar, ardından kemik tozu.
    function trapSow(e) {
      var p = point(), hits = [], n = 0, base = e.face + Math.PI * .5 * (e.index % 2 ? 1 : -1), t = TUNE.trap;
      for (var i = 0; i < t.count; i++) {
        var a = base + i * TAU / t.count, r = i ? t.spread : .6, o = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
        if (!api.walkable(o.x, o.z, .5)) { if (i) continue; o = { x: p.x, z: p.z }; }
        (function (o, first) {
          hits.push(hit(t.warn + n * .38, t.warn, 'circle', t.radius, TUNE.dmg.trap, 'throw', { origin: o, style: 'fall', fill: 'inward', beat: first, attack: tr('Diş Kapanı'),
            projectile: { kind: 'vial', fromY: 1.5, flight: .5, height: 2.2 },
            onActive: function () {
              if (!X) return;
              X.addHazard({ owner: e, enemy: e.name, x: o.x, z: o.z, radius: t.radius * .95, warn: .35, duration: t.poolSeconds, damage: TUNE.dmg.trapPool, periodic: true, interval: .9, persistent: true,
                unblockable: true, pool: 'dark', poolGain: .7, style: 'shadow', fill: 'radial', near: false, attack: tr('Kemik Tozu') });
              api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: t.radius * 1.4, color: 0xc9bca2, duration: .5 });
            } }));
        })(o, n === 0); n++;
      }
      return { id: 'trapSow', name: tr('Kapan Ekimi'), duration: t.warn + n * .38 + .95, pose: 'throw', hits: hits, cooldown: 1.6 };
    }
    // Geri Sıçrayış: arkaya sıçrar; durduğu yer patlayan kapana döner (yakından kovalayanı yakalar).
    function snapBack(e) {
      var p = point(), from = { x: e.x, z: e.z }, away = Math.atan2(e.x - p.x, e.z - p.z), dest = null;
      for (var k = 0; k < 6 && !dest; k++) {
        var a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .45, r = 5.2 - (k > 3 ? 1.6 : 0), c = { x: e.x + Math.sin(a) * r, z: e.z + Math.cos(a) * r };
        if (api.walkable(c.x, c.z, e.radius) && api.walkable((c.x + e.x) / 2, (c.z + e.z) / 2, .3)) dest = c;
      }
      if (!dest) return null;
      return { id: 'snapBack', name: tr('Geri Sıçrayış'), duration: 2.05, pose: 'crouch', cooldown: 1.2, faceAt: { t: 1.15, face: Math.atan2(p.x - dest.x, p.z - dest.z) },
        movement: { start: .5, duration: .3, fromX: e.x, fromZ: e.z, x: dest.x, z: dest.z, leap: true },
        hits: [hit(1.1, .85, 'circle', 2.1, TUNE.dmg.snapTrap, 'crouch', { origin: from, style: 'fall', fill: 'inward', attack: tr('Patlayan Kapan'),
          onActive: function () { api.fx('glowBurst', { x: from.x, y: .05, z: from.z, radius: 2.6, color: 0xc9bca2, duration: .5 }); } })] };
    }

    return {
      attack: function (e, d) {
        var list;
        if (e.type === 'mourner') {
          var need = allies(e, TUNE.ward.radius).filter(function (o) { return !(o.c3ward > 1.2); }).length;
          list = [
            { id: 'touch', ok: d < 3.4, w: 4, move: function () { return cone('touch', tr('Kemik Dokunuşu'), 3.1, 1.7, TUNE.dmg.touch, .72, 'clawR'); } },
            { id: 'dirgeWard', ok: need > 0 && d < 16, w: 7, move: function () { return dirgeWard(e); } },
            { id: 'tolling', ok: d < 9, w: 3,   /* düz hamle: sp olursa yalnız kalan yasçı (dost yok, 3.4-8.8 m) hiç hamle bulamayıp sonsuza dek duruyordu */ move: function () { return tolling(e); } }
          ];
        } else {
          list = [
            { id: 'hookRip', ok: d < 3.7, w: 4, move: function () { var m = cone('hookRip', tr('Kanca Yırtışı'), 3.4, 1.9, TUNE.dmg.hook, .66, 'clawR'); m.hits.push(hit(1.35, .6, 'cone', 3.2, 11, 'sweepBack', { arc: 1.6, face: e.face - .4, fill: 'sweep', sweepDir: -1 })); m.duration = 1.95; return m; } },
            { id: 'trapSow', ok: d > 2.6 && d < 11, w: 4, move: function () { return trapSow(e); } },
            { id: 'snapBack', sp: 1, ok: d < 4.4 && !!snapBack(e),   /* hedef nokta yoksa snapBack null döner; pick() Object.assign(null) ile patlıyordu */ w: 3, move: function () { return snapBack(e); } }
          ];
        }
        return api.pick(e, list);
      }
    };
  }

  /* ------------------------------------------------------------------ RuinsCombat.create sarmalayıcı */
  if (rc && rc.create) {
    var create = rc.create;
    rc.create = function (api) {
      var inst = create.apply(this, arguments), base = inst.attack, mine = build(api);
      inst.attack = function (e, d) { return e.type === 'mourner' || e.type === 'snarer' ? mine.attack(e, d) : base.apply(inst, arguments); };
      return inst;
    };
  }

  /* ------------------------------------------------------------------ MobAbilities sarmalayıcı: tam api + ağıt koruması (hasar azaltma) */
  var ma = B.MobAbilities;
  if (ma && ma.create) {
    var mcreate = ma.create;
    ma.create = function (api) {
      X = api;
      var inst = mcreate.apply(this, arguments), update = inst.update, hurt = inst.hurt, reset = inst.reset;
      inst.update = function (dt) {
        update.apply(inst, arguments);
        if (api.game.state !== 'playing') return;
        var list = api.enemies;
        for (var i = 0; i < list.length; i++) {
          var o = list[i];
          if (!(o.c3ward > 0)) continue;
          if (o.dead || !o.active || !o.c3wardBy || o.c3wardBy.dead || o.c3wardBy.stagger > .35) { o.c3ward = 0; continue; }
          o.c3ward -= dt; o.c3pulse = (o.c3pulse || 0) - dt;
          if (o.c3pulse <= 0 && o.c3ward > 0) { o.c3pulse = .75; api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: (o.radius || .6) * 2.3, color: 0x6fcfc0, duration: .7 }); }
        }
      };
      inst.hurt = function (e, damage, face) {
        damage = hurt.apply(inst, arguments);
        if (e.c3ward > 0) {
          api.fx('spark', { x: e.x, y: 1.3, z: e.z, face: face, glance: true });
          damage = Math.max(1, Math.round(damage * TUNE.ward.mult));
        }
        return damage;
      };
      inst.reset = function () { reset.apply(inst, arguments); var list = api.enemies; for (var i = 0; i < list.length; i++) { list[i].c3ward = 0; list[i].c3wardBy = null; } };
      return inst;
    };
  }
}());
