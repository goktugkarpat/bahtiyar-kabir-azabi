'use strict';
// Real combat/world/models, with inert canvas and audio: no browser or sound playback.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.argv[2] || path.resolve(__dirname, '..');
global.window = global; global.self = global;
Object.defineProperty(global, 'navigator', { value: { userAgent: 'Node silent ability QA', platform: 'Win32' }, configurable: true });
global.location = { search: '?sessiz', href: 'file:///ability-qa?sessiz' };
global.matchMedia = () => ({ matches: false, addEventListener() {} });
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
function canvas() {
  const c = { width: 1, height: 1, style: {}, toDataURL: () => '', getBoundingClientRect: () => ({ width: c.width, height: c.height }) };
  const ctx = new Proxy({ canvas: c, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), measureText: s => ({ width: String(s).length * 10 }) },
  { get: (o, k) => k in o ? o[k] : () => {} });
  c.getContext = k => k === '2d' ? ctx : null; return c;
}
global.document = { createElement: () => canvas(), getElementById: () => ({ width: 1920, height: 1080 }), readyState: 'loading', addEventListener() {} };
global.Image = class { constructor() { this.width = this.height = 1024; } set src(s) { queueMicrotask(() => this.onload && this.onload()); } };
const load = n => vm.runInThisContext(fs.readFileSync(path.join(root, n), 'utf8'), { filename: path.join(root, n) });
load('vendor/three.js'); load('vendor/gltf-loader.js');
THREE.TextureLoader.prototype.load = function (url, onLoad) { const t = new THREE.Texture({ width: 1024, height: 1024 }); queueMicrotask(() => onLoad(t)); return t; };
THREE.PMREMGenerator = class { fromScene() { return { texture: new THREE.Texture() }; } dispose() {} };
for (const n of ['src/materials.js', 'src/models.js', 'assets/characters/characters.js', 'assets/characters/authored-clips.js',
  'src/authored-motion.js', 'src/authored-models.js', 'src/world.js', 'src/limbs.js', 'src/globes.js', 'src/combat.js']) load(n);


// Real invisible marker preparation: no WebGL, browser, or audio playback.
(async () => {
  await BABA.Models.prepare({ textureScale: 1 });
  const scene = new THREE.Scene(), world = BABA.World.build(scene, { multiDraw: true }), events = [];
  const game = BABA.Game.create(world, { scene, emit: (name, data) => events.push({ name, data }), fx() {}, sound() {} });
  game.setQuality({ impact: 0 });
  const combatRoot = game.player.model.root.parent;
  const marker = name => combatRoot.getObjectByName(name);
  const snapshot = () => { const s = game.debug.snapshot(); delete s.sceneChildren; return s; };
  assert.equal(marker('MoveMark'), undefined); assert.equal(marker('TargetRing'), undefined);
  const initial = snapshot(), eventCount = events.length, children = combatRoot.children.length;
  assert.equal(game.prepareGraphics(), true);
  assert.deepEqual(snapshot(), initial, 'Preparing graphics cannot start combat, move actors, spend resources, select targets or change clocks');
  assert.equal(events.length, eventCount, 'Preparation has no gameplay events');
  assert.equal(combatRoot.children.length, children + 2);
  const move = marker('MoveMark'), target = marker('TargetRing');
  for (const ring of [move, target]) {
    assert(ring.isMesh && ring.geometry.isBufferGeometry && ring.material.isMeshBasicMaterial);
    assert.equal(ring.visible, false); assert.equal(ring.material.opacity, 0);
    assert.equal(ring.rotation.x, -Math.PI / 2); assert.equal(ring.material.depthWrite, false);
    assert.equal(ring.material.side, THREE.DoubleSide); assert.equal(ring.material.blending, THREE.AdditiveBlending);
  }
  assert.equal(game.prepareGraphics(), true);
  assert.equal(marker('MoveMark'), move); assert.equal(marker('TargetRing'), target);
  assert.equal(combatRoot.children.length, children + 2, 'Quality changes reuse the prepared objects');
  const geometryIds = [move.geometry.id, target.geometry.id], materialIds = [move.material.id, target.material.id];
  game.restart(); game.debug.invincible(true);
  const foe = game.enemies[0];
  game.update(1 / 120, { target: foe });
  assert.equal(game.player.target, foe); assert.equal(target.visible, true); assert(target.material.opacity > 0);
  game.update(1 / 120, { clickLight: true, target: foe });
  assert.equal(game.attackTarget, foe); assert.equal(target.visible, true);
  game.update(1 / 120, { clickLight: true, pointX: 2, pointZ: 4 });
  assert.equal(move.visible, true); assert.equal(target.visible, false); assert(move.material.opacity > 0);
  assert.equal(move.position.x, 2); assert.equal(move.position.z, 4);
  assert.deepEqual([move.geometry.id, target.geometry.id], geometryIds, 'First hover/target/click reuses uploaded geometry');
  assert.deepEqual([move.material.id, target.material.id], materialIds, 'First hover/target/click reuses compiled material');
  const playing = snapshot(), moveOpacity = move.material.opacity;
  game.prepareGraphics(); assert.deepEqual(snapshot(), playing); assert.equal(move.visible, true); assert.equal(move.material.opacity, moveOpacity, 'Rewarming cannot hide an active marker');
  for (let i = 0; i < 65; i++) game.update(1 / 120, { x: 1 });
  assert.equal(move.visible, false, 'Ended movement orders retain their ordinary fade');
  const showMove = () => { game.update(1 / 120, { clickLight: true, pointX: game.player.x + 1, pointZ: game.player.z - 1 }); assert.equal(move.visible, true); };
  game.restart(); showMove(); game.restart(); assert.equal(move.visible, false, 'Restart immediately clears old movement marks');
  showMove(); game.toTitle(); assert.equal(move.visible, false); assert.equal(target.visible, false);
  game.start(); showMove(); game.debug.invincible(false); game.debug.setPlayer({ hp: 1 }); game.debug.strike({ damage: 1000, unblockable: true });
  assert.equal(game.state, 'dead'); assert.equal(move.visible, false); assert.equal(target.visible, false);
  game.respawn(); game.debug.invincible(true); showMove(); game.debug.damageEnemy(game.boss.id, 10000);
  assert.equal(game.state, 'won'); assert.equal(move.visible, false); assert.equal(target.visible, false);
  const disposed = [0, 0, 0, 0]; [move.geometry, move.material, target.geometry, target.material].forEach((asset, i) => asset.addEventListener('dispose', () => disposed[i]++));
  game.dispose(); game.dispose(); assert.deepEqual(disposed, [1, 1, 1, 1]); assert.equal(game.prepareGraphics(), false, 'Disposed games cannot recreate graphics');
  // A caller without a loader keeps the original lazy behavior.
  const lazy = BABA.Game.create(world, { scene, emit() {}, fx() {}, sound() {} }); lazy.restart(); lazy.setQuality({ impact: 0 });
  assert.equal(lazy.player.model.root.parent.getObjectByName('MoveMark'), undefined);
  lazy.update(1 / 120, { clickLight: true, pointX: 2, pointZ: 4 }); assert(lazy.player.model.root.parent.getObjectByName('MoveMark').visible);
  lazy.update(1 / 120, { target: lazy.enemies[0] }); assert(lazy.player.model.root.parent.getObjectByName('TargetRing').visible);
  lazy.dispose(); world.dispose();
  console.log('PASS: invisible idempotent marker preparation, unchanged gameplay, first hover/click reuse, live rewarm, reset/death/victory cleanup, disposal and lazy fallback; no GPU/audio.');
})().catch(error => { console.error(error); process.exitCode = 1; });
