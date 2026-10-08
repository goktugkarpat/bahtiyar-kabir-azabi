/* KABİR AZABI — story ledger, objective tracker and quest compass.
   Builds once. During play only a changed quest revision touches the DOM; the compass arrow is a quantized transform.
   HUD tracker: only the active main objective (name, one sentence, step count) and, when useful, a small arrow with the distance.
   Journal: the two main threads with their steps and verdicts, then the optional threads (hunt, rescue, pages) as compact rows
   with a state (done / active / locked), a one-line objective and the reward. No icons, no glow: the iron-and-gold chamber palette only. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const L = (tr, en) => (B.QuestText ? B.QuestText(tr, en) : KabirI18n.t(tr));
  const T = {
    optHead: L('İsteğe Bağlı · Kapıyı açmaz, ödül verir', 'Optional · Does not open the gate, grants rewards'),
    mainHead: L('Ana Hikâye · Efendinin kapısını açar', 'Main Story · Opens the master’s gate'),
    pages: L('Okunan sayfalar', 'Pages read'), unread: L('Henüz bulunmadı', 'Not yet found'),
    reward: L('Ödül', 'Reward'), choose: L('KARARINI VER', 'MAKE YOUR CHOICE'), done: L('Tamamlandı', 'Complete'), steps: L(' ADIM', ' STEPS'),
    locked: L('Kilitli', 'Locked'), open: L('Açık', 'Open'), active: L('Sürüyor', 'In progress'),
    lockedHint: L('Ana hikâye ilerleyince açılır.', 'Opens as the main story advances.'),
    gateOpen: L('Efendinin kapısı açık', 'The master’s gate is open'), metres: L(' m', ' m')
  };
  function create(options) {
    const game = options.game, $ = id => document.getElementById(id);
    const tracker = $('quest-tracker'), journal = $('journal-content'), notice = $('quest-notice'), screen = $('journal');
    const cards = [], marks = new Map(), sideCards = [];
    let revision = -1, noticeLeft = 0, showing = false, opened = false, previousFocus = null, compassKey = '', headKey = '';
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
    // ---- HUD tracker: one head row (the active main thread and its step count); the sentence below it is #objective (app.js)
    const trackRow = document.createElement('div'); trackRow.className = 'quest-track-row main';
    const trackSeal = document.createElement('i'); trackSeal.className = 'quest-seal'; trackSeal.setAttribute('aria-hidden', 'true');
    const trackName = document.createElement('span'), trackCount = document.createElement('b');
    trackRow.append(trackSeal, trackName, trackCount); tracker.append(trackRow);
    head(T.mainHead, 'main');
    for (let n = 0; n < 2; n++) {
      const entry = q.entries[n], source = definition.quests[n];
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
    // ---- optional threads: compact rows, one state mark, one objective line
    const side = Array.isArray(q.side) ? q.side : [];
    if (side.length) head(T.optHead, 'side');
    const list = document.createElement('div'); list.className = 'journal-optional'; if (side.length) journal.append(list);
    side.forEach(entry => {
      const card = document.createElement('article'); card.className = 'journal-opt kind-' + entry.kind;
      const mark = document.createElement('i'); mark.className = 'journal-opt-mark'; mark.setAttribute('aria-hidden', 'true');
      const body = document.createElement('div'); body.className = 'journal-opt-body';
      const top = document.createElement('div'); top.className = 'journal-opt-top';
      const name = document.createElement('h3'), state = document.createElement('small'); name.textContent = entry.name; top.append(name, state);
      const line = document.createElement('p'); line.className = 'journal-opt-line';
      const reward = document.createElement('p'); reward.className = 'journal-opt-reward'; reward.textContent = entry.rewardText ? T.reward + ' · ' + entry.rewardText : ''; reward.hidden = !entry.rewardText;
      body.append(top, line, reward);
      let pageList = null;
      if (entry.pages) {
        pageList = document.createElement('ol'); pageList.className = 'journal-pages';
        entry.pages.forEach((pg, pi) => { const li = document.createElement('li'); li.onclick = () => { const cur = entry.pages[pi]; if (cur.found && B.QuestCinema) B.QuestCinema.reader({ title: cur.name, text: cur.text }); }; li.textContent = '· · ·'; pageList.append(li); });
        body.append(pageList);
      }
      card.append(mark, body); list.append(card); sideCards.push({ entry, card, state, line, reward, pageList });
    });
    // ---- compass (HUD): a small arrow and the distance to the active main objective, only while it is far enough to matter.
    const compass = document.createElement('div'); compass.className = 'quest-compass'; compass.hidden = true;
    compass.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l6 15-6-3.6L6 18z"/></svg><span></span><b></b>';
    const bottom = tracker.parentElement && tracker.parentElement.querySelector('.quest-bottom');
    if (bottom) bottom.prepend(compass); else tracker.after(compass);
    const arrow = compass.querySelector('svg'), compassName = compass.querySelector('span'), compassDist = compass.querySelector('b');
    // Campaign recap uses only earned quest/profile markers. It never changes the quest state.
    const tabs = document.createElement('div'); tabs.className = 'journal-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', L('Günlük bölümleri', 'Journal sections'));
    const questTab = document.createElement('button'), storyTab = document.createElement('button');
    for (const [button, id, label] of [[questTab, 'quests', L('Görevler', 'Quests')], [storyTab, 'story', L('Hikâye', 'Story')]]) {
      button.type = 'button'; button.id = 'journal-tab-' + id; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'journal-' + id + '-body'); button.textContent = label; tabs.append(button);
    }
    journal.before(tabs);
    const questBody = document.createElement('div'); questBody.id = 'journal-quests-body'; questBody.className = 'journal-tasks'; questBody.setAttribute('role', 'tabpanel'); questBody.setAttribute('aria-labelledby', questTab.id);
    while (journal.firstChild) questBody.append(journal.firstChild); journal.append(questBody);
    const storyBody = document.createElement('section'); storyBody.id = 'journal-story-body'; storyBody.className = 'journal-story'; storyBody.setAttribute('role', 'tabpanel'); storyBody.setAttribute('aria-labelledby', storyTab.id); storyBody.hidden = true;
    const storyNav = document.createElement('nav'); storyNav.className = 'story-chapters'; storyNav.setAttribute('aria-label', L('Yaşanan bölümler', 'Chapters experienced'));
    const storyMain = document.createElement('div'); storyMain.className = 'story-main'; storyBody.append(storyNav, storyMain); journal.append(storyBody);
    let journalTab = 'quests', storyChapter = q.chapter, storyKey = '', storyGoal = '';
    const paragraph = text => { const p = document.createElement('p'); p.textContent = text; return p; };
    function storySection(title, texts, cls = '') {
      const section = document.createElement('section'); section.className = 'story-section ' + cls;
      const h = document.createElement('h3'); h.textContent = title; section.append(h);
      texts.filter(Boolean).forEach(text => section.append(paragraph(text))); storyMain.append(section); return section;
    }
    function renderStory(force = false) {
      if (!B.StoryJournal) { storyTab.hidden = true; return; }
      const p = game.progression, key = (p ? p.revision : 0) + '|' + q.revision + '|' + storyChapter + '|' + KabirI18n.lang;
      if (!force && key === storyKey) return; storyKey = key;
      const entries = B.StoryJournal.entries(game);
      if (!entries.some(e => e.chapter === storyChapter)) storyChapter = q.chapter;
      const entry = entries.find(e => e.chapter === storyChapter) || entries[entries.length - 1];
      storyNav.textContent = ''; storyMain.textContent = ''; if (!entry) return;
      entries.forEach(e => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'story-chapter'; button.dataset.chapter = e.chapter;
        const number = document.createElement('span'), name = document.createElement('strong'), state = document.createElement('small');
        number.textContent = ['I', 'II', 'III', 'IV', 'V'][e.chapter - 1]; name.textContent = e.title; state.textContent = e.completed ? L('Geride kalan', 'Completed') : L('Şimdi', 'Current');
        button.append(number, name, state); button.setAttribute('aria-pressed', String(e.chapter === storyChapter));
        button.onclick = () => { storyChapter = e.chapter; renderStory(true); journal.scrollTop = 0; storyNav.querySelector('[data-chapter="' + e.chapter + '"]').focus({ preventScroll: true }); };
        storyNav.append(button);
      });
      const heading = document.createElement('h2'); heading.className = 'story-heading'; heading.textContent = ['I', 'II', 'III', 'IV', 'V'][entry.chapter - 1] + ' · ' + entry.title; storyMain.append(heading);
      storySection(L('Neden buradasın?', 'Why you are here'), [entry.opening]);
      storySection(entry.current && !entry.completed ? L('Amacın', 'Your purpose') : L('Bu bölümdeki amacın', 'Your purpose in this chapter'), [entry.goal], 'story-purpose');
      if (entry.narration && entry.narration.length) {
        const section = document.createElement('section'); section.className = 'story-section story-transcripts';
        const detail = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = L('Bölüm anlatısı', 'Chapter narration'); detail.append(summary);
        entry.narration.forEach(line => { const h = document.createElement('h4'); h.textContent = line.title; detail.append(h, paragraph(line.text)); });
        section.append(detail); storyMain.append(section);
      }
      if (entry.closing) storySection(L('Ne öğrendin?', 'What you learned'), [entry.closing]);
      if (entry.learnedPages) storySection(L('Sayfaların açığa çıkardığı', 'What the pages revealed'), [entry.learnedPages]);
      if (entry.discoveries.length) storySection(L('Bulduğun izler', 'Clues you found'), entry.discoveries.map(e => e.text));
      if (entry.decisions.length) {
        const section = storySection(L('Verdiğin hükümler', 'Your verdicts'), []);
        entry.decisions.forEach(e => { const h = document.createElement('h4'); h.textContent = e.title; section.append(h, paragraph(e.text)); });
      }
      const pages = storySection(L('Okuduğun sayfalar', 'Pages you have read'), []);
      if (!entry.pages.length) pages.append(paragraph(L('Bu bölümden henüz bir sayfa okumadın. Bulduğun sayfalar burada kalır.', 'You have not read a page from this chapter yet. Pages you find remain here.')));
      entry.pages.forEach(pg => {
        const detail = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = pg.title; detail.append(summary, paragraph(pg.text)); pages.append(detail);
      });
      if (entry.ending) storySection(entry.ending.title, [entry.ending.text], 'story-ending');
    }
    function setJournalTab(tab, focus = false) {
      if (tab === 'story' && (!B.StoryJournal || q.pendingChoice)) tab = 'quests';
      journalTab = tab; questBody.hidden = tab !== 'quests'; storyBody.hidden = tab !== 'story';
      questTab.setAttribute('aria-selected', String(tab === 'quests')); storyTab.setAttribute('aria-selected', String(tab === 'story'));
      questTab.tabIndex = tab === 'quests' ? 0 : -1; storyTab.tabIndex = tab === 'story' ? 0 : -1;
      journal.setAttribute('aria-label', tab === 'story' ? L('Hikâye özeti', 'Story recap') : L('Görev adımları', 'Quest steps'));
      journal.scrollTop = 0; if (tab === 'story') renderStory();
      if (focus) (tab === 'story' ? storyTab : questTab).focus({ preventScroll: true });
    }
    questTab.onclick = () => setJournalTab('quests'); storyTab.onclick = () => setJournalTab('story');
    tabs.addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); setJournalTab(e.key === 'Home' ? 'quests' : e.key === 'End' ? 'story' : journalTab === 'quests' ? 'story' : 'quests', true); }
    });
    setJournalTab('quests');
    function target() {
      const p = game.player; let best = null, bestScore = Infinity;
      const consider = (m, weight) => { if (!m || !m.active || m.complete || !Number.isFinite(m.x)) return; const d = Math.hypot(m.x - p.x, m.z - p.z) * weight; if (d < bestScore) { bestScore = d; best = m; } };
      const pin = B.app && B.app.atlasUI && B.app.atlasUI.pinned; if (pin) return pin; // ajan:map — a goal tracked on the atlas steers the compass too
      (q.markers || []).forEach(m => consider(m, 1));
      // An optional thread under way (the freed captive to lead home) is the only side goal that earns an arrow.
      if (!best) side.forEach(e => { if (e.progress > 0 && !e.complete && e.target) consider(e.target, 1); });
      return best;
    }
    function updateCompass() {
      const p = game.player, t = target();
      if (!t || game.state !== 'playing') { if (!compass.hidden) compass.hidden = true; return; }
      const dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz);
      const deg = Math.round(Math.atan2(dx, -dz) * 180 / Math.PI / 5) * 5, metres = Math.round(dist);
      const key = t.id + '|' + deg + '|' + metres;
      if (key === compassKey) return; compassKey = key;
      compass.hidden = dist < 8; arrow.style.transform = 'rotate(' + deg + 'deg)';
      compassName.textContent = (q.markers || []).includes(t) ? '' : t.name; compassDist.textContent = metres + T.metres;
    }
    // The head row follows the thread the sentence below it belongs to (the objective the hero is nearest to).
    function updateHead() {
      const key = q.objective + '|' + q.revision; if (key === headKey) return; headKey = key;
      if (q.ready) { trackName.textContent = T.gateOpen; trackCount.textContent = ''; trackRow.classList.add('complete'); return; }
      const e = q.entries.find(x => !x.complete && x.objective === q.objective) || q.entries.find(x => !x.complete) || q.entries[0];
      trackRow.classList.remove('complete'); trackName.textContent = e.name; trackCount.textContent = e.step + ' / ' + e.steps;
    }
    function update(dt = 0) {
      if (noticeLeft > 0 && dt > 0) { noticeLeft -= dt; if (noticeLeft <= 0) { notice.classList.remove('show'); showing = false; } }
      updateCompass(); updateHead();
      storyTab.disabled = !!q.pendingChoice;
      if (q.pendingChoice && journalTab !== 'quests') setJournalTab('quests');
      if (B.StoryJournal) {
        const goal = B.StoryJournal.currentGoal(game);
        if (goal !== storyGoal) { storyGoal = goal; $('journal-intro').textContent = goal; }
        if (opened && journalTab === 'story') renderStory();
      }
      if (revision === q.revision) return;
      revision = q.revision;
      for (let i = 0; i < 2; i++) {
        const entry = q.entries[i], card = cards[i];
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
      // Optional threads: done / active (open or under way) / locked.
      sideCards.forEach(c => {
        const e = c.entry, st = e.complete ? 'done' : e.locked ? 'locked' : 'active';
        c.card.dataset.state = st; c.card.classList.toggle('started', st === 'active' && e.progress > 0);
        c.state.textContent = st === 'done' ? T.done : st === 'locked' ? T.locked : e.progress > 0 ? T.active + (e.total > 1 ? ' · ' + e.progress + ' / ' + e.total : '') : T.open;
        c.line.textContent = st === 'done' ? '' : st === 'locked' ? T.lockedHint : e.objective; c.line.hidden = st === 'done';
        c.reward.hidden = !e.rewardText || st !== 'active';
        if (c.pageList) { c.pageList.hidden = st === 'locked'; e.pages.forEach((pg, i) => { const li = c.pageList.children[i]; li.classList.toggle('found', pg.found); li.textContent = pg.found ? pg.name : '· · ·'; li.title = pg.found ? '' : T.unread; }); }
      });
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
    function focusPending() {
      const pendingCard = (finale.classList.contains('awaiting-choice') && !finale.hidden ? finale : null) || cards.map(c => c.card).concat(sideCards.map(c => c.card)).find(card => card.classList.contains('awaiting-choice') && !card.hidden);
      if (!pendingCard) return false;
      pendingCard.scrollIntoView({ block: 'nearest' }); const b = pendingCard.querySelector('.journal-options button:not([disabled])'); if (b) b.focus({ preventScroll: true }); return true;
    }
    function open() {
      if (q.pendingChoice) setJournalTab('quests');
      update(); if (opened) { if (q.pendingChoice) focusPending(); return; }
      opened = true; previousFocus = document.activeElement;
      window.addEventListener('keydown', keydown, true);
      if (!focusPending()) $('journal-close').focus({ preventScroll: true });
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
    return { update, event, clear, warm, open, close, get showing() { return showing; }, get activeTab() { return journalTab; } };
  }
  B.QuestUI = { create };
})();
