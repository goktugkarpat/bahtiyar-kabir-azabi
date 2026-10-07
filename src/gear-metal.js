/* KABİR AZABI — gear-metal: how steel / iron plate and ring-mail armour is CONSTRUCTED and WORN.
   Loaded after gear-armor.js. Everything is built once at hero-blueprint time (no runtime geometry / material / texture creation).
   - ringSurface(): a tileable 256 px interlocked-ring albedo / normal / roughness set (replaces the old 'chain' relief; off on Low quality).
   - env(ctx): called by equipment-art.js with the fitted-body helpers; returns the articulated cores (breast / back / fauld / tassets,
     lamed pauldrons, rerebrace + couter + vambrace, cuisse + poleyn, greaves + sabatons, gauntlets, helms, ring-mail hauberk).
     Every method returns true when it replaced the old smooth shell (so equipment-art skips it) and false otherwise (?oldmetal = all false).
   - armorBuilders(ctx): metal-aware replacements for the per-item flourishes in gear-armor.js (pauldron crowns, tassets, knee cops, ...).
   Plates are separate overlapping pieces. Lames of one assembly share bones through rigid blends ('rigidWeights'), so they slide over
   each other when the spine / thigh / shoulder bends. Flexible pieces (hem fringe, hanging straps) are separate parts that carry
   opts.dyn = {mass, anchor, len}; authored-models.js copies that to mesh.userData.dyn for the spring solver. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE, PI = Math.PI, TAU = PI * 2;
  const mix = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lowQuality = () => !!(B.app && B.app.settings && B.app.settings.quality === 'low');

  // ------------------------------------------------------------------------------------------------ ring-mail surface
  // 8 rings across a 256 px tile, staggered rows, every ring crosses its four diagonal neighbours (over / under alternates),
  // so the weave tiles seamlessly on any shell with uvScale. Gaps are dark (padded lining shows through), rings carry the metal.
  function ringSurface() {
    if (lowQuality()) return null;
    const makeTexture = (bytes, srgb, size) => { const t = new T.DataTexture(bytes, size, size, T.RGBAFormat); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.needsUpdate = true; return t; };
    const n = 256, P = 32, Q = 16, R = 12.6, t = 3.5, heights = new Float32Array(n * n), color = new Uint8Array(n * n * 4), normal = new Uint8Array(n * n * 4), rough = new Uint8Array(n * n * 4);
    const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + 19.19) * 43758.5453; return v - Math.floor(v); };
    const cols = n / P, rows = n / Q, shade = new Float32Array(n * n), occ = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const jr = Math.floor(y / Q); let best = -9, bestShade = 0, cover = 0;
      for (let dj = -2; dj <= 2; dj++) {
        const j = jr + dj, row = ((j % rows) + rows) % rows, cy = j * Q, off = (((j % 2) + 2) % 2) * P / 2;
        for (let di = -2; di <= 2; di++) {
          const i0 = Math.floor((x - off) / P) + di, cx = i0 * P + off, ii = ((i0 % cols) + cols) % cols;
          const dx = x - cx, dy = (y - cy) * 1.04, d = Math.hypot(dx, dy), e = Math.abs(d - R);
          if (e >= t) continue;
          const prof = Math.sqrt(1 - (e / t) * (e / t)), sgn = ((ii + row) % 2) ? 1 : -1;
          const z = prof * .62 + sgn * (dx / R) * .34 + (hash(ii, row) - .5) * .07;
          cover++;
          if (z > best) { best = z; bestShade = clamp(.62 + prof * .38 + (dy / R) * -.1 + (hash(ii * 3 + 1, row * 7) - .5) * .22, 0, 1.1); }
        }
      }
      const i = y * n + x;
      heights[i] = best > -8 ? .30 + best * .62 : .12; shade[i] = best > -8 ? bestShade : 0; occ[i] = cover;
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, k = i * 4, ring = shade[i], gap = ring > 0 ? 0 : 1, c = gap ? .09 : .30 + .62 * ring, r = gap ? .96 : .50 - ring * .14 + (hash(x, y) - .5) * .06;
      color[k] = color[k + 1] = color[k + 2] = Math.round(clamp(c, 0, 1) * 255); color[k + 3] = 255;
      rough[k] = rough[k + 1] = rough[k + 2] = Math.round(clamp(r, 0, 1) * 255); rough[k + 3] = 255;
      const dx = (heights[y * n + (x + n - 1) % n] - heights[y * n + (x + 1) % n]) * 2.6, dy = (heights[((y + n - 1) % n) * n + x] - heights[((y + 1) % n) * n + x]) * 2.6, inv = 1 / Math.hypot(dx, dy, 1);
      normal[k] = Math.round((dx * inv * .5 + .5) * 255); normal[k + 1] = Math.round((dy * inv * .5 + .5) * 255); normal[k + 2] = Math.round((inv * .5 + .5) * 255); normal[k + 3] = 255;
    }
    return { map: makeTexture(color, true, n), normalMap: makeTexture(normal, false, n), roughnessMap: makeTexture(rough, false, n) };
  }
  // world metres per tile edge (8 rings, 1.8 cm each) expressed in the body's bind space (1 / 1.2965 of the finished hero)
  const TILE = 8 * .0178 / 1.2965;


  // ------------------------------------------------------------------------------------------------ fitted-body toolkit
  const memo = new WeakMap();
  function env(ctx) {
    const G = B.Gear, { A, part, sleeve, chest, cuirass, rearDepth, cz, facingAngle } = ctx, low = lowQuality();
    B.GearMetal.dbg = ctx;
    let seed = 3;
    // ---- shared low-level helpers
    const line = (fn, n) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
    const emit = (slot, id, mat, list, bone, opts) => { list = list.filter(Boolean); if (list.length) part(slot, id, mat, G.merge(list), bone, opts); };
    const W = (...pairs) => ({ rigidWeights: pairs.map(p => [p[0], p[1]]) });
    // per-piece weathering: soot / rust blotches (kwear.y = cavity: darkens + roughens + rusts), optional blood splash (kwear.z)
    function weather(g, o) {
      o = o || {}; G.wear(g, { edge: o.edge === undefined ? .9 : o.edge });
      const kw = g.attributes.kwear, p = g.attributes.position, sd = (seed++) * 13.7, soot = o.soot === undefined ? .5 : o.soot, blood = o.blood || 0;
      for (let i = 0; i < kw.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (soot) kw.setY(i, Math.min(1, kw.getY(i) + clamp((G.fbm(x * 8 + sd, y * 8, z * 8 + sd * .3, 3) - .46) * 3, 0, 1) * soot));
        if (blood) kw.setZ(i, clamp((G.fbm(x * 13 - sd, y * 13, z * 13, 2) - .6) * 5, 0, 1) * blood);
      }
      return g;
    }
    const plate = (nu, nv, fn, th, o) => { o = o || {}; return weather(G.shell(nu, nv, fn, th, !!o.closed, !!o.flip, o.rim ? { rim: o.rim, rimSides: o.rimSides } : undefined), o); };
    const rivet = (p, n, r) => G.orient(new T.SphereGeometry(r || .0036, 6, 3, 0, TAU, 0, PI / 2).scale(1, .62, 1), p, n);
    const bead = (pts, r) => G.tube(pts, r || .0026, 4, Math.max(6, pts.length * 3), true);
    function normalOf(fn, u, v) { // outward normal of a parametric sheet (same winding as G.sheet)
      const e = .01, a = fn(clamp(u - e, 0, 1), v), b = fn(clamp(u + e, 0, 1), v), c = fn(u, clamp(v - e, 0, 1)), d = fn(u, clamp(v + e, 0, 1));
      const tu = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), tv = new T.Vector3(d[0] - c[0], d[1] - c[1], d[2] - c[2]);
      return tu.cross(tv).normalize();
    }
    const rivetRow = (fn, list, r) => list.map(([u, v]) => { const p = fn(u, v), n = normalOf(fn, u, v); return rivet(p, n.toArray(), r); });
    // memoised limb covers: {at(angle, t, lift) -> [Vector3, normal]}, front angle, axis
    const covers = {};
    function cover(from, to) {
      const key = from + '>' + to; if (covers[key]) return covers[key];
      const c = sleeve(A, from, to, 0, 1, 0, .004, ['skin']); c.geometry.dispose();
      const a = A.P(from), b = A.P(to); c.front = facingAngle(c); c.a = a; c.b = b; c.len = a.distanceTo(b);
      return covers[key] = c;
    }
    // a plate wrapped around a limb: angular span [a0,a1] around the facing direction, t span, with ridge / flare / taper
    function limbPlate(cv, o) {
      const half = (o.a1 - o.a0) / 2, mid = (o.a0 + o.a1) / 2;
      return (u, v) => {
        const sc = o.taper ? o.taper(v) : 1, ang = cv.front + mid + (u - .5) * 2 * half * sc;
        const lift = o.lift + (o.ridge || 0) * Math.pow(Math.max(0, Math.cos((u - .5) * PI)), o.ridgeP || 5) + (o.flare ? o.flare(v) : 0) + (o.bow || 0) * Math.sin(v * PI);
        return cv.at(ang, mix(o.t0, o.t1, o.flip ? 1 - v : v), lift)[0].toArray();
      };
    }

    // ---- torso surface at an absolute height (hips flare below the waist)
    const topAt = u => 1.51 - .135 * Math.pow(Math.abs(Math.sin(u * TAU)), 3);
    function tp(u, y, lift, metal) {
      if (y >= .89) return chest(u, (y - .89) / (topAt(u) - .89), lift, metal);
      const p = chest(u, 0, lift, metal), f = (.89 - y) * .42, dx = p[0], dz = p[2] - cz, l = Math.hypot(dx, dz) || 1;
      return [p[0] + dx / l * f, y, p[2] + dz / l * f];
    }
    const rear = (u, y, lift) => { const v = clamp((y - .957) / (1.47 - .957), 0, 1); return cuirass(u, v, lift); };

    // style table for the plate cores (k = chest core index in equipment-art)
    const STYLE = {
      1: { name: 'knight', mat: 'steel', trim: 'edge', th: .0062, lames: 3, tas: 4, tasw: 1, soot: .5, blood: .22 },
      7: { name: 'warden', mat: 'dark', trim: 'steel', th: .0085, lames: 4, tas: 3, tasw: 1.25, soot: .62, blood: .3 }
    };

    // ===================================================================================================== TORSO (k 1 / 7)
    function torso(id, k) {
      const S = STYLE[k], M = S.mat, TR = S.trim, th = S.th, heavy = k === 7;
      const keep = o => Object.assign({ soot: S.soot, blood: Math.random() < 0 ? 0 : S.blood * (seed % 3 === 0 ? 1 : 0) }, o);
      // --- upper breastplate with a central keel and a rolled neck rim
      const hwB = y => (mix(.083, .128, sstep(1.1, 1.3, y))) * (1 - .26 * sstep(1.38, 1.47, y)) * (heavy ? 1.08 : 1);
      const ytopB = s => 1.462 - .026 * Math.exp(-Math.pow((s - .5) / .16, 2)) - .05 * Math.pow(Math.abs(2 * s - 1), 3);
      const ybotB = s => (heavy ? 1.115 : 1.13) + .035 * Math.pow(Math.abs(2 * s - 1), 2);
      const breast = (s, t) => { const y = mix(ybotB(s), ytopB(s), t), u = (2 * s - 1) * hwB(y); return tp(u, y, .036 + .006 * Math.sin(t * PI) + (heavy ? .006 : 0), true); };
      emit('chest', id, M, [plate(12, 8, breast, th, keep({ rim: low ? 0 : .0024, rimSides: 'bt' }))], 'spine02');
      emit('chest', id, TR, [bead(line(s => breast(s, 1), 12), .0027), bead(line(s => breast(s, 0), 12), .0022)], 'spine02');
      // armhole + neck beads follow the side edges
      for (const e of [0, 1]) emit('chest', id, TR, [bead(line(t => breast(e, t), 8), .0022)], 'spine02');
      emit('chest', id, 'brass', rivetRow(breast, [[.18, .22], [.82, .22], [.14, .62], [.86, .62], [.3, .9], [.7, .9]], .0036), 'spine02');
      emit('chest', id, 'dark', [G.tube(line(t => breast(.5, .06 + t * .84), 10).map(p => [p[0], p[1], p[2] + .0012]), .0011, 4, 20, true)], 'spine02');   // engraved keel line
      // --- plackart: the lower breast, overlapped by the upper plate, hanging from spine01/02
      const hwP = y => mix(.078, .1, sstep(.95, 1.19, y)), ytopP = 1.2, ybotP = s => .955 + .028 * Math.pow(Math.abs(2 * s - 1), 1.6);
      const plack = (s, t) => { const y = mix(ybotP(s), ytopP, t), u = (2 * s - 1) * hwP(y); return tp(u, y, .029 + .004 * Math.sin(t * PI), true); };
      emit('chest', id, M, [plate(10, 5, plack, th, keep({ rim: low ? 0 : .0022, rimSides: 'b' }))], null, W(['spine01', .55], ['spine02', .45]));
      emit('chest', id, TR, [bead(line(s => plack(s, 0), 10), .0023)], null, W(['spine01', .55], ['spine02', .45]));
      emit('chest', id, 'brass', rivetRow(plack, [[.2, .45], [.8, .45]], .0034), null, W(['spine01', .55], ['spine02', .45]));
      // a buckled cross-strap holds upper and lower plates together
      const crossS = (u, v) => { const y = 1.12 + (v - .5) * .05; return tp((u - .5) * .26, y, .042, false); };
      emit('chest', id, 'strap', [G.shell(8, 2, crossS, .003, false)], null, W(['spine01', .5], ['spine02', .5]));
      const bk = G.buckle(.04, .034, .0036); bk.translate(...tp(0, 1.12, .047, false)); emit('chest', id, 'brass', [bk], 'spine02');
      // --- fauld: horizontal lames round the waist, each on its own bone mix (they slide when the spine bends)
      for (let l = 0; l < S.lames; l++) {
        const top = .99 - l * .054, bot = top - .066, lift = .034 - l * .004 + (heavy ? .006 : 0), span = .3 + (heavy ? .02 : 0) - l * .01;
        const lame = (u, v) => tp((u - .5) * 2 * span, mix(bot, top, v), lift + .004 * Math.sin(v * PI), false);
        const w = l === 0 ? W(['spine01', 1]) : l === 1 ? W(['spine01', .55], ['pelvis', .45]) : W(['pelvis', .75 + .25 * (l > 2 ? 1 : 0)], ['spine01', .25 - .25 * (l > 2 ? 1 : 0)]);
        emit('chest', id, M, [plate(22, 3, lame, th, keep({ rim: low ? 0 : .0022, rimSides: 'b' }))], null, w);
        emit('chest', id, TR, [bead(line(u => lame(u, 0), 22), .0022)], null, w);
        emit('chest', id, 'brass', rivetRow(lame, [[.04, .5], [.15, .5], [.85, .5], [.96, .5]].concat(l ? [] : [[.5, .5]]), .0033), null, w);
      }
      // --- back: two plates + a spine ridge, a kidney lame; leather straps bridge the sides (mail doublet shows between)
      const hwBk = y => mix(.1, .12, sstep(1.0, 1.25, y)) * (1 - .16 * sstep(1.38, 1.47, y));
      const backU = (s, t) => { const y = mix(1.17, 1.462, t), u = .5 + (2 * s - 1) * hwBk(y); return rear(u, y, .03 + .004 * Math.sin(t * PI)); };
      emit('chest', id, M, [plate(10, 7, backU, th, keep({ rim: low ? 0 : .0022, rimSides: 'bt' }))], 'spine02');
      emit('chest', id, TR, [bead(line(s => backU(s, 1), 10), .0026), bead(line(s => backU(s, 0), 10), .0022)], 'spine02');
      const backL = (s, t) => { const y = mix(.985, 1.2, t), u = .5 + (2 * s - 1) * mix(.09, .105, t); return rear(u, y, .026 + .003 * Math.sin(t * PI)); };
      emit('chest', id, M, [plate(10, 4, backL, th, keep({ rim: low ? 0 : .0022, rimSides: 'b' }))], null, W(['spine01', .6], ['spine02', .4]));
      emit('chest', id, TR, [bead(line(s => backL(s, 0), 10), .0022)], null, W(['spine01', .6], ['spine02', .4]));
      emit('chest', id, 'brass', rivetRow(backU, [[.15, .25], [.85, .25], [.12, .8], [.88, .8]], .0036).concat(rivetRow(backL, [[.2, .6], [.8, .6]], .0034)), 'spine02');
      emit('chest', id, 'dark', [G.tube(line(t => backU(.5, .04 + t * .92), 10).map(p => [p[0], p[1], p[2] - .0012]), .0013, 4, 20, true)], 'spine02');
      for (const side of [-1, 1]) for (const y of [1.18, 1.3]) {
        const strap = (u, v) => tp(side * (.125 + u * .25) + (side < 0 ? 0 : 0), y + (v - .5) * .034, .032, false);
        emit('chest', id, 'strap', [G.shell(6, 2, strap, .003, false, side < 0)], 'spine02');
        const q = strap(.5, .5), bk2 = G.buckle(.026, .03, .0028); bk2.rotateY(side * PI / 2 * .96); bk2.translate(q[0], q[1], q[2] + (side > 0 ? .0 : 0)); emit('chest', id, 'brass', [bk2], 'spine02');
      }
      // --- gorget: stacked neck lames
      for (let l = 0; l < 3; l++) {
        const y0 = 1.485 + l * .034, r = .112 - l * .0095;
        const ring = (u, v) => { const a = u * TAU; return [Math.sin(a) * r * 1.12, y0 + v * .042 + .004 * Math.sin(a * 2) * 0, cz + .0 + Math.cos(a) * r * (.96 + .05 * Math.cos(a))]; };
        emit('chest', id, M, [plate(18, 2, ring, .005, keep({ closed: true, soot: .3 }))], null, l === 0 ? W(['spine03', 1]) : W(['spine03', 1 - l * .35], ['neck', l * .35]));
      }
      return true;
    }
    // ===================================================================================================== PAULDRONS
    // A domed cap and a stack of overlapping lames hanging down the arm. Each lame blends further from the clavicle bone
    // towards the arm bone, so they fan and slide when the arm lifts. Leather straps show between the lames.
    const shoulderOf = s => {
      const bone = 'upper_arm' + s, bc = A.box(A.cloud([bone], ['skin'], .38)), c = bc.getCenter(new T.Vector3()), sz = bc.getSize(new T.Vector3()), ax = A.P('forearm' + s).sub(A.P(bone));
      c.y = bc.max.y - .028; return { bone, sh: 'shoulder' + s, c, sz, sign: s === 'L' ? 1 : -1, tilt: ax.x / Math.max(.05, -ax.y) };
    };
    function pauldron(id, s, k, o) {
      o = o || {}; const S = STYLE[k], M = o.mat || S.mat, TR = o.trim || S.trim, heavy = k === 7, { bone, sh, c, sz, sign, tilt } = shoulderOf(s);
      const rx = Math.max(.10, sz.x * .46) * (heavy ? 1.12 : 1) * (o.scale || 1), rz = Math.max(.085, sz.z * .55) * (heavy ? 1.1 : 1) * (o.scale || 1), n = o.lames || (heavy ? 4 : 3), th = S.th;
      const cap = (u, v) => { const a = u * TAU, e = mix(.02, 1.22, v); return [c.x + Math.sin(a) * rx * 1.05 * Math.sin(e) + sign * (.012 + .012 * Math.max(0, Math.sin(a) * sign) * v), c.y + .03 + Math.cos(e) * .105 * (o.dome || 1), c.z + Math.cos(a) * rz * 1.05 * Math.sin(e)]; };
      const wCap = W([bone, .62], [sh, .38]);
      emit('chest', id, M, [plate(20, 6, cap, th * 1.15, { closed: true, soot: S.soot })], null, wCap);
      emit('chest', id, TR, [G.tube(line(u => cap(u, 1), 24), .0036, 5, 36, true)], null, wCap);
      const topY = cap(0, 1)[1];
      for (let j = 0; j < n; j++) {
        const h = .064 * (heavy ? 1.1 : 1), yt = topY - .006 - j * h * 1.12, shrink = 1 - .062 * j, wB = W([bone, clamp(.74 + .09 * j, 0, 1)], [sh, 1 - clamp(.74 + .09 * j, 0, 1)]);
        const lame = (u, v) => { const a = u * TAU, y = mix(yt, yt - h, v), r = shrink * (.93 + .045 * v), q = (c.y - y) * tilt; return [c.x + q + Math.sin(a) * rx * r + sign * .012, y, c.z + Math.cos(a) * rz * r]; };
        emit('chest', id, M, [plate(18, 2, lame, th, { closed: true, soot: S.soot, rim: low ? 0 : .0024, rimSides: 'b' })], null, wB);
        emit('chest', id, TR, [G.tube(line(u => lame(u, 1), 22), .0028, 4, 32, true)], null, wB);
        emit('chest', id, 'brass', rivetRow(lame, [[0, .5], [.5, .5], [.25, .5], [.75, .5]], .0034), null, wB);
      }
      // front + rear leather straps run under the lames and show in the gaps
      for (const a of [0, .5]) {
        const stp = (u, v) => { const y = mix(topY - .01, topY - .02 - n * .064 * (heavy ? 1.1 : 1) * 1.1, v), q = (c.y - y) * tilt, r = (1 - .062 * (n - 1)) * (.94 + .02 * v) * .97; return [c.x + q + sign * .012 + Math.sin((a + (u - .5) * .05) * TAU) * rx * r * 1.0, y, c.z + Math.cos((a + (u - .5) * .05) * TAU) * rz * r]; };
        emit('chest', id, 'strap', [G.shell(2, 8, stp, .003, false, a === .5)], null, W([bone, .85], [sh, .15]));
      }
      return { c, rx, rz, sign, bone, sh, n };
    }

    // ===================================================================================================== ARMS (arm under plate / mail: style = chest core index)
    function arms(id, k, s) {
      const S = STYLE[k]; if (!S) return false; const M = S.mat, TR = S.trim, th = S.th, heavy = k === 7;
      const up = 'upper_arm' + s, fo = 'forearm' + s, hand = 'hand' + s, cu = cover(up, fo), cf = cover(fo, hand);
      // rerebrace: outer half-shell with rolled rims, held by two buckled leather straps
      const rer = limbPlate(cu, { a0: -1.25, a1: 1.25, t0: .5, t1: .92, lift: .03, ridge: .008 + (heavy ? .004 : 0), flare: v => .006 * sstep(.75, 1, v) });
      emit('chest', id, M, [plate(14, 5, rer, th, { soot: S.soot, rim: low ? 0 : .0022, rimSides: 'bt' })], up);
      emit('chest', id, TR, [bead(line(u => rer(u, 0), 12), .0024), bead(line(u => rer(u, 1), 12), .0024)], up);
      for (const t of [.58, .84]) {
        const band = (u, v) => cu.at(u * TAU, t + (v - .5) * .05, .022)[0].toArray();
        emit('chest', id, 'strap', [G.shell(16, 2, band, .003, true)], up);
        const q = cu.at(cu.front + PI * .5 * sign(s), t, .03)[0]; const bk = G.buckle(.022, .026, .0026); bk.translate(q.x, q.y, q.z); emit('chest', id, 'brass', [bk], up);
      }
      // couter: a bossed cop with fanned lames above and below the elbow
      const ej = A.P(fo), side = s === 'L' ? 1 : -1;
      const cop = (u, v) => { const a = u * TAU, e = mix(.02, 1.25, v), q = cf.at(cf.front, 0, .038)[0]; return [q.x + Math.sin(a) * .052 * Math.sin(e) + side * .008, q.y + Math.cos(a) * .056 * Math.sin(e) * 1.0 + .004, q.z + Math.cos(e) * .036]; };
      emit('chest', id, M, [plate(14, 5, cop, th * 1.3, { closed: true, soot: S.soot })], fo);
      emit('chest', id, TR, [G.tube(line(u => cop(u, 1), 20), .0032, 4, 28, true)], fo);
      emit('chest', id, 'brass', [rivet(cop(0, 0), [0, 0, 1], .008)], fo);
      for (let f = 0; f < 3; f++) {
        const fan = (u, v) => { const q = cf.at(cf.front + mix(-.7, .7, u), -.05 - f * .005, .026 - f * .002)[0]; return [q.x, q.y + .034 + f * .028 + v * .03 - Math.abs(u - .5) * .014 * (f + 1), q.z - f * .006 + .0]; };
        emit('chest', id, M, [plate(8, 2, fan, th * .9, { soot: S.soot })], up);
      }
      // vambrace: ridged forearm plate, flared at the wrist end, with two straps
      const vam = limbPlate(cf, { a0: -1.2, a1: 1.2, t0: .24, t1: .8, lift: .028, ridge: .01, flare: v => .012 * Math.pow(1 - v, 2) + .004 * Math.pow(v, 3) });
      emit('chest', id, M, [plate(14, 6, vam, th, { soot: S.soot, rim: low ? 0 : .0022, rimSides: 'bt' })], fo);
      emit('chest', id, TR, [bead(line(u => vam(u, 0), 12), .0024), bead(line(u => vam(u, 1), 12), .0024)], fo);
      emit('chest', id, 'dark', [G.tube(line(t => vam(.5, .08 + t * .84), 8).map(p => [p[0], p[1] + 0, p[2] + .0011]), .0012, 4, 12, true)], fo);
      for (const t of [.35, .66]) {
        const band = (u, v) => cf.at(u * TAU, t + (v - .5) * .045, .024)[0].toArray();
        emit('chest', id, 'strap', [G.shell(16, 2, band, .003, true)], fo);
        const q = cf.at(cf.front, t, .03)[0], bk = G.buckle(.022, .026, .0026); bk.translate(q.x, q.y, q.z); emit('chest', id, 'brass', [bk], fo);
      }
      emit('chest', id, 'brass', rivetRow(vam, [[.16, .12], [.84, .12], [.16, .88], [.84, .88]], .0034), fo);
      return true;
    }
    const sign = s => s === 'L' ? 1 : -1;

    // ===================================================================================================== LEGS (tassets + poleyn)
    function legs(id, k, s) {
      const S = STYLE[k]; if (!S) return false; const M = S.mat, TR = S.trim, th = S.th, heavy = k === 7;
      const th_ = 'thigh' + s, sn = 'shin' + s, ct = cover(th_, sn), cs = cover(sn, 'tarsal' + s), N = S.tas;
      // tassets: hanging plates; the upper ones follow the pelvis, the lower ones the thigh
      for (let l = 0; l < N; l++) {
        const t0 = .02 + l * (.8 / N) * .98, t1 = t0 + (.8 / N) * 1.34, wT = clamp(.28 + l * (.72 / Math.max(1, N - 1)), 0, 1);
        const plt = limbPlate(ct, { a0: -1.0 * S.tasw, a1: 1.0 * S.tasw, t0, t1, lift: .031 + (N - l) * .0012, ridge: .008, flare: v => .008 * v * v - .004 * (1 - v) });
        const wl = W([th_, wT], ['pelvis', 1 - wT]);
        emit('chest', id, M, [plate(12, 4, plt, th, { soot: S.soot, rim: low ? 0 : .0022, rimSides: 'b' })], null, wl);
        emit('chest', id, TR, [bead(line(u => plt(u, 1), 12), .0024)], null, wl);
        emit('chest', id, 'brass', rivetRow(plt, [[.1, .4], [.9, .4], [.5, .35]], .0033), null, wl);
      }
      // poleyn: bossed knee cop between fan lames, hinged to the shin and thigh
      const kq = cs.at(cs.front, -.03, .046)[0];
      const kop = (u, v) => { const a = u * TAU, e = mix(.02, 1.22, v); return [kq.x + Math.sin(a) * .066 * Math.sin(e) + sign(s) * .006, kq.y + .004 + Math.cos(a) * .07 * Math.sin(e), kq.z + Math.cos(e) * .044 * (heavy ? 1.2 : 1)]; };
      emit('chest', id, M, [plate(16, 6, kop, th * 1.3, { closed: true, soot: S.soot })], sn);
      emit('chest', id, TR, [G.tube(line(u => kop(u, 1), 22), .0034, 4, 28, true), G.tube(line(t => kop(.0, t), 6).map(p => [p[0], p[1], p[2] + .0012]), .0016, 4, 8, true)], sn);
      emit('chest', id, 'brass', [rivet(kop(0, 0), [0, 0, 1], .0095)], sn);
      for (let f = 0; f < 2; f++) {
        const up = (u, v) => { const q = ct.at(ct.front + mix(-.8, .8, u), .93 + v * .08, .036 - f * .004)[0]; return [q.x, q.y + .062 + f * .042 - Math.abs(u - .5) * .02, q.z]; };
        const dn = (u, v) => { const q = cs.at(cs.front + mix(-.8, .8, u), .0, .04 - f * .004)[0]; return [q.x, q.y - .056 - f * .04 + v * .034, q.z]; };
        emit('chest', id, M, [plate(10, 2, up, th * .9, { soot: S.soot, flip: false })], th_);
        emit('chest', id, M, [plate(10, 2, dn, th * .9, { soot: S.soot })], sn);
      }
      return true;
    }
    // ===================================================================================================== HANDS
    function hands(id, k, s, e) {
      const M = k === 2 ? 'salt' : k === 3 ? 'steel' : 'dark', TR = 'edge', th = .0055, fo = 'forearm' + s, hd = 'hand' + s, cf = cover(fo, hd), ch = cover(hd, 'finger_middle01' + s);
      const heavy = k === 4;
      const vam = limbPlate(cf, { a0: -1.15, a1: 1.15, t0: k === 2 ? .52 : .3, t1: .9, lift: .026, ridge: .009, flare: v => .014 * Math.pow(1 - v, 2) + .006 * Math.pow(v, 3) });
      emit('hands', id, M, [plate(14, 5, vam, th, { soot: .5, rim: low ? 0 : .002, rimSides: 'bt' })], fo);
      emit('hands', id, TR, [bead(line(u => vam(u, 0), 12), .0024), bead(line(u => vam(u, 1), 12), .0022)], fo);
      emit('hands', id, 'brass', rivetRow(vam, [[.15, .15], [.85, .15], [.15, .85], [.85, .85]], .0032), fo);
      for (const t of [.42, .72]) emit('hands', id, 'strap', [G.shell(16, 2, (u, v) => cf.at(u * TAU, t + (v - .5) * .04, .022)[0].toArray(), .003, true)], fo);
      // back of the hand: two overlapping plates + a knuckle roll; outward = the direction the hand's back faces
      let best = 0, bd = -9; for (let a = 0; a < TAU; a += .2) { const nx = ch.at(a, .5, 0)[1].x * (s === 'L' ? 1 : -1); if (nx > bd) { bd = nx; best = a; } }
      for (let l = 0; l < 2; l++) {
        const bk = limbPlate(Object.assign({}, ch, { front: best }), { a0: -.8, a1: .8, t0: .1 + l * .36, t1: .5 + l * .4, lift: .016 - l * .004, ridge: .006 });
        emit('hands', id, M, [plate(8, 3, bk, th * .9, { soot: .4 })], hd);
        emit('hands', id, TR, [bead(line(u => bk(u, 1), 8), .002)], hd);
      }
      const kn = [], seg = [];
      for (let i = 0; i < 4; i++) { const q = ch.at(best + mix(-.55, .55, i / 3), .94, .02)[0]; kn.push(G.sphere(.0075, q.toArray(), [1, 1, 1], 6, 4)); }
      emit('hands', id, heavy ? 'steel' : TR, kn, hd);
      if (k === 3) for (let i = 0; i < 3; i++) { const q = ch.at(best + mix(-.4, .4, i / 2), .98, .02)[0]; emit('hands', id, 'dark', [G.spike(.007, q.toArray(), [q.x, q.y - .02, q.z + .014], 4)], hd); }
      // finger plates: one short tube per phalanx, each bound to its own bone (they follow the curl)
      for (const name of Object.keys(A.index).filter(n => n.startsWith('finger_') && n.endsWith(s))) {
        const a = A.P(name), b = A.tail(name); if (!b || b.distanceTo(a) < .009) continue;
        const d = b.clone().sub(a), p0 = a.clone().addScaledVector(d, .06), p1 = a.clone().addScaledVector(d, .94);
        emit('hands', id, M, [weather(G.tube([p0.toArray(), p1.toArray()], .0105, 5, 2, true), { soot: .3 })], name);
      }
      return true;
    }
    function mailGlove(id, s, e) { return false; }

    // ===================================================================================================== BOOTS
    function boots(id, k, s, e) {
      if (k === 3 || k === 0) return false;
      const M = k === 2 ? 'salt' : k === 4 ? 'dark' : 'steel', TR = 'edge', th = .0055, sn = 'shin' + s, ta = 'tarsal' + s, to = 'toe' + s, cs = cover(sn, ta), { fc, fs, sole, w, length } = e;
      if (k === 1 || k === 4) {
        const gr = limbPlate(cs, { a0: -1.05, a1: 1.05, t0: .1, t1: .9, lift: .027, ridge: k === 4 ? .016 : .011, flare: v => .014 * Math.pow(1 - v, 3) + .008 * Math.pow(v, 4) });
        emit('boots', id, M, [plate(14, 7, gr, th, { soot: .55, blood: .12, rim: low ? 0 : .0022, rimSides: 'bt' })], sn);
        emit('boots', id, TR, [bead(line(u => gr(u, 0), 12), .0024), bead(line(u => gr(u, 1), 12), .0024)], sn);
        emit('boots', id, 'dark', [G.tube(line(t => gr(.5, .06 + t * .88), 8).map(p => [p[0], p[1], p[2] + .0012]), .0012, 4, 12, true)], sn);
        emit('boots', id, 'brass', rivetRow(gr, [[.14, .1], [.86, .1], [.14, .9], [.86, .9]], .0034), sn);
        for (const t of [.3, .64]) {
          emit('boots', id, 'strap', [G.shell(16, 2, (u, v) => cs.at(u * TAU, t + (v - .5) * .045, .023)[0].toArray(), .003, true)], sn);
          const q = cs.at(cs.front + PI * .5 * sign(s), t, .03)[0], bk = G.buckle(.02, .024, .0025); bk.translate(q.x, q.y, q.z); emit('boots', id, 'brass', [bk], sn);
        }
        // ankle collar lame
        emit('boots', id, M, [plate(16, 2, (u, v) => cs.at(u * TAU, .94 + v * .05, .02)[0].toArray(), th, { closed: true, soot: .4 })], ta);
      }
      // sabaton: lames over the instep, the forward ones ride on the toe bone
      const y0 = sole + .018, H = Math.max(fs.y * .82, .069), L = length, nL = k === 2 ? 3 : 4;
      for (let i = 0; i < nL; i++) {
        const z0 = L * (.16 + i * .2), z1 = z0 + L * .26, lift = .015 - i * .0028;
        const lame = (u, v) => { const z = Math.min(L * .985, mix(z0, z1, v)), xw = w * Math.sqrt(Math.max(.03, 1 - (z / L) * (z / L))) * .97, x = (u - .5) * 2 * xw, q = 1 - (x / w) * (x / w) - (z / L) * (z / L); return [fc.x + x, y0 + H * Math.sqrt(Math.max(.0004, q)) + lift, fc.z + z]; };
        const wt = i < nL - 2 ? W([ta, 1]) : i === nL - 2 ? W([ta, .5], [to, .5]) : W([to, 1]);
        emit('boots', id, M, [plate(10, 2, lame, th, { soot: .45, rim: low ? 0 : .002, rimSides: 'b' })], null, wt);
        emit('boots', id, TR, [bead(line(u => lame(u, 1), 10), .0021)], null, wt);
      }
      return true;
    }

    // ===================================================================================================== HELMS (supplements on the shared dome)
    function helms(id, k, e) {
      const { dome, rx, ry, rz, hc, mat } = e, M = mat, th = .005;
      const rimPt = u => dome(u, 0);
      emit('head', id, 'brass', line(u => u, 15).filter(u => u < 1 && Math.abs(Math.atan2(Math.sin(u * TAU), Math.cos(u * TAU))) > .5).map(u => { const p = dome(u, .1), n = [p[0] - hc.x, 0, p[2] - hc.z]; return rivet(p, n, .0036); }), 'head');
      // crown comb: a raised ridge from brow to nape
      const comb = line(t => { const f = t < .5, p = f ? dome(0, t * 2) : dome(.5, 2 - t * 2); const n = new T.Vector3(p[0] - hc.x, p[1] - hc.y, p[2] - hc.z).normalize(); return [p[0] + n.x * .006, p[1] + n.y * .006, p[2] + n.z * .006]; }, 24);
      if (k !== 2 && k !== 3) emit('head', id, 'edge', [G.tube(comb, .0046, 5, 40, true)], 'head');
      // hanging neck lames (rigid blends head -> neck so they swing a little with the nape)
      if (k !== 2 && k !== 3) for (let l = 0; l < 3; l++) {
        const yr = rimPt(.5)[1] - .006 - l * .038, r = 1.03 + l * .015;
        const lame = (u, v) => { const a = mix(.28, .72, u) * TAU, y = mix(yr, yr - .044, v); return [hc.x + Math.sin(a) * rx * (r + .05 * v), y, hc.z + Math.cos(a) * rz * (r + .05 * v) - .006 * l]; };
        const wt = W(['head', 1 - l * .3], ['neck', l * .3]);
        emit('head', id, M, [plate(12, 2, lame, th, { soot: .4 })], null, wt);
        emit('head', id, 'edge', [bead(line(u => lame(u, 1), 12), .0021)], null, wt);
      }
      return true;
    }

    // ===================================================================================================== RING-MAIL HAUBERK (core k = 6)
    function mailChest(id) {
      const hem = (u, y) => tp(u, y, .02, false);
      const body = (u, v) => { const side = Math.abs(Math.sin(u * TAU)), top = 1.52 - .15 * Math.pow(side, 9) + .06 * Math.exp(-Math.pow((side - .66) / .21, 2)), y = mix(.9, top, v); return tp(u, y, .018, false); };
      const bodyShell = G.shell(48, 18, body, .004, true); if (low) G.uvScale(bodyShell, 1.9, 1.3);   // Low: the old coarse relief needs the old uv scale
      part('chest', id, 'mail', bodyShell, null, { rigidWeights: [['spine02', 1]] });
      // sleeves to the elbow
      for (const s of ['L', 'R']) {
        const cu = cover('upper_arm' + s, 'forearm' + s);
        part('chest', id, 'mail', G.shell(16, 8, (u, v) => cu.at(u * TAU, mix(.1, 1.06, v), .02)[0].toArray(), .004, true), 'upper_arm' + s);
        // hem rolls of heavier rings at the sleeve ends
        emit('chest', id, 'edge', [G.tube(line(u => cu.at(u * TAU, 1.06, .021)[0].toArray(), 20), .0034, 4, 24, true)], 'upper_arm' + s);
      }
      // flexible hem: a hauberk skirt split front/back, hanging links at the bottom — its own mesh for the spring solver
      const skirt = (u, v) => { const a = .04 + u * .92, p = tp(a, .93, .02, false), f = 1 + v * .07; return [(p[0]) * f, .93 - v * .3 + .0 * u, cz + (p[2] - cz) * f]; };
      const g = G.shell(40, 6, skirt, .0035, false);
      part('chest', id, 'mail', g, null, { bones: ['pelvis', 'spine01', 'thighL', 'thighR'], dyn: { mass: 'light', anchor: 'pelvis', len: .3 } });
      const fr = [];
      for (let i = 0; i < 40; i++) { const q = skirt((i + .5) / 40, 1), a = (.04 + (i + .5) / 40 * .92) * TAU; const lk = G.link(.016); lk.rotateY(a); lk.translate(q[0], q[1] - .01, q[2]); fr.push(lk); }
      emit('chest', id, 'edge', fr, null, { bones: ['pelvis', 'spine01', 'thighL', 'thighR'], dyn: { mass: 'light', anchor: 'pelvis', len: .3 } });
      // leather harness + belt over the mail
      for (const side of [-1, 1]) emit('chest', id, 'strap', [G.shell(4, 20, (u, v) => chest(side * (.02 + v * .09) + (u - .5) * .02, .22 + v * .66, .03), .003, false, side < 0)], 'spine02');
      emit('chest', id, 'strap', [G.shell(48, 3, (u, v) => hem(u, .95 + v * .06), .004, true)], null, { bones: ['pelvis', 'spine01'] });
      const bkq = hem(0, .98), bk = G.buckle(.045, .034, .0035); bk.translate(bkq[0], bkq[1], bkq[2] + .01); emit('chest', id, 'brass', [bk], 'spine01');
      // small steel spaulders: three lames per shoulder
      for (const s of ['L', 'R']) pauldron(id, s, 1, { lames: 2, scale: .9, mat: 'steel', trim: 'edge' });
      return true;
    }
    return {
      leg: (id, style, side) => legs(id, style, side),
      arm: (id, style, side) => arms(id, style, side),
      shoulder: (id, k, s) => { if (k === 4) { pauldron(id, s, 1, { lames: 3, mat: 'steel', trim: 'brass' }); return true; } if (k === 8) { pauldron(id, s, 1, { lames: 3, mat: 'bone', trim: 'strap', scale: 1.05 }); return true; } return false; },
      hand: (id, k, s, e) => hands(id, k, s, e),
      boot: (id, k, s, e) => boots(id, k, s, e),
      helm: (id, k, e) => helms(id, k, e),
      chest: (id, k) => { if (k === 1 || k === 7) { torso(id, k); for (const s of ['L', 'R']) pauldron(id, s, k); return true; } if (k === 6) return mailChest(id); return false; }
    };
  }

  // ring-mail shells carry 0..1 uv; scale them so one ring is 1.8 cm whatever the piece size (closed shells: round the limb, up its length)
  function fitMailUV(g) {
    if (!g || g.userData.mailFit || !g.attributes.uv) return g;
    g.computeBoundingBox(); const bb = g.boundingBox, w = (bb.max.x - bb.min.x) / 2, d = (bb.max.z - bb.min.z) / 2, h = bb.max.y - bb.min.y;
    const circ = PI * (3 * (w + d) - Math.sqrt((3 * w + d) * (w + 3 * d))), uv = g.attributes.uv, su = Math.max(1, circ / TILE), sv = Math.max(1, h / TILE);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    g.userData.mailFit = true; return g;
  }
  // per-item pauldron crowns for gear-armor.js: they sit ON the articulated core lames instead of burying them under a dome
  function armorBuilders(x) {
    const { G, part, emit, shoulderInfo, line } = x;
    function spikedPauldron(id, mat, trim, n, len, big) {
      for (const s of ['L', 'R']) {
        const { bone, c, rx, rz, sign } = shoulderInfo[s], sp = [], st = [], R = big ? 1.1 : 1.06;
        const cap = (a, e) => [c.x + Math.sin(a) * rx * R * Math.sin(e) + sign * .016, c.y + .034 + Math.cos(e) * .11, c.z + Math.cos(a) * rz * R * Math.sin(e)];
        // a raised, crested collar plate over the cap
        part('chest', id, mat, G.shell(24, 3, (u, v) => cap(u * TAU, mix(.55, .8, v)), .006, true), bone);
        part('chest', id, trim, G.tube(line(u => cap(u * TAU, .8), 28), .0036, 5, 36, true), bone);
        for (let i = 0; i < n; i++) {
          const t = (i + .5) / n, a = mix(-.9, .9, t) + (sign > 0 ? PI / 2 : -PI / 2), base = cap(a, .62), dir = new T.Vector3(base[0] - c.x, (base[1] - c.y) * 1.6 + .05, base[2] - c.z).normalize(), L = len * 1.4 * (1 - Math.abs(t - .5) * .6);
          sp.push(G.spike(.02, base, [base[0] + dir.x * L, base[1] + dir.y * L, base[2] + dir.z * L], 6)); st.push(G.ring(.015, .003, base, null, 5, 12));
        }
        for (let i = 0; i < 10; i++) { const p = cap(i / 10 * TAU, .8), nn = [p[0] - c.x, p[1] - c.y, p[2] - c.z]; st.push(G.stud(.004, p, nn)); }
        emit('chest', id, 'black', sp, bone); emit('chest', id, trim, st, bone);
      }
    }
    function bellPauldron(id, mat, trim) {
      for (const s of ['L', 'R']) {
        const { bone, c, rx, rz, sign } = shoulderInfo[s];
        const flare = (u, v) => { const a = u * TAU, y = c.y - .05 - v * .085, r = 1.2 + v * .28; return [c.x + sign * (.02 + v * .02) + Math.sin(a) * rx * r, y, c.z + Math.cos(a) * rz * r]; };
        part('chest', id, mat, G.shell(22, 3, flare, .006, true), bone);
        part('chest', id, trim, G.tube(line(u => flare(u, 1), 28), .004, 5, 36, true), bone);
      }
    }
    return { spikedPauldron, bellPauldron };
  }
  B.GearMetal = { ringSurface, TILE, lowQuality, env, fitMailUV, armorBuilders };
})();
