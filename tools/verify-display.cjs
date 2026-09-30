'use strict';
// Screen-size and callback scheduling regressions. No browser, WebGL or speakers.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const window = {}, context = { window };
for (const file of ['display', 'pacing']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/' + file + '.js'), 'utf8'), context);
const D = window.BABA.Display, P = window.BABA.Pacing;
const retina = { width: 1512, height: 982, pixelRatio: 2, maxSize: 16384 };
const plan = (mode, quality, view = retina) => D.plan(view, { displayVersion: D.defaults.displayVersion, displayMode: mode, quality, msaa: 0 });
assert.equal(D.defaults.displayMode, 'auto');
for (const version of [1, 2, 3]) for (const mode of ['native', 'smooth']) {
  const cfg = D.settings({ displayVersion: version, displayMode: mode, msaa: 4 });
  assert.equal(cfg.displayMode, mode); assert.equal(cfg.msaa, 4);
  for (const quality of ['low', 'medium', 'high']) {
    const ratio = D.plan(retina, { ...cfg, quality }).pixelRatio;
    assert.equal(ratio, mode === 'native' ? 2 : ({ low: 1, medium: 1.25, high: 1.5 })[quality] * .75);
  }
}
assert.equal(plan('auto', 'low').pixelRatio, 1);
assert.equal(plan('auto', 'medium').pixelRatio, 1.25);
assert.equal(plan('auto', 'high').pixelRatio, 1.5);
for (const q of ['low', 'medium', 'high']) assert.equal(plan('auto', q, { width: 2560, height: 1440, pixelRatio: 1 }).pixelRatio, 1);
for (const q of ['low', 'medium', 'high']) for (const view of [retina, { width: 1920, height: 1080, pixelRatio: 1 }]) {
  assert.equal(plan('smooth', q, view).pixelRatio, plan('auto', q, view).pixelRatio * .75);
}
const big = { width: 2560, height: 1440, pixelRatio: 2 };
assert(plan('auto', 'medium', big).width * plan('auto', 'medium', big).height <= 2500000);
assert.equal(D.settings({ displayVersion: 3, displayMode: 'balanced', msaa: 4 }).displayMode, 'auto');
assert.equal(plan('native', 'high', big).width, 5120);
const limited = plan('native', 'high', { ...big, maxSize: 2048 });
assert(limited.limited); assert.equal(limited.width, 2048); assert(limited.height <= 2048);
assert.equal(plan('auto', 'low', { width: 0, height: NaN, pixelRatio: 0 }).width, 1);
console.log('DISPLAY: Retina quality budgets, native/smooth migration, explicit choices and GPU limits PASS');
for (const hz of [60, 90, 120, 144, 165, 180, 240]) {
  for (const cap of [60, 120]) {
    const clock = P.create(); let draws = 0;
    for (let i = 0; i < hz * 10; i++) if (clock.due(37 + i * 1000 / hz, cap)) draws++;
    assert(Math.abs(draws - Math.min(cap || hz, hz) * 10) <= 2, JSON.stringify({ hz, cap, draws }));
    assert(!clock.due(37 + (hz * 10 - 1) * 1000 / hz, cap), 'duplicate callbacks must not draw twice');
    assert(clock.due(20000, cap)); assert(!clock.due(20000, cap));
  }
}
console.log('PACING: 60/90/120/144/165/180/240 Hz callbacks, frame caps and no stall backlog PASS (synthetic scheduling, not a display measurement)');
