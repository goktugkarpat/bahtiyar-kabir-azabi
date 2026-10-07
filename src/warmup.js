/* KABİR AZABI — warm-up of everything that would otherwise be drawn or painted for the FIRST time during play.
   Compiling a program is not enough: ANGLE/D3D11 (Chrome/Edge on Windows) builds the HLSL executables for the vertex layout, the render target and
   the pass at the first real DRAW, and the browser's own GPU rasteriser compiles a Skia program the first time a new kind of page content
   (gradient, blurred shadow, rounded clip, backdrop filter...) is painted. Chrome runs page painting, compositing and WebGL on ONE GPU thread, so
   each of those first uses froze the game for 10-130 ms (hero skills, the first dodge trail, level-up, blood, the HUD after "play", ...).
   Two parts, both run once under the loading cover (app.js warmShaders):
     paintDom()  clones of the HUD and every screen are painted almost fully transparent (1 %, invisible) in their rich states for a few frames.
     drawAll()   every kind of effect is started with its real data (hero skills, dodge afterimages, telegraph waves, blood, gore, level-up...), then the
                 WHOLE scene (hidden rooms, pooled effect meshes, merged shells, rarely-seen characters) is submitted through the real shadow, main
                 and post passes with everything forced visible, then all state is put back. Nothing is left behind; no light is switched.
   ?nowarmfx / ?nowarmdom switch the parts off for A/B timing. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const Q = new URLSearchParams(location.search);
  const safe = fn => { try { return fn(); } catch (e) { if (Q.has('warmlog')) console.warn('[warmup]', e); return undefined; } };
  const frame = () => new Promise(res => { let done = false; const go = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(go); setTimeout(go, 120); });
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const stats = { dom: 0, fx: 0, programs: 0, objects: 0, frames: 0 };
  let fxStarted = false;

  /* ───────────── page content (Skia raster + compositor programs) ───────────── */
  function toastStates(box) {
    for (const kind of ['rage', 'seal', 'rarity-rare', 'rarity-epic', 'rarity-boss']) {
      const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = KabirI18n.t('Kara Kıyı 0123456789'); box.appendChild(d);
    }
  }
  function warningStates(box) {
    for (const [cls, x, y] of [['', 120, 200], [' unblockable', 300, 200], [' unblockable late', 480, 200]]) {
      const el = document.createElement('div'); el.className = 'direction-warning' + cls; el.style.left = x + 'px'; el.style.top = y + 'px';
      const lab = document.createElement('span'); lab.className = 'dw-label'; const tag = document.createElement('b'); tag.textContent = cls ? KabirI18n.t('KAÇIN') : KabirI18n.t('DİKKAT'); lab.append(tag, KabirI18n.t('Tehlike'));
      el.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 37 34H3Z"/><path d="M20 14v10M20 29v.5"/></svg>'; el.append(lab); box.appendChild(el);
    }
  }
  function buffStates(box) {
    ['light', 'heavy', 'dodge', 'rage', 'flask', 'special'].forEach((icon, i) => {
      const n = document.createElement('div'); n.className = 'timed-buff' + (i % 2 ? ' expiring' : ''); n.setAttribute('role', 'listitem');
      const ic = document.createElement('i'); ic.className = 'skill ' + icon; const s = document.createElement('b'); s.className = 'buff-seconds'; s.textContent = String(i + 2);
      n.append(ic, s); box.appendChild(n);
    });
  }
  function richState(root) {
    const text = (el, v) => { if (el) el.textContent = v; };
    const lv = root.querySelector('#level-up');
    if (lv) { lv.classList.add('show'); text(lv.querySelector('small'), KabirI18n.t('SEVİYE ATLADIN')); text(lv.querySelector('strong'), KabirI18n.t('SEVİYE 12')); text(lv.querySelector('span'), '+1 YETENEK PUANI · T'); }
    const lub = root.querySelector('#lu-banner'); if (lub && B.LevelUp && B.LevelUp.paintState) B.LevelUp.paintState(lub);   // level-up banner (src/levelup.js) in its full state
    const an = root.querySelector('#announcement');
    if (an) { an.classList.add('show'); text(an.querySelector('small'), 'KARA KIYI'); text(an.querySelector('strong'), KabirI18n.t('Boğulmuş Çanlık')); }
    const nar = root.querySelector('#narration p'); text(nar, KabirI18n.t('Anlatıcı konuşuyor, sesi sulara karışıyor.'));
    if (B.app && B.app.questUI) B.app.questUI.warm(root);
    const toasts = root.querySelector('#toasts'); if (toasts) toastStates(toasts);
    if (B.GroundLoot && B.GroundLoot.warmLabels) B.GroundLoot.warmLabels(root.querySelector('#loot-labels'));   // item name labels (ground-loot.js)
    const warns = root.querySelector('#warnings'); if (warns) warningStates(warns);
    const buffs = root.querySelector('#timed-effects'); if (buffs) buffStates(buffs);
    // State looks the game toggles later (CSS filters / drop-shadows / conic sweeps appear only then): show them all once.
    const addAll = (el, list) => { if (el) for (const c of list) el.classList.add(c); };
    addAll(root.querySelector('.health-orb'), ['low', 'healed']); addAll(root.querySelector('.stamina-orb'), ['winded']); addAll(root.querySelector('.hero-card'), ['sealed']);
    const combos = [['pressed', 'queued'], ['unavailable', 'short'], ['cooling', 'short'], ['ready', 'waiting'], ['burning', 'locked'], ['pressed', 'cooling', 'ready-flash'], ['unavailable', 'cooling', 'empty']];
    root.querySelectorAll('.action').forEach((a, i) => { addAll(a, combos[i % combos.length]); a.style.setProperty('--progress', '.4'); });
    // Elements the HUD code only creates on demand (hud.js: skill hint, parry callout) with their real ids so the same CSS applies.
    if (!root.querySelector('#skill-feedback')) { const f = document.createElement('div'); f.id = 'skill-feedback'; f.textContent = KabirI18n.t('Dayanıklılık yetmiyor · kaçınma bitince'); root.appendChild(f); }
    if (!root.querySelector('#callout')) { const k = document.createElement('div'); k.id = 'callout'; k.textContent = KabirI18n.t('Savuşturdun'); k.style.cssText = 'animation:none;opacity:1'; k.className = 'show'; root.appendChild(k); }
    const tgt = root.querySelector('#target-hud'); if (tgt) { tgt.classList.remove('hidden'); tgt.classList.add('boss-target'); const bm=tgt.querySelector('#boss-mechanic'); if(bm){bm.className='timed';bm.dataset.kind='strike';text(bm.querySelector('strong'),KabirI18n.t('Yemin Çapaları'));text(bm.querySelector('span'),KabirI18n.t('Yanan çapaları vur veya yanında bekleyerek söndür.'));const p=bm.querySelector('i');if(p)p.style.transform='scaleX(.65)';} text(tgt.querySelector('.target-name'), KabirI18n.t('Zincir Celladı')); text(tgt.querySelector('.target-count'), '1234 / 5678'); const f = tgt.querySelector('.target-fill'); if (f) f.style.transform = 'scaleX(.6)'; }
  }
  /* The clones above are still pictures. The real fight changes the same page content WHILE it animates (the attack sweep running round a slot, the
     slot "press" pop, the enemy bar filling, the title fading, toasts sliding in and out) on the live elements, and every one of those first frames
     drew with a drawing program (Skia/HLSL) that no still picture had made yet: 60-300 ms each, six or seven of them in the first second of the
     first fight. Run the same movements on the live HUD (it is un-hidden at 1.2 %, see liveHudPaint) and put everything back exactly. */
  async function rehearse() {
    const $ = id => document.getElementById(id);
    const hud = $('hud'); if (!hud || hud.classList.contains('hidden')) return 0;
    const t0 = performance.now(), undo = [], made = [], attrs = [];
    const keep = (el, text) => { if (el) undo.push([el, el.getAttribute('class'), el.getAttribute('style'), text ? el.textContent : null, el.tagName === 'IMG' ? el.getAttribute('src') : undefined]); return el; };
    const run = async (ms, fn) => { const t = performance.now(); for (let k = 0; ; k++) { const e = performance.now() - t; if (e >= ms) break; fn(e / ms, k); await frame(); } fn(1, -1); };
    const body = document.body, had = ['in-combat', 'raging', 'low-hp'].filter(c => body.classList.contains(c));
    const slots = ['special', 'rage', 'dodge', 'light', 'heavy', 'heal', 'fourth'].map(k => document.querySelector(k === 'heal' ? '.flask-button' : '.action-' + k)).filter(Boolean);
    for (const s of slots) { keep(s); const b = s.querySelector('.cd b'); if (b) keep(b, true); }
    const SL = (cl, on) => slots.forEach(s => s.classList.toggle(cl, on));
    const bar = async () => {
      for (let rep = 0; rep < 2; rep++) {                                 // attack sweep running 0 -> 1 with the press pop (a real light/heavy hit)
        SL('tap', true); SL('pressed', true);
        await run(250, p => slots.forEach(s => s.style.setProperty('--progress', p)));
        SL('tap', false); SL('pressed', false); slots.forEach(s => s.style.setProperty('--progress', 0)); await frame();
      }
      // Every look a slot can have (stamina short / unavailable / cooling) under every movement (pressed sweep, press pop, shake, queued outline):
      // a filter chain of two matrices drawn while the pop scales it is its own drawing program. Slots take different combinations side by side.
      const BASE = [[], ['short'], ['unavailable', 'short'], ['cooling'], ['cooling', 'short']], OVER = [[], ['pressed'], ['tap'], ['pressed', 'tap'], ['tap', 'lack'], ['pressed', 'queued']];
      const ALL = ['short', 'unavailable', 'cooling', 'pressed', 'tap', 'lack', 'queued'], combos = [];
      for (const b of BASE) for (const o of OVER) combos.push(b.concat(o));
      for (let r = 0; r < 6; r++) {
        slots.forEach((s, i) => {
          const set = combos[(r * slots.length + i) % combos.length], cd = s.querySelector('.cd b');
          for (const c of ALL) s.classList.toggle(c, set.includes(c));
          s.style.setProperty('--progress', set.includes('pressed') ? (.15 + .13 * r).toFixed(2) : 0); s.style.setProperty('--cd', set.includes('cooling') ? (.9 - .12 * r).toFixed(2) : 0);
          if (cd) cd.textContent = set.includes('cooling') ? (3.4 - .5 * r).toFixed(1) : '';
        });
        await wait(140);
      }
      ALL.forEach(c => SL(c, false)); slots.forEach(s => s.style.setProperty('--progress', 0)); await wait(180);
      SL('ready-flash', true); await wait(220); SL('ready-flash', false);
      const rage = slots[1];
      if (rage) { rage.classList.add('ready'); await wait(250); rage.classList.add('burning'); rage.classList.remove('ready'); await wait(150); rage.classList.remove('burning'); }
      SL('locked', true); SL('empty', true); await wait(120); SL('locked', false); SL('empty', false);
    };
    const target = async () => {
      const root = $('target-hud'), TH = B.TargetHUD; if (!root || !TH || !TH.portraits) return;
      const img = root.querySelector('img'), nm = root.querySelector('.target-name'), ct = root.querySelector('.target-count'), ph = root.querySelector('.target-phase'), fill = root.querySelector('.target-fill');
      keep(root); keep(img); keep(nm, true); keep(ct, true); keep(ph, true); keep(fill);
      root.classList.remove('hidden');
      let i = 0;
      for (const type of Object.keys(TH.portraits)) {
        const boss = type === 'boss';
        img.hidden = false; img.src = TH.portraits[type]; nm.textContent = KabirI18n.t('Zincir Celladı ') + type; ct.textContent = (1234 - i * 77) + ' / 5678'; ph.textContent = boss ? KabirI18n.t('KURBAN SALONU') : '';
        root.classList.toggle('boss-target', boss); root.classList.toggle('phase2', boss && i % 2 === 0);
        fill.style.transform = 'scaleX(' + (1 - (i % 5) * .17).toFixed(2) + ')';
        i++; await frame(); await frame();
      }
      const bm=$('boss-mechanic');
      if(bm){const title=bm.querySelector('strong'),instruction=bm.querySelector('span'),progress=bm.querySelector('i');
        keep(bm);keep(title,true);keep(instruction,true);keep(progress);attrs.push([bm,'data-kind',bm.getAttribute('data-kind')]);root.classList.add('boss-target');
        for(const kind of ['strike','shelter','move','dodge','adds']){
          bm.className='timed'+(kind==='shelter'?' safe':'');bm.dataset.kind=kind;
          title.textContent=kind==='shelter'?'Sessiz Nova':KabirI18n.t('Yemin Çapaları');instruction.textContent=kind==='shelter'?KabirI18n.t('Siperdesin. Sütun darbeyi yutana kadar bekle.'):KabirI18n.t('Yanan çapaları vur veya yanında bekleyerek söndür.');
          await run(100,p=>{progress.style.transform='scaleX('+(1-p*.8)+')';});
        }
      }
      fill.style.transform = 'scaleX(.33)'; await wait(120); fill.style.transform = 'scaleX(.31)'; await wait(120);
      root.classList.add('hidden');
    };
    const titles = async () => {
      const an = $('announcement'); if (!an) return;
      keep(an); const sm = an.querySelector('small'), st = an.querySelector('strong'); keep(sm, true); keep(st, true);
      sm.textContent = KabirI18n.t('KARŞILAŞMA'); st.textContent = KabirI18n.t('Kurban Salonu');
      for (const kind of ['chapter', 'boss']) { an.className = ''; void an.offsetWidth; an.className = 'show ' + kind; await wait(kind === 'chapter' ? 420 : 300); }
      an.className = ''; await wait(450);                                  // the fade-out the first fight triggers
      const lv = $('level-up'); if (lv) { keep(lv); lv.classList.add('show'); await wait(300); lv.classList.remove('show'); }
    };
    const notices = async () => {
      const box = $('toasts');
      if (box) {
        for (const kind of ['', 'rarity-rare']) { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = kind ? KabirI18n.t('Nadir ganimet · Çelik pala') : KabirI18n.t('Öfke söndü'); box.appendChild(d); made.push(d); }
        await wait(380); for (const d of made) d.classList.add('out'); await wait(300); for (const d of made) d.remove(); made.length = 0;
      }
      const questNotice = $('quest-notice');
      if (questNotice) {
        keep(questNotice); for (const c of questNotice.children) keep(c, true);
        const qs=questNotice.querySelector('small'),qt=questNotice.querySelector('strong'),qp=questNotice.querySelector('p');
        if(qs)qs.textContent=KabirI18n.t('GÖREV TAMAMLANDI');if(qt)qt.textContent=KabirI18n.t('Mezarın susturduğu yemin');if(qp)qp.textContent=KabirI18n.t('Mühür çözüldü. Yolun devamı açıldı.');
        questNotice.classList.add('show');await wait(120);questNotice.classList.add('complete');await wait(120);questNotice.classList.remove('show');await wait(160);
      }
      const fb = $('skill-feedback'), nar = $('narration'), warns = $('warnings'), buffs = $('timed-effects');
      if (fb) { keep(fb, true); fb.textContent = KabirI18n.t('Dayanıklılık yetmiyor · kaçınma bitince'); fb.classList.remove('hidden'); }
      if (nar) { keep(nar); const p = nar.querySelector('p'); keep(p, true); p.textContent = KabirI18n.t('Anlatıcı konuşuyor, sesi sulara karışıyor.'); nar.classList.remove('hidden'); nar.classList.add('tap'); }
      if (warns) for (const c of ['', ' unblockable']) { const el = document.createElement('div'); el.className = 'direction-warning' + c; el.style.left = '40%'; el.style.top = '45%'; el.innerHTML = KabirI18n.t('<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 37 34H3Z"/><path d="M20 14v10M20 29v.5"/></svg><span class="dw-label"><b>DİKKAT</b>Tehlike</span>'); warns.appendChild(el); made.push(el); }
      if (buffs) for (const [ic, ex] of [['rage', false], ['special', true]]) { const n = document.createElement('div'); n.className = 'timed-buff' + (ex ? ' expiring' : ''); const i = document.createElement('i'); i.className = 'skill ' + ic; const b = document.createElement('b'); b.className = 'buff-seconds'; b.textContent = '5'; n.append(i, b); buffs.appendChild(n); made.push(n); }
      safe(() => B.HUD && B.HUD.callout && B.HUD.callout(KabirI18n.t('Savuşturdun')));
      await wait(500);
      for(const [el,key,value] of attrs){if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);}
      for (const el of made) el.remove(); made.length = 0;
    };
    const orbs = async () => {
      const ho = document.querySelector('.health-orb'), so = document.querySelector('.stamina-orb'), hc = document.querySelector('.hero-card');
      keep(ho); keep(so); keep(hc);
      if (ho) { ho.classList.add('tap'); await wait(380); ho.classList.remove('tap'); ho.classList.add('healed', 'low'); body.classList.add('low-hp'); }
      if (so) so.classList.add('winded');
      if (hc) hc.classList.add('sealed');
      body.classList.add('in-combat', 'raging');
      // Numbers that change in a fight (health, stamina, flasks, kills, place, objective): every new digit run is drawn with the blurred text shadows
      // (one blur program per shadow size), which first happened when the health number changed in the fight (70-300 ms).
      const nums = ['health-number', 'health-max', 'stamina-number', 'stamina-max', 'flask-count', 'kill-progress', 'objective', 'location'].map($).filter(Boolean);
      for (const el of nums) keep(el, true);
      for (const v of ['62', '100', '38', '7', '91', '15']) {
        nums.forEach((el, i) => { el.textContent = i === 6 ? KabirI18n.t('Celladı bul.\nGeçidi aç. ') + v : i === 5 ? v + ' / 31' : i === 7 ? KabirI18n.t('Kurban Salonu ') + v : i % 2 ? '/ ' + (+v + 40) : v; });
        await wait(110);
      }
    };
    try { await Promise.all([bar(), target(), titles(), notices(), orbs()].map(p => p.catch(() => {}))); }
    finally {
      for (const [el, cl, st, tx, src] of undo.reverse()) {
        if (cl === null) el.removeAttribute('class'); else el.setAttribute('class', cl);
        if (st === null) el.removeAttribute('style'); else el.setAttribute('style', st);
        if (tx !== null) el.textContent = tx;
        if (src !== undefined) { if (src === null) el.removeAttribute('src'); else el.setAttribute('src', src); }
      }
      for(const [el,key,value] of attrs){if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);}
      for (const el of made) el.remove();
      for (const c of ['in-combat', 'raging', 'low-hp']) if (!had.includes(c)) body.classList.remove(c);
    }
    await frame(); await frame();
    return Math.round(performance.now() - t0);
  }
  // live(true/false): app.js shows its real HUD (canvases, orbs, minimap) at 1 % while the clones are painted, and puts it back.
  async function paintDom(live) {
    if (Q.has('nowarmdom') || !document.body) return 0;
    const t0 = performance.now();
    if (B.SkillArt) await B.SkillArt.prepare();
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true'); wrap.inert = true;
    wrap.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:149;opacity:.012;pointer-events:none;overflow:hidden;contain:layout paint';
    if (live) safe(() => live(true));
    const skip = /^(loading|game|fatal|warming|fps)$/;
    for (const el of Array.from(document.body.children)) {
      if (!(el instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK|CANVAS|NOSCRIPT)$/.test(el.tagName) || skip.test(el.id)) continue;
      const c = el.cloneNode(true);
      if (c.classList.contains('hidden')) c.classList.remove('hidden');
      c.querySelectorAll('.hidden').forEach(e => e.classList.remove('hidden'));
      c.querySelectorAll('[style*="visibility"]').forEach(e => { e.style.visibility = ''; });
      if (c.id === 'hud') { c.style.opacity = ''; c.style.zIndex = ''; safe(() => richState(c)); }
      wrap.appendChild(c);
    }
    // All artwork and the exact slot state paints are submitted before play, including future tiers.
    if (B.SkillArt) {
      const tray=document.createElement('div');tray.style.cssText='position:absolute;inset:0;display:flex;flex-wrap:wrap;align-content:flex-start';
      for(const id of B.SkillArt.ids)for(const state of ['', 'cooling', 'locked', 'pressed']) {
        const slot=document.createElement('div');slot.className='action '+state;slot.style.cssText='position:relative;width:64px;height:64px;--cd:.5;--progress:.45';
        const icon=document.createElement('i');icon.className='skill';icon.style.cssText='position:absolute;inset:0;width:100%;height:100%;background-size:100% 100%;background-image:url("'+B.SkillArt.url(id)+'")';
        slot.appendChild(icon);tray.appendChild(slot);
      }
      wrap.appendChild(tray);
    }
    const body = document.body, had = ['in-combat', 'raging', 'low-hp'].filter(c => body.classList.contains(c));
    body.classList.add('in-combat', 'raging', 'low-hp');       // the fighting look of the HUD (CSS keyed on body classes)
    body.appendChild(wrap);
    try { for (let i = 0; i < 4; i++) await frame(); await wait(260); await frame(); if (live && !Q.has('nowarmlive')) { safe(() => live('sprites')); await frame(); await frame(); safe(() => live('map')); stats.rehearse = await rehearse(); } }
    finally { wrap.remove(); for (const c of ['in-combat', 'raging', 'low-hp']) if (!had.includes(c)) body.classList.remove(c); if (live) safe(() => live(false)); }
    return stats.dom = Math.round(performance.now() - t0);
  }

  /* ───────────── WebGL: every effect kind, then every object, through the real passes ───────────── */
  const SKILLS = ['quake', 'cleave', 'reap', 'charge', 'temper', 'chainstorm', 'rend', 'brand', 'grasp', 'level', 'roar', 'whirl', 'havoc'];
  function effectList(x, z, face) {
    const at = { x, z, face }, list = [];
    for (const skill of SKILLS) {
      list.push(['heroSkill', { ...at, skill, phase: 'gather', y: .1, radius: 3.4, length: 5, width: 1.8, duration: .5 }]);
      list.push(['heroSkill', { ...at, skill, phase: 'release', y: .1, radius: 3.4, length: 9, width: 2.8, arc: 2.4, inner: 1, pulse: 2, duration: .45 }]);
    }
    // Skill tiers (round 6): every tier-specific accent runs once so no first use compiles anything.
    list.push(['warCry', { ...at, radius: 9.5, far: 14, tier: 3 }], ['warCryWave', { ...at, radius: 7, n: 1, tier: 3 }], ['warCryWave', { ...at, radius: 8, n: 2, tier: 3 }]);
    list.push(['whirlStart', { ...at, radius: 4.8, tier: 2, grow: 1 }], ['whirlTick', { ...at, radius: 4.8, last: false, n: 2, tier: 2 }], ['whirlTick', { ...at, radius: 5, last: false, n: 2, tier: 3 }], ['whirlHit', { ...at, last: false, tier: 2 }]);
    list.push(['whirlStart', { ...at, radius: 6.2, grow: .68, tier: 3 }], ['whirlTick', { ...at, radius: 6.2, last: true, tier: 3 }], ['whirlTick', { ...at, radius: 4.3, last: true, tier: 2 }], ['whirlHit', { ...at, last: true, tier: 3 }]);
    for (const tier of [2, 3]) list.push(['skillAccent', { ...at, line: 'cleave', tier, skill: tier === 2 ? 'brand' : 'temper', radius: tier === 2 ? 3.2 : 7, arc: 2.5 }]);
    list.push(['strike', { ...at, style: 'quake', shape: 'circle', radius: 3, scar: true, unblockable: true }]);
    list.push(['strike', { ...at, style: 'blade', shape: 'arc', radius: 3, arc: 1.6, scar: true }]);
    if(B.ActiveChapter===2)list.push(
      ['strike',{...at,style:'root',shape:'line',face,length:6,width:.95}],
      ['strike',{...at,style:'root',shape:'ring',inner:1,radius:2.5}],
      ['strike',{...at,style:'tide',shape:'line',face,length:6,width:.85,ownerType:'lantern'}],
      ['strike',{...at,style:'tide',shape:'ring',inner:2,radius:4}]);
    list.push(['glowBurst', { ...at, y: .05, radius: 2.6, color: 0xff2418, duration: .6 }]);
    list.push(['warCryGather', { ...at, life: .5 }], ['warCry', { ...at, radius: 5 }]);
    list.push(['whirlStart', { ...at, radius: 3.6 }], ['whirlTick', { ...at, radius: 3.6, last: false }], ['whirlTick', { ...at, radius: 3.6, last: true }], ['whirlHit', { ...at, last: true }]);
    list.push(['skillFxDemo', { ...at, face }]);   // src/skill-fx.js: strike / shout tiers II-III (fissure + ring + pillar shaders, skull wisps, their particles)
    list.push(['chargeFx', { ...at, tier: 1 }], ['chargeFx', { ...at, tier: 2 }], ['chargeFx', { ...at, tier: 3 }]);   // src/charge.js: trail ribbon + impact quad + their particles
    list.push(['rageEnd', at], ['footstep', { ...at, heavy: true }], ['footstep', at]);
    list.push(['bloodSpray', { ...at, y: 1, strength: 1 }], ['goreBurst', { ...at, y: 1, strength: 1 }], ['stumpSpurt', { ...at, y: 1, strength: 1 }]);
    list.push(['dodge', at], ['evade', at], ['parry', { ...at, y: 1.2 }]);
    list.push(['blood', { ...at, y: 1.2, damage: 123, heavy: true, kill: true, rage: true, spray: face }], ['blood', { ...at, y: 1.2, damage: 40, player: true }], ['blood', { ...at, y: 1.2, boss: true, damage: 300, critical: true }]);
    list.push(['death', { ...at, y: 1.2, heavy: true }], ['death', { ...at, y: 1.2, boss: true }]);
    list.push(['spark', { ...at, y: 1.2 }], ['spark', { ...at, y: 1.2, block: true }], ['spark', { ...at, y: 1.2, glance: true }], ['poison', { ...at, y: 1 }]);
    list.push(['bossPhase', { ...at, radius: 4.5 }], ['slam', { ...at, radius: 4.5 }], ['slam', { ...at, radius: 2, small: true }], ['impact', at]);
    // Round 7 boss set pieces (src/boss2.js): every kind once, so their pooled particles / waves are touched under the cover.
    list.push(['boss2Orb', { ...at, y: 1, kind: 'arc' }], ['boss2Orb', { ...at, y: 1, kind: 'slag', end: true }], ['boss2Shards', { ...at, length: 6, width: 1.4 }], ['boss2Shatter', at], ['boss2Echo', at],
      ['boss2Burrow', { ...at, emerge: true }], ['boss2Geyser', { ...at, length: 5, width: 1.5 }], ['boss2Summon', at], ['boss2Nova', { ...at, phase: 'release' }], ['boss2Nova', { ...at, phase: 'charge' }], ['boss2Overheat', at], ['boss2Frenzy', at]);
    for (const kind of ['ember', 'brine']) for (const phase of ['spawn', 'trail', 'pop', 'blast']) list.push(['boss1Orb', { ...at, y: 1.2, kind, phase, radius: 3.2 }]);   // round 7 boss orbs / anchors / toll (boss-mech.js)
    for (const phase of ['hit', 'break', 'broken']) list.push(['boss1Anchor', { ...at, y: 1.2, phase }]);
    list.push(['boss1Toll', { ...at, radius: 5 }]);
    return list;
  }
  function showAll(scene, keepCulling) {
    const rec = [];
    scene.traverse(o => {
      if (o === scene || o.isLight || o.isCamera) return;
      let dr = null;
      const g = o.geometry;
      if (g && g.drawRange && g.drawRange.count === 0 && g.attributes && g.attributes.position && (o.isMesh || o.isPoints || o.isLine)) {
        const n = g.index ? g.index.count : g.attributes.position.count;
        if (n >= 1) { dr = [g, g.drawRange.start, g.drawRange.count]; g.setDrawRange(0, Math.min(n, o.isPoints ? 1 : 3)); }
      }
      rec.push(o, o.visible, o.frustumCulled, o.isInstancedMesh ? o.count : -1, dr);
      o.visible = true; if (!keepCulling) o.frustumCulled = false;
      if (o.isInstancedMesh && o.count === 0) o.count = 1;
    });
    return rec;
  }
  function restoreAll(rec) {
    for (let i = rec.length - 5; i >= 0; i -= 5) {
      const o = rec[i]; o.visible = rec[i + 1]; o.frustumCulled = rec[i + 2]; if (rec[i + 3] >= 0) o.count = rec[i + 3];
      const dr = rec[i + 4]; if (dr) dr[0].setDrawRange(dr[1], dr[2]);
    }
  }
  // c: { scene, camera, renderer, post, feedback, game, step(), epoch() }
  async function drawAll(c) {
    if (Q.has('nowarmfx') || !c || !c.scene || !c.post) return 0;
    const t0 = performance.now(), programs0 = c.renderer.info.programs.length;
    const { scene, post, feedback, game, renderer } = c;
    const p = game && game.player, x = p ? p.x : 0, z = p ? p.z : 0, face = p ? p.face || 0 : 0;
    const first = !fxStarted;      // effect kinds are started once; later calls (quality change) only redraw the scene
    fxStarted = true;
    const shadowLights = []; scene.traverse(o => { if (o.isLight && o.castShadow && o.shadow) shadowLights.push(o); });
    const step = dt => { safe(() => { if (feedback) feedback.update(dt); }); };
    const renderOnce = () => {
      safe(() => c.step && c.step());
      for (const l of shadowLights) l.shadow.needsUpdate = true;
      safe(() => post.setAbilityFx && post.setAbilityFx({ spin: .6, spinAt: { x, z }, chroma: .4, flash: .3, sat: .3, vig: .3, freeze: .3, ring: { x, z, r: 3, w: .6, t: .3 } }));
      renderer.info.reset();
      let rec = null;
      safe(() => game.beginRenderTraversal && game.beginRenderTraversal());
      try { rec = showAll(scene); post.render(c.elapsed ? c.elapsed() : 0); stats.frames++; }
      finally { if (rec) restoreAll(rec); safe(() => game.endRenderTraversal && game.endRenderTraversal()); }
      if (rec) stats.objects = Math.max(stats.objects, rec.length / 5);
    };
    if (first && feedback) {
      for (const [name, data] of effectList(x, z, face)) safe(() => feedback.burst(name, data));
      step(1 / 60);
    }
    for (let i = 0; i < 4; i++) {
      safe(renderOnce);
      if (first) step(i === 0 ? .12 : .3);
      await frame();
    }
    if (first && feedback) { safe(() => feedback.clear()); safe(() => feedback.update(0)); }
    stats.programs = renderer.info.programs.length - programs0;
    return stats.fx = Math.round(performance.now() - t0);
  }

  /* ───────────── every room's lighting state ─────────────
     A program's key contains the light/shadow state it was built for. The pooled lights of each room differ, so walking into a room for the first time
     rebuilt every lit program of the scene on the spot (seconds, in the later chapters). Stand the hero in each room under the cover and compile the
     whole scene for that room's state (in parallel where the browser can), then put him back.
     c: { scene, camera, renderer, game, world, snap(), progress(k) } */
  async function roomTour(c) {
    if (Q.has('nowarmrooms') || !c || !c.world || !Array.isArray(c.world.rooms) || !c.game || !c.game.player) return 0;
    const t0 = performance.now(), { scene, camera, renderer, game, world } = c, p = game.player, ox = p.x, oz = p.z;
    const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
    const raster = !!c.rasterWarmup && !!c.post;
    const oldPosition = camera.position.clone(), oldQuaternion = camera.quaternion.clone();
    let created = 0;
    // Compile the whole scene for the light state it is in right now and wait for the new programs.
    const compileNow = async () => {
      const before = renderer.info.programs.length;
      safe(() => { const rt = renderer.getRenderTarget(); if (c.target) renderer.setRenderTarget(c.target); try { renderer.compile(scene, camera); } finally { renderer.setRenderTarget(rt); } });
      const fresh = renderer.info.programs.slice(before); created += fresh.length;
      const limit = performance.now() + 25000;
      let pending = fresh;
      while (pending.length && performance.now() < limit) {
        if (parallel) { pending = pending.filter(q => !q.isReady()); if (pending.length) await wait(16); }
        else { const q = pending.shift(); safe(() => q.getUniforms()); await wait(0); }
      }
      if (fresh.length) await frame();
    };
    // Chapter worlds switch pooled point lights on and off (visible = false), and a program is built for the NUMBER of visible lights: 1, 2 or 3
    // visible lights are three different program sets. Remember which counts the tour met, then build the missing ones.
    const points = []; scene.traverse(o => { if (o.isPointLight) points.push(o); });
    const flags = points.map(l => l.visible), seenCounts = new Set(); let toggled = false;
    const note = () => { let n = 0; for (const l of points) if (l.visible) n++; seenCounts.add(n); if (n !== points.length) toggled = true; };
    try {
      note();
      const rooms = world.rooms;
      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i]; if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.z)) continue;
        p.x = r.x; p.z = r.z + (r.d || 0) * .25;
        safe(() => c.snap());
        note();
        await compileNow();
        if (raster) {
          // Compilation and off-camera submissions do not exercise the actual
          // fragment executables. Draw each room from the playing camera while
          // the loading cover is up, including its previously hidden actors.
          camera.position.set(p.x, c.cameraHeight, p.z + c.cameraBack);
          camera.lookAt(p.x, .7, p.z - .8); camera.updateMatrixWorld(true);
          if (c.step) c.step();
          // Every nearby actor is visible, but distant rooms keep their camera culling.
          // drawAll() still exercises every layout globally once.
          const visibility = showAll(scene, true);
          try {
            renderer.shadowMap.needsUpdate = true; c.post.render(0);
            const gl = renderer.getContext(), fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            if (fence) {
              try {
                gl.flush(); const until = performance.now() + 30000;
                while (!gl.isContextLost() && gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED && performance.now() < until) await frame();
              } finally { gl.deleteSync(fence); }
            }
          } finally { restoreAll(visibility); }
        }
        if (c.progress) c.progress((i + 1) / rooms.length);
      }
      if (toggled) {
        for (let k = 0; k <= points.length; k++) {
          if (seenCounts.has(k)) continue;
          points.forEach((l, i) => { l.visible = i < k; });
          await compileNow();
        }
      }
    } finally {
      points.forEach((l, i) => { l.visible = flags[i]; }); p.x = ox; p.z = oz;
      if (raster) { camera.position.copy(oldPosition); camera.quaternion.copy(oldQuaternion); camera.updateMatrixWorld(true); }
      safe(() => c.snap());
      if (raster) { if (c.step) c.step(); renderer.shadowMap.needsUpdate = true; }
    }
    stats.rooms = created;
    return stats.tour = Math.round(performance.now() - t0);
  }

  B.Warmup = { paintDom, drawAll, roomTour, rehearse, stats };
})();
