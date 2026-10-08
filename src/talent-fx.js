/* KABİR AZABI — look of talent tree 3 (all procedural, no textures):
   - burning ground (a pool of 10 shader quads; only gear powers open zones now, the tree itself no longer does)
   - status on foes: burn embers, bleed drops, rot motes + green sigil under the feet, dread wisps: ONE shared Points cloud (900)
   - bursts: pooled expanding ring quads (10); chains: real instanced links (Çengelli Çekiş, gear powers)
   Draw calls: 1 points + visible zones + visible rings + chain links. Nothing is allocated per frame.
   API (talent-runtime.js): create(root, groundY) -> { zone(z), unzone(z), mark(e, kind), unmark(e, kind), clear(e), burst(x, z, r, kind),
     chains(player, foes, lash, opt), drain(e, player), update(dt, status, hearthPlayer), reset(), dispose() } */
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
  const GUARD_FS = [
    'varying vec2 vUv; uniform float uTime, uFade, uKind;',
    'void main(){ vec2 p = vUv; float r = length(p), a = atan(p.x, p.y), seg = fract(a * 1.2732395), pl = 1.0;',   // 8 plates
    '  float rim = smoothstep(.035, 0.0, abs(r - .93));',
    '  float plates = smoothstep(.05, 0.0, abs(r - .8)) * smoothstep(0.0, .06, seg) * smoothstep(1.0, .94, seg);',
    '  float teeth = uKind > 1.5 ? step(.93, r) * step(r, 1.0) * step(fract(a * 3.8197 + .5), (1.0 - r) * 12.0 * .5 + .08) * step(.5, fract(a * 1.9099)) : 0.0;',
    '  float heart = uKind > .5 && uKind < 1.5 ? (1.0 - smoothstep(0.0, .9, r)) * (.1 + .12 * pow(.5 + .5 * sin(uTime * 5.5), 4.0)) : 0.0;',
    '  float disc = (1.0 - smoothstep(.3, .95, r)) * .06;',
    '  vec3 col = uKind < .5 ? vec3(.4, .52, .85) : uKind < 1.5 ? vec3(1.0, .26, .18) : vec3(1.0, .88, .8);',
    '  float m = (rim * .9 + plates * .8 + teeth * 1.1 + heart + disc) * step(r, 1.0) * (1.0 - smoothstep(.97, 1.0, r));',
    '  float al = clamp(m, 0.0, 1.0) * uFade; gl_FragColor = vec4(col * al, al); }'].join('\n');
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
    // ---- chains (Çengelli Çekiş + forms, gear powers): real links, instanced, thrown out then held taut while the foe is dragged, then whipped home.
    //      styles: hook = single cold-steel chain, long = twin helical strands (Zincirli Fırlatış), barb = blackened chain, spiked head, dripping blood (Dikenli Çengel)
    const LINKS = 90, CHAINS = 6, LCAP = LINKS * CHAINS * 2;
    const linkMat = new T.MeshStandardMaterial({ color: 0xffffff, metalness: .62, roughness: .36, emissive: new T.Color(.008, .012, .02) });
    const links = new T.InstancedMesh(new T.TorusGeometry(.11, .03, 5, 9).rotateY(Math.PI / 2), linkMat, LCAP); links.frustumCulled = false; links.count = 0; group.add(links);
    links.setColorAt(0, new T.Color(1, 1, 1));
    const chainList = [];   // { from, to, x, z, t, life, throwT, style, hook, landed }
    // grapnel head on the chain tip: forged shank, front spike, collar, chain eye and three barbed prongs curling back toward the chain
    const headMat = new T.MeshStandardMaterial({ color: 0xffffff, metalness: .6, roughness: .4, emissive: new T.Color(.006, .01, .016) });
    const parts = [new T.CylinderGeometry(.055, .075, .6, 8).rotateX(Math.PI / 2).translate(0, 0, .0),
      new T.ConeGeometry(.075, .42, 8).rotateX(Math.PI / 2).translate(0, 0, .5),
      new T.TorusGeometry(.12, .04, 6, 12).translate(0, 0, -.22), new T.TorusGeometry(.1, .03, 6, 12).rotateY(Math.PI / 2).translate(0, 0, -.42)];
    const prong = new T.CatmullRomCurve3([new T.Vector3(0, 0, .22), new T.Vector3(.16, 0, .3), new T.Vector3(.36, 0, .2), new T.Vector3(.46, 0, .0), new T.Vector3(.42, 0, -.16)]);
    for (let k = 0; k < 3; k++) { const g = new T.TubeGeometry(prong, 14, .042, 6, false).rotateZ(k * Math.PI * 2 / 3 + Math.PI / 2); parts.push(g, new T.ConeGeometry(.05, .16, 6).rotateX(-Math.PI / 2 - .35).translate(.42, 0, -.22).rotateZ(k * Math.PI * 2 / 3 + Math.PI / 2)); }
    function mergeParts(list) {
      const g1 = new T.BufferGeometry(), P = [], N = [], I = []; let off = 0;
      for (const g0 of list) { const g = g0.index ? g0 : g0.toNonIndexed(); const pa = g.attributes.position, na = g.attributes.normal;
        for (let i = 0; i < pa.count; i++) { P.push(pa.getX(i), pa.getY(i), pa.getZ(i)); N.push(na.getX(i), na.getY(i), na.getZ(i)); }
        if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + off); else for (let i = 0; i < pa.count; i++) I.push(i + off);
        off += pa.count; }
      g1.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g1.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g1.setIndex(I); return g1;
    }
    const merged = mergeParts(parts);
    // Dikenli Çengel: a ring of long barbs round the collar (drawn only for that form: one extra instanced mesh, empty otherwise)
    const barbParts = []; for (let k = 0; k < 8; k++) barbParts.push(new T.ConeGeometry(.04, .32, 5).translate(0, .16, 0).rotateX(-.6).translate(0, .1, -.12).rotateZ(k * Math.PI / 4));
    const spikes = new T.InstancedMesh(merged, headMat, CHAINS), barbs = new T.InstancedMesh(mergeParts(barbParts), headMat, CHAINS);
    for (const m of [spikes, barbs]) { m.frustumCulled = false; m.count = 0; group.add(m); m.setColorAt(0, new T.Color(1, 1, 1)); }
    const STY = {   // chain colour, head colour, head scale, strands, link scale
      hook: { link: [.4, .48, .6], head: [.52, .6, .72], hs: .5, strands: 1, ls: .5, spark: [1.4, 1.3, 1.1] },
      long: { link: [.55, .7, .95], head: [.8, .92, 1.15], hs: .55, strands: 2, ls: .42, spark: [.8, 1.0, 1.5] },
      barb: { link: [.2, .17, .18], head: [.26, .2, .2], hs: .6, strands: 1, ls: .6, spark: [1.5, .08, .05] } };
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(1, 1, 1), _c = new T.Color(), _ax = new T.Vector3(0, 0, 1), _o = new T.Vector3();
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
    // opt: { life (s the chain stays out), hook (grapnel head), style 'hook'|'long'|'barb', throw (s until the head lands) }
    function chains(p, foes, lash, opt) {
      for (const e of foes.slice(0, CHAINS)) {
        if (chainList.length >= CHAINS) chainList.shift();
        const hk = !!(opt && opt.hook);
        chainList.push({ from: p, to: e, x: e.x, z: e.z, t: 0, life: opt && opt.life || (lash ? .45 : .55), lash: !!lash, hook: hk, style: (opt && opt.style) || 'hook', throwT: (opt && opt.throw) || .24, flight: (opt && opt.flight) || .1, landed: false, acc: 0 });
        if (!hk) { const y = (e.model && e.model.root.position.y) || 0; for (let i = 0; i < 10; i++) spark(e.x, y + 1, e.z, rnd(-2, 2), rnd(.5, 2.5), rnd(-2, 2), i % 2 ? [1.8, 1.5, 1.1] : [1.6, .4, .12], .35, .07, -6); }
      }
      if (!lash) ring(p.x, p.z, 7, [.55, .55, .62], .4);
    }
    // the grapnel bites: sparks off the steel, a short ring, blood from the barbs
    function hookLand(c, x, y, z) {
      const S = STY[c.style] || STY.hook, barb = c.style === 'barb', n = barb ? 22 : 14;
      ring(x, z, barb ? 1.5 : 1.2, barb ? [1.1, .1, .07] : [.7, .75, .95], .2); ring(x, z, .6, [2, 1.9, 1.7], .1);
      for (let i = 0; i < 3; i++) spark(x, y, z, rnd(-.3, .3), rnd(-.1, .3), rnd(-.3, .3), [3, 2.8, 2.4], .09, rnd(.38, .55), 0);   // the flash of the strike: a few hot, big, very short-lived motes
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = rnd(1.2, 4); spark(x, y, z, Math.sin(a) * v, rnd(.3, 2.6), Math.cos(a) * v, barb && i % 3 ? COLORS.blood : i % 2 ? S.spark : [1.8, 1.6, 1.3], rnd(.25, .5), rnd(.06, .12), barb ? -9 : -5); }
    }
    // dust scraped up by a foe dragged along the floor (call every .04 s while he slides) and the thud when he stops
    function dust(x, z, dx, dz, n) {
      const g = gy(x, z) + .08;
      for (let i = 0; i < (n || 2); i++) spark(x + rnd(-.3, .3), g + rnd(0, .1), z + rnd(-.3, .3), dx * rnd(.2, .8) + rnd(-.4, .4), rnd(.3, 1.1), dz * rnd(.2, .8) + rnd(-.4, .4), Math.random() < .2 ? [1.1, .9, .6] : [.26, .23, .19], rnd(.35, .6), rnd(.08, .15), -.6);
    }
    function slam(x, z) {
      ring(x, z, 1.6, [.5, .5, .46], .3);
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, v = rnd(1.2, 3.2); spark(x + Math.sin(a) * .3, gy(x, z) + .1, z + Math.cos(a) * .3, Math.sin(a) * v, rnd(.4, 1.4), Math.cos(a) * v, i % 4 ? [.28, .25, .2] : [1.5, 1.3, 1.0], rnd(.35, .6), rnd(.08, .15), -2); }
    }
    // Demir Duruş: boots planted, a dust ring pushed outward and steel sparks; style 'heart' (Demir Yürek) warm, 'thorn' (Dikenli Zırh) sharp
    function plant(p, style) {
      const g = gy(p.x, p.z), col = style === 'heart' ? [.55, .16, .11] : style === 'thorn' ? [.55, .5, .44] : [.24, .3, .5];
      ring(p.x, p.z, 3.4, col, .5); ring(p.x, p.z, 2.0, [.2, .19, .18], .32);
      for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, v = rnd(2, 4.6); spark(p.x + Math.sin(a) * .5, g + .1, p.z + Math.cos(a) * .5, Math.sin(a) * v, rnd(.2, .9), Math.cos(a) * v, i % 5 ? [.26, .23, .19] : [1.3, 1.1, .9], rnd(.45, .8), rnd(.08, .15), -1.2); }
      for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283; spark(p.x + Math.sin(a) * .5, g + .2, p.z + Math.cos(a) * .5, Math.sin(a) * rnd(.4, 1.4), rnd(2, 4.4), Math.cos(a) * rnd(.4, 1.4), style === 'heart' ? [1.6, .5, .3] : [1.5, 1.5, 1.8], rnd(.3, .6), rnd(.06, .1), -6); }
    }
    // the retaliation: a volley of steel splinters from the hero into the foe who struck him
    function thornVolley(p, e, style) {
      const gp = gy(p.x, p.z) + 1.1, y = ((e.model && e.model.root.position.y) || 0) + 1.0, k = .16, thorn = style === 'thorn';
      for (let i = 0; i < (thorn ? 12 : 7); i++) spark(p.x + rnd(-.3, .3), gp + rnd(-.3, .3), p.z + rnd(-.3, .3), (e.x - p.x) / k + rnd(-1.2, 1.2), (y - gp) / k + rnd(-1, 1), (e.z - p.z) / k + rnd(-1.2, 1.2), i % 2 ? [1.7, 1.6, 1.5] : thorn ? [1.6, .2, .12] : [1, 1.2, 1.7], k * rnd(1, 1.6), .1, 0);
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
      for (let i = 0; i < (n || 6); i++) spark(x + rnd(-.3, .3), y + rnd(.2, 1.6), z + rnd(-.3, .3), rnd(-.3, .3), rnd(.1, .6), rnd(-.3, .3), c, rnd(.35, .6), rnd(.07, .14), 0);
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
    // ---- Demir Duruş ring: eight iron plates round a rim (kind 0), a beating heart pulse (1, Demir Yürek) or sharp teeth (2, Dikenli Zırh)
    const guardMesh = new T.Mesh(quad, new T.ShaderMaterial(Object.assign({ vertexShader: ZONE_VS, fragmentShader: GUARD_FS, uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uKind: { value: 0 } } }, blend)));
    guardMesh.visible = false; guardMesh.frustumCulled = false; guardMesh.renderOrder = 3; group.add(guardMesh);
    let guardView = null;
    function setGuard(p, time, style) { guardView = p ? { p, left: time, age: guardView && guardView.p === p ? guardView.age : 0, style: style || '' } : null; }
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
      // chains: the head flies out, bites, the chain stays taut while the foe is dragged along it, then everything whips home
      let li = 0, hi = 0, bi = 0;
      for (let c = chainList.length - 1; c >= 0; c--) {
        const ch = chainList[c]; ch.t += dt;
        if (ch.t >= ch.life) { chainList.splice(c, 1); continue; }
        const p = ch.from, tx = ch.to.dead ? ch.x : ch.to.x, tz = ch.to.dead ? ch.z : ch.to.z, hk = ch.hook, S = STY[ch.style] || STY.hook;
        if (ch.hook && ch.t < ch.throwT - ch.flight) continue;   // wind-up: the chain is still coiled in the fist
        let reach;
        if (!hk) { const k = ch.t / ch.life; reach = k < .25 ? k / .25 : k > .7 ? 1 - (k - .7) / .3 : 1; }
        else if (ch.t < ch.throwT) { const u = Math.max(0, (ch.t - (ch.throwT - ch.flight)) / ch.flight); reach = 1 - Math.pow(1 - u, 3); }   // whip: hidden in the wind-up, then a sharp ease-out flight (~.1 s)
        else { const back = ch.life - .2; reach = ch.t > back ? Math.max(0, 1 - Math.pow((ch.t - back) / .2, 2)) : 1; }
        // the chain leaves the left hand (the 'chain' pose is mirrored), not the hip
        let ox = p.x, oy = gy(p.x, p.z) + 1.05, oz = p.z;
        if (hk && p.model && p.model.root) {
          const mdl = p.model; if (mdl.__ttHandL === undefined) mdl.__ttHandL = mdl.root.getObjectByName('handL') || null;
          if (mdl.__ttHandL) { mdl.__ttHandL.getWorldPosition(_o); if (Math.abs(_o.x - p.x) < 1.6 && Math.abs(_o.z - p.z) < 1.6 && Math.abs(_o.y - oy) < 1.5) { ox = _o.x; oy = _o.y; oz = _o.z; } }
        }
        const ty = ((ch.to.model && ch.to.model.root.position.y) || 0) + 1, dx = tx - ox, dz = tz - oz, len = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dx, dz), pitch = Math.atan2(oy - ty, len);
        const sag0 = hk ? (ch.t < ch.throwT ? .08 * (1 - reach) : Math.max(0, 1 - len / 3.2) * .16) : (ch.lash ? .5 : .25) * (1 - reach * .6);
        const headLen = Math.max(0, len * reach - (hk && ch.t >= ch.throwT * .98 ? .32 : 0)), tipx = ox + dx / len * headLen, tipz = oz + dz / len * headLen, tipy = oy + (ty - oy) * (headLen / len);
        if (hk) {
          if (!ch.landed && ch.t >= ch.throwT) { ch.landed = true; hookLand(ch, tx, ty, tz); }
          // trailing sparks behind the flying head, blood drips off the barbs while held
          ch.acc += dt * (ch.t < ch.throwT ? 150 : ch.style === 'barb' ? 16 : 0);
          while (ch.acc >= 1) { ch.acc--; if (ch.style === 'barb' && ch.t >= ch.throwT) spark(tipx + rnd(-.1, .1), tipy, tipz + rnd(-.1, .1), rnd(-.2, .2), rnd(-.2, .3), rnd(-.2, .2), COLORS.blood, rnd(.4, .7), rnd(.06, .1), -9); else spark(tipx, tipy, tipz, rnd(-.5, .5), rnd(-.2, .7), rnd(-.5, .5), S.spark, rnd(.15, .3), rnd(.04, .08), -2); }
        }
        const strands = hk ? S.strands : 1, n = Math.min(LINKS, Math.max(2, Math.round(headLen / (hk ? .25 * S.ls : .2))));
        // S-wave of the whip: big while the head flies, a short ripple after the bite (hooks only)
        const wAmp = !hk ? 0 : ch.t < ch.throwT ? Math.min(.5, .05 * len) * (1 - reach * reach) : .06 * Math.exp(-(ch.t - ch.throwT) * 14), wPh = ch.t * 55;
        const side = _p.set(Math.cos(yaw), 0, -Math.sin(yaw));
        const sx = side.x, sz = side.z;
        for (let sd = 0; sd < strands; sd++) for (let i = 0; i < n && li < LCAP; i++) {
          const u = (i + .5) / n, h = headLen * u / len, sag = Math.sin(u * Math.PI) * sag0, tw = hk && strands > 1 ? u * headLen * 1.3 - time * 5 + sd * Math.PI : 0, off = strands > 1 ? .095 : 0;
          const wob = Math.sin(time * 30 + i) * (hk ? .002 : .02), wv = wAmp ? Math.sin(u * Math.PI * 2 - wPh * (ch.t < ch.throwT ? .15 : .3)) * Math.sin(u * Math.PI) * wAmp : 0;
          _p.set(ox + dx * h + sx * (Math.cos(tw) * off + wv), oy + (ty - oy) * h - sag + Math.sin(tw) * off + wob, oz + dz * h + sz * (Math.cos(tw) * off + wv));
          _e.set(pitch, yaw, 0, 'YXZ'); _q.setFromEuler(_e); if ((i + sd) % 2) { _q2.setFromAxisAngle(_ax, Math.PI / 2); _q.multiply(_q2); }
          const ls = hk ? S.ls : 1; _s.set(ls, ls, hk ? 1.5 : 1.6); _m.compose(_p, _q, _s); links.setMatrixAt(li, _m);
          if (hk) _c.setRGB(S.link[0], S.link[1], S.link[2]); else _c.setRGB(.5, .54, .62); links.setColorAt(li, _c); li++;
        }
        if (hk && hi < CHAINS && ch.t >= 0) {
          _p.set(tipx, tipy, tipz); _e.set(pitch, yaw, ch.t * 0, 'YXZ'); _q.setFromEuler(_e); _q2.setFromAxisAngle(_ax, ch.t < ch.throwT ? ch.t * 14 : .5); _q.multiply(_q2);
          const hs = S.hs * (ch.style === 'long' ? 1 : 1); _s.set(hs, hs, hs * (ch.style === 'long' ? 1.25 : 1)); _m.compose(_p, _q, _s);
          spikes.setMatrixAt(hi, _m); _c.setRGB(S.head[0], S.head[1], S.head[2]); spikes.setColorAt(hi, _c); hi++;
          if (ch.style === 'barb') { barbs.setMatrixAt(bi, _m); barbs.setColorAt(bi, _c); bi++; }
        }
      }
      links.count = li; if (li) { links.instanceMatrix.needsUpdate = true; links.instanceColor.needsUpdate = true; }
      spikes.count = hi; if (hi) { spikes.instanceMatrix.needsUpdate = true; spikes.instanceColor.needsUpdate = true; }
      barbs.count = bi; if (bi) { barbs.instanceMatrix.needsUpdate = true; barbs.instanceColor.needsUpdate = true; }
      // Demir Duruş: a steel ring under the hero for the whole stance
      if (guardView && guardView.p && !guardView.p.dead) {
        const gp = guardView.p, left = guardView.left, k = Math.min(1, guardView.age / .25) * Math.min(1, left / .6);
        guardMesh.visible = true; guardMesh.position.set(gp.x, gy(gp.x, gp.z) + .045, gp.z); guardMesh.scale.set(1.9, 1, 1.9); guardMesh.rotation.y = time * .22;
        const u = guardMesh.material.uniforms; u.uTime.value = time; u.uFade.value = k * (.4 + .1 * Math.sin(time * (guardView.style === 'heart' ? 5.5 : 2.4)));
        u.uKind.value = guardView.style === 'heart' ? 1 : guardView.style === 'thorn' ? 2 : 0; guardView.age += dt;
      } else guardMesh.visible = false;
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
      chainList.length = 0; links.count = 0; spikes.count = barbs.count = 0; guardView = null; guardMesh.visible = false;
    }
    function dispose() {
      reset(); root.remove(group);
      group.traverse(o => { if (o.geometry && o.geometry !== quad) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      quad.dispose();
    }
    return { zone, unzone, mark, unmark, clear, burst, chains, dust, slam, plant, thornVolley, setGuard, drain, leech, souls, leap, execute, puff, update, reset, dispose, debug: () => ({ live: liveCount, zones: zonePool.filter(o => o.z).length, marks: marks.size }) };
  }
  B.TalentFX = Object.freeze({ create });
}());
