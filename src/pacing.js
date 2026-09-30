/* KABİR AZABI — choose one available browser frame near each render deadline.
   Gameplay may still update on every callback; this clock only schedules drawing. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};

  function create() {
    let next = null, interval = 0, lastTimestamp = null, callbackInterval = 0;

    function reset() {
      next = null;
      interval = 0;
      lastTimestamp = null;
      callbackInterval = 0;
    }

    function due(ts, fps) {
      if (!Number.isFinite(ts) || lastTimestamp !== null && ts <= lastTimestamp) return false;
      // Smooth the actual callback spacing; a pause must not redefine the display rate.
      const gap = lastTimestamp === null ? 0 : ts - lastTimestamp;
      lastTimestamp = ts;
      if (gap > 0 && gap < 100) callbackInterval = callbackInterval ? callbackInterval + (gap - callbackInterval) * .1 : gap;
      else if (gap >= 100) callbackInterval = 0;
      const requested = Number.isFinite(fps) && fps > 0 ? 1000 / fps : 0;
      const period = Number.isFinite(requested) ? requested : 0;
      if (!period) {
        next = null;
        interval = 0;
        return true;
      }
      if (next === null || interval !== period) {
        interval = period;
        next = ts;
      }
      const half = Math.min(interval, callbackInterval || interval) * .5, epsilon = interval * 1e-6;
      // The nearest callback is half a browser interval away, not half the FPS cap.
      // A wider window makes tiny vsync jitter alternate between early and late draws.
      if (ts + epsilon < next - half) return false;
      const ratio = callbackInterval ? interval / callbackInterval : 0, whole = Math.round(ratio);
      // Exact display divisors follow the selected callback rather than a drifting deadline.
      if (whole >= 1 && Math.abs(ratio - whole) <= whole * .002) next = ts + interval;
      else next += interval;
      // A long stall must not leave a queue of old deadlines to draw in a burst.
      if (next < ts - half) next = ts + interval;
      return true;
    }

    return { due, reset };
  }

  B.Pacing = { create };
})();
