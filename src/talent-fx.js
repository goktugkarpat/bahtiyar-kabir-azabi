/* KABİR AZABI — look of talent tree 3 (all procedural, no textures):
   - burning ground (Kor Mührü seal, Kül Fırtınası ring, Kor İzi trail, Kor Ağzı crescent): one shader quad per zone (pool of 10)
   - status on foes: burn embers, bleed drops, rot motes + green sigil under the feet, dread wisps: ONE shared Points cloud (900)
   - bursts / bell waves: pooled expanding ring quads (10); Ölüm Çanı: a ghostly lathe bell over the hero; chains: link motes
   Draw calls: 1 points + visible zones + visible rings + bell. Nothing is allocated per frame.
   API (talent-runtime.js): create(root, groundY) -> { zone(z), unzone(z), mark(e, kind), unmark(e, kind), clear(e), burst(x, z, r, kind),
     bell(player, radius), chains(player, foes), drain(e, player), update(dt, status, hearthPlayer), reset(), dispose() } */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const COLORS = { fire: [1.45, .3, .04], blood: [1.5, .08, .05], rot: [.4, 1.0, .22], dread: [.55, .2, 1.0], bone: [1.4, 1.3, 1.05] };
  const ZONE_VS = 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  // kind 0: seal (rune circle), 1: ring, 2: trail (uv.x along, uv.y across), 3: crescent (front arc)
  const ZONE_FS = [
    'varying vec2 vUv; uniform float uTime, uFade, uKind, uArc, uSeed; uniform vec3 uColor;',
    'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }',
    'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = .5; for (int i = 0; i < 4; i++) { v += a * n(p); p *= 2.03; a *= .5; } return v; }',
    'void main(){',
    '  vec2 p = vUv; float r = length(p), a = atan(p.x, p.y), m = 0.0, core = 0.0;',
    '  float flick = fbm(p * 3.5 + vec2(0.0, -uTime * 1.6)), crack = smoothstep(.62, .7, fbm(p * 6.0 + uSeed));',
    '  if (uKind < .5) {',
    '    float rim = smoothstep(.05, 0.0, abs(r - .92)) + .6 * smoothstep(.035, 0.0, abs(r - .74));',
    '    float spokes = smoothstep(.05, 0.0, abs(sin(a * 4.0 + uTime * .4))) * step(.3, r) * step(r, .74);',
    '    float runes = step(.78, r) * step(r, .88) * step(.55, fract(a * 5.09 + uTime * .15)) * step(fract(a * 20.3), .7);',
    '    float tri = smoothstep(.03, 0.0, abs(r * cos(mod(a + uTime * .25, 2.094) - 1.047) - .38));',
    '    float embers = smoothstep(.52, .8, fbm(p * 7.0 + vec2(uTime * .3, -uTime * .5)));',
    '    m = (rim * .9 + spokes * .5 + runes * .75 + tri * .7) * (.7 + .5 * flick); core = (1.0 - smoothstep(.1, 1.0, r)) * embers * .9 + (1.0 - smoothstep(0.0, .95, r)) * .05;',
    '    m *= step(r, 1.0); core *= step(r, 1.0);',
    '  } else if (uKind < 1.5) {',
    '    float band = smoothstep(.16, 0.0, abs(r - .84)); float lick = smoothstep(.4, .75, fbm(vec2(a * 3.0, r * 4.0 - uTime * 1.8)));',
    '    m = band * lick * 1.1 + smoothstep(.025, 0.0, abs(r - .96)) * .45 * (.5 + flick); core = band * lick * .5;',
    '  } else if (uKind < 2.5) {',
    '    float edge = 1.0 - smoothstep(.55, 1.0, abs(p.y)); float along = 1.0 - smoothstep(.85, 1.0, abs(p.x));',
    '    float f = smoothstep(.4, .8, fbm(vec2(p.x * 7.0 - uTime * .7, p.y * 2.5 - uTime * 1.3))); m = edge * along * (.1 + f * .9); core = edge * along * f * .5;',
    '  } else {',
    '    float d = abs(atan(sin(a), cos(a))); float arc = 1.0 - smoothstep(uArc * .78, uArc, d);',
    '    float band = smoothstep(.3, .0, abs(r - .72)) * step(r, 1.0); float f = smoothstep(.4, .8, fbm(p * 5.0 + vec2(0.0, -uTime * 1.4))); m = arc * band * (.12 + f); core = arc * band * f * .5;',
    '  }',
    '  float ash = crack * step(r, 1.0) * (uKind > 1.5 && uKind < 2.5 ? 0.0 : .6);',
    '  vec3 hot = mix(uColor, vec3(1.7, .7, .2), clamp(core, 0.0, 1.0));',
    '  float alpha = clamp(m * .55 + core * .5 + ash * core * .3, 0.0, 1.2) * uFade;',
    '  gl_FragColor = vec4(hot * alpha, alpha);',
    '}'].join('\n');
  const RING_FS = [
    'varying vec2 vUv; uniform float uK, uFade; uniform vec3 uColor;',
    'void main(){ float r = length(vUv); float w = mix(.16, .04, uK); float band = smoothstep(w, 0.0, abs(r - mix(.25, .98, uK)));',
    '  float inner = (1.0 - smoothstep(0.0, mix(.25, .98, uK), r)) * .1 * (1.0 - uK);',
    '  float a = (band + inner) * uFade * step(r, 1.0) * .55; gl_FragColor = vec4(uColor * a, a); }'].join('\n');
  const PT_VS = [
    'attribute float aSize; attribute vec4 aColor; varying vec4 vColor;',
    'void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }'].join('\n');
  const PT_FS = 'varying vec4 vColor; void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float d = dot(c, c); if (d > 1.0) discard; float a = (1.0 - d) * (1.0 - d) * vColor.a; gl_FragColor = vec4(vColor.rgb * a, a); }';

  function create(root, groundY) {
    const T = THREE, gy = (x, z) => { try { return groundY ? groundY(x, z) : .06; } catch (_) { return .06; } };
    const group = new T.Group(); group.name = 'TalentFX'; root.add(group);
    const quad = new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const blend = { transparent: true, depthWrite: false, blending: T.AdditiveBlending, premultipliedAlpha: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    // ---- zones
    const zonePool = [];
    for (let i = 0; i < 10; i++) {
      const mat = new T.ShaderMaterial(Object.assign({ vertexShader: ZONE_VS, fragmentShader: ZONE_FS,
        uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uKind: { value: 0 }, uArc: { value: 1.3 }, uSeed: { value: i * 1.7 }, uColor: { value: new T.Vector3(...COLORS.fire) } } }, blend));
      const m = new T.Mesh(quad, mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 3; group.add(m);
      zonePool.push({ m, mat, z: null, age: 0 });
    }
    // ---- rings
    const ringPool = [];
    for (let i = 0; i < 10; i++) {
      const mat = new T.ShaderMaterial(Object.assign({ vertexShader: ZONE_VS, fragmentShader: RING_FS, uniforms: { uK: { value: 0 }, uFade: { value: 0 }, uColor: { value: new T.Vector3(1, 1, 1) } } }, blend));
      const m = new T.Mesh(quad, mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 4; group.add(m);
      ringPool.push({ m, mat, t: 1, life: 1, r: 1, y: 0 });
    }
    function ring(x, z, r, color, life, y) {
      const o = ringPool.find(q => !q.m.visible) || ringPool.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
      o.t = 0; o.life = life || .5; o.r = r; o.y = y || 0; o.m.position.set(x, gy(x, z) + .05 + (y || 0), z); o.m.scale.set(r, 1, r);
      o.mat.uniforms.uColor.value.set(color[0], color[1], color[2]); o.m.visible = true;
    }
    // ---- bell (Ölüm Çanı)
    const pts = [], H = 1.25; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(new T.Vector2(.18 + .62 * Math.pow(u, 1.6) + (u > .92 ? (u - .92) * 2.2 : 0), H * (1 - u))); }
    const bellMat = new T.MeshBasicMaterial({ color: new T.Color(.35, .62, .3), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, wireframe: false });
    const bell = new T.Mesh(new T.LatheGeometry(pts, 20), bellMat); bell.visible = false; bell.renderOrder = 5; group.add(bell);
    const bellWire = new T.LineSegments(new T.EdgesGeometry(bell.geometry, 25), new T.LineBasicMaterial({ color: new T.Color(.85, 1, .7), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    bell.add(bellWire);
    let bellT = 9, bellOwner = null, bellR = 7;
    // ---- particles
    const MAX = 900, pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 4), size = new Float32Array(MAX);
    const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), age = new Float32Array(MAX), base = new Float32Array(MAX * 4), grav = new Float32Array(MAX), size0 = new Float32Array(MAX);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('aColor', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('aSize', new T.BufferAttribute(size, 1).setUsage(T.DynamicDrawUsage));
    const points = new T.Points(geo, new T.ShaderMaterial({ vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    points.frustumCulled = false; points.renderOrder = 6; group.add(points);
    let cursor = 0, liveCount = 0;
    for (let i = 0; i < MAX; i++) life[i] = 0;
    function spark(x, y, z, vx, vy, vz, c, l, s, g) {
      const i = cursor; cursor = (cursor + 1) % MAX;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      base[i * 4] = c[0]; base[i * 4 + 1] = c[1]; base[i * 4 + 2] = c[2]; base[i * 4 + 3] = 1;
      life[i] = l; age[i] = 0; size0[i] = s; grav[i] = g || 0;
    }
    const rnd = (a, b) => a + Math.random() * (b - a);
    // ---- marks on foes
    const marks = new Map();   // enemy -> { burn, bleed, rot, dread, acc, sigil }
    const sigilPool = [];
    for (let i = 0; i < 14; i++) {
      const mat = new T.ShaderMaterial(Object.assign({ vertexShader: ZONE_VS, fragmentShader: ZONE_FS, uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uKind: { value: 0 }, uArc: { value: 1 }, uSeed: { value: 3 + i }, uColor: { value: new T.Vector3(...COLORS.rot) } } }, blend));
      const m = new T.Mesh(quad, mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 3; group.add(m); sigilPool.push({ m, mat, owner: null });
    }
    function markOf(e) { let m = marks.get(e); if (!m) { m = { burn: false, bleed: false, rot: false, dread: false, acc: 0, sigil: null, t: 0 }; marks.set(e, m); } return m; }
    function mark(e, kind) {
      const m = markOf(e), fresh = !m[kind]; m[kind] = true;
      if ((kind === 'rot' || kind === 'dread') && !m.sigil) { const s = sigilPool.find(q => !q.owner); if (s) { s.owner = e; m.sigil = s; s.m.visible = true; } }
      if (m.sigil) m.sigil.mat.uniforms.uColor.value.set(...(m.rot ? COLORS.rot : COLORS.dread));
      if (fresh) {
        const y = (e.model && e.model.root.position.y) || 0, c = COLORS[kind === 'burn' ? 'fire' : kind];
        for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283; spark(e.x + Math.sin(a) * .3, y + rnd(.6, 1.6), e.z + Math.cos(a) * .3, Math.sin(a) * rnd(.5, 1.6), rnd(.4, 1.8), Math.cos(a) * rnd(.5, 1.6), c, rnd(.35, .6), rnd(.08, .14), kind === 'bleed' ? -6 : 0); }
      }
    }
    function freeSigil(m) { if (m.sigil) { m.sigil.owner = null; m.sigil.m.visible = false; m.sigil = null; } }
    function unmark(e, kind) { const m = marks.get(e); if (!m) return; m[kind] = false; if (!m.rot && !m.dread) freeSigil(m); }
    function clear(e) { const m = marks.get(e); if (m) { freeSigil(m); marks.delete(e); } }
    // ---- zones
    function zone(z) {
      const o = zonePool.find(q => !q.z) || zonePool[0];
      o.z = z; o.age = 0; z.view = o; const u = o.mat.uniforms;
      u.uKind.value = z.kind === 'seal' ? 0 : z.kind === 'ring' ? 1 : z.kind === 'trail' ? 2 : 3; u.uSeed.value = Math.random() * 9;
      u.uColor.value.set(...COLORS.fire); u.uArc.value = 1.3;
      if (z.kind === 'trail') {
        const dx = z.x2 - z.x, dz = z.z2 - z.z, len = Math.max(1, Math.hypot(dx, dz));
        o.m.position.set((z.x + z.x2) / 2, gy((z.x + z.x2) / 2, (z.z + z.z2) / 2) + .04, (z.z + z.z2) / 2);
        o.m.rotation.set(0, Math.atan2(dx, dz) + Math.PI / 2, 0); o.m.scale.set(len / 2 + .4, 1, z.w / 2);
      } else {
        o.m.position.set(z.x, gy(z.x, z.z) + .04, z.z); o.m.rotation.set(0, z.kind === 'crescent' ? z.face : Math.random() * 6.283, 0);
        if (z.kind === 'crescent') o.m.rotation.y = 0;
        o.m.scale.set(z.r, 1, z.r);
      }
      if (z.kind === 'crescent') { u.uArc.value = 1.25; o.m.rotation.y = z.face; }
      o.m.visible = true;
      // the seal is cut with a flash: a hot ring and a fountain of sparks
      if (z.kind === 'seal') { ring(z.x, z.z, z.r * 1.15, [2.6, .9, .25], .45); for (let i = 0; i < 46; i++) { const a = Math.random() * 6.283, r = Math.random() * z.r; spark(z.x + Math.sin(a) * r, gy(z.x, z.z) + .1, z.z + Math.cos(a) * r, Math.sin(a) * rnd(.2, 1.4), rnd(2.5, 6), Math.cos(a) * rnd(.2, 1.4), i % 3 ? COLORS.fire : [2.8, 1.8, .7], rnd(.5, 1.1), rnd(.09, .2), -5); } }
    }
    function unzone(z) { if (z.view && z.view.z === z) { z.view.fading = .35; } }
    // ---- bursts / bell / chains
    function burst(x, z, r, kind) {
      const c = COLORS[kind] || COLORS.fire, y = gy(x, z);
      ring(x, z, r, c, kind === 'dread' ? .7 : .45);
      if (kind === 'fire' || kind === 'rot') ring(x, z, r * .6, kind === 'fire' ? [2.8, 1.6, .5] : [1, 1.6, .6], .3);
      const n = kind === 'blood' ? 26 : 40;
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rnd(1.5, 4.5) * Math.min(1.6, r / 2.5);
        spark(x + Math.sin(a) * .4, y + rnd(.2, 1.1), z + Math.cos(a) * .4, Math.sin(a) * s, rnd(.6, kind === 'rot' ? 2.4 : 4), Math.cos(a) * s, i % 4 ? c : COLORS.bone, rnd(.4, .9), rnd(.1, kind === 'rot' ? .26 : .18), kind === 'blood' ? -9 : kind === 'fire' ? -3 : -.5); }
    }
    function bellAt(p, radius) {
      bellT = 0; bellOwner = p; bellR = radius; bell.visible = true;
      for (let k = 0; k < 3; k++) setTimeout(() => { if (bellOwner) ring(bellOwner.x, bellOwner.z, bellR * (.75 + k * .14), k === 1 ? COLORS.bone : COLORS.rot, .75 + k * .1); }, 280 + k * 170);
    }
    function chains(p, foes) {
      const y0 = gy(p.x, p.z) + 1;
      for (const e of foes) {
        const d = Math.hypot(e.x - p.x, e.z - p.z), n = Math.min(26, Math.ceil(d * 4));
        for (let i = 0; i <= n; i++) { const u = i / n; spark(p.x + (e.x - p.x) * u, y0 + Math.sin(u * Math.PI) * .35, p.z + (e.z - p.z) * u, (p.x - e.x) * .9, 0, (p.z - e.z) * .9, i % 2 ? [1.1, 1.15, 1.25] : [1.6, .35, .2], .28, .11, 0); }
      }
      ring(p.x, p.z, 5, [1.2, 1.25, 1.4], .4);
    }
    function drain(e, p) {
      const y = (e.model && e.model.root.position.y) || 0;
      for (let i = 0; i < 14; i++) spark(e.x + rnd(-.3, .3), y + rnd(.6, 1.5), e.z + rnd(-.3, .3), (p.x - e.x) * 1.6, rnd(.5, 1.5), (p.z - e.z) * 1.6, [1.6, .25, .2], .6, .13, 0);
    }
    // ---- frame
    let time = 0;
    function update(dt, status, hearthPlayer) {
      time += dt;
      for (const o of zonePool) {
        if (!o.z) continue;
        o.age += dt; const u = o.mat.uniforms, z = o.z;
        u.uTime.value = time;
        if (o.fading !== undefined) { o.fading -= dt; u.uFade.value = Math.max(0, o.fading / .35) * .9; if (o.fading <= 0) { o.fading = undefined; o.z = null; o.m.visible = false; } continue; }
        u.uFade.value = Math.min(1, o.age / .18) * (z.life < .6 ? .55 + .45 * z.life / .6 : 1);
        // flames licking up from the burning ground
        const rate = z.kind === 'trail' ? 26 : z.kind === 'seal' ? 34 : 22;
        let n = rate * dt; while (n > 0) { if (n < 1 && Math.random() > n) break; n--;
          let x, zz;
          if (z.kind === 'trail') { const k = Math.random(); x = z.x + (z.x2 - z.x) * k + rnd(-z.w / 3, z.w / 3); zz = z.z + (z.z2 - z.z) * k + rnd(-z.w / 3, z.w / 3); }
          else { const a = z.kind === 'crescent' ? z.face + rnd(-1.2, 1.2) : Math.random() * 6.283, r = z.kind === 'ring' ? z.r * rnd(.7, .95) : z.r * Math.sqrt(Math.random()) * .95; x = z.x + Math.sin(a) * r; zz = z.z + Math.cos(a) * r; }
          spark(x, gy(x, zz) + .08, zz, rnd(-.2, .2), rnd(1.2, 2.8), rnd(-.2, .2), Math.random() < .3 ? [2.8, 1.6, .5] : COLORS.fire, rnd(.45, .9), rnd(.1, .22), .6);
        }
      }
      if (hearthPlayer && Math.random() < dt * 14) spark(hearthPlayer.x + rnd(-.4, .4), gy(hearthPlayer.x, hearthPlayer.z) + rnd(.3, 1.4), hearthPlayer.z + rnd(-.4, .4), 0, rnd(.6, 1.2), 0, [2.2, 1.2, .4], .6, .1, 0);
      for (const o of ringPool) {
        if (!o.m.visible) continue;
        o.t += dt; const k = Math.min(1, o.t / o.life); o.mat.uniforms.uK.value = k; o.mat.uniforms.uFade.value = (1 - k) * 1.2;
        if (k >= 1) o.m.visible = false;
      }
      // status emitters
      for (const [e, m] of marks) {
        if (e.dead || !e.model || !e.model.root.visible) { if (e.dead) clear(e); continue; }
        const y = e.model.root.position.y || 0, h = (e.model.height || 2) * (e.boss ? .7 : 1);
        m.acc += dt;
        if (m.burn && Math.random() < dt * 30) { const a = Math.random() * 6.283, r = (e.radius || .5) * .8; spark(e.x + Math.sin(a) * r, y + rnd(.2, h * .8), e.z + Math.cos(a) * r, rnd(-.2, .2), rnd(1.2, 2.6), rnd(-.2, .2), Math.random() < .35 ? [2.8, 1.5, .4] : COLORS.fire, rnd(.3, .6), rnd(.09, .18), .8); }
        if (m.bleed && Math.random() < dt * 14) { const a = Math.random() * 6.283; spark(e.x + Math.sin(a) * .3, y + rnd(.8, h * .7), e.z + Math.cos(a) * .3, Math.sin(a) * .3, rnd(.2, .8), Math.cos(a) * .3, COLORS.blood, rnd(.4, .7), rnd(.07, .12), -9); }
        if (m.rot && Math.random() < dt * 12) { const a = time * 2 + Math.random() * 6.283; spark(e.x + Math.sin(a) * .55, y + rnd(.3, h), e.z + Math.cos(a) * .55, Math.cos(a) * .4, rnd(.3, .7), -Math.sin(a) * .4, Math.random() < .3 ? COLORS.bone : COLORS.rot, rnd(.6, 1), rnd(.1, .2), .2); }
        if (m.dread && Math.random() < dt * 10) spark(e.x + rnd(-.4, .4), y + h * rnd(.8, 1.1), e.z + rnd(-.4, .4), 0, rnd(.3, .8), 0, COLORS.dread, .8, rnd(.12, .22), 0);
        if (m.sigil) { const s = m.sigil; s.m.position.set(e.x, gy(e.x, e.z) + .05, e.z); const r = (e.radius || .5) + .55; s.m.scale.set(r, 1, r); s.m.rotation.y = time * .8; s.mat.uniforms.uTime.value = time; s.mat.uniforms.uFade.value = .55 + .25 * Math.sin(time * 5); }
      }
      // bell
      if (bell.visible) {
        bellT += dt; const k = bellT / 1.3, p = bellOwner;
        if (k >= 1 || !p) { bell.visible = false; bellOwner = null; }
        else {
          const fade = Math.min(1, k * 6) * (1 - Math.max(0, (k - .6) / .4));
          bell.position.set(p.x, gy(p.x, p.z) + 2.6 + k * .5, p.z); bell.rotation.z = Math.sin(bellT * 11) * .32 * (1 - k); bell.rotation.y = bellT * .5;
          bell.scale.setScalar(.9 + .25 * Math.sin(Math.min(1, k * 3) * Math.PI / 2));
          bellMat.opacity = .38 * fade; bellWire.material.opacity = .7 * fade;
          if (Math.random() < dt * 40) { const a = Math.random() * 6.283; spark(p.x + Math.sin(a) * .7, bell.position.y - .2, p.z + Math.cos(a) * .7, Math.sin(a) * 1.4, -rnd(.3, 1.2), Math.cos(a) * 1.4, Math.random() < .5 ? COLORS.rot : COLORS.bone, .7, .14, -1); }
        }
      }
      // particles
      liveCount = 0;
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
        age[i] += dt; const k = age[i] / life[i];
        if (k >= 1) { life[i] = 0; size[i] = 0; col[i * 4 + 3] = 0; continue; }
        liveCount++;
        vel[i * 3 + 1] += grav[i] * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const fade = k < .15 ? k / .15 : 1 - (k - .15) / .85;
        col[i * 4] = base[i * 4]; col[i * 4 + 1] = base[i * 4 + 1] * (1 - k * .4); col[i * 4 + 2] = base[i * 4 + 2] * (1 - k * .6); col[i * 4 + 3] = fade;
        size[i] = size0[i] * (1 - k * .5) * 6.5;
      }
      points.visible = liveCount > 0;
      if (points.visible) { geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; }
    }
    function reset() {
      for (const o of zonePool) { o.z = null; o.fading = undefined; o.m.visible = false; }
      for (const o of ringPool) o.m.visible = false;
      for (const [e] of marks) clear(e);
      for (let i = 0; i < MAX; i++) life[i] = 0;
      bell.visible = false; bellOwner = null;
    }
    function dispose() {
      reset(); root.remove(group);
      group.traverse(o => { if (o.geometry && o.geometry !== quad) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      quad.dispose();
    }
    return { zone, unzone, mark, unmark, clear, burst, bell: bellAt, chains, drain, update, reset, dispose, debug: () => ({ live: liveCount, zones: zonePool.filter(o => o.z).length, marks: marks.size }) };
  }
  B.TalentFX = Object.freeze({ create });
}());
