/* KABİR AZABI — look & feel of the heavy-strike line (Mezar Yaran / Kemik Kıran / Kabir Balyozu) and the shout line (Kan Nidası / Ölüm Çığlığı / Kıyamet Narası).
   Round 7: every tier must be obviously different at a glance, not a recolour. Tier I keeps the ash / ember-orange look of effects.js (crescent, war-cry wave);
   this file draws tiers II and III:
     strike II  "Kemik Kıran"    overhead chop: physical rubble, narrow scored fissures with an amber heart, restrained heat front and falling sparks
     strike III "Kabir Balyozu"  leap + ground pound: dark violet / black-red - directional scored fissures, restrained heat fronts, heavy stone fragments and smoke
     shout  II  "Ölüm Çığlığı"   head thrown back: bone-white and amber toothed rings spreading, skull wisps, glowing cracks, gold sparks, cowed foes shudder
     shout  III "Kıyamet Narası" two stages: dark-red ember pillar around the hero, long radial fissures, three rings (one per stage / follow-up wave), a screen pulse per stage
   Contract (effects.js owns the instance): B.SkillFx.createWorld(opts) -> { event(name, d), step(dt), clear(), parts, warmObjects(), dispose() }.
   Events: strikeGather {tier, x, z, face, reach, radius, strike, air}, strikeImpact {tier, skill, x, z, ox, oz, face, radius, arc, hits},
           shoutGather {tier, x, z, life, radius}, shoutRelease {tier, x, z, radius, far}, shoutWave {x, z, radius, n}.
   Screen layer (wall clock, so a hit-stop cannot stretch it): Post.setAbilityFx (edge flash / vignette / saturation / fringe / floor ring), B.SkillFx.push() = camera zoom pulse
   (app.js subtracts it from the camera `near` factor), B.SkillFx.timeScale() applies only the shout climax hit-stop; heavy strikes keep simulation flowing and use the combat engine’s brief confirmed-hit response.
   Reduced motion (and ?lvcalm): no zoom, no hit-stop, no fringe / ring, a much weaker flash, no wisps or spark streaks; the cracks, rings and embers stay (they do not move fast).
   No lights, no per-frame allocations, all geometry / materials are made here once and warmed through effects.js warm() (parts / warmObjects). */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const qaCalm = typeof location !== 'undefined' && /[?&]lvcalm(&|$)/.test(location.search);
  const calm = () => qaCalm || mq.matches;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ------------------------------------------------------------------ screen state (module level: app.js reads push() / timeScale())
  const S = { stopUntil: 0, pushAt: -1e9, pushAmp: 0, pulses: [{ t0: -1e9, dur: 1, flash: 0, vig: 0, sat: 0, chroma: 0 }, { t0: -1e9, dur: 1, flash: 0, vig: 0, sat: 0, chroma: 0 }, { t0: -1e9, dur: 1, flash: 0, vig: 0, sat: 0, chroma: 0 }, { t0: -1e9, dur: 1, flash: 0, vig: 0, sat: 0, chroma: 0 }],
    pi: 0, ringAt: -1e9, ringDur: 1, ringX: 0, ringZ: 0, ringR: 5, ringW: .8 };
  const FX = { flash: 0, vig: 0, sat: 0, chroma: 0, ring: { x: 0, z: 0, r: 1, w: 1, t: 0 } };
  function pulse(dur, flash, vig, sat, chroma) {
    const p = S.pulses[S.pi++ % S.pulses.length]; p.t0 = nowMs(); p.dur = dur; p.flash = flash; p.vig = vig; p.sat = sat; p.chroma = chroma;
  }
  function hitPause(ms) { if (!calm()) S.stopUntil = Math.max(S.stopUntil, nowMs() + ms); }
  function kick(amp) { if (calm()) return; S.pushAt = nowMs(); S.pushAmp = amp; }

  // ------------------------------------------------------------------ shaders
  const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  // Ground fissures: jagged glowing cracks running out of the centre. uArms cracks spread over uSpan radians around uFace; they grow to uLen (0..1 of the quad half-size) with uGrow,
  // cool with uT (0..1 over their life). uR = quad half-size in metres (crack width is in metres).
  const FIS_FS = `varying vec2 vUv;uniform float uT,uGrow,uSeed,uArms,uFace,uSpan,uLen,uR,uA;uniform vec3 uHot,uEdge;
    float hs(float n){return fract(sin(n*127.1+uSeed*17.3)*43758.5453);}
    void main(){vec2 q=(vUv-.5)*2.;float r=length(q);if(r>1.)discard;float a=atan(q.x,-q.y);float acc=0.,core=0.,cleft=0.;
      for(int i=0;i<10;i++){if(float(i)>=uArms)break;float fi=float(i);
        float a0=uFace+((fi+.5)/uArms-.5)*uSpan+(hs(fi)-.5)*uSpan/uArms*.6;float len=uLen*(.6+.4*hs(fi+11.));
        float seg=r*uR*2.4,cell=floor(seg),jag=mix(hs(cell+fi*67.),hs(cell+1.+fi*67.),fract(seg))-.5;
        float aj=a+.034*sin(r*uR*1.3+fi*2.3)+.065*jag;
        float da=abs(atan(sin(aj-a0),cos(aj-a0)));float d=da*r*uR;float rel=clamp(r/len,0.,1.);float w=mix(.072,.014,rel);
        float on=(1.-smoothstep(uGrow*len-.05,uGrow*len,r))*smoothstep(.04,.1,r)*(1.-smoothstep(len*.92,len,r));
        float g=exp(-(d*d)/(w*w))*on*(1.-.5*rel);acc+=g;core+=exp(-(d*d)/(w*w*.14))*on*(1.-.5*rel);
        cleft+=exp(-(d*d)/(w*w*5.))*on;}
      float heat=pow(max(0.,1.-uT),1.8),k=uA*(1.-smoothstep(.55,1.,uT));
      vec3 col=(uEdge*acc*.12+uHot*core*heat*.26)*k;
      float ink=clamp(cleft*.55,0.,.72)*k;
      if(max(col.r,max(col.g,col.b))<.004&&ink<.004)discard;
      gl_FragColor=vec4(col+vec3(.012,.009,.006)*ink,ink);}`;
  // Shock ring (analytic, additive): a bright edge with a trailing glow; uTeeth > 0 cuts the front into bone-like teeth. The quad only grows as far as the ring has travelled.
  const RING_FS = `varying vec2 vUv;uniform float uK,uHalf,uMax,uThick,uTeeth,uA;uniform vec3 uCol;
    void main(){vec2 q=(vUv-.5)*2.;float rw=length(q)*uHalf;float e=(1.-pow(1.-uK,2.4))*uMax;float w=uThick*(.5+.9*e/uMax)+.04;
      float a=atan(q.x,-q.y);float scallop=.045*sin(a*13.)+.025*sin(a*29.+1.7);float fluting=uTeeth>0.?(.78+.22*sin(a*uTeeth)):(.8+.2*sin(a*11.+.7));float x=(rw-e-scallop*min(1.,e))/w;float edgeLine=exp(-x*x*2.8);
      float wake=clamp(1.-(e-rw)/(w*3.8),0.,1.);wake=wake*wake*step(rw,e);float echo=exp(-pow((rw-e+w*2.2)/(w*.45),2.))*.18;
      float edge=1.-smoothstep(.94*uMax,uMax,rw);float life=(1.-uK)*(1.-uK)*smoothstep(0.,.04,uK);
      float k=(edgeLine*fluting+wake*.2+echo)*edge*life*uA*.68;if(k<.004)discard;gl_FragColor=vec4(uCol*k,1.);}`;
  // Ember pillar: an open cylinder, vertical streaks drifting upward, thick at the foot and fading toward the top; additive and see-through (the hero stays readable).
  const PIL_VS = 'varying vec2 vUv;varying float vF;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vF=abs(dot(normalize(normalMatrix*normal),normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}';
  const PIL_FS = `varying vec2 vUv;varying float vF;uniform float uT,uA;uniform vec3 uHot,uCold;
    void main(){float y=vUv.y;float u=vUv.x;float s=.5+.5*sin((y-uT*1.4)*16.+sin(u*38.+uT*3.)*2.4+u*25.);s=s*s;float s2=.5+.5*sin((y-uT*2.2)*9.-u*61.);s2=s2*s2*s2;
      float prof=smoothstep(0.,.07,y)*(1.-smoothstep(.45,1.,y));float k=(s*.7+s2*.5)*prof*uA*(.4+.9*(1.-y))*(.1+.9*pow(1.-vF,1.4))*.55;if(k<.004)discard;vec3 col=mix(uCold,uHot,(1.-y)*s);gl_FragColor=vec4(col*k,1.);}`;

  function createWorld(o) {
    const T = o.T, root = o.root, scaleCount = o.scaleCount, emit = o.emit, particle = o.particle, flash = o.flash, getGame = o.getGame, getSettings = o.getSettings;
    const streak = o.streak, scar = o.scar, tells = () => (o.tells ? o.tells() : null), skOn = o.streakOn;
    const plane = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // Sample once per cast; bridge boards sit above the soil in Kara Kıyı.
    const floorAt = (x, z, radius) => { const w = B.app && B.app.world; return w && w.effectHeightAt ? w.effectHeightAt(x, z, radius || 0) : .055; };
    // ---- fissure quads (pool 3) and rings (pool 8): one program each, own uniforms per mesh
    const fisBase = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.CustomBlending, blendSrc:T.OneFactor, blendDst:T.OneMinusSrcAlphaFactor, blendEquation:T.AddEquation, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: { uT: { value: 1 }, uGrow: { value: 1 }, uSeed: { value: 0 }, uArms: { value: 7 }, uFace: { value: 0 }, uSpan: { value: 6.283 }, uLen: { value: 1 }, uR: { value: 5 }, uA: { value: 1 }, uHot: { value: new T.Vector3(3, 2, .6) }, uEdge: { value: new T.Vector3(1.6, .6, .12) } },
      vertexShader: VS, fragmentShader: FIS_FS });
    const fis = [0, 1, 2].map(() => { const mat = fisBase.clone(), m = new T.Mesh(plane, mat); m.frustumCulled = false; m.renderOrder = 1; m.visible = false; m.position.y = .055; root.add(m); return { m, mat, t: 9, life: 1, grow: .3 }; });
    const ringBase = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { uK: { value: 1 }, uHalf: { value: 3 }, uMax: { value: 3 }, uThick: { value: .12 }, uTeeth: { value: 0 }, uA: { value: 1 }, uCol: { value: new T.Vector3(1, .6, .2) } }, vertexShader: VS, fragmentShader: RING_FS });
    const rings = Array.from({ length: 8 }, () => { const mat = ringBase.clone(), m = new T.Mesh(plane, mat); m.frustumCulled = false; m.renderOrder = 2; m.visible = false; m.position.y = .06; root.add(m); return { m, mat, t: 9, life: 1, delay: 0, r: 1 }; });
    const pillarMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false,
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uHot: { value: new T.Vector3(3.2, 1.0, .25) }, uCold: { value: new T.Vector3(.8, .06, .08) } }, vertexShader: PIL_VS, fragmentShader: PIL_FS });
    const pillar = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 36, 1, true).translate(0, .5, 0), pillarMat); pillar.frustumCulled = false; pillar.renderOrder = 3; pillar.visible = false; root.add(pillar);
    const pil = { on: false, t: 0, life: 1.7, x: 0, z: 0, R: 1.3, H: 3.4, floor: .055 };
    // Ephemeral deaths are real sculpted forms with socket depth, jaw and teeth;
    // lighting changes around their volume instead of revealing a flat face card.
    const skullParts=B.Gear.skull(1,true).parts;
    // Recess the socket surfaces: an uncarved closed cranium would hide the dark eye inserts.
    const cranium=skullParts.bone[0],cp=cranium.attributes.position;
    for(let i=0;i<cp.count;i++){
      const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i);if(z<.15)continue;
      const eye=Math.min(Math.hypot((x-.16)/.13,(y+.06)/.11),Math.hypot((x+.16)/.13,(y+.06)/.11));
      const nose=Math.hypot(x/.07,(y+.20)/.115),cavity=Math.max(Math.pow(Math.max(0,1-eye),.65)*.19,Math.pow(Math.max(0,1-nose),.75)*.13);
      cp.setZ(i,z-cavity);
    }
    cranium.computeVertexNormals();cranium.computeBoundingSphere();
    const skullBoneGeo=B.Gear.merge(skullParts.bone),skullVoidGeo=B.Gear.merge(skullParts.void);
    const wisps=Array.from({length:10},()=>{
      const mat=B.EquipmentArt?B.EquipmentArt.material('bone').clone():new T.MeshStandardMaterial({color:0xc0b8a4,roughness:.78,metalness:.03});mat.transparent=true;mat.depthWrite=false;mat.opacity=0;mat.emissive.setHex(0x15130e);
      const eyeMat=new T.MeshBasicMaterial({color:0x040403,transparent:true,depthWrite:false,opacity:0});
      const sp=new T.Group();sp.add(new T.Mesh(skullBoneGeo,mat),new T.Mesh(skullVoidGeo,eyeMat));sp.renderOrder=5;sp.visible=false;root.add(sp);
      return {sp,mat,eyeMat,on:false,t:0,life:1,x:0,y:0,z:0,vx:0,vz:0,vy:0,size:.8,spin:0};
    });
    const sched = [];                      // delayed actions of one cast: { t, f } (a few per cast, never per frame)
    const shaken = [];                     // foes that shudder after the Ölüm Çığlığı: { e, t, life, amp }
    const lift = { trail: 0 }; let tipAcc = 0; const tipV = new T.Vector3();
    let clock = 0;
    const later = (t, f) => { if (sched.length < 40) sched.push({ t, f }); };
    const col = (r, g, b) => [r, g, b];
    // ---- helpers
    function fissure(x, z, R, o2) {
      const f = fis.find(q => q.t >= q.life) || fis.reduce((a, b) => (b.t > a.t ? b : a)), u = f.mat.uniforms;
      f.t = 0; f.life = o2.life || 1.6; f.grow = o2.grow || .3; f.m.position.set(x, floorAt(x, z, R) + .014, z); f.m.scale.set(R * 2, 1, R * 2); f.m.visible = true;
      u.uR.value = R; u.uSeed.value = Math.random() * 40; u.uArms.value = o2.arms || 7; u.uFace.value = o2.face || 0; u.uSpan.value = o2.span || 6.283; u.uLen.value = o2.len || 1; u.uGrow.value = 0; u.uT.value = 0; u.uA.value = o2.a == null ? 1 : o2.a;
      u.uHot.value.set(o2.hot[0], o2.hot[1], o2.hot[2]); u.uEdge.value.set(o2.edge[0], o2.edge[1], o2.edge[2]);
    }
    function ring(x, z, R, o2) {
      const r = rings.find(q => q.t >= q.life && !q.m.visible) || rings.find(q => q.t >= q.life) || rings[0];
      r.r = R; r.life = o2.life || .55; r.t = -(o2.delay || 0); r.m.position.set(x, floorAt(x, z, R) + .02, z); r.m.visible = false; r.pend = true;
      const u = r.mat.uniforms; u.uMax.value = R; u.uThick.value = o2.thick || .12; u.uTeeth.value = o2.teeth || 0; u.uA.value = o2.a == null ? 1 : o2.a; u.uCol.value.set(o2.col[0], o2.col[1], o2.col[2]); u.uK.value = 0;
      sizeRing(r, 0);
    }
    function sizeRing(r, k) { const e = (1 - Math.pow(1 - k, 2.4)) * r.r, half = Math.min(r.r, e + 1.6 + .4 * e / r.r * 3); r.m.scale.set(half * 2, 1, half * 2); r.mat.uniforms.uHalf.value = half; }
    function wisp(x, y, z, a, speed, life, size, tint) {
      const w = wisps.find(q => !q.on); if (!w) return;
      w.on = true; w.t = 0; w.life = life; w.x = x; w.y = y; w.z = z; w.vx = Math.sin(a) * speed; w.vz = Math.cos(a) * speed; w.vy = rnd(.5, 1.3); w.size = size; w.spin = rnd(-.6, .6);
      w.mat.color.setRGB(tint[0], tint[1], tint[2]); const camera=B.app&&B.app.camera,face=camera?Math.atan2(camera.position.x-x,camera.position.z-z):a+Math.PI;w.sp.rotation.set(-.30,face+rnd(-.28,.28),rnd(-.12,.12)); w.sp.visible = true; w.sp.position.set(x, y, z);
    }
    // sparks along the floor, as stretched streaks (one pooled draw call from effects.js)
    function sparks(x, z, n, speed, colr, lift2) {
      if (calm() || !streak) return; if (skOn) skOn();
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = speed * (.5 + Math.random() * .7); streak(x + Math.sin(a) * .6, .2 + Math.random() * .4, z + Math.cos(a) * .6, Math.sin(a) * sp, (lift2 || 2.5) + Math.random() * 3, Math.cos(a) * sp, .23 + Math.random() * .26, .024 + Math.random() * .026, Math.random() < .2 ? [2.0, 1.7, 1.2] : colr); }
    }
    function sparksCone(x, z, face, span, n, speed, colr) {
      if (calm() || !streak) return; if (skOn) skOn();
      for (let i = 0; i < n; i++) { const a = face + (Math.random() - .5) * span, sp = speed * (.5 + Math.random() * .8); streak(x + Math.sin(a) * .8, .2 + Math.random() * .4, z + Math.cos(a) * .8, Math.sin(a) * sp, 2 + Math.random() * 3.5, Math.cos(a) * sp, .26 + Math.random() * .28, .025 + Math.random() * .029, Math.random() < .2 ? [2.1, 1.65, 1.2] : colr); }
    }
    function rubble(x, z, n, spread, up) {
      if (o.fragments) o.fragments(x, floorAt(x, z, .4) + .12, z, { count: n, spread: spread * .25, speed: spread * 1.15, lift: up, size: .085 });
      for (let i = 0; i < scaleCount(Math.ceil(n * .35)); i++) { const a = Math.random() * 6.283, s = rnd(.5, spread); emit(x + Math.sin(a) * rnd(0, spread * .3), .15, z + Math.cos(a) * rnd(0, spread * .3), 0, [.16, .13, .11], Math.sin(a) * s, rnd(up * .5, up), Math.cos(a) * s, rnd(.5, 1.1), rnd(.06, .13)); }
    }
    function dustRing(x, z, n, R, colr, size) {
      for (let i = 0; i < scaleCount(n); i++) { const a = i / n * 6.283 + Math.random() * .2; emit(x + Math.sin(a) * R * .15, .12, z + Math.cos(a) * R * .15, 2, colr, Math.sin(a) * R * 1.1, .3 + Math.random() * .4, Math.cos(a) * R * 1.1, .7 + Math.random() * .4, size || .34); }
    }
    function embersUp(x, z, n, radius, colrs, vy, life, size) {
      for (let i = 0; i < scaleCount(n); i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * radius; emit(x + Math.sin(a) * r, .1 + Math.random() * .6, z + Math.cos(a) * r, 4, colrs[i % colrs.length], rnd(-.4, .4), vy * rnd(.6, 1.2), rnd(-.4, .4), life * rnd(.7, 1.2), size); }
    }
    function floorGlow(x, z, R, life, colr, peak) { const t = tells(); if (t) t.glowBurst(x, z, { radius: R, life, color: colr, peak }); }

    // ================================================================== STRIKE
    // Colours: tier II amber / gold, tier III dark violet / black-red with bone-white flashes.
    const AMB_HOT = [2.4, 1.6, .5], AMB_EDGE = [1.4, .5, .07], BONE = [1.7, 1.55, 1.3], VIO_HOT = [1.3, .5, .3], VIO_EDGE = [.55, .045, .04], DRED = [1.3, .08, .04], VIOLET = [.55, .2, 1.0];
    function strikeGather(d) {
      const x = d.x, z = d.z, tier = d.tier, sx = Math.sin(d.face), sz = Math.cos(d.face), cx = x + sx * (d.reach || 2.4), cz = z + sz * (d.reach || 2.4), w = d.strike || .7;
      if (tier === 2) {
        // gold pinpoints drawn up over the head with the raised cleaver, and a soft amber glow on the ground where the chop will land
        for (let i = 0; i < scaleCount(24); i++) { const a = Math.random() * 6.283, r = rnd(.9, 2.0), life = w * rnd(.6, .95); emit(x + Math.sin(a) * r, rnd(.2, 1.4), z + Math.cos(a) * r, 4, i % 3 ? [3.2, 1.7, .4] : [3.4, 2.6, 1.2], -Math.sin(a) * r / life, (2.5 - 1) / life, -Math.cos(a) * r / life, life, .045); }
        floorGlow(cx, cz, (d.radius || 4) * .85, w + .05, [1.3, .65, .12], .16);
        return;
      }
      // tier III: dust kicked up in the crouch, dark embers pulled to the feet; the leap is dressed by lift trail in step()
      for (let i = 0; i < scaleCount(26); i++) { const a = Math.random() * 6.283, r = rnd(1.1, 2.4), life = (w - (d.air || .38)) * rnd(.7, 1); emit(x + Math.sin(a) * r, rnd(.1, .6), z + Math.cos(a) * r, 4, i % 2 ? [2.4, .3, .1] : [1.3, .5, 2.2], -Math.sin(a) * r / life * .8, rnd(.6, 1.6), -Math.cos(a) * r / life * .8, life, .05); }
      floorGlow(x, z, 2.2, (w - (d.air || .38)) + .2, [.9, .1, .1], .3);
      later(w - (d.air || .38), () => {
        const g = getGame(), p = g && g.player; const px = p ? p.x : x, pz = p ? p.z : z;   // take-off
        ring(px, pz, 2.6, { life: .4, thick: .1, col: [.7, .25, 1.0], a: .7 }); dustRing(px, pz, 22, 2.8, [.12, .09, .1], .3); sparks(px, pz, 8, 4, [2.6, .5, .2], 1.5);
      });
    }
    function strikeImpact(d) {
      const tier = d.tier, x = d.x, z = d.z, ox = d.ox == null ? x : d.ox, oz = d.oz == null ? z : d.oz, R = d.radius || 4, face = d.face || 0, cl = calm();
      if (tier === 2) {
        flash(x, .25, z, 1.0, new T.Color('#d4ad79'), .055);
        ring(x, z, R * .68, { life: .38, thick: .055, col: [.55, .30, .10], a: .48 });
        fissure(x, z, R * .82, { arms: 6, span: 6.283, len: .92, hot: [.85,.44,.15], edge: [.18,.07,.025], life: 1.25, face: face+.4, a: .62 });
        floorGlow(x, z, R * .38, .24, [.85, .4, .12], .12);
        sparks(x, z, scaleCount(20), 7.2, [1.8, 1.25, .65], 2.4);
        for (let i = 0; i < scaleCount(12); i++) { const a = Math.random() * 6.283; emit(x + Math.sin(a) * .35, .15, z + Math.cos(a) * .35, 4, i % 2 ? [1.6, .95, .3] : [.85, .34, .1], Math.sin(a) * rnd(.5, 2.2), rnd(1.2, 3.2), Math.cos(a) * rnd(.5, 2.2), rnd(.35, .8), .035); }
        rubble(x, z, 16, 3.2, 5);
        dustRing(x, z, 26, R * .9, [.11, .09, .07], .34);
        if (scar) scar(x, z, 0, { shape: 'circle', radius: R * .55, heat: .55, life: 2.2 });
        later(.18, () => { sparks(x, z, scaleCount(7), 3.5, [1.2, .68, .24], 1.2); dustRing(x, z, 12, R * .5, [.1,.085,.065], .26); });
        pulse(.55, .025, .22, .07, .07); kick(.02);
        S.ringAt = nowMs(); S.ringDur = .5; S.ringX = x; S.ringZ = z; S.ringR = R * 1.5; S.ringW = .8;
        return;
      }
      // tier III
      const arc = d.arc || 2.5;
      flash(ox, .3, oz, 1.25, new T.Color('#c4aba0'), .06);
      later(.05, () => flash(ox + Math.sin(face) * 1.1, .35, oz + Math.cos(face) * 1.1, .8, new T.Color('#a57c69'), .065));
      ring(ox, oz, R * .72, { life: .48, thick: .07, col: [.30,.13,.40], a: .45 });
      ring(ox, oz, R * .48, { life: .36, thick: .05, col: [.55,.13,.08], teeth: 17, delay: .09, a: .42 });
      ring(ox, oz, R * .94, { life: .62, thick: .045, col: [.20,.10,.27], delay: .2, a: .30 });
      fissure(ox, oz, R * .9, { arms: 7, span: arc * 1.18, hot: [.8,.26,.12], edge: [.2,.035,.025], life: 2.0, grow: .22, face, a: .55, len: .85 });
      fissure(ox, oz, 2.8, { arms: 5, span: 6.283, len: .7, hot: [.75,.24,.1], edge: [.25,.06,.025], life: 1.6, face: Math.random() * 6, a:.6 });
      floorGlow(ox, oz, R * .4, .45, [.65, .12, .07], .14);
      sparksCone(ox, oz, face, arc * 1.1, scaleCount(34), 10.5, [2.6, .55, .3]);
      for (let i = 0; i < scaleCount(46); i++) { const a = face + (Math.random() - .5) * arc * 1.2, r = rnd(.4, R * .8); emit(ox + Math.sin(a) * r * .5, .15, oz + Math.cos(a) * r * .5, 4, i % 3 ? [2.2, .4, .1] : [1.0, .45, 1.8], Math.sin(a) * rnd(.5, 2.6), rnd(2.2, 5.6), Math.cos(a) * rnd(.5, 2.6), rnd(.8, 1.6), .06); }
      rubble(ox, oz, 26, 5.2, 6.5);
      for (let i = 0; i < scaleCount(22); i++) { const a = Math.random() * 6.283; emit(ox + Math.sin(a) * rnd(0, 1.2), .2, oz + Math.cos(a) * rnd(0, 1.2), 2, [.035, .026, .04], Math.sin(a) * rnd(1, 3.6), rnd(.4, 1.2), Math.cos(a) * rnd(1, 3.6), rnd(1, 1.7), .55); }   // black smoke
      dustRing(ox, oz, 30, R * .8, [.12, .1, .1], .4);
      if (scar) { scar(ox, oz, 0, { shape: 'circle', radius: 3.2, heat: .35, life: 3 }); scar(ox + Math.sin(face) * R * .45, oz + Math.cos(face) * R * .45, face, { shape: 'circle', radius: R * .55, heat: .28, life: 3 }); }
      later(.28, () => { sparks(ox, oz, scaleCount(10), 5, [2.4, .5, .3], 3); embersUp(ox, oz, 18, 2.6, [[2.8, .5, .12], [1.6, .6, 2.6]], 2.8, 1.2, .055); });
      pulse(.9, .03, .34, .1, .14); kick(.04);
      S.ringAt = nowMs(); S.ringDur = .65; S.ringX = ox; S.ringZ = oz; S.ringR = R * 1.4; S.ringW = 1.1;
    }

    // ================================================================== SHOUT
    function shoutGather(d) {
      const x = d.x, z = d.z, tier = d.tier, w = d.life || .44;
      if (tier === 2) {
        // pale breath wisps and gold motes drawn in toward the throat, an amber glow under the feet
        for (let i = 0; i < scaleCount(40); i++) { const a = Math.random() * 6.283, r = rnd(1.6, 3.2), y = rnd(.2, 1.4), life = w * rnd(.6, 1); emit(x + Math.sin(a) * r, y, z + Math.cos(a) * r, i % 3 ? 5 : 4, i % 3 ? [2.2, 2.0, 1.6] : [3.2, 1.8, .5], -Math.sin(a) * r / life, (1.55 - y) / life, -Math.cos(a) * r / life, life, i % 3 ? .1 : .045); }
        floorGlow(x, z, 2.0, w + .2, [1.3, .85, .3], .16); pulse(w + .1, 0, .12, 0, 0);
        return;
      }
      // tier III: the ground trembles with dark embers climbing around him, getting denser until the first scream
      for (let i = 0; i < scaleCount(56); i++) { const a = Math.random() * 6.283, r = rnd(2.4, 4.2), life = w * rnd(.5, 1); emit(x + Math.sin(a) * r, rnd(.05, .5), z + Math.cos(a) * r, 4, i % 3 ? [2.6, .3, .08] : [.8, .3, 1.5], -Math.sin(a) * r / life * .9, rnd(1, 2.6), -Math.cos(a) * r / life * .9, life, .05); }
      floorGlow(x, z, 3.2, w + .3, [1.0, .08, .06], .35); fissure(x, z, 3.0, { arms: 6, len: .8, hot: [2.2, .35, .15], edge: [1.0, .08, .06], life: w + .3, grow: .9, a: .55, face: Math.random() * 6 });
      later(w * .5, () => { ring(x, z, 3.4, { life: .5, thick: .08, col: [1.4, .2, .12], a: .6 }); });
      pulse(w + .1, 0, .22, 0, 0);
    }
    function shoutRelease(d) {
      const x = d.x, z = d.z, tier = d.tier, near = d.radius || 8, far = d.far || 12, V = near * .50, game = getGame();
      if (tier === 2) {
        flash(x, 1.4, z, 1.15, new T.Color('#c6b395'), .08);
        ring(x, z, V, { life: .48, thick: .05, col: [.62,.50,.34], a:.65 });
        ring(x, z, V * 1.2, { life: .6, thick: .045, col: [.5,.29,.1], delay:.1, a:.55 });
        fissure(x, z, near * .65, { arms: 5, span: 6.283, len: .82, hot: [.48,.36,.24], edge:[.11,.07,.04], life:1.5, grow:.25, face:Math.random()*6, a:.6 });
        floorGlow(x, z, near * .38, .5, [.6,.3,.1], .08);
        for (let i = 0; i < 4 && !calm(); i++) wisp(x, 1.3, z, i / 4 * 6.283 + rnd(-.2, .2), rnd(3, 4.6), rnd(.65,.85), rnd(.32,.46), i % 2 ? [.9, .85, .7] : [.9, .6, .25]);
        sparks(x, z, scaleCount(18), 6.5, [1.4,.95,.46], 2.2);
        dustRing(x, z, 30, V * .9, [.13, .11, .09], .32);
        for (let i = 0; i < scaleCount(24); i++) { const a = Math.random() * 6.283; emit(x + Math.sin(a) * .6, .3, z + Math.cos(a) * .6, 5, [2.4, 2.2, 1.8], Math.sin(a) * rnd(1.5, 3.8), rnd(.4, 1.6), Math.cos(a) * rnd(1.5, 3.8), rnd(.6, 1.2), .09); }
        if (scar) scar(x, z, 0, { shape: 'circle', radius: 2.2, heat: .45, life: 2 });
        // foes the cry reached shudder (and shed grey dust) for as long as they are cowed
        if (game) for (const e of game.enemies) if (!e.dead && e.fear > 1 && e.model.root.visible && shaken.length < 14) shaken.push({ e, t: 0, life: Math.min(1.8, e.stagger > 0 ? e.stagger : 1.2), amp: .026 });
        pulse(.7, .025, .24, .08, .08); kick(.025);
        S.ringAt = nowMs(); S.ringDur = .6; S.ringX = x; S.ringZ = z; S.ringR = V * 1.5; S.ringW = .9;
        return;
      }
      // tier III - stage one (the rings of stage two come as shoutWave)
      flash(x, 1.4, z, 1.4, new T.Color('#b8a0ac'), .08);
      ring(x, z, V * .85, { life:.52, thick:.06, col:[.26,.11,.30], a:.6 });
      ring(x, z, V * 1.2, { life:.64, thick:.05, col:[.45,.12,.065], delay:.08, a:.55 });
      fissure(x, z, near * .72, { arms:7, span:6.283, len:1, hot:[.6,.18,.08], edge:[.18,.025,.016], life:1.9, grow:.32, face:Math.random()*6 });
      fissure(x, z, 2.8, { arms:5, span:6.283, len:.8, hot:[.75,.23,.10], edge:[.25,.06,.02], life:1.6, grow:.25, face:Math.random()*6 });
      floorGlow(x, z, near * .4, .65, [.55,.07,.045], .10);
      // the pillar of dark red embers around the hero
      pil.on = true; pil.t = 0; pil.x = x; pil.z = z; pil.floor = floorAt(x, z, 2); pillar.visible = true; pillarMat.uniforms.uA.value = 0;
      embersUp(x, z, 32, 1.15, [[1.4,.34,.08],[.75,.12,.045],[.36,.18,.5]], 3.2, 1.1, .038);
      for (let i = 0; i < 6 && !calm(); i++) wisp(x, 1.3, z, i / 6 * 6.283 + rnd(-.2, .2), rnd(3.4, 5.4), rnd(.7,.95), rnd(.34,.5), i % 2 ? [.9, .85, 1.0] : [1.0, .45, .35]);
      sparks(x, z, scaleCount(22), 7.5, [1.35,.34,.12], 2.7); rubble(x, z, 16, 4.4, 5.4); dustRing(x, z, 34, V, [.1, .08, .09], .4);
      for (let i = 0; i < scaleCount(24); i++) { const a = Math.random() * 6.283; emit(x + Math.sin(a) * rnd(0, 1.4), .25, z + Math.cos(a) * rnd(0, 1.4), 2, [.035, .026, .04], Math.sin(a) * rnd(1.2, 3.8), rnd(.4, 1.3), Math.cos(a) * rnd(1.2, 3.8), rnd(1, 1.7), .55); }
      if (scar) scar(x, z, 0, { shape: 'circle', radius: 3.4, heat: .55, life: 3 });
      if (game) for (const e of game.enemies) if (!e.dead && e.fear > 1 && e.model.root.visible && shaken.length < 14) shaken.push({ e, t: 0, life: Math.min(2.4, e.stagger > 0 ? e.stagger : 1.6), amp: .035 });
      pulse(1.0, .03, .32, .1, .14); hitPause(70); kick(.045);
      S.ringAt = nowMs(); S.ringDur = .7; S.ringX = x; S.ringZ = z; S.ringR = V * 1.6; S.ringW = 1.2;
    }
    function shoutWave(d) {
      const x = d.x, z = d.z, n = d.n || 1, V = (d.radius || 8) * .50;
      flash(x, 1.4, z, 1.0 + n * .2, new T.Color(n % 2 ? '#b8a0e0' : '#d09070'), .09);
      ring(x, z, V * 1.12, { life:.56, thick:.055, col:n%2?[.36,.23,.48]:[.55,.19,.065], a:.6 });
      fissure(x, z, V * 1.1, { arms:6, len:1, hot:n%2?[.6,.27,.35]:[.72,.36,.12], edge:[.15,.05,.02], life:1.3, grow:.3, face:Math.random()*6, a:.6 });
      sparks(x, z, scaleCount(14), 7, n%2?[.6,.32,.85]:[1.15,.5,.15], 2.4);
      pil.t = Math.min(pil.t, .5); embersUp(x, z, 14, 1.1, [[1.4,.34,.08],[.36,.18,.5]], 3.1, 1, .038);   // the pillar flares again
      for (let i = 0; i < 3 && !calm(); i++) wisp(x, 1.3, z, i / 3 * 6.283 + rnd(0,1.2), rnd(3.4,5), rnd(.65,.85), rnd(.30,.44), [.95, .9, 1.0]);
      pulse(.7, .02 + .005 * n, .26, .08, .1); hitPause(n > 1 ? 80 : 50); kick(.03 + .01 * n);
      S.ringAt = nowMs(); S.ringDur = .6; S.ringX = x; S.ringZ = z; S.ringR = V * 1.6; S.ringW = 1.0;
    }
    // ------------------------------------------------------------------ per frame (effects.js signatureStep)
    function step(dt) {
      clock += dt;
      for (let i = sched.length - 1; i >= 0; i--) { const s = sched[i]; s.t -= dt; if (s.t <= 0) { sched.splice(i, 1); s.f(); } }
      for (const f of fis) if (f.m.visible) { f.t += dt; const k = f.t / f.life, u = f.mat.uniforms; u.uT.value = clamp(k, 0, 1); u.uGrow.value = 1 - Math.pow(1 - clamp(f.t / f.grow, 0, 1), 3); if (f.t >= f.life) f.m.visible = false; }
      for (const r of rings) {
        if (r.t >= r.life) continue; r.t += dt; if (r.t < 0) continue;
        const k = clamp(r.t / r.life, 0, 1); r.m.visible = true; r.mat.uniforms.uK.value = k; sizeRing(r, k); if (r.t >= r.life) r.m.visible = false;
      }
      if (pil.on) {
        pil.t += dt; const k = pil.t / pil.life, u = pillarMat.uniforms; u.uT.value = pil.t; u.uA.value = (calm() ? .35 : 1) * Math.sin(Math.min(1, pil.t / .18) * 1.5708) * (1 - clamp((pil.t - pil.life * .55) / (pil.life * .45), 0, 1));
        const g = getGame(), p = g && g.player, grow = 1 - Math.pow(1 - clamp(pil.t / .3, 0, 1), 3);
        if (p) { pil.x = p.x; pil.z = p.z; pil.floor=floorAt(pil.x,pil.z,2); } pillar.position.set(pil.x, pil.floor, pil.z); pillar.scale.set(pil.R * (.55 + .45 * grow), pil.H * grow, pil.R * (.55 + .45 * grow));
        if (k >= 1) { pil.on = false; pillar.visible = false; }
      }
      for (const w of wisps) if (w.on) {
        w.t += dt; const k = w.t / w.life; if (k >= 1) { w.on = false; w.sp.visible = false; continue; }
        w.vx *= Math.exp(-dt * 1.6); w.vz *= Math.exp(-dt * 1.6); w.x += w.vx * dt; w.z += w.vz * dt; w.y += w.vy * dt * (1 - k * .6);
        w.sp.position.set(w.x, w.y, w.z); const sz = w.size * (.5 + .6 * Math.min(1, k * 3)); w.sp.scale.setScalar(sz); w.sp.rotation.z += w.spin * dt * .3;
        const fade=Math.min(1,w.t*8)*Math.pow(1-k,1.5);w.mat.opacity=fade*.58;w.eyeMat.opacity=fade*.46;
      }
      for (let i = shaken.length - 1; i >= 0; i--) {
        const s = shaken[i], e = s.e; s.t += dt;
        if (s.t >= s.life || e.dead || e.inView === false) { shaken.splice(i, 1); continue; }
        const k = 1 - s.t / s.life, r = e.model.root, j = Math.sin(clock * 11 + i * 2.1) * s.amp * k;
        r.position.x += j; r.position.z += Math.cos(clock * 8.5 + i) * s.amp * k * .7;
        if (Math.random() < dt * 14) emit(e.x + rnd(-.3, .3), rnd(.8, 1.7), e.z + rnd(-.3, .3), 2, [.2, .18, .16], rnd(-.3, .3), rnd(.3, .8), rnd(-.3, .3), .7, .22);
      }
      // the raised cleaver sheds embers all through the wind-up of tiers II / III (gold for Kemik Kıran, dark red for Kabir Balyozu)
      const gp = getGame(), pl = gp && gp.player, at = pl && pl.attack;
      if (at && at.skill && at.line === 'cleave' && at.tier >= 2 && !at.hit && at.age > .08 && pl.model && pl.model.weaponTip) {
        tipAcc += dt; while (tipAcc > .035) { tipAcc -= .035; pl.model.weaponTip.getWorldPosition(tipV); emit(tipV.x, tipV.y, tipV.z, 4, at.tier >= 3 ? (Math.random() < .3 ? [1.0, .45, 1.8] : [2.4, .4, .1]) : [2.6, 1.5, .35], rnd(-.5, .5), rnd(.3, 1.4), rnd(-.5, .5), .55, .045); }
      }
      // the leap of Kabir Balyozu leaves a trail of dark embers behind the feet
      const g = getGame(), p = g && g.player;
      if (p && p.lift > .06) { lift.trail += dt; while (lift.trail > .028) { lift.trail -= .028; emit(p.x + rnd(-.3, .3), p.lift + rnd(.1, .6), p.z + rnd(-.3, .3), 4, Math.random() < .5 ? [2.8, .45, .12] : [1.5, .6, 2.6], rnd(-.4, .4), rnd(-.2, .8), rnd(-.4, .4), .5, .05); } }
      // ---- screen layer (wall clock)
      const post = B.app && B.app.post, t = nowMs();
      if (!post || !post.setAbilityFx || calm() || (B.LevelUp && B.LevelUp.active)) return;
      let fl = 0, vg = 0, st = 0, ch = 0, any = false;
      for (const q of S.pulses) {
        const age = (t - q.t0) / 1000; if (age < 0 || age > q.dur) continue;
        const rise = clamp(age / .03, 0, 1), dec = Math.exp(-Math.max(0, age - .03) * 5 / q.dur), e = rise * dec; any = true;
        fl = Math.max(fl, q.flash * e * (age < .25 ? 1 : .0)); vg = Math.max(vg, q.vig * (age < q.dur * .25 ? rise : 1) * Math.pow(1 - age / q.dur, 1.3)); st = Math.max(st, q.sat * e); ch = Math.max(ch, q.chroma * e * e);
      }
      const rage = (t - S.ringAt) / 1000, ringOn = rage >= 0 && rage < S.ringDur;
      if (!any && !ringOn) return;
      FX.flash = fl; FX.vig = vg; FX.sat = st; FX.chroma = ch;
      if (ringOn) { const k = rage / S.ringDur; FX.ring.x = S.ringX; FX.ring.z = S.ringZ; FX.ring.r = S.ringR * (1 - Math.pow(1 - k, 2)); FX.ring.w = S.ringW; FX.ring.t = k; post.setAbilityFx(FX); }
      else { const ring = FX.ring; FX.ring = null; post.setAbilityFx(FX); FX.ring = ring; }
    }
    function event(name, d) {
      if (name === 'strikeGather') strikeGather(d); else if (name === 'strikeImpact') strikeImpact(d);
      else if (name === 'shoutGather') shoutGather(d); else if (name === 'shoutRelease') shoutRelease(d); else if (name === 'shoutWave') shoutWave(d);
    }
    function clear() {
      sched.length = 0; shaken.length = 0; for (const f of fis) { f.m.visible = false; f.t = 9; f.life = 1; } for (const r of rings) { r.m.visible = false; r.t = 9; r.life = 1; }
      pil.on = false; pillar.visible = false; for (const w of wisps) { w.on = false; w.sp.visible = false; }
      S.stopUntil = 0; S.pushAt = -1e9; S.ringAt = -1e9; for (const q of S.pulses) q.t0 = -1e9;
    }
    // objects effects.js adds to its hidden warm group (they share geometry and materials with the live ones)
    function warmObjects() {
      const out = [new T.Mesh(plane, fis[0].mat), new T.Mesh(plane, rings[0].mat), new T.Mesh(pillar.geometry, pillarMat)];
      out.push(new T.Mesh(skullBoneGeo,wisps[0].mat),new T.Mesh(skullVoidGeo,wisps[0].eyeMat));
      return out;
    }
    // warm-up: run every event once with real data (effects.js burst 'skillFxDemo')
    function demo(d) {
      const x = d.x || 0, z = d.z || 0, face = d.face || 0;
      strikeGather({ tier: 2, x, z, face, reach: 4, radius: 4.5, strike: .7 }); strikeGather({ tier: 3, x, z, face, radius: 7, strike: .7, air: .38 });
      strikeImpact({ tier: 2, skill: 'brand', x, z, ox: x, oz: z, face, radius: 4.5, arc: 6.28, hits: 1 }); strikeImpact({ tier: 3, skill: 'temper', x, z, ox: x, oz: z, face, radius: 7, arc: 2.5, hits: 1 });
      shoutGather({ tier: 2, x, z, life: .4 }); shoutGather({ tier: 3, x, z, life: .6 }); shoutRelease({ tier: 2, x, z, radius: 8, far: 12 }); shoutRelease({ tier: 3, x, z, radius: 11, far: 16 }); shoutWave({ x, z, radius: 9, n: 1 }); shoutWave({ x, z, radius: 10, n: 2 });
      step(.05); step(.05); S.stopUntil = 0; S.pushAt = -1e9; S.ringAt = -1e9;
    }
    function dispose() {
      clear(); for (const f of fis) { f.m.removeFromParent(); f.mat.dispose(); } for (const r of rings) { r.m.removeFromParent(); r.mat.dispose(); }
      fisBase.dispose(); ringBase.dispose(); pillar.removeFromParent(); pillar.geometry.dispose(); pillarMat.dispose();
      for (const w of wisps) { w.sp.removeFromParent(); w.mat.dispose(); w.eyeMat.dispose(); } skullBoneGeo.dispose();skullVoidGeo.dispose();plane.dispose();
    }
    return { event, step, clear, warmObjects, demo, dispose, parts: [] };
  }

  B.SkillFx = {
    createWorld,
    // camera zoom pulse (0 .. ~.045): app.js subtracts it from the camera `near` factor
    push() { const a = (nowMs() - S.pushAt) / 1000; if (a < 0 || a > 1 || !S.pushAmp || calm()) return 0; return S.pushAmp * Math.sin(Math.min(1, a / .05) * Math.PI / 2) * Math.exp(-Math.max(0, a - .05) * 5.5); },
    // Simulation speed multiplier for shout climaxes; weapon strikes never set this clock.
    timeScale() { return nowMs() < S.stopUntil ? .05 : 1; }
  };
})();
