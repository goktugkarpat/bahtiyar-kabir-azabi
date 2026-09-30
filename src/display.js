/* KABİR AZABI — desktop render resolution, independent of the quality preset.
   A screen point is a CSS pixel; native rendering also includes the screen's DPR. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const defaults = Object.freeze({ displayVersion: 3, displayMode: 'auto', msaa: 0 });
  const MODES = ['auto', 'native', 'smooth'];

  function settings(raw) {
    // Old saves used CSS-pixel multipliers and forced MSAA. They must not turn
    // expensive antialiasing back on when first adopting native resolution.
    if (!raw || ![1, 2, defaults.displayVersion].includes(raw.displayVersion)) return { ...defaults };
    const displayMode = MODES.includes(raw.displayMode) ? raw.displayMode : defaults.displayMode;
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
    let requestedRatio = nativeRatio;
    if (cfg.displayMode !== 'native' && nativeRatio > 1.25) {
      // Retina's four pixels per screen point remain expensive even with shadows
      // off. The automatic mode follows quality; explicit Native stays native.
      const qualityRatio = raw?.quality === 'low' ? 1 : raw?.quality === 'medium' ? 1.25 : 1.5;
      const budget = raw?.quality === 'low' ? 2000000 : raw?.quality === 'medium' ? 2500000 : 3500000;
      requestedRatio = Math.min(nativeRatio, qualityRatio, Math.sqrt(budget / (cssWidth * cssHeight)));
    }
    // Smooth is always lighter than Auto, including on Retina displays.
    if (cfg.displayMode === 'smooth') requestedRatio *= .75;
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

  B.Display = { defaults, settings, plan };
})();
