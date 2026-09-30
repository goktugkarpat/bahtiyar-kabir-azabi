/* KABİR AZABI — the attacked enemy's portrait and health. Cached artwork; no live 3D rendering. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const portraits = Object.freeze({
    prisoner: 'assets/ui/target-prisoner.webp', guard: 'assets/ui/target-guard.webp',
    cultist: 'assets/ui/target-cultist.webp', stalker: 'assets/ui/target-stalker.webp',
    carrier: 'assets/ui/target-carrier.webp', boss: 'assets/ui/target-boss.webp'
  });
  // Keep the small portrait images ready before the loading cover is removed.
  // Failed artwork does not prevent the player or health bar from appearing.
  const preparedImages = new Map(), failedImages = new Set();
  let prepared = null;
  function prepare() {
    if (prepared) return prepared;
    prepared = Promise.all(Object.keys(portraits).map(type => {
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
    })).then(() => {});
    return prepared;
  }
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
      if (!enemy || enemy.dead || !Number.isFinite(enemy.hp) || !Number.isFinite(enemy.maxHp) || !(enemy.maxHp > 0) || !(enemy.hp > 0)) { clear(); return; }
      if (!shown) { root.classList.remove('hidden'); shown = true; }
      if (previousId !== enemy.id) { root.setAttribute('data-enemy-id', enemy.id); previousId = enemy.id; }
      const type = Object.prototype.hasOwnProperty.call(portraits, enemy.type) ? enemy.type : 'prisoner';
      if (previousType !== type || previousArt && failedImages.has(previousArt)) { previousType = type; setPortrait(type); }
      const label = enemy.name || 'Düşman';
      if (label !== previousName) { name.textContent = label; previousName = label; }
      const max = Math.max(1, Math.round(enemy.maxHp)), hp = Math.min(max, Math.ceil(Math.max(0, enemy.hp)));
      const text = hp + ' / ' + max;
      if (text !== previousHealth) { count.textContent = text; previousHealth = text; }
      if (max !== previousMax) { health.setAttribute('aria-valuemax', max); previousMax = max; }
      if (hp !== previousHp) { health.setAttribute('aria-valuenow', hp); previousHp = hp; }
      const scale = 'scaleX(' + Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) + ')';
      if (scale !== previousScale) { fill.style.transform = scale; previousScale = scale; }
      const boss = !!enemy.boss, phase2 = boss && enemy.phase === 2;
      if (boss !== wasBoss) { root.classList.toggle('boss-target', boss); wasBoss = boss; }
      if (phase2 !== wasPhase2) { root.classList.toggle('phase2', phase2); wasPhase2 = phase2; }
      const phaseText = boss ? phase2 ? 'ZİNCİRLER KIRILDI' : 'KURBAN SALONU' : '';
      if (phaseText !== previousPhase) { phase.textContent = phaseText; previousPhase = phaseText; }
    }
    return { update, clear };
  }
  B.TargetHUD = Object.freeze({ create, portraits, prepare });
}());
