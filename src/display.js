/* KABİR AZABI — desktop render resolution, independent of the quality preset.
   A screen point is a CSS pixel; native rendering also includes the screen's DPR. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const defaults = Object.freeze({ displayVersion: 4, displayMode: 'auto', renderScale: 1, msaa: 2 });
  const MODES = ['auto', 'native'];
  const MIN_DYNAMIC = .75;

  function settings(raw) {
    // Old saves used CSS-pixel multipliers. Edge smoothing is now the SMAA post pass (no hardware MSAA), independent of any saved value.
    if (!raw || ![1, 2, 3, defaults.displayVersion].includes(raw.displayVersion)) return { ...defaults };
    const displayMode = MODES.includes(raw.displayMode) ? raw.displayMode : defaults.displayMode;
    return {
      displayVersion: defaults.displayVersion,
      displayMode,
      renderScale: [1, 1.25, 1.5].includes(raw.renderScale) ? raw.renderScale : 1,
      msaa: defaults.msaa   // legacy key, no longer a sample count: edge smoothing is always on (SMAA, post.js)
    };
  }

  const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
  const pixels = value => Math.max(1, Math.floor(value));

  function deviceProfile(view) {
    const nav = typeof navigator === 'object' ? navigator : {};
    const ua = view.userAgent === undefined ? nav.userAgent || '' : view.userAgent;
    const touch = view.maxTouchPoints === undefined ? nav.maxTouchPoints || 0 : view.maxTouchPoints;
    if (/iPad|iPhone|iPod/i.test(ua) || /Macintosh|MacIntel/i.test(ua) && touch > 1) return { name: 'ios', scale: .75 };
    if (/Android/i.test(ua)) return { name: 'android', scale: .8 };
    if (/Macintosh|Mac OS X|MacIntel/i.test(ua)) return { name: 'mac', scale: .7 };
    return { name: 'desktop', scale: 1 };
  }

  function plan(view, raw) {
    const v = view || {}, cfg = settings(raw);
    const cssWidth = pixels(positive(v.width, 1)), cssHeight = pixels(positive(v.height, 1));
    const nativeRatio = positive(v.pixelRatio, 1);
    const nativeWidth = pixels(cssWidth * nativeRatio), nativeHeight = pixels(cssHeight * nativeRatio);
    const device = deviceProfile(v);
    let requestedRatio = nativeRatio * (cfg.displayMode === 'native' ? 1 : device.scale);
    // Desktop PCs retain native pixels; Retina and tablets begin at a device budget.
    // User supersampling always multiplies this baseline, without a quality-dependent cap.
    const dyn = raw && Number.isFinite(raw.dynScale) ? Math.min(1, Math.max(MIN_DYNAMIC, raw.dynScale)) : 1;
    requestedRatio *= cfg.renderScale * (cfg.displayMode === 'auto' && device.name !== 'desktop' && cfg.renderScale === 1 ? dyn : 1);
    const scale = requestedRatio / nativeRatio;
    const maxSize = Number.isFinite(v.maxSize) && v.maxSize > 0 ? pixels(v.maxSize) : Infinity;
    const pixelRatio = Math.min(requestedRatio, maxSize / cssWidth, maxSize / cssHeight);
    return {
      pixelRatio,
      width: pixels(cssWidth * pixelRatio),
      height: pixels(cssHeight * pixelRatio),
      nativeWidth,
      nativeHeight,
      nativeRatio,
      scale,
      reduced: requestedRatio < nativeRatio,
      limited: pixelRatio < requestedRatio,
      // Use the actual display density, never the OS name or touch capability.
      highDensity: nativeRatio > 1.25
    };
  }


  /* Automatic resolution steps for machines that cannot hold their frame rate at the chosen size (60 Hz targets only).
     It looks only at the spacing of drawn frames, so it needs no GPU timers: many late frames in a short window means
     the GPU is the limit. It steps down quickly (a few percent of the size per axis at a time, never below MIN_DYNAMIC (.75)),
     climbs back very slowly after a long clean stretch and, if a climb fails at once, remembers that size for a while, so
     the picture never pumps. Strong machines and 120 Hz targets never get here: enabled is false for them. */
  function createScaler(options) {
    const o = options || {};
    const levels = o.levels || [1, .93, .86, .8, .75];
    const WINDOW = 30, LATE = 1.4, COOLDOWN = 2500, GRACE = 5000, CLEAN = 20000, RETRY = 15000, MEMORY = 180000;
    let index = 0, minIndex = 0, minUntil = 0, lastChange = -1e9, lastUp = -1e9, lastLate = -1e9, lastDraw = null, since = null;
    const late = [];
    const gaps = [];      // spacing of browser frame callbacks (any callback, drawn or not)
    let lastCallback = null, period = 0, best = Infinity;
    let hintIndex = 0, hintUntil = 0, hintFrom = -1;   // predicted heavy scene (several enemies awake): hold a lower size until it is over
    function reset() { late.length = 0; lastDraw = null; since = null; hintIndex = 0; hintFrom = -1; }
    // A cheap prediction from the game (enemies awake near the hero): step down BEFORE the frames get late and hold the size
    // for `hold` ms after the last call. With pre-built render targets a step costs nothing, so following the fight is free.
    function hint(level, ts, hold) {
      const i = Math.min(levels.length - 1, Math.max(0, level | 0));
      if (i > 0 && hintFrom < 0) hintFrom = index;
      if (i > hintIndex) hintIndex = i;
      hintUntil = ts + (hold || 4000);
    }
    function callback(ts) {
      if (lastCallback !== null && ts > lastCallback) {
        const gap = ts - lastCallback;
        if (gap < 100) {
          gaps.push(gap);
          if (gaps.length >= 45) {
            // The screen's refresh period is the fastest steady spacing ever seen: an overloaded page also receives its
            // callbacks late, so the current spacing must not redefine what "on time" means.
            const sorted = gaps.slice().sort((x, y) => x - y);
            best = Math.min(best, sorted[sorted.length >> 1]);
            gaps.length = 0;
          }
        }
      }
      lastCallback = ts;
    }
    // Forget the learned refresh period (the window moved to another display, or the tab came back).
    function display() { best = Infinity; gaps.length = 0; lastCallback = null; reset(); }
    // Returns the new scale when it changed, otherwise null. `fps`: the frame limit (0 = none).
    function frame(ts, fps, enabled) {
      if (!enabled) { reset(); return null; }
      if (!Number.isFinite(best)) return null;   // refresh period not learned yet
      period = Math.max(fps > 0 ? 1000 / fps : 0, best);
      if (period < 15.5) { reset(); return null; }   // 75 Hz and faster targets are left alone
      if (lastDraw !== null && ts > lastDraw) {
        const gap = ts - lastDraw;
        if (gap < 400) { const l = gap > period * LATE ? 1 : 0; late.push(l); if (late.length > WINDOW) late.shift(); if (l) lastLate = ts; }
      }
      lastDraw = ts;
      // Entering the game (shader/texture first use, camera swoop) causes a few late frames that say nothing about the GPU.
      if (since === null) since = ts;
      if (minIndex && ts >= minUntil) minIndex = 0;
      if (hintIndex && ts >= hintUntil) {
        // The busy stretch is over: go back to where we were, unless real late frames pinned the lower size.
        const back = Math.max(hintFrom < 0 ? 0 : hintFrom, minIndex); hintIndex = 0; hintFrom = -1;
        if (index > back && ts - lastLate > 2500) { index = back; lastChange = ts; late.length = 0; return levels[index]; }
      }
      if (hintIndex && index < hintIndex) { index = hintIndex; lastChange = ts; late.length = 0; return levels[index]; }
      if (ts - since < GRACE) { late.length = 0; return null; }
      if (minIndex && ts >= minUntil) minIndex = 0;
      if (ts - lastChange < COOLDOWN || late.length < WINDOW) return null;
      let count = 0, recent = 0;
      for (let i = 0; i < late.length; i++) { count += late[i]; if (i >= late.length - 10) recent += late[i]; }
      if ((count >= 6 || recent >= 4) && index < levels.length - 1) {
        // Half the frames late means far too heavy: skip a step so the picture settles sooner.
        index = Math.min(levels.length - 1, index + (count >= WINDOW / 2 ? 2 : 1));
        if (ts - lastUp < RETRY) { minIndex = index; minUntil = ts + MEMORY; }
        lastChange = ts; late.length = 0;
        return levels[index];
      }
      if (count === 0 && index > Math.max(minIndex, hintIndex) && ts - lastChange > CLEAN && ts - lastLate > CLEAN) {
        index--; lastUp = lastChange = ts; late.length = 0;
        return levels[index];
      }
      return null;
    }
    return { frame, callback, reset, display, hint, get scale() { return levels[index]; }, get index() { return index; }, get period() { return period; }, levels };
  }

  function worldSubmission(rendererName, supported) {
    if (!supported) return { multiDraw: false, reason: 'extension-unavailable' };
    // ANGLE's D3D11 multi-draw implementation loops over each subdraw and
    // updates DrawID uniforms. BatchedMesh gives every repeated stone its own
    // subdraw: one WebGL call can therefore hide hundreds of driver draws.
    // InstancedMesh instead draws all copies of a shape in one native draw,
    // retaining their local vertices, transforms, colours and material hooks.
    const emulated = /Direct3D\s*11|\bD3D11\b|SwiftShader/i.test(rendererName || '');
    return { multiDraw: !emulated, reason: emulated ? 'prefer-native-instancing' : 'multi-draw-supported' };
  }

  function uiBitmapOptions(rendererName) {
    // Small, changing text/map canvases share the browser's GPU raster queue.
    // Keep these small changing bitmaps off that raster queue on NVIDIA/D3D11;
    // the 3D world and the other backends retain their existing drawing path.
    return /NVIDIA/i.test(rendererName || '') && /Direct3D\s*11|\bD3D11\b/i.test(rendererName || '')
      ? Object.freeze({ willReadFrequently: true }) : undefined;
  }

  B.Display = { defaults, settings, plan, deviceProfile, createScaler, worldSubmission, uiBitmapOptions };
})();
