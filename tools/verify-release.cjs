'use strict';
// Node only, no install or browser needed. This does not measure gameplay FPS.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html'), credits = read('credits.html'), css = read('src/ui.css');
const versions = new Set([...html.matchAll(/[?&]v=(\d+)/g)].map(m => m[1]));
assert.equal(versions.size, 1, 'index.html: asset versions differ');
const version = [...versions][0];
let references = 0, scripts = 0;
function localRef(raw, base = '') {
  if (!raw || /^(?:data:|https?:|#)/i.test(raw)) return;
  const clean = decodeURIComponent(raw.split(/[?#]/)[0]);
  const file = path.resolve(root, base, clean), relative = path.relative(root, file);
  assert(!relative.startsWith('..') && !path.isAbsolute(relative), 'reference escapes the game: ' + raw);
  assert(fs.existsSync(file), 'missing asset: ' + raw); references++;
  return relative.replace(/\\/g, '/');
}
const cached = new Set(), swEnv = { self: { addEventListener() {} } };
vm.runInNewContext(read('sw.js') + ';globalThis.assets=FILES;globalThis.name=CACHE;', swEnv);
assert.equal(swEnv.name, 'kara-gecit-v' + version, 'service-worker version differs');
for (const asset of swEnv.assets) {
  assert(!cached.has(asset), 'duplicate precache entry: ' + asset); cached.add(asset); localRef(asset);
  if (/\.(js|css)\?/.test(asset)) assert(asset.endsWith('?v=' + version), 'precache script/style version differs: ' + asset);
}
for (const [file, source] of [['index.html', html], ['credits.html', credits]]) {
  for (const m of source.matchAll(/(?:src|href)="([^"<>]+)"/g)) {
    const relative = localRef(m[1]);
    if (relative && /\.(?:js|css|webp|png|svg)$/.test(relative)) {
      assert(cached.has('./' + m[1].replace(/^\.\//, '')), 'not precached: ' + file + ' → ' + m[1]);
    }
  }
  let n = 0;
  for (const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=/.test(m[1])) new vm.Script(m[2], { filename: file + '#inline' + (++n) });
  }
}
for (const m of css.matchAll(/url\((['"]?)(.*?)\1\)/g)) localRef(m[2], 'src');
function parseScripts(dir) {
  for (const file of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, file.name);
    if (file.isDirectory()) parseScripts(relative);
    else if (/\.js$/.test(file.name)) { new vm.Script(read(relative), { filename: relative }); scripts++; }
  }
}
for (const dir of ['src', 'vendor', 'assets/characters']) parseScripts(dir);
new vm.Script(read('sw.js'), { filename: 'sw.js' });
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.name, 'Kabir Azabı');
for (const [file, size] of [['icons/apple-touch-icon.png', 180], ['icons/icon-192.png', 192], ['icons/icon-512.png', 512]]) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.readUInt32BE(16), size, file + ' width'); assert.equal(data.readUInt32BE(20), size, file + ' height');
}
for (const icon of manifest.icons) localRef(icon.src);
assert(/k\.startsWith\('kara-gecit-'\)/.test(read('sw.js')), 'cache cleanup must stay scoped to this game');
const app = read('src/app.js');
for (const m of app.matchAll(/img\.src\s*=\s*['"](assets\/[^'"]+)['"]/g)) {
  localRef(m[1]); assert(cached.has('./' + m[1]), 'dynamic portrait is not precached: ' + m[1]);
}
assert(app.includes('build: ' + version + ','), 'performance report build differs');
assert(app.includes("Q.has('gpums')"), 'opt-in measurement path missing');
console.log(`PASS v${version}: ${scripts} runtime scripts + inline scripts parse; ${references} local references exist; ${cached.size} unique offline assets; version and icon sizes agree. No GPU/browser/FPS test.`);
