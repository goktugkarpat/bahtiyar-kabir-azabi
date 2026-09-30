'use strict';
// Actual narration scheduler and audio-source lifecycle, in a silent VM.
// All buffers/nodes are mocks; neither a browser nor an audio device is opened.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = path.resolve(__dirname, '../src/audio.js');
const original = fs.readFileSync(file, 'utf8');
assert(original.includes('B.Audio = {'), 'The test hook must match the real audio source.');
let count = 0;

function fixture(recorded = false) {
  const captions = [], sources = [], targets = [];
  const keys = ['intro', 'chains', 'ritual', 'crypt', 'rot', 'checkpoint', 'heroOath', 'boss', 'cellat', 'death', 'death2', 'death3', 'win', 'seal'];
  const lines = Object.fromEntries(keys.map(key => [key, { text: key, audio: 'YQ==', duration: key === 'intro' ? 30 : 8 }]));
  const window = { BABA: { Narration: lines }, AudioContext() { throw Error('Real audio contexts are forbidden in this test.'); } };
  const sandbox = { window, location: { search: '?sessiz' }, URLSearchParams, console, Date, Math, WeakMap, Set, Promise, Object, Number, Uint8Array, Float32Array, atob, setTimeout };
  // Expose the actual private scheduler, rather than copying its implementation.
  // Offline mode allows the injected fake source to exercise start/onended logic.
  const injection = `B.__qa = { step: narrationStep, inject(c, nodes, buffers) { ctx = c; N = nodes; offline = true; unlocked = true; Object.assign(voiceBuffers, buffers); } };\n  B.Audio = {`;
  vm.runInNewContext(original.replace('B.Audio = {', injection), sandbox, { filename: file });
  const B = window.BABA;
  B.Audio.onCaption(text => captions.push(text));
  let ctx;
  if (recorded) {
    const param = () => ({ setTargetAtTime(value, at, tc) { targets.push({ value, at, tc }); } });
    const node = () => ({ gain: param(), connect() {}, disconnect() {} });
    ctx = { currentTime: 0, state: 'running', createGain: node, createBufferSource() {
      const source = { stops: 0, starts: 0, connect() {}, disconnect() {}, start() { this.starts++; }, stop() { this.stops++; }, end() { this.onended(); } };
      sources.push(source); return source;
    } };
    B.__qa.inject(ctx, { voice: node(), musicDuck: node(), ambDuck: node(), warningDuck: node() }, Object.fromEntries(keys.map(key => [key, { duration: lines[key].duration }])));
  }
  return { B, captions, sources, targets, ctx, tick(dt, combat = false) { B.__qa.step(dt, { combat, playing: true }); }, debug: () => B.Audio.debug() };
}

