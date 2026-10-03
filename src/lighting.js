/* KARA GEÇİT — light design: key/fill/rim rig per room, volumetric fog (low mist + light in-scattering),
   character rim/wrap light, heat-haze sources and the scripted light of the
   ritual hall, the oath stone and the executioner's court. Classic script; publishes BABA.Lighting.
   Must load before the app builds its first material (the fog shader chunks are replaced at load). */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var T = window.THREE;
  var MAX_SCATTER = 12;

  // ---------------------------------------------------------------- fog chunks (all built-in materials)
  // Distance fog stays three's FogExp2; on top of it every lit surface integrates a low mist layer (thick at the
  // floor, gone by chest height, drifting noise) and the in-scattering of the nearest lights along the view ray,
  // solved analytically (no ray marching). Transparent surfaces receive less mist so ground telegraphs stay crisp.
  var FOG = {
    karaLights: { value: [] }, karaLightColors: { value: [] }, karaLightRays: { value: [] },
    karaMist: { value: [new T.Vector4(0, 0, .8, 0), new T.Vector4(.03, .018, .32, .35), new T.Vector4(1, 1, 0, 0)] },
    karaMistColor: { value: [new T.Vector3(.1, .1, .1)] }
  };
  for (var li = 0; li < MAX_SCATTER; li++) {
    FOG.karaLights.value.push(new T.Vector4(0, -99, 0, 1)); FOG.karaLightColors.value.push(new T.Vector3());
    FOG.karaLightRays.value.push(new T.Vector4());
  }
  var C = T.ShaderChunk;
  // Three's fixed light pools also evaluate the complete PBR BRDF for lights whose range/cone has
  // already reduced their colour to zero. Reject those whole sections before the shadow reads and BRDF.
  // On opaque PBR surfaces a light behind both normals also has zero irradiance; skin wrap lighting is
  // the deliberate exception (KARA_SSS), and clearcoat keeps its own normal test. No light is removed.
  var directStarts = 0, directEnds = 0;
  function directGuard(line) {
    directStarts++;
    return line + '\n\t\tif ( directLight.visible && any( notEqual( directLight.color, vec3( 0.0 ) ) )\n'
      + '\t\t#if defined( STANDARD ) && ! defined( KARA_SSS )\n'
      + '\t\t\t&& ( dot( geometryNormal, directLight.direction ) > 0.0\n'
      + '\t\t\t#ifdef USE_CLEARCOAT\n'
      + '\t\t\t\t|| dot( geometryClearcoatNormal, directLight.direction ) > 0.0\n'
      + '\t\t\t#endif\n\t\t\t)\n\t\t#endif\n\t\t) {';
  }
  var directChunk = C.lights_fragment_begin
    .replace(/(\t\tget(?:Point|Directional)LightInfo\( [^\n]+\);)/g, directGuard)
    // The spotlight's mipmapped cookie needs valid implicit derivatives across the fragment quad.
    // Sample it outside the varying branch; then skip shadows/BRDF for zero cookie colour as well.
    .replace('\t\t#undef SPOT_LIGHT_MAP_INDEX', directGuard)
    .replace(/(\t\tRE_Direct\( directLight, [^\n]+\);)/g, function (line) { directEnds++; return line + '\n\t\t}'; });
  // Keep the vendor shader intact if a future Three upgrade changes the layout of these three loops.
  if (directStarts === 3 && directEnds === 3) C.lights_fragment_begin = directChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 vKaraWorld;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvKaraWorld = ( vec4( mvPosition.xyz - viewMatrix[ 3 ].xyz, 0.0 ) * viewMatrix ).xyz;\n#endif';
  C.fog_pars_fragment = [
    '#ifdef USE_FOG',
    '\tuniform vec3 fogColor;',
    '\tvarying float vFogDepth;',
    '\tvarying vec3 vKaraWorld;',
    '\t#ifdef FOG_EXP2',
    '\t\tuniform float fogDensity;',
    '\t#else',
    '\t\tuniform float fogNear;',
    '\t\tuniform float fogFar;',
    '\t#endif',
    '\tuniform vec4 karaLights[ ' + MAX_SCATTER + ' ];',
    '\tuniform vec3 karaLightColors[ ' + MAX_SCATTER + ' ];',
    '\tuniform vec4 karaLightRays[ ' + MAX_SCATTER + ' ];',
    '\tuniform vec4 karaMist[ 3 ];',
    '\tuniform vec3 karaMistColor[ 1 ];',
    '\tfloat karaHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }',
    '\tfloat karaNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );',
    '\t\treturn mix( mix( karaHash( i ), karaHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( karaHash( i + vec2( 0.0, 1.0 ) ), karaHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }',
    '#endif'].join('\n');
  C.fog_fragment = [
    '#ifdef USE_FOG',
    '\t#ifdef FOG_EXP2',
    '\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );',
    '\t#else',
    '\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth );',
    '\t#endif',
    '\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
    '\t{',
    '\t\tvec3 kP = vKaraWorld; vec3 kRd = kP - cameraPosition; float kLen = max( length( kRd ), 1e-3 ); kRd /= kLen;',
    '\t\tvec4 kM0 = karaMist[ 0 ]; vec4 kM1 = karaMist[ 1 ]; vec4 kM2 = karaMist[ 2 ];',
    '\t\tfloat kMist = 0.0; vec3 kScat = vec3( 0.0 ); vec3 kGlow = vec3( 0.0 );',
    '\t\tif ( kM0.y > 0.0 ) {',
    '\t\t\tfloat kH = kM0.z; float kYp = max( kP.y, 0.0 ); float kYc = max( cameraPosition.y, kYp + 0.01 );',
    '\t\t\tfloat kOd = kH * ( exp( - kYp / kH ) - exp( - kYc / kH ) ) / max( - kRd.y, 0.08 );',
    '\t\t\tvec2 kQ = kP.xz * kM1.z + kM0.w * kM1.xy;',
    // Low retains the height/distance mist, without eight trigonometric noise hashes at every surface pixel.
    '\t\t\tfloat kN = 0.5;',
    '\t\t\tif ( kM2.z > 0.5 ) kN = karaNoise( kQ ) * 0.62 + karaNoise( kQ * 2.7 + vec2( 5.2, 1.3 ) - kM0.w * kM1.xy * 1.9 ) * 0.38;',
    '\t\t\tkMist = 1.0 - exp( - kM0.y * kOd * ( 0.1 + 2.0 * smoothstep( 0.36, 0.9, kN ) ) );',
    '\t\t}',
    '\t\tint kCount = int( kM0.x );',
    '@KARA_SCATTER@',
    '\t\t#if ! defined( OPAQUE ) && ! defined( KARA_FULLMIST )',
    '\t\t\tkMist *= kM1.w;',
    '\t\t#endif',
    '\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb, karaMistColor[ 0 ] + kGlow * kM2.y, kMist ) + kScat * kM2.x;',
    '\t}',
    '#endif'].join('\n');
  // In-scattering of the nearest lights along the view ray, one closed-form term per light. The loop is written out (not a `for`) on purpose:
  // ANGLE's Metal backend compiled the runtime-count loop so badly that it cost about half of a Retina frame's GPU time; the same
  // arithmetic with constant indices is several times cheaper and identical on every GPU. Two cheap changes on top, invisible by design:
  // the arctangent is a polynomial (error < 1e-4 rad) and a light whose whole possible contribution is below ~1/20000 of the
  // displayed range (bound: C * r^4 * (1 + pi) / (2 a^3), a^2 = r^2 + miss distance^2) is skipped before the expensive part.
  function scatterTerm(q) {
    return [
      '\t\tif ( kCount > ' + q + ' ) {',
      '\t\t\tvec4 kL = karaLights[ ' + q + ' ]; vec3 kC = karaLightColors[ ' + q + ' ]; vec4 kRay = karaLightRays[ ' + q + ' ];',
      '\t\t\tvec3 kD = kP + vec3( 0.0, 0.3, 0.0 ) - kL.xyz; float kG = kL.w / ( kL.w + dot( kD, kD ) * 0.3 ); kGlow += kC * kG * kG;',
      // The economical preset uses the same warm/cold glow, without the per-light ray integral.
      '\t\t\tif ( kM2.z < 0.5 ) kScat += kC * kG * kG * 0.25;',
      '\t\t\telse {',
      '\t\t\t\tfloat kB = dot( kRay.xyz, kRd );',
      // density ~ 1 / (1 + k d^2)^2 around each light, integrated in closed form along the view ray
      // kL.w holds radius squared; camera-relative source position/distance are frame constants, uploaded once.
      '\t\t\t\tfloat kH2 = max( kRay.w - kB * kB, 0.0 ); float kA2 = kL.w + kH2;',
      '\t\t\t\tfloat kBound = max( kC.r, max( kC.g, kC.b ) ) * kL.w * kL.w * 2.1 * kM2.x;',
      '\t\t\t\tif ( kBound * kBound > 2.5e-9 * kA2 * kA2 * kA2 ) {',
      '\t\t\t\t\tfloat kIA = inversesqrt( kA2 ); float kA = kA2 * kIA;',
      '\t\t\t\t\tfloat kU1 = kLen - kB; float kU0 = - kB;',
      // atan(u1/a)-atan(u0/a) = atan2(a*(u1-u0), a*a+u1*u0), in [0, pi] because the ray length is positive
      '\t\t\t\t\tfloat kY = kLen * kA, kX = kA2 + kU1 * kU0, kAx = abs( kX );',
      '\t\t\t\t\tfloat kR = min( kAx, kY ) / max( max( kAx, kY ), 1e-6 ); float kR2 = kR * kR;',
      '\t\t\t\t\tfloat kAngle = kR * ( 0.9998660 + kR2 * ( -0.3302995 + kR2 * ( 0.1801410 + kR2 * ( -0.0851330 + kR2 * 0.0208351 ) ) ) );',
      '\t\t\t\t\tif ( kY > kAx ) kAngle = 1.5707963 - kAngle;',
      '\t\t\t\t\tif ( kX < 0.0 ) kAngle = 3.1415927 - kAngle;',
      '\t\t\t\t\tfloat kI = ( kU1 / ( kA2 + kU1 * kU1 ) - kU0 / ( kA2 + kU0 * kU0 ) + kAngle * kIA ) * kIA * kIA * 0.5;',
      '\t\t\t\t\tkScat += kC * kI * kL.w * kL.w;',
      '\t\t\t\t}',
      '\t\t\t}',
      '\t\t}'].join('\n');
  }
  var fogTemplate = C.fog_fragment, scatterCode = '';
  for (var sq = 0; sq < MAX_SCATTER; sq++) scatterCode += scatterTerm(sq) + '\n';
  var shaderPreparation = Object.freeze({ fogLoop: 'unrolled', rasterWarmup: false });
  function configureBackend(rendererName) {
    var runtime = /NVIDIA/i.test(rendererName || '') && /Direct3D\s*11|\bD3D11\b/i.test(rendererName || '');
    // A uniform loop bound prevents twelve copies of this integral being expanded
    // into every material's D3D11 executable. The active slots and addition order
    // are identical. Keep the expanded code on Metal, where it draws faster.
    var code = runtime ? 'for (int kIndex = 0; kIndex < kCount; kIndex++) {\n' + scatterTerm('kIndex') + '\n}' : scatterCode;
    C.fog_fragment = fogTemplate.replace('@KARA_SCATTER@', function () { return code; });
    return shaderPreparation = Object.freeze({ fogLoop: runtime ? 'runtime-count' : 'unrolled', rasterWarmup: runtime });
  }
  configureBackend('');
  function injectFogUniforms(target) { Object.keys(FOG).forEach(function (k) { target[k] = FOG[k]; }); }
  injectFogUniforms(T.UniformsLib.fog);
  Object.keys(T.ShaderLib).forEach(function (k) { var u = T.ShaderLib[k].uniforms; if (u && u.fogDensity) injectFogUniforms(u); });

  // ---------------------------------------------------------------- character rim / wrap light
  // Fresnel-weighted rim from the room's back light plus wrap from the nearby real point lights, and a soft
  // camera-side fill so a body is never a black hole (e.g. the executioner backlit by the oculus). Added to the characters' own graded materials at runtime.
  var RIM = {
    karaRimDir: { value: new T.Vector3(0, .6, -.8) }, karaRimColor: { value: new T.Vector3(.4, .45, .6) },
    karaRimParams: { value: new T.Vector4(2.4, 1, .9, 0) }, karaFill: { value: new T.Vector3(.02, .02, .025) }
  };
  var RIM_HEAD = 'uniform vec3 karaRimDir; uniform vec3 karaRimColor; uniform vec4 karaRimParams; uniform vec3 karaFill;';
  var RIM_BODY = [
    '{',
    '  float kNV = saturate( dot( normal, geometryViewDir ) );',
    '  float kF = pow( 1.0 - kNV, karaRimParams.x );',
    '  vec3 kR = karaRimColor * saturate( dot( normal, karaRimDir ) * 0.65 + 0.35 );',
    '  #if NUM_POINT_LIGHTS > 0',
    '  for ( int ki = 0; ki < NUM_POINT_LIGHTS; ki ++ ) {',
    '    vec3 kl = pointLights[ ki ].position - geometryPosition; float kd = length( kl ); kl /= max( kd, 1e-3 );',
    '    kR += pointLights[ ki ].color * getDistanceAttenuation( kd, pointLights[ ki ].distance, pointLights[ ki ].decay ) * karaRimParams.z * saturate( dot( normal, kl ) + 0.45 );',
    '  }',
    '  #endif',
    '  reflectedLight.directDiffuse += kR * kF * ( material.diffuseColor * 0.7 + 0.1 ) * karaRimParams.y;',
    // camera-side fill (characters only): faces toward the view stay readable, silhouettes keep their shape
    '  reflectedLight.indirectDiffuse += karaFill * material.diffuseColor * ( 0.3 + 0.7 * kNV );',
    '}'].join('\n');
  function patchRim(m) {
    if (!m || m.userData.karaRim || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
    m.userData.karaRim = true;
    var before = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.onBeforeCompile = function (sh, r) {
      if (before) before.call(this, sh, r);
      Object.keys(RIM).forEach(function (k) { sh.uniforms[k] = RIM[k]; });
      if (sh.fragmentShader.indexOf('#include <lights_fragment_end>') < 0) return;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + RIM_HEAD)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + RIM_BODY);
    };
    m.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|kara-rim-1'; };
    m.needsUpdate = true;
  }
  function patchModel(root) {
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchRim);
    });
  }

  // ---------------------------------------------------------------- presets
  var PRESET = {
    low:  { scatter: 2, moonShadow: 0,    shadowHz: 0, rimWrap: .8, mistDetail: 0 },
    high: { scatter: 8, moonShadow: 1024, shadowHz: 30, rimWrap: .95, mistDetail: 1 }
  };

  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function colorVec(c, out) { return out.set(c.r, c.g, c.b); }

  function create(opts) {
    var renderer = opts.renderer, scene = opts.scene, camera = opts.camera, world = opts.world;
    var L = world.lighting || null;
    var preset = PRESET.high, reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Key (moon/sky through the vault), fill (hemisphere + a dim probe) and environment rim.
    var hemi = new T.HemisphereLight('#7d8ea4', '#17130f', .5); scene.add(hemi);
    var moon = new T.DirectionalLight('#a3b9d8', 1.2); moon.position.set(-9, 19, 5);
    moon.shadow.camera.left = -20; moon.shadow.camera.right = 20; moon.shadow.camera.top = 20; moon.shadow.camera.bottom = -20;
    moon.shadow.camera.near = 1; moon.shadow.camera.far = 60; moon.shadow.bias = -.0003; moon.shadow.normalBias = .05;
    moon.shadow.autoUpdate = false;
    var moonShadowSlot = null, moonPendingSlot = null;
    var shadowFrameAt = null, shadowFrameInterval = 0;
    var moonTarget = new T.Object3D(); scene.add(moonTarget); moon.target = moonTarget; scene.add(moon);
    var rim = new T.DirectionalLight('#8aaee0', 1.1); rim.position.set(4, 7.5, -4); scene.add(rim); scene.add(rim.target);
    (function environment() {
      var envScene = new T.Scene(); envScene.background = new T.Color('#1d252b');
      var pmrem = new T.PMREMGenerator(renderer), cards = [];
      [[-7, 8, 2, '#c9d5d9', 1.1], [8, 3, -4, '#a0643a', .9], [0, 15, 0, '#728393', .6], [0, 2, 9, '#3a2a22', .5]].forEach(function (d) {
        var m = new T.Mesh(new T.PlaneGeometry(7, 12), new T.MeshBasicMaterial({ color: d[3], side: T.DoubleSide, fog: false }));
        m.material.color.multiplyScalar(d[4]); m.position.set(d[0], d[1], d[2]); m.lookAt(0, 0, 0); envScene.add(m); cards.push(m);
      });
      var env = pmrem.fromScene(envScene, .035, .1, 60); scene.environment = env.texture; scene.environmentIntensity = .22;
      cards.forEach(function (m) { m.geometry.dispose(); m.material.dispose(); }); pmrem.dispose();
    }());

    // Scripted moments.
    var director = { bossSeen: false, bossActiveAt: -1, phase2At: -1, bossDeadAt: -1, checkpointAt: -1, lastCheckpoint: null, ritualLive: 1, wasBoss: false };
    var grade = { lift: new T.Vector3(), gain: new T.Vector3(1, 1, 1), saturation: 1, contrast: .12, shadowTint: new T.Vector3(1, 1, 1), highTint: new T.Vector3(1, 1, 1),
      vignette: .5, vignetteColor: new T.Vector3(), bloom: .6, bloomTint: new T.Vector3(1, 1, 1), exposure: 1.15 };
    var target = { fog: new T.Color(), mist: new T.Color(), sky: new T.Color(), ground: new T.Color(), key: new T.Color(), rim: new T.Color(), charRim: new T.Color() };
    var state = null, patched = new WeakSet(), patchClock = 0, cfgRef = opts.cfg || {};
    var tmpV = new T.Vector3(), tmpC = new T.Color(), tmpC2 = new T.Color(), keyDir = new T.Vector3(-9, 19, 5);

    // The world may add/remove its shadowed spots after this rig's setQuality ran; re-check every frame (cheap,
    // and the flag only flips on a preset change).
    var moonShadows = false;
    function syncShadowMap() {
      var on = moonShadows || !!(L && L.wantsShadows && L.wantsShadows());
      if (renderer.shadowMap.enabled !== on) renderer.shadowMap.enabled = on;
    }
    function setQuality(cfg) {
      cfgRef = cfg || cfgRef;
      preset = PRESET[cfgRef.quality || cfgRef.preset] || PRESET.high;
      var shadows = preset.moonShadow > 0 && cfgRef.shadows !== 0;
      moonShadows = shadows; syncShadowMap();
      moon.castShadow = shadows;
      moonShadowSlot = null; moon.shadow.needsUpdate = shadows;
      moonPendingSlot = null;
      shadowFrameAt = null; shadowFrameInterval = 0;
      FOG.karaMist.value[2].z = preset.mistDetail;
      if (shadows && moon.shadow.mapSize.x !== preset.moonShadow) {
        moon.shadow.mapSize.set(preset.moonShadow, preset.moonShadow);
        if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
      }
      if (!scene.fog) scene.fog = new T.FogExp2('#0b1116', .02);
      if (typeof cfgRef.reducedMotion === 'boolean') reducedMotion = cfgRef.reducedMotion;
    }

    // The key light keeps its room-specific direction relative to the player; shadows move with the camera.
    function follow(p) {
      moon.position.set(p.x + keyDir.x, keyDir.y, p.z + keyDir.z); moonTarget.position.set(p.x, 0, p.z - 6); moonTarget.updateMatrixWorld();
      rim.position.set(p.x + 3.5, 4.6, p.z - 13); rim.target.position.set(p.x, .9, p.z); rim.target.updateMatrixWorld();
    }

    function patchCharacters(game) {
      if (!game) return;
      var enemies = game.enemies || [];
      for (var i = -1; i < enemies.length; i++) {
        var actor = i < 0 ? game.player : enemies[i], m = actor && actor.model;
        if (m && m.root && !patched.has(m.root)) { patched.add(m.root); patchModel(m.root); }
      }
    }

    // One material drawn by different caster kinds (skinned body, instanced prop, batched world, plain mesh) makes
    // three.js rebuild its program parameters and cache key at every kind switch inside a frame (~23 rebuilds per
    // frame in combat). Each extra kind gets a twin: same shader program, shared defines/hooks/userData/uniforms,
    // and it follows every later change of the original (values, maps, needsUpdate), so nothing looks different.
    var twins = [];
    var TWIN_VALUES = ['opacity', 'transparent', 'visible', 'roughness', 'metalness', 'emissiveIntensity', 'envMapIntensity', 'map',
      'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'aoMapIntensity', 'lightMap', 'lightMapIntensity',
      'envMap', 'depthWrite', 'depthTest', 'side', 'shadowSide', 'blending', 'alphaTest', 'wireframe', 'colorWrite', 'toneMapped', 'fog',
      'vertexColors', 'flatShading', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'bumpScale', 'displacementScale', 'alphaHash', 'bumpMap', 'displacementMap', 'displacementBias'];
    var TWIN_COLORS = ['color', 'emissive'];
    // Game code must change the original material (library / materials.X entry), not a twin's mesh.material.
    var TWIN_SKIP = { combat_feedback: 1, fx_warm: 1, kor_ve_kul_tells: 1, limbs: 1, rim_shell: 1, rim_weapon: 1 };
    function twinnable(m) {
      return !!m && !m.isShaderMaterial && (m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial);
    }
    function drawKind(o) {
      var g = o.geometry, k = o.isSkinnedMesh ? 's' : o.isBatchedMesh ? (o._colorsTexture ? 'B' : 'b')
        : o.isInstancedMesh ? (o.instanceColor ? 'I' : 'i') + (o.morphTexture ? 'm' : '') : 'p';
      if (g) {
        var ma = g.morphAttributes, at = g.attributes;
        k += (ma && ma.position ? ma.position.length : 0) + '.' + (ma && ma.normal ? 1 : 0) + (ma && ma.color ? 1 : 0)
          + (at.color && at.color.itemSize === 4 ? 'a' : '') + (at.tangent ? 't' : '');
      }
      return k;
    }
    function twinSync(t, all) {
      var s = t.__karaTwinOf, last = t.__karaLast, i, p, v, c;
      if (s.version !== t.__karaVersion) {
        // A later patch of the original (rim light, grade) arrives with needsUpdate: carry its hooks over too.
        t.__karaVersion = s.version; t.needsUpdate = true; all = true; twinHooks(s, t);
      }
      for (i = 0; i < TWIN_VALUES.length; i++) {
        p = TWIN_VALUES[i]; v = s[p];
        if (v !== undefined && (all || v !== last[p])) { last[p] = v; t[p] = v; }
      }
      for (i = 0; i < TWIN_COLORS.length; i++) {
        p = TWIN_COLORS[i]; c = s[p]; if (!c) continue; v = last[p] || (last[p] = [NaN, NaN, NaN]);
        if (all || c.r !== v[0] || c.g !== v[1] || c.b !== v[2]) { v[0] = c.r; v[1] = c.g; v[2] = c.b; t[p].copy(c); }
      }
      if (s.normalScale && t.normalScale && (all || s.normalScale.x !== last.nsx || s.normalScale.y !== last.nsy)) { last.nsx = s.normalScale.x; last.nsy = s.normalScale.y; t.normalScale.copy(s.normalScale); }
    }
    function twinHooks(src, t) {
      Object.keys(src).forEach(function (k) {
        // Skip private/engine keys (e.g. EventDispatcher's _listeners): sharing them breaks dispose.
        if (k.charAt(0) === '_') return;
        if (!(k in t) || k === 'onBeforeCompile' || k === 'customProgramCacheKey' || k === 'onBeforeRender') t[k] = src[k];
      });
      if (src.defines) t.defines = src.defines;
    }
    function makeTwin(src) {
      var ud = src.userData, t; src.userData = {};
      try { t = src.clone(); } finally { src.userData = ud; }
      t.userData = ud; t.name = src.name;
      if (src.defines) t.defines = src.defines;
      twinHooks(src, t);
      t.__karaTwinOf = src; t.__karaVersion = src.version; t.__karaLast = {};
      twinSync(t, true);
      var off = function () { src.removeEventListener('dispose', off); var i = twins.indexOf(t); if (i >= 0) twins.splice(i, 1); t.dispose(); };
      src.addEventListener('dispose', off);
      twins.push(t); return t;
    }
    function splitShared(root) {
      if (!root || !root.traverse) return;
      var groups = new Map();
      // Only the world and the actors: effect/telegraph/limb objects write through mesh.material at runtime.
      (function walk(o) {
        if (o !== root && TWIN_SKIP[o.name]) return;
        var ch = o.children; for (var ci = 0; ci < ch.length; ci++) walk(ch[ci]);
        if (!o.isMesh || o.isSprite || (o.userData && o.userData.occluder)) return;
        var m = o.material; if (!m || Array.isArray(m) || m.__karaTwinOf || !twinnable(m)) return;
        var k = drawKind(o), g = groups.get(m); if (!g) groups.set(m, g = {});
        (g[k] || (g[k] = [])).push(o);
      })(root);
      groups.forEach(function (g, m) {
        var kinds = Object.keys(g), home = m.__karaHome;
        if (!home) { home = kinds[0]; kinds.forEach(function (k) { if (g[k].length > g[home].length) home = k; }); m.__karaHome = home; }
        kinds.forEach(function (k) {
          if (k === home) return;
          var tw = m.__karaTwins || (m.__karaTwins = {}), t = tw[k] || (tw[k] = makeTwin(m));
          g[k].forEach(function (o) { o.material = t; });
        });
      });
    }
    function splitCharacters(game) {
      if (!game) return;
      var enemies = game.enemies || [];
      for (var i = -1; i < enemies.length; i++) {
        var actor = i < 0 ? game.player : enemies[i], m = actor && actor.model;
        if (m && m.root) splitShared(m.root);
      }
    }
    function prepare(game) { patchCharacters(game); splitShared(scene); splitCharacters(game); }

    // Fog in-scattering: the brightest sources near the view centre (real or not) glow in the air. A source entering or leaving the
    // brightest-N set fades its glow in/out over ~.25 s (up to MAX_SCATTER slots), instead of the haze around a torch popping on/off.
    var scatterList = [];
    function updateScatter(fx, fz, dt) {
      var U = FOG.karaLights.value, Cc = FOG.karaLightColors.value, rays = FOG.karaLightRays.value, count = 0;
      if (L && L.sources) {
        scatterList.length = 0;
        for (var i = 0; i < L.sources.length; i++) {
          var s = L.sources[i]; if (!s.scatter || s.live <= 0.002) { s.scW = 0; continue; }
          var dx = s.x - fx, dz = s.z - fz, d2 = dx * dx + dz * dz;
          if (d2 > 26 * 26) { s.scW = 0; continue; }
          s.scatterScore = s.scatter * s.intensity * s.live / (1 + d2 / 40);
          scatterList.push(s);
        }
        scatterList.sort(function (a, b) { return b.scatterScore - a.scatterScore; });
        var want = Math.min(preset.scatter, scatterList.length), fade = Math.min(1, dt * 4.5);
        var cap = Math.min(MAX_SCATTER, want + 2);   // at most two fading glows on top of the wanted ones
        for (var j = 0; j < scatterList.length && count < cap; j++) {
          var src = scatterList[j], sw = src.scW || 0;
          if (j < want) sw = Math.min(1, sw + fade); else sw = Math.max(0, sw - fade);
          src.scW = sw; if (sw <= 0) continue;
          var r0 = src.glowRadius || 1.2, pos = src.livePos || src;
          U[count].set(pos.x, pos.y, pos.z, r0 * r0);
          var cx = pos.x - camera.position.x, cy = pos.y - camera.position.y, cz = pos.z - camera.position.z;
          rays[count].set(cx, cy, cz, cx * cx + cy * cy + cz * cz);
          var col = src.liveColor || src.color, k = src.scatter * src.intensity * src.live * .006 * sw * sw * (3 - 2 * sw);
          Cc[count].set(col.r * k, col.g * k, col.b * k); count++;
        }
        for (; j < scatterList.length; j++) scatterList[j].scW = 0;
      }
      for (var z = count; z < MAX_SCATTER; z++) { U[z].set(0, -99, 0, 1); Cc[z].set(0, 0, 0); rays[z].set(0, 0, 0, 0); }
      FOG.karaMist.value[0].x = count;
    }

    // Heat haze above the nearest big flames (screen space; the post pass distorts there).
    var heatList = [], proj = new T.Vector3();
    function updateHeat(heat, fx, fz) {
      if (!heat) return;
      var i, n = 0;
      heatList.length = 0;
      if (L && L.flames && !reducedMotion) {
        for (i = 0; i < L.flames.length; i++) {
          var f = L.flames[i]; if (f.h < .6 || f.hidden) continue;
          var dx = f.x - fx, dz = f.z - fz; if (dx * dx + dz * dz > 22 * 22) continue;
          f.heatScore = f.h * f.w * (f.heatGain == null ? 1 : f.heatGain) / (1 + (dx * dx + dz * dz) / 60); heatList.push(f);
        }
        heatList.sort(function (a, b) { return b.heatScore - a.heatScore; });
      }
      for (i = 0; i < heat.length; i++) {
        var fl = heatList[i];
        if (!fl) { heat[i].w = 0; continue; }
        proj.set(fl.x, fl.y + fl.h * .35, fl.z).project(camera);
        if (proj.z > 1 || Math.abs(proj.x) > 1.2 || Math.abs(proj.y) > 1.2) { heat[i].w = 0; continue; }
        tmpV.set(fl.x, fl.y + fl.h * .35, fl.z); var dist = tmpV.distanceTo(camera.position);
        var sizeUv = fl.h * 1.1 / (2 * dist * Math.tan(camera.fov * Math.PI / 360));
        heat[i].set(proj.x * .5 + .5, proj.y * .5 + .5, Math.max(.01, sizeUv), Math.min(1.2, .55 + fl.w * .5) * (fl.heatGain == null ? 1 : fl.heatGain));
        n++;
      }
      return n;
    }

    // War cry in screen space: a ring of pressure (ripple + colour fringe + red vignette) leaves the hero for ~.7 s after the roar is released
    // (player.rageFlash counts down from 1 at .7 s), and while the fury burns the hero himself shimmers with heat.
    function warCryPost(heat, pulse, p) {
      var age = p.rageFlash > 0 ? (1 - p.rageFlash) / 1.4 : 9, raging = p.rageTime > 0 && !p.dead;
      pulse.w = 0;
      if (reducedMotion) return;
      if (age < .75) {
        proj.set(p.x, 1.1, p.z).project(camera);
        var k = age / .75, e = 1 - Math.pow(1 - k, 2.2);
        pulse.set(proj.x * .5 + .5, proj.y * .5 + .5, .04 + e * .6, Math.sin(Math.min(1, age / .05) * Math.PI / 2) * (1 - k) * (1 - k) * .44);   // parent: war cry blurred too much (ripple strength and reach cut ~60 %)
      }
      if (raging && heat.length) {
        proj.set(p.x, .2, p.z).project(camera); tmpV.set(p.x, .2, p.z);
        var dist = tmpV.distanceTo(camera.position), sizeUv = 2.4 / (2 * dist * Math.tan(camera.fov * Math.PI / 360));
        heat[heat.length - 1].set(proj.x * .5 + .5, proj.y * .5 + .5, Math.max(.01, sizeUv), .75 + .5 * (p.rageFlash || 0));
      }
    }

    // ---- Zincir Girdabı (1) and war cry (2): screen effects, a borrowed light and camera layers ----
    // Reads player.special = {active, t, tick, radius[, ticks, duration, turns]} (falls back to player.attack.whirl) and player.rageFlash defensively.
    // Feeds Post.setAbilityFx every frame something is going on (nothing when idle), drives world.lighting.setPlayerLightFx (the hero's own point light
    // is borrowed: no new light, no shader rebuild) and hands camera layers to app.js through cameraFx(). See DESIGN.md "Ability screen effects".
    var ab = { spin: 0, tick: 0, flash: 0, chroma: 0, sat: 0, vig: 0, freeze: 0, light: 0, fov: 0, fovT: 0, ix: 0, iz: 0, ang: 0, clock: 0, stepped: false,
      ringAge: 9, ringLife: .4, ringR: 3, ringW: .5, rx: 0, rz: 0, warm: 0, wr: 6.5, lx: 0, lz: 0, lightOn: false };
    var abIn = { active: false, angle: null, t: 0, tick: 0, ticks: 4, radius: 3.6, duration: 1.3, turns: 4 }, abFx = { spin: 0, spinAt: { x: 0, z: 0 }, chroma: 0, flash: 0, sat: 0, vig: 0, freeze: 0, ring: null },
      abRing = { x: 0, z: 0, r: 1, w: .5, t: 0 }, abLight = { x: 0, y: 1.5, z: 0, r: 1, g: .4, b: .14, intensity: 0, distance: 10 }, camOut = { x: 0, y: 0, z: 0, ix: 0, iz: 0 };
    var baseFov = camera.fov, EMBER = [1, .4, .13], HOTWHITE = [1, .78, .5];
    var abilitySerial = null;
    function clearAbility() {
      ab.spin = ab.tick = ab.flash = ab.chroma = ab.sat = ab.vig = ab.freeze = ab.light = ab.fov = ab.fovT = ab.ix = ab.iz = ab.ang = ab.clock = 0;
      ab.ringAge = 9; ab.ringLife = .4; ab.ringR = 3; ab.ringW = .5;
      ab.rx = ab.rz = ab.warm = ab.lx = ab.lz = 0; ab.wr = 6.5; ab.stepped = ab.lightOn = false;
      abIn.active = false; abIn.angle = null; abIn.t = abIn.tick = 0;
      abFx.spin = abFx.chroma = abFx.flash = abFx.sat = abFx.vig = abFx.freeze = 0; abFx.spinAt.x = abFx.spinAt.z = 0; abFx.ring = null;
      if (opts.post && opts.post.clearAbilityFx) opts.post.clearAbilityFx();
      if (L && L.setPlayerLightFx) L.setPlayerLightFx(null);
      if (Math.abs(camera.fov - baseFov) > .0005) { camera.fov = baseFov; camera.updateProjectionMatrix(); }
    }
    function abilityRead(p) {
      var sp = p.special, a = p.attack;
      if (sp && typeof sp === 'object') {
        abIn.active = !!sp.active; abIn.t = +sp.t || 0; abIn.tick = sp.tick | 0; abIn.ticks = sp.ticks > 0 ? sp.ticks : 4;
        abIn.radius = sp.radius > 0 ? sp.radius : 3.6; abIn.duration = sp.duration > 0 ? sp.duration : 1.3; abIn.turns = sp.turns > 0 ? sp.turns : 4;
        abIn.angle = Number.isFinite(sp.spin) ? (+p.yaw || 0) + sp.spin : null;   // the chain's world angle when the hero exposes it
      } else if (a && a.whirl) {
        abIn.active = true; abIn.t = +a.age || 0; abIn.tick = a.ticks | 0; abIn.ticks = 4; abIn.radius = a.radius > 0 ? a.radius : 3.6; abIn.duration = a.duration > 0 ? a.duration : 1.3; abIn.turns = 4; abIn.angle = null;
      } else abIn.active = false;
      if (p.dead) abIn.active = false;
    }
    function abilityTick(p, final) {
      // one hit of the whirlwind lands: flash, colour fringe, saturation punch, shock ring, light burst, camera kick (the last one is heavier, with hit-freeze)
      // (parent: the whirlwind blurred and flashed too much: flash 25 %, fringe 30 %, saturation punch and vignette ~15 %, light burst 40 %, freeze weaker and shorter)
      ab.flash = Math.max(ab.flash, final ? .12 : .07); ab.chroma = Math.max(ab.chroma, final ? .3 : .15); ab.sat = Math.max(ab.sat, final ? .05 : .015);
      ab.vig = Math.max(ab.vig, final ? .1 : .03); ab.light = Math.max(ab.light, final ? .45 : .3);
      if (final) { ab.freeze = .3; ab.fovT = 1; ab.fov = Math.max(ab.fov, .001); }
      ab.ringAge = 0; ab.ringLife = final ? .62 : .38; ab.ringR = abIn.radius * (final ? 1.55 : 1.15); ab.ringW = final ? 1 : .6; ab.rx = p.x; ab.rz = p.z;
      var an = abIn.tick * 2.4 + .6, m = final ? 3.4 : 1.5;
      ab.ix += Math.sin(an) * m; ab.iz += Math.cos(an) * m;
    }
    // Advances all envelopes once per frame (cameraFx runs it first when app.js asks, otherwise update() does).
    function abilityStep(dt, game, time) {
      var serial = game && game.resetSerial;
      if (Number.isFinite(serial) && serial !== abilitySerial) { abilitySerial = serial; clearAbility(); }
      ab.stepped = true; ab.clock += dt;
      var p = game && game.player; if (!p) return;
      abilityRead(p);
      var on = abIn.active, left = abIn.duration - abIn.t;
      var target = on ? Math.min(1, abIn.t / .1) * (left < .2 ? Math.max(0, left / .2) : 1) : 0;
      ab.spin += (target - ab.spin) * Math.min(1, dt * (target > ab.spin ? 18 : 9));
      if (on) {
        if (abIn.tick > ab.tick) abilityTick(p, abIn.tick >= abIn.ticks);
        ab.tick = abIn.tick;
        if (abIn.angle != null) ab.ang = abIn.angle; else ab.ang += dt * Math.PI * 2 * abIn.turns / abIn.duration;
        ab.lx = p.x; ab.lz = p.z; ab.wr = abIn.radius;
      } else ab.tick = 0;
      // war cry: the roar leaves the hero at rageFlash = 1 and fades over ~.7 s
      var rf = p.rageFlash > 0 ? p.rageFlash : 0;
      if (rf > 0) { ab.warm = rf; ab.lx = p.x; ab.lz = p.z; if (!on) ab.wr = 6.5; } else ab.warm = 0;
      var k = Math.min(1, dt * 60);
      ab.flash *= Math.exp(-dt * 9); ab.chroma *= Math.exp(-dt * 6.5); ab.sat *= Math.exp(-dt * 4.5); ab.vig *= Math.exp(-dt * 4); ab.light *= Math.exp(-dt * 8.5);
      ab.freeze = Math.max(0, ab.freeze - dt * 9);
      if (ab.ringAge < ab.ringLife) ab.ringAge += dt;
      if (ab.fovT > 0) { ab.fov = Math.min(1, ab.fov + dt * 30); if (ab.fov >= 1) ab.fovT = 0; } else ab.fov *= Math.exp(-dt * 5.5);
      if (ab.fov < .002 && !ab.fovT) ab.fov = 0;
      // feed the post chain (only while something is visible)
      var post = opts.post, warm = ab.warm, e2 = warm * warm;
      var spin = ab.spin * .25, chroma = ab.chroma + ab.spin * .05 + e2 * .1, flash = ab.flash, sat = ab.sat + ab.spin * .02 + warm * .05, vig = ab.vig + ab.spin * .04 + warm * .05;
      var ringOn = ab.ringAge < ab.ringLife;
      if (post && post.setAbilityFx && (spin > .004 || chroma > .004 || flash > .004 || sat > .004 || vig > .004 || ab.freeze > .004 || ringOn)) {
        abFx.spin = spin; abFx.spinAt.x = p.x; abFx.spinAt.z = p.z; abFx.chroma = chroma; abFx.flash = flash; abFx.sat = sat; abFx.vig = vig; abFx.freeze = ab.freeze;
        if (ringOn) { var rt = ab.ringAge / ab.ringLife; abRing.x = ab.rx; abRing.z = ab.rz; abRing.r = ab.ringR * (1 - Math.pow(1 - rt, 2.4)) + .3; abRing.w = ab.ringW * (.7 + .8 * rt); abRing.t = rt; abFx.ring = abRing; } else abFx.ring = null;
        post.setAbilityFx(abFx);
      }
      // borrowed light: an ember orbits the hero while he spins (throws moving light over floor and walls), bursts on every tick and on the war cry
      var lightK = ab.spin * .8 + ab.light + warm * 1.4;
      var world0 = L && L.setPlayerLightFx;
      if (world0) {
        if (lightK > .01) {
          var orb = ab.wr * .48 * ab.spin, ang = ab.ang, fl = reducedMotion ? 1 : 1 + .16 * Math.sin(ab.clock * 47) + .1 * Math.sin(ab.clock * 29 + 1);
          var hot = Math.min(1, ab.light * .6 + warm * .3), c0 = warm > .02 && !on ? [1, .22, .07] : EMBER;
          abLight.x = p.x + Math.sin(reducedMotion ? 0 : ang) * orb; abLight.y = 1.3 + ab.spin * .5 + ab.light * .5; abLight.z = p.z + Math.cos(reducedMotion ? 0 : ang) * orb;
          abLight.r = c0[0] + (HOTWHITE[0] - c0[0]) * hot; abLight.g = c0[1] + (HOTWHITE[1] - c0[1]) * hot; abLight.b = c0[2] + (HOTWHITE[2] - c0[2]) * hot;
          abLight.intensity = (5 + 12 * ab.spin + 40 * ab.light + 9 * warm) * fl; abLight.distance = 9 + ab.wr * 1.6 * Math.min(1, lightK);
          L.setPlayerLightFx(abLight); ab.lightOn = true;
        } else if (ab.lightOn) { L.setPlayerLightFx(null); ab.lightOn = false; }
      }
    }
    // Camera layers for app.js cameraStep (design amplitudes; app.js multiplies by the camera-shake setting). Sway is a slow orbit during the spin, ix/iz are
    // one-frame velocity impulses for the kick spring (ticks / final), the FOV punch (+2 deg on the last tick) is applied here.
    function cameraFx(dt, game, shake) {
      abilityStep(dt, game);
      camOut.x = camOut.y = camOut.z = camOut.ix = camOut.iz = 0;
      var sk = Number.isFinite(shake) ? shake : 1, punch = 0;
      if (!reducedMotion && sk > 0) {
        var c = ab.clock, s = ab.spin;
        camOut.x = (Math.sin(c * 5.7) * .1 + Math.sin(c * 11.3) * .035) * s; camOut.z = (Math.cos(c * 4.6) * .075 + Math.cos(c * 9.1) * .03) * s; camOut.y = Math.sin(c * 8.1) * .03 * s;
        camOut.ix = ab.ix; camOut.iz = ab.iz; punch = 2 * ab.fov * Math.min(1.6, sk / .55);
      }
      ab.ix = ab.iz = 0;
      var want = baseFov + punch;
      if (Math.abs(camera.fov - want) > .0005) { camera.fov = want; camera.updateProjectionMatrix(); }
      return camOut;
    }

    // ---- per-room atmosphere + scripted moments ----
    function envelope(t, a, b) { return smooth((t - a) / Math.max(.001, b - a)); }
    function directorStep(dt, time, game, atmo) {
      var d = director, boss = null, i, alive3 = 0, e;
      if (!game || !L) return;
      var enemies = game.enemies || [];
      for (i = 0; i < enemies.length; i++) {
        e = enemies[i];
        if (e.boss) boss = e;
        else if (!e.dead && e.z < -61 && e.z > -87) alive3++;
      }
      // Adak Ayini: the carved star breathes with a heartbeat while the rite is alive, then gutters out.
      var ritualTarget = alive3 > 0 ? 1 : .22;
      // While a cultist's rune tell is on the floor the star dims, so the only bright circle is the one to dodge.
      var runeUp = (game.hazards || []).some(function (h) { return h.owner && h.owner.type === 'cultist' && !h.harmless && h.age >= 0; });
      d.runeDim = (d.runeDim || 0) + ((runeUp ? 1 : 0) - (d.runeDim || 0)) * Math.min(1, dt * 6);
      ritualTarget *= 1 - .65 * d.runeDim;
      d.ritualLive += (ritualTarget - d.ritualLive) * Math.min(1, dt * (runeUp ? 6 : .9));
      var beat = reducedMotion ? .5 : Math.pow(Math.max(0, Math.sin(time * 2.6)), 12) + .6 * Math.pow(Math.max(0, Math.sin(time * 2.6 - .55)), 14);
      var ritual = d.ritualLive * (.55 + .45 * beat);
      L.setGroup('ritual', ritual * 1.2);
      if (L.setRitualGlow) L.setRitualGlow(ritual);
      // Sessiz Şapel: the oath stone calls softly; kindling it floods the chapel with gold.
      var cp = game.checkpointIndex || 0;
      if (d.lastCheckpoint === null) d.lastCheckpoint = cp;
      if (cp > d.lastCheckpoint) d.checkpointAt = time;
      d.lastCheckpoint = cp;
      // the base glow eases to its kindled level (it used to double in one frame when the stone was sworn)
      var oathTarget = cp > 0 ? 1.15 : .45 + .2 * Math.sin(time * 1.3);
      d.oathLive = d.oathLive == null ? oathTarget : d.oathLive + (oathTarget - d.oathLive) * Math.min(1, dt * 7);
      var oath = d.oathLive;
      if (d.checkpointAt >= 0) { var ct = time - d.checkpointAt; if (ct < 3) oath += 2.4 * Math.exp(-ct * 1.6) * envelope(ct, 0, .12); }
      L.setGroup('oath', oath);
      if (L.setOathGlow) L.setOathGlow(oath, cp > 0);
      // Zincir Mahkemesi: dim court, braziers ignite one by one when the executioner rises; phase two burns red.
      var arena = 0, phase2 = 0, bossDead = 0;
      if (boss) {
        if (boss.active && !boss.dead && d.bossActiveAt < 0) d.bossActiveAt = time;
        if (!boss.active && !boss.dead && game.state !== 'playing') { /* keep */ }
        if (boss.phase >= 2 && d.phase2At < 0) d.phase2At = time;
        if (boss.dead && d.bossDeadAt < 0) d.bossDeadAt = time;
        if (!boss.dead && !boss.active && d.bossActiveAt >= 0 && boss.hp >= boss.maxHp) { d.bossActiveAt = -1; d.phase2At = -1; }
        if (!boss.dead && boss.phase < 2 && d.phase2At >= 0) d.phase2At = -1;
        if (!boss.dead && d.bossDeadAt >= 0) d.bossDeadAt = -1;
      }
      var tA = d.bossActiveAt >= 0 ? time - d.bossActiveAt : -1;
      for (i = 0; i < 4; i++) {
        var g;
        if (tA < 0) g = .3 + .05 * Math.sin(time * 1.7 + i);
        else {
          var ti = tA - i * .38;
          // Ignition surge capped (it used to bloom the right wall white).
          g = ti < 0 ? .3 : .3 + .7 * envelope(ti, 0, .14) * Math.exp(-Math.max(0, ti - .14) * 1.5) + .85 * envelope(ti, 0, .5);
        }
        L.setGroup('brazier' + i, g);
      }
      if (tA >= 0) arena = envelope(tA, 0, 1.4);
      if (d.phase2At >= 0) phase2 = envelope(time - d.phase2At, 0, 1.8);
      if (d.bossDeadAt >= 0) { bossDead = envelope(time - d.bossDeadAt, 0, 3); phase2 *= 1 - bossDead; }
      L.setGroup('courtMoon', (1.3 + .2 * arena) * (1 - .45 * phase2) * (1 + .4 * bossDead));
      L.setGroupTint('court', phase2);
      state = { arena: arena, phase2: phase2, bossDead: bossDead };
      // Grade/fog overrides only apply inside the court.
      var inCourt = smooth((-(game.player.z) - 138) / 4);
      if (inCourt > 0 && atmo.court) {
        var o = atmo.court, w1 = inCourt * (1 - arena) * (1 - bossDead), w2 = inCourt * phase2 * .6;
        blendMood(atmo, o.dormant, w1); blendMood(atmo, o.rage, w2);
      }
    }
    function blendMood(a, o, w) {
      if (!o || w <= 0) return;
      Object.keys(o).forEach(function (k) {
        var v = o[k], cur = a[k];
        if (typeof v === 'number') a[k] = cur + (v - cur) * w;
        else if (cur && cur.isColor) cur.lerp(Array.isArray(v) ? tmpC.setRGB(v[0], v[1], v[2], T.LinearSRGBColorSpace) : tmpC.set(v), w);
        else if (cur && cur.isVector3) cur.lerp(tmpV.fromArray(v), w);
      });
    }

    var ready = false, corpseClock = 0, corpses = [];
    // Flies find the fresh dead after a few seconds.
    function flyCorpses(game) {
      corpses.length = 0;
      (game.enemies || []).forEach(function (e) { if (e.dead && !e.boss && (e.deadAge == null || e.deadAge > 3) && Math.abs(e.z - game.player.z) < 20) corpses.push(e); });
      corpses.sort(function (a, b) { return (a.deadAge || 0) - (b.deadAge || 0); });
      L.setCorpses(corpses.slice(0, 4));
    }
    // The number of visible punctual lights is part of every lit material's program key. A world that hides a light
    // (visible = false) when no source is near, then shows it again later, makes three.js compile a NEW program for every lit
    // material at the first frame of each new count - seconds of freeze in the middle of a fight (chapter 3/4 torches did this).
    // Lights that were ever seen on stay on (intensity 0 = no light, no BRDF work), so the count never changes after the warm-up.
    // Low keeps its hidden lights (that is a saving, and Low's count is constant anyway).
    var punctual = [], punctualAt = -1e9, keepLights = !/[?&]nokeeplights\b/.test(location.search);
    function holdLightCount(time) {
      if (!keepLights || preset === PRESET.low) return;
      if (time - punctualAt > 1 || time < punctualAt) {
        punctualAt = time; punctual.length = 0;
        var kids = scene.children, i, j, k, c, g;
        for (i = 0; i < kids.length; i++) {
          k = kids[i]; if ((k.isPointLight || k.isSpotLight)) punctual.push(k);
          c = k.children; if (c && k.isObject3D && !k.isMesh) for (j = 0; j < c.length; j++) { g = c[j]; if (g.isPointLight || g.isSpotLight) punctual.push(g); }
        }
      }
      for (var n = 0; n < punctual.length; n++) {
        var l = punctual[n];
        if (!l.visible) { l.visible = true; l.intensity = 0; }
      }
    }
    function update(dt, time, game, view) {
      if (!game || !game.player) return;
      syncShadowMap();
      holdLightCount(time);
      for (var ti = 0; ti < twins.length; ti++) twinSync(twins[ti], false);
      // Measure presented spacing, rather than the requested FPS or the monitor's callbacks. This also
      // handles the alternating short/long intervals of 120 rendered frames on a 144/180/200 Hz screen.
      if (shadowFrameAt !== null && time > shadowFrameAt) {
        var frameGap = time - shadowFrameAt;
        shadowFrameInterval = shadowFrameInterval > 0 ? shadowFrameInterval + (frameGap - shadowFrameInterval) * Math.min(1, frameGap * 10) : frameGap;
      } else if (shadowFrameAt !== null && time < shadowFrameAt) { shadowFrameInterval = 0; moonShadowSlot = moonPendingSlot = null; }
      shadowFrameAt = time;
      // Character poses still animate every presented frame. The depth map alone has a time budget,
      // independent of a 60/120/200 Hz monitor; a missing map after restoration is always filled at once.
      // Clock buckets offset ordinary key/spot deadlines; the pending requests below also separate
      // passes on nonuniform presented frames. Slower displays refresh both when necessary. Clock
      // jumps coalesce into one current update, with no delayed catch-up work.
      var keySlot = Math.floor(time * preset.shadowHz + 1e-5);
      var frequentFrames = shadowFrameInterval > 0 && shadowFrameInterval < 1 / (preset.shadowHz * 1.6);
      if (moonShadows && (!moon.shadow.map || moonPendingSlot !== null || keySlot !== moonShadowSlot)) {
        var nextKeySlot = moonPendingSlot !== null ? keySlot - moonPendingSlot > 2 ? keySlot : moonPendingSlot
          : moonShadowSlot !== null && keySlot > moonShadowSlot && keySlot - moonShadowSlot <= 2 ? moonShadowSlot + 1 : keySlot;
        if (frequentFrames && moon.shadow.map && !moon.shadow.needsUpdate && moonPendingSlot === null
          && L && L.shadowRefreshDeferred && L.shadowRefreshDeferred()) {
          // The world's regular request already waited one frame. It wins this frame; this new key
          // request waits exactly one frame instead. Fresh and previously pending key maps never yield.
          moonPendingSlot = nextKeySlot;
        } else {
          moon.shadow.needsUpdate = true; moonShadowSlot = nextKeySlot; moonPendingSlot = null;
        }
      }
      // World prepares spot requests first. Only a new regular request may yield to this key pass;
      // deferred requests and fresh/restored maps keep their immediate path. Below ~96 Hz on High
      // (~48 Hz on Medium), allow both maps together so the 60/30 Hz shadow budget does not starve.
      if (moonShadows && moon.shadow.needsUpdate && frequentFrames
        && L && L.deferShadowRefresh) L.deferShadowRefresh();
      var p = game.player, a = world.atmosphereAt(p.x, p.z);
      patchClock -= dt; if (patchClock <= 0) { patchClock = 1; patchCharacters(game); splitCharacters(game); }
      directorStep(dt, time, game, a);
      corpseClock -= dt; if (corpseClock <= 0 && L && L.setCorpses) { corpseClock = .5; flyCorpses(game); }
      var k = ready ? 1 - Math.exp(-dt * 2.2) : 1; ready = true;
      // Fog, ambient and key/rim.
      if (!scene.background || !scene.background.isColor) scene.background = new T.Color();
      scene.background.lerp(a.fog, k);
      if (scene.fog) { scene.fog.color.copy(scene.background); scene.fog.density += (a.fogDensity * (cfgRef.fog || .02) / .02 - scene.fog.density) * k; }
      hemi.color.lerp(a.sky, k); hemi.groundColor.lerp(a.ground, k); hemi.intensity += (a.hemi - hemi.intensity) * k;
      moon.color.lerp(a.key, k); moon.intensity += (a.keyI - moon.intensity) * k;
      rim.color.lerp(a.rim, k); rim.intensity += (a.rimI - rim.intensity) * k;
      keyDir.lerp(tmpV.fromArray(a.keyDir), k);
      scene.environmentIntensity += (a.env - scene.environmentIntensity) * k;
      // Mist.
      var M = FOG.karaMist.value;
      M[0].y += (a.mistA - M[0].y) * k; M[0].z += (a.mistH - M[0].z) * k; M[0].w = reducedMotion ? 0 : time;
      M[1].set(a.wind[0], a.wind[1], .34, .35); M[2].x += (a.scatter - M[2].x) * k; M[2].y += (a.mistGlow - M[2].y) * k;
      var mc = FOG.karaMistColor.value[0]; tmpC.copy(a.mist); mc.set(mc.x + (tmpC.r - mc.x) * k, mc.y + (tmpC.g - mc.y) * k, mc.z + (tmpC.b - mc.z) * k);
      // Character rim in view space.
      tmpV.set(a.rimDir[0], a.rimDir[1], a.rimDir[2]).normalize().transformDirection(camera.matrixWorldInverse);
      RIM.karaRimDir.value.copy(tmpV);
      tmpC.copy(a.charRim).multiplyScalar(a.charRimI);
      RIM.karaRimColor.value.lerp(tmpV.set(tmpC.r, tmpC.g, tmpC.b), k);
      RIM.karaRimParams.value.set(2.3, 1, a.rimWrap * preset.rimWrap, 0);
      var fl = a.charFill; RIM.karaFill.value.set(fl, fl * .95, fl * 1.05);
      // Grade.
      grade.lift.lerp(a.lift, k); grade.gain.lerp(a.gain, k); grade.saturation += (a.sat - grade.saturation) * k;
      grade.shadowTint.lerp(a.shadowTint, k); grade.highTint.lerp(a.highTint, k); grade.contrast += (a.contrast - grade.contrast) * k;
      grade.vignette += (a.vignette - grade.vignette) * k; grade.vignetteColor.lerp(a.vigColor, k);
      grade.bloom += (a.bloom - grade.bloom) * k; grade.bloomTint.lerp(a.bloomTint, k);
      grade.exposure = (cfgRef.exposure || 1.15) * a.exposure;
      var fx = p.x, fz = p.z - 2;
      updateScatter(fx, fz, dt);
      if (opts.post) { updateHeat(opts.post.heat(), fx, fz); if (opts.post.pulse) warCryPost(opts.post.heat(), opts.post.pulse(), p); opts.post.setGrade(grade); }
      if (!ab.stepped) abilityStep(dt, game, time);
      ab.stepped = false;
    }
    function dispose() {
      [hemi, moon, rim, moonTarget, rim.target].forEach(function (o) { scene.remove(o); });
      if (moon.shadow.map) moon.shadow.map.dispose();
      if (scene.environment) { scene.environment.dispose(); scene.environment = null; }
    }
    setQuality(opts.cfg || {});
    return { update: update, follow: follow, setQuality: setQuality, dispose: dispose, grade: grade, moon: moon, hemi: hemi, rim: rim, prepare: prepare, snap: function () { ready = false; },
      get state() { return state; }, fog: FOG, rimUniforms: RIM, patchModel: patchModel, attachPost: function (post) { opts.post = post; }, cameraFx: cameraFx };
  }

  B.Lighting = { create: create, fog: FOG, maxScatter: MAX_SCATTER, patchRim: patchRim, presets: PRESET, configureBackend,
    get shaderPreparation() { return shaderPreparation; } };
}());
