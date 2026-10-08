/* KABİR AZABI — talent tree 4 in the fight: the two barbarian actives (Çengelli Çekiş, Demir Duruş), bleed damage over time, the passives and the keystones.
   combat.js creates one instance per run: BABA.TalentRuntime.create(ctx) and calls the hooks below (each guarded, one line each).
   ctx: { game, player, enemies, progression, fx, sound, emit, root,
          strike(enemy, amount, face) -> hurtEnemy result (a real heavy blow),
          dot(enemy, amount, kind) -> { killed } (light tick: no knock-back, no stagger), stun(enemy, s), canHit(enemy), yank(enemy, x, z, keepDistance) }
   Numbers live in src/talent-tree.js (passives / keystones) and progression.js (hook / guard params). Look: src/talent-fx.js, sound: src/talent-audio.js.
   Tree 3 (bell / ground seal / curses / burning ground) is gone: no zones, no curses. Only physical, body-and-weapon actions remain. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const TICK = .5;
  function create(ctx) {
    const { player, enemies, progression } = ctx;
    const tree = B.TalentTree;
    const look = B.TalentFX && ctx.root ? B.TalentFX.create(ctx.root, ctx.groundY) : null;
    const status = new Map();   // enemy -> { bleed:{dps,time}, tick }
    const later = [];           // { at, fn }
    const pulls = [];           // hooked foes sliding in: { e, left, total }
    let clock = 0, leechAt = 0, momentum = 0, refundNote = 0, rageHits = 0, rageLeft = 0, vengeance = 0;
    let guard = null;           // Demir Duruş: { time, taken, thorns, stun, bleed, reach, heal, cool, puff }
    const fx = () => tree.effects(progression.learned);
    const alive = e => e && !e.dead && e.model && e.model.root.visible;
    const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
    const heal = frac => { if (player.dead) return; player.hp = Math.min(player.maxHp, player.hp + frac * player.maxHp); };
    const sound = (name, o) => ctx.sound(name, Object.assign({ x: player.x, z: player.z }, o || {}));
    const st = e => { let s = status.get(e); if (!s) { s = { bleed: null, tick: TICK * Math.random() }; status.set(e, s); } return s; };

    function bleed(e, amount, seconds) {
      if (!alive(e) || !(amount > 0)) return;
      const s = st(e), mul = fx().bleedMul, dps = amount * mul / seconds;
      // Stacks: a fresh wound adds to what still flows (capped), the clock restarts.
      const left = s.bleed && s.bleed.time > 0 ? s.bleed.dps * s.bleed.time : 0;
      s.bleed = { dps: Math.min(dps * 3.2, (left + amount * mul) / seconds), time: seconds };
      if (look) look.mark(e, 'bleed');
    }

    // ---- the two barbarian actives -------------------------------------------------------------------------------
    function isActive(skill) { return !!skill && (skill.line === 'hook' || skill.line === 'guard'); }
    // Çengelli Çekiş: the nearest foe in front of the hero inside a narrow cone (bosses count, they just are not dragged).
    function hookTargets(skill, face) {
      const P = skill.params; let best = null, score = 1e9;
      for (const e of enemies) {
        if (!alive(e) || !ctx.canHit(e)) continue;
        const d = dist(e, player.x, player.z), a = Math.abs(Math.atan2(Math.sin(Math.atan2(e.x - player.x, e.z - player.z) - face), Math.cos(Math.atan2(e.x - player.x, e.z - player.z) - face)));
        if (d > P.range + e.radius || d < 1.6 || a > .55) continue;
        const sc = d * .12 + a * 5; if (sc < score) { score = sc; best = e; }
      }
      if (!best) return null;
      const out = [best];
      if (P.extra) {   // Dikenli Çengel: the closest other foe next to the first one is caught as well
        const near = enemies.filter(o => o !== best && alive(o) && !o.boss && dist(o, best.x, best.z) < 3.8 && ctx.canHit(o)).sort((p, q) => dist(p, best.x, best.z) - dist(q, best.x, best.z)).slice(0, P.extra);
        for (const o of near) out.push(o);
      }
      return out;
    }
    // Per form: when the head bites (matches the pose contact in combat.js), how long the foe slides, how hard the camera jolts, the sound variant.
    const HOOK = { hook: { style: 'hook', strike: .24, drag: .5, shake: .5, flight: .1 }, hook2: { style: 'long', strike: .17, drag: .42, shake: .4, flight: .08 }, hook3: { style: 'barb', strike: .28, drag: .62, shake: .7, flight: .11 } };
    function castHook(skill, face, targets) {
      const P = skill.params, H = HOOK[skill.id] || HOOK.hook;
      // The head flies out fast, but the foe is hauled in slowly (longer for a longer pull) so he is not teleported to the hero.
      const dragOf = (e, n) => H.drag + Math.min(.4, Math.max(0, dist(e, player.x, player.z) - Math.max(1.25, P.keep * .72) - n * .9) * .04);
      const drags = targets.map(dragOf), maxDrag = drags.length ? Math.max(...drags) : H.drag;
      if (look) look.chains(player, targets, true, { life: H.strike + maxDrag + .5, hook: true, style: H.style, throw: H.strike, flight: H.flight });
      sound('talentHook', { style: H.style });
      later.push({ at: clock + H.strike, fn() {
        let landed = 0;
        targets.forEach((e, n) => {
          if (!alive(e)) return;
          const away = Math.atan2(e.x - player.x, e.z - player.z), r = ctx.strike(e, Math.round(P.damage * (n ? .6 : 1)), away);
          landed++;
          if (r && r.killed) return;
          bleed(e, P.bleed, 4);
          if (!e.boss) { pulls.push({ e, left: drags[n], total: drags[n], keep: Math.max(1.25, P.keep * .72) + n * .9, d0: dist(e, player.x, player.z), dust: 0, style: H.style }); ctx.stun(e, P.stun + drags[n]); }
          if (look) look.puff(e.x, (e.model && e.model.root.position.y) || 0, e.z, 'bone', 8);
        });
        if (landed) { sound('talentHookHit', { style: H.style }); ctx.emit('impact', { x: player.x + Math.sin(face) * 2, z: player.z + Math.cos(face) * 2, strength: H.shake, radius: 2.2 }); }
      } });
      return true;
    }
    // Demir Duruş: the stance lasts P.time seconds (the pose itself is the war-cry body of combat.js).
    const stanceStyle = skill => skill && skill.id === 'guard2' ? 'heart' : skill && skill.id === 'guard3' ? 'thorn' : 'iron';
    function castGuard(skill) {
      const P = skill.params;
      guard = { time: P.time, taken: P.taken, thorns: P.thorns, stun: P.stun, bleed: P.bleed, reach: P.reach, heal: P.heal || 0, cool: 0, puff: 0, style: stanceStyle(skill) };
      sound('talentStance', { style: guard.style });
      if (look) { look.plant(player, guard.style); look.puff(player.x, (player.model && player.model.root.position.y) || 0, player.z, 'bone', 6); }
      ctx.emit('impact', { x: player.x, z: player.z, strength: .75, radius: 3 });
      return true;
    }
    // Called by combat.js once the pose started; returns true when the effect is armed.
    function cast(skill, face, targets) {
      if (skill.line === 'hook') return castHook(skill, face, targets);
      if (skill.line === 'guard') return castGuard(skill);
      return false;
    }
    // The blow that reaches the hero (combat.js hitPlayer, after the damage): a foe next to him is thrown back, stunned and cut.
    function onHurt(owner, damage) {
      if (fx().vengeance && damage > 0) vengeance = Math.min(fx().vengeance.cap, vengeance + damage * (player.effectiveMaxHp || 100) / 100 * fx().vengeance.share);   // Öç Alma
      if (!guard || !owner || owner === player || !alive(owner) || damage <= 0 || guard.cool > 0) return;
      if (dist(owner, player.x, player.z) > guard.reach + owner.radius) return;
      guard.cool = .3;
      const away = Math.atan2(owner.x - player.x, owner.z - player.z), r = ctx.strike(owner, guard.thorns, away);
      sound('talentThorns', { x: owner.x, z: owner.z, style: guard.style });
      if (look) { look.puff(owner.x, 0, owner.z, 'bone', 6); look.burst(owner.x, owner.z, 1.7, 'stone'); look.thornVolley(player, owner, guard.style); }
      if (guard.heal) heal(guard.heal);
      if (r && !r.killed) { if (!owner.boss) ctx.stun(owner, guard.stun); bleed(owner, guard.bleed, 4); }
    }

    // ---- hooks fired from useSkill once a cast started -----------------------------------------------------
    function onCast(skill) {
      if (skill.line === 'charge' && fx().momentum) momentum = fx().momentum.time + .4;
    }
    // ---- combat hooks --------------------------------------------------------------------------------------
    // Outgoing damage multipliers (Kan Çılgınlığı, Hız Kazanımı, Cellat). Called by hurtEnemy before the hp drops.
    function outgoing(e, damage, attack) {
      const F = fx(); let k = 1; const bs = status.get(e);
      if (bs && bs.bleed && bs.bleed.time > 0) k *= F.bleedingTaken;
      if (F.vsStunned > 1 && e.stagger > 0) k *= F.vsStunned;
      if (F.frenzy && player.hp < F.frenzy.hp) k *= F.frenzy.dmg;
      if (F.momentum && momentum > 0) k *= F.momentum.dmg;
      if (F.rage && rageLeft > 0) k *= F.rage.dmg;
      const max = e.maxHp || e.hp || 1;
      if (F.exec && e.hp / max < F.execBelow) k *= F.execDmg;
      let out = Math.round(damage * k);
      if (F.vengeance && vengeance > 0 && attack && !attack.talent) { out += Math.round(vengeance); vengeance = 0; }   // Öç Alma: the stored share lands on the next blow
      if (F.exec && !e.boss && (e.hp - out) / max < F.execKill && e.hp - out > 0) { out = e.hp; if (look) look.execute(e); sound('talentExecute', { x: e.x, z: e.z }); }
      return out;
    }
    function onHit(e, damage, attack) {
      if (!attack || attack.talent) return;
      const F = fx();
      if (F.skillBleed && attack.line && !e.dead && e.hp > 0) bleed(e, damage * F.skillBleed, F.bleedTime);   // Kanlı İz: skill hits cut
      if (F.rage && ++rageHits >= F.rage.hits) { rageHits = 0; rageLeft = F.rage.time; if (look) look.puff(player.x, 0, player.z, 'blood', 5); }   // Öfke Birikimi
      if (F.leech && !player.dead) { heal(damage * F.leech / (player.effectiveMaxHp || 100)); if (look && clock - leechAt > .18) { leechAt = clock; look.leech(e, player); } }
    }
    function onKill(e) {
      status.delete(e); if (look) look.clear(e);
      const B2 = fx().breath; if (B2 && !player.dead) { player.stamina = Math.min(player.maxStamina, player.stamina + B2.stamina); heal(B2.heal); if (look) look.puff(player.x, 0, player.z, 'bone', 4); }   // Yırtıcı Nefes
      const KS = fx().killStamina; if (KS && !player.dead) { player.stamina = Math.min(player.maxStamina, player.stamina + KS); if (look) look.puff(player.x, 0, player.z, 'stone', 3); }   // Demir Yemin
    }
    // The build shows on the hero: the keystone's path, else a path with at least three nodes.
    const AURA = { cleave: 'stone', roar: 'blood', whirl: 'chain', charge: 'gold', hook: 'chain', guard: 'stone' };
    let auraKey = '', auraVal = '';
    function auraKind() {
      const key = progression.learned.join(','); if (key === auraKey) return auraVal;
      auraKey = key; const F = fx();
      if (F.keystone) return (auraVal = AURA[F.keystone.line]);
      const count = {}; for (const id of progression.learned) { const n = tree.get(id); if (n) count[n.line] = (count[n.line] || 0) + 1; }
      const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
      return (auraVal = best && count[best] >= 3 ? AURA[best] : '');
    }
    const incoming = damage => damage * fx().taken * (guard ? guard.taken : 1);
    const regenMul = () => { const F = fx(); return (F.frenzy && player.hp < F.frenzy.hp ? F.frenzy.regen : 1) * (F.rage && rageLeft > 0 ? F.rage.regen : 1); };
    const flaskHealMul = () => fx().flaskHeal;
    const maxFlasks = base => Math.max(0, base + fx().flasks);
    const dodgeCost = base => base * fx().dodgeMul;   // Demir Yemin: the roll costs more
    const dodgeBlocked = () => false;
    function onDodge() { if (fx().momentum) momentum = fx().momentum.time; }
    // ---- per-frame ------------------------------------------------------------------------------------------
    function update(dt) {
      clock += dt; momentum = Math.max(0, momentum - dt); rageLeft = Math.max(0, rageLeft - dt);
      if (progression.talentRefunded && ctx.game.state === 'playing' && (refundNote = refundNote + dt) > 6) {
        refundNote = 0;
        ctx.emit('toast', { text: progression.talentRefunded === 'trimmed' ? KabirI18n.t('Yetenek ağacı sadeleşti: kaldırılan yeteneklerin puanları iade edildi. T ile yeniden dağıt.') : KabirI18n.t('Yetenek ağacı yenilendi: bütün puanların iade edildi. T ile yeni yolunu seç.') });
        progression.talentRefunded = false;
      }
      ctx.game.criticalChance = .08 + fx().crit;
      for (let i = later.length - 1; i >= 0; i--) {
        const job = later[i]; if (clock < job.at) continue;
        job.age = (job.age || 0) + (clock - job.at);
        const r = job.fn.call(job);
        if (r === 'again') { job.at = clock + .1; continue; }
        later.splice(i, 1);
      }
      // hooked foes slide in along the taut chain: eased (a hard yank, then the weight arrives), dust scraped off the floor, a thud at the end
      for (let i = pulls.length - 1; i >= 0; i--) {
        const p = pulls[i];
        if (!alive(p.e)) { pulls.splice(i, 1); continue; }
        p.left -= dt; const u = Math.min(1, Math.max(0, 1 - p.left / p.total)), k = u * (1.6 - .6 * u), want = Math.max(p.keep, p.d0 + (p.keep - p.d0) * k), d = dist(p.e, player.x, player.z);
        if (d > want + .02) {
          ctx.yank(p.e, player.x, player.z, want);
          if (look && (p.dust -= dt) <= 0) { p.dust = .035; const ax = (player.x - p.e.x) / (d || 1), az = (player.z - p.e.z) / (d || 1); look.dust(p.e.x, p.e.z, -ax * 2, -az * 2, p.style === 'barb' ? 3 : 2); }
        }
        if (p.left <= 0) { pulls.splice(i, 1); if (look && p.d0 - p.keep > 1.2) { look.slam(p.e.x, p.e.z); sound('talentHookLand', { x: p.e.x, z: p.e.z, style: p.style }); ctx.emit('impact', { x: p.e.x, z: p.e.z, strength: .35, radius: 1.8 }); } }
      }
      // the stance
      if (guard) {
        if (look) look.setGuard(player, guard.time, guard.style);
        guard.time -= dt; guard.cool = Math.max(0, guard.cool - dt); guard.puff -= dt;
        if (guard.puff <= 0 && look && !player.dead) { guard.puff = .22; look.puff(player.x, (player.model && player.model.root.position.y) || 0, player.z, 'stone', 2); }
        if (guard.time <= 0 || player.dead) { guard = null; if (look) look.setGuard(null); if (look && !player.dead) look.puff(player.x, 0, player.z, 'bone', 6); }
      }
      // bleeding
      for (const [e, s] of status) {
        if (e.dead) { status.delete(e); if (look) look.clear(e); continue; }
        if (s.bleed) { s.bleed.time -= dt; if (s.bleed.time <= 0) { s.bleed = null; if (look) look.unmark(e, 'bleed'); } }
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick += TICK;
          if (s.bleed && s.bleed.dps * TICK >= .5) ctx.dot(e, s.bleed.dps * TICK, 'bleed');
        }
        if (!s.bleed) status.delete(e);
      }
      if (look) look.update(dt, status, null, auraKind() ? { player, kind: auraKind(), moving: false } : null);
    }
    function reset() { status.clear(); rageHits = rageLeft = vengeance = 0; later.length = 0; pulls.length = 0; guard = null; if (look) look.reset(); }
    function dispose() { reset(); if (look) look.dispose(); }
    const api = { isActive, cast, hookTargets, onCast, onHurt, outgoing, onHit, onKill, incoming, regenMul, flaskHealMul, maxFlasks, dodgeCost, dodgeBlocked, onDodge, update, reset, dispose,
      guardActive: () => !!guard,
      effective: skill => skill && tree ? tree.effective(skill, progression.learned) : skill,
      inCombat: () => enemies.some(e => !e.dead && e.active && Math.hypot(e.x - player.x, e.z - player.z) < 16),
      debug: () => ({ status: Array.from(status.entries()).map(([e, s]) => ({ id: e.id, hp: e.hp, bleed: s.bleed && +s.bleed.time.toFixed(2) })), later: later.length, pulls: pulls.length, guard: guard && { time: +guard.time.toFixed(2), taken: guard.taken } }) };
    api.statusOf = e => status.get(e) || null;   // read-only view for the target bar icons (target-hud.js B.Status)
    api.inflict = (kind, e, amount, seconds) => { if (kind === 'bleed') bleed(e, amount, seconds); else if (kind === 'dread' && alive(e)) { st(e).dread = seconds; if (look) look.mark(e, 'dread'); } };   // test helper (burn/curse no longer exist in the build tree)
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
