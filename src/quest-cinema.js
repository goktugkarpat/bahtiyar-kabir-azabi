/* KABİR AZABI — story presentation (ajan: quests).
   BABA.QuestCinema.letterbox({eyebrow, title, text, seconds})  cinema bars + slow subtitle for chapter openings and a master's last words
   BABA.QuestCinema.reader({eyebrow, title, text, note})          a dark parchment reader for the Scribe's torn pages
   BABA.QuestCinema.epilogue({title, paragraphs, tally})          the campaign's closing card (one of three endings)
   Pure DOM/CSS: no canvas, no per-frame work; timers only while something is on screen. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const L = (tr, en) => (B.QuestText ? B.QuestText(tr, en) : KabirI18n.t(tr));
  let root = null, bars = null, reader = null, epi = null, barTimer = 0, readerTimer = 0;
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, parent, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.append(e); return e; }
  function ensure() {
    if (root) return;
    root = el('div', 'qc-root', document.body); root.setAttribute('aria-live', 'polite');
    bars = el('div', 'qc-bars', root); el('i', 'qc-bar top', bars); el('i', 'qc-bar bottom', bars);
    const cap = el('div', 'qc-caption', bars); el('small', 'qc-eyebrow', cap); el('strong', 'qc-title', cap); el('p', 'qc-text', cap);
    reader = el('div', 'qc-reader', root); reader.hidden = true; reader.setAttribute('role', 'dialog'); reader.setAttribute('aria-modal', 'false');
    const sheet = el('article', 'qc-sheet', reader); el('small', 'qc-eyebrow', sheet); el('h3', 'qc-title', sheet); el('p', 'qc-text', sheet); el('p', 'qc-note', sheet);
    const close = el('button', 'qc-close', sheet, L('Sayfayı katla', 'Fold the page')); close.type = 'button'; close.onclick = () => hideReader();
    epi = el('div', 'qc-epilogue', root); epi.hidden = true;
    const card = el('article', 'qc-epi-card', epi); el('small', 'qc-eyebrow', card, L('SON', 'THE END')); el('h2', 'qc-title', card); el('div', 'qc-paras', card); el('p', 'qc-tally', card);
    const done = el('button', 'qc-close', card, L('Devam', 'Continue')); done.type = 'button'; done.onclick = () => { epi.classList.remove('show'); setTimeout(() => { epi.hidden = true; }, 900); };
    window.addEventListener('keydown', e => { if (!reader.hidden && (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { hideReader(); e.stopPropagation(); } }, true);
  }
  function letterbox(o) {
    ensure(); o = o || {};
    const cap = bars.querySelector('.qc-caption');
    cap.querySelector('.qc-eyebrow').textContent = o.eyebrow || '';
    cap.querySelector('.qc-title').textContent = o.title || ''; cap.querySelector('.qc-title').hidden = !o.title;
    cap.querySelector('.qc-text').textContent = o.text || '';
    bars.classList.remove('show'); void bars.offsetWidth; bars.classList.add('show'); document.body.classList.add('qc-cinema');
    clearTimeout(barTimer);
    barTimer = setTimeout(() => { bars.classList.remove('show'); document.body.classList.remove('qc-cinema'); }, Math.max(4, o.seconds || 8) * 1000);
  }
  function hideReader() { if (!reader || reader.hidden) return; reader.classList.remove('show'); clearTimeout(readerTimer); setTimeout(() => { reader.hidden = true; }, 450); }
  function showReader(o) {
    ensure(); o = o || {};
    const sheet = reader.querySelector('.qc-sheet');
    sheet.querySelector('.qc-eyebrow').textContent = o.eyebrow || L('KÂTİBİN YIRTIK SAYFASI', 'THE SCRIBE’S TORN PAGE');
    sheet.querySelector('.qc-title').textContent = o.title || '';
    sheet.querySelector('.qc-text').textContent = o.text || '';
    const note = sheet.querySelector('.qc-note'); note.textContent = o.note || ''; note.hidden = !o.note;
    reader.hidden = false; void reader.offsetWidth; reader.classList.add('show');
    clearTimeout(readerTimer); readerTimer = setTimeout(hideReader, Math.max(9, Math.min(24, ((o.text || '').length + (o.note || '').length) / 11)) * 1000);
  }
  function epilogue(o) {
    ensure(); o = o || {};
    const card = epi.querySelector('.qc-epi-card');
    card.querySelector('.qc-title').textContent = o.title || '';
    const paras = card.querySelector('.qc-paras'); paras.textContent = '';
    (o.paragraphs || []).forEach((t, i) => { const p = el('p', 'qc-para', paras, t); p.style.animationDelay = (reduced() ? 0 : 1.2 + i * 2.6) + 's'; });
    card.querySelector('.qc-tally').textContent = o.tally || '';
    card.dataset.ending = o.id || '';
    epi.hidden = false; void epi.offsetWidth; epi.classList.add('show');
  }
  B.QuestCinema = { letterbox, reader: showReader, hideReader, epilogue };
})();
