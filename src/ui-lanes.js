/* KABİR AZABI — ajan:ui. Ortak bildirim yerleşimi + küçük menü cilası.
   1. Üst-orta "sahne yazıları" tek kuyrukta: boss giriş kartı (boss-framework) > seviye atlama afişi (levelup.js) > bölge duyurusu (#announcement)
      > sinema altyazısı (quest-cinema letterbox). Altyazı, üstündekilerden biri ekrandayken bekler (en çok 6 sn oyun içi), sonra açılır;
      böylece "BÖLÜM I / KURBAN TAPINAĞI" ile bölüm giriş metni üst üste binmez. Menüler (mola/ayarlar/ölüm/zafer) açıkken
      sinema bantları, boss kartı ve seviye afişi gizlenir (ui-gothic.css, body[data-view]).
   2. Başlık ekranı: logonun altına öteki dildeki adı (CSS), sürüm satırı, düğme üstüne gelince kısa demir tık sesi.
   Kare başına iş yok: yalnız bekleyen altyazı varken 250 ms'de bir bakılır. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const T = s => (window.KabirI18n ? KabirI18n.t(s) : s);
  const $ = id => document.getElementById(id);

  /* ---------- 1. sahne yazısı kuyruğu ---------- */
  function busy() {
    const b = document.body;
    if (b.dataset.view && b.dataset.view !== 'playing') return 'menu';
    if (b.classList.contains('bf-intro')) return 'boss';
    const lu = $('lu-banner'); if (lu && lu.classList.contains('lu-on')) return 'level';
    const an = $('announcement'); if (an && an.classList.contains('show')) return 'announce';
    return '';
  }
  let queue = [], timer = 0, waited = 0;
  function pump(orig) {
    clearTimeout(timer); timer = 0;
    if (!queue.length) return;
    const why = busy();
    // Menü açıkken saat işlemez; oyun içinde en çok 6 sn bekle, sonra yine de göster (metin kaybolmasın).
    if (why && (why === 'menu' || waited < 6)) { if (why !== 'menu') waited += .25; timer = setTimeout(() => pump(orig), 250); return; }
    waited = 0;
    const o = queue.shift(); queue = [];   // yalnız en son altyazı önemli
    orig(o);
  }
  function wrapCinema() {
    const C = B.QuestCinema; if (!C || C.__uiLanes) return !!C;
    const orig = C.letterbox.bind(C);
    C.letterbox = o => { queue = [o]; waited = 0; pump(orig); };
    C.__uiLanes = true;
    return true;
  }
  if (!wrapCinema()) window.addEventListener('load', wrapCinema, { once: true });

  /* ---------- 2. başlık ekranı ---------- */
  function decorateTitle() {
    const title = $('title'); if (!title) return;
    const logo = title.querySelector('.logo-wrap');
    if (logo && !title.querySelector('.ui-logo-sub')) {
      const sub = document.createElement('span'); sub.className = 'ui-logo-sub'; sub.setAttribute('aria-hidden', 'true');
      logo.insertAdjacentElement('afterend', sub);
    }
    title.querySelectorAll('.title-actions .btn').forEach(b => { if (!b.querySelector('.ui-sheen')) { const i = document.createElement('i'); i.className = 'ui-sheen'; i.setAttribute('aria-hidden', 'true'); b.prepend(i); } });
    const meta = title.querySelector('.title-meta');
    if (meta && !meta.querySelector('.ui-build')) {
      const s = Array.from(document.scripts).map(x => /app\.js\?v=(\d+)/.exec(x.src)).find(Boolean);
      const v = document.createElement('span'); v.className = 'ui-build'; v.dataset.build = s ? s[1] : '';
      const paint = () => { v.textContent = T('Sürüm') + ' 0.' + (v.dataset.build || '1') + ' · ' + T('Bir yeraltı ağıtı'); };
      paint(); meta.appendChild(v);
      new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
  }
  // Fareyle bir menü düğmesinin üstüne gelince çok kısık demir tık (ses kapalıysa/?sessiz'de Audio zaten susar).
  let lastHover = null, lastHoverAt = 0;
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const btn = e.target.closest && e.target.closest('#title .btn, .screen .btn, .screen .text-button');
    if (!btn || btn === lastHover || btn.disabled) { if (!btn) lastHover = null; return; }
    lastHover = btn; const t = performance.now(); if (t - lastHoverAt < 70) return; lastHoverAt = t;
    try { if (B.Audio && B.Audio.play) B.Audio.play('ui', { volume: .14 }); } catch (_) {}
  }, { passive: true });

  /* ---------- 3. yükleme perdesi: bölüme özel renk + dönen ipuçları/alıntılar (yalnız perde açıkken) ---------- */
  const TIPS = [
    'Kızıl kenarlı darbeyi karşılama; yuvarlanarak kaç.',
    'Yemin taşları iksirlerini doldurur ve öldüğünde seni geri çağırır.',
    'Altın çerçeveli düşmanlar şampiyondur; özelliklerini adlarından oku.',
    'Yetenek puanlarını T ile harca; bir yolun üst aşaması yuvadaki gücün yerine geçer.',
    'Harita (M) sisini yalnız yürüdüğün yerlerden kaldırır.',
    '“Her nefis ölümü tadacaktır.”'
  ];
  function decorateLoading() {
    const box = $('loading'); if (!box || box.classList.contains('hidden')) return;
    let ch = 1;
    try { const c = JSON.parse(localStorage.getItem('baba.kabir.campaign.v1') || 'null'); if (c && c.chapter) ch = c.chapter | 0; } catch (_) {}
    if (/[?&]yolculuk=yeni/.test(location.search)) ch = 1;
    box.dataset.chapter = String(Math.max(1, Math.min(5, ch)));
    const art = box.querySelector('.load-art'), mark = art && art.querySelector('.wordmark');
    if (mark && !art.querySelector('.ui-logo-sub')) { const s = document.createElement('span'); s.className = 'ui-logo-sub'; s.setAttribute('aria-hidden', 'true'); mark.insertAdjacentElement('afterend', s); }
    const tip = box.querySelector('.load-tip'); if (!tip) return;
    let i = Math.floor(Math.random() * TIPS.length);
    const show = () => {
      if (box.classList.contains('hidden')) { clearInterval(id); return; }
      i = (i + 1) % TIPS.length;
      const quote = TIPS[i].charAt(0) === '“';
      tip.classList.remove('ui-tip-in'); void tip.offsetWidth;
      tip.innerHTML = '<b></b>'; tip.firstChild.textContent = quote ? T('Söz') : T('İpucu'); tip.append(T(TIPS[i])); tip.classList.toggle('ui-quote', quote);
      tip.classList.add('ui-tip-in');
    };
    const id = setInterval(show, 5200);
  }

  // Kontroller (H) paneli, karakter/ayarlar/günlük ile aynı oymalı odaya oturur: başlık dışındaki her şey tek kaydırma alanına alınır.
  function frameControls() {
    const panel = document.querySelector('#controls .controls-panel'); if (!panel || panel.querySelector('.ui-scroll')) return;
    const box = document.createElement('div'); box.className = 'ui-scroll';
    Array.from(panel.children).forEach(c => { if (!c.classList.contains('panel-head')) box.appendChild(c); });
    panel.appendChild(box); panel.classList.add('ui-chamber');
  }

  function decorate() { decorateTitle(); frameControls(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorate, { once: true }); else decorate();
  decorateLoading();
  /* ---------- 4. ölüm anı: ağır çekim + kırmızı vinyet (ölüm kartı açılmadan önceki ~0.75 sn) ---------- */
  let dyingAt = -1, dyingTimer = 0;
  function dying() {
    dyingAt = performance.now(); document.body.classList.add('ui-dying');
    clearTimeout(dyingTimer); dyingTimer = setTimeout(() => document.body.classList.remove('ui-dying'), 2400);
  }
  // ölüm kartı (ya da başka bir ekran) açılınca vinyet bırakılır; kartın kendi kırmızı perdesi devralır
  new MutationObserver(() => { if (document.body.dataset.view !== 'playing') document.body.classList.remove('ui-dying'); })
    .observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  // app.js benzetim dt'sini bununla çarpar: ilk 0.9 sn 0.3x, sonra 0.3 sn'de normale döner.
  function timeScale() {
    if (dyingAt < 0) return 1;
    const t = (performance.now() - dyingAt) / 1000;
    if (t > 1.2) { dyingAt = -1; return 1; }
    return t < .9 ? .3 : .3 + .7 * (t - .9) / .3;
  }
  B.UILanes = { busy, pending: () => queue.length, dying, timeScale };
})();
