'use strict';
// Inert DOM regression: no browser, timers, WebGL or audio.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = process.argv[2] || path.resolve(__dirname, '..');
const writes = { create: 0, append: 0, remove: 0, attribute: 0, classes: 0, text: 0 };
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attributes = new Map(); this._classes = ''; this._text = ''; }
  appendChild(child) {
    writes.append++; if (child.parentNode) child.remove(); this.children.push(child); child.parentNode = this; return child;
  }
  remove() {
    writes.remove++; if (!this.parentNode) return;
    this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null;
  }
  setAttribute(name, value) { writes.attribute++; this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  set className(value) { writes.classes++; this._classes = value; }
  get className() { return this._classes; }
  get classList() {
    return {
      contains: name => this._classes.split(/\s+/).includes(name),
      toggle: (name, force) => {
        writes.classes++; const classes = new Set(this._classes.split(/\s+/).filter(Boolean));
        const add = force === undefined ? !classes.has(name) : !!force;
        if (add) classes.add(name); else classes.delete(name); this._classes = [...classes].join(' '); return add;
      }
    };
  }
  set textContent(value) { writes.text++; this._text = String(value); }
  get textContent() { return this._text; }
  set innerHTML(value) { throw Error('Buff rendering must never parse HTML.'); }
}
global.window = global;
global.document = { createElement(tag) { writes.create++; return new Element(tag); } };
vm.runInThisContext(fs.readFileSync(path.join(root, 'src/buffs.js'), 'utf8'), { filename: 'src/buffs.js' });
const container = new Element('section'), otherContainer = new Element('section');
const buffs = BABA.Buffs.create(container), otherBuffs = BABA.Buffs.create(otherContainer);
const rage = (remaining, extras = {}) => ({ id: 'rage', name: 'Kan Öfkesi', icon: 'rage', remaining, duration: 11, ...extras });
const shield = (remaining, extras = {}) => ({ id: 'shield', name: 'Kemik Zırhı', icon: 'heavy', remaining, duration: 8, ...extras });
const box = id => container.children.find(node => node.getAttribute('data-buff-id') === id);
const snapshot = () => ({ ...writes });

buffs.update([rage(10.9), shield(7.5)]);
assert.equal(container.children.length, 2, 'Distinct simultaneous effects each have one box');
const rageBox = box('rage'), shieldBox = box('shield');
assert.equal(rageBox.children[0].className, 'skill rage'); assert.equal(rageBox.children[1].textContent, '11');
assert.equal(shieldBox.children[1].textContent, '8');
assert.equal(rageBox.getAttribute('role'), 'listitem'); assert(rageBox.getAttribute('title').includes('Kan Öfkesi · 11 sn kaldı'));
assert.equal(rageBox.getAttribute('title'), rageBox.getAttribute('aria-label'));
assert(rageBox.children.every(node => node.getAttribute('aria-hidden') === 'true'));

let before = snapshot(); buffs.update([shield(7.01), rage(10.01)]);
assert.deepEqual(writes, before, 'Stable names/icons/integer seconds do not add, remove or rewrite DOM, even if input order changes');
assert.strictEqual(box('rage'), rageBox); assert.strictEqual(box('shield'), shieldBox);
assert.deepEqual(container.children, [rageBox, shieldBox], 'Existing boxes preserve insertion order');
before = snapshot(); buffs.update([rage(10), shield(7.01)]);
assert.equal(writes.text - before.text, 1, 'Only the changed integer countdown gets a text write');
assert.equal(writes.attribute - before.attribute, 2, 'Only that countdown updates its tooltip and accessible name');
assert.equal(writes.classes, before.classes); assert.equal(writes.append, before.append); assert.equal(writes.remove, before.remove);
assert.equal(rageBox.children[1].textContent, '10');

