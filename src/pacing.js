/* KABİR AZABI — choose one available browser frame near each render deadline.
   Gameplay may still update on every callback; this clock only schedules drawing. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};

  function create() {
    let next = null, interval = 0, lastTimestamp = null;

    function reset() {
      next = null;
      interval = 0;
      lastTimestamp = null;
    }

    function due(ts, fps) {
      if (!Number.isFinite(ts) || lastTimestamp !== null && ts <= lastTimestamp) return false;
      lastTimestamp = ts;
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
      const half = interval * .5, epsilon = interval * 1e-6;
      // Round the deadline to the available callback, instead of rejecting a
      // slightly early vsync and then skipping its deadline on the following one.
      if (ts + epsilon < next - half) return false;
      next += interval;
      // A long stall must not leave a queue of old deadlines to draw in a burst.
      if (next < ts - half) next = ts + interval;
      return true;
    }

    return { due, reset };
  }

  B.Pacing = { create };
})();