function check(label, run) { run(); count++; console.log('PASS ' + label); }
check('combat and attack cues keep a started subtitle to completion', () => {
  const f = fixture(); f.B.Audio.say('chains'); f.tick(.01); f.B.Audio.play('enemyWindup');
  f.tick(4, true); assert.equal(f.debug().current, 'chains'); assert.deepEqual(f.captions, ['chains']);
  f.tick(4.2, true); assert.equal(f.debug().current, null); assert.deepEqual(f.captions, ['chains', '']);
});
check('room changes replace only pending room lines', () => {
  const f = fixture(); f.B.Audio.say('chains'); f.tick(.01); f.B.Audio.say('ritual'); f.B.Audio.say('crypt');
  assert.equal(f.debug().current, 'chains'); assert.deepEqual(Array.from(f.debug().queue), ['crypt']);
  f.tick(8.2); assert.equal(f.debug().current, 'crypt'); assert.deepEqual(f.captions, ['chains', '', 'crypt']);
});
check('death waits for the whole current sentence, then starts despite combat', () => {
  const f = fixture(); f.B.Audio.say('intro'); f.tick(.01); f.B.Audio.say('crypt'); f.B.Audio.say('death', true);
  assert.equal(f.debug().current, 'intro'); assert.deepEqual(Array.from(f.debug().queue), ['death']);
  f.tick(21, true); assert.equal(f.debug().current, 'intro'); assert.deepEqual(Array.from(f.debug().queue), ['death']);
  f.tick(10, true); assert.equal(f.debug().current, 'death'); assert.deepEqual(f.captions, ['intro', '', 'death']);
});
check('victory preserves the current sentence and supersedes waiting lines', () => {
  const f = fixture(); f.B.Audio.say('chains'); f.tick(.01); f.B.Audio.say('ritual'); f.B.Audio.say('win', true);
  assert.equal(f.debug().current, 'chains'); assert.deepEqual(Array.from(f.debug().queue), ['win']);
  f.tick(8.2); assert.equal(f.debug().current, 'win');
});
check('new journey drops old pending lines while a started line finishes', () => {
  const f = fixture(); f.B.Audio.say('chains'); f.tick(.01); f.B.Audio.say('ritual'); f.B.Audio.resetNarration(); f.B.Audio.say('intro');
  assert.equal(f.debug().current, 'chains'); assert.deepEqual(Array.from(f.debug().queue), ['intro']);
  f.tick(8.2); assert.equal(f.debug().current, 'intro'); assert.deepEqual(f.captions, ['chains', '', 'intro']);
});
check('same started sentence cannot be queued twice even across resets', () => {
  const f = fixture(); f.B.Audio.say('intro'); f.tick(.01); f.B.Audio.resetNarration(); f.B.Audio.say('intro');
  assert.equal(f.debug().current, 'intro'); assert.deepEqual(Array.from(f.debug().queue), []);
});
check('checkpoint narrator and hero dialogue retains sequence', () => {
  const f = fixture(); f.B.Audio.say('intro'); f.tick(.01); f.B.Audio.saySequence(['checkpoint', 'heroOath']);
  f.tick(30.2); assert.equal(f.debug().current, 'checkpoint'); f.tick(8.2); assert.equal(f.debug().current, 'heroOath');
});
check('boss and executioner dialogue retains sequence', () => {
  const f = fixture(); f.B.Audio.say('chains'); f.tick(.01); f.B.Audio.say('ritual'); f.B.Audio.saySequence(['boss', 'cellat']);
  assert.deepEqual(Array.from(f.debug().queue), ['boss', 'cellat']);
  f.tick(8.2); assert.equal(f.debug().current, 'boss'); f.tick(8.2); assert.equal(f.debug().current, 'cellat');
});
check('pending calm narration waits through combat', () => {
  const f = fixture(); f.B.Audio.say('crypt'); f.tick(4, true); assert.equal(f.debug().current, null);
  f.tick(.01); assert.equal(f.debug().current, 'crypt');
});
check('recorded audio completion follows its source, never a drifting game timer', () => {
  const f = fixture(true); f.B.Audio.say('chains'); f.tick(.01); const source = f.sources[0];
  f.B.Audio.play('tellCommit', { style: 'chain' }); f.B.Audio.say('death', true); f.tick(200, true);
  assert.equal(f.debug().current, 'chains'); assert.equal(source.starts, 1); assert.equal(source.stops, 0);
  assert.deepEqual(Array.from(f.debug().queue), ['death']); source.end(); assert.equal(f.debug().current, null);
  f.tick(.01, true); assert.equal(f.debug().current, 'death'); assert.equal(f.sources.length, 2); assert.deepEqual(f.captions, ['chains', '', 'death']);
});
check('recorded line survives a reset and urgent warning with no stop call', () => {
  const f = fixture(true); f.B.Audio.say('intro'); f.tick(.01); f.B.Audio.play('tellCommit', { style: 'chain' });
  assert.ok(f.targets.some(e => e.value === .65));
  f.B.Audio.resetNarration(); f.B.Audio.say('win', true); f.tick(32, true);
  assert.equal(f.debug().current, 'intro'); assert.equal(f.sources[0].stops, 0); assert.equal(f.sources.length, 1);
  f.sources[0].end(); f.tick(.01, true); assert.equal(f.debug().current, 'win');
});
console.log(count + ' actual-source narration cases passed; mocked buffers only, no audio device created.');
