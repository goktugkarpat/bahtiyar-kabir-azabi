/* KABİR AZABI — Hücum (Charge): the hero's fourth skill line. Self-contained module; progression.js / combat.js (engineer SKILLS) only call it.

   ===== ctx contract: BABA.Charge.begin(ctx, tier) =====
   ctx = {
     player   { x, z, face, yaw?, radius?, push? }   the hero body; begin()/update() move it with world.move and write face (and yaw at begin)
     game     the game object (unused except as a hint; may be {})
     world    { move(pos, dx, dz, radius), isWalkable?(x, z, radius) }   the same collision solver the roll uses
     enemies  array of { x, z, radius, dead, boss?, active?, push? }
     target   { x, z }   cursor floor point, already clamped by the caller to <= BABA.Charge.range(tier)  (clamped again here, defensively)
     fx(name, data)      effect dispatcher (optional; this module draws its own visuals through the world layer built in effects.js)
     sound(name, pos)    used names (pos = { x, z, tier, ... }): 'chargeWind' (wind-up swell), 'chargeRoar' (tier 3 roar), 'chargeDash' (dash layers per tier), 'chargeImpact' (slam, per tier), 'chargeSlam2' (tier 3 second slam)
     emit(name, data)    optional; called as emit('charge', { phase: 'wind'|'dash'|'impact'|'slam2'|'end', tier, x, z }) for HUD / QA
     canHit(enemy)       optional combat eligibility predicate: walls, seals and underground bodies; checked before targeting, stopping, damage and control
     damage(enemy, amount, opts)   opts = { kind: 'charge', primary: bool, path: bool, ring: bool, second: bool, heavy: true, face }
     stun(enemy, seconds)
     push(enemy, dx, dz, force)    dx, dz = unit direction, force = metres of shove (the caller maps it to its own push model)
     now                 seconds (optional)
     stats               optional override object merged over BABA.Charge.stats(tier) (SKILLS can feed progression numbers here)
   }
   returns null (refused: no target / too short / blocked straight ahead) or the running instance
     { duration, update(dt) -> true when finished, cancel(), pose, invulnerable, noKnockback, impacted, impactX, impactZ }
   `duration` = wind-up + dash + follow-through (seconds, nominal; the real dash is shorter when a wall or the first foe stops it).
   While the instance is running: invulnerable is true for the first 0.2 s of the dash (and the wind-up), noKnockback is true throughout.
   Simulation dt passes through update(dt); screen layers use the wall clock (hit-stop, FOV kick, edge flash) so slowdowns cannot stretch them.

   ===== other exports =====
   BABA.Charge.range(tier)           dash range in metres (8 / 11 / 14)
   BABA.Charge.stats(tier)           default numbers (damage, impactRadius, stunSeconds, pathWidth, pathDamage, cost, cooldown, ...)
   BABA.Charge.poseState(out?)       -> { chargeTime, chargeDuration, chargeTier, impactTime, chargeWind, chargeDash, chargeDir, chargeSerial }
                                      chargeTime = seconds since begin (-1 when idle), impactTime = seconds since impact (-1 before), chargeDir = yaw of the dash.
                                      Returns one shared object (no allocation); merge its fields into the hero state handed to authored-motion.js.
   BABA.Charge.cameraPush()          0..~0.03 : subtract from the camera `near` multiplier (like BABA.LevelUp.push)
   BABA.Charge.timeScale()           1, or ~0.06 during the 60-90 ms impact hit-stop (multiply the simulation dt like BABA.LevelUp.timeScale)
   BABA.Charge.active                true while an instance runs
   BABA.Charge.cancel()              cancels the running instance (death / chapter change)
   BABA.Charge.punch(o)              screen layer for other skills (whirl tier 3): { vig, flash, chroma, sat, push, dur, x, z, ringR, ringW }, decays over dur seconds (wall clock)
   BABA.Charge.createWorld(opts)     built once by effects.js (pooled ribbon + impact quad, warmed in warm-up)
   Zero dynamic lights, no runtime geometry / material creation, nothing allocated per frame: 2 extra draw calls (trail ribbon, impact quad)
   plus the shared particle pool. prefers-reduced-motion: no FOV kick, flash, vignette, spin blur, hit-stop; only ring + trail. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const qaCalm = typeof location !== 'undefined' && /[?&]lvcalm(&|$)/.test(location.search);
  const calm = () => qaCalm || mq.matches;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // =================================================================== DEFAULT NUMBERS
  const WIND = .12, RECOVER = .34, IFRAME = .2;
  // Defaults mirror progression.js (the game feeds the same numbers through ctx.stats). Tier II ~x1.35, tier III ~x1.8 of tier I in damage / area / stun.
  const TIERS = [null,
    { tier: 1, wind: .12, range: 8, speed: 20, dashTime: .4, damage: 86, ringDamageMul: .55, impactRadius: 2.6, stunSeconds: 1.4, pathWidth: 1.5, pathDamage: 0, pathShove: 0, knock: 2.6, cost: 30, cooldown: 7, stopAtFirst: true, hitStop: .07, second: false },
    { tier: 2, wind: .14, range: 11, speed: 27, dashTime: .407, damage: 116, ringDamageMul: .55, impactRadius: 3.8, stunSeconds: 1.9, pathWidth: 2.4, pathDamage: 26, pathShove: 3.6, knock: 3.6, cost: 46, cooldown: 10, stopAtFirst: false, hitStop: .09, second: false },
    { tier: 3, wind: .22, range: 14, speed: 32, dashTime: .4375, damage: 160, ringDamageMul: .55, impactRadius: 5, stunSeconds: 2.6, pathWidth: 3.4, pathDamage: 44, pathShove: 6.5, knock: 4.8, cost: 66, cooldown: 14, stopAtFirst: false, hitStop: .12, second: true, secondDelay: .32, secondDamage: 110, secondRadius: 6.6 }];
  const tierOf = t => clamp(Math.round(+t || 1), 1, 3);
  const range = t => TIERS[tierOf(t)].range;
  const stats = t => Object.assign({ wind: WIND, recover: RECOVER, iframe: IFRAME }, TIERS[tierOf(t)]);

  // =================================================================== SCREEN STATE (wall clock)
  const S = { inst: null, impactMs: -1e9, impact2Ms: -1e9, hitStopUntil: 0, hitStopMs: 0, tier: 1, dashAmt: 0, hx: 0, hz: 0, ix: 0, iz: 0, i2x: 0, i2z: 0, r2: 5, serial: 0, roarMs: -1e9, pn: null, pnMs: -1e9 };
  const PN = { vig: 0, flash: 0, chroma: 0, sat: 0, push: 0, dur: 1, x: 0, z: 0, ringR: 0, ringW: 1 };
  const POSE = { chargeTime: -1, chargeDuration: 0, chargeTier: 0, impactTime: -1, slam2Time: -1, chargeWind: WIND, chargeDash: 0, chargeDir: 0, chargeSerial: 0 };
  function poseState(out) {
    out = out || POSE; const i = S.inst;
    if (!i || i.done) { out.chargeTime = -1; out.impactTime = -1; out.slam2Time = -1; out.chargeDuration = 0; out.chargeTier = 0; return out; }
    out.chargeTime = i.t; out.chargeDuration = i.duration; out.chargeTier = i.st.tier; out.impactTime = i.impacted ? i.t - i.impactT : -1; out.slam2Time = i.second ? i.t - i.slam2T : -1;
    out.chargeWind = i.st.wind; out.chargeDash = i.dashPlanned; out.chargeDir = i.face; out.chargeSerial = i.serial; return out;
  }
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  /* FOV kick: eases in over the dash, a punch at each impact that settles (stronger per tier). Other skills may add a decaying pulse (punch). 0 under reduced motion. */
  const DASH_PUSH = [0, .010, .016, .024], KICK = [0, .016, .026, .04];
  function cameraPush() {
    if (calm()) return 0;
    const n = nowMs(), age = (n - S.impactMs) / 1000, age2 = (n - S.impact2Ms) / 1000, tk = KICK[S.tier] || .016;
    const kick = age >= 0 && age < 1 ? tk * (1 - Math.exp(-age * 40)) * Math.exp(-age * 5) : 0, kick2 = age2 >= 0 && age2 < 1 ? tk * 1.25 * (1 - Math.exp(-age2 * 40)) * Math.exp(-age2 * 4.5) : 0;
    const pa = (n - S.pnMs) / 1000, pulse = S.pn && pa >= 0 && pa < S.pn.dur ? S.pn.push * (1 - Math.exp(-pa * 30)) * Math.exp(-pa * 4 / S.pn.dur) : 0;
    return Math.min(.06, (DASH_PUSH[S.tier] || .01) * S.dashAmt + kick + kick2 + pulse);
  }
  function timeScale() { if (calm() || S.hitStopUntil <= 0) return 1; const n = nowMs(); return n < S.hitStopUntil ? .06 : 1; }
  function punch(o) { if (calm() || !o) return; S.pn = PN; PN.vig = o.vig || 0; PN.flash = o.flash || 0; PN.chroma = o.chroma || 0; PN.sat = o.sat || 0; PN.push = o.push || 0; PN.dur = o.dur || .6; PN.x = o.x || 0; PN.z = o.z || 0; PN.ringR = o.ringR || 0; PN.ringW = o.ringW || 1; S.pnMs = nowMs(); }

  // =================================================================== WORLD VISUALS (built by effects.js, pooled)
  // Palettes per tier: I ash / ember orange-red, II molten amber-gold with white-hot sparks, III dark violet / black-red with bone-white flashes.
  const PAL = [null,
    { hot: [6, 2.9, .9], ring2: [2.8, .12, .04], crack: [3.6, 1.6, .4], spark: [4.5, 2.65, .9], ember: [2.8, .45, .11], emberHot: [3.6, 1.9, .5], red: [2.2, .16, .06], dust: [.10, .08, .065], debris: [.07, .058, .05],
      trail: [[5.6, 2.5, .7], [3.5, .6, .12], [1.5, .05, .025]], edge: [1, 1, 1], flash: [1, .6, .3] },
    { hot: [6, 4, 1.2], ring2: [3.6, 1.3, .1], crack: [4.2, 2.2, .5], spark: [6, 4.4, 1.3], ember: [3.6, 1.3, .2], emberHot: [5, 3.1, .7], red: [2.6, .35, .05], dust: [.11, .085, .06], debris: [.08, .06, .045],
      trail: [[7, 5.6, 1.9], [4.8, 2.0, .25], [1.6, .3, .03]], edge: [1, .8, .45], flash: [1, .8, .42] },
    { hot: [4.6, 3.8, 5.6], ring2: [1.7, .2, 2.4], crack: [3.2, .42, .5], spark: [5.5, 4.6, 6.2], ember: [2.4, .3, 3.0], emberHot: [3.8, .8, 2.4], red: [2.4, .06, .14], dust: [.05, .04, .055], debris: [.05, .04, .045],
      trail: [[3.2, 2.2, 4.0], [1.7, .22, 1.7], [.9, .02, .06]], edge: [.5, .22, 1.1], flash: [.82, .6, 1] }];
  const FLASH_SIZE = [0, .5, .62, .75], TRAIL_LIFE = [0, .6, .78, 1.0], TRAIL_W = [0, 1, 1.3, 1.75];

  const PLANE_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  // Ground trail: a camera-independent ribbon lying on the floor. Each point carries its birth time; the shader fades and cools it along the tier palette.
  const TRAIL_VS = `attribute vec4 aD;attribute float aU;varying float vAge,vS,vU;uniform float uNow;
void main(){vAge=uNow-aD.y;vS=aD.x;vU=aU;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const TRAIL_FS = `varying float vAge,vS,vU;uniform float uNow,uA,uLife,uSpeck,uFl;uniform vec3 uC0,uC1,uC2,uE;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  float k=clamp(vAge/uLife,0.,1.);float e=1.-abs(vS*2.-1.);
  float core=pow(e,3.2),soft=pow(e,1.3);
  float wake=exp(-pow((abs(vS*2.-1.)-(.48+.07*sin(vU*2.8-uNow*8.)))/.09,2.));
  float fl=1.-uFl*(.5-.5*sin(vU*15.+vS*7.+uNow*22.)*sin(vU*4.7-vS*3.1+uNow*5.));
  vec2 g=vec2(vU*7.,vS*3.4+floor(vU*7.)*.37);vec2 id=floor(g);vec2 f=fract(g)-.5;
  float speck=step(uSpeck,h(id))*pow(max(0.,1.-length(f)*2.),2.2)*(.6+.4*h(id+3.1));
  float life=pow(1.-k,1.05)*smoothstep(0.,.07,vAge);
  vec3 col=mix(uC0,uC1,smoothstep(0.,.3,k));col=mix(col,uC2,smoothstep(.25,.95,k));col*=mix(uE,vec3(1.),core);
  float a=(core*.66+soft*.22+wake*.29)*fl+speck*1.3*soft;a*=life*uA*.5;
  if(a<.004)discard;gl_FragColor=vec4(col*a*.22,1.);
}`;
  // Impact quad (one mesh, premultiplied alpha so fissures can be DARK): wind-up gather ring, slam shock ring + soft heat.
  // Narrow, unequal stone fractures branch off the impact, with brief ember edges and dark, fading cores.
  const IMP_FS = `varying vec2 vUv;uniform float uT1,uT2,uR,uR2,uSize,uTier,uG,uGR,uSeed,uFace;uniform vec3 uCa,uCb,uCc;
