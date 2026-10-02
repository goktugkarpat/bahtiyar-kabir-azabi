/* KABİR AZABI — health globes (GLOBES). Foes that die can leave a crimson globe of blood; walking into it heals a little.
   Drop rules (rolled by combat.js with the dying foe's own seeded RNG, so runs stay repeatable): common foes 10 %, heavy / finisher kills 14 %,
   tough foes (guard, carrier) 30 %, a pity drop after PITY misses in a row, and 2 guaranteed globes when the executioner changes phase.
   Rendering costs two draw calls in total: one mesh of up to SLOTS unit spheres (shader: liquid swirl, glass shell, unlit) and one additive
   mesh (ground light pool, halo, rising embers), both driven by small uniform arrays. No light, no textures except the "+N" number sprites.
   Cosmetic + a small heal; never touches AI, telegraphs or damage. Not saved: cleared on restart / respawn / checkpoint. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {}, T = THREE;
  const SLOTS = 10, MAX_ALIVE = 8, LIFE = 25, BLINK = 4, R = .2, HOVER = .42, GRAVITY = 15;
  const MAGNET = 3.2, PICKUP = .7, HEAL = .12, HEAL_RAGE = .04, PITY = 10, EMBERS = 6;
  const CHANCE = { common: .1, heavy: .14, tough: .3 };
  const TOUGH = { guard: 1, carrier: 1 };   // no big variants exist; the two heaviest common foes count as elite
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const SPHERE_VS = `
    attribute float aI; uniform vec4 uG[${SLOTS}]; uniform vec4 uF[${SLOTS}]; varying vec3 vN; varying vec3 vP; varying vec4 vF; varying vec3 vV;
    void main(){ int i=int(aI+.5); vec4 g=uG[i]; vF=uF[i]; vP=position; vN=mat3(viewMatrix)*position;
      vec3 w=g.xyz+position*${R.toFixed(2)}*g.w*(1.+.05*vF.z);
      vec4 mv=viewMatrix*vec4(w,1.); vV=-normalize(mv.xyz); gl_Position=projectionMatrix*mv; }`;
  const SPHERE_FS = `
    uniform float uT; varying vec3 vN; varying vec3 vP; varying vec4 vF; varying vec3 vV;
    void main(){
      vec3 n=normalize(vN); float fr=1.-clamp(dot(n,normalize(vV)),0.,1.);
      // liquid swirl: two slow domain-warped bands turning around the vertical axis
      float t=uT*vF.y+vF.x, a=atan(vP.x,vP.z), h=vP.y;
      float w1=sin(a*2.+h*4.5+t*1.6+sin(h*5.-t*1.1)*1.3), w2=sin(a*3.-h*3.+t*-1.2+sin(a+t)*1.1);
      float sw=.5+.25*w1+.25*w2; sw=sw*sw;
      vec3 deep=vec3(.16,.0,.01), mid=vec3(.62,.008,.03), hot=vec3(1.45,.12,.09);
      vec3 col=mix(deep,mid,smoothstep(.05,.75,sw+.25*(h*.5+.5)));
      col=mix(col,hot,smoothstep(.72,1.,sw)*.7);
      col+=vec3(1.1,.06,.05)*fr*fr*.8*(.75+.25*vF.z);                 // glowing meniscus at the edge
      // glass shell: window highlight up-left, thin bright rim, faint lower bounce light
      vec2 hp=n.xy-vec2(-.34,.42); float spec=exp(-dot(hp,hp)*34.); col+=vec3(1.7,1.3,1.2)*spec*.8;
      vec2 hq=n.xy-vec2(.36,-.4); col+=vec3(.9,.1,.08)*exp(-dot(hq,hq)*10.)*.35;
      col+=vec3(1.,.28,.22)*smoothstep(.88,1.,fr)*.3;
      col*=vF.w;                                                        // blink / fade brightness
      gl_FragColor=vec4(col,1.); }`;
  const FX_VS = `
    attribute vec2 aC; attribute vec2 aKE; attribute float aI; uniform vec4 uG[${SLOTS}]; uniform vec4 uF[${SLOTS}]; uniform float uT; uniform float uEm;
    varying vec2 vC; varying float vK; varying float vA;
    void main(){ int i=int(aI+.5); vec4 g=uG[i]; vec4 f=uF[i]; float kind=aKE.x; vC=aC; vK=kind; vA=0.;
      vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]), up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
      float live=g.w*f.w*step(.001,g.w); vec3 p;
      if(kind<.5){ p=vec3(g.x+aC.x*1.0*g.w,.035,g.z+aC.y*1.0*g.w); vA=live*(.6+.4*f.z); }
      else if(kind<1.5){ vec3 c=g.xyz+vec3(0.,.02,0.); p=c+(right*aC.x+up*aC.y)*.64*g.w; vA=live*(.7+.3*f.z); }
      else { float s=aKE.y; float u=fract(uT*(.16+.12*fract(s*7.3))*uEm+s); float rr=.1+.07*fract(s*3.7); float an=s*40.+u*3.;
        vec3 c=vec3(g.x+cos(an)*rr,.15+g.y+u*1.05,g.z+sin(an)*rr); p=c+(right*aC.x+up*aC.y)*.03*g.w; vA=live*sin(3.14159*u)*uEm*step(.001,uEm); }
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.); }`;
  const FX_FS = `
    varying vec2 vC; varying float vK; varying float vA;
    void main(){ float r=length(vC); if(r>1.||vA<.003) discard; vec3 col;
      if(vK<.5){ float k=(1.-smoothstep(.15,1.,r)); k*=k; col=vec3(1.,.035,.03)*k*.5; col+=vec3(1.,.12,.07)*exp(-r*r*14.)*.28; }
      else if(vK<1.5){ float k=exp(-r*r*5.5)*(1.-smoothstep(.75,1.,r)); col=vec3(1.,.04,.035)*k*.6; }
      else { float k=1.-smoothstep(.2,1.,r); col=vec3(1.,.1,.07)*k*1.5; }
      gl_FragColor=vec4(col*vA,1.); }`;

  function create(root, world, services) {
    const S = services || {}, player = S.player;
    const fx = S.fx || (() => {}), sound = S.sound || (() => {}), emit = S.emit || (() => {});
    const group = new T.Group(); group.name = 'KaraGecitGlobes'; root.add(group);
    // ---- geometry: SLOTS unit spheres (pass 1) and per slot a ground quad, a halo quad and EMBERS ember quads (pass 2)
    const sph = new T.SphereGeometry(1, 18, 12), sN = sph.attributes.position.count;
    const sPos = new Float32Array(sN * 3 * SLOTS), sI = new Float32Array(sN * SLOTS), sIdx = [];
    for (let s = 0; s < SLOTS; s++) {
      sPos.set(sph.attributes.position.array, s * sN * 3); sI.fill(s, s * sN, (s + 1) * sN);
      sph.index.array.forEach(v => sIdx.push(v + s * sN));
    }
    const sphereGeo = new T.BufferGeometry();
    sphereGeo.setAttribute('position', new T.BufferAttribute(sPos, 3)); sphereGeo.setAttribute('aI', new T.BufferAttribute(sI, 1)); sphereGeo.setIndex(sIdx);
    sph.dispose();
    const perSlot = 2 + EMBERS, CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const fC = new Float32Array(SLOTS * perSlot * 4 * 2), fKE = new Float32Array(SLOTS * perSlot * 4 * 2), fI = new Float32Array(SLOTS * perSlot * 4), fPos = new Float32Array(SLOTS * perSlot * 4 * 3), fIdx = [];
    let q = 0;
    for (let s = 0; s < SLOTS; s++) for (let k = 0; k < perSlot; k++, q++) {
      for (let c = 0; c < 4; c++) {
        const v = q * 4 + c; fC[v * 2] = CORNERS[c][0]; fC[v * 2 + 1] = CORNERS[c][1];
        fKE[v * 2] = k < 2 ? k : 2; fKE[v * 2 + 1] = k < 2 ? 0 : ((s * 7 + k * 13) % 17) / 17 + .03; fI[v] = s;
      }
      fIdx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
    }
    const fxGeo = new T.BufferGeometry();
    fxGeo.setAttribute('position', new T.BufferAttribute(fPos, 3)); fxGeo.setAttribute('aC', new T.BufferAttribute(fC, 2));
    fxGeo.setAttribute('aKE', new T.BufferAttribute(fKE, 2)); fxGeo.setAttribute('aI', new T.BufferAttribute(fI, 1)); fxGeo.setIndex(fIdx);
    const uG = Array.from({ length: SLOTS }, () => new T.Vector4(0, 0, 0, 0)), uF = Array.from({ length: SLOTS }, () => new T.Vector4(0, 1, 0, 1));
    const uT = { value: 0 }, uEm = { value: 1 };
    const sphereMat = new T.ShaderMaterial({ fog: false, vertexShader: SPHERE_VS, fragmentShader: SPHERE_FS, uniforms: { uG: { value: uG }, uF: { value: uF }, uT } });
    const fxMat = new T.ShaderMaterial({ fog: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      vertexShader: FX_VS, fragmentShader: FX_FS, uniforms: { uG: { value: uG }, uF: { value: uF }, uT, uEm } });
    const sphereMesh = new T.Mesh(sphereGeo, sphereMat), fxMesh = new T.Mesh(fxGeo, fxMat);
    for (const m of [sphereMesh, fxMesh]) { m.frustumCulled = false; m.visible = false; group.add(m); }
    sphereMesh.renderOrder = 4; fxMesh.renderOrder = 5;
    // ---- "+N" number sprites (pooled; one small canvas texture each)
    const labels = [0, 1, 2].map(() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
      const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }), m = new T.Sprite(mat);
      m.visible = false; m.renderOrder = 22; m.scale.set(1.5, .75, 1); group.add(m); return { m, c, tex, t: 9, x: 0, z: 0 };
    });
    function paintLabel(g, text) {
      g.clearRect(0, 0, 128, 64); g.font = '800 40px "Source Sans 3", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = '#1a0708'; g.lineJoin = 'round'; g.strokeText(text, 64, 34);
      const gr = g.createLinearGradient(0, 14, 0, 54); gr.addColorStop(0, '#6dff7c'); gr.addColorStop(.55, '#ff5a3c'); gr.addColorStop(1, '#e01818'); g.fillStyle = gr; g.fillText(text, 64, 34);
    }
    // The first pickup built the stroked-text + gradient drawing programs in the middle of the fight: draw the label once now on a spare canvas and read one pixel back (finishes the drawing).
    (() => {
      const run = () => { try { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); paintLabel(g, '+12'); g.getImageData(64, 34, 1, 1); } catch (e) { /* warm-up only */ } };
      try { if (document.fonts && document.fonts.load) document.fonts.load("800 40px 'Source Sans 3'").then(run, run); else run(); } catch (e) { run(); }
    })();
    function label(text, x, z) {
      const l = labels.find(o => o.t >= 1.2) || labels.reduce((a, b) => a.t > b.t ? a : b);
      paintLabel(l.c.getContext('2d'), text);
      l.tex.needsUpdate = true; l.t = 0; l.x = x; l.z = z; l.m.visible = true; l.m.material.opacity = 1; l.m.position.set(x, 1.9, z);
    }
    // ---- state
    const globes = []; let time = 0, misses = 0, seed = 20260929, low = false, disposed = false, drops = 0, picked = 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const proxy = { x: 0, z: 0 };

    function spawnGlobe(x, z, angle, power) {
      const alive = globes.filter(g => !g.dying);
      if (alive.length >= MAX_ALIVE) alive[0].dying = .35;       // the oldest fades
      if (globes.length >= SLOTS) { const i = globes.findIndex(o => o.dying > 0); globes.splice(i < 0 ? 0 : i, 1); }
      const a = angle + (rnd() - .5) * .7, sp = (1.5 + rnd() * 1.4) * (power || 1);
      const g = { x, z, y: .9, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: 4.6 + rnd() * 1.1, bounces: 0, rest: false, age: 0, phase: rnd() * 6.28, dying: 0, mag: 0, tSpin: .8 + rnd() * .5 };
      globes.push(g); drops++; sound('globeDrop', { x, z }); return g;
    }
    // Roll a drop for a foe that just died. rand: the foe's seeded RNG (always consumed exactly once, so the stream never depends on pity).
    function roll(enemy, kind, face, rand) {
      const r = rand ? rand() : rnd();
      if (enemy.boss || disposed) return false;
      const p = TOUGH[enemy.type] ? CHANCE.tough : (kind === 'heavy' || kind === 'finisher') ? CHANCE.heavy : CHANCE.common;
      if (r < p || misses >= PITY) { misses = 0; spawnGlobe(enemy.x, enemy.z, face, 1); return true; }
      misses++; return false;
    }
    function bonus(x, z, n) { for (let i = 0; i < n; i++) spawnGlobe(x, z, i * (6.28 / n) + rnd() * 1.5, 1.5); }

    function collect(g) {
      const p = player; if (!p || p.dead) return;
      const amt = (Math.round((p.effectiveMaxHp || p.maxHp) * (HEAL + (p.rageTime > 0 ? HEAL_RAGE : 0))) * p.maxHp / (p.effectiveMaxHp || p.maxHp)), got = Math.max(0, Math.min(amt, p.maxHp - p.hp));
      p.hp = Math.min(p.maxHp, p.hp + amt); picked++;
      emit('heal', { hp: p.hp, flasks: p.flasks, source: 'globe', amount: got });
      sound('globe', { x: p.x, z: p.z }); fx('glowBurst', { x: p.x, y: .05, z: p.z, radius: 2.8, color: 0xff2418, duration: .6 });
      fx('glowBurst', { x: p.x, y: .05, z: p.z, radius: 1.4, color: 0xff8070, duration: .3 });
      label('+' + Math.max(1, Math.round(got)), p.x, p.z); g.dying = .001; g.taken = true;
    }

    function step(g, dt) {
      g.age += dt; if (!reducedMotion.matches) g.phase += dt;
      const d = g.dying > 0;
      if (d) { g.dying -= dt; return g.dying <= 0; }
      if (g.age > LIFE) return true;
      const p = player, near = p && !p.dead && p.hp < p.maxHp - .5 ? Math.hypot(p.x - g.x, p.z - g.z) : 99;
      if (near < MAGNET && (g.rest || g.bounces >= 1)) {   // magnet: accelerates towards the hero's chest
        g.mag += dt; g.rest = false;
        const sp = (2.2 + 15 * Math.pow(1 - near / MAGNET, 2) + g.mag * 9) * dt, dx = p.x - g.x, dz = p.z - g.z, l = Math.max(.001, near);
        g.x += dx / l * Math.min(sp, l); g.z += dz / l * Math.min(sp, l); g.y += (1.05 - g.y) * Math.min(1, dt * 6);
        if (Math.hypot(p.x - g.x, p.z - g.z) < PICKUP) { collect(g); return false; }
        return false;
      }
      g.mag = 0;
      if (g.rest) { const base = HOVER + (reducedMotion.matches ? 0 : Math.sin(g.phase * 2.2) * .07); g.y += (base - g.y) * Math.min(1, dt * 8); return false; }
      g.vy -= GRAVITY * dt; g.y += g.vy * dt;
      proxy.x = g.x; proxy.z = g.z; const dx = g.vx * dt, dz = g.vz * dt;
      if (world && world.move) { world.move(proxy, dx, dz, .22); if (Math.abs(proxy.x - g.x) < Math.abs(dx) * .5) g.vx *= -.4; if (Math.abs(proxy.z - g.z) < Math.abs(dz) * .5) g.vz *= -.4; g.x = proxy.x; g.z = proxy.z; }
      else { g.x += dx; g.z += dz; }
      if (g.y < R && g.vy < 0) {
        g.y = R; g.bounces++;
        if (g.bounces === 1) fx('bloodSpray', { x: g.x, y: .1, z: g.z, dirX: g.vx, dirZ: g.vz, strength: .25 });
        if (g.bounces > 2 || g.vy > -2.2) { g.rest = true; g.vx = g.vz = g.vy = 0; }
        else { g.vy = -g.vy * .5; g.vx *= .55; g.vz *= .55; }
      }
      return false;
    }
    function update(dt) {
      if (disposed || !(dt > 0)) return;
      time += dt; uT.value = reducedMotion.matches ? 0 : time; uEm.value = low ? 0 : reducedMotion.matches ? .0 : 1;
      for (let i = globes.length - 1; i >= 0; i--) if (step(globes[i], dt)) globes.splice(i, 1);
      for (const l of labels) if (l.m.visible) {
        l.t += dt; const k = l.t / 1.1; if (k >= 1) { l.m.visible = false; l.t = 9; continue; }
        l.m.position.set(l.x, 1.9 + k * 1.1, l.z); l.m.material.opacity = k < .6 ? 1 : 1 - (k - .6) / .4;
      }
      for (let i = 0; i < SLOTS; i++) {
        const g = globes[i], G = uG[i], F = uF[i];
        if (!g) { G.set(0, 0, 0, 0); continue; }
        const left = LIFE - g.age, blink = !reducedMotion.matches && left < BLINK && !g.dying ? (.55 + .45 * Math.sin(g.age * (10 + (BLINK - left) * 5))) : 1;
        let sc = 1; if (g.dying > 0) sc = g.taken ? 0 : clamp(g.dying / .35, 0, 1); if (left < .4) sc = Math.min(sc, left / .4);
        G.set(g.x, g.y, g.z, sc); F.set(g.phase, reducedMotion.matches ? 0 : 1, reducedMotion.matches ? .5 : .5 + .5 * Math.sin(g.phase * 3.1), blink);
      }
      const any = globes.length > 0; sphereMesh.visible = fxMesh.visible = any;
    }
    function reset() { globes.length = 0; misses = 0; seed = 20260929; drops = picked = 0; for (const l of labels) { l.m.visible = false; l.t = 9; } for (const G of uG) G.set(0, 0, 0, 0); sphereMesh.visible = fxMesh.visible = false; }
    function setQuality(settings) { low = !!(settings && Number.isFinite(settings.particles) && settings.particles < 300); }
    function dispose() {
      if (disposed) return; disposed = true; globes.length = 0;
      sphereGeo.dispose(); fxGeo.dispose(); sphereMat.dispose(); fxMat.dispose();
      labels.forEach(l => { l.tex.dispose(); l.m.material.dispose(); }); group.removeFromParent();
    }
    function stats() { return { alive: globes.length, drops, picked, misses, children: group.children.length }; }
    return { roll, bonus, update, reset, setQuality, dispose, stats, globes, chance: CHANCE, spawn: spawnGlobe };
  }
  B.Globes = { create, CHANCE, PITY };
})();
