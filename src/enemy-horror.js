/* KARA GEÇİT — enemy horror pass (ajan:visual-dark). After a foe's own recipe has fitted its body and gear, this adds
   silhouette-breaking growths so every type reads at a glance even from the far isometric camera: dorsal bone spines,
   curled horns, an exposed rib cage, torn shroud strips hanging from the shoulders. All pieces are rigid to an existing bone
   (no new bones, no animation change) and join material groups the type already draws where possible.
   Measurements come from the body mesh in the bind pose, so spines sit on the back and ribs on the chest of every body.
   Loaded before authored-models.js builds a blueprint; publishes BABA.EnemyHorror. ?nohorror turns it off. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var T = window.THREE;
  var OFF = /[?&]nohorror/.test(location.search);
  var KIT = {
    crawler: ['spines'], cavefang: ['spines', 'horns'], slagcrawler: ['spines'], voidcrawler: ['spines'],
    ashbound: ['ribs', 'spines'], emberbound: ['horns'], damned: ['horns', 'ribs'], chainjailer: ['horns'],
    drowned: ['ribs', 'tatters'], rootborn: ['ribs'], lantern: ['tatters'], shardseer: ['tatters'], chainseer: ['tatters'],
    verdictseer: ['tatters'], prisoner: ['tatters']
  };
  function pick(A, list) { for (var i = 0; i < list.length; i++) if (A.index && A.index[list[i]] !== undefined) return list[i]; return null; }
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  function apply(type, A, recipe) {
    var kit = KIT[type]; if (OFF || !kit || !B.Gear) return;
    var G = B.Gear, mats = recipe.materials || (recipe.materials = {});
    var head = pick(A, ['Head', 'head']), s3 = pick(A, ['spine_03', 'spine03']), s2 = pick(A, ['spine_02', 'spine02']), s1 = pick(A, ['spine_01', 'spine01']), neck = pick(A, ['neck_01', 'neck']);
    var pelvis = pick(A, ['pelvis']);
    if (!head || !s3 || !s2 || !pelvis) return;
    var hp = A.P(head), pp = A.P(pelvis), sc = Math.max(.5, (hp.y - pp.y) / .62);
    // Body samples in the bind pose: back/front surface (z) along the midline at a height, top of the skull.
    var verts = [];
    (A.parts || []).forEach(function (part) { if (!part.body) return; var p = part.geometry.attributes.position; for (var i = 0; i < p.count; i += 2) verts.push(p.getX(i), p.getY(i), p.getZ(i)); });
    function surf(y, side, xw) { var best = side < 0 ? 1e9 : -1e9, w = xw || .07 * sc; for (var i = 0; i < verts.length; i += 3) { if (Math.abs(verts[i]) > w || Math.abs(verts[i + 1] - y) > .035 * sc) continue; var z = verts[i + 2]; if (side < 0 ? z < best : z > best) best = z; } return Math.abs(best) < 1e8 ? best : null; }
    var top = -1e9; for (var i = 0; i < verts.length; i += 3) if (Math.abs(verts[i]) < .05 * sc && Math.abs(verts[i + 2] - hp.z) < .08 * sc && verts[i + 1] > top) top = verts[i + 1];
    if (top < hp.y) top = hp.y + .12 * sc;
    var boneKey = mats.bone ? 'bone' : mats.ash ? 'ash' : 'bone', ragKey = mats.rag ? 'rag' : mats.burlap ? 'burlap' : 'rag';
    var hornKey = mats.ash ? 'ash' : mats.dark ? 'dark' : boneKey;

    kit.forEach(function (k) {
      try {
        if (k === 'spines') {
          // a ridge of hooked bone spines down the back, longest between the shoulder blades
          var ys = [], y0 = pp.y + .1 * sc, y1 = A.P(s3).y + .08 * sc, n = 6;
          for (var j = 0; j < n; j++) ys.push(y0 + (y1 - y0) * j / (n - 1));
          var bySeg = {};
          ys.forEach(function (y, j) {
            var bz = surf(y, -1); if (bz === null) return;
            var len = (.07 + .11 * Math.sin((j + .5) / n * Math.PI)) * sc, base = V(0, y, bz + .012 * sc), tip = V(0, y + len * .55, bz - len);
            var bone = y < A.P(s2).y ? s1 || s2 : y < A.P(s3).y ? s2 : s3;
            (bySeg[bone] = bySeg[bone] || []).push(G.spike(.028 * sc * (.7 + .5 * Math.sin((j + .5) / n * Math.PI)), base, tip, 6));
          });
          Object.keys(bySeg).forEach(function (bone) { A.rigid(boneKey, G.merge(bySeg[bone]), bone); });
        } else if (k === 'horns') {
          // two curled horns sweeping back from the brow: a broken, unmistakable head silhouette
          var parts = [];
          [-1, 1].forEach(function (sd) {
            var b = V(sd * .055 * sc, top - .035 * sc, hp.z + .03 * sc), r = .034 * sc;
            var pts = [b, V(sd * .12 * sc, top + .05 * sc, hp.z - .01 * sc), V(sd * .17 * sc, top + .09 * sc, hp.z - .1 * sc), V(sd * .16 * sc, top + .05 * sc, hp.z - .19 * sc), V(sd * .13 * sc, top - .02 * sc, hp.z - .22 * sc)];
            parts.push(G.tube(pts, function (t) { return r * (1 - t * .88); }, 7, 16, true));
          });
          A.rigid(hornKey, G.merge(parts), head);
        } else if (k === 'ribs') {
          // the chest is opened: rib bones bow out over the front of the torso
          var c3 = A.P(s3), ribs = [];
          for (var q = 0; q < 4; q++) {
            var y = c3.y + .02 * sc - q * .055 * sc, fz = surf(y, 1, .03 * sc); if (fz === null) continue;
            [-1, 1].forEach(function (sd) {
              var sz = surf(y, 1, .14 * sc) || fz;
              ribs.push(G.tube([V(sd * .015 * sc, y, fz + .008 * sc), V(sd * .075 * sc, y - .012 * sc, Math.max(fz, sz) + .012 * sc), V(sd * .13 * sc, y - .03 * sc, sz - .03 * sc), V(sd * .155 * sc, y - .045 * sc, sz - .09 * sc)], .011 * sc, 5, 10, true));
            });
          }
          if (ribs.length) A.rigid(boneKey, G.merge(ribs), s3);
        } else if (k === 'tatters') {
          // torn shroud strips from the shoulders down the back to the hips (rigid to the upper spine: they sway with the torso)
          var c = A.P(s3), strips = [];
          [-.13, -.05, .04, .12].forEach(function (x, j) {
            var bz = surf(c.y + .05 * sc, -1, .16 * sc); if (bz === null) return;
            var len = (.42 + .12 * ((j * 7) % 3)) * sc, w = .07 * sc, xx = x * sc;
            var g = G.sheet(3, 9, function (u, v) { return [xx + (u - .5) * w * (1 - v * .45), c.y + .09 * sc - v * len, bz - .035 * sc - v * .06 * sc + Math.sin(v * 7 + j) * .012 * sc]; }, false);
            if (G.wear) G.wear(g, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .5, width: .03, bottom: .25, base: .02 } });
            strips.push(g);
          });
          if (strips.length) A.rigid(ragKey, G.merge(strips), s3);
        }
      } catch (e) { if (window.console) console.warn('horror ' + type + ' ' + k + ': ' + (e && e.message)); }
    });
  }
  B.EnemyHorror = { apply: apply, kit: KIT };
}());