const float PI=3.14159265;
float hs(float n){return fract(sin(n*127.1+uSeed*31.7)*43758.5453);}
float ring(float r,float e,float w){float d=(r-e)/w;return exp(-d*d);}
float tri(float x){return abs(fract(x)-.5)*4.-1.;}
vec3 CC;float CA;
vec3 blade(vec2 p,float t,float R){
  vec2 d=vec2(sin(uFace),cos(uFace));float y=dot(p,d),x=dot(p,vec2(d.y,-d.x));
  float yn=y/max(R,.1);float taper=smoothstep(-.24,-.08,yn)*(1.-smoothstep(.24,.58,yn)),w=.08+.12*taper;
  float curve=R*(.20*yn*yn-.08*yn),cut=x-curve;
  float broken=1.-.70*exp(-pow((yn-.13)/.030,2.))-.65*exp(-pow((yn-.34)/.023,2.));
  float edge=exp(-pow(cut/w,2.))*taper*broken;
  float core=exp(-pow(cut/(w*.36),2.))*taper*broken;
  float life=smoothstep(0.,.025,t)*pow(max(0.,1.-t/.48),1.5);
  return (uCb*edge*.16+uCa*core*.15)*life;
}
void fissure(float r,float a,float N,float R,float Lm,float t,float so,float thick){
  float ang=(a/(2.*PI)+.5)*N;float id=mod(floor(ang+.5),N);float da=ang-floor(ang+.5);
  float seed=id*7.13+so,variation=hs(seed+3.);
  // Uneven stone breaks, not a regular star: each ray wanders and some finish close to the impact.
  float j=.16*(fract(variation*31.7)-.5)+.065*tri(r*1.4+seed)+.028*tri(r*3.9+seed*2.3);
  float dist=abs(da+j)*(2.*PI/N)*r;
  float L=R*(.29+.58*variation)*Lm;
  float run=(1.-smoothstep(L*.78,L,r))*smoothstep(r-.08,r+.08,L*clamp(t/.17,0.,1.));
  float taper=1.-smoothstep(.1,L,r),wid=(.024+.030*fract(variation*17.3))*thick*(.25+.75*taper);
  float edge=1.-smoothstep(wid*.9,wid*2.1,dist);
  float core=1.-smoothstep(wid*.18,wid*.75,dist);
  // A short, off-centre fork joins the parent break; it ends before the next angular sector.
  float start=L*(.26+.22*fract(variation*43.2)),br=max(0.,r-start);
  float forkJ=j+(fract(variation*57.1)>.5?1.:-1.)*min(.23,br*.12);
  float forkDist=abs(da+forkJ)*(2.*PI/N)*r;
  float forkRun=smoothstep(start,start+.09,r)*(1.-smoothstep(start+L*.23,start+L*.42,r))*run;
  float forkEdge=(1.-smoothstep(wid*.5,wid*1.4,forkDist))*forkRun;
  float forkCore=(1.-smoothstep(wid*.12,wid*.45,forkDist))*forkRun;
  edge=max(edge*run,forkEdge);core=max(core*run,forkCore);
  float heat=pow(max(0.,1.-t/.75),1.6),fade=1.-smoothstep(1.6,2.8,t);
  float chipped=.35+.65*smoothstep(-.5,.65,tri(r*5.2+seed*1.3));
  float ember=max(0.,edge-core*.8)*chipped*heat;
  CC+=uCc*ember*.045*fade;
  CA=max(CA,(core*.66+edge*.12)*fade);
}
void main(){
  vec2 p=(vUv-.5)*uSize;float r=length(p);float a=atan(p.x,p.y);vec3 col=vec3(0.);CC=vec3(0.);CA=0.;
  if(uG>0.){float e=uGR*(1.-uG)+.35;col+=uCa*.12*ring(r,e,.05+.035*(1.-uG))*uG*.35+uCb*exp(-r*r/.5)*uG*uG*.05;}
  if(uT1>=0.){
    float k=clamp(uT1/.5,0.,1.);float e=uR*(1.-pow(1.-k,3.));float w=.045+.075*k*uR*.25;
    float life=pow(1.-k,1.35)*smoothstep(0.,.02,uT1);
    col+=(uCa*ring(r,e,w*.58)+uCb*ring(r,e,w*2.2)*.10)*life*.12;
    col+=uCa*.5*exp(-r*r/(uR*uR*.22))*pow(1.-k,2.2)*.04*smoothstep(0.,.015,uT1);
    float k2=clamp((uT1-.05)/.5,0.,1.);col+=uCb*.9*ring(r,uR*.62*(1.-pow(1.-k2,2.5)),.07+.1*k2)*pow(1.-k2,1.6)*step(.05,uT1)*.075;
    col+=blade(p,uT1,uR);
    if(uTier>1.5){fissure(r,a,uTier>2.5?8.:6.,uR,uTier>2.5?1.05:.85,uT1,0.,1.);}
  }
  if(uT2>=0.){
    float k=clamp(uT2/.5,0.,1.);float e=uR2*(1.-pow(1.-k,3.));float w=.055+.08*k*uR2*.25;float life=pow(1.-k,1.3)*smoothstep(0.,.02,uT2);
    col+=(uCa*ring(r,e,w*.62)+uCb*ring(r,e,w*2.5)*.12)*life*.14;
    float k3=clamp((uT2-.07)/.5,0.,1.);col+=uCb*ring(r,uR2*.7*(1.-pow(1.-k3,2.5)),.1+.12*k3)*pow(1.-k3,1.5)*step(.07,uT2)*.085;
    col+=uCa*.5*exp(-r*r/(uR2*uR2*.2))*pow(1.-k,2.4)*.03*smoothstep(0.,.015,uT2);
    col+=blade(p,uT2,uR2);
    fissure(r,a,9.,uR2,1.0,uT2,7.,1.2);
  }
  col+=CC;
  float m=max(max(col.r,col.g),max(col.b,CA));if(m<.004)discard;
  float fe=1.-smoothstep(uSize*.42,uSize*.5,r);gl_FragColor=vec4(col*fe,CA*fe);
}`;

  const TN = 64;   // trail points
  function createWorld(o) {
    const T = o.T, root = o.root, emit = o.emit, particle = o.particle, sc = o.scaleCount, flashFx = o.flash, scarFx = o.scar, ringFx = o.ring;
    // ---- trail ribbon
    const posA = new Float32Array(TN * 2 * 3), dA = new Float32Array(TN * 2 * 4), uA = new Float32Array(TN * 2), idx = new Uint16Array((TN - 1) * 6);
    for (let i = 0; i < TN - 1; i++) { const q = i * 2; idx.set([q, q + 1, q + 2, q + 1, q + 3, q + 2], i * 6); }
    const tg = new T.BufferGeometry();
    tg.setAttribute('position', new T.BufferAttribute(posA, 3).setUsage(T.DynamicDrawUsage)); tg.setAttribute('aD', new T.BufferAttribute(dA, 4).setUsage(T.DynamicDrawUsage));
    tg.setAttribute('aU', new T.BufferAttribute(uA, 1).setUsage(T.DynamicDrawUsage)); tg.setIndex(new T.BufferAttribute(idx, 1)); tg.setDrawRange(0, 0);
    const v3 = a => new T.Vector3(a[0], a[1], a[2]);
    const TU = { uNow: { value: 0 }, uW: { value: 1 }, uA: { value: 1 }, uLife: { value: .6 }, uSpeck: { value: .78 }, uFl: { value: .76 }, uC0: { value: v3(PAL[1].trail[0]) }, uC1: { value: v3(PAL[1].trail[1]) }, uC2: { value: v3(PAL[1].trail[2]) }, uE: { value: v3(PAL[1].edge) } };
    const tMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false, uniforms: TU, vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 });
    const trail = new T.Mesh(tg, tMat); trail.frustumCulled = false; trail.renderOrder = 3; trail.visible = false; trail.name = 'charge-trail'; root.add(trail);
    // circular buffers of trail points (x, z, birth, cumulative distance)
    const px = new Float32Array(TN), pz = new Float32Array(TN), py = new Float32Array(TN), pb = new Float32Array(TN), pu = new Float32Array(TN); let head = 0, cnt = 0, uAcc = 0, lastX = 0, lastZ = 0, haveLast = false;
    // ---- impact quad
    const IU = { uT1: { value: -1 }, uT2: { value: -1 }, uR: { value: 2.2 }, uR2: { value: 5 }, uSize: { value: 10 }, uTier: { value: 1 }, uG: { value: 0 }, uGR: { value: 1.6 }, uSeed: { value: 1 }, uFace: { value: 0 }, uCa: { value: v3(PAL[1].hot) }, uCb: { value: v3(PAL[1].ring2) }, uCc: { value: v3(PAL[1].crack) } };
    const iGeo = new T.PlaneGeometry(1, 1);
    const iMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, fog: false, uniforms: IU, vertexShader: PLANE_VS, fragmentShader: IMP_FS, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -4 });
    const quad = new T.Mesh(iGeo, iMat); quad.rotation.x = -Math.PI / 2; quad.frustumCulled = false; quad.renderOrder = 4; quad.visible = false; quad.name = 'charge-impact'; root.add(quad);
    const heightAt = (x, z) => { const w = B.app && B.app.world; return w && w.effectHeightAt ? w.effectHeightAt(x, z, .85) : .065; };
    let clock = 0, trailLive = false, quadAge1 = -1, quadAge2 = -1, gather = 0, tier = 1, shownUntil = 0, floorY = .065, startX = 0, startZ = 0, pal = PAL[1];
    const color = new T.Color();
    let seed = 20261003; const R = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const rr = (a, b) => a + R() * (b - a);
    const FX = { spin: 0, spinAt: { x: 0, z: 0 }, chroma: 0, flash: 0, sat: 0, vig: 0, ring: { x: 0, z: 0, r: 0, w: 1, t: 0 } }, FXR = FX.ring;
    const setPal = t => { pal = PAL[t]; TU.uC0.value.set(pal.trail[0][0], pal.trail[0][1], pal.trail[0][2]); TU.uC1.value.set(pal.trail[1][0], pal.trail[1][1], pal.trail[1][2]); TU.uC2.value.set(pal.trail[2][0], pal.trail[2][1], pal.trail[2][2]); TU.uE.value.set(pal.edge[0], pal.edge[1], pal.edge[2]);
      IU.uCa.value.set(pal.hot[0], pal.hot[1], pal.hot[2]); IU.uCb.value.set(pal.ring2[0], pal.ring2[1], pal.ring2[2]); IU.uCc.value.set(pal.crack[0], pal.crack[1], pal.crack[2]);
      TU.uLife.value = TRAIL_LIFE[t]; TU.uW.value = TRAIL_W[t]; TU.uSpeck.value = [0, .78, .6, .86][t]; TU.uFl.value = [0, .76, .6, .3][t]; IU.uTier.value = t; };

    function trailReset() { head = 0; cnt = 0; uAcc = 0; haveLast = false; }
    function trailPush(x, z) {
      if (haveLast) { const d = Math.hypot(x - lastX, z - lastZ); if (d < .2) return; uAcc += d; }
      lastX = x; lastZ = z; haveLast = true;
      px[head] = x; pz[head] = z; py[head] = heightAt(x, z) + .035; pb[head] = clock; pu[head] = uAcc; head = (head + 1) % TN; if (cnt < TN) cnt++;
      trail.visible = true; trailLive = true;
    }
    function trailFill() {
      // drop dead points from the tail, then write the strip oldest -> newest
      const life = TRAIL_LIFE[tier];
      while (cnt > 0 && clock - pb[(head - cnt + TN) % TN] > life + .02) cnt--;
      if (cnt < 2) { tg.setDrawRange(0, 0); if (cnt === 0) { trail.visible = false; trailLive = false; } return; }
      const comet = tier === 3, uW = TU.uW.value; let n = 0;
      for (let k = 0; k < cnt; k++) {
        const i = (head - cnt + k + TN) % TN, a = (head - cnt + Math.max(0, k - 1) + TN) % TN, b = (head - cnt + Math.min(cnt - 1, k + 1) + TN) % TN;
        let tx = px[b] - px[a], tz = pz[b] - pz[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const age = clamp(clock - pb[i], 0, life), an = age / life;
        // tiers I / II: a plume that widens as it ages; tier III: a comet, widest at the hero and narrowing down the tail
        const w = (comet ? (.4 + .55 * (1 - an) * (1 - an)) * Math.min(1, .45 + age * 8) : (.16 + .6 * Math.sqrt(an) * (1 - age * .3)) * Math.min(1, .12 + age * 8)) * uW;
        for (let s = 0; s < 2; s++) {
          const v = n * 2 + s, o2 = (s * 2 - 1) * w;
          posA[v * 3] = px[i] - tz * o2; posA[v * 3 + 1] = py[i]; posA[v * 3 + 2] = pz[i] + tx * o2;
          dA[v * 4] = s; dA[v * 4 + 1] = pb[i]; dA[v * 4 + 2] = 0; dA[v * 4 + 3] = 0; uA[v] = pu[i];
        }
        n++;
      }
      tg.setDrawRange(0, (n - 1) * 6);
      tg.attributes.position.needsUpdate = true; tg.attributes.aD.needsUpdate = true; tg.attributes.aU.needsUpdate = true;
    }
    function placeQuad(x, z, size) { floorY = heightAt(x, z); quad.position.set(x, floorY + .04, z); quad.scale.set(size, size, 1); IU.uSize.value = size; quad.visible = true; shownUntil = clock + 9; }

    // ---- wind-up: dust ring + embers pulled into the feet; a faint converging ring on the floor. Tier III: the roar (outward shock ring, dark dust, violet embers).
    function windup(x, z, face, t) {
      tier = t; trailReset(); setPal(t); IU.uSeed.value = rr(1, 90); startX = x; startZ = z;
      IU.uT1.value = IU.uT2.value = quadAge1 = quadAge2 = -1; IU.uGR.value = 1.5 + .35 * t;
      placeQuad(x, z, 5.5); gather = 1; IU.uG.value = 0.001;
      const n = sc(14 + 6 * t), floor = heightAt(x, z);
      for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .3, r0 = .5 + R() * .2; emit(x + Math.sin(a) * r0, floor + .06, z + Math.cos(a) * r0, 2, pal.dust, Math.sin(a) * (1.5 + .5 * t), .25, Math.cos(a) * (1.5 + .5 * t), .5, .24); }
      const m = sc(10 + 6 * t);
      for (let i = 0; i < m; i++) { const a = R() * TAU, r0 = .9 + R() * (.9 + .4 * t); emit(x + Math.sin(a) * r0, floor + .1 + R() * .7, z + Math.cos(a) * r0, 4, i % 3 ? pal.ember : pal.emberHot, -Math.sin(a) * r0 / .14, .6, -Math.cos(a) * r0 / .14, .16 + R() * .06, .055); }
      if (t === 3) {
        if (ringFx) ringFx(x, z, 5.5, .55, [.35, .06, .6]);
        for (let i = 0, k = sc(22); i < k; i++) { const a = i / k * TAU; particle(x + Math.sin(a) * .8, floor + .1, z + Math.cos(a) * .8, 2, pal.dust, 3.2, a, .5); }
        S.roarMs = nowMs(); punch({ vig: .3, chroma: .12, flash: .02, push: .018, dur: .55, x, z, ringR: 5, ringW: .9 });
      }
    }
    function gatherSet(u) { gather = u; IU.uG.value = u > 0 ? Math.min(1, u) : 0; }
    // ---- dash: ribbon points, dust puffs at the feet, spark streaks beside the weapon / shoulder; tier II molten drops, tier III dark ember wake and a bow wave
    let sparkAcc = 0, dustAcc = 0, bowAcc = 0;
    function dash(x, z, face, speed, dt) {
      if (gather > 0) { gather = 0; IU.uG.value = 0; }
      trailPush(x - Math.sin(face) * .15, z - Math.cos(face) * .15);
      const sx = Math.sin(face), cz = Math.cos(face), floor = floorY, step = speed * dt, t = tier;
      dustAcc += step; sparkAcc += step; bowAcc += step;
      while (dustAcc > (t === 3 ? .4 : .55)) {
        dustAcc -= t === 3 ? .4 : .55; const side = R() < .5 ? -1 : 1;
        emit(x + cz * side * .3, floor + .08, z - sx * side * .3, 2, pal.dust, -sx * 1.4 + cz * side * 1.2, .5 + R() * .4, -cz * 1.4 - sx * side * 1.2, .55 + R() * .3, .3 + R() * .22 + .1 * t);
        if (R() < .6) emit(x, floor + .05, z, 0, pal.debris, -sx * 2 + rr(-1, 1), 1 + R() * 1.4, -cz * 2 + rr(-1, 1), .35, .05 + R() * .04);
      }
      while (sparkAcc > (t === 1 ? .3 : .17)) {   // speed lines: hot streaks left hanging beside the weapon / shoulder
        sparkAcc -= t === 1 ? .3 : .17; const side = R() < .5 ? -1 : 1, hy = .55 + R() * 1.1;
        emit(x + cz * side * (.35 + R() * .5), floor + hy, z - sx * side * (.35 + R() * .5), 1, R() < .5 ? pal.spark : pal.emberHot, -sx * speed * .35, .2 + R() * .3, -cz * speed * .35, .18 + R() * .12, .05 + R() * .04);
        if (t > 1 && R() < .75) emit(x, floor + .1, z, 4, R() < .5 ? pal.ember : pal.red, -sx * 2 + rr(-.7, .7), .8 + R() * 1.4, -cz * 2 + rr(-.7, .7), (.5 + R() * .35) * (t === 3 ? 1.4 : 1), .05 + .02 * t);
        if (t === 2) {   // molten drops flung off the shoulder and dropped on the floor behind
          const sd = R() < .5 ? -1 : 1; emit(x + cz * sd * .5, floor + .5 + R() * .4, z - sx * sd * .5, 1, pal.spark, -sx * speed * .15 + cz * sd * 2.2, 1.2 + R() * 1.6, -cz * speed * .15 - sx * sd * 2.2, .35 + R() * .25, .06 + R() * .04);
        }
        if (t === 3) {   // black smoke and violet fire left in the wake
          emit(x - sx * .4, floor + .3 + R() * .5, z - cz * .4, 2, pal.dust, -sx * 1.6, .7 + R() * .8, -cz * 1.6, .8 + R() * .5, .42 + R() * .3);
          emit(x - sx * .2 + rr(-.5, .5), floor + .2 + R() * .9, z - cz * .2 + rr(-.5, .5), 4, R() < .6 ? pal.ember : pal.red, -sx * 1.2, .5 + R() * 1.2, -cz * 1.2, .7 + R() * .5, .07);
        }
      }
      while (bowAcc > .28 && t > 1) {   // bow wave: sparks thrown ahead and to the sides of the ramming shoulder
        bowAcc -= .28; const a = face + rr(-1.2, 1.2);
        emit(x + sx * .8, floor + .3 + R() * .8, z + cz * .8, 1, t === 3 && R() < .5 ? pal.spark : pal.emberHot, Math.sin(a) * speed * .22, .6 + R() * 1.2, Math.cos(a) * speed * .22, .22 + R() * .15, .06 + R() * .04);
      }
    }
    // ---- impact: ring + fissures + debris. second = tier-3 second slam (the quad keeps its first ring, adds the second).
    function impact(x, z, face, t, radius, second, r2) {
      const big = 1 + .22 * (t - 1);
      setPal(t); tier = t; IU.uFace.value=face;
      if (!second) {
        IU.uR.value = radius; IU.uR2.value = r2 || radius * 1.2; IU.uSeed.value = rr(1, 90); gatherSet(0);
        placeQuad(x, z, Math.max(radius, r2 || 0) * 2.6 + 1.2); IU.uT1.value = quadAge1 = 0; IU.uT2.value = quadAge2 = -1;
        if (t === 1) scarFx && scarFx(x, z, 0, { shape: 'circle', radius: radius * .55, heat: .25 });
        else if (scarFx) { scarFx(x, z, 0, { shape: 'circle', radius: radius * .8, heat: .3 }); const L = Math.hypot(x - startX, z - startZ); if (L > 1) scarFx(startX, startZ, face, { shape: 'line', width: t === 3 ? 2.1 : 1.1, length: L, heat: .3 }); }
      } else { IU.uR2.value = r2 || radius; quadAge2 = 0; IU.uT2.value = 0; shownUntil = clock + 9; if (scarFx) scarFx(x, z, 0, { shape: 'circle', radius: (r2 || radius) * .75, heat: .3 }); }
      const floor = floorY, n = sc(second ? 24 : 16 + 7 * t);
      if (o.fragments) o.fragments(x, floor + .12, z, { count: second ? 24 : 10 + 6*t, spread: .65*big, speed: 3.4*big, lift: second ? 6 : 3.8*big, face, arc: second ? TAU : 3.4, size: .075 });
      for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .7; emit(x + Math.sin(a) * .5, floor + .1, z + Math.cos(a) * .5, 2, pal.dust, Math.sin(a) * rr(2.6, 4.4) * big, .28, Math.cos(a) * rr(2.6, 4.4) * big, .60 + R() * .3, .22 + R() * .20 + .04 * t); }
      for (let i = 0, m = sc(second ? 20 : 14 * big); i < m; i++) particle(x, floor + .15, z, 0, pal.debris, 1.5 * big, R() * TAU, 1.3);
      for (let i = 0, m = sc(second ? 16 : 14 * big); i < m; i++) { const a = (second ? R() * TAU : face + rr(-1.5, 1.5)); particle(x, floor + .25, z, 1, i % 3 ? pal.spark : pal.emberHot, 1.3 * big, a, .8); }
      for (let i = 0, m = sc(second ? 14 : 8 + 4 * t); i < m; i++) { const a = R() * TAU, r0 = R() * radius * .6; emit(x + Math.sin(a) * r0, floor + .1, z + Math.cos(a) * r0, 4, i % 2 ? pal.ember : pal.red, Math.sin(a) * rr(.2, 1.6), rr(.35, 1.4), Math.cos(a) * rr(.2, 1.6), rr(.4, .8), .035); }
      if (t >= 2) {   // directional weapon impact: low, forward chips rather than a tall fountain
        for (let i = 0, m = sc(second ? 18 : 12 * (t - 1)); i < m; i++) { const a = second ? R()*TAU : face+rr(-1.0,1.0), r0 = R() * radius * .45; emit(x + Math.sin(a) * r0, floor + .1, z + Math.cos(a) * r0, 1, pal.spark, Math.sin(a) * rr(0, 2.2), rr(.55, 2.0), Math.cos(a) * rr(1, 3.4), rr(.3, .65), .045); }
      }
      if (ringFx) { if (t === 2) ringFx(x, z, radius * 1.15, .45, [pal.ring2[0] * .2, pal.ring2[1] * .2, pal.ring2[2] * .25]); if (t === 3) ringFx(x, z, (second ? r2 : radius) * 1.1, second ? .6 : .5, [pal.ring2[0] * .2, pal.ring2[1] * .2, pal.ring2[2] * .25]); }
      flashFx(x, floor + .5, z, FLASH_SIZE[t] * (second ? 1.15 : 1), color.setRGB(pal.flash[0], pal.flash[1], pal.flash[2]), .06, 0);
      if (second) S.impact2Ms = nowMs(); else S.impactMs = nowMs();
      S.tier = t; if (second) { S.i2x = x; S.i2z = z; S.r2 = r2 || radius; } else { S.ix = x; S.iz = z; }
    }
    function struck(x, y, z, face, strong) {   // ember burst on a struck enemy (blood comes from the damage path itself)
      for (let i = 0, m = sc((strong ? 12 : 6) + 2 * tier); i < m; i++) particle(x, y, z, i % 2 ? 1 : 4, i % 3 ? pal.emberHot : pal.spark, strong ? 1.2 : .8, face + rr(-1.4, 1.4), .8);
      flashFx(x, y, z, strong ? 1.2 : .8, color.setRGB(pal.flash[0], pal.flash[1], pal.flash[2]), .07, 0);
    }
    // a foe bowled aside by the dash: tier II sparks and dust, tier III a harder hurl with debris, violet fire and a flash
    function shove(x, z, face, y) {
      const t = tier, base = y || .12;
      for (let i = 0, m = sc(5 + 4 * t); i < m; i++) particle(x, .12, z, 2, pal.dust, .8 + .3 * t, face + rr(-1, 1), .35);
      if (t < 2) return;
      for (let i = 0, m = sc(t === 3 ? 18 : 10); i < m; i++) particle(x, base + .7, z, 1, i % 2 ? pal.spark : pal.emberHot, 1.2 + .3 * t, face + rr(-1.1, 1.1), 1);
      if (t === 3) { for (let i = 0, m = sc(8); i < m; i++) particle(x, base + .4, z, 0, pal.debris, 1.6, face + rr(-1, 1), 1.5); for (let i = 0, m = sc(8); i < m; i++) emit(x, base + .6, z, 4, i % 2 ? pal.ember : pal.red, Math.sin(face) * rr(.5, 2.5), rr(1, 3), Math.cos(face) * rr(.5, 2.5), rr(.5, .9), .06); }
      flashFx(x, .9, z, t === 3 ? 1.1 : .8, color.setRGB(pal.flash[0], pal.flash[1], pal.flash[2]), .07, 0);
    }
    function endDash() { if (gather > 0) gatherSet(0); }

    // ---- per frame (effects.js signatureStep)
    const env = (age, tau) => age >= 0 && age < 1 ? Math.exp(-age * tau) : 0;
    function step(dt) {
      clock += dt; TU.uNow.value = clock;
      const lim = tier >= 2 ? 3.4 : 1.5;
      if (quadAge1 >= 0) { quadAge1 += dt; IU.uT1.value = quadAge1; if (quadAge1 > lim) { quadAge1 = -1; IU.uT1.value = -1; } }
      if (quadAge2 >= 0) { quadAge2 += dt; IU.uT2.value = quadAge2; if (quadAge2 > lim) { quadAge2 = -1; IU.uT2.value = -1; } }
      if (quad.visible && quadAge1 < 0 && quadAge2 < 0 && gather <= 0) quad.visible = false;
      if (trailLive) trailFill();
      // screen layer: Post.setAbilityFx every frame something is going on (values merge by max with the other skills)
      const post = B.app && B.app.post, inst = S.inst, n = nowMs(), age = (n - S.impactMs) / 1000, age2 = (n - S.impact2Ms) / 1000, pa = (n - S.pnMs) / 1000;
      if (!post || !post.setAbilityFx || calm() || (B.LevelUp && B.LevelUp.active)) return;
      const live = inst && !inst.done, k = S.tier / 3, pon = S.pn && pa >= 0 && pa < S.pn.dur;
      if (!live && age > .8 && age2 > .8 && !pon) return;
      const fa = .03 * (.5 + .5 * k);
      FX.flash = Math.max(age < .5 ? fa * Math.exp(-age * 11) * clamp(age / .01, 0, 1) : 0, age2 < .5 ? fa * 1.3 * Math.exp(-age2 * 11) * clamp(age2 / .01, 0, 1) : 0);
      FX.vig = Math.max(age < .8 ? (.2 + .3 * k) * clamp(age / .03, 0, 1) * Math.exp(-Math.max(0, age - .03) * 6.5) : 0, age2 < .8 ? (.3 + .3 * k) * clamp(age2 / .03, 0, 1) * Math.exp(-Math.max(0, age2 - .03) * 5.5) : 0);
      FX.sat = Math.max(age < .6 ? .1 * Math.exp(-age * 6) : 0, age2 < .6 ? .12 * Math.exp(-age2 * 6) : 0); FX.chroma = Math.max(age < .4 ? .12 * Math.exp(-age * 9) : 0, age2 < .4 ? .16 * Math.exp(-age2 * 9) : 0);
      FX.spin = live ? (.1 + .05 * k) * S.dashAmt : 0; FX.spinAt.x = S.hx; FX.spinAt.z = S.hz;
      if (live) FX.vig = Math.max(FX.vig, (.1 + .08 * k) * S.dashAmt);
      // shock ring in the post pass: tier II at the slam, tier III at both slams (the second one wide)
      FXR.r = 0;
      if (S.tier >= 2 && age2 >= 0 && age2 < .6) { FXR.x = S.i2x; FXR.z = S.i2z; FXR.r = S.r2 * (.15 + .85 * Math.min(1, age2 / .5)); FXR.w = 1.3; FXR.t = age2 / .6; }
      else if (S.tier >= 2 && age >= 0 && age < .5) { FXR.x = S.ix; FXR.z = S.iz; FXR.r = 4.4 * Math.min(1, .15 + age / .4); FXR.w = 1; FXR.t = age / .5; }
      if (pon) {
        const e = Math.exp(-pa * 4 / S.pn.dur), s = clamp(pa / .03, 0, 1);
        FX.vig = Math.max(FX.vig, PN.vig * e * s); FX.flash = Math.max(FX.flash, PN.flash * e * s); FX.chroma = Math.max(FX.chroma, PN.chroma * e * s); FX.sat = Math.max(FX.sat, PN.sat * e * s);
        if (PN.ringR > 0 && !(FXR.r > 0)) { FXR.x = PN.x; FXR.z = PN.z; FXR.r = PN.ringR * (.15 + .85 * Math.min(1, pa / (S.pn.dur * .8))); FXR.w = PN.ringW; FXR.t = pa / S.pn.dur; }
      }
      if (!(FXR.r > 0)) { FX.ring = null; } else FX.ring = FXR;
      post.setAbilityFx(FX);
    }
    function clear() { trailReset(); tg.setDrawRange(0, 0); trail.visible = false; trailLive = false; quad.visible = false; quadAge1 = quadAge2 = -1; IU.uT1.value = IU.uT2.value = -1; gather = 0; IU.uG.value = 0; }
    // warm-up helper (effects.js burst 'chargeFx')
    function demo(d) {
      const x = d.x || 0, z = d.z || 0, f = d.face || 0, t = tierOf(d.tier || 3);
      windup(x, z, f, t); gatherSet(.6);
      for (let i = 0; i < 6; i++) { dash(x + Math.sin(f) * i * .4, z + Math.cos(f) * i * .4, f, 18, .02); }
      trailFill(); impact(x, z, f, t, 3, false, 4); impact(x, z, f, t, 3, true, 4); struck(x, 1, z, f, true); shove(x, z, f, 1); punch({ vig: .1, ringR: 3 }); step(.016); S.impactMs = S.impact2Ms = S.pnMs = -1e9; clear();
    }
    function dispose() { clear(); trail.removeFromParent(); quad.removeFromParent(); for (const g of [tg, iGeo]) g.dispose(); tMat.dispose(); iMat.dispose(); if (B.Charge && B.Charge._world === api) B.Charge._world = null; }
    const api = { windup, gather: gatherSet, dash, impact, struck, shove, endDash, step, clear, demo, dispose, parts: [{ geo: tg, mat: tMat }, { geo: iGeo, mat: iMat }] };
    B.Charge._world = api;
    return api;
  }

  // =================================================================== SIMULATION
  const POOL = [];
  function newInst() {
    return { done: true, ctx: null, st: null, t: 0, phase: 0, face: 0, dx: 0, dz: 0, sx: 0, sz: 0, dist: 0, traveled: 0, speed: 0, dashPlanned: 0, dashT: 0, duration: 0,
      primary: null, impacted: false, impactT: 0, impactX: 0, impactZ: 0, second: false, slam2T: 0, invulnerable: false, noKnockback: true, serial: 0, hitSet: new Set(), ringSet: new Set(),
      pose: POSE, update: null, cancel: null };
  }
  function evt(i, name, x, z) { const c = i.ctx; if (c && c.emit) try { c.emit('charge', { phase: name, tier: i.st.tier, x, z }); } catch (e) {} }
  function snd(i, name, x, z, extra) { const c = i.ctx; if (c && c.sound) try { const p = { x, z, tier: i.st.tier }; if (extra) Object.assign(p, extra); c.sound(name, p); } catch (e) {} }
  function alive(e) { return e && !e.dead && Number.isFinite(e.x) && Number.isFinite(e.z); }
  // Combat owns walls, closed seals and underground bodies. Apply its
  // predicate before choosing, stopping on or affecting a target.
  function eligible(i, e) { return alive(e) && (!i.ctx.canHit || i.ctx.canHit(e)); }
  function hurt(i, e, amount, opts) { const c = i.ctx; if (c.damage && amount > 0) { opts.kind = 'charge'; opts.face = i.face; c.damage(e, Math.round(amount), opts); } }
  function stunE(i, e, sec) { const c = i.ctx; if (c.stun && sec > 0) c.stun(e, e.boss ? sec * .35 : sec); }
  function pushE(i, e, ux, uz, f) { const c = i.ctx; if (c.push && f > 0 && !e.boss) c.push(e, ux, uz, f); }
  const SHAKE = [0, .55, .85, 1.15];

  function slam(i, x, z, second) {
    const st = i.st, c = i.ctx, W = B.Charge._world, radius = second ? st.secondRadius : st.impactRadius;
    // primary = the closest living foe to the impact point inside the radius (tier 1: the one that stopped the dash)
    let primary = eligible(i, i.primary) ? i.primary : null;
    if (!second && !primary) { let bd = 1e9; for (const e of c.enemies || []) { if (!alive(e)) continue; const d = Math.hypot(e.x - x, e.z - z) - e.radius; if (d < radius && d < bd && eligible(i, e)) { bd = d; primary = e; } } }
    let hits = 0;
    for (const e of c.enemies || []) {
      if (!alive(e)) continue;
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
      if (d - (e.radius || .5) * .5 > radius || !eligible(i, e)) continue;
      const ux = d > .05 ? dx / d : Math.sin(i.face), uz = d > .05 ? dz / d : Math.cos(i.face), isP = e === primary && !second;
      if (second) { hurt(i, e, st.secondDamage * (1 - .35 * d / radius), { second: true, ring: true, heavy: true }); stunE(i, e, st.stunSeconds * .6); pushE(i, e, ux, uz, st.knock * .8 * (1 - .4 * d / radius)); }
      else {
        hurt(i, e, isP ? st.damage : st.damage * st.ringDamageMul * (1 - .3 * d / radius), { primary: isP, ring: !isP, heavy: true });
        stunE(i, e, isP ? st.stunSeconds : st.stunSeconds * .6); pushE(i, e, ux, uz, st.knock * (isP ? .6 : 1) * (1 - .45 * d / radius));
      }
      hits++; if (W) W.struck(e.x, 1.1, e.z, Math.atan2(ux, uz), isP);
    }
    if (W) W.impact(x, z, i.face, st.tier, radius, second, st.second ? st.secondRadius : 0);
    snd(i, second ? 'chargeSlam2' : 'chargeImpact', x, z, { hits: hits > 0, attack: 'Mezar' });
    evt(i, second ? 'slam2' : 'impact', x, z);
    if (c.emit) try { c.emit('impact', { x, z, strength: SHAKE[st.tier] * (second ? 1.25 : 1), radius }); } catch (e) {}
    const hs = calm() ? 0 : st.hitStop * (second ? .8 : 1); if (hs > 0) { S.hitStopUntil = nowMs() + hs * 1000; S.hitStopMs = hs * 1000; }
    if (!second) { i.impacted = true; i.impactT = i.t; i.impactX = x; i.impactZ = z; }
  }

  function begin(ctx, tier) {
    if (!ctx || !ctx.player || !ctx.target) return null;
    tier = tierOf(tier);
    const p = ctx.player, tx = +ctx.target.x, tz = +ctx.target.z;
    if (!Number.isFinite(tx) || !Number.isFinite(tz) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
    const st = Object.assign(stats(tier), ctx.stats || {});
    if (!(st.dashTime > 0)) st.dashTime = st.range / (st.speed || 20);
    let dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 1.8) return null;
    if (d > st.range) { dx *= st.range / d; dz *= st.range / d; d = st.range; }
    const ux = dx / d, uz = dz / d, rad = p.radius || .5, w = ctx.world;
    if (w && w.isWalkable && !w.isWalkable(p.x + ux * .7, p.z + uz * .7, rad)) return null;   // wall right in front: refuse
    if (S.inst && !S.inst.done) S.inst.cancel();
    let i = POOL.find(q => q.done); if (!i) { i = newInst(); POOL.push(i); }
    const dashT = d / st.range * st.dashTime;
    i.done = false; i.ctx = ctx; i.st = st; i.t = 0; i.phase = 0; i.face = Math.atan2(ux, uz); i.dx = ux; i.dz = uz; i.sx = p.x; i.sz = p.z; i.dist = d; i.traveled = 0; i.speed = st.range / st.dashTime;
    i.dashPlanned = dashT; i.dashT = 0; i.duration = st.wind + dashT + st.recover + (st.second ? st.secondDelay : 0); i.impacted = false; i.impactT = 0; i.second = false; i.slam2T = 0; i.primary = null; i.invulnerable = true; i.noKnockback = true;
    i.hitSet.clear(); i.ringSet.clear(); i.serial = ++S.serial; i.update = update.bind(null, i); i.cancel = cancelInst.bind(null, i); i.pose = POSE;
    p.face = i.face; if (Number.isFinite(p.yaw)) p.yaw = i.face;
    S.inst = i; S.tier = tier; S.dashAmt = 0; S.hx = p.x; S.hz = p.z; S.hitStopUntil = 0;
    const W = B.Charge._world; if (W) W.windup(p.x, p.z, i.face, tier);
    snd(i, 'chargeWind', p.x, p.z); if (tier === 3) snd(i, 'chargeRoar', p.x, p.z); evt(i, 'wind', p.x, p.z);
    return i;
  }

  function finish(i) {
    if (i.done) return; i.done = true; i.invulnerable = false; i.noKnockback = false; if (S.inst === i) { S.dashAmt = 0; }
    const W = B.Charge._world; if (W) W.endDash();
    evt(i, 'end', i.ctx && i.ctx.player ? i.ctx.player.x : 0, i.ctx && i.ctx.player ? i.ctx.player.z : 0);
  }
  function cancelInst(i) { if (i.done) return; const W = B.Charge._world; finish(i); if (W) W.gather(0); }

  function pathHits(i, ox, oz, nx, nz) {
    const st = i.st, c = i.ctx, vx = nx - ox, vz = nz - oz, l2 = vx * vx + vz * vz, W = B.Charge._world, half = st.pathWidth * .5, rad = (c.player.radius || .5);
    for (const e of c.enemies || []) {
      if (!alive(e) || i.hitSet.has(e)) continue;
      const t = l2 > 1e-8 ? clamp(((e.x - ox) * vx + (e.z - oz) * vz) / l2, 0, 1) : 0, cx = ox + vx * t, cz = oz + vz * t, dd = Math.hypot(e.x - cx, e.z - cz);
      if (st.stopAtFirst) {
        if (dd > (e.radius || .5) + rad + .12 || !eligible(i, e)) continue;
        i.hitSet.add(e); i.primary = e; return true;   // the dash ends on the first foe (impact there)
      }
      if (dd > (e.radius || .5) + half || !eligible(i, e)) continue;
      i.hitSet.add(e);
      const side = (e.x - cx) * i.dz - (e.z - cz) * i.dx, s = side >= 0 ? 1 : -1, ux = i.dz * s, uz = -i.dx * s;   // perpendicular to the path, away from the line
      hurt(i, e, st.pathDamage, { path: true });
      pushE(i, e, ux * .85 + i.dx * .35, uz * .85 + i.dz * .35, st.pathShove);
      if (W) W.shove(e.x, e.z, Math.atan2(ux, uz), 1);
    }
    return false;
  }

  function update(i, dt) {
    if (i.done) return true;
    const c = i.ctx, p = c.player, st = i.st, W = B.Charge._world;
    if (!p || p.dead || (c.game && c.game.state && c.game.state !== 'playing')) { cancelInst(i); return true; }
    if (!(dt > 0)) return false;
    i.t += dt;
    if (p.push) { p.push.x = 0; p.push.z = 0; }   // never shoved while charging
    p.face = i.face;
    if (i.phase === 0) {
      if (W) W.gather(clamp(i.t / st.wind, 0, 1));
      if (i.t >= st.wind) { i.phase = 1; if (W) W.gather(0); snd(i, 'chargeDash', p.x, p.z); evt(i, 'dash', p.x, p.z); } else return false;
    }
    if (i.phase === 1) {
      const left = i.t - dt < st.wind ? i.t - st.wind : dt;   // the part of this frame that belongs to the dash
      i.dashT += left; i.invulnerable = i.dashT < st.iframe;
      let step = Math.min(i.speed * left, i.dist - i.traveled), stopped = false;
      const ox = p.x, oz = p.z;
      if (step > 0) {
        if (c.world && c.world.move) c.world.move(p, i.dx * step, i.dz * step, p.radius || .5); else { p.x += i.dx * step; p.z += i.dz * step; }
        const moved = Math.hypot(p.x - ox, p.z - oz); i.traveled += moved;
        if (moved < step * .5 && step > .05) stopped = true;       // a wall: the dash ends here with the shock
        if (pathHits(i, ox, oz, p.x, p.z)) stopped = true;
      }
      S.dashAmt = clamp(S.dashAmt + (stopped ? -1 : 1) * dt * 9, 0, 1); S.hx = p.x; S.hz = p.z;
      if (W) W.dash(p.x, p.z, i.face, i.speed, left);
      if (stopped || i.traveled >= i.dist - .02) { i.phase = 2; i.invulnerable = false; slam(i, p.x, p.z, false); S.dashAmt = 0; if (W) W.endDash(); }
      return false;
    }
    // follow-through (and the tier-3 second slam)
    S.dashAmt = 0;
    if (st.second && !i.second && i.t - i.impactT >= st.secondDelay) { i.second = true; i.slam2T = i.t; slam(i, i.impactX, i.impactZ, true); }
    if (st.second ? (i.second && i.t - i.slam2T >= st.recover * .9) : i.t - i.impactT >= st.recover) { finish(i); return true; }
    return false;
  }
  function cancel() { if (S.inst && !S.inst.done) S.inst.cancel(); const W = B.Charge._world; if (W) W.clear(); S.hitStopUntil = 0; S.dashAmt = 0; S.pnMs = -1e9; }

  B.Charge = Object.assign(B.Charge || {}, { begin, range, stats, poseState, cameraPush, timeScale, cancel, createWorld, punch, tiers: TIERS });
  Object.defineProperty(B.Charge, 'active', { get() { return !!(S.inst && !S.inst.done); }, configurable: true });
})();
