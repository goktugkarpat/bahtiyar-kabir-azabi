/* KABİR AZABI — app shell: renderer, post-processing, camera, input, HUD, menus and settings.
   Gameplay lives in BABA.Game (combat.js); this file only presents it and feeds it input. */
(() => {
  'use strict';
  const B = window.BABA, $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const Q = new URLSearchParams(location.search);
  const CAMPAIGN_KEY = 'baba.kabir.campaign.v1';
  const CHAPTER_SETTINGS_KEY = 'karaGecit.chapterSettings.v1';
  let campaign = null;
  try {
    const saved=JSON.parse(localStorage.getItem(CAMPAIGN_KEY));
    if(saved && saved.version===3 && [1,2,3,4].includes(saved.chapter) && saved.progression && [1,B.Progression.VERSION].includes(saved.progression.version) && Array.isArray(saved.progression.inventory) && (saved.index===1 || saved.index===0 && (saved.transition||saved.completed||saved.ongoing)) && (saved.chapter===1 || Array.isArray(saved.progression.completed) && saved.progression.completed.includes(saved.chapter-1))) {
      campaign=saved;
      // The old two-chapter ending now opens the road into the third chapter.
      if(saved.chapter<4 && saved.chapter>1 && saved.completed && saved.progression.completed.includes(saved.chapter)) {
        campaign={version:3,chapter:saved.chapter+1,index:0,transition:true,progression:saved.progression};
        localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(campaign));
      }
    }
  } catch (_) {}
  const chapter=campaign?campaign.chapter:1,coastChapter=chapter===2,ruinsChapter=chapter===3,forgeChapter=chapter===4;
  B.ActiveChapter=chapter;
  const chapterNames=['Kurban Tapınağı','Kara Kıyı','Sessiz Taht','Kızıl Ocak'],chapterNumbers=['I','II','III','IV'];
  function chapterLink(continueJourney = false) {
    const u = new URL(location.href); u.searchParams.delete('bolum');
    if (continueJourney) {
      u.searchParams.set('yolculuk', 'devam');
      // Carry current choices through this internal chapter load, never a later launch.
      safe(() => sessionStorage.setItem(CHAPTER_SETTINGS_KEY, JSON.stringify({ chapter: chapter + 1, at: Date.now(), difficulty: cfg.difficulty, uiScale: cfg.uiScale })));
    } else { u.searchParams.delete('yolculuk'); safe(() => sessionStorage.removeItem(CHAPTER_SETTINGS_KEY)); }
    location.href = u.href;
  }
  $('next-chapter').onclick = () => chapterLink(true);
  $('next-chapter').classList.toggle('hidden',forgeChapter);
  if(chapter>1){
    document.querySelector('#pause .eyebrow').textContent=chapterNames[chapter-1];
    document.querySelector('#pause .save-note').textContent='Karakterin ve çantan korunur. Ölümde son yemin noktasına dönersin.';
    document.querySelector('#fatal h2').textContent='Yol açılmadı.';
    document.querySelector('#victory .eyebrow').textContent='Bölüm '+chapterNumbers[chapter-1]+' tamamlandı';
    document.querySelector('#victory .end-quote').textContent=coastChapter?'Çanın içindeki kırık mühür, kıyının ardındaki kral harabelerini gösterdi. Denizden uzaklaş; seni çağıran ses henüz susmadı.':ruinsChapter?'Boş taht kırıldı. Altından gelen körük sesi, kralın zincirlerinin hâlâ dövüldüğünü gösterdi. Kızıl Ocak’a in; bu yeminin kaynağını söndür.':'Son döküm soğudu. Zincirin yapıldığı ocak artık sessiz. Mezarın, denizin ve taşın sesi geride kaldı.';
    $('victory-title-text').textContent=forgeChapter?'Kızıl Ocak söndü':coastChapter?'Kıyının ardındaki yol':'Tahtın altındaki ocak';
    if(coastChapter)$('next-chapter').textContent='Harabelere ilerle';if(ruinsChapter)$('next-chapter').textContent='Kızıl Ocak’a in';
  }
  // Chapters I-III continue automatically (see advanceChapter); the victory screen is only the final ending after chapter IV.
  $('next-chapter').classList.add('hidden'); $('victory-character').classList.add('hidden');
  if(forgeChapter){ $('victory').classList.add('final'); $('again').querySelector('span').textContent='Yeni yolculuk'; document.querySelector('#victory .eyebrow').textContent='Yolculuk sona erdi'; }
  let advancing = false;
  const safe = f => { try { return f(); } catch (e) { console.warn('[Kabir Azabı]', e); } };
  const timeText = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const loadProgress = (p, text) => { if (window.KG_LOAD) window.KG_LOAD(p, text); };

  /* ───────────── Settings ─────────────
     Quality controls scene detail; display scale and optional AA are independent.
     None of them changes enemies, damage or attack timing. */
  const KEY = 'karaGecit.settings.v2', OLD_KEY = 'karaGecit.settings.v1';
  const DISPLAY = B.Display;
  // Browsers cannot reliably distinguish a MacBook from a desktop Mac.
  // Start Macs at 60 FPS and desktop PCs at 120; either limit remains selectable.
  const FRAME_LIMIT = /Mac/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent) ? 60 : 120;
  const QUALITY = {
    low:    { scale: 1, shadows: 0,    detail: 'low',    lights: .35, particles: 180, fog: .014, bloom: .08, corpses: 20, decals: 20, aa: true, occlusion: 0 },
    high:   { scale: 1, shadows: 1024, detail: 'high',   lights: .7,  particles: 440, fog: .019, bloom: .205, corpses: 58, decals: 58, aa: true, occlusion: .5 }
  };
  const QUALITY_TEXT = {
    low: ['Düşük', 'Akıcılık öncelikli. Hafif ışıklar ve daha az parçacık.'],
    high: ['Yüksek', 'Ayrıntılı yüzeyler, yumuşak gölgeler, ışıklar, sis ve savaş efektleri.']
  };
  // Character textures are sized once at start (Düşük halves them); a later change of preset takes full effect after a reload.
  const TEXTURE_NOTE = ' Karakter kaplamaları oyun yeniden açılınca bu ayara geçer.';
  const coarsePointer = matchMedia('(pointer:coarse)').matches;
  // Desktop defaults follow the current display's pixel density. Extra AA is opt-in.
  const DEFAULTS = { difficulty: 'normal', quality: 'high', qualityVersion: 5, ...DISPLAY.defaults, frameRate: FRAME_LIMIT, exposure: 1.15, shake: .55, master: .65, music: .42, sfx: .75, voice: .85, subtitles: true, uiScale: .85 };
  const FRAME_RATES = [60, 90, 120, 0];   // 0 = follow the display (every refresh; best with G-Sync / FreeSync / ProMotion)
  const UI_STEPS = [.85, 1];
  const LIMITS = { exposure: [.7, 1.7], shake: [0, 1], master: [0, 1], music: [0, 1], sfx: [0, 1], voice: [0, 1] };
  // `cfg` is shared with effects.js / world.js / combat.js (they read the technical fields).
  const cfg = { ...DEFAULTS, impact: .65, touch: 'auto', showFps: false };
  /* ───────────── Key bindings ─────────────
     binds[action] = [primary, secondary]: a KeyboardEvent.code ('KeyW', 'Space', …) or 'Mouse0'…'Mouse4' (left, middle, right, back, forward); '' = empty.
     Saved with the settings (field `binds`). Esc (pause) and H (help) are fixed. Menu: the 'keybinds' screen (setupBindUI). */
  const BIND_INFO = {
    up: ['Yukarı', ''], down: ['Aşağı', ''], left: ['Sola', ''], right: ['Sağa', ''],
    light: ['Hafif saldırı', 'Düşmana tıkla, basılı tut · boşluğa tık: yürü'], heavy: ['Yetenek · Sağ tık', 'Yetenek ağacından bu yuvaya bir güç ata'], stand: ['Yerinde vur', 'Basılıyken tıkla: yürümeden vurur'], dodge: ['Kaçınma', 'Yürüdüğün yöne'],
    heal: ['Can iksiri', 'Anında iyileşir'], rage: ['Yetenek · 2 tuşu', 'Yetenek ağacından bu yuvaya bir güç ata'], special: ['Yetenek · 1 tuşu', 'Yetenek ağacından bu yuvaya bir güç ata'], fourth: ['Yetenek · 3 tuşu', 'Yetenek ağacından bu yuvaya bir güç ata'], interact: ['Etkileşim', 'Yemin taşı']
  };
  const BIND_VERSION = 1;
  // The four skill slots are named by their CURRENT key (right mouse button, 1, 2, 3 by default), never "Yetenek I / II / III", and list the equipped skill.
  const SKILL_SLOT = { heavy: 0, special: 1, rage: 2, fourth: 3 };
  function bindInfo(a) {
    if (!(a in SKILL_SLOT)) return BIND_INFO[a];
    const code = binds[a] && (binds[a][0] || binds[a][1]), cap = code ? capName(code) : '—', row = game && game.skills ? game.skills()[SKILL_SLOT[a]] : null;
    return ['Yetenek · ' + (code === 'Mouse2' ? 'Sağ tık' : code === 'Mouse0' ? 'Sol tık' : cap + ' tuşu'),
      row && row.skill ? 'Takılı: ' + row.skill.name + ' (' + ['', 'I', 'II', 'III'][row.skill.tier] + '. aşama)' : 'Boş yuva · T ile yetenek öğren ve ata'];
  }
  const BIND_GROUPS = [['bind-combat', ['heavy', 'special', 'rage', 'fourth', 'light', 'stand', 'dodge', 'heal']], ['bind-misc', ['interact']]];
  const BIND_DEFAULTS = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    light: ['Mouse0', 'KeyJ'], heavy: ['Mouse2', 'KeyK'], stand: ['ShiftLeft', ''], dodge: ['Space', ''],
    heal: ['KeyQ', ''], rage: ['Digit2', ''], special: ['Digit1', ''], interact: ['KeyE', ''], fourth: ['Digit3', '']
  };
  const BIND_MOUSE_OK = ['light', 'heavy', 'dodge', 'heal', 'rage', 'special', 'fourth'];   // walking and interact stay on the keyboard
  const BIND_RESERVED = ['Escape', 'KeyH', 'KeyI', 'KeyC', 'KeyT', 'KeyM', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu'];
  const CAP_NAMES = { Space: 'SPACE', ShiftLeft: 'SHIFT', ControlLeft: 'CTRL', AltLeft: 'ALT', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'ENTER', Backspace: 'SİL', CapsLock: 'CAPS',
    Mouse0: 'SOL TIK', Mouse1: 'ORTA TIK', Mouse2: 'SAĞ TIK', Mouse3: 'FARE 4', Mouse4: 'FARE 5' };
  const binds = {}; let bindMap = {}, keyLayout = null;
  const normCode = c => c.replace(/^(Shift|Control|Alt)Right$/, '$1Left');   // both Shift keys count as one
  const mouseCode = c => /^Mouse[0-4]$/.test(c);
  const hasWalkMouse = pair => pair.some(mouseCode);
  function capName(code) {
    if (!code) return '—';
    if (CAP_NAMES[code]) return CAP_NAMES[code];
    const ch = keyLayout && keyLayout.get(code);   // the character printed on this keyboard's key (Chrome), else the US letter
    return ch ? ch.toLocaleUpperCase('tr') : code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'NUM ').toUpperCase();
  }
  function rebuildBindMap() { bindMap = {}; for (const a in binds) for (const c of binds[a]) if (c && !bindMap[c]) bindMap[c] = a; }
  // Fills `binds` from a saved value; anything invalid or double-used falls back to the default for that action.
  function setBinds(saved, first) {   // `first`: the action whose keys win a double use
    const used = new Set(), processed = [], src = saved && typeof saved === 'object' ? saved : {};
    for (const a of [first, 'special', 'rage', 'fourth', ...Object.keys(BIND_DEFAULTS)].filter((x, i, l) => x && l.indexOf(x) === i)) {
      const ok = c => typeof c === 'string' && /^[A-Za-z0-9]{2,20}$/.test(c) && !BIND_RESERVED.includes(c) && !used.has(c) && (!c.startsWith('Mouse') || BIND_MOUSE_OK.includes(a) && mouseCode(c));
      let pair = Array.isArray(src[a]) ? [src[a][0], src[a][1]].map(c => ok(c) ? c : '') : ['', ''];
      if (pair[0] && pair[0] === pair[1]) pair[1] = '';
      if (!pair[0]) {
        const fallback = BIND_DEFAULTS[a].filter(ok);
        pair = pair[1] ? [pair[1], ''] : [fallback[0] || '', fallback[1] || ''];
      }
      // A saved custom binding may occupy both defaults. Keep every action usable
      // without assigning the same key twice; its new cap is shown in the UI.
      if (!pair[0]) pair[0] = [...'1234567890'].map(n => 'Digit' + n).concat([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(c => 'Key' + c)).find(ok) || '';
      // The mouse light action also owns click-to-walk. Keep a usable button
      // when repairing old/custom saves, while preserving their primary key.
      if (a === 'light' && !hasWalkMouse(pair)) {
        let walkMouse = ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4'].find(ok);
        // Earlier combat actions may use both slots and occupy all five buttons.
        // Reclaim an optional backup rather than removing a primary or walking.
        if (!walkMouse) for (let i = processed.length - 1; i >= 0; i--) {
          const owner = processed[i], backup = binds[owner][1];
          if (mouseCode(backup)) { walkMouse = backup; binds[owner][1] = ''; used.delete(backup); break; }
        }
        pair[1] = walkMouse || '';
      }
      pair.forEach(c => c && used.add(c)); binds[a] = pair; processed.push(a);
    }
    rebuildBindMap();
  }
  function migrateNumberedBinds(saved) {
    const next = saved && typeof saved === 'object' ? { ...saved } : {};
    for (const [action, primary, legacy] of [['special', 'Digit1', 'KeyF'], ['rage', 'Digit2', 'KeyR']]) {
      const old = Array.isArray(next[action]) ? next[action] : [];
      // Keep a custom alternative where possible, while retiring the old F/R defaults.
      const backup = old.find(c => typeof c === 'string' && c && c !== legacy && c !== 'Digit1' && c !== 'Digit2') || '';
      next[action] = [primary, backup];
    }
    return next;
  }
  const isDown = a => binds[a].some(c => c && keys.has(c));

  function readSettings() {
    let raw = null, migrated = false, legacySettings = false;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') {
      // Version 1 stored fourteen separate graphics values. Keep the user's choices that still exist.
      try { raw = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); } catch (e) { raw = null; }
      if (raw && typeof raw === 'object') {
        migrated = legacySettings = true;
        if (raw.preset === 'ultra' || raw.preset === 'medium') raw.preset = 'high';
        if (!Object.prototype.hasOwnProperty.call(QUALITY, raw.preset)) raw.preset = ({ 0: 'low', 1024: 'high', 1536: 'high', 2048: 'high', 4096: 'high' })[raw.shadows] || DEFAULTS.quality;
        raw.quality = raw.preset;
      }
    }
    if (raw && typeof raw === 'object') {
      // Version 5: only Low and High remain; the former Medium is the new High.
      if (raw.quality === 'ultra' || raw.quality === 'medium') raw.quality = 'high';
      if (raw.qualityVersion !== DEFAULTS.qualityVersion) migrated = true;
      if (Object.prototype.hasOwnProperty.call(QUALITY, raw.quality)) cfg.quality = raw.quality;
      // Difficulty and HUD size always start from the launch defaults.
      for (const k of Object.keys(LIMITS)) if (Number.isFinite(raw[k])) cfg[k] = clamp(raw[k], LIMITS[k][0], LIMITS[k][1]);
      if (typeof raw.subtitles === 'boolean') cfg.subtitles = raw.subtitles;
      // Preserve valid display choices; retired choices fall back to Auto.
      Object.assign(cfg, DISPLAY.settings(raw));
      if (raw.displayVersion !== DISPLAY.defaults.displayVersion || raw.displayMode !== cfg.displayMode) migrated = true;
      cfg.frameRate = FRAME_RATES.includes(raw.frameRate) ? raw.frameRate : raw.frameRate === 144 ? 0 : DEFAULTS.frameRate;
      if (raw.frameRate !== cfg.frameRate) migrated = true;
      cfg.shake = DEFAULTS.shake;   // camera shake is no longer a setting
    }
    if (raw && typeof raw === 'object' && raw.bindVersion !== BIND_VERSION) {
      setBinds(migrateNumberedBinds(raw.binds)); migrated = true;
    } else setBinds(raw && raw.binds);
    cfg.difficulty = DEFAULTS.difficulty; cfg.uiScale = DEFAULTS.uiScale;
    try {
      const pending = sessionStorage.getItem(CHAPTER_SETTINGS_KEY);
      sessionStorage.removeItem(CHAPTER_SETTINGS_KEY);
      const handoff = JSON.parse(pending || 'null');
      const age = handoff ? Date.now() - handoff.at : -1;
      if (handoff && Q.get('yolculuk') === 'devam' && handoff.chapter === chapter && age >= 0 && age < 120000) {
        if (['easy', 'normal', 'hard'].includes(handoff.difficulty)) cfg.difficulty = handoff.difficulty;
        if (UI_STEPS.includes(handoff.uiScale)) cfg.uiScale = handoff.uiScale;
      }
    } catch (_) {}
    deriveSettings();
    if (migrated) { saveSettings(); safe(() => localStorage.removeItem(OLD_KEY)); }
  }
  function deriveSettings() {
    Object.assign(cfg, QUALITY[cfg.quality] || QUALITY.high);
    cfg.fps = cfg.frameRate;
    // 60 Hz-class targets: distant characters cast shadows over a shorter reach (see combat.js); 0 = all cast.
    cfg.shadowReach = cfg.quality === 'low' ? 0 : cfg.fps > 0 && cfg.fps <= 64 ? 10 : 13;   // far characters do not cast into the key light's map (fewer shadow draws = a steadier frame time)
    cfg.preset = cfg.quality;
    cfg.ambient = cfg.sfx * .66;   // dungeon ambience follows the effects slider
  }
  function saveSettings() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = cfg[k];
    out.binds = binds;
    out.bindVersion = BIND_VERSION;
    safe(() => localStorage.setItem(KEY, JSON.stringify(out)));
  }
  readSettings();
  B.Audio.set({ master: cfg.master, music: cfg.music, sfx: cfg.sfx, ambient: cfg.ambient, voice: cfg.voice });

  /* ───────────── State ───────────── */
  const views = ['title', 'pause', 'settings', 'controls', 'keybinds', 'death', 'victory', 'confirm', 'character', 'journal'];
  const overlays = new Set(['settings', 'controls', 'keybinds', 'confirm', 'character', 'journal']);
  let view = 'title', stack = [];
  let renderer, scene, camera, world, game, rig, post, characterUI, characterPreview, questUI;
  let scalerWarmTimer = 0, limbRoot = null, limbLookup = -1e9;
  const rawDepthTwins = [];
  // Title shot culling (only visible foes are animated there).
  const titleFrustum = new THREE.Frustum(), titleMatrix = new THREE.Matrix4(), titleSphere = new THREE.Sphere(new THREE.Vector3(), 4.5);
  // Damage flash, rage veil and the low-health pulse are drawn by the composite shader (post.js) instead of full-screen
  // DOM layers over the canvas. Same shapes, colours and timings as the old CSS (rage-breath 1.4 s, low-hp 1 s, .6 s fade).
  let ovRage = 0, ovRageOn = false, ovRageStart = 0, ovLowOn = false, ovLowStart = 0, ovLast = 0;
  const ovEase = k => k * k * (3 - 2 * k);
  const LOW_KEYS = [[0, .4], [.15, 1], [.35, .72], [.6, .4], [1, .4]];
  function overlayStep(now) {
    if (!post || !post.setOverlay) return;
    const dt = ovLast ? Math.min(.25, Math.max(0, (now - ovLast) / 1000)) : 0; ovLast = now;
    const cl = document.body.classList, still = reducedMotion.matches;
    const rage = cl.contains('raging');
    if (rage && !ovRageOn) ovRageStart = now;
    ovRageOn = rage;
    if (rage) {
      if (still) ovRage = 1;
      else { const ph = ((now - ovRageStart) / 1400) % 1, k = ph < .5 ? ph * 2 : 2 - ph * 2; ovRage = 1 - .45 * ovEase(k); }
    } else ovRage = still ? 0 : Math.max(0, ovRage - dt / .6);
    const low = view === 'playing' && cl.contains('low-hp');
    if (low && !ovLowOn) ovLowStart = now;
    ovLowOn = low;
    let lv = 0;
    if (low) {
      if (still) lv = .55;
      else {
        const ph = ((now - ovLowStart) / 1000) % 1;
        for (let i = 1; i < LOW_KEYS.length; i++) if (ph <= LOW_KEYS[i][0]) { const a = LOW_KEYS[i - 1], b = LOW_KEYS[i]; lv = a[1] + (b[1] - a[1]) * ovEase((ph - a[0]) / (b[0] - a[0])); break; }
      }
    }
    post.setOverlay(flash * .8, ovRage, lv);
  }
  let ready = false, paused = true, frame = 0, last = 0, qaClock = 0, visualDt = 0;
  let calmSince = 0, calmX = 0, calmZ = 0;   // see the draw-rate rule in frameStep
  let resumeAudioOnVisible = null;
  let graphicsLost = false, graphicsRecovering = false, graphicsEpoch = 0;
  const renderClock = B.Pacing.create();
  const scaler = DISPLAY.createScaler(), AUTO_SCALE = !Q.has('nodrs');
  let shake = 0, flash = 0, ragePush = 0, announceTimer = 0, levelUpTimer = 0, hudTimer = 0, firstHint = 25, elapsed = 0;
  let fpsStart = 0, fpsFrames = 0;
  const performanceMeter = B.Performance.create();
  let graphicsAdapter = null, multiDraw = false, worldSubmission = null;
  let introBlend = 1, introStart = 0, deaths = 0, lastHp = null, lastFlasks = null;
  const buffUI = B.Buffs.create($('timed-effects'));
  const targetUI = B.TargetHUD.create($('target-hud'));
  const cryEffect = { id: 'rage', name: 'Kan Öfkesi', icon: 'rage', remaining: 0, duration: B.Game.resources.durations.rage };
  const timedEffects = [cryEffect];
  let lastBuffRows = -1;
  const keys = new Set(), actions = {}, cameraPos = new THREE.Vector3(), look = new THREE.Vector3(), target = new THREE.Vector3(), projected = new THREE.Vector3();
  // D4 controls: light / heavy = the attack KEY (J, K, pad, on-screen button: only swings at a foe in the front cone); clickLight / clickHeavy = a mouse press or tap this frame,
  // holdLight / holdHeavy = the mouse button (or the finger) is still down, stand = the "stand still" modifier, target = the foe under the cursor, pointX / pointZ = the floor under it.
  const input = { x: 0, z: 0, aimX: null, aimZ: null, aimFoe: null, light: false, heavy: false, near: false, clickLight: false, clickHeavy: false, holdLight: false, holdHeavy: false, stand: false, target: null, pointX: null, pointZ: null, dodge: false, heal: false, rage: false, special: false, fourth: false, interact: false };
  let lightPointer = null, hitPause = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cameraKick = { x: 0, z: 0, vx: 0, vz: 0 }, cameraLead = new THREE.Vector3(), introFrom = new THREE.Vector3(), introLook = new THREE.Vector3(), lookTarget = new THREE.Vector3();
  let lastFootfall = 0, lastFootfallReset = null;
  let heldLight = false, lightRepeat = 0, controller = null, controllerState = null, roomId = -1, deathShown = false, wonShown = false;
  const joy = { x: 0, z: 0, id: null, ox: 0, oy: 0 };
  // Pointer for the click-target controls: last position (client px), the foe under it, whether it counts (over the game, or a button held), clicks waiting for the next frame.
  const cursor = { x: 0, y: 0, has: false, touch: false, target: null }, clicks = { light: false, heavy: false }, ndc = new THREE.Vector2(), pickRay = new THREE.Raycaster(), pickA = new THREE.Vector3(), pickB = new THREE.Vector3();
  let zoneTap = null, touchHold = null;   // pointerId of the finger that is down on the game (a held left click)
  // Touch controls appear on touch screens, and on any device as soon as a finger is used.
  let touchSeen = coarsePointer;
  const touchDevice = () => cfg.touch === 'on' || (cfg.touch === 'auto' && touchSeen);

  /* ───────────── Views ───────────── */
  const menuStyle = document.querySelector('link[href*="ui-polish.css"]');
  function show(next) {
    if (advancing && next !== 'playing') next = 'playing';   // the chapter hand-over cannot be interrupted by menus
    if ((graphicsLost || graphicsRecovering || warming) && next === 'playing') next = 'pause';
    if (next !== view) resetPerformance();
    view = next;
    // The menu artwork must not add CSS filters/compositing or selector work to gameplay.
    // Keep the original gameplay HUD; enable the new art only when a menu is visible.
    if (menuStyle) menuStyle.disabled = next === 'playing';
    if (next === 'playing' || next === 'title') stack = [];
    for (const v of views) $(v).classList.toggle('hidden', v !== next);
    $('hud').classList.toggle('hidden', next === 'title' || !game);
    document.body.dataset.view = next;
    if (next !== 'playing' && B.HUD && B.HUD.dismissTips) B.HUD.dismissTips();
    paused = next !== 'playing';
    clearInput();
    // Settings keep the sound running so volume changes can be heard; the pause menu itself is silent.
    if (next === 'playing' || next === 'settings') B.Audio.resume();
    else if (next === 'pause') B.Audio.suspend();
    if (next === 'title') {
      B.Audio.resume();
      document.body.classList.remove('raging', 'low-hp', 'in-combat');
      if (world && world.occluders) for (const m of world.occluders) { m.material.opacity = 1; m.material.depthWrite = true; }
      $('hud').classList.add('hidden');
      $('play').querySelector('span').textContent = game && game.hasSave ? 'Yolculuğa devam' : game && game.campaignCompleted ? 'Yolculuğun sonu' : 'Yolculuğa başla';
      $('new').classList.toggle('hidden', !game || !game.hasSave);
    }
    if (next === 'pause') fillPause();
    if (next === 'journal' && questUI) questUI.open();
    if (next !== 'journal' && questUI) questUI.close();
    if (characterUI && next !== 'character') characterUI.close(true);
    return next;
  }
  function open(next) { stack.push(view); show(next); }
  function back() { show(stack.pop() || 'title'); }
  function openCharacter(tab = 'inventory') { if (advancing || !game || !['playing', 'pause', 'victory', 'character'].includes(view)) return; if (view !== 'character') open('character'); characterUI.open(tab); }
  function clearInput() {
    keys.clear(); for (const k in actions) delete actions[k];
    heldLight = false; lightPointer = null; touchHold = null; zoneTap = null; clicks.light = clicks.heavy = false; cursor.target = null;
    joy.x = joy.z = 0; joy.id = null; resetStick();
    input.aimX = input.aimZ = input.aimFoe = null;
    input.x = input.z = 0; input.target = input.pointX = input.pointZ = null;
    for (const a of ['light', 'heavy', 'near', 'clickLight', 'clickHeavy', 'holdLight', 'holdHeavy', 'stand', 'dodge', 'heal', 'rage', 'special', 'fourth', 'interact']) input[a] = false;
  }

  /* ───────────── Messages ───────────── */
  function notify(text, kind = '') {
    if (!text) return;
    const box = $('toasts');
    if (Array.from(box.children).some(d => d.dataset.text === text)) return;
    while (box.children.length >= 2) box.firstElementChild.remove();
    const d = document.createElement('div');
    d.dataset.text = text; d.className = 'toast ' + kind; d.textContent = text;
    box.appendChild(d);
    setTimeout(() => d.classList.add('out'), kind.startsWith('rarity-') ? 6000 : 3600);
    setTimeout(() => d.remove(), kind.startsWith('rarity-') ? 6600 : 4200);
  }
  function clearNotices() {
    levelUpTimer = 0; $('level-up').classList.remove('show'); if (B.LevelUp) B.LevelUp.cancel(); if (B.Charge && B.Charge.cancel) B.Charge.cancel();
    buffUI.clear(); if (questUI) questUI.clear();
    targetUI.clear();
    $('toasts').replaceChildren();
    for (const w of warnings) w.el.remove(); warnings.length = 0;
    flash = shake = hitPause = ragePush = 0;
    cameraKick.x = cameraKick.z = cameraKick.vx = cameraKick.vz = 0; cameraLead.set(0, 0, 0); lastFootfall = 0;
  }
  function announce(name, sub = 'KURBAN TAPINAĞI', kind = '') {
    if (levelUpTimer > 0 && kind === 'checkpoint') return;
    const el = $('announcement');
    el.querySelector('small').textContent = sub; el.querySelector('strong').textContent = name;
    el.className = ''; void el.offsetWidth; el.className = 'show ' + kind;
    announceTimer = 4.2;
  }
  const warnings = [];
  const warningClip = new THREE.Vector4();
  function projectWarning(x, z) {
    warningClip.set(x, 1, z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    // A point behind the camera still points toward its actual side, rather
    // than being mirrored by a negative perspective denominator.
    const divisor = Math.max(.001, Math.abs(warningClip.w));
    projected.set(warningClip.x / divisor, warningClip.y / divisor, warningClip.z / divisor);
    return warningClip.w > 0 && Math.abs(projected.x) < .9 && Math.abs(projected.y) < .82 && projected.z > -1 && projected.z < 1;
  }
  function warn(d) {
    if (!Number.isFinite(d.x) || !Number.isFinite(d.z)) return;
    const onscreen = projectWarning(d.x, d.z);
    if (!d.hazard && onscreen) return;
    const el = document.createElement('div');
    el.className = 'direction-warning' + (d.unblockable ? ' unblockable' : '');
    const lab = document.createElement('span'); lab.className = 'dw-label';
    const tag = document.createElement('b'); tag.textContent = d.unblockable ? 'KAÇIN' : 'DİKKAT'; lab.append(tag, (d.text || 'Tehlike').replace(/ · .*/, ''));
    el.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 37 34H3Z"/><path d="M20 14v10M20 29v.5"/></svg>';
    el.append(lab); el.title = d.text || 'Tehlike';
    el.style.visibility = 'hidden';
    $('warnings').appendChild(el);
    warnings.push({ el, x: d.x, z: d.z, time: 1.3, hazard: d.hazard || null, sounded: false });
  }
  function syncWarnings(dt) {
    for (let i = warnings.length - 1; i >= 0; i--) {
      const w = warnings[i], h = w.hazard;
      if (h) { w.x = h.x; w.z = h.z; w.time = h.warn - h.age; }
      else if (view === 'playing') w.time -= dt;
      if (game.state !== 'playing' || w.time <= 0 || (h && (!game.hazards.includes(h) || h.active))) {
        w.el.remove(); warnings.splice(i, 1);
      }
    }
  }
  function drawWarnings() {
    for (const w of warnings) {
      const onscreen = projectWarning(w.x, w.z);
      const waiting = w.hazard && w.hazard.age < 0;
      const visible = !onscreen && !waiting && view === 'playing';
      w.el.style.visibility = visible ? '' : 'hidden';
      if (!visible) continue;
      if (!w.sounded) { w.sounded = true; B.Audio.play('warning', { volume: .4 }); }
      const sx = (projected.x * .5 + .5) * innerWidth, sy = (-projected.y * .5 + .5) * innerHeight;
      w.el.style.left = clamp(sx, 44, innerWidth - 44) + 'px'; w.el.style.top = clamp(sy, 60, innerHeight - 60) + 'px';
      const wa = Math.atan2(sy - innerHeight / 2, sx - innerWidth / 2); w.el.firstElementChild.style.rotate = wa * 180 / Math.PI + 90 + 'deg';
      w.el.style.setProperty('--ux', (-Math.cos(wa)).toFixed(2)); w.el.style.setProperty('--uy', (-Math.sin(wa)).toFixed(2));
      w.el.classList.toggle('late', w.time < .35);
    }
  }

  /* ───────────── Game events ───────────── */
  function begin(fresh = false) {
    if (fresh && chapter > 1) { safe(() => localStorage.removeItem(CAMPAIGN_KEY)); chapterLink(); return; }
    B.Audio.unlock(); if (B.Audio.resetNarration) B.Audio.resetNarration();
    const fromTitle = view === 'title';
    clearNotices();
    if (fresh) { game.restart(); deaths = 0; } else game.start();
    if (game.campaignCompleted && game.state === 'won') { wonShown = false; victory(); show('victory'); return; }
    deathShown = wonShown = false; roomId = -1; firstHint = 25; lastHp = lastFlasks = null;
    $('tutorial').classList.remove('hidden');
    show('playing'); hud(0);
    if (fromTitle && !reducedMotion.matches) { introBlend = 0; introStart = performance.now(); introFrom.copy(cameraPos); introLook.copy(look); }   // swoop from the title shot down to the play camera
    else { introBlend = 1; cameraPos.set(game.player.x, 16, game.player.z + 13); look.set(game.player.x, .7, game.player.z); }
    announce(chapterNames[chapter-1],'BÖLÜM '+chapterNumbers[chapter-1],'chapter');
    if (B.Audio.say && !game.checkpointIndex) B.Audio.say(forgeChapter ? 'forgeIntro' : ruinsChapter ? 'ruinsIntro' : coastChapter ? 'coastIntro' : 'intro');
  }
  const questVoices = { 'lost-names': 'questNames', 'blood-verdict': 'questVerdict', 'last-voice': 'questBell', 'root-memory': 'questMemory', 'kings-name': 'questKing', 'cave-breath': 'questEcho', 'last-prisoner': 'questPrisoner', 'heart-feeds': 'questHeart' };
  function event(name, d = {}) {
    if (name === 'quest') { if (questUI) questUI.event(d); if (d.complete && questVoices[d.id] && B.Audio.sayQuest) B.Audio.sayQuest(questVoices[d.id]); return; }
    if (name === 'progression') { if (d.levels > 0) { B.Audio.play('levelUp'); fx('heroSkill', { skill: 'level', phase: 'release', x: game.player.x, z: game.player.z }); announceTimer = 0; $('announcement').classList.remove('show'); if (B.LevelUp) B.LevelUp.trigger(d, game.player); levelUpTimer = 2.7; } if (characterUI) characterUI.refresh(); return; }
    if (name === 'loot') { for (const item of d.items || []) { const def = B.Progression.catalog[item.id]; if (def) notify(B.Progression.qualities[def.rarity].name + ' ganimet · ' + def.name + ' · Çantaya eklendi [I]', 'rarity-' + def.rarity); } return; }
    if (name === 'hit') {
      // combat.js sizes the hit-stop itself (d.hitstop is set) and reports how hard the contact was (d.impact 0..1),
      // so here the camera only recoils; unclassified heavy hits retain the same short 8 ms limit.
      const strength = Number.isFinite(d.impact) ? d.impact : d.blocked ? .28 : d.heavy ? .85 : d.target === 'player' ? .65 : .26;
      if (!reducedMotion.matches) {
        const face = Number.isFinite(d.face) ? d.face : game.player.face, kick = d.target === 'player' ? 1.6 : d.kill ? 2.6 : 2.1;
        cameraKick.vx += Math.sin(face) * strength * kick;
        cameraKick.vz += Math.cos(face) * strength * kick;
        if (!Number.isFinite(d.hitstop) && d.heavy) hitPause = Math.max(hitPause, Math.min(.008, .008 * cfg.impact / .65));
      }
      if (d.target === 'player') { flash = Math.min(1, flash + (d.blocked ? .08 : .52)); shake = Math.max(shake, .18); }
      else shake = Math.max(shake, d.blocked ? .03 : d.kill ? .13 : d.heavy ? .1 : d.finisher ? .09 : .045);
    }
    else if (name === 'impact') {
      // Slams, the finisher biting into the floor and big area blows: a short jolt that fades with distance.
      const p = game.player, s = (Number.isFinite(d.strength) ? d.strength : .5) * clamp(1 - Math.hypot(d.x - p.x, d.z - p.z) / 14, 0, 1);
      if (s > .01) {
        shake = Math.max(shake, .06 + .24 * s);
        if (!reducedMotion.matches) { const a = Math.atan2(p.x - d.x, p.z - d.z); cameraKick.vx += Math.sin(a) * s * 1.4; cameraKick.vz += Math.cos(a) * s * 1.4; }
      }
    }
    else if (name === 'rage') { shake = Math.max(shake, .45); if (!reducedMotion.matches) ragePush = 1; notify('ÖFKE UYANDI', 'rage'); }   // war cry: camera pushes in on the father
    else if (name === 'rageEnd') notify('Öfke söndü');
    else if (name === 'checkpoint') { $('objective').textContent = formatObjective(forgeChapter ? 'Son Döküm’e ilerle. Ocağın Kalbi’ni söndür.' : ruinsChapter ? 'Sessiz Taht’a ilerle. Oyukların Kralı’nı yen.' : coastChapter ? 'Çanlığa ilerle. Çancıyı sustur.' : 'Celladı bul. Geçidi aç.'); announce('Yemin mühürlendi', 'KONTROL NOKTASI', 'checkpoint'); notify('Canın ve iksirlerin yenilendi. Buradan geri döneceksin.', 'seal'); if (B.Audio.saySequence) B.Audio.saySequence([forgeChapter ? 'forgeCheckpoint' : ruinsChapter ? 'ruinsCheckpoint' : coastChapter ? 'coastCheckpoint' : 'checkpoint', 'heroOath']); else if (B.Audio.say) B.Audio.say(forgeChapter ? 'forgeCheckpoint' : ruinsChapter ? 'ruinsCheckpoint' : coastChapter ? 'coastCheckpoint' : 'checkpoint'); }
    else if (name === 'encounter') { if (d.name) announce(d.name, 'KARŞILAŞMA'); }
    else if (name === 'gateOpen') { announce('Kapı açıldı', 'BOSS KAPISI', 'seal'); }
    else if (name === 'encounterCleared') { announce('Mühür açıldı', d.roomName || d.name || 'SALON TEMİZLENDİ', 'seal'); }
    else if (name === 'boss') { if (d.active !== false) { announce(d.name || 'Zincir Celladı', forgeChapter ? 'SON DÖKÜM' : ruinsChapter ? 'SESSİZ TAHT' : coastChapter ? 'BOĞULMUŞ ÇANLIK' : 'KURBAN SALONU', 'boss'); if (B.Audio.saySequence) B.Audio.saySequence(forgeChapter ? ['forgeBoss'] : ruinsChapter ? ['ruinsBoss'] : coastChapter ? ['coastBoss'] : ['boss', 'cellat']); else if (B.Audio.say) B.Audio.say(forgeChapter ? 'forgeBoss' : ruinsChapter ? 'ruinsBoss' : coastChapter ? 'coastBoss' : 'boss'); } }
    else if (name === 'death') death(d);
    else if (name === 'win') victory(d);
    else if (name === 'toast') notify(d.text);
    else if (name === 'warning') warn(d);
  }
  function pulse(kind) { const b = document.body; b.classList.remove('pulse-' + kind); void b.offsetWidth; b.classList.add('pulse-' + kind); setTimeout(() => b.classList.remove('pulse-' + kind), 600); }
  const DEATH_TIPS = [
    [/[iİ]kili ayin/i, 'İki rahip arasında kızıl bir çizgi yanar; rahiplerden birine vur, ayin bozulur.'],
    [/kırba[cç]/i, 'Zincir kırbacı ışığın yayıldığı yönden gelir; bir adım içeri gir ya da yuvarlan.'],
    [/pala|dürtüş/i, 'Muhafızın palası inmeden önce bekler; ışık dolunca yana adım at. Kalkana hafif vurmaya devam edersen dürterek karşılık verir.'],
    [/kor yağmuru|mangal/i, 'Kor yağmuru üç halka düşürür; halkaların arasından geç ya da yuvarlan.'],
    [/diken|gölge adımı/i, 'Pusucu arkana geçer; yüzünü ona dön ya da ışık dolarken kaç.'],
    [/şişe|nefes/i, 'Şişe havadayken düşeceği yeri görürsün; yeşil birikintiye basma.'],
    [/kanca|hamle|kasırga|yargı|tekme/i, 'Cellat uzaktakini kancayla çeker, yakındakini tekmeler; halkanın içi ya da dışı güvenlidir.'],
    [/rün|birikinti|patlama|mezar kıran|tükürük/i, 'Kızıl kenarlı işaret en ağır darbedir. Işık dolmadan alanın dışına kaç ya da yuvarlan.'],
    [/zincir|biçiş|biçme/i, 'Cellat savurmadan önce bir an durur. O an yana kaç, sonra arkasından vur.'],
    [/sıçrayış|kesik/i, 'Pusucu sıçramadan önce çömelir. Tam sıçrarken kaçınırsan hasar almazsın.'],
    [/kavrayış|pençe|hücum/i, 'Mahkûmlar ikili pençe vurur. İlk darbeden sonra hemen yuvarlan, ikincisi arkandan gelir.'],
    [/kalkan|balta|yarma/i, 'Muhafızın gecikmeli baltası bir an bekler. Erken kaçınma; ışık dolmak üzereyken yuvarlan.']
  ];
  const COAST_DEATH_TIPS = [
    [/medcezir/i,'Deniz halkasının iç boşluğu ve dışı güvenlidir. Işık dolarken halkayı yuvarlanarak geç.'],
    [/mezar kök|derin kök|çürük taç/i,'Köklerin yeri ışık görünürken sabitlenir. Çizgilerin arasına geç; erken kaçıp işarete geri girme.'],
    [/boğulmuş çan/i,'Çanlar sırayla düşer. İlk halkadan çıkınca sonraki işaretlerin arasındaki boşluğu kullan.'],
    [/çapa|omurga|kıyıyı yar/i,'Çancı yakınındaki alanı biçer. Çifte savuruşun ikincisini bekle, sonra yaklaş.'],
    [/fener/i,'Fenercinin ışığı seni çağırır. Çizginin yanına çık; kızıl dairelere geri basma.'],
    [/tuz|diken/i,'Dikenler iki dar çizgide gelir. Aralarına geç veya atış dolarken yana yuvarlan.'],
    [/sıçray|çene|ayak/i,'Sürüngenin yere işaretlediği noktadan yana çık. Pençenin ikinci darbesini de bekle.'],
    [/kürek|son nefes|boğulma/i,'Boğulmuş küreğini kaldırınca savuruş yönünden çık. Çığlığın halkasının ortası güvenlidir.']
  ];
  const GENERAL_TIPS = ['Darbe inmeden hemen önce yuvarlanarak kaçın.', 'Kaçınmanın koruması hareketin başındadır. Geç kalırsan hasar alırsın.', 'Canın azaldığında can iksiri kullan; saldırırken de içebilirsin.', 'Ağır saldırı kalkanlıların gardını kırar ama dayanıklılığını hızla tüketir.'];
  // Cruel omens shown under the death card, rotated by death count and picked by the killer's name.
  const DEATH_OMENS = {
    'Zincirli Mahkûm': ['Bir mahkûm seni ezdi. Zincirin ucunda artık sen varsın.', 'Zincirini sürüklüyordu. Şimdi seni sürükleyecek.', 'Bu taşlar, mahkûma yenilenleri unutmaz.'],
    'Mezar Muhafızı': ['Muhafız mezarını hazır tuttu. Kapağı kapatmadı.', 'Pala inerken adını fısıldadı. Duymadın.', 'Mezarın senin için kazılı. Boş bekliyor.'],
    'Kül Rahibi': ['Külün ayine karıştı. Kalanını da isteyecekler.', 'Kanın kutsandı. Sırası gelince yine akacak.', 'Rahip adını küle yazdı. Rüzgâr silmez.'],
    'Karanlık Pusucusu': ['Pusucu arkandaydı. Hep arkandadır.', 'Gölgeler seni sayıyor. Bir eksiği daha var.', 'Karanlık seni gördü. Gözünü senden ayırmaz.'],
    'Veba Taşıyıcısı': ['Çürümen başladı bile. Kokun taşlara işledi.', 'Veba senin için yolu buldu.', 'Bu kokuyla ölülerin arasına bile girilmez.'],
    'Zincir Celladı': ['Cellat zincirini bir tur daha sardı. Sıra sende.', 'Zincir hâlâ sıcak. Boynun onu hatırlıyor.', 'Cellat seni saydı. Tek tek, sırayla.']
  };
  const DEATH_OMENS_ANY = ['Ölüm seni bile istemedi.', 'Karanlık seni yuttu ve geri tükürdü.', 'Burada ölüler bile dinlenemez.'];
  function death(d = {}) {
    if (deathShown) return; deathShown = true; deaths++;
    hud(0); hudTimer = 0;
    if (B.Audio.say) B.Audio.say(coastChapter ? 'coastDeath' : 'death', true);
    const enemy = d.enemy || game.lastDeath?.enemy, attack = d.attack || game.lastDeath?.attack;
    $('death-cause').textContent = enemy || 'Son darbeyi karanlık vurdu.';
    $('death-attack').textContent = attack || '';
    const tip = (attack && (coastChapter ? COAST_DEATH_TIPS : DEATH_TIPS).find(([re]) => re.test(attack))) || null;
    $('death-tip').textContent = tip ? tip[1] : GENERAL_TIPS[(deaths - 1) % GENERAL_TIPS.length];
    const omens = DEATH_OMENS[enemy] || DEATH_OMENS_ANY;
    $('death-detail').textContent = 'Eşyaların, seviyen ve yeteneklerin korundu. ' + (game.checkpointIndex ? 'Son yemin taşından devam edeceksin.' : 'Bölümün girişinden devam edeceksin.');
    setTimeout(() => { if (game.state === 'dead') show('death'); }, 750);
  }
  function victory(d = {}) {
    if (wonShown) return; wonShown = true;
    hud(0); hudTimer = 0;
    const winKey = forgeChapter ? 'forgeWin' : ruinsChapter ? 'ruinsWin' : coastChapter ? 'coastWin' : 'win';
    if (B.Audio.say) B.Audio.say(winKey, true);
    if (!forgeChapter) { advanceChapter(winKey); return; }
    const t = d.time ?? game.elapsed ?? elapsed, k = d.kills ?? game.kills ?? 0;
    const stat = (icon, value, label) => `<div><svg class="icon" aria-hidden="true"><use href="#${icon}"/></svg><b>${value}</b><small>${label}</small></div>`;
    $('victory-stats').innerHTML = stat('i-hourglass', timeText(t), 'SÜRE') + stat('i-cross', Math.round(k), 'ALT EDİLEN') + stat('i-skull', deaths, 'ÖLÜM');
    setTimeout(() => { if (game.state === 'won') show('victory'); }, 1500);
  }
  // Chapters I-III: the boss reward has been collected (combat.js win()) and the next chapter's save is written.
  // Fade to the chapter card while the closing narration plays, then load the next chapter's world (its loading cover
  // is the same dark colour) and begin it automatically (?yolculuk=devam).
  function advanceChapter(winKey) {
    if (advancing) return; advancing = true;
    clearInput(); B.HUD && B.HUD.dismissTips && B.HUD.dismissTips();
    const fade = $('chapter-fade'), narr = B.Narration && B.Narration[winKey];
    const hold = (Q.has('sessiz') ? 3.2 : Math.min(14, (narr && narr.duration) || 9) + 1) * 1000;
    fade.querySelector('.eyebrow').textContent = 'Bölüm ' + chapterNumbers[chapter - 1] + ' tamamlandı';
    fade.querySelector('h2').textContent = $('victory-title-text').textContent;
    fade.querySelector('.end-quote').textContent = document.querySelector('#victory .end-quote').textContent;
    fade.querySelector('.next').textContent = 'BÖLÜM ' + chapterNumbers[chapter] + ' · ' + chapterNames[chapter];
    setTimeout(() => { fade.classList.remove('hidden'); void fade.offsetWidth; fade.classList.add('show'); document.body.classList.add('chapter-fading'); }, 1500);
    // Music and ambience sink under the card so the swap on the next page is not a hard cut.
    setTimeout(() => {
      let n = 0; const timer = setInterval(() => { n++; B.Audio.set({ music: cfg.music * Math.max(0, 1 - n / 10), ambient: cfg.ambient * Math.max(0, 1 - n / 10) }); if (n >= 10) clearInterval(timer); }, 100);
    }, 1500 + 1700 + hold - 1100);
    setTimeout(() => chapterLink(true), 1500 + 1700 + hold);
  }

  /* ───────────── Effects bridge ───────────── */
  let feedback;
  function makeFX() { feedback = B.Effects.create(scene, () => game, () => cfg); }
  function fx(name, data) { if (feedback) feedback.burst(name, data); }
  function fxStep(dt) { if (feedback) feedback.update(dt); }
  function clearFX() { if (feedback) feedback.clear(); }

  /* ───────────── Rendering ───────────── */
  // Lights, fog and grade live in lighting.js; the HDR/AO/bloom/grade chain in post.js.
  function postProcess() {
    post = B.Post.create(renderer, scene, camera, cfg);
    rig = B.Lighting.create({ renderer, scene, camera, world, cfg, post });
  }
  let displayPlan = null, densityQuery = null;
  const resizeSize = new THREE.Vector2();
  function watchPixelDensity() {
    if (densityQuery) densityQuery.removeEventListener('change', densityChanged);
    densityQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener('change', densityChanged);
  }
  function densityChanged() { watchPixelDensity(); scaler.display(); resize(); }
  function resize() {
    if (!renderer || graphicsLost) return;
    const w = innerWidth, h = innerHeight;
    if (w < 1 || h < 1) return;   // Keep valid buffers while the window has no drawable area.
    // HUD scale: as before up to 982 px of screen height, then it keeps growing with the screen (big monitors); "Arayüz boyutu" multiplies it.
    const side = Math.min(w, h);
    const hudScale = clamp((side < 982 ? clamp(side / 800, .68, 1.05) : Math.min(2.3, 1.05 * side / 982)) * cfg.uiScale, .5, 2.9);
    document.documentElement.style.setProperty('--k', hudScale);
    document.body.classList.toggle('target-stacked', w <= 1100 || w < 1080 * hudScale + 36);
    // The HUD stays native even when Auto reduces the scene resolution.
    const gl = renderer.getContext(), vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [16384, 16384];
    const gpuMax = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 16384, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 16384, vp[0] || 16384, vp[1] || 16384);
    const nextDisplay = DISPLAY.plan({ width: w, height: h, pixelRatio: window.devicePixelRatio, maxSize: gpuMax }, cfg);
    if (Math.floor(w * nextDisplay.pixelRatio) < 1 || Math.floor(h * nextDisplay.pixelRatio) < 1) return;
    displayPlan = nextDisplay;
    renderer.getSize(resizeSize);
    // Setting pixel ratio also resizes Three's canvas. Change both together,
    // and retain the drawing buffer when a sound/UI setting leaves it intact.
    if (resizeSize.x !== w || resizeSize.y !== h || renderer.getPixelRatio() !== displayPlan.pixelRatio ||
        renderer.domElement.width !== displayPlan.width || renderer.domElement.height !== displayPlan.height) {
      renderer.setDrawingBufferSize(w, h, displayPlan.pixelRatio);
    }
    if (camera.aspect !== w / h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const changedSize = post.width !== renderer.domElement.width || post.height !== renderer.domElement.height;
    post.setSize(renderer.domElement.width, renderer.domElement.height);
    if (post.setOverlay) post.setOverlay(flash * .8, ovRage, 0, w, h);
    if (changedSize) resetPerformance();
    if (view === 'settings') safe(paintGraphicsNotes);
    const touch = touchDevice();
    document.body.classList.toggle('touch', touch);
    $('touch-controls').classList.toggle('hidden', !touch);
  }
  function applySettings() {
    if (!renderer) return;
    deriveSettings();
    if (game && game.setDifficulty) game.setDifficulty(cfg.difficulty);
    $('pause-difficulty').textContent = 'Zorluk: ' + (cfg.difficulty === 'easy' ? 'Kolay' : cfg.difficulty === 'normal' ? 'Normal' : 'Zor');
    rig.setQuality(cfg); post.setQuality(cfg);
    if (world.setQuality) world.setQuality(cfg);
    B.Audio.set({ master: cfg.master, music: cfg.music, sfx: cfg.sfx, ambient: cfg.ambient, voice: cfg.voice });
    $('fps').classList.toggle('hidden', !cfg.showFps);
    $('narration').classList.toggle('hidden', !cfg.subtitles || !$('narration').querySelector('p').textContent);
    if (game && game.setQuality) game.setQuality(cfg);
    resize(); resetPerformance(); saveSettings();
    // A settings change (e.g. frame cap 60, display mode) can make the scaler eligible or change its sizes:
    // build the missing sizes now, in a quiet moment, instead of at the first step in a fight.
    clearTimeout(scalerWarmTimer);
    scalerWarmTimer = setTimeout(() => { if (ready && !warming) prewarmScaler(); }, 250);
  }

  /* ───────────── Settings screen ───────────── */
  const pct = v => Math.round(v * 100) + '%';
  const SLIDERS = {
    video: [
      ['exposure', 'Parlaklık', 'Karanlığı kendi ekranına göre ayarla. Saldırı işaretleri her zaman görünür.', .7, 1.7, .05, v => Math.round(v / DEFAULTS.exposure * 100) + '%']
    ],
    audio: [
      ['master', 'Ana ses', 'Bütün seslerin seviyesi.', 0, 1, .05, pct],
      ['music', 'Müzik', 'Derinden gelen karanlık müzik.', 0, 1, .05, pct],
      ['sfx', 'Efektler', 'Darbe, silah, uyarılar ve zindan sesleri.', 0, 1, .05, pct],
      ['voice', 'Anlatıcı', 'Türkçe hikâye anlatıcısının sesi.', 0, 1, .05, pct]
    ]
  };
  function sliderRow([key, label, note, min, max, step, fmt]) {
    const row = document.createElement('div'); row.className = 'setting slider';
    row.innerHTML = `<div class="setting-head"><label for="set-${key}">${label}</label><output id="out-${key}"></output></div><input id="set-${key}" type="range" min="${min}" max="${max}" step="${step}"><small>${note}</small>`;
    const el = row.querySelector('input'), out = row.querySelector('output');
    const paint = () => { out.textContent = fmt(cfg[key]); el.style.setProperty('--fill', ((cfg[key] - min) / (max - min) * 100) + '%'); };
    el.value = cfg[key]; paint();
    el.addEventListener('input', () => { cfg[key] = +el.value; paint(); applySettings(); });
    return row;
  }
  // Display choices are independent of shadow/effect quality.
  function choiceRow(key, label, values, text) {
    const row = document.createElement('div'); row.className = 'setting quality ' + key;
    row.innerHTML = `<div class="setting-head"><label id="${key}-label">${label}</label></div><div class="segmented${values.length === 2 ? ' pair' : values.length > 3 ? ' wide' : ''}" role="radiogroup" aria-labelledby="${key}-label">${values.map((v, i) => `<button type="button" role="radio" data-i="${i}">${text(v)}</button>`).join('')}</div><small id="${key}-note"></small>`;
    const buttons = [...row.querySelectorAll('button')];
    const paint = () => {
      buttons.forEach((b, i) => {
        const on = values[i] === cfg[key]; b.classList.toggle('selected', on); b.setAttribute('aria-checked', on);
      });
    };
    buttons.forEach((b, i) => b.addEventListener('click', () => {
      if (values[i] === cfg[key]) return;
      cfg[key] = values[i];
      paint();
      applySettings();
      $('settings-video').querySelectorAll('.setting').forEach(r => { if (r.repaint) r.repaint(); });
      paintGraphicsNotes();
    }));
    row.repaint = paint; paint();
    return row;
  }
  // Report the real output, including hardware fallback, separately from the requested choice.
  function paintGraphicsNotes() {
    if (!renderer || !displayPlan) return;
    const r = $('display-note'), mode = $('displayMode-note'), rate = $('frameRate-note');
    if (r) r.textContent = `Şu an: ${post.width} × ${post.height} piksel · ${cfg.fps ? 'en fazla ' + cfg.fps + ' FPS' : 'FPS sınırı kapalı'}.` +
      (displayPlan.limited ? ' Ekran kartının görüntü boyutu sınırı uygulanıyor.' : '') +
      (cfg.dynScale < 1 ? ` Akıcılığı korumak için çizim boyutu geçici olarak %${Math.round(cfg.dynScale * 100)} düzeyinde.` : '');
    if (mode) {
      mode.textContent = cfg.displayMode === 'auto'
        ? 'Otomatik: yüksek çözünürlüklü ekranlarda grafik kalitesine uygun boyut seçer. Düşük ayar bilgisayarı daha az çalıştırır. Yazılar net kalır.'
        : 'Ekranın bütün piksellerini kullanır. Retina ekranda Düşük kalite seçilse de çizim boyutu azalmaz.';
    }
    if (rate) rate.textContent = cfg.fps ? 'En fazla ' + cfg.fps + ' kare/sn. Ekranın yenileme hızına uymayan bir sınır kare atlamalarına yol açabilir (G-Sync/FreeSync varsa sorun olmaz). Düşük sınır işlemci yükünü ve fan sesini azaltır: 90 FPS yaklaşık %25, 60 FPS yaklaşık %35 daha az işlemci kullanır.' : 'Ekranın her yenilemesinde çizer (G-Sync / FreeSync / ProMotion ile en düzgünü).';
  }
  function renderSettings() {
    const video = $('settings-video'), audio = $('settings-audio');
    $('settings-game').replaceChildren(choiceRow('difficulty', 'Zorluk', ['easy','normal','hard'],v=>v==='easy'?'Kolay':v==='normal'?'Normal':'Zor'));
    $('difficulty-note').textContent = 'Kolay: daha az tehlike. Normal: dengeli bir yolculuk. Zor: daha sert savaşlar. Seçimin hemen uygulanır; yeniden açılışta Normal başlar.';
    const gameHeading = document.createElement('h3'); gameHeading.textContent = 'Yolculuğun'; $('settings-game').prepend(gameHeading);
    const saveInfo = document.createElement('div'); saveInfo.className = 'settings-save-info'; saveInfo.innerHTML = '<strong>Yeminin sürüyor</strong><p>Ölümde son yemin noktasına dönersin. Eşyaların, tecrüben ve öğrendiğin yetenekler korunur.</p>'; $('settings-game').append(saveInfo);
    video.querySelectorAll('.advanced-graphics, .setting').forEach(n => n.remove()); audio.querySelectorAll('.setting').forEach(n => n.remove());
    const q = document.createElement('div'); q.className = 'setting quality';
    q.innerHTML = `<div class="setting-head"><label id="quality-label">Grafik kalitesi</label></div><div class="segmented" role="radiogroup" aria-labelledby="quality-label">${Object.keys(QUALITY).map(k => `<button type="button" role="radio" data-quality="${k}">${QUALITY_TEXT[k][0]}</button>`).join('')}</div><small id="quality-note"></small>`;
    const paintQuality = () => { q.querySelectorAll('[data-quality]').forEach(b => { const on = b.dataset.quality === cfg.quality; b.classList.toggle('selected', on); b.setAttribute('aria-checked', on); }); q.querySelector('#quality-note').textContent = QUALITY_TEXT[cfg.quality][1] + ((cfg.quality === 'low') !== lowTextures ? TEXTURE_NOTE : ''); };
    q.querySelectorAll('[data-quality]').forEach(b => b.addEventListener('click', () => { if (b.dataset.quality === cfg.quality) return; cfg.quality = b.dataset.quality; paintQuality(); applySettings(); warmShaders(true); }));
    paintQuality(); video.append(q);
    const displayNote = document.createElement('small'); displayNote.id = 'display-note'; q.append(displayNote);
    video.append(choiceRow('displayMode', 'Görüntü boyutu', ['auto', 'native'], v => ({ auto: 'Otomatik', native: 'Tam boyut' })[v]),
      choiceRow('frameRate', 'Kare hızı', FRAME_RATES, v => v ? v + ' FPS' : 'Ekran hızı'),
      choiceRow('uiScale', 'Arayüz boyutu', UI_STEPS, v => v < 1 ? 'Küçük' : 'Normal'));
    // Edge smoothing (SMAA post pass in post.js) is always on: no settings row.
    paintGraphicsNotes();
    $('uiScale-note').textContent = 'Alt çubuk, küreler, harita ve yazıları ölçekler. Yeniden açılışta Küçük başlar.';
    for (const f of SLIDERS.video) video.append(sliderRow(f));
    for (const f of SLIDERS.audio) audio.append(sliderRow(f));
    const sub = document.createElement('div'); sub.className = 'setting toggle';
    sub.innerHTML = '<label for="set-subtitles"><b>Altyazılar</b><small>Anlatıcının sözlerini ekranda göster.</small></label><input id="set-subtitles" type="checkbox">';
    const box = sub.querySelector('input'); box.checked = cfg.subtitles;
    box.addEventListener('change', () => { cfg.subtitles = box.checked; applySettings(); });
    audio.append(sub);
    $('settings-note').textContent = B.Audio.silent ? 'Test modu · sessiz' : 'Seçimler hemen uygulanır.';
  }
  function selectSettingsPage(page) {
    if (!['game', 'video', 'audio', 'input'].includes(page)) return;
    document.querySelectorAll('[data-settings-page]').forEach(button => { const active = button.dataset.settingsPage === page; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    for (const name of ['game', 'video', 'audio', 'input']) $('settings-' + name).classList.toggle('hidden', name !== page);
    $('settings').dataset.page = page;
    const pages = document.querySelector('#settings .settings-pages'); if (pages) pages.scrollTop = 0;
  }
  function openSettings() { open('settings'); renderSettings(); selectSettingsPage($('settings').dataset.page || 'video'); }
  function openControls() { open('controls'); }
  function openKeybinds() { open('keybinds'); renderBinds(); }
  function fillPause() {
    if (!game) return;
    const total = game.enemies.filter(e => !e.reserve).length, kills = game.enemies.filter(e => e.dead && !e.reserve).length;   // reserve = dormant boss adds (boss2.js)
    const r = world && world.roomAt(game.player.x, game.player.z);
    $('pause-room').textContent = r ? r.name : 'Kurban Tapınağı';
    $('pause-time').textContent = timeText(game.elapsed || 0);
    $('pause-kills').textContent = kills + ' / ' + total;
  }

  /* ───────────── UI wiring ───────────── */
  function setupUI() {
    document.querySelectorAll('[data-settings-page]').forEach(button => { button.onclick = () => selectSettingsPage(button.dataset.settingsPage); });
    $('pause-journal').onclick = $('hud-journal').onclick = () => open('journal');
    $('journal-close').onclick = $('journal-done').onclick = back;
    $('pause-talents').onclick = () => openCharacter('skills');
    $('pause-character').onclick = $('victory-character').onclick = () => openCharacter();
    $('play').onclick = () => begin(false);
    $('new').onclick = () => open('confirm');
    $('title-settings').onclick = $('pause-settings').onclick = openSettings;
    $('title-controls').onclick = $('pause-controls').onclick = $('settings-controls').onclick = openControls;
    $('pause-button').onclick = () => { if (view === 'playing') show('pause'); };
    $('resume').onclick = () => show('playing');
    $('settings-close').onclick = $('settings-done').onclick = $('controls-close').onclick = $('confirm-no').onclick = back;
    $('settings-reset').onclick = () => { const q = cfg.quality; Object.assign(cfg, DEFAULTS); applySettings(); renderSettings(); selectSettingsPage($('settings').dataset.page || 'video'); if (q !== cfg.quality) warmShaders(true); };
    $('restart').onclick = () => open('confirm');
    $('confirm-yes').onclick = () => { clearFX(); begin(true); };
    for (const id of ['return-title', 'death-title', 'victory-title']) $(id).onclick = () => {
      if (game.toTitle) game.toTitle(); clearFX(); clearNotices(); B.Audio.resetNarration();
      titleCamera(); snapScene(); show('title');   // cut straight to the title shot (no flight back through the walls)
    };
    $('respawn').onclick = () => {
      B.Audio.unlock(); B.Audio.resetNarration(); clearFX(); clearNotices(); game.respawn();
      deathShown = wonShown = false; show('playing'); roomId = -1; introBlend = 1; lastHp = lastFlasks = null; hud(0);
      cameraPos.set(game.player.x, 16, game.player.z + 13); look.set(game.player.x, .7, game.player.z); snapScene();
      announce(game.checkpointIndex ? 'Yemin Taşı' : 'Kabir Azabı', 'GERİ DÖNDÜN', 'checkpoint');
    };
    $('again').onclick = () => { clearFX(); begin(true); };
    $('tutorial').querySelector('button').onclick = () => { $('tutorial').classList.add('hidden'); firstHint = 0; };
    document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (e.pointerType === 'touch') setTouch(true);
      if (view !== 'playing') return;
      actions[el.dataset.action] = true; tap(el);
      if (el.dataset.action === 'light' || el.dataset.action === 'heavy') actions.near = true;   // the on-screen attack buttons hit the nearest foe in reach, any direction
      if (el.dataset.action === 'light') { heldLight = true; lightPointer = e.pointerId; lightRepeat = 0; capture(el, e); }
    }));
    $('interact').onclick = () => actions.interact = true;
    // Floating stick: the left thumb can land anywhere in the left half; the ring moves under it.
    const zone = $('touch-zone'), stick = $('joystick');
    zone.addEventListener('pointerdown', e => {
      if (joy.id !== null || view !== 'playing') return;
      e.preventDefault(); joy.id = e.pointerId; capture(zone, e);
      stick.style.transform = ''; const r = stick.getBoundingClientRect();
      joy.ox = e.clientX; joy.oy = e.clientY;
      stick.style.transform = `translate(${e.clientX - (r.left + r.width / 2)}px,${e.clientY - (r.top + r.height / 2)}px)`;
      stick.classList.add('active'); joyMove(e);
      zoneTap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    });
    zone.addEventListener('pointermove', joyMove);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, e => {
      if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.z = 0; resetStick(); }
      // A short tap on the stick zone is a tap on the game (attack the foe there / walk there); a drag is the stick.
      if (ev === 'pointerup' && zoneTap && zoneTap.id === e.pointerId && performance.now() - zoneTap.t < 260 && Math.hypot(e.clientX - zoneTap.x, e.clientY - zoneTap.y) < 14 && view === 'playing') { setCursor(e, true); cursor.touch = true; clicks.light = true; }
      if (zoneTap && zoneTap.id === e.pointerId) zoneTap = null;
    });
    document.addEventListener('keydown', e => {
      const browserChord = e.metaKey || (e.ctrlKey && !e.code.startsWith('Control') && !bindMap.ControlLeft);
      if (view === 'playing' && (bindMap[normCode(e.code)] || e.code === 'Tab') && !browserChord) e.preventDefault();   // mapped keys never scroll or search the page
      if (e.code === 'Escape') {
        e.preventDefault();
        if (e.repeat) return;
        if (view === 'playing') show('pause'); else if (view === 'pause') show('playing'); else if (overlays.has(view)) back();
        return;
      }
      // Match the character: the dot is on a different physical key on Turkish keyboards.
      if (e.key === '.' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
        const el = e.target;
        if (el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' && !['range', 'checkbox', 'button'].includes(el.type))) return;
        e.preventDefault();
        if (!e.repeat) {
          cfg.showFps = !cfg.showFps; resetPerformance();
          $('fps').classList.toggle('hidden', !cfg.showFps);
          if (cfg.showFps) drawFps();
        }
        return;
      }
      if (['KeyI', 'KeyC', 'KeyT'].includes(e.code) && !browserChord && !e.repeat && ['playing', 'pause', 'character'].includes(view)) { e.preventDefault(); if (view === 'character') back(); else openCharacter(e.code === 'KeyT' ? 'skills' : 'inventory'); return; }
      if (view !== 'playing' || browserChord) return;
      if (e.code === 'KeyH' && !e.repeat) { show('pause'); openControls(); return; }
      if (e.repeat) keys.add(normCode(e.code)); else pressBind(normCode(e.code));
    });
    document.addEventListener('keyup', e => releaseBind(normCode(e.code)));
    window.addEventListener('blur', () => { clearInput(); if (view === 'playing') show('pause'); });
    document.addEventListener('visibilitychange', () => {
      resetPerformance();
      if (document.hidden) {
        clearInput(); if (view === 'playing') show('pause');
        if (resumeAudioOnVisible === null) resumeAudioOnVisible = !B.Audio.paused;
        B.Audio.suspend();
      } else {
        if (resumeAudioOnVisible || view === 'title') B.Audio.resume();
        resumeAudioOnVisible = null;
      }
    });
    const canvas = $('game');
        canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') {
        setTouch(true);
        if (view === 'playing') { e.preventDefault(); setCursor(e, true); cursor.touch = true; clicks.light = true; touchHold = e.pointerId; }   // a tap: attack the foe there / walk there; keep the finger down to keep going
        return;
      }
      if (e.pointerType === 'mouse' && touchSeen && !coarsePointer) setTouch(false);
      if (view !== 'playing') return;
      e.preventDefault();
      setCursor(e, true); cursor.touch = false;
      syncMouse(e, true);
    });
    window.addEventListener('pointermove', e => { if (e.pointerType === 'touch' ? e.pointerId === touchHold : true) setCursor(e, e.target === canvas || touchHold === e.pointerId || heldMouse()); });
    canvas.addEventListener('pointermove', e => { if (keys.has('Mouse0') || keys.has('Mouse1') || keys.has('Mouse2') || keys.has('Mouse3') || keys.has('Mouse4')) syncMouse(e, true); });   // a second mouse button pressed while another is held
    for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => syncMouse(e, false));
    for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => { if (lightPointer === e.pointerId) { heldLight = false; lightPointer = null; } if (touchHold === e.pointerId) touchHold = null; });
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setTouch(true); }, true);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    setupBindUI();
    window.addEventListener('resize', resize);
    watchPixelDensity();
    controller = B.Controller.create({
      getView: () => view, getMenuRoot: () => $(view), notify,
      onPause: () => { if (view === 'playing') show('pause'); else if (view === 'pause') show('playing'); else if (['settings', 'controls', 'keybinds', 'character', 'journal'].includes(view)) back(); },
      onBack: () => { if (view === 'pause') show('playing'); else if (view !== 'title' && view !== 'death' && view !== 'victory') back(); },
      onCharacter: () => openCharacter(),
      onDisconnect: () => { clearInput(); if (view === 'playing') show('pause'); }
    });
    controller.mount($('settings-input'));
    // Menu clicks get a short iron tick (Audio stays silent under ?sessiz).
    document.addEventListener('click', e => { if (e.target.closest('.screen button')) B.Audio.play('ui', { volume: .5 }); });
  }
  /* ───────────── Key bindings: input and menu ───────────── */
  // A key or mouse button goes down / up: `keys` holds the codes that are held; tapped actions become one-frame flags.
  function pressBind(code, ptr) {
    keys.add(code);
    const a = bindMap[code];
    if (!a || a === 'stand' || ['up', 'down', 'left', 'right'].includes(a)) return;
    tap(document.querySelector(`[data-action="${a}"]`));
    // A mouse press on light / heavy is a click (target a foe, walk, or Shift + click in place); a key press is the attack key (foe in the front cone only).
    if (code.startsWith('Mouse') && (a === 'light' || a === 'heavy')) { clicks[a] = true; return; }
    actions[a] = true;
    if (a === 'light') lightRepeat = 0;
  }
  function releaseBind(code) {
    keys.delete(code);
  }
  // Mouse buttons are read from PointerEvent.buttons so that a second button pressed while the first is held (a click while another button is held) is seen too.
  function syncMouse(e, allowPress) {
    if (e.pointerType !== 'mouse') return;
    [1, 4, 2, 8, 16].forEach((bit, b) => {   // bits of Mouse0 (left), Mouse1 (middle), Mouse2 (right), Mouse3 (back), Mouse4 (forward)
      const code = 'Mouse' + b, down = !!(e.buttons & bit);
      if (down && !keys.has(code)) { if (allowPress && view === 'playing') pressBind(code, e); }
      else if (!down && keys.has(code)) releaseBind(code);
    });
  }
  // The key caps on the skill bar, the Kontroller help and the title hint always show the current bindings.
  function paintCaps() {
    const move = i => ['up', 'left', 'down', 'right'].map(a => binds[a][i] && capName(binds[a][i])).filter(Boolean);
    const arrows = move(1).join('') === '↑←↓→';
    const moveCaps = [move(0).join(' '), arrows ? 'OKLAR' : move(1).join(' ')].filter(Boolean);
    for (const k of document.querySelectorAll('.action kbd, #interact kbd, kbd[data-bind]')) {
      const p = k.parentElement, a = k.dataset.bind || p.dataset.action || p.dataset.hold || (p.id === 'interact' ? 'interact' : '');
      if (a === 'move') k.textContent = moveCaps[0];
      else if (binds[a]) {
        const code = binds[a][0] || binds[a][1], m = { Mouse0: 'l', Mouse2: 'r' }[code];
        k.classList.toggle('mouse', !!m);
        if (m) k.innerHTML = `<svg aria-hidden="true"><use href="#i-mouse-${m}"/></svg><em>${capName(code)}</em>`; else k.textContent = capName(code);
      }
    }
    for (const s of document.querySelectorAll('[data-caps]')) {
      const a = s.dataset.caps, list = a === 'move' ? moveCaps : binds[a].filter(Boolean).map(capName);
      s.replaceChildren(...list.map(t => Object.assign(document.createElement('kbd'), { textContent: t })));
    }
  }
  const bindsChanged = () => { rebuildBindMap(); safe(saveSettings); paintCaps(); renderBinds(); };
  // Gives `code` to binds[action][slot]. A code that is already used elsewhere swaps places with what this slot held.
  function assignBind(action, slot, code) {
    const label = a => bindInfo(a)[0], mouseOk = a => BIND_MOUSE_OK.includes(a);
    const walkNote = 'Tıklayarak yürümek için Hafif saldırıda en az bir fare tuşu kalmalı. Önce yedek kutuya bir fare tuşu ata.';
    if (!code) {
      if (!slot) return { ok: false, msg: 'Ana tuş boş bırakılamaz.' };
      if (action === 'light' && !mouseCode(binds.light[0])) return { ok: false, msg: walkNote };
      binds[action][1] = ''; return { ok: true, msg: `${label(action)}: yedek tuş boşaltıldı.` };
    }
    if (BIND_RESERVED.includes(code)) return { ok: false, msg: code === 'KeyH' ? 'H tuşu yardım için ayrılmış.' : 'Bu tuş ayrılmış, başka bir tuş dene.' };
    if (code.startsWith('Mouse') && !mouseCode(code)) return { ok: false, msg: 'Bu fare düğmesi desteklenmiyor; başka bir düğme seç.' };
    if (code.startsWith('Mouse') && !mouseOk(action)) return { ok: false, msg: 'Bu işlem için fare tuşu atanamaz, klavyeden bir tuş dene.' };
    const old = binds[action][slot]; if (old === code) return { ok: true, msg: '' };
    let hit = null; for (const a in binds) binds[a].forEach((c, i) => { if (c === code) hit = [a, i]; });
    let msg = `${label(action)}: ${capName(code)}`;
    let give = old;
    if (hit) {
      const [a2, s2] = hit;
      if (give.startsWith('Mouse') && !mouseOk(a2)) give = '';
      if (!give && !s2) return { ok: false, msg: `${capName(code)} zaten ${label(a2)} için ana tuş; önce onu değiştir.` };
    }
    const nextLight = binds.light.slice();
    if (hit && hit[0] === 'light') nextLight[hit[1]] = give;
    if (action === 'light') nextLight[slot] = code;
    if (!hasWalkMouse(nextLight)) return { ok: false, msg: walkNote };
    if (hit) {
      const [a2, s2] = hit;
      binds[a2][s2] = give;
      msg += a2 === action ? ' (ana ve yedek yer değiştirdi)' : ` · ${label(a2)} artık ${capName(give)}`;
    }
    binds[action][slot] = code;
    return { ok: true, msg: msg + '.' };
  }
  let rebind = null;
  const bindNote = t => { $('keybinds-note').textContent = t || 'Bir kutuya tıkla, sonra yeni tuşa bas.'; };
  function startRebind(action, slot) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    rebind = { action, slot };
    $('bind-capture-what').textContent = `${bindInfo(action)[0]} · ${slot ? 'yedek tuş' : 'ana tuş'}`;
    $('bind-capture-hint').textContent = BIND_MOUSE_OK.includes(action) ? 'Klavyeden bir tuşa ya da fare tuşuna bas · Esc iptal' : 'Esc iptal';
    $('bind-capture-clear').classList.toggle('hidden', !slot);
    $('bind-capture').classList.remove('hidden'); renderBinds();
  }
  function endRebind(msg) { rebind = null; $('bind-capture').classList.add('hidden'); bindNote(msg); renderBinds(); }
  function tryRebind(code) {
    const r = assignBind(rebind.action, rebind.slot, code);
    if (!r.ok) { $('bind-capture-hint').textContent = r.msg; return; }
    bindsChanged(); endRebind(r.msg);
  }
  function renderBinds() {
    for (const [id, list] of BIND_GROUPS) {
      const sec = $(id); if (!sec) continue;
      sec.querySelectorAll('.bindrow, .bind-cols, .bind-subhead').forEach(n => n.remove());
      const head = document.createElement('div'); head.className = 'bind-cols'; head.innerHTML = '<span></span><span>Ana tuş</span><span>Yedek</span><span></span>'; sec.append(head);
      const fixed = id === 'bind-misc' ? [['Mola', 'Menü ve ayarlar', 'ESC'], ['Karakter ve çanta', 'Yetenek ağacı: T', 'I / C'], ['Yardım', 'Kontroller ekranı', 'H']] : [];
      for (const a of list) {
        if (a === 'heavy' || a === 'light') {
          const sub = document.createElement('div'); sub.className = 'bind-subhead'; sub.setAttribute('role', 'presentation');
          sub.innerHTML = a === 'heavy' ? `<b>Yetenekler</b><span>${['heavy', 'special', 'rage', 'fourth'].map(k => { const c = binds[k][0] || binds[k][1]; return c ? capName(c) : '—'; }).join(' · ')}</span>` : '<b>Diğer savaş tuşları</b>';
          sec.append(sub);
        }
        const row = document.createElement('div'); row.className = 'setting bindrow'; row.dataset.bindRow = a;
        row.innerHTML = `<div class="bind-name"><label>${bindInfo(a)[0]}</label><small>${bindInfo(a)[1]}</small></div><button type="button" class="bind-slot" data-slot="0"></button><button type="button" class="bind-slot" data-slot="1"></button><button type="button" class="bind-reset" title="Varsayılana dön" aria-label="${BIND_INFO[a][0]}: varsayılana dön">↺</button>`;
        row.querySelectorAll('.bind-slot').forEach((b, i) => {
          const c = binds[a][i]; b.textContent = capName(c); b.classList.toggle('empty', !c); b.classList.toggle('listening', !!rebind && rebind.action === a && rebind.slot === i);
          b.setAttribute('aria-label', `${bindInfo(a)[0]}, ${i ? 'yedek' : 'ana'} tuş: ${c ? capName(c) : 'boş'}. Değiştirmek için tıkla.`);
          b.onclick = () => startRebind(a, i);
        });
        const same = binds[a].join() === BIND_DEFAULTS[a].join(), rs = row.querySelector('.bind-reset'); rs.disabled = same;
        rs.onclick = () => { setBinds(Object.assign({}, binds, { [a]: BIND_DEFAULTS[a] }), a); bindsChanged(); bindNote(`${bindInfo(a)[0]} varsayılana döndü.`); };
        sec.append(row);
      }
      for (const [name, note, cap] of fixed) {
        const row = document.createElement('div'); row.className = 'setting bindrow fixed';
        row.innerHTML = `<div class="bind-name"><label>${name}</label><small>${note} · sabit</small></div><span class="bind-slot">${cap}</span><span class="bind-slot empty">—</span><span></span>`; sec.append(row);
      }
    }
  }
  function setupBindUI() {
    $('settings-keys').onclick = $('controls-keys').onclick = openKeybinds;
    $('keybinds-close').onclick = $('keybinds-done').onclick = () => { if (rebind) endRebind(); back(); };
    $('keybinds-reset').onclick = () => { setBinds(null); bindsChanged(); bindNote('Bütün tuşlar varsayılana döndü.'); };
    $('bind-capture-cancel').onclick = () => endRebind();
    $('bind-capture-clear').onclick = () => { const r = assignBind(rebind.action, rebind.slot, ''); if (!r.ok) { $('bind-capture-hint').textContent = r.msg; return; } bindsChanged(); endRebind(r.msg); };
    // While a slot listens, this capture-phase handler takes every key before the game's own handler sees it.
    window.addEventListener('keydown', e => {
      if (!rebind) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat || /^(Meta|OS)/.test(e.key)) return;
      if (e.code === 'Escape') return endRebind();
      if (e.key === '.') return void ($('bind-capture-hint').textContent = 'Nokta tuşu FPS göstergesi için ayrılmış.');
      tryRebind(normCode(e.code));
    }, true);
    const cap = $('bind-capture');
    cap.addEventListener('contextmenu', e => e.preventDefault());
    cap.addEventListener('pointerdown', e => {
      if (!rebind || e.pointerType === 'touch' || e.target.closest('button')) return;
      e.preventDefault(); tryRebind('Mouse' + e.button);
    });
    paintCaps();
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { keyLayout = m; paintCaps(); if (view === 'keybinds') renderBinds(); }).catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.hidden && rebind) endRebind(); });
  }
  function capture(el, e) { try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ } }
  function setTouch(on) { if (touchSeen === on) return; touchSeen = on; resize(); }
  function tap(el) { if (!el) return; el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap'); }
  function resetStick() { const s = $('joystick'); if (!s) return; s.style.transform = ''; s.classList.remove('active'); s.firstElementChild.style.transform = ''; }
  function joyMove(e) {
    if (e.pointerId !== joy.id) return;
    const size = $('joystick').offsetWidth || 120, max = size * .34;
    const mx = e.clientX - joy.ox, mz = e.clientY - joy.oy, d = Math.hypot(mx, mz), k = d > max ? max / d : 1;
    joy.x = mx * k / max; joy.z = mz * k / max;
    $('joystick').firstElementChild.style.transform = `translate(${mx * k}px,${mz * k}px)`;
  }
  const heldMouse = () => ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4'].some(c => keys.has(c));
  const holdBtn = a => binds[a].some(c => c && c.startsWith('Mouse') && keys.has(c)) || (a === 'light' && touchHold !== null);   // the mouse button (or the finger) of this attack is down
  const keyDown = a => binds[a].some(c => c && !c.startsWith('Mouse') && keys.has(c));   // ... the keyboard key is down
  function setCursor(e, count) { cursor.x = e.clientX; cursor.y = e.clientY; cursor.has = !!count; }
  // The floor point under the cursor and the foe under / near it (a capsule from the feet to the head, plus a soft margin of ~3 % of the screen height so that
  // a foe does not have to be hit exactly; the foe that was targeted a moment ago keeps the target a little longer so the ring does not flicker between neighbours).
  function updatePointer() {
    const prev = cursor.target; cursor.target = null; input.pointX = input.pointZ = null;
    if (!cursor.has || !camera || !game) return;
    ndc.set(cursor.x / innerWidth * 2 - 1, -(cursor.y / innerHeight) * 2 + 1);
    pickRay.setFromCamera(ndc, camera);
    const o = pickRay.ray.origin, d = pickRay.ray.direction;
    if (d.y < -1e-3) { const t = -o.y / d.y; input.pointX = o.x + d.x * t; input.pointZ = o.z + d.z * t; }
    const soft = Math.max(22, innerHeight * .03), W = innerWidth, H = innerHeight;
    let best = null, bestScore = 1e9, prevScore = 1e9;
    for (const e of game.enemies) {
      if (e.dead || !e.model.root.visible) continue;
      pickA.set(e.x, .15, e.z).project(camera); pickB.set(e.x, (e.model.height || 2.2) * .92, e.z).project(camera);
      if (pickA.z > 1 || pickB.z > 1) continue;
      const ax = (pickA.x * .5 + .5) * W, ay = (-pickA.y * .5 + .5) * H, bx = (pickB.x * .5 + .5) * W, by = (-pickB.y * .5 + .5) * H;
      pickB.set(e.x + 1, .15, e.z).project(camera);
      const rpx = Math.max(12, e.radius * .8 * Math.abs((pickB.x * .5 + .5) * W - ax));
      const sx = bx - ax, sy = by - ay, len2 = sx * sx + sy * sy, k = len2 > 1e-6 ? Math.max(0, Math.min(1, ((cursor.x - ax) * sx + (cursor.y - ay) * sy) / len2)) : 0;
      const score = Math.hypot(cursor.x - (ax + sx * k), cursor.y - (ay + sy * k)) - rpx;
      if (e === prev) prevScore = score;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    cursor.target = best && bestScore <= soft ? best : null;
    if (prev && !prev.dead && prevScore <= soft * 1.8 && (!cursor.target || bestScore > 0)) cursor.target = prev;
  }
  function pollInput() {
    input.aimX = input.aimZ = input.aimFoe = null; input.padActive = false;   // controller aim never inherits a stale mouse cursor
    // Like Diablo IV on PC: the keyboard does not walk the hero (the mouse does); only the touch stick and the gamepad stick give a direction.
    let x = joy.x, z = joy.z;
    updatePointer();
    input.stand = isDown('stand');
    input.holdLight = holdBtn('light'); input.holdHeavy = holdBtn('heavy');
    input.clickLight = clicks.light; input.clickHeavy = clicks.heavy; clicks.light = clicks.heavy = false;
    input.target = cursor.target;
    if (cursor.touch && touchHold === null) cursor.has = false;   // a finger that has lifted no longer points at anything
    if (controllerState && controllerState.connected && !controllerState.binding) {
      input.padActive = Math.hypot(controllerState.x, controllerState.z, controllerState.aimX, controllerState.aimZ) > .08 || controllerState.lightHeld || Object.values(controllerState.actions).some(Boolean);
      x += controllerState.x; z += controllerState.z;
      const ax = controllerState.aimX, az = controllerState.aimZ;
      if (Math.hypot(ax, az) > .2) { input.aimX = game.player.x + ax * 8; input.aimZ = game.player.z + az * 8; }
      for (const action of Object.keys(controllerState.actions)) if (controllerState.actions[action]) actions[action] = true;
    }
    const len = Math.hypot(x, z); if (len > 1) { x /= len; z /= len; }
    input.x = x; input.z = z;
    for (const a of ['light', 'heavy', 'near', 'dodge', 'heal', 'rage', 'special', 'fourth', 'interact']) { input[a] = !!actions[a]; delete actions[a]; }
    return input;
  }
  /* ───────────── HUD ───────────── */
  // The HUD portrait is a painted adaptation of the real hero's original model portrait.
  // Loading it once avoids a second live GL context and repeated character shader work.
  // `?portrait` still renders the actual model for modelling/framing QA; it is not the painted HUD asset.
  function makePortrait() {
    const canvas = $('hero-portrait'), N = 384, context = canvas.getContext('2d');
    canvas.width = canvas.height = N;
    if (!('filter' in context)) canvas.style.filter = 'contrast(1.1) saturate(.8)';   // browsers without canvas filters keep the old CSS grade
    if (!Q.has('portrait')) {
      const img = new Image();
      // The grade (contrast 1.1, saturation .8) used to be a CSS filter on the canvas: a two-matrix filter surface that the browser built a new drawing program for
      // when the HUD dimmed at the start of the first fight (100-200 ms stall). It is applied once when the picture is drawn instead; the look is the same.
      img.onload = () => { context.clearRect(0, 0, N, N); context.filter = 'contrast(1.1) saturate(.8)'; context.drawImage(img, 0, 0, N, N); context.filter = 'none'; };
      img.src = 'assets/ui/portrait-v47.webp';
      return;
    }
    // Rendered 3x over with MSAA and averaged down; dark ember backdrop, vignette and a light unsharp mask are baked in.
    const R = N * 3, r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(R, R); r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const sc = new THREE.Scene(), model = B.Models.create('hero'), cam = new THREE.PerspectiveCamera(24, 1, .05, 20), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const face = V(0, 2.115, .1);   // head and beard span y 1.92..2.29 of the 2.38 m hero; the medal ring hides the outer edge
    // Punctual lights with no distance falloff and a soft cone: the face and beard stay lit, shoulders and chest fall into shadow.
    const spot = (color, k, at, angle, aim) => { const l = new THREE.SpotLight(color, k, 0, angle, 1, 0); l.position.copy(face).add(V(...at).normalize().multiplyScalar(3)); l.target.position.copy(face).add(V(...(aim || [0, 0, 0]))); sc.add(l, l.target); return l; };
    sc.add(new THREE.HemisphereLight('#b0a8a0', '#3a2620', .2));
    // Profile-leaning view: the camera is on the hero's right, so the nose points to the right of the picture (out of frame).
    const key = spot('#f0d4b8', 6, [-.5, .95, .8], .13, [0, -.02, 0]);   // high, from the front-side: brow shadow over the eye, nose, cheek and the whole beard read
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 6; key.shadow.bias = -.0004; key.shadow.normalBias = .004; key.shadow.radius = 3;
    spot('#ff8a48', 7, [1.3, .55, -.8], .2); spot('#ff9a5a', 2.5, [-1.3, .4, -.9], .2);   // ember rims
    spot('#d8d0d0', .5, [.9, .2, .9], .14, [0, -.03, 0]);   // faint fill: the far side stays in shadow
    spot('#ffe0c0', .8, [-.3, -.4, 1], .12, [0, -.08, 0]);   // soft fill under the chin: the grey of the beard reads
    sc.add(model.root); model.animate(.1, { time: 0, move: 0 }); if (model.bones.head) model.bones.head.rotation.x -= .05; model.root.updateMatrixWorld(true);   // chin slightly down
    // Portrait-only grading of the (shared) hero materials, put back afterwards: an olive-tan weathered skin instead of the
    // game's orange, less plastic shine and stronger pores, no fur mantle behind the head. Thinner alpha cut = fuller hair.
    const undo = [], uni = (u, f) => { const old = u.value.clone(); f(u.value); undo.push(() => u.value.copy(old)); };
    model.root.traverse(o => {
      if (o.name === 'fur' || o.name === 'furfringe' || /^kara-(blade-runes|edge|iron|brass|leather|dark|hero-iron)$/.test(o.material && o.material.name)) o.visible = false;   // weapon out of frame
      const m = o.material, g = m && m.userData && m.userData.grade;
      if (o.name === 'skin' && g) { uni(g.kTint, c => c.setRGB(.8, .76, .62)); uni(g.kScatter, v => v.set(.3, .2, .16)); const old = [g.kSat.value, g.kBlood.value, g.kBump.value, m.specularIntensity]; g.kSat.value = .33; g.kBlood.value = 0; g.kBump.value = 2.2; m.specularIntensity = .3; undo.push(() => { g.kSat.value = old[0]; g.kBlood.value = old[1]; g.kBump.value = old[2]; m.specularIntensity = old[3]; }); }
      if (o.name === 'beard' || o.name === 'moustache') { const a = m.alphaTest; m.alphaTest = o.name === 'beard' ? .02 : .04; undo.push(() => { m.alphaTest = a; }); }
    });
    const tgt = face.clone().add(V(0, -.01, .075)), yaw = -1.05, pit = -.03; cam.position.copy(tgt).add(V(Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit))); cam.up.set(Math.sin(.03), Math.cos(.03), 0); cam.lookAt(tgt);   // a slight head tilt, like a snapshot
    r.render(sc, cam);
    undo.forEach(f => f());
    const big = document.createElement('canvas'); big.width = big.height = R; const bx = big.getContext('2d');
    const bg = bx.createRadialGradient(R * .55, R * .42, R * .05, R * .5, R * .5, R * .75); bg.addColorStop(0, '#4a2118'); bg.addColorStop(.55, '#1e0f0d'); bg.addColorStop(1, '#0a0605');
    bx.fillStyle = bg; bx.fillRect(0, 0, R, R);
    const glow = bx.createRadialGradient(R * .25, R * .4, 0, R * .25, R * .4, R * .5); glow.addColorStop(0, 'rgba(255,110,40,.3)'); glow.addColorStop(1, 'rgba(255,110,40,0)');
    bx.fillStyle = glow; bx.fillRect(0, 0, R, R); bx.drawImage(r.domElement, 0, 0);
    context.imageSmoothingQuality = 'high';
    let cur = big, size = R;
    while (size > N) { size = Math.max(N, size / 2); const c = document.createElement('canvas'); c.width = c.height = size; const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(cur, 0, 0, size, size); cur = c; }
    context.clearRect(0, 0, N, N); context.drawImage(cur, 0, 0, N, N);
    const vig = context.createRadialGradient(N / 2, N / 2, N * .22, N / 2, N / 2, N * .56); vig.addColorStop(0, 'rgba(8,3,2,0)'); vig.addColorStop(1, 'rgba(8,3,2,.9)');
    context.save(); context.translate(N / 2, 0); context.scale(.86, 1); context.translate(-N / 2, 0); context.fillStyle = vig; context.fillRect(-N * .2, 0, N * 1.4, N); context.restore();
    const floor = context.createLinearGradient(0, N * .62, 0, N); floor.addColorStop(0, 'rgba(8,3,2,0)'); floor.addColorStop(1, 'rgba(8,3,2,.8)');   // chest falls away below the beard
    context.fillStyle = floor; context.fillRect(0, 0, N, N);
    // unsharp mask: original + .6 * (original - 4x separable [1 2 1]/4 blur)
    const px = context.getImageData(0, 0, N, N), d = px.data, blur = new Float32Array(N * N * 3), tmp = new Float32Array(N * N * 3);
    for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) blur[i * 3 + k] = d[i * 4 + k];
    for (let pass = 0; pass < 4; pass++) {
      const horizontal = !(pass & 1), step = horizontal ? 3 : N * 3;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 3, lo = (horizontal ? x > 0 : y > 0) ? step : 0, hi = (horizontal ? x < N - 1 : y < N - 1) ? step : 0;
        for (let k = 0; k < 3; k++) tmp[i + k] = .25 * blur[i - lo + k] + .5 * blur[i + k] + .25 * blur[i + hi + k];
      }
      blur.set(tmp);
    }
    for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) d[i * 4 + k] += (d[i * 4 + k] - blur[i * 3 + k]) * .6;
    context.putImageData(px, 0, 0);
    { const g = document.createElement('canvas'); g.width = g.height = N; g.getContext('2d').drawImage(canvas, 0, 0); context.clearRect(0, 0, N, N); context.filter = 'contrast(1.1) saturate(.8)'; context.drawImage(g, 0, 0); context.filter = 'none'; }   // same grade as the painted portrait
    model.dispose(); r.dispose(); r.forceContextLoss();
  }
  function hudText(id, value) {
    const el = $(id), text = String(value);
    if (el.textContent !== text) el.textContent = text;
  }
  function hudTransform(id, value) {
    const el = $(id);
    if (el.style.transform !== value) el.style.transform = value;
  }
  // HUD elements looked up once (re-looked up only if one is replaced).
  const hudEls = {};
  function hq(sel) { let el = hudEls[sel]; if (!el || !el.isConnected) el = hudEls[sel] = document.querySelector(sel); return el; }
  let padButtons = null;
  function padList() {
    if (!padButtons || padButtons.some(b => !b.el.isConnected)) padButtons = Array.from(document.querySelectorAll('.combat-pad .action'), el => ({ el, key: el.dataset.action || el.dataset.hold, progress: '' }));
    return padButtons;
  }
  // Minimap glows: canvas shadowBlur on every dot was the costliest part of the HUD tick, so each glowing mark is drawn
  // once (with the same blur) into a small sprite and stamped with drawImage. The blur is in backing-store pixels,
  // exactly as before; sprites are rebuilt when the backing-store scale changes.
  const MINI_SCALE = 4.6, MINI_BEATS = 6;
  let miniSprites = null, miniSpriteK = 0, miniBg = null, miniBgCtx = null, miniPending = false, miniKey = '';
  try { const mc = document.getElementById('minimap'); if (mc) mc.addEventListener('contextrestored', () => { miniKey = ''; miniBgCtx = null; }); } catch (e) {}
  function miniSprite(pad, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(2, Math.ceil(pad * 2));
    const x = c.getContext('2d', B.uiBitmapOptions); x.translate(c.width / 2, c.height / 2); draw(x); return c;
  }
  function buildMiniSprites(k) {
    const u = MINI_SCALE * k;   // world unit -> backing-store pixels
    const dot = (r, fill, blur) => miniSprite(r * u + blur * 1.6 + 3, x => { x.fillStyle = fill; x.shadowColor = '#ff2a1a'; x.shadowBlur = blur; x.beginPath(); x.arc(0, 0, r * u, 0, Math.PI * 2); x.fill(); });
    const s = { enemy: [], boss: [] };
    for (const [key, r, fill] of [['enemy', .45, '#c8302b'], ['boss', .95, '#ee7a3c']]) {
      s[key + 'Idle'] = dot(r, fill, 3);
      for (let i = 0; i < MINI_BEATS; i++) s[key].push(dot(r, fill, 8 * (.5 + .5 * i / (MINI_BEATS - 1))));
    }
    s.checkpoint = [0, 1].map(i => {
      const fill = i ? '#a8c49a' : '#c2a878';
      return miniSprite(.85 * u + 6 * 1.6 + 3, x => { x.rotate(Math.PI / 4); x.fillStyle = fill; x.shadowColor = fill; x.shadowBlur = 6; x.fillRect(-.6 * u, -.6 * u, 1.2 * u, 1.2 * u); });
    });
    s.quest = [0, 1].map(i => miniSprite(13 * k, x => {
      x.scale(k, k); x.fillStyle = '#17130e'; x.strokeStyle = '#e6c78d'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(0, -9); x.lineTo(8, 0); x.lineTo(0, 9); x.lineTo(-8, 0); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#efdab3'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(i ? 'II' : 'I', 0, .5);
    }));
    s.hero = miniSprite(1.35 * u + 8 * 1.6 + 3, x => {
      x.scale(u, u); x.fillStyle = '#f3e3c3'; x.shadowColor = '#f0c27a'; x.shadowBlur = 8;
      x.beginPath(); x.moveTo(0, 1.3); x.lineTo(-.85, -.8); x.lineTo(0, -.42); x.lineTo(.85, -.8); x.closePath(); x.fill();
    });
    return s;
  }
  function stamp(x, sprite, sx, sy, rot) {
    // (sx, sy) on the 256 grid; the sprite is drawn 1:1 in backing-store pixels.
    const k = miniSpriteK, w = sprite.width, h = sprite.height;
    if (rot) { x.setTransform(Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), sx * k, sy * k); x.drawImage(sprite, -w / 2, -h / 2); x.setTransform(1, 0, 0, 1, 0, 0); }
    else x.drawImage(sprite, Math.round(sx * k - w / 2), Math.round(sy * k - h / 2));
  }
  // The HUD tick only asks for a redraw; the map is drawn on the next animation frame so it does not add to the
  // frame that already carries the rest of the HUD update, and it is skipped when nothing on it moved.
  function drawMinimap() {
    if (miniPending) return; miniPending = true;
    requestAnimationFrame(() => { miniPending = false; try { drawMinimapNow(game.player); } catch (e) { console.warn('[Kabir Azabı] minimap', e); } });
  }
  function drawMinimapNow(p) {
    const c = $('minimap'), x = c.getContext('2d', B.uiBitmapOptions), scale = MINI_SCALE, cx = 128, cy = 140, k = c.width / 256;
    const beat = .75 + Math.sin(elapsed * 6) * .25, beatIndex = clamp(Math.round((beat - .5) / .5 * (MINI_BEATS - 1)), 0, MINI_BEATS - 1);
    const here = world.roomAt(p.x, p.z);
    let key = c.width + '|' + Math.round(p.x * 40) + ',' + Math.round(p.z * 40) + ',' + Math.round(p.face * 200) + '|' + (here ? world.rooms.indexOf(here) : -1) + '|' + (game.checkpointIndex ? 1 : 0), anyActive = false;
    for (const e of game.enemies) {
      if (e.dead || Math.hypot(e.x - p.x, e.z - p.z) > 23) continue;
      key += '|' + Math.round(e.x * 40) + ',' + Math.round(e.z * 40) + (e.boss ? 'B' : '') + (e.active ? 'a' : '');
      if (e.active) anyActive = true;
    }
    if (game.quests) key += '|q' + game.quests.revision;
    if (anyActive) key += '|b' + beatIndex;
    if (key === miniKey) return;
    miniKey = key;
    if (!miniSprites || miniSpriteK !== k) { miniSpriteK = k; miniSprites = buildMiniSprites(k); }
    x.setTransform(k, 0, 0, k, 0, 0);   // drawn on a 256 grid, backing store may be larger (sharper on Retina)
    x.clearRect(0, 0, 256, 256);
    if (miniBgCtx !== x) { miniBgCtx = x; miniBg = x.createRadialGradient(128, 128, 20, 128, 128, 140); miniBg.addColorStop(0, '#1a1615'); miniBg.addColorStop(1, '#070606'); }
    x.fillStyle = miniBg; x.fillRect(0, 0, 256, 256);
    x.save(); x.translate(cx, cy); x.scale(scale, scale); x.translate(-p.x, -p.z);
    x.strokeStyle = '#3a302a'; x.lineWidth = 6.8; x.lineCap = 'round'; x.beginPath();
    world.paths.forEach(path => { x.moveTo(path.a.x,path.a.z);x.lineTo(path.b.x,path.b.z); }); x.stroke();
    for (const r of world.rooms) {
      x.fillStyle = here === r ? '#4a3a2e' : '#2a2320'; x.fillRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
      x.strokeStyle = here === r ? '#d0ae7a' : '#65574a'; x.lineWidth = here === r ? .5 : .32; x.strokeRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
    }
    x.fillStyle = '#0b0909';
    for (const r of world.colliders) if (Math.abs(r.z - p.z) < 35 && Math.abs(r.x - p.x) < 35) x.fillRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
    x.restore();
    x.setTransform(1, 0, 0, 1, 0, 0);
    const sx = wx => cx + (wx - p.x) * scale, sy = wz => cy + (wz - p.z) * scale;
    const cp = world.checkpoint;
    stamp(x, miniSprites.checkpoint[game.checkpointIndex ? 1 : 0], sx(cp.x), sy(cp.z));
    for (const e of game.enemies) {
      if (e.dead || Math.hypot(e.x - p.x, e.z - p.z) > 23) continue;
      const set = e.boss ? 'boss' : 'enemy';
      stamp(x, e.active ? miniSprites[set][beatIndex] : miniSprites[set + 'Idle'], sx(e.x), sy(e.z));
    }
    if (game.quests) for (let qi = 0; qi < game.quests.entries.length; qi++) {
      const goal = game.quests.entries[qi].target; if (!goal) continue;
      // Targets outside the small map remain as an edge marker. No full-screen map is needed.
      let dx = (goal.x - p.x) * scale, dz = (goal.z - p.z) * scale;
      const length = Math.hypot(dx, dz); if (length > 91) { dx *= 91 / length; dz *= 91 / length; }
      stamp(x, miniSprites.quest[qi], cx + dx, cy + dz);
    }
    stamp(x, miniSprites.hero, sx(p.x), sy(p.z), -p.face);
  }
  // Each minimap glow is a small canvas whose blur only runs (and the browser only builds its blur program) the first time that sprite is drawn:
  // 6 pulse sizes + idle + boss + checkpoint + hero, so the first active enemy beat stalled the fight for up to 300 ms. Draw each once while the cover is up.
  function warmMiniSprites() {
    const c = $('minimap'); if (!c) return;
    const x = c.getContext('2d', B.uiBitmapOptions), k = c.width / 256;
    if (!miniSprites || miniSpriteK !== k) { miniSpriteK = k; miniSprites = buildMiniSprites(k); }
    const list = [...miniSprites.enemy, ...miniSprites.boss, miniSprites.enemyIdle, miniSprites.bossIdle, ...miniSprites.checkpoint, ...miniSprites.quest, miniSprites.hero];
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    list.forEach((sprite, i) => stamp(x, sprite, 30 + (i % 8) * 28, 40 + Math.floor(i / 8) * 40, i % 2 ? .4 : 0));
    miniKey = '';
  }
  function updateOverview() {
    const p = game.player, total = game.totalKills || game.enemies.length;
    let kills = 0; for (const e of game.enemies) if (e.dead && !e.reserve) kills++;
    const story = game.quests;
    hudText('kill-progress', story ? story.completed + ' / 2 bağ çözüldü' : kills + ' / ' + total);
    if (questUI) questUI.update();

    hq('.hero-card').classList.toggle('sealed', !!game.checkpointIndex);
    hq('.flask-button').classList.toggle('empty', p.flasks === 0);
    const selectedSkills = game.skills();
    for (const pad of padList()) {
      const b = pad.el, key = pad.key;
      const skillSlot=key==='heavy'?0:key==='special'?1:key==='rage'?2:key==='fourth'?3:-1, chosen=skillSlot>=0?selectedSkills[skillSlot]:null;
      // A slot is lit while ITS skill runs (any slot can hold any line); the roar stays lit for its whole fury.
      const active = chosen && chosen.id ? (chosen.line === 'roar' ? cryEffect.remaining > 0 || !!p.roar : !!(p.attack && p.attack.skill === chosen.id)) : key === 'light' ? p.attack && !p.attack.heavy : key === 'dodge' ? p.dodge > 0 : false;
      b.classList.toggle('pressed', !!active);
      const cost = chosen ? chosen.cost : B.Game.resources.costs[key];
      b.classList.toggle('unavailable', cost > 0 && p.stamina < cost && !active);
      if (key === 'light' || key === 'heavy') {
        const progress = String(active && p.attack ? clamp(p.attack.age / p.attack.duration, 0, 1) : 0);
        if (progress !== pad.progress) { pad.progress = progress; b.style.setProperty('--progress', progress); }
      }
    }
    drawMinimap(p);
  }
  function formatObjective(text) { return text.replace(/\. (?=\S)/, '.\n'); }
  // The two story threads replace the old kill quota. Boss combat keeps its own clear goal.
  function gateObjective(room) {
    const gt = game.gate, story = game.quests;
    if (!gt || game.state === 'won' || !game.boss || game.boss.dead) return null;
    if (room && room.id === gt.room) return gt.bossName + ' — bu bölümün son bağını kır.';
    if (story) return gt.open ? 'Kapı açıldı. ' + gt.bossName + ' seni bekliyor.' : story.objective;
    return null;
  }
  function chapterObjective(room) {
    const gateText = gateObjective(room); if (gateText) return gateText;
    if(chapter < 3 && room && room.id >= 7){const n=game.enemies.filter(e=>!e.dead&&e.encounter.room===room.id).length;return n?'Bu yan alanda '+n+' düşman var.':'Alan temizlendi. Ana yola geri dön.';}
    if(forgeChapter){if(game.state==='won')return 'Ocak söndü. Zincirlerin kaynağı yok oldu.';if(!room)return 'Dökümhanenin içinden kuzeye ilerle.';if(room.id===11)return game.checkpointIndex?'Köz Yemini mühürlendi. Son Döküm’e ilerle.':'Köz Yemini taşına yaklaş ve '+capName(binds.interact[0])+' ile dokun.';if(room.id===13)return 'Ocağın Kalbi’ni yen. Kızgın halkalardaki boşlukları kullan.';const n=game.enemies.filter(e=>!e.dead&&e.encounter.room===room.id).length;return n?'Bu alanda '+n+' düşman var.':'Kuzeydeki döküm salonuna ilerle.';}
    if(ruinsChapter){if(game.state==='won')return 'Taht yıkıldı. Kralın sesi sustu.';if(!room)return 'Harabelerin içinden kuzeye ilerle.';if(room.id===11)return game.checkpointIndex?'Son yemin mühürlendi. Tahtın nöbetini aş.':'Son Yemin taşına yaklaş ve '+capName(binds.interact[0])+' ile dokun.';if(room.id===13)return 'Oyukların Kralı’nı yen. Taş halkalarının güvenli boşluklarını bul.';const n=game.enemies.filter(e=>!e.dead&&e.encounter.room===room.id).length;return n?'Bu alanda '+n+' düşman var.':room.id===5?'Yıkılmış anıtın altından mağaraya gir.':'Kuzeydeki geçide ilerle.';}
    if (coastChapter) {
      if (game.state === 'won') return 'Çan sustu. Kara Kıyı özgür.';
      if (!room) return 'Kıyının kuzeyine ilerle.';
      if (room.id === 5) return game.checkpointIndex ? 'Yeminin mühürlendi. Çanlığa ilerle.' : 'Fenerin yemin taşına yaklaş ve ' + capName(binds.interact[0]) + ' ile dokun.';
      if (room.id === 6) return 'Derinliklerin Çancısı’nı yen. Deniz halkalarının boşluklarını kullan.';
      const n = game.enemies.filter(e => !e.dead && e.encounter.room === room.id).length;
      return n ? 'Bu alanda ' + n + ' düşman var. Savaş veya kuzeye ilerle.' : room.id === 4 ? 'Son Fener’in yemin taşını bul.' : 'Kuzeydeki patikaya ilerle.';
    }
    if (game.state === 'won') return 'Geçit açıldı. Kurban Tapınağı sustu.';
    if (!room) return 'Kuzeydeki salona ilerle.';
    const idx = room.id;
    if (idx === 5) return game.checkpointIndex ? 'Yeminin mühürlendi. Zincir Mahkemesi’ne ilerle.' : 'Yemin taşına yaklaş ve ' + capName(binds.interact[0]) + ' ile dokun.';
    if (idx === 6) {
      const boss = game.boss || game.enemies.find(e => e.boss);
      return boss && boss.phase === 2 ? 'Zincirler kırıldı. Celladın kızıl darbelerinden kaçın.' : 'Zincir Celladı’nı yen. Tapınağın geçidini aç.';
    }
    let remaining = 0;
    for (const e of game.enemies) if (!e.dead && e.encounter && e.encounter.room === idx) remaining++;
    if (remaining) return 'Bu salonda ' + remaining + ' düşman var. Savaş veya kuzeye ilerle.';
    return idx === 4 ? 'Şapeldeki yemin taşını bul.' : 'Kuzeydeki salona ilerle.';
  }
  let mechanicRecord = null, mechanicRevision = -1;
  function updateMechanic() {
    const info = game.bossMechanic, box = hq('#boss-mechanic');
    const active = !!(info && info.active && !game.player.dead && game.state === 'playing');
    box.classList.toggle('hidden', !active);
    if (!active) return;
    if (mechanicRecord !== info || mechanicRevision !== info.revision) {
      mechanicRecord = info; mechanicRevision = info.revision;
      hudText('boss-mechanic-title', info.title);
      hudText('boss-mechanic-instruction', info.instruction);
      box.dataset.kind = info.kind;
    }
    box.classList.toggle('safe', info.safe);
    box.classList.toggle('timed', info.duration > 0);
    // A fixed-width transform, quantized to 1%, avoids a layout/text update every frame.
    hudTransform('boss-mechanic-progress', 'scaleX(' + Math.round(clamp(1 - info.progress, 0, 1) * 100) / 100 + ')');
  }
  function hud(dt) {
    const p = game.player;
    const progression = game.progression, thresholds = B.Progression.thresholds, baseXp = thresholds[progression.level - 1], nextXp = progression.nextLevelXp();
    hudText('hero-subtitle', 'Seviye ' + progression.level);
    const seal = hq('.portrait-seal'), levelText = String(progression.level);
    if (seal.textContent !== levelText) seal.textContent = levelText;
    const xpFraction = progression.level === B.Progression.MAX_LEVEL ? 1 : clamp((progression.xp - baseXp) / (nextXp - baseXp), 0, 1);
    hudTransform('chapter-progress', `scaleX(${xpFraction})`);
    const xpBar = hq('.chapter-progress');
    const xpValue = String(Math.round(xpFraction * 100));
    if (xpBar.getAttribute('aria-valuenow') !== xpValue) xpBar.setAttribute('aria-valuenow', xpValue);
    const xpTitle = progression.level === B.Progression.MAX_LEVEL ? 'En yüksek seviye' : (progression.xp - baseXp) + ' / ' + (nextXp - baseXp) + ' tecrübe';
    if (xpBar.title !== xpTitle) xpBar.title = xpTitle;
    cryEffect.remaining = !p.dead && game.state === 'playing' ? p.rageTime || 0 : 0; if (p.rageMax > 0) cryEffect.duration = p.rageMax;
    buffUI.update(timedEffects);
    let buffCount = 0;
    for (const effect of timedEffects) if (Number.isFinite(effect.remaining) && effect.remaining > 0) buffCount++;
    const buffRows = Math.ceil(buffCount / 3);
    if (buffRows !== lastBuffRows) { lastBuffRows = buffRows; $('hud').style.setProperty('--buff-rows', buffRows); }
    const hp = clamp(p.hp / p.maxHp, 0, 1);
    hudText('health-number', Math.ceil(Math.max(0, p.hp))); hudText('health-max', '/ ' + Math.round(p.maxHp));
    if (B.HUD) B.HUD.vitals(p, dt);   // liquid health and stamina orbs (src/hud.js)
    const orb = hq('.health-orb');
    orb.classList.toggle('low', hp < .3); document.body.classList.toggle('low-hp', hp < .3 && !p.dead);
    if (lastHp !== null && p.hp < lastHp - .5) tap(orb);
    if (lastHp !== null && p.hp > lastHp + 3) { orb.classList.remove('healed'); void orb.offsetWidth; orb.classList.add('healed'); }
    lastHp = p.hp;
    hq('.stamina-orb').classList.toggle('winded', p.stamina < 25);
    const flaskBtn = hq('.flask-button');
    if (lastFlasks !== null && p.flasks !== lastFlasks) tap(flaskBtn);
    lastFlasks = p.flasks; hudText('flask-count', p.flasks ?? 0);
    const rageBtn = hq('.action-rage');
    document.body.classList.toggle('raging', cryEffect.remaining > 0);
    updateOverview();
    if (B.HUD && B.HUD.skills) B.HUD.skills(p, dt, game.skills());   // cooldown sweeps, stamina cost hints (src/hud.js)
    const targetEnemy = !p.dead && game.state === 'playing' ? game.attackTarget || game.enemies.find(e => e.boss && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 28) : null;
    targetUI.update(targetEnemy);
    updateMechanic();
    const r = world.roomAt(p.x, p.z);
    if (r) hudText('objective', formatObjective(chapterObjective(r)));
    if (r && r.id !== roomId) {
      roomId = r.id; $('location').textContent = r.name;
      const idx = typeof r.id === 'number' ? r.id : world.rooms.indexOf(r);
      if (B.Audio.say && chapter < 3 && idx > 0 && idx < 7) B.Audio.say((coastChapter ? ['coastIntro', 'coastRoots', 'coastStreet', 'coastPier', 'coastSquare', 'coastCheckpoint', 'coastBoss'] : ['intro', 'chains', 'ritual', 'crypt', 'rot', 'checkpoint', 'boss'])[Math.min(6, idx)]);
    }
    // Same reach as the stone's own auto-seal (combat.js): the button shows when enemies still keep it from sealing.
    const cp = world.checkpoint, near = cp && Math.hypot(p.x - cp.x, p.z - cp.z) < 6.1 && game.checkpointIndex === 0;
    const prompt = game.quests && game.quests.prompt;
    $('interact').classList.toggle('hidden', !near && !prompt);
    hudText('interact-label', prompt ? prompt.text : 'Yemin taşına dokun');
    if (questUI) questUI.update(dt);
    if (firstHint > 0) { firstHint -= dt; if (firstHint <= 0) $('tutorial').classList.add('hidden'); }
    if (game.state === 'dead') death(game.lastDeath || {});
    if (game.state === 'won') victory();
  }

  /* ───────────── Camera ───────────── */
  const occlusionRay = new THREE.Raycaster(), rayDir = new THREE.Vector3(), eyePoint = new THREE.Vector3(), occlusionHits = [], occlusionBlocked = new Set();
  // Title shot: over the father's shoulder, looking down into the temple. (QA: &tc=x,y,z,lookX,lookY,lookZ)
  const TITLE_CAM = (Q.get('tc') || '-2.7,2.0,5.2,.55,1.75,-6').split(',').map(Number);
  const BASE_FOV = 43;
  const CAM_NEAR = Q.has('cam') ? clamp(+Q.get('cam') || 1, .5, 1.5) : .78;
  function cameraStep(dt) {
    const p = game.player;
    if (view === 'title') {
      const s = world.spawn, sway = reducedMotion.matches ? 0 : Math.sin(elapsed * .09);
      const narrow = innerWidth / innerHeight < 1.1;
      target.set(s.x + (narrow ? .6 : TITLE_CAM[0]) + sway * .25, TITLE_CAM[1] + sway * .08, s.z + TITLE_CAM[2] + (narrow ? 1.6 : 0));
      cameraPos.lerp(target, 1 - Math.exp(-dt * 2));
      target.set(s.x + (narrow ? 0 : TITLE_CAM[3]), TITLE_CAM[4], s.z + TITLE_CAM[5]); look.lerp(target, 1 - Math.exp(-dt * 2));
    } else {
      const touch = touchDevice(), wide = innerWidth / innerHeight < .85;
      // A modest look-ahead keeps the hero's approach visible without zooming or snapping when an attack begins.
      const lead = reducedMotion.matches ? 0 : p.move > .1 ? .55 : .18;
      target.set(Math.sin(p.face) * lead, 0, Math.cos(p.face) * lead);
      cameraLead.lerp(target, 1 - Math.exp(-dt * 3));
      const push = ragePush > 0 ? Math.sin(Math.min(1, (1 - ragePush) / .18) * Math.PI / 2) * Math.min(1, ragePush / .6) : 0, near = 1 - .17 * push - (B.LevelUp ? B.LevelUp.push() : 0) - (B.Charge && B.Charge.cameraPush ? B.Charge.cameraPush() : 0) - (B.SkillFx ? B.SkillFx.push() : 0);
      target.set(p.x + cameraLead.x, (wide ? 19 : touch ? 15.6 : 13.8) * CAM_NEAR * near, p.z + (wide ? 16 : 11.4) * CAM_NEAR * near + cameraLead.z);   // (parent: closer to the hero; CAM_NEAR .78 = 22 % nearer, ?cam=1 restores the old distance)
      lookTarget.set(p.x + cameraLead.x, .7, p.z - .8 + cameraLead.z);
      if (introBlend < 1) {
        // Time-based (not frame-based) so the swoop always ends 1.1 s after the start, even at low frame rates.
        introBlend = clamp((performance.now() - introStart) / 1100, 0, 1);
        const e = introBlend * introBlend * (3 - 2 * introBlend);
        cameraPos.lerpVectors(introFrom, target, e); look.lerpVectors(introLook, lookTarget, e);
      } else {
        cameraPos.lerp(target, 1 - Math.exp(-dt * 10)); look.lerp(lookTarget, 1 - Math.exp(-dt * 12));
      }
    }
    // Damped directional recoil replaces unrelated random jumps every frame.
    const springDt = Math.min(dt, .033);
    cameraKick.vx += (-cameraKick.x * 125 - cameraKick.vx * 18) * springDt;
    cameraKick.vz += (-cameraKick.z * 125 - cameraKick.vz * 18) * springDt;
    cameraKick.x += cameraKick.vx * springDt; cameraKick.z += cameraKick.vz * springDt;
    camera.position.copy(cameraPos);
    const abFx = view === 'title' || !rig.cameraFx ? null : rig.cameraFx(dt, game, reducedMotion.matches ? 0 : cfg.shake);   // special ability: sway, kicks, FOV punch (lighting.js)
    if (abFx) { cameraKick.vx += abFx.ix; cameraKick.vz += abFx.iz; }
    if (!reducedMotion.matches) {
      const k = shake * cfg.shake;
      camera.position.x += cameraKick.x * cfg.shake + Math.sin(elapsed * 39) * k * .18;
      camera.position.z += cameraKick.z * cfg.shake + Math.sin(elapsed * 31 + 1.7) * k * .12;
      if (abFx) { camera.position.x += abFx.x * cfg.shake; camera.position.y += abFx.y * cfg.shake; camera.position.z += abFx.z * cfg.shake; }
    }
    camera.lookAt(look);
    if (world.occluders && view !== 'title') {
      eyePoint.set(p.x, 1.25, p.z); rayDir.subVectors(eyePoint, camera.position);
      const distance = rayDir.length(); occlusionRay.set(camera.position, rayDir.normalize()); occlusionRay.far = distance - .2;
      const blocked = occlusionBlocked; blocked.clear(); occlusionHits.length = 0;
      occlusionRay.intersectObjects(world.occluders, false, occlusionHits);
      for (const hit of occlusionHits) blocked.add(hit.object);
      for (const m of world.occluders) { const targetAlpha = blocked.has(m) ? .1 : 1; m.material.opacity += (targetAlpha - m.material.opacity) * (1 - Math.exp(-dt * 14)); m.material.depthWrite = m.material.opacity > .98; }
    }
    shake = Math.max(0, shake - dt * .9); ragePush = Math.max(0, ragePush - dt / 1.3);
    rig.follow(p);
  }
  // Per-room light design, fog, mist and grade (lighting.js); eased so doorways blend.
  function atmosphereStep(dt) { rig.update(dt, elapsed, game, view); }
  function footstepFeedback() {
    const footfall = game.player.model.root.userData.footfall;
    if (Number.isFinite(game.resetSerial) && game.resetSerial !== lastFootfallReset) { lastFootfallReset = game.resetSerial; lastFootfall = 0; }
    if (!footfall || footfall.serial === lastFootfall) return;
    lastFootfall = footfall.serial;
    if (game.player.dead) return;
    const landing = footfall.kind === 'roll' || footfall.kind === 'dodge';
    B.Audio.play('step', { volume: landing ? .65 : .38 });
    fx('footstep', { x: footfall.x, z: footfall.z, y: .045, heavy: landing });
  }

  /* ───────────── Frame loop ───────────── */
  // Measurements are session-only and off by default. No GPU queries while the meter is hidden.
  function resetPerformance() {
    fpsStart = fpsFrames = 0; fpsGaps.fill(0); fpsGapLast = 0;
    performanceMeter.reset();
    if (post && post.resetTiming) post.resetTiming();
  }
  function readGraphicsAdapter() {
    if (graphicsAdapter) return graphicsAdapter;
    const gl = renderer.getContext();
    graphicsAdapter = { renderer: null, vendor: null, unmasked: false };
    safe(() => {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      graphicsAdapter.renderer = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
      graphicsAdapter.vendor = gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
      graphicsAdapter.unmasked = !!ext;
    });
    return graphicsAdapter;
  }
  function performanceReport() {
    return { schema: 4, game: 'Kabir Azabı', build: BUILD_TAG, capturedAt: new Date().toISOString(), view,
      location: { room: world.rooms?.[roomId]?.name || roomId, x: game.player.x, z: game.player.z },
      display: { width: post.width, height: post.height, windowWidth: innerWidth, windowHeight: innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1, renderPixelRatio: renderer.getPixelRatio() },
      settings: { quality: cfg.quality, displayMode: cfg.displayMode, displayScale: displayPlan?.scale, edgeSmoothing: 'smaa-1x', smaa: post.smaa, frameLimit: cfg.fps },
      adapter: readGraphicsAdapter(), ...performanceMeter.report(),
      gpu: { available: post.timingAvailable, enabled: post.timingEnabled, ready: post.timingReady,
        error: post.timingError, sampleIntervalMs: post.timingSampleIntervalMs, milliseconds: post.gpuSections },
      rendering: { ...renderer.info.render, multiDraw, worldSubmission, programs: renderer.info.programs.length,
        memory: { ...renderer.info.memory }, lastFrame: { ...post.frameResources },
        uiBitmaps: B.uiBitmapOptions?.willReadFrequently ? 'software' : 'browser-default',
        shaderPreparation: B.Lighting.shaderPreparation },
      loading: warmStats,
      audio: B.Audio.diagnostics(),
      measurementScope: 'CPU samples describe the JavaScript and draw submission of presented callbacks; callbacks skipped by the Mac frame cap are not included in CPU stages. GPU scene includes shadows; GPU post includes AO, bloom and composition. GPU excludes HUD contexts and screen presentation. CPU and GPU run concurrently; do not add their times.' };
  }
  // Gaps between presented frames (last ~600), so the counter can also show the longest frame: a few slow frames are
  // what the eye reads as stutter even when the FPS average looks fine.
  const BUILD_TAG = 148, fpsGaps = new Float32Array(600);
  let fpsGapAt = 0, fpsGapLast = 0;
  function frameStats() {
    let longest = 0, slow = 0;
    for (let i = 0; i < fpsGaps.length; i++) { const g = fpsGaps[i]; if (g > longest) longest = g; if (g > 12) slow++; }
    return { longestMs: Math.round(longest), over12Ms: slow, build: BUILD_TAG, width: post.width, height: post.height, frameLimit: cfg.fps };
  }
  function drawFps(fps) {
    // Player-facing: only the frame rate and the render resolution. Long-frame counters stay in B.app.frameStats() (or add ?perf to the URL to print them).
    const rate = Number.isFinite(fps) ? `${Math.round(fps)} FPS` : 'FPS ölçülüyor…';
    let text = `${rate}\n${post.width} × ${post.height}`;
    if (Q.has('perf')) { const s = frameStats(); text += `\nen uzun kare ${s.longestMs} ms · 12 ms üstü ${s.over12Ms} · v${s.build}`; }
    $('fps-values').textContent = text;
  }
  function fpsTick(ts) {
    if (!cfg.showFps) return;
    if (fpsGapLast) { fpsGaps[fpsGapAt] = ts - fpsGapLast; fpsGapAt = (fpsGapAt + 1) % fpsGaps.length; }
    fpsGapLast = ts;
    if (!fpsStart) { fpsStart = ts; fpsFrames = 0; return; }
    fpsFrames++;
    const span = ts - fpsStart;
    if (span < 500) return;
    drawFps(fpsFrames * 1000 / span);
    fpsStart = ts; fpsFrames = 0;
  }
  function loop(ts) { requestAnimationFrame(loop); frameStep(ts); }
  function frameStep(ts) {
    if (!ready) return;
    if (graphicsLost || graphicsRecovering) { last = ts; visualDt = 0; return; }
    // The loading cover hides combat. Keep it paused until prepared graphics can
    // be seen, while settings/menu audio continues to follow its own pause state.
    if (warming && view === 'playing') show('pause');
    const measured = cfg.showFps || Q.has('gpums');
    scaler.callback(ts);
    if (measured) performanceMeter.callback(ts);
    // Limit the WHOLE expensive tick, not only WebGL submission. Otherwise a
    // 240/360 Hz display still runs AI, collisions, audio and HUD at 240/360 Hz
    // under a 60/120 FPS cap, and menus keep doing that work under a 30 FPS cap.
    // Do not advance `last` on skipped callbacks: their time and queued input
    // belong to the next tick. Unlimited remains explicitly unlimited.
    const calmIdle = calmSince !== 0 && ts - calmSince > 2500 && (cfg.fps === 0 || cfg.fps > 60);
    const frameDue = renderClock.due(ts, paused ? (view === 'title' ? (cfg.fps ? Math.min(cfg.fps, 60) : 60) : Math.min(cfg.fps || 30, 30)) : calmIdle ? 60 : cfg.fps);
    if (!frameDue) return;
    const cpuStart = measured ? performance.now() : 0;
    const dt = clamp((ts - (last || ts)) / 1000, 0, .05); last = ts; elapsed += dt; frame++;
    visualDt = Math.min(.1, visualDt + dt);
    // Draw rate by situation (CPU/fan): menus 30 (as before), the title screen 60, and a hero who has stood still for 2.5 s with no foe awake
    // nearby 60 (nothing moves, the screen is static); everything else keeps the configured rate (120 locked). Input or a foe restores it at once.
    const drawing = !warming;
    game.drawing = drawing;
    // Controllers keep polling on every menu too, so reconnect, remapping and navigation never depend on combat.
    controllerState = controller ? controller.poll(dt) : null;
    if (B.LevelUp) B.LevelUp.step(dt);   // level-up screen layer: banner timeline, edge flash / colour fringe via Post.setAbilityFx (real time)
    const playing = view === 'playing' && game.state === 'playing';
    if (playing) {
      if (heldLight || keyDown('light') || controllerState?.lightHeld) { lightRepeat += dt; if (lightRepeat >= .12) { actions.light = true; if (heldLight) actions.near = true; lightRepeat = 0; } }
      const stopped = Math.min(dt, hitPause), simDt = (dt - stopped) * (B.LevelUp ? B.LevelUp.timeScale() : 1) * (B.Charge && B.Charge.timeScale ? B.Charge.timeScale() : 1) * (B.SkillFx ? B.SkillFx.timeScale() : 1); hitPause -= stopped;
      // Input events remain queued during contact emphasis; all combat clocks share simDt
      // so neither enemies nor i-frames gain a hidden time advantage.
      if (simDt > .000001) { const inp = pollInput(); if (view === 'playing') { game.update(simDt, inp); fxStep(simDt); footstepFeedback(); } }
      hudTimer += dt; if (hudTimer > .08) { hud(hudTimer); hudTimer = 0; }
    }
    else if ((game.state === 'dead' || game.state === 'won') && view === 'playing') { game.update(dt, { ...input, x: 0, z: 0, light: false, heavy: false, clickLight: false, clickHeavy: false, holdLight: false, holdHeavy: false, target: null, dodge: false, heal: false, rage: false }); fxStep(dt); }

    if (announceTimer > 0) { announceTimer -= dt; if (announceTimer <= 0) $('announcement').classList.remove('show'); }
    if (levelUpTimer > 0 && view === 'playing') { levelUpTimer -= dt; if (levelUpTimer <= 0) $('level-up').classList.remove('show'); }
    flash = Math.max(0, flash - dt * 1.7);
    syncWarnings(dt);
    const fighting = game.enemies.some(e => !e.dead && e.active && Math.hypot(e.x - game.player.x, e.z - game.player.z) < 10);
    {
      const pl = game.player, still = view === 'playing' && game.state === 'playing' && !fighting && !input.x && !input.z && !input.target
        && Math.hypot(pl.x - calmX, pl.z - calmZ) < .02;
      calmX = pl.x; calmZ = pl.z;
      if (!still) calmSince = 0; else if (!calmSince) calmSince = ts;
    }
    if (fighting) announceTimer = Math.min(announceTimer, .35);
    if (fighting && firstHint > 0) { $('tutorial').classList.add('hidden'); firstHint = 0; }
    B.Audio.update(dt, { playing: view === 'playing' && game.state === 'playing', combat: fighting, boss: game.enemies.some(e => e.boss && !e.dead && Math.hypot(e.x - game.player.x, e.z - game.player.z) < 25) });
    const simulationEnd = measured ? performance.now() : 0;
    // While new shader programs compile in the background the last frame stays on screen (drawing would block the page).
    if (drawing) {
      // A size change clears the browser canvas. Apply it before drawing the
      // visible frame, so a completed frame is never erased before presentation.
      // Automatic resolution: only while really playing, and never on 120 Hz-class targets (see Display.createScaler).
      const scaling = AUTO_SCALE && view === 'playing' && game.state === 'playing' && !paused && !warming && document.visibilityState === 'visible';
      if (scaling) {
        // Prediction: three or more awake enemies close by (or the boss) means a heavy frame is coming; step down now.
        let near = 0, boss = false;
        for (const e of game.enemies) { if (e.dead || !e.active) continue; const d = Math.hypot(e.x - game.player.x, e.z - game.player.z); if (d < 16) near++; if (e.boss && d < 30) boss = true; }
        if (near >= 6) scaler.hint(3, ts, 4000); else if (near >= 3 || boss) scaler.hint(2, ts, 4000); else if (near >= 2) scaler.hint(1, ts, 3000);
      }
      const stepped = scaler.frame(ts, cfg.fps, scaling);
      if (stepped !== null) {
        cfg.dynScale = stepped; resize();
      }
      // Simulation and input above keep their clocks. Prepare the visible frame
      // once, using all time since the last draw, even on a faster-refresh screen.
      const drawDt = visualDt; visualDt = 0;
      if (view === 'title') {
        game.player.model.animate(drawDt, { time: elapsed, move: 0 });
        // Only the foes the title shot can show (or throw a shadow into) are posed; the rest of the dungeon stays still.
        titleMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); titleFrustum.setFromProjectionMatrix(titleMatrix);
        for (const e of game.enemies) {
          if (e.dead) continue;
          titleSphere.center.set(e.x, 1.2, e.z);
          if (Math.hypot(e.x - camera.position.x, e.z - camera.position.z) < 48 && titleFrustum.intersectsSphere(titleSphere)) e.model.animate(drawDt, { time: elapsed, move: 0 });
        }
      }
      world.update(paused ? drawDt * .35 : drawDt, elapsed, game.player); cameraStep(drawDt); atmosphereStep(drawDt);
      // Three updates the scene and camera matrices inside render; a separate
      // complete scene walk here would repeat the same work.
      const presentationEnd = measured ? performance.now() : 0;
      overlayStep(ts);
      // Cut limb pieces are created at the killing blow; give them their body's (already compiled) shadow material
      // before their first shadow draw, otherwise Three's shared depth material compiles a new variant mid-fight.
      if (!limbRoot && ts - limbLookup > 1000) { limbLookup = ts; scene.traverse(o => { if (!limbRoot && o.isGroup && o.name === 'limbs' && o.parent && o.parent.parent === scene) limbRoot = o; }); }
      if (limbRoot) assignDepthMaterials(limbRoot);
      game.beginRenderTraversal();
      try { renderer.info.reset(); post.render(elapsed); }
      finally { game.endRenderTraversal(); }
      const submissionEnd = measured ? performance.now() : 0;
      document.body.classList.toggle('in-combat', fighting && view === 'playing');
      drawWarnings();
      if (view === 'playing' && B.HUD && B.HUD.frame) B.HUD.frame(drawDt);
      if (measured) {
        const cpuEnd = performance.now();
        performanceMeter.record(ts, { simulation: simulationEnd - cpuStart, presentation: presentationEnd - simulationEnd,
          submission: submissionEnd - presentationEnd, hud: cpuEnd - submissionEnd, total: cpuEnd - cpuStart, ...post.cpuSections },
          { view, room: roomId, x: game.player.x, z: game.player.z, combat: fighting, hitPause, ...post.frameResources });
      }
      fpsTick(ts);
    }
  }

  /* ───────────── Shader warm-up ───────────── */
  // Compiling ~130 lit, skinned and graded programs takes seconds on some GPUs, and a draw that needs an unfinished
  // program blocks the page. So before the title appears (and after a preset change) every program is started in
  // small batches with a painted frame between them (the browser compiles in parallel where it can:
  // KHR_parallel_shader_compile), then the big textures are uploaded a few per frame. The bar follows the work.
  let warming = null, lowTextures = false, warmStats = null;
  // Each batch waits for its new programs before starting another. Keep the
  // default small so a many-core PC does not receive a large compile burst.
  const WARM_BATCH = Math.floor(clamp(+(Q.get('warmbatch') || 8) || 8, 1, 32)), WARM_LOG = Q.has('warmlog'), WARM_SYNC = /HeadlessChrome/.test(navigator.userAgent) && !Q.has('warm');
  // The shadow pass clones ONE depth material per source material and then reuses it for skinned, instanced and plain casters alike,
  // so it switched programs on every change of caster type. Give each (material, caster type) pair its own depth material instead.
  // Meshes that only start casting later (shadow LOD, effects) get one too, so the warm-up compiles their shadow program as well.
  const depthMaterials = new Map();
  function assignDepthMaterials(root) {
    root.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material) || o.customDepthMaterial) return;
      const m = o.material;
      if (!o.castShadow && (m.transparent || m.depthWrite === false || !m.colorWrite)) return;
      // Plain opaque casters (no cutout, displacement or clipping) draw the same depth in any material, so they share one depth material
      // per caster type and side: the shadow pass then keeps one program/uniform state instead of changing material ~200 times per map.
      const side = m.shadowSide !== null ? m.shadowSide : m.side === THREE.FrontSide ? THREE.BackSide : m.side === THREE.BackSide ? THREE.FrontSide : THREE.DoubleSide;
      const plain = !m.alphaMap && !(m.alphaTest > 0) && !m.displacementMap && !m.clippingPlanes && !m.clipShadows && !Q.has('depthown');
      const key = (plain ? 'plain' + side : m.uuid) + (o.isSkinnedMesh ? 's' : o.isBatchedMesh ? 'b' : o.isInstancedMesh ? 'i' : 'm');
      let dm = depthMaterials.get(key);
      if (!dm) {
        dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        dm.side = m.shadowSide !== null ? m.shadowSide : m.side === THREE.FrontSide ? THREE.BackSide : m.side === THREE.BackSide ? THREE.FrontSide : THREE.DoubleSide;
        dm.alphaMap = m.alphaMap; dm.alphaTest = m.alphaTest;
        dm.displacementMap = m.displacementMap; dm.displacementScale = m.displacementScale; dm.displacementBias = m.displacementBias;
        dm.clipShadows = m.clipShadows; dm.clippingPlanes = m.clippingPlanes; dm.clipIntersection = m.clipIntersection;
        // Match the shadow pass, keeping colour maps only for real alpha cutouts.
        if (m.alphaTest > 0) dm.map = m.map;
        else Object.defineProperty(dm, 'map', { get() { return null; }, set() { }, configurable: true });
        depthMaterials.set(key, dm);
      }
      o.customDepthMaterial = dm;
    });
  }
  function prepareWarmScene() {
    safe(() => assignDepthMaterials(scene));                                   // casters added since boot
    safe(() => { if (game.prepareGraphics) game.prepareGraphics(); });         // hidden click-to-move and target rings
    safe(() => { if (feedback && feedback.warm) feedback.warm(); });            // hidden blood, sparks, scars, smears, afterimages
    safe(() => { if (feedback) feedback.update(0); });                          // tells: rim shells, rings, glints
    safe(() => { if (rig && rig.prepare) rig.prepare(game); });                 // character rim light is patched in first
    safe(() => { if (B.HUD && B.HUD.prepare) B.HUD.prepare(); });               // the health/stamina orbs have their own small GL contexts
    // One entry per material and mesh kind (each kind is its own program variant).
    const seen = new Set(), seenGeometry = new Set(), jobs = [], geometryObjects = [], textures = new Set();
    const TEX = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'lightMap'];
    // Future window patterns and floor scars already exist, but are only assigned to a light/material
    // when their first room/attack is reached. Include them under the loading cover as well.
    if (world.lighting && world.lighting.prepareTextures) for (const t of world.lighting.prepareTextures()) textures.add(t);
    if (feedback && feedback.tells && feedback.tells.textures) for (const t of Object.values(feedback.tells.textures)) textures.add(t);
    scene.traverse(o => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
      if (o.geometry && (!seenGeometry.has(o.geometry) || o.isInstancedMesh)) {
        seenGeometry.add(o.geometry); geometryObjects.push(o);
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material], g = o.geometry && o.geometry.attributes;
      const kind = (o.isSkinnedMesh ? 's' : o.isBatchedMesh ? 'b' + !!o._colorsTexture : o.isInstancedMesh ? 'i' + !!o.instanceColor : o.isPoints ? 'p' : o.isSprite ? 'r' : 'm') + (g && g.color ? 'c' + g.color.itemSize : '') + (g && g.tangent ? 't' : '');
      const key = mats.map(m => m.uuid).join() + kind;
      if (o.isSkinnedMesh && o.skeleton) {
        if (!o.skeleton.boneTexture) o.skeleton.computeBoneTexture();
        textures.add(o.skeleton.boneTexture);
      }
      if (o.isBatchedMesh) for (const t of [o._matricesTexture, o._indirectTexture, o._colorsTexture]) if (t) {
        if (t.version === 0) t.needsUpdate = true;
        textures.add(t);
      }
      for (const m of mats) { for (const k of TEX) if (m[k] && m[k].isTexture) textures.add(m[k]); if (m.uniforms) for (const u in m.uniforms) { const v = m.uniforms[u] && m.uniforms[u].value; if (v && v.isTexture && !v.isRenderTargetTexture) textures.add(v); } }
      if (!seen.has(key)) { seen.add(key); jobs.push(o); }
      // compile() only visits object.material. Compile the actual shadow material
      // with the same geometry/skin/instance flags, including casters outside the first camera view.
      const depth = o.customDepthMaterial;
      if (depth && !seen.has(depth.uuid + kind)) {
        seen.add(depth.uuid + kind);
        jobs.push(Object.assign(Object.create(o), { material: depth, depthWarm: true }));
      }
      // Cut limb pieces are made at the killing blow from the body's skinned material and first cast with Three's
      // shared depth material, which copies the colour map (a 'uv' depth variant). Compile that variant now; the kept
      // twin material holds the program so it is never released.
      const sm = o.material;
      if (o.isSkinnedMesh && sm && !Array.isArray(sm) && sm.map) {
        const side = sm.shadowSide !== null && sm.shadowSide !== undefined ? sm.shadowSide : sm.side === THREE.FrontSide ? THREE.BackSide : sm.side === THREE.BackSide ? THREE.FrontSide : THREE.DoubleSide;
        const rk = 'rawdepth' + side + kind + (sm.alphaTest > 0 ? 'a' : '') + (sm.alphaMap ? 'm' : '');
        if (!seen.has(rk)) {
          seen.add(rk);
          const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
          dm.map = sm.map; dm.alphaMap = sm.alphaMap; dm.alphaTest = sm.alphaTest; dm.side = side;
          rawDepthTwins.push(dm);
          jobs.push(Object.assign(Object.create(o), { material: dm, depthWarm: true }));
        }
      }
    });
    if (game.limbs && game.limbs.warmGeometryObjects) for (const o of game.limbs.warmGeometryObjects()) {
      if (!seenGeometry.has(o.geometry)) { seenGeometry.add(o.geometry); geometryObjects.push(o); }
    }
    return { jobs, geometryObjects, textures: Array.from(textures).filter(t => t.image && !t.isCompressedTexture) };
  }
  // Automatic-resolution sizes are built ahead, so a later step is only a reference swap (sizes already built are skipped).
  function prewarmScaler() {
    if (!(AUTO_SCALE && cfg.fps > 0 && cfg.fps <= 64 && post.prewarm && renderer && !graphicsLost)) return;
    safe(() => {
      const sizes = [], v = { width: innerWidth, height: innerHeight, pixelRatio: window.devicePixelRatio };
      for (const lv of scaler.levels) { const pl = DISPLAY.plan(v, { ...cfg, dynScale: lv }); if (!sizes.some(z => z[0] === pl.width && z[1] === pl.height)) sizes.push([pl.width, pl.height]); }
      post.prewarm(sizes);
    });
  }
  // Paints the real (normally hidden) HUD at 1 % opacity above the loading cover so its canvases, orbs and minimap are rasterised once (warmup.js).
  let liveHudState = null;
  function liveHudPaint(on) {
    const el = $('hud'); if (!el || !game) return;
    if (on === 'sprites') { safe(warmMiniSprites); return; }
    if (on === 'map') { safe(() => { miniKey = ''; drawMinimapNow(game.player); }); return; }
    if (on === true) {
      if (!el.classList.contains('hidden')) return;
      liveHudState = el.style.cssText; el.classList.remove('hidden'); el.style.opacity = '.012'; el.style.zIndex = '2147483000';
      safe(() => { if (B.HUD) { B.HUD.vitals(game.player, 0); B.HUD.force(true); if (B.HUD.skills) B.HUD.skills(game.player, 0, game.skills()); } drawMinimapNow(game.player); });
    } else if (liveHudState !== null) { el.style.cssText = liveHudState; el.classList.add('hidden'); liveHudState = null; }
  }
  function warmShaders(overlay, onProgress) {
    if (!renderer || graphicsLost) return Promise.resolve(false);
    if (warming) return warming;
    const epoch = graphicsEpoch;
    const checkContext = () => { if (graphicsLost || graphicsEpoch !== epoch) throw Error('Grafik hazırlığı bağlantı kesildiği için durduruldu.'); };
    const box = $('warming'), fill = $('warm-fill');
    if (overlay && box) box.classList.remove('hidden');
    warmStats = { jobs: 0, textures: 0 };
    let work;
    const parallel = renderer.extensions.has('KHR_parallel_shader_compile'), t0 = performance.now();
    const batch = { list: [], traverse(cb) { this.list.forEach(cb); }, traverseVisible() {} };
    // Shadow rendering uses Three's empty scene (no scene fog/environment), but
    // retains the main render state's light counts in the program cache key.
    const shadowScene = new THREE.Scene();
    shadowScene.traverseVisible = cb => scene.traverseVisible(cb);
    const compileBatch = list => {
      batch.list = list.filter(o => !o.depthWarm);
      if (batch.list.length) renderer.compile(batch, camera, scene);
      batch.list = list.filter(o => o.depthWarm);
      if (batch.list.length) renderer.compile(batch, camera, shadowScene);
    };
    let next = 0, postDone = false, tex = 0, geo = 0, pending = [];
    const frame = () => new Promise(res => { let done = false; const go = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(go); setTimeout(go, 120); });
    let lastProgress = 0;
    const progress = (k, text) => { k = Math.max(lastProgress,k); lastProgress = k; if (onProgress) onProgress(k,text); if (fill) fill.style.transform = `scaleX(${Math.max(.04, k)})`; };
    // Separate real preparation phases; uploads can take longer than shader compilation.
    const report = () => progress(.25 + .17 * Math.min(1,next / Math.max(1,work.jobs.length))
      + .36 * Math.min(1,tex / Math.max(1,work.textures.length))
      + .18 * Math.min(1,geo / Math.max(1,work.geometryObjects.length)));
    async function run() {
      checkContext();
      // Cut meshes are expensive to build on a foe's first killing blow. Prepare
      // each cached cut under the loading cover, yielding so the bar can still move.
      if (game.limbs && game.limbs.prepare) {
        const cutStart = performance.now();
        await game.limbs.prepare(game.enemies, async (done, count) => {
          progress(.18 * done / Math.max(1, count), 'Düşmanlar hazırlanıyor…');
          if (!WARM_SYNC) await frame();
        });
        warmStats.cuts = Math.round(performance.now() - cutStart);
        warmStats.cutVariants = game.limbs.stats().cached;
      }
      progress(.18, 'Kaplamalar hazırlanıyor…');
      if (B.CoastMaterials) await B.CoastMaterials.ready();
      progress(.21);
      progress(.25, 'Işıklar ve gölgeler hazırlanıyor…');
      checkContext(); work = prepareWarmScene();
      warmStats.jobs = work.jobs.length;
      report();
      if (WARM_SYNC) {
        // Headless screenshot tools with a virtual clock (tools/shot_win.sh) cannot wait for background compiles:
        // there everything is compiled in one blocking step, as before (add &warm to test the real path headless).
        batch.list = work.jobs; next = work.jobs.length; postDone = true;
        safe(() => { const rt = renderer.getRenderTarget(); renderer.setRenderTarget(post.target); compileBatch(work.jobs); renderer.setRenderTarget(rt); if (post.compile) post.compile(); });
        tex = work.textures.length;
      }
      while (next < work.jobs.length || !postDone) {
        checkContext();
        const before = renderer.info.programs.length;
        batch.list = work.jobs.slice(next, next + WARM_BATCH); next += batch.list.length;
        const rt = renderer.getRenderTarget(); renderer.setRenderTarget(post.target);
        if (batch.list.length) safe(() => compileBatch(work.jobs.slice(next - batch.list.length, next)));
        renderer.setRenderTarget(rt);
        if (next >= work.jobs.length && !postDone) { postDone = true; safe(() => post.compile && post.compile()); }
        pending = renderer.info.programs.slice(before);
        // Wait for this batch (or finish it one program per task where the browser cannot compile in parallel, or
        // when a batch takes unusually long, e.g. software rendering or a headless virtual clock).
        const batchStart = performance.now();
        while (pending.length && performance.now() - t0 < 120000) {
          checkContext();
          if (parallel && performance.now() - batchStart < 2500) { pending = pending.filter(p => !p.isReady()); if (pending.length) await new Promise(r => setTimeout(r, 16)); }
          else { const p = pending.shift(); safe(() => p.getUniforms()); await new Promise(r => setTimeout(r, 0)); }
        }
        report(); if (WARM_LOG) console.warn('[warm] batch', next, '/', work.jobs.length, 'programs', renderer.info.programs.length, Math.round(performance.now() - t0) + 'ms');
        await frame();
      }
      const hudStart = performance.now();
      while (!WARM_SYNC && B.HUD && B.HUD.ready === false && performance.now() - hudStart < 2500) await frame();
      safe(() => { if (B.HUD && B.HUD.force) B.HUD.force(); });
      // Size the orb canvases while the HUD is laid out invisibly: the first resize of their GL buffers is slow.
      if (B.HUD && game && $('hud').classList.contains('hidden')) safe(() => {
        const el = $('hud'), t = performance.now(); el.style.visibility = 'hidden'; el.classList.remove('hidden');
        B.HUD.vitals(game.player, 0); B.HUD.force(true); el.classList.add('hidden'); el.style.visibility = ''; warmStats.hud = Math.round(performance.now() - t);
      });
      warmStats.programs = Math.round(performance.now() - t0);
      // Big character and surface maps: a few uploads per frame instead of all on the first draw.
      progress(.42, 'Kaplamalar belleğe aktarılıyor…');
      while (tex < work.textures.length) {
        checkContext();
        for (let i = 0; i < 3 && tex < work.textures.length; i++) safe(() => renderer.initTexture(work.textures[tex++]));
        report(); await frame();
      }
      warmStats.textures = Math.round(performance.now() - t0);
      // compile() prepares materials only. Upload the hidden rooms' vertex,
      // index and instance data now so entering a room cannot first allocate it.
      progress(.78, 'Mekân ve eşyalar hazırlanıyor…');
      const geometryStart = performance.now();
      if (renderer.initGeometry) while (geo < work.geometryObjects.length) {
        checkContext();
        for (let i = 0; i < 12 && geo < work.geometryObjects.length; i++) renderer.initGeometry(work.geometryObjects[geo++]);
        report(); if (!WARM_SYNC) await frame();
      }
      warmStats.geometryObjects = geo; warmStats.geometryUploads = Math.round(performance.now() - geometryStart);
      // Effects, hidden rooms and page content are first used mid-fight otherwise: draw/paint all of it once now (see warmup.js).
      if (!WARM_SYNC && B.Warmup) {
        progress(.93, 'Efektler ve arayüz hazırlanıyor…');
        checkContext();
        const wide = innerWidth / innerHeight < .85, touch = touchDevice();
        warmStats.roomTour = await B.Warmup.roomTour({ scene, camera, renderer, game, world, target: post.target, snap: snapScene,
          // Advance only the lighting fade: dt=0 leaves new scatter slots inactive,
          // so a real draw would still miss their first-use executables.
          post, rasterWarmup: B.Lighting.shaderPreparation.rasterWarmup, step: () => atmosphereStep(.25),
          cameraHeight: (wide ? 19 : touch ? 15.6 : 13.8) * CAM_NEAR, cameraBack: (wide ? 16 : 11.4) * CAM_NEAR });
        checkContext();
        warmStats.fxDraw = await B.Warmup.drawAll({ scene, camera, renderer, post, feedback, game, step: () => { cameraStep(0); atmosphereStep(0); }, elapsed: () => elapsed });
        checkContext();
        warmStats.domPaint = await B.Warmup.paintDom(liveHudPaint);
        warmStats.newPrograms = B.Warmup.stats.programs;
      }
      progress(.96, 'Son görüntü hazırlanıyor…');
      // One real frame (shadow-map variants) while the cover is still up.
      checkContext(); safe(() => { cameraStep(0); atmosphereStep(0); post.render(elapsed); });
      // Automatic-resolution sizes are built now, so a later step is only a reference swap. Skipped on 120 Hz-class targets.
      progress(.98);
      prewarmScaler();
      // World preparation patches shared character materials and their defines.
      // Compile the portrait AFTER those patches; its earlier programs otherwise
      // become obsolete and the first inventory draw compiles them again.
      const portraitStart = performance.now(), portraitPrograms = renderer.info.programs.length;
      if (characterPreview && characterPreview.warm) await characterPreview.warm();
      if (characterUI && characterUI.warm) { try { await characterUI.warm(); } catch (e) { console.warn('[Kabir Azabı]', e); } }   // I / T pages painted once under the cover
      warmStats.portrait = Math.round(performance.now() - portraitStart);
      warmStats.portraitPrograms = renderer.info.programs.length - portraitPrograms;
      warmStats.total = Math.round(performance.now() - t0); warmStats.count = renderer.info.programs.length;
      if (WARM_LOG) console.warn('[warm] done', JSON.stringify(warmStats));
      return true;
    }
    document.body.classList.add('warming-cover');
    warming = run().catch(e => { console.warn('[Kabir Azabı]', e); return false; }).then(ok => { warming = null; document.body.classList.remove('warming-cover'); if (box) box.classList.add('hidden'); if (onProgress) onProgress(1); return ok; });
    return warming;
  }

  /* ───────────── Boot ───────────── */
  function fatal(err) { console.error(err); $('loading').classList.add('hidden'); $('fatal').classList.remove('hidden'); $('fatal').querySelector('p').textContent = String(err && err.message || err); }
  window.addEventListener('error', e => { if (!ready) fatal(e.error || e.message); });
  // After a jump across the map (title, respawn) the rooms, pooled lights and the room grade arrive at once
  // instead of fading in over a second of darkness.
  function snapScene() { safe(() => { for (let i = 0; i < 4; i++) world.update(.1, elapsed, game.player); if (game.updateQuestVisibility) game.updateQuestVisibility(); if (rig.snap) rig.snap(); }); }
  function titleCamera() {
    if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
    cameraPos.set(world.spawn.x + TITLE_CAM[0], TITLE_CAM[1] + .35, world.spawn.z + TITLE_CAM[2] + .6);
    look.set(world.spawn.x + TITLE_CAM[3], TITLE_CAM[4], world.spawn.z + TITLE_CAM[5]);
  }
  function boot() {
    if (!B.World || !B.Models || !B.Game) throw Error('Oyun dosyaları henüz hazır değil. Sayfayı biraz sonra yenile.');
    scene = new THREE.Scene(); scene.background = new THREE.Color('#07090c');
    camera = new THREE.PerspectiveCamera(BASE_FOV, Math.max(1, innerWidth) / Math.max(1, innerHeight), .15, 150);
    renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
    // Shader error checks read every program's log on first use; development pages only (?debug).
    renderer.debug.checkShaderErrors = Q.has('debug');
    // three.js sorts opaque draws by material id and then by depth. Several materials are shared by skinned, instanced and plain
    // meshes (character gear vs. weapon parts, world batches vs. single props), so the depth order made every such material
    // alternate between its shader variants dozens of times per frame; each switch rebuilds the program parameters and cache key
    // (about 1 ms and 350 KB of garbage per frame). Same order otherwise; opaque, depth-tested draws look identical in any order.
    const variantOf = o => o.isSkinnedMesh ? 2 : o.isBatchedMesh ? 3 : o.isInstancedMesh ? 1 : 0;
    // Program-major: a program switch re-uploads the whole 12-light / fog / shadow uniform block (about 1.7 ms of a combat frame at
    // 90 switches), so every material with the same shader features is drawn together (then per mesh kind, then per material).
    const progClasses = new Map();
    const progClass = m => m.__karaPcV === m.version ? m.__karaPc : progClassOf(m);
    const progClassOf = m => {
      let ck = ''; try { ck = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; } catch (_) { }
      const k = m.type + '|' + ck + '|' + (m.isShaderMaterial ? m.uuid : '') + '|' + (m.map ? 1 : 0) + (m.normalMap ? 1 : 0) + (m.roughnessMap ? 1 : 0) + (m.metalnessMap ? 1 : 0) + (m.aoMap ? 1 : 0)
        + (m.emissiveMap ? 1 : 0) + (m.alphaMap ? 1 : 0) + (m.bumpMap ? 1 : 0) + (m.lightMap ? 1 : 0) + (m.displacementMap ? 1 : 0) + (m.envMap ? 1 : 0) + (m.alphaTest > 0 ? 1 : 0)
        + (m.vertexColors ? 1 : 0) + (m.flatShading ? 1 : 0) + (m.fog === false ? 0 : 1) + '|' + m.side + '|' + (m.defines ? JSON.stringify(m.defines) : '');
      let c = progClasses.get(k); if (!c) progClasses.set(k, c = progClasses.size + 1);
      m.__karaPc = c; m.__karaPcV = m.version; return c;
    };
    const sortById = (a, b) => a.groupOrder !== b.groupOrder ? a.groupOrder - b.groupOrder : a.renderOrder !== b.renderOrder ? a.renderOrder - b.renderOrder
      : a.material.id !== b.material.id ? a.material.id - b.material.id : variantOf(a.object) !== variantOf(b.object) ? variantOf(a.object) - variantOf(b.object)
      : a.z !== b.z ? a.z - b.z : a.id - b.id;
    const sortByProgram = (a, b) => {
      if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
      if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
      if (a.material !== b.material) {
        const pa = progClass(a.material), pb = progClass(b.material);
        if (pa !== pb) return pa - pb;
      }
      const va = variantOf(a.object), vb = variantOf(b.object);
      if (va !== vb) return va - vb;
      if (a.material.id !== b.material.id) return a.material.id - b.material.id;
      return a.z !== b.z ? a.z - b.z : a.id - b.id;
    };
    B.sortModes = { id: sortById, program: sortByProgram };
    renderer.setOpaqueSort(Q.has('idsort') ? sortById : sortByProgram);
    // Extension availability does not mean the backend can combine the native
    // draws. In particular, D3D11 emulates each BatchedMesh instance separately.
    worldSubmission = B.Display.worldSubmission(readGraphicsAdapter().renderer, renderer.extensions.has('WEBGL_multi_draw'));
    B.uiBitmapOptions = B.Display.uiBitmapOptions(readGraphicsAdapter().renderer);
    B.Lighting.configureBackend(readGraphicsAdapter().renderer);
    multiDraw = worldSubmission.multiDraw && !Q.has('nobatch');
    world = (forgeChapter ? B.ForgeWorld : ruinsChapter ? B.RuinsWorld : coastChapter ? B.CoastWorld : B.World).build(scene, { multiDraw });
    game = B.Game.create(world, { scene, emit: event, sound: (n, o) => B.Audio.play(n, o), fx });
    characterUI = B.CharacterUI.create({ game, keyLabels: () => ['heavy', 'special', 'rage', 'fourth'].map(a => { const c = binds[a][0] || binds[a][1]; return c ? capName(c) : '—'; }), onPreview: (canvas,nowMs) => characterPreview.draw(canvas,nowMs), onPreviewTurn: direction => characterPreview.turn(direction), onClose: back, onChange: () => { game.syncProgression(); if (game.saveProfileChoices) game.saveProfileChoices(); hud(0); } });
    questUI = B.QuestUI.create({ game });
    makeFX(); postProcess(); characterPreview = B.CharacterPreview.create({ renderer, camera, game, post, worldScene: scene }); setupUI();
    titleCamera();
    const placeNotices = () => {
      const height = Math.max($('narration').offsetHeight, $('tutorial').offsetHeight);
      $('hud').style.setProperty('--message-clearance', (height + 12) + 'px');
    };
    if (typeof ResizeObserver === 'function') {
      const noticeLayout = new ResizeObserver(placeNotices);
      noticeLayout.observe($('narration')); noticeLayout.observe($('tutorial'));
    }
    B.Audio.onCaption((text, speaker = 'Anlatıcı') => { const n = $('narration'); n.querySelector('.narration-text span').textContent = speaker; n.querySelector('p').textContent = text; n.classList.toggle('hidden', !text || !cfg.subtitles); if (text) { tap(n); $('tutorial').classList.add('hidden'); } placeNotices(); });
    placeNotices();
    // The embedded UI fonts are also offered to canvas text (damage numbers, labels) once decoded.
    if (document.fonts && document.fonts.load) safe(() => { document.fonts.load('800 40px "Source Sans 3"'); });
    // The shadow pass clones ONE depth material per source material and then reuses it for skinned, instanced and plain casters alike,
    // so it switched programs on every change of caster type. Give each (material, caster type) pair its own depth material instead.
    safe(() => assignDepthMaterials(scene));
    ready = true; applySettings();
    B.app = { scene, camera, renderer, world, game, post, rig, scaler, resetPerformance, settings: cfg, input, get view() { return view; }, begin, show, fx, applySettings, clearFX, warmShaders,
      characterUI, openCharacter, controller, characterPreview, questUI,
      get warming() { return !!warming; }, get warmStats() { return warmStats; },
      get performance() { return performanceReport(); }, frameStats,
      // Deterministic frame stepping for headless QA pages (virtual time barely runs requestAnimationFrame).
      step(n = 1) { for (let i = 0; i < n; i++) { qaClock = Math.max(qaClock, last || performance.now()) + 1000 / 60; frameStep(qaClock); } renderClock.reset(); } };
    $('game').addEventListener('webglcontextlost', e => {
      e.preventDefault(); graphicsLost = graphicsRecovering = true; graphicsEpoch++; graphicsAdapter = null;
      resetPerformance(); show('pause'); notify('Grafik bağlantısı kesildi. Oyun duraklatıldı; bağlantı bekleniyor.');
    });
    $('game').addEventListener('webglcontextrestored', () => {
      graphicsLost = false; graphicsRecovering = true;
      B.Lighting.configureBackend(readGraphicsAdapter().renderer);
      const epoch = graphicsEpoch;
      // Three has restored its renderer first. Warm all rooms and cached cuts
      // again before the player resumes, rather than stall at every first draw.
      Promise.resolve(warming).then(() => {
        if (graphicsLost || graphicsEpoch !== epoch) return false;
        if (post && post.keepSizes) post.keepSizes(false); // GL objects are gone: rebuild size sets fresh
        applySettings(); last = visualDt = 0; renderClock.reset();
        return warmShaders(true);
      }).then(ok => {
        if (graphicsLost || graphicsEpoch !== epoch) return;
        if (ok === false) throw Error('Grafik hazırlığı tamamlanamadı.');
        graphicsRecovering = false; last = visualDt = 0; renderClock.reset();
        notify('Grafikler yeniden hazır. Devam et ile yolculuğa dönebilirsin.');
      }).catch(e => { if (graphicsEpoch === epoch) { console.warn('[Kabir Azabı]', e); notify('Grafikler hazırlanamadı. Sayfayı yeniden yükle.'); } });
    });
    loadProgress(.43, 'Işıklar ve gölgeler hazırlanıyor…');
    return warmShaders(false, (k, text) => loadProgress(.43 + .57 * k, text)).then(() => {
      loadProgress(1, 'Hazır.');
      $('loading').classList.add('hidden');
      show('title');
      if (Q.get('yolculuk') === 'devam' && chapter > 1 && campaign.transition) { const url = new URL(location.href); url.searchParams.delete('yolculuk'); safe(() => history.replaceState(null, '', url)); begin(false); }
      safe(makePortrait);
      requestAnimationFrame(loop);
      if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
  loadProgress(.18, 'Karakterler hazırlanıyor…');
  // Düşük loads the character textures at half size and touch tablets cap them at 1024 px (up to ~88 MB less video memory).
  lowTextures = cfg.quality === 'low';
  Promise.resolve().then(async () => {
    await Promise.all([
      B.Models.prepare({ textureScale: lowTextures ? .5 : 1, maxTexture: coarsePointer ? 1024 : 2048 }),
      B.TargetHUD.prepare(),
      B.GroundLoot.prepare(),
      B.SkillArt.prepare()
    ]);
    if (B.Audio.prepare) {
      loadProgress(.30, forgeChapter ? 'Ocağın sesleri hazırlanıyor…' : ruinsChapter ? 'Mağaranın sesleri hazırlanıyor…' : coastChapter ? 'Kıyının sesleri hazırlanıyor…' : 'Tapınağın sesleri hazırlanıyor…');
      try { await B.Audio.prepare(k => loadProgress(.30 + .08 * k)); }
      catch (e) { console.warn('[Kabir Azabı] Ses hazırlığı tamamlanamadı.', e); }
    }
  })
    .then(() => { loadProgress(.38, forgeChapter ? 'Kızıl Ocak beliriyor…' : ruinsChapter ? 'Sessiz Taht beliriyor…' : coastChapter ? 'Kara Kıyı beliriyor…' : 'Mahzen aydınlanıyor…'); return boot(); }).catch(fatal);
})();
