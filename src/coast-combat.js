/* KARA KIYI — distinct moves, shared contact clocks and dodge rules. */
(function () {
  'use strict';
  var B = window.BABA, TAU = Math.PI * 2;
  B.CoastCombat = {
    stats: {
      drowned: { name: 'Boğulmuş', hp: 124, speed: 2.2, radius: .46, reach: 5, cooldown: 1.65, color: 0x729995, coast: true },
      rootborn: { name: 'Kök Yutmuş', hp: 188, speed: 1.65, radius: .65, reach: 7, cooldown: 2.1, color: 0x9e9364, coast: true },
      crawler: { name: 'İskele Sürüngeni', hp: 105, speed: 3.2, radius: .55, reach: 8, cooldown: 1.65, color: 0x9fa593, coast: true },
      urchin: { name: 'Dikenli Leş', hp: 146, speed: 1.7, radius: .61, reach: 11, cooldown: 2.25, color: 0x889b7e, coast: true, ranged: true },
      lantern: { name: 'Sırıtan Fenerci', hp: 121, speed: 2.05, radius: .42, reach: 13, cooldown: 2.4, color: 0x8abbb0, coast: true, ranged: true },
      bell: { name: 'Derinliklerin Çancısı', hp: 2500, speed: 2, radius: 1.03, reach: 16, cooldown: 1.05, color: 0xa6b4a0, coast: true, boss: true }
    },
    create: function (api) {
      var player = api.player;
      function hit(at, warn, shape, size, dmg, pose, more) {
        return Object.assign({ at: at, warn: warn, shape: shape, radius: size, dmg: dmg, style: 'blade', fill: 'sweep', pose: pose }, more || {});
      }
      function cone(e, id, name, radius, arc, dmg, pose, at) {
        at = at || .75;
        return { id: id, name: name, duration: at + .72, pose: pose,
          hits: [hit(at, at, 'cone', radius, dmg, pose, { arc: arc, sweepDir: 1 })] };
      }
      function point() { return { x: player.x, z: player.z }; }
      function line(e, id, name, dmg, width, pose, warn, more) {
        return { id: id, name: name, duration: warn + .8, pose: pose, hits: [hit(warn, warn, 'line', 0, dmg, pose,
          Object.assign({ width: width, length: api.clipLine(e, e.face, 13), style: 'thrust', fill: 'forward' }, more || {}))] };
      }
      function circle(e, id, name, size, dmg, warn, more) {
        return { id: id, name: name, duration: warn + .8, pose: 'castHigh', hits: [hit(warn, warn, 'circle', size, dmg, 'castHigh',
          Object.assign({ origin: point(), style: 'bile', fill: 'radial' }, more || {}))] };
      }
      function dash(e, id, name, dmg, speed) {
        var t = point(), a = Math.atan2(t.x - e.x, t.z - e.z), len = Math.hypot(t.x - e.x, t.z - e.z), stop = Math.min(1.2, len), end = { x: t.x - Math.sin(a) * stop, z: t.z - Math.cos(a) * stop };
        return { id: id, name: name, duration: 1.7, pose: 'crouch', retreat: .8,
          movement: { start: .95, duration: speed || .3, fromX: e.x, fromZ: e.z, x: end.x, z: end.z, leap: true },
          hits: [hit(1.25, 1.0, 'circle', 2.0, dmg, 'leap', { origin: t, style: 'shadow', fill: 'radial' })] };
      }
      function rootRows(e, name, n) {
        var t = point(), hits = [];
        // Locked positions: roots never silently chase a dodge after their warning appears.
        for (var i = 0; i < n; i++) {
          var a = e.face + (i - (n - 1) / 2) * .46;
          hits.push(hit(1.2 + i * .22, 1.05, 'line', 0, 18, 'castHigh', { width: .95, length: api.clipLine(e, a, 12), face: a, style: 'root', fill: 'forward', unblockable: true, beat: i === 0 }));
        }
        return { id: 'rootRows', name: name, duration: 2.4 + n * .22, pose: 'castHigh', hits: hits, cooldown: 2 };
      }
      function tide(e, count) {
        var hits = [], o = { x: e.x, z: e.z };
        // Successive annuli leave a real inner safe pocket and an outer escape route.
        for (var i = 0; i < count; i++) hits.push(hit(1.35 + i * .62, i ? .62 : 1.35, 'ring', 4.3 + i * 3.2, 19, 'roar',
          { inner: 2 + i * 3.2, arc: TAU, origin: o, style: 'tide', fill: 'radial', unblockable: true }));
        return { id: 'tide', name: 'Kara Medcezir', duration: 2.3 + count * .62, pose: 'roar', hits: hits, cooldown: 2.15 };
      }
      function bells(e) {
        var t = point(), hits = [], count = e.enraged ? 4 : 3;
        for (var i = 0; i < count; i++) {
          var a = i / count * TAU + e.face, o = i ? { x: t.x + Math.sin(a) * 4.4, z: t.z + Math.cos(a) * 4.4 } : t;
          if (!api.walkable(o.x, o.z, 1)) continue;
          hits.push(hit(1.35 + i * .25, 1.1, 'circle', 2.05, 24, 'overhead', { origin: o, style: 'tide', fill: 'radial', unblockable: true, attack: 'Boğulmuş Çan · ' + (i + 1) }));
        }
        return { id: 'bells', name: 'Boğulmuş Çanlar', duration: 3.1, pose: 'castHigh', hits: hits, cooldown: 2.1 };
      }
      // ---- Round 7: new Çancı moves (TBC-raid mechanics, top-down). Cool-downs and orbs live in boss-mech.js (B.BossMech.current).
      function mech() { return B.BossMech && B.BossMech.current; }
      function rnd(e) { e.seed = (Math.imul(e.seed, 1664525) + 1013904223) >>> 0; return e.seed / 4294967296; }   // same stream as combat.js rand(e)
      function ready(e, id, cd) { var m = mech(); return !!m && m.ready(e, id, cd); }
      function mark(e, id) { var m = mech(); if (m) m.mark(e, id); }
      // Çan Vuruşu: the bell tolls and thin rings of sea roll outward on the beat, 0.9 s apart; the gaps between the rings are safe, or roll through one on its toll.
      function toll(e, count) {
        var o = { x: e.x, z: e.z }, hits = [];
        for (var i = 0; i < count; i++) (function (i) {
          var inner = 2 + i * 3.3;
          hits.push(hit(1.3 + i * .9, i ? .85 : 1.3, 'ring', inner + 1.5, 18, 'roar', { inner: inner, arc: TAU, origin: o, style: 'tide', fill: 'radial', beat: i === 0, attack: 'Çan Vuruşu · ' + (i + 1),
            onActive: function () { api.sound('boss1Toll', { x: o.x, z: o.z }); api.fx('boss1Toll', { x: o.x, z: o.z, radius: inner + 1.5 }); } }));
        })(i);
        return { id: 'toll', name: 'Çan Vuruşu', duration: 1.3 + count * .9 + .7, pose: 'roar', onBegin: function () { mark(e, 'toll'); }, hits: hits };
      }
      // Gelgit Duvarı: five walls of water roll out of the bell toward the hero, each with a gap; stand in the gap column (it is shown with the first wall) or roll through.
      function tideWalls(e) {
        var f = Math.atan2(player.x - e.x, player.z - e.z), vs = Math.sin(f), vc = Math.cos(f), us = Math.cos(f), uc = -Math.sin(f), hits = [];
        var lat = (player.x - e.x) * us + (player.z - e.z) * uc, gap = Math.max(-5, Math.min(5, lat + (rnd(e) < .5 ? -1 : 1) * (2.2 + rnd(e) * 1.2)));
        for (var k = 0; k < 5; k++) {
          var s = 3.4 + k * 2.7, at = 1.3 + k * .5;
          [[-11, gap - 1.9], [gap + 1.9, 11]].forEach(function (seg, j) {
            hits.push(hit(at, .8, 'line', 0, 14, 'roar', { origin: { x: e.x + vs * s + us * seg[0], z: e.z + vc * s + uc * seg[0] }, face: f + Math.PI / 2, width: 1.6, length: seg[1] - seg[0],
              style: 'tide', fill: 'forward', beat: k === 0 && j === 0, attack: 'Gelgit Duvarı' }));
          });
        }
        return { id: 'tides', name: 'Gelgit Duvarı', duration: 1.3 + 5 * .5 + .9, pose: 'roar', onBegin: function () { mark(e, 'tides'); }, hits: hits };
      }
      // Tuzlu Havuzlar: brine pools that stay and burn for nine seconds (low damage, constant pressure on where you may stand).
      function brinePools(e, n) {
        var t = point(), hits = [], a0 = rnd(e) * TAU;
        for (var i = 0; i < n; i++) {
          var a = a0 + i * TAU / n, o = i ? { x: t.x + Math.sin(a) * 3.9, z: t.z + Math.cos(a) * 3.9 } : t;
          if (!api.walkable(o.x, o.z, 1)) continue;
          hits.push(hit(1.3 + i * .25, 1.1, 'circle', 2.2, 4, 'throw', { origin: o, style: 'tide', fill: 'radial', persistent: true, periodic: true, interval: .8, duration: 9, pool: 'brine', beat: i === 0, attack: 'Tuzlu Havuz' }));
        }
        return { id: 'brine', name: 'Tuzlu Havuzlar', duration: 2.7, pose: 'throw', onBegin: function () { mark(e, 'brine'); }, hits: hits };
      }
      // Karanlık Gelgit (lantern light): the sea blacks out the hall except one lantern-lit circle; outside it the water bites every 0.9 s. Three lit circles, each shown 1.8 s before the last one dies.
      function lanterns(e) {
        var hits = [], c = point(), S = 5.6;
        for (var k = 0; k < 3; k++) {
          if (k) { var next = null; for (var tries = 0; tries < 10 && !next; tries++) { var a = rnd(e) * TAU, r = 7.5 + rnd(e) * 2.5, q = { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r }; if (api.walkable(q.x, q.z, 1.2)) next = q; } c = next || c; }
          hits.push(hit(1.9 + k * S, k ? 1.8 : 1.7, 'ring', 30, 6, 'roar', { inner: 3.7, arc: TAU, origin: { x: c.x, z: c.z }, persistent: true, periodic: true, interval: .9, duration: S, pool: 'dark', poolGain: .8, tellGain: .3,
            style: 'tide', fill: 'inward', beat: k === 0, attack: 'Karanlık Gelgit' }));
        }
        return { id: 'lanterns', name: 'Karanlık Gelgit', duration: 2.8, pose: 'roar', onBegin: function () { mark(e, 'lanterns'); }, hits: hits };
      }
      function lanternOrbs(e, n) {
        return { id: 'orbs', name: 'Boğulmuş Fenerler', duration: 2.5, pose: 'castHigh', onBegin: function () { mark(e, 'orbs'); }, hits: [
          hit(1.0, 1.0, 'circle', .1, 0, 'castHigh', { harmless: true, beat: true, style: 'tide', onActive: function () { var m = mech(); if (m && !e.dead) m.launchOrbs(e, n, { kind: 'brine', speed: e.phase >= 4 ? 3.3 : 3.05 }); } })] };
      }
      return {
        attack: function (e, d) {
          var list = [];
          if (e.type === 'drowned') list = [
            { id: 'oar', ok: d < 3.5, w: 4, move: function () { return cone(e, 'oar', 'Kırık Kürek', 3.1, 2.3, 13, 'sweep', .72); } },
            { id: 'oarButt', ok: d < 2.9, w: 2, move: function () { return { id: 'oarButt', name: 'Kürek Kabzası', duration: 1.35, pose: 'thrust', hits: [hit(.70,.70,'line',0,10,'thrust',{width:1.1,length:3.1,style:'blunt',fill:'forward'})] }; } },
            { id: 'waterLunge', sp: 1, ok: d > 3 && d < 10, w: 2, move: function () {
              var hits=[];for(var i=0;i<3;i++)hits.push(hit(1.0+i*.3,.85,'line',0,13,'roar',{origin:{x:e.x+Math.sin(e.face)*i*2.3,z:e.z+Math.cos(e.face)*i*2.3},face:e.face,width:2.3,length:2.6,style:'tide',fill:'forward',knockback:1.8,beat:i===0}));
              return {id:'waterLunge',name:'Boğulmuş Akıntı',duration:2.4,pose:'roar',hits:hits};
            } },
            { id: 'gurgle', sp: 1, ok: d < 4.5, w: 2, move: function () { return { id: 'gurgle', name: 'Boğulma Çığlığı', duration: 2, pose: 'roar', hits: [hit(1.05, 1.05, 'ring', 4.8, 12, 'roar', { inner: 1.1, arc: TAU, style: 'tide', fill: 'radial', knockback:2.4 })] }; } }
          ];
          else if (e.type === 'rootborn') list = [
            { id: 'rootClub', ok: d < 4.3, w: 4, move: function () { return cone(e, 'rootClub', 'Kök Tokmağı', 4, 2, 19, 'overhead', .95); } },
            { id: 'rootShoulder', ok: d < 2.8, w: 2, move: function () { var mv=cone(e,'rootShoulder','Kök Omzu',3.0,2.2,11,'bash',.78);mv.hits[0].knockback=1.8;return mv; } },
            { id: 'rootRows', sp: 1, ok: d > 3 && d < 10, w: 2, move: function () { return rootRows(e, 'Mezar Kökleri', 2); } },
            { id: 'rootCrown', sp: 1, ok: d < 6, w: 2, move: function () { return { id: 'rootCrown', name: 'Çürük Taç', duration: 2.4, pose: 'roar', hits: [hit(1.2, 1.2, 'ring', 6, 19, 'roar', { inner: 2, arc: TAU, style: 'root', fill: 'radial', unblockable: true })] }; } }
          ];
          else if (e.type === 'crawler') list = [
            { id: 'bite', ok: d < 2.8, w: 4, move: function () { return cone(e, 'bite', 'Çene Kapanı', 2.6, 1.8, 12, 'clawR', .6); } },
            { id: 'skitter', sp: 1, ok: d > 3 && d < 8, w: 3, move: function () { var m=dash(e,'skitter','Leş Sıçrayışı',16,.3);m.hits[0].style='bile';
              m.hits.push(hit(1.6,1.1,'circle',1.65,3,'crouch',{origin:point(),style:'bile',fill:'radial',persistent:true,periodic:true,interval:.9,duration:3.5,poison:true,unblockable:true}));return m; } },
            { id: 'rake', ok: d < 3.1, w: 2, move: function () { return { id: 'rake', name: 'Yırtıcı Ayaklar', duration: 1.9, pose: 'clawR', retreat: .9, hits: [
              hit(.65, .65, 'cone', 2.8, 8, 'clawR', { arc: 2, sweepDir: 1 }), hit(1.15, .5, 'cone', 2.8, 9, 'clawL', { arc: 2, sweepDir: -1, track: true })] }; } }
          ];
          else if (e.type === 'urchin') list = [
            { id: 'needles', ok: d > 3 && d < 12, w: 4, move: function () { var m = line(e, 'needles', 'Tuz Dikenleri', 11, .60, 'throw', .85, { projectile: { kind: 'spur', flight: .2, fromY: 1.5 } }); m.hits = [-.22,-.11,0,.11,.22].map(function (a, i) { return Object.assign({}, m.hits[0], { face: e.face + a, length: api.clipLine(e, e.face + a, 12), beat: i === 0 }); }); return m; } },
            { id: 'spineSwipe', ok: d < 3.6, w: 4, move: function () { return cone(e, 'spineSwipe', 'Diken Biçişi', 3.4, 1.8, 14, 'sweep', .8); } },
            { id: 'brine', sp: 1, ok: d < 11, w: 2, move: function () { var hits=[],t=point();for(var i=0;i<3;i++){var a=e.face+i*TAU/3,o={x:t.x+Math.sin(a)*2.4,z:t.z+Math.cos(a)*2.4};if(api.walkable(o.x,o.z,1))hits.push(hit(1.1+i*.25,1.1,'circle',1.45,12,'throw',{origin:o,style:'bile',fill:'radial',unblockable:true}));}return {id:'brine',name:'Tuz Yuvaları',duration:2.7,pose:'throw',hits:hits}; } }
          ];
          else if (e.type === 'lantern') list = [
            { id: 'lanternRay', ok: d > 3 && d < 13, w: 4, move: function () { var m=line(e,'lanternRay','Fener Tarama',11,.85,'castHigh',1.05,{style:'tide'});m.hits=[-.32,0,.32].map(function(a,i){return Object.assign({},m.hits[0],{at:1.05+i*.3,face:e.face+a,beat:i===0});});m.duration=2.7;return m; } },
            { id: 'lanternSwipe', ok: d < 3.4, w: 3, move: function () { return cone(e, 'lanternSwipe', 'Sırıtan Bıçak', 3.1, 2, 12, 'clawR', .65); } },
            { id: 'falseLights', sp: 1, ok: d < 12, w: 2, move: function () { var m = circle(e, 'falseLights', 'Bataklık Fenerleri', 1.8, 15, 1.1, { style: 'shadow', unblockable: true }); var p = point(); m.hits.push(hit(1.7, 1.1, 'circle', 1.8, 15, 'castHigh', { origin: { x: p.x + Math.cos(e.face) * 3.6, z: p.z - Math.sin(e.face) * 3.6 }, style: 'shadow', fill: 'radial', unblockable: true })); m.hits.push(hit(2.1,1.1,'circle',1.8,15,'castHigh',{origin:{x:p.x-Math.cos(e.face)*3.6,z:p.z+Math.sin(e.face)*3.6},style:'shadow',fill:'radial',unblockable:true}));m.duration = 2.9; return m; } }
          ];
          else if (e.type === 'bell') {
            var m = mech();
            // Announced phase signature waits for any previous major field/orbs to clear; no stacked arena mechanics.
            if (e.forceMove === 'coastPhase' && (!m || !m.majorActive(e) && m.floorCount(e) === 0 && m.liveOrbs() === 0)) { e.forceMove = null; e.spWait = 1; return api.beginMove(e, e.phase === 2 ? tide(e, 2) : e.phase === 3 ? rootRows(e, 'Derin Kökler', 3) : toll(e, 4)); }
            var ph = e.phase, rest = [1.0, .88, .78, .68][ph - 1], fr = m && m.frenzied(e) ? .82 : 1, f = function (id, cd) { return !!m && m.ready(e, id, cd); };
            e.cdScale = [.88, .84, .78, .74][ph - 1] * fr;
            list = [
              { id: 'anchor', ok: d < 6.5, w: 4, move: function () { var mv = cone(e, 'anchor', 'Batık Çapa', 5.7, 3.4, 25, 'sweep', .95); if (e.phase >= 2) { mv.hits.push(hit(1.7, .75, 'cone', 5.9, 22, 'sweepBack', { arc: 3.3, face: e.face + .35, sweepDir: -1 })); mv.duration = 2.5; } mv.cooldown = rest; return mv; } },
              { id: 'bellRush', ok: d > 6 && d < 15, w: ph >= 2 ? 4 : 3, move: function () { var mv = dash(e, 'bellRush', 'Kıyıyı Yaran', 24, .4); mv.hits[0].radius = 2.8; mv.hits[0].at = 1.35; mv.duration = 2.2; mv.cooldown = rest + .05; return mv; } },
              { id: 'tide', sp: 1, ok: d < 14, w: 3, move: function () { return tide(e, e.phase >= 3 ? 3 : 2); } },
              { id: 'rootRows', sp: 1, ok: d > 2.5 && d < 14, w: e.phase >= 2 ? 3 : 1, move: function () { return rootRows(e, 'Derin Kökler', e.phase >= 3 ? 5 : 3); } },
              { id: 'bells', sp: 1, ok: e.phase >= 2 && d < 15, w: 3, move: function () { return bells(e); } },
              { id: 'keel', ok: d < 2.5, w: 2, move: function () { var mv = cone(e, 'keel', 'Omurga Darbesi', 3.4, 2.8, 14, 'kick', .7); mv.hits[0].knockback = 3; mv.cooldown = rest; return mv; } },
              { id: 'toll', sp: 1, ok: d < 15 && f('toll', 12), w: 3, move: function () { return toll(e, ph >= 3 ? 5 : ph >= 2 ? 4 : 3); } },
              { id: 'orbs', sp: 1, ok: ph >= 2 && d < 15 && f('orbs', 20) && m.liveOrbs() === 0, w: 3, move: function () { return lanternOrbs(e, ph >= 4 ? 3 : 2); } },
              { id: 'tides', sp: 1, ok: ph >= 2 && d < 15 && f('tides', 13), w: 3, move: function () { return tideWalls(e); } },
              { id: 'brine', sp: 1, ok: ph >= 3 && d < 15 && f('brine', 16), w: 2, move: function () { return brinePools(e, ph >= 4 ? 4 : 3); } },
              { id: 'lanterns', sp: 1, ok: ph >= 3 && d < 16 && f('lanterns', 42), w: 3, move: function () { return lanterns(e); } }
            ];
          }
          if(e.type==='bell' && m && (m.majorActive(e) || m.floorCount(e)>0 || m.liveOrbs()>0)) {
            for(var li=0;li<list.length;li++)if(list[li].id!=='anchor'&&list[li].id!=='keel')list[li].ok=false;
          }
          return api.pick(e, list);
        },
        phase: function (e) {
          if (!e.boss || e.dead) return;
          var f = e.hp / e.maxHp, next = f <= .24 ? 4 : f <= .48 ? 3 : f <= .72 ? 2 : 1;
          if (next <= e.phase) return;
          e.phase = next; e.enraged = next === 4; e.forceMove = 'coastPhase'; e.action = null; e.stagger = 0; e.faceLocked = false;
          api.cancelHazards(e, false); api.bonus(e.x, e.z, next === 2 ? 2 : 1);
          var names = ['', '', 'DENİZİN YEMİNİ', 'MEZAR KÖKLERİ', 'SON ÇAN'];
          api.emit('warning', { x: e.x, z: e.z, text: 'DERİNLİKLERİN ÇANCISI · ' + names[next] });
          api.emit('toast', { text: next === 2 ? 'Çan uyandı. Deniz halka halka yükseliyor.' : next === 3 ? 'Kökler yarılıyor. Güvenli boşlukları kullan.' : 'Son çan. Çapa savuruşlarının arasını bekle.' });
          api.sound('bossPhase'); api.fx('bossPhase', { x: e.x, y: 1.4, z: e.z });
          api.beginMove(e, { id: 'roar', name: names[next], duration: 2.2, pose: 'roar', cooldown: 1.1,
            hits: [hit(1.3, 1.3, 'ring', 5, 0, 'roar', { inner: 0, arc: TAU, style: 'chain', fill: 'radial', harmless: true })] });
        }
      };
    }
  };
}());
