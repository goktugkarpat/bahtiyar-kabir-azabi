/* KABİR AZABI — story ledger and a small, event-driven objective tracker.
   Builds once. During play only a changed quest revision touches the DOM. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  function create(options) {
    const game = options.game, $ = id => document.getElementById(id);
    const tracker = $('quest-tracker'), journal = $('journal-content'), notice = $('quest-notice'), screen = $('journal');
    const rows = [], cards = [], marks = new Map();
    let revision = -1, noticeLeft = 0, showing = false, opened = false, previousFocus = null;
    const q = game.quests;
    if (!q || !B.Quests) return { update() {}, event() {}, clear() {}, open() {}, close() {}, warm() {} };
    const definition = B.Quests.chapters[q.chapter];
    journal.tabIndex = 0;
    journal.setAttribute('role', 'region'); journal.setAttribute('aria-label', KabirI18n.t('Görev adımları'));
    $('journal-title').textContent = q.title;
    $('journal-intro').textContent = q.introduction;
    for (let n = 0; n < 2; n++) {
      const entry = q.entries[n], source = definition.quests[n];
      const row = document.createElement('div'); row.className = 'quest-track-row';
      const seal = document.createElement('i'); seal.className = 'quest-seal'; seal.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span'); title.textContent = entry.name;
      const count = document.createElement('b'); row.append(seal, title, count); tracker.append(row); rows.push({ row, count });
      const card = document.createElement('article'); card.className = 'journal-quest';
      const head = document.createElement('header');
      const numeral = document.createElement('i'); numeral.className = 'journal-number'; numeral.textContent = n ? 'II' : 'I';
      const names = document.createElement('div'), name = document.createElement('h3'), state = document.createElement('small');
      name.textContent = entry.name; names.append(name, state); head.append(numeral, names);
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
      const options = document.createElement('div'); options.className = 'journal-options';
      const buttons = [];
      for (const choice of source.verdict.options) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'journal-choice';
        const label = document.createElement('strong'), effect = document.createElement('span'); label.textContent = choice.name; effect.textContent = choice.effect;
        button.append(label, effect); button.dataset.choice = choice.id;
        button.onclick = () => { if (q.choose && q.choose(entry.id, choice.id)) { revision = -1; update(); card.scrollIntoView({ block: 'nearest' }); outcome.focus({ preventScroll: true }); } };
        options.append(button); buttons.push(button);
      }
      const outcome = document.createElement('p'); outcome.className = 'journal-outcome'; outcome.hidden = true; outcome.tabIndex = 0; outcome.setAttribute('aria-live', 'polite');
      verdict.append(verdictName, question, options, outcome);
      card.append(head, description, steps, verdict); journal.append(card); cards.push({ card, state, verdict, question, options, buttons, outcome });
    }
    function update(dt = 0) {
      if (noticeLeft > 0 && dt > 0) { noticeLeft -= dt; if (noticeLeft <= 0) { notice.classList.remove('show'); showing = false; } }
      if (revision === q.revision) return;
      revision = q.revision;
      for (let i = 0; i < 2; i++) {
        const entry = q.entries[i], row = rows[i], card = cards[i];
        row.row.classList.toggle('complete', entry.complete); row.count.textContent = entry.complete ? '✓' : entry.step + '/' + entry.steps;
                card.card.classList.toggle('complete', entry.complete); card.state.textContent = entry.complete ? KabirI18n.t('BAĞ ÇÖZÜLDÜ') : entry.step + ' / ' + entry.steps + ' ADIM';
        const pending = q.pendingChoice && q.pendingChoice.questId === entry.id;
        card.card.classList.toggle('awaiting-choice', !!pending); card.card.classList.toggle('has-verdict', !!entry.choice);
        card.verdict.hidden = !pending && !entry.complete && !entry.choice;
        card.options.hidden = !pending;
        card.question.hidden = !pending;
        card.outcome.hidden = !entry.complete && !entry.choice;
        card.outcome.textContent = entry.outcome ? entry.outcome + ' ' + entry.consequence : KabirI18n.t('Bu bağ önceki yolculuğunda çözüldü.');
        for (const button of card.buttons) button.disabled = !pending;
        card.state.textContent = pending ? KabirI18n.t('SON KARAR SENİN') : card.state.textContent;
      }
      for (const marker of q.markers) {
        const m = marks.get(marker.id); if (!m) continue;
        const entry = q.entries[marker.quest], selected = definition.quests[marker.quest].verdict.options.find(choice => choice.id === entry.choice);
        m.li.hidden = !!m.source.trial && !(selected && selected.trial);
        m.li.classList.toggle('done', marker.complete); m.li.classList.toggle('current', marker.active);
        m.line.textContent = marker.complete ? KabirI18n.t('Tamamlandı') : m.source.objective;
      }
      $('journal-gate').classList.toggle('ready', q.ready);
      $('journal-gate-text').textContent = q.pendingChoice ? KabirI18n.t('Bir karar ver; iki yolu birden seçemezsin.') : q.ready ? KabirI18n.t('İki bağ da çözüldü. Efendinin kapısı açık.') : KabirI18n.t('Bağları çözerek efendinin kapısını aç.');
    }
    function event(data) {
      $('quest-notice-state').textContent = data.complete ? KabirI18n.t('GÖREV TAMAMLANDI') : data.choice ? KabirI18n.t('KARARIN KAYDEDİLDİ') : KabirI18n.t('GÖREV İLERLEDİ');
      $('quest-notice-title').textContent = data.name;
      $('quest-notice-text').textContent = data.text;
      notice.classList.toggle('complete', !!data.complete); notice.classList.add('show');
      noticeLeft = Math.max(7, Math.min(12, data.text.length / 18)); showing = true; update();
    }
    function clear() { close(false); noticeLeft = 0; showing = false; notice.classList.remove('show'); revision = -1; }
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
      const pendingCard = cards.find(card => card.card.classList.contains('awaiting-choice'));
      if (pendingCard) { pendingCard.card.scrollIntoView({ block: 'nearest' }); pendingCard.buttons[0].focus({ preventScroll: true }); }
      else $('journal-close').focus({ preventScroll: true });
    }
    function close(restore = true) {
      if (!opened) return;
      opened = false; window.removeEventListener('keydown', keydown, true);
      const target = previousFocus; previousFocus = null;
      if (restore && target && target.isConnected && !target.closest('.hidden,[hidden]') && target.getClientRects().length) target.focus({ preventScroll: true });
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
