/* KABİR AZABI — choose one available browser frame near each render deadline.
   Gameplay may still update on every callback; this clock only schedules drawing. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};

  function create() {
    let next = null, interval = 0, lastTimestamp = null, callbackInterval = 0;
    // Screen refresh estimate: the median of the last 90 callback gaps (a few late frames do not move it).
    const gaps = []; let refreshMs = 0, gapAt = 0;

    function reset() {
      next = null;
      interval = 0;
      lastTimestamp = null;
      callbackInterval = 0;
      gaps.length = 0; refreshMs = 0; gapAt = 0;
    }

    // snap: pick the exact divisor of the screen's refresh that is nearest to `fps` (200 Hz screen + 120 -> 100). A cap the screen cannot divide
    // alternates 5 ms and 10 ms frames, which is felt as micro stutter even on G-Sync / FreeSync screens.
    function due(ts, fps, snap) {
      if (!Number.isFinite(ts) || lastTimestamp !== null && ts <= lastTimestamp) return false;
      // Smooth the actual callback spacing; a pause must not redefine the display rate.
      const gap = lastTimestamp === null ? 0 : ts - lastTimestamp;
      lastTimestamp = ts;
      if (gap > 2 && gap < 60) {
        gaps[gapAt++ % 90] = gap;
        if (gaps.length >= 60 && gapAt % 30 === 0) { const sorted = gaps.slice().sort((a, b) => a - b); refreshMs = sorted[sorted.length >> 1]; }
      }
      if (gap > 0 && gap < 100) callbackInterval = callbackInterval ? callbackInterval + (gap - callbackInterval) * .1 : gap;
      else if (gap >= 100) callbackInterval = 0;
      let requested = Number.isFinite(fps) && fps > 0 ? 1000 / fps : 0;
      if (snap && requested && refreshMs) {
        const hz = Math.round(1000 / refreshMs);
        if (hz > 50) requested = 1000 / (hz / Math.max(1, Math.round(hz / fps)));
      }
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
