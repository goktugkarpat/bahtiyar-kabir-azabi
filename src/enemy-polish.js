/* KABİR AZABI — enemy motion polish (ajan:chars2a). Publishes BABA.EnemyPolish; ?nopolish turns it off.
   A thin layer of damped springs on top of the authored pose (authored-motion.js), one per foe, run as an `extras` callback in
   authored-models.js create() right after the pose and before the dread posture / cloth springs. Rotation deltas are expressed on the
   world axes of the model (right / up / forward) and applied to the spine, neck, head, clavicles and pelvis; nothing is allocated per frame.
     - notice  : the moment a foe wakes (lookYaw appears) it rears back or coils, then lunges: a visible "I saw you" beat.
     - attack  : lean-back wind-up that grows until the strike frame, then a forward kick that settles through a spring (weight in the blow).
     - hit     : directional chest / head whip through a spring, heavier for heavy blows, softer for blocks; works with hit-stop because it
                 starts on the first posed frame after the blow and runs on its own clock.
     - death   : an arch at the killing blow, a bounce + limb splay when the body lands (BABA.EnemyPolish.landTime), then dying twitches.
     - phase   : bosses pull back, spread the arms and slam forward when the fight turns (telegraph + release).
   Every effect is zero when idle: the callback returns after a handful of comparisons. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE;
  var OFF = /[?&]nopolish(&|$)/.test(location.search);
  var EXEC = { carrier: 1, boss: 1, urchin: 1, bell: 1, gravemason: 1, ruinwarden: 1, hollowking: 1, forgesentinel: 1, ashwarden: 1, furnaceheart: 1, chainjailer: 1, verdictwarden: 1, lastjudge: 1 };
  var BOSS = { boss: 1, bell: 1, hollowking: 1, furnaceheart: 1, lastjudge: 1 };
  var COIL = { stalker: 1, crawler: 1, cavefang: 1, slagcrawler: 1, voidcrawler: 1, urchin: 0, prisoner: .5, damned: .4 };   // foes that crouch at the notice beat instead of rearing
  var MASS = { carrier: .6, urchin: .62, rootborn: .55, gravemason: .6, ruinwarden: .6, forgesentinel: .6, ashwarden: .6, chainjailer: .62, verdictwarden: .6, guard: .8, stalker: 1.3, crawler: 1.3, cavefang: 1.3, slagcrawler: 1.3, voidcrawler: 1.3, lantern: 1.15, cultist: 1.1, shardseer: 1.1, chainseer: 1.1, verdictseer: 1.1 };
  function rig(exec) {
    return exec ? { pelvis: 'pelvis', s1: 'spine01', s2: 'spine02', s3: 'spine03', neck: 'neck', head: 'head', clavL: 'shoulderL', clavR: 'shoulderR' }
      : { pelvis: 'pelvis', s1: 'spine_01', s2: 'spine_02', s3: 'spine_03', neck: 'neck_01', head: 'Head', clavL: 'clavicle_l', clavR: 'clavicle_r' };
  }
  var ORDER = ['pelvis', 's1', 's2', 's3', 'neck', 'head', 'clavL', 'clavR'];
  // time (s) after the killing blow at which the body hits the floor (combat.js uses it for the dust; the corpse bounce uses it too)
  function landTime(blown, boss) { return boss ? .62 : blown ? .22 : .48; }
  var qr = new T.Quaternion(), qri = new T.Quaternion(), qe = new T.Quaternion(), qw = new T.Quaternion(), qp = new T.Quaternion(), qpi = new T.Quaternion(), vs = new T.Vector3(), vb = new T.Vector3(), eu = new T.Euler(0, 0, 0, 'YXZ');
  function sm(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function Spring(w, z) { this.x = 0; this.v = 0; this.t = 0; this.w = w; this.z = z; }
  Spring.prototype.step = function (dt) {   // semi-implicit Euler, two substeps for stiff springs
    var n = dt > .02 ? 3 : 1, h = dt / n;
    for (var i = 0; i < n; i++) { this.v += (-this.w * this.w * (this.x - this.t) - 2 * this.z * this.w * this.v) * h; this.x += this.v * h; }
  };
  Spring.prototype.idle = function () { return Math.abs(this.x - this.t) < .0006 && Math.abs(this.v) < .004 && Math.abs(this.t) < .0006; };
  Spring.prototype.reset = function () { this.x = this.v = this.t = 0; };

  function attach(ctx) {
    if (OFF || !ctx || !ctx.native) return;
    var type = ctx.type, exec = !!EXEC[type], boss = !!BOSS[type], R = rig(exec), root = ctx.root, native = ctx.native, slots = [];
    ORDER.forEach(function (role) {
      var b = native[R[role]]; slots.push(b ? { b: b, base: new T.Quaternion(), written: new T.Quaternion(0, 0, 0, 0), bp: new T.Vector3(), wp: new T.Vector3(NaN, 0, 0), has: false, pi: -1, wq: new T.Quaternion() } : null);
    });
    slots.forEach(function (sl) { if (!sl) return; for (var j = 0; j < slots.length; j++) if (slots[j] && slots[j] !== sl && slots[j].b === sl.b.parent) sl.pi = j; });
    if (!slots[2] || !slots[3]) return;   // no spine: not a humanoid rig
    // heavy bodies react less, light ones (stalkers, crawlers, casters) more
    var big = (boss ? .55 : (ctx.scale && ctx.scale > 1.25 ? .75 : 1)) * (MASS[type] || 1);
    var cp = new Spring(19, .30), cr = new Spring(17, .30), cy = new Spring(16, .34), hp = new Spring(25, .20), hr = new Spring(22, .22), ar = new Spring(15, .26), pp = new Spring(20, .30), lift = new Spring(34, .22);
    var all = [cp, cr, cy, hp, hr, ar, pp, lift];
    var age = 0, ready = 0, prevHurt = 0, prevBlock = 0, prevLook = false, prevAttack = 0, prevDead = false, prevPhase = 'idle', prevEnraged = false;
    var startleWait = -1, startleT = -1, deathT = -1, deathBlown = false, landed = false, phaseT = -1, twitchSeed = Math.random() * 20, coil = COIL[type] != null ? COIL[type] : 0, wind = 0;
    var dirty = false, busy = false, daze = 0, swell = false;
    function kick(s, v) { s.v += v; }
    // Rotations are composed down the chain in plain quaternions (parents come first in ORDER); the matrices of the whole subtree are
    // refreshed once at the end instead of after every bone.
    function applyBone(i, pitch, yaw, roll, up) {
      var sl = slots[i]; if (!sl) return; var b = sl.b, par = b.parent; if (!par) return;
      // a bone the animation did not touch this frame still holds our last write: step back to the unmodified value first
      if (sl.has && b.quaternion.equals(sl.written)) { b.quaternion.copy(sl.base); if (up !== undefined) b.position.copy(sl.bp); }
      sl.base.copy(b.quaternion); sl.bp.copy(b.position);
      if (sl.pi >= 0) { qp.copy(slots[sl.pi].wq); vs.set(1, 1, 1); if (up) par.matrixWorld.decompose(vb, qe, vs); } else par.matrixWorld.decompose(vs, qp, vb);
      if (pitch === 0 && yaw === 0 && roll === 0 && !up) { sl.has = false; sl.wq.copy(qp).multiply(b.quaternion); return; }
      qpi.copy(qp).invert();
      eu.set(pitch, yaw, roll, 'YXZ'); qe.setFromEuler(eu);
      qw.copy(qr).multiply(qe).multiply(qri);                       // the delta about the model's axes, as a world rotation
      qe.copy(qpi).multiply(qw).multiply(qp);                       // ... in the parent bone's frame
      b.quaternion.premultiply(qe);
      if (up) { vb.set(0, up, 0).applyQuaternion(qpi); b.position.x += vb.x / vs.x; b.position.y += vb.y / vs.y; b.position.z += vb.z / vs.z; }
      sl.written.copy(b.quaternion); sl.wp.copy(b.position); sl.has = true;
      sl.wq.copy(qp).multiply(b.quaternion);
    }
    var tops = slots.filter(function (sl) { return sl && sl.pi < 0; });
    function refresh() { for (var t = 0; t < tops.length; t++) tops[t].b.updateMatrixWorld(true); }
    function release() {   // all springs idle: hand the bones back untouched
      for (var i = 0; i < slots.length; i++) { var sl = slots[i]; if (sl && sl.has) { if (sl.b.quaternion.equals(sl.written)) sl.b.quaternion.copy(sl.base); sl.has = false; } }
      busy = false; refresh();
    }
    ctx.extras.push(function (dt, state) {
      if (!state) return; dt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 1 / 15);
      if (state.reset) { for (var r = 0; r < all.length; r++) all[r].reset(); startleT = deathT = phaseT = -1; landed = false; prevDead = false; ready = 0; }
      var dead = !!state.dead, hurt = +state.hurt || 0, block = +state.blockImpact || 0, look = state.lookYaw !== undefined && state.lookYaw !== null && Number.isFinite(state.lookYaw);
      var phase = state.phase === 'rage' ? 'rage' : 'x', atk = +state.attack || 0, contact = +state.contactPhase || .41, heavyHit = !!state.hurtHeavy, ha = +state.hitAngle || 0;
      if (ready < 3) { ready++; prevHurt = hurt; prevBlock = block; prevLook = look; prevAttack = atk; prevDead = dead; prevPhase = phase; if (!dead) return; }
      if (dt > 0) age += dt;
      // ------------------------------------------------------------------ events
      if (dead && !prevDead) {
        deathT = 0; landed = false; deathBlown = state.deathKind === 'blown'; startleT = -1;
        var pw = deathBlown ? 1.7 : 1;
        kick(cp, -8.5 * pw * big); kick(hp, 11 * pw * big); kick(cr, Math.sin(ha) * 5 * big); kick(cy, Math.sin(ha) * 4 * big); kick(ar, 7 * pw);
      }
      if (!dead && prevDead) { for (var q = 0; q < all.length; q++) all[q].reset(); deathT = -1; }
      if (!dead) {
        if (hurt > prevHurt + .25) {   // a blow landed: whip away from it
          var hv = heavyHit ? 1.75 : 1, mag = (boss ? .45 : 1) * big;
          kick(cp, -Math.cos(ha) * 11 * hv * mag); kick(cr, Math.sin(ha) * 9 * hv * mag); kick(cy, -Math.sin(ha) * 7 * hv * mag);
          kick(hp, -Math.cos(ha) * 14 * hv * mag); kick(hr, Math.sin(ha) * 10 * hv * mag); kick(pp, Math.cos(ha) * 5 * hv * mag); kick(ar, 5 * hv * mag);
        }
        if (block > prevBlock + .5) { kick(cp, -4.2 * big); kick(hp, -5 * big); kick(ar, 2.4); }
        if (look && !prevLook && age > .6 && !boss) startleWait = Math.random() * .2;   // a pack does not flinch in unison
        if (startleWait >= 0) { startleWait -= dt; if (startleWait < 0) { startleT = 0; startleWait = -1; } }
        if (boss && age > 1 && ((phase === 'rage' && prevPhase !== 'rage') || (state.enraged && !prevEnraged))) phaseT = 0;
        if (atk > 0 && prevAttack < contact && atk >= contact) {   // the strike frame: the whole body goes into the blow, then recoils through the spring
          var hw = (state.heavy ? 1.5 : 1) * (boss ? .75 : 1);
          kick(cp, 15 * hw); kick(hp, -8 * hw); kick(pp, -3.5 * hw); kick(ar, 4 * hw);
        }
      }
      prevHurt = hurt; prevBlock = block; prevLook = look; prevAttack = atk; prevDead = dead; prevPhase = phase; prevEnraged = !!state.enraged;
      // ------------------------------------------------------------------ targets (smooth, slower than the kicks)
      var tCp = 0, tAr = 0, tHp = 0, tCy = 0;
      if (dead) wind = 0;
      // stunned for longer than a flinch (heavy blows, skills): dazed, head drooping and swaying, chest slumping, instead of freezing in the stagger pose
      var stg = +state.stagger || 0, stT = +state.staggerTime || 0;
      daze = !dead && stg > .02 && stg < .995 && stT > .6 ? sm(stg * 7) * (1 - sm((stg - .86) / .14)) : 0;
      if (!dead) {
        if (atk > 0 && atk < contact + .02) { wind = sm(atk / contact); tCp = (coil >= 1 ? .24 : -.27) * wind * (state.heavy ? 1.4 : 1) * (boss ? .8 : 1); tHp = (coil >= 1 ? -.12 : .05) * wind; tAr = .1 * wind; }   // stalkers / crawlers coil forward and low, the rest lean back
        else wind = 0;
        if (startleT >= 0) {
          startleT += dt; var u = startleT / .62;
          if (u >= 1) startleT = -1;
          else if (coil) { tCp = .42 * coil * sm(u / .25) * (1 - sm((u - .45) / .45)) - .1 * sm((u - .55) / .2) * (1 - sm((u - .75) / .25)); tHp = -.2 * coil * sm(u / .3) * (1 - sm((u - .6) / .4)); tAr = .22 * sm(u / .2) * (1 - sm((u - .5) / .4)); }
          else { tCp = -.36 * sm(u / .18) * (1 - sm((u - .38) / .3)) + .1 * sm((u - .5) / .15) * (1 - sm((u - .75) / .25)); tHp = .12 * sm(u / .2) * (1 - sm((u - .45) / .4)); tAr = .42 * sm(u / .18) * (1 - sm((u - .4) / .45)); }
        }
        if (phaseT >= 0) {
          phaseT += dt;
          if (phaseT < .5) { var pu = sm(phaseT / .45); tCp = -.3 * pu; tAr = .55 * pu; tHp = .16 * pu; tCy = Math.sin(phaseT * 46) * .035 * pu; }
          else { if (phaseT - dt < .5) { kick(cp, 15); kick(hp, -9); kick(ar, -6); } tAr = .3 * (1 - sm((phaseT - .5) / .7)); if (phaseT > 1.4) phaseT = -1; }
        }
      }
      // an enemy that has not noticed the hero (or lost him) stands dormant: head low, shoulders slack; the notice beat then snaps it upright
      if (!dead && !look && !boss && ready >= 3) { tCp += .07; tHp += .24; tAr -= .05; }
      cp.t = tCp; ar.t = tAr; hp.t = tHp; cy.t = tCy;
      // ------------------------------------------------------------------ death: bounce on landing, splay, twitches
      var up = 0, twAmp = 0;
      if (dead && deathT >= 0) {
        deathT += dt;
        var lt = landTime(deathBlown, boss);
        if (!landed && deathT >= lt) { landed = true; kick(cy, (Math.random() - .5) * 5); kick(ar, 8 * (boss ? .6 : 1)); kick(hp, -7); kick(lift, boss ? 1.2 : 1.6); }
        // the corpse lies in the floor plane: keep pitch / roll quiet after the fall, only yaw (about the vertical) and the lift bounce stay
        if (deathT > lt + .15) { cp.t = 0; cp.x *= .8; cp.v *= .5; hp.x *= .8; hp.v *= .5; cr.x *= .8; cr.v *= .5; hr.x *= .8; hr.v *= .5; pp.x *= .8; pp.v *= .5; }
        var since = deathT - lt;
        if (landed && since > .2 && since < 1.5) twAmp = .09 * Math.exp(-(since - .2) * 2.6);
        if (deathT > 1.9) { for (var z = 0; z < all.length; z++) all[z].reset(); twAmp = 0; }
      }
      // the carrier's corpse swells and shivers for the 2.35 s before its bile bursts (combat.js killEnemy: hazard warn 2.35 s), then drops back
      if (type === 'carrier') {
        if (dead && deathT > .35 && deathT < 2.4) { var su = sm((deathT - .35) / 1.9); root.scale.setScalar(1 + .13 * su + .03 * su * Math.sin(age * (16 + su * 34))); swell = true; }
        else if (swell) { root.scale.setScalar(1); swell = false; }
      }
      busy = deathT < 1.9 || !dead;
      // ------------------------------------------------------------------ integrate
      if (dt > 0) { for (var k = 0; k < all.length; k++) all[k].step(dt); }
      var any = twAmp > 0 || wind > .05 || daze > .01;
      for (var m = 0; m < all.length; m++) if (!all[m].idle()) { any = true; break; }
      if (!any) { if (dirty) { dirty = false; release(); } return; }
      dirty = true;
      var tw = twAmp ? Math.sin(age * 31 + twitchSeed) * twAmp : 0, tw2 = twAmp ? Math.sin(age * 23 + twitchSeed * 2) * twAmp : 0;
      var lf = lift.x > 0 ? lift.x * .03 : 0;
      root.updateWorldMatrix(true, false); root.matrixWorld.decompose(vs, qr, vb); qri.copy(qr).invert();
      // wind-up tension: a held pose never stands dead still: a fine tremble that grows towards the strike (chest roll, head, shoulders)
      var trem = wind > .05 ? wind * wind * Math.sin(age * 38 + twitchSeed) * (boss ? .035 : .05) : 0, trem2 = trem ? wind * Math.sin(age * 29 + twitchSeed * 1.7) * .03 : 0;
      if (wind > .05) { trem2 += wind * Math.sin(age * 2.6 + twitchSeed) * (boss ? .03 : .05); trem += wind * Math.cos(age * 1.8 + twitchSeed * .6) * (boss ? .035 : .06); }   // slow gathering sway of a long hold
      var dz = daze ? daze : 0, dzs = dz ? Math.sin(age * 2.6 + twitchSeed) : 0, dzc = dz ? Math.sin(age * 1.9 + twitchSeed * 2.3) : 0;
      var CP = cp.x + trem2 * .5 + dz * (.15 + .04 * dzc) * big, CR = cr.x + trem + dz * dzs * .09 * big, CY = cy.x + tw + dz * dzc * .1 * big, HP = hp.x - CP * .35 + dz * (.32 + .08 * dzs) * big, HR = hr.x - trem * .8 + dz * dzc * .2 * big, PP = pp.x;
      applyBone(0, PP, CY * .25, 0, lf);
      applyBone(1, CP * .30, CY * .25, CR * .30);
      applyBone(2, CP * .38, CY * .40, CR * .38);
      applyBone(3, CP * .32, CY * .35, CR * .32);
      applyBone(4, HP * .35, tw2 * .6, HR * .35);
      applyBone(5, HP * .65, tw2, HR * .65);
      applyBone(6, 0, ar.x * .35 + tw2 * .5, -ar.x * .5);
      applyBone(7, 0, -ar.x * .35 - tw2 * .5, ar.x * .5);
      refresh();
    });
  }
  B.EnemyPolish = { attach: OFF ? function () { } : attach, landTime: landTime };
})();
