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
  const COLORS = { stone: [1.1, .85, .55], gold: [1.6, 1.15, .45], chain: [.75, .78, .85], fire: [1.45, .3, .04], blood: [1.5, .08, .05], rot: [.46, .62, .2], dread: [.55, .2, 1.0], bone: [1.4, 1.3, 1.05] };
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
    '  float alpha = clamp(m * .55 + core * .5 + ash * core * .3, 0.0, 1.2) * uFade * .72;',   // skillfx: large seals read near-white across the arena; keep them under the hits
    '  gl_FragColor = vec4(hot * alpha, alpha);',
    '}'].join('\n');
  const RING_FS = [
    'varying vec2 vUv; uniform float uK, uFade; uniform vec3 uColor;',
    'void main(){ float r = length(vUv); float w = mix(.08, .03, uK); float band = smoothstep(w, 0.0, abs(r - mix(.25, .98, uK)));',
    '  float inner = (1.0 - smoothstep(0.0, mix(.25, .98, uK), r)) * .035 * (1.0 - uK);',
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
    // ---- bell (Ölüm Çanı): a fresnel ghost bell (rim-lit, so it reads from the steep top-down camera), its clapper and a pale pillar of light
    const pts = [], H = 1.25; for (let i = 0; i <= 18; i++) { const u = i / 18; pts.push(new T.Vector2(.2 + .62 * Math.pow(u, 1.6) + (u > .9 ? (u - .9) * 2.6 : 0), H * (1 - u))); }
    const GHOST_VS = 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); vY = position.y; gl_Position = projectionMatrix * w; }';
    const GHOST_FS = 'varying vec3 vN; varying vec3 vV; varying float vY; uniform float uFade, uTime; uniform vec3 uColor; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6); float band = smoothstep(.04, 0.0, abs(fract(vY * 3.2 - uTime * .8) - .5) - .42); float a = (f * .8 + band * .25 + .03) * uFade; gl_FragColor = vec4(uColor * a, a); }';
    const bellMat = new T.ShaderMaterial({ vertexShader: GHOST_VS, fragmentShader: GHOST_FS, uniforms: { uFade: { value: 0 }, uTime: { value: 0 }, uColor: { value: new T.Vector3(.46, .78, .36) } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const bell = new T.Mesh(new T.LatheGeometry(pts, 28), bellMat); bell.visible = false; bell.renderOrder = 5; group.add(bell);
    const clapper = new T.Mesh(new T.SphereGeometry(.17, 12, 8), bellMat); clapper.position.y = -.15; bell.add(clapper);
    const bellWire = new T.LineSegments(new T.EdgesGeometry(bell.geometry, 25), new T.LineBasicMaterial({ color: new T.Color(.85, 1, .7), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    bell.add(bellWire);
    const PILLAR_FS = 'varying vec2 vUv; uniform float uFade, uTime; uniform vec3 uColor; void main(){ float edge = sin(vUv.x * 3.14159); float v = smoothstep(0.0, .15, vUv.y) * (1.0 - smoothstep(.55, 1.0, vUv.y)); float flow = .6 + .4 * sin(vUv.y * 22.0 - uTime * 9.0); float a = edge * edge * v * flow * uFade * .55; gl_FragColor = vec4(uColor * a, a); }';
    const pillarMat = new T.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: PILLAR_FS,
      uniforms: { uFade: { value: 0 }, uTime: { value: 0 }, uColor: { value: new T.Vector3(.26, .5, .2) } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const pillar = new T.Mesh(new T.CylinderGeometry(1.25, 1.6, 5.5, 24, 1, true), pillarMat); pillar.visible = false; pillar.renderOrder = 4; group.add(pillar);
    let bellT = 9, bellOwner = null, bellR = 7, bellWave = 3;
    // ---- chains (Zincirli Kader, Zincir Kırbacı, Kanca / Kement): real links, instanced (6 chains x 22 links), thrown out then dragged back
    const LINKS = 22, CHAINS = 6;
    const linkMat = new T.MeshStandardMaterial({ color: 0x5d5853, metalness: .85, roughness: .38, emissive: new T.Color(.25, .04, .02) });
    const links = new T.InstancedMesh(new T.TorusGeometry(.13, .035, 6, 10), linkMat, LINKS * CHAINS); links.frustumCulled = false; links.count = 0; group.add(links);
    const chainList = [];   // { from, to:{x,z,e}, t, life }
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(1, 1, 1);
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
        const y = (e.model && e.model.root.position.y) || 0, c = COLORS[kind === 'burn' ? 'fire' : kind === 'bleed' ? 'blood' : kind] || COLORS.bone;
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
      if (kind === 'fire' || kind === 'rot') ring(x, z, r * .6, kind === 'fire' ? [1.6, .75, .2] : [.6, .85, .35], .3);   // skillfx: the white-hot inner ring + bone sparks stacked into a white blob on every proc
      const n = kind === 'blood' ? 22 : 28;
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rnd(1.5, 4.5) * Math.min(1.6, r / 2.5);
        spark(x + Math.sin(a) * .4, y + rnd(.2, 1.1), z + Math.cos(a) * .4, Math.sin(a) * s, rnd(.6, kind === 'rot' ? 2.4 : 4), Math.cos(a) * s, i % 6 ? c : COLORS.bone, rnd(.4, .9), rnd(.1, kind === 'rot' ? .26 : .18), kind === 'blood' ? -9 : kind === 'fire' ? -3 : -.5); }
    }
    function bellAt(p, radius) {
      bellT = 0; bellOwner = p; bellR = radius; bell.visible = true;
      bellWave = 0;
    }
    function chains(p, foes, lash) {
      for (const e of foes.slice(0, CHAINS)) {
        if (chainList.length >= CHAINS) chainList.shift();
        chainList.push({ from: p, to: e, x: e.x, z: e.z, t: 0, life: lash ? .45 : .55, lash: !!lash });
        const y = (e.model && e.model.root.position.y) || 0;
        for (let i = 0; i < 10; i++) spark(e.x, y + 1, e.z, rnd(-2, 2), rnd(.5, 2.5), rnd(-2, 2), i % 2 ? [1.8, 1.5, 1.1] : [1.6, .4, .12], .35, .07, -6);
      }
      if (!lash) ring(p.x, p.z, 7, [.55, .55, .62], .4);
    }
    // Kan Yemini: a thread of blood motes from the wound to the hero. Ölü Açlığı: pale souls fly from the corpse into him.
    function leech(e, p) {
      const y = (e.model && e.model.root.position.y) || 0, gyp = gy(p.x, p.z);
      for (let i = 0; i < 6; i++) { const k = rnd(.45, .7); spark(e.x + rnd(-.25, .25), y + rnd(.8, 1.4), e.z + rnd(-.25, .25), (p.x - e.x) / k, (gyp + 1.1 - y - 1.1) / k + rnd(-.3, .3), (p.z - e.z) / k, [1.5, .12, .1], k, .1, 0); }
    }
    function souls(e, p) {
      const y = (e.model && e.model.root.position.y) || 0;
      for (let i = 0; i < 16; i++) { const k = rnd(.5, .85); spark(e.x + rnd(-.4, .4), y + rnd(.5, 1.6), e.z + rnd(-.4, .4), (p.x - e.x) / k, rnd(.6, 1.6), (p.z - e.z) / k, i % 3 ? [.95, 1.05, 1.15] : [.55, .75, 1.2], k, rnd(.12, .2), -.8); }
    }
    function puff(x, y, z, kind, n) {
      const c = COLORS[kind] || COLORS.bone;
      for (let i = 0; i < (n || 6); i++) spark(x + rnd(-.3, .3), y + rnd(.2, 1.6), z + rnd(-.3, .3), rnd(-.3, .3), rnd(.1, .6), rnd(-.3, .3), c, rnd(.35, .6), rnd(.12, .22), 0);
    }
    function leap(a, b) {
      const ya = ((a.model && a.model.root.position.y) || 0) + 1.2;
      for (let i = 0; i <= 12; i++) { const u = i / 12; spark(a.x + (b.x - a.x) * u, ya + Math.sin(u * Math.PI) * .9, a.z + (b.z - a.z) * u, 0, rnd(.2, .8), 0, i % 2 ? COLORS.fire : [2.4, 1.3, .4], rnd(.25, .45), .13, 0); }
    }
    function execute(e) {
      const y = (e.model && e.model.root.position.y) || 0;
      ring(e.x, e.z, 2.2, [1.3, .06, .04], .5);
      for (let i = 0; i < 26; i++) { const u = i / 25; spark(e.x + (u - .5) * .6, y + .2 + u * 2.6, e.z - (u - .5) * .6, rnd(-.3, .3), rnd(-.5, .5), rnd(-.3, .3), i % 3 ? [1.8, .12, .08] : [2.2, 1.6, 1.2], rnd(.25, .4), .16, 0); }
      for (let i = 0; i < 22; i++) { const a = Math.random() * 6.283; spark(e.x, y + 1.2, e.z, Math.sin(a) * rnd(2, 5), rnd(1, 4), Math.cos(a) * rnd(2, 5), [1.4, .05, .04], rnd(.4, .8), rnd(.08, .14), -12); }
    }
    function drain(e, p) {
      const y = (e.model && e.model.root.position.y) || 0;
      for (let i = 0; i < 14; i++) spark(e.x + rnd(-.3, .3), y + rnd(.6, 1.5), e.z + rnd(-.3, .3), (p.x - e.x) * 1.6, rnd(.5, 1.5), (p.z - e.z) * 1.6, [1.6, .25, .2], .6, .13, 0);
    }
    // ---- frame
    let time = 0;
    let auraOf = null, auraAcc = 0;
    // a faint rune ring under the hero in the colour of his path (reads well from the top-down camera)
    const heroMat = new T.ShaderMaterial(Object.assign({ vertexShader: ZONE_VS, fragmentShader: ZONE_FS, uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uKind: { value: 0 }, uArc: { value: 1 }, uSeed: { value: 11 }, uColor: { value: new T.Vector3(1, 1, 1) } } }, blend));
    const heroRing = new T.Mesh(quad, heroMat); heroRing.visible = false; heroRing.frustumCulled = false; heroRing.renderOrder = 3; group.add(heroRing);
    const AURA_COL = { fire: [1.3, .3, .05], rot: [.3, .85, .16], blood: [1.2, .06, .05], chain: [.55, .6, .7], gold: [1.1, .8, .3], stone: [.8, .6, .4] };
    function update(dt, status, hearthPlayer, aura) {
      auraOf = aura || null;
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
        if (m.sigil) { const s = m.sigil; s.m.position.set(e.x, gy(e.x, e.z) + .05, e.z); const r = (e.radius || .5) + .55; s.m.scale.set(r, 1, r); s.m.rotation.y = time * .8; s.mat.uniforms.uTime.value = time; s.mat.uniforms.uFade.value = .3 + .08 * Math.sin(time * 2.4); }   // rot mark: a dim, slow pulse so it never reads as a telegraph ring
      }
      // bell: rises, swings hard (so its side reads from above), rings three waves; a pale pillar under it
      if (bell.visible) {
        bellT += dt; const k = bellT / 1.6, p = bellOwner;
        while (p && bellWave < 3 && bellT >= .28 + bellWave * .17) { ring(p.x, p.z, bellR * (.75 + bellWave * .14), bellWave === 1 ? [.42, .4, .3] : [.17, .42, .09], .75 + bellWave * .1); bellWave++; }
        if (k >= 1 || !p) { bell.visible = false; pillar.visible = false; bellOwner = null; }
        else {
          const fade = Math.min(1, k * 7) * (1 - Math.max(0, (k - .62) / .38)), g0 = gy(p.x, p.z);
          bell.position.set(p.x, g0 + 3.1 + k * .6, p.z); bell.rotation.x = Math.sin(bellT * 9) * .55 * (1 - k * .7) + .35; bell.rotation.y = bellT * .7;
          bell.scale.setScalar(1.05 + .3 * Math.sin(Math.min(1, k * 4) * Math.PI / 2));
          bellMat.uniforms.uFade.value = .75 * fade; bellMat.uniforms.uTime.value = time; bellWire.material.opacity = .9 * fade;
          pillar.visible = true; pillar.position.set(p.x, g0 + 2.6, p.z); pillarMat.uniforms.uFade.value = fade; pillarMat.uniforms.uTime.value = time; pillar.scale.set(1 + k * .4, 1, 1 + k * .4);
          if (Math.random() < dt * 60) { const a = Math.random() * 6.283; spark(p.x + Math.sin(a) * 1.1, bell.position.y - .4, p.z + Math.cos(a) * 1.1, Math.sin(a) * 1.8, -rnd(.5, 1.6), Math.cos(a) * 1.8, Math.random() < .5 ? COLORS.rot : COLORS.bone, .8, .18, -1); }
        }
      }
      // chains: thrown out over the first 25 %, held, then dragged home
      let li = 0;
      for (let c = chainList.length - 1; c >= 0; c--) {
        const ch = chainList[c]; ch.t += dt; const k = ch.t / ch.life;
        if (k >= 1) { chainList.splice(c, 1); continue; }
        const p = ch.from, tx = ch.to.dead ? ch.x : ch.to.x, tz = ch.to.dead ? ch.z : ch.to.z, reach = k < .25 ? k / .25 : k > .7 ? 1 - (k - .7) / .3 : 1;
        const y0 = gy(p.x, p.z) + 1.05, ty = ((ch.to.model && ch.to.model.root.position.y) || 0) + 1, dx = tx - p.x, dz = tz - p.z, len = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dx, dz);
        const n = Math.min(LINKS, Math.max(3, Math.round(len * reach / .2)));
        for (let i = 0; i < n && li < LINKS * CHAINS; i++) {
          const u = (i + .5) / n * reach, sag = Math.sin(u / Math.max(.01, reach) * Math.PI) * (ch.lash ? .5 : .25) * (1 - reach * .6);
          _p.set(p.x + dx * u, y0 + (ty - y0) * u + sag + Math.sin(time * 30 + i) * .02, p.z + dz * u);
          _e.set(i % 2 ? Math.PI / 2 : 0, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _s.set(1, 1, 1.6); _m.compose(_p, _q, _s); links.setMatrixAt(li++, _m);
        }
      }
      links.count = li; if (li) links.instanceMatrix.needsUpdate = true;
      // build aura on the hero (talent-runtime passes the dominant path)
      if (auraOf && auraOf.player && !auraOf.player.dead && AURA_COL[auraOf.kind]) {
        const p = auraOf.player; heroRing.visible = true; heroRing.position.set(p.x, gy(p.x, p.z) + .03, p.z); heroRing.scale.set(1.15, 1, 1.15); heroRing.rotation.y = -time * .35;
        heroMat.uniforms.uColor.value.set(...AURA_COL[auraOf.kind]); heroMat.uniforms.uTime.value = time; heroMat.uniforms.uFade.value = .32 + .08 * Math.sin(time * 2.2);
      } else heroRing.visible = false;
      if (auraOf && auraOf.player && !auraOf.player.dead) {
        const p = auraOf.player, g0 = gy(p.x, p.z), kind = auraOf.kind, moving = auraOf.moving;
        // the weapon carries the path: sparks / rot / blood run along the blade (hand bone -> model.weaponTip)
        const mdl = p.model;
        if (mdl && mdl.root && mdl.weaponTip && mdl.weaponTip.getWorldPosition && kind !== 'stone' && kind !== 'gold') {
          if (!mdl.__ttHand) mdl.__ttHand = mdl.root.getObjectByName('handR') || null;
          if (mdl.__ttHand && Math.random() < dt * (kind === 'fire' ? 34 : 16)) {
            mdl.weaponTip.getWorldPosition(_p); const tx = _p.x, ty = _p.y, tz = _p.z; mdl.__ttHand.getWorldPosition(_p);
            const u = .25 + Math.random() * .75, bx = _p.x + (tx - _p.x) * u, by = _p.y + (ty - _p.y) * u, bz = _p.z + (tz - _p.z) * u;
            if (kind === 'fire') spark(bx, by, bz, rnd(-.15, .15), rnd(.5, 1.3), rnd(-.15, .15), Math.random() < .4 ? [2.4, 1.2, .3] : [1.9, .45, .06], rnd(.25, .5), rnd(.05, .09), .5);
            else if (kind === 'rot') spark(bx, by, bz, 0, rnd(-.2, .2), 0, [.3, .85, .16], rnd(.5, .9), rnd(.08, .14), -1.5);
            else if (kind === 'blood') spark(bx, by, bz, 0, -.1, 0, COLORS.blood, rnd(.5, .8), rnd(.05, .08), -9);
            else if (kind === 'chain') spark(bx, by, bz, 0, 0, 0, [.9, .95, 1.1], .25, .05, 0);
          }
        }
        auraAcc += dt * (kind === 'rot' ? 16 : kind === 'fire' ? 40 : kind === 'blood' ? 12 : 10);
        while (auraAcc >= 1) {
          auraAcc--;
          const a = Math.random() * 6.283, r = rnd(.15, .55);
          if (kind === 'fire') spark(p.x + Math.sin(a) * r, g0 + rnd(.4, 1.7), p.z + Math.cos(a) * r, rnd(-.2, .2), rnd(.8, 1.8), rnd(-.2, .2), Math.random() < .3 ? [2.4, 1.2, .3] : [1.9, .42, .06], rnd(.4, .8), rnd(.08, .15), .8);
          else if (kind === 'rot') spark(p.x + Math.sin(a) * rnd(.3, .9), g0 + rnd(.05, .5), p.z + Math.cos(a) * rnd(.3, .9), Math.sin(a) * .3, rnd(.15, .45), Math.cos(a) * .3, [.16, .42, .1], rnd(1, 1.6), rnd(.3, .5), 0);
          else if (kind === 'blood') spark(p.x + Math.sin(a) * .35, g0 + rnd(.9, 1.3), p.z + Math.cos(a) * .35, 0, -.2, 0, COLORS.blood, rnd(.4, .6), rnd(.05, .08), -9);
          else if (kind === 'chain') { const b = time * 2.2 + a; spark(p.x + Math.sin(b) * .9, g0 + rnd(.5, 1.4), p.z + Math.cos(b) * .9, Math.cos(b) * 1.3, 0, -Math.sin(b) * 1.3, COLORS.chain, .5, .05, 0); }
          else if (kind === 'gold' && moving) spark(p.x + rnd(-.3, .3), g0 + rnd(.3, 1.5), p.z + rnd(-.3, .3), 0, rnd(0, .3), 0, COLORS.gold, .3, .06, 0);
          else if (kind === 'stone' && moving) spark(p.x + rnd(-.4, .4), g0 + .1, p.z + rnd(-.4, .4), rnd(-.5, .5), rnd(.3, .9), rnd(-.5, .5), [.5, .42, .32], .5, .09, -3);
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
      bell.visible = false; pillar.visible = false; bellOwner = null; chainList.length = 0; links.count = 0;
    }
    function dispose() {
      reset(); root.remove(group);
      group.traverse(o => { if (o.geometry && o.geometry !== quad) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      quad.dispose();
    }
    return { zone, unzone, mark, unmark, clear, burst, bell: bellAt, chains, drain, leech, souls, leap, execute, puff, update, reset, dispose, debug: () => ({ live: liveCount, zones: zonePool.filter(o => o.z).length, marks: marks.size }) };
  }
  B.TalentFX = Object.freeze({ create });
}());
