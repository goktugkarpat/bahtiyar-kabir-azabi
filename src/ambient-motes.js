/* KARA GEÇİT — ambient motes (ajan:visual-dark). A field of drifting particles that travels with the hero, fully animated in the
   vertex shader (one draw call, no per-frame CPU work besides a few uniforms). Each chapter has its own air:
   Temple dust catching the torchlight, Coast salt-ash on the sea wind, Throne silver dust with gold glints, Forge rising embers,
   Finale slow blood motes. Additive and soft, it adds depth without hiding anything. Classic script; publishes BABA.AmbientMotes.
   lighting.js calls update() every frame. ?nomotes turns it off. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var T = window.THREE;
  // count, size (m), box half-size [x, height, z], drift m/s [x, y, z], swirl, colour, intensity, twinkle
  var LOOKS = {
    1: { n: 170, size: .065, box: [9, 4.2, 7], vel: [.05, .03, -.02], swirl: .35, color: [1, .72, .42], k: .55, tw: .6 },
    2: { n: 220, size: .07, box: [10, 4, 8], vel: [.55, -.06, -.25], swirl: .5, color: [.62, .74, .7], k: .38, tw: .3 },
    3: { n: 190, size: .06, box: [9, 4.5, 7], vel: [-.04, .05, .03], swirl: .3, color: [.85, .88, 1], k: .7, tw: .9 },
    4: { n: 140, size: .075, box: [9, 5, 7], vel: [.06, .55, .02], swirl: .7, color: [1, .45, .14], k: 1.3, tw: .8 },
    5: { n: 180, size: .07, box: [9, 4.5, 7], vel: [0, .08, 0], swirl: .45, color: [.85, .12, .14], k: .7, tw: .6 }
  };
  var MAXN = 240;
  var VS = [
    'attribute vec4 aSeed;',
    'uniform vec3 uCenter, uBox, uVel; uniform float uTime, uSwirl, uSize, uScale, uTw, uCount;',
    'varying float vA;',
    'void main(){',
    '  if (aSeed.w * 240. > uCount) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; vA = 0.; return; }',
    '  float t = uTime + aSeed.w * 97.;',
    '  vec3 p = (aSeed.xyz * 2. - 1.) * uBox + uVel * uTime;',
    '  p += vec3(sin(t * .37 + aSeed.x * 21.), sin(t * .29 + aSeed.y * 17.) * .5, cos(t * .31 + aSeed.z * 13.)) * uSwirl;',
    // wrap into the box that follows the hero (relative to the centre, so it never drifts away)
    '  vec3 rel = p - vec3(uCenter.x, 0., uCenter.z); rel.xz = mod(rel.xz + uBox.xz, uBox.xz * 2.) - uBox.xz; rel.y = mod(rel.y, uBox.y);',
    '  vec3 w = vec3(uCenter.x, 0., uCenter.z) + rel + vec3(0., .15, 0.);',
    '  vec3 e = abs(rel) / vec3(uBox.x, 1., uBox.z); float edge = (1. - smoothstep(.7, 1., e.x)) * (1. - smoothstep(.7, 1., e.z)) * smoothstep(0., .4, rel.y) * (1. - smoothstep(uBox.y * .75, uBox.y, rel.y));',
    '  vA = edge * mix(1., .35 + .65 * sin(t * (2. + aSeed.y * 3.)) * .5 + .325, uTw);',
    '  vec4 mv = viewMatrix * vec4(w, 1.); gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uSize * (.6 + aSeed.z * .8) * uScale / max(.5, -mv.z), 1., 24.);',
    '}'].join('\n');
  var FS = [
    'uniform vec3 uColor; varying float vA;',
    'void main(){ vec2 q = gl_PointCoord * 2. - 1.; float r = dot(q, q); if (r > 1. || vA < .01) discard;',
    '  float a = exp(-r * 3.2) * vA; gl_FragColor = vec4(uColor * a, a); }'].join('\n');

  function create(scene) {
    var off = /[?&]nomotes/.test(location.search);
    var geo = new T.BufferGeometry(), seeds = new Float32Array(MAXN * 4), pos = new Float32Array(MAXN * 3), s = 9173;
    function rnd() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }
    for (var i = 0; i < MAXN; i++) { seeds[i * 4] = rnd(); seeds[i * 4 + 1] = rnd(); seeds[i * 4 + 2] = rnd(); seeds[i * 4 + 3] = (i + .5) / MAXN; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));
    var U = { uCenter: { value: new T.Vector3() }, uBox: { value: new T.Vector3(9, 4, 7) }, uVel: { value: new T.Vector3() }, uTime: { value: 0 },
      uSwirl: { value: .4 }, uSize: { value: .05 }, uScale: { value: 500 }, uTw: { value: .5 }, uCount: { value: 0 }, uColor: { value: new T.Vector3(1, 1, 1) } };
    var mat = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    mat.name = 'kara-ambient-motes';
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 6; pts.name = 'ambient-motes'; scene.add(pts);
    var chapter = -1, clock = 0;
    function update(dt, p, camera, height, reduced) {
      if (off || !p || !Number.isFinite(p.x)) { pts.visible = false; return; }
      var ch = B.ActiveChapter || 1, L = LOOKS[ch] || LOOKS[1];
      if (ch !== chapter) {
        chapter = ch; U.uBox.value.fromArray(L.box); U.uVel.value.fromArray(L.vel); U.uSwirl.value = L.swirl; U.uSize.value = L.size; U.uTw.value = L.tw;
        U.uColor.value.set(L.color[0] * L.k, L.color[1] * L.k, L.color[2] * L.k); U.uCount.value = Math.min(MAXN, L.n);
      }
      clock += reduced ? dt * .25 : dt; U.uTime.value = clock % 10000;
      U.uCenter.value.set(p.x, 0, p.z);
      if (camera && camera.isPerspectiveCamera) U.uScale.value = (height || 720) * .5 / Math.tan(camera.fov * Math.PI / 360);
      pts.visible = true;
    }
    function dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); }
    return { points: pts, update: update, dispose: dispose };
  }
  B.AmbientMotes = { create: create, looks: LOOKS };
}());
