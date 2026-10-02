/* KABİR AZABI — IV: Kızıl Ocak. Fourteen rooms of charcoal-black iron under the king's court: blind bellows, coal convicts, hot transport, the ash vizier's court,
   a dying foundry, iron prayers, chain wells, swallowed gears, slag, red furnaces, the oath of embers, the last casting and the furnace heart.
   Glow is emissive geometry, animated lava and shader sprites (bloom does the rest); there is no extra light. */
(function () {
  'use strict';
  var B = window.BABA, PI = Math.PI, T = window.THREE;
  var COAL = [.46, .43, .42], IRONT = [.62, .6, .6], SOOT = [.36, .34, .34], STONE = [.78, .72, .68], WARMI = [.7, .56, .46], ASHG = [.7, .68, .66], FIRE = [1.6, .62, .16], HOT = [2.2, 1.1, .4];

  var moodBase = { fog: '#120e0c', fogDensity: .012, mist: '#21150e', mistA: .12, mistH: .7, mistGlow: .6, scatter: .7, wind: [.025, -.015], sky: '#b9a68e', ground: '#302a26', hemi: .85, env: .28, key: '#e0c1a1', keyI: 1.6, keyDir: [-12, 24, -8],
    rim: '#b86539', rimI: 1.2, charRim: '#e4cbb4', charRimI: 1.3, rimDir: [.4, .6, -1], rimWrap: 1, charFill: .23, lift: [.004, .003, .002], gain: [1.06, 1.01, .93], sat: .84, contrast: .21, shadowTint: [1.0, .96, .96], highTint: [1.1, 1.02, .88],
    vignette: .5, vigColor: [.01, .004, .002], bloom: .46, bloomTint: [1.04, 1, .94], exposure: 1.25 };
  var moodSpecs = [
    { key: '#b4b4c4', keyI: 1.55, sky: '#a09a98', fog: '#0e0c0c', mist: '#1a1412', mistA: .13, gain: [1, 1, .98], sat: .78, rim: '#a06040' },
    { key: '#e0b890', keyI: 1.5, fog: '#130d0a', mist: '#2a170e', mistA: .16, gain: [1.08, 1, .9], bloom: .44, sat: .86 },
    { key: '#c8b098', keyI: 1.4, fog: '#100c0a', mist: '#241810', mistA: .23, gain: [1.04, 1, .92], sat: .76, bloom: .42 },
    { key: '#f0b880', keyI: 1.55, fog: '#150c08', mist: '#301a0c', mistA: .17, bloom: .46, gain: [1.1, 1, .9], sat: .9 },
    { key: '#caaea6', keyI: 1.45, fog: '#13100f', mist: '#262020', mistA: .24, sat: .74, rim: '#b05a40', gain: [1.05, .99, .94], bloom: .44 },
    { key: '#b8b0a8', keyI: 1.4, hemi: .92, fog: '#121110', mist: '#2a2724', mistA: .27, sat: .62, bloom: .36, gain: [1.0, 1, .98], rim: '#907060' },
    { key: '#e8b888', keyI: 1.5, sky: '#b89c80', fog: '#140d09', mist: '#2c190d', mistA: .16, sat: .9, bloom: .54, gain: [1.1, 1, .88] },
    { key: '#a89488', keyI: 1.35, fog: '#0e0a0a', mist: '#2a140c', mistA: .19, mistGlow: .5, bloom: .46, gain: [1.08, .99, .9], sat: .84 },
    { key: '#d0b090', keyI: 1.5, fog: '#110d0b', mist: '#241a12', mistA: .18, sat: .8, bloom: .46, gain: [1.07, 1, .92] },
    { key: '#d8c890', keyI: 1.5, sky: '#b8a878', fog: '#141008', mist: '#34280e', mistA: .28, gain: [1.08, 1.04, .84], sat: .86, bloom: .5, rim: '#c09040' },
    { key: '#f0a070', keyI: 1.6, fog: '#160a06', mist: '#38160a', mistA: .2, mistGlow: .5, gain: [1.12, .98, .86], bloom: .5, sat: .95, vignette: .52, rim: '#e07038' },
    { key: '#f0c890', keyI: 1.65, hemi: 1.0, sky: '#c8aa84', fog: '#14100a', mist: '#30200f', mistA: .15, mistGlow: .6, bloom: .5, exposure: 1.3, vignette: .42, sat: .98, gain: [1.1, 1.02, .88], rim: '#e0a050' },
    { key: '#f4b078', keyI: 1.6, fog: '#160a06', mist: '#3a1a0a', mistA: .2, bloom: .5, gain: [1.12, .98, .84], sat: .94, rim: '#e07038' },
    { key: '#ffc890', keyI: 1.75, sky: '#c8a888', fog: '#180a06', mist: '#3c1c0c', mistA: .2, mistGlow: .6, bloom: .56, gain: [1.14, 1, .84], contrast: .26, vignette: .56, exposure: 1.3, shadowTint: [1.0, .9, .9], highTint: [1.18, 1.04, .82], rim: '#f08040', charRim: '#f4d4b0', sat: 1.0 }
  ];

  /* Round 6: one-off setup per world (shapes + a calmer, plate-and-seam lava shader). Everything is built at load; nothing at run time. */
  var LAVA_FRAG = [
    'varying vec3 vP;varying vec3 vE;varying vec2 vUv;uniform float clock;uniform sampler2D norm;uniform sampler2D grain;',
    'void main(){',
    ' vec2 p=vP.xz;vec2 fl=vec2(0.,-clock*.08);',
    ' vec3 a=texture2D(norm,p*.11+fl*.4).rgb;',
    ' vec3 b=texture2D(norm,p*.23-fl*.6+(a.rg-.5)*.7).rgb;',
    ' vec3 c=texture2D(norm,p*.47+fl*.9+(b.rg-.5)*.5).rgb;',
    ' float f=.5+(a.r-.5)*2.4+(b.g-.5)*1.5+(c.r-.5)*.6;',
    ' float crust=smoothstep(.5,.62,f);',
    ' vec2 e=min(vUv,1.-vUv)*vE.xy*2.;float bank=1.-smoothstep(0.,.45,min(e.x,e.y));',
    ' crust=clamp(crust+bank*.85,0.,1.);',
    ' float pulse=.55+.45*sin(clock*1.2+p.y*.7+a.g*7.);',
    ' vec3 molten=mix(vec3(.46,.065,.01),vec3(.86,.28,.05),pulse*.55+c.g*.45);',
    ' float seam=smoothstep(0.,.1,crust)*(1.-smoothstep(.1,.35,crust));',
    ' vec3 crustCol=vec3(.03,.017,.013)+vec3(.20,.045,.008)*smoothstep(.85,.4,crust);',
    ' vec3 col=mix(molten,crustCol,smoothstep(.2,.7,crust));',
    ' col+=vec3(.7,.2,.03)*seam*.4;',
    ' gl_FragColor=vec4(col,1.);}'].join('\n');
  function setupOnce(K) {
    if (K.forgeSetup) return; K.forgeSetup = true;
    var m = K.materials && K.materials.lava; if (m && m.isShaderMaterial) { m.fragmentShader = LAVA_FRAG; m.needsUpdate = true; }
    // One mesh per material and room: small low props no longer split into a second, non-casting bucket (fewer draw calls in the main and the shadow pass).
    var putM = K.putM, MERGE = { iron: 1, rock: 1, stone: 1, wood: 1, wall: 1, slag: 1 };
    K.putM = function (id, kind, key, m, tint, ao, aoH, cast) { return putM.call(K, id, kind, key, m, tint, ao, aoH, cast == null && MERGE[key] ? true : cast); };
        var tr = new T.Shape(); tr.moveTo(-.5, -.5); tr.lineTo(.5, -.5); tr.lineTo(.36, .5); tr.lineTo(-.36, .5); tr.closePath();
    var ing = new T.ExtrudeGeometry(tr, { depth: 1, bevelEnabled: false }); ing.translate(0, 0, -.5); K.addShape('ingot', ing);   // tapered ingot / chute section
    K.addShape('barrel', new T.CylinderGeometry(.5, .44, 1, 10, 1));
    K.addShape('pebble', new T.IcosahedronGeometry(.5, 0));                                    // 20-triangle lump for litter / pebble skirts
    K.addShape('hemi', new T.SphereGeometry(.5, 12, 5, 0, PI * 2, 0, PI / 2));
    // chains: elongated interlocking links (the old 3-segment rings read as "0-0-0" from above)
    K.chain = function (id, x, y, z, len, tint) {
      var n = Math.floor(len / .22); for (var k = 0; k < n; k++) K.put(id, 'box', 'iron', x, y - k * .22, z, k % 2 ? .05 : .13, .27, k % 2 ? .13 : .05, 0, 0, 0, tint || [.8, .74, .7], .2);   // alternating flat links (12 triangles each)
    };
  }

  function dress(K, r, i, info) {
    setupOnce(K);
    var S = K.SPR, R = K.rng(i, 5);
    function X(x) { return r.x + x; } function Z(z) { return r.z + z; }
    function mulT(a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
    function embers(n, x0, x1, z0, z1, rise, bright) { for (var k = 0; k < n; k++) K.spr(i, S.ember, X(x0 + R() * (x1 - x0)), .3, Z(z0 + R() * (z1 - z0)), .05, .05, [2 * (bright || 1), .8 * (bright || 1), .22], 1, R(), .12 + R() * .18, rise || 5); }
    function smoke(n, col, a, h, size, rise) { for (var k = 0; k < n; k++) K.spr(i, S.smoke, X((R() - .5) * (r.w - 4)), h || .5, Z((R() - .5) * (r.d - 4)), (size || 3) * .92, (size || 3) * .92, col, a, R(), .05 + R() * .05, rise || 4); }   // (a touch smaller: less overdraw)
    function decals(o) {
      var k;
      for (k = 0; k < (o.cracks || 0); k++) K.dec(i, 0, X((R() - .5) * (r.w - 4)), Z((R() - .5) * (r.d - 4)), 3.5 + R() * 2.5, 3.5 + R() * 2.5, R() * 6.28, [1, 1, 1], .9);
      for (k = 0; k < (o.soot || 0); k++) { var sx = X((R() - .5) * (r.w - 2)), sz = Z((R() - .5) * (r.d - 2)), sw = 4 + R() * 4, sdp = 4 + R() * 4, sr = R() * 6.28; if (k % 3 !== 2) K.dec(i, 3, sx, sz, sw, sdp, sr, [1, 1, 1], .85); }   // every 3rd soot blotch dropped: large alpha-blended quads were the main overdraw of the floor
      for (k = 0; k < (o.chips || 0); k++) K.dec(i, 13, X((R() - .5) * (r.w - 4)), Z((R() - .5) * (r.d - 4)), 3 + R() * 2.5, 3 + R() * 2.5, R() * 6.28, [1, 1, 1], .95);
      for (k = 0; k < (o.plates || 0); k++) K.dec(i, 8, X((R() - .5) * (r.w - 6)), Z((R() - .5) * (r.d - 6)), 2.4, 2.4, Math.floor(R() * 4) * PI / 2, [.9, .88, .86], .96);
      for (k = 0; k < (o.grates || 0); k++) { var gx = X((R() - .5) * (r.w - 8)), gz = Z((R() - .5) * (r.d - 8)); K.dec(i, 7, gx, gz, 2.4, 2.4, Math.floor(R() * 4) * PI / 2, [1, 1, 1], .96); K.dec(i, 14, gx, gz, 3.2, 3.2, 0, [1.1, .4, .08], .5, 'glow'); K.spr(i, S.smoke, gx, .15, gz, 1.0, 1.0, [.62, .58, .54], .34, R(), .13 + R() * .05, 3.2); K.spr(i, S.smoke, gx + .2, .15, gz - .2, .8, .8, [.62, .58, .54], .3, R(), .11 + R() * .05, 3.6); }
      for (k = 0; k < (o.heat || 0); k++) K.dec(i, 15, X((R() - .5) * (r.w - 4)), Z((R() - .5) * (r.d - 4)), 5 + R() * 3, 5 + R() * 3, R() * 6.28, [.3, .085, .017], .3, 'glow');
      for (k = 0; k < (o.blood || 0); k++) K.dec(i, 2, X((R() - .5) * (r.w - 6)), Z((R() - .5) * (r.d - 6)), 2.5 + R() * 2, 2.5 + R() * 2, R() * 6.28, [1, 1, 1], .9, 'wet');
      for (k = 0; k < (o.puddles || 0); k++) K.dec(i, 9, X((R() - .5) * (r.w - 6)), Z((R() - .5) * (r.d - 6)), 3 + R() * 2.5, 3 + R() * 2.5, R() * 6.28, [1, 1, 1], .92, 'wet');
      for (k = 0; k < (o.rubble || 0); k++) K.dec(i, 4, X((R() - .5) * (r.w - 4)), Z((R() - .5) * (r.d - 4)), 2.5 + R() * 2.5, 2.5 + R() * 2.5, R() * 6.28, [.55, .5, .48], .95);
      if (o.wear) K.dec(i, 10, X(0), Z(0), 5, r.d - 1, 0, o.wear, .8);
    }
    // Lava sits 4 cm above the highest floor slab (slab tops are +.011..+.045): at +.025 the slabs z-fought / poked through it (speckled, flickering channel).
    function lavaPanel(x, z, w, d, cast) { K.put(i, 'panel', 'lava', x, .085, z, w, 1, d, 0, 0, 0, [w / 2, d / 2, 0], 0); }
    // side walls, wall furnaces, collision pillars with girders, gutters of molten metal
    function shell(o) {
      o = o || {}; var wt = o.wallTint || SOOT, gl = o.glow == null ? 1 : o.glow;
      if (o.arenaLights !== false) { K.light(i, X(-6.4), 2.8, Z(2.5), 0xff8038, 18 + 14 * gl, 13, { glow: 1, scatter: .2, flicker: .18 }); K.light(i, X(6.4), 2.8, Z(-3.5), 0xff8038, 18 + 14 * gl, 13, { glow: 1, scatter: .2, flicker: .18 }); }
      [-1, 1].forEach(function (s) {
        K.wall(i, X(s * (r.w / 2 + .45)), Z(0), r.d + .2, .9, 6.8, false, -s, 0, { tint: wt, ruin: o.ruin || 0, niche: false, pil: 5.4, plinthKey: 'iron' });
        for (var n = 0; n < 4; n++) {
          var z = (n - 1.5) * 5.2, h = o.colH || 5.4;
          K.put(i, 'box', 'iron', X(s * 8.3), .25, Z(z), 1.5, .5, 1.5, 0, 0, 0, IRONT, .5); K.put(i, 'box', 'iron', X(s * 8.3), 2.8, Z(z), .8, 5.1, .8, 0, 0, 0, IRONT, .55, 3);
          for (var b = 0; b < 3; b++) K.put(i, 'box', 'iron', X(s * 8.3), 1.1 + b * 1.7, Z(z), 1.0, .2, 1.0, 0, 0, 0, [.8, .74, .7], .3);
          K.put(i, 'box', 'iron', X(s * 8.3), 5.45, Z(z), 1.5, .4, 1.5, 0, 0, 0, IRONT, .2);
          if (!o.noMouths && n % 2 === 0) mouth(s * 13.6, z + 2.6, s, gl);
        }
        K.put(i, 'box', 'iron', X(s * 8.3), 5.7, Z(0), .5, .42, 15.4, 0, 0, 0, IRONT, .2, 4);
        K.bar(i, 'box', 'iron', X(s * 8.3), 5.5, Z(-7.6), X(s * 8.3), 4.2, Z(-5.3), .16, IRONT, .1); K.bar(i, 'box', 'iron', X(s * 8.3), 5.5, Z(7.6), X(s * 8.3), 4.2, Z(5.3), .16, IRONT, .1);
        if (o.gutter !== 'none') {
          var gx = s * 11;
          if (o.gutter === 'slag') { K.dec(i, 15, X(gx), Z(0), 2.6, r.d - 2, 0, [1.1, .34, .06], .75, 'glow'); }
          else lavaPanel(X(gx), Z(0), 2.3, r.d - 3);
          [-1, 1].forEach(function (sd) { K.put(i, 'box', 'iron', X(gx + sd * 1.25), .22, Z(0), .22, .44, r.d - 3, 0, 0, 0, [.7, .66, .64], .3); });
          if (o.gutter !== 'slag') for (var q = 0; q < 3; q++) K.spr(i, S.pool, X(gx), .2, Z((q - 1) * 6.5), 5.2, 5.2, [.9 * gl, .3 * gl, .06 * gl], .5, R(), 1, 1);
          for (var q = 0; q < 8; q++) K.spr(i, S.ember, X(gx + (R() - .5) * 1.6), .2, Z((R() - .5) * (r.d - 4)), .05, .05, [2, .8, .22], 1, R(), .15 + R() * .15, 4.5);
          if (o.gutter !== 'slag') K.solid(X(gx), Z(0), 1.6, r.d - 3);   // you can no longer wade through the molten channel (the hero stops at the curb; the aisles beside it stay open)
        }
        if (o.arches !== false) archX(s, -8.3, 1.5, o);
      });
    }
    function mouth(rx, rz, s, gl) {
      var x = X(rx), z = Z(rz);
      K.put(i, 'box', 'iron', x - s * .075, 1.5, z, .95, 3.0, 2.4, 0, 0, 0, SOOT, .5); K.put(i, 'box', 'hot', x - s * .57, 1.15, z, .08, 1.15, 1.25, 0, 0, 0, [1.7 * gl, .62 * gl, .18 * gl], 0);   // (box was 35 cm short of the wall, slab and bars floated 3 cm off it)
      for (var b = 0; b < 4; b++) K.put(i, 'box', 'iron', x - s * .62, 1.15, z + (b - 1.5) * .3, .08, 1.35, .07, 0, 0, 0, [.5, .46, .44], 0);
      K.spr(i, S.glow, x - s * 1.0, 1.15, z, 1.5, 1.5, [.8 * gl, .28 * gl, .06 * gl], .8, R(), 1, 1); K.spr(i, S.pool, x - s * 2.4, .12, z, 5.4, 5.4, [.9 * gl, .3 * gl, .06 * gl], .5, R(), 1, 1);
      K.spr(i, S.flame, x - s * .75, .5 + .55, z, .5, .55, [1.3 * gl, .45 * gl, .1 * gl], .9, R(), 1.2, 1);
      if (gl > .6) K.heat(x - s * .8, 1.2, z, 1.2, 1.4, .6);
    }
    function north(o) {
      o = o || {}; var zf = r.z - r.d / 2 - .75, h = o.h || 6.6, tint = o.tint || SOOT;
      var lx0 = r.x - r.w / 2 - .9, lx1 = -3.9, rx0 = 3.9, rx1 = r.x + r.w / 2 + .9;
      K.wall(i, (lx0 + lx1) / 2, zf, lx1 - lx0, 1.3, h, true, 0, 1, { tint: tint, pil: 4.6, plinthKey: 'iron' }); K.wall(i, (rx0 + rx1) / 2, zf, rx1 - rx0, 1.3, h, true, 0, 1, { tint: tint, pil: 4.6, plinthKey: 'iron' });
      if (o.noGate) return;
      [-1, 1].forEach(function (s) {
        K.put(i, 'box', 'iron', s * 4.55, 3.2, zf + .35, 1.4, 6.4, 1.7, 0, 0, 0, IRONT, .55, 3.5); for (var b = 0; b < 4; b++) K.put(i, 'box', 'iron', s * 4.55, 1.0 + b * 1.6, zf + .35, 1.65, .2, 1.95, 0, 0, 0, [.8, .74, .7], .2);
      });
      K.put(i, 'box', 'iron', 0, 6.5, zf + .35, 10, .8, 1.9, 0, 0, 0, IRONT, .2); K.put(i, 'box', 'iron', 0, 5.85, zf + .35, 7.4, .5, 1.6, 0, 0, 0, SOOT, .1);   // (was 7 cm below the lintel)
      for (var q = -3; q <= 3; q++) { K.put(i, 'cyl6', 'iron', q * 1.0, 5.1, zf + .35, .16, 1.1, .16, 0, 0, 0, [.5, .46, .44], 0); K.put(i, 'cone4', 'iron', q * 1.0, 4.32, zf + .35, .24, .5, .24, 0, 0, PI, [.56, .52, .5], 0); }   // raised portcullis
      K.put(i, 'box', 'iron', 0, 5.3, zf + .35, 7.2, .1, .14, 0, 0, 0, [.5, .46, .44], 0); K.put(i, 'box', 'iron', 0, 4.7, zf + .35, 7.2, .08, .12, 0, 0, 0, [.5, .46, .44], 0);
      K.put(i, 'box', 'wall', 0, 7.05, zf + .35, 1.1, .7, 1.4, 0, 0, 0, [.5, .46, .44], .2);
      if (o.vent) { K.put(i, 'box', 'hot', 0, 6.25, zf + 1.25, 5.8, .2, .06, 0, 0, 0, [2.0, .7, .18], 0); K.spr(i, S.glow, 0, 6.1, zf + 1.4, 4.2, .8, [.9, .3, .06], .8, 0, 1, 1); }
    }
    // props
    function anvil(x, z, rot, sc) {
      sc = sc || 1; var c = Math.cos(rot), sn = Math.sin(rot);
      function P(kind, lx, y, lz, w, h, d) { K.put(i, kind, 'iron', x + (lx * c + lz * sn) * sc, y * sc, z + (-lx * sn + lz * c) * sc, w * sc, h * sc, d * sc, rot, 0, 0, IRONT, .5); }
      P('box', 0, .22, 0, 1.0, .44, .7); P('box', 0, .62, 0, .56, .4, .4); P('box', 0, .98, 0, 1.15, .32, .52);
      // the horn (was a stray upright spike next to a 45-degree-skewed horn): one cone lying along the anvil's long axis
      K.put(i, 'cone4', 'iron', x + (c * 1.3) * sc, .98 * sc, z - (sn * 1.3) * sc, .34 * sc, .9 * sc, .34 * sc, rot, 0, -PI / 2, IRONT, .3);
      P('box', -.62, .98, 0, .22, .3, .5);
    }
    function ironStatue(x, z, rot, pose, sc) { K.put(i, 'box', 'iron', x, .3, z, 1.8, .6, 1.8, 0, 0, 0, SOOT, .5); K.statue(i, x, z, rot, { key: 'iron', tint: [.55, .5, .48], pose: pose, s: sc || .9 }); }
    function cage(x, z, h) { K.chain(i, x, 6.4, z, 6.4 - h - 1.4, [.5, .46, .44]); K.put(i, 'box', 'iron', x, h + 1.45, z, 1.5, .12, 1.5, 0, 0, 0, IRONT, .1); K.put(i, 'box', 'iron', x, h, z, 1.5, .12, 1.5, 0, 0, 0, IRONT, .1); for (var b = 0; b < 8; b++) { var a = b / 8 * 6.28; K.put(i, 'cyl6', 'iron', x + Math.cos(a) * .68, h + .72, z + Math.sin(a) * .68, .06, 1.4, .06, 0, 0, 0, [.55, .5, .48], 0); } K.put(i, 'urn', 'iron', x, h + .3, z, .5, .4, .4, 0, 0, 0, [.7, .55, .5], 0); }
    function cart(x, z, rot, loaded) {
      var c = Math.cos(rot), sn = Math.sin(rot); K.solid(x, z, 1.8, 2.6);
      K.put(i, 'box', 'iron', x, .85, z, 1.5, .85, 2.3, rot, 0, 0, IRONT, .5);
      [[-.8, 0, .12, 2.5], [.8, 0, .12, 2.5], [0, -1.2, 1.7, .12], [0, 1.2, 1.7, .12]].forEach(function (q) { K.put(i, 'box', 'iron', x + q[0] * c + q[1] * sn, 1.42, z - q[0] * sn + q[1] * c, q[2], .3, q[3], rot, 0, 0, [.7, .66, .62], .2); });   // rim of an open bin
      [[-.7, -.8], [.7, -.8], [-.7, .8], [.7, .8]].forEach(function (w) { K.put(i, 'cyl', 'iron', x + w[0] * c + w[1] * sn, .32, z - w[0] * sn + w[1] * c, .55, .18, .55, rot, 0, PI / 2, [.5, .46, .44], .3); });
      if (!loaded) K.put(i, 'box', 'rock', x, 1.3, z, 1.4, .1, 2.2, rot, 0, 0, [.2, .19, .18], 0);   // coal fill
      if (loaded) { K.put(i, 'box', 'hot', x, 1.3, z, 1.5, .05, 2.3, rot, 0, 0, [1.35, .52, .13], 0); K.spr(i, S.glow, x, 1.55, z, 1.5, 1.5, [1.0, .36, .08], .65, R(), 1, 1); K.spr(i, S.smoke, x, 1.5, z, .8, .8, [.45, .3, .24], .25, R(), .15, 2); }
    }
    function slagHeap(x, z, rad, glow) {
      if (rad >= 1.0) K.solid(x, z, rad * 1.5, rad * 1.5);
      for (var k = 0; k < 11; k++) {
        var a = R() * 6.28, d = Math.sqrt(R()) * rad, s = .6 + R() * .9, hot = k % 3 === 0 && glow, f = hot ? .5 : 1;   // the glowing chunks used to be 1.4 m "eggs"
        K.put(i, 'rock', hot ? 'slag' : 'rock', x + Math.cos(a) * d, s * (hot ? .16 : .3), z + Math.sin(a) * d, s * 1.4 * f, s * (.6 + R() * .7) * f, s * 1.3 * f, R() * 6, 0, 0, hot ? [.55, .42, .36] : [.3, .27, .26], .6);
      }
      K.put(i, 'crag', 'rock', x, rad * .3, z, rad * 1.6, rad * .8, rad * 1.6, R() * 6, 0, 0, [.28, .26, .25], .5);
      var RS = K.rng(i, 70 + Math.round(x * 7 + z * 3));
      for (k = 0; k < 7; k++) { var a2 = RS() * 6.28, d2 = rad * (.7 + RS() * .9), s2 = .22 + RS() * .3; K.put(i, 'pebble', 'rock', x + Math.cos(a2) * d2, s2 * .2, z + Math.sin(a2) * d2, s2 * 1.3, s2 * .8, s2, RS() * 6, 0, 0, [.3, .27, .26], .6); }
      if (glow) { for (k = 0; k < 3; k++) { var a3 = RS() * 6.28, d3 = rad * RS() * .6; K.put(i, 'rock', 'slag', x + Math.cos(a3) * d3, rad * .55, z + Math.sin(a3) * d3, .45, .3, .4, RS() * 6, 0, 0, [.7, .5, .4], .3); }
        K.spr(i, S.pool, x, .14, z, rad * 4, rad * 4, [.9, .28, .05], .55, R(), 1, 1); K.dec(i, 15, x, z, rad * 2.4, rad * 2.4, R() * 6, [1.2, .36, .06], .8, 'glow', .6); }
    }
    function pipe(x1, y1, z1, x2, y2, z2, rad) { K.bar(i, 'cyl', 'iron', x1, y1, z1, x2, y2, z2, rad, [.58, .55, .53], .3); K.put(i, 'cyl', 'iron', x1, y1, z1, rad * 2.6, .25, rad * 2.6, 0, 0, 0, [.7, .66, .62], .2); K.put(i, 'cyl', 'iron', x2, y2, z2, rad * 2.6, .25, rad * 2.6, 0, 0, 0, [.7, .66, .62], .2); }
    function brazierF(x, z, s, intensity) { K.brazier(i, x, z, { s: s || 1, col: FIRE, lightColor: 0xff8a3c, intensity: 32 }); }
    /* ───────────── Round 6 dressing: heavy iron, catwalks, arches, troughs ─────────────
       Everything below is baked into the room's merged meshes (no new draw calls beyond the existing material buckets) and draws from its own
       random stream R2, so the original decoration sequence R of each room is untouched. Coordinates here are RELATIVE to the room centre. */
    var R2 = K.rng(i, 9);
    function BX(kind, key, x, y, z, w, h, d, a, tint, ao, rx, rz) { K.put(i, kind, key, X(x), y, Z(z), w, h, d, a || 0, rx || 0, rz || 0, tint, ao); }
    function HOT(x, y, z, w, h, d, col, a) { K.put(i, 'box', 'hot', X(x), y, Z(z), w, h, d, a || 0, 0, 0, col || [1.5, .6, .16], 0); }
    function SP(kind, x, y, z, w, h, col, al, spd, ex) { K.spr(i, kind, X(x), y, Z(z), w, h, col, al, R2(), spd, ex); }
    function BAR(x1, y1, z1, x2, y2, z2, rad, tint, key) { K.bar(i, 'cyl', key || 'iron', X(x1), y1, Z(z1), X(x2), y2, Z(z2), rad, tint || [.58, .55, .53], .3); }
    // a prop frame: P(kind, key, localX, y, localZ, w, h, d, tint, ao, rx, rz) placed at (x,z) rotated by yaw and scaled by s
    function frame(x, z, yaw, s) {
      var c = Math.cos(yaw), sn = Math.sin(yaw); s = s || 1;
      return function (kind, key, lx, y, lz, w, h, d, tint, ao, rx, rz) { K.put(i, kind, key, X(x + (lx * c + lz * sn) * s), y * s, Z(z + (-lx * sn + lz * c) * s), w * s, h * s, d * s, yaw, rx || 0, rz || 0, tint, ao); };
    }
    // blind arch recessed into the side wall (plane x = const), faces the room; `glow` puts a barred furnace window behind it
    function archX(s, z, rad, o) {
      var AR = K.rng(i, 40 + Math.round(z * 3 + 30)), n = 11, spring = 2.3, x = X(s * 13.86), t = (o && o.archTint) || [.46, .42, .4], k, a, b, cr = rad + .35;
      for (k = 0; k < n; k++) { a = (k + .5) * PI / n; b = .86 + AR() * .22; K.put(i, 'block', 'wall', x, spring + Math.sin(a) * cr, Z(z - Math.cos(a) * cr), .8, .62, .55, PI / 2, 0, a - PI / 2, [t[0] * b, t[1] * b, t[2] * b], .3); }
      K.put(i, 'block', 'wall', x, spring + cr + .3, Z(z), .95, .7, .62, PI / 2, 0, 0, [t[0] * 1.08, t[1] * 1.08, t[2] * 1.08], .2);
      for (k = -1; k <= 1; k += 2) K.put(i, 'box', 'wall', x, spring / 2, Z(z + k * cr), .55, spring, .8, 0, 0, 0, [t[0] * (.92 + AR() * .1), t[1] * .95, t[2] * .95], .3);
      K.put(i, 'box', 'wall', X(s * 13.94), spring / 2, Z(z), .1, spring, 2 * rad, 0, 0, 0, [.05, .045, .045], 0);
      K.put(i, 'disc', 'wall', X(s * 13.94), spring, Z(z), 2 * rad, 1, 2 * rad, 0, 0, -s * PI / 2, [.05, .045, .045], 0);
      if (o && (o.glow == null ? 1 : o.glow) >= .85 && z < 0) {   // the arch at the north end of the wall is a barred furnace window
        K.put(i, 'disc', 'hot', X(s * 13.9), spring, Z(z), 2 * rad - .3, 1, 2 * rad - .3, 0, 0, -s * PI / 2, [1.35, .5, .13], 0);
        K.put(i, 'box', 'hot', X(s * 13.9), spring / 2 - .1, Z(z), .06, spring - .2, 2 * rad - .3, 0, 0, 0, [1.35, .5, .13], 0);
        for (k = -2; k <= 2; k++) K.put(i, 'cyl6', 'iron', X(s * 13.84), spring + .35, Z(z + k * .55), .08, 2 * spring - .3 + 1.1, .08, 0, 0, 0, [.42, .38, .36], 0);
        K.put(i, 'box', 'iron', X(s * 13.84), spring + .35, Z(z), .1, .1, 2 * rad, 0, 0, 0, [.5, .46, .44], 0);
        K.spr(i, S.glow, X(s * 13.0), spring, Z(z), 1.6, 1.6, [.7, .26, .06], .6, R2(), 1, 1);
      }
    }
    // grated catwalk bolted to the side wall (cantilevered: nothing touches the floor), with a railing
    function catwalk(s, z0, z1, y, wd) {
      wd = wd || 1.2; var xc = s * 12.9, len = Math.abs(z1 - z0), zc = (z0 + z1) / 2, nb = Math.max(1, Math.round(len / 2.4)), xi = xc - s * wd / 2, q, z;
      BX('box', 'iron', xc, y, zc, wd, .1, len, 0, [.5, .48, .46], .2);
      BX('box', 'iron', xc - wd / 2, y - .12, zc, .12, .22, len, 0, IRONT, .2); BX('box', 'iron', xc + wd / 2, y - .12, zc, .12, .22, len, 0, IRONT, .2);
      for (q = 0; q <= nb; q++) { z = z0 + q * (z1 - z0) / nb; BX('box', 'iron', xc, y - .1, z, wd, .1, .14, 0, [.46, .43, .41], .2); BAR(s * 13.5, y - 1.7, z, s * 12.6, y - .14, z, .05, [.5, .47, .45]); }
      for (q = 0; q <= Math.round(len / 1.6); q++) { z = z0 + q * (z1 - z0) / Math.round(len / 1.6); BX('box', 'iron', xi, y + .55, z, .07, 1.1, .07, 0, [.5, .47, .45], .1); }
      BX('box', 'iron', xi, y + 1.1, zc, .09, .07, len, 0, IRONT, .1); BX('box', 'iron', xi, y + .6, zc, .05, .05, len, 0, [.5, .47, .45], .1);
    }
    function hook(x, y, z) { BX('box', 'iron', x, y - .18, z, .22, .3, .22, 0, [.46, .43, .41], .2); BX('urn', 'iron', x, y - .42, z, .3, .26, .3, 0, IRONT, .2); }
    function barrels(x, z, n, yaw) {
      var f = frame(x, z, yaw || 0, 1), k, lx, lz;
      for (k = 0; k < n; k++) { lx = (k % 2) * .95 - .45 * (n > 1 ? 1 : 0); lz = Math.floor(k / 2) * .95; f('barrel', 'iron', lx, .5, lz, .85, 1.0, .85, [.62 + R2() * .12, .42, .3], .5); f('barrel', 'iron', lx, .22, lz, .9, .07, .9, [.5, .47, .45], 0); f('barrel', 'iron', lx, .78, lz, .9, .07, .9, [.5, .47, .45], 0); }
      K.solid(X(x + .4), Z(z + (Math.ceil(n / 2) - 1) * .47), 2.0, Math.ceil(n / 2) * .95 + .2);
    }
    function crates(x, z, yaw, tall) {
      var f = frame(x, z, yaw || 0, 1);
      f('box', 'iron', 0, .5, 0, 1.2, 1.0, 1.2, [.62, .44, .32], .5); f('box', 'iron', 0, .5, 0, 1.26, .08, 1.26, [.5, .47, .45], 0); f('box', 'iron', 0, .12, 0, 1.26, .08, 1.26, [.5, .47, .45], 0);
      if (tall) { f('box', 'iron', .1, 1.5, .05, 1.0, 1.0, 1.0, [.56, .4, .3], .5, 0, .06); f('box', 'iron', .1, 1.5, .05, 1.06, .08, 1.06, [.5, .47, .45], 0); }
      K.solid(X(x), Z(z), 1.5, 1.5);
    }
    function ingots(x, z, yaw, rows, glow) {
      var f = frame(x, z, yaw, 1), k, q, key = glow ? 'hot' : 'iron', col = glow ? [1.5 + R2() * .3, .55, .14] : [.66, .62, .6];
      for (k = 0; k < rows; k++) for (q = 0; q < rows - k; q++) f('ingot', key, (q - (rows - k - 1) / 2) * .62, .17 + k * .3, 0, .56, .26, .9, glow ? col : [col[0] * (.9 + R2() * .2), col[1], col[2]], glow ? 0 : .4, 0, 0);
    }
    // trough of water (steaming) or molten slag
    function trough(x, z, len, yaw, slag) {
      var f = frame(x, z, yaw, 1), q;
      f('box', 'iron', 0, .3, 0, len, .6, 1.2, [.5, .47, .45], .5); f('box', 'iron', 0, .64, 0, len + .1, .08, 1.3, [.62, .58, .56], .2);
      for (q = -1; q <= 1; q += 2) f('box', 'iron', q * (len / 2 - .3), .12, 0, .22, .24, 1.4, [.46, .43, .41], .4);
      if (slag) f('box', 'hot', 0, .62, 0, len - .15, .04, .95, [1.6, .6, .15], 0);
      else { f('box', 'lamp', 0, .62, 0, len - .15, .04, .95, [.05, .07, .085], 0); SP(S.smoke, x, .75, z, 1.6, 1.4, [.62, .64, .66], .25, .12, 2.6); }
      K.solid(X(x), Z(z), Math.abs(Math.cos(yaw)) * len + Math.abs(Math.sin(yaw)) * 1.4, Math.abs(Math.sin(yaw)) * len + Math.abs(Math.cos(yaw)) * 1.4);
    }
    // winch with a rope drum, crank and a chain going down
    function winch(x, z, yaw, drop) {
      var f = frame(x, z, yaw, 1), q;
      for (q = -1; q <= 1; q += 2) { BAR(x + Math.cos(yaw) * q * 1.1 - Math.sin(yaw) * .8, 0, z - Math.sin(yaw) * q * 1.1 - Math.cos(yaw) * .8, x + Math.cos(yaw) * q * 1.1, 2.3, z - Math.sin(yaw) * q * 1.1, .07, IRONT); BAR(x + Math.cos(yaw) * q * 1.1 + Math.sin(yaw) * .8, 0, z - Math.sin(yaw) * q * 1.1 + Math.cos(yaw) * .8, x + Math.cos(yaw) * q * 1.1, 2.3, z - Math.sin(yaw) * q * 1.1, .07, IRONT); }
      f('cyl', 'iron', 0, 2.3, 0, .12, 2.7, .12, [.5, .47, .45], .2, 0, PI / 2);
      f('cyl', 'wood', 0, 2.3, 0, .8, 1.3, .8, [.6, .5, .44], .3, 0, PI / 2);
      for (q = -1; q <= 1; q += 2) f('cyl', 'iron', q * .7, 2.3, 0, 1.2, .1, 1.2, [.5, .47, .45], .2, 0, PI / 2);
      BAR(x + Math.cos(yaw) * 1.45, 2.3, z - Math.sin(yaw) * 1.45, x + Math.cos(yaw) * 1.45 + Math.sin(yaw) * .2, 2.3 + .55, z - Math.sin(yaw) * 1.45 + Math.cos(yaw) * .55, .04, IRONT);
      K.chain(i, X(x + Math.sin(yaw) * .42), 2.15, Z(z + Math.cos(yaw) * .42), drop || 1.6, [.58, .54, .52]); hook(x + Math.sin(yaw) * .42, 2.15 - (drop || 1.6), z + Math.cos(yaw) * .42);
      K.solid(X(x), Z(z), Math.abs(Math.sin(yaw)) > .7 ? 1.8 : 2.6, Math.abs(Math.sin(yaw)) > .7 ? 2.6 : 1.8);
    }
    // heavy trip hammer: frame, pivoting arm, head over an anvil block
    function hammer(x, z, yaw, s) {
      var P = frame(x, z, yaw, s || 1), q;
      P('box', 'iron', 0, .3, 0, 1.6, .6, 1.2, [.5, .47, .45], .5); P('box', 'iron', 0, .72, 0, .9, .26, .6, IRONT, .3);
      for (q = -1; q <= 1; q += 2) P('box', 'iron', q * .95, 1.7, -.5, .26, 3.4, .26, [.52, .49, .47], .5);
      P('box', 'iron', 0, 3.45, -.5, 2.2, .3, .3, IRONT, .2); P('box', 'iron', 0, 2.55, -.5, .2, .2, .9, [.5, .47, .45], .1);
      P('box', 'iron', .15, 2.75, -.1, .22, .22, 2.4, [.56, .52, .5], .2, .38, 0); P('box', 'iron', .15, 1.7, .72, .6, .6, .6, [.64, .6, .58], .3);
      P('box', 'iron', -.5, 1.9, -.6, .2, 1.3, .2, [.46, .43, .41], .1);
      K.solid(X(x), Z(z), (s || 1) * 2.8, (s || 1) * 2.4);
    }
    function crucible(x, z, s, glow, tilt) {
      var P = frame(x, z, 0, s);
      P('box', 'iron', 0, .12, 0, .9, .24, .9, [.5, .47, .45], .5); P('vat', 'iron', 0, .72, 0, 1.3, 1.1, 1.3, [.5, .46, .44], .3); P('rim', 'iron', 0, 1.2, 0, 1.34, 1.34, 1.34, [.6, .56, .54], .1, PI / 2);
      if (glow) { P('disc', 'hot', 0, 1.14, 0, 1.05, 1, 1.05, [1.5, .62, .16], 0); SP(S.glow, x, 1.7, z, 1.6 * s, 1.4 * s, [1.0, .38, .08], .8, 1, 1); }
      P('cyl', 'iron', .78, 1.2, 0, .06, .8, .06, [.55, .52, .5], .1, 0, PI / 2); P('cyl', 'iron', -.78, 1.2, 0, .06, .8, .06, [.55, .52, .5], .1, 0, PI / 2);
      K.solid(X(x), Z(z), 1.6 * s, 1.6 * s);
    }
    function valve(x, y, z, yaw, rad) { var P = frame(x, z, yaw, 1); P('rim', 'iron', 0, y, 0, rad * 2, rad * 2, rad * 2, [.7, .3, .2], .1); P('box', 'iron', 0, y, 0, rad * 1.9, .05, .05, [.6, .26, .18], 0); P('box', 'iron', 0, y, 0, .05, rad * 1.9, .05, [.6, .26, .18], 0); P('cyl', 'iron', 0, y, -.2, .08, .4, .08, [.5, .47, .45], 0, PI / 2); }
    function flywheel(x, y, z, yaw, rad) { var P = frame(x, z, yaw, 1); P('gear18', 'iron', 0, y, 0, rad * 2, rad * 2, .25, [.52, .48, .46], .2); P('cyl', 'iron', 0, y, 0, .3, .5, .3, IRONT, .1, PI / 2); }
    function bannerX(x, y, z, w, h, rot, tint) { K.banner(i, X(x), y, Z(z), w, h, rot, tint); }
    function ashDrift(x, z, w, d) { for (var q = 0; q < 5; q++) BX('rock', 'rock', x + (R2() - .5) * w, .12, z + (R2() - .5) * d, 1.6 + R2() * 1.6, .3 + R2() * .22, 1.2 + R2() * 1.2, R2() * 6, [.55, .53, .5], .5); }
    // low-lying hot-metal runner on the floor between two points (flat, above the slab tops)
    function runner(x1, z1, x2, z2, w) { var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz); K.put(i, 'box', 'hot', X((x1 + x2) / 2), .075, Z((z1 + z2) / 2), w, .03, len, Math.atan2(dx, dz), 0, 0, [1.25, .46, .11], 0); K.put(i, 'box', 'iron', X((x1 + x2) / 2), .06, Z((z1 + z2) / 2), w + .34, .06, len, Math.atan2(dx, dz), 0, 0, [.4, .38, .36], .2); }
    function censer(x, y, z, s) {   // hanging bowl of embers at the end of a chain
      var P = frame(x, z, 0, s || 1);
      P('vat', 'iron', 0, y, 0, .9, .6, .9, [.5, .46, .44], .2); P('rim', 'iron', 0, y + .3, 0, .92, .92, .92, [.62, .58, .56], .1, PI / 2); P('disc', 'hot', 0, y + .24, 0, .74, 1, .74, [1.5, .55, .14], 0);
      SP(S.flame, x, y + .3 + .35, z, .3, .45, FIRE, .9, 1, 1); SP(S.smoke, x, y + .5, z, .9, .9, [.4, .36, .34], .22, .1, 2.4);
    }
    function stock(x, z, yaw) {     // shackle post with a cross-bar, hanging manacles
      var P = frame(x, z, yaw, 1);
      P('box', 'wood', 0, 1.1, 0, .22, 2.2, .22, [.5, .4, .34], .5); P('box', 'wood', 0, 1.9, 0, 1.3, .16, .16, [.52, .42, .36], .4); P('box', 'iron', 0, .06, 0, .7, .12, .7, [.46, .43, .41], .4);
      P('rim', 'iron', -.5, 1.6, 0, .3, .3, .3, [.5, .47, .45], .1); P('rim', 'iron', .5, 1.6, 0, .3, .3, .3, [.5, .47, .45], .1); P('box', 'iron', -.5, 1.8, 0, .04, .2, .04, [.5, .47, .45], 0); P('box', 'iron', .5, 1.8, 0, .04, .2, .04, [.5, .47, .45], 0);
      K.solid(X(x), Z(z), .7, .7);
    }
    function coldFurnace(x, z, s, glow) {   // x side s: a squat brick furnace block, mouth facing the room centre
      var P = frame(x, z, 0, 1), f = -s;
      P('box', 'wall', 0, 2.1, 0, 3.4, 4.2, 4.2, [.3, .28, .27], .5, 0, 0); P('box', 'iron', 0, 4.35, 0, 3.6, .3, 4.4, IRONT, .2);
      P('box', 'rock', f * 1.62, 1.1, 0, .2, 1.7, 2.0, [.04, .035, .035], 0); P('box', 'wall', f * 1.72, 2.1, 0, .35, .4, 2.6, [.5, .46, .44], .2);
      for (var b = 0; b < 2; b++) P('box', 'wall', f * 1.72, 1.1, (b ? 1 : -1) * 1.15, .35, 2.2, .3, [.5, .46, .44], .2);
      P('cyl', 'iron', -f * .3, 6.0, 0, 1.1, 3.4, 1.1, SOOT, .2);
      if (glow) { P('box', 'hot', f * 1.56, .7, 0, .08, .5, 1.5, [1.2, .42, .1], 0); }
      K.solid(X(x), Z(z), 3.6, 4.4);
    }
    // scattered floor litter (coal, slag lumps, scrap plates, bolt heads, bars): small dark pieces that give the floor relief without brightening it
    function clutter(n) {
      var hw = r.w / 2 - 4.5, hd = r.d / 2 - 1.5, k, q, x, z, t, yw;
      for (k = 0; k < n; k++) {
        x = (R2() * 2 - 1) * hw; z = (R2() * 2 - 1) * hd; t = R2(); yw = R2() * 6;
        if (i === 11 && Math.hypot(x, z) < 6.5) continue;
        if (t < .45) BX('pebble', 'rock', x, .09, z, .14 + R2() * .22, .1 + R2() * .12, .14 + R2() * .2, yw, [.15 + R2() * .08, .14, .13], .3);
        else if (t < .75) BX('box', 'iron', x, .075, z, .5 + R2() * .6, .03, .3 + R2() * .4, yw, [.4, .37, .35], .3);
        else if (t < .9) BX('box', 'iron', x, .08, z, .14 + R2() * .12, .1, .14 + R2() * .12, yw, [.46, .43, .41], .3);   // nuts / bolt heads
        else BX('cyl', 'iron', x, .09, z, .09, .9 + R2() * .8, .09, yw, [.5, .47, .45], .3, 0, PI / 2);
      }
    }
    function corridor() {
      if (i >= 13) return;
      // the 4 m connecting corridor used to be the bare, untinted floor slab (a bright patch between the dark rooms): slab it like the room
      if (floorOpt) K.floor(i, { x: 0, z: r.z - 13, w: 7, d: 4.08 }, Object.assign({}, floorOpt, { cols: 3, rows: 2, zone: null, skip: null }));
      [-1, 1].forEach(function (s) { K.wall(i, s * 3.95, r.z - 13.7, 2.7, .8, 5.6, false, -s, 0, { tint: [.4, .37, .36], noPil: true, plinthKey: 'iron' });
        K.sconce(i, s * 3.5, 2.5, r.z - 13.5, -s, 0, { col: FIRE, light: true, lightColor: 0xff8a3c, intensity: 30 }); });   // light candidates between the rooms
    }
    // The five rock blocks standing at (+-6.8, -7) in rooms 1,4,7,10,13 are given different jobs by the room scripts.
    var ROOM = [];
    /* 0 Kralın Altındaki Geçit — the passage under the king: stone turning to iron, rust grates, a first red glow */
    ROOM[0] = function () {
      K.floor(i, r, { key: 'floor', tint: [.66, .6, .56], vary: .16, cols: 10, rows: 8, tilt: .04 });
      shell({ wallTint: [.62, .56, .52], glow: .6, gutter: 'slag', noMouths: false }); north({ tint: [.6, .55, .52], noGate: false });
      decals({ cracks: 8, soot: 8, plates: 2, grates: 3, rubble: 5, puddles: 3, wear: [.7, .66, .62] });
      for (var s = -1; s <= 1; s += 2) for (var n = 0; n < 3; n++) K.put(i, 'column', 'stone', X(s * 11.7), 2.6, Z((n - 1) * 6.4), 1.2, 5.2, 1.2, 0, 0, 0, [.6, .56, .54], .5);
      pipe(X(-13), 5.4, Z(8), X(-13), 5.4, Z(-9), .22); pipe(X(13), 4.8, Z(8), X(13), 4.8, Z(-9), .26);
      brazierF(X(-5), Z(-8.6), 1, 15); brazierF(X(5), Z(-8.6), 1, 15);
      smoke(5, [.3, .26, .24], .2, .4, 3, 4); embers(14, -12, 12, -9, 9, 5, .8);
      for (var k = 0; k < 3; k++) K.spr(i, S.smoke, X((R() - .5) * 18), .12, Z((R() - .5) * 14), 1.4, 1.4, [.5, .45, .42], .3, R(), .2, 2.5);
      bannerX(-6.6, 4.5, -10.5, 1.7, 3.4, 0, [.3, .07, .06]); bannerX(6.6, 4.5, -10.5, 1.7, 3.4, 0, [.3, .07, .06]);
      crates(-12.6, -9.2, .1, true); crates(12.5, -8.8, -.2, false); barrels(12.3, 7.6, 3, 0);
      catwalk(1, -8.5, 8.5, 3.7);
      valve(-12.7, 4.8, 3, PI / 2, .38); valve(12.6, 4.3, -2, -PI / 2, .38);
    };
    /* 1 Kör Körükler — blind bellows: giant accordion bellows feeding the wall furnaces */
    ROOM[1] = function () {
      K.floor(i, r, { key: 'floor', tint: COAL, vary: .18, cols: 10, rows: 8 });
      shell({ glow: 1 }); north({ vent: true });
      [-1, 1].forEach(function (s) {
        for (var b = 0; b < 8; b++) { var w = 1.5 - Math.abs(b - 3.5) * .06; K.put(i, 'box', b % 2 ? 'wood' : 'iron', X(s * 6.8), .7 + (b % 2) * .08, Z(-7), 2.8 - b * .0, 1.3 + (b % 2) * .12, 3.0 - b * .1 - (b % 2 ? .2 : 0), 0, 0, 0, b % 2 ? [.7, .52, .44] : IRONT, .4); }
        K.put(i, 'box', 'iron', X(s * 6.8), 1.55, Z(-7), 3.1, .24, 2.4, 0, 0, 0, IRONT, .2); pipe(X(s * 6.8), 1.8, Z(-5.8), X(s * 12.6), 1.6, Z(-5.8), .26);
        K.put(i, 'cyl', 'iron', X(s * 6.8), 2.9, Z(-7), .3, 2.6, .3, 0, 0, 0, IRONT, .2); K.put(i, 'box', 'iron', X(s * 6.8), 4.3, Z(-7), 3.4, .3, .5, 0, 0, 0, IRONT, .2);
      });
      slagHeap(X(-9.8), Z(4.8), 1.0, true);
      decals({ cracks: 6, soot: 8, plates: 3, grates: 2, chips: 5, wear: [.62, .58, .56] });
      brazierF(X(-5), Z(7.8), 1, 20); brazierF(X(5.5), Z(7.8), 1, 20);
      smoke(5, [.28, .24, .22], .22, .5, 3, 5); embers(24, -12, 12, -9, 9, 5.5, 1);
      [-1, 1].forEach(function (s) { flywheel(s * 9.5, 3.3, -7, PI / 2, 1.5); K.solid(X(s * 9.5), Z(-7), .7, 2.2); BAR(s * 9.5, 4.3, -7.6, s * 6.8, 4.3, -7, .07, IRONT); BX('box', 'iron', s * 9.5, 1.5, -7, .5, 3.0, .5, 0, [.46, .43, .41], .4);
        SP(S.smoke, s * 12.6, 1.9, -5.8, 1.2, 1.2, [.7, .7, .72], .22, .13, 2.4); });
      catwalk(-1, -8.5, 6, 3.7);
      crates(12.6, 8.2, .3, true); barrels(-12.4, 8.6, 2, 0);
    };
    /* 2 Kömür Mahkûmları — the coal convicts: coal heaps, hanging cages, rails */
    ROOM[2] = function () {
      K.floor(i, r, { key: 'floor', tint: [.4, .38, .38], vary: .2, cols: 10, rows: 8 });
      shell({ glow: .7, wallTint: [.4, .38, .38] }); north({});
      for (var n = 0; n < 2; n++) for (var q = 0; q < 14; q++) K.dec(i, 7, X(-1.5 + n * 3), Z(-9.5 + q * 1.45), 1.4, 1.46, 0, [.8, .74, .7], .7);   // tiled, not one stretched quad
      for (var q = 0; q < 14; q++) K.put(i, 'box', 'wood', X(0), .04, Z(-9.5 + q * 1.45), 4.2, .08, .4, 0, 0, 0, [.5, .4, .34], 0);
      [-1, 1].forEach(function (s) { K.put(i, 'box', 'iron', X(s * 1.5), .12, Z(0), .12, .16, 20, 0, 0, 0, [.6, .58, .56], 0); });
      slagHeap(X(-9.6), Z(3), 1.9, false); slagHeap(X(9.8), Z(-3), 1.7, false); slagHeap(X(-9.2), Z(-8), 1.4, false);
      [-1, 1].forEach(function (s) { for (var q = 0; q < 3; q++) { var cz = -5 + q * 5.5; cage(X(s * (6 + q * .4)), Z(cz), 2.0 + (q % 2) * .6); } });
      cart(X(-5.6), Z(-1.5), 0, false); cart(X(5.6), Z(5.6), 0, false);
      decals({ cracks: 6, soot: 12, chips: 10, plates: 2, blood: 4, rubble: 4, wear: [.5, .48, .46] });
      brazierF(X(-6.5), Z(1), .9, 17); brazierF(X(6.4), Z(7), .9, 17);
      smoke(8, [.2, .18, .17], .26, .6, 3.4, 4); embers(12, -10, 10, -9, 9, 4.5, .8);
      stock(-9.4, 1.5, .2); stock(-9.6, -4.2, -.1); stock(9.6, 3.6, .1); stock(9.2, -6.2, PI);
      BX('box', 'wood', -12.4, .35, 6.6, .8, .7, 3.4, 0, [.5, .4, .34], .5); K.solid(X(-12.4), Z(6.6), 1.0, 3.5);
      BX('box', 'wood', 12.4, .35, -1.0, .8, .7, 3.4, 0, [.5, .4, .34], .5); K.solid(X(12.4), Z(-1.0), 1.0, 3.5);
      // coal chute coming out of the north-east wall
      BX('ingot', 'iron', 9.0, 2.3, -10.4, 1.7, .8, 2.4, 0, [.46, .43, .41], .4, .9, 0); BX('rock', 'rock', 9.0, .6, -9.6, 2.4, 1.0, 2.0, .4, [.16, .15, .15], .5);
      barrels(-12.4, -9.4, 3, 0); crates(12.4, 9, .2, true);
    };
    /* 3 Kızgın Nakliye — hot transport: rails, carts of molten ore, a gantry, a bridge over the channel */
    ROOM[3] = function () {
      K.floor(i, r, { key: 'iron', tint: [.5, .48, .46], vary: .14, cols: 10, rows: 8 });
      shell({ glow: 1 }); north({ vent: true });
      for (var q = 0; q < 16; q++) K.put(i, 'box', 'wood', X(-0.6), .045, Z(-10.2 + q * 1.35), 4.4, .09, .36, 0, 0, 0, [.5, .4, .34], 0);
      [-1.7, 0.5].forEach(function (x) { K.put(i, 'box', 'iron', X(x), .14, Z(0), .13, .18, 21, 0, 0, 0, [.62, .58, .56], 0); });
      cart(X(-5.6), Z(-1), 0, true); cart(X(5.6), Z(-5.5), 0, true); cart(X(5.6), Z(5), 0, false);
      [-1, 1].forEach(function (s) { K.put(i, 'box', 'iron', X(s * 6.8), 6.2, Z(-1), .5, .5, 17, 0, 0, 0, IRONT, .1); K.put(i, 'box', 'iron', X(s * 6.8), 6.6, Z(-1), .3, .3, 17, 0, 0, 0, IRONT, .1); });
      K.put(i, 'box', 'iron', X(0), 6.5, Z(-8.4), 15.8, .5, .7, 0, 0, 0, IRONT, .1); for (var h = 0; h < 4; h++) { K.chain(i, X(-3 + h * 2), 6.3, Z(-8.4), 3.4, [.55, .5, .48]); hook(-3 + h * 2, 6.3 - Math.floor(3.4 / .22) * .22, -8.4); }
      K.put(i, 'box', 'iron', X(0), 3.0, Z(-8.4), 1.4, .5, 1.0, 0, 0, 0, IRONT, .3); K.put(i, 'box', 'hot', X(0), 2.74, Z(-8.4), 1.2, .05, .8, 0, 0, 0, [2.2, .8, .2], 0); K.spr(i, S.glow, X(0), 2.4, Z(-8.4), 1.7, 1.7, [1, .35, .06], .6, 0, 1, 1);
      slagHeap(X(-9.6), Z(5), 1.4, true); slagHeap(X(9.6), Z(-6), 1.2, true);
      decals({ cracks: 5, soot: 8, plates: 5, grates: 3, heat: 2, chips: 4, wear: [.6, .56, .54] });
      brazierF(X(-5.2), Z(8), 1, 20); brazierF(X(5.4), Z(2), 1, 18);
      smoke(5, [.32, .26, .22], .22, .5, 3, 5); embers(26, -12, 12, -9, 9, 6, 1.1);
      // crane trolley + hoist block, a signal post, cold ingots by the wall
      BX('box', 'iron', 0, 6.1, -8.4, 1.6, .5, 1.3, 0, IRONT, .2); BX('box', 'iron', 0, 6.1, -8.4, .3, .3, 15.2, PI / 2, [.5, .47, .45], .1);
      BX('cyl', 'iron', 0, 6.45, -8.4, .6, .4, .6, 0, IRONT, .1);
      ingots(-12.6, -7.2, PI / 2, 4, false); ingots(12.6, 2.2, PI / 2, 3, false);
      BX('cyl', 'iron', -3.2, 1.0, 9.0, .12, 2.0, .12, 0, [.5, .47, .45], .2); BX('box', 'iron', -3.2, 2.1, 9.0, .4, .5, .3, 0, [.46, .43, .41], .2); HOT(-3.2, 2.1, 8.83, .22, .3, .05, [1.8, .22, .06]);
      K.solid(X(-3.2), Z(9.0), .4, .4);
      catwalk(1, -9, 8, 3.7); catwalk(-1, -9, -2, 3.7);
    };
    /* 4 Kül Vezirinin Avlusu — the ash vizier's court: an iron dais with a chair of anvils, censers, ash banners */
    ROOM[4] = function () {
      K.floor(i, r, { key: 'floor', tint: [.55, .5, .48], vary: .14, cols: 10, rows: 8, zone: function (x, z) { return Math.hypot(x, z + 1) < 3.6 ? [1.2, .9, .8] : null; } });
      shell({ glow: .8, wallTint: [.5, .46, .44] }); north({ tint: [.52, .48, .46] });
      for (var k = 0; k < 3; k++) K.put(i, 'box', 'iron', X(0), .1 + k * .2, Z(-8.2 - k * .5), 9 - k * 1.3, .2, 1.2, 0, 0, 0, [.55, .52, .5], .3);
      K.put(i, 'box', 'iron', X(0), .5, Z(-9.7), 8, 1.0, 2.4, 0, 0, 0, IRONT, .4); K.put(i, 'box', 'iron', X(0), 1.35, Z(-10.4), 2.6, 1.7, 1.0, 0, 0, 0, [.5, .46, .44], .4); K.put(i, 'box', 'iron', X(0), 3.1, Z(-10.9), 3.0, 3.8, .5, 0, 0, 0, SOOT, .3, 3);
      for (var q = -3; q <= 3; q++) K.put(i, 'cone4', 'iron', X(q * .48), 5.3 + (3 - Math.abs(q)) * .15, Z(-10.9), .3, 1.1 + (3 - Math.abs(q)) * .25, .3, PI / 4, 0, 0, IRONT, .1);
      anvil(X(-2.3), Z(-9.2), 0.3, .8); anvil(X(2.3), Z(-9.2), -0.3, .8); K.solid(X(0), Z(-10.4), 3.4, 1.4);
      K.put(i, 'box', 'rock', X(6.8), 1.1, Z(-7), 3.2, 2.2, 2.2, 0, 0, 0, SOOT, .5); K.put(i, 'box', 'rock', X(-6.8), 1.1, Z(-7), 3.2, 2.2, 2.2, 0, 0, 0, SOOT, .5);
      [-1, 1].forEach(function (s) { K.put(i, 'box', 'iron', X(s * 6.8), 2.35, Z(-7), 3.4, .16, 2.4, 0, 0, 0, IRONT, .1); K.spr(i, S.flame, X(s * 6.8), 2.45 + .5, Z(-7), .4, .5, FIRE, .9, R(), 1, 1); K.spr(i, S.glow, X(s * 6.8), 3.0, Z(-7), 1.6, 1.6, [.6, .22, .06], .8, R(), 1, 1); });
      for (var n = 0; n < 5; n++) { var a = n / 5 * 6.28; K.chain(i, X(Math.cos(a) * 4.8), 6.0, Z(Math.sin(a) * 4.8 + 1), 3.0, [.5, .46, .44]); censer(Math.cos(a) * 4.8, 3.05, Math.sin(a) * 4.8 + 1, 1); }
      K.dec(i, 5, X(0), Z(1), 10, 10, .4, [1.4, .4, .08], .7, 'glow'); K.dec(i, 5, X(0), Z(1), 10, 10, .4, [.4, .3, .26], .8);
      decals({ cracks: 6, soot: 14, chips: 6, rubble: 4, blood: 3, wear: [.55, .5, .48] });
      brazierF(X(-5.2), Z(5), 1, 18); brazierF(X(5.2), Z(5), 1, 18); brazierF(X(-3.6), Z(-6.4), .8, 17);
      smoke(10, [.34, .3, .3], .3, .6, 3.6, 5); embers(16, -10, 10, -9, 9, 5, .8);
      bannerX(-5.5, 4.4, -10.5, 1.9, 4.0, 0, [.22, .21, .21]); bannerX(5.5, 4.4, -10.5, 1.9, 4.0, 0, [.22, .21, .21]); bannerX(-9.2, 4.4, -10.5, 1.5, 3.4, 0, [.2, .19, .19]); bannerX(9.2, 4.4, -10.5, 1.5, 3.4, 0, [.2, .19, .19]);
      ashDrift(-9.6, 2, 3, 6); ashDrift(9.8, 5, 3, 6);
      barrels(-12.3, -8.4, 2, 0); crates(12.4, -8.7, .2, true);
    };
    /* 5 Sönen Dökümhane — the dying foundry: cold furnaces, ash drifts, a steaming cooling pool, a fallen gantry */
    ROOM[5] = function () {
      K.floor(i, r, { key: 'floor', tint: [.6, .58, .56], vary: .2, cols: 10, rows: 8, tilt: .05 });
      shell({ glow: .35, gutter: 'slag', wallTint: [.5, .48, .47], ruin: .5 }); north({ tint: [.52, .5, .48] });
      K.put(i, 'box', 'iron', X(1.5), .5, Z(-9.8), 8, .5, .5, .1, .1, .1, IRONT, .5); K.put(i, 'box', 'iron', X(-3), 1.2, Z(-9.2), .5, 2.4, .5, 0, 0, .3, IRONT, .5);
      
      K.solid(X(-6.8), Z(-7), 3.2, 3.2); K.put(i, 'vat', 'iron', X(-6.8), .7, Z(-7), 3.2, 1.4, 3.2, 0, 0, 0, IRONT, .4); K.put(i, 'disc', 'floor', X(-6.8), 1.3, Z(-7), 2.5, 1, 2.5, 0, 0, 0, [.14, .16, .2], 0);
      for (var k = 0; k < 4; k++) K.spr(i, S.smoke, X(-6.8 + (R() - .5) * 1.4), 1.3, Z(-7 + (R() - .5) * 1.4), 1.3, 1.3, [.66, .66, .68], .3, R(), .14 + R() * .08, 4);
      slagHeap(X(-9.2), Z(5), 1.6, true); slagHeap(X(9.4), Z(2), 1.2, false); K.rubble(i, X(0), Z(-1.5), 3.4, 26, 1.0, 'rock', [.4, .38, .37], R);
      decals({ cracks: 10, soot: 16, chips: 8, rubble: 6, plates: 2, heat: 3, puddles: 3, wear: [.6, .58, .56] });
      brazierF(X(-5.6), Z(7.6), .85, 14); brazierF(X(5.6), Z(8), .85, 14);
      smoke(5, [.4, .38, .36], .16, .5, 3.4, 3.5); embers(8, -12, 12, -9, 9, 4, .6);
      coldFurnace(10.6, -5.2, 1, false); coldFurnace(-11.0, 4.2, -1, true);
      crucible(2.8, 5.8, .9, false); crucible(-3.2, 7.4, .8, false); BX('box', 'iron', -3.2, 1.55, 7.4, 1.2, .1, .1, .6, [.5, .47, .45], .1);
      ashDrift(6, 3, 4, 5); ashDrift(-5, -4, 4, 4);
      BX('ingot', 'iron', 4.6, 1.2, -9.4, 2.6, .5, 1.4, .3, [.46, .43, .41], .4, 0, 1.2);
    };
    /* 6 Demirin Duası — the prayer of iron: kneeling iron figures before a great anvil altar */
    ROOM[6] = function () {
      K.floor(i, r, { key: 'floor', tint: [.52, .48, .46], vary: .12, cols: 10, rows: 8 });
      shell({ glow: .8, gutter: 'slag' }); north({});
      for (var row = 0; row < 4; row++) for (var s = -1; s <= 1; s += 2) { ironStatue(X(s * 10.0), Z(-6.5 + row * 4.3), s > 0 ? -PI / 2 : PI / 2, 1, .72); K.solid(X(s * 10.0), Z(-6.5 + row * 4.3), 1.7, 1.7); }
      anvil(X(0), Z(-8.6), 0, 2.4); K.put(i, 'box', 'iron', X(0), .22, Z(-8.6), 4.6, .44, 3, 0, 0, 0, IRONT, .4);
      K.spr(i, S.glow, X(0), 2.5, Z(-8.6), 2.2, 1.6, [1.4, .5, .1], .6, 0, 1, 1); K.put(i, 'box', 'hot', X(0), 2.45, Z(-8.6), 2.4, .04, .9, 0, 0, 0, [2.2, .9, .28], 0); K.light(i, X(0), 3.2, Z(-8.6), 0xff8a3c, 24, 13, { glow: 1.8 });
      K.dec(i, 5, X(0), Z(-1), 12, 12, .2, [1.4, .45, .1], .85, 'glow'); K.dec(i, 5, X(0), Z(-1), 12, 12, .2, [.5, .34, .28], .6);
      for (var k = 0; k < 8; k++) { var cx = (k % 2 ? 1 : -1) * 6.2, cz = -8 + k * 2.2; K.put(i, 'cyl', 'iron', X(cx), .2, Z(cz), .12, .4, .12, 0, 0, 0, IRONT, 0); K.spr(i, S.flame, X(cx), .4 + .15, Z(cz), .06, .15, FIRE, .9, R(), 1, 1); }
      
      decals({ cracks: 4, soot: 8, chips: 4, plates: 3, rubble: 2, wear: [.5, .46, .44] });
      brazierF(X(-5.6), Z(7.8), 1, 17); brazierF(X(5.6), Z(7.8), 1, 17);
      smoke(6, [.46, .4, .36], .2, .6, 3.4, 5); embers(24, -10, 10, -9, 9, 6, 1);
      // halo ring behind the great anvil, prayer rail, chain curtains
      BX('rim', 'iron', 0, 4.3, -10.5, 5.0, 5.0, 5.0, 0, [.55, .52, .5], .1); BX('rim', 'hot', 0, 4.3, -10.45, 4.5, 4.5, 4.5, 0, [1.2, .42, .1], 0);
      BX('box', 'iron', 0, .38, -5.0, 8.6, .09, .09, 0, [.5, .47, .45], .3); for (var q = -4; q <= 4; q += 2) BX('box', 'iron', q, .2, -5.0, .1, .4, .1, 0, [.5, .47, .45], .3);
      [-8.2, 8.2].forEach(function (x) { for (var z = -5; z <= 5; z += 5) { K.chain(i, X(x), 6.2, Z(z), 3.4, [.55, .5, .48]); hook(x, 6.2 - Math.floor(3.4 / .22) * .22, z); } });
      crates(-12.5, 8.9, .1, false);
    };
    /* 7 Zincir Kuyuları — chain wells: glowing pits with heavy chains running down into the glow */
    ROOM[7] = function () {
      K.floor(i, r, { key: 'floor', tint: COAL, vary: .18, cols: 10, rows: 8 });
      shell({ glow: .9 }); north({});
      [[-6.8, -7], [6.8, -7]].forEach(function (p, q) {
        var x = X(p[0]), z = Z(p[1]), big = q === 2;
        K.put(i, 'vat', 'iron', x, .5, z, big ? 4.6 : 3.4, 1.0, big ? 4.6 : 3.4, 0, 0, 0, IRONT, .3); K.put(i, 'disc', 'lava', x, .9, z, big ? 3.6 : 2.6, 1, big ? 3.6 : 2.6, 0, 0, 0, [big ? 1.8 : 1.3, big ? 1.8 : 1.3, 0], 0);
        K.spr(i, S.pool, x, .2, z, big ? 9 : 7, big ? 9 : 7, [1, .32, .06], .6, R(), 1, 1); K.spr(i, S.glow, x, 1.4, z, 3.2, 3.2, [1.2, .42, .08], .8, R(), 1, 1);
        K.put(i, 'box', 'iron', x - 2.5, 3.2, z, .3, 6.4, .3, 0, 0, 0, IRONT, .3); K.put(i, 'box', 'iron', x + 2.5, 3.2, z, .3, 6.4, .3, 0, 0, 0, IRONT, .3); K.put(i, 'box', 'iron', x, 6.2, z, 5.3, .35, .5, 0, 0, 0, IRONT, .2);   // uprights now stand outside the vat (they were inside its wall)
        K.chain(i, x, 6.0, z, 5.2, [.62, .58, .55]); K.put(i, 'cyl', 'iron', x, 6.4, z, .4, .8, .4, 0, 0, PI / 2, IRONT, .1);
        if (q < 2) K.light(i, x, 2.2, z, 0xff7a30, 22, 12, { glow: 1.6 });
        for (var k = 0; k < 4; k++) K.spr(i, S.ember, x + (R() - .5) * 2, .9, z + (R() - .5) * 2, .05, .05, [2, .8, .22], 1, R(), .2 + R() * .15, 5);
      });
      for (var h = 0; h < 6; h++) { var cl = 3 + R() * 3; K.chain(i, X(-9 + h * 3.6), 6.4, Z(-1 + (h % 2) * 6 - 4), cl, [.55, .5, .48]); hook(-9 + h * 3.6, 6.4 - Math.floor(cl / .22) * .22, -1 + (h % 2) * 6 - 4); }
      decals({ cracks: 6, soot: 10, chips: 6, plates: 3, grates: 2, heat: 2, wear: [.5, .46, .44] });
      brazierF(X(-5.6), Z(7.8), .9, 15); brazierF(X(5.8), Z(8), .9, 15);
      smoke(7, [.3, .24, .2], .24, .6, 3.4, 5); embers(14, -12, 12, -9, 9, 6, 1);
      winch(-11.6, 4.6, PI / 2, 2.0); winch(11.6, -2.8, -PI / 2, 2.4);
      // well coping stones and iron straps around each pit
      [-6.8, 6.8].forEach(function (x) { for (var q = 0; q < 8; q++) { var a = q / 8 * 6.283 + .2; BX('box', 'wall', x + Math.cos(a) * 2.0, .3, -7 + Math.sin(a) * 2.0, .9, .6, .8, -a, [.5, .46, .44], .5); } });
      barrels(-12.3, -9.2, 2, 0);
    };
    /* 8 Yutulan Çarklar — swallowed gears: wall-mounted wheels that still turn, a gear sunk in the floor */
    ROOM[8] = function () {
      K.floor(i, r, { key: 'floor', tint: [.52, .46, .42], vary: .16, cols: 10, rows: 8 });
      shell({ glow: .75, wallTint: [.5, .44, .4] }); north({});
      [-1, 1].forEach(function (s, q) {
        K.gear(i, 'gear18', 'iron', X(s * 13.1), 3.6, Z(-3), 3.6, .7, [0, PI / 2, 0], s * .12); K.gear(i, 'gear12', 'iron', X(s * 13.0), 4.4, Z(4.2), 2.4, .7, [0, PI / 2, 0], -s * .18); K.gear(i, 'gear8', 'iron', X(s * 13.0), 1.5, Z(-8), 1.6, .7, [0, PI / 2, 0], s * .25);
      });
      K.gear(i, 'gear18', 'iron', X(0), .14, Z(-4.5), 4.6, .2, [-PI / 2, 0, 0], .08); K.gear(i, 'gear12', 'iron', X(6.6), .12, Z(0.5), 2.6, .2, [-PI / 2, 0, 0], -.12);
      K.gear(i, 'gear18', 'iron', X(-6.6), 4.0, Z(-10.72), 1.7, .4, [0, 0, 0], .1);   // was buried inside the north wall (invisible)
      
      [-1, 1].forEach(function (s) { K.solid(X(s * 6.8), Z(-7), 1.6, 1.6); K.put(i, 'cyl', 'iron', X(s * 6.8), 2.8, Z(-7), .5, 3.2, .5, 0, 0, 0, IRONT, .3); K.put(i, 'cyl', 'iron', X(s * 6.8), 1.2, Z(-7), 1.4, .5, 1.4, 0, 0, 0, [.7, .62, .56], .3); pipe(X(s * 6.8), 4.3, Z(-7), X(s * 12.6), 4.3, Z(-7), .22); });
      decals({ cracks: 6, soot: 10, chips: 5, plates: 4, grates: 2, rubble: 3, wear: [.5, .46, .44] });
      brazierF(X(-5.2), Z(7.4), .95, 17); brazierF(X(5.4), Z(7.4), .95, 17);
      smoke(6, [.34, .28, .24], .22, .6, 3.4, 5); embers(16, -12, 12, -9, 9, 5, .9);
      // transmission rods tie the wall wheels together; scrap pile of broken teeth
      [-1, 1].forEach(function (s) { BAR(s * 12.5, 3.6, -3, s * 12.5, 4.4, 4.2, .09, IRONT); BAR(s * 12.5, 4.4, 4.2, s * 12.5, 1.5, -8, .07, IRONT); });
      K.rubble(i, X(-9.5), Z(8.4), 1.6, 12, .6, 'iron', [.46, .43, .41], R2);
      flywheel(-9.2, 2.2, 8.8, PI / 2, 1.0);
      catwalk(1, -8, 7, 3.7);
    };
    /* 9 Cüruf Meydanı — slag square: glowing slag heaps, sulphur smoke, cooling troughs */
    ROOM[9] = function () {
      K.floor(i, r, { key: 'floor', tint: [.5, .46, .4], vary: .2, cols: 10, rows: 8, tilt: .05 });
      shell({ glow: 1, wallTint: [.5, .46, .4] }); north({});
      slagHeap(X(-6.4), Z(2), 2.2, true); slagHeap(X(7), Z(-3), 2.4, true); slagHeap(X(-9.6), Z(-6), 1.6, true); slagHeap(X(9.2), Z(6.4), 1.4, true);
      slagHeap(X(-9.7), Z(-8.6), 1.5, true); slagHeap(X(9.7), Z(0.6), 1.5, true); for (var k = 0; k < 6; k++) K.spr(i, S.smoke, X((k % 2 ? 1 : -1) * 4.4), 1.0, Z(-9.2), 1.5, 1.5, [.7, .7, .64], .3, R(), .14, 3.6);
      
      for (var k = 0; k < 6; k++) { var px = X((k % 2 ? 1 : -1) * (9.8 + R() * 1.4)), pz = Z(-9 + k * 3.4); K.put(i, 'cyl', 'iron', px, 2.6, pz, .5, 5.2, .5, 0, 0, 0, IRONT, .3); K.spr(i, S.smoke, px, 5.2, pz, 1.8, 1.8, [.62, .56, .22], .32, R(), .09, 4.5); }
      decals({ cracks: 10, soot: 8, chips: 12, heat: 3, rubble: 5, puddles: 2, wear: [.5, .46, .4] });
      brazierF(X(-5.6), Z(8), .9, 15); brazierF(X(5.6), Z(8), .9, 15);
      smoke(13, [.6, .55, .3], .17, .6, 4.2, 5); embers(30, -12, 12, -9, 9, 6, 1.1);
      trough(-4.8, -9.3, 3.8, 0, false); trough(4.8, -9.3, 3.8, 0, false);
      runner(-8.6, -8.9, -6.8, -9.2, .45); runner(8.2, -8.4, 6.8, -9.0, .45);
      crucible(-11.4, 6.2, .9, true);
    };
    /* 10 Kızıl Fırınlar — the red furnaces: massive furnace blocks with white-hot mouths, molten channels, heat haze */
    ROOM[10] = function () {
      K.floor(i, r, { key: 'floor', tint: [.48, .42, .38], vary: .16, cols: 10, rows: 8 });
      shell({ glow: 1.35, noMouths: true, gutter: 'none' }); north({ vent: true });   // (the old channel at x=+-11 lay under the furnace blocks)
      [-1, 1].forEach(function (s) {
        for (var n = 0; n < 3; n++) {
          var z = (n - 1) * 6.4, x = s * 12.0;
          K.put(i, 'box', 'wall', X(x), 3.0, Z(z), 3.6, 6.0, 4.6, 0, 0, 0, [.46, .42, .4], .5, 4); K.put(i, 'box', 'iron', X(x), 6.15, Z(z), 3.8, .4, 4.8, 0, 0, 0, IRONT, .2);
          K.put(i, 'box', 'hot', X(x - s * 1.86), 1.9, Z(z), .08, 1.8, 2.2, 0, 0, 0, [1.45, .6, .18], 0); K.solid(X(x), Z(z), 3.6, 4.6); for (var b = 0; b < 5; b++) K.put(i, 'box', 'iron', X(x - s * 1.92), 1.9, Z(z + (b - 2) * .5), .1, 2.0, .1, 0, 0, 0, [.5, .46, .44], 0);
          K.put(i, 'box', 'stone', X(x - s * 1.75), 3.1, Z(z), .5, .5, 2.8, 0, 0, 0, [.62, .58, .54], .1); K.put(i, 'cyl', 'iron', X(x + s * .2), 8.0, Z(z), 1.4, 4, 1.4, 0, 0, 0, SOOT, .2);
          K.spr(i, S.glow, X(x - s * 2.6), 1.9, Z(z), 2.6, 2.6, [1.0, .4, .12], .8, R(), 1, 1); K.spr(i, S.pool, X(x - s * 3.8), .14, Z(z), 8, 8, [1.1, .4, .1], .55, R(), 1, 1);
          K.spr(i, S.flame, X(x - s * 2.0), .5 + .9, Z(z), .8, .9, [1.5, .6, .15], .9, R(), 1.2, 1); K.heat(X(x - s * 2.2), 1.9, Z(z), 2.0, 2.4, 1);
          if (n === 1) K.light(i, X(x - s * 3), 2.2, Z(z), 0xff7a30, 26, 13, { glow: 1.8 });
        }
      });
      K.put(i, 'box', 'rock', X(6.8), 1.1, Z(-7), 3.2, 2.2, 2.2, 0, 0, 0, SOOT, .5); K.put(i, 'box', 'rock', X(-6.8), 1.1, Z(-7), 3.2, 2.2, 2.2, 0, 0, 0, SOOT, .5);
      [-1, 1].forEach(function (s) { anvil(X(s * 6.8), Z(-7), s * .4, 1.3); });
      decals({ cracks: 6, soot: 6, chips: 6, plates: 2, grates: 2, heat: 4, wear: [.5, .44, .4] });
      smoke(7, [.36, .26, .2], .24, .6, 3.4, 5); embers(40, -12, 12, -9, 9, 6.5, 1.2);
      [-1, 1].forEach(function (s) {
        for (var n = 0; n < 3; n++) { var z = (n - 1) * 6.4; BX('box', 'iron', s * 9.5, .17, z, 1.2, .34, 3.4, 0, [.46, .43, .41], .4); runner(s * 9.95, z, s * 8.6, z, .5); BX('box', 'wall', s * 10.0, 3.45, z + 1.4, .4, .3, .15, 0, [.6, .56, .52], .2); }
      });
      bannerX(-6.6, 4.6, -10.5, 1.7, 3.4, 0, [.28, .08, .05]); bannerX(6.6, 4.6, -10.5, 1.7, 3.4, 0, [.28, .08, .05]);
    };
    /* 11 Köz Yemini — the oath of embers: an iron dais, a ring of fire, a glowing anvil-altar */
    ROOM[11] = function () {
      K.floor(i, r, { key: 'floor', tint: [.56, .5, .46], vary: .1, cols: 10, rows: 8 });
      shell({ glow: .9 }); north({ vent: false });
      for (var k = 0; k < 3; k++) K.put(i, 'cyl', 'iron', X(0), .09 + k * .17, Z(0), 12.2 - k * 1.6, .18, 12.2 - k * 1.6, 0, 0, 0, [.62, .58, .56], .1);
      K.put(i, 'cyl', 'iron', X(0), .56, Z(0), 6.8, .18, 6.8, 0, 0, 0, [.66, .6, .56], 0);
      K.dec(i, 5, X(0), Z(0), 8.6, 8.6, .2, [.8, .28, .06], .95, 'glow', .54); K.dec(i, 6, X(0), Z(0), 5.2, 5.2, 0, [.6, .22, .05], .7, 'glow', .67);   // were at y=.055, buried under the steps
      anvil(X(0), Z(0), 0, 1.8); K.put(i, 'crystal', 'crystalA', X(0), 2.7, Z(0), .8, 1.6, .8, .3, 0, 0, null, 0);
      K.spr(i, S.glow, X(0), 2.9, Z(0), 1.5, 1.2, [1.2, .55, .14], .55, 0, 1, 1);   // was a 7 m flat orange disc over the altar K.spr(i, S.pool, X(0), .7, Z(0), 7.5, 7.5, [.9, .42, .12], .5, .2, 1, 1); K.light(i, X(0), 3.4, Z(0), 0xffa050, 17, 13, { scatter: .9, glow: 2.2, flicker: .1 });
      for (var q = 0; q < 4; q++) { var a = q * PI / 2 + PI / 4; K.brazier(i, X(Math.cos(a) * 7.6), Z(Math.sin(a) * 7.6), { s: 1.0, col: FIRE, lightColor: 0xff9040, intensity: 26 }); }
      for (var q = 0; q < 34; q++) K.spr(i, S.ember, X((R() - .5) * 9), .7, Z((R() - .5) * 9), .05, .05, [2, 1, .34], 1, R(), .15 + R() * .15, 6);
      decals({ cracks: 3, soot: 3, chips: 2 });
      smoke(5, [.34, .28, .24], .18, .6, 3.4, 5); embers(16, -12, 12, -9, 9, 6, 1);
      // oath posts with glowing bands
      [0, 1, 2, 3].forEach(function (q) { var a = q * PI / 2, x = Math.cos(a) * 6.9, z = Math.sin(a) * 6.9;
        BX('box', 'iron', x, 1.5, z, .5, 3.0, .5, 0, [.52, .49, .47], .5); BX('box', 'iron', x, 3.1, z, .8, .2, .8, 0, IRONT, .2); HOT(x, 2.2, z, .54, .1, .54, [1.4, .5, .12]); HOT(x, 1.2, z, .54, .1, .54, [1.4, .5, .12]); K.solid(X(x), Z(z), .8, .8);
      });
          };
    /* 12 Son Döküm — the last casting: a giant ladle on a crane over a casting floor, moulds and glowing runners */
    ROOM[12] = function () {
      K.floor(i, r, { key: 'iron', tint: [.46, .43, .42], vary: .14, cols: 10, rows: 8 });
      shell({ glow: 1.2 }); north({ vent: true });
      K.put(i, 'box', 'iron', X(0), 7.0, Z(-4.5), 24, .7, .9, 0, 0, 0, IRONT, .1); [-1, 1].forEach(function (s) { K.put(i, 'box', 'iron', X(s * 12.6), 3.6, Z(-4.5), .9, 7.2, .9, 0, 0, 0, IRONT, .3); });
      K.chain(i, X(-1.4), 6.8, Z(-4.5), 1.6, [.6, .56, .54]); K.chain(i, X(1.4), 6.8, Z(-4.5), 1.6, [.6, .56, .54]);
      K.put(i, 'vat', 'iron', X(0), 3.7, Z(-4.5), 3.4, 2.6, 3.4, 0, 0, 0, [.5, .46, .44], .2); K.put(i, 'disc', 'hot', X(0), 4.85, Z(-4.5), 2.4, 1, 2.4, 0, 0, 0, [1.9, .9, .3], 0);
      K.spr(i, S.glow, X(0), 5.1, Z(-4.5), 2.6, 2.6, [1.0, .42, .12], .65, 0, 1, 1); K.spr(i, S.pool, X(0), .14, Z(-4.5), 9, 9, [1.1, .4, .1], .6, .1, 1, 1);
      K.dec(i, 15, X(0), Z(-1), 8, 8, 0, [1.5, .5, .1], .85, 'glow'); K.dec(i, 15, X(-3), Z(3), 6, 6, 2, [1.5, .5, .1], .7, 'glow');
      [[-5.2, -8.6], [5.6, -8.6]].forEach(function (p) { K.solid(X(p[0]), Z(p[1]), 3.2, 2.0); K.put(i, 'box', 'iron', X(p[0]), .35, Z(p[1]), 3.0, .7, 1.8, .2, 0, 0, [.5, .46, .44], .5); K.put(i, 'box', 'hot', X(p[0]), .72, Z(p[1]), 2.4, .05, 1.2, .2, 0, 0, [2.0, .72, .18], 0); });
      
      decals({ cracks: 6, soot: 6, chips: 6, plates: 3, grates: 2, heat: 3, wear: [.5, .44, .4] });
      brazierF(X(-5.6), Z(8), .95, 17); brazierF(X(5.6), Z(8), .95, 17);
      smoke(6, [.38, .28, .22], .24, .6, 3.4, 5); embers(36, -12, 12, -9, 9, 6.5, 1.2);
      // casting floor: runners from the moulds converge under the ladle's pouring basin
      runner(-5.2, -7.6, -5.2, -2.6, .5); runner(5.6, -7.6, 5.6, -2.6, .5); runner(-5.2, -2.6, -1.4, -2.6, .5); runner(5.6, -2.6, 1.4, -2.6, .5);
      BX('box', 'iron', 0, .16, -2.6, 3.2, .3, 2.0, 0, [.46, .43, .41], .4); HOT(0, .33, -2.6, 2.6, .05, 1.5, [1.25, .46, .11]);
      BAR(-1.68, 4.95, -4.5, -1.4, 5.3, -4.5, .07, IRONT); BAR(1.68, 4.95, -4.5, 1.4, 5.3, -4.5, .07, IRONT);   // the chains ended 26 cm above the ladle
      crucible(-9.5, 6.4, .9, true); crucible(10.0, 5.6, .8, false); ingots(10.4, -3.5, PI / 2, 3, false);
    };
    /* 13 Kızıl Ocak — the furnace heart: a colossal furnace, glowing channels across the floor, a ring of chains and pillars */
    ROOM[13] = function () {
      K.floor(i, r, { key: 'iron', tint: [.44, .4, .38], vary: .12, cols: 12, rows: 9 });
      [-1, 1].forEach(function (s) {
        K.wall(i, X(s * (r.w / 2 + .45)), Z(0), r.d + .2, .9, 7.4, false, -s, 0, { tint: SOOT, pil: 5.4, plinthKey: 'iron' });
        lavaPanel(X(s * 13), Z(0), 2.2, r.d - 3); K.solid(X(s * 13), Z(0), 1.6, r.d - 3); [-1, 1].forEach(function (sd) { K.put(i, 'box', 'iron', X(s * 13 + sd * 1.2), .22, Z(0), .22, .44, r.d - 3, 0, 0, 0, [.7, .66, .64], .3); });
        for (var q = 0; q < 4; q++) { var z = (q - 1.5) * 5.2; K.put(i, 'box', 'iron', X(s * 8.3), .25, Z(z), 1.5, .5, 1.5, 0, 0, 0, IRONT, .5); K.put(i, 'box', 'iron', X(s * 8.3), 2.8, Z(z), .8, 5.1, .8, 0, 0, 0, IRONT, .55, 3); for (var b = 0; b < 3; b++) K.put(i, 'box', 'iron', X(s * 8.3), 1.1 + b * 1.7, Z(z), 1.0, .2, 1.0, 0, 0, 0, [.8, .74, .7], .3); K.put(i, 'box', 'iron', X(s * 8.3), 5.45, Z(z), 1.5, .4, 1.5, 0, 0, 0, IRONT, .2); K.chain(i, X(s * 7.3), 5.2, Z(z), 3.2, [.55, .5, .48]); }
        K.spr(i, S.pool, X(s * 13), .2, Z(-2), 9, 9, [1.1, .36, .08], .55, R(), 1, 1); K.spr(i, S.pool, X(s * 13), .2, Z(6), 9, 9, [1.1, .36, .08], .55, R(), 1, 1);
      });
      // the heart
      var fz = -9.8;
      K.solid(X(0), Z(fz - 1.2), 13.5, 3.4);   // the furnace body was walk-through at |x|>2.4
      K.put(i, 'box', 'wall', X(0), 3.3, Z(fz - 1.2), 13.5, 6.6, 3.4, 0, 0, 0, [.42, .38, .36], .5, 4); K.put(i, 'box', 'iron', X(0), 6.8, Z(fz - 1.2), 14.2, .5, 3.8, 0, 0, 0, IRONT, .2);
      K.put(i, 'box', 'iron', X(-5.6), 3.4, Z(fz + .6), 1.6, 6.8, 1.0, 0, 0, 0, IRONT, .4); K.put(i, 'box', 'iron', X(5.6), 3.4, Z(fz + .6), 1.6, 6.8, 1.0, 0, 0, 0, IRONT, .4);
      K.put(i, 'disc', 'hot', X(0), 2.3, Z(fz + .55), 5.4, 1, 5.4, 0, PI / 2, 0, [2.2, 1.2, .5], 0);
      K.put(i, 'rim', 'iron', X(0), 2.3, Z(fz + .5), 5.8, 5.8, 5.8, 0, 0, 0, IRONT, .2); K.put(i, 'rim', 'iron', X(0), 2.3, Z(fz + .6), 6.4, 6.4, 6.4, 0, 0, 0, [.5, .46, .44], .2);
      for (var b = -3; b <= 3; b++) K.put(i, 'box', 'iron', X(b * .75), 2.3, Z(fz + .75), .14, 5.4, .14, 0, 0, 0, [.46, .42, .4], 0);
      K.spr(i, S.glow, X(0), 2.3, Z(fz + 1.3), 8, 8, [1.9, .85, .28], 1, 0, 1, 1); K.spr(i, S.glow, X(0), 2.3, Z(fz + 1.0), 4.4, 4.4, [2.2, 1.4, .7], .9, .3, 1, 1); K.spr(i, S.pool, X(0), .14, Z(fz + 5), 17, 11, [1.3, .5, .12], .7, 0, 1, 1);
      K.light(i, X(0), 3.0, Z(fz + 3), 0xff8a40, 34, 16, { scatter: .8, glow: 2.4, flicker: .12 }); K.heat(X(0), 2.4, Z(fz + 1.5), 6, 6, 1.4);
      for (var a = 0; a < 3; a++) { var an = (a - 1) * .7; K.dec(i, 15, X(Math.sin(an) * 6.5), Z(fz + 5.8 + Math.cos(an) * 3), 8, 8, an + PI / 2, [1.0, .34, .07], .42, 'glow', .06); }
      K.put(i, 'box', 'iron', X(0), .5, Z(-9), 4.8, 1.0, 1.6, 0, 0, 0, IRONT, .4); K.put(i, 'box', 'hot', X(0), 1.02, Z(-9), 4.2, .04, 1.2, 0, 0, 0, [1.3, .46, .1], 0);
      [-1, 1].forEach(function (s) { K.put(i, 'box', 'iron', X(s * 6.8), 1.1, Z(-7), 3.2, 2.2, 2.2, 0, 0, 0, IRONT, .5); K.put(i, 'cyl', 'iron', X(s * 6.8), 2.9, Z(-7), 1.2, 1.4, 1.2, 0, 0, 0, [.7, .64, .6], .3); K.spr(i, S.smoke, X(s * 6.8), 3.6, Z(-7), 1.2, 1.2, [.4, .32, .28], .25, R(), .12, 3); });
      [-1, 1].forEach(function (s) { for (var q = 0; q < 2; q++) { var x = s * (3.2 + q * 3.6); K.put(i, 'box', 'hot', X(x), .08, Z(fz + 3), .7, .04, 4, 0, 0, 0, [2, .7, .16], 0); } });
      // Ancient floor engraving stays below the live attack tells in contrast.
      K.dec(i, 5, X(0), Z(3), 13, 13, .2, [.52, .22, .08], .10, 'glow');
      decals({ cracks: 6, soot: 8, chips: 6, plates: 4, heat: 1, blood: 2 });
      brazierF(X(-5.2), Z(6), 1.2, 20); brazierF(X(5.2), Z(6), 1.2, 20);
      smoke(9, [.4, .3, .22], .26, .6, 4, 5.5); embers(60, -13, 13, -10, 10, 7, 1.4);
      // glowing bands on the furnace's iron buttresses; pipes feeding the colossal furnace
      [-1, 1].forEach(function (s) { for (var b = 0; b < 4; b++) HOT(s * 5.6, 1.4 + b * 1.4, fz + .6, 1.64, .1, 1.04, [1.3, .45, .1]); BAR(s * 3.4, 6.6, fz + 1.3, s * 3.4, 3.7, fz + .85, .22, IRONT); BAR(s * 3.4, 3.7, fz + .85, s * 2.9, 3.2, fz + .6, .22, IRONT); valve(s * 3.4, 5.0, fz + 1.55, 0, .45); });
    };
    var kFloor = K.floor, floorOpt = null;
    K.floor = function (id, rr, o) { floorOpt = o; return kFloor.apply(K, arguments); };
    ROOM[i]();
    K.floor = kFloor;
    corridor(); clutter(12);
  }
  B.ForgeRooms = { dress: dress, moodBase: moodBase, moodSpecs: moodSpecs };
}());
