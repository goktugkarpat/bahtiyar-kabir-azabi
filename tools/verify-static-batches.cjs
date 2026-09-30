'use strict';
// Actual r170 camera/instance decisions and texture versions; CPU-only, no WebGL or audio.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
global.window = global; global.self = global; global.location = { search: '?sessiz' };
function canvas() {
  const c = { width: 1, height: 1 };
  const context = new Proxy({ canvas: c, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
  { get: (o, k) => k in o ? o[k] : () => {} });
  c.getContext = () => context; return c;
}
global.document = { createElement: canvas };
global.Image = class { constructor() { this.width = this.height = 1024; } set src(value) { queueMicrotask(() => this.onload && this.onload()); } };
const load = file => vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
load('vendor/three.js');
THREE.PMREMGenerator = class { fromScene() { return { texture: new THREE.Texture() }; } dispose() {} };
load('src/materials.js'); load('src/world.js');
const scene = new THREE.Scene(), world = BABA.World.build(scene, { multiDraw: true });
const meshes = world.root.children.filter(m => m.isBatchedMesh), native = THREE.BatchedMesh.prototype.onBeforeRender;
const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem };
assert(meshes.length > 100); assert(meshes.every(m => m.onBeforeRender !== native));
let comparisons = 0, instances = 0, unchanged = 0, changed = 0;
function cameraAt(x, z, kind) {
  const c = kind === 1 ? new THREE.OrthographicCamera(-20, 20, 20, -20, 1, 60)
    : new THREE.PerspectiveCamera(kind === 2 ? 100 : 43, 16 / 9, .15, 150);
  c.position.set(x + (kind ? 6 : 0), kind ? 19 : 17, z + (kind ? -8 : 14));
  c.lookAt(x, 0, z - 6); c.updateMatrixWorld(); return c;
}
function compare(mesh, camera, fallback = false) {
  const texture = mesh._indirectTexture, before = Array.from(texture.image.data), version = texture.version;
  const nativeRuns = mesh._visibilityChanged || mesh.perObjectFrustumCulled || mesh.sortObjects;
  mesh.onBeforeRender(renderer, scene, camera, mesh.geometry, mesh.material);
  const n = mesh._multiDrawCount, starts = Array.from(mesh._multiDrawStarts.subarray(0, n)), counts = Array.from(mesh._multiDrawCounts.subarray(0, n));
  const ids = Array.from(texture.image.data.subarray(0, n));
  const dirty = ids.some((id, i) => id !== before[i]);
  assert.equal(texture.version - version, fallback ? Number(nativeRuns) : Number(dirty || version === 0), mesh.name + ' texture update');
  if (!fallback) { if (dirty) changed++; else unchanged++; }
  const customVersion = texture.version, sourceVersion = texture.source.version;
  native.call(mesh, renderer, scene, camera, mesh.geometry, mesh.material);
  assert.equal(mesh._multiDrawCount, n, mesh.name + ' visible count');
  assert.deepEqual(Array.from(mesh._multiDrawStarts.subarray(0, n)), starts, mesh.name + ' starts');
  assert.deepEqual(Array.from(mesh._multiDrawCounts.subarray(0, n)), counts, mesh.name + ' counts');
  assert.deepEqual(Array.from(texture.image.data.subarray(0, n)), ids, mesh.name + ' IDs');
  // Native increments the version unconditionally. Restore only that oracle side effect.
  texture.version = customVersion; texture.source.version = sourceVersion;
  comparisons++; instances += mesh._instanceInfo.length; return { n, ids, dirty };
}
for (const quality of ['high', 'medium', 'low']) {
  world.setQuality({ quality });
  for (const z of [8, -2, -23, -44, -53, -74, -83, -103, -128, -150, -157, -169]) for (const x of [-6, 0, 6]) {
    world.update(.1, comparisons / 100, { x, z }); world.root.updateMatrixWorld(true);
    for (const kind of [0, 1, 2]) {
      const camera = cameraAt(x, z, kind);
      for (const mesh of meshes) { compare(mesh, camera); compare(mesh, camera); }
    }
  }
}
const mesh = meshes.find(m => m._instanceInfo.length > 20), camera = cameraAt(0, -74, 0), matrix = new THREE.Matrix4();
mesh.getMatrixAt(0, matrix); matrix.elements[12] += 12; mesh.setMatrixAt(0, matrix); compare(mesh, camera);
if (mesh._geometryInfo.length > 1) { mesh.setGeometryIdAt(0, 1); compare(mesh, camera); }
mesh.geometry.attributes.position.needsUpdate = true; compare(mesh, camera);
mesh.geometry.index.needsUpdate = true; compare(mesh, camera);
mesh.matrixWorld.makeRotationY(.32); mesh.matrixWorld.setPosition(7, 2, -11);
compare(mesh, camera); compare(mesh, cameraAt(-5, -30, 1));
mesh.sortObjects = true; compare(mesh, camera, true); mesh.sortObjects = false;
mesh.perObjectFrustumCulled = false; compare(mesh, camera, true); mesh.perObjectFrustumCulled = true;

