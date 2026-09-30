'use strict';
// Actual world, lighting and browser-frame clock; CPU-only, no WebGL or speaker playback.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
global.window = global; global.self = global;
global.location = { search: '?sessiz' };
global.matchMedia = () => ({ matches: false });
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
for (const file of ['src/materials.js', 'src/world.js', 'src/lighting.js', 'src/pacing.js']) load(file);
const scene = new THREE.Scene(), world = BABA.World.build(scene, { multiDraw: true });
const camera = new THREE.PerspectiveCamera(43, 16 / 9, .15, 150);
camera.position.set(0, 17, -39); camera.lookAt(0, 0, -53); camera.updateMatrixWorld();
const renderer = { shadowMap: { enabled: true } };
const rig = BABA.Lighting.create({ renderer, scene, camera, world, cfg: { quality: 'high', shadows: 1 } });
const game = { state: 'playing', player: { x: 0, z: -53, rage: 0, dead: false }, enemies: [], hazards: [], resetSerial: 1 };
const map = () => ({ dispose() {} });
let clockTime = 0, cases = 0;
function activeSpots() { return world.root.children.filter(l => l.isSpotLight && l.intensity > 0); }
function consume() {
  const result = { key: 0, spots: 0 };
  for (const light of [rig.moon, ...world.root.children]) {
    if (!light.isLight || !light.castShadow || !light.shadow.needsUpdate) continue;
    result[light === rig.moon ? 'key' : 'spots']++;
    light.shadow.map = map(); light.shadow.needsUpdate = false;
  }
  return result;
}
function tick(dt, time, consumeNow = true) {
  world.update(dt, time, game.player); rig.follow(game.player); rig.update(dt, time, game);
  return consumeNow ? consume() : null;
}
function select(quality) { world.setQuality({ quality, shadows: 1 }); rig.setQuality({ quality, shadows: 1 }); }
function maxGap(times) { let n = 0; for (let i = 1; i < times.length; i++) n = Math.max(n, times[i] - times[i - 1]); return n; }

// Pacing's accepted timestamps, not a synthetic uniform stream at the requested FPS. Phase offsets
// independently vary the elapsed game clock against the accepted presentation pattern.
for (const quality of ['high', 'medium']) for (const cap of [60, 120])
for (const hz of [30, 60, 90, 120, 143.05, 144, 180, 200, 240]) for (const phase of [0, .001, .0042, .0084, .0125, .0159]) {
  select(quality);
  const pacing = BABA.Pacing.create(), budget = quality === 'high' ? 60 : 30;
  const base = clockTime + phase, duration = 8, settle = 3;
  const presented = [], key = [], spots = [];
  let lastDraw = null, collisions = 0;
  for (let i = 0; i < Math.ceil(hz * duration); i++) {
    const ts = i * 1000 / hz; if (!pacing.due(ts, cap)) continue;
    const time = base + ts / 1000, dt = lastDraw === null ? 1 / cap : time - lastDraw;
    lastDraw = time;
    const result = tick(dt, time);
    if (ts / 1000 < settle) continue;
    presented.push(time);
    if (result.key) key.push(time);
    for (let j = 0; j < result.spots; j++) spots.push(time);
    if (result.key && result.spots) collisions++;
  }
  clockTime = base + duration;
  const expected = Math.min(cap, hz, budget) * (duration - settle), name = `${quality}/${cap} cap/${hz} callback/phase ${phase}`;
  assert(Math.abs(key.length - expected) <= 2, `${name}: key budget ${key.length}/${expected}`);
  assert(Math.abs(spots.length - expected) <= 2, `${name}: spot budget ${spots.length}/${expected}`);
  if (Math.min(cap, hz) >= budget * 2) assert.equal(collisions, 0, `${name}: periodic key/spot collision`);
  const deadlineBound = 1 / budget + 2 * maxGap(presented) + 1e-5;
  assert(maxGap(key) <= deadlineBound, `${name}: starved key request`);
  assert(maxGap(spots) <= deadlineBound, `${name}: starved spot request`);
  if (Math.min(cap, hz) <= budget) assert(collisions > 0, `${name}: slow presentations must allow both maps`);
  cases++;
}
console.log(`PASS ${cases} actual Pacing/quality/rate/phase cases: shadow budgets, bounded gaps and fast-frame separation.`);

