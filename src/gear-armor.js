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
  const trimOf = item => item.rarity === 'boss' ? 'gold' : item.finish === 'bone' ? 'bone' : item.finish === 'blood' ? 'black' : item.finish === 'brine' ? 'bronze' : 'brass';
  const MASKS = new Set(['sealed-mask', 'furnace-mask']);
  function build(ctx) {
    const { A, part, sleeve, chest, hc, rx, ry, rz, facingAngle, modelOf } = ctx, G = B.Gear;
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
      part('head', id, mat || 'mail', G.shell(40, 10, sheet, .004, false), 'head');
      const rim = []; for (let n = 0; n < 40; n++) { const q = sheet((n + .5) / 40, 1); rim.push(G.ring(.006, .0014, q, [0, 0, 0], 3, 8)); } emit('head', id, 'steel', rim, 'head');
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
        const cap = (u, v) => { const a = u * TAU, e = mix(.02, 1.32, v); return [c.x + Math.sin(a) * px * R * Math.sin(e) + sign * .012, c.y + .03 + Math.cos(e) * .13 * R, c.z + Math.cos(a) * pz * R * Math.sin(e)]; };
        part('chest', id, mat, G.shell(32, 10, cap, .009, true), bone);
        part('chest', id, trim, G.tube(line(u => cap(u, 1), 40), .0042, 6, 48, true), bone);
        const sp = [], st = [];
        for (let i = 0; i < n; i++) { const t = (i + .5) / n, a = mix(-.9, .9, t) + (sign > 0 ? PI / 2 : -PI / 2), base = cap(a / TAU, .42), dir = new T.Vector3(base[0] - c.x, base[1] - c.y + .05, base[2] - c.z).normalize(); const L = len * (1 - Math.abs(t - .5) * .7); sp.push(G.spike(.016, base, [base[0] + dir.x * L, base[1] + dir.y * L, base[2] + dir.z * L], 6)); st.push(G.ring(.016, .003, base, null, 5, 14)); }
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
    function trophySkulls(id) {
      const out = { bone: [], black: [] };
      for (const u of [.08, .92, .2]) { const p = chest(u, .13, .075), sk = G.skull(.065, true); sk.parts.bone.forEach(q => { q.rotateY(u * TAU); q.translate(p[0], p[1] - .05, p[2]); out.bone.push(q); }); sk.parts.void.forEach(q => { q.rotateY(u * TAU); q.translate(p[0], p[1] - .05, p[2]); out.black.push(q); }); }
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
    function kneeSpikes(id, mat, trim, glow, spur) {
      for (const s of ['L', 'R']) {
        const shin = 'shin' + s, foot = 'tarsal' + s, knee = A.P(shin), sk = A.box(A.cloud([shin], ['skin'], .42)), c = sk.getCenter(new T.Vector3());
        const kp = [knee.x, knee.y + .012, Math.max(knee.z + .09, c.z + .075)];
        part('boots', id, mat, G.spike(.02, kp, [kp[0], kp[1] + .05, kp[2] + .085], 6), shin);
        part('boots', id, trim, G.ring(.02, .004, kp, [PI / 2, 0, 0], 5, 16), shin);
        if (glow) part('boots', id, glow, G.sphere(.007, [kp[0], kp[1] - .03, kp[2] + .006], [1, 1, .5], 8, 6), shin);
        if (spur) { const fb = A.box(A.cloud([foot], ['skin'], .35)), hp = [mix(fb.min.x, fb.max.x, .5), fb.min.y + .04, fb.min.z - .02]; part('boots', id, trim, G.tube([hp, [hp[0], hp[1] + .004, hp[2] - .05]], .0035, 5, 6, true), foot); const r = new T.TorusGeometry(.014, .003, 4, 10); r.translate(hp[0], hp[1] + .004, hp[2] - .055); part('boots', id, mat, r, foot); }
      }
    }
    // ------------------------------------------------------------- catalogue pass
    for (const item of B.Progression.items) {
      if (item.slot === 'weapon') continue;
      const id = 'variant@' + item.id, glowKey = theme(item), trim = trimOf(item), rank = { common: 0, uncommon: 1, rare: 2, epic: 3, boss: 4 }[item.rarity] || 0, core = modelOf(item);
      const glow = rank >= 3 ? glowKey : null;
      try {
        if (item.slot === 'head') {
          if (/hood/.test(core)) { if (rank >= 3) browBand(id, trim, glow); continue; }
          if (rank >= 2) browBand(id, trim, glow);
          if (MASKS.has(core) && rank >= 2) visorGlow(id, glow || 'ember');
          if (item.rarity === 'boss') horns(id, 'horn', 'gold', .24, 'up');
          else if (rank >= 3) {
            const k = item.id.length % 4;
            if (/breath|gaze/.test(item.id)) horns(id, 'bone', trim, .15, 'fwd');
            else if (k === 0) { crest(id, 'black', 7, .08); aventail(id, .25); }
            else if (k === 1) { aventail(id, .35); plume(id, 'crimson'); }
            else if (k === 2) { horns(id, 'horn', trim, .16, 'down'); aventail(id, .2, 'mail'); }
            else { crest(id, 'black', 5, .11); plume(id, 'sable'); }
          } else if (rank === 2) aventail(id, .15);
        } else if (item.slot === 'chest') {
          if (rank >= 2) riveted(id, trim);
          if (item.rarity === 'boss') { spikedPauldron(id, 'black', 'gold', 3, .13, true); sigil(id, 'gold', glowKey, 'sun'); halfCape(id, 'crimson', .52); }
          else if (rank >= 3) {
            const k = item.id.length % 3;
            if (/hollow|sunless/.test(item.id)) { sigil(id, 'bone', glow, 'skull'); trophySkulls(id); }
            else if (k === 0) { spikedPauldron(id, 'dark', trim, 3, .085, false); sigil(id, trim, glow, 'diamond'); }
            else if (k === 1) { sigil(id, trim, glow, 'sun'); halfCape(id, 'sable', .42); }
            else { spikedPauldron(id, 'black', trim, 2, .1, false); sigil(id, trim, glow, 'diamond'); }
          }
        } else if (item.slot === 'hands') {
          if (rank >= 3) knuckles(id, 'black', trim, glow, item.rarity === 'boss');
        } else if (item.slot === 'boots') {
          if (rank >= 3) kneeSpikes(id, 'black', trim, glow, true);
          else if (rank === 2) kneeSpikes(id, 'dark', trim, null, false);
        }
      } catch (error) { console.warn('gear-armor', item.id, error); }
    }
  }
  B.GearArmor = { build };
})();
