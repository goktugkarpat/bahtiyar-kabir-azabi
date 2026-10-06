/* KARA GEÇİT — contact shadows (ajan:visual-dark). A soft, dark ambient-occlusion pool under every living character
   (hero and foes) that grounds the bodies on the floor even where no shadow-casting light reaches. One instanced quad,
   one draw call, a few ALU per pixel; it fades while a body is airborne and as a corpse settles.
   Classic script; publishes BABA.ContactShadows. lighting.js calls update() every frame. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var T = window.THREE;
  var MAX = 64;
  var VS = [
    'attribute vec4 aShadow;',   // xz centre, radius, strength
    'varying vec2 vQ; varying float vA;',
    'void main(){ vQ = position.xz * 2.; vA = aShadow.w;',
    '  vec3 p = vec3(aShadow.x + position.x * aShadow.z * 2., position.y, aShadow.y + position.z * aShadow.z * 2.);',
    '  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.); }'].join('\n');
  var FS = [
    'varying vec2 vQ; varying float vA;',
    'void main(){ float r2 = dot(vQ, vQ); if (r2 > 1. || vA < .003) discard;',
    // tight core under the feet, long soft skirt: reads as occlusion, not as a painted disc
    '  float a = (exp(-r2 * 7.) * .55 + exp(-r2 * 2.6) * .45) * (1. - smoothstep(.7, 1., r2)) * vA;',
    '  gl_FragColor = vec4(0., 0., 0., a); }'].join('\n');

  function create(scene) {
    var geo = new T.InstancedBufferGeometry();
    var base = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    geo.index = base.index; geo.setAttribute('position', base.attributes.position);
    var data = new Float32Array(MAX * 4), attr = new T.InstancedBufferAttribute(data, 4);
    attr.setUsage(T.DynamicDrawUsage); geo.setAttribute('aShadow', attr); geo.instanceCount = 0;
    var mat = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mat.name = 'kara-contact-shadow';
    var mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'contact-shadows';
    mesh.position.y = .035; scene.add(mesh);
    function put(n, x, z, r, s) { var o = n * 4; data[o] = x; data[o + 1] = z; data[o + 2] = r; data[o + 3] = s; }
    function update(game) {
      if (!game || !game.player) { geo.instanceCount = 0; return; }
      var n = 0, list = game.enemies || [], p = game.player;
      for (var i = -1; i < list.length && n < MAX; i++) {
        var a = i < 0 ? p : list[i]; if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.z)) continue;
        var m = a.model, root = m && m.root;
        if (root && root.visible === false) continue;
        if (i >= 0 && a.inView === false) continue;
        var lift = root ? Math.max(0, root.position.y) : 0, s = 1 - Math.min(1, lift / 1.4);
        if (a.dead) s *= .55 * (1 - Math.min(1, (a.deadAge || 0) / 6));
        if (s < .02) continue;
        var r = (m && m.radius) || a.radius || .5;
        put(n++, a.x, a.z, Math.max(.45, r * 1.45) * (1 + lift * .35), s * (a.boss ? .8 : .72));
      }
      geo.instanceCount = n; attr.needsUpdate = n > 0;
      mesh.visible = n > 0;
    }
    function dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); base.dispose(); }
    return { mesh: mesh, update: update, dispose: dispose };
  }
  B.ContactShadows = { create: create };
}());
