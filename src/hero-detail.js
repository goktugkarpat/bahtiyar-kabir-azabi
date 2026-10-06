/* KARA GEÇİT — Bahtiyar's bare-body detail (ajan:visual-dark). Secondary pieces on the base body, under any equipment:
   blood-stained cloth bands wound around both upper arms.
   Skinned to the body with the body's own weights (they follow every animation). Equipment from gear-*.js is drawn on top;
   these pieces are thin, so bracers and greaves simply cover them. Publishes BABA.HeroDetail. ?nohero turns it off. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var OFF = /[?&]nohero(&|$)/.test(location.search);
  function apply(A, recipe, C) {
    if (OFF || !C || !C.sleeve || !B.Gear) return;
    var G = B.Gear, mats = recipe.materials || (recipe.materials = {});
    if (!mats['hero-wrap'] && C.gearMaterial) mats['hero-wrap'] = C.gearMaterial('bandage');
    function wrap(from, to, t0, t1, pad, th, flare) {
      try {
        if (!A.index || A.index[from] === undefined || A.index[to] === undefined) return;
        var q = C.sleeve(A, from, to, t0, t1, pad, th, ['skin'], flare || 0, { u: 22, v: 9 });
        G.uvScale(q.geometry, 1.4, 2.2);
        // spiral bands: the cloth is wound, not a tube (cavity grooves between the turns, blood soaked toward the hand)
        G.wear(q.geometry, { edge: 0, border: .25, cavity: .03, curv: .004, paint: function (p) { return .15; } });
        A.transfer('hero-wrap', q.geometry, ['skin'], { bones: [from, to] });
      } catch (e) { if (window.console) console.warn('hero wrap ' + from + ': ' + (e && e.message)); }
    }
    // upper arms: a wound cloth band around each biceps (the forearms and shins already carry leather bracers and boots)
    wrap('upper_armL', 'forearmL', .52, .8, .007, .008, .004);
    wrap('upper_armR', 'forearmR', .58, .86, .007, .008, .004);
  }
  B.HeroDetail = { apply: apply };
}());
