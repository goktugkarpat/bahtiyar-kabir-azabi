'use strict';
// Actual warning UI and hazard clocks, using bundled Three camera math.
// CPU/mock DOM only; no browser, GPU, network or audio output.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const combat = fs.readFileSync(path.join(root, 'src/combat.js'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, 'Missing actual source section: ' + start);
  return source.slice(a, b);
}
function node() {
  const n = {
    children: [], classes: new Set(), style: { setProperty(k, v) { this[k] = v; } },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    remove() { this.removed = true; },
    set innerHTML(value) { this.children = [node()]; },
    get firstElementChild() { return this.children[0]; }
  };
  n.classList = {
    toggle(k, value) { value ? n.classes.add(k) : n.classes.delete(k); },
    remove(...keys) { keys.forEach(k => n.classes.delete(k)); },
    add(...keys) { keys.forEach(k => n.classes.add(k)); }
  };
  return n;
}
const nodes = new Map();
const ctx = {
  console, location: { search: '?sessiz' }, innerWidth: 1920, innerHeight: 1080,
  document: {
    createElement: node,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }
  }
};
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'vendor/three.js'), 'utf8'), ctx);
const warning = between(app, '  const warnings = []', '  /* ───────────── Game events');
const clear = between(app, '  function clearNotices()', '  function announce(');
const hazard = between(combat, '    function addHazard(', '    // Soft pooled light');
const updates = between(combat, '    function updateHazards(dt)', '    function queueInput(');
assert(app.includes('    syncWarnings(dt);') && app.includes('      drawWarnings();'));

vm.runInContext(`
let played = 0, view = 'playing';
const B = { Audio: { silent: true, play() { played++; } } };
const buffUI = { clear() {} }; // This harness isolates warning geometry/clocks from timed-effect DOM.
const targetUI = { clear() {} }; // The attacked-enemy card has its own browser/state checks.
const $ = id => document.getElementById(id), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 300), projected = new THREE.Vector3();
camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
const hazards = [], player = { x: 0, z: 0 }, game = { state: 'playing', hazards, player };
const NEAR = 9, TELL_LEAD = .18;
let hazardSerial = 0, flash = 0, shake = 0, hitPause = 0, ragePush = 0, lastFootfall = 0;
const cameraKick = { x: 0, z: 0, vx: 0, vz: 0 }, cameraLead = new THREE.Vector3();
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sound = () => {}, fx = () => {}, playerInside = () => false;
const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
function emit(name, data) { if (name === 'warning') warn(data); }
${warning}
${clear}
${hazard}
${updates}
globalThis.api = {
  addHazard, cancelHazards, cancelHidden, syncWarnings, drawWarnings, updateHazards,
  warn, projectWarning, projected, warningClip, hazards, warnings, clearNotices, game,
  getPlayed: () => played, setView: value => view = value,
  reset() { clearHazards(); clearNotices(); played = 0; view = 'playing'; game.state = 'playing'; }
};`, ctx);

