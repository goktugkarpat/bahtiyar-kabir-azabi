/* KABİR AZABI — app shell: renderer, post-processing, camera, input, HUD, menus and settings.
   Gameplay lives in BABA.Game (combat.js); this file only presents it and feeds it input. */
(() => {
  'use strict';
  const B = window.BABA, $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const Q = new URLSearchParams(location.search);
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
    medium: { scale: 1, shadows: 1024, detail: 'high',   lights: .7,  particles: 440, fog: .019, bloom: .205, corpses: 58, decals: 58, aa: true, occlusion: .5 },
    high:   { scale: 1, shadows: 1536, detail: 'high',   lights: .8,  particles: 560, fog: .02,  bloom: .25,  corpses: 75, decals: 75, aa: true, occlusion: .6 }
  };
  const QUALITY_TEXT = {
    low: ['Düşük', 'Akıcılık öncelikli. Hafif ışıklar ve daha az parçacık.'],
    medium: ['Orta', 'Dengeli görüntü ve akıcılık. Ayrıntılı yüzeyler ve yumuşak gölgeler.'],
    high: ['Yüksek', 'En yüksek kalite. Daha net gölgeler, zengin ışıklar, sis ve savaş efektleri.']
  };
  // Character textures are sized once at start (Düşük halves them); a later change of preset takes full effect after a reload.
  const TEXTURE_NOTE = ' Karakter kaplamaları oyun yeniden açılınca bu ayara geçer.';
  const coarsePointer = matchMedia('(pointer:coarse)').matches;
  // Desktop defaults follow the current display's pixel density. Extra AA is opt-in.
  const DEFAULTS = { quality: FRAME_LIMIT === 60 ? 'medium' : 'high', qualityVersion: 3, ...DISPLAY.defaults, frameRate: FRAME_LIMIT === 60 ? 60 : 0, exposure: 1.15, shake: .55, master: .65, music: .42, sfx: .75, voice: .85, subtitles: true, uiScale: 1 };
  const FRAME_RATES = [60, 120, 0];   // 0 = follow the display (every refresh; best with G-Sync / FreeSync / ProMotion)
  const UI_STEPS = [.85, 1, 1.25];
  const LIMITS = { exposure: [.7, 1.7], shake: [0, 1], master: [0, 1], music: [0, 1], sfx: [0, 1], voice: [0, 1] };
  // `cfg` is shared with effects.js / world.js / combat.js (they read the technical fields).
  const cfg = { ...DEFAULTS, impact: .65, touch: 'auto', showFps: false };
  /* ───────────── Key bindings ─────────────
     binds[action] = [primary, secondary]: a KeyboardEvent.code ('KeyW', 'Space', …) or 'Mouse0'…'Mouse4' (left, middle, right, back, forward); '' = empty.
     Saved with the settings (field `binds`). Esc (pause) and H (help) are fixed. Menu: the 'keybinds' screen (setupBindUI). */
  const BIND_INFO = {
    up: ['Yukarı', ''], down: ['Aşağı', ''], left: ['Sola', ''], right: ['Sağa', ''],
    light: ['Hafif saldırı', 'Düşmana tıkla, basılı tut · boşluğa tık: yürü'], heavy: ['Ağır saldırı', 'Düşmana tıkla · gardı kırar'], stand: ['Yerinde vur', 'Basılıyken tıkla: yürümeden vurur'], dodge: ['Kaçınma', 'Yürüdüğün yöne'],
    heal: ['Can iksiri', 'Anında iyileşir'], rage: ['Kan Öfkesi', 'Savaş narası'], special: ['Zincir Girdabı', 'Etrafında dönüp herkese vurur'], interact: ['Etkileşim', 'Yemin taşı']
  };
  const BIND_VERSION = 1;
  const BIND_GROUPS = [['bind-combat', ['special', 'rage', 'dodge', 'heal', 'light', 'heavy', 'stand']], ['bind-misc', ['interact']]];
  const BIND_DEFAULTS = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    light: ['Mouse0', 'KeyJ'], heavy: ['Mouse2', 'KeyK'], stand: ['ShiftLeft', ''], dodge: ['Space', ''],
    heal: ['KeyQ', ''], rage: ['Digit2', ''], special: ['Digit1', ''], interact: ['KeyE', '']
  };
  const BIND_MOUSE_OK = ['light', 'heavy', 'dodge', 'heal', 'rage', 'special'];   // walking and interact stay on the keyboard
  const BIND_RESERVED = ['Escape', 'KeyH', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu'];
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
    for (const a of [first, 'special', 'rage', ...Object.keys(BIND_DEFAULTS)].filter((x, i, l) => x && l.indexOf(x) === i)) {
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
        if (raw.preset === 'ultra') raw.preset = 'high';
        if (!Object.prototype.hasOwnProperty.call(QUALITY, raw.preset)) raw.preset = ({ 0: 'low', 1024: 'medium', 1536: 'medium', 2048: 'high', 4096: 'high' })[raw.shadows] || DEFAULTS.quality;
        raw.quality = raw.preset;
      }
    }
    if (raw && typeof raw === 'object') {
      if (raw.quality === 'ultra') { raw.quality = 'high'; migrated = true; }
      else if (!legacySettings && raw.qualityVersion !== DEFAULTS.qualityVersion && raw.quality === 'high') {
        // The two-level High was this exact balanced preset. Keep its appearance
        // under the new Medium name; the restored full High is a separate choice.
        raw.quality = 'medium';
      }
      if (raw.qualityVersion !== DEFAULTS.qualityVersion) migrated = true;
      if (Object.prototype.hasOwnProperty.call(QUALITY, raw.quality)) cfg.quality = raw.quality;
      for (const k of Object.keys(LIMITS)) if (Number.isFinite(raw[k])) cfg[k] = clamp(raw[k], LIMITS[k][0], LIMITS[k][1]);
      if (typeof raw.subtitles === 'boolean') cfg.subtitles = raw.subtitles;
      // Preserve valid display choices; retired choices fall back to Auto.
      Object.assign(cfg, DISPLAY.settings(raw));
      if (raw.displayVersion !== DISPLAY.defaults.displayVersion || raw.displayMode !== cfg.displayMode) migrated = true;
      cfg.uiScale = UI_STEPS.includes(raw.uiScale) ? raw.uiScale : DEFAULTS.uiScale;
      cfg.frameRate = FRAME_RATES.includes(raw.frameRate) ? raw.frameRate : raw.frameRate === 144 ? 0 : DEFAULTS.frameRate;
      if (raw.frameRate !== cfg.frameRate) migrated = true;
      cfg.shake = DEFAULTS.shake;   // camera shake is no longer a setting
    }
    if (raw && typeof raw === 'object' && raw.bindVersion !== BIND_VERSION) {
      setBinds(migrateNumberedBinds(raw.binds)); migrated = true;
    } else setBinds(raw && raw.binds);
    deriveSettings();
    if (migrated) { saveSettings(); safe(() => localStorage.removeItem(OLD_KEY)); }
  }
  function deriveSettings() {
    Object.assign(cfg, QUALITY[cfg.quality] || QUALITY.high);
    cfg.fps = cfg.frameRate;
    // 60 Hz-class targets: distant characters stop casting into the key light's shadow map (see combat.js); 0 = all cast.
    // ...and the busiest per-frame extras are trimmed a little on High so a 60 Hz screen stays locked (120 Hz keeps the full amounts).
    if (cfg.fps > 0 && cfg.fps <= 64 && cfg.quality === 'high') { cfg.decals = 60; cfg.particles = 480; cfg.corpses = 60; }
    cfg.shadowReach = cfg.quality === 'low' ? 0 : cfg.fps > 0 && cfg.fps <= 64 ? (cfg.quality === 'high' ? 13 : 10) : (cfg.quality === 'high' ? 18 : 13);   // far characters do not cast into the key light's map (fewer shadow draws = a steadier frame time)
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
  const views = ['title', 'pause', 'settings', 'controls', 'keybinds', 'death', 'victory', 'confirm'];
  const overlays = new Set(['settings', 'controls', 'keybinds', 'confirm']);
  let view = 'title', stack = [];
  let renderer, scene, camera, world, game, rig, post;
  let ready = false, paused = true, frame = 0, last = 0, qaClock = 0, visualDt = 0;
  let resumeAudioOnVisible = null;
  let graphicsLost = false, graphicsRecovering = false, graphicsEpoch = 0;
  const renderClock = B.Pacing.create();
  const scaler = DISPLAY.createScaler(), AUTO_SCALE = !Q.has('nodrs');
  let shake = 0, flash = 0, ragePush = 0, announceTimer = 0, hudTimer = 0, firstHint = 25, elapsed = 0;
  let fpsStart = 0, fpsFrames = 0;
  const performanceMeter = B.Performance.create();
  let graphicsAdapter = null, multiDraw = false;
  let introBlend = 1, introStart = 0, deaths = 0, lastHp = null, lastFlasks = null;
  const buffUI = B.Buffs.create($('timed-effects'));
  const targetUI = B.TargetHUD.create($('target-hud'));
  const cryEffect = { id: 'rage', name: 'Kan Öfkesi', icon: 'rage', remaining: 0, duration: B.Game.resources.durations.rage };
  const timedEffects = [cryEffect];
  let lastBuffRows = -1;
  const keys = new Set(), actions = {}, cameraPos = new THREE.Vector3(), look = new THREE.Vector3(), target = new THREE.Vector3(), projected = new THREE.Vector3();
  // D4 controls: light / heavy = the attack KEY (J, K, pad, on-screen button: only swings at a foe in the front cone); clickLight / clickHeavy = a mouse press or tap this frame,
  // holdLight / holdHeavy = the mouse button (or the finger) is still down, stand = the "stand still" modifier, target = the foe under the cursor, pointX / pointZ = the floor under it.
  const input = { x: 0, z: 0, aimX: null, aimZ: null, aimFoe: null, light: false, heavy: false, near: false, clickLight: false, clickHeavy: false, holdLight: false, holdHeavy: false, stand: false, target: null, pointX: null, pointZ: null, dodge: false, heal: false, rage: false, special: false, interact: false };
  let lightPointer = null, hitPause = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cameraKick = { x: 0, z: 0, vx: 0, vz: 0 }, cameraLead = new THREE.Vector3(), introFrom = new THREE.Vector3(), introLook = new THREE.Vector3(), lookTarget = new THREE.Vector3();
  let lastFootfall = 0, lastFootfallReset = null;
  let heldLight = false, lightRepeat = 0, lastPad = [], roomId = -1, deathShown = false, wonShown = false;
  const joy = { x: 0, z: 0, id: null, ox: 0, oy: 0 };
  // Pointer for the click-target controls: last position (client px), the foe under it, whether it counts (over the game, or a button held), clicks waiting for the next frame.
  const cursor = { x: 0, y: 0, has: false, touch: false, target: null }, clicks = { light: false, heavy: false }, ndc = new THREE.Vector2(), pickRay = new THREE.Raycaster(), pickA = new THREE.Vector3(), pickB = new THREE.Vector3();
  let zoneTap = null, touchHold = null;   // pointerId of the finger that is down on the game (a held left click)
  // Touch controls appear on touch screens, and on any device as soon as a finger is used.
  let touchSeen = coarsePointer;
  const touchDevice = () => cfg.touch === 'on' || (cfg.touch === 'auto' && touchSeen);

  /* ───────────── Views ───────────── */
  function show(next) {
    if ((graphicsLost || graphicsRecovering || warming) && next === 'playing') next = 'pause';
    if (next !== view) resetPerformance();
    view = next;
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
      $('play').querySelector('span').textContent = game && game.hasSave ? 'Yolculuğa devam' : 'Tapınağa gir';
      $('new').classList.toggle('hidden', !game || !game.hasSave);
    }
    if (next === 'pause') fillPause();
    return next;
  }
  function open(next) { stack.push(view); show(next); }
  function back() { show(stack.pop() || 'title'); }
  function clearInput() {
    keys.clear(); for (const k in actions) delete actions[k];
    heldLight = false; lightPointer = null; touchHold = null; zoneTap = null; clicks.light = clicks.heavy = false; cursor.target = null;
    joy.x = joy.z = 0; joy.id = null; resetStick();
    input.aimX = input.aimZ = input.aimFoe = null;
    input.x = input.z = 0; input.target = input.pointX = input.pointZ = null;
    for (const a of ['light', 'heavy', 'near', 'clickLight', 'clickHeavy', 'holdLight', 'holdHeavy', 'stand', 'dodge', 'heal', 'rage', 'special', 'interact']) input[a] = false;
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
    setTimeout(() => d.classList.add('out'), 3600);
    setTimeout(() => d.remove(), 4200);
  }
  function clearNotices() {
    buffUI.clear();
    targetUI.clear();
    $('toasts').replaceChildren();
    for (const w of warnings) w.el.remove(); warnings.length = 0;
    flash = shake = hitPause = ragePush = 0;
    cameraKick.x = cameraKick.z = cameraKick.vx = cameraKick.vz = 0; cameraLead.set(0, 0, 0); lastFootfall = 0;
  }
  function announce(name, sub = 'KURBAN TAPINAĞI', kind = '') {
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
    B.Audio.unlock(); if (B.Audio.resetNarration) B.Audio.resetNarration();
    const fromTitle = view === 'title';
    clearNotices();
    if (fresh) { game.restart(); deaths = 0; } else game.start();
    deathShown = wonShown = false; roomId = -1; firstHint = 25; lastHp = lastFlasks = null;
    $('tutorial').classList.remove('hidden');
    show('playing'); hud(0);
    if (fromTitle && !reducedMotion.matches) { introBlend = 0; introStart = performance.now(); introFrom.copy(cameraPos); introLook.copy(look); }   // swoop from the title shot down to the play camera
    else { introBlend = 1; cameraPos.set(game.player.x, 16, game.player.z + 13); look.set(game.player.x, .7, game.player.z); }
    announce('Kabir Azabı', 'BÖLÜM I · KURBAN TAPINAĞI', 'chapter');
    if (B.Audio.say && !game.checkpointIndex) B.Audio.say('intro');
  }
  function event(name, d = {}) {
    if (name === 'hit') {
      // combat.js sizes the hit-stop itself (d.hitstop is set) and reports how hard the contact was (d.impact 0..1),
      // so here the camera only recoils; the old global pause remains for hit events without d.hitstop.
      const strength = Number.isFinite(d.impact) ? d.impact : d.blocked ? .28 : d.heavy ? .85 : d.target === 'player' ? .65 : .26;
      if (!reducedMotion.matches) {
        const face = Number.isFinite(d.face) ? d.face : game.player.face, kick = d.target === 'player' ? 1.6 : d.kill ? 2.6 : 2.1;
        cameraKick.vx += Math.sin(face) * strength * kick;
        cameraKick.vz += Math.cos(face) * strength * kick;
        if (!Number.isFinite(d.hitstop)) hitPause = Math.max(hitPause, (d.blocked ? .012 : d.heavy ? .047 : d.target === 'player' ? .033 : .018) * cfg.impact);
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
    else if (name === 'checkpoint') { $('objective').textContent = 'Celladı bul. Geçidi aç.'; announce('Yemin mühürlendi', 'KONTROL NOKTASI', 'checkpoint'); notify('Canın ve iksirlerin yenilendi. Buradan geri döneceksin.', 'seal'); if (B.Audio.saySequence) B.Audio.saySequence(['checkpoint', 'heroOath']); else if (B.Audio.say) B.Audio.say('checkpoint'); }
    else if (name === 'encounter') { if (d.name) announce(d.name, 'KARŞILAŞMA'); }
    else if (name === 'encounterCleared') { announce('Mühür açıldı', d.roomName || d.name || 'SALON TEMİZLENDİ', 'seal'); }
    else if (name === 'boss') { if (d.active !== false) { announce(d.name || 'Zincir Celladı', 'KURBAN SALONU', 'boss'); if (B.Audio.saySequence) B.Audio.saySequence(['boss', 'cellat']); else if (B.Audio.say) B.Audio.say('boss'); } }
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
    if (B.Audio.say) B.Audio.say('death', true);
    const enemy = d.enemy || game.lastDeath?.enemy, attack = d.attack || game.lastDeath?.attack;
    $('death-cause').textContent = enemy || 'Son darbeyi karanlık vurdu.';
    $('death-attack').textContent = attack || '';
    const tip = (attack && DEATH_TIPS.find(([re]) => re.test(attack))) || null;
    $('death-tip').textContent = tip ? tip[1] : GENERAL_TIPS[(deaths - 1) % GENERAL_TIPS.length];
    const omens = DEATH_OMENS[enemy] || DEATH_OMENS_ANY;
    $('death-detail').textContent = omens[(deaths - 1) % omens.length] + ' ' + (game.checkpointIndex ? 'Yemin seni taşa geri bağlıyor.' : 'Yemin seni tapınağın girişine geri sürüklüyor.');
    setTimeout(() => { if (game.state === 'dead') show('death'); }, 750);
  }
  function victory(d = {}) {
    if (wonShown) return; wonShown = true;
    hud(0); hudTimer = 0;
    if (B.Audio.say) B.Audio.say('win', true);
    const t = d.time ?? game.elapsed ?? elapsed, k = d.kills ?? game.kills ?? 0;
    const stat = (icon, value, label) => `<div><svg class="icon" aria-hidden="true"><use href="#${icon}"/></svg><b>${value}</b><small>${label}</small></div>`;
    $('victory-stats').innerHTML = stat('i-hourglass', timeText(t), 'SÜRE') + stat('i-cross', Math.round(k), 'ALT EDİLEN') + stat('i-skull', deaths, 'ÖLÜM');
    setTimeout(() => { if (game.state === 'won') show('victory'); }, 1500);
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
    // The HUD stays native even when Auto or Smooth reduces the scene resolution.
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
    if (changedSize) resetPerformance();
    if (view === 'settings') safe(paintGraphicsNotes);
    const touch = touchDevice();
    document.body.classList.toggle('touch', touch);
    $('touch-controls').classList.toggle('hidden', !touch);
  }
  function applySettings() {
    if (!renderer) return;
    deriveSettings();
    rig.setQuality(cfg); post.setQuality(cfg);
    if (world.setQuality) world.setQuality(cfg);
    B.Audio.set({ master: cfg.master, music: cfg.music, sfx: cfg.sfx, ambient: cfg.ambient, voice: cfg.voice });
    $('fps').classList.toggle('hidden', !cfg.showFps);
    $('narration').classList.toggle('hidden', !cfg.subtitles || !$('narration').querySelector('p').textContent);
    if (game && game.setQuality) game.setQuality(cfg);
    resize(); resetPerformance(); saveSettings();
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
        : cfg.displayMode === 'smooth' ? 'Akıcı: Otomatik seçeneğine göre görüntü boyutunu %25 azaltır. Yazılar net kalır.'
        : 'Ekranın bütün piksellerini kullanır. Retina ekranda Düşük kalite seçilse de çizim boyutu azalmaz.';
    }
    if (rate) rate.textContent = cfg.fps ? 'En fazla ' + cfg.fps + ' kare/sn. Ekranın yenileme hızına uymayan bir sınır kare atlamalarına yol açabilir; en düzgünü "Ekran hızı"dır.' : 'Ekranın her yenilemesinde çizer (G-Sync / FreeSync / ProMotion ile en düzgünü).';
  }
  function renderSettings() {
    const video = $('settings-video'), audio = $('settings-audio');
    video.querySelectorAll('.advanced-graphics, .setting').forEach(n => n.remove()); audio.querySelectorAll('.setting').forEach(n => n.remove());
    const q = document.createElement('div'); q.className = 'setting quality';
    q.innerHTML = `<div class="setting-head"><label id="quality-label">Grafik kalitesi</label></div><div class="segmented" role="radiogroup" aria-labelledby="quality-label">${Object.keys(QUALITY).map(k => `<button type="button" role="radio" data-quality="${k}">${QUALITY_TEXT[k][0]}</button>`).join('')}</div><small id="quality-note"></small>`;
    const paintQuality = () => { q.querySelectorAll('[data-quality]').forEach(b => { const on = b.dataset.quality === cfg.quality; b.classList.toggle('selected', on); b.setAttribute('aria-checked', on); }); q.querySelector('#quality-note').textContent = QUALITY_TEXT[cfg.quality][1] + ((cfg.quality === 'low') !== lowTextures ? TEXTURE_NOTE : ''); };
    q.querySelectorAll('[data-quality]').forEach(b => b.addEventListener('click', () => { if (b.dataset.quality === cfg.quality) return; cfg.quality = b.dataset.quality; paintQuality(); applySettings(); warmShaders(true); }));
    paintQuality(); video.append(q);
    const displayNote = document.createElement('small'); displayNote.id = 'display-note'; q.append(displayNote);
    video.append(choiceRow('displayMode', 'Görüntü boyutu', ['auto', 'native', 'smooth'], v => ({ auto: 'Otomatik', native: 'Tam boyut', smooth: 'Akıcı' })[v]),
      choiceRow('frameRate', 'Kare hızı', FRAME_RATES, v => v ? v + ' FPS' : 'Ekran hızı'),
      choiceRow('uiScale', 'Arayüz boyutu', UI_STEPS, v => v < 1 ? 'Küçük' : v > 1 ? 'Büyük' : 'Normal'));
    // Edge smoothing (SMAA post pass in post.js) is always on: no settings row.
    paintGraphicsNotes();
    $('uiScale-note').textContent = 'Alt çubuk, küreler, harita ve yazıları ölçekler.';
    for (const f of SLIDERS.video) video.append(sliderRow(f));
    for (const f of SLIDERS.audio) audio.append(sliderRow(f));
    const sub = document.createElement('div'); sub.className = 'setting toggle';
    sub.innerHTML = '<label for="set-subtitles"><b>Altyazılar</b><small>Anlatıcının sözlerini ekranda göster.</small></label><input id="set-subtitles" type="checkbox">';
    const box = sub.querySelector('input'); box.checked = cfg.subtitles;
    box.addEventListener('change', () => { cfg.subtitles = box.checked; applySettings(); });
    audio.append(sub);
    $('settings-note').textContent = B.Audio.silent ? 'Sessiz test modu · ses kapalı.' : 'Ayarlar hemen uygulanır ve bu cihazda saklanır.';
  }
  function openSettings() { open('settings'); renderSettings(); }
  function openControls() { open('controls'); }
  function openKeybinds() { open('keybinds'); renderBinds(); }
  function fillPause() {
    if (!game) return;
    const total = game.enemies.length, kills = game.enemies.filter(e => e.dead).length;
    const r = world && world.roomAt(game.player.x, game.player.z);
    $('pause-room').textContent = r ? r.name : 'Kurban Tapınağı';
    $('pause-time').textContent = timeText(game.elapsed || 0);
    $('pause-kills').textContent = kills + ' / ' + total;
  }

  /* ───────────── UI wiring ───────────── */
  function setupUI() {
    $('play').onclick = () => begin(false);
    $('new').onclick = () => open('confirm');
    $('title-settings').onclick = $('pause-settings').onclick = openSettings;
    $('title-controls').onclick = $('pause-controls').onclick = $('settings-controls').onclick = openControls;
    $('pause-button').onclick = () => { if (view === 'playing') show('pause'); };
    $('resume').onclick = () => show('playing');
    $('settings-close').onclick = $('settings-done').onclick = $('controls-close').onclick = $('confirm-no').onclick = back;
    $('settings-reset').onclick = () => { const q = cfg.quality; Object.assign(cfg, DEFAULTS); applySettings(); renderSettings(); if (q !== cfg.quality) warmShaders(true); };
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
          post.setTiming(cfg.showFps || Q.has('gpums'));
          if (cfg.showFps) drawFps();
        }
        return;
      }
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
    window.addEventListener('gamepadconnected', () => notify('Gamepad bağlandı.'));
    window.addEventListener('gamepaddisconnected', () => { lastPad.length = 0; clearInput(); if (view === 'playing') show('pause'); notify('Gamepad bağlantısı kesildi. Oyun duraklatıldı.'); });
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
    const label = a => BIND_INFO[a][0], mouseOk = a => BIND_MOUSE_OK.includes(a);
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
    $('bind-capture-what').textContent = `${BIND_INFO[action][0]} · ${slot ? 'yedek tuş' : 'ana tuş'}`;
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
      sec.querySelectorAll('.bindrow, .bind-cols').forEach(n => n.remove());
      const head = document.createElement('div'); head.className = 'bind-cols'; head.innerHTML = '<span></span><span>Ana tuş</span><span>Yedek</span><span></span>'; sec.append(head);
      const fixed = id === 'bind-misc' ? [['Mola', 'Menü ve ayarlar', 'ESC'], ['Yardım', 'Kontroller ekranı', 'H']] : [];
      for (const a of list) {
        const row = document.createElement('div'); row.className = 'setting bindrow'; row.dataset.bindRow = a;
        row.innerHTML = `<div class="bind-name"><label>${BIND_INFO[a][0]}</label><small>${BIND_INFO[a][1]}</small></div><button type="button" class="bind-slot" data-slot="0"></button><button type="button" class="bind-slot" data-slot="1"></button><button type="button" class="bind-reset" title="Varsayılana dön" aria-label="${BIND_INFO[a][0]}: varsayılana dön">↺</button>`;
        row.querySelectorAll('.bind-slot').forEach((b, i) => {
          const c = binds[a][i]; b.textContent = capName(c); b.classList.toggle('empty', !c); b.classList.toggle('listening', !!rebind && rebind.action === a && rebind.slot === i);
          b.setAttribute('aria-label', `${BIND_INFO[a][0]}, ${i ? 'yedek' : 'ana'} tuş: ${c ? capName(c) : 'boş'}. Değiştirmek için tıkla.`);
          b.onclick = () => startRebind(a, i);
        });
        const same = binds[a].join() === BIND_DEFAULTS[a].join(), rs = row.querySelector('.bind-reset'); rs.disabled = same;
        rs.onclick = () => { setBinds(Object.assign({}, binds, { [a]: BIND_DEFAULTS[a] }), a); bindsChanged(); bindNote(`${BIND_INFO[a][0]} varsayılana döndü.`); };
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
    input.aimX = input.aimZ = input.aimFoe = null;   // only the pad's right stick sets an aim, and only for this frame
    // Like Diablo IV on PC: the keyboard does not walk the hero (the mouse does); only the touch stick and the gamepad stick give a direction.
    let x = joy.x, z = joy.z;
    updatePointer();
    input.stand = isDown('stand');
    input.holdLight = holdBtn('light'); input.holdHeavy = holdBtn('heavy');
    input.clickLight = clicks.light; input.clickHeavy = clicks.heavy; clicks.light = clicks.heavy = false;
    input.target = cursor.target;
    if (cursor.touch && touchHold === null) cursor.has = false;   // a finger that has lifted no longer points at anything
    const pad = connectedPad();
    if (pad) {
      const left = stickScale(pad.axes[0] || 0, pad.axes[1] || 0);
      x += (pad.axes[0] || 0) * left; z += (pad.axes[1] || 0) * left;
      const right = stickScale(pad.axes[2] || 0, pad.axes[3] || 0);
      const ax = (pad.axes[2] || 0) * right, az = (pad.axes[3] || 0) * right;
      if (Math.hypot(ax, az) > .2) { input.aimX = game.player.x + ax * 8; input.aimZ = game.player.z + az * 8; }
      for (let i = 0; i < PAD_ACTIONS.length; i++) if (pad.buttons[i]?.pressed && !lastPad[i]) actions[PAD_ACTIONS[i]] = true;
      if (pad.buttons[9]?.pressed && !lastPad[9]) show(view === 'playing' ? 'pause' : 'playing');
      rememberPad(pad);
    } else lastPad.length = 0;
    const len = Math.hypot(x, z); if (len > 1) { x /= len; z /= len; }
    input.x = x; input.z = z;
    for (const a of ['light', 'heavy', 'near', 'dodge', 'heal', 'rage', 'special', 'interact']) { input[a] = !!actions[a]; delete actions[a]; }
    return input;
  }
  const PAD_ACTIONS = ['dodge', 'heal', 'light', 'heavy', 'special', 'rage'];
  function connectedPad() {
    const pads = navigator.getGamepads && navigator.getGamepads();
    if (pads) for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected !== false) return pads[i];
    return null;
  }
  // A radial, rescaled dead zone removes idle drift without a sudden speed jump.
  function stickScale(x, z) {
    const length = Math.hypot(x, z);
    return length <= .16 ? 0 : Math.min(1, (length - .16) / .84) / length;
  }
  function rememberPad(pad) {
    for (let i = 0; i < pad.buttons.length; i++) lastPad[i] = !!pad.buttons[i].pressed;
    lastPad.length = pad.buttons.length;
  }

  /* ───────────── HUD ───────────── */
  // The HUD portrait is a painted adaptation of the real hero's original model portrait.
  // Loading it once avoids a second live GL context and repeated character shader work.
  // `?portrait` still renders the actual model for modelling/framing QA; it is not the painted HUD asset.
  function makePortrait() {
    const canvas = $('hero-portrait'), N = 384, context = canvas.getContext('2d');
    canvas.width = canvas.height = N;
    if (!Q.has('portrait')) {
      const img = new Image();
      img.onload = () => { context.clearRect(0, 0, N, N); context.drawImage(img, 0, 0, N, N); };
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
  function drawMinimap(p) {
    const c = $('minimap'), x = c.getContext('2d'), scale = 4.6, cx = 128, cy = 140;
    x.setTransform(c.width / 256, 0, 0, c.width / 256, 0, 0);   // drawn on a 256 grid, backing store may be larger (sharper on Retina)
    x.clearRect(0, 0, 256, 256);
    const bg = x.createRadialGradient(128, 128, 20, 128, 128, 140); bg.addColorStop(0, '#1a1615'); bg.addColorStop(1, '#070606');
    x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
    x.save(); x.translate(cx, cy); x.scale(scale, scale); x.translate(-p.x, -p.z);
    x.strokeStyle = '#3a302a'; x.lineWidth = 6.8; x.lineCap = 'round'; x.beginPath();
    world.rooms.forEach((r, i) => { if (i) x.lineTo(r.x, r.z); else x.moveTo(r.x, r.z); }); x.stroke();
    const here = world.roomAt(p.x, p.z);
    for (const r of world.rooms) {
      x.fillStyle = here === r ? '#4a3a2e' : '#2a2320'; x.fillRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
      x.strokeStyle = here === r ? '#d0ae7a' : '#65574a'; x.lineWidth = here === r ? .5 : .32; x.strokeRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
    }
    x.fillStyle = '#0b0909';
    for (const r of world.colliders) if (Math.abs(r.z - p.z) < 35 && Math.abs(r.x - p.x) < 35) x.fillRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
    const cp = world.checkpoint;
    x.save(); x.translate(cp.x, cp.z); x.rotate(Math.PI / 4); x.fillStyle = game.checkpointIndex ? '#a8c49a' : '#c2a878'; x.shadowColor = x.fillStyle; x.shadowBlur = 6; x.fillRect(-.6, -.6, 1.2, 1.2); x.restore();
    const beat = .75 + Math.sin(elapsed * 6) * .25;
    for (const e of game.enemies) {
      if (e.dead || Math.hypot(e.x - p.x, e.z - p.z) > 23) continue;
      x.fillStyle = e.boss ? '#ee7a3c' : '#c8302b'; x.shadowColor = '#ff2a1a'; x.shadowBlur = e.active ? 8 * beat : 3;
      x.beginPath(); x.arc(e.x, e.z, e.boss ? .95 : .45, 0, Math.PI * 2); x.fill();
    }
    x.shadowBlur = 0;
    x.save(); x.translate(p.x, p.z); x.rotate(-p.face);
    x.fillStyle = '#f3e3c3'; x.shadowColor = '#f0c27a'; x.shadowBlur = 8;
    x.beginPath(); x.moveTo(0, 1.3); x.lineTo(-.85, -.8); x.lineTo(0, -.42); x.lineTo(.85, -.8); x.closePath(); x.fill();
    x.restore(); x.restore();
  }
  function updateOverview() {
    const p = game.player, total = game.enemies.length;
    let kills = 0; for (const e of game.enemies) if (e.dead) kills++;
    hudText('kill-progress', kills + ' / ' + total);
    hudTransform('chapter-progress', `scaleX(${kills / Math.max(total, 1)})`);
    document.querySelector('.hero-card').classList.toggle('sealed', !!game.checkpointIndex);
    document.querySelector('.flask-button').classList.toggle('empty', p.flasks === 0);
    for (const b of document.querySelectorAll('.combat-pad .action')) {
      const key = b.dataset.action || b.dataset.hold;
      const active = key === 'light' ? p.attack && !p.attack.heavy : key === 'heavy' ? p.attack && p.attack.heavy && !p.attack.special : key === 'dodge' ? p.dodge > 0 : key === 'special' ? !!(p.attack && p.attack.special) : cryEffect.remaining > 0;
      b.classList.toggle('pressed', !!active);
      const cost = B.Game.resources.costs[key];
      b.classList.toggle('unavailable', cost > 0 && p.stamina < cost && !active);
      if (key === 'light' || key === 'heavy') b.style.setProperty('--progress', active && p.attack ? clamp(p.attack.age / p.attack.duration, 0, 1) : 0);
    }
    drawMinimap(p);
  }
  function chapterObjective(room) {
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
    if (remaining) return 'Çıkış mühürlü. Bu salonda ' + remaining + ' düşman kaldı.';
    return idx === 4 ? 'Mühür açıldı. Şapeldeki yemin taşını bul.' : 'Mühür açıldı. Kuzeydeki salona ilerle.';
  }
  function hud(dt) {
    const p = game.player;
    cryEffect.remaining = !p.dead && game.state === 'playing' ? p.rageTime || 0 : 0;
    buffUI.update(timedEffects);
    let buffCount = 0;
    for (const effect of timedEffects) if (Number.isFinite(effect.remaining) && effect.remaining > 0) buffCount++;
    const buffRows = Math.ceil(buffCount / 3);
    if (buffRows !== lastBuffRows) { lastBuffRows = buffRows; $('hud').style.setProperty('--buff-rows', buffRows); }
    const hp = clamp(p.hp / p.maxHp, 0, 1);
    hudText('health-number', Math.ceil(Math.max(0, p.hp))); hudText('health-max', '/ ' + Math.round(p.maxHp));
    if (B.HUD) B.HUD.vitals(p, dt);   // liquid health and stamina orbs (src/hud.js)
    const orb = document.querySelector('.health-orb');
    orb.classList.toggle('low', hp < .3); document.body.classList.toggle('low-hp', hp < .3 && !p.dead);
    if (lastHp !== null && p.hp < lastHp - .5) tap(orb);
    if (lastHp !== null && p.hp > lastHp + 3) { orb.classList.remove('healed'); void orb.offsetWidth; orb.classList.add('healed'); }
    lastHp = p.hp;
    document.querySelector('.stamina-orb').classList.toggle('winded', p.stamina < 25);
    const flaskBtn = document.querySelector('.flask-button');
    if (lastFlasks !== null && p.flasks !== lastFlasks) tap(flaskBtn);
    lastFlasks = p.flasks; hudText('flask-count', p.flasks ?? 0);
    const rageBtn = document.querySelector('.action-rage');
    const rageReady = p.stamina >= B.Game.resources.costs.rage && !(p.rageCd > 0) && !(p.rageTime > 0) && !p.roar && !p.dead;
    rageBtn.classList.toggle('ready', rageReady);
    rageBtn.classList.toggle('burning', cryEffect.remaining > 0);
    document.body.classList.toggle('raging', cryEffect.remaining > 0);
    updateOverview();
    if (B.HUD && B.HUD.skills) B.HUD.skills(p, dt);   // cooldown sweeps, stamina cost hints (src/hud.js)
    const targetEnemy = !p.dead && game.state === 'playing' ? game.attackTarget || game.enemies.find(e => e.boss && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 28) : null;
    targetUI.update(targetEnemy);
    const r = world.roomAt(p.x, p.z);
    if (r) hudText('objective', chapterObjective(r));
    if (r && r.id !== roomId) {
      roomId = r.id; $('location').textContent = r.name;
      const idx = typeof r.id === 'number' ? r.id : world.rooms.indexOf(r);
      if (B.Audio.say && idx > 0) B.Audio.say(['intro', 'chains', 'ritual', 'crypt', 'rot', 'checkpoint', 'boss'][Math.min(6, idx)]);
    }
    // Same reach as the stone's own auto-seal (combat.js): the button shows when enemies still keep it from sealing.
    const cp = world.checkpoint, near = cp && Math.hypot(p.x - cp.x, p.z - cp.z) < 6.1 && game.checkpointIndex === 0;
    $('interact').classList.toggle('hidden', !near);
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
      const push = ragePush > 0 ? Math.sin(Math.min(1, (1 - ragePush) / .18) * Math.PI / 2) * Math.min(1, ragePush / .6) : 0, near = 1 - .17 * push;
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
    fpsStart = fpsFrames = 0;
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
    return { schema: 4, game: 'Kabir Azabı', build: 62, capturedAt: new Date().toISOString(), view,
      location: { room: world.rooms?.[roomId]?.name || roomId, x: game.player.x, z: game.player.z },
      display: { width: post.width, height: post.height, windowWidth: innerWidth, windowHeight: innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1, renderPixelRatio: renderer.getPixelRatio() },
      settings: { quality: cfg.quality, displayMode: cfg.displayMode, displayScale: displayPlan?.scale, edgeSmoothing: 'smaa-1x', smaa: post.smaa, frameLimit: cfg.fps },
      adapter: readGraphicsAdapter(), ...performanceMeter.report(),
      gpu: { available: post.timingAvailable, enabled: post.timingEnabled, ready: post.timingReady,
        error: post.timingError, sampleIntervalMs: post.timingSampleIntervalMs, milliseconds: post.gpuSections },
      rendering: { ...renderer.info.render, multiDraw, programs: renderer.info.programs.length,
        memory: { ...renderer.info.memory }, lastFrame: { ...post.frameResources } },
      loading: warmStats,
      measurementScope: 'CPU samples describe the JavaScript and draw submission of presented callbacks; callbacks skipped by the Mac frame cap are not included in CPU stages. GPU scene includes shadows; GPU post includes AO, bloom and composition. GPU excludes HUD contexts and screen presentation. CPU and GPU run concurrently; do not add their times.' };
  }
  function downloadPerformance() {
    // A local download: nothing is sent to a server and no browser history is collected.
    const blob = new Blob([JSON.stringify(performanceReport(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'kabir-performans.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function drawFps(fps, ms) {
    const aa = 'Kenar yumuşatma açık';
    const scale = +renderer.getPixelRatio().toFixed(2);
    const rate = Number.isFinite(fps) ? `${Math.round(fps)} FPS · ${ms.toFixed(1)} ms` : 'FPS ölçülüyor…';
    const report = performanceMeter.report(), gpu = post.gpuSections;
    const showMs = value => Number.isFinite(value) ? value.toFixed(2) + ' ms' : 'ölçülüyor…';
    const cpu = report.cpuMs;
    const gpuText = post.timingAvailable === false ? 'GPU süresi bu tarayıcıda ölçülemiyor'
      : `GPU sahne ${showMs(gpu.scene)} · efekt ${showMs(gpu.post)}\nGPU toplam ${showMs(gpu.total)} · %95 ${showMs(gpu.totalP95)}`;
    $('fps-values').textContent = `${rate} · ${cfg.fps ? 'sınır ' + cfg.fps : 'sınır kapalı'}\n${aa}\nÇizim ${post.width} × ${post.height} · ekran noktası başına ${scale}×\n` +
      `CPU toplam ${showMs(cpu.total?.mean)} · %95 ${showMs(cpu.total?.p95)}\n` +
      `Kare aralığı %99 ${showMs(report.frameIntervalsMs?.p99)} · en uzun ${showMs(report.frameIntervalsMs?.max)}\n` +
      `Hareket ${showMs(cpu.simulation?.mean)} · çizim hazırlığı ${showMs(cpu.presentation?.mean)}\n` +
      `Çizim gönderimi ${showMs(cpu.submission?.mean)} · arayüz ${showMs(cpu.hud?.mean)}\n${gpuText}\n` +
      `${renderer.info.render.calls} çizim · ${(renderer.info.render.triangles / 1000).toFixed(0)} bin üçgen\n` +
      `Tarayıcı ${Number.isFinite(report.callbackHz) ? Math.round(report.callbackHz) + ' kare/sn' : 'ölçülüyor…'}\n${readGraphicsAdapter().renderer || 'Ekran kartı adı gizli'}`;
  }
  function fpsTick(ts) {
    if (!cfg.showFps) return;
    if (!fpsStart) { fpsStart = ts; fpsFrames = 0; return; }
    fpsFrames++;
    const span = ts - fpsStart;
    if (span < 500) return;
    drawFps(fpsFrames * 1000 / span, span / fpsFrames);
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
    const cpuStart = measured ? performance.now() : 0;
    if (measured) performanceMeter.callback(ts);
    const dt = clamp((ts - (last || ts)) / 1000, 0, .05); last = ts; elapsed += dt; frame++;
    visualDt = Math.min(.1, visualDt + dt);
    const playing = view === 'playing' && game.state === 'playing';
    if (playing) {
      if (heldLight || keyDown('light')) { lightRepeat += dt; if (lightRepeat >= .12) { actions.light = true; if (heldLight) actions.near = true; lightRepeat = 0; } }
      const stopped = Math.min(dt, hitPause), simDt = dt - stopped; hitPause -= stopped;
      // Input events remain queued during contact emphasis; all combat clocks share simDt
      // so neither enemies nor i-frames gain a hidden time advantage.
      if (simDt > .000001) { const inp = pollInput(); if (view === 'playing') { game.update(simDt, inp); fxStep(simDt); footstepFeedback(); } }
      hudTimer += dt; if (hudTimer > .08) { hud(hudTimer); hudTimer = 0; }
    }
    else if ((game.state === 'dead' || game.state === 'won') && view === 'playing') { game.update(dt, { ...input, x: 0, z: 0, light: false, heavy: false, clickLight: false, clickHeavy: false, holdLight: false, holdHeavy: false, target: null, dodge: false, heal: false, rage: false }); fxStep(dt); }
    if (view === 'pause') { const pad = connectedPad(); if (pad) { if (pad.buttons[9]?.pressed && !lastPad[9]) show('playing'); rememberPad(pad); } else lastPad.length = 0; }
    if (announceTimer > 0) { announceTimer -= dt; if (announceTimer <= 0) $('announcement').classList.remove('show'); }
    flash = Math.max(0, flash - dt * 1.7);
    syncWarnings(dt);
    const fighting = game.enemies.some(e => !e.dead && e.active && Math.hypot(e.x - game.player.x, e.z - game.player.z) < 10);
    if (fighting) announceTimer = Math.min(announceTimer, .35);
    if (fighting && firstHint > 0) { $('tutorial').classList.add('hidden'); firstHint = 0; }
    B.Audio.update(dt, { playing: view === 'playing' && game.state === 'playing', combat: fighting, boss: game.enemies.some(e => e.boss && !e.dead && Math.hypot(e.x - game.player.x, e.z - game.player.z) < 25) });
    const simulationEnd = measured ? performance.now() : 0;
    // While new shader programs compile in the background the last frame stays on screen (drawing would block the page).
    if (!warming && renderClock.due(ts, cfg.fps)) {
      // Simulation and input above keep their clocks. Prepare the visible frame
      // once, using all time since the last draw, even on a faster-refresh screen.
      const drawDt = visualDt; visualDt = 0;
      if (view === 'title') { game.player.model.animate(drawDt, { time: elapsed, move: 0 }); for (const e of game.enemies) if (!e.dead) e.model.animate(drawDt, { time: elapsed, move: 0 }); }
      world.update(paused ? drawDt * .35 : drawDt, elapsed, game.player); cameraStep(drawDt); atmosphereStep(drawDt);
      // Three updates the scene and camera matrices inside render; a separate
      // complete scene walk here would repeat the same work.
      const presentationEnd = measured ? performance.now() : 0;
      game.beginRenderTraversal();
      try { renderer.info.reset(); post.render(elapsed); }
      finally { game.endRenderTraversal(); }
      const submissionEnd = measured ? performance.now() : 0;
      $('damage-flash').style.opacity = flash * .8;
      document.body.classList.toggle('in-combat', fighting && view === 'playing');
      drawWarnings();
      if (B.HUD && B.HUD.frame) B.HUD.frame(drawDt);
      if (measured) {
        const cpuEnd = performance.now();
        performanceMeter.record(ts, { simulation: simulationEnd - cpuStart, presentation: presentationEnd - simulationEnd,
          submission: submissionEnd - presentationEnd, hud: cpuEnd - submissionEnd, total: cpuEnd - cpuStart, ...post.cpuSections },
          { view, room: roomId, x: game.player.x, z: game.player.z, combat: fighting, hitPause, ...post.frameResources });
      }
      fpsTick(ts);
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
        // While the picture is stepped down the extras shrink too: fewer casting characters, shorter-lived marks and sparks.
        if (cfg.fps > 0 && cfg.fps <= 64 && cfg.quality === 'high') {
          const busy = stepped <= .86;
          cfg.shadowReach = busy ? 9 : 13; cfg.decals = busy ? 40 : 60; cfg.particles = busy ? 340 : 480;
          safe(() => game.setQuality(cfg));
        }
      }
    }
  }

  /* ───────────── Shader warm-up ───────────── */
  // Compiling ~130 lit, skinned and graded programs takes seconds on some GPUs, and a draw that needs an unfinished
  // program blocks the page. So before the title appears (and after a preset change) every program is started in
  // small batches with a painted frame between them (the browser compiles in parallel where it can:
  // KHR_parallel_shader_compile), then the big textures are uploaded a few per frame. The bar follows the work.
  let warming = null, lowTextures = false, warmStats = null;
  const WARM_BATCH = +(Q.get('warmbatch') || 48), WARM_LOG = Q.has('warmlog'), WARM_SYNC = /HeadlessChrome/.test(navigator.userAgent) && !Q.has('warm');
  function prepareWarmScene() {
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
      if (o.castShadow && depth && !seen.has(depth.uuid + kind)) {
        seen.add(depth.uuid + kind);
        jobs.push(Object.assign(Object.create(o), { material: depth, depthWarm: true }));
      }
    });
    if (game.limbs && game.limbs.warmGeometryObjects) for (const o of game.limbs.warmGeometryObjects()) {
      if (!seenGeometry.has(o.geometry)) { seenGeometry.add(o.geometry); geometryObjects.push(o); }
    }
    return { jobs, geometryObjects, textures: Array.from(textures).filter(t => t.image && !t.isCompressedTexture) };
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
    let total = 1;
    const frame = () => new Promise(res => { let done = false; const go = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(go); setTimeout(go, 120); });
    const progress = k => { if (onProgress) onProgress(k); if (fill) fill.style.transform = `scaleX(${Math.max(.04, k)})`; };
    const report = () => progress(.15 + .85 * Math.min(1, (next + tex / 3 + geo / 12) / total));
    async function run() {
      checkContext();
      // Cut meshes are expensive to build on a foe's first killing blow. Prepare
      // each cached cut under the loading cover, yielding so the bar can still move.
      if (game.limbs && game.limbs.prepare) {
        const cutStart = performance.now();
        await game.limbs.prepare(game.enemies, async (done, count) => {
          progress(.15 * done / Math.max(1, count));
          if (!WARM_SYNC) await frame();
        });
        warmStats.cuts = Math.round(performance.now() - cutStart);
        warmStats.cutVariants = game.limbs.stats().cached;
      }
      checkContext(); work = prepareWarmScene();
      warmStats.jobs = work.jobs.length;
      total = work.jobs.length + work.textures.length / 3 + work.geometryObjects.length / 12 + 1;
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
      while (tex < work.textures.length) {
        checkContext();
        for (let i = 0; i < 3 && tex < work.textures.length; i++) safe(() => renderer.initTexture(work.textures[tex++]));
        report(); await frame();
      }
      warmStats.textures = Math.round(performance.now() - t0);
      // compile() prepares materials only. Upload the hidden rooms' vertex,
      // index and instance data now so entering a room cannot first allocate it.
      const geometryStart = performance.now();
      if (renderer.initGeometry) while (geo < work.geometryObjects.length) {
        checkContext();
        for (let i = 0; i < 12 && geo < work.geometryObjects.length; i++) renderer.initGeometry(work.geometryObjects[geo++]);
        report(); if (!WARM_SYNC) await frame();
      }
      warmStats.geometryObjects = geo; warmStats.geometryUploads = Math.round(performance.now() - geometryStart);
      // One real frame (shadow-map variants) while the cover is still up.
      checkContext(); safe(() => { cameraStep(0); atmosphereStep(0); post.render(elapsed); });
      // Automatic-resolution sizes are built now, so a later step is only a reference swap. Skipped on 120 Hz-class targets.
      if (AUTO_SCALE && cfg.fps > 0 && cfg.fps <= 64 && post.prewarm) safe(() => {
        const sizes = [], v = { width: innerWidth, height: innerHeight, pixelRatio: window.devicePixelRatio };
        for (const lv of scaler.levels) { const pl = DISPLAY.plan(v, { ...cfg, dynScale: lv }); if (!sizes.some(z => z[0] === pl.width && z[1] === pl.height)) sizes.push([pl.width, pl.height]); }
        post.prewarm(sizes);
      });
      warmStats.total = Math.round(performance.now() - t0); warmStats.count = renderer.info.programs.length;
      if (WARM_LOG) console.warn('[warm] done', JSON.stringify(warmStats));
      return true;
    }
    warming = run().catch(e => { console.warn('[Kabir Azabı]', e); return false; }).then(ok => { warming = null; if (box) box.classList.add('hidden'); if (onProgress) onProgress(1); return ok; });
    return warming;
  }

  /* ───────────── Boot ───────────── */
  function fatal(err) { console.error(err); $('loading').classList.add('hidden'); $('fatal').classList.remove('hidden'); $('fatal').querySelector('p').textContent = String(err && err.message || err); }
  window.addEventListener('error', e => { if (!ready) fatal(e.error || e.message); });
  // After a jump across the map (title, respawn) the rooms, pooled lights and the room grade arrive at once
  // instead of fading in over a second of darkness.
  function snapScene() { safe(() => { for (let i = 0; i < 4; i++) world.update(.1, elapsed, game.player); if (rig.snap) rig.snap(); }); }
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
    renderer.setOpaqueSort((a, b) => a.groupOrder !== b.groupOrder ? a.groupOrder - b.groupOrder : a.renderOrder !== b.renderOrder ? a.renderOrder - b.renderOrder
      : a.material.id !== b.material.id ? a.material.id - b.material.id : variantOf(a.object) !== variantOf(b.object) ? variantOf(a.object) - variantOf(b.object)
      : a.z !== b.z ? a.z - b.z : a.id - b.id);
    multiDraw = renderer.extensions.has('WEBGL_multi_draw') && !Q.has('nobatch');
    world = B.World.build(scene, { multiDraw });
    game = B.Game.create(world, { scene, emit: event, sound: (n, o) => B.Audio.play(n, o), fx });
    makeFX(); postProcess(); setupUI();
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
    safe(() => {
      const depth = new Map();
      scene.traverse(o => {
        if (!o.isMesh || !o.castShadow || !o.material || Array.isArray(o.material) || o.customDepthMaterial) return;
        const key = o.material.uuid + (o.isSkinnedMesh ? 's' : o.isBatchedMesh ? 'b' : o.isInstancedMesh ? 'i' : 'm');
        let dm = depth.get(key);
        if (!dm) {
          dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
          const m = o.material;
          dm.side = m.shadowSide !== null ? m.shadowSide : m.side === THREE.FrontSide ? THREE.BackSide : m.side === THREE.BackSide ? THREE.FrontSide : THREE.DoubleSide;
          dm.alphaMap = m.alphaMap; dm.alphaTest = m.alphaTest;
          dm.displacementMap = m.displacementMap; dm.displacementScale = m.displacementScale; dm.displacementBias = m.displacementBias;
          dm.clipShadows = m.clipShadows; dm.clippingPlanes = m.clippingPlanes; dm.clipIntersection = m.clipIntersection;
          // Match the shadow pass, keeping colour maps only for real alpha cutouts.
          if (m.alphaTest > 0) dm.map = m.map;
          else Object.defineProperty(dm, 'map', { get() { return null; }, set() { }, configurable: true });
          depth.set(key, dm);
        }
        o.customDepthMaterial = dm;
      });
    });
    ready = true; applySettings();
    B.app = { scene, camera, renderer, world, game, post, rig, scaler, resetPerformance, settings: cfg, input, get view() { return view; }, begin, show, fx, applySettings, clearFX, warmShaders,
      get warming() { return !!warming; }, get warmStats() { return warmStats; },
      get performance() { return performanceReport(); },
      // Deterministic frame stepping for headless QA pages (virtual time barely runs requestAnimationFrame).
      step(n = 1) { for (let i = 0; i < n; i++) { qaClock = Math.max(qaClock, last || performance.now()) + 1000 / 60; frameStep(qaClock); } renderClock.reset(); } };
    $('fps-report').addEventListener('click', downloadPerformance);
    $('game').addEventListener('webglcontextlost', e => {
      e.preventDefault(); graphicsLost = graphicsRecovering = true; graphicsEpoch++; graphicsAdapter = null;
      resetPerformance(); show('pause'); notify('Grafik bağlantısı kesildi. Oyun duraklatıldı; bağlantı bekleniyor.');
    });
    $('game').addEventListener('webglcontextrestored', () => {
      graphicsLost = false; graphicsRecovering = true;
      const epoch = graphicsEpoch;
      // Three has restored its renderer first. Warm all rooms and cached cuts
      // again before the player resumes, rather than stall at every first draw.
      Promise.resolve(warming).then(() => {
        if (graphicsLost || graphicsEpoch !== epoch) return false;
        applySettings(); last = visualDt = 0; renderClock.reset();
        return warmShaders(true);
      }).then(ok => {
        if (graphicsLost || graphicsEpoch !== epoch) return;
        if (ok === false) throw Error('Grafik hazırlığı tamamlanamadı.');
        graphicsRecovering = false; last = visualDt = 0; renderClock.reset();
        notify('Grafikler yeniden hazır. Devam et ile yolculuğa dönebilirsin.');
      }).catch(e => { if (graphicsEpoch === epoch) { console.warn('[Kabir Azabı]', e); notify('Grafikler hazırlanamadı. Sayfayı yeniden yükle.'); } });
    });
    loadProgress(.96, 'Işıklar ve gölgeler hazırlanıyor…');
    return warmShaders(false, k => loadProgress(.96 + .04 * k)).then(() => {
      loadProgress(1, 'Hazır.');
      $('loading').classList.add('hidden');
      show('title');
      safe(makePortrait);
      requestAnimationFrame(loop);
      if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
  loadProgress(.92, 'Karakterler hazırlanıyor…');
  // Düşük loads the character textures at half size and touch tablets cap them at 1024 px (up to ~88 MB less video memory).
  lowTextures = cfg.quality === 'low';
  Promise.resolve().then(async () => {
    await Promise.all([
      B.Models.prepare({ textureScale: lowTextures ? .5 : 1, maxTexture: coarsePointer ? 1024 : 2048 }),
      B.TargetHUD.prepare()
    ]);
    if (B.Audio.prepare) {
      loadProgress(.94, 'Tapınağın sesleri hazırlanıyor…');
      try { await B.Audio.prepare(k => loadProgress(.94 + .01 * k)); }
      catch (e) { console.warn('[Kabir Azabı] Ses hazırlığı tamamlanamadı.', e); }
    }
  })
    .then(() => { loadProgress(.95, 'Mahzen aydınlanıyor…'); return boot(); }).catch(fatal);
})();
