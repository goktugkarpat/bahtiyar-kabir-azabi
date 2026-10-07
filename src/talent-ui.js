/* KABİR AZABI — the talent tree 3 page of the character screen (Diablo IV style board).
   character-ui.js calls B.TalentTreeUI.render(state, h) instead of its old four-path page and keeps its own click handlers:
   data-char="skill" (inspect / double click learns), "unlock", "assign", plus "refund" and "respec" (wired in character-ui.js).
   h: { selected, keys, capHtml, slotWord, icon(id), escape, game }. The board is HTML nodes over one SVG of links. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const t = s => KabirI18n.t(s);
  const en = () => KabirI18n.lang === 'en';
  // engraved glyphs (24 x 24, filled with currentColor)
  const GLYPH = {
    hammer: '<path d="M4 6h11l3 3-3 3H4zM9 12h3v10H9z"/>',
    drop: '<path d="M12 2c4 6 7 9.5 7 13a7 7 0 0 1-14 0c0-3.5 3-7 7-13z"/>',
    flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
    eye: '<path d="M1 12c3-5 7-7 11-7s8 2 11 7c-3 5-7 7-11 7S4 17 1 12zm11 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>',
    hook: '<path d="M14 2h3v11a6 6 0 1 1-12 0h3a3 3 0 1 0 6 0zM15 2l5 3-5 2z"/>',
    wing: '<path d="M2 20C4 10 10 4 22 3c-3 3-4 5-4 7-2 0-4 1-5 3 2 0 3 0 4 1-4 3-9 5-15 6z"/>',
    circle: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 3 3.5 6h-7z"/>',
    heart: '<path d="M12 21C3 15 1 10 1 7a5 5 0 0 1 11-2 5 5 0 0 1 11 2c0 3-2 8-11 14z"/>',
    burst: '<path d="m12 1 2 7 6-4-3 7 6 1-6 3 4 6-7-3-2 7-2-7-7 3 4-6-6-3 6-1-3-7 6 4z"/>',
    spread: '<path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM4 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm16 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM4 16a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm16 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 6l4 4m8-4-4 4M6 18l4-4m8 4-4-4" stroke="currentColor" stroke-width="1.6"/>',
    bell: '<path d="M12 2a2 2 0 0 1 2 2c4 1 5 5 5 9l2 5H3l2-5c0-4 1-8 5-9a2 2 0 0 1 2-2zm-3 18h6a3 3 0 0 1-6 0z"/>',
    shield: '<path d="M12 1 3 5v7c0 6 4 10 9 11 5-1 9-5 9-11V5z"/>',
    wind: '<path d="M2 8h13a3 3 0 1 0-3-3h-2a5 5 0 1 1 5 5H2zm0 4h18a3 3 0 1 1-3 3h2a1 1 0 1 0 1-1H2zm0 4h9v2H2z"/>',
    hourglass: '<path d="M5 2h14v2l-5 8 5 8v2H5v-2l5-8-5-8zm3 2 4 6 4-6zm4 10-4 6h8z"/>',
    flask: '<path d="M9 2h6v2h-1v5l6 9a3 3 0 0 1-3 4H7a3 3 0 0 1-3-4l6-9V4H9z"/>',
    scythe: '<path d="M3 3c8-2 15 0 19 6-5-3-10-3-14-1l12 14-2 1L4 8C3 6 3 4 3 3z"/>',
    axe: '<path d="M4 22 15 5l2 1L6 23zM13 3c5-2 9 0 10 5l-7 6c0-3-2-5-5-5z"/>',
    chain: '<path d="M7 3a4 4 0 0 1 4 4v2H9V7a2 2 0 1 0-4 0v4a2 2 0 0 0 2 2v2a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 6a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4a2 2 0 0 0-2-2zM10 9h4v6h-4z"/>',
    skull: '<path d="M12 2c5 0 9 3.5 9 8.5 0 3-1.5 4.5-3 5.5v3h-3v-2h-2v2h-2v-2H9v2H6v-3c-1.5-1-3-2.5-3-5.5C3 5.5 7 2 12 2zM8 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>'
  };
  const glyph = (name, color) => '<svg class="tt-glyph" viewBox="0 0 24 24" aria-hidden="true" style="color:' + color + '">' + (GLYPH[name] || GLYPH.circle) + '</svg>';
  // Fixed pixel rows: node (art) + a 2-line label band + margin never overlap the next row. The board is ROWH * rows tall and scrolls in its viewport when the screen is short.
  const ROWH = 122, TOP = 12, LABEL = 40, SIZE = { active: 62, form: 48, mod: 48, passive: 54, key: 60 };
  const ROW_TOP = r => (r - 1) * ROWH + TOP;
  // view state that survives re-renders: recommended-build preview, last learned list (learn animation)
  const zoom = 1;   // the slim tree fits at once: no zoom / pan
  let preview = '', seen = null;
  const KIND = { active: t('Aktif yetenek'), form: t('Biçim'), mod: t('Güçlendirme'), passive: t('Yapı'), key: t('Kilit taşı') };
  function pos(n) {
    const x = n.x != null ? n.x : (n.slot != null ? n.col + .25 + .5 * n.slot : n.col + .5) * 100 / 6, size = SIZE[n.kind] || 56, top = ROW_TOP(n.row) + (64 - size) / 2;
    return { x, top, size, bottom: top + size, linkEnd: top + size + LABEL };
  }
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const PAINTED = new Set(['p-frenzy', 'p-momentum', 'k-exec', 'k-blood']);   // painted node icons in assets/ui/talents; the other passives use the engraved glyph only
  const paint = id => PAINTED.has(id) ? '<img class="tt-ico" src="assets/ui/talents/' + id + '.png" alt="" draggable="false">' : '';
  function archLine(n) {
    const T = B.TalentTree, a = T.archOf(n); if (!a) return '';
    const mates = T.archMates(n).slice(0, 4);
    return '<p class="tt-arch-note"><b>' + esc(a) + '</b>' + (mates.length ? ' · ' + esc(t('iyi eşleşir:')) + ' ' + mates.map(esc).join(', ') : '') + '</p>';
  }
  function render(state, h) {
    const T = B.TalentTree, P = B.Progression, esc = h.escape, nodes = T.nodes(), learned = state.learned;
    const sel = T.get(h.selected) || T.get('cleave');
    const colOf = n => T.colOfLine(n.line);
    const game = h.game, inCombat = !!(game && game.talents && game.talents.inCombat && game.talents.inCombat());
    // ---- links (SVG in a 1000 x 1000 box, stretched over the board)
    const links = [];
    const BOARD_H = ROWH * T.rows.length;
    const line = (a, b, cls) => { const p = pos(a), q = pos(b); links.push('<path class="tt-link ' + cls + '" d="M' + (p.x * 10).toFixed(1) + ' ' + p.linkEnd.toFixed(1) + ' L' + (q.x * 10).toFixed(1) + ' ' + (q.top - 4).toFixed(1) + '"/>'); };
    for (const n of nodes) {
      if (!n.requires) continue; let p = T.get(n.requires); if (!p) continue;
      for (const m of nodes) if (m.col === p.col && m.row > p.row && m.row < n.row && m.kind === 'form') p = m;   // the link starts at the form that replaced the active, never through its label
      const root = T.get(n.requires), lit = learned.includes(n.id) && learned.includes(root.id), ready = !lit && learned.includes(root.id) && T.access(state, n.id).canLearn;
      line(p, n, (lit ? 'lit' : ready ? 'ready' : '') + (lit && seen && !seen.includes(n.id) ? ' just' : ''));
    }
    // ---- gates (row labels with the points they ask for)
    const spent = learned.length, bonus = state.boons ? (state.boons().points || 0) : 0;
    const rows = T.rows.map(r => {
      if (!r.name) return ''; const need = r.gate || 0, open = spent >= need;
      return '<div class="tt-row' + (open ? ' open' : '') + '" style="top:' + (ROW_TOP(r.row) + 32) + 'px"><b>' + (() => { const k = r.name.indexOf(' · '); return k > 0 ? '<span class="tt-roman">' + esc(r.name.slice(0, k)) + '</span><span class="tt-rowword"> · ' + esc(r.name.slice(k + 3)) + '</span>' : esc(r.name); })() + '</b><small>' + esc(r.hint) + '</small></div>';
    }).join('');
    const heads = T.cols.map((c, i) => {
      const count = nodes.filter(n => n.line === c.line && learned.includes(n.id)).length;
      return '<div class="tt-colhead" style="left:' + ((i + .5) * 100 / 6) + '%;--c:' + c.color + '"><b>' + esc(c.name) + '</b>' + (count ? '<i>' + count + '</i>' : '') + '</div>';
    }).join('');
    const slotOf = id => state.loadout.indexOf(id);
    const fresh = seen ? learned.filter(id => !seen.includes(id)) : []; seen = learned.slice();
    const pre = preview ? T.presets.find(x => x.id === preview) : null;
    const firstSentence = txt => { const k = txt.search(/[.!?](\s|$)/); return k > 0 ? txt.slice(0, k + 1) : txt; };
    // one button per node, used inside the cards (ids / data attributes / classes stay what character-ui.js and the hover card expect)
    const nodeBtn = n => {
      const a = T.access(state, n.id), known = a.known, slot = slotOf(n.id), c = colOf(n).color;
      const superseded = known && n.skill && slot < 0 && nodes.some(o => o.requires === n.id && o.skill && learned.includes(o.id));
      const cls = 'tt-node skt-node tt-' + n.kind + (n.slot != null ? ' tt-fork' : '') + (known ? ' learned' : a.exclusive ? ' excluded' : a.canLearn ? ' available' : a.blocked ? ' locked' : ' pending') + (superseded ? ' superseded' : '') + (slot >= 0 ? ' slotted' : '') + (n.id === sel.id ? ' selected' : '') + (fresh.includes(n.id) ? ' just' : '');
      const art = n.skill ? h.icon(n.id) : paint(n.id) + glyph(n.glyph, c);
      const title = n.name + ' · ' + KIND[n.kind] + (known ? '' : ' · ' + a.reason);
      const sub = n.kind === 'active' ? firstSentence(n.desc) : n.kind === 'form' ? n.skill.delta : n.kind === 'key' ? n.price : firstSentence(n.desc);
      const state2 = known ? t('Öğrenildi') : a.exclusive ? t('Kilitli') : a.canLearn ? t('Çift tıkla: öğren') : '';
      return '<button data-char="skill" data-skill="' + n.id + '" class="' + cls + '" style="--c:' + c + '" aria-pressed="' + (n.id === sel.id) + '" title="' + esc(title) + '">' +
        '<span class="tt-art">' + art + '</span>' + (fresh.includes(n.id) ? '<i class="tt-burst" aria-hidden="true"></i>' : '') + (slot >= 0 ? '<span class="tt-cap">' + h.capHtml(h.keys[slot]) + '</span>' : '') +
        '<span class="tt-txt"><span class="tt-name">' + esc(n.name) + (n.kind === 'form' ? ' <em class="tt-tier">' + (n.slot ? 'B' : 'A') + '</em>' : '') + '</span><span class="tt-sub">' + esc(sub) + '</span>' + (n.kind === 'active' || n.kind === 'form' ? '<span class="tt-state">' + esc(state2) + '</span>' : '') + '</span></button>';
    };
    const ARCH_COL = { bleed: '#c8473f', rage: '#d9884b', guard: '#a9a4c4', charge: '#c9a45a' };
    const skillCards = T.cols.map(c => {
      const act = nodes.find(n => n.kind === 'active' && n.line === c.line), forms = nodes.filter(n => n.kind === 'form' && n.line === c.line);
      const got = learned.includes(act.id) || forms.some(f => learned.includes(f.id));
      return '<section class="tt-card' + (got ? ' got' : '') + '" style="--c:' + c.color + '"><div class="tt-card-top">' + nodeBtn(act) + '</div><div class="tt-forms">' + forms.map(nodeBtn).join('') + '</div></section>';
    }).join('');
    const pairs = ['pair-a', 'pair-b', 'pair-c', 'pair-d'].map(g => {
      const two = nodes.filter(n => n.group === g); if (two.length < 2) return '';
      return '<section class="tt-pair" style="--c:' + ARCH_COL[two[0].arch] + '"><h4>' + esc(T.archOf(two[0])) + '</h4><div class="tt-pair-row">' + nodeBtn(two[0]) + '<span class="tt-or">' + esc(t('VEYA')) + '</span>' + nodeBtn(two[1]) + '</div></section>';
    }).join('');
    const keys = nodes.filter(n => n.kind === 'key');
    const keyCard = '<section class="tt-pair tt-keys" style="--c:#d8b678"><h4>' + esc(t('Kilit taşı')) + ' · ' + esc(t('Yalnız biri')) + '</h4><div class="tt-pair-row">' + keys.map(nodeBtn).join('<span class="tt-or">' + esc(t('VEYA')) + '</span>') + '</div></section>';
    const html = '<h3 class="tt-sec">' + esc(t('Yetenekler')) + '<small>' + esc(t('İstediğini ilk al')) + ' · ' + esc(t('A ya da B')) + '</small></h3><div class="tt-grid">' + skillCards + '</div>' +
      '<h3 class="tt-sec">' + esc(t('Güçlendirmeler')) + '<small>' + esc(t('İki yoldan biri')) + '</small></h3><div class="tt-grid tt-pairs">' + pairs + '</div>' + keyCard;
    // ---- build identity: the two columns with most points
    const weight = T.cols.map((c, i) => ({ c, n: nodes.filter(n => n.line === c.line && learned.includes(n.id)).length })).filter(o => o.n).sort((a, b) => b.n - a.n);
    const keystone = nodes.find(n => n.kind === 'key' && learned.includes(n.id));
    const title = '';
    const identity = weight.length ? (title ? '<b class="tt-arch">' + esc(title) + '</b> · ' : '') + weight.slice(0, 2).map(o => '<b style="color:' + o.c.color + '">' + esc(o.c.name) + '</b>').join(' + ') + (keystone ? ' · <b class="tt-keyname">' + esc(keystone.name) + '</b>' : '') : '<i>' + esc(t('Henüz bir yol seçmedin')) + '</i>';
    const respecWhy = !learned.length ? t('Geri alınacak puan yok.') : inCombat ? t('Savaşın ortasında yol değiştirilemez.') : t('Bütün puanlar ücretsiz geri verilir (savaş dışında).');
    const head = '<div class="tt-head"><span class="tt-budget"><b>' + state.points + '</b> ' + esc(t('puan')) + ' <small>' + spent + ' / ' + (T.MAX_POINTS + bonus) + ' ' + esc(t('harcandı')) + ' · ' + T.nodes().length + ' ' + esc(t('düğüm')) + '</small></span>' +
      '<span class="tt-identity">' + esc(t('Yolun:')) + ' ' + identity + '</span>' +
      '<button class="tt-respec" data-char="respec" title="' + esc(respecWhy) + '" ' + (!learned.length || inCombat ? 'disabled' : '') + '>' + esc(t('Yolu sıfırla')) + '</button></div>';
    const presets = '';
    const board = '<div class="tt-viewport tt-cardview"><div class="tt-cards">' + html + '</div></div>';
    const note = '<p class="skt-note tt-note">' + esc(t('Çift tıkla: öğren') + ' · ' + t('Tek kilit taşı') + ' · ' + spent + ' / ' + nodes.length) + '</p>';
    // ---- inspect
    const a = T.access(state, sel.id), col = colOf(sel), known = a.known;
    let facts = '';
    if (sel.skill) {
      const eff = T.effective(sel.skill, learned.includes(sel.id) ? learned : learned.concat(sel.id));
      facts = '<div class="skt-facts">' + P.skillFacts(eff).map(([l, v]) => '<div class="skt-fact"><span>' + esc(l) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>';
    }
    let extra = '';
    if (sel.kind === 'mod') {
      const target = T.get(sel.requires), rivals = nodes.filter(n => n.group === sel.group && n.id !== sel.id);
      extra = '<p class="tt-rule">' + esc(en() ? 'Upgrade for ' + target.name + '.' : target.name + ' için güçlendirme.') + '</p>';
    } else if (sel.kind === 'key') {
      extra = '<p class="tt-price">' + esc(sel.price) + '</p><p class="tt-rule excl">✕ ' + esc(t('Bir yolculukta yalnız bir kilit taşı seçilir.')) + '</p>';
    } else if (sel.kind === 'form' || sel.kind === 'passive') {
      const rival = nodes.find(n => n.group === sel.group && n.id !== sel.id);
      extra = (sel.kind === 'form' ? '<p class="tt-rule">' + esc(en() ? 'Replaces ' + T.get(sel.requires).name + ' in its slot.' : T.get(sel.requires).name + ' yerine aynı yuvaya geçer.') + '</p>' : '') + (rival ? '<p class="tt-rule excl">✕ ' + esc(en() ? 'Or: ' : 'Ya da: ') + esc(rival.name) + '</p>' : '');
    }
    const canRefund = known && T.canRefund(learned, sel.id, state.level, bonus);
    const refund = known ? '<button class="tt-refund" data-char="refund" data-skill="' + sel.id + '" ' + (!canRefund || inCombat ? 'disabled' : '') + ' title="' + esc(inCombat ? t('Savaşın ortasında yol değiştirilemez.') : !canRefund ? t('Bu düğüme ya da harcanan puan sayısına bağlı başka düğümler var; önce onları geri al.') : t('Puanı ücretsiz geri al')) + '">' + esc(t('Puanı geri al')) + '</button>' : '';
    const assignment = known && sel.skill ? '<div class="skt-assign"><small>' + esc(t('Hangi yuvaya konsun?')) + '</small><div>' + [0, 1, 2, 3].map(slot => {
      const here = state.loadout[slot] === sel.id, other = P.skills.find(s => s.id === state.loadout[slot]);
      return '<button data-char="assign" data-skill="' + sel.id + '" data-slot="' + slot + '" ' + (here ? 'disabled' : '') + ' aria-label="' + esc(h.slotWord(h.keys[slot]) + ' · ' + sel.name) + '"><span class="skt-cap">' + h.capHtml(h.keys[slot]) + '</span><span>' + (here ? esc(t('Burada')) : other ? esc(other.name) : esc(t('Boş yuva'))) + '</span></button>';
    }).join('') + '</div></div>' : '';
    const learnText = a.canLearn ? t('1 puanla öğren') : a.reason;
    const inspect = '<aside class="skt-inspect tt-inspect" style="--line:' + col.color + '"><small class="skt-kicker">' + esc(KIND[sel.kind]) + ' · ' + esc(col.name) + ' · ' + esc(en() ? 'level ' + sel.level : 'seviye ' + sel.level) + '</small>' +
      '<header>' + (sel.skill ? h.icon(sel.id) : '<span class="tt-bigglyph"><img class="tt-ico" src="assets/ui/talents/' + sel.id + '.png" alt="" draggable="false" onerror="this.remove()">' + glyph(sel.glyph, col.color) + '</span>') + '<h3>' + esc(sel.name) + '</h3></header><p>' + esc(sel.desc) + '</p>' + extra + facts + archLine(sel) +
      '<div class="tt-actions"><button class="skt-learn" data-char="unlock" data-skill="' + sel.id + '" ' + (a.canLearn ? '' : 'disabled') + '>' + esc(known ? t('Öğrenildi') : learnText) + '</button>' + refund + '</div>' + assignment + '</aside>';
    // ---- loadout (same markup as before so the hybrid frame styles apply)
    const loadout = state.loadout.map((id, slot) => {
      const s = P.skills.find(k => k.id === id), label = h.keys[slot];
      return '<div class="skt-slot' + (s ? '' : ' empty') + '"><span class="skt-cap">' + h.capHtml(label) + '</span><button data-char="skill" data-skill="' + (id || sel.id) + '" title="' + esc(s ? s.name : t('Yetenek öğren ve ata')) + '" aria-label="' + esc((s ? s.name : t('Boş yetenek yuvası')) + ' · ' + label) + '">' + (s ? h.icon(s.id) : '') + '</button>' + (s ? '<button class="skt-remove" data-char="assign" data-slot="' + slot + '" data-skill="" aria-label="' + esc(s.name) + '">×</button>' : '') + '</div>';
    }).join('');
    const top = '<div class="skt-top"><div class="skt-loadout"><h4>' + esc(t('Donanılan yetenekler')) + '</h4><div class="skt-slots">' + loadout + '</div></div></div>';
    return '<div class="skt-wrap tt-wrap">' + top + '<div class="skt-workspace"><div class="skt-tree tt-tree">' + head + presets + board + note + '</div>' + inspect + '</div></div>';
  }
  // Actions from the board (character-ui.js forwards data-char="talent"): zoom, preview a recommended build, apply it.
  function action(button, state, game) {
    const act = button.dataset.act, T = B.TalentTree;
    if (act === 'preview') { preview = preview === button.dataset.preset ? '' : button.dataset.preset; return { ok: true, quiet: true }; }
    if (act === 'apply') {
      const pre = T.presets.find(x => x.id === button.dataset.preset); if (!pre || !state) return { ok: false, reason: t('Böyle bir yol yok.') };
      if (game && game.talents && game.talents.inCombat()) return { ok: false, reason: t('Savaşın ortasında yol değiştirilemez.') };
      if (state.learned.length) state.respec();
      const order = T.validate(pre.nodes, state.level, state.boons ? state.boons().points || 0 : 0);
      for (const id of order) state.unlock(id);
      // put the build's actives into the slots in the preset's order (later forms replace their roots)
      const actives = order.filter(id => B.Progression.skills.some(k => k.id === id)), top = [];
      for (const id of actives) { const sk = B.Progression.skills.find(k => k.id === id); const i = top.findIndex(o => B.Progression.skills.find(k => k.id === o).line === sk.line); if (i >= 0) top[i] = id; else top.push(id); }
      top.slice(0, 4).forEach((id, n) => state.assign(n, id));
      preview = '';
      return { ok: true, message: (KabirI18n.lang === 'en' ? 'Path chosen: ' : 'Yol seçildi: ') + pre.name + ' (' + order.length + '/' + pre.nodes.length + ')' };
    }
    return { ok: false, reason: '' };
  }
  // Hover card next to the node (mouse only): name, kind, text, price and why it is locked. The inspect panel stays the click target.
  let tip = null, tipFor = null, lastState = null;
  function hoverCard(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const el = event.target.closest && event.target.closest('.tt-node');
    if (!el) { if (tip && tipFor && !(event.relatedTarget && tipFor.contains(event.relatedTarget))) { tip.hidden = true; tipFor = null; } return; }
    if (el === tipFor || !lastState) return;
    const T = B.TalentTree, n = T.get(el.dataset.skill); if (!n) return;
    if (!tip) { tip = document.createElement('div'); tip.className = 'tt-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    const a = T.access(lastState, n.id), c = T.colOfLine(n.line).color, esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    tip.style.setProperty('--c', c);
    tip.innerHTML = '<small>' + esc(KIND[n.kind]) + ' · ' + esc(T.colOfLine(n.line).name) + '</small><b>' + esc(n.name) + '</b><p>' + esc(n.desc) + '</p>' + (T.archOf(n) ? '<p class="tt-tip-arch">' + esc(T.archOf(n)) + '</p>' : '') + (n.price ? '<p class="tt-tip-price">' + esc(n.price) + '</p>' : '') +
      '<em class="' + (a.known ? 'ok' : a.canLearn ? 'go' : 'no') + '">' + esc(a.known ? t('Öğrenildi') : a.canLearn ? t('Çift tıkla: öğren') : a.reason) + '</em>';
    tip.hidden = false; tipFor = el;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.right + 10; if (x + w > innerWidth - 8) x = r.left - w - 10;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.top + r.height / 2 - h / 2)) + 'px';
  }
  function hideCard() { if (tip) tip.hidden = true; tipFor = null; }
  document.addEventListener('pointerover', hoverCard, true);
  document.addEventListener('pointerdown', hideCard, true);
  document.addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyT' || e.code === 'KeyI') hideCard(); }, true);
  const renderBase = render;
  function renderTracked(state, h) { lastState = state; hideCard(); return renderBase(state, h); }
  B.TalentTreeUI = Object.freeze({ render: renderTracked, action, glyphs: GLYPH });
}());
