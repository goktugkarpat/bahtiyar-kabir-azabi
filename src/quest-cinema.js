/* KABİR AZABI — readable chapter captions and manually closed story pages.
   configure({onReaderOpen, onReaderClose}) lets the app own pause/resume and input reset.
   onReaderOpen must return true before the reader claims modal focus. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const L = (tr, en) => B.QuestText ? B.QuestText(tr, en) : KabirI18n.t(tr);
  let root = null, bars = null, reader = null, epi = null, closeButton = null;
  let barTimer = 0, barLeft = 0, barStamp = 0, barReadable = false;
  let readerPages = [], readerPage = 0, readerNext = null, readerPrevious = null, readerCounter = null;
  let readerTimer = 0, readerModal = false, readerClosing = false, previousFocus = null;
  const hooks = {}, blockedRelease = new Set();
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = () => performance.now();
  function el(tag, cls, parent, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.append(e); return e; }
  function swallow(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function releaseCode(e) { return e.code || e.key; }
  function ensure() {
    if (root) return;
    root = el('div', 'qc-root', document.body);
    bars = el('div', 'qc-bars', root); bars.setAttribute('aria-hidden', 'true');
    el('i', 'qc-bar top', bars); el('i', 'qc-bar bottom', bars);
    const cap = el('div', 'qc-caption', bars); cap.setAttribute('role', 'status'); cap.setAttribute('aria-live', 'polite'); cap.setAttribute('aria-atomic', 'true');
    el('small', 'qc-eyebrow', cap); el('strong', 'qc-title', cap);
    reader = el('div', 'qc-reader', root); reader.hidden = true; reader.setAttribute('role', 'dialog'); reader.setAttribute('aria-modal', 'false'); reader.setAttribute('aria-labelledby', 'qc-reader-title'); reader.setAttribute('aria-describedby', 'qc-reader-text');
    const sheet = el('article', 'qc-sheet', reader); el('small', 'qc-eyebrow', sheet);
    el('h3', 'qc-title', sheet).id = 'qc-reader-title'; el('p', 'qc-text', sheet).id = 'qc-reader-text'; el('p', 'qc-note', sheet);
    const nav = el('div', 'qc-reader-nav', sheet);
    readerPrevious = el('button', 'qc-page-previous', nav, L('Önceki', 'Previous')); readerPrevious.type = 'button'; readerPrevious.onclick = () => changePage(-1);
    readerCounter = el('small', 'qc-page-counter', nav);
    readerNext = el('button', 'qc-page-next', nav, L('Devam', 'Continue')); readerNext.type = 'button'; readerNext.onclick = () => changePage(1);
    closeButton = el('button', 'qc-close', nav, L('Sayfayı kapat', 'Close the page')); closeButton.type = 'button'; closeButton.onclick = e => { e.stopPropagation(); hideReader(); };
    epi = el('div', 'qc-epilogue', root); epi.hidden = true;
    const card = el('article', 'qc-epi-card', epi); el('small', 'qc-eyebrow', card, L('SON', 'THE END')); el('h2', 'qc-title', card); el('div', 'qc-paras', card); el('p', 'qc-tally', card);
    const done = el('button', 'qc-close', card, L('Devam', 'Continue')); done.type = 'button'; done.onclick = () => { epi.classList.remove('show'); setTimeout(() => { epi.hidden = true; }, 900); };
    window.addEventListener('keydown', e => {
      // A fresh press after a lost keyup is allowed; only the release of a closing press is suppressed.
      if (reader.hidden) { blockedRelease.delete(releaseCode(e)); return; }
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') {
        blockedRelease.add(releaseCode(e)); swallow(e); if (!e.repeat) hideReader(); return;
      }
      if ((e.key === 'Enter' && e.target !== closeButton && e.target !== readerPrevious) || e.key === 'ArrowRight') {
        blockedRelease.add(releaseCode(e)); swallow(e); if (!e.repeat) { if (readerPage + 1 < readerPages.length) changePage(1); else hideReader(); } return;
      }
      if (e.key === 'ArrowLeft') { blockedRelease.add(releaseCode(e)); swallow(e); if (!e.repeat) changePage(-1); return; }
      if (!readerModal) return;
      if (e.key === 'Tab') {
        const controls = [readerPrevious, readerNext, closeButton].filter(b => !b.hidden && !b.disabled);
        const i = controls.indexOf(document.activeElement);
        swallow(e); controls[(i + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus({ preventScroll: true });
      }
      else if ((e.key === ' ' || e.key === 'Enter') && [readerPrevious, readerNext, closeButton].includes(e.target)) { blockedRelease.add(releaseCode(e)); swallow(e); if (!e.repeat) e.target.click(); }
      else if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.stopImmediatePropagation();
      else swallow(e);
    }, true);
    window.addEventListener('keyup', e => {
      if (blockedRelease.delete(releaseCode(e))) { swallow(e); return; }
      if (!reader.hidden && readerModal) swallow(e);
    }, true);
    document.addEventListener('visibilitychange', () => { barStamp = clock(); barReadable = false; });
  }
  function readable() {
    const a = B.app;
    return !document.hidden && !document.body.classList.contains('chapter-fading') && (!reader || reader.hidden) && (!a || a.view === 'playing' && a.game && a.game.state === 'playing');
  }
  function hideLetterbox() {
    clearTimeout(barTimer); barTimer = 0; barLeft = 0;
    if (!bars) return;
    bars.classList.remove('show'); bars.setAttribute('aria-hidden', 'true'); document.body.classList.remove('qc-cinema');
  }
  function captionTick() {
    if (!bars || !bars.classList.contains('show')) return;
    const now = clock(), canRead = readable();
    if (canRead && barReadable) { barLeft -= Math.max(0, now - barStamp) / 1000; }
    barStamp = now; barReadable = canRead;
    if (barLeft <= 0) { hideLetterbox(); return; }
    barTimer = setTimeout(captionTick, canRead ? 250 : 1000);
  }
  function readingSeconds(o) { return o && o.kind === 'chapter' ? 3.5 : 0; }
  function letterbox(o) {
    // Chapter identity only. All spoken prose belongs to Audio.onCaption.
    o = o || {};
    if (o.kind !== 'chapter') return 0;
    ensure();
    if (hooks.onCaptionOpen) hooks.onCaptionOpen(o);
    const cap = bars.querySelector('.qc-caption');
    cap.querySelector('.qc-eyebrow').textContent = o.eyebrow || '';
    cap.querySelector('.qc-title').textContent = o.title || ''; cap.querySelector('.qc-title').hidden = !o.title;
    clearTimeout(barTimer); barLeft = 3.5; barStamp = clock(); barReadable = readable();
    bars.classList.add('show'); bars.setAttribute('aria-hidden', 'false'); document.body.classList.add('qc-cinema');
    captionTick(); return barLeft;
  }
  function pageText(text) {
    const paragraphs = String(text || '').split(/\n\s*\n/), pages = []; let page = '';
    for (const paragraph of paragraphs) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
      for (const sentence of sentences) {
        const words = sentence.trim().split(/\s+/);
        for (const word of words) {
          if (page.length + word.length > 620) { pages.push(page.trim()); page = ''; }
          page += (page ? ' ' : '') + word;
        }
      }
      if (page) page += '\n\n';
    }
    if (page.trim()) pages.push(page.trim());
    return pages.length ? pages : [''];
  }
  function changePage(delta) {
    readerPage = Math.max(0, Math.min(readerPages.length - 1, readerPage + delta));
    reader.querySelector('.qc-text').textContent = readerPages[readerPage];
    readerPrevious.hidden = readerPages.length < 2; readerPrevious.disabled = readerPage === 0;
    readerNext.hidden = readerPages.length < 2; readerNext.disabled = readerPage + 1 === readerPages.length;
    readerCounter.textContent = readerPages.length > 1 ? (readerPage + 1) + ' / ' + readerPages.length : '';
    reader.querySelector('.qc-sheet').scrollTop = 0;
  }
  function hideReader(reason = 'dismiss', immediate = false) {
    if (!reader || reader.hidden || readerClosing && !immediate) return;
    readerClosing = true; reader.classList.remove('show'); clearTimeout(readerTimer);
    const finish = () => {
      reader.hidden = true; root.classList.remove('reading'); readerClosing = false;
      const wasModal = readerModal; readerModal = false; reader.setAttribute('aria-modal', 'false');
      if (hooks.onReaderClose) hooks.onReaderClose({ reason, modal: wasModal });
      if (reason !== 'reset' && previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus({ preventScroll: true });
      previousFocus = null;
    };
    if (immediate || reduced()) finish(); else readerTimer = setTimeout(finish, 450);
  }
  function showReader(o) {
    ensure(); o = o || {};
    if (readerClosing) { clearTimeout(readerTimer); readerClosing = false; }
    const wasHidden = reader.hidden, sheet = reader.querySelector('.qc-sheet');
    sheet.querySelector('.qc-eyebrow').textContent = o.eyebrow || L('BULUNAN BELGE', 'RECOVERED DOCUMENT');
    sheet.querySelector('.qc-title').textContent = o.title || '';
    readerPages = Array.isArray(o.pages) && o.pages.length ? o.pages.map(String) : pageText(o.text); readerPage = 0; changePage(0);
    const note = sheet.querySelector('.qc-note'); note.textContent = o.note || ''; note.hidden = !o.note;
    if (wasHidden) { previousFocus = document.activeElement; readerModal = !!(hooks.onReaderOpen && hooks.onReaderOpen(o) === true); }
    reader.setAttribute('aria-modal', readerModal ? 'true' : 'false');
    root.classList.add('reading'); reader.hidden = false; void reader.offsetWidth; reader.classList.add('show');
    if (readerModal) closeButton.focus({ preventScroll: true });
    return readerModal;
  }
  function epilogue(o) {
    ensure(); o = o || {};
    const card = epi.querySelector('.qc-epi-card'); card.querySelector('.qc-title').textContent = o.title || '';
    const paras = card.querySelector('.qc-paras'); paras.textContent = '';
    (o.paragraphs || []).forEach((t, i) => { const p = el('p', 'qc-para', paras, t); p.style.animationDelay = (reduced() ? 0 : 1.2 + i * 2.6) + 's'; });
    card.querySelector('.qc-tally').textContent = o.tally || ''; card.dataset.ending = o.id || '';
    epi.hidden = false; void epi.offsetWidth; epi.classList.add('show');
  }
  function clear() { hideLetterbox(); hideReader('reset', true); if (epi) { epi.classList.remove('show'); epi.hidden = true; } }
  B.QuestCinema = { letterbox, reader: showReader, hideReader, hideLetterbox, epilogue, clear, readingSeconds,
    configure(o) { Object.assign(hooks, o || {}); }, get isReading() { return !!(reader && !reader.hidden); }, get isCaptionVisible() { return !!(bars && bars.classList.contains('show')); } };
})();
