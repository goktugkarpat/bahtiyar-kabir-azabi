/* KABİR AZABI — desktop render resolution, independent of the quality preset.
   A screen point is a CSS pixel; native rendering also includes the screen's DPR. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const defaults = Object.freeze({ displayVersion: 2, displayMode: 'native', msaa: 0 });

  function settings(raw) {
    // Old saves used CSS-pixel multipliers and forced MSAA. They must not turn
    // expensive antialiasing back on when first adopting native resolution.
    if (!raw || ![1, defaults.displayVersion].includes(raw.displayVersion)) return { ...defaults };
    const displayMode = raw.displayMode === 'smooth' ? 'smooth' : 'native';
    return {
      displayVersion: defaults.displayVersion,
      displayMode,
      msaa: [0, 2, 4].includes(raw.msaa) ? raw.msaa : defaults.msaa
    };
  }

  const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
  const pixels = value => Math.max(1, Math.floor(value));

  function plan(view, raw) {
    const v = view || {}, cfg = settings(raw);
    const cssWidth = pixels(positive(v.width, 1)), cssHeight = pixels(positive(v.height, 1));
    const nativeRatio = positive(v.pixelRatio, 1);
    const nativeWidth = pixels(cssWidth * nativeRatio), nativeHeight = pixels(cssHeight * nativeRatio);
    const scale = cfg.displayMode === 'smooth' ? .75 : 1;
    const requestedRatio = nativeRatio * scale;
    // No pixel budget or preset cap: the only limit is the GPU's supported size.
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
      limited: pixelRatio < requestedRatio,
      // Use the actual display density, never the OS name or touch capability.
      highDensity: nativeRatio > 1.25
    };
  }

  B.Display = { defaults, settings, plan };
})();
