/* KABİR AZABI — talent tree 3 in the fight: bleed / burn damage over time, curses (rot, dread), burning ground,
   the two new actives (Kor Mührü, Ölüm Çanı), seals of the old lines and the keystones.
   combat.js creates one instance per run: BABA.TalentRuntime.create(ctx) and calls the hooks below (each guarded, one line each).
   ctx: { game, player, enemies, progression, fx, sound, emit, root,
          strike(enemy, amount, face) -> hurtEnemy result (a real heavy blow, used by bursts / seals),
          dot(enemy, amount, kind) -> { killed } (light tick: no knock-back, no stagger), stun(enemy, s), canHit(enemy) }
   Numbers live in src/talent-tree.js (node fx) and progression.js (pyre / knell params). Look: src/talent-fx.js, sound: src/talent-audio.js. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const TICK = .5;
  function create(ctx) {
    const { player, enemies, progression } = ctx;
    const tree = B.TalentTree;
    const look = B.TalentFX && ctx.root ? B.TalentFX.create(ctx.root, ctx.groundY) : null;
    const status = new Map();   // enemy -> { bleed:{dps,time}, burn:{dps,time}, rot:time, rotAmp, dread:time, tick }
    const zones = [];           // { kind, x, z, r, x2, z2, w, time, life, dps, burn, tick, owner, burst }
    const later = [];           // { at, fn }
    let clock = 0, leechAt = 0, lastX = 0, lastZ = 0, momentum = 0, dodgeRest = 0, refundNote = 0, hearth = false, regenHold = 0;
    const fx = () => tree.effects(progression.learned);
    const has = id => progression.learned.includes(id);
    const sealOf = line => fx().seal[line] || null;
    const st = e => { let s = status.get(e); if (!s) { s = { bleed: null, burn: null, rot: 0, rotAmp: 1, dread: 0, tick: TICK * Math.random() }; status.set(e, s); } return s; };
    const alive = e => e && !e.dead && e.model && e.model.root.visible;
    const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
    const heal = frac => { if (player.dead) return; player.hp = Math.min(player.maxHp, player.hp + frac * player.maxHp); };
    const sound = (name, o) => ctx.sound(name, Object.assign({ x: player.x, z: player.z }, o || {}));

    function bleed(e, amount, seconds) {
      if (!alive(e) || !(amount > 0)) return;
      const s = st(e), mul = fx().bleedMul, dps = amount * mul / seconds;
      // Stacks: a fresh wound adds to what still flows (capped), the clock restarts.
      const left = s.bleed && s.bleed.time > 0 ? s.bleed.dps * s.bleed.time : 0;
      s.bleed = { dps: Math.min(dps * 3.2, (left + amount * mul) / seconds), time: seconds };
      if (look) look.mark(e, 'bleed');
    }
    function burn(e, amount, seconds) {
      if (!alive(e) || !(amount > 0)) return;
      const s = st(e), F = fx(), time = seconds + F.burnTime, dps = amount * F.burnMul / time;
      if (!s.burn || s.burn.time <= 0) sound('talentIgnite', { x: e.x, z: e.z, volume: .5 });
      s.burn = { dps: Math.max(dps, s.burn && s.burn.time > 0 ? s.burn.dps : 0), time };
      if (look) look.mark(e, 'burn');
    }
    function curse(e, seconds, amp) {
      if (!alive(e)) return;
      const s = st(e); s.rot = Math.max(s.rot, seconds); s.rotAmp = Math.max(s.rotAmp, amp || 1.25);
      if (look) look.mark(e, 'rot');
    }
    function zone(z) {
      z.tick = 0; z.life = z.time; zones.push(z);
      if (look) look.zone(z);
      return z;
    }
    function inZone(z, e, pad) {
      if (z.kind === 'trail') {
        const dx = z.x2 - z.x, dz = z.z2 - z.z, len2 = dx * dx + dz * dz || 1;
        const u = Math.max(0, Math.min(1, ((e.x - z.x) * dx + (e.z - z.z) * dz) / len2));
        return Math.hypot(e.x - (z.x + dx * u), e.z - (z.z + dz * u)) < z.w / 2 + (pad || 0);
      }
      if (z.kind === 'crescent') {
        const d = dist(e, z.x, z.z); if (d > z.r + (pad || 0)) return false;
        const a = Math.atan2(e.x - z.x, e.z - z.z), diff = Math.abs(Math.atan2(Math.sin(a - z.face), Math.cos(a - z.face)));
        return diff < 1.25 || d < 1.2;
      }
      return dist(e, z.x, z.z) < z.r + (pad || 0);
    }
    // ---- a burst of rot (k-rot, knell): damage + optional new curses around a dead foe
    function rotBurst(x, z, amount, radius, spread) {
      if (look) look.burst(x, z, radius, 'rot');
      sound('talentRot', { x, z, volume: .8 });
      for (const e of enemies) {
        if (!alive(e) || dist(e, x, z) > radius + e.radius * .5 || !ctx.canHit(e)) continue;
        const r = ctx.strike(e, amount, Math.atan2(e.x - x, e.z - z));
        if (spread && r && !r.killed) curse(e, 6, 1.2);
      }
    }
    function fireBurst(x, z, amount, radius, stun) {
      if (look) look.burst(x, z, radius, 'fire');
      sound('talentBurst', { x, z });
      ctx.emit('impact', { x, z, strength: .8, radius });
      for (const e of enemies) {
        if (!alive(e) || dist(e, x, z) > radius + e.radius * .5 || !ctx.canHit(e)) continue;
        const r = ctx.strike(e, amount, Math.atan2(e.x - x, e.z - z));
        if (r && !r.killed) { burn(e, amount * .3, 3); if (stun) ctx.stun(e, stun); }
      }
    }

    // ---- new actives -----------------------------------------------------------------------------------------
    function isActive(skill) { return !!skill && (skill.line === 'pyre' || skill.line === 'knell'); }
    function castPyre(skill, face) {
      const P = skill.params, sx = Math.sin(face), sz = Math.cos(face);
      later.push({ at: clock + .17, fn() {
        const x = player.x + sx * P.reach, z = player.z + sz * P.reach;
        sound('talentSeal', { x, z });
        ctx.emit('impact', { x, z, strength: .7, radius: P.radius });
        const zz = zone({ kind: 'seal', x, z, r: P.radius, time: P.time, dps: P.dps, burn: P.burn, owner: 'pyre', burst: P.burst || 0, face });
        for (const e of enemies) if (alive(e) && inZone(zz, e, e.radius * .5) && ctx.canHit(e)) burn(e, P.burn, 3);
      } });
      return true;
    }
    function castKnell(skill) {
      const P = skill.params, x = player.x, z = player.z;
      if (look) look.bell(player, P.radius);
      sound('talentKnell', { x, z });
      later.push({ at: clock + .28, fn() {
        ctx.emit('impact', { x: player.x, z: player.z, strength: .55, radius: P.radius });
        for (const e of enemies) {
          if (!alive(e) || dist(e, player.x, player.z) > P.radius + e.radius || !ctx.canHit(e)) continue;
          curse(e, P.time, P.amp);
          if (P.damage) ctx.strike(e, P.damage, Math.atan2(e.x - player.x, e.z - player.z));
          if (P.stun) ctx.stun(e, P.stun);
        }
      } });
      return true;
    }
    function cast(skill, face) {
      if (skill.line === 'pyre') return castPyre(skill, face);
      if (skill.line === 'knell') return castKnell(skill);
      return false;
    }
    // ---- seals of the four old lines, fired from useSkill once a cast started -------------------------------
    // Zincir Kırbacı: the chain lashes the three nearest foes within 7 m.
    function lash() {
      const F = fx(); if (!F.lash) return;
      const near = enemies.filter(e => alive(e) && dist(e, player.x, player.z) < 7 + e.radius && ctx.canHit(e)).sort((a, b) => dist(a, player.x, player.z) - dist(b, player.x, player.z)).slice(0, 3);
      if (!near.length) return;
      if (look) look.chains(player, near, true);
      sound('talentChain', { volume: .8 });
      for (const e of near) ctx.strike(e, 32, Math.atan2(e.x - player.x, e.z - player.z));
    }
    function onCast(skill) {
      const seal = sealOf(skill.line), P = skill.params, face = player.face, F0 = fx();
      if (F0.lash && skill.line === 'whirl') later.push({ at: clock + (P.duration || 1.3) + .02, fn: lash });
      if (skill.line === 'charge') { if (F0.lash) later.push({ at: clock + .2, until: 1.6, fn() { if (player.attack && player.attack.line === 'charge' && this.age < this.until) return 'again'; lash(); } }); if (F0.momentum) momentum = 3.4; }
      if (!seal) return;
      const id = seal.id;
      // seal signatures that only change the look of the old skills
      if (id === 'cleave-sunder' && look) later.push({ at: clock + (P.strike || .16) + .03, fn() { const r = skill.id === 'brand' ? (P.reach || 2) : 1.6; const x = player.x + Math.sin(face) * r, z = player.z + Math.cos(face) * r; look.burst(x, z, 2.4, 'stone'); sound('talentRot', { x, z, volume: .4 }); } });
      if (id === 'whirl-hook' && look) later.push({ at: clock + (P.duration || 1.3) * .45, fn() { look.chains(player, enemies.filter(e => alive(e) && dist(e, player.x, player.z) < (P.radius || 3.6) * 1.6).slice(0, 6), true); sound('talentChain', { volume: .7 }); } });
      if (id === 'charge-chain' && look) later.push({ at: clock + .2, until: 1.8, fn() { if (player.attack && player.attack.line === 'charge' && this.age < this.until) return 'again'; look.chains(player, enemies.filter(e => alive(e) && dist(e, player.x, player.z) < (P.radius || 3) + 3.5).slice(0, 6), true); sound('talentChain'); } });
      if (id === 'charge-echo' && look) later.push({ at: clock + .05, until: 1.4, fn() { if (player.attack && player.attack.line === 'charge' && this.age < this.until) { look.puff(player.x, (player.model && player.model.root.position.y) || 0, player.z, 'dread', 5); return 'again'; } } });
      if (id === 'cleave-ember') later.push({ at: clock + (P.strike || .16) + .04, fn() {
        const reach = skill.id === 'brand' ? (P.reach || 2) : skill.id === 'temper' ? 1.2 : .4;
        zone({ kind: 'crescent', x: player.x + Math.sin(face) * reach, z: player.z + Math.cos(face) * reach, r: Math.max(3, (P.radius || 3.7) * .9), face, time: 3, dps: 14, burn: 18, owner: 'cleave' });
        sound('talentIgnite', { volume: .8 });
      } });
      else if (id === 'whirl-ash') later.push({ at: clock + (P.duration || 1.3), fn() {
        zone({ kind: 'ring', x: player.x, z: player.z, r: (P.radius || 3.6) * .95, time: 4, dps: 16, burn: 20, owner: 'whirl' });
        sound('talentIgnite', { volume: .9 });
      } });
      else if (id === 'charge-trail') {
        const sx = player.x, sz = player.z;
        later.push({ at: clock + .18, until: 1.6, fn() {
          const a = player.attack;
          if (a && a.line === 'charge' && this.age < this.until) return 'again';   // wait for the dash to land
          if (Math.hypot(player.x - sx, player.z - sz) < 1) return;
          zone({ kind: 'trail', x: sx, z: sz, x2: player.x, z2: player.z, w: Math.max(1.8, (P.width || 1.5) + .5), time: 3.5, dps: 15, burn: 20, owner: 'charge' });
        } });
      } else if (skill.line === 'roar') {
        if (seal.fx.bloodCost) { player.hp = Math.max(1, player.hp - seal.fx.bloodCost * player.maxHp); if (look) look.burst(player.x, player.z, 2.2, 'blood'); sound('talentBlood'); }
        later.push({ at: clock + .14, fn() {
          for (const e of enemies) {
            if (!alive(e) || dist(e, player.x, player.z) > (P.near || 6.5) + e.radius || !ctx.canHit(e)) continue;
            if (seal.fx.dread) { const s = st(e); s.dread = seal.fx.dread; if (look) look.mark(e, 'dread'); }
            if (seal.fx.igniteNear) burn(e, seal.fx.igniteNear, 4);
          }
          if (seal.fx.igniteNear && look) look.burst(player.x, player.z, P.near || 6.5, 'fire');
          if (seal.fx.dread && look) look.burst(player.x, player.z, P.near || 6.5, 'dread');
        } });
      }
    }
    // ---- combat hooks --------------------------------------------------------------------------------------
    // Outgoing damage multipliers (curses, Ezici, Cellat). Called by hurtEnemy before the hp drops.
    function outgoing(e, damage, attack) {
      const F = fx(), s = status.get(e);
      let k = 1;
      if (s) { if (s.rot > 0) k *= s.rotAmp; if (s.dread > 0) k *= 1.2; if (s.bleed && s.bleed.time > 0) k *= F.bleedingTaken; }
      if (F.vsStunned > 1 && e.stagger > 0) k *= F.vsStunned;
      if (F.frenzy && player.hp < 40) k *= 1.25;
      if (F.momentum && momentum > 0) k *= 1.2;
      const max = e.maxHp || e.hp || 1;
      if (F.exec && e.hp / max < .4) k *= 1.25;
      let out = Math.round(damage * k);
      if (F.exec && !e.boss && (e.hp - out) / max < .10 && e.hp - out > 0) { out = e.hp; if (look) look.execute(e); sound('talentExecute', { x: e.x, z: e.z }); }
      return out;
    }
    function onHit(e, damage, attack, killed) {
      if (!attack || attack.talent) return;
      const F = fx(), line = attack.line, seal = line ? sealOf(line) : null;
      if (F.leech && !player.dead) { heal(damage * F.leech / (player.effectiveMaxHp || 100)); if (look && clock - leechAt > .18) { leechAt = clock; look.leech(e, player); } }
      if (F.has.has('k-hunger')) player.stamina = Math.min(player.maxStamina, player.stamina + 2);   // on top of the orb refill per blow (combat-tuning ECONOMY.HIT)
      if (killed) return;
      if (seal && seal.fx.bleed) bleed(e, damage * seal.fx.bleed, 4);
      if (seal && seal.fx.burn) burn(e, damage * seal.fx.burn, 3);
      if (F.allBurn && !(seal && seal.fx.burn)) burn(e, damage * .3, 3);
    }
    function onKill(e) {
      const F = fx(), s = status.get(e), x = e.x, z = e.z;
      if (F.aftershock && e.stagger > 0) later.push({ at: clock + .08, fn() {
        if (look) look.burst(x, z, 2.8, 'stone'); sound('talentRot', { x, z, volume: .55 }); ctx.emit('impact', { x, z, strength: .6, radius: 2.8 });
        for (const o of enemies) if (alive(o) && dist(o, x, z) < 2.8 + o.radius && ctx.canHit(o)) { const r = ctx.strike(o, 24, Math.atan2(o.x - x, o.z - z)); if (r && !r.killed) ctx.stun(o, .35); }
      } });
      if (F.has.has('k-hunger') && look) look.souls(e, player);
      if (F.has.has('k-hunger')) player.stamina = Math.min(player.maxStamina, player.stamina + 25);
      if (F.harvest) { player.stamina = Math.min(player.maxStamina, player.stamina + 8); heal(.01); }
      if (s && s.rot > 0) {
        const base = B.Progression.skills.find(k => k.id === 'knell'), P = base ? tree.effective(base, progression.learned).params : { burst: 38, burstRadius: 3.2 };
        const kseal = sealOf('knell');
        if (kseal && kseal.fx.drain) { heal(.05); player.stamina = Math.min(player.maxStamina, player.stamina + 10); if (look) look.drain(e, player); }
        later.push({ at: clock + .12, fn() { rotBurst(x, z, P.burst, P.burstRadius, !!(kseal && kseal.fx.spread)); } });
      } else if (F.rotWorld) later.push({ at: clock + .12, fn() { rotBurst(x, z, 40, 3, true); } });
      if (F.ashfall && s && s.burn && s.burn.time > 0) later.push({ at: clock + .1, fn() {
        if (look) look.burst(x, z, 3.2, 'fire'); sound('talentIgnite', { x, z });
        for (const o of enemies) if (alive(o) && dist(o, x, z) < 3.2 + o.radius) burn(o, 26, 3);
      } });
      status.delete(e); if (look) look.clear(e);
    }
    // The build shows on the hero: the keystone's path, else a path with at least three nodes.
    const AURA = { cleave: 'stone', roar: 'blood', whirl: 'chain', charge: 'gold', pyre: 'fire', knell: 'rot' };
    let auraKey = '', auraVal = '';
    function auraKind() {
      const key = progression.learned.join(','); if (key === auraKey) return auraVal;
      auraKey = key; const F = fx();
      if (F.keystone) return (auraVal = AURA[F.keystone.line]);
      const count = {}; for (const id of progression.learned) { const n = tree.get(id); if (n) count[n.line] = (count[n.line] || 0) + 1; }
      const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
      return (auraVal = best && count[best] >= 4 ? AURA[best] : '');
    }
    const incoming = damage => damage * fx().taken;
    // Stamina regeneration factor (Ölü Açlığı: none above 20; Ocak Yüreği: twice inside the own seal).
    function regenMul() {
      const F = fx(); let k = F.regen;
      if (F.hunger) k = player.stamina < 20 ? .35 : 0;
      if (hearth) k *= 2;
      if (F.frenzy && player.hp < 40) k *= 1.15;
      return k;
    }
    const flaskHealMul = () => fx().flaskHeal;
    const maxFlasks = base => Math.max(0, base + fx().flasks);
    const dodgeCost = base => fx().chainDodge ? 0 : base;
    const dodgeBlocked = () => fx().chainDodge && dodgeRest > 0;
    function onDodge() {
      if (fx().momentum) momentum = 3;
      if (!fx().chainDodge) return;
      dodgeRest = 2;
      // Lands .3 s later, where the roll ends: the chains whip out and drag every foe within 7 m in.
      later.push({ at: clock + .3, fn() {
        const pulled = [];
        for (const e of enemies) {
          if (!alive(e) || e.boss || dist(e, player.x, player.z) > 7 + e.radius || dist(e, player.x, player.z) < 1.3 || !ctx.canHit(e)) continue;
          pulled.push(e); ctx.yank(e, player.x, player.z, 1.2); ctx.stun(e, .8);
        }
        if (look) look.chains(player, pulled); sound(pulled.length ? 'talentChain' : 'talentChainMiss');
      } });
    }
    // ---- per-frame ------------------------------------------------------------------------------------------
    function update(dt) {
      clock += dt; dodgeRest = Math.max(0, dodgeRest - dt); momentum = Math.max(0, momentum - dt);
      if (progression.talentRefunded && ctx.game.state === 'playing' && (refundNote = refundNote + dt) > 6) { refundNote = 0; progression.talentRefunded = false; ctx.emit('toast', { text: KabirI18n.t('Yetenek ağacı yenilendi: bütün puanların iade edildi. T ile yeni yolunu seç.') }); }
      ctx.game.criticalChance = .08 + fx().crit;
      for (let i = later.length - 1; i >= 0; i--) {
        const job = later[i]; if (clock < job.at) continue;
        job.age = (job.age || 0) + (clock - job.at);
        const r = job.fn.call(job);
        if (r === 'again') { job.at = clock + .1; continue; }
        later.splice(i, 1);
      }
      // damage over time
      for (const [e, s] of status) {
        if (e.dead) { status.delete(e); if (look) look.clear(e); continue; }
        s.rot = Math.max(0, s.rot - dt); s.dread = Math.max(0, s.dread - dt);
        if (s.bleed) { s.bleed.time -= dt; if (s.bleed.time <= 0) { s.bleed = null; if (look) look.unmark(e, 'bleed'); } }
        if (s.burn) { s.burn.time -= dt; if (s.burn.time <= 0) { s.burn = null; if (look) look.unmark(e, 'burn'); } }
        if (s.rot <= 0 && look) look.unmark(e, 'rot');
        if (s.dread <= 0 && look) look.unmark(e, 'dread');
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick += TICK;
          const amount = ((s.bleed ? s.bleed.dps : 0) + (s.burn ? s.burn.dps : 0)) * TICK * (fx().plague && s.rot > 0 ? 1.5 : 1);
          if (s.burn && fx().kindle && Math.random() < .3) {
            const next = enemies.find(o => o !== e && alive(o) && dist(o, e.x, e.z) < 3.2 && !(status.get(o) && status.get(o).burn));
            if (next) { burn(next, s.burn.dps * 2, 3); if (look) look.leap(e, next); }
          }
          if (amount >= .5) ctx.dot(e, amount, s.burn && (!s.bleed || s.burn.dps >= s.bleed.dps) ? 'burn' : 'bleed');
        }
        if (!s.bleed && !s.burn && s.rot <= 0 && s.dread <= 0) status.delete(e);
      }
      // burning ground
      hearth = false;
      for (let i = zones.length - 1; i >= 0; i--) {
        const z = zones[i]; z.life -= dt; z.tick -= dt;
        if (z.owner === 'pyre' && sealOf('pyre') && sealOf('pyre').fx.hearth && inZone(z, player, .2)) {
          hearth = true; if (!player.dead) heal(.015 * dt);
        }
        if (z.tick <= 0) {
          z.tick += TICK;
          for (const e of enemies) if (alive(e) && inZone(z, e, e.radius * .5) && ctx.canHit(e)) { ctx.dot(e, z.dps * TICK, 'burn'); burn(e, z.burn, 3); }
        }
        if (z.life <= 0) {
          zones.splice(i, 1); if (look) look.unzone(z);
          if (z.burst) fireBurst(z.x, z.z, z.burst, z.r + 1, 1);
        }
      }
      if (look) {
        const moved = Math.hypot(player.x - lastX, player.z - lastZ) > dt * 1.5; lastX = player.x; lastZ = player.z;
        look.update(dt, status, hearth ? player : null, auraKind() ? { player, kind: auraKind(), moving: moved } : null);
      }
    }
    function reset() { status.clear(); zones.length = 0; later.length = 0; if (look) look.reset(); }
    function dispose() { reset(); if (look) look.dispose(); }
    const api = { isActive, cast, onCast, outgoing, onHit, onKill, incoming, regenMul, flaskHealMul, maxFlasks, dodgeCost, dodgeBlocked, onDodge, update, reset, dispose,
      effective: skill => skill && tree ? tree.effective(skill, progression.learned) : skill,
      inCombat: () => enemies.some(e => !e.dead && e.active && Math.hypot(e.x - player.x, e.z - player.z) < 16),
      debug: () => ({ status: Array.from(status.entries()).map(([e, s]) => ({ id: e.id, hp: e.hp, bleed: s.bleed && +s.bleed.time.toFixed(2), burn: s.burn && +s.burn.time.toFixed(2), rot: +s.rot.toFixed(2), dread: +s.dread.toFixed(2) })), zones: zones.map(z => ({ kind: z.kind, owner: z.owner, life: +z.life.toFixed(2) })), later: later.length, hearth }) };
    // A talent bug must never break a fight: every hook fails soft (neutral value) and reports once.
    const NEUTRAL = { outgoing: (e, d) => d, incoming: d => d, regenMul: () => 1, flaskHealMul: () => 1, maxFlasks: b => b, dodgeCost: b => b, effective: s => s };
    let warned = false;
    for (const name of Object.keys(api)) {
      const fn = api[name];
      api[name] = function () { try { return fn.apply(null, arguments); } catch (err) { if (!warned) { warned = true; console.warn('TalentRuntime', name, err); } return NEUTRAL[name] ? NEUTRAL[name].apply(null, arguments) : false; } };
    }
    return api;
  }
  B.TalentRuntime = Object.freeze({ create });
}());
