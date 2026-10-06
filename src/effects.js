/* KARA GEÇİT — physical hit feedback: blade smears that follow the real weapon, directional blood from the point of
   contact, sparks and flashes for blocks and parries, roll afterimages while the i-frames last, dust and persistent gore.
   Everything is procedural (no texture files). All amounts follow the quality preset (cfg.particles / cfg.decals). */
(() => {
  'use strict';
  const B = window.BABA, T = THREE, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  // Counts are scalar components, not vertices. Retain pending changes if a
  // hidden/shared buffer has not been submitted yet; keep one bounded range.
  function uploadPrefix(attribute, count) {
    if (count <= 0) return;
    for (const range of attribute.updateRanges) count = Math.max(count, range.start + range.count);
    attribute.clearUpdateRanges(); attribute.addUpdateRange(0, count); attribute.needsUpdate = true;
  }
  B.Effects = { create(scene, getGame, getSettings) {
    const root = new T.Group(); root.name = 'combat_feedback'; scene.add(root);
    const floorAt = (x, z, radius) => { const w = B.app && B.app.world; return w && w.effectHeightAt ? w.effectHeightAt(x, z, radius || 0) : .055; };
    const physicalFloorAt=(x,z)=>{const w=B.app&&B.app.world,y=w&&w.effectHeightAt?w.effectHeightAt(x,z,0)-.035:0;return Number.isFinite(y)?Math.max(0,y):0;};
    // ------------------------------------------------------------ particles (one draw call)
    const count = 1600, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), sizes = new Float32Array(count), alphas = new Float32Array(count), kinds = new Float32Array(count), ages = new Float32Array(count), seeds = Float32Array.from({ length: count }, (_, i) => (i * .61803398875) % 1), slots = new Array(count);
    const decals = [], waves = [], labels = [], flashes = [], trails = new Map(), ghosts = [], ghostSources = new Map();
    const labelPool = [], freeLabels = [], flashPool = new Set(), freeFlashes = [];
    const particlePool = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, time: 0, life: 0, size: 0, kind: 0 }));
    let particleColorDirty = false;
    let cursor = 0; const geometry = new T.BufferGeometry();
    for (const [n, a, size] of [['position', positions, 3], ['color', colors, 3], ['aSize', sizes, 1], ['aAlpha', alphas, 1], ['aKind', kinds, 1], ['aAge', ages, 1], ['aSeed', seeds, 1]]) geometry.setAttribute(n, new T.BufferAttribute(a, size).setUsage(T.DynamicDrawUsage));
    const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true, uniforms: { height: { value: innerHeight } },
      vertexShader: `attribute float aSize,aAlpha,aKind,aAge,aSeed;varying vec3 c;varying float a,k,age,seed;uniform float height;
        void main(){c=color;a=aAlpha;k=aKind;age=aAge;seed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*height/max(1.,-mv.z),1.,96.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 c;varying float a,k,age,seed;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){vec2 p=gl_PointCoord*2.-1.;float d=length(p),mask=1.-smoothstep(.4,1.,d);vec3 col=c;
          if(k<.5){d=length(p*vec2(.82,1.2));mask=(1.-smoothstep(.62,1.,d))*(.86+.14*sin(p.x*15.+p.y*9.));}
          else if(k<1.5){mask=pow(max(0.,1.-d),2.)+.6*pow(max(0.,1.-d*2.2),2.);}
          else if(k<2.5){float rot=seed*6.283+age*.3,cs=cos(rot),sn=sin(rot);vec2 q=mat2(cs,-sn,sn,cs)*p;
            float n=noise(q*3.1+seed*23.+vec2(age*.22,-age*.35)),fine=noise(q*7.3-seed*11.);
            float lobes=length(q*vec2(.9,1.08))+.16*(n-.5);mask=(1.-smoothstep(.3,.94,lobes))*smoothstep(.15,.85,n*.72+fine*.28)*.48;
            col=c*(.75+.5*n);}
          else if(k<3.5){mask=pow(max(0.,1.-d),2.2);}
          else{mask=pow(1.-smoothstep(0.,1.,d),2.);}
          if(mask*a<.009)discard;gl_FragColor=vec4(col,mask*a);}` });
    const particles = new T.Points(geometry, material); particles.frustumCulled = false; particles.visible = false; geometry.setDrawRange(0, 0); root.add(particles);
    function budget() { return Math.max(60, Math.min(count, getSettings().particles || 1100)); }
    function scaleCount(n) { return Math.max(2, Math.round(n * clamp(budget() / 1100, .3, 1))); }
    // kind: 0 blood drop, 1 spark streak, 2 dust/smoke, 3 glow mote, 4 buoyant ember (rises), 5 drifting mote (no gravity)
    // Explicit-velocity emitter used by the telegraphs (embers, ash, motes drawn inward) and the war cry.
    function emit(x, y, z, kind, color, vx, vy, vz, life, size) {
      const i = cursor++ % budget();
      const p = particlePool[i]; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.time = 0; p.life = life; p.size = size; p.kind = kind; slots[i] = p;
      colors[i * 3] = color[0]; colors[i * 3 + 1] = color[1]; colors[i * 3 + 2] = color[2]; kinds[i] = kind;
      particleColorDirty = true;
      return slots[i];
    }
    function particle(x, y, z, kind, color, speed = 1, angle = Math.random() * Math.PI * 2, lift = 1, spread) {
      const i = cursor++ % budget(), s = (spread === undefined ? .6 + Math.random() * 3 : spread) * speed;
      const p = particlePool[i]; p.x = x; p.y = y; p.z = z; p.vx = Math.sin(angle) * s; p.vy = (.6 + Math.random() * 3.8) * speed * lift; p.vz = Math.cos(angle) * s; p.time = 0;
      p.life = kind === 2 ? .65 + Math.random() * .6 : kind === 3 ? .3 + Math.random() * .3 : kind === 1 ? .16 + Math.random() * .3 : .28 + Math.random() * .55;
      p.size = kind === 0 ? .04 + Math.random() * .07 : kind === 1 ? .06 + Math.random() * .09 : kind === 3 ? .09 + Math.random() * .12 : .16 + Math.random() * .32; p.kind = kind; slots[i] = p;
      colors[i * 3] = color[0]; colors[i * 3 + 1] = color[1]; colors[i * 3 + 2] = color[2]; kinds[i] = kind;
      particleColorDirty = true;
      return slots[i];
    }
    // Solid impact fragments share two fixed GPU pools. Their faceted surfaces catch
    // the room lights; gravity, bounce and friction settle them on the actual floor.
    // Casting never allocates a mesh or shader, and the low preset bounds their count.
    const chipGeo = new T.IcosahedronGeometry(1, 0);
    // Cache the twelve hull points once; rotated chips land on their surface,
    // rather than burying a long edge using only their unrotated thickness.
    const chipHull = [], chipHullKeys = new Set(), chipPositions = chipGeo.attributes.position;
    for (let i = 0; i < chipPositions.count; i++) {
      const x = chipPositions.getX(i), y = chipPositions.getY(i), z = chipPositions.getZ(i), key = x + ':' + y + ':' + z;
      if (!chipHullKeys.has(key)) { chipHullKeys.add(key); chipHull.push([x,y,z]); }
    }
    const chipStoneMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .93, metalness: .04 });
    const chipMetalMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .47, metalness: .84 });
    const chipPools = [
      { cap: 96, mat: chipStoneMat, metal: false, list: [], mesh: null, cursor: 0 },
      { cap: 48, mat: chipMetalMat, metal: true, list: [], mesh: null, cursor: 0 }
    ];
    const chipDummy = new T.Object3D(), chipTint = new T.Color(), chipProxy={x:0,z:0};
    for (const pool of chipPools) {
      pool.mesh = new T.InstancedMesh(chipGeo, pool.mat, pool.cap);
      pool.mesh.name = pool.metal ? 'forged_impact_fragments' : 'stone_impact_fragments';
      pool.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      pool.mesh.frustumCulled = false; pool.mesh.count = 0; pool.mesh.visible = false;
      pool.mesh.castShadow = false; pool.mesh.receiveShadow = true;
      for (let i = 0; i < pool.cap; i++) {
        pool.list.push({ live: false, time: 0, life: 0, x: 0, y: 0, z: 0,
          vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0,
          sx: 0, sy: 0, sz: 0, floor: 0, bounce: 0, rest: false, shade: 0 });
        pool.mesh.setColorAt(i, chipTint.setRGB(.3, .27, .23));
      }
      pool.mesh.instanceColor.setUsage(T.DynamicDrawUsage); root.add(pool.mesh);
    }
    function fragments(x, y, z, o = {}) {
      const pool = chipPools[o.metal ? 1 : 0], n = Math.min(pool.cap, o.count === 1 ? 1 : scaleCount(o.count || 12));
      const spread = o.spread || .7, speed = o.speed || 4, lift = o.lift || 4,
        face = o.face || 0, arc = o.arc == null ? Math.PI * 2 : o.arc;
      for (let i = 0; i < n; i++) {
        const c = pool.list[pool.cursor++ % pool.cap], a = face + (Math.random() - .5) * arc,
          r = Math.sqrt(Math.random()) * spread, size = rnd(o.size || .08, (o.size || .08) * 1.8);
        c.live = true; c.time = 0; c.life = rnd(2.0, 3.8); c.rest = false; c.bounce = 0;
        c.x = x + Math.sin(a) * r; c.z = z + Math.cos(a) * r;
        c.floor = physicalFloorAt(c.x,c.z); c.y = Math.max(y, c.floor + size);
        c.vx = Math.sin(a) * speed * rnd(.35, 1); c.vz = Math.cos(a) * speed * rnd(.35, 1); c.vy = lift * rnd(.55, 1.15);
        c.rx = rnd(0, 6.28); c.ry = rnd(0, 6.28); c.rz = rnd(0, 6.28);
        c.wx = rnd(-9, 9); c.wy = rnd(-9, 9); c.wz = rnd(-9, 9);
        c.sx = size * (pool.metal ? rnd(1.1, 2.1) : rnd(.8, 1.5));
        c.sy = size * (pool.metal ? rnd(.18, .38) : rnd(.55, .95)); c.sz = size * rnd(.65, 1.25);
        c.shade = rnd(.7, 1.1);
      }
    }
    function fragmentsStep(dt) {
      const world=B.app&&B.app.world;
      for (const pool of chipPools) {
        let n = 0;
        for (const c of pool.list) {
          if (!c.live) continue; c.time += dt;
          if (c.time >= c.life) { c.live = false; continue; }
          if (!c.rest && dt > 0) {
            c.vy-=dt*12.5;const dx=c.vx*dt,dz=c.vz*dt;
            if(world&&world.move){chipProxy.x=c.x;chipProxy.z=c.z;world.move(chipProxy,dx,dz,Math.min(.14,Math.max(.04,c.sx*.55)));
              if(Math.abs(chipProxy.x-c.x)<Math.abs(dx)*.55)c.vx*=-.32;
              if(Math.abs(chipProxy.z-c.z)<Math.abs(dz)*.55)c.vz*=-.32;
              c.x=chipProxy.x;c.z=chipProxy.z;
            }else{c.x+=dx;c.z+=dz;}
            c.y+=c.vy*dt;c.floor=physicalFloorAt(c.x,c.z);
            c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
          }
          chipDummy.position.set(c.x, c.y, c.z); chipDummy.rotation.set(c.rx, c.ry, c.rz);
          chipDummy.scale.set(c.sx, c.sy, c.sz); chipDummy.updateMatrix();
          const matrix = chipDummy.matrix.elements; let support = 0;
          for (const v of chipHull) support = Math.max(support, -(matrix[1]*v[0] + matrix[5]*v[1] + matrix[9]*v[2]));
          if (c.y <= c.floor + support) {
            c.y = c.floor + support;
            if (!c.rest && dt > 0) {
              c.bounce++; c.vy = Math.abs(c.vy) * (pool.metal ? .24 : .18);
              c.vx *= .55; c.vz *= .55; c.wx *= .4; c.wy *= .4; c.wz *= .4;
              if (c.bounce > 2 || c.vy < .4) { c.rest = true; c.vy = c.wx = c.wy = c.wz = 0; }
            }
          }
          const vanish = 1 - Math.pow(clamp((c.time - c.life + .55) / .55, 0, 1), 3);
          // Shrinking resting chips keep their lower face on the floor.
          if (c.rest) c.y = c.floor + support * vanish;
          for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) matrix[col*4+row] *= vanish;
          matrix[13] = c.y;
          pool.mesh.setMatrixAt(n, chipDummy.matrix);
          const q = c.shade; chipTint.setRGB(pool.metal ? .31*q : .25*q, pool.metal ? .27*q : .22*q, pool.metal ? .22*q : .19*q);
          pool.mesh.setColorAt(n, chipTint); n++;
        }
        pool.mesh.count = n; pool.mesh.visible = n > 0;
        if (n) { pool.mesh.instanceMatrix.needsUpdate = true; pool.mesh.instanceColor.needsUpdate = true; }
      }
    }
    function fragmentsClear() {
      for (const pool of chipPools) { for (const c of pool.list) c.live = false; pool.mesh.count = 0; pool.mesh.visible = false; }
    }
    // ------------------------------------------------------------ textures
    function canvasTexture(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
    const bloodMap = canvasTexture(256, (ctx) => {
      const g = ctx.createRadialGradient(126, 128, 5, 126, 128, 76); g.addColorStop(0, 'rgba(105,9,15,.95)'); g.addColorStop(.55, 'rgba(64,3,8,.92)'); g.addColorStop(1, 'rgba(46,2,8,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * 100, r = 1 + Math.random() * 9; ctx.fillStyle = `rgba(${35 + Math.floor(Math.random() * 45)},3,8,${.35 + Math.random() * .55})`; ctx.beginPath(); ctx.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, r * (.3 + Math.random() * .6), a, 0, Math.PI * 2); ctx.fill(); }
    });
    // A directional splash: heavy at the origin, flung droplets and streaks along +x.
    const sprayMap = canvasTexture(256, (ctx) => {
      const g = ctx.createRadialGradient(70, 128, 4, 70, 128, 60); g.addColorStop(0, 'rgba(96,6,12,.95)'); g.addColorStop(.6, 'rgba(60,3,8,.85)'); g.addColorStop(1, 'rgba(40,2,6,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 46; i++) { const t = Math.pow(Math.random(), .7), x = 70 + t * 175, y = 128 + (Math.random() - .5) * (30 + t * 120), r = (1 - t) * 9 + 1.2; ctx.fillStyle = `rgba(${40 + Math.floor(Math.random() * 45)},3,8,${.5 + Math.random() * .45})`; ctx.beginPath(); ctx.ellipse(x, y, r * (1.2 + t * 2.2), r * .6, (y - 128) / 300, 0, Math.PI * 2); ctx.fill(); }
    });
    const flashMap = canvasTexture(128, (ctx, s) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,240,215,.85)'); g.addColorStop(.35, 'rgba(255,190,120,.25)'); g.addColorStop(1, 'rgba(255,150,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      ctx.globalCompositeOperation = 'lighter';
      for (const [a, w, l] of [[0, 3.2, 62], [Math.PI / 2, 3.2, 62], [Math.PI / 4, 1.6, 36], [-Math.PI / 4, 1.6, 36]]) {
        ctx.save(); ctx.translate(64, 64); ctx.rotate(a); const lg = ctx.createLinearGradient(-l, 0, l, 0); lg.addColorStop(0, 'rgba(255,230,190,0)'); lg.addColorStop(.5, 'rgba(255,250,235,.95)'); lg.addColorStop(1, 'rgba(255,230,190,0)'); ctx.fillStyle = lg; ctx.fillRect(-l, -w / 2, l * 2, w); ctx.restore();
      }
    });
    const plane = new T.PlaneGeometry(1, 1);
    // ------------------------------------------------------------ decals, waves, flashes, labels
    // Blood accumulates on the hero's blade, armour and hands over a fight (uniform kBlood of the shared hero materials; free at every preset).
    let gear = null, gearBlood = 0;
    function gearApply() {
      const game = getGame(), model = game && game.player && game.player.model; if (!model) return;
      if (!gear || gear.model !== model) {
        gear = { model, list: [] }; const seen = new Set();
        model.root.traverse(o => { const m = o.material, g = m && m.userData && m.userData.grade; if (!g || !g.kBlood || seen.has(m)) return; seen.add(m);
          const n = m.name || ''; if (n === 'kara-blade-runes') gear.list.push({ u: g.kBlood, base: g.kBlood.value, gain: .85 }); else if (/^(kara-hero-(iron|skin|leather)|kara-equipment-.+)$/.test(n)) gear.list.push({ u: g.kBlood, base: g.kBlood.value, gain: n === 'kara-hero-skin' ? .3 : .45 }); });
      }
      for (const e of gear.list) e.u.value = e.base + e.gain * gearBlood;
    }
    function gearHit(amount) { gearBlood = Math.min(1, gearBlood + amount); gearApply(); }
    // ------------------------------------------------------------ gore (BLOOD): arterial sprays, gibs, decals, prints, drips (DESIGN.md "Gore")
    // Everything is pooled: one instanced decal mesh (atlas), one stretched-streak mesh, one instanced gib mesh. Amounts follow the preset
    // (High 100 %, Medium 70 %, Low 40 % of every count) and are halved with reduced motion.
    const GS = 320, GC = 28, GD = 240, GFLOOR = .036;
    const gTier = () => { const p = getSettings().particles || 650; return p >= 600 ? 1 : p >= 300 ? .7 : .4; };
    const gn = n => Math.max(1, Math.round(n * gTier() * (reduced.matches ? .5 : 1)));
    const BCOL = [[.10, .002, .004], [.06, .002, .003], [.16, .006, .008]], BART = [.20, .005, .008];
    // Decal atlas, 3 x 2 cells of 256 px, grey = thickness (tinted and aged in the shader): 0 splat, 1 spray (heavy end left, flung along +x), 2 smear/drip (thick tail left, drop at the right), 3 boot print (toe along +x), 4 puddle.
    const goreAtlas = (() => { const c = document.createElement('canvas'); c.width = 768; c.height = 512; ((ctx) => {
      const R = Math.random, rr = (a, b) => a + R() * (b - a), gray = (v, a) => `rgba(${v},${v},${v},${a})`;
      const blob = (x, y, rx, ry, rot, v, a, hard = .55) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(rx, ry); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, gray(v, a)); g.addColorStop(hard, gray(v, a * .92)); g.addColorStop(1, gray(v, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.3); ctx.fill(); ctx.restore(); };
      const spike = (x, y, ang, len, w, v, a) => {   // tapered stroke that ends in a drop
        const bend = rr(-.1, .1) * len; ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = gray(v, a * .75); ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.quadraticCurveTo(len * .5, -w * .3 + bend, len, bend); ctx.quadraticCurveTo(len * .5, w * .3 + bend, 0, w / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = gray(v, a); ctx.beginPath(); ctx.moveTo(0, -w * .3); ctx.quadraticCurveTo(len * .5, -w * .16 + bend, len * .92, bend); ctx.quadraticCurveTo(len * .5, w * .16 + bend, 0, w * .3); ctx.closePath(); ctx.fill(); ctx.restore();
        blob(x + Math.cos(ang) * len - Math.sin(ang) * bend, y + Math.sin(ang) * len + Math.cos(ang) * bend, w * .6, w * .6, 0, v, a, .5);
      };
      const cell = (ox, oy, draw) => { ctx.save(); ctx.translate(ox, oy); ctx.beginPath(); ctx.rect(0, 0, 256, 256); ctx.clip(); draw(); ctx.restore(); };
      cell(0, 0, () => {   // 0 splat
        for (let i = 0; i < 9; i++) blob(128 + rr(-26, 26), 128 + rr(-26, 26), rr(26, 46), rr(24, 44), rr(0, 3), rr(225, 255), .96);
        for (let i = 0; i < 14; i++) { const a = R() * 6.283, d = rr(40, 66); blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, rr(9, 24), rr(8, 20), a, rr(200, 240), .9); }
        for (let i = 0; i < 20; i++) spike(128 + Math.cos(i * 1.7) * 22, 128 + Math.sin(i * 1.7) * 22, i * 1.7 + rr(-.3, .3), rr(40, 86), rr(4, 11), rr(170, 225), .92);
        for (let i = 0; i < 38; i++) { const a = R() * 6.283, d = rr(70, 122), r = rr(1.5, 6) * (1.2 - (d - 70) / 90); blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r * rr(1, 2.2), r, a, rr(190, 235), .95, .8); }
      });
      cell(256, 0, () => {   // 1 spray
        for (let i = 0; i < 5; i++) blob(52 + rr(-12, 14), 128 + rr(-16, 16), rr(16, 30), rr(14, 26), rr(0, 3), rr(230, 255), .96);
        for (let i = 0; i < 34; i++) { const ang = (R() + R() - 1) * .7, len = rr(40, 185) * (1 - Math.abs(ang) * .35); spike(64, 128 + ang * 14, ang, len, rr(2.5, 9) * (1 - Math.abs(ang) * .5), rr(150, 235), .9); }
        for (let i = 0; i < 70; i++) { const t = Math.pow(R(), .7), x = 90 + t * 150, y = 128 + (R() - .5) * (24 + t * 150), r = rr(1.5, 6) * (1.1 - t * .6); blob(x, y, r * rr(1.2, 2.6), r, (y - 128) / 260, rr(185, 235), .92, .8); }
      });
      cell(512, 0, () => {   // 2 smear / drip
        const path = (k, v, a) => { ctx.fillStyle = gray(v, a); ctx.beginPath(); const pts = []; for (let x = 14; x <= 232; x += 6) { const w = (30 * Math.pow(1 - (x - 14) / 230, .8) + 4) * k * (1 + Math.sin(x * .11 + 1) * .12); pts.push([x, w]); }
          pts.forEach(([x, w], i) => ctx[i ? 'lineTo' : 'moveTo'](x, 128 - w / 2)); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], 128 + pts[i][1] / 2); ctx.closePath(); ctx.fill(); };
        path(1.1, 215, .3); path(.9, 225, .5); path(.6, 240, .9); path(.32, 255, .95);
        blob(224, 128, 11, 12, 0, 240, .95, .65);
        for (let i = 0; i < 9; i++) blob(rr(40, 200), 128 + rr(-22, 22), rr(1.5, 4), rr(1.5, 3), 0, rr(190, 235), .9, .8);
      });
      cell(0, 256, () => {   // 3 boot print
        blob(150, 128, 58, 44, 0, 235, .96, .8); blob(56, 128, 34, 30, 0, 235, .96, .8); blob(104, 128, 32, 20, 0, 205, .8, .8);
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.4)';
        for (let i = 0; i < 5; i++) ctx.fillRect(114 + i * 19, 86, 6, 84); for (let i = 0; i < 2; i++) ctx.fillRect(38 + i * 20, 104, 6, 48);
        ctx.globalCompositeOperation = 'source-over';
      });
      cell(256, 256, () => {   // 4 puddle: soft irregular lobes, thin rim, thick middle
        for (let i = 0; i < 14; i++) { const a = R() * 6.283, d = rr(0, 42); blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, rr(46, 78), rr(42, 74), R() * 3, rr(105, 140), .97, .95); }
        for (let i = 0; i < 9; i++) { const q = i / 9; blob(128 + rr(-26, 26), 128 + rr(-26, 26), 62 - q * 34, 58 - q * 32, R() * 3, 150 + q * 105, .9, .3); }
        for (let i = 0; i < 12; i++) { const a = R() * 6.283, d = rr(98, 122); blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, rr(2, 6), rr(2, 5), a, rr(180, 230), .9, .8); }
      });
    })(c.getContext('2d')); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; })();
    const gdMat = new T.MeshStandardMaterial({ map: goreAtlas, transparent: true, roughness: .3, metalness: .05, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    gdMat.onBeforeCompile = (s) => {   // per instance: atlas cell, drying (fresh red -> dark brown, wet -> dull) and opacity
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aD;varying vec4 vD;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvD=aD;\n#ifdef USE_MAP\nvMapUv=(vMapUv+aD.xy)*vec2(.3333333,.5);\n#endif');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vD;').replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb=mix(vec3(.15,.002,.004),vec3(.03,.004,.004),vD.z)*(.3+.95*diffuseColor.r);diffuseColor.a*=vD.w;\n#endif')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.1,.62,vD.z);');
    };
    gdMat.customProgramCacheKey = () => 'kgGoreDecal';
    const gdGeo = new T.PlaneGeometry(1, 1), gdAttr = new T.InstancedBufferAttribute(new Float32Array(GD * 4), 4).setUsage(T.DynamicDrawUsage); gdGeo.setAttribute('aD', gdAttr);
    const gdMesh = new T.InstancedMesh(gdGeo, gdMat, GD); gdMesh.count = 0; gdMesh.visible = false; gdMesh.frustumCulled = false; gdMesh.renderOrder = -2; gdMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(gdMesh);
    const gdPri = [], gdMic = [], gdTmp = new T.Object3D();
    // Primary decals (pools, prints, walls, big splats) keep the preset's cfg.decals limit; landing droplets get their own extra allowance.
    function gdAdd(o, micro) {
      const cfg = getSettings(); if (!(cfg.decals > 0)) return null;
      // Horizontal blood belongs to the supporting floor; wall decals retain
      // their explicit height and orientation. Resolve once before caching.
      if(o.rx==null||Math.abs(o.rx+Math.PI/2)<1e-5)o.y+=physicalFloorAt(o.x,o.z);
      o.t = 0; o.micro = !!micro; o.life = o.life || Math.max(12, cfg.decals) * (micro ? .7 : 1.15); o.a0 = o.a0 == null ? 1 : o.a0; o.rx = o.rx == null ? -Math.PI / 2 : o.rx; o.ry = o.ry || 0; o.sy = o.sy || o.sx;
      const priCap = Math.min(GD - 40, Math.max(20, Math.round(cfg.decals * 1.4))), list = micro ? gdMic : gdPri, micCap = Math.min(GD - priCap, Math.round(cfg.decals * 1.6) + 20);
      list.push(o); while (gdPri.length > priCap) gdPri.shift(); while (gdMic.length > micCap) gdMic.shift(); return o;
    }
    const gdLists = [gdMic, gdPri];
    function gdStep(dt) {
      let n = 0; const arr = gdAttr.array, marr = gdMesh.instanceMatrix.array;
      for (let li = 0; li < 2; li++) for (let i = 0, list = gdLists[li]; i < list.length; i++) {
        const d = list[i]; d.t += dt; if (d.t > d.life) { list.splice(i--, 1); continue; }
        // A decal whose growth / drip has finished never changes its matrix again: build it once, then copy the 16 numbers.
        if (d.m && (!d.grow || d.t >= d.grow.dur) && (!d.drip || d.t >= d.drip.dur)) marr.set(d.m, n * 16);
        else {
          let sx = d.sx, sy = d.sy, py = d.y;
          if (d.grow) { const k = Math.min(1, d.t / d.grow.dur), f = d.grow.f0 + (d.grow.f1 - d.grow.f0) * (1 - Math.pow(1 - k, 3)); sx *= f; sy *= f; }
          if (d.drip) { const k = Math.min(1, d.t / d.drip.dur), L = Math.max(.02, d.drip.len * (1 - Math.pow(1 - k, 2))); sx = L; py = d.drip.top - L * .5; }
          gdTmp.position.set(d.x, py, d.z); gdTmp.rotation.set(d.rx, d.ry, d.rot); gdTmp.scale.set(sx, sy, 1); gdTmp.updateMatrix(); gdMesh.setMatrixAt(n, gdTmp.matrix);
          if ((!d.grow || d.t >= d.grow.dur) && (!d.drip || d.t >= d.drip.dur)) d.m = gdTmp.matrix.elements.slice();
        }
        arr[n * 4] = d.cell % 3; arr[n * 4 + 1] = d.cell < 3 ? 1 : 0; arr[n * 4 + 2] = 1 - Math.exp(-d.t / (d.dryT || 26)); arr[n * 4 + 3] = d.a0 * Math.min(1, d.t / .05) * clamp((d.life - d.t) / 8, 0, 1); n++;
      }
      gdMesh.count = n; gdMesh.visible = n > 0; uploadPrefix(gdMesh.instanceMatrix, n * 16); uploadPrefix(gdAttr, n * 4);
    }
    const dirX = a => Math.sin(a), dirZ = a => Math.cos(a);
    function splat(x, z, size, micro, a0) { return gdAdd({ cell: 0, x, y: GFLOOR, z, rot: rnd(0, 6.28), sx: size, sy: size * rnd(.8, 1.05), a0, grow: { f0: .75, f1: 1, dur: .4 + size * .5 } }, micro); }
    function spraySplat(x, z, a, len, wid, micro) { return gdAdd({ cell: 1, x: x + dirX(a) * len * .27, y: GFLOOR, z: z + dirZ(a) * len * .27, rot: a - Math.PI / 2, sx: len, sy: wid, grow: { f0: .6, f1: 1, dur: .3 } }, micro); }
    function smear(x, z, a, len, wid, micro) { return gdAdd({ cell: 2, x: x + dirX(a) * len * .44, y: GFLOOR, z: z + dirZ(a) * len * .44, rot: a - Math.PI / 2, sx: len, sy: wid }, micro); }
    // Blood on a wall face (left wall faces +x, right wall faces -x), with a run that creeps down.
    function wallSplat(wx, y, z, left, size, drip, micro) {
      const ry = left ? Math.PI / 2 : -Math.PI / 2, x = wx + (left ? .03 : -.03);
      gdAdd({ cell: 0, x, y, z, rx: 0, ry, rot: rnd(0, 6.28), sx: size, sy: size * rnd(.8, 1.05), grow: { f0: .8, f1: 1, dur: .5 } }, micro);
      if (drip > 0) gdAdd({ cell: 2, x, y, z, rx: 0, ry, rot: -Math.PI / 2, sx: drip, sy: .05 + size * .14, drip: { len: drip, dur: 2.5 + Math.random() * 2.5, top: y - size * .15 }, dryT: 40 }, micro);
    }
    // A pool that keeps spreading under a body: a main lobe plus two side lobes, growing slowly, staying wet for a long time.
    function bloodPool(x, z, size, delay) {
      if (getSettings().decals <= 0) return; const slow = reduced.matches ? .01 : 1;
      for (let i = 0; i < 2; i++) { const s = i ? size * rnd(.5, .75) : size, a = rnd(0, 6.28), off = i ? size * .28 : 0;
        gdAdd({ cell: 4, x: x + Math.sin(a) * off, y: GFLOOR - i * .0003, z: z + Math.cos(a) * off, rot: rnd(0, 6.28), sx: s * rnd(.85, 1.15), sy: s * rnd(.85, 1.15), a0: .88, dryT: 90, grow: { f0: .18, f1: 1, dur: (3.6 + i) * slow } }, false); }
    }
    // Old entry point: one splat (directional when a spray angle is given).
    function blood(x, z, heavy, spray) {
      if (Number.isFinite(spray)) spraySplat(x, z, spray, heavy ? 3.0 : 2.0, heavy ? 1.7 : 1.1, false); else splat(x, z, heavy ? 1.9 : 1.1, false);
      if (heavy) smear(x, z, (Number.isFinite(spray) ? spray : Math.random() * 6.28) + rnd(-.5, .5), 1.4, .34, true);
    }
    // ---- room walls (long side walls only) so droplets can stick to them
    function wallBox(z) {
      const rooms = B.app && B.app.world && B.app.world.rooms; if (!rooms) return null;
      for (const r of rooms) if (Math.abs(z - r.z) <= r.d / 2) return { l: r.x - r.w / 2 + .375, r: r.x + r.w / 2 - .375, top: r.id === 6 ? 5.8 : 4.25 };
      return { l: -3.35, r: 3.35, top: 2.1 };
    }
    // ---- stretched blood streaks (droplets, jets): one camera-facing quad each, tapered tail, round head, normal blending
    const bsPos = new Float32Array(GS * 12), bsUv = new Float32Array(GS * 8), bsCol = new Float32Array(GS * 16), bsIdx = [], bs = new Array(GS).fill(null); let bsCur = 0, bsLive = 0;
    for (let i = 0; i < GS; i++) { bsUv.set([0, 0, 0, 1, 1, 1, 1, 0], i * 8); bsIdx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
    const bsGeo = new T.BufferGeometry(); bsGeo.setIndex(bsIdx); bsGeo.setAttribute('position', new T.BufferAttribute(bsPos, 3).setUsage(T.DynamicDrawUsage)); bsGeo.setAttribute('uv', new T.BufferAttribute(bsUv, 2)); bsGeo.setAttribute('aCol', new T.BufferAttribute(bsCol, 4).setUsage(T.DynamicDrawUsage));
    const bsMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
      vertexShader: 'attribute vec4 aCol;varying vec2 vUv;varying vec4 c;void main(){vUv=uv;c=aCol;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;varying vec4 c;void main(){float ux=clamp(vUv.x,0.,1.);float dy=abs(vUv.y*2.-1.);float prof=.24+.76*smoothstep(0.,.7,ux);float cap=ux>.84?sqrt(max(0.,1.-pow((ux-.84)/.16,2.))):1.;float e=1.-dy/max(prof*cap,.001);float a=smoothstep(0.,.32,e)*(.3+.7*smoothstep(0.,.55,ux))*c.a;if(a<.012)discard;float sh=pow(clamp(1.-dy*1.7,0.,1.),3.)*(.3+.7*ux);vec3 col=c.rgb*(.72+.5*(1.-dy))+vec3(.34,.13,.11)*sh*.12;gl_FragColor=vec4(col,a);}' });
    const bsMesh = new T.Mesh(bsGeo, bsMat); bsMesh.frustumCulled = false; bsMesh.renderOrder = 4; bsMesh.visible = false; root.add(bsMesh);
    function bstreak(x, y, z, vx, vy, vz, life, w, col, stick, kid) {
      const cap = Math.max(40, Math.round(GS * gTier())); bs[bsCur++ % cap] = { x, y, z, vx, vy, vz, t: 0, life, w, col: col || BCOL[Math.random() < .6 ? 0 : Math.random() < .75 ? 1 : 2], stick: stick == null ? .3 : stick, kid: !!kid };
      bsMesh.visible = true;
    }
    // a fan of droplets/jets from (x,y,z) thrown along heading a; fan = half spread, sp = speed scale, w = thickness scale
    function bfan(x, y, z, a, n, fan, sp, w, lift, stick) {
      for (let i = 0; i < n; i++) { const jet = i < n * .35, an = a + (Math.random() - .5) * 2 * fan * (jet ? .3 : 1), s = (3 + 8 * Math.pow(Math.random(), .6)) * sp * (jet ? 1.15 : 1);
        bstreak(x + rnd(-.06, .06), y + rnd(-.1, .1), z + rnd(-.06, .06), Math.sin(an) * s, (1.2 + Math.random() * 4.2) * lift, Math.cos(an) * s, .8 + Math.random() * .5, (jet ? .075 : .05) * w * rnd(.7, 1.3), jet && Math.random() < .5 ? BART : null, stick); }
    }
    // ---- actors (hero + living foes near him): droplets that hit a body stay on it and drip; bleeding actors shed drops for a while
    const gActors = [], gActorPool = [], bleeders = [];
    // The actor list is rebuilt every frame; its records are recycled instead of allocated (no per-frame garbage).
    function gActorAdd(e, r, h) { const a = gActorPool[gActors.length] || (gActorPool[gActors.length] = { e: null, r: 0, h: 0 }); a.e = e; a.r = r; a.h = h; gActors.push(a); }
    function bleedAdd(actor, amt) {
      let b = bleeders.find(q => q.a === actor); if (!b) { if (bleeders.length >= 14) bleeders.shift(); b = { a: actor, left: 0, rate: 0, acc: 0 }; bleeders.push(b); }
      b.left = Math.min(4.5, b.left + amt * 2.2); b.rate = Math.max(b.rate, 3 + amt * 8);
    }
    // ---- gibs: lumpy lit chunks that tumble, splat and skid, then lie for a while
    const chGeoG = (() => { const g = new T.IcosahedronGeometry(1, 1), p = g.attributes.position, h = [];
      for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 40) + '_' + Math.round(p.getY(i) * 40) + '_' + Math.round(p.getZ(i) * 40); if (h[k] == null) h[k] = .72 + Math.random() * .5; p.setXYZ(i, p.getX(i) * h[k], p.getY(i) * h[k] * .8, p.getZ(i) * h[k]); }
      g.computeVertexNormals(); return g; })();
    const gcMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .3, metalness: 0 }), gcMesh = new T.InstancedMesh(chGeoG, gcMat, GC);
    gcMesh.count = 0; gcMesh.visible = false; gcMesh.frustumCulled = false; gcMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); gcMesh.setColorAt(0, new T.Color()); root.add(gcMesh);
    const GCOL = [[.16, .008, .012], [.11, .006, .009], [.26, .07, .06], [.42, .37, .3]], gibs = []; const gcTmp = new T.Object3D(), gcCol = new T.Color();
    function gib(x, y, z, a, sp, size) {
      const cap = Math.max(6, Math.round(GC * gTier())); while (gibs.length >= cap) gibs.shift();
      const an = a + rnd(-.9, .9), s = sp * rnd(.35, 1), c = GCOL[Math.random() < .25 ? 3 : Math.random() < .3 ? 2 : Math.random() < .5 ? 0 : 1];
      gibs.push({ x, y, z, vx: Math.sin(an) * s, vy: rnd(2, 5.5) * Math.min(1.4, .6 + sp / 8), vz: Math.cos(an) * s, rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6), wx: rnd(-14, 14), wy: rnd(-14, 14), wz: rnd(-14, 14), size, ax: rnd(.8, 1.5), az: rnd(.8, 1.5), t: 0, rest: false, hit: 0, trail: 0, col: c });
    }
    // ---- heartbeat spurts (arterial jets from a wound or a stump); follows the nearest foe so a sliding corpse keeps spurting
    const spurts = [];
    function spurt(x, y, z, a, pow, dur, period, follow) {
      if (spurts.length >= 10) spurts.shift(); if (reduced.matches) { dur *= .5; }
      const f = follow || null;
      spurts.push({ x, y, z, a, pow, dur, period, t: 0, acc: 0, f, ox: f ? x - f.x : 0, oz: f ? z - f.z : 0, lx: x, lz: z, mv: 0 });
    }
    function nearestFoe(x, z, r, deadToo) {
      const game = getGame(); let best = null, bd = r * r; if (!game) return null;
      for (const e of game.enemies) { if (e.dead && !deadToo) continue; const d = (e.x - x) * (e.x - x) + (e.z - z) * (e.z - z); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    // ---- footprints and the blade
    let feet = 0, footSide = 1, bladeBlood = 0, dripAcc = 0, bladeHave = false, lastDir = { a: 0, t: -9 };
    const bladeP = new T.Vector3(), bladeV = new T.Vector3(), bladeQ = new T.Vector3();
    function bloodUnder(x, z) {
      let s = 0; for (const list of [gdPri, gdMic]) for (const d of list) { if (d.cell === 3 || d.cell === 2 || d.rx === 0 || d.t > 40 || d.a0 < .3) continue; const r = Math.max(d.sx, d.sy) * (d.grow ? d.grow.f1 : 1) * .38, dx = d.x - x, dz = d.z - z; if (dx * dx + dz * dz < r * r) s += d.cell === 4 || (d.cell === 0 && d.sx > 1.2) ? .6 : .3; }
      return Math.min(1, s);
    }
    function footPrint(x, z, yaw, k) {
      const side = footSide; footSide = -footSide;
      gdAdd({ cell: 3, x: x + Math.cos(yaw) * side * .1, y: GFLOOR + .001, z: z - Math.sin(yaw) * side * .1, rot: yaw - Math.PI / 2, sx: .62, sy: .9, a0: .3 + .65 * k, life: 22, dryT: 14 }, true);
    }
    // ---- one blow: heading a (direction the blood is thrown), S = strength (light .5, heavy 1, kill 1.5+), o = { kill, heavy, boss, player, foe }
    function goreHit(x, y, z, a, S, o) {
      const dec = getSettings().decals > 0;
      bfan(x, y, z, a, gn(12 + 22 * S), .32 + .28 * Math.min(S, 1.6), .62 + .34 * S, .8 + .3 * S, .75 + .25 * S, .3);
      if (S > .7) bfan(x, y, z, a + Math.PI + rnd(-.4, .4), gn(3 + 6 * S), .7, .4 + .25 * S, .75, .7, .3);   // exit backspray
      for (let i = 0; i < gn(6 + 12 * S); i++) particle(x, y + rnd(-.1, .1), z, 0, i % 2 ? RED : DARK, .5 + .4 * S, a + rnd(-.9, .9), .5).size = rnd(.025, .06);   // fine mist
      if (S >= .95 || o.kill) spurt(x, y, z, a + rnd(-.25, .25), .55 + .3 * S, o.kill ? .2 + .3 * S : .2, .55, o.foe);
      else if (S > .45) spurt(x, y, z, a, .3 + .4 * S, .16, .4, o.foe);
      if (S >= .95 || (o.kill && S > .6)) for (let i = 0, n = gn(Math.round((o.kill ? 2 : 1) * (1 + S) * (o.boss ? 1.4 : 1))); i < n; i++) gib(x, y, z, a, 4 + 5 * S, rnd(.045, .1) * (.8 + .3 * S));
      if (dec) { spraySplat(x, z, a, 1.6 + 1.8 * S, .9 + .6 * S, false); if (S > .8) splat(x + dirX(a) * .4, z + dirZ(a) * .4, .7 + .5 * S, true); }
      lastDir.a = a; lastDir.t = performance.now();
      if (o.foe) bleedAdd(o.foe, S); const game = getGame();
      if (game && S >= .95) for (const e of game.enemies) if (e !== o.foe && !e.dead && Math.abs(e.x - x) < 2.8 && Math.abs(e.z - z) < 2.8) bleedAdd(e, S * .35);
      if (!o.player) bladeBlood = Math.min(1, bladeBlood + .18 * S);
      const wb = wallBox(z);   // a blow near a wall paints it
      if (wb && dec) { if (x - wb.l < 2.6 && Math.sin(a) < 0) wallSplat(wb.l, clamp(y + rnd(-.3, .5), .4, wb.top - .4), z + rnd(-.5, .5), true, rnd(.5, .9) * (.6 + .4 * S), rnd(.4, 1.1) * S, false); else if (wb.r - x < 2.6 && Math.sin(a) > 0) wallSplat(wb.r, clamp(y + rnd(-.3, .5), .4, wb.top - .4), z + rnd(-.5, .5), false, rnd(.5, .9) * (.6 + .4 * S), rnd(.4, 1.1) * S, false); }
    }
    // The killing blow: everything opens up. big = boss / heavy finisher.
    function goreKill(x, y, z, a, big, foe, boss) {
      big = true;   // killing blows are always at full gore (no setting), the preset only scales the counts
      const S = 1.9;
      for (let i = 0; i < gn(big ? 46 : 30); i++) { const an = Math.random() * 6.283, s = (2 + Math.random() * 6) * (big ? 1.3 : 1); bstreak(x + rnd(-.2, .2), y + rnd(-.3, .3), z + rnd(-.2, .2), Math.sin(an) * s + Math.sin(a) * 2, 1.5 + Math.random() * 6, Math.cos(an) * s + Math.cos(a) * 2, .9 + Math.random() * .5, .06 * rnd(.7, 1.5), null, .35); }
      for (let i = 0; i < gn(big ? 14 : 8); i++) particle(x, y, z, 0, i % 2 ? RED : DARK, 1.2, Math.random() * 6.28, .7).size = rnd(.03, .07);
      for (let i = 0; i < gn(12); i++) gib(x, y, z, Math.random() * 6.28, 3 + Math.random() * 7, rnd(.05, .13));
      const f = foe || nearestFoe(x, z, 1.4, true);
      spurt(x, Math.max(.8, y), z, a + rnd(-.3, .3), 1.15, 3.6, .6, f); spurt(x, Math.max(.7, y - .1), z, a + Math.PI * rnd(.5, .9) * (Math.random() < .5 ? 1 : -1), .8, 2.8, .74, f); spurt(x, Math.max(.9, y + .1), z, a + rnd(-1.2, 1.2), .7, 2.2, .52, f);
      bfan(x, y, z, a, gn(34), .8, 1.25, 1.25, 1.1, .35);
      bloodPool(x, z, boss ? 5.4 : 4.2);
      if (getSettings().decals > 0) { for (let i = 0; i < 3; i++) spraySplat(x, z, Math.random() * 6.28, rnd(1.6, 3.2), rnd(.9, 1.6), i > 0); splat(x, z, 2.6, false); }
    }
    // Public hook (LIMBS / dismemberment): kind 'spray' | 'burst' | 'stump' | 'mist' | 'chunks'; heading (dirX, dirZ) = where the blood is thrown; strength ~ .3 (nick) .. 1 (limb) .. 2 (boss).
    function gore(kind, x, y, z, dx, dz, strength) {
      const a = dx || dz ? Math.atan2(dx, dz) : Math.random() * 6.283, S = clamp(strength == null ? 1 : strength, .15, 3); if (!getGame()) return; y = y == null ? 1 : y;
      if (kind === 'spray' || kind === 'bloodSpray') goreHit(x, y, z, a, S, { foe: nearestFoe(x, z, 1.2, true) });
      else if (kind === 'burst' || kind === 'goreBurst') goreKill(x, y, z, a, S > 1.5, null);
      else if (kind === 'stump' || kind === 'stumpSpurt') { bfan(x, y, z, a, gn(14 + 10 * S), .3, .9, 1, .9, .3); spurt(x, y, z, a, .7 + .4 * S, 2.6 + S, .58, nearestFoe(x, z, 1.2, true)); if (getSettings().decals > 0) spraySplat(x, z, a, 1.2 + S, .8 + .4 * S, false); }
      else if (kind === 'mist') bfan(x, y, z, a, gn(10 + 10 * S), .9, .5, .6, .7, .1);
      else if (kind === 'chunks') for (let i = 0; i < gn(2 + 3 * S); i++) gib(x, y, z, a, 4 + 4 * S, rnd(.05, .11));
    }
    // ---- per frame
    let landBudget = 0;
    function goreStep(dt) {
      const game = getGame(), calm = reduced.matches; landBudget = 16;
      gActors.length = 0; if (game && game.player) { const p = game.player; if (!p.dead) gActorAdd(p, .42, 1.9); for (const e of game.enemies) if (!e.dead && Math.abs(e.z - p.z) < 14 && Math.abs(e.x - p.x) < 14) gActorAdd(e, e.boss ? .95 : .48, e.boss ? 3.2 : 2); }
      // spurts
      for (let i = spurts.length - 1; i >= 0; i--) {
        const s = spurts[i]; s.t += dt; if (s.t > s.dur) { spurts.splice(i, 1); continue; }
        if (s.f) { s.x = s.f.x + s.ox; s.z = s.f.z + s.oz; if (s.f.dead) s.y = Math.max(.32, s.y - dt * .9); const mx = s.x - s.lx, mz = s.z - s.lz; s.mv += Math.hypot(mx, mz); if (s.mv > .5 && !calm && s.f.dead) { smear(s.lx, s.lz, Math.atan2(mx, mz), s.mv * 1.5 + .5, .55, false); s.mv = 0; s.lx = s.x; s.lz = s.z; } }
        const ph = (s.t % s.period) / s.period, e = ph < .1 ? ph / .1 : Math.exp(-(ph - .1) * 5.5), env = Math.pow(1 - s.t / s.dur, .6);
        s.acc += 190 * s.pow * env * e * dt * gTier() * (calm ? .5 : 1);
        while (s.acc >= 1) { s.acc--; const an = s.a + rnd(-.09, .09), sp = (4.2 + Math.random() * 3.6) * (.55 + .55 * Math.sqrt(s.pow)) * (.55 + .45 * e);
          bstreak(s.x, s.y, s.z, Math.sin(an) * sp, 2.8 + Math.random() * 3.4 * e, Math.cos(an) * sp, 1, .07 * rnd(.8, 1.35), Math.random() < .5 ? BART : null, .45); }
      }
      // bleeding
      for (let i = bleeders.length - 1; i >= 0; i--) {
        const b = bleeders[i]; b.left -= dt; if (b.left <= 0 || (b.a.dead && b.left < 1.5 && b.a.hp === undefined)) { bleeders.splice(i, 1); continue; }
        b.acc += b.rate * Math.min(1, b.left) * dt * gTier(); while (b.acc >= 1) { b.acc--; bstreak(b.a.x + rnd(-.26, .26), rnd(.55, 1.5), b.a.z + rnd(-.26, .26), rnd(-.3, .3), rnd(-.2, .6), rnd(-.3, .3), 1.1, rnd(.024, .04), null, .5); }
      }
      // the hero's blade: sheds drops in the swing's direction, drips when still
      const pl = game && game.player, tip = pl && pl.model && pl.model.weaponTip;
      if (tip && bladeBlood > .02 && !pl.dead && dt > 0) {
        tip.getWorldPosition(bladeP); if (bladeHave) {
          bladeV.copy(bladeP).sub(bladeQ).multiplyScalar(1 / dt); const sp = bladeV.length();
          if (sp > 5 && !calm) { const n = Math.min(6, Math.round(gn(bladeBlood * sp * .22 * dt * 60 * .2 + Math.random()))); for (let k = 0; k < n; k++) { bstreak(bladeP.x, bladeP.y, bladeP.z, bladeV.x * .4 + rnd(-1, 1), bladeV.y * .3 + rnd(0, 1.5), bladeV.z * .4 + rnd(-1, 1), .8, rnd(.022, .038), null, .4); bladeBlood -= .012; } }
          else { dripAcc += dt * bladeBlood * 3.2; while (dripAcc >= 1) { dripAcc--; bstreak(bladeP.x, bladeP.y, bladeP.z, rnd(-.1, .1), -.3, rnd(-.1, .1), 1.2, rnd(.025, .04), null, .7); bladeBlood -= .012; } }
        }
        bladeQ.copy(bladeP); bladeHave = true; bladeBlood = Math.max(0, bladeBlood - dt * .004);
      } else bladeHave = false;
      // streaks
      if (bsLive || bs.some(Boolean)) {
        const cam = B.app && B.app.camera; if (cam) cam.getWorldDirection(camDir); let live = 0, last = -1;
        for (let i = 0; i < GS; i++) {
          const s = bs[i], o = i * 12; if (!s) continue;
          s.t += dt; let dead = s.t >= s.life;
          if (!dead) {
            s.vy -= 10 * dt; const air = Math.exp(-dt * .5); s.vx *= air; s.vz *= air; const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt, nz = s.z + s.vz * dt, wb = ny < 6 ? wallBox(nz) : null;
            if (wb && ny < wb.top && (nx < wb.l || nx > wb.r)) {   // sticks to a wall
              const left = nx < wb.l; if (landBudget > 0 && Math.random() < s.stick && getSettings().decals > 0) { landBudget--; const big = s.w > .04; wallSplat(left ? wb.l : wb.r, Math.max(.2, ny), nz, left, (s.w * 3.6 + .07) * rnd(.9, 1.7), big && Math.random() < .55 ? rnd(.3, .9) : 0, !big); } dead = true;
            } else if (ny <= physicalFloorAt(nx,nz)+.045 && s.vy < 0) {   // lands: a splat (round when slow, elongated when fast), sometimes a hop of smaller drops
              if (landBudget > 0 && Math.random() < s.stick && getSettings().decals > 0) { landBudget--; const sp = Math.hypot(s.vx, s.vz), sz = (s.w * 3.4 + .05) * rnd(.8, 1.35);
                if (sp > 3.5) smear(nx - s.vx / sp * sz * 1.6 * .44 * 2, nz - s.vz / sp * sz * 1.6 * .44 * 2, Math.atan2(s.vx, s.vz), sz * 2.6, sz * .9, true); else splat(nx, nz, sz * 1.2, true); }
              if (!s.kid && s.w > .03 && Math.random() < .3) for (let k = 0; k < 2; k++) bstreak(nx, physicalFloorAt(nx,nz)+.06, nz, s.vx * .35 + rnd(-.8, .8), Math.abs(s.vy) * rnd(.15, .35), s.vz * .35 + rnd(-.8, .8), .5, s.w * .5, s.col, .25, true);
              dead = true;
            } else {
              s.x = nx; s.y = ny; s.z = nz;
              if (s.t > .08 && ny > .1) for (const A of gActors) if (ny < A.h && (A.e.x - nx) * (A.e.x - nx) + (A.e.z - nz) * (A.e.z - nz) < A.r * A.r) { if (Math.random() < .12) bleedAdd(A.e, .15); dead = true; break; }
            }
          }
          if (dead) { bs[i] = null; bsPos.fill(0, o, o + 12); bsCol.fill(0, i * 16, i * 16 + 16); continue; }
          const sp = Math.hypot(s.vx, s.vy, s.vz) || 1, len = clamp(sp * .018, s.w * 1.15, .35);
          qa.set(s.x, s.y, s.z); cv1.set(s.vx, s.vy, s.vz).multiplyScalar(1 / sp); qb.copy(qa).addScaledVector(cv1, -len);
          cv2.crossVectors(cv1, camDir); if (cv2.lengthSq() < 1e-6) cv2.set(1, 0, 0); cv2.normalize().multiplyScalar(s.w * .34);
          const a = Math.min(1, s.t * 40) * Math.min(1, (s.life - s.t) * 5) * .94;
          bsPos[o] = qb.x - cv2.x; bsPos[o + 1] = qb.y - cv2.y; bsPos[o + 2] = qb.z - cv2.z; bsPos[o + 3] = qb.x + cv2.x; bsPos[o + 4] = qb.y + cv2.y; bsPos[o + 5] = qb.z + cv2.z;
          bsPos[o + 6] = qa.x + cv2.x; bsPos[o + 7] = qa.y + cv2.y; bsPos[o + 8] = qa.z + cv2.z; bsPos[o + 9] = qa.x - cv2.x; bsPos[o + 10] = qa.y - cv2.y; bsPos[o + 11] = qa.z - cv2.z;
          for (let j = 0, c = i * 16, c0 = s.col[0], c1 = s.col[1], c2 = s.col[2]; j < 4; j++, c += 4) { bsCol[c] = c0; bsCol[c + 1] = c1; bsCol[c + 2] = c2; bsCol[c + 3] = a; }
          live++; last = i;
        }
        bsLive = live; bsGeo.setDrawRange(0, (last + 1) * 6);
        uploadPrefix(bsGeo.attributes.position, (last + 1) * 12); uploadPrefix(bsGeo.attributes.aCol, (last + 1) * 16); bsMesh.visible = live > 0;
      }
      // gibs
      if (gibs.length || gcMesh.count) {
        for (let i = gibs.length - 1; i >= 0; i--) {
          const g = gibs[i]; g.t += dt; const fade = g.rest ? clamp(1 - (g.t - g.restAt - 8) / 1.5, 0, 1) : 1; if (fade <= 0) { gibs.splice(i, 1); continue; }
          if (!g.rest) {
            g.vy -= 11 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; g.rx += g.wx * dt; g.ry += g.wy * dt; g.rz += g.wz * dt;
            const wb = wallBox(g.z); if (wb && g.y < wb.top) { if (g.x < wb.l) { g.x = wb.l; g.vx = Math.abs(g.vx) * .3; wallSplat(wb.l, Math.max(.3, g.y), g.z, true, g.size * 4, .5, false); } else if (g.x > wb.r) { g.x = wb.r; g.vx = -Math.abs(g.vx) * .3; wallSplat(wb.r, Math.max(.3, g.y), g.z, false, g.size * 4, .5, false); } }
            g.trail += dt; if (g.trail > .04 && Math.hypot(g.vx, g.vy, g.vz) > 2.5) { g.trail = 0; bstreak(g.x, g.y, g.z, g.vx * .25 + rnd(-.3, .3), g.vy * .2, g.vz * .25 + rnd(-.3, .3), .8, .028, null, .4, true); }
            const supportingFloor=physicalFloorAt(g.x,g.z);
            if (g.y < supportingFloor+g.size*.55) {
              g.y = supportingFloor+g.size*.55; const sp = Math.hypot(g.vx, g.vz);
              if (g.hit < 3 && landBudget > -8 && getSettings().decals > 0) { landBudget--; splat(g.x, g.z, g.size * (g.hit ? 3.2 : 5), true); if (!g.hit && sp > 1) smear(g.x, g.z, Math.atan2(g.vx, g.vz), g.size * 9 + sp * .12, g.size * 3.2, true); }
              g.hit++; if (g.vy < -1.2 && g.hit < 4) { g.vy = -g.vy * .28; g.vx *= .55; g.vz *= .55; g.wx *= .5; g.wy *= .5; g.wz *= .5; } else { g.vy = 0; g.vx *= Math.exp(-dt * 9); g.vz *= Math.exp(-dt * 9); g.wx = g.wy = g.wz = 0; if (Math.hypot(g.vx, g.vz) < .15) { g.rest = true; g.restAt = g.t; } }
            }
          }
          gcTmp.position.set(g.x, g.y, g.z); gcTmp.rotation.set(g.rx, g.ry, g.rz); const s = g.size * fade; gcTmp.scale.set(s * g.ax, s, s * g.az); gcTmp.updateMatrix(); gcMesh.setMatrixAt(i, gcTmp.matrix); gcMesh.setColorAt(i, gcCol.setRGB(g.col[0], g.col[1], g.col[2]));
        }
        gcMesh.count = gibs.length; gcMesh.visible = gibs.length > 0; uploadPrefix(gcMesh.instanceMatrix, gibs.length * 16); if (gcMesh.instanceColor) uploadPrefix(gcMesh.instanceColor, gibs.length * 3);
      }
      gdStep(dt);
    }
    function goreClear() {
      bs.fill(null); bsPos.fill(0); bsCol.fill(0); bsLive = 0; bsMesh.visible = false; bsGeo.attributes.position.needsUpdate = true; bsGeo.attributes.aCol.needsUpdate = true;
      gdPri.length = gdMic.length = gibs.length = spurts.length = bleeders.length = 0; gcMesh.count = 0; gcMesh.visible = false; gdMesh.count = 0; gdMesh.visible = false; feet = 0; bladeBlood = 0; bladeHave = false;
    }
    function wave(x, z, radius, color, life = .45, opacity = .45, width = .06) {
      // Rings are drawn as ash-broken heat through the floor (telegraphs.js), never as a flat vector ring.
      if (tells) { tells.wave(x, z, { radius, life, width: Math.max(.12, width * radius * .6), color: linear(color, opacity * 1.5), soft: 0 }); return; }
      const geo = new T.RingGeometry(1 - width, 1, 64), mat = new T.MeshBasicMaterial({ color, transparent: true, opacity, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending });
      const m = new T.Mesh(geo, mat); m.renderOrder = -1; m.rotation.x = -Math.PI / 2; m.position.set(x, .07, z); root.add(m); waves.push({ m, time: 0, radius, life, opacity });
    }
    function makeFlash() {
      const mat = new T.SpriteMaterial({ map: flashMap, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending });
      const m = new T.Sprite(mat); m.renderOrder = 30; m.visible = false; root.add(m);
      const f = { m, time: 0, life: 0, size: 0 }; flashPool.add(f); freeFlashes.push(f); return f;
    }
    function releaseFlash(f) {
      f.m.visible = false;
      // Keep a bounded reserve after unusually large simultaneous bursts, without capping live flashes.
      if (freeFlashes.length < 64) freeFlashes.push(f);
      else { flashPool.delete(f); f.m.removeFromParent(); f.m.material.dispose(); }
    }
    function flash(x, y, z, size, color, life = .09, rotation = Math.random() * Math.PI, map = flashMap) {
      if (!freeFlashes.length) makeFlash();
      const f = freeFlashes.pop(), m = f.m; f.time = 0; f.life = life; f.size = size;
      m.material.map = map; m.material.color.set(color); m.material.opacity = 1; m.material.rotation = rotation;
      m.position.set(x, y, z); m.scale.setScalar(size); m.visible = true; flashes.push(f);
    }
    const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    function makeLabel() {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 144;
      const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
      const m = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false }));
      m.renderOrder = 20; m.visible = false; root.add(m);
      const l = { m, canvas, time: 0, vx: 0, bw: 0, bh: 0, x0: 0, z0: 0, side: 0, life: .9, target: null, value: 0, player: false, heavy: false, kill: false, boss: false };
      labelPool.push(l); freeLabels.push(l); return l;
    }
    function releaseLabel(l) { l.m.visible = false; l.target = null; freeLabels.push(l); }
    function number(value, x, y, z, player, heavy, kill, boss, target = null) {
      if (!Number.isFinite(value) || value <= 0) return;
      // Very fast hits on the same actor show their real sum once; separate actors are never guessed from proximity.
      const merged = target ? labels.find(o => o.target === target && o.player === !!player && o.time < .12 && !o.kill) : null;
      if (merged) { value += merged.value; heavy = heavy || merged.heavy; kill = kill || merged.kill; boss = boss || merged.boss; }
      let lift = merged ? merged.lift : 0, side = merged ? merged.offset : 0;
      // Eighteen live labels was already the limit; reuse the oldest sprite instead of replacing its GPU resources.
      if (!merged && !freeLabels.length) { if (labelPool.length < 18) makeLabel(); else releaseLabel(labels.shift()); }
      const l = merged || freeLabels.pop(), m = l.m;
      // Engraved numerals come from the HUD (src/hud.js); the plain fallback keeps effects.js standalone.
      const c = B.HUD && B.HUD.damageCanvas ? B.HUD.damageCanvas(value, player, heavy, l.canvas) : (() => {
        const c = l.canvas; c.width = 128; c.height = 72; const ctx = c.getContext('2d');
        ctx.font = (heavy ? '800 47px' : '700 40px') + ' "Source Sans 3", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = '#170b0c'; ctx.strokeText(String(value), 64, 36);
        ctx.fillStyle = player ? '#e58c78' : heavy ? '#e9bd78' : '#dad2c2'; ctx.fillText(String(value), 64, 36); return c; })();
      m.material.map.image = c; m.material.map.needsUpdate = true; m.material.opacity = 1; m.material.color.setRGB(1, 1, 1);
      // Bigger numbers for bigger blows, a hot tint on the killing blow, and a nudge so numbers from a flurry do not stack on each other.
      const k = player ? 1 : clamp(.82 + value / 130, .82, 1.3) * (kill ? 1.18 : 1) * (boss ? 1.08 : 1), bw = (heavy ? 1.45 : 1.2) * k, bh = (heavy ? .82 : .68) * k;
      if (kill && !player) m.material.color.setRGB(1.5, 1.12, .75); else if (heavy && !player) m.material.color.setRGB(1.2, 1.08, .9);
      if (!merged) {
        for (const o of labels) if (o.time < .5 && Math.abs(o.x0 - x) < 1.1 && Math.abs(o.z0 - z) < 1.1) {
          lift = Math.max(lift, o.m.position.y - y + (o.bh + bh) * .6); side += o.side > 0 ? -.16 : .16;
        }
      }
      m.position.set(x + side, y + lift, z); m.scale.set(bw, bh, 1); m.visible = true;
      l.time = 0; l.vx = reduced.matches ? 0 : rnd(-.25, .25) + side * .3; l.bw = bw; l.bh = bh; l.x0 = x; l.z0 = z;
      l.side = side || (Math.random() < .5 ? 1 : -1); l.life = kill ? 1.1 : .9; l.lift = lift; l.offset = side;
      l.target = target; l.value = value; l.player = !!player; l.heavy = !!heavy; l.kill = !!kill; l.boss = !!boss;
      if (!merged) labels.push(l);
    }
    // ------------------------------------------------------------ "Kor ve Kül" tells (src/telegraphs.js; optional)
    const tells = B.Telegraphs ? B.Telegraphs.create(root, getGame, getSettings, { emit, fragments, sound: (n, o) => { if (B.Audio && B.Audio.play) B.Audio.play(n, o); } }) : null;
    const tmpColor = new T.Color();
    function linear(hex, k) { tmpColor.set(hex); return [tmpColor.r * k, tmpColor.g * k, tmpColor.b * k]; }
    // Cracks left in the floor by quakes, falling hooks and heavy overheads: a hot glow that cools into a dark scar.
    // Scars are pooled: the two materials and the group are made once and reused, so combat never creates or disposes
    // GPU resources for them (disposing the last user of a program would make the next scar recompile it).
    const scars = [], scarFree = [];
    function makeScar(map) {
      const dark = new T.MeshBasicMaterial({ color: '#1a0d0a', map, transparent: true, opacity: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const hot = new T.MeshBasicMaterial({ color: new T.Color(.85, .36, .13), map, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const group = new T.Group(), a = new T.Mesh(plane, dark), b = new T.Mesh(plane, hot);
      for (const m of [a, b]) { m.rotation.x = -Math.PI / 2; m.renderOrder = -1; group.add(m); }
      return { group, a, b, dark, hot, time: 0, life: 0 };
    }
    function releaseScar(s) { s.group.removeFromParent(); scarFree.push(s); }
    function scar(x, z, face, o) {
      if (!tells || getSettings().decals <= 0) return;
      const line = o.shape === 'line', map = line ? tells.textures.scarLine : tells.textures.scarRadial, hotMap=line?tells.textures.scarLineHot:tells.textures.scarRadialHot;
      const e = scarFree.length ? scarFree.pop() : makeScar(map), { group, a, b, dark, hot } = e, heat = o.heat || 1;
      dark.map=map;hot.map=hotMap||map;dark.opacity=.72;hot.opacity=1;hot.color.setRGB(.85*heat,.36*heat,.13*heat);
      // The line art runs bottom -> top of the canvas; after rotation.x the canvas top points to local -Z, so flip it along +Z.
      a.rotation.z = b.rotation.z = line ? Math.PI : 0;
      if (line) { group.scale.set(o.width * 2.2, 1, o.length); group.rotation.y = face; group.position.set(x + Math.sin(face) * o.length / 2, floorAt(x, z, o.length) + .008, z + Math.cos(face) * o.length / 2); }
      else { const s = (o.radius || 1.5) * 1.9; group.scale.set(s, 1, s); group.rotation.y = Math.random() * 6; group.position.set(x, floorAt(x, z, o.radius || 1.5) + .008, z); }
      e.time = 0; e.life = o.life || 0; root.add(group); scars.push(e);
      const limit = Math.max(6, Math.min(40, Math.round((getSettings().decals || 90) / 4)));
      while (scars.length > limit) releaseScar(scars.shift());
    }
    function scarsStep(dt) {
      for (let i = scars.length - 1; i >= 0; i--) {
        const s = scars[i], sl = s.life || 8, f0 = s.life ? sl * .35 : 6; s.time += dt; s.hot.opacity = Math.pow(Math.max(0, 1 - s.time / (s.life ? Math.min(1.3, sl * .6) : 1.3)), 2); s.dark.opacity = .72 * Math.min(1, s.time / .1) * Math.max(0, 1 - Math.max(0, s.time - f0) / (sl - f0));
        if (s.time > sl) { releaseScar(s); scars.splice(i, 1); }
      }
    }
    // Enemy blows land: matter, not rings. Sparks along a blade's arc, dust kicked by blunt weight, motes rising
    // from a burnt rune, chips and a glowing crack from a quake, a green splash of bile.
    function strike(d) {
      const x = d.x, z = d.z, f = d.face || 0, style = d.style || 'blade', unb = !!d.unblockable, big = !!d.heavy || !!d.boss;
      const sp = unb ? [3.0, .55, .3] : SPARK, n = k => scaleCount(k * (big ? 1.4 : 1));
      const polar = (a, r) => ({ x: x + Math.sin(f + a) * r, z: z + Math.cos(f + a) * r });
      const local = (side, fwd) => ({ x: x + Math.cos(f) * side + Math.sin(f) * fwd, z: z - Math.sin(f) * side + Math.cos(f) * fwd });
      const R = d.radius || 2, arc = d.shape === 'ring' ? (d.arc || Math.PI * 2) : d.arc || Math.PI, dir = d.sweepDir || 1;
      if (style === 'tide') {
        const inner=d.inner||0,m=n(30);
        // Kara Kıyı supplies a shaped water surface; mist must follow the same hit footprint.
        if(tells && !(B.app && B.app.world.chapter===2))tells.wave(x,z,{radius:R,life:.52,width:Math.min(1.4,R-inner),color:[.12,.34,.36],soft:.5});
        for(let i=0;i<m;i++){const a=i/m*Math.PI*2,r=inner+(R-inner)*(.3+Math.random()*.5),p=d.shape==='line'?local((Math.random()-.5)*d.width,d.length*Math.random()):polar(a,r);particle(p.x,.14,p.z,2,[.13,.24,.24],1.0,d.shape==='line'?f:a,.55);}
        return;
      }
      if (style === 'root') {
        for(let i=0;i<n(22);i++){const p=d.shape==='line'?local((Math.random()-.5)*d.width,d.length*Math.random()):polar(Math.random()*Math.PI*2,(d.inner||0)+(R-(d.inner||0))*Math.random());particle(p.x,.12,p.z,0,[.14,.10,.055],1,Math.random()*6,1.4);particle(p.x,.07,p.z,2,[.10,.085,.065],.7,Math.random()*6,.5);}
        return;
      }
      if (d.poison || style === 'bile') {
        if (d.burst) { if (tells) tells.wave(x, z, { radius: R + .4, life: .5, width: .6, color: [.45, .9, .15], soft: .6 }); flash(x, .6, z, 2.6, new T.Color('#d8ff9a'), .1); }
        const cx = d.shape === 'cone' ? d.ix : x, cz = d.shape === 'cone' ? d.iz : z;
        for (let i = 0; i < n(d.burst ? 60 : 24); i++) particle(cx, .25, cz, 2, [.07, .14, .02], d.burst ? 1.6 : .9, Math.random() * Math.PI * 2);
        for (let i = 0; i < n(14); i++) particle(cx, .3, cz, 3, [.35, .6, .08], .6, Math.random() * Math.PI * 2, .6);
        if (d.shape === 'cone') for (let i = 0; i < n(18); i++) { const p = polar((Math.random() - .5) * arc, R * Math.random()); particle(p.x, .1, p.z, 0, [.06, .12, .02], .5, Math.random() * 6, .4); }
        return;
      }
      if (style === 'blade' || style === 'grab') {
        if (d.shape === 'line') {
          for (let i = 0; i < n(10); i++) { const p = local((Math.random() - .5) * d.width, Math.random() * d.length); particle(p.x, .1, p.z, 2, DUST, .5, Math.random() * 6, .3); }
          const e = local(0, d.length * .9); for (let i = 0; i < n(16); i++) particle(e.x, .15, e.z, 1, sp, 1.2, f + (Math.random() - .5) * 2, .7);
          if (d.scar) scar(x, z, f, d);
          return;
        }
        const m = n(16);
        for (let i = 0; i < m; i++) { const t = i / Math.max(1, m - 1), a = (t - .5) * arc * dir, p = polar(a, R * (.8 + Math.random() * .2)); particle(p.x, .2 + Math.random() * .5, p.z, 1, sp, .9, f + a + dir * Math.PI / 2, .5); }
        for (let i = 0; i < n(8); i++) { const p = polar((Math.random() - .5) * arc, R * (.4 + Math.random() * .6)); particle(p.x, .06, p.z, 2, DUST, .4, Math.random() * 6, .25); }
        return;
      }
      if (style === 'thrust' || (style === 'chain' && d.shape === 'line')) {
        const lineDust = n(8); for (let i = 0; i < lineDust; i++) { const p = local((Math.random() - .5) * d.width, d.length * (i + .5) / lineDust); particle(p.x, .08, p.z, 2, DUST, .6, Math.random() * 6, .35); }
        const e = local(0, d.length); for (let i = 0; i < n(12); i++) particle(e.x, .2, e.z, 1, sp, 1.1, f + (Math.random() - .5) * 2.4, .7);
        return;
      }
      if (style === 'chain') {
        const inner = d.inner || 0, m = n(22);
        for (let i = 0; i < m; i++) { const a = (i / m - .5) * arc, p = polar(a, (inner + R) / 2 + (Math.random() - .5) * (R - inner) * .6); particle(p.x, .1, p.z, 2, DUST, .7, f + a, .35); if (i % 3 === 0) particle(p.x, .3, p.z, 1, sp, 1, f + a + Math.PI / 2 * dir, .6); }
        return;
      }
      if (style === 'blunt' || style === 'roar') {
        const cx = d.shape === 'circle' ? x : d.ix, cz = d.shape === 'circle' ? z : d.iz;
        if (style === 'blunt' && Number.isFinite(cx) && Number.isFinite(cz)) fragments(cx, floorAt(cx, cz, .3) + .1, cz, { count: big ? 16 : 8, spread: .6, speed: big ? 4.2 : 2.6, lift: big ? 4.5 : 2.8, face: f, arc: 2.7 });
        for (let i = 0; i < n(20); i++) particle(cx + rnd(-.4, .4), .1, cz + rnd(-.4, .4), 2, DUST, 1, Math.random() * Math.PI * 2, .4);
        if (style === 'roar' && tells) { tells.wave(x, z, { radius: R, life: .5, width: .35, color: [.55, .3, .15], soft: 0 }); const ringDust = n(30); for (let i = 0; i < ringDust; i++) { const a = i / ringDust * Math.PI * 2; particle(x + Math.sin(a) * 1.2, .1, z + Math.cos(a) * 1.2, 2, DUST, 1.6, a, .35); } }
        return;
      }
      if (style === 'quake') {
        const line = d.shape === 'line', c = line ? local(0, d.length * .5) : { x, z };
        for (let i = 0; i < n(line ? 20 : 40); i++) { const p = line ? local((Math.random() - .5) * d.width, Math.random() * d.length) : { x: x + rnd(-R, R) * .6, z: z + rnd(-R, R) * .6 }; particle(p.x, .1, p.z, 2, DUST, 1.2, Math.random() * 6, .5); }
        fragments(c.x, floorAt(c.x, c.z, .3) + .12, c.z, { count: big ? 26 : 15, spread: Math.min(1.5, R * .3), speed: big ? 6 : 4, lift: big ? 6 : 4.3 });
        for (let i = 0; i < n(line ? 10 : 20); i++) particle(c.x, .15, c.z, 0, [.06, .05, .045], 1.4, Math.random() * Math.PI * 2, 1.1);
        for (let i = 0; i < n(12); i++) particle(c.x, .2, c.z, 1, sp, 1.2, Math.random() * Math.PI * 2, .8);
        if (!line) { flash(x, .4, z, 1.35, new T.Color(unb ? '#da8266' : '#c7a57b'), .09); if (tells && d.pressureEcho !== false) tells.wave(x, z, { radius: R + .35, life: .45, width: .085, color: [.65, .26, .12], soft: .12 }); }
        if (d.scar !== false) scar(x, z, f, d);
        return;
      }
      if (style === 'rune') {
        const line = d.shape === 'line';
        for (let i = 0; i < n(24); i++) { const p = line ? local((Math.random() - .5) * d.width, Math.random() * d.length) : { x: x + Math.sin(i * 2.4) * R * .8 * Math.random(), z: z + Math.cos(i * 2.4) * R * .8 * Math.random() }; emit(p.x, .1, p.z, 4, unb ? [2.2, .3, .12] : [2.2, 1, .3], rnd(-.2, .2), .9 + Math.random() * .9, rnd(-.2, .2), .7 + Math.random() * .4, .06); }
        if (tells && !line) tells.glowBurst(x, z, { radius: R, life: .45, color: unb ? [1.6, .15, .08] : [1.4, .7, .25], peak: .5 });
        return;
      }
      if (style === 'ember') {
        for (let i = 0; i < n(14); i++) particle(x, .15, z, 1, [3.6, 1.6, .4], .9, Math.random() * Math.PI * 2, .9);
        for (let i = 0; i < n(8); i++) particle(x + rnd(-.5, .5), .08, z + rnd(-.5, .5), 2, [.09, .07, .06], .6, Math.random() * 6, .3);
        if (tells) tells.glowBurst(x, z, { radius: R, life: .35, color: [1.8, .7, .2], peak: .6 });
        return;
      }
      if (style === 'fall') {
        for (let i = 0; i < n(18); i++) particle(x + rnd(-.3, .3), .1, z + rnd(-.3, .3), 2, DUST, 1.1, Math.random() * 6, .45);
        for (let i = 0; i < n(10); i++) particle(x, .25, z, 1, sp, 1.2, Math.random() * Math.PI * 2, .9);
        scar(x, z, f, { shape: 'circle', radius: R * .8 });
        return;
      }
      if (style === 'shadow') { for (let i = 0; i < n(22); i++) { const a = Math.random() * Math.PI * 2; particle(x + Math.sin(a) * R * .5, .1, z + Math.cos(a) * R * .5, 2, [.03, .025, .03], 1.1, a, .3); } }
    }
    // The war cry: breath drawn in, then the roar goes out through the floor.
    function warCryGather(d) {
      const x=d.x,z=d.z,gather=d.life>0?d.life:.3;
      for(let i=0;i<scaleCount(14);i++){
        const a=Math.random()*Math.PI*2,r=.8+Math.random()*1.0,px=x+Math.sin(a)*r,pz=z+Math.cos(a)*r,y=.1+Math.random()*.6;
        emit(px,y,pz,5,i%4?[.06,.05,.04]:[.65,.26,.09],(x-px)/gather*.65,(.8-y)/gather*.35,(z-pz)/gather*.65,gather,i%4?.12:.035);
      }
      if(tells)tells.glowBurst(x,z,{radius:1.0,life:gather+.08,color:[.52,.23,.08],peak:.065});
    }
    function warCry(d) {
      const game=getGame(),x=d.x,z=d.z,R=d.radius||5.2,calm=reduced.matches,V=R*.6;
      // The first cry is a pressure pulse through grit, not a white-hot spell disc.
      // Gameplay near/far ranges remain owned by combat; this is only the visual echo.
      if(tells){
        tells.wave(x,z,{radius:V+.25,life:.50,width:.045,color:[.48,.32,.18],crack:.16,crackR:R*.22,crackLife:.9,soft:.12});
        tells.glowBurst(x,z,{radius:1.5,life:.42,color:[.55,.23,.08],peak:.06});
      }
      scar(x,z,0,{shape:'circle',radius:1.15,life:1.15,heat:.16});
      fragments(x,floorAt(x,z,.3)+.07,z,{count:calm?4:8,spread:.8,speed:1.7,lift:1.5,size:.065});
      flash(x,1.1,z,.72,new T.Color('#b78556'),.07,0,softMap);
      if(impactFx)impactFx.dome(x,z,{r:V*1.05,h:1.5,life:.5,col:[.55,.3,.14],hot:[1.2,.8,.5],a:.42,style:0});   // a low wall of heat and grit carries the cry outward
      const ringDust=scaleCount(14);for(let i=0;i<ringDust;i++){const a=i/ringDust*Math.PI*2;particle(x+Math.sin(a)*.8,.08,z+Math.cos(a)*.8,2,DUST,1.2,a,.20);}
      for(let i=0;i<(calm?4:scaleCount(12));i++){const a=Math.random()*Math.PI*2;streak(x+Math.sin(a)*.8,.12+Math.random()*.15,z+Math.cos(a)*.8,Math.sin(a)*(2.3+Math.random()*1.5),.45+Math.random()*.7,Math.cos(a)*(2.3+Math.random()*1.5),.22+Math.random()*.15,.028,[.85,.40,.13]);}
      roarSpiral.on=!calm;roarSpiral.t=0;roarSpiral.x=x;roarSpiral.z=z;roarSpiral.R=Math.min(2.3,V*.6);
      if(game)for(const e of game.enemies)if(!e.dead&&e.fear>1&&e.model.root.visible)for(let i=0;i<scaleCount(4);i++)emit(e.x+rnd(-.25,.25),1.0+Math.random()*.5,e.z+rnd(-.25,.25),2,[.035,.03,.025],rnd(-.2,.2),.45,rnd(-.2,.2),.6,.16);
    }
    // Brief low ember eddies dissipate around the planted feet after the cry.
    const roarSpiral={on:false,t:0,x:0,z:0,R:2};
    function roarSpiralStep(dt){
      if(!roarSpiral.on||dt<=0)return;const rs=roarSpiral,bud=clamp(budget()/1100,.3,1),D=.48;
      const steps=Math.max(1,Math.ceil(dt/(1/60)));
      for(let k=0;k<steps;k++){
        const t=rs.t+dt*(k+.5)/steps;if(t>D)break;
        for(let arm=0;arm<2;arm++){if(Math.random()>bud)continue;const a=t*5+arm*Math.PI,r=.6+(t/D)*rs.R,y=.08+t*.55;
          emit(rs.x+Math.sin(a)*r,y,rs.z+Math.cos(a)*r,4,[.75,.28,.09],Math.cos(a)*.8,.35,-Math.sin(a)*.8,.25+Math.random()*.15,.025);
        }
      }
      rs.t+=dt;if(rs.t>D)rs.on=false;
    }
    function warCryWave(d){
      const x=d.x,z=d.z,V=(d.radius||6)*.6,calm=reduced.matches,n=d.n||1;
      if(tells)tells.wave(x,z,{radius:V+.25,life:.5,width:.045,color:n%2?[.30,.21,.36]:[.45,.27,.12],crack:n===1?.14:0,crackR:V*.4,crackLife:.8,soft:.12});
      for(let i=0;i<(calm?3:scaleCount(8));i++){const a=Math.random()*Math.PI*2;streak(x+Math.sin(a)*V*.7,.15,z+Math.cos(a)*V*.7,Math.sin(a)*1.5,.6+Math.random()*.8,Math.cos(a)*1.5,.25,.025,[.50,.32,.40]);}
      const ringDust=scaleCount(12);for(let i=0;i<ringDust;i++){const a=i/ringDust*Math.PI*2;particle(x+Math.sin(a)*V*.6,.08,z+Math.cos(a)*V*.6,2,DUST,1.2,a,.2);}
    }
    // Tier accents of the heavy-strike line: the base blow keeps its crescent; Kemik Kıran adds a gold seal burst, Kabir Balyozu a cold-white flame fan.
    function skillAccent(d) {
      const tier = d.tier || 1, x = d.x, z = d.z, face = d.face || 0, R = d.radius || 3.2, calm = reduced.matches, sx = Math.sin(face), sz = Math.cos(face);
      if (d.line !== 'cleave' || tier < 2) return;
      if (tier === 2) {
        if (tells) { tells.glowBurst(x, z, { radius: R * 1.1, life: .6, color: [2.6, 1.7, .5], peak: .4 }); tells.wave(x, z, { radius: R * 1.2, life: .5, width: .18, color: [2.4, 1.6, .5], crack: .7, crackR: R * .9, crackLife: 1.2, soft: 0, delay: .05 }); }
        for (let i = 0; i < (calm ? 4 : scaleCount(26)); i++) { const a = Math.random() * Math.PI * 2, r = R * Math.random(); emit(x + Math.sin(a) * r, .1, z + Math.cos(a) * r, 4, [3.2, 2.0, .6], Math.sin(a) * .8, 2 + Math.random() * 3, Math.cos(a) * .8, .6 + Math.random() * .5, .05); }
        return;
      }
      // tier 3: a fan of cold-white embers thrown along the cone, a pale shock front and a long scorch
      if (tells) { tells.wave(x, z, { radius: R * .62, life: .5, width: .22, color: [1.6, 1.0, 2.6], soft: 0, crack: .6, crackR: R * .5, crackLife: 1.4 }); tells.glowBurst(x + sx * 3, z + sz * 3, { radius: 3.4, life: .7, color: [1.8, 1.0, 2.4], peak: .35 }); }
      for (let i = 0; i < (calm ? 6 : scaleCount(46)); i++) {
        const a = face + (Math.random() - .5) * (d.arc || 2.5), r = R * (.25 + Math.random() * .75);
        emit(x + Math.sin(a) * r * .5, .2 + Math.random() * .7, z + Math.cos(a) * r * .5, 4, Math.random() < .4 ? [2.2, 1.4, 3.0] : [3.4, 1.4, .4], Math.sin(a) * r * 1.4, .8 + Math.random() * 1.6, Math.cos(a) * r * 1.4, .5 + Math.random() * .4, .06);
      }
      scar(x + sx * 3, z + sz * 3, face, { shape: 'circle', radius: R * .5, heat: .4 });
    }
    function rageEnd(d) {
      const x = d.x, z = d.z;
      // The fire goes out of him: a gust of grey ash off the whole body, last embers sinking, a dull ring on the floor.
      for (let i = 0; i < scaleCount(40); i++) emit(x + rnd(-.4, .4), .2 + Math.random() * 1.9, z + rnd(-.4, .4), 2, [.07, .06, .055], rnd(-.5, .5), .5 + Math.random() * .5, rnd(-.5, .5), 1.4, .34);
      for (let i = 0; i < scaleCount(26); i++) emit(x + rnd(-.45, .45), .4 + Math.random() * 1.5, z + rnd(-.45, .45), 4, [1.2, .28, .08], rnd(-.5, .5), -.2 - Math.random() * .4, rnd(-.5, .5), 1.0, .04);
      if (tells) { tells.glowBurst(x, z, { radius: 2.2, life: .8, color: [.7, .12, .05], peak: .35 }); tells.wave(x, z, { radius: 2.6, life: .7, width: .5, color: [.5, .1, .05], soft: 0 }); }
    }
    // ------------------------------------------------------------ Zincir Girdabı: the whirlwind (F)
    // Two iron chains with cleaver hooks orbit the father at hip height. Links sit at a fixed pitch along a swept-back arc (hand -> orbit) so there is never a gap,
    // a smooth additive motion-blur disc follows the heads, a swirl of light turns on the floor, embers are shed by distance travelled (not per frame), and every
    // tick / hit adds a smooth ring, velocity-stretched spark streaks and dust. The orbit is driven from the hero's real body yaw, so it is always in step with him.
    const CH_PITCH = .21, CH_ARM = 28, CH_MAX = CH_ARM * 2, CH_PTS = 40;
    // Whirl look per tier (whirl* prefix): I ember orange chains, II molten gold reaping scythes with a sweeping ground trail, III dark violet / black-red storm with bone-white flashes.
    const WT = [null,
      { emis: [1, .32, .07], metal:'#5b554b', glow: [.9, .36, .11], ember: [[2.8, .8, .2], [2.2, .4, .1]], d1: [2.2, .55, .14], d2: [1.9, 1.1, .55], floor: [1, .3, .08], ring: [.7, .22, .06], ringLast: [1, .34, .1], flash: '#ff9550', hit: '#ffb070', head: [1, 1, 1], tail: 1, cres: 0, lag: 1.3, hot: [3.0, 1.1, .3] },
      { emis: [1, .62, .12], metal:'#756952', glow: [1, .72, .2], ember: [[4, 2.5, .5], [3.2, 1.5, .25]], d1: [3.3, 1.9, .4], d2: [2.6, 2.0, 1], floor: [1, .62, .14], ring: [.95, .58, .17], ringLast: [1.6, 1.0, .32], flash: '#ffd080', hit: '#ffd890', head: [1.45,1.05,1.15], tail: .85, cres: 1, lag: 2.3, hot: [4.2, 2.6, .6] },
      { emis: [.25, .07, .3], metal:'#514b58', glow: [.36, .12, .42], ember: [[.9, .24, 1.1], [1, .1, .18]], d1: [.4, .12, .62], d2: [.65, .45, .72], floor: [.3, .08, .4], ring: [.24, .075, .34], ringLast: [.45, .22, .6], flash: '#d8c8ff', hit: '#d0c0ff', head: [1.65,1.15,1.3], tail: .75, cres: 1.4, lag: 2.9, hot: [1.2, .4, 1.3] }];
    const softMap = canvasTexture(128, (ctx, s) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); });
    const whirlMetal=B.EquipmentArt?B.EquipmentArt.material('steel').clone():new T.MeshStandardMaterial({color:'#5b554b',metalness:.85,roughness:.68});
    whirlMetal.emissive.setRGB(.4,.1,.025);whirlMetal.emissiveIntensity=0;whirlMetal.roughness=Math.max(.68,whirlMetal.roughness);
    const chLinks = new T.InstancedMesh(new T.TorusGeometry(.085,.026,10,20),whirlMetal,CH_MAX);
    chLinks.name='whirl_forged_links';chLinks.receiveShadow=true;chLinks.frustumCulled = false; chLinks.visible = false; chLinks.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(chLinks);
    // Forged cleaver hooks: a curved cutting edge, a hollow chain eye and bevels that catch the room light.
    // One shared geometry replaces the placeholder cones; both heads retain their existing two draws.
    const hookShape = new T.Shape(); hookShape.moveTo(-.24, .08); hookShape.lineTo(.06, .11);
    hookShape.quadraticCurveTo(.39, .17, .48, -.10); hookShape.quadraticCurveTo(.57, -.42, .18, -.47);
    hookShape.lineTo(.26, -.33); hookShape.quadraticCurveTo(.34, -.25, .30, -.15); hookShape.quadraticCurveTo(.24, -.035, .06, -.055);
    hookShape.lineTo(-.24, -.065); hookShape.closePath();
    const hookEye = new T.Path(); hookEye.absarc(-.135, .0075, .036, 0, Math.PI * 2, true); hookShape.holes.push(hookEye);
    const chHeadGeo = new T.ExtrudeGeometry(hookShape, { depth: .048, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .012, bevelThickness: .012, curveSegments: 6 }).translate(0, 0, -.024).rotateX(Math.PI / 2);
    const chHeads = [0, 1].map(() => { const m = new T.Mesh(chHeadGeo, chLinks.material); m.receiveShadow=true;m.frustumCulled=false;m.visible=false;root.add(m);return m;});
    const chGlow = [0, 1, 2].map(() => { const sp = new T.Sprite(new T.SpriteMaterial({ map: softMap, color: 0xffffff, transparent: true, depthWrite: false, depthTest:true,blending:T.AdditiveBlending,fog:false}));sp.renderOrder=8; sp.visible = false; root.add(sp); return sp; });
    // motion-blur disc at chest height: two comet tails (one per chain) that lengthen with the turning speed
    const chDiscMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false, uniforms: { uHead: { value: 0 }, uP: { value: 0 }, uRate: { value: 0 }, uR: { value: 4 }, uT: { value: 0 }, uTail: { value: 1 }, uC1: { value: new T.Vector3(2.2, .55, .14) }, uC2: { value: new T.Vector3(1.9, 1.1, .55) } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform float uHead,uP,uRate,uR,uT,uTail;uniform vec3 uC1,uC2;void main(){vec2 q=(vUv-.5)*2.;float r=length(q)*uR;float a=atan(q.x,q.y);float rad=smoothstep(1.3,2.1,r)*(1.-smoothstep(3.0,3.9,r));float d=mod(uHead-a,3.14159265);float tail=exp(-d*(6.5-2.6*uRate)*uTail);float fine=.88+.12*sin(d*31.+r*6.-uT*22.);float edge=exp(-pow((r-3.25+d*.13)/.10,2.));float k=(rad*.62+edge*.48)*tail*fine*uP*smoothstep(0.,.07,d);if(k<.004)discard;vec3 col=mix(uC1,uC2,max(tail*tail*tail,edge*.65));gl_FragColor=vec4(col*k*.24,1.);}' });
    const chDisc = new T.Mesh(new T.RingGeometry(1.2, 4, 64, 1).rotateX(-Math.PI / 2), chDiscMat); chDisc.frustumCulled = false; chDisc.renderOrder = 7; chDisc.visible = false; root.add(chDisc);
    // floor swirl: spiral arms of light that turn with the spin, plus a hot rim at the reach of the blow
    const chFloorMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, uniforms: { uP: { value: 0 }, uT: { value: 0 }, uRim: { value: 3.6 }, uR: { value: 4.5 }, uHead: { value: 0 }, uCres: { value: 0 }, uCol: { value: new T.Vector3(1, .3, .08) } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform float uP,uT,uRim,uR,uHead,uCres;uniform vec3 uCol;void main(){vec2 q=(vUv-.5)*2.;float r=length(q)*uR;float a=atan(q.x,q.y);float ph=.5+.5*sin(a*3.+r*1.7-uT*9.);ph=ph*ph*ph;float m=smoothstep(.5,1.5,r)*(1.-smoothstep(uRim-.5,uRim+.7,r));float rw=(r-uRim)/.16;float rim=exp(-rw*rw);float dh=mod(uHead-a,3.14159265);float wedge=exp(-dh*4.)*smoothstep(uRim*.35,uRim*.92,r)*(1.-smoothstep(uRim,uRim+.35,r))*smoothstep(0.,.05,dh);float lead=exp(-dh*9.)*exp(-pow((r-uRim*.97)/.28,2.))*smoothstep(0.,.03,dh);float k=(ph*m*(.07+.05*uCres)+rim*(.12+.1*uCres)+uCres*(wedge*.09+lead*.55))*uP;if(k<.004)discard;gl_FragColor=vec4(uCol*k,1.);}' });
    const chFloor = new T.Mesh(new T.RingGeometry(.4, 4.5, 64, 1).rotateX(-Math.PI / 2), chFloorMat); chFloor.frustumCulled = false; chFloor.renderOrder = 1; chFloor.visible = false; root.add(chFloor);
    // smooth shock rings (pool of 4): a bright edge and a faint hot disc, analytic (no noise, no texture seams)
    const chRings = [0, 1, 2, 3].map(() => {
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, uniforms: { uK: { value: 1 }, uHalf: { value: 3 }, uMax: { value: 3 }, uCol: { value: new T.Vector3(1, .3, .09) } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec2 vUv;uniform float uK,uHalf,uMax;uniform vec3 uCol;void main(){float rw=length(vUv-.5)*2.*uHalf;float e=(1.-pow(1.-uK,2.6))*uMax;float a0=atan(vUv.x-.5,vUv.y-.5);float w=.045+.06*e/uMax;float x=(rw-e-.04*sin(a0*13.)-.025*sin(a0*29.))/w;float ring=exp(-x*x*1.8)*(.67+.33*sin(a0*17.+.8));float wake=clamp(1.-(e-rw)/(w*3.5),0.,1.);wake=wake*wake*step(rw,e)*.18;float edge=1.-smoothstep(.93*uMax,uMax,rw);float a=(ring+wake)*(1.-uK)*edge;if(a<.004)discard;gl_FragColor=vec4(uCol*a*.22,1.);}' });
      const m = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat); m.frustumCulled = false; m.renderOrder = 2; m.visible = false; root.add(m); return { m, mat, t: 9, life: .5, r: 1 };
    });
    // The ring quad only grows as far as the ring has travelled (plus its width), so young rings cost almost no fill.
    function chRing(x, z, r, life, col) { const o = chRings.find(q => q.t >= q.life) || chRings[0]; o.t = 0; o.life = life; o.r = r; o.m.position.set(x, floorAt(x, z, r) + .02, z); o.mat.uniforms.uCol.value.set(col[0], col[1], col[2]); o.mat.uniforms.uMax.value = r; o.m.visible = true; ringSize(o, 0); }
    function ringSize(o, k) { const e = (1 - Math.pow(1 - k, 2.6)) * o.r, half = Math.min(o.r, e + 1.3 + .3 * e / o.r * 3); o.m.scale.set(half * 2, 1, half * 2); o.mat.uniforms.uHalf.value = half; }
    function advRing(r, dt) { r.t += dt; const k = clamp(r.t / r.life, 0, 1); r.mat.uniforms.uK.value = k; ringSize(r, k); if (r.t >= r.life) r.m.visible = false; }
    // velocity-stretched spark streaks: one camera-facing quad per spark, hot head, tapering tail (one draw call)
    const SK = 128, skPos = new Float32Array(SK * 4 * 3), skUv = new Float32Array(SK * 4 * 2), skCol = new Float32Array(SK * 4 * 4), skIdx = [], sk = new Array(SK).fill(null);
    for (let i = 0; i < SK; i++) { skUv.set([0, 0, 0, 1, 1, 1, 1, 0], i * 8); skIdx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
    const skGeo = new T.BufferGeometry(); skGeo.setIndex(skIdx); skGeo.setAttribute('position', new T.BufferAttribute(skPos, 3).setUsage(T.DynamicDrawUsage)); skGeo.setAttribute('uv', new T.BufferAttribute(skUv, 2)); skGeo.setAttribute('aCol', new T.BufferAttribute(skCol, 4).setUsage(T.DynamicDrawUsage));
    const skMesh = new T.Mesh(skGeo, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      vertexShader: 'attribute vec4 aCol;varying vec2 vUv;varying vec4 c;void main(){vUv=uv;c=aCol;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;varying vec4 c;void main(){float ac=max(0.,1.-abs(vUv.y*2.-1.));float across=ac*sqrt(ac);float ux=clamp(vUv.x,0.,1.);float along=ux*ux*sqrt(ux);float tip=1.-smoothstep(.9,1.,ux)*.5;float a=across*along*tip*c.a;if(a<.004)discard;gl_FragColor=vec4(c.rgb*a*(.7+along),1.);}' }));
    skMesh.frustumCulled = false; skMesh.renderOrder = 8; skMesh.visible = false; root.add(skMesh);
    const skPool = Array.from({ length: SK }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 0, w: 0, col: null }));
    let skCursor = 0;
    function streak(x, y, z, vx, vy, vz, life, w, col) {
      const i = skCursor++ % SK, s = skPool[i]; s.x = x; s.y = y; s.z = z; s.vx = vx; s.vy = vy; s.vz = vz; s.t = 0; s.life = life; s.w = w; s.col = col; sk[i] = s;
    }
    const cv1 = new T.Vector3(), cv2 = new T.Vector3(), cv3 = new T.Vector3(), camDir = new T.Vector3(0, -.8, -.6), qa = new T.Vector3(), qb = new T.Vector3();
    function streaksStep(dt) {
      if (!skMesh.visible) return;
      const cam = B.app && B.app.camera; if (cam) cam.getWorldDirection(camDir);
      let live = 0;
      for (let i = 0; i < SK; i++) {
        const s = sk[i], o = i * 12; if (!s) continue;
        s.t += dt; if (s.t >= s.life) { sk[i] = null; skPos.fill(0, o, o + 12); skCol.fill(0, i * 16, i * 16 + 16); continue; }
        s.vy -= 9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (s.y < .06) { s.y = .06; s.vy = Math.abs(s.vy) * .25; s.vx *= .6; s.vz *= .6; }
        const sp = Math.hypot(s.vx, s.vy, s.vz) || 1, len = clamp(sp * .045, .12, .9);   // stretch with speed: continuous motion blur
        qa.set(s.x, s.y, s.z); cv1.set(s.vx, s.vy, s.vz).multiplyScalar(1 / sp); qb.copy(qa).addScaledVector(cv1, -len);
        cv2.crossVectors(cv1, camDir); if (cv2.lengthSq() < 1e-6) cv2.set(1, 0, 0); cv2.normalize().multiplyScalar(s.w * .34);
        const k = 1 - s.t / s.life, a = Math.min(1, s.t * 40) * k * k;
        skPos[o] = qb.x - cv2.x; skPos[o + 1] = qb.y - cv2.y; skPos[o + 2] = qb.z - cv2.z;
        skPos[o + 3] = qb.x + cv2.x; skPos[o + 4] = qb.y + cv2.y; skPos[o + 5] = qb.z + cv2.z;
        skPos[o + 6] = qa.x + cv2.x; skPos[o + 7] = qa.y + cv2.y; skPos[o + 8] = qa.z + cv2.z;
        skPos[o + 9] = qa.x - cv2.x; skPos[o + 10] = qa.y - cv2.y; skPos[o + 11] = qa.z - cv2.z;
        for (let j = 0; j < 4; j++) { const c = i * 16 + j * 4; skCol[c] = s.col[0]; skCol[c + 1] = s.col[1]; skCol[c + 2] = s.col[2]; skCol[c + 3] = a; }
        live++;
      }
      skGeo.attributes.position.needsUpdate = true; skGeo.attributes.aCol.needsUpdate = true; skMesh.visible = live > 0;
    }
    function streakBurst(x, y, z, n, dir, spread, speed, col) {
      skMesh.visible = true;
      for (let i = 0; i < n; i++) { const a = dir + (Math.random() - .5) * spread, sp = speed * (.55 + Math.random() * .7);
        streak(x, y + Math.random() * .3, z, Math.sin(a) * sp, 1.5 + Math.random() * 3.2, Math.cos(a) * sp, .3 + Math.random() * .3, .045 + Math.random() * .04, Math.random() < .3 ? [3.4, 2.4, 1.2] : col || [3.0, 1.1, .3]); }
    }
    // Jagged floor cracks that run out from the centre (a thin soft-edged ribbon each), glow white-hot and cool to a dark scar
    const CK = 3, CKV = 420, chCracks = [];
    const ckMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, uniforms: { uHeat: { value: 0 }, uRun: { value: 0 }, uA: { value: 1 }, uTint: { value: new T.Vector3(1, 1, 1) } },
      vertexShader: 'attribute float aV,aT;varying float v,t;void main(){v=aV;t=aT;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying float v,t;uniform float uHeat,uRun,uA;uniform vec3 uTint;void main(){float q=max(0.,1.-min(1.,abs(v*2.-1.)));float reveal=1.-smoothstep(uRun-.06,uRun,t);float core=q*q;float h=uHeat*core*core;vec3 col=mix(vec3(.025,.018,.016),vec3(.65,.26,.085),h);col=mix(col,vec3(.85,.47,.16),core*core*core*uHeat*.3);col*=uTint;float a=(q*.9+.1*core)*reveal*uA;if(a<.01)discard;gl_FragColor=vec4(col,a);}' });
    for (let i = 0; i < CK; i++) {
      const g = new T.BufferGeometry(), pos = new Float32Array(CKV * 3), av = new Float32Array(CKV), at = new Float32Array(CKV);
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aV', new T.BufferAttribute(av, 1)); g.setAttribute('aT', new T.BufferAttribute(at, 1)); g.setIndex(new T.BufferAttribute(new Uint16Array(CKV * 3), 1));
      const m = new T.Mesh(g, ckMat.clone()); m.frustumCulled = false; m.renderOrder = 0; m.visible = false; root.add(m); chCracks.push({ m, t: 99 });
    }
    function chCrack(x, z, R, tier) {
      const c = chCracks.reduce((a, b) => (b.t > a.t ? b : a)), g = c.m.geometry, pos = g.attributes.position.array, av = g.attributes.aV.array, at = g.attributes.aT.array, idx = g.index.array;
      let vi = 0, ii = 0; const spokes = 7, base = Math.random() * 6.28, floor = floorAt(x, z, R) + .014;
      for (let sI = 0; sI < spokes; sI++) {
        const segs = 12, len = R * (.7 + Math.random() * .4); let a = base + sI / spokes * 6.283 + (Math.random() - .5) * .5, px = x, pz = z;
        for (let k = 0; k <= segs && vi + 2 <= CKV; k++) {
          const f = k / segs, w = .3 * (1 - f * .85) * .5 * (tier === 3 ? 1.7 : tier === 2 ? 1.25 : 1), nx = Math.cos(a), nz = -Math.sin(a);
          pos[vi * 3] = px - nx * w; pos[vi * 3 + 1] = floor; pos[vi * 3 + 2] = pz - nz * w; av[vi] = 0; at[vi] = f; vi++;
          pos[vi * 3] = px + nx * w; pos[vi * 3 + 1] = floor; pos[vi * 3 + 2] = pz + nz * w; av[vi] = 1; at[vi] = f; vi++;
          if (k > 0) { const q = vi - 4; idx.set([q, q + 1, q + 2, q + 1, q + 3, q + 2], ii); ii += 6; }
          px += Math.sin(a) * len / segs; pz += Math.cos(a) * len / segs; a += (Math.random() - .5) * .7;
        }
      }
      g.index.array.fill(0, ii); g.index.needsUpdate = true; for (const n of ['position', 'aV', 'aT']) g.attributes[n].needsUpdate = true; g.setDrawRange(0, ii);
      c.m.material.uniforms.uTint.value.set(tier === 3 ? .55 : 1, tier === 3 ? .14 : tier === 2 ? .8 : 1, tier === 3 ? .4 : tier === 2 ? .45 : 1); c.t = 0; c.m.visible = true; c.m.material.uniforms.uRun.value = 0; c.m.material.uniforms.uHeat.value = 1; c.m.material.uniforms.uA.value = 1;
    }
    function cracksStep(dt) {
      for (const c of chCracks) {
        if (c.t > 20) continue; c.t += dt; const u = c.m.material.uniforms;
        u.uRun.value = Math.min(1.2, c.t / .16); u.uHeat.value = Math.pow(Math.max(0, 1 - c.t / 1.6), 1.5); u.uA.value = c.t < 8 ? 1 : Math.max(0, 1 - (c.t - 8) / 2);
        if (c.t >= 10) { c.m.visible = false; c.t = 99; }
      }
    }
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const wh = { on: false, end: 0, power: 0, age: 0, prev: 0, rate: 0, have: false, dust: 0, vort: 0, k: 1, tier: 1, grow: 1, R: 3.6, matTier: 0, fire: 0 };
    const chPX = new Float32Array(CH_PTS), chPY = new Float32Array(CH_PTS), chPZ = new Float32Array(CH_PTS), chCum = new Float32Array(CH_PTS);
    const chM = new T.Matrix4(), chT = new T.Vector3(), chN1 = new T.Vector3(), chN2 = new T.Vector3(), chUp = new T.Vector3(0, 1, 0), chP = new T.Vector3();
    function whirlStep(dt) {
      const g = getGame(), p = g && g.player, a = p && p.attack && p.attack.whirl && !p.dead ? p.attack : null, calm = reduced.matches;
      if (a) { if (!wh.on) { wh.on = true; wh.have = false; } wh.age = a.age; }
      else wh.on = false;
      wh.power = clamp(wh.power + (wh.on ? dt / .12 : -dt / .14), 0, 1);
      // Parent: two chains stayed out at the sides at the end. They now draw back into the hands before the last blow lands (wh.end 0..1 over the braking part of the spin).
      wh.end = a ? (a.duration > 0 ? smooth(a.duration - .66, a.duration - .38, a.age) : 0) : wh.end;   // stays drawn in after the spin ends
      if (wh.power <= 0 && !wh.on) { chLinks.visible = chDisc.visible = chFloor.visible = false; chHeads.forEach(h => { h.visible = false; }); chGlow.forEach(s => { s.visible = false; }); wh.have = false; for (const r of chRings) if (r.t < r.life) advRing(r, dt); return; }
      if (a) { wh.tier = a.tier || 1; const rad = a.radius || 3.6, gp = wh.grow < 1 ? wh.grow + (1 - wh.grow) * smooth(0, .9, a.duration > 0 ? a.age / a.duration : 0) : 1; wh.R = rad * gp; wh.k = clamp(wh.R / 3.6, 1, 1.8); }
      const WTI = WT[wh.tier] || WT[1], t3 = wh.tier === 3 ? 1 : 0;
      if (wh.matTier !== wh.tier) { wh.matTier = wh.tier; chLinks.material.color.set(WTI.metal); chLinks.material.emissive.setRGB(WTI.emis[0], WTI.emis[1], WTI.emis[2]); chDiscMat.uniforms.uC1.value.set(WTI.d1[0], WTI.d1[1], WTI.d1[2]); chDiscMat.uniforms.uC2.value.set(WTI.d2[0], WTI.d2[1], WTI.d2[2]); chDiscMat.uniforms.uTail.value = WTI.tail; chFloorMat.uniforms.uCol.value.set(WTI.floor[0], WTI.floor[1], WTI.floor[2]); chFloorMat.uniforms.uCres.value = WTI.cres; }
      const px = p.x, pz = p.z, root0 = p.model && p.model.root ? p.model.root.rotation.y : 0, th = root0 + 1.35, P = smooth(0, 1, wh.power);
      let dth = wh.have ? th - wh.prev : 0; while (dth > Math.PI) dth -= Math.PI * 2; while (dth < -Math.PI) dth += Math.PI * 2;
      const omega = dt > 0 ? dth / dt : 0; wh.rate += (clamp(omega / 26, 0, 1) - wh.rate) * (1 - Math.exp(-dt * 14));
      const reach = 3.05 * (wh.k || 1) * Math.pow(P, .7) * (1 - wh.end), pe = P * (1 - wh.end), lag = .5 + WTI.lag * wh.rate, t = performance.now() / 1000;
      // ---- two chains: hand -> swept-back arc -> head, links placed at a fixed pitch from the head
      const hy = 1.02; let li = 0;
      for (let arm = 0; arm < 2; arm++) {
        const ang = th + arm * Math.PI; let n = 0;
        for (let j = 0; j < CH_PTS; j++) {   // j = 0 head ... last = hand
          const s = j / (CH_PTS - 1), rr = reach * Math.pow(1 - s, .85) + .32 * s, aa = ang - lag * Math.pow(s, 1.25) * (P > 0 ? 1 : 0);
          const rs = rr * (1 + t3 * .09 * Math.sin(t * 5 + arm * 2.1) * (1 - s) * P); chPX[j] = px + Math.sin(aa) * rs; chPZ[j] = pz + Math.cos(aa) * rs; chPY[j] = hy + (wh.tier === 2 ? .05 : .16) * Math.sin(aa * 2 + t * 6 + arm * 2) * (1 - s) * P - .05 * s + t3 * .42 * Math.sin(t * 7 + arm * 3.1) * (1 - s) * P; n = j + 1;
          chCum[j] = j ? chCum[j - 1] + Math.hypot(chPX[j] - chPX[j - 1], chPY[j] - chPY[j - 1], chPZ[j] - chPZ[j - 1]) : 0;
        }
        let seg = 0;
        for (let i = 0; i < CH_ARM; i++, li++) {
          const d0 = (i + .5) * CH_PITCH; if (d0 > chCum[n - 1]) { chM.makeScale(.0001, .0001, .0001); chM.setPosition(px, hy, pz); chLinks.setMatrixAt(li, chM); continue; }
          while (seg < n - 2 && chCum[seg + 1] < d0) seg++;
          const b = seg + 1, sl = Math.max(1e-5, chCum[b] - chCum[seg]), f = clamp((d0 - chCum[seg]) / sl, 0, 1);
          chP.set(chPX[seg] + (chPX[b] - chPX[seg]) * f, chPY[seg] + (chPY[b] - chPY[seg]) * f, chPZ[seg] + (chPZ[b] - chPZ[seg]) * f);
          chT.set(chPX[b] - chPX[seg], chPY[b] - chPY[seg], chPZ[b] - chPZ[seg]).normalize();
          chN1.copy(chUp).addScaledVector(chT, -chUp.dot(chT)); chN1.normalize(); chN2.crossVectors(chT, chN1);
          if (i & 1) chM.makeBasis(cv1.copy(chT).multiplyScalar(1.45), cv2.copy(chN2), cv3.copy(chN1).multiplyScalar(-1));
          else chM.makeBasis(cv1.copy(chT).multiplyScalar(1.45), cv2.copy(chN1), cv3.copy(chN2));
          chM.setPosition(chP); chLinks.setMatrixAt(li, chM);
        }
        const h = chHeads[arm]; h.visible = pe > .08; h.position.set(chPX[0], chPY[0], chPZ[0]); chT.set(chPX[0] - chPX[1], chPY[0] - chPY[1], chPZ[0] - chPZ[1]); if (chT.lengthSq() < 1e-9) chT.set(1, 0, 0);
        h.quaternion.setFromUnitVectors(cv1.set(1, 0, 0), chT.normalize()); h.scale.set((.6 + .4 * pe) * WTI.head[0], (.6 + .4 * pe) * WTI.head[1], (.6 + .4 * pe) * WTI.head[2]);
        const gl = chGlow[arm]; gl.visible = pe > .08; gl.position.set(chPX[0], chPY[0] + .05, chPZ[0]); gl.scale.setScalar((.13+.13*wh.rate+.035*P)*(1+.12*(wh.tier-1))); gl.material.color.setRGB(WTI.glow[0]*P*.25,WTI.glow[1]*P*.25,WTI.glow[2]*P*.25);
        // embers by distance: every 10 cm the head travelled since the last frame sheds one (interpolated between the two angles)
        if (wh.have && !calm && Math.abs(dth) > 1e-4) {
          const bud = clamp(budget() / 1100, .3, 1), arc = Math.abs(dth) * reach, cnt = Math.min(18 + 6 * (wh.tier - 1), Math.ceil(arc / (.1 / bud / (1 + .5 * (wh.tier - 1)))));
          for (let k = 0; k < cnt; k++) { const aa2 = ang - dth * (1 - (k + Math.random()) / cnt), rr = reach * (.9 + Math.random() * .1);
            emit(px + Math.sin(aa2) * rr, hy - .1 + Math.random() * .3 + t3 * (chPY[0] - hy), pz + Math.cos(aa2) * rr, 4, Math.random() < .5 ? WTI.ember[0] : WTI.ember[1], Math.cos(aa2) * Math.sign(dth) * 1.2 + rnd(-.3, .3), rnd(.1, .7) + t3 * rnd(.3, 1.1), -Math.sin(aa2) * Math.sign(dth) * 1.2 + rnd(-.3, .3), .45 + Math.random() * .5 + .2 * t3, .05 + .02 * t3); }
          if (wh.tier > 1) {   // heads shed fire: molten sparks (II) / violet-black flames (III) straight off the blade
            const hot = Math.random() < .5 ? WTI.ember[0] : WTI.hot;
            if (wh.tier === 2) streak(chPX[0], chPY[0], chPZ[0], Math.cos(ang) * Math.sign(dth) * 6 + rnd(-2, 2), rnd(.5, 3), -Math.sin(ang) * Math.sign(dth) * 6 + rnd(-2, 2), .25 + Math.random() * .2, .05, WTI.hot);
            else { emit(chPX[0], chPY[0], chPZ[0], 4, hot, rnd(-.5, .5), rnd(.6, 1.6), rnd(-.5, .5), .5 + Math.random() * .4, .09); emit(chPX[0], chPY[0] - .1, chPZ[0], 2, [.05, .035, .06], rnd(-.4, .4), rnd(.3, .9), rnd(-.4, .4), .7, .34); if (Math.random() < .5) skMesh.visible = true; }
          }
          if (wh.tier === 2) skMesh.visible = true;
        }
      }
      chLinks.count = CH_MAX; chLinks.instanceMatrix.needsUpdate = true; chLinks.visible = pe > .06; chLinks.material.emissiveIntensity=.005+.04*P*(.5+.5*wh.rate);
      // ---- disc and floor swirl
      chDisc.visible = chFloor.visible = true; chDisc.position.set(px, 1.0, pz); chFloor.position.set(px, floorAt(px, pz, wh.R) + .014, pz);
      chDiscMat.uniforms.uHead.value = th; chDisc.scale.setScalar(wh.k); chFloor.scale.setScalar(wh.k); chDiscMat.uniforms.uP.value = P * (1 - wh.end) * (calm?.09:.18)*(1+.08*(wh.tier-1)); chDiscMat.uniforms.uRate.value = wh.rate; chDiscMat.uniforms.uT.value = t % 100;
      chFloorMat.uniforms.uHead.value = th; chFloorMat.uniforms.uP.value=P*(.18+.01*(wh.tier-1)); chFloorMat.uniforms.uT.value = t % 100; chFloorMat.uniforms.uRim.value = 3.6 * Math.pow(P, .5);
      // ---- the vortex: ash and embers drawn in and around, by time (not by frame)
      if (wh.on && !calm) {
        const bud = clamp(budget() / 1100, .3, 1); wh.dust+=dt*30*bud * (1 + .5 * (wh.tier - 1)); wh.vort+=dt*24*bud * (1 + .6 * (wh.tier - 1));
        while (wh.dust >= 1) { wh.dust--; const a2 = Math.random() * 6.283, r = (2.2 + Math.random() * 1.6) * wh.k; emit(px + Math.sin(a2) * r, .12, pz + Math.cos(a2) * r, 2, t3 ? [.05, .04, .055] : DUST, Math.cos(a2) * 4.5, .5 + Math.random(), -Math.sin(a2) * 4.5, .6 + Math.random() * .4, .3 + Math.random() * .3); }
        while (wh.vort >= 1) { wh.vort--; const a2 = Math.random() * 6.283, r = 4 + Math.random() * 1.6, y = .2 + Math.random() * 1.3; emit(px + Math.sin(a2) * r * wh.k, y, pz + Math.cos(a2) * r * wh.k, 5, WTI.ember[0], -Math.sin(a2) * r * 1.5 + Math.cos(a2) * 3.4, .4, -Math.cos(a2) * r * 1.5 - Math.sin(a2) * 3.4, .5, .05); }
      }
      wh.prev = th; wh.have = true;
      for (const r of chRings) if (r.t < r.life) advRing(r, dt);
    }
    function chainClear() { roarSpiral.on = false; wh.on = false; wh.power = 0; wh.end = 0; wh.have = false; chLinks.visible = chDisc.visible = chFloor.visible = skMesh.visible = false; chHeads.forEach(h => { h.visible = false; }); chGlow.forEach(s => { s.visible = false; }); for (const c of chCracks) { c.t = 99; c.m.visible = false; } sk.fill(null); skPos.fill(0); skGeo.attributes.position.needsUpdate = true; for (const r of chRings) { r.t = r.life = 9; r.m.visible = false; } }
    function whirlStart(d) {
      const x = d.x, z = d.z, R = d.radius || 3.6, tier = d.tier || 1, W = WT[tier] || WT[1], calm = reduced.matches;
      wh.grow = d.grow || 1;
      chRing(x, z, R * (tier === 3 ? .9 : .7), tier === 3 ? .55 : .4, W.ring);
      flash(x, 1.0, z, 1.6 + .3 * (tier - 1), new T.Color(W.flash), .18, 0, softMap);
      const ringDust = scaleCount(36 + 14 * (tier - 1)); for (let i = 0; i < ringDust; i++) { const a = i / ringDust * Math.PI * 2; particle(x + Math.sin(a) * .8, .1, z + Math.cos(a) * .8, 2, tier === 3 ? [.05, .04, .055] : DUST, 2.4 + .6 * (tier - 1), a, .4); }
      for (let i = 0; i < scaleCount(16 + 10 * (tier - 1)); i++) { const a = Math.random() * Math.PI * 2; emit(x + Math.sin(a) * .5, .3 + Math.random() * .8, z + Math.cos(a) * .5, 4, W.ember[i % 2], Math.sin(a) * 2.2, rnd(.5, 1.6), Math.cos(a) * 2.2, .6 + Math.random() * .4, .05); }
      if (tier === 2) { streakBurst(x, .5, z, calm ? 3 : 14, d.face || 0, 6.3, 8, W.hot); }
      if (tier === 3) {   // the ground shatters under the hero: dark ring, violet shock ring, stone fissures, camera pulse
        chCrack(x, z, R * .8, 3);
        scar(x, z, 0, { shape: 'circle', radius: R * .6, heat: .35 });
        streakBurst(x, .5, z, calm ? 4 : 24, 0, 6.3, 9, W.hot);
        if (B.Charge && B.Charge.punch) B.Charge.punch({ vig: .14, chroma: .025, flash: .012, push: .012, dur: .45, x, z, ringR: R * .9, ringW: .18 });
      }
    }
    function whirlTick(d) {
      const x = d.x, z = d.z, R = d.radius || 3.6, last = d.last, calm = reduced.matches, tier = d.tier || 1, W = WT[tier] || WT[1];
      if(last)chRing(x,z,R*1.05,.5,W.ringLast);
      if(last&&impactFx){const c=W.ringLast,h=W.ember[0];impactFx.dome(x,z,{r:R*1.1,h:1.2+.4*tier,life:.5+.05*tier,col:[c[0]*.8,c[1]*.8,c[2]*.8],hot:[Math.min(1.9,h[0]*.55),Math.min(1.6,h[1]*.55),Math.min(1.6,h[2]*.75)],a:.55+.12*tier});if(tier===3)impactFx.plume(x,z,{n:12,r:R*.35,col:[.045,.032,.05],up:2.2,size:.55});}   // the last turn throws a wall of air and grit outward (fx-impact.js)
      if (tier === 3 && !last && (d.n % 2 === 0) && B.Charge && B.Charge.punch) B.Charge.punch({ vig: .1, push: .007, dur: .3 });
      if (last) { flash(x, .9, z, tier === 3 ? 2.2 : 1.2, new T.Color(tier === 3 ? '#efe6ff' : '#d87840'), tier === 3 ? .2 : .16, 0, softMap); chCrack(x, z, R * (tier === 3 ? 1.15 : 1), tier); scar(x, z, 0, { shape: 'circle', radius: R * .75, heat: tier === 3 ? .35 : .3 }); }
      if (last && tier === 3) {   // Son Hüküm: the final slam, a second wide ring, a pulse through the whole screen
        
        if (B.Charge && B.Charge.punch) B.Charge.punch({ vig: .24, flash: .025, chroma: .055, sat: .08, push: .025, dur: .6, x, z, ringR: R * 1.1, ringW: .24 });
      } else if (last && tier === 2 && B.Charge && B.Charge.punch) B.Charge.punch({ vig: .25, flash: .02, push: .018, dur: .5, x, z });
      const nS = calm ? 4 : scaleCount(last ? 46 + 40 * (tier - 1) : 14 + 8 * (tier - 1));
      for (let i = 0; i < nS; i++) { const a = Math.random() * Math.PI * 2; streakBurst(x + Math.sin(a) * R * .55, .6, z + Math.cos(a) * R * .55, 1, a + Math.PI / 2 * (Math.random() < .5 ? 1 : -1), .6, last ? 9 + 2 * tier : 6, tier > 1 ? W.hot : undefined); }
      const dn = scaleCount(last ? 44 + 20 * (tier - 1) : 14); for (let i = 0; i < dn; i++) { const a = i / dn * Math.PI * 2; particle(x + Math.sin(a) * (R * .6), .1, z + Math.cos(a) * (R * .6), 2, tier === 3 ? [.05, .04, .055] : DUST, last ? 2.4 + .8 * (tier - 1) : 1.4, a, .3); }
      if (last) for (let i = 0; i < scaleCount(40 + 20 * (tier - 1)); i++) { const a = Math.random() * Math.PI * 2, r = R * (.3 + Math.random() * .6); emit(x + Math.sin(a) * r, .1, z + Math.cos(a) * r, 4, W.ember[i % 2], Math.sin(a) * 1.2, 1.5 + Math.random() * 2.5 + (tier - 1), Math.cos(a) * 1.2, .7 + Math.random() * .6, .05); }
    }
    function whirlHit(d) {
      const a = d.face || 0, W = WT[d.tier || 1] || WT[1], tier = d.tier || 1;
      streakBurst(d.x, d.y || 1, d.z, reduced.matches ? 3 : d.last ? 14 + 6 * (tier - 1) : 7 + 3 * (tier - 1), a, 1.6, d.last ? 10 : 7, tier > 1 ? W.hot : undefined);
      flash(d.x, d.y || 1, d.z, d.last ? 1.2 : .8, new T.Color(W.hit), .1, 0, softMap);
    }
    function rageEnd(d) {
      const x = d.x, z = d.z;
      for (let i = 0; i < scaleCount(22); i++) emit(x + rnd(-.35, .35), .3 + Math.random() * 1.6, z + rnd(-.35, .35), 2, [.06, .05, .05], rnd(-.2, .2), .5 + Math.random() * .4, rnd(-.2, .2), 1.1, .3);
      for (let i = 0; i < scaleCount(14); i++) emit(x + rnd(-.4, .4), .5 + Math.random() * 1.4, z + rnd(-.4, .4), 4, [1.2, .28, .08], rnd(-.3, .3), .3, rnd(-.3, .3), .9, .04);
      if (tells) tells.glowBurst(x, z, { radius: 1.8, life: .6, color: [.7, .12, .05], peak: .35 });
    }
    // ------------------------------------------------------------ afterimages (frozen copies of the real pose)
    const ghostTint = new T.Color('#5d86b8'), ghostM = new T.Matrix4();
    let ghostModel = null;
    function sourcesOf(model) {
      if (ghostSources.has(model)) return ghostSources.get(model);
      const skinned = [], rigid = [];
      model.root.traverse(n => { if (!n.isMesh || (!n.visible && !n.userData.equipmentId)) return; if (n.isSkinnedMesh) skinned.push(n); else if (!n.isInstancedMesh && model.bones && model.bones.weapon && isUnder(n, model.bones.weapon)) rigid.push(n); });
      const s = { skinned, rigid }; ghostSources.set(model, s); return s;
    }
    function isUnder(n, parent) { for (let p = n; p; p = p.parent) if (p === parent) return true; return false; }
    function ghostSet(model) {
      const src = sourcesOf(model), group = new T.Group(), mat = new T.MeshBasicMaterial({ color: ghostTint, transparent: true, opacity: .3, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      const parts = [], skeletons = new Map();
      for (const sm of src.skinned) {
        // Garments bound to the same source skeleton share one frozen pose and one bone texture.
        // A different source skeleton keeps its own pose; each mesh still keeps its original bind matrix.
        let sk = skeletons.get(sm.skeleton);
        if (!sk) { sk = new T.Skeleton(sm.skeleton.bones, sm.skeleton.boneInverses); sk.computeBoneTexture(); sk.update = function () {}; skeletons.set(sm.skeleton, sk); }
        const gm = new T.SkinnedMesh(sm.geometry, mat); gm.skeleton = sk; gm.bindMatrix.copy(sm.bindMatrix); gm.frustumCulled = false; gm.renderOrder = 5;
        const h = model.height || 2.2, bounds = sm.boundingSphere || new T.Sphere(new T.Vector3(0, h * .5, 0), h * 1.1);
        gm.boundingSphere = bounds.clone();
        group.add(gm); parts.push({ gm, sm, sk, bounds });
      }
      const rmat = src.rigid.length ? mat.clone() : null;
      for (const rm of src.rigid) { const m = new T.Mesh(rm.geometry, rmat); m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 5; group.add(m); parts.push({ rigid: m, rm }); }
      root.add(group); return { group, mat, rmat, parts, skeletons, model, time: 0, life: 0, active: false };
    }
    function snapshot(g) {
      // Frozen skin matrices already contain the world pose; the uncullable ghost mesh itself stays at identity.
      // These prepared bounds only supply its sorting centre, without scanning all skinned vertices on the first dodge.
      for (const p of g.parts) if (p.rigid) { p.rigid.visible = p.rm.visible; p.rigid.matrix.copy(p.rm.matrixWorld); }
      else { p.gm.visible = p.sm.visible; p.gm.boundingSphere.copy(p.sm.boundingSphere || p.bounds).applyMatrix4(p.sm.matrixWorld); }
      for (const [source, sk] of g.skeletons) {
        const bones = source.bones, inv = source.boneInverses;
        for (let i = 0; i < bones.length; i++) { ghostM.multiplyMatrices(bones[i].matrixWorld, inv[i]); ghostM.toArray(sk.boneMatrices, i * 16); }
        if (sk.boneTexture) sk.boneTexture.needsUpdate = true;
      }
    }
    function prepareGhosts(model) {
      if (ghostModel && ghostModel !== model) disposeGhosts();
      ghostModel = model;
      const cap = budget() < 300 ? 3 : budget() < 700 ? 5 : 7;
      let have = 0; for (const g of ghosts) if (g.model === model) have++;
      while (have < cap) { const g = ghostSet(model); g.group.visible = false; ghosts.push(g); have++; }
    }
    function spawnGhost(model, life, opacity, color) {
      const cap = budget() < 300 ? 3 : budget() < 700 ? 5 : 7;
      prepareGhosts(model);
      let g = null, oldest = null, seen = 0;
      for (const o of ghosts) {
        if (o.model !== model || seen++ >= cap) continue;
        if (!o.active) { g = o; break; }
        if (!oldest || o.time > oldest.time) oldest = o;
      }
      g = g || oldest;
      snapshot(g); g.active = true; g.time = 0; g.life = life; g.opacity = opacity; g.group.visible = true; g.mat.color.copy(color || ghostTint); if (g.rmat) g.rmat.color.copy(g.mat.color);
    }
    // ------------------------------------------------------------ blade smears
    const trailMaterial = new T.ShaderMaterial({ side: T.DoubleSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { tint: { value: new T.Color('#9fb2bd') }, rim: { value: new T.Color('#fff1dc') }, gain: { value: 1 } },
      vertexShader: 'attribute float aAlpha,aEdge;varying float a,e;void main(){a=aAlpha;e=aEdge;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying float a,e;uniform vec3 tint,rim;uniform float gain;void main(){float body=smoothstep(.05,.9,e);float edge=smoothstep(.8,.97,e)*(1.-smoothstep(.97,1.,e));vec3 col=tint*body*.42+rim*edge*1.7;float al=a*a*(body*body*.3+edge*.95)*gain;if(al<.004)discard;gl_FragColor=vec4(col*al,al);}' });
    const SUB = 5, MAXS = 16, pivot = new T.Vector3(), tipW = new T.Vector3(), baseW = new T.Vector3(), da = new T.Vector3(), db = new T.Vector3();
    const trailTip = new T.Vector3(), trailBase = new T.Vector3(), tip = new T.Vector3(), base = new T.Vector3(), ptip = new T.Vector3(), pbase = new T.Vector3(), pv = new T.Vector3(), oppositeTangent = new T.Vector3();
    function slerpDir(out, a, b, t) {
      const dot = clamp(a.dot(b), -1, 1), ang = Math.acos(dot);
      if (ang < .02) return out.copy(a).lerp(b, t).normalize();
      if (dot < -.9999) {
        if (t <= 0) return out.copy(a); if (t >= 1) return out.copy(b);
        oppositeTangent.copy(b).addScaledVector(a, -dot);
        if (oppositeTangent.lengthSq() < 1e-12) oppositeTangent.set(Math.abs(a.y) < .9 ? 0 : 1, Math.abs(a.y) < .9 ? 1 : 0, 0).cross(a);
        oppositeTangent.normalize();
        return out.copy(a).multiplyScalar(Math.cos(ang * t)).addScaledVector(oppositeTangent, Math.sin(ang * t));
      }
      const s = Math.sin(ang); return out.copy(a).multiplyScalar(Math.sin((1 - t) * ang) / s).addScaledVector(b, Math.sin(t * ang) / s);
    }
    const trailState = { on: false, life: .12, heavy: false };
    function trailWindow(actor) {
      const a = actor.attack, act = actor.action, w = trailState; w.on = false; w.life = .12; w.heavy = false;
      if (a && a.whirl) { w.on = a.age > .04; w.life = .17; w.heavy = true; }   // the blade smears all through the spin
      else if (a) { const lead = a.heavy ? .17 : a.combo === 2 ? .13 : .11, tail = a.heavy ? .12 : a.combo === 2 ? .05 : .08; w.on = a.age > a.strike - lead && a.age < a.strike + tail; w.life = a.heavy ? .17 : a.combo === 2 ? .12 : .11; w.heavy = a.heavy || a.combo === 2; }
      else if (act && act.beats) { const lead = actor.boss ? .22 : .15; for (const beat of act.beats) if (act.age > beat.strike - lead && act.age < beat.strike + .12) { w.on = true; break; } w.life = actor.boss ? .2 : .13; w.heavy = !!actor.boss; }
      return w;
    }
    function hasTrail(model) { const def = model && B.Models && B.Models.types[model.type], role = def && def.motionType || model && model.type; return model && !model.ownTrail && model.weaponTip && model.bones && model.bones.weapon && role !== 'cultist' && model.type !== 'carrier'; }
    function heldWeapon(model) { let armed = false; model.bones.weapon.traverse(n => { if (n.isMesh && !n.isSkinnedMesh && n.geometry && n.name !== 'rim_weapon') armed = true; }); return armed; }
    function makeTrail(actor) {
      const model = actor.model;
      const n = MAXS * SUB, pos = new Float32Array(n * 6 * 3), alpha = new Float32Array(n * 6), edge = new Float32Array(n * 6), geo = new T.BufferGeometry();
      for (let i = 0; i < n; i++) edge.set([0, 1, 1, 0, 1, 0], i * 6);
      geo.setAttribute('aEdge', new T.BufferAttribute(edge, 1)); geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage)); geo.setAttribute('aAlpha', new T.BufferAttribute(alpha, 1).setUsage(T.DynamicDrawUsage)); geo.setDrawRange(0, 0);
      const mat = trailMaterial.clone(), armed = heldWeapon(model);
      if (model.type === 'hero' && gearBlood > 0) { mat.uniforms.tint.value.lerp(new T.Color('#a5504a'), gearBlood * .5); mat.uniforms.rim.value.lerp(new T.Color('#ffc8b0'), gearBlood * .4); }   // a bloodied blade smears warmer
      if (actor.boss) { mat.uniforms.tint.value.set('#b58a6a'); mat.uniforms.rim.value.set('#ffd2a0'); }
      else if (!armed) { mat.uniforms.tint.value.set('#7a3c3a'); mat.uniforms.rim.value.set('#d9a08f'); mat.uniforms.gain.value = .7; }
      const m = new T.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 6; m.visible = false; root.add(m);
      const free = Array.from({ length: MAXS }, () => ({ p: new T.Vector3(), td: new T.Vector3(), tl: 0, bd: new T.Vector3(), bl: 0, age: 0 }));
      const trail = { mesh: m, model, samples: [], free, pos, alpha, life: .12, active: false, armed }; trails.set(actor, trail); return trail;
    }
    function dropTrail(actor, trail) { trail.mesh.removeFromParent(); trail.mesh.geometry.dispose(); trail.mesh.material.dispose(); trails.delete(actor); }
    function trailVertex(P, A, v, p, alpha) { P[v * 3] = p.x; P[v * 3 + 1] = p.y; P[v * 3 + 2] = p.z; A[v] = alpha; }
    function actorTrail(actor, dt, frozen) {
      const model = actor.model; let trail = trails.get(actor);
      if (trail && trail.model !== model) { dropTrail(actor, trail); trail = null; }
      if (!hasTrail(model)) return;   // the hero draws his own ribbon (authored-models.js bladeTrail)
      const w = trailWindow(actor);
      if ((!trail || !trail.active) && !w.on) return;
      if (!trail) trail = makeTrail(actor);
      trail.active = true; trail.mesh.visible = true;
      trail.life = w.on ? w.life : trail.life;
      if (!frozen) for (const s of trail.samples) s.age += dt;
      while (trail.samples.length && trail.samples[trail.samples.length - 1].age > trail.life) trail.free.push(trail.samples.pop());
      if (w.on && !actor.dead && !frozen) {
        model.root.getWorldPosition(pivot); pivot.y += (model.height || 2.3) * .56;
        model.weaponTip.getWorldPosition(tipW); model.bones.weapon.getWorldPosition(baseW); baseW.lerp(tipW, trail.armed ? .3 : 0);
        trailTip.copy(tipW).sub(pivot); trailBase.copy(baseW).sub(pivot);
        if (trail.samples.length === MAXS) trail.free.push(trail.samples.pop());
        const s = trail.free.pop(); s.p.copy(pivot); s.tl = trailTip.length(); s.bl = trailBase.length(); s.td.copy(trailTip).normalize(); s.bd.copy(trailBase).normalize(); s.age = 0; trail.samples.unshift(s);
      }
      // Rebuild the ribbon; between samples the blade is swung around the chest, so directions are slerped.
      let v = 0; const S = trail.samples, P = trail.pos, A = trail.alpha;
      const total = Math.max(1, (S.length - 1) * SUB); let prevA = 0;
      for (let i = 0; i < S.length - 1; i++) {
        const a = S[i], b = S[i + 1];
        for (let k = 0; k <= SUB; k++) {
          const t = k / SUB; pv.copy(a.p).lerp(b.p, t);
          tip.copy(pv).add(slerpDir(da, a.td, b.td, t).multiplyScalar(a.tl + (b.tl - a.tl) * t));
          base.copy(pv).add(slerpDir(db, a.bd, b.bd, t).multiplyScalar(a.bl + (b.bl - a.bl) * t));
          const age = a.age + (b.age - a.age) * t, along = (i * SUB + k) / total, alpha = Math.max(0, 1 - age / trail.life) * (1 - along * .7);
          if (k > 0) {
            trailVertex(P, A, v++, pbase, prevA); trailVertex(P, A, v++, ptip, prevA); trailVertex(P, A, v++, tip, alpha);
            trailVertex(P, A, v++, pbase, prevA); trailVertex(P, A, v++, tip, alpha); trailVertex(P, A, v++, base, alpha);
          }
          ptip.copy(tip); pbase.copy(base); prevA = alpha;
        }
      }
      trail.mesh.geometry.setDrawRange(0, v); uploadPrefix(trail.mesh.geometry.attributes.position, v * 3); uploadPrefix(trail.mesh.geometry.attributes.aAlpha, v);
      if (!S.length && !w.on) { trail.active = false; trail.mesh.visible = false; }
    }
    // Prepared signature effects: four crimson crescents (the level-up lives in src/levelup.js). These never
    // allocate a surface, texture, light or shader when a skill/level is earned.
    const skillCrescents = Array.from({ length: 4 }, () => {
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
        uniforms: { uK: { value: 1 }, uFace: { value: 0 }, uArc: { value: 3.65 } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv;uniform float uK,uFace,uArc;
          void main(){vec2 p=(vUv-.5)*2.4;float r=length(p);float a=atan(p.x,-p.y)-uFace;a=atan(sin(a),cos(a));
          float along=clamp((a/uArc)+.5,0.,1.);float end=smoothstep(0.,.15,along)*(1.-smoothstep(.91,1.,along));float reach=.72+.28*(1.-pow(1.-uK,3.));
          // A forged, asymmetric blade sweep: a fine leading edge and a broad crimson wake
          // combed into curved strands. All layers stay in this one prewarmed surface.
          float belly=sin(along*3.14159);float width=.025+.24*belly*(.35+.65*along);float dr=r-reach;
          float grain=sin(a*37.+dr*48.)*sin(a*11.-dr*67.);float tooth=.008*grain*belly;
          float edge=dr+tooth;float core=exp(-edge*edge/.00027)*(.28+.72*along);
          float band=smoothstep(-width-.018,-width*.68,dr)*(1.-smoothstep(-.012,.038,edge));
          float strands=.43+.57*pow(.5+.5*sin((dr/width)*19.+a*2.4),2.);band*=strands;
          float wake=exp(-pow((dr+width+.062)/.02,2.))*.28*belly;
          float flecks=exp(-pow((dr+width+.135)/.025,2.))*pow(max(0.,cos(a*19.-uK*2.)),8.)*.19*belly;
          float life=pow(1.-uK,1.3)*smoothstep(0.,.065,uK);float alpha=(band+core+wake+flecks)*end*life;
          if(alpha<.004)discard;vec3 col=vec3(2.6,.11,.035)*band+vec3(3.8,1.55,.55)*core+vec3(2.,.25,.08)*(wake+flecks);
          gl_FragColor=vec4(col*end*life,alpha);}` });
      const m = new T.Mesh(plane, mat); m.name = 'mezar-yaran-crescent'; m.rotation.x = -Math.PI / 2; m.visible = false; root.add(m);
      return { m, mat, time: 1, life: .56 };
    });
    // Level-up (src/levelup.js): restrained ground echoes and small GPU-animated reward motes. All materials are created here, at build time, and warmed in warm().
    const impactFx = B.FxImpact && B.FxImpact.createWorld ? B.FxImpact.createWorld({ T, root, getGame, emit, scaleCount }) : null;   // src/fx-impact.js (shock walls, light blades, body flashes)
    const chargeFx = B.Charge && B.Charge.createWorld ?B.Charge.createWorld({ T, root, getGame, getSettings, scaleCount, emit, particle, flash, fragments, scar, ring: chRing }) : null;   // src/charge.js
    const levelFx = B.LevelUp && B.LevelUp.createWorld ? B.LevelUp.createWorld({ T, root, getGame, getSettings, scaleCount, emit, particle, flash }) : null;
    const skillFx = B.SkillFx && B.SkillFx.createWorld ? B.SkillFx.createWorld({ T, root, getGame, getSettings, scaleCount, emit, particle, flash, fragments, streak, scar, tells: () => tells, streakOn: () => { skMesh.visible = true; } }) : null;   // src/skill-fx.js (strike / shout tiers II-III)
    function signatureStep(dt) {
      for (const o of skillCrescents) if (o.m.visible) { o.time += dt; o.mat.uniforms.uK.value = clamp(o.time / o.life, 0, 1); if (o.time >= o.life) o.m.visible = false; }
      if (levelFx) levelFx.step(dt);
      if (chargeFx) chargeFx.step(dt);
      if (skillFx) skillFx.step(dt);
      if (impactFx) impactFx.step(dt);
    }
    // ------------------------------------------------------------ bursts
    const RED = [.17, .008, .014], DARK = [.09, .004, .008], SPARK = [4.5, 2.65, .9], STEEL = [3.2, 3.0, 2.6], DUST = [.10, .08, .065];
    // Round 7 boss effects (boss-mech.js / coast-combat.js): pooled particles, floor waves and sprite flashes only; no lights, nothing created at fight time.
    const B1 = { ember: { core: [3.6, 1.25, .3], soft: '#ff9a4a', dark: [.5, .09, .03] }, brine: { core: [.45, 2.3, 2.1], soft: '#6fe0d0', dark: [.03, .12, .12] } };
    function boss1Fx(name, d, x, y, z) {
      const k = B1[d.kind] || B1.ember, calm = reduced.matches, phase = d.phase || '';
      if (name === 'boss1Orb') {
        if (phase === 'trail') { emit(x + rnd(-.1, .1), y + rnd(-.1, .1), z + rnd(-.1, .1), 3, k.core, rnd(-.25, .25), rnd(.1, .4), rnd(-.25, .25), .4, .13); if (!calm) emit(x, .08, z, 5, k.dark, 0, .1, 0, .6, .22); return; }
        if (phase === 'spawn') { flash(x, y, z, 1.5, new T.Color(k.soft), .22, 0, softMap); for (let i = 0; i < scaleCount(10); i++) particle(x, y, z, 3, k.core, .5, Math.random() * 6.28, .3); return; }
        if (phase === 'pop') { flash(x, y, z, 1.7, new T.Color(k.soft), .14, 0, softMap); for (let i = 0; i < scaleCount(16); i++) particle(x, y, z, 3, k.core, .8, Math.random() * 6.28, .6); return; }
        const r = d.radius || 3.2;   // blast
        if (tells) tells.wave(x, z, { radius: r * 1.1, life: .5, width: .16, color: [k.core[0] * .45, k.core[1] * .45, k.core[2] * .45], crack: 0, soft: .2 });
        flash(x, .9, z, r * .9, new T.Color(k.soft), .16, 0, softMap);
        for (let i = 0; i < scaleCount(26); i++) { const a = Math.random() * 6.28, rr = Math.random() * r * .7; emit(x + Math.sin(a) * rr, .2, z + Math.cos(a) * rr, 4, k.core, Math.sin(a) * 1.2, .8 + Math.random() * 2, Math.cos(a) * 1.2, .5 + Math.random() * .4, .06); }
        for (let i = 0; i < scaleCount(14); i++) particle(x, .2, z, 2, k.dark, 1.2, Math.random() * 6.28, .5);
        return;
      }
      if (name === 'boss1Anchor') {
        if (phase === 'hit') { fragments(x, y, z, { metal: true, count: 6, spread: .12, speed: 2.7, lift: 2.4, size: .045 }); flash(x, y, z, .48, new T.Color('#ffd29a'), .09); for (let i = 0; i < scaleCount(14); i++) particle(x, y, z, 1, [3, 1.8, .7], 1, Math.random() * 6.28, .7); return; }
        if (phase === 'break') {
          fragments(x, y, z, { metal: true, count: 18, spread: .35, speed: 4.5, lift: 4.2, size: .09 });
          fragments(x, .25, z, { count: 10, spread: .5, speed: 3, lift: 2.8 });
          flash(x, y, z, .9, new T.Color('#ff8a50'), .12, 0, softMap);
          if (tells) tells.wave(x, z, { radius: 2.8, life: .5, width: .14, color: [1.4, .3, .1], crack: 0, soft: .2 });
          for (let i = 0; i < scaleCount(22); i++) emit(x + rnd(-.3, .3), y + rnd(0, 1), z + rnd(-.3, .3), 4, i % 2 ? [3, .9, .22] : [1.6, .3, .1], rnd(-1.4, 1.4), rnd(1, 3), rnd(-1.4, 1.4), .8 + Math.random() * .5, .06);
          for (let i = 0; i < scaleCount(16); i++) particle(x, .3, z, 2, [.1, .085, .07], 1.3, Math.random() * 6.28, .6);
          for (let i = 0; i < scaleCount(8); i++) particle(x, 1.2, z, 0, [.05, .045, .04], 1, Math.random() * 6.28, 1.2);
          return;
        }
        if (tells) { tells.wave(x, z, { radius: 6, life: .6, width: .14, color: [1.3, .2, .08], crack: .4, crackR: 4, crackLife: 1, soft: .2 }); tells.wave(x, z, { radius: 9, life: .8, width: .14, color: [.9, .35, .15], soft: 0, delay: .1 }); }
        flash(x, 1.2, z, 2.6, new T.Color('#d87950'), .16, 0, softMap);
        const ring = scaleCount(30); for (let i = 0; i < ring; i++) { const a = i / ring * 6.28; emit(x + Math.sin(a) * .8, .3, z + Math.cos(a) * .8, 2, DUST, Math.sin(a) * 3, .4, Math.cos(a) * 3, .7, .3); }
        return;
      }
      if (name === 'boss1Toll') {   // a bell toll: one slow, wide floor wave
        if (tells) tells.wave(x, z, { radius: d.radius || 6, life: .7, width: .16, color: [.3, 1.1, 1.0], soft: .1 });
        flash(x, 1.5, z, 2.2, new T.Color('#9fe6d8'), .12, 0, softMap);
      }
    }
    function burst(name, d = {}) {
      const game = getGame(); if (!game) return; const x = d.x ?? game.player.x, y = d.y ?? 1, z = d.z ?? game.player.z;
      if (name.indexOf('boss1') === 0) { boss1Fx(name, d, x, y, z); return; }
      if (name === 'heroSkill') {
        const face = d.face || 0, sx = Math.sin(face), sz = Math.cos(face), r = d.radius || 3.2;
        const count = scaleCount(d.phase === 'gather' ? 20 : d.skill === 'reap' ? 65 : 40);
        if (d.phase === 'gather') {
          for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2, rr = .65 + Math.random() * .45;
            emit(x + Math.sin(a) * rr, .2 + Math.random() * .8, z + Math.cos(a) * rr, 4, d.skill === 'reap' ? [.7, .85, 1.7] : [2.6, .35, .12], -Math.sin(a) * 1.7, .8, -Math.cos(a) * 1.7, .35, .055); }
          return;
        }
        if (d.skill === 'quake') { strike({ x: x + sx * 2.4, z: z + sz * 2.4, face, style: 'quake', shape: 'circle', radius: r, scar: true, unblockable: true }); return; }
        if (d.skill === 'cleave') {
          const o = skillCrescents.find(q => !q.m.visible) || skillCrescents[0]; o.time = 0; o.mat.uniforms.uK.value = 0; o.mat.uniforms.uFace.value = face; o.mat.uniforms.uArc.value = d.arc || 3.65;
          o.m.position.set(x, .95, z); o.m.scale.set(r * 2.4, r * 2.4, 1); o.m.visible = true;
          if (impactFx) { impactFx.dome(x + sx * r * .35, z + sz * r * .35, { r: r * .8, h: .55, life: .34, col: [.85, .2, .07], hot: [1.6, .8, .4], a: .45 }); impactFx.plume(x + sx * r * .6, z + sz * r * .6, { n: 5, r: .7, col: [.06, .045, .035], up: 1.6, size: .4 }); }   // the cleaver's wind slaps the floor (fx-impact.js)
          for (let i = 0; i < count; i++) { const a = face + (i / Math.max(1, count - 1) - .5) * (d.arc || 3.65);
            emit(x + Math.sin(a) * r, .5 + Math.sin(i / count * Math.PI) * .9, z + Math.cos(a) * r, 4, [3.8, .32, .11], Math.sin(a) * 2, .25, Math.cos(a) * 2, .55, .09); }
          return;
        }
        if (d.skill === 'reap' || d.skill === 'charge') {
          if (d.skill === 'charge' && d.length <= .05) return;
          const length = d.length ?? (d.skill === 'reap' ? 9 : 5), width = d.width || 1.8;
          for (let i = 0; i < count; i++) { const f = i / count, lateral = (Math.random() - .5) * width, depth = f * length;
            const py = d.skill === 'reap' ? .35 + Math.sin(f * Math.PI * 3) ** 2 * 1.35 : .25;
            emit(x + sx * depth + sz * lateral, py, z + sz * depth - sx * lateral, 4, d.skill === 'reap' ? [.8, .9, 2.4] : [3, .7, .18], sx * 3, .4, sz * 3, .45, .09); }
          return;
        }
        if (d.skill === 'level') { if (levelFx) levelFx.start(x, z); }
        return;
      }
      if (name === 'chargeFx') { if (chargeFx) chargeFx.demo(Object.assign({ x, z }, d)); return; }   // warm-up only (the skill drives chargeFx directly)
      if (name === 'lootCollect') {
        const color = linear(d.color || '#bda87a', 1.05), rare = d.rarity === 'epic' || d.rarity === 'legendary' || d.signature;
        const n = scaleCount(rare ? 12 : 6), floor = floorAt(x, z, .3);
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = rnd(.18, .42), life = rnd(.3, .6);
          emit(x + Math.sin(a)*r, floor + .2 + Math.random()*.45, z + Math.cos(a)*r, 5, color, -Math.sin(a)*r/life, rnd(.45, .85), -Math.cos(a)*r/life, life, rare ? .037 : .025); }
        if (rare && tells) tells.wave(x,z,{radius:.75,life:.32,width:.035,color:color.map(c=>c*.28),soft:0});
        return;
      }
      if (name === 'slash') return; // the smear follows the actual blade
      if (name === 'strike') { strike(Object.assign({ x, z }, d)); return; }
      if (name === 'glowBurst') { if (tells) tells.glowBurst(x, z, { radius: d.radius || 1.5, life: d.duration || .5, color: linear(d.color == null ? '#f0d293' : d.color, 1.6), peak: .5 }); return; }
      if (name === 'strikeGather' || name === 'strikeImpact' || name === 'shoutGather' || name === 'shoutRelease' || name === 'shoutWave') { if (skillFx) skillFx.event(name, Object.assign({ x, z }, d)); return; }
      if (name === 'skillFxDemo') { if (skillFx) skillFx.demo(Object.assign({ x, z }, d)); return; }   // warm-up only
      if (name === 'warCryGather') { warCryGather({ x, z, life: d.life }); return; }
      if (name === 'whirlStart') { whirlStart(Object.assign({ x, z }, d)); return; }
      if (name === 'whirlTick') { whirlTick(Object.assign({ x, z }, d)); return; }
      if (name === 'whirlHit') { whirlHit(Object.assign({ x, z }, d)); return; }
      if (name === 'warCry') { warCry(Object.assign({ x, z }, d)); return; }
      if (name === 'warCryWave') { warCryWave(Object.assign({ x, z }, d)); return; }
      if (name === 'skillAccent') { skillAccent(Object.assign({ x, z }, d)); return; }
      if (name === 'rageEnd') { rageEnd({ x, z }); return; }
      if (name === 'footstep') {
        for (let i = 0; i < (d.heavy ? 8 : 3); i++) particle(x, .045, z, 2, [.08, .065, .05], d.heavy ? .38 : .15);
        // Boots carry blood out of a puddle: prints for a few steps, fainter each time.
        feet = Math.max(feet, bloodUnder(x, z)); if (feet > .12) { const yaw = game.player && game.player.model ? game.player.model.root.rotation.y : 0; footPrint(x, z, yaw, feet); feet *= .8; } else feet = 0;
        return;
      }
      if (name === 'bloodSpray' || name === 'goreBurst' || name === 'stumpSpurt') { gore(name, x, y, z, d.dirX != null ? d.dirX : Math.sin(d.face || 0), d.dirZ != null ? d.dirZ : Math.cos(d.face || 0), d.strength); return; }
      if (name === 'dodge') {
        // Kicked-up grit behind the roll.
        const back = (d.face || 0) + Math.PI; for (let i = 0; i < scaleCount(14); i++) particle(x + rnd(-.2, .2), .06, z + rnd(-.2, .2), 2, [.09, .075, .06], .5, back + rnd(-.9, .9), .35);
        return;
      }
      if (name === 'evade') {
        // A strike passed through the roll: a cold flare of the dodged pose and a thin ring.
        if (game.player && game.player.model) spawnGhost(game.player.model, .32, .55, new T.Color('#9cc4ff'));
        wave(x, z, 1.7, '#8fb8e8', .32, .5, .05); flash(x, 1.2, z, 1.6, new T.Color('#9fc8ff'), .12);
        for (let i = 0; i < scaleCount(18); i++) particle(x, rnd(.5, 1.8), z, 3, [.9, 1.3, 2.2], .6, Math.random() * Math.PI * 2, .4);
        return;
      }
      if (name === 'parry') {
        // Clang: white-gold star on the blade, a fan of sparks thrown back at the attacker, a small shock ring.
        flash(x, y, z, 1.75, new T.Color('#fff6e6'), .13, 0); flash(x, y, z, .8, new T.Color('#ffd08a'), .2);
        const f = Number.isFinite(d.face) ? d.face + Math.PI : Math.random() * Math.PI * 2;
        for (let i = 0; i < scaleCount(64); i++) particle(x, y, z, 1, i % 3 ? SPARK : STEEL, 1.35, f + rnd(-1.3, 1.3), .7);
        return;
      }
      const red = /blood|death/.test(name), spark = /spark|block/.test(name), poison = name === 'poison', large = d.heavy || d.boss || name === 'bossPhase';
      if (spark) {
        flash(x, y, z, d.glance ? .6 : d.block ? 1.25 : .95, new T.Color(d.glance ? '#dfe6ee' : d.block ? '#ffe3b8' : '#ffd29a'), .08);
        const f = Number.isFinite(d.face) ? d.face + Math.PI : Math.random() * Math.PI * 2;
        for (let i = 0; i < scaleCount(d.glance ? 12 : d.block ? 34 : 26); i++) particle(x, y, z, 1, i % 4 ? SPARK : STEEL, d.glance ? .8 : 1.1, f + rnd(-1.5, 1.5), .6);
        return;
      }
      if (red) {
        const spray = Number.isFinite(d.spray) ? d.spray : Number.isFinite(d.face) ? d.face : Math.random() * Math.PI * 2, heavy = !!large;
        if (!d.player && name === 'blood') flash(x, y, z, heavy ? 1.2 : .8, new T.Color(heavy ? '#ffc9a0' : '#ffdcc0'), .06);
        // Directional arterial spray, droplets with gravity that splash where they land, gibs on heavy blows, a spurt that pulses on kills (goreHit).
        const S = clamp(((d.player ? .55 : heavy ? 1.05 : .7) + (d.kill ? .6 : 0) + (d.boss ? .3 : 0)) * clamp(.85 + (d.damage || 0) / 120, .85, 1.3), .3, 2.2);
        goreHit(x, y, z, spray, S, { kill: !!d.kill, heavy, boss: !!d.boss, player: !!d.player, foe: d.labelTarget || (d.player ? game.player : nearestFoe(x, z, 1.6, true)) });
        if (!d.player && name === 'blood') gearHit(d.kill ? .3 : heavy ? .16 : .08); else if (d.player) gearHit(.06);
        if (impactFx && !d.player && d.labelTarget) {   // the struck body flares in the colour of the skill that hit it (fx-impact.js)
          const pl = game.player, sk = pl && (pl.attack && pl.attack.skill || (pl.roar ? 'roar' : '')), tint = sk && impactFx.skillTint(sk);
          // the combo finisher / a heavy blow without a skill of its own: a small slap of air and grit at the foe's feet
          // a heavy blow that does not kill shoves the foe back: its heels plough a short drag mark and kick grit along the push
          if ((heavy || tint) && !d.kill && !d.boss) { const f = d.labelTarget, sa = Math.sin(spray), ca = Math.cos(spray);
            scar(f.x, f.z, spray, { shape: 'line', width: .1, length: tint ? 1.2 : .9, heat: .03, life: 2.5 });
            for (let i = 0; i < scaleCount(8); i++) emit(f.x + rnd(-.25, .25), .08, f.z + rnd(-.25, .25), 2, DUST, sa * rnd(1.2, 2.6), rnd(.2, .6), ca * rnd(1.2, 2.6), rnd(.4, .7), rnd(.16, .26)); }
          if (!tint && (heavy || d.kill)) { const f = d.labelTarget; impactFx.dome(f.x, f.z, { r: d.kill ? 1.5 : 1.2, h: .45, life: .26, col: [.6, .3, .16], hot: [1.1, .8, .55], a: d.kill ? .3 : .24 }); }
          impactFx.hitFlash(d.labelTarget, { col: tint || (d.critical ? [1.25, .95, .6] : [.95, .8, .66]), a: d.kill ? .95 : tint ? .8 : heavy || d.critical ? .7 : .48, life: d.kill ? .26 : tint || heavy ? .2 : .14 });
        }
        if (d.damage > 0) number(Math.round(d.damage), x, 2.5, z, d.player, d.heavy || d.critical, d.kill, d.boss, d.labelTarget || null);
        // Blows struck in fury leave burning embers in the wound.
        if (d.rage && !d.player) for (let i = 0; i < scaleCount(heavy ? 18 : 10); i++) emit(x, y, z, 4, i % 2 ? [2.6, .6, .12] : [2.2, .25, .08], Math.sin(spray) * rnd(.6, 2.2) + rnd(-.5, .5), rnd(.4, 1.6), Math.cos(spray) * rnd(.6, 2.2) + rnd(-.5, .5), rnd(.4, .8), .045);
        if (name === 'death' && impactFx) { const pl = game.player, sk = pl && (pl.attack && pl.attack.skill || (pl.roar ? 'roar' : '')); impactFx.deathAsh(x, z, !!large, sk ? impactFx.skillTint(sk) : null); }
        if (name === 'death') goreKill(x, Math.max(.7, y), z, performance.now() - lastDir.t < 400 ? lastDir.a : Math.random() * 6.28, !!large, null, !!d.boss);
        return;
      }
      if (name === 'bossPhase') {
        // The executioner's second oath burns through the floor: narrow rust-red pressure fronts and rising ash.
        // Existing wave/particle pools carry the whole effect; it never adds a light or a screen-wide white flash.
        const r = d.radius || 4.5, calm = reduced.matches, grave = B.ActiveChapter === 3;
        if (tells) {
          if (B.ActiveChapter < 3) tells.wave(x, z, { radius: r * .72, life: .65, width: .055, color: grave ? [.14,.13,.22] : [.38,.10,.04], crack: .055, crackR: r * .56, crackLife: 1.25, soft: .1 });
          tells.glowBurst(x, z, { radius: r * .22, life: .6, color: grave ? [.2,.18,.3] : [.5,.14,.04], peak: .08 });
        }
        flash(x, 1.0, z, .75, new T.Color(grave ? '#928ca3' : '#c38b68'), .09, 0, softMap);
        const ring = Math.max(6, Math.round(scaleCount(36) * (calm ? .5 : 1)));
        for (let i = 0; i < ring; i++) { const a = i / ring * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a); emit(x + sa * .65, .12, z + ca * .65, 2, DUST, sa * 2.4, .35, ca * 2.4, .65, .28); }
        const embers = Math.max(4, Math.round(scaleCount(24) * (calm ? .5 : 1)));
        for (let i = 0; i < embers; i++) { const a = i / embers * Math.PI * 2, r0 = .45 + Math.random() * .4; emit(x + Math.sin(a) * r0, .4 + Math.random() * 1.4, z + Math.cos(a) * r0, 4, grave ? (i % 3 ? [.3,.28,.45] : [.55,.5,.65]) : (i % 3 ? [1.0,.22,.065] : [1.25,.6,.20]), Math.cos(a) * .5, .8 + Math.random() * 1.2, -Math.sin(a) * .5, .65 + Math.random() * .45, .045); }
        return;
      }
      if (name === 'slam') {
        const r = d.radius || 4.5, small = !!d.small;
        // One short pressure echo under real tumbling rubble. Summons and
        // burrowing bodies disturb the stone rather than spraying flat gravel cards.
        wave(x, z, r * (small ? .9 : 1), '#8d8274', small ? .22 : .38, small ? .12 : .20, small ? .035 : .045);
        flash(x, .35, z, small ? .75 : 1.4, new T.Color('#cfb79c'), small ? .055 : .075);
        fragments(x, .08, z, { count: small ? 8 : 20, spread: small ? .3 : .65, speed: small ? 1.7 : 3.0, lift: small ? 2.4 : 4.1, size: small ? .075 : .12 });
        const ring = scaleCount(small ? 10 : 20);
        for (let i = 0; i < ring; i++) { const a = i / ring * Math.PI * 2; particle(x + Math.sin(a) * .5, .12, z + Math.cos(a) * .5, 2, DUST, small ? .9 : 1.6, a, .45); }
        for (let i = 0; i < scaleCount(small ? 3 : 6); i++) particle(x, .15, z, 1, SPARK, small ? .8 : 1.2, Math.random() * Math.PI * 2, .55);
        return;
      }
      if (name === 'impact') {
        // Enemy blow lands: a dust tongue in the swing's direction.
        const f = Number.isFinite(d.face) ? d.face : Math.random() * Math.PI * 2;
        for (let i = 0; i < scaleCount(14); i++) particle(x + rnd(-.3, .3), .1, z + rnd(-.3, .3), 2, DUST, .7, f + rnd(-.8, .8), .3);
        return;
      }
      const n = large ? 65 : 22, color = poison ? [.075, .15, .02] : DUST;
      for (let i = 0; i < scaleCount(n); i++) particle(x, y, z, 2, color, large ? 1.4 : 1, Math.random() * Math.PI * 2);
      if (poison) for (let i = 0; i < scaleCount(12); i++) particle(x, y, z, 3, [.35, .6, .08], .5, Math.random() * Math.PI * 2, .5);
    }
    // ------------------------------------------------------------ per frame
    let ghostClock = 0, wasIframe = false;
    function update(dt) {
      const game = getGame(), cfg = getSettings(), frozen = !!(game && game.hitStop > 0);
      if (gear && game && game.player && game.player.model !== gear.model) { gear = null; gearApply(); }   // new hero model after a restart
      const canvas = B.app && B.app.renderer ? B.app.renderer.domElement : document.getElementById('game');
      material.uniforms.height.value = canvas && canvas.height > 0 ? canvas.height : innerHeight * Math.min(devicePixelRatio || 1, 2) * (cfg.scale || 1);
      let particleDirty = false, lastParticle = -1;
      for (let i = 0; i < count; i++) {
        const p = slots[i]; if (!p) continue;
        particleDirty = true;
        p.time += dt; ages[i] = p.time; if (p.time > p.life) { slots[i] = null; alphas[i] = 0; continue; }
        lastParticle = i;
        const soft = p.kind >= 4;
        p.vy -= dt * (p.kind === 2 ? 1.8 : p.kind === 3 ? .4 : p.kind === 4 ? -.35 : p.kind === 5 ? 0 : 9); const drag = p.kind === 2 ? Math.exp(-dt * 2.2) : p.kind === 4 ? Math.exp(-dt * .8) : 1; p.vx *= drag; p.vz *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const particleFloor=physicalFloorAt(p.x,p.z)+.055;
        if (p.y < particleFloor) { p.y = particleFloor; p.vy = Math.abs(p.vy) * .17; p.vx *= .55; p.vz *= .55; }
        positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
        alphas[i] = soft ? Math.min(1, p.time * 6) * Math.min(1, (p.life - p.time) * 4) * (p.kind === 4 ? .75 + .25 * Math.sin(p.time * 31 + i) : 1) : Math.min(1, (p.life - p.time) * 3.5);
        sizes[i] = p.size * (p.kind === 2 ? 1 + p.time : 1);
      }
      particles.visible = lastParticle >= 0; geometry.setDrawRange(0, lastParticle + 1);
      if (particleDirty) { uploadPrefix(geometry.attributes.position, (lastParticle + 1) * 3); uploadPrefix(geometry.attributes.aSize, lastParticle + 1); uploadPrefix(geometry.attributes.aAlpha, lastParticle + 1); uploadPrefix(geometry.attributes.aAge, lastParticle + 1); }
      if (particleColorDirty) { uploadPrefix(geometry.attributes.color, (lastParticle + 1) * 3); uploadPrefix(geometry.attributes.aKind, lastParticle + 1); particleColorDirty = false; }
      for (let i = decals.length - 1; i >= 0; i--) { const d = decals[i]; d.time += dt; d.mesh.material.opacity = (d.grow ? .9 * Math.min(1, d.time / .25) : .86) * clamp((cfg.decals - d.time) / 8, 0, 1);
        if (d.grow) { const k = Math.min(1, d.time / d.grow.dur), e = 1 - Math.pow(1 - k, 3), sz = d.grow.from + (d.grow.to - d.grow.from) * e; d.mesh.scale.set(sz * d.grow.sx, sz / d.grow.sx, 1); } if (d.time > cfg.decals) { d.mesh.removeFromParent(); d.mesh.material.dispose(); decals.splice(i, 1); } }
      for (let i = labels.length - 1; i >= 0; i--) { const l = labels[i]; l.time += dt; l.m.position.y += dt * (.9 - l.time * .6); l.m.position.x += l.vx * dt; l.m.material.opacity = clamp(((l.life || .9) - l.time) * 3, 0, 1);
        if (l.bw && !reduced.matches) { const pop = 1 + .55 * Math.exp(-l.time * 18) * Math.cos(l.time * 22); l.m.scale.set(l.bw * pop, l.bh * pop, 1); }   // a quick punch-in with a small rebound
        if (l.time > (l.life || .9)) { releaseLabel(l); labels.splice(i, 1); } }
      for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.time += dt; const k = w.time / w.life; w.m.scale.setScalar(.35 + w.radius * (1 - Math.pow(1 - k, 2))); w.m.material.opacity = w.opacity * (1 - k); if (w.time > w.life) { w.m.removeFromParent(); w.m.geometry.dispose(); w.m.material.dispose(); waves.splice(i, 1); } }
      for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.time += dt; const k = f.time / f.life; f.m.scale.setScalar(f.size * (.7 + k * .6)); f.m.material.opacity = 1 - k * k; if (f.time > f.life) { releaseFlash(f); flashes.splice(i, 1); } }
      if (game) {
        // Roll afterimages exactly while the i-frames last.
        const p = game.player, iframe = !!(p && p.invulnerable && p.dodge > 0 && !p.dead);
        if (iframe && !frozen) { ghostClock -= dt; if (ghostClock <= 0 || !wasIframe) { spawnGhost(p.model, .17, .2); ghostClock = .065; } }
        if (wasIframe && !iframe && p && !p.dead) {   // the roll ends: the body comes down on its feet in a low puff of grit
          const fy = floorAt(p.x, p.z, .4); for (let i = 0; i < scaleCount(10); i++) { const a = Math.random() * Math.PI * 2; emit(p.x + Math.sin(a) * .3, fy + .06, p.z + Math.cos(a) * .3, 2, [.09, .075, .06], Math.sin(a) * rnd(.6, 1.4), rnd(.1, .35), Math.cos(a) * rnd(.6, 1.4), rnd(.45, .7), rnd(.18, .28)); }
        }
        wasIframe = iframe;
        actorTrail(game.player, dt, frozen); for (const e of game.enemies) if (e.model.root.visible || trails.get(e)?.active) actorTrail(e, dt, frozen);
      }
      for (const g of ghosts) {
        if (!g.active) continue; g.time += dt; const k = g.time / g.life;
        g.mat.opacity = g.opacity * Math.max(0, 1 - k) * Math.max(0, 1 - k); if (g.rmat) g.rmat.opacity = g.mat.opacity; if (k >= 1) { g.active = false; g.group.visible = false; }
      }
      if (tells) tells.sync(dt);
      signatureStep(dt); fragmentsStep(dt); scarsStep(dt); cracksStep(dt); whirlStep(dt); roarSpiralStep(dt); streaksStep(dt); goreStep(dt);
    }
    function clear() {
      for (const l of labels) releaseLabel(l); labels.length = 0;
      slots.fill(null); alphas.fill(0); geometry.attributes.aAlpha.needsUpdate = true; particles.visible = false; geometry.setDrawRange(0, 0);
      for (const d of decals) { d.mesh.removeFromParent(); d.mesh.material.dispose(); } decals.length = 0;
      for (const w of waves) { w.m.removeFromParent(); w.m.geometry.dispose(); w.m.material.dispose(); } waves.length = 0;
      for (const f of flashes) releaseFlash(f); flashes.length = 0;
      for (const tr of trails.values()) { while (tr.samples.length) tr.free.push(tr.samples.pop()); tr.active = false; tr.mesh.visible = false; tr.mesh.geometry.setDrawRange(0, 0); }
      for (const g of ghosts) { g.active = false; g.group.visible = false; }
      for (const s of scars) releaseScar(s); scars.length = 0;
      for (const o of skillCrescents) o.m.visible = false; if (levelFx) levelFx.clear(); if (chargeFx) chargeFx.clear(); if (skillFx) skillFx.clear(); if (impactFx) impactFx.clear();
      if (tells) tells.clear(); chainClear();
      fragmentsClear(); goreClear(); gearBlood = 0; gearApply();
    }
    function disposeGhosts() {
      for (const g of ghosts) { for (const sk of g.skeletons.values()) sk.dispose(); g.mat.dispose(); if (g.rmat) g.rmat.dispose(); g.group.removeFromParent(); }
      ghosts.length = 0; ghostSources.clear(); ghostModel = null;
    }
    function disposePools() {
      for (const l of labelPool) { l.m.material.map.dispose(); l.m.material.dispose(); l.m.removeFromParent(); }
      labelPool.length = freeLabels.length = 0;
      for (const f of flashPool) { f.m.material.dispose(); f.m.removeFromParent(); }
      flashPool.clear(); freeFlashes.length = 0;
      for (const [actor, tr] of trails) dropTrail(actor, tr);
      // Compilation copies share most surfaces, but own their instance buffers and the empty trail geometry.
      const shared = new Set([ckMat]), sharedGeometry = new Set([plane]); for (const child of root.children) if (child !== warmGroup) child.traverse(o => { if (o.material) shared.add(o.material); if (o.geometry) sharedGeometry.add(o.geometry); });
      const materials = new Set(), geometries = new Set(); warmGroup.traverse(o => { if (o.material && !shared.has(o.material)) materials.add(o.material); if (o.geometry && !sharedGeometry.has(o.geometry)) geometries.add(o.geometry); if (o.isInstancedMesh) o.dispose(); });
      for (const mat of materials) mat.dispose();
      for (const geo of geometries) geo.dispose();
    }
    // Hidden copies of every material the effects create on demand (blood decals, flashes, labels, scars, blade smears,
    // roll afterimages). app.js compiles them with the rest during loading; they are never disposed, so the programs stay
    // cached while real decals come and go and the first blood of the chapter does not stall a frame.
    const warmGroup = new T.Group(); warmGroup.name = 'fx_warm'; warmGroup.visible = false; root.add(warmGroup);
    function warm() {
      // Allocate common GPU resources while the loading screen is up. Later hits only replace their data.
      while (labelPool.length < 18) makeLabel();
      while (flashPool.size < 16) makeFlash();
      const game = getGame();
      if (game && game.player && game.player.model) {
        prepareGhosts(game.player.model);
        const R = B.app && B.app.renderer;
        if (R && R.initTexture) for (const g of ghosts) { if (g.model !== game.player.model) continue; snapshot(g); for (const sk of g.skeletons.values()) if (sk.boneTexture) R.initTexture(sk.boneTexture); }
        const actors = new Set([game.player, ...game.enemies]);
        for (const [actor, tr] of trails) if (!actors.has(actor) || tr.model !== actor.model) dropTrail(actor, tr);
        for (const actor of actors) if (hasTrail(actor.model) && !trails.has(actor)) makeTrail(actor);
      }
      if (tells) while (scarFree.length + scars.length < 8) scarFree.push(makeScar(tells.textures.scarRadial));
      if (warmGroup.children.length) return;
      const add = o => { o.frustumCulled = false; warmGroup.add(o); };
      for (const map of [bloodMap, sprayMap]) add(new T.Mesh(plane, new T.MeshStandardMaterial({ map, transparent: true, opacity: .86, roughness: .3, metalness: .12, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })));
      add(new T.Sprite(new T.SpriteMaterial({ map: flashMap, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending })));
      add(new T.Mesh(plane, new T.MeshBasicMaterial({ color: '#1a0d0a', map: flashMap, transparent: true, opacity: .6, depthWrite: false })));
      add(new T.Mesh(new T.BufferGeometry(), trailMaterial.clone()));
      const warmLinks=new T.InstancedMesh(chLinks.geometry,chLinks.material,1),warmHeads=new T.Mesh(chHeadGeo,chLinks.material);warmLinks.receiveShadow=warmHeads.receiveShadow=true;add(warmLinks);add(warmHeads); add(new T.Mesh(chDisc.geometry, chDiscMat)); add(new T.Mesh(chFloor.geometry, chFloorMat)); add(new T.Mesh(skGeo, skMesh.material)); add(new T.Mesh(chRings[0].m.geometry, chRings[0].mat)); add(new T.Mesh(chCracks[0].m.geometry, ckMat));
      add(new T.Sprite(new T.SpriteMaterial({ map: softMap, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, fog: false })));
      for (const o of skillCrescents) add(new T.Mesh(plane, o.mat)); if (levelFx) for (const part of levelFx.parts) add(part.points ? new T.Points(part.geo, part.mat) : new T.Mesh(part.geo, part.mat)); if (chargeFx) for (const part of chargeFx.parts) add(new T.Mesh(part.geo, part.mat));
      if (skillFx) for (const obj of skillFx.warmObjects()) add(obj);
      if (impactFx) for (const obj of impactFx.warmObjects()) add(obj);
      for (const pool of chipPools) { const mesh = new T.InstancedMesh(chipGeo, pool.mat, 1); mesh.setColorAt(0, chipTint.setRGB(.3, .27, .23)); mesh.receiveShadow = true; add(mesh); }
      add(new T.InstancedMesh(gdGeo, gdMat, 1)); add(new T.Mesh(bsGeo, bsMat)); add(new T.InstancedMesh(chGeoG, gcMat, 1));
    }
    const api = { burst, update, clear, tells, warm, gore, debug: () => ({ pri: gdPri.length, walls: gdPri.concat(gdMic).filter(d => d.rx === 0).length, prints: gdMic.filter(d => d.cell === 3).length, p0: gdMic.filter(d => d.cell === 3).map(d => [+d.x.toFixed(2), +d.z.toFixed(2), +d.a0.toFixed(2)]), mic: gdMic.length, count: gdMesh.count, streaks: bsLive, gibs: gibs.length }), dispose() { if (B.Effects.current === api) B.Effects.current = null; clear(); for (const o of skillCrescents) o.mat.dispose(); if (levelFx) levelFx.dispose(); if (chargeFx) chargeFx.dispose(); if (skillFx) skillFx.dispose(); bsGeo.dispose(); bsMat.dispose(); gdGeo.dispose(); gdMat.dispose(); goreAtlas.dispose(); chGeoG.dispose(); gcMat.dispose(); gcMesh.dispose(); gdMesh.dispose(); for (const s of scarFree) { s.dark.dispose(); s.hot.dispose(); } scarFree.length = 0; if (tells) tells.dispose(); disposeGhosts(); disposePools(); for (const pool of chipPools) pool.mesh.dispose(); chipGeo.dispose(); chipStoneMat.dispose(); chipMetalMat.dispose(); root.removeFromParent(); geometry.dispose(); material.dispose(); trailMaterial.dispose(); chLinks.geometry.dispose(); chLinks.material.dispose(); chLinks.dispose(); for (const s of chGlow) s.material.dispose(); chHeadGeo.dispose(); chDisc.geometry.dispose(); chDiscMat.dispose(); chFloor.geometry.dispose(); chFloorMat.dispose(); skGeo.dispose(); skMesh.material.dispose(); for (const c of chCracks) { c.m.geometry.dispose(); c.m.material.dispose(); } ckMat.dispose(); for (const r of chRings) { r.m.geometry.dispose(); r.mat.dispose(); } softMap.dispose(); bloodMap.dispose(); sprayMap.dispose(); flashMap.dispose(); plane.dispose(); } };
    B.Effects.current = api; return api;
  },
  // Same call for code that does not hold the instance (dismemberment): B.Effects.gore('stump', x, y, z, dirX, dirZ, strength).
  gore(kind, x, y, z, dx, dz, s) { if (B.Effects.current) B.Effects.current.gore(kind, x, y, z, dx, dz, s); } };
})();
