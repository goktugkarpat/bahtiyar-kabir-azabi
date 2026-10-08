/* KABİR AZABI — keyed, presentation-only boxes for any timed status effect. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const ICONS = new Set(['light', 'heavy', 'dodge', 'rage', 'flask', 'special']);

  // ---- one floating explanation bubble shared by every effect icon (timed effects and chapter boons): shown on hover and keyboard focus,
  // above the icon for the bottom-centre strip and below it for the top strip, clamped to the viewport; its text only changes when the words change.
  let tipEl = null, tipNode = null, tipText = '';
  function placeTip() {
    if (!tipEl || !tipNode) return;
    const r = tipNode.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, up = tipNode.dataset.tipSide === 'up';
    const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    let top = up ? r.top - h - 10 : r.bottom + 12; top = Math.max(8, Math.min(innerHeight - h - 8, top));
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  }
  function showTip(node) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'buff-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    tipNode = node; tipText = node.dataset.tip || ''; tipEl.textContent = tipText; tipEl.style.display = 'block'; placeTip();
  }
  function hideTip() { tipNode = null; if (tipEl) tipEl.style.display = 'none'; }
  function refreshTip() {
    if (!tipNode) return;
    if (!tipNode.isConnected) { hideTip(); return; }
    const text = tipNode.dataset.tip || '';
    if (text !== tipText) { tipText = text; tipEl.textContent = text; placeTip(); }
  }
  const tipOf = e => e.target && e.target.closest ? e.target.closest('.timed-buff, .chapter-buff') : null;
  document.addEventListener('mouseover', e => { const n = tipOf(e); if (n) { if (n !== tipNode) showTip(n); } else if (tipNode) hideTip(); });
  document.addEventListener('focusin', e => { const n = tipOf(e); if (n) showTip(n); });
  document.addEventListener('focusout', hideTip); document.addEventListener('scroll', hideTip, true);
  const ALWAYS_SHORT = new Set(['stance', 'rage', 'flask', 'momentum']);   // these always show above the skill bar, like the war cry, however long they last
  const SHORT = 6;   // effects lasting at most this many seconds sit above the skill bar (bottom centre); longer ones in the top strip

  // effects: [{ id, name, icon, remaining, duration, tone, tip }]. The last entry for an id wins.
  // tone: 'iron' | 'heart' | 'thorn' | 'blood' | 'gold' (frame colour); tip: one or two sentences for the bubble.
  // Existing boxes keep their nodes and insertion order; a ticking fraction alone never rewrites the DOM (text only when the whole second or the ring percent changes).
  function create(container, shortContainer) {
    if (!container || typeof container.appendChild !== 'function') throw new TypeError('Buffs.create needs a container element.');
    const slots = new Map();
    function add(id, home) {
      const node = document.createElement('div'), icon = document.createElement('i'), seconds = document.createElement('b');
      node.className = 'timed-buff'; node.setAttribute('data-buff-id', id); node.setAttribute('role', 'listitem'); node.tabIndex = 0;
      icon.setAttribute('aria-hidden', 'true'); seconds.className = 'buff-seconds'; seconds.setAttribute('aria-hidden', 'true');
      node.appendChild(icon); node.appendChild(seconds); home.appendChild(node);
      const slot = { node, icon, seconds, name: '', shown: -1, duration: -1, iconName: null, expiring: null, tone: null, pct: -1, home };
      slots.set(id, slot); return slot;
    }
    function update(effects) {
      const next = new Map();
      for (const effect of Array.isArray(effects) ? effects : []) {
        const id = effect && typeof effect.id === 'string' ? effect.id.trim() : '';
        if (!id) continue;
        if (!Number.isFinite(effect.remaining) || effect.remaining <= 0) { next.set(id, null); continue; }
        next.set(id, {
          name: typeof effect.name === 'string' && effect.name.trim() ? effect.name.trim() : KabirI18n.t('Süreli etki'),
          icon: ICONS.has(effect.icon) || (B.SkillArt && B.SkillArt.ids.includes(effect.icon)) ? effect.icon : '', remaining: effect.remaining,
          duration: Number.isFinite(effect.duration) && effect.duration > 0 ? Math.ceil(effect.duration) : 0,
          rawDuration: Number.isFinite(effect.duration) && effect.duration > 0 ? effect.duration : effect.remaining,
          tone: typeof effect.tone === 'string' ? effect.tone : '', tip: typeof effect.tip === 'string' ? effect.tip : ''
        });
      }
      for (const [id, slot] of slots) {
        if (!next.get(id)) { if (tipNode === slot.node) hideTip(); slot.node.remove(); slots.delete(id); }
      }
      for (const [id, effect] of next) {
        if (!effect) continue;
        const home = shortContainer && (effect.rawDuration <= SHORT || ALWAYS_SHORT.has(id)) ? shortContainer : container;
        let slot = slots.get(id);
        if (slot && slot.home !== home) { slot.home = home; home.appendChild(slot.node); }
        if (!slot) slot = add(id, home);
        const shown = Math.ceil(effect.remaining), expiring = effect.remaining <= 3, pct = Math.max(0, Math.min(100, Math.round(effect.remaining / effect.rawDuration * 100)));
        if (slot.iconName !== effect.icon) {
          slot.iconName = effect.icon; const art = effect.icon && !ICONS.has(effect.icon) && B.SkillArt;
          slot.icon.className = 'skill' + (effect.icon && !art ? ' ' + effect.icon : '');
          slot.icon.style.backgroundImage = art ? 'url("' + B.SkillArt.url(effect.icon) + '")' : ''; slot.icon.style.backgroundSize = art ? '100% 100%' : '';
        }
        if (slot.shown !== shown) slot.seconds.textContent = String(shown);
        if (slot.tone !== effect.tone) { slot.tone = effect.tone; slot.node.dataset.tone = effect.tone; }
        if (slot.pct !== pct) { slot.pct = pct; slot.node.style.setProperty('--p', String(pct)); }
        slot.node.dataset.tipSide = home === shortContainer ? 'up' : 'down';
        if (slot.name !== effect.name || slot.shown !== shown || slot.duration !== effect.duration) {
          const label = KabirI18n.t(effect.name) + (effect.tip ? ': ' + KabirI18n.t(effect.tip) : '') + ' ' + shown + KabirI18n.t(' sn kaldı') + '.';
          slot.node.dataset.tip = label; slot.node.setAttribute('aria-label', label);
          slot.name = effect.name; slot.shown = shown; slot.duration = effect.duration;
        }
        if (slot.expiring !== expiring) { slot.expiring = expiring; slot.node.classList.toggle('expiring', expiring); }
      }
      refreshTip();
    }
    function clear() { hideTip(); for (const slot of slots.values()) slot.node.remove(); slots.clear(); }
    return { update, clear, shortCount: () => { let n = 0; for (const s of slots.values()) if (s.home === shortContainer) n++; return n; } };
  }
  function createChapter(container) {
    let source = null, revision = -1;
    const art = { damageReduction: 'temper', bossDamage: 'brand', staminaRecovery: 'charge', healingBonus: 'heal' };
    function clear() { hideTip(); container.replaceChildren(); source = null; revision = -1; }
    function update(info) {
      if (!info) { if (source) clear(); return; }
      const sig = (info.activeBenefits || []).map(e => e.benefit + '|' + (e.name || e.quest)).join(';') + '#' + KabirI18n.lang;
      if (sig === source) return;
      source = sig; revision = info.revision;
      const nodes = [];
      for (const effect of info.activeBenefits || []) {
        const node = document.createElement('button'), icon = document.createElement('img');
        node.type = 'button'; node.className = 'chapter-buff'; node.dataset.benefit = effect.benefit;
        icon.src = 'assets/ui/abilities/' + (art[effect.benefit] || 'temper') + '.png'; icon.alt = '';
        const label = (effect.name || effect.quest) + '\n' + effect.effect + KabirI18n.t('\nGörev: ') + effect.quest + KabirI18n.t('\nBu bölüm boyunca geçerli.');
        node.setAttribute('aria-label', label); node.dataset.tip = label; node.dataset.tipSide = 'down';
        node.append(icon); nodes.push(node);
      }
      hideTip(); container.replaceChildren(...nodes);
    }
    return { update, clear };
  }
  B.Buffs = { create, createChapter };
  (function () {   // English text for the bubbles
    const D = window.KabirI18n && window.KabirI18n.dictionary; if (!D) return;
    Object.assign(D, { 'Aldığın hasar azalır; yakındaki düşmana karşılık verirsin.': 'You take less damage and strike back at foes close to you.', 'Saldırdıkça can kazanır, vuruşların daha ağır iner, aldığın hasar azalır.': 'You heal as you strike, hit harder and take less damage.',
      'Vuruşların daha ağır iner ve gücün daha hızlı yenilenir.': 'Your blows land harder and stamina returns faster.', 'Kaçınma ya da hücumdan sonra vuruşların daha ağır iner.': 'After a dodge or a charge your blows land harder.', 'Şifa matarasıyla can yenilendi.': 'The flask has mended your wounds.',
      'İksir': 'Elixir', 'Hız Kazanımı': 'Momentum', 'Süreli etki': 'Timed effect' });
  })();
})();
