/* KABİR AZABI — combat tuning: difficulty profiles, stamina economy and hit feel (read by combat.js, app.js, character-ui.js).
   Every number here was set with the balance bench (src/combat-balance.js, BABA.Balance.run) — see the measurements in the
   comment block at the end of the file. Loaded before combat.js. */
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
      iframe: .44, dodgeStep: .15, regenDelay: .25, regen: 1.15, flasks: 5, flaskHeal: 1.15, perfectWindow: .26 }),
    normal: Object.freeze({ enemyHp: .95, enemyDmg: .86, eliteHp: 1.12, eliteDmg: 1.08, playerDmg: 1.12, pace: 1.10, rest: 1.08, attackers: 3, melee: 2,
      iframe: .38, dodgeStep: .30, regenDelay: .40, regen: 1, flasks: 4, flaskHeal: 1, perfectWindow: .22 }),
    hard: Object.freeze({ enemyHp: 1.15, enemyDmg: 1.32, eliteHp: 1.40, eliteDmg: 1.25, playerDmg: 1, pace: 1, rest: .82, attackers: 3, melee: 2,
      iframe: .32, dodgeStep: .40, regenDelay: .50, regen: 1, flasks: 3, flaskHeal: .85, perfectWindow: .18 })
  });
  // Stamina economy shared by all difficulties.
  //   REGEN per second once the delay has passed (was a flat 12/s that never paused, so rolls were effectively free between blows).
  //   DODGE_CHAIN: a roll that starts within this many seconds of the previous roll's end counts as chained.
  //   DODGE_EXTRA_DELAY: rolls pause the refill a little longer than swings or skills.
  //   PERFECT: a roll whose i-frames swallow a blow within `window` s of its start is a "last-moment" roll: refund of the roll's cost,
  //   the chain resets, the hero gets an OPENING (seconds) in which his blows hit harder (damage x) and stagger like heavy ones.
  const ECONOMY = Object.freeze({ REGEN: 15, DODGE_CHAIN: 1.1, DODGE_EXTRA_DELAY: .15, CHAIN_MAX: 3,
    PERFECT: Object.freeze({ refund: .75, opening: 1.6, damage: 1.25, slowmo: .16, cooldown: .5 }) });
  // Hit feel ("heavy but fluid"): the shared hit-stop (s) per blow class, knock-back (m) and the moments of death.
  const FEEL = Object.freeze({
    hitstop: Object.freeze({ light: .030, finisher: .052, heavy: .066, extraTarget: .006, kill: .022, bossKill: .085, shield: .016, guardBreak: .075,
      hurt: .034, hurtHeavy: .062, cap: .09 }),
    knock: Object.freeze({ light: .42, finisher: .82, heavy: 1.3, shield: .16, boss: .06, bossHeavy: .2 }),
    // Slow motion (s at 30 % speed): the last foe of a hall, the boss.
    lastKillSlowmo: .32, bossKillSlowmo: 1.1,
    // While waiting for a free attack slot, close melee foes circle the hero instead of standing still (fraction of walk speed).
    circle: .42
  });
  // Per-chapter correction for common foes (not bosses), on top of the campaign ramp in combat.js. Measured with the average bot on Normal
  // (hero at the expected level/gear of the chapter: L3 / L6 / L9 / L11), health lost per hall without -> with this table:
  // ch I 23.6 -> ~20 %, ch II 12.3 (the hero's level-6 jump outran the shore foes) -> ~19 %, ch III 33 -> ~26 %, ch IV 42 -> ~34 %.
  const CHAPTER = Object.freeze({ 1: { hp: 1, dmg: .85 }, 2: { hp: 1.12, dmg: 2.15 }, 3: { hp: 1, dmg: .88 }, 4: { hp: 1, dmg: .8 } });
  // Chapter bosses (their own blows only; adds follow CHAPTER): the forge heart hit softer than the hollow king it follows.
  const BOSS = Object.freeze({ 1: { dmg: 1 }, 2: { dmg: 1 }, 3: { dmg: 1 }, 4: { dmg: 1.3 } });
  function profile(level) { return DIFFICULTY[level] || DIFFICULTY.normal; }
  // Text for the settings screen (Turkish source, translated through KabirI18n; English in i18n.js block "ajan:combat").
  function describe(level) {
    const t = s => (window.KabirI18n ? KabirI18n.t(s) : s);
    if (level === 'easy') return t('Kolay: hikâye ve keşif için. Düşmanlar yarı hasar verir, daha yavaş saldırır ve aynı anda daha az kişi üstüne gelir. Yuvarlanma ucuzdur, 5 şifa matarası taşırsın.');
    if (level === 'hard') return t('Zor: hata payı çok az. Düşmanlar daha dayanıklı, daha sert ve dinlenmeden saldırır; seçkin düşmanlar gerçek bir sınavdır. Arka arkaya yuvarlanmak hızla dayanıklılığını tüketir, 3 şifa matarası taşırsın. Son anda yuvarlanmayı öğren.');
    return t('Normal: önerilen deneyim. Düşmanların darbelerini oku, son anda yuvarlan, dayanıklılığını yönet. Seviye atladıkça güçlenirsin ama her bölüm biraz daha sertleşir.');
  }
  B.CombatTuning = Object.freeze({ DIFFICULTY, CHAPTER, BOSS, ECONOMY, FEEL, profile, describe });
})();
/* Measurements (BABA.Balance.run; every hall / boss fought from full health with the chapter's expected level and gear:
   ch I L3, ch II L6, ch III L9, ch IV L11). Bots: novice (sees a tell after .42 s, ignores 35 %), average (.30 s, 18 %),
   skilled (.20 s, 6 %, rolls late), spam (rolls at every tell at once plus random rolls). Numbers = % health lost summed over the chapter's
   12-13 fights (deaths / flasks used). BEFORE = old code (flat 12/s regen, .45 s i-frames, hard = no ease), AFTER = this file.
                      ch I            ch II           ch III          ch IV
   Normal average  B 117 (0/0)     B  33 (0/0)     B 204 (0/0)       -
                   A 256 (0/1)     A 169..235      A 334 (0/0)     A 440 (0/1)
   Normal skilled  B  66           -               B  97             -
                   A  17           A  72           A 160           A 216
   Normal spam     B 485 (0/3)     -               B 859 (0/7)       -
                   A 803 (0/7)     A 821 (0/10)    A 1158 (1/13)   A 1506 (2/20)
   Hard average    B 228 (0/0)     B 100 (0/0)     B 457 (0/1)       -
                   A 963 (0/9)     A 475 (1/3)     A 1118 (1/10)   A 1356 (0/22)
   Hard skilled    B  35           -               B 108             -
                   A 263 (0/0)     A 156 (0/1)     A 697 (0/3)     A 995 (1/11)
   Easy novice     A 212 (0/0)     A 150           A 225           A 321 (0/1)
   Old Hard let a skilled roller lose 35 % over all of chapter I; the spam roller now loses 3-6x what a timed roller loses on Normal.
   Chapter II common foes were raised again after this table (dmg 2.0 -> 2.15; 2.3 measured 311 / 610 / 301 for normal avg / hard avg / hard skilled, a touch above chapter III). */
