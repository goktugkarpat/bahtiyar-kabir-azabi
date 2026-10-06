/* KABİR AZABI — bölüm III / IV boss düzenekleri (round 7).
   Shared machinery for the chapter III boss (Oyukların Kralı), chapter IV boss (Ocağın Kalbi) and their two mini-bosses each:
     orbs      homing fractured cores (pooled PBR bodies + floor warning; rolled i-frames beat them)
     pillars   crystal cover pillars (chapter III): block line of sight of the channelled nova, absorb it, shatter, regrow
     summon    wave adds taken from dormant reserve enemies of the boss encounter (revived, never created at run time)
     ground    capped persistent burning ground (hazards with the engine's own tells)
     tick      fight clock, cooldown acceleration (later phases), soft enrage (frenzy), per-module hooks
   and the boss2* effect kinds (particles, waves, glow through the already pooled telegraph / particle systems).
   Rules kept: every mesh / material / texture is built once in create() (setup) and warmed by warmup.js' full-scene draw; nothing is
   allocated per frame; no lights. combat.js hands in `ext` (see bossExt in combat.js). */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var angDiff = function (a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); };
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var Boss2 = B.Boss2 = { out: null, moves: {}, baseSpeed: {}, current: null,
    // balance knobs: extra rest-time shaved per phase (boss), per mini-boss, in frenzy; speed multipliers per phase; adds' health / damage vs. the room's foes
    tune: { acc: [.03, .11, .18], accMini: .1, accFrenzy: .1, spd: [1, 1.03, 1.05], spdFrenzy: 1.06, addHp: .3, addDmg: .55 },
    tune4: { acc: [.02, .07, .12], accMini: .1, accFrenzy: .1, spd: [1, 1.02, 1.05], spdFrenzy: 1.06, addHp: .4, addDmg: .65 } };

  /* ---------------------------------------------------------------- hooks into the existing renderers (no edits to their files) */
  // The telegraph renderer receives the shared particle emitter from effects.js: keep a handle on it.
  var tg = B.Telegraphs;
  if (tg && tg.create && !tg.__boss2) {
    var tgCreate = tg.create;
    tg.create = function (r, g, s, out) {
      Boss2.out = out;
      var api = tgCreate.apply(this, arguments), dispose = api.dispose;
      api.dispose = function () { dispose.apply(this, arguments); if (Boss2.out === out) Boss2.out = null; };
      return api;
    };
    tg.__boss2 = true;
  }
  var ef = B.Effects;
  if (ef && ef.create && !ef.__boss2) {
    var efCreate = ef.create;
    ef.create = function () {
      var api = efCreate.apply(this, arguments), burst = api.burst, tells = api.tells;
      api.burst = function (name, d) {
        if (typeof name === 'string' && name.indexOf('boss2') === 0) { playFx(name, d || {}, burst, tells); return; }
        return burst.apply(this, arguments);
      };
      return api;
    };
    ef.__boss2 = true;
  }

  var VIOLET = [.42, .30, .78], AMBER = [1.35, .48, .10], ASH = [.12, .1, .09], BONE = [.78, .68, .6];
  function playFx(name, d, burst, tells) {
    var out = Boss2.out, emit = out && out.emit, calm = reduced.matches, x = d.x || 0, z = d.z || 0, i, a, r, n;
    var forge = d.kind === 'slag' || d.forge;
    var col = forge ? AMBER : VIOLET, k = calm ? .5 : 1;
    if (name === 'boss2Orb') {
      if(d.end){if(out&&out.fragments)out.fragments(x,d.y||1.0,z,{metal:forge,count:calm?2:5,spread:.12,speed:1.5,lift:1.8,size:.065});if(out&&out.sound)out.sound('boss2OrbImpact',{x:x,z:z,kind:d.kind,forge:forge});}
      if (tells && !calm) tells.glowBurst(x, z, { radius: d.end ? 1.1 : .75, life: .3, color: [col[0] * .35, col[1] * .35, col[2] * .35], peak: .18 });
      if (emit) for (i = 0, n = Math.round(10 * k); i < n; i++) { a = Math.random() * TAU; emit(x, d.y || 1.2, z, 1, col, Math.sin(a) * 2.4, .5 + Math.random() * 1.3, Math.cos(a) * 2.4, .3, .07); }
    } else if (name === 'boss2Shards') {          // crystal / slag spurts along a line: x,z origin, face, length, width
      var f = d.face || 0, L = d.length || 8, W = d.width || 1.2;
      if(out&&out.fragments)for(i=0,n=Math.round(12*k);i<n;i++){var along=(i+.5)/n*L,side=(Math.random()-.5)*W;out.fragments(x+Math.sin(f)*along+Math.cos(f)*side,.08,z+Math.cos(f)*along-Math.sin(f)*side,{metal:forge,count:1,spread:.1,speed:.8,lift:2.5+Math.random()*1.5,size:forge?.075:.11});}
      if (emit) for (i = 0, n = Math.round(14 * k); i < n; i++) {
        var t = Math.random() * L, s = (Math.random() - .5) * W;
        emit(x + Math.sin(f) * t + Math.cos(f) * s, .15, z + Math.cos(f) * t - Math.sin(f) * s, forge&&i%3===0?1:2, forge&&i%3===0?AMBER:ASH, (Math.random() - .5) * .8, 1.6 + Math.random() * 2.4, (Math.random() - .5) * .8, .45 + Math.random() * .3, .08);
      }
    } else if (name === 'boss2Shatter') {         // a pillar bursts
      // A consumed shelter sheds physical stone; it does not draw a false damage circle.
      col=BONE;
      if(out&&out.sound)out.sound('boss2Shatter',{x:x,z:z,shelter:!!d.shelter});
      if(out&&out.fragments)out.fragments(x,.3,z,{count:calm?10:20,spread:.65,speed:3.2,lift:4.0,size:.13});
      if (emit) for (i = 0, n = Math.round(28 * k); i < n; i++) { a = Math.random() * TAU; r = Math.random() * .7; emit(x + Math.sin(a) * r, .3 + Math.random() * 2.4, z + Math.cos(a) * r, 2, ASH, Math.sin(a) * (1.5 + Math.random() * 3), 1 + Math.random() * 3, Math.cos(a) * (1.5 + Math.random() * 3), .5 + Math.random() * .4, .1); }
    } else if (name === 'boss2Echo') {            // a shadow column steps out of the floor
      if (tells && !calm) tells.glowBurst(x, z, { radius: 1.1, life: .6, color: [.28, .24, .46], peak: .22 });
      if (tells) tells.wave(x, z, { radius: 3.2, life: .6, width: .06, color: [.24, .18, .43], soft: 0 });
      if (emit) for (i = 0, n = Math.round(12 * k); i < n; i++) { a = Math.random() * TAU; r = Math.random() * .6; emit(x + Math.sin(a) * r, .1 + Math.random() * 2.4, z + Math.cos(a) * r, 5, i % 3 ? [.23, .19, .48] : [.58, .52, .72], Math.sin(a) * .3, .5 + Math.random() * .9, Math.cos(a) * .3, 1.1 + Math.random() * .5, .22); }
    } else if (name === 'boss2Burrow') {          // dive / emerge: dust and gravel
      burst('slam', { x: x, z: z, radius: d.emerge ? 4.8 : 3.4, small: !d.emerge });
      if (tells) tells.wave(x, z, { radius: d.emerge ? 6.6 : 3.4, life: d.emerge ? .8 : .5, width: .07, color: [.32,.28,.23], soft: 0, crack: d.emerge ? .10 : 0, crackR: 3 });
    } else if (name === 'boss2Geyser') {          // lava / slag erupts at a point (or along a line when length is given)
      if (emit) for (i = 0, n = Math.round(24 * k); i < n; i++) { var tt = d.length ? Math.random() * d.length : 0, sf = d.face || 0; emit(x + Math.sin(sf) * tt + (Math.random() - .5) * (d.width || 1), .2, z + Math.cos(sf) * tt + (Math.random() - .5) * (d.width || 1), 4, i % 2 ? AMBER : [3.2, 1.6, .5], (Math.random() - .5) * .9, 3 + Math.random() * 3.4, (Math.random() - .5) * .9, .6 + Math.random() * .4, .11); }
      if (tells && !calm && !d.length) tells.glowBurst(x, z, { radius: 2.2, life: .45, color: [2.0, .7, .2], peak: .5 });
    } else if (name === 'boss2Summon') {
      burst('slam', { x: x, z: z, radius: 3.6, small: true });
      if (tells) tells.wave(x, z, { radius: 3.4, life: .55, width: .065, color: forge ? [.48,.17,.045] : [.22,.18,.38], soft: 0 });
    } else if (name === 'boss2Nova') {            // channel charge (phase 'charge') and release
      if (d.phase === 'release') {
        if(out&&out.sound)out.sound('boss2Nova',{x:x,z:z,forge:forge});
        if (tells) { tells.wave(x, z, { radius: 17, life: .75, width: .07, color: [col[0] * .3, col[1] * .3, col[2] * .3], soft: .08 }); tells.glowBurst(x, z, { radius: 1.7, life: .35, color: [col[0] * .5, col[1] * .5, col[2] * .5], peak: .25 }); }
        burst('impact', { x: x, z: z });
      } else if (emit) for (i = 0, n = Math.round(6 * k); i < n; i++) { a = Math.random() * TAU; r = 5 + Math.random() * 6; emit(x + Math.sin(a) * r, .3 + Math.random() * 1.6, z + Math.cos(a) * r, 3, col, -Math.sin(a) * r / .9, 0, -Math.cos(a) * r / .9, .85, .11); }
    } else if (name === 'boss2Overheat') {
      if (tells) { tells.wave(x, z, { radius: 7.2, life: .85, width: .07, color: [.55,.17,.035], soft: .07 }); tells.glowBurst(x, z, { radius: 2.3, life: .8, color: [.7,.17,.035], peak: .14 }); }
      if (emit) for (i = 0, n = Math.round(28 * k); i < n; i++) { a = Math.random() * TAU; emit(x + Math.sin(a) * 1.2, .5 + Math.random() * 2, z + Math.cos(a) * 1.2, 4, i % 2 ? AMBER : [3.4, 1.8, .6], Math.sin(a) * 2, 1 + Math.random() * 2, Math.cos(a) * 2, .8, .12); }
    } else if (name === 'boss2Frenzy') {
      if (tells) tells.wave(x, z, { radius: 8.0, life: .85, width: .075, color: forge ? [.52,.13,.025] : [.30,.08,.15], soft: 0 });
      if (emit) for (i = 0, n = Math.round(30 * k); i < n; i++) { a = Math.random() * TAU; emit(x + Math.sin(a) * 1.5, .3 + Math.random() * 1.8, z + Math.cos(a) * 1.5, 4, col, Math.sin(a) * 2.5, 1 + Math.random() * 2, Math.cos(a) * 2.5, .9, .12); }
    }
  }
  Boss2.playFx = playFx;

  /* ---------------------------------------------------------------- dormant reserve enemies of the boss encounter */
  Boss2.reserve = function (chapter, defs) {
    var set = chapter === 3
      ? [['cavefang', 'Oyuk Çenesi'], ['cavefang', 'Oyuk Çenesi'], ['ashbound', 'Taht Yeminlisi'], ['ashbound', 'Taht Yeminlisi']]
      : [['slagcrawler', 'Döküm Kölesi'], ['slagcrawler', 'Döküm Kölesi'], ['emberbound', 'Kor Kölesi'], ['emberbound', 'Kor Kölesi']];
    defs.forEach(function (enc) {
      var boss = enc.spawns.find(function (s) { return s.boss; });
      if (!boss || enc.spawns.some(function (s) { return s.reserve; })) return;
      set.forEach(function (t, i) { enc.spawns.push({ type: t[0], name: t[1], x: boss.x + (i % 2 ? 5 : -5), z: boss.z + 3, reserve: true }); });
    });
  };

  /* ---------------------------------------------------------------- the per-game controller */
  Boss2.create = function (ext) {
    var chapter = ext.chapter, player = ext.player, enemies = ext.enemies, hazards = ext.hazards, game = ext.game, world = ext.world;
    var forge = chapter === 4, core = { chapter: chapter, ext: ext, hooks: [], time: 0 };
    Boss2.current = core;
    var room = (world.rooms || [])[13];
    core.arena = room ? { x: room.x, z: room.z, w: room.w, d: room.d } : { x: 0, z: -330, w: 32, d: 26 };
    var group = new T.Group(); group.name = 'boss2_props'; ext.root.add(group);
    // inside the sealed court (margin m from the walls): add waves never appear behind the seal or in a wall niche
    core.inArena = function (p, m) { var a = core.arena; return Math.abs(p.x - a.x) < a.w / 2 - m - 1 && Math.abs(p.z - a.z) < a.d / 2 - m; };

    // dormant adds: thinner than the common foes of the room, never created later
    enemies.forEach(function (e) { if (e.reserve) e.b2full = { hp: e.baseMaxHp || e.maxHp, dmg: e.campaignDamage || 1 }; });

    /* ---------------- orbs ---------------- */
    var glowTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.28, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }());
    // A soft ribbon, with a smooth circumference; the maximum warning footprint is unchanged.
    var ringGeo = new T.RingGeometry(.62, .86, 48, 2).rotateX(-Math.PI / 2);
    var ringColor = new Float32Array(ringGeo.attributes.position.count * 4);
    for (var ri = 0; ri < ringGeo.attributes.position.count; ri++) { var band = Math.floor(ri / 49); ringColor.set([1, 1, 1, band === 1 ? 1 : 0], ri * 4); }
    ringGeo.setAttribute('color', new T.BufferAttribute(ringColor, 4));
    function sprite(color, scale) {
      var m = new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, fog: false, color: color }), s = new T.Sprite(m);
      s.scale.set(scale, scale, 1); s.visible = false; s.frustumCulled = false; s.renderOrder = 6; group.add(s); return s;
    }
    // Tangible held/flying cores: jagged crystal for the king, fractured
    // cooling slag for the furnace. Six bodies and all surfaces are prebuilt.
    var orbStoneTex=(function(){var c=document.createElement('canvas');c.width=c.height=256;var ctx=c.getContext('2d'),seed=2117;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}ctx.fillStyle='#777976';ctx.fillRect(0,0,256,256);for(var j=0;j<1200;j++){var v=80+Math.floor(rnd()*100);ctx.fillStyle='rgba('+v+','+v+','+v+',.32)';ctx.fillRect(rnd()*256,rnd()*256,1+rnd()*6,1+rnd()*6);}for(var j=0;j<15;j++){var x=rnd()*256,y=rnd()*256;ctx.beginPath();ctx.moveTo(x,y);for(var k=0;k<7;k++){x+=(rnd()-.5)*40;y+=(rnd()-.5)*47;ctx.lineTo(x,y);}ctx.strokeStyle='#323233';ctx.lineWidth=3.4;ctx.stroke();ctx.strokeStyle='#d6d2c6';ctx.lineWidth=.7;ctx.stroke();}var tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;return tex;}());
    var orbBodyGeo=new T.IcosahedronGeometry(.255,1),bodyPos=orbBodyGeo.attributes.position;for(var j=0;j<bodyPos.count;j++){var x=bodyPos.getX(j),y=bodyPos.getY(j),z=bodyPos.getZ(j),r=1+.11*Math.sin(x*21+y*17+z*11);bodyPos.setXYZ(j,x*r,y*r,z*r);}orbBodyGeo.computeVertexNormals();orbBodyGeo.computeBoundingSphere();
    var shardParts=[];for(var j=0;j<7;j++){var a=j*2.39996,g=new T.IcosahedronGeometry(.052+(j%3)*.009,0);g.scale(.65,1.8,.8);g.rotateZ(a);g.rotateY(a*.7);g.translate(Math.sin(a)*.34,Math.sin(a*1.7)*.21,Math.cos(a)*.34);shardParts.push(g);}var orbShardGeo=B.Gear.merge(shardParts);orbShardGeo.computeBoundingSphere();
    var orbBodyMat=new T.MeshStandardMaterial({map:orbStoneTex,bumpMap:orbStoneTex,bumpScale:.028,color:forge?0x796553:0x93849f,roughness:forge?.77:.64,metalness:forge?.26:.10,emissive:forge?0x9b3510:0x49345e,emissiveIntensity:.19});orbBodyMat.__shared=true;
    var orbShardMat=orbBodyMat.clone();orbShardMat.__shared=true;orbShardMat.color.multiplyScalar(.8);orbShardMat.emissiveIntensity=.09;
    function orbBody(){var g=new T.Group();g.name='boss2_physical_core';var body=new T.Mesh(orbBodyGeo,orbBodyMat),shards=new T.Mesh(orbShardGeo,orbShardMat);body.receiveShadow=shards.receiveShadow=true;g.add(body,shards);g.visible=false;g.frustumCulled=false;group.add(g);return g;}
    var pool = [];
    for (var oi = 0; oi < 6; oi++) {
      var ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffd08a, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      ring.visible = false; ring.frustumCulled = false; ring.renderOrder = 3; group.add(ring);
      pool.push({ on: false, glow: sprite(0xffffff, 1.4), core: sprite(0xffffff, .7), body:orbBody(), ring: ring, hz: { damage: 10, owner: null, enemy: '', attack: '', style: 'ember', x: 0, z: 0 }, trail: 0 });
    }
    var orbs = core.orbs = {
      pool: pool,
      count: function () { var n = 0; for (var i = 0; i < pool.length; i++) if (pool[i].on) n++; return n; },
      free: function () { return pool.length - orbs.count(); },
      // o: { kind:'arc'|'slag', hold, speed, turn, life, damage, name, off (fan angle) }
      spawn: function (owner, o) {
        var orb = null; for (var i = 0; i < pool.length; i++) if (!pool[i].on) { orb = pool[i]; break; }
        if (!orb) return null;
        orb.on = true; orb.owner = owner; orb.kind = o.kind || 'arc'; orb.hold = o.hold || 1; orb.speed = o.speed || 4.4; orb.turn = o.turn || 1.4; orb.life = o.life || 5.2; orb.off = o.off || 0;
        orb.age = 0; orb.launched = false; orb.cd = 0; orb.trail = 0; orb.h = owner.face;
        orb.x = owner.x + Math.sin(owner.face + orb.off) * 1.5; orb.z = owner.z + Math.cos(owner.face + orb.off) * 1.5; orb.y = 1.9;
        var c = orb.kind === 'slag' ? [1, .45, .12] : [.5, .3, 1];
        orb.glow.material.color.setRGB(c[0]*.6,c[1]*.6,c[2]*.65);orb.glow.material.opacity=.24;orb.core.material.color.setRGB(c[0]*.75,c[1]*.75,c[2]*.8);orb.core.material.opacity=.22;
        orb.hz.damage = o.damage || 12; orb.hz.owner = owner; orb.hz.enemy = owner.name; orb.hz.attack = o.name || 'Küre';
        orb.glow.visible = orb.core.visible = orb.body.visible = true; orb.ring.visible = true; orb.ring.material.color.setRGB(1, .19, .10);
        return orb;
      },
      kill: function (orb, quiet) {
        if (!orb.on) return;
        orb.on = false; orb.glow.visible = orb.core.visible = orb.body.visible = orb.ring.visible = false;
        if (!quiet && orb.launched) {
          ext.fx('boss2Orb', { x: orb.x, z: orb.z, y: 1, kind: orb.kind, end: true });
          if (orb.kind === 'slag' && orb.owner && !orb.owner.dead && ext.walkable(orb.x, orb.z, .3)) core.ground(orb.owner, { x: orb.x, z: orb.z, radius: 1.7, duration: 3.6, damage: 4, name: 'Cüruf Birikintisi', warn: .55 });
        }
      },
      clear: function () { for (var i = 0; i < pool.length; i++) orbs.kill(pool[i], true); }
    };
    function orbsTick(dt) {
      for (var i = 0; i < pool.length; i++) {
        var o = pool[i]; if (!o.on) continue;
        var ow = o.owner; o.age += dt; o.cd = Math.max(0, o.cd - dt);
        if (!ow || ow.dead) { orbs.kill(o, true); continue; }
        if (o.age < o.hold) {
          var u = o.age / o.hold, f = ow.face + o.off * (1 - u * .5);
          o.x = ow.x + Math.sin(f) * 1.5; o.z = ow.z + Math.cos(f) * 1.5; o.y = 1.9 + .5 * u;
          o.glow.scale.setScalar(.45 + .65 * u); o.core.scale.setScalar(.16 + .3 * u);
          o.ring.material.opacity = .25 * u; o.ring.scale.setScalar(.4 + .6 * u);
        } else {
          if (!o.launched) {
            o.launched = true; o.h = Math.atan2(player.x - o.x, player.z - o.z) + o.off * .55; o.y = 1.1;
            ext.fx('boss2Orb', { x: o.x, z: o.z, y: 1.4, kind: o.kind }); ext.sound('enemyAttack', { x: o.x, z: o.z, type: ow.type });
            o.glow.scale.setScalar(1.15); o.core.scale.setScalar(.48); o.ring.scale.setScalar(1); o.ring.material.opacity = .55;
          }
          var want = Math.atan2(player.x - o.x, player.z - o.z);
          o.h += clamp(angDiff(want, o.h), -o.turn * dt, o.turn * dt);
          var nx = o.x + Math.sin(o.h) * o.speed * dt, nz = o.z + Math.cos(o.h) * o.speed * dt;
          if (!ext.walkable(nx, nz, .15)) { o.x = nx; o.z = nz; orbs.kill(o); continue; }
          o.x = nx; o.z = nz;
          if (pillars.list.length && pillars.hits(o.x, o.z, .35)) { orbs.kill(o); continue; }
          if (o.cd <= 0 && !player.dead && Math.hypot(player.x - o.x, player.z - o.z) < .95) {
            o.hz.x = o.x; o.hz.z = o.z;
            if (player.invulnerable) { ext.hitPlayer(o.hz); o.cd = .6; }       // rolled through: the orb flies on
            else if (ext.hitPlayer(o.hz)) { orbs.kill(o, true); ext.fx('boss2Orb', { x: o.x, z: o.z, y: 1, kind: o.kind, end: true }); continue; }
          }
          if (o.age - o.hold > o.life) { orbs.kill(o); continue; }
          o.y = 1.1 + .12 * Math.sin(o.age * 7);
          o.trail -= dt;
          if (o.trail <= 0 && Boss2.out && Boss2.out.emit) {
            o.trail = reduced.matches ? .12 : .045;
            var c = o.kind === 'slag' ? AMBER : VIOLET;
            Boss2.out.emit(o.x - Math.sin(o.h) * .3, o.y, o.z - Math.cos(o.h) * .3, 3, c, (Math.random() - .5) * .5, .1, (Math.random() - .5) * .5, .4, .13);
          }
        }
        o.glow.position.set(o.x, o.y, o.z); o.core.position.set(o.x, o.y, o.z); o.ring.position.set(o.x, world.effectHeightAt ? world.effectHeightAt(o.x,o.z,1) : .07, o.z);
        o.body.position.set(o.x,o.y,o.z);o.body.rotation.set(o.age*.31+i*.8,o.age*.53+i*1.4,o.age*.17);o.body.scale.setScalar(.72+.28*Math.min(1,o.age/o.hold));
      }
    }

    /* ---------------- crystal pillars (chapter III) ---------------- */
    var pillars = core.pillars = { list: [], armed: false, wedges: [], arm: null,
      hits: function (x, z, r) { var l = pillars.list; for (var i = 0; i < l.length; i++) { var p = l[i]; if (p.state === 2 || (p.state === 1 && p.k > .55)) { var dx = x - p.x, dz = z - p.z, m = p.r + r; if (dx * dx + dz * dz < m * m) return p; } } return null; },
      up: function () { var n = 0; for (var i = 0; i < pillars.list.length; i++) if (pillars.list[i].state === 2) n++; return n; },
      // the first standing pillar on the segment a->b (line of sight), else null
      blocks: function (ax, az, bx, bz) {
        var l = pillars.list, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        for (var i = 0; i < l.length; i++) {
          var p = l[i]; if (p.state !== 2) continue;
          var t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / L2, 0, 1), cx = ax + dx * t - p.x, cz = az + dz * t - p.z;
          if (t > 0 && t < 1 && cx * cx + cz * cz < (p.r + .12) * (p.r + .12)) return p;
        }
        return null;
      },
      shatter: function (p, why) {
        if (p.state !== 2 && p.state !== 1) return;
        p.state = 3; p.k = 1; p.timer = 12 + (why === 'nova' ? 2 : 0);
        ext.fx('boss2Shatter', { x: p.x, z: p.z, shelter:why==='nova' });
      },
      // pillars within `radius` of (x,z) burst (resonance)
      shatterNear: function (x, z, radius) { for (var i = 0; i < pillars.list.length; i++) { var p = pillars.list[i]; if (Math.hypot(p.x - x, p.z - z) < radius) pillars.shatter(p, 'pulse'); } }
    };
    var coverMaterial = null;
    if (chapter === 3 && world.materials && (world.materials.stone || world.materials.rock || world.materials.crystal)) {
      var cm = coverMaterial = world.materials.stone || world.materials.rock || world.materials.crystal;
      // one merged geometry (shaft, tip and three shards), shared by the four pillars: 4 draw calls in all
      var parts = [], pm = new T.Matrix4(), pq = new T.Quaternion(), pe = new T.Euler(), ps = new T.Vector3(), pp = new T.Vector3();
      function part(g, x, y, z, rx, rz, sx, sy, sz) { pe.set(rx, 0, rz); pq.setFromEuler(pe); pp.set(x, y, z); ps.set(sx, sy, sz); pm.compose(pp, pq, ps); var c = g.clone(); c.applyMatrix4(pm); parts.push(c); }
      var gBody = new T.CylinderGeometry(.46, .8, 1, 6, 1), gTip = new T.ConeGeometry(.46, 1, 6), gShard = new T.ConeGeometry(.2, 1, 5);
      part(gBody, 0, 1.08, 0, 0, 0, 1, 2.16, 1); part(gTip, 0, 2.27, 0, .09, -.08, 1, .36, 1);
      for (var si = 0; si < 3; si++) { var a = si * 2.1; part(gShard, Math.sin(a) * .9, .6, Math.cos(a) * .9, Math.cos(a) * .35, -Math.sin(a) * .35, 1, .65 + si * .16, 1); }
      var pillarGeo = new T.BufferGeometry(), pos = [], nor = [], uvs = [], idx = [], off = 0;
      parts.forEach(function (g) {
        var P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, I = g.index.array, k;
        for (k = 0; k < P.length; k++) { pos.push(P[k]); nor.push(N[k]); } for (k = 0; k < U.length; k++) uvs.push(U[k]);
        for (k = 0; k < I.length; k++) idx.push(I[k] + off); off += P.length / 3; g.dispose();
      });
      gBody.dispose(); gTip.dispose(); gShard.dispose();
      pillarGeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); pillarGeo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); pillarGeo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); pillarGeo.setIndex(idx);
      var wear = new Float32Array(pos.length);
      for(var pv=0;pv<pos.length;pv+=3){var edge=.68+.16*Math.max(0,nor[pv+1])+.10*Math.min(1,pos[pv+1]/2.4);wear[pv]=edge;wear[pv+1]=edge*.96;wear[pv+2]=edge*.89;}
      pillarGeo.setAttribute('color',new T.BufferAttribute(wear,3));
      for (var pi = 0; pi < 4; pi++) {
        var pg = new T.Mesh(pillarGeo, cm); pg.visible = false; pg.frustumCulled = false; pg.receiveShadow = true;
        group.add(pg); pillars.list.push({ x: 0, z: 0, r: .85, state: 0, k: 0, timer: 0, g: pg });
      }
      // safe-shadow trapezoids behind the pillars while the nova is channelled
      var wmat = new T.MeshBasicMaterial({ color: 0x4d9cba, vertexColors: true, transparent: true, opacity: .31, depthWrite: false, blending: T.NormalBlending, side: T.DoubleSide });
      for (var wi = 0; wi < 4; wi++) {
        var wg = new T.BufferGeometry(), wc = new Float32Array(64), wi2 = [];
        wg.setAttribute('position', new T.BufferAttribute(new Float32Array(48), 3).setUsage(T.DynamicDrawUsage));
        for (var row = 0; row < 4; row++) for (var col = 0; col < 4; col++) { var v = row * 4 + col; wc.set([1, 1, 1, row > 0 && row < 3 && col > 0 && col < 3 ? .9 : 0], v * 4); if (row < 3 && col < 3) wi2.push(v, v + 4, v + 1, v + 1, v + 4, v + 5); }
        wg.setAttribute('color', new T.BufferAttribute(wc, 4)); wg.setIndex(wi2);
        var wm = new T.Mesh(wg, wmat); wm.visible = false; wm.frustumCulled = false; wm.renderOrder = 2; group.add(wm); pillars.wedges.push(wm);
      }
      // the pillars are solid for everybody (hero, foes): wrap the world's collision once; the wrapper always asks the newest game's pillars
      // A fixed small visibility graph steers click orders around the moving cover too.
      // The static floor graph cannot see these runtime pillars; body collision alone would trap
      // a hero clicking a safe shadow on the far side. No navigation grid or geometry is rebuilt.
      function pillarCircleSweep(p, ax, az, bx, bz, radius) {
        if(p.state!==2 && !(p.state===1 && p.k>.55))return false;
        var dx=bx-ax,dz=bz-az,L2=dx*dx+dz*dz;
        var u=L2>1e-12?clamp(((p.x-ax)*dx+(p.z-az)*dz)/L2,0,1):0;
        var x=ax+dx*u-p.x,z=az+dz*u-p.z,R=p.r+radius+.006;
        return x*x+z*z<R*R;
      }
      function pillarSweep(P, ax, az, bx, bz, radius) {
        for(var i=0;i<P.list.length;i++)if(pillarCircleSweep(P.list[i],ax,az,bx,bz,radius))return true;
        return false;
      }
      function pillarRoute(P, from, base, radius, hold, host, allCover) {
        var work=hold.navWork;
        if(!work) {
          var nodes=[];for(var k=0;k<96;k++)nodes.push({x:0,z:0});
          work=hold.navWork={nodes:nodes,dist:new Float64Array(96),parent:new Int16Array(96),done:new Uint8Array(96),links:new Uint8Array(96*96)};
        }
        var nodes=work.nodes,N=0;
        function add(x,z) {if(N>=96)return false;nodes[N].x=x;nodes[N++].z=z;return true;}
        add(from.x,from.z);
        var goal=base[base.length-1],cover=P.hits(goal.x,goal.z,radius);
        if(cover) {
          var dx=from.x-cover.x,dz=from.z-cover.z,D=Math.hypot(dx,dz)||1,R=cover.r+radius+.2;
          goal={x:cover.x+dx/D*R,z:cover.z+dz/D*R};
          if(!hold.walk.call(host,goal.x,goal.z,radius)||P.hits(goal.x,goal.z,radius))return null;
        }
        add(goal.x,goal.z);
        for(var i=0;i<base.length-1;i++)if(!P.hits(base[i].x,base[i].z,radius)) {
          if(N>=62)return null;add(base[i].x,base[i].z);
        }
        // Usually a single pillar blocks the leg: solve its eight corners first.
        // All cover still participates in every edge test. A rare second obstruction
        // expands this same bounded workspace once, rather than running 32 nodes every query.
        var selected=0;
        for(var i=0;i<P.list.length;i++) {
          var A=from;for(var k=0;k<base.length;k++){var B=base[k];if(pillarCircleSweep(P.list[i],A.x,A.z,B.x,B.z,radius)){selected|=1<<i;break;}A=B;}
        }
        for(var i=0;i<P.list.length;i++) {
          var p=P.list[i];if(p.state!==2 && !(p.state===1 && p.k>.55)||!allCover&&!(selected&(1<<i)))continue;
          var R=(p.r+radius+.16)/Math.cos(Math.PI/8);
          for(var k=0;k<8;k++) {
            var a=k*Math.PI/4,x=p.x+Math.cos(a)*R,z=p.z+Math.sin(a)*R;
            if(hold.walk.call(host,x,z,radius)&&!P.hits(x,z,radius))add(x,z);
          }
        }
        work.dist.fill(Infinity);work.parent.fill(-1);work.done.fill(0);work.links.fill(0);work.dist[0]=0;
        for(var step=0;step<N;step++) {
          var at=-1,best=Infinity;for(var k=0;k<N;k++)if(!work.done[k]&&work.dist[k]<best){best=work.dist[k];at=k;}
          if(at<0)break;if(at===1) {
            var result=[],id=1;while(id>0){result.push({x:nodes[id].x,z:nodes[id].z});id=work.parent[id];}
            return result.reverse();
          }
          work.done[at]=1;
          for(var k=0;k<N;k++)if(!work.done[k]&&k!==at) {
            var link=at*96+k,valid=work.links[link];
            if(!valid) {
              var A=nodes[at],B=nodes[k];
              valid=hold.clear.call(host,A.x,A.z,B.x,B.z,radius)&&!pillarSweep(P,A.x,A.z,B.x,B.z,radius)?2:1;
              work.links[link]=work.links[k*96+at]=valid;
            }
            if(valid!==2)continue;
            var cost=best+Math.hypot(nodes[at].x-nodes[k].x,nodes[at].z-nodes[k].z);
            if(cost<work.dist[k]){work.dist[k]=cost;work.parent[k]=at;}
          }
        }
        return allCover ? null : pillarRoute(P,from,base,radius,hold,host,true);
      }
      var hold = world.__boss2 || (world.__boss2 = { p: null, walk: world.isWalkable, move: world.move, clear: world.hasClearPath, path: world.pathTo, on: false });
      hold.p = pillars;
      if (hold.walk && hold.move && !hold.on) {
        hold.on = true;
        if(hold.clear)world.hasClearPath=function(ax,az,bx,bz,r) {
          var P=hold.p,radius=r==null?.46:r;
          return hold.clear.call(this,ax,az,bx,bz,radius)&&(!P||!P.armed||!pillarSweep(P,ax,az,bx,bz,radius));
        };
        if(hold.path&&hold.clear)world.pathTo=function(from,to,r) {
          var base=hold.path.call(this,from,to,r),P=hold.p,radius=r==null?.46:r;
          if(!base||!base.length||!P||!P.armed)return base;
          var A=from,blocked=false;for(var i=0;i<base.length;i++){var B=base[i];if(pillarSweep(P,A.x,A.z,B.x,B.z,radius)){blocked=true;break;}A=B;}
          return blocked?pillarRoute(P,from,base,radius,hold,this):base;
        };
        world.isWalkable = function (x, z, r) { var P = hold.p; if (P && P.armed && P.hits(x, z, r == null ? .46 : r)) return false; return hold.walk.call(this, x, z, r); };
        world.move = function (p, dx, dz, r) {
          var P = hold.p;
          if (!P || !P.armed) return hold.move.call(this, p, dx, dz, r);
          var ox = p.x, oz = p.z; hold.move.call(this, p, dx, dz, r);
          var rr = r == null ? .46 : r, hit = P.hits(p.x, p.z, rr);
          if (hit) {   // slide along the pillar's rim instead of entering it
            var ax = p.x - hit.x, az = p.z - hit.z, d = Math.hypot(ax, az) || 1, m = hit.r + rr + .01;
            p.x = hit.x + ax / d * m; p.z = hit.z + az / d * m;
            if (!hold.walk.call(this, p.x, p.z, r)) { p.x = ox; p.z = oz; }
          }
          return p;
        };
      }
      pillars.arm = function () {
        var a = core.arena, spots = [[-7.2, 5], [7.2, 5], [-7.2, -5], [7.2, -5]];
        for (var i = 0; i < pillars.list.length; i++) {
          var p = pillars.list[i], x = a.x + spots[i][0], z = a.z + spots[i][1];
          for (var tries = 0; tries < 6 && !hold.walk.call(world, x, z, 1.1); tries++) z += (tries % 2 ? 1 : -1) * (1 + tries * .5);
          p.x = x; p.z = z; p.state = 1; p.k = 0; p.g.position.set(x, 0, z); p.g.scale.set(1, .02, 1); p.g.visible = true;
        }
        pillars.armed = true;
        ext.emit('toast', { text: 'Taş siperler yükseldi. Nova geldiğinde arkalarına geç.' });
      };
    }
    function pillarsTick(dt) {
      for (var i = 0; i < pillars.list.length; i++) {
        var p = pillars.list[i];
        if (p.state === 1) { p.k = Math.min(1, p.k + dt / 1.2); p.g.scale.y = .02 + .98 * (1 - Math.pow(1 - p.k, 3)); if (p.k >= 1) p.state = 2; }
        else if (p.state === 3) { p.k = Math.max(0, p.k - dt / .25); p.g.scale.y = Math.max(.02, p.k); if (p.k <= 0) { p.state = 4; p.g.visible = false; } }
        else if (p.state === 4) { p.timer -= dt; if (p.timer <= 0 && Math.hypot(player.x - p.x, player.z - p.z) > 2.2) { p.state = 1; p.k = 0; p.g.scale.y = .02; p.g.visible = true; } }
      }
      if (nova.on && (!nova.owner || nova.owner.dead || !nova.owner.action || nova.owner.action.moveId!=='hollowNova')) core.novaEnd();
      if (nova.on) {
        nova.t += dt;
        if (Boss2.out && Boss2.out.emit && (nova.em -= dt) <= 0) { nova.em = reduced.matches ? .4 : .22; playFx('boss2Nova', { x: nova.x, z: nova.z, phase: 'charge', forge: false }, null, null); }
      }
    }
    var nova = core.nova = { on: false, x: 0, z: 0, t: 0, em: 0 };
    // Begin a channel: show the safe shadows behind every standing pillar.
    core.novaBegin = function (owner) {
      if (!core.novaHinted) { core.novaHinted = true; ext.emit('toast', { text: 'Sessiz Nova toplanıyor. Taş sütunun arkasındaki mavi sipere geç.' }); }
      nova.on = true; nova.owner = owner; nova.x = owner.x; nova.z = owner.z; nova.t = 0; nova.em = 0;
      var w = 0;
      for (var i = 0; i < pillars.list.length && w < pillars.wedges.length; i++) {
        var p = pillars.list[i]; if (p.state !== 2) continue;
        var dx = p.x - owner.x, dz = p.z - owner.z, D = Math.hypot(dx, dz) || 1, ux = dx / D, uz = dz / D, nx = uz, nz = -ux, L = 13, w0 = p.r + .12, w1 = (p.r + .12) * (D + L) / D;
        var pos = pillars.wedges[w].geometry.attributes.position.array, y = world.effectHeightAt ? world.effectHeightAt(p.x,p.z,13)+.01 : .08;
        // Keep the same trapezoid's four boundaries; a narrow inset gives its edge a soft falloff.
        for (var row = 0; row < 4; row++) { var along = row === 0 ? 0 : row === 1 ? .025 : row === 2 ? .97 : 1, ww = w0 + (w1 - w0) * along;
          for (var col = 0; col < 4; col++) { var side = col === 0 ? -1 : col === 1 ? -.94 : col === 2 ? .94 : 1, v = (row * 4 + col) * 3;
            pos[v] = p.x + ux * L * along + nx * ww * side; pos[v + 1] = y; pos[v + 2] = p.z + uz * L * along + nz * ww * side;
          }
        }
        pillars.wedges[w].geometry.attributes.position.needsUpdate = true; pillars.wedges[w].visible = true; w++;
      }
    };
    core.novaEnd = function () { nova.on = false; nova.owner = null; for (var i = 0; i < pillars.wedges.length; i++) pillars.wedges[i].visible = false; };
    // Resolve a nova: a standing pillar on the line of sight takes the blast (and shatters), otherwise the hero is hit.
    core.novaResolve = function (owner, damage, name) {
      core.novaEnd();
      ext.fx('boss2Nova', { x: owner.x, z: owner.z, phase: 'release', forge: forge });
      if (owner.dead || player.dead) return;
      var p = pillars.blocks(owner.x, owner.z, player.x, player.z);
      if (p) { pillars.shatter(p, 'nova'); ext.emit('toast', { text: 'Taş siper darbeyi yuttu.' }); return; }
      ext.hitPlayer({ damage: damage, owner: owner, enemy: owner.name, attack: name, unblockable: true, style: 'shadow', x: owner.x, z: owner.z, knockback: 0 });
    };

    /* ---------------- safe fans (chapter IV clock): cool translucent wedges on the floor ---------------- */
    var FAN_N = 32, fanMat = new T.MeshBasicMaterial({ color: 0x7dcced, vertexColors: true, transparent: true, opacity: .32, depthWrite: false, blending: T.NormalBlending, side: T.DoubleSide });
    core.fans = [];
    for (var fi = 0; fi < 2; fi++) {
      var fg = new T.BufferGeometry(), idx = [], vc = new Float32Array((1 + (FAN_N + 1) * 2) * 4);
      fg.setAttribute('position', new T.BufferAttribute(new Float32Array((1 + (FAN_N + 1) * 2) * 3), 3).setUsage(T.DynamicDrawUsage));
      vc.set([1, 1, 1, .20], 0);
      for (var fk = 0; fk <= FAN_N; fk++) { var vi = 1 + fk * 2, edge = Math.min(1, fk / 1.3, (FAN_N - fk) / 1.3); vc.set([1, 1, 1, (fk===1||fk===FAN_N-1?.98:.24)*edge], vi * 4); vc.set([1, 1, 1, 0], (vi + 1) * 4);
        if (fk < FAN_N) idx.push(0, vi, vi + 2, vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
      }
      fg.setAttribute('color', new T.BufferAttribute(vc, 4)); fg.setIndex(idx);
      var fm = new T.Mesh(fg, fanMat); fm.visible = false; fm.frustumCulled = false; fm.renderOrder = 2; group.add(fm); core.fans.push(fm);
    }
    core.fanSet = function (i, cx, cz, R, a0, a1) {
      var m = core.fans[i];
      if(m.cx===cx&&m.cz===cz&&m.rad===R&&m.a0===a0&&m.a1===a1){m.visible=true;return;}
      m.cx=cx;m.cz=cz;m.rad=R;m.a0=a0;m.a1=a1;
      var pos = m.geometry.attributes.position.array, y = world.effectHeightAt ? world.effectHeightAt(cx,cz,R)+.02 : .09;
      pos[0] = cx; pos[1] = y; pos[2] = cz;
      for (var k = 0; k <= FAN_N; k++) { var at=k===1?.006:k===2?.016:k===FAN_N-2?.984:k===FAN_N-1?.994:k/FAN_N, a = a0 + (a1 - a0) * at, sx = Math.sin(a), sz = Math.cos(a), vi = (1 + k * 2) * 3;
        pos[vi] = cx + sx * R * .975; pos[vi + 1] = y; pos[vi + 2] = cz + sz * R * .975;
        pos[vi + 3] = cx + sx * R; pos[vi + 4] = y; pos[vi + 5] = cz + sz * R;
      }
      m.geometry.attributes.position.needsUpdate = true; m.visible = true;
    };
    core.fanHide = function () { for (var i = 0; i < core.fans.length; i++) core.fans[i].visible = false; };

    /* ---------------- burning ground (capped) ---------------- */
    core.groundCount = function () { var n = 0; for (var i = 0; i < hazards.length; i++) if (hazards[i].b2ground) n++; return n; };
    // o: { x, z, radius | (face,width,length), duration, damage, warn, name, shape }
    core.ground = function (owner, o) {
      if (core.groundCount() >= 9) return null;
      var line = o.shape === 'line';
      return ext.hazardFrom(owner, { x: o.x, z: o.z, face: o.face || 0, shape: line ? 'line' : 'circle', radius: o.radius || 1.6, width: o.width || 1.6, length: o.length || 6,
        warn: o.warn || .5, duration: o.duration || 4, delay: o.delay || 0, damage: o.damage || 4, periodic: true, interval: .7, persistent: true, unblockable: false,
        attack: o.name || 'Yanan Zemin', style: 'ember', fill: line ? 'forward' : 'radial', near: false, b2ground: true, pool: 'lava' });
    };

    /* ---------------- adds ---------------- */
    core.freeReserve = function (owner) {
      var n = 0; enemies.forEach(function (e) { if (e.reserve && e.dead && !e.used && e.encounter === owner.encounter) n++; }); return n;
    };
    core.aliveAdds = function () { var n = 0; enemies.forEach(function (e) { if (e.reserve && !e.dead && e.summoned) n++; }); return n; };
    // Revive the next dormant reserve enemy at (x,z); returns it or null.
    core.summon = function (owner, x, z) {
      var e = null; for (var i = 0; i < enemies.length; i++) { var c = enemies[i]; if (c.reserve && c.dead && !c.used && c.encounter === owner.encounter) { e = c; break; } }
      if (!e) return null;
      var face = Math.atan2(player.x - x, player.z - z);
      e.x = x; e.z = z; e.spawnX = x; e.spawnZ = z; e.face = face; e.hp = e.maxHp; e.dead = false; e.deadAge = 0; e.active = true; e.activated = true; e.returning = false;
      var tn = forge ? Boss2.tune4 : Boss2.tune, fh = Math.round(e.b2full.hp * tn.addHp); e.baseMaxHp = fh; e.maxHp = Math.round(fh * (game.difficulty === 'easy' ? .72 : 1)); e.hp = e.maxHp; e.campaignDamage = e.b2full.dmg * tn.addDmg;
      e.action = null; e.stagger = 0; e.hurt = 0; e.cooldown = 2.0; e.faceLocked = false; e.push = null; e.navigation = null; e.spWait = 1; e.summoned = true; e.used = true;
      e.model.root.visible = true; e.holder.visible = true; e.model.root.position.set(x, 0, z); e.model.root.rotation.y = face;
      e.model.animate(0, { reset: true, time: 0, move: 0, attack: 0, dead: false, phase: 'idle', face: face });
      ext.fx('boss2Summon', { x: x, z: z, forge: forge });
      return e;
    };

    /* ---------------- fight clock, aggression, frenzy ---------------- */
    var FRENZY_AT = forge ? 240 : 210;
    function bossy(e) { return !e.dead && e.active && e.stats && (e.stats.ruins || e.stats.forge) && (e.boss || e.type === 'ruinwarden' || e.type === 'ashwarden'); }
    function fightTick(e, dt) {
      var b = e.b2 || (e.b2 = { t: 0, frenzy: false, base: 0 });
      b.t += dt;
      if (e.boss) {
        if (!Boss2.baseSpeed[e.type]) Boss2.baseSpeed[e.type] = e.stats.speed;
        if (!b.frenzy && b.t > FRENZY_AT) {
          b.frenzy = true;
          ext.emit('warning', { x: e.x, z: e.z, text: forge ? 'OCAK KIZIŞTI' : 'TAHT SABRINI YİTİRDİ' }); ext.sound('bossPhase'); ext.fx('boss2Frenzy', { x: e.x, z: e.z, forge: forge });
        }
        var tn = forge ? Boss2.tune4 : Boss2.tune;
        e.stats.speed = Boss2.baseSpeed[e.type] * tn.spd[clamp(e.phase - 1, 0, 2)] * (b.frenzy ? tn.spdFrenzy : 1);
      }
      // later phases recover faster: the engine counts the rest down in real seconds, we shave extra off while no move runs
      if (!e.action && e.cooldown > 0) {
        var tn = forge ? Boss2.tune4 : Boss2.tune, k = e.boss ? tn.acc[clamp(e.phase - 1, 0, 2)] + (b.frenzy ? tn.accFrenzy : 0) : tn.accMini;
        e.cooldown = Math.max(e.recoveryFloor || 0, e.cooldown - dt * k);
      }
    }

    core.tick = function (dt) {
      if (game.state !== 'playing') return;
      core.time += dt;
      var boss = game.boss;
      for (var i = 0; i < enemies.length; i++) { var e = enemies[i]; if (!e.reserve && bossy(e)) fightTick(e, dt); }
      if (boss && chapter === 3 && !pillars.armed && pillars.arm && boss.active && !boss.dead) pillars.arm();
      if (boss && boss.dead) {
        orbs.clear(); core.novaEnd();
        for (var j = 0; j < enemies.length; j++) { var a = enemies[j]; if (a.reserve && !a.dead && a.summoned) { a.hp = 0; ext.killEnemy(a); } }
      }
      orbsTick(dt); pillarsTick(dt);
      // embers over burning ground (a few per frame at most)
      if (Boss2.out && Boss2.out.emit && !reduced.matches) {
        core.emberT = (core.emberT || 0) - dt;
        if (core.emberT <= 0) {
          core.emberT = .12; var shown = 0;
          for (var h = 0; h < hazards.length && shown < 6; h++) {
            var z = hazards[h]; if (!z.b2ground || !z.active) continue;
            var px = z.x, pz = z.z; if (z.shape === 'line') { var tt = Math.random() * z.length; px += Math.sin(z.face) * tt; pz += Math.cos(z.face) * tt; } else { var aa = Math.random() * TAU, rr = Math.sqrt(Math.random()) * z.radius; px += Math.sin(aa) * rr; pz += Math.cos(aa) * rr; }
            Boss2.out.emit(px, .08, pz, 4, forge ? AMBER : VIOLET, (Math.random() - .5) * .4, .5 + Math.random() * .6, (Math.random() - .5) * .4, .7, .09); shown++;
          }
        }
      }
      for (var q = 0; q < core.hooks.length; q++) core.hooks[q].tick(dt);
    };
    core.reset = function () {
      orbs.clear(); core.novaEnd(); core.fanHide();
      pillars.armed = false; pillars.list.forEach(function (p) { p.state = 0; p.g.visible = false; });
      enemies.forEach(function (e) {
        if (e.reserve) { e.used = false; e.summoned = false; }
        if (e.b2) { e.b2 = null; }
        e.b2cd = null;
        if (e.overheat) e.overheat = false;
        if (e.stats && Boss2.baseSpeed[e.type]) e.stats.speed = Boss2.baseSpeed[e.type];
      });
      core.emberT = 0; core.novaHinted = false;
      for (var q = 0; q < core.hooks.length; q++) if (core.hooks[q].reset) core.hooks[q].reset();
    };
    core.dispose = function () {
      orbs.clear(); glowTex.dispose(); ringGeo.dispose(); if (world.__boss2 && world.__boss2.p === pillars) world.__boss2.p = null;
      group.traverse(function (o) {
        if (o.isSprite || (o.isMesh && o.material && o.material !== coverMaterial)) { if (o.material && !o.material.__shared) o.material.dispose(); }
        if (o.isMesh && o.geometry && o.geometry !== ringGeo && o.geometry !== orbBodyGeo && o.geometry !== orbShardGeo) o.geometry.dispose();
      });
      orbBodyGeo.dispose();orbShardGeo.dispose();orbBodyMat.dispose();orbShardMat.dispose();orbStoneTex.dispose();
      group.removeFromParent();
      if (Boss2.current === core) Boss2.current = null;
    };
    return core;
  };
}());
