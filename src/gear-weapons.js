/* KABİR AZABI — gear: hand-built hero weapons (swords, axes, spears).
   Every catalog weapon owns its silhouette: forged double/single edges with fullers and serrations, layered guards,
   wrapped grips with wire, pommels with gems or skulls, langets, rivets, cloth tassels, engraved rune inlays and,
   for epic/unique pieces, glowing channels (ember, frost, venom, void, holy, gore). One merged mesh per surface key;
   the frame matches equipment-art.js (grip on -Y, blade/head on +Y, edge toward +X for swords, -X for axe bits). */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE, PI = Math.PI, TAU = PI * 2;
  const mix = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  // Elder-futhark-like glyph strokes in a unit cell (x -.5..5, y 0..1).
  const GLYPHS = [
    [[[0,0],[0,1]],[[0,.75],[.42,1]],[[0,.5],[.42,.75]]],
    [[[-.28,0],[-.28,1],[.28,.68],[.28,0]]],
    [[[-.2,0],[-.2,1]],[[-.2,.72],[.25,.5],[-.2,.28]]],
    [[[-.2,0],[-.2,1]],[[-.2,1],[.25,.76]],[[-.2,.74],[.25,.5]]],
    [[[-.25,0],[-.25,1],[.2,.78],[-.25,.55],[.2,0]]],
    [[[.25,1],[-.2,.5],[.25,0]]],
    [[[-.3,0],[.3,1]],[[.3,0],[-.3,1]]],
    [[[-.25,0],[-.25,1]],[[.25,0],[.25,1]],[[-.25,.65],[.25,.35]]],
    [[[0,0],[0,1]],[[-.25,.65],[.25,.35]]],
    [[[0,0],[0,1]],[[-.3,1],[0,.62],[.3,1]]],
    [[[-.25,1],[-.25,.62],[.25,.38],[.25,0]]],
    [[[0,0],[0,1]],[[-.3,.7],[0,1],[.3,.7]]],
    [[[-.2,0],[-.2,1],[.2,.78],[-.2,.5],[.2,.24],[-.2,0]]],
    [[[-.25,0],[-.25,1],[.25,.58]],[[.25,0],[.25,1],[-.25,.58]]],
    [[[-.3,0],[.22,.56],[0,.88],[-.22,.56],[.3,0]]],
    [[[0,0],[0,1]],[[0,1],[.25,.8]],[[0,0],[-.25,.2]]]
  ];
  // gear-*: lighter tessellation for hidden-until-equipped parts (iPad memory); silhouettes keep their shape.
  const lodGear = (S, k) => Object.assign({}, S, {
    tube: (p, r, rad, tub, caps) => S.tube(p, r, Math.max(3, Math.round((rad || 8) * .75)), Math.max(2, Math.ceil((tub || Math.max(4, p.length * 5)) * k)), caps),
    shell: (nu, nv, fn, t, c, f, o) => S.shell(Math.max(2, Math.round(nu * k)), Math.max(1, Math.round(nv * k)), fn, t, c, f, o),
    sphere: (r, p, s, ws, hs) => S.sphere(r, p, s, Math.max(6, Math.round((ws || 14) * .7)), Math.max(4, Math.round((hs || 10) * .7))),
    lathe: (pr, seg, a, b) => S.lathe(pr, Math.max(8, Math.round((seg || 24) * .7)), a, b) });
  function build(ctx) {
    const G = lodGear(B.Gear, .6), { equipmentWeapon } = ctx, out = {};
    const KEYS = ['steel','edge','dark','brass','leather','wood','bone','gold','black','gem','crimson','sable','horn','hide','ember','frost','venom','void','holy','gore','rag','cloth','silver','strap','bronze','salt','rust'];
    const parts = () => { const P = {}; KEYS.forEach(k => P[k] = []); return P; };
    const v3 = a => new T.Vector3().fromArray(a);
    const GLOWS = new Set(['ember', 'frost', 'venom', 'void', 'holy', 'gore']);
    const grand = id => { const it = B.Progression && B.Progression.catalog[id]; return it && (it.rarity === 'epic' || it.rarity === 'boss'); };
    const bz = (u, thick, fuller, bev) => { let z = thick * .5 * (1 - .3 * u); if (fuller && u > fuller[0] && u < fuller[1]) z -= thick * .26 * Math.sin((u - fuller[0]) / (fuller[1] - fuller[0]) * PI); if (u > 1 - bev) z *= 1 - (u - (1 - bev)) / bev * .94; return z; };
    const line = (fn, n) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
    // mirror x about the curve c(y) (double-edged blades); winding is restored.
    function mirror(g, c) {
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, 2 * c(y) - p.getX(i)); }
      const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      g.computeVertexNormals(); return g;
    }
    // Rune strokes on a surface: cell centred at (x,y) on plane z, height h. side ±1 mirrors for the back face.
    function runes(list, key, count, at, h, seed, r) {
      for (let i = 0; i < count; i++) {
        const q = at(i, count); if (!q) continue;
        const gl = GLYPHS[(seed * 7 + i * 5) % GLYPHS.length];
        for (const side of [1, -1]) for (const s of gl) {
          const pts = s.map(([gx, gy]) => [q[0] + gx * h * .62 * (q[3] || 1), q[1] + (gy - .5) * h, side * q[2]]);
          // Straight strokes: densify so the Catmull-Rom tube keeps sharp corners.
          const dense = []; for (let k = 0; k < pts.length - 1; k++) for (let t = 0; t < 1; t += .34) dense.push(pts[k].map((v, d) => mix(v, pts[k + 1][d], t)));
          dense.push(pts[pts.length - 1]);
          list[key].push(G.tube(dense, r || .0011, 3, dense.length, true));
        }
      }
    }
    // Cloth tassel / prayer strips hanging from p (weapon frame), plus its cord.
    function tassel(P, p, len, key, strands, seed) {
      P.dark.push(G.ring(.009, .0022, [p[0], p[1] - .004, p[2]], [PI / 2, 0, 0], 6, 16));
      const knot = [p[0], p[1] - .03, p[2]];
      P.brass.push(G.tube([[p[0], p[1] - .012, p[2]], knot], .0026, 6, 4, true));
      P.brass.push(G.sphere(.0075, knot, [1, 1.3, 1], 10, 8));
      for (let s = 0; s < strands; s++) {
        const a = (s / strands) * TAU + seed, dx = Math.cos(a) * .006, dz = Math.sin(a) * .006, L = len * (.82 + .3 * G.hash(s, seed, 3));
        const strip = (u, v) => [knot[0] + dx * (1 + v * 2.2) + (u - .5) * .011 * Math.cos(a + PI / 2) + Math.sin(v * 3 + s) * .008 * v, knot[1] - .006 - v * L, knot[2] + dz * (1 + v * 2.2) + (u - .5) * .011 * Math.sin(a + PI / 2)];
        P[key].push(G.shell(2, 10, strip, .0016, false));
      }
    }
    function grip(P, len, r, y0, o) {
      o = o || {}; const g = G.grip(len, r, o.wraps || 12, y0);
      P.dark.push(...g.dark); P[o.wrap || 'leather'].push(...g.leather); P[o.ring || 'brass'].push(...g.iron);
      if (o.wire) { // twisted wire laid in the grooves between leather turns
        const turns = o.wraps || 12, pts = [];
        for (let i = 0; i <= turns * 14; i++) { const t = i / (turns * 14), a = t * turns * TAU + PI / turns; pts.push([Math.cos(a) * r * 1.13, y0 + .012 + t * (len - .024), Math.sin(a) * r * 1.13]); }
        P[o.wire].push(G.tube(pts, r * .085, 3, Math.ceil(pts.length * .6), true));
      }
    }
    // ----------------------------------------------------------------- pommels
    function pommel(P, type, y, o) {
      o = o || {}; const m = o.mat || 'steel';
      if (type === 'wheel') {
        const g = G.lathe([[0, -.03], [.02, -.031], [.036, -.022], [.042, 0], [.036, .022], [.02, .031], [0, .03]], 28); g.rotateX(PI / 2); g.scale(1, 1, .55); g.translate(0, y - .03, 0); P[m].push(g);
        P[o.trim || 'brass'].push(G.sphere(.011, [0, y - .03, .016], [1, 1, .55], 12, 8), G.sphere(.011, [0, y - .03, -.016], [1, 1, .55], 12, 8));
        const ring = new T.TorusGeometry(.039, .0035, 6, 32); ring.translate(0, y - .03, 0); P[o.trim || 'brass'].push(ring);
      } else if (type === 'stopper') {
        P[m].push(G.lathe([[0, -.062], [.013, -.06], [.028, -.045], [.034, -.022], [.03, -.004], [.019, .006], [0, .008]], 8).translate(0, y, 0));
        P[o.trim || 'brass'].push(G.ring(.021, .0028, [0, y - .002, 0], null, 6, 24));
        P[m].push(G.lathe([[0, -.078], [.01, -.075], [.007, -.062], [0, -.062]], 12).translate(0, y, 0));
      } else if (type === 'gem') {
        const t = o.trim || 'gold';
        P[t].push(G.lathe([[0, -.012], [.03, -.008], [.026, .008], [0, .012]], 24).translate(0, y, 0));
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P[t].push(G.tube([[Math.cos(a) * .024, y - .008, Math.sin(a) * .024], [Math.cos(a) * .03, y - .04, Math.sin(a) * .03], [Math.cos(a) * .012, y - .072, Math.sin(a) * .012]], .0028, 5, 10, true)); }
        P[o.gem || 'gem'].push(G.sphere(.024, [0, y - .042, 0], [1, 1.15, 1], 10, 8));
        P[t].push(G.lathe([[0, -.082], [.006, -.08], [.004, -.07], [0, -.068]], 10).translate(0, y, 0));
      } else if (type === 'skull') {
        const sk = G.skull(.05, true);
        sk.parts.bone.forEach(g => { g.rotateX(PI); g.translate(0, y - .045, 0); P.bone.push(g); });
        sk.parts.void.forEach(g => { g.rotateX(PI); g.translate(0, y - .045, 0); P[o.eyes || 'black'].push(g); });
        P[o.trim || 'black'].push(G.ring(.022, .004, [0, y - .004, 0], null, 6, 24));
      } else if (type === 'ring') {
        P[m].push(G.lathe([[0, -.02], [.019, -.018], [.022, 0], [0, .004]], 16).translate(0, y, 0));
        const r = new T.TorusGeometry(.03, .0055, 8, 32); r.translate(0, y - .05, 0); P[m].push(r);
      } else { // disc
        P[m].push(G.lathe([[0, -.04], [.03, -.036], [.038, -.02], [.034, 0], [.02, .008], [0, .01]], 24).translate(0, y, 0));
        P[o.trim || 'brass'].push(G.ring(.036, .003, [0, y - .02, 0], null, 6, 28));
      }
    }
    // ----------------------------------------------------------------- guards
    function guard(P, type, o) {
      o = o || {}; const m = o.mat || 'dark', t = o.trim || 'brass', w = o.width || .19;
      if (type === 'bar') {
        P[m].push(G.extrude([[-w, .025], [-w * .92, .05], [0, .058], [w * .92, .05], [w, .025], [w * .9, .012], [0, .02], [-w * .9, .012]], .036, .005));
        return;
      }
      if (type === 'cross' || type === 'beast' || type === 'wave' || type === 'crown' || type === 'lug') {
        // central langet block (écusson) with a pointed tongue over the blade
        P[m].push(G.extrude([[-.036, .02], [.036, .02], [.04, .05], [.014, .082], [0, .094], [-.014, .082], [-.04, .05]], .034, .004));
        P[t].push(G.tube([[-.036, .021, .0215], [0, .019, .0215], [.036, .021, .0215]], .0018, 4, 8, true), G.tube([[-.036, .021, -.0215], [0, .019, -.0215], [.036, .021, -.0215]], .0018, 4, 8, true));
        for (const s of [1, -1]) P[o.gem ? 'gem' : t].push(G.sphere(o.gem ? .009 : .0065, [0, .05, s * .021], [1, 1.25, .5], 10, 8));
      }
      if (type === 'cross') {
        for (const s of [-1, 1]) {
          const arm = line(u => [s * mix(.045, w, u), .04 - .045 * u * u * (o.droop || 1), 0], 12);
          P[m].push(G.tube(arm, u => mix(.016, .010, u), 8, 24, true));
          const end = arm[arm.length - 1];
          P[t].push(G.sphere(.016, [end[0] + s * .006, end[1] - .004, 0], [1, 1, 1], 12, 8));
          // engraved twist line along each arm
          P[t].push(G.tube(line(u => { const p = arm[Math.round(u * 12)]; const a = u * 7 * PI; return [p[0], p[1] + Math.cos(a) * .011, Math.sin(a) * .011]; }, 40), .0016, 4, 60, true));
        }
      } else if (type === 'beast') { // horned guard curling toward the blade
        for (const s of [-1, 1]) {
          const horn = line(u => [s * (.045 + .12 * Math.sin(u * PI * .62)), .035 + .16 * u * u - .02 * u, -.01 * Math.sin(u * PI)], 18);
          P[o.horn || 'horn'].push(G.tube(horn, u => mix(.02, .002, Math.pow(u, .8)), 10, 36, true));
          for (let k = 1; k < 5; k++) { const p = horn[k * 3]; P[t].push(G.ring(mix(.02, .006, k * 3 / 18) + .002, .0018, p, [0, 0, s * (.5 + k * .25)], 5, 18)); }
        }
      } else if (type === 'wave') {
        for (const s of [-1, 1]) {
          const curl = line(u => { const a = u * 1.6 * PI, r = mix(.07, .018, u); return [s * (.05 + .07 * u + Math.sin(a) * r * .5), .04 + Math.cos(a) * r * .55 - .02, 0]; }, 22);
          P[m].push(G.tube(curl, u => mix(.013, .004, u), 8, 40, true));
          P[t].push(G.tube(curl.map(p => [p[0], p[1], .011]), .0016, 4, 40, true), G.tube(curl.map(p => [p[0], p[1], -.011]), .0016, 4, 40, true));
        }
      } else if (type === 'crown') {
        const crown = [];
        for (let i = 0; i < 7; i++) {
          const x = mix(-w, w, i / 6), h = (i % 2 ? .06 : .11) * (1 - Math.abs(x) / w * .35);
          crown.push(G.extrude([[x - .022, .02], [x + .022, .02], [x + .008, .02 + h * .6], [x, .02 + h], [x - .008, .02 + h * .6]], .016, .003));
        }
        P[t].push(...crown);
        P[t].push(G.extrude([[-w - .02, -.004], [w + .02, -.004], [w + .028, .03], [-w - .028, .03]], .04, .005));
        for (let i = 0; i < 4; i++) P.gem.push(G.sphere(.007, [mix(-w * .8, w * .8, i / 3), .013, .024], [1, 1, .55], 8, 6));
      } else if (type === 'lug') { // straight long quillons with parrying lugs
        for (const s of [-1, 1]) {
          P[m].push(G.extrude([[s * .05, .025], [s * w, .034], [s * (w + .02), .05], [s * w, .062], [s * .05, .058]].map(p => p), .03, .004));
          P[t].push(G.sphere(.012, [s * (w + .026), .048, 0], [1, 1, 1], 10, 8));
        }
      }
    }
    // ----------------------------------------------------------------- sword
    function sword(id, o) {
      const P = parts(), top = o.top, y0 = o.base || .055, curve = o.curve || (() => 0), thick = o.thick || .03;
      const width = o.width; // fn(t) half width
      const serr = o.serr || 0, chips = o.chips || [];
      const edgeAt = (y, sideSign) => {
        const t = clamp((y - y0) / (top - y0), 0, 1); let w = width(t);
        if (serr && t > .08 && t < .82) { const f = (y * serr) % 1; w -= .012 * Math.pow(f, 1.6) * sm((t - .08) / .1); }
        for (const c of chips) if (c[2] === sideSign || !c[2]) w -= c[1] * Math.max(0, 1 - Math.abs(t - c[0]) / .02);
        return Math.max(.0008, w);
      };
      const rows = serr ? 150 : 64;
      if (o.single) { // single-edged: spine at -X, edge +X
        const spine = o.spine || (t => .02 + .01 * (1 - t));
        const b = G.blade(y0, top, rows, y => { const t = (y - y0) / (top - y0); const c = curve(t); return [c - spine(t) * (t > .92 ? 1 - (t - .92) / .08 * .9 : 1), c + edgeAt(y, 1)]; }, thick, .26, o.fuller || [.12, .42]);
        P.steel.push(b.body); P.edge.push(b.edge);
      } else {
        const c = y => curve(clamp((y - y0) / (top - y0), 0, 1));
        const half = s => G.blade(y0, top, rows, y => [c(y), c(y) + edgeAt(y, s)], thick, .3, o.fuller || [-.3, .3]);
        const R = half(1), L = half(-1); mirror(L.body, c); mirror(L.edge, c);
        P.steel.push(R.body, L.body); P.edge.push(R.edge, L.edge);
      }
      // ricasso / blade root block and its rivets
      const rw = Math.min(width(0) * .92, .05);
      if (y0 > .12) P[o.ricassoMat || 'steel'].push(G.extrude([[-rw, .07], [rw, .07], [rw * .97, y0 + .004], [-rw * .97, y0 + .004]], thick * .7, .002));
      if (o.ricassoWrap) { for (let i = 0; i < 4; i++) P.leather.push(G.ring(rw * .95, .0055, [0, y0 + .02 + i * .012, 0], null, 6, 16).scale(1, 1, .45)); }
      // rune inlays along the blade centre
      if (o.runes) {
        const n = o.runeCount || 7, zs = (y, u) => (o.single ? bz(.3, thick, o.fuller || [.12, .42], .26) : bz(0, thick, [-.3, .3], .3)) + .0009;
        runes(P, o.runes, n, (i, cnt) => { const y = mix(y0 + .07, mix(y0, top, o.runeSpan || .7), (i + .5) / cnt), t = (y - y0) / (top - y0), w = width(t); if (w < .022) return null; const sp = o.single ? (o.spine || (q => .02 + .01 * (1 - q)))(t) : 0, x = curve(t) + (o.single ? mix(-sp, edgeAt(y, 1), .3) : 0); return [x, y, zs(y, o.single ? .3 : 0), Math.min(1, w / .03)]; }, Math.min(.034, (mix(y0, top, o.runeSpan || .7) - y0) / n * .78), o.seed || 1, .0012);
      }
      // ember / frost cracks along the edge for glowing pieces
      if (o.cracks) {
        for (const s of (o.single ? [1] : [1, -1])) for (let k = 0; k < (o.crackCount || 5); k++) {
          const ya = mix(y0 + .1, top - .12, (k + G.hash(k, 3, s) * .5) / (o.crackCount || 5)), pts = [];
          for (let j = 0; j <= 5; j++) { const y = ya + j * .022, t = (y - y0) / (top - y0), e = edgeAt(y, s), sp = o.single ? (o.spine || (q => .02 + .01 * (1 - q)))(t) : 0, off = .004 + j * .0045 + (j % 2) * .004, u = o.single ? 1 - off / (e + sp) : 1 - off / e; pts.push([curve(t) + s * (e - off), y, o.single ? bz(u, thick, o.fuller || [.12, .42], .26) : bz(u, thick, [-.3, .3], .3)]); }
          for (const z of [1, -1]) P[o.cracks].push(G.tube(pts.map(p => [p[0], p[1], z * (p[2] + .0004)]), .0011, 4, 12, true));
        }
      }
      // Epic/unique: a lit channel down the blade reads from the isometric camera.
      const gk = GLOWS.has(o.runes) ? o.runes : GLOWS.has(o.cracks) ? o.cracks : null;
      if (gk && grand(id)) for (const z of [1, -1]) { const u0 = o.single ? .3 : 0, zz = (o.single ? bz(u0, thick, o.fuller || [.12, .42], .26) : bz(0, thick, [-.3, .3], .3)) + .0018;
        P[gk].push(G.tube(line(t => { const y = mix(y0 + .03, mix(y0, top, .9), t), tt = (y - y0) / (top - y0), sp = o.single ? (o.spine || (q => .02 + .01 * (1 - q)))(tt) : 0; return [curve(tt) + (o.single ? mix(-sp, edgeAt(y, 1), .3) : 0) + (o.runes && GLOWS.has(o.runes) ? .011 : 0), y, z * zz]; }, 40), t => .0024 * (1 - t * .5), 4, 60, true)); }
      if (o.blood) P.steel.forEach(g => G.bloodied(g, mix(y0, top, .25), top, .5));
      if (o.blood) P.edge.forEach(g => G.bloodied(g, mix(y0, top, .2), top, .2));
      guard(P, o.guard || 'cross', o.guardOpts);
      const handle = o.handle || .3;
      grip(P, handle, o.gripR || .021, -handle, o.gripOpts);
      pommel(P, o.pommel || 'wheel', -handle - .004, o.pommelOpts);
      if (o.tassel) tassel(P, [0, -handle - (o.pommel === 'ring' ? .082 : o.pommel === 'gem' ? .086 : .07), 0], o.tassel[1] || .2, o.tassel[0], o.tassel[2] || 5, o.seed || 0);
      if (o.extra) o.extra(P, { top, y0, curve, width, edgeAt, thick });
      out[id] = equipmentWeapon({ parts: P, tip: new T.Vector3(curve(1), top, 0) }, id, 'sword', o.finish || 'steel');
    }
    // ----------------------------------------------------------------- axe
    function axe(id, o) {
      const P = parts(), top = o.top, y = top - .2, L = o.reach || .3, up = o.up || .16, down = o.down || .2, bulge = o.bulge || .04;
      const haftTop = y + .13;
      P[o.haftMat || 'wood'].push(G.lathe([[.019, -.45], [.023, -.32], [.025, .2], [.026, haftTop]], 16));
      grip(P, .3, .027, -.37, { wraps: 10, wrap: o.wrap || 'leather', ring: o.ring || 'brass', wire: o.wire });
      // forged head outline: eye neck -> upper horn -> arcing edge -> beard -> back to eye
      const arc = [], N = 18;
      for (let i = 0; i <= N; i++) { const t = i / N, yy = mix(y + up, y - down, t), x = -L - bulge * Math.sin(t * PI) + (o.beard ? o.beard * sm((t - .55) / .45) : 0); arc.push([x, yy]); }
      const neck = o.neck || .05;
      const q = (a, c, b, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]]; });
      const H2 = [arc[N][0] + (o.hook ? .02 : 0), arc[N][1] + (o.hook || 0)];
      const topC = q([-.033, y + neck], [-L * .5, y + neck * .55 + up * .12 * (o.flare || 1)], arc[0], 10);
      const botC = q(H2, [-L * .48 + (o.beard || 0) * .7, y - neck * .6 - (o.beard || 0) * .4], [-.033, y - neck - .01], 10);
      const shape = topC.slice(0, -1).concat(arc).concat(botC);
      const holes = o.hole ? [G.circle(o.hole[2], 20, o.hole[0], y + o.hole[1])] : [];
      const head = (sx) => { const s = shape.map(p => [p[0] * sx, p[1]]); return sx < 0 ? s.reverse() : s; };
      const bits = o.double ? [1, -1] : [1];
      for (const sx of bits) {
        P[o.headMat || 'steel'].push(G.extrude(head(sx), .016, .004, holes.map(h => h.map(p => [p[0] * sx, p[1]]))));
        // raised forged cheek around the eye, stepping down to the thinner bit
        const boss = shape.map(p => [(-.033 + (p[0] + .033) * .42) * sx, y + (p[1] - y) * .86]); P[o.headMat || 'steel'].push(G.extrude(sx < 0 ? boss.reverse() : boss, .03, .005));
        // ground cutting bevel: thin band along the arc, inward toward the eye
        const band = arc.map(p => [p[0] * sx, p[1]]), inner = arc.map((p, i) => [(p[0] + .034 + .01 * Math.sin(i / N * PI)) * sx, p[1] - (i / N - .5) * .01]).reverse();
        const poly = band.concat(inner); P.edge.push(G.extrude(sx < 0 ? poly.reverse() : poly, .01, .0035));
        // chiselled cheek ridge and rivets
        for (const z of [1, -1]) {
          P[o.trim || 'dark'].push(G.tube(line(t => { const p = arc[Math.round(t * N)]; return [(p[0] * .8 + .004) * sx, y + (p[1] - y) * .8, z * .0115]; }, 18), .0018, 5, 30, true));
          for (let k = 0; k < 3; k++) P[o.rivet || 'brass'].push(G.stud(.0048, [(-.05 - k * .016) * sx, y + .04 - k * .04, z * .0195], [0, 0, z]));
        }
        if (o.runes) runes(P, o.runes, o.runeCount || 3, (i, n) => [(-L * .6 - (i % 2) * .03) * sx, y + .01 - (i - (n - 1) / 2) * .05, .0125, 1], .032, o.seed || 2, .0013);
        if (o.cracks) for (let k = 0; k < 6; k++) { const p0 = arc[2 + k * 2]; const pts = []; for (let j = 0; j < 5; j++) pts.push([(p0[0] + .006 + j * .011) * sx, p0[1] + (j % 2 ? .008 : -.004), 0]); for (const z of [1, -1]) P[o.cracks].push(G.tube(pts.map(p => [p[0], p[1], z * .0105]), .0012, 4, 10, true)); }
      }
      if (!o.double) { // back of the head: spike, hammer poll or hook
        if (o.back === 'spike') { P[o.headMat || 'steel'].push(G.spike(.03, [.03, y + .01, 0], [.17, y - .01, 0], 6).scale(1, 1, .7)); P[o.trim || 'dark'].push(G.ring(.03, .004, [.045, y + .008, 0], [0, 0, PI / 2], 6, 16)); }
        else if (o.back === 'hook') P[o.headMat || 'steel'].push(G.extrude([[.03, y + .06], [.12, y + .04], [.17, y - .04], [.15, y - .1], [.13, y - .03], [.03, y - .04]], .026, .004));
        else P[o.headMat || 'steel'].push(G.extrude([[.03, y + .05], [.09, y + .055], [.1, y - .055], [.03, y - .05]], .044, .005));
      }
      // socket collar + langets riveted down the haft
      P.steel.push(G.lathe([[.031, y - .12], [.042, y - .1], [.044, y + .1], [.04, y + .13], [.028, y + .15]], 16));
      for (const yy of [y - .1, y + .11]) P[o.ring2 || 'brass'].push(G.ring(.045, .0032, [0, yy, 0], null, 6, 28));
      for (const a of [PI / 2, -PI / 2]) { const g = G.extrude([[-.009, y - .1], [.009, y - .1], [.006, y - .34], [0, y - .36], [-.006, y - .34]], .005, .0015); g.translate(0, 0, .026); g.rotateY(a); P.dark.push(g); for (let k = 0; k < 3; k++) { const st = G.stud(.0035, [0, y - .14 - k * .07, .029], [0, 0, 1]); st.rotateY(a); P[o.rivet || 'brass'].push(st); } }
      // butt cap and bands
      P.steel.push(G.lathe([[0, -.5], [.016, -.49], [.027, -.465], [.028, -.445], [.022, -.44]], 16));
      for (const yy of [.0, .16]) P[o.ring || 'brass'].push(G.ring(.027, .003, [0, yy, 0], null, 6, 24));
      if (o.tassel) tassel(P, [0, y - .14, .03], o.tassel[1] || .22, o.tassel[0], o.tassel[2] || 6, o.seed || 1);
      const gk = GLOWS.has(o.runes) ? o.runes : GLOWS.has(o.cracks) ? o.cracks : null;
      if (gk && grand(id)) for (const sx of bits) for (const z of [1, -1]) P[gk].push(G.tube(line(t => { const p = arc[Math.round(t * N)]; return [(p[0] + .03) * sx, p[1] - (t - .5) * .008, z * .0128]; }, 18), .0024, 4, 40, true));
      if (o.blood) { P[o.headMat || 'steel'].forEach(g => G.bloodied(g, y + .2, y - .2, .1)); }
      if (o.extra) o.extra(P, { y, L, arc, top });
      out[id] = equipmentWeapon({ parts: P, tip: new T.Vector3(-L - bulge, y + .02, 0) }, id, 'axe', o.finish || 'steel');
    }
    // ----------------------------------------------------------------- spear
    function spear(id, o) {
      const P = parts(), top = o.top, head = o.head, hb = top - head;
      P[o.haftMat || 'wood'].push(G.lathe([[.017, -.56], [.022, -.4], [.021, hb - .04]], 16));
      grip(P, .38, .024, -.22, { wraps: 14, wrap: o.wrap || 'leather', ring: o.ring || 'brass', wire: o.wire });
      const width = o.width, rows = o.wavy ? 120 : 72;
      const c = y => o.wavy ? Math.sin((y - hb) / head * PI * 5) * .012 * Math.sin((y - hb) / head * PI) : 0;
      const half = s => G.blade(hb, top, rows, y => { const t = clamp((y - hb) / head, 0, 1); return [c(y), c(y) + Math.max(.0006, width(t, s) || 0)]; }, o.thick || .024, .32, [-.32, .32]);
      const R = half(1), Lh = half(-1); mirror(Lh.body, c); mirror(Lh.edge, c);
      P[o.headMat || 'steel'].push(R.body, Lh.body); P.edge.push(R.edge, Lh.edge);
      // central rib
      if (!o.runes) P[o.headMat || 'steel'].push(G.tube(line(t => [c(mix(hb + .02, top - .03, t)), mix(hb + .02, top - .03, t), 0], 20), t => .0085 * (1 - t * .8), 6, 24, true));
      // socket, collars, langets
      P.steel.push(G.lathe([[.023, hb - .17], [.026, hb - .12], [.03, hb - .02], [.022, hb + .03]], 14));
      for (const yy of [hb - .155, hb - .09, hb - .03]) P[o.ring || 'brass'].push(G.ring(.03, .003, [0, yy, 0], null, 6, 24));
      for (const a of [0, PI]) { const g = G.extrude([[-.006, hb - .16], [.006, hb - .16], [.004, hb - .32], [0, hb - .34], [-.004, hb - .32]], .004, .0012); g.translate(0, 0, .022); g.rotateY(a); P.dark.push(g); }
      if (o.wings) for (const s of [-1, 1]) P[o.wingMat || 'steel'].push(G.extrude(o.wings.map(([x, yy]) => [s * x, hb + yy]), .014, .003));
      if (o.runes) runes(P, o.runes, o.runeCount || 4, (i, n) => { const y = mix(hb + .05, top - head * .38, (i + .5) / n), t = (y - hb) / head; return width(t, 1) > .02 ? [c(y), y, bz(0, o.thick || .024, [-.32, .32], .32) + .0009, .8] : null; }, Math.min(.03, head * .5 / (o.runeCount || 4)), o.seed || 3, .001);
      if (GLOWS.has(o.runes) && grand(id)) for (const z of [1, -1]) P[o.runes].push(G.tube(line(t => { const y = mix(hb + .02, top - .04, t); return [c(y) + .009, y, z * (bz(.3, o.thick || .024, [-.32, .32], .32) + .0014)]; }, 30), t => .002 * (1 - t * .5), 4, 40, true));
      if (o.binding) { for (let k = 0; k < 7; k++) P[o.binding].push(G.ring(.024, .0028, [0, hb - .19 - k * .009, 0], [0, 0, .12 * (k % 2 ? 1 : -1)], 5, 18)); }
      if (o.tassel) tassel(P, [0, hb - .16, .028], o.tassel[1] || .24, o.tassel[0], o.tassel[2] || 7, o.seed || 2);
      P.steel.push(G.lathe([[.006, -.72], [.02, -.6], [.023, -.56], [.019, -.54]], 12));
      if (o.extra) o.extra(P, { top, hb, head, c });
      out[id] = equipmentWeapon({ parts: P, tip: new T.Vector3(0, top, 0) }, id, 'spear', o.finish || 'steel');
    }

    // ================================================================= catalogue
    const leaf = (k, a) => t => k * Math.pow(Math.sin(t * PI), a || .8) * Math.pow(1 - t, .1);
    // --- swords
    sword('dull-sword', { top: 1.04, finish: 'rust', width: t => (.044 + .006 * Math.sin(t * 9)) * (t > .9 ? 1 - (t - .9) / .1 * .96 : 1), chips: [[.3, .012, 1], [.47, .008, -1], [.62, .015, 1], [.78, .01, -1]],
      guard: 'bar', guardOpts: { mat: 'dark', width: .13 }, handle: .27, pommel: 'disc', pommelOpts: { mat: 'dark', trim: 'dark' }, gripOpts: { wrap: 'leather', ring: 'dark' }, seed: 1 });
    sword('grave-sword', { top: 1.32, finish: 'bright', width: t => (.06 - .022 * t) * (t > .86 ? 1 - Math.pow((t - .86) / .14, 1.3) * .97 : 1), guard: 'cross', guardOpts: { mat: 'dark', width: .19, droop: 1 },
      handle: .33, pommel: 'stopper', pommelOpts: { mat: 'dark' }, gripOpts: { wire: 'brass' }, runes: null, seed: 2,
      extra: (P, s) => { for (const z of [1, -1]) P.dark.push(G.tube(line(t => [0, mix(.19, 1.0, t), z * .0062], 30), .0022, 4, 40, true)); } });
    sword('widow-sword', { top: 1.24, finish: 'steel', width: t => (.046 - .016 * t) * (t > .84 ? 1 - Math.pow((t - .84) / .16, 1.2) * .97 : 1), guard: 'cross', guardOpts: { mat: 'steel', width: .16, droop: -.6 },
      handle: .3, pommel: 'ring', pommelOpts: { mat: 'steel' }, gripOpts: { wrap: 'sable', wire: 'brass' }, tassel: ['rag', .26, 5], runes: 'dark', runeCount: 5, seed: 3, ricassoWrap: true,
      extra: (P) => { for (let k = 0; k < 4; k++) P.bone.push(G.sphere(.0075, [0, -.4 - k * .018, .0], [1, 1, 1], 8, 6)); } });
    sword('black-tide-sword', { top: 1.3, finish: 'salt', single: true, curve: t => .16 * t * t, width: t => (.05 + .012 * Math.sin(t * PI)) * (t > .88 ? 1 - Math.pow((t - .88) / .12, 1.1) * .98 : 1), spine: t => .018 + .006 * (1 - t),
      guard: 'wave', guardOpts: { mat: 'dark', trim: 'brass' }, handle: .31, pommel: 'gem', pommelOpts: { trim: 'brass', gem: 'frost' }, gripOpts: { wrap: 'sable', wire: 'brass' },
      runes: 'frost', runeCount: 7, cracks: 'frost', crackCount: 4, seed: 4,
      extra: (P, s) => { for (let k = 0; k < 9; k++) { const t = .15 + k * .085, y = mix(s.y0, s.top, t); P.bone.push(G.blob(.006 + .003 * G.hash(k, 1, 1), [s.curve(t) - .016, y, .009 * (k % 2 ? 1 : -1)], [1, .7, .6], .4, k, 8)); } } });
    sword('slag-edge-sword', { top: 1.28, finish: 'black', width: t => (.064 - .02 * t) * (t > .86 ? 1 - Math.pow((t - .86) / .14, 1.2) * .97 : 1), serr: 34,
      guard: 'cross', guardOpts: { mat: 'black', trim: 'dark', width: .17, droop: 1.6 }, handle: .32, pommel: 'stopper', pommelOpts: { mat: 'black', trim: 'gold' }, gripOpts: { wrap: 'hide', ring: 'dark', wire: 'dark' },
      runes: 'ember', runeCount: 6, cracks: 'ember', crackCount: 7, seed: 5, ricassoMat: 'black' });
    sword('hollow-crown-blade', { top: 1.4, finish: 'bright', width: t => (.058 - .016 * t) * (t > .84 ? 1 - Math.pow((t - .84) / .16, 1.1) * .97 : 1), guard: 'crown', guardOpts: { width: .17 },
      handle: .34, pommel: 'gem', pommelOpts: { trim: 'gold', gem: 'gem' }, gripOpts: { wrap: 'bone', ring: 'gold', wire: 'gold' }, runes: 'holy', runeCount: 8, seed: 6, tassel: ['crimson', .28, 6] });
    sword('ruin-lament-sword', { top: 1.5, finish: 'bright', finish: 'steel', width: t => (.06 - .018 * t) * (t > .87 ? 1 - Math.pow((t - .87) / .13, 1.2) * .97 : 1), base: .26, guard: 'lug', guardOpts: { mat: 'dark', trim: 'brass', width: .24 },
      handle: .42, pommel: 'disc', pommelOpts: { mat: 'dark', trim: 'brass' }, gripOpts: { wrap: 'sable', wire: 'brass', wraps: 16 }, runes: 'void', runeCount: 9, seed: 7, ricassoWrap: true, tassel: ['sable', .22, 4],
      extra: (P) => { for (const s of [-1, 1]) P.dark.push(G.extrude([[s * .06, .2], [s * .1, .22], [s * .085, .25], [s * .06, .245]], .02, .003)); } });
    sword('cave-verdict-sword', { top: 1.26, finish: 'dark', width: t => (.088 + .01 * Math.sin(t * PI)) * (t > .955 ? 1 - (t - .955) / .045 * .96 : 1), guard: 'beast', guardOpts: { horn: 'horn', trim: 'dark' },
      handle: .31, pommel: 'skull', pommelOpts: { eyes: 'gore', trim: 'dark' }, gripOpts: { wrap: 'hide', ring: 'dark', wire: 'dark' }, runes: 'gore', runeCount: 6, seed: 8, blood: true, thick: .034 });
    sword('black-forge-sword', { top: 1.28, finish: 'dark', single: true, curve: t => .1 * t * t, width: t => (.07 - .022 * t) * (t > .86 ? 1 - Math.pow((t - .86) / .14, 1.1) * .98 : 1), spine: t => .026,
      guard: 'cross', guardOpts: { mat: 'black', trim: 'gold', width: .12, droop: -1 }, handle: .32, pommel: 'gem', pommelOpts: { trim: 'black', gem: 'ember' }, gripOpts: { wrap: 'hide', ring: 'black', wire: 'gold' },
      runes: null, cracks: 'ember', crackCount: 8, seed: 9,
      extra: (P, s) => { for (let k = 0; k < 4; k++) { const t = .22 + k * .17, y = mix(s.y0, s.top, t), x = s.curve(t) + .004; P.ember.push(G.cyl(.0105, .0105, .026, 14, [x, y, 0], [PI / 2, 0, 0])); P.gold.push(G.ring(.013, .0022, [x, y, .0135], [PI / 2, 0, 0], 5, 18), G.ring(.013, .0022, [x, y, -.0135], [PI / 2, 0, 0], 5, 18)); } } });
    // --- axes
    axe('rust-axe', { top: .92, finish: 'rust', reach: .27, up: .12, down: .17, beard: .05, back: 'poll', trim: 'dark', wrap: 'hide', ring: 'dark', rivet: 'dark', seed: 11 });
    axe('executioner-axe', { top: 1.2, finish: 'dark', reach: .36, up: .24, down: .27, bulge: .07, back: 'spike', trim: 'black', wrap: 'hide', ring: 'black', runes: 'gore', runeCount: 3, blood: true, hole: [-.15, .02, .03], seed: 12,
      extra: (P, s) => { const sk = G.skull(.04, false); sk.parts.bone.forEach(g => { g.rotateY(-PI / 2); g.translate(-.09, s.y + .0, .0); g.scale(1, 1, .5); P.bone.push(g); }); } });
    axe('mourning-axe', { top: 1.1, finish: 'dark', reach: .3, up: .1, down: .26, beard: .09, hook: .05, back: 'hook', trim: 'dark', wrap: 'sable', tassel: ['crimson', .3, 7], runes: 'dark', runeCount: 2, seed: 13 });
    axe('furnace-oath-axe', { top: 1.25, finish: 'dark', double: true, reach: .3, up: .2, down: .22, bulge: .05, headMat: 'black', trim: 'gold', rivet: 'gold', wrap: 'hide', ring: 'gold', ring2: 'gold', wire: 'gold', cracks: 'ember', runes: 'ember', runeCount: 2, seed: 14,
      extra: (P, s) => { P.gold.push(G.spike(.018, [0, s.y + .14, 0], [0, s.y + .27, 0], 8)); P.ember.push(G.sphere(.012, [0, s.y + .155, 0], [1, 1, 1], 10, 8)); } });
    axe('sepulcher-axe', { top: 1.16, finish: 'steel', reach: .31, up: .17, down: .3, bulge: .02, beard: .03, back: 'poll', trim: 'bone', rivet: 'black', wrap: 'sable', runes: 'void', runeCount: 3, seed: 15,
      extra: (P, s) => { for (let k = 0; k < 5; k++) { const p = s.arc[0], x = mix(-.06, p[0] + .03, k / 4); P.bone.push(G.spike(.011, [x, s.y + .05 + (s.arc[0][1] - s.y - .05) * k / 4, 0], [x - .015, s.y + .1 + (s.arc[0][1] - s.y - .05) * k / 4 + .03, 0], 6)); } } });
    axe('broken-throne-axe', { top: 1.26, finish: 'steel', double: true, reach: .34, up: .21, down: .2, bulge: .06, trim: 'gold', rivet: 'gold', ring: 'gold', ring2: 'gold', wrap: 'crimson', wire: 'gold', runes: 'holy', runeCount: 2, seed: 16,
      extra: (P, s) => { for (let i = 0; i < 5; i++) { const a = (i - 2) * .22; P.gold.push(G.extrude([[-.012, 0], [.012, 0], [0, .05 + (i % 2 ? 0 : .03)]], .012, .002).rotateZ(a).translate(Math.sin(-a) * .03, s.y + .15, 0)); } } });
    axe('ember-vow-axe', { top: 1.2, finish: 'dark', reach: .33, up: .27, down: .14, bulge: .05, back: 'spike', headMat: 'black', trim: 'dark', wrap: 'hide', ring: 'dark', cracks: 'ember', runes: 'ember', runeCount: 3, seed: 17, tassel: ['sable', .2, 5] });
    // --- spears
    spear('bone-spear', { top: 1.75, head: .42, width: (t, s) => .052 * Math.pow(Math.sin(t * PI), .75) * Math.pow(1 - t, .2), binding: 'hide', tassel: ['rag', .2, 5], ring: 'bone', seed: 21,
      extra: (P, s) => { for (let k = 0; k < 4; k++) P.bone.push(G.lathe([[.026, -.012], [.03, 0], [.026, .012]], 12).translate(0, .3 + k * .12, 0)); } });
    spear('bell-spear', { top: 1.83, head: .44, finish: 'salt', width: (t) => .06 * Math.pow(Math.sin(t * PI), .7) * Math.pow(1 - t, .18), wings: [[.02, .02], [.11, -.03], [.13, .02], [.1, .05], [.02, .06]], runes: 'frost', runeCount: 4, tassel: ['sable', .26, 7], seed: 22,
      extra: (P, s) => { P.brass.push(G.lathe([[.012, 0], [.02, -.02], [.036, -.06], [.05, -.09], [.052, -.1], [.044, -.1], [.03, -.06], [.012, 0]], 24).translate(0, s.hb - .19, 0)); P.frost.push(G.sphere(.009, [0, s.hb - .27, 0], null, 10, 8)); } });
    spear('orphan-spear', { top: 1.9, head: .4, finish: 'steel', width: t => .03 * Math.pow(Math.sin(t * PI), .6) * Math.pow(1 - t, .1), seed: 23, ring: 'bone', binding: 'leather',
      extra: (P, s) => { for (const sd of [-1, 1]) { P.steel.push(G.tube(line(t => [sd * (.022 + .07 * Math.sin(t * PI * .5)), s.hb + .02 + t * .3, 0], 16), t => mix(.008, .0015, t), 6, 24, true)); P.bone.push(G.sphere(.008, [sd * .022, s.hb + .02, 0], null, 8, 6)); }
        for (let k = 0; k < 5; k++) P.bone.push(G.sphere(.0065, [0, -.18 - k * .015, .03], null, 8, 6)); } });
    spear('starved-spear', { top: 1.88, head: .56, finish: 'rust', width: t => .085 * Math.sin(t * PI) * Math.pow(1 - t, .18) * (1 - .25 * Math.pow(Math.max(0, Math.sin(t * PI * 7)), 6)), runes: 'venom', runeCount: 5, binding: 'hide', wrap: 'hide', seed: 24,
      extra: (P, s) => { for (const sd of [-1, 1]) P.steel.push(G.extrude([[sd * .02, s.hb + .01], [sd * .075, s.hb - .06], [sd * .065, s.hb + .02], [sd * .03, s.hb + .05]], .012, .002)); } });
    spear('furnace-mourning-spear', { top: 1.95, head: .5, finish: 'steel', headMat: 'black', width: t => .07 * Math.pow(Math.sin(t * PI), .7) * Math.pow(1 - t, .16), wings: [[.02, .02], [.14, .0], [.16, .08], [.12, .1], [.02, .07]], wingMat: 'black', runes: 'ember', runeCount: 5, ring: 'gold', tassel: ['crimson', .24, 6], seed: 25 });
    spear('last-coal-spear', { top: 2.0, head: .58, finish: 'rust', headMat: 'black', wavy: true, width: t => .045 * Math.pow(Math.sin(t * PI), .6) * Math.pow(1 - t, .12), runes: 'ember', runeCount: 6, ring: 'dark', wrap: 'hide', seed: 26,
      extra: (P, s) => { P.ember.push(G.sphere(.014, [0, s.hb - .015, 0], [1, 1.4, 1], 10, 8)); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; P.gold.push(G.tube([[Math.cos(a) * .012, s.hb - .04, Math.sin(a) * .012], [Math.cos(a) * .022, s.hb - .015, Math.sin(a) * .022], [Math.cos(a) * .01, s.hb + .01, Math.sin(a) * .01]], .0022, 4, 8, true)); } } });
    // chapter V (ajan:chapter5): the Black Qadi's broken verdict blade, a jailer's axe fallen into the void, the chain court's spear
    sword('last-verdict-blade', { top: 1.46, finish: 'dark', width: t => (.064 - .02 * t) * (t > .8 ? 1 - Math.pow((t - .8) / .2, 1.2) * .96 : 1), spine: t => .02, guard: 'crown', guardOpts: { width: .19 },
      handle: .36, pommel: 'gem', pommelOpts: { trim: 'gold', gem: 'ember' }, gripOpts: { wrap: 'hide', ring: 'gold', wire: 'gold' }, runes: 'gore', runeCount: 9, seed: 31, tassel: ['crimson', .32, 7] });
    axe('void-oath-axe', { top: 1.22, finish: 'dark', reach: .32, up: .26, down: .18, bulge: .05, back: 'spike', headMat: 'black', trim: 'gold', wrap: 'hide', ring: 'gold', runes: 'void', runeCount: 3, seed: 33, tassel: ['sable', .22, 5] });
    spear('chain-court-spear', { top: 2.05, head: .55, finish: 'dark', headMat: 'black', width: t => .05 * Math.pow(Math.sin(t * PI), .55) * Math.pow(1 - t, .15), runes: 'gore', runeCount: 5, ring: 'gold', wrap: 'hide', seed: 35 });
    // drop empty / null entries before merging
    Object.values(out).forEach(w => Object.keys(w.parts).forEach(k => { w.parts[k] = w.parts[k].filter(Boolean); if (!w.parts[k].length) { delete w.parts[k]; if (w.materials) delete w.materials[k]; } }));
    return out;
  }
  B.GearWeapons = { build };
})();
