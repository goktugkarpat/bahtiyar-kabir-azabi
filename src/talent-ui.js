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
  const ROW_Y = { 1: 7.5, 2: 25, 3: 43, 4: 59, 5: 75, 6: 92 };
  const KIND = { active: t('Aktif yetenek'), form: t('Dönüşüm'), mod: t('Mühür'), passive: t('Beden'), key: t('Kilit taşı') };
  function pos(n) {
    const colW = 100 / 6; let x = (n.col + .5) * colW, y = ROW_Y[n.row];
    if (n.kind === 'mod') { x += (n.slot - 1) * colW * .31; y += n.slot === 1 ? 3.2 : 0; }
    return { x, y };
  }
  function render(state, h) {
    const T = B.TalentTree, P = B.Progression, esc = h.escape, nodes = T.nodes(), learned = state.learned;
    const sel = T.get(h.selected) || T.get('cleave');
    const colOf = n => T.cols[n.col];
    const game = h.game, inCombat = !!(game && game.talents && game.talents.inCombat && game.talents.inCombat());
    // ---- links (SVG in a 1000 x 1000 box, stretched over the board)
    const links = [];
    const line = (a, b, cls) => { const p = pos(a), q = pos(b); links.push('<path class="tt-link ' + cls + '" d="M' + (p.x * 10).toFixed(1) + ' ' + (p.y * 10).toFixed(1) + ' L' + (q.x * 10).toFixed(1) + ' ' + (q.y * 10).toFixed(1) + '"/>'); };
    for (let c = 0; c < 6; c++) { const x = ((c + .5) * 100 / 6 * 10).toFixed(1); links.push('<path class="tt-spine" d="M' + x + ' 75 L' + x + ' 920" style="stroke:' + T.cols[c].color + '"/>'); }
    for (const n of nodes) {
      if (!n.requires) continue; const p = T.get(n.requires); if (!p) continue;
      const lit = learned.includes(n.id) && learned.includes(p.id), ready = !lit && learned.includes(p.id) && T.access(state, n.id).canLearn;
      line(p, n, lit ? 'lit' : ready ? 'ready' : '');
    }
    // ---- gates (row labels with the points they ask for)
    const spent = learned.length;
    const rows = T.rows.map(r => {
      const need = r.row === 3 ? 3 : r.row === 4 ? 4 : r.row === 5 ? 7 : r.row === 6 ? 6 : r.row === 2 ? 1 : 0, open = spent >= need;
      return '<div class="tt-row' + (open ? ' open' : '') + '" style="top:' + ROW_Y[r.row] + '%"><b>' + (() => { const k = r.name.indexOf(' · '); return k > 0 ? '<span class="tt-roman">' + esc(r.name.slice(0, k)) + '</span><span class="tt-rowword"> · ' + esc(r.name.slice(k + 3)) + '</span>' : esc(r.name); })() + '</b><small>' + esc(r.hint) + '</small></div>';
    }).join('');
    const heads = T.cols.map((c, i) => {
      const count = nodes.filter(n => n.col === i && learned.includes(n.id)).length;
      return '<div class="tt-colhead" style="left:' + ((i + .5) * 100 / 6) + '%;--c:' + c.color + '"><b>' + esc(c.name) + '</b>' + (count ? '<i>' + count + '</i>' : '') + '</div>';
    }).join('');
    const slotOf = id => state.loadout.indexOf(id);
    const html = nodes.map(n => {
      const a = T.access(state, n.id), known = a.known, slot = slotOf(n.id), p = pos(n), c = colOf(n).color;
      const superseded = known && n.skill && slot < 0 && nodes.some(o => o.requires === n.id && o.skill && learned.includes(o.id));
      const cls = 'tt-node skt-node tt-' + n.kind + (known ? ' learned' : a.exclusive ? ' excluded' : a.canLearn ? ' available' : a.blocked ? ' locked' : ' pending') + (superseded ? ' superseded' : '') + (slot >= 0 ? ' slotted' : '') + (n.id === sel.id ? ' selected' : '');
      const art = n.skill ? h.icon(n.id) : glyph(n.glyph, c);
      const title = n.name + ' · ' + KIND[n.kind] + (known ? '' : ' · ' + a.reason);
      return '<button data-char="skill" data-skill="' + n.id + '" class="' + cls + '" style="left:' + p.x.toFixed(2) + '%;top:' + p.y.toFixed(2) + '%;--c:' + c + '" aria-pressed="' + (n.id === sel.id) + '" title="' + esc(title) + '">' +
        '<span class="tt-art">' + art + '</span>' + (n.kind === 'form' ? '<em class="tt-tier">' + (n.skill.tier === 2 ? 'II' : 'III') + '</em>' : '') +
        (slot >= 0 ? '<span class="tt-cap">' + h.capHtml(h.keys[slot]) + '</span>' : '') + (n.kind !== 'mod' ? '<span class="tt-name">' + esc(n.name) + '</span>' : '') + '</button>';
    }).join('');
    // ---- build identity: the two columns with most points
    const weight = T.cols.map((c, i) => ({ c, n: nodes.filter(n => n.col === i && learned.includes(n.id)).length })).filter(o => o.n).sort((a, b) => b.n - a.n);
    const keystone = nodes.find(n => n.kind === 'key' && learned.includes(n.id));
    const identity = weight.length ? weight.slice(0, 2).map(o => '<b style="color:' + o.c.color + '">' + esc(o.c.name) + '</b>').join(' + ') + (keystone ? ' · <b class="tt-keyname">' + esc(keystone.name) + '</b>' : '') : '<i>' + esc(t('Henüz bir yol seçmedin')) + '</i>';
    const respecWhy = !learned.length ? t('Geri alınacak puan yok.') : inCombat ? t('Savaşın ortasında yol değiştirilemez.') : t('Bütün puanlar ücretsiz geri verilir (savaş dışında).');
    const head = '<div class="tt-head"><span class="tt-budget"><b>' + state.points + '</b> ' + esc(t('puan')) + ' <small>' + spent + ' / ' + T.MAX_POINTS + ' ' + esc(t('harcandı')) + ' · ' + T.nodes().length + ' ' + esc(t('düğüm')) + '</small></span>' +
      '<span class="tt-identity">' + esc(t('Yolun:')) + ' ' + identity + '</span>' +
      '<button class="tt-respec" data-char="respec" title="' + esc(respecWhy) + '" ' + (!learned.length || inCombat ? 'disabled' : '') + '>' + esc(t('Yolu sıfırla')) + '</button></div>';
    const board = '<div class="tt-board"><svg class="tt-links" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">' + links.join('') + '</svg>' + rows + heads + html + '</div>';
    const note = '<p class="skt-note tt-note">' + esc(t('Çift tıkla: öğren · Her yeteneğe tek mühür · Tek kilit taşı · 12 puan, 48 düğüm')) + '</p>';
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
      extra = '<p class="tt-rule">' + esc(en() ? 'Seals ' + target.name + ' and all its forms.' : target.name + ' ve bütün dönüşümlerini mühürler.') + '</p><p class="tt-rule excl">✕ ' + esc(en() ? 'Excludes: ' : 'Birlikte alınamaz: ') + rivals.map(r => esc(r.name)).join(', ') + '</p>';
    } else if (sel.kind === 'key') {
      extra = '<p class="tt-price">' + esc(sel.price) + '</p><p class="tt-rule excl">✕ ' + esc(t('Bir yolculukta yalnız bir kilit taşı seçilir.')) + '</p>';
    } else if (sel.kind === 'form') extra = '<p class="tt-rule">' + esc(en() ? 'Replaces ' + T.get(sel.requires).name + ' in its slot.' : T.get(sel.requires).name + ' yerine aynı yuvaya geçer.') + '</p>';
    const canRefund = known && T.canRefund(learned, sel.id, state.level);
    const refund = known ? '<button class="tt-refund" data-char="refund" data-skill="' + sel.id + '" ' + (!canRefund || inCombat ? 'disabled' : '') + ' title="' + esc(inCombat ? t('Savaşın ortasında yol değiştirilemez.') : !canRefund ? t('Bu düğüme bağlı başka düğümler var; önce onları geri al.') : t('Puanı ücretsiz geri al')) + '">' + esc(t('Puanı geri al')) + '</button>' : '';
    const assignment = known && sel.skill ? '<div class="skt-assign"><small>' + esc(t('Hangi yuvaya konsun?')) + '</small><div>' + [0, 1, 2, 3].map(slot => {
      const here = state.loadout[slot] === sel.id, other = P.skills.find(s => s.id === state.loadout[slot]);
      return '<button data-char="assign" data-skill="' + sel.id + '" data-slot="' + slot + '" ' + (here ? 'disabled' : '') + ' aria-label="' + esc(h.slotWord(h.keys[slot]) + ' · ' + sel.name) + '"><span class="skt-cap">' + h.capHtml(h.keys[slot]) + '</span><span>' + (here ? esc(t('Burada')) : other ? esc(other.name) : esc(t('Boş yuva'))) + '</span></button>';
    }).join('') + '</div></div>' : '';
    const learnText = a.canLearn ? t('1 puanla öğren') : a.reason;
    const inspect = '<aside class="skt-inspect tt-inspect" style="--line:' + col.color + '"><small class="skt-kicker">' + esc(KIND[sel.kind]) + ' · ' + esc(col.name) + ' · ' + esc(en() ? 'level ' + sel.level : 'seviye ' + sel.level) + '</small>' +
      '<header>' + (sel.skill ? h.icon(sel.id) : '<span class="tt-bigglyph">' + glyph(sel.glyph, col.color) + '</span>') + '<h3>' + esc(sel.name) + '</h3></header><p>' + esc(sel.desc) + '</p>' + extra + facts +
      '<div class="tt-actions"><button class="skt-learn" data-char="unlock" data-skill="' + sel.id + '" ' + (a.canLearn ? '' : 'disabled') + '>' + esc(known ? t('Öğrenildi') : learnText) + '</button>' + refund + '</div>' + assignment + '</aside>';
    // ---- loadout (same markup as before so the hybrid frame styles apply)
    const loadout = state.loadout.map((id, slot) => {
      const s = P.skills.find(k => k.id === id), label = h.keys[slot];
      return '<div class="skt-slot' + (s ? '' : ' empty') + '"><span class="skt-cap">' + h.capHtml(label) + '</span><button data-char="skill" data-skill="' + (id || sel.id) + '" title="' + esc(s ? s.name : t('Yetenek öğren ve ata')) + '" aria-label="' + esc((s ? s.name : t('Boş yetenek yuvası')) + ' · ' + label) + '">' + (s ? h.icon(s.id) : '') + '</button>' + (s ? '<button class="skt-remove" data-char="assign" data-slot="' + slot + '" data-skill="" aria-label="' + esc(s.name) + '">×</button>' : '') + '</div>';
    }).join('');
    const top = '<div class="skt-top"><div class="skt-loadout"><h4>' + esc(t('Donanılan yetenekler')) + '</h4><div class="skt-slots">' + loadout + '</div></div></div>';
    return '<div class="skt-wrap tt-wrap">' + top + '<div class="skt-workspace"><div class="skt-tree tt-tree">' + head + board + note + '</div>' + inspect + '</div></div>';
  }
  B.TalentTreeUI = Object.freeze({ render });
}());
