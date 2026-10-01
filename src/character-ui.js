/* KABİR AZABI — paused character, equipment and active-talent ledger. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const LABELS = { weapon: 'Silah', head: 'Baş', chest: 'Gövde', hands: 'Eller', boots: 'Ayaklar' };
  const RARITY = { common: 'Sıradan', uncommon: 'Sıradışı', rare: 'Nadir', epic: 'Epik', boss: 'Eşsiz' };
  const TYPE = { sword: 'Kılıç', axe: 'Balta', spear: 'Mızrak' };
  const escape = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const percent = n => Number((n * 100).toFixed(1)).toLocaleString('tr-TR') + '%';
  let gearSerial = 0;
  // Painted, original SVG miniatures match the weapon/armour family. The actual worn
  // object remains the animated 3D figure; no thumbnail renderer or texture fetch is needed.
  function gearIcon(def) {
    const id = 'gear-art-' + (++gearSerial), base = def.modelId || def.id, worn = def.finish || 'worn';
    const tones = { worn: ['#c2c9ca','#6b777a','#253035'], ash: ['#d6cfbe','#8e8778','#343333'], rust: ['#d2b086','#996442','#362722'], brine: ['#b8d1d1','#668d91','#20353e'], blood: ['#cabaa4','#8f5b52','#38262a'], bone: ['#e3d9b9','#9f9477','#3d3a32'] };
    const tone = tones[worn] || tones.worn;
    const steel = 'url(#' + id + '-steel)', leather = 'url(#' + id + '-leather)', gold = '#ae8453';
    let art = '', etch = '';
    if (def.type === 'sword') {
      const dull = base === 'dull-sword';
      art = '<path fill="' + steel + '" d="' + (dull ? 'M42 5 47 9 43 19 41 19 38 29 26 43 20 37Z' : 'M44 3 50 6 45 21 26 43 20 37Z') + '"/>' +
        '<path fill="' + leather + '" d="m15 40 6 5-9 12-6-5Z"/><path fill="' + steel + '" d="m15 34 4-2 15 13-3 4-8-5-5-6-5-2Z"/><path fill="' + gold + '" d="m6 50 9 7-3 4-10-7Z"/>';
      etch = '<path d="m44 9-20 29m3-2 16-22m-31 28 6 4m-9 1 6 4"/><path stroke="' + gold + '" d="m22 39 4 3"/>';
    } else if (def.type === 'axe') {
      art = '<path fill="' + leather + '" d="m8 56 26-43 5 3-25 43Z"/><path fill="' + steel + '" d="M27 12c10-11 20-9 30-4L44 30c-4-5-8-6-13-5l5-9Z"/><path fill="' + gold + '" d="m29 18 8 5-4 5-8-5Z"/>';
      if (base.includes('executioner') || def.rarity === 'boss') art += '<path fill="' + steel + '" d="M30 14C18 8 12 13 7 23l17 6 8-8Z"/>';
      etch = '<path d="M53 9 43 25M10 51l5 3m-2-8 5 3m-2-8 5 3m17-29 5 4"/>';
    } else if (def.type === 'spear') {
      art = '<path fill="' + leather + '" d="m10 57 34-40 3 3-34 40Z"/><path fill="' + steel + '" d="M56 3c0 15-3 22-17 26l2-16Z"/><path fill="' + gold + '" d="m34 24 10 9 3-4-10-9Z"/>';
      etch = '<path d="m52 9-11 15M17 48l4 4m0-10 5 4m0-10 5 4"/>';
      if (base.includes('bell')) art += '<path fill="' + gold + '" d="m29 28 6 3 1 7-9-4Z"/>';
    } else if (def.slot === 'head') {
      const cloth = base.includes('hood');
      art = cloth ? '<path fill="' + leather + '" d="M10 51 7 32C8 5 20 3 32 3S56 5 57 32l-3 19-15 9H23Z"/><path fill="#11171b" d="M17 30c1-19 29-19 30 0l-6 17H23Z"/>' : '<path fill="' + steel + '" d="M9 45V26C9 2 55 2 55 26v19l-14 11-9-17-9 17Z"/><path fill="#142028" d="m15 26 13 3-2 6-12-4Zm21 3 13-3 1 5-12 4Z"/><path fill="' + gold + '" d="M28 8h8v28l-4 5-4-5Z"/>';
      etch = cloth ? '<path d="M11 39 18 21m35 18-7-18M14 51l9 5m27-5-9 5"/>' : '<path d="M12 21c6-13 32-13 40 0M16 41l7 5m25-5-7 5M32 12v19"/>';
    } else if (def.slot === 'chest') {
      const torn = base === 'torn-chest';
      art = '<path fill="' + leather + '" d="m20 9-11 6-4 16 12 4-1 22 8-2 8 4 9-3 7 1-1-22 12-4-5-16-10-6c-4 10-19 10-25 0Z"/>';
      if (!torn) art += '<path fill="' + steel + '" d="m20 17-7 8 8 10 3 17 8 3 8-3 3-17 8-10-7-8-12 5Z"/><path fill="' + steel + '" d="m12 12-7 6 1 10 10 3 4-12Zm40 0 7 6-1 10-10 3-4-12Z"/><path fill="' + gold + '" d="m32 28 6 8-6 8-6-8Z"/>';
      etch = torn ? '<path d="M23 17 21 41m21-24 2 25M19 48h26m-13-22v18m-6 12 3-4m8 5-2-4"/>' : '<path d="M32 22v7m-10 7 3 13m17-13-3 13m-25-32 2 9m35-9-2 9"/>';
    } else if (def.slot === 'hands') {
      const wrapped = base.includes('wrap');
      art = '<path fill="' + leather + '" d="m7 20 11-3 3 11 6-3 5 7-9 12 2 13-15 2-2-15Zm32-3 11 3 5 24-1 15-15-2 2-13-9-12 5-7 6 3Z"/>';
      if (!wrapped) art += '<path fill="' + steel + '" d="m8 23 11-2 4 18-10 4Zm37-2 11 2-5 20-10-4ZM10 48l13-2 2 10-15 2Zm31-2 13 2v10l-15-2Z"/>';
      etch = wrapped ? '<path d="m9 26 12-3m-11 10 13-4m-12 11 13-4m-11 12 11-3m-11 10 12-3m21-29 12 3m-13 3 13 4m-13 3 13 4m-11 5 11 3m-12 4 12 3"/>' : '<path d="m11 29 9-2m-8 8 9-2m23-6 9 2m-10 4 9 2m-39 17 8-1m20 0 8 1"/>';
    } else {
      const metal = !base.includes('worn');
      art = '<path fill="' + leather + '" d="M9 10h17l-2 28 6 9-1 11H4V46l5-9Zm29 0h17l-1 27 7 9v12H36l-1-11 5-9Z"/><path fill="#191a19" d="M4 53h25v7H4Zm32 0h25v7H36Z"/>';
      if (metal) art += '<path fill="' + steel + '" d="M11 13h13l-2 21-9 4Zm30 0h12l-2 24-9-3Z"/>';
      etch = '<path d="M10 20h14m-14 8h13m18-8h12m-12 8h12M7 47h18m15 0h17"/>';
    }
    return '<svg class="char-icon char-gear-icon" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="' + id + '-steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + tone[0] + '"/><stop offset=".38" stop-color="' + tone[1] + '"/><stop offset=".55" stop-color="' + tone[0] + '"/><stop offset="1" stop-color="' + tone[2] + '"/></linearGradient><linearGradient id="' + id + '-leather" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#765341"/><stop offset=".5" stop-color="#42392e"/><stop offset="1" stop-color="#1d211f"/></linearGradient></defs><g stroke="#0b1013" stroke-width="1.2" stroke-linejoin="round">' + art + '</g><g fill="none" stroke="#e6d7bb" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round">' + etch + '</g></svg>';
  }
  // Original engraved ability miniatures. These are vectors, so no downloads,
  // extra WebGL scenes or image decoding are needed when opening the tree.
  function skillArt(type) {
    const drawings = {
      cleave: ['<path d="M37 5 42 8 34 24 19 37 14 32Z"/><path d="m10 31 7 6-8 8-5-5Z"/><path d="m10 27 5-2 11 10-3 4Z"/><path opacity=".45" d="M5 25C4 10 22 1 37 4 21 7 12 14 9 29Z"/>', 'M37 10 19 31m-9 6 5 4M9 16l5-4m4-3 5-2'],
      roar: ['<path d="M10 20C7 6 39 5 38 20l-3 9-5 3-2 8h-8l-2-8-5-3Z"/><path fill="#15202a" d="m12 19 9 2-3 6-6-3Zm15 2 9-2v5l-6 3Zm-6 9 3-5 3 5Z"/><path fill="#442b2a" d="M21 34h6v6h-6Z"/>', 'M13 12l7-2m7 0 6 2M21 34v4m6-4v4M4 17l-2 8m42-8 2 8'],
      whirl: ['<path d="M25 3c13 2 21 13 17 22-2-10-8-14-16-15l-2 8-7-10Z"/><path d="M42 27c-5 12-17 18-25 12 10 0 15-5 18-12l-7-4 12-4Z"/><path d="M14 38C2 32-1 17 7 10c-3 10 0 16 6 21l6-5-1 13Z"/><path d="m23 19 6 4-3 7-8-2-1-6Z"/>', 'M27 6c8 3 12 7 13 13M36 30l-7 6M7 19l2 8'],
      charge: ['<path d="m6 12 9 11-9 12 4 2 14-14L10 9Z"/><path d="m22 11 9 12-9 13 4 2 17-15L26 8Z"/><path opacity=".5" d="M3 21h10v4H3Z"/>', 'm9 13 9 10-9 11m17-21 10 10-10 11M4 6l9 1m-9 34 9-1'],
      quake: ['<path d="m21 4 8 3-1 14-9 1Z"/><path d="m13 18 4-5 21 3-1 12-21 1-5-6Z"/><path opacity=".7" d="m23 29-8 8 6 1-5 7 11-9-5-2 5-5Zm-8-1-12 6 7 2-5 6 13-7-6-2 6-4Zm17 0 13 7-7 2 6 6-13-7 5-3-6-4Z"/>', 'm17 17 17 2M18 26h15m-8-17-1 7'],
      reap: ['<path d="M8 16C16 1 34 2 44 9 28 6 18 13 13 22Z"/><path d="m25 9 4 1-9 35-5-1Z"/><path d="m20 9 13 4-2 4-12-4Z"/><path opacity=".4" d="M4 34c3-3 5-4 9-4l-3 6 3 8c-7-1-10-4-9-10Z"/>', 'M13 15c8-7 17-8 24-7m-20 27 5 1m-6 4 5 1'],
      brand: ['<path d="m24 3 17 21-17 21L7 24Z"/><path fill="#18252d" d="m24 9 12 15-12 15-12-15Z"/><path d="m24 14 7 10-7 10-7-10Z"/><path opacity=".7" d="m2 22 8 2-8 2Zm36 2 8-2v4ZM22 2h4l-2 8Zm2 36 2 8h-4Z"/>', 'M24 18v12m-4-6h8M11 24l4-5m18 5-4 5'],
      grasp: ['<path d="m13 35-6-11 4-7 5 8 1-18 4 2 1 15 3-20 4 1-1 20 6-17 4 3-5 18 9-9 3 4-10 14-5 8-15-1Z"/><path fill="#18242c" d="m16 32 11-3 6 6-7 6-9-1Z"/>', 'm17 16 4 1m5-3 3 1m7 2 3 1m-22 18 8 1m-5 5h7'],
      rend: ['<path d="m14 3 2 11-7 13 1 17 5-22 7-10Z"/><path d="m28 2 2 13-7 14 1 17 5-23 7-11Z"/><path d="m41 4 2 13-7 13 1 15 5-22 5-10Z"/>', 'm14 15-3 8m17-8-3 8m15-5-3 8'],
      temper: ['<path d="M24 2c1 10 9 11 10 19 5-2 7-6 7-6 5 9 6 19-2 26-12 9-30 3-33-9-2-6 0-13 3-17 0 8 4 10 6 11-2-10 8-14 9-24Z"/><path fill="#2b2023" d="M25 19c0 10 7 10 7 17 0 8-16 8-16 0 0-6 7-9 9-17Z"/><path d="m19 34 8-3 3 5-3 4h-8Z"/>', 'M25 8c1 5 4 8 6 11M10 26c-1 7 2 11 6 14m16-2 5-3'],
      chainstorm: ['<path d="m5 13 8-8 9 3-3 8-8 5Zm3 1 4 4 5-4 2-5-5-1Z"/><path d="m26 8 8-3 9 8-5 8-8-4Zm3 3 3 5 5 2 3-4-6-6Z"/><path d="m8 27 9 3 5 8-8 6-9-8Zm3 3-3 5 6 6 5-4-4-5Z"/><path d="m30 30 8-3 5 9-9 8-8-6Zm2 2-3 5 5 4 6-6-3-5Z"/><path d="m22 18 7 4-3 8-8-3Z"/>', 'm12 12 3-2m18 0 3 2m-24 22 3 3m18 0 3-3m-14-12 3 1']
    };
    if (!drawings[type]) return '';
    const id = 'power-art-' + (++gearSerial), [shape, lines] = drawings[type];
    const warm = ['roar','quake','grasp','temper','chainstorm'].includes(type);
    const top = warm ? '#e0c2a0' : '#d6e1df', mid = warm ? '#b58a68' : '#9cbbb8', bottom = warm ? '#5a3935' : '#3f5664';
    return '<svg class="char-icon power-art" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="' + top + '"/><stop offset=".4" stop-color="' + mid + '"/><stop offset=".56" stop-color="' + top + '"/><stop offset="1" stop-color="' + bottom + '"/></linearGradient></defs><g fill="url(#' + id + ')" stroke="#09121a" stroke-width=".7" stroke-linejoin="round">' + shape + '</g><path d="' + lines + '" fill="none" stroke="#f0dfbb" stroke-opacity=".6" stroke-width=".7" stroke-linecap="round"/></svg>';
  }
  function icon(type) {
    const painted = skillArt(type); if (painted) return painted;
    const paths = {
      sword: '<path d="M30 5 34 13 19 31 13 25Z"/><path d="m10 23 12 12m-8-6-7 8m-3-1 6 5"/>',
      axe: '<path d="m9 39 20-30m-9 3c11-7 15-5 20 2l-8 11-10-8"/>',
      spear: '<path d="m8 40 23-27m-7 0 13-9-5 16Z"/>',
      head: '<path d="M10 30V19c0-15 28-15 28 0v11l-9 7-5-12-5 12Z"/><path d="M24 8v15m-13-1 8 2m10 0 8-2"/>',
      chest: '<path d="m15 7-9 6 4 12 5-3-2 17h22l-2-17 5 3 4-12-9-6c-3 8-15 8-18 0Z"/><path d="M24 17v20m-9-9h18"/>',
      hands: '<path d="m12 28-4-9c-2-5 3-6 5-2l3 5V9c0-4 5-4 5 0v10-13c0-4 5-4 5 0v13-10c0-4 5-4 5 0v12-6c0-4 5-4 5 0v13l-5 10H17Z"/>',
      boots: '<path d="M15 7h16l-1 20 9 7v6H9v-9l6-4Z"/><path d="M16 14h13m-13 6h13M10 35h27"/>',
      cleave: '<path d="M8 34C8 13 25 5 40 10 23 13 18 22 16 37Z"/><path d="m8 40 24-28"/>',
      roar: '<path d="M10 18v12l9 4V14Zm17-6c8 7 8 17 0 24m8-30c13 11 13 25 0 36"/>',
      whirl: '<path d="M13 34C0 16 29 1 39 17c8 14-11 30-22 17-7-9 5-20 12-10"/><path d="m7 29 6 5 2-8"/>',
      charge: '<path d="m6 11 11 12L6 35m13-24 11 12-11 12m13-24 11 12-11 12"/>',
      quake: '<path d="m23 5 2 17-6 7 7 4-5 11M5 33l11-7m13 0 14 7M8 42l8-6m15 0 9 6"/>',
      reap: '<path d="M5 32C6 11 19 6 28 9 17 12 13 21 12 34Zm12 6c1-21 14-26 23-23-11 3-15 12-16 25Z"/>',
      brand: '<path d="m24 5 14 19-14 19L10 24Zm0 9 7 10-7 10-7-10ZM5 24h7m24 0h7M24 3v9m0 24v9"/>',
      grasp: '<path d="m12 38-5-13 4-11 4 8 2-15 4 13 4-16 3 17 6-12 1 18 7-5-6 16-10 5ZM17 27l3 9m8-9-2 9"/>',
      rend: '<path d="M5 12h38M8 24h32M12 36h24m-11-31-7 16 11 7-8 15m-13-30 6 3m20 7 7-4m-24 18-6 4"/>',
      temper: '<path d="M24 4c2 10 12 11 10 21 9-5 7-12 7-12 8 17-2 29-17 29S-.5 30 7 13c0 9 6 12 7 12-3-11 10-13 10-21Z"/><path d="M24 23c0 7-8 9-5 14 3 5 11 3 11-2 0-4-4-6-6-12Z"/>',
      chainstorm: '<ellipse cx="24" cy="25" rx="19" ry="15"/><ellipse cx="24" cy="25" rx="12" ry="9"/><ellipse cx="24" cy="25" rx="5" ry="4"/><path d="m10 12 4 5m20-5-4 5M5 25h7m24 0h7M11 37l4-5m18 5-4-5M24 7v10m0 16v10"/>'
    };
    return '<svg class="char-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + (paths[type === 'weapon' ? 'sword' : type] || paths.chest) + '</svg>';
  }
  function create(options) {
    options = options || {};
    const getGame = () => typeof options.game === 'function' ? options.game() : options.game;
    const getState = () => getGame() && getGame().progression;
    const overlay = document.createElement('section'); overlay.id = 'character'; overlay.className = 'screen overlay modal hidden';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'character-title');
    overlay.innerHTML = '<div class="panel character-panel"><header class="panel-head"><div><span class="eyebrow">Küllerden yükselen</span><h2 id="character-title">Bahtiyar</h2></div><div class="char-progress"></div><button class="close" data-char="close" aria-label="Oyuna dön">×</button></header>' +
      '<nav class="char-tabs" aria-label="Karakter sayfaları"><button data-char="tab" data-tab="inventory">Karakter ve çanta</button><button data-char="tab" data-tab="skills">Yetenek ağacı</button></nav>' +
      '<div class="char-content"></div><footer class="char-footer"><span class="char-status" role="status" aria-live="polite"></span><button class="btn small" data-char="close">Oyuna dön</button></footer></div>';
    document.body.appendChild(overlay);
    const progress = overlay.querySelector('.char-progress'), content = overlay.querySelector('.char-content'), status = overlay.querySelector('.char-status');
    let renderedFilter = 'all';
    let opened = false, tab = 'inventory', selected = null, lastRevision = -1, priorFocus = null, previewFrame = 0, selectedSkill = 'cleave', selectedSlot = null, bagFilter = 'all', lastPointerType = 'mouse', tap = null, inspectScroll = 0;
    function comparison(def, old, compact) {
      const attributes = [['Silah hasarı', 'damage', true], ['Hasar azaltma', 'defense', true], ['Can gücü', 'hp', false]];
      return attributes.filter(a => a[1] !== 'damage' || def.slot === 'weapon').map(([label, key, isPercent]) => {
        const value = def[key] || 0, previous = old ? old[key] || 0 : 0, delta = value - previous;
        const amount = isPercent ? percent(value) : value;
        const difference = Math.abs(delta) < .00001 ? '—' : (delta > 0 ? '+' : '−') + (isPercent ? percent(Math.abs(delta)) : Math.abs(delta));
        return '<div class="char-comparison-row"><span>' + label + '</span><strong>' + amount + '</strong><b class="char-comparison-value ' + (delta > .00001 ? 'gain' : delta < -.00001 ? 'loss' : 'same') + '">' + difference + '</b></div>';
      }).join('');
    }
    function itemDetail(state, entry, compact) {
      const def = B.Progression.resolveItem(entry);
      if (!def) return '<div class="char-empty-detail">' + icon(selectedSlot || 'chest') + '<h3>' + (selectedSlot ? LABELS[selectedSlot] + ' yuvası boş' : 'Bir eşya seç') + '</h3><p>Çantadan bir parçaya dokun. Özelliklerini ve giyili parçaya göre farkını burada görebilirsin.</p></div>';
      const old = state.itemForSlot(def.slot), equipped = state.equipment[def.slot] === entry.uid;
      const header = '<div class="char-detail-head rarity-' + def.rarity + '"><span class="char-item-art">' + gearIcon(def) + '</span><div><small>' + RARITY[def.rarity] + ' · ' + (TYPE[def.type] || LABELS[def.slot]) + '</small><h3>' + escape(def.name) + '</h3></div></div>';
      const meta = '<div class="char-detail-meta"><span>Güç <b>' + def.power + '</b></span><span class="' + (def.level > state.level ? 'loss' : '') + '">Seviye ' + def.level + '</span><span>İşçilik ' + (def.roll > 0 ? '+' : '') + def.roll + '</span></div>';
      const compares = '<div class="char-comparison"><small>' + (equipped ? 'Kuşandığın parçanın özellikleri' : old ? 'Giyili parça · ' + escape(old.name) : 'Bu yuva şu anda boş') + '</small>' + comparison(def, equipped ? def : old, compact) + '</div>';
      if (compact) return header + meta + compares + '<p class="char-equip-hint">' + (equipped ? 'Giyili · Çift tıkla çıkar' : def.level > state.level ? def.level + '. seviye gerekli' : 'Çift tıkla kuşan') + '</p>';
      const action = equipped ? '<button class="btn small" data-char="unequip" data-slot="' + def.slot + '">Parçayı çıkar</button>' : '<button class="btn small primary" data-char="equip" data-uid="' + escape(entry.uid) + '" ' + (def.level > state.level ? 'disabled' : '') + '>' + (def.level > state.level ? def.level + '. seviye gerekli' : def.slot === 'weapon' ? 'Silahı kuşan' : 'Parçayı giy') + '</button>';
      return header + meta + '<p class="char-item-lore">' + escape(def.description) + '</p>' + compares + '<div class="char-detail-actions">' + action + '</div><p class="char-equip-hint">' + (equipped ? 'Eşyaya veya donanım yuvasına çift tıkla ya da iki kez dokun: çıkar.' : 'Çantadaki eşyaya çift tıkla ya da iki kez dokun: kuşan.') + '</p>';
    }
    function inventory(state) {
      const visible = state.inventory.filter(entry => bagFilter === 'all' || B.Progression.resolveItem(entry)?.slot === bagFilter);
      if (!selectedSlot && !visible.some(i => i.uid === selected)) selected = visible[0] && visible[0].uid;
      const stats = state.stats(), weapon = state.itemForSlot('weapon'), difficulty = getGame().difficulty;
      const visibleMaxHp = Number.isFinite(getGame().player?.maxHp) ? getGame().player.maxHp : 100;
      const damageScale = difficulty === 'normal' || difficulty === 'easy' ? 1.18 : 1;
      const equipment = B.Progression.slots.map(slot => {
        const def = state.itemForSlot(slot), uid = state.equipment[slot], active = uid ? uid === selected : slot === selectedSlot;
        return '<button class="char-equipment ' + (def ? 'rarity-' + def.rarity : 'empty') + (active ? ' selected' : '') + '" data-slot="' + slot + '" data-char="select" data-uid="' + escape(uid || '') + '" aria-pressed="' + active + '" aria-label="' + escape(LABELS[slot] + ' · ' + (def ? def.name + ' · Çift tıkla çıkar' : 'Boş yuva')) + '"><span class="char-item-art">' + (def ? gearIcon(def) : icon(slot)) + '</span><span><small>' + LABELS[slot] + '</small><strong>' + escape(def ? def.name : 'Boş yuva') + '</strong></span></button>';
      }).join('');
      const list = visible.map(entry => {
        const def = B.Progression.resolveItem(entry), equipped = state.equipment[def.slot] === entry.uid, upgrade = state.isUpgrade(entry);
        return '<button class="char-item rarity-' + def.rarity + (entry.uid === selected ? ' selected' : '') + (equipped ? ' equipped' : '') + (def.level > state.level ? ' too-high' : '') + '" data-char="select" data-uid="' + escape(entry.uid) + '" data-item-slot="' + def.slot + '" aria-pressed="' + (entry.uid === selected) + '" aria-label="' + escape(def.name + ' · ' + RARITY[def.rarity] + ' · Seviye ' + def.level + ' · Güç ' + def.power + (equipped ? ' · Giyili' : upgrade ? ' · Kuşandığından daha iyi' : '')) + '"><span class="char-item-art">' + gearIcon(def) + '</span><span class="char-item-level" aria-hidden="true">' + def.power + '</span><strong class="char-item-name">' + escape(def.name) + '</strong>' + (upgrade ? '<b class="char-item-upgrade" title="Kuşandığından daha iyi" aria-label="Kuşandığından daha iyi">↑</b>' : '') + (equipped ? '<b class="char-item-equipped" aria-label="Giyili">✓</b>' : '') + '</button>';
      }).join('');
      const entry = state.inventory.find(i => i.uid === selected), def = B.Progression.resolveItem(entry);
      const filters = ['all', ...B.Progression.slots].map(slot => '<button class="char-filter' + (bagFilter === slot ? ' active' : '') + '" data-char="filter" data-filter="' + slot + '" aria-pressed="' + (bagFilter === slot) + '" aria-label="' + (slot === 'all' ? 'Bütün eşyalar' : LABELS[slot] + ' eşyaları') + '">' + (slot === 'all' ? 'Tümü' : icon(slot)) + '</button>').join('');
      const preview = typeof options.onPreview === 'function' ? '<figure class="char-preview"><span class="char-preview-label">Kuşanılan donanım</span><canvas id="character-preview" width="420" height="520" aria-label="Bahtiyar’ın kuşandığı silah ve zırhları gösteren canlı karakter görünümü"></canvas><div class="char-preview-turn"><button data-char="turn" data-direction="-1" aria-label="Karakteri sola çevir">‹</button><button data-char="turn" data-direction="1" aria-label="Karakteri sağa çevir">›</button></div><figcaption>' + escape(weapon ? (TYPE[weapon.type] || 'Silah') + ' · ' + weapon.name : 'Silah yuvası boş') + '</figcaption></figure>' : '';
      return '<div class="char-inventory-layout' + (preview ? ' has-preview' : '') + '"><section class="char-sheet"><h3>Donanım <small>Beş kuşanım yuvası</small></h3>' + (preview ? '<div class="char-doll">' + preview + equipment + '</div>' : equipment) + '<div class="char-stat-grid"><span>Can<strong>' + visibleMaxHp + '</strong></span><span title="Donanımın can destekleriyle hesaplanan dayanıklılık değeri">Can gücü<strong>' + stats.maxHp + '</strong></span><span>Normal vuruş<strong>' + Math.round(Math.round(25 * stats.damage) * damageScale) + '–' + Math.round(Math.round(36 * stats.damage) * damageScale) + '</strong></span><span>Hasar azaltma<strong>' + percent(stats.defense) + '</strong></span><span>Kritik ihtimali<strong>' + percent(stats.criticalChance) + '</strong></span><span>Kritik hasarı<strong>×' + stats.criticalMultiplier.toFixed(1) + '</strong></span></div></section>' +
        '<section class="char-bag"><h3>Çanta <small>' + state.inventory.length + ' eşya</small></h3><div class="char-bag-toolbar">' + filters + '</div><div class="char-item-list char-bag-grid">' + (list || '<p class="char-bag-empty">Bu türde eşyan yok.</p>') + '</div><p class="char-bag-help">İncelemek için seç · Çift tıkla veya iki kez dokun: kuşan / çıkar.</p></section><section class="char-detail' + (def ? ' rarity-' + def.rarity : '') + '">' + itemDetail(state, entry, false) + '</section></div>';
    }
    function talents(state) {
      const all = B.Progression.skills, chosen = all.find(s => s.id === selectedSkill) || all[0];
      const byId = new Map(all.map(s => [s.id, s])), depths = new Map();
      function depth(skill, chain) {
        if (depths.has(skill.id)) return depths.get(skill.id);
        const parent = byId.get(skill.requires);
        if (!parent || (chain && chain.has(skill.id))) return 0;
        const next = new Set(chain || []); next.add(skill.id);
        const tier = depth(parent, next) + 1; depths.set(skill.id, tier); return tier;
      }
      const tiers = Math.max(...all.map(s => depth(s))) + 1, treeHeight = 48 + tiers * 128 + (tiers - 1) * 14 + 12;
      const positions = new Map(all.map(s => [s.id, { x: [150, 450, 750][s.branch], y: 82 + depth(s) * 142 }]));
      const learned = state.learned.includes(chosen.id), parent = byId.get(chosen.requires);
      const missing = parent && !state.learned.includes(parent.id), low = state.level < chosen.level;
      const reason = learned ? 'Öğrenildi' : low ? chosen.level + '. seviye gerekli' : missing ? 'Önce ' + parent.name : state.points ? '1 puanla öğren' : 'Yetenek puanı gerekli';
      const branches = [0, 1, 2].map(branch => '<section class="talent-path" data-branch="' + branch + '"><span class="talent-path-name">' + ['KÜLÜN ÇELİĞİ', 'KANIN YEMİNİ', 'MEZARIN ZİNCİRİ'][branch] + '</span>' + all.filter(s => s.branch === branch).sort((a,b) => depth(a)-depth(b) || a.level-b.level).map(s => {
        const known = state.learned.includes(s.id), blocked = state.level < s.level || s.requires && !state.learned.includes(s.requires), slot = state.loadout.indexOf(s.id);
        return '<button data-char="skill" data-skill="' + s.id + '" data-branch="' + branch + '" data-tier="' + depth(s) + '" style="grid-row:' + (depth(s)+1) + '" class="talent-node ' + (known ? 'learned' : blocked ? 'locked' : 'available') + (s.id === chosen.id ? ' selected' : '') + '" aria-pressed="' + (s.id === chosen.id) + '" title="' + escape(s.name) + ' · Seviye ' + s.level + '"><i class="talent-emblem">' + icon(s.id) + '</i><strong>' + escape(s.name) + '</strong><small>' + (slot >= 0 ? 'Yuva ' + ['I','II','III'][slot] : known ? 'Öğrenildi' : 'Seviye ' + s.level) + '</small></button>';
      }).join('') + '</section>').join('');
      const lines = all.map(s => {
        const pos = positions.get(s.id), prior = positions.get(s.requires), known = state.learned.includes(s.id);
        const ready = !known && state.level >= s.level && (!s.requires || state.learned.includes(s.requires));
        const d = prior ? 'M' + prior.x + ' ' + (prior.y+94) + 'V' + (pos.y-37) : 'M450 24V36H' + pos.x + 'V' + (pos.y-37);
        return '<path data-branch="' + s.branch + '" data-child="' + s.id + '"' + (prior ? ' data-parent="' + s.requires + '"' : '') + ' class="' + (known ? 'lit' : ready ? 'ready' : '') + '" d="' + d + '"/>';
      }).join('');
      const loadout = state.loadout.map((id, slot) => { const s = byId.get(id); return '<div class="talent-equipped"><button data-char="skill" data-skill="' + (id || chosen.id) + '"><kbd>' + ['SAĞ FARE', '1', '2'][slot] + '</kbd>' + (s ? icon(s.id) : '') + '<span>' + (s ? escape(s.name) : 'Boş yetenek') + '</span></button>' + (s ? '<button class="talent-remove" data-char="assign" data-slot="' + slot + '" data-skill="" aria-label="' + escape(s.name) + ' yuvasını boşalt">×</button>' : '') + '</div>'; }).join('');
      const assignment = learned ? '<div class="talent-bind"><small>Kullanacağın yuvayı seç</small>' + [0, 1, 2].map(slot => '<button data-char="assign" data-skill="' + chosen.id + '" data-slot="' + slot + '" ' + (state.loadout[slot] === chosen.id ? 'disabled' : '') + '>Yuva ' + ['I','II','III'][slot] + (state.loadout[slot] === chosen.id ? ' · Atandı' : ' · Ata') + '</button>').join('') + '</div>' : '';
      return '<p class="char-tree-intro">Üç yol. Seviye atlayınca bir yetenek puanı kazanırsın; yeni güçler öğrendiğin dalı ilerletir.</p><div class="talent-workspace"><div class="talent-tree" style="--talent-height:' + treeHeight + 'px;--talent-tiers:' + tiers + '"><div class="talent-canvas"><div class="talent-origin">BAHTİYAR</div><svg class="talent-connections" viewBox="0 0 900 ' + treeHeight + '" preserveAspectRatio="none" aria-hidden="true">' + lines + '</svg><div class="talent-paths">' + branches + '</div></div></div><aside class="talent-inspect"><small>SEVİYE ' + chosen.level + ' · AKTİF GÜÇ</small><header>' + icon(chosen.id) + '<h3>' + escape(chosen.name) + '</h3></header><p>' + escape(chosen.description) + '</p><div class="talent-cost"><span>' + Math.round(chosen.cost) + ' dayanıklılık</span><span>' + chosen.cooldown + ' saniye bekleme</span></div><button class="talent-learn" data-char="unlock" data-skill="' + chosen.id + '" ' + (learned || low || missing || !state.points ? 'disabled' : '') + '>' + escape(reason) + '</button>' + assignment + '</aside></div><div class="talent-equipped-bar">' + loadout + '</div><p class="char-tree-note">Normal vuruş ve seçtiğin üç aktif güç kullanılır. Aynı güç iki yuvada bulunamaz.</p>';
    }
    const tooltip = document.createElement('div'); tooltip.className = 'char-hover-tooltip hidden'; tooltip.id = 'character-item-tooltip'; tooltip.setAttribute('role', 'tooltip'); overlay.appendChild(tooltip);
    let hoverButton = null, touchActionAt = -1000;
    function hideTooltip() { if (hoverButton) hoverButton.removeAttribute('aria-describedby'); hoverButton = null; tooltip.classList.add('hidden'); }
    function stopPreview() { if (previewFrame) cancelAnimationFrame(previewFrame); previewFrame = 0; }
    function startPreview() {
      stopPreview(); const canvas = content.querySelector('#character-preview');
      if (!canvas || typeof options.onPreview !== 'function') return;
      function frame(now) {
        previewFrame = 0;
        if (!opened || tab !== 'inventory' || !canvas.isConnected || overlay.classList.contains('hidden')) return;
        options.onPreview(canvas, now);
        previewFrame = requestAnimationFrame(frame);
      }
      previewFrame = requestAnimationFrame(frame);
    }
    function rememberFocus() {
      const active = document.activeElement;
      if (!overlay.contains(active) || !active.dataset.char) return null;
      const keys = ['char','uid','slot','skill','tab','filter','direction'], token = {};
      for (const key of keys) if (active.dataset[key] != null) token[key] = active.dataset[key];
      return token;
    }
    function restoreFocus(token) {
      if (!token) return;
      const controls = [...overlay.querySelectorAll('[data-char]:not(:disabled)')];
      let next = controls.find(el => Object.keys(token).every(key => el.dataset[key] === token[key]));
      if (!next && token.uid) next = controls.find(el => el.dataset.char === 'select' && el.dataset.uid === token.uid);
      if (!next && token.skill) next = controls.find(el => el.dataset.char === 'skill' && el.dataset.skill === token.skill);
      if (!next && token.slot) next = controls.find(el => el.dataset.char === 'select' && el.dataset.slot === token.slot);
      if (!next && token.char === 'assign') next = controls.find(el => el.dataset.char === 'skill' && el.dataset.skill === selectedSkill);
      if (next) next.focus({ preventScroll: true });
    }
    function refresh(force) {
      const state = getState(); if (!opened || !state || (!force && lastRevision === state.revision + ':' + getGame().difficulty)) return;
      lastRevision = state.revision + ':' + getGame().difficulty;
      const samePage = overlay.querySelector('.character-panel').dataset.page === tab;
      const scroll = { content: content.scrollTop, bag: content.querySelector('.char-bag-grid')?.scrollTop || 0, tree: content.querySelector('.talent-tree')?.scrollTop || 0 };
      const focused = rememberFocus(); hideTooltip(); if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0;
      const min = B.Progression.thresholds[state.level - 1], max = state.nextLevelXp(), fraction = max ? Math.min(1, (state.xp - min) / (max - min)) : 1;
      progress.innerHTML = '<div><strong>Seviye ' + state.level + '</strong><span>' + (max ? 'Tecrübe ' + (state.xp - min) + ' / ' + (max - min) : 'En yüksek seviye') + '</span><b>' + state.points + ' yetenek puanı</b></div><div class="char-xp-track" role="progressbar" aria-label="Seviye ilerlemesi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(fraction * 100) + '"><i style="width:' + (fraction * 100).toFixed(1) + '%"></i></div>';
      overlay.querySelectorAll('[data-char="tab"]').forEach(el => { const active = el.dataset.tab === tab; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
      overlay.querySelector('.character-panel').dataset.page = tab;
      stopPreview(); content.innerHTML = tab === 'skills' ? talents(state) : inventory(state);
      if (samePage) {
        content.scrollTop = scroll.content;
        const bag = content.querySelector('.char-bag-grid'), tree = content.querySelector('.talent-tree');
        if (bag && renderedFilter === bagFilter) bag.scrollTop = scroll.bag;
        if (tree) tree.scrollTop = scroll.tree;
      } else content.scrollTop = 0;
      renderedFilter = bagFilter;
      restoreFocus(focused); if (tab === 'inventory') startPreview();
    }
    function inspect(button, event) {
      const state = getState(); if (!state) return;
      selected = button.dataset.uid || null; selectedSlot = selected ? null : button.dataset.slot || null;
      const entry = state.inventory.find(i => i.uid === selected), def = B.Progression.resolveItem(entry), detail = content.querySelector('.char-detail');
      content.querySelectorAll('[data-char="select"]').forEach(el => {
        const active = selected ? el.dataset.uid === selected : el.classList.contains('char-equipment') && el.dataset.slot === selectedSlot;
        el.classList.toggle('selected', active); el.setAttribute('aria-pressed', String(active));
      });
      if (detail) { detail.className = 'char-detail' + (def ? ' rarity-' + def.rarity : ''); detail.innerHTML = itemDetail(state, entry, false); }
      // Keep the clicked tile and live canvas in place. Replacing them on the first
      // click prevents browsers from delivering a genuine second click to that item.
      if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0;
      if (window.innerWidth <= 1050 && event.detail > 0) inspectScroll = setTimeout(() => {
        inspectScroll = 0; if (opened && tab === 'inventory') detail?.scrollIntoView({ block: 'nearest' });
      }, lastPointerType === 'touch' || lastPointerType === 'pen' ? 420 : 0);
    }
    function change(result) {
      if (!result) return;
      status.textContent = result.ok ? 'Değişiklik uygulandı.' : result.reason;
      if (result.ok && typeof options.onChange === 'function') options.onChange(getState());
      refresh(true);
    }
    function toggleEquipment(button) {
      const state = getState(); if (!state) return;
      if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0; hideTooltip();
      if (button.classList.contains('char-equipment')) {
        if (!state.equipment[button.dataset.slot]) { status.textContent = 'Bu yuva zaten boş.'; return; }
        if (typeof state.unequip === 'function') change(state.unequip(button.dataset.slot));
      } else {
        const entry = state.inventory.find(i => i.uid === button.dataset.uid), def = B.Progression.resolveItem(entry);
        if (!def) return;
        if (state.equipment[def.slot] === entry.uid) { if (typeof state.unequip === 'function') change(state.unequip(def.slot)); return; }
        change(state.equip(entry.uid));
      }
    }
    overlay.addEventListener('pointerdown', event => { lastPointerType = event.pointerType || 'mouse'; hideTooltip(); });
    overlay.addEventListener('click', event => {
      const button = event.target.closest('[data-char]'); if (!button || !overlay.contains(button)) return;
      event.stopPropagation(); const state = getState();
      switch (button.dataset.char) {
        case 'turn': if (typeof options.onPreviewTurn === 'function') options.onPreviewTurn(Number(button.dataset.direction)); break;
        case 'close': close(); break;
        case 'tab': tap = null; tab = button.dataset.tab; status.textContent = ''; refresh(true); content.scrollTop = 0; break;
        case 'filter': tap = null; bagFilter = button.dataset.filter; selectedSlot = null; refresh(true); break;
        case 'select': {
          inspect(button, event);
          const key = (button.classList.contains('char-equipment') ? 'slot:' + button.dataset.slot : 'item:' + button.dataset.uid), now = performance.now();
          if ((lastPointerType === 'touch' || lastPointerType === 'pen') && event.detail > 0) {
            if (tap && tap.key === key && now - tap.time < 380 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 20) {
              tap = null; touchActionAt = now; toggleEquipment(button);
            } else tap = { key, time: now, x: event.clientX, y: event.clientY };
          } else tap = null;
          break;
        }
        case 'equip': if (state) change(state.equip(button.dataset.uid)); break;
        case 'unequip': if (state && typeof state.unequip === 'function') change(state.unequip(button.dataset.slot)); break;
        case 'skill': selectedSkill = button.dataset.skill; refresh(true); if (window.innerWidth <= 900) content.querySelector('.talent-inspect').scrollIntoView({ block: 'nearest' }); break;
        case 'assign': if (state) change(state.assign(Number(button.dataset.slot), button.dataset.skill || null)); break;
        case 'unlock': if (state) change(state.unlock(button.dataset.skill)); break;
      }
    });
    overlay.addEventListener('dblclick', event => {
      const button = event.target.closest('[data-char="select"]'); if (!button || !overlay.contains(button)) return;
      event.preventDefault(); event.stopPropagation();
      if (performance.now() - touchActionAt > 500) toggleEquipment(button);
    });
    overlay.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const button = event.target.closest('[data-char="select"]'); if (!button || !button.dataset.uid || hoverButton === button) return;
      const state = getState(), entry = state?.inventory.find(i => i.uid === button.dataset.uid), def = B.Progression.resolveItem(entry);
      if (!def) return;
      hideTooltip(); hoverButton = button; tooltip.className = 'char-hover-tooltip rarity-' + def.rarity; tooltip.innerHTML = itemDetail(state, entry, true); button.setAttribute('aria-describedby', tooltip.id);
      const rect = button.getBoundingClientRect(), width = tooltip.offsetWidth, height = tooltip.offsetHeight;
      let left = rect.right + 12; if (left + width > innerWidth - 14) left = rect.left - width - 12;
      tooltip.style.left = Math.max(14, Math.min(innerWidth - width - 14, left)) + 'px'; tooltip.style.top = Math.max(14, Math.min(innerHeight - height - 14, rect.top - 6)) + 'px';
    });
    overlay.addEventListener('pointerout', event => { if (hoverButton && !hoverButton.contains(event.relatedTarget)) hideTooltip(); });
    overlay.addEventListener('scroll', hideTooltip, true);
    overlay.addEventListener('change', event => { if (event.target.dataset.char === 'assign') change(getState().assign(Number(event.target.dataset.slot), event.target.value || null)); });
    function onKey(event) {
      if (!opened) return;
      if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.code !== 'Tab') return;
      const controls = Array.from(overlay.querySelectorAll('button:not(:disabled),select:not(:disabled)')).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    function open(nextTab) {
      if (!getState()) return false;
      if (!opened) priorFocus = document.activeElement;
      opened = true; tab = nextTab === 'skills' || nextTab === 'talents' ? 'skills' : 'inventory';
      overlay.classList.remove('hidden'); status.textContent = ''; tap = null; refresh(true); content.scrollTop = 0; overlay.querySelector('[data-char="close"]').focus(); return true;
    }
    function close(silent) {
      if (!opened) return;
      stopPreview(); hideTooltip(); if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0; tap = null;
      opened = false; overlay.classList.add('hidden');
      if (priorFocus && priorFocus.isConnected && priorFocus.focus) priorFocus.focus();
      if (!silent && typeof options.onClose === 'function') options.onClose();
    }
    return { open, close, refresh, get isOpen() { return opened; }, element: overlay,
      dispose: () => { close(true); stopPreview(); document.removeEventListener('keydown', onKey, true); overlay.remove(); } };
  }
  B.CharacterUI = Object.freeze({ create, gearIcon });
}());
