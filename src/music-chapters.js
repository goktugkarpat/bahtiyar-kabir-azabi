/* KABİR AZABI — chapter colour for the adaptive score (ajan:audio). Classic script, no modules.
   src/music.js keeps one transport and one set of layers (room beds -> tension -> combat -> boss, each a Part whose gain
   crossfades); this file only adds each chapter's own instruments on top of the shared combat and boss layers, a third
   boss stage that grows as the boss loses health, and the title theme. It uses the prepared instrument bank of music.js
   (bells, taiko, anvil, iron plate, chains, bones, choir, strings, brass) through BABA.Music's EXT window, so changing
   chapters builds no new buffers or buses.
     I   Tapınak  dark organ pedal (brass on D1) + funeral bell on the downbeat, heavy low taiko doubling
     II  Kıyı     cold sea bell (low, slow, slightly flat), drowned "u" choir, cello tremolo under the ostinato
     III Taht     gold-and-bone: high chimes on the off-beats, bone rattles, orchestral brass bass
     IV  Ocak     industrial: anvil and iron plate in a forge rhythm, ghost ticks, muffled "u" choir
     V   Final    choir and organ over the void: sustained "a" chords, the judgement bell, pedal brass
   Boss stages: 1 = music.js phase 1, 2 = phase 2 (bossPhase >= 2), 3 = health below a third (extra bell + doubled drums). */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  let titleNext = 0, titleN = 0;

  function combat(X, st, t) {
    const CB = X.CB; if (CB.start === undefined || st < CB.start || CB.ending) return;
    const s = st % 16, bar = Math.floor(st / 16), rel = bar - CB.bar0, P = X.parts.PC, ch = X.chapter(), n = X.notes;
    const perc = X.dest(P, 'perc'), far = X.dest(P, 'far'), bell = X.dest(P, 'bell'), sd = X.stepDur();
    const first = st === CB.start;
    if (ch === 1) {
      if (first) X.toll(P, t, { buf: 'bellBig', vel: .32, rate: .94 });
      if (s === 0 && rel % 4 === 0 && rel > 0) X.brassNote(P, n.D1, t, { vel: .2, att: .4, dur: sd * 30, rel: 1.2, bright: .5 });
      if (s === 0 && rel % 4 === 2) X.toll(P, t, { buf: 'bellD3', vel: .2, rate: .89, pan: X.rr(-.3, .3) });
      if ((s === 6 || s === 14) && rel % 2 === 1 && X.chance(.7)) X.playBuf('taikoL', t, perc, { gain: .32, rate: .86, pan: X.rr(-.2, .2) });
    } else if (ch === 2) {
      if (first || (s === 0 && rel % 2 === 0)) X.toll(P, t, { buf: 'bellD3', vel: first ? .34 : .2, rate: .72 * X.rr(.995, 1.005), pan: X.rr(-.6, .6) });
      if (s === 0 && rel % 4 === 1) { X.vowel('choirB', 'u', t, .4); for (const m of [n.D2, n.A2]) X.choirNote(P, 'choirB', m, t, { vel: .14, att: .6, dur: sd * 28, rel: 1.2, vib: 6 }); }
      if (s === 8 && rel % 4 === 3) X.stringNote(P, 'cello', n.D2 - 2, t, { vel: .14, att: .2, dur: sd * 7, rel: .6, n: 2, trem: .9, tremRate: 13 });
    } else if (ch === 3) {
      if ((s === 6 || s === 14) && X.chance(.55)) X.playBuf('bellD4', t, bell, { gain: .1, rate: X.pick([1.5, 2, 1.335, 1.782]), pan: X.rr(-.7, .7) });
      if (s % 4 === 3 && X.chance(.25)) X.playBuf('bone', t, far, { gain: .22, rate: X.rr(1, 1.3), pan: X.rr(-.8, .8) });
      if (s === 0 && rel % 2 === 0) X.brassNote(P, n.D1 + (rel % 4 ? -2 : 0), t, { vel: .24, att: .25, dur: sd * 26, rel: 1, bright: .7 });
      if (first) X.playBuf('bellBig', t, bell, { gain: .22, rate: 1.19 });
    } else if (ch === 4) {
      if (s === 4 || s === 12) X.playBuf('anvil', t, perc, { gain: s === 4 ? .2 : .14, rate: X.rr(.74, .8), pan: X.rr(-.35, .35) });
      if (s === 10 && rel % 2 === 1) X.playBuf('plate', t, perc, { gain: .16, rate: X.rr(.85, .95), pan: X.rr(-.3, .3) });
      if (s % 2 === 1 && rel >= 1 && X.chance(.5)) X.playBuf('tek', t, perc, { gain: .1, rate: X.rr(1.3, 1.5), pan: X.rr(-.6, .6) });
      if (s === 0 && rel % 4 === 0) { X.vowel('choirA', 'u', t, .5); for (const m of [n.D2, n.Ab2]) X.choirNote(P, 'choirA', m, t, { vel: .09, att: 1, dur: sd * 56, rel: 1.5, vib: 5 }); }
      if (first) X.playBuf('plate', t, perc, { gain: .3, rate: .7 });
    } else {
      if (s === 0 && rel % 2 === 0) { X.vowel('choirA', 'a', t, .6); const r = rel % 4 ? n.Eb2 : n.D2; for (const m of [r, r + 7, r + 12]) X.choirNote(P, 'choirA', m, t + X.rr(0, .05), { vel: .1, att: .8, dur: sd * 30, rel: 1.4, vib: 9 }); }
      if (first || (s === 0 && rel % 4 === 3)) X.toll(P, t, { buf: 'bellD3', vel: .22, rate: .74 });
      if (s === 0 && rel % 4 === 0) X.brassNote(P, n.D1, t, { vel: .18, att: .6, dur: sd * 60, rel: 1.6, bright: .45 });
    }
  }

  function boss(X, st, t) {
    const BS = X.BS; if (BS.start === undefined || st < BS.start) return;
    const s = st % 16, bar = Math.floor(st / 16), rel = bar - BS.bar0, P = X.parts.PB, ch = X.chapter(), n = X.notes;
    const raw = X.S.raw || {}, hp = raw.bossHp == null ? 1 : raw.bossHp, stage = hp < .34 ? 3 : BS.phase;
    const perc = X.dest(P, 'perc'), far = X.dest(P, 'far'), bell = X.dest(P, 'bell'), sd = X.stepDur();
    if (ch === 2) {
      if (s === 0 && rel % 2 === 0) X.playBuf('bellBig', t, bell, { gain: .26, rate: .62, pan: X.rr(-.4, .4) });
      if (s === 8 && rel % 4 === 1) { X.vowel('choirA', 'u', t, .5); for (const m of [n.D2, n.Eb2 + 12]) X.choirNote(P, 'choirA', m, t, { vel: .1, att: .8, dur: sd * 24, rel: 1.2, vib: 8 }); }
    } else if (ch === 3) {
      if ((s === 4 || s === 12) && X.chance(.6)) X.playBuf('bellD4', t, bell, { gain: .12, rate: X.pick([1.5, 2, 1.68]), pan: X.rr(-.7, .7) });
      if (s === 0 && rel % 2 === 1) X.brassNote(P, n.D1 + 12, t, { vel: .3, att: .2, dur: sd * 14, rel: .8, bright: 1 });
    } else if (ch === 4) {
      if (s % 4 === 0) X.playBuf('anvil', t, perc, { gain: .2 * (s === 0 ? 1 : .7), rate: s === 0 ? .7 : .78, pan: X.rr(-.3, .3) });
      if (s === 6 || s === 14) X.playBuf('plate', t, perc, { gain: .14, rate: X.rr(.8, .9) });
    } else if (ch >= 5) {
      if (s === 0 && rel % 2 === 0) { X.vowel('choirA', 'a', t, .3); for (const m of [n.D2, n.A2, n.D3, n.F3]) X.choirNote(P, 'choirA', m, t + X.rr(0, .06), { vel: .09, att: .5, dur: sd * 30, rel: 1.5, vib: 10 }); }
      if (s === 0 && rel % 4 === 0) { X.brassNote(P, n.D1, t, { vel: .26, att: .4, dur: sd * 62, rel: 2, bright: .5 }); X.playBuf('bellBig', t, bell, { gain: .22, rate: .74 }); }
    } else {
      if (s === 0 && rel % 4 === 2) X.toll(P, t, { buf: 'bellBig', vel: .22, rate: .9 });
    }
    if (stage === 3) {   // last third of the boss's health: the whole court joins in
      if (s % 4 === 2) X.playBuf('taikoM', t, perc, { gain: .28, rate: X.rr(.95, 1.05), pan: X.rr(-.5, .5) });
      if (s === 0 && rel % 2 === 0) X.playBuf('boom', t, perc, { gain: .3 });
      if (s === 0 && rel % 2 === 1) X.toll(P, t, { buf: ch === 3 ? 'bellD4' : 'bellD3', vel: .2, rate: ch === 2 ? .72 : 1, pan: X.rr(-.4, .4) });
      if (s === 12 && X.chance(.5)) X.playBuf('chain', t, far, { gain: .3, rate: X.rr(.8, 1.1), pan: X.rr(-.7, .7) });
    }
  }

  function step(X, st, t) {
    if (!X.S || X.S.dead || X.S.won) return;
    combat(X, st, t); boss(X, st, t);
  }

  // Title theme: the chapel bed of the current chapter (music.js room 5, only lightly veiled) plus a slow statement of the
  // gate motif on a lone cello, the big bell, and a low brass breath; each pass picks a different order and register.
  function update(X, dt, t, until) {
    if (!X.S.title) { titleNext = 0; titleN = 0; return; }
    const P = X.parts.SCP[5]; if (!P || P.target <= 0) return;
    if (!titleNext) titleNext = t + 2.5;
    if (titleNext >= until) return;
    const at = Math.max(titleNext, t), n = X.notes, k = titleN++ % 3;
    if (k === 0) { X.playBuf('bellBig', at, X.dest(P, 'bell'), { gain: .32, rate: .94 }); X.phrase(P, 'cello', X.GATE, at + 2.5, { beat: .9, vel: .2, n: 2 }); }
    else if (k === 1) { X.brassNote(P, n.D1, at, { vel: .16, att: 3, dur: 9, rel: 4, bright: .4 }); X.toll(P, at + 4, { vel: .3, pan: X.rr(-.4, .4) }); }
    else { X.phrase(P, 'brass', X.GATE, at, { beat: .8, vel: .12, att: .6, rel: 1.2, bright: .4 }); X.playBuf('chain', at + 6, X.dest(P, 'far'), { gain: .25, rate: .8, pan: X.rr(-.7, .7) }); }
    titleNext = at + X.rr(17, 26);
  }

  B.MusicColor = { step, update };
})();