// Equal camera/IDs skip uploads; shrinking retains a harmless tail; regrowth and equal-sized replacements stay exact.
const wide = new THREE.OrthographicCamera(-500, 500, 500, -500, .1, 1000);
wide.position.set(0, 300, 0); wide.lookAt(0, 0, 0); wide.updateMatrixWorld();
for (let i = 0; i < mesh._instanceInfo.length; i++) mesh.setVisibleAt(i, true);
const full = compare(mesh, wide); assert(full.n > 10);
assert.equal(compare(mesh, wide).dirty, false);
for (let i = Math.floor(full.n / 2); i < mesh._instanceInfo.length; i++) mesh.setVisibleAt(i, false);
const short = compare(mesh, wide); assert(short.n < full.n); assert.equal(short.dirty, false);
for (let i = 0; i < mesh._instanceInfo.length; i++) mesh.setVisibleAt(i, true);
const long = compare(mesh, wide); assert.equal(long.n, full.n); assert.equal(long.dirty, false);
mesh.setVisibleAt(0, false); const sequenceA = compare(mesh, wide);
mesh.setVisibleAt(0, true); mesh.setVisibleAt(1, false); const sequenceB = compare(mesh, wide);
assert.equal(sequenceA.n, sequenceB.n); assert(sequenceB.dirty); assert.notDeepEqual(sequenceA.ids, sequenceB.ids);
const priorVersion = mesh._indirectTexture.version; compare(mesh, wide); assert.equal(mesh._indirectTexture.version, priorVersion);

// A fresh replacement has no GPU storage/version; an unchanged list still becomes uploadable.
const original = mesh._indirectTexture, image = original.image;
const restored = new THREE.DataTexture(new image.data.constructor(image.data), image.width, image.height, original.format, original.type);
assert.equal(restored.version, 0); mesh._indirectTexture = restored;
assert.equal(compare(mesh, wide).dirty, false); assert.equal(restored.version, 1);
for (const kind of [0, 1, 2, 0]) compare(mesh, cameraAt(0, -74, kind));
mesh._indirectTexture = original; restored.dispose();

// All later shaft patterns are prepared once under the loader; Low avoids unused shadow masks.
world.setQuality({ quality: 'high' });
const masks = world.lighting.prepareTextures(), again = world.lighting.prepareTextures();
const expected = new Set(['grate', ...world.lighting.shafts.map(s => s[10] || 'grate')]);
assert.deepEqual(new Set(masks.map(t => t.name.slice('kara:light-cookie:'.length))), expected);
assert.deepEqual(masks, again); assert(masks.every(t => t.image && t.version > 0));
world.setQuality({ quality: 'low' }); assert.deepEqual(world.lighting.prepareTextures(), []);
console.log(`PASS ${comparisons} exact main/directional/spot-camera batch comparisons (${instances} instances); ${unchanged} unchanged lists, ${changed} changed lists.`);
console.log('PASS shrink/regrow, equal-count changed IDs, fresh replacement texture, matrix/geometry/group invalidation, native fallback and loader masks. CPU-only; no FPS claim.');
world.dispose();
