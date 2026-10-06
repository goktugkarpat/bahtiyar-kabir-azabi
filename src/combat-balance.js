/* KABİR AZABI — combat balance bench (QA only; never runs by itself, costs nothing until called).

   WHAT IT DOES
   BABA.Balance.run(options) drives the hero with a scripted bot through chosen encounters of the loaded chapter, straight through
   game.update() at 60 Hz (no rendering: a 12-fight chapter takes ~15-40 s of real time), and returns numbers per fight and in total.
   Every fight starts fresh: game.respawn(), all other foes hidden (flagged dead, no XP / loot), the hero placed ~8 m from the group
   on the side he arrives from, full health and flasks. XP is switched off during the run (no levelling mid-measurement).
   A boss is stopped at 10 % health (its real death would end the chapter / leave the page); its time is scaled by 1 / .9.

   CALL
     BABA.Balance.run({
       difficulty: 'easy' | 'normal' | 'hard',          // game.setDifficulty() before the run
       level: 0,                                         // 0 = the chapter's expected level (GEAR[ch].level: 3 / 6 / 9 / 11)
       gear: 'expected' | 'none',                        // GEAR[ch].items equipped (weapon + 4 armour pieces a player would wear there)
       bot: 'novice' | 'average' | 'skilled' | 'spam',   // see BOTS; or tune: { reaction, miss, lead, flaskAt, skills, spam } to override
       encounters: 'all' | 'boss' | [index, ...],        // group index = order of first appearance in game.enemies (the boss of ch I/II is #5, ch III/IV #12)
       limit: 150,                                       // seconds per fight before it counts as a timeout
       seed: 3 })                                        // which tells a bot "misses" (deterministic per hazard serial); crits stay random
   -> { chapter, difficulty, bot, profile: { level, dmg, hp, def, loadout },
        total: { fights, deaths, timeouts, time, hpLost, flasks, rolls, hitsTaken, denied, perfect },
        results: [{ index, name, boss, types, foes, died, cleared, timeout, time, fightTime, hpLost, endHp, flasks, rolls,
                    hitsTaken, biggestHit, kills: [seconds of each kill], denied, perfect }] }
   hpLost is in % of the hero's health (100 = one full bar); summed over fights it can exceed 100. denied = frames (1/60 s) the bot wanted
   to roll from a tell but lacked stamina (the stamina economy biting); perfect = last-moment rolls (combat-tuning.js ECONOMY.PERFECT).

   BOTS (per-hazard decisions):  reaction = s a tell must be on the floor before the bot sees it; miss = chance it never sees one;
   lead = how early before contact it rolls (<= ECONOMY perfect window means it lands "last-moment" rolls); flaskAt = drinks below this
   fraction; skills = uses its four slots (war cry / whirl with 2+ foes or a boss, charge at range, heavy skill in reach); spam = rolls at
   once (lead .9) plus random rolls near foes: the "I just roll through everything" player.

   RENDERED CAPTURE: BABA.Balance.attach(foeList, botName) makes the bot drive app.js input while BABA.app.step() keeps drawing
   (screenshots / frame series); .detach() gives control back. setupProfile / groups / approach are exported for such scripts.

   RUNNER (Python, Playwright): scratchpad combat/bal.py  <chapters> <difficulties> <bots> [encounters] [level]
     e.g.  python bal.py 1,2,3,4 easy,normal,hard novice,average,skilled,spam
   Run one chapter per process if the machine is busy (a chapter page can take > 120 s to load under load).
   Reading results: compare the same bot across chapters (curve) and bots within a difficulty (skill must pay, spam must not).
   Expect +-30 % noise between runs on the same numbers (critical hits are random). The reference tables are in combat-tuning.js. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const TAU = Math.PI * 2;
  const BOTS = {
    novice: { reaction: .42, miss: .35, lead: .22, flaskAt: .35, skills: false, spam: false },
    average: { reaction: .30, miss: .18, lead: .26, flaskAt: .42, skills: true, spam: false },
    skilled: { reaction: .20, miss: .06, lead: .16, flaskAt: .38, skills: true, spam: false },
    spam: { reaction: .15, miss: .05, lead: .9, flaskAt: .42, skills: true, spam: true }
  };
  // Expected kit per chapter (what a player who equips the drops wears on arrival): weapon + four armour pieces.
  const GEAR = {
    1: { level: 3, items: ['grave-sword', 'mourner-chest', 'orphan-hood', 'cold-prayer-gloves', 'gallows-boots'] },
    2: { level: 6, items: ['orphan-spear', 'empty-vow-chest', 'no-witness-helm', 'nameless-gauntlets', 'sunken-steps'] },
    3: { level: 9, items: ['sepulcher-axe', 'warden-chainmail', 'buried-prayer-hood', 'black-stone-gauntlets', 'buried-road-boots'] },
    4: { level: 11, items: ['hollow-crown-blade', 'sunless-vow-chest', 'sealed-gaze-helm', 'blood-oath-wraps', 'buried-road-boots'] },
    5: { level: 13, items: ['furnace-oath-axe', 'ash-warden-chest', 'sealed-furnace-helm', 'ash-warden-grasp', 'dead-forge-steps'] }
  };
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
  function inside(h, p, pad) {
    const dx = p.x - h.x, dz = p.z - h.z, r = .43 + (pad || 0);
    if (h.shape === 'line') {
      const f = dx * Math.sin(h.face) + dz * Math.cos(h.face), s = dx * Math.cos(h.face) - dz * Math.sin(h.face);
      const ex = Math.max(Math.abs(s) - h.width / 2, 0), ez = Math.max(-f, f - h.length, 0);
      return ex * ex + ez * ez <= r * r;
    }
    const d = Math.hypot(dx, dz);
    if (h.shape === 'ring') return d >= (h.inner || 0) - r && d <= h.radius + r;
    if (d > h.radius + r) return false;
    if (h.shape === 'cone') return d < .45 || Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - h.face), Math.cos(Math.atan2(dx, dz) - h.face))) < h.arc / 2 + .05;
    return true;
  }
  // Direction out of a tell: lines sideways, everything else away from its centre (a ring: inward).
  function escape(h, p) {
    if (h.shape === 'line') {
      const s = (p.x - h.x) * Math.cos(h.face) - (p.z - h.z) * Math.sin(h.face), k = s >= 0 ? 1 : -1;
      return { x: Math.cos(h.face) * k, z: -Math.sin(h.face) * k };
    }
    let dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz);
    if (d < .2) { dx = Math.sin(h.face + Math.PI / 2); dz = Math.cos(h.face + Math.PI / 2); d = 1; }
    if (h.shape === 'ring') return { x: -dx / d, z: -dz / d };
    return { x: dx / d, z: dz / d };
  }
  function setupProfile(game, chapter, level, gear) {
    const P = B.Progression, prog = game.progression, kit = GEAR[chapter] || GEAR[1];
    const lvl = Math.max(1, Math.min(P.MAX_LEVEL, level || kit.level));
    const inv = [], eq = {};
    if (gear !== 'none') kit.items.forEach((id, i) => { const def = P.catalog[id]; if (def && def.level <= lvl) { inv.push({ uid: 'bal-' + i, id, roll: 0 }); eq[def.slot] = 'bal-' + i; } });
    const snap = prog.snapshot();
    prog.restore(Object.assign({}, snap, { xp: P.thresholds[lvl - 1], learned: [], loadout: [null, null, null, null], inventory: inv, equipment: {}, completed: [1, 2, 3].filter(c => c < chapter) }));
    Object.values(eq).forEach(uid => prog.equip(uid));
    // Learn every reachable skill, lowest level first (one line at a time so upgrades follow), then fill the four slots by line.
    for (let pass = 0; pass < 4; pass++) for (const s of P.skills.slice().sort((a, b) => a.level - b.level)) prog.unlock(s.id);
    const lines = ['cleave', 'whirl', 'roar', 'charge'];
    lines.forEach((line, slot) => {
      const best = P.skills.filter(s => s.line === line && prog.learned.includes(s.id)).sort((a, b) => b.tier - a.tier)[0];
      if (best) prog.assign(slot, best.id);
    });
    game.syncProgression(true);
    return { level: prog.level, stats: prog.stats(), learned: prog.learned.slice(), loadout: prog.loadout.slice() };
  }
  function bossOf(enc) { return enc.some(e => e.boss); }
  function groups(game) {
    const map = new Map();
    for (const e of game.enemies) { if (e.reserve) continue; const k = e.encounter; if (!map.has(k)) map.set(k, []); map.get(k).push(e); }
    return Array.from(map.entries()).map(([enc, list], index) => ({ enc, list, index, boss: bossOf(list) }));
  }
  // A walkable floor point ~8 m from the group, on the side of the route the hero arrives from (toward the chapter spawn).
  function approach(world, list, spawn) {
    const cx = list.reduce((s, e) => s + e.spawnX, 0) / list.length, cz = list.reduce((s, e) => s + e.spawnZ, 0) / list.length;
    const base = Math.atan2(spawn.x - cx, spawn.z - cz);
    for (const r of [8.5, 7, 10, 6, 5]) for (const off of [0, .4, -.4, .8, -.8, 1.3, -1.3, Math.PI]) {
      const a = base + off, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (!world.isWalkable || world.isWalkable(x, z, .6)) return { x, z, cx, cz };
    }
    return { x: cx, z: cz + 6, cx, cz };
  }
  function run(options) {
    const o = Object.assign({ difficulty: 'normal', level: 0, gear: 'expected', bot: 'average', encounters: 'all', limit: 150, dt: 1 / 60 }, options || {});
    const app = B.app, game = app.game, world = app.world || {}, chapter = B.ActiveChapter || (game.progression && game.progression.chapter) || 1;
    const bot = Object.assign({}, BOTS[o.bot] || BOTS.average, o.tune || {});
    if (game.state !== 'playing') game.start();
    game.setDifficulty(o.difficulty);
    const profile = setupProfile(game, chapter, o.level, o.gear);
    game.saveProfileChoices();
    const prog = game.progression, grant = prog.grantEnemy;
    prog.grantEnemy = () => ({ xp: 0, levels: 0, items: [], duplicate: true });   // no levelling inside a measurement
    const all = groups(game), spawn = { x: game.player.x, z: game.player.z };
    let pick = all;
    if (o.encounters === 'boss') pick = all.filter(g => g.boss);
    else if (Array.isArray(o.encounters)) pick = all.filter(g => o.encounters.includes(g.index));
    const results = [];
    try {
      for (const g of pick) results.push(fight(game, world, g, spawn, bot, o, chapter));
    } finally { prog.grantEnemy = grant; for (const e of hidden) { e.dead = false; e.hp = e.maxHp; } hidden.clear(); }
    const sum = k => results.reduce((s, r) => s + (r[k] || 0), 0);
    return { chapter, difficulty: o.difficulty, bot: o.bot, profile: { level: profile.level, dmg: +profile.stats.damageMultiplier.toFixed(2), hp: profile.stats.maxHp, def: +profile.stats.defense.toFixed(3), loadout: profile.loadout },
      total: { fights: results.length, deaths: sum('died'), timeouts: sum('timeout'), time: +sum('time').toFixed(1), hpLost: Math.round(sum('hpLost')), flasks: sum('flasks'), rolls: sum('rolls'), hitsTaken: sum('hitsTaken'), denied: sum('denied'), perfect: sum('perfect') },
      results };
  }
  // One frame of the bot: returns the input object combat.js reads (same fields as app.js pollInput()).
  function decide(game, live, bot, seen, seed, stat) {
    const p = game.player;
    const input = { x: 0, z: 0 };
    // Nearest living foe of the encounter is the target.
    let target = null, best = Infinity;
    for (const e of live) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < best) { best = d; target = e; } }
    // Threat scan.
    let threat = null, soon = Infinity, pool = null;
    for (const h of game.hazards) {
      if (h.harmless || h.age < 0) continue;
      if (!seen.has(h.serial)) seen.set(h.serial, hash(h.serial * 7919 + (seed || 1)) < bot.miss);
      if (h.persistent && h.periodic) { if (h.active && inside(h, p, .3)) pool = h; continue; }
      if (seen.get(h.serial) || h.age < bot.reaction || h.hit) continue;
      const left = h.warn - h.age;
      if (left < -(h.duration || .17) || !inside(h, p, .15)) continue;
      if (left < soon) { soon = left; threat = h; }
    }
    const cost = (game.dodgeCost ? game.dodgeCost() : 18.2);
    if (threat && soon <= bot.lead && !p.dodge && p.stamina < cost) stat.denied++;
    if (bot.spam && !threat && target && best < 3.5 && p.stamina >= cost && !p.dodge && Math.random() < .025) {
      const a = Math.random() * TAU; input.x = Math.sin(a); input.z = Math.cos(a); input.dodge = true;
    } else if (threat && soon <= bot.lead && !p.dodge && p.stamina >= cost) {
      const v = escape(threat, p); input.x = v.x; input.z = v.z; input.dodge = true;
    } else if (pool && !p.dodge) {
      const v = escape(pool, p); input.x = v.x; input.z = v.z;
    } else {
      if (p.hp < 100 * bot.flaskAt && p.flasks > 0 && !threat) input.heal = true;
      const skills = game.skills ? game.skills() : [];
      const near = live.filter(e => Math.hypot(e.x - p.x, e.z - p.z) < 4.2).length;
      const reserve = cost + 4;
      const ready = slot => { const s = skills[slot]; return s && s.skill && s.cooldown <= 0 && p.stamina >= s.cost + reserve; };
      if (bot.skills && target && !threat) {
        if (ready(2) && (near >= 2 || target.boss) && best < 5) input.rage = true;
        else if (ready(1) && (near >= 2 || target.boss) && best < 3.4) input.special = true;
        else if (ready(3) && best > 4.5 && best < 9) { input.fourth = true; input.aimX = target.x; input.aimZ = target.z; }
        else if (ready(0) && best < 3.4) { input.heavy = true; }
      }
      if (target) { input.holdLight = true; input.target = target; input.pointX = target.x; input.pointZ = target.z; }
    }
    return input;
  }
  const hidden = new Set();
  function fight(game, world, g, spawn, bot, o, chapter) {
    // Wake the foes hidden by the previous fight first: respawn() writes the dead list into the checkpoint.
    for (const e of hidden) { e.dead = false; e.hp = e.maxHp; } hidden.clear();
    game.respawn();
    const p = game.player;
    // (A boss elsewhere stays alive and asleep: a dead boss ends the chapter.)
    // Everything outside this encounter sleeps out of the way (no XP, no loot: just hidden and flagged dead).
    for (const e of game.enemies) if (!g.list.includes(e) && !e.boss) { e.dead = true; e.hp = 0; e.active = false; e.model.root.visible = false; e.deadAge = 999; hidden.add(e); }
    const at = approach(world, g.list, spawn);
    p.x = at.x; p.z = at.z; game.player.face = Math.atan2(at.cx - at.x, at.cz - at.z);
    if (g.boss) for (const e of g.list) { e.active = e.activated = true; e.encounter.activated = true; }
    const startHp = p.hp, startFlasks = p.flasks, seen = new Map();
    const stat = { denied: 0 }; let perfect0 = game.perfectDodges || 0, bossStop = false, t = 0, rolls = 0, hits = 0, lastHp = p.hp, damageTaken = 0, biggest = 0, killTimes = [], alive = g.list.filter(e => !e.dead).length, firstContact = -1;
    const counter = n => { rolls += n; };
    const dt = o.dt;
    while (t < o.limit) {
      const live = g.list.filter(e => !e.dead);
      if (!live.length || game.state !== 'playing') break;
      // A boss is stopped at 10 % health (its death would end the chapter and leave the page); the clock is scaled to a full kill.
      if (g.boss && live.some(e => e.boss && e.hp <= e.maxHp * .1)) { bossStop = true; break; }
      if (live.length < alive) { killTimes.push(+t.toFixed(1)); alive = live.length; }
      if (firstContact < 0 && live.some(e => e.active)) firstContact = t;
      const input = decide(game, live, bot, seen, o.seed, stat);
      if (input.dodge) counter(1);
      game.update(dt, input);
      t += dt;
      if (p.hp < lastHp - .01) { hits++; damageTaken += lastHp - p.hp; biggest = Math.max(biggest, lastHp - p.hp); }
      lastHp = p.hp;
    }
    const died = game.state === 'dead' ? 1 : 0, cleared = bossStop || g.list.every(e => e.dead);
    if (bossStop) { t /= .9; for (const e of g.list) if (e.boss) { e.hp = e.maxHp; e.active = false; } }
    const flasksUsed = startFlasks - p.flasks;
    return { index: g.index, name: g.enc.name, boss: g.boss, types: g.list.map(e => e.type + (e.elite ? '*' : '')).join(','), foes: g.list.length,
      died, cleared: cleared ? 1 : 0, timeout: !died && !cleared ? 1 : 0, time: +t.toFixed(1), fightTime: +(t - Math.max(0, firstContact)).toFixed(1),
      hpLost: Math.round(damageTaken), endHp: Math.round(p.hp), flasks: flasksUsed, rolls, hitsTaken: hits, biggestHit: Math.round(biggest), kills: killTimes, denied: stat.denied, perfect: (game.perfectDodges || 0) - perfect0 };
  }
  // Rendered capture: the bot takes over app.js input for the given encounter foes (BABA.app.step keeps drawing). detach() restores it.
  function attach(list, botName) {
    const game = B.app.game, bot = BOTS[botName || 'average'], seen = new Map(), stat = { denied: 0 }, update = game.update;
    game.update = function (dt, input) {
      const live = (list || game.enemies).filter(e => !e.dead && (list || e.active));
      return update.call(game, dt, live.length && game.state === 'playing' ? decide(game, live, bot, seen, 1, stat) : input);
    };
    return { detach() { game.update = update; }, stat };
  }
  B.Balance = { run, attach, bots: BOTS, gear: GEAR, setupProfile, groups, approach };
})();
