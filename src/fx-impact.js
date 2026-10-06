/* KABİR AZABI — cinematic impact layer shared by the hero's skills (skill-fx.js, charge.js, effects.js).
   Everything is pooled and made once; nothing is created or compiled at cast time (warmObjects() goes through effects.js warm()).
     dome(x, z, o)    a vertical shock wall: an open cylinder that bursts up out of the floor, races outward and sinks (volume for ground impacts)
                      o: { r (final radius m), h (height m), life, col [r,g,b] edge, hot [r,g,b] core, a, delay, seed }
     pillar(x, z, o)  a vertical blade of light that drops from above and thins out (Kemik Kıran's verdict, Mahşer's landing)
                      o: { h, w, life, col, hot, a, delay }
     plume(x, z, o)   a column of heavy smoke and ash that rolls up from an impact (effects.js particles, kind 2)
     hitFlash(enemy, o) the struck body flares for a few frames: additive copies of the enemy's own skinned meshes that share its skeleton
                      (8 pooled materials, so at most 8 bodies flash at once; overlays are built once per model and only drawn while flashing)
                      o: { col [r,g,b], a (peak), life }
     skillTint(id)    the flash colour of each skill line / tier (identity colour of the ability)
   Contract: B.FxImpact.createWorld(opts) -> instance (also B.FxImpact.active) with the calls above + step(dt), clear(), warmObjects(), dispose().
   Reduced motion (prefers-reduced-motion / ?lvcalm): domes and pillars at half strength, no flashes on bodies. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const qaCalm = typeof location !== 'undefined' && /[?&]lvcalm(&|$)/.test(location.search);
  const calm = () => qaCalm || mq.matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  // Shock wall: ragged top edge (two value-noise octaves around the ring), bright foot where it tears out of the floor, hot core early, edge colour later.
  const WALL_FS = `varying vec2 vUv;uniform float uK,uA,uSeed;uniform vec3 uCol,uHot;
    float h(float n){return fract(sin(n*91.7+uSeed*13.1)*43758.5453);}
    float vn(float x){float c=floor(x),f=fract(x);return mix(h(c),h(c+1.),f*f*(3.-2.*f));}
    void main(){float u=vUv.x;float n=vn(u*46.)*.55+vn(u*13.+20.)*.45;float y=vUv.y;
      float top=.30+.70*n;float body=pow(max(0.,1.-y/top),1.7)*smoothstep(0.,.03,y);
      float streak=.65+.35*vn(u*90.+uK*6.);float foot=exp(-pow(y/.07,2.));
      float life=pow(1.-uK,1.6)*smoothstep(0.,.05,uK);
      float a=(body*streak+foot*.55)*life*uA;if(a<.004)discard;
      vec3 col=mix(uCol,uHot,clamp(body*1.3*(1.-uK*1.6),0.,1.));gl_FragColor=vec4(col*a,1.);}`;
  // Light blade: a thin hot core with a soft halo; it falls from the top (uDrop) and then thins and fades.
  const PILLAR_FS = `varying vec2 vUv;uniform float uK,uA,uDrop;uniform vec3 uCol,uHot;
    void main(){float x=(vUv.x-.5)*2.,y=vUv.y;float w=mix(.16,.035,uK);
      float core=exp(-x*x/(w*w*.18)),halo=exp(-x*x/(w*w*2.6));
      float front=1.-uDrop;float on=smoothstep(front-.02,front+.06,y);float head=exp(-pow((y-front)/.05,2.))*(1.-uK);
      float v=pow(1.-y,.55)*smoothstep(0.,.03,y);float life=pow(1.-uK,1.3);
      float a=((core*1.2+halo*.45)*v*on+head*core*1.6)*life*uA;if(a<.004)discard;
      vec3 col=mix(uCol,uHot,clamp(core*1.4,0.,1.));gl_FragColor=vec4(col*a,1.);}`;

  function createWorld(o) {
    const T = o.T, root = o.root, emit = o.emit, scaleCount = o.scaleCount || (n => n);
    const floorAt = (x, z, r) => { const w = B.app && B.app.world; return w && w.effectHeightAt ? w.effectHeightAt(x, z, r || 0) : .055; };
    // ---------------------------------------------------------------- shock walls (pool 6)
    const wallGeo = new T.CylinderGeometry(1, 1, 1, 56, 1, true).translate(0, .5, 0);
    const wallBase = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false,
      uniforms: { uK: { value: 1 }, uA: { value: 1 }, uSeed: { value: 0 }, uCol: { value: new T.Vector3(1, .4, .1) }, uHot: { value: new T.Vector3(2, 1.6, 1.2) } }, vertexShader: VS, fragmentShader: WALL_FS });
    const walls = Array.from({ length: 6 }, () => { const mat = wallBase.clone(), m = new T.Mesh(wallGeo, mat); m.frustumCulled = false; m.visible = false; m.renderOrder = 4; root.add(m); return { m, mat, t: 9, life: 1, r: 1, h: 1 }; });
    function dome(x, z, d) {
      const w = walls.find(q => q.t >= q.life && !q.m.visible) || walls.reduce((a, b) => (b.t / b.life > a.t / a.life ? b : a));
      const u = w.mat.uniforms, k = calm() ? .5 : 1, col = d.col || [1, .4, .1], hot = d.hot || [2, 1.6, 1.2];
      w.t = -(d.delay || 0); w.life = d.life || .5; w.r = d.r || 3; w.h = d.h || 1.4; w.m.visible = false;
      w.m.position.set(x, floorAt(x, z, w.r) - .02, z); w.m.rotation.y = Math.random() * 6.283;
      u.uK.value = 0; u.uA.value = (d.a == null ? 1 : d.a) * k; u.uSeed.value = d.seed == null ? Math.random() * 50 : d.seed;
      u.uCol.value.set(col[0], col[1], col[2]); u.uHot.value.set(hot[0], hot[1], hot[2]);
    }
    // ---------------------------------------------------------------- light blades (pool 4): two crossed vertical quads
    const bladeGeo = (() => {
      const a = new T.PlaneGeometry(1, 1).translate(0, .5, 0), b = a.clone().rotateY(Math.PI / 2), g = new T.BufferGeometry();
      const pa = a.attributes.position.array, pb = b.attributes.position.array, ua = a.attributes.uv.array, ub = a.attributes.uv.array;
      const pos = new Float32Array(pa.length + pb.length); pos.set(pa); pos.set(pb, pa.length);
      const uv = new Float32Array(ua.length * 2); uv.set(ua); uv.set(ub, ua.length);
      const ia = Array.from(a.index.array), idx = ia.concat(ia.map(i => i + 4));
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      a.dispose(); b.dispose(); return g;
    })();
    const bladeBase = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false,
      uniforms: { uK: { value: 1 }, uA: { value: 1 }, uDrop: { value: 1 }, uCol: { value: new T.Vector3(1, .2, .1) }, uHot: { value: new T.Vector3(2, 1.8, 1.6) } }, vertexShader: VS, fragmentShader: PILLAR_FS });
    const blades = Array.from({ length: 4 }, () => { const mat = bladeBase.clone(), m = new T.Mesh(bladeGeo, mat); m.frustumCulled = false; m.visible = false; m.renderOrder = 6; root.add(m); return { m, mat, t: 9, life: 1, drop: .08 }; });
    function pillar(x, z, d) {
      const p = blades.find(q => q.t >= q.life && !q.m.visible) || blades[0], u = p.mat.uniforms, k = calm() ? .5 : 1, col = d.col || [1, .2, .1], hot = d.hot || [2, 1.8, 1.6];
      p.t = -(d.delay || 0); p.life = d.life || .42; p.drop = d.drop || .07; p.m.visible = false;
      p.m.position.set(x, floorAt(x, z, .5), z); p.m.scale.set(d.w || 1.2, d.h || 7, d.w || 1.2); p.m.rotation.y = d.face || 0;
      u.uK.value = 0; u.uDrop.value = 0; u.uA.value = (d.a == null ? 1 : d.a) * k; u.uCol.value.set(col[0], col[1], col[2]); u.uHot.value.set(hot[0], hot[1], hot[2]);
    }
    // ---------------------------------------------------------------- smoke column
    function plume(x, z, d) {
      if (!emit) return; const n = scaleCount(d.n || 14), r = d.r || .8, c = d.col || [.05, .04, .045], up = d.up || 2.2;
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * r;
        emit(x + Math.sin(a) * rr, .2 + Math.random() * .5, z + Math.cos(a) * rr, 2, c, Math.sin(a) * rnd(.2, .9), up * rnd(.55, 1.15), Math.cos(a) * rnd(.2, .9), rnd(1.1, 1.9), (d.size || .5) * rnd(.8, 1.25)); }
    }
    // ---------------------------------------------------------------- body flashes
    // A rim matcap (dark heart, hot edge): the flash burns along the silhouette and the facing planes only warm a little, so the body keeps its form.
    const rimMap = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, '#2a2a2a'); gr.addColorStop(.55, '#3a3a3a'); gr.addColorStop(.8, '#9a9a9a'); gr.addColorStop(.95, '#ffffff'); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    })();
    const flashSlots = Array.from({ length: 8 }, () => ({ mat: new T.MeshMatcapMaterial({ matcap: rimMap, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }), ov: null, t: 9, life: .16, a: 0 }));
    const overlays = new WeakMap();
    function overlayOf(model) {
      let ov = overlays.get(model); if (ov) return ov;
      const list = [];
      model.root.traverse(n => {
        if (!n.isSkinnedMesh || !n.skeleton || !n.geometry || list.length >= 14) return;
        const mt = n.material; if (!mt || Array.isArray(mt) || mt.isShaderMaterial || mt.blending === T.AdditiveBlending) return;
        const c = new T.SkinnedMesh(n.geometry, flashSlots[0].mat); c.bind(n.skeleton, n.bindMatrix); c.bindMode = n.bindMode;
        c.matrixAutoUpdate = false; c.frustumCulled = false; c.renderOrder = 7; c.visible = false; c.castShadow = c.receiveShadow = false; c.name = 'fx_hitflash';
        root.add(c); list.push({ c, src: n });
      });
      ov = { list, model, slot: null }; overlays.set(model, ov); return ov;
    }
    function shown(n, top) { for (let p = n; p; p = p.parent) { if (!p.visible) return false; if (p === top) return true; } return true; }
    function hitFlash(enemy, d) {
      if (calm() || !enemy || !enemy.model || !enemy.model.root) return;
      const ov = overlayOf(enemy.model); if (!ov.list.length) return;
      let s = ov.slot; if (!s) { s = flashSlots.find(q => !q.ov) || null; if (!s) return; s.ov = ov; ov.slot = s; for (const it of ov.list) it.c.material = s.mat; }
      const col = (d && d.col) || [1, .82, .66], a = d && d.a != null ? d.a : .55;
      const left = s.t < s.life ? s.a * Math.pow(1 - s.t / s.life, 2) : 0;
      s.t = 0; s.life = (d && d.life) || .16; s.a = Math.max(a, left); s.mat.color.setRGB(col[0], col[1], col[2]); s.mat.opacity = s.a;
    }
    function releaseSlot(s) { if (s.ov) { for (const it of s.ov.list) it.c.visible = false; s.ov.slot = null; } s.ov = null; s.t = 9; s.mat.opacity = 0; }
    // Identity colours for the body flash (and the default edge of their impact walls).
    const TINT = { cleave: [1.05, .45, .2], brand: [1.25, .3, .2], temper: [.85, .32, 1.15], roar: [1.1, .55, .22], quake: [1.05, .9, .7], chainstorm: [1.1, .4, .45],
      whirl: [1.05, .6, .28], reap: [.6, .75, 1.35], rend: [.85, .42, 1.35], charge: [1.25, .55, .2], grasp: [1.25, .78, .3], havoc: [.8, .38, 1.35] };
    const skillTint = id => TINT[id] || null;
    // ---------------------------------------------------------------- per frame
    function step(dt) {
      for (const w of walls) {
        if (w.t >= w.life) continue; w.t += dt; if (w.t < 0) continue;
        const k = clamp(w.t / w.life, 0, 1), e = 1 - Math.pow(1 - k, 2.6), rise = Math.sin(Math.min(1, k * 3.2) * Math.PI / 2) * (1 - .55 * k);
        w.m.visible = k < 1; w.mat.uniforms.uK.value = k; const r = w.r * (.12 + .88 * e); w.m.scale.set(r, Math.max(.01, w.h * rise), r);
      }
      for (const p of blades) {
        if (p.t >= p.life) continue; p.t += dt; if (p.t < 0) continue;
        const k = clamp(p.t / p.life, 0, 1); p.m.visible = k < 1; p.mat.uniforms.uK.value = k; p.mat.uniforms.uDrop.value = clamp(p.t / p.drop, 0, 1);
      }
      for (const s of flashSlots) {
        if (!s.ov) continue; s.t += dt; const k = s.t / s.life;
        const e = s.ov.model.root, dead = !e.parent;
        if (k >= 1 || dead) { releaseSlot(s); continue; }
        s.mat.opacity = s.a * Math.pow(1 - k, 2);
        for (const it of s.ov.list) { const vis = shown(it.src, e); it.c.visible = vis; if (vis) it.c.matrix.copy(it.src.matrixWorld); }
      }
    }
    function clear() {
      for (const w of walls) { w.t = 9; w.m.visible = false; } for (const p of blades) { p.t = 9; p.m.visible = false; }
      for (const s of flashSlots) releaseSlot(s);
    }
    function warmObjects() {
      const out = [new T.Mesh(wallGeo, walls[0].mat), new T.Mesh(bladeGeo, blades[0].mat)];
      // The body flash program (skinned matcap, additive) is compiled during loading on a hidden copy of the hero's body.
      const g = o.getGame && o.getGame(), m = g && g.player && g.player.model;
      if (m) { let src = null; m.root.traverse(n => { if (!src && n.isSkinnedMesh && n.skeleton) src = n; }); if (src) { const c = new T.SkinnedMesh(src.geometry, flashSlots[0].mat); c.bind(src.skeleton, src.bindMatrix); out.push(c); } }
      return out;
    }
    function dispose() {
      clear(); for (const w of walls) { w.m.removeFromParent(); w.mat.dispose(); } for (const p of blades) { p.m.removeFromParent(); p.mat.dispose(); }
      wallBase.dispose(); bladeBase.dispose(); wallGeo.dispose(); bladeGeo.dispose(); for (const s of flashSlots) s.mat.dispose(); rimMap.dispose();
      const drop = []; root.traverse(n => { if (n.name === 'fx_hitflash') drop.push(n); }); for (const n of drop) n.removeFromParent();
      if (B.FxImpact.active === inst) B.FxImpact.active = null;
    }
    const inst = { dome, pillar, plume, hitFlash, skillTint, step, clear, warmObjects, dispose };
    B.FxImpact.active = inst;
    return inst;
  }
  B.FxImpact = { createWorld, active: null };
})();
