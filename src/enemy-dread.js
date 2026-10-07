/* KABİR AZABI — enemy dread pass (ajan:models). Publishes BABA.EnemyDread; ?nodread turns it off (the game then looks as before).
   Three moments of a foe's build (authored-models.js blueprint/create):
   pre(type, A)            before the body and gear are fitted: bone-offset proportions per type (long forearms and hands, long
                           necks, short shins, wide clavicles) — the licensed body is skinned onto the edited skeleton and every
                           fitted piece of gear follows it.
   apply(type, A, recipe)  after the type's own recipe (and enemy-horror.js): SWINGING pieces on new helper bones (chains with hooks,
                           padlocks and seals, torn shroud strips, dangling skulls) — skinned into the material groups the type
                           already draws (no extra draw call where the key exists), signature horrors (extra skeletal arms from
                           the back of a seer, a gravestone chained to a mason's back, a chain-draped forge seer) and, for bosses,
                           hidden 'phase-2' / 'phase-3' parts that BABA.Models.phaseVisual reveals as the fight turns.
   attach(info, ctx)       in create(): per-frame posture (hunched spines, craned heads; world-axis deltas after the animation) and a
                           damped pendulum per helper bone (gravity, inertia from the body's own motion, a spring to rest, twitch).
   BABA.Models.phaseVisual(enemyOrModel, phase, enraged): phase parts, hotter glow, bloodier skin; called by boss-framework.js. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE;
  var OFF = /[?&]nodread(&|$)/.test(location.search), TAU = Math.PI * 2;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  var EXEC = { carrier: 1, boss: 1, urchin: 1, bell: 1, gravemason: 1, ruinwarden: 1, hollowking: 1, forgesentinel: 1, ashwarden: 1, furnaceheart: 1, chainjailer: 1, verdictwarden: 1, lastjudge: 1 };
  var BOSS = { boss: 1, bell: 1, hollowking: 1, furnaceheart: 1, lastjudge: 1 };
  function rig(exec) {
    return exec ? { pelvis: 'pelvis', s1: 'spine01', s2: 'spine02', s3: 'spine03', neck: 'neck', head: 'head', clavL: 'shoulderL', clavR: 'shoulderR', armL: 'upper_armL', armR: 'upper_armR', foreL: 'forearmL', foreR: 'forearmR', handL: 'handL', handR: 'handR', thighL: 'thighL', thighR: 'thighR', shinL: 'shinL', shinR: 'shinR', footL: 'tarsalL', footR: 'tarsalR' }
      : { pelvis: 'pelvis', s1: 'spine_01', s2: 'spine_02', s3: 'spine_03', neck: 'neck_01', head: 'Head', clavL: 'clavicle_l', clavR: 'clavicle_r', armL: 'upperarm_l', armR: 'upperarm_r', foreL: 'lowerarm_l', foreR: 'lowerarm_r', handL: 'hand_l', handR: 'hand_r', thighL: 'thigh_l', thighR: 'thigh_r', shinL: 'calf_l', shinR: 'calf_r', footL: 'foot_l', footR: 'foot_r' };
  }
  // ---------------------------------------------------------------- proportions (bone offsets; L/R mirrored)
  // keys: rig roles. arm = clavicle length (upper arm offset), fore = upper arm length, hand = forearm length, fingers via hand bone offset is not used.
  var PROP = {
    prisoner: { fore: 1.06, hand: 1.14 }, guard: { arm: 1.04, hand: 1.06 }, cultist: { hand: 1.12, head: 1.08 }, carrier: { hand: 1.16, shin: .92 }, boss: { hand: 1.12 },
    drowned: { hand: 1.2, fore: 1.06, shin: .92 }, rootborn: { arm: 1.1, hand: 1.18 }, crawler: { hand: 1.14 }, urchin: { hand: 1.16, shin: .9 }, lantern: { head: 1.32, hand: 1.12 }, bell: { hand: 1.1 },
    ashbound: { hand: 1.14, shin: .9 }, shardseer: { head: 1.26, hand: 1.14 }, gravemason: { hand: 1.24, fore: 1.06, shin: .88 }, ruinwarden: { arm: 1.1 }, hollowking: { arm: 1.08, hand: 1.1 },
    emberbound: { hand: 1.12 }, chainseer: { head: 1.24, hand: 1.12 }, forgesentinel: { hand: 1.18, shin: .9 }, ashwarden: { arm: 1.1 }, furnaceheart: { arm: 1.08, hand: 1.1 },
    damned: { hand: 1.16, fore: 1.04 }, verdictseer: { head: 1.34, hand: 1.18 }, chainjailer: { hand: 1.18, shin: .88 }, verdictwarden: { arm: 1.1 }, lastjudge: { arm: 1.08, hand: 1.12 }
  };
  function pre(type, A) {
    if (OFF || !PROP[type]) return;
    try {
      var R = rig(!!EXEC[type]), P = PROP[type], f = {};
      function both(l, r, k) { if (A.has(l)) f[l] = k; if (A.has(r)) f[r] = k; }
      if (P.arm) both(R.armL, R.armR, P.arm);
      if (P.fore) both(R.foreL, R.foreR, P.fore);
      if (P.hand) both(R.handL, R.handR, P.hand);
      if (P.shin) both(R.footL, R.footR, P.shin);
      if (P.head && A.has(R.head)) f[R.head] = P.head;
      A.lengthen(f);
    } catch (e) { if (window.console) console.warn('dread pre ' + type + ': ' + (e && e.message)); }
  }
  // ---------------------------------------------------------------- posture (radians about the body's right axis; + bends forward)
  var POSTURE = {
    prisoner: { s2: .16, s3: .14, neck: -.1, head: -.14 }, cultist: { s3: .08, head: .06 }, carrier: { s2: .2, s3: .14, neck: -.12, head: -.16 },
    boss: { s3: .1, head: -.05 }, drowned: { s2: .14, s3: .16, neck: .1, head: -.1 }, urchin: { s2: .16, s3: .1, head: -.14 }, lantern: { s3: .12, neck: .22, head: -.1 },
    ashbound: { s2: .18, s3: .14, neck: -.06, head: -.16 }, shardseer: { s3: .08, neck: .18, head: -.06 }, gravemason: { s2: .24, s3: .18, neck: -.12, head: -.2 },
    emberbound: { s2: .1, s3: .08, head: -.08 }, chainseer: { s3: .1, neck: .16, head: -.06 }, forgesentinel: { s2: .18, s3: .12, head: -.16 },
    damned: { s2: .2, s3: .16, neck: -.08, head: -.18 }, verdictseer: { s3: .1, neck: .2, head: -.1 }, chainjailer: { s2: .18, s3: .12, head: -.15 },
    hollowking: { s3: .08 }, furnaceheart: { s3: .1 }, lastjudge: { s3: .06, head: .04 }, bell: { s3: .1 }
  };
  // ---------------------------------------------------------------- swinging kit per type
  // c chain(len m, links) | s strip(len, width) | k chain+hook | x chain+skull | p chain+padlock | g chain+glowing seal; at = [bone role, angle round the body (0 front), dy]
  var KIT = {
    prisoner: [['p', 's3', .25, .04, .3], ['s', 's3', 2.8, .06, .55], ['s', 's3', 3.5, .02, .5]],
    guard: [['k', 'pelvis', 1.35, .02, .42], ['x', 'pelvis', -1.2, .02, .28]],
    cultist: [['x', 'pelvis', .9, .0, .3], ['s', 's3', 2.9, .08, .7], ['s', 's3', 3.4, .08, .78], ['c', 'pelvis', -.7, 0, .36]],
    stalker: [['s', 'foreL', 0, 0, .3], ['s', 'foreR', 0, 0, .3], ['s', 's3', 3.14, .05, .45]],
    carrier: [['k', 's3', 2.6, -.1, .55], ['k', 's3', 3.7, -.12, .45], ['c', 'pelvis', 1.4, 0, .4]],
    boss: [['k', 'pelvis', 1.2, .02, .7], ['x', 'pelvis', -1.25, .02, .55], ['x', 's3', 3.4, .05, .5], ['c', 's3', 2.8, .05, .6]],
    drowned: [['s', 's3', 2.8, .04, .6], ['s', 's3', 3.5, .04, .55], ['s', 'head', 3.14, .02, .5], ['s', 'head', 2.5, .0, .42], ['s', 'head', 3.8, .0, .46], ['k', 'pelvis', 1.3, 0, .45]],
    rootborn: [['s', 'foreL', 0, 0, .45], ['s', 'foreR', 0, 0, .5], ['c', 's3', 3.0, 0, .55]],
    crawler: [['s', 's3', 3.14, 0, .45], ['s', 's2', 2.7, 0, .4]],
    urchin: [['k', 'pelvis', 1.3, 0, .5], ['k', 'pelvis', -1.3, 0, .45], ['x', 's3', 3.1, -.05, .4]],
    lantern: [['s', 'head', 3.14, .04, .75], ['s', 'head', 2.6, .02, .62], ['s', 'head', 3.7, .02, .66], ['s', 'head', 2.2, -.02, .5], ['s', 'head', 4.1, -.02, .52]],
    bell: [['k', 'pelvis', 1.0, 0, .9], ['k', 'pelvis', -1.0, 0, .85], ['x', 'pelvis', 2.6, 0, .7], ['x', 'pelvis', 3.7, 0, .75]],
    ashbound: [['s', 's3', 2.9, .05, .55], ['s', 's3', 3.4, .05, .6], ['x', 'pelvis', 1.2, 0, .3]],
    shardseer: [['s', 's3', 3.14, .1, .9], ['s', 'foreL', 0, 0, .35], ['s', 'foreR', 0, 0, .35], ['g', 'pelvis', .4, 0, .38]],
    cavefang: [['s', 's3', 3.14, 0, .4]],
    gravemason: [['c', 's3', 2.5, .1, .55], ['c', 's3', 3.8, .1, .55], ['k', 'pelvis', 1.3, 0, .45]],
    ruinwarden: [['s', 's3', 2.9, .12, .95], ['s', 's3', 3.4, .12, 1.0], ['x', 'pelvis', 1.2, 0, .5]],
    hollowking: [['s', 's3', 2.8, .12, 1.15], ['s', 's3', 3.14, .14, 1.25], ['s', 's3', 3.5, .12, 1.15], ['x', 'pelvis', 1.1, 0, .7], ['x', 'pelvis', -1.1, 0, .65]],
    emberbound: [['g', 'pelvis', 1.2, 0, .36], ['c', 'pelvis', -1.2, 0, .32]],
    chainseer: [['k', 'foreL', 0, 0, .55], ['k', 'foreR', 0, 0, .55], ['g', 'armL', 0, 0, .45], ['g', 'armR', 0, 0, .45], ['k', 's3', 2.7, .05, .7], ['k', 's3', 3.6, .05, .75], ['c', 'pelvis', .3, 0, .5], ['c', 'pelvis', -.3, 0, .45]],
    slagcrawler: [['c', 's3', 3.14, 0, .4], ['g', 's2', 2.6, 0, .3]],
    forgesentinel: [['k', 'pelvis', 1.3, 0, .55], ['g', 'pelvis', -1.3, 0, .5], ['c', 's3', 3.0, 0, .55]],
    ashwarden: [['k', 'pelvis', 1.25, 0, .7], ['g', 'pelvis', -1.25, 0, .6], ['s', 's3', 3.14, .1, .9]],
    furnaceheart: [['k', 'pelvis', 1.1, 0, .9], ['k', 'pelvis', -1.1, 0, .85], ['g', 's3', 2.7, .05, .7], ['g', 's3', 3.6, .05, .7]],
    damned: [['p', 's3', .05, .06, .32], ['s', 'pelvis', 2.8, 0, .4], ['c', 'handL', 0, 0, .3], ['c', 'handR', 0, 0, .3]],
    verdictseer: [['g', 'pelvis', .9, 0, .5], ['s', 's3', 2.9, .1, .8], ['s', 's3', 3.4, .1, .85]],
    voidcrawler: [['s', 's3', 3.14, 0, .45]],
    chainjailer: [['k', 'pelvis', 1.2, 0, .6], ['k', 'pelvis', -1.2, 0, .6], ['p', 's3', 0, .02, .4], ['c', 's3', 3.4, 0, .5]],
    verdictwarden: [['g', 'pelvis', .25, 0, .7], ['k', 'pelvis', 1.3, 0, .6], ['x', 'pelvis', -1.3, 0, .6]],
    lastjudge: [['g', 'pelvis', 1.2, 0, .9], ['g', 'pelvis', -1.2, 0, .9], ['x', 's3', 2.8, .05, .8], ['x', 's3', 3.5, .05, .8]]
  };
  // signature horrors (one per chapter, plus every boss): see apply()
  // the licensed body has a clean, handsome mannequin face: types that show it get a blood-soaked rag bound over the eyes
  var BLIND = { ashbound: 1, emberbound: 1, rootborn: 1, guard: 0 };
  var SIGNATURE = { cultist: 'arms', lantern: 'neckhair', gravemason: 'stone', chainseer: 'draped', verdictseer: 'arms' };

  function apply(type, A, recipe) {
    if (OFF || !B.Gear) return null;
    var G = B.Gear, exec = !!EXEC[type], R = rig(exec), mats = recipe.materials || (recipe.materials = {}), info = { type: type, swing: [], posture: POSTURE[type] || null, phases: !!BOSS[type], rig: R };
    var keys = {}; A.parts.forEach(function (p) { keys[p.key] = 1; }); Object.keys(mats).forEach(function (k) { keys[k] = 1; });
    function has(k) { return !!keys[k]; }
    function pickKey(list, fallback) { for (var i = 0; i < list.length; i++) if (has(list[i])) return list[i]; return fallback; }
    var ironKey = pickKey(['iron', 'dark'], 'dark'), ragKey = pickKey(['rag', 'burlap', 'robe', 'bandage', 'tabard', 'vestment'], 'rag'), boneKey = pickKey(['bone', 'ash'], 'bone'),
      glowKey = pickKey(['glow', 'sea-glow', 'ember', 'verdict-fire'], null);
    if (!glowKey) { glowKey = 'ember'; }
    var skinKeys = has('skin') ? ['skin'] : null;
    function P(role) { var n = R[role]; return n && A.has(n) ? A.P(n) : null; }
    var hp = P('head'), pp = P('pelvis'); if (!hp || !pp) return info;
    var sc = Math.max(.6, (hp.y - pp.y) / .62);
    // a point on the body surface round a bone: angle a (0 = front, + toward the left side), height offset dy, lifted out by `out`
    function surface(role, a, dy, out) {
      var c = P(role); if (!c) return null; c.y += dy * sc;
      var far = c.clone().add(V(Math.sin(a) * .7 * sc, 0, Math.cos(a) * .7 * sc)), q = A.nearest(far, skinKeys);
      var base = q ? V(q.x, q.y, q.z) : c.clone().add(V(Math.sin(a) * .15 * sc, 0, Math.cos(a) * .15 * sc));
      if (Math.abs(base.y - c.y) > .12 * sc) base.y = c.y;
      return base.add(V(Math.sin(a) * (out || .02) * sc, 0, Math.cos(a) * (out || .02) * sc));
    }
    var nSwing = 0;
    function swingBone(role, at, rec) {
      var name = 'dread_' + (nSwing++); A.addBone(name, R[role], at);
      rec.bone = name; rec.len = rec.len || .3; info.swing.push(rec); return A.index[name];
    }
    function chainGeo(at, len, size, tail) {
      var parts = [], n = Math.max(3, Math.round(len / (size * 1.25)));
      for (var i = 0; i < n; i++) { var g = G.link(size); if (i % 2) g.rotateY(Math.PI / 2); g.translate(at.x, at.y - size * .55 - i * size * 1.22, at.z); parts.push(g); }
      return { geo: G.merge(parts), end: V(at.x, at.y - n * size * 1.22, at.z) };
    }
    function hookGeo(p, s) { var h = G.hook(), list = []; Object.keys(h.parts).forEach(function (k) { h.parts[k].forEach(function (g) { list.push(g); }); }); var g = G.merge(list); g.scale(s, s, s); g.translate(p.x, p.y - .02 * s, p.z); return g; }
    function skullGeo(p, s) { var k = G.skull(s, true), bone = G.merge(k.parts.bone || []), vd = k.parts.void && k.parts.void.length ? G.merge(k.parts.void) : null; bone.translate(p.x, p.y - s * .9, p.z); if (vd) vd.translate(p.x, p.y - s * .9, p.z); return { bone: bone, void: vd }; }
    function add(kind, role, ang, dy, len) {
      if (!R[role] || !A.has(R[role])) return;
      var limb = /^(fore|arm|hand)/.test(role), at;
      if (limb) { var a = P(role), t = A.tail(R[role]) || a; at = a.clone().lerp(t, role === 'handL' || role === 'handR' ? .2 : .55); at.y -= .03 * sc; }
      else if (role === 'head') { var hc = P('head'); at = surface('head', ang, dy + .06, .015) || hc; }
      else at = surface(role, ang, dy, kind === 's' ? .025 : .035);
      if (!at) return;
      len *= sc;
      var stiff = kind === 's' ? .3 : .12, rec = { gravity: true, len: len, grav: 1, stiff: stiff, damp: kind === 's' ? .9 : .965, dir: [0, -1, 0], max: kind === 's' ? 1.0 : 1.25 }, j = swingBone(role, at, rec);
      if (kind === 's') {
        // a torn shroud strip: top rigid to its bone, the lower part skinned to the pendulum (it swings, the top stays put)
        var w = (limb ? .07 : .1) * sc, out = V(Math.sin(ang), 0, Math.cos(ang)), jp = A.index[R[role]];
        if (limb) out.set(0, 0, -1);
        var g = G.sheet(3, 10, function (u, v) { var x = (u - .5) * w * (1 - v * .4); return [at.x + out.z * x + out.x * (v * .03 * sc), at.y - v * len, at.z - out.x * x + out.z * (v * .03 * sc) + Math.sin(v * 7 + nSwing) * .01 * sc]; }, false);
        G.wear(g, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .55, width: .03, bottom: .3, base: .02 } });
        A.weighted(ragKey, g, function (vv) { var t = Math.min(1, Math.max(0, (at.y - vv.y) / (len * .08))); return [[jp, 1 - t], [j, t]]; });
        return;
      }
      var size = (kind === 'c' ? .055 : .05) * sc, ch = chainGeo(at, len, size);
      A.rigid(ironKey, ch.geo, j);
      if (kind === 'k') A.rigid(ironKey, hookGeo(ch.end, 1.1 * sc), j);
      else if (kind === 'x') { var sk = skullGeo(ch.end, .11 * sc); A.rigid(boneKey, sk.bone, j); if (sk.void) A.rigid(has('void') ? 'void' : ironKey, sk.void, j); }
      else if (kind === 'p') { var pl = G.box(.06 * sc, .07 * sc, .025 * sc, [ch.end.x, ch.end.y - .04 * sc, ch.end.z]); A.rigid(ironKey, G.merge([pl, G.ring(.022 * sc, .006 * sc, [ch.end.x, ch.end.y, ch.end.z], [0, 0, 0], 5, 10)]), j); }
      else if (kind === 'g') { var sg = G.sphere(.045 * sc, [ch.end.x, ch.end.y - .04 * sc, ch.end.z], [1, 1, .45], 10, 6); A.rigid(glowKey, sg, j); }
    }
    // de-cartoon grade: darker, dirtier, harder-contrast skin and bone, grimier cloth (each material once, shared ones included)
    try {
      var seen = []; Object.keys(keys).forEach(function (k) {
        var m = mats[k]; if (!m) { try { m = /^(phase-|hero-)/.test(k) ? null : B.Models.gearMaterial(k); } catch (e) { m = null; } }
        if (!m || seen.indexOf(m) >= 0 || m.userData.dreadGraded) return; seen.push(m); m.userData.dreadGraded = true;
        var u = m.userData.grade; if (!u || !u.kTint) return;
        var cls = /skin|flesh/.test(k) ? 'skin' : /bone|ash/.test(k) ? 'bone' : /rag|burlap|robe|bandage|tabard|sash|linen|rope|vestment/.test(k) ? 'cloth' : '';
        if (cls === 'skin') { var tv = u.kTint.value, mx = Math.max(tv.r, tv.g, tv.b, .01); tv.multiplyScalar(Math.min(.8, (B.ActiveChapter === 2 ? .68 : .6) / mx)); /* the moonlit coast keeps a little more value */ u.kGrime.value = Math.max(u.kGrime.value, .62); u.kContrast.value = Math.max(u.kContrast.value, 1.16); u.kSat.value *= .85; u.kBlood.value = Math.min(1, u.kBlood.value + .1); }
        else if (cls === 'bone') { u.kTint.value.multiplyScalar(.6); u.kSat.value *= .7; u.kGrime.value = Math.max(u.kGrime.value, .62); u.kContrast.value = Math.max(u.kContrast.value, 1.1); }
        else if (/brass|gold/.test(k)) { u.kTint.value.multiplyScalar(.62); u.kGrime.value = Math.max(u.kGrime.value, .55); if (u.kRust) u.kRust.value = Math.max(u.kRust.value, .12); }   // tarnished, not toy-gold
        else if (cls === 'cloth') { u.kTint.value.multiplyScalar(.86); u.kGrime.value = Math.max(u.kGrime.value, .62); }
      });
    } catch (e) { if (window.console) console.warn('dread grade ' + type + ': ' + (e && e.message)); }
    (KIT[type] || []).forEach(function (k) { try { add(k[0], k[1], k[2], k[3], k[4]); } catch (e) { if (window.console) console.warn('dread ' + type + ' ' + k[0] + ': ' + (e && e.message)); } });
    if (BLIND[type]) try {
      var hcl = A.cloud([R.head], skinKeys, .5); if (hcl.length > 20) {
        var hb = A.box(hcl), hc2 = hb.getCenter(new T.Vector3()), rx = (hb.max.x - hb.min.x) * .5 + .012 * sc, rz = (hb.max.z - hb.min.z) * .5 + .012 * sc, ey = hc2.y + (hb.max.y - hb.min.y) * .06;
        var band = G.sheet(36, 3, function (u, v) { var a = u * TAU, wob = Math.sin(a * 3 + 1) * .008 * sc; return [hc2.x + Math.sin(a) * rx, ey + (v - .5) * .055 * sc + wob - (Math.cos(a) < -.3 ? .02 * sc : 0), hc2.z + Math.cos(a) * rz]; }, true);
        var tail = G.sheet(2, 6, function (u, v) { return [hc2.x + .02 * sc + (u - .5) * .04 * sc, ey - v * .2 * sc, hc2.z - rz - .004 * sc - v * .04 * sc]; }, false);
        [band, tail].forEach(function (g) { G.wear(g, { edge: 0, cavity: 0, border: 0, curv: 0, paint: function (q) { return q.z > hc2.z ? .55 : .2; }, tear: { amount: .4, width: .012, bottom: .3, base: .01 } }); });
        A.rigid(ragKey, G.merge([band, tail]), R.head);
      }
    } catch (e) { if (window.console) console.warn('dread blind ' + type + ': ' + (e && e.message)); }
    try { signature(SIGNATURE[type]); } catch (e) { if (window.console) console.warn('dread signature ' + type + ': ' + (e && e.message)); }
    if (BOSS[type]) try { bossParts(); } catch (e) { if (window.console) console.warn('dread boss ' + type + ': ' + (e && e.message)); }

    function signature(kind) {
      if (!kind) return;
      var s3 = P('s3');
      if (kind === 'arms') {
        // two long skeletal arms burst from between the shoulder blades, reaching forward over the shoulders; they twitch
        [-1, 1].forEach(function (sd) {
          var root = surface('s3', Math.PI - sd * .5, .04, .005) || s3.clone(), dir = V(sd * .55, .55, .62).normalize(), L = .62 * sc;
          var j = swingBone('s3', root, { len: L, grav: .12, stiff: .55, damp: .86, dir: [dir.x, dir.y, dir.z], max: .5, twitch: .12 });
          var elbow = root.clone().add(V(sd * .2 * sc, .32 * sc, -.05 * sc)), hand = root.clone().addScaledVector(dir, L), parts = [];
          parts.push(G.tube([root, root.clone().lerp(elbow, .5).add(V(0, .02 * sc, -.02 * sc)), elbow], function (t) { return (.028 - .008 * t) * sc; }, 6, 12, true));
          parts.push(G.tube([elbow, elbow.clone().lerp(hand, .5).add(V(sd * .03 * sc, .03 * sc, 0)), hand], function (t) { return (.022 - .008 * t) * sc; }, 6, 12, true));
          parts.push(G.sphere(.034 * sc, [elbow.x, elbow.y, elbow.z], [1, 1, 1], 8, 6));
          for (var f = 0; f < 4; f++) { var a = (f - 1.5) * .35, tip = hand.clone().add(V(Math.sin(a) * .07 * sc + sd * .02 * sc, -.06 * sc, Math.cos(a) * .1 * sc)); parts.push(G.tube([hand, hand.clone().lerp(tip, .5).add(V(0, .03 * sc, 0)), tip], function (t) { return .009 * sc * (1 - t * .8); }, 5, 8, true)); }
          A.rigid(boneKey, G.merge(parts), j);
        });
        info.posture = Object.assign({}, info.posture || {}, { neck: .14 });
      } else if (kind === 'neckhair') {
        // the lantern-bearer's long neck carries a mane of drowned hair hanging off the skull (strips already added by the kit)
        var hc = P('head'), ring = [];
        for (var i = 0; i < 9; i++) { var a = i / 9 * TAU, q = hc.clone().add(V(Math.sin(a) * .09 * sc, -.12 * sc - i % 2 * .02 * sc, Math.cos(a) * .08 * sc)); ring.push(G.spike(.012 * sc, q, q.clone().add(V(Math.sin(a) * .06 * sc, -.1 * sc, Math.cos(a) * .06 * sc)), 5)); }
        A.rigid(boneKey, G.merge(ring), R.neck);
      } else if (kind === 'stone') {
        // a broken gravestone chained to the back: slab with a cracked arch, hung on two chains (it swings heavily)
        var back = surface('s3', Math.PI, -.05, .06) || s3.clone(), j = swingBone('s3', back.clone().add(V(0, .22 * sc, 0)), { gravity: true, len: .5 * sc, grav: 1, stiff: .35, damp: .93, dir: [0, -1, 0], max: .35 });
        var w = .42 * sc, h = .58 * sc, d = .09 * sc, cz = back.z - d * .5 - .02 * sc, cy = back.y - .1 * sc;
        var slab = G.box(w, h, d, [back.x, cy, cz]), top = G.cyl(w * .5, w * .5, d, 14, [back.x, cy + h * .5, cz], [Math.PI / 2, 0, 0]);
        A.rigid(has('ash') ? 'ash' : boneKey, G.merge([slab, top]), j);
        var cracks = [G.box(.012 * sc, h * .7, .01 * sc, [back.x - .05 * sc, cy + .02 * sc, cz - d * .52]), G.box(w * .6, .01 * sc, .01 * sc, [back.x, cy + .12 * sc, cz - d * .52])];
        A.rigid(glowKey, G.merge(cracks), j);
        [-1, 1].forEach(function (sd) { var c0 = back.clone().add(V(sd * .14 * sc, .22 * sc, 0)), ch = chainGeo(c0, .2 * sc, .045 * sc); A.rigid(ironKey, ch.geo, j); });
      } else if (kind === 'draped') {
        // hooks pierced through the skin of the chest, chains running from them to the shoulders
        var hooks = [];
        for (var k = 0; k < 5; k++) { var q2 = surface('s3', (k - 2) * .38, -.05 - (k % 2) * .07, .01); if (!q2) continue; var hk = hookGeo(q2, .55 * sc); hooks.push(hk); }
        if (hooks.length) A.rigid(ironKey, G.merge(hooks), R.s3);
      }
    }
    function bossParts() {
      // the boss body: heavier crown of horns now, more growth hidden for phase II and III (revealed by phaseVisual)
      var hc = P('head'), s3 = P('s3'), top = hc.y + .14 * sc, horns = [], p2 = [], p3 = [];
      [-1, 1].forEach(function (sd) {
        var b0 = V(hc.x + sd * .08 * sc, top - .05 * sc, hc.z), pts = [b0, b0.clone().add(V(sd * .12 * sc, .1 * sc, -.04 * sc)), b0.clone().add(V(sd * .2 * sc, .26 * sc, -.12 * sc)), b0.clone().add(V(sd * .17 * sc, .42 * sc, -.2 * sc))];
        horns.push(G.tube(pts, function (t) { return .045 * sc * (1 - t * .9); }, 7, 18, true));
        // phase II: shoulder blades of bone burst up
        var sh = P(sd < 0 ? 'clavR' : 'clavL') || s3; for (var k = 0; k < 3; k++) { var b = sh.clone().add(V(sd * (.06 + k * .05) * sc, .1 * sc, (-.06 + k * .05) * sc)); p2.push(G.spike(.04 * sc, b, b.clone().add(V(sd * (.12 + .04 * k) * sc, (.32 - .06 * k) * sc, -.05 * sc)), 6)); }
        // phase III: a second, larger pair of horns, burning
        var c0 = V(hc.x + sd * .05 * sc, top - .02 * sc, hc.z + .03 * sc); p3.push(G.tube([c0, c0.clone().add(V(sd * .06 * sc, .2 * sc, .04 * sc)), c0.clone().add(V(sd * .04 * sc, .4 * sc, -.02 * sc)), c0.clone().add(V(sd * .1 * sc, .55 * sc, -.12 * sc))], function (t) { return .035 * sc * (1 - t * .92); }, 7, 18, true));
      });
      // a spine ridge of spikes down the back (always), ember cracks over the chest (phase II)
      for (var i = 0; i < 6; i++) { var q = surface('s3', Math.PI, .12 - i * .07, .0); if (!q) continue; horns.push(G.spike(.035 * sc, q, q.clone().add(V(0, .08 * sc, -(.16 - i * .015) * sc)), 6)); }
      A.rigid(boneKey, G.merge(horns), R.head === 'head' ? 'head' : R.head);
      var cr = []; for (var m = 0; m < 5; m++) { var pts2 = []; for (var j = 0; j < 4; j++) { var q3 = surface('s3', (m - 2) * .35 + Math.sin(j * 2 + m) * .12, .05 - j * .09, .006); if (q3) pts2.push(q3); } if (pts2.length > 2) cr.push(G.tube(pts2, .008 * sc, 5, 12, false)); }
      if (cr.length) A.transfer('phase-2-glow', G.merge(cr), skinKeys, { bones: [R.s1, R.s2, R.s3].filter(function (n) { return A.has(n); }) });
      A.rigid('phase-2-bone', G.merge(p2), R.s3);
      A.rigid('phase-3-glow', G.merge(p3), R.head);
      var gm = B.Models.gearMaterial;
      mats['phase-2-glow'] = mats[glowKey] || gm(glowKey === 'ember' ? 'ember' : 'ember');
      mats['phase-3-glow'] = mats['phase-2-glow'];
      mats['phase-2-bone'] = mats[boneKey] || gm(boneKey);
    }
    return info;
  }

  // ---------------------------------------------------------------- runtime (create)
  var vt = new T.Vector3(), axisZ = new T.Vector3(), qz = new T.Quaternion(), qa = new T.Quaternion(), qb = new T.Quaternion(), qp = new T.Quaternion(), va = new T.Vector3(), vb = new T.Vector3(), vc = new T.Vector3(), vs = new T.Vector3(), mInv = new T.Matrix4(), axis = new T.Vector3();
  var DOWN = new T.Vector3(0, -1, 0);
  function attach(info, ctx) {
    if (OFF || !info) return;
    var root = ctx.root, native = ctx.native, R = info.rig, list = [], time = Math.random() * 10;
    // posture bones
    var post = [];
    if (info.posture) Object.keys(info.posture).forEach(function (role) { var b = native[R[role]]; if (b) post.push({ b: b, a: info.posture[role], gait: info.gait ? (info.gait[role] || 0) : 0, base: new T.Quaternion(), written: new T.Quaternion(0, 0, 0, 0) }); });
    info.swing.forEach(function (s) {
      var b = native[s.bone]; if (!b) return;
      var restQ = b.quaternion.clone(), dir = new T.Vector3().fromArray(s.dir).normalize();
      // geometry direction in the parent's frame (the helper bone's bind rotation is the identity, so its local rest maps the bind direction)
      list.push({ b: b, s: s, restQ: restQ, restDir: dir.clone().applyQuaternion(restQ), world: dir.clone(), q: new T.Vector3(), prev: new T.Vector3(), ready: false, last: new T.Vector3(), seed: Math.random() * 10 });
    });
    if (info.phases) root.traverse(function (n) { if (n.isMesh && /^phase-[23]/.test(n.name)) { n.visible = false; n.userData.dreadPhase = +n.name.charAt(6); } });
    if (info.phases) phaseVisual(root, 1, false);
    // corpse variety: every foe falls its own way — arms flung or tucked, legs apart, the head lolled (world-up deltas on the death pose,
    // eased in over the fall; they keep the limbs at their height, so nothing sinks into the floor)
    var sprawl = [], deadT = 0, debrisDone = false, shownPhase = 1;
    if (!info.phases) [['armL', 1.1], ['armR', 1.1], ['foreL', .7], ['foreR', .7], ['thighL', .38], ['thighR', .38], ['head', .9]].forEach(function (e) {
      var b = native[R[e[0]]]; if (b) sprawl.push({ b: b, a: (Math.random() * 2 - 1) * e[1], base: new T.Quaternion(), written: new T.Quaternion(0, 0, 0, 0) });
    });
    if (!post.length && !list.length && !sprawl.length && !info.phases) return;
    ctx.extras.push(function (dt, state) {
      dt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 1 / 20); time += dt;
      if (info.phases && state) {   // the fight's phase as combat poses it (works with or without boss-framework)
        var want = state.phase === 'rage' ? (state.enraged ? 3 : 2) : 1;
        if (state.reset) want = 1;
        if (want !== shownPhase) { shownPhase = want; phaseVisual(root, want === 3 ? 2 : want, want === 3); }
      }
      if (post.length && !(state && state.dead)) {
        // world right axis of the model, then a forward bend of each listed bone about it (applied after the animation)
        root.updateWorldMatrix(true, false); axis.set(1, 0, 0).transformDirection(root.matrixWorld); axisZ.set(0, 0, 1).transformDirection(root.matrixWorld);
        // gait weight transfer (hero): the torso rolls over the planted foot and leans into the stride
        var mi = root.userData.authoredMotion, mv = info.gait && state ? Math.min(1, Math.max(0, +state.move || 0)) : 0, gph = mi && /walk|run|move|loco/i.test(mi.clip || '') ? (mi.phase || 0) : -1;
        var roll = mv && gph >= 0 ? Math.sin(gph * TAU) * .05 * mv : 0, lean = mv * .05;
        for (var i = 0; i < post.length; i++) {
          var b = post[i].b, par = b.parent; if (!par) continue; var ax = post[i].a, angX = typeof ax === 'number' ? ax : ax[0], angZ = typeof ax === 'number' ? 0 : ax[1];
          if (post[i].gait) { angX += lean * post[i].gait; angZ += roll * post[i].gait; }
          par.matrixWorld.decompose(vs, qp, vb); qb.copy(qp).invert(); qa.setFromAxisAngle(vc.copy(axis).applyQuaternion(qb), angX);
          if (angZ) qa.multiply(qz.setFromAxisAngle(vc.copy(axisZ).applyQuaternion(qb), angZ));
          // a bone the animation did not set this frame still holds last frame's bent value: bend from the unbent base, never accumulate
          if (b.quaternion.equals(post[i].written)) b.quaternion.copy(post[i].base); post[i].base.copy(b.quaternion);
          b.quaternion.premultiply(qa); post[i].written.copy(b.quaternion); b.updateMatrixWorld(true);
        }
      }
      if (state && state.dead) {
        deadT += dt;
        if (!debrisDone && deadT > .35) { debrisDone = true; if (!info.hero) scatterDebris(root, info); }
        if (sprawl.length) {
          var e = Math.min(1, deadT / .8); e = e * e * (3 - 2 * e);
          for (var j = 0; j < sprawl.length; j++) {
            var sp = sprawl[j], sb = sp.b, spar = sb.parent; if (!spar) continue;
            if (sb.quaternion.equals(sp.written)) sb.quaternion.copy(sp.base); sp.base.copy(sb.quaternion);
            spar.matrixWorld.decompose(vs, qp, vb); qa.setFromAxisAngle(vc.set(0, 1, 0).applyQuaternion(qb.copy(qp).invert()), sp.a * e);
            sb.quaternion.premultiply(qa); sp.written.copy(sb.quaternion); sb.updateMatrixWorld(true);
          }
        }
      } else { deadT = 0; debrisDone = false; }
      for (var k = 0; k < list.length; k++) {
        var it = list[k], b2 = it.b, par2 = b2.parent, s = it.s; if (!par2) continue;
        b2.quaternion.copy(it.restQ); b2.updateMatrixWorld(false);
        va.setFromMatrixPosition(b2.matrixWorld);                                     // pivot (world)
        par2.matrixWorld.decompose(vs, qp, vb);
        vc.copy(it.restDir).applyQuaternion(qp);                                      // where the geometry points now (world)
        var geo = vt.copy(vc);
        if (s.gravity) vc.copy(it.world);                                              // hanging things rest straight down, whatever the torso does
        if (s.twitch) { var tw = Math.sin(time * 7.3 + it.seed) * Math.sin(time * 2.1 + it.seed * 3); vc.x += tw * s.twitch; vc.z += Math.cos(time * 5.7 + it.seed) * s.twitch * .6; vc.normalize(); }
        var L = s.len * vb.x;                                                          // world length (parent scale)
        if (!it.ready || it.last.distanceTo(va) > 2.5 || (state && state.reset)) { it.q.copy(va).addScaledVector(vc, L); it.prev.copy(it.q); it.ready = true; }
        it.last.copy(va);
        // verlet: inertia, gravity, a spring to the rest direction
        var px = it.q.x, py = it.q.y, pz = it.q.z;
        it.q.x += (it.q.x - it.prev.x) * s.damp; it.q.y += (it.q.y - it.prev.y) * s.damp - 9.8 * s.grav * dt * dt; it.q.z += (it.q.z - it.prev.z) * s.damp;
        it.prev.set(px, py, pz);
        var kk = 1 - Math.exp(-dt * 14 * s.stiff);
        it.q.x += (va.x + vc.x * L - it.q.x) * kk; it.q.y += (va.y + vc.y * L - it.q.y) * kk; it.q.z += (va.z + vc.z * L - it.q.z) * kk;
        vb.copy(it.q).sub(va); var d = vb.length() || 1e-6; vb.multiplyScalar(1 / d); it.q.copy(va).addScaledVector(vb, L);
        // limit the swing, then express it as a rotation of the bone (parent space)
        var ang = Math.acos(Math.max(-1, Math.min(1, vb.dot(vc))));
        if (ang > s.max) { qa.setFromUnitVectors(vc, vb); qb.identity().slerp(qa, s.max / ang); vb.copy(vc).applyQuaternion(qb); }
        qa.setFromUnitVectors(geo, vb);                                                 // world delta
        qb.copy(qp).invert(); qa.premultiply(qb).multiply(qp);                          // parent-space delta
        b2.quaternion.copy(it.restQ).premultiply(qa); b2.updateMatrixWorld(true);
      }
    });
  }

  // ---------------------------------------------------------------- floor debris round corpses
  // Three shared InstancedMeshes for the whole game (bone shards, broken chain links, burnt shroud scraps): a fixed ring of
  // instances, so the floor of a long fight fills up without a single extra draw call per corpse. ?nodread turns it off.
  var POOLS = null, CAP = 160;
  function pools() {
    if (POOLS) return POOLS;
    var G = B.Gear, gm = B.Models && B.Models.gearMaterial; if (!G || !gm) return null;
    function mk(geo, matKey, name) { G.wear(geo, matKey === 'rag' ? { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .6, width: .03, bottom: .3, base: .03 } } : { edge: .5 });
      var m = new T.InstancedMesh(geo, gm(matKey), CAP); m.name = name; m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.userData.cursor = 0; return m; }
    var bone = G.merge([G.cyl(.012, .016, .16, 6, [0, 0, 0], [0, 0, Math.PI / 2]), G.sphere(.022, [-.085, 0, 0], [1, .8, .9], 6, 4), G.sphere(.02, [.085, 0, .006], [1, .8, .9], 6, 4)]);
    var link = G.link(.05); link.rotateX(Math.PI / 2);
    var scrap = G.sheet(3, 3, function (u, v) { return [(u - .5) * .2, .004 + Math.sin(u * 5 + v * 3) * .006, (v - .5) * .16]; }, false);
    POOLS = [mk(bone, 'bone', 'dread-debris-bone'), mk(link, 'dark', 'dread-debris-chain'), mk(scrap, 'rag', 'dread-debris-shroud')];
    return POOLS;
  }
  function debrisHost(root) { var h = root && root.parent; return h && h.name === 'enemy-holder' && h.parent ? h.parent : h; }
  // qa: attach the (empty) pools under the loading cover so the shader warm-up compiles their instanced variants; otherwise
  // the first kill of every chapter compiled three programs on the spot (a 1.3-1.8 s freeze).
  function prewarm(anyFoeRoot) { if (OFF) return; var ps = pools(), host = debrisHost(anyFoeRoot); if (!ps || !host) return; ps.forEach(function (m) { if (m.parent !== host) { host.add(m); m.count = 0; m.userData.cursor = 0; } }); }
  var dm = new T.Matrix4(), dq = new T.Quaternion(), dp = new T.Vector3(), ds = new T.Vector3(), de = new T.Euler();
  function scatterDebris(root, info) {
    // qa: each foe sits in its own 'enemy-holder' group (combat.js); hosting the shared pools there re-parented them and emptied
    // the floor on every new kill. Host them on the combat group above it instead.
    if (OFF) return; var ps = pools(), host = debrisHost(root); if (!ps || !host) return;
    // host = the combat group (world-aligned): the debris stays when the corpse is removed
    ps.forEach(function (m) { if (m.parent !== host) { host.add(m); m.count = 0; m.userData.cursor = 0; } });   // a new level: start empty
    root.updateWorldMatrix(true, false); dp.setFromMatrixPosition(root.matrixWorld); host.updateWorldMatrix(true, false);
    var inv = new T.Matrix4().copy(host.matrixWorld).invert(), big = BOSS[info.type] ? 2.2 : 1, counts = [3 + (Math.random() * 3 | 0), 2 + (Math.random() * 4 | 0), 1 + (Math.random() * 3 | 0)];
    ps.forEach(function (m, k) {
      for (var i = 0; i < counts[k] * big; i++) {
        var a = Math.random() * TAU, r = (.25 + Math.random() * .9) * big;
        de.set(k === 2 ? 0 : (Math.random() - .5) * .5, Math.random() * TAU, k === 2 ? 0 : (Math.random() - .5) * .3); dq.setFromEuler(de);
        var s = (.75 + Math.random() * .6) * (k === 2 ? 1.3 : 1); ds.set(s, s, s);
        dm.compose(new T.Vector3(dp.x + Math.cos(a) * r, .015, dp.z + Math.sin(a) * r), dq, ds).premultiply(inv);
        var c = m.userData.cursor++ % CAP; m.setMatrixAt(c, dm); m.count = Math.min(CAP, Math.max(m.count, c + 1));
      }
      m.instanceMatrix.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------------- boss phases
  function phaseVisual(target, phase, enraged) {
    var model = target && target.model ? target.model : target, root = model && model.root ? model.root : model; if (!root || !root.traverse) return;
    // the bosses run phase 1 -> 2 and then enrage: II at phase 2, III when enraged (or a third phase where a fight has one)
    phase = Math.min(3, Math.max(1, phase | 0) + (enraged && phase >= 2 ? 1 : 0)); var heat = (phase - 1) * .4;
    root.traverse(function (n) {
      if (!n.isMesh) return;
      if (n.userData.dreadPhase) n.visible = !OFF && phase >= n.userData.dreadPhase;
      var m = n.material; if (!m || Array.isArray(m)) return;
      if (m.emissive && m.emissiveIntensity > 0) { if (m.userData.dreadGlow === undefined) m.userData.dreadGlow = m.emissiveIntensity; m.emissiveIntensity = m.userData.dreadGlow * (1 + heat); }
      var g = m.userData.grade; if (g && g.kBlood && /skin/.test(m.name)) { if (m.userData.dreadBlood === undefined) m.userData.dreadBlood = g.kBlood.value; g.kBlood.value = Math.min(1, m.userData.dreadBlood + heat * .3); }
    });
    root.userData.dreadPhase = phase;
  }
  // enemy-horror.js hangs its shroud tatters rigidly on the upper spine; on the stooped prisoner and drowned (their clips bend that bone
  // ~70 degrees) the strips stood up over the head. Here they are swinging strips instead (KIT above), so the rigid ones are dropped.
  if (!OFF && B.EnemyHorror && B.EnemyHorror.kit) ['prisoner', 'drowned'].forEach(function (t) { var k = B.EnemyHorror.kit[t]; if (k) B.EnemyHorror.kit[t] = k.filter(function (x) { return x !== 'tatters'; }); });
  // Bahtiyar: a heavier, planted stance on top of every clip — shoulders sunk, chest a little forward, the head held low and level,
  // and the torso rolling over the planted foot while he walks or runs (no swinging parts, no corpse debris). ?nohero turns it off.
  function heroInfo() {
    if (OFF || /[?&]nohero(&|$)/.test(location.search)) return null;
    return { type: 'hero', hero: true, swing: [], phases: false, rig: rig(true),
      posture: { s2: .03, s3: .05, neck: -.03, head: -.03, clavL: [0, -.09], clavR: [0, .09] }, gait: { s2: .6, s3: .5 } };
  }
  B.EnemyDread = { prewarm: prewarm, heroInfo: heroInfo, pre: OFF ? function () { } : pre, apply: apply, attach: attach, phaseVisual: phaseVisual, kit: KIT, posture: POSTURE };
  // BABA.Models is published by authored-models.js (loaded after this file): install the helper once it exists.
  function install() { if (B.Models && !B.Models.phaseVisual) B.Models.phaseVisual = phaseVisual; }
  install(); if (!B.Models) { var tries = 0, iv = setInterval(function () { install(); if ((B.Models && B.Models.phaseVisual) || ++tries > 200) clearInterval(iv); }, 50); }
}());
