/* KABİR AZABI — post-build static merger (ajan:perf).
 * Runs once after a chapter world is built (app.js boot) and cuts draw submissions without changing a pixel.
 *
 *  The instanced dungeon (Windows/D3D11 path; Mac/iPad use world.js' multi-draw batches instead) is built from thousands of
 *  repeated parts, one InstancedMesh per shape × material × room chunk, so one room costs 200+ draws for ~20 materials.
 *
 *  Two kinds of merged draw replace them:
 *   • "pseudo" (small parts, different shapes, same material): the parts' vertices are concatenated into ONE mesh that is still
 *     drawn through the *instanced* shader path. Each copied vertex carries its original instance matrix and colour as ordinary
 *     per-vertex attributes named `instanceMatrix` / `instanceColor` (divisor 0) and the mesh is drawn as an InstancedMesh with
 *     a single instance. The vertex shader sees the same local position, normal, uv, instance matrix and colour as before
 *     (local-space stone joints, per-stone random rotations, scale-aware UVs stay identical) with the program variant that
 *     already exists — no new shaders.
 *   • "inst" (large parts with identical geometry, e.g. floor slabs of every room): one InstancedMesh holding the instances.
 *
 *  Exact culling: every frame the merged draw contains exactly the parts the world wants visible (range, detail level,
 *  quality) — and, for parts that cast no shadow, only parts whose own bounds meet the camera frustum (+margin) — by
 *  compacting the index list / instance list when that set changes. The parts stay in the scene graph (raycasts, world code,
 *  quality toggles still address them); their `visible` becomes an accessor: the world writes the wish, the renderer sees false
 *  while the merged draw stands in. Parts that disagree on shadow flags draw themselves; a part whose instances change after
 *  the merge is returned to normal drawing for good.
 *
 *  `?noopt` disables everything; `BABA.Perf.setEnabled(false)` switches back at run time (QA before/after comparisons).
 */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var T = window.THREE;
  var Q = location.search, OFF = /[?&]noopt\b/.test(Q);
  // Small parts (shape vertices × instances) are copied into pseudo merges; larger ones are merged as real instances.
  // TOTAL caps the copied vertices (~108 bytes each with matrix and colour).
  var SRC_LIMIT = +(/[?&]mergesrc=(\d+)/.exec(Q) || [0, 5000])[1], TOTAL_LIMIT = +(/[?&]mergetotal=(\d+)/.exec(Q) || [0, 600000])[1];
  var MARGIN = +(/[?&]mergemargin=([\d.]+)/.exec(Q) || [0, .25])[1];   // metres added to each part's bounds for the camera test (re-tested whenever the camera moves)
  var Perf = B.Perf = B.Perf || {};
  Perf.enabled = !OFF;
  Perf.groups = [];
  Perf.stats = { pseudo: 0, inst: 0, sources: 0, vertices: 0, rebuilds: 0, skipped: {} };

  function skip(reason) { Perf.stats.skipped[reason] = (Perf.stats.skipped[reason] || 0) + 1; return false; }
  var ATTR_OK = { position: 1, normal: 1, uv: 1, uv1: 1, uv2: 1, tangent: 1, color: 1 };

  function eligible(o) {
    if (!o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh) return false;
    var m = o.material, g = o.geometry;
    if (!m || Array.isArray(m)) return skip('multi-material');
    if (m.transparent || m.isShaderMaterial || m.isRawShaderMaterial) return skip('transparent/shader');
    if (m.alphaTest > 0 || m.alphaHash) return skip('cutout');
    if (o.morphTexture || g.morphAttributes && Object.keys(g.morphAttributes).length) return skip('morph');
    if (o.instanceMatrix.usage !== T.StaticDrawUsage) return skip('dynamic');
    if (o.instanceColor && o.instanceColor.usage !== T.StaticDrawUsage) return skip('dynamic-color');
    if (!o.frustumCulled) return skip('no-frustum');
    if (o.onBeforeRender !== T.Object3D.prototype.onBeforeRender || o.onAfterRender !== T.Object3D.prototype.onAfterRender) return skip('render-hook');
    if (o.children.length) return skip('children');
    if (o.customDepthMaterial && !o.customDepthMaterial.isMeshDepthMaterial || o.customDistanceMaterial) return skip('custom-depth');
    var ud = o.userData || {};
    if (ud.occluder || ud.noMerge || ud.dynamic || ud.interactive || ud.quest || ud.anim || ud.animated) return skip('flagged');
    if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return skip('draw-range');
    var names = Object.keys(g.attributes);
    for (var i = 0; i < names.length; i++) {
      var a = g.attributes[names[i]];
      if (!ATTR_OK[names[i]] || a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute) return skip('attribute:' + names[i]);
    }
    if (!g.attributes.position) return skip('no-position');
    if (o.count < 1) return skip('empty');
    return true;
  }
  function layoutOf(g) {
    return Object.keys(g.attributes).sort().map(function (n) {
      var a = g.attributes[n]; return n + '/' + a.itemSize + '/' + a.normalized + '/' + a.array.constructor.name;
    }).join(',') + (g.index ? '/i' : '/n');
  }
  // Content hash of a geometry (world.js gives every batch its own copy of a shared shape).
  var hashCache = new WeakMap();
  function geoHash(g) {
    var h = hashCache.get(g); if (h) return h;
    var x = 2166136261 >>> 0, parts = [];
    Object.keys(g.attributes).sort().forEach(function (n) { parts.push(g.attributes[n].array); });
    if (g.index) parts.push(g.index.array);
    parts.forEach(function (arr) {
      var u = new Uint32Array(arr.buffer, arr.byteOffset, (arr.byteLength / 4) | 0);
      for (var i = 0; i < u.length; i++) x = Math.imul(x ^ u[i], 16777619) >>> 0;
      x = Math.imul(x ^ arr.length, 16777619) >>> 0;
    });
    h = layoutOf(g) + '#' + x.toString(36); hashCache.set(g, h); return h;
  }
  function roomOf(o, world) {
    if (!o.boundingSphere) o.computeBoundingSphere();
    var c = o.boundingSphere.center, r = world && world.roomAt ? world.roomAt(c.x, c.z) : null;
    return r ? 'r' + r.id : 'g' + Math.floor(c.x / 24) + ':' + Math.floor(c.z / 24);
  }

  // `visible` as an accessor: world code writes the wish, the renderer reads wish && !merged.
  var wishEpoch = 0;
  function hookVisibility(o, group) {
    var want = o.visible;
    Object.defineProperty(o, 'visible', {
      configurable: true, enumerable: true,
      get: function () { return want && !group.active; },
      set: function (v) { v = !!v; if (v !== want) { want = v; wishEpoch++; } }
    });
    o.userData.perfGroup = group;
    o.userData.perfWant = function () { return want; };
    o.userData.perfRelease = function () { delete o.visible; o.visible = want; delete o.userData.perfWant; delete o.userData.perfRelease; delete o.userData.perfGroup; };
  }

  function finishMesh(G, mesh) {
    var s0 = G.sources[0];
    mesh.castShadow = s0.castShadow; mesh.receiveShadow = s0.receiveShadow; mesh.renderOrder = s0.renderOrder; mesh.layers.mask = s0.layers.mask;
    mesh.customDepthMaterial = s0.customDepthMaterial; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.raycast = function () { };   // picking keeps using the original parts
    mesh.userData.perfMerged = true; mesh.visible = false; mesh.__perfEager = true;
    mesh.boundingSphere = new T.Sphere();
    mesh.name = 'perf-' + G.kind + ':' + (s0.material.name || s0.material.type) + ':' + G.sources.length;
    G.mesh = mesh; G.included = new Uint8Array(G.sources.length); G.sig = ''; G.versions = G.sources.map(versionOf);
    s0.parent.add(mesh);
  }
  function versionOf(s) { return s.instanceMatrix.version + ':' + (s.instanceColor ? s.instanceColor.version : -1) + ':' + s.count; }

  function buildPseudo(G) {
    var srcs = G.sources, nv = 0, ni = 0, k, i, j;
    var g0 = srcs[0].geometry, names = Object.keys(g0.attributes), hasColor = !!srcs[0].instanceColor;
    for (k = 0; k < srcs.length; k++) {
      var g = srcs[k].geometry, n = g.attributes.position.count, c = srcs[k].count;
      nv += n * c; ni += (g.index ? g.index.count : n) * c;
    }
    var out = new T.BufferGeometry(), arrays = {};
    names.forEach(function (name) { arrays[name] = new g0.attributes[name].array.constructor(nv * g0.attributes[name].itemSize); });
    var mat = new Float32Array(nv * 16), col = hasColor ? new Float32Array(nv * 3) : null;
    var full = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), vo = 0, io = 0;
    G.ranges = new Uint32Array(srcs.length * 2);
    for (k = 0; k < srcs.length; k++) {
      var s = srcs[k], sg = s.geometry, sn = sg.attributes.position.count, im = s.instanceMatrix.array, ic = s.instanceColor ? s.instanceColor.array : null;
      var sIdx = sg.index ? sg.index.array : null, sic = sIdx ? sIdx.length : sn;
      G.ranges[k * 2] = io;
      for (var inst = 0; inst < s.count; inst++) {
        for (var a = 0; a < names.length; a++) {
          var at = sg.attributes[names[a]], sz = at.itemSize;
          arrays[names[a]].set(at.array.subarray(0, sn * sz), vo * sz);
        }
        var m16 = im.subarray(inst * 16, inst * 16 + 16);
        for (i = 0; i < sn; i++) {
          mat.set(m16, (vo + i) * 16);
          if (col) { col[(vo + i) * 3] = ic[inst * 3]; col[(vo + i) * 3 + 1] = ic[inst * 3 + 1]; col[(vo + i) * 3 + 2] = ic[inst * 3 + 2]; }
        }
        if (sIdx) for (j = 0; j < sic; j++) full[io++] = vo + sIdx[j];
        else for (j = 0; j < sic; j++) full[io++] = vo + j;
        vo += sn;
      }
      G.ranges[k * 2 + 1] = io - G.ranges[k * 2];
    }
    names.forEach(function (name) { var a0 = g0.attributes[name]; out.setAttribute(name, new T.BufferAttribute(arrays[name], a0.itemSize, a0.normalized)); });
    var mAttr = new T.BufferAttribute(mat, 16); out.setAttribute('instanceMatrix', mAttr);
    var cAttr = null; if (col) { cAttr = new T.BufferAttribute(col, 3); out.setAttribute('instanceColor', cAttr); }
    G.full = full;
    var idx = new T.BufferAttribute(new full.constructor(full.length), 1); idx.setUsage(T.DynamicDrawUsage); out.setIndex(idx);
    out.setDrawRange(0, 0);
    out.boundingSphere = new T.Sphere(); out.boundingBox = new T.Box3();
    var mesh = new T.InstancedMesh(out, srcs[0].material, 1);
    mesh.instanceMatrix = mAttr; mesh.instanceColor = cAttr;   // same attribute objects: uploaded once, bound per vertex
    G.vertices = nv;
    finishMesh(G, mesh);
  }
  function buildInst(G) {
    var srcs = G.sources, n = 0, hasColor = !!srcs[0].instanceColor;
    srcs.forEach(function (s) { n += s.count; });
    var mesh = new T.InstancedMesh(srcs[0].geometry, srcs[0].material, n);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    if (hasColor) { mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3); mesh.instanceColor.setUsage(T.DynamicDrawUsage); }
    mesh.count = 0; G.capacity = n; G.vertices = 0;
    finishMesh(G, mesh);
  }

  // Re-pack the merged draw from the included parts (only when that set changes).
  var tmpSphere = new T.Sphere(), tmpBox = new T.Box3(), tmpBox2 = new T.Box3();
  function rebuild(G) {
    var srcs = G.sources, inc = G.included, mesh = G.mesh, k, count = 0, any = false;
    tmpBox.makeEmpty();
    if (G.kind === 'pseudo') {
      var idx = mesh.geometry.index, arr = idx.array, full = G.full, r = G.ranges;
      for (k = 0; k < srcs.length; k++) if (inc[k]) {
        arr.set(full.subarray(r[k * 2], r[k * 2] + r[k * 2 + 1]), count); count += r[k * 2 + 1];
        srcs[k].boundingSphere.getBoundingBox(tmpBox2); tmpBox.union(tmpBox2); any = true;
      }
      mesh.geometry.setDrawRange(0, count);
      if (count) { idx.clearUpdateRanges(); idx.addUpdateRange(0, count); idx.needsUpdate = true; }
    } else {
      var im = mesh.instanceMatrix, ic = mesh.instanceColor;
      for (k = 0; k < srcs.length; k++) if (inc[k]) {
        var s = srcs[k];
        im.array.set(s.instanceMatrix.array.subarray(0, s.count * 16), count * 16);
        if (ic) ic.array.set(s.instanceColor.array.subarray(0, s.count * 3), count * 3);
        count += s.count; s.boundingSphere.getBoundingBox(tmpBox2); tmpBox.union(tmpBox2); any = true;
      }
      mesh.count = count;
      if (count) {
        im.clearUpdateRanges(); im.addUpdateRange(0, count * 16); im.needsUpdate = true;
        if (ic) { ic.clearUpdateRanges(); ic.addUpdateRange(0, count * 3); ic.needsUpdate = true; }
      }
    }
    if (any) {
      tmpBox.getBoundingSphere(mesh.boundingSphere);
      for (k = 0; k < srcs.length; k++) if (inc[k]) { var bs = srcs[k].boundingSphere; mesh.boundingSphere.radius = Math.max(mesh.boundingSphere.radius, mesh.boundingSphere.center.distanceTo(bs.center) + bs.radius); }
      if (mesh.geometry.boundingSphere && G.kind === 'pseudo') mesh.geometry.boundingSphere.copy(mesh.boundingSphere);
    }
    G.drawn = count > 0;
    Perf.stats.rebuilds++;
  }

  function release(G) {
    G.active = false; G.dead = true;
    if (G.mesh) { G.mesh.visible = false; if (G.mesh.parent) G.mesh.parent.remove(G.mesh); if (G.kind === 'pseudo') G.mesh.geometry.dispose(); else G.mesh.dispose(); G.mesh = null; }
    G.sources.forEach(function (s) { if (s.userData.perfRelease) s.userData.perfRelease(); });
  }

  var frustum = new T.Frustum(), projView = new T.Matrix4(), camPos = new T.Vector3(), camDir = new T.Vector3();
  var lastPos = new T.Vector3(1e9, 1e9, 1e9), lastDir = new T.Vector3(), lastP0 = 0, lastP5 = 0, camEpoch = 0, frameNo = 0;
  function cameraStep(camera) {
    camPos.setFromMatrixPosition(camera.matrixWorld); camera.getWorldDirection(camDir);
    var pe = camera.projectionMatrix.elements;
    if (camPos.distanceToSquared(lastPos) < 1e-6 && camDir.dot(lastDir) > .9999999 && pe[0] === lastP0 && pe[5] === lastP5) return false;
    lastPos.copy(camPos); lastDir.copy(camDir); lastP0 = pe[0]; lastP5 = pe[5]; camEpoch++;
    projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projView);
    return true;
  }

  // Before every main render (scene.onBeforeRender; shadow maps render inside that call afterwards).
  // Cheap when nothing changed: the part loop only runs after the camera moved, a wish changed or shadow flags flipped.
  function frame(camera) {
    var mainCam = B.app && B.app.camera, useCam = camera && camera === mainCam;
    var moved = useCam ? cameraStep(camera) : false;
    var check = (frameNo = (frameNo + 1) % 15) === 0;
    var gs = Perf.groups;
    for (var i = 0; i < gs.length; i++) {
      var G = gs[i]; if (G.dead) continue;
      var srcs = G.sources, s0 = srcs[0], k, s;
      if (check) for (k = 0; k < srcs.length; k++) if (versionOf(srcs[k]) !== G.versions[k]) { release(G); break; }
      if (G.dead) continue;
      var flags = (Perf.enabled ? 1 : 0) | (s0.castShadow ? 2 : 0) | (s0.receiveShadow ? 4 : 0) | (s0.parent ? 8 : 0);
      if (flags !== G.flags || check) {
        var ok = Perf.enabled && s0.parent !== null;
        for (k = 1; ok && k < srcs.length; k++) { s = srcs[k]; if (s.castShadow !== s0.castShadow || s.receiveShadow !== s0.receiveShadow || s.parent !== s0.parent) ok = false; }
        if (ok !== G.ok || flags !== G.flags) G.sig = '';
        G.ok = ok; G.flags = flags;
      }
      G.active = G.ok;
      if (!G.ok) { G.mesh.visible = false; continue; }
      var camTest = !s0.castShadow && useCam;
      // Other cameras (previews, warm-up) keep the set chosen for the last main view.
      if (G.sig !== '' && (!useCam || G.wish === wishEpoch && G.camTest === camTest && (!camTest || !moved))) { G.mesh.visible = G.drawn; continue; }
      var inc = G.included, changed = false, ws = G.wspheres;
      for (k = 0; k < srcs.length; k++) {
        var want = srcs[k].userData.perfWant() ? 1 : 0;
        if (want && camTest) want = frustum.intersectsSphere(ws[k]) ? 1 : 0;
        if (inc[k] !== want) { inc[k] = want; changed = true; }
      }
      if (changed || G.sig === '') { G.sig = 'x'; rebuild(G); }
      G.wish = wishEpoch; G.camTest = camTest;
      G.mesh.visible = G.drawn;
      G.mesh.castShadow = s0.castShadow; G.mesh.receiveShadow = s0.receiveShadow;
      if (G.mesh.parent !== s0.parent) s0.parent.add(G.mesh);
    }
  }

  Perf.optimize = function (world, scene) {
    if (OFF || !world || !world.root || Perf.root === world.root) return Perf.stats;
    Perf.root = world.root;
    var t0 = performance.now(), pseudo = new Map(), inst = new Map(), total = 0;
    world.root.updateMatrixWorld(true);
    world.root.traverse(function (o) {
      if (!o.isInstancedMesh || o.userData.perfMerged) return;
      if (!eligible(o)) return;
      var ud = o.userData, verts = o.geometry.attributes.position.count * o.count;
      // Shadow casters stay grouped per room (their merged bounds also drive the shadow-map culling).
      var cast = o.castShadow && !(ud.proxied && ud.baseCastShadow), scope = cast ? roomOf(o, world) : 'all';
      var flags = [o.parent.uuid, o.material.uuid, !!o.instanceColor, o.castShadow, ud.baseCastShadow, ud.proxied, o.receiveShadow, o.renderOrder, o.layers.mask,
        o.customDepthMaterial ? o.customDepthMaterial.uuid : '-', scope].join('|');
      var small = verts <= SRC_LIMIT, map = small ? pseudo : inst, key = small ? flags + '|' + layoutOf(o.geometry) : flags + '|' + geoHash(o.geometry);
      var G = map.get(key); if (!G) map.set(key, G = { key: key, kind: small ? 'pseudo' : 'inst', sources: [], verts: 0 });
      G.sources.push(o); G.verts += verts;
    });
    function adopt(G) {
      Perf.groups.push(G); Perf.stats[G.kind]++; Perf.stats.sources += G.sources.length;
      G.wspheres = G.sources.map(function (s) {
        if (!s.boundingSphere) s.computeBoundingSphere(); hookVisibility(s, G);
        var w = s.boundingSphere.clone().applyMatrix4(s.matrixWorld); w.radius += MARGIN; return w;   // static parts: world bounds once
      });
      G.flags = -1; G.ok = false;
    }
    pseudo.forEach(function (G) {
      if (G.sources.length < 2) return;
      if (total + G.verts > TOTAL_LIMIT) { skip('total-budget'); return; }
      total += G.verts; buildPseudo(G); adopt(G);
    });
    inst.forEach(function (G) { if (G.sources.length < 2) return; buildInst(G); adopt(G); });
    Perf.stats.vertices = total; Perf.stats.ms = +(performance.now() - t0).toFixed(1);
    scene.onBeforeRender = (function (before) {
      return function (renderer, s, camera) { if (before) before.apply(this, arguments); frame(camera); };
    })(scene.onBeforeRender && scene.onBeforeRender !== T.Object3D.prototype.onBeforeRender ? scene.onBeforeRender : null);
    if (/[?&]perflog\b/.test(Q)) console.log('perf merge', JSON.stringify(Perf.stats));
    return Perf.stats;
  };
  Perf.setEnabled = function (on) { Perf.enabled = !!on && !OFF; return Perf.enabled; };

  /* Hidden subtrees skip their per-frame matrix work. Three recomposes and multiplies the local/world matrix of EVERY object in
   * the scene each frame, visible or not: ~40 parked enemies (≈90 bones each), pooled effects and warm-up groups made that
   * ~12 000 objects and ~1.5 ms of a frame. A hidden object (and so its subtree) now waits; the first frame it is visible again
   * it recomposes, and a parent change that happened meanwhile is replayed (forced) then. Nothing hidden is drawn, and
   * getWorldPosition()/updateWorldMatrix() still compute fresh values on demand. Hidden shadow casters are exempt: shadow-only
   * stand-ins (character shadow proxies) are shown inside the shadow pass, after this update. */
  (function lazyHiddenMatrices() {
    if (OFF || /[?&]nolazy\b/.test(Q)) return;
    var proto = T.Object3D.prototype, original = proto.updateMatrixWorld;
    proto.updateMatrixWorld = function (force) {
      // Shadow-only stand-ins (hidden in the main pass, shown inside shadowMap.render) cast shadows: they keep updating.
      if (this.visible === false && this.castShadow === false && Perf.enabled && !this.__perfEager && !this.isScene && !this.isCamera && !this.isLight) {
        if (force) this.__perfForce = true;
        return;
      }
      if (this.__perfForce) { this.__perfForce = false; force = true; }
      return original.call(this, force);
    };
  })();
})();
