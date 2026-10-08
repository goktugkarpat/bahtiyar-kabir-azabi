/* KARA KIYI — iki yeni sıradan düşman (ajan EN2): Ağ Dökücü (tuzak kurucu) ve Dip Çağırıcısı (boğuk eller / köpük havuzları).
   Tek dosya: sayılar (TUNE), modeller (B.CoastKit.extra), hamleler (B.MobsC2.list), çeviriler. Kancalar:
   coast-models.js (B.CoastKit + extra + registerExtra), coast-combat.js (stats + attack), audio.js, target-hud.js, coast-world.js (yerleşim).
   coast-models.js'ten ÖNCE yüklenir (yalnız B.Gear ister). */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, G = B.Gear, TAU = Math.PI * 2;
  var tr = function (s) { return KabirI18n.t(s); };
  /* ---- KOLAY AYAR: tüm sayılar burada ---- */
  var TUNE = {
    netcaster:  { hp: 122, speed: 2.15, radius: .5, reach: 12, cooldown: 2.2, gaff: 12, thrust: 10, netPool: 6, netLand: 0, trap: 15 },
    tidecaller: { hp: 116, speed: 1.95, radius: .46, reach: 11, cooldown: 2.35, rap: 11, hand: 12, foam: 5 }
  };
  var N = TUNE.netcaster, C = TUNE.tidecaller;
  var stats = {
    netcaster: { name: tr('Ağ Dökücü'), hp: N.hp, speed: N.speed, radius: N.radius, reach: N.reach, cooldown: N.cooldown, color: 0xb9a778, coast: true, ranged: true },
    tidecaller: { name: tr('Dip Çağırıcısı'), hp: C.hp, speed: C.speed, radius: C.radius, reach: C.reach, cooldown: C.cooldown, color: 0x7fc4b8, coast: true, ranged: true }
  };
  Object.assign(KabirI18n.dictionary || {}, {
    'Ağ Dökücü': 'Net Caster', 'Dip Çağırıcısı': 'Depth Caller', 'Çengel Savuruşu': 'Gaff Sweep', 'Zıpkın Dürtüşü': 'Gaff Thrust',
    'Ağ Çukuru': 'Net Pit', 'Kıskaç Tuzakları': 'Pincer Snares', 'Kabuk Asası': 'Shell Staff', 'Boğuk Eller': 'Muffled Hands', 'Tuzlu Köpük': 'Brine Foam'
  });
  var v3 = function (x, y, z) { return new T.Vector3(x, y, z); }, arr = function (p) { return [p.x, p.y, p.z]; };

  /* ---------------- MODELLER ---------------- */
  function lerpPath(a, b, n, sag) { var o = []; for (var i = 0; i <= n; i++) { var t = i / n; o.push(v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * (sag || 0), a.z + (b.z - a.z) * t)); } return o; }
  function gaff() {
    var pole = G.tube([[0, -.2, 0], [.01, .5, 0], [0, 1.25, 0]], function (t) { return .033 - .007 * t + .002 * Math.sin(t * 30); }, 10, 28, true);
    var hook = G.tube([[0, 1.22, 0], [.03, 1.36, 0], [.15, 1.43, 0], [.27, 1.35, 0], [.29, 1.2, 0]], function (t) { return .026 * (1 - t * .55); }, 8, 24, true);
    var iron = [hook, G.spike(.026, v3(.29, 1.2, 0), v3(.25, 1.02, 0)), G.ring(.04, .01, [0, 1.2, 0], [Math.PI / 2, 0, 0], 6, 16), G.ring(.04, .008, [0, .2, 0], [Math.PI / 2, 0, 0], 6, 16)];
    var rope = [G.tube([[.04, 1.16, .02], [.07, .85, .05], [.02, .6, .03], [.05, .35, .04]], .012, 6, 18, true)];
    [pole].forEach(function (g) { var uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * .1 + .2, uv.getX(i) * .3 + .4); });
    return { parts: { wood: [pole], iron: iron, rope: rope }, tip: v3(.27, 1.38, 0) };
  }
  function bellStaff() {
    var pole = G.tube([[0, -.2, 0], [-.01, .6, 0], [.01, 1.3, 0]], function (t) { return .03 - .006 * t + .002 * Math.sin(t * 24); }, 9, 26, true);
    var bell = G.lathe([[.03, 0], [.07, .02], [.11, .07], [.14, .17], [.17, .27], [.2, .35], [.215, .37], [.2, .385], [.18, .37]], 28); bell.rotateX(Math.PI); bell.translate(0, 1.58, 0);
    var shells = [], k;
    for (k = 0; k < 6; k++) { var a = k * 2.4; shells.push(G.sphere(.022 + (k % 3) * .006, [Math.cos(a) * .12, 1.45 + Math.sin(k * 1.7) * .06, Math.sin(a) * .12], [1, .55, 1], 8, 6)); }
    var collar = G.ring(.055, .014, [0, 1.3, 0], [Math.PI / 2, 0, 0], 6, 18), kelp = [];
    for (k = 0; k < 4; k++) { var b = k / 4 * TAU; kelp.push(G.tube([[Math.cos(b) * .04, 1.3, Math.sin(b) * .04], [Math.cos(b) * .12, 1.05, Math.sin(b) * .12], [Math.cos(b + .5) * .09, .72 - k * .05, Math.sin(b + .5) * .09]], function (t) { return .02 * (1 - t) + .004; }, 6, 16, true)); }
    return { parts: { wood: [pole], brass: [bell, collar], bone: shells, flesh: kelp, glow: [G.sphere(.034, [0, 1.44, 0], [1, 1.4, 1], 12, 8)], void: [G.sphere(.13, [0, 1.47, 0], [1, .15, 1], 14, 6)] }, tip: v3(0, 1.45, 0) };
  }
  var extra = {};
  // Ağ Dökücü: ince, hasırlı kamış şapka, sırtında halat sargısı, elinde sinkerli ağ, çengelli sırık.
  extra.netcaster = function (A, c) {
    var K = B.CoastKit, p = c.p, chest = c.chest, hip = c.hip, head = c.head, spine = c.spine, M = c.materials, i, k;
    A.slim(c.skin, { upperarm_l: .86, upperarm_r: .86, spine_01: .88, spine_02: .92 }, 1);
    M.skin.color.multiply(new T.Color(.96, .92, .84)); M.rope = M.rope.clone(); M.rope.color.multiplyScalar(.42);
    // hat: tarred hemp brim with a rope band and barnacles
    var hat = G.lathe([[0, .2], [.05, .18], [.11, .13], [.19, .07], [.3, .025], [.33, .005], [.32, -.012], [.24, .0], [.15, .04], [.105, .08], [.06, .105], [0, .11]], 30);
    hat.translate(p.x, p.y + .1, p.z - .01); G.uvScale(hat, 3, 3); A.rigid('rag', hat, head);
    A.rigid('rope', G.ring(.12, .012, [p.x, p.y + .125, p.z - .01], [0, 0, 0], 6, 24), head);
    K.growth(A, head, v3(p.x + .02, p.y + .17, p.z - .02), .1, 8, 'bone');
    K.grin(A, head, p.clone().add(v3(0, -.01, .035)), .088); K.eye(A, head, p, .013);
    // back: coiled hawser disc, cork floats, harpoon-barbed rope strap across the chest
    for (i = 0; i < 3; i++) A.rigid('rope', G.ring(.115 - i * .018, .02, [chest.x + .03, chest.y - .2 - i * .045, chest.z - .15 - i * .01], [Math.PI / 2, 0, .25], 6, 22), spine);   // a small slung coil low on the back (was a 5-ring disc that read as a round bulge)
    A.rigid('wood', G.merge([-1, 0, 1].map(function (s) { return G.sphere(.075, [hip.x + s * .12, hip.y - .02, hip.z - .24], [1, .8, 1], 10, 8); })), 'pelvis');
    var strap = lerpPath(v3(chest.x + .20, chest.y + .15, chest.z + .1), v3(chest.x - .19, chest.y - .36, chest.z + .1), 8, 0).map(function (q) { return arr(K.skinPoint(A, q, .018)); });
    K.tube(A, 'rope', spine, strap, .022);
    for (i = 0; i < 5; i++) { var q = K.skinPoint(A, v3(chest.x + .2 - i * .09, chest.y + .13 - i * .11, chest.z + .1), .03); A.rigid('iron', G.sphere(.022, arr(q), 1, 8, 6), spine); }
    [-1, 1].forEach(function (s) { K.plate(A, spine, chest.clone().add(v3(s * .28, .05, .12)), .09, 1.2, 'ash', s + 2); });
    K.growth(A, spine, chest.clone().add(v3(-.12, -.12, .12)), .13, 12, 'bone');
    // left hand: the weighted cast-net, strands end in lead sinkers
    var hl = A.P(c.handL), strands = [], sinkers = [];
    for (i = 0; i < 9; i++) { var a = i / 9 * TAU, rr = .05 + (i % 3) * .035, len = .52 + (i % 4) * .08, bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
      strands.push(G.tube([arr(hl.clone().add(v3(bx * .3, -.03, bz * .3))), arr(hl.clone().add(v3(bx * 1.6, -len * .5, bz * 1.6))), arr(hl.clone().add(v3(bx * 2.3, -len, bz * 2.3)))], .0085, 5, 14, true));
      sinkers.push(G.sphere(.03, arr(hl.clone().add(v3(bx * 2.3, -len - .02, bz * 2.3))), [1, 1.2, 1], 8, 6)); }
    for (k = 0; k < 2; k++) { var cross = []; for (i = 0; i <= 9; i++) { var b2 = i / 9 * TAU, rad = (.1 + k * .09); cross.push(arr(hl.clone().add(v3(Math.cos(b2) * rad * .9, -.2 - k * .24, Math.sin(b2) * rad * .9)))); } strands.push(G.tube(cross, .0065, 5, 30, false)); }
    A.rigid('rope', G.merge(strands), c.handL); A.rigid('iron', G.merge(sinkers), c.handL);
    return { weapon: gaff(), materials: M };
  };
  // Dip Çağırıcısı: uzun, solgun, kabuklu taçlı; sallanan tuz cüppesi; çan başlıklı asa.
  extra.tidecaller = function (A, c) {
    var K = B.CoastKit, p = c.p, chest = c.chest, hip = c.hip, head = c.head, spine = c.spine, M = c.materials, i, s;
    A.slim(c.skin, { upperarm_l: .82, upperarm_r: .82, lowerarm_l: .88, lowerarm_r: .88, spine_01: .84, spine_02: .88 }, 1);
    M.skin.color.multiply(new T.Color(.82, 1.0, .98)); M.rag.color.setRGB(.55, .62, .6);
    K.grin(A, head, p.clone().add(v3(0, -.015, .03)), .1); K.eye(A, head, p, .014);
    var third = K.skinPoint(A, p.clone().add(v3(0, .075, .16)), .006); A.rigid('sea-glow', G.sphere(.017, arr(third), [1, 1.3, .7], 10, 8), head);
    // shell crown: spiral conch mitre + two curled horn shells + bone ribs
    var mitre = G.lathe([[.17, 0], [.165, .05], [.14, .13], [.105, .23], [.07, .34], [.035, .45], [0, .53]], 26);
    var mp = mitre.attributes.position; for (i = 0; i < mp.count; i++) { var ang = Math.atan2(mp.getX(i), mp.getZ(i)), yy = mp.getY(i), rr = Math.hypot(mp.getX(i), mp.getZ(i)), ridge = 1 + .09 * Math.pow(Math.max(0, Math.sin(ang * 3 + yy * 16)), 2); mp.setX(i, mp.getX(i) / Math.max(rr, 1e-4) * rr * ridge); mp.setZ(i, mp.getZ(i) / Math.max(rr, 1e-4) * rr * ridge); }
    mitre.computeVertexNormals(); mitre.translate(p.x, p.y + .1, p.z - .03); A.rigid('bone', mitre, head);
    for (i = 0; i < 4; i++) A.rigid('ash', G.ring(.15 - i * .028, .01, [p.x, p.y + .15 + i * .1, p.z - .03], [0, 0, 0], 5, 22), head);
    [-1, 1].forEach(function (sd) {
      var pts = []; for (var j = 0; j <= 10; j++) { var t = j / 10, ang = t * 4.2; pts.push([p.x + sd * (.14 + Math.sin(ang) * .1 * (1 - t * .4)), p.y + .12 + (1 - Math.cos(ang)) * .09 + t * .14, p.z - .04 + Math.cos(ang * .8) * .03]); }
      A.rigid('bone', G.tube(pts, function (t) { return .03 * (1 - t) + .006; }, 7, 30, true), head);
    });
    K.growth(A, head, v3(p.x, p.y + .07, p.z - .14), .12, 14, 'bone');
    // kelp veil strips down from the crown, wet rotten hide
    for (i = 0; i < 7; i++) { var a = Math.PI * (.9 + i / 6 * 1.2), bx = Math.sin(a) * .14, bz = Math.cos(a) * .14 - .03;
      A.rigid('flesh', G.tube([[p.x + bx, p.y + .08, p.z + bz], [p.x + bx * 1.35, p.y - .1, p.z + bz * 1.3 - .04], [p.x + bx * 1.5, p.y - .34 - (i % 3) * .06, p.z + bz * 1.4 - .1]], function (t) { return .02 * (1 - t) + .004; }, 6, 18, true), head); }
    // bronze chime collar with pins, and a drowned pearl pendant
    var np = A.P(c.neck); A.rigid('brass', G.ring(.115, .026, [np.x, np.y + .03, np.z], [0, 0, 0], 7, 28), c.neck);
    A.rigid('sea-glow', G.sphere(.032, arr(K.skinPoint(A, chest.clone().add(v3(0, .08, .4)), .06)), [1, 1.2, 1], 10, 8), spine);
    // long robe, torn & salt-stiff: skinned to the body so it swings with the hips
    var robe = G.sheet(32, 22, function (u, v) {
      var a = u * TAU, r = .21 + v * v * .12 + Math.sin(a * 6 + v * 2) * .018 * v, hem = Math.sin(a * 7) * .04 * v * v + Math.sin(a * 13) * .02 * v * v;
      return [hip.x + Math.sin(a) * r * 1.04, chest.y + .06 - v * (chest.y - hip.y + .95) + hem, hip.z + Math.cos(a) * r];
    }, true, false);
    G.uvScale(robe, 3, 3); G.wear(robe, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .85, width: .06, bottom: .2, base: .03 } });
    A.transfer('rag', robe, ['skin']);
    K.growth(A, 'pelvis', hip, .18, 11, 'bone');
    [c.handL, c.handR].forEach(function (b) { K.growth(A, b, A.P(b), .06, 6, 'bone'); });
    [-1, 1].forEach(function (sd) { K.plate(A, spine, chest.clone().add(v3(sd * .27, .06, .1)), .1, 1.1, 'ash', sd + 4); });
    return { weapon: bellStaff(), materials: M };
  };
  B.CoastKit = B.CoastKit || {};
  B.CoastKit.extra = extra;
  // coast-models.js passes its local make(): netcaster / tidecaller share its skin, cloth and skirt pipeline.
  B.CoastKit.registerExtra = function (make) {
    make('netcaster', { base: 'ubc', height: 2.3, radius: N.radius, motionType: 'cultist', detailMotion: motion('netcaster') });
    make('tidecaller', { base: 'ubc', height: 2.5, radius: C.radius, motionType: 'cultist', detailMotion: motion('tidecaller') });
  };

  /* ---------------- ANİMASYON (üst katman) ---------------- */
  function motion(type) {
    return function (bones, scene, scale) {
      var q = new T.Quaternion(), x = new T.Vector3(1, 0, 0), y = new T.Vector3(0, 1, 0), z = new T.Vector3(0, 0, 1);
      var spine = bones.spine_03, spine1 = bones.spine_01, head = bones.Head, neck = bones.neck_01, uaL = bones.upperarm_l, uaR = bones.upperarm_r, laL = bones.lowerarm_l;
      var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function turn(b, axis, a) { if (b && Math.abs(a) > .0001) { q.setFromAxisAngle(axis, a); b.quaternion.multiply(q); } }
      return function (dt, s) {
        if (s.dead || s.hurt || s.stagger) return;
        var t = s.time || 0, m = s.move || 0, idle = 1 - Math.min(1, (s.attack || 0) * 8), p = Math.sin(Math.min(1, s.attack || 0) * Math.PI), pose = s.pose;
        if (type === 'netcaster') {
          // stooped fisherman's shuffle: hips roll, the heavy net arm swings opposite
          turn(spine1, x, .1 + Math.sin(t * 2.2) * .012 * idle); turn(spine, z, Math.sin(t * 3.4) * .05 * m * idle); turn(head, z, -.06 + Math.sin(t * 1.1) * .03 * idle);
          turn(laL, x, .22 + Math.sin(t * 3.4 + 1) * .12 * m * idle); turn(neck, y, calm ? 0 : Math.sin(t * .7) * .1 * idle);
          if (pose === 'throw' || pose === 'castHigh') { turn(spine, x, .2 * p); turn(spine1, x, -.34 * p); turn(uaL, z, .5 * p); turn(head, x, -.12 * p); }
          if (pose === 'crouch') { turn(spine1, x, .36 * p); turn(head, x, -.18 * p); }
          if (pose === 'sweep' || pose === 'thrust') { turn(spine, y, (pose === 'sweep' ? .26 : 0) * p); turn(spine1, x, .1 * p); }
        } else {
          // floats a little, sways like a reed; arms rise when it calls the water
          turn(spine1, z, Math.sin(t * 1.1) * .04 * idle); turn(spine, x, -.06 + Math.sin(t * 1.6) * .018 * idle); turn(neck, x, .1); turn(head, x, -.1 + Math.sin(t * 1.3) * .025 * idle);
          turn(head, y, calm ? 0 : Math.sin(t * .6) * .12 * idle); turn(uaL, z, -.1 * idle); turn(uaR, z, .1 * idle);
          if (pose === 'castHigh' || pose === 'throw' || pose === 'cast') { turn(spine, x, -.24 * p); turn(head, x, -.26 * p); turn(uaL, z, -.55 * p); turn(uaR, z, .55 * p); turn(uaL, x, -.4 * p); turn(uaR, x, -.4 * p); }
          if (pose === 'staffSwing' || pose === 'sweep') turn(spine, y, -.28 * p);
        }
      };
    };
  }

  /* ---------------- HAMLELER ---------------- */
  var SPECIAL_IDS = ['netThrow', 'trapLine', 'drownHands', 'foam'];
  function list(e, d, H) {
    var api = H.api, hit = H.hit, cone = H.cone, point = H.point, out = [];
    function rnd() { e.seed = (Math.imul(e.seed, 1664525) + 1013904223) >>> 0; return e.seed / 4294967296; }
    // Menzilli oldukları için düz darbe menziline (≈3.5-4.6 m) girmezler; pick() ise ilk özel hamleden önce 2 düz darbe borcu ister -> hiç saldırmıyorlardı. Düz hamle yasalsa borç kalır, değilse silinir.
    if (!(d < (e.type === 'netcaster' ? 4.6 : 3.5))) e.spWait = 0;
    if (e.type === 'netcaster') {
      out = [
        { id: 'gaff', ok: d < 3.7, w: 4, move: function () { return cone(e, 'gaff', tr('Çengel Savuruşu'), 3.4, 2.1, N.gaff, 'sweep', .8); } },
        { id: 'gaffThrust', ok: d < 4.6, w: 2, move: function () { return { id: 'gaffThrust', name: tr('Zıpkın Dürtüşü'), duration: 1.5, pose: 'thrust', hits: [hit(.8, .8, 'line', 0, N.thrust, 'thrust', { width: 1.0, length: 4.4, style: 'thrust', fill: 'forward' })] }; } },
        // Ağ Çukuru: the net lands on the hero's spot; the tangled floor keeps biting for 4 s (low pressure), step out of it.
        { id: 'netThrow', sp: 1, ok: d > 3 && d < 12, w: 3, move: function () {
          var t = point();
          return { id: 'netThrow', name: tr('Ağ Çukuru'), duration: 2.6, pose: 'throw', hits: [hit(1.3, 1.3, 'circle', 2.5, N.netPool, 'throw', { origin: t, style: 'tide', fill: 'radial', persistent: true, periodic: true, interval: .85, duration: 4.2, pool: 'brine', unblockable: true, beat: true, attack: tr('Ağ Çukuru') })] };
        } },
        // Kıskaç Tuzakları: three snares close one after another around the hero (centre, then both flanks); roll through or leave the pocket.
        { id: 'trapLine', sp: 1, ok: d > 3.5 && d < 11, w: 3, move: function () {
          var t = point(), f = Math.atan2(t.x - e.x, t.z - e.z), px = Math.cos(f), pz = -Math.sin(f), hits = [], pos = [t, { x: t.x + px * 3.1, z: t.z + pz * 3.1 }, { x: t.x - px * 3.1, z: t.z - pz * 3.1 }];
          if (rnd() < .5) pos = [pos[0], pos[2], pos[1]];
          pos.forEach(function (o, i) { if (i && !api.walkable(o.x, o.z, 1)) return; hits.push(hit(1.55 + i * .5, 1.2, 'circle', 1.7, N.trap, 'crouch', { origin: o, style: 'tide', fill: 'inward', unblockable: true, beat: i === 0, attack: tr('Kıskaç Tuzakları') })); });
          return { id: 'trapLine', name: tr('Kıskaç Tuzakları'), duration: 3.2, pose: 'crouch', hits: hits };
        } }
      ];
    } else if (e.type === 'tidecaller') {
      out = [
        { id: 'rap', ok: d < 3.5, w: 4, move: function () { return cone(e, 'rap', tr('Kabuk Asası'), 3.2, 2.0, C.rap, 'staffSwing', .8); } },
        // Boğuk Eller: hands claw up out of the floor in a spiral round the hero, one after another.
        { id: 'drownHands', sp: 1, ok: d < 13, w: 4, move: function () {
          var t = point(), hits = [], a0 = rnd() * TAU, n = 5;
          for (var i = 0; i < n; i++) {
            var a = a0 + i * 2.1, r = i ? 2.0 + (i % 2) * 1.2 : 0, o = { x: t.x + Math.sin(a) * r, z: t.z + Math.cos(a) * r };
            if (i && !api.walkable(o.x, o.z, 1)) continue;
            hits.push(hit(1.4 + i * .3, 1.05, 'circle', 1.25, C.hand, 'castHigh', { origin: o, style: 'tide', fill: 'inward', unblockable: true, beat: i === 0, attack: tr('Boğuk Eller') }));
          }
          return { id: 'drownHands', name: tr('Boğuk Eller'), duration: 3.1, pose: 'castHigh', hits: hits };
        } },
        // Tuzlu Köpük: two foam pools bloom between caster and hero and stay 5 s (they cut the hero's approach line).
        { id: 'foam', sp: 1, ok: d > 4 && d < 13, w: 3, move: function () {
          var t = point(), f = Math.atan2(t.x - e.x, t.z - e.z), hits = [];
          [[.55, .6], [1, -.5]].forEach(function (k, i) { var dist = Math.max(3, d * k[0]) , a = f + k[1] * .5, o = { x: e.x + Math.sin(a) * dist, z: e.z + Math.cos(a) * dist }; if (i === 1) o = t; if (!api.walkable(o.x, o.z, 1)) return;
            hits.push(hit(1.3 + i * .3, 1.1, 'circle', 2.2, C.foam, 'throw', { origin: o, style: 'tide', fill: 'radial', persistent: true, periodic: true, interval: .8, duration: 5, pool: 'brine', unblockable: true, beat: i === 0, attack: tr('Tuzlu Köpük') })); });
          return { id: 'foam', name: tr('Tuzlu Köpük'), duration: 2.7, pose: 'throw', hits: hits };
        } }
      ];
    }
    return out;
  }
  B.MobsC2 = { TUNE: TUNE, stats: stats, list: list, specialIds: SPECIAL_IDS, types: ['netcaster', 'tidecaller'] };
}());
