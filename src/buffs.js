/* KABİR AZABI — keyed, presentation-only boxes for any timed status effect. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const ICONS = new Set(['light', 'heavy', 'dodge', 'rage', 'flask', 'special']);

  // effects: [{ id, name, icon, remaining, duration }]. The last entry for an id wins.
  // Existing boxes keep their nodes and insertion order; a ticking fraction alone never rewrites the DOM.
  function create(container) {
    if (!container || typeof container.appendChild !== 'function') throw new TypeError('Buffs.create needs a container element.');
    const slots = new Map();
    function add(id) {
      const node = document.createElement('div'), icon = document.createElement('i'), seconds = document.createElement('b');
      node.className = 'timed-buff'; node.setAttribute('data-buff-id', id); node.setAttribute('role', 'listitem');
      icon.setAttribute('aria-hidden', 'true'); seconds.className = 'buff-seconds'; seconds.setAttribute('aria-hidden', 'true');
      node.appendChild(icon); node.appendChild(seconds); container.appendChild(node);
      const slot = { node, icon, seconds, name: '', shown: -1, duration: -1, iconName: null, expiring: null };
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
          icon: ICONS.has(effect.icon) ? effect.icon : '', remaining: effect.remaining,
          duration: Number.isFinite(effect.duration) && effect.duration > 0 ? Math.ceil(effect.duration) : 0
        });
      }
      for (const [id, slot] of slots) {
        if (!next.get(id)) { slot.node.remove(); slots.delete(id); }
      }
      for (const [id, effect] of next) {
        if (!effect) continue;
        const slot = slots.get(id) || add(id), shown = Math.ceil(effect.remaining), expiring = effect.remaining <= 3;
        if (slot.iconName !== effect.icon) { slot.iconName = effect.icon; slot.icon.className = 'skill' + (effect.icon ? ' ' + effect.icon : ''); }
        if (slot.shown !== shown) slot.seconds.textContent = String(shown);
        if (slot.name !== effect.name || slot.shown !== shown || slot.duration !== effect.duration) {
          const label = effect.name + ' · ' + shown + KabirI18n.t(' sn kaldı') + (effect.duration ? ' (' + effect.duration + KabirI18n.t(' sn etki)') : '');
          slot.node.setAttribute('title', label); slot.node.setAttribute('aria-label', label);
          slot.name = effect.name; slot.shown = shown; slot.duration = effect.duration;
        }
        if (slot.expiring !== expiring) { slot.expiring = expiring; slot.node.classList.toggle('expiring', expiring); }
      }
    }
    function clear() { for (const slot of slots.values()) slot.node.remove(); slots.clear(); }
    return { update, clear };
  }
  function createChapter(container) {
    let source = null, revision = -1;
    const art = { damageReduction: 'temper', bossDamage: 'brand', staminaRecovery: 'charge', healingBonus: 'heal' };
    function clear() { container.replaceChildren(); source = null; revision = -1; }
    function update(info) {
      if (!info) { if (source) clear(); return; }
      if (source === info && revision === info.revision) return;
      source = info; revision = info.revision;
      const nodes = [];
      for (const effect of info.activeBenefits || []) {
        const node = document.createElement('button'), icon = document.createElement('img'), tip = document.createElement('span');
        node.type = 'button'; node.className = 'chapter-buff'; node.dataset.benefit = effect.benefit;
        icon.src = 'assets/ui/abilities/' + (art[effect.benefit] || 'temper') + '.png'; icon.alt = '';
        const label = (effect.name || effect.quest) + '\n' + effect.effect + KabirI18n.t('\nGörev: ') + effect.quest + KabirI18n.t('\nBu bölüm boyunca geçerli.');
        node.setAttribute('aria-label', label); tip.className = 'chapter-buff-tip'; tip.textContent = label;
        node.append(icon, tip); nodes.push(node);
      }
      container.replaceChildren(...nodes);
    }
    return { update, clear };
  }
  B.Buffs = { create, createChapter };
})();
