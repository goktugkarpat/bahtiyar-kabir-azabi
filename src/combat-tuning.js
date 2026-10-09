/* KABİR AZABI — combat tuning: difficulty profiles, stamina economy and hit feel (read by combat.js, app.js, character-ui.js).
   Difficulty and resource values are shared with the runtime and UI. Loaded before combat.js.
   The current Normal calibration and its measurement limits are described below. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  // enemyHp / enemyDmg: multipliers on foe health and on blows that land on the hero (elites get eliteHp / eliteDmg on top).
  // playerDmg: multiplier on the hero's blows. pace: every enemy move (wind-up, tell, recovery) is stretched by this.
  // rest: multiplier on the pause between two moves of one foe. attackers / melee: how many foes may be mid-move at once near the hero
  // (melee = of the same kind, close-range or ranged). iframe: seconds of the .48 s roll that are untouchable.
  // dodgeStep: each roll chained within DODGE_CHAIN s of the previous one costs this much more (x base cost, capped at 3 steps).
  // regenDelay: seconds stamina waits after being spent before it refills; regen: refill multiplier. flasks / flaskHeal: flask count and heal.
  const DIFFICULTY = Object.freeze({
    easy: Object.freeze({ enemyHp: .70, enemyDmg: .48, eliteHp: 1, eliteDmg: 1, playerDmg: 1.18, pace: 1.22, rest: 1.30, attackers: 2, melee: 1,
      hitCap: .30, iframe: .44, dodgeStep: .15, regenDelay: .25, regen: 1.15, flasks: 5, flaskHeal: 1.15, perfectWindow: .26 }),
    normal: Object.freeze({ chapterDmg: Object.freeze({ 1: .76, 2: .95, 3: 1.17, 4: 1.34, 5: 1.50 }),   // Normal contact curve: later gear and passive defences leave less room to ignore boss tells.
      foeDmg: Object.freeze({ 1: .68, 2: .82, 3: 1.10, 4: 1.26, 5: 1.50 }),   // Common foes keep their authored tells; health and simultaneous attack limits are unchanged.
      enemyHp: .88, enemyDmg: 1.08, eliteHp: 1.10, eliteDmg: 1.08, playerDmg: 1.0, pace: 1.10, rest: 1.08, attackers: 3, melee: 2,
      hitCap: .26, iframe: .40, dodgeStep: .28, regenDelay: .32, regen: 1.12, flasks: 4, flaskHeal: 1.0, perfectWindow: .22 }),
    hard: Object.freeze({ enemyHp: 1.15, enemyDmg: 1.32, eliteHp: 1.25, eliteDmg: 1.25, playerDmg: 1, pace: 1, rest: .82, attackers: 3, melee: 2,
      hitCap: .45, iframe: .32, dodgeStep: .40, regenDelay: .50, regen: 1, flasks: 3, flaskHeal: .85, perfectWindow: .18 })
  });
  // Stamina economy shared by all difficulties.
  //   REGEN per second once the delay has passed (was a flat 12/s that never paused, so rolls were effectively free between blows).
  //   DODGE_CHAIN: a roll that starts within this many seconds of the previous roll's end counts as chained.
  //   DODGE_EXTRA_DELAY: rolls pause the refill a little longer than swings or skills.
  //   PERFECT: a roll whose i-frames swallow a blow within `window` s of its start is a "last-moment" roll: refund of the roll's cost,
  //   the chain resets, the hero gets an OPENING (seconds) in which his blows hit harder (damage x) and stagger like heavy ones.
  //   HIT: stamina won back by landing blows (per foe struck; light / heavy blow / skill swing / whirl tick, +kill), at most `cap` per swing.
  //   Fighting refills the orb, standing back refills it slowly: REGEN was 15 before hits paid, 13 now (same total for an average fight).
  const ECONOMY = Object.freeze({ REGEN: 13, DODGE_CHAIN: 1.1, DODGE_EXTRA_DELAY: .15, CHAIN_MAX: 3,
    HIT: Object.freeze({ light: 3, heavy: 2, skill: 1.2, whirl: .8, kill: 4, cap: 9 }),
    PERFECT: Object.freeze({ refund: .75, opening: 3, damage: 1.25, slowmo: .16, cooldown: .5 }) });
  // Hit feel ("heavy but fluid"): the shared hit-stop (s) per blow class, knock-back (m) and the moments of death.
  const FEEL = Object.freeze({
    hitstop: Object.freeze({ light: .030, finisher: .052, heavy: .066, extraTarget: .006, kill: .022, bossKill: .085, shield: .016, guardBreak: .075,
      hurt: .034, hurtHeavy: .062, cap: .09 }),
    knock: Object.freeze({ light: .14, finisher: .2, heavy: .24, shield: .1, boss: .03, bossHeavy: .06 }),
    // Slow motion (s at 30 % speed): the last foe of a hall, the boss.
    lastKillSlowmo: .32, bossKillSlowmo: 1.1,
    // While waiting for a free attack slot, close melee foes circle the hero instead of standing still (fraction of walk speed).
    circle: .42
  });
  // Per-chapter correction for common foes (not bosses), on top of the campaign ramp in combat.js. Measured with the average bot on Normal
  // (hero at the expected level/gear of the chapter: L3 / L6 / L9 / L11), health lost per hall without -> with this table:
  // ch I 23.6 -> ~20 %, ch II 12.3 (the hero's level-6 jump outran the shore foes) -> ~19 %, ch III 33 -> ~26 %, ch IV 42 -> ~34 %.
  const CHAPTER = Object.freeze({ 1: { hp: 1, dmg: .85 }, 2: { hp: 1.12, dmg: 2.15 }, 3: { hp: 1.12, dmg: .88 }, 4: { hp: 1.15, dmg: .9 }, 5: { hp: 1.20, dmg: 1.0 } });   // BAL: hp of III-V 1 -> 1.12 / 1.15 / 1.20 (type-independent, also applies to the new foes)   // V: ajan:chapter5 (measured, see tools/combat_balance.py 5)
  // Chapter bosses (their own blows only; adds follow CHAPTER): the forge heart hit softer than the hollow king it follows.
  const BOSS = Object.freeze({ 1: { dmg: 1, hp: 1.25 }, 2: { dmg: 1, hp: 1.30 }, 3: { dmg: 1, hp: 1.30 }, 4: { dmg: 1.2, hp: 1.25 }, 5: { dmg: .95, hp: 1.20 } });
  // BAL boss knobs: hp = health multiplier per chapter (on top of BALANCE.bossHealth / campaignHealth in combat.js); REST = multiplier on the pause between two boss moves
  // (the .36 / .58 s punish floor and every tell time stay untouched); PHASE = damage of the boss's own blows in phase 2 / 3 (and the late-phase signature cadence: boss-framework.js pace()).
  const BOSS_REST = .88, BOSS_PHASE = Object.freeze({ 1: 1, 2: 1.06, 3: 1.12 });
  function profile(level) { return DIFFICULTY[level] || DIFFICULTY.normal; }
  // Text for the settings screen (Turkish source, translated through KabirI18n; English in i18n.js block "ajan:combat").
  function describe(level) {
    const t = s => (window.KabirI18n ? KabirI18n.t(s) : s);
    if (level === 'easy') return t('Kolay: hikâye ve keşif için. Düşmanlar yarı hasar verir, daha yavaş saldırır ve aynı anda daha az kişi üstüne gelir. Yuvarlanma ucuzdur, 5 şifa matarası taşırsın.');
    if (level === 'hard') return t('Zor: hata payı çok az. Düşmanlar daha dayanıklı, daha sert ve dinlenmeden saldırır; seçkin düşmanlar gerçek bir sınavdır. Arka arkaya yuvarlanmak hızla dayanıklılığını tüketir, 3 şifa matarası taşırsın. Son anda yuvarlanmayı öğren.');
    return t('Normal: önerilen deneyim. Düşmanların darbelerini oku, son anda yuvarlan, dayanıklılığını yönet. Seviye atladıkça güçlenirsin ama her bölüm biraz daha sertleşir.');
  }
  // Talent tree 4 (src/talent-tree.js effects(), src/talent-runtime.js): every passive / keystone number lives here. Skill numbers (damage, cooldown, cost, bleed ...) are in progression.js skills[].params.
  //   frenzy: below `hp` % health, blows deal `dmg` x and stamina refills `regen` x.   momentum: after a roll / charge, `time` s of `dmg` x blows.
  //   mark (Kanlı İz): skill hits bleed for `skillBleed` of the damage over `time` s; bleeding foes take `taken` x.
  //   rage (Öfke Birikimi): every `hits` blows open `time` s of `dmg` x blows and `regen` x stamina.   ironhide (Demir Deri): all damage taken x `taken`.
  //   vengeance (Öç Alma): `share` of the health you lose is added to your next blow (at most `cap` hp).   crush (Ezici Vuruş): staggered foes take `dmg` x.
  //   breath (Yırtıcı Nefes): each kill gives back `stamina` stamina and `heal` of the health bar.   exec (Cellat): below `below` of its health a foe takes `dmg` x; common foes below `kill` die; max health x `hp`.
  //   blood (Kan Yemini): `leech` of all damage returns as health, no flasks.
  //   iron (Demir Yemin): all damage taken x `taken`, each kill gives back `stamina` stamina, the dodge roll costs `dodge` x stamina.
  const TALENT = Object.freeze({ frenzy: Object.freeze({ hp: 40, dmg: 1.25, regen: 1.15 }), momentum: Object.freeze({ dmg: 1.2, time: 3 }), mark: Object.freeze({ skillBleed: .3, time: 4, taken: 1.15 }),
    rage: Object.freeze({ hits: 5, time: 3, dmg: 1.2, regen: 1.4 }), ironhide: Object.freeze({ taken: .9 }), vengeance: Object.freeze({ share: .25, cap: 90 }), crush: Object.freeze({ dmg: 1.2 }),
    breath: Object.freeze({ stamina: 22, heal: .01 }), exec: Object.freeze({ below: .4, dmg: 1.25, kill: .10, hp: .8 }), blood: Object.freeze({ leech: .025 }),
    iron: Object.freeze({ taken: .8, stamina: 8, dodge: 2 }) });
  B.CombatTuning = Object.freeze({ DIFFICULTY, CHAPTER, BOSS, BOSS_REST, BOSS_PHASE, ECONOMY, FEEL, TALENT, profile, describe });
})();
/* Normal calibration, 2026-10-08: actual five-world combat/skill/talent/gear/globe logic, with renderer-free model poses.
   Three legal builds and five deterministic combat seeds per chapter were tested to the real boss death, including late phases.
   Entry levels from canonical reward ledgers: full side routes 4/6/8/10/13; minimum main routes 3/4/6/8/11.
   All 75 minimum main-route cases remained playable with four base flasks and ordinary 1.0 flask healing.
   The new contact curve leaves health, telegraph clocks, simultaneous-attack limits and the 26% single-hit cap unchanged.
   Derived bleed/burn no longer repeats the already-resolved attacker and target multipliers; lifesteal uses actual life removed.
   Controlled encounter placement, full-health starts and scripted reactions are calibration tools, not a continuous human playthrough.
   Historical tables from the former weak-kit/early-stop bench have been removed because they describe obsolete profiles. */