// Above the separation threshold but below two passes per shadow period, each map shares the
// available frames. Its rate may be renderHz/2; it must stay bounded, alternating and never starve.
for (const [quality, cap, hz] of [['high', 120, 97], ['high', 120, 100], ['high', 120, 110],
  ['medium', 60, 49], ['medium', 60, 50], ['medium', 60, 55]]) for (const phase of [0, .0042, .0084, .0159]) {
  select(quality);
  const pacing = BABA.Pacing.create(), budget = quality === 'high' ? 60 : 30, base = clockTime + phase;
  const presented = [], key = [], spots = []; let lastDraw = null, collisions = 0;
  for (let i = 0; i < Math.ceil(hz * 8); i++) {
    const ts = i * 1000 / hz; if (!pacing.due(ts, cap)) continue;
    const time = base + ts / 1000, dt = lastDraw === null ? 1 / cap : time - lastDraw; lastDraw = time;
    const result = tick(dt, time); if (ts / 1000 < 3) continue;
    presented.push(time); if (result.key) key.push(time); if (result.spots) spots.push(time);
    if (result.key && result.spots) collisions++;
  }
  const name = `${quality}/${hz} intermediate rate/phase ${phase}`, lower = Math.floor(hz / 2) * 5 - 2;
  for (const requests of [key, spots]) {
    assert(requests.length >= lower && requests.length <= budget * 5 + 2, `${name}: rate/starvation`);
    assert(maxGap(requests) <= 1 / budget + 2 * maxGap(presented) + 1e-5, `${name}: bounded delay`);
  }
  assert.equal(collisions, 0, `${name}: fast-frame collision`); clockTime = base + 8;
}

// Jitter around the threshold must not repeatedly reset or starve a one-frame pending request.
for (const quality of ['high', 'medium']) {
  select(quality); const budget = quality === 'high' ? 60 : 30, scale = quality === 'high' ? 1 : 2;
  const base = clockTime, key = [], spots = [], presented = []; let dt;
  for (let i = 0; i < 800; i++) {
    dt = (i % 2 ? .012 : .009) * scale; clockTime += dt;
    const result = tick(dt, clockTime); if (clockTime - base < 3) continue;
    presented.push(clockTime); if (result.key) key.push(clockTime); if (result.spots) spots.push(clockTime);
  }
  for (const requests of [key, spots]) {
    assert(requests.length >= presented.length / 2 - 2, `${quality}: threshold jitter starvation`);
    assert(requests.length <= (clockTime - presented[0]) * budget + 2, `${quality}: threshold jitter budget`);
    assert(maxGap(requests) <= 1 / budget + 2 * maxGap(presented) + 1e-5, `${quality}: threshold jitter delay`);
  }
}
console.log('PASS intermediate rates and threshold jitter: one-frame sharing remains bounded without starvation.');

// Unconsumed renderer-owned requests and maps missing after restoration always remain pending.
select('high');
for (let i = 0; i < 240; i++) { clockTime += 1 / 120; tick(1 / 120, clockTime); }
for (const light of activeSpots()) light.shadow.needsUpdate = true;
rig.moon.shadow.needsUpdate = true;
clockTime += 1 / 120; tick(1 / 120, clockTime, false);
assert(activeSpots().every(l => l.shadow.needsUpdate)); assert(rig.moon.shadow.needsUpdate);
world.update(0, clockTime, game.player); rig.update(0, clockTime, game);
assert(activeSpots().every(l => l.shadow.needsUpdate)); assert(rig.moon.shadow.needsUpdate); consume();
for (const light of activeSpots()) light.shadow.map = null;
rig.moon.shadow.map = null;
tick(0, clockTime, false); assert(activeSpots().every(l => l.shadow.needsUpdate)); assert(rig.moon.shadow.needsUpdate);
assert.equal(world.lighting.deferShadowRefresh(), false, 'Missing spot maps must not yield'); consume();

