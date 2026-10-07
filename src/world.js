(function () {
  'use strict';
  window.BABA = window.BABA || {};

  // Art direction per room (index = room id). Surface tints are linear multipliers of the scanned stone;
  // masks drive shader wear (ash, blood, wet, moss, bone dust, soot, polished route). Everything after the
  // surface line is light design read by lighting.js through world.atmosphereAt(x, z): distance fog, the low
  // mist layer (linear colour, density at the floor, height scale, glow from nearby fires, in-scatter, drift),
  // hemisphere fill, environment probe, the key light (colour, strength, direction from the player), the
  // environment rim, the characters' own rim/wrap/fill, and the display grade (lift, gain, saturation, S-curve,
  // split toning, vignette, bloom and exposure).
  var MOODS = [
    { // 0 Kül Eşiği — soot, ash and cold moonlight through the grate; two warm torches
      floor: [.84, .86, .92], wall: [.72, .75, .82], ash: .78, blood: .1, wet: .08, moss: 0, dust: 0, soot: .65, polish: .55,
      fog: '#06080c', fogDensity: .014, mist: [.022, .026, .036], mistA: .22, mistH: .75, mistGlow: .9, scatter: 1, wind: [.03, .02],
      sky: '#5d6f88', ground: '#15110d', hemi: 0.47, env: .2, key: '#9fb6e0', keyI: 1.15, keyDir: [-5, 19, -9], rim: '#7fa4de', rimI: .7,
      charRim: '#9ab8f0', charRimI: 1.31, rimDir: [-.3, .5, -1], rimWrap: 1, charFill: 0.119,
      lift: [.002, .003, .006], gain: [1.02, 1, .97], sat: .88, contrast: .16, shadowTint: [.9, .97, 1.12], highTint: [1.08, 1, .9],
      vignette: .55, vigColor: [0, .005, .012], bloom: .5, bloomTint: [1, .95, .9], exposure: 1.24 },
    { // 1 Zincir Nöbeti — wet iron, rust streaks and damp green-grey stone under a swinging lantern
      floor: [.76, .86, .84], wall: [.64, .75, .72], ash: .06, blood: .15, wet: .6, moss: .45, dust: 0, soot: .2, polish: .35,
      fog: '#050a0a', fogDensity: .016, mist: [.018, .028, .028], mistA: .24, mistH: .8, mistGlow: 1, scatter: 1.1, wind: [.02, -.03],
      sky: '#5c7f82', ground: '#11140f', hemi: 0.49, env: .24, key: '#9cc4c2', keyI: .85, keyDir: [-10, 17, -3], rim: '#80b8c4', rimI: .8,
      charRim: '#8fd0d8', charRimI: 1.19, rimDir: [.4, .5, -1], rimWrap: 1, charFill: 0.119,
      lift: [.001, .004, .004], gain: [.98, 1.02, 1], sat: .82, contrast: .16, shadowTint: [.88, 1.02, 1.04], highTint: [1.08, 1, .9],
      vignette: .55, vigColor: [0, .008, .008], bloom: .55, bloomTint: [1, .95, .85], exposure: 1.26 },
    { // 2 Çürüyenlerin Duası — bile, rot and jaundiced lamps in a sick fog
      floor: [.92, .87, .66], wall: [.86, .82, .6], ash: 0, blood: .45, wet: .6, moss: .85, dust: 0, soot: .3, polish: .3,
      fog: '#0a0a04', fogDensity: .017, mist: [.026, .028, .012], mistA: .26, mistH: .9, mistGlow: 1.1, scatter: 1.2, wind: [-.02, .02],
      sky: '#7c7d58', ground: '#15130a', hemi: 0.49, env: .2, key: '#c2c18f', keyI: .7, keyDir: [6, 18, -6], rim: '#a8b47a', rimI: .8,
      charRim: '#c8d890', charRimI: 1.12, rimDir: [.3, .5, -1], rimWrap: 1, charFill: 0.119,
      lift: [.004, .004, 0], gain: [1.02, 1.01, .88], sat: .78, contrast: .18, shadowTint: [.95, 1, .86], highTint: [1.05, 1.04, .86],
      vignette: .6, vigColor: [.008, .008, 0], bloom: .6, bloomTint: [.95, 1, .8], exposure: 1.26 },
    { // 3 Adak Ayini — blood, wax and candle-red; the carved star breathes while the rite lives
      floor: [.96, .78, .74], wall: [.9, .74, .7], ash: .12, blood: .6, wet: .3, moss: 0, dust: 0, soot: .6, polish: .6,
      fog: '#0c0405', fogDensity: .015, mist: [.024, .008, .007], mistA: .2, mistH: .7, mistGlow: 1.3, scatter: 1.15, wind: [.01, .02],
      sky: '#7a4a48', ground: '#1c0b09', hemi: 0.45, env: .18, key: '#c09088', keyI: .6, keyDir: [3, 19, -8], rim: '#d08a70', rimI: .9,
      charRim: '#ffc09a', charRimI: 1.44, rimDir: [0, .5, -1], rimWrap: 1.1, charFill: 0.136,
      lift: [.005, .001, .001], gain: [1.05, .97, .93], sat: .9, contrast: .2, shadowTint: [1.05, .94, .94], highTint: [1.06, .98, .86],
      vignette: .62, vigColor: [.02, 0, 0], bloom: .65, bloomTint: [1, .8, .7], exposure: 1.24 },
    { // 4 Kemik Geçidi — dry bone dust and pale cold light through the cracked vault
      floor: [1.0, .96, .88], wall: [.94, .92, .86], ash: .05, blood: .16, wet: .04, moss: 0, dust: .5, soot: .25, polish: .3,
      fog: '#0a0a0c', fogDensity: .015, mist: [.03, .03, .03], mistA: .2, mistH: .6, mistGlow: .9, scatter: 1, wind: [.03, .01],
      sky: '#7a808c', ground: '#15130e', hemi: 0.49, env: .22, key: '#c0cadc', keyI: 1.2, keyDir: [6, 19, -8], rim: '#a8b8d8', rimI: .8,
      charRim: '#c0d0f0', charRimI: 1.19, rimDir: [.3, .5, -1], rimWrap: 1, charFill: 0.119,
      lift: [.003, .003, .005], gain: [1, 1, 1], sat: .78, contrast: .16, shadowTint: [.94, .96, 1.08], highTint: [1.05, 1.01, .94],
      vignette: .55, vigColor: [.004, .004, .008], bloom: .5, bloomTint: [1, .95, .9], exposure: 1.26 },
    { // 5 Sessiz Şapel — warm, clean, candle gold under the altar window
      floor: [1.06, .97, .82], wall: [1.02, .93, .78], ash: 0, blood: 0, wet: .06, moss: 0, dust: .12, soot: .35, polish: .85,
      fog: '#0d0906', fogDensity: .012, mist: [.032, .022, .013], mistA: .14, mistH: .6, mistGlow: 1.2, scatter: .9, wind: [.01, .01],
      sky: '#8a7a60', ground: '#19120b', hemi: 0.5, env: .24, key: '#e0c8a0', keyI: .95, keyDir: [0, 18, -9], rim: '#e8b47c', rimI: .9,
      charRim: '#ffd29a', charRimI: 1.19, rimDir: [0, .6, -1], rimWrap: 1, charFill: 0.124,
      lift: [.005, .003, .001], gain: [1.05, 1, .9], sat: .92, contrast: .14, shadowTint: [1.02, .96, .9], highTint: [1.06, 1, .86],
      vignette: .5, vigColor: [.012, .006, 0], bloom: .65, bloomTint: [1, .9, .75], exposure: 1.2 },
    { // 6 Zincir Mahkemesi — black iron, blood-soaked stone, a cold oculus and four hanging fires
      floor: [.74, .69, .69], wall: [.64, .61, .63], ash: .3, blood: .5, wet: .1, moss: 0, dust: 0, soot: .75, polish: .2,
      fog: '#090306', fogDensity: .016, mist: [.022, .013, .014], mistA: .22, mistH: .8, mistGlow: 1.2, scatter: 1.2, wind: [.04, .02],
      sky: '#5e5064', ground: '#140908', hemi: 0.45, env: .2, key: '#a8acd0', keyI: 1, keyDir: [0, 20, -8], rim: '#b0bce8', rimI: 1,
      charRim: '#c8c0ff', charRimI: 1.31, rimDir: [0, .6, -1], rimWrap: 1.1, charFill: 0.119,
      lift: [.005, .001, .003], gain: [1.06, .95, .94], sat: .92, contrast: .2, shadowTint: [.95, .9, 1.08], highTint: [1.08, .96, .86],
      vignette: .6, vigColor: [.01, 0, .004], bloom: .52, bloomTint: [1, .85, .75], exposure: 1.24 }
  ];
  // The court's two scripted states, blended in by lighting.js: dormant before the executioner rises, rage in phase two.
  var COURT = {
    dormant: { hemi: .36, keyI: 1.05, fogDensity: .018, sat: .76, contrast: .24, vignette: .72, charRimI: 1.1, exposure: 1.1, mistA: .24 },
    // Phase two keeps key, fill and mist near neutral dark so the executioner and the crimson/gold tells stay readable;
    // the red lives in the environment rim, the vignette and the braziers. A cool character rim cuts him out of the floor.
    // lighting.js blends this in at most ~60 %.
    rage: { fog: '#0d0507', key: '#b4aecb', keyI: 1.05, rim: '#ff4a2a', rimI: 1.25, charRim: '#b4c4ff', charRimI: 1.55, gain: [1.05, .98, .97], sat: .84,
      contrast: .22, shadowTint: [1.02, .96, .99], vignette: .76, vigColor: [.07, 0, .004], bloom: .62, bloomTint: [1, .84, .72], mist: [.02, .012, .013], mistA: .22, sky: '#5e5064' }
  };

  var SURFACE_VERT_DECL = [
    '#ifdef G_SURFACE',
    'uniform float gRoomZ[7]; uniform vec3 gFloorTint[7]; uniform vec3 gWallTint[7]; uniform vec4 gMaskA[7]; uniform vec4 gMaskB[7];',
    'uniform vec4 gSpots[G_SPOTS]; uniform vec4 gFlags;',
    'varying vec4 gV0; varying vec4 gV2; varying vec3 gV3; varying vec4 gV4; varying vec4 gV5;',
    '#endif', ''].join('\n');
  var SURFACE_VERT_MAIN = [
    '#ifdef G_SURFACE',
    '{',
    '  vec4 gwp = vec4(transformed, 1.0); vec3 gnn = objectNormal; vec3 gsc = vec3(1.0); vec2 gid = modelMatrix[3].xz;',
    '  #ifdef USE_INSTANCING',
    '    gwp = instanceMatrix * gwp;',
    '    gsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));',
    '    gnn = mat3(instanceMatrix) * (gnn / (gsc * gsc));',
    '    gid += instanceMatrix[3].xz * 1.37 + instanceMatrix[3].y;',
    '  #endif',
    '  #ifdef USE_BATCHING',
    '    gwp = batchingMatrix * gwp;',
    '    gsc = vec3(length(batchingMatrix[0].xyz), length(batchingMatrix[1].xyz), length(batchingMatrix[2].xyz));',
    '    gnn = mat3(batchingMatrix) * (gnn / (gsc * gsc));',
    '    gid += batchingMatrix[3].xz * 1.37 + batchingMatrix[3].y;',
    '  #endif',
    '  gwp = modelMatrix * gwp; gnn = normalize(mat3(modelMatrix) * gnn);',
    '  float grnd = fract(sin(dot(gid, vec2(12.9898, 78.233))) * 43758.5453);',
    '  gV0 = vec4(gwp.xyz, grnd);',
    '  vec3 gln = abs(objectNormal);',
    '  gV2 = gln.y > 0.5 ? vec4(transformed.xz, gsc.xz) : (gln.x > 0.5 ? vec4(transformed.zy, gsc.zy) : vec4(transformed.xy, gsc.xy));',
    '  vec3 gft = gFloorTint[0]; vec3 gwt = gWallTint[0]; vec4 gma = gMaskA[0]; vec4 gmb = gMaskB[0];',
    '  for (int i = 1; i < 7; i++) {',
    '    float t = smoothstep(0.3, 0.7, clamp((gRoomZ[i - 1] - gwp.z) / (gRoomZ[i - 1] - gRoomZ[i]), 0.0, 1.0));',
    '    gft = mix(gft, gFloorTint[i], t); gwt = mix(gwt, gWallTint[i], t); gma = mix(gma, gMaskA[i], t); gmb = mix(gmb, gMaskB[i], t);',
    '  }',
    '  for (int s = 0; s < G_SPOTS; s++) {',
    '    vec4 sp = gSpots[s];',
    '    vec2 delta = gwp.xz - sp.xy; float dist2 = dot(delta, delta);',
    '    if (dist2 >= sp.z * sp.z) continue;',
    '    float w = 1.0 - smoothstep(sp.z * 0.3, sp.z, sqrt(dist2));',
    '    float kind = floor(sp.w); float amt = fract(sp.w) * 1.25 * w;',
    '    gma += amt * vec4(kind == 1.0 ? 1.0 : 0.0, kind == 0.0 ? 1.0 : 0.0, kind == 2.0 ? 1.0 : 0.0, kind == 3.0 ? 1.0 : 0.0);',
    '    gmb.xy += amt * vec2(kind == 4.0 ? 1.0 : 0.0, kind == 5.0 ? 1.0 : 0.0);',
    '  }',
    '  gV3 = mix(gwt, gft, clamp(gnn.y * 1.6 - 0.6, 0.0, 1.0));',
    '  gV4 = gma; gV5 = gmb;',
    '  if (gFlags.y > 0.5) {',
    '    vec2 guv; vec3 gan = abs(gnn);',
    '    if (gan.y > 0.6) {',
    '      guv = gwp.xz;',
    '      if (gFlags.z > 0.5) {',
    '        float gk = floor(grnd * 4.0);',
    '        guv = gk < 1.0 ? guv : (gk < 2.0 ? vec2(-guv.y, guv.x) : (gk < 3.0 ? -guv : vec2(guv.y, -guv.x)));',
    '      }',
    '    } else guv = gan.x > gan.z ? vec2(gwp.z, gwp.y) : vec2(gwp.x, gwp.y);',
    '    guv = guv * gFlags.w + vec2(grnd * 7.13, fract(grnd * 91.7) * 3.71);',
    '    #ifdef USE_MAP',
    '      vMapUv = guv;',
    '    #endif',
    '    #ifdef USE_NORMALMAP',
    '      vNormalMapUv = guv;',
    '    #endif',
    '    #ifdef USE_ROUGHNESSMAP',
    '      vRoughnessMapUv = guv;',
    '    #endif',
    '    #ifdef USE_METALNESSMAP',
    '      vMetalnessMapUv = guv;',
    '    #endif',
    '    #ifdef USE_AOMAP',
    '      vAoMapUv = guv;',
    '    #endif',
    '  }',
    '}',
    '#endif'].join('\n');
  var SURFACE_FRAG_DECL = [
    '#ifdef G_SURFACE',
    'uniform sampler2D gNoise; uniform vec4 gFlags;',
    'varying vec4 gV0; varying vec4 gV2; varying vec3 gV3; varying vec4 gV4; varying vec4 gV5;',
    'float gCover(float a, float n) { return smoothstep(1.0 - a, 1.2 - a, n); }',
    '#endif', ''].join('\n');
  var SURFACE_FRAG_ALBEDO = [
    '#ifdef G_SURFACE',
    '  float gWaH = 0.0;',
    '  vec3 gNw = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);',
    '  float gUp = clamp(gNw.y * 1.6 - 0.6, 0.0, 1.0); float gSide = 1.0 - gUp; vec3 gP = gV0.xyz;',
    '  diffuseColor.rgb *= gV3;',
    '  #ifdef G_LOW',
    '    vec4 gn1 = vec4(0.5); vec4 gn2 = vec4(0.5);',
    '  #else',
    '    vec4 gn1 = texture2D(gNoise, gP.xz * 0.061 + vec2(gP.y * 0.043, gP.y * 0.029));',
    '    vec4 gn2 = texture2D(gNoise, gP.xz * 0.23 + vec2(0.37 + gP.y * 0.17, 0.61));',
    '  #endif',
    '  float gJoint = 0.0;',
    '  if (gFlags.x > 0.5) {',
    '    vec2 gEd = (0.5 - abs(gV2.xy)) * gV2.zw;',
    '    gJoint = 1.0 - smoothstep(0.0, 0.05 + gn2.b * 0.08, min(gEd.x, gEd.y));',
    '  }',
    '  float gBlot = gn1.r * 0.65 + gn2.g * 0.35;',
    '  float gDamp = gSide * (1.0 - smoothstep(0.05, 0.9 + gn1.g * 0.9, gP.y));',
    '  float gSoot = gSide * smoothstep(1.9, 4.6, gP.y + gn2.r * 0.9) * clamp(0.2 + gV5.y, 0.0, 1.2);',
    '  float gGrime = max(gJoint * 0.8, smoothstep(0.5, 0.95, gBlot) * 0.28);',
    '  diffuseColor.rgb *= clamp(1.0 - gGrime * 0.5 - gDamp * 0.42 - gSoot * 0.6, 0.0, 1.0);',
    '  float gPolish = gUp * (1.0 - smoothstep(0.8, 2.7, abs(gP.x))) * gV5.z * (1.0 - gJoint);',
    '  diffuseColor.rgb *= 1.0 + gPolish * 0.14;',
    '  float gWetA = clamp(gV4.z, 0.0, 1.0);',
    '  float gWet = gWetA * max(gCover(gWetA * 0.75, gBlot), max(gJoint * 0.8, gDamp));',
    '  float gAsh = gUp * gCover(clamp(gV4.x, 0.0, 1.0) * 0.7, gn1.g * 0.55 + gn2.r * 0.45) * (1.0 - gJoint * 0.4);',
    '  float gBloodA = clamp(gV4.y, 0.0, 1.0);',
    '  float gBlood = max(gCover(gBloodA * 0.62, gBlot * 0.75 + gn2.b * 0.25) * gUp, gJoint * gUp * smoothstep(0.1, 0.55, gBloodA));',
    '  float gMoss = gCover(clamp(gV4.w, 0.0, 1.0) * 0.85, gn2.g * 0.6 + gn1.b * 0.4) * clamp(gJoint + gDamp + gSide * 0.3, 0.0, 1.0);',
    '  float gDust = gUp * gCover(clamp(gV5.x, 0.0, 1.0) * 0.6, gn1.b * 0.5 + gn2.r * 0.5) * (1.0 - gJoint * 0.3);',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.096, 0.09) * (0.8 + gn2.b * 0.4), gAsh * 0.72);',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.18, 0.145) * (0.85 + gn2.b * 0.3), gDust * 0.55);',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.028, 0.034, 0.011), gMoss * 0.75);',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.0035, 0.0028) * (0.75 + gn2.g * 0.5), gBlood * 0.88);',
    '  diffuseColor.rgb *= 1.0 - gWet * 0.3;',
    // ajan:world-a — temple stone identity (amber-black limestone): a broad two-scale tonal field breaks the tile repeat,
    // hairline cracks follow a noise ridge (darkened, and fed to the normal as relief), bone-pale dust settles in the joints.
    '  #if defined(G_WA) && !defined(G_LOW)',   // low quality (iPad saver) keeps the plain stone
    '    vec4 gm1 = texture2D(gNoise, gP.xz * 0.013 + vec2(0.17, 0.53) + gP.y * 0.011);',
    '    float gMac = gm1.g * 0.6 + gm1.r * 0.4;',
    '    diffuseColor.rgb *= mix(vec3(0.78, 0.8, 0.86), vec3(1.12, 0.96, 0.78), smoothstep(0.28, 0.72, gMac)) * (0.86 + 0.28 * gn1.b);',
    '    vec4 gc = texture2D(gNoise, gP.xz * 0.37 + gP.y * vec2(0.31, 0.17) + vec2(gm1.b * 0.2));',
    '    float gCrk = (1.0 - smoothstep(0.0, 0.03 + gn2.g * 0.02, abs(gc.r - 0.5))) * smoothstep(0.5, 0.74, gm1.b);',
    '    diffuseColor.rgb *= 1.0 - gCrk * 0.6;',
    '    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.31, 0.25), gJoint * gUp * 0.22 * smoothstep(0.4, 0.8, gn2.r));',
    '    gWaH = gCrk + gJoint * 0.5;',
    '  #endif',
    '#endif'].join('\n');
  var SURFACE_FRAG_ROUGH = [
    '#ifdef G_SURFACE',
    '  roughnessFactor = mix(roughnessFactor, 0.24, gWet * 0.82);',
    '  roughnessFactor = mix(roughnessFactor, 0.34, gBlood * 0.85);',
    '  roughnessFactor = mix(roughnessFactor, 1.0, max(gAsh, gDust) * 0.85);',
    '  roughnessFactor *= 1.0 - gPolish * 0.35;',
    '#endif'].join('\n');
  var SURFACE_FRAG_NORMAL = [
    '#ifdef G_SURFACE',
    '  #if defined(G_WA) && !defined(G_LOW)',
    '  { float gh = -gWaH * 0.05 + (gn2.r + gn1.g - 1.0) * 0.012;',
    '    vec3 gsx = dFdx(-vViewPosition), gsy = dFdy(-vViewPosition); vec3 gr1 = cross(gsy, normal), gr2 = cross(normal, gsx); float gdet = dot(gsx, gr1);',
    '    vec3 ggrad = sign(gdet) * (dFdx(gh) * gr1 + dFdy(gh) * gr2); normal = normalize(abs(gdet) * normal - ggrad); }',
    '  #endif',
    '  normal = normalize(mix(normal, gGeoN, clamp(gWet * 0.7 + gBlood * 0.6 + (gAsh + gDust) * 0.35, 0.0, 0.9)));',
    '#endif'].join('\n');

  BABA.World = {
    build: function (scene, options) {
      var T = THREE, MAT = BABA.Materials;
      var multiDraw = !!(options && options.multiDraw && T.BatchedMesh);
      var root = new T.Group();
      var isDisposed = false;
      root.name = KabirI18n.t('Kurban Tapınağı');
      scene.add(root);

      var rooms = [
        { id: 0, name: KabirI18n.t('Kül Eşiği'), x: 0, z: 4, w: 18, d: 20 },
        { id: 1, name: KabirI18n.t('Zincir Avlusu'), x: -2, z: -21, w: 22, d: 22 },
        { id: 2, name: KabirI18n.t('Çürüyen Revir'), x: 1, z: -47, w: 24, d: 22 },
        { id: 3, name: KabirI18n.t('Adak Salonu'), x: 0, z: -74, w: 26, d: 24 },
        { id: 4, name: KabirI18n.t('Kemik Geçidi'), x: -1, z: -101, w: 22, d: 22 },
        { id: 5, name: KabirI18n.t('Sessiz Şapel'), x: 0, z: -125, w: 18, d: 18 },
        { id: 6, name: KabirI18n.t('Zincir Mahkemesi'), x: 0, z: -155, w: 30, d: 32 }
      ];
      var spawn = { x: 0, z: 8 };
      var checkpoint = { x: 0, z: -128 };
      var bossSpawn = { x: 0, z: -160 };
      var encounters = [
        { id: 'threshold', room: 0, name: KabirI18n.t('Eşikteki Mahkûmlar'), clearText: KabirI18n.t('İlk mühür kırıldı. Zincir Avlusu seni bekliyor.'), spawns: [
          { type: 'prisoner', x: -3.5, z: 0 },
          { type: 'prisoner', x: 3.5, z: -2.5 },
          { type: 'prisoner', x: 0, z: -4 }
        ] },
        { id: 'courtyard', room: 1, name: KabirI18n.t('Zincir Nöbeti'), clearText: KabirI18n.t('Avlunun mührü açıldı. Çürüyen Revir’e ilerle.'), spawns: [
          { type: 'guard', x: 0, z: -18 },
          { type: 'prisoner', x: -4.5, z: -20 },
          { type: 'prisoner', x: 4.5, z: -23 },
          { type: 'guard', x: -3, z: -28 },
          { type: 'prisoner', x: 3.5, z: -28 }
        ] },
        { id: 'infirmary', room: 2, name: KabirI18n.t('Çürüyenlerin Duası'), clearText: KabirI18n.t('Revirin mührü kırıldı. Adak Salonu artık açık.'), spawns: [
          { type: 'prisoner', x: -3.5, z: -40 },
          { type: 'carrier', x: 4.8, z: -44 },
          { type: 'prisoner', x: -4.5, z: -47 },
          { type: 'stalker', x: 5, z: -51 },
          { type: 'guard', x: 0, z: -49 },
          { type: 'prisoner', x: -3.5, z: -54 },
          { type: 'carrier', x: 3, z: -55 }
        ] },
        { id: 'offering', room: 3, name: KabirI18n.t('Adak Ayini'), clearText: KabirI18n.t('Ayin bozuldu. Kemik Geçidi’ne giden mühür açıldı.'), spawns: [
          { type: 'guard', x: -3.5, z: -67 },
          { type: 'guard', x: 3.5, z: -67 },
          { type: 'cultist', x: 0, z: -74 },
          { type: 'prisoner', x: -5, z: -72 },
          { type: 'prisoner', x: 5, z: -73 },
          { type: 'stalker', x: -4.5, z: -77 },
          { type: 'cultist', x: 3.5, z: -80 },
          { type: 'guard', x: 0, z: -82 }
        ] },
        { id: 'ossuary', room: 4, name: KabirI18n.t('Son Alay'), clearText: KabirI18n.t('Son alay düştü. Şapeldeki mühre yaklaş; yaralarını kapat.'), spawns: [
          { type: 'stalker', x: -3.8, z: -95 },
          { type: 'prisoner', x: 3.5, z: -95 },
          { type: 'guard', x: 0, z: -100 },
          { type: 'carrier', x: -4.5, z: -104 },
          { type: 'cultist', x: 4.5, z: -105 },
          { type: 'stalker', x: -3, z: -108 },
          { type: 'guard', x: 2.8, z: -109 }
        ] },
        { id: 'executioner', room: 6, name: KabirI18n.t('Zincir Celladı'), spawns: [
          { type: 'boss', x: bossSpawn.x, z: bossSpawn.z }
        ] }
      ];

      var seed = 41967;
      function rand() {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      }
      function between(a, b) { return a + rand() * (b - a); }
      // Static batches are split into one chunk per room (boundaries halfway between room centres) so
      // frustum and shadow culling can skip rooms the camera cannot see.
      var chunkEdges = [];
      for (var ce = 1; ce < rooms.length; ce++) chunkEdges.push((rooms[ce - 1].z + rooms[ce].z) / 2);
      function chunkOf(z) { var c = 0; while (c < chunkEdges.length && z < chunkEdges[c]) c++; return c; }
      function coarseChunk(z) { return 100 + Math.floor(chunkOf(z) / 2); }

      var geometries = {
        box: new T.BoxGeometry(1, 1, 1),
        round: new T.CylinderGeometry(1, 1, 1, 12),
        octagon: new T.CylinderGeometry(1, 1, 1, 8),
        pole: new T.CylinderGeometry(1, 1, 1, 6),
        cone: new T.ConeGeometry(1, 1, 8),
        capital: new T.LatheGeometry([new T.Vector2(.66, -.34), new T.Vector2(.68, -.21), new T.Vector2(.76, -.11),
          new T.Vector2(.91, .06), new T.Vector2(.96, .2), new T.Vector2(.96, .32)], 8),
        ball: new T.SphereGeometry(1, 10, 7),
        knob: new T.SphereGeometry(1, 6, 4),
        link: new T.TorusGeometry(0.65, 0.13, 5, 10),
        rib: new T.TorusGeometry(0.28, 0.025, 4, 12, Math.PI),
        plane: new T.PlaneGeometry(1, 1),
        bowl: new T.LatheGeometry([new T.Vector2(.02, -.3), new T.Vector2(.5, -.26), new T.Vector2(.86, -.06), new T.Vector2(1, .12),
          new T.Vector2(.92, .14), new T.Vector2(.8, 0)], 12)
      };
      // Each slab has its own chipped outline and a real bevel. Broad light
      // catches the edges instead of reading an uninterrupted square grid.
      for (var slabVariant = 0; slabVariant < 4; slabVariant++) {
        var shape = new T.Shape(), cut = between(0.035, 0.11);
        var outline = [[-.5 + cut, -.5], [-.11, -.5 + rand() * .025], [.5 - cut, -.5], [.5, -.5 + cut],
          [.5 - rand() * .035, .1], [.5, .5 - cut], [.5 - cut, .5], [.13, .5 - rand() * .035],
          [-.5 + cut, .5], [-.5, .5 - cut], [-.5 + rand() * .025, -.1], [-.5, -.5 + cut]];
        outline.forEach(function (p, i) { if (i) shape.lineTo(p[0], p[1]); else shape.moveTo(p[0], p[1]); });
        shape.closePath();
        var slabGeometry = new T.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: true, bevelSize: .017, bevelThickness: .045, bevelSegments: 1, steps: 1 });
        slabGeometry.rotateX(-Math.PI / 2); slabGeometry.translate(0, -.5, 0);
        geometries['slab' + slabVariant] = slabGeometry;
      }

      // three.js keeps one vertex-array object per (geometry, program). Batches that share a geometry but carry their own
      // instance matrices made it re-declare every attribute on each draw (about 2000 vertexAttribPointer calls a frame).
      // Each instanced batch therefore gets its own BufferGeometry object over the SAME vertex buffers: same picture, no re-binding.
      var ownedGeometries = [];
      function ownGeometry(g) {
        var o = new T.BufferGeometry();
        for (var name in g.attributes) o.setAttribute(name, g.attributes[name]);
        if (g.index) o.setIndex(g.index);
        g.groups.forEach(function (gr) { o.addGroup(gr.start, gr.count, gr.materialIndex); });
        if (g.boundingSphere) o.boundingSphere = g.boundingSphere.clone();
        if (g.boundingBox) o.boundingBox = g.boundingBox.clone();
        o.drawRange.start = g.drawRange.start; o.drawRange.count = g.drawRange.count;
        ownedGeometries.push(o); return o;
      }
      // ---- surfaces -----------------------------------------------------------------------------------
      var textures = [];
      var noiseMap = MAT.noise(), rippleMap = MAT.rippleNormal(), decalMap = MAT.decals(), CELL = MAT.decalCells;
      var floorSurface = MAT.createSurface('floor', textures);
      var wallSurface = MAT.createSurface('masonry', textures);
      var rustSurface = MAT.createSurface('rust', textures, 1.4);
      var linenSurface = MAT.createSurface('linen', textures, 2.5);
      var woodSurface = MAT.createSurface('wood', textures, 1);

      var spots = [];
      var SPOT_MAX = 24;
      function spot(x, z, radius, kind, amount) { if (spots.length < SPOT_MAX) spots.push(new T.Vector4(x, z, radius, kind + Math.min(.79, amount * .8))); }
      var G = {
        gNoise: { value: noiseMap },
        gRoomZ: { value: rooms.map(function (r) { return r.z; }) },
        gFloorTint: { value: MOODS.map(function (m) { return new T.Vector3().fromArray(m.floor); }) },
        gWallTint: { value: MOODS.map(function (m) { return new T.Vector3().fromArray(m.wall); }) },
        gMaskA: { value: MOODS.map(function (m) { return new T.Vector4(m.ash, m.blood, m.wet, m.moss); }) },
        gMaskB: { value: MOODS.map(function (m) { return new T.Vector4(m.dust, m.soot, m.polish, 0); }) },
        gSpots: { value: [] }
      };
      for (var sp0 = 0; sp0 < SPOT_MAX; sp0++) G.gSpots.value.push(new T.Vector4(9999, 9999, .001, 0));
      var qualityLevel = 2, lowShader = false;
      var surfaceMaterials = [];
      function surfaceHook(shader) {
        for (var k in G) shader.uniforms[k] = G[k];
        shader.uniforms.gFlags = { value: this.userData.gFlags };
        shader.vertexShader = SURFACE_VERT_DECL + shader.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n' + SURFACE_VERT_MAIN);
        shader.fragmentShader = SURFACE_FRAG_DECL + shader.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + SURFACE_FRAG_ALBEDO)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + SURFACE_FRAG_ROUGH)
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef G_SURFACE\nvec3 gGeoN = normal;\n#endif')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + SURFACE_FRAG_NORMAL);
      }
      function surface(m, opts) {
        // Variants differ only by this uniform, so every stone material shares a few shader programs.
        m.defines = Object.assign(m.defines || {}, { G_SURFACE: '', G_SPOTS: SPOT_MAX });
        if (BABA.WorldATemple && BABA.WorldATemple.active && !/[?&]nomat\b/.test(location.search)) m.defines.G_WA = '';   // ajan:world-a stone layers (?nomat: off)
        m.userData.gFlags = new T.Vector4(opts.slab ? 1 : 0, opts.project ? 1 : 0, opts.rotate ? 1 : 0, opts.tile || .4);
        m.userData.surfaceOpts = opts;
        m.onBeforeCompile = surfaceHook;
        m.customProgramCacheKey = function () { return 'kara-surface'; };
        surfaceMaterials.push(m);
        return m;
      }
      function cloneSurface(m) { var c = m.clone(); surface(c, m.userData.surfaceOpts); if (m.defines.G_LOW !== undefined) c.defines.G_LOW = ''; return c; }
      function linear(r, g, b) { return new T.Color().setRGB(r, g, b, T.LinearSRGBColorSpace); }
      function material(color, extra) {
        return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.94, metalness: 0 }, extra || {}));
      }
      var materials = {};
      // Stone family: one scanned rock for flagstones, one for masonry; per-room colour comes from the shader.
      [['floor', linear(2.25, 2.25, 2.25), floorSurface, { roughness: .9, aoMapIntensity: .55, normalScale: new T.Vector2(.9, .9) }, 1 / 2.3],
        ['stone', linear(.44, .44, .44), wallSurface, { roughness: .95, aoMapIntensity: .6, normalScale: new T.Vector2(1, 1) }, 1 / 2.6],
        ['pale', linear(.6, .59, .56), wallSurface, { roughness: .93, aoMapIntensity: .5, normalScale: new T.Vector2(.8, .8) }, 1 / 2.2],
        ['dark', linear(.24, .24, .245), wallSurface, { roughness: .96, aoMapIntensity: .6, normalScale: new T.Vector2(.85, .85) }, 1 / 2.6]
      ].forEach(function (d) {
        var props = Object.assign({}, d[3], d[2]);
        materials[d[0]] = surface(material(d[1], props), { slab: true, project: true, rotate: d[0] === 'floor', tile: d[4] });
        materials[d[0] + '~p'] = surface(material(d[1], props), { project: true, rotate: d[0] === 'floor', tile: d[4] });
        materials[d[0] + '~c'] = surface(material(d[1], props), { tile: d[4] });
      });
      materials.floor.userData.surface = 'floor'; materials.stone.userData.surface = 'stone';
      var wetReflection = (function () {
        // A muted broken-vault reflection makes shallow water and fresh blood read as wet surfaces.
        var faces = [];
        for (var face = 0; face < 6; face++) {
          var rc = document.createElement('canvas'); rc.width = rc.height = 64;
          var rx = rc.getContext('2d'), rd = rx.createImageData(64, 64);
          for (var yy = 0; yy < 64; yy++) for (var xx = 0; xx < 64; xx++) {
            var u = xx / 63, v = yy / 63, idx = (yy * 64 + xx) * 4;
            var sky = Math.max(0, 1 - Math.abs(u - .52 - face * .017) * 4) * Math.max(0, .73 - v) * (face === 2 ? 1.25 : .55);
            var val = (12 + sky * 150) * (Math.sin(u * 33 + face) > .81 ? .32 : 1);
            rd.data[idx] = val * .86; rd.data[idx + 1] = val * .88; rd.data[idx + 2] = val; rd.data[idx + 3] = 255;
          }
          rx.putImageData(rd, 0, 0); faces.push(rc);
        }
        var cube = new T.CubeTexture(faces); cube.colorSpace = T.SRGBColorSpace; cube.needsUpdate = true; textures.push(cube); return cube;
      }());
      Object.assign(materials, {
        foundation: material(linear(.012, .011, .011), { roughness: 1 }),
        iron: material(linear(.05, .052, .056), { metalness: .82, roughness: .62, roughnessMap: rustSurface.roughnessMap, normalMap: rustSurface.normalMap, normalScale: new T.Vector2(.5, .5), aoMap: rustSurface.aoMap, aoMapIntensity: .4 }),
        rust: material(linear(.7, .66, .62), Object.assign({ metalness: 1, roughness: 1, normalScale: new T.Vector2(.7, .7), aoMapIntensity: .45 }, rustSurface)),
        brass: material(linear(.22, .14, .06), { metalness: .8, roughness: .55, roughnessMap: rustSurface.roughnessMap, normalMap: rustSurface.normalMap, normalScale: new T.Vector2(.25, .25) }),
        bone: material(linear(1.25, 1.12, .9), { roughness: .78, map: wallSurface.map, normalMap: rippleMap, normalScale: new T.Vector2(.35, .35) }),
        wood: material(linear(.62, .56, .5), Object.assign({ roughness: .9, normalScale: new T.Vector2(.7, .7), aoMapIntensity: .4 }, woodSurface)),
        charred: material(linear(.09, .08, .075), Object.assign({ roughness: .95, normalScale: new T.Vector2(.9, .9), emissive: '#2a0c02', emissiveIntensity: .0 }, woodSurface)),
        cloth: material(linear(.34, .045, .04), Object.assign({ side: T.DoubleSide, roughness: .97, normalScale: new T.Vector2(.5, .5), aoMapIntensity: .25 }, linenSurface)),
        shroud: material(linear(.62, .55, .44), Object.assign({ side: T.DoubleSide, roughness: .98, normalScale: new T.Vector2(.5, .5), aoMapIntensity: .25 }, linenSurface)),
        wax: material(linear(.66, .58, .42), { roughness: .5, emissive: '#3a1d06', emissiveIntensity: .35, normalMap: rippleMap, normalScale: new T.Vector2(.15, .15) }),
        crack: material(linear(.008, .008, .008)),
        groove: new T.MeshPhysicalMaterial({ color: linear(.05, .006, .005), roughness: .42, metalness: 0, clearcoat: .7, clearcoatRoughness: .2, envMap: wetReflection, envMapIntensity: .35 }),
        blood: new T.MeshPhysicalMaterial({ color: linear(.05, .004, .003), roughness: .38, metalness: 0, clearcoat: .35, clearcoatRoughness: .35, transparent: true, opacity: .9, depthWrite: false, envMap: wetReflection, envMapIntensity: .3 }),
        water: new T.MeshPhysicalMaterial({ color: linear(.02, .024, .024), metalness: .03, roughness: .3, clearcoat: .1, clearcoatRoughness: .4, transparent: true, opacity: .62, depthWrite: false, normalMap: rippleMap, normalScale: new T.Vector2(.08, .08), envMap: wetReflection, envMapIntensity: .22 }),
        fire: material('#ffad49', { emissive: '#ff6b16', emissiveIntensity: 3.2, roughness: 0.5 }),
        hot: material('#ffe6a1', { emissive: '#ffd07b', emissiveIntensity: 3.5 }),
        ember: material(linear(.2, .04, .02), { emissive: '#ff3c0a', emissiveIntensity: 1.6, roughness: .9 }),
        sickEmber: material(linear(.05, .08, .02), { emissive: '#7fbf2a', emissiveIntensity: 1.3, roughness: .9 }),
        sanctuary: material(linear(.5, .45, .33), { emissive: '#a38b52', emissiveIntensity: 0.35, metalness: 0.45, roughness: .5 })
      });
      // Identity samplers: iron, brass and bone lack some of the scanned ARM / albedo maps. A 1x1 white map multiplies by exactly 1 (albedo, AO,
      // roughness, metalness), but gives them the same sampler set as rust / wood, so they share one shader program (fewer program switches).
      var whiteMap = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, T.RGBAFormat); whiteMap.name = 'kara:white'; whiteMap.needsUpdate = true; textures.push(whiteMap);
      if (!/[?&]nowhite/.test(location.search)) ['iron', 'brass', 'bone'].forEach(function (k) {
        var m = materials[k]; if (!m.map) m.map = whiteMap; if (!m.aoMap) m.aoMap = whiteMap; if (!m.roughnessMap) m.roughnessMap = whiteMap; if (!m.metalnessMap) m.metalnessMap = whiteMap;
      });
      // Fresh blood poured into the offering hall's carved star: brighter, faintly lit from within by its sheen.
      // (Only there: red rings elsewhere could be mistaken for attack warnings.)
      materials.bloodGroove = materials.groove.clone();
      materials.bloodGroove.color.copy(linear(.11, .006, .004)); materials.bloodGroove.emissive.copy(linear(.014, .001, .0006)); materials.bloodGroove.roughness = .4;
      // Decals share one procedural atlas; each instance selects its cell. Matte decals for ash/soot/grime,
      // wet decals for fresh blood and water, additive decals for fake light pools.
      function decalHook(shader) {
        shader.vertexShader = 'attribute vec2 gCell;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = uv * 0.25 + gCell;\n#endif');
        // The atlas has broad empty margins. Discard only exactly transparent texels before lighting;
        // they contribute no colour or depth, but otherwise still run every PBR light and shadow lookup.
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\nif (diffuseColor.a <= 0.0) discard;');
      }
      function decalMaterial(base, extra) {
        var m = new base(Object.assign({ map: decalMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, extra));
        m.onBeforeCompile = decalHook; m.customProgramCacheKey = function () { return 'kara-decal'; };
        return m;
      }
      materials.decalMatte = decalMaterial(T.MeshStandardMaterial, { roughness: .96, metalness: 0 });
      materials.decalWet = decalMaterial(T.MeshStandardMaterial, { roughness: .52, metalness: 0 });
      materials.decalGlow = decalMaterial(T.MeshBasicMaterial, { blending: T.AdditiveBlending, toneMapped: false, fog: false });

      // Living flames: instanced camera-facing cards, noise-shaped in the shader (no textures).
      var flameUniforms = { time: { value: 0 } };
      // MSAA edge fragments may interpolate UVs just outside the card; fractional powers need a bounded domain.
      function flameMaterial(core, palette) {
        return new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
          uniforms: { time: flameUniforms.time, core: { value: core ? 1 : 0 }, cA: { value: new T.Vector3().fromArray(palette[0]) },
            cB: { value: new T.Vector3().fromArray(palette[1]) }, cC: { value: new T.Vector3().fromArray(palette[2]) } },
          vertexShader: 'varying vec2 flameUV; varying float flamePhase; void main(){flameUV=uv; mat4 m=modelMatrix;\n#ifdef USE_INSTANCING\nm=modelMatrix*instanceMatrix;\n#endif\nflamePhase=m[3].x*1.71+m[3].z*.43+m[3].y*.37; vec4 p=viewMatrix*vec4(m[3].xyz,1.); p.xy+=position.xy*vec2(length(m[0].xyz),length(m[1].xyz)); gl_Position=projectionMatrix*p;}',
          fragmentShader: 'precision highp float; uniform float time; uniform float core; uniform vec3 cA; uniform vec3 cB; uniform vec3 cC; varying vec2 flameUV; varying float flamePhase; float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);} void main(){vec2 uv=clamp(flameUV,vec2(0.0),vec2(1.0)); float t=time*1.7+flamePhase; float n=noise(vec2(uv.x*5.,uv.y*7.-t*2.)); float n2=noise(vec2(uv.x*11.+1.7,uv.y*15.-t*3.7)); float centre=.5+sin(uv.y*7.-t*2.2)*uv.y*.085+(n-.5)*uv.y*.13; float width=mix(.30,.018,pow(uv.y,.73))+(n-.5)*.09; float body=1.-smoothstep(width*.42,width,abs(uv.x-centre)); float edge=smoothstep(.0,.10,uv.y)*(1.-smoothstep(.72,1.,uv.y)); float grain=.68+n*.23+n2*.09; float alpha=body*edge*grain; float heat=pow(body,3.)*pow(1.-uv.y,.75); vec3 colour=mix(cA,cB,heat); colour=mix(colour,cC,pow(heat,4.)*.62); alpha*=mix(.79,.42,core); if(alpha<.006)discard; gl_FragColor=vec4(colour,alpha);}' });
      }
      var FIRE = [[.82, .105, .008], [1.28, .65, .12], [1.55, 1.3, .77]], SICK = [[.12, .42, .03], [.55, 1.05, .16], [1.05, 1.35, .7]];
      materials.livingFlame = flameMaterial(false, FIRE); materials.flameCore = flameMaterial(true, FIRE);
      materials.sickFlame = flameMaterial(false, SICK); materials.sickCore = flameMaterial(true, SICK);
      // The court's braziers have their own flame colours so phase two can turn them to blood fire.
      materials.courtFlame = flameMaterial(false, FIRE); materials.courtCore = flameMaterial(true, FIRE);
      var RAGE = [[.7, .02, .004], [1.45, .22, .04], [1.7, .72, .34]];
      function tintFlames(t) {
        [materials.courtFlame, materials.courtCore].forEach(function (m) {
          ['cA', 'cB', 'cC'].forEach(function (k, i) { m.uniforms[k].value.set(FIRE[i][0] + (RAGE[i][0] - FIRE[i][0]) * t, FIRE[i][1] + (RAGE[i][1] - FIRE[i][1]) * t, FIRE[i][2] + (RAGE[i][2] - FIRE[i][2]) * t); });
        });
      }
      // Decals and puddles take the full floor mist (lighting.js), so they never float above it.
      [materials.decalMatte, materials.decalWet, materials.blood, materials.water].forEach(function (m) { m.defines = Object.assign(m.defines || {}, { KARA_FULLMIST: '' }); });
      // Standing water and fresh blood are near-mirrors: fire and moonlight glint in them.
      Object.assign(materials.blood, { roughness: .2, clearcoat: .65, clearcoatRoughness: .12, envMapIntensity: .45 });
      Object.assign(materials.water, { roughness: .09, clearcoat: .6, clearcoatRoughness: .06, envMapIntensity: .4, opacity: .7 });
      // (ajan:models) the puddle ripples drift (own copy of the shared ripple map), so the fire and moon glints in the water shimmer
      if (rippleMap && rippleMap.clone) { var flowMap = rippleMap.clone(); flowMap.wrapS = flowMap.wrapT = T.RepeatWrapping; flowMap.needsUpdate = true; materials.water.normalMap = flowMap; materials.water.normalScale.set(.14, .14); materials.water.userData.flow = flowMap; }
      // Candle wax glows warmest just under the flame (per instance: the pole spans y -0.5..0.5).
      materials.wax.onBeforeCompile = function (sh) {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWaxH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaxH = position.y + 0.5;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWaxH;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.25 + 3.2 * pow(clamp(vWaxH, 0.0, 1.0), 4.0);');
      };
      materials.wax.customProgramCacheKey = function () { return 'kara-wax'; };

      var uniqueMaterials = [], uniqueGeometries = [];
      var batches = Object.create(null);
      var tmp = new T.Object3D();
      var tmpColor = new T.Color();
      var decorationBatches = [];
      var allBatches = [];
      var occluders = [];
      var chunkBias = 0; // ajan:world-a: side crypts get their own batches (culled apart from the main hall beside them)
      function put(geo, mat, x, y, z, sx, sy, sz, rx, ry, rz, level, color) {
        level = level || 0;
        var chunk = (level ? coarseChunk(z) : chunkOf(z)) + chunkBias, key = geo + ':' + mat + ':' + level + ':' + chunk;
        if (!batches[key]) batches[key] = { geo: geo, mat: mat, level: level, transforms: [], colors: [] };
        tmp.position.set(x, y, z);
        tmp.rotation.set(rx || 0, ry || 0, rz || 0);
        tmp.scale.set(sx, sy, sz);
        tmp.updateMatrix();
        batches[key].transforms.push(tmp.matrix.clone());
        batches[key].colors.push(color || null);
      }
      function box(mat, x, y, z, w, h, d, angle, level, color) {
        put('box', mat, x, y, z, w, h, d, 0, angle || 0, 0, level, color);
      }
      function rod(mat, a, b, radius, level) {
        var start = new T.Vector3(a[0], a[1], a[2]);
        var end = new T.Vector3(b[0], b[1], b[2]);
        var delta = end.sub(start);
        tmp.position.copy(start).addScaledVector(delta, 0.5);
        tmp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
        tmp.scale.set(radius, delta.length(), radius);
        tmp.updateMatrix();
        var key = 'pole:' + mat + ':' + (level || 0) + ':' + ((level ? coarseChunk(tmp.position.z) : chunkOf(tmp.position.z)) + chunkBias);
        if (!batches[key]) batches[key] = { geo: 'pole', mat: mat, level: level || 0, transforms: [], colors: [] };
        batches[key].transforms.push(tmp.matrix.clone());
        batches[key].colors.push(null);
      }
      // ---- decals ------------------------------------------------------------------------------------
      var decalBatches = Object.create(null);
      var COL = {
        blood: linear(.085, .004, .003), oldBlood: linear(.034, .006, .005), ash: linear(.13, .125, .12), soot: linear(.012, .011, .01),
        wax: linear(.12, .105, .075), mould: linear(.03, .04, .012), bile: linear(.12, .12, .02), water: linear(.02, .026, .026),
        crack: linear(.004, .004, .004), chalk: linear(.36, .34, .3), rust: linear(.2, .055, .015), grime: linear(.02, .021, .017),
        dust: linear(.22, .2, .16), cold: linear(.35, .45, .7), warm: linear(.9, .6, .28), sick: linear(.35, .45, .12), redGlow: linear(.7, .12, .04)
      };
      function decal(type, cell, x, y, z, sx, sz, yaw, color, level, wall) {
        var chunk = coarseChunk(z) + chunkBias, key = type + ':' + chunk + ':' + (level || 0);
        if (!decalBatches[key]) decalBatches[key] = { type: type, level: level || 0, transforms: [], colors: [], cells: [] };
        tmp.position.set(x, y, z);
        if (wall == null) tmp.rotation.set(-Math.PI / 2, 0, yaw || 0); else tmp.rotation.set(0, wall, yaw || 0);
        tmp.scale.set(sx, sz, 1);
        tmp.updateMatrix();
        var b = decalBatches[key];
        b.transforms.push(tmp.matrix.clone()); b.colors.push(color); b.cells.push(cell);
      }
      function floorDecal(type, cell, x, z, sx, sz, yaw, color, level) { decal(type, cell, x, .004 + rand() * .003, z, sx, sz, yaw == null ? rand() * 6.28 : yaw, color, level); }
      // Vertical decal on a wall face; angle is the direction the face looks (0 = +z).
      function wallDecal(type, cell, x, y, z, sx, sy, angle, color, level) { decal(type, cell, x, y, z, sx, sy, 0, color, level, angle); }
      // ---- light sources (served by a small pool of real lights near the player) ----------------------
      // Light design fields: kind (flicker style), scatter (glow in the air) and glowRadius, shadowNear (may cast a
      // real shadow from above; geometry closer than this — the torch's own bowl — is ignored), group (scripted gain).
      var lightSources = [];
      var KIND = {
        torch: { scatter: 1, glowRadius: 1.15, shadowNear: .85, dim: '#ff4a12' },
        sconce: { scatter: .9, glowRadius: 1.0, shadowNear: .62, dim: '#ff4a12' },
        brazier: { scatter: 1.25, glowRadius: 1.7, shadowNear: 1.05, dim: '#ff3a0c' },
        lantern: { scatter: 1, glowRadius: 1.0, shadowNear: .55, dim: '#ff5a1a' },
        lamp: { scatter: 1.1, glowRadius: 1.1, shadowNear: .6, dim: '#6f9a1c' },
        candle: { scatter: .8, glowRadius: .75, shadowNear: null, dim: '#ff6a22' },
        special: { scatter: 1.2, glowRadius: 1.6, shadowNear: null, dim: null }
      };
      function lightSource(x, y, z, color, intensity, distance, flicker, opts) {
        opts = opts || {};
        var kind = KIND[opts.kind || 'torch'] || KIND.torch;
        var s = { x: x, y: y, z: z, color: new T.Color(color), intensity: intensity, distance: distance, flicker: flicker == null ? 1 : flicker,
          phase: opts.phase != null ? opts.phase : rand() * 10, score: 0, kind: opts.kind || 'torch',
          scatter: opts.scatter != null ? opts.scatter : kind.scatter, glowRadius: opts.glowRadius || kind.glowRadius,
          shadowNear: opts.shadowNear !== undefined ? opts.shadowNear : kind.shadowNear, aim: opts.aim || null,
          group: opts.group || null, tintGroup: opts.tintGroup || null,
          dim: new T.Color(kind.dim || color), live: 0, liveColor: new T.Color(color), livePos: { x: x, y: y, z: z }, spotW: 0, track: opts.track || null };
        lightSources.push(s); return s;
      }
      var flameDefs = [];
      function flame(x, y, z, w, h, palette, animate, withCore, opts) {
        var f = { x: x, y: y, z: z, w: w, h: h, palette: palette || 'fire', animate: animate !== false, core: withCore !== false,
          phase: opts && opts.phase != null ? opts.phase : rand() * 10, chunk: chunkOf(z), group: opts && opts.group || null, x0: x, y0: y, z0: z };
        flameDefs.push(f); return f;
      }
      // New pass-2 dressing draws from its own sequence so the original layout's random draws stay identical.
      var seed2 = 90217;
      function rand2() { seed2 = (Math.imul(seed2, 1664525) + 1013904223) >>> 0; return seed2 / 4294967296; }
      function between2(a, b) { return a + rand2() * (b - a); }
      var emberSources = [], smokeSources = [];

      var colliders = [];
      function solid(x, z, w, d) { colliders.push({ x: x, z: z, w: w, d: d }); }
      var floors = [];
      function tileFloor(x, z, w, d, roomIndex) {
        floors.push({ x: x, z: z, w: w, d: d });
        box('foundation', x, -0.34, z, w + 0.24, 0.54, d + 0.24);
        var rows = Math.ceil(d / (roomIndex === 3 || roomIndex === 6 ? 1.7 : roomIndex === 4 ? 1.02 : 1.32));
        var td = d / rows;
        for (var iz = 0; iz < rows; iz++) {
          var laid = 0, ix = 0;
          while (laid < w - .001) {
            var tw = Math.min(w - laid, between(roomIndex === 4 ? .95 : 1.25, roomIndex === 3 ? 2.8 : 2.45));
            if (ix === 0 && iz % 2) tw *= .61;
            if (w - laid - tw < .35) tw = w - laid;
            var px = x - w / 2 + laid + tw / 2;
            var pz = z - d / 2 + (iz + 0.5) * td;
            var v = between(0.74, 1.05);
            var shade = new T.Color().setRGB(v * between(0.96, 1.03), v, v * between(.97, 1.02));
            // A few sunken or tilted slabs break the perfect plane without creating a step.
            var sink = rand() < .08 ? -.018 : between(-.004, .004);
            put('slab' + Math.floor(rand() * 4), 'floor', px, -.141 + sink, pz,
              tw - .04, .24, td - .04, 0, Math.floor(rand() * 2) * Math.PI, 0, 0, shade);
            if (rand() < 0.13) floorDecal('matte', CELL.cracks, px + between(-0.4, 0.4), pz + between(-0.3, 0.3), between(.7, 1.3), between(.7, 1.3), null, COL.crack, 1);
            laid += tw; ix++;
          }
        }
      }
      function wallRun(x, z, length, axis, height) {
        var w = axis === 'x' ? length : 0.75;
        var d = axis === 'z' ? length : 0.75;
        solid(x, z, w, d);
        box('dark', x, height / 2, z, w, height, d);
        var courses = Math.max(1, Math.floor(height / 0.56));
        var h = height / courses;
        var pieces = Math.ceil(length / 1.6);
        for (var row = 0; row < courses; row++) {
          var step = length / pieces;
          for (var j = 0; j <= pieces; j++) {
            var left = Math.max(-length / 2, -length / 2 + (j - (row % 2) * 0.5) * step);
            var right = Math.min(length / 2, -length / 2 + (j + 1 - (row % 2) * 0.5) * step);
            if (right <= left) continue;
            var offset = (left + right) * 0.5, brickLength = right - left;
            var px = x + (axis === 'x' ? offset : 0);
            var pz = z + (axis === 'z' ? offset : 0);
            var shade = new T.Color().setScalar(between(0.72, 1.08));
            var g = 'slab' + (j + row) % 4;
            if (axis === 'x') put(g, 'stone', px, (row + .5) * h, pz, brickLength - .04, between(.81, .89), h - .045, Math.PI / 2, 0, 0, 0, shade);
            else put(g, 'stone', px, (row + .5) * h, pz, h - .045, between(.81, .89), brickLength - .04, 0, 0, Math.PI / 2, 0, shade);
          }
        }
        box('dark', x, 0.19, z, w + (axis === 'z' ? 0.23 : 0), 0.38, d + (axis === 'x' ? 0.23 : 0));
        // Separate dressed coping blocks catch light as stone. A continuous
        // pale strip looked like a timber handrail from the gameplay camera.
        var copingCount = Math.ceil(length / 1.42), copingSpan = length / copingCount;
        for (var cap = 0; cap < copingCount; cap++) {
          var off = -length / 2 + (cap + .5) * copingSpan;
          put('slab' + cap % 4, 'stone', x + (axis === 'x' ? off : 0), height + .045,
            z + (axis === 'z' ? off : 0), axis === 'x' ? copingSpan - .038 : .94, .19,
            axis === 'z' ? copingSpan - .038 : .94, 0, 0, 0, 0, new T.Color().setScalar(.7 + cap % 3 * .06));
        }
      }
      // ajan:world-a: some halls open into each other through a wide breach instead of a 7 m arch (BREACH[i]: between room i and i+1).
      // values = half-width of the opening: nearly the whole end wall comes down, two halls read as one broken nave.
      var BREACH = BABA.WorldATemple && BABA.WorldATemple.active ? { 0: 6.4, 1: 7.8, 2: 9.8, 3: 8.8, 4: 7.8, 5: 7.8 } : {};
      function portalHalf(i) { return BABA.WorldATemple && BABA.WorldATemple.active ? (i === 5 ? 4 : 4.6) : 3; }   // side-crypt doorway half-width
      function endWall(room, z, entrance, front, half) {
        var xmin = room.x - room.w / 2, xmax = room.x + room.w / 2; half = half || 3.45;
        var height = front ? 1.15 : (room.id === 6 ? 6.2 : 4.8);
        if (!entrance) { wallRun(room.x, z, room.w, 'x', height); return; }
        wallRun((xmin - half) / 2, z, -half - xmin, 'x', height);
        wallRun((xmax + half) / 2, z, xmax - half, 'x', height);
      }
      function pillar(x, z, height, big, collision) {
        var s = big ? 1.16 : 0.76;
        if (collision !== false) solid(x, z, s * 1.5, s * 1.5);
        put('slab0', 'dark', x, .17, z, s * 1.75, .34, s * 1.75, 0, 0, 0);
        put('slab2', 'pale', x, .47, z, s * 1.48, .25, s * 1.48, 0, 0, 0);
        put('octagon', 'stone', x, height / 2 + 0.35, z, s * 0.7, height - 0.35, s * 0.7, 0, Math.PI / 8, 0);
        put('capital', 'stone', x, height + .02, z, s * .93, 1, s * .93, 0, Math.PI / 8, 0);
        put('slab1', 'pale', x, height + .38, z, s * 1.69, .2, s * 1.69, 0, 0, 0);
        put('octagon', 'pale', x, 0.77, z, s * 0.77, 0.14, s * 0.77, 0, Math.PI / 8, 0, 1);
        put('octagon', 'dark', x, height - 0.31, z, s * 0.76, 0.11, s * 0.76, 0, Math.PI / 8, 0, 1);
        for (var k = 0; k < 8; k++) {
          var a = k * Math.PI / 4;
          put('pole', 'pale', x + Math.cos(a) * s * .56, height / 2 + .3, z + Math.sin(a) * s * .56,
            s * .105, height - .68, s * .105, 0, a, 0);
          put('octagon', 'dark', x + Math.cos(a) * s * .56, height - .37, z + Math.sin(a) * s * .56,
            s * .145, .18, s * .145, 0, a, 0, 1);
          put('knob', 'pale', x + Math.cos(a) * s * .74, height + .06, z + Math.sin(a) * s * .74,
            s * .12, .18, s * .12, 0, a, 0, 1);
        }
        // Grime collects at the foot of every column.
        floorDecal('matte', CELL.mould, x, z, s * 2.3, s * 2.3, null, COL.grime, 1);
      }
      // Each voussoir follows the same pointed curve as its neighbours. The
      // joints are true seams, with depth and a bevel, rather than rotated bars.
      function archStone(key, halfWidth, rise, thickness, depth, side, from, to) {
        if (geometries[key]) return geometries[key];
        function point(t, outer) {
          var width = halfWidth + (outer ? thickness : 0);
          return new T.Vector2(side * width * (1 - t * t), rise * (2 * t - t * t) + (outer ? thickness * t : 0));
        }
        var shape = new T.Shape(), steps = 4;
        for (var a = 0; a <= steps; a++) {
          var p = point(from + (to - from) * a / steps, false);
          if (a) shape.lineTo(p.x, p.y); else shape.moveTo(p.x, p.y);
        }
        for (var b = steps; b >= 0; b--) {
          var q = point(from + (to - from) * b / steps, true); shape.lineTo(q.x, q.y);
        }
        shape.closePath();
        var geometry = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelSegments: 1,
          bevelThickness: .025, bevelSize: .025, steps: 1 });
        geometry.translate(0, 0, -depth / 2); geometries[key] = geometry; return geometry;
      }
      function arch(z, scale, ruined) {
        var r = 3.4 * scale, spring = 2.92, rise = 3.2;
        [-1, 1].forEach(function (sign) {
          var x = sign * (r + .2);
          box('dark', x, .24, z, 1.22, .48, 1.35);
          for (var course = 0; course < 5; course++) {
            put('slab' + course % 4, 'stone', x, .66 + course * .46, z, .96, .45, .92, 0, 0, 0);
          }
          [-.31, .31].forEach(function (reveal) {
            put('round', 'pale', x, 1.69, z + reveal, .105, 2.15, .105, 0, 0, 0);
          });
          put('slab1', 'pale', x, spring, z, 1.18, .27, 1.16, 0, 0, 0);
          solid(x + sign * .14, z, .78, 1.06); // ajan:world-a: pier footprint flush with the corridor walls (no snag)
          for (var i = 0; i < 8; i++) {
            if (ruined && i > (sign < 0 ? 3 : 2)) continue;
            var geometry = archStone('door-' + sign + '-' + i + (r > 4 ? '-w' : ''), r, rise, .55, .85, sign, i / 8 + .005, (i + 1) / 8 - .005);
            architectureMesh(geometry, i % 3 === 0 ? 'pale~p' : 'stone~p', 0, spring, z, 0, 0, i > 2);
          }
        });
        if (!ruined) {
          var key = architectureMesh(geometries.octagon, 'dark~c', 0, spring + rise + .08, z, 0, 0, true);
          key.scale.set(.31, .6, .55);
          put('link', 'brass', 0, spring + rise + .03, z + .6, .14, .27, .08, 0, 0, 0, 1);
        }
      }

      rooms.forEach(function (room, i) {
        tileFloor(room.x, room.z, room.w, room.d, i);
        [-1,1].forEach(function(side){
          var portal = i < 6 && side === ([1,-1,-1,1,1,-1][i]);
          if(portal) [-1,1].forEach(function(s){var ph=portalHalf(i),len=(room.d-ph*2)/2;wallRun(room.x+side*room.w/2,room.z+s*(ph+len/2),len,'z',4.25);});
          else wallRun(room.x+side*room.w/2,room.z,room.d,'z',i===6?5.8:4.25);
        });
        endWall(room, room.z + room.d / 2, i !== 0, true, BREACH[i - 1] || 0);
        endWall(room, room.z - room.d / 2, i !== 6, false, BREACH[i] || 0);
        var pilasterZ = [room.z - room.d * 0.33, room.z + room.d * 0.33];
        pilasterZ.forEach(function (z) {
          [-1, 1].forEach(function (sign) {
            var px = room.x + sign * (room.w / 2 - 0.6);
            box('dark', px, 1.88, z, 0.85, 3.75, 1.4);
            box('pale', px, 3.78, z, 1.13, 0.24, 1.58);
            solid(px, z, 0.96, 1.4);
          });
        });
        if (i < rooms.length - 1) {
          var end = room.z - room.d / 2;
          var next = rooms[i + 1].z + rooms[i + 1].d / 2;
          var wide = !!BREACH[i], cw = wide ? BREACH[i] * 2 + .6 : 7;
          tileFloor(0, (end + next) / 2, cw, end - next + 0.1, -1);
          wallRun(-(cw / 2 + .23), (end + next) / 2, end - next + 0.25, 'z', wide ? 1.3 : 2.1);
          wallRun(cw / 2 + .23, (end + next) / 2, end - next + 0.25, 'z', wide ? 1.3 : 2.1);
          arch(end + 0.15, wide ? (BREACH[i] + .3) / 3.4 : 1, wide || i === 0 || i === 2 || i === 4);
          box('dark', 0, 0.002, next + 0.2, cw - .3, 0.035, 0.44);
          for (var q = -2; q <= 2; q++) box('brass', q * 1.1, 0.025, next + 0.2, 0.13, 0.025, 0.38, 0, 1);
          // Worn thresholds: grime and dragged filth gather in every passage.
          floorDecal('matte', CELL.mould, between(-1.5, 1.5), (end + next) / 2, 5.5, 3.5, null, COL.grime, 0);
        }
      });

      function chain(x, y, z, length, axis, level) {
        var count = Math.floor(length / 0.3);
        for (var i = 0; i < count; i++) {
          var step = i * 0.3;
          put('link', 'iron', x + (axis === 'x' ? step : 0), y - (axis === 'y' ? step : 0), z + (axis === 'z' ? step : 0),
            0.24, 0.35, 0.24, axis === 'z' ? Math.PI / 2 : 0, i % 2 ? Math.PI / 2 : 0,
            axis === 'x' ? Math.PI / 2 : 0, level || 1);
        }
      }
      function skull(x, z, scale, yaw, y) {
        y = y || 0;
        if (!geometries.cranium) {
          var cranium = new T.SphereGeometry(1, 12, 9), positions = cranium.attributes.position;
          for (var vi = 0; vi < positions.count; vi++) {
            var px = positions.getX(vi), py = positions.getY(vi), pz = positions.getZ(vi);
            var taper = py < -.1 ? .67 + (py + 1) * .37 : 1;
            positions.setXYZ(vi, px * taper, py, pz * (pz > 0 && py < 0 ? .82 : 1));
          }
          cranium.computeVertexNormals(); geometries.cranium = cranium;
        }
        put('cranium', 'bone', x, y + .22 * scale, z, .17 * scale, .21 * scale, .185 * scale, 0, yaw, 0, 2);
        function point(dx, dy, dz) { return [x + (Math.cos(yaw) * dx + Math.sin(yaw) * dz) * scale,
          y + dy * scale, z + (-Math.sin(yaw) * dx + Math.cos(yaw) * dz) * scale]; }
        var jaw = point(0, .051, .085);
        put('knob', 'bone', jaw[0], jaw[1], jaw[2], .105 * scale, .04 * scale, .085 * scale, 0, yaw, 0, 2);
        [-1, 1].forEach(function (s) {
          var socket = point(s * .074, .221, .151), brow = point(s * .072, .274, .153), cheek = point(s * .117, .158, .133);
          put('knob', 'foundation', socket[0], socket[1], socket[2], .059 * scale, .045 * scale, .028 * scale, 0, yaw, s * .22, 2);
          put('knob', 'bone', brow[0], brow[1], brow[2], .073 * scale, .019 * scale, .036 * scale, 0, yaw, 0, 2);
          put('knob', 'bone', cheek[0], cheek[1], cheek[2], .035 * scale, .046 * scale, .056 * scale, 0, yaw, s * .23, 2);
          var nasal = point(s * .019, .161, .158);
          put('knob', 'foundation', nasal[0], nasal[1], nasal[2], .022 * scale, .036 * scale, .022 * scale, 0, yaw, s * -.2, 2);
        });
        for (var tooth = -2; tooth <= 2; tooth++) {
          var p = point(tooth * .031, .089, .16 - Math.abs(tooth) * .009);
          box('bone', p[0], p[1], p[2], .022 * scale, .035 * scale, .027 * scale, yaw, 2);
        }
      }
      function boneScatter(x, z, count, radius) {
        for (var i = 0; i < count; i++) {
          var px = x + between(-radius, radius), pz = z + between(-radius, radius);
          var a = rand() * Math.PI * 2, length = between(0.3, 0.75);
          var dx = Math.sin(a) * length * 0.5, dz = Math.cos(a) * length * 0.5;
          rod('bone', [px - dx, 0.075, pz - dz], [px + dx, 0.075, pz + dz], 0.035, 2);
          put('knob', 'bone', px - dx, 0.076, pz - dz, 0.068, 0.052, 0.065, 0, 0, 0, 2);
          put('knob', 'bone', px + dx, 0.076, pz + dz, 0.065, 0.05, 0.066, 0, 0, 0, 2);
        }
        skull(x + radius * 0.24, z, 1, between(-2, 2));
        floorDecal('matte', CELL.specks, x, z, radius * 2.6 + .6, radius * 2.6 + .6, null, COL.dust, 1);
        floorDecal('matte', CELL.mould, x, z, radius * 2.2 + .8, radius * 2.2 + .8, null, COL.grime, 1);
      }
      function ribCage(x, z, angle) {
        floorDecal('matte', CELL.bloodPool, x, z, 2.7, 3.3, angle, COL.oldBlood, 0);
        function point(dx, dz) { return [x + Math.cos(angle) * dx + Math.sin(angle) * dz, z - Math.sin(angle) * dx + Math.cos(angle) * dz]; }
        var a = point(0, -0.6), b = point(0, 0.54);
        rod('bone', [a[0], 0.11, a[1]], [b[0], 0.11, b[1]], 0.046, 2);
        for (var i = 0; i < 6; i++) {
          var p = point(0, -0.38 + i * 0.14), s = 0.8 + Math.sin(i / 5 * Math.PI) * 0.24;
          put('rib', 'bone', p[0], 0.06, p[1], s, s, s, 0, angle, 0, 2);
        }
        var head = point(-0.08, -0.87);
        skull(head[0], head[1], 1.08, angle + 0.45);
        [-1, 1].forEach(function (side) {
          var hip = point(side * 0.15, 0.5), knee = point(side * 0.27, 1.06), foot = point(side * 0.45, 1.56);
          rod('bone', [hip[0], 0.07, hip[1]], [knee[0], 0.07, knee[1]], 0.048, 2);
          rod('bone', [knee[0], 0.07, knee[1]], [foot[0], 0.07, foot[1]], 0.035, 2);
        });
      }
      function rubble(x, z, count, radius) {
        for (var i = 0; i < count; i++) {
          var s = between(0.15, 0.48);
          put('slab' + i % 4, i % 3 ? 'stone' : 'dark', x + between(-radius, radius), s * 0.3,
            z + between(-radius, radius), s * 1.5, s * 0.68, s, between(-0.15, 0.15), rand() * 6.28, between(-0.15, 0.15), 1);
        }
        floorDecal('matte', CELL.ashPile, x, z, radius * 2.8, radius * 2.8, null, COL.ash, 1);
      }
      function slab(x, z, angle, broken) {
        solid(x, z, 1.6, 3.15);
        box('dark', x, 0.34, z, 1.48, 0.68, 3.0, angle);
        put('slab3', 'stone', x, .8, z, 1.8, .27, 3.25, 0, angle, 0);
        put('slab1', 'pale', x, .965, z, 1.59, .1, 2.98, 0, angle, 0);
        box('dark', x, 1.025, z, 0.92, 0.025, 2.3, angle, 1);
        for (var i = -1; i <= 1; i++) box('iron', x, 1.055, z + i * 0.7, 1.54, 0.035, 0.075, angle, 1);
        if (broken) rubble(x + 1.0, z + 1.1, 7, 0.8);
      }
      function cage(x, z, w, d, height) {
        solid(x, z, w, d);
        box('dark', x, 0.15, z, w + 0.3, 0.3, d + 0.3);
        [0.35, height * 0.55, height].forEach(function (y) {
          box('iron', x, y, z - d / 2, w, 0.09, 0.09);
          box('iron', x, y, z + d / 2, w, 0.09, 0.09);
          box('iron', x - w / 2, y, z, 0.09, 0.09, d);
          box('iron', x + w / 2, y, z, 0.09, 0.09, d);
        });
        for (var a = -w / 2; a <= w / 2 + 0.01; a += 0.39) {
          box('iron', x + a, height / 2, z - d / 2, 0.058, height, 0.058);
          box('iron', x + a, height / 2, z + d / 2, 0.058, height, 0.058);
          box('iron', x + a, height, z, 0.049, 0.065, d, 0, 1);
        }
        for (var b = -d / 2; b <= d / 2 + 0.01; b += 0.39) {
          box('iron', x - w / 2, height / 2, z + b, 0.058, height, 0.058);
          box('iron', x + w / 2, height / 2, z + b, 0.058, height, 0.058);
        }
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) {
          box('rust', x + sx * w / 2, height * .5, z + sz * d / 2, .12, height + .18, .12);
          put('cone', 'iron', x + sx * w / 2, height + .31, z + sz * d / 2, .13, .45, .13, 0, 0, 0);
          put('knob', 'rust', x + sx * w / 2, height + .04, z + sz * d / 2, .11, .11, .11, 0, 0, 0);
        }); });
        rod('iron', [x - w / 2, height * .24, z + d / 2 + .025], [x + w / 2, height * .75, z + d / 2 + .025], .035, 1);
        box('rust', x, height * .53, z + d / 2 + .065, .27, .36, .095);
        put('link', 'iron', x, height * .58, z + d / 2 + .14, .09, .13, .09, 0, 0, 0);
        boneScatter(x, z, 5, Math.min(w, d) * 0.27);
        floorDecal('matte', CELL.bloodSmear, x, z + d / 2 + 1.0, 1.4, 2.4, 0, COL.oldBlood, 1);
        floorDecal('matte', CELL.claws, x + between(-.5, .5), z + d / 2 + .5, 1.2, 1.2, rand() * 6, COL.crack, 2);
      }
      var animatedCloth = [], movingHangers = [];
      function architectureMesh(geometry, mat, x, y, z, angle, level, occludes) {
        var useMaterial = materials[mat];
        if (occludes) {
          useMaterial = useMaterial.userData.surfaceOpts ? cloneSurface(useMaterial) : useMaterial.clone();
          // The camera fades these arches. Prepare their alpha-capable program
          // before the title; changing transparent later leaves a warmed OPAQUE shader.
          useMaterial.transparent = true;
          uniqueMaterials.push(useMaterial);
        }
        var mesh = new T.Mesh(geometry, useMaterial);
        mesh.position.set(x, y, z); mesh.rotation.y = angle || 0;
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.baseCastShadow = true;
        mesh.userData.detail = level || 0;
        root.add(mesh);
        if (level) decorationBatches.push(mesh);
        if (occludes) { mesh.userData.occluder = true; occluders.push(mesh); }
        else allBatches.push(mesh);
        return mesh;
      }
      // Several small parts become one mesh per material: fewer draw calls for hanging props.
      function mergeParts(parts) {
        var total = 0, itotal = 0;
        parts.forEach(function (p) { var g = p.geo; total += g.attributes.position.count; itotal += g.index ? g.index.count : g.attributes.position.count; });
        var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uvs = new Float32Array(total * 2), idx = new Uint32Array(itotal);
        var v = 0, k = 0, nm = new T.Matrix3(), vec = new T.Vector3();
        parts.forEach(function (p) {
          var g = p.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
          nm.getNormalMatrix(p.matrix);
          for (var i = 0; i < P.count; i++) {
            vec.fromBufferAttribute(P, i).applyMatrix4(p.matrix); pos[(v + i) * 3] = vec.x; pos[(v + i) * 3 + 1] = vec.y; pos[(v + i) * 3 + 2] = vec.z;
            vec.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(v + i) * 3] = vec.x; nor[(v + i) * 3 + 1] = vec.y; nor[(v + i) * 3 + 2] = vec.z;
            if (U) { uvs[(v + i) * 2] = U.getX(i); uvs[(v + i) * 2 + 1] = U.getY(i); }
          }
          if (g.index) for (var j = 0; j < g.index.count; j++) idx[k++] = g.index.getX(j) + v;
          else for (var j2 = 0; j2 < P.count; j2++) idx[k++] = j2 + v;
          v += P.count;
        });
        var out = new T.BufferGeometry();
        out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
        out.setAttribute('uv', new T.BufferAttribute(uvs, 2)); out.setIndex(new T.BufferAttribute(idx, 1));
        out.computeBoundingSphere(); uniqueGeometries.push(out); return out;
      }
      function part(geo, x, y, z, sx, sy, sz, rx, ry, rz) {
        tmp.position.set(x, y, z); tmp.rotation.set(rx || 0, ry || 0, rz || 0); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
        return { geo: geometries[geo] || geo, matrix: tmp.matrix.clone() };
      }
      function hangerGroup(x, y, z, byMaterial, castShadow) {
        var group = new T.Group(); group.position.set(x, y, z); root.add(group);
        // Every hanger continues up into the darkness of the vault instead of ending in mid-air.
        if (!byMaterial.iron) byMaterial.iron = [];
        byMaterial.iron.push(part('pole', 0, (11 - y) / 2, 0, .028, 11 - y, .028));
        Object.keys(byMaterial).forEach(function (mat) {
          if (!byMaterial[mat].length) return;
          var mesh = new T.Mesh(mergeParts(byMaterial[mat]), materials[mat]);
          mesh.castShadow = !!castShadow; mesh.receiveShadow = true; group.add(mesh);
        });
        group.userData.detail = 1; decorationBatches.push(group); movingHangers.push({ root: group, phase: rand() * 6.28 });
        return group;
      }
      function pointedOutline(width, height) {
        var shape = new T.Shape(), half = width / 2, spring = height * .59;
        shape.moveTo(-half, 0); shape.lineTo(-half, spring);
        shape.quadraticCurveTo(-half, height * .83, 0, height);
        shape.quadraticCurveTo(half, height * .83, half, spring);
        shape.lineTo(half, 0); shape.closePath(); return shape;
      }
      function alcove(x, z, width, height, angle, boneNiche) {
        var frameKey = 'niche-frame-' + width + '-' + height, backKey = 'niche-back-' + width + '-' + height;
        if (!geometries[frameKey]) {
          var outer = pointedOutline(width, height), inner = pointedOutline(width - .32, height - .24);
          var hole = new T.Path(inner.getPoints(14)); outer.holes.push(hole);
          geometries[frameKey] = new T.ExtrudeGeometry(outer, { depth: .23, bevelEnabled: true, bevelSegments: 1,
            bevelThickness: .025, bevelSize: .025, steps: 1, curveSegments: 12 });
          geometries[backKey] = new T.ShapeGeometry(pointedOutline(width - .24, height - .16), 16);
        }
        put(frameKey, 'pale', x, .26, z, 1, 1, 1, 0, angle, 0);
        put(backKey, 'foundation', x - Math.sin(angle) * .035, .27, z - Math.cos(angle) * .035, 1, 1, 1, 0, angle, 0);
        var nx = Math.sin(angle), nz = Math.cos(angle), tx = Math.cos(angle), tz = -Math.sin(angle);
        for (var i = -1; i <= 1 && boneNiche !== 'saint'; i++) {
          var off = i * width * .2;
          rod('iron', [x + tx * off + nx * .06, .35, z + tz * off + nz * .06], [x + tx * off + nx * .06, height * .76, z + tz * off + nz * .06], .027, 1);
        }
        if (!boneNiche) {
          for (var n = 0; n < 3; n++) {
            var h = .55 + n * .82;
            rod('iron', [x - tx * width * .38 + nx * .07, h, z - tz * width * .38 + nz * .07], [x + tx * width * .38 + nx * .07, h, z + tz * width * .38 + nz * .07], .021, 1);
          }
        }
      }
      function funeraryEffigy(x, z, yaw, size) {
        size = size || 1;
        if (!geometries.effigyRobe) {
          var robe = new T.LatheGeometry([new T.Vector2(.43, 0), new T.Vector2(.46, .12), new T.Vector2(.37, .58),
            new T.Vector2(.31, 1.08), new T.Vector2(.41, 1.5), new T.Vector2(.34, 1.64), new T.Vector2(.16, 1.73)], 24);
          var positions = robe.attributes.position;
          for (var i = 0; i < positions.count; i++) {
            var px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
            var angle = Math.atan2(pz, px), folds = 1 + Math.sin(angle * 11 + py * .7) * (.085 + (1.7 - py) * .045);
            positions.setXYZ(i, px * folds, py, pz * folds * .7);
          }
          robe.computeVertexNormals(); geometries.effigyRobe = robe;
          geometries.effigyHood = new T.SphereGeometry(1, 14, 10, Math.PI * .16, Math.PI * 1.68, 0, Math.PI * .82);
        }
        function at(dx, y, dz) { return [x + (Math.cos(yaw) * dx + Math.sin(yaw) * dz) * size, y * size,
          z + (-Math.sin(yaw) * dx + Math.cos(yaw) * dz) * size]; }
        var b = at(0, .48, .17);
        put('slab3', 'dark', b[0], .41 * size, b[2], .98 * size, .27 * size, .77 * size, 0, yaw, 0);
        put('slab1', 'pale', b[0], .59 * size, b[2], .85 * size, .11 * size, .7 * size, 0, yaw, 0);
        put('effigyRobe', 'stone', b[0], .63 * size, b[2], size, size, size, 0, yaw, 0);
        var head = at(0, 2.53, .2);
        put('effigyHood', 'pale', head[0], head[1], head[2], .295 * size, .375 * size, .27 * size, .06, yaw, 0);
        var face = at(0, 2.48, .37);
        put('ball', 'foundation', face[0], face[1], face[2], .18 * size, .235 * size, .08 * size, 0, yaw, 0);
        [-1, 1].forEach(function (sign) {
          var shoulder = at(sign * .33, 2.12, .23), elbow = at(sign * .32, 1.6, .32), hand = at(sign * .08, 1.74, .55);
          rod('stone', shoulder, elbow, .17 * size, 0); rod('pale', elbow, hand, .115 * size, 0);
          put('knob', 'stone', hand[0], hand[1], hand[2], .095 * size, .12 * size, .08 * size, 0, yaw, 0);
        });
        var book = at(0, 1.75, .59);
        put('box', 'dark', book[0], book[1], book[2], .32 * size, .45 * size, .13 * size, -.28, yaw, 0, 1);
        var base = at(0, .8, .51);
        put('link', 'brass', base[0], base[1], base[2], .065 * size, .15 * size, .04 * size, 0, yaw, 0, 1);
        // Tallow and old offerings at the saint's feet.
        var foot = at(0, 0, .9);
        floorDecal('matte', CELL.wax, foot[0], foot[2], 1.1 * size, 1.1 * size, null, COL.wax, 1);
      }
      function censer(x, z, height) {
        var parts = { iron: [], brass: [], dark: [], ember: [] };
        for (var side = 0; side < 3; side++) {
          var angle = side / 3 * Math.PI * 2;
          for (var i = 0; i < 9; i++) {
            var t = i / 8;
            parts.iron.push(part('link', Math.sin(angle) * t * .26, -t * 1.75, Math.cos(angle) * t * .26, .075, .15, .075, 0, i % 2 * Math.PI / 2, 0));
          }
        }
        parts.brass.push(part('ball', 0, -1.9, 0, .38, .28, .38));
        parts.dark.push(part('octagon', 0, -1.78, 0, .39, .13, .39));
        parts.iron.push(part('cone', 0, -1.56, 0, .29, .4, .29));
        parts.ember.push(part('octagon', 0, -1.73, 0, .315, .045, .315));
        parts['dark~c'] = parts.dark; delete parts.dark;
        hangerGroup(x, height, z, parts, false);
        lightSource(x, height - 1.6, z, '#ff6a2a', 2.6, 4.5, .6);
        var src = { x: x, y: height - 1.65, z: z };
        smokeSources.push({ x: x, y: height - 1.5, z: z, count: 4, rate: .07, rise: 2.2, spread: .35, size: 1.1, alpha: .16, color: [.07, .065, .06] });
        return src;
      }
      function vaultRib(room, z, sign) {
        var edge = room.x + sign * (room.w / 2 - .49), centre = edge - sign * 2.6;
        // Surviving springers carry the weight of the ruined vault. Their
        // missing crowns leave a deliberate open cutaway over the fighting.
        box('dark', edge, 1.72, z, .86, 3.44, 1.16, 0);
        for (var column = -1; column <= 1; column++) {
          var px = edge - sign * .34, pz = z + column * .3;
          put('round', column ? 'stone' : 'pale', px, 1.84, pz, column ? .145 : .18, 2.75, column ? .145 : .18, 0, 0, 0);
          put('round', 'dark', px, .48, pz, .2, .18, .2, 0, 0, 0);
          put('round', 'pale', px, 3.18, pz, .21, .17, .21, 0, 0, 0);
        }
        put('slab2', 'stone', edge - sign * .11, .21, z, 1.15, .37, 1.53, 0, 0, 0);
        put('slab2', 'pale', edge - sign * .1, 3.42, z, 1.16, .25, 1.5, 0, 0, 0);
        // Five voussoirs per rib, merged into one geometry (one draw per material per room).
        // A stepped archivolt sits in the stone's face, not beside it as a floating rail.
        if (!geometries['vaultRib' + sign]) {
          var ribParts = [], faceParts = [], identity = new T.Matrix4();
          for (var segment = 0; segment < 5; segment++) {
            var from = segment * .13 + .007, to = (segment + 1) * .13 - .007;
            ribParts.push({ geo: archStone('vault-' + sign + '-' + segment, 2.6, 2.55, .42, .68, sign, from, to), matrix: identity });
            faceParts.push({ geo: archStone('vault-face-' + sign + '-' + segment, 2.57, 2.54, .115, .085, sign, from, to), matrix: identity });
          }
          geometries['vaultRib' + sign] = mergeParts(ribParts); geometries['vaultFace' + sign] = mergeParts(faceParts);
        }
        put('vaultRib' + sign, 'stone', centre, 3.52, z, 1, 1, 1, 0, 0, 0);
        put('vaultFace' + sign, 'dark', centre, 3.52, z + .395, 1, 1, 1, 0, 0, 0, 1);
      }
      function ritualPavement(x, z, radius, chapel) {
        var bands = Math.ceil(radius / 1.25);
        for (var band = 0; band < bands; band++) {
          var inner = band * radius / bands, outer = (band + 1) * radius / bands;
          var pieces = Math.max(12, Math.round(outer * 6));
          var key = 'ritual-' + (chapel ? 'chapel' : radius) + '-' + band;
          if (!geometries[key]) {
            var g = new T.RingGeometry(Math.max(.015, inner + .018), outer - .024, 3, 1, .006, Math.PI * 2 / pieces - .012);
            g.rotateX(-Math.PI / 2);
            geometries[key] = g;
          }
          for (var piece = 0; piece < pieces; piece++) {
            var color = new T.Color().setScalar(between(chapel ? .9 : .7, chapel ? 1.12 : 1.0));
            put(key, chapel ? 'pale' : 'floor', x, -.001, z, 1, 1, 1, 0, piece / pieces * Math.PI * 2 + (band % 2) * .055, 0, 0, color);
          }
        }
      }
      function shroudedRemains(x, z, yaw) {
        var g = new T.PlaneGeometry(1.8, 2.75, 12, 18), positions = g.attributes.position, colors = [];
        for (var i = 0; i < positions.count; i++) {
          var px = positions.getX(i), pz = positions.getY(i), edge = Math.max(0, (Math.abs(px) - .69) / .21);
          var body = Math.exp(-Math.pow(px / .48, 4) - Math.pow(pz / .86, 4)) * .36;
          var head = Math.exp(-Math.pow(px / .25, 2) * 2 - Math.pow((pz + 1.02) / .27, 2)) * .24;
          var fold = Math.sin(px * 24 + pz * 3) * .026 * (1 - edge * .5);
          positions.setXYZ(i, px, 1.035 + body + head + fold - edge * .37, pz);
          var stained = Math.exp(-Math.pow((px + .2) / .45, 2) - Math.pow((pz - .35) / .5, 2)) * .85;
          var bile = Math.exp(-Math.pow((px - .3) / .35, 2) - Math.pow((pz + .4) / .45, 2)) * .5;
          colors.push(.83 - stained * .45 - bile * .3, .77 - stained * .72 - bile * .1, .64 - stained * .6 - bile * .45);
        }
        g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); uniqueGeometries.push(g);
        materials.shroud.vertexColors = true;
        var mesh = architectureMesh(g, 'shroud', x, 0, z, yaw, 1, false);
        mesh.userData.baseCastShadow = false; mesh.castShadow = false;
        // What leaks through the linen pools under the mortuary table.
        floorDecal('wet', CELL.bloodDrip, x + .3, z + .8, 1.3, 1.9, yaw, COL.blood, 1);
        floorDecal('matte', CELL.mould, x, z, 3.2, 4.2, yaw, COL.bile, 1);
      }
      function hangingIron(x, z, height, noose, links) {
        links = links || 11;
        var parts = {}; parts[noose ? 'rust' : 'iron'] = []; parts[noose ? 'wood' : 'rust'] = parts[noose ? 'wood' : 'rust'] || [];
        for (var i = 0; i < links; i++) parts[noose ? 'rust' : 'iron'].push(part('link', 0, -i * .2, 0, .14, .24, .14, 0, i % 2 * Math.PI / 2, 0));
        parts[noose ? 'wood' : 'rust'].push(part('link', 0, -links * .2 - .17, 0, noose ? .34 : .52, noose ? .53 : .36, .27));
        return hangerGroup(x, height, z, parts, true);
      }
      function hangedBody(x, z, topY, yaw) {
        // A shrouded prisoner, hanged inside the yard cage.
        if (!geometries.hanged) {
          var prof = [[.02, 0], [.07, .03], [.1, .1], [.13, .42], [.12, .55], [.16, .88], [.2, 1.0], [.17, 1.18], [.22, 1.38], [.24, 1.48],
            [.2, 1.56], [.07, 1.62], [.11, 1.68], [.12, 1.78], [.08, 1.86], [.01, 1.9]].map(function (p) { return new T.Vector2(p[0], p[1]); });
          var gh = new T.LatheGeometry(prof, 14), P = gh.attributes.position;
          for (var i = 0; i < P.count; i++) {
            var px = P.getX(i), py = P.getY(i), pz = P.getZ(i), fold = 1 + Math.sin(Math.atan2(pz, px) * 9 + py * 5) * .05;
            P.setXYZ(i, px * fold, py, pz * .72 * fold + (py > 1.62 ? (py - 1.62) * .35 : 0));
          }
          gh.computeVertexNormals(); geometries.hanged = gh;
        }
        var parts = { shroud: [part('hanged', 0, -1.72, 0, 1, 1, 1, .04, yaw, .03)], rust: [part('link', 0, -.05, .05, .2, .12, .2, Math.PI / 2, 0, 0)] };
        materials.shroud.vertexColors = true;
        var g = hangerGroup(x, topY, z, parts, true);
        g.children.forEach(function (m) { if (m.material === materials.shroud) { var c = []; for (var i = 0; i < m.geometry.attributes.position.count; i++) { var y = m.geometry.attributes.position.getY(i) + 1.72; var s = y < .5 ? .5 : 0; c.push(.62 - s * .4, .56 - s * .5, .46 - s * .42); } m.geometry.setAttribute('color', new T.Float32BufferAttribute(c, 3)); } });
        return g;
      }
      function floorRing(x, z, radius, width, mat, level, segments) {
        var geometry = new T.RingGeometry(radius - width, radius, segments || 64);
        geometry.rotateX(-Math.PI / 2);
        uniqueGeometries.push(geometry);
        var mesh = new T.Mesh(geometry, materials[mat]);
        mesh.position.set(x, 0.023, z);
        mesh.receiveShadow = true;
        mesh.userData.detail = level || 0;
        root.add(mesh);
        if (level) decorationBatches.push(mesh);
        return mesh;
      }
      function puddle(x, z, sx, sz, mat) {
        var shapes = [];
        function patch(cx, cy, scale) {
          var points = [];
          for (var i = 0; i < 24; i++) {
            var angle = i / 24 * Math.PI * 2;
            var radius = between(0.73, 1.0) * scale;
            points.push(new T.Vector2(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius));
          }
          var shape = new T.Shape();
          var last = points[points.length - 1];
          shape.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
          for (var j = 0; j < points.length; j++) {
            var p = points[j], n = points[(j + 1) % points.length];
            shape.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
          }
          shape.closePath(); shapes.push(shape);
        }
        patch(0, 0, 1);
        patch(0.78, 0.63, 0.19);
        patch(-0.94, -0.29, 0.11);
        var geometry = new T.ShapeGeometry(shapes, 3);
        geometry.rotateX(-Math.PI / 2);
        uniqueGeometries.push(geometry);
        var mesh = new T.Mesh(geometry, materials[mat || 'water']);
        mesh.position.set(x, 0.006, z);
        mesh.rotation.y = between(-0.5, 0.5);
        mesh.scale.set(sx, 1, sz);
        mesh.receiveShadow = true;
        mesh.renderOrder = -4;
        mesh.userData.detail = 1;
        decorationBatches.push(mesh); root.add(mesh);
        floorDecal('matte', mat === 'blood' ? CELL.bloodSpatter : CELL.mould, x, z, sx * 2.9, sz * 2.9, null, mat === 'blood' ? COL.oldBlood : COL.grime, 1);
      }
      function banner(x, z, scale) {
        var g = new T.PlaneGeometry(1.16, 2.3, 8, 16);
        g.translate(0, -1.15, 0);
        var positions = g.attributes.position;
        for (var i = 0; i < positions.count; i++) {
          var bx = positions.getX(i), by = positions.getY(i), drop = -by / 2.3;
          by += Math.max(0, drop - .82) / .18 * (.12 + Math.abs(Math.sin(bx * 16)) * .29);
          positions.setXYZ(i, bx + Math.sin(by * 2.2) * drop * .035, by, Math.sin(bx * 9 + by * 1.9) * drop * .105);
        }
        g.computeVertexNormals();
        uniqueGeometries.push(g);
        var mesh = new T.Mesh(g, materials.cloth);
        mesh.position.set(x, 3.25, z);
        mesh.scale.set(scale, scale, scale);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.baseCastShadow = true; allBatches.push(mesh);
        root.add(mesh);
        animatedCloth.push({ mesh: mesh, geometry: g, base: new Float32Array(positions.array), phase: rand() * 6.28 });
        box('iron', x, 3.29, z, 1.42 * scale, 0.09, 0.09);
        box('brass', x, 2.38, z + 0.012, 0.078, 0.82, 0.024, 0, 1);
        box('brass', x, 2.52, z + 0.013, 0.45, 0.072, 0.025, 0, 1);
      }

      function torch(x, z, height, withLight, sanctuary) {
        height = height || 2.1;
        box('iron', x, height * 0.5 + 0.06, z, 0.16, height - 0.44, 0.16);
        box('brass', x, 0.16, z, 0.6, 0.32, 0.6);
        put('octagon', 'iron', x, 0.34, z, 0.22, 0.13, 0.22, 0, 0, 0);
        put('octagon', 'iron', x, height - 0.16, z, 0.34, 0.17, 0.34, 0, 0, 0);
        put('cone', 'rust', x, height - 0.31, z, 0.29, 0.26, 0.29, Math.PI, 0, 0);
        for (var j = 0; j < 5; j++) {
          var a = j / 5 * Math.PI * 2;
          rod('iron', [x + Math.sin(a) * 0.25, height - 0.21, z + Math.cos(a) * 0.25],
            [x + Math.sin(a) * 0.33, height + 0.17, z + Math.cos(a) * 0.33], 0.031, 1);
        }
        flame(x, height + 0.23, z, .6, .98);
        lightSource(x, height + 0.45, z, sanctuary ? '#ffc27a' : '#ff7a30', sanctuary ? 36 : withLight ? 40 : 36, sanctuary ? 13 : 12.5, 1, { kind: 'torch', group: sanctuary ? 'chapelFire' : null });
        emberSources.push({ x: x, y: height + .3, z: z, count: 6, spread: .3, rise: 2.3 });
        floorDecal('matte', CELL.soot, x, z, 1.25, 1.25, null, COL.soot, 0);
        floorDecal('matte', CELL.ashPile, x + between(-.2, .2), z + between(-.2, .2), 1.1, 1.1, null, COL.ash, 1);
        floorDecal('glow', CELL.glow, x, z, 4.4, 4.4, 0, sanctuary ? linear(.07, .045, .02) : linear(.08, .032, .01), 0);
      }
      // A fire bowl bolted to a pilaster face. angle is the direction the face looks.
      function sconce(x, z, y, angle, sick) {
        var nx = Math.sin(angle), nz = Math.cos(angle);
        box('iron', x + nx * .03, y - .15, z + nz * .03, Math.abs(nz) * .34 + .06, .56, Math.abs(nx) * .34 + .06, 0);
        rod('iron', [x + nx * .04, y - .32, z + nz * .04], [x + nx * .3, y - .05, z + nz * .3], .03, 0);
        put('bowl', 'iron', x + nx * .33, y, z + nz * .33, .2, .2, .2, 0, 0, 0);
        put('octagon', sick ? 'sickEmber' : 'ember', x + nx * .33, y + .02, z + nz * .33, .15, .03, .15, 0, 0, 0);
        flame(x + nx * .33, y + .26, z + nz * .33, .46, .72, sick ? 'sick' : 'fire');
        lightSource(x + nx * .6, y + .35, z + nz * .6, sick ? '#a6d45e' : '#ff8240', sick ? 16 : 32, 11, 1, { kind: 'sconce', aim: [nx * 2.2, nz * 2.2] });
        emberSources.push({ x: x + nx * .33, y: y + .2, z: z + nz * .33, count: 5, spread: .2, rise: 1.8, sick: !!sick });
        floorDecal('glow', CELL.glow, x + nx * 1.1, z + nz * 1.1, 3.4, 3.4, 0, sick ? linear(.03, .05, .012) : linear(.07, .028, .009), 0);
        // Soot plume on the pilaster face above the flame (kept below the pilaster cap).
        var sootTop = Math.min(y + 1.4, 3.66), sootBottom = y - .1;
        wallDecal('matte', CELL.soot, x + nx * .02, (sootTop + sootBottom) / 2, z + nz * .02, 1.25, sootTop - sootBottom, angle, COL.soot, 0);
      }
      function candleCluster(x, z, count) {
        for (var i = 0; i < count; i++) {
          var px = x + between(-0.5, 0.5), pz = z + between(-0.45, 0.45), h = between(0.15, 0.49);
          put('pole', 'wax', px, h / 2, pz, 0.055, h, 0.055, 0, 0, 0, 1);
          put('round', 'wax', px, 0.02, pz, 0.1, 0.035, 0.08, 0, 0, 0, 2);
          put('pole', 'crack', px, h + .015, pz, .006, .03, .006, 0, 0, 0, 2);
          flame(px, h + .075, pz, .075, .15, 'fire', false, false);
        }
        lightSource(x, .9, z, '#ffab5c', Math.min(9, 2 + count * .6), 5.5, .5, { kind: 'candle' });
        floorDecal('matte', CELL.wax, x, z, 1.05, .95, null, COL.wax, 1);
      }

      // I. Entrance: broken prison doors and the abandoned descent.
      cage(-6.6, 3.5, 2.3, 4.1, 2.8);
      cage(6.6, -0.5, 2.3, 3.8, 2.8);
      pillar(-6.0, 10.8, 3.6, false);
      pillar(6.0, 10.8, 3.6, false);
      chain(-7.7, 3.15, -3.5, 2.1, 'y');
      chain(7.7, 3.15, 5.5, 2.7, 'y');
      torch(-4.7, 7.4, 2.0, true);
      torch(4.7, -3.8, 2.0, false);
      rubble(-6, -3.6, 14, 1.2);
      boneScatter(6.1, 5.2, 6, 0.85);
      ribCage(-6.4, 3.7, -0.3);
      puddle(-4.8, 0.9, 1.0, 1.5);
      banner(BREACH[0] ? -7.7 : -5.1, -5.48, 0.8);
      banner(BREACH[0] ? 7.7 : 5.1, -5.48, 0.8);
      // A barred gate behind the player establishes the direction of travel.
      for (var ig = -4; ig <= 4; ig++) {
        box('iron', ig * 0.55, 1.56, 13.45, 0.09, 3.1, 0.09);
        put('cone', 'iron', ig * 0.55, 3.23, 13.45, 0.13, 0.3, 0.13, 0, 0, 0);
      }
      box('iron', 0, 2.5, 13.45, 5.0, 0.16, 0.16);

      // II. Chain yard: an empty well and machinery at the combat area's edges.
      var wellX = -6.5, wellZ = -28.5;
      solid(wellX, wellZ, 3.15, 3.15);
      put('round', 'foundation', wellX, 0.13, wellZ, 1.55, 0.25, 1.55, 0, 0, 0);
      for (var wi = 0; wi < 12; wi++) {
        var wa = wi / 12 * Math.PI * 2;
        box('stone', wellX + Math.cos(wa) * 1.32, 0.51, wellZ + Math.sin(wa) * 1.32, 0.64, 1.02, 0.6, -wa);
        box('pale', wellX + Math.cos(wa) * 1.32, 1.06, wellZ + Math.sin(wa) * 1.32, 0.72, 0.13, 0.7, -wa);
      }
      box('wood', wellX - 1.4, 2.03, wellZ, 0.25, 4.06, 0.31);
      box('wood', wellX + 1.4, 2.03, wellZ, 0.25, 4.06, 0.31);
      box('wood', wellX, 4.01, wellZ, 3.5, 0.29, 0.32);
      chain(wellX, 3.8, wellZ, 3.25, 'y');
      pillar(6.4, -16.1, 2.3, true);
      pillar(6.4, -27.5, 4.2, true);
      cage(-9.9, -28.8, 2.5, 2.5, 2.5);
      torch(-5.8, -13.4, 2.15, true);
      torch(5.5, -30, 2.1, false);
      boneScatter(-7.6, -15.4, 12, 1.3);
      ribCage(-6.9, -26.7, 1.8);
      rubble(6.8, -19.6, 14, 1.2);
      puddle(-4.6, -25, 1.25, 0.9);
      chain(-11.6, 3.1, -16.8, 2.4, 'y');
      banner(-5.6, -31.45, 1.05);
      banner(5.6, -31.45, 1.05);

      // III. Infirmary: mortuary tables and wet stone; no collision on stains.
      [-7.5, 9.3].forEach(function (x) {
        [-40, -54].forEach(function (z) { slab(x, z, 0, z < -45); });
      });
      for (var gr = 0; gr < 7; gr++) box('iron', 9.3 + (gr - 3) * 0.34, 0.024, -55.4, 0.07, 0.046, 2.2, 0, 0);
      box('foundation', 9.3, 0.003, -55.4, 2.6, 0.02, 2.5);
      puddle(6.5, -48, 1.4, 1.9);
      puddle(-5.1, -44, 0.9, 1.4, 'blood');
      puddle(7, -54, 0.5, 1.0, 'blood');
      boneScatter(-8.6, -55, 17, 1.1);
      ribCage(7.8, -45.5, 0.7);
      // A body was dragged from the tables to the drain.
      for (var trail = 0; trail < 7; trail++) floorDecal('matte', CELL.bloodSmear, -5.5 + Math.sin(trail) * 0.35, -43 - trail * 1.55, 1.1, 2.3, 0.15 + Math.sin(trail * 1.7) * .15, COL.oldBlood, 0);
      torch(-4.9, -37.6, 2.1, true);
      torch(5.1, -56.5, 2.1, false);
      chain(10.9, 3.3, -45.2, 2.45, 'y');
      chain(-9.3, 3.3, -46.1, 2.85, 'y');
      candleCluster(-7.1, -47.1, 5);
      candleCluster(8.6, -46.8, 4);

      // IV. Offering hall: a broad engraved nave between four tall columns.
      [-9, 9].forEach(function (x) {
        [-68, -80].forEach(function (z) { pillar(x, z, 4.25, true); });
      });
      floorRing(0, -74, 6.2, 0.16, 'dark~p');
      floorRing(0, -74, 5.7, 0.07, 'bloodGroove', 1);
      floorRing(0, -74, 3.6, 0.12, 'bloodGroove');
      for (var ri = 0; ri < 12; ri++) {
        var ra = ri / 12 * Math.PI * 2;
        box('dark', Math.sin(ra) * 4.75, 0.027, -74 + Math.cos(ra) * 4.75, 0.16, 0.024, 0.85, ra, 1);
        box('brass', Math.sin(ra) * 5.25, 0.032, -74 + Math.cos(ra) * 5.25, 0.35, 0.028, 0.075, ra, 2);
      }
      slab(-7.4, -83.2, 0, false);
      box('blood', -7.4, 1.025, -83.3, 0.65, 0.022, 1.65, 0, 1);
      alcove(-7.4, -81.63, 1.16, .6, 0, 'saint');
      alcove(-6.63, -83.88, .98, .59, Math.PI / 2, 'saint');
      alcove(-6.63, -82.58, .98, .59, Math.PI / 2, 'saint');
      var altarVeil = new T.PlaneGeometry(.72, 4, 10, 26), veilPositions = altarVeil.attributes.position;
      for (var v = 0; v < veilPositions.count; v++) {
        var vx = veilPositions.getX(v), progress = (veilPositions.getY(v) + 2) / 4;
        var drop = Math.max(0, progress - .77) / .23;
        veilPositions.setXYZ(v, vx, 1.075 - drop * .8 + Math.sin(vx * 23) * (.009 + drop * .035),
          -1.48 + Math.min(progress / .77, 1) * 3.16 + drop * .06);
      }
      altarVeil.computeVertexNormals(); uniqueGeometries.push(altarVeil);
      architectureMesh(altarVeil, 'cloth', -7.4, 0, -83.2, 0, 1, false);
      put('link', 'brass', -7.4, .52, -81.43, .08, .17, .045, 0, 0, 0, 1);
      candleCluster(-5.6, -83.3, 9);
      candleCluster(-9.3, -83.3, 7);
      torch(-5.8, -64, 2.5, false);
      torch(5.8, -82.8, 2.5, true);
      banner(-5.3, -85.45, 1.23);
      banner(5.3, -85.45, 1.23);
      for (var hs = 0; hs < 3; hs++) chain(-11.6 + hs * 0.48, 3.35, -73, 1.6 + hs * 0.35, 'y');
      rubble(10.7, -74.4, 18, 1.15);

      // V. Ossuary: layered niches, scattered remains and collapsed masonry.
      [-9.7, 7.7].forEach(function (x) {
        (x > 0 ? [-94, -108] : [-95, -101.5, -108]).forEach(function (z) {
          solid(x, z, 1.65, 3.3);
          box('dark', x, 0.95, z, 1.6, 1.9, 3.25);
          [0.36, 1.04, 1.73].forEach(function (y) {
            box('pale', x, y, z, 1.85, 0.15, 3.4);
            for (var sk = 0; sk < 4; sk++) skull(x + (x < 0 ? 0.61 : -0.61), z - 1.03 + sk * 0.65, 0.82,
              x < 0 ? Math.PI / 2 : -Math.PI / 2, y + 0.07);
          });
        });
      });
      boneScatter(-7, -97.7, 18, 1.25);
      boneScatter(5.9, -103, 12, 0.8);
      ribCage(-6.6, -110.2, -0.85);
      rubble(-7.6, -106.2, 18, 1.25);
      torch(-5.5, -92, 2.25, false);
      torch(5.2, -110.4, 2.25, true);
      chain(-10.7, 3.2, -98.2, 2.6, 'y');
      chain(8.7, 3.2, -103, 2.35, 'y');
      puddle(-4.9, -102, 0.7, 1.3, 'blood');

      // VI. A quiet, warm sanctuary before the final gate. Its floor marker is
      // entirely flat so reaching/restoring the checkpoint is always reliable.
      floorRing(0, -128, 2.0, 0.12, 'sanctuary');
      floorRing(0, -128, 1.72, 0.045, 'brass', 1);
      for (var cp = 0; cp < 8; cp++) {
        var ca = cp / 8 * Math.PI * 2;
        box('sanctuary', Math.sin(ca) * 1.35, 0.025, -128 + Math.cos(ca) * 1.35, 0.08, 0.03, 0.22, ca);
      }
      torch(3.5, -128.3, 2.35, true, true);
      torch(-3.5, -128.3, 2.35, false, true);
      [-5.6, 5.6].forEach(function (x) {
        pillar(x, -119.7, 3.9, false);
        box('stone', x*.85, 0.42, -124.1, 2.15, 0.84, 0.8);
        solid(x*.85, -124.1, 2.15, 0.8);
        candleCluster(x, -130.7, 11);
      });
      banner(-5.4, -133.4, 0.85);
      banner(5.4, -133.4, 0.85);

      // VII. The execution court. Pillars stay outside the arena's eight-metre
      // combat ring; the monumental sealed gate is behind the boss.
      [-12, 12].forEach(function (x) {
        [-145, -164].forEach(function (z) { pillar(x, z, 5.5, true); });
      });
      floorRing(0, -155, 9.8, 0.2, 'dark~p');
      floorRing(0, -155, 9.2, 0.065, 'groove', 1);
      floorRing(0, -155, 6.2, 0.12, 'dark~p');
      floorRing(0, -155, 2.3, 0.08, 'groove');
      for (var bi = 0; bi < 16; bi++) {
        var ba = bi / 16 * Math.PI * 2;
        box('dark', Math.sin(ba) * 8.0, 0.027, -155 + Math.cos(ba) * 8.0, 0.16, 0.024, 1.55, ba, 1);
        box('brass', Math.sin(ba) * 9.45, 0.032, -155 + Math.cos(ba) * 9.45, 0.25, 0.03, 0.07, ba, 2);
      }
      torch(-8.6, -143.5, 2.75, true);
      torch(8.6, -165.8, 2.75, true);
      torch(8.6, -143.5, 2.75, false);
      torch(-8.6, -165.8, 2.75, false);
      solid(0, -170.2, 10.4, 0.64);
      solid(0, -169.615, 8.4, 0.55);
      box('foundation', 0, 3.15, -170.2, 10.4, 6.3, 0.64);
      for (var door = -5; door <= 5; door++) {
        box('iron', door * 0.74, 2.8, -169.75, 0.55, 5.6, 0.28);
        box('rust', door * 0.74, 2.8, -169.57, 0.075, 5.25, 0.055, 0, 1);
      }
      [1.2, 3.5, 5.1].forEach(function (y) {
        box('iron', 0, y, -169.48, 8.4, 0.23, 0.28);
        for (var bolt = -4; bolt <= 4; bolt++) put('knob', 'brass', bolt * 0.89, y, -169.29, 0.055, 0.055, 0.04, 0, 0, 0, 1);
      });
      [-1, 1].forEach(function (s) {
        pillar(s * 5.4, -169.15, 6.6, true);
        box('dark', s * 7.4, 2.7, -170, 2.5, 5.4, 1.4);
        solid(s * 7.4, -170, 2.5, 1.4);
        banner(s * 8.0, -169.18, 1.45);
      });
      for (var ga = 0; ga < 17; ga++) {
        var theta = ga / 16 * Math.PI;
        put('box', 'dark', Math.cos(theta) * 5.45, 4.58 + Math.sin(theta) * 3.22, -169.58,
          1.2, 0.85, 1.2, 0, 0, theta - Math.PI / 2);
        put('box', 'pale', Math.cos(theta) * 5.44, 4.58 + Math.sin(theta) * 3.22, -168.92,
          0.64, 0.18, 0.075, 0, 0, theta - Math.PI / 2, 1);
      }
      box('brass', 0, 7.95, -169.55, 0.83, 1.25, 1.27);
      box('ember', 0, 4.0, -169.24, 0.105, 3.0, 0.035);
      chain(-3.7, 5.16, -169.08, 7.4, 'x');
      chain(-0.18, 6.75, -169.15, 5.5, 'y');
      boneScatter(-10, -151.2, 12, 0.95);
      boneScatter(10.6, -158, 16, 1.0);
      ribCage(11, -155, -0.4);
      rubble(-12.2, -154.5, 19, 1.0);
      rubble(12.3, -150.2, 16, 1.0);
      candleCluster(-6.7, -167, 8);
      candleCluster(6.7, -167, 8);

      // A ruined rib-vault establishes height beyond the camera's playable
      // slice. Its broken centres keep combat open; individual ribs can fade.
      rooms.forEach(function (room) {
        [room.z - room.d * .28, room.z + room.d * .28].forEach(function (z) {
          [-1, 1].forEach(function (side) { vaultRib(room, z, side); });
        });
        var north = room.z - room.d / 2 + .49;
        [-1, 1].forEach(function (side) {
          var nx = side * Math.min(room.w / 2 - 2.2, 7.5);
          var devotional = room.id === 0 || room.id === 3 || room.id === 5 || room.id === 6;
          var opened = BREACH[room.id] && Math.abs(nx) < BREACH[room.id] + 1.2;   // ajan:world-a: no niche in a fallen wall
          if (!opened) alcove(nx, north, room.id === 6 ? 2.2 : 1.85, room.id === 6 ? 4.8 : 3.95, 0, devotional ? 'saint' : false);
          if (devotional && !opened) funeraryEffigy(nx, north + .07, 0, room.id === 6 ? 1.22 : 1.03);
          var wall = room.x + side * (room.w / 2 - .49);
          for (var bay = 0; bay < 3; bay++) {
            if(bay === 1 && room.id < 6 && side === [1,-1,-1,1,1,-1][room.id]) continue;
            var atZ = room.z + (bay - 1) * room.d * .29;
            var saint = devotional && bay === 1;
            alcove(wall, atZ, room.id === 4 ? 2.6 : 2.1, room.id === 4 ? 3.1 : 3.8,
              -side * Math.PI / 2, saint ? 'saint' : room.id === 4);
            if (saint) funeraryEffigy(wall - side * .06, atZ, -side * Math.PI / 2, 1.01);
            // Deep plinths and alternating blind bays interrupt the long wall
            // without adding anything to the navigable footprint.
            put('slab0', 'dark', wall + side * .05, .15, atZ, .75, .25, 2.43, 0, 0, 0);
          }
        });
      });

      // The threshold bears the weathered seal of the old order. All relief
      // lies flush to the floor, and uses stone values rather than spell light.
      ritualPavement(0, 7.0, 2.65, false);
      floorRing(0, 7.0, 2.72, .08, 'dark~p');
      floorRing(0, 7.0, 2.27, .036, 'pale~p', 1);
      for (var seal = 0; seal < 8; seal++) {
        var a = seal * Math.PI / 4;
        box('dark', Math.sin(a) * 1.63, .016, 7 + Math.cos(a) * 1.63, .16, .02, .75, a, 1);
        box('pale', Math.sin(a) * 2.47, .016, 7 + Math.cos(a) * 2.47, .17, .02, .14, a, 1);
      }
      var incenseSources = [censer(-7.65, -.6, 4.4), censer(7.65, 5.8, 4.7),
        censer(-10.55, -73.3, 4.95), censer(10.55, -76.8, 4.95),
        censer(-6.85, -125.3, 4.25), censer(6.85, -130.2, 4.5),
        censer(-10.6, -166.2, 5.6), censer(10.6, -166.2, 5.6)];

      // Ash threshold: broken lintels, abandoned shackles and a wet descent.
      hangingIron(-7.35, 1.1, 4.7, false);
      hangingIron(7.45, 2.3, 4.8, false);
      puddle(5.8, 8.8, 1.15, 1.5);
      for (var shard = 0; shard < 13; shard++) {
        var sz = 5.8 + shard * .44;
        put('slab' + shard % 4, 'pale', -7.7 + Math.sin(shard * 2.4) * .29, .07, sz, between(.24, .48), .13, between(.24, .65), 0, rand() * 5, 0, 1);
      }
      // A collapsed, burnt roof beam and drifts of ash along the walls.
      put('box', 'charred', 7.3, .2, 10.1, .34, .32, 3.4, .1, .45, .06, 0);
      put('box', 'charred', 7.9, .45, 8.4, .3, .28, 2.2, .35, -.3, .1, 1);
      for (var ash = 0; ash < 16; ash++) {
        var side0 = ash % 2 ? 1 : -1;
        floorDecal('matte', CELL.ashPile, side0 * between(6.6, 8.2), between(-5, 13), between(1.4, 2.6), between(1.6, 3.0), null, COL.ash, ash % 3 ? 1 : 0);
      }
            floorDecal('matte', CELL.bloodSmear, -3.4, 1.4, 1.6, 3.2, .5, COL.oldBlood, 0);
      floorDecal('matte', CELL.claws, 3.6, -1.2, 1.5, 1.5, 2.2, COL.crack, 1);

      // The chain yard has a timber gallows and winch, not a second nave.
      box('wood', -9.9, 3.93, -28.8, 3.1, .29, .31);
      box('wood', -11.22, 2.05, -28.8, .28, 4.1, .3);
      rod('wood', [-11.22, 2.8, -28.8], [-10.2, 3.92, -28.8], .09, 0);
      hangingIron(-9.2, -28.8, 3.83, true, 7);
      hangedBody(-9.2, -28.8, 3.83 - 7 * .2 - .45, .4);
      floorDecal('matte', CELL.bloodPool, -9.3, -28.6, 1.3, 1.3, null, COL.oldBlood, 1);
      put('link', 'iron', wellX, 4.0, wellZ + .18, .58, .58, .34, 0, 0, 0);
      for (var waterTrail = 0; waterTrail < 6; waterTrail++) {
        floorDecal('wet', CELL.water, -8.9 + waterTrail * .75, -22.6 - Math.sin(waterTrail * .57) * 1.5, 2.4, 2.0, waterTrail * .3, COL.water, 1);
      }
      puddle(-6.4, -22.9, 1.5, .8);
      for (var plank = 0; plank < 6; plank++) {
        box('wood', 6.6 + between(-.7, .7), .043, -21.6 + between(-1.2, 1.2), .12, .07, between(.65, 1.65), between(-1, 1), 1);
      }

      // Covered cadavers and a blood drain distinguish the ruined infirmary.
      shroudedRemains(-7.5, -41.5, 0);
      shroudedRemains(9.3, -50.5, .015);
      shroudedRemains(-7.5, -50.5, -.025);
      hangingIron(10.15, -42.6, 4.65, false);
      for (var drainage = 0; drainage < 13; drainage++) {
        var at = -39 - drainage * 1.28;
        box('dark', 6.55, -.005, at, .4, .024, 1.22, 0, 0);
        for (var slat = 0; slat < 4; slat++) box('iron', 6.55, .012, at + slat * .25 - .37, .37, .025, .035, 0, 1);
        floorDecal(drainage % 3 ? 'wet' : 'matte', drainage % 3 ? CELL.bloodSmear : CELL.mould, 6.55 + between(-.12, .12), at, .9, 1.6, 0, drainage % 3 ? COL.blood : COL.bile, 1);
      }

      // Broken concentric pavements are inset flush with the navigation floor.
      ritualPavement(0, -74, 6.05, false);
      for (var star = 0; star < 7; star++) {
        var a0 = star / 7 * Math.PI * 2, a1 = (star + 3) / 7 * Math.PI * 2;
        rod('bloodGroove', [Math.sin(a0) * 3.3, .012, -74 + Math.cos(a0) * 3.3], [Math.sin(a1) * 3.3, .012, -74 + Math.cos(a1) * 3.3], .045, 0);
      }
      for (var glyph = 0; glyph < 16; glyph++) {
        var ga2 = glyph * Math.PI / 8;
        var gx = Math.sin(ga2) * 5.0, gz = -74 + Math.cos(ga2) * 5.0;
        box('pale', gx, .009, gz, .07, .022, .55, ga2, 1);
        box('pale', gx + Math.cos(ga2) * .12, .009, gz - Math.sin(ga2) * .12, .3, .022, .055, ga2 + .32, 1);
        box('dark', Math.sin(ga2) * 4.6, .008, -74 + Math.cos(ga2) * 4.6, .23, .02, .12, ga2 + .5, 1);
      }
      hangingIron(-9, -80, 5.1, false); hangingIron(9, -80, 5.1, false);
      // Victims were dragged down the nave to the altar; the stone kept the record.
      for (var offering = 0; offering < 7; offering++) {
        var oa = offering * .73;
        floorDecal(offering % 2 ? 'wet' : 'matte', offering % 3 ? CELL.bloodPool : CELL.bloodSpatter, -7.0 + Math.cos(oa) * 1.7, -80.5 + Math.sin(oa) * 2, 1.6, 2.4, oa, offering % 2 ? COL.blood : COL.oldBlood, 0);
      }
      for (var drag = 0; drag < 6; drag++) floorDecal('matte', CELL.bloodSmear, -1.2 - drag * 1.0 + Math.sin(drag) * .3, -66 - drag * 2.5, 1.3, 2.9, .38 + Math.sin(drag * 2.1) * .12, COL.oldBlood, 0);
      floorDecal('wet', CELL.bloodDrip, -7.4, -81.5, 1.1, 1.5, Math.PI, COL.blood, 0);
      wallDecal('wet', CELL.bloodDrip, -7.4, 1.05, -81.72, .7, 1.1, 0, COL.blood, 1);

      // The ossuary grows from funerary shelves into arched wall crypts.
      [-9.7, 7.7].forEach(function (x) {
        (x > 0 ? [-94, -108] : [-95, -101.5, -108]).forEach(function (z) {
          var side = x < 0 ? -1 : 1;
          alcove(x - side * .83, z, 2.93, 2.4, -side * Math.PI / 2, true);
          for (var pile = 0; pile < 7; pile++) {
            var pz = z + between(-1.1, 1.1), px = x - side * .5;
            skull(px, pz, between(.7, 1.0), -side * Math.PI / 2, between(.31, 1.4));
          }
          floorDecal('matte', CELL.specks, x - side * 1.6, z, 1.8, 3.6, 0, COL.dust, 1);
        });
      });
      for (var remnants = 0; remnants < 9; remnants++) {
        var rz = -93 - remnants * 1.9;
        boneScatter(-7.0 + Math.sin(remnants * 2) * .5, rz, 4, .45);
      }
      for (var dust = 0; dust < 10; dust++) floorDecal('matte', dust % 2 ? CELL.specks : CELL.ashPile, between(-8, 6), between(-111, -91), between(1.2, 2.4), between(1.2, 2.4), null, dust % 2 ? COL.dust : COL.ash, 1);

      // Sanctuary: a worn ivory medallion and candle avenues amid the ruins.
      ritualPavement(0, -128, 2.3, true);
      floorRing(0, -128, 2.38, .065, 'brass', 1);
      for (var shrine = 0; shrine < 6; shrine++) {
        candleCluster(-4.6, -121.8 - shrine * 1.55, 4);
        candleCluster(4.6, -121.8 - shrine * 1.55, 4);
      }
      for (var sigil = 0; sigil < 6; sigil++) {
        var sa = sigil / 6 * Math.PI * 2;
        box('brass', Math.sin(sa) * .77, .018, -128 + Math.cos(sa) * .77, .055, .028, .87, sa + .5, 1);
      }

      // Execution court: radial masonry, chained masks and a broken crown.
      ritualPavement(0, -155, 9.75, false);
      for (var execution = 0; execution < 11; execution++) {
        floorDecal(execution % 3 ? 'matte' : 'wet', execution % 2 ? CELL.bloodSmear : CELL.bloodPool, Math.sin(execution * 1.8) * .65, -159 - execution * .82, 1.8, 2.4, execution * .3, execution % 3 ? COL.oldBlood : COL.blood, 0);
      }
      for (var arena = 0; arena < 9; arena++) {
        var aa = arena / 9 * Math.PI * 2 + .3, ar = between(4.5, 8.5);
        floorDecal('matte', arena % 2 ? CELL.bloodSpatter : CELL.claws, Math.sin(aa) * ar, -155 + Math.cos(aa) * ar, between(1.6, 2.6), between(1.6, 2.6), null, arena % 2 ? COL.oldBlood : COL.crack, 1);
      }
      skull(-2.6, -169.27, 2.75, 0, 3.24);
      skull(2.6, -169.27, 2.75, 0, 3.24);
      [-1, 1].forEach(function (sign) {
        for (var spike = 0; spike < 5; spike++) {
          var sx = sign * (1.1 + spike * .78), sy = 6.02 + spike * .11, sh = .8 + spike * .09;
          put('cone', 'iron', sx, sy, -169.2, .15, sh, .15, 0, 0, sign * -.11, 1);
          // Heads of the condemned on the gate's spikes.
          if (spike % 2 === 0) skull(sx + sign * .03, -169.2, .95, (rand() - .5) * .6, sy + sh * .12);
        }
        chain(sign * 11.0, .15, -166.2, 21, 'z', 1);
        hangingIron(sign * 6.7, -167.5, 6.3, false);
      });

      // Narrow strips of dust, broken stone and grime tie the rooms together.
      rooms.forEach(function (room) {
        [-1, 1].forEach(function (side) {
          for (var i = 0; i < 4; i++) {
            var px = room.x + side * (room.w / 2 - between(0.8, 1.3));
            var pz = room.z - room.d / 2 + 2.5 + i * (room.d - 5) / 3;
            rubble(px, pz, 5, 0.55);
          }
          // Water and filth have run down the long walls for centuries. Streaks only go on bare
          // masonry: never across alcoves, pilasters or vault piers.
          var face = room.x + side * (room.w / 2 - .47), faceAngle = -side * Math.PI / 2;
          var busy = [];
          for (var bay = -1; bay <= 1; bay++) busy.push([room.z + bay * room.d * .29, room.id === 4 ? 1.5 : 1.3]);
          [-1, 1].forEach(function (k) { busy.push([room.z + k * room.d * .33, .95]); busy.push([room.z + k * room.d * .28, .8]); });
          for (var s = 0; s < 14; s++) {
            var wz = room.z - room.d / 2 + .9 + s * (room.d - 1.8) / 13;
            if (busy.some(function (b) { return Math.abs(wz - b[0]) < b[1] + .45; })) continue;
            var wet = room.id === 1 || room.id === 2;
            wallDecal('matte', wet && s % 2 ? CELL.rustStreak : CELL.grimeStreak, face, room.id === 6 ? 4.3 : 3.1, wz, between(.8, 1.3), between(2.6, 3.6), faceAngle,
              wet && s % 2 ? COL.rust : COL.grime, s % 2);
          }
          var north = room.z - room.d / 2 + 0.47, niche = side * Math.min(room.w / 2 - 2.2, 7.5);
          for (var damp = 0; damp < 3; damp++) {
            var wx = side * (4.4 + damp * 1.35); if (BREACH[room.id] && Math.abs(wx) < BREACH[room.id] + .9) continue;
            if (wx > room.x - room.w / 2 + 0.8 && wx < room.x + room.w / 2 - 0.8 && Math.abs(wx - niche) > 1.75) {
              wallDecal('matte', CELL.grimeStreak, wx, between(2.6, 3.4), north, between(0.9, 1.65), between(2.4, 3.2), 0, COL.grime, 1);
            }
          }
        });
      });
      // Wall-mounted fire bowls on the pilasters: warm pools against the cold ambient.
      var sconceRooms = { 0: [-1, 1], 1: [1], 2: [], 3: [-1, 1], 4: [-1], 5: [], 6: [-1, 1] };
      rooms.forEach(function (room) {
        (sconceRooms[room.id] || []).forEach(function (side) {
          [room.z - room.d * 0.33, room.z + room.d * 0.33].forEach(function (z) {
            var px = room.x + side * (room.w / 2 - 0.6);
            sconce(px - side * .44, z, room.id === 6 ? 2.7 : 2.35, -side * Math.PI / 2, false);
          });
        });
      });
      // Sickly lamps hang over the infirmary.
      function sickLamp(x, z, y) {
        var parts = { iron: [], sickEmber: [] };
        for (var i = 0; i < 6; i++) parts.iron.push(part('link', 0, -i * .2, 0, .1, .17, .1, 0, i % 2 * Math.PI / 2, 0));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { parts.iron.push(part('box', c[0] * .16, -1.55, c[1] * .16, .035, .5, .035)); });
        parts.iron.push(part('cone', 0, -1.22, 0, .26, .2, .26)); parts.iron.push(part('octagon', 0, -1.8, 0, .24, .05, .24));
        parts.sickEmber.push(part('octagon', 0, -1.76, 0, .12, .04, .12));
        var g = hangerGroup(x, y, z, parts, false);
        var f = flame(x, y - 1.58, z, .3, .45, 'sick', true, true);
        var s = lightSource(x, y - 1.55, z, '#a9d75c', 15, 10.5, .8, { kind: 'lamp' });
        swinging(g, s, f, .012, .9);
      }
      // Hung props swing from the dark vault (pivot at the top of their chain), and their fire and light move with them.
      var swings = [];
      function swinging(group, source, flameDef, amp, speed) {
        movingHangers.splice(movingHangers.findIndex(function (h) { return h.root === group; }), 1);
        var pivot = new T.Group(); pivot.position.set(group.position.x, 11, group.position.z); root.add(pivot);
        var i = decorationBatches.indexOf(group); if (i >= 0) decorationBatches[i] = pivot;
        pivot.userData.detail = group.userData.detail; root.remove(group); group.position.set(0, group.position.y - 11, 0); pivot.add(group);
        swings.push({ pivot: pivot, source: source, flame: flameDef, amp: amp, speed: speed, phase: rand2() * 6.28,
          ls: source ? 11 - source.y : 0, lf: flameDef ? 11 - flameDef.y : 0 });
      }
      sickLamp(-2.8, -42.6, 4.6); sickLamp(4.2, -52.8, 4.6);
      // Hanging fire braziers around the execution ring; they smoulder until the executioner rises (lighting.js).
      function hangingBrazier(x, z, y, index) {
        var parts = { iron: [], ember: [], charred: [] };
        for (var side = 0; side < 3; side++) {
          var an = side / 3 * Math.PI * 2;
          for (var i = 0; i < 7; i++) { var t = i / 6; parts.iron.push(part('link', Math.sin(an) * t * .5, -t * 1.4, Math.cos(an) * t * .5, .09, .17, .09, 0, i % 2 * Math.PI / 2, 0)); }
        }
        parts.iron.push(part('bowl', 0, -1.55, 0, .62, .5, .62));
        parts.ember.push(part('octagon', 0, -1.53, 0, .36, .05, .36));
        for (var coal = 0; coal < 7; coal++) { var ca2 = coal / 7 * 6.28; parts.charred.push(part('knob', Math.cos(ca2) * .3, -1.48, Math.sin(ca2) * .3, .13, .09, .12, 0, ca2, 0)); }
        var g = hangerGroup(x, y, z, parts, false);
        var f = flame(x, y - .95, z, .82, 1.22, 'court', true, true, { group: 'brazier' + index });
        var s = lightSource(x, y - .9, z, '#ff6424', 22, 15, 1.2, { kind: 'brazier', group: 'brazier' + index, tintGroup: 'court', scatter: .7, glowRadius: 1.05 });
        swinging(g, s, f, .018, 1.2);
        emberSources.push({ x: x, y: y - 1.2, z: z, count: 18, spread: .45, rise: 3.2, group: 'brazier' + index });
        smokeSources.push({ x: x, y: y - .7, z: z, count: 7, rate: .09, rise: 3.2, spread: .45, size: 1.6, alpha: .15, color: [.05, .04, .035], group: 'brazier' + index });
        floorDecal('matte', CELL.soot, x, z, 2.6, 2.6, null, COL.soot, 0);
        floorDecal('glow', CELL.glow, x, z, 4.4, 4.4, 0, linear(.05, .0165, .0044), 0);
      }
      [[-10.6, -150.5], [10.6, -150.5], [-10.6, -159.5], [10.6, -159.5]].forEach(function (p, i) { hangingBrazier(p[0], p[1], 5.3, i); });

      // Shader wear hot-spots: blood where the rites happened, ash under fires, damp by the well.
      spot(0, 4, 9.5, 1, .55); spot(0, 9, 3.8, 1, .4);
      spot(wellX, wellZ, 5.5, 2, .9); spot(-4.6, -25, 3.5, 2, .7); spot(-9.9, -28.8, 3, 0, .5);
      spot(6.55, -47, 7.5, 0, .5); spot(-7.5, -46, 5.5, 3, .6); spot(8.5, -50.5, 3.5, 0, .45);
      spot(-7.4, -83.2, 4.5, 0, .9); spot(0, -74, 4.2, 0, .45); spot(-3.5, -72, 7, 0, .3);
      spot(-7, -97.7, 5, 4, .6); spot(5.9, -103, 4, 4, .5);
      spot(0, -128, 3.2, 4, .25);
      spot(0, -157, 10.5, 0, .55); spot(0, -167, 4.5, 0, .5); spot(-10.6, -155, 6, 1, .5); spot(10.6, -155, 6, 1, .5);
      spots.forEach(function (s, i) { G.gSpots.value[i].copy(s); });

      // ---- pass-2 practical lights: the chain yard's lantern, the rite's heart, the oath stone ----------------
      // A caged lantern on a long chain swings over the chain yard; its light and shadows move with it.
      (function chainLantern(x, z, top) {
        var parts = { iron: [], hot: [] };
        for (var i = 0; i < 5; i++) parts.iron.push(part('link', 0, -i * .19, 0, .085, .15, .085, 0, i % 2 * Math.PI / 2, 0));
        parts.iron.push(part('cone', 0, -1.02, 0, .24, .2, .24)); parts.iron.push(part('ball', 0, -.9, 0, .05, .05, .05));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { parts.iron.push(part('box', c[0] * .15, -1.33, c[1] * .15, .03, .52, .03)); });
        parts.iron.push(part('octagon', 0, -1.61, 0, .22, .05, .22)); parts.iron.push(part('octagon', 0, -1.1, 0, .2, .04, .2));
        parts.iron.push(part('box', 0, -1.33, .15, .3, .025, .02)); parts.iron.push(part('box', 0, -1.33, -.15, .3, .025, .02));
        parts.hot.push(part('octagon', 0, -1.55, 0, .07, .06, .07));
        var seedKeep = seed, g = hangerGroup(x, top, z, parts, false); seed = seedKeep; // keep the original layout's random sequence
        var f = flame(x, top - 1.42, z, .26, .42, 'fire', true, true, { phase: 4.1 });
        var s = lightSource(x, top - 1.33, z, '#ff8a3c', 30, 12, 1.1, { kind: 'lantern', phase: 1.3 });
        swinging(g, s, f, .06, 1.14);
        emberSources.push({ x: x, y: top - 1.3, z: z, count: 3, spread: .1, rise: 1.2, follow: f });
      }(1.4, -23.6, 4.8));
      // The heart of the rite: a crimson glow under the carved star, and a ring of black candles at its points.
      lightSource(0, .35, -74, '#ff5a1e', 16, 11, .35, { kind: 'special', group: 'ritual', phase: 2, scatter: 1.1, glowRadius: 2.2 });
      function candleRing(x, z, count, group) {
        for (var i = 0; i < count; i++) {
          var px = x + between2(-.28, .28), pz = z + between2(-.25, .25), h = between2(.18, .42);
          put('pole', 'wax', px, h / 2, pz, 0.05, h, 0.05, 0, 0, 0, 1);
          put('round', 'wax', px, 0.02, pz, 0.09, 0.03, 0.07, 0, 0, 0, 2);
          flame(px, h + .07, pz, .07, .14, 'fire', false, false, { phase: rand2() * 10 });
        }
        lightSource(x, .8, z, '#ff9a50', 2.6 + count * .5, 4.5, .6, { kind: 'candle', group: group, phase: rand2() * 10 });
        decal('matte', CELL.wax, x, .005, z, .8, .75, rand2() * 6, COL.wax, 1);
      }
      for (var rc = 0; rc < 7; rc++) { var ra = rc / 7 * Math.PI * 2 + .22; candleRing(Math.sin(ra) * 6.75, -74 + Math.cos(ra) * 6.75, 3, 'ritualCandles'); }
      // The oath stone's own light: a faint call before it is sworn, a golden flood afterwards.
      lightSource(0, .75, -128, '#ffc066', 16, 9, .15, { kind: 'special', group: 'oath', phase: 5, scatter: 1.4, glowRadius: 1.8 });
      /* ajan:world-a — side crypts and extra dressing are composed in worlda-temple.js with this file's own kit. */
      if (BABA.WorldATemple && BABA.WorldATemple.active) BABA.WorldATemple.dress({ T: T, put: put, box: box, rod: rod, solid: solid, wallRun: wallRun, pillar: pillar,
        floorDecal: floorDecal, wallDecal: wallDecal, decal: decal, CELL: CELL, COL: COL, linear: linear, geometries: geometries, materials: materials, rooms: rooms,
        skull: skull, boneScatter: boneScatter, ribCage: ribCage, rubble: rubble, slab: slab, cage: cage, chain: chain, candleCluster: candleCluster, alcove: alcove,
        vaultRib: vaultRib, funeraryEffigy: funeraryEffigy, censer: censer, hangingIron: hangingIron, hangedBody: hangedBody, shroudedRemains: shroudedRemains,
        puddle: puddle, banner: banner, torch: torch, sconce: sconce, flame: flame, lightSource: lightSource, emberSources: emberSources, smokeSources: smokeSources,
        part: part, hangerGroup: hangerGroup, swinging: swinging, floorRing: floorRing, ritualPavement: ritualPavement, architectureMesh: architectureMesh, spot: spot, setChunkBias: function (b) { chunkBias = b || 0; }, portalHalf: portalHalf, floors: floors, breach: BREACH, root: root, mergeParts: mergeParts, uniqueMaterials: uniqueMaterials, uniqueGeometries: uniqueGeometries });
      /* /ajan:world-a */

      // ---- light shafts and particles ----------------------------------------------------------------------
      // [top xyz, floor xyz, top width, floor width, colour, strength, cookie, gain group]
      var shafts = [
        [2.6, 12, .2, .3, .05, 6.4, 1.3, 3.2, [.5, .62, .9], .21, 'grate', null],
        [-6.2, 11, -52.5, -3.4, .05, -47.4, 1.0, 2.6, [.62, .72, .34], .19, 'crack', null],
        [-10.2, 11, -88, -7.4, 1.05, -83.2, .8, 2.0, [.78, .72, .66], .18, 'lancet', null],
        [5.2, 12, -104.5, 1.8, .05, -97.8, 1.0, 2.6, [.6, .7, .92], .18, 'crack', null],
        [-6.4, 12, -112, -3.2, .05, -105.2, .9, 2.2, [.6, .7, .92], .15, 'crack', null],
        [0, 13, -134.5, 0, .05, -128, 1.2, 3.6, [1.0, .8, .52], .22, 'lancet', 'oathShaft'],
        [0, 14.5, -167, 0, .05, -157, 1.8, 6.4, [.55, .6, .85], .13, 'oculus', 'courtMoon']
      ];
      shafts.forEach(function (s) {
        floorDecal('glow', CELL.glow, s[3], s[5], s[7] * 1.05, s[7] * .9, Math.atan2(s[3] - s[0], s[5] - s[2]), linear(s[8][0] * s[9] * .6, s[8][1] * s[9] * .6, s[8][2] * s[9] * .6), 1);
      });
      var shaftMesh = null, shaftGain = [];
      for (var sg = 0; sg < 8; sg++) shaftGain.push(1);
      (function buildShafts() {
        var segs = 10, count = shafts.length, vpp = (segs + 1) * 2;
        var A = new Float32Array(count * vpp * 3), Bv = new Float32Array(count * vpp * 3), P = new Float32Array(count * vpp * 3), W = new Float32Array(count * vpp * 2), C = new Float32Array(count * vpp * 4);
        var index = [];
        shafts.forEach(function (s, n) {
          for (var i = 0; i <= segs; i++) for (var j = 0; j < 2; j++) {
            var k = n * vpp + i * 2 + j;
            A.set([s[0], s[1], s[2]], k * 3); Bv.set([s[3], s[4], s[5]], k * 3); P.set([j - .5, i / segs, n], k * 3);
            W.set([s[6] * 1.1, s[7] * .85], k * 2); C.set([s[8][0], s[8][1], s[8][2], s[9]], k * 4);
          }
          for (var q = 0; q < segs; q++) { var b0 = n * vpp + q * 2; index.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2); }
        });
        var g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(P.slice(), 3)); g.setAttribute('aA', new T.BufferAttribute(A, 3)); g.setAttribute('aB', new T.BufferAttribute(Bv, 3));
        g.setAttribute('aP', new T.BufferAttribute(P, 3)); g.setAttribute('aW', new T.BufferAttribute(W, 2)); g.setAttribute('aCol', new T.BufferAttribute(C, 4));
        g.setIndex(index); uniqueGeometries.push(g);
        // Volumetric beams: soft core, drifting dust density, slow cloud shadow, dimmer where they meet the floor.
        var m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
          uniforms: { uNoise: { value: noiseMap }, uTime: flameUniforms.time, uGain: { value: shaftGain } },
          vertexShader: 'attribute vec3 aA; attribute vec3 aB; attribute vec3 aP; attribute vec2 aW; attribute vec4 aCol; uniform float uGain[8]; varying vec3 vP; varying vec4 vCol; varying float vFace;' +
            'void main(){ vec3 axis=aB-aA; vec3 dir=normalize(axis); vec3 wp=mix(aA,aB,aP.y); vec3 toCam=normalize(cameraPosition-wp); vec3 side=normalize(cross(dir,toCam));' +
            ' wp+=side*aP.x*mix(aW.x,aW.y,aP.y); vP=aP; int si=int(aP.z+.5); vCol=vec4(aCol.rgb,aCol.a*uGain[si]); vFace=abs(dot(dir,toCam)); gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.0); }',
          fragmentShader: 'uniform sampler2D uNoise; uniform float uTime; varying vec3 vP; varying vec4 vCol; varying float vFace;' +
            'void main(){ float x=abs(vP.x)*2.0; float across=exp(-x*x*2.6)*(1.0-smoothstep(0.82,1.0,x));' +
            ' float along=smoothstep(0.0,0.22,vP.y)*(1.0-smoothstep(0.78,1.0,vP.y));' +
            ' float z=vP.z*0.37; float n=texture2D(uNoise,vec2(vP.x*0.35+z,vP.y*0.6-uTime*0.012)).g; float n2=texture2D(uNoise,vec2(vP.x*0.9-z,vP.y*1.4-uTime*0.025)).b;' +
            ' float streak=0.75+0.5*texture2D(uNoise,vec2(vP.x*1.7+z*3.0,vP.y*0.08+uTime*0.003)).r;' +
            ' float cloud=0.78+0.22*sin(uTime*0.21+vP.z*1.7)*sin(uTime*0.13+vP.z);' +
            ' float a=across*along*(0.4+n*0.75)*(0.7+n2*0.5)*streak*cloud*vCol.a*0.46*(1.0-vFace*0.5); gl_FragColor=vec4(vCol.rgb*a,1.0); }' });
        uniqueMaterials.push(m);
        shaftMesh = new T.Mesh(g, m); shaftMesh.frustumCulled = false; shaftMesh.renderOrder = 6; shaftMesh.userData.detail = 1;
        root.add(shaftMesh); decorationBatches.push(shaftMesh);
      }());
      // Point sprites: embers (additive), smoke and ash (alpha), dust motes (additive), flies.
      var particleSystems = [];
      function particles(count, map, additive, name) {
        var g = new T.BufferGeometry(), pos = new Float32Array(count * 3), size = new Float32Array(count), col = new Float32Array(count * 4);
        g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSize', new T.BufferAttribute(size, 1)); g.setAttribute('aColor', new T.BufferAttribute(col, 4));
        uniqueGeometries.push(g);
        var m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, toneMapped: false,
          uniforms: { uMap: { value: map }, uScale: { value: 400 } },
          vertexShader: 'attribute float aSize; attribute vec4 aColor; uniform float uScale; varying vec4 vC; void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uScale/max(0.5,-mv.z); if(aColor.a<0.002) gl_PointSize=0.0; }',
          fragmentShader: 'uniform sampler2D uMap; varying vec4 vC; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); float a=vC.a*t.a; if(a<0.003) discard; gl_FragColor=vec4(vC.rgb*t.rgb,a); }' });
        uniqueMaterials.push(m);
        var points = new T.Points(g, m); points.frustumCulled = false; points.name = name; points.renderOrder = additive ? 8 : 4;
        var drawSize = new T.Vector2();
        points.onBeforeRender = function (renderer, s, camera) { renderer.getDrawingBufferSize(drawSize); m.uniforms.uScale.value = drawSize.y / (2 * Math.tan((camera.fov || 45) * Math.PI / 360)); };
        root.add(points);
        var sys = { points: points, pos: pos, size: size, col: col, count: count, geometry: g };
        particleSystems.push(sys); return sys;
      }
      var softSprite = MAT.sprite('soft'), smokeSprite = MAT.sprite('smoke');
      var emberTotal = 0; emberSources.forEach(function (s) { s.offset = emberTotal; emberTotal += s.count; });
      var smokeTotal = 0; smokeSources.forEach(function (s) { s.offset = smokeTotal; smokeTotal += s.count; });
      var embersSys = particles(emberTotal, softSprite, true, 'embers');
      var smokeSys = particles(smokeTotal, smokeSprite, false, 'smoke');
      var ashCount = 150, ashSys = particles(ashCount, softSprite, false, 'ash');
      var ashSeeds = new Float32Array(ashCount * 4);
      for (var as = 0; as < ashCount; as++) {
        var inCourt = as >= 100;
        ashSeeds[as * 4] = inCourt ? between(-13, 13) : between(-8, 8); ashSeeds[as * 4 + 1] = inCourt ? between(-170, -140) : between(-5.5, 13.5);
        ashSeeds[as * 4 + 2] = rand(); ashSeeds[as * 4 + 3] = between(.6, 1.4);
      }
      var MOTES_PER_SHAFT = 44, moteCount = shafts.length * MOTES_PER_SHAFT, moteSys = particles(moteCount, softSprite, true, 'motes');
      var moteSeeds = new Float32Array(moteCount * 4);
      for (var mt = 0; mt < moteCount; mt++) {
        var rr = mt < shafts.length * 26 ? rand : rand2;
        moteSeeds[mt * 4] = rr(); moteSeeds[mt * 4 + 1] = rr() - .5; moteSeeds[mt * 4 + 2] = rr() - .5; moteSeeds[mt * 4 + 3] = rr();
      }
      var flyCount = 64, flySys = particles(flyCount, softSprite, false, 'flies');
      // Static homes over the dead of the infirmary and the hanged man; fresh corpses attract the rest (setCorpses).
      var flyHomes = [[-7.5, 1.3, -41.5], [9.3, 1.3, -50.5], [-7.5, 1.3, -50.5], [-9.2, 1.2, -28.8], [0, -99, 0], [0, -99, 0], [0, -99, 0], [0, -99, 0]];
      // Gold motes rise around the oath stone once it is sworn; blood and water drip into the pools below.
      var oathCount = 70, oathSys = particles(oathCount, softSprite, true, 'oath-motes'), oathLevel = 0, oathLit = false;
      var DRIPS = [[-9.2, 2.35, -28.6, 1], [-7.4, 1.0, -81.5, 1], [wellX + .3, 3.7, wellZ + .2, 0], [6.5, 4.4, -48.2, 0], [-4.8, 4.2, .9, 0], [-4.9, 4.1, -102, 1], [5.8, 4.3, 8.8, 0], [-6.4, 4.4, -22.9, 0]];
      if (BABA.WorldATemple && BABA.WorldATemple.active && BABA.WorldATemple.drips) DRIPS = DRIPS.concat(BABA.WorldATemple.drips.map(function (d) { return d.slice(0, 4); }));   // ajan:world-a
      DRIPS.forEach(function (d) { d.push(rand2() * 3, 1.2 + rand2() * 1.6); });
      var dripSys = particles(DRIPS.length * 2, softSprite, false, 'drips');
      // Ripple rings where the drops land (instanced, shader-animated).
      var rippleMesh = (function () {
        var g = geometries.plane.clone(); g.rotateX(-Math.PI / 2); uniqueGeometries.push(g);
        var phase = new Float32Array(DRIPS.length * 2);
        DRIPS.forEach(function (d, i) { phase[i * 2] = d[4]; phase[i * 2 + 1] = d[5]; });
        g.setAttribute('aDrip', new T.InstancedBufferAttribute(phase, 2));
        var m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
          uniforms: { uTime: flameUniforms.time },
          vertexShader: 'attribute vec2 aDrip; varying vec2 vUv; varying float vAge; varying float vKind; uniform float uTime; void main(){ vUv=uv; float fall=sqrt(2.0*max(instanceMatrix[3].w,0.0)/9.8); vAge=fract((uTime+aDrip.x)/aDrip.y)*aDrip.y-fall; vKind=instanceMatrix[1].w; vec4 p=instanceMatrix*vec4(position,1.0); gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(p.xyz,1.0); }',
          fragmentShader: 'varying vec2 vUv; varying float vAge; varying float vKind; void main(){ if(vAge<0.0) discard; float r=length(vUv-0.5)*2.0; float t=vAge/1.1; if(t>1.0) discard; float delta=(r-t*0.95)/0.07; float ring=exp(-delta*delta)*(1.0-t)*(1.0-t); vec3 c=mix(vec3(0.5,0.6,0.62),vec3(0.55,0.06,0.04),vKind); gl_FragColor=vec4(c*ring*0.55,1.0); }' });
        uniqueMaterials.push(m);
        var mesh = new T.InstancedMesh(g, m, DRIPS.length); mesh.frustumCulled = false; mesh.renderOrder = -3;
        DRIPS.forEach(function (d, i) {
          tmp.position.set(d[0], .03, d[2]); tmp.rotation.set(0, 0, 0); tmp.scale.set(.9, 1, .9); tmp.updateMatrix();
          var e = tmp.matrix.elements; e[15] = 1; mesh.setMatrixAt(i, tmp.matrix);
        });
        // Encode drop height (w of column 3) and blood/water (w of column 1) into the instance matrix's free slots.
        var arr = mesh.instanceMatrix.array;
        DRIPS.forEach(function (d, i) { arr[i * 16 + 15] = d[1]; arr[i * 16 + 7] = d[3]; });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.detail = 1; root.add(mesh); decorationBatches.push(mesh);
        return mesh;
      }());

      // ---- instanced flames ---------------------------------------------------------------------------
      var flameMeshes = [];
      (function buildFlames() {
        var groups = Object.create(null);
        flameDefs.forEach(function (f) { var key = f.palette + ':' + f.chunk; (groups[key] = groups[key] || []).push(f); });
        Object.keys(groups).forEach(function (key) {
          var list = groups[key], pal = list[0].palette;
          var outer = new T.InstancedMesh(ownGeometry(geometries.plane), pal === 'sick' ? materials.sickFlame : pal === 'court' ? materials.courtFlame : materials.livingFlame, list.length);
          var cores = list.filter(function (f) { return f.core; });
          var inner = cores.length ? new T.InstancedMesh(ownGeometry(geometries.plane), pal === 'sick' ? materials.sickCore : pal === 'court' ? materials.courtCore : materials.flameCore, cores.length) : null;
          var ci = 0;
          list.forEach(function (f, i) {
            f.outer = outer; f.oi = i;
            tmp.position.set(f.x, f.y, f.z); tmp.rotation.set(0, 0, 0); tmp.scale.set(f.w, f.h, 1); tmp.updateMatrix(); outer.setMatrixAt(i, tmp.matrix);
            if (f.core && inner) { f.inner = inner; f.ii = ci; tmp.position.set(f.x, f.y - f.h * .15, f.z); tmp.scale.set(f.w * .5, f.h * .62, 1); tmp.updateMatrix(); inner.setMatrixAt(ci++, tmp.matrix); }
          });
          [outer, inner].forEach(function (mesh) {
            if (!mesh) return;
            mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
            if (mesh.boundingSphere) mesh.boundingSphere.radius += 1.5;
            mesh.renderOrder = 7; root.add(mesh); flameMeshes.push(mesh);
          });
        });
      }());

      // ---- static batches -----------------------------------------------------------------------------
      var surfaceNames = { floor: 1, stone: 1, pale: 1, dark: 1 };
      function resolveMaterial(geo, mat) {
        if (!surfaceNames[mat]) return mat;
        if (geo === 'box' || geo.indexOf('slab') === 0) return mat;
        if (geo === 'plane' || geo.indexOf('ritual-') === 0 || geo.indexOf('door-') === 0 || geo.indexOf('vault') === 0 || geo.indexOf('niche-') === 0) return mat + '~p';
        return mat + '~c';
      }
      function castsStaticShadow(b) {
        return b.geo !== 'plane' && b.geo.indexOf('ritual-') !== 0 && b.mat !== 'floor' && b.mat !== 'foundation' && b.mat !== 'fire' && b.mat !== 'hot' && b.mat !== 'water' && b.mat !== 'blood' && b.mat !== 'groove' && b.mat !== 'bloodGroove' && b.level < 1;
      }
      // Multi-draw keeps the original local vertices, transforms and instance colours. Baking them into world
      // space would change stone UV rotation, chipped slab edges and candle wax. Each room/detail/shadow group
      // gets one submission; per-instance frustum culling also avoids drawing hidden stones in its shadow passes.
      var drawGroups = Object.create(null), indexedGeometries = Object.create(null);
      function indexedGeometry(name) {
        var g = geometries[name]; if (g.index) return g;
        if (!indexedGeometries[name]) {
          var copy = ownGeometry(g), n = g.attributes.position.count;
          var index = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
          for (var i = 0; i < n; i++) index[i] = i;
          copy.setIndex(new T.BufferAttribute(index, 1)); indexedGeometries[name] = copy;
        }
        return indexedGeometries[name];
      }
      // Shadow proxies: the static casters of a room (many materials, ~90 draws per shadow map) are also baked into ONE depth-only
      // mesh per room/side. It is invisible in the main pass (post.js shows it only while a shadow map renders) and replaces the
      // originals' castShadow on High, so each map draws a handful of static meshes instead of ~90 batches. Same triangles, same depth.
      var proxyParts = Object.create(null), proxies = [], proxyOn = false, useShadowProxies = !/[?&]noproxy/.test(location.search);
      BABA.shadowProxies = proxies;
      function shadowSideOf(m) { return m.shadowSide !== null && m.shadowSide !== undefined ? m.shadowSide : m.side === T.FrontSide ? T.BackSide : m.side === T.BackSide ? T.FrontSide : T.DoubleSide; }
      function proxyEligible(m) {
        return !!m && !m.transparent && !m.alphaMap && !(m.alphaTest > 0) && !m.displacementMap && !m.isShaderMaterial && m.colorWrite !== false && !m.clippingPlanes && !m.clipShadows && m.visible !== false;
      }
      function collectProxy(b, matName, key) {
        var m = materials[matName];
        if (!castsStaticShadow(b) || !proxyEligible(m)) return false;
        var side = shadowSideOf(m), pk = key.slice(key.lastIndexOf(':') + 1) + ':' + b.level + ':' + side;
        var P = proxyParts[pk] || (proxyParts[pk] = { side: side, level: b.level, items: [] });
        P.items.push({ geo: geometries[b.geo], tr: b.transforms }); return true;
      }
      function buildShadowProxies() {
        var placeholders = {}, totalV = 0;
        Object.keys(proxyParts).forEach(function (pk) {
          var P = proxyParts[pk], nv = 0, ni = 0, k;
          for (k = 0; k < P.items.length; k++) {
            var g0 = P.items[k].geo; nv += g0.attributes.position.count * P.items[k].tr.length; ni += (g0.index ? g0.index.count : g0.attributes.position.count) * P.items[k].tr.length;
          }
          var pos = new Float32Array(nv * 3), idx = new Uint32Array(ni), vo = 0, io = 0;
          P.items.forEach(function (it) {
            var g = it.geo, pa = g.attributes.position, n = pa.count, lp = new Float32Array(n * 3), i, j;
            for (i = 0; i < n; i++) { lp[i * 3] = pa.getX(i); lp[i * 3 + 1] = pa.getY(i); lp[i * 3 + 2] = pa.getZ(i); }
            var ic = g.index ? g.index.count : n, li = new Uint32Array(ic);
            for (i = 0; i < ic; i++) li[i] = g.index ? g.index.getX(i) : i;
            it.tr.forEach(function (mt) {
              var e = mt.elements, base = vo / 3;
              var det = e[0] * (e[5] * e[10] - e[9] * e[6]) - e[4] * (e[1] * e[10] - e[9] * e[2]) + e[8] * (e[1] * e[6] - e[5] * e[2]);
              for (i = 0; i < n; i++) {
                var x = lp[i * 3], y = lp[i * 3 + 1], z = lp[i * 3 + 2];
                pos[vo++] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[vo++] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[vo++] = e[2] * x + e[6] * y + e[10] * z + e[14];
              }
              if (det < 0) for (j = 0; j + 2 < ic; j += 3) { idx[io++] = base + li[j]; idx[io++] = base + li[j + 2]; idx[io++] = base + li[j + 1]; }
              else for (j = 0; j < ic; j++) idx[io++] = base + li[j];
            });
          });
          var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setIndex(new T.BufferAttribute(idx, 1));
          geo.computeBoundingSphere(); uniqueGeometries.push(geo); totalV += nv;
          var ph = placeholders[P.side] || (placeholders[P.side] = Object.assign(new T.MeshBasicMaterial({ color: 0 }), { shadowSide: P.side }));
          var mesh = new T.Mesh(geo, ph); mesh.name = 'shadow-proxy:' + pk; mesh.castShadow = true; mesh.receiveShadow = false; mesh.visible = false; mesh.matrixAutoUpdate = false;
          mesh.userData.zc = geo.boundingSphere.center.z; mesh.userData.zr = geo.boundingSphere.radius; mesh.userData.want = false; mesh.userData.level = P.level;
          root.add(mesh); proxies.push(mesh);
        });
        proxyParts = null;
        if (/[?&]proxylog/.test(location.search)) console.log('shadow proxies', proxies.length, 'vertices', totalV);
      }
      var proxyBudget = 0, proxyShadows = false, proxyForceOff = false;
      function refreshProxyState() {
        proxyOn = (proxyBudget === 2 || proxyBudget === 1 && !/[?&]noopt\b/.test(location.search)) && proxyShadows && proxies.length > 0 && !proxyForceOff; cullDirty = true;
        allBatches.forEach(function (mesh) { mesh.castShadow = proxyShadows && mesh.userData.baseCastShadow && !(proxyOn && mesh.userData.proxied); });
        syncProxies();
      }
      BABA.setShadowProxies = function (on) { proxyForceOff = !on; refreshProxyState(); return proxyOn; };
      function syncProxies() {
        for (var i = 0; i < proxies.length; i++) {
          var u = proxies[i].userData;
          u.want = proxyOn && u.zc + u.zr > focus.z - RANGE_N && u.zc - u.zr < focus.z + RANGE_S;
        }
      }
      Object.keys(batches).forEach(function (key) {
        var b = batches[key], matName = resolveMaterial(b.geo, b.mat);
        var proxied = useShadowProxies && collectProxy(b, matName, key);
        if (multiDraw && !materials[matName].transparent && !materials[matName].isShaderMaterial) {
          var attrs = geometries[b.geo].attributes;
          var layout = Object.keys(attrs).sort().map(function (n) { var a = attrs[n]; return n + '/' + a.itemSize + '/' + a.normalized + '/' + a.array.constructor.name; }).join(',');
          var chunk = key.slice(key.lastIndexOf(':') + 1);
          var groupKey = matName + ':' + b.level + ':' + chunk + ':' + castsStaticShadow(b) + ':' + (b.mat !== 'fire' && b.mat !== 'hot') + ':' + layout;
          if (!drawGroups[groupKey]) drawGroups[groupKey] = { mat: matName, level: b.level, cast: castsStaticShadow(b), receive: b.mat !== 'fire' && b.mat !== 'hot', proxied: proxied, parts: [] };
          drawGroups[groupKey].parts.push({ name: key, batch: b });
          return;
        }
        var mesh = new T.InstancedMesh(ownGeometry(geometries[b.geo]), materials[matName], b.transforms.length);
        mesh.name = key;
        for (var i = 0; i < b.transforms.length; i++) {
          mesh.setMatrixAt(i, b.transforms[i]);
          tmpColor.set(b.colors[i] || '#ffffff');
          mesh.setColorAt(i, tmpColor);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = castsStaticShadow(b);
        mesh.receiveShadow = b.mat !== 'fire' && b.mat !== 'hot';
        mesh.userData.baseCastShadow = mesh.castShadow; mesh.userData.proxied = proxied;
        mesh.userData.detail = b.level;
        mesh.computeBoundingSphere();
        root.add(mesh);
        allBatches.push(mesh);
        if (b.level) decorationBatches.push(mesh);
      });
      // Static batched instances never change their shape or local transform. r170 normally reloads
      // each 16-float matrix and transforms its sphere again in every main/shadow draw. Cache exactly
      // that result, retaining the original per-camera culling and indirect order. A world/group transform
      // is still included in the local frustum every pass; changed geometry/instance matrices rebuild bounds.
      function cacheStaticBounds(mesh) {
        var original = mesh.onBeforeRender;
        if (T.REVISION !== '170' || !Array.isArray(mesh._instanceInfo) || !Array.isArray(mesh._geometryInfo)
          || !mesh._multiDrawStarts || !mesh._multiDrawCounts || !mesh._indirectTexture || !mesh._matricesTexture) return;
        var bounds = new Float64Array(mesh._instanceInfo.length * 4), geometryIds = new Int32Array(mesh._instanceInfo.length);
        var sphere = new T.Sphere(), matrix = new T.Matrix4(), frustum = new T.Frustum();
        var matrixVersion = -1, positionVersion = -1, indexVersion = -1;
        function writeBound(id) {
          var geometryId = mesh._instanceInfo[id].geometryIndex;
          mesh.getMatrixAt(id, matrix); mesh.getBoundingSphereAt(geometryId, sphere).applyMatrix4(matrix);
          var offset = id * 4;
          bounds[offset] = sphere.center.x; bounds[offset + 1] = sphere.center.y; bounds[offset + 2] = sphere.center.z; bounds[offset + 3] = sphere.radius;
          geometryIds[id] = geometryId;
        }
        function rebuild() {
          if (geometryIds.length !== mesh._instanceInfo.length) { geometryIds = new Int32Array(mesh._instanceInfo.length); bounds = new Float64Array(geometryIds.length * 4); }
          for (var i = 0; i < mesh._instanceInfo.length; i++) if (mesh._instanceInfo[i].active) writeBound(i);
          matrixVersion = mesh._matricesTexture.version; positionVersion = mesh.geometry.attributes.position.version;
          indexVersion = mesh.geometry.index ? mesh.geometry.index.version : -1;
        }
        rebuild();
        var tmpMat = new T.Matrix4(), tmpFrustum = new T.Frustum(), tmpSphere = new T.Sphere();
        // true when at least one active, visible instance (sphere inflated by margin) touches the frustum of viewProj; same bounds as onBeforeRender
        mesh.userData.anyVisible = function (viewProj, margin) {
          if (matrixVersion !== mesh._matricesTexture.version || positionVersion !== mesh.geometry.attributes.position.version
            || indexVersion !== (mesh.geometry.index ? mesh.geometry.index.version : -1) || geometryIds.length !== mesh._instanceInfo.length) rebuild();
          tmpFrustum.setFromProjectionMatrix(tmpMat.multiplyMatrices(viewProj, mesh.matrixWorld));
          for (var i = 0; i < mesh._instanceInfo.length; i++) {
            var instance = mesh._instanceInfo[i]; if (!instance.visible || !instance.active) continue;
            if (geometryIds[i] !== instance.geometryIndex) writeBound(i);
            var offset = i * 4;
            tmpSphere.center.set(bounds[offset], bounds[offset + 1], bounds[offset + 2]); tmpSphere.radius = bounds[offset + 3] + margin;
            if (tmpFrustum.intersectsSphere(tmpSphere)) return true;
          }
          return false;
        };
        mesh.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
          if (this.sortObjects || !this.perObjectFrustumCulled || !this._matricesTexture || !this._indirectTexture
            || !this._indirectTexture.image || !this._indirectTexture.image.data || !geometry.attributes.position) {
            return original.call(this, renderer, scene, camera, geometry, material, group);
          }
          if (matrixVersion !== this._matricesTexture.version || positionVersion !== geometry.attributes.position.version
            || indexVersion !== (geometry.index ? geometry.index.version : -1) || geometryIds.length !== this._instanceInfo.length) rebuild();
          matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(this.matrixWorld);
          frustum.setFromProjectionMatrix(matrix, renderer.coordinateSystem);
          var n = 0, indirectChanged = false, bytes = geometry.index ? geometry.index.array.BYTES_PER_ELEMENT : 1, indirect = this._indirectTexture.image.data;
          for (var i = 0; i < this._instanceInfo.length; i++) {
            var instance = this._instanceInfo[i]; if (!instance.visible || !instance.active) continue;
            if (geometryIds[i] !== instance.geometryIndex) writeBound(i);
            var offset = i * 4;
            sphere.center.set(bounds[offset], bounds[offset + 1], bounds[offset + 2]); sphere.radius = bounds[offset + 3];
            if (!frustum.intersectsSphere(sphere)) continue;
            var info = this._geometryInfo[instance.geometryIndex];
            this._multiDrawStarts[n] = info.start * bytes; this._multiDrawCounts[n] = info.count;
            if (indirect[n] !== i) { indirect[n] = i; indirectChanged = true; }
            n++;
          }
          // Only the first n IDs are consumed. Shorter lists can keep their unused tail, and every
          // main/shadow camera still writes its own list before drawing. A fresh/restored GPU texture
          // uploads its current version on first use; version zero must be made uploadable here too.
          if (indirectChanged || this._indirectTexture.version === 0) this._indirectTexture.needsUpdate = true;
          this._multiDrawCount = n; this._visibilityChanged = false;
        };
      }
      Object.keys(drawGroups).forEach(function (key) {
        var group = drawGroups[key], names = [], count = 0, vertices = 0, indices = 0;
        group.parts.forEach(function (p) {
          count += p.batch.transforms.length;
          if (names.indexOf(p.batch.geo) < 0) {
            names.push(p.batch.geo); var g = indexedGeometry(p.batch.geo);
            vertices += g.attributes.position.count; indices += g.index.count;
          }
        });
        var mesh = new T.BatchedMesh(count, vertices, indices, materials[group.mat]), ids = Object.create(null), ranges = [];
        mesh.name = 'multi:' + key;
        mesh.sortObjects = false; mesh.perObjectFrustumCulled = true;
        // r170 checks colorTexture in setProgram but stores it as _colorsTexture in BatchedMesh.
        Object.defineProperty(mesh, 'colorTexture', { get: function () { return this._colorsTexture; } });
        names.forEach(function (name) { ids[name] = mesh.addGeometry(indexedGeometry(name)); });
        var sphere = new T.Sphere(), pieceSphere = new T.Sphere(), matrix = new T.Matrix4();
        group.parts.forEach(function (p) {
          var b = p.batch, g = geometries[b.geo], start = mesh.instanceCount;
          if (!g.boundingSphere) g.computeBoundingSphere(); sphere.makeEmpty();
          for (var i = 0; i < b.transforms.length; i++) {
            var id = mesh.addInstance(ids[b.geo]); mesh.setMatrixAt(id, b.transforms[i]);
            tmpColor.set(b.colors[i] || '#ffffff'); mesh.setColorAt(id, tmpColor);
            // Match the old InstancedMesh's Float32 transform and union order, so range visibility is identical.
            mesh.getMatrixAt(id, matrix); pieceSphere.copy(g.boundingSphere).applyMatrix4(matrix); sphere.union(pieceSphere);
          }
          ranges.push({ name: p.name, start: start, count: b.transforms.length, zc: sphere.radius > 60 ? null : sphere.center.z, zr: sphere.radius, cx: sphere.center.x, cy: sphere.center.y, cz: sphere.center.z, visible: null });
        });
        mesh.castShadow = group.cast; mesh.receiveShadow = group.receive;
        mesh.userData.baseCastShadow = group.cast; mesh.userData.proxied = !!group.proxied; mesh.userData.detail = group.level; mesh.userData.batchRanges = ranges;
        cacheStaticBounds(mesh);
        mesh.computeBoundingSphere(); root.add(mesh); allBatches.push(mesh);
        if (group.level) decorationBatches.push(mesh);
      });
      drawGroups = null;
      buildShadowProxies();
      batches = null;
      Object.keys(decalBatches).forEach(function (key) {
        var b = decalBatches[key], n = b.transforms.length, g = geometries.plane.clone(), cellAttr = new Float32Array(n * 2);
        b.cells.forEach(function (c, i) { cellAttr[i * 2] = (c % 4) / 4; cellAttr[i * 2 + 1] = 1 - (Math.floor(c / 4) + 1) / 4; });
        g.setAttribute('gCell', new T.InstancedBufferAttribute(cellAttr, 2)); uniqueGeometries.push(g);
        var mat = b.type === 'wet' ? materials.decalWet : b.type === 'glow' ? materials.decalGlow : materials.decalMatte;
        var mesh = new T.InstancedMesh(g, mat, n);
        for (var i = 0; i < n; i++) { mesh.setMatrixAt(i, b.transforms[i]); mesh.setColorAt(i, b.colors[i]); }
        mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
        mesh.renderOrder = b.type === 'glow' ? -4 : -6; mesh.receiveShadow = b.type !== 'glow'; mesh.castShadow = false;
        mesh.name = 'decal:' + key; mesh.userData.detail = b.level; root.add(mesh); allBatches.push(mesh);
        if (b.level) decorationBatches.push(mesh);
        if (b.type === 'glow') { mesh.userData.glow = true; }
      });
      decalBatches = null;

      // ---- pooled lights ---------------------------------------------------------------------------------
      // A fixed number of real lights per preset serves the sources nearest the player (no shader rebuilds while
      // playing): point lights for every fire, down-facing shadow-casting spot lights that carry most of the
      // strongest nearby fire (High), and one moon spot projecting the window/grate of the nearest shaft.
      var poolLights = [], poolSize = 0, spotSlots = [], spotCount = 0, spotMapSize = 0;
      var playerLight = new T.PointLight('#ffd9b0', 6.5, 9, 2), playerLightFx = null, playerLightLent = false;
      playerLight.castShadow = false; playerLight.position.set(spawn.x, 3.2, spawn.z + 1.2); root.add(playerLight);
      function setPoolSize(n) {
        if (n === poolSize) return;
        poolLights.forEach(function (s) { root.remove(s.light); s.light.dispose(); });
        poolLights = [];
        for (var i = 0; i < n; i++) {
          var light = new T.PointLight('#ff9040', 0, 10, 2); light.castShadow = false; root.add(light);
          poolLights.push({ light: light, source: null, w: 0 });
        }
        poolSize = n;
      }
      var SPOT_SHARE = .64;
      function setSpotSlots(n, size) {
        if (n === spotCount && size === spotMapSize) return;
        spotSlots.forEach(function (slot) {
          if (slot.source) slot.source.spotW = 0;
          root.remove(slot.light); root.remove(slot.light.target);
          if (slot.light.shadow.map) slot.light.shadow.map.dispose();
          slot.light.dispose();
        });
        spotSlots = [];
        for (var i = 0; i < n; i++) {
          var l = new T.SpotLight('#ff9040', 0, 12, 1.36, .55, 2);
          l.castShadow = true; l.shadow.mapSize.set(size, size); l.shadow.bias = -.0009; l.shadow.normalBias = .04;
          l.shadow.camera.near = .8; l.shadow.camera.far = 14; l.shadow.intensity = .92;
          root.add(l); root.add(l.target);
          spotSlots.push({ light: l, source: null, w: 0 });
        }
        spotCount = n; spotMapSize = size;
      }
      // Window, grate and oculus patterns for the moon spot (drawn once; white = light passes).
      var cookies = {};
      function cookieTexture(type) {
        if (cookies[type]) return cookies[type];
        var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
        x.filter = 'blur(3px)'; x.fillStyle = '#fff'; x.strokeStyle = '#000';
        if (type === 'grate') {
          x.fillRect(48, 48, 160, 160); x.lineWidth = 11;
          for (var g = 1; g < 5; g++) { x.beginPath(); x.moveTo(48 + g * 32, 40); x.lineTo(48 + g * 32, 216); x.stroke(); x.beginPath(); x.moveTo(40, 48 + g * 32); x.lineTo(216, 48 + g * 32); x.stroke(); }
        } else if (type === 'lancet') {
          x.beginPath(); x.moveTo(84, 224); x.lineTo(84, 104); x.quadraticCurveTo(84, 44, 128, 26); x.quadraticCurveTo(172, 44, 172, 104); x.lineTo(172, 224); x.closePath(); x.fill();
          x.lineWidth = 8; x.beginPath(); x.moveTo(128, 30); x.lineTo(128, 226); x.stroke();
          for (var b = 0; b < 4; b++) { x.beginPath(); x.moveTo(80, 116 + b * 30); x.lineTo(176, 116 + b * 30); x.stroke(); }
        } else if (type === 'oculus') {
          x.beginPath(); x.arc(128, 128, 96, 0, Math.PI * 2); x.fill(); x.lineWidth = 9;
          for (var r = 0; r < 8; r++) { var an = r / 8 * Math.PI * 2; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(an) * 104, 128 + Math.sin(an) * 104); x.stroke(); }
          x.beginPath(); x.arc(128, 128, 30, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(128, 128, 64, 0, Math.PI * 2); x.stroke();
        } else {
          // A jagged crack in the vault.
          x.beginPath(); x.moveTo(60, 40); x.lineTo(118, 70); x.lineTo(104, 120); x.lineTo(160, 150); x.lineTo(150, 222); x.lineTo(196, 214); x.lineTo(186, 150); x.lineTo(140, 104); x.lineTo(154, 58); x.lineTo(90, 30); x.closePath(); x.fill();
        }
        var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.name = 'kara:light-cookie:' + type; textures.push(t); cookies[type] = t; return t;
      }
      function prepareLightTextures() {
        if (!moonSpot) return [];
        // Switching the shaft's pattern must not first paint/upload it during room entry.
        shafts.forEach(function (sh) { cookieTexture(sh[10] || 'grate'); });
        return Object.keys(cookies).map(function (type) { return cookies[type]; });
      }
      var moonSpot = null, moonSpotShaft = null, moonSpotW = 0, moonSpotSize = 0;
      function setMoonSpot(size) {
        if (size === moonSpotSize) return;
        if (moonSpot) { root.remove(moonSpot); root.remove(moonSpot.target); if (moonSpot.shadow.map) moonSpot.shadow.map.dispose(); moonSpot.dispose(); moonSpot = null; }
        moonSpotSize = size; moonSpotShaft = null; moonSpotW = 0;
        if (!size) return;
        moonSpot = new T.SpotLight('#9fb4e6', 0, 40, .12, .35, 2);
        moonSpot.castShadow = true; moonSpot.shadow.mapSize.set(size, size); moonSpot.shadow.bias = -.0004; moonSpot.shadow.normalBias = .03;
        moonSpot.map = cookieTexture('grate'); root.add(moonSpot); root.add(moonSpot.target);
      }
      // Scripted gains (lighting.js): torches of a group, braziers, the rite, the oath stone, the court's moon.
      var groups = Object.create(null);
      function groupState(name) { return groups[name] || (groups[name] = { gain: 1, tint: 0 }); }
      function groupGain(name) { return name ? groupState(name).gain : 1; }
      function setGroup(name, gain) { groupState(name).gain = Math.max(0, gain); }
      function setGroupTint(name, t) { groupState(name).tint = Math.max(0, Math.min(1, t)); }
      var RAGE_LIGHT = new T.Color('#ff2410');
      function hash1(n) { var v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); }
      function noise1(x) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); return hash1(i) + (hash1(i + 1) - hash1(i)) * f; }
      // Live strength, colour and position of every source near the player: layered flutter, occasional gusts that
      // dip the fire and pull it toward a deeper red, group gains and the court's rage tint.
      function liveSources(t) {
        for (var i = 0; i < lightSources.length; i++) {
          var s = lightSources[i];
          if (Math.abs(s.z - focus.z) > 40) { s.live = 0; continue; }
          var fl = reducedMotion ? 0 : s.flicker, ph = s.phase;
          var n = Math.sin(t * 8.4 + ph) * .07 + Math.sin(t * 13.7 + ph * 1.7) * .045 + Math.sin(t * 23.1 + ph * 3.1) * .02;
          var dip = Math.max(0, noise1(t * .8 + ph * 3.3) - .6) / .4;
          s.live = groupGain(s.group) * Math.max(.2, 1 + fl * (n - dip * .24));
          s.liveColor.copy(s.color).lerp(s.dim, Math.min(1, fl * (dip * .4 + Math.max(0, -n) * 1.2)));
          if (s.tintGroup) { var tg = groupState(s.tintGroup).tint; if (tg > 0) s.liveColor.lerp(RAGE_LIGHT, tg * .55); }
          if (!s.track) { s.livePos.x = s.x; s.livePos.y = s.y; s.livePos.z = s.z; }
          if (fl > .5 && s.shadowNear) { s.livePos.x += Math.sin(t * 11.3 + ph) * .018 * fl; s.livePos.z += Math.cos(t * 9.7 + ph) * .018 * fl; s.livePos.y += n * .05; }
        }
      }
      setPoolSize(6);
      var lightGain = 1, reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var focus = { x: spawn.x, z: spawn.z }, lastTime = 0;
      var ranked = [], shadowRanked = [];
      var holdStamp = 0;
      function byScore(a, b) { return b.score - a.score; }
      function byShadowScore(a, b) { return b.sscore - a.sscore; }
      function fadeSlots(slots, wanted, fade, onAssign) {
        var wantedSet = new Set(wanted), assigned = new Set();
        slots.forEach(function (slot) {
          if (slot.source && !wantedSet.has(slot.source)) { slot.w -= fade; if (slot.w <= 0) { slot.source = null; slot.w = 0; } }
          else if (slot.source) slot.w = Math.min(1, slot.w + fade);
          if (slot.source) assigned.add(slot.source);
        });
        wanted.forEach(function (s) {
          if (assigned.has(s)) return;
          for (var j = 0; j < slots.length; j++) {
            if (!slots[j].source) { slots[j].source = s; slots[j].w = 0; if (onAssign) onAssign(slots[j], s); assigned.add(s); break; }
          }
        });
      }
      function updateLights(dt, time) {
        var t = reducedMotion ? 0 : time;
        liveSources(t);
        var fx = focus.x, fz = focus.z - 2.5;
        ranked.length = 0; shadowRanked.length = 0;
        // Holders of a pool slot / shadow spot rank x1.3 (hysteresis): two similar torches never trade places back and forth.
        var i, hold = ++holdStamp;
        for (i = 0; i < poolLights.length; i++) if (poolLights[i].source) poolLights[i].source.poolHeld = hold;
        for (i = 0; i < spotSlots.length; i++) if (spotSlots[i].source) spotSlots[i].source.spotHeld = hold;
        for (i = 0; i < lightSources.length; i++) {
          var s = lightSources[i], dx = s.x - fx, dz = s.z - fz, d2 = dx * dx + dz * dz * .8, gg = groupGain(s.group);
          if (d2 > 900 || gg <= .01) { s.score = 0; continue; }
          s.score0 = s.intensity * Math.min(1.5, gg) * s.distance / (1 + d2 / 18);
          s.score = s.score0 * (s.poolHeld === hold ? 1.3 : 1);
          ranked.push(s);
          if (s.shadowNear && d2 < 150) { s.sscore = s.score0 * (s.spotHeld === hold ? 1.3 : 1); shadowRanked.push(s); }
        }
        ranked.sort(byScore);
        shadowRanked.sort(byShadowScore);
        var fade = Math.min(1, dt * 3.5);
        fadeSlots(poolLights, ranked.slice(0, poolSize), fade, function (slot, s) { slot.light.distance = s.distance; });
        fadeSlots(spotSlots, shadowRanked.slice(0, spotCount), fade * .8, function (slot, s) {
          slot.light.distance = s.distance + 1; slot.light.shadow.camera.near = s.shadowNear; slot.light.shadow.camera.far = s.distance + 1;
          slot.light.shadow.camera.updateProjectionMatrix(); slot.fresh = true;
        });
        lightSources.forEach(function (s) { s.spotW = 0; });
        spotSlots.forEach(function (slot) {
          var s = slot.source;
          if (!s) { slot.light.intensity = 0; return; }
          var e = slot.w * slot.w * (3 - 2 * slot.w); s.spotW = e;
          slot.light.position.set(s.livePos.x, s.livePos.y, s.livePos.z);
          slot.light.target.position.set(s.livePos.x + (s.aim ? s.aim[0] : 0), 0, s.livePos.z + (s.aim ? s.aim[1] : 0));
          slot.light.target.updateMatrixWorld();
          slot.light.color.copy(s.liveColor);
          slot.light.intensity = s.intensity * s.live * e * SPOT_SHARE * lightGain;
        });
        poolLights.forEach(function (slot) {
          var s = slot.source;
          if (!s) { slot.light.intensity = 0; return; }
          var e = slot.w * slot.w * (3 - 2 * slot.w);
          slot.light.position.set(s.livePos.x, s.livePos.y, s.livePos.z);
          slot.light.color.copy(s.liveColor);
          slot.light.intensity = s.intensity * s.live * e * (1 - SPOT_SHARE * s.spotW) * lightGain;
        });
        if (moonSpot) {
          var best = null, bestD = 196;
          shafts.forEach(function (sh) { var ddx = sh[3] - focus.x, ddz = sh[5] - focus.z, dd = ddx * ddx + ddz * ddz; if (dd < bestD) { bestD = dd; best = sh; } });
          if (best !== moonSpotShaft) { moonSpotW -= fade; if (moonSpotW <= 0) { moonSpotShaft = best; moonSpotW = 0; if (best) placeMoonSpot(best); } }
          else if (best) moonSpotW = Math.min(1, moonSpotW + fade * .6);
          if (moonSpotShaft) {
            var sh2 = moonSpotShaft, ew = moonSpotW * moonSpotW * (3 - 2 * moonSpotW), cloud = reducedMotion ? 1 : .82 + .18 * Math.sin(time * .21 + shafts.indexOf(sh2) * 1.7);
            moonSpot.intensity = moonSpot.userData.base * ew * cloud * groupGain(sh2[11]) * lightGain;
          } else moonSpot.intensity = 0;
        }
        scheduleShadows(time);
      }
      // One spot-map update at a time, at most 60/s on High and 30/s on Medium. Two active maps share that
      // budget evenly; 200 Hz no longer means 200 scene/shadow submissions. Real source assignments and
      // missing maps invalidate immediately. Preserve a pending update until the renderer consumes it.
      var shadowTick = 0, shadowSlot = null, shadowHz = 60, moonSpotFresh = false, shadowJobs = [];
      var deferredShadow = null, deferredSlot = null, renderedDeferred = false;
      var refreshShadow = null, refreshCanDefer = false, refreshPreviousSlot = null, refreshPreviousTick = 0;
      function scheduleShadows(time) {
        refreshShadow = null; refreshCanDefer = renderedDeferred = false;
        shadowJobs.length = 0;
        spotSlots.forEach(function (slot) {
          var shadow = slot.light.shadow; shadow.autoUpdate = false;
          if (slot.light.intensity > 0) {
            shadowJobs.push(shadow);
            if (slot.fresh || !shadow.map) { shadow.needsUpdate = true; slot.fresh = false; }
          } else shadow.needsUpdate = false;
        });
        if (moonSpot) {
          var moonShadow = moonSpot.shadow; moonShadow.autoUpdate = false;
          if (moonSpot.intensity > 0) {
            shadowJobs.push(moonShadow);
            if (moonSpotFresh || !moonShadow.map) { moonShadow.needsUpdate = true; moonSpotFresh = false; }
          } else moonShadow.needsUpdate = false;
        }
        if (!shadowJobs.length || !shadowHz) { deferredShadow = deferredSlot = null; return; }
        // The offset reduces ordinary collisions. Lighting also coordinates the actual presented frames:
        // a 120 FPS cap on a 180 Hz monitor does not present uniformly spaced timestamps.
        var slot = Math.floor(time * shadowHz + .5 + 1e-5);
        if (shadowSlot !== null && slot < shadowSlot || deferredSlot !== null && slot < deferredSlot) { shadowSlot = null; deferredShadow = null; deferredSlot = null; }
        if (deferredShadow) {
          var deferredIndex = shadowJobs.indexOf(deferredShadow);
          if (deferredIndex >= 0) {
            deferredShadow.needsUpdate = true;
            shadowTick = (deferredIndex + 1) % shadowJobs.length; shadowSlot = slot - deferredSlot > 2 ? slot : deferredSlot;
            deferredShadow = null; deferredSlot = null; renderedDeferred = true;
            return; // A deferred request gets the next frame, even when the key also needs an update.
          }
          deferredShadow = null; deferredSlot = null; // The source disappeared or the quality replaced its light.
        }
        if (slot !== shadowSlot) {
          refreshShadow = shadowJobs[shadowTick % shadowJobs.length];
          // Fresh/missing maps and requests left pending by the renderer are never cancelled.
          refreshCanDefer = !refreshShadow.needsUpdate;
          refreshPreviousSlot = shadowSlot; refreshPreviousTick = shadowTick;
          refreshShadow.needsUpdate = true;
          shadowTick = (shadowTick + 1) % shadowJobs.length;
          // Retain at most the one missed regular tick. Larger jumps coalesce immediately; never
          // create a catch-up queue after pause, a stalled browser or restoration.
          shadowSlot = shadowSlot !== null && slot > shadowSlot && slot - shadowSlot <= 2 ? shadowSlot + 1 : slot;
        }
      }
      function deferShadowRefresh() {
        if (!refreshCanDefer || !refreshShadow || !refreshShadow.needsUpdate) return false;
        refreshShadow.needsUpdate = false; deferredShadow = refreshShadow; deferredSlot = shadowSlot;
        shadowSlot = refreshPreviousSlot; shadowTick = refreshPreviousTick; refreshCanDefer = false;
        return true;
      }
      var spotAxis = new T.Vector3(), spotTop = new T.Vector3(), spotFloor = new T.Vector3();
      function placeMoonSpot(sh) {
        spotTop.set(sh[0], sh[1], sh[2]); spotFloor.set(sh[3], sh[4], sh[5]);
        spotAxis.subVectors(spotFloor, spotTop); var len = spotAxis.length(); spotAxis.normalize();
        var back = len * sh[6] / Math.max(.2, sh[7] - sh[6]), dist = len + back;
        moonSpot.position.copy(spotTop).addScaledVector(spotAxis, -back);
        moonSpot.target.position.copy(spotFloor); moonSpot.target.updateMatrixWorld();
        moonSpot.angle = Math.atan(sh[7] * .72 / dist); moonSpot.penumbra = .3; moonSpot.distance = 0; // no range cut-off: plain inverse-square
        moonSpot.color.setRGB(sh[8][0], sh[8][1], sh[8][2]);
        moonSpot.userData.base = sh[9] * 12 * dist * dist; // floor irradiance ~ 12 x the shaft's strength
        moonSpot.map = cookieTexture(sh[10] || 'grate');
        moonSpot.shadow.camera.near = Math.max(1, dist - 8); moonSpot.shadow.camera.far = dist + 6; moonSpot.shadow.camera.updateProjectionMatrix();
        moonSpotFresh = true;
      }
      // A static broad-phase grid keeps collision work independent of the
      // decorative instance count. Circle/rectangle checks have no corner cut.
      var expansion = window.BABA.ChapterExpansion.build(root,materials,rooms,encounters,colliders,1,lightSources);
      floors.push.apply(floors,expansion.floors);
      var allRooms=rooms.concat(expansion.rooms);
      var grid = Object.create(null), cellSize = 8;
      colliders.forEach(function (c, index) {
        for (var gx = Math.floor((c.x - c.w / 2) / cellSize); gx <= Math.floor((c.x + c.w / 2) / cellSize); gx++) {
          for (var gz = Math.floor((c.z - c.d / 2) / cellSize); gz <= Math.floor((c.z + c.d / 2) / cellSize); gz++) {
            var key = gx + ',' + gz;
            if (!grid[key]) grid[key] = [];
            grid[key].push(index);
          }
        }
      });
      var stamps = new Uint32Array(colliders.length), query = 0;
      function isWalkable(x, z, radius) {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
        radius = Math.max(0.01, radius == null ? 0.45 : radius);
        var onFloor = false;
        for (var i = 0; i < floors.length; i++) {
          var f = floors[i];
          if (Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2) { onFloor = true; break; }
        }
        if (!onFloor) return false;
        query = (query + 1) >>> 0;
        if (query === 0) { stamps.fill(0); query = 1; }
        for (var gx = Math.floor((x - radius) / cellSize); gx <= Math.floor((x + radius) / cellSize); gx++) {
          for (var gz = Math.floor((z - radius) / cellSize); gz <= Math.floor((z + radius) / cellSize); gz++) {
            var list = grid[gx + ',' + gz];
            if (!list) continue;
            for (var j = 0; j < list.length; j++) {
              var idx = list[j];
              if (stamps[idx] === query) continue;
              stamps[idx] = query;
              var c = colliders[idx];
              var nx = Math.max(c.x - c.w / 2, Math.min(x, c.x + c.w / 2));
              var nz = Math.max(c.z - c.d / 2, Math.min(z, c.z + c.d / 2));
              var dx = x - nx, dz = z - nz;
              if (dx * dx + dz * dz < radius * radius - 0.000001) return false;
            }
          }
        }
        return true;
      }
      function move(pos, dx, dz, radius) {
        if (!Number.isFinite(dx) || !Number.isFinite(dz)) return pos;
        radius = radius == null ? 0.45 : radius;
        var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / Math.max(0.1, radius * 0.5)));
        var sx = dx / steps, sz = dz / steps;
        for (var i = 0; i < steps; i++) {
          if (isWalkable(pos.x + sx, pos.z + sz, radius)) { pos.x += sx; pos.z += sz; }
          else {
            if (isWalkable(pos.x + sx, pos.z, radius)) pos.x += sx;
            if (isWalkable(pos.x, pos.z + sz, radius)) pos.z += sz;
          }
        }
        return pos;
      }
      // Static navigation is prepared with the world, while the loading screen is still up.
      // A route query only visits this compact graph; it never inspects decorative meshes or
      // allocates a new grid during combat. Rounded-up body sizes keep routes conservative.
      function hasClearPath(ax, az, bx, bz, radius) {
        if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) return false;
        radius = Math.max(.01, radius == null ? .45 : radius);
        if (!isWalkable(ax, az, radius) || !isWalkable(bx, bz, radius)) return false;
        var dx = bx - ax, dz = bz - az;
        query = (query + 1) >>> 0;
        if (query === 0) { stamps.fill(0); query = 1; }
        for (var gx = Math.floor((Math.min(ax, bx) - radius) / cellSize); gx <= Math.floor((Math.max(ax, bx) + radius) / cellSize); gx++) {
          for (var gz = Math.floor((Math.min(az, bz) - radius) / cellSize); gz <= Math.floor((Math.max(az, bz) + radius) / cellSize); gz++) {
            var list = grid[gx + ',' + gz]; if (!list) continue;
            for (var j = 0; j < list.length; j++) {
              var idx = list[j]; if (stamps[idx] === query) continue; stamps[idx] = query;
              var c = colliders[idx], left = c.x - c.w / 2 - radius, right = c.x + c.w / 2 + radius;
              var top = c.z - c.d / 2 - radius, bottom = c.z + c.d / 2 + radius, enter = 0, exit = 1;
              if (Math.abs(dx) < 1e-9) { if (ax < left || ax > right) continue; }
              else { var tx0 = (left - ax) / dx, tx1 = (right - ax) / dx; enter = Math.max(enter, Math.min(tx0, tx1)); exit = Math.min(exit, Math.max(tx0, tx1)); }
              if (Math.abs(dz) < 1e-9) { if (az < top || az > bottom) continue; }
              else { var tz0 = (top - az) / dz, tz1 = (bottom - az) / dz; enter = Math.max(enter, Math.min(tz0, tz1)); exit = Math.min(exit, Math.max(tz0, tz1)); }
              if (enter >= exit - 1e-7 || exit <= 0 || enter >= 1) continue;
              // The broad-phase rectangle has square corners. Refine it against the
              // real rounded body sweep so a character hugging a pillar can still escape.
              left += radius; right -= radius; top += radius; bottom -= radius; enter = 0; exit = 1;
              if (Math.abs(dx) < 1e-9) { if (ax < left || ax > right) enter = 2; }
              else { tx0 = (left - ax) / dx; tx1 = (right - ax) / dx; enter = Math.max(enter, Math.min(tx0, tx1)); exit = Math.min(exit, Math.max(tx0, tx1)); }
              if (Math.abs(dz) < 1e-9) { if (az < top || az > bottom) enter = 2; }
              else { tz0 = (top - az) / dz; tz1 = (bottom - az) / dz; enter = Math.max(enter, Math.min(tz0, tz1)); exit = Math.min(exit, Math.max(tz0, tz1)); }
              if (enter <= exit && exit >= 0 && enter <= 1) return false;
              var length2 = dx * dx + dz * dz;
              for (var cx = 0; cx < 2; cx++) for (var cz = 0; cz < 2; cz++) {
                var px = cx ? right : left, pz = cz ? bottom : top;
                var u = length2 > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length2)) : 0;
                var gapX = px - ax - dx * u, gapZ = pz - az - dz * u;
                if (gapX * gapX + gapZ * gapZ < radius * radius - .000001) return false;
              }
            }
          }
        }
        // The temple has separate floor rectangles connected by corridors. A clear collider
        // ray must also stay on their union, rather than cutting across empty space outside.
        var samples = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .5));
        for (var s = 1; s < samples; s++) {
          var x = ax + dx * s / samples, z = az + dz * s / samples, floor = false;
          for (var f = 0; f < floors.length; f++) { var tile = floors[f]; if (Math.abs(x - tile.x) <= tile.w / 2 && Math.abs(z - tile.z) <= tile.d / 2) { floor = true; break; } }
          if (!floor) return false;
        }
        return true;
      }
      var navStep = .5, navMinX = Infinity, navMinZ = Infinity, navMaxX = -Infinity, navMaxZ = -Infinity;
      floors.forEach(function (f) { navMinX = Math.min(navMinX, f.x - f.w / 2); navMaxX = Math.max(navMaxX, f.x + f.w / 2); navMinZ = Math.min(navMinZ, f.z - f.d / 2); navMaxZ = Math.max(navMaxZ, f.z + f.d / 2); });
      navMinX = Math.floor(navMinX / navStep) * navStep; navMinZ = Math.floor(navMinZ / navStep) * navStep;
      var navW = Math.ceil((navMaxX - navMinX) / navStep) + 1, navH = Math.ceil((navMaxZ - navMinZ) / navStep) + 1, navN = navW * navH;
      var navSizes = [.4, .46, .5, .6, .85, 1.05], navGraphs = [];
      var navDX = [1, 1, 0, -1, -1, -1, 0, 1], navDZ = [0, 1, 1, 1, 0, -1, -1, -1];
      navSizes.forEach(function (radius) {
        var walk = new Uint8Array(navN), links = new Uint8Array(navN);
        for (var id = 0; id < navN; id++) walk[id] = isWalkable(navMinX + id % navW * navStep, navMinZ + Math.floor(id / navW) * navStep, radius) ? 1 : 0;
        for (var id = 0; id < navN; id++) {
          if (!walk[id]) continue;
          var ix = id % navW, iz = Math.floor(id / navW), x = navMinX + ix * navStep, z = navMinZ + iz * navStep;
          for (var dir = 0; dir < 4; dir++) {
            var nx = ix + navDX[dir], nz = iz + navDZ[dir], other = nz * navW + nx;
            if (nx < 0 || nx >= navW || nz < 0 || nz >= navH || !walk[other]) continue;
            if (hasClearPath(x, z, navMinX + nx * navStep, navMinZ + nz * navStep, radius)) { links[id] |= 1 << dir; links[other] |= 1 << (dir + 4); }
          }
        }
        navGraphs.push({ radius: radius, walk: walk, links: links });
      });
      var navSeen = new Uint32Array(navN), navClosed = new Uint32Array(navN), navScore = new Float32Array(navN), navParent = new Int32Array(navN), navSerial = 0;
      var navHeapId = new Int32Array(navN * 8), navHeapCost = new Float64Array(navN * 8), navHeapN = 0;
      function navPush(id, cost) {
        var at = navHeapN++;
        while (at > 0) { var parent = (at - 1) >>> 1; if (navHeapCost[parent] <= cost) break; navHeapId[at] = navHeapId[parent]; navHeapCost[at] = navHeapCost[parent]; at = parent; }
        navHeapId[at] = id; navHeapCost[at] = cost;
      }
      function navPop() {
        var result = navHeapId[0], id = navHeapId[--navHeapN], cost = navHeapCost[navHeapN], at = 0;
        while (at * 2 + 1 < navHeapN) { var child = at * 2 + 1; if (child + 1 < navHeapN && navHeapCost[child + 1] < navHeapCost[child]) child++; if (navHeapCost[child] >= cost) break; navHeapId[at] = navHeapId[child]; navHeapCost[at] = navHeapCost[child]; at = child; }
        navHeapId[at] = id; navHeapCost[at] = cost; return result;
      }
      function navNode(x, z, graph, allowBlocked, radius) {
        var ix = Math.round((x - navMinX) / navStep), iz = Math.round((z - navMinZ) / navStep), best = -1, bestD = Infinity;
        for (var oz = -3; oz <= 3; oz++) for (var ox = -3; ox <= 3; ox++) {
          var nx = ix + ox, nz = iz + oz; if (nx < 0 || nx >= navW || nz < 0 || nz >= navH) continue;
          var id = nz * navW + nx; if (!graph.walk[id]) continue;
          var px = navMinX + nx * navStep, pz = navMinZ + nz * navStep, d = (px - x) * (px - x) + (pz - z) * (pz - z);
          if (d < bestD && (allowBlocked || hasClearPath(x, z, px, pz, radius))) { bestD = d; best = id; }
        }
        return bestD <= 2.25 ? best : -1;
      }
      function pathTo(from, to, radius) {
        if (!from || !to || !Number.isFinite(from.x) || !Number.isFinite(from.z) || !Number.isFinite(to.x) || !Number.isFinite(to.z)) return null;
        radius = Math.max(.01, radius == null ? .5 : radius);
        if (hasClearPath(from.x, from.z, to.x, to.z, radius)) return [{ x: to.x, z: to.z }];
        var graph = navGraphs[navGraphs.length - 1];
        for (var gi = 0; gi < navSizes.length; gi++) if (navSizes[gi] >= radius - 1e-6) { graph = navGraphs[gi]; break; }
        if (radius > graph.radius) return null;
        var targetClear = isWalkable(to.x, to.z, radius), start = navNode(from.x, from.z, graph, false, radius), goal = navNode(to.x, to.z, graph, !targetClear, radius);
        if (start < 0 || goal < 0) return null;
        navSerial = (navSerial + 1) >>> 0; if (!navSerial) { navSeen.fill(0); navClosed.fill(0); navSerial = 1; }
        var goalX = goal % navW, goalZ = Math.floor(goal / navW); navHeapN = 0;
        navScore[start] = 0; navParent[start] = -1; navSeen[start] = navSerial; navPush(start, Math.hypot(start % navW - goalX, Math.floor(start / navW) - goalZ));
        var found = false;
        while (navHeapN) {
          var id = navPop(); if (navClosed[id] === navSerial) continue; navClosed[id] = navSerial;
          if (id === goal) { found = true; break; }
          var ix = id % navW, iz = Math.floor(id / navW), mask = graph.links[id];
          for (var dir = 0; dir < 8; dir++) if (mask & (1 << dir)) {
            var other = (iz + navDZ[dir]) * navW + ix + navDX[dir]; if (navClosed[other] === navSerial) continue;
            var score = navScore[id] + (dir % 2 ? Math.SQRT2 : 1);
            if (navSeen[other] === navSerial && navScore[other] <= score + 1e-6) continue;
            navSeen[other] = navSerial; navScore[other] = score; navParent[other] = id;
            navPush(other, score + Math.hypot(other % navW - goalX, Math.floor(other / navW) - goalZ));
          }
        }
        if (!found) return null;
        var reverse = [], route = [], id = goal;
        while (id !== start && id >= 0) { reverse.push({ x: navMinX + id % navW * navStep, z: navMinZ + Math.floor(id / navW) * navStep }); id = navParent[id]; }
        reverse.push({ x: navMinX + start % navW * navStep, z: navMinZ + Math.floor(start / navW) * navStep });
        reverse.reverse(); if (targetClear) reverse.push({ x: to.x, z: to.z });
        // Collapse the grid staircase into straight safe legs. This also makes a short detour
        // feel like deliberate steering instead of a character snapping to every grid node.
        var anchorX = from.x, anchorZ = from.z, at = 0;
        while (at < reverse.length) {
          var far = at;
          while (far + 1 < reverse.length && hasClearPath(anchorX, anchorZ, reverse[far + 1].x, reverse[far + 1].z, radius)) far++;
          var point = reverse[far]; route.push(point); anchorX = point.x; anchorZ = point.z; at = far + 1;
        }
        return route.length ? route : [{ x: to.x, z: to.z }];
      }
      function roomAt(x, z) {
        for(var j=0;j<expansion.rooms.length;j++){var extra=expansion.rooms[j];if(Math.abs(x-extra.x)<=extra.w/2&&Math.abs(z-extra.z)<=extra.d/2)return extra;}
        var closest = rooms[0], best = Infinity;
        for (var i = 0; i < rooms.length; i++) {
          var r = rooms[i];
          if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) return r;
          var distance = Math.max(0, Math.abs(z - r.z) - r.d / 2) + Math.abs(x - r.x) * 0.01;
          if (distance < best) { best = distance; closest = r; }
        }
        return closest;
      }

      // ---- quality ----------------------------------------------------------------------------------------
      var particlesEnabled = true, particleScale = 1;
      // Only Low and High remain; High is the former Medium (budget index 1 below).
      var PRESET_LEVEL = { low: 0, high: 2 };
      function setQuality(settings) {
        if (typeof settings === 'string') settings = { preset: settings };
        settings = settings || {};
        if (typeof settings.reducedMotion === 'boolean') reducedMotion = settings.reducedMotion;
        var preset = settings.preset;
        if (PRESET_LEVEL[preset] == null) preset = settings.quality;
        if (PRESET_LEVEL[preset] == null) {
          var value = settings.detail;
          preset = typeof value === 'number' ? (value <= 0 ? 'low' : 'high') : (PRESET_LEVEL[value] != null ? value : 'high');
        }
        var level = PRESET_LEVEL[preset], budget = preset === 'low' ? 0 : 1;
        shadowHz = [0, 30, 60][budget]; shadowSlot = null;
        deferredShadow = refreshShadow = null; deferredSlot = null; refreshCanDefer = renderedDeferred = false;
        qualityLevel = level;
        var detail = Math.min(2, level);
        decorationBatches.forEach(function (mesh) { mesh.userData.detailOK = mesh.userData.detail <= detail; });
        applyRange(true);
        particlesEnabled = settings.particles !== 0 && settings.particles !== false;
        particleScale = [.4, .85, 1][budget];
        embersSys.points.visible = particlesEnabled;
        smokeSys.points.visible = ashSys.points.visible = oathSys.points.visible = particlesEnabled && level >= 1;
        moteSys.points.visible = flySys.points.visible = dripSys.points.visible = particlesEnabled && level >= 2;
        shaftMesh.visible = level >= 1;
        var shadows = settings.shadows !== false && settings.shadows !== 0;
        proxyBudget = budget; proxyShadows = shadows; refreshProxyState();
        occluders.forEach(function (mesh) { mesh.castShadow = shadows; });
        var wantLow = level === 0;
        if (wantLow !== lowShader) {
          lowShader = wantLow;
          surfaceMaterials.forEach(function (m) { if (wantLow) m.defines.G_LOW = ''; else delete m.defines.G_LOW; m.needsUpdate = true; });
        }
        materials.floor.normalScale.setScalar(level === 0 ? .5 : .9);
        materials.stone.normalScale.setScalar(level === 0 ? .5 : 1);
        // Fixed light pools: Low 2 / Medium 5 / High 6. Both upper presets keep
        // the same fire/window shadows; High restores their full 1024 px maps.
        setPoolSize([2, 5, 6][budget]);
        setSpotSlots(shadows && level > 0 ? 1 : 0, [0, 768, 1024][budget]);
        setMoonSpot(shadows ? [0, 768, 1024][budget] : 0);
        // Painted light pools stand in for real lights on Low; with more real lights they only add bounce.
        materials.decalGlow.color.setScalar([1.15, .775, .7][budget]);
        lightGain = typeof settings.lights === 'number' ? Math.max(.5, Math.min(1, .55 + settings.lights * .45)) : 1;
        if (settings.lights === false) lightGain = .5;
      }

      var ashTime = 0, touchedFlames = new Set();
      // Rooms far behind or far ahead of the player are skipped entirely (the camera would only see them
      // through heavy fog, e.g. from the low title angle). Detail level and distance are combined here.
      var rangeTargets = [], rangeClock = 0, rangeZ = null;
      // ajan:world-a: the camera never sees more than ~28 m ahead or ~12 m behind the hero (also through the broken walls)
      var RANGE_N = 30, RANGE_S = 14;
      allBatches.concat(decorationBatches, flameMeshes, occluders).forEach(function (m) {
        if (rangeTargets.indexOf(m) >= 0) return;
        if (m.userData.batchRanges) { m.userData.detailOK = true; rangeTargets.push(m); return; }
        var sphere = m.isInstancedMesh ? m.boundingSphere : null, zc, r;
        if (sphere) { zc = sphere.center.z; r = sphere.radius; }
        else { var b = new T.Box3().setFromObject(m); if (b.isEmpty()) return; zc = (b.min.z + b.max.z) / 2; r = (b.max.z - b.min.z) / 2 + 1; }
        if (r > 60) return;
        m.userData.zc = zc; m.userData.zr = r; if (m.userData.detailOK === undefined) m.userData.detailOK = true;
        rangeTargets.push(m);
      });
      decorationBatches.forEach(function (m) { if (rangeTargets.indexOf(m) < 0) rangeTargets.push(m), m.userData.zc = null; });
      // Static multi-draw groups that have no instance inside the camera frustum still cost a full draw submission (program, uniforms,
      // VAO) for zero triangles (about 25 per frame in a fight). Before the scene is projected (scene.onBeforeRender: exact camera, no
      // one-frame lag) the groups that cast no shadow and have no in-view instance are hidden. Instance bounds are the ones the group's
      // own per-instance culling uses (+3 m margin); the result is reused until the camera moves a metre or turns, or the ranges change.
      var cullMat = new T.Matrix4(), cullPos = new T.Vector3(), cullDir = new T.Vector3(), cullLastPos = new T.Vector3(1e9, 1e9, 1e9), cullLastDir = new T.Vector3(), cullCam = null, cullPx = 0, cullPy = 0, cullDirty = true, cullOff = /[?&]nobatchcull/.test(location.search);
      BABA.setBatchCull = function (on) { cullOff = !on; cullDirty = true; return !cullOff; };
      function cullBatchGroups(camera) {
        var i, m, ud;
        if (!camera || !camera.projectionMatrix) return;
        if (cullOff) { if (cullDirty) { cullDirty = false; for (i = 0; i < rangeTargets.length; i++) { ud = rangeTargets[i].userData; if (ud.batchRanges && ud.rangeVisible !== undefined) rangeTargets[i].visible = ud.rangeVisible; } } return; }
        cullPos.setFromMatrixPosition(camera.matrixWorld); camera.getWorldDirection(cullDir);
        var pe = camera.projectionMatrix.elements;
        if (!cullDirty && camera === cullCam && pe[0] === cullPx && pe[5] === cullPy && cullPos.distanceToSquared(cullLastPos) < 1 && cullDir.dot(cullLastDir) > .9998) return;
        cullDirty = false; cullCam = camera; cullPx = pe[0]; cullPy = pe[5]; cullLastPos.copy(cullPos); cullLastDir.copy(cullDir);
        cullMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        for (i = 0; i < rangeTargets.length; i++) {
          m = rangeTargets[i]; ud = m.userData;
          if (!ud.batchRanges || ud.rangeVisible === undefined) continue;
          m.visible = ud.rangeVisible && (m.castShadow || !ud.anyVisible || ud.anyVisible(cullMat, 3));
        }
      }
      scene.onBeforeRender = (function (before) {
        return function (renderer, s, camera) { if (before) before.apply(this, arguments); if (!isDisposed) cullBatchGroups(camera); };
      })(scene.onBeforeRender && scene.onBeforeRender !== T.Object3D.prototype.onBeforeRender ? scene.onBeforeRender : null);
      function applyRange(force) {
        if (!force && rangeZ !== null && Math.abs(rangeZ - focus.z) < 1.5) return;
        rangeZ = focus.z;
        rangeTargets.forEach(function (m) {
          var ok = m.userData.detailOK !== false;
          if (m.userData.batchRanges) {
            var any = false;
            m.userData.batchRanges.forEach(function (r) {
              var visible = ok && (r.zc == null || r.zc + r.zr > focus.z - RANGE_N && r.zc - r.zr < focus.z + RANGE_S);
              if (r.visible !== visible) { for (var i = r.start, end = i + r.count; i < end; i++) m.setVisibleAt(i, visible); r.visible = visible; }
              any = any || visible;
            });
            m.visible = any; m.userData.rangeVisible = any; cullDirty = true; return;
          }
          if (ok && m.userData.zc != null) ok = m.userData.zc + m.userData.zr > focus.z - RANGE_N && m.userData.zc - m.userData.zr < focus.z + RANGE_S;
          m.visible = ok;
        });
        syncProxies();
      }
      // Pendulum swing of hung fires; their flame card and light source follow the chain's end.
      function updateSwings(time) {
        for (var i = 0; i < swings.length; i++) {
          var w = swings[i], p = w.pivot;
          var a = reducedMotion ? 0 : w.amp * Math.sin(time * w.speed + w.phase), b = reducedMotion ? 0 : w.amp * .55 * Math.sin(time * w.speed * .83 + w.phase * 1.3);
          if (qualityLevel === 0) a = b = 0;
          p.rotation.set(b, 0, a);
          var sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
          if (w.source) { var s = w.source; s.track = true; s.livePos.x = p.position.x + w.ls * sa; s.livePos.y = 11 - w.ls * ca * cb; s.livePos.z = p.position.z - w.ls * ca * sb; }
          if (w.flame) { var f = w.flame; f.x = p.position.x + w.lf * sa; f.y = 11 - w.lf * ca * cb; f.z = p.position.z - w.lf * ca * sb; }
        }
      }
      function update(dt, time, focusPoint) {
        expansion.update(focusPoint);
        time = time || 0; dt = Math.max(0, Math.min(.1, dt || 0));
        var p = focusPoint;
        if (!p || !Number.isFinite(p.x)) { var app = BABA.app, g = app && app.game; p = g && g.player; }
        if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) { focus.x = p.x; focus.z = p.z; }
        var motionTime = reducedMotion ? 0 : time;
        if (materials.water && materials.water.userData.flow) materials.water.userData.flow.offset.set(motionTime * .011, motionTime * .0075);   // (ajan:models) drifting puddle glints
        flameUniforms.time.value = motionTime;
        playerLight.position.set(focus.x - 1.2, 3.5, focus.z + .6);   // off-axis (ajan:visual-dark): side key models the body instead of flat front light
        // The hero's own light is lent to the special ability / war cry (lighting.js): warm orbiting flash, same light count, no shader rebuild.
        if (playerLightFx) { playerLight.position.set(playerLightFx.x, playerLightFx.y, playerLightFx.z); playerLight.color.setRGB(playerLightFx.r, playerLightFx.g, playerLightFx.b); playerLight.intensity = playerLightFx.intensity; playerLight.distance = playerLightFx.distance; playerLightLent = true; }
        else if (playerLightLent) { playerLight.color.set('#ffd9b0'); playerLight.intensity = 6.5; playerLight.distance = 9; playerLightLent = false; }
        updateSwings(time);
        updateLights(dt, time);
        tintFlames(groupState('court').tint);
        shafts.forEach(function (sh, i) { shaftGain[i] = groupGain(sh[11]); });
        rangeClock += dt; if (rangeClock > .25) { rangeClock = 0; applyRange(false); }
        // Torch and brazier flames flutter (and follow scripted gains); candles animate in the shader only.
        var touched = touchedFlames; touched.clear();
        for (var i = 0; i < flameDefs.length; i++) {
          var f = flameDefs[i];
          if (!f.animate || Math.abs(f.z - focus.z) > 34) continue;
          var flutter = Math.sin(motionTime * 8.4 + f.phase) * 0.07 + Math.sin(motionTime * 13.7 + f.phase * 1.7) * 0.035;
          var gs = f.group ? Math.max(.22, Math.min(1.7, .3 + .7 * groupGain(f.group))) : 1;
          f.heatGain = gs;
          tmp.rotation.set(0, 0, 0);
          tmp.position.set(f.x, f.y + flutter * .13 * f.h * gs - (1 - gs) * f.h * .3, f.z); tmp.scale.set(f.w * (1 - flutter * .55) * (.6 + .4 * gs), f.h * (1 + flutter * .95) * gs, 1); tmp.updateMatrix();
          f.outer.setMatrixAt(f.oi, tmp.matrix); touched.add(f.outer);
          if (f.inner) { tmp.position.set(f.x, f.y - f.h * .15 * gs + flutter * .06 - (1 - gs) * f.h * .3, f.z); tmp.scale.set(f.w * .5 * (1 - flutter * .4) * (.6 + .4 * gs), f.h * .62 * (1 + flutter * .6) * gs, 1); tmp.updateMatrix(); f.inner.setMatrixAt(f.ii, tmp.matrix); touched.add(f.inner); }
        }
        touched.forEach(function (m) { m.instanceMatrix.needsUpdate = true; });
        if (!reducedMotion && qualityLevel > 0) {
          animatedCloth.forEach(function (cloth) {
            if (!cloth.mesh.visible) return;
            var pp = cloth.geometry.attributes.position, base = cloth.base;
            for (var v = 0; v < pp.count; v++) {
              var y = base[v * 3 + 1], sway = Math.pow(Math.max(0, -y / 2.3), 1.6);
              pp.setZ(v, base[v * 3 + 2] + Math.sin(time * .75 + y * 2.3 + cloth.phase) * .085 * sway);
            }
            pp.needsUpdate = true;
          });
          movingHangers.forEach(function (hanger) { if (!hanger.root.visible) return; hanger.root.rotation.z = Math.sin(time * .56 + hanger.phase) * .019; hanger.root.rotation.x = Math.sin(time * .43 + hanger.phase) * .012; });
        }
        if (particlesEnabled) updateParticles(dt, motionTime);
      }
      function nearFocus(z, range) { return Math.abs(z - focus.z) < (range || 30); }
      function updateParticles(dt, t) {
        var pos = embersSys.pos, size = embersSys.size, col = embersSys.col;
        var rage = groupState('court').tint;
        emberSources.forEach(function (s) {
          var gg = s.group ? groupGain(s.group) : 1, sx = s.follow ? s.follow.x : s.x, sy = s.follow ? s.follow.y + .1 : s.y, szz = s.follow ? s.follow.z : s.z;
          var active = nearFocus(s.z) && gg > .05, n = Math.max(1, Math.round(s.count * particleScale * Math.min(1, gg)));
          var riseK = s.group ? .6 + .5 * Math.min(1.6, gg) : 1;
          for (var k = 0; k < s.count; k++) {
            var i = s.offset + k, p3 = i * 3, p4 = i * 4;
            if (!active || k >= n) { col[p4 + 3] = 0; continue; }
            var age = (t * (.3 + (k % 3) * .06) + k * .61803 + s.x * .1) % 1;
            pos[p3] = sx + Math.sin(age * 6.5 + k * 2.8) * age * s.spread * 1.4 + Math.sin(t * .7 + k) * age * .25;
            pos[p3 + 1] = sy + age * s.rise * riseK;
            pos[p3 + 2] = szz + Math.cos(age * 4.2 + k) * age * s.spread;
            size[i] = (.05 + (k % 4) * .018) * (1 - age * .5);
            var heat = (1 - age);
            if (s.sick) { col[p4] = .5 * heat; col[p4 + 1] = 1.1 * heat; col[p4 + 2] = .2 * heat; }
            else { col[p4] = 1.9 * heat; col[p4 + 1] = (.62 - rage * .4 * (s.group ? 1 : 0)) * heat * heat; col[p4 + 2] = .08 * heat * heat; }
            col[p4 + 3] = Math.min(1, (1 - age) * 1.4) * (.6 + .4 * Math.sin(t * 17 + k * 3.1));
          }
        });
        embersSys.geometry.attributes.position.needsUpdate = embersSys.geometry.attributes.aSize.needsUpdate = embersSys.geometry.attributes.aColor.needsUpdate = true;
        if (smokeSys.points.visible) {
          pos = smokeSys.pos; size = smokeSys.size; col = smokeSys.col;
          smokeSources.forEach(function (s) {
            var active = nearFocus(s.z), gg = s.group ? Math.min(1.4, groupGain(s.group)) : 1;
            for (var k = 0; k < s.count; k++) {
              var i = s.offset + k, p3 = i * 3, p4 = i * 4;
              if (!active) { col[p4 + 3] = 0; continue; }
              var age = (t * s.rate + k / s.count + s.x * .013) % 1;
              pos[p3] = s.x + Math.sin(age * 3 + k * 1.3) * s.spread * (.3 + age) + age * age * .6; pos[p3 + 1] = s.y + age * s.rise; pos[p3 + 2] = s.z + Math.cos(age * 2.3 + k) * s.spread * (.3 + age);
              size[i] = s.size * (.45 + age * 1.3);
              // Lit from the fire below while young, cooling to soot as it climbs.
              var lit = Math.max(0, 1 - age * 2.6) * (s.group ? gg : .6);
              col[p4] = s.color[0] + lit * .5; col[p4 + 1] = s.color[1] + lit * .16; col[p4 + 2] = s.color[2] + lit * .03;
              col[p4 + 3] = s.alpha * Math.sin(Math.min(1, age * 1.1) * Math.PI) * (s.group ? .5 + .5 * Math.min(1, gg) : 1);
            }
          });
          smokeSys.geometry.attributes.position.needsUpdate = smokeSys.geometry.attributes.aSize.needsUpdate = smokeSys.geometry.attributes.aColor.needsUpdate = true;
          // Ash drifts down through the threshold and the court (hotter when the executioner rages).
          pos = ashSys.pos; size = ashSys.size; col = ashSys.col;
          for (var a = 0; a < ashCount; a++) {
            var sx = ashSeeds[a * 4], sz = ashSeeds[a * 4 + 1], ph = ashSeeds[a * 4 + 2], sp = ashSeeds[a * 4 + 3], p3a = a * 3, p4a = a * 4;
            if (!nearFocus(sz, 28) || a % 3 >= Math.round(3 * particleScale)) { col[p4a + 3] = 0; continue; }
            var court = sz < -130, rise = court && rage > .3 && a % 2 === 0;
            var fall = (ph + t * (rise ? .06 : .035) * sp) % 1;
            pos[p3a] = sx + Math.sin(t * .6 * sp + ph * 20) * .6; pos[p3a + 1] = rise ? .2 + fall * 5.4 : 5.2 - fall * 5.1; pos[p3a + 2] = sz + Math.cos(t * .45 * sp + ph * 11) * .5;
            size[a] = .035 + (a % 5) * .008;
            var warm = a % 11 === 0 || (court && a % 3 === 0 && rage > .2);
            col[p4a] = warm ? 1.6 : .16; col[p4a + 1] = warm ? .42 - (court ? rage * .25 : 0) : .155; col[p4a + 2] = warm ? .07 : .15;
            col[p4a + 3] = (warm ? .9 : .55) * Math.min(1, fall * 6) * Math.min(1, (1 - fall) * 8);
          }
          ashSys.geometry.attributes.position.needsUpdate = ashSys.geometry.attributes.aSize.needsUpdate = ashSys.geometry.attributes.aColor.needsUpdate = true;
          // The sworn oath stone breathes gold motes upward.
          pos = oathSys.pos; size = oathSys.size; col = oathSys.col;
          var oathOn = nearFocus(-128, 24) && oathLevel > .05;
          for (var o = 0; o < oathCount; o++) {
            var p3o = o * 3, p4o = o * 4;
            if (!oathOn || o >= Math.round(oathCount * particleScale)) { col[p4o + 3] = 0; continue; }
            var oa = (t * (.07 + (o % 5) * .012) + o * .61803) % 1, orad = .35 + (o % 7) * .2 + oa * .5, oang = o * 2.39996 + t * (.25 + (o % 3) * .08);
            pos[p3o] = Math.cos(oang) * orad; pos[p3o + 1] = .1 + oa * (oathLit ? 4.2 : 1.6); pos[p3o + 2] = -128 + Math.sin(oang) * orad;
            size[o] = .035 + (o % 4) * .012;
            var ow = Math.sin(oa * Math.PI) * Math.min(1.4, oathLevel) * (.55 + .45 * Math.sin(t * 3 + o));
            col[p4o] = 1.3; col[p4o + 1] = .85; col[p4o + 2] = .38; col[p4o + 3] = ow * (oathLit ? .9 : .45);
          }
          oathSys.geometry.attributes.position.needsUpdate = oathSys.geometry.attributes.aSize.needsUpdate = oathSys.geometry.attributes.aColor.needsUpdate = true;
        }
        if (moteSys.points.visible) {
          pos = moteSys.pos; size = moteSys.size; col = moteSys.col;
          for (var m = 0; m < moteCount; m++) {
            var shi = Math.floor(m / MOTES_PER_SHAFT), sh = shafts[shi], p3m = m * 3, p4m = m * 4;
            if (!nearFocus(sh[5], 30) || (m % MOTES_PER_SHAFT) >= MOTES_PER_SHAFT * .65) { col[p4m + 3] = 0; continue; }
            var along = (moteSeeds[m * 4] + t * .01 * (1 + moteSeeds[m * 4 + 3])) % 1, along2 = .15 + along * .8;
            var wdt = sh[6] + (sh[7] - sh[6]) * along2;
            var ax = sh[0] + (sh[3] - sh[0]) * along2, ay = sh[1] + (sh[4] - sh[1]) * along2, az = sh[2] + (sh[5] - sh[2]) * along2;
            pos[p3m] = ax + moteSeeds[m * 4 + 1] * wdt * .8 + Math.sin(t * .3 + m) * .12; pos[p3m + 1] = ay + Math.sin(t * .2 + m * 1.7) * .15; pos[p3m + 2] = az + moteSeeds[m * 4 + 2] * wdt * .8;
            size[m] = .026 + (m % 3) * .012 + (m % 17 === 0 ? .03 : 0);
            var tw = .5 + .5 * Math.sin(t * 1.3 + m * 2.3), mg = Math.min(1.5, shaftGain[shi]);
            col[p4m] = sh[8][0] * 1.1; col[p4m + 1] = sh[8][1] * 1.1; col[p4m + 2] = sh[8][2] * 1.1; col[p4m + 3] = (.25 + tw * .6) * Math.sin(along * Math.PI) * mg;
          }
          moteSys.geometry.attributes.position.needsUpdate = moteSys.geometry.attributes.aSize.needsUpdate = moteSys.geometry.attributes.aColor.needsUpdate = true;
          pos = flySys.pos; size = flySys.size; col = flySys.col;
          for (var fl = 0; fl < flyCount; fl++) {
            var home = flyHomes[fl % flyHomes.length], p3f = fl * 3, p4f = fl * 4;
            if (home[1] < -50 || !nearFocus(home[2], 22)) { col[p4f + 3] = 0; continue; }
            var ph2 = fl * 1.37;
            pos[p3f] = home[0] + Math.sin(t * (2.1 + fl % 3) + ph2) * .55 + Math.sin(t * 7.3 + ph2 * 2) * .08;
            pos[p3f + 1] = home[1] + Math.sin(t * 3.3 + ph2 * 1.3) * .3;
            pos[p3f + 2] = home[2] + Math.cos(t * (1.7 + fl % 4 * .3) + ph2) * .7;
            size[fl] = .034; col[p4f] = col[p4f + 1] = col[p4f + 2] = .01; col[p4f + 3] = .85;
          }
          flySys.geometry.attributes.position.needsUpdate = flySys.geometry.attributes.aColor.needsUpdate = flySys.geometry.attributes.aSize.needsUpdate = true;
          // Drops fall from the dark and ring the pools (rings are animated by the ripple shader on the same clock).
          pos = dripSys.pos; size = dripSys.size; col = dripSys.col;
          for (var d = 0; d < DRIPS.length; d++) {
            var dr = DRIPS[d], cyc = ((t + dr[4]) / dr[5] % 1) * dr[5], tf = Math.sqrt(2 * dr[1] / 9.8);
            for (var j = 0; j < 2; j++) {
              var q = d * 2 + j, p3d = q * 3, p4d = q * 4, tt = cyc - j * .025;
              if (!nearFocus(dr[2], 20) || tt < 0 || tt > tf) { col[p4d + 3] = 0; continue; }
              pos[p3d] = dr[0]; pos[p3d + 1] = dr[1] - 4.9 * tt * tt; pos[p3d + 2] = dr[2];
              size[q] = j ? .02 : .028;
              if (dr[3]) { col[p4d] = .12; col[p4d + 1] = .008; col[p4d + 2] = .006; } else { col[p4d] = .5; col[p4d + 1] = .56; col[p4d + 2] = .6; }
              col[p4d + 3] = j ? .35 : .8;
            }
          }
          dripSys.geometry.attributes.position.needsUpdate = dripSys.geometry.attributes.aSize.needsUpdate = dripSys.geometry.attributes.aColor.needsUpdate = true;
        }
      }
      // Fresh corpses draw flies after a while (lighting.js passes the newest dead positions).
      function setCorpses(list) {
        for (var i = 0; i < 4; i++) {
          var h = flyHomes[4 + i], c = list && list[i];
          if (c) { h[0] = c.x; h[1] = .55; h[2] = c.z; } else h[1] = -99;
        }
      }
      // The rite's carved star and the oath stone glow with their scripted light.
      var grooveBase = materials.bloodGroove.emissive.clone(), sanctuaryBase = materials.sanctuary.emissiveIntensity;
      // Ember-orange and dim: the crimson belongs to the unblockable Kurban Rünü rings that land beside it.
      function setRitualGlow(v) { materials.bloodGroove.emissive.copy(grooveBase).lerp(tmpColor.setRGB(.2, .05, .009, T.LinearSRGBColorSpace), Math.min(1.2, v) * .7); }
      function setOathGlow(v, lit) {
        oathLevel = v; oathLit = !!lit;
        materials.sanctuary.emissiveIntensity = sanctuaryBase + v * (lit ? 1.1 : .55);
        setGroup('oathShaft', lit ? .9 + Math.min(1.2, v) * .45 : .72);
      }

      // Atmosphere for the lighting rig, blended between rooms (numbers, colours, vectors alike).
      var COLOR_KEYS = ['fog', 'sky', 'ground', 'key', 'rim', 'charRim'], VEC_KEYS = ['lift', 'gain', 'shadowTint', 'highTint', 'vigColor', 'bloomTint'];
      var ARR_KEYS = ['keyDir', 'rimDir', 'wind'];
      var moodCooked = MOODS.map(function (m) {
        var o = {};
        Object.keys(m).forEach(function (k) {
          if (COLOR_KEYS.indexOf(k) >= 0) o[k] = new T.Color(m[k]);
          else if (k === 'mist') o[k] = new T.Color().setRGB(m[k][0], m[k][1], m[k][2], T.LinearSRGBColorSpace);
          else if (VEC_KEYS.indexOf(k) >= 0) o[k] = new T.Vector3().fromArray(m[k]);
          else o[k] = m[k];
        });
        return o;
      });
      var atmosphere = { room: 0, court: COURT };
      Object.keys(moodCooked[0]).forEach(function (k) {
        var v = moodCooked[0][k];
        atmosphere[k] = v && v.isColor ? new T.Color() : v && v.isVector3 ? new T.Vector3() : Array.isArray(v) ? v.slice() : 0;
      });
      atmosphere.keyIntensity = 0; atmosphere.rimIntensity = 0; atmosphere.saturation = 1;
      function atmosphereAt(x, z) {
        var i0 = 0, i1 = 0, t = 0;
        for (var i = 1; i < rooms.length; i++) {
          if (z <= rooms[i - 1].z && z >= rooms[i].z) { i0 = i - 1; i1 = i; t = (rooms[i - 1].z - z) / (rooms[i - 1].z - rooms[i].z); break; }
          if (z < rooms[i].z) { i0 = i1 = i; t = 0; }
        }
        t = t * t * (3 - 2 * t); t = Math.max(0, Math.min(1, (t - .3) / .4)); t = t * t * (3 - 2 * t);
        var a = moodCooked[i0], b = moodCooked[i1];
        Object.keys(a).forEach(function (k) {
          var va = a[k], vb = b[k], out = atmosphere[k];
          if (va && va.isColor) out.copy(va).lerp(vb, t);
          else if (va && va.isVector3) out.copy(va).lerp(vb, t);
          else if (Array.isArray(va)) { for (var j = 0; j < va.length; j++) out[j] = va[j] + (vb[j] - va[j]) * t; }
          else if (typeof va === 'number') atmosphere[k] = va + (vb - va) * t;
        });
        atmosphere.keyIntensity = atmosphere.keyI; atmosphere.rimIntensity = atmosphere.rimI; atmosphere.saturation = atmosphere.sat;
        atmosphere.room = t < .5 ? i0 : i1;
        return atmosphere;
      }
      function dispose() {
        expansion.dispose();
        if (isDisposed) return;
        isDisposed = true;
        scene.remove(root);
        Object.keys(geometries).forEach(function (k) { geometries[k].dispose(); });
        uniqueGeometries.forEach(function (g) { g.dispose(); });
        ownedGeometries.forEach(function (g) { g.dispose(); });
        Object.keys(materials).forEach(function (k) { materials[k].dispose(); });
        uniqueMaterials.forEach(function (m) { m.dispose(); });
        textures.forEach(function (t) { t.dispose(); });
        poolLights.forEach(function (s) { s.light.dispose(); }); playerLight.dispose();
        setSpotSlots(0, 0); setMoonSpot(0);
        allBatches.forEach(function (mesh) { if (mesh.dispose) mesh.dispose(); });
        flameMeshes.forEach(function (mesh) { mesh.dispose(); });
        if (rippleMesh) rippleMesh.dispose();
        root.clear();
      }
      setQuality('high');
      // These direct children never move: animation edits instance matrices or vertex buffers instead.
      // Keep their baked transforms through all scene/shadow passes; lights and swinging groups stay live.
      root.updateMatrixWorld(true);
      root.children.forEach(function (m) {
        if (!m.isMesh && !m.isPoints) return;
        m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false;
      });
      return {
        root: root, spawn: spawn, checkpoint: checkpoint, bossSpawn: bossSpawn,
        rooms: allRooms, paths: expansion.paths, encounters: encounters, colliders: colliders,
        questSites: BABA.WorldATemple && BABA.WorldATemple.active ? Object.assign({}, BABA.WorldATemple.sites) : undefined, /* ajan:world-a */
        move: move, isWalkable: isWalkable, hasClearPath: hasClearPath, pathTo: pathTo, roomAt: roomAt,
        update: update, dispose: dispose, setQuality: setQuality,
        atmosphereAt: atmosphereAt,
        occluders: occluders,
        materials: materials,
        // Read and driven by lighting.js (in-scatter, heat haze, scripted moments). Presentation only.
        lighting: {
          sources: lightSources, flames: flameDefs, shafts: shafts, moods: MOODS,
          prepareTextures: prepareLightTextures,
          setGroup: setGroup, setGroupTint: setGroupTint, groupGain: groupGain,
          setRitualGlow: setRitualGlow, setOathGlow: setOathGlow, setCorpses: setCorpses,
          setPlayerLightFx: function (fx) { playerLightFx = fx; },
          deferShadowRefresh: deferShadowRefresh,
          shadowRefreshDeferred: function () { return renderedDeferred; },
          wantsShadows: function () { return spotCount > 0 || !!moonSpot; }
        }
      };
    }
  };
})();
