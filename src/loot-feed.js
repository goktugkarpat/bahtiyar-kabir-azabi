/* KABIR AZABI - loot3: floating pickup line ("Eşya alındı: ad") in the item's rarity colour.
   B.LootFeed.show(def) is called from app.js when an item reaches the bag. A few DOM lines, CSS-animated (no per-frame work). */
(function () {
  'use strict';
  const B = window.BABA;
  const T = s => (window.KabirI18n ? KabirI18n.t(s) : s);
  const MAX = 4;
  let box = null;
  function ensure() {
    if (box) return box;
    box = document.createElement('div'); box.id = 'loot-feed'; box.setAttribute('aria-live', 'polite');
    (document.getElementById('hud') || document.body).appendChild(box);
    return box;
  }
  function show(def) {
    if (!def) return;
    const q = B.Progression && B.Progression.qualities[def.rarity];
    const host = ensure();
    while (host.children.length >= MAX) host.firstElementChild.remove();
    const row = document.createElement('div');
    row.className = 'lf-row rarity-' + def.rarity;
    row.style.setProperty('--lc', q ? q.color : '#c7bdae');
    const gem = document.createElement('i'); gem.textContent = '◆';
    const k = document.createElement('span'); k.className = 'lf-k'; k.textContent = T('Eşya alındı:');
    const n = document.createElement('b'); n.textContent = T(def.name);
    const r = document.createElement('em'); r.textContent = q ? q.name : '';
    row.append(gem, k, n, r);
    host.appendChild(row);
    row.addEventListener('animationend', () => row.remove(), { once: true });
  }
  function clear() { if (box) box.replaceChildren(); }
  B.LootFeed = { show, clear };
}());
