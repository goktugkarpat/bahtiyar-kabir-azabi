/* KABİR AZABI — talent board (WoW / Diablo style one-screen tree). Replaces talent-ui.js as B.TalentTreeUI.
   character-ui.js calls B.TalentTreeUI.render(state, h) for its "skills" page and keeps its own click handlers:
   data-char="skill" (inspect; double click / double tap learns), "unlock", "assign", "refund", "respec", "talent" (-> action()).
   The tree is drawn on a fixed design canvas (W x H) that is scaled to fit its frame: no scrolling, no zoom, no pan.
   Extra input handled here: hover / long-press card, click-to-slot and drag-to-slot, arrow keys + Enter on the board. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const t = s => KabirI18n.t(s);
  const en = () => KabirI18n.lang === 'en';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  // engraved glyphs (24 x 24) — only shown when a talent picture is missing
  const GLYPH = {
    hammer: '<path d="M4 6h11l3 3-3 3H4zM9 12h3v10H9z"/>', drop: '<path d="M12 2c4 6 7 9.5 7 13a7 7 0 0 1-14 0c0-3.5 3-7 7-13z"/>',
    flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"/>', hook: '<path d="M14 2h3v11a6 6 0 1 1-12 0h3a3 3 0 1 0 6 0zM15 2l5 3-5 2z"/>',
    wing: '<path d="M2 20C4 10 10 4 22 3c-3 3-4 5-4 7-2 0-4 1-5 3 2 0 3 0 4 1-4 3-9 5-15 6z"/>', heart: '<path d="M12 21C3 15 1 10 1 7a5 5 0 0 1 11-2 5 5 0 0 1 11 2c0 3-2 8-11 14z"/>',
    burst: '<path d="m12 1 2 7 6-4-3 7 6 1-6 3 4 6-7-3-2 7-2-7-7 3 4-6-6-3 6-1-3-7 6 4z"/>', spread: '<path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM4 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm16 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM4 16a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm16 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>',
    axe: '<path d="M4 22 15 5l2 1L6 23zM13 3c5-2 9 0 10 5l-7 6c0-3-2-5-5-5z"/>', skull: '<path d="M12 2c5 0 9 3.5 9 8.5 0 3-1.5 4.5-3 5.5v3h-3v-2h-2v2h-2v-2H9v2H6v-3c-1.5-1-3-2.5-3-5.5C3 5.5 7 2 12 2zM8 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
    chain: '<path d="M7 3a4 4 0 0 1 4 4v2H9V7a2 2 0 1 0-4 0v4a2 2 0 0 0 2 2v2a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 6a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4a2 2 0 0 0-2-2zM10 9h4v6h-4z"/>',
    circle: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/>'
  };
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h2v12H5V10zm3 0h4V7a2 2 0 0 0-4 0z"/></svg>';
  const OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 9.6-2l-2.7 1.3A2 2 0 0 0 10 7v3h9v12H5V10z"/></svg>';
  // ---- design canvas: three tree panels side by side (WoW style), two paths per panel ------------------------------
  const W = 800, H = 412, GUT = 44, GAP = 8;
  const PW = (W - GUT - GAP * 2 - 4) / 3;
  const ROW_Y = { 1: 88, 2: 152, 3: 216, 4: 280, 5: 358 };
  const CX = 50;   // a path column sits CX left / right of its panel's centre
  const SIZE = { active: 50, form: 50, mod: 46, passive: 46, key: 58 };
  // panels group the six paths (talent-tree.js columns) into three trees; the rules stay global (gates count all points)
  const GROUPS = [
    { id: 'wrath', name: t('GAZAP'), cols: [0, 3] },
    { id: 'plague', name: t('VEBA'), cols: [1, 5] },
    { id: 'ash', name: t('KÜL'), cols: [2, 4] }
  ];
  const KIND = { active: t('Aktif yetenek'), form: t('Dönüşüm'), mod: t('Mühür'), passive: t('Beden'), key: t('Kilit taşı') };
  const groupOf = col => GROUPS.findIndex(g => g.cols.includes(col));
  const panelX = g => GUT + g * (PW + GAP);
  function pos(n) {
    const g = groupOf(n.col), mid = panelX(g) + PW / 2;
    if (n.kind === 'key') return { x: mid, y: ROW_Y[5], side: 0 };
    const side = GROUPS[g].cols.indexOf(n.col) ? 1 : -1;
    return { x: mid + side * CX, y: ROW_Y[n.row], side };
  }
  // Ranks: every node is one point today. A node with maxRank > 1 (future data) shows a "rank / maxRank" counter.
  const maxRank = n => Math.max(1, n.maxRank | 0);
  const rankOf = (n, learned) => { if (maxRank(n) === 1) return learned.includes(n.id) ? 1 : 0; let k = 0; for (const id of learned) if (id === n.id) k++; return k; };
  const isActive = id => !!(B.Progression && B.Progression.skills.some(k => k.id === id));
  const art = (n, color) => n.skill
    ? '<img src="assets/ui/abilities/' + n.id + '.png" alt="" draggable="false" loading="eager">'
    : '<img src="assets/ui/talents/' + n.id + '.png" alt="" draggable="false" onerror="this.remove()"><svg class="tb-glyph" viewBox="0 0 24 24" aria-hidden="true" style="color:' + color + '">' + (GLYPH[n.glyph] || GLYPH.circle) + '</svg>';
  // view state that survives re-renders
  let seen = null, lastState = null, lastGame = null;
  function shortCap(h, slot) {
    const k = String(h.keys[slot] || '');
    if (k === t('SAĞ TIK')) return '<svg aria-hidden="true"><use href="#i-mouse-r"/></svg>';
    return esc(k.length > 3 ? k.slice(0, 3) : k);
  }
  function splitRow(name) { const k = name.indexOf(' · '); return k > 0 ? [name.slice(0, k), name.slice(k + 3)] : ['', name]; }
  function render(state, h) {
    lastState = state; lastGame = h.game;
    const T = B.TalentTree, P = B.Progression, nodes = T.nodes(), learned = state.learned;
    const sel = T.get(h.selected) || T.get('cleave');
    const game = h.game, inCombat = !!(game && game.talents && game.talents.inCombat && game.talents.inCombat());
    const spent = learned.length, bonus = state.boons ? (state.boons().points || 0) : 0, total = T.MAX_POINTS + bonus;
    const fresh = seen ? learned.filter(id => !seen.includes(id)) : []; seen = learned.slice();
    const slotOf = id => state.loadout.indexOf(id);
    const acc = Object.create(null); for (const n of nodes) acc[n.id] = T.access(state, n.id);
    const gPoints = GROUPS.map(g => nodes.filter(n => g.cols.includes(n.col) && learned.includes(n.id)).length);
    const lead = Math.max(...gPoints);
    const nextGate = T.rows.map(r => r.gate || 0).filter(g => g > spent).sort((x, y) => x - y)[0];
    const nextText = nextGate ? (en() ? 'next row: ' + (nextGate - spent) + ' more' : 'sonraki sıra: ' + (nextGate - spent) + ' puan daha') : t('bütün sıralar açık');
    // ---- links: short arrows between a node and the one it needs ---------------------------------------------------
    const svg = [];
    for (const n of nodes) {
      if (!n.requires) continue; const par = T.get(n.requires); if (!par) continue;
      const a = pos(par), b = pos(n), ra = SIZE[par.kind] / 2, rb = SIZE[n.kind] / 2;
      const lit = learned.includes(n.id) && learned.includes(par.id), ready = !lit && learned.includes(par.id) && acc[n.id].canLearn;
      const cls = (lit ? 'lit' : ready ? 'ready' : learned.includes(par.id) ? 'open' : '') + (lit && fresh.includes(n.id) ? ' just' : '');
      let d;
      if (n.row - par.row <= 1) d = 'M' + a.x.toFixed(1) + ' ' + (a.y + ra + 2) + 'V' + (b.y - rb - 4);
      else { const ox = a.x + a.side * (ra + 13); d = 'M' + (a.x + a.side * (ra + 2)).toFixed(1) + ' ' + a.y + 'H' + ox.toFixed(1) + 'V' + b.y + 'H' + (b.x + b.side * (rb + 5)).toFixed(1); }
      svg.push('<path class="tb-link ' + cls + '" d="' + d + '" marker-end="url(#tb-ah-' + (lit ? 'lit' : ready ? 'ready' : 'dim') + ')"/>');
    }
    const defs = '<defs>' + [['lit', '#f3c56f'], ['ready', '#e4cf7a'], ['dim', '#4a3a2a']].map(([k, c]) => '<marker id="tb-ah-' + k + '" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10 3 5z" fill="' + c + '"/></marker>').join('') +
      '<filter id="tb-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    // ---- panels (tree backgrounds + header strips) -----------------------------------------------------------------
    const panels = GROUPS.map((g, i) => {
      const [c1, c2] = g.cols.map(c => T.cols[c]), first = nodes.find(n => n.col === g.cols[0] && n.kind === 'active'), artId = first ? first.id : 'cleave';
      const cls = 'tb-panel' + (gPoints[i] && gPoints[i] === lead ? ' lead' : gPoints[i] ? ' used' : '');
      return '<div class="' + cls + '" style="left:' + panelX(i).toFixed(1) + 'px;width:' + PW.toFixed(1) + 'px;--c1:' + c1.color + ';--c2:' + c2.color + '">' +
        '<span class="tb-panelart" style="background-image:url(assets/ui/abilities/' + artId + '.png)"></span>' +
        '<header><span class="tb-crest"><img src="assets/ui/abilities/' + artId + '.png" alt="" draggable="false"></span><span class="tb-ptitle"><b>' + esc(g.name) + '</b><small><em>' + gPoints[i] + '</em> ' + esc(t('puan')) + '</small></span>' +
        '<span class="tb-paths"><i style="color:' + c1.color + '">' + esc(c1.name) + '</i><i style="color:' + c2.color + '">' + esc(c2.name) + '</i></span></header>' +
        '<span class="tb-pnext">' + esc(nextText) + '</span></div>';
    }).join('');
    const rows = T.rows.map(r => {
      const need = r.gate || 0, open = spent >= need, [roman] = splitRow(r.name);
      const gate = need ? '<em class="tb-gate">' + (open ? OPEN : LOCK) + '<span>' + Math.min(spent, need) + '/' + need + '</span></em>' : '';
      return '<div class="tb-row' + (open ? ' open' : ' shut') + (r.row === 5 ? ' tb-row-key' : '') + '" style="top:' + ROW_Y[r.row] + 'px" title="' + esc(r.name + ' · ' + r.hint) + '"><b>' + esc(roman) + '</b>' + gate + '</div>';
    }).join('');
    // ---- nodes: square icons, no names (names live in the hover card and the side panel) ---------------------------
    const keyChosen = nodes.find(n => n.kind === 'key' && learned.includes(n.id));
    const html = nodes.map(n => {
      const a = acc[n.id], known = a.known, slot = slotOf(n.id), p = pos(n), c = T.cols[n.col].color;
      const superseded = known && n.skill && slot < 0 && nodes.some(o => o.requires === n.id && o.skill && learned.includes(o.id));
      const st = known ? 'learned' : a.exclusive || (n.kind === 'key' && keyChosen) ? 'excluded' : a.canLearn ? 'available' : a.blocked ? 'locked' : 'pending';
      const assignable = known && !!n.skill;
      const cls = 'skt-node tb-node tb-' + n.kind + ' ' + st + (superseded ? ' superseded' : '') + (slot >= 0 ? ' slotted' : '') + (n.id === sel.id ? ' selected' : '') +
        (fresh.includes(n.id) ? ' just' : '') + (assignable ? ' tb-assignable' : '');
      const label = n.name + ' · ' + KIND[n.kind] + ' · ' + (known ? t('Öğrenildi') : a.reason);
      return '<button type="button" data-char="skill" data-skill="' + n.id + '" class="' + cls + '" style="left:' + p.x.toFixed(1) + 'px;top:' + p.y + 'px;--c:' + c + ';--sz:' + SIZE[n.kind] + 'px" data-gx="' + p.x.toFixed(0) + '" data-gy="' + p.y + '" aria-pressed="' + (n.id === sel.id) + '" aria-label="' + esc(label) + '"' + (assignable ? ' draggable="true"' : '') + '>' +
        '<span class="tb-frame">' + art(n, c) + '</span>' + (n.kind === 'key' ? '<span class="tb-crown" aria-hidden="true"></span>' : '') +
        (maxRank(n) > 1 ? '<span class="tb-rank">' + rankOf(n, learned) + '/' + maxRank(n) + '</span>' : '') +
        (n.kind === 'form' ? '<em class="tb-tier">III</em>' : '') +
        (slot >= 0 ? '<span class="tb-cap">' + shortCap(h, slot) + '</span>' : '') +
        (st === 'excluded' ? '<i class="tb-x" aria-hidden="true"></i>' : st === 'locked' ? '<i class="tb-lock" aria-hidden="true">' + LOCK + '</i>' : '') +
        (fresh.includes(n.id) ? '<i class="tb-burst" aria-hidden="true"></i>' : '') + '</button>';
    }).join('');
    const empty = GROUPS.map((g, i) => nodes.some(n => n.kind === 'key' && g.cols.includes(n.col)) ? '' : '<span class="tb-nokey" style="left:' + (panelX(i) + PW / 2).toFixed(1) + 'px;top:' + ROW_Y[5] + 'px" aria-hidden="true"></span>').join('');
    const board = '<div class="tb-fit"><div class="tb-canvas" style="width:' + W + 'px;height:' + H + 'px">' + panels + rows +
      '<svg class="tb-links" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + defs + svg.join('') + '</svg>' + empty + html + '</div></div>';
    // ---- top bar: points left, spent per tree, respec ----------------------------------------------------------------
    const respecWhy = !learned.length ? t('Geri alınacak puan yok.') : inCombat ? t('Savaşın ortasında yol değiştirilemez.') : t('Bütün puanlar ücretsiz geri verilir (savaş dışında).');
    const top = '<div class="tb-top"><div class="tb-points' + (state.points ? ' has' : '') + '"><b>' + state.points + '</b><span>' + esc(t('PUAN')) + '<small>' + esc(t('kalan')) + '</small></span></div>' +
      '<div class="tb-spent"><b>' + gPoints.join(' / ') + '</b><small>' + spent + ' / ' + total + ' ' + esc(t('harcandı')) + '</small></div>' +
      '<button type="button" class="tb-respec" data-char="respec" title="' + esc(respecWhy) + '" ' + (!learned.length || inCombat ? 'disabled' : '') + '>' + esc(t('Puanları sıfırla')) + '</button></div>';
    // ---- side panel (inspect) — keeps the .skt-inspect class: character-ui.js swaps it on a single click ----------
    const a = T.access(state, sel.id), col = T.cols[sel.col], known = a.known;
    let facts = '';
    if (sel.skill) {
      const eff = T.effective(sel.skill, learned.includes(sel.id) ? learned : learned.concat(sel.id));
      facts = '<dl class="tb-facts">' + P.skillFacts(eff).map(([l, v]) => '<div><dt>' + esc(l) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>';
    }
    let extra = '';
    if (sel.kind === 'key') extra = '<p class="tb-price">' + esc(sel.price) + '</p><p class="tb-rule excl">' + esc(t('Bir yolculukta yalnız bir kilit taşı seçilir.')) + '</p>';
    else if (sel.kind === 'form') extra = '<p class="tb-rule">' + esc(en() ? 'Replaces ' + T.get(sel.requires).name + ' in its slot.' : T.get(sel.requires).name + ' yerine aynı yuvaya geçer.') + '</p>';
    else if (sel.kind === 'mod') extra = '<p class="tb-rule">' + esc(en() ? 'Seal for ' + T.get(sel.requires).name + '.' : T.get(sel.requires).name + ' için mühür.') + '</p>';
    const canRefund = known && T.canRefund(learned, sel.id, state.level, bonus);
    const status = known ? '<p class="tb-status ok">' + esc(t('Öğrenildi')) + '</p>' : a.canLearn ? '<p class="tb-status go">' + esc(t('Öğrenilebilir · 1 puan')) + '</p>' : '<p class="tb-status no">' + LOCK + esc(a.reason) + '</p>';
    const learnBtn = known ? '' : '<button type="button" class="tb-learn" data-char="unlock" data-skill="' + sel.id + '" ' + (a.canLearn ? '' : 'disabled') + '>' + esc(t('Öğren')) + '</button>';
    const refund = known ? '<button type="button" class="tb-refund" data-char="refund" data-skill="' + sel.id + '" ' + (!canRefund || inCombat ? 'disabled' : '') + ' title="' + esc(inCombat ? t('Savaşın ortasında yol değiştirilemez.') : !canRefund ? t('Bu düğüme ya da harcanan puan sayısına bağlı başka düğümler var; önce onları geri al.') : t('Puanı ücretsiz geri al')) + '">' + esc(t('Geri al')) + '</button>' : '';
    const assign = known && sel.skill ? '<div class="tb-assign"><small>' + esc(t('Yuvaya koy')) + '</small>' + state.loadout.map((id, slot) => {
      const here = id === sel.id;
      return '<button type="button" data-char="assign" data-skill="' + sel.id + '" data-slot="' + slot + '" class="' + (here ? 'here' : '') + '" ' + (here ? 'disabled' : '') + ' aria-label="' + esc(h.slotWord(h.keys[slot]) + ' · ' + sel.name) + '">' + h.capHtml(h.keys[slot]) + '</button>';
    }).join('') + '</div>' : '';
    const side = '<aside class="skt-inspect tb-side" style="--c:' + col.color + '"><small class="tb-kicker">' + esc(KIND[sel.kind]) + ' · ' + esc(col.name) + ' · ' + esc(en() ? 'lvl ' + sel.level : 'sv. ' + sel.level) + '</small>' +
      '<header><span class="tb-sideicon tb-' + sel.kind + (known ? ' learned' : '') + '"><span class="tb-frame">' + art(sel, col.color) + '</span></span><h3>' + esc(sel.name) + '</h3></header>' + status +
      '<div class="tb-sidebody"><p class="tb-desc">' + esc(sel.desc) + '</p>' + extra + facts + '</div>' +
      '<div class="tb-actions">' + learnBtn + refund + '</div>' + assign + '</aside>';
    // ---- bottom bar: identity, slot bar, help -------------------------------------------------------------------
    const weight = T.cols.map((c, i) => ({ c, n: nodes.filter(n => n.col === i && learned.includes(n.id)).length })).filter(o => o.n).sort((x, y) => y.n - x.n);
    const title = weight.length > 1 ? T.archetype(weight[0].c.line, weight[1].c.line) : '';
    const ident = weight.length ? (title ? '<b class="tb-arch">' + esc(title) + '</b> ' : '') + weight.slice(0, 2).map(o => '<span style="color:' + o.c.color + '">' + esc(o.c.name) + '</span>').join(' + ') + (keyChosen ? ' · <b class="tb-keyname">' + esc(keyChosen.name) + '</b>' : '')
        : '<i>' + esc(t('Henüz bir yol seçmedin')) + '</i>';
    const slots = state.loadout.map((id, slot) => {
      const s = id ? T.get(id) : null, c = s ? T.cols[s.col].color : '#6b5638';
      return '<div class="tb-slot' + (s ? '' : ' empty') + '" style="--c:' + c + '"><button type="button" class="tb-slot-btn" data-char="skill" data-slot="' + slot + '" data-skill="' + (id || '') + '"' + (s ? ' draggable="true"' : '') + ' aria-label="' + esc((s ? s.name : t('Boş yetenek yuvası')) + ' · ' + h.keys[slot]) + '">' +
        (s ? '<img src="assets/ui/abilities/' + s.id + '.png" alt="" draggable="false">' : '<i aria-hidden="true">+</i>') + '</button><span class="tb-slotcap">' + h.capHtml(h.keys[slot]) + '</span>' +
        (s ? '<button type="button" class="tb-slot-x" data-char="assign" data-slot="' + slot + '" data-skill="" aria-label="' + esc(s.name) + ' ×">×</button>' : '') + '</div>';
    }).join('');
    const bottom = '<div class="tb-bottom"><p class="tb-ident">' + ident + '</p><div class="tb-slots" role="group" aria-label="' + esc(t('Yetenek yuvaları')) + '">' + slots + '</div>' +
      '<p class="tb-help">' + esc(t('Çift tıkla: öğren')) + '<br>' + esc(t('Simgeyi seç, yuvaya tıkla')) + '</p></div>';
    queueMicrotask(fit);
    return '<div class="tb-wrap">' + top + '<div class="tb-main">' + board + side + '</div>' + bottom + '</div>';
  }
  // ---- fit the canvas to its frame (no scroll) ------------------------------------------------------------------
  let watched = null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
  function fit() {
    if (tipFor && !tipFor.isConnected) hideCard();
    const box = document.querySelector('#character .tb-fit'); if (!box) return;
    if (ro && box !== watched) { if (watched) ro.unobserve(watched); ro.observe(box); watched = box; }
    const w = box.clientWidth, hh = box.clientHeight; if (!w || !hh) return;
    const s = Math.max(.3, Math.min(1.6, w / W, hh / H));
    box.style.setProperty('--s', s.toFixed(4));
    box.classList.toggle('tiny', s < .72);
  }
  addEventListener('resize', fit);
  // ---- actions forwarded from character-ui.js (data-char="talent"): none left since the recommended builds strip was removed
  function action() { return { ok: false, reason: '' }; }
  // ---- hover card / long press card ------------------------------------------------------------------------------
  let tip = null, tipFor = null, pressTimer = 0, pressAt = null, hoverTimer = 0;
  function card(el) {
    const T = B.TalentTree, st = lastState; if (!st) return;
    let n = null;
    if (el.classList.contains('tb-slot-btn')) { const id = st.loadout[+el.dataset.slot]; n = id ? T.get(id) : null; } else n = T.get(el.dataset.skill);
    if (!n) return hideCard();
    if (!tip) { tip = document.createElement('div'); tip.className = 'tb-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip); }
    const a = T.access(st, n.id), c = T.cols[n.col].color, mr = maxRank(n);
    let facts = '';
    if (n.skill && B.Progression.skillFacts) {
      const eff = T.effective(n.skill, st.learned.includes(n.id) ? st.learned : st.learned.concat(n.id));
      facts = '<dl>' + B.Progression.skillFacts(eff).slice(0, 6).map(([l, v]) => '<div><dt>' + esc(l) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>';
    }
    const state = a.known ? t('Öğrenildi') : a.canLearn ? t('Öğrenilebilir · 1 puan') : a.reason;
    const hint = a.known ? (n.skill ? t('Sürükle ya da seç ve yuvaya tıkla') : '') : a.canLearn ? t('Çift tıkla: öğren') : '';
    tip.style.setProperty('--c', c);
    tip.innerHTML = '<small>' + esc(KIND[n.kind]) + ' · ' + esc(T.cols[n.col].name) + (mr > 1 ? ' · ' + rankOf(n, st.learned) + '/' + mr : '') + '</small><b>' + esc(n.name) + '</b><p>' + esc(n.desc) + '</p>' +
      (n.price ? '<p class="tb-tip-price">' + esc(n.price) + '</p>' : '') + facts +
      '<em class="' + (a.known ? 'ok' : a.canLearn ? 'go' : 'no') + '">' + (a.known || a.canLearn ? '' : LOCK) + esc(state) + '</em>' + (hint ? '<i class="tb-tip-hint">' + esc(hint) + '</i>' : '');
    tip.hidden = false; tipFor = el;
    const r = el.querySelector('.tb-frame, img, i') ? (el.querySelector('.tb-frame') || el).getBoundingClientRect() : el.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = r.right + 12; if (x + w > innerWidth - 8) x = r.left - w - 12;
    let y = r.top + r.height / 2 - hh / 2;
    if (el.classList.contains('tb-slot-btn')) { x = r.left + r.width / 2 - w / 2; y = r.top - hh - 10; }
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px'; tip.style.top = Math.max(8, Math.min(innerHeight - hh - 8, y)) + 'px';
  }
  function hideCard() { if (tip) tip.hidden = true; tipFor = null; }
  const target = e => e.target && e.target.closest ? e.target.closest('#character .tb-node, #character .tb-slot-btn') : null;
  document.addEventListener('pointerover', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = target(e);
    if (!el) { if (tipFor && !(e.relatedTarget && tipFor.contains(e.relatedTarget))) hideCard(); return; }
    if (el !== tipFor) { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => { if (el.isConnected && el.matches(':hover')) card(el); }, 100); }
  }, true);
  document.addEventListener('pointerout', e => { const el = target(e); if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) { clearTimeout(hoverTimer); if (tipFor === el) hideCard(); } }, true);
  document.addEventListener('pointerdown', e => {
    clearTimeout(pressTimer); hideCard();
    const el = target(e); if (!el || e.pointerType === 'mouse') return;
    pressAt = { x: e.clientX, y: e.clientY };
    pressTimer = setTimeout(() => { pressTimer = 0; card(el); }, 430);
  }, true);
  document.addEventListener('pointermove', e => { if (pressTimer && pressAt && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 12) { clearTimeout(pressTimer); pressTimer = 0; } }, true);
  document.addEventListener('pointerup', () => { clearTimeout(pressTimer); pressTimer = 0; }, true);
  document.addEventListener('pointercancel', () => { clearTimeout(pressTimer); pressTimer = 0; }, true);
  document.addEventListener('contextmenu', e => { if (target(e)) e.preventDefault(); }, true);
  document.addEventListener('scroll', hideCard, true);
  // ---- slot bar: click-to-slot and drag-to-slot ---------------------------------------------------------------------
  let dragId = null, dropId = null;
  const selectedId = () => { const el = document.querySelector('#character .tb-node.selected'); return el ? el.dataset.skill : null; };
  // Runs before character-ui.js's own click handler (capture on document): turns the slot into an assign or an inspect button.
  document.addEventListener('click', e => {
    const btn = e.target && e.target.closest && e.target.closest('#character .tb-slot-btn'); if (!btn || !lastState) return;
    const st = lastState, slot = +btn.dataset.slot, id = dropId || selectedId(); dropId = null;
    if (id && st.learned.includes(id) && isActive(id) && st.loadout[slot] !== id) { btn.dataset.char = 'assign'; btn.dataset.skill = id; }
    else { btn.dataset.char = 'skill'; btn.dataset.skill = st.loadout[slot] || id || 'cleave'; }
    hideCard();
  }, true);
  document.addEventListener('dragstart', e => {
    const el = e.target && e.target.closest && e.target.closest('#character .tb-node[draggable="true"], #character .tb-slot-btn[draggable="true"]'); if (!el || !lastState) return;
    dragId = el.classList.contains('tb-slot-btn') ? lastState.loadout[+el.dataset.slot] : el.dataset.skill;
    if (!dragId) return;
    hideCard();
    try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; const img = el.querySelector('img'); if (img) e.dataTransfer.setDragImage(img, 24, 24); } catch (_) { /* old browsers */ }
    document.querySelectorAll('#character .tb-slot').forEach(s => s.classList.add('dropzone'));
  }, true);
  document.addEventListener('dragover', e => {
    const s = dragId && e.target.closest && e.target.closest('#character .tb-slot'); if (!s) return;
    e.preventDefault(); document.querySelectorAll('#character .tb-slot.over').forEach(o => o !== s && o.classList.remove('over')); s.classList.add('over');
  }, true);
  document.addEventListener('drop', e => {
    const s = dragId && e.target.closest && e.target.closest('#character .tb-slot'); if (!s) return;
    e.preventDefault(); dropId = dragId; dragId = null; s.querySelector('.tb-slot-btn').click();
  }, true);
  document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('#character .tb-slot').forEach(s => s.classList.remove('dropzone', 'over')); }, true);
  // ---- keyboard: arrows move across the board, Enter learns ---------------------------------------------------------
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' || e.code === 'KeyT' || e.code === 'KeyI') hideCard();
    const el = e.target && e.target.closest && e.target.closest('#character .tb-node'); if (!el) return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      e.preventDefault(); e.stopPropagation();
      const x0 = +el.dataset.gx, y0 = +el.dataset.gy; let best = null, bd = Infinity;
      for (const o of document.querySelectorAll('#character .tb-node')) {
        if (o === el) continue; const dx = +o.dataset.gx - x0, dy = +o.dataset.gy - y0, along = dx * dir[0] + dy * dir[1];
        if (along <= 4) continue; const side = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]), d = along + side * 2.2;
        if (d < bd) { bd = d; best = o; }
      }
      if (best) { best.focus({ preventScroll: true }); best.click(); card(best); }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopPropagation(); const id = el.dataset.skill;
      el.click();
      const learn = document.querySelector('#character .tb-side [data-char="unlock"]:not(:disabled)');
      if (learn && learn.dataset.skill === id) learn.click();
    }
  }, true);
  B.TalentTreeUI = Object.freeze({ render, action, glyphs: GLYPH, fit });
}());
