/* KABİR AZABI — ses katmanları (ajan:audio). Classic script, no modules; works from file://.
   BABA.AudioPlus is driven by src/audio.js (build / update / after-play hooks) through its CORE window, so it shares the
   engine's buses, reverbs, voice cap (MAX_VOICES) and the narrator ducking. Nothing here runs with ?sessiz (audio.js never
   builds a context then), and nothing allocates per frame: beds are one looping noise source per chapter, events are
   scheduled on timers and every one-shot goes through the engine's tracked voices.
   1) Chapter beds: Tapınak cave breath, Kıyı rain (follows the coast weather) + thunder synced to the lightning flash,
      Taht whistling cold wind + crystal chimes, Ocak furnace roar + far forge hammer, Final void sub swell + whisper air.
   2) Footsteps by ground: stone grit, wet mud/water, iron plate, hollow void; light armour rattle.
   3) Hero body: tired breathing below 35 % health, a short exhale on some dodges.
   4) Interface: panel open/close, map unroll, equip/unequip/deny, quest complete, a bigger level-up. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  let C = null, bed = null, bedCh = 0, ev = {}, breathT = 0, stepN = 0, flashWas = 0;
  let held = new WeakMap();   // steady params: a new automation event only when the target really changes
  function hold(param, v, t, tc) { v = Math.round(v * 1000) / 1000; if (held.get(param) === v) return; held.set(param, v); param.setTargetAtTime(v, t, tc); }
  const chapterNow = () => (B.app && B.app.world && B.app.world.chapter) || B.ActiveChapter || 1;

  function build(core) {
    C = core; held = new WeakMap(); bed = null; bedCh = 0; ev = {}; breathT = 0; flashWas = 0;
  }

  // ------------------------------------------------------------------ beds
  function killBed(t) {
    if (!bed) return;
    const b = bed; bed = null;
    b.out.gain.setTargetAtTime(0, t, .6);
    setTimeout(() => { for (const n of b.nodes) { try { if (n.stop) n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} } }, C.offline ? 0 : 4000);
  }
  function lfo(f, depth, to, nodes) { const o = C.ctx.createOscillator(), g = C.gainNode(depth); o.frequency.value = f; o.connect(g); g.connect(to); o.start(); nodes.push(o, g); return o; }
  function makeBed(ch) {
    const ctx = C.ctx, N = C.N, [bus] = C.busOf('amb'), out = C.gainNode(0, bus), nodes = [out], t = ctx.currentTime;
    // Stereo bed: the same noise read at two offsets, one per ear (a mono bed sits in the middle of the head).
    const src = (buf) => {
      const m = ctx.createChannelMerger(2), a = C.noiseSrc(buf), b = C.noiseSrc(buf), len = (buf || N.noise).duration;
      b.loopEnd = len * .77;   // different loop lengths per ear: no audible loop period
      a.connect(m, 0, 0); b.connect(m, 0, 1); a.start(t, Math.random() * len * .4); b.start(t, len * .5 + Math.random() * len * .4); nodes.push(a, b, m); return m;
    };
    const chainOf = (s, list, lvl) => { let a = s; for (const n of list) { a.connect(n); a = n; nodes.push(n); } const g = C.gainNode(lvl, out); a.connect(g); nodes.push(g); return g; };
    const b = { out, nodes, level: 1, ch };
    if (ch === 1) {          // temple crypt: slow cave breath through the arches
      const s = src(N.pink), bp = C.filter('bandpass', 210, 2.2);
      chainOf(s, [bp, C.filter('lowpass', 700, .7)], .5); lfo(.07, 70, bp.frequency, nodes);
      b.level = .55;
    } else if (ch === 2) {   // coast: rain hiss + rain on water and stone; level follows the weather
      const s = src(N.noise), s2 = src(N.pink);
      b.rain = chainOf(s, [C.filter('highpass', 2400, .5), C.filter('lowpass', 7500, .5)], .06);
      b.wet = chainOf(s2, [C.filter('bandpass', 900, .6)], .2);
      b.level = 1;
    } else if (ch === 3) {   // buried throne: cold wind whistling through cracks (two resonant bands that wander)
      const s = src(N.pink), b1 = C.filter('bandpass', 520, 9), b2 = C.filter('bandpass', 830, 12);
      chainOf(s, [b1], .55); const g2 = C.gainNode(.35, out); s.connect(b2); b2.connect(g2); nodes.push(b2, g2);
      lfo(.043, 140, b1.frequency, nodes); lfo(.031, 210, b2.frequency, nodes); lfo(.09, .25, g2.gain, nodes);
      b.level = .5;
    } else if (ch === 4) {   // forge: furnace roar that breathes like a bellows
      const s = src(N.brown), lp = C.filter('lowpass', 170, .9), s2 = src(N.pink), bp = C.filter('bandpass', 380, 1.4);
      const roar = chainOf(s, [C.filter('highpass', 35, .7), lp], .55); const hi = chainOf(s2, [bp], .12);
      lfo(.11, .22, roar.gain, nodes); lfo(.11, 120, bp.frequency, nodes); lfo(.11, .05, hi.gain, nodes);
      b.level = .75;
    } else {                 // final court: void — a slow sub swell and airy whisper band
      const o = ctx.createOscillator(), og = C.gainNode(.0, out); o.frequency.value = 43.65; o.connect(og); o.start(); nodes.push(o, og);
      lfo(.05, .05, og.gain, nodes);
      const s = src(N.noise), bp = C.filter('bandpass', 5200, 3);
      const air = chainOf(s, [bp], .05); lfo(.067, 1600, bp.frequency, nodes); lfo(.13, .03, air.gain, nodes);
      b.sub = og; b.level = .6;
    }
    return b;
  }

  // ------------------------------------------------------------------ chapter events
  const due = (k, t, a, b) => { if (ev[k] == null) { ev[k] = t + C.rand(a * .3, b * .5); return false; } if (t < ev[k]) return false; ev[k] = t + C.rand(a, b); return true; };
  function thunder(t, dist) {   // dist 0 (overhead crack) .. 1 (far rumble)
    const near = 1 - dist, vol = .2 + .25 * near;
    if (near > .45) C.burst(t, .35, .12 * near, 2600, { q: .5, f1: 700, bus: 'amb', send: .5, pan: C.rand(-.4, .4) });   // the crack
    C.burst(t + .02, 3.2 + dist * 1.5, vol, 160 - 60 * dist, { buf: C.N.brown, q: .6, f1: 45, attack: .08 + dist * .35, bus: 'amb', send: .55, pan: C.rand(-.6, .6) });
    C.burst(t + .5 + dist * .4, 2.6, vol * .55, 90, { buf: C.N.brown, q: .7, f1: 40, attack: .5, bus: 'amb', send: .6, pan: C.rand(-.6, .6) });   // roll
    C.thud(t + .05, { f0: 62, f1: 30, dur: 1.4, vol: .18 * (.4 + near), bus: 'amb' });
  }
  function chapterEvents(ch, t, st) {
    const calm = !st.combat && !st.boss && !C.narrating;
    if (ch === 2) {
      const W = B.CoastWeather, rain = W && W.rain != null ? W.rain : .7, flash = W ? W.flash || 0 : 0;
      if (bed && bed.rain) { const r = Math.round(rain * 20) / 20; hold(bed.rain.gain, .025 + .07 * r, t, 1.5); hold(bed.wet.gain, .08 + .2 * r, t, 1.5); }
      // lightning on screen -> thunder after the light (distance = delay); never two in a row
      if (flash > .3 && flashWas <= .3 && (ev.lastBolt == null || t - ev.lastBolt > 4)) { ev.lastBolt = t; const d = C.rand(.2, .9); thunder(t + .25 + d * 2.2, d); }
      flashWas = flash;
      if (calm && due('buoy', t, 26, 44)) C.ring(t, { f: C.rand(196, 233), partials: [1, 2.32, 3.01, 4.17], decay: 4.5, vol: .016, bus: 'amb', send: .9, pan: C.rand(-.8, .8) });
    } else if (ch === 3) {
      if (calm && due('chime', t, 7, 16)) { const f = C.rand(1700, 2600); C.ring(t, { f, partials: [1, 2.71, 4.8], decay: 1.8, vol: .007, bus: 'amb', send: .9, pan: C.rand(-.9, .9) }); if (C.chance(.4)) C.ring(t + C.rand(.12, .3), { f: f * 1.19, partials: [1, 2.71], decay: 1.4, vol: .005, bus: 'amb', send: .9, pan: C.rand(-.9, .9) }); }
      if (calm && due('settle', t, 20, 36)) C.sample('debris', { bus: 'amb', vol: .07, rate: C.rand(.45, .6), lp: 900, send: .8, pan: C.rand(-.8, .8) });
    } else if (ch === 4) {
      if (due('hammer', t, 9, 16)) {   // far forge hammer: two or three strikes, iron ring under it
        const n = C.chance(.5) ? 3 : 2, pan = C.rand(-.7, .7), f = C.rand(310, 380);
        for (let i = 0; i < n; i++) { const at = t + i * C.rand(.55, .7); C.ring(at, { f, partials: [1, 2.63, 4.1, 6.9], decay: .7, vol: .012 * (i ? .8 : 1), bus: 'amb', send: .8, pan }); C.thud(at, { f0: 120, f1: 60, dur: .12, vol: .03, bus: 'amb', pan }); }
      }
      if (due('hiss', t, 14, 26)) C.burst(t, C.rand(1.2, 2), .02, 3800, { q: .5, f1: 1800, attack: .05, bus: 'amb', send: .4, pan: C.rand(-.7, .7) });   // quench steam
    } else if (ch >= 5) {
      if (bed && bed.sub) hold(bed.sub.gain, st.boss ? .05 : .11, t, 2);
      if (calm && due('whisper', t, 18, 32)) C.sample('tortWhisper', { bus: 'amb', vol: .06, rate: C.rand(.6, .75), lp: 1800, send: 1, pan: C.rand(-.9, .9) });
    } else {
      if (calm && due('clink', t, 11, 22)) C.sample('chain', { bus: 'amb', vol: .05, rate: C.rand(1.05, 1.3), lp: 2400, send: .8, pan: C.rand(-.9, .9) });
    }
  }

  // ------------------------------------------------------------------ hero body
  function breath(t, vol, inhale) {   // filtered pink noise shaped like a mouth: low formant + airy top, no vocal pitch
    const f = inhale ? 1250 : 820;
    C.burst(t, inhale ? .42 : .55, vol, f, { buf: C.N.pink, q: 1.6, f1: inhale ? 1550 : 560, attack: inhale ? .2 : .06, send: .04 });
    C.burst(t, inhale ? .38 : .5, vol * .45, 2600, { q: .9, f1: inhale ? 3100 : 1900, attack: inhale ? .2 : .05 });
  }
  function heroStep(dt, st, t) {
    const p = C.player(); if (!p || !st.playing || st.dead || st.won || !p.maxHp || p.hp <= 0) { breathT = 0; return; }
    const hp = p.hp / p.maxHp; if (hp >= .35) { breathT = 0; return; }
    breathT -= dt; if (breathT > 0) return;
    const pace = 1.5 + hp * 2.5; breathT = pace + C.rand(-.15, .25);
    breath(t, .016, true); breath(t + pace * .42, .02, false);
  }

  // ------------------------------------------------------------------ footsteps by ground
  function surface() {
    const ch = chapterNow(), r = C.room();
    if (ch === 2) { const W = B.CoastWeather; return r === 3 ? 'wood' : (W && W.rain > .55) || r === 2 ? 'water' : 'mud'; }
    if (ch === 4) return r === 3 || r === 5 ? 'metal' : 'ash';
    if (ch >= 5) return 'void';
    if (ch === 1 && r === 2) return 'water';
    return 'stone';
  }
  function footstep(o, k) {
    stepN++; const t = C.ctx.currentTime, s = surface(), v = (o && o.volume > .5 ? 1.3 : 1) * k;
    if (s === 'stone') C.burst(t + .005, .05, .028 * v, 3600, { q: .8, pan: C.rand(-.15, .15) });   // grit under the boot
    else if (s === 'water') { C.sample('wetStep', { vol: .2 * v, rate: C.rand(.85, 1.1) }); C.burst(t + .03, .16, .02 * v, 1400, { q: 1.4, f1: 2600 }); }
    else if (s === 'mud') { C.sample('wetStep', { vol: .14 * v, rate: C.rand(.6, .75), lp: 1600 }); C.thud(t, { f0: 90, f1: 50, dur: .09, vol: .06 * v }); }
    else if (s === 'wood') { C.thud(t, { f0: 160, f1: 95, dur: .09, vol: .07 * v }); if (stepN % 3 === 0) C.burst(t + .06, .18, .008 * v, 700, { q: 6, f1: 520 }); }   // a creaking plank now and then
    else if (s === 'metal') C.ring(t, { f: C.rand(240, 300), partials: [1, 2.76, 5.4], decay: .16, vol: .012 * v, send: .2 });
    else if (s === 'ash') C.burst(t + .01, .09, .02 * v, 1900, { q: .6, f1: 900 });
    else if (s === 'void') C.thud(t, { f0: 70, f1: 40, dur: .22, vol: .045 * v, send: .5 });
    if (stepN % 2 === 0 && C.chance(.6)) C.sample('armor', { vol: .045 * v, rate: C.rand(1.25, 1.5), hp: 1800, delay: .02 });   // mail and buckles
  }

  // ------------------------------------------------------------------ interface
  function ui(kind) {
    if (!C || !C.ctx || C.ctx.state !== 'running' && !C.offline || C.volume.master <= 0) return;
    const t = C.ctx.currentTime, o = { bus: 'sfx' };
    if (!C.throttle('uiplus_' + kind, .12)) return;
    if (kind === 'open') { C.whoosh(t, { dur: .26, peak: .7, f0: 260, f1: 1300, f2: 600, q: .9, vol: .05 }); C.thud(t + .2, { f0: 140, f1: 80, dur: .1, vol: .1 }); C.sample('cloth', { vol: .14, rate: 1.1, delay: .02 }); }
    else if (kind === 'close') { C.whoosh(t, { dur: .2, peak: .4, f0: 900, f1: 500, f2: 260, q: .9, vol: .04 }); C.thud(t + .1, { f0: 110, f1: 60, dur: .08, vol: .08 }); }
    else if (kind === 'map') { C.sample('cloth', { vol: .22, rate: .8 }); C.burst(t + .05, .5, .03, 1600, { q: .5, f1: 3800, attack: .15 }); C.burst(t + .35, .25, .02, 2400, { q: .7, f1: 1200 }); }
    else if (kind === 'equip') { C.sample('armor', { vol: .3, rate: C.rand(.9, 1.05) }); C.ring(t + .05, { f: C.rand(620, 700), partials: [1, 2.76, 5.4, 8.9], decay: .5, vol: .03, send: .25 }); C.thud(t, { f0: 120, f1: 70, dur: .12, vol: .14 }); }
    else if (kind === 'unequip') { C.sample('cloth', { vol: .2, rate: .9 }); C.sample('armor', { vol: .16, rate: .8, delay: .04 }); }
    else if (kind === 'deny') { C.tone(t, 98, .28, .05, Object.assign({ type: 'sawtooth', lp: 420 }, o)); C.thud(t, { f0: 80, f1: 45, dur: .2, vol: .12 }); }
    else if (kind === 'quest') {   // grave cadence: low bell + rising fifth in the choir range, a breath of reverb
      C.ring(t, { f: 146.8, partials: [1, 2.01, 2.4, 3.02, 4.2], decay: 3.4, vol: .05, send: .7 });
      C.tone(t + .15, 220, 2.4, .02, { type: 'triangle', attack: .5, lp: 1400, send: .6 }); C.tone(t + .45, 293.7, 2.4, .018, { type: 'triangle', attack: .6, lp: 1400, send: .6 });
      C.thud(t, { f0: 70, f1: 40, dur: .7, vol: .2, send: .3 });
    }
  }
  function levelUpExtra(t) {   // on top of the existing level-up: a sub impact, a rising shimmer and a held open fifth
    C.thud(t, { f0: 60, f1: 32, dur: 1.1, vol: .3, send: .3 });
    C.burst(t, 1.6, .03, 3000, { q: .6, f1: 7000, attack: .5, send: .7 });
    for (const [f, d, v] of [[73.42, 0, .05], [110, .05, .035], [146.8, .3, .03], [220, .6, .022], [293.7, .9, .016]]) C.tone(t + d, f, 3.2 - d, v, { type: 'triangle', attack: .35, lp: 2200, send: .65 });
    C.ring(t + .9, { f: 587.3, partials: [1, 2.01, 3.0, 4.1], decay: 2.6, vol: .018, send: .8, pan: .2 });
  }
  function watchUI() {
    if (!window.MutationObserver || !document.body || B.__audioPlusUI) return; B.__audioPlusUI = true;
    const visible = el => el && !el.classList.contains('hidden') && !el.hidden;
    const state = new WeakMap();
    const watch = (sel, kindOpen, kindClose) => {
      const el = document.querySelector(sel); if (!el || state.has(el)) return !!el;
      state.set(el, visible(el));
      new MutationObserver(() => { const v = visible(el); if (v === state.get(el)) return; state.set(el, v); ui(v ? kindOpen : kindClose); }).observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] });
      return true;
    };
    const toastSeen = new WeakSet();
    const hook = () => {
      watch('#character', 'open', 'close'); watch('#journal', 'open', 'close'); watch('#atlas', 'map', 'close'); watch('#pause', 'open', 'close');
      const toast = document.querySelector('#character .char-toast');
      if (toast && !toastSeen.has(toast)) { toastSeen.add(toast); new MutationObserver(() => { const c = toast.className; if (/\bhidden\b/.test(c)) return; if (/\bunequip\b/.test(c)) ui('unequip'); else if (/\bequip\b/.test(c)) ui('equip'); else if (/\bdeny\b/.test(c)) ui('deny'); }).observe(toast, { attributes: true, attributeFilter: ['class'] }); }
      const notice = document.getElementById('quest-notice');
      if (notice && !toastSeen.has(notice)) { toastSeen.add(notice); let was = notice.classList.contains('complete') && notice.classList.contains('show');
        new MutationObserver(() => { const now = notice.classList.contains('complete') && notice.classList.contains('show'); if (now && !was && B.app && B.app.view !== 'title' && !B.app.warming) ui('quest'); was = now; }).observe(notice, { attributes: true, attributeFilter: ['class'] }); }
    };
    hook(); let n = 0; const iv = setInterval(() => { hook(); if (++n > 30) clearInterval(iv); }, 2000);   // panels are created lazily
  }

  // ------------------------------------------------------------------ hooks from audio.js
  function update(dt, st) {
    if (!C || !C.ctx) return;
    const t = C.ctx.currentTime, ch = chapterNow();
    if (ch !== bedCh || !bed) { killBed(t); bed = makeBed(ch); bedCh = ch; ev = {}; }
    if (bed) hold(bed.out.gain, (st.dead ? .3 : st.boss ? .55 : st.combat ? .75 : 1) * bed.level * .16, t, 1.2);
    if (!st.playing && !st.title) return;
    chapterEvents(ch, t, st); heroStep(dt, st, t);
  }
  function after(name, o, k) {
    if (!C || !C.ctx) return;
    if (name === 'step') footstep(o || {}, k);
    else if (name === 'dodge' && C.chance(.35) && C.throttle('dodgeBreath', 1.2)) breath(C.ctx.currentTime + .12, .024 * k, false);
    else if (name === 'levelUp') levelUpExtra(C.ctx.currentTime);
  }
  B.AudioPlus = { build, update, after, ui, surface };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchUI); else watchUI();
})();
