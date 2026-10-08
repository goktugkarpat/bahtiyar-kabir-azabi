(function () {
  'use strict';
  const BABA = window.BABA = window.BABA || {};
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  // Frame-rate independent turn toward b along the shortest way round (k = how fast, per second).
  const dampAngle = (a, b, k, dt) => a + angleDifference(b, a) * (1 - Math.exp(-k * dt));
  const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
  // One shared resource contract for combat, HUD and control hints. Weapons leave room for rolls and skills.
  const RESOURCE_SCALE = 100 / 110;
  const RESOURCES = Object.freeze({
    costs: Object.freeze({ light: 0, heavy: 8*RESOURCE_SCALE, dodge: 20*RESOURCE_SCALE, special: 45*RESOURCE_SCALE, rage: 45*RESOURCE_SCALE }),
    cooldowns: Object.freeze({ special: 8, rage: 24 }),
    durations: Object.freeze({ rage: 11 })
  });
  const STATS = {
    prisoner: { name: 'Zincirli Mahkûm', hp: 118, speed: 2.4, radius: .58, reach: 2.5, cooldown: 1.25, color: 0xb77c63 },
    guard: { name: KabirI18n.t('Mezar Muhafızı'), hp: 205, speed: 1.8, radius: .72, reach: 3.4, cooldown: 1.75, color: 0xb49a5f },
    cultist: { name: KabirI18n.t('Kül Rahibi'), hp: 116, speed: 1.85, radius: .54, reach: 12, cooldown: 2.8, color: 0xac5550 },
    stalker: { name: KabirI18n.t('Karanlık Pusucusu'), hp: 130, speed: 3.15, radius: .53, reach: 8.5, cooldown: 1.8, color: 0x978790 },
    carrier: { name: KabirI18n.t('Veba Taşıyıcısı'), hp: 172, speed: 1.5, radius: .74, reach: 10, cooldown: 3.2, color: 0x829665 },
    boss: { name: KabirI18n.t('Zincir Celladı'), hp: 2310, speed: 2.2, radius: 1.03, reach: 13, cooldown: .75, color: 0xc69160 }
  };
  if (BABA.CoastCombat) Object.assign(STATS, BABA.CoastCombat.stats);
  if (BABA.RuinsCombat) Object.assign(STATS, BABA.RuinsCombat.stats);
  if (BABA.ForgeCombat) Object.assign(STATS, BABA.ForgeCombat.stats);
  if (BABA.FinaleCombat) Object.assign(STATS, BABA.FinaleCombat.stats);   // chapter V (finale-combat.js): stats carry forge:true + finale:true
  // Stronger enemies resist an unbuffed full Girdap; the boss has faster, explicitly timed normal moves.
  // Apply health once at spawn and damage once at contact so every enemy move follows the same balance.
  const BALANCE = Object.freeze({ health: 1.65, bossHealth: 1.50, damage: 1.70 });
  // Combat feel. Strike times, durations and damage stay authoritative; these shape how contact is presented.
  // Hit-stop freezes every combat clock together (player, enemies, hazards, i-frames), so it never grants an advantage.
  const FEEL = {
    buffer: .22, chainEarly: .12, finisherChainEarly: .06, queueAfter: .06,
    hitstop: { light: .014, finisher: .030, heavy: .038, extraTarget: .003, kill: .006, bossKill: .012, shield: .010, guardBreak: .044,
      hurt: .012, hurtHeavy: .026 },
    knock: { light: .32, finisher: .62, heavy: 1.05, shield: .12, boss: .05, bossHeavy: .16 },
    lunge: [.34, .42, .56], heavyLunge: .72, lungeLead: [.12, .12, .14], heavyLungeLead: .2,
    whoosh: { light: .09, finisher: .11, heavy: .15 },
    // How fast the body swings round to the facing the game decided on (per second): walking, aimed swing, roll.
    turn: { walk: 16, swing: 24, roll: 30 },
    // Blade direction at contact relative to facing (radians): slashes sweep across, the finisher chops forward.
    sweep: [Math.PI / 2, -Math.PI / 2, 0], heavySweep: Math.PI / 2
  };
  // Difficulty profiles, stamina economy and the heavier hit feel live in combat-tuning.js (numbers measured with combat-balance.js).
  const TUNE = BABA.CombatTuning || null, ECON = TUNE ? TUNE.ECONOMY : null;
  if (TUNE) { Object.assign(FEEL.hitstop, TUNE.FEEL.hitstop); Object.assign(FEEL.knock, TUNE.FEEL.knock); }
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  // Fairness contract (COMBAT_PLAN §1): every strike's ground tell is fixed once visible; openers warn >= .55 s
  // (crimson "unblockable" = severe blows >= .95 s), follow-ups >= .45 s; two different enemies never land within RHYTHM of each other near
  // the hero, and only one normal-enemy unblockable strike may be pending near the hero in any +-TOKEN window.
  const TELL_LEAD = .18, RHYTHM = .3, TOKEN = .8, NEAR = 7;
  // Early halls teach one thing at a time: the first prisoners only use the gold (ordinary) moves. (The hero has no block any more: the
  // field name `unblockable` stays, it now means "severe, crimson tell: dodge it"; gold tells are ordinary blows, dodge them too if you can.)
  const GATES = { threshold: { prisoner: ['claw', 'lash'] } };
  // The father's heavy blow (was 1.05 s with contact at .57 s and a held coil): contact at .35 s, the feet free again right after it.
  // beginAttack applies these on top of the light-chain numbers; the swing sound is scheduled from the press (audio.js H.heavy
  // builds up to contact), so it fires at once; the step into the blow starts .15 s before contact.
  const HEAVY = { duration: .45, strike: .14, lungeLead: .08 };
  // Flask: the heal lands on the press; the drink is only a short upper-body flourish (DRINK s) that never holds input.
  // A second press inside DRINK_GUARD s of a drink is ignored, so one press (or a double-fired tap) cannot burn two flasks.
  const DRINK = .34, DRINK_GUARD = .2;
  // Roll (Space): stamina cost and how long of its .48 s the hero cannot be hit; stamina regeneration per second (all in the D4-controls compensation).
  const DODGE = { cost: RESOURCES.costs.dodge, iframe: .45 }, REGEN = 12;
  // Diablo-4 click-target controls (steerOrders): a click on a foe walks up to it and swings (light left / heavy right), a click on the ground walks there,
  // Shift + click swings in place toward the cursor. reach = distance to the foe's edge at which the swing starts; arrive = stop distance of a ground click,
  // hold = the same while the button is held (steering); stuck = seconds without progress before an approach is given up.
  const ORDER = { reach: 2.6, reachHeavy: 3.0, arrive: .3, hold: .8, stuck: .7 };
  // Hero war cry: the roar releases its shockwave at ROAR.release; the father is committed until ROAR.duration
  // (quick: he keeps moving at ROAR.move of his speed and the blows-halved window is only this long).
  // Kan öfkesi: wider shockwave (near 6.5 m stagger / far 10 m cow), 11 s buff, -25 % damage taken (guard .75), 4 % of damage dealt returns as hp (steal);
  // while it burns, blows stagger lighter foes (see canStagger). The cry uses the same stamina as rolls/Girdap,
  // with its own cooldown; there is no separate fury meter to fill by fighting.
  const ROAR = { cost: RESOURCES.costs.rage, cooldown: RESOURCES.cooldowns.rage, duration: .36, release: .08, move: .6,
    near: 6.5, far: 10, time: RESOURCES.durations.rage, guard: .75, steal: .04 };
  // Special ability "Zincir Girdabı" (key 1, a whirlwind): the father spins with the chained cleaver for SPECIAL.duration s, walks on at SPECIAL.move of his speed
  // (steer with the movement keys) and hits every foe within SPECIAL.radius m SPECIAL.ticks times (first after SPECIAL.first s, then every SPECIAL.gap s) for SPECIAL.damage each
  // (ticks x damage = 132, what the old lane strike did). Ticks stagger small foes (SPECIAL.stagger s, the last one SPECIAL.staggerLast s and a knock-back), pull loose ones a
  // little inward (SPECIAL.pull m), break guards and give bosses only damage. Armoured: light hits do not stop it, a stagger (broken guard) or a roll does. It costs
  // SPECIAL.cost stamina (of 110) and rests SPECIAL.cooldown s. SPECIAL.turns full body turns are shown.
  const SPECIAL = { cost: RESOURCES.costs.special, cooldown: RESOURCES.cooldowns.special, duration: 1.3, radius: 3.6, ticks: 4, first: .15, gap: .28, damage: 33, stagger: .6, staggerLast: 1.15, pull: .45, fling: .9, grow: 1, move: .6, turns: 2 };
  // The whirl and war-cry numbers above are tier 1 (Zincir Kasırgası / Kan Nidası). useSkill() overwrites SPECIAL / ROAR with the learned tier's params
  // (progression.js skills[].params) before each cast; the BASE copies keep the fields a tier does not set.
  const SPECIAL_BASE = Object.assign({}, SPECIAL), ROAR_BASE = Object.assign({}, ROAR, { stun: 1.35, fear: 2.2, damage: 0, waves: 1, waveDamage: 0, tier: 1 });
  Object.assign(ROAR, ROAR_BASE);
  // Per-tier shape of the cry (index = tier - 1): the roar releases at `release`, the hero is committed until `duration` and walks on at `move` of his speed meanwhile.
  // Tier 3 is two-staged: the first scream at .12 s, the follow-up rings every .34 s after it (stepRoarWaves). LEAP_AIR = seconds the tier-3 heavy strike spends in the air.
  const SHOUT_TIME = { release: [.08, .10, .12], duration: [.36, .84, 1.34], move: [.6, .4, .2] }, LEAP_AIR = .20, LEAP_HEIGHT = 1.15;
  // Test-build ease (29 Sep 2026; DESIGN.md "Enemy difficulty" has the measurements). Before -> after:
  //   executioner hp (STATS) 2280 -> 2100 and rest between two of his moves 1.25 -> 1.3 s; the five common foes keep their hp and pace
  //   (a few percent of hp changes no hit count, the special gate below is what lightens the halls).
  //   blows that land on the hero (scaled in hitPlayer; the strike tables and the tell / heavy-hit thresholds keep their numbers):
  //   x1 -> x1 (common foes: the special gate alone lightens the halls by about a third), executioner x1 -> x.88. Tells are untouched: no wind-up got shorter, blockable / must-dodge rules are as before.
  // D4 controls (the hero has no block / parry any more, see DESIGN.md "Diablo-4 controls"): to pay for the lost defence blows on the hero are
  // scaled down (x1 -> x.72 common foes, x.88 -> x.64 executioner; the -12 % first asked for left the scripted dodging bot losing +75 % hp, see DESIGN.md), the roll costs
  // 20 stamina (was 25) and its i-frames last .45 s of .48 (was .39), energy regenerates continuously at 12/s; repeated skills still drain it.
  const EASE = { damage: .72, bossDamage: .64 };   // (was .92 for common foes: scripted bots showed -23..-35 % hp lost in total, above the ~-20 % asked for)
  // Special abilities (move options flagged sp) are the exception, the plain blows (claw, bash, cleave, swing...) are the rule: after a special
  // an enemy owes SPECIAL_GAP plain blows before it may use another one, and an allowed special weighs SPECIAL_W of its table weight.
  // Before: no gate and full weights (specials were 40-87 % of all chosen moves). Cooldowns of single specials, before -> after (s):
  // prisoner grab 7 -> 14, cultist rite 14 -> 18 and pair 12 -> 16, executioner hooks 13 -> 15 (last stand 9 -> 11).
  // A fresh enemy owes one plain blow first (spWait 1), except the prisoner, whose charge is how it enters a fight.
  const SPECIAL_GAP = { prisoner: 1, guard: 1, cultist: 1, stalker: 1, carrier: 1, boss: 1, boss2: 1 }, SPECIAL_W = .9;
  // Round 2 (specials still felt constant): min 3 plain blows between specials (SPECIAL_GAP, then SPECIAL_W .5); a special that is the ONLY legal move
  // (hero kiting out of plain range) is not taken at once: the foe first chases for SPECIAL_HOLD seconds; plain blows recover in .75 of the
  // rest time, specials in 1.2 of it (SPECIAL_IDS lists the specials for that).
  const SPECIAL_HOLD = 1.5, PLAIN_REST = .62, SPECIAL_REST = .9;
  const SPECIAL_IDS = ['rush', 'grab', 'over', 'shove', 'rite', 'pair', 'rune', 'leap', 'flank', 'vial', 'exhale', 'hook', 'slam', 'cyclone', 'hooks', 'waterLunge', 'gurgle', 'rootRows', 'rootCrown', 'skitter', 'brine', 'falseLights', 'tide', 'bells', 'ashTrail', 'caveLeap', 'stoneCrown', 'hollowPulse', 'fall', 'fissures', 'shards', 'chainLanes', 'piston', 'vents', 'bellows', 'slagLeap', 'furnaceCrown'];
  SPECIAL_IDS.push('pull', 'orbs', 'rite', 'lanterns', 'toll', 'tides');   // round 7 (boss-mech.js / bossAttack / coast-combat.js)
  SPECIAL_IDS.push('kingRush', 'bellRush', 'orbs', 'crystalStar', 'hollowNova', 'hollowBurrow', 'hollowEcho', 'hollowCall', 'wardenOrb', 'wardenBurrow', 'lavaLanes', 'slagOrbs', 'anvilSlam', 'furnaceClock', 'overheatDash', 'furnaceCall', 'drownedCall', 'ashLava', 'ashDash');   // round 7 (boss2.js)

  function create(world, services) {
    const scene = services.scene;
    const SAVE_KEY = 'baba.kabir.campaign.v1';
    const chapter = Math.max(1, Math.min(BABA.FINAL_CHAPTER || 5, world.chapter || 1)), FINAL = BABA.FINAL_CHAPTER || 5;
    const emit = (name, data) => { if (services.emit) services.emit(name, data || {}); };
    const sound = (name, opts) => { if (services.sound) services.sound(name, opts || {}); };
    const fx = (name, data) => { if (services.fx) services.fx(name, data || {}); };
    const root = new THREE.Group(); root.name = 'KaraGecitCombat'; scene.add(root);
    const hero = BABA.Models.create('hero'); root.add(hero.root);
    const limbs = BABA.Limbs ? BABA.Limbs.create(root, world, { fx, sound, emit }) : null;   // dismemberment of killed foes (limbs.js)
    const spawn = finitePoint(world.spawn) ? world.spawn : { x: 0, z: 7 };
    const checkpoint = finitePoint(world.checkpoint) ? world.checkpoint : { x: 0, z: -128 };
    const player = {
      x: spawn.x, z: spawn.z, face: Math.PI, yaw: Math.PI, hp: 100, maxHp: 100, effectiveMaxHp:95,
      stamina: 100, maxStamina: 100,
      flasks: 4, maxFlasks: 4, dead: false, model: hero,
      attack: null, dodge: 0, healing: 0, rageTime: 0,
      hurt: 0, stagger: 0, status: '', invulnerable: false, target: null
    };
    const enemies = [], hazards = [], seals = [];
    const propContacts = [], noPropTargets = [];   // Authored contact footprints, consumed once by the boss machinery in this frame.
    function propContact(x, z, radius, units, face = 0, arc = Math.PI * 2, ox = x, oz = z) {
      if (mech && game.state === 'playing' && !player.dead) propContacts.push({ x, z, radius, units, face, arc, ox, oz });
    }
    let hazardSerial = 0, mech = null, boss2 = null, director = null, mobMods = null, mobAbil = null;   // director: boss-framework.js (intros, pursuit, perfect dodge, signatures); mobMods: mob-mods.js (champions)   // boss2: chapter III / IV boss machinery (boss2.js);   // mech: boss-mech.js (round 7 orbs / ritual anchors / fight clock), built next to the executioner's moves
    const globes = BABA.Globes ? BABA.Globes.create(root, world, { player, fx, sound, emit }) : null;   // health globes dropped by dead foes (globes.js)
    const encounterDefs = (world.encounters || []).map((encounter, index) => ({
      id: String(encounter.id == null ? index : encounter.id), room: encounter.room, stage: encounter.stage,
      name: encounter.name || KabirI18n.t('Karanlık Geçit'), clearText: encounter.clearText || KabirI18n.t('Salon sustu. Yol mührü açıldı.'), activated: false, announced: false,
      roomName: ((world.rooms || []).find(room => String(room.id) === String(encounter.room)) || {}).name || encounter.name || KabirI18n.t('Karanlık Geçit'),
      nextName: ((world.rooms || [])[(world.rooms || []).findIndex(room => String(room.id) === String(encounter.room)) + 1] || {}).name || '',
      spawns: (encounter.spawns || []).filter(s => STATS[s.type]), enemies: []
    }));
    if (BABA.Boss2 && chapter >= 2) BABA.Boss2.reserve(chapter, encounterDefs);   // dormant adds of the boss fights (boss2.js)
    const game = {
      player, enemies, hazards, state: 'ready', checkpointIndex: 0,
      elapsed: 0, kills: 0, totalKills: 0, lastDeath: null, hasSave: false,
      currentRoom: null, activeEncounter: '', boss: null, attackTarget: null,
      get pendingBossReward() {
        if (disposed || endAnnounced || !game.boss || !game.boss.dead) return null;
        const drop = pendingFinalBossReward(game.boss);
        return drop && Number.isFinite(drop.x) && Number.isFinite(drop.z) ? Object.freeze({ x: drop.x, z: drop.z, uid: drop.uid, id: drop.id }) : null;
      },
      start, update, restart, newCampaign: restart, respawn, interact, dispose, setQuality, setDifficulty, difficulty: 'normal', toTitle, beginRenderTraversal, endRenderTraversal, prepareGraphics, propTargets: () => mech && mech.pickTargets ? mech.pickTargets() : noPropTargets
    };
    game.hero = hero;   // (ajan:secondary) QA / tooling handle
    const skillKeys = ['heavy', 'special', 'rage', 'fourth'];   // right mouse, key 1, key 2, key 3 (slot index = loadout index)
    const SKILLS = Object.freeze(Object.fromEntries(BABA.Progression.skills.map(skill => [skill.id, skill])));
    const skillReach = Object.freeze({ cleave: 3, brand: 6.5, temper: 6.7, roar: 6, quake: 6, chainstorm: 6.5, whirl: 3.3, reap: 3.8, rend: 4.4, charge: 8, grasp: 10, havoc: 12, hook: 8, guard: 1 });
    const skillCooldowns = Object.create(null);
    let roarWaves = null;   // pending follow-up rings of the tier-3 war cry
    const progression = BABA.Progression.create({ chapter, emit, groundLoot:true });
    let appliedLevel = progression.level;
    game.progression = progression;
    // Talent tree 4 (src/talent-runtime.js): bleed, Çengelli Çekiş + Demir Duruş (barbarian actives), passives and keystones.
    const talents = BABA.TalentRuntime ? BABA.TalentRuntime.create({ game, player, enemies, progression, root, fx, sound, emit, groundY: (x, z) => world.effectHeightAt ? world.effectHeightAt(x, z, .6) : .06,
      strike: (e, amount, face) => { if (!e || e.dead) return null; if (!e.active) { e.active = true; e.activated = true; if (e.encounter) e.encounter.activated = true; } return hurtEnemy(e, Math.round(amount), true, face, { talent: true, combo: 0, face, heavy: true, gained: 99 }); },   // gained: talent bursts never refill the stamina orb (ECONOMY.HIT)
      dot: (e, amount, kind) => talentTick(e, amount, kind), stun: (e, s) => stunEnemy(e, s, 'heavy'),
      yank: (e, x, z, keep) => { const d = Math.hypot(x - e.x, z - e.z); if (d > keep) { e.push = null; moveBody(e, (x - e.x) / d * (d - keep), (z - e.z) / d * (d - keep), e.radius); } },
      canHit: e => !!e && !e.dead && !enemyUnderground(e) && e.model.root.visible && clearStrike(player, e) }) : null;
    game.talents = talents;
    /* ajan:gear */ if (talents && BABA.GearPowers) BABA.GearPowers.attach(talents, { game, player, enemies, progression, root, sound, emit, groundY: (x, z) => world.effectHeightAt ? world.effectHeightAt(x, z, .6) : .06, hurtEnemy: (...a) => hurtEnemy(...a), stunEnemy: (...a) => stunEnemy(...a), talentTick: (...a) => talentTick(...a) });
    // A damage-over-time tick: no knock-back, no stagger, no on-hit procs; numbers and kills as usual.
    function talentTick(enemy, amount, kind) {
      if (!enemy || enemy.dead || enemyUnderground(enemy) || game.state !== 'playing') return null;
      if (!enemy.active) { enemy.active = true; enemy.activated = true; if (enemy.encounter) enemy.encounter.activated = true; }
      let damage = Math.max(1, Math.round(amount * (player.damageMultiplier || 1)));
      { const P = tuning(); damage = Math.max(1, Math.round(damage * (P ? P.playerDmg : game.difficulty !== 'hard' ? 1.18 : 1))); }   // same difficulty scale as hurtEnemy
      if (talents) damage = talents.outgoing(enemy, damage, null);
      if (mobMods) damage = mobMods.hurt(enemy, damage, false, false, true);   // armoured / warded champions also dampen burn and bleed
      if (director && enemy.boss) damage = director.hurt(enemy, damage);
      enemy.hp = Math.max(0, enemy.hp - damage); if (enemy.boss && !enemy.action) enemy.wrath += damage;
      const killed = enemy.hp <= 0;
      fx('talentTick', { x: enemy.x, y: 1.4, z: enemy.z, damage, kind, labelTarget: enemy, kill: killed });
      if (killed) { enemy.deathKind = ''; killEnemy(enemy); } else enemyPhaseChange(enemy);
      return { killed };
    }
    const groundLoot = BABA.GroundLoot ? BABA.GroundLoot.create(root, world, {player, progression, chapter, sound, fx, emit, onCollect:saveProfileChoices,
      isFinalReward: drop => !!(game.boss && game.boss.dead && drop.uid === 'drop-' + chapter + ':' + game.boss.id), bossDead: () => !!(game.boss && game.boss.dead)}) : null;
    game.groundLoot = groundLoot;
    game.syncProgression = syncProgression;
    game.criticalChance = .08; game.criticalMultiplier = 1.5;
    game.useSkill = useSkill;
    game.debugHurt = (e, dmg, heavy, face) => hurtEnemy(e, dmg, !!heavy, face == null ? angleTo(player, e) : face, { combo: heavy ? 0 : 1, face: face == null ? angleTo(player, e) : face });   // test hook: a real hit through the whole pipeline (QA frame sequences)
    game.saveProfileChoices = saveProfileChoices;
    game.skills = () => skillKeys.map((key, slot) => {
      const skill = selectedSkill(slot);
      return { slot, key, skill, id: skill ? skill.id : null, line: skill ? skill.line : null, tier: skill ? skill.tier : 0, name: skill ? skill.name : KabirI18n.t('Boş yuva'), cooldown: skill ? skillCooldowns[skill.line] || 0 : 0, maxCooldown: skill ? skill.cooldown : 0, cost: skill ? skill.cost : 0 };
    });
    function saveProfileChoices() {
      // Victory has no living checkpoint foes to duplicate. Ordinary runs retain the authoritative oath snapshot.
      if (game.state !== 'won') {
        if (!checkpointSnapshot || game.state === 'ready') return false;
        checkpointSnapshot = Object.assign({},checkpointSnapshot,{
          dead:enemies.filter(e=>e.dead).map(e=>e.id), kills:game.kills, elapsed:game.elapsed,
          progression:progression.snapshot(), quests:quests ? quests.snapshot() : null, ongoing:true
        });
        saveCheckpoint(); return true;
      }
      try {
        const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY));
        if (!saved || saved.version !== 3 || !(saved.chapter >= 2 && saved.chapter <= FINAL) || (!saved.transition && !saved.completed)) return false;
        saved.progression = progression.snapshot();
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
        return true;
      } catch (_) { return false; }
    }
    // The skill module owns pooled motion/pose state: dropping only the handle would leave it active.
    function cancelPlayerCharge() {
      const handle = player.chargeHandle;
      if (!handle) return;
      if (handle.cancel) handle.cancel();
      player.chargeHandle = null;
      if (player.attack && player.attack.line === 'charge') player.attack = null;
      player.invulnerable = false;
    }
    function selectedSkill(slot) {
      const state = progression, id = state.loadout[slot];
      const skill = id && state.learned.includes(id) ? SKILLS[id] || null : null;
      return skill && talents ? talents.effective(skill) : skill;
    }
    function syncProgression(fill) {
      const stats = progression.stats();
      const wasMax = player.effectiveMaxHp || stats.maxHp, woundHp = player.hp * wasMax / 100;
      player.maxHp = 100; player.effectiveMaxHp = stats.maxHp;
      if (talents && !BABA.QuestSide) { player.maxFlasks = talents.maxFlasks(4); player.flasks = Math.min(player.flasks, player.maxFlasks); }   // with quest-side.js the flask capacity is set there (it adds the talent delta)
      player.damageMultiplier = stats.damageMultiplier; player.defense = stats.defense;
      // Preserve the original effective wounds and growth: 100 is the health unit, not a loss of gear strength.
      const levelHeal = progression.level > appliedLevel ? Math.max(0, stats.maxHp - wasMax) : 0;
      player.hp = fill ? 100 : Math.min(100, (woundHp + levelHeal) * 100 / stats.maxHp); appliedLevel = progression.level;
      if (hero.setEquipment) hero.setEquipment({ weaponType: stats.weaponType, weaponId: stats.weaponId, headId: progression.itemForSlot('head')?.id || null, chestId: progression.itemForSlot('chest')?.id || null, handsId: progression.itemForSlot('hands')?.id || null, bootsId: progression.itemForSlot('boots')?.id || null });
      emit('progression', { state: progression, stats });
    }
    function skillAim(hasAim) {
      if (swingPlan) player.face = swingPlan.enemy ? angleTo(player, swingPlan.enemy) : swingPlan.face;
      else if (hasAim && aimFace !== null) player.face = aimFace;
      else if (rawInput && !rawInput.padActive && Number.isFinite(rawInput.pointX) && Number.isFinite(rawInput.pointZ) && Math.hypot(rawInput.pointX - player.x, rawInput.pointZ - player.z) > .4) player.face = Math.atan2(rawInput.pointX - player.x, rawInput.pointZ - player.z);
      else if (moveFace !== null) player.face = moveFace;
    }
    // ---- Charge (Kara Adım line): the dash lives in src/charge.js (BABA.Charge.begin(ctx, tier), contract in its header). This file builds the ctx:
    //   player, game, world { move (collision-solved, seals respected), isWalkable }, enemies, target (cursor floor point, clamped to [CHARGE_MIN, params.range]),
    //   fx, sound(name, pos), emit, now, stats (progression numbers: range, damage, impactRadius, stunSeconds, pathDamage, second*), damage(enemy, amount, opts) (heavy hit,
    //   gear / crit / rage multipliers, wakes the foe), stun(enemy, s) (bosses ignore it), push(enemy, dx, dz, force), plus tier / params / skill / move / canHit / hitStop.
    //   The returned instance { duration, update(dt) -> true when done, cancel(), invulnerable, noKnockback, impacted, impactX, impactZ } is ticked by chargeStep().
    //   Without BABA.Charge the fallbackCharge() below runs (dash, path hits, one impact, tier 3 a second).
    const CHARGE_MIN = 3;
    function chargeTarget(skill, hasAim) {
      const range = skill.params.range; let tx, tz;
      if (!hasAim && swingPlan && swingPlan.enemy) { tx = swingPlan.enemy.x; tz = swingPlan.enemy.z; }
      else if (!hasAim && rawInput && !rawInput.padActive && Number.isFinite(rawInput.pointX) && Number.isFinite(rawInput.pointZ)) { tx = rawInput.pointX; tz = rawInput.pointZ; }
      else { tx = player.x + Math.sin(player.face) * range; tz = player.z + Math.cos(player.face) * range; }
      let dx = tx - player.x, dz = tz - player.z, d = Math.hypot(dx, dz);
      if (d < .5) { dx = Math.sin(player.face); dz = Math.cos(player.face); d = 1; }
      const k = clamp(d, CHARGE_MIN, range) / d;
      player.face = Math.atan2(dx, dz);
      return { x: player.x + dx * k, z: player.z + dz * k };
    }
    function stunEnemy(e, seconds, kind) {
      if (e.dead || e.boss || !(seconds > 0)) return;
      if (seconds > (e.stagger || 0)) { e.stagger = e.staggerTotal = seconds; e.staggerVariant = (attackSerial + e.index) % 3; }
      e.staggerKind = kind || 'heavy'; e.action = null; e.faceLocked = false; e.shield = false;
      e.poiseRecovery = Math.max(e.poiseRecovery || 0, 2.2); e.cooldown = Math.max(e.cooldown, 1.2); cancelHazards(e, true);
    }
    const chargeWorld = { move: (pos, dx, dz, radius) => moveBody(pos, dx, dz, radius), isWalkable: (x, z, r) => !world.isWalkable || world.isWalkable(x, z, r) };
    function chargeContext(skill, target, attack) {
      const P = skill.params;
      return {
        player, game, world: chargeWorld, enemies, tier: skill.tier, params: P, skill: skill.id, target, fx, sound, emit(name, data) {
          if (name === 'impact') propContact(data.x, data.z, data.radius, 3);
          emit(name, data);
        }, now: simTime,
        stats: { range: P.range, dashTime: P.range / (P.speed || 20), damage: P.damage, ringDamageMul: P.ringMul, impactRadius: P.radius, stunSeconds: P.stun, pathDamage: P.pathDamage, second: P.impacts > 1,
          pathWidth: P.width || 1.5, pathShove: P.shove || 0, knock: P.knock || 2.6, hitStop: P.hitStop || .07, secondDamage: P.damage2 || 0, secondRadius: P.radius2 || P.radius, cost: skill.cost, cooldown: skill.cooldown },
        damage(enemy, amount, opts) {
          if (!enemy || enemy.dead) return null;
          if (!enemy.active) { enemy.active = true; enemy.activated = true; if (enemy.encounter) enemy.encounter.activated = true; }
          return hurtEnemy(enemy, Math.round(amount * (player.rageTime > 0 ? 1.48 : 1)), true, opts && Number.isFinite(opts.face) ? opts.face : attack.face, attack);
        },
        stun(enemy, seconds) { stunEnemy(enemy, seconds, 'heavy'); },
        push(enemy, dx, dz, force) {
          if (enemy && !enemy.dead && force > 0 && (dx || dz)) {
            const direction=Math.atan2(dx,dz);enemy.push=null;push(enemy,direction,enemy.boss?force*.3:force);
            // Tier III displacement carries a brief airborne reaction, never a standing slide.
            // Walls still constrain the same ground capsule; bosses retain their immunity.
            if(skill.tier===3&&!enemy.boss&&force>1){
              enemy.launchAt=simTime;enemy.launchDirection=direction;enemy.launchHeight=Math.min(.65,.24+force*.055);
              stunEnemy(enemy,.40,'heavy');
            }
          }
        },
        move(dx, dz) { moveBody(player, dx, dz, hero.radius || .5); },
        canHit(enemy) {
          return !!enemy && !enemy.dead && !enemyUnderground(enemy) && enemy.model.root.visible && clearStrike(player, enemy);
        },
        hitStop
      };
    }
    function fallbackCharge(ctx) {
      const P = ctx.params, p = ctx.player, sx = p.x, sz = p.z, tx = ctx.target.x - sx, tz = ctx.target.z - sz, total = Math.max(.5, Math.hypot(tx, tz)), ux = tx / total, uz = tz / total;
      const dash = Math.max(.2, total / P.speed), gap = .36, duration = dash + .12 + (P.impacts > 1 ? gap : 0) + .22;
      const hit = new Set(); let t = 0, travelled = 0, dashing = true, landed = 0;
      const inst = { duration, impacted: false, impactX: 0, impactZ: 0, invulnerable: false, noKnockback: false, cancel() {} };
      function impact(n, amount, radius) {
        const R = radius, shudder = [];
        ctx.fx('strike', { x: p.x, z: p.z, face: p.face, radius: R, shape: 'circle', style: 'quake', scar: true, heavy: true });
        for (const e of ctx.enemies) {
          if (e.dead || !e.model.root.visible) continue;
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d > R + e.radius * .6 || !ctx.canHit(e)) continue;
          const r = ctx.damage(e, amount * (d < 1.6 ? 1 : P.ringMul)); if (!r) continue;
          if (!r.killed) { ctx.stun(e, P.stun); ctx.push(e, e.x - p.x, e.z - p.z, .5 + .7 * (1 - Math.min(1, d / R))); shudder.push({ body: e, model: e.model, amp: .08 }); }
        }
        ctx.hitStop(.008, shudder); ctx.sound('heavyHit', { x: p.x, z: p.z }); ctx.emit('impact', { x: p.x, z: p.z, strength: 1, radius: R });
        inst.impacted = true; inst.impactX = p.x; inst.impactZ = p.z;
      }
      inst.update = function (dt) {
        t += dt;
        if (dashing) {
          const step = Math.min(P.speed * dt, total - travelled), bx = p.x, bz = p.z;
          ctx.move(ux * step, uz * step);
          const moved = Math.hypot(p.x - bx, p.z - bz); travelled += moved;
          if (P.pathDamage) for (const e of ctx.enemies) {
            if (e.dead || hit.has(e.id) || !ctx.canHit(e) || Math.hypot(e.x - p.x, e.z - p.z) > .95 + e.radius) continue;
            hit.add(e.id); const r = ctx.damage(e, P.pathDamage); if (r && !r.killed) { ctx.stun(e, .5); ctx.push(e, e.x - p.x, e.z - p.z, .7); }
          }
          if (moved < step * .35 || travelled >= total - .02) {
            dashing = false; ctx.fx('heroSkill', { skill: 'charge', phase: 'release', x: sx, y: .1, z: sz, face: p.face, length: Math.hypot(p.x - sx, p.z - sz), width: 1.8, duration: .35 });
            impact(0, P.damage, P.radius); landed = 1;
          }
        } else if (P.impacts > 1 && landed === 1 && t >= dash + gap) { landed = 2; impact(1, P.damage2, P.radius2); }
        return t >= duration;
      };
      return inst;
    }
    function useSkill(slot, hasAim) {
      const key = skillKeys[slot], skill = selectedSkill(slot);
      if (!key || game.state !== 'playing' || player.dead) return false;
      // A held mouse order retries readiness quietly; only a fresh press reports denial to the HUD.
      if (swingPlan && swingPlan.order && swingPlan.order.held && !swingPlan.order.owed &&
        (!skill || (skillCooldowns[skill.line] || 0) > FEEL.buffer || player.stamina < skill.cost)) return false;
      if (!canQueueAbility(key)) { if (swingPlan && swingPlan.order) swingPlan.order.owed = false; return false; }
      if (!skill || (skillCooldowns[skill.line] || 0) > 0 || player.dodge || player.stagger > 0) return false;
      // A ready ability takes priority over a basic swing or a cry's recovery.
      // Validate first so an unavailable skill cannot cancel the current action.
      if (player.attack && !player.attack.skill && !player.attack.whirl) player.attack = null;
      if (player.roar && player.roar.released) player.roar = null;
      if (player.attack || player.roar) return false;
      skillAim(hasAim);
      let started = false;
      const P = skill.params;
      if (skill.line === 'cleave' && skill.tier === 1) {
        // The old heavy animation now belongs exclusively to this learned active skill.
        const savedPlan = swingPlan;
        if (!swingPlan) swingPlan = { stand: true, face: player.face };
        started = beginAttack(true, hasAim, true);
        if (started) { player.stamina -= skill.cost - RESOURCES.costs.heavy; Object.assign(player.attack, { skill: skill.id, line: skill.line, tier: skill.tier, params: P, damage: P.damage, radius: P.radius, arc: P.arc }); }
        else swingPlan = savedPlan;
      } else if (skill.line === 'whirl') {
        Object.assign(SPECIAL, SPECIAL_BASE, { cost: skill.cost, cooldown: skill.cooldown, ticks: P.ticks, damage: P.damage, radius: P.radius, first: P.first, gap: P.gap, duration: P.duration,
          stagger: P.stun, staggerLast: P.stunLast, pull: P.pull, fling: P.fling, grow: P.grow, move: P.move, turns: P.turns, tier: skill.tier });
        player.specialCd = 0; started = beginSpecial(hasAim);
        if (started) { Object.assign(player.attack, { skill: skill.id, line: skill.line, tier: skill.tier }); player.specialCd = player.specialMax = skill.cooldown; }
      } else if (skill.line === 'roar') {
        Object.assign(ROAR, ROAR_BASE, { cost: skill.cost, cooldown: skill.cooldown, near: P.near, far: P.far, time: P.time, guard: P.guard, steal: P.steal, stun: P.stun, fear: P.fear, damage: P.damage, waves: P.waves, waveDamage: P.waveDamage || 0, tier: skill.tier,
          release: SHOUT_TIME.release[skill.tier - 1], duration: SHOUT_TIME.duration[skill.tier - 1], move: SHOUT_TIME.move[skill.tier - 1] });
        player.rageCd = 0; started = startWarCry();
        if (started) player.rageCd = player.rageMaxCd = skill.cooldown;
      } else if (talents && talents.isActive(skill)) {
        if (skill.line === 'hook') {
          // Çengelli Çekiş: a lashing throw of the chained hook (pose: authored-motion 'skillMove'); the bite lands .24 s in (talent-runtime.js). No foe in the cone: nothing is spent.
          const targets = talents.hookTargets(skill, player.face);
          if (!targets || !targets.length) emit('toast', { text: KabirI18n.t('Çengel için önünde düşman yok.') });
          else {
            player.attack = { skill: skill.id, line: 'hook', tier: 1, params: P, heavy: true, combo: 0, age: 0, duration: .62, strike: .24, hit: true, face: player.face, damage: 0, radius: 0, serial: ++attackSerial,
              queued: null, lunge: 0, lunged: 1, lungeLead: .1, whooshed: true, whooshAt: 99, originX: player.x, originZ: player.z, victims: new Set(), skillMove: 'chain' };
            player.attack.chainAt = player.attack.duration; player.stamina -= skill.cost; started = talents.cast(skill, player.face, targets);
          }
        } else {
          // Demir Duruş: the hero plants his feet in the war-cry body (no shout, no shockwave: the pose is released at once), the stance itself lives in talent-runtime.js.
          Object.assign(ROAR, { tier: 1, release: .1, duration: .75, move: .55 });
          player.attack = null; player.healing = 0; healingAge = 0; comboStep = 0; comboWindow = 0;
          player.roar = { age: 0, released: true, serial: ++attackSerial, gather: ROAR.release };
          player.stamina -= skill.cost; started = talents.cast(skill, player.face);
        }
      } else if (skill.line === 'charge') {
        const target = chargeTarget(skill, hasAim), attack = { skill: skill.id, line: 'charge', tier: skill.tier, params: P, heavy: true, combo: 0, age: 0, duration: .5, strike: .2, hit: true, face: player.face,
          damage: P.damage, radius: 0, serial: ++attackSerial, queued: null, lunge: 0, lunged: 1, lungeLead: .1, whooshed: true, whooshAt: 99, originX: player.x, originZ: player.z, victims: new Set() };
        const ctx = chargeContext(skill, target, attack);
        const handle = BABA.Charge && BABA.Charge.begin ? BABA.Charge.begin(ctx, skill.tier) : fallbackCharge(ctx);
        if (handle) {
          attack.duration = Math.max(.2, handle.duration || .5); attack.chainAt = attack.duration; attack.face = player.face; player.attack = attack; player.chargeHandle = handle;
          player.stamina -= skill.cost; started = true;
          if (!BABA.Charge) sound('dodge', { x: player.x, z: player.z });
        } else if (BABA.Charge) emit('toast', { text: KabirI18n.t('Hücum için yeterli yol yok.') });
      } else {
        // Strike-type heavy skills (tier 2 / 3 of the cleave line): a wind-up, then a delayed ground blast (brand) or a wide flame fan (temper).
        player.attack = { skill: skill.id, line: 'cleave', tier: skill.tier, params: P, heavy: true, combo: 0, age: 0, duration: P.duration, strike: P.strike, hit: false, face: player.face, damage: P.damage, radius: 0,
          serial: ++attackSerial, queued: null, lunge: 0, lunged: 1, lungeLead: .1, whooshed: true, whooshAt: 99, chainAt: P.duration,
          originX: player.x, originZ: player.z, pulses: 0, victims: new Set() };
        if (skill.tier >= 3) {   // Kabir Balyozu: a leap forward (the body travels during LEAP_AIR before the strike, see the lunge step) and a ground pound where he lands
          let room = 2.6;
          for (const e of enemies) {
            if (e.dead || !e.model.root.visible) continue;
            const d = distance(player, e); if (d > 5 || Math.abs(angleDifference(angleTo(player, e), player.face)) > .6) continue;
            room = Math.min(room, Math.max(.4, d - e.radius - (hero.radius || .5) - .4));
          }
          Object.assign(player.attack, { leap: true, lunge: room, lunged: 0, lungeLead: LEAP_AIR });
        }
        player.stamina -= skill.cost; started = true;
        sound('heavy', { x: player.x, z: player.z, volume: skill.tier >= 3 ? .8 : 1 });
        sound(skill.tier >= 3 ? 'strikeWind3' : 'strikeWind2', { x: player.x, z: player.z, strike: P.strike, air: LEAP_AIR });
      }
      if (!started) return false;
      if (talents) talents.onCast(skill);
      skillCooldowns[skill.line] = skill.cooldown;
      for (const inputKey of skillKeys) delete buffer[inputKey];
      delete buffer.light;
      if (swingPlan && swingPlan.order) swingPlan.order.owed = false;
      if (order && order.heavy && !order.held) order = null;
      swingPlan = null; comboWindow = 0;
      clearLack(key);
      if (skill.line === 'cleave' && skill.tier >= 2) fx('strikeGather', { tier: skill.tier, x: player.x, z: player.z, face: player.face, reach: P.reach || 0, radius: P.radius, strike: P.strike, air: LEAP_AIR });
      else if (skill.line === 'cleave' || (skill.line === 'charge' && !BABA.Charge)) fx('heroSkill', { skill: skill.id, tier: skill.tier, phase: 'gather', x: player.x, y: .1, z: player.z, face: player.face, radius: 3.7, length: 5, width: 1.8, duration: player.attack.duration });
      emit('skill', { id: skill.id, line: skill.line, tier: skill.tier, slot, name: skill.name });
      return true;
    }
    function skillContact(enemy, attack) {
      if (!enemy.active) { enemy.active = true; enemy.activated = true; enemy.encounter.activated = true; }
      return hurtEnemy(enemy, Math.round(attack.damage * (player.rageTime > 0 ? 1.48 : 1)), true, attack.face, attack);
    }
    function chargeStep(attack, dt) {
      const handle = player.chargeHandle;
      if (!handle) { player.attack = null; return; }
      if (player.stagger > 0) { handle.cancel(); player.chargeHandle = null; player.attack = null; return; }
      const done = handle.update(dt);
      if (handle.invulnerable) player.invulnerable = true;   // wind-up and the first moments of the dash
      // Kor Hücumu / Mahşer Hücumu: on landing the chains drag the foes around the impact point in.
      const pull = attack.params.pull;
      if (pull && !attack.pulled && handle.impacted) {
        attack.pulled = true;
        for (const e of enemies) {
          if (e.dead || e.boss || enemyUnderground(e) || !e.model.root.visible) continue;
          const d = Math.hypot(e.x - handle.impactX, e.z - handle.impactZ);
          if (d > attack.params.radius + 3 || d < 1.4 || !clearStrike({ x: handle.impactX, z: handle.impactZ }, e)) continue;
          e.push = null; moveBody(e, (handle.impactX - e.x) / d * Math.min(pull, d - 1.2), (handle.impactZ - e.z) / d * Math.min(pull, d - 1.2), e.radius);
        }
        fx('glowBurst', { x: handle.impactX, z: handle.impactZ, radius: attack.params.radius + 2, duration: .45, color: attack.tier > 2 ? '#2a1244' : '#4a2a0c' });
      }
      if (done) { player.chargeHandle = null; attack.duration = Math.min(attack.duration, attack.age + .001); }
    }
    function releaseSkill(attack) {
      attack.hit = true;
      // Kemik Kıran blasts the ground ahead of the stand; Kabir Balyozu pounds where the leap landed (the cone starts there).
      const P = attack.params, T = attack.tier, sx = Math.sin(attack.face), sz = Math.cos(attack.face), pound = attack.skill === 'temper', ox = pound ? player.x : attack.originX, oz = pound ? player.z : attack.originZ;
      const reach = attack.skill === 'brand' ? P.reach : 2.4, cx = ox + sx * reach, cz = oz + sz * reach;
      propContact(attack.skill === 'brand' ? cx : ox, attack.skill === 'brand' ? cz : oz, P.radius, 3, attack.face, attack.skill === 'brand' ? Math.PI * 2 : P.arc, ox, oz);
      let hits = 0; const shudder = [];
      for (const enemy of enemies) {
        if (enemy.dead || !clearStrike({ x: ox, z: oz }, enemy)) continue;
        const dx = enemy.x - ox, dz = enemy.z - oz;
        if (attack.skill === 'brand') {
          if (Math.hypot(enemy.x - cx, enemy.z - cz) > P.radius + enemy.radius * .6) continue;
        } else if (Math.hypot(dx, dz) > P.radius + enemy.radius * .5 || Math.abs(angleDifference(Math.atan2(dx, dz), attack.face)) > P.arc / 2) continue;
        const r = skillContact(enemy, attack); if (!r) continue; hits++;
        if (r && !r.killed && P.stun > .55) stunEnemy(enemy, P.stun, 'heavy');
        // The blow throws them off the point of impact: the heavier the tier, the farther.
        if (r && !r.killed && !enemy.boss) { const from = attack.skill === 'brand' ? { x: cx, z: cz } : { x: ox, z: oz }, d = Math.hypot(enemy.x - from.x, enemy.z - from.z); push(enemy, Math.atan2(enemy.x - from.x, enemy.z - from.z), (T >= 3 ? .55 + 1.25 : .4 + .75) * (1 - Math.min(1, d / (P.radius + 1)) * .6)); }
        if (r && !r.killed) shudder.push({ body: enemy, model: enemy.model, amp: T >= 3 ? .1 : .08 });
        if (game.state === 'won') break;
      }
      if (hits) { shudder.push({ body: player, model: hero, amp: .014 }); hitStop(T >= 3 ? .06 : .04, shudder); }
      fx('strikeImpact', { tier: T, skill: attack.skill, x: attack.skill === 'brand' ? cx : ox, z: attack.skill === 'brand' ? cz : oz, ox, oz, face: attack.face, radius: P.radius, arc: P.arc || Math.PI * 2, hits });
      emit('impact', { x: cx, z: cz, strength: T >= 3 ? 1.7 : 1.2, radius: P.radius });
      sound('heavyHit', { x: cx, z: cz, volume: T >= 3 ? 1.1 : 1 });
      sound(T >= 3 ? 'strikeHit3' : 'strikeHit2', { x: cx, z: cz, hits });
    }

    let disposed = false, simTime = 0, buffer = {};
    // Only the renderer's scene walk may skip invisible actor trees. Animation, queries and limb capture stay native.
    let renderTraversal = false;
    const matrixGuards = [];
    // Render-view streaming: an enemy that is neither near the hero nor inside (a generous margin around) the camera's view
    // is not posed and not walked by the scene traversal at all (its holder group is hidden). enemy.model.root.visible keeps
    // its old meaning (alive and within 45 m) for targeting; only the holder carries the view test.
    const cullFrustum = new THREE.Frustum(), cullMatrix = new THREE.Matrix4(), cullSphere = new THREE.Sphere(), NEAR_ALWAYS = 16, VIEW_IN = 8, VIEW_OUT = 11, VIEW_FAR = 52;
    function cullEnemies() {
      const app = typeof BABA !== 'undefined' && BABA.app, cam = app && app.camera;
      const ok = !!(cam && cam.projectionMatrix && cam.matrixWorld);
      if (ok) {
        cam.updateMatrixWorld();
        cullMatrix.copy(cam.matrixWorld).invert().premultiply(cam.projectionMatrix); cullFrustum.setFromProjectionMatrix(cullMatrix);
      }
      const px = player.x, pz = player.z;
      for (const e of enemies) {
        let inView = true;
        if (ok) {
          const dx = e.x - px, dz = e.z - pz, cx = e.x - cam.position.x, cz = e.z - cam.position.z;
          if (cx * cx + cz * cz >= VIEW_FAR * VIEW_FAR) inView = false;   // the title camera looks down the whole corridor; nothing beyond ~50 m was ever posed there
          // Bosses and awake foes are always posed (footstep / voice cues and tells are read from them); the sleeping crowd is view-streamed.
          else if (!(e.boss || e.active) && dx * dx + dz * dz >= NEAR_ALWAYS * NEAR_ALWAYS) {
            cullSphere.center.set(e.x, 1.2, e.z); cullSphere.radius = e.inView === false ? VIEW_IN : VIEW_OUT; inView = cullFrustum.intersectsSphere(cullSphere);
          }
        }
        e.inView = inView;
        const want = inView && e.model.root.visible;
        if (e.holder.visible !== want) e.holder.visible = want;
      }
    }
    function beginRenderTraversal() { if (disposed) return; renderTraversal = true; cullEnemies(); }
    function endRenderTraversal() { renderTraversal = false; }
    // A posed character's whole subtree was just given its final world matrices by authored-motion's animate(), and nothing moves it after
    // that, so the render pass's own walk of ~150 nodes would only repeat it. The skinned parts still need their bindMatrixInverse (the
    // one thing SkinnedMesh.updateMatrixWorld adds). A character that was not re-posed since the last full walk and whose root has not
    // moved (sleepers between their slow poses, settled corpses) needs nothing at all. Models whose detail motion / dragged chain /
    // limb hook moves nodes after the pose withdraw 'refreshed' and are walked as before. ?noskipfresh turns this off for A/B timing.
    const SKIP_FRESH = !/[?&]noskipfresh/.test(location.search);
    function stampTree(ud, node, mi) { const p = node.position, st = ud.freshStamp || (ud.freshStamp = new Float64Array(4)); st[0] = p.x; st[1] = p.y; st[2] = p.z; st[3] = node.rotation.y; ud.freshSerial = mi.serial; }
    function skipFreshTree(node) {
      const ud = node.userData, mi = ud.authoredMotion;
      if (!SKIP_FRESH || !mi) return false;
      const st = ud.freshStamp, p = node.position;
      if (st && ud.freshSerial === mi.serial && st[0] === p.x && st[1] === p.y && st[2] === p.z && st[3] === node.rotation.y) return true;
      if (!mi.refreshed || !mi.staticTree) return false;
      mi.refreshed = false;
      if (mi.px !== p.x || mi.py !== p.y || mi.pz !== p.z || mi.ry !== node.rotation.y) return false;   // moved after its pose: walk it
      let skins = ud.freshSkins;
      if (!skins) { skins = ud.freshSkins = []; node.traverse(o => { if (o.isSkinnedMesh) skins.push(o); }); }
      for (let i = 0; i < skins.length; i++) { const m = skins[i]; if (m.bindMode === 'attached') m.bindMatrixInverse.copy(m.matrixWorld).invert(); }
      stampTree(ud, node, mi);
      return true;
    }
    function guardRenderMatrices(node) {
      const descriptor = Object.getOwnPropertyDescriptor(node, 'updateMatrixWorld'), nativeUpdate = node.updateMatrixWorld;
      const guard = function (force) {
        if (renderTraversal) {
          if (!this.visible) return;
          if (this.userData.skipFresh) {
            if (skipFreshTree(this)) return;
            const result = nativeUpdate.call(this, force), mi = this.userData.authoredMotion;
            if (mi) stampTree(this.userData, this, mi);
            return result;
          }
        }
        return nativeUpdate.call(this, force);
      };
      node.updateMatrixWorld = guard; matrixGuards.push({ node, guard, descriptor });
    }
    guardRenderMatrices(hero.root); hero.root.userData.skipFresh = true;
    let dodgeAge = 0, dodgeVector = { x: 0, z: -1 };
    // Explicit aim of this frame (gamepad right stick only; the mouse never aims): its direction from the hero, null = none.
    // moveFace = travel direction this frame (null = standing); assistFoe = the foe the last attack-key swing auto-turned onto (hysteresis).
    let aimFace = null, moveFace = null, assistFoe = null;
    // D4 click-target controls (steerOrders): order = the standing mouse / touch order { kind: 'attack' | 'move' | 'stand', enemy, heavy, x, z, owed, held };
    // swingPlan = the swing the order wants this frame (foe in reach / stand); dodgeAim = the cursor / target direction a roll takes when no key is held;
    // pendingClick = a click that arrived during hit-stop; targetRing = the slim ember ring under the foe that is targeted / under the cursor.
    let blockedPropHold = null, order = null, swingPlan = null, dodgeAim = null, pendingClick = null, pendingDodge = null, targetRing = null, rawInput = null, moveMark = null, markX = 0, markZ = 0, markA = 0;
    let forcedMotion = null, healingAge = 0, comboStep = 0, comboWindow = 0, spinCur = 0;
    let playerHitImmunity = 0, checkpointSnapshot = null, endAnnounced = false;
    let hintCooldown = 0, deniedCooldown = 0, deniedId = '', lackSerial = 0, openingGrace = 8, corpseLifetime = 90, shadowReach = 0;
    let freeze = 0, slowmo = 0, impactScale = 1, attackSerial = 0, actionSerial = 0, evadeCooldown = 0, pairCd = 0;
    let drinkLeft = 0;   // seconds of the flask flourish still to play (also the double-press guard)
    // Stamina economy (combat-tuning.js): staminaWait = refill pause after a spend, staminaMark = stamina at the end of the last frame,
    // dodgeChain / lastRollAt = chained-roll surcharge, lastRollCost = what the current roll cost (refunded by a last-moment roll).
    let staminaWait = 0, staminaMark = 100, dodgeChain = 0, lastRollAt = -99, lastRollCost = 0, perfectCd = 0;
    const tuning = () => TUNE ? TUNE.profile(game.difficulty) : null;
    function dodgeCost() {
      const P = tuning(); if (!P || !ECON) return DODGE.cost;
      const chained = simTime - lastRollAt < .48 + ECON.DODGE_CHAIN ? Math.min(ECON.CHAIN_MAX, dodgeChain + 1) : 0;
      return DODGE.cost * (1 + P.dodgeStep * chained);
    }
    game.dodgeCost = dodgeCost;
    let navigationBudget = 0;   // at most two searches per update, including slow-frame substeps; the player goes first
    let decisionStep = 1 / 60;   // AI patience is measured in simulation seconds, never rendered frames
    const victims = [];
    game.timeScale = 1; game.resetSerial = 0;
    game.limbs = limbs;   // read-only handle for QA (pool statistics)
    game.globes = globes;
    // Slow motion: every combat clock slows together, exactly like hit-stop, so it never favours a side (no caller since the war cry became quick).
    function slowMotion(seconds) { if (!reducedMotion.matches && seconds > 0 && impactScale > 0) slowmo = Math.max(slowmo, seconds); }
    // Brief shared-clock contact emphasis, capped below three 60 Hz frames. Inputs stay buffered through the hold.
    function hitStop(seconds, shudder) {
      if (reducedMotion.matches || !(seconds > 0)) return 0;
      const s = Math.min(FEEL.hitstop.cap || .048, seconds * impactScale); freeze = Math.max(freeze, s);
      if (shudder) shudder.forEach(v => { if (!victims.some(o => o.body === v.body)) victims.push(v); });
      return s;
    }
    function push(body, angle, distance) {
      if (!(distance > 0)) return;
      const p = body.push || (body.push = { x: 0, z: 0 });
      p.x += Math.sin(angle) * distance; p.z += Math.cos(angle) * distance;
    }
    function applyPush(body, dt, radius) {
      const p = body.push; if (!p || Math.abs(p.x) + Math.abs(p.z) < .002) return;
      const f = 1 - Math.exp(-12 * dt), dx = p.x * f, dz = p.z * f; p.x -= dx; p.z -= dz;
      moveBody(body, dx, dz, radius);
    }
    function sweepAngle(attack) { return attack.weaponType === 'spear' && !attack.heavy ? attack.face : attack.face + (attack.heavy ? FEEL.heavySweep : FEEL.sweep[attack.combo] || 0); }

    function disposeObject(object) {
      if (!object) return;
      object.traverse(child => {
        if (child.isInstancedMesh) child.dispose();
        if (child.geometry) child.geometry.dispose();
        if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose());
      });
      if (object.parent) object.parent.remove(object);
    }
    function flatRectangle(width, length, color, opacity) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), new THREE.MeshBasicMaterial({
        color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide
      })); mesh.rotation.x = -Math.PI / 2; return mesh;
    }
    // Ground tells are drawn by telegraphs.js from game.hazards (renderer only); combat owns timing and hit tests.
    // Optional hazard fields: style, fill, sweepDir, inner (ring), pose, pullTo, (parry / parryStagger / guardPressure in the move tables are inert since the hero lost his block),
    // projectile, onHitPlayer, scar, moveId, near (was close to the hero when planned), beat (animation beat or not).
    function addHazard(options) {
      const h = Object.assign({
        x: 0, z: 0, face: 0, shape: 'circle', radius: 2, arc: Math.PI, inner: 0,
        width: 1.5, length: 7, warn: .8, duration: .17, delay: 0, damage: 16,
        owner: null, enemy: KabirI18n.t('Tehlike'), attack: KabirI18n.t('Darbe'), unblockable: false,
        periodic: false, interval: .8, persistent: false, hit: false, active: false,
        nextHit: 0, knockback: 0, pull: false, cancelOnStagger: true,
        style: 'blade', fill: '', sweepDir: 1, committed: false, serial: 0
      }, options);
      if (!h.fill) h.fill = h.shape === 'circle' ? (h.unblockable && !h.persistent ? 'inward' : 'radial') : h.shape === 'line' ? 'forward' : h.style === 'blade' || h.style === 'chain' ? 'sweep' : 'forward';
      h.age = -(h.delay || 0); h.serial = ++hazardSerial; hazards.push(h);
      if (h.near === undefined) h.near = distance(h, player) < NEAR || !!(h.owner && distance(h.owner, player) < NEAR);
      if (h.damage >= 26 || h.unblockable) emit('warning', { x: h.x, z: h.z, text: h.attack, unblockable: h.unblockable, hazard: h });
      return h;
    }
    function removeHazard(index) { hazards.splice(index, 1); }
    function cancelHazards(owner, staggerOnly) {
      for (let i = hazards.length - 1; i >= 0; i--) {
        const h = hazards[i];
        if (h.owner === owner && !h.persistent && !h.active && (!staggerOnly || h.cancelOnStagger)) removeHazard(i);
      }
    }
    // A feint only ever withdraws tells that are not yet on the floor (R2).
    function cancelHidden(owner) {
      for (let i = hazards.length - 1; i >= 0; i--) { const h = hazards[i]; if (h.owner === owner && h.age < 0 && !h.persistent) removeHazard(i); }
    }
    function clearHazards() { hazards.length = 0; propContacts.length = 0; if (mech) mech.clear(); }
    // Soft pooled light on the floor (checkpoint, seals, heals, buffs, parries). Drawn by effects.js.
    function flashRing(x, z, radius, color, duration) { fx('glowBurst', { x, y: .05, z, radius, color, duration: duration || .32 }); }
    // Per-enemy move memory (also restored on every checkpoint reset so a respawn replays identically).
    function freshEnemyFields(e) {
      return { seed: 9173 + e.index * 131, lastMove: '', moveHistory: [], recoveryFloor: 0, forceMove: null, grabCd: 0, riposteCd: 0, blockCount: 0, hooksCd: 6, enraged: false,
        picks: 0, sidestep: 0, retreat: 0, fear: 0, pairWith: null, wrath: 0, spWait: e.boss && chapter >= 2 ? 0 : e.tutorialStage >= 0 ? 2 : e.type === 'prisoner' ? 0 : 2, spHold: 0, spStreak: 0, launchAt: -99, launchDirection: 0, launchHeight: 0 };
    }
    function healthBar(enemy) {
      const bar = new THREE.Group();
      const background = new THREE.Mesh(new THREE.PlaneGeometry(enemy.boss ? 2.2 : 1.2, .09), new THREE.MeshBasicMaterial({ color: 0x181413, depthTest: false }));
      const front = new THREE.Mesh(new THREE.PlaneGeometry(enemy.boss ? 2.16 : 1.16, .055), new THREE.MeshBasicMaterial({ color: enemy.boss ? 0xb27855 : 0x9e4d43, depthTest: false }));
      front.position.z = .008; bar.add(background, front); bar.rotation.x = -.77; bar.renderOrder = 20; root.add(bar); guardRenderMatrices(bar);
      return { root: bar, fill: front };
    }

    encounterDefs.forEach((enc, ei) => {
      enc.spawns.forEach((s, si) => {
        const stats = STATS[s.type], model = BABA.Models.create(s.type);
        const stage = enc.stage == null ? (chapter >= 2 ? (chapter >= 4 ? 1.3 + (chapter - 4) * .04 + ei * .012 : chapter === 3 ? 1.22 + ei * .014 : 1.08 + ei * .025) : ei === 0 ? .48 : ei === 1 ? .62 : .62 + .38 * ei / 5) : enc.stage;
        // Authored room stage remains intact; campaign pressure is additional, so an explicit stage cannot erase chapter progression.
        // Chapter II ramps after its midpoint. Later chapters assume a learned toolkit and retained equipment, never inspect gear to scale enemies.
        const progress = chapter === 2 && world.spawn && world.bossSpawn ? clamp((world.spawn.z - s.z) / Math.max(1, world.spawn.z - world.bossSpawn.z), 0, 1) : clamp(ei / Math.max(1, encounterDefs.length - 1), 0, 1), isBoss = !!stats.boss || s.type === 'boss';
        const pressure = chapter === 2 ? clamp((progress - .45) / .55, 0, 1) : progress;
        const campaignHealth = chapter === 1 ? 1 : isBoss ? 1.50 + Math.max(0, chapter - 4) * .12 - (chapter < 4 ? [0, .5, .5, .28, .12][chapter] : 0) : chapter === 2 ? 1 + .22 * pressure : chapter === 3 ? 1.24 + .16 * pressure : 1.40 + (chapter - 4) * .12 + .16 * pressure;   // chapter >= 4 grows per chapter index (V: final)
        const campaignPace = chapter === 1 || isBoss ? 1 : chapter === 2 ? 1 - .08 * pressure : chapter === 3 ? .92 - .04 * pressure : .88 - (chapter - 4) * .02 - .03 * pressure;
        const campaignDamage = chapter === 1 ? (ei === 0 ? .65 : ei === 1 ? .72 : .72 + .28 * Math.min(ei,5) / 5) : chapter === 2 ? 1.05 + .12 * pressure : chapter === 3 ? 1.22 + .12 * pressure : 1.36 + (chapter - 4) * .1 + .12 * pressure;
        // Chapter smoothing (combat-tuning.js CHAPTER, measured): common foes of each chapter against the hero's expected level and gear there.
        const chapterTune = TUNE ? (isBoss ? { hp: 1, dmg: (TUNE.BOSS[chapter] || { dmg: 1 }).dmg } : TUNE.CHAPTER[chapter] || { hp: 1, dmg: 1 }) : { hp: 1, dmg: 1 };
        const maxHp = Math.round(stats.hp * (isBoss ? BALANCE.bossHealth : BALANCE.health) * stage * campaignHealth * chapterTune.hp * (s.elite && !stats.elite ? 1.45 : 1));
        const holder = new THREE.Group(); holder.name = 'enemy-holder'; holder.add(model.root); root.add(holder);
        guardRenderMatrices(holder); guardRenderMatrices(model.root); model.root.userData.skipFresh = true;
        const enemy = {
          id: enc.id + ':' + si, encounter: enc, index: enemies.length, type: s.type, name: s.name || stats.name,
          x: s.x, z: s.z, spawnX: s.x, spawnZ: s.z, face: Math.PI, holder, inView: true,
          hp: maxHp, maxHp, baseMaxHp:maxHp, dead: false, model, elite: !!s.elite || !!stats.elite, boss: !!stats.boss || s.type === 'boss', phase: 1,
          active: false, activated: false, cooldown: .4 + si * .33, action: null,
          radius: model.radius || stats.radius, stats, tutorialStage: chapter === 1 && ei < 2 && !stats.boss && s.type !== 'boss' ? ei : -1, campaignPace, campaignDamage: (s.elite ? 1.1 : 1) * campaignDamage * chapterTune.dmg, hurt: 0, stagger: 0,
          deadAge: 0, move: 0, buff: 0, buffCooldown: 7 + si, cycle: 0,
          retreat: 0, shieldBroken: 0, poiseRecovery: 0, shield: s.type === 'guard', faceLocked: false, reserve: !!s.reserve
        };
        enemy.bar = healthBar(enemy);
        Object.assign(enemy, freshEnemyFields(enemy));
        enemies.push(enemy); enc.enemies.push(enemy);
        model.root.position.set(enemy.x, 0, enemy.z);
        if (enemy.boss) game.boss = enemy;
      });
    });
    game.totalKills = enemies.filter(e => !e.reserve).length;
    const signature = enemies.map(e => e.id + '@' + e.spawnX + ',' + e.spawnZ + ':' + e.type).join('|');

    // Paths stay open. Only the boss entrance seals after the hero enters the arena.
    encounterDefs.filter(enc => enc.enemies.some(e => e.boss)).forEach(enc => {
      const room = (world.rooms || []).find(room => String(room.id) === String(enc.room));
      if (!room) return;
      const seal = { encounter: enc, width: room.w, x: 0, z: room.z + room.d / 2 - .35, open: true, fade: 1, group: new THREE.Group() };
      seal.group.position.set(seal.x, .035, seal.z); seal.group.name = 'Encounter seal: ' + enc.name;
      const stone = new THREE.MeshStandardMaterial({ color: 0x211c1b, roughness: .84, metalness: .3 });
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.24, 2.4, .3), stone.clone());
        post.position.set(side * room.w / 2, 1.2, 0); seal.group.add(post);
      }
      stone.dispose();
      const line = flatRectangle(room.w, .24, 0xbc5946, .75); line.position.y = .05; seal.group.add(line);
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(room.w, 2.3), new THREE.MeshBasicMaterial({
        color: 0x85372f, transparent: true, opacity: .105, depthWrite: false, side: THREE.DoubleSide
      })); veil.position.y = 1.15; seal.group.add(veil);
      const chainGeometry = new THREE.TorusGeometry(.071, .014, 5, 12);
      const chainMaterial = new THREE.MeshStandardMaterial({ color: 0x77665a, roughness: .58, metalness: .8 });
      const chains = new THREE.InstancedMesh(chainGeometry, chainMaterial, 9 * 20);
      const link = new THREE.Object3D(); let linkIndex = 0;
      for (let strand = -4; strand <= 4; strand++) {
        for (let row = 0; row < 20; row++) {
          link.position.set(strand * .73, .08 + row * .119, .035);
          link.rotation.set(0, row % 2 ? Math.PI / 2 : 0, 0);
          link.scale.set(.73, 1.2, 1); link.updateMatrix();
          chains.setMatrixAt(linkIndex++, link.matrix);
        }
      }
      chains.scale.x = room.w / 6.6; chains.castShadow = true; chains.receiveShadow = true;
      seal.group.add(chains);
      root.add(seal.group); seals.push(seal);
    });
    // Story steps use the ordinary interaction input. Persist each step before its story beat is shown.
    const quests = BABA.Quests ? BABA.Quests.create({ root, world, chapter, player, enemies, emit, sound, fx, onChange() {
      if (gate) gate.refresh();
      saveProfileChoices();
    } }) : null;
    game.quests = quests ? quests.info : null;
    game.updateQuestVisibility = () => { if (quests) quests.update(0); };
    const gate = BABA.Gate ? BABA.Gate.create({ root, world, chapter, enemies, player, emit, sound, fx, quests: game.quests }) : null;
    game.gate = gate ? gate.info : null;

    const initialProfile = progression.snapshot();
    function freshSnapshot(profile) {
      return { chapter, index: 0, x: spawn.x, z: spawn.z, dead: [], kills: 0, elapsed: 0, progression: profile || initialProfile, quests: { version: 1, chapter, progress: [0, 0] } };
    }
    function readSave() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY));
        if (!saved || saved.version !== 3 || saved.chapter !== chapter || !saved.progression || ![1, BABA.Progression.VERSION].includes(saved.progression.version) || !Array.isArray(saved.progression.inventory)) return null;
        if (saved.completed && chapter === FINAL && saved.index === 0) return Object.assign(freshSnapshot(saved.progression), { completed: true,
          kills: Number.isSafeInteger(saved.kills) && saved.kills >= 0 ? saved.kills : 0,
          elapsed: clamp(Number(saved.elapsed) || 0, 0, 86400), quests: saved.quests || null });
        if (saved.transition && chapter >= 2 && saved.index === 0) return freshSnapshot(saved.progression);
        // Reserve composition can change without moving a single campaign foe.
        // Compare the authored non-reserve entries as well, keeping old checkpoints valid.
        const reserveIds = new Set(enemies.filter(e => e.reserve).map(e => e.id));
        const withoutReserve = text => typeof text === 'string' ? text.split('|').filter(entry => !reserveIds.has(entry.split('@')[0])).join('|') : '';
        const sameCampaign = withoutReserve(saved.signature) === withoutReserve(signature);
        if ((saved.signature !== signature && !signature.startsWith(saved.signature + '|') && !sameCampaign) || ![0,1].includes(saved.index) || saved.index===0 && !saved.ongoing) return null;
        const validIds = new Set(enemies.map(e => e.id));
        if (!Array.isArray(saved.dead) || saved.dead.some(id => !validIds.has(id))) return null;
        const dead = Array.from(new Set(saved.dead));
        // The HUD counts authored campaign foes, not repeatable boss helpers.
        const deadIds = new Set(dead), kills = enemies.filter(e => !e.reserve && deadIds.has(e.id)).length;
        return { chapter, index: saved.index, x: saved.index ? checkpoint.x : spawn.x, z: saved.index ? checkpoint.z : spawn.z, ongoing:!!saved.ongoing, dead, kills,
          elapsed: clamp(Number(saved.elapsed) || 0, 0, 86400), progression: saved.progression, quests: saved.quests || null };
      } catch (_) { return null; }
    }
    function saveCheckpoint() {
      game.hasSave = true;
      try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign({ version: 3, chapter, signature }, checkpointSnapshot))); }
      catch (_) { emit('toast', { text: KabirI18n.t('Mühür bu oturum için kaydedildi.') }); }
    }
    function removeSave() {
      try { window.localStorage.removeItem(SAVE_KEY); }
      catch (_) {
        try { window.localStorage.setItem(SAVE_KEY, 'null'); }
        catch (_) { emit('toast', { text: KabirI18n.t('Bu cihazdaki eski mühür kaydı silinemedi.') }); }
      }
      game.hasSave = false;
    }
    checkpointSnapshot = readSave() || freshSnapshot(); game.hasSave = !checkpointSnapshot.completed && (checkpointSnapshot.ongoing || checkpointSnapshot.index === 1 || chapter >= 2 && !!(checkpointSnapshot.progression.completed || []).length);
    game.campaignCompleted = !!checkpointSnapshot.completed;
    game.checkpointIndex = checkpointSnapshot.index;

    function resetToSnapshot(snapshot) {
      cancelPlayerCharge();
      clearHazards(); shudder(false); game.resetSerial++;
      if (director) director.reset(); if (mobMods) mobMods.reset(); if (mobAbil) mobAbil.reset();
      if (!progression.restore(snapshot.progression || initialProfile)) progression.reset();
      syncProgression(true);
      game.campaignCompleted = !!snapshot.completed;
      for (const id of Object.keys(skillCooldowns)) delete skillCooldowns[id]; roarWaves = null; player.chargeHandle = null;
      if (limbs) limbs.reset(enemies);
      if (globes) globes.reset();
      if (groundLoot) groundLoot.reset();
      if (talents) talents.reset();
      simTime = 0; buffer = {}; drinkLeft = 0; blockedPropHold = null; order = null; swingPlan = null; dodgeAim = null; pendingClick = pendingDodge = null; showTargetRing(null); clearMoveMark();
      dodgeAge = 0; forcedMotion = null; healingAge = 0; comboStep = 0; comboWindow = 0; spinCur = 0;
      playerHitImmunity = 0; endAnnounced = false; hintCooldown = 0; deniedCooldown = 0; deniedId = ''; lackSerial = 0; openingGrace = snapshot.index ? 0 : 8;
      freeze = 0; slowmo = 0; victims.length = 0; evadeCooldown = 0; game.hitStop = 0; game.timeScale = 1; pairCd = 0;
      staminaWait = 0; staminaMark = player.maxStamina; dodgeChain = 0; lastRollAt = -99; lastRollCost = 0; perfectCd = 0; player.opening = 0; player.dodgeCost = DODGE.cost;
      { const P = tuning(); if (P) player.maxFlasks = P.flasks; }
      aimFace = moveFace = assistFoe = null;
      Object.assign(player, {
        x: snapshot.x, z: snapshot.z, face: Math.PI, yaw: Math.PI, hp: player.maxHp, stamina: player.maxStamina,
        flasks: player.maxFlasks, hitDirection: 0, dead: false, attack: null, dodge: 0,
        healing: 0, rageTime: 0, hurt: 0, stagger: 0, target: null, status: '', invulnerable: false,
        push: null, staggerTotal: 0, hitAngle: 0, hurtHeavy: false, evade: 0, roar: null, rageFlash: 0,
        specialCd: 0, specialMax: SPECIAL.cooldown, rageCd: 0, rageMaxCd: ROAR.cooldown, rageMax: ROAR.time, lack: null, pendingAction: null, drink: 0
      });
      if (player.special) Object.assign(player.special, { active: false, t: 0, u: 0, tick: 0, spin: 0, serial: 0 });
      hero.root.visible = true; hero.root.position.set(player.x, 0, player.z); hero.root.rotation.y = player.yaw;
      game.kills = snapshot.kills; game.elapsed = snapshot.elapsed; game.checkpointIndex = snapshot.index;
      game.lastDeath = null; game.currentRoom = null; game.activeEncounter = ''; game.attackTarget = null;
      if (boss2) boss2.reset();
      const killed = new Set(snapshot.dead);
      enemies.forEach(e => { if (e.reserve) killed.add(e.id); });   // dormant adds start dead and invisible
      encounterDefs.forEach(enc => { enc.activated = false; enc.announced = false; });
      enemies.forEach(enemy => {
        Object.assign(enemy, {
          x: enemy.spawnX, z: enemy.spawnZ, returning: false, face: Math.PI, hp: killed.has(enemy.id) ? 0 : enemy.maxHp,
          dead: killed.has(enemy.id), phase: 1, active: false, activated: false,
          cooldown: .55 + (enemy.index % 5) * .31, action: null, hurt: 0, stagger: 0,
          deadAge: killed.has(enemy.id) ? Infinity : 0, move: 0, buff: 0, buffCooldown: 7 + enemy.index % 4,
          cycle: 0, retreat: 0, shieldBroken: 0, poiseRecovery: 0, shield: enemy.type === 'guard', faceLocked: false,
          push: null, staggerTotal: 0, staggerKind: '', deathKind: '', hitAngle: 0, hurtHeavy: false, lastStrike: -9, navigation: null
        });
        enemy.model.root.position.set(enemy.x, 0, enemy.z); enemy.model.root.rotation.y = enemy.yaw = enemy.face;
        Object.assign(enemy, freshEnemyFields(enemy));
        enemy.model.root.visible = !enemy.dead; enemy.bar.root.visible = false;
        const pose = { reset: true, time: 0, move: 0, attack: 0, dead: enemy.dead, phase: 'idle', face: enemy.face };
        enemy.model.animate(0, pose);
      });
      seals.forEach(seal => { seal.open = true; seal.fade = 1; seal.group.visible = false; });
      if (quests) {
        // Old saves that had already opened the gate keep their access. New saves always use the two objectives,
        // even with every regular enemy defeated; a defeated boss must never be sealed behind a new quest gate.
        const regular = enemies.filter(e => !e.boss && !e.reserve);
        const completedChapter = !!snapshot.completed || enemies.some(e => e.boss && e.dead);
        const legacyOpen = !snapshot.quests && regular.filter(e => e.dead).length >= Math.max(1, Math.min(BABA.Gate ? BABA.Gate.LEGACY_KILLS : 45, regular.length - 3));
        quests.restore(snapshot.quests, legacyOpen || completedChapter);
      }
      if (gate) gate.sync();
      const heroPose = { reset: true, time: 0, move: 0, attack: 0, dead: false, face: player.face };
      hero.animate(0, heroPose);
      emit('boss', { name: game.boss ? game.boss.name : STATS.boss.name, active: false });
    }
    setDifficulty(game.difficulty, true);   // apply the default profile once; app.js calls setDifficulty again with the saved choice
    resetToSnapshot(Object.assign(freshSnapshot(checkpointSnapshot.progression), { completed: !!checkpointSnapshot.completed }));
    // A saved run is only placed on the map when Play is pressed.
    game.checkpointIndex = checkpointSnapshot.index;

    function start() {
      if (disposed || game.state === 'playing') return;
      resetToSnapshot(checkpointSnapshot);
      if (checkpointSnapshot.completed) {
        blockedPropHold = null;
        endAnnounced = true; game.state = 'won';
        emit('win', { time: game.elapsed, kills: game.kills, chapter, nextChapter: null, completed: true });
        return;
      }
      game.state = 'playing';
      emit('toast', { text: chapter === 5 ? (checkpointSnapshot.index ? KabirI18n.t('Son yemin taşından devam ediyorsun. Kara Kadı ileride.') : KabirI18n.t('Son Mahkeme. Boşluğun üstündeki yolu geç; hükmü veren eli kır.')) : chapter === 4 ? (checkpointSnapshot.index ? KabirI18n.t('Son ocak yemininden devam ediyorsun. Ocağın Kalbi ileride.') : KabirI18n.t('Kızıl Ocak. Zincir tezgâhlarını geç; ocağın kalbini söndür.')) : chapter === 3 ? (checkpointSnapshot.index ? KabirI18n.t('Son yemin taşından devam ediyorsun. Oyukların Kralı ileride.') : KabirI18n.t('Sessiz Taht. Harabelerden mağaraya in; oyukların kaynağını sustur.')) : world.chapter === 2 ? (checkpointSnapshot.index ? KabirI18n.t('Son Fener’den devam ediyorsun. Çancı ileride.') : KabirI18n.t('Kara Kıyı. Kökleri yar. Boğulmuş çanı sustur.')) : checkpointSnapshot.index ? KabirI18n.t('Son mühürden devam ediyorsun. Cellat ileride.') : KabirI18n.t('Kurban Tapınağı. Mührü bul. Celladı sustur.') });
    }
    function restart() {
      if (disposed) return;
      removeSave(); progression.reset(); checkpointSnapshot = freshSnapshot(progression.snapshot()); resetToSnapshot(checkpointSnapshot); game.state = 'playing';
      emit('toast', { text: KabirI18n.t('Yeni yürüyüş. Geçit seni bekliyor.') });
    }
    function respawn() {
      if (disposed) return;
      saveProfileChoices(); resetToSnapshot(checkpointSnapshot); game.state = 'playing';
      emit('toast', { text: KabirI18n.t('Yaraların kapandı. Eşyaların, seviyen ve yeteneklerin korundu.') });
    }
    // Behind the title the temple is shown from its entrance (the world, fog and lights follow the hero), even with a
    // saved oath stone; the save itself is only placed on the map by start().
    function toTitle() {
      if (disposed) return;
      resetToSnapshot(Object.assign(freshSnapshot(checkpointSnapshot.progression), { completed: !!checkpointSnapshot.completed })); game.checkpointIndex = checkpointSnapshot.index; game.state = 'ready';
    }
    function atSafeCheckpoint() {
      return distance(player, checkpoint) < 6.1 && !enemies.some(e => !e.dead && distance(e, player) < 12)
        && !hazards.some(h => !h.harmless && distance(h, player) < (h.radius || h.length || 2) + 2);
    }
    function activateCheckpoint() {
      if (game.checkpointIndex || !atSafeCheckpoint()) return false;
      cancelPlayerCharge();
      checkpointSnapshot = {
        index: 1, x: checkpoint.x, z: checkpoint.z,
        dead: enemies.filter(e => e.dead).map(e => e.id), kills: game.kills, elapsed: game.elapsed, progression: progression.snapshot(), quests: quests ? quests.snapshot() : null
      };
      game.checkpointIndex = 1;
      player.hp = player.maxHp; player.stamina = player.maxStamina; player.flasks = player.maxFlasks;
      player.specialCd = player.rageCd = 0;
      for (const id of Object.keys(skillCooldowns)) delete skillCooldowns[id]; roarWaves = null; player.chargeHandle = null;
      game.attackTarget = null;
      if (globes) globes.reset();
      saveCheckpoint(); flashRing(checkpoint.x, checkpoint.z, 3.3, 0xf0d293, 1.4);
      sound('checkpoint'); emit('checkpoint', { index: 1, name: chapter === 5 ? KabirI18n.t('Son Tanıklık') : chapter === 4 ? 'Son Ocak Yemini' : chapter === 3 ? KabirI18n.t('Tahtın Eşiği') : world.chapter === 2 ? KabirI18n.t('Son Fener') : KabirI18n.t('Celladın Eşiği') });
      return true;
    }
    function interact() {
      if (game.state !== 'playing') return;
      if (quests && quests.interact()) return;
      if (groundLoot && groundLoot.takeNearest(player.x, player.z, 2)) return;   // E also takes the nearest ground item within 2 m
      if (activateCheckpoint()) return;
      if (distance(player, checkpoint) < 6.1) emit('toast', { text: game.checkpointIndex ? (chapter === 5 ? KabirI18n.t('Yemin mühürlü. Kara Kadı ileride bekliyor.') : chapter === 4 ? KabirI18n.t('Yemin mühürlü. Ocağın Kalbi ileride bekliyor.') : chapter === 3 ? KabirI18n.t('Yemin mühürlü. Oyukların Kralı ileride bekliyor.') : world.chapter === 2 ? KabirI18n.t('Yemin mühürlü. Çancı ileride bekliyor.') : KabirI18n.t('Mühür açık. Cellat salonda bekliyor.')) : KabirI18n.t('Yakındaki tehlikeden uzaklaş; sonra yemin taşına dön.') });
    }

    function moveBody(body, dx, dz, radius) {
      if (Math.abs(dx) + Math.abs(dz) < 1e-7) return;
      const previousZ = body.z;
      if (world.move) world.move(body, dx, dz, radius);
      else { body.x += dx; body.z += dz; }
      for (const seal of seals) {
        if (seal.open || Math.abs(body.x - seal.x) > seal.width / 2 + radius) continue;
        if (previousZ < seal.z && body.z > seal.z - radius) body.z = seal.z - radius;
        else if (previousZ >= seal.z && body.z < seal.z + radius) body.z = seal.z + radius;
      }
      if (gate) gate.clamp(body, previousZ, radius);
    }
    function separateEnemies(enemy, dt) {
      if (enemyUnderground(enemy)) return;
      let sx = 0, sz = 0;
      for (const other of enemies) {
        if (other === enemy || other.dead || !other.active || enemyUnderground(other)) continue;
        const dx = enemy.x - other.x, dz = enemy.z - other.z, d = Math.hypot(dx, dz);
        const minD = enemy.radius + other.radius + .15;
        if (d > .01 && d < minD) { sx += dx / d * (minD - d) * 2.8; sz += dz / d * (minD - d) * 2.8; }
      }
      moveBody(enemy, sx * dt, sz * dt, enemy.radius);
    }
    // Bodies do not overlap the father: small foes are nudged out of him, the executioner is a wall he cannot walk into.
    function separateFromHero() {
      if (player.dead) return;
      for (const e of enemies) {
        if (e.dead || !e.active || enemyUnderground(e) || e.model.root.position.y > .3) continue;
        const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz), minD = e.radius + .42;
        if (d >= minD) continue;
        const nx = d > .001 ? dx / d : Math.sin(player.face + Math.PI), nz = d > .001 ? dz / d : Math.cos(player.face + Math.PI), gap = minD - d;
        if (e.boss) moveBody(player, -nx * gap, -nz * gap, hero.radius || .5); else moveBody(e, nx * gap, nz * gap, e.radius);
      }
    }
    function setEnemyAction(enemy, duration, attack, movement, info) {
      info = info || {};
      enemy.action = { age: 0, duration, attack, face: enemy.face, movement: movement || null, beats: [], serial: ++actionSerial,
        moveId: info.moveId || '', pose: info.pose || '', style: info.style || '', unblockable: !!info.unblockable };
      enemy.faceLocked = true; enemy.move = 0; enemy.shield = false;
      sound('enemyWindup', { type: enemy.type, x: enemy.x, z: enemy.z, attack, moveId: info.moveId || '', pose: info.pose || '',
        style: info.style || '', unblockable: !!info.unblockable });
    }
    function hazardFrom(enemy, options) {
      const h = addHazard(Object.assign({
        owner: enemy, enemy: enemy.name, x: enemy.x, z: enemy.z,
        face: enemy.face, damage: enemy.buff > 0 ? 20 : 16
      }, options, { damage: Math.round((options.damage == null ? 16 : options.damage) * (enemy.buff > 0 ? 1.25 : 1)) }));
      const a = enemy.action;
      if (a && !h.persistent && h.beat !== false) {
        // Beats run on the action clock. The first beat of a move starts at the move's start, so the held
        // body tell (intent) plays before the floor tell appears; later beats start when their tell appears.
        const base = a.age, start = base + h.delay;
        a.beats.push({ start: options.beatStart != null ? Math.min(start, options.beatStart) : start, strike: start + h.warn, duration: h.duration, pose: h.pose || '' });
        a.beats.sort((p, q) => p.strike - q.strike);
      }
      return h;
    }
    function routeDirection(body, target, nav, dt, radius, isHero) {
      nav.wait = Math.max(0, (nav.wait || 0) - dt);
      const changed = !Number.isFinite(nav.x) || Math.hypot(target.x - nav.x, target.z - nav.z) > 1.5;
      if (nav.route && changed && nav.wait <= 0) nav.route = null;
      if (nav.route) {
        while (nav.at < nav.route.length - 1 && distance(body, nav.route[nav.at]) < .2) nav.at++;
        if (nav.at === nav.route.length - 1 && distance(body, nav.route[nav.at]) < .22) nav.route = null;
      }
      if (!nav.route && nav.wait <= 0 && world.pathTo && world.hasClearPath) {
        nav.x = target.x; nav.z = target.z;
        nav.wait = isHero ? .18 : .65 + (body.index % 7) * .037;
        if (!world.hasClearPath(body.x, body.z, target.x, target.z, radius)) {
          if (navigationBudget > 0) {
            navigationBudget--;
            nav.route = world.pathTo(body, target, radius); nav.at = 0;
            if (nav.route && nav.route.length && isHero && target.kind === 'move') {
              const end = nav.route[nav.route.length - 1];
              // Clicking a prop's edge gives a reachable nearby floor destination.
              target.x = end.x; target.z = end.z; nav.x = end.x; nav.z = end.z;
            }
          } else nav.wait = .025 + (body.index || 0) % 5 * .008;
        }
      }
      const point = nav.route && nav.route[nav.at] || target;
      const dx = point.x - body.x, dz = point.z - body.z, d = Math.hypot(dx, dz);
      nav.dx = d > .001 ? dx / d : 0; nav.dz = d > .001 ? dz / d : 0; nav.distance = d;
      return nav;
    }
    function walkTo(enemy, target, speed, dt) {
      const nav = enemy.navigation || (enemy.navigation = { wait: enemy.index % 7 * .031 });
      routeDirection(enemy, target, nav, dt, enemy.radius, false);
      const d = nav.distance;
      if (d < .08) return;
      const amount = Math.min(d, speed * dt);
      moveBody(enemy, nav.dx * amount, nav.dz * amount, enemy.radius); enemy.move = Math.min(1, speed / enemy.stats.speed);
    }
    function openAttackSlots(enemy) {
      const distanceToPlayer = distance(enemy, player);
      if (distanceToPlayer > 17) return false;
      if (!clearStrike(enemy, player)) return false;
      const mine = enemy.stats.ranged || enemy.type === 'cultist' || enemy.type === 'carrier';
      let simultaneous = 0, same = 0;
      for (const e of enemies) {
        if (e === enemy || !e.active || e.dead || !e.action || !(distance(e, player) < 18) || (enemy.boss && e.reserve)) continue;
        simultaneous++; if (!!(e.stats.ranged || e.type === 'cultist' || e.type === 'carrier') === !!mine) same++;
      }
      if (enemy.boss) return simultaneous === 0;
      if (enemy.tutorialStage === 0) return simultaneous === 0;
      const P = tuning();
      return simultaneous < (P ? P.attackers : 3) && same < (mine ? 1 : P ? P.melee : 2);
    }

    // ------------------------------------------------------------------ moves
    // Move = { id, name, duration, pose, hits:[Hit], movement?, retreat?, cooldown?, feint?:{at,chance,kind}, faceAt?, onBegin? }
    // Hit  = { at, warn, shape, dmg, style, fill, sweepDir, ..., origin?:{x,z}, face?, beat? }   (at/warn in seconds from move start)
    function rand(e) { e.seed = (Math.imul(e.seed, 1664525) + 1013904223) >>> 0; return e.seed / 4294967296; }
    const normalStrike = h => !h.harmless && !h.persistent && h.owner && !h.owner.boss && h.age <= h.warn + h.duration;
    // R5: is the unblockable token free for a strike `at` seconds from now?
    function unblockableFree(at, except) {
      return !hazards.some(h => normalStrike(h) && h.unblockable && h.owner !== except && distance(h, player) < 9 && Math.abs((h.warn - h.age) - at) < TOKEN);
    }
    // R4: the smallest delay (<= .45 s) that keeps every strike of this move RHYTHM away from other enemies' strikes; -1 if none.
    function rhythmShift(enemy, hits) {
      const others = hazards.filter(h => normalStrike(h) && h.owner !== enemy && h.near).map(h => h.warn - h.age);
      const times = hits.filter(h => !h.harmless).map(h => h.at);
      if (!others.length || !times.length) return 0;
      for (let s = 0; s <= .4501; s += .05) if (times.every(t => others.every(o => Math.abs(t + s - o) >= RHYTHM))) return s;
      return -1;
    }
    function setDifficulty(level, force) {
      const next=['easy','normal','hard'].includes(level)?level:'normal';
      if (next===game.difficulty && !force) return;
      game.difficulty=next;
      const P=tuning();
      for(const enemy of enemies){
        const fraction=enemy.maxHp>0?enemy.hp/enemy.maxHp:1;
        // Profile health (combat-tuning.js); elites carry the profile's elite bonus on top. Bosses use the plain multiplier.
        enemy.maxHp=Math.round(enemy.baseMaxHp*(P?P.enemyHp*(enemy.elite&&!enemy.boss?P.eliteHp:1):next==='easy'?.72:1));
        enemy.hp=enemy.dead?0:enemy.maxHp*fraction;
      }
      if (P) { player.maxFlasks=P.flasks; player.flasks=Math.min(player.flasks,P.flasks); }
    }
    function beginMove(enemy, move) {
      const timingScale = tuning() ? tuning().pace : game.difficulty === 'hard' ? 1 : game.difficulty === 'easy' ? 1.2 : 1.12;
      if(timingScale !== 1) {
        const pace=timingScale;
        move=Object.assign({},move,{duration:move.duration*pace,hits:(move.hits||[]).map(h=>Object.assign({},h,{at:h.at*pace,warn:h.warn*pace}))});
        if(move.movement) move.movement=Object.assign({},move.movement,{start:move.movement.start*pace,duration:move.movement.duration*pace});
        if(move.faceAt) move.faceAt=Object.assign({},move.faceAt,{t:move.faceAt.t*pace});
        if(move.feint) move.feint=Object.assign({},move.feint,{at:move.feint.at*pace});
      }
      const hits = move.hits || [];
      const near = distance(enemy, player) < NEAR || hits.some(h => h.origin && distance(h.origin, player) < NEAR);
      let shift = 0;
      if (!enemy.boss && near && !move.noShift) { shift = rhythmShift(enemy, hits); if (shift < 0) return false; }
      if (!enemy.boss && hits.some(h => h.unblockable && !h.harmless && !unblockableFree(h.at + shift, enemy))) return false;
      const mv = move.movement ? Object.assign({}, move.movement, { start: move.movement.start + shift }) : null;
      setEnemyAction(enemy, move.duration + shift, move.name, mv, { moveId: move.id, pose: move.pose || (hits[0] && hits[0].pose) || '',
        style: hits.length ? hits[0].style || 'blade' : '', unblockable: hits.some(h => h.unblockable) });
      const a = enemy.action; a.cooldown = move.cooldown; a.shift = shift;
      if (move.faceAt) a.faceAt = { t: move.faceAt.t + shift, face: move.faceAt.face };
      if (move.feint && rand(enemy) < move.feint.chance) { a.feintAt = move.feint.at + shift; a.feintKind = move.feint.kind || 'stop'; }
      enemy.lastMove = move.id; enemy.picks++;
      const memory = enemy.moveHistory || (enemy.moveHistory = []); memory.push(move.id); if (memory.length > 5) memory.shift();
      if (move.onBegin) move.onBegin(a, { scale: timingScale, shift });
      let first = true;
      for (const hit of hits) {
        const o = hit.origin || enemy;
        hazardFrom(enemy, Object.assign({ attack: move.name }, hit, {
          x: o.x, z: o.z, face: hit.face != null ? hit.face : enemy.face, moveId: move.id, near, plain: !!move.plain,
          delay: shift + hit.at - hit.warn, warn: hit.warn, damage: hit.dmg != null ? hit.dmg : hit.damage,
          beatStart: first && hit.beat !== false ? 0 : undefined }));
        if (hit.beat !== false) first = false;
      }
      if (move.retreat) enemy.retreat = move.retreat;
      return true;
    }
    // Weighted, deterministic choice (per-enemy seed). Never the same move twice in a row when another is possible;
    // a move that would break the rhythm or token rule is skipped for the next candidate.
    // Specials (sp) are held back while the enemy still owes plain blows (spWait) and weigh SPECIAL_W of their weight otherwise.
    function pick(enemy, options) {
      const ok = options.filter(o => o.ok && !(o.sp && enemy.spWait > 0));
      // Preserve authored priorities, but avoid an endless A/B loop when several legal attacks exist.
      const history = enemy.moveHistory || [], weight = o => (o.w || 1) * (o.sp ? SPECIAL_W : 1) /
        (1 + history.reduce((n, id, i) => n + (id === o.id ? .45 + i * .18 : 0), 0));
      // Only specials legal (hero out of plain range): chase first instead of throwing one at once.
      if (ok.length && ok.every(o => o.sp)) { enemy.spHold += decisionStep; if (enemy.spHold + 1e-7 < (enemy.boss && chapter >= 2 ? .55 : SPECIAL_HOLD)) return false; } else enemy.spHold = 0;
      let pool = ok.filter(o => o.id !== enemy.lastMove);
      if (!pool.length || (ok.some(o => !o.sp) && pool.every(o => o.sp))) pool = ok;   // repeating the one plain blow beats being forced into a special
      while (pool.length) {
        let r = rand(enemy) * pool.reduce((s, o) => s + weight(o), 0), chosen = pool[pool.length - 1];
        for (const o of pool) if ((r -= weight(o)) <= 0) { chosen = o; break; }
        if (beginMove(enemy, Object.assign(chosen.move(), { plain: !chosen.sp }))) {
          enemy.spHold=0;
          enemy.spWait=chosen.sp?((enemy.stats.coast||enemy.stats.ruins||enemy.stats.forge)?(enemy.boss?1:2):enemy.tutorialStage>=0?3:SPECIAL_GAP[enemy.boss&&enemy.phase===2?'boss2':enemy.type]):Math.max(0,enemy.spWait-1);
          // Later bosses can follow one special with another, then owe a plain
          // commitment. Existing cooldown, no-repeat and arena overlap guards apply.
          if(enemy.boss&&chapter>=2){enemy.spStreak=chosen.sp?(enemy.spStreak||0)+1:0;if(chosen.sp)enemy.spWait=enemy.spStreak>=2?1:0;}
          return true;
        }
        pool = pool.filter(o => o !== chosen);
      }
      return false;
    }
    function allowFor(e) { const g = GATES[e.encounter.id] && GATES[e.encounter.id][e.type]; return id => !g || g.includes(id); }
    const walkable = (x, z, r) => !world.isWalkable || world.isWalkable(x, z, r);
    // Lines that travel (spurs, the hook, rushes, charges) stop at the first wall along their path.
    function clipLine(o, face, L) {
      if (gate) L = gate.clipLine(o.x, o.z, face, L);
      if (!world.isWalkable) return L;
      for (let s = .5; s < L; s += .25) if (!world.isWalkable(o.x + Math.sin(face) * s, o.z + Math.cos(face) * s, .15)) return Math.max(1, s + .15);
      return L;
    }
    function clearStrike(a, b) {
      if (gate && gate.blocks(a.x, a.z, b.x, b.z, .15)) return false;
      const dz = b.z - a.z;
      if (Math.abs(dz) > 1e-6) for (const seal of seals) {
        if (seal.open) continue;
        const u = (seal.z - a.z) / dz;
        if (u > 0 && u < 1 && Math.abs(a.x + (b.x - a.x) * u - seal.x) < seal.width / 2 + .15) return false;
      }
      if (world.hasClearPath) return world.hasClearPath(a.x, a.z, b.x, b.z, .08);
      return !world.isWalkable || world.isWalkable((a.x + b.x) * .5, (a.z + b.z) * .5, .12);
    }
    function segmentDistance(p, a, b) {
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1, t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / L2, 0, 1);
      return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    }
    // Pack: melee enemies spread around the hero instead of stacking in one line.
    function approachPoint(e) {
      const crowd = enemies.filter(o => o !== e && o.active && !o.dead && !o.boss && distance(o, player) < 4.2).length;
      if (!crowd) return player;
      const a = angleTo(player, e) + (e.index % 2 ? 1 : -1) * Math.min(1.2, .55 * crowd);
      return { x: player.x + Math.sin(a) * 2.2, z: player.z + Math.cos(a) * 2.2 };
    }
    // Bodyguard: a guard stands between its caster and the hero.
    function guardPost(e) {
      const w = enemies.find(o => (o.stats.ranged || o.type === 'cultist' || o.type === 'carrier') && o.active && !o.dead && o.encounter === e.encounter && distance(o, e) < 10);
      if (!w || distance(player, w) < 3) return null;
      const a = angleTo(w, player), dd = Math.max(1.5, distance(w, player) - 2.4), s = (e.index % 2 ? 1.1 : -1.1);
      return { x: w.x + Math.sin(a) * dd + Math.cos(a) * s, z: w.z + Math.cos(a) * dd - Math.sin(a) * s };
    }

    function prisonerAttack(e, d) {
      const allow = allowFor(e), fx0 = Math.sin(e.face), fz0 = Math.cos(e.face);
      return pick(e, [
        // The second claw steps in after the first, so backing straight off is not enough: roll through it.
        { id: 'claw', ok: d < 2.6 && allow('claw'), w: 3, move: () => ({ id: 'claw', name: KabirI18n.t('İkili Pençe'), duration: 1.62, pose: 'clawR',
          movement: { start: .62, duration: .28, fromX: e.x, fromZ: e.z, x: e.x + fx0 * .7, z: e.z + fz0 * .7, ease: true }, hits: [
          { at: .56, warn: .56, shape: 'cone', radius: 2.7, arc: 2.2, dmg: 12, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'clawR', attack: KabirI18n.t('İkili Pençe · ilk darbe') },
          { at: 1.04, warn: .48, shape: 'cone', radius: 2.9, arc: 2.4, track: true, dmg: 15, style: 'blade', fill: 'sweep', sweepDir: -1, pose: 'clawL', attack: KabirI18n.t('İkili Pençe · ikinci darbe') }] }) },
        { id: 'lash', ok: d >= 2.3 && d < 3.9 && allow('lash'), w: 2, move: () => ({ id: 'lash', name: KabirI18n.t('Zincir Kırbacı'), duration: 1.4, pose: 'chainWhip', hits: [
          { at: .62, warn: .62, shape: 'cone', radius: 3.9, arc: 1.4, dmg: 14, knockback: 1.2, style: 'chain', fill: 'sweep', sweepDir: 1, pose: 'chainWhip' }] }) },
        { id: 'rush', sp: 1, ok: d >= 3.9 && d < 8.3 && allow('rush'), w: 2, move: () => {
          const L = clipLine(e, e.face, Math.min(7.8, d + .6));
          return { id: 'rush', name: KabirI18n.t('Zincir Hücumu'), duration: 1.9, pose: 'lunge', feint: { at: .28, chance: .25 },
            movement: { start: 1.15, duration: .3, fromX: e.x, fromZ: e.z, x: e.x + fx0 * (L - .6), z: e.z + fz0 * (L - .6) },
            hits: [{ at: 1.15, warn: .8, shape: 'line', width: 1.5, length: L, dmg: 15, knockback: 3, style: 'thrust', fill: 'forward', pose: 'lunge', duration: .3 }] }; } },
        { id: 'grab', sp: 1, ok: d < 2.4 && e.grabCd <= 0 && allow('grab'), w: 1, move: () => ({ id: 'grab', name: KabirI18n.t('Boğucu Kavrayış'), duration: 1.75, pose: 'grab',
          onBegin() { e.grabCd = 18; },
          hits: [{ at: 1.0, warn: 1.0, shape: 'cone', radius: 2.5, arc: 1.5, dmg: 20, unblockable: true, style: 'grab', fill: 'inward', pose: 'grab' }] }) }
      ]);
    }
    function guardRiposte(e) {
      return beginMove(e, { id: 'riposte', name: KabirI18n.t('Pala Dürtüşü'), duration: 1.15, pose: 'thrust', hits: [
        { at: .58, warn: .58, shape: 'line', width: 1.1, length: 3.5, dmg: 14, style: 'thrust', fill: 'forward', pose: 'thrust' }] });
    }
    function guardAttack(e, d) {
      const ux = player.x - e.x, uz = player.z - e.z, ul = Math.hypot(ux, uz) || 1;
      // Shove the hero back into an ally's bile pool or rune when one lies behind him.
      const behind = hazards.some(h => h.owner && h.owner !== e && !h.harmless && (h.poison || h.style === 'rune') && h.age >= 0
        && distance(h, player) < 4 && ((h.x - player.x) * ux + (h.z - player.z) * uz) / ul > .3);
      return pick(e, [
        { id: 'bash', ok: d < 2.9, w: 2, move: () => ({ id: 'bash', name: 'Kalkan Darbesi', duration: 1.3, pose: 'bash', hits: [
          { at: .62, warn: .62, shape: 'cone', radius: 2.8, arc: 1.7, dmg: 11, knockback: 4.4, guardPressure: 2.3, style: 'blunt', fill: 'forward', pose: 'bash' }] }) },
        // Cut and backhand: the second stroke steps in, so backing straight off is not enough; a roll is.
        { id: 'cut', ok: d < 3.3, w: 3, move: () => ({ id: 'cut', name: KabirI18n.t('Pala Kesişi'), duration: 1.85, pose: 'slashR',
          movement: { start: .72, duration: .3, fromX: e.x, fromZ: e.z, x: e.x + Math.sin(e.face) * .9, z: e.z + Math.cos(e.face) * .9, ease: true }, hits: [
          { at: .58, warn: .58, shape: 'cone', radius: 3.3, arc: 2.5, dmg: 18, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'slashR' },
          { at: 1.22, warn: .5, shape: 'cone', radius: 3.1, arc: 2.2, track: true, dmg: 12, style: 'blade', fill: 'sweep', sweepDir: -1, pose: 'sweepBack', attack: KabirI18n.t('Pala Kesişi · dönüş') }] }) },
        { id: 'over', sp: 1, ok: d > 1.2 && d < 3.8, w: 2, move: () => ({ id: 'over', name: KabirI18n.t('Gecikmiş Pala'), duration: 2.1, pose: 'overheadHold', hits: [
          { at: 1.2, warn: 1.2, shape: 'line', width: 1.3, length: 4.0, dmg: 26, knockback: 2.2, style: 'blade', fill: 'forward', pose: 'overheadHold', scar: true }] }) },
        { id: 'shove', sp: 1, ok: d < 2.4 && (behind || e.picks % 4 === 3), w: behind ? 6 : 2, move: () => ({ id: 'shove', name: 'Kalkan Hamlesi', duration: 1.35, pose: 'shove', hits: [
          { at: .75, warn: .75, shape: 'line', width: 2.2, length: 2.7, dmg: 8, knockback: 6, guardPressure: 3, style: 'blunt', fill: 'forward', pose: 'shove' }] }) }
      ]);
    }
    // The second priest of İkili Ayin: channels (no tell of its own) while the first one's line fills between them.
    function pairMirror(b, a) {
      b.face = angleTo(b, a);
      setEnemyAction(b, 1.9, KabirI18n.t('İkili Ayin'), null, { moveId: 'pairMirror', pose: 'cast', style: 'rune', unblockable: true });
      b.action.pairWith = a; b.action.beats.push({ start: 0, strike: 1.4, duration: .17, pose: 'cast' }); b.lastMove = 'pair';
    }
    function cultistAttack(e, d) {
      if (d > 12) return false;
      const ally = enemies.find(o => o !== e && o.active && !o.dead && !o.boss && distance(o, e) < 11 && o.buff < 1);
      const partner = enemies.find(o => o !== e && o.type === 'cultist' && o.active && !o.dead && !o.action && o.stagger <= 0
        && distance(o, e) > 4 && distance(o, e) < 12);
      const pairOk = !!partner && pairCd <= 0 && segmentDistance(player, e, partner) < 1.8;
      return pick(e, [
        { id: 'rite', sp: 1, ok: e.buffCooldown <= 0 && !!ally, w: 6, move: () => ({ id: 'rite', name: KabirI18n.t('Kan Ayini'), duration: 1.65, pose: 'kneel', onBegin() { e.buffCooldown = 22; },
          hits: [{ at: 1.05, warn: 1.05, shape: 'circle', radius: 1.35, dmg: 0, harmless: true, duration: .26, style: 'rune', pose: 'kneel',
            onActive() {
              if (e.dead) return;
              enemies.forEach(o => { if (!o.dead && !o.boss && distance(o, e) < 11) { o.buff = 9; flashRing(o.x, o.z, o.radius + .35, 0xdb675e, .8); } });
              emit('toast', { text: KabirI18n.t('Kül Rahibi yakındakileri güçlendirdi.') }); sound('rage', { enemy: true });
            } }] }) },
        { id: 'pair', sp: 1, ok: pairOk, w: 5, move: () => ({ id: 'pair', name: KabirI18n.t('İkili Ayin'), duration: 1.9, pose: 'cast', onBegin() { pairCd = 20; pairMirror(partner, e); },
          hits: [{ at: 1.4, warn: 1.4, shape: 'line', width: 1.4, length: distance(e, partner), face: angleTo(e, partner), dmg: 20, unblockable: true,
            style: 'rune', fill: 'converge', pose: 'cast', partner,
            onActive() { const b = this.partner; if (!b || b.dead || b.stagger > 0 || !b.action || b.action.moveId !== 'pairMirror') this.harmless = true; } }] }) },
        { id: 'rune', sp: 1, ok: d > 4 && d < 12, w: 3, move: () => ({ id: 'rune', name: KabirI18n.t('Kurban Rünü'), duration: 1.9, pose: 'cast', hits: [
          { at: 1.35, warn: 1.35, shape: 'circle', radius: 2.3, origin: { x: player.x, z: player.z }, dmg: 22, unblockable: true, style: 'rune', fill: 'inward', pose: 'cast' }] }) },
        { id: 'embers', ok: d > 3 && d < 12, w: 2, move: () => {
          const th = rand(e) * TAU, p0 = { x: player.x, z: player.z };
          const c = [p0, { x: p0.x + Math.sin(th) * 1.9, z: p0.z + Math.cos(th) * 1.9 }, { x: p0.x + Math.sin(th + 2.3) * 1.9, z: p0.z + Math.cos(th + 2.3) * 1.9 }];
          return { id: 'embers', name: KabirI18n.t('Kor Yağmuru'), duration: 1.95, pose: 'castHigh', cooldown: 3.6, hits: c.map((o, i) => ({
            at: 1 + i * .2, warn: .9, shape: 'circle', radius: 1.3, origin: o, dmg: 8, style: 'ember', fill: 'radial', pose: 'castHigh', beat: i === 0 })) }; } },
        { id: 'brazier', ok: d < 3.4, w: 4, move: () => ({ id: 'brazier', name: KabirI18n.t('Mangal Savuruşu'), duration: 1.35, pose: 'staffSwing', retreat: 1.2, hits: [
          { at: .58, warn: .58, shape: 'cone', radius: 3.2, arc: 1.6, dmg: 13, knockback: 4.5, style: 'blade', fill: 'sweep', sweepDir: -1, pose: 'staffSwing', embers: true }] }) }
      ]);
    }
    function stalkerAttack(e, d) {
      if (d > 9.5) return false;
      // Hunter's instinct: a hero who reels invites the pounce.
      const hunt = player.stagger > 0;
      const facing = Math.abs(angleDifference(player.face, angleTo(player, e))) < .7;
      let dest = null;
      if (d > 2 && d < 6 && facing) for (const s of (e.index % 2 ? [1, -1] : [-1, 1])) {
        const a = player.face + Math.PI + s * .6, c = { x: player.x + Math.sin(a) * 2.3, z: player.z + Math.cos(a) * 2.3, side: s };
        if (walkable(c.x, c.z, .6) && walkable((c.x + e.x) / 2, (c.z + e.z) / 2, .3)) { dest = c; break; }
      }
      return pick(e, [
        { id: 'leap', sp: 1, ok: d > 3.1 && d < 8.5, w: hunt ? 6 : 2, move: () => {
          // The shadow is centred on the hero; the stalker itself lands just short of it, claws first.
          const t = { x: player.x, z: player.z }, back = Math.min(1.1, d - .5), a = angleTo(e, t);
          return { id: 'leap', name: KabirI18n.t('Karanlık Sıçrayışı'), duration: 1.85, pose: 'crouch', retreat: 1.3, feint: { at: .3, chance: .2, kind: 'sidestep' },
            movement: { start: .95, duration: .3, fromX: e.x, fromZ: e.z, x: t.x - Math.sin(a) * back, z: t.z - Math.cos(a) * back, leap: true },
            hits: [{ at: 1.25, warn: .9, shape: 'circle', radius: 2.0, origin: t, dmg: 18, style: 'shadow', fill: 'radial', pose: 'leap' }] }; } },
        { id: 'flurry', ok: d < 3.2, w: 3, move: () => ({ id: 'flurry', name: KabirI18n.t('Kemik Pençe Seli'), duration: 1.95, pose: 'clawR', retreat: 1.0,
          movement: { start: .6, duration: .85, fromX: e.x, fromZ: e.z, x: e.x + Math.sin(e.face) * 1.0, z: e.z + Math.cos(e.face) * 1.0 }, hits: [
          { at: .55, warn: .55, shape: 'cone', radius: 2.6, arc: 2.0, dmg: 8, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'clawR' },
          { at: 1.0, warn: .45, shape: 'cone', radius: 2.6, arc: 2.0, track: true, dmg: 8, style: 'blade', fill: 'sweep', sweepDir: -1, pose: 'clawL' },
          { at: 1.5, warn: .5, shape: 'cone', radius: 2.9, arc: 2.3, track: true, dmg: 13, knockback: 2, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'clawR', attack: KabirI18n.t('Kemik Pençe Seli · son') }] }) },
        { id: 'flank', sp: 1, ok: !!dest, w: 4, move: () => {
          const f = angleTo(dest, player);
          return { id: 'flank', name: KabirI18n.t('Gölge Adımı'), duration: 1.6, pose: 'strafe', retreat: 1.0, faceAt: { t: .42, face: f },
            movement: { start: 0, duration: .42, fromX: e.x, fromZ: e.z, x: dest.x, z: dest.z, curve: 1.3 * dest.side, ease: true, shadow: true },
            hits: [{ at: 1.12, warn: .7, shape: 'cone', radius: 2.5, arc: 1.7, origin: dest, face: f, dmg: 15, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'clawR' }] }; } },
        { id: 'spurs', ok: d > 5 && d < 9.5, w: 2, move: () => ({ id: 'spurs', name: 'Diken Savurma', duration: 1.35, pose: 'throw', hits: [-.2, .2].map((o, i) => ({
          at: .85, warn: .85, shape: 'line', width: .7, length: clipLine(e, e.face + o, 10), face: e.face + o, dmg: 10, style: 'thrust', fill: 'forward', pose: 'throw', beat: i === 0,
          projectile: { kind: 'spur', flight: .18, fromY: 1.3 } })) }) }
      ]);
    }
    function poisonPool(enemy, x, z) {
      hazardFrom(enemy, { x, z, radius: 2.2, warn: .8, duration: 4.2, damage: 4, periodic: true, interval: .85,
        unblockable: true, attack: 'Veba Birikintisi', persistent: true, poison: true, style: 'bile', fill: 'radial', near: false });
    }
    function carrierAttack(e, d) {
      if (d > 10.5) return false;
      const pools = hazards.filter(h => h.owner === e && h.poison && h.persistent).length;
      return pick(e, [
        { id: 'spray', ok: d < 5.5, w: 3, move: () => ({ id: 'spray', name: KabirI18n.t('Veba Tükürüğü'), duration: 1.5, pose: 'spit', hits: [
          { at: .85, warn: .85, shape: 'cone', radius: 5.2, arc: .75, dmg: 12, style: 'bile', fill: 'forward', pose: 'spit' }] }) },
        { id: 'bodySwipe', ok: d < 2.9, w: 2, move: () => ({ id: 'bodySwipe', name: KabirI18n.t('Çürük Kol'), duration: 1.38, pose: 'clawL', hits: [
          { at: .72, warn: .72, shape: 'cone', radius: 2.8, arc: 2.1, dmg: 10, knockback: .8, style: 'blunt', fill: 'sweep', sweepDir: -1, pose: 'clawL' }] }) },
        { id: 'vial', sp: 1, ok: d > 5 && d < 10.5 && pools < 2, w: pools ? 1 : 3, move: () => {
          const t = { x: player.x, z: player.z };
          return { id: 'vial', name: KabirI18n.t('Şişe Fırlatma'), duration: 1.65, pose: 'throw', hits: [
            { at: 1.1, warn: 1.1, shape: 'circle', radius: 1.9, origin: t, dmg: 12, style: 'bile', fill: 'radial', pose: 'throw',
              projectile: { kind: 'vial', fromY: 1.6, flight: .6, height: 2.6 }, onActive() { poisonPool(e, t.x, t.z); } }] }; } },
        { id: 'exhale', sp: 1, ok: d < 3, w: 2, move: () => ({ id: 'exhale', name: KabirI18n.t('Çürük Nefes'), duration: 1.8, pose: 'roar', hits: [
          { at: 1.0, warn: 1.0, shape: 'circle', radius: 3.0, dmg: 12, unblockable: true, style: 'bile', fill: 'radial', pose: 'roar' }] }) }
      ]);
    }

    // ------------------------------------------------------------------ Zincir Celladı
    function roarMove(name, duration, cooldown) {
      return { id: 'roar', name, duration, pose: 'roar', cooldown, hits: [
        { at: 1.0, warn: 1.0, shape: 'circle', radius: 5.5, dmg: 5, knockback: 5, style: 'roar', fill: 'radial', pose: 'roar', cancelOnStagger: false, parry: 'deflect' }] };
    }
    function kickMove() {
      return { id: 'kick', name: KabirI18n.t('Cellat Tekmesi'), duration: 1.05, pose: 'kick', hits: [
        { at: .5, warn: .5, shape: 'cone', radius: 2.6, arc: 1.9, dmg: 12, knockback: 5.5, parryStagger: 1.0, style: 'blunt', fill: 'forward', pose: 'kick' }] };
    }
    function slamMove(e, d, after) {
      const f = e.face, k = clamp(d, 3, 6), t = { x: e.x + Math.sin(f) * k, z: e.z + Math.cos(f) * k };
      const hits = [
        { at: after ? 1.35 : 1.4, warn: after ? 1.35 : 1.4, shape: 'circle', radius: 2.3, origin: t, dmg: 34, unblockable: true, style: 'quake', fill: 'inward', pose: 'overhead', scar: true, attack: KabirI18n.t('Mezar Kıran') },
        { at: after ? 1.5 : 1.55, warn: after ? 1.5 : 1.55, shape: 'line', width: 1.4, length: 5.5, origin: t, face: f, dmg: 18, unblockable: true, style: 'quake', fill: 'forward', beat: false, scar: true, attack: KabirI18n.t('Mezar Kıran · yarık') }];
      // The aftershock appears only after the first impact, centred between the executioner and the crater.
      if (after) hits.push({ at: 2.95, warn: 1.2, shape: 'circle', radius: 3.6, origin: { x: t.x - Math.sin(f) * 2, z: t.z - Math.cos(f) * 2 }, dmg: 30, unblockable: true,
        style: 'quake', fill: 'inward', pose: 'overhead', scar: true, attack: KabirI18n.t('Mezar Kıran · artçı darbe') });
      return { id: 'slam', name: after ? KabirI18n.t('Mezar Kıran · artçı') : KabirI18n.t('Mezar Kıran'), duration: after ? 3.9 : 2.9, pose: 'overhead', hits };
    }
    function chargeMove(e, d, at, p2) {
      const f = e.face, L = clipLine(e, e.face, Math.min(11, d + 1));
      let run = L - 1.2; while (run > 1.5 && !walkable(e.x + Math.sin(f) * run, e.z + Math.cos(f) * run, e.radius)) run -= .5;
      const end = { x: e.x + Math.sin(f) * run, z: e.z + Math.cos(f) * run };
      const hits = [{ at, warn: at, shape: 'line', width: 2.3, length: L, dmg: 20, knockback: 5, guardPressure: 2, style: 'blunt', fill: 'forward', pose: 'charge', duration: .45,
        attack: p2 ? KabirI18n.t('Hamle ve Biçiş · hamle') : 'Omuz Hamlesi' }];
      if (p2) hits.push({ at: 2.0, warn: .9, shape: 'cone', radius: 4.6, arc: 3.0, origin: end, dmg: 24, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep', attack: KabirI18n.t('Hamle ve Biçiş · biçiş') });
      // Round 7 (flame-crash lane): the rush leaves a strip of burning chain-iron behind it for five seconds (low damage, shown .8 s before it ignites).
      if (p2 && mech) hits.push({ at: 1.5, warn: .8, shape: 'line', width: 1.8, length: run + 1, origin: { x: e.x, z: e.z }, face: f, dmg: 5, persistent: true, periodic: true, interval: .7, duration: 5, pool: 'lava', style: 'ember', beat: false, attack: KabirI18n.t('Kor İzi') });
      return { id: 'charge', name: p2 ? KabirI18n.t('Hamle ve Biçiş') : 'Omuz Hamlesi', duration: p2 ? 2.9 : 2.2, pose: 'charge',
        movement: { start: at, duration: .45, fromX: e.x, fromZ: e.z, x: end.x, z: end.z }, hits };
    }
    function hookLine(e, d, at, warn, attack, extra) {
      return Object.assign({ at, warn, shape: 'line', width: 1.25, length: clipLine(e, e.face, Math.min(13, d + 1.5)), dmg: 16, pull: true, pullTo: 2.4, style: 'chain', fill: 'forward',
        pose: 'throw', projectile: { kind: 'hook', flight: .22, fromY: 1.7 }, attack }, extra || {});
    }
    // After a clean hook pull the executioner answers with a neck blow along the chain.
    function neckStrike(e, face) {
      if (e.dead || !e.action || e.stagger > 0) return;
      hazardFrom(e, { x: e.x, z: e.z, face, shape: 'line', width: 1.6, length: 3.8, delay: 0, warn: .85, damage: 20, style: 'blade', fill: 'forward', pose: 'overhead', attack: KabirI18n.t('Boyun Vuruşu'), near: true });
      e.action.duration = Math.max(e.action.duration, e.action.age + 1.45);
    }
    function hooksMove(e) {
      const p0 = { x: player.x, z: player.z }, th0 = rand(e) * TAU, pts = [p0];
      for (let k = 0; k < 4; k++) for (let tries = 0; tries < 6; tries++) {
        const a = th0 + k * 1.26 + tries * .37, r = 2.6 + rand(e) * 1.2, c = { x: p0.x + Math.sin(a) * r, z: p0.z + Math.cos(a) * r };
        if (walkable(c.x, c.z, .4)) { pts.push(c); break; }
      }
      return { id: 'hooks', name: KabirI18n.t('Yargı Kancaları'), duration: 2.9, pose: 'roar', onBegin() { e.hooksCd = e.enraged ? 13 : 18; },
        hits: pts.map((o, i) => ({ at: 1.3 + i * .25, warn: 1.3, shape: 'circle', radius: 1.5, origin: o, dmg: 17, unblockable: true, style: 'fall', fill: 'inward', pose: 'roar', beat: i === 0, scar: true })) };
    }

    // ---- Round 7: new executioner moves (TBC-raid mechanics seen through a top-down lens; every one has a >= .7 s ground tell, gold = ordinary, crimson = must-dodge).
    // Mechanic state (cool-downs, orbs, ritual anchors, the frenzy clock) lives in boss-mech.js; here are only the move builders and the choice tables.
    // A rite anchor must fit on the owner's side of the closed entrance. The static floor also exists beyond that seal.
    function anchorWalkable(x, z, radius, owner) {
      if (!walkable(x, z, radius)) return false;
      const seal = owner && seals.find(s => s.encounter === owner.encounter);
      if (!seal || seal.open) return true;
      return owner.z < seal.z ? z + radius <= seal.z : z - radius >= seal.z;
    }
    mech = BABA.BossMech ? BABA.BossMech.create({ root, player, game, hazards, addHazard, cancelHazards, walkable, anchorWalkable, propContacts, clearStrike, emit, sound, fx,
      groundY: (x, z) => world.effectHeightAt ? world.effectHeightAt(x, z, .6) : .06 }) : null;
    const PACE = () => tuning() ? tuning().pace : game.difficulty === 'hard' ? 1 : game.difficulty === 'easy' ? 1.2 : 1.12;   // beginMove stretches every move by this; timers that run outside a move follow it
    // Zincir Çekişi (gravity pull, then the slam on the spot where you land): a gold ring drags everything inside it to the executioner, a crimson circle under him
    // appears .3 s later and bursts 1 s after that. Roll through the ring (no pull) or roll out of the circle.
    function pullMove(e) {
      return { id: 'pull', name: KabirI18n.t('Zincir Çekişi'), duration: 3.7, pose: 'hookSwing', onBegin() { mech.mark(e, 'pull'); }, hits: [
        { at: 1.15, warn: 1.15, shape: 'ring', inner: 3.0, radius: 11.5, arc: TAU, dmg: 6, pull: true, pullTo: 2.0, style: 'chain', fill: 'inward', pose: 'hookSwing', attack: KabirI18n.t('Zincir Çekişi') },
        { at: 2.5, warn: 1.0, shape: 'circle', radius: 3.8, dmg: 30, unblockable: true, style: 'quake', fill: 'inward', pose: 'overhead', scar: true, attack: KabirI18n.t('Zincir Çekişi · ezme') }] };
    }
    // Cellat Sıçrayışı: closes a gap. He crouches, leaps and lands beside the hero's spot; the crimson circle is on the floor from the start.
    function leapMove(e, d) {
      const a = angleTo(e, player), want = Math.max(1.5, d - Math.min(1.7, d * .45)), L = Math.max(1.5, Math.min(want, clipLine(e, a, want + .3) - .3));
      const end = { x: e.x + Math.sin(a) * L, z: e.z + Math.cos(a) * L };
      return { id: 'leap', name: KabirI18n.t('Cellat Sıçrayışı'), duration: 2.4, pose: 'crouch', onBegin() { mech.mark(e, 'leap'); },
        movement: { start: .95, duration: .42, fromX: e.x, fromZ: e.z, x: end.x, z: end.z, leap: true },
        hits: [{ at: 1.4, warn: 1.4, shape: 'circle', radius: 3.4, origin: end, dmg: 26, unblockable: true, style: 'quake', fill: 'inward', pose: 'leap', scar: true, attack: KabirI18n.t('Cellat Sıçrayışı') }] };
    }
    // Yarılan Zemin (Gruul-style shatter): a crater, then cracks roll out of it in rays, three segments each, every segment shown .8 s ahead.
    function cracksMove(e, d, rays) {
      const f = e.face, k = clamp(d, 3.2, 5.5), t = { x: e.x + Math.sin(f) * k, z: e.z + Math.cos(f) * k }, a0 = f + rand(e) * TAU / rays;
      const hits = [{ at: 1.3, warn: 1.3, shape: 'circle', radius: 2.5, origin: t, dmg: 24, knockback: 4, unblockable: true, style: 'quake', fill: 'inward', pose: 'overhead', scar: true, attack: KabirI18n.t('Yarılan Zemin') }];
      for (let r = 0; r < rays; r++) for (let s = 0; s < 3; s++) {
        const a = a0 + r * TAU / rays, c = 1.9 + s * 3.15;
        hits.push({ at: 1.8 + s * .4 + r * .06, warn: .8, shape: 'line', width: 1.7, length: 3.3, origin: { x: t.x + Math.sin(a) * c, z: t.z + Math.cos(a) * c }, face: a, dmg: 11, style: 'quake', fill: 'forward', beat: false, scar: s === 2, attack: KabirI18n.t('Yarılan Zemin · çatlak') });
      }
      return { id: 'fissures', name: KabirI18n.t('Yarılan Zemin'), duration: 3.9, pose: 'overhead', onBegin() { mech.mark(e, 'fissures'); }, hits };
    }
    // Çöken Tavan: stones come down in a drumroll, the first ones around the hero, the rest across the floor (gold circles, 1.05 s each).
    function caveInMove(e, n) {
      const hits = [];
      for (let i = 0; i < n; i++) {
        let o = null;
        for (let tries = 0; tries < 6 && !o; tries++) {
          const a = rand(e) * TAU, r = i < 3 ? 1.2 + rand(e) * 2.4 : 3 + rand(e) * 5.5, c = { x: player.x + Math.sin(a) * r, z: player.z + Math.cos(a) * r };
          if (walkable(c.x, c.z, .5)) o = c;
        }
        if (o) hits.push({ at: 1.35 + i * .3, warn: 1.05, shape: 'circle', radius: 1.65, origin: o, dmg: 14, style: 'fall', fill: 'inward', pose: 'roar', beat: i === 0, scar: i % 2 === 0, attack: KabirI18n.t('Çöken Tavan') });
      }
      return { id: 'fall', name: KabirI18n.t('Çöken Tavan'), duration: 1.5 + n * .3 + 1, pose: 'roar', onBegin() { mech.mark(e, 'fall'); }, hits };
    }
    // Asılı Zincirler: chain lanes drop from the ceiling across the hero's side of the floor, one by one; the gaps between lanes are safe.
    function whipLanesMove(e, n) {
      const f = e.face, fs = Math.sin(f), fc = Math.cos(f), us = Math.cos(f), uc = -Math.sin(f), gap = n > 5 ? 2.5 : 3.0, hits = [];
      const order = n > 5 ? [3, 0, 6, 1, 5, 2, 4] : [2, 0, 4, 1, 3];
      for (let i = 0; i < n; i++) {
        const lat = (i - (n - 1) / 2) * gap, at = 1.3 + order.indexOf(i) * .36;
        hits.push({ at, warn: .95, shape: 'line', width: 1.5, length: 15, origin: { x: player.x + us * lat - fs * 7.5, z: player.z + uc * lat - fc * 7.5 }, face: f, dmg: 14, style: 'chain', fill: 'forward', pose: 'chainLash', beat: i === 0, attack: KabirI18n.t('Asılı Zincirler') });
      }
      return { id: 'chainLanes', name: KabirI18n.t('Asılı Zincirler'), duration: 1.3 + n * .36 + .8, pose: 'chainLash', onBegin() { mech.mark(e, 'chainLanes'); }, hits };
    }
    // Kor Mühürleri (Void-Reaver-style seeking orbs): see boss-mech.js. The harmless hit only times the release of the orbs with the cast pose.
    function orbsMove(e, n, kind) {
      return { id: 'orbs', name: kind === 'brine' ? KabirI18n.t('Boğulmuş Fenerler') : KabirI18n.t('Kor Mühürleri'), duration: 2.5, pose: 'castHigh', onBegin() { mech.mark(e, 'orbs'); }, hits: [
        { at: 1.0, warn: 1.0, shape: 'circle', radius: .1, harmless: true, dmg: 0, style: 'ember', pose: 'castHigh', onActive() { if (mech && !e.dead) mech.launchOrbs(e, n, { kind, speed: e.enraged ? 3.35 : 3.05 }); } }] };
    }
    // Kanlı Yemin Çemberi (Magtheridon-style channel + cubes): he roots himself and channels a nova over the whole hall in three pulses; four chain anchors burn around him.
    // Each pulse hurts for 6 + 7 per anchor still lit; stand beside an anchor ~2.4 s (or strike it) to snuff it; all dark = the channel breaks and he reels for 3 s.
    function riteMove(e, seconds) {
      const T = seconds, pulse = function () { const k = mech ? mech.riteLit() : 0; this.damage = k ? 6 + 7 * k : 0; if (!k) this.harmless = true; };
      return { id: 'rite', name: KabirI18n.t('Kanlı Yemin Çemberi'), duration: T + 2.9, pose: 'castHigh', cooldown: 1.2, hits: [0, 0.9, 1.8].map((dt, i) => (
        { at: T + dt, warn: i ? .8 : T, shape: 'circle', radius: 15.5, dmg: 40, unblockable: true, style: 'rune', fill: 'inward', pose: 'castHigh', beat: i === 0, onActive: pulse, attack: KabirI18n.t('Kanlı Yemin Çemberi') })) };
    }
    const coast = BABA.CoastCombat ? BABA.CoastCombat.create({ player, pick, beginMove, clipLine, walkable, cancelHazards, emit, sound, fx, bonus: (x,z,n) => { if (globes) globes.bonus(x,z,n); } }) : null;
    const ruins = BABA.RuinsCombat ? BABA.RuinsCombat.create({ player, pick, beginMove, clipLine, walkable, cancelHazards, emit, sound, fx, bonus: (x,z,n) => { if (globes) globes.bonus(x,z,n); } }) : null;
    const forge = BABA.ForgeCombat ? BABA.ForgeCombat.create({ player, pick, beginMove, clipLine, walkable, cancelHazards, emit, sound, fx, bonus: (x,z,n) => { if (globes) globes.bonus(x,z,n); } }) : null;
    const finale = BABA.FinaleCombat && chapter === FINAL ? BABA.FinaleCombat.create({ player, pick, beginMove, clipLine, walkable, cancelHazards, emit, sound, fx, game, enemies, slow: s => slowMotion(s), bonus: (x,z,n) => { if (globes) globes.bonus(x,z,n); } }) : null;
    // Round 7: chapter III / IV boss set pieces (orbs, cover pillars, adds, burning ground) live in boss2.js; the move tables get a handle on it.
    if (BABA.Boss2 && chapter >= 2) {
      boss2 = BABA.Boss2.create({ root, world, chapter, game, player, enemies, hazards, emit, sound, fx, walkable, hitPlayer, hazardFrom, addHazard, killEnemy, restoreEnemy: enemy => { if (limbs) limbs.restore(enemy); Object.assign(enemy, freshEnemyFields(enemy)); enemy.poiseRecovery = 0; } });
      if (ruins && ruins.attach) ruins.attach(boss2);
      if (forge && forge.attach) forge.attach(boss2);
      if (finale && finale.attach) finale.attach(boss2);
    }
    // ajan:bosses — shared boss director + champion modifiers (see the header notes of boss-framework.js / mob-mods.js).
    const bfApi = { root, world, chapter, game, player, enemies, hazards, emit, sound, fx, walkable, clipLine, clearStrike, beginMove, hazardFrom, addHazard, hitPlayer, slowMotion,
      groundY: (x, z) => world.effectHeightAt ? world.effectHeightAt(x, z, .6) : .06 };
    if (BABA.BossFramework) director = BABA.BossFramework.create(bfApi);
    if (BABA.MobMods) mobMods = BABA.MobMods.create(bfApi);
    if (BABA.MobAbilities) mobAbil = BABA.MobAbilities.create(bfApi);   // innate role abilities of ordinary foes (mob-abilities.js)
    function bossAttack(e, d) {
      if (d > 14.5) return false;
      const m = mech, ph = e.phase === 2 ? (e.enraged ? 3 : 2) : 1, hpf = e.hp / e.maxHp, last = e.lastMove;
      e.cdScale = (ph === 3 ? .86 : .9) * (m && m.frenzied(e) ? .82 : 1);
      // The ritual: at 40 % and again at 15 % of his health he roots himself, chains four braziers around him and channels the nova (rite).
      if (m && e.phase === 2 && !m.riteActive() && m.liveOrbs() === 0 && m.count(e, 'rite') < 2 && hpf <= (m.count(e, 'rite') ? .15 : .40) && m.ready(e, 'rite', 28) && m.startRite(e, 4, 8.6, 11 * PACE())) {
        m.bump(e, 'rite'); m.mark(e, 'rite'); return beginMove(e, riteMove(e, 11));
      }
      const majorBusy = m && (m.liveOrbs() > 0 || m.riteActive());
      const fresh = (id, cd) => m && !majorBusy && m.ready(e, id, cd), pullOk = d > 4.5 && d < 11 && fresh('pull', 15), leapOk = d > 7.5 && fresh('leap', 10), crackOk = d < 9 && fresh('fissures', 14);
      if (e.phase !== 2) return pick(e, [
        { id: 'hook', sp: 1, ok: d > 6, w: 3, move: () => ({ id: 'hook', name: KabirI18n.t('Kanca Atışı'), duration: 2.1, pose: 'hookSwing', hits: [
          hookLine(e, d, 1.25, 1.0, KabirI18n.t('Kanca Atışı'), { onHitPlayer(h) { neckStrike(e, h.face); } })] }) },
        { id: 'sweep', ok: d < 6, w: 3, move: () => ({ id: 'sweep', name: KabirI18n.t('Celladın Biçişi'), duration: 1.62, pose: 'sweep', hits: [
          { at: .82, warn: .82, shape: 'cone', radius: 5.4, arc: 3.6, dmg: 26, knockback: 3, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep' }] }) },
        { id: 'slam', sp: 1, ok: d > 2.5 && d < 8, w: 2, move: () => slamMove(e, d, false) },
        { id: 'lash', ok: d > 2.6 && d < 7.5, w: 2, move: () => ({ id: 'lash', name: KabirI18n.t('Zincir Savuruşu'), duration: 1.4, pose: 'chainLash', hits: [
          { at: .8, warn: .8, shape: 'ring', inner: 2.8, radius: 7.2, arc: 2.6, dmg: 17, guardPressure: 1.6, style: 'chain', fill: 'sweep', sweepDir: -1, pose: 'chainLash' }] }) },
        { id: 'charge', ok: d > 7.5, w: 2, move: () => chargeMove(e, d, .95, false) },
        { id: 'kick', ok: d < 2.4, w: 2, move: kickMove },
        { id: 'pull', sp: 1, ok: !!m && pullOk, w: 3, move: () => pullMove(e) },
        { id: 'leap', sp: 1, ok: !!m && leapOk, w: 3, move: () => leapMove(e, d) },
        { id: 'fissures', sp: 1, ok: !!m && crackOk, w: 3, move: () => cracksMove(e, d, 4) }
      ]);
      const orbOk = fresh('orbs', 19) && m.liveOrbs() === 0;
      return pick(e, [
        { id: 'hook', sp: 1, ok: d > 6, w: 3, move: () => ({ id: 'hook', name: KabirI18n.t('Kanca ve Biçme'), duration: 3.1, pose: 'hookSwing', hits: [
          hookLine(e, d, 1.2, .95, KabirI18n.t('Kanca ve Biçme · kanca')),
          { at: 2.3, warn: 1.0, shape: 'cone', radius: 5.2, arc: 3.6, dmg: 26, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep', attack: KabirI18n.t('Kanca ve Biçme · savuruş') }] }) },
        { id: 'sweep', ok: d < 6, w: 3, move: () => ({ id: 'sweep', name: KabirI18n.t('Çifte Biçiş'), duration: 2.15, pose: 'sweep', cooldown: .5, hits: [
          { at: .82, warn: .82, shape: 'cone', radius: 5.4, arc: 3.6, dmg: 24, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep', attack: KabirI18n.t('Çifte Biçiş · ilk') },
          { at: 1.5, warn: .62, shape: 'cone', radius: 5.8, arc: 3.6, face: e.face + .5, dmg: 26, style: 'blade', fill: 'sweep', sweepDir: -1, parry: 'deflect', pose: 'sweepBack', attack: KabirI18n.t('Çifte Biçiş · dönüş') }] }) },
        { id: 'slam', sp: 1, ok: d > 2.5 && d < 8 && e.lastMove !== 'hooks', w: 2, move: () => slamMove(e, d, true) },
        { id: 'cyclone', sp: 1, ok: d < 7, w: 2, move: () => ({ id: 'cyclone', name: KabirI18n.t('Zincir Kasırgası'), duration: 3.2, pose: 'spin', cooldown: 1.9, hits: [1.2, 1.8, 2.4].map((at, i) => ({
          at, warn: i ? .6 : 1.2, shape: 'ring', inner: 2.4, radius: 6.2, arc: TAU, dmg: 11, guardPressure: 1.2, style: 'chain', fill: 'sweep', sweepDir: 1, pose: 'spin' })) }) },
        { id: 'hooks', sp: 1, ok: !majorBusy && e.hooksCd <= 0 && e.lastMove !== 'slam', w: 4, move: () => hooksMove(e) },
        { id: 'charge', ok: d > 6, w: 2, move: () => chargeMove(e, d, .9, true) },   // was d > 7.5: with the specials held back this is his plain blow at mid range
        { id: 'kick', ok: d < 2.4, w: last === 'sweep' ? 6 : 2, move: kickMove },   // the double sweep is followed by the kick when the hero is still close
        { id: 'pull', sp: 1, ok: !!m && pullOk, w: 3, move: () => pullMove(e) },
        { id: 'leap', sp: 1, ok: !!m && leapOk, w: 3, move: () => leapMove(e, d) },
        { id: 'fissures', sp: 1, ok: !!m && crackOk, w: 3, move: () => cracksMove(e, d, ph === 3 ? 6 : 5) },
        { id: 'fall', sp: 1, ok: !!m && d < 13 && fresh('fall', 15), w: 3, move: () => caveInMove(e, ph === 3 ? 10 : 8) },
        { id: 'chainLanes', sp: 1, ok: !!m && d < 13 && fresh('chainLanes', 13), w: 3, move: () => whipLanesMove(e, ph === 3 ? 7 : 5) },
        { id: 'orbs', sp: 1, ok: !!m && orbOk && d < 14, w: 3, move: () => orbsMove(e, ph === 3 ? 3 : 2, 'ember') }
      ]);
    }

    function activateEncounters() {
      if (openingGrace > 0 && distance(player, spawn) < 4 && !player.attack) return;
      openingGrace = 0;
      for (const enc of encounterDefs) {
        let alive = 0, nearest = Infinity, isBoss = false;
        for (const e of enc.enemies) { if (e.dead) continue; alive++; const d = distance(e, player); if (d < nearest) nearest = d; if (e.boss) isBoss = true; }
        if (!alive || isBoss && gate && !gate.info.open) continue;
        const arenaSeal = isBoss && seals.find(seal => seal.encounter === enc);
        const inArena = !arenaSeal || player.z < arenaSeal.z - .6;
        const nearbyRoom = !game.currentRoom || String(game.currentRoom.id) === String(enc.room) || nearest < 8;
        if (!enc.activated && inArena && nearbyRoom && nearest < (isBoss ? 13 : 13.2)) {
          enc.activated = true; game.activeEncounter = enc.name;
          if (!enc.announced) { emit('encounter', { name: enc.name, room: enc.room }); enc.announced = true; }
          for (const e of enc.enemies) if (!e.dead) { e.active = true; e.activated = true; e.cooldown = Math.max(e.cooldown, .6 + e.index % 4 * .22); }
          if (isBoss) { if (arenaSeal) { arenaSeal.open = false; arenaSeal.fade = 0; arenaSeal.group.visible = true; } emit('boss', { name: game.boss ? game.boss.name : STATS.boss.name, active: true }); sound('boss');
            if (chapter >= 3 && game.boss) { emit('impact', { x: game.boss.x, z: game.boss.z, strength: 1, radius: 9 }); slowMotion(.4); } }   // chapter III / IV boss wake-up: camera jolt + a beat of slow motion
        }
        if (isBoss && inArena && enc.activated && arenaSeal && arenaSeal.open) {
          arenaSeal.open = false; arenaSeal.fade = 0; arenaSeal.group.visible = true;
        }
        // Every nearby area can wake independently; skipped enemies do not block later encounters.
      }
    }
    // Kanlı Yemin: the executioner roars (a gold shockwave that pushes the hero out), then chains his blows.
    function enemyPhaseChange(enemy) {
      if (enemy.stats.finale && finale) { finale.phase(enemy); return; }
      if (enemy.stats.forge) { forge.phase(enemy); return; }
      if (enemy.stats.ruins) { ruins.phase(enemy); return; }
      if (enemy.stats.coast) { coast.phase(enemy); return; }
      if (!enemy.boss || enemy.phase !== 1 || enemy.hp > enemy.maxHp * .52) return;
      enemy.phase = 2; enemy.action = null; enemy.stagger = 0; enemy.faceLocked = false;
      if (globes) globes.bonus(enemy.x, enemy.z, 2);   // the only globes of the executioner fight
      cancelHazards(enemy, false); flashRing(enemy.x, enemy.z, 4.5, 0xd25949, 1.2);
      emit('warning', { x: enemy.x, z: enemy.z, text: KabirI18n.t('ZİNCİR CELLADI · KANLI YEMİN') });
      emit('toast', { text: KabirI18n.t('Cellat zincirini kopardı. Darbeler artık birbirini izliyor.') }); sound('bossPhase');
      fx('bossPhase', { x: enemy.x, y: 1.4, z: enemy.z });
      enemy.face = angleTo(enemy, player); beginMove(enemy, roarMove(KabirI18n.t('Kanlı Yemin'), 1.7, 1.0));
    }
    function advanceMovement(enemy, action, dt) {
      const m = action.movement, p0 = clamp((action.age - dt - m.start) / m.duration, 0, 1), p1 = clamp((action.age - m.start) / m.duration, 0, 1);
      if (p1 <= p0) return;
      const dx = m.x - m.fromX, dz = m.z - m.fromZ, len = Math.hypot(dx, dz) || 1;
      const at = k => { const e = m.ease ? k * k * (3 - 2 * k) : k, bend = m.curve ? Math.sin(k * Math.PI) * m.curve : 0;
        return { x: dx * e - dz / len * bend, z: dz * e + dx / len * bend }; };
      const a = at(p0), b = at(p1);
      moveBody(enemy, b.x - a.x, b.z - a.z, enemy.radius);
    }
    function advanceEnemyAction(enemy, dt) {
      const action = enemy.action; action.age += dt;
      if (action.feintAt && action.age >= action.feintAt) {
        // Feint: the body sold the blow but no tell ever reached the floor; the next real move gets its full warning.
        cancelHidden(enemy); enemy.action = null; enemy.faceLocked = false; enemy.cooldown = .35;
        if (action.feintKind === 'sidestep') enemy.sidestep = .45;
        return;
      }
      if (action.faceAt && action.age >= action.faceAt.t) enemy.face = action.faceAt.face;
      if (action.moveId === 'pairMirror') {
        const a = action.pairWith;
        if (!a || a.dead || !a.action || a.action.moveId !== 'pair') { enemy.action = null; enemy.faceLocked = false; enemy.cooldown = .6; return; }
      }
      // A short whoosh as armed swings release (not for spells, spit or claws, which have their own cues).
      if (enemy.boss || enemy.type === 'guard' || enemy.type === 'stalker') for (const b of action.beats) {
        if (!b.whooshed && action.age >= b.strike - (enemy.boss ? .2 : .13)) { b.whooshed = true; if (distance(enemy, player) < 16) sound('enemySwing', { x: enemy.x, z: enemy.z, type: enemy.type, heavy: enemy.boss || enemy.type === 'guard', strikeIn: Math.max(0, b.strike - action.age), volume: enemy.boss ? .9 : .55 }); }
      }
      if (action.movement) advanceMovement(enemy, action, dt);
      if (action.age >= action.duration) {
        enemy.action = null; enemy.faceLocked = false;
        let cd = action.cooldown != null ? action.cooldown : enemy.stats.cooldown;
        // The executioner gives no breathing room to a hero standing inside his axe's reach; step out to earn it.
        cd *= SPECIAL_IDS.includes(action.moveId) ? SPECIAL_REST : action.moveId === 'roar' ? 1 : PLAIN_REST;
        if (enemy.boss) cd *= (enemy.enraged ? .65 : enemy.phase === 2 ? .75 : 1) * (distance(enemy, player) < 3.6 && action.cooldown == null ? .55 : 1);
        if (enemy.cdScale) cd *= enemy.cdScale;   // round 7: the chapter I / II bosses rest less (set per phase / frenzy in their attack tables)
        else if (enemy.type === 'prisoner' && enemy.hp < enemy.maxHp * .3) cd *= .7;
        const scaled = cd * (enemy.campaignPace || 1) * (tuning() ? tuning().rest : game.difficulty === 'easy' ? 1.25 : game.difficulty === 'normal' ? 1.15 : 1) * (enemy.tutorialStage === 0 ? 1.2 : enemy.tutorialStage === 1 ? 1.1 : 1);
        // A visible punish window survives late-phase and frenzy acceleration. Heavy commitments leave longer openings.
        enemy.recoveryFloor = enemy.boss ? (SPECIAL_IDS.includes(action.moveId) ? .58 : .36) : enemy.elite ? .28 : .14;
        enemy.cooldown = Math.max(enemy.recoveryFloor, scaled);
      }
    }
    function updateEnemy(enemy, dt) {
      enemy.hurt = Math.max(0, enemy.hurt - dt * 3); enemy.blockImpact = Math.max(0, (enemy.blockImpact || 0) - dt * 5);
      if (enemy.dead) {
        enemy.deadAge += dt; enemy.move = 0;
        // the body hits the floor: a kick of dust (the matching bounce is in enemy-polish.js, same landTime)
        if (!enemy._landed && BABA.EnemyPolish && enemy.deadAge >= BABA.EnemyPolish.landTime(enemy.deathKind === 'blown', enemy.boss) && enemy.deadAge < 3) {
          enemy._landed = true; fx('land', { x: enemy.x, y: .05, z: enemy.z, big: enemy.boss || enemy.radius > .6, blown: enemy.deathKind === 'blown', face: enemy.face });
          if (enemy.boss || enemy.radius > .6) emit('impact', { x: enemy.x, z: enemy.z, strength: enemy.boss ? .8 : .3 });   // a heavy body hitting the floor: camera jolt that fades with distance
        }
        return;
      }
      const homeDistance = Math.hypot(enemy.x - enemy.spawnX, enemy.z - enemy.spawnZ);
      if (!enemy.boss && (enemy.returning || (enemy.active && (distance(enemy, player) > 18 || homeDistance > 13)))) {
        if (!enemy.returning) { enemy.action = null; enemy.faceLocked = false; cancelHazards(enemy, false); }
        enemy.returning = true; enemy.active = false; enemy.shield = false;
        if (homeDistance > .8) {
          walkTo(enemy, { x: enemy.spawnX, z: enemy.spawnZ }, enemy.stats.speed, dt);
        } else { enemy.returning = false; enemy.move = 0; enemy.cooldown = Math.max(enemy.cooldown, .8); }
        return; // Keep wounds; retreat never restores enemy health.
      }
      applyPush(enemy, dt, enemy.radius);
      enemy.buff = Math.max(0, enemy.buff - dt); enemy.buffCooldown -= dt;
      enemy.shieldBroken = Math.max(0, enemy.shieldBroken - dt); enemy.poiseRecovery = Math.max(0, enemy.poiseRecovery - dt); enemy.cooldown -= dt; enemy.recoveryFloor = Math.max(0, (enemy.recoveryFloor || 0) - dt);
      enemy.grabCd -= dt; enemy.riposteCd -= dt; enemy.hooksCd -= dt; enemy.fear = Math.max(0, enemy.fear - dt);
      enemy.move = 0;
      if (!enemy.active) return;
      enemyPhaseChange(enemy);
      if (enemy.stagger > 0) { enemy.stagger -= dt; enemy.shield = false; return; }
      if (enemy.action) { advanceEnemyAction(enemy, dt); return; }
      const d = distance(enemy, player);
      // Retreating past an encounter does not erase its consequences; enemies do not silently reset mid-fight.
      if (d > 34) { enemy.active = false; return; }
      enemy.face = angleTo(enemy, player); enemy.shield = enemy.type === 'guard' && enemy.shieldBroken <= 0;
      if (!enemy.stats.coast && !enemy.stats.ruins && !enemy.stats.forge && enemy.boss && enemy.phase === 2 && !enemy.enraged && enemy.hp <= enemy.maxHp * .25) {
        // Son Yemin: once, the executioner swears again: faster between blows and more judgement hooks (damage unchanged).
        enemy.enraged = true; enemy.hooksCd = Math.min(enemy.hooksCd, 2);
        if (globes) globes.bonus(enemy.x, enemy.z, 1);
        emit('toast', { text: KabirI18n.t('Cellat son yeminini etti. Kancalar daha sık düşecek.') }); sound('bossPhase');
        beginMove(enemy, roarMove(KabirI18n.t('Son Yemin'), 1.4, .8)); advanceEnemyAction(enemy, dt); return;
      }
      // Wrath: the executioner does not stand still under a flurry. Enough blows between his moves and he answers at once
      // with the kick (a normal .55 s tell), which throws the hero back out to his swing room.
      if (!enemy.stats.coast && !enemy.stats.ruins && !enemy.stats.forge && enemy.boss) { enemy.wrath = Math.max(0, enemy.wrath - dt * 12); if (enemy.wrath >= 70 && d < 3.2) { enemy.wrath = 0; if (beginMove(enemy, kickMove())) { advanceEnemyAction(enemy, dt); return; } } }
      if (enemy.cooldown <= 0 && enemy.fear <= 0 && openAttackSlots(enemy)) {
        let attacked = false;
        if (enemy.boss && director && director.attack(enemy, d)) attacked = true;
        else if (enemy.stats.finale && finale) attacked = finale.attack(enemy, d);
        else if (enemy.stats.forge) attacked = forge.attack(enemy, d);
        else if (enemy.stats.ruins) attacked = ruins.attack(enemy, d);
        else if (enemy.stats.coast) attacked = coast.attack(enemy, d);
        else if (enemy.type === 'prisoner') attacked = prisonerAttack(enemy, d);
        else if (enemy.type === 'guard') attacked = guardAttack(enemy, d);
        else if (enemy.type === 'cultist') attacked = cultistAttack(enemy, d);
        else if (enemy.type === 'stalker') attacked = stalkerAttack(enemy, d);
        else if (enemy.type === 'carrier') attacked = carrierAttack(enemy, d);
        else if (enemy.boss) attacked = bossAttack(enemy, d);
        if (attacked) {
          // New hazards advance later in this same step. Advance their action
          // too, so blade contact and leap motion share that exact clock.
          if (enemy.action) advanceEnemyAction(enemy, dt);
          return;
        }
      }
      const speed = enemy.stats.speed;
      if (enemy.fear > 0 && !enemy.boss) {
        // Cowed by the war cry: back away from the father, still facing him.
        const away = angleTo(player, enemy); if (d < 7) { moveBody(enemy, Math.sin(away) * speed * .55 * dt, Math.cos(away) * speed * .55 * dt, enemy.radius); enemy.move = .55; }
      } else if (enemy.sidestep > 0) {
        enemy.sidestep -= dt; const s = enemy.face + Math.PI / 2 * (enemy.index % 2 ? 1 : -1);
        moveBody(enemy, Math.sin(s) * speed * 1.4 * dt, Math.cos(s) * speed * 1.4 * dt, enemy.radius); enemy.move = 1;
      } else if (enemy.retreat > 0 && !enemy.boss && enemy.type !== 'guard') {
        enemy.retreat -= dt;
        const away = angleTo(player, enemy) + (enemy.index % 2 ? .6 : -.6), k = enemy.type === 'stalker' ? 1 : .8;
        moveBody(enemy, Math.sin(away) * speed * k * dt, Math.cos(away) * speed * k * dt, enemy.radius); enemy.move = k;
      } else if (enemy.stats.ranged || enemy.type === 'cultist' || enemy.type === 'carrier') {
        // A caster behind a pillar seeks a sightline; strafing forever into the wall is neither threatening nor fun.
        if (!clearStrike(enemy, player)) walkTo(enemy, player, speed * .85, dt);
        else if (d > ((enemy.spWait > 0 || enemy.spHold > 0) && enemy.type === 'carrier' ? 5.2 : 8.8)) walkTo(enemy, player, speed, dt);   // spit range while its bile moves are held back
        else if (d < 3.2 && enemy.cooldown > .35) {
          const retreatFace = enemy.face + Math.PI;
          // One modest withdrawal, close enough that committing to melee still catches the caster.
          moveBody(enemy, Math.sin(retreatFace) * speed * .45 * dt, Math.cos(retreatFace) * speed * .45 * dt, enemy.radius); enemy.move = .45;
        } else {
          const strafe = enemy.face + Math.PI / 2 * (enemy.index % 2 ? 1 : -1);
          moveBody(enemy, Math.sin(strafe) * .55 * dt, Math.cos(strafe) * .55 * dt, enemy.radius); enemy.move = .3;
        }
      } else if (['stalker', 'crawler', 'cavefang', 'slagcrawler', 'voidcrawler'].includes(enemy.type) && d > 3 && d < 6.5 && enemy.cooldown > .3) {
        const strafe = enemy.face + Math.PI / 2 * (enemy.index % 2 ? 1 : -1);
        moveBody(enemy, Math.sin(strafe) * speed * .8 * dt, Math.cos(strafe) * speed * .8 * dt, enemy.radius); enemy.move = .8;
      } else if (['guard', 'gravemason', 'forgesentinel', 'chainjailer'].includes(enemy.type)) {
        const post = guardPost(enemy);
        if (post && distance(enemy, post) > .35) { walkTo(enemy, post, speed * .85, dt); enemy.shield = enemy.type === 'guard' && enemy.shieldBroken <= 0; }
        else if (!post && d > (enemy.type === 'guard' ? 2.65 : 3.4)) walkTo(enemy, player, speed, dt);
      } else if (enemy.boss && d < 3.2 && enemy.cooldown > .3) {
        // Between moves he steps back to the length of his axe rather than trading blows at the hero's range.
        const away = angleTo(player, enemy); moveBody(enemy, Math.sin(away) * speed * .75 * dt, Math.cos(away) * speed * .75 * dt, enemy.radius); enemy.move = .75;
      } else if (TUNE && !enemy.boss && d < 3.3 && enemy.cooldown > .25 && enemy.stagger <= 0 && !enemy.stats.ranged) {
        // Waiting for its turn (rest or no free attack slot): circle the hero at blade range instead of standing still.
        // Odd and even foes go opposite ways; the radial term holds ~2.3 m so the ring keeps its pressure without crowding.
        const a = angleTo(player, enemy), side = enemy.index % 2 ? 1 : -1, radial = clamp(2.3 - d, -.6, .6), k = TUNE.FEEL.circle;
        moveBody(enemy, (Math.cos(a) * side * k + Math.sin(a) * radial) * speed * dt, (-Math.sin(a) * side * k + Math.cos(a) * radial) * speed * dt, enemy.radius); enemy.move = k;
      } else if (d > (enemy.boss ? 4 : 2.05)) walkTo(enemy, enemy.boss ? player : approachPoint(enemy), speed, dt);
      separateEnemies(enemy, dt);
    }

    // The upper target card follows attack intent/contact, independently of the cursor's hover ring.
    function trackAttackTarget(enemy) {
      if (game.state === 'playing' && enemy && !enemy.dead && enemy.model.root.visible) game.attackTarget = enemy;
    }
    function pendingFinalBossReward(enemy) {
      // Warden signatures also use the boss loot presentation. Only the defeated chapter boss's own reward delays the ending.
      return enemy && progression.groundLoot.find(i => i.chapter === chapter && i.uid === 'drop-' + chapter + ':' + enemy.id);
    }
    function killEnemy(enemy) {
      if (enemy.dead) return;
      enemy.dead = true; enemy._landed = false; enemy.hp = 0; enemy.deadAge = 0; enemy.action = null; enemy.shield = false; enemy.active = false; enemy.stagger = 0;
      if (game.attackTarget === enemy) game.attackTarget = null;
      cancelHazards(enemy, false); if (!enemy.reserve) game.kills++;
      if (mobMods) mobMods.kill(enemy);
      if (director && enemy.boss) director.slain(enemy);
      if (talents) talents.onKill(enemy);
      progression.grantEnemy(enemy.id, enemy.type, enemy.boss, chapter, game.difficulty, enemy.elite, enemy);
      syncProgression();
      if (gate) gate.kill(enemy);
      const seal = seals.find(seal => seal.encounter === enemy.encounter);
      if (seal && !seal.open && seal.encounter.enemies.every(e => e.dead)) {
        seal.open = true; sound('sealOpen');
        flashRing(seal.x, seal.z, 2.4, 0xc99f69, .9);
        if (game.activeEncounter === seal.encounter.name) game.activeEncounter = '';
        emit('encounterCleared', { name: seal.encounter.name, roomName: seal.encounter.roomName, nextName: seal.encounter.nextName, room: seal.encounter.room, x: seal.x, z: seal.z, text: seal.encounter.clearText });
        emit('toast', { text: enemy.boss ? KabirI18n.t('Arena açıldı. Boss yenildi.') : seal.encounter.clearText });
      }
      emit('kill', { name: enemy.name, boss: enemy.boss, x: enemy.x, z: enemy.z }); sound(enemy.boss ? 'bossDeath' : 'kill', { type: enemy.type, x: enemy.x, z: enemy.z });
      // The weight of the last death: the boss, or the final foe of a hall, falls in a beat of slow motion (every clock together).
      if (TUNE && !enemy.reserve) {
        if (enemy.boss) slowMotion(TUNE.FEEL.bossKillSlowmo);
        else if (enemy.encounter.enemies.every(e => e.dead || e.reserve)) slowMotion(TUNE.FEEL.lastKillSlowmo);
      }
      fx('death', { x: enemy.x, y: .8, z: enemy.z, boss: enemy.boss });
      if (globes && !enemy.boss) globes.roll(enemy, enemy.deathKind === 'blown' ? 'heavy' : 'light', angleTo(player, enemy), () => rand(enemy));   // health globe (seeded by the foe's own RNG)
      if (enemy.type === 'carrier') {
        addHazard({ owner: enemy, enemy: enemy.name, x: enemy.x, z: enemy.z, radius: 3.35, warn: 2.35, duration: .24,
          damage: 32, unblockable: true, attack: KabirI18n.t('Çürüyen Bedenin Patlaması'), persistent: true, style: 'bile', fill: 'inward', burst: true });
      }
      if (enemy.boss) {
        const drop = pendingFinalBossReward(enemy);
        if (groundLoot && drop) {
          clearHazards();
          emit('boss', {name:enemy.name,active:false});
          emit('toast', {text:KabirI18n.t(BABA.GroundLoot.auto ? 'Efendi yenildi. Emanetine yaklaş; kendiliğinden toplanır.' : 'Efendi yenildi. Düşürdüğü eşyaya tıkla ve al.')});
        } else win();
      }
      saveProfileChoices();
    }
    // Returns { blocked, killed } so the strike can size hit-stop, sound and camera for the whole swing.
    // Quest choices are read live, bounded independently of armor, and applied once per event. Never bake them into cached gear stats.
    function questBenefit(key, max) {
      const b = quests && quests.info && quests.info.benefits, value = b && b[key];
      return Number.isFinite(value) ? clamp(value, 0, max) : 0;
    }
    function enemyUnderground(enemy) {
      const action = enemy && enemy.action, burrow = action && action.burrow;
      return !!(burrow && action.age >= burrow.from && action.age < burrow.to);
    }
    function hurtEnemy(enemy, damage, heavy, attackFace, attack) {
      if (enemy.dead || enemyUnderground(enemy) || gate && gate.blocks(player.x, player.z, enemy.x, enemy.z, .15)) return null;
      // Roll once per committed attack, shared by its targets/ticks; equipment never displays decorative crit stats.
      if (attack && attack.critical === undefined) attack.critical = Math.random() < game.criticalChance;
      const critical = !!(attack && attack.critical);
      damage = Math.max(1, Math.round(damage * (player.damageMultiplier || 1) * (critical ? game.criticalMultiplier : 1) * (enemy.boss ? 1 + questBenefit('bossDamage', .20) : 1)));
      { const P = tuning(); if (P) damage = Math.round(damage * P.playerDmg); else if (game.difficulty !== 'hard') damage = Math.round(damage * 1.18); }
      // Opening after a last-moment roll: harder blows that stagger like heavy ones (bosses only take the damage).
      const opening = player.opening > 0 && !!ECON && !!attack;
      // Blows that land refill the stamina orb a little (combat-tuning.js ECONOMY.HIT); shield-blocked blows do not.
      if (ECON && attack && !(enemy.shield && Math.abs(angleDifference(angleTo(enemy, player), enemy.face)) < 1.4 && !heavy)) {
        const H = ECON.HIT, gain = attack.whirl ? H.whirl : attack.skill || attack.line ? H.skill : heavy ? H.heavy : H.light, room = H.cap - (attack.gained || 0);
        if (room > 0) { const g = Math.min(room, gain + (enemy.hp <= damage ? H.kill : 0)); attack.gained = (attack.gained || 0) + g; player.stamina = Math.min(player.maxStamina, player.stamina + g); staminaMark = player.stamina; }
      }
      if (opening) damage = Math.round(damage * ECON.PERFECT.damage);
      if (attack) trackAttackTarget(enemy);
      const toPlayer = angleTo(enemy, player), fromFront = Math.abs(angleDifference(toPlayer, enemy.face)) < 1.4;
      const finisher = !!(attack && !heavy && attack.combo === 2), away = angleTo(player, enemy);
      const blocked = enemy.shield && fromFront && !heavy;
      // The executioner braces through his own wind-ups: blows glance off his plate (sparks) until his swing is spent.
      // Punish him in the recovery, after a parry, or while the axe is stuck in the floor.
      const braced = enemy.boss && enemy.action && enemy.action.beats.length && enemy.action.age < enemy.action.beats[0].strike && enemy.stagger <= 0;
      if (braced) damage = Math.round(damage * .55);
      const height = (enemy.model.height || 2.2) * (enemy.boss ? .42 : .5), contact = {
        x: enemy.x - Math.sin(away) * enemy.radius * .65, y: Math.min(1.75, height), z: enemy.z - Math.cos(away) * enemy.radius * .65 };
      enemy.hitAngle = angleDifference(toPlayer, enemy.face); enemy.hurtHeavy = heavy || finisher;
      if (blocked) {
        damage = Math.max(2, Math.round(damage * .18)); sound('block', { enemy: true });
        push(enemy, away, FEEL.knock.shield); enemy.blockImpact = 1;
        // Every second light blow into the shield is answered with a falchion thrust (Pala Dürtüşü).
        if (enemy.type === 'guard' && !enemy.action && enemy.stagger <= 0 && enemy.riposteCd <= 0 && ++enemy.blockCount % 2 === 0) {
          enemy.face = angleTo(enemy, player); if (guardRiposte(enemy)) enemy.riposteCd = 3.5;
        }
      } else {
        enemy.hurt = 1; enemy.hitDirection = Math.sin(toPlayer - enemy.face);
        // Multi-hit spins (a tick every ~.28 s) would re-fire the white body flash (lighting.js) at full strength each tick: soften it.
        enemy.flashScale = attack && attack.whirl ? .4 : 1;
        const breaksGuard = heavy && enemy.type === 'guard' && fromFront && enemy.shield;
        if (breaksGuard) {
          enemy.shieldBroken = 4; enemy.shield = false;
          emit('toast', { text: KabirI18n.t('Muhafızın savunması kırıldı.') }); sound('guardBreak');
        }
        const canStagger = !enemy.boss && (breaksGuard || enemy.poiseRecovery <= 0 && (heavy || enemy.type === 'cultist' || (!enemy.action && enemy.type !== 'guard') || (attack && attack.rage && enemy.type !== 'guard') || (opening && enemy.type !== 'guard')));
        if (canStagger) {
          enemy.staggerVariant = (attackSerial + enemy.index) % 3;   // reel back / twist aside / buckle (authored-motion.js)
          enemy.stagger = enemy.staggerTotal = heavy ? .55 : opening ? .42 : .22; enemy.staggerKind = breaksGuard ? 'guardBreak' : heavy || opening ? 'heavy' : 'light';
          enemy.action = null; enemy.faceLocked = false;
          enemy.poiseRecovery = heavy ? 3 : 1.1;
          enemy.cooldown = Math.max(enemy.cooldown, heavy ? .9 : .3); cancelHazards(enemy, true);
        }
        push(enemy, away, enemy.boss ? (heavy ? FEEL.knock.bossHeavy : FEEL.knock.boss) : heavy ? FEEL.knock.heavy : finisher ? FEEL.knock.finisher : FEEL.knock.light);
        if (breaksGuard) enemy.guardBroke = true;
      }
      if (mobMods && !blocked) damage = mobMods.hurt(enemy, damage, heavy || !!(attack && (attack.whirl || attack.rage)), blocked);
      if (director && enemy.boss) damage = director.hurt(enemy, damage);
      if (mobAbil && !blocked) damage = mobAbil.hurt(enemy, damage, attackFace);
      if (talents && !blocked) damage = talents.outgoing(enemy, damage, attack);
      enemy.hp = Math.max(0, enemy.hp - damage); if (enemy.boss && !enemy.action) enemy.wrath += damage;
      if (player.rageTime > 0 && !blocked && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + damage * ROAR.steal * (1 + questBenefit('healingBonus', .20)) * 100 / player.effectiveMaxHp);   // blood fury: a little of every blow comes back
      const killed = enemy.hp <= 0;
      if (talents && !blocked) talents.onHit(enemy, damage, attack, killed);
      if (killed) enemy.deathKind = !enemy.boss && (heavy || finisher) ? 'blown' : '';
      const spray = attack ? sweepAngle(attack) : attackFace;
      emit('hit', { target: 'enemy', x: enemy.x, z: enemy.z, damage, blocked, braced, heavy, critical: critical || opening, opening, face: attackFace, combo: attack ? attack.combo : 0, finisher, kill: killed,
        hitstop: 0, impact: blocked ? .3 : heavy ? 1 : finisher ? .8 : .45 });
      fx(blocked ? 'spark' : 'blood', { x: contact.x, y: contact.y, z: contact.z, damage, labelTarget: enemy, heavy: heavy || finisher || opening, critical: critical || opening, face: attackFace, spray, kill: killed, boss: enemy.boss, shield: blocked, rage: !!(attack && attack.rage), braced });
      if (braced && !killed) fx('spark', { x: contact.x, y: contact.y + .2, z: contact.z, face: attackFace, glance: true });
      if (killed) killEnemy(enemy);
      else enemyPhaseChange(enemy);
      if (killed && limbs && !enemy.boss) {
        // Killing blows can sever a limb or the head (cosmetic only; the foe's own seeded rand keeps runs repeatable).
        const kind = attack && attack.whirl ? (attack.ticks >= SPECIAL.ticks ? 'whirlLast' : 'whirl') : heavy ? 'heavy' : finisher ? 'finisher' : 'light';
        if (limbs.cut(enemy, kind, attackFace, () => rand(enemy), player) && heavy && !(attack && attack.whirl)) hitStop(.008, [{ body: enemy, model: enemy.model, amp: .07 }]);
      }
      return { blocked, braced, killed, guardBreak: !!enemy.guardBroke && (enemy.guardBroke = false, true), contact };
    }
    function die(enemyName, attackName) {
      if (game.state !== 'playing' || player.dead) return;
      cancelPlayerCharge();
      player.dead = true; player.hp = 0; player.attack = null; player.dodge = 0; player.healing = 0; order = null; showTargetRing(null); clearMoveMark();
      buffer = {}; pendingDodge = null; player.pendingAction = null; player.lack = null; game.attackTarget = null;
      propContacts.length = 0;
      blockedPropHold = null;
      game.state = 'dead'; game.lastDeath = { enemy: enemyName, attack: attackName };
      sound('death'); emit('death', game.lastDeath);
    }
    function win() {
      if (endAnnounced) return;
      cancelPlayerCharge();
      endAnnounced = true; game.state = 'won'; clearHazards(); player.attack = null; order = null; showTargetRing(null); clearMoveMark();
      buffer = {}; pendingDodge = null; player.pendingAction = null; player.lack = null; game.attackTarget = null;
      progression.completedChapter(chapter); syncProgression();
      // The first boss writes the shore entrance atomically with every earned reward.
      const complete = chapter === FINAL;
      const transition = { version: 3, chapter: complete ? chapter : chapter + 1, index: 0, transition: !complete, completed: complete, dead: [], kills: complete ? game.kills : 0, elapsed: complete ? game.elapsed : 0, progression: progression.snapshot() };
      if (complete && quests) transition.quests = quests.snapshot();
      try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(transition)); } catch (_) { emit('toast', { text: KabirI18n.t('Bölüm geçişi bu cihazda kaydedilemedi.') }); }
      game.hasSave = !complete; game.campaignCompleted = complete;
      emit('boss', { name: game.boss ? game.boss.name : STATS.boss.name, active: false });
      emit('win', { time: game.elapsed, kills: game.kills, chapter, nextChapter: complete ? null : chapter + 1 }); sound('win');
    }
    function hitPlayer(hazard) {
      if (game.state !== 'playing' || player.dead || playerHitImmunity > 0) return false;
      if (player.invulnerable) {
        if (director) director.evaded(hazard);   // a late, well-timed roll through a boss blow exposes the boss (boss-framework.js)
        // A strike that passes through the roll's protection is shown, never silently swallowed.
        const P = tuning(), perfect = !!(P && ECON && player.dodge > 0 && dodgeAge <= P.perfectWindow && perfectCd <= 0 && !hazard.harmless && !hazard.periodic && hazard.damage > 0);
        if (perfect) {
          // Last-moment roll: the blow was already falling when the roll began. The roll is refunded, the chain forgiven and the
          // hero's next blows land hard for a moment (OPENING). A thin slow-down on every clock sells the near miss (fair to both sides).
          perfectCd = ECON.PERFECT.cooldown; player.opening = ECON.PERFECT.opening; dodgeChain = 0; lastRollAt = -99;
          player.stamina = Math.min(player.maxStamina, player.stamina + lastRollCost * ECON.PERFECT.refund); staminaWait = 0; staminaMark = player.stamina;
          slowMotion(ECON.PERFECT.slowmo); sound('parry', { x: player.x, z: player.z, volume: .55 });
          flashRing(player.x, player.z, 1.6, 0xe8c27a, .45);
          game.perfectDodges = (game.perfectDodges || 0) + 1;
        }
        if (!hazard.harmless && !hazard.periodic && (evadeCooldown <= 0 || perfect)) { evadeCooldown = .35; fx('evade', { x: player.x, y: 1, z: player.z, face: player.face, perfect }); emit('evade', { x: player.x, z: player.z, attack: hazard.attack, perfect }); }
        return false;
      }
      const attackSource = hazard.owner && !hazard.owner.dead ? hazard.owner : hazard;
      const incomingAngle = angleTo(player, attackSource);
      let damage = hazard.damage;
      if (hazard.owner) damage = Math.round(damage * (hazard.owner.boss ? EASE.bossDamage : EASE.damage) * BALANCE.damage * (hazard.owner.campaignDamage || 1));
      { const P = tuning(), elite = !!(hazard.owner && hazard.owner.elite && !hazard.owner.boss);
        if (P) damage = Math.round(damage * P.enemyDmg * (elite ? P.eliteDmg : 1) * (P.chapterDmg ? P.chapterDmg[chapter] || 1 : 1));   // chapterDmg: Normal's own chapter curve (Hard already sits on it)
        else if (game.difficulty !== 'hard') damage = Math.round(damage * (game.difficulty==='easy'?.5:.75)); }
      damage = Math.max(1, Math.round(damage * (1 - (player.defense || 0)) * (1 - questBenefit('damageReduction', .12))));
      // The display event and the wound use the same final amount after the cry/fury's defence.
      if (player.roar) damage = Math.ceil(damage * .5); else if (player.rageTime > 0) damage = Math.ceil(damage * ROAR.guard);
      if (talents) damage = talents.incoming(damage);
      damage *= 100 / player.effectiveMaxHp;
      // Fairness: no single blow takes more than hitCap of the bar (combat-tuning.js; Hard bench found 62 % hits from elite shore foes).
      { const P = tuning(); if (P && P.hitCap) damage = Math.min(damage, P.hitCap * 100); }
      player.hitAngle = angleDifference(incomingAngle, player.face);
      const heavyBlow = hazard.damage >= 26;
      const applied = hitStop(damage > 0 ? (heavyBlow ? FEEL.hitstop.hurtHeavy : FEEL.hitstop.hurt) : 0, damage > 0 ? [{ body: player, model: hero, amp: .045 }] : null);
      emit('hit', { target: 'player', x: player.x, z: player.z, damage, face: incomingAngle + Math.PI, hitstop: applied,
        impact: heavyBlow ? 1 : .65, heavy: heavyBlow });
      if (damage <= 0) return false;
      player.hp = Math.max(0, player.hp - damage); player.hurt = 1; player.hurtHeavy = heavyBlow; player.hitDirection = Math.sin(incomingAngle - player.face); playerHitImmunity = .16;
      player.healing = 0; healingAge = 0;
      // Hurt never steals dodge input.
      sound('hurt'); fx('blood', { x: player.x + Math.sin(incomingAngle) * .3, y: 1.25, z: player.z + Math.cos(incomingAngle) * .3, player: true, damage, labelTarget: player, face: incomingAngle + Math.PI, spray: incomingAngle + Math.PI, heavy: heavyBlow });
      if (talents) talents.onHurt(hazard.owner || null, damage);   // Demir Duruş: the foe next to the hero is thrown back
      if (hazard.pull && hazard.owner) {
        // The hook drags the hero to exactly pullTo metres from the executioner.
        const a = angleTo(player, hazard.owner), dist = Math.max(0, distance(player, hazard.owner) - (hazard.pullTo || 2.4));
        forcedMotion = { x: Math.sin(a) * dist / .32, z: Math.cos(a) * dist / .32, time: .32 };
      } else if (hazard.style === 'grab' && hazard.owner) {
        const a = angleTo(player, hazard.owner), v = Math.min(4, Math.max(0, distance(player, hazard.owner) - 1.2) / .2);
        forcedMotion = { x: Math.sin(a) * v, z: Math.cos(a) * v, time: .2 };
      } else if (hazard.knockback) {
        const a = angleTo(attackSource, player); forcedMotion = { x: Math.sin(a) * hazard.knockback, z: Math.cos(a) * hazard.knockback, time: .18 };
      }
      if (player.hp <= 0) die(hazard.enemy, hazard.attack);
      else if (hazard.onHitPlayer) hazard.onHitPlayer(hazard);
      return true;
    }
    function playerInside(h) {
      const dx = player.x - h.x, dz = player.z - h.z, radius = .43;
      if (h.pool === 'dark' && mech && mech.sheltered(h, player.x, player.z, radius)) return false;
      if (h.shape === 'line') {
        const forward = dx * Math.sin(h.face) + dz * Math.cos(h.face);
        const side = dx * Math.cos(h.face) - dz * Math.sin(h.face);
        const edgeX = Math.max(Math.abs(side) - h.width / 2, 0);
        const edgeZ = Math.max(-forward, forward - h.length, 0);
        return edgeX * edgeX + edgeZ * edgeZ <= radius * radius;
      }
      const d = Math.hypot(dx, dz);
      if (h.shape === 'ring') {
        if (d < h.inner - radius || d > h.radius + radius) return false;
        return (h.arc || TAU) >= TAU - .01 || Math.abs(angleDifference(Math.atan2(dx, dz), h.face)) < h.arc / 2 + .05;
      }
      if (d > h.radius + radius) return false;
      if (h.shape === 'cone') return d < .45 || Math.abs(angleDifference(Math.atan2(dx, dz), h.face)) < h.arc / 2 + .05;
      return true;
    }
    function updateHazards(dt) {
      // Work from a stable snapshot: parries can remove pending sibling hazards and active spells can add pools.
      for (const h of hazards.slice()) {
        if (!hazards.includes(h)) continue;
        const hidden = h.age < 0; h.age += dt;
        if (h.age < 0) continue;
        if (hidden && h.track && h.owner && !h.owner.dead) {
          // A follow-up picks its line the instant its tell appears (from where its owner now stands); from then on it is fixed (R1).
          h.x = h.owner.x; h.z = h.owner.z; h.face = angleTo(h.owner, player); h.owner.face = h.face;
          if (h.shape === 'line') h.length = clipLine(h, h.face, h.length);
        }
        if (!h.committed && !h.harmless && !h.persistent && h.age >= h.warn - TELL_LEAD) {
          // Commit: .18 s before contact the tell flares (telegraphs.js) and a short cue sounds.
          h.committed = true;
          sound('tellCommit', { x: h.x, z: h.z, type: h.owner && h.owner.type, style: h.style, unblockable: h.unblockable, attack: h.attack, moveId: h.moveId || '' });
        }
        if (h.age >= h.warn && !h.active) {
          h.active = true; h.nextHit = h.warn;
          if (h.onActive) h.onActive();
          if (!h.harmless) {
            sound(h.poison ? 'poison' : h.damage >= 28 ? 'slam' : 'enemyAttack', { x: h.x, z: h.z, type: h.owner && h.owner.type, attack: h.attack, style: h.style, moveId: h.moveId || '' });
            // Dust and debris land where the blow lands: the far half of a cone, the end of a line, a circle's centre.
            const reachOut = h.shape === 'cone' ? h.radius * .55 : h.shape === 'line' ? h.length * .85 : 0;
            const ix = h.x + Math.sin(h.face) * reachOut, iz = h.z + Math.cos(h.face) * reachOut, big = h.damage >= 28;
            fx('strike', { x: h.x, y: .15, z: h.z, ix, iz, style: h.style, shape: h.shape, radius: h.radius, inner: h.inner, arc: h.arc, face: h.face,
              width: h.width, length: h.length, unblockable: h.unblockable, heavy: h.damage >= 26, scar: !!h.scar, poison: !!h.poison, burst: !!h.burst,
              boss: !!(h.owner && h.owner.boss), ownerType: h.owner ? h.owner.type : '', sweepDir: h.sweepDir });
            if (big || (h.unblockable && h.shape === 'circle' && h.radius >= 3)) emit('impact', { x: ix, z: iz, strength: clamp(h.damage / 40, .35, 1), radius: h.radius || 2 });
          }
        }
        if (h.active && !h.harmless && h.age <= h.warn + h.duration && (!h.hit || h.periodic) && h.age >= h.nextHit) {
          if (playerInside(h)) {
            // Crossing during an iframe consumes a one-shot strike, just as a clean dodge should.
            hitPlayer(h); h.hit = true; h.nextHit = h.age + h.interval;
          }
        }
        if (h.age > h.warn + h.duration) { const index = hazards.indexOf(h); if (index !== -1) removeHazard(index); }
      }
    }

    function queueInput(input, dt) {
      for (const key of Object.keys(buffer)) { buffer[key] -= dt; if (buffer[key] <= 0) delete buffer[key]; }
      if (!buffer.dodge) pendingDodge = null;
      holdInput(input);
    }
    // Attack presses use the short combo buffer. Abilities keep a valid press until the current
    // committed movement/animation ends; a .22 s buffer must not swallow a press during a .70 s swing.
    // This only waits for an action already in progress, never for an empty resource bar or a long cooldown.
    function actionWait(key) {
      if (key === 'dodge') return Math.max(0, player.dodge - .03, player.roar && !player.roar.released ? ROAR.release - player.roar.age : 0);
      if (key === 'rage' || key === 'fourth' || key === 'heavy') return Math.max(0, player.dodge, player.stagger, player.attack ? player.attack.duration - player.attack.age : 0, player.roar ? ROAR.duration - player.roar.age : 0);
      if (key === 'heal') return Math.max(0, player.stagger);
      if (key === 'special') return Math.max(0, player.dodge, player.stagger, player.healing,
        player.attack ? player.attack.duration - player.attack.age : 0, player.roar ? ROAR.duration - player.roar.age : 0);
      return 0;
    }
    const actionNames = { dodge: KabirI18n.t('Kaçınma'), special: 'Girdap', rage: KabirI18n.t('Kan Öfkesi'), heal: KabirI18n.t('İksir') };
    const secondsText = seconds => (Math.ceil(seconds * 10) / 10).toFixed(1).replace('.', ',');
    function rejectAction(key, reason, text, details) {
      delete buffer[key]; lack(key, reason, text, details); deny(text, key + ':' + reason); return false;
    }
    function canQueueAbility(key) {
      const slot = skillKeys.indexOf(key);
      if (slot !== -1) {
        const skill = selectedSkill(slot);
        if (!skill) return rejectAction(key, 'locked', KabirI18n.t('Bu yetenek yuvası boş. Yetenek ekranından bir yetenek seç.'));
        if ((skillCooldowns[skill.line] || 0) > FEEL.buffer) return rejectAction(key, 'cooldown', skill.name + KabirI18n.t(' hazırlanıyor: ') + secondsText(skillCooldowns[skill.line]) + KabirI18n.t(' sn.'), { remaining: skillCooldowns[skill.line] });
        if (skill.line === 'roar' && (player.rageTime > 0 || player.roar)) return rejectAction(key, 'active', KabirI18n.t('Kan Öfkesi zaten etkin.'));
        if (player.stamina < skill.cost) return rejectAction(key, 'stamina', skill.name + KabirI18n.t(' için ') + Math.round(skill.cost) + KabirI18n.t(' dayanıklılık gerekiyor.'), { cost: skill.cost, have: player.stamina });
      }
      if (key === 'heal') {
        if (!player.flasks) return rejectAction(key, 'empty', KabirI18n.t('Şifa mataraların boş.'));
        if (player.hp >= player.maxHp) return rejectAction(key, 'full', KabirI18n.t('Yaraların zaten kapalı.'));
      }
      if (key === 'dodge' && player.stamina < dodgeCost()) return rejectAction(key, 'stamina', KabirI18n.t('Kaçınma için ') + Math.round(dodgeCost()) + KabirI18n.t(' dayanıklılık gerekiyor.'), { cost: dodgeCost(), have: player.stamina });
      return true;
    }
    function holdInput(input, frozen) {
      for (const key of ['light', 'heavy', 'near', 'dodge', 'heal', 'rage', 'fourth', 'special']) {
        if (!input[key] || !canQueueAbility(key)) continue;
        buffer[key] = Math.max(FEEL.buffer, actionWait(key) + FEEL.buffer);
        if (key === 'dodge') { const aim = frozen ? input : rawInput || input; pendingDodge = { x: aim.x, z: aim.z, pointX: aim.pointX, pointZ: aim.pointZ, aimX: aim.aimX, aimZ: aim.aimZ, padActive: aim.padActive }; }
      }
      const attack = player.attack;
      if (attack && !attack.skill && input.light && attack.age >= FEEL.queueAfter) attack.queued = 'light';
    }
    function pendingAction() {
      player.pendingAction = null;
      for (const key of ['dodge', 'heavy', 'rage', 'fourth', 'heal', 'special']) {
        if (!buffer[key]) continue;
        const selected = selectedSkill(skillKeys.indexOf(key));
        const wait = actionWait(key), cooldown = selected ? skillCooldowns[selected.line] || 0 : 0;
        if (wait > 0 || cooldown > 0) {
          const reason = cooldown > wait ? 'cooldown' : player.dodge ? 'dodge' : player.stagger > 0 ? 'stagger' : player.roar ? 'rage' : 'attack';
          player.pendingAction = { key, reason, wait: Math.max(wait, cooldown) }; return;
        }
      }
    }
    function deny(text, id = text) {
      // Suppress repeats of the same failure, but always explain a different button/reason.
      if (deniedCooldown <= 0 || id !== deniedId) { emit('toast', { text }); deniedCooldown = 1.5; deniedId = id; }
    }
    function beginDodge(input) {
      if (talents && talents.dodgeBlocked()) return rejectAction('dodge', 'cooldown', KabirI18n.t('Zincirler henüz toplanmadı.'));
      const rollCost = dodgeCost();
      if (player.stamina < rollCost) return rejectAction('dodge', 'stamina',
        KabirI18n.t('Kaçınma için ') + Math.round(rollCost) + KabirI18n.t(' dayanıklılık gerekiyor (şu an ') + Math.floor(player.stamina) + ').', { cost: rollCost, have: player.stamina });
      // Direction: the keys held (the real ones, not an auto-approach), else the pad's right stick, else the cursor / target of a click order, else the facing.
      const raw = pendingDodge || rawInput || input; pendingDodge = null;
      const rx = Number.isFinite(raw.x) ? raw.x : 0, rz = Number.isFinite(raw.z) ? raw.z : 0, len = Math.hypot(rx, rz);
      if (len > .1) dodgeVector = { x: rx / len, z: rz / len };
      else if (!raw.padActive && Number.isFinite(raw.pointX) && Number.isFinite(raw.pointZ) && Math.hypot(raw.pointX - player.x, raw.pointZ - player.z) > .4) { const d = Math.hypot(raw.pointX - player.x, raw.pointZ - player.z); dodgeVector = { x: (raw.pointX - player.x) / d, z: (raw.pointZ - player.z) / d }; }   // Diablo IV: the roll goes toward the mouse cursor
      else if (Number.isFinite(raw.aimX) && Number.isFinite(raw.aimZ) && Math.hypot(raw.aimX - player.x, raw.aimZ - player.z) > .4) { const d = Math.hypot(raw.aimX - player.x, raw.aimZ - player.z); dodgeVector = { x: (raw.aimX - player.x) / d, z: (raw.aimZ - player.z) / d }; }
      else if (aimFace !== null) dodgeVector = { x: Math.sin(aimFace), z: Math.cos(aimFace) };
      else if (dodgeAim !== null) dodgeVector = { x: Math.sin(dodgeAim), z: Math.cos(dodgeAim) };
      else dodgeVector = { x: Math.sin(player.face), z: Math.cos(player.face) };
      if (order && !order.held) order = null;   // a roll ends a one-shot order (a held button keeps going once the roll is over)
      // Chained rolls (one starting within ECON.DODGE_CHAIN s of the last one's end) climb in price; a pause resets the chain.
      dodgeChain = simTime - lastRollAt < .48 + (ECON ? ECON.DODGE_CHAIN : 0) ? Math.min(ECON ? ECON.CHAIN_MAX : 0, dodgeChain + 1) : 0; lastRollAt = simTime; lastRollCost = rollCost;
      if (ECON && rollCost > 0) staminaWait = Math.max(staminaWait, (tuning() ? tuning().regenDelay : 0) + ECON.DODGE_EXTRA_DELAY);   // Zincirli Kader rolls cost nothing and do not pause the refill
      clearLack('dodge'); player.stamina -= rollCost; player.dodge = .48; dodgeAge = 0; player.invulnerable = true;
      // Two presses may share a frame. The roll starts after queuing, so retain accepted skills for this new commitment too.
      for (const key of skillKeys) if (buffer[key]) buffer[key] = Math.max(buffer[key], player.dodge + FEEL.buffer);
      player.attack = null; player.healing = 0; player.stagger = 0; healingAge = 0; forcedMotion = null; player.push = null;
      player.face = Math.atan2(dodgeVector.x, dodgeVector.z); comboStep = 0; comboWindow = 0;
      delete buffer.dodge; emit('dodge', { x: player.x, z: player.z }); sound('dodge'); if (talents) talents.onDodge();
      fx('dodge', { x: player.x, y: .1, z: player.z, face: player.face }); return true;
    }
    // The HUD pulses the requested slot; reason distinguishes resource shortages from cooldowns.
    function lack(key, reason = 'stamina', text = '', details = {}) {
      // A success can clear p.lack between HUD refreshes. Keep new reasons distinguishable without observing that null.
      player.lack = Object.assign({ key, reason, text, serial: ++lackSerial }, details);
    }
    function clearLack(key) { if (player.lack && player.lack.key === key) player.lack = null; }
    // ---- special ability: Zincir Girdabı (whirlwind). player.attack.whirl is the state; whirlStep runs the ticks from updatePlayer.
    function beginSpecial(hasAim) {
      if (player.specialCd > 0) return false;   // a press in the final .22 s waits for readiness
      if (player.stamina < SPECIAL.cost) return rejectAction('special', 'stamina',
        KabirI18n.t('Girdap için ') + Math.round(SPECIAL.cost) + KabirI18n.t(' dayanıklılık gerekiyor (şu an ') + Math.floor(player.stamina) + ').', { cost: SPECIAL.cost, have: player.stamina });
      player.attack = {
        heavy: true, special: true, whirl: true, combo: 0, age: 0, duration: SPECIAL.duration, strike: 99, hit: false, face: player.face, damage: SPECIAL.damage,
        radius: SPECIAL.radius, arc: Math.PI * 2, moveUntil: 0, serial: ++attackSerial, queued: null, lunge: 0, lungeLead: .1, lunged: 1,
        whooshAt: 9, whooshed: true, chainAt: SPECIAL.duration, ticks: 0
      };
      clearLack('special'); player.stamina -= SPECIAL.cost; player.specialCd = player.specialMax = SPECIAL.cooldown;
      trackAttackTarget(frontTarget(player.face, SPECIAL.radius, Math.PI));
      player.healing = 0; comboStep = 0; comboWindow = 0;
      delete buffer.special; delete buffer.heavy; delete buffer.light;
      sound('specialWind', { x: player.x, z: player.z, wind: SPECIAL.first });
      if ((SPECIAL.tier || 1) > 1) sound('whirlStart', { x: player.x, z: player.z, tier: SPECIAL.tier });   // per-tier layers (audio.js)
      fx('whirlStart', { x: player.x, y: 1.2, z: player.z, face: player.face, radius: SPECIAL.radius, grow: SPECIAL.grow, duration: SPECIAL.duration, turns: SPECIAL.turns, tier: SPECIAL.tier || 1 });
      emit('attack', { heavy: true, special: true, combo: 0, x: player.x, z: player.z });
      emit('impact', { x: player.x, z: player.z, strength: .3, radius: 2.5 });
      return true;
    }
    function whirlStep(attack, input, moveLength) {
      // A broken guard (stagger) ends the spin at once; a roll clears player.attack itself.
      if (player.stagger > 0 || player.dead) { player.attack = null; return; }
      if (moveLength > .08) attack.face = Math.atan2(input.x, input.z);
      while (attack.ticks < SPECIAL.ticks && attack.age >= SPECIAL.first + attack.ticks * SPECIAL.gap) specialStrike(attack, ++attack.ticks);
    }
    function specialStrike(attack, n) {
      const whirlTier = SPECIAL.tier || 1, R = SPECIAL.radius * ((SPECIAL.grow || 1) < 1 ? SPECIAL.grow + (1 - SPECIAL.grow) * clamp((n - 1) / Math.max(1, SPECIAL.ticks - 1), 0, 1) : 1), last = n === SPECIAL.ticks, shudder = [], keepFace = attack.face;   // tier III: the circle widens tick by tick
      propContact(player.x, player.z, R, 1);
      let hits = 0, kills = 0;
      for (const e of enemies) {
        if (e.dead || !e.model.root.visible) continue;
        const d = distance(player, e); if (d > R + e.radius * .6) continue;
        if (!clearStrike(player, e)) continue;
        if (!e.active) { e.active = true; e.activated = true; e.encounter.activated = true; }
        const damage = Math.round(attack.damage * (player.rageTime > 0 ? 1.48 : 1)); attack.rage = player.rageTime > 0;
        const wasBoss = e.boss, away = angleTo(player, e);
        attack.face = away;
        const r = hurtEnemy(e, damage, true, away, attack); if (!r) continue;
        hits++; fx('whirlHit', { x: r.contact.x, y: r.contact.y, z: r.contact.z, face: away, last, boss: wasBoss, tier: whirlTier });
        if (r.killed) { kills++; continue; }
        e.push = null;
        if (!wasBoss) {
          e.staggerVariant = last ? 2 : (n + e.index) % 2;
          e.stagger = e.staggerTotal = last ? SPECIAL.staggerLast : SPECIAL.stagger; e.staggerKind = last ? 'heavy' : 'light'; e.action = null; e.faceLocked = false; e.shield = false;
          e.poiseRecovery = 2.2; e.cooldown = Math.max(e.cooldown, 1.2); cancelHazards(e, true);
          if (last) push(e, away, SPECIAL.fling || .9); else if (d > 1.7) push(e, angleTo(e, player), Math.min(SPECIAL.pull, d - 1.6));   // loose foes are drawn in, the last tick throws them out
        } else push(e, away, .04);
        shudder.push({ body: e, model: e.model, amp: last ? .09 : .05 });
      }
      shudder.push({ body: player, model: hero, amp: last ? .03 : .015 });
      attack.face = keepFace;
      hitStop(0, shudder);
      sound('specialHit', { x: player.x, z: player.z, hits });
      fx('whirlTick', { x: player.x, y: .1, z: player.z, face: attack.face, n, last, hits, radius: R, tier: whirlTier });
      if (last && whirlTier > 1) sound('heavyHit', { x: player.x, z: player.z, volume: 1 });
      if (whirlTier > 1) sound('whirlTick', { x: player.x, z: player.z, tier: whirlTier, n, last });   // per-tier layers (audio.js)
      emit('impact', { x: player.x, z: player.z, strength: last ? [1, 1.4, 2][whirlTier - 1] : (.22 + .12 * n) * (1 + .3 * (whirlTier - 1)), radius: R });
    }
    function frontTarget(face, range, halfArc) {
      let best = null, bestScore = Infinity;
      for (const e of enemies) {
        if (e.dead || !e.model.root.visible) continue;
        const d = distance(player, e) - e.radius; if (d > range) continue;
        const off = Math.abs(angleDifference(angleTo(player, e), face)); if (off > halfArc) continue;
        if (!clearStrike(player, e)) continue;
        const score = d + off * 1.6; if (score < bestScore) { bestScore = score; best = e; }
      }
      return best;
    }
    // Distinct weapon handling: axes trade tempo for weight; spears trade sweep coverage for reach. Skill clocks remain independent.
    const WEAPON_HANDLING = {
      sword: { durations: [.51,.56,.68], strikes: [.20,.23,.29], damage: [25,29,36], radius: 3.05, arcs: [2.7,2.7,2.7], reach: 0, contact: 1 },
      axe: { durations: [.55,.615,.76], strikes: [.23,.265,.33], damage: [28,33,41], radius: 3.0, arcs: [3.05,3.05,3.05], reach: 0, contact: 1.15 },
      spear: { durations: [.49,.535,.65], strikes: [.20,.225,.285], damage: [26,30,35], radius: 3.85, arcs: [1.10,1.15,1.35], reach: .55, contact: .9 }
    };
    Object.values(WEAPON_HANDLING).forEach(profile => { Object.values(profile).forEach(value => { if (Array.isArray(value)) Object.freeze(value); }); Object.freeze(profile); });
    Object.freeze(WEAPON_HANDLING);
    function weaponHandling() { return WEAPON_HANDLING[progression.stats().weaponType] || WEAPON_HANDLING.sword; }
    // Character statistics use these same base hits; no separate UI damage table can drift from contact.
    game.normalAttackProfile = weaponHandling;
    const ASSIST = { range: 3.6, arc: 50 * Math.PI / 180, near: 4.4 };   // attack key / pad button: reach (to the foe's edge) and half-angle of the front cone (near = the touch button, any direction)
    function beginAttack(heavy, hasAim, fromSkill) {
      if (heavy && !fromSkill) return useSkill(0, hasAim);
      const cost = RESOURCES.costs[heavy ? 'heavy' : 'light'];
      if (player.stamina < cost) return rejectAction(heavy ? 'heavy' : 'light', 'stamina',
        (heavy ? KabirI18n.t('Ağır') : KabirI18n.t('Hafif')) + KabirI18n.t(' darbe için ') + Math.round(cost) + KabirI18n.t(' dayanıklılık gerekiyor (şu an ') + Math.floor(player.stamina) + ').', { cost, have: player.stamina });
      const combo = heavy ? 0 : comboWindow > 0 ? comboStep % 3 : 0;
      const handling = weaponHandling(), weaponType = progression.stats().weaponType;
      const durations = handling.durations, timings = handling.strikes, damages = handling.damage;
      // Who is hit and where the blow goes. A click order (swingPlan) names its foe, or a stand swing (Shift + click) its direction: the cursor. The attack key /
      // pad button / touch button have no order: they swing only if a living foe is inside the narrow front cone (+-50 deg, ~3.6 m; the touch button looks all round
      // to 4.4 m), the foe of the last such swing keeping it a little wider so the target does not flicker. No foe: nothing happens (no swing at empty air).
      // The pad's right stick is the explicit direction (stand swing). Nothing behind or beside is ever chosen by the key. The body follows quickly (animateAll).
      const plan = swingPlan; let foe = null, stand = false;
      if (plan && plan.enemy) foe = plan.enemy;
      else if (plan) { stand = true; player.face = plan.face; }
      else if (hasAim) { stand = true; player.face = aimFace; }
      else {
        if (moveFace !== null) player.face = moveFace;
        if (buffer.near) foe = frontTarget(player.face, ASSIST.near, Math.PI);
        else {
          const keep = assistFoe && !assistFoe.dead && assistFoe.model.root.visible && distance(player, assistFoe) - assistFoe.radius <= ASSIST.range + .5
            && Math.abs(angleDifference(angleTo(player, assistFoe), player.face)) <= ASSIST.arc + .17 ? assistFoe : null;
          foe = keep || frontTarget(player.face, ASSIST.range, ASSIST.arc);
        }
        assistFoe = foe;
        if (!foe) { delete buffer.heavy; delete buffer.light; delete buffer.near; return false; }
      }
      if (foe) player.face = angleTo(player, foe);
      const duration = heavy ? 1.05 : durations[combo], strike = heavy ? .57 : timings[combo];
      const target = foe || frontTarget(player.face, 4.4, .75), want = heavy ? FEEL.heavyLunge : FEEL.lunge[combo];
      const room = target ? Math.max(0, distance(player, target) - target.radius - (hero.radius || .46) - .45) : want;
      player.attack = {
        heavy, combo, weaponType, contactScale: heavy ? 1 : handling.contact, age: 0, duration, strike,
        hit: false, face: player.face, damage: heavy ? 60 : damages[combo], radius: heavy ? 3.65 : handling.radius + combo * .12,
        arc: heavy ? 3.65 : handling.arcs[combo], moveUntil: heavy ? .24 : .13, serial: ++attackSerial, queued: null,
        lunge: stand ? 0 : Math.min(want, room), foe, stand, lungeLead: heavy ? FEEL.heavyLungeLead : FEEL.lungeLead[combo], lunged: 0,
        whooshAt: strike - (heavy ? FEEL.whoosh.heavy : combo === 2 ? FEEL.whoosh.finisher : FEEL.whoosh.light), whooshed: false,
        chainAt: heavy ? duration : duration - (combo === 2 ? FEEL.finisherChainEarly : FEEL.chainEarly)
      };
      if (heavy) Object.assign(player.attack, { duration: HEAVY.duration, strike: HEAVY.strike, chainAt: HEAVY.duration, whooshAt: 0, lungeLead: HEAVY.lungeLead });
      trackAttackTarget(foe);
      clearLack(heavy ? 'heavy' : 'light'); player.stamina -= cost;
      player.healing = 0; comboStep = heavy ? 0 : combo + 1; comboWindow = .85;
      if (plan && plan.order) { plan.order.owed = false; if (!plan.order.held && order === plan.order) order = null; }   // a one-shot click order is spent by its swing
      swingPlan = null;
      delete buffer.heavy; delete buffer.light; delete buffer.near; emit('attack', { heavy, combo, x: player.x, z: player.z });
      return true;
    }
    function playerStrike(attack) {
      if (attack.special) { specialStrike(attack); return; }
      attack.hit = true;
      // The blow ends up on the foe it was aimed at (it may have shuffled a little since the swing began), so hits and gore point at it.
      if (attack.foe && !attack.foe.dead && !attack.stand && distance(player, attack.foe) < 6) attack.face = angleTo(player, attack.foe);
      propContact(player.x, player.z, attack.radius, attack.skill ? 3 : attack.heavy ? 2 : 1, attack.face, attack.arc);
      let hits = 0, blocks = 0, kills = 0, breaks = 0, metalContacts = 0;
      const shudder = [], finisher = !attack.heavy && attack.combo === 2, H = FEEL.hitstop;
      for (const enemy of enemies) {
        if (enemy.dead || distance(player, enemy) > attack.radius + enemy.radius * .6) continue;
        const angle = Math.abs(angleDifference(angleTo(player, enemy), attack.face));
        if (angle > attack.arc / 2) continue;
        if (!clearStrike(player, enemy)) continue;
        if (!enemy.active) { enemy.active = true; enemy.activated = true; enemy.encounter.activated = true; }
        const damage = Math.round(attack.damage * (player.rageTime > 0 ? 1.48 : 1)); attack.rage = player.rageTime > 0;
        const r = hurtEnemy(enemy, damage, attack.heavy, attack.face, attack); if (!r) continue;
        hits++; if (r.blocked) blocks++; if (r.killed) kills++; if (r.guardBreak) breaks++; if (r.blocked || r.braced) metalContacts++;
        if (!r.killed) shudder.push({ body: enemy, model: enemy.model, amp: r.blocked ? .02 : attack.heavy ? .07 : .045 });
        if (game.state === 'won') break;
      }
      if (hits) {
        const clean = hits - blocks;
        let stop = clean ? (attack.heavy ? H.heavy : finisher ? H.finisher : H.light) + (clean - 1) * H.extraTarget : H.shield;
        if (breaks && attack.heavy) stop = Math.max(stop, H.guardBreak);
        if (kills) stop += game.state === 'won' || (attack.foe && attack.foe.boss && attack.foe.dead) ? H.bossKill : H.kill;
        shudder.push({ body: player, model: hero, amp: .012 });
        hitStop(stop * (attack.contactScale || 1), shudder);
        if (clean) sound(attack.heavy || finisher ? 'heavyHit' : 'hit', { hits, volume: finisher ? 1 : .9, weaponType: progression.stats().weaponType, material: metalContacts >= clean ? 'metal' : 'flesh', heavy: !!attack.heavy, finisher, critical: !!attack.critical, kill: kills > 0 });
      }
      if (finisher && attack.weaponType !== 'spear') {
        // The cleave bites into the floor whether or not it found flesh.
        const gx = player.x + Math.sin(attack.face) * 2.05, gz = player.z + Math.cos(attack.face) * 2.05;
        fx('slam', { x: gx, y: .1, z: gz, radius: 1.35, small: true, face: attack.face }); emit('impact', { x: gx, z: gz, strength: hits ? .5 : .32, radius: 1.3 });
      }
      if (attack.skill === 'cleave') { fx('heroSkill', { skill: 'cleave', tier: 1, phase: 'release', x: player.x, y: .15, z: player.z, face: attack.face, radius: attack.radius, arc: attack.arc }); fx('skillAccent', { line: 'cleave', tier: 1, skill: 'cleave', x: player.x, z: player.z, face: attack.face, radius: attack.radius, hits }); }
      if (finisher && attack.weaponType === 'spear' && hits) emit('impact', { x: player.x + Math.sin(attack.face) * 2.8, z: player.z + Math.cos(attack.face) * 2.8, strength: .42, radius: 1.1 });
      fx('slash', { x: player.x, y: 1.2, z: player.z, face: attack.face, heavy: attack.heavy, hit: hits > 0, weaponType: attack.weaponType, reach: attack.radius });
    }
    // ------------------------------------------------------------------ war cry (Öfke)
    function startWarCry() {
      if (player.rageCd > 0) return false;   // a press in the final .22 s waits for readiness
      if (player.stamina < ROAR.cost) return rejectAction('rage', 'stamina',
        KabirI18n.t('Kan Öfkesi için ') + Math.round(ROAR.cost) + KabirI18n.t(' dayanıklılık gerekiyor (şu an ') + Math.floor(player.stamina) + ').', { cost: ROAR.cost, have: player.stamina });
      clearLack('rage'); player.stamina -= ROAR.cost; player.rageCd = ROAR.cooldown;
      player.attack = null; player.healing = 0; healingAge = 0; comboStep = 0; comboWindow = 0;
      player.roar = { age: 0, released: false, serial: ++attackSerial, gather: ROAR.release };
      delete buffer.rage;
      if (buffer.special) buffer.special = Math.max(buffer.special, ROAR.duration + FEEL.buffer);
      sound('rage', { x: player.x, z: player.z, warCry: true, release: ROAR.release, tier: ROAR.tier }); emit('rageStart', { x: player.x, z: player.z });
      if (ROAR.tier >= 2) fx('shoutGather', { x: player.x, z: player.z, face: player.face, life: ROAR.release, tier: ROAR.tier, radius: ROAR.near });
      else fx('warCryGather', { x: player.x, y: 1.2, z: player.z, face: player.face, life: ROAR.release });
      return true;
    }
    // The roar goes out: a shockwave through the floor staggers the nearest foes (their unfired tells break),
    // cows the rest for a moment and the executioner flinches. The camera sells the impact without pausing combat.
    function releaseWarCry() {
      propContact(player.x, player.z, ROAR.near, 1);
      player.rageTime = ROAR.time; player.rageMax = ROAR.time; player.rageFlash = 1;
      emit('rage', { x: player.x, z: player.z, face: player.face });
      emit('impact', { x: player.x, z: player.z, strength: [.85, 1.15, 1.55][ROAR.tier - 1] || .85, radius: ROAR.near });
      if (ROAR.tier >= 2) fx('shoutRelease', { x: player.x, y: .05, z: player.z, face: player.face, radius: ROAR.near, far: ROAR.far, tier: ROAR.tier });
      else fx('warCry', { x: player.x, y: .05, z: player.z, face: player.face, radius: ROAR.near, far: ROAR.far, tier: ROAR.tier });
      const cry = { skill: 'roar', line: 'roar', tier: ROAR.tier, heavy: true, combo: 0, age: 0, face: player.face, serial: ++attackSerial };
      for (const e of enemies) {
        if (e.dead || enemyUnderground(e) || !e.model.root.visible) continue;
        const d = distance(e, player), away = angleTo(player, e);
        if (d > ROAR.far) continue;
        e.hitAngle = angleDifference(angleTo(e, player), e.face);
        if (e.boss) {
          if (d < ROAR.near + 1.5) {
            push(e, away, .22); e.hurt = Math.max(e.hurt, .7); e.hurtHeavy = true;
            if (ROAR.damage && d < ROAR.near && clearStrike(player, e)) { cry.face = away; hurtEnemy(e, ROAR.damage, true, away, cry); }
          }
          continue;
        }
        if (!e.active && e.activated !== false && e.encounter && e.encounter.activated) e.active = true;
        if (d < ROAR.near) {
          // The higher tiers of the cry also wound: the floor-shaking wave hits every foe it staggers.
          if (ROAR.damage && clearStrike(player, e)) { cry.face = away; const r = hurtEnemy(e, ROAR.damage, true, away, cry); if (r && r.killed) continue; }
          e.stagger = e.staggerTotal = ROAR.stun; e.staggerKind = 'fear'; e.action = null; e.faceLocked = false; e.shield = false;
          cancelHazards(e, true); e.fear = ROAR.fear; e.cooldown = Math.max(e.cooldown, 1.1); e.hurt = Math.max(e.hurt, .6);
          push(e, away, .45 + 1.3 * (1 - d / ROAR.near));
        } else { e.fear = Math.max(e.fear, 1.5 + .4 * (ROAR.tier - 1)); e.cooldown = Math.max(e.cooldown, 1.3); push(e, away, .4); }
      }
      // Tier 3: more rings follow the first one (Kıyamet Narası), see stepRoarWaves.
      roarWaves = ROAR.waves > 1 ? { age: 0, next: 1, count: ROAR.waves, near: ROAR.near, damage: ROAR.waveDamage, stun: ROAR.stun * .6, face: player.face } : null;
    }
    function stepRoarWaves(dt) {
      const w = roarWaves; w.age += dt;
      if (player.dead) { roarWaves = null; return; }
      while (w.next < w.count && w.age >= w.next * .34) {
        const n = w.next++, R = w.near * (.72 + .14 * n), cry = { skill: 'chainstorm', line: 'roar', tier: 3, heavy: true, combo: 0, age: 0, face: w.face, serial: ++attackSerial };
        fx('shoutWave', { x: player.x, z: player.z, radius: R, n, tier: 3 });
        emit('impact', { x: player.x, z: player.z, strength: .75 + .15 * n, radius: R });
        for (const e of enemies) {
          if (e.dead || !e.model.root.visible) continue;
          const d = distance(e, player); if (d > R + e.radius * .5 || !clearStrike(player, e)) continue;
          const away = angleTo(player, e); cry.face = away;
          const r = hurtEnemy(e, w.damage, true, away, cry);
          if (r && !r.killed && !e.boss) { stunEnemy(e, w.stun, 'fear'); e.fear = Math.max(e.fear, 2); push(e, away, .35); }
        }
      }
      if (w.next >= w.count) roarWaves = null;
    }
    // ------------------------------------------------------------------ Diablo-4 click-target controls
    // The app hands over: input.target (the foe under / near the cursor, or null), input.pointX / pointZ (the ground under the cursor), clickLight / clickHeavy (a mouse
    // press or touch tap this frame), holdLight / holdHeavy (the mouse button is still down), stand (the "stand still" modifier, Shift) and x / z (keys or stick).
    // A click on a foe walks up to it (run speed) and swings, a click on the ground walks there, Shift + click swings in place toward the cursor. Nothing ever swings at
    // empty air except that Shift + click. Holding the button keeps going (the foe under the cursor becomes the target, the ground becomes a steering point).
    // WASD / stick cancels a one-shot order (with a held button it only moves the hero, the swing still fires at a foe in reach). Returns the input the rest of
    // updatePlayer uses: the keys, or the walking direction of the order.
    function steerOrders(input, dt) {
      const out = Object.assign({}, input);
      out.x = Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0;
      out.z = Number.isFinite(input.z) ? clamp(input.z, -1, 1) : 0;
      rawInput = input; swingPlan = null; dodgeAim = null;
      let click = pendingClick || (input.clickLight || input.clickHeavy ? { heavy: !!input.clickHeavy, loot: input.loot, target: input.target, prop: input.prop, propEpoch: input.prop ? input.prop.epoch : null, x: input.pointX, z: input.pointZ, stand: !!input.stand } : null);
      pendingClick = null;
      if (player.dead || game.state !== 'playing') { order = null; showTargetRing(null); return out; }
      const valid = e => !!e && !e.dead && e.model.root.visible;
      const validProp = p => !!p && (p.kind === 'anchor' || p.kind === 'orb') && typeof p.isTargetable === 'function' && p.isTargetable();
      const hover = valid(input.target) ? input.target : null, hoverProp = !hover && validProp(input.prop) ? input.prop : null;
      const validLoot = d => !!d && !!groundLoot && !!groundLoot.find(d.uid), hoverLoot = !hover && !hoverProp && validLoot(input.loot) ? input.loot : null;   // ground loot under the cursor (click = walk there and take it)
      const hasPt = Number.isFinite(input.pointX) && Number.isFinite(input.pointZ);
      const mv = Math.hypot(input.x || 0, input.z || 0), holdL = !!input.holdLight, holdH = !!input.holdHeavy && !!selectedSkill(0), stand = !!input.stand;
      if (!holdL && !holdH || click || hover || hoverProp && hoverProp !== blockedPropHold) blockedPropHold = null;
      // A buffered click belongs to the visible spawn at press time, never its recycled pool slot.
      if (click && click.prop && !valid(click.target) && (!validProp(click.prop) || click.prop.epoch !== click.propEpoch)) {
        if (holdL || holdH) blockedPropHold = click.prop;
        order = null; click = null;
      }
      if (order && order.kind === 'prop' && (!validProp(order.prop) || order.prop.epoch !== order.epoch)) {
        if (holdL || holdH) blockedPropHold = order.prop;
        order = null;
      }
      if (click && click.heavy && !selectedSkill(0)) {
        rejectAction('heavy', 'locked', KabirI18n.t('Bu yetenek yuvası boş. Yetenek ekranından bir yetenek seç.'));
        order = null; return out;
      }
      if (click) {
        const t = valid(click.target) ? click.target : null, prop = !t && validProp(click.prop) ? click.prop : null, cx = prop ? prop.x : Number.isFinite(click.x) ? click.x : player.x + Math.sin(player.face) * 3, cz = prop ? prop.z : Number.isFinite(click.z) ? click.z : player.z + Math.cos(player.face) * 3;
        if (!click.stand && !click.heavy && !t && !prop && validLoot(click.loot)) order = { kind: 'loot', uid: click.loot.uid, owed: true };
        else if (click.stand || click.heavy && !t && !prop) order = { kind: 'stand', heavy: click.heavy, x: cx, z: cz, owed: true };
        else if (t) order = { kind: 'attack', enemy: t, heavy: click.heavy, owed: true };
        else if (prop) order = { kind: 'prop', prop, epoch: prop.epoch, heavy: click.heavy, owed: true };
        else if (!click.heavy && Number.isFinite(click.x)) order = { kind: 'move', x: click.x, z: click.z };
        if (t) trackAttackTarget(t);
        if (order) order.stuck = 0;
      }
      const btn = holdL ? 'L' : holdH ? 'H' : '';
      if (order) order.held = order.kind === 'move' ? holdL : order.heavy ? holdH : holdL;
      if (btn && !click && !blockedPropHold) {
        if (stand) {
          if (!order || order.kind !== 'stand' || order.heavy !== (btn === 'H')) order = { kind: 'stand', heavy: btn === 'H', owed: true, stuck: 0 };
          if (hover) trackAttackTarget(hover);
          order.held = true;
        } else if (hover) {
          const heavy = btn === 'H';
          if (!order || order.kind !== 'attack' || order.heavy !== heavy || order.enemy !== hover) {
            order = { kind: 'attack', enemy: hover, heavy, owed: true, stuck: 0 }; trackAttackTarget(hover);
          }
          order.held = true;
        } else if (hoverLoot && btn === 'L') {
          if (!order || order.kind !== 'loot' || order.uid !== hoverLoot.uid) order = { kind: 'loot', uid: hoverLoot.uid, owed: true, stuck: 0 };
          order.held = true;
        } else if (hoverProp) {
          const heavy = btn === 'H';
          if (!order || order.kind !== 'prop' || order.heavy !== heavy || order.prop !== hoverProp || order.epoch !== hoverProp.epoch) order = { kind: 'prop', prop: hoverProp, epoch: hoverProp.epoch, heavy, owed: true, stuck: 0 };
          order.held = true;
        } else if (btn === 'L' && hasPt) {
          if (!order || order.kind !== 'move') order = { kind: 'move', stuck: 0 };
          order.x = input.pointX; order.z = input.pointZ; order.held = true;
        } else if (order && order.kind !== 'move') order = null;   // right button held over the ground: nothing
      }
      if (order && order.kind === 'attack' && !valid(order.enemy)) order = null;
      if (order && !order.held && !order.owed && order.kind !== 'move') order = null;
      if (order && mv > .08 && order.kind !== 'stand' && !order.held) order = null;
      let ring = hover, walking = false;
      if (order) {
        if (order.kind === 'stand') {
          if (hasPt) { order.x = input.pointX; order.z = input.pointZ; }
          const dx = (hoverProp ? hoverProp.x : order.x) - player.x, dz = (hoverProp ? hoverProp.z : order.z) - player.z;
          const face = hover ? angleTo(player, hover) : Math.hypot(dx, dz) > .3 ? Math.atan2(dx, dz) : player.face;
          swingPlan = { stand: true, face, heavy: order.heavy, order }; dodgeAim = face;
          if (order.held) out.x = out.z = 0;
        } else if (order.kind === 'attack') {
          const e = order.enemy, a = angleTo(player, e), selected = order.heavy ? selectedSkill(0) : null;
          const reach = order.heavy ? (selected ? skillReach[selected.id] || ORDER.reachHeavy : ORDER.reachHeavy) : ORDER.reach + weaponHandling().reach;
          dodgeAim = a; ring = e;
          if (distance(player, e) - e.radius <= reach && clearStrike(player, e)) { swingPlan = { enemy: e, heavy: order.heavy, order }; if (mv <= .08) out.x = out.z = 0; }
          else if (mv <= .08) {
            const nav = order.navigation || (order.navigation = {}); routeDirection(player, e, nav, dt, hero.radius || .5, true);
            out.x = nav.dx; out.z = nav.dz; walking = true;
          }
        } else if (order.kind === 'loot') {
          const drop = groundLoot && groundLoot.find(order.uid);
          if (!drop) order = null;
          else if (Math.hypot(drop.x - player.x, drop.z - player.z) <= (groundLoot.takeReach || 1.4)) { groundLoot.take(drop.uid); order = null; }
          else { dodgeAim = Math.atan2(drop.x - player.x, drop.z - player.z); if (mv <= .08) { const nav = order.navigation || (order.navigation = {}); routeDirection(player, drop, nav, dt, hero.radius || .5, true); out.x = nav.dx; out.z = nav.dz; walking = true; } }
        } else if (order.kind === 'prop') {
          const prop = order.prop, face = angleTo(player, prop), selected = order.heavy ? selectedSkill(0) : null;
          const reach = order.heavy ? (selected ? skillReach[selected.id] || ORDER.reachHeavy : ORDER.reachHeavy) : ORDER.reach + weaponHandling().reach;
          dodgeAim = face;
          if (distance(player, prop) - prop.radius <= reach && clearStrike(player, prop)) {
            swingPlan = { stand: true, face, heavy: order.heavy, order };
            if (mv <= .08) out.x = out.z = 0;
          } else if (mv <= .08) {
            const nav = order.navigation || (order.navigation = {}); routeDirection(player, prop, nav, dt, hero.radius || .5, true);
            out.x = nav.dx; out.z = nav.dz; walking = true;
          }
        } else {
          const dx = order.x - player.x, dz = order.z - player.z, d = Math.hypot(dx, dz);
          if (d <= (order.held ? ORDER.hold : ORDER.arrive)) { if (!order.held) order = null; }
          else {
            dodgeAim = Math.atan2(dx, dz);
            if (mv <= .08) { const nav = order.navigation || (order.navigation = {}); routeDirection(player, order, nav, dt, hero.radius || .5, true); out.x = nav.dx; out.z = nav.dz; walking = true; }
          }
        }
      }
      if (order) {
        // Giving up an approach that goes nowhere (a wall in the way).
        if (walking && !player.attack && !player.dodge) {
          const moved = Math.hypot(player.x - (order.px === undefined ? player.x : order.px), player.z - (order.pz === undefined ? player.z : order.pz));
          if (moved < 1.3 * dt) order.stuck += dt; else order.stuck = Math.max(0, order.stuck - dt);
          if (order.stuck > ORDER.stuck) order = null;
        }
        if (order) { order.px = player.x; order.pz = player.z; }
      }
      if (groundLoot) groundLoot.setHover(order && order.kind === 'loot' ? order.uid : hoverLoot ? hoverLoot.uid : '');
      showTargetRing(ring, !!(order && order.kind === 'attack'));
      showMoveMark(order && order.kind === 'move' && Number.isFinite(order.x) ? order : null, dt);
      return out;
    }
    function ensureMoveMark() {
      if (!moveMark) {
        moveMark = new THREE.Mesh(new THREE.RingGeometry(.84, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
        moveMark.rotation.x = -Math.PI / 2; moveMark.renderOrder = 2; moveMark.name = 'MoveMark'; moveMark.visible = false; root.add(moveMark);
      }
    }
    function ensureTargetRing() {
      if (!targetRing) {
        targetRing = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0xd2c5af, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending, fog: false }));
        targetRing.rotation.x = -Math.PI / 2; targetRing.renderOrder = 3; targetRing.name = 'TargetRing'; targetRing.visible = false; root.add(targetRing);
      }
    }
    function clearMoveMark() { markA = 0; if (moveMark) moveMark.visible = false; }
    // The loader compiles/uploads these invisible meshes before the first hover or click; lazy calls remain valid.
    function prepareGraphics() {
      if (disposed) return false;
      ensureMoveMark(); ensureTargetRing();
      return true;
    }
    // A faint small ring on the floor where a click-to-move order is heading; it fades out once the hero arrives or the order ends.
    function showMoveMark(o, dt) {
      if (o) { markX = o.x; markZ = o.z; markA = Math.min(1, markA + dt * 4); } else markA = Math.max(0, markA - dt * 2.2);
      if (!moveMark) {
        if (markA <= 0) return;
        ensureMoveMark();
      }
      moveMark.visible = markA > .01;
      if (!moveMark.visible) return;
      const k = reducedMotion.matches ? 1 : .9 + .1 * Math.sin(simTime * 5), r = .3 * k;
      moveMark.position.set(markX, .06, markZ); moveMark.scale.set(r, r, 1);
      moveMark.material.opacity = .06 * markA * markA * (3 - 2 * markA);
    }
    // The slim ember ring under the targeted foe (bright once the foe is the order's target, dim while it is only under the cursor).
    function showTargetRing(foe, locked) {
      player.target = foe || null;
      if (!targetRing) {
        if (!foe) return;
        ensureTargetRing();
      }
      targetRing.visible = !!foe;
      if (!foe) return;
      const r = foe.radius * 1.5 + .2, pulse = reducedMotion.matches ? 1 : .94 + .06 * Math.sin(simTime * 3);
      targetRing.position.set(foe.x, .07, foe.z); targetRing.scale.set(r, r, 1);
      targetRing.material.opacity = (locked ? .55 : .23) * pulse;
    }
    function updatePlayer(dt, input) {
      input = steerOrders(input, dt);
      queueInput(input, dt); hintCooldown = Math.max(0, hintCooldown - dt); deniedCooldown = Math.max(0, deniedCooldown - dt); evadeCooldown = Math.max(0, evadeCooldown - dt);
      player.hurt = Math.max(0, player.hurt - dt * 3.5);
      playerHitImmunity = Math.max(0, playerHitImmunity - dt);
      player.stagger = Math.max(0, player.stagger - dt);
      const rageBefore = player.rageTime;
      player.rageTime = Math.max(0, player.rageTime - dt); player.rageFlash = Math.max(0, (player.rageFlash || 0) - dt * 1.4);
      if (rageBefore > 0 && player.rageTime <= 0 && !player.dead) {
        // The fury gutters out: a clear cue so the hero knows the bonus is gone.
        emit('rageEnd', { x: player.x, z: player.z }); sound('rageEnd', { x: player.x, z: player.z }); fx('rageEnd', { x: player.x, y: 1.2, z: player.z });
      }
      if (player.roar) {
        const r = player.roar; r.age += dt;
        if (!r.released && r.age >= ROAR.release) { r.released = true; releaseWarCry(); }
        if (r.age >= ROAR.duration) player.roar = null;
      }
      if (roarWaves) stepRoarWaves(dt);
      // A charge whose attack was replaced (roll, death, new game) is cancelled so its module can drop its effects.
      if (player.chargeHandle && !(player.attack && player.attack.line === 'charge')) { try { player.chargeHandle.cancel(); } catch (_) { /* module already gone */ } player.chargeHandle = null; }
      for (const id of Object.keys(skillCooldowns)) skillCooldowns[id] = Math.max(0, skillCooldowns[id] - dt);
      player.specialCd = Math.max(0, (player.specialCd || 0) - dt);
      player.rageCd = Math.max(0, (player.rageCd || 0) - dt); player.drink = drinkLeft;
      comboWindow = Math.max(0, comboWindow - dt);
      const moveLength = Math.hypot(input.x || 0, input.z || 0);
      // Only the pad's right stick can aim (a stand swing, a roll from standing); it never turns the hero by itself.
      // Otherwise he looks where he walks and keeps his last facing when he stands.
      const hasAim = Number.isFinite(input.aimX) && Number.isFinite(input.aimZ) && Math.hypot(input.aimX - player.x, input.aimZ - player.z) > .7;
      aimFace = hasAim ? Math.atan2(input.aimX - player.x, input.aimZ - player.z) : null;
      moveFace = moveLength > .08 ? Math.atan2(input.x, input.z) : null;
      if (!player.dodge && !player.roar) {
        if (player.attack) player.face = player.attack.face;
        else if (moveLength > .08) player.face = Math.atan2(input.x, input.z);
      }
      // A roll may cut the war cry short, but only once its shockwave has gone out.
      if (buffer.dodge && player.dodge <= .03 && (!player.roar || player.roar.released)) {
        if (beginDodge(input)) player.roar = null;
      }
      if (buffer.heavy) useSkill(0, hasAim);
      else if (buffer.special) useSkill(1, hasAim);
      else if (buffer.rage) useSkill(2, hasAim);
      else if (buffer.fourth) useSkill(3, hasAim);
      // Flask: instant. The heal lands on the press and nothing is locked (player.healing, the old .82 s drink, is no longer set), so it
      // works mid-swing, mid-roll or during the roar.
      drinkLeft = Math.max(0, drinkLeft - dt);
      if (buffer.heal && !player.dead && player.stagger <= 0) {
        delete buffer.heal;
        if (drinkLeft > DRINK - DRINK_GUARD) { /* the same press arriving twice: ignore it */ }
        else if (!player.flasks) deny(KabirI18n.t('Şifa mataraların boş.'));
        else if (player.hp >= player.maxHp) deny(KabirI18n.t('Yaraların zaten kapalı.'));
        else {
          clearLack('heal'); player.flasks--; player.hp = Math.min(player.maxHp, player.hp + 64 * (tuning() ? tuning().flaskHeal : 1) * (1 + questBenefit('healingBonus', .20)) * (talents ? talents.flaskHealMul() : 1) * 100 / player.effectiveMaxHp); drinkLeft = DRINK;
          emit('heal', { hp: player.hp, flasks: player.flasks }); sound('healStart'); sound('heal');
          flashRing(player.x, player.z, 1.3, 0xd7bf88, .6);
        }
      }
      if (player.dodge > 0) {
        dodgeAge += dt; player.dodge = Math.max(0, player.dodge - dt);
        player.invulnerable = dodgeAge <= (tuning() ? tuning().iframe : DODGE.iframe);
        const speed = dodgeAge < .30 ? 12.5 : 6.2;
        moveBody(player, dodgeVector.x * speed * dt, dodgeVector.z * speed * dt, hero.radius || .5);
      } else {
        player.invulnerable = false;
        if (!player.attack && !player.healing && !player.roar && player.stagger <= 0) {
          if (buffer.special) useSkill(1, hasAim);
          if (player.attack) { /* special just began */ }
          else if (buffer.special) { /* finishing its short readiness buffer: retain the press */ }
          else if (swingPlan) beginAttack(swingPlan.heavy, hasAim);
          else if (buffer.heavy) beginAttack(true, hasAim);
          else if (buffer.light) beginAttack(false, hasAim);
        }
        if (player.attack) {
          const attack = player.attack; attack.age += dt;
          if (attack.line === 'charge') chargeStep(attack, dt);
          // A click order that wants another swing queues it like a key press (a chain fires at chainAt); one that lost its foe unqueues it.
          if (swingPlan && !attack.skill && !attack.whirl && attack.age >= FEEL.queueAfter) { attack.queued = swingPlan.heavy ? 'heavy' : 'light'; attack.queuedBy = 'order'; }
          else if (attack.queuedBy === 'order' && !swingPlan) { attack.queued = null; attack.queuedBy = null; }
          if (!attack.whooshed && attack.age >= attack.whooshAt) { attack.whooshed = true; sound(attack.heavy ? 'heavy' : 'attack', { volume: attack.combo === 2 ? 1 : .85 }); }
          // Step into the blow: the body commits forward over the last moments before contact.
          if (attack.lunge > 0 && attack.lunged < 1) {
            const k = clamp((attack.age - (attack.strike - attack.lungeLead)) / (attack.lungeLead + .03), 0, 1), e = k * k * (3 - 2 * k);
            if (e > attack.lunged) { const d = (e - attack.lunged) * attack.lunge; moveBody(player, Math.sin(attack.face) * d, Math.cos(attack.face) * d, hero.radius || .5); attack.lunged = e; }
          }
          if (!attack.hit && attack.age >= attack.strike) {
            if (attack.skill === 'brand' || attack.skill === 'temper') releaseSkill(attack);
            else playerStrike(attack);
          }
          if (attack.whirl && player.attack === attack) whirlStep(attack, input, moveLength);
          if (player.attack === attack && !attack.skill && attack.queued && !buffer.special && attack.age >= attack.chainAt) {
            const next = attack.queued === 'heavy'; player.attack = null; comboWindow = Math.max(comboWindow, .46); beginAttack(next, hasAim);
          } else if (player.attack === attack && attack.age >= attack.duration) {
            player.attack = null; comboWindow = .46;
            if (buffer.special) useSkill(1, hasAim);
            else if (swingPlan) beginAttack(swingPlan.heavy, hasAim);
            else if (buffer.heavy) beginAttack(true, hasAim);
            else if (buffer.light) beginAttack(false, hasAim);
          }
        }
        // Swings are committed until just after contact; the feet free up again for the recovery.
        let attackMove = 1;
        if (player.attack) { const a = player.attack, committed = a.age < a.strike + (a.heavy ? .03 : .06); attackMove = a.heavy ? (committed ? .12 : .5) : (committed ? .16 : .52); }
        if (player.attack && player.attack.whirl) attackMove = SPECIAL.move;
        else if (player.attack && player.attack.line === 'charge') attackMove = 0;   // the charge carries the hero itself
        let movementMultiplier = player.roar ? ROAR.move : player.attack ? attackMove : 1;
        if (player.stagger > 0) movementMultiplier *= .35;
        if (moveLength > .08) {
          const speed = (player.rageTime > 0 ? 5.85 : 5.35) * movementMultiplier;
          moveBody(player, input.x / Math.max(1, moveLength) * speed * dt, input.z / Math.max(1, moveLength) * speed * dt, hero.radius || .5);
        }
        applyPush(player, dt, hero.radius || .5);
        if (forcedMotion) {
          moveBody(player, forcedMotion.x * dt, forcedMotion.z * dt, hero.radius || .5);
          forcedMotion.time -= dt; if (forcedMotion.time <= 0) forcedMotion = null;
        }
      }
      // Energy recovers during every live action, including a held attack.
      if (talents) { DODGE.cost = talents.dodgeCost(RESOURCES.costs.dodge); talents.update(dt); }
      if (BABA.Status) BABA.Status.tick(dt, enemies);   // target-hud.js: generic enemy.statuses timers (display only)
      // Energy recovers during every live action, including a held attack, but only after a short pause once some was spent
      // (combat-tuning.js ECONOMY: a spend restarts the pause, so constant rolling starves the bar; a breath refills it quickly).
      const P = tuning();
      if (P && ECON) {
        if (player.stamina < staminaMark - .01) staminaWait = Math.max(staminaWait, P.regenDelay);
        if (staminaWait > 0) staminaWait = Math.max(0, staminaWait - dt);
        else if (player.stamina < player.maxStamina) player.stamina = Math.min(player.maxStamina, player.stamina + ECON.REGEN * P.regen * (1 + questBenefit('staminaRecovery', .20)) * (player.rageTime > 0 ? 1.65 : 1) * (talents ? talents.regenMul() : 1) * dt);
        staminaMark = player.stamina; player.staminaWait = staminaWait;
      } else if (player.stamina < player.maxStamina) {
        player.stamina = Math.min(player.maxStamina, player.stamina + REGEN * (1 + questBenefit('staminaRecovery', .20)) * (player.rageTime > 0 ? 1.65 : 1) * (talents ? talents.regenMul() : 1) * dt);
      }
      player.opening = Math.max(0, (player.opening || 0) - dt); perfectCd = Math.max(0, perfectCd - dt);
      player.dodgeCost = dodgeCost();
      player.status = player.healing ? KabirI18n.t('Şifa içiliyor') : player.roar ? KabirI18n.t('Savaş narası') : talents && talents.guardActive() ? KabirI18n.t('Demir duruş') : player.rageTime > 0 ? KabirI18n.t('Kan öfkesi') : '';
      pendingAction();
      player.move = player.dodge ? 1 : Math.min(1, moveLength) * (player.attack ? .5 : 1);
      if (input.interact) interact();
    }

    function enemyAttackPose(enemy) {
      const action = enemy.action;
      if (!action) return 0;
      const heavy = enemy.boss || enemy.type === 'guard', contact = heavy ? .56 : .41, hitEnd = heavy ? .69 : .52;
      const beat = action.beats.find(beat => action.age <= beat.strike + beat.duration);
      if (beat) {
        if (action.age < beat.start) return .01;
        if (action.age < beat.strike) return .01 + (contact - .01) * clamp((action.age - beat.start) / (beat.strike - beat.start), 0, 1);
        return contact + (hitEnd - contact) * clamp((action.age - beat.strike) / Math.max(.001, beat.duration), 0, 1);
      }
      const last = action.beats[action.beats.length - 1];
      if (!last) return clamp(action.age / action.duration, .01, 1);
      const ended = last.strike + last.duration;
      return hitEnd + (1 - hitEnd) * clamp((action.age - ended) / Math.max(.01, action.duration - ended), 0, 1);
    }
    // The move an enemy is performing: its current beat, time into it, contact and end (s). A beat hands over
    // to the next one part-way through its follow-through so chained blows flow instead of snapping.
    function enemyBeat(enemy) {
      const action = enemy.action; if (!action || !action.beats.length) return null;
      const beats = action.beats; let i = 0;
      while (i < beats.length - 1) {
        const b = beats[i], n = beats[i + 1], handOver = b.strike + clamp((n.strike - b.strike) * .3, .08, .3);
        if (action.age < handOver) break; i++;
      }
      const b = beats[i], n = beats[i + 1];
      const end = n ? b.strike + clamp((n.strike - b.strike) * .3, .08, .3) : action.duration;
      return { index: i, t: action.age - b.start, contact: b.strike - b.start, end: end - b.start, pose: b.pose || action.pose || '' };
    }
    // Both actor types reach the authored contact pose on the frame that deals
    // damage. The visual wind-up is never allowed to lag a live hazard.
    function playerAttackPose(attack) {
      if (!attack) return 0;
      if (attack.line === 'charge') return .2 + .75 * clamp(attack.age / attack.duration, 0, 1);
      const contact = attack.heavy ? .56 : .41;
      return attack.age <= attack.strike
        ? .01 + (contact - .01) * clamp(attack.age / attack.strike, 0, 1)
        : contact + (1 - contact) * clamp((attack.age - attack.strike) / (attack.duration - attack.strike), 0, 1);
    }
    // Writes into 'out' (one reused animation-state object per actor; every field is rewritten each call, so nothing stale survives).
    function movementState(actor, model, dt, speed, out) {
      const dx = actor.x - model.root.position.x, dz = actor.z - model.root.position.z;
      const distance = Math.hypot(dx, dz), valid = dt > .000001 && distance < 2.5;
      const vx = valid ? dx / dt : 0, vz = valid ? dz / dt : 0;
      out = out || {};
      out.velocityX = vx; out.velocityZ = vz; out.move = Math.min(1, Math.hypot(vx, vz) / speed);
      out.turnRate = valid ? angleDifference(actor.face, model.root.rotation.y) / dt : 0;
      out.moveX = undefined; out.moveZ = undefined;
      return out;
    }
    const heroAnim = {};
    let heroPoseAcc = 0;   // simulation time since the hero was last posed (callbacks that are not drawn skip the pose)
    // Whirlwind body turn: an unwrapped angle (eased in and out, SPECIAL.turns full turns) added to the body's yaw only, so the hero ends facing player.yaw exactly.
    const SPIN = (() => { const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, t = [0]; for (let i = 1; i <= 64; i++) { const u = i / 64; t.push(t[i - 1] + sm(u / .1) * (1 - sm((u - .78) / .22))); } return t.map(v => v / t[64]); })();
    function whirlAngle(u) { return BABA.AuthoredMotion.whirlAngle(u, reducedMotion.matches ? 1 : SPECIAL.turns); }
    function animateAll(dt) {
      const pm = movementState(player, hero, dt, 5.35, heroAnim);
      player.move = pm.move;
      // player.face is the facing the game acts on and changes at once; the body swings round to it fast but smoothly (shortest way).
      player.yaw = dampAngle(player.yaw, player.face, player.dodge ? FEEL.turn.roll : player.attack ? FEEL.turn.swing : FEEL.turn.walk, dt);
      // Walking under his own power the hero always runs forward (he looks where he goes, even while the body is still turning);
      // only shoves, pulls and the like keep the real direction of travel, so no strafing or backpedalling legs.
      if (!player.dodge && Math.hypot(pm.velocityX, pm.velocityZ) > .3 && pm.velocityX * Math.sin(player.face) + pm.velocityZ * Math.cos(player.face) > .5 * Math.hypot(pm.velocityX, pm.velocityZ)) { pm.moveX = 0; pm.moveZ = 1; }
      const atk = player.attack, wh = atk && atk.whirl ? atk : null;
      if (wh) spinCur = whirlAngle(wh.age / wh.duration);
      else if (spinCur > 0) {   // interrupted spin (roll, stagger): finish the turn quickly instead of popping back
        const TAU = Math.PI * 2, rem = TAU * Math.ceil(spinCur / TAU - 1e-6) - spinCur; spinCur = player.dead || player.dodge || rem < .02 ? 0 : spinCur + Math.min(rem, 18 * dt);
      }
      const leapU = player.attack && player.attack.leap ? (player.attack.age - (player.attack.strike - LEAP_AIR)) / LEAP_AIR : -1;   // Kabir Balyozu: the body arcs through the air toward the strike frame
      player.lift = leapU > 0 && leapU < 1 ? LEAP_HEIGHT * 4 * leapU * (1 - leapU) : 0;
      hero.root.position.set(player.x, player.lift, player.z); hero.root.rotation.y = player.yaw + spinCur;
      // Read-only state for the effects / post-processing: { active, t (s), u (0..1), tick, ticks, radius, spin (rad), serial }.
      const sp = player.special || (player.special = { active: false, t: 0, u: 0, tick: 0, ticks: SPECIAL.ticks, radius: SPECIAL.radius, spin: 0, serial: 0 });
      sp.active = !!wh; sp.ticks = SPECIAL.ticks; sp.radius = SPECIAL.radius; sp.t = wh ? wh.age : 0; sp.u = wh ? clamp(wh.age / wh.duration, 0, 1) : 0; sp.tick = wh ? wh.ticks : 0; sp.spin = spinCur; sp.serial = wh ? wh.serial : sp.serial;
      // Same fields as before, written into the reused heroAnim object (pm === heroAnim) instead of a fresh spread every callback.
      const hs = pm;
      hs.time = simTime; hs.attack = wh ? 0 : playerAttackPose(atk); hs.whirl = wh ? clamp(wh.age / wh.duration, 0, 1) : -1; hs.whirlTime = wh ? wh.age : -1;
      hs.attackTime = atk && !wh ? atk.age : -1; hs.attackStrike = atk ? (atk.line === 'charge' ? .2 : atk.strike) : 0; hs.attackDuration = atk ? atk.duration : 0; hs.attackSerial = atk ? atk.serial : 0;
      if (BABA.Charge && BABA.Charge.poseState) BABA.Charge.poseState(hs);   // chargeTime / impactTime ... for the Hücum pose (charge.js)
      hs.hitAngle = player.hitAngle || 0; hs.hurtHeavy = !!player.hurtHeavy; hs.iframeEnd = (tuning() ? tuning().iframe : DODGE.iframe) / .48;
      hs.stagger = player.stagger > 0 ? 1 - player.stagger / (player.staggerTotal || .7) : 0; hs.staggerTime = player.staggerTotal || .7;
      hs.contactPhase = player.attack && player.attack.heavy ? .56 : .41;
      hs.heavy = !!(player.attack && player.attack.heavy && !wh); hs.block = false;
      // Blade-trail tint (authored-models.js): opening after a last-moment roll > blood fury > the skill line of the swing > plain steel.
      hs.trailTint = player.opening > 0 ? 'opening' : player.rageTime > 0 ? 'rage' : atk && atk.line ? atk.line : wh ? 'whirl' : '';
      hs.combo = player.attack ? player.attack.combo : 0; hs.parry = 0; hs.weaponType = atk && atk.weaponType || progression.stats().weaponType;
      hs.blockImpact = 0; hs.hitDirection = player.hitDirection || 0;
      hs.dodge = player.dodge ? clamp(dodgeAge / .48, .01, 1) : 0;
      hs.dodgeProgress = player.dodge ? clamp(dodgeAge / .48, .01, 1) : 0;
      hs.dodgeDirection = Math.atan2(dodgeVector.x, dodgeVector.z); hs.healing = player.healing ? 1 - player.healing / .82 : 0;
      hs.drinkTime = drinkLeft > 0 ? DRINK - drinkLeft : -1; hs.drinkDuration = DRINK;
      hs.hurt = player.hurt; hs.dead = player.dead; hs.phase = player.healing ? 'heal' : 'idle'; hs.face = player.face; hs.rage = player.rageTime > 0;
      hs.skillMove = atk && atk.skillMove || ''; hs.roarTier = player.roar ? ROAR.tier : 1; hs.skillTier = atk && atk.skill && atk.line === 'cleave' ? atk.tier : 0; hs.leapAir = LEAP_AIR;
      hs.roarTime = player.roar ? player.roar.age : -1; hs.roarRelease = ROAR.release; hs.roarDuration = ROAR.duration; hs.roarSerial = player.roar ? player.roar.serial : 0;
      // Poses are only needed for a callback that is drawn (a 200 Hz screen under a 120 FPS cap, or a 120 Hz screen under 60, runs the
      // simulation more often than it draws): the time of the skipped callbacks is handed to the next pose, so nothing is lost.
      const posing = game.drawing !== false;
      if (posing) { hero.animate(dt + heroPoseAcc, hs); heroPoseAcc = 0; } else heroPoseAcc += dt;
      for (const enemy of enemies) {
        const d = distance(enemy, player);
        // A burrowing body stays below the floor through the committed attack
        // window. Posing must not undo the chapter controller's hidden state.
        const underground = !enemy.dead && enemyUnderground(enemy);
        const visible = !underground && d < 45 && (!enemy.dead || enemy.deadAge < corpseLifetime);
        if (enemy.inView === false) {
          // Outside the camera's view (plus margin): no pose, no bar, no scene walk. Position stays current so nothing jumps on return.
          enemy.model.root.visible = visible; enemy.holder.visible = false; enemy.bar.root.visible = false;
          enemy.model.root.position.set(enemy.x, 0, enemy.z); enemy.model.root.rotation.y = enemy.yaw = enemy.face;
          enemy._lodPosed = false;
          continue;
        }
        // Animation level of detail: a foe that stands asleep (not awake, not walking home, not hurt, nothing changed since its last pose)
        // only breathes. Its pose is refreshed every 2nd / 3rd callback with the time that passed (the bones keep the last pose, the
        // render pass still carries them with the root). Anything awake, hurt, dead, a boss, or newly in view is posed every callback.
        let lodSkip = false;
        if (posing && visible && enemy._lodPosed && !enemy.active && !enemy.returning && !enemy.boss && !enemy.dead && !enemy.action && !(enemy.hurt > 0) && !(enemy.stagger > 0) &&
            enemy.x === enemy._lodX && enemy.z === enemy._lodZ && enemy.face === enemy._lodFace && enemy.yaw === enemy.face && d >= 5) {
          enemy._lodTick = (enemy._lodTick | 0) + 1;
          if ((enemy._lodTick + enemy.index) % (d < 14 ? 2 : 3) !== 0) { enemy._lodAcc = (enemy._lodAcc || 0) + dt; lodSkip = true; }
        }
        if (lodSkip) {
          enemy.bar.root.visible = false;
          continue;
        }
        const em = movementState(enemy, enemy.model, dt, STATS[enemy.type].speed, enemy._anim || (enemy._anim = {}));
        enemy.model.root.visible = visible; if (enemy.holder.visible !== visible) enemy.holder.visible = visible;
        // Shadow level of detail (60 Hz-class targets): a character far from the hero no longer casts into the key light's map.
        // Every skinned part is a separate shadow draw, so distant crowds cost far more than they show. 0 = everyone casts.
        if (shadowReach > 0 && visible) {
          const want = enemy.boss || (enemy._shadowOn ? d < shadowReach + 2 : d < shadowReach - (enemy.dead ? 4 : 0));
          if (want !== enemy._shadowOn) {
            enemy._shadowOn = want;
            if (!enemy._shadowParts) { enemy._shadowParts = []; enemy.model.root.traverse(o => { if (o.isMesh && o.castShadow) enemy._shadowParts.push(o); }); }
            for (const part of enemy._shadowParts) part.castShadow = want;
          }
        } else if (enemy._shadowOn === false && (shadowReach === 0 || !visible)) {
          enemy._shadowOn = true; for (const part of enemy._shadowParts) part.castShadow = true;
        }
        const launchAge=!enemy.dead&&!enemy.boss?simTime-(enemy.launchAt==null?-99:enemy.launchAt):-1;
        const launchU=launchAge>=0&&launchAge<.40?launchAge/.40:-1;
        const launchLift=(launchU>=0?4*launchU*(1-launchU)*(enemy.launchHeight||0):0)-(enemy.dead&&corpseLifetime>4&&enemy.deadAge>corpseLifetime-3?clamp((enemy.deadAge-(corpseLifetime-3))/3,0,1)*.55:0);   // old corpses sink into the floor over their last 3 s instead of vanishing
        // (ajan:chars2a) The body turns toward the gameplay facing instead of snapping to it (enemy.face stays exact for hits and telegraphs): quick while an attack
        // is committed (the blow always lands on a squared-up body), slow for bosses and stunned foes. The head leads the turn (lookYaw below).
        if (enemy.yaw === undefined || enemy.dead || !(dt > 0) || (enemy.action && enemy.action.faceAt && enemy.action.age >= enemy.action.faceAt.t)) enemy.yaw = enemy.face;
        else { const yd = angleDifference(enemy.face, enemy.yaw); enemy.yaw = Math.abs(yd) < .004 ? enemy.face : enemy.yaw + yd * (1 - Math.exp(-(enemy.action ? (enemy.boss ? 16 : 28) : enemy.stagger > 0 ? 5 : enemy.boss ? 7 : 11) * dt)); }
        enemy.model.root.position.set(enemy.x, launchLift, enemy.z); enemy.model.root.rotation.y = enemy.yaw;
        if (visible && !posing) {
          enemy._lodAcc = (enemy._lodAcc || 0) + dt;
          const action = enemy.action;
          const leap = action && action.movement && action.movement.leap
            ? clamp((action.age - action.movement.start) / action.movement.duration, 0, 1) : 0;
          enemy.model.root.position.y = launchLift + Math.sin(leap * Math.PI) * 1.15;
        } else if (visible) {
          const action = enemy.action;
          const leap = action && action.movement && action.movement.leap
            ? clamp((action.age - action.movement.start) / action.movement.duration, 0, 1) : 0;
          enemy.model.root.position.y = launchLift + Math.sin(leap * Math.PI) * 1.15;
          const beat = enemyBeat(enemy);
          const es = em;   // the enemy's reused animation state; same fields as the old per-callback spread
          es.time = simTime + enemy.index * .31;
          es.beat = beat ? beat.index : 0; es.beatTime = beat ? beat.t : -1; es.beatContact = beat ? beat.contact : 0; es.beatEnd = beat ? beat.end : 0;
          es.attackSerial = action ? action.serial : 0; es.rushTime = action && action.movement ? action.movement.duration : 0;
          es.lookYaw = enemy.active && !enemy.dead && !player.dead ? angleDifference(angleTo(enemy, player), enemy.yaw) : undefined;
          es.hitAngle = enemy.hitAngle || 0; es.hurtHeavy = !!enemy.hurtHeavy; es.deathKind = enemy.deathKind || ''; es.blockImpact = enemy.blockImpact || 0;
          es.stagger = enemy.stagger > 0 && !enemy.dead ? 1 - enemy.stagger / Math.max(enemy.stagger, enemy.staggerTotal || 0) : 0; es.staggerTime = enemy.staggerTotal || 0; es.staggerVariant = enemy.staggerVariant || 0; es.fear = enemy.fear || 0;
          es.attack = enemyAttackPose(enemy); es.contactPhase = enemy.boss || enemy.type === 'guard' ? .56 : .41; es.pose = beat ? beat.pose : '';
          es.launchTime=launchU>=0?launchAge:-1;es.launchDuration=.40;es.launchDirection=angleDifference(enemy.launchDirection||0,enemy.face);
          es.action = action ? action.attack : ''; es.actionProgress = action ? action.age / action.duration : 0; es.leap = leap;
          es.heavy = !!(action && (enemy.boss || enemy.type === 'guard'));
          es.block = enemy.shield && !enemy.dead; es.dodge = 0; es.hurt = enemy.hurt; es.hitDirection = enemy.hitDirection || 0; es.dead = enemy.dead;
          es.phase = enemy.phase >= 2 ? 'rage' : action ? 'attack' : 'idle'; es.face = enemy.face; es.rage = enemy.buff > 0 || enemy.phase >= 2; es.enraged = !!enemy.enraged;   // (ajan:models) boss phase III visuals
          enemy.model.animate(dt + (enemy._lodAcc || 0), es); enemy._lodAcc = 0;
          if (enemy._leapPrev > .5 && leap < .02 && d < 24) fx('land', { x: enemy.x, y: .05, z: enemy.z, big: false, blown: false, face: enemy.face });   // a pounce / leap comes down: dust ring
          enemy._leapPrev = leap;
          if (enemy.boss || enemy.radius > .6) {   // heavy bodies kick up dust at every footfall (and the boss's tread is felt in the camera)
            const ff = enemy.model.root.userData.footfall;
            if (ff && ff.serial !== enemy._ff) { if (enemy._ff !== undefined && ff.serial > enemy._ff && d < 22) { fx('footstep', { x: ff.x, z: ff.z, y: .045, heavy: true }); if (enemy.boss && d < 12) emit('impact', { x: ff.x, z: ff.z, strength: .1 }); } enemy._ff = ff.serial; }
          }
          if (enemy._limb) enemy.model.root.userData.authoredMotion.refreshed = false;   // the limb hook shakes the spine after the pose
          enemy._lodPosed = true; enemy._lodX = enemy.x; enemy._lodZ = enemy.z; enemy._lodFace = enemy.face;
        }
        enemy.bar.root.visible = visible && !enemy.dead && enemy.active && enemy.hp < enemy.maxHp;
        enemy.bar.root.position.set(enemy.x, (enemy.model.height || 2.2) + .34 + launchLift, enemy.z);
        const fraction = Math.max(.001, enemy.hp / enemy.maxHp);
        enemy.bar.fill.scale.x = fraction; enemy.bar.fill.position.x = -(enemy.boss ? 2.16 : 1.16) * (1 - fraction) / 2;
      }
    }
    // Cheap world/gameplay state still follows every collision substep; posing
    // complete skeletons belongs to the final, visible state of the update.
    function updateSceneState(dt) {
      for (const seal of seals) {
        if (seal.open) {
          seal.fade = Math.min(1, seal.fade + dt * 1.8);
          seal.group.scale.y = Math.max(.001, 1 - seal.fade); seal.group.visible = seal.fade < 1;
        } else { seal.group.scale.y = 1; seal.group.visible = Math.abs(seal.z - player.z) < 45; }
      }
      if (quests) quests.update(dt);
      if (gate) gate.update(dt, player);
    }
    function step(dt, input) {
      decisionStep = dt;
      simTime += dt; game.elapsed += dt; pairCd = Math.max(0, pairCd - dt);
      openingGrace = Math.max(0, openingGrace - dt);
      game.currentRoom = world.roomAt ? world.roomAt(player.x, player.z) : null;
      updatePlayer(dt, input);
      if (game.state !== 'playing') { propContacts.length = 0; updateSceneState(dt); return; }
      activateEncounters();
      // Previously engaged enemies reactivate when approached again.
      enemies.forEach(enemy => { if (!enemy.dead && enemy.activated && !enemy.active && !enemy.returning && distance(enemy, player) < 10) enemy.active = true; });
      enemies.forEach(enemy => updateEnemy(enemy, dt));
      separateFromHero();
      updateHazards(dt);
      if (mech) mech.step(dt);
      if (director) director.update(dt);
      if (mobMods) mobMods.update(dt);
      if (mobAbil) mobAbil.update(dt);
      if (game.state === 'playing') activateCheckpoint();
      updateSceneState(dt);
      if (boss2) boss2.tick(dt);
    }
    // Victims shudder on the spot while the frame holds; the next simulated frame puts every root back.
    function shudder(active) {
      for (const v of victims) {
        const r = v.model.root;
        if (active) r.position.set(v.body.x + (Math.random() - .5) * 2 * v.amp, r.position.y, v.body.z + (Math.random() - .5) * 2 * v.amp);
        else r.position.set(v.body.x, r.position.y, v.body.z);
      }
      if (!active) victims.length = 0;
    }
    function update(dt, input) {
      if (disposed) return;
      if (!Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .1); input = input || {}; navigationBudget = 2;
      cullEnemies();   // who is posed this frame (camera of the previous frame; the render pass refreshes it again)
      if (freeze > 0) {
        // Hit-stop: every combat clock holds together; presses made now are buffered for the next frame.
        const held = Math.min(freeze, dt); freeze -= held; dt -= held;
        if (game.state === 'playing') { holdInput(input, true); if (input.clickLight || input.clickHeavy) pendingClick = { heavy: !!input.clickHeavy, loot: input.loot, target: input.target, prop: input.prop, propEpoch: input.prop ? input.prop.epoch : null, x: input.pointX, z: input.pointZ, stand: !!input.stand }; }
        input = Object.assign({}, input, { light: false, heavy: false, near: false, clickLight: false, clickHeavy: false, dodge: false, heal: false, rage: false, special: false, fourth: false });
        pendingAction();
        shudder(freeze > 0); game.hitStop = freeze;
        if (dt <= .00001) return;
      }
      // War-cry slow motion: all combat clocks run slower together, easing back to full speed over the last .15 s.
      if (slowmo > 0) { const k = slowmo > .15 ? .3 : .3 + .7 * (1 - slowmo / .15); slowmo = Math.max(0, slowmo - dt); dt *= k; game.timeScale = k; }
      else game.timeScale = 1;
      if (limbs) limbs.update(dt);
      if (globes) globes.update(dt);
      if (groundLoot && game.state === 'playing' && !player.dead) {
        groundLoot.update(dt);
        if (game.boss && game.boss.dead && !endAnnounced && !pendingFinalBossReward(game.boss)) { win(); }
      }
      if (game.state !== 'playing') { propContacts.length = 0; const visualDt = Math.min(dt, .033); updateSceneState(visualDt); animateAll(visualDt); return; }
      // Fixed upper bound prevents fast dodge movement from tunneling on occasional slow frames.
      let remaining = dt, first = true, poseDt = 0;
      while (remaining > .00001 && game.state === 'playing') {
        const substep = Math.min(remaining, 1 / 60);
        const frameInput = first ? input : Object.assign({}, input, { light: false, heavy: false, near: false, clickLight: false, clickHeavy: false, dodge: false, heal: false, rage: false, special: false, fourth: false, interact: false });
        step(substep, frameInput); poseDt += substep; first = false; remaining -= substep;
        if (freeze > 0) {
          // Contact may happen inside a 33/50/100 ms frame. Consume only its authored hold;
          // dropping the entire remainder would make attacks slower on a slower device.
          const held = Math.min(freeze, remaining); freeze -= held; remaining -= held;
          if (freeze <= .00001) { freeze = 0; shudder(false); }
        }
      }
      // A 33/50/100 ms update uses 2/3/6 collision steps, but presents one
      // character pose. Preserve all simulated animation time without computing
      // and immediately overwriting intermediate skeletons nobody can see.
      if (poseDt > 0) animateAll(poseDt);
      game.hitStop = freeze;
    }
    function dispose() {
      if (disposed) return; disposed = true;
      if (talents) talents.dispose();
      cancelPlayerCharge();
      renderTraversal = false;
      for (const { node, guard, descriptor } of matrixGuards) {
        if (node.updateMatrixWorld !== guard) continue;
        if (descriptor) Object.defineProperty(node, 'updateMatrixWorld', descriptor);
        else delete node.updateMatrixWorld;
      }
      matrixGuards.length = 0;
      game.attackTarget = null;
      clearHazards();
      if (mech) mech.dispose();
      if (limbs) limbs.dispose();
      if (globes) globes.dispose();
      if (groundLoot) groundLoot.dispose();
      hero.dispose(); enemies.forEach(enemy => { enemy.model.dispose(); disposeObject(enemy.bar.root); });
      disposeObject(targetRing); disposeObject(moveMark); if (boss2) boss2.dispose();
      if (director) director.dispose(); if (mobMods) mobMods.dispose(); if (mobAbil) mobAbil.dispose();
      seals.forEach(seal => disposeObject(seal.group));
      if (quests) quests.dispose();
      if (gate) gate.dispose();
      scene.remove(root);
    }
    function setQuality(settings) {
      if (limbs) limbs.setQuality(settings);
      if (globes) globes.setQuality(settings);
      if (settings && Number.isFinite(settings.shadowReach)) shadowReach = clamp(settings.shadowReach, 0, 60);
      if (settings && Number.isFinite(settings.corpses)) corpseLifetime = clamp(settings.corpses, 0, 180);
      // The app's contact-emphasis strength (default .65) scales hit-stop; 0 turns it off.
      if (settings && Number.isFinite(settings.impact)) impactScale = clamp(settings.impact / .65, 0, 1.6);
    }
    return game;
  }
  BABA.Game = Object.defineProperty({ create }, 'resources', { value: RESOURCES, enumerable: true });
}());
