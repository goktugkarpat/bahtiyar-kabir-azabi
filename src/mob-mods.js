/* KABİR AZABI — CHAMPION MOB MODIFIERS (ajan: bosses). Path-of-Exile-style "rare" monsters with readable modifiers.

   A deterministic share of ordinary foes (hash of enemy id + chapter, so a respawn replays the same champions) becomes a CHAMPION:
     +75 % health, +12 % damage, elite loot / experience (progression.js already rewards enemy.elite), gold health bar,
     a name built from its modifiers ("Kor İzli Taş Derili Boğulmuş"), a rotating rune ring under its feet in the colour of its first modifier.
   Modifiers (every one is visible on the body or the floor; nothing is hidden):
     hasted   Çevik       faster walk, shorter rests; pale after-images while it runs.
     armored  Taş Derili  light blows glance (×.62, sparks); heavy blows and skills bite in full.
     reflect  Aynalı      a violet mirror shell rises for 2.6 s every ~7 s (.8 s pre-glow); blows struck into the shell cut the hero back.
     warded   Mühürlü     a golden seal absorbs 30 % of its health; once broken it re-forms after 9 s.
     fire     Kor İzli    leaves short-lived burning ground behind it (capped, shown .55 s before it ignites).
     venom    Zehir İzli  leaves bile pools behind it (capped).
     volatile Patlayan    its corpse bursts 1.6 s after death (crimson circle).
     mending  Şifacı      every 6.5 s a green pulse heals allies within 8 m — kill it first.
     echoing  Yankılı     every blow it lands on the floor repeats once in the same place (.7 s tell after the first): the roll that
                          dodged the first must not end inside the echo (anti dodge-spam, fully telegraphed).
     blink    Gölge Adımlı an ambusher: every ~7 s, from 4-11 m, a shadow circle opens beside / behind the hero (.65 s) and it steps out of it.
   Hooks (combat.js): create(api) after the enemies exist; update(dt) every step; hurt(e,damage,heavy,blocked) before health is reduced;
   kill(e) when a foe dies. New modifiers: add an entry to MODS (name, color, optional apply/hurt/step/kill) and to POOL.
   Rendering: two InstancedMeshes (ring + shell) for all champions together = 2 draw calls; built once; no lights; no per-frame allocation. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, TAU = Math.PI * 2;
  var tr = function (s) { return KabirI18n.t(s); };
  var hyp = function (x, z) { return Math.sqrt(x * x + z * z); };

  var MODS = {
    hasted:   { name: tr('Çevik'), color: [.55, .85, 1.25], apply: function (e) { e.stats.speed *= 1.38; e.stats.cooldown *= .78; } },
    armored:  { name: tr('Taş Derili'), color: [.75, .78, .9] },
    reflect:  { name: tr('Aynalı'), color: [.95, .4, 1.35], shell: true },
    warded:   { name: tr('Mühürlü'), color: [1.35, 1.0, .4], shell: true },
    fire:     { name: tr('Kor İzli'), color: [1.5, .45, .1] },
    venom:    { name: tr('Zehir İzli'), color: [.5, 1.15, .25] },
    volatile: { name: tr('Patlayan'), color: [1.5, .22, .1] },
    mending:  { name: tr('Şifacı'), color: [.35, 1.3, .7] },
    echoing:  { name: tr('Yankılı'), color: [1.25, .9, .35] },
    blink:    { name: tr('Gölge Adımlı'), color: [.55, .35, 1.0] }
  };
  var POOL = ['hasted', 'armored', 'fire', 'venom', 'volatile', 'mending', 'reflect', 'warded', 'echoing', 'blink'];
  var CLASH = { fire: 'venom', venom: 'fire', reflect: 'warded', warded: 'reflect' };
  var CHANCE = [0, .2, .24, .28, .32, .34], COUNT = [0, 1, 1, 2, 2, 2];

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }

  var RING_VS = 'varying vec2 vU; varying vec3 vC; void main(){ vU = uv*2.-1.;\n#ifdef USE_INSTANCING_COLOR\n vC = instanceColor;\n#else\n vC = vec3(1.);\n#endif\n' +
    ' vec4 p = vec4(position,1.);\n#ifdef USE_INSTANCING\n p = instanceMatrix*p;\n#endif\n gl_Position = projectionMatrix*modelViewMatrix*p; }';
  var RING_FS = 'uniform float uT; varying vec2 vU; varying vec3 vC; void main(){ float r = length(vU); if (r > 1.) discard; float a = atan(vU.y, vU.x);' +
    ' float band = smoothstep(.76,.82,r)*(1.-smoothstep(.9,.96,r)); float hair = smoothstep(.6,.62,r)*(1.-smoothstep(.635,.655,r));' +
    ' float glyph = step(.5, fract(a*12./6.2832))*smoothstep(.66,.7,r)*(1.-smoothstep(.74,.77,r))*(.6+.4*sin(a*3.+uT*2.));' +
    ' float core = (1.-smoothstep(0.,.8,r))*.12;' +
    ' gl_FragColor = vec4(vC*(band*1.3+hair*.8+glyph*1.+core)*.9, 1.); }';
  var SHELL_VS = 'varying vec3 vN; varying vec3 vV; varying vec3 vC; void main(){ vec4 p = vec4(position,1.); vec3 n = normal;\n#ifdef USE_INSTANCING\n p = instanceMatrix*p; n = mat3(instanceMatrix)*n;\n#endif\n' +
    '#ifdef USE_INSTANCING_COLOR\n vC = instanceColor;\n#else\n vC = vec3(1.);\n#endif\n vec4 w = modelMatrix*p; vN = normalize(mat3(modelMatrix)*n); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }';
  var SHELL_FS = 'uniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vC; void main(){ float f = pow(1.-abs(dot(normalize(vN), vV)), 3.2);' +
    ' float bands = .6+.4*sin(vN.y*22.+uT*4.)*sin(atan(vN.z,vN.x)*7.-uT*1.3); gl_FragColor = vec4(vC*(f*.95*bands+.012), 1.); }';

  B.MobMods = {
    MODS: MODS, POOL: POOL, current: null,
    create: function (api) {
      var game = api.game, player = api.player, enemies = api.enemies, hazards = api.hazards, chapter = api.chapter;
      var champs = [], time = 0, tmp = new T.Object3D(), col = new T.Color();
      // ---- choose champions (deterministic)
      var order = [], seen = [];
      enemies.forEach(function (e) { if (seen.indexOf(e.encounter) < 0) { seen.push(e.encounter); order.push(e.encounter); } });
      var perEnc = new Map();
      enemies.forEach(function (e) {
        if (e.boss || e.reserve || (e.stats && e.stats.elite) || e.tutorialStage >= 0) return;
        var ei = order.indexOf(e.encounter), h = hash(e.id + ':' + chapter), named = e.elite;
        if (chapter === 1 && ei < 2 && !named) return;
        if (!named && (h % 1000) / 1000 >= CHANCE[chapter]) return;
        var cap = chapter >= 4 ? 2 : 1, have = perEnc.get(e.encounter) || 0;
        if (!named && have >= cap) return;
        perEnc.set(e.encounter, have + 1);
        var n = Math.min(named ? 3 : 2, COUNT[chapter] + (named ? 1 : 0) + ((h >>> 11) % 3 === 0 && chapter >= 2 ? 1 : 0)), list = [];
        var pool = POOL.filter(function (id) { return chapter >= 2 || (id !== 'reflect' && id !== 'warded'); });
        for (var tries = 0; list.length < n && tries < 20; tries++) {
          var id = pool[hash(e.id + '#' + chapter + '#' + tries) % pool.length];
          if (list.indexOf(id) >= 0 || list.indexOf(CLASH[id]) >= 0) continue;
          if (id === 'mending' && (e.stats.ranged || e.type === 'cultist') === false && tries < 6) continue;   // healers prefer back-line bodies
          list.push(id);
        }
        champs.push(makeChampion(e, list, named));
      });
      function makeChampion(e, mods, named) {
        e.stats = Object.assign({}, e.stats);   // own copy: hasted must not speed up every foe of the type
        e.champion = { mods: mods, named: named };
        if (!named) {
          e.maxHp = Math.round(e.maxHp * 1.75); e.baseMaxHp = Math.round(e.baseMaxHp * 1.75); e.hp = e.maxHp;
          e.campaignDamage = (e.campaignDamage || 1) * 1.12;
          e.name = mods.map(function (id) { return MODS[id].name; }).join(' ') + ' ' + e.name;
        } else e.name = e.name + ' · ' + mods.map(function (id) { return MODS[id].name; }).join(', ');
        e.elite = true;
        mods.forEach(function (id) { if (MODS[id].apply) MODS[id].apply(e); });
        try { if (e.bar && e.bar.fill) e.bar.fill.material.color.setHex(0xc99a3c); } catch (_) {}
        return { e: e, mods: mods, has: function (id) { return mods.indexOf(id) >= 0; }, primary: MODS[mods[0]], lx: e.x, lz: e.z, trailN: 0,
          shellT: 2 + (hash(e.id) % 40) / 10, shellOn: 0, ward: 0, wardMax: 0, wardCd: 0, healT: 3 + (hash(e.id) % 30) / 10, ghostT: 0, reflectCd: 0, spin: hash(e.id) % 360, echoSerial: 0, blinkT: 4 + (hash(e.id) % 30) / 10, blinkTo: null };
      }
      champs.forEach(function (c) { if (c.has('warded')) { c.wardMax = c.ward = c.e.maxHp * .3; } });

      // ---- pooled visuals
      var root = new T.Group(); root.name = 'mob_mods'; api.root.add(root);
      var N = Math.max(1, champs.length);
      var ringMat = new T.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      var ringGeo = new T.PlaneGeometry(1, 1); ringGeo.rotateX(-Math.PI / 2);
      var rings = new T.InstancedMesh(ringGeo, ringMat, N); rings.frustumCulled = false; rings.renderOrder = 2; rings.name = 'mob_mod_rings';
      var shellMat = new T.ShaderMaterial({ vertexShader: SHELL_VS, fragmentShader: SHELL_FS, uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      var shells = new T.InstancedMesh(new T.SphereGeometry(1, 20, 14), shellMat, N); shells.frustumCulled = false; shells.renderOrder = 4; shells.name = 'mob_mod_shells';
      for (var i = 0; i < N; i++) {
        var c = champs[i], cc = c ? c.primary.color : [0, 0, 0];
        rings.setColorAt(i, col.setRGB(cc[0], cc[1], cc[2]));
        var sc = c && c.has('reflect') ? MODS.reflect.color : c && c.has('warded') ? MODS.warded.color : [0, 0, 0];
        shells.setColorAt(i, col.setRGB(sc[0], sc[1], sc[2]));
        tmp.position.set(0, -50, 0); tmp.scale.set(.001, .001, .001); tmp.updateMatrix(); rings.setMatrixAt(i, tmp.matrix); shells.setMatrixAt(i, tmp.matrix);
      }
      root.add(rings, shells);

      function ground(x, z) { return api.groundY ? api.groundY(x, z) : .05; }
      function trailCount(c, tag) { var n = 0; for (var i = 0; i < hazards.length; i++) { var h = hazards[i]; if (h.owner === c.e && h.modTrail === tag && h.age < h.warn + h.duration) n++; } return n; }
      function dropTrail(c) {
        var e = c.e, fire = c.has('fire');
        if (trailCount(c, fire ? 'fire' : 'venom') >= (fire ? 5 : 4)) return;
        api.addHazard({ owner: e, enemy: e.name, x: e.x, z: e.z, shape: 'circle', radius: fire ? 1.15 : 1.35, warn: .55, duration: fire ? 4.2 : 5, damage: fire ? 3 : 3, periodic: true, interval: .75,
          persistent: true, unblockable: true, pool: fire ? 'lava' : undefined, poison: !fire, poolGain: .65, style: fire ? 'ember' : 'bile', fill: 'radial', near: false, modTrail: fire ? 'fire' : 'venom',
          attack: fire ? tr('Kor İzi') : tr('Zehir İzi'), cancelOnStagger: false });
      }
      function update(dt) {
        time += dt; ringMat.uniforms.uT.value = time; shellMat.uniforms.uT.value = time;
        if (!champs.length) return;
        for (var i = 0; i < champs.length; i++) {
          var c = champs[i], e = c.e, visible = !e.dead && !e.reserve && e.model && e.model.root.visible !== false;
          if (!visible) { tmp.position.set(0, -50, 0); tmp.scale.set(.001, .001, .001); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); rings.setMatrixAt(i, tmp.matrix); shells.setMatrixAt(i, tmp.matrix); continue; }
          var R = (e.radius || .6) * 2.9, y = ground(e.x, e.z) + .07;
          tmp.position.set(e.x, y, e.z); tmp.rotation.set(0, c.spin + time * .7, 0); tmp.scale.set(R, 1, R); tmp.updateMatrix(); rings.setMatrixAt(i, tmp.matrix);
          var live = e.active && game.state === 'playing';
          // mirror shell cycle / seal
          var shellK = 0;
          if (c.has('reflect') && live) {
            c.shellT -= dt;
            if (c.shellOn > 0) { c.shellOn -= dt; shellK = 1; if (c.shellOn <= 0) c.shellT = 4.6; }
            else if (c.shellT <= 0) { c.shellOn = 2.6; api.sound('enemyWindup', { type: e.type, x: e.x, z: e.z, style: 'rune' }); }
            else if (c.shellT < .8) shellK = .25 + .25 * Math.sin(time * 22);   // pre-glow: the shell is about to rise
          }
          if (c.has('warded')) {
            if (c.ward <= 0 && live) { c.wardCd -= dt; if (c.wardCd <= 0) { c.ward = c.wardMax; api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 1.8, color: 0xf0c060, duration: .5 }); } }
            if (c.ward > 0) shellK = .45 + .55 * c.ward / c.wardMax;
          }
          if (shellK > 0) { var S = (e.model.height || 2) * .62 * (1 + .03 * Math.sin(time * 5)); tmp.position.set(e.x, y + (e.model.height || 2) * .5, e.z); tmp.rotation.set(0, time * .5, 0); tmp.scale.set(S * .82 * shellK + .001, S * shellK + .001, S * .82 * shellK + .001); }
          else { tmp.position.set(0, -50, 0); tmp.scale.set(.001, .001, .001); }
          tmp.updateMatrix(); shells.setMatrixAt(i, tmp.matrix);
          if (!live) { c.lx = e.x; c.lz = e.z; continue; }
          // trails
          if ((c.has('fire') || c.has('venom')) && hyp(e.x - c.lx, e.z - c.lz) > 1.5) { dropTrail(c); c.lx = e.x; c.lz = e.z; }
          // after-images of the hasted
          if (c.has('hasted') && e.move > .5 && (c.ghostT -= dt) <= 0) { c.ghostT = .32; api.fx('dodge', { x: e.x, y: .1, z: e.z, face: e.face }); }
          // healer pulse
          if (c.has('mending') && (c.healT -= dt) <= 0) {
            c.healT = 6.5; var healed = 0;
            for (var j = 0; j < enemies.length; j++) { var o = enemies[j]; if (o.dead || !o.active || o.boss || o.hp >= o.maxHp || hyp(o.x - e.x, o.z - e.z) > 8) continue;
              o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o === e ? .05 : .12)); healed++; api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: (o.radius || .6) * 2.2, color: 0x4fe08a, duration: .7 }); }
            api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 8, color: 0x2a9a5a, duration: .9 });
            if (healed) api.sound('enemyWindup', { type: e.type, x: e.x, z: e.z, style: 'rune' });
          }
          c.reflectCd = Math.max(0, c.reflectCd - dt);
          if (c.has('echoing')) echo(c);
          if (c.has('blink')) blink(c, dt);
        }
        rings.instanceMatrix.needsUpdate = true; shells.instanceMatrix.needsUpdate = true;
      }
      // Echo: copy each new floor blow of this champion once, shown when the original lands (never persistent pools, pulls or projectiles).
      function echo(c) {
        var e = c.e, top = c.echoSerial;
        for (var i = 0; i < hazards.length; i++) {
          var h = hazards[i];
          if (h.owner !== e || h.serial <= c.echoSerial || h.echo || h.persistent || h.harmless || h.modTrail) continue;
          if (h.serial > top) top = h.serial;
          if (h.pull || h.track || h.style === 'grab') continue;
          api.addHazard({ owner: e, enemy: e.name, x: h.x, z: h.z, face: h.face, shape: h.shape, radius: h.radius, inner: h.inner, arc: h.arc, width: h.width, length: h.length,
            warn: .7, delay: Math.max(0, h.warn - h.age), duration: h.duration, damage: Math.round(h.damage * .7), style: h.style, fill: h.fill, sweepDir: h.sweepDir,
            unblockable: h.unblockable, echo: true, attack: (h.attack || '') + tr(' · yankı'), near: h.near, cancelOnStagger: false, beat: false });
        }
        c.echoSerial = top;
      }
      // Blink: a shadow circle opens beside/behind the hero; when it fills the champion steps out of it (harmless tell, the blow comes after).
      function blink(c, dt) {
        var e = c.e;
        if (c.blinkTo) {
          c.blinkTo.t -= dt;
          if (c.blinkTo.t <= 0) { var b = c.blinkTo; c.blinkTo = null;
            if (!e.dead && !e.action && e.stagger <= 0) { api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 1.4, color: 0x5a3aa0, duration: .5 }); e.x = b.x; e.z = b.z; e.face = Math.atan2(player.x - e.x, player.z - e.z); e.cooldown = Math.min(e.cooldown, .35); e.navigation = null;
              if (e.model && e.model.root) e.model.root.position.set(e.x, e.model.root.position.y, e.z);
              api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 1.8, color: 0x7a4ad0, duration: .6 }); api.fx('dodge', { x: e.x, y: .1, z: e.z, face: e.face }); } }
          return;
        }
        if ((c.blinkT -= dt) > 0 || e.action || e.stagger > 0 || !e.active) return;
        var d = hyp(player.x - e.x, player.z - e.z); if (d < 3.4 || d > 11) { c.blinkT = .6; return; }
        for (var k = 0; k < 6; k++) {
          var a = player.face + Math.PI + (k % 2 ? 1 : -1) * (.5 + k * .35), x = player.x + Math.sin(a) * 2.4, z = player.z + Math.cos(a) * 2.4;
          if (!api.walkable(x, z, e.radius || .5) || (api.clearStrike && !api.clearStrike(player, { x: x, z: z }))) continue;
          c.blinkTo = { x: x, z: z, t: .65 }; c.blinkT = 7;
          api.addHazard({ owner: e, enemy: e.name, x: x, z: z, shape: 'circle', radius: 1.2, warn: .65, duration: .1, damage: 0, harmless: true, style: 'shadow', fill: 'inward', near: false, attack: tr('Gölge Adımı') });
          return;
        }
        c.blinkT = 1.5;
      }
      function find(e) { if (!e || !e.champion) return null; for (var i = 0; i < champs.length; i++) if (champs[i].e === e) return champs[i]; return null; }
      function hurt(e, damage, heavy, blocked) {
        var c = find(e); if (!c || damage <= 0) return damage;
        if (c.has('armored') && !heavy) { damage = Math.max(1, Math.round(damage * .62)); if (Math.random() < .5) api.fx('spark', { x: e.x, y: 1.2, z: e.z, face: Math.atan2(e.x - player.x, e.z - player.z), glance: true }); }
        if (c.has('warded') && c.ward > 0) {
          var take = Math.min(c.ward, damage); c.ward -= take; damage = Math.max(1, damage - take);
          if (c.ward <= 0) { c.wardCd = 9; api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 2.6, color: 0xf0c060, duration: .6 }); api.sound('guardBreak'); api.emit('toast', { text: tr('Mühür kırıldı.') }); }
        }
        if (c.has('reflect') && c.shellOn > 0 && c.reflectCd <= 0 && api.hitPlayer) {
          c.reflectCd = .45;
          api.hitPlayer({ owner: e, enemy: e.name, x: e.x, z: e.z, damage: Math.max(2, Math.min(7, Math.round(damage * .18))), attack: tr('Aynalı Kalkan'), style: 'rune', unblockable: true });
          api.fx('glowBurst', { x: player.x, y: .05, z: player.z, radius: 1.1, color: 0xb066ff, duration: .35 });
        }
        return damage;
      }
      function kill(e) {
        var c = find(e); if (!c) return;
        api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 3.4, color: 0xd9a441, duration: .9 });   // a champion falls: a gold flare marks the richer drop
        if (c.has('volatile')) api.addHazard({ owner: e, enemy: e.name, x: e.x, z: e.z, radius: 3.0, warn: 1.6, duration: .24, damage: 24, unblockable: true, persistent: true,
          attack: tr('Patlayan Ceset'), style: 'quake', fill: 'inward', burst: true, near: false });
      }
      function reset() { champs.forEach(function (c) { c.shellT = 2; c.shellOn = 0; c.ward = c.wardMax; c.wardCd = 0; c.healT = 4; c.lx = c.e.x; c.lz = c.e.z; }); }
      function dispose() { if (root.parent) root.parent.remove(root); ringGeo.dispose(); ringMat.dispose(); shells.geometry.dispose(); shellMat.dispose(); if (B.MobMods.current === inst) B.MobMods.current = null; }
      var inst = { update: update, hurt: hurt, kill: kill, reset: reset, dispose: dispose, champions: champs };
      B.MobMods.current = inst;
      return inst;
    }
  };
}());