// Source reassignment is an immediate invalidation, even when its light already owns an older map.
let reassigned = false;
const changedSources = new Set();
for (let i = 0; i < 240 && !reassigned; i++) {
  clockTime += 1 / 120;
  const lights = world.root.children.filter(l => l.isSpotLight), before = new Map(lights.map(l => [l, l.shadow.camera.near]));
  world.update(1 / 120, clockTime, { x: 1.4, z: -23.6 });
  for (const light of lights) if (before.get(light) !== light.shadow.camera.near) changedSources.add(light);
  for (const light of activeSpots()) if (changedSources.has(light)) {
    assert(light.shadow.needsUpdate, 'Reassigned source must refresh immediately');
    const was = light.shadow.needsUpdate; world.lighting.deferShadowRefresh();
    assert.equal(light.shadow.needsUpdate, was, 'A regular deferral must not cancel a new source'); reassigned = true;
  }
  consume();
}
assert(reassigned, 'Fixture must actually reassign a spot source');

// Start with an actual deferred request before a stall, rather than resetting it via setQuality.
// Both domains must process that protected request at the current clock bucket, not replay old ticks.
function warmAtBoundary() {
  select('high'); const start = Math.ceil(clockTime) + 1 + .001;
  for (let i = 0; i <= 240; i++) { clockTime = start + i / 120; tick(1 / 120, clockTime); }
}
warmAtBoundary();
clockTime += .009; world.update(.009, clockTime, game.player);
assert(world.lighting.deferShadowRefresh(), 'Fixture must defer a regular spot request'); consume();
clockTime = Math.ceil(clockTime) + 2 + .001;
const spotAfterStall = tick(2, clockTime); assert(spotAfterStall.spots && world.lighting.shadowRefreshDeferred());
clockTime += .001; assert.equal(tick(.001, clockTime).spots, 0, 'Old deferred spot tick must coalesce after stall');

warmAtBoundary();
clockTime += .009; world.update(.009, clockTime, game.player);
assert(world.lighting.deferShadowRefresh(), 'Fixture must defer a spot before the next key deadline'); consume();
clockTime += .008; tick(.008, clockTime, false);
assert(world.lighting.shadowRefreshDeferred() && !rig.moon.shadow.needsUpdate, 'Fixture must defer the new key request behind the protected spot'); consume();
clockTime = Math.ceil(clockTime) + 2 + .001;
assert(tick(2, clockTime).key, 'Deferred key must survive a stall');
clockTime += .001; assert.equal(tick(.001, clockTime).key, 0, 'Old deferred key tick must coalesce after stall');

// Rate/quality changes, time reversal and a large jump coalesce requests; no old queue may burst afterwards.
for (const quality of ['medium', 'high', 'low', 'high']) {
  select(quality); clockTime += 5; tick(.05, clockTime);
  tick(0, clockTime, false); consume();
  clockTime -= .25; tick(1 / 120, clockTime);
  const times = [];
  for (let i = 0; i < 240; i++) { clockTime += 1 / 120; const result = tick(1 / 120, clockTime); if (i >= 120 && result.spots) times.push(clockTime); }
  const budget = quality === 'low' ? 0 : quality === 'medium' ? 30 : 60;
  assert(times.length <= budget + 1, 'Clock jump produced an old-deadline catch-up queue');
}
console.log('PASS pending/fresh/restored maps, source reassignment, duplicate time, time reversal, quality changes and bounded recovery. CPU-only; no GPU/FPS performance claim.');
rig.dispose(); world.dispose();
