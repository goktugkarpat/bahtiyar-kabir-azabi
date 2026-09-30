(function () {
  'use strict';
  const BABA = window.BABA = window.BABA || {};
  const SAVE_KEY = 'baba.kara-gecit.chapter-one.checkpoint.v2';
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  // Frame-rate independent turn toward b along the shortest way round (k = how fast, per second).
  const dampAngle = (a, b, k, dt) => a + angleDifference(b, a) * (1 - Math.exp(-k * dt));
  const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
  // One shared resource contract for combat, HUD and control hints. Weapons leave room for rolls and skills.
  const RESOURCES = Object.freeze({
    costs: Object.freeze({ light: 4, heavy: 8, dodge: 20, special: 45, rage: 45 }),
    cooldowns: Object.freeze({ special: 8, rage: 24 }),
    durations: Object.freeze({ rage: 11 })
  });
  const STATS = {
    prisoner: { name: 'Zincirli Mahkûm', hp: 118, speed: 2.4, radius: .58, reach: 2.5, cooldown: 1.25, color: 0xb77c63 },
    guard: { name: 'Mezar Muhafızı', hp: 205, speed: 1.8, radius: .72, reach: 3.4, cooldown: 1.75, color: 0xb49a5f },
    cultist: { name: 'Kül Rahibi', hp: 116, speed: 1.85, radius: .54, reach: 12, cooldown: 2.8, color: 0xac5550 },
    stalker: { name: 'Karanlık Pusucusu', hp: 130, speed: 3.15, radius: .53, reach: 8.5, cooldown: 1.8, color: 0x978790 },
    carrier: { name: 'Veba Taşıyıcısı', hp: 172, speed: 1.5, radius: .74, reach: 10, cooldown: 3.2, color: 0x829665 },
    boss: { name: 'Zincir Celladı', hp: 2100, speed: 2.2, radius: 1.03, reach: 13, cooldown: .75, color: 0xc69160 }
  };
  // Stronger enemies resist an unbuffed full Girdap; the boss has faster, explicitly timed normal moves.
  // Apply health once at spawn and damage once at contact so every enemy move follows the same balance.
  const BALANCE = Object.freeze({ health: 1.65, bossHealth: 1.50, damage: 1.70 });
  // Combat feel. Strike times, durations and damage stay authoritative; these shape how contact is presented.
  // Hit-stop freezes every combat clock together (player, enemies, hazards, i-frames), so it never grants an advantage.
  const FEEL = {
    buffer: .22, chainEarly: .12, finisherChainEarly: .06, queueAfter: .06,
    hitstop: { light: 0, finisher: 0, heavy: .008, extraTarget: 0, kill: 0, bossKill: .008, shield: 0, guardBreak: .008,
      hurt: 0, hurtHeavy: .008 },
    knock: { light: .32, finisher: .62, heavy: 1.05, shield: .12, boss: .05, bossHeavy: .16 },
    lunge: [.34, .42, .56], heavyLunge: .72, lungeLead: [.12, .12, .14], heavyLungeLead: .2,
    whoosh: { light: .09, finisher: .11, heavy: .15 },
    // How fast the body swings round to the facing the game decided on (per second): walking, aimed swing, roll.
    turn: { walk: 16, swing: 24, roll: 30 },
    // Blade direction at contact relative to facing (radians): slashes sweep across, the finisher chops forward.
    sweep: [Math.PI / 2, -Math.PI / 2, 0], heavySweep: Math.PI / 2
  };
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  // Fairness contract (COMBAT_PLAN §1): every strike's ground tell is fixed once visible; openers warn >= .55 s
  // (crimson "unblockable" = severe blows >= .95 s), follow-ups >= .45 s; two different enemies never land within RHYTHM of each other near
  // the hero, and only one normal-enemy unblockable strike may be pending near the hero in any +-TOKEN window.
  const TELL_LEAD = .18, RHYTHM = .3, TOKEN = .8, NEAR = 7;
  // Early halls teach one thing at a time: the first prisoners only use the gold (ordinary) moves. (The hero has no block any more: the
  // field name `unblockable` stays, it now means "severe, crimson tell: dodge it"; gold tells are ordinary blows, dodge them too if you can.)
  const GATES = { threshold: { prisoner: ['claw', 'lash', 'rush'] } };
  // The father's heavy blow (was 1.05 s with contact at .57 s and a held coil): contact at .35 s, the feet free again right after it.
  // beginAttack applies these on top of the light-chain numbers; the swing sound is scheduled from the press (audio.js H.heavy
  // builds up to contact), so it fires at once; the step into the blow starts .15 s before contact.
  const HEAVY = { duration: .70, strike: .35, lungeLead: .15 };
  // Flask: the heal lands on the press; the drink is only a short upper-body flourish (DRINK s) that never holds input.
  // A second press inside DRINK_GUARD s of a drink is ignored, so one press (or a double-fired tap) cannot burn two flasks.
  const DRINK = .34, DRINK_GUARD = .2;
  // Roll (Space): stamina cost and how long of its .48 s the hero cannot be hit; stamina regeneration per second (all in the D4-controls compensation).
  const DODGE = { cost: RESOURCES.costs.dodge, iframe: .45 }, REGEN = 34;
  // Diablo-4 click-target controls (steerOrders): a click on a foe walks up to it and swings (light left / heavy right), a click on the ground walks there,
  // Shift + click swings in place toward the cursor. reach = distance to the foe's edge at which the swing starts; arrive = stop distance of a ground click,
  // hold = the same while the button is held (steering); stuck = seconds without progress before an approach is given up.
  const ORDER = { reach: 2.6, reachHeavy: 3.0, arrive: .3, hold: .8, stuck: .7 };
  // Hero war cry: the roar releases its shockwave at ROAR.release; the father is committed until ROAR.duration
  // (quick: he keeps moving at ROAR.move of his speed and the blows-halved window is only this long).
  // Kan öfkesi: wider shockwave (near 6.5 m stagger / far 10 m cow), 11 s buff, -25 % damage taken (guard .75), 4 % of damage dealt returns as hp (steal);
  // while it burns, blows stagger lighter foes (see canStagger). The cry uses the same stamina as rolls/Girdap,
  // with its own cooldown; there is no separate fury meter to fill by fighting.
  const ROAR = { cost: RESOURCES.costs.rage, cooldown: RESOURCES.cooldowns.rage, duration: .36, release: .2, move: .6,
    near: 6.5, far: 10, time: RESOURCES.durations.rage, guard: .75, steal: .04 };
  // Special ability "Zincir Girdabı" (key 1, a whirlwind): the father spins with the chained cleaver for SPECIAL.duration s, walks on at SPECIAL.move of his speed
  // (steer with the movement keys) and hits every foe within SPECIAL.radius m SPECIAL.ticks times (first after SPECIAL.first s, then every SPECIAL.gap s) for SPECIAL.damage each
  // (ticks x damage = 132, what the old lane strike did). Ticks stagger small foes (SPECIAL.stagger s, the last one SPECIAL.staggerLast s and a knock-back), pull loose ones a
  // little inward (SPECIAL.pull m), break guards and give bosses only damage. Armoured: light hits do not stop it, a stagger (broken guard) or a roll does. It costs
  // SPECIAL.cost stamina (of 110) and rests SPECIAL.cooldown s. SPECIAL.turns full body turns are shown.
  const SPECIAL = { cost: RESOURCES.costs.special, cooldown: RESOURCES.cooldowns.special, duration: 1.3, radius: 3.6, ticks: 4, first: .15, gap: .28, damage: 33, stagger: .6, staggerLast: 1.15, pull: .45, move: .6, turns: 2 };
  // Test-build ease (29 Sep 2026; DESIGN.md "Enemy difficulty" has the measurements). Before -> after:
  //   executioner hp (STATS) 2280 -> 2100 and rest between two of his moves 1.25 -> 1.3 s; the five common foes keep their hp and pace
  //   (a few percent of hp changes no hit count, the special gate below is what lightens the halls).
  //   blows that land on the hero (scaled in hitPlayer; the strike tables and the tell / heavy-hit thresholds keep their numbers):
  //   x1 -> x1 (common foes: the special gate alone lightens the halls by about a third), executioner x1 -> x.88. Tells are untouched: no wind-up got shorter, blockable / must-dodge rules are as before.
  // D4 controls (the hero has no block / parry any more, see DESIGN.md "Diablo-4 controls"): to pay for the lost defence blows on the hero are
  // scaled down (x1 -> x.72 common foes, x.88 -> x.64 executioner; the -12 % first asked for left the scripted dodging bot losing +75 % hp, see DESIGN.md), the roll costs
  // 20 stamina (was 25) and its i-frames last .45 s of .48 (was .39), stamina regenerates at 34/s (was 28/s).
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
  const SPECIAL_IDS = ['rush', 'grab', 'over', 'shove', 'rite', 'pair', 'rune', 'leap', 'flank', 'vial', 'exhale', 'hook', 'slam', 'cyclone', 'hooks'];

  function create(world, services) {
    const scene = services.scene;
    const emit = (name, data) => { if (services.emit) services.emit(name, data || {}); };
    const sound = (name, opts) => { if (services.sound) services.sound(name, opts || {}); };
    const fx = (name, data) => { if (services.fx) services.fx(name, data || {}); };
    const root = new THREE.Group(); root.name = 'KaraGecitCombat'; scene.add(root);
    const hero = BABA.Models.create('hero'); root.add(hero.root);
    const limbs = BABA.Limbs ? BABA.Limbs.create(root, world, { fx, sound, emit }) : null;   // dismemberment of killed foes (limbs.js)
    const spawn = finitePoint(world.spawn) ? world.spawn : { x: 0, z: 7 };
    const checkpoint = finitePoint(world.checkpoint) ? world.checkpoint : { x: 0, z: -128 };
    const player = {
      x: spawn.x, z: spawn.z, face: Math.PI, yaw: Math.PI, hp: 125, maxHp: 125,
      stamina: 110, maxStamina: 110,
      flasks: 4, maxFlasks: 4, dead: false, model: hero,
      attack: null, dodge: 0, healing: 0, rageTime: 0,
      hurt: 0, stagger: 0, status: '', invulnerable: false, target: null
    };
    const enemies = [], hazards = [], seals = [];
    let hazardSerial = 0;
    const globes = BABA.Globes ? BABA.Globes.create(root, world, { player, fx, sound, emit }) : null;   // health globes dropped by dead foes (globes.js)
    const encounterDefs = (world.encounters || []).map((encounter, index) => ({
      id: String(encounter.id == null ? index : encounter.id), room: encounter.room,
      name: encounter.name || 'Karanlık Geçit', clearText: encounter.clearText || 'Salon sustu. Yol mührü açıldı.', activated: false, announced: false,
      roomName: ((world.rooms || []).find(room => String(room.id) === String(encounter.room)) || {}).name || encounter.name || 'Karanlık Geçit',
      nextName: ((world.rooms || [])[(world.rooms || []).findIndex(room => String(room.id) === String(encounter.room)) + 1] || {}).name || '',
      spawns: (encounter.spawns || []).filter(s => STATS[s.type]), enemies: []
    }));
    const game = {
      player, enemies, hazards, state: 'ready', checkpointIndex: 0,
      elapsed: 0, kills: 0, totalKills: 0, lastDeath: null, hasSave: false,
      currentRoom: null, activeEncounter: '', boss: null, attackTarget: null,
      start, update, restart, respawn, interact, dispose, setQuality, toTitle, beginRenderTraversal, endRenderTraversal, prepareGraphics
    };
    let disposed = false, simTime = 0, buffer = {};
    // Only the renderer's scene walk may skip invisible actor trees. Animation, queries and limb capture stay native.
    let renderTraversal = false;
    const matrixGuards = [];
    function beginRenderTraversal() { if (!disposed) renderTraversal = true; }
    function endRenderTraversal() { renderTraversal = false; }
    function guardRenderMatrices(node) {
      const descriptor = Object.getOwnPropertyDescriptor(node, 'updateMatrixWorld'), nativeUpdate = node.updateMatrixWorld;
      const guard = function (force) {
        if (renderTraversal && !this.visible) return;
        return nativeUpdate.call(this, force);
      };
      node.updateMatrixWorld = guard; matrixGuards.push({ node, guard, descriptor });
    }
    let staminaDelay = 0, dodgeAge = 0, dodgeVector = { x: 0, z: -1 };
    // Explicit aim of this frame (gamepad right stick only; the mouse never aims): its direction from the hero, null = none.
    // moveFace = travel direction this frame (null = standing); assistFoe = the foe the last attack-key swing auto-turned onto (hysteresis).
    let aimFace = null, moveFace = null, assistFoe = null;
    // D4 click-target controls (steerOrders): order = the standing mouse / touch order { kind: 'attack' | 'move' | 'stand', enemy, heavy, x, z, owed, held };
    // swingPlan = the swing the order wants this frame (foe in reach / stand); dodgeAim = the cursor / target direction a roll takes when no key is held;
    // pendingClick = a click that arrived during hit-stop; targetRing = the slim ember ring under the foe that is targeted / under the cursor.
    let order = null, swingPlan = null, dodgeAim = null, pendingClick = null, targetRing = null, rawInput = null, moveMark = null, markX = 0, markZ = 0, markA = 0;
    let forcedMotion = null, healingAge = 0, comboStep = 0, comboWindow = 0, spinCur = 0;
    let playerHitImmunity = 0, checkpointSnapshot = null, endAnnounced = false;
    let hintCooldown = 0, deniedCooldown = 0, deniedId = '', lackSerial = 0, debugInvincible = false, openingGrace = 8, corpseLifetime = 90, shadowReach = 0;
    let freeze = 0, slowmo = 0, impactScale = 1, attackSerial = 0, actionSerial = 0, evadeCooldown = 0, pairCd = 0;
    let drinkLeft = 0;   // seconds of the flask flourish still to play (also the double-press guard)
    let navigationBudget = 0;   // at most two searches per update, including slow-frame substeps; the player goes first
    let decisionStep = 1 / 60;   // AI patience is measured in simulation seconds, never rendered frames
    const victims = [];
    game.timeScale = 1; game.resetSerial = 0;
    game.limbs = limbs;   // read-only handle for QA (pool statistics)
    game.globes = globes;
    // Slow motion: every combat clock slows together, exactly like hit-stop, so it never favours a side (no caller since the war cry became quick).
    function slowMotion(seconds) { if (!reducedMotion.matches && seconds > 0 && impactScale > 0) slowmo = Math.max(slowmo, seconds); }
    // Heavy contact emphasis: at most 8 ms of shared combat time; ordinary blows never hold the frame.
    function hitStop(seconds, shudder) {
      if (reducedMotion.matches || !(seconds > 0)) return 0;
      const s = Math.min(.008, seconds * impactScale); freeze = Math.max(freeze, s);
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
    function sweepAngle(attack) { return attack.face + (attack.heavy ? FEEL.heavySweep : FEEL.sweep[attack.combo] || 0); }

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
    // Contact shadow: a soft dark blob under every body (replaces the old coloured rings). Shared texture.
    let blobTexture = null;
    function contactShadow(radius) {
      if (!blobTexture && typeof document !== 'undefined') {
        const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
        const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.62)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, 64, 64); blobTexture = new THREE.CanvasTexture(c);
      }
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.35, 24), new THREE.MeshBasicMaterial({
        color: 0, alphaMap: blobTexture, transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
      }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = .028; mesh.renderOrder = -1; mesh.name = 'contact_shadow'; return mesh;
    }
    // Ground tells are drawn by telegraphs.js from game.hazards (renderer only); combat owns timing and hit tests.
    // Optional hazard fields: style, fill, sweepDir, inner (ring), pose, pullTo, (parry / parryStagger / guardPressure in the move tables are inert since the hero lost his block),
    // projectile, onHitPlayer, scar, moveId, near (was close to the hero when planned), beat (animation beat or not).
    function addHazard(options) {
      const h = Object.assign({
        x: 0, z: 0, face: 0, shape: 'circle', radius: 2, arc: Math.PI, inner: 0,
        width: 1.5, length: 7, warn: .8, duration: .17, delay: 0, damage: 16,
        owner: null, enemy: 'Tehlike', attack: 'Darbe', unblockable: false,
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
    function clearHazards() { hazards.length = 0; }
    // Soft pooled light on the floor (checkpoint, seals, heals, buffs, parries). Drawn by effects.js.
    function flashRing(x, z, radius, color, duration) { fx('glowBurst', { x, y: .05, z, radius, color, duration: duration || .32 }); }
    // Per-enemy move memory (also restored on every checkpoint reset so a respawn replays identically).
    function freshEnemyFields(e) {
      return { seed: 9173 + e.index * 131, lastMove: '', grabCd: 0, riposteCd: 0, blockCount: 0, hooksCd: 6, enraged: false,
        picks: 0, sidestep: 0, retreat: 0, fear: 0, pairWith: null, wrath: 0, spWait: e.type === 'prisoner' ? 0 : 2, spHold: 0 };
    }
    function healthBar(enemy) {
      const bar = new THREE.Group();
      const background = new THREE.Mesh(new THREE.PlaneGeometry(enemy.boss ? 2.2 : 1.2, .09), new THREE.MeshBasicMaterial({ color: 0x181413, depthTest: false }));
      const front = new THREE.Mesh(new THREE.PlaneGeometry(enemy.boss ? 2.16 : 1.16, .055), new THREE.MeshBasicMaterial({ color: enemy.boss ? 0xb27855 : 0x9e4d43, depthTest: false }));
      front.position.z = .008; bar.add(background, front); bar.rotation.x = -.77; bar.renderOrder = 20; root.add(bar);
      return { root: bar, fill: front };
    }

    const heroShadow = contactShadow(.5); root.add(heroShadow);
    encounterDefs.forEach((enc, ei) => {
      enc.spawns.forEach((s, si) => {
        const stats = STATS[s.type], model = BABA.Models.create(s.type);
        const maxHp = Math.round(stats.hp * (s.type === 'boss' ? BALANCE.bossHealth : BALANCE.health));
        root.add(model.root);
        guardRenderMatrices(model.root);
        const enemy = {
          id: enc.id + ':' + si, encounter: enc, index: enemies.length, type: s.type, name: stats.name,
          x: s.x, z: s.z, spawnX: s.x, spawnZ: s.z, face: Math.PI,
          hp: maxHp, maxHp, dead: false, model, boss: s.type === 'boss', phase: 1,
          active: false, activated: false, cooldown: .4 + si * .33, action: null,
          radius: model.radius || stats.radius, stats, hurt: 0, stagger: 0,
          deadAge: 0, move: 0, buff: 0, buffCooldown: 7 + si, cycle: 0,
          retreat: 0, shieldBroken: 0, poiseRecovery: 0, shield: s.type === 'guard', faceLocked: false
        };
        enemy.bar = healthBar(enemy);
        enemy.shadow = contactShadow(enemy.radius); root.add(enemy.shadow);
        Object.assign(enemy, freshEnemyFields(enemy));
        enemies.push(enemy); enc.enemies.push(enemy);
        model.root.position.set(enemy.x, 0, enemy.z);
        if (enemy.boss) game.boss = enemy;
      });
    });
    game.totalKills = enemies.length;
    const signature = enemies.map(e => e.id + '@' + e.spawnX + ',' + e.spawnZ + ':' + e.type).join('|');

    // Each occupied hall is a self-contained fight. The sealed exit is visible
    // before the player reaches it and opens immediately on the final kill.
    encounterDefs.filter(enc => !enc.enemies.some(e => e.boss)).forEach(enc => {
      const room = (world.rooms || []).find(room => String(room.id) === String(enc.room));
      if (!room) return;
      const seal = { encounter: enc, x: 0, z: room.z - room.d / 2 + .35, open: false, fade: 0, group: new THREE.Group() };
      seal.group.position.set(seal.x, .035, seal.z); seal.group.name = 'Encounter seal: ' + enc.name;
      const stone = new THREE.MeshStandardMaterial({ color: 0x211c1b, roughness: .84, metalness: .3 });
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.24, 2.4, .3), stone.clone());
        post.position.set(side * 3.35, 1.2, 0); seal.group.add(post);
      }
      stone.dispose();
      const line = flatRectangle(6.7, .24, 0xbc5946, .75); line.position.y = .05; seal.group.add(line);
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.3), new THREE.MeshBasicMaterial({
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
      chains.castShadow = true; chains.receiveShadow = true;
      seal.group.add(chains);
      root.add(seal.group); seals.push(seal);
    });

    function freshSnapshot() {
      return { index: 0, x: spawn.x, z: spawn.z, dead: [], kills: 0, elapsed: 0 };
    }
    function readSave() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY));
        if (!saved || saved.version !== 2 || saved.signature !== signature || saved.index !== 1) return null;
        const validIds = new Set(enemies.filter(e => !e.boss).map(e => e.id));
        if (!Array.isArray(saved.dead) || saved.dead.some(id => !validIds.has(id))) return null;
        const dead = Array.from(new Set(saved.dead));
        // This stone only opens after every preceding hall is clear. A partial/corrupt
        // record must never put the hero behind closed seals with living foes outside.
        if (dead.length !== validIds.size) return null;
        return { index: 1, x: checkpoint.x, z: checkpoint.z, dead, kills: dead.length, elapsed: clamp(Number(saved.elapsed) || 0, 0, 86400) };
      } catch (_) { return null; }
    }
    function saveCheckpoint() {
      game.hasSave = true;
      try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign({ version: 2, signature }, checkpointSnapshot))); }
      catch (_) { emit('toast', { text: 'Mühür bu oturum için kaydedildi.' }); }
    }
    function removeSave() {
      try { window.localStorage.removeItem(SAVE_KEY); }
      catch (_) {
        try { window.localStorage.setItem(SAVE_KEY, 'null'); }
        catch (_) { emit('toast', { text: 'Bu cihazdaki eski mühür kaydı silinemedi.' }); }
      }
      game.hasSave = false;
    }
    checkpointSnapshot = readSave() || freshSnapshot(); game.hasSave = checkpointSnapshot.index === 1;
    game.checkpointIndex = checkpointSnapshot.index;

    function resetToSnapshot(snapshot) {
      clearHazards(); shudder(false); game.resetSerial++;
      if (limbs) limbs.reset(enemies);
      if (globes) globes.reset();
      simTime = 0; buffer = {}; staminaDelay = 0; drinkLeft = 0; order = null; swingPlan = null; dodgeAim = null; pendingClick = null; showTargetRing(null); clearMoveMark();
      dodgeAge = 0; forcedMotion = null; healingAge = 0; comboStep = 0; comboWindow = 0; spinCur = 0;
      playerHitImmunity = 0; endAnnounced = false; hintCooldown = 0; deniedCooldown = 0; deniedId = ''; lackSerial = 0; openingGrace = snapshot.index ? 0 : 8;
      freeze = 0; slowmo = 0; victims.length = 0; evadeCooldown = 0; game.hitStop = 0; game.timeScale = 1; pairCd = 0;
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
      const killed = new Set(snapshot.dead);
      encounterDefs.forEach(enc => { enc.activated = false; enc.announced = false; });
      enemies.forEach(enemy => {
        Object.assign(enemy, {
          x: enemy.spawnX, z: enemy.spawnZ, face: Math.PI, hp: killed.has(enemy.id) ? 0 : enemy.maxHp,
          dead: killed.has(enemy.id), phase: 1, active: false, activated: false,
          cooldown: .55 + (enemy.index % 5) * .31, action: null, hurt: 0, stagger: 0,
          deadAge: killed.has(enemy.id) ? Infinity : 0, move: 0, buff: 0, buffCooldown: 7 + enemy.index % 4,
          cycle: 0, retreat: 0, shieldBroken: 0, poiseRecovery: 0, shield: enemy.type === 'guard', faceLocked: false,
          push: null, staggerTotal: 0, staggerKind: '', deathKind: '', hitAngle: 0, hurtHeavy: false, lastStrike: -9, navigation: null
        });
        enemy.model.root.position.set(enemy.x, 0, enemy.z); enemy.model.root.rotation.y = enemy.face;
        Object.assign(enemy, freshEnemyFields(enemy));
        enemy.model.root.visible = !enemy.dead; enemy.shadow.visible = false; enemy.bar.root.visible = false;
        const pose = { reset: true, time: 0, move: 0, attack: 0, dead: enemy.dead, phase: 'idle', face: enemy.face };
        enemy.model.animate(0, pose);
      });
      seals.forEach(seal => { seal.open = seal.encounter.enemies.every(e => e.dead); seal.fade = seal.open ? 1 : 0; seal.group.visible = !seal.open; });
      const heroPose = { reset: true, time: 0, move: 0, attack: 0, dead: false, face: player.face };
      hero.animate(0, heroPose);
      emit('boss', { name: STATS.boss.name, active: false });
    }
    resetToSnapshot(freshSnapshot());
    // A saved run is only placed on the map when Play is pressed.
    game.checkpointIndex = checkpointSnapshot.index;

    function start() {
      if (disposed || game.state === 'playing') return;
      resetToSnapshot(checkpointSnapshot); game.state = 'playing';
      emit('toast', { text: checkpointSnapshot.index ? 'Son mühürden devam ediyorsun. Cellat ileride.' : 'Kurban Tapınağı. Mührü bul. Celladı sustur.' });
    }
    function restart() {
      if (disposed) return;
      removeSave(); checkpointSnapshot = freshSnapshot(); resetToSnapshot(checkpointSnapshot); game.state = 'playing';
      emit('toast', { text: 'Yeni yürüyüş. Geçit seni bekliyor.' });
    }
    function respawn() {
      if (disposed) return;
      resetToSnapshot(checkpointSnapshot); game.state = 'playing';
      emit('toast', { text: checkpointSnapshot.index ? 'Son mühre döndün. Yaraların kapandı.' : 'İlk mühre döndün. Düşmanlar yeniden ayakta.' });
    }
    // Behind the title the temple is shown from its entrance (the world, fog and lights follow the hero), even with a
    // saved oath stone; the save itself is only placed on the map by start().
    function toTitle() {
      if (disposed) return;
      resetToSnapshot(freshSnapshot()); game.checkpointIndex = checkpointSnapshot.index; game.state = 'ready';
    }
    function atSafeCheckpoint() {
      return distance(player, checkpoint) < 6.1 && !enemies.some(e => !e.dead && !e.boss)
        && !hazards.some(h => !h.harmless && distance(h, player) < (h.radius || h.length || 2) + 2);
    }
    function activateCheckpoint() {
      if (game.checkpointIndex || !atSafeCheckpoint()) return false;
      checkpointSnapshot = {
        index: 1, x: checkpoint.x, z: checkpoint.z,
        dead: enemies.filter(e => e.dead && !e.boss).map(e => e.id), kills: game.kills, elapsed: game.elapsed
      };
      game.checkpointIndex = 1;
      player.hp = player.maxHp; player.stamina = player.maxStamina; player.flasks = player.maxFlasks;
      player.specialCd = player.rageCd = 0;
      game.attackTarget = null;
      if (globes) globes.reset();
      saveCheckpoint(); flashRing(checkpoint.x, checkpoint.z, 3.3, 0xf0d293, 1.4);
      sound('checkpoint'); emit('checkpoint', { index: 1, name: 'Celladın Eşiği' });
      return true;
    }
    function interact() {
      if (game.state !== 'playing') return;
      if (activateCheckpoint()) return;
      if (distance(player, checkpoint) < 6.1) emit('toast', { text: game.checkpointIndex ? 'Mühür açık. Cellat salonda bekliyor.' : 'Mühür için çevredeki düşmanları temizle.' });
    }

    function moveBody(body, dx, dz, radius) {
      if (Math.abs(dx) + Math.abs(dz) < 1e-7) return;
      const previousZ = body.z;
      if (world.move) world.move(body, dx, dz, radius);
      else { body.x += dx; body.z += dz; }
      if (body === player && dz < 0) {
        for (const seal of seals) {
          if (!seal.open && previousZ >= seal.z && body.z < seal.z + radius) {
            body.z = seal.z + radius;
            if (hintCooldown <= 0) { emit('toast', { text: 'Mührü açmak için bu salondaki düşmanları sustur.' }); hintCooldown = 3.5; }
          }
        }
      }
    }
    function separateEnemies(enemy, dt) {
      let sx = 0, sz = 0;
      for (const other of enemies) {
        if (other === enemy || other.dead || !other.active) continue;
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
        if (e.dead || !e.active || e.model.root.position.y > .3) continue;
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
            if (nav.route && isHero && target.kind === 'move') {
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
      const mine = enemy.type === 'cultist' || enemy.type === 'carrier';
      let simultaneous = 0, same = 0;
      for (const e of enemies) {
        if (e === enemy || !e.active || e.dead || !e.action || !(distance(e, player) < 18)) continue;
        simultaneous++; if ((e.type === 'cultist' || e.type === 'carrier') === mine) same++;
      }
      if (enemy.boss) return simultaneous === 0;
      return simultaneous < 3 && same < (mine ? 1 : 2);
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
    function beginMove(enemy, move) {
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
      if (move.onBegin) move.onBegin(a);
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
      if (enemy.forceMove) { const o = options.find(p => p.id === enemy.forceMove); if (o && beginMove(enemy, o.move())) { enemy.forceMove = ''; return true; } return false; }
      const ok = options.filter(o => o.ok && !(o.sp && enemy.spWait > 0)), weight = o => (o.w || 1) * (o.sp ? SPECIAL_W : 1);
      // Only specials legal (hero out of plain range): chase first instead of throwing one at once.
      if (ok.length && ok.every(o => o.sp)) { enemy.spHold += decisionStep; if (enemy.spHold + 1e-7 < SPECIAL_HOLD) return false; } else enemy.spHold = 0;
      let pool = ok.filter(o => o.id !== enemy.lastMove);
      if (!pool.length || (ok.some(o => !o.sp) && pool.every(o => o.sp))) pool = ok;   // repeating the one plain blow beats being forced into a special
      while (pool.length) {
        let r = rand(enemy) * pool.reduce((s, o) => s + weight(o), 0), chosen = pool[pool.length - 1];
        for (const o of pool) if ((r -= weight(o)) <= 0) { chosen = o; break; }
        if (beginMove(enemy, Object.assign(chosen.move(), { plain: !chosen.sp }))) { enemy.spHold = 0; enemy.spWait = chosen.sp ? SPECIAL_GAP[enemy.boss && enemy.phase === 2 ? 'boss2' : enemy.type] : Math.max(0, enemy.spWait - 1); return true; }
        pool = pool.filter(o => o !== chosen);
      }
      return false;
    }
    function allowFor(e) { const g = GATES[e.encounter.id] && GATES[e.encounter.id][e.type]; return id => !g || g.includes(id); }
    const walkable = (x, z, r) => !world.isWalkable || world.isWalkable(x, z, r);
    // Lines that travel (spurs, the hook, rushes, charges) stop at the first wall along their path.
    function clipLine(o, face, L) {
      if (!world.isWalkable) return L;
      for (let s = .5; s < L; s += .25) if (!world.isWalkable(o.x + Math.sin(face) * s, o.z + Math.cos(face) * s, .15)) return Math.max(1, s + .15);
      return L;
    }
    function clearStrike(a, b) {
      const dz = b.z - a.z;
      if (Math.abs(dz) > 1e-6) for (const seal of seals) {
        if (seal.open) continue;
        const u = (seal.z - a.z) / dz;
        if (u > 0 && u < 1 && Math.abs(a.x + (b.x - a.x) * u - seal.x) < 3.5) return false;
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
      const w = enemies.find(o => (o.type === 'cultist' || o.type === 'carrier') && o.active && !o.dead && distance(o, e) < 10);
      if (!w || distance(player, w) < 3) return null;
      const a = angleTo(w, player), dd = Math.max(1.5, distance(w, player) - 2.4), s = (e.index % 2 ? 1.1 : -1.1);
      return { x: w.x + Math.sin(a) * dd + Math.cos(a) * s, z: w.z + Math.cos(a) * dd - Math.sin(a) * s };
    }

    function prisonerAttack(e, d) {
      const allow = allowFor(e), fx0 = Math.sin(e.face), fz0 = Math.cos(e.face);
      return pick(e, [
        // The second claw steps in after the first, so backing straight off is not enough: roll through it.
        { id: 'claw', ok: d < 2.6 && allow('claw'), w: 3, move: () => ({ id: 'claw', name: 'İkili Pençe', duration: 1.62, pose: 'clawR',
          movement: { start: .62, duration: .28, fromX: e.x, fromZ: e.z, x: e.x + fx0 * .7, z: e.z + fz0 * .7, ease: true }, hits: [
          { at: .56, warn: .56, shape: 'cone', radius: 2.7, arc: 2.2, dmg: 12, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'clawR', attack: 'İkili Pençe · ilk darbe' },
          { at: 1.04, warn: .48, shape: 'cone', radius: 2.9, arc: 2.4, track: true, dmg: 15, style: 'blade', fill: 'sweep', sweepDir: -1, pose: 'clawL', attack: 'İkili Pençe · ikinci darbe' }] }) },
        { id: 'lash', ok: d >= 2.3 && d < 3.9 && allow('lash'), w: 2, move: () => ({ id: 'lash', name: 'Zincir Kırbacı', duration: 1.4, pose: 'chainWhip', hits: [
          { at: .62, warn: .62, shape: 'cone', radius: 3.9, arc: 1.4, dmg: 14, knockback: 1.2, style: 'chain', fill: 'sweep', sweepDir: 1, pose: 'chainWhip' }] }) },
        { id: 'rush', sp: 1, ok: d >= 3.9 && d < 8.3 && allow('rush'), w: 2, move: () => {
          const L = clipLine(e, e.face, Math.min(7.8, d + .6));
          return { id: 'rush', name: 'Zincir Hücumu', duration: 1.9, pose: 'lunge', feint: { at: .28, chance: .25 },
            movement: { start: 1.15, duration: .3, fromX: e.x, fromZ: e.z, x: e.x + fx0 * (L - .6), z: e.z + fz0 * (L - .6) },
            hits: [{ at: 1.15, warn: .8, shape: 'line', width: 1.5, length: L, dmg: 15, knockback: 3, style: 'thrust', fill: 'forward', pose: 'lunge', duration: .3 }] }; } },
        { id: 'grab', sp: 1, ok: d < 2.4 && e.grabCd <= 0 && allow('grab'), w: 1, move: () => ({ id: 'grab', name: 'Boğucu Kavrayış', duration: 1.75, pose: 'grab',
          onBegin() { e.grabCd = 18; },
          hits: [{ at: 1.0, warn: 1.0, shape: 'cone', radius: 2.5, arc: 1.5, dmg: 20, unblockable: true, style: 'grab', fill: 'inward', pose: 'grab' }] }) }
      ]);
    }
    function guardRiposte(e) {
      return beginMove(e, { id: 'riposte', name: 'Pala Dürtüşü', duration: 1.15, pose: 'thrust', hits: [
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
        { id: 'cut', ok: d < 3.3, w: 3, move: () => ({ id: 'cut', name: 'Pala Kesişi', duration: 1.85, pose: 'slashR',
          movement: { start: .72, duration: .3, fromX: e.x, fromZ: e.z, x: e.x + Math.sin(e.face) * .9, z: e.z + Math.cos(e.face) * .9, ease: true }, hits: [
          { at: .58, warn: .58, shape: 'cone', radius: 3.3, arc: 2.5, dmg: 18, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'slashR' },
          { at: 1.22, warn: .5, shape: 'cone', radius: 3.1, arc: 2.2, track: true, dmg: 12, style: 'blade', fill: 'sweep', sweepDir: -1, pose: 'sweepBack', attack: 'Pala Kesişi · dönüş' }] }) },
        { id: 'over', sp: 1, ok: d > 1.2 && d < 3.8, w: 2, move: () => ({ id: 'over', name: 'Gecikmiş Pala', duration: 2.1, pose: 'overheadHold', hits: [
          { at: 1.2, warn: 1.2, shape: 'line', width: 1.3, length: 4.0, dmg: 26, knockback: 2.2, style: 'blade', fill: 'forward', pose: 'overheadHold', scar: true }] }) },
        { id: 'shove', sp: 1, ok: d < 2.4 && (behind || e.picks % 4 === 3), w: behind ? 6 : 2, move: () => ({ id: 'shove', name: 'Kalkan Hamlesi', duration: 1.35, pose: 'shove', hits: [
          { at: .75, warn: .75, shape: 'line', width: 2.2, length: 2.7, dmg: 8, knockback: 6, guardPressure: 3, style: 'blunt', fill: 'forward', pose: 'shove' }] }) }
      ]);
    }
    // The second priest of İkili Ayin: channels (no tell of its own) while the first one's line fills between them.
    function pairMirror(b, a) {
      b.face = angleTo(b, a);
      setEnemyAction(b, 1.9, 'İkili Ayin', null, { moveId: 'pairMirror', pose: 'cast', style: 'rune', unblockable: true });
      b.action.pairWith = a; b.action.beats.push({ start: 0, strike: 1.4, duration: .17, pose: 'cast' }); b.lastMove = 'pair';
    }
    function cultistAttack(e, d) {
      if (d > 12) return false;
      const ally = enemies.find(o => o !== e && o.active && !o.dead && !o.boss && distance(o, e) < 11 && o.buff < 1);
      const partner = enemies.find(o => o !== e && o.type === 'cultist' && o.active && !o.dead && !o.action && o.stagger <= 0
        && distance(o, e) > 4 && distance(o, e) < 12);
      const pairOk = !!partner && pairCd <= 0 && segmentDistance(player, e, partner) < 1.8;
      return pick(e, [
        { id: 'rite', sp: 1, ok: e.buffCooldown <= 0 && !!ally, w: 6, move: () => ({ id: 'rite', name: 'Kan Ayini', duration: 1.65, pose: 'kneel', onBegin() { e.buffCooldown = 22; },
          hits: [{ at: 1.05, warn: 1.05, shape: 'circle', radius: 1.35, dmg: 0, harmless: true, duration: .26, style: 'rune', pose: 'kneel',
            onActive() {
              if (e.dead) return;
              enemies.forEach(o => { if (!o.dead && !o.boss && distance(o, e) < 11) { o.buff = 9; flashRing(o.x, o.z, o.radius + .35, 0xdb675e, .8); } });
              emit('toast', { text: 'Kül Rahibi yakındakileri güçlendirdi.' }); sound('rage', { enemy: true });
            } }] }) },
        { id: 'pair', sp: 1, ok: pairOk, w: 5, move: () => ({ id: 'pair', name: 'İkili Ayin', duration: 1.9, pose: 'cast', onBegin() { pairCd = 20; pairMirror(partner, e); },
          hits: [{ at: 1.4, warn: 1.4, shape: 'line', width: 1.4, length: distance(e, partner), face: angleTo(e, partner), dmg: 20, unblockable: true,
            style: 'rune', fill: 'converge', pose: 'cast', partner,
            onActive() { const b = this.partner; if (!b || b.dead || b.stagger > 0 || !b.action || b.action.moveId !== 'pairMirror') this.harmless = true; } }] }) },
        { id: 'rune', sp: 1, ok: d > 4 && d < 12, w: 3, move: () => ({ id: 'rune', name: 'Kurban Rünü', duration: 1.9, pose: 'cast', hits: [
          { at: 1.35, warn: 1.35, shape: 'circle', radius: 2.3, origin: { x: player.x, z: player.z }, dmg: 22, unblockable: true, style: 'rune', fill: 'inward', pose: 'cast' }] }) },
        { id: 'embers', ok: d > 3 && d < 12, w: 2, move: () => {
          const th = rand(e) * TAU, p0 = { x: player.x, z: player.z };
          const c = [p0, { x: p0.x + Math.sin(th) * 1.9, z: p0.z + Math.cos(th) * 1.9 }, { x: p0.x + Math.sin(th + 2.3) * 1.9, z: p0.z + Math.cos(th + 2.3) * 1.9 }];
          return { id: 'embers', name: 'Kor Yağmuru', duration: 1.95, pose: 'castHigh', cooldown: 3.6, hits: c.map((o, i) => ({
            at: 1 + i * .2, warn: .9, shape: 'circle', radius: 1.3, origin: o, dmg: 8, style: 'ember', fill: 'radial', pose: 'castHigh', beat: i === 0 })) }; } },
        { id: 'brazier', ok: d < 3.4, w: 4, move: () => ({ id: 'brazier', name: 'Mangal Savuruşu', duration: 1.35, pose: 'staffSwing', retreat: 1.2, hits: [
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
          return { id: 'leap', name: 'Karanlık Sıçrayışı', duration: 1.85, pose: 'crouch', retreat: 1.3, feint: { at: .3, chance: .2, kind: 'sidestep' },
            movement: { start: .95, duration: .3, fromX: e.x, fromZ: e.z, x: t.x - Math.sin(a) * back, z: t.z - Math.cos(a) * back, leap: true },
            hits: [{ at: 1.25, warn: .9, shape: 'circle', radius: 2.0, origin: t, dmg: 18, style: 'shadow', fill: 'radial', pose: 'leap' }] }; } },
        { id: 'flurry', ok: d < 3.2, w: 3, move: () => ({ id: 'flurry', name: 'Kemik Pençe Seli', duration: 1.95, pose: 'clawR', retreat: 1.0,
          movement: { start: .6, duration: .85, fromX: e.x, fromZ: e.z, x: e.x + Math.sin(e.face) * 1.0, z: e.z + Math.cos(e.face) * 1.0 }, hits: [
          { at: .55, warn: .55, shape: 'cone', radius: 2.6, arc: 2.0, dmg: 8, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'clawR' },
          { at: 1.0, warn: .45, shape: 'cone', radius: 2.6, arc: 2.0, track: true, dmg: 8, style: 'blade', fill: 'sweep', sweepDir: -1, pose: 'clawL' },
          { at: 1.5, warn: .5, shape: 'cone', radius: 2.9, arc: 2.3, track: true, dmg: 13, knockback: 2, style: 'blade', fill: 'sweep', sweepDir: 1, pose: 'clawR', attack: 'Kemik Pençe Seli · son' }] }) },
        { id: 'flank', sp: 1, ok: !!dest, w: 4, move: () => {
          const f = angleTo(dest, player);
          return { id: 'flank', name: 'Gölge Adımı', duration: 1.6, pose: 'strafe', retreat: 1.0, faceAt: { t: .42, face: f },
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
        { id: 'spray', ok: d < 5.5, w: 3, move: () => ({ id: 'spray', name: 'Veba Tükürüğü', duration: 1.5, pose: 'spit', hits: [
          { at: .85, warn: .85, shape: 'cone', radius: 5.2, arc: .75, dmg: 12, style: 'bile', fill: 'forward', pose: 'spit' }] }) },
        { id: 'vial', sp: 1, ok: d > 5 && d < 10.5 && pools < 2, w: pools ? 1 : 3, move: () => {
          const t = { x: player.x, z: player.z };
          return { id: 'vial', name: 'Şişe Fırlatma', duration: 1.65, pose: 'throw', hits: [
            { at: 1.1, warn: 1.1, shape: 'circle', radius: 1.9, origin: t, dmg: 12, style: 'bile', fill: 'radial', pose: 'throw',
              projectile: { kind: 'vial', fromY: 1.6, flight: .6, height: 2.6 }, onActive() { poisonPool(e, t.x, t.z); } }] }; } },
        { id: 'exhale', sp: 1, ok: d < 3, w: 2, move: () => ({ id: 'exhale', name: 'Çürük Nefes', duration: 1.8, pose: 'roar', hits: [
          { at: 1.0, warn: 1.0, shape: 'circle', radius: 3.0, dmg: 12, unblockable: true, style: 'bile', fill: 'radial', pose: 'roar' }] }) }
      ]);
    }

    // ------------------------------------------------------------------ Zincir Celladı
    function roarMove(name, duration, cooldown) {
      return { id: 'roar', name, duration, pose: 'roar', cooldown, hits: [
        { at: 1.0, warn: 1.0, shape: 'circle', radius: 5.5, dmg: 5, knockback: 5, style: 'roar', fill: 'radial', pose: 'roar', cancelOnStagger: false, parry: 'deflect' }] };
    }
    function kickMove() {
      return { id: 'kick', name: 'Cellat Tekmesi', duration: 1.05, pose: 'kick', hits: [
        { at: .5, warn: .5, shape: 'cone', radius: 2.6, arc: 1.9, dmg: 12, knockback: 5.5, parryStagger: 1.0, style: 'blunt', fill: 'forward', pose: 'kick' }] };
    }
    function slamMove(e, d, after) {
      const f = e.face, k = clamp(d, 3, 6), t = { x: e.x + Math.sin(f) * k, z: e.z + Math.cos(f) * k };
      const hits = [
        { at: after ? 1.35 : 1.4, warn: after ? 1.35 : 1.4, shape: 'circle', radius: 2.3, origin: t, dmg: 34, unblockable: true, style: 'quake', fill: 'inward', pose: 'overhead', scar: true, attack: 'Mezar Kıran' },
        { at: after ? 1.5 : 1.55, warn: after ? 1.5 : 1.55, shape: 'line', width: 1.4, length: 5.5, origin: t, face: f, dmg: 18, unblockable: true, style: 'quake', fill: 'forward', beat: false, scar: true, attack: 'Mezar Kıran · yarık' }];
      // The aftershock appears only after the first impact, centred between the executioner and the crater.
      if (after) hits.push({ at: 2.95, warn: 1.2, shape: 'circle', radius: 3.6, origin: { x: t.x - Math.sin(f) * 2, z: t.z - Math.cos(f) * 2 }, dmg: 30, unblockable: true,
        style: 'quake', fill: 'inward', pose: 'overhead', scar: true, attack: 'Mezar Kıran · artçı darbe' });
      return { id: 'slam', name: after ? 'Mezar Kıran · artçı' : 'Mezar Kıran', duration: after ? 3.9 : 2.9, pose: 'overhead', hits };
    }
    function chargeMove(e, d, at, p2) {
      const f = e.face, L = clipLine(e, e.face, Math.min(11, d + 1));
      let run = L - 1.2; while (run > 1.5 && !walkable(e.x + Math.sin(f) * run, e.z + Math.cos(f) * run, e.radius)) run -= .5;
      const end = { x: e.x + Math.sin(f) * run, z: e.z + Math.cos(f) * run };
      const hits = [{ at, warn: at, shape: 'line', width: 2.3, length: L, dmg: 20, knockback: 5, guardPressure: 2, style: 'blunt', fill: 'forward', pose: 'charge', duration: .45,
        attack: p2 ? 'Hamle ve Biçiş · hamle' : 'Omuz Hamlesi' }];
      if (p2) hits.push({ at: 2.0, warn: .9, shape: 'cone', radius: 4.6, arc: 3.0, origin: end, dmg: 24, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep', attack: 'Hamle ve Biçiş · biçiş' });
      return { id: 'charge', name: p2 ? 'Hamle ve Biçiş' : 'Omuz Hamlesi', duration: p2 ? 2.9 : 2.2, pose: 'charge',
        movement: { start: at, duration: .45, fromX: e.x, fromZ: e.z, x: end.x, z: end.z }, hits };
    }
    function hookLine(e, d, at, warn, attack, extra) {
      return Object.assign({ at, warn, shape: 'line', width: 1.25, length: clipLine(e, e.face, Math.min(13, d + 1.5)), dmg: 16, pull: true, pullTo: 2.4, style: 'chain', fill: 'forward',
        pose: 'throw', projectile: { kind: 'hook', flight: .22, fromY: 1.7 }, attack }, extra || {});
    }
    // After a clean hook pull the executioner answers with a neck blow along the chain.
    function neckStrike(e, face) {
      if (e.dead || !e.action || e.stagger > 0) return;
      hazardFrom(e, { x: e.x, z: e.z, face, shape: 'line', width: 1.6, length: 3.8, delay: 0, warn: .85, damage: 20, style: 'blade', fill: 'forward', pose: 'overhead', attack: 'Boyun Vuruşu', near: true });
      e.action.duration = Math.max(e.action.duration, e.action.age + 1.45);
    }
    function hooksMove(e) {
      const p0 = { x: player.x, z: player.z }, th0 = rand(e) * TAU, pts = [p0];
      for (let k = 0; k < 4; k++) for (let tries = 0; tries < 6; tries++) {
        const a = th0 + k * 1.26 + tries * .37, r = 2.6 + rand(e) * 1.2, c = { x: p0.x + Math.sin(a) * r, z: p0.z + Math.cos(a) * r };
        if (walkable(c.x, c.z, .4)) { pts.push(c); break; }
      }
      return { id: 'hooks', name: 'Yargı Kancaları', duration: 2.9, pose: 'roar', onBegin() { e.hooksCd = e.enraged ? 13 : 18; },
        hits: pts.map((o, i) => ({ at: 1.3 + i * .25, warn: 1.3, shape: 'circle', radius: 1.5, origin: o, dmg: 17, unblockable: true, style: 'fall', fill: 'inward', pose: 'roar', beat: i === 0, scar: true })) };
    }
    function bossAttack(e, d) {
      if (d > 14.5) return false;
      if (e.phase !== 2) return pick(e, [
        { id: 'hook', sp: 1, ok: d > 6, w: 3, move: () => ({ id: 'hook', name: 'Kanca Atışı', duration: 2.1, pose: 'hookSwing', hits: [
          hookLine(e, d, 1.25, 1.0, 'Kanca Atışı', { onHitPlayer(h) { neckStrike(e, h.face); } })] }) },
        { id: 'sweep', ok: d < 6, w: 3, move: () => ({ id: 'sweep', name: 'Celladın Biçişi', duration: 1.62, pose: 'sweep', hits: [
          { at: .82, warn: .82, shape: 'cone', radius: 5.4, arc: 3.6, dmg: 26, knockback: 3, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep' }] }) },
        { id: 'slam', sp: 1, ok: d > 2.5 && d < 8, w: 2, move: () => slamMove(e, d, false) },
        { id: 'lash', ok: d > 2.6 && d < 7.5, w: 2, move: () => ({ id: 'lash', name: 'Zincir Savuruşu', duration: 1.4, pose: 'chainLash', hits: [
          { at: .8, warn: .8, shape: 'ring', inner: 2.8, radius: 7.2, arc: 2.6, dmg: 17, guardPressure: 1.6, style: 'chain', fill: 'sweep', sweepDir: -1, pose: 'chainLash' }] }) },
        { id: 'charge', ok: d > 7.5, w: 2, move: () => chargeMove(e, d, .95, false) },
        { id: 'kick', ok: d < 2.4, w: 2, move: kickMove }
      ]);
      return pick(e, [
        { id: 'hook', sp: 1, ok: d > 6, w: 3, move: () => ({ id: 'hook', name: 'Kanca ve Biçme', duration: 3.1, pose: 'hookSwing', hits: [
          hookLine(e, d, 1.2, .95, 'Kanca ve Biçme · kanca'),
          { at: 2.3, warn: 1.0, shape: 'cone', radius: 5.2, arc: 3.6, dmg: 26, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep', attack: 'Kanca ve Biçme · savuruş' }] }) },
        { id: 'sweep', ok: d < 6, w: 3, move: () => ({ id: 'sweep', name: 'Çifte Biçiş', duration: 2.15, pose: 'sweep', hits: [
          { at: .82, warn: .82, shape: 'cone', radius: 5.4, arc: 3.6, dmg: 24, style: 'blade', fill: 'sweep', sweepDir: 1, parry: 'deflect', pose: 'sweep', attack: 'Çifte Biçiş · ilk' },
          { at: 1.5, warn: .62, shape: 'cone', radius: 5.8, arc: 3.6, face: e.face + .5, dmg: 26, style: 'blade', fill: 'sweep', sweepDir: -1, parry: 'deflect', pose: 'sweepBack', attack: 'Çifte Biçiş · dönüş' }] }) },
        { id: 'slam', sp: 1, ok: d > 2.5 && d < 8 && e.lastMove !== 'hooks', w: 2, move: () => slamMove(e, d, true) },
        { id: 'cyclone', sp: 1, ok: d < 7, w: 2, move: () => ({ id: 'cyclone', name: 'Zincir Kasırgası', duration: 3.2, pose: 'spin', cooldown: 1.9, hits: [1.2, 1.8, 2.4].map((at, i) => ({
          at, warn: i ? .6 : 1.2, shape: 'ring', inner: 2.4, radius: 6.2, arc: TAU, dmg: 11, guardPressure: 1.2, style: 'chain', fill: 'sweep', sweepDir: 1, pose: 'spin' })) }) },
        { id: 'hooks', sp: 1, ok: e.hooksCd <= 0 && e.lastMove !== 'slam', w: 4, move: () => hooksMove(e) },
        { id: 'charge', ok: d > 6, w: 2, move: () => chargeMove(e, d, .9, true) },   // was d > 7.5: with the specials held back this is his plain blow at mid range
        { id: 'kick', ok: d < 2.4, w: 2, move: kickMove }
      ]);
    }

    function activateEncounters() {
      if (openingGrace > 0 && distance(player, spawn) < 4 && !player.attack) return;
      openingGrace = 0;
      for (const enc of encounterDefs) {
        let alive = 0, nearest = Infinity, isBoss = false;
        for (const e of enc.enemies) { if (e.dead) continue; alive++; const d = distance(e, player); if (d < nearest) nearest = d; if (e.boss) isBoss = true; }
        if (!alive) continue;
        if (!enc.activated && nearest < (isBoss ? 13 : 13.2)) {
          enc.activated = true; game.activeEncounter = enc.name;
          if (!enc.announced) { emit('encounter', { name: enc.name, room: enc.room }); enc.announced = true; }
          for (const e of enc.enemies) if (!e.dead) { e.active = true; e.activated = true; e.cooldown = Math.max(e.cooldown, .6 + e.index % 4 * .22); }
          if (isBoss) { emit('boss', { name: STATS.boss.name, active: true }); sound('boss'); }
        }
        // Locked halls cannot aggro through their predecessor's sealed exit.
        break;
      }
    }
    // Kanlı Yemin: the executioner roars (a gold shockwave that pushes the hero out), then chains his blows.
    function enemyPhaseChange(enemy) {
      if (!enemy.boss || enemy.phase !== 1 || enemy.hp > enemy.maxHp * .52) return;
      enemy.phase = 2; enemy.action = null; enemy.stagger = 0; enemy.faceLocked = false;
      if (globes) globes.bonus(enemy.x, enemy.z, 2);   // the only globes of the executioner fight
      cancelHazards(enemy, false); flashRing(enemy.x, enemy.z, 4.5, 0xd25949, 1.2);
      emit('warning', { x: enemy.x, z: enemy.z, text: 'ZİNCİR CELLADI · KANLI YEMİN' });
      emit('toast', { text: 'Cellat zincirini kopardı. Darbeler artık birbirini izliyor.' }); sound('bossPhase');
      fx('bossPhase', { x: enemy.x, y: 1.4, z: enemy.z });
      enemy.face = angleTo(enemy, player); beginMove(enemy, roarMove('Kanlı Yemin', 1.7, 1.0));
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
        else if (enemy.type === 'prisoner' && enemy.hp < enemy.maxHp * .3) cd *= .7;
        enemy.cooldown = cd;
      }
    }
    function updateEnemy(enemy, dt) {
      enemy.hurt = Math.max(0, enemy.hurt - dt * 3); enemy.blockImpact = Math.max(0, (enemy.blockImpact || 0) - dt * 5);
      if (enemy.dead) { enemy.deadAge += dt; enemy.move = 0; return; }
      applyPush(enemy, dt, enemy.radius);
      enemy.buff = Math.max(0, enemy.buff - dt); enemy.buffCooldown -= dt;
      enemy.shieldBroken = Math.max(0, enemy.shieldBroken - dt); enemy.poiseRecovery = Math.max(0, enemy.poiseRecovery - dt); enemy.cooldown -= dt;
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
      if (enemy.boss && enemy.phase === 2 && !enemy.enraged && enemy.hp <= enemy.maxHp * .25) {
        // Son Yemin: once, the executioner swears again: faster between blows and more judgement hooks (damage unchanged).
        enemy.enraged = true; enemy.hooksCd = Math.min(enemy.hooksCd, 2);
        if (globes) globes.bonus(enemy.x, enemy.z, 1);
        emit('toast', { text: 'Cellat son yeminini etti. Kancalar daha sık düşecek.' }); sound('bossPhase');
        beginMove(enemy, roarMove('Son Yemin', 1.4, .8)); advanceEnemyAction(enemy, dt); return;
      }
      // Wrath: the executioner does not stand still under a flurry. Enough blows between his moves and he answers at once
      // with the kick (a normal .55 s tell), which throws the hero back out to his swing room.
      if (enemy.boss) { enemy.wrath = Math.max(0, enemy.wrath - dt * 12); if (enemy.wrath >= 70 && d < 3.2) { enemy.wrath = 0; if (beginMove(enemy, kickMove())) { advanceEnemyAction(enemy, dt); return; } } }
      if (enemy.cooldown <= 0 && enemy.fear <= 0 && openAttackSlots(enemy)) {
        let attacked = false;
        if (enemy.type === 'prisoner') attacked = prisonerAttack(enemy, d);
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
      } else if (enemy.type === 'cultist' || enemy.type === 'carrier') {
        if (d > ((enemy.spWait > 0 || enemy.spHold > 0) && enemy.type === 'carrier' ? 5.2 : 8.8)) walkTo(enemy, player, speed, dt);   // spit range while its bile moves are held back
        else if (d < 4.3) {
          const retreatFace = enemy.face + Math.PI;
          moveBody(enemy, Math.sin(retreatFace) * speed * .75 * dt, Math.cos(retreatFace) * speed * .75 * dt, enemy.radius); enemy.move = .75;
        } else {
          const strafe = enemy.face + Math.PI / 2 * (enemy.index % 2 ? 1 : -1);
          moveBody(enemy, Math.sin(strafe) * .55 * dt, Math.cos(strafe) * .55 * dt, enemy.radius); enemy.move = .3;
        }
      } else if (enemy.type === 'stalker' && d > 3 && d < 6.5 && enemy.cooldown > .3) {
        const strafe = enemy.face + Math.PI / 2 * (enemy.index % 2 ? 1 : -1);
        moveBody(enemy, Math.sin(strafe) * speed * .8 * dt, Math.cos(strafe) * speed * .8 * dt, enemy.radius); enemy.move = .8;
      } else if (enemy.type === 'guard') {
        const post = guardPost(enemy);
        if (post && distance(enemy, post) > .35) { walkTo(enemy, post, speed * .85, dt); enemy.shield = enemy.shieldBroken <= 0; }
        else if (!post && d > 2.65) walkTo(enemy, player, speed, dt);
      } else if (enemy.boss && d < 3.2 && enemy.cooldown > .3) {
        // Between moves he steps back to the length of his axe rather than trading blows at the hero's range.
        const away = angleTo(player, enemy); moveBody(enemy, Math.sin(away) * speed * .75 * dt, Math.cos(away) * speed * .75 * dt, enemy.radius); enemy.move = .75;
      } else if (d > (enemy.boss ? 4 : 2.05)) walkTo(enemy, enemy.boss ? player : approachPoint(enemy), speed, dt);
      separateEnemies(enemy, dt);
    }

    // The upper target card follows attack intent/contact, independently of the cursor's hover ring.
    function trackAttackTarget(enemy) {
      if (game.state === 'playing' && enemy && !enemy.dead && enemy.model.root.visible) game.attackTarget = enemy;
    }
    function killEnemy(enemy) {
      if (enemy.dead) return;
      enemy.dead = true; enemy.hp = 0; enemy.deadAge = 0; enemy.action = null; enemy.shield = false; enemy.active = false; enemy.stagger = 0;
      if (game.attackTarget === enemy) game.attackTarget = null;
      cancelHazards(enemy, false); game.kills++;
      const seal = seals.find(seal => seal.encounter === enemy.encounter);
      if (seal && !seal.open && seal.encounter.enemies.every(e => e.dead)) {
        seal.open = true; sound('sealOpen');
        flashRing(seal.x, seal.z, 2.4, 0xc99f69, .9);
        if (game.activeEncounter === seal.encounter.name) game.activeEncounter = '';
        emit('encounterCleared', { name: seal.encounter.name, roomName: seal.encounter.roomName, nextName: seal.encounter.nextName, room: seal.encounter.room, x: seal.x, z: seal.z, text: seal.encounter.clearText });
        emit('toast', { text: seal.encounter.clearText });
      }
      emit('kill', { name: enemy.name, boss: enemy.boss, x: enemy.x, z: enemy.z }); sound(enemy.boss ? 'bossDeath' : 'kill', { type: enemy.type });
      fx('death', { x: enemy.x, y: .8, z: enemy.z, boss: enemy.boss });
      if (globes && !enemy.boss) globes.roll(enemy, enemy.deathKind === 'blown' ? 'heavy' : 'light', angleTo(player, enemy), () => rand(enemy));   // health globe (seeded by the foe's own RNG)
      if (enemy.type === 'carrier') {
        addHazard({ owner: enemy, enemy: enemy.name, x: enemy.x, z: enemy.z, radius: 3.35, warn: 2.35, duration: .24,
          damage: 32, unblockable: true, attack: 'Çürüyen Bedenin Patlaması', persistent: true, style: 'bile', fill: 'inward', burst: true });
      }
      if (enemy.boss) win();
    }
    // Returns { blocked, killed } so the strike can size hit-stop, sound and camera for the whole swing.
    function hurtEnemy(enemy, damage, heavy, attackFace, attack) {
      if (enemy.dead) return null;
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
        const breaksGuard = heavy && enemy.type === 'guard' && fromFront && enemy.shield;
        if (breaksGuard) {
          enemy.shieldBroken = 4; enemy.shield = false;
          emit('toast', { text: 'Muhafızın savunması kırıldı.' }); sound('guardBreak');
        }
        const canStagger = !enemy.boss && (breaksGuard || enemy.poiseRecovery <= 0 && (heavy || enemy.type === 'cultist' || (!enemy.action && enemy.type !== 'guard') || (attack && attack.rage && enemy.type !== 'guard')));
        if (canStagger) {
          enemy.stagger = enemy.staggerTotal = heavy ? .55 : .22; enemy.staggerKind = breaksGuard ? 'guardBreak' : heavy ? 'heavy' : 'light';
          enemy.action = null; enemy.faceLocked = false;
          enemy.poiseRecovery = heavy ? 3 : 1.1;
          enemy.cooldown = Math.max(enemy.cooldown, heavy ? .9 : .3); cancelHazards(enemy, true);
        }
        push(enemy, away, enemy.boss ? (heavy ? FEEL.knock.bossHeavy : FEEL.knock.boss) : heavy ? FEEL.knock.heavy : finisher ? FEEL.knock.finisher : FEEL.knock.light);
        if (breaksGuard) enemy.guardBroke = true;
      }
      enemy.hp = Math.max(0, enemy.hp - damage); if (enemy.boss && !enemy.action) enemy.wrath += damage;
      if (player.rageTime > 0 && !blocked && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + damage * ROAR.steal);   // blood fury: a little of every blow comes back
      const killed = enemy.hp <= 0;
      if (killed) enemy.deathKind = !enemy.boss && (heavy || finisher) ? 'blown' : '';
      const spray = attack ? sweepAngle(attack) : attackFace;
      emit('hit', { target: 'enemy', x: enemy.x, z: enemy.z, damage, blocked, braced, heavy, face: attackFace, combo: attack ? attack.combo : 0, finisher, kill: killed,
        hitstop: 0, impact: blocked ? .3 : heavy ? 1 : finisher ? .8 : .45 });
      fx(blocked ? 'spark' : 'blood', { x: contact.x, y: contact.y, z: contact.z, damage, labelTarget: enemy, heavy: heavy || finisher, face: attackFace, spray, kill: killed, boss: enemy.boss, shield: blocked, rage: !!(attack && attack.rage), braced });
      if (braced && !killed) fx('spark', { x: contact.x, y: contact.y + .2, z: contact.z, face: attackFace, glance: true });
      if (killed) killEnemy(enemy);
      else enemyPhaseChange(enemy);
      if (killed && limbs && !enemy.boss) {
        // Killing blows can sever a limb or the head (cosmetic only; the foe's own seeded rand keeps runs repeatable).
        const kind = attack && attack.whirl ? (attack.ticks >= SPECIAL.ticks ? 'whirlLast' : 'whirl') : heavy ? 'heavy' : finisher ? 'finisher' : 'light';
        if (limbs.cut(enemy, kind, attackFace, () => rand(enemy), player) && heavy && !(attack && attack.whirl)) hitStop(.008, [{ body: enemy, model: enemy.model, amp: .07 }]);
      }
      return { blocked, killed, guardBreak: !!enemy.guardBroke && (enemy.guardBroke = false, true), contact };
    }
    function die(enemyName, attackName) {
      if (game.state !== 'playing' || player.dead) return;
      player.dead = true; player.hp = 0; player.attack = null; player.dodge = 0; player.healing = 0; order = null; showTargetRing(null); clearMoveMark();
      buffer = {}; player.pendingAction = null; player.lack = null; game.attackTarget = null;
      game.state = 'dead'; game.lastDeath = { enemy: enemyName, attack: attackName };
      sound('death'); emit('death', game.lastDeath);
    }
    function win() {
      if (endAnnounced) return;
      endAnnounced = true; game.state = 'won'; clearHazards(); player.attack = null; order = null; showTargetRing(null); clearMoveMark();
      buffer = {}; player.pendingAction = null; player.lack = null; game.attackTarget = null;
      // The chapter is finished: the next visit to the title starts a new journey instead of the pre-boss stone.
      removeSave(); checkpointSnapshot = freshSnapshot();
      emit('boss', { name: STATS.boss.name, active: false });
      emit('win', { time: game.elapsed, kills: game.kills }); sound('win');
    }
    function hitPlayer(hazard) {
      if (game.state !== 'playing' || player.dead || debugInvincible || playerHitImmunity > 0) return false;
      if (player.invulnerable) {
        // A strike that passes through the roll's protection is shown, never silently swallowed.
        if (!hazard.harmless && !hazard.periodic && evadeCooldown <= 0) { evadeCooldown = .35; fx('evade', { x: player.x, y: 1, z: player.z, face: player.face }); emit('evade', { x: player.x, z: player.z, attack: hazard.attack }); }
        return false;
      }
      const attackSource = hazard.owner && !hazard.owner.dead ? hazard.owner : hazard;
      const incomingAngle = angleTo(player, attackSource);
      let damage = hazard.damage;
      if (hazard.owner) damage = Math.round(damage * (hazard.owner.boss ? EASE.bossDamage : EASE.damage) * BALANCE.damage);
      // The display event and the wound use the same final amount after the cry/fury's defence.
      if (player.roar) damage = Math.ceil(damage * .5); else if (player.rageTime > 0) damage = Math.ceil(damage * ROAR.guard);
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
              boss: !!(h.owner && h.owner.boss), sweepDir: h.sweepDir });
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
      holdInput(input);
    }
    // Attack presses use the short combo buffer. Abilities keep a valid press until the current
    // committed movement/animation ends; a .22 s buffer must not swallow a press during a .70 s swing.
    // This only waits for an action already in progress, never for an empty resource bar or a long cooldown.
    function actionWait(key) {
      if (key === 'dodge') return Math.max(0, player.dodge - .03, player.roar && !player.roar.released ? ROAR.release - player.roar.age : 0);
      if (key === 'rage') return Math.max(0, player.dodge, player.roar ? ROAR.duration - player.roar.age : 0);
      if (key === 'heal') return Math.max(0, player.stagger);
      if (key === 'special') return Math.max(0, player.dodge, player.stagger, player.healing,
        player.attack ? player.attack.duration - player.attack.age : 0, player.roar ? ROAR.duration - player.roar.age : 0);
      return 0;
    }
    const actionNames = { dodge: 'Kaçınma', special: 'Girdap', rage: 'Kan Öfkesi', heal: 'İksir' };
    const secondsText = seconds => (Math.ceil(seconds * 10) / 10).toFixed(1).replace('.', ',');
    function rejectAction(key, reason, text, details) {
      delete buffer[key]; lack(key, reason, text, details); deny(text, key + ':' + reason); return false;
    }
    function canQueueAbility(key) {
      if (key === 'special' && player.specialCd > FEEL.buffer) return rejectAction(key, 'cooldown',
        'Girdap yeniden hazırlanıyor: ' + secondsText(player.specialCd) + ' sn.', { remaining: player.specialCd });
      if (key === 'rage') {
        if (player.rageTime > 0 || player.roar) return rejectAction(key, 'active', 'Kan Öfkesi zaten etkin.', { remaining: player.rageTime });
        if (player.rageCd > FEEL.buffer) return rejectAction(key, 'cooldown',
          'Kan Öfkesi yeniden hazırlanıyor: ' + secondsText(player.rageCd) + ' sn.', { remaining: player.rageCd });
      }
      if (key === 'heal') {
        if (!player.flasks) return rejectAction(key, 'empty', 'Şifa mataraların boş.');
        if (player.hp >= player.maxHp) return rejectAction(key, 'full', 'Yaraların zaten kapalı.');
      }
      const cost = key === 'special' ? SPECIAL.cost : key === 'rage' ? ROAR.cost : key === 'dodge' ? DODGE.cost : 0;
      if (cost && player.stamina < cost) return rejectAction(key, 'stamina',
        actionNames[key] + ' için ' + cost + ' dayanıklılık gerekiyor (şu an ' + Math.floor(player.stamina) + ').', { cost, have: player.stamina });
      return true;
    }
    function holdInput(input) {
      for (const key of ['light', 'heavy', 'near', 'dodge', 'heal', 'rage', 'special']) {
        if (!input[key] || !canQueueAbility(key)) continue;
        buffer[key] = Math.max(FEEL.buffer, actionWait(key) + FEEL.buffer);
      }
      const attack = player.attack;
      if (attack && (input.light || input.heavy) && attack.age >= FEEL.queueAfter) attack.queued = input.heavy ? 'heavy' : 'light';
    }
    function pendingAction() {
      player.pendingAction = null;
      for (const key of ['dodge', 'rage', 'heal', 'special']) {
        if (!buffer[key]) continue;
        const wait = actionWait(key), cooldown = key === 'special' ? player.specialCd || 0 : key === 'rage' ? player.rageCd || 0 : 0;
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
      if (player.stamina < DODGE.cost) return rejectAction('dodge', 'stamina',
        'Kaçınma için ' + DODGE.cost + ' dayanıklılık gerekiyor (şu an ' + Math.floor(player.stamina) + ').', { cost: DODGE.cost, have: player.stamina });
      // Direction: the keys held (the real ones, not an auto-approach), else the pad's right stick, else the cursor / target of a click order, else the facing.
      const raw = rawInput || input, rx = Number.isFinite(raw.x) ? raw.x : 0, rz = Number.isFinite(raw.z) ? raw.z : 0, len = Math.hypot(rx, rz);
      if (len > .1) dodgeVector = { x: rx / len, z: rz / len };
      else if (Number.isFinite(raw.pointX) && Number.isFinite(raw.pointZ) && Math.hypot(raw.pointX - player.x, raw.pointZ - player.z) > .4) { const d = Math.hypot(raw.pointX - player.x, raw.pointZ - player.z); dodgeVector = { x: (raw.pointX - player.x) / d, z: (raw.pointZ - player.z) / d }; }   // Diablo IV: the roll goes toward the mouse cursor
      else if (aimFace !== null) dodgeVector = { x: Math.sin(aimFace), z: Math.cos(aimFace) };
      else if (dodgeAim !== null) dodgeVector = { x: Math.sin(dodgeAim), z: Math.cos(dodgeAim) };
      else dodgeVector = { x: Math.sin(player.face), z: Math.cos(player.face) };
      if (order && !order.held) order = null;   // a roll ends a one-shot order (a held button keeps going once the roll is over)
      clearLack('dodge'); player.stamina -= DODGE.cost; staminaDelay = .62; player.dodge = .48; dodgeAge = 0; player.invulnerable = true;
      // Two presses may share a frame. The roll starts after queuing, so retain accepted skills for this new commitment too.
      for (const key of ['rage', 'special']) if (buffer[key]) buffer[key] = Math.max(buffer[key], player.dodge + FEEL.buffer);
      player.attack = null; player.healing = 0; player.stagger = 0; healingAge = 0; forcedMotion = null; player.push = null;
      player.face = Math.atan2(dodgeVector.x, dodgeVector.z); comboStep = 0; comboWindow = 0;
      delete buffer.dodge; emit('dodge', { x: player.x, z: player.z }); sound('dodge');
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
        'Girdap için ' + SPECIAL.cost + ' dayanıklılık gerekiyor (şu an ' + Math.floor(player.stamina) + ').', { cost: SPECIAL.cost, have: player.stamina });
      player.attack = {
        heavy: true, special: true, whirl: true, combo: 0, age: 0, duration: SPECIAL.duration, strike: 99, hit: false, face: player.face, damage: SPECIAL.damage,
        radius: SPECIAL.radius, arc: Math.PI * 2, moveUntil: 0, serial: ++attackSerial, queued: null, lunge: 0, lungeLead: .1, lunged: 1,
        whooshAt: 9, whooshed: true, chainAt: SPECIAL.duration, ticks: 0
      };
      clearLack('special'); player.stamina -= SPECIAL.cost; staminaDelay = 1.0; player.specialCd = player.specialMax = SPECIAL.cooldown;
      trackAttackTarget(frontTarget(player.face, SPECIAL.radius, Math.PI));
      player.healing = 0; comboStep = 0; comboWindow = 0;
      delete buffer.special; delete buffer.heavy; delete buffer.light;
      sound('specialWind', { x: player.x, z: player.z, wind: SPECIAL.first });
      fx('whirlStart', { x: player.x, y: 1.2, z: player.z, face: player.face, radius: SPECIAL.radius, duration: SPECIAL.duration, turns: SPECIAL.turns });
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
      const R = SPECIAL.radius, last = n === SPECIAL.ticks, shudder = [], keepFace = attack.face;
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
        hits++; fx('whirlHit', { x: r.contact.x, y: r.contact.y, z: r.contact.z, face: away, last, boss: wasBoss });
        if (r.killed) { kills++; continue; }
        e.push = null;
        if (!wasBoss) {
          e.stagger = e.staggerTotal = last ? SPECIAL.staggerLast : SPECIAL.stagger; e.staggerKind = last ? 'heavy' : 'light'; e.action = null; e.faceLocked = false; e.shield = false;
          e.poiseRecovery = 2.2; e.cooldown = Math.max(e.cooldown, 1.2); cancelHazards(e, true);
          if (last) push(e, away, .9); else if (d > 1.7) push(e, angleTo(e, player), Math.min(SPECIAL.pull, d - 1.6));   // loose foes are drawn in, the last tick throws them out
        } else push(e, away, .04);
        shudder.push({ body: e, model: e.model, amp: last ? .09 : .05 });
      }
      shudder.push({ body: player, model: hero, amp: last ? .03 : .015 });
      attack.face = keepFace;
      hitStop(0, shudder);
      sound('specialHit', { x: player.x, z: player.z, hits });
      fx('whirlTick', { x: player.x, y: .1, z: player.z, face: attack.face, n, last, hits, radius: R });
      emit('impact', { x: player.x, z: player.z, strength: last ? 1 : .22 + .12 * n, radius: R });
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
    const ASSIST = { range: 3.6, arc: 50 * Math.PI / 180, near: 4.4 };   // attack key / pad button: reach (to the foe's edge) and half-angle of the front cone (near = the touch button, any direction)
    function beginAttack(heavy, hasAim) {
      const cost = RESOURCES.costs[heavy ? 'heavy' : 'light'];
      if (player.stamina < cost) return rejectAction(heavy ? 'heavy' : 'light', 'stamina',
        (heavy ? 'Ağır' : 'Hafif') + ' darbe için ' + cost + ' dayanıklılık gerekiyor (şu an ' + Math.floor(player.stamina) + ').', { cost, have: player.stamina });
      const combo = heavy ? 0 : comboWindow > 0 ? comboStep % 3 : 0;
      const durations = [.51, .56, .68], timings = [.20, .23, .29], damages = [25, 29, 36];
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
        heavy, combo, age: 0, duration, strike,
        hit: false, face: player.face, damage: heavy ? 60 : damages[combo], radius: heavy ? 3.65 : 3.05 + combo * .12,
        arc: heavy ? 3.65 : 2.7, moveUntil: heavy ? .24 : .13, serial: ++attackSerial, queued: null,
        lunge: stand ? 0 : Math.min(want, room), foe, stand, lungeLead: heavy ? FEEL.heavyLungeLead : FEEL.lungeLead[combo], lunged: 0,
        whooshAt: strike - (heavy ? FEEL.whoosh.heavy : combo === 2 ? FEEL.whoosh.finisher : FEEL.whoosh.light), whooshed: false,
        chainAt: heavy ? duration : duration - (combo === 2 ? FEEL.finisherChainEarly : FEEL.chainEarly)
      };
      if (heavy) Object.assign(player.attack, { duration: HEAVY.duration, strike: HEAVY.strike, chainAt: HEAVY.duration, whooshAt: 0, lungeLead: HEAVY.lungeLead });
      trackAttackTarget(foe);
      clearLack(heavy ? 'heavy' : 'light'); player.stamina -= cost; staminaDelay = heavy ? .75 : .5;
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
      let hits = 0, blocks = 0, kills = 0, breaks = 0;
      const shudder = [], finisher = !attack.heavy && attack.combo === 2, H = FEEL.hitstop;
      for (const enemy of enemies) {
        if (enemy.dead || distance(player, enemy) > attack.radius + enemy.radius * .6) continue;
        const angle = Math.abs(angleDifference(angleTo(player, enemy), attack.face));
        if (angle > attack.arc / 2) continue;
        if (!clearStrike(player, enemy)) continue;
        if (!enemy.active) { enemy.active = true; enemy.activated = true; enemy.encounter.activated = true; }
        const damage = Math.round(attack.damage * (player.rageTime > 0 ? 1.48 : 1)); attack.rage = player.rageTime > 0;
        const r = hurtEnemy(enemy, damage, attack.heavy, attack.face, attack); if (!r) continue;
        hits++; if (r.blocked) blocks++; if (r.killed) kills++; if (r.guardBreak) breaks++;
        if (!r.killed) shudder.push({ body: enemy, model: enemy.model, amp: r.blocked ? .02 : attack.heavy ? .07 : .045 });
        if (game.state === 'won') break;
      }
      if (hits) {
        const clean = hits - blocks;
        let stop = clean ? (attack.heavy ? H.heavy : finisher ? H.finisher : H.light) + (clean - 1) * H.extraTarget : H.shield;
        if (breaks && attack.heavy) stop = Math.max(stop, H.guardBreak);
        if (kills && attack.heavy) stop += game.state === 'won' ? H.bossKill : H.kill;
        shudder.push({ body: player, model: hero, amp: .012 });
        hitStop(stop, shudder);
        if (clean) sound(attack.heavy || finisher ? 'heavyHit' : 'hit', { hits, volume: finisher ? 1 : .9 });
      }
      if (finisher) {
        // The cleave bites into the floor whether or not it found flesh.
        const gx = player.x + Math.sin(attack.face) * 2.05, gz = player.z + Math.cos(attack.face) * 2.05;
        fx('slam', { x: gx, y: .1, z: gz, radius: 1.35, small: true, face: attack.face }); emit('impact', { x: gx, z: gz, strength: hits ? .5 : .32, radius: 1.3 });
      }
      fx('slash', { x: player.x, y: 1.2, z: player.z, face: attack.face, heavy: attack.heavy, hit: hits > 0 });
    }
    // ------------------------------------------------------------------ war cry (Öfke)
    function startWarCry() {
      if (player.rageCd > 0) return false;   // a press in the final .22 s waits for readiness
      if (player.stamina < ROAR.cost) return rejectAction('rage', 'stamina',
        'Kan Öfkesi için ' + ROAR.cost + ' dayanıklılık gerekiyor (şu an ' + Math.floor(player.stamina) + ').', { cost: ROAR.cost, have: player.stamina });
      clearLack('rage'); player.stamina -= ROAR.cost; staminaDelay = 1; player.rageCd = ROAR.cooldown;
      player.attack = null; player.healing = 0; healingAge = 0; comboStep = 0; comboWindow = 0;
      player.roar = { age: 0, released: false, serial: ++attackSerial, gather: ROAR.release };
      delete buffer.rage;
      if (buffer.special) buffer.special = Math.max(buffer.special, ROAR.duration + FEEL.buffer);
      sound('rage', { x: player.x, z: player.z, warCry: true, release: ROAR.release }); emit('rageStart', { x: player.x, z: player.z });
      fx('warCryGather', { x: player.x, y: 1.2, z: player.z, face: player.face, life: ROAR.release });
      return true;
    }
    // The roar goes out: a shockwave through the floor staggers the nearest foes (their unfired tells break),
    // cows the rest for a moment and the executioner flinches. The camera sells the impact without pausing combat.
    function releaseWarCry() {
      player.rageTime = ROAR.time; player.rageMax = ROAR.time; player.rageFlash = 1;
      emit('rage', { x: player.x, z: player.z, face: player.face });
      emit('impact', { x: player.x, z: player.z, strength: .85, radius: ROAR.near });
      fx('warCry', { x: player.x, y: .05, z: player.z, face: player.face, radius: ROAR.near, far: ROAR.far });
      for (const e of enemies) {
        if (e.dead || !e.model.root.visible) continue;
        const d = distance(e, player), away = angleTo(player, e);
        if (d > ROAR.far) continue;
        e.hitAngle = angleDifference(angleTo(e, player), e.face);
        if (e.boss) { if (d < ROAR.near + 1.5) { push(e, away, .22); e.hurt = Math.max(e.hurt, .7); e.hurtHeavy = true; } continue; }
        if (!e.active && e.activated !== false && e.encounter && e.encounter.activated) e.active = true;
        if (d < ROAR.near) {
          e.stagger = e.staggerTotal = 1.35; e.staggerKind = 'fear'; e.action = null; e.faceLocked = false; e.shield = false;
          cancelHazards(e, true); e.fear = 2.2; e.cooldown = Math.max(e.cooldown, 1.1); e.hurt = Math.max(e.hurt, .6);
          push(e, away, .45 + 1.3 * (1 - d / ROAR.near));
        } else { e.fear = Math.max(e.fear, 1.5); e.cooldown = Math.max(e.cooldown, 1.3); push(e, away, .4); }
      }
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
      const click = pendingClick || (input.clickLight || input.clickHeavy ? { heavy: !!input.clickHeavy, target: input.target, x: input.pointX, z: input.pointZ, stand: !!input.stand } : null);
      pendingClick = null;
      if (player.dead || game.state !== 'playing') { order = null; showTargetRing(null); return out; }
      const valid = e => !!e && !e.dead && e.model.root.visible;
      const hover = valid(input.target) ? input.target : null;
      const hasPt = Number.isFinite(input.pointX) && Number.isFinite(input.pointZ);
      const mv = Math.hypot(input.x || 0, input.z || 0), holdL = !!input.holdLight, holdH = !!input.holdHeavy, stand = !!input.stand;
      if (click) {
        const t = valid(click.target) ? click.target : null, cx = Number.isFinite(click.x) ? click.x : player.x + Math.sin(player.face) * 3, cz = Number.isFinite(click.z) ? click.z : player.z + Math.cos(player.face) * 3;
        if (click.stand) order = { kind: 'stand', heavy: click.heavy, x: cx, z: cz, owed: true };
        else if (t) order = { kind: 'attack', enemy: t, heavy: click.heavy, owed: true };
        else if (!click.heavy && Number.isFinite(click.x)) order = { kind: 'move', x: click.x, z: click.z };
        if (t) trackAttackTarget(t);
        if (order) order.stuck = 0;
      }
      const btn = holdL ? 'L' : holdH ? 'H' : '';
      if (order) order.held = order.kind === 'move' ? holdL : order.heavy ? holdH : holdL;
      if (btn && !click) {
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
          const dx = order.x - player.x, dz = order.z - player.z;
          const face = hover ? angleTo(player, hover) : Math.hypot(dx, dz) > .3 ? Math.atan2(dx, dz) : player.face;
          swingPlan = { stand: true, face, heavy: order.heavy, order }; dodgeAim = face;
          if (order.held) out.x = out.z = 0;
        } else if (order.kind === 'attack') {
          const e = order.enemy, a = angleTo(player, e), reach = order.heavy ? ORDER.reachHeavy : ORDER.reach;
          dodgeAim = a; ring = e;
          if (distance(player, e) - e.radius <= reach && clearStrike(player, e)) { swingPlan = { enemy: e, heavy: order.heavy, order }; if (mv <= .08) out.x = out.z = 0; }
          else if (mv <= .08) {
            const nav = order.navigation || (order.navigation = {}); routeDirection(player, e, nav, dt, hero.radius || .5, true);
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
        targetRing = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 56), new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
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
      const r = foe.radius * 1.5 + .2, pulse = reducedMotion.matches ? 1 : .82 + .18 * Math.sin(simTime * 6);
      targetRing.position.set(foe.x, .07, foe.z); targetRing.scale.set(r, r, 1);
      targetRing.material.opacity = (locked ? .85 : .42) * pulse;
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
      player.specialCd = Math.max(0, (player.specialCd || 0) - dt);
      player.rageCd = Math.max(0, (player.rageCd || 0) - dt); player.drink = drinkLeft;
      staminaDelay = Math.max(0, staminaDelay - dt); comboWindow = Math.max(0, comboWindow - dt);
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
      if (buffer.rage && player.rageTime <= 0 && !player.roar && !player.dodge) {
        if (player.rageCd <= 0) startWarCry();
      }
      // Flask: instant. The heal lands on the press and nothing is locked (player.healing, the old .82 s drink, is no longer set), so it
      // works mid-swing, mid-roll or during the roar.
      drinkLeft = Math.max(0, drinkLeft - dt);
      if (buffer.heal && !player.dead && player.stagger <= 0) {
        delete buffer.heal;
        if (drinkLeft > DRINK - DRINK_GUARD) { /* the same press arriving twice: ignore it */ }
        else if (!player.flasks) deny('Şifa mataraların boş.');
        else if (player.hp >= player.maxHp) deny('Yaraların zaten kapalı.');
        else {
          clearLack('heal'); player.flasks--; player.hp = Math.min(player.maxHp, player.hp + 64); drinkLeft = DRINK;
          emit('heal', { hp: player.hp, flasks: player.flasks }); sound('healStart'); sound('heal');
          flashRing(player.x, player.z, 1.3, 0xd7bf88, .6);
        }
      }
      if (player.dodge > 0) {
        dodgeAge += dt; player.dodge = Math.max(0, player.dodge - dt);
        player.invulnerable = dodgeAge <= DODGE.iframe;
        const speed = dodgeAge < .30 ? 12.5 : 6.2;
        moveBody(player, dodgeVector.x * speed * dt, dodgeVector.z * speed * dt, hero.radius || .5);
      } else {
        player.invulnerable = false;
        if (!player.attack && !player.healing && !player.roar && player.stagger <= 0) {
          if (buffer.special && player.specialCd <= 0) beginSpecial(hasAim);
          if (player.attack) { /* special just began */ }
          else if (buffer.special) { /* finishing its short readiness buffer: retain the press */ }
          else if (swingPlan) beginAttack(swingPlan.heavy, hasAim);
          else if (buffer.heavy) beginAttack(true, hasAim);
          else if (buffer.light) beginAttack(false, hasAim);
        }
        if (player.attack) {
          const attack = player.attack; attack.age += dt;
          // A click order that wants another swing queues it like a key press (a chain fires at chainAt); one that lost its foe unqueues it.
          if (swingPlan && !attack.whirl && attack.age >= FEEL.queueAfter) { attack.queued = swingPlan.heavy ? 'heavy' : 'light'; attack.queuedBy = 'order'; }
          else if (attack.queuedBy === 'order' && !swingPlan) { attack.queued = null; attack.queuedBy = null; }
          if (!attack.whooshed && attack.age >= attack.whooshAt) { attack.whooshed = true; sound(attack.heavy ? 'heavy' : 'attack', { volume: attack.combo === 2 ? 1 : .85 }); }
          // Step into the blow: the body commits forward over the last moments before contact.
          if (attack.lunge > 0 && attack.lunged < 1) {
            const k = clamp((attack.age - (attack.strike - attack.lungeLead)) / (attack.lungeLead + .03), 0, 1), e = k * k * (3 - 2 * k);
            if (e > attack.lunged) { const d = (e - attack.lunged) * attack.lunge; moveBody(player, Math.sin(attack.face) * d, Math.cos(attack.face) * d, hero.radius || .5); attack.lunged = e; }
          }
          if (!attack.hit && attack.age >= attack.strike) playerStrike(attack);
          if (attack.whirl && player.attack === attack) whirlStep(attack, input, moveLength);
          if (player.attack === attack && attack.queued && !buffer.special && attack.age >= attack.chainAt) {
            const next = attack.queued === 'heavy'; player.attack = null; comboWindow = Math.max(comboWindow, .46); beginAttack(next, hasAim);
          } else if (player.attack === attack && attack.age >= attack.duration) {
            player.attack = null; comboWindow = .46;
            if (buffer.special && player.specialCd <= 0) beginSpecial(hasAim);
            else if (buffer.special) { /* let the already requested ability become ready */ }
            else if (swingPlan) beginAttack(swingPlan.heavy, hasAim);
            else if (buffer.heavy) beginAttack(true, hasAim);
            else if (buffer.light) beginAttack(false, hasAim);
          }
        }
        // Swings are committed until just after contact; the feet free up again for the recovery.
        let attackMove = 1;
        if (player.attack) { const a = player.attack, committed = a.age < a.strike + (a.heavy ? .03 : .06); attackMove = a.heavy ? (committed ? .12 : .5) : (committed ? .16 : .52); }
        if (player.attack && player.attack.whirl) attackMove = SPECIAL.move;
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
      if (staminaDelay <= 0 && !player.attack && !player.dodge && !player.healing) {
        player.stamina = Math.min(player.maxStamina, player.stamina + REGEN * (player.rageTime > 0 ? 1.65 : 1) * dt);
      }
      player.status = player.healing ? 'Şifa içiliyor' : player.roar ? 'Savaş narası' : player.rageTime > 0 ? 'Kan öfkesi' : '';
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
      hero.root.position.set(player.x, 0, player.z); hero.root.rotation.y = player.yaw + spinCur;
      // Read-only state for the effects / post-processing: { active, t (s), u (0..1), tick, ticks, radius, spin (rad), serial }.
      const sp = player.special || (player.special = { active: false, t: 0, u: 0, tick: 0, ticks: SPECIAL.ticks, radius: SPECIAL.radius, spin: 0, serial: 0 });
      sp.active = !!wh; sp.t = wh ? wh.age : 0; sp.u = wh ? clamp(wh.age / wh.duration, 0, 1) : 0; sp.tick = wh ? wh.ticks : 0; sp.spin = spinCur; sp.serial = wh ? wh.serial : sp.serial;
      // Same fields as before, written into the reused heroAnim object (pm === heroAnim) instead of a fresh spread every callback.
      const hs = pm;
      hs.time = simTime; hs.attack = wh ? 0 : playerAttackPose(atk); hs.whirl = wh ? clamp(wh.age / wh.duration, 0, 1) : -1; hs.whirlTime = wh ? wh.age : -1;
      hs.attackTime = atk && !wh ? atk.age : -1; hs.attackStrike = atk ? atk.strike : 0; hs.attackDuration = atk ? atk.duration : 0; hs.attackSerial = atk ? atk.serial : 0;
      hs.hitAngle = player.hitAngle || 0; hs.hurtHeavy = !!player.hurtHeavy; hs.iframeEnd = DODGE.iframe / .48;
      hs.stagger = player.stagger > 0 ? 1 - player.stagger / (player.staggerTotal || .7) : 0; hs.staggerTime = player.staggerTotal || .7;
      hs.contactPhase = player.attack && player.attack.heavy ? .56 : .41;
      hs.heavy = !!(player.attack && player.attack.heavy && !wh); hs.block = false;
      hs.combo = player.attack ? player.attack.combo : 0; hs.parry = 0;
      hs.blockImpact = 0; hs.hitDirection = player.hitDirection || 0;
      hs.dodge = player.dodge ? clamp(dodgeAge / .48, .01, 1) : 0;
      hs.dodgeProgress = player.dodge ? clamp(dodgeAge / .48, .01, 1) : 0;
      hs.dodgeDirection = Math.atan2(dodgeVector.x, dodgeVector.z); hs.healing = player.healing ? 1 - player.healing / .82 : 0;
      hs.drinkTime = drinkLeft > 0 ? DRINK - drinkLeft : -1; hs.drinkDuration = DRINK;
      hs.hurt = player.hurt; hs.dead = player.dead; hs.phase = player.healing ? 'heal' : 'idle'; hs.face = player.face; hs.rage = player.rageTime > 0;
      hs.roarTime = player.roar ? player.roar.age : -1; hs.roarRelease = ROAR.release; hs.roarDuration = ROAR.duration; hs.roarSerial = player.roar ? player.roar.serial : 0;
      hero.animate(dt, hs);
      for (const enemy of enemies) {
        const d = distance(enemy, player), visible = d < 45 && (!enemy.dead || enemy.deadAge < corpseLifetime);
        const em = movementState(enemy, enemy.model, dt, STATS[enemy.type].speed, enemy._anim || (enemy._anim = {}));
        enemy.model.root.visible = visible;
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
        enemy.model.root.position.set(enemy.x, 0, enemy.z); enemy.model.root.rotation.y = enemy.face;
        if (visible) {
          const action = enemy.action;
          const leap = action && action.movement && action.movement.leap
            ? clamp((action.age - action.movement.start) / action.movement.duration, 0, 1) : 0;
          enemy.model.root.position.y = Math.sin(leap * Math.PI) * 1.15;
          const beat = enemyBeat(enemy);
          const es = em;   // the enemy's reused animation state; same fields as the old per-callback spread
          es.time = simTime + enemy.index * .31;
          es.beat = beat ? beat.index : 0; es.beatTime = beat ? beat.t : -1; es.beatContact = beat ? beat.contact : 0; es.beatEnd = beat ? beat.end : 0;
          es.attackSerial = action ? action.serial : 0; es.rushTime = action && action.movement ? action.movement.duration : 0;
          es.lookYaw = enemy.active && !enemy.dead && !player.dead ? angleDifference(angleTo(enemy, player), enemy.face) : undefined;
          es.hitAngle = enemy.hitAngle || 0; es.hurtHeavy = !!enemy.hurtHeavy; es.deathKind = enemy.deathKind || ''; es.blockImpact = enemy.blockImpact || 0;
          es.stagger = enemy.stagger > 0 && !enemy.dead ? 1 - enemy.stagger / Math.max(enemy.stagger, enemy.staggerTotal || 0) : 0; es.staggerTime = enemy.staggerTotal || 0;
          es.attack = enemyAttackPose(enemy); es.contactPhase = enemy.boss || enemy.type === 'guard' ? .56 : .41; es.pose = beat ? beat.pose : '';
          es.action = action ? action.attack : ''; es.actionProgress = action ? action.age / action.duration : 0; es.leap = leap;
          es.heavy = !!(action && (enemy.boss || enemy.type === 'guard'));
          es.block = enemy.shield && !enemy.dead; es.dodge = 0; es.hurt = enemy.hurt; es.hitDirection = enemy.hitDirection || 0; es.dead = enemy.dead;
          es.phase = enemy.phase === 2 ? 'rage' : action ? 'attack' : 'idle'; es.face = enemy.face; es.rage = enemy.buff > 0 || enemy.phase === 2;
          enemy.model.animate(dt, es);
        }
        enemy.shadow.visible = visible && (!enemy.dead || enemy.deadAge < 2.5);
        enemy.shadow.position.x = enemy.x; enemy.shadow.position.z = enemy.z;
        enemy.shadow.material.opacity = enemy.dead ? .42 * clamp(1 - enemy.deadAge / 2.5, 0, 1) : .42 * (1 - clamp(enemy.model.root.position.y / 1.6, 0, .6));
        enemy.bar.root.visible = visible && !enemy.dead && enemy.active && enemy.hp < enemy.maxHp;
        enemy.bar.root.position.set(enemy.x, (enemy.model.height || 2.2) + .34, enemy.z);
        const fraction = Math.max(.001, enemy.hp / enemy.maxHp);
        enemy.bar.fill.scale.x = fraction; enemy.bar.fill.position.x = -(enemy.boss ? 2.16 : 1.16) * (1 - fraction) / 2;
      }
      heroShadow.position.set(player.x, .028, player.z); heroShadow.visible = !player.dead;
      for (const seal of seals) {
        if (seal.open) {
          seal.fade = Math.min(1, seal.fade + dt * 1.8);
          seal.group.scale.y = Math.max(.001, 1 - seal.fade); seal.group.visible = seal.fade < 1;
        } else { seal.group.scale.y = 1; seal.group.visible = Math.abs(seal.z - player.z) < 45; }
      }
    }
    function step(dt, input) {
      decisionStep = dt;
      simTime += dt; game.elapsed += dt; pairCd = Math.max(0, pairCd - dt);
      openingGrace = Math.max(0, openingGrace - dt);
      game.currentRoom = world.roomAt ? world.roomAt(player.x, player.z) : null;
      updatePlayer(dt, input);
      if (game.state !== 'playing') { animateAll(dt); return; }
      activateEncounters();
      // Previously engaged enemies reactivate when approached again.
      enemies.forEach(enemy => { if (!enemy.dead && enemy.activated && !enemy.active && distance(enemy, player) < 20) enemy.active = true; });
      enemies.forEach(enemy => updateEnemy(enemy, dt));
      separateFromHero();
      updateHazards(dt);
      if (game.state === 'playing') activateCheckpoint();
      animateAll(dt);
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
      if (freeze > 0) {
        // Hit-stop: every combat clock holds together; presses made now are buffered for the next frame.
        const held = Math.min(freeze, dt); freeze -= held; dt -= held;
        if (game.state === 'playing') { holdInput(input); if (input.clickLight || input.clickHeavy) pendingClick = { heavy: !!input.clickHeavy, target: input.target, x: input.pointX, z: input.pointZ, stand: !!input.stand }; }
        input = Object.assign({}, input, { light: false, heavy: false, near: false, clickLight: false, clickHeavy: false, dodge: false, heal: false, rage: false, special: false });
        pendingAction();
        shudder(freeze > 0); game.hitStop = freeze;
        if (dt <= .00001) return;
      }
      // War-cry slow motion: all combat clocks run slower together, easing back to full speed over the last .15 s.
      if (slowmo > 0) { const k = slowmo > .15 ? .3 : .3 + .7 * (1 - slowmo / .15); slowmo = Math.max(0, slowmo - dt); dt *= k; game.timeScale = k; }
      else game.timeScale = 1;
      if (limbs) limbs.update(dt);
      if (globes) globes.update(dt);
      if (game.state !== 'playing') { animateAll(Math.min(dt, .033)); return; }
      // Fixed upper bound prevents fast dodge movement from tunneling on occasional slow frames.
      let remaining = dt, first = true;
      while (remaining > .00001 && game.state === 'playing') {
        const substep = Math.min(remaining, 1 / 60);
        const frameInput = first ? input : Object.assign({}, input, { light: false, heavy: false, near: false, clickLight: false, clickHeavy: false, dodge: false, heal: false, rage: false, special: false, interact: false });
        step(substep, frameInput); first = false; remaining -= substep;
        if (freeze > 0) { freeze = Math.max(0, freeze - remaining); break; }
      }
      game.hitStop = freeze;
    }
    function dispose() {
      if (disposed) return; disposed = true;
      renderTraversal = false;
      for (const { node, guard, descriptor } of matrixGuards) {
        if (node.updateMatrixWorld !== guard) continue;
        if (descriptor) Object.defineProperty(node, 'updateMatrixWorld', descriptor);
        else delete node.updateMatrixWorld;
      }
      matrixGuards.length = 0;
      game.attackTarget = null;
      clearHazards();
      if (limbs) limbs.dispose();
      if (globes) globes.dispose();
      hero.dispose(); enemies.forEach(enemy => { enemy.model.dispose(); disposeObject(enemy.bar.root); disposeObject(enemy.shadow); });
      disposeObject(heroShadow); disposeObject(targetRing); disposeObject(moveMark); if (blobTexture) blobTexture.dispose();
      seals.forEach(seal => disposeObject(seal.group));
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
    // Deliberate, finite hooks for reproducible browser QA; never surfaced in the ordinary interface.
    game.debug = Object.freeze({
      snapshot() {
        return {
          state: game.state, checkpointIndex: game.checkpointIndex, elapsed: game.elapsed, kills: game.kills, totalKills: game.totalKills,
          player: { x: player.x, z: player.z, hp: player.hp, stamina: player.stamina, flasks: player.flasks,
            rageTime: player.rageTime, rageCd: player.rageCd, specialCd: player.specialCd, invulnerable: player.invulnerable },
          living: enemies.filter(e => !e.dead).map(e => ({ id: e.id, type: e.type, hp: e.hp, active: e.active, x: e.x, z: e.z, phase: e.phase, action: e.action && e.action.attack })),
          hazards: hazards.map(h => ({ enemy: h.enemy, attack: h.attack, shape: h.shape, x: h.x, z: h.z, warn: h.warn, age: h.age, active: h.active, unblockable: h.unblockable })),
          seals: seals.map(seal => ({ room: seal.encounter.room, open: seal.open, remaining: seal.encounter.enemies.filter(e => !e.dead).length })),
          openingGrace,
          lastDeath: game.lastDeath, attackTarget: game.attackTarget ? game.attackTarget.id : null, sceneChildren: root.children.length, hasSave: game.hasSave
        };
      },
      teleport(x, z) { if (Number.isFinite(x) && Number.isFinite(z) && (!world.isWalkable || world.isWalkable(x, z, .5))) { player.x = x; player.z = z; animateAll(0); return true; } return false; },
      invincible(value) { debugInvincible = !!value; return debugInvincible; },
      setPlayer(values) {
        if (!values || typeof values !== 'object') return;
        ['hp', 'stamina', 'flasks'].forEach(key => { if (Number.isFinite(values[key])) player[key] = clamp(values[key], key === 'hp' ? 1 : 0, player['max' + key[0].toUpperCase() + key.slice(1)] || 125); });
      },
      activateBoss() {
        if (!game.boss || game.boss.dead) return false;
        game.boss.active = true; game.boss.activated = true; game.boss.encounter.activated = true;
        emit('boss', { name: game.boss.name, active: true }); return true;
      },
      damageEnemy(id, damage) { const enemy = enemies.find(e => e.id === id); if (enemy && Number.isFinite(damage) && damage > 0) { enemy.hp -= Math.min(damage, 10000); if (enemy.hp <= 0) killEnemy(enemy); else enemyPhaseChange(enemy); } },
      strike(options) {
        if (!options || !Number.isFinite(options.damage)) return;
        hitPlayer(Object.assign({ owner: null, enemy: 'QA Düşmanı', attack: 'QA Darbesi', x: player.x, z: player.z + 2, unblockable: false, damage: 10 }, options));
      },
      // QA only: the next decision of this enemy is this move (skips the range test; timing rules still apply).
      forceMove(id, moveId) {
        const e = enemies.find(o => o.id === id); if (!e) return false;
        if (moveId === 'riposte' && e.type === 'guard' && !e.action) { e.face = angleTo(e, player); return guardRiposte(e); }
        e.forceMove = moveId; e.cooldown = Math.min(e.cooldown, 0); return true;
      },
      storageKey: SAVE_KEY
    });
    return game;
  }
  BABA.Game = Object.defineProperty({ create }, 'resources', { value: RESOURCES, enumerable: true });
}());
