/* KABİR AZABI — opt-in measurements; CPU submission is not GPU execution time. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const LIMIT = 240;
  function summary(values) {
    if (!values.length) return { samples: 0, mean: null, p95: null, p99: null, max: null };
    const sorted = values.slice().sort((a, b) => a - b);
    return { samples: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
      p95: sorted[Math.ceil(sorted.length * .95) - 1], p99: sorted[Math.ceil(sorted.length * .99) - 1], max: sorted[sorted.length - 1] };
  }
  function create() {
    const cpu = {}, intervals = [], callbacks = [], worst = [];
    let lastDraw = null, lastCallback = null, previousCpu = null, previousContext = null, started = null;
    let drawnCount = 0, over8 = 0, over17 = 0, over34 = 0;
    const push = (list, value) => { if (Number.isFinite(value) && value >= 0) { list.push(value); if (list.length > LIMIT) list.shift(); } };
    function reset() {
      for (const name in cpu) delete cpu[name];
      intervals.length = callbacks.length = worst.length = 0;
      lastDraw = lastCallback = null;
      previousCpu = previousContext = started = null;
      drawnCount = over8 = over17 = over34 = 0;
    }
    function callback(ts) {
      if (!Number.isFinite(ts) || ts < 0 || lastCallback !== null && ts <= lastCallback) return;
      if (lastCallback !== null) push(callbacks, ts - lastCallback);
      lastCallback = ts;
    }
    function record(ts, stages, context) {
      if (!Number.isFinite(ts) || ts < 0 || lastDraw !== null && ts <= lastDraw) return;
      if (started === null) started = ts;
      if (lastDraw !== null) {
        const gap = ts - lastDraw;
        push(intervals, gap); drawnCount++;
        if (gap > 8) over8++; if (gap > 17) over17++; if (gap > 34) over34++;
        // Keep the worst intervals for the whole measurement, even after the
        // short rolling window moves on. The gap follows the PREVIOUS frame's
        // CPU work; this association alone does not identify a GPU/browser stall.
        if (worst.length < 20 || gap > worst[worst.length - 1].intervalMs) {
          worst.push({ atMs: ts - started, intervalMs: gap, previousCpuMs: { ...previousCpu }, previousContext: { ...previousContext } });
          worst.sort((a, b) => b.intervalMs - a.intervalMs);
          if (worst.length > 20) worst.pop();
        }
      }
      lastDraw = ts;
      previousCpu = stages; previousContext = context;
      for (const name in stages) push(cpu[name] || (cpu[name] = []), stages[name]);
    }
    function report() {
      const drawn = summary(intervals), raf = summary(callbacks), stages = {};
      for (const name in cpu) stages[name] = summary(cpu[name]);
      return { frameIntervalsMs: drawn, callbackIntervalsMs: raf,
        fps: drawn.mean > 0 ? 1000 / drawn.mean : null,
        callbackHz: raf.mean > 0 ? 1000 / raf.mean : null, cpuMs: stages,
        session: { durationMs: lastDraw === null ? 0 : lastDraw - started, intervals: drawnCount,
          over8Ms: over8, over17Ms: over17, over34Ms: over34,
          worstIntervals: worst.map(row => ({ ...row, previousCpuMs: { ...row.previousCpuMs }, previousContext: { ...row.previousContext } })) } };
    }
    return { reset, callback, record, report };
  }
  B.Performance = { create };
})();
