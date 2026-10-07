/* KABİR AZABI — the attacked enemy's portrait and health. Cached artwork; no live 3D rendering. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};

  /* ───────── Status effects on foes (read-only registry + small generic store) ─────────
     Nothing here changes gameplay. Each definition READS the fields the game already keeps (talent-runtime bleed/burn/curse/dread, gear dots,
     enemy.stagger / staggerKind / fear) and B.Status.apply(enemy, id, seconds, opts) stores effects that have no field of their own in enemy.statuses
     ([{ id, remaining, total, stacks, value, src }], ticked by B.Status.tick(dt, enemies) from combat.js, cleared on death).
     B.Status.register(id, { kind: 'dot' | 'control' | 'debuff' | 'immune', name, icon (svg inner, 24x24, currentColor), desc(info) -> text, read?(enemy, game, out) -> bool }).
     B.Status.of(enemy, game) returns a REUSED array of REUSED entries { id, def, left, total, dps, value, stacks } (no allocation per frame). */
  const tr = s => KabirI18n.t(s);
  const sdefs = new Map(), sorder = [], spool = [], sresult = [];
  let sused = 0;
  const KIND_COLOR = { dot: '#e07a62', control: '#a9c1d6', debuff: '#e0bf7e', immune: '#b8ae98' };
  const KIND_NAME = { dot: 'Zamanla hasar', control: 'Kontrol', debuff: 'Zayıflatma', immune: 'Bağışıklık' };
  function fmt(template, o) { return tr(template).replace(/\{(\w+)\}/g, (m, k) => o && o[k] !== undefined ? o[k] : m); }
  const secs = v => v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString().replace('.', KabirI18n.lang === 'en' ? '.' : ',');
  function register(id, def) { def.id = id; if (!sdefs.has(id)) sorder.push(def); sdefs.set(id, def); return def; }
  function sentry() { return spool[sused] || (spool[sused] = { id: '', def: null, left: 0, total: 0, dps: 0, value: 0, stacks: 1 }); }
  function statusOf(e, g) {
    sused = 0; sresult.length = 0;
    if (!e || e.dead) return sresult;
    for (let i = 0; i < sorder.length; i++) {
      const d = sorder[i]; if (!d.read) continue;
      const x = sentry(); x.id = d.id; x.def = d; x.left = x.total = x.dps = x.value = 0; x.stacks = 1;
      if (d.read(e, g, x)) { sresult.push(x); sused++; }
    }
    const list = e.statuses;
    if (list) for (let i = 0; i < list.length; i++) {
      const s = list[i], d = sdefs.get(s.id); if (!d || !(s.remaining > 0)) continue;
      let x = null; for (let k = 0; k < sresult.length; k++) if (sresult[k].id === s.id) { x = sresult[k]; break; }
      if (x) { if (s.remaining > x.left) { x.left = s.remaining; x.total = s.total; } x.stacks = Math.max(x.stacks, s.stacks || 1); x.value = x.value || s.value || 0; continue; }
      x = sentry(); x.id = d.id; x.def = d; x.left = s.remaining; x.total = s.total || s.remaining; x.dps = s.value || 0; x.value = s.value || 0; x.stacks = s.stacks || 1;
      sresult.push(x); sused++;
    }
    return sresult;
  }
  function apply(e, id, seconds, opts) {
    if (!e || e.dead || !(seconds > 0) || !sdefs.has(id)) return null;
    const o = opts || {}, list = e.statuses || (e.statuses = []);
    let s = null; for (let i = 0; i < list.length; i++) if (list[i].id === id) { s = list[i]; break; }
    if (!s) { s = { id, remaining: 0, total: 0, stacks: 0, value: 0, src: '' }; list.push(s); }
    s.remaining = Math.max(s.remaining, seconds); s.total = Math.max(s.total, s.remaining);
    s.stacks = Math.min(o.maxStacks || 99, (s.stacks || 0) + (o.stacks || (s.stacks ? 0 : 1)));
    if (o.value !== undefined) s.value = o.value; if (o.src) s.src = o.src;
    return s;
  }
  function remove(e, id) { const l = e && e.statuses; if (!l) return; for (let i = l.length - 1; i >= 0; i--) if (l[i].id === id) l.splice(i, 1); }
  function tick(dt, enemies) {
    for (let n = 0; n < enemies.length; n++) {
      const e = enemies[n], l = e.statuses; if (!l || !l.length) continue;
      if (e.dead) { l.length = 0; continue; }
      for (let i = l.length - 1; i >= 0; i--) { l[i].remaining -= dt; if (l[i].remaining <= 0) l.splice(i, 1); }
    }
  }
  // Flat gothic glyphs, 24x24, drawn with currentColor (the plate colour comes from the kind).
  const G = (b) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
  const ICONS = {
    bleed: G('<path d="M12 3.2c3.2 4.2 5.6 7.1 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-3 2.4-5.9 5.6-10.1z" fill="currentColor" fill-opacity=".3"/><path d="M9.3 14.3a2.9 2.9 0 0 0 2.1 2.4" stroke-width="1.3"/>'),
    burn: G('<path d="M12 2.8c.5 3.1-1.9 4.5-3.5 6.7-1.3 1.8-1.9 3.2-1.9 4.9a5.4 5.4 0 0 0 10.8 0c0-2-.9-3.4-2-4.6-.3 1.2-.9 1.9-1.7 2.2.5-3.2-.4-6.5-1.7-9.2z" fill="currentColor" fill-opacity=".3"/><path d="M12 20a2.3 2.3 0 0 1-2.3-2.3c0-1.3 1-2 2.3-3.6 1.3 1.6 2.3 2.3 2.3 3.6A2.3 2.3 0 0 1 12 20z" stroke-width="1.2"/>'),
    rot: G('<path d="M12 3.5c-4 0-6.6 2.6-6.6 6.2 0 2.2 1 3.7 2.4 4.6V18h8.4v-3.7c1.4-.9 2.4-2.4 2.4-4.6 0-3.6-2.6-6.2-6.6-6.2z" fill="currentColor" fill-opacity=".18"/><circle cx="9.4" cy="10.4" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10.4" r="1.5" fill="currentColor" stroke="none"/><path d="M10.6 15.2V18M12 15.2V18M13.4 15.2V18" stroke-width="1.2"/><path d="M5 20.5l14-1" stroke-width="1.2"/>'),
    dread: G('<path d="M2.8 12S6.2 6.2 12 6.2 21.2 12 21.2 12 17.8 17.8 12 17.8 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity=".25"/><path d="M12 10.2v3.6" stroke-width="1.4"/><path d="M12 2.8v1.8M5.4 4.6l1 1.4M18.6 4.6l-1 1.4" stroke-width="1.2"/>'),
    stun: G('<path d="M12 4.2l1.9 5.5 5.6 1.9-5.6 1.9L12 19l-1.9-5.5-5.6-1.9 5.6-1.9z" fill="currentColor" fill-opacity=".25"/><circle cx="19.4" cy="5" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="19.2" r="1.1" fill="currentColor" stroke="none"/>'),
    fear: G('<path d="M12 3.4l9 16.2H3z" fill="currentColor" fill-opacity=".15"/><path d="M12 9.6v4.6"/><circle cx="12" cy="16.9" r=".9" fill="currentColor" stroke="none"/>'),
    guardbreak: G('<path d="M12 3l7 2.6v5.6c0 4.2-2.9 7.4-7 9.2-4.1-1.8-7-5-7-9.2V5.6z" fill="currentColor" fill-opacity=".14"/><path d="M12.4 3.4l-2 5 3 2.4-2.4 3.4 1.4 5" stroke-width="1.4"/>'),
    slow: G('<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5.2 4 8.5 0-3.3 4-4.5 4-8.5M8 20.5c0-4 4-5.2 4-8.5 0 3.3 4 4.5 4 8.5"/>'),
    hooked: G('<circle cx="12" cy="4.6" r="1.8"/><path d="M12 6.4v9.2c0 2.4-1.6 4-3.8 4S4.4 18 4.4 15.6"/><path d="M4.4 15.6l-1.6 2.4M4.4 15.6l2.6 1.4" stroke-width="1.3"/>'),
    marked: G('<circle cx="12" cy="12" r="6.2"/><path d="M12 2.6v5M12 16.4v5M2.6 12h5M16.4 12h5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>'),
    vulnerable: G('<path d="M6 6.2l6 5 6-5M6 12.4l6 5 6-5"/><path d="M8 20.4h8" stroke-width="1.3"/>'),
    immune: G('<rect x="6.6" y="9.6" width="6.2" height="4.8" rx="2.4" stroke-opacity=".75"/><rect x="11.2" y="9.6" width="6.2" height="4.8" rx="2.4" stroke-opacity=".75"/><circle cx="12" cy="12" r="8.4"/><path d="M6 18L18 6"/>')
  };
  // Dots and curses come from the talent runtime (talents.statusOf) and gear-power dots (talents.gearDotOf).
  function dotRead(kind) {
    return function (e, g, x) {
      const t = g && g.talents; let on = false;
      const s = t && t.statusOf && t.statusOf(e), d = s && s[kind];
      if (d && d.time > 0) { x.left = d.time; x.dps = d.dps; on = true; }
      const gd = t && t.gearDotOf && t.gearDotOf(e);
      if (gd && gd.kind === kind && gd.time > 0) { x.left = Math.max(x.left, gd.time); x.dps += gd.dps; on = true; }
      return on;
    };
  }
  register('bleed', { kind: 'dot', name: 'Kanama', icon: ICONS.bleed, read: dotRead('bleed'),
    desc: i => fmt('Saniyede {n} hasar verir. {s} sn kaldı.', { n: Math.max(1, Math.round(i.dps)), s: secs(i.left) }) });
  register('burn', { kind: 'dot', name: 'Yanma', icon: ICONS.burn, read: dotRead('burn'),
    desc: i => fmt('Saniyede {n} hasar verir. {s} sn kaldı.', { n: Math.max(1, Math.round(i.dps)), s: secs(i.left) }) });
  register('rot', { kind: 'debuff', name: 'Çürüme Laneti', icon: ICONS.rot,
    read(e, g, x) { const t = g && g.talents, s = t && t.statusOf && t.statusOf(e); if (!s || !(s.rot > 0)) return false; x.left = s.rot; x.value = Math.round((s.rotAmp - 1) * 100); return true; },
    desc: i => fmt('Aldığı hasar %{p} artar. {s} sn kaldı.', { p: i.value, s: secs(i.left) }) });
  register('dread', { kind: 'debuff', name: 'Dehşet', icon: ICONS.dread,
    read(e, g, x) { const t = g && g.talents, s = t && t.statusOf && t.statusOf(e); if (!s || !(s.dread > 0)) return false; x.left = s.dread; return true; },
    desc: i => fmt('Korkudan titriyor; %20 fazla hasar alır. {s} sn kaldı.', { s: secs(i.left) }) });
  register('stun', { kind: 'control', name: 'Sersemlemiş', icon: ICONS.stun,
    read(e, g, x) { if (e.boss || !(e.stagger > 0) || e.staggerKind === 'fear' || e.staggerKind === 'guardBreak' || !(e.staggerTotal >= .6)) return false; x.left = e.stagger; x.total = e.staggerTotal; return true; },
    desc: i => fmt('Sendeliyor; saldıramaz, yürüyemez. {s} sn kaldı.', { s: secs(i.left) }) });
  register('guardbreak', { kind: 'control', name: 'Savunması Kırık', icon: ICONS.guardbreak,
    read(e, g, x) { if (e.boss || !(e.stagger > 0) || e.staggerKind !== 'guardBreak') return false; x.left = e.stagger; x.total = e.staggerTotal; return true; },
    desc: i => fmt('Siperi kırıldı; bir an açıkta. {s} sn kaldı.', { s: secs(i.left) }) });
  register('fear', { kind: 'control', name: 'Korku', icon: ICONS.fear,
    read(e, g, x) { if (e.boss || !(e.fear > 0)) return false; x.left = e.fear; return true; },
    desc: i => fmt('Korkudan kaçıyor, saldırmıyor. {s} sn kaldı.', { s: secs(i.left) }) });
  // Held in enemy.statuses through B.Status.apply (no game field of their own yet; later effects use these).
  register('slow', { kind: 'control', name: 'Yavaşlamış', icon: ICONS.slow,
    desc: i => fmt('Hareketi %{p} yavaşladı. {s} sn kaldı.', { p: Math.round((i.value || .3) * 100), s: secs(i.left) }) });
  register('hooked', { kind: 'control', name: 'Kancalı', icon: ICONS.hooked,
    desc: i => fmt('Kancaya takıldı, yerinden çekildi. {s} sn kaldı.', { s: secs(i.left) }) });
  register('marked', { kind: 'debuff', name: 'İşaretli', icon: ICONS.marked,
    desc: i => fmt('Hedef alındı; bir sonraki darbeler daha ağır. {s} sn kaldı.', { s: secs(i.left) }) });
  register('vulnerable', { kind: 'debuff', name: 'Savunmasız', icon: ICONS.vulnerable,
    desc: i => fmt('Aldığı hasar %{p} artar. {s} sn kaldı.', { p: Math.round((i.value || .15) * 100), s: secs(i.left) }) });
  register('immune', { kind: 'immune', name: 'Zincire Bağışık', icon: ICONS.immune,
    read(e, g, x) { return !!e.boss; },
    desc: () => tr('Sersemletilemez, korkutulamaz ve çekilemez.') });
  Object.assign(KabirI18n.dictionary || {}, {
    'Kanama': 'Bleeding', 'Yanma': 'Burning', 'Çürüme Laneti': 'Curse of Rot', 'Dehşet': 'Dread', 'Sersemlemiş': 'Stunned', 'Savunması Kırık': 'Guard Broken',
    'Korku': 'Fear', 'Yavaşlamış': 'Slowed', 'Kancalı': 'Hooked', 'İşaretli': 'Marked', 'Savunmasız': 'Vulnerable', 'Zincire Bağışık': 'Chain-proof',
    'Etkiler': 'Effects', 'Zamanla hasar': 'Damage over time', 'Kontrol': 'Control', 'Zayıflatma': 'Weakness', 'Bağışıklık': 'Immunity',
    'Saniyede {n} hasar verir. {s} sn kaldı.': 'Deals {n} damage per second. {s} s left.',
    'Aldığı hasar %{p} artar. {s} sn kaldı.': 'Takes {p}% more damage. {s} s left.',
    'Korkudan titriyor; %20 fazla hasar alır. {s} sn kaldı.': 'Trembling in fear; takes 20% more damage. {s} s left.',
    'Sendeliyor; saldıramaz, yürüyemez. {s} sn kaldı.': 'Reeling; cannot attack or move. {s} s left.',
    'Siperi kırıldı; bir an açıkta. {s} sn kaldı.': 'Its guard is broken; open for a moment. {s} s left.',
    'Korkudan kaçıyor, saldırmıyor. {s} sn kaldı.': 'Fleeing in terror, not attacking. {s} s left.',
    'Hareketi %{p} yavaşladı. {s} sn kaldı.': 'Movement slowed by {p}%. {s} s left.',
    'Kancaya takıldı, yerinden çekildi. {s} sn kaldı.': 'Caught on the hook and dragged. {s} s left.',
    'Hedef alındı; bir sonraki darbeler daha ağır. {s} sn kaldı.': 'Singled out; the next blows land harder. {s} s left.',
    'Sersemletilemez, korkutulamaz ve çekilemez.': 'Cannot be stunned, frightened or pulled.'
  });
  B.Status = Object.freeze({ register, apply, remove, tick, of: statusOf, get: id => sdefs.get(id), list: () => sorder.slice(), icons: ICONS, kindName: k => tr(KIND_NAME[k] || ''), fmt, secs });
  const portraits = Object.freeze({
    prisoner: 'assets/ui/target-prisoner.webp', guard: 'assets/ui/target-guard.webp',
    cultist: 'assets/ui/target-cultist.webp', stalker: 'assets/ui/target-stalker.webp',
    carrier: 'assets/ui/target-carrier.webp', boss: 'assets/ui/target-boss.webp',
    drowned: 'assets/ui/target-drowned.webp', rootborn: 'assets/ui/target-rootborn.webp', crawler: 'assets/ui/target-crawler.webp',
    urchin: 'assets/ui/target-urchin.webp', lantern: 'assets/ui/target-lantern.webp', bell: 'assets/ui/target-bell.webp',
    ashbound: 'assets/ui/target-ashbound.webp', shardseer: 'assets/ui/target-shardseer.webp', cavefang: 'assets/ui/target-cavefang.webp',
    gravemason: 'assets/ui/target-gravemason.webp', ruinwarden: 'assets/ui/target-ruinwarden.webp', hollowking: 'assets/ui/target-hollowking.webp',
    emberbound: 'assets/ui/target-emberbound.webp', chainseer: 'assets/ui/target-chainseer.webp', slagcrawler: 'assets/ui/target-slagcrawler.webp',
    forgesentinel: 'assets/ui/target-forgesentinel.webp', ashwarden: 'assets/ui/target-ashwarden.webp', furnaceheart: 'assets/ui/target-furnaceheart.webp',
    damned: 'assets/ui/target-damned.webp', verdictseer: 'assets/ui/target-verdictseer.webp', voidcrawler: 'assets/ui/target-voidcrawler.webp',
    chainjailer: 'assets/ui/target-chainjailer.webp', verdictwarden: 'assets/ui/target-verdictwarden.webp', lastjudge: 'assets/ui/target-lastjudge.webp'
  });
  const chapterPortraits = {
    3: ['prisoner', 'ashbound', 'shardseer', 'cavefang', 'gravemason', 'ruinwarden', 'hollowking'],
    4: ['prisoner', 'emberbound', 'chainseer', 'slagcrawler', 'forgesentinel', 'ashwarden', 'furnaceheart'],
    5: ['prisoner', 'damned', 'verdictseer', 'voidcrawler', 'chainjailer', 'verdictwarden', 'lastjudge']   // chapter V busts: rendered from the live models (tools: see ASSET-LICENSES)
  };
  const bossPhases = {
    bell: ['', KabirI18n.t('BOĞULMUŞ ÇANLIK'), KabirI18n.t('DENİZİN YEMİNİ'), KabirI18n.t('MEZAR KÖKLERİ'), KabirI18n.t('SON ÇAN')],
    hollowking: ['', KabirI18n.t('SESSİZ TAHT'), KabirI18n.t('TAŞ TAHT ÇÖKÜYOR'), KabirI18n.t('OYUKLAR AÇILDI')],
    furnaceheart: ['', KabirI18n.t('KIZIL OCAK'), KabirI18n.t('OCAK BASINCI YÜKSELİYOR'), KabirI18n.t('SON DÖKÜM')],
    lastjudge: ['', KabirI18n.t('SON MAHKEME'), KabirI18n.t('EFENDİLERİN YANKISI'), KabirI18n.t('SON HÜKÜM')]
  };
  // Keep the small portrait images ready before the loading cover is removed.
  // Failed artwork does not prevent the player or health bar from appearing.
  const preparedImages = new Map(), failedImages = new Set();
  let prepared = null;
  function prepare() {
    if (prepared) return prepared;
    // I/II retain their existing warmup; III/IV only load their own roster and the fallback.
    const types = chapterPortraits[B.ActiveChapter] || Object.keys(portraits).slice(0, 12);
    prepared = Promise.all(types.map(type => {
      const image = new Image();
      preparedImages.set(type, image);
      let ready;
      if (typeof image.decode === 'function') {
        image.src = portraits[type];
        ready = image.decode();
      } else {
        ready = new Promise((resolve, reject) => {
          image.onload = resolve; image.onerror = reject; image.src = portraits[type];
        });
      }
      return ready.catch(() => { failedImages.add(type); });
    })).then(() => { warm(); });
    return prepared;
  }
  // The first time the bar appeared (first attack), the browser had to build the drawing programs for its gradients,
  // blurred text shadows, rounded portraits and upload each portrait, which stalled one frame by up to ~130 ms
  // (Chrome draws page content and WebGL on the same GPU thread).
  // A copy of the bar (every portrait, boss styling) is drawn almost fully transparent (1 %, invisible) through the
  // loading and title screens so that work is already done; it is removed on the first in-game HUD update.
  let warmEl = null;
  function warm() {
    if (warmEl || !document.body) return;
    try {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:fixed;left:50%;top:calc(var(--top, 0px) + 8px);width:calc(500px * var(--k, 1));transform:translateX(-50%);' +
        'display:flex;flex-wrap:wrap;align-items:center;gap:calc(7px * var(--k, 1));opacity:.01;pointer-events:none;z-index:3;contain:layout';
      const bar = (type, boss) => '<div class="target-portrait"><img alt="" width="256" height="256" src="' + portraits[type] + '"><i class="portrait-frame"></i></div>' +
        '<div class="target-details' + (boss ? ' boss-target phase2' : '') + KabirI18n.t('" style="flex:1 1 60%"><div class="target-title"><strong class="target-name">Zincir Celladı 0123456789</strong><small class="target-phase">ZİNCİRLER KIRILDI</small></div>') +
        '<div class="target-health"><i class="target-fill" style="transform:scaleX(.6)"></i><b class="target-count">1234 / 5678</b><i class="target-notch" style="display:block"></i></div></div>';
      let html = '';
      for (const type of preparedImages.keys()) if (!failedImages.has(type)) html += bar(type, type === 'boss' || type === 'hollowking' || type === 'furnaceheart' || type === 'lastjudge');
      // The skill slots' attack sweep (conic gradient + brightness) also first appears at the first attack.
      const slot = cls => '<div class="action ' + cls + '" style="position:relative;width:calc(90px * var(--k, 1));height:calc(90px * var(--k, 1));--progress:.4"><i class="skill light"></i></div>';
      html += slot('pressed') + slot('unavailable') + slot('action-rage burning');
      html += '<div class="target-status" style="flex:1 1 100%">' + B.Status.list().map(d => '<span class="ts-icon" data-kind="' + d.kind + '" style="pointer-events:none"><i class="ts-ico">' + d.icon + '</i>' +
        '<svg class="ts-ring" viewBox="0 0 28 28" preserveAspectRatio="none"><rect x="1" y="1" width="26" height="26" rx="3" pathLength="100" style="stroke-dashoffset:30"/></svg><b class="ts-n">2</b></span>').join('') + '</div>';
      el.innerHTML = html; document.body.appendChild(el); warmEl = el;
    } catch (e) { warmEl = null; }
  }
  function unwarm() { if (warmEl && warmEl !== true) { warmEl.remove(); warmEl = true; } }
  function create(root) {
    const portrait = root.querySelector('.target-portrait img'), name = root.querySelector('.target-name');
    const health = root.querySelector('.target-health'), fill = root.querySelector('.target-fill');
    const count = root.querySelector('.target-count'), phase = root.querySelector('.target-phase');
    let shown = false, previousId = null, previousType = null, previousName = '', previousHealth = '', previousScale = '';
    let previousMax = -1, previousHp = -1, previousPhase = '', wasBoss = false, wasPhase2 = false;
    let previousArt = null;
    // ajan:ui — gecikmeli "yenen can" izi (Diablo tarzı) ve şampiyon ayrımı; yalnız değer değişince yazılır
    const trail = document.createElement('i'); trail.className = 'target-trail'; trail.setAttribute('aria-hidden', 'true'); health.insertBefore(trail, fill);
    let wasChampion = false;
    // ── status icons under the health bar (max 6; rebuilt only when the SET of statuses changes) ──
    const row = document.createElement('div'); row.className = 'target-status'; row.setAttribute('aria-label', tr('Etkiler')); health.after(row);
    const MAX_ICONS = 6, slots = [], spare = [], reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    let statusEnemy = null, tipSlot = null, tipKey = '', tipTimer = 0, pressTimer = 0, lastGame = null;
    const tip = () => document.getElementById('skill-tip');
    function hideTip() {
      clearTimeout(tipTimer); clearTimeout(pressTimer); pressTimer = 0;
      if (!tipSlot) return; tipSlot = null; tipKey = '';
      const t = tip(); if (t && t.dataset.owner === 'status') { t.classList.remove('show'); t.setAttribute('aria-hidden', 'true'); t.dataset.owner = ''; }
    }
    function fillTip(slot, place) {
      const t = tip(); if (!t || !slot.def || document.body.dataset.view !== 'playing') return;
      const d = slot.def, name = tr(d.name), body = d.desc(slot), foot = B.Status.kindName(d.kind), key = name + '|' + body;
      if (key !== tipKey || t.dataset.owner !== 'status') {
        tipKey = key; t.dataset.owner = 'status'; t.innerHTML = '';
        const head = document.createElement('div'); head.className = 'tip-head';
        const b = document.createElement('b'); b.textContent = name; b.style.color = KIND_COLOR[d.kind] || ''; head.appendChild(b);
        const p = document.createElement('p'); p.textContent = body;
        const f = document.createElement('small'); f.textContent = foot;
        t.append(head, p, f);
      }
      if (place) {
        t.setAttribute('aria-hidden', 'false'); t.classList.add('show');
        const r = slot.el.getBoundingClientRect(), w = t.offsetWidth;
        t.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
        t.style.top = Math.min(innerHeight - t.offsetHeight - 8, r.bottom + 10) + 'px';
      }
    }
    function showTip(slot, hold) { tipSlot = slot; clearTimeout(tipTimer); fillTip(slot, true); if (hold) tipTimer = setTimeout(hideTip, hold); }
    function makeSlot() {
      const el = document.createElement('span'); el.className = 'ts-icon'; el.setAttribute('role', 'img');
      el.innerHTML = '<i class="ts-ico"></i><svg class="ts-ring" viewBox="0 0 28 28" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="26" height="26" rx="3" pathLength="100"/></svg><b class="ts-n"></b>';
      const slot = { el, ico: el.firstChild, arc: el.querySelector('rect'), badge: el.querySelector('.ts-n'), def: null, id: '', left: 0, total: 0, dps: 0, value: 0, stacks: 1,
        shownArc: -1, shownStacks: 0, timer: 0, leaving: false };
      el.addEventListener('pointerenter', ev => { if (ev.pointerType !== 'touch' && !slot.leaving) showTip(slot, 0); });
      el.addEventListener('pointerleave', ev => { if (ev.pointerType !== 'touch') hideTip(); });
      el.addEventListener('pointerdown', ev => {
        if (ev.pointerType !== 'touch' || slot.leaving) return;
        clearTimeout(pressTimer); pressTimer = setTimeout(() => { pressTimer = 0; showTip(slot, 4200); }, 380);
      });
      for (const n of ['pointerup', 'pointercancel']) el.addEventListener(n, ev => { if (ev.pointerType === 'touch') { clearTimeout(pressTimer); pressTimer = 0; } });
      return slot;
    }
    function retire(slot, instant) {
      if (tipSlot === slot) hideTip();
      const i = slots.indexOf(slot); if (i >= 0) slots.splice(i, 1);
      const done = () => { clearTimeout(slot.timer); slot.timer = 0; slot.el.remove(); slot.el.classList.remove('out'); slot.leaving = false; spare.push(slot); };
      if (instant || reduced.matches) { done(); return; }
      slot.leaving = true; slot.el.classList.add('out'); slot.timer = setTimeout(done, 170);
    }
    function clearStatus(instant) {
      hideTip();
      while (slots.length) retire(slots[0], instant);
      statusEnemy = null;
    }
    function setSlot(slot, x) {
      const d = x.def;
      if (slot.def !== d) {
        slot.def = d; slot.id = d.id; slot.ico.innerHTML = d.icon; slot.shownArc = -1; slot.shownStacks = 0; slot.total = 0;
        slot.el.dataset.kind = d.kind; slot.el.setAttribute('aria-label', tr(d.name));
      }
    }
    function syncStatus(enemy, game) {
      lastGame = game;
      const list = B.Status.of(enemy, game), n = Math.min(MAX_ICONS, list.length);
      if (statusEnemy !== enemy) {   // another foe: swap at once, the new icons fade in
        const fresh = statusEnemy !== null || slots.length;
        if (fresh) clearStatus(true);
        statusEnemy = enemy;
      }
      let same = n === slots.length;
      for (let i = 0; same && i < n; i++) if (slots[i].id !== list[i].id) same = false;
      if (!same) {
        const keep = new Set();
        for (let i = 0; i < n; i++) keep.add(list[i].id);
        for (let i = slots.length - 1; i >= 0; i--) if (!keep.has(slots[i].id)) retire(slots[i], false);
        const next = [];
        for (let i = 0; i < n; i++) {
          let slot = null;
          for (let k = 0; k < slots.length; k++) if (slots[k].id === list[i].id) { slot = slots[k]; break; }
          if (!slot) { slot = spare.pop() || makeSlot(); slot.def = null; slot.leaving = false; setSlot(slot, list[i]); }
          next.push(slot);
        }
        for (const l of slots.filter(sl => !next.includes(sl) && !sl.leaving)) retire(l, false);
        slots.length = 0; for (const sl of next) { slots.push(sl); row.appendChild(sl.el); }
      }
      for (let i = 0; i < n; i++) {   // numbers + ring (written only when they change)
        const x = list[i], slot = slots[i];
        slot.left = x.left; slot.dps = x.dps; slot.value = x.value; slot.stacks = x.stacks;
        if (x.total > slot.total) slot.total = x.total; if (x.left > slot.total) slot.total = x.left;
        const arc = x.left > 0 && slot.total > 0 ? Math.max(1, Math.round(100 * Math.min(1, x.left / slot.total) / 4) * 4) : 100;
        if (arc !== slot.shownArc) { slot.shownArc = arc; slot.arc.style.strokeDashoffset = String(100 - arc); }
        const st = x.stacks > 1 ? x.stacks : 0;
        if (st !== slot.shownStacks) { slot.shownStacks = st; slot.badge.textContent = st ? st : ''; }
      }
      if (tipSlot) { if (tipSlot.leaving || !slots.includes(tipSlot)) hideTip(); else fillTip(tipSlot, false); }
    }
    function setPortrait(type) {
      const art = !failedImages.has(type) ? type : !failedImages.has('prisoner') ? 'prisoner' : null;
      if (art !== previousArt) {
        previousArt = art;
        if (art) portrait.src = portraits[art];
        else portrait.removeAttribute('src');
      }
      portrait.hidden = !art;
    }
    portrait.addEventListener('error', () => {
      if (previousArt) failedImages.add(previousArt);
      setPortrait(previousType || 'prisoner');
    });
    function clear() {
      if (statusEnemy || slots.length) clearStatus(true);
      if (shown) { root.classList.add('hidden'); shown = false; }
      if (previousId !== null) { root.removeAttribute('data-enemy-id'); previousId = null; }
    }
    function update(enemy, game) {
      if (warmEl) unwarm();
      if (!enemy || enemy.dead || !Number.isFinite(enemy.hp) || !Number.isFinite(enemy.maxHp) || !(enemy.maxHp > 0) || !(enemy.hp > 0)) { clear(); return; }
      if (!shown) { root.classList.remove('hidden'); shown = true; }
      const changed = previousId !== enemy.id;
      if (changed) { root.setAttribute('data-enemy-id', enemy.id); previousId = enemy.id; }
      const type = Object.prototype.hasOwnProperty.call(portraits, enemy.type) ? enemy.type : 'prisoner';
      if (previousType !== type || previousArt && failedImages.has(previousArt)) { previousType = type; setPortrait(type); }
      const label = enemy.name || KabirI18n.t('Düşman');
      if (label !== previousName) { name.textContent = label; previousName = label; }
      const max = Math.max(1, Math.round(enemy.maxHp)), hp = Math.min(max, Math.ceil(Math.max(0, enemy.hp)));
      const text = hp + ' / ' + max;
      if (text !== previousHealth) { count.textContent = text; previousHealth = text; }
      if (max !== previousMax) { health.setAttribute('aria-valuemax', max); previousMax = max; }
      if (hp !== previousHp) { health.setAttribute('aria-valuenow', hp); previousHp = hp; }
      const scale = 'scaleX(' + Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) + ')';
      if (scale !== previousScale) { const snap = changed || !previousScale; fill.style.transform = scale; trail.classList.toggle('snap', snap); trail.style.transform = scale; previousScale = scale; }
      const boss = !!enemy.boss, phase2 = boss && enemy.phase >= 2;
      if (boss !== wasBoss) { root.classList.toggle('boss-target', boss); wasBoss = boss; }
      if (phase2 !== wasPhase2) { root.classList.toggle('phase2', phase2); wasPhase2 = phase2; }
      const champion = !boss && !!(enemy.champion || enemy.elite);
      if (champion !== wasChampion) { root.classList.toggle('champion-target', champion); wasChampion = champion; }
      const phases = bossPhases[enemy.type];
      const phaseText = phases ? phases[enemy.phase] || '' : boss ? phase2 ? KabirI18n.t('ZİNCİRLER KIRILDI') : KabirI18n.t('KURBAN SALONU') : champion ? KabirI18n.t('ŞAMPİYON') : '';
      if (phaseText !== previousPhase) { phase.textContent = phaseText; previousPhase = phaseText; }
      syncStatus(enemy, game);
    }
    return { update, clear };
  }
  B.TargetHUD = Object.freeze({ create, portraits, prepare });
}());
