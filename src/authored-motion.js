/* KARA GEÇİT — Quaternius animation retargeted onto the native artist rigs, with an authored combat layer.
 * Every attack is a timed "move": a quick snap into the chamber, a held coil (enemies tremble so the tell reads),
 * an accelerating swing whose blade crosses the forward plane exactly on the damage frame, an overshooting
 * follow-through and a recovery. Moves are cut from the CC0 clips (optionally mirrored) and shaped with rigid
 * spine layers. Also: stagger, directional flinch, blown-back deaths and a roll whose i-frames read.
 * Source clips are CC0; compact motion data and licence ship with the game (assets/characters/). */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, D = B.AuthoredClips;
  var PI = Math.PI, TAU = PI * 2;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function finite(x, fallback) { return Number.isFinite(x) ? x : fallback; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function easeOut(x, p) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, p || 3); }
  function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
  function wrap(x) { return x - Math.floor(x); }
  function signedAngle(x) { return Math.atan2(Math.sin(x), Math.cos(x)); }
  var decoded = Object.create(null), sourceRest = [], sourcePos = [];
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
    // The hero's heavy blow: the same arc as spin, played for a .70 s / contact .35 s swing with no held coil (snapK: the wind-up
    // uses 88% of its time, ease: a gentle deceleration into the chamber) and one continuous ease from contact to the end pose (flow).
    heavy: { clip: 'attackC', start: .24, chamber: .58, contact: .686, follow: .80, end: 1.2, swing: .12, over: .5, twist: -.55, bend: -.1, strikeBend: .18, hold: 0, snapK: .88, ease: 1.7, flow: 1.5 },
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
    stab: { clip: 'attackA', chamber: .19, contact: .25, follow: .30, end: .62, swing: .075, over: .25, twist: -.25, bend: -.12, strikeBend: .42, tremble: .04, hold: .1 },
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
  function heroMove(combo, heavy) { return heavy ? MOVES.heavy : combo === 2 ? MOVES.cleave : combo === 1 ? MOVES.slashB : MOVES.slashA; }
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
    var root = options.root, model = options.modelScene || root, type = options.type || 'hero', supplied = options.bones || {};
    var weapon = options.weapon, all = Object.create(null), mapping = [], nativeRest = [], targetRef = [], targetPos = [], originalLocal = [];
    var armed = type === 'hero' || type === 'boss' || type === 'guard', boss = type === 'boss', hero = type === 'hero';
    var qRoot = new T.Quaternion(), invRoot = new T.Quaternion(), qParent = new T.Quaternion(), qa = new T.Quaternion(), qb = new T.Quaternion();
    var qDesired = new T.Quaternion(), qTurn = new T.Quaternion(), qBlade = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), PI / 2);
    var up = new T.Vector3(0, 1, 0), va = new T.Vector3(), vb = new T.Vector3(), desired = new T.Vector3(), euler = new T.Euler(0, 0, 0, 'YXZ');
    var inverse = new T.Matrix4(), rootNow = new T.Vector3(), rootBefore = new T.Vector3(), velocity = new T.Vector3(), localVelocity = new T.Vector3();
    var wanted = pose(), extra = pose(), output = pose(), transition = pose(), locomotion = pose(), mirrored = pose(), roarBuf = pose();
    var clock = 0, gait = 0, moveWeight = 0, speed = 0, mode = '', modeAge = 0, previousAttack = 0, comboMemory = -1, legacySerial = 0;
    var deathTime = 0, deathYaw = 0, deathKind = '', hurtTime = 2, previousHurt = 0, previousDodge = 0, previousYaw = 0, turnRate = 0, rollRecover = 9;
    var initialized = false, disposed = false, wasDead = false, lastHitAngle = 0, lookCur = 0, lookPitch = 0, lifeSeed = Math.random() * 40, shiftCur = 0, legYawCur = 0, backwardMotion = false;
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
      for (var j = 0; j < D.bones.length; j++) {
        var aa = ia + 3 + j * 4, bb = ib + 3 + j * 4, s = D.rotationScale;
        destination.q[j].set(values[aa] / s, values[aa + 1] / s, values[aa + 2] / s, values[aa + 3] / s).normalize();
        qa.set(values[bb] / s, values[bb + 1] / s, values[bb + 2] / s, values[bb + 3] / s).normalize(); destination.q[j].slerp(qa, t);
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
      var w = [.28, .36, .36];
      for (var k = 0; k < 3; k++) { euler.set(bend * w[k], twist * w[k], (side || 0) * w[k], 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 1 + k, qa); }
    }
    function yawPose(p, angle) {
      if (Math.abs(angle) < 1e-4) return;
      qTurn.setFromAxisAngle(up, angle);
      for (var i = 0; i < p.q.length; i++) p.q[i].premultiply(qTurn);
      p.p.sub(sourcePos[0]).applyQuaternion(qTurn).add(sourcePos[0]);
    }
    function emit(foot, strength, kind) {
      foot.ankle.getWorldPosition(va); footfall.serial++; footfall.side = foot.side;
      footfall.x = va.x; footfall.z = va.z; footfall.strength = clamp(strength, .15, 1); footfall.kind = kind || 'step';
    }
    function moveHipY(amount) {
      if (Math.abs(amount) < .00001) return;
      pelvis.getWorldPosition(va); va.y += amount; inverse.copy(pelvis.parent.matrixWorld).invert(); pelvis.position.copy(va.applyMatrix4(inverse));
      pelvis.updateWorldMatrix(false, true);
    }
    var hipPoint = new T.Vector3(), kneePoint = new T.Vector3(), anklePoint = new T.Vector3(), reach = new T.Vector3(), bend = new T.Vector3(), kneeGoal = new T.Vector3();
    // A small contact correction preserves the authored pose while holding the
    // supporting sole in world space as the gameplay capsule moves over it.
    function lockFoot(foot, weight) {
      if (!foot.upper || !foot.lower || !foot.ankle || weight < .001) return;
      foot.upper.getWorldPosition(hipPoint); foot.lower.getWorldPosition(kneePoint); foot.ankle.getWorldPosition(anklePoint); foot.ankle.getWorldQuaternion(foot.orientation);
      desired.copy(anklePoint).lerp(foot.anchor, weight); desired.y = anklePoint.y;
      var a = hipPoint.distanceTo(kneePoint), b = kneePoint.distanceTo(anklePoint);
      reach.copy(desired).sub(hipPoint); var length = clamp(reach.length(), Math.abs(a - b) + .001, a + b - .002 * characterScale); reach.normalize();
      bend.copy(kneePoint).sub(hipPoint).addScaledVector(reach, -bend.dot(reach));
      if (bend.lengthSq() < .00001) bend.set(0, 0, 1).applyQuaternion(qRoot).addScaledVector(reach, -bend.dot(reach));
      bend.normalize(); var along = (a * a + length * length - b * b) / (2 * length);
      kneeGoal.copy(hipPoint).addScaledVector(reach, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
      va.copy(kneePoint).sub(hipPoint).normalize(); vb.copy(kneeGoal).sub(hipPoint).normalize(); qa.setFromUnitVectors(va, vb);
      foot.upper.getWorldQuaternion(qDesired); qDesired.premultiply(qa); foot.upper.parent.getWorldQuaternion(qParent).invert(); foot.upper.quaternion.copy(qParent.multiply(qDesired)); foot.upper.updateWorldMatrix(false, true);
      foot.lower.getWorldPosition(kneePoint); foot.ankle.getWorldPosition(anklePoint); va.copy(anklePoint).sub(kneePoint).normalize(); vb.copy(desired).sub(kneePoint).normalize(); qa.setFromUnitVectors(va, vb);
      foot.lower.getWorldQuaternion(qDesired); qDesired.premultiply(qa); foot.lower.parent.getWorldQuaternion(qParent).invert(); foot.lower.quaternion.copy(qParent.multiply(qDesired)); foot.lower.updateWorldMatrix(false, true);
      foot.ankle.parent.getWorldQuaternion(qParent).invert(); foot.ankle.quaternion.copy(qParent.multiply(foot.orientation)); foot.ankle.updateWorldMatrix(false, true);
    }
    // Clip time and layer weights of a move at time t (s) whose contact is at Tc and which ends at Tend.
    var curve = { ct: 0, coil: 0, strike: 0, hold: 0, phase: '' };
    function moveCurve(m, t, Tc, Tend) {
      var swing = Math.min(m.swing, Tc * .62), A = Math.max(.001, Tc - swing), follow = Math.min(swing * 1.7, Math.max(.03, Tend - Tc) * .55);
      var snap = Math.min(A * (m.snapK || .72), hero ? A * (m.snapK || .72) : .3), c0 = m.start || 0, u;
      curve.hold = 0;
      if (t < snap) { u = easeOut(t / snap, m.ease); curve.ct = c0 + (m.chamber - c0) * u; curve.coil = .8 * u; curve.strike = 0; curve.phase = 'wind'; }
      else if (t < A) { u = (t - snap) / Math.max(.001, A - snap); curve.ct = m.chamber; curve.coil = .8 + .2 * u * u; curve.strike = 0; curve.hold = u; curve.phase = 'hold'; }
      else if (t < Tc) { u = (t - A) / swing; curve.ct = m.chamber + (m.contact - m.chamber) * u * u; curve.coil = 1 - u; curve.strike = u * u; curve.phase = 'swing'; }
      else if (t < Tc + follow) { u = easeOut((t - Tc) / follow, 2); curve.ct = m.contact + (m.follow - m.contact) * u; curve.coil = -m.over * u; curve.strike = 1; curve.phase = 'follow'; }
      else {
        u = clamp((t - Tc - follow) / Math.max(.001, Tend - Tc - follow), 0, 1); var h = m.hold || 0, v = u < h ? 0 : smooth((u - h) / (1 - h));
        curve.ct = m.follow + (m.end - m.follow) * v + (u < h ? (m.end - m.follow) * .06 * u / Math.max(.01, h) : 0);
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
    function roarPose(p, t, Tr, Td) {
      var span = Math.max(.05, Td - Tr), rw = Math.min(.14, span * .5), fw = Math.min(.22, span * .6);   // release ramp and settle scale with a short roar
      var g = smooth(t / Math.max(.05, Tr)), rel = t >= Tr ? easeOut((t - Tr) / rw, 2) : 0, fade = t > Td - fw ? smooth((Td - t) / fw) : 1;
      var shake = rel > 0 && t < Td - fw * 1.1 ? Math.sin(clock * 47) * .035 * fade : 0;
      var gather = g * (1 - rel);
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
    function whirlPose(p, u, t, dt, yaw) {
      var D = u > .001 ? t / u : WHIRL_D, tt = t * WHIRL_D / clamp(D, .4, 3), inv = 1 / Math.max(.4, characterScale);
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
      var legW = clamp(.5 * Math.max(spin, coil) + .35 * hold, 0, .85);
      sample('crouch', 0, wLegs, false); blendPose(p, wLegs, legW, 14, 22); blendPose(p, wLegs, legW * .8, 0, 0);
      wGait += dt * 1.9; sample('jog', wrap(wGait) * clip('jog').duration, wArm, true); blendPose(p, wArm, .3 * spin * (1 - hold), 14, 22);
      // torso: wound back in the coil, trailing in the spin, leaning forward and into the turn, bowed over the slam
      spineLayer(p, -.7 * coil - .55 * wLag * spin, .16 * coil + .28 * spin * (1 - fin) - .2 * raise * (1 - slam) + .5 * hold + .1 * punch * spin, .13 * spin * (1 - fin));
      p.p.y -= (.07 * Math.max(spin, coil * .7) + .06 * hold + .035 * punch * spin) * inv;
      // free arm: thrown wide and leading the turn (counter-swing), drawn in for the slam
      var wide = smooth((tt - .04) / .16) * (1 - .8 * fin);
      euler.set(-.15 * wide, 0, 1.25 * wide, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 7, qa);
      euler.set(0, 0, -.35 * wide, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 8, qa);
      yawSub(p, 7, wLag * .9 * wide);
      // cleaver arm: hauled back in the coil -> out level, trailing the turn -> overhead -> slam; the target directions are slerped, the rotation from the ready pose is a weight
      var phi = .2 - wLag * 1.3;
      wt.copy(W_COIL_T); wu.set(-Math.cos(phi), .04, Math.sin(phi)).normalize(); slerpV(wt, wt, wu, smooth((tt - .1) / .14)); slerpV(wt, wt, W_OVER_T, raise); slerpV(wt, wt, W_SLAM_T, slam);
      wb.copy(W_COIL_B); wu2.set(-Math.cos(phi + .12), .07, Math.sin(phi + .12)).normalize(); slerpV(wb, wb, wu2, smooth((tt - .1) / .14)); slerpV(wb, wb, W_OVER_B, raise); slerpV(wb, wb, W_SLAM_B, slam);
      aimCleaver(p, smooth(tt / .1) * keep, wt, wb, 1);
      // head: counter-turned against the body yaw (a smooth 'lock' on the start heading, sin keeps it continuous through the turn), chin tucked
      var rel = signedAngle(wLock - yaw), look = .7 * Math.sin(rel) * spin;
      euler.set(.12 * spin - .05 * hold, look, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(p, 4, qa);
      wFlare = spin * clamp(Math.abs(wOmega) / 14, 0, 1);
      root.userData.whirlFlare = wFlare;
    }
    function applyMove(m, t, Tc, Tend, destination, state) {
      var c = moveCurve(m, t, Tc, Tend);
      if (m.roar) { roarPose(destination, t, Tc, Tend); curve.phase = t < Tc ? 'hold' : 'follow'; return curve; }
      if (m.rush && t >= Tc) {
        // A charge: the body is thrown forward in a sprint while the capsule rushes along the telegraphed line.
        var run = clamp((t - Tc) / Math.max(.05, finite(state.rushTime, .3)), 0, 1);
        sample(run < 1 ? m.rush : 'zombieScratch', run < 1 ? wrap(run * 1.6) * clip(m.rush).duration : .72, destination, run < 1);
        spineLayer(destination, 0, m.strikeBend * (run < 1 ? 1 : .6), 0); return c;
      }
      if (m.leap && t >= Tc - m.swing) {
        // Pounce: coiled crouch, airborne reach, then a clawing landing that recoils into the recovery.
        var air = clamp((t - (Tc - m.swing)) / m.swing, 0, 1);
        if (air < 1) { sample('jump', 0, destination, false); spineLayer(destination, 0, .25 - .35 * air, 0); }
        else { sample('land', clamp((t - Tc) * 1.6, 0, clip('land').duration), destination, false); sample('meleeHook', .30, extra, false); blendPose(destination, extra, .55 * (1 - smooth((t - Tc) / .5)), 1, 14); }
        return c;
      }
      sampleMove(m, c.ct, destination);
      var tremble = (m.tremble || 0) * c.hold * (boss ? .7 : 1), shake = tremble ? Math.sin(clock * 53) * tremble : 0;
      spineLayer(destination, m.twist * c.coil + shake * .7, m.bend * Math.max(0, c.coil) + m.strikeBend * c.strike + shake, 0);
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
      if (state.reset) {
        initialized = false; clock = finite(state.time, 0); gait = 0; speed = 0; moveWeight = 0; mode = ''; modeAge = 0; deathTime = 0; deathYaw = 0; deathKind = '';
        hurtTime = 2; previousHurt = 0; previousAttack = 0; comboMemory = -1; previousDodge = 0; wasDead = false; turnRate = 0; footfall.serial = 0; rollRecover = 9; lookCur = 0; lookPitch = 0; shiftCur = 0; legYawCur = 0; backwardMotion = false;
        originalLocal.forEach(function (r) { r.node.position.copy(r.p); r.node.quaternion.copy(r.q); }); feet.forEach(function (f) { f.locked = false; f.weight = 0; });
      }
      // Only the pelvis ancestry is read before applying the new pose. Keep
      // rigid root siblings (chains/hooks) current; the model subtree is refreshed
      // after retargeting, so visiting its old pose here would be duplicate work.
      pelvis.parent.updateWorldMatrix(true, false);
      for (var earlyChild = 0; earlyChild < root.children.length; earlyChild++) {
        if (root.children[earlyChild] !== model) root.children[earlyChild].updateWorldMatrix(false, true);
      }
      root.getWorldPosition(rootNow); root.getWorldQuaternion(qRoot); invRoot.copy(qRoot).invert();
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
      var roaring = hero && finite(state.roarTime, -1) >= 0, whirling = hero && finite(state.whirl, -1) >= 0;
      var swinging = attack > 0 || finite(state.attackTime, -1) >= 0 || finite(state.beatTime, -1) >= 0, acting = swinging || roaring || whirling;
      if (moveWeight > .02 && !swinging && !dodge && !state.dead) gait += dt * speed / Math.max(.3, stride) * (backward ? -1 : 1);
      var idleName = armed ? type === 'guard' ? 'shieldIdle' : 'combatIdle' : type === 'cultist' ? 'spellIdle' : 'zombieIdle';
      sample(idleName, clock, wanted, true);
      if (hero) {
        sample('idle', clock, wanted, true); sample('attackA', 0, extra, false); blendPose(wanted, extra, .78);
        for (var readyHand = 11; readyHand < 14; readyHand++) wanted.q[readyHand].copy(extra.q[readyHand]);
        for (var readyFinger = 37; readyFinger < 52; readyFinger++) wanted.q[readyFinger].copy(extra.q[readyFinger]);
      }
      if (moveWeight > .001 && !whirling) {
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
        var m = heroMove(combo, heavy); nextMode = 'attack' + finite(state.attackSerial, 0); fade = .06;
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
        roarPose(wanted, state.roarTime, finite(state.roarRelease, .3), finite(state.roarDuration, .92)); strikePhase = state.roarTime < finite(state.roarRelease, .3) ? 'hold' : 'follow';
      }
      if (whirling) { nextMode = 'whirl' + finite(state.attackSerial, 0); fade = .05; whirlPose(wanted, state.whirl, finite(state.whirlTime, 0), dt, rootYaw); strikePhase = 'follow'; } else if (wLive) { wLive = false; wFlare = 0; root.userData.whirlFlare = 0; }
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
      if (state.debugClip) { nextMode = 'debug'; sample(state.debugClip, finite(state.debugTime, 0), wanted, false); if (state.debugMirror) mirror(wanted); }
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
      if (!state.dead && !dodge && !strikePhase && !roaring && !whirling && dt > 0) {
        var still = 1 - moveWeight * .7, lt2 = clock + lifeSeed, breath = Math.sin(lt2 * (boss ? 1.5 : 2.1)), sway = Math.sin(lt2 * .55) * Math.sin(lt2 * .31 + 1);
        shiftCur += (sway - shiftCur) * damp(3, dt);
        spineLayer(wanted, .05 * Math.sin(lt2 * .7) * still, .035 * breath * still, .07 * shiftCur * still);
        euler.set(-.03 * breath * still, 0, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 7, qa); rotateSubtree(wanted, 11, qa);
        wanted.p.x += .03 * shiftCur * still / Math.max(.4, characterScale); wanted.p.y += .012 * breath * still / Math.max(.4, characterScale);
        var lookWant = Number.isFinite(state.lookYaw) && !stagger ? clamp(state.lookYaw, -1.1, 1.1) : 0, lookP = Number.isFinite(state.lookYaw) && !stagger ? .06 : 0;
        lookCur += (lookWant - lookCur) * damp(hero ? 9 : 6, dt); lookPitch += (lookP - lookPitch) * damp(4, dt);
        var lookMix = (hero && moveWeight > .3 ? .35 : 1) * (state.block ? .6 : 1);
        euler.set(lookPitch + .015 * Math.sin(lt2 * 1.3), lookCur * .62 * lookMix + .04 * Math.sin(lt2 * .43), 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 4, qa);
        euler.set(0, lookCur * .18 * lookMix, 0, 'YXZ'); qa.setFromEuler(euler); rotateSubtree(wanted, 3, qa);
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
      model.updateWorldMatrix(false, true);
      var lowest = Infinity;
      for (var fi2 = 0; fi2 < feet.length; fi2++) {
        var foot = feet[fi2]; if (!foot.ankle || !foot.toe) continue;
        foot.ankle.getWorldPosition(va); foot.toe.getWorldPosition(vb);
        lowest = Math.min(lowest, va.y - foot.heel, vb.y - foot.toeHeight);
      }
      if (Number.isFinite(lowest)) {
        var authoredClearance = Math.max(0, Math.min(output.sole[0], output.sole[1])) * characterScale;
        moveHipY(clamp(rootNow.y + authoredClearance - lowest, -.45 * characterScale, .45 * characterScale));
      }
      if (dodge > 0 || (state.dead && deathKind === 'blown')) {
        var rollFloor = Infinity;
        for (var floorJoint = 0; floorJoint < 3; floorJoint++) {
          var index = floorJoint === 0 ? 0 : floorJoint === 1 ? 3 : 5;
          var joint = mapping[index]; if (!joint) continue;
          joint.getWorldPosition(va); joint.getWorldQuaternion(qa);
          if (index === 5) va.add(vb.set(0, .105 * characterScale, 0).applyQuaternion(qa));
          rollFloor = Math.min(rollFloor, va.y - (index === 5 ? .135 : .18) * characterScale);
        }
        if (rollFloor < rootNow.y + .015) moveHipY(rootNow.y + .015 - rollFloor);
      }
      var canPlant = initialized && dt > 0 && !teleported && !state.dead && !dodge && !leap && moveWeight > .05 && !acting && !stagger && modeAge > .1;
      for (var f = 0; f < feet.length; f++) {
        var planted = feet[f], onGround = output.sole[f] < .07;
        if (canPlant) {
          var plantWeight = onGround ? .92 * (1 - smooth(output.sole[f] / .07)) * smooth(moveWeight / .4) : 0;
          planted.weight += (plantWeight - planted.weight) * damp(30, dt);
          planted.ankle.getWorldPosition(va);
          if (!planted.locked && plantWeight > .02) { planted.anchor.copy(va); planted.locked = true; }
          if (planted.locked && planted.weight > .01) lockFoot(planted, planted.weight);
          else if (plantWeight === 0) planted.locked = false;
        } else { planted.locked = false; planted.weight = 0; }
      }
      if (weapon && mapping[13]) {
        qDesired.copy(qRoot).multiply(output.q[13]).multiply(qBlade);
        weapon.parent.getWorldQuaternion(qParent).invert(); weapon.quaternion.copy(qParent.multiply(qDesired)); weapon.updateWorldMatrix(false, true);
      }
      if (initialized && dt > 0 && !teleported) {
        if (canPlant && Math.floor(oldGait * 2) !== Math.floor(gait * 2)) {
          var landingSide = Math.abs(Math.floor(gait * 2)) % 2; emit(feet[landingSide], clamp(speed / (4 * characterScale), .25, .85));
        }
        if (previousDodge > 0 && dodge === 0) emit(feet[0], .95, 'roll');
      }
      motionInfo.clip = nextMode; motionInfo.phase = attack || dodge || wrap(gait); motionInfo.strike = strikePhase;
      rootBefore.copy(rootNow); previousDodge = dodge; initialized = true;
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
