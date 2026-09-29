/* KABİR AZABI — dismemberment (LIMBS). A killing blow can sever a limb or the head of the foe it kills.
   The severed part is built from the foe's own skinned mesh: the triangles weighted to the bone chain are dropped from the
   corpse (its index buffer gets a per-foe copy; vertex data stay shared) and re-used as a separate SkinnedMesh that carries
   a frozen copy of the kill-frame pose, moved rigidly by a tiny physics body (throw, spin, 2-3 bounces, slide, rest, fade).
   Both cut faces are closed by a fan cap (dark rim, red flesh, pale bone) built from the boundary edges of the cut.
   Purely cosmetic: it never touches damage, hit-stop rules or AI. Bosses are never cut. Always on (no setting). */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {}, T = THREE;
  const MAXBONES = 96, GRAVITY = 11.5, UP = new T.Vector3(0, 1, 0);
  // Chance that a killing blow severs something (rolled by combat.js with the foe's own seeded RNG, so runs stay repeatable).
  const CHANCE = { light: .25, heavy: .65, finisher: .75, whirl: .35, whirlLast: .55 };
  // Cut points: bone name pattern, whether the bone has a side, piece radius / head flag (metres for a 2.2 m foe).
  const ROLES = {
    head: { re: /^head$/i, side: false, r: .13, round: true },
    arm: { re: /^(upperarm|upper_arm)/i, side: true, r: .065 },
    forearm: { re: /^(lowerarm|forearm)/i, side: true, r: .05 },
    leg: { re: /^thigh/i, side: true, r: .095 },
    shin: { re: /^(calf|shin)/i, side: true, r: .07 }
  };
  const CLASH = { arm: ['arm', 'forearm'], forearm: ['arm', 'forearm'], leg: ['leg', 'shin'], shin: ['leg', 'shin'], head: ['head'] };
  const capMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .34, metalness: 0, emissive: 0x1c0202, name: 'kara-limb-cap' });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sideOf = name => /_l$|L$/.test(name) ? 'l' : /_r$|R$/.test(name) ? 'r' : '';
  const orig = g => (g.userData && g.userData.limbOrig) || g;

  // ------------------------------------------------------------------ cut geometry (cached per foe type and cut point)
  function skinnedList(model) { const list = []; model.root.traverse(n => { if (n.isSkinnedMesh && n.name !== 'rim_shell') list.push(n); }); return list; }
  function hash01(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  function skinFor(geo, v, out) {   // top-4 bone weights of vertex v as [i0..i3, w0..w3]
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    for (let k = 0; k < 4; k++) { out[k] = si.array[v * 4 + k]; out[4 + k] = sw.array[v * 4 + k]; }
    return out;
  }
  // One cap (fan of rings) for every closed loop of cut edges; sign +1 closes the corpse stump, -1 closes the severed piece.
  function capArrays(loops, sign, acc) {
    const tri = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3(), n = new T.Vector3(), skin = new Array(8);
    const S = [1, .72, .4], H = [0, .07, .14], COL = [[.24, .014, .018], [.6, .045, .055], [.8, .15, .11]], BONE = [.9, .8, .6];
    loops.forEach((lp, li) => {
      n.copy(lp.n).multiplyScalar(sign); const c = lp.c, R = lp.R;
      // ring 0 keeps the ragged cut edge; the inner rings are smooth circles in the cut plane (radius R * S[k]), lifted along n
      const P = (p, k) => {
        if (k === 0) return p.clone(); tri.copy(p).sub(c); tri.addScaledVector(n, -tri.dot(n)); const l = tri.length();
        if (l < 1e-9) return c.clone().addScaledVector(n, R * H[k]); return tri.multiplyScalar(R * S[k] / l).add(c).addScaledVector(n, R * H[k]).clone();
      };
      lp.edges.forEach((ed, ei) => {
        const jit = .75 + .5 * hash01(li * 977 + ei), a = ed.pa, b = ed.pb, sa = ed.sa, sb = ed.sb;
        const ring = [[], [], []]; for (let k = 0; k < 3; k++) { ring[k][0] = P(a, k); ring[k][1] = P(b, k); }
        const centre = c.clone().addScaledVector(n, R * .17);
        const colOf = k => COL[k].map(v => v * jit);
        const push = (p, col, s) => { acc.pos.push(p.x, p.y, p.z); acc.nor.push(n.x, n.y, n.z); acc.col.push(col[0], col[1], col[2]); for (let q = 0; q < 4; q++) acc.si.push(s[q]); for (let q = 0; q < 4; q++) acc.sw.push(s[4 + q]); };
        const tri3 = (p0, c0, s0, p1, c1, s1, p2, c2, s2) => {
          e1.subVectors(p1, p0); e2.subVectors(p2, p0); tri.crossVectors(e1, e2);
          if (tri.dot(n) < 0) { push(p0, c0, s0); push(p2, c2, s2); push(p1, c1, s1); } else { push(p0, c0, s0); push(p1, c1, s1); push(p2, c2, s2); }
        };
        for (let k = 0; k < 2; k++) {
          const ca = k === 0 ? colOf(0) : colOf(1), cb = k === 0 ? colOf(1) : colOf(2);
          tri3(ring[k][0], ca, sa, ring[k][1], ca, sb, ring[k + 1][1], cb, sb);
          tri3(ring[k][0], ca, sa, ring[k + 1][1], cb, sb, ring[k + 1][0], cb, sa);
        }
        const bone = BONE.map(v => v * jit);
        tri3(ring[2][0], colOf(2), sa, ring[2][1], colOf(2), sb, centre, bone, lp.skin);
      });
    });
  }
  function capGeometry(acc) {
    if (!acc.pos.length) return null;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(acc.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(acc.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(acc.col, 3));
    g.setAttribute('skinIndex', new T.Float32BufferAttribute(acc.si, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(acc.sw, 4));
    return g;
  }

  // Geometry builder: copies vertices of the source mesh (all attributes) plus new vertices made where the cut plane crosses an edge.
  function Builder(geo) { this.geo = geo; this.names = Object.keys(geo.attributes); this.data = this.names.map(() => []); this.map = new Map(); this.mids = new Map(); this.n = 0; this.idx = []; }
  Builder.prototype.orig = function (v) {
    let r = this.map.get(v); if (r !== undefined) return r; r = this.n++; this.map.set(v, r);
    for (let k = 0; k < this.names.length; k++) { const a = this.geo.attributes[this.names[k]], s = a.itemSize, d = this.data[k]; for (let c = 0; c < s; c++) d.push(a.array[v * s + c]); }
    return r;
  };
  Builder.prototype.mid = function (key, info) {
    let r = this.mids.get(key); if (r !== undefined) return r; r = this.n++; this.mids.set(key, r);
    for (let k = 0; k < this.names.length; k++) { const d = this.data[k], vals = info.vals[k]; for (let c = 0; c < vals.length; c++) d.push(vals[c]); }
    return r;
  };
  Builder.prototype.geometry = function () {
    if (!this.idx.length) return null; const g = new T.BufferGeometry();
    for (let k = 0; k < this.names.length; k++) { const a = this.geo.attributes[this.names[k]]; g.setAttribute(this.names[k], new T.BufferAttribute(new a.array.constructor(this.data[k]), a.itemSize, a.normalized)); }
    g.setIndex(this.n > 65535 ? new T.Uint32BufferAttribute(this.idx, 1) : new T.Uint16BufferAttribute(this.idx, 1)); return g;
  };
  const CHILD_RE = /^(lowerarm|forearm|hand|calf|shin|foot|tarsal)/i, PLANE_AT = { arm: .12, forearm: .05, leg: .1, shin: .05 };

  // Cuts the mesh of `model` with a plane at the joint of bone `ri` (roleId names the cut). Everything beyond the plane that belongs to the
  // bone chain (skin weights) becomes the piece; triangles the plane crosses are clipped, so the cut is clean and the caps close it exactly.
  function buildCut(model, skeleton, roleId, ri) {
    const bones = skeleton.bones, inSet = new Uint8Array(bones.length), joint = bones[ri];
    joint.traverse(o => { if (o.isBone) { const i = bones.indexOf(o); if (i >= 0) inSet[i] = 1; } });
    const bindPos = i => new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(skeleton.boneInverses[i]).invert());
    const P = new T.Vector3(), N = new T.Vector3(); let len;
    if (roleId === 'head') {
      const ni = bones.indexOf(joint.parent); if (ni < 0) return null;
      const a = bindPos(ni), b = bindPos(ri); N.subVectors(b, a); len = N.length(); P.lerpVectors(a, b, .55);
    } else {
      const child = joint.children.find(c => c.isBone && CHILD_RE.test(c.name)) || joint.children.find(c => c.isBone), ci = child ? bones.indexOf(child) : -1; if (ci < 0) return null;
      const a = bindPos(ri), b = bindPos(ci); N.subVectors(b, a); len = N.length(); P.lerpVectors(a, b, PLANE_AT[roleId]);
    }
    if (!(len > 1e-5)) return null; N.multiplyScalar(1 / len);
    const amp = len * .05, meshes = skinnedList(model), parts = [], stumpAcc = { pos: [], nor: [], col: [], si: [], sw: [] }, pieceAcc = { pos: [], nor: [], col: [], si: [], sw: [] }, usedBones = new Set();
    const q = new T.Vector3(), s8 = new Array(8);
    meshes.forEach((mesh, mi) => {
      const geo = orig(mesh.geometry), a = geo.attributes, index = geo.index; if (!index || !a.skinIndex || !a.skinWeight) return;
      const count = a.position.count, ia = index.array, tris = ia.length / 3, pos = a.position.array, bm = mesh.bindMatrix, w = new Float32Array(count), d = new Float32Array(count);
      const noiseQ = Math.max(1e-6, len * 1e-3);
      for (let v = 0; v < count; v++) {
        let s = 0; for (let k = 0; k < 4; k++) if (inSet[a.skinIndex.array[v * 4 + k]]) s += a.skinWeight.array[v * 4 + k]; w[v] = s;
        q.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]).applyMatrix4(bm);
        const h = hash01(Math.round(q.x / noiseQ) * 12.9898 + Math.round(q.y / noiseQ) * 78.233 + Math.round(q.z / noiseQ) * 37.719);
        d[v] = (q.x - P.x) * N.x + (q.y - P.y) * N.y + (q.z - P.z) * N.z + amp * (h * 2 - 1);
        if (d[v] === 0) d[v] = 1e-7;
      }
      const pb = new Builder(geo), rb = new Builder(geo), midInfo = new Map(), removed = [], segs = [];
      const midOf = (va, vb) => {
        const lo = Math.min(va, vb), hi = Math.max(va, vb), key = lo * count + hi; let info = midInfo.get(key);
        if (!info) {
          const t = d[lo] / (d[lo] - d[hi]), near = t < .5 ? lo : hi, vals = [];
          for (let k = 0; k < pb.names.length; k++) {
            const nm = pb.names[k], at = a[nm], s = at.itemSize, out = new Array(s);
            if (nm === 'skinIndex' || nm === 'skinWeight') for (let c = 0; c < s; c++) out[c] = at.array[near * s + c];
            else { for (let c = 0; c < s; c++) out[c] = at.array[lo * s + c] + (at.array[hi * s + c] - at.array[lo * s + c]) * t; if (nm === 'normal') { const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l; } }
            vals.push(out);
          }
          info = { vals, key, pos: new T.Vector3(pos[lo * 3] + (pos[hi * 3] - pos[lo * 3]) * t, pos[lo * 3 + 1] + (pos[hi * 3 + 1] - pos[lo * 3 + 1]) * t, pos[lo * 3 + 2] + (pos[hi * 3 + 2] - pos[lo * 3 + 2]) * t), skin: skinFor(geo, near, new Array(8)) };
          midInfo.set(key, info);
        }
        return info;
      };
      for (let t = 0; t < tris; t++) {
        const v0 = ia[t * 3], v1 = ia[t * 3 + 1], v2 = ia[t * 3 + 2];
        if ((w[v0] + w[v1] + w[v2]) / 3 < .2) continue;
        const u0 = d[v0] > 0, u1 = d[v1] > 0, u2 = d[v2] > 0; if (!(u0 || u1 || u2)) continue;
        removed.push(t);
        if (u0 && u1 && u2) { pb.idx.push(pb.orig(v0), pb.orig(v1), pb.orig(v2)); continue; }
        const vs = [v0, v1, v2], up = [], down = []; let outKey = 0, inKey = 0;
        for (let i = 0; i < 3; i++) {
          const va = vs[i], vb = vs[(i + 1) % 3], ua = d[va] > 0, ub = d[vb] > 0;
          (ua ? up : down).push({ v: va }); if (ua !== ub) { const m = midOf(va, vb); up.push({ m }); down.push({ m }); if (ua) outKey = m.key; else inKey = m.key; }
        }
        const emit = (poly, b) => { const ids = poly.map(p => p.m ? b.mid(p.m.key, p.m) : b.orig(p.v)); for (let i = 1; i + 1 < ids.length; i++) b.idx.push(ids[0], ids[i], ids[i + 1]); };
        emit(up, pb); emit(down, rb); segs.push([outKey, inKey]);
      }
      if (removed.length < 1) return;
      const pg = pb.geometry(); if (!pg) return;
      const part = { mi, pieceGeo: pg, restGeo: rb.geometry(), bindMatrix: mesh.bindMatrix.clone(), material: mesh.material, name: mesh.name, removed: Int32Array.from(removed) };
      parts.push(part);
      const pa2 = pg.attributes; for (let i = 0; i < pa2.position.count; i++) for (let k = 0; k < 4; k++) if (pa2.skinWeight.array[i * 4 + k] > 0) usedBones.add(pa2.skinIndex.array[i * 4 + k]);
      if (mesh.material && (mesh.material.transparent || mesh.material.name && /void|glow/i.test(mesh.material.name)) || segs.length < 4) return;
      // loops of the cut = connected components of the cut segments
      const parent = new Map(), findRoot = x => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(x) !== r) { const nx = parent.get(x); parent.set(x, r); x = nx; } return r; };
      segs.forEach(sg => { const ra = findRoot(sg[0]), rb2 = findRoot(sg[1]); if (ra !== rb2) parent.set(ra, rb2); });
      const groups = new Map(); segs.forEach(sg => { const r = findRoot(sg[0]); let g = groups.get(r); if (!g) groups.set(r, g = []); g.push(sg); });
      const stumpLoops = [], pieceLoops = [];
      groups.forEach(list => {
        if (list.length < 5) return;
        const c = new T.Vector3(), wsum = new Map(); let R = 0;
        list.forEach(sg => { c.add(midInfo.get(sg[0]).pos); const sk = midInfo.get(sg[0]).skin; for (let k = 0; k < 4; k++) wsum.set(sk[k], (wsum.get(sk[k]) || 0) + sk[4 + k]); });
        c.multiplyScalar(1 / list.length); list.forEach(sg => { R += midInfo.get(sg[0]).pos.distanceTo(c); }); R /= list.length; if (R < len * 1e-3) return;
        const top = Array.from(wsum.entries()).sort((x, y) => y[1] - x[1]).slice(0, 4), tot = top.reduce((s, e) => s + e[1], 0) || 1, cs = [0, 0, 0, 0, 0, 0, 0, 0];
        top.forEach((e, k) => { cs[k] = e[0]; cs[4 + k] = e[1] / tot; });
        const eds = list.map(sg => { const A = midInfo.get(sg[0]), Bm = midInfo.get(sg[1]); return { pa: A.pos.clone(), pb: Bm.pos.clone(), sa: A.skin.slice(), sb: Bm.skin.slice() }; });
        const lp = { c: c.clone(), n: N.clone(), R, edges: eds, skin: cs }; stumpLoops.push(lp); pieceLoops.push(lp);
      });
      capArrays(stumpLoops, 1, stumpAcc); capArrays(pieceLoops, -1, pieceAcc);
    });
    if (!parts.length) return null;
    for (let i = 0; i < pieceAcc.si.length; i++) if (pieceAcc.sw[i] > 0) usedBones.add(pieceAcc.si[i]);   // cap vertices are skinned to bones of the chain's neighbourhood too
    return { parts, stumpCap: capGeometry(stumpAcc), pieceCap: capGeometry(pieceAcc), used: Array.from(usedBones).filter(i => i < MAXBONES) };
  }

  // ------------------------------------------------------------------ the system
  function create(parent, world, hooks) {
    hooks = hooks || {};
    const fx = hooks.fx || function () {}, sound = hooks.sound || function () {}, emit = hooks.emit || function () {};
    const cache = new Map(), slots = [], stumps = [], cuts = [];
    let maxAlive = 12, low = false, serial = 0, disposed = false, warmLeft = 0, preparing = null;
    const group = new T.Group(); group.name = 'limbs'; parent.add(group);
    const M = new T.Matrix4(), M2 = new T.Matrix4(), Q1 = new T.Quaternion(), QT = new T.Quaternion(), V1 = new T.Vector3(), V2 = new T.Vector3(), V3 = new T.Vector3(), SC = new T.Vector3(1, 1, 1), proxy = { x: 0, z: 0 };

    function makeSlot() {
      const bones = [], inverses = [];
      for (let i = 0; i < MAXBONES; i++) { const b = new T.Bone(); b.matrixAutoUpdate = false; bones.push(b); inverses.push(new T.Matrix4()); }
      const skel = new T.Skeleton(bones, inverses), g = new T.Group(); g.visible = false; g.name = 'limb_piece'; g.matrixAutoUpdate = false;
      const warm = new T.BufferGeometry();   // one hidden triangle so the shader warm-up compiles the cap program before the first cut
      const z = [0, 0, 0, 0, 0, 0, 0, 0, 0]; warm.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)); warm.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      warm.setAttribute('color', new T.Float32BufferAttribute(z, 3)); warm.setAttribute('skinIndex', new T.Float32BufferAttribute(new Array(12).fill(0), 4)); warm.setAttribute('skinWeight', new T.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
      const cap = new T.SkinnedMesh(warm, capMaterial); cap.bind(skel, new T.Matrix4()); cap.frustumCulled = false; cap.castShadow = cap.receiveShadow = true; cap.matrixAutoUpdate = false; g.add(cap);
      group.add(g);
      const frozen = []; for (let i = 0; i < MAXBONES; i++) frozen.push(new T.Matrix4());
      return { g, skel, bones, inverses, cap, meshes: [], frozen, weapon: null, weaponFrozen: new T.Matrix4(), alive: false, used: [], serial: 0,
        p: new T.Vector3(), q: new T.Quaternion(), v: new T.Vector3(), w: new T.Vector3(), c0: new T.Vector3(), a0: new T.Vector3(), j0: new T.Vector3() };
    }
    for (let i = 0; i < 12; i++) slots.push(makeSlot());

    function freeSlot() {
      let best = null;
      for (let i = 0; i < maxAlive; i++) { const s = slots[i]; if (!s.alive) return s; if (!best || s.serial < best.serial) best = s; }
      return best;   // all busy: the oldest piece makes room
    }
    function release(s) { s.alive = false; s.g.visible = false; if (s.weapon) { s.g.remove(s.weapon); s.weapon = null; } }

    function pickBone(skeleton, roleId, side) {
      const role = ROLES[roleId];
      for (let i = 0; i < skeleton.bones.length; i++) { const n = skeleton.bones[i].name; if (role.re.test(n) && (!role.side || sideOf(n) === side)) return i; }
      return -1;
    }
    function ensureG2(enemy, mesh) {
      const g = mesh.geometry, base = orig(g); if (g !== base) return g;
      let map = enemy._limbG2 || (enemy._limbG2 = new Map()), g2 = map.get(base);
      if (!g2) {
        g2 = new T.BufferGeometry(); for (const n in base.attributes) g2.setAttribute(n, base.attributes[n]);
        const src = base.index.array, arr = new src.constructor(src); g2.setIndex(new T.BufferAttribute(arr, 1)); g2.index.setUsage(T.DynamicDrawUsage);
        g2.userData.limbOrig = base; g2.boundingSphere = base.boundingSphere; g2.boundingBox = base.boundingBox; map.set(base, g2);
      }
      return g2;
    }

    // Build every cut while the loading screen is still up. The same cached geometry is used by severOne;
    // clipping a whole character and allocating the cap arrays must not happen on its first killing blow.
    // yieldStep(done, total) lets the loader paint progress between cuts. No work is scheduled during play.
    function prepare(enemies, yieldStep) {
      if (preparing) return preparing;
      if (disposed) return Promise.resolve(stats());
      const jobs = [], types = new Set();
      (enemies || []).forEach(enemy => {
        if (!enemy || enemy.boss || !enemy.model || types.has(enemy.type)) return;
        types.add(enemy.type);
        const list = skinnedList(enemy.model); if (!list.length) return;
        const skeleton = list[0].skeleton; if (skeleton.bones.length > MAXBONES) return;
        Object.keys(ROLES).forEach(role => {
          (ROLES[role].side ? ['l', 'r'] : ['']).forEach(side => {
            const key = enemy.type + ':' + role + side, ri = pickBone(skeleton, role, side);
            if (!cache.has(key) && ri >= 0) jobs.push({ key, model: enemy.model, skeleton, role, ri });
          });
        });
      });
      const yieldNext = yieldStep || (() => new Promise(resolve => setTimeout(resolve, 0)));
      preparing = (async () => {
        for (let i = 0; i < jobs.length && !disposed; i++) {
          const job = jobs[i];
          if (!cache.has(job.key)) cache.set(job.key, buildCut(job.model, job.skeleton, job.role, job.ri));
          await yieldNext(i + 1, jobs.length);
        }
        return stats();
      })().finally(() => { preparing = null; });
      return preparing;
    }

    // Cached cut meshes are not attached to the scene until a cut occurs. Give
    // the loader their real geometry so its normal upload cache can warm them too.
    function warmGeometryObjects() {
      const objects = [], seen = new Set();
      const add = geometry => { if (geometry && !seen.has(geometry)) { seen.add(geometry); objects.push({ geometry }); } };
      cache.forEach(cut => {
        if (!cut) return;
        cut.parts.forEach(part => { add(part.pieceGeo); add(part.restGeo); });
        add(cut.stumpCap); add(cut.pieceCap);
      });
      return objects;
    }

    // Removes the cut's triangles from the corpse, adds the stump cap and launches the piece. Returns true on success.
    function severOne(enemy, roleId, side, o) {
      const model = enemy.model, list = skinnedList(model); if (!list.length) return false;
      const skeleton = list[0].skeleton, ri = pickBone(skeleton, roleId, side); if (ri < 0 || skeleton.bones.length > MAXBONES) return false;
      const key = enemy.type + ':' + roleId + side; let cut = cache.get(key);
      if (cut === undefined) { cut = buildCut(model, skeleton, roleId, ri); cache.set(key, cut); }
      if (!cut) return false;
      const info = enemy._limb || (enemy._limb = { cuts: [], caps: [], g2: [], weaponHidden: null, animate: null, t: 0, spasm: null });
      // corpse: drop the triangles (index copy per foe), cap the stump
      cut.parts.forEach(part => {
        const mesh = list[part.mi]; if (!mesh) return;
        const g2 = ensureG2(enemy, mesh), idx = g2.index.array, rem = part.removed;
        for (let i = 0; i < rem.length; i++) { const t = rem[i] * 3; idx[t] = idx[t + 1] = idx[t + 2] = 0; }
        g2.index.needsUpdate = true;
        model.root.traverse(n => { if (n.isSkinnedMesh && orig(n.geometry) === orig(g2) && n.geometry !== g2) n.geometry = g2; });
        mesh.geometry = g2; if (info.g2.indexOf(g2) < 0) info.g2.push(g2);
      });
      // the lower halves of the triangles the plane crossed, and the flesh cap, as skinned meshes on the corpse's own skeleton
      const first = list[0], addStump = (geo, material, name) => {
        const m = new T.SkinnedMesh(geo, material); m.bind(first.skeleton, first.bindMatrix); m.frustumCulled = false; m.castShadow = m.receiveShadow = true; m.name = name;
        first.parent.add(m); info.caps.push(m);
      };
      cut.parts.forEach(part => { if (part.restGeo) addStump(part.restGeo, part.material, 'limb_rest'); });
      if (cut.stumpCap) addStump(cut.stumpCap, capMaterial, 'limb_stump');
      const joint = skeleton.bones[ri], scale = (model.height || 2.2) / 2.2, role = ROLES[roleId];
      model.root.updateMatrixWorld(true);
      // hand cut: the weapon leaves with the hand
      const wep = model.bones && model.bones.weapon, holdsWeapon = wep && wep.visible && isUnder(wep, joint);
      // pose of the piece at the kill frame
      const s = freeSlot(); if (s.alive) release(s);
      s.alive = true; s.serial = ++serial; s.age = 0; s.rest = 0; s.bounces = 0; s.fade = 0; s.trail = 0; s.round = !!role.round; s.scale = 1;
      s.used = cut.used; s.lowFx = low;
      cut.used.forEach(i => { s.frozen[i].copy(skeleton.bones[i].matrixWorld); s.inverses[i].copy(skeleton.boneInverses[i]); s.bones[i].matrixWorld.copy(s.frozen[i]); });
      joint.getWorldPosition(s.j0);
      let far = 0; skeleton.bones.forEach(b => { if (isUnder(b, joint)) { b.getWorldPosition(V1); far = Math.max(far, V1.distanceTo(s.j0)); } });
      if (role.round) {   // the head: up the neck from the joint
        const par = joint.parent; if (par && par.isBone) { par.getWorldPosition(V1); s.a0.subVectors(s.j0, V1); } else s.a0.copy(UP);
        if (s.a0.lengthSq() < 1e-8) s.a0.copy(UP); s.a0.normalize(); s.L = .27 * scale;
      } else {
        // limb axis: from the joint to the farthest bone of the chain
        let best = 0; s.a0.set(0, -1, 0); skeleton.bones.forEach(b => { if (isUnder(b, joint)) { b.getWorldPosition(V1); const d = V1.distanceTo(s.j0); if (d > best) { best = d; s.a0.subVectors(V1, s.j0); } } });
        s.a0.normalize(); s.L = Math.max(.2 * scale, far + .06 * scale);
      }
      s.r = role.r * scale; s.h = Math.max(0, s.L * .5 - s.r * .5);
      s.c0.copy(s.j0).addScaledVector(s.a0, s.L * .5);
      s.p.copy(s.c0); s.q.identity();
      // throw: along the blade, up, with spin
      const heavy = o.kind === 'heavy' || o.kind === 'finisher' || o.kind === 'whirlLast', dirA = o.face + rnd(-.35, .35);
      const speed = (heavy ? rnd(4.2, 6.4) : rnd(2.6, 4.2)) * (role.round ? .85 : 1);
      s.v.set(Math.sin(dirA) * speed, (role.round ? rnd(3.6, 5.2) : rnd(2.4, 4.4)) * (heavy ? 1.1 : .9), Math.cos(dirA) * speed);
      const spin = (role.round ? rnd(9, 18) : rnd(7, 15)) * (Math.random() < .5 ? -1 : 1);
      s.w.set(Math.cos(dirA) * spin, rnd(-6, 6), -Math.sin(dirA) * spin);
      // assemble the meshes
      cut.parts.forEach((part, j) => {
        let m = s.meshes[j];
        if (!m) { m = new T.SkinnedMesh(part.pieceGeo, part.material); m.frustumCulled = false; m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; s.g.add(m); s.meshes[j] = m; }
        m.geometry = part.pieceGeo; m.material = part.material; m.bind(s.skel, part.bindMatrix); m.visible = true;
      });
      for (let j = cut.parts.length; j < s.meshes.length; j++) s.meshes[j].visible = false;
      if (cut.pieceCap) { s.cap.geometry = cut.pieceCap; s.cap.visible = true; } else s.cap.visible = false;
      if (holdsWeapon) {
        wep.updateWorldMatrix(true, true); s.weaponFrozen.copy(wep.matrixWorld);
        const clone = wep.clone(true); clone.matrixAutoUpdate = false; clone.visible = true; clone.traverse(n => { n.matrixAutoUpdate = false; });
        if (s.weapon) s.g.remove(s.weapon); s.weapon = clone; s.g.add(clone); info.weaponHidden = wep; wep.visible = false;
        // the clone keeps the local matrices of its children; only the top matrix is driven
        clone.matrixAutoUpdate = false;
      } else if (s.weapon) { s.g.remove(s.weapon); s.weapon = null; }
      s.g.visible = true; placePiece(s);
      info.cuts.push(roleId + side);
      // the stump keeps bleeding, the body twitches
      stumps.push({ enemy, bone: joint, t: 0, next: 0, power: role.round ? 1.35 : 1, angle: Math.atan2(s.a0.x, s.a0.z), head: !!role.round });
      // first gush
      const jw = s.j0; spurt(jw.x, jw.y, jw.z, o.face, role.round ? 1.6 : 1.2, true);
      return true;
    }
    function isUnder(n, parentObj) { for (let p = n; p; p = p.parent) if (p === parentObj) return true; return false; }

    function spurt(x, y, z, angle, power, big) {
      // BLOOD may replace B.Limbs.spurt with its own stump effect; the default uses the ordinary blood burst (no damage number, no gear stain).
      if (typeof B.Limbs.spurt === 'function') { B.Limbs.spurt(fx, x, y, z, angle, power, big); return; }
      // BLOOD's dedicated stump jet (heartbeat spurts, drips, drag smears) when available; else the ordinary blood burst.
      if (B.Effects && typeof B.Effects.gore === 'function' && B.Effects.current) { B.Effects.gore('stump', x, y, z, Math.sin(angle), Math.cos(angle), Math.min(2, .6 + power * .5 + (big ? .3 : 0))); return; }
      defaultSpurt(fx, x, y, z, angle, power, big);
    }
    function defaultSpurt(f, x, y, z, angle, power, big) {
      f('blood', { x, y, z, player: true, damage: 0, heavy: power > 1 || big, face: angle, spray: angle + rnd(-1.1, 1.1), kill: false });
    }

    function placePiece(s) {
      const sc = s.scale;
      M.compose(s.p, s.q, SC.set(sc, sc, sc)); M2.makeTranslation(-s.c0.x, -s.c0.y, -s.c0.z); M.multiply(M2);
      for (let i = 0; i < s.used.length; i++) { const b = s.used[i]; s.bones[b].matrixWorld.multiplyMatrices(M, s.frozen[b]); }
      if (s.weapon) s.weapon.matrix.multiplyMatrices(M, s.weaponFrozen);
      s.g.updateMatrixWorld(true);
    }
    function stepPiece(s, dt) {
      s.age += dt;
      if (s.rest > 0) {   // at rest: wait, then shrink away
        s.rest += dt; if (s.rest > 24) { s.scale = Math.max(0, 1 - (s.rest - 24) / 1.6); if (s.scale <= 0) { release(s); return; } placePiece(s); }
        return;
      }
      const sub = 2, h = dt / sub;
      for (let it = 0; it < sub; it++) {
        s.v.y -= GRAVITY * h;
        // horizontal move, stopped by walls
        proxy.x = s.p.x; proxy.z = s.p.z; const dx = s.v.x * h, dz = s.v.z * h;
        if (world && world.move) { world.move(proxy, dx, dz, .14); const mx = proxy.x - s.p.x, mz = proxy.z - s.p.z; if (Math.abs(mx) < Math.abs(dx) * .5) s.v.x *= -.35; if (Math.abs(mz) < Math.abs(dz) * .5) s.v.z *= -.35; s.p.x = proxy.x; s.p.z = proxy.z; }
        else { s.p.x += dx; s.p.z += dz; }
        s.p.y += s.v.y * h;
        const wl = s.w.length(); if (wl > 1e-4) { Q1.setFromAxisAngle(V1.copy(s.w).multiplyScalar(1 / wl), wl * h); s.q.premultiply(Q1); }
        V2.copy(s.a0).applyQuaternion(s.q);
        const reach = s.round ? s.r : Math.abs(V2.y) * s.h + s.r, low = s.p.y - reach;
        if (low < 0) {
          s.p.y -= low;
          if (s.v.y < -.5) {   // bounce
            s.v.y = -s.v.y * .32; s.v.x *= .62; s.v.z *= .62; s.w.multiplyScalar(.6); s.w.x += rnd(-2, 2); s.w.z += rnd(-2, 2); s.bounces++;
            if (s.bounces <= 3) { sound('hit', { volume: s.bounces === 1 ? .55 : .3, x: s.p.x, z: s.p.z }); }
            if (s.bounces <= 2) { V3.set(s.p.x, .15, s.p.z); spurtFloor(s, V3, s.bounces === 1 ? 1 : .6); }
          } else {
            s.v.y = 0; const fr = s.round ? 1.7 : 6; s.v.x *= Math.exp(-h * fr); s.v.z *= Math.exp(-h * fr);
            if (s.round) { V3.set(-s.v.z, 0, s.v.x).multiplyScalar(1 / s.r); s.w.lerp(V3, 1 - Math.exp(-h * 7)); }   // the head rolls
            else { s.w.multiplyScalar(Math.exp(-h * 4.5)); alignFlat(s, h); }
          }
        }
      }
      // smear while sliding / rolling, then a drip trail while flying
      s.trail -= dt; const sp = Math.hypot(s.v.x, s.v.z);
      if (s.trail <= 0 && s.age < 2.6) {
        const airborne = s.p.y > s.r + .12;
        if (airborne || sp > 1.1) { s.trail = airborne ? (s.lowFx ? .16 : .085) : (s.lowFx ? .32 : .2); V3.copy(s.j0).sub(s.c0).applyQuaternion(s.q).add(s.p); spurt(V3.x, Math.max(.06, V3.y), V3.z, Math.atan2(s.v.x, s.v.z) + Math.PI, airborne ? .8 : .5, false); }
      }
      const still = sp < .18 && s.w.lengthSq() < 1.4 && s.p.y <= s.r + .05 + Math.abs(V2.y) * s.h;
      if (still && s.bounces > 0) { s.rest = .001; s.v.set(0, 0, 0); s.w.set(0, 0, 0); if (!s.lowFx || s.serial % 2) { V3.set(s.p.x, .15, s.p.z); spurtFloor(s, V3, 1); } }
      placePiece(s);
    }
    function spurtFloor(s, at, power) { fx('blood', { x: at.x, y: at.y, z: at.z, player: true, damage: 0, heavy: power > .9, face: rnd(0, 6.283), kill: false }); }
    // lay a limb flat: rotate its axis toward the horizontal
    function alignFlat(s, h) {
      V2.copy(s.a0).applyQuaternion(s.q); if (Math.abs(V2.y) < .04) return;
      V3.set(V2.x, 0, V2.z); if (V3.lengthSq() < 1e-6) V3.set(1, 0, 0); V3.normalize();
      Q1.setFromUnitVectors(V2, V3); QT.identity().slerp(Q1, 1 - Math.exp(-h * 9)); s.q.premultiply(QT);
    }

    function update(dt) {
      if (disposed) return;
      if (warmLeft > 0) warmLeft--;
      dt = Math.min(dt, 1 / 30);
      for (let i = 0; i < slots.length; i++) { const s = slots[i]; if (s.alive) stepPiece(s, dt); }
      for (let i = stumps.length - 1; i >= 0; i--) {
        const st = stumps[i], e = st.enemy; st.t += dt;
        if (st.t > (st.head ? 3.2 : 2.4) || !e._limb) { stumps.splice(i, 1); continue; }
        st.next -= dt;
        if (st.next <= 0 && e.model.root.visible) {
          st.bone.getWorldPosition(V1); const k = 1 - st.t / (st.head ? 3.2 : 2.4), pulse = .5 + .5 * Math.sin(st.t * 9);
          st.next = (.1 + st.t * .07) * (low ? 1.8 : 1) * (1.25 - pulse * .5);
          spurt(V1.x, V1.y, V1.z, st.angle + rnd(-1.3, 1.3), st.power * k * (.6 + pulse), false);
        }
      }
    }

    // The killing blow. `rand` is the foe's own seeded generator (0..1). Returns the number of parts severed.
    function cutFoe(enemy, kind, face, rand, player) {
      if (disposed || enemy.boss || !enemy.model || !enemy.model.root) return 0;
      const chance = CHANCE[kind]; if (!(chance > 0) || rand() >= chance) return 0;
      const strong = kind === 'heavy' || kind === 'finisher' || kind === 'whirlLast', o = { kind, face };
      const table = strong ? [['head', .3], ['arm', .16], ['forearm', .2], ['leg', .12], ['shin', .16]] : [['head', .08], ['arm', .3], ['forearm', .3], ['leg', .12], ['shin', .2]];
      const made = [];
      const wanted = B.Limbs.force ? B.Limbs.force.length : 1 + (!low && rand() < (kind === 'finisher' ? .45 : strong ? .35 : .12) ? 1 : 0);
      const list = skinnedList(enemy.model); if (!list.length) return 0; const skeleton = list[0].skeleton;
      for (let n = 0; n < wanted; n++) {
        const opts = table.filter(t => !made.some(m => CLASH[t[0]].indexOf(m.role) >= 0));
        // choose role, then the side nearer to the hero
        let sum = 0; opts.forEach(t => { sum += t[1]; }); if (!opts.length) break;
        let pick = rand() * sum, role = opts[0][0]; for (const t of opts) { pick -= t[1]; if (pick <= 0) { role = t[0]; break; } }
        if (B.Limbs.force && n < B.Limbs.force.length) role = B.Limbs.force[n][0];   // QA only
        let side = '';
        if (ROLES[role].side) {
          const li = pickBone(skeleton, role, 'l'), ri = pickBone(skeleton, role, 'r'); let sl = 'l';
          if (li >= 0 && ri >= 0 && player) {
            skeleton.bones[li].getWorldPosition(V1); skeleton.bones[ri].getWorldPosition(V2);
            const dl = Math.hypot(V1.x - player.x, V1.z - player.z), dr = Math.hypot(V2.x - player.x, V2.z - player.z); sl = dl < dr ? 'l' : 'r'; if (rand() < .25) sl = sl === 'l' ? 'r' : 'l';
          } else if (li < 0) sl = 'r';
          side = sl;
          if (B.Limbs.force && n < B.Limbs.force.length && B.Limbs.force[n][1]) side = B.Limbs.force[n][1];
        }
        if (severOne(enemy, role, side, o)) { made.push({ role, side }); }
      }
      if (made.length) {
        const info = enemy._limb; hookBody(enemy, info);
        sound('heavyHit', { volume: 1 }); emit('sever', { x: enemy.x, z: enemy.z, parts: made.length, head: made.some(m => m.role === 'head') });
      }
      return made.length;
    }
    // death spasm: after the model's own pose each frame the spine gets a fading shake
    function hookBody(enemy, info) {
      if (info.animate) return; const model = enemy.model, animate = model.animate; info.animate = animate; info.t = 0;
      const bones = []; model.root.traverse(n => { if (n.isBone && /^(spine_0?[123]|spine0?[123]|pelvis)$/i.test(n.name)) bones.push(n); });
      model.animate = function (dt, state) {
        animate.call(model, dt, state);
        if (state && state.dead && info.t < 1.9) {
          info.t += dt; const k = Math.exp(-info.t * 1.7) * (info.t < .09 ? info.t / .09 : 1), t = info.t;
          for (let i = 0; i < bones.length; i++) {
            const a = k * (.16 * Math.sin(t * 37 + i * 1.7) + .1 * Math.sin(t * 23 + i * 4.1)) * (i + 1) / bones.length;
            bones[i].rotateX(a); bones[i].rotateZ(a * .7);
          }
        }
      };
    }
    function restore(enemy) {
      const info = enemy._limb; if (!info) return;
      for (let i = stumps.length - 1; i >= 0; i--) if (stumps[i].enemy === enemy) stumps.splice(i, 1);
      const model = enemy.model;
      info.g2.forEach(g2 => {
        const base = orig(g2), src = base.index.array; g2.index.array.set(src); g2.index.needsUpdate = true;
        model.root.traverse(n => { if (n.isSkinnedMesh && n.geometry === g2) n.geometry = base; });
      });
      info.caps.forEach(c => c.removeFromParent());
      if (info.weaponHidden) info.weaponHidden.visible = true;
      if (info.animate) model.animate = info.animate;
      enemy._limb = null;
    }
    function reset(enemies) {
      slots.forEach(release); stumps.length = 0;
      if (enemies) enemies.forEach(restore);
    }
    function setQuality(settings) {
      low = !!(settings && Number.isFinite(settings.particles) && settings.particles < 300);
      maxAlive = low ? 6 : 12;
      for (let i = maxAlive; i < slots.length; i++) if (slots[i].alive) release(slots[i]);
    }
    function dispose() {
      if (disposed) return; disposed = true; slots.forEach(release);
      slots.forEach(s => { s.skel.dispose(); s.cap.geometry.dispose(); });
      cache.forEach(c => { if (c) { c.parts.forEach(p => { p.pieceGeo.dispose(); if (p.restGeo) p.restGeo.dispose(); }); if (c.stumpCap) c.stumpCap.dispose(); if (c.pieceCap) c.pieceCap.dispose(); } });
      cache.clear(); group.removeFromParent();
    }
    function stats() { return { alive: slots.filter(s => s.alive).length, stumps: stumps.length, cached: cache.size, children: group.children.length, meshes: slots.reduce((n, s) => n + s.meshes.length, 0) }; }
    return { prepare, warmGeometryObjects, cut: cutFoe, update, reset, restore, setQuality, dispose, stats, chance: CHANCE, slots };
  }
  B.Limbs = { create, CHANCE, spurt: null, force: null };
})();
