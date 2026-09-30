'use strict';
// Actual service-worker handlers with in-memory storage/network. No browser,
// server, external requests or speakers; run with Node 18 or newer.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const base = 'https://goktugkarpat.github.io/bahtiyar-kabir-azabi/';
const buckets = new Map(), handlers = {}, deleted = [], calls = [];
let mode = 'online', readFail = false, writeFail = false, openFail = false, claims = 0, skips = 0;
const key = q => new URL(typeof q === 'string' ? q : q.url, base).href;
function cache(name) {
  if (!buckets.has(name)) buckets.set(name, new Map());
  const data = buckets.get(name);
  return {
    async addAll(files) { for (const file of files) data.set(key(file), new Response('cached:' + file)); },
    async put(q, response) { if (writeFail) throw new Error('QuotaExceededError'); data.set(key(q), response); }
  };
}
const environment = {
  URL, Response, location: { origin: new URL(base).origin },
  self: {
    addEventListener(name, fn) { handlers[name] = fn; },
    skipWaiting() { skips++; }, clients: { claim() { claims++; } }
  },
  caches: {
    async open(name) { if (openFail) throw new Error('storage unavailable'); return cache(name); },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { deleted.push(name); return buckets.delete(name); },
    async match(q) {
      if (readFail) throw new Error('cache read unavailable');
      for (const data of buckets.values()) if (data.has(key(q))) return data.get(key(q)).clone();
    }
  },
  async fetch(q) {
    calls.push(key(q)); if (mode === 'offline') throw new Error('network unavailable');
    return new Response('network:' + new URL(q.url).pathname, { status: mode === '503' ? 503 : 200 });
  }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8') +
  ';globalThis.name=CACHE;globalThis.files=FILES;', environment);
function lifecycle(name) {
  let pending; handlers[name]({ waitUntil(promise) { pending = promise; } });
  assert(pending); return pending;
}
async function get(file, mode = 'same-origin', method = 'GET') {
  let pending;
  handlers.fetch({ request: { url: new URL(file, base).href, method, mode }, respondWith(promise) { pending = promise; } });
  return pending ? await pending : null;
}
(async () => {
  cache('huysuzlar-v12'); cache('kara-gecit-obsolete');
  await lifecycle('install'); assert.equal(skips, 1);
  assert.equal(buckets.get(environment.name).size, environment.files.length);
  await lifecycle('activate'); assert.equal(claims, 1);
  assert(buckets.has('huysuzlar-v12')); assert.deepEqual(deleted, ['kara-gecit-obsolete']);
  const script = environment.files.find(file => file.includes('src/app.js'));
  assert.equal(await (await get(script)).text(), 'cached:' + script); assert.equal(calls.length, 0);
  assert((await (await get('index.html', 'navigate')).text()).startsWith('network:')); assert.equal(calls.length, 1);
  mode = 'offline';
  for (const file of environment.files) {
    const response = await get(file, file === './' || /html$/.test(file) ? 'navigate' : 'same-origin');
    assert(response && response.ok, 'Offline missing ' + file);
  }
  assert((await (await get('index.html?sessiz', 'navigate')).text()).startsWith('network:'));
  assert.equal(await (await get('credits.html', 'navigate')).text(), 'cached:./credits.html');
  assert.equal((await get('missing.bin')).type, 'error');
  assert.equal(await get('https://elsewhere.example/a.js'), null);
  assert.equal(await get('index.html', 'same-origin', 'POST'), null);
  mode = '503'; assert.equal((await get('index.html', 'navigate')).status, 503);
  mode = 'online'; writeFail = true;
  assert.equal((await get('new-live.js')).status, 200, 'cache quota must not lose a successful response');
  writeFail = false; readFail = true;
  assert.equal((await get('new-live.js')).status, 200, 'cache read failure must still try the network');
  readFail = false; openFail = true;
  assert.equal((await get('another-live.js')).status, 200, 'cache opening failure must not lose the response');
  console.log(`PASS ${environment.name}: ${environment.files.length} offline assets, navigation/cache policies, own-cache cleanup and storage failures. Worker VM only; no browser/GPU.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