const a = ctx.api, cases = [];
function check(label, test) { a.reset(); test(); cases.push(label); }
const owner = { x: 35, z: 0, dead: false };
check('carrier 2.35s warning lasts until contact', () => {
  const corpse = { ...owner, dead: true };
  const h = a.addHazard({ owner: corpse, x: 35, z: 0, radius: 3.35, warn: 2.35, duration: .24,
    damage: 32, unblockable: true, persistent: true, style: 'bile', fill: 'inward', burst: true });
  assert.equal(a.warnings[0].hazard, h);
  for (let i = 0; i < 131; i++) { a.updateHazards(.01); a.syncWarnings(.01); a.drawWarnings(); }
  assert(h.age < h.warn && !h.active);
  assert.equal(a.warnings.length, 1); assert.equal(a.getPlayed(), 1);
  assert.equal(a.warnings[0].time, h.warn - h.age);
  h.age = 2.1; a.syncWarnings(.01); a.drawWarnings();
  assert(a.warnings[0].el.classes.has('late'));
  h.age = h.warn; a.syncWarnings(.01);
  assert.equal(a.warnings.length, 0);
});
check('cancelled pending attack removes warning immediately', () => {
  a.addHazard({ owner, x: 35, z: 0, damage: 30, warn: 1 }); a.drawWarnings();
  a.cancelHazards(owner, true); a.syncWarnings(.01);
  assert.equal(a.hazards.length, 0); assert.equal(a.warnings.length, 0);
});
check('active hazard clears even if its age has not advanced', () => {
  const h = a.addHazard({ owner, x: 35, z: 0, damage: 30, warn: 1 });
  h.active = true; a.syncWarnings(0); assert.equal(a.warnings.length, 0);
});
check('pause holds warning clock and hides/silences it; resume alarms once', () => {
  const h = a.addHazard({ owner, x: 35, z: 0, damage: 30, warn: 1 });
  h.age = .1; a.setView('pause');
  for (let i = 0; i < 150; i++) { a.syncWarnings(.01); a.drawWarnings(); }
  assert.equal(h.age, .1); assert.equal(a.warnings.length, 1);
  assert.equal(a.warnings[0].time, .9); assert.equal(a.warnings[0].el.style.visibility, 'hidden');
  assert.equal(a.getPlayed(), 0);
  a.setView('playing'); a.drawWarnings(); a.drawWarnings(); assert.equal(a.getPlayed(), 1);
});
check('boss delay 1.3/warn 1 tracks its new origin and alarms when tell begins', () => {
  const o = { x: 35, z: 0, face: .5, dead: false };
  const h = a.addHazard({ owner: o, x: 35, z: 0, damage: 26, warn: 1, delay: 1.3, track: true });
  a.syncWarnings(.01); a.drawWarnings();
  assert.equal(a.warnings[0].el.style.visibility, 'hidden'); assert.equal(a.getPlayed(), 0);
  for (let i = 0; i < 129; i++) { a.updateHazards(.01); a.syncWarnings(.01); a.drawWarnings(); }
  assert(h.age < 0); assert.equal(a.getPlayed(), 0);
  o.x = 40; a.updateHazards(.02); a.syncWarnings(.02); a.drawWarnings();
  assert(h.age >= 0 && h.age < h.warn); assert.equal(a.warnings[0].x, 40);
  assert.equal(a.warnings.length, 1); assert.equal(a.getPlayed(), 1);
});
check('onscreen attack is retained, then alarms once after moving offscreen', () => {
  const h = a.addHazard({ owner: { x: 0, z: 0 }, x: 0, z: 0, damage: 30, warn: 1 });
  a.syncWarnings(.01); a.drawWarnings();
  assert.equal(a.warnings.length, 1); assert.equal(a.warnings[0].el.style.visibility, 'hidden');
  assert.equal(a.getPlayed(), 0);
  h.x = 35; a.syncWarnings(.01); a.drawWarnings();
  assert.equal(a.warnings[0].el.style.visibility, ''); assert.equal(a.getPlayed(), 1);
  h.x = 0; a.syncWarnings(.01); a.drawWarnings();
  h.x = 35; a.syncWarnings(.01); a.drawWarnings(); assert.equal(a.getPlayed(), 1);
});
for (const state of ['dead', 'won', 'ready']) check(state + ' clears warning immediately', () => {
  a.addHazard({ owner, x: 35, z: 0, damage: 30, warn: 1 });
  a.game.state = state; a.syncWarnings(.01); assert.equal(a.warnings.length, 0);
});
check('respawn clearNotices helper removes records and DOM', () => {
  a.addHazard({ owner, x: 35, z: 0, damage: 30, warn: 1 });
  const el = a.warnings[0].el; a.clearNotices();
  assert(el.removed); assert.equal(a.warnings.length, 0);
});
check('cancelled hidden feint removes record without an alarm', () => {
  a.addHazard({ owner, x: 35, z: 0, damage: 30, warn: 1, delay: .5 });
  a.cancelHidden(owner); a.syncWarnings(.01); a.drawWarnings();
  assert.equal(a.warnings.length, 0); assert.equal(a.getPlayed(), 0);
});
check('phase 2 informational warning keeps 1.3s fallback and pauses', () => {
  a.warn({ x: 35, z: 0, text: 'ZİNCİR CELLADI · KANLI YEMİN' }); a.drawWarnings();
  assert.equal(a.getPlayed(), 1);
  a.setView('pause'); a.syncWarnings(2); assert.equal(a.warnings.length, 1);
  a.setView('playing'); a.syncWarnings(1.31); assert.equal(a.warnings.length, 0);
});
check('behind-right arrow stays right/down instead of mirroring', () => {
  a.warn({ x: 5, z: 40, text: 'behind' }); a.drawWarnings();
  assert(a.projected.x > 0 && a.projected.y < 0);
  const el = a.warnings[0].el;
  assert(parseFloat(el.style.left) > 960 && parseFloat(el.style.top) > 540);
  assert(Number.isFinite(parseFloat(el.firstElementChild.style.rotate)));
  assert.equal(el.style.visibility, '');
});
check('camera-plane guard is finite and near/far/behind depth is rejected', () => {
  assert.equal(a.projectWarning(5, 19), false);
  assert(Math.abs(a.warningClip.w) < 1e-12);
  assert(a.projected.toArray().every(Number.isFinite));
  for (const z of [18.95, 40, -10000]) assert.equal(a.projectWarning(0, z), false);
  assert.equal(a.projectWarning(0, 0), true);
});
console.log('ALL WARNINGS: PASS (' + cases.length + ' actual-source cases; bundled Three CPU, mock DOM, no GPU/browser/audio)');
