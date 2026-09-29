/* KARA GEÇİT — post-processing: HDR scene target, ambient occlusion, bloom, heat haze, filmic tone curve,
   per-room colour grade, vignette, MSAA, grain and dither. Classic script; publishes BABA.Post.
   Techniques follow the public descriptions of: scalable ambient obscurance (McGuire et al.), the 13-tap /
   tent-filter bloom chain (Jimenez, "Next Generation Post Processing in Call of Duty: AW"), the ACES fit used by
   three.js (MIT). All shader code here is written for this game. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var T = window.THREE;

  // Everything the quality preset controls in the post chain.
  var PRESETS = {
    // abTaps: radial spin-blur taps of the special ability (0 = none), abChroma: colour fringe (two extra taps)
    low:  { ao: 0,    samples: 0,  radius: 0,   bloomLevels: 3, bloomHalf: false, haze: false, grain: .014, abTaps: 0, abChroma: false },
    medium: { ao: .925, samples: 10, radius: .95, bloomLevels: 4, bloomHalf: true, haze: true, grain: .021, abTaps: 6, abChroma: true },
    high: { ao: 1, samples: 12, radius: 1, bloomLevels: 5, bloomHalf: true, haze: true, grain: .022, abTaps: 8, abChroma: true }
  };
  var MAX_HEAT = 6;

  var VS = 'varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }';
  var COMMON = [
    'float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }',
    'float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }'
  ].join('\n');

  // ---- ambient occlusion (half resolution): depth-reconstructed normals, spiral kernel, range fall-off ----
  var AO_FS = [
    'uniform sampler2D tDepth; uniform vec2 uTexel; uniform vec2 uInvP; uniform float uNear, uFar, uRadius, uIntensity, uProjScale;',
    'varying vec2 vUv;', COMMON,
    // explicit LOD: these fetches sit in loops, where implicit derivatives are undefined (D3D warns X3595)
    'float viewZ(vec2 uv){ float d = textureLod(tDepth, uv, 0.).r; return (uNear * uFar) / ((uFar - uNear) * d - uFar); }',
    'vec3 viewPos(vec2 uv){ float z = viewZ(uv); return vec3((uv * 2. - 1.) * uInvP * -z, z); }',
    'void main(){',
    '  float d0 = texture2D(tDepth, vUv).r;',
    '  if (d0 >= .99999) { gl_FragColor = vec4(1., 1e3, 0., 1.); return; }',
    '  float z0 = (uNear * uFar) / ((uFar - uNear) * d0 - uFar);',
    '  vec3 p = vec3((vUv * 2. - 1.) * uInvP * -z0, z0);',
    '  vec3 pr = viewPos(vUv + vec2(uTexel.x, 0.)), pl = viewPos(vUv - vec2(uTexel.x, 0.));',
    '  vec3 pu = viewPos(vUv + vec2(0., uTexel.y)), pd = viewPos(vUv - vec2(0., uTexel.y));',
    '  vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;',
    '  vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;',
    '  vec3 n = normalize(cross(dx, dy));',
    '  float rpx = min(uRadius * uProjScale / -p.z, 90.);',
    '  float a0 = ign(gl_FragCoord.xy) * 6.2831853, occ = 0.;',
    '  float r2 = uRadius * uRadius;',
    '  for (int i = 0; i < SAMPLES; i++) {',
    '    float f = (float(i) + .5) / float(SAMPLES), a = a0 + float(i) * 2.3999632;',
    '    vec2 o = vec2(cos(a), sin(a)) * sqrt(f) * rpx * uTexel;',
    '    vec3 v = viewPos(clamp(vUv + o, vec2(.001), vec2(.999))) - p;',
    '    float vv = dot(v, v);',
    '    occ += max(0., dot(n, v) * inversesqrt(vv + 1e-4) - .12) * max(0., 1. - vv / r2);',
    '  }',
    '  float ao = clamp(1. - uIntensity * occ * 2.2 / float(SAMPLES), 0., 1.);',
    '  gl_FragColor = vec4(ao, -p.z, 0., 1.);',
    '}'].join('\n');
  // Separable depth-aware blur; keeps AO from bleeding across silhouettes.
  var BLUR_FS = [
    'uniform sampler2D tAO; uniform vec2 uDir; varying vec2 vUv;',
    'void main(){',
    '  vec2 c = texture2D(tAO, vUv).rg; float s = c.r, w = 1.;',
    '  for (int i = 1; i <= 3; i++) {',
    '    vec2 ta = textureLod(tAO, vUv + uDir * float(i), 0.).rg, tb = textureLod(tAO, vUv - uDir * float(i), 0.).rg;',
    '    float k = exp(-float(i * i) * .18);',
    '    float ga = k * max(0., 1. - abs(ta.g - c.g) * 12. / max(c.g, .5)), gb = k * max(0., 1. - abs(tb.g - c.g) * 12. / max(c.g, .5));',
    '    s += ta.r * ga + tb.r * gb; w += ga + gb;',
    '  }',
    '  gl_FragColor = vec4(s / w, c.g, 0., 1.);',
    '}'].join('\n');

  // ---- bloom: soft-knee prefilter + 13-tap downsample chain, tent upsample accumulated back up ----
  var DOWN_FS = [
    'uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst, uThreshold, uKnee; varying vec2 vUv;', COMMON,
    'vec3 s(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }',
    'vec3 pre(vec3 c){ float br = max(c.r, max(c.g, c.b)); float k = clamp(br - uThreshold + uKnee, 0., 2. * uKnee); k = k * k / (4. * uKnee + 1e-4);',
    '  return c * max(k, br - uThreshold) / max(br, 1e-4); }',
    'vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d){ vec3 m = (a + b + c + d) * .25; return m / (1. + luma(m) * .5); }',
    'void main(){',
    '  vec3 a = s(-2., 2.), b = s(0., 2.), c = s(2., 2.), d = s(-2., 0.), e = s(0., 0.), f = s(2., 0.), g = s(-2., -2.), h = s(0., -2.), i = s(2., -2.);',
    '  vec3 j = s(-1., 1.), k = s(1., 1.), l = s(-1., -1.), m = s(1., -1.);',
    '  vec3 o;',
    '  if (uFirst > .5) {',
    '    o = karis(j, k, l, m) * .5 + (karis(a, b, d, e) + karis(b, c, e, f) + karis(d, e, g, h) + karis(e, f, h, i)) * .125;',
    '    o = pre(o);',
    '  } else {',
    '    o = e * .125 + (a + c + g + i) * .03125 + (b + d + f + h) * .0625 + (j + k + l + m) * .125;',
    '  }',
    '  gl_FragColor = vec4(o, 1.);',
    '}'].join('\n');
  var UP_FS = [
    'uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight; varying vec2 vUv;',
    'vec3 s(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }',
    'void main(){',
    '  vec3 o = (s(-1., 1.) + s(1., 1.) + s(-1., -1.) + s(1., -1.)) + 2. * (s(0., 1.) + s(0., -1.) + s(-1., 0.) + s(1., 0.)) + 4. * s(0., 0.);',
    '  gl_FragColor = vec4(o * (uWeight / 16.), 1.);',
    '}'].join('\n');

  // ---- composite: haze, AO, bloom, exposure, filmic curve, grade, vignette ----
  var COMPOSITE_FS = [
    'uniform sampler2D tScene, tBloom, tAO; uniform vec2 uTexel; uniform float uAspect, uTime;',
    'uniform float uExposure, uBloom, uAO, uSat, uContrast, uVignette, uGrain;',
    'uniform vec3 uLift, uGain, uShadowTint, uHighTint, uVigColor, uBloomTint;',
    'uniform vec4 uHeat[' + MAX_HEAT + '];',
    'uniform vec4 uPulse;',   // war cry shockwave: xy = centre (uv), z = ring radius (height units), w = strength (0 = off)
    // Special ability (only in the ABILITY variant, which is drawn while Post.setAbilityFx is being fed; otherwise this block does not exist):
    // A = spin (radial blur), chroma, flash (exposure + bloom), saturation punch; B = vignette pulse, hit-freeze desaturation, ring strength;
    // C = ring centre (uv), ring radius and width (height units of the ground ellipse); D = hero centre (uv), 1 / sin(camera pitch)
    '#if ABILITY',
    'uniform vec4 uAbA, uAbB, uAbC, uAbD;',
    '#endif',
    'varying vec2 vUv;', COMMON,
    // three.js ACESFilmicToneMapping fit (Stephen Hill), MIT.
    'vec3 rrtOdt(vec3 v){ vec3 a = v * (v + .0245786) - .000090537; vec3 b = v * (.983729 * v + .4329510) + .238081; return a / b; }',
    'vec3 aces(vec3 c){',
    '  const mat3 I = mat3(vec3(.59719, .07600, .02840), vec3(.35458, .90834, .13383), vec3(.04823, .01566, .83777));',
    '  const mat3 O = mat3(vec3(1.60475, -.10208, -.00327), vec3(-.53108, 1.10813, -.07276), vec3(-.07367, -.00605, 1.07602));',
    '  c *= 1. / .6; c = I * c; c = rrtOdt(c); c = O * c; return clamp(c, 0., 1.); }',
    'vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main(){',
    '  vec2 uv = vUv;',
    '  #if HAZE',
    '  vec2 off = vec2(0.);',
    '  for (int i = 0; i < ' + MAX_HEAT + '; i++) {',
    '    vec4 h = uHeat[i]; if (h.w <= 0.) continue;',
    '    vec2 d = (vUv - h.xy) * vec2(uAspect, 1.) / h.z;',
    // The vertical mask is exactly zero outside this interval. Skip its exponential and trigonometry there.
    '    if (d.y <= -.35 || d.y >= 2.1) continue;',
    '    float m = exp(-d.x * d.x * 2.6) * smoothstep(-.35, .25, d.y) * (1. - smoothstep(.7, 2.1, d.y)) * h.w;',
    '    if (m < .002) continue;',
    '    float ph = h.x * 91.7 + h.y * 37.3;',
    '    off += vec2(sin(vUv.y * 165. - uTime * 7.3 + ph) * .65 + sin(vUv.y * 71. + vUv.x * 43. - uTime * 4.1 + ph) * .35,',
    '                sin(vUv.x * 131. - uTime * 5.7 + ph) * .4) * m;',
    '  }',
    '  uv += off * vec2(.0019, .0013);',
    '  #endif',
    '  vec2 pca = vec2(0.); float pring = 0.;',
    '  if (uPulse.w > 0.) {',
    '    vec2 pd = (vUv - uPulse.xy) * vec2(uAspect, 1.); float pl = length(pd), pk = (pl - uPulse.z) / .1;',
    '    pring = exp(-pk * pk) * uPulse.w; vec2 pdir = pd / max(pl, 1e-4) / vec2(uAspect, 1.);',
    '    uv -= pdir * pring * .03; pca = pdir * pring * .010;',
    '  }',
    '  float abEx = 1., abBl = 1., sat = uSat, abFr = 0., abVg = 0.;',
    '  #if ABILITY',
    '  vec2 abCa = vec2(0.), abDir = vec2(0.); float abRim = 0.;',
    '  if (uAbB.z > 0.) {',
    // shock ring on the floor: a ground circle is an ellipse on screen (uAbD.z = 1 / sin(pitch)); refraction = derivative of a gaussian
    '    vec2 rd = (vUv - uAbC.xy) * vec2(uAspect, 1.); vec2 re = vec2(rd.x, rd.y * uAbD.z); float rl = length(re), rk = (rl - uAbC.z) / max(uAbC.w, 1e-3);',
    '    float rg = exp(-rk * rk); abDir = re / max(rl, 1e-4); abDir = vec2(abDir.x / uAspect, abDir.y * uAbD.z);',
    '    uv -= abDir * (rg * .35 - rk * rg * .9) * uAbB.z * .03; abCa = abDir * rg * uAbB.z * .008; abRim = rg * uAbB.z;',
    '  }',
    '  #endif',
    '  vec3 c;',
    '  #if ABILITY && ABTAPS > 0',
    '  vec2 abV = (uv - uAbD.xy) * vec2(uAspect, 1.); float abR = length(abV), abM = smoothstep(.30, .72, abR) * uAbA.x;',
    '  if (abM > .004) {',
    // radial blur toward the screen edges (with a little swirl); the hero keeps his sharp centre. Jittered taps hide the banding.
    '    vec2 ab1 = (uv - uAbD.xy), ab2 = vec2(-abV.y, abV.x) / vec2(uAspect, 1.);',
    '    float jit = ign(gl_FragCoord.xy + fract(uTime) * 57.) - .5; c = vec3(0.);',
    '    for (int i = 0; i < ABTAPS; i++) { float f = (float(i) + .5 + jit) / float(ABTAPS) - .5; c += texture2D(tScene, uv + (ab1 * .3 + ab2 * .06) * f * abM).rgb; }',
    '    c /= float(ABTAPS);',
    '  } else c = texture2D(tScene, uv).rgb;',
    '  #else',
    '  c = texture2D(tScene, uv).rgb;',
    '  #endif',
    '  if (pring > 0.) { c.r = texture2D(tScene, uv + pca).r; c.b = texture2D(tScene, uv - pca).b; }',
    '  #if ABILITY',
    '  abEx = 1. + uAbA.z * .55; abBl = 1. + uAbA.z * 1.6; sat = uSat * (1. + uAbA.w); abFr = uAbB.y; abVg = uAbB.x;',
    '  #if ABCHROMA',
    // colour fringe: grows toward the edges (blur pulse) and along the shock ring
    '  vec2 abCq = abCa + (uv - uAbD.xy) * uAbA.y * .022;',
    '  if (dot(abCq, abCq) > 1e-9) { c.r = mix(c.r, texture2D(tScene, uv + abCq).r, .75); c.b = mix(c.b, texture2D(tScene, uv - abCq).b, .75); }',
    '  #endif',
    '  #endif',
    '  #if AO',
    '  float ao = texture2D(tAO, vUv).r; float l0 = luma(c);',
    '  c *= mix(1., ao, uAO * (1. - .5 * smoothstep(.5, 3., l0)));',
    '  #endif',
    '  c += texture2D(tBloom, uv).rgb * uBloom * uBloomTint * abBl;',
    '  c = aces(c * uExposure * abEx);',
    '  float l = luma(c);',
    '  c *= mix(uShadowTint, uHighTint, smoothstep(.02, .42, l));',
    '  c = c * uGain + uLift * (1. - c);',
    '  c = max(mix(vec3(luma(c)), c, sat), 0.);',
    '  #if ABILITY',
    // hit-freeze on the last tick: colour drains and the picture snaps harder for a heartbeat
    '  if (abFr > 0.) { c = mix(c, vec3(luma(c)) * 1.12, abFr * .12); c = c * (1. + abFr * .08) + abFr * .01; }',
    '  c += vec3(1., .42, .16) * abRim * .16;',
    '  #endif',
    '  c = toSRGB(clamp(c, 0., 1.));',
    // gentle S-curve around mid-grey in display space
    '  c = mix(c, c * c * (3. - 2. * c), uContrast);',
    '  vec2 q = (vUv - .5) * vec2(uAspect * .78, 1.);',
    '  float v = smoothstep(.28, 1.02, length(q) * 1.18);',
    '  c = mix(c, uVigColor, v * v * uVignette);',
    '  #if ABILITY',
    '  c = mix(c, vec3(.34, .055, .02), v * (.35 + .65 * v) * abVg);',   // vignette pulse: darkening with an ember tint
    '  #endif',
    '  if (uPulse.w > 0.) { c = mix(c, vec3(.55, .04, .02), v * v * uPulse.w * .55); c += vec3(.5, .2, .12) * pring * .3; }',
    '  float g = hash(gl_FragCoord.xy * .731 + fract(uTime * 7.13) * 91.) - .5;',
    '  c += g * uGrain * (.35 + .65 * (1. - abs(luma(c) * 2. - 1.))) + (ign(gl_FragCoord.xy + fract(uTime) * 57.) - .5) / 255.;',
    '  gl_FragColor = vec4(c, 1.);',
    '}'].join('\n');

  function create(renderer, scene, camera, settings) {
    var gl = renderer.getContext();
    var quadScene = new T.Scene(), quadCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var tri = new T.BufferGeometry();
    tri.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    var quad = new T.Mesh(tri, null); quad.frustumCulled = false; quadScene.add(quad);
    var materials = [];
    function pass(fs, uniforms, defines, extra) {
      var m = new T.ShaderMaterial(Object.assign({ vertexShader: VS, fragmentShader: fs, uniforms: uniforms, defines: defines || {},
        depthTest: false, depthWrite: false, toneMapped: false }, extra || {}));
      materials.push(m); return m;
    }
    function target(w, h, type, depth, format, internalFormat) {
      var t = new T.WebGLRenderTarget(w, h, { type: type || T.HalfFloatType, depthBuffer: !!depth, stencilBuffer: false,
        format: format || T.RGBAFormat, internalFormat: internalFormat || null,
        minFilter: T.LinearFilter, magFilter: T.LinearFilter, generateMipmaps: false });
      t.texture.wrapS = t.texture.wrapT = T.ClampToEdgeWrapping; return t;
    }
    var sceneRT = target(1, 1, T.HalfFloatType, true);
    sceneRT.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
    // AO carries only occlusion and view depth. Two channels halve both attachments without changing precision.
    var aoA = target(1, 1, T.HalfFloatType, false, T.RGFormat), aoB = target(1, 1, T.HalfFloatType, false, T.RGFormat);
    // Bloom is positive HDR colour and never reads alpha. Packed HDR retains its range at half the bandwidth.
    // Check the format once; drivers that cannot render into it retain the existing RGBA16F path.
    var packedBloom = !!gl.getExtension('EXT_color_buffer_float');
    if (packedBloom) {
      var probe = target(1, 1, T.HalfFloatType, false, T.RGBFormat, 'R11F_G11F_B10F');
      var previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(probe);
      packedBloom = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      renderer.setRenderTarget(previousTarget); probe.dispose();
    }
    // The scene's alpha is never sampled or used as a blend factor. Packed positive HDR therefore also
    // halves its multisample colour storage/resolve bandwidth, while retaining the full HDR exponent range.
    // Keep RGBA16F as a fallback for devices without matching packed-colour/depth MSAA support.
    var floatColour = !!gl.getExtension('EXT_color_buffer_float');
    var depthSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) || []);
    function commonSamples(format) {
      var colour = floatColour ? Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, format, gl.SAMPLES) || []) : [];
      // Settings offer 2× and 4×; only expose counts both HDR colour and depth support.
      var common = colour.filter(function (n) { return (n === 2 || n === 4) && n <= renderer.capabilities.maxSamples && depthSamples.indexOf(n) !== -1; });
      return common.sort(function (a, b) { return a - b; });
    }
    var packedSamples = packedBloom ? commonSamples(gl.R11F_G11F_B10F) : [];
    var halfSamples = commonSamples(gl.RGBA16F);
    var packedScene = packedBloom && (packedSamples.length > 0 || halfSamples.length === 0);
    var supportedSamples = packedScene ? packedSamples : halfSamples, checkedSamples = {};
    function sceneFormat() {
      sceneRT.texture.format = packedScene ? T.RGBFormat : T.RGBAFormat;
      sceneRT.texture.internalFormat = packedScene ? 'R11F_G11F_B10F' : null;
    }
    sceneFormat();
    // Some drivers only expose 4x even when 2x is requested. Check the actual framebuffer once per choice;
    // the FPS counter reads that real sample count rather than assuming MAX_SAMPLES fits every format.
    function chooseSamples(requested) {
      if (!requested || !supportedSamples.length) return 0;
      var n = supportedSamples[0];
      for (var i = 0; i < supportedSamples.length; i++) if (supportedSamples[i] <= requested) n = supportedSamples[i];
      if (checkedSamples[n] != null) return checkedSamples[n];
      var probe = target(1, 1, T.HalfFloatType, true, packedScene ? T.RGBFormat : T.RGBAFormat, packedScene ? 'R11F_G11F_B10F' : null);
      probe.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
      probe.samples = n; probe.resolveDepthBuffer = true;
      var previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(probe);
      var actual = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? gl.getParameter(gl.SAMPLES) : 0;
      renderer.setRenderTarget(previousTarget); probe.dispose();
      if (!actual && packedScene) {
        sceneRT.dispose(); packedScene = false; sceneFormat();
        supportedSamples = halfSamples; checkedSamples = {};
        return chooseSamples(requested);
      }
      checkedSamples[n] = actual;
      return actual;
    }
    var mips = [];
    var white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
    var black = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;

    var aoMat = pass(AO_FS, { tDepth: { value: sceneRT.depthTexture }, uTexel: { value: new T.Vector2() }, uInvP: { value: new T.Vector2() },
      uNear: { value: .15 }, uFar: { value: 150 }, uRadius: { value: 1 }, uIntensity: { value: 1 }, uProjScale: { value: 500 } }, { SAMPLES: 12 });
    var blurMat = pass(BLUR_FS, { tAO: { value: null }, uDir: { value: new T.Vector2() } });
    var downMat = pass(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uFirst: { value: 0 }, uThreshold: { value: 1.05 }, uKnee: { value: .6 } });
    var upMat = pass(UP_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uWeight: { value: 1 } },
      {}, { blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, transparent: true });
    var heat = []; for (var hi = 0; hi < MAX_HEAT; hi++) heat.push(new T.Vector4(0, 0, 1, 0));
    var U = {
      tScene: { value: sceneRT.texture }, tBloom: { value: black }, tAO: { value: white }, uTexel: { value: new T.Vector2() },
      uAspect: { value: 1 }, uTime: { value: 0 }, uExposure: { value: 1.15 }, uBloom: { value: .55 }, uAO: { value: 1 },
      uSat: { value: 1 }, uContrast: { value: .12 }, uVignette: { value: .5 }, uGrain: { value: .02 },
      uLift: { value: new T.Vector3() }, uGain: { value: new T.Vector3(1, 1, 1) }, uShadowTint: { value: new T.Vector3(1, 1, 1) },
      uHighTint: { value: new T.Vector3(1, 1, 1) }, uVigColor: { value: new T.Vector3(0, 0, 0) }, uBloomTint: { value: new T.Vector3(1, 1, 1) },
      uHeat: { value: heat }, uPulse: { value: new T.Vector4(.5, .5, 0, 0) },
      uAbA: { value: new T.Vector4() }, uAbB: { value: new T.Vector4() }, uAbC: { value: new T.Vector4(.5, .5, 0, .1) }, uAbD: { value: new T.Vector4(.5, .5, 1, 0) }
    };
    var compositeMat = null, abilityMat = null;
    var settingsRef = settings || {}, preset = PRESETS.high, width = 1, height = 1, compositeKey = '', wantedSamples = 0;
    function buildComposite() {
      var key = [preset.ao > 0, preset.haze, preset.abTaps, preset.abChroma].join();
      if (key === compositeKey && compositeMat) return;
      compositeKey = key;
      [compositeMat, abilityMat].forEach(function (m) { if (m) { m.dispose(); materials.splice(materials.indexOf(m), 1); } });
      compositeMat = pass(COMPOSITE_FS, U, { AO: preset.ao > 0 ? 1 : 0, HAZE: preset.haze ? 1 : 0, ABILITY: 0, ABTAPS: 0, ABCHROMA: 0 });
      // The special-ability variant is a second program (compiled with the rest in compile(), so its first use never stalls); it is only
      // drawn while setAbilityFx is being fed, otherwise the frame is exactly the plain composite above.
      abilityMat = pass(COMPOSITE_FS, U, { AO: preset.ao > 0 ? 1 : 0, HAZE: preset.haze ? 1 : 0, ABILITY: 1, ABTAPS: preset.abTaps || 0, ABCHROMA: preset.abChroma ? 1 : 0 });
    }
    function rebuildMips() {
      mips.forEach(function (m) { m.dispose(); }); mips = [];
      var w = width, h = height, levels = preset.bloomLevels;
      for (var i = 0; i < levels; i++) {
        w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
        if (i === 0 && !preset.bloomHalf) { w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2)); }
        mips.push(target(w, h, T.HalfFloatType, false, packedBloom ? T.RGBFormat : T.RGBAFormat, packedBloom ? 'R11F_G11F_B10F' : null));
        if (w <= 8 || h <= 8) break;
      }
      U.tBloom.value = mips.length ? mips[0].texture : black;
    }
    function setSize(w, h) {
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      if (w === width && h === height) return;
      resetTiming(); // Old-resolution GPU samples must not describe the new buffers.
      width = w; height = h;
      sceneRT.setSize(w, h);
      var hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
      aoA.setSize(hw, hh); aoB.setSize(hw, hh);
      U.uTexel.value.set(1 / w, 1 / h); U.uAspect.value = w / h;
      aoMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
      rebuildMips();
    }
    function setQuality(cfg) {
      var p = PRESETS[cfg && (cfg.quality || cfg.preset)] || PRESETS.high, changed = p !== preset;
      if (cfg) settingsRef = cfg;
      preset = p;
      // Edge smoothing is independent of quality and stays off unless 2× or 4× is selected.
      var want = cfg && (cfg.msaa === 2 || cfg.msaa === 4) ? cfg.msaa : 0;
      var msaa = chooseSamples(want);
      if (changed || want !== wantedSamples || sceneRT.samples !== msaa) resetTiming();
      wantedSamples = want;
      if (sceneRT.samples !== msaa) { sceneRT.dispose(); sceneRT.samples = msaa; }
      // AO samples the resolved depth texture after Three finishes the HDR scene render.
      sceneRT.resolveDepthBuffer = true;
      if (aoMat.defines.SAMPLES !== Math.max(1, p.samples)) { aoMat.defines.SAMPLES = Math.max(1, p.samples); aoMat.needsUpdate = true; }
      U.uAO.value = p.ao; U.uGrain.value = p.grain;
      U.tAO.value = p.ao > 0 ? aoA.texture : white;
      if (cfg && Number.isFinite(cfg.exposure)) U.uExposure.value = cfg.exposure;
      buildComposite();
      if (changed || !mips.length) rebuildMips();
    }
    // Colour grade from the lighting rig (already blended between rooms and special moments).
    function setGrade(g) {
      if (!g) return;
      U.uLift.value.copy(g.lift); U.uGain.value.copy(g.gain); U.uSat.value = g.saturation;
      if (g.shadowTint) U.uShadowTint.value.copy(g.shadowTint);
      if (g.highTint) U.uHighTint.value.copy(g.highTint);
      if (g.vignetteColor) U.uVigColor.value.copy(g.vignetteColor);
      if (g.bloomTint) U.uBloomTint.value.copy(g.bloomTint);
      if (Number.isFinite(g.contrast)) U.uContrast.value = g.contrast;
      if (Number.isFinite(g.vignette)) U.uVignette.value = g.vignette;
      if (Number.isFinite(g.bloom)) U.uBloom.value = g.bloom;
      if (Number.isFinite(g.exposure)) U.uExposure.value = g.exposure;
    }
    function draw(mat, rt) { quad.material = mat; renderer.setRenderTarget(rt); renderer.render(quadScene, quadCamera); }

    // Opt-in asynchronous GPU timings. No extension lookup, queries or polling when disabled.
    // Pair scene + post from the same frame so their sum and percentile describe real whole frames.
    var timerExt = null, timingEnabled = false, timingRequested = false, timingAvailable = null, timingError = null;
    var pending = [], samples = { scene: [], post: [], total: [] }, api = null, openQuery = null, timingFrame = null;
    var nextTimingAt = 0;
    var timingCanvas = renderer.domElement;
    // CPU sections and resource deltas identify a late upload/compile or a slow
    // shadow pass without polling GL. They are collected only with the meter on.
    var cpuSections = { gpuProbe: 0, shadows: 0, sceneDraw: 0, postDraw: 0 };
    var frameResources = { newPrograms: 0, newGeometries: 0, newTextures: 0, shadowCalls: 0, sceneCalls: 0, postCalls: 0 };
    var originalShadowRender = null;
    function traceShadows() {
      if (!renderer.shadowMap || originalShadowRender) return;
      originalShadowRender = renderer.shadowMap.render;
      renderer.shadowMap.render = shadowRender;
    }
    function untraceShadows() {
      if (originalShadowRender) {
        if (renderer.shadowMap.render === shadowRender) renderer.shadowMap.render = originalShadowRender;
        originalShadowRender = null;
      }
    }
    function shadowRender() {
      if (arguments[1] !== scene) return originalShadowRender.apply(this, arguments);
      var start = performance.now(), calls = renderer.info.render.calls;
      try { return originalShadowRender.apply(this, arguments); }
      finally { cpuSections.shadows += performance.now() - start; frameResources.shadowCalls += renderer.info.render.calls - calls; }
    }
    function deleteTimingFrame(f) {
      if (!f) return;
      ['scene', 'post'].forEach(function (name) { if (f[name]) { try { gl.deleteQuery(f[name]); } catch (_) {} } });
    }
    function resetTiming() {
      if (openQuery) { try { gl.endQuery(timerExt.TIME_ELAPSED_EXT); } catch (_) {} openQuery = null; }
      deleteTimingFrame(timingFrame); timingFrame = null;
      pending.forEach(deleteTimingFrame); pending.length = 0;
      samples.scene.length = samples.post.length = samples.total.length = 0;
      nextTimingAt = 0;
    }
    function failTiming(message) {
      resetTiming(); timingEnabled = false; timingAvailable = false; timingError = message;
    }
    function timingContextLost() {
      // The browser invalidates query objects on loss. Drop references without
      // asking the lost context to end/delete them, and preserve the user's opt-in.
      openQuery = timingFrame = null; pending.length = 0;
      samples.scene.length = samples.post.length = samples.total.length = 0;
      timerExt = null; timingEnabled = false; timingAvailable = null; timingError = 'WebGL context lost';
      untraceShadows();
    }
    function timingContextRestored() {
      timingContextLost(); // Also invalidate old data if a consumer missed the loss event.
      gl = renderer.getContext();
      timerExt = null; timingEnabled = false; timingAvailable = null; timingError = null;
      // Three registers its restore handler first and has rebuilt its GL state.
      // A restored context needs a fresh extension and fresh query objects.
      if (timingRequested) setTiming(true);
    }
    function setTiming(enabled) {
      timingRequested = !!enabled;
      if (!enabled) { untraceShadows(); timingEnabled = false; resetTiming(); return timingAvailable; }
      traceShadows();
      if (timingEnabled) return timingAvailable;
      resetTiming(); timingError = null;
      try {
        if (gl.isContextLost()) { timingContextLost(); return timingAvailable; }
        timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        timingAvailable = !!timerExt;
        if (timerExt && gl.getQuery(timerExt.TIME_ELAPSED_EXT, timerExt.QUERY_COUNTER_BITS_EXT) <= 0) timingAvailable = false;
        timingEnabled = timingAvailable;
        if (timingEnabled) gl.getParameter(timerExt.GPU_DISJOINT_EXT); // discard earlier clock discontinuities
      } catch (_) { failTiming('GPU timing unavailable'); }
      return timingAvailable;
    }
    function pushTime(name, value) {
      samples[name].push(value);
      if (samples[name].length > 120) samples[name].shift();
    }
    function timingStart(time) {
      // GPU diagnostics need a few representative pairs, not two fresh query
      // objects and driver-status reads for every displayed frame at 200 Hz.
      // CPU/frame-interval measurements still cover every presented frame.
      if (time < nextTimingAt) return false;
      nextTimingAt = time + .1;
      try {
        if (gl.isContextLost()) { timingContextLost(); return false; }
        if (gl.getParameter(timerExt.GPU_DISJOINT_EXT)) { resetTiming(); return false; }
        while (pending.length) {
          var f = pending[0];
          // Never request QUERY_RESULT until both queries are ready; do not wait or flush the GPU.
          if (!gl.getQueryParameter(f.scene, gl.QUERY_RESULT_AVAILABLE) || !gl.getQueryParameter(f.post, gl.QUERY_RESULT_AVAILABLE)) break;
          if (gl.getParameter(timerExt.GPU_DISJOINT_EXT)) { resetTiming(); return false; }
          var sceneMs = gl.getQueryParameter(f.scene, gl.QUERY_RESULT) / 1e6;
          var postMs = gl.getQueryParameter(f.post, gl.QUERY_RESULT) / 1e6;
          if (Number.isFinite(sceneMs) && sceneMs >= 0 && Number.isFinite(postMs) && postMs >= 0) {
            pushTime('scene', sceneMs); pushTime('post', postMs); pushTime('total', sceneMs + postMs);
          }
          deleteTimingFrame(pending.shift());
        }
        // Bound query storage when the GPU is late, and leave another profiler's active query alone.
        if (pending.length >= 8 || gl.getQuery(timerExt.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return false;
        timingFrame = { scene: null, post: null };
        timingFrame.scene = gl.createQuery(); timingFrame.post = gl.createQuery();
        if (!timingFrame.scene || !timingFrame.post) { failTiming('GPU timing query allocation failed'); return false; }
        return true;
      } catch (_) { failTiming('GPU timing query failed'); return false; }
    }
    function tBegin(name) {
      if (!timingFrame) return;
      try { gl.beginQuery(timerExt.TIME_ELAPSED_EXT, timingFrame[name]); openQuery = timingFrame[name]; }
      catch (_) { failTiming('GPU timing query failed'); }
    }
    function tEnd() {
      if (!openQuery) return;
      try { gl.endQuery(timerExt.TIME_ELAPSED_EXT); openQuery = null; }
      catch (_) { failTiming('GPU timing query failed'); }
    }
    function timingFinish(complete) {
      tEnd();
      if (timingFrame) {
        if (complete) pending.push(timingFrame); else deleteTimingFrame(timingFrame);
        timingFrame = null;
      }
    }
    function avg(a) { if (!a.length) return null; var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t / a.length; }
    function p95(a) { if (!a.length) return null; return a.slice().sort(function (x, y) { return x - y; })[Math.ceil(a.length * .95) - 1]; }
    function render(time) {
      var trace = timingRequested, start = trace ? performance.now() : 0;
      var measured = timingEnabled && timingStart(time || 0), complete = false;
      var sceneStart = trace ? performance.now() : 0, postStart = 0, info = renderer.info;
      var calls = trace && info ? info.render.calls : 0;
      var programs = trace && info ? info.programs.length : 0;
      var geometries = trace && info ? info.memory.geometries : 0, textures = trace && info ? info.memory.textures : 0;
      if (trace) { cpuSections.gpuProbe = sceneStart - start; cpuSections.shadows = 0; frameResources.shadowCalls = 0; }
      var autoClear = renderer.autoClear;
      try {
      if (measured) tBegin('scene');
      U.uTime.value = time || 0;
      renderer.setRenderTarget(sceneRT);
      // render() already clears when autoClear is enabled. Preserve the explicit clear only for external users that disable it.
      if (!autoClear) renderer.clear();
      renderer.render(scene, camera);
      // Vendored Three finishes shadow rendering and sceneRT's MSAA resolve
      // before render returns. Both belong to scene; the post query starts next.
      if (measured) { tEnd(); tBegin('post'); }
      if (trace) {
        postStart = performance.now(); cpuSections.sceneDraw = postStart - sceneStart - cpuSections.shadows;
        frameResources.sceneCalls = info ? info.render.calls - calls - frameResources.shadowCalls : 0;
        calls = info ? info.render.calls : 0;
      }
      renderer.autoClear = false;
      if (preset.ao > 0) {
        var P = camera.projectionMatrix.elements;
        aoMat.uniforms.uInvP.value.set(1 / P[0], 1 / P[5]);
        aoMat.uniforms.uNear.value = camera.near; aoMat.uniforms.uFar.value = camera.far;
        aoMat.uniforms.uProjScale.value = P[5] * .5 * aoA.height;
        aoMat.uniforms.uRadius.value = preset.radius; aoMat.uniforms.uIntensity.value = 1;
        draw(aoMat, aoA);
        blurMat.uniforms.tAO.value = aoA.texture; blurMat.uniforms.uDir.value.set(1.4 / aoA.width, 0); draw(blurMat, aoB);
        blurMat.uniforms.tAO.value = aoB.texture; blurMat.uniforms.uDir.value.set(0, 1.4 / aoA.height); draw(blurMat, aoA);
      }
      if (mips.length) {
        downMat.uniforms.tSrc.value = sceneRT.texture; downMat.uniforms.uTexel.value.set(1 / width, 1 / height); downMat.uniforms.uFirst.value = 1;
        draw(downMat, mips[0]);
        downMat.uniforms.uFirst.value = 0;
        for (var i = 1; i < mips.length; i++) {
          downMat.uniforms.tSrc.value = mips[i - 1].texture; downMat.uniforms.uTexel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height);
          draw(downMat, mips[i]);
        }
        for (var j = mips.length - 1; j > 0; j--) {
          upMat.uniforms.tSrc.value = mips[j].texture; upMat.uniforms.uTexel.value.set(1 / mips[j].width, 1 / mips[j].height);
          upMat.uniforms.uWeight.value = .9;
          draw(upMat, mips[j - 1]);
        }
      }
      draw(abilityUniforms() ? abilityMat : compositeMat, null);
      complete = true;
      } finally {
        renderer.autoClear = autoClear;
        if (measured) timingFinish(complete);
        if (trace) {
          cpuSections.postDraw = postStart ? performance.now() - postStart : 0;
          frameResources.postCalls = postStart && info ? info.render.calls - calls : 0;
          frameResources.newPrograms = info ? info.programs.length - programs : 0;
          frameResources.newGeometries = info ? info.memory.geometries - geometries : 0;
          frameResources.newTextures = info ? info.memory.textures - textures : 0;
        }
      }
    }
    // ---- special ability screen effects ----
    // Post.setAbilityFx(o) is called every frame while something is going on (lighting.js does it from player.special; effects code may add to it).
    // Fields (all optional, 0..1 unless noted; values from several calls in one frame merge by max):
    //   spin    radial motion blur toward the edges + gentle swirl (Low: none)          spinAt {x,z}  world point the blur radiates from (the hero)
    //   chroma  colour fringe pulse (Low: none)     flash  exposure + bloom flash     sat  saturation punch     vig  ember vignette pulse
    //   freeze  hit-freeze desaturation (last tick)     ring {x, z, r, w, t}  shock ring on the floor: world centre, radius and width in metres, age 0..1 (fades out)
    // Nothing is stored between frames: the values are used by the next render() and then cleared, so an idle game pays nothing and draws the plain composite.
    // Reduced motion drops blur, ring, fringe and caps the flash. Costs: ring/flash/sat/vig/freeze are a few ALU ops, blur is abTaps texture taps, fringe two taps.
    var ab = { spin: 0, chroma: 0, flash: 0, sat: 0, vig: 0, freeze: 0, ringA: 0, rx: 0, rz: 0, rr: 0, rw: 1, sx: 0, sz: 0, hasSpin: false, live: false };
    var reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }, abPoint = new T.Vector3();
    function setAbilityFx(o) {
      if (!o) return;
      var v;
      if (Number.isFinite(v = o.spin)) ab.spin = Math.max(ab.spin, v);
      if (Number.isFinite(v = o.chroma)) ab.chroma = Math.max(ab.chroma, v);
      if (Number.isFinite(v = o.flash)) ab.flash = Math.max(ab.flash, v);
      if (Number.isFinite(v = o.sat)) ab.sat = Math.max(ab.sat, v);
      if (Number.isFinite(v = o.vig)) ab.vig = Math.max(ab.vig, v);
      if (Number.isFinite(v = o.freeze)) ab.freeze = Math.max(ab.freeze, v);
      if (o.spinAt && Number.isFinite(o.spinAt.x)) { ab.sx = o.spinAt.x; ab.sz = o.spinAt.z; ab.hasSpin = true; }
      var r = o.ring;
      if (r && Number.isFinite(r.x) && Number.isFinite(r.z) && r.r > 0) {
        var t = Math.min(1, Math.max(0, Number.isFinite(r.t) ? r.t : 0)), a = Math.sin(Math.min(1, t / .08) * Math.PI / 2) * Math.pow(1 - t, 1.6);
        if (a > ab.ringA) { ab.ringA = a; ab.rx = r.x; ab.rz = r.z; ab.rr = r.r; ab.rw = Math.max(.05, r.w || .6); }
      }
      ab.live = true;
    }
    // Copies the merged values into the uniforms and clears them. Returns false when nothing (visible) is going on.
    function abilityUniforms() {
      if (!ab.live) return false;
      var calm = reduced.matches || settingsRef.reducedMotion === true;
      var spin = calm || !preset.abTaps ? 0 : ab.spin, chroma = calm ? 0 : ab.chroma, flash = Math.min(calm ? .25 : 1.5, ab.flash), ringA = calm ? 0 : ab.ringA * .3;
      var freeze = ab.freeze * (calm ? .35 : 1), sat = ab.sat * (calm ? .5 : 1), vig = ab.vig;
      var any = spin > .004 || chroma > .004 || flash > .004 || ringA > .004 || freeze > .004 || sat > .004 || vig > .004;
      if (any) {
        camera.updateMatrixWorld();
        // hero centre (blur origin) and ring centre in screen space; sizes in height units at the depth of the floor point
        abPoint.set(ab.hasSpin ? ab.sx : ab.rx, .9, ab.hasSpin ? ab.sz : ab.rz).project(camera);
        U.uAbD.value.set(abPoint.x * .5 + .5, abPoint.y * .5 + .5, 1, 0);
        var dir = camera.getWorldDirection(abPoint), pitch = Math.max(.35, Math.abs(dir.y)); U.uAbD.value.z = 1 / pitch;
        if (ringA > .004) {
          abPoint.set(ab.rx, 0, ab.rz); var depth = -abPoint.applyMatrix4(camera.matrixWorldInverse).z, unit = 1 / (2 * Math.max(.5, depth) * Math.tan(camera.fov * Math.PI / 360));
          abPoint.set(ab.rx, 0, ab.rz).project(camera);
          U.uAbC.value.set(abPoint.x * .5 + .5, abPoint.y * .5 + .5, ab.rr * unit, ab.rw * unit);
        }
        U.uAbA.value.set(spin, chroma, flash, sat); U.uAbB.value.set(vig, freeze, ringA, 0);
      }
      ab.spin = ab.chroma = ab.flash = ab.sat = ab.vig = ab.freeze = ab.ringA = 0; ab.hasSpin = ab.live = false;
      return any;
    }
    function heatSources() { return heat; }
    function pulse() { return U.uPulse.value; }
    function dispose() {
      setTiming(false);
      if (timingCanvas && timingCanvas.removeEventListener) {
        timingCanvas.removeEventListener('webglcontextlost', timingContextLost);
        timingCanvas.removeEventListener('webglcontextrestored', timingContextRestored);
      }
      [sceneRT, aoA, aoB].concat(mips).forEach(function (t) { t.dispose(); });
      if (sceneRT.depthTexture) sceneRT.depthTexture.dispose();
      materials.forEach(function (m) { m.dispose(); }); tri.dispose(); white.dispose(); black.dispose();
    }
    // Starts compiling every pass (app.js waits for the programs before the first frame).
    function compile() {
      var keep = quad.material;
      for (var i = 0; i < materials.length; i++) { quad.material = materials[i]; renderer.compile(quadScene, quadCamera); }
      quad.material = keep;
    }
    if (timingCanvas && timingCanvas.addEventListener) {
      timingCanvas.addEventListener('webglcontextlost', timingContextLost);
      timingCanvas.addEventListener('webglcontextrestored', timingContextRestored);
    }
    setQuality(settings || {});
    api = {
      render: render, setSize: setSize, setQuality: setQuality, setGrade: setGrade, heat: heatSources, pulse: pulse, setAbilityFx: setAbilityFx, dispose: dispose, compile: compile,
      setTiming: setTiming, resetTiming: resetTiming,
      uniforms: U, target: sceneRT,
      get supportedSamples() { return supportedSamples.slice(); },
      get requestedSamples() { return wantedSamples; },
      get samples() { return sceneRT.samples || 0; },
      get bufferFormats() { return { scene: packedScene ? 'R11F_G11F_B10F' : 'RGBA16F', ao: 'RG16F', bloom: packedBloom ? 'R11F_G11F_B10F' : 'RGBA16F' }; },
      get width() { return width; }, get height() { return height; },
      get timingEnabled() { return timingEnabled; }, get timingAvailable() { return timingAvailable; },
      get timingReady() { return samples.total.length > 0; }, get timingError() { return timingError; },
      get cpuSections() { return cpuSections; }, get frameResources() { return frameResources; },
      get timingSampleIntervalMs() { return 100; },
      get gpuMs() { return avg(samples.total); },
      get gpuSections() { return { scene: avg(samples.scene), post: avg(samples.post), total: avg(samples.total),
        sceneP95: p95(samples.scene), postP95: p95(samples.post), totalP95: p95(samples.total), samples: samples.total.length }; },
      get preset() { return preset; }
    };
    if (/[?&]gpums(&|$)/.test(location.search)) setTiming(true);
    return api;
  }

  B.Post = { create: create, presets: PRESETS, maxHeat: MAX_HEAT };
}());