buffs.update([rage(3.01), shield(7)]); assert(!rageBox.classList.contains('expiring'));
before = snapshot(); buffs.update([rage(3), shield(7)]);
assert(rageBox.classList.contains('expiring')); assert.equal(rageBox.children[1].textContent, '3');
assert.equal(writes.classes - before.classes, 1, 'Only the effect reaching its last three seconds changes the expiry class');
before = snapshot(); buffs.update([rage(2.9), shield(6.99)]);
assert.deepEqual(writes, before, 'Fractional countdown changes remain inert in the last three seconds');
buffs.update([rage(.01), shield(6)]); assert.equal(rageBox.children[1].textContent, '1');
buffs.update([rage(0), shield(6)]); assert.equal(box('rage'), undefined); assert.equal(container.children.length, 1);
before = snapshot(); buffs.update([rage(-1), shield(5.99)]); assert.deepEqual(writes, before, 'Expired effects stay absent without repeated removal');
buffs.update([rage(11)]); assert.equal(box('shield'), undefined, 'Omitting an id removes its old box');
assert.notStrictEqual(box('rage'), rageBox, 'A new activation gets a fresh box after expiry');
assert(!box('rage').classList.contains('expiring'), 'A new activation resets the last-seconds warning');

buffs.update([rage(10), rage(2)]); assert.equal(container.children.length, 1); assert.equal(box('rage').children[1].textContent, '2');
assert(box('rage').classList.contains('expiring'), 'The last duplicate id supplies the current value');
buffs.update([rage(10), rage(0)]); assert.equal(container.children.length, 0, 'An expired last duplicate overrides an earlier active entry');
buffs.update([rage(0), rage(10)]); assert.equal(container.children.length, 1);
buffs.update([rage(NaN)]); assert.equal(container.children.length, 0);
buffs.update([rage(Infinity), rage(10, { id: '' }), null, shield(4)]); assert.equal(container.children.length, 1);

// Names/ids are plain text and arbitrary icon text cannot become CSS classes or executable markup.
buffs.update([rage(2, { id: '__proto__', name: '<img src=x onerror=alert(1)>', icon: 'rage hidden" onclick="alert(1)' })]);
const unsafe = box('__proto__'); assert.equal(unsafe.children[0].className, 'skill'); assert.equal(unsafe.children.length, 2);
assert(unsafe.getAttribute('title').startsWith('<img src=x onerror=alert(1)> · 2 sn kaldı'));
assert.equal(unsafe.getAttribute('title'), unsafe.getAttribute('aria-label'));
before = snapshot(); buffs.update([rage(1.1, { id: '__proto__', name: '<img src=x onerror=alert(1)>', icon: 'rage hidden" onclick="alert(1)' })]);
assert.deepEqual(writes, before, 'Sanitized entries also avoid repeated DOM writes');

buffs.update([rage(3, { name: '', icon: 'special', duration: 0 })]); assert(box('rage').getAttribute('aria-label').startsWith('Süreli etki · 3 sn kaldı'));
buffs.update([rage(11, { name: 'Yenilenen Kan Öfkesi', icon: 'flask' })]);
assert.strictEqual(box('rage').children[0].className, 'skill flask'); assert(!box('rage').classList.contains('expiring'));
assert(box('rage').getAttribute('title').includes('Yenilenen Kan Öfkesi · 11 sn kaldı'));
otherBuffs.update([shield(6)]); buffs.clear(); assert.equal(container.children.length, 0); assert.equal(otherContainer.children.length, 1, 'Instances never clear each other');
before = snapshot(); buffs.clear(); assert.deepEqual(writes, before, 'Clearing an empty renderer does no DOM work');
buffs.update([rage(11)]); assert.equal(container.children.length, 1, 'The renderer can be reused after clear');
buffs.update(undefined); assert.equal(container.children.length, 0);
assert.throws(() => BABA.Buffs.create(null), TypeError);
otherBuffs.clear();
console.log('ALL BUFFS: PASS (two effects, keyed reuse, integer-only writes, expiry, cleanup, duplicate ids, resets, safe labels/icons; inert DOM)');
