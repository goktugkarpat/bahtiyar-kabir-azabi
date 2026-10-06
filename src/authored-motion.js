/* KARA GEÇİT — Quaternius animation retargeted onto the native artist rigs, with an authored combat layer.
 * Every attack is a timed "move": a quick snap into the chamber, a held coil (enemies tremble so the tell reads),
 * an accelerating swing whose blade crosses the forward plane exactly on the damage frame, an overshooting
 * follow-through and a recovery. Moves are cut from the CC0 clips (optionally mirrored) and shaped with rigid
 * spine layers. Also: stagger, directional flinch, blown-back deaths and a roll whose i-frames read.
 * Source clips are CC0; compact motion data and licence ship with the game (assets/characters/). */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, D = B.AuthoredClips;
  var PI = Math.PI, TAU = PI * 2, SPINE_WEIGHTS = [.28, .36, .36];
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function finite(x, fallback) { return Number.isFinite(x) ? x : fallback; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function easeOut(x, p) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, p || 3); }
  function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
  function wrap(x) { return x - Math.floor(x); }
  function signedAngle(x) { return Math.atan2(Math.sin(x), Math.cos(x)); }
  var decoded = Object.create(null), sourceRest = [], sourcePos = [], crouchReference = null, gripReference = null;
  if (!D) throw new Error('Authored animation data must load before authored-motion.js');
  D.rest.forEach(function (r) { sourceRest.push(new T.Quaternion().fromArray(r.q)); sourcePos.push(new T.Vector3().fromArray(r.p)); });
  function clip(name) {
    if (!D.clips[name]) name = 'idle';
    if (!decoded[name]) {
      var def = D.clips[name], binary = atob(def.data), bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      decoded[name] = { values: new Int16Array(bytes.buffer), frames: def.frames, duration: def.duration, loop: def.loop };
    }
    return decoded[name];
  }
  // Unit quaternions of every frame, normalised once (same arithmetic as Quaternion.normalize) instead of twice per bone per sample.
  function normalised(c) {
    var nb = D.bones.length, out = new Float64Array(c.frames * nb * 4), s = D.rotationScale, v = c.values;
    for (var f = 0; f < c.frames; f++) for (var j = 0; j < nb; j++) {
      var ia = f * D.stride + 3 + j * 4, o = (f * nb + j) * 4, x = v[ia] / s, y = v[ia + 1] / s, z = v[ia + 2] / s, w = v[ia + 3] / s, l = Math.sqrt(x * x + y * y + z * z + w * w);
      if (l === 0) { x = 0; y = 0; z = 0; w = 1; } else { l = 1 / l; x = x * l; y = y * l; z = z * l; w = w * l; }
      out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = w;
    }
    return out;
  }
  function pose() { return { q: D.bones.map(function () { return new T.Quaternion(); }), p: new T.Vector3(), sole: [0, 0] }; }
  function copyPose(to, from) {
    for (var i = 0; i < to.q.length; i++) to.q[i].copy(from.q[i]);
    to.p.copy(from.p); to.sole[0] = from.sole[0]; to.sole[1] = from.sole[1];
  }
  function blendPose(to, from, weight, first, last) {
    first = first === undefined ? 0 : first; last = last === undefined ? to.q.length : last;
    for (var i = first; i < last; i++) to.q[i].slerp(from.q[i], weight);
    if (first === 0) { to.p.lerp(from.p, weight); to.sole[0] += (from.sole[0] - to.sole[0]) * weight; to.sole[1] += (from.sole[1] - to.sole[1]) * weight; }
  }
  // Source skeleton hierarchy (indices into D.bones): rigid layer rotations and left/right mirroring.
  var PARENT = [-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 0, 14, 15, 16, 0, 18, 19, 20];
  for (var fi = 0; fi < 5; fi++) for (var fj = 0; fj < 3; fj++) { PARENT[22 + fi * 3 + fj] = fj ? 21 + fi * 3 + fj : 9; PARENT[37 + fi * 3 + fj] = fj ? 36 + fi * 3 + fj : 13; }
  var SUB = PARENT.map(function (_, i) {
    var list = []; PARENT.forEach(function (p, j) { for (var k = j; k >= 0; k = PARENT[k]) if (k === i) { list.push(j); break; } }); return list;
  });
  var MIRROR = PARENT.map(function (_, i) {
    if (i >= 6 && i <= 9) return i + 4; if (i >= 10 && i <= 13) return i - 4; if (i >= 14 && i <= 17) return i + 4; if (i >= 18 && i <= 21) return i - 4;
    if (i >= 22 && i <= 36) return i + 15; if (i >= 37) return i - 15; return i;
  });
  // Moves. Clip times come from the blade/hand trajectory: chamber = slowest point before the fast arc,
  // contact = the tip crossing the forward plane, follow = end of the arc. twist/bend are radians at full coil
  // (negative twist = torso wound to the right, negative bend = leaning back); strikeBend leans into the blow.
  var MOVES = {
    slashA: { clip: 'attackA', recover: 'attackARecover', chamber: .19, contact: .25, follow: .30, end: .62, swing: .085, over: .55, twist: -.42, bend: -.08, strikeBend: .16 },
    slashB: { clip: 'attackB', recover: 'attackBRecover', chamber: .20, contact: .25, follow: .317, end: .72, swing: .085, over: .5, twist: .40, bend: -.06, strikeBend: .2 },
    cleave: { clip: 'swordAttack', chamber: .30, contact: .44, follow: .50, end: .96, swing: .10, over: .3, twist: -.14, bend: -.26, strikeBend: .34, hold: .25 },
    spin: { clip: 'attackC', start: .24, chamber: .58, contact: .686, follow: .80, end: 1.2, swing: .135, over: .5, twist: -.55, bend: -.1, strikeBend: .18, hold: .2 },
    // The hero's heavy blow keeps the .70 s / .35 s damage clock. Its continuous curve carries
    // the wind-up into the swing without a held coil, then flows through contact and recovery.
    heavy: { clip: 'attackC', start: .24, chamber: .58, contact: .686, follow: .80, end: 1.2, swing: .12, over: .5, twist: -.55, bend: -.1, strikeBend: .18, hold: 0, snapK: .88, ease: 1.7, flow: 1.5, continuous: true },
    // Heavy-strike tiers 2 / 3 (hero only): continuous overhead anticipation, committed swing and recovery.
    // Kabir Balyozu also blends crouch, takeoff and landing; it never holds a frozen sword or jump frame in mid-air.
    strikeBrand: { clip: 'swordAttack', chamber: .30, contact: .44, follow: .50, end: .96, swing: .16, over: .12, twist: -.06, bend: -.62, strikeBend: .85, tremble: 0, hold: 0, snapK: .8, flow: 1.2, continuous: true },
    strikePound: { clip: 'swordAttack', chamber: .30, contact: .44, follow: .50, end: .96, swing: .13, over: .1, twist: 0, bend: -.4, strikeBend: 1.0, tremble: 0, hold: 0, snapK: .5, flow: 1.35, continuous: true, pound: true },
    // enemies (unarmed ones swing the same arcs with claws/hands)
    hook: { clip: 'meleeHook', chamber: .215, contact: .25, follow: .34, end: .4667, swing: .12, over: .5, twist: -.45, bend: -.12, strikeBend: .24, tremble: .05 },
    hookL: { clip: 'meleeHook', mirror: true, chamber: .215, contact: .25, follow: .34, end: .4667, swing: .12, over: .5, twist: .45, bend: -.12, strikeBend: .24, tremble: .05 },
    rake: { clip: 'meleeHook', chamber: .215, contact: .25, follow: .36, end: .4667, swing: .1, over: .6, twist: -.6, bend: .12, strikeBend: .3, tremble: .06 },
    maul: { clip: 'zombieScratch', chamber: .5, contact: .62, follow: .70, end: 1.1, swing: .15, over: .2, twist: 0, bend: -.34, strikeBend: .5, tremble: .07, hold: .35 },
    retch: { clip: 'zombieScratch', chamber: .5, contact: .62, follow: .72, end: 1.1, swing: .16, over: .2, twist: .1, bend: -.48, strikeBend: .62, tremble: .09, hold: .3 },
    ritual: { clip: 'zombieScratch', chamber: .5, contact: .62, follow: .72, end: 1.2, swing: .16, over: .1, twist: 0, bend: -.42, strikeBend: .22, tremble: .06, hold: .2 },
    invoke: { clip: 'swordAttack', chamber: .30, contact: .44, follow: .50, end: .9, swing: .14, over: .2, twist: -.1, bend: -.34, strikeBend: .36, tremble: .05, hold: .3 },
    bash: { clip: 'shieldIdle', still: true, chamber: 0, contact: 0, follow: 0, end: 0, swing: .12, over: .45, twist: -.62, bend: -.12, strikeBend: .34, tremble: .04 },
    chop: { clip: 'swordAttack', chamber: .30, contact: .44, follow: .50, end: .96, swing: .13, over: .25, twist: -.16, bend: -.3, strikeBend: .38, tremble: .06, hold: .38 },
    sweep: { clip: 'attackC', start: .24, chamber: .58, contact: .686, follow: .80, end: 1.25, swing: .2, over: .45, twist: -.6, bend: -.12, strikeBend: .2, tremble: .05, hold: .3 },
    backhand: { clip: 'attackB', chamber: .20, contact: .25, follow: .317, end: .6, swing: .17, over: .45, twist: .55, bend: -.08, strikeBend: .22, tremble: .05, hold: .2 },
    slam: { clip: 'swordAttack', chamber: .30, contact: .44, follow: .50, end: .96, swing: .17, over: .2, twist: -.1, bend: -.4, strikeBend: .52, tremble: .07, hold: .55 },
    chain: { clip: 'meleeHook', mirror: true, chamber: .215, contact: .25, follow: .34, end: .4667, swing: .15, over: .5, twist: .5, bend: -.14, strikeBend: .24, tremble: .05, hold: .2 },
    charge: { clip: 'crouch', still: true, stillAt: 0, chamber: 0, contact: 0, follow: 0, end: 0, swing: .08, over: 0, twist: 0, bend: -.2, strikeBend: .5, tremble: .06, rush: 'sprint' },
    pounce: { clip: 'crouch', still: true, stillAt: 0, chamber: 0, contact: 0, follow: 0, end: 0, swing: .3, over: 0, twist: 0, bend: .34, strikeBend: 0, tremble: .07, leap: true },
    // Signature moves (combat.js passes the beat's pose): whips, shoves, thrusts, casts, throws, the kick and the roar.
    whip: { clip: 'meleeHook', chamber: .2, contact: .25, follow: .36, end: .4667, swing: .1, over: .75, twist: -.75, bend: -.1, strikeBend: .3, tremble: .05, hold: .15 },
    shove: { clip: 'shieldIdle', still: true, chamber: 0, contact: 0, follow: 0, end: 0, swing: .14, over: .3, twist: -.3, bend: -.2, strikeBend: .55, tremble: .05 },
    stab: { clip: 'combatIdle', still: true, stillAt: 0, spear: true, chamber: 0, contact: 0, follow: 0, end: 0, swing: .10, over: .25, twist: -.22, bend: -.12, strikeBend: .32, tremble: .04, hold: .1 },
    spearJab: { clip: 'combatIdle', still: true, stillAt: 0, spear: true, chamber: 0, contact: 0, follow: 0, end: 0, swing: .085, over: .2, twist: -.12, bend: -.08, strikeBend: .23 },
    spearCross: { clip: 'combatIdle', still: true, stillAt: 0, spear: true, chamber: 0, contact: 0, follow: 0, end: 0, swing: .095, over: .22, twist: .22, bend: -.07, strikeBend: .28 },
    spearDrive: { clip: 'combatIdle', still: true, stillAt: 0, spear: true, chamber: 0, contact: 0, follow: 0, end: 0, swing: .105, over: .27, twist: -.2, bend: -.13, strikeBend: .4 },
    invokeHigh: { clip: 'swordAttack', chamber: .30, contact: .44, follow: .50, end: .9, swing: .16, over: .15, twist: 0, bend: -.5, strikeBend: .2, tremble: .06, hold: .3 },
    toss: { clip: 'meleeHook', chamber: .2, contact: .25, follow: .34, end: .4667, swing: .09, over: .6, twist: -.55, bend: -.18, strikeBend: .3, tremble: .04 },
    exhale: { clip: 'zombieScratch', chamber: .5, contact: .62, follow: .72, end: 1.1, swing: .2, over: .2, twist: 0, bend: -.62, strikeBend: .7, tremble: .1, hold: .3 },
    kick: { clip: 'combatIdle', still: true, stillAt: 0, chamber: 0, contact: 0, follow: 0, end: 0, swing: .12, over: .3, twist: .15, bend: -.12, strikeBend: .1, tremble: .04, kick: true },
    roar: { roar: true, clip: 'combatIdle', chamber: 0, contact: 0, follow: 0, end: 0, swing: .1, over: 0, twist: 0, bend: 0, strikeBend: 0 }
  };
  // Pose names from combat.js -> [armed move, unarmed move]. Unknown or empty poses fall back to the old name rules.
  var POSES = {
    clawR: ['slashA', 'hook'], clawL: ['slashB', 'hookL'], chainWhip: ['chain', 'whip'], chainLash: ['chain', 'whip'], hookSwing: ['chain', 'chain'], throw: ['chain', 'toss'],
    lunge: ['charge', 'charge'], thrust: ['stab', 'stab'], slashR: ['slashA', 'hook'], sweep: ['sweep', 'hook'], sweepBack: ['backhand', 'hookL'], staffSwing: ['backhand', 'rake'],
    overhead: ['slam', 'maul'], overheadHold: ['chop', 'maul'], bash: ['bash', 'bash'], shove: ['shove', 'shove'], kick: ['kick', 'kick'], charge: ['charge', 'charge'],
    cast: ['invoke', 'invoke'], castHigh: ['invokeHigh', 'invokeHigh'], kneel: ['ritual', 'ritual'], grab: ['maul', 'maul'], spit: ['retch', 'retch'], roar: ['roar', 'roar'],
    spin: ['spin', 'hook'], crouch: ['pounce', 'pounce'], leap: ['pounce', 'pounce'], strafe: ['rake', 'rake']
  };
  function heroMove(combo, heavy, weaponType) { if (!heavy && weaponType === 'spear') return combo === 2 ? MOVES.spearDrive : combo === 1 ? MOVES.spearCross : MOVES.spearJab; return heavy ? MOVES.heavy : combo === 2 ? MOVES.cleave : combo === 1 ? MOVES.slashB : MOVES.slashA; }
  function enemyMove(type, action, beat, pose) {
    if (pose && POSES[pose]) {
      if (type === 'carrier' && pose === 'roar') return MOVES.exhale;
      return MOVES[POSES[pose][type === 'guard' || type === 'boss' ? 0 : 1]] || MOVES.hook;
    }
    var a = String(action || '').toLowerCase();
    if (type === 'prisoner') return /kavray/.test(a) ? MOVES.maul : /hücum/.test(a) ? MOVES.charge : beat % 2 ? MOVES.hookL : MOVES.hook;
    if (type === 'guard') return /kalkan|bash/.test(a) ? MOVES.bash : MOVES.chop;
    if (type === 'cultist') return /ayin/.test(a) ? MOVES.ritual : MOVES.invoke;
    if (type === 'stalker') return /sıçray|sicray|leap/.test(a) ? MOVES.pounce : MOVES.rake;
    if (type === 'carrier') return MOVES.retch;
    if (type === 'boss') {
      if (/mezar/.test(a)) return MOVES.slam;
      if (/zincir/.test(a) && beat === 0) return MOVES.chain;
      if (/biçiş/.test(a) && beat === 1) return MOVES.backhand;
      return MOVES.sweep;
    }
    return MOVES.hook;
  }
  var lookup = {
    hips: ['pelvis', 'hips', 'DEF-hips'], spine: ['spine.01', 'spine_01', 'DEF-spine.001'],
    chest: ['spine.02', 'spine_02', 'DEF-spine.002'], upperChest: ['spine.03', 'spine_03', 'DEF-spine.003'],
    neck: ['neck', 'neck_01', 'DEF-neck'], head: ['head', 'Head', 'DEF-head'],
    leftShoulder: ['shoulder.L', 'clavicle_l', 'DEF-shoulder.L'], rightShoulder: ['shoulder.R', 'clavicle_r', 'DEF-shoulder.R'],
    leftArm: ['upper_arm.L', 'upperarm_l', 'DEF-upper_arm.L'], rightArm: ['upper_arm.R', 'upperarm_r', 'DEF-upper_arm.R'],
    leftForeArm: ['forearm.L', 'lowerarm_l', 'DEF-forearm.L'], rightForeArm: ['forearm.R', 'lowerarm_r', 'DEF-forearm.R'],
    leftHand: ['hand.L', 'hand_l', 'DEF-hand.L'], rightHand: ['hand.R', 'hand_r', 'DEF-hand.R'],
    leftUpLeg: ['thigh.L', 'thigh_l', 'DEF-thigh.L'], rightUpLeg: ['thigh.R', 'thigh_r', 'DEF-thigh.R'],
    leftLeg: ['shin.L', 'calf_l', 'DEF-shin.L'], rightLeg: ['shin.R', 'calf_r', 'DEF-shin.R'],
    leftFoot: ['tarsal.L', 'foot_l', 'DEF-foot.L'], rightFoot: ['tarsal.R', 'foot_r', 'DEF-foot.R'],
    leftToes: ['toe.L', 'ball_l', 'DEF-toe.L'], rightToes: ['toe.R', 'ball_r', 'DEF-toe.R']
  };
  ['left', 'right'].forEach(function (side) {
    ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'].forEach(function (finger) {
      for (var j = 1; j <= 3; j++) {
        var short = side === 'left' ? 'L' : 'R', f = finger.toLowerCase(), native = f === 'thumb' ? f : 'finger_' + f;
        lookup[side + finger + j] = [native + '.0' + j + '.' + short, f + '_0' + j + '_' + short.toLowerCase(), 'DEF-' + (f === 'thumb' ? f : 'f_' + f) + '.0' + j + '.' + short];
      }
    });
  });
  // Gait cycle lengths (source metres per loop), tuned in-engine so the support sole stays put at each
  // type's gameplay speed (see _qa slide test); the gait phase advances by ground speed / stride.
  var STRIDE = { walk: 1.9, jog: 3.4, sprint: 4.8 };
  // Everyone runs on the same walk/jog/sprint cycle; monsters hunch into it (forward bend, radians).
  var HUNCH = { prisoner: .34, stalker: .5, carrier: .24, cultist: .06, boss: .08 };
  function create(options) {
    var root = options.root, model = options.modelScene || root, type = options.type || 'hero', style = options.style || type, supplied = options.bones || {};
    var weapon = options.weapon, bladeTip = options.weaponTip, all = Object.create(null), mapping = [], nativeRest = [], targetRef = [], targetPos = [], originalLocal = [];
    var bladeFloorV = new T.Vector3(), bladeFloorTarget = new T.Vector3(), bladeFloorQ = new T.Quaternion();
    var armed = type === 'hero' || type === 'boss' || type === 'guard', boss = type === 'boss', hero = type === 'hero';
    var qRoot = new T.Quaternion(), invRoot = new T.Quaternion(), qParent = new T.Quaternion(), qa = new T.Quaternion(), qb = new T.Quaternion();
    var qDesired = new T.Quaternion(), qTurn = new T.Quaternion(), qBlade = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), PI / 2);
    var up = new T.Vector3(0, 1, 0), va = new T.Vector3(), vb = new T.Vector3(), desired = new T.Vector3(), euler = new T.Euler(0, 0, 0, 'YXZ');
    var inverse = new T.Matrix4(), rootNow = new T.Vector3(), rootBefore = new T.Vector3(), velocity = new T.Vector3(), localVelocity = new T.Vector3();
    var wanted = pose(), extra = pose(), output = pose(), transition = pose(), locomotion = pose(), mirrored = pose(), roarBuf = pose();
    var clock = 0, gait = 0, moveWeight = 0, speed = 0, mode = '', modeAge = 0, previousAttack = 0, comboMemory = -1, legacySerial = 0;
    var deathTime = 0, deathYaw = 0, deathKind = '', hurtTime = 2, previousHurt = 0, previousDodge = 0, previousYaw = 0, turnRate = 0, rollRecover = 9;
    // One profile per rig instance; later chapters retain their own weight and character even
    // when they share the same licensed skeleton. These feed the existing secondary-life layer.
    var lifeRate = boss ? 1.5 : 2.1, lifeLean = .035, lifeSway = .07;
    if (style === 'prisoner') { lifeRate=2.55;lifeLean=.048;lifeSway=.078; }
    else if (style === 'guard') { lifeRate=1.65;lifeLean=.023;lifeSway=.028; }
    else if (style === 'cultist') { lifeRate=1.32;lifeLean=.031;lifeSway=.042; }
    else if (style === 'stalker') { lifeRate=2.8;lifeLean=.054;lifeSway=.081; }
    else if (style === 'carrier') { lifeRate=1.32;lifeLean=.059;lifeSway=.043; }
    else if (style === 'boss') { lifeRate=1.25;lifeLean=.043;lifeSway=.026; }
    else if (style === 'hollowking') { lifeRate=1.05;lifeLean=.052;lifeSway=.025; }
    else if (style === 'furnaceheart') { lifeRate=1.32;lifeLean=.046;lifeSway=.035; }
    else if (style === 'shardseer' || style === 'chainseer') { lifeRate=1.65;lifeLean=.026;lifeSway=.048; }
    else if (style === 'cavefang' || style === 'slagcrawler') { lifeRate=2.7;lifeLean=.050;lifeSway=.082; }
    else if (style === 'gravemason' || style === 'forgesentinel') { lifeRate=1.45;lifeLean=.045;lifeSway=.038; }
    var initialized = false, disposed = false, wasDead = false, settled = false, lastHitAngle = 0, lookCur = 0, lookPitch = 0, lifeSeed = Math.random() * 40, shiftCur = 0, legYawCur = 0, backwardMotion = false, fearCur = 0;
    var footfall = root.userData.footfall = { serial: 0, side: 0, x: 0, z: 0, strength: 0, kind: 'step' };
    var motionInfo = root.userData.authoredMotion = { clip: '', source: 'Quaternius CC0', phase: 0, strike: '' };
    root.updateWorldMatrix(true, true); root.getWorldQuaternion(qRoot); invRoot.copy(qRoot).invert();
    Object.keys(supplied).forEach(function (key) { if (supplied[key] && supplied[key].isObject3D) all[key] = supplied[key]; });
    model.traverse(function (n) { if (n.isBone) all[n.name] = n; });
    function bone(name) {
      var aliases = lookup[name] || [name];
      if (all[name]) return all[name];
      for (var j = 0; j < aliases.length; j++) {
        var candidate = all[aliases[j]] || all[aliases[j].replace(/\./g, '_')] || all[aliases[j].replace(/\./g, '')];
        if (candidate) return candidate;
      }
      return null;
    }
    D.bones.forEach(function (name, i) {
      var node = bone(name); mapping[i] = node;
      if (!node) { nativeRest[i] = new T.Quaternion(); targetRef[i] = new T.Quaternion(); targetPos[i] = new T.Vector3(); return; }
      node.getWorldQuaternion(qa); nativeRest[i] = invRoot.clone().multiply(qa); targetRef[i] = nativeRest[i].clone();
      node.getWorldPosition(va); targetPos[i] = root.worldToLocal(va.clone());
      originalLocal.push({ node: node, p: node.position.clone(), q: node.quaternion.clone() });
    });
    if (!mapping[0] || !mapping[7] || !mapping[11] || !mapping[14] || !mapping[18]) throw new Error('Authored character is missing humanoid bones: ' + [0,7,11,14,18].filter(function(i){return !mapping[i];}).map(function(i){return D.bones[i];}).join(', ') + '; available: ' + Object.keys(all).join(', '));
    // The meshes bind with their arms down. Build a virtual T-pose without
    // altering the skin bind matrices; world-space deltas then preserve rolls.
    [[7, 8], [8, 9], [11, 12], [12, 13], [14, 15], [15, 16], [18, 19], [19, 20]].forEach(function (pair) {
      var a = pair[0], b = pair[1]; if (!mapping[a] || !mapping[b]) return;
      va.copy(targetPos[b]).sub(targetPos[a]).normalize(); vb.copy(sourcePos[b]).sub(sourcePos[a]).normalize();
      qa.setFromUnitVectors(va, vb); targetRef[a].premultiply(qa);
    });
    [9, 13].forEach(function (handIndex) {
      if (!mapping[handIndex]) return;
      va.copy(up).applyQuaternion(nativeRest[handIndex]).normalize(); vb.copy(up).applyQuaternion(sourceRest[handIndex]).normalize();
      qa.setFromUnitVectors(va, vb); targetRef[handIndex].premultiply(qa);
      var fingerStart = handIndex === 9 ? 22 : 37;
      for (var j = fingerStart; j < fingerStart + 15; j++) targetRef[j].premultiply(qa);
    });
    var corrections = targetRef.map(function (q, i) { return sourceRest[i].clone().invert().multiply(q); });
    // Include native intermediary bones/groups as well as the retargeted joints.
    // Updating this parent-first list once makes every parent matrix current;
    // getWorldQuaternion() would otherwise walk and rebuild its ancestors for
    // each of the ~52 joints in every character, every animation frame.
    var poseIndex = new Map(), poseNodes = new Set();
    mapping.forEach(function (node, i) {
      if (!node) return; poseIndex.set(node, i);
      for (var p = node; p && p !== root; p = p.parent) poseNodes.add(p);
    });
    var order = Array.from(poseNodes, function (node) {
      var depth = 0, p = node; while (p && p !== root) { depth++; p = p.parent; }
      return { node: node, i: poseIndex.has(node) ? poseIndex.get(node) : -1, depth: depth };
    }).sort(function (a, b) { return a.depth - b.depth; });
    var parentPosition = new T.Vector3(), parentScale = new T.Vector3();
    // Every pose node gets its quaternion rewritten (copy + normalize) each frame; three mirrors every write into the Euler
    // 'rotation' (a matrix build + decomposition per write, ~0.15 ms per frame over a crowd). The mirror is only needed by
    // code that reads node.rotation, so it is recomputed lazily on the first read after a change. Values read are identical.
    poseNodes.forEach(function (node) {
      var q = node.quaternion, e = node.rotation, stale = false;
      q._onChangeCallback = function () { stale = true; };
      Object.defineProperty(node, 'rotation', { configurable: true, enumerable: true, get: function () { if (stale) { stale = false; e.setFromQuaternion(q, undefined, false); } return e; } });
    });
    // The ordered loop in animate() already refreshed every pose node; only the nodes hanging off them (skinned parts, accessories,
    // anchors) still need their world matrix, so walk past the pose nodes instead of recomputing them a second time.
    function refreshRest(node) {
      var c = node.children, pw = node.matrixWorld;
      for (var i = 0; i < c.length; i++) {
        var ch = c[i];
        if (poseNodes.has(ch)) refreshRest(ch);
        // A skinned part with an untouched identity transform and no children has exactly its parent's world matrix: copy it.
        else if (ch.isSkinnedMesh && ch.children.length === 0 && ch.matrixAutoUpdate && identityLocal(ch)) { ch.matrixWorld.copy(pw); ch.matrixWorldNeedsUpdate = false; }
        else ch.updateWorldMatrix(false, true);
      }
    }
    function identityLocal(n) {
      var p = n.position, s = n.scale, q = n.quaternion;
      return p.x === 0 && p.y === 0 && p.z === 0 && s.x === 1 && s.y === 1 && s.z === 1 && q.x === 0 && q.y === 0 && q.z === 0 && q.w === 1;
    }
    // World position / rotation of a node whose matrixWorld is already current (everything below the pose nodes is refreshed in
    // animate() before it is read): the same numbers as getWorldPosition / getWorldQuaternion, without re-walking the ancestors each call.
    var wScratchP = new T.Vector3(), wScratchS = new T.Vector3();
    function wpos(node, out) { return out.setFromMatrixPosition(node.matrixWorld); }
    function wquat(node, out) { node.matrixWorld.decompose(wScratchP, out, wScratchS); return out; }
    var rootInChain = false; for (var rc = mapping[0].parent; rc; rc = rc.parent) if (rc === root) { rootInChain = true; break; }
    // A vertical shift of the pelvis moves its whole subtree by exactly that amount in world space.
    function shiftWorldY(node, dy) {
      node.matrixWorld.elements[13] += dy;
      var c = node.children; for (var i = 0; i < c.length; i++) shiftWorldY(c[i], dy);
    }
    var legRatio = (targetPos[14].distanceTo(targetPos[15]) + targetPos[15].distanceTo(targetPos[16])) /
      (sourcePos[14].distanceTo(sourcePos[15]) + sourcePos[15].distanceTo(sourcePos[16]));
    var characterScale = clamp(legRatio, .35, 4), pelvis = mapping[0], hipRest = targetPos[0].clone();
    var feet = [14, 18].map(function (index, side) {
      return { upper: mapping[index], lower: mapping[index + 1], ankle: mapping[index + 2], toe: mapping[index + 3], side: side ? 1 : -1,
        anchor: new T.Vector3(), locked: false, weight: 0, orientation: new T.Quaternion(), heel: Math.max(.03, targetPos[index + 2].y), toeHeight: Math.max(.014, targetPos[index + 3].y) };
    });
    var armAliases = { hips: mapping[0], spine: mapping[1], head: mapping[5], leftArm: mapping[7], rightArm: mapping[11], leftElbow: mapping[8], rightElbow: mapping[12],
      leftHand: mapping[9], rightHand: mapping[13], leftLeg: mapping[14], rightLeg: mapping[18], leftKnee: mapping[15], rightKnee: mapping[19], leftFoot: mapping[16], rightFoot: mapping[20], weapon: weapon };
    if (weapon && mapping[13] && mapping[40]) {
      // Put the grip in the palm, between the wrist and middle knuckle.
      mapping[40].getWorldPosition(va); mapping[13].worldToLocal(va); weapon.position.copy(va.multiplyScalar(.60));
    }
    function sample(name, seconds, destination, loop) {
      var c = clip(name), values = c.values, f = (loop ? wrap(seconds / c.duration) : clamp(seconds / c.duration, 0, 1)) * (c.frames - 1);
      var a = Math.floor(f), b = Math.min(c.frames - 1, a + 1), t = f - a, ia = a * D.stride, ib = b * D.stride;
      destination.p.set((values[ia] + (values[ib] - values[ia]) * t) / D.positionScale,
        (values[ia + 1] + (values[ib + 1] - values[ia + 1]) * t) / D.positionScale,
        (values[ia + 2] + (values[ib + 2] - values[ia + 2]) * t) / D.positionScale);
      var nq = c.norm || (c.norm = normalised(c)), nbones = D.bones.length, na = a * nbones * 4, nbb = b * nbones * 4;
      for (var j = 0; j < nbones; j++) {
        var oa = na + j * 4, ob = nbb + j * 4;
        destination.q[j].set(nq[oa], nq[oa + 1], nq[oa + 2], nq[oa + 3]);
        if (t !== 0) destination.q[j].slerp(qa.set(nq[ob], nq[ob + 1], nq[ob + 2], nq[ob + 3]), t);
      }
      var soleOffset = 3 + D.bones.length * 4;
      for (var k = 0; k < 2; k++) destination.sole[k] = (values[ia + soleOffset + k] + (values[ib + soleOffset + k] - values[ia + soleOffset + k]) * t) / D.positionScale;
    }
    // Reflect a pose across the character's sagittal plane (left <-> right).
    function mirror(p) {
      copyPose(mirrored, p);
      for (var i = 0; i < p.q.length; i++) { var s = mirrored.q[MIRROR[i]]; p.q[i].set(s.x, -s.y, -s.z, s.w); }
      p.p.x = -mirrored.p.x; p.sole[0] = mirrored.sole[1]; p.sole[1] = mirrored.sole[0];
    }
    function rotateSubtree(p, index, q) { var s = SUB[index]; for (var k = 0; k < s.length; k++) p.q[s[k]].premultiply(q); }
    // Rigid torso layer distributed over the three spine joints: twist (about up), bend (forward +), side lean (right +).
    function spineLayer(p, twist, bend, side) {
      if (Math.abs(twist) + Math.abs(bend) + Math.abs(side || 0) < 1e-4) return;
      var w = SPINE_WEIGHTS;
      for (var k = 0; k < 3; k++) { euler.set(bend * w[k], twist * w[k], (side || 0) * w[k], 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 1 + k, qa); }
    }
    function yawPose(p, angle) {
      if (Math.abs(angle) < 1e-4) return;
      qTurn.setFromAxisAngle(up, angle);
      for (var i = 0; i < p.q.length; i++) p.q[i].premultiply(qTurn);
      p.p.sub(sourcePos[0]).applyQuaternion(qTurn).add(sourcePos[0]);
    }
    function emit(foot, strength, kind) {
      wpos(foot.ankle, va); footfall.serial++; footfall.side = foot.side;
      footfall.x = va.x; footfall.z = va.z; footfall.strength = clamp(strength, .15, 1); footfall.kind = kind || 'step';
    }
    function moveHipY(amount) {
      if (Math.abs(amount) < .00001) return;
      wpos(pelvis, va); va.y += amount; inverse.copy(pelvis.parent.matrixWorld).invert(); pelvis.position.copy(va.applyMatrix4(inverse));
      shiftWorldY(pelvis, amount);
    }
    var hipPoint = new T.Vector3(), kneePoint = new T.Vector3(), anklePoint = new T.Vector3(), reach = new T.Vector3(), bend = new T.Vector3(), kneeGoal = new T.Vector3();
    // A small contact correction preserves the authored pose while holding the
    // supporting sole in world space as the gameplay capsule moves over it.
    function lockFoot(foot, weight) {
      if (!foot.upper || !foot.lower || !foot.ankle || weight < .001) return;
      wpos(foot.upper, hipPoint); wpos(foot.lower, kneePoint); wpos(foot.ankle, anklePoint); wquat(foot.ankle, foot.orientation);
      desired.copy(anklePoint).lerp(foot.anchor, weight); desired.y = anklePoint.y;
      var a = hipPoint.distanceTo(kneePoint), b = kneePoint.distanceTo(anklePoint);
      reach.copy(desired).sub(hipPoint); var length = clamp(reach.length(), Math.abs(a - b) + .001, a + b - .002 * characterScale); reach.normalize();
      bend.copy(kneePoint).sub(hipPoint).addScaledVector(reach, -bend.dot(reach));
      if (bend.lengthSq() < .00001) bend.set(0, 0, 1).applyQuaternion(qRoot).addScaledVector(reach, -bend.dot(reach));
      bend.normalize(); var along = (a * a + length * length - b * b) / (2 * length);
      kneeGoal.copy(hipPoint).addScaledVector(reach, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
      va.copy(kneePoint).sub(hipPoint).normalize(); vb.copy(kneeGoal).sub(hipPoint).normalize(); qa.setFromUnitVectors(va, vb);
      wquat(foot.upper, qDesired); qDesired.premultiply(qa); wquat(foot.upper.parent, qParent).invert(); foot.upper.quaternion.copy(qParent.multiply(qDesired)); foot.upper.updateWorldMatrix(false, true);
      wpos(foot.lower, kneePoint); wpos(foot.ankle, anklePoint); va.copy(anklePoint).sub(kneePoint).normalize(); vb.copy(desired).sub(kneePoint).normalize(); qa.setFromUnitVectors(va, vb);
      wquat(foot.lower, qDesired); qDesired.premultiply(qa); wquat(foot.lower.parent, qParent).invert(); foot.lower.quaternion.copy(qParent.multiply(qDesired)); foot.lower.updateWorldMatrix(false, true);
      wquat(foot.ankle.parent, qParent).invert(); foot.ankle.quaternion.copy(qParent.multiply(foot.orientation)); foot.ankle.updateWorldMatrix(false, true);
    }
    // Clip time and layer weights of a move at time t (s) whose contact is at Tc and which ends at Tend.
    var curve = { ct: 0, coil: 0, strike: 0, hold: 0, phase: '' };
    function moveCurve(m, t, Tc, Tend) {
      var swing = Math.min(m.swing, Tc * .62), A = Math.max(.001, Tc - swing), follow = Math.min(swing * 1.7, Math.max(.03, Tend - Tc) * .55);
      var snap = Math.min(A * (m.snapK || .72), hero ? A * (m.snapK || .72) : .3), c0 = m.start || 0, u;
      curve.hold = 0;
      if (m.continuous) {
        // Hero heavy skills never park at the chamber. Match clip velocity at the wind/swing
        // junction, then carry straight through the exact contact frame into the recovery.
        if (t < A) {
          u=clamp(t/A,0,1);var wind=u*(1.6-.6*u);
          curve.ct=c0+(m.chamber-c0)*wind;curve.coil=smooth(u);curve.strike=0;curve.phase='wind';
        } else if (t < Tc) {
          u=clamp((t-A)/swing,0,1);var slope=clamp((m.chamber-c0)*.4/A*swing/Math.max(.001,m.contact-m.chamber),.1,1.8);
          curve.ct=m.chamber+(m.contact-m.chamber)*u*(slope+(1-slope)*u);
          curve.coil=1-smooth(u);curve.strike=smooth(u);curve.phase='swing';
        } else {
          u=clamp((t-Tc)/Math.max(.001,Tend-Tc),0,1);
          curve.ct=m.contact+(m.end-m.contact)*easeOut(u,m.flow||1.35);
          curve.coil=-m.over*Math.sin(u*PI)*(1-u);curve.strike=1-smooth(u);curve.phase=u<.3?'follow':'recover';
        }
        return curve;
      }
      if (t < snap) { u = easeOut(t / snap, m.ease); curve.ct = c0 + (m.chamber - c0) * u * .92; curve.coil = .8 * u; curve.strike = 0; curve.phase = 'wind'; }
      else if (t < A) { u = (t - snap) / Math.max(.001, A - snap); curve.ct = m.chamber - (m.chamber - c0) * .08 * (1 - smooth(u)); curve.coil = .8 + .2 * smooth(u); curve.strike = 0; curve.hold = u; curve.phase = 'hold'; }
      else if (t < Tc) { u = (t - A) / swing; curve.ct = m.chamber + (m.contact - m.chamber) * u * u; curve.coil = 1 - u; curve.strike = u * u; curve.phase = 'swing'; }
      else if (t < Tc + follow) { u = easeOut((t - Tc) / follow, 2); curve.ct = m.contact + (m.follow - m.contact) * u; curve.coil = -m.over * u; curve.strike = 1; curve.phase = 'follow'; }
      else {
        u = clamp((t - Tc - follow) / Math.max(.001, Tend - Tc - follow), 0, 1); var h = m.hold || 0, v = smooth(u) * (.22 + .78 * smooth(u / Math.max(.01, 1 - h)));
        // Recovery slows under weight but never resets backwards at the end of a held follow-through.
        curve.ct = m.follow + (m.end - m.follow) * v;
        curve.coil = -m.over * (1 - v); curve.strike = 1 - v; curve.phase = 'recover';
      }
      // flow: follow-through and recovery share one ease-out, so the clip never comes to a dead stop between them.
      if (m.flow && t >= Tc) curve.ct = m.contact + (m.end - m.contact) * easeOut((t - Tc) / Math.max(.001, Tend - Tc), m.flow);
      return curve;
    }
    function sampleMove(m, ct, destination) {
      if (m.still) sample(m.clip, m.stillAt === undefined ? clock : m.stillAt, destination, true);
      else {
        var main = clip(m.clip).duration;
        if (ct > main && m.recover) sample(m.recover, ct - main, destination, false); else sample(m.clip, ct, destination, false);
      }
      if (m.mirror) mirror(destination);
    }
    // Kick: the knee comes up in the coil, the leg drives out on contact and settles back in the recovery.
    function kickLayer(p, c) {
      var lift = Math.max(0, c.coil) * (1 - c.strike), ext = c.strike;
      euler.set(-(1.0 * lift + 1.35 * ext), 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 18, qa);
      euler.set(1.4 * lift, 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 19, qa);
      spineLayer(p, 0, -.18 * ext, 0);
    }
    // War cry / roar: breath drawn in low and tight, then released at Tr with the chest thrown out, head back,
    // the right arm and weapon hauled overhead and the free arm flung wide; it settles over the last .22 s (less for a short roar).
    function roarPose(p, t, Tr, Td, tier) {
      tier = tier || 1;
      var span = Math.max(.05, Td - Tr), rw = Math.min(.14, span * .5), fw = Math.min(.22, span * .6);   // release ramp and settle scale with a short roar
      var g = smooth(t / Math.max(.05, Tr)), rel = t >= Tr ? easeOut((t - Tr) / rw, 2) : 0, fade = t > Td - fw ? smooth((Td - t) / fw) : 1;
      var shake = rel > 0 && t < Td - fw * 1.1 ? Math.sin(clock * 14) * (.012 + .008 * (tier - 1)) * fade : 0;
      var gather = g * (1 - rel);
      if (tier === 2) {
        // Ölüm Çığlığı: a scream - crouched and clenched in the gather, then the chest arches right back, the head is thrown up and BOTH arms fly wide.
        spineLayer(p, 0, .55 * gather - .95 * rel * fade + shake * 1.4, 0);
        p.p.y -= (.09 * gather + .02 * rel * fade) / Math.max(.4, characterScale);
        sample('swordAttack', .30, roarBuf, false);
        var w2 = Math.max(.2 * gather, rel * fade * .5);
        blendPose(p, roarBuf, w2, 10, 14); blendPose(p, roarBuf, w2, 37, 52);
        euler.set(-.3 * rel * fade, 0, (1.35 * rel - .3 * gather) * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa);
        euler.set(-.3 * rel * fade, 0, (-1.35 * rel + .3 * gather) * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 11, qa);
        euler.set(0, 0, -.55 * rel * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa);
        euler.set(0, 0, .55 * rel * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 12, qa);
        euler.set(-1.0 * rel * fade + shake * 2.5, 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 4, qa);
        return;
      }
      if (tier >= 3) {
        // Kıyamet Narası: deep crouch with the fists drawn in, stage one explodes upward (cleaver and free arm overhead, chest thrown back, head up),
        // stage two (.34 s later, the second ring) drives the whole body down into a slam and back up.
        var pulse = t > Tr + .3 ? Math.sin(clamp((t - Tr - .3) / .5, 0, 1) * PI) : 0;
        spineLayer(p, 0, .75 * gather - .75 * rel * fade + .55 * pulse * fade + shake * 1.5, 0);
        p.p.y -= (.16 * gather + .03 * rel * fade + .1 * pulse) / Math.max(.4, characterScale);
        sample('swordAttack', .30, roarBuf, false);
        var w3 = Math.max(.5 * gather, rel * fade);
        blendPose(p, roarBuf, w3, 10, 14); blendPose(p, roarBuf, w3, 37, 52);
        euler.set(-1.55 * rel * fade * (1 - .6 * pulse), 0, (1.0 * rel - .3 * gather) * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa);
        euler.set(0, 0, -.5 * rel * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa);
        euler.set((-.9 * rel + .7 * pulse) * fade + shake * 3, 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 4, qa);
        return;
      }
      spineLayer(p, .1 * gather, .38 * gather - .5 * rel * fade + shake, 0);
      p.p.y -= (.05 * gather + .03 * rel * fade) / Math.max(.4, characterScale);
      // Right arm (and weapon) raised: blend in the overhead chamber of the downward cut.
      sample('swordAttack', .30, roarBuf, false);
      var w = Math.max(.35 * gather, rel * fade);
      blendPose(p, roarBuf, w, 10, 14); blendPose(p, roarBuf, w, 37, 52);
      // Free arm flung wide and up, fist clenched; during the gather it pulls in to the chest.
      euler.set(-.35 * rel * fade, 0, (1.15 * rel - .35 * gather) * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa);
      euler.set(0, 0, -.5 * rel * fade, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa);
      // Head thrown back with the roar.
      euler.set(-.55 * rel * fade + shake * 2, 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 4, qa);
    }
    // Read-only source pose, shared by rigs. Cache during construction, never on the first attack.
    if(!crouchReference){crouchReference=pose();sample('crouch',0,crouchReference,true);}
    if(!gripReference){gripReference=pose();sample('punchJab',.12,gripReference,false);}
    // Kabir Balyozu follows the combat-owned airborne arc; the blade keeps moving toward the
    // same contact frame. Legs compress, tuck and extend continuously instead of swapping fixed poses.
    function poundPose(m, c, p, t, Tc, Tend, state) {
      var air = clamp(finite(state.leapAir, .38), .1, .6), A0 = Math.max(.05, Tc - air), inv=1/Math.max(.4,characterScale);
      sampleMove(m,c.ct,p);
      if (t < Tc) {
        var cu=smooth(t/A0),au=clamp((t-A0)/air,0,1),rise=smooth(au/.32),land=smooth((au-.55)/.45);
        blendPose(p,crouchReference,t<A0?.85*cu:.85*(1-rise)+.8*land,14,22);
        if(t>=A0){sample('jump',clip('jump').duration*(.08+.65*au),extra,false);blendPose(p,extra,rise*(1-land),14,22);}
        var bend=t<A0?.3*cu:.3-.90*Math.pow(Math.sin(au*PI),2)+.70*smooth(au);
        spineLayer(p,0,bend,0);p.p.y-=(t<A0?.15*cu:.15*(1-rise)+.17*land)*inv;
        curve.phase=t<A0?'wind':au<.55?'rise':'swing';return;
      }
      spineLayer(p,m.twist*c.coil,m.bend*Math.max(0,c.coil)+m.strikeBend*c.strike,0);
      var sink=1-smooth((t-Tc)/.45);
      blendPose(p,crouchReference,.8*sink,14,22);p.p.y-=.17*sink*inv;
    }
    // Whirlwind (Zincir Kasırgası, hero only). The game turns the whole root (unwrapped yaw, accelerating to ~3 turns/s); this layer is everything the body does
    // inside that turn, on a nominal 1.3 s timeline (tt): a .12 s coil (crouch, torso wound back, cleaver hauled behind), the release into the spin (knees bent, torso
    // leaning in, cleaver out level at shoulder height and trailing the turn by an angle that grows with the turning speed, free arm thrown wide and leading it,
    // head counter-turned so it never whirls with the body), then the heavy finish: cleaver overhead, slam on the last tick (tt = WHIRL_HIT), planted wide stance,
    // and a recovery that hands the pose back to the idle / walk pose before the mode ends. Everything is a weight on the normal pose, so the blend in and out has no pops.
    var wBase = pose(), wArm = pose(), wLegs = pose(), WHIRL_D = 1.3, WHIRL_TICK = .15, WHIRL_GAP = .28, WHIRL_HIT = WHIRL_TICK + 3 * WHIRL_GAP;   // = SPECIAL.first / gap / last tick in combat.js
    var wYawPrev = 0, wOmega = 0, wLag = 0, wLock = 0, wGait = 0, wLive = false, wFlare = 0;
    function yawSub(p, index, angle) { qTurn.setFromAxisAngle(up, angle); rotateSubtree(p, index, qTurn); }
    var wq = new T.Quaternion(), wv = new T.Vector3(), wd = new T.Vector3(), wt = new T.Vector3(), wb = new T.Vector3(), wu = new T.Vector3(), wu2 = new T.Vector3(), oppositeTangent = new T.Vector3();
    var W_COIL_T = new T.Vector3(-.8, .1, -.6).normalize(), W_COIL_B = new T.Vector3(-.55, .15, -.82).normalize();
    var W_OVER_T = new T.Vector3(-.3, .95, .1).normalize(), W_OVER_B = new T.Vector3(-.15, .6, -.78).normalize();
    var W_SLAM_T = new T.Vector3(-.15, -.2, .96).normalize(), W_SLAM_B = new T.Vector3(-.02, -.8, .6).normalize();
    function slerpV(out, a, b, t) {   // unit vectors
      var d = clamp(a.dot(b), -1, 1), ang = Math.acos(d); if (t <= 0) return out.copy(a); if (ang < .01) return out.copy(a).lerp(b, t).normalize();
      if (d < -.9999) {
        if (t >= 1) return out.copy(b);
        oppositeTangent.copy(b).addScaledVector(a, -d);
        if (oppositeTangent.lengthSq() < 1e-12) oppositeTangent.set(Math.abs(a.y) < .9 ? 0 : 1, Math.abs(a.y) < .9 ? 1 : 0, 0).cross(a);
        oppositeTangent.normalize();
        return out.copy(a).multiplyScalar(Math.cos(ang * t)).addScaledVector(oppositeTangent, Math.sin(ang * t));
      }
      var sn = Math.sin(ang); return out.copy(a).multiplyScalar(Math.sin((1 - t) * ang) / sn).addScaledVector(b, Math.sin(t * ang) / sn);
    }
    // Forward kinematics of the right arm in pose space: unit shoulder -> hand direction (the blade points along the hand bone's +Z: the weapon's +Y after qBlade).
    function armDir(p, out) {
      wq.copy(sourceRest[11]).invert().premultiply(p.q[11]); out.copy(sourcePos[12]).sub(sourcePos[11]).applyQuaternion(wq);
      wq.copy(sourceRest[12]).invert().premultiply(p.q[12]); out.add(wv.copy(sourcePos[13]).sub(sourcePos[12]).applyQuaternion(wq)); return out.normalize();
    }
    // Swing the whole right arm along unit direction tv (pose space) and turn the cleaver to bv, both by weight w (the same rotation from the same start every frame: no jumps).
    function aimCleaver(p, w, tv, bv, wrist) {
      if (w < .002) return;
      wq.setFromUnitVectors(armDir(p, wd), tv); qa.identity().slerp(wq, w); rotateSubtree(p, 11, qa);
      wv.set(0, 0, 1).applyQuaternion(p.q[13]); wq.setFromUnitVectors(wv, bv); qa.identity().slerp(wq, w * wrist); rotateSubtree(p, 13, qa);
    }
    var reachUpper=new T.Vector3(),reachFore=new T.Vector3(),reachTarget=new T.Vector3(),reachElbow=new T.Vector3(),reachBend=new T.Vector3(),reachAxis=new T.Vector3(),reachQ=new T.Quaternion(),reachRest=new T.Quaternion();
    var SPEAR_FORWARD=new T.Vector3(.14,-.14,1).normalize(),SPEAR_BRACE=new T.Vector3(-.68,-.22,.68).normalize(),SPEAR_BLADE=new T.Vector3(.06,.02,1).normalize();
    // Two-bone pose-space reach: the elbow bends outside the chest while the
    // spear hand extends along its shaft. It never stretches a native bone.
    function reachArm(p,index,direction,extension,side) {
      reachUpper.copy(sourcePos[index+1]).sub(sourcePos[index]);reachFore.copy(sourcePos[index+2]).sub(sourcePos[index+1]);
      var a=reachUpper.length(),b=reachFore.length(),len=clamp((a+b)*extension,Math.abs(a-b)+.01,a+b-.012);
      reachTarget.copy(direction).multiplyScalar(len);
      reachBend.set(side*.85,-.3,-.12).addScaledVector(direction,-reachBend.dot(direction)).normalize();
      var along=(a*a+len*len-b*b)/(2*len);
      reachElbow.copy(direction).multiplyScalar(along).addScaledVector(reachBend,Math.sqrt(Math.max(0,a*a-along*along)));
      reachRest.copy(sourceRest[index]).invert();reachQ.copy(p.q[index]).multiply(reachRest);reachUpper.applyQuaternion(reachQ).normalize();
      reachAxis.copy(reachElbow).normalize();reachQ.setFromUnitVectors(reachUpper,reachAxis);rotateSubtree(p,index,reachQ);
      reachRest.copy(sourceRest[index+1]).invert();reachQ.copy(p.q[index+1]).multiply(reachRest);reachFore.applyQuaternion(reachQ).normalize();
      reachAxis.copy(reachTarget).sub(reachElbow).normalize();reachQ.setFromUnitVectors(reachFore,reachAxis);rotateSubtree(p,index+1,reachQ);
    }
    function spearLayer(p,c,t,Tc,Tend,state) {
      var engage=smooth(t/.065),recover=t>Tc?smooth((t-Tc)/Math.max(.04,Tend-Tc)):0,weight=engage*(1-recover);
      if(weight<.001)return;
      copyPose(roarBuf,p);
      var drive=c.strike,coil=Math.max(0,c.coil),combo=finite(state.combo,0),extension=.69+.27*drive-.15*coil;
      reachArm(roarBuf,11,SPEAR_FORWARD,extension,-1);
      wv.set(0,0,1).applyQuaternion(roarBuf.q[13]);reachQ.setFromUnitVectors(wv,SPEAR_BLADE);rotateSubtree(roarBuf,13,reachQ);
      if(hero){reachArm(roarBuf,7,SPEAR_BRACE,.82+.1*drive,1);blendPose(p,roarBuf,weight,7,10);blendPose(p,roarBuf,weight,22,37);}
      blendPose(p,roarBuf,weight,11,14);blendPose(p,roarBuf,weight,37,52);
      // Finger rotations are world-space source poses: carry the cached fist into
      // each new hand frame, rather than leaving fingers facing their old idle direction.
      for(var handSide=hero?0:1;handSide<2;handSide++){
        var hi=handSide?13:9,first=handSide?37:22,last=handSide?52:37;
        reachRest.copy(gripReference.q[hi]).invert();reachQ.copy(p.q[hi]).multiply(reachRest);
        for(var finger=first;finger<last;finger++){qa.copy(reachQ).multiply(gripReference.q[finger]);p.q[finger].slerp(qa,weight*.92);}
      }
      p.p.y-=.025*drive*(combo===2?1.5:1);p.p.z+=.045*drive;
    }
    function whirlPose(p, u, t, dt, yaw) {
      var D = u > .001 ? t / u : WHIRL_D, tt = t * WHIRL_D / clamp(D, .4, 3), inv = 1 / Math.max(.4, characterScale), wt3 = D > 1.8 ? 2 : D > 1.45 ? 1 : 0;   // wt3: tier from the spin length (1.3 / 1.6 / 2.05 s): bigger lean, deeper crouch, faster feet
      if (!wLive) { wLive = true; wYawPrev = yaw; wOmega = 0; wLag = 0; wLock = yaw; wGait = 0; }
      var om = dt > 0 ? signedAngle(yaw - wYawPrev) / dt : 0; wYawPrev = yaw;
      wOmega += (om - wOmega) * (dt > 0 ? damp(28, dt) : 1);
      wLag += (clamp(wOmega * .024, -.6, .6) - wLag) * (dt > 0 ? damp(16, dt) : 1);
      var coil = smooth(tt / .12) * (1 - smooth((tt - .12) / .14)), spin = smooth((tt - .05) / .2) * (1 - smooth((tt - (WHIRL_HIT - .18)) / .14));
      var raise = smooth((tt - (WHIRL_HIT - .2)) / .16), slam = smooth((tt - (WHIRL_HIT - .06)) / .07), rec = smooth((tt - (WHIRL_HIT + .08)) / .18), fin = raise * (1 - rec);
      var hold = slam * (1 - rec), keep = 1 - rec;
      // the first three hit ticks (WHIRL_TICK + n * WHIRL_GAP) land as a short body punch: a dip of the hips and a snap of the torso into the blow
      var punch = 0; for (var pn = 0; pn < 3; pn++) { var pd = tt - (WHIRL_TICK + WHIRL_GAP * pn); if (pd > 0 && pd < .16) punch = Math.max(punch, (1 - pd / .16) * (1 - pd / .16) * smooth(pd / .025)); }
      // legs: crouch, a quick pitter-patter cycle on top, planted and wide for the slam
      var legW = clamp((.5 + .1 * wt3) * Math.max(spin, coil) + .35 * hold, 0, .88);
      sample('crouch', 0, wLegs, false); blendPose(p, wLegs, legW, 14, 22); blendPose(p, wLegs, legW * .8, 0, 0);
      wGait += dt * (1.9 + .75 * wt3); sample('jog', wrap(wGait) * clip('jog').duration, wArm, true); blendPose(p, wArm, .3 * spin * (1 - hold), 14, 22);
      // torso: wound back in the coil, trailing in the spin, leaning forward and into the turn, bowed over the slam
      spineLayer(p, -.7 * coil - .55 * wLag * spin, .16 * coil + (.28 + .11 * wt3) * spin * (1 - fin) - .2 * raise * (1 - slam) + .5 * hold + .1 * punch * spin, (.13 + .13 * wt3) * spin * (1 - fin));   // lean into the turn grows with the tier
      p.p.y -= ((.07 + .03 * wt3) * Math.max(spin, coil * .7) + .06 * hold + .035 * punch * spin) * inv;
      // free arm: thrown wide and leading the turn (counter-swing), drawn in for the slam
      var wide = smooth((tt - .04) / .16) * (1 - .8 * fin);
      euler.set(-.15 * wide, 0, 1.25 * wide, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa);
      euler.set(0, 0, -.35 * wide, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa);
      yawSub(p, 7, wLag * .9 * wide);
      // cleaver arm: hauled back in the coil -> out level, trailing the turn -> overhead -> slam; the target directions are slerped, the rotation from the ready pose is a weight
      var phi = .2 - wLag * 1.3;
      wt.copy(W_COIL_T); wu.set(-Math.cos(phi), .04 + (wt3 ? .14 : 0) + (wt3 > 1 ? .3 * Math.sin(wGait * 6.283 * 1.5) * spin : 0), Math.sin(phi)).normalize(); slerpV(wt, wt, wu, smooth((tt - .1) / .14)); slerpV(wt, wt, W_OVER_T, raise); slerpV(wt, wt, W_SLAM_T, slam);
      wb.copy(W_COIL_B); wu2.set(-Math.cos(phi + .12), .07, Math.sin(phi + .12)).normalize(); slerpV(wb, wb, wu2, smooth((tt - .1) / .14)); slerpV(wb, wb, W_OVER_B, raise); slerpV(wb, wb, W_SLAM_B, slam);
      aimCleaver(p, smooth(tt / .1) * keep, wt, wb, 1);
      // head: counter-turned against the body yaw (a smooth 'lock' on the start heading, sin keeps it continuous through the turn), chin tucked
      var rel = signedAngle(wLock - yaw), look = .7 * Math.sin(rel) * spin;
      euler.set(.12 * spin - .05 * hold, look, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 4, qa);
      wFlare = spin * clamp(Math.abs(wOmega) / 14, 0, 1);
      root.userData.whirlFlare = wFlare;
    }
    // Charge (Hücum, hero only; src/charge.js BABA.Charge.poseState merged into the hero state): state.chargeTime (s since the skill began), chargeWind (crouch length),
    // chargeDash (dash length) and impactTime (s since the impact, -1 before). Wind-up: deep crouch, torso coiled, cleaver hauled back. Dash: a low forward lean with the
    // lead shoulder dropped, cleaver trailing behind, free arm swept back, a sprint cycle on the legs. Impact: a big lunge, the cleaver slams through ahead of the hero
    // and follows through, planted wide, then the pose hands back to idle. Everything is a weight on the normal pose (no pops).
    var cGait = 0, cLive = false, C_RUN_T = new T.Vector3(-.7, -.15, -.7).normalize(), C_RUN_B = new T.Vector3(-.4, .05, -.9).normalize();
    // Tier looks (src/charge.js poseState.chargeTier): I low sprint with the cleaver trailing; II shoulder-first ram (torso twisted so the lead shoulder drives forward, chin tucked,
    // free arm guarding across the chest, a tilted fast sprint); III upright charging lunge (chest up, cleaver raised high for the slam, long strides), the first slam, the cleaver
    // hauled up again and a heavier second slam (state.slam2Time).
    var C_OVER_B3 = new T.Vector3(-.1, .7, -.7).normalize();
    function chargePose(p, state, dt) {
      var t = finite(state.chargeTime, 0), wind = Math.max(.04, finite(state.chargeWind, .12)), it = finite(state.impactTime, -1), s2 = finite(state.slam2Time, -1), inv = 1 / Math.max(.4, characterScale), tier = clamp(Math.round(finite(state.chargeTier, 1)), 1, 3);
      if (!cLive) { cLive = true; cGait = 0; }
      var coil = smooth(t / wind) * (it < 0 ? 1 : 0), run = it < 0 ? smooth((t - wind) / .07) : 0, strike = it >= 0 ? smooth(it / .06) : 0;
      var lift = tier === 3 && it >= 0 ? smooth((it - .08) / .14) * (s2 < 0 ? 1 : 1 - smooth(s2 / .04)) : 0, strike2 = s2 >= 0 ? smooth(s2 / .05) : 0;
      var rec = tier === 3 ? (s2 >= 0 ? smooth((s2 - .12) / .3) : 0) : it >= 0 ? smooth((it - .1) / .3) : 0, hold = strike * (1 - rec), keep = 1 - rec, rs = run * (1 - strike);
      // legs: crouch in the wind-up, a sprint cycle in the dash (faster for II, long strides for III), planted wide for the lunge
      sample('crouch', 0, wLegs, false); blendPose(p, wLegs, clamp((tier === 3 ? .9 : .8) * coil * (1 - run) + (tier === 3 ? .7 : .65) * hold, 0, .88), 14, 22); blendPose(p, wLegs, clamp(.7 * coil * (1 - run) + .6 * hold, 0, .8), 0, 0);
      cGait += dt * (tier === 1 ? 3.2 : tier === 2 ? 4.1 : 2.5); sample('sprint', wrap(cGait) * clip('sprint').duration, wArm, true); blendPose(p, wArm, .95 * rs, 14, 22); blendPose(p, wArm, (tier === 3 ? .75 : .5) * rs, 0, 0);
      // torso: coiled back, then driven forward (I) / twisted shoulder-first and tilted (II) / chest up and slightly arched (III), then bowed over the lunge
      var tw, bd, sd;
      if (tier === 1) { tw = -.45 * coil - .3 * rs + .35 * hold; bd = .22 * coil + .52 * rs + .7 * hold; sd = .12 * rs - .1 * hold; }
      else if (tier === 2) { tw = -.45 * coil + .7 * rs + .3 * hold; bd = .22 * coil + .66 * rs + .76 * hold; sd = .32 * rs - .1 * hold; }
      else { tw = -.4 * coil - .1 * rs + .3 * hold * (1 - lift) - .25 * lift; bd = .22 * coil - .16 * rs + .78 * hold * (1 - lift) - .12 * lift + .2 * strike2; sd = .04 * rs; }
      spineLayer(p, tw, bd, sd);
      p.p.y -= ((tier === 3 ? .02 : tier === 2 ? .11 : .08) * rs + .1 * coil + .08 * hold) * inv; p.p.z += (.1 * hold + (tier === 3 ? .02 : .05) * run) * inv * keep;
      // free arm: swept back and wide (I), guarding across the chest (II), thrown forward for balance (III); thrown out wide on the lunge
      var wide = Math.max(rs, hold);
      if (tier === 1) { euler.set(.5 * rs - .2 * hold, 0, (.35 * rs + 1.1 * hold) * wide, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa); euler.set(0, 0, -.4 * wide, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa); }
      else if (tier === 2) { euler.set(-.85 * rs - .1 * hold, 0, -.35 * rs + 1.1 * hold, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa); euler.set(-.9 * rs, 0, -.7 * rs, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa); }
      else { euler.set(-1.15 * rs - .1 * hold, 0, .45 * rs + 1.1 * hold, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa); euler.set(-.4 * rs, 0, -.3 * wide, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa); }
      // cleaver arm: hauled back (wind-up) -> trailing low behind (I, II) or raised high overhead (III) -> slammed ahead (impact) -> (III) hauled up and slammed again -> back to the ready pose
      wt.copy(W_COIL_T); wb.copy(W_COIL_B);
      if (tier === 3) { slerpV(wt, wt, W_OVER_T, run); slerpV(wb, wb, C_OVER_B3, run); } else { slerpV(wt, wt, C_RUN_T, run); slerpV(wb, wb, C_RUN_B, run); }
      slerpV(wt, wt, W_SLAM_T, strike); slerpV(wb, wb, W_SLAM_B, strike);
      if (tier === 3) { slerpV(wt, wt, W_OVER_T, lift); slerpV(wb, wb, C_OVER_B3, lift); slerpV(wt, wt, W_SLAM_T, strike2); slerpV(wb, wb, W_SLAM_B, strike2); }
      aimCleaver(p, smooth(t / .08) * keep, wt, wb, 1);
      // head: up and looking along the line of the run (I), chin tucked behind the shoulder (II), high and defiant (III)
      euler.set((tier === 2 ? .22 * rs - .1 * hold : -.28 * Math.max(rs, hold)) + .1 * coil, tier === 2 ? -.3 * rs : 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 4, qa);
    }
    function applyMove(m, t, Tc, Tend, destination, state) {
      var c = moveCurve(m, t, Tc, Tend);
      if (m.pound) { poundPose(m, c, destination, t, Tc, Tend, state); if (t < Tc) return curve; return c; }
      if (m.roar) { roarPose(destination, t, Tc, Tend, finite(state.roarTier, 1)); curve.phase = t < Tc ? 'hold' : 'follow'; return curve; }
      if (m.rush && t >= Tc) {
        // A charge: the body is thrown forward in a sprint while the capsule rushes along the telegraphed line.
        var run = clamp((t - Tc) / Math.max(.05, finite(state.rushTime, .3)), 0, 1);
        sample(run < 1 ? m.rush : 'zombieScratch', run < 1 ? wrap(run * 1.6) * clip(m.rush).duration : .72, destination, run < 1);
        spineLayer(destination, 0, m.strikeBend * (run < 1 ? 1 : .6), 0); return c;
      }
      if (m.leap && t >= Tc - m.swing) {
        // Pounce: coiled crouch, airborne reach, then a clawing landing that recoils into the recovery.
        var air = clamp((t - (Tc - m.swing)) / m.swing, 0, 1);
        if (air < 1) { sample('jump', clip('jump').duration * (.12 + .56 * smooth(air)), destination, false); spineLayer(destination, 0, .25 - .35 * air, 0); }
        else { sample('land', clamp((t - Tc) * 1.6, 0, clip('land').duration), destination, false); sample('meleeHook', .30, extra, false); blendPose(destination, extra, .55 * (1 - smooth((t - Tc) / .5)), 1, 14); }
        return c;
      }
      sampleMove(m, c.ct, destination);
      // Tension reads as deliberate breathing and rising weight, not a high-frequency vibrating rig.
      var tremble = (m.tremble || 0) * c.hold * (boss ? .5 : .7), shake = tremble ? Math.sin(clock * lifeRate * 2.1 + lifeSeed) * tremble * .18 : 0;
      spineLayer(destination, m.twist * c.coil + shake * .7, m.bend * Math.max(0, c.coil) + m.strikeBend * c.strike + shake, 0);
      if (m.spear) spearLayer(destination,c,t,Tc,Tend,state);
      // The blow is still sampled at the exact gameplay contact. Only AFTER contact, the neck
      // follows the shoulder mass and the free arm catches the body's weight before settling.
      // Analytic envelopes are independent of frame rate; scratch quaternions are already pooled.
      if (t > Tc && t < Tend && !m.still) {
        var recovery = clamp((t - Tc) / Math.max(.04,Tend - Tc),0,1),
          weight = Math.sin(recovery * PI) * (1 - recovery),
          heft = hero ? (m === MOVES.strikeBrand ? 1.4 : m === MOVES.heavy ? 1.0 : .52) : boss ? 1.6 : type === 'guard' || type === 'carrier' ? 1.1 : .65,
          side = m.twist < 0 ? 1 : -1;
        euler.set(-.095 * weight * heft,-.12 * weight * heft * side,.025 * weight * side,'YXZ');
        qa.setFromEuler(euler);rotateSubtree(destination,4,qa);
        euler.set(-.055 * weight * heft,0,.11 * weight * heft,'YXZ');
        qa.setFromEuler(euler);rotateSubtree(destination,7,qa);
      }
      if (hero && state.weaponType === 'axe' && !m.spear) { spineLayer(destination,m.twist*.18*c.coil,.08*c.strike-.025*Math.max(0,c.coil),-.035*c.strike); destination.p.y-=.018*c.strike; }
      if (m.kick) kickLayer(destination, c);
      // Moves cut from a held pose (shield bash / shove, charge crouch) get a weight shift so the wind-up reads: the body sinks and draws back in the
      // coil and drives forward through the blow (the pelvis only; the strike frame and timing are unchanged).
      if (m.still && !m.kick) { var drive = c.strike; destination.p.z += .11 * drive - .09 * Math.max(0, c.coil); destination.p.y -= .035 * Math.max(0, c.coil) * (1 - drive); }
      return c;
    }
    function legacyTimes(progress, combo, heavy) {
      var durations = [.51, .56, .68], strikes = [.20, .23, .29], dur = heavy ? 1.05 : durations[combo] || .51, Tc = heavy ? .57 : strikes[combo] || .2;
      if (!armed) { dur = 1.6; Tc = .9; }
      var contact = heavy ? .56 : .41;
      return { t: progress <= contact ? progress / contact * Tc : Tc + (progress - contact) / (1 - contact) * (dur - Tc), Tc: Tc, Tend: dur };
    }
    function animate(dt, state) {
      if (disposed) return; state = state || {}; dt = clamp(finite(dt, 0), 0, .1); clock += dt;
      motionInfo.refreshed = false;
      if (state.reset) {
        initialized = false; clock = finite(state.time, 0); gait = 0; speed = 0; moveWeight = 0; mode = ''; modeAge = 0; deathTime = 0; deathYaw = 0; deathKind = '';
        hurtTime = 2; previousHurt = 0; previousAttack = 0; comboMemory = -1; previousDodge = 0; wasDead = false; turnRate = 0; footfall.serial = 0; rollRecover = 9; lookCur = 0; lookPitch = 0; shiftCur = 0; legYawCur = 0; backwardMotion = false; fearCur = 0;
        originalLocal.forEach(function (r) { r.node.position.copy(r.p); r.node.quaternion.copy(r.q); }); feet.forEach(function (f) { f.locked = false; f.weight = 0; });
      }
      // A corpse whose fall has finished holds one fixed local pose (death clip clamped at its end, slide eased out, no
      // secondary life, no foot planting, the limbs.js death spasm long over), so recomputing it each frame changes nothing.
      // The bones are local to the root, so the renderer's own matrix pass still carries the corpse if the root moves.
      if (settled && state.dead && wasDead) { deathTime += dt; return; }
      settled = false; motionInfo.serial = (motionInfo.serial | 0) + 1;   // a new pose: anything cached about this tree is out of date
      // Only the pelvis ancestry is read before applying the new pose. Keep
      // rigid root siblings (chains/hooks) current; the model subtree is refreshed
      // after retargeting, so visiting its old pose here would be duplicate work.
      pelvis.parent.updateWorldMatrix(true, false);
      for (var earlyChild = 0; earlyChild < root.children.length; earlyChild++) {
        if (root.children[earlyChild] !== model) root.children[earlyChild].updateWorldMatrix(false, true);
      }
      if (!rootInChain) root.updateWorldMatrix(true, false);
      wpos(root, rootNow); wquat(root, qRoot); invRoot.copy(qRoot).invert();
      var rootYaw = Math.atan2(root.matrixWorld.elements[8], root.matrixWorld.elements[10]);
      var teleported = initialized && rootNow.distanceTo(rootBefore) > characterScale * 2.5;
      velocity.copy(rootNow).sub(rootBefore).setY(0).multiplyScalar(initialized && dt > 0 && !teleported ? 1 / dt : 0);
      if (Number.isFinite(state.velocityX) && Number.isFinite(state.velocityZ)) velocity.set(state.velocityX, 0, state.velocityZ);
      var move = clamp(finite(state.move, 0), 0, 1), realSpeed = velocity.length();
      if (realSpeed < .025 && move > .01 && !Number.isFinite(state.velocityX)) realSpeed = move * (boss ? 2.5 : hero ? 4.7 : 2.8);
      var attack = clamp(finite(state.attack, 0), 0, 1), heavy = !!state.heavy, dodge = clamp(finite(state.dodge, 0), 0, 1), leap = clamp(finite(state.leap, 0), 0, 1);
      var hurt = clamp(finite(state.hurt, 0), 0, 1), phase = String(state.phase || '').toLowerCase(), action = String(state.action || '');
      var stagger = clamp(finite(state.stagger, 0), 0, 1), staggerTime = finite(state.staggerTime, 0);
      if (Number.isFinite(state.hitAngle)) lastHitAngle = state.hitAngle;
      if (/wind|tell|prepare/.test(phase) && attack === 0) attack = heavy ? .42 : .26;
      if (attack > 0 && (previousAttack === 0 || attack < previousAttack - .15)) { comboMemory = (comboMemory + 1) % 3; legacySerial++; }
      var combo = Math.floor(clamp(finite(state.combo, Math.max(0, comboMemory)), 0, 2)); previousAttack = attack;
      if (hurt > previousHurt + .05) hurtTime = 0; previousHurt = hurt; hurtTime += dt;
      if (state.dead && !wasDead) { deathTime = 0; deathYaw = clamp(signedAngle(lastHitAngle), -PI, PI); deathKind = String(state.deathKind || ''); }
      if (!state.dead && wasDead) { deathTime = 0; initialized = false; }
      wasDead = !!state.dead; if (state.dead) deathTime += dt;
      speed += ((dodge || leap || state.dead ? 0 : realSpeed) - speed) * (dt > 0 ? damp(14, dt) : 1);
      moveWeight += ((move > .015 ? clamp(speed / (.85 * characterScale), 0, 1) : 0) - moveWeight) * (dt > 0 ? damp(15, dt) : 1);
      localVelocity.copy(velocity).applyQuaternion(invRoot); var direction = localVelocity.lengthSq() > .001 ? Math.atan2(localVelocity.x, localVelocity.z) : 0;
      if (Number.isFinite(state.moveX) || Number.isFinite(state.moveZ)) direction = Math.atan2(finite(state.moveX, 0), finite(state.moveZ, 1));
      // Crossing the strafe/backward boundary used to flip both legs by 2.5 radians in one frame.
      // Hysteresis keeps small steering changes from reversing the gait; the heading eases through the turn.
      var facingMove = Math.cos(direction);
      if (!initialized) backwardMotion = facingMove < -.3;
      else if (facingMove < -.4) backwardMotion = true;
      else if (facingMove > 0) backwardMotion = false;
      var backward = backwardMotion, legYaw = clamp(backward ? signedAngle(direction + PI) : direction, -1.25, 1.25);
      if (!initialized || dt === 0) legYawCur = legYaw;
      else legYawCur += signedAngle(legYaw - legYawCur) * damp(12, dt);
      legYaw = legYawCur;
      var normalizedSpeed = speed / characterScale, walkJog = smooth((normalizedSpeed - 1.0) / 1.5), jogSprint = smooth((normalizedSpeed - 3.3) / 1.8);
      var gaitName = 'walk', walking = true;
      var stride = (STRIDE.walk + (STRIDE.jog - STRIDE.walk) * walkJog + (STRIDE.sprint - STRIDE.jog) * jogSprint) * characterScale, oldGait = gait;
      var roaring = hero && finite(state.roarTime, -1) >= 0, whirling = hero && finite(state.whirl, -1) >= 0, charging = hero && finite(state.chargeTime, -1) >= 0;
      var swinging = attack > 0 || finite(state.attackTime, -1) >= 0 || finite(state.beatTime, -1) >= 0, acting = swinging || roaring || whirling || charging;
      if (moveWeight > .02 && !swinging && !dodge && !state.dead) gait += dt * speed / Math.max(.3, stride) * (backward ? -1 : 1);
      var idleName = armed ? type === 'guard' ? 'shieldIdle' : 'combatIdle' : type === 'cultist' ? 'spellIdle' : 'zombieIdle';
      sample(idleName, clock, wanted, true);
      if (hero) {
        sample('idle', clock, wanted, true); sample('attackA', 0, extra, false); blendPose(wanted, extra, .78);
        for (var readyHand = 11; readyHand < 14; readyHand++) wanted.q[readyHand].copy(extra.q[readyHand]);
        for (var readyFinger = 37; readyFinger < 52; readyFinger++) wanted.q[readyFinger].copy(extra.q[readyFinger]);
      }
      if (moveWeight > .001 && !whirling && !charging) {
        sample(gaitName, wrap(gait) * clip(gaitName).duration, extra, true);
        if (walking && walkJog > 0) { copyPose(locomotion, extra); sample('jog', wrap(gait + .05) * clip('jog').duration, extra, true); blendPose(locomotion, extra, walkJog); copyPose(extra, locomotion); }
        if (walking && jogSprint > 0) { copyPose(locomotion, extra); sample('sprint', wrap(gait) * clip('sprint').duration, extra, true); blendPose(locomotion, extra, jogSprint); copyPose(extra, locomotion); }
        qTurn.setFromAxisAngle(up, legYaw);
        for (var li = 14; li < 22; li++) extra.q[li].premultiply(qTurn);
        qTurn.setFromAxisAngle(up, legYaw * .45); extra.q[0].premultiply(qTurn);
        if (HUNCH[type]) spineLayer(extra, 0, HUNCH[type] * (.6 + .4 * walkJog), 0);
        blendPose(wanted, extra, moveWeight);
      }
      var nextMode = 'locomotion', fade = .11;
      // After a roll the hero rises out of the crouch unless another action takes over.
      if (previousDodge > 0 && dodge === 0) rollRecover = 0;
      rollRecover += dt;
      if (rollRecover < .2 && !dodge && !acting && !state.block && !state.dead) {
        sample('roll', 1.13 + rollRecover * 1.1, extra, false); blendPose(wanted, extra, (1 - smooth(rollRecover / .2)) * (1 - moveWeight * .5));
      }
      if (state.block || state.parry) {
        nextMode = 'block'; fade = .06;
        sample(type === 'guard' ? 'shieldIdle' : 'block', type === 'guard' ? clock : .47 + Math.sin(clock * 1.7) * .025, extra, type === 'guard');
        blendPose(wanted, extra, 1 - moveWeight);
        blendPose(wanted, extra, 1, 1, 14); blendPose(wanted, extra, 1, 22, D.bones.length);
        // Braced guard: shoulders set forward; each blocked blow drives the torso and hips back, a parry snaps outward.
        var impact = clamp(finite(state.blockImpact, 0), 0, 1), parry = clamp(finite(state.parry, 0), 0, 1), snap = parry > 0 ? Math.sin(PI * (1 - parry)) : 0;
        spineLayer(wanted, .12 * impact + .55 * snap, .1 - .34 * impact * impact - .14 * snap, 0);
        wanted.p.z -= (impact * .07 + snap * .05); wanted.p.y -= impact * .03;
      }
      if (state.healing > 0 && !acting) {
        nextMode = 'consume'; sample('consume', clamp(state.healing, 0, 1) * clip('consume').duration, extra, false);
        blendPose(wanted, extra, .9, 1, 14); blendPose(wanted, extra, .9, 22, D.bones.length);
      }
      var strikePhase = '';
      if (Number.isFinite(state.attackTime) && state.attackTime >= 0) {
        // Hero: exact gameplay clock (seconds), so the blade crosses the target on the damage frame.
        var m = state.skillTier > 1 ? (state.skillTier > 2 ? MOVES.strikePound : MOVES.strikeBrand) : heroMove(combo, heavy, state.weaponType); nextMode = 'attack' + finite(state.attackSerial, 0); fade = .06;
        strikePhase = applyMove(m, state.attackTime, finite(state.attackStrike, .2), finite(state.attackDuration, .51), wanted, state).phase;
      } else if (Number.isFinite(state.beatTime) && state.beatTime >= 0) {
        var em = enemyMove(type, action, finite(state.beat, 0), state.pose); nextMode = 'act' + finite(state.attackSerial, 0) + ':' + finite(state.beat, 0); fade = .09;
        strikePhase = applyMove(em, state.beatTime, finite(state.beatContact, .9), finite(state.beatEnd, 1.5), wanted, state).phase;
      } else if (attack > 0) {
        var lt = legacyTimes(attack, combo, heavy), lm = armed ? heroMove(combo, heavy) : enemyMove(type, action, combo % 2);
        nextMode = 'attack' + legacySerial; fade = .06; strikePhase = applyMove(lm, lt.t, lt.Tc, lt.Tend, wanted, state).phase;
      }
      if (roaring) {
        // The father's war cry (Öfke).
        nextMode = 'roar' + finite(state.roarSerial, 0); fade = .07;
        roarPose(wanted, state.roarTime, finite(state.roarRelease, .3), finite(state.roarDuration, .92), finite(state.roarTier, 1)); strikePhase = state.roarTime < finite(state.roarRelease, .3) ? 'hold' : 'follow';
      }
      if (whirling) { nextMode = 'whirl' + finite(state.attackSerial, 0); fade = .05; whirlPose(wanted, state.whirl, finite(state.whirlTime, 0), dt, rootYaw); strikePhase = 'follow'; } else if (wLive) { wLive = false; wFlare = 0; root.userData.whirlFlare = 0; }
      if (charging) { nextMode = 'charge' + finite(state.chargeSerial, 0); fade = .04; chargePose(wanted, state, dt); strikePhase = 'follow'; } else if (cLive) cLive = false;
      var drinkT = hero ? finite(state.drinkTime, -1) : -1;
      if (drinkT >= 0 && !dodge && !stagger && !state.dead) {
        // Flask: a quick lift of the free hand to the mouth with the head tipped back, laid over whatever he is doing
        // (a flourish only: it never replaces the pose and holds nothing).
        var dk = clamp(drinkT / Math.max(.1, finite(state.drinkDuration, .34)), 0, 1), dl = Math.sin(PI * dk), dwt = Math.pow(dl, .7) * .92;
        sample('consume', .5 * dl, extra, false);
        blendPose(wanted, extra, dwt, 6, 10); blendPose(wanted, extra, dwt, 22, 37);
        euler.set(-.3 * dwt, 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 4, qa);
      }
      if (hurtTime < .42 && hurt > .08 && !dodge && !state.dead && !stagger) {
        // Directional flinch: the torso snaps away from the blow and settles; heavy blows double it.
        sample('hitChest', Math.min(clip('hitChest').duration, hurtTime * 1.15), extra, false);
        var reaction = clamp(hurt * .85, 0, .92) * (1 - smooth((hurtTime - .12) / .3)) * (state.hurtHeavy ? 1.35 : 1) * (acting ? .55 : 1);
        blendPose(wanted, extra, Math.min(.85, reaction), 1, 14);
        var jolt = easeOut(hurtTime / .06) * reaction;
        spineLayer(wanted, -Math.sin(lastHitAngle) * .55 * jolt, -Math.cos(lastHitAngle) * .6 * jolt, Math.sin(lastHitAngle) * .22 * jolt);
        // Knock-back lean: the hips are shoved away from the blow and the head whips after the torso (heavy blows more), then it all rebounds.
        var recoil = (state.hurtHeavy ? 1.6 : 1) * (easeOut(hurtTime / .07) * (1 - smooth((hurtTime - .06) / .34)) - .18 * Math.sin(clamp((hurtTime - .18) / .24, 0, 1) * PI)) * clamp(hurt, 0, 1) * (acting ? .5 : 1);
        wanted.p.z += Math.cos(lastHitAngle) * .12 * recoil / Math.max(.4, characterScale); wanted.p.x += Math.sin(lastHitAngle) * .09 * recoil / Math.max(.4, characterScale);
        wanted.p.y -= .03 * Math.abs(recoil) / Math.max(.4, characterScale);
        euler.set(-Math.cos(lastHitAngle) * .32 * recoil, -Math.sin(lastHitAngle) * .3 * recoil, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 4, qa);
      }
      if (stagger > 0 && !state.dead && !dodge) {
        // Stagger / parried / guard broken: thrown off balance (arms wide), a beat of helplessness, then recovery.
        nextMode = 'stagger'; fade = .05;
        if (staggerTime < .5) { sample('hitChest', clamp(stagger, 0, 1) * clip('hitChest').duration, wanted, false); spineLayer(wanted, -Math.sin(lastHitAngle) * .3 * (1 - stagger), -.42 * (1 - smooth(stagger)), 0); }
        else {
          var st = stagger < .3 ? easeOut(stagger / .3) * .46 : stagger < .6 ? .46 + (stagger - .3) / .3 * .1 : .56 + smooth((stagger - .6) / .4) * .5;
          sample('shieldBreak', st, wanted, false);
          spineLayer(wanted, -Math.sin(lastHitAngle) * .35 * (1 - stagger), -.3 * (1 - smooth(stagger / .8)), 0);
        }
      }
      if (leap > 0 && !dodge && !strikePhase) { nextMode = 'leap'; sample('jump', 0, wanted, false); }
      if (dodge > 0) {
        // Roll: the dive and tumble fill the invulnerable window exactly; the rise begins as protection ends.
        nextMode = 'roll'; fade = .035;
        var iEnd = clamp(finite(state.iframeEnd, .81), .3, .98);
        var rollTime = dodge < iEnd ? .06 + .80 * Math.pow(dodge / iEnd, .9) : .86 + .27 * (dodge - iEnd) / (1 - iEnd);
        sample('roll', rollTime, wanted, false);
        var dodgeYaw = Number.isFinite(state.dodgeDirection) ? signedAngle(state.dodgeDirection - rootYaw) : 0;
        yawPose(wanted, dodgeYaw);
      }
      if (state.dead) {
        // Blown back by heavy blows, a collapsing stagger otherwise; the corpse slides away from the killer.
        nextMode = 'death'; fade = .07;
        var blown = deathKind === 'blown';
        if (blown) sample('hitKnockback', Math.min(clip('hitKnockback').duration, deathTime * 1.05), wanted, false);
        else sample('death', deathTime * (boss ? 1.05 : 1.75), wanted, false);
        var slide = (blown ? 1.2 : boss ? .25 : .42) * easeOut(deathTime / (blown ? .45 : .5)) / characterScale;
        wanted.p.z -= slide; yawPose(wanted, deathYaw);
      }
      // Secondary life: slow breathing, a shifting stance, the head drifting and turning toward the foe (never while striking or falling).
      if (!state.dead && !dodge && !strikePhase && !roaring && !whirling && !charging && dt > 0) {
        var still = 1 - moveWeight * .7, lt2 = clock + lifeSeed, breath = Math.sin(lt2 * lifeRate), sway = Math.sin(lt2 * .55) * Math.sin(lt2 * .31 + 1);
        shiftCur += (sway - shiftCur) * damp(3, dt);
        spineLayer(wanted, .05 * Math.sin(lt2 * .7) * still, lifeLean * breath * still, lifeSway * shiftCur * still);
        euler.set(-.03 * breath * still, 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 7, qa); rotateSubtree(wanted, 11, qa);
        wanted.p.x += .03 * shiftCur * still / Math.max(.4, characterScale); wanted.p.y += .012 * breath * still / Math.max(.4, characterScale);
        var lookWant = Number.isFinite(state.lookYaw) && !stagger ? clamp(state.lookYaw, -1.1, 1.1) : 0, lookP = Number.isFinite(state.lookYaw) && !stagger ? .06 : 0;
        lookCur += (lookWant - lookCur) * damp(hero ? 9 : 6, dt); lookPitch += (lookP - lookPitch) * damp(4, dt);
        var lookMix = (hero && moveWeight > .3 ? .35 : 1) * (state.block ? .6 : 1);
        euler.set(lookPitch + .015 * Math.sin(lt2 * 1.3), lookCur * .62 * lookMix + .04 * Math.sin(lt2 * .43), 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 4, qa);
        euler.set(0, lookCur * .18 * lookMix, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 3, qa);
      }
      // Fear survives the initial flinch as a restrained defensive posture.
      // It stays below authored attacks, hurt, stagger and death; gait clocks
      // and planted feet are unchanged, and bosses retain their composure.
      var fearEligible = !hero && !boss && !state.dead && !acting && !dodge && !leap && hurt <= .01 && !stagger,
        fearTarget = fearEligible ? clamp(finite(state.fear, 0) / .6, 0, 1) : 0;
      fearCur += (fearTarget - fearCur) * (dt > 0 ? damp(10, dt) : 0);
      motionInfo.fear = fearEligible ? fearCur : 0;
      if (fearCur > .002 && fearEligible) {
        var cower = fearCur * (1 - moveWeight * .22);
        spineLayer(wanted, -.045 * cower, .21 * cower, .025 * cower);
        euler.set(.13 * cower, 0, -.035 * cower, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 4, qa);
        euler.set(-.16 * cower, 0, .12 * cower, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 7, qa);
        if (!armed) { euler.set(0, -.13 * cower, .19 * cower, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 8, qa); }
        euler.set(-.045 * cower, 0, -.055 * cower, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 11, qa);
        wanted.p.y -= .014 * cower / Math.max(.4, characterScale);
      }
      if (nextMode !== mode) { copyPose(transition, output); mode = nextMode; modeAge = 0; } else modeAge += dt;
      if (!initialized || dt === 0) copyPose(output, wanted);
      else { copyPose(output, transition); blendPose(output, wanted, smooth((modeAge + dt) / fade)); }
      var yaw = Math.atan2(root.matrixWorld.elements[8], root.matrixWorld.elements[10]);
      turnRate += ((initialized && dt > 0 ? clamp(signedAngle(yaw - previousYaw) / dt, -6, 6) : 0) - turnRate) * damp(12, dt); previousYaw = yaw;
      if (nextMode === 'locomotion') { qTurn.setFromAxisAngle(up, -turnRate * .018); output.q[2].premultiply(qTurn); output.q[3].premultiply(qTurn); }
      // Apply world rotations in actual hierarchy order; native bone roll,
      // unusual downward pelvis axes and different parentage remain valid.
      desired.copy(output.p).sub(sourcePos[0]).multiplyScalar(characterScale).add(hipRest).applyMatrix4(root.matrixWorld);
      inverse.copy(pelvis.parent.matrixWorld).invert(); pelvis.position.copy(desired.applyMatrix4(inverse));
      for (var oi = 0; oi < order.length; oi++) {
        var entry = order[oi], node = entry.node;
        if (entry.i >= 0) {
          qDesired.copy(qRoot).multiply(output.q[entry.i]).multiply(corrections[entry.i]);
          // Same scale-aware decomposition as getWorldQuaternion, without its
          // recursive update: the preceding entries already refreshed this parent.
          node.parent.matrixWorld.decompose(parentPosition, qParent, parentScale);
          qParent.invert(); node.quaternion.copy(qParent.multiply(qDesired)).normalize();
        }
        node.updateWorldMatrix(false, false);
      }
      if (model === root || poseNodes.has(model)) refreshRest(model); else model.updateWorldMatrix(false, true);
      var motionWorld=B.app&&B.app.world,groundOffset=motionWorld&&motionWorld.effectHeightAt?motionWorld.effectHeightAt(rootNow.x,rootNow.z,0)-.035:0;
      groundOffset=Number.isFinite(groundOffset)?Math.max(0,groundOffset):0;
      var floorReference=rootNow.y+groundOffset,lowest = Infinity;
      for (var fi2 = 0; fi2 < feet.length; fi2++) {
        var foot = feet[fi2]; if (!foot.ankle || !foot.toe) continue;
        wpos(foot.ankle, va); wpos(foot.toe, vb);
        lowest = Math.min(lowest, va.y - foot.heel, vb.y - foot.toeHeight);
      }
      if (Number.isFinite(lowest)) {
        var authoredClearance = Math.max(0, Math.min(output.sole[0], output.sole[1])) * characterScale;
        moveHipY(clamp(floorReference + authoredClearance - lowest, -.45 * characterScale, .45 * characterScale));
      }
      if (dodge > 0 || (state.dead && deathKind === 'blown')) {
        var rollFloor = Infinity;
        for (var floorJoint = 0; floorJoint < 3; floorJoint++) {
          var index = floorJoint === 0 ? 0 : floorJoint === 1 ? 3 : 5;
          var joint = mapping[index]; if (!joint) continue;
          wpos(joint, va); wquat(joint, qa);
          if (index === 5) va.add(vb.set(0, .105 * characterScale, 0).applyQuaternion(qa));
          rollFloor = Math.min(rollFloor, va.y - (index === 5 ? .135 : .18) * characterScale);
        }
        if (rollFloor < floorReference + .015) moveHipY(floorReference + .015 - rollFloor);
      }
      var canPlant = initialized && dt > 0 && !teleported && !state.dead && !dodge && !leap && moveWeight > .05 && !acting && !stagger && modeAge > .1;
      for (var f = 0; f < feet.length; f++) {
        var planted = feet[f], onGround = output.sole[f] < .07;
        if (canPlant) {
          var plantWeight = onGround ? .92 * (1 - smooth(output.sole[f] / .07)) * smooth(moveWeight / .4) : 0;
          planted.weight += (plantWeight - planted.weight) * damp(30, dt);
          wpos(planted.ankle, va);
          if (!planted.locked && plantWeight > .02) { planted.anchor.copy(va); planted.locked = true; }
          if (planted.locked && planted.weight > .01) lockFoot(planted, planted.weight);
          else if (plantWeight === 0) planted.locked = false;
        } else { planted.locked = false; planted.weight = 0; }
      }
      if (weapon && mapping[13]) {
        qDesired.copy(qRoot).multiply(output.q[13]).multiply(qBlade);
        wquat(weapon.parent, qParent).invert(); weapon.quaternion.copy(qParent.multiply(qDesired)); weapon.updateWorldMatrix(false, true);
        // Resolve only a grounded attacking wrist: long blades share the authored cut,
        // but their actual striking end must stop above the floor rather than disappear
        // through it. The soft boundary has zero slope at entry; no pelvis, footplant,
        // weapon scale, anticipation/contact clock or ordinary spear thrust is changed.
        if (hero && bladeTip && (swinging || charging) && !leap && !dodge && !stagger && !state.dead) {
          wpos(bladeTip, va); wpos(mapping[13], vb);
          var floorGap = floorReference + .04 - va.y;
          if (floorGap > 0) {
            bladeFloorV.copy(va).sub(vb);
            var bladeLen = bladeFloorV.length(), horizontal = Math.hypot(bladeFloorV.x, bladeFloorV.z),
              tipRise = floorGap * floorGap / (floorGap + .02), tipY = bladeFloorV.y + tipRise;
            if (bladeLen > .1 && horizontal > .001 && Math.abs(tipY) < bladeLen) {
              var horizontalScale = Math.sqrt(Math.max(0, bladeLen * bladeLen - tipY * tipY)) / horizontal;
              bladeFloorTarget.set(bladeFloorV.x * horizontalScale, tipY, bladeFloorV.z * horizontalScale);
              bladeFloorQ.setFromUnitVectors(bladeFloorV.normalize(), bladeFloorTarget.normalize());
              qa.copy(invRoot).multiply(bladeFloorQ).multiply(qRoot); rotateSubtree(output, 13, qa);
              wquat(mapping[13], qDesired).premultiply(bladeFloorQ);
              wquat(mapping[13].parent, qParent).invert(); mapping[13].quaternion.copy(qParent.multiply(qDesired)).normalize();
              mapping[13].updateWorldMatrix(false, true);
              qDesired.copy(qRoot).multiply(output.q[13]).multiply(qBlade);
              wquat(weapon.parent, qParent).invert(); weapon.quaternion.copy(qParent.multiply(qDesired)); weapon.updateWorldMatrix(false, true);
            }
          }
        }
      }
      if (initialized && dt > 0 && !teleported) {
        if (canPlant && Math.floor(oldGait * 2) !== Math.floor(gait * 2)) {
          var landingSide = Math.abs(Math.floor(gait * 2)) % 2; emit(feet[landingSide], clamp(speed / (4 * characterScale), .25, .85));
        }
        if (previousDodge > 0 && dodge === 0) emit(feet[0], .95, 'roll');
      }
      motionInfo.clip = nextMode; motionInfo.phase = attack || dodge || wrap(gait); motionInfo.strike = strikePhase;
      rootBefore.copy(rootNow); previousDodge = dodge; initialized = true;
      if (state.dead && dt > 0 && mode === 'death' && modeAge > fade) {
        var settleAt = Math.max(2.2, .3 + (deathKind === 'blown' ? clip('hitKnockback').duration / 1.05 : clip('death').duration / (boss ? 1.05 : 1.75)));
        if (deathTime > settleAt) settled = true;
      }
      // Every node below the root now carries its final world matrix for this pose (see combat.js guardRenderMatrices).
      motionInfo.refreshed = true; motionInfo.px = root.position.x; motionInfo.py = root.position.y; motionInfo.pz = root.position.z; motionInfo.ry = root.rotation.y;
    }
    animate(0, {});
    return { animate: animate, bones: armAliases, dispose: function () { disposed = true; } };
  }
  // Whirlwind body yaw (radians to add to the root; u = 0..1 over the spin). Speed eases in over the first 12 %, cruises, brakes over u .50-.78 so the body is planted
  // for the last tick and its overhead slam (WHIRL_HIT / 1.3 = .76), and the angle ends on exactly `turns` full turns: the root lands on its resting heading with no jump.
  // With turns = 2 the peak is ~2.5 turns/s (the cruise speed for a 1.3 s spin).
  var SPIN_TAB = (function () {
    var t = [0]; for (var i = 1; i <= 96; i++) { var u = i / 96; t.push(t[i - 1] + smooth(u / .12) * (1 - smooth((u - .5) / .28))); } return t.map(function (v) { return v / t[96]; });
  })();
  function whirlAngle(u, turns) { var f = clamp(u, 0, 1) * 96, i = Math.min(95, Math.floor(f)); return (SPIN_TAB[i] + (SPIN_TAB[i + 1] - SPIN_TAB[i]) * (f - i)) * turns * TAU; }
  B.AuthoredMotion = { create: create, moves: MOVES, strides: STRIDE, whirlAngle: whirlAngle };
})();
