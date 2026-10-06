/* KABİR AZABI — Atlas: a painted cartography of the real collision footprint, a soft fog of war that lifts where
   Bahtiyar has walked, chapter-specific map art (stone tablet, sea chart, gilded bone, forge iron, sealed ledger),
   quest/POI medallions, a tracked route, and the HUD minimap. Everything heavy is raster-cached:
   - terrain: one world-space image built once (under the loading cover) from a signed distance field of isWalkable;
   - mask: a 1 px/unit canvas stamped with soft discs along the hero's trail;
   - composed: terrain × mask (+ a faint mist on the frontier) rebuilt only when the mask changes.
   The full-screen map and the minimap only blit the composed image and stamp small cached sprites. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const tr = s => KabirI18n.t(s);
  const TITLES = [tr('Kurban Tapınağı'), tr('Boğulmuş Kıyı'), tr('Sessiz Taht'), tr('Kızıl Ocak'), tr('Son Mahkeme')];
  const STORAGE = 'kabir-azabi-atlas-v1', MINI_STORAGE = 'kabir-azabi-minimap-v1';
  const REVEAL = 13.5, FRONTIER = 26, CORE = 5, TRAIL_MAX = 3000;
  // Chapter cartography. Colours are [r,g,b]; outside = how the void beyond walls is drawn.
  const STYLES = {
    1: { name: 'tablet', bg: [15, 14, 12], bg2: [38, 34, 28], floor: [124, 112, 90], floor2: [88, 78, 62], grout: [46, 40, 31], wall: [226, 204, 158], hatch: [122, 106, 80], out: 'hatch', pattern: 'flag', tile: 2.4,
      label: '#ecd8aa', side: '#bdc9a8', accent: '#d9a85c', route: '#f2c66b', mist: [128, 118, 100], ink: '#100d0a', motif: 'tablet' },
    2: { name: 'chart', bg: [8, 17, 22], bg2: [20, 42, 50], floor: [140, 132, 106], floor2: [100, 100, 86], grout: [64, 66, 58], wall: [218, 230, 216], hatch: [96, 150, 158], out: 'contours', pattern: 'sand', tile: 2.2,
      label: '#e9eedc', side: '#acd0ca', accent: '#7fc4c6', route: '#ecd98c', mist: [96, 130, 136], ink: '#06100f', motif: 'chart' },
    3: { name: 'gilded', bg: [13, 11, 9], bg2: [34, 27, 15], floor: [138, 124, 98], floor2: [102, 90, 68], grout: [160, 124, 62], wall: [240, 202, 112], hatch: [156, 120, 56], out: 'gild', pattern: 'marble', tile: 3.2,
      label: '#f4dca2', side: '#d3bf92', accent: '#e8b85a', route: '#ffd47c', mist: [124, 108, 82], ink: '#0e0a05', motif: 'gilded' },
    4: { name: 'forge', bg: [14, 9, 8], bg2: [44, 19, 10], floor: [102, 92, 86], floor2: [70, 63, 60], grout: [30, 26, 24], wall: [255, 158, 86], hatch: [150, 62, 30], out: 'ember', pattern: 'plate', tile: 2.6,
      label: '#ffd6a6', side: '#e6ae88', accent: '#ff8a3c', route: '#ffc472', mist: [128, 76, 54], ink: '#0d0604', motif: 'forge' },
    5: { name: 'void', bg: [8, 7, 13], bg2: [26, 19, 38], floor: [152, 142, 122], floor2: [118, 108, 92], grout: [96, 78, 104], wall: [238, 226, 204], hatch: [124, 96, 176], out: 'void', pattern: 'ledger', tile: 1.15,
      label: '#f1e6ca', side: '#cbbbe9', accent: '#b79cff', route: '#f3d98a', mist: [96, 84, 128], ink: '#0b0812', motif: 'ledger' }
  };
  const KIND_COLOR = { main: '#e9c27a', hunt: '#e8644a', rescue: '#9cc6e6', lore: '#e6d6b0', altar: '#d2424e', chest: '#e8b85a', siege: '#ff9440', escape: '#6fd0c0', puzzle: '#b79cff', reward: '#ffe08a', gate: '#c9583c', boss: '#ff4a32', elite: '#ffb050', oath: '#b8d6a0' };
  function node(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function hash(i, j) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  // ---- icon medallions (shared by the atlas, its legend and the minimap sprites) -------------------------------
  function icon(c, kind, s, o = {}) {
    const col = o.color || KIND_COLOR[kind] || '#e9c27a', dim = !!o.dim;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (kind === 'enemy' || kind === 'elite') {
      const r = kind === 'elite' ? s * .55 : s * .36;
      c.fillStyle = kind === 'elite' ? '#2a0c08' : '#c8302b'; c.strokeStyle = kind === 'elite' ? col : '#1a0605'; c.lineWidth = kind === 'elite' ? s * .16 : s * .1;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
      if (kind === 'elite') { c.fillStyle = col; c.beginPath(); c.moveTo(-r * .9, -r * .2); c.lineTo(-r * 1.25, -r * 1.35); c.lineTo(-r * .3, -r * .75); c.closePath(); c.moveTo(r * .9, -r * .2); c.lineTo(r * 1.25, -r * 1.35); c.lineTo(r * .3, -r * .75); c.closePath(); c.fill(); c.fillStyle = '#e8432f'; c.beginPath(); c.arc(0, 0, r * .42, 0, Math.PI * 2); c.fill(); }
      c.restore(); return;
    }
    if (kind === 'boss') {
      c.fillStyle = '#1c0605'; c.strokeStyle = col; c.lineWidth = s * .12; c.beginPath(); c.arc(0, 0, s, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#f0dcc0'; c.beginPath(); c.arc(0, -s * .12, s * .55, Math.PI * .95, Math.PI * 2.05); c.lineTo(s * .38, s * .42); c.lineTo(-s * .38, s * .42); c.closePath(); c.fill();
      c.fillStyle = '#1c0605'; c.beginPath(); c.arc(-s * .22, -s * .1, s * .14, 0, Math.PI * 2); c.arc(s * .22, -s * .1, s * .14, 0, Math.PI * 2); c.fill();
      c.fillRect(-s * .2, s * .25, s * .07, s * .17); c.fillRect(-s * .03, s * .25, s * .07, s * .17); c.fillRect(s * .14, s * .25, s * .07, s * .17);
      c.fillStyle = col; c.beginPath(); c.moveTo(-s * .58, -s * .5); c.lineTo(-s * .95, -s * 1.15); c.lineTo(-s * .3, -s * .7); c.moveTo(s * .58, -s * .5); c.lineTo(s * .95, -s * 1.15); c.lineTo(s * .3, -s * .7); c.fill();
      c.restore(); return;
    }
    // Medallion: dark disc, coloured rim, thin inner ring.
    if (kind === 'main' || kind === 'reward') { c.beginPath(); c.moveTo(0, -s * 1.12); c.lineTo(s * 1.12, 0); c.lineTo(0, s * 1.12); c.lineTo(-s * 1.12, 0); c.closePath(); }
    else { c.beginPath(); c.arc(0, 0, s, 0, Math.PI * 2); }
    c.fillStyle = dim ? '#0d0c0bcc' : '#120f0c'; c.fill(); c.strokeStyle = col; c.globalAlpha = dim ? .55 : 1; c.lineWidth = Math.max(1, s * .14); c.stroke();
    c.strokeStyle = '#00000099'; c.lineWidth = Math.max(.6, s * .06); c.stroke();
    c.fillStyle = col; c.strokeStyle = col; c.lineWidth = Math.max(1, s * .13);
    const g = s * .55;
    switch (kind) {
      case 'main': c.font = 'bold ' + Math.round(s * .95) + 'px Georgia,serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.label || 'I', 0, s * .06); break;
      case 'reward': c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? g * .42 : g; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); break;
      case 'oath': c.fillStyle = o.lit ? '#cfe8b8' : '#9a9a88'; c.beginPath(); c.moveTo(-g * .5, g); c.lineTo(-g * .38, -g * .7); c.lineTo(0, -g * 1.05); c.lineTo(g * .38, -g * .7); c.lineTo(g * .5, g); c.closePath(); c.fill(); c.strokeStyle = '#120f0c'; c.lineWidth = Math.max(.8, s * .09); c.beginPath(); c.moveTo(0, -g * .55); c.lineTo(0, g * .55); c.moveTo(-g * .22, -g * .1); c.lineTo(g * .22, g * .2); c.stroke(); break;
      case 'hunt': c.beginPath(); c.arc(0, 0, g * .72, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(0, -g * 1.1); c.lineTo(0, -g * .4); c.moveTo(0, g * 1.1); c.lineTo(0, g * .4); c.moveTo(-g * 1.1, 0); c.lineTo(-g * .4, 0); c.moveTo(g * 1.1, 0); c.lineTo(g * .4, 0); c.stroke(); c.beginPath(); c.arc(0, 0, g * .18, 0, Math.PI * 2); c.fill(); break;
      case 'rescue': c.lineWidth = Math.max(1, s * .15); c.beginPath(); c.ellipse(-g * .35, -g * .25, g * .42, g * .62, -.7, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(g * .35, g * .25, g * .42, g * .62, -.7, 0, Math.PI * 2); c.stroke(); break;
      case 'lore': c.beginPath(); c.moveTo(-g * .6, -g * .9); c.lineTo(g * .3, -g * .9); c.lineTo(g * .65, -g * .55); c.lineTo(g * .65, g * .9); c.lineTo(-g * .6, g * .9); c.closePath(); c.fill(); c.strokeStyle = '#120f0c'; c.lineWidth = Math.max(.6, s * .07); c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(-g * .38, -g * .3 + i * g * .4); c.lineTo(g * .42, -g * .3 + i * g * .4); } c.stroke(); break;
      case 'altar': c.beginPath(); c.moveTo(-g * .75, -g * .7); c.quadraticCurveTo(-g * .7, g * .15, 0, g * .2); c.quadraticCurveTo(g * .7, g * .15, g * .75, -g * .7); c.closePath(); c.fill(); c.fillRect(-g * .1, g * .1, g * .2, g * .6); c.fillRect(-g * .5, g * .68, g, g * .2); break;
      case 'chest': c.fillRect(-g * .85, -g * .2, g * 1.7, g * .95); c.beginPath(); c.moveTo(-g * .85, -g * .2); c.quadraticCurveTo(0, -g * 1.05, g * .85, -g * .2); c.closePath(); c.fill(); c.fillStyle = '#120f0c'; c.fillRect(-g * .85, -g * .25, g * 1.7, g * .12); c.fillRect(-g * .14, -g * .25, g * .28, g * .42); break;
      case 'siege': c.beginPath(); c.moveTo(0, -g * 1.05); c.bezierCurveTo(g * .9, -g * .2, g * .75, g * .9, 0, g * .95); c.bezierCurveTo(-g * .75, g * .9, -g * .9, -g * .2, 0, -g * 1.05); c.fill(); c.fillStyle = '#120f0c'; c.beginPath(); c.moveTo(0, -g * .15); c.bezierCurveTo(g * .4, g * .25, g * .3, g * .75, 0, g * .75); c.bezierCurveTo(-g * .3, g * .75, -g * .4, g * .25, 0, -g * .15); c.fill(); break;
      case 'escape': c.beginPath(); c.moveTo(-g * .7, -g * .95); c.lineTo(g * .7, -g * .95); c.lineTo(0, 0); c.lineTo(g * .7, g * .95); c.lineTo(-g * .7, g * .95); c.lineTo(0, 0); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-g * .4, g * .95); c.lineTo(0, g * .45); c.lineTo(g * .4, g * .95); c.fill(); break;
      case 'puzzle': c.beginPath(); c.moveTo(0, -g); c.lineTo(g * .9, g * .65); c.lineTo(-g * .9, g * .65); c.closePath(); c.stroke(); c.beginPath(); c.arc(0, -g * .05, g * .2, 0, Math.PI * 2); c.fill(); break;
      case 'gate': c.beginPath(); c.moveTo(-g * .8, g * .9); c.lineTo(-g * .8, -g * .2); c.arc(0, -g * .2, g * .8, Math.PI, 0); c.lineTo(g * .8, g * .9); c.stroke(); c.lineWidth = Math.max(.7, s * .09); c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(i * g * .4, o.open ? -g * .3 : -g * .75); c.lineTo(i * g * .4, o.open ? -g * .05 : g * .9); } if (!o.open) { c.moveTo(-g * .8, g * .3); c.lineTo(g * .8, g * .3); } c.stroke(); break;
      default: c.beginPath(); c.arc(0, 0, g * .35, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  function sprite(size, draw) { const c = document.createElement('canvas'); c.width = c.height = Math.max(2, Math.ceil(size)); const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); draw(x); return c; }
  function rgb(a, k = 1, alpha) { return alpha === undefined ? 'rgb(' + Math.round(a[0] * k) + ',' + Math.round(a[1] * k) + ',' + Math.round(a[2] * k) + ')' : 'rgba(' + Math.round(a[0] * k) + ',' + Math.round(a[1] * k) + ',' + Math.round(a[2] * k) + ',' + alpha + ')'; }

  function create(options) {
    const world = options.world, game = options.game, chapter = Math.max(1, Math.min(TITLES.length, world.chapter || game.chapter || 1));
    const S = STYLES[chapter] || STYLES[1];
    const rooms = world.rooms || [], visited = new Set(), seenIds = new Set(rooms.map(r => String(r.id))), legacy = new Set();
    let opened = false, disposed = false, timer = 0, camera = { x: game.player.x, z: game.player.z, scale: 4 }, dragging = null;
    let campaign = null, lastReset = -1, version = 0, previousFocus = null, lastLedger = null;
    let width = 1, height = 1, pixelRatio = 1, fitOnce = false, fitted = false, bgCanvas = null, bgKey = '';
    let record = { version: 1, campaign: null, chapters: {}, trails: {} };
    let trail = [], persistTimer = 0, persistDirty = false, tracked = null, route = null, routeKey = '', routeAt = -1e9, routeVersion = 0;
    let mini = { zoom: 1, rotate: false }; try { const m = JSON.parse(localStorage.getItem(MINI_STORAGE)); if (m && typeof m === 'object') mini = { zoom: [0.7, 1, 1.45].includes(m.zoom) ? m.zoom : 1, rotate: !!m.rotate }; } catch (_) {}
    // ---- DOM ------------------------------------------------------------------------------------------------------
    const element = node('div', 'screen modal hidden'); element.id = 'atlas'; element.dataset.chapter = String(chapter); element.dataset.style = S.name; element.setAttribute('role', 'dialog'); element.setAttribute('aria-modal', 'true'); element.setAttribute('aria-labelledby', 'atlas-title');
    const panel = node('div', 'panel atlas-panel'), head = node('header', 'panel-head'), titleBlock = node('div');
    titleBlock.append(node('span', 'eyebrow', tr('KABİR AZABI'))); const title = node('h2', '', TITLES[chapter - 1]); title.id = 'atlas-title'; titleBlock.append(title);
    const closeButton = node('button', 'close', '×'); closeButton.type = 'button'; closeButton.setAttribute('aria-label', tr('Haritayı kapat')); closeButton.onclick = () => options.onClose ? options.onClose() : close(); head.append(titleBlock, closeButton);
    const workspace = node('div', 'atlas-workspace'), map = node('div', 'atlas-map'), canvas = node('canvas', 'atlas-canvas'); canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', tr('Keşfettiğin yolların haritası. Sürükleyerek gez, tekerlekle yakınlaştır.'));
    const controls = node('div', 'atlas-controls');
    function button(text, name, action) { const e = node('button', '', text); e.type = 'button'; e.setAttribute('aria-label', name); e.title = name; e.onclick = action; controls.append(e); return e; }
    button('−', tr('Haritayı uzaklaştır'), () => zoom(.8)); button('+', tr('Haritayı yakınlaştır'), () => zoom(1.25));
    button('◎', tr('Bahtiyar’a dön'), () => { camera.x = game.player.x; camera.z = game.player.z; fitted = false; draw(); }); button('↔', tr('Keşfedilen yolları sığdır'), () => fit(false));
    const compass = node('div', 'atlas-compass'); compass.setAttribute('aria-hidden', 'true'); compass.innerHTML = '<span>' + tr('K') + '</span><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" opacity=".35"/><circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" opacity=".5" stroke-dasharray="2 3"/><path d="M50 6 56 44 94 50 56 56 50 94 44 56 6 50 44 44Z" fill="none" stroke="currentColor"/><path d="M50 6 50 50 44 44Z M94 50 50 50 56 44Z M50 94 50 50 56 56Z M6 50 50 50 44 56Z" fill="currentColor"/><path d="M50 22 53 47 78 50 53 53 50 78 47 53 22 50 47 47Z" fill="none" stroke="currentColor" opacity=".6" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="4" fill="currentColor"/></svg>';
    const instructions = node('p', 'atlas-instructions', tr('Sürükle · Yakınlaştır · M ile dön'));
    const trackBadge = node('div', 'atlas-track'); trackBadge.hidden = true;
    map.append(canvas, controls, compass, instructions, trackBadge);
    const aside = node('aside', 'atlas-ledger'), hereHeading = node('h3', '', tr('Bulunduğun yer')), here = node('p', 'atlas-here'), knowledge = node('small', 'atlas-knowledge');
    const explored = node('div', 'atlas-explored'), exploredFill = node('i'); explored.append(exploredFill);
    const goalHeading = node('h3', '', tr('İzlenen yeminler')), goals = node('div', 'atlas-goals');
    const landmarkHeading = node('h3', '', tr('Yakındaki duraklar')), landmarks = node('div', 'atlas-landmarks');
    const legend = node('div', 'atlas-legend');
    for (const [kind, label, o] of [['hero', tr('Bahtiyar')], ['oath', tr('Yemin taşı'), { lit: true }], ['main', tr('Ana görev')], ['side', tr('Yan görev')], ['elite', tr('Şampiyon')], ['boss', tr('Efendi')], ['gate', tr('Efendinin kapısı')]]) {
      const row = node('span'), c = node('canvas', 'atlas-legend-icon'); c.width = c.height = 36; const x = c.getContext('2d'); x.translate(18, 18);
      if (kind === 'hero') { x.scale(1.6, 1.6); heroShape(x, 0, '#f3e3c3'); }
      else if (kind === 'side') { x.translate(-6, 0); icon(x, 'lore', 7); x.translate(12, 0); icon(x, 'hunt', 7); }
      else icon(x, kind, kind === 'elite' ? 9 : 11, o);
      row.append(c, document.createTextNode(label)); legend.append(row);
    }
    aside.append(hereHeading, here, knowledge, explored, goalHeading, goals, landmarkHeading, landmarks, legend); workspace.append(map, aside);
    const footer = node('footer'), note = node('p', 'atlas-note', tr('Sis, yalnız yürüdüğün yerlerden kalkar. Bir yemine dokun: yolunu çizeyim.'));
    const done = node('button', 'btn small', tr('Oyuna dön')); done.type = 'button'; done.onclick = closeButton.onclick; footer.append(note, done); panel.append(head, workspace, footer); element.append(panel);
    const context = canvas.getContext('2d');
    function heroShape(c, rot, fill) { c.save(); c.rotate(rot); c.fillStyle = fill; c.strokeStyle = '#0c0a08'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 9); c.lineTo(-6.2, -5.5); c.lineTo(0, -2.2); c.lineTo(6.2, -5.5); c.closePath(); c.stroke(); c.fill(); c.restore(); }
    // ---- geometry: footprint sample, signed distance, painted terrain -----------------------------------------------
    const bounds = rooms.reduce((b, r) => ({ x0: Math.min(b.x0, r.x - r.w / 2 - 6), z0: Math.min(b.z0, r.z - r.d / 2 - 6), x1: Math.max(b.x1, r.x + r.w / 2 + 6), z1: Math.max(b.z1, r.z + r.d / 2 + 6) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
    if (!Number.isFinite(bounds.x0)) Object.assign(bounds, { x0: -40, z0: -40, x1: 40, z1: 40 });
    bounds.x0 = Math.floor(bounds.x0); bounds.z0 = Math.floor(bounds.z0); bounds.x1 = Math.ceil(bounds.x1); bounds.z1 = Math.ceil(bounds.z1);
    const W = bounds.x1 - bounds.x0, H = bounds.z1 - bounds.z0;
    const step = .6, columns = Math.ceil(W / step), rows = Math.ceil(H / step), count = columns * rows;
    const P = Math.max(3, Math.min(8, Math.sqrt(1.7e6 / (W * H)))), TW = Math.ceil(W * P), TH = Math.ceil(H * P);
    const MW = W, MH = H; // mask: 1 px per world unit
    let footprint = null, sdf = null, terrain = null, composed = null, mistBase = null, maskC = null, maskX = null, frontC = null, frontX = null, mistTmp = null, revealGrid = null, footCells = 0, revealedCells = 0;
    let maskVersion = 0, composedVersion = -1;
    function sample() {
      if (footprint) return;
      const start = performance.now(); footprint = new Uint8Array(count);
      for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) {
        const wx = bounds.x0 + (x + .5) * step, wz = bounds.z0 + (z + .5) * step;
        if (world.isWalkable && world.isWalkable(wx, wz, .12)) footprint[z * columns + x] = 1;
      }
      // Signed distance (world units) by a two-pass 3-4 chamfer on each side of the boundary.
      const inside = new Float32Array(count), outside = new Float32Array(count), BIG = 1e6;
      for (let i = 0; i < count; i++) { inside[i] = footprint[i] ? BIG : 0; outside[i] = footprint[i] ? 0 : BIG; }
      for (const d of [inside, outside]) {
        for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) { const i = z * columns + x; let v = d[i]; if (!v) continue; if (x > 0) v = Math.min(v, d[i - 1] + 1); if (z > 0) { v = Math.min(v, d[i - columns] + 1); if (x > 0) v = Math.min(v, d[i - columns - 1] + 1.4142); if (x < columns - 1) v = Math.min(v, d[i - columns + 1] + 1.4142); } d[i] = v; }
        for (let z = rows - 1; z >= 0; z--) for (let x = columns - 1; x >= 0; x--) { const i = z * columns + x; let v = d[i]; if (!v) continue; if (x < columns - 1) v = Math.min(v, d[i + 1] + 1); if (z < rows - 1) { v = Math.min(v, d[i + columns] + 1); if (x < columns - 1) v = Math.min(v, d[i + columns + 1] + 1.4142); if (x > 0) v = Math.min(v, d[i + columns - 1] + 1.4142); } d[i] = v; }
      }
      sdf = new Float32Array(count); for (let i = 0; i < count; i++) sdf[i] = footprint[i] ? (inside[i] - .5) * step : -(outside[i] - .5) * step;
      element.dataset.sampleMs = (performance.now() - start).toFixed(1);
    }
    function sdfAt(wx, wz) {
      let gx = (wx - bounds.x0) / step - .5, gz = (wz - bounds.z0) / step - .5;
      if (gx < 0) gx = 0; else if (gx > columns - 1.001) gx = columns - 1.001; if (gz < 0) gz = 0; else if (gz > rows - 1.001) gz = rows - 1.001;
      const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz, i = iz * columns + ix;
      const a = sdf[i], b = sdf[i + 1], c = sdf[i + columns], d = sdf[i + columns + 1];
      return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
    }
    function paintTerrain() {
      if (terrain) return;
      sample(); const start = performance.now();
      const noise = new Float32Array(65536); { let s = chapter * 7919 + 17; const coarse = new Float32Array(32 * 32); for (let i = 0; i < coarse.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) | 0; coarse[i] = (s >>> 8) / 16777216; }
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const gx = x / 8, gy = y / 8, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = coarse[(iy & 31) * 32 + (ix & 31)], b = coarse[(iy & 31) * 32 + ((ix + 1) & 31)], c = coarse[((iy + 1) & 31) * 32 + (ix & 31)], d = coarse[((iy + 1) & 31) * 32 + ((ix + 1) & 31)]; s = (Math.imul(s, 1664525) + 1013904223) | 0; noise[y * 256 + x] = (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * .75 + ((s >>> 8) / 16777216) * .25; } }
      terrain = document.createElement('canvas'); terrain.width = TW; terrain.height = TH;
      const tx = terrain.getContext('2d'), img = tx.createImageData(TW, TH), data = img.data;
      const F = S.floor, F2 = S.floor2, G = S.grout, Wl = S.wall, Hh = S.hatch, tile = S.tile, out = S.out, pat = S.pattern, inv = 1 / P;
      for (let py = 0; py < TH; py++) {
        const wz = bounds.z0 + (py + .5) * inv;
        for (let px = 0; px < TW; px++) {
          const wx = bounds.x0 + (px + .5) * inv, sd = sdfAt(wx, wz), o = (py * TW + px) * 4, n = noise[((py & 255) << 8) | (px & 255)];
          let r = 0, g = 0, b = 0, a = 0;
          if (sd > -.17) {
            // floor
            const nn = noise[(((py >> 2) & 255) << 8) | ((px >> 2) & 255)] * .65 + n * .35;
            r = F2[0] + (F[0] - F2[0]) * nn; g = F2[1] + (F[1] - F2[1]) * nn; b = F2[2] + (F[2] - F2[2]) * nn;
            let grout = 0, lift = 0;
            if (pat === 'flag' || pat === 'marble' || pat === 'plate') {
              const row = Math.floor(wz / tile), off = pat === 'flag' && (row & 1) ? tile * .5 : 0, col = Math.floor((wx + off) / tile);
              const fx = (wx + off) / tile - col, fz = wz / tile - row, edge = Math.min(fx, 1 - fx, fz, 1 - fz) * tile;
              grout = edge < .05 ? 1 : edge < .1 ? (.1 - edge) * 20 : 0; lift = (hash(col, row) - .5) * (pat === 'marble' ? .12 : .2);
              if (pat === 'marble') { const dg = Math.abs(fx - fz), dg2 = Math.abs(fx + fz - 1); if (Math.min(dg, dg2) * tile < .035) grout = Math.max(grout, .55); }
              if (pat === 'plate') { const cx = Math.min(fx, 1 - fx) * tile, cz = Math.min(fz, 1 - fz) * tile; if (cx < .32 && cz < .32 && Math.hypot(cx - .2, cz - .2) < .07) { lift += .35; } if (n > .74 && nn > .6) { r += 90 * (n - .74) * 4; g += 30 * (n - .74) * 4; } }
            } else if (pat === 'ledger') {
              const fz = wz / tile - Math.floor(wz / tile); if (fz < .045) grout = .55; const m = Math.abs(((wx % 18) + 18) % 18 - 2.2); if (m < .05) { r = 150; g = 52; b = 58; }
              lift = (n - .5) * .1;
            } else { lift = (n - .5) * .22; if (sd < 1.1) { const wet = (1.1 - sd) / 1.1 * .5; r *= 1 - wet * .45; g *= 1 - wet * .3; b *= 1 - wet * .12; } }
            r = r * (1 + lift); g = g * (1 + lift); b = b * (1 + lift);
            if (grout) { r += (G[0] - r) * grout; g += (G[1] - g) * grout; b += (G[2] - b) * grout; }
            const ao = sd < 2.4 ? .62 + .38 * Math.max(0, sd) / 2.4 : 1; r *= ao; g *= ao; b *= ao;
            const inner = Math.abs(sd - .5); if (inner < .045) { const k = .4 * (1 - inner / .045); r += (Wl[0] - r) * k; g += (Wl[1] - g) * k; b += (Wl[2] - b) * k; }
            a = 255;
            // wall ink line (anti-aliased both sides)
            if (sd < .13) { const k = sd > .06 ? (.13 - sd) / .07 : 1; r += (Wl[0] - r) * k; g += (Wl[1] - g) * k; b += (Wl[2] - b) * k; if (sd < -.11) a = 255 * (sd + .17) / .06; }
          } else {
            const d = -sd - .17;
            if (out === 'hatch' || out === 'gild' || out === 'ember') {
              const reach = out === 'gild' ? 2.2 : 2.7;
              if (d < reach) {
                const fall = Math.pow(1 - d / reach, .9), h1 = ((wx + wz) * (out === 'gild' ? 2.4 : 1.7) + n * .5) % 1, h2 = ((wx - wz) * 2.4 + n * .5) % 1;
                const line = (h1 < 0 ? h1 + 1 : h1) < .3 || out === 'gild' && (h2 < 0 ? h2 + 1 : h2) < .22 && d < 1.2;
                const k = line ? 1 : .5; r = Hh[0] * (line ? 1 : .3); g = Hh[1] * (line ? 1 : .3); b = Hh[2] * (line ? 1 : .3); a = 255 * fall * k;
                if (d < .35) { const sh = 1 - d / .35; r *= 1 - sh * .7; g *= 1 - sh * .7; b *= 1 - sh * .7; a = Math.max(a, 255 * sh * .9); }
                if (out === 'ember') { const glow = Math.exp(-d * 1.3) * (.55 + n * .45); r = r + (255 - r) * glow * .8; g = g + (96 - g) * glow * .8; b = b + (30 - b) * glow * .8; a = Math.max(a, 255 * glow * .75); }
              }
            } else if (out === 'contours') {
              if (d < 4.6) {
                a = 255 * .32 * (1 - d / 4.6); r = Hh[0] * .35; g = Hh[1] * .45; b = Hh[2] * .5;
                for (const ring of [.55, 1.25, 2.1, 3.2]) { const e = Math.abs(d - ring); if (e < .06) { const k = (1 - e / .06) * (1 - ring / 4.4); r = Hh[0]; g = Hh[1]; b = Hh[2]; a = Math.max(a, 255 * (.25 + .7 * k)); } }
                if (d < .3) { const sh = 1 - d / .3; r *= 1 - sh * .6; g *= 1 - sh * .6; b *= 1 - sh * .6; a = Math.max(a, 255 * sh * .85); }
              }
            } else { // void: platforms float; a cast shadow down-right and a violet rim glow
              const so = sdfAt(wx - .8, wz - 1.6);
              if (so > -.6) { const k = Math.min(1, (so + .6) / 1.2); r = 3; g = 2; b = 8; a = 255 * .72 * k; }
              const glow = Math.exp(-d * 2.4) * .7; if (glow > .02) { r = r + (Hh[0] - r) * glow; g = g + (Hh[1] - g) * glow; b = b + (Hh[2] - b) * glow; a = Math.max(a, 255 * glow); }
            }
          }
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
        }
      }
      tx.putImageData(img, 0, 0);
      // Mist: the footprint as a soft, low-res cloud. Shown only along the fog frontier.
      mistBase = document.createElement('canvas'); mistBase.width = MW; mistBase.height = MH;
      const mx = mistBase.getContext('2d'), mimg = mx.createImageData(MW, MH), M = S.mist; footCells = 0;
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const sd = sdfAt(bounds.x0 + x + .5, bounds.z0 + y + .5), o = (y * MW + x) * 4, k = sd > 0 ? 1 : sd > -1.5 ? (1.5 + sd) / 1.5 : 0; if (sd > 0) footCells++; mimg.data[o] = M[0]; mimg.data[o + 1] = M[1]; mimg.data[o + 2] = M[2]; mimg.data[o + 3] = 120 * k * (.7 + .3 * noise[((y * 3) & 255) * 256 + ((x * 3) & 255)]); }
      mx.putImageData(mimg, 0, 0);
      maskC = document.createElement('canvas'); maskC.width = MW; maskC.height = MH; maskX = maskC.getContext('2d');
      frontC = document.createElement('canvas'); frontC.width = MW; frontC.height = MH; frontX = frontC.getContext('2d');
      mistTmp = document.createElement('canvas'); mistTmp.width = MW; mistTmp.height = MH;
      composed = document.createElement('canvas'); composed.width = TW; composed.height = TH;
      revealGrid = new Uint8Array(MW * MH); revealedCells = 0;
      element.dataset.paintMs = (performance.now() - start).toFixed(1); element.dataset.terrain = TW + 'x' + TH + '@' + P.toFixed(2);
      restamp();
    }
    // ---- fog of war --------------------------------------------------------------------------------------------------
    const stampReveal = sprite(REVEAL * 2 + 2, x => { const g = x.createRadialGradient(0, 0, 0, 0, 0, REVEAL); g.addColorStop(0, '#fff'); g.addColorStop(.62, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, REVEAL, 0, Math.PI * 2); x.fill(); });
    const stampFront = sprite(FRONTIER * 2 + 2, x => { const g = x.createRadialGradient(0, 0, 0, 0, 0, FRONTIER); g.addColorStop(0, '#fff'); g.addColorStop(.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, FRONTIER, 0, Math.PI * 2); x.fill(); });
    function markGrid(wx, wz, radius, value) {
      if (!revealGrid) return;
      const cx = wx - bounds.x0, cz = wz - bounds.z0, r2 = radius * radius;
      for (let y = Math.max(0, Math.floor(cz - radius)); y < Math.min(MH, Math.ceil(cz + radius)); y++) for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(MW, Math.ceil(cx + radius)); x++) {
        const dx = x + .5 - cx, dz = y + .5 - cz; if (dx * dx + dz * dz > r2) continue; const i = y * MW + x, old = revealGrid[i];
        if (old < value) { if (!old && sdf && sdfAt(bounds.x0 + x + .5, bounds.z0 + y + .5) > 0) revealedCells++; revealGrid[i] = value; }
      }
    }
    function stampPoint(wx, wz) {
      if (!maskX) return; const mx = wx - bounds.x0, mz = wz - bounds.z0;
      maskX.drawImage(stampReveal, mx - stampReveal.width / 2, mz - stampReveal.height / 2); frontX.drawImage(stampFront, mx - stampFront.width / 2, mz - stampFront.height / 2);
      markGrid(wx, wz, REVEAL * .82, 1); markGrid(wx, wz, CORE, 2);
    }
    function stampRoom(r) {
      if (!maskX) return; const x = r.x - r.w / 2 - bounds.x0, z = r.z - r.d / 2 - bounds.z0;
      maskX.fillStyle = '#fff'; maskX.fillRect(x, z, r.w, r.d); frontX.fillStyle = '#fff'; frontX.fillRect(x - 8, z - 8, r.w + 16, r.d + 16);
      if (revealGrid) for (let y = Math.max(0, Math.floor(z)); y < Math.min(MH, Math.ceil(z + r.d)); y++) for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(MW, Math.ceil(x + r.w)); xx++) { const i = y * MW + xx; if (!revealGrid[i]) { revealGrid[i] = 1; if (sdfAt(bounds.x0 + xx + .5, bounds.z0 + y + .5) > 0) revealedCells++; } }
    }
    function restamp() {
      if (!maskX) return; maskX.clearRect(0, 0, MW, MH); frontX.clearRect(0, 0, MW, MH); revealGrid.fill(0); revealedCells = 0;
      for (const id of legacy) { const r = rooms.find(room => String(room.id) === id); if (r) stampRoom(r); }
      for (let i = 0; i < trail.length; i += 2) stampPoint(trail[i], trail[i + 1]);
      maskVersion++;
    }
    function revealedAt(wx, wz, level = 1) { if (!revealGrid) return false; const x = Math.floor(wx - bounds.x0), z = Math.floor(wz - bounds.z0); return x >= 0 && z >= 0 && x < MW && z < MH && revealGrid[z * MW + x] >= level; }
    function compose() {
      if (!terrain) paintTerrain(); if (composedVersion === maskVersion) return; composedVersion = maskVersion;
      const mt = mistTmp.getContext('2d'); mt.globalCompositeOperation = 'source-over'; mt.clearRect(0, 0, MW, MH); mt.drawImage(mistBase, 0, 0);
      mt.globalCompositeOperation = 'destination-in'; mt.drawImage(frontC, 0, 0); mt.globalCompositeOperation = 'destination-out'; mt.drawImage(maskC, 0, 0); mt.globalCompositeOperation = 'source-over';
      const cx = composed.getContext('2d'); cx.globalCompositeOperation = 'source-over'; cx.clearRect(0, 0, TW, TH); cx.drawImage(terrain, 0, 0);
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.globalCompositeOperation = 'destination-in'; cx.drawImage(maskC, 0, 0, MW * P, MH * P);
      cx.globalCompositeOperation = 'destination-over'; cx.drawImage(mistTmp, 0, 0, MW * P, MH * P); cx.globalCompositeOperation = 'source-over';
      element.dataset.explored = String(visited.size); element.dataset.revealed = footCells ? (revealedCells / footCells).toFixed(3) : '0';
    }
    // ---- persistence & exploration -------------------------------------------------------------------------------------
    function encodeTrail() { const a = new Int16Array(trail.length); for (let i = 0; i < trail.length; i++) a[i] = Math.round(trail[i] * 2); let s = ''; const u = new Uint8Array(a.buffer); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
    function decodeTrail(text) { try { const s = atob(text), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); const a = new Int16Array(u.buffer, 0, u.length >> 1), out = []; for (let i = 0; i + 1 < a.length; i += 2) out.push(a[i] / 2, a[i + 1] / 2); return out.slice(0, TRAIL_MAX * 2); } catch (_) { return []; } }
    function readCampaign() {
      if (lastReset === game.resetSerial && campaign !== null) return;
      lastReset = game.resetSerial;
      const snapshot = game.progression && game.progression.snapshot ? game.progression.snapshot() : null;
      const key = String(options.campaignKey === undefined ? snapshot && snapshot.lootSeed !== undefined ? snapshot.lootSeed : 'legacy' : typeof options.campaignKey === 'function' ? options.campaignKey() : options.campaignKey);
      const changed = key !== campaign, knownBefore = visited.size;
      if (changed) {
        campaign = key; visited.clear(); legacy.clear(); trail = [];
        try { const saved = JSON.parse(localStorage.getItem(STORAGE)); record = saved && saved.version === 1 && String(saved.campaign) === key && saved.chapters && typeof saved.chapters === 'object' ? saved : { version: 1, campaign: key, chapters: {} }; } catch (_) { record = { version: 1, campaign: key, chapters: {} }; }
        if (!record.trails || typeof record.trails !== 'object') record.trails = {};
        const stored = record.chapters[chapter]; if (Array.isArray(stored)) for (const id of stored.slice(0, 64)) if (seenIds.has(String(id))) visited.add(String(id));
        if (typeof record.trails[chapter] === 'string') trail = decodeTrail(record.trails[chapter]);
        if (!trail.length) for (const id of visited) legacy.add(id); // older saves: whole rooms, no trail
        restamp();
      }
      // A discovered late checkpoint certifies the main route to that checkpoint, never optional side rooms.
      if (game.checkpointIndex && world.checkpoint) for (const r of rooms) if (Math.abs(r.x - world.checkpoint.x) < 11 && r.z >= world.checkpoint.z - 3 && !visited.has(String(r.id))) { visited.add(String(r.id)); if (!legacy.has(String(r.id))) { legacy.add(String(r.id)); stampRoom(r); maskVersion++; } }
      // A dead encounter is also evidence that its room was visited.
      for (const encounter of world.encounters || []) {
        const enemies = (game.enemies || []).filter(e => !e.reserve && (e.encounter === encounter || e.encounter === encounter.id || e.encounter && e.encounter.id === encounter.id || e.encounterId === encounter.id));
        if (enemies.length && enemies.every(e => e.dead)) { const id = String(encounter.room); if (!visited.has(id) && seenIds.has(id)) { visited.add(id); const r = rooms.find(room => String(room.id) === id); if (r && !legacy.has(id)) { legacy.add(id); stampRoom(r); maskVersion++; } } }
      }
      if (changed || visited.size !== knownBefore) { version++; fitOnce = false; }
    }
    function persist() { record.chapters[chapter] = Array.from(visited); if (!record.trails) record.trails = {}; record.trails[chapter] = encodeTrail(); try { localStorage.setItem(STORAGE, JSON.stringify(record)); } catch (_) {} persistDirty = false; }
    function explore() {
      readCampaign(); const p = game.player;
      for (const r of rooms) {
        if (Math.abs(p.x - r.x) > r.w / 2 + .5 || Math.abs(p.z - r.z) > r.d / 2 + .5) continue;
        const id = String(r.id); if (!visited.has(id)) { visited.add(id); version++; persistDirty = true; }
      }
      // The trail grows only where the hero has not yet stood (core cell unset), so it stays bounded by area.
      if (Number.isFinite(p.x) && Number.isFinite(p.z) && p.x > bounds.x0 && p.x < bounds.x1 && p.z > bounds.z0 && p.z < bounds.z1 && trail.length < TRAIL_MAX * 2 && !(revealGrid && revealedAt(p.x, p.z, 2))) {
        if (!revealGrid) { if (!trail.length || Math.hypot(trail[trail.length - 2] - p.x, trail[trail.length - 1] - p.z) > CORE) { trail.push(Math.round(p.x * 2) / 2, Math.round(p.z * 2) / 2); persistDirty = true; version++; } }
        else { trail.push(Math.round(p.x * 2) / 2, Math.round(p.z * 2) / 2); stampPoint(p.x, p.z); maskVersion++; persistDirty = true; version++; }
      }
    }
    // ---- the public terrain hooks (HUD fallback and loading warm-up) -----------------------------------------------------
    // Preparing never explores: the loading room tour must not disclose rooms the hero has not visited.
    function prepareTerrain() { if (!disposed) { paintTerrain(); compose(); } }
    function drawTerrain(ctx) { if (disposed) return false; compose(); ctx.imageSmoothingEnabled = true; ctx.drawImage(composed, bounds.x0, bounds.z0, TW / P, TH / P); return true; }
    // ---- tracking & route -------------------------------------------------------------------------------------------------
    function sideEntries() { const q = game.quests; return q && Array.isArray(q.side) ? q.side : []; }
    function mainTarget(qi) { const q = game.quests, p = game.player; if (!q) return null; let best = null, d = Infinity; for (const m of q.markers || []) { if (m.quest !== qi || !m.active || m.complete || !Number.isFinite(m.x)) continue; const k = Math.hypot(m.x - p.x, m.z - p.z); if (k < d) { d = k; best = m; } } if (!best && q.entries && q.entries[qi] && q.entries[qi].target && !q.entries[qi].complete) best = q.entries[qi].target; return best; }
    function gateTarget() { const g = game.gate; if (g && Number.isFinite(g.x)) return { id: 'gate', name: g.bossName || tr('Efendinin kapısı'), x: g.x, z: g.z, kind: 'gate' }; const b = game.boss; return b && !b.dead ? { id: 'boss', name: b.name || tr('Efendi'), x: b.x, z: b.z, kind: 'boss' } : null; }
    function target() {
      const q = game.quests, p = game.player, reward = game.pendingBossReward;
      if (reward && Number.isFinite(reward.x)) return { id: 'reward', name: tr('Zafer emaneti'), x: reward.x, z: reward.z, kind: 'reward' };
      if (tracked) {
        if (tracked.type === 'main') { const m = mainTarget(tracked.index); if (m) return Object.assign({ kind: 'main' }, m); }
        else if (tracked.type === 'side') { const e = sideEntries().find(s => s.id === tracked.id); if (e && e.available && e.target && Number.isFinite(e.target.x)) return Object.assign({ kind: e.kind }, e.target, { name: e.name }); }
        else if (tracked.type === 'gate') { const g = gateTarget(); if (g) return g; }
        tracked = null;
      }
      if (!q) return gateTarget();
      const urgent = sideEntries().find(e => e.urgent && e.target); if (urgent) return Object.assign({ kind: urgent.kind }, urgent.target, { name: urgent.name });
      if (q.ready) return gateTarget();
      let best = null, score = Infinity;
      const consider = (m, w, kind) => { if (!m || !m.active || m.complete || !Number.isFinite(m.x)) return; const d = Math.hypot(m.x - p.x, m.z - p.z) * w; if (d < score) { score = d; best = Object.assign({ kind }, m); } };
      for (const m of q.markers || []) consider(m, .8, 'main');
      for (const e of sideEntries()) if (e.available && e.target) consider(Object.assign({}, e.target, { name: e.name, active: true }), 1, e.kind);
      return best;
    }
    const landing = new Map();
    function walkableNear(t) {
      const key = t.id + ':' + Math.round(t.x * 2) + ',' + Math.round(t.z * 2); if (landing.has(key)) return landing.get(key);
      let best = { x: t.x, z: t.z };
      if (world.isWalkable && !world.isWalkable(t.x, t.z, .45)) for (let k = 1; k < 90; k++) { const a = k * 2.4, d = .35 * Math.sqrt(k), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d; if (world.isWalkable(x, z, .45)) { best = { x, z }; break; } }
      if (landing.size > 64) landing.clear(); landing.set(key, best); return best;
    }
    function updateRoute(force) {
      const t = target(), p = game.player, now = performance.now();
      if (!t) { if (route) { route = null; routeVersion++; } routeKey = ''; return; }
      const key = (t.id || t.name) + '|' + Math.round(t.x) + ',' + Math.round(t.z);
      if (!force && key === routeKey && route && now - routeAt < 1400 && Math.hypot(route.fromX - p.x, route.fromZ - p.z) < 2.5) return;
      routeKey = key; routeAt = now;
      let points = null; const goal = walkableNear(t);
      if (Math.hypot(goal.x - p.x, goal.z - p.z) < 2) points = [];
      else if (world.pathTo) { try { const path = world.pathTo({ x: p.x, z: p.z }, goal, .45); if (Array.isArray(path) && path.length) points = path.map(q => ({ x: q.x, z: q.z })); } catch (_) {} }
      route = { target: t, fromX: p.x, fromZ: p.z, points: points ? [{ x: p.x, z: p.z }].concat(points) : null }; routeVersion++;
    }
    function strokeRoute(c, s, alpha) {
      if (!route || !route.points || route.points.length < 2) return;
      const pts = route.points.slice(); pts[0] = { x: game.player.x, z: game.player.z };
      c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); c.moveTo(pts[0].x, pts[0].z); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].z);
      c.strokeStyle = 'rgba(0,0,0,' + (.55 * alpha) + ')'; c.lineWidth = 4.2 / s; c.stroke();
      c.strokeStyle = S.route; c.globalAlpha = alpha; c.lineWidth = 2 / s; c.setLineDash([5 / s, 4.5 / s]); c.stroke(); c.restore();
    }
    // ---- full-screen map --------------------------------------------------------------------------------------------------
    function fit(nearby = false) {
      let b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
      const add = (x0, z0, x1, z1) => { b.x0 = Math.min(b.x0, x0); b.z0 = Math.min(b.z0, z0); b.x1 = Math.max(b.x1, x1); b.z1 = Math.max(b.z1, z1); };
      const p = game.player, near = (x, z) => !nearby || Math.hypot(x - p.x, z - p.z) < 42;
      for (let i = 0; i < trail.length; i += 2) if (near(trail[i], trail[i + 1])) add(trail[i] - REVEAL * .7, trail[i + 1] - REVEAL * .7, trail[i] + REVEAL * .7, trail[i + 1] + REVEAL * .7);
      for (const id of legacy) { const r = rooms.find(room => String(room.id) === id); if (r && near(r.x, r.z)) add(r.x - r.w / 2, r.z - r.d / 2, r.x + r.w / 2, r.z + r.d / 2); }
      add(p.x - 12, p.z - 12, p.x + 12, p.z + 12);
      camera.x = (b.x0 + b.x1) / 2; camera.z = (b.z0 + b.z1) / 2; camera.scale = Math.max(1, Math.min(9, (width - 110) / (b.x1 - b.x0 + 8), (height - 100) / (b.z1 - b.z0 + 8))); fitOnce = true; fitted = nearby ? 'nearby' : 'all'; draw();
    }
    function zoom(factor, x, y) {
      const old = camera.scale, next = Math.max(1, Math.min(14, old * factor));
      if (x !== undefined && y !== undefined) { camera.x += (x - width / 2) * (1 / old - 1 / next); camera.z += (y - height / 2) * (1 / old - 1 / next); }
      camera.scale = next; fitted = false; draw();
    }
    const toX = wx => (wx - camera.x) * camera.scale + width / 2, toY = wz => (wz - camera.z) * camera.scale + height / 2;
    function background() {
      const key = width + 'x' + height + '@' + pixelRatio; if (bgKey === key && bgCanvas) return bgCanvas; bgKey = key;
      const c = bgCanvas || document.createElement('canvas'); bgCanvas = c; c.width = Math.round(width * pixelRatio); c.height = Math.round(height * pixelRatio);
      const x = c.getContext('2d'); x.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const g = x.createRadialGradient(width * .5, height * .46, 0, width * .5, height * .5, Math.max(width, height) * .75); g.addColorStop(0, rgb(S.bg2)); g.addColorStop(1, rgb(S.bg)); x.fillStyle = g; x.fillRect(0, 0, width, height);
      // grain
      const nw = Math.ceil(width / 2), nh = Math.ceil(height / 2), small = document.createElement('canvas'); small.width = nw; small.height = nh; const sx = small.getContext('2d'), im = sx.createImageData(nw, nh); let s = chapter * 131 + 7;
      for (let i = 0; i < im.data.length; i += 4) { s = (Math.imul(s, 1664525) + 1013904223) | 0; const v = (s >>> 24); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 14; } sx.putImageData(im, 0, 0); x.drawImage(small, 0, 0, width, height);
      let r = chapter * 977 + 3; const rnd = () => { r = (Math.imul(r, 1664525) + 1013904223) | 0; return (r >>> 8) / 16777216; };
      x.lineCap = 'round';
      if (S.motif === 'tablet') { x.strokeStyle = '#00000080'; for (let i = 0; i < 9; i++) { x.lineWidth = .6 + rnd() * 1.2; x.beginPath(); let px = rnd() * width, py = rnd() * height; x.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (rnd() - .5) * 90; py += (rnd() - .5) * 90; x.lineTo(px, py); } x.stroke(); } x.strokeStyle = '#d6b88a10'; x.lineWidth = 1; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(rnd() * width, rnd() * height, 30 + rnd() * 120, 0, Math.PI * 2); x.stroke(); } }
      if (S.motif === 'chart') { x.strokeStyle = '#8fc8c818'; x.lineWidth = 1; for (let i = 0; i < 70; i++) { const px = rnd() * width, py = rnd() * height, w = 8 + rnd() * 16; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + w / 4, py - 3, px + w / 2, py); x.quadraticCurveTo(px + w * .75, py + 3, px + w, py); x.stroke(); } }
      if (S.motif === 'forge') { for (let i = 0; i < 14; i++) { x.strokeStyle = 'rgba(255,' + (70 + rnd() * 60 | 0) + ',20,' + (.05 + rnd() * .1) + ')'; x.lineWidth = .8 + rnd() * 1.6; x.beginPath(); let px = rnd() * width, py = rnd() * height; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rnd() - .5) * 70; py += (rnd() - .5) * 70; x.lineTo(px, py); } x.stroke(); } }
      if (S.motif === 'ledger') { for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(210,200,255,' + (rnd() * .35) + ')'; x.fillRect(rnd() * width, rnd() * height, 1, 1); } x.strokeStyle = '#b79cff10'; x.lineWidth = 1.2; for (let i = 0; i < 4; i++) { x.beginPath(); const cx = rnd() * width, cy = rnd() * height; for (let a = 0; a < 18; a += .2) x.lineTo(cx + Math.cos(a) * a * 9, cy + Math.sin(a) * a * 5); x.stroke(); } }
      if (S.motif === 'gilded') { x.strokeStyle = '#e8b85a0c'; x.lineWidth = 1; for (let i = -height; i < width; i += 46) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + height, height); x.moveTo(i + height, 0); x.lineTo(i, height); x.stroke(); } }
      const v = x.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .3, width / 2, height / 2, Math.max(width, height) * .72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.72)'); x.fillStyle = v; x.fillRect(0, 0, width, height);
      return c;
    }
    function worldMotif(c, s) {
      // World-anchored decoration so the "paper" pans with the map.
      const x0 = camera.x - width / 2 / s, x1 = camera.x + width / 2 / s, z0 = camera.z - height / 2 / s, z1 = camera.z + height / 2 / s;
      c.save(); c.lineWidth = 1 / s;
      if (S.motif === 'chart') {
        const ox = world.spawn ? world.spawn.x : 0, oz = (world.spawn ? world.spawn.z : 0) - H * .45; c.strokeStyle = '#8fc8c826';
        c.beginPath(); for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16; c.moveTo(ox, oz); c.lineTo(ox + Math.cos(a) * 600, oz + Math.sin(a) * 600); } c.stroke();
        c.strokeStyle = '#8fc8c833'; c.beginPath(); c.arc(ox, oz, 14, 0, Math.PI * 2); c.moveTo(ox + 22, oz); c.arc(ox, oz, 22, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#8fc8c84a'; c.beginPath(); c.moveTo(ox, oz - 20); c.lineTo(ox + 3, oz); c.lineTo(ox, oz + 20); c.lineTo(ox - 3, oz); c.closePath(); c.moveTo(ox - 20, oz); c.lineTo(ox, oz - 3); c.lineTo(ox + 20, oz); c.lineTo(ox, oz + 3); c.closePath(); c.fill();
      } else if (S.motif === 'ledger') {
        c.strokeStyle = '#b79cff14'; c.beginPath(); for (let z = Math.floor(z0 / 6) * 6; z < z1; z += 6) { c.moveTo(x0, z); c.lineTo(x1, z); } c.stroke();
        c.strokeStyle = '#d0485a30'; c.beginPath(); c.moveTo(bounds.x0 + 4, z0); c.lineTo(bounds.x0 + 4, z1); c.stroke();
      } else if (S.motif === 'tablet' || S.motif === 'gilded' || S.motif === 'forge') {
        c.strokeStyle = S.motif === 'gilded' ? '#e8b85a12' : S.motif === 'forge' ? '#ff8a3c0e' : '#d6b88a0e'; c.beginPath(); const g = 20;
        for (let x = Math.floor(x0 / g) * g; x < x1; x += g) { c.moveTo(x, z0); c.lineTo(x, z1); } for (let z = Math.floor(z0 / g) * g; z < z1; z += g) { c.moveTo(x0, z); c.lineTo(x1, z); } c.stroke();
      }
      c.restore();
    }
    let blot = null;
    function enemyLayer(c, s) {
      // Danger: a soft blood wash where living foes gather, champions and the master as medallions.
      if (!blot) blot = sprite(64, x => { const g = x.createRadialGradient(0, 0, 0, 0, 0, 32); g.addColorStop(0, 'rgba(200,30,22,.55)'); g.addColorStop(1, 'rgba(200,30,22,0)'); x.fillStyle = g; x.fillRect(-32, -32, 64, 64); });
      const icons = []; c.save(); c.globalAlpha = .3;
      for (const e of game.enemies || []) {
        if (e.dead || e.reserve || !Number.isFinite(e.x) || !revealedAt(e.x, e.z)) continue;
        if (e.boss) { icons.push(['boss', e]); continue; }
        if (e.elite || e.champion) icons.push(['elite', e]);
        const r = 2.6; c.drawImage(blot, e.x - r, e.z - r, r * 2, r * 2);
      }
      c.restore(); return icons;
    }
    function draw() {
      if (!opened || disposed || width < 2 || height < 2) return;
      compose(); updateRoute(false);
      const c = context, s = camera.scale; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(background(), 0, 0); c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      c.save(); c.translate(width / 2, height / 2); c.scale(s, s); c.translate(-camera.x, -camera.z);
      worldMotif(c, s);
      // Soft drop shadow lifts the painted plan off the background.
      c.save(); c.globalAlpha = .55; c.filter = 'blur(' + Math.max(2, s * .6).toFixed(1) + 'px) brightness(0)'; c.drawImage(composed, bounds.x0 + .35, bounds.z0 + .7, TW / P, TH / P); c.restore();
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(composed, bounds.x0, bounds.z0, TW / P, TH / P);
      // Light of the hero's lantern on the paper.
      const warm = c.createRadialGradient(game.player.x, game.player.z, 0, game.player.x, game.player.z, 16); warm.addColorStop(0, 'rgba(255,214,140,.16)'); warm.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = warm; c.fillRect(game.player.x - 16, game.player.z - 16, 32, 32);
      const foes = enemyLayer(c, s);
      strokeRoute(c, s, 1);
      c.restore(); c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const placed = [];
      const put = (wx, wz, kind, o = {}) => { const x = toX(wx), y = toY(wz); if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return; c.save(); c.translate(x, y); if (o.glow) { const g = c.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, (KIND_COLOR[kind] || '#e9c27a') + '66'); g.addColorStop(1, (KIND_COLOR[kind] || '#e9c27a') + '00'); c.fillStyle = g; c.fillRect(-26, -26, 52, 52); } icon(c, kind, o.size || 10, o); c.restore(); placed.push({ x, y }); };
      // Boss gate and the master
      const gate = game.gate; if (gate && Number.isFinite(gate.x) && revealedAt(gate.x, gate.z)) put(gate.x, gate.z, 'gate', { open: !!gate.open, size: 11 });
      for (const [kind, e] of foes) put(e.x, e.z, kind, { size: kind === 'boss' ? 13 : 7 });
      if (world.checkpoint && revealedAt(world.checkpoint.x, world.checkpoint.z)) put(world.checkpoint.x, world.checkpoint.z, 'oath', { lit: !!game.checkpointIndex, size: 11, glow: !!game.checkpointIndex });
      const t = target(), q = game.quests;
      // Main threads always show (they are the road); side threads once discovered.
      if (q) for (const m of q.markers || []) { if (!m.active || m.complete || !Number.isFinite(m.x)) continue; const isT = t && t.id === m.id; put(m.x, m.z, 'main', { label: m.quest ? 'II' : 'I', size: isT ? 12 : 10, glow: isT, dim: !revealedAt(m.x, m.z) }); }
      const sides = new Map(sideEntries().map(e => [e.id, e]));
      for (const m of q && q.sideMarkers || []) { if (!m.active || m.complete || !Number.isFinite(m.x)) continue; const e = sides.get(m.side); if (!(e && e.discovered && !e.complete) && !revealedAt(m.x, m.z)) continue; const isT = t && t.id === m.id; put(m.x, m.z, m.kind, { size: isT ? 11 : 9, glow: isT, dim: !revealedAt(m.x, m.z) }); }
      const reward = game.pendingBossReward; if (reward && Number.isFinite(reward.x)) put(reward.x, reward.z, 'reward', { size: 12, glow: true });
      placed.push({ x: toX(game.player.x), y: toY(game.player.z) }); labels(placed);
      // Hero: lantern halo, facing cone, arrow
      { const x = toX(game.player.x), y = toY(game.player.z), f = game.player.face || 0; c.save(); c.translate(x, y);
        const cone = c.createRadialGradient(0, 0, 4, 0, 0, 46); cone.addColorStop(0, 'rgba(255,226,170,.32)'); cone.addColorStop(1, 'rgba(255,226,170,0)'); c.fillStyle = cone; c.beginPath(); c.moveTo(0, 0); const dir = Math.atan2(Math.cos(f), Math.sin(f)); c.arc(0, 0, 46, dir - .42, dir + .42); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(240,210,150,.65)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.stroke(); c.strokeStyle = 'rgba(240,210,150,.25)'; c.beginPath(); c.arc(0, 0, 19, 0, Math.PI * 2); c.stroke();
        c.shadowColor = '#f0c27a'; c.shadowBlur = 10; heroShape(c, -f, '#f6e6c6'); c.restore(); }
      // Off-screen tracked target: an arrow on the frame edge.
      if (t) { const x = toX(t.x), y = toY(t.z); if (x < 18 || y < 18 || x > width - 18 || y > height - 18) { const cx = width / 2, cy = height / 2, a = Math.atan2(y - cy, x - cx), k = Math.min((width / 2 - 30) / Math.abs(Math.cos(a) || 1e-6), (height / 2 - 30) / Math.abs(Math.sin(a) || 1e-6)); c.save(); c.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k); c.rotate(a); c.fillStyle = S.route; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-2, 0); c.lineTo(-6, 8); c.closePath(); c.stroke(); c.fill(); c.restore(); } }
      trackBadge.hidden = !t; if (t) { const d = Math.round(Math.hypot(t.x - game.player.x, t.z - game.player.z)); const text = (tracked ? tr('Takipte') : tr('En yakın hedef')) + ' · ' + (t.name || '') + ' · ' + d + ' m'; if (trackBadge.textContent !== text) trackBadge.textContent = text; }
      ledger();
    }
    function labels(icons) {
      const c = context, s = camera.scale, hereRoom = world.roomAt && world.roomAt(game.player.x, game.player.z);
      const list = rooms.filter(r => visited.has(String(r.id))).sort((a, b) => (b === hereRoom) - (a === hereRoom) || Math.hypot(a.x - camera.x, a.z - camera.z) - Math.hypot(b.x - camera.x, b.z - camera.z));
      const occupied = []; c.textAlign = 'center'; c.textBaseline = 'middle';
      const hitsIcon = (x, y, w) => icons.some(b => Math.abs(b.x - x) < w / 2 + 12 && Math.abs(b.y - y) < 18);
      for (const room of list) {
        const current = room === hereRoom, branch = room.parent !== undefined || room.wing || room.trail || room.hill || room.mole || Math.abs(room.x) > 14;
        if (s < 2.2 && !current && branch) continue; if (s < 1.6 && !current) continue;
        const size = current ? 15 : branch ? 12 : 13.5, text = room.name; c.font = (branch ? 'italic ' : '') + (current ? '600 ' : '400 ') + size + 'px Georgia,"Times New Roman",serif';
        const x = toX(room.x), w = c.measureText(text).width; let y = null;
        for (const f of [-.32, -.12, .3, -.45]) { const yy = toY(room.z + room.d * f); if (x - w / 2 < 12 || x + w / 2 > width - 12 || yy < 20 || yy > height - 30 || occupied.some(b => Math.abs(b.x - x) < (b.w + w) / 2 + 10 && Math.abs(b.y - yy) < 22) || hitsIcon(x, yy, w)) continue; y = yy; break; }
        if (y === null) continue;
        occupied.push({ x, y, w });
        c.lineJoin = 'round'; c.strokeStyle = 'rgba(0,0,0,.85)'; c.lineWidth = 4.5; c.strokeText(text, x, y); c.fillStyle = current ? '#fff0cc' : branch ? S.side : S.label; c.fillText(text, x, y);
        c.strokeStyle = current ? S.accent : 'rgba(255,255,255,.18)'; c.lineWidth = current ? 1 : .6; c.beginPath(); c.moveTo(x - w * .35, y + 10); c.lineTo(x + w * .35, y + 10); c.stroke();
        if (current) { c.fillStyle = S.accent; c.beginPath(); c.moveTo(x, y + 7.5); c.lineTo(x + 2.5, y + 10); c.lineTo(x, y + 12.5); c.lineTo(x - 2.5, y + 10); c.closePath(); c.fill(); }
      }
    }
    function ledger() {
      const reward = game.pendingBossReward || null, r = world.roomAt && world.roomAt(game.player.x, game.player.z), q = game.quests;
      const key = String(r && r.id) + ':' + version + ':' + (q ? q.revision : -1) + ':' + (reward ? reward.uid : '') + ':' + JSON.stringify(tracked); if (key === lastLedger) return; lastLedger = key;
      here.textContent = r ? r.name : TITLES[chapter - 1];
      const pct = footCells ? Math.min(100, Math.round(revealedCells / footCells * 100)) : 0;
      knowledge.textContent = visited.size + tr(' keşfedilen durak') + ' · ' + (KabirI18n.lang === 'tr' ? '%' + pct + ' keşfedildi' : pct + '% explored'); exploredFill.style.width = pct + '%';
      goals.replaceChildren();
      goalHeading.textContent = reward ? tr('Zafer emaneti') : q && q.ready ? tr('Sonraki hedef') : tr('İzlenen yeminler');
      function goal(name, objective, complete, select, isTracked, kind) {
        const block = node('button', 'atlas-goal'); block.type = 'button'; block.dataset.kind = kind || 'main';
        if (complete) block.classList.add('complete'); if (isTracked) block.classList.add('tracked');
        const strong = node('strong', '', name); if (!complete && select) strong.append(node('em', '', isTracked ? tr('Takipte') : tr('Takip et')));
        block.append(strong, node('p', '', objective));
        if (select && !complete) { block.onclick = select; block.setAttribute('aria-label', name + ' · ' + (isTracked ? tr('Takibi bırak') : tr('Bu yemini takip et'))); }
        else if (typeof options.onJournal === 'function') { block.onclick = () => { close(false); options.onJournal(); }; block.setAttribute('aria-label', name + tr(' · Görev günlüğünü aç')); }
        goals.append(block);
      }
      const focus = t => { if (!t) return; camera.x = t.x; camera.z = t.z; camera.scale = Math.max(camera.scale, 3); fitted = false; };
      const choose = spec => () => { const same = tracked && JSON.stringify(tracked) === JSON.stringify(spec); tracked = same ? null : spec; lastLedger = null; updateRoute(true); if (!same) focus(target()); draw(); canvas.focus({ preventScroll: true }); };
      if (reward) {
        const item = B.Progression && Array.isArray(B.Progression.items) && B.Progression.items.find(def => def.id === reward.id);
        goal(item && item.name || tr('Zafer emaneti'), tr('Efendi yenildi. Emanetine yaklaş.'), false, () => { if (Number.isFinite(reward.x)) { camera.x = reward.x; camera.z = reward.z; fitted = false; draw(); } }, true, 'reward');
      } else if (q && q.ready) goal(tr('Efendinin kapısı açık'), q.objective, false, choose({ type: 'gate' }), !!tracked && tracked.type === 'gate', 'gate');
      else (q && q.entries || []).forEach((entry, i) => goal(entry.name, entry.complete ? tr('Bağ çözüldü') : entry.objective, entry.complete, choose({ type: 'main', index: i }), !!tracked && tracked.type === 'main' && tracked.index === i, 'main'));
      if (!reward) for (const e of sideEntries().filter(e => e.available && e.target && !e.complete).slice(0, 3)) goal(e.name, e.objective, false, choose({ type: 'side', id: e.id }), !!tracked && tracked.type === 'side' && tracked.id === e.id, e.kind);
      const nearby = rooms.filter(room => visited.has(String(room.id))).sort((a, b) => Math.hypot(a.x - game.player.x, a.z - game.player.z) - Math.hypot(b.x - game.player.x, b.z - game.player.z)).slice(0, 5); landmarks.replaceChildren();
      for (const room of nearby) { const b = node('button', '', room.name); b.type = 'button'; if (r === room) b.classList.add('here'); b.onclick = () => { camera.x = room.x; camera.z = room.z; camera.scale = Math.max(camera.scale, 4); fitted = false; draw(); }; landmarks.append(b); }
    }
    function resize() { const r = map.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; width = Math.round(r.width); height = Math.round(r.height); pixelRatio = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio); if (opened) { if (!fitOnce || fitted) fit(!fitOnce || fitted === 'nearby'); else draw(); } }
    function keydown(e) {
      if (!opened) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); options.onClose && options.onClose(); return; }
      if (e.key === 'Tab') { const all = Array.from(element.querySelectorAll('button,[tabindex]')).filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length), i = all.indexOf(document.activeElement); if (i < 0 || (e.shiftKey ? i === 0 : i === all.length - 1)) { e.preventDefault(); all[e.shiftKey ? all.length - 1 : 0].focus(); } return; }
      if (document.activeElement !== canvas) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(1.25); } else if (e.key === '-') { e.preventDefault(); zoom(.8); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); fitted = false; camera.x += (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0) * 40 / camera.scale; camera.z += (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0) * 40 / camera.scale; draw(); }
    }
    // Pointer: one finger drags, two fingers pinch; wheel zooms at the cursor.
    const pointers = new Map(); let pinch = null;
    canvas.addEventListener('wheel', e => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); zoom(Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * .002), e.clientX - rect.left, e.clientY - rect.top); }, { passive: false });
    canvas.addEventListener('pointerdown', e => { if (e.button && e.button !== 0) return; canvas.focus({ preventScroll: true }); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size === 2) { const [a, b] = Array.from(pointers.values()); pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: camera.scale }; dragging = null; }
      else if (pointers.size === 1) { dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camera.x, cz: camera.z }; canvas.classList.add('dragging'); } });
    canvas.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) { const [a, b] = Array.from(pointers.values()), rect = canvas.getBoundingClientRect(); const next = pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; zoom(next / camera.scale, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top); return; }
      if (!dragging || e.pointerId !== dragging.id) return; fitted = false; camera.x = dragging.cx - (e.clientX - dragging.x) / camera.scale; camera.z = dragging.cz - (e.clientY - dragging.y) / camera.scale; draw(); });
    function release(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (dragging && e.pointerId === dragging.id) { dragging = null; canvas.classList.remove('dragging'); } }
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    const observer = new ResizeObserver(resize); observer.observe(map);
    function open() { if (disposed) return; if (opened) { explore(); draw(); return; } const openStart = performance.now(); explore(); element.classList.remove('hidden'); opened = true; previousFocus = document.activeElement; lastLedger = null; updateRoute(true); resize(); if (!fitOnce) fit(true); else draw(); canvas.focus({ preventScroll: true }); window.addEventListener('keydown', keydown, true); element.dataset.openMs = (performance.now() - openStart).toFixed(1); }
    function close(restore = true) { if (dragging) { try { canvas.releasePointerCapture(dragging.id); } catch (_) {} dragging = null; canvas.classList.remove('dragging'); } pointers.clear(); pinch = null; opened = false; element.classList.add('hidden'); window.removeEventListener('keydown', keydown, true); if (restore && previousFocus && previousFocus.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true }); previousFocus = null; }
    let lastQuest = -1, lastReward = '';
    function update(dt = 0) {
      if (disposed) return; timer -= Math.max(0, dt); persistTimer -= Math.max(0, dt);
      if (persistDirty && persistTimer <= 0) { persistTimer = 3; persist(); }
      if (timer > 0) return; timer = .4;
      const before = version, reward = game.pendingBossReward, rewardUid = reward ? reward.uid : ''; explore();
      if (game.state === 'playing' || opened) updateRoute(false);
      if (opened && (before !== version || game.quests && game.quests.revision !== lastQuest || rewardUid !== lastReward)) { lastQuest = game.quests ? game.quests.revision : -1; lastReward = rewardUid; draw(); }
    }
    function clear() { visited.clear(); legacy.clear(); trail = []; record.chapters[chapter] = []; if (record.trails) record.trails[chapter] = ''; version++; fitOnce = false; restamp(); persist(); explore(); if (opened) fit(true); }
    function dispose() { if (disposed) return; if (persistDirty) persist(); close(false); disposed = true; observer.disconnect(); element.remove(); if (miniTools) miniTools.remove(); footprint = sdf = terrain = composed = mistBase = maskC = frontC = mistTmp = revealGrid = null; }
    // ---- minimap ---------------------------------------------------------------------------------------------------------------
    let miniSprites = null, miniK = 0, miniKey = '', miniTools = null, miniAngle = 0, miniBg = null, miniBgCtx = null;
    const MINI_BASE = 4.6;
    function buildMiniSprites(k) {
      const sp = {}, mk = (kind, size, o) => sprite((size * 2.6 + 8) * k, x => { x.scale(k, k); if (o && o.glow) { x.shadowColor = o.glow; x.shadowBlur = 6 * k; } icon(x, kind, size, o); });
      sp.enemy = sprite(12 * k, x => { x.scale(k, k); x.fillStyle = '#d0322a'; x.strokeStyle = '#1a0605'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, 2.4, 0, Math.PI * 2); x.fill(); x.stroke(); });
      sp.enemyHot = sprite(20 * k, x => { x.scale(k, k); x.shadowColor = '#ff2a1a'; x.shadowBlur = 6 * k; x.fillStyle = '#ff4a36'; x.strokeStyle = '#1a0605'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, 2.8, 0, Math.PI * 2); x.fill(); x.stroke(); });
      sp.elite = mk('elite', 7, { glow: '#ff9030' }); sp.boss = mk('boss', 8, { glow: '#ff3020' });
      sp.oath0 = mk('oath', 6.5, {}); sp.oath1 = mk('oath', 6.5, { lit: true, glow: '#b8d6a0' });
      sp.main0 = mk('main', 6.5, { label: 'I', glow: '#e9c27a' }); sp.main1 = mk('main', 6.5, { label: 'II', glow: '#e9c27a' });
      for (const kind of ['hunt', 'rescue', 'lore', 'altar', 'chest', 'siege', 'escape', 'puzzle', 'gate', 'reward']) sp[kind] = mk(kind, 6, kind === 'reward' ? { glow: '#ffe08a' } : {});
      sp.gateOpen = mk('gate', 6, { open: true });
      sp.hero = sprite(30 * k, x => { x.scale(k * 1.05, k * 1.05); x.shadowColor = '#f0c27a'; x.shadowBlur = 7 * k; heroShape(x, 0, '#f6e6c6'); });
      sp.arrow = sprite(18 * k, x => { x.scale(k, k); x.fillStyle = S.route; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(7, 0); x.lineTo(-4, -5); x.lineTo(-1.5, 0); x.lineTo(-4, 5); x.closePath(); x.stroke(); x.fill(); });
      return sp;
    }
    function stamp(x, img, sx, sy, rot) { const k = miniK; if (rot) { x.setTransform(Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), sx * k, sy * k); x.drawImage(img, -img.width / 2, -img.height / 2); x.setTransform(1, 0, 0, 1, 0, 0); } else x.drawImage(img, Math.round(sx * k - img.width / 2), Math.round(sy * k - img.height / 2)); }
    function drawMinimap(c) {
      if (disposed || !c) return false; compose();
      const x = c.getContext('2d'), k = c.width / 256, p = game.player, scale = MINI_BASE * mini.zoom, cx = 128, cy = mini.rotate ? 146 : 136;
      const goalAngle = mini.rotate ? Math.PI + (p.face || 0) : 0; let da = goalAngle - miniAngle; da = Math.atan2(Math.sin(da), Math.cos(da)); miniAngle = Math.abs(da) < .01 ? goalAngle : miniAngle + da * .25;
      const range = 128 / scale + 2;
      let key = c.width + '|' + Math.round(p.x * 30) + ',' + Math.round(p.z * 30) + ',' + Math.round((p.face || 0) * 100) + '|' + Math.round(miniAngle * 200) + '|' + composedVersion + '|' + routeVersion + '|' + mini.zoom + (mini.rotate ? 'R' : '') + '|' + (game.checkpointIndex ? 1 : 0) + '|' + (game.quests ? game.quests.revision : '');
      for (const e of game.enemies || []) { if (e.dead || e.reserve || Math.abs(e.x - p.x) > range || Math.abs(e.z - p.z) > range) continue; key += '|' + Math.round(e.x * 20) + ',' + Math.round(e.z * 20) + (e.active ? 'a' : ''); }
      for (const m of game.quests && game.quests.sideMarkers || []) if (m.moving && m.active) key += '|h' + Math.round(m.x * 4) + ',' + Math.round(m.z * 4);
      if (game.gate) key += '|g' + (game.gate.open ? 1 : 0);
      if (key === miniKey) return true; miniKey = key;
      if (!miniSprites || miniK !== k) { miniK = k; miniSprites = buildMiniSprites(k); }
      const sp = miniSprites, ca = Math.cos(miniAngle), sa = Math.sin(miniAngle);
      const proj = (wx, wz) => { const dx = (wx - p.x) * scale, dz = (wz - p.z) * scale; return [cx + dx * ca - dz * sa, cy + dx * sa + dz * ca]; };
      x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, 256, 256);
      if (miniBgCtx !== x) { miniBgCtx = x; miniBg = x.createRadialGradient(128, 128, 10, 128, 128, 132); miniBg.addColorStop(0, rgb(S.bg2, .9)); miniBg.addColorStop(1, rgb(S.bg, .6)); }
      x.fillStyle = miniBg; x.fillRect(0, 0, 256, 256);
      x.save(); x.translate(cx, cy); x.rotate(miniAngle); x.scale(scale, scale); x.translate(-p.x, -p.z);
      x.imageSmoothingEnabled = true; x.drawImage(composed, bounds.x0, bounds.z0, TW / P, TH / P);
      strokeRoute(x, scale / 1.25, .95);
      x.restore(); x.setTransform(1, 0, 0, 1, 0, 0);
      const inside = (sx, sy, r = 116) => (sx - 128) * (sx - 128) + (sy - 128) * (sy - 128) < r * r;
      const edge = (wx, wz, img, always) => { let [sx, sy] = proj(wx, wz); if (inside(sx, sy)) { stamp(x, img, sx, sy); return; } if (!always) return; const a = Math.atan2(sy - 128, sx - 128); stamp(x, img, 128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); stamp(x, sp.arrow, 128 + Math.cos(a) * 117, 128 + Math.sin(a) * 117, a); };
      const cp = world.checkpoint; if (cp && revealedAt(cp.x, cp.z)) edge(cp.x, cp.z, game.checkpointIndex ? sp.oath1 : sp.oath0, false);
      const gate = game.gate; if (gate && Number.isFinite(gate.x) && revealedAt(gate.x, gate.z)) edge(gate.x, gate.z, gate.open ? sp.gateOpen : sp.gate, false);
      for (const e of game.enemies || []) {
        if (e.dead || e.reserve || Math.abs(e.x - p.x) > range || Math.abs(e.z - p.z) > range) continue; const [sx, sy] = proj(e.x, e.z); if (!inside(sx, sy, 124)) continue;
        stamp(x, e.boss ? sp.boss : e.elite || e.champion ? sp.elite : e.active ? sp.enemyHot : sp.enemy, sx, sy);
      }
      const t = target(), q = game.quests, sides = new Map(sideEntries().map(e => [e.id, e]));
      for (const m of q && q.sideMarkers || []) { if (!m.active || m.complete || !Number.isFinite(m.x) || t && t.id === m.id) continue; const e = sides.get(m.side); if (!(e && e.discovered) && !revealedAt(m.x, m.z)) continue; if (sp[m.kind]) edge(m.x, m.z, sp[m.kind], false); }
      for (const m of q && q.markers || []) { if (!m.active || m.complete || !Number.isFinite(m.x) || t && t.id === m.id) continue; edge(m.x, m.z, m.quest ? sp.main1 : sp.main0, false); }
      if (t) edge(t.x, t.z, t.kind === 'main' ? (t.quest ? sp.main1 : sp.main0) : sp[t.kind] || sp.main0, true);
      // North on the rim (moves when the map turns with Bahtiyar).
      { const a = -Math.PI / 2 + miniAngle, nx = 128 + Math.cos(a) * 117, ny = 128 + Math.sin(a) * 117; x.setTransform(k, 0, 0, k, 0, 0); x.font = '600 11px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3; x.strokeStyle = '#000'; x.strokeText(tr('K'), nx, ny); x.fillStyle = S.accent; x.fillText(tr('K'), nx, ny); x.setTransform(1, 0, 0, 1, 0, 0); }
      stamp(x, sp.hero, cx, cy, mini.rotate ? -(p.face || 0) + miniAngle : -(p.face || 0));
      return true;
    }
    function warmMinimap(c) { if (!c) return; const k = c.width / 256; if (!miniSprites || miniK !== k) { miniK = k; miniSprites = buildMiniSprites(k); } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); Object.values(miniSprites).forEach((img, i) => stamp(x, img, 20 + (i % 9) * 26, 30 + Math.floor(i / 9) * 30, i % 2 ? .4 : 0)); miniKey = ''; }
    function saveMini() { try { localStorage.setItem(MINI_STORAGE, JSON.stringify(mini)); } catch (_) {} miniKey = ''; }
    function attachMinimap(c) {
      if (!c || miniTools || !c.parentElement) return; const host = c.parentElement; miniTools = node('div', 'minimap-tools');
      const mk = (text, label, action) => { const b = node('button', '', text); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); action(); b.blur(); }; miniTools.append(b); return b; };
      const levels = [0.7, 1, 1.45];
      mk('+', tr('Küçük haritayı yakınlaştır'), () => { mini.zoom = levels[Math.min(2, levels.indexOf(mini.zoom) + 1)]; saveMini(); });
      mk('−', tr('Küçük haritayı uzaklaştır'), () => { mini.zoom = levels[Math.max(0, levels.indexOf(mini.zoom) - 1)]; saveMini(); });
      const rot = mk('⟲', '', () => { mini.rotate = !mini.rotate; label(); saveMini(); });
      const label = () => { const text = mini.rotate ? tr('Küçük harita Bahtiyar’la döner · sabitle') : tr('Küçük harita sabit · Bahtiyar’la döndür'); rot.setAttribute('aria-label', text); rot.title = text; rot.classList.toggle('on', mini.rotate); };
      label(); host.append(miniTools);
      if (typeof options.onOpen === 'function') { const o = mk('◇', tr('Haritayı aç · M'), options.onOpen); o.classList.add('open-map'); }
    }
    explore();
    return { element, open, close, update, clear, dispose, prepareTerrain, drawTerrain, drawMinimap, warmMinimap, attachMinimap,
      get terrainVersion() { return maskVersion; }, get explored() { return visited.size; }, get revealed() { return footCells ? revealedCells / footCells : 0; }, get tracked() { return target(); }, get route() { return route; } };
  }
  B.Atlas = { create, icon, STYLES };
})();
