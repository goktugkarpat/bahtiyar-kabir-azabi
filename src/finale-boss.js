/* KABİR AZABI — V: Son Mahkeme. Kara Kadı on the shared boss director (boss-framework.js, ajan:bosses): cinematic entrance, phase cards,
   enrage ring, pursuit, perfect dodge, two signature verdicts and the court that fights back. Loaded right after boss-framework.js. */
(function () {
  'use strict';
  var B = window.BABA, BF = B.BossFramework, tr = function (s) { return KabirI18n.t(s); };
  // chapter V roster in the innate mob ability table (mob-abilities.js): the condemned charge, scribes heal the court, crawlers flank, jailers brace
  if (B.MobAbilities && B.MobAbilities.ROLE) Object.assign(B.MobAbilities.ROLE, { damned: 'bullRush', verdictseer: 'mend', voidcrawler: 'flank', chainjailer: 'brace' });
  if (!BF || !BF.register) return;
  BF.register('lastjudge', {
    // Hüküm Sütunları: the court's lost names fall as columns of verdict onto a ring of the arena, two at a time, in a turning order;
    // from phase 2 the column nearest the hero joins in.
    arena: { phase: 1, first: 11, every: [15, 12, 9.5], build: function (e, ar, n, k, api) {
      var R = Math.min(ar.w, ar.d) * .32, p = api.player, near = -1, best = 1e9, pts = [], i;
      for (i = 0; i < 8; i++) { var a = i * Math.PI / 4 + .2, o = { x: ar.x + Math.sin(a) * R * 1.15, z: ar.z + Math.cos(a) * R }; pts.push(o); var dd = Math.hypot(o.x - p.x, o.z - p.z); if (dd < best) { best = dd; near = i; } }
      var pick = [n % 4, n % 4 + 4]; if (pick.indexOf(near) < 0 && e.phase >= 2) pick.push(near);
      pick.forEach(function (j, q) { var o = pts[j]; if (!api.walkable(o.x, o.z, .8)) return;
        BF.env(e, { x: o.x, z: o.z, shape: 'circle', radius: 2.5, warn: 1.5 + q * .2, duration: .2, damage: 17, unblockable: true, style: 'ember', fill: 'inward', scar: true, attack: tr('Hüküm Sütunu') }); });
      return true;
    } },
    title: tr('Kara Kadı'), epithet: tr('Bütün Hükümlerin Mührü'), sub: tr('SON MAHKEME'), color: 0xc8283a, style: 'ember', pool: 'lava', sound: 'chain',
    phases: { 2: tr('EFENDİLERİN YANKISI'), 3: tr('SON HÜKÜM') }, enraged: tr('SON HÜKÜM'),
    pursuit: { name: tr('Kadı’nın Takibi'), pose: 'charge', dmg: 19, after: 13 },
    signature: { id: 'verdictToll', first: 14, cd: [24, 19, 15], phase: 1, range: 15, hint: tr('Hüküm halkaları dıştan içe kapanır. Halka geçince dışarı yürü; merkez en son patlar.'),
      build: function (e, d, k, api) {
        var o = { x: api.player.x, z: api.player.z }, n = e.phase >= 3 ? 4 : 3, name = tr('Hükmün Okunuşu');
        return { id: 'verdictToll', name: name, duration: 1.3 + n * .55 + 1.1, pose: 'roar', cooldown: 1.0, hits: k.rings(e, o, name, 'ember', n, 2.4, 15, 25) };
      } },
    signature2: { id: 'ledgerPrison', first: 20, cd: [28, 23, 18], phase: 2, range: 15, hint: tr('Defterin sayfaları seni kapatır; merkez çökecek. Duvar yanmadan yürü ya da duvarı tek yuvarlanışla geç.'),
      build: function (e, d, k, api) { var o = { x: api.player.x, z: api.player.z }, name = tr('Defterin Hapsi');
        return { id: 'ledgerPrison', name: name, duration: 3.9, pose: 'castHigh', cooldown: .9, hits: k.prison(e, o, name, 'ember', 'lava', 5, 31) }; } }
  });
}());
