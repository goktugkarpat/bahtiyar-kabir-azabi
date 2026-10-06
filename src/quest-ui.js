/* KABİR AZABI — story ledger, objective tracker and quest compass.
   Builds once. During play only a changed quest revision touches the DOM; the compass arrow is a quantized transform.
   Main threads (two, open the master's gate) + side threads from quest-side.js (hunt, rescue, pages, blood price, chest). */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const L = (tr, en) => (B.QuestText ? B.QuestText(tr, en) : KabirI18n.t(tr));
  const ICONS = {
    main: '<path d="M12 2l3 5 5 1-3.6 4 .8 6L12 15.5 6.8 18l.8-6L4 8l5-1z"/>',
    hunt: '<circle cx="12" cy="12" r="7" fill="none" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke-width="2"/><circle cx="12" cy="12" r="1.8"/>',
    rescue: '<path d="M7 9a3 3 0 0 1 3-3h2v3h-2v6h2v3h-2a3 3 0 0 1-3-3z"/><path d="M17 9a3 3 0 0 0-3-3h-1v3h1v6h-1v3h1a3 3 0 0 0 3-3z" opacity=".55"/><path d="M11 4l2-2M11 20l2 2" stroke-width="1.6"/>',
    lore: '<path d="M6 3h9l3 3v15H6z"/><path d="M8.5 9h7M8.5 12h7M8.5 15h5" stroke-width="1.2" stroke="#0b0c0f"/>',
    altar: '<path d="M12 2c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/>',
    chest: '<path d="M3 10h18v10H3z"/><path d="M4 10a8 5 0 0 1 16 0" fill="none" stroke-width="2"/><rect x="10.5" y="12" width="3" height="4" fill="#0b0c0f"/>'
  };
  const icon = kind => '<svg class="quest-kind-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="0">' + (ICONS[kind] || ICONS.main) + '</svg>';
  const T = {
    sideHead: L('Yan Görevler ve Gizli Yollar', 'Side Tasks and Hidden Paths'),
    mainHead: L('Ana Hikâye · Efendinin kapısını açar', 'Main Story · Opens the master’s gate'),
    hiddenLeft: L(' gizli şey hâlâ bulunmayı bekliyor.', ' hidden thing still waits to be found.'),
    pages: L('Okunan sayfalar', 'Pages read'), unread: L('Henüz bulunmadı', 'Not yet found'),
    reward: L('Ödül', 'Reward'), choose: L('KARARINI VER', 'MAKE YOUR CHOICE'), done: L('TAMAMLANDI', 'COMPLETE'), steps: L(' ADIM', ' STEPS'),
    finaleState: L('SON KARAR', 'FINAL CHOICE'), metres: L(' m', ' m'), compass: L('Hedef', 'Target')
  };
  function create(options) {
    const game = options.game, $ = id => document.getElementById(id);
    const tracker = $('quest-tracker'), journal = $('journal-content'), notice = $('quest-notice'), screen = $('journal');
    const rows = [], cards = [], marks = new Map(), sideRows = [], sideCards = [];
    let revision = -1, noticeLeft = 0, showing = false, opened = false, previousFocus = null, compassKey = '';
    const q = game.quests;
    if (!q || !B.Quests) return { update() {}, event() {}, clear() {}, open() {}, close() {}, warm() {} };
    const definition = B.Quests.chapters[q.chapter];
    journal.tabIndex = 0;
    journal.setAttribute('role', 'region'); journal.setAttribute('aria-label', KabirI18n.t('Görev adımları'));
    $('journal-title').textContent = q.title;
    $('journal-intro').textContent = q.introduction;
    const head = (text, cls) => { const h = document.createElement('h3'); h.className = 'journal-section ' + (cls || ''); h.textContent = text; journal.append(h); return h; };
    const bar = () => { const b = document.createElement('span'); b.className = 'quest-bar'; const f = document.createElement('i'); b.append(f); return { el: b, fill: f }; };
    // ---- finale card (chapter 5), hidden until the master falls
    const finale = document.createElement('article'); finale.className = 'journal-quest journal-finale'; finale.hidden = true;
    const finaleTitle = document.createElement('h3'), finaleQ = document.createElement('p'), finaleOpts = document.createElement('div'), finaleOut = document.createElement('p');
    finaleOpts.className = 'journal-options'; finaleOut.className = 'journal-outcome'; finaleQ.className = 'journal-description';
    finale.append(finaleTitle, finaleQ, finaleOpts, finaleOut); journal.append(finale);
    head(T.mainHead, 'main');
    for (let n = 0; n < 2; n++) {
      const entry = q.entries[n], source = definition.quests[n];
      const row = document.createElement('div'); row.className = 'quest-track-row main';
      const seal = document.createElement('i'); seal.className = 'quest-seal'; seal.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span'); title.textContent = entry.name;
      const count = document.createElement('b'); row.append(seal, title, count); tracker.append(row); rows.push({ row, count });
      const card = document.createElement('article'); card.className = 'journal-quest kind-main';
      const header = document.createElement('header');
      const numeral = document.createElement('i'); numeral.className = 'journal-number'; numeral.textContent = n ? 'II' : 'I';
      const names = document.createElement('div'), name = document.createElement('h3'), state = document.createElement('small');
      name.textContent = entry.name; names.append(name, state); header.append(numeral, names);
      const progress = bar(); progress.el.classList.add('journal-bar');
      const description = document.createElement('p'); description.textContent = entry.description; description.className = 'journal-description';
      const steps = document.createElement('ol'); steps.className = 'journal-steps';
      for (const step of source.steps.concat(source.trial ? [source.trial] : [])) {
        const li = document.createElement('li'), symbol = document.createElement('i'); symbol.setAttribute('aria-hidden', 'true');
        const text = document.createElement('div'), stepName = document.createElement('b'), line = document.createElement('p');
        stepName.textContent = step.name; line.textContent = step.objective; text.append(stepName, line); li.append(symbol, text); steps.append(li);
        marks.set(step.id, { li, line, source: step });
      }
      const verdict = document.createElement('section'); verdict.className = 'journal-verdict';
      const verdictName = document.createElement('h4'); verdictName.textContent = source.verdict.title;
      const question = document.createElement('p'); question.textContent = source.verdict.question;
      const opts = document.createElement('div'); opts.className = 'journal-options';
      const buttons = [];
      const outcome = document.createElement('p'); outcome.className = 'journal-outcome'; outcome.hidden = true; outcome.tabIndex = 0; outcome.setAttribute('aria-live', 'polite');
      for (const choice of source.verdict.options) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'journal-choice';
        const label = document.createElement('strong'), effect = document.createElement('span'); label.textContent = choice.name; effect.textContent = choice.effect;
        button.append(label, effect); button.dataset.choice = choice.id;
        button.onclick = () => { if (q.choose && q.choose(entry.id, choice.id)) { revision = -1; update(); card.scrollIntoView({ block: 'nearest' }); outcome.focus({ preventScroll: true }); } };
        opts.append(button); buttons.push(button);
      }
      verdict.append(verdictName, question, opts, outcome);
      card.append(header, progress.el, description, steps, verdict); journal.append(card); cards.push({ card, state, verdict, question, options: opts, buttons, outcome, progress });
    }
    // ---- side threads
    const side = Array.isArray(q.side) ? q.side : [];
    if (side.length) head(T.sideHead, 'side');
    const hiddenNote = document.createElement('p'); hiddenNote.className = 'journal-hidden-note'; journal.append(hiddenNote);
    const sideDefs = (B.QuestSide && B.QuestSide.chapters[q.chapter]) || [];
    side.forEach(entry => {
      const def = sideDefs.find(d => d.id === entry.id) || {};
      const row = document.createElement('div'); row.className = 'quest-track-row side kind-' + entry.kind;
      row.innerHTML = icon(entry.kind); const title = document.createElement('span'); title.textContent = entry.name;
      const count = document.createElement('b'); const mini = bar(); row.append(title, count, mini.el); tracker.append(row);
      sideRows.push({ entry, row, count, mini });
      const card = document.createElement('article'); card.className = 'journal-quest side-quest kind-' + entry.kind;
      const header = document.createElement('header'); const badge = document.createElement('i'); badge.className = 'journal-number journal-kind'; badge.innerHTML = icon(entry.kind);
      const names = document.createElement('div'), name = document.createElement('h3'), state = document.createElement('small');
      name.textContent = entry.name; names.append(name, state); header.append(badge, names);
      const progress = bar(); progress.el.classList.add('journal-bar');
      const description = document.createElement('p'); description.className = 'journal-description'; description.textContent = entry.description;
      const objective = document.createElement('p'); objective.className = 'journal-objective';
      const reward = document.createElement('p'); reward.className = 'journal-reward';
      const rb = document.createElement('b'); rb.textContent = T.reward + ' · '; const rt = document.createElement('span'); rt.textContent = entry.rewardText || ''; reward.append(rb, rt); reward.hidden = !entry.rewardText;
      card.append(header, progress.el, description, objective, reward);
      let pageList = null, choiceBox = null, choiceButtons = [];
      if (entry.pages) {
        pageList = document.createElement('ol'); pageList.className = 'journal-pages';
        const capt = document.createElement('h4'); capt.textContent = T.pages; card.append(capt, pageList);
        entry.pages.forEach(() => { const li = document.createElement('li'); const b = document.createElement('b'); const pTxt = document.createElement('p'); li.append(b, pTxt); pageList.append(li); });
      }
      if (def.verdict) {
        choiceBox = document.createElement('section'); choiceBox.className = 'journal-verdict';
        const h = document.createElement('h4'); h.textContent = def.verdict.title; const qq = document.createElement('p'); qq.textContent = def.verdict.question;
        const box = document.createElement('div'); box.className = 'journal-options';
        def.verdict.options.forEach(choice => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'journal-choice';
          const label = document.createElement('strong'), effect = document.createElement('span'); label.textContent = choice.name; effect.textContent = choice.effect; button.append(label, effect);
          button.onclick = () => { if (q.choose && q.choose(entry.id, choice.id)) { revision = -1; update(); } };
          box.append(button); choiceButtons.push(button);
        });
        choiceBox.append(h, qq, box); card.append(choiceBox);
      }
      const outcome = document.createElement('p'); outcome.className = 'journal-outcome'; outcome.hidden = true; card.append(outcome);
      journal.append(card); sideCards.push({ entry, card, state, progress, objective, outcome, pageList, choiceBox, choiceButtons });
    });
    // ---- compass (HUD): direction and distance to the nearest live objective
    const compass = document.createElement('div'); compass.className = 'quest-compass'; compass.hidden = true;
    compass.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l6 14-6-3.5L6 16z"/></svg><span></span><b></b>';
    tracker.after(compass);
    const arrow = compass.querySelector('svg'), compassName = compass.querySelector('span'), compassDist = compass.querySelector('b');
    function target() {
      const p = game.player; let best = null, bestScore = Infinity;
      const consider = (m, weight) => { if (!m || !m.active || m.complete || !Number.isFinite(m.x)) return; const d = Math.hypot(m.x - p.x, m.z - p.z) * weight; if (d < bestScore) { bestScore = d; best = m; } };
      (q.markers || []).forEach(m => consider(m, .8));
      if (!q.ready) side.forEach(e => { if (e.available && e.target) consider(e.target, 1); });
      else side.forEach(e => { if (e.available && e.target) consider(e.target, 1.4); });
      return best;
    }
    function updateCompass() {
      const p = game.player, t = target();
      if (!t || game.state !== 'playing') { if (!compass.hidden) compass.hidden = true; return; }
      const dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz);
      const deg = Math.round(Math.atan2(dx, -dz) * 180 / Math.PI / 5) * 5, metres = Math.round(dist);
      const key = t.id + '|' + deg + '|' + metres;
      if (key === compassKey) return; compassKey = key;
      compass.hidden = dist < 2.6; arrow.style.transform = 'rotate(' + deg + 'deg)';
      compassName.textContent = t.name; compassDist.textContent = metres + T.metres;
    }
    function update(dt = 0) {
      if (noticeLeft > 0 && dt > 0) { noticeLeft -= dt; if (noticeLeft <= 0) { notice.classList.remove('show'); showing = false; } }
      updateCompass();
      if (revision === q.revision) return;
      revision = q.revision;
      for (let i = 0; i < 2; i++) {
        const entry = q.entries[i], row = rows[i], card = cards[i];
        row.row.classList.toggle('complete', entry.complete); row.count.textContent = entry.complete ? '✓' : entry.step + '/' + entry.steps;
        card.card.classList.toggle('complete', entry.complete); card.state.textContent = entry.complete ? KabirI18n.t('BAĞ ÇÖZÜLDÜ') : entry.step + ' / ' + entry.steps + T.steps;
        card.progress.fill.style.transform = 'scaleX(' + (entry.steps ? entry.step / entry.steps : 0) + ')';
        const pending = q.pendingChoice && !q.pendingChoice.side && q.pendingChoice.questId === entry.id;
        card.card.classList.toggle('awaiting-choice', !!pending); card.card.classList.toggle('has-verdict', !!entry.choice);
        card.verdict.hidden = !pending && !entry.complete && !entry.choice;
        card.options.hidden = !pending; card.question.hidden = !pending;
        card.outcome.hidden = !entry.complete && !entry.choice;
        card.outcome.textContent = entry.outcome ? entry.outcome + ' ' + entry.consequence : KabirI18n.t('Bu bağ önceki yolculuğunda çözüldü.');
        for (const button of card.buttons) button.disabled = !pending;
        if (pending) card.state.textContent = KabirI18n.t('SON KARAR SENİN');
      }
      for (const marker of q.markers) {
        const m = marks.get(marker.id); if (!m) continue;
        const entry = q.entries[marker.quest], selected = definition.quests[marker.quest].verdict.options.find(choice => choice.id === entry.choice);
        m.li.hidden = !!m.source.trial && !(selected && selected.trial);
        m.li.classList.toggle('done', marker.complete); m.li.classList.toggle('current', marker.active);
        m.line.textContent = marker.complete ? KabirI18n.t('Tamamlandı') : m.source.objective;
      }
      let hiddenLeft = 0, shown = 0;
      sideRows.forEach(r => {
        const e = r.entry, visible = e.discovered && !e.complete && shown < 3 && !(e.available === false && e.kind !== 'chest' && e.kind !== 'hunt');
        if (visible) shown++;
        r.row.hidden = !visible; r.row.classList.toggle('complete', e.complete);
        r.count.textContent = e.complete ? '✓' : e.progress + '/' + e.total; r.mini.fill.style.transform = 'scaleX(' + (e.total ? e.progress / e.total : 0) + ')';
      });
      sideCards.forEach(c => {
        const e = c.entry, pending = q.pendingChoice && q.pendingChoice.side && q.pendingChoice.questId === e.id;
        if (!e.discovered) hiddenLeft++;
        c.card.hidden = !e.discovered; c.card.classList.toggle('complete', e.complete); c.card.classList.toggle('awaiting-choice', !!pending);
        c.state.textContent = (e.kind ? B.QuestWords[e.kind] + ' · ' : '') + (pending ? T.choose : e.complete ? T.done : e.progress + ' / ' + e.total);
        c.progress.fill.style.transform = 'scaleX(' + (e.total ? e.progress / e.total : 0) + ')';
        c.objective.textContent = e.objective; c.objective.hidden = e.complete;
        c.outcome.hidden = !e.outcome; c.outcome.textContent = e.outcome || '';
        if (c.pageList) e.pages.forEach((pg, i) => { const li = c.pageList.children[i]; li.classList.toggle('found', pg.found); li.firstChild.textContent = pg.found ? pg.name : '· · ·'; li.lastChild.textContent = pg.found ? pg.text : T.unread; });
        if (c.choiceBox) { c.choiceBox.hidden = !pending; c.choiceButtons.forEach(b => b.disabled = !pending); }
      });
      hiddenNote.hidden = !hiddenLeft; hiddenNote.textContent = hiddenLeft + T.hiddenLeft;
      const fin = q.pendingChoice && q.pendingChoice.finale ? q.pendingChoice : null;
      finale.hidden = !fin && !q.finale;
      if (fin || q.finale) {
        finale.classList.toggle('awaiting-choice', !!fin);
        finaleTitle.textContent = (fin ? fin.title : q.finale.name); finaleQ.textContent = fin ? fin.question : ''; finaleQ.hidden = !fin;
        finaleOpts.hidden = !fin; finaleOut.hidden = !q.finale; finaleOut.textContent = q.finale ? q.finale.story : '';
        if (fin && finaleOpts.dataset.built !== '1') {
          finaleOpts.dataset.built = '1'; finaleOpts.textContent = '';
          fin.options.forEach(choice => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'journal-choice';
            const label = document.createElement('strong'), effect = document.createElement('span'); label.textContent = choice.name; effect.textContent = choice.effect; button.append(label, effect);
            button.onclick = () => { if (q.choose && q.choose('finale', choice.id)) { revision = -1; update(); } };
            finaleOpts.append(button);
          });
        }
      }
      $('journal-gate').classList.toggle('ready', q.ready);
      $('journal-gate-text').textContent = q.pendingChoice ? KabirI18n.t('Bir karar ver; iki yolu birden seçemezsin.') : q.ready ? KabirI18n.t('İki bağ da çözüldü. Efendinin kapısı açık.') : KabirI18n.t('Bağları çözerek efendinin kapısını aç.');
    }
    function event(data) {
      $('quest-notice-state').textContent = data.complete ? KabirI18n.t('GÖREV TAMAMLANDI') : data.choice ? KabirI18n.t('KARARIN KAYDEDİLDİ') : KabirI18n.t('GÖREV İLERLEDİ');
      if (data.side && data.kind && B.QuestWords) $('quest-notice-state').textContent = B.QuestWords[data.kind] ? B.QuestWords[data.kind].toLocaleUpperCase(KabirI18n.lang === 'en' ? 'en' : 'tr') + ' · ' + $('quest-notice-state').textContent : $('quest-notice-state').textContent;
      $('quest-notice-title').textContent = data.name;
      $('quest-notice-text').textContent = data.text;
      notice.dataset.kind = data.side ? data.kind || 'main' : 'main';
      notice.classList.toggle('complete', !!data.complete); notice.classList.add('show');
      noticeLeft = Math.max(7, Math.min(16, data.text.length / 18)); showing = true; update();
    }
    function clear() { close(false); noticeLeft = 0; showing = false; notice.classList.remove('show'); revision = -1; compassKey = ''; }
    function focusable() {
      return Array.from(screen.querySelectorAll('button, input, select, summary, [tabindex]')).filter(el =>
        !el.disabled && el.tabIndex >= 0 && !el.hidden && !el.closest('.hidden,[hidden]') && el.getClientRects().length);
    }
    function keydown(e) {
      if (!opened || screen.classList.contains('hidden')) return;
      if (e.key === 'Tab') {
        const elements = focusable(), index = elements.indexOf(document.activeElement);
        if (!elements.length) return;
        if (index < 0 || (e.shiftKey ? index === 0 : index === elements.length - 1)) {
          e.preventDefault(); elements[e.shiftKey ? elements.length - 1 : 0].focus({ preventScroll: true });
        }
      } else if (document.activeElement === journal && !e.ctrlKey && !e.metaKey && !e.altKey) {
        let next = journal.scrollTop;
        if (e.key === 'ArrowDown') next += 56;
        else if (e.key === 'ArrowUp') next -= 56;
        else if (e.key === 'PageDown') next += journal.clientHeight * .85;
        else if (e.key === 'PageUp') next -= journal.clientHeight * .85;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = journal.scrollHeight;
        else return;
        e.preventDefault(); journal.scrollTop = next;
      }
    }
    function open() {
      update(); if (opened) return;
      opened = true; previousFocus = document.activeElement;
      window.addEventListener('keydown', keydown, true);
      const pendingCard = (finale.classList.contains('awaiting-choice') && !finale.hidden ? finale : null) || cards.map(c => c.card).concat(sideCards.map(c => c.card)).find(card => card.classList.contains('awaiting-choice') && !card.hidden);
      if (pendingCard) { pendingCard.scrollIntoView({ block: 'nearest' }); const b = pendingCard.querySelector('.journal-options button:not([disabled])'); if (b) b.focus({ preventScroll: true }); }
      else $('journal-close').focus({ preventScroll: true });
    }
    function close(restore = true) {
      if (!opened) return;
      opened = false; window.removeEventListener('keydown', keydown, true);
      const t = previousFocus; previousFocus = null;
      if (restore && t && t.isConnected && !t.closest('.hidden,[hidden]') && t.getClientRects().length) t.focus({ preventScroll: true });
    }
    function warm(root) {
      // Called on the loading screen's existing HUD clone, never on the live notification.
      const el = root && root.querySelector('#quest-notice'); if (!el) return;
      el.classList.add('show', 'complete');
      el.querySelector('small').textContent = KabirI18n.t('GÖREV TAMAMLANDI');
      el.querySelector('strong').textContent = definition.quests[0].name;
      el.querySelector('p').textContent = definition.quests[0].steps[0].story;
    }
    update();
    return { update, event, clear, warm, open, close, get showing() { return showing; } };
  }
  B.QuestUI = { create };
})();
