/* KARA GEÇİT — Bahtiyar's bare-body detail (ajan:visual-dark + ajan:models). Publishes BABA.HeroDetail. ?nohero turns it all off.
   build(A, body)  proportions, called by R.hero BEFORE the mantle and every equipment piece is fitted (so armour follows):
                   wider clavicles, bigger hands and feet (bone offsets, bind pose re-baked), thick neck, traps, chest, lats and
                   limbs (flesh pushed off the bone axes), then a muscle-definition bake: mesh curvature -> kwear.y (grooves
                   darken like a cavity map) and kwear.w (a faint sweat sheen on the convex muscle bellies).
                   Vertical proportions are not touched: the face shader works in fixed head-height metres.
   skinFx(A)       a GLSL layer for the hero skin material (grade() in authored-models.js, KARA_BODY): raised veins along the
                   forearms and biceps, an old raised Turkic-runic armband tattoo round the left upper arm and a tamga on the left
                   chest (procedural canvas texture), glossy burn scars. Bind-space uniforms measured from the bones.
   apply(A, recipe, C)  secondary pieces under any equipment: blood-stained cloth wraps round the upper arms; a leather
                   neck cord with a wolf fang and an iron ring; a forged buckle plate on the belt. The cord, fang and buckle
                   are three 'hero-trinket-*' meshes that authored-models hides under closed chest armour. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var OFF = /[?&]nohero(&|$)/.test(location.search);
  var T = window.THREE;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // ------------------------------------------------------------------ proportions
  function build(A, body) {
    if (OFF) return false;
    var names = A.bones.map(function (b) { return b.name; }), len = { upper_armL: 1.1, upper_armR: 1.1, toeL: 1.1, toeR: 1.1 };
    names.forEach(function (n) { if (/^finger/i.test(n)) len[n] = 1.1; });
    A.lengthen(len);
    var bulk = { spine03: 1.15, spine02: 1.1, spine01: 1.04, neck: 1.17, shoulderL: 1.15, shoulderR: 1.15, upper_armL: 1.15, upper_armR: 1.15,
      forearmL: 1.15, forearmR: 1.15, handL: 1.13, handR: 1.13, thighL: 1.07, thighR: 1.07, shinL: 1.06, shinR: 1.06, tarsalL: 1.1, tarsalR: 1.1, toeL: 1.08, toeR: 1.08 };
    names.forEach(function (n) { if (/^finger/i.test(n)) bulk[n] = 1.13; });
    A.parts.forEach(function (p) { if (p.body && /^(skin|leather|base-skirt|base-straps|iron)$/.test(p.key)) A.slim(p, bulk, 1); });
    // trapezius and deltoid mass: the hero reads broad from the high camera
    try {
      var nk = A.P('neck'), sl = A.P('shoulderL'), sr = A.P('shoulderR'), al = A.P('upper_armL'), ar = A.P('upper_armR'), s3 = A.P('spine03');
      [sl, sr].forEach(function (s) { A.inflate(body, V(nk.x + (s.x - nk.x) * .55, nk.y - .01, nk.z - .03), .055, .012, [1.5, 1, 1.2]); });
      [al, ar].forEach(function (a) { A.inflate(body, V(a.x, a.y + .01, a.z), .06, .01); });
      // pectorals
      [-1, 1].forEach(function (sd) { A.inflate(body, V(s3.x + sd * .075, s3.y - .02, s3.z + .1), .06, .007, [1.3, .8, 1]); });
    } catch (e) { if (window.console) console.warn('hero bulk: ' + (e && e.message)); }
    bakeMuscle(body.geometry);
    return true;
  }
  // Curvature from the welded mesh: Laplacian along the normal, divided by the local edge length, smoothed twice.
  function bakeMuscle(g) {
    var p = g.attributes.position, nrm = g.attributes.normal, idx = g.index ? g.index.array : null, N = p.count; if (!idx || !nrm) return;
    var map = new Map(), ids = new Int32Array(N), M = 0;
    for (var i = 0; i < N; i++) { var key = Math.round(p.getX(i) * 2e4) + ',' + Math.round(p.getY(i) * 2e4) + ',' + Math.round(p.getZ(i) * 2e4), id = map.get(key); if (id === undefined) { id = M++; map.set(key, id); } ids[i] = id; }
    var pos = new Float32Array(M * 3), nn = new Float32Array(M * 3), sum = new Float32Array(M * 3), cnt = new Float32Array(M), elen = new Float32Array(M);
    for (i = 0; i < N; i++) { var k = ids[i]; pos[k * 3] = p.getX(i); pos[k * 3 + 1] = p.getY(i); pos[k * 3 + 2] = p.getZ(i); nn[k * 3] += nrm.getX(i); nn[k * 3 + 1] += nrm.getY(i); nn[k * 3 + 2] += nrm.getZ(i); }
    var ea = [], eb = [];
    for (var t = 0; t < idx.length; t += 3) for (var e = 0; e < 3; e++) { var a = ids[idx[t + e]], b = ids[idx[t + (e + 1) % 3]]; if (a !== b) { ea.push(a, b); eb.push(b, a); } }
    for (i = 0; i < ea.length; i++) { a = ea[i]; b = eb[i]; sum[a * 3] += pos[b * 3]; sum[a * 3 + 1] += pos[b * 3 + 1]; sum[a * 3 + 2] += pos[b * 3 + 2]; cnt[a]++;
      elen[a] += Math.hypot(pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]); }
    var lap = new Float32Array(M);
    for (k = 0; k < M; k++) { if (!cnt[k]) continue; var l = Math.hypot(nn[k * 3], nn[k * 3 + 1], nn[k * 3 + 2]) || 1, el = elen[k] / cnt[k] || 1;
      lap[k] = ((sum[k * 3] / cnt[k] - pos[k * 3]) * nn[k * 3] + (sum[k * 3 + 1] / cnt[k] - pos[k * 3 + 1]) * nn[k * 3 + 1] + (sum[k * 3 + 2] / cnt[k] - pos[k * 3 + 2]) * nn[k * 3 + 2]) / l / el; }
    for (var pass = 0; pass < 2; pass++) { var acc = new Float32Array(M), c2 = new Float32Array(M); for (i = 0; i < ea.length; i++) { acc[ea[i]] += lap[eb[i]]; c2[ea[i]]++; } for (k = 0; k < M; k++) lap[k] = c2[k] ? lap[k] * .5 + acc[k] / c2[k] * .5 : lap[k]; }
    if (!g.attributes.kwear) B.Gear.fillWear(g);
    var kw = g.attributes.kwear;
    for (i = 0; i < N; i++) { var c = lap[ids[i]]; kw.setY(i, Math.max(kw.getY(i), sstep(.015, .2, c) * .62)); kw.setW(i, Math.max(kw.getW(i), sstep(.02, .22, -c) * .13)); }
    kw.needsUpdate = true;
  }

  // ------------------------------------------------------------------ skin layer (veins, tattoo, burns)
  var TAT = null;
  function tattooTexture() {
    if (TAT) return TAT;
    var W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    // top half (v 0..0.5): armband — two borders, a wolf-tooth chain and Orkhon-style runes between them (tiled twice round the arm)
    x.lineWidth = 14; [[18, 18], [238, 238]].forEach(function (yy) { x.beginPath(); x.moveTo(0, yy[0]); x.lineTo(W, yy[1]); x.stroke(); });
    x.lineWidth = 9; [34, 222].forEach(function (yy, k) { x.beginPath(); for (var i = 0; i <= 32; i++) { var px = i * W / 32, py = yy + (i % 2 ? (k ? -22 : 22) : 0); if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); });
    x.lineWidth = 13;
    var RUNES = [[[0, 0, 0, 1], [0, .5, .6, 0]], [[0, 0, .5, .5], [.5, .5, 0, 1], [.5, .5, .5, 1]], [[0, 0, 0, 1], [.6, 0, .6, 1], [0, .5, .6, .5]], [[.3, 0, .3, 1], [0, .3, .3, 0], [.6, .3, .3, 0]], [[0, 1, .3, 0], [.3, 0, .6, 1]], [[0, 0, .6, 1], [.6, 0, 0, 1]], [[.3, 0, .3, 1], [0, .7, .3, 1], [.6, .7, .3, 1]], [[0, .2, .6, 0], [0, .2, .6, .5], [0, .5, .6, .7]]];
    for (var r = 0; r < 16; r++) {
      var g = RUNES[r % RUNES.length], ox = 20 + r * W / 16, oy = 78, sw = 36, sh = 104;
      g.forEach(function (s) { x.beginPath(); x.moveTo(ox + s[0] * sw, oy + s[1] * sh); x.lineTo(ox + s[2] * sw, oy + s[3] * sh); x.stroke(); });
    }
    // bottom half (v 0.5..1): chest tamga — a ringed sun of hooks and a wolf-head chevron, old and blotted
    var cx = W * .25, cy = H * .75; x.lineWidth = 10; x.beginPath(); x.arc(cx, cy, 92, 0, Math.PI * 2); x.stroke(); x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, 70, 0, Math.PI * 2); x.stroke();
    for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; x.lineWidth = i % 3 ? 6 : 11; x.beginPath(); x.moveTo(cx + Math.cos(a) * 96, cy + Math.sin(a) * 96); x.lineTo(cx + Math.cos(a + .14) * 118, cy + Math.sin(a + .14) * 118); x.lineTo(cx + Math.cos(a + .3) * 112, cy + Math.sin(a + .3) * 112); x.stroke(); }
    x.lineWidth = 12; x.beginPath(); x.moveTo(cx - 40, cy - 30); x.lineTo(cx, cy + 40); x.lineTo(cx + 40, cy - 30); x.stroke();
    x.beginPath(); x.moveTo(cx - 40, cy - 30); x.lineTo(cx - 22, cy - 52); x.moveTo(cx + 40, cy - 30); x.lineTo(cx + 22, cy - 52); x.stroke();
    x.beginPath(); x.arc(cx, cy - 2, 8, 0, Math.PI * 2); x.fill();
    // ageing: blurred bleed, broken lines (skin pores, flaking)
    var cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; var y = cv2.getContext('2d'); y.filter = 'blur(2.2px)'; y.drawImage(cv, 0, 0); y.filter = 'none';
    y.globalCompositeOperation = 'destination-out';
    for (i = 0; i < 2600; i++) { y.fillStyle = 'rgba(0,0,0,' + (.25 + rnd() * .6) + ')'; y.beginPath(); y.arc(rnd() * W, rnd() * H, 1 + rnd() * 4.5, 0, Math.PI * 2); y.fill(); }
    y.globalCompositeOperation = 'source-over';
    TAT = new T.CanvasTexture(cv2); TAT.wrapS = T.RepeatWrapping; TAT.wrapT = T.ClampToEdgeWrapping; TAT.anisotropy = 4; TAT.name = 'kara:hero-tattoo'; TAT.colorSpace = T.NoColorSpace || '';
    return TAT;
  }
  var HEAD = 'uniform sampler2D kTat;uniform vec4 kSegA[4];uniform vec4 kSegB[4];uniform vec4 kBurn[3];uniform vec4 kChestTat;uniform float kBodyTop;\n';
  var FRAG = '#ifdef KARA_BODY\n{float bodyM=step(.5,kSkinMask)*(1.-smoothstep(kBodyTop-.03,kBodyTop,vKara.y));\n' +
    'if(bodyM>0.){vec3 P=vKara;float vein=0.,ink=0.;\n' +
    ' for(int i=0;i<4;i++){vec3 a=kSegA[i].xyz,ab=kSegB[i].xyz-a;float L=length(ab);vec3 d=ab/L;float t=dot(P-a,d)/L;vec3 q=P-a-d*(t*L);\n' +
    '  vec3 e1=normalize(cross(d,vec3(0.,0.,1.))),e2=cross(d,e1);float ang=atan(dot(q,e2),dot(q,e1));\n' +
    '  float inside=smoothstep(-.05,.1,t)*(1.-smoothstep(.88,1.02,t))*(1.-smoothstep(kSegA[i].w*1.6,kSegA[i].w*2.4,length(q)));\n' +
    '  if(inside>0.){float s=t*L,n=kN(vec3(ang*2.4+kN(vec3(s*16.,ang*1.7,float(i)))*1.6,s*3.2,float(i)*5.3)),r=1.-abs(2.*n-1.),w=i<2?.6:1.;\n' +
    '   vein=max(vein,smoothstep(.91,.975,r)*inside*w*(.45+.55*kN(vec3(s*7.,ang,9.))));\n' +
    '   if(i==0){float v=(t-kSegB[i].w)/.36;if(v>0.&&v<1.)ink=max(ink,texture2D(kTat,vec2(fract(ang/6.2832+.5)*2.,.5+v*.5)).r*inside);}}}\n' +
    ' {vec2 cu=(P.xy-kChestTat.xy)/kChestTat.w+.5;if(cu.x>0.&&cu.x<1.&&cu.y>0.&&cu.y<1.&&P.z>kChestTat.z-.04)ink=max(ink,texture2D(kTat,vec2(cu.x*.5,cu.y*.5)).r);}\n' +
    ' ink*=bodyM*(.7+.3*kN(P*300.));vein*=bodyM;\n' +
    ' diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.6,.7,.82),vein*.75);\n' +
    ' diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.02,.035,.045)+diffuseColor.rgb*.16,ink*.9);\n' +
    ' kFaceH+=vein*.0006+ink*.0004;\n' +
    ' float bu=0.;for(int i=0;i<3;i++){float d=length(P-kBurn[i].xyz)/kBurn[i].w;bu=max(bu,1.-smoothstep(.45+.4*kF(P*38.+float(i)*3.),1.,d));}\n' +
    ' bu*=bodyM;if(bu>0.){float m=kF(P*95.);diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.11,.035,.025),vec3(.36,.13,.085),m)*(.8+.4*kN(P*420.)),bu*.85);kGloss=max(kGloss,bu*.16);kFaceH+=bu*(m-.5)*.0009;}\n' +
    // mottled, unevenly soot-smeared skin (no even plastic tone), sweat-dark grooves already come from the curvature bake
    ' {float mot=kF(P*7.+vec3(3.)),soot=smoothstep(.52,.86,kF(P*15.+vec3(9.,2.,5.)));diffuseColor.rgb*=mix(1.,.8+.36*mot,bodyM);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.4,.36,.33),soot*bodyM*.6);}\n' +
    '}}\n#endif\n';
  function skinFx(A) {
    if (OFF) return null;
    try {
      function seg(from, to, tatStart) {
        var a = A.P(from), b = A.P(to), d = b.clone().sub(a), L = d.length(); d.normalize();
        var cl = A.cloud([from], ['skin'], .5), r = 0, n = 0; cl.forEach(function (p) { var q = p.clone().sub(a), t = q.dot(d); if (t < 0 || t > L) return; r += q.addScaledVector(d, -t).length(); n++; });
        return [new T.Vector4(a.x, a.y, a.z, n ? r / n : .04), new T.Vector4(b.x, b.y, b.z, tatStart || 0)];
      }
      var s = [seg('upper_armR', 'forearmR', .08), seg('upper_armL', 'forearmL'), seg('forearmL', 'handL'), seg('forearmR', 'handR')];
      function onSkin(p) { var q = A.nearest(p, ['skin']); return q ? V(q.x, q.y, q.z) : p; }
      var s3 = A.P('spine03'), s2 = A.P('spine02'), fl = A.P('forearmL'), hl = A.P('handL'), sr = A.P('shoulderR');
      var chest = onSkin(V(s3.x - .085, s3.y + .0, s3.z + .5));
      var burns = [onSkin(V(s2.x - .14, s2.y + .02, s2.z + .3)), onSkin(fl.clone().lerp(hl, .45).add(V(0, .03, .2))), onSkin(V(sr.x - .02, sr.y + .02, sr.z - .3))];
      var rad = [.055, .035, .05];
      return { uniforms: {
        kTat: { value: tattooTexture() }, kSegA: { value: s.map(function (x) { return x[0]; }) }, kSegB: { value: s.map(function (x) { return x[1]; }) },
        kBurn: { value: burns.map(function (p, i) { return new T.Vector4(p.x, p.y, p.z, rad[i]); }) },
        kChestTat: { value: new T.Vector4(chest.x, chest.y, chest.z, .15) }, kBodyTop: { value: A.P('head').y - .02 }
      }, head: HEAD, frag: FRAG };
    } catch (e) { if (window.console) console.warn('hero skin fx: ' + (e && e.message)); return null; }
  }

  // ------------------------------------------------------------------ secondary pieces
  function apply(A, recipe, C) {
    if (OFF || !C || !C.sleeve || !B.Gear) return;
    var G = B.Gear, mats = recipe.materials || (recipe.materials = {});
    if (!mats['hero-wrap'] && C.gearMaterial) mats['hero-wrap'] = C.gearMaterial('bandage');
    function wrap(from, to, t0, t1, pad, th, flare) {
      try {
        if (!A.index || A.index[from] === undefined || A.index[to] === undefined) return;
        var q = C.sleeve(A, from, to, t0, t1, pad, th, ['skin'], flare || 0, { u: 22, v: 9 });
        G.uvScale(q.geometry, 1.4, 2.2);
        // spiral bands: the cloth is wound, not a tube (cavity grooves between the turns, blood soaked toward the hand)
        G.wear(q.geometry, { edge: 0, border: .25, cavity: .03, curv: .004, paint: function (p) { return .15; } });
        A.transfer('hero-wrap', q.geometry, ['skin'], { bones: [from, to] });
      } catch (e) { if (window.console) console.warn('hero wrap ' + from + ': ' + (e && e.message)); }
    }
    // upper arms: a wound cloth band around each biceps (the forearms and shins already carry leather bracers and boots)
    wrap('upper_armL', 'forearmL', .52, .8, .007, .008, .004);
    wrap('upper_armR', 'forearmR', .58, .86, .007, .008, .004);
    if (!C.gearMaterial) return;
    mats['hero-trinket-cord'] = C.gearMaterial('strap'); mats['hero-trinket-fang'] = C.gearMaterial('bone'); mats['hero-trinket-iron'] = C.gearMaterial('dark');
    // neck cord: round the base of the neck over the traps, a V down the chest to a wolf fang flanked by two teeth and an iron ring
    try {
      var nk = A.P('neck'), s3 = A.P('spine03'), TORSO = ['spine03', 'spine02', 'neck', 'shoulderL', 'shoulderR'];
      function surfAt(x, y, zDir, lift) { var q = A.nearest(V(x, y, nk.z + zDir * .6), ['skin']); if (!q) return V(x, y, nk.z); return V(q.x + q.nx * lift, q.y + q.ny * lift, q.z + q.nz * lift); }
      var y0 = nk.y - .015, py = s3.y - .035, pts = [];
      [[0, y0 + .005, -1], [.05, y0, -1], [.075, y0 - .02, 0], [.06, y0 - .05, 1], [.03, py + .04, 1], [0, py, 1]].forEach(function (q) { pts.push(surfAt(q[0], q[1], q[2], .008)); });
      var cordPts = pts.slice().concat(pts.slice(0, -1).reverse().map(function (p) { return V(-p.x, p.y, p.z); }));
      cordPts.pop(); cordPts.push(cordPts[0].clone());
      A.transfer('hero-trinket-cord', G.tube(cordPts, .0034, 5, 90, false), ['skin'], { bones: TORSO });
      var c0 = pts[pts.length - 1], down = V(0, -1, .12).normalize(), fang = [], iron = [];
      // iron ring the fang hangs from
      var ring = []; for (var i = 0; i <= 16; i++) { var a = i / 16 * Math.PI * 2; ring.push(V(c0.x + Math.cos(a) * .011, c0.y - .012 + Math.sin(a) * .011, c0.z + .004)); }
      iron.push(G.tube(ring, .0028, 5, 32, false));
      var tip = c0.clone().addScaledVector(down, .085); tip.z += .012; tip.x += .006;
      fang.push(G.spike(.0115, c0.clone().add(V(0, -.022, .006)), tip, 7));
      [-1, 1].forEach(function (sd) { fang.push(G.spike(.006, c0.clone().add(V(sd * .019, -.008, .004)), c0.clone().add(V(sd * .03, -.045, .012)), 6)); });
      A.transfer('hero-trinket-fang', G.merge(fang), ['skin'], { bones: TORSO, pin: true });
      // belt plate: a forged iron plate with a raised boss and corner nails at the front of the belt
      var belt = A.nearest(V(0, 1.04, .6), ['leather', 'base-straps', 'skin']);
      if (belt) {
        var bp = V(belt.x, belt.y, belt.z + .012), plate = G.box(.085, .065, .012, [0, 0, 0]); plate.translate(bp.x, bp.y, bp.z);
        iron.push(plate, G.sphere(.019, [bp.x, bp.y, bp.z + .006], [1, 1, .55], 12, 8));
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) { iron.push(G.stud(.0055, [bp.x + c[0] * .033, bp.y + c[1] * .023, bp.z + .006], [0, 0, 1], .8)); });
        for (var k = 0; k < 6; k++) { var aa = k / 6 * Math.PI * 2; iron.push(G.spike(.004, [bp.x + Math.cos(aa) * .016, bp.y + Math.sin(aa) * .016, bp.z + .012], [bp.x + Math.cos(aa) * .027, bp.y + Math.sin(aa) * .027, bp.z + .016], 4)); }
      }
      var ironG = G.merge(iron); G.wear(ironG, { edge: .8 });
      A.transfer('hero-trinket-iron', ironG, ['skin', 'leather'], { bones: ['pelvis', 'spine01', 'spine02', 'spine03', 'neck'] });
    } catch (e) { if (window.console) console.warn('hero trinkets: ' + (e && e.message)); }
  }
  // Closed chest armour hides the cord, fang and buckle (they would poke through plates).
  function trinketsVisible(chestModel) { return !chestModel || /^(torn-chest|rib-chest)$/.test(chestModel); }
  B.HeroDetail = { apply: apply, build: build, skinFx: skinFx, trinketsVisible: trinketsVisible };
}());
