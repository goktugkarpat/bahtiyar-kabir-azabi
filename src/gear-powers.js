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
  // ajan:bossloot — powers of the boss-only items (src/boss-loot.js). id -> [name TR, text TR, name EN, text EN]
  const BOSS_TEXT = {
    'rusted-mail-chest': ['Pas Kabuğu', 'Canın %50’nin altındayken %12 daha az hasar alırsın.', 'Rust Crust', 'Below 50% health you take 12% less damage.'],
    'headsman-hood': ['Kara Hüküm', 'Kritik vuruşlar hedefi kanatır: vuruşun %40’ı kadar kan 3 saniyede akar.', 'Black Verdict', 'Critical hits open a wound: 40% of the blow bleeds out over 3 seconds.'],
    'hook-chain-gauntlets': ['Kanca Zinciri', 'Her 6. vuruş düşmanı kancayla yakalar ve yarım saniye sersemletir.', 'Hooked Chain', 'Every 6th blow hooks the foe and stuns it for half a second.'],
    'drowned-clapper-axe': ['Batık Ağırlık', 'Ağır vuruşlar %25 fazla hasar verir.', 'Sunken Weight', 'Heavy blows deal 25% more damage.'],
    'bellringer-bronze-chest': ['Tuzlu Deri', 'Yuvarlandıktan sonra 3 saniye boyunca %15 daha az hasar alırsın.', 'Brine Hide', 'For 3 seconds after a roll you take 15% less damage.'],
    'drowned-ringer-helm': ['Derin Soluk', 'Canın %40’ın altındayken her öldürme canının %4’ünü iyileştirir.', 'Deep Breath', 'Below 40% health every kill heals 4% of your health.'],
    'tide-chain-boots': ['Kıyı Adımı', 'Her yuvarlanma 10 dayanıklılık geri verir.', 'Shoreline Stride', 'Every roll restores 10 stamina.'],
    'hollow-scepter-spear': ['Asa Darbesi', 'Bitirici (3.) vuruşlar %25 fazla hasar verir.', 'Scepter Strike', 'Finishing (3rd) blows deal 25% more damage.'],
    'king-ossuary-chest': ['Taht Ağırlığı', 'Canın %70’in üstündeyken verdiğin hasar %8 artar.', 'Weight of the Throne', 'While above 70% health you deal 8% more damage.'],
    'hollow-king-spurs': ['Mahmuz Hamlesi', 'Yuvarlandıktan sonraki ilk vuruş %30 fazla hasar verir.', 'Spur Lunge', 'The first blow after a roll deals 30% more damage.'],
    'warden-iron-claws': ['Muhafız Avcısı', 'Seçkin düşmanlara, muhafızlara ve bosslara %10 fazla hasar.', 'Warden Hunter', 'Deal 10% more damage to elite foes, wardens and bosses.'],
    'heart-forged-sword': ['Kor Kanı', 'Canın %50’nin altındayken verdiğin hasar %15 artar.', 'Ember Blood', 'Below 50% health you deal 15% more damage.'],
    'anvil-heart-chest': ['Öfke Dökümü', 'Hasar aldıktan sonra 3 saniye boyunca vuruşların %15 daha sert olur.', 'Cast Fury', 'For 3 seconds after taking damage your blows hit 15% harder.'],
    'furnace-heart-helm': ['İnfaz Bakışı', 'Canı %30’un altındaki düşmanlara %12 fazla hasar.', 'Executioner’s Stare', 'Deal 12% more damage to foes below 30% health.'],
    'cinder-breath-boots': ['Köz Soluğu', 'Her 7. vuruş canının %1,5’ini iyileştirir.', 'Cinder Breath', 'Every 7th blow heals 1.5% of your health.'],
    'ash-warden-greaves': ['Kül Hırsı', 'Her öldürme 3 saniyeliğine %10 hasar verir.', 'Ash Greed', 'Every kill grants 10% more damage for 3 seconds.'],
    'black-gavel-axe': ['Hüküm Emici', 'Kritik vuruşlar canının %2’sini iyileştirir.', 'Verdict Drinker', 'Critical hits heal 2% of your health.'],
    'qadi-black-robe': ['Hükmün Ertelenişi', '90 saniyede bir ölümcül darbe seni canının %15’iyle ayakta bırakır.', 'Stay of Sentence', 'Once every 90 seconds a killing blow leaves you standing with 15% health.'],
    'qadi-iron-turban': ['Hüküm Gözü', 'Kritik vuruşlar 6 dayanıklılık geri verir.', 'Eye of Judgement', 'Critical hits restore 6 stamina.'],
    'verdict-warden-boots': ['Zincir Çekişi', 'Yuvarlandıktan sonraki ilk vuruş düşmanı yarım saniye sersemletir.', 'Chain Pull', 'The first blow after a roll stuns the foe for half a second.']
  };
  { const D = window.KabirI18n && KabirI18n.dictionary;
    for (const id of Object.keys(BOSS_TEXT)) { const p = BOSS_TEXT[id]; if (D) { if (!D[p[0]]) D[p[0]] = p[2]; if (!D[p[1]]) D[p[1]] = p[3]; } TEXT[id] = [p[0], p[1]]; } }
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
    let dodgeAt = -99, furyUntil = 0, rushUntil = 0, spurFor = null, spurUntil = 0, pullFor = null, pullUntil = 0, stayReady = 0;   // ajan:bossloot
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
    function dot(e, total, seconds, kind, resolved = false) {
      if (!Number.isFinite(total) || !(total > 0) || !(seconds > 0)) return;
      const bag = dots.get(e) || { raw: null, resolved: null, dps: 0, time: 0, kind, tick: .5 }, key = resolved ? 'resolved' : 'raw', old = bag[key];
      bag[key] = { dps: total / seconds + (old && old.time > 0 ? old.dps * .5 : 0), time: seconds, kind };
      bag.dps = (bag.raw ? bag.raw.dps : 0) + (bag.resolved ? bag.resolved.dps : 0);
      bag.time = Math.max(bag.raw ? bag.raw.time : 0, bag.resolved ? bag.resolved.time : 0); bag.kind = kind;
      dots.set(e, bag);
    }
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
        // ajan:bossloot — boss-only item powers
        const own = attack && !attack.talent;
        if (own && attack.heavy && has('drowned-clapper-axe')) k *= 1.25;
        if (own && !attack.heavy && attack.combo === 2 && has('hollow-scepter-spear')) k *= 1.25;
        if (player.hp > 70 && has('king-ossuary-chest')) k *= 1.08;
        if (player.hp < 50 && has('heart-forged-sword')) k *= 1.15;
        if (clock < furyUntil && has('anvil-heart-chest')) k *= 1.15;
        if (clock < rushUntil && has('ash-warden-greaves')) k *= 1.1;
        if ((e.boss || e.elite || e.warden) && has('warden-iron-claws')) k *= 1.1;
        if (e.hp < max * .3 && has('furnace-heart-helm')) k *= 1.12;
        if (own && has('hollow-king-spurs')) { if (spurFor !== attack && clock < spurUntil) { spurFor = attack; spurUntil = 0; } if (spurFor === attack) { P('hollow-king-spurs'); k *= 1.3; } }
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
        if (has('executioner-axe') && hits % 4 === 0 && !killed) { P('executioner-axe'); dot(e, damage * .5, 4, 'bleed', true); if (look) look.burst(e.x, e.z, 1.4, 'blood'); sound('talentBlood', { x: e.x, z: e.z, volume: .7 }); }
        if (has('bell-spear') && Math.random() < .08) { P('bell-spear'); sound('talentKnell', { x: e.x, z: e.z, volume: .6 }); burstHit(e.x, e.z, 2.6, 16, 'chain', o => stunEnemy(o, .4, 'heavy')); }   // combat bench: 15 % / .6 s stun cut fights by 56 % (A/B), now 8 % / .4 s
        if (has('furnace-oath-axe') && hits % 5 === 0) { P('furnace-oath-axe'); sound('talentBurst', { x: e.x, z: e.z }); ctx.emit && ctx.emit('impact', { x: e.x, z: e.z, strength: .6, radius: 2.6 }); burstHit(e.x, e.z, 2.6, 24, 'fire', o => dot(o, 18, 3, 'burn')); }
        if (has('ash-warden-grasp') && hits % 3 === 0 && !killed) { P('ash-warden-grasp'); dot(e, Math.max(10, damage * .35), 3, 'burn', true); if (look) look.mark(e, 'burn'); sound('talentIgnite', { x: e.x, z: e.z, volume: .5 }); }
        if (primed && has('hearth-forged-gauntlets')) { P('hearth-forged-gauntlets'); primed = false; sound('talentBurst', { x: e.x, z: e.z }); burstHit(e.x, e.z, 2.4, 28, 'fire'); }
        if (has('black-tide-sword') && hits % 6 === 0) { P('black-tide-sword');
          const x = player.x + Math.sin(player.face) * 2, z = player.z + Math.cos(player.face) * 2;
          sound('talentChain', { x, z, volume: .7 }); burstHit(x, z, 2.6, 26, 'chain');
        }
        // ajan:bossloot
        if (attack.critical && has('headsman-hood') && !killed) { P('headsman-hood'); dot(e, damage * .4, 3, 'bleed', true); if (look) look.burst(e.x, e.z, 1.2, 'blood'); sound('talentBlood', { x: e.x, z: e.z, volume: .6 }); }
        if (hits % 6 === 0 && has('hook-chain-gauntlets') && !killed) { P('hook-chain-gauntlets'); stunEnemy(e, .5, 'heavy'); if (look) look.burst(e.x, e.z, 1.2, 'chain'); sound('talentChain', { x: e.x, z: e.z, volume: .6 }); }
        if (hits % 7 === 0 && has('cinder-breath-boots')) { P('cinder-breath-boots'); heal(.015); }
        if (attack.critical && has('black-gavel-axe')) { P('black-gavel-axe'); heal(.02); }
        if (attack.critical && has('qadi-iron-turban')) { P('qadi-iron-turban'); player.stamina = Math.min(player.maxStamina, player.stamina + 6); }
        if (has('verdict-warden-boots')) { if (pullFor !== attack && clock < pullUntil) { pullFor = attack; pullUntil = 0; if (!killed) { P('verdict-warden-boots'); stunEnemy(e, .5, 'heavy'); if (look) look.burst(e.x, e.z, 1.2, 'chain'); sound('talentChain', { x: e.x, z: e.z, volume: .6 }); } } }
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
        if (has('drowned-ringer-helm') && player.hp < 40) { P('drowned-ringer-helm'); heal(.04); if (look) look.burst(player.x, player.z, 1.2, 'gold'); }
        if (has('ash-warden-greaves')) { P('ash-warden-greaves'); rushUntil = clock + 3; }
        dots.delete(e);
      } catch (err) { /* soft */ }
    };
    talents.onDodge = function () {
      base.onDodge();
      try {
        if (has('hearth-forged-gauntlets')) primed = true;
        dodgeAt = clock; spurUntil = clock + 3; pullUntil = clock + 3;   // ajan:bossloot
        if (has('tide-chain-boots')) { P('tide-chain-boots'); player.stamina = Math.min(player.maxStamina, player.stamina + 10); }
        if (has('sunken-vow-chest')) { P('sunken-vow-chest'); const sx = player.x, sz = player.z; trails.push({ sx, sz, at: clock + .32, life: 3, hit: new Set(), tick: 0 }); }
      } catch (err) { /* soft */ }
    };
    talents.incoming = function (damage) {
      let d = base.incoming(damage);
      try {
        if (has('verdict-warden-helm') && enemies.filter(e => alive(e) && dist(e, player.x, player.z) < 5).length >= 3) d *= .9;
        if (has('warden-chainmail') && player.hp < (player.maxHp || 100) * .35) d *= .85;
        // ajan:bossloot
        if (d > 0) {
          if (player.hp < 50 && has('rusted-mail-chest')) { P('rusted-mail-chest'); d *= .88; }
          if (clock - dodgeAt < 3 && has('bellringer-bronze-chest')) { P('bellringer-bronze-chest'); d *= .85; }
          if (has('anvil-heart-chest')) furyUntil = clock + 3;
        }
        if (has('verdict-warden-chest') && chainReady <= 0 && d > 0) { P('verdict-warden-chest'); d *= .5; chainReady = 8; if (look) look.burst(player.x, player.z, 1.6, 'chain'); sound('talentChain', { volume: .6 }); }
        // Stay of Sentence: a killing blow leaves 15 % health, once every 90 s (damage here is before the 100/effectiveMaxHp scaling).
        if (d > 0 && stayReady <= 0 && has('qadi-black-robe')) {
          const eff = player.effectiveMaxHp || 100;
          if (player.hp - d * 100 / eff <= 0) { P('qadi-black-robe'); d = Math.max(0, player.hp - 15) * eff / 100; stayReady = 90; if (look) look.burst(player.x, player.z, 2, 'gold'); sound('talentExecute', { volume: .7 }); }
        }
      } catch (err) { /* soft */ }
      return d;
    };
    talents.update = function (dt) {
      base.update(dt);
      try {
        clock += dt; chainReady = Math.max(0, chainReady - dt); stayReady = Math.max(0, stayReady - dt);
        crown = crown.filter(at => at > clock);
        for (const [e, d] of dots) {
          if (!alive(e)) { dots.delete(e); continue; }
          d.tick -= dt;
          if (d.tick <= 0) { d.tick += .5; for (const key of ['raw', 'resolved']) { const wound = d[key]; if (wound && wound.time > 0) talentTick(e, wound.dps * .5, wound.kind, key === 'resolved' ? { resolved: true } : undefined); } }
          for (const key of ['raw', 'resolved']) { const wound = d[key]; if (wound && (wound.time -= dt) <= 0) d[key] = null; }
          d.dps = (d.raw ? d.raw.dps : 0) + (d.resolved ? d.resolved.dps : 0);
          d.time = Math.max(d.raw ? d.raw.time : 0, d.resolved ? d.resolved.time : 0);
          if (!d.raw && !d.resolved) dots.delete(e);
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
    talents.gearDotOf = e => dots.get(e) || null;   // read-only (target bar icons)
    // Equip feedback: a short metal/leather sound for every piece put on.
    if (typeof progression.equip === 'function' && !progression.__gearEquip) {
      const equip = progression.equip; progression.__gearEquip = true;
      progression.equip = function (uid) {
        const r = equip.apply(this, arguments);
        try { if (r && r.ok) { const e = progression.inventory.find(i => i.uid === uid), def = e && B.Progression.catalog[e.id]; if (def) ctx.sound('gearEquip', { slot: def.slot, rarity: def.rarity }); } } catch (err) { /* soft */ }
        return r;
      };
    }
    talents.reset = function () { base.reset(); dots.clear(); trails.length = 0; crown = []; primed = false; hits = 0; stayReady = 0; furyUntil = rushUntil = spurUntil = pullUntil = 0; spurFor = pullFor = null; dodgeAt = -99; if (look) look.reset(); };
  }
  B.GearPowers = { attach, describe, text: TEXT };
})();
