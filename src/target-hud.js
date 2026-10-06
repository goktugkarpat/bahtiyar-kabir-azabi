/* KABİR AZABI — the attacked enemy's portrait and health. Cached artwork; no live 3D rendering. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
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
    furnaceheart: ['', 'KIZIL OCAK', KabirI18n.t('OCAK BASINCI YÜKSELİYOR'), KabirI18n.t('SON DÖKÜM')],
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
      if (shown) { root.classList.add('hidden'); shown = false; }
      if (previousId !== null) { root.removeAttribute('data-enemy-id'); previousId = null; }
    }
    function update(enemy) {
      if (warmEl) unwarm();
      if (!enemy || enemy.dead || !Number.isFinite(enemy.hp) || !Number.isFinite(enemy.maxHp) || !(enemy.maxHp > 0) || !(enemy.hp > 0)) { clear(); return; }
      if (!shown) { root.classList.remove('hidden'); shown = true; }
      if (previousId !== enemy.id) { root.setAttribute('data-enemy-id', enemy.id); previousId = enemy.id; }
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
      if (scale !== previousScale) { fill.style.transform = scale; previousScale = scale; }
      const boss = !!enemy.boss, phase2 = boss && enemy.phase >= 2;
      if (boss !== wasBoss) { root.classList.toggle('boss-target', boss); wasBoss = boss; }
      if (phase2 !== wasPhase2) { root.classList.toggle('phase2', phase2); wasPhase2 = phase2; }
      const phases = bossPhases[enemy.type];
      const phaseText = phases ? phases[enemy.phase] || '' : boss ? phase2 ? KabirI18n.t('ZİNCİRLER KIRILDI') : 'KURBAN SALONU' : '';
      if (phaseText !== previousPhase) { phase.textContent = phaseText; previousPhase = phaseText; }
    }
    return { update, clear };
  }
  B.TargetHUD = Object.freeze({ create, portraits, prepare });
}());
