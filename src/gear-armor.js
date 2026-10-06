/* KABİR AZABI — gear: named armour flourishes. Each catalog piece gets its own joint-bound fittings on top of the
   shared fitted cores (equipment-art.js): rare pieces carry riveted trims and studs, epic and unique pieces change the
   silhouette — horned or crested helms, mail aventails, plumes, glowing visor slits, spiked pauldrons, chest sigils
   with rune light, half-capes, knuckle spikes, knee spikes and spurs. Mesh ids are 'variant@<item id>', shown only
   while that item is equipped (authored-models.js setEquipment). Built once with the hero blueprint. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE, PI = Math.PI, TAU = PI * 2;
  const mix = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function theme(item) {
    const id = item.id;
    if (/furnace|coal|ember|slag|forge|fire|shift|dawn|anvil|burnt/.test(id)) return 'ember';
    if (/salt|sunken|tide|drowned|silent|watch/.test(id)) return 'frost';
    if (/warden|crown|throne|verdict|witness/.test(id)) return 'holy';
    if (/blood|widow|oath|mourn|gallows|grave-digger/.test(id)) return 'gore';
    if (/bone|gaze|breath|hollow|sealed|nameless|forgotten|black-stone|silence|buried|cave/.test(id)) return 'void';
    return item.finish === 'blood' ? 'gore' : item.finish === 'brine' ? 'frost' : item.finish === 'ash' ? 'ember' : 'void';
  }
  const SIG = () => new Set(Object.values(B.Progression.bossSignatures || {}).flat());
  // Visual families: every theme speaks one metal/cloth language across head, chest, hands and boots.
  //   ember = foundry (black iron, ember), frost = sea sentinel (green bronze), holy = barrow king (gold), gore = executioner/mourning (black, crimson),
  //   void = bone rite (bone, violet light). Unique pieces always carry gold.
  const FAMILY = { ember: ['black', 'sable'], frost: ['bronze', 'sable'], holy: ['gold', 'crimson'], gore: ['black', 'crimson'], void: ['bone', 'sable'],
    lamellar: ['brass', 'crimson'], barbarian: ['horn', 'hide'], iron: ['dark', 'sable'] };
  // Themed names win; the rest fall into the lamellar, barbarian-hide or iron-guard families by their fitted core.
  function family(item) {
    const id = item.id, m = item.modelId || '';
    if (/lamel|empty-vow/.test(id) || m === 'lamellar-chest') return 'lamellar';
    if (/hide|chieftain/.test(id)) return 'barbarian';
    if (/furnace|coal|ember|slag|forge|fire|shift|dawn|anvil|burnt|hearth/.test(id)) return 'ember';
    if (/salt|sunken|tide|drowned|silent|watch/.test(id)) return 'frost';
    if (/warden|crown|throne|verdict|witness|barrow|king/.test(id)) return 'holy';
    if (/blood|widow|oath|mourn|gallows|grave-digger|orphan/.test(id)) return 'gore';
    if (/bone|gaze|breath|hollow|sealed|nameless|forgotten|black-stone|silence|rite/.test(id)) return 'void';
    if (/torn|rag|worn|cloth|ash-|pilgrim|funeral|burial-wraps|footwraps/.test(id) || /torn-chest|rag-wraps|worn-boots|cloth-hood/.test(m)) return 'barbarian';
    return 'iron';
  }
  const trimOf = (item, unique) => unique ? 'gold' : (FAMILY[family(item)] || ['brass'])[0];
  const clothOf = item => (FAMILY[family(item)] || [0, 'sable'])[1];
  const MASKS = new Set(['sealed-mask', 'furnace-mask']);
  // gear-*: lighter tessellation for hidden-until-equipped parts (iPad memory); silhouettes keep their shape.
  const lodGear = (S, k) => Object.assign({}, S, {
    tube: (p, r, rad, tub, caps) => S.tube(p, r, Math.max(3, Math.round((rad || 8) * .75)), Math.max(2, Math.ceil((tub || Math.max(4, p.length * 5)) * k)), caps),
    shell: (nu, nv, fn, t, c, f, o) => S.shell(Math.max(2, Math.round(nu * k)), Math.max(1, Math.round(nv * k)), fn, t, c, f, o),
    sphere: (r, p, s, ws, hs) => S.sphere(r, p, s, Math.max(6, Math.round((ws || 14) * .7)), Math.max(4, Math.round((hs || 10) * .7))),
    lathe: (pr, seg, a, b) => S.lathe(pr, Math.max(8, Math.round((seg || 24) * .7)), a, b) });
  function build(ctx) {
    const { A, sleeve, chest, hc, rx, ry, rz, facingAngle, modelOf } = ctx, G = lodGear(B.Gear, .7);
    // Pieces with identical fittings share one look: calls are recorded per item, fingerprinted, and only new looks are submitted.
    let rec = null; const part = (slot, id, mat, geometry, bone, opts) => rec.push([slot, mat, geometry, bone, opts]);
    const looks = new Map(), lookOf = {};
    function commit(itemId) {
      if (!rec.length) return;
      const key = rec.map(([slot, mat, g, bone, opts]) => { const p = g.attributes.position; return [slot, mat, bone || '', opts ? JSON.stringify(opts) : '', p.count, p.getX(0).toFixed(4), p.getY(0).toFixed(4), p.getZ(p.count - 1).toFixed(4)].join(':'); }).join('|');
      let look = looks.get(key);
      if (look) rec.forEach(r => r[2].dispose());
      else { look = 'look@' + looks.size; looks.set(key, look); rec.forEach(([slot, mat, g, bone, opts]) => ctx.part(slot, look, mat, g, bone, opts)); }
      lookOf[itemId] = look;
    }
    const line = (fn, n) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
    const emit = (slot, id, mat, list, bone, opts) => { list = list.filter(Boolean); if (list.length) part(slot, id, mat, G.merge(list), bone, opts); };
    // ------------------------------------------------------------- head pieces
    function horns(id, mat, trim, size, sweep) {
      const L = [], R = [];
      for (const s of [-1, 1]) {
        const pts = line(u => [hc.x + s * (rx * .82 + size * .62 * Math.sin(u * PI * .55)), hc.y + ry * .42 + size * (sweep === 'down' ? .25 * Math.sin(u * PI) - .1 * u : .55 * u * u + .12 * u), hc.z - .01 - size * .25 * u + (sweep === 'fwd' ? size * .5 * u * u : 0)], 16);
        (s < 0 ? L : R).push(G.tube(pts, u => mix(.026, .0025, Math.pow(u, .85)) * size / .2, 10, 40, true));
        for (let k = 1; k < 4; k++) { const p = pts[k * 3], q = pts[k * 3 + 1], d = new T.Vector3().fromArray(q).sub(new T.Vector3().fromArray(p)).normalize(); const r = new T.TorusGeometry(mix(.026, .0025, Math.pow(k * 3 / 16, .85)) * size / .2 + .002, .0022, 5, 18); r.applyMatrix4(new T.Matrix4().compose(new T.Vector3().fromArray(p), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d), new T.Vector3(1, 1, 1))); (s < 0 ? L : R).push(r); }
      }
      const horn = L.concat(R), shafts = horn.filter(g => g.type !== 'TorusGeometry'), rings = horn.filter(g => g.type === 'TorusGeometry');
      emit('head', id, mat, shafts, 'head'); emit('head', id, trim, rings, 'head');
      // bosses where the horns meet the helm
      emit('head', id, trim, [-1, 1].map(s => G.sphere(.022 * size / .2, [hc.x + s * rx * .84, hc.y + ry * .42, hc.z - .01], [1, 1, 1], 12, 8)), 'head');
    }
    function aventail(id, depth, mat) {
      const sheet = (u, v) => { const a = mix(-2.35, 2.35, u) + PI, y = mix(hc.y - ry * .18, hc.y - ry * (.62 + depth), v), r = mix(1.0, 1.32 + depth * .5, v), fold = .006 * Math.sin(u * 40) * v; return [hc.x + Math.sin(a) * (rx * r + fold), y, hc.z + Math.cos(a) * (rz * r + fold) - .01 * v]; };
      part('head', id, mat || 'mail', G.shell(40, 10, sheet, .004, false), null, { bones: ['head', 'neck', 'spine03'] });
      const rim = []; for (let n = 0; n < 40; n++) { const q = sheet((n + .5) / 40, 1); rim.push(G.ring(.006, .0014, q, [0, 0, 0], 3, 8)); } emit('head', id, 'steel', rim, null, { bones: ['head', 'neck', 'spine03'] });
      part('head', id, 'strap', G.tube(line(u => sheet(u, 0), 30), .0035, 5, 40, true), 'head');
    }
    function crest(id, mat, count, h) {
      const sp = []; for (let i = 0; i < count; i++) { const e = mix(.35, PI - .25, i / (count - 1)), base = [hc.x, hc.y + Math.sin(e) * ry * 1.02, hc.z + Math.cos(e) * rz * 1.0], n = new T.Vector3(0, Math.sin(e), Math.cos(e) * .6).normalize(); const hh = h * (1 - Math.abs(i / (count - 1) - .45) * .8); sp.push(G.spike(.011, base, [base[0], base[1] + n.y * hh, base[2] + n.z * hh - .015], 5).scale(.55, 1, 1).translate(base[0] * .45, 0, 0)); }
      emit('head', id, mat, sp, 'head');
    }
    function plume(id, mat) {
      const root = [hc.x, hc.y + ry * 1.04, hc.z - rz * .35], strips = [];
      for (let s = 0; s < 9; s++) { const a = (s / 9 - .5) * 1.1; strips.push(G.shell(2, 12, (u, v) => [root[0] + Math.sin(a) * .03 * v + (u - .5) * .016, root[1] + .03 * Math.sin(v * PI * .5) - v * v * .26, root[2] - v * .13 - Math.cos(a) * .01 * v], .0018, false)); }
      emit('head', id, mat, strips, 'head'); part('head', id, 'gold', G.lathe([[0, -.012], [.012, -.01], [.014, .01], [0, .016]], 12).translate(...root), 'head');
    }
    function visorGlow(id, glow) {
      // Light behind the mask's eye slits (sealed/furnace masks: slit at ry*.17, x .012..rx*.52+.013).
      const eyeY = hc.y + ry * .17, w = rx * .52 + .001, out = [];
      for (const s of [-1, 1]) { const xc = s * (.0125 + w / 2), z = hc.z + rz + .015 - .085 * Math.pow(xc / rx, 2) - .007; const g = G.box(w, .016, .003, [0, 0, 0]); g.rotateY(Math.atan(.17 * xc / (rx * rx))); g.translate(hc.x + xc, eyeY, z); out.push(g); }
      emit('head', id, glow, out, 'head');
    }
    function tatters(id, mat, trim, glow) {
      // Tattered mourning mantle: ragged strips falling from the hood's shoulder cape, beads at the tips.
      const strips = [], beads = [];
      for (let i = 0; i < 18; i++) {
        const a = mix(.5, TAU - .5, i / 17), L = .16 + .1 * G.hash(i, 2, 7), r0 = .2, w = .03;
        const strip = (u, v) => { const r = r0 + v * .06, aa = a + (u - .5) * w / r0; return [hc.x + Math.sin(aa) * r, hc.y - ry * .56 - .1 - v * L, hc.z + Math.cos(aa) * r * .8 + .01 * Math.sin(v * 5 + i)]; };
        strips.push(G.shell(2, 6, strip, .002, false));
        if (i % 3 === 0) beads.push(G.sphere(.008, strip(.5, 1.04), null, 8, 6));
      }
      emit('head', id, mat, strips, 'spine03'); emit('head', id, trim, beads, 'spine03');
      const pin = [hc.x, hc.y - ry * .62, hc.z + .085];
      part('head', id, trim, G.lathe([[0, -.012], [.02, -.008], [.022, .004], [0, .01]], 14).rotateX(PI / 2).translate(...pin), 'spine03');
      if (glow) part('head', id, glow, G.sphere(.007, [pin[0], pin[1], pin[2] + .012], null, 8, 6), 'spine03');
    }
    function browBand(id, trim, glow) {
      const band = (u, v) => { const a = mix(-1.25, 1.25, u); return [hc.x + Math.sin(a) * (rx + .014), hc.y + ry * (.3 + v * .12), hc.z + Math.cos(a) * (rz + .014)]; };
      part('head', id, trim, G.shell(28, 3, band, .004, false), 'head');
      const st = []; for (let i = 0; i < 9; i++) { const p = band((i + .5) / 9, .5), a = mix(-1.25, 1.25, (i + .5) / 9); st.push(G.stud(.0045, p, [Math.sin(a), 0, Math.cos(a)])); } emit('head', id, 'black', st, 'head');
      if (glow) { const p = band(.5, .5); part('head', id, glow, G.extrude([[0, -.011], [.008, 0], [0, .011], [-.008, 0]], .003, .0008).translate(p[0], p[1], p[2] + .0015), 'head'); part('head', id, trim, G.ring(.012, .0018, [p[0], p[1], p[2] + .001], [PI / 2, 0, 0], 4, 20), 'head'); }
    }
    // ------------------------------------------------------------- chest pieces
    const shoulderInfo = {};
    for (const s of ['L', 'R']) { const bone = 'upper_arm' + s, bc = A.box(A.cloud([bone], ['skin'], .38)), c = bc.getCenter(new T.Vector3()), sz = bc.getSize(new T.Vector3()); c.y = bc.max.y - .028; shoulderInfo[s] = { bone, c, rx: Math.max(.10, sz.x * .46), rz: Math.max(.085, sz.z * .55), sign: s === 'L' ? 1 : -1 }; }
    function spikedPauldron(id, mat, trim, n, len, big) {
      for (const s of ['L', 'R']) {
        const { bone, c, rx: px, rz: pz, sign } = shoulderInfo[s], R = big ? 1.22 : 1.08;
        const cap = (u, v) => { const a = u * TAU, e = mix(.02, 1.36, v), out = Math.max(0, Math.sin(a) * sign); return [c.x + Math.sin(a) * px * R * Math.sin(e) + sign * (.016 + .02 * out * v), c.y + .02 + Math.cos(e) * .1 * R - .03 * out * v * v, c.z + Math.cos(a) * pz * R * Math.sin(e)]; };
        part('chest', id, mat, G.shell(32, 4, (u, v) => { const p = cap(u, .9 + v * .1); p[1] -= .035; p[0] += sign * .006; return p; }, .006, true), bone);
        part('chest', id, mat, G.shell(32, 10, cap, .009, true), bone);
        part('chest', id, trim, G.tube(line(u => cap(u, 1), 40), .0042, 6, 48, true), bone);
        const sp = [], st = [];
        for (let i = 0; i < n; i++) { const t = (i + .5) / n, a = mix(-.9, .9, t) + (sign > 0 ? PI / 2 : -PI / 2), base = cap(a / TAU, .42), dir = new T.Vector3((base[0] - c.x) * 2.2, base[1] - c.y + .04, (base[2] - c.z) * 1.4).normalize(); const L = len * 1.5 * (1 - Math.abs(t - .5) * .6); sp.push(G.spike(.021, base, [base[0] + dir.x * L, base[1] + dir.y * L, base[2] + dir.z * L], 6)); st.push(G.ring(.016, .003, base, null, 5, 14)); }
        for (let i = 0; i < 12; i++) { const p = cap(i / 12, .86); st.push(G.stud(.004, p, new T.Vector3(p[0] - c.x, p[1] - c.y, p[2] - c.z).normalize())); }
        emit('chest', id, 'black', sp, bone); emit('chest', id, trim, st, bone);
      }
    }
    function sigil(id, trim, glow, shape) {
      const p = chest(0, .64, .056), out = [], g = [];
      const poly = shape === 'skull' ? null : shape === 'sun' ? Array.from({ length: 16 }, (_, i) => { const a = i / 16 * TAU, r = i % 2 ? .03 : .052; return [Math.sin(a) * r, Math.cos(a) * r]; }) : [[0, .055], [.04, 0], [0, -.055], [-.04, 0]];
      if (poly) { const e = G.extrude(poly, .008, .003); e.translate(p[0], p[1], p[2]); out.push(e); }
      else { const sk = G.skull(.06, true); sk.parts.bone.forEach(q => { q.translate(p[0], p[1], p[2] + .01); out.push(q); }); sk.parts.void.forEach(q => { q.translate(p[0], p[1], p[2] + .01); g.push(q); }); }
      const ring = new T.TorusGeometry(.064, .004, 6, 40); ring.translate(p[0], p[1], p[2]); out.push(ring);
      if (glow && poly) g.push(G.extrude(poly.map(q => [q[0] * .45, q[1] * .45]), .004, .001).translate(p[0], p[1], p[2] + .008));
      emit('chest', id, shape === 'skull' ? 'bone' : trim, out.filter(q => q.type !== 'TorusGeometry'), 'spine02'); emit('chest', id, trim, out.filter(q => q.type === 'TorusGeometry'), 'spine02');
      if (glow) emit('chest', id, shape === 'skull' ? glow : glow, g, 'spine02');
    }
    function halfCape(id, mat, len) {
      const cape = (u, v) => { const a = mix(.36, .64, u), p = chest(a, .97, .05); const flare = 1 + v * .28; return [p[0] * flare, p[1] - v * len, p[2] - .03 * v - .05 * v * v + .01 * Math.sin(u * PI * 7) * v]; };
      part('chest', id, mat, G.shell(24, 14, cape, .005, false), null, { bones: ['spine03', 'spine02', 'spine01', 'pelvis'] });
      part('chest', id, 'gold', G.tube(line(u => cape(u, 0), 24), .005, 6, 32, true), 'spine03');
      for (const u of [0, 1]) { const p = cape(u, 0); part('chest', id, 'gold', G.sphere(.016, [p[0], p[1] - .01, p[2] + .02], [1, 1, .6], 10, 8), 'spine03'); }
    }
    // ---- family identity pieces (3rd pass) ----
    const TORSO_W = { bones: ['spine03', 'spine02', 'spine01', 'pelvis'] }, HIP_W = { bones: ['pelvis', 'spine01'] };
    function lamellarWings(id, mat, trim) { // overlapping winged scale lames fanning off each shoulder
      for (const s of ['L', 'R']) {
        const { bone, c, rz: pz, rx: px, sign } = shoulderInfo[s];
        for (let l = 0; l < 4; l++) {
          const lame = (u, v) => { const a = mix(-1.25, 1.25, u), r = 1.1 + l * .12 + v * .25; return [c.x + sign * (px * .55 + l * .022 + v * .05), c.y + .07 - l * .045 - v * .06, c.z + Math.sin(a) * pz * r]; };
          part('chest', id, mat, G.shell(14, 3, lame, .004, false, sign < 0), bone);
          part('chest', id, trim, G.tube(line(u => lame(u, 1), 14), .0022, 4, 18, true), bone);
        }
      }
    }
    function silkSash(id, mat) {
      part('chest', id, mat, G.shell(40, 4, (u, v) => chest(u, .1 + v * .09, .052), .004, true), null, HIP_W);
      for (const k of [0, 1]) part('chest', id, mat, G.shell(3, 10, (u, v) => { const p = chest(.08 + k * .025 + u * .03, .12, .056); return [p[0] + v * .02, p[1] - v * (.26 - k * .06), p[2] + .01 * Math.sin(v * 4)]; }, .003, false), null, HIP_W);
    }
    function furCollar(id) {
      const tufts = [], cz0 = A.P('spine03').z;
      for (let i = 0; i < 46; i++) { const u = i / 46, p = chest(u, .97, .03), out = new T.Vector3(p[0], 0, p[2] - cz0).normalize(), L = .05 + .03 * G.hash(i, 5, 1); tufts.push(G.spike(.022, p, [p[0] + out.x * L, p[1] + .045 + .02 * G.hash(i, 2, 2), p[2] + out.z * L], 5)); }
      emit('chest', id, 'fur', tufts, null, TORSO_W);
      const beads = []; for (let i = 0; i < 13; i++) { const t = i / 12, p = chest(mix(-.11, .11, t), .8 - .1 * Math.sin(t * PI), .05); beads.push(i % 3 === 1 ? G.spike(.009, p, [p[0], p[1] - .04, p[2] + .01], 5) : G.sphere(.008, p, null, 8, 6)); }
      emit('chest', id, 'bone', beads, 'spine02');
    }
    function crossStraps(id) {
      for (const sd of [-1, 1]) part('chest', id, 'strap', G.shell(4, 24, (u, v) => chest(sd * (.16 - v * .32) + (u - .5) * .028, .18 + v * .78, .047), .004, false, sd < 0), null, TORSO_W);
      part('chest', id, 'brass', G.sphere(.016, chest(0, .58, .055), [1, 1, .5], 10, 8), 'spine02');
    }
    function tabard(id, cloth, trim, glow) {
      const panel = (u, v) => { const p = chest((u - .5) * .1, .62, .058); return [p[0] * (1 + v * .15), mix(p[1], .62, v), p[2] + .01 + .015 * v + .006 * Math.sin(u * PI * 3) * v]; };
      part('chest', id, cloth, G.shell(10, 16, panel, .004, false), null, TORSO_W);
      for (const e of [0, 1]) part('chest', id, trim, G.tube(line(v => panel(e, v), 16), .0025, 4, 20, true), null, TORSO_W);
      const q = chest(0, .42, .07), cross = G.extrude([[-.012, .05], [.012, .05], [.012, .014], [.04, .014], [.04, -.012], [.012, -.012], [.012, -.07], [-.012, -.07], [-.012, -.012], [-.04, -.012], [-.04, .014], [-.012, .014]], .006, .002);
      cross.translate(q[0], q[1], q[2]); part('chest', id, trim, cross, 'spine01');
      if (glow) part('chest', id, glow, G.sphere(.008, [q[0], q[1] + .002, q[2] + .01], null, 8, 6), 'spine01');
      const st = []; for (let i = 0; i < 16; i++) { const u = i / 16, p = chest(u, .11, .056); st.push(G.stud(.0055, p, [Math.sin(u * TAU), 0, Math.cos(u * TAU)])); } emit('chest', id, 'gold', st, null, HIP_W);
    }
    function tassets(id, mat, trim, n) { // hanging hip plates
      for (const sd of [-1, 1]) for (let k = 0; k < n; k++) {
        const a0 = sd * (.09 + k * .055), plate = (u, v) => { const p = chest(a0 + (u - .5) * .05, .06, .06 + k * .004); return [p[0] * (1 + v * .1), p[1] - .02 - v * .17, p[2] + v * .02 * Math.cos(a0 * TAU)]; };
        part('chest', id, mat, G.shell(6, 5, plate, .005, false, sd < 0), null, HIP_W);
        part('chest', id, trim, G.tube(line(u => plate(u, 1), 6), .002, 4, 8, true), null, HIP_W);
      }
    }
    function legWraps(id, mat) {
      for (const s of ['L', 'R']) { const shin = 'shin' + s, foot = 'tarsal' + s, cover = sleeve(A, shin, foot, .25, .7, .03, .003, ['skin', 'leather']);
        for (let k = 0; k < 6; k++) part('boots', id, mat, G.shell(20, 2, (u, v) => cover.at(u * TAU, .28 + k * .07 + v * .03 + .02 * Math.sin(u * TAU), .004)[0].toArray(), .002, true), shin); }
    }
    function kneeCops(id, mat, trim) {
      for (const s of ['L', 'R']) { const shin = 'shin' + s, knee = A.P(shin), sk = A.box(A.cloud([shin], ['skin'], .42)), c = sk.getCenter(new T.Vector3()), z = Math.max(knee.z + .085, c.z + .07);
        const cap = (u, v) => { const a = u * TAU, e = v * 1.2; return [knee.x + Math.sin(a) * .05 * Math.sin(e), knee.y + .015 + Math.cos(a) * .055 * Math.sin(e), z + Math.cos(e) * .028]; };
        part('boots', id, mat, G.shell(16, 6, cap, .004, true), shin); part('boots', id, trim, G.tube(line(u => cap(u, 1), 16), .0025, 4, 20, true), shin); }
    }
    // Family pauldron silhouettes for epic chests.
    function bellPauldron(id, mat, trim) { for (const s of ['L', 'R']) { const { bone, c, sign } = shoulderInfo[s]; const g = G.lathe([[0, .1], [.04, .095], [.075, .06], [.095, .0], [.12, -.06], [.125, -.075]], 20); g.rotateZ(sign * .55); g.translate(c.x + sign * .03, c.y, c.z); part('chest', id, mat, g, bone); const r = G.ring(.124, .004, [0, -.075, 0], null, 5, 30); r.rotateZ(sign * .55); r.translate(c.x + sign * .03, c.y, c.z); part('chest', id, trim, r, bone); } }
    function emberOrbs(id, glow) { for (const s of ['L', 'R']) { const { bone, c, sign } = shoulderInfo[s]; const o = []; for (let i = 0; i < 3; i++) o.push(G.sphere(.012 + .004 * i, [c.x + sign * (.07 + i * .03), c.y + .16 + i * .045, c.z - .02 + i * .01], null, 8, 6)); emit('chest', id, glow, o, bone); } }
    function chainMantle(id) { const out = []; for (let r = 0; r < 3; r++) out.push(G.chain(line(u => chest(mix(.12, .88, u), .98 - r * .1, .05 + r * .005), 18), .026, .2)); emit('chest', id, 'dark', out, null, TORSO_W); }
    function boneTeeth(id) { for (const s of ['L', 'R']) { const { bone, c, sign } = shoulderInfo[s]; const t = []; for (let i = 0; i < 5; i++) { const a = mix(-.8, .8, i / 4), b = [c.x + sign * .06, c.y + .08, c.z + Math.sin(a) * .07]; t.push(G.tube(line(u => [b[0] + sign * (.03 + .1 * u), b[1] + .1 * Math.sin(u * PI * .6) - .02 * u, b[2] + Math.sin(a) * .03 * u], 8), u => mix(.012, .002, u), 6, 12, true)); } emit('chest', id, 'bone', t, bone); } }
    function wingPauldron(id, mat, trim) { for (const s of ['L', 'R']) { const { bone, c, sign } = shoulderInfo[s]; const w = G.extrude([[0, 0], [.08, .05], [.16, .16], [.12, .06], [.18, .08], [.1, -.01], [.04, -.03]].map(p => [p[0] * sign, p[1]]), .012, .003); w.translate(c.x + sign * .07, c.y + .03, c.z - .03); part('chest', id, mat, w, bone); part('chest', id, trim, G.sphere(.014, [c.x + sign * .07, c.y + .03, c.z - .02], null, 8, 6), bone); } }
    function trophySkulls(id) {
      const out = { bone: [], black: [] };
      for (const u of [.09, .91]) { const p = chest(u, .13, .075), sk = G.skull(.065, true); sk.parts.bone.forEach(q => { q.rotateY(u * TAU); q.translate(p[0], p[1] - .05, p[2]); out.bone.push(q); }); sk.parts.void.forEach(q => { q.rotateY(u * TAU); q.translate(p[0], p[1] - .05, p[2]); out.black.push(q); }); }
      emit('chest', id, 'bone', out.bone, 'pelvis'); emit('chest', id, 'black', out.black, 'pelvis');
    }
    function riveted(id, trim) { // rare: two riveted chest straps
      const st = []; for (const v of [.42, .78]) for (let i = 0; i < 9; i++) { const p = chest(mix(-.1, .1, i / 8), v, .05); st.push(G.stud(.0042, p, [Math.sin(mix(-.1, .1, i / 8) * TAU), 0, Math.cos(mix(-.1, .1, i / 8) * TAU)])); }
      emit('chest', id, trim, st, 'spine02');
    }
    // ------------------------------------------------------------- hands / boots
    function knuckles(id, mat, trim, glow, big) {
      for (const s of ['L', 'R']) {
        const fore = 'forearm' + s, hand = 'hand' + s, cover = sleeve(A, fore, hand, .3, .85, .03, .004, ['skin', 'leather']), front = facingAngle(cover);
        const sp = [], rg = [];
        for (let i = 0; i < (big ? 3 : 2); i++) { const t = .42 + i * .14, q = cover.at(front + PI, t, .004), p = q[0], n = q[1]; sp.push(G.spike(.012, p.toArray(), p.clone().addScaledVector(n, big ? .07 : .045).add(new T.Vector3(0, .01, 0)).toArray(), 5)); rg.push(G.ring(.012, .0025, p.toArray(), null, 4, 12)); }
        emit('hands', id, mat, sp, fore); emit('hands', id, trim, rg, fore);
        part('hands', id, trim, G.tube(line(u => cover.at(u * TAU, .82, .006)[0].toArray(), 32), .003, 5, 40, true), fore);
        if (glow) { const q = cover.at(front, .6, .009)[0]; part('hands', id, glow, G.extrude([[0, -.014], [.009, 0], [0, .014], [-.009, 0]], .004, .001).translate(q.x, q.y, q.z), fore); }
        const hb = A.box(A.cloud([hand], ['skin'], .5)); const kn = [];
        for (let i = 0; i < 4; i++) { const x = mix(hb.min.x + .008, hb.max.x - .008, i / 3); kn.push(G.spike(.0055, [x, hb.max.y + .012, mix(hb.min.z, hb.max.z, .78)], [x, hb.max.y + .03, mix(hb.min.z, hb.max.z, .9)], 4)); }
        emit('hands', id, mat, kn, hand);
      }
    }
    function cuff(id, mat, trim, flare) {
      for (const s of ['L', 'R']) {
        const fore = 'forearm' + s, hand = 'hand' + s, cover = sleeve(A, fore, hand, .3, .9, .02, .004, ['skin', 'leather']);
        // Flared gauntlet cuff: a cone opening toward the elbow, rolled rim, riveted band.
        const shape = (u, v) => cover.at(u * TAU, mix(.66, .44, v), .008 + flare * v * v)[0].toArray();
        part('hands', id, mat, G.shell(28, 6, shape, .004, true), fore);
        part('hands', id, trim, G.tube(line(u => shape(u, 1), 36), .0032, 5, 44, true), fore);
        const st = []; for (let i = 0; i < 10; i++) { const q = cover.at(i / 10 * TAU, .62, .013); st.push(G.stud(.0035, q[0].toArray(), q[1])); } emit('hands', id, trim, st, fore);
      }
    }
    function kneeSpikes(id, mat, trim, glow, spur) {
      for (const s of ['L', 'R']) {
        const shin = 'shin' + s, foot = 'tarsal' + s, cover = sleeve(A, shin, foot, .6, .95, .018, .004, ['skin', 'leather']), front = facingAngle(cover);
        const q = cover.at(front, .8, .006), kp = q[0].toArray(), n = q[1];
        part('boots', id, mat, G.spike(.014, kp, [kp[0] + n.x * .06, kp[1] + .03, kp[2] + n.z * .06], 6), shin);
        part('boots', id, trim, G.ring(.017, .0035, kp, [PI / 2, 0, 0], 5, 16), shin);
        if (glow) { const g = cover.at(front, .86, .006)[0]; part('boots', id, glow, G.sphere(.007, g.toArray(), [1, 1, .5], 8, 6), shin); }
        if (spur) { const fb = A.box(A.cloud([foot], ['skin'], .35)), hp = [mix(fb.min.x, fb.max.x, .5), fb.min.y + .04, fb.min.z - .02]; part('boots', id, trim, G.tube([hp, [hp[0], hp[1] + .004, hp[2] - .05]], .0035, 5, 6, true), foot); const r = new T.TorusGeometry(.014, .003, 4, 10); r.translate(hp[0], hp[1] + .004, hp[2] - .055); part('boots', id, mat, r, foot); }
      }
    }
    // ------------------------------------------------------------- catalogue pass
    const sig = SIG();
    for (const item of B.Progression.items) {
      rec = [];
      if (item.slot === 'weapon') continue;
      const unique = item.rarity === 'boss' || sig.has(item.id), id = 'variant@' + item.id, glowKey = theme(item), trim = trimOf(item, unique), rank = { common: 0, uncommon: 1, rare: 2, epic: 3, boss: 4 }[item.rarity] || 0, core = modelOf(item);
      const glow = rank >= 3 ? glowKey : null;
      const plate = { frost: 'bronze', void: 'bone', lamellar: 'steel', barbarian: 'hide', iron: 'dark', gore: 'rust', holy: 'black', ember: 'black' }[family(item)] || 'black';
      try {
        if (item.slot === 'head') {
          if (/hood/.test(core)) { if (rank >= 2) tatters(id, rank >= 3 ? 'sable' : 'rag', trim === 'brass' ? 'bone' : trim, glow); continue; }
          if (rank >= 1) browBand(id, rank >= 2 ? trim : 'dark', glow);
          if (MASKS.has(core) && rank >= 2) visorGlow(id, glow || 'ember');
          if (unique) horns(id, 'horn', 'gold', .24, 'up');
          else if (rank >= 3) {
            const k = item.id.length % 4;
            if (/barrow|king/.test(item.id)) { const sp = []; for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, h = i % 2 ? .07 : .12, b = [hc.x + Math.sin(a) * (rx + .012), hc.y + ry * .44, hc.z + Math.cos(a) * (rz + .012)]; sp.push(G.spike(.013, b, [b[0] + Math.sin(a) * .02, b[1] + h, b[2] + Math.cos(a) * .02], 5)); if (!(i % 2)) sp.push(G.sphere(.008, [b[0] + Math.sin(a) * .022, b[1] + h + .004, b[2] + Math.cos(a) * .022], null, 8, 6)); } emit('head', id, 'gold', sp, 'head'); part('head', id, 'gold', G.shell(44, 3, (u, v) => { const a = u * TAU; return [hc.x + Math.sin(a) * (rx + .016), hc.y + ry * (.36 + v * .1), hc.z + Math.cos(a) * (rz + .016)]; }, .004, true), 'head'); }
            else if (/breath|gaze/.test(item.id)) horns(id, 'bone', trim, .15, 'fwd');
            else if (k === 0) { crest(id, 'black', 7, .08); aventail(id, .25); }
            else if (k === 1) { aventail(id, .35); plume(id, clothOf(item)); }
            else if (k === 2) { horns(id, 'horn', trim, .16, 'down'); aventail(id, .2, 'mail'); }
            else { crest(id, 'black', 5, .11); plume(id, clothOf(item)); }
          } else if (rank === 2) aventail(id, .15);
        } else if (item.slot === 'chest') {
          if (rank >= 1) riveted(id, rank >= 2 ? trim : 'dark');
          const fam = family(item);
          if (rank >= 2) {
            if (fam === 'lamellar') { silkSash(id, 'crimson'); tassets(id, 'steel', 'brass', 2); }
            else if (fam === 'barbarian') { furCollar(id); crossStraps(id); }
            else if (fam === 'iron') { tabard(id, 'sable', 'gold', glow); tassets(id, 'dark', 'steel', 2); }
            else if (fam === 'holy') tassets(id, 'black', 'gold', 2);
          }
          if (rank >= 3 && !unique) {
            if (fam === 'lamellar') lamellarWings(id, 'steel', 'brass');
            else if (fam === 'barbarian' || fam === 'void') boneTeeth(id);
            else if (fam === 'frost') bellPauldron(id, 'bronze', 'bronze');
            else if (fam === 'ember') emberOrbs(id, 'ember');
            else if (fam === 'gore') chainMantle(id);
            else if (fam === 'holy') wingPauldron(id, 'gold', 'black');
          }
          if (unique) { spikedPauldron(id, 'black', 'gold', 3, .13, true); sigil(id, 'gold', glowKey, 'sun'); halfCape(id, 'crimson', .52); }
          else if (rank >= 3) {
            const k = item.id.length % 3;
            if (/hollow|sunless/.test(item.id)) { sigil(id, 'bone', glow, 'skull'); trophySkulls(id); }
            else if (k === 0) { spikedPauldron(id, plate, trim, 3, .085, false); sigil(id, trim, glow, 'diamond'); }
            else if (k === 1) { sigil(id, trim, glow, 'sun'); halfCape(id, clothOf(item), .42); }
            else { spikedPauldron(id, plate, trim, 2, .1, false); sigil(id, trim, glow, 'diamond'); }
          }
        } else if (item.slot === 'hands') {
          if (rank >= 2 && !/wrap/.test(item.id)) cuff(id, rank >= 3 ? 'black' : 'dark', trim, rank >= 3 ? .03 : .018);
          if (rank >= 3) knuckles(id, 'black', trim, glow, unique);
        } else if (item.slot === 'boots') {
          const fam = family(item);
          if (rank >= 1) { if (fam === 'barbarian' || fam === 'gore') legWraps(id, fam === 'gore' ? 'sable' : 'rag'); else if (fam !== 'void') kneeCops(id, plate, trim); }
          if (rank >= 3) kneeSpikes(id, 'black', trim, glow, true);
          else if (rank === 2) kneeSpikes(id, 'dark', trim, null, false);
        }
      } catch (error) { console.warn('gear-armor', item.id, error); }
      commit(item.id);
    }
    B.GearArmor.looks = lookOf;
  }
  // Family name shown in the character screen (identity only; no set bonus).
  const FAMILY_NAME = { ember: 'Ocak Dökümü', frost: 'Deniz Nöbetçisi', holy: 'Kral Mezarı', gore: 'Cellat Yası', void: 'Kemik Ayini', lamellar: 'Lamel Muhafız', barbarian: 'Derili Barbar', iron: 'Demir Muhafız' };
  function familyName(item) { if (!item || item.rarity === 'common') return ''; const n = FAMILY_NAME[family(item)]; return n ? KabirI18n.t(n) : ''; }
  B.GearArmor = { build, looks: {}, familyName };
})();
