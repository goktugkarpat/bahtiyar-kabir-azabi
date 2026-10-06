/* KABİR AZABI — INNATE MOB ABILITIES (ajan: bosses). Every ordinary foe type gets one active role ability on its own clock, on top of its
   move table (combat.js / *-combat.js), so each chapter's roster plays differently:
     bullRush   Boğa Hücumu   a lowered-head charge THROUGH the hero's spot along a line shown .95 s ahead (knock-back).
     brace      Kalkan Duruşu a shield / guard stance for ~1.5 s: blows from the front glance off (sparks, ×.15), from behind they bite;
                              it ends with a shield bash whose cone is shown .7 s ahead. Walk round it, or wait for the bash.
     mend       Şifa Ayini    a 1.3 s channel (green ring under the caster); when it completes nearby allies heal 15 %. A blow that
                              staggers the caster breaks it.
     javelin    Mızrak / Zıpkın a long thin aimed throw (line shown 1.05 s ahead); the chain-seers' harpoon also drags the hero in.
     flank      Kuşatma Sıçrayışı a leap to the hero's back or side (landing circle shown .9 s ahead).
     bomb       Kor Bombası   a lobbed bomb (circle shown 1.3 s ahead) that leaves a short burning pool.
   Roster (type → ability) per chapter is the ROLE table below; chapter V can add its types there. Uses only combat.js's beginMove
   (rhythm / unblockable-token rules still apply, so these never land in the same beat as another foe's blow) and plain hazards.
   Hooks: create(api) once; update(dt) each step; hurt(e, damage, attackFace) for the brace. One pooled arc mesh set (max 6), no lights. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, TAU = Math.PI * 2;
  var tr = function (s) { return KabirI18n.t(s); };
  var hyp = function (x, z) { return Math.sqrt(x * x + z * z); };
  var angDiff = function (a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); };
  var ROLE = {
    prisoner: 'bullRush', guard: 'brace', cultist: 'mend', stalker: 'flank', carrier: 'bomb',
    drowned: 'bullRush', rootborn: 'brace', crawler: 'flank', urchin: 'javelin', lantern: 'mend',
    ashbound: 'bullRush', gravemason: 'brace', cavefang: 'flank', shardseer: 'javelin',
    emberbound: 'bomb', slagcrawler: 'bullRush', forgesentinel: 'brace', chainseer: 'javelin'
  };
  var CD = { bullRush: 9, brace: 10, mend: 11, javelin: 8, flank: 9, bomb: 9 };

  var ARC_VS = 'varying vec2 vU; void main(){ vU = uv*2.-1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  var ARC_FS = 'uniform float uA, uT; varying vec2 vU; void main(){ float r = length(vU); float a = atan(vU.x, vU.y);' +
    ' float sector = 1.-smoothstep(.95,1.15,abs(a)); float band = smoothstep(.62,.72,r)*(1.-smoothstep(.9,1.,r));' +
    ' float lines = .7+.3*sin(a*14.+uT*3.); gl_FragColor = vec4(vec3(2.2,1.5,.6)*band*sector*lines*uA, 1.); }';

  B.MobAbilities = {
    ROLE: ROLE, current: null,
    create: function (api) {
      var game = api.game, player = api.player, enemies = api.enemies, time = 0, list = [];
      enemies.forEach(function (e) {
        var role = ROLE[e.type]; if (!role || e.boss || e.reserve || (e.stats && e.stats.elite) || e.tutorialStage >= 0) return;
        list.push({ e: e, role: role, t: 1.2 + (e.index % 5) * .35 });
      });
      var root = new T.Group(); root.name = 'mob_abilities'; api.root.add(root);
      var arcs = [], arcGeo = new T.PlaneGeometry(1, 1); arcGeo.rotateX(-Math.PI / 2);
      for (var i = 0; i < 6; i++) {
        var m = new T.Mesh(arcGeo, new T.ShaderMaterial({ vertexShader: ARC_VS, fragmentShader: ARC_FS, uniforms: { uA: { value: 0 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        m.visible = false; m.renderOrder = 3; m.frustumCulled = false; root.add(m); arcs.push({ mesh: m, e: null });
      }
      function busyNear() { var n = 0; for (var i = 0; i < enemies.length; i++) { var o = enemies[i]; if (o.action && !o.dead && hyp(o.x - player.x, o.z - player.z) < 10) n++; } return n; }
      function toHero(e) { return Math.atan2(player.x - e.x, player.z - e.z); }
      function hit(at, warn, shape, more) { var h = { at: at, warn: warn, shape: shape }; for (var k in more) h[k] = more[k]; return h; }
      var BUILD = {
        bullRush: function (e, d) {
          if (d < 4 || d > 11 || !api.clearStrike(e, player)) return null;
          var a = toHero(e), L = api.clipLine(e, a, Math.min(13, d + 3)); if (L < d) return null;
          var run = L - 1, stop = { x: e.x + Math.sin(a) * run, z: e.z + Math.cos(a) * run };
          while (run > 2 && !api.walkable(stop.x, stop.z, e.radius)) { run -= .5; stop = { x: e.x + Math.sin(a) * run, z: e.z + Math.cos(a) * run }; }
          e.face = a;
          return { id: 'bullRush', name: tr('Boğa Hücumu'), duration: 2.1, pose: 'charge', cooldown: 1.1,
            movement: { start: .95, duration: .38, fromX: e.x, fromZ: e.z, x: stop.x, z: stop.z },
            hits: [hit(.95, .95, 'line', { width: 1.6, length: L, face: a, dmg: 15, knockback: 4, style: 'blunt', fill: 'forward', pose: 'charge', duration: .38 })] };
        },
        brace: function (e, d) {
          if (d > 6) return null;
          var a = toHero(e); e.face = a;
          return { id: 'brace', name: tr('Kalkan Duruşu'), duration: 2.6, pose: 'bash', cooldown: .9,
            hits: [hit(2.2, .7, 'cone', { radius: 3.0, arc: 1.8, track: true, dmg: 13, knockback: 4.5, style: 'blunt', fill: 'forward', pose: 'shove', attack: tr('Kalkan Duruşu · darbe') })] };
        },
        mend: function (e, d) {
          var hurt = 0; for (var i = 0; i < enemies.length; i++) { var o = enemies[i]; if (o !== e && !o.dead && o.active && !o.boss && o.hp < o.maxHp * .8 && hyp(o.x - e.x, o.z - e.z) < 8) hurt++; }
          if (!hurt) return null;
          return { id: 'mend', name: tr('Şifa Ayini'), duration: 1.9, pose: 'kneel', cooldown: .8,
            hits: [hit(1.3, 1.3, 'circle', { radius: 8, dmg: 0, harmless: true, style: 'rune', fill: 'radial', pose: 'kneel', tellGain: .35,
              onActive: function () { if (e.dead || !e.action || e.action.moveId !== 'mend' || e.stagger > 0) return;
                for (var i = 0; i < enemies.length; i++) { var o = enemies[i]; if (o.dead || !o.active || o.boss || hyp(o.x - e.x, o.z - e.z) > 8) continue;
                  o.hp = Math.min(o.maxHp, o.hp + o.maxHp * .15); api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: (o.radius || .6) * 2.4, color: 0x56e08e, duration: .8 }); }
                api.sound('enemyWindup', { type: e.type, x: e.x, z: e.z, style: 'rune' }); } })] };
        },
        javelin: function (e, d) {
          if (d < 5 || d > 15 || !api.clearStrike(e, player)) return null;
          var a = toHero(e), harpoon = e.type === 'chainseer'; e.face = a;
          return { id: 'javelin', name: harpoon ? tr('Zincir Zıpkını') : tr('Mızrak Atışı'), duration: 1.8, pose: 'throw', cooldown: .9,
            hits: [hit(1.05, 1.05, 'line', { width: .75, length: api.clipLine(e, a, 16), face: a, dmg: harpoon ? 11 : 15, style: harpoon ? 'chain' : 'thrust', fill: 'forward', pose: 'throw',
              pull: harpoon, pullTo: 2.4, projectile: { kind: harpoon ? 'hook' : 'spur', flight: .2, fromY: 1.5 } })] };
        },
        flank: function (e, d) {
          if (d < 3 || d > 8) return null;
          for (var k = 0; k < 4; k++) {
            var a = player.face + Math.PI + (k % 2 ? 1 : -1) * (.4 + k * .3), dest = { x: player.x + Math.sin(a) * 1.9, z: player.z + Math.cos(a) * 1.9 };
            if (!api.walkable(dest.x, dest.z, e.radius || .5) || !api.walkable((dest.x + e.x) / 2, (dest.z + e.z) / 2, .3)) continue;
            var f = Math.atan2(player.x - dest.x, player.z - dest.z), land = { x: player.x, z: player.z };
            return { id: 'flank', name: tr('Kuşatma Sıçrayışı'), duration: 1.9, pose: 'crouch', cooldown: 1, faceAt: { t: 1.2, face: f },
              movement: { start: .85, duration: .32, fromX: e.x, fromZ: e.z, x: dest.x, z: dest.z, leap: true },
              hits: [hit(1.2, .9, 'circle', { radius: 1.8, origin: land, dmg: 13, style: 'shadow', fill: 'radial', pose: 'leap' })] };
          }
          return null;
        },
        bomb: function (e, d) {
          if (d < 4 || d > 12) return null;
          var t = { x: player.x, z: player.z }; e.face = toHero(e);
          return { id: 'bomb', name: tr('Kor Bombası'), duration: 1.9, pose: 'throw', cooldown: .9,
            hits: [hit(1.3, 1.3, 'circle', { radius: 2.1, origin: t, dmg: 14, style: 'ember', fill: 'inward', pose: 'throw', projectile: { kind: 'vial', fromY: 1.6, flight: .6, height: 2.8 },
              onActive: function () { api.addHazard({ owner: e, enemy: e.name, x: t.x, z: t.z, radius: 1.7, warn: .4, duration: 3.2, damage: 3, periodic: true, interval: .8, persistent: true, unblockable: true,
                pool: 'lava', poolGain: .6, style: 'ember', fill: 'radial', near: false, attack: tr('Kor Bombası') }); } })] };
        }
      };
      function update(dt) {
        time += dt; var i;
        for (i = 0; i < arcs.length; i++) arcs[i].mesh.material.uniforms.uT.value = time;
        if (game.state !== 'playing') return;
        var acting = -1;
        for (i = 0; i < list.length; i++) {
          var it = list[i], e = it.e;
          if (e.dead || !e.active) continue;
          it.t -= dt;
          if (it.t > 0 || e.action || e.stagger > 0 || e.fear > 0 || e.returning) continue;
          var d = hyp(player.x - e.x, player.z - e.z); if (d > 16) { it.t = 1; continue; }
          if (acting < 0) acting = busyNear();
          if (acting >= 2) { it.t = .5; continue; }
          var mv = BUILD[it.role](e, d);
          if (mv && api.beginMove(e, mv)) { it.t = CD[it.role] + (e.index % 5) * .4; acting++; }
          else it.t = mv ? .25 : .35;
        }
        // brace arcs follow their owner while the stance holds
        for (i = 0; i < arcs.length; i++) {
          var ar = arcs[i], o = ar.e;
          if (o && (o.dead || !o.action || o.action.moveId !== 'brace' || o.action.age > 2.2)) { ar.e = null; ar.mesh.visible = false; }
        }
        for (i = 0; i < list.length; i++) {
          var b = list[i].e;
          if (b.dead || !b.action || b.action.moveId !== 'brace' || b.action.age > 2.2) continue;
          var slot = null; for (var j = 0; j < arcs.length; j++) if (arcs[j].e === b) slot = arcs[j];
          if (!slot) for (j = 0; j < arcs.length; j++) if (!arcs[j].e) { slot = arcs[j]; slot.e = b; break; }
          if (!slot) continue;
          var R = (b.radius || .6) * 4.6, gy = api.groundY ? api.groundY(b.x, b.z) : .05;
          slot.mesh.visible = true; slot.mesh.position.set(b.x, gy + .06, b.z); slot.mesh.scale.set(R, 1, R); slot.mesh.rotation.y = b.face;
          slot.mesh.material.uniforms.uA.value = Math.min(1, b.action.age * 4) * (b.action.age > 1.7 ? Math.max(0, (2.2 - b.action.age) * 2) : 1);
        }
      }
      // Brace: blows that land from the front during the stance glance off.
      function hurt(e, damage, attackFace) {
        var a = e.action; if (!a || a.moveId !== 'brace' || a.age > 2.0) return damage;
        var from = Math.atan2(player.x - e.x, player.z - e.z);
        if (Math.abs(angDiff(from, e.face)) > 1.25) return damage;
        api.fx('spark', { x: e.x + Math.sin(e.face) * .6, y: 1.2, z: e.z + Math.cos(e.face) * .6, face: attackFace, glance: true });
        return Math.max(1, Math.round(damage * .15));
      }
      function dispose() { if (root.parent) root.parent.remove(root); arcGeo.dispose(); arcs.forEach(function (a) { a.mesh.material.dispose(); }); if (B.MobAbilities.current === inst) B.MobAbilities.current = null; }
      function reset() { list.forEach(function (it) { it.t = 1.2 + (it.e.index % 5) * .35; }); arcs.forEach(function (a) { a.e = null; a.mesh.visible = false; }); }
      var inst = { update: update, hurt: hurt, reset: reset, dispose: dispose, list: list, build: BUILD };
      B.MobAbilities.current = inst;
      return inst;
    }
  };
}());
