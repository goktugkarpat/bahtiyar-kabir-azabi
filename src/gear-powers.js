/* KABİR AZABI — gear: unique item powers (Diablo-style "Eşsiz Güç").
   A table keyed by catalog id; the runtime wraps the talent hooks (outgoing/onHit/onKill/onDodge/incoming/update)
   of combat.js in place, so the talent tree and the item powers stack without touching each other. Every power is
   small, readable (one burst, one sound) and fails soft. Text is shown on the item card (character-ui.js). */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const t = s => (window.KabirI18n ? KabirI18n.t(s) : s);
  // id -> [power name, description]
  const TEXT = {
    'executioner-axe': ['Cellat Yarığı', 'Her 4. vuruş bir kanama yarığı açar: vuruşun yarısı kadar kan 4 saniyede akar.'],
    'bell-spear': ['Derin Çan', 'Vuruşların %8 ihtimalle çan çalar: yakındaki düşmanlar sersemler ve hasar alır.'],
    'hollow-crown-blade': ['Tahtsız Taç', 'Her öldürme 4 saniyeliğine %8 hasar verir; 3 kez birikir.'],
    'furnace-oath-axe': ['Ocak Yemini', 'Her 5. vuruş yerden kor fışkırtır: çevredeki düşmanlar yanar.'],
    'last-verdict-blade': ['Son Hükmün Kırığı', 'Bosslara ve muhafızlara %18 fazla hasar.'],
    'warden-verdict-helm': ['Yargıç Bakışı', 'Sersemlemiş düşmanlar senden %15 fazla hasar alır.'],
    'ash-warden-grasp': ['Kül Pençesi', 'Her 3. vuruş düşmanı tutuşturur.'],
    'verdict-warden-helm': ['Kör Hüküm', 'Yakınında 3 ya da daha fazla düşman varken %10 daha az hasar alırsın.'],
    'verdict-warden-chest': ['Zincir Cübbe', 'Her 8 saniyede bir, gelen ilk darbenin yarısını zincirler tutar.'],
    'warden-chainmail': ['Son Nöbet', 'Canın %35’in altındayken %15 daha az hasar alırsın.'],
    'ash-warden-chest': ['Kül Örtüsü', 'Her öldürme 6 dayanıklılık geri verir.'],
    'barrow-king-crown': ['Altın Ruh', 'Ölen düşmanlardan altın bir ruh yükselir: canının %1,5’ini iyileştirir.'],
    'hearth-forged-gauntlets': ['Döküm Patlaması', 'Kaçındıktan sonraki ilk vuruşun çevrede patlar.'],
    'bone-rite-chest': ['Kemik Şarapneli', 'Öldürdüğün düşmandan kemik parçaları saçılır ve yakındaki üç düşmanı yaralar.'],
    'sunken-vow-chest': ['Gelgit İzi', 'Yuvarlandığın yerde buzlu bir iz kalır: üstündeki düşmanlar donar ve hasar alır.'],
    'cave-verdict-sword': ['Kör Mağaranın Hükmü', 'Sersemlemiş düşmanlara %25 fazla hasar.'],
    'black-tide-sword': ['Kara Dalga', 'Her 6. vuruş önüne kara bir dalga salar.'],
    'slag-edge-sword': ['Cüruf Ağzı', 'Canı tam olan düşmanlara ilk vuruşun %30 fazla hasar verir.']
  };
  function describe(def) {
    const p = def && TEXT[def.id]; if (!p) return '';
    return '<div class="cd-unique-power"><span class="cd-up-label">' + t('Eşsiz Güç') + '</span><strong>' + t(p[0]) + '</strong><p>' + t(p[1]) + '</p></div>';
  }
  function attach(talents, ctx) {
    if (!talents || talents.__gearPowers) return; talents.__gearPowers = true;
    const { player, enemies, progression, hurtEnemy, stunEnemy, talentTick } = ctx;
    const look = B.TalentFX && ctx.root ? B.TalentFX.create(ctx.root, ctx.groundY || (() => .06)) : null;
    const sound = (name, o) => { try { ctx.sound(name, Object.assign({ x: player.x, z: player.z }, o || {})); } catch (e) { /* soft */ } };
    const alive = e => e && !e.dead && e.model && e.model.root.visible;
    const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
    const strike = (e, amount, face) => { if (!alive(e)) return null; return hurtEnemy(e, Math.round(amount), true, face, { talent: true, combo: 0, face, heavy: true, gained: 99 }); };
    const heal = f => { if (!player.dead) player.hp = Math.min(player.maxHp, player.hp + f * player.maxHp); };
    let worn = new Set(), wornRev = -1, hits = 0, clock = 0, crown = [], primed = false, chainReady = 0, soulAt = 0;
    const dots = new Map(), trails = [], NONE = new Map(), procs = {}, P = id => { procs[id] = (procs[id] || 0) + 1; };
    function has(id) {
      if (B.GearPowers && B.GearPowers.off && B.GearPowers.off.has(id)) return false;   // balance bench A/B switch (combat-balance.js powersOff)
      const rev = progression.revision !== undefined ? progression.revision : -2;
      if (rev !== wornRev || rev === -2) { wornRev = rev; worn = new Set(); for (const s of ['weapon', 'head', 'chest', 'hands', 'boots']) { const it = progression.itemForSlot && progression.itemForSlot(s); if (it) worn.add(it.id); } }
      return worn.has(id);
    }
    function burstHit(x, z, r, amount, kind, extra) {
      if (look) look.burst(x, z, r, kind);
      for (const e of enemies) { if (!alive(e) || dist(e, x, z) > r + (e.radius || .5) * .5) continue; const res = strike(e, amount, Math.atan2(e.x - x, e.z - z)); if (extra && res && !res.killed) extra(e); }
    }
    function dot(e, total, seconds, kind) { const d = dots.get(e); dots.set(e, { dps: total / seconds + (d && d.time > 0 ? d.dps * .5 : 0), time: seconds, kind, tick: .5 }); }
    const base = { outgoing: talents.outgoing, onHit: talents.onHit, onKill: talents.onKill, onDodge: talents.onDodge, incoming: talents.incoming, update: talents.update, reset: talents.reset };
    talents.outgoing = function (e, damage, attack) {
      let d = base.outgoing(e, damage, attack);
      try {
        let k = 1; const max = e.maxHp || e.hp || 1;
        if (crown.length && has('hollow-crown-blade')) k *= 1 + .08 * crown.length;
        if (has('last-verdict-blade') && (e.boss || e.elite || e.warden)) k *= 1.18;
        if (e.stagger > 0 && has('warden-verdict-helm')) k *= 1.15;
        if (e.stagger > 0 && has('cave-verdict-sword')) k *= 1.25;
        if (has('slag-edge-sword') && e.hp >= max && attack && !attack.talent) k *= 1.3;
        d = Math.round(d * k);
      } catch (err) { /* soft */ }
      return d;
    };
    talents.onHit = function (e, damage, attack, killed) {
      base.onHit(e, damage, attack, killed);
      if (!attack || attack.talent) return;
      try {
        hits++;
        const face = Math.atan2(e.x - player.x, e.z - player.z);
        if (has('executioner-axe') && hits % 4 === 0 && !killed) { P('executioner-axe'); dot(e, damage * .5, 4, 'bleed'); if (look) look.burst(e.x, e.z, 1.4, 'blood'); sound('talentBlood', { x: e.x, z: e.z, volume: .7 }); }
        if (has('bell-spear') && Math.random() < .08) { P('bell-spear'); sound('talentKnell', { x: e.x, z: e.z, volume: .6 }); burstHit(e.x, e.z, 2.6, 16, 'chain', o => stunEnemy(o, .4, 'heavy')); }   // combat bench: 15 % / .6 s stun cut fights by 56 % (A/B), now 8 % / .4 s
        if (has('furnace-oath-axe') && hits % 5 === 0) { P('furnace-oath-axe'); sound('talentBurst', { x: e.x, z: e.z }); ctx.emit && ctx.emit('impact', { x: e.x, z: e.z, strength: .6, radius: 2.6 }); burstHit(e.x, e.z, 2.6, 24, 'fire', o => dot(o, 18, 3, 'burn')); }
        if (has('ash-warden-grasp') && hits % 3 === 0 && !killed) { P('ash-warden-grasp'); dot(e, Math.max(10, damage * .35), 3, 'burn'); if (look) look.mark(e, 'burn'); sound('talentIgnite', { x: e.x, z: e.z, volume: .5 }); }
        if (primed && has('hearth-forged-gauntlets')) { P('hearth-forged-gauntlets'); primed = false; sound('talentBurst', { x: e.x, z: e.z }); burstHit(e.x, e.z, 2.4, 28, 'fire'); }
        if (has('black-tide-sword') && hits % 6 === 0) { P('black-tide-sword');
          const x = player.x + Math.sin(player.face) * 2, z = player.z + Math.cos(player.face) * 2;
          sound('talentChain', { x, z, volume: .7 }); burstHit(x, z, 2.6, 26, 'chain');
        }
        void face;
      } catch (err) { /* soft */ }
    };
    talents.onKill = function (e) {
      base.onKill(e);
      try {
        const x = e.x, z = e.z;
        if (has('hollow-crown-blade')) { P('hollow-crown-blade'); crown.push(clock + 4); if (crown.length > 3) crown.shift(); if (look) look.souls(e, player); }
        if (has('barrow-king-crown') && clock - soulAt > .4) { P('barrow-king-crown'); soulAt = clock; heal(.015); if (look) { look.souls(e, player); look.burst(x, z, 1.2, 'gold'); } sound('talentExecute', { x, z, volume: .35 }); }
        if (has('ash-warden-chest')) player.stamina = Math.min(player.maxStamina, player.stamina + 6);
        if (has('bone-rite-chest')) { P('bone-rite-chest');
          const near = enemies.filter(o => o !== e && alive(o) && dist(o, x, z) < 4.5).sort((a, b) => dist(a, x, z) - dist(b, x, z)).slice(0, 3);
          if (look) look.burst(x, z, 2, 'bone'); sound('talentRot', { x, z, volume: .5 });
          for (const o of near) strike(o, 22, Math.atan2(o.x - x, o.z - z));
        }
        dots.delete(e);
      } catch (err) { /* soft */ }
    };
    talents.onDodge = function () {
      base.onDodge();
      try {
        if (has('hearth-forged-gauntlets')) primed = true;
        if (has('sunken-vow-chest')) { P('sunken-vow-chest'); const sx = player.x, sz = player.z; trails.push({ sx, sz, at: clock + .32, life: 3, hit: new Set(), tick: 0 }); }
      } catch (err) { /* soft */ }
    };
    talents.incoming = function (damage) {
      let d = base.incoming(damage);
      try {
        if (has('verdict-warden-helm') && enemies.filter(e => alive(e) && dist(e, player.x, player.z) < 5).length >= 3) d *= .9;
        if (has('warden-chainmail') && player.hp < (player.maxHp || 100) * .35) d *= .85;
        if (has('verdict-warden-chest') && chainReady <= 0 && d > 0) { P('verdict-warden-chest'); d *= .5; chainReady = 8; if (look) look.burst(player.x, player.z, 1.6, 'chain'); sound('talentChain', { volume: .6 }); }
      } catch (err) { /* soft */ }
      return d;
    };
    talents.update = function (dt) {
      base.update(dt);
      try {
        clock += dt; chainReady = Math.max(0, chainReady - dt);
        crown = crown.filter(at => at > clock);
        for (const [e, d] of dots) {
          if (!alive(e)) { dots.delete(e); continue; }
          d.time -= dt; d.tick -= dt;
          if (d.tick <= 0) { d.tick += .5; talentTick(e, d.dps * .5, d.kind); }
          if (d.time <= 0) dots.delete(e);
        }
        for (let i = trails.length - 1; i >= 0; i--) {
          const tr = trails[i]; if (clock < tr.at) continue;
          if (tr.x2 === undefined) { tr.x2 = player.x; tr.z2 = player.z; if (look) { tr.view = { kind: 'trail', x: tr.sx, z: tr.sz, x2: tr.x2, z2: tr.z2, w: 1.6, time: tr.life, life: tr.life, tick: 0, owner: 'gear-frost' }; look.zone(tr.view); } sound('talentChain', { volume: .4 }); }
          tr.life -= dt; tr.tick -= dt;
          if (tr.tick <= 0) {
            tr.tick += .5;
            const dx = tr.x2 - tr.sx, dz = tr.z2 - tr.sz, L2 = dx * dx + dz * dz || 1;
            for (const e of enemies) {
              if (!alive(e)) continue;
              const u = Math.max(0, Math.min(1, ((e.x - tr.sx) * dx + (e.z - tr.sz) * dz) / L2));
              if (Math.hypot(e.x - (tr.sx + dx * u), e.z - (tr.sz + dz * u)) > .8 + (e.radius || .5) * .5) continue;
              talentTick(e, 6, 'burn');
              if (!tr.hit.has(e)) { tr.hit.add(e); stunEnemy(e, .5, 'heavy'); }
            }
          }
          if (tr.view) tr.view.life = tr.life;
          if (tr.life <= 0) { if (look && tr.view) look.unzone(tr.view); trails.splice(i, 1); }
        }
        if (look) look.update(dt, NONE, null, null);
      } catch (err) { /* soft */ }
    };
    talents.gearPowerStats = () => Object.assign({}, procs);
    // Equip feedback: a short metal/leather sound for every piece put on.
    if (typeof progression.equip === 'function' && !progression.__gearEquip) {
      const equip = progression.equip; progression.__gearEquip = true;
      progression.equip = function (uid) {
        const r = equip.apply(this, arguments);
        try { if (r && r.ok) { const e = progression.inventory.find(i => i.uid === uid), def = e && B.Progression.catalog[e.id]; if (def) ctx.sound('gearEquip', { slot: def.slot, rarity: def.rarity }); } } catch (err) { /* soft */ }
        return r;
      };
    }
    talents.reset = function () { base.reset(); dots.clear(); trails.length = 0; crown = []; primed = false; hits = 0; if (look) look.reset(); };
  }
  B.GearPowers = { attach, describe, text: TEXT };
})();
