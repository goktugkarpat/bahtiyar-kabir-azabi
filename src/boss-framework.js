/* KABİR AZABI — BOSS FRAMEWORK (ajan: bosses). Shared boss "director" layered over every chapter boss without touching their move tables.

   WHAT IT ADDS TO EVERY BOSS (all data-driven through BABA.BossFramework.register(type, profile)):
     intro     cinematic entrance: letterbox bars, title card (name + epithet), a held breath before the first blow.
     phases    a title card + floor shock for every phase change (boss.phase rising) and for the enrage threshold (boss.enraged).
     enrage    a crimson aura under the boss and a closing arena: a persistent burning ring around the arena edge (low damage, only
               the outer band / corners), so the last phase cannot be kited around the walls.
     pursuit   ANTI DODGE-SPAM. The director watches the hero's rolls. A roll that ends near a resting boss can be answered at once with a
               "Takip" (pursuit) strike aimed at the roll's END point (.62 s tell), followed by a circle where the hero stands when it lands
               (.8 s tell, walk out of it — a second roll is not needed). Rolling three times in five seconds shortens the pursuit cool-down.
               Never instant, never stacked on another tell of the boss: the existing 'gold = ordinary / crimson = severe' language.
     perfect   REWARD FOR TIMING, NOT SPAM. A boss blow that passes through the roll while the roll is younger than PERFECT s
               (i.e. the roll was pressed late, right before contact) is a "Kusursuz Kaçış": the boss is exposed for 2.6 s (+30 % damage
               taken, gold aura), the hero regains stamina. Early / spammed rolls get nothing.
     signature one extra signature mechanic per boss (profile.signature), scheduled on its own clock, only while the boss is free of
               orbs / rites / shelters / novas: a chain tether (Zincir Celladı), converging toll rings (Çancı), a crystal checkerboard
               (Oyukların Kralı), a sweeping furnace beam (Ocağın Kalbi).

   HOW A NEW BOSS (e.g. chapter V) PLUGS IN — three steps:
     1. Give it a STATS entry with boss:true (see coast-combat.js 'bell'), its own attack(e,d) table (api.pick list) and phase(e) as usual.
     2. BABA.BossFramework.register('<type>', {
          title: KabirI18n.t('Ad'), epithet: KabirI18n.t('Unvan'), sub: KabirI18n.t('ARENA ADI'),
          color: 0xd04a2a,                       // aura / card accent
          style: 'ember', pool: 'lava',          // tell style of its framework blows, liquid of the enrage ring ('lava' | 'brine')
          phases: { 2: KabirI18n.t('II. FAZ ADI'), 3: KabirI18n.t('…') }, enraged: KabirI18n.t('ÖFKE ADI'),
          pursuit: { name: KabirI18n.t('… Takibi'), pose: 'charge', dmg: 16, after: 12 },
          signature: { id: 'mySig', first: 14, cd: [22, 17, 13], phase: 1, range: 15, hint: KabirI18n.t('HUD talimatı'),
                       build: function (e, d, k) { return move; } }   // k = BossFramework kit (hit(), rings(), grid(), beam(), lungeEnd()).
          signature2: { … same shape, usually phase: 2 … }   // optional second signature, own clock, never directly after the first
        });
        Moves are ordinary combat.js moves: { id, name, duration, pose, cooldown, hits:[{ at, warn, shape, … }] } (see combat.js 'moves').
     3. Nothing else: combat.js calls director.attack() before the boss's own table, director.update() each step,
        director.hurt() for damage taken and director.evaded() when a roll swallows a blow.
   Rules kept: tells ≥ .6 s, no new lights, all meshes built once at create() (warmup.js draws the scene once), no per-frame allocation in the
   hot path, every user-facing text through KabirI18n.t. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, TAU = Math.PI * 2;
  var tr = function (s) { return KabirI18n.t(s); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var hyp = function (x, z) { return Math.sqrt(x * x + z * z); };
  var PERFECT = .24, DODGE_LEN = .48;

  var BF = B.BossFramework = {
    profiles: {}, hints: {}, current: null,
    register: function (type, profile) {
      BF.profiles[type] = profile;
      if (profile.signature && profile.signature.hint) BF.hints[profile.signature.id] = profile.signature.hint;
      if (profile.signature2 && profile.signature2.hint) BF.hints[profile.signature2.id] = profile.signature2.hint;
      if (profile.pursuit) BF.hints['pursuit_' + type] = tr('Yuvarlanışının bittiği yere atılır; çizgiden yana çık, ardından gelen daireden yürüyerek çık.');
    },
    hint: function (id) { return BF.hints[id] || ''; },
    create: create
  };

  /* ------------------------------------------------------------------ cinematic overlay (DOM, built once) */
  var cine = null;
  function overlay() {
    if (cine) return cine;
    var css = document.createElement('style');
    css.textContent = '#bf-cine{position:fixed;inset:0;pointer-events:none;z-index:6}' +
      '#bf-cine .bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height .9s cubic-bezier(.2,.8,.2,1)}#bf-cine .bar.t{top:0}#bf-cine .bar.b{bottom:0}' +
      '#bf-cine.on .bar{height:10.5vh}' +
      '#bf-cine .card{position:absolute;left:50%;top:27%;transform:translateX(-50%);width:min(900px,86vw);text-align:center;opacity:0;transition:opacity .6s}' +
      '#bf-cine .card.show{opacity:1}' +
      '#bf-cine .card small{display:block;font-size:clamp(10px,1.15vw,14px);letter-spacing:.55em;color:#b79a73;text-transform:uppercase;margin-bottom:.6em}' +
      '#bf-cine .card strong{display:block;font-size:clamp(30px,4.6vw,64px);letter-spacing:.09em;color:#efe1c8;font-weight:600;text-shadow:0 0 28px rgba(0,0,0,.95),0 0 6px rgba(0,0,0,.9),0 0 46px var(--bf-glow,rgba(190,50,30,.55))}' +
      '#bf-cine .card em{display:block;font-style:normal;margin-top:.55em;font-size:clamp(12px,1.35vw,18px);letter-spacing:.32em;color:#c9b393;text-shadow:0 0 12px #000}' +
      '#bf-cine .card i{display:block;margin:.8em auto 0;height:1px;width:0;background:linear-gradient(90deg,transparent,var(--bf-line,#b8452d),transparent);transition:width 1.4s .2s cubic-bezier(.2,.8,.2,1)}' +
      '#bf-cine .card.show i{width:62%}' +
      '#bf-cine .card.show strong{animation:bf-in 1.5s cubic-bezier(.2,.8,.2,1) both}' +
      '#bf-cine .card.phase{top:63%}#bf-cine .card.phase strong{font-size:clamp(24px,3.4vw,46px)}' +
      'body.bf-intro #announcement,body.bf-intro #boss-mechanic{visibility:hidden}' +
      '#bf-cine .flash{position:absolute;left:50%;top:73%;transform:translateX(-50%);font-size:clamp(15px,1.7vw,24px);font-weight:600;letter-spacing:.42em;color:#ffdc8f;opacity:0;text-shadow:0 0 14px rgba(240,170,60,.75),0 0 4px #000;transition:opacity .25s}' +
      '#bf-cine .flash.show{opacity:1;animation:bf-pop .5s cubic-bezier(.2,.8,.2,1) both}' +
      '@keyframes bf-in{from{letter-spacing:.42em;opacity:0;filter:blur(6px)}to{letter-spacing:.09em;opacity:1;filter:blur(0)}}' +
      '@keyframes bf-pop{from{transform:translateX(-50%) scale(1.35);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}' +
      '@media (prefers-reduced-motion:reduce){#bf-cine .card.show strong,#bf-cine .flash.show{animation:none}}';
    document.head.appendChild(css);
    var el = document.createElement('div'); el.id = 'bf-cine';
    el.innerHTML = '<div class="bar t"></div><div class="bar b"></div><div class="card"><small></small><strong></strong><em></em><i></i></div><div class="flash"></div>';
    (document.getElementById('hud') || document.body).appendChild(el);
    try { var a = document.querySelector('#announcement strong'); if (a) el.querySelector('.card').style.fontFamily = getComputedStyle(a).fontFamily; } catch (_) {}
    cine = { el: el, card: el.querySelector('.card'), sub: el.querySelector('small'), title: el.querySelector('strong'), epithet: el.querySelector('em'), flash: el.querySelector('.flash'),
      cardT: 0, barsT: 0, flashT: 0 };
    return cine;
  }
  function showCard(sub, title, epithet, seconds, bars, phase, color) {
    var c = overlay(), hex = '#' + ('00000' + (color || 0xb8452d).toString(16)).slice(-6);
    c.sub.textContent = sub || ''; c.title.textContent = title || ''; c.epithet.textContent = epithet || '';
    c.el.style.setProperty('--bf-line', hex); c.el.style.setProperty('--bf-glow', hex + '99');
    c.card.className = 'card'; void c.card.offsetWidth; c.card.className = 'card show' + (phase ? ' phase' : '');
    c.cardT = seconds; if (bars) { c.barsT = Math.max(c.barsT, bars); c.el.classList.add('on'); }
    document.body.classList.toggle('bf-intro', !phase);
  }
  function flash(text) { var c = overlay(); c.flash.textContent = text; c.flash.className = 'flash'; void c.flash.offsetWidth; c.flash.className = 'flash show'; c.flashT = 1.1; }
  function stepOverlay(dt) {
    if (!cine) return;
    if (cine.cardT > 0 && (cine.cardT -= dt) <= 0) { cine.card.className = 'card'; document.body.classList.remove('bf-intro'); }
    if (cine.barsT > 0 && (cine.barsT -= dt) <= 0) cine.el.classList.remove('on');
    if (cine.flashT > 0 && (cine.flashT -= dt) <= 0) cine.flash.className = 'flash';
  }
  function hideOverlay() { if (!cine) return; cine.cardT = cine.barsT = cine.flashT = 0; cine.card.className = 'card'; cine.flash.className = 'flash'; cine.el.classList.remove('on'); document.body.classList.remove('bf-intro'); }

  /* ------------------------------------------------------------------ pooled meshes: boss aura + tether chain */
  var AURA_VS = 'varying vec2 vU; void main(){ vU = uv*2.-1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  var AURA_FS = 'uniform vec3 uCol; uniform float uA, uT; varying vec2 vU;' +
    'void main(){ float r = length(vU); if (r > 1.) discard; float a = atan(vU.y, vU.x);' +
    ' float ring = smoothstep(.72,.9,r)*(1.-smoothstep(.9,1.,r)); float core = (1.-smoothstep(0.,.85,r))*.22;' +
    ' float teeth = .55+.45*sin(a*9.+uT*2.3)*sin(a*5.-uT*1.7); float lick = smoothstep(.45,1.,r)*pow(max(0.,teeth),2.)*.6;' +
    ' gl_FragColor = vec4(uCol*(ring*1.4+core+lick)*uA, 1.); }';
  function auraMesh() {
    var m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({ vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uCol: { value: new T.Color(1, .2, .08) }, uA: { value: 0 }, uT: { value: 0 } } }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 3; m.frustumCulled = false; m.name = 'bf_aura'; return m;
  }
  var LINKS = 30;
  function chainMesh() {
    var mat = new T.MeshStandardMaterial({ color: 0x3b302a, roughness: .45, metalness: .9, emissive: new T.Color(1.6, .45, .1), emissiveIntensity: 1.2 });
    var m = new T.InstancedMesh(new T.TorusGeometry(.14, .036, 6, 12), mat, LINKS); m.frustumCulled = false; m.name = 'bf_tether'; m.castShadow = false;
    return m;
  }

  /* ------------------------------------------------------------------ kit: move builders shared by profiles (all plain combat.js moves) */
  function makeKit(api) {
    var player = api.player;
    function hit(at, warn, shape, size, dmg, pose, more) { var h = { at: at, warn: warn, shape: shape, radius: size, dmg: dmg, pose: pose, style: 'blade' }; for (var k in more) h[k] = more[k]; return h; }
    function lungeEnd(e, tx, tz, stop) {
      var a = Math.atan2(tx - e.x, tz - e.z), L = Math.max(0, hyp(tx - e.x, tz - e.z) - stop);
      L = Math.min(L, api.clipLine(e, a, L + .4) - .4);
      while (L > .5 && !api.walkable(e.x + Math.sin(a) * L, e.z + Math.cos(a) * L, e.radius)) L -= .4;
      L = Math.max(0, L); return { x: e.x + Math.sin(a) * L, z: e.z + Math.cos(a) * L, a: a, L: L };
    }
    return {
      hit: hit, lungeEnd: lungeEnd,
      // Converging rings centred on a fixed point: outer band first, a crimson centre blast (shown from the start) last.
      rings: function (e, o, name, style, n, gap, dmg, centreDmg) {
        var hits = [], R = 2.2 + n * gap;
        hits.push(hit(1.3 + n * .55, 1.3 + n * .55, 'circle', 2.3, centreDmg, 'castHigh', { origin: o, style: style, fill: 'inward', unblockable: true, beat: false, attack: name + tr(' · merkez') }));
        for (var i = 0; i < n; i++) {
          var outer = R - i * gap, inner = outer - gap * .62;
          hits.push(hit(1.3 + i * .55, i ? .85 : 1.3, 'ring', outer, dmg, 'castHigh', { inner: inner, arc: TAU, origin: o, style: style, fill: 'inward', beat: i === 0, attack: name }));
        }
        return hits;
      },
      // Checkerboard: n x n cells around a point; the two colours strike alternately (each reveal shown as the previous colour fires).
      grid: function (e, o, name, style, n, cell, waves, dmg) {
        var hits = [], half = (n - 1) / 2;
        for (var w = 0; w < waves; w++) for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
          if ((i + j + w) % 2) continue;
          var cx = o.x + (i - half) * cell, cz = o.z + (j - half) * cell;
          if (!api.walkable(cx, cz, .3)) continue;
          hits.push(hit(1.45 + w * .95, w ? .95 : 1.45, 'line', 0, dmg, 'castHigh', { origin: { x: cx, z: cz - cell / 2 + .04 }, face: 0, width: cell - .1, length: cell - .08, style: style, fill: 'radial', beat: w === 0 && !hits.length, scar: w === waves - 1 && (i + j) % 4 === 0, attack: name }));
        }
        return hits;
      },
      // Prison: a burning wall closes round the hero, the floor inside is doomed (crimson, shown from the start). One deliberate roll
      // through the wall (or a walk before it ignites) is the way out; spamming rolls inside the circle does nothing.
      prison: function (e, o, name, style, pool, dmgWall, dmgCore) {
        return [
          hit(.9, .9, 'ring', 4.7, dmgWall, 'castHigh', { inner: 3.6, arc: TAU, origin: o, persistent: true, periodic: true, interval: .35, duration: 2.6, pool: pool, poolGain: .9, style: style, fill: 'inward', beat: true, attack: name }),
          hit(3.2, 3.2, 'circle', 3.65, dmgCore, 'castHigh', { origin: o, style: style, fill: 'inward', unblockable: true, beat: false, scar: true, attack: name + tr(' · çöküş') })];
      },
      // A beam sweeping round the boss: one line per step, every step shown .75 s ahead, so the safe side is always readable.
      beam: function (e, name, style, steps, dir, a0, dmg, twin) {
        var hits = [];
        for (var s = 0; s < steps; s++) {
          var a = a0 + dir * s * .3, at = 1.35 + s * .15;
          hits.push(hit(at, s ? .75 : 1.35, 'line', 0, dmg, 'castHigh', { origin: { x: e.x, z: e.z }, face: a, width: 1.7, length: api.clipLine(e, a, 13), style: style, fill: 'forward', beat: s === 0, attack: name, duration: .14 }));
          if (twin) hits.push(hit(at, s ? .75 : 1.35, 'line', 0, dmg, 'castHigh', { origin: { x: e.x, z: e.z }, face: a + Math.PI, width: 1.7, length: api.clipLine(e, a + Math.PI, 13), style: style, fill: 'forward', beat: false, attack: name, duration: .14 }));
        }
        return hits;
      }
    };
  }

  /* ------------------------------------------------------------------ the director (one per combat instance) */
  function create(api) {
    var game = api.game, player = api.player, hazards = api.hazards, kit = makeKit(api);
    var root = new T.Group(); root.name = 'boss_framework'; api.root.add(root);
    var aura = auraMesh(), chain = chainMesh(); aura.visible = false; chain.visible = true; chain.count = 0; root.add(aura, chain);
    var tmp = new T.Object3D(), time = 0;
    var st = null;
    function fresh() {
      return { boss: null, intro: false, phaseKey: '', sigAt: 0, pursuitAt: 0, rolls: [], prevDodge: 0, rollEnd: null, exposed: 0, perfectCd: 0,
        edge: null, tether: null, yankCd: 0, hold: 0, auraA: 0 };
    }
    st = fresh();
    var profileOf = function (e) { return e && BF.profiles[e.type]; };
    function arenaOf(e) {
      var core = B.Boss2 && B.Boss2.current;
      if (core && core.arena && core.ext && core.ext.game === game) return core.arena;
      var rooms = api.world.rooms || [], id = e.encounter && e.encounter.room;
      for (var i = 0; i < rooms.length; i++) if (String(rooms[i].id) === String(id)) return rooms[i];
      return null;
    }
    // Free of the boss's own big set pieces: no new pattern lands on top of orbs, the rite, shelters, the nova or burning-ground mechanics.
    function busy(e) {
      var m = B.BossMech && B.BossMech.current, core = B.Boss2 && B.Boss2.current;
      if (m && (m.liveOrbs() > 0 || (m.riteActive && m.riteActive()) || (m.majorActive && m.majorActive(e)))) return true;
      if (core && core.ext && core.ext.game === game && ((core.nova && core.nova.on) || (core.orbs && core.orbs.count && core.orbs.count() > 0))) return true;
      // nothing pending of its own; and the floor round the hero not already crowded by the adds' blows (no unreadable stacking)
      for (var i = 0, crowd = 0; i < hazards.length; i++) { var h = hazards[i]; if (h.persistent || h.harmless || h.age > h.warn + h.duration) continue;
        if (h.owner === e) return true; if (hyp(h.x - player.x, h.z - player.z) < 9 && ++crowd >= 3) return true; }
      return st.tether !== null;
    }
    function pace() { return game.difficulty === 'easy' ? 1.35 : game.difficulty === 'normal' ? 1.12 : 1; }

    /* ---- pursuit: answer the end of a roll */
    function trackRolls(dt) {
      var d = player.dodge || 0;
      if (d > st.prevDodge + .05) { st.rolls.push(time); st.rollFrom = { x: player.x, z: player.z }; }
      if (st.prevDodge > 0 && d <= 0) st.rollEnd = { x: player.x, z: player.z, t: time, fx: st.rollFrom ? st.rollFrom.x : player.x, fz: st.rollFrom ? st.rollFrom.z : player.z };
      st.prevDodge = d;
      while (st.rolls.length && time - st.rolls[0] > 5) st.rolls.shift();
    }
    function pursuit(e, p) {
      var spam = st.rolls.length >= 3, re = st.rollEnd;
      if (!re || time - re.t > .5 || !p.pursuit) return false;
      if (e.phase < 2 && !spam) return false;
      if (time < st.pursuitAt || e.action || e.stagger > 0 || (e.recoveryFloor || 0) > 0 || busy(e)) return false;
      // only a roll that carried the hero AWAY (kiting) is chased; rolling in to punish the boss's recovery is never answered
      var dist = hyp(re.x - e.x, re.z - e.z), from = hyp(re.fx - e.x, re.fz - e.z);
      if (dist < 3.6 || dist > 9.5 || dist < from + 1.2 || !api.clearStrike(e, re)) return false;
      var pp = p.pursuit, end = kit.lungeEnd(e, re.x, re.z, 1.6), a = end.a, len = api.clipLine(e, a, dist + 1.4), name = pp.name;
      e.face = a;
      var mv = { id: 'pursuit_' + e.type, name: name, duration: 1.75, pose: pp.pose || 'charge', cooldown: .85,
        movement: { start: .62, duration: .26, fromX: e.x, fromZ: e.z, x: end.x, z: end.z },
        hits: [kit.hit(.62, .62, 'line', 0, pp.dmg || 16, pp.pose || 'charge', { origin: { x: e.x, z: e.z }, face: a, width: 1.8, length: len, knockback: 2.2, style: p.style || 'blade', fill: 'forward', attack: name,
          onActive: function () { if (e.dead || !e.action || e.stagger > 0) return;
            // the follow-through lands where the hero stands now: walk out of it (a second roll is not needed)
            api.hazardFrom(e, { x: player.x, z: player.z, shape: 'circle', radius: 2.0, warn: .8, delay: 0, damage: pp.after || 12, style: p.style || 'quake', fill: 'inward', unblockable: true, pose: 'overhead', scar: true,
              attack: name + tr(' · artçı'), near: true });
            e.action.duration = Math.max(e.action.duration, e.action.age + 1.0);
          } })] };
      if (!api.beginMove(e, mv)) return false;
      st.pursuitAt = time + (spam ? 6 : 11) * pace() * (e.enraged ? .8 : 1);
      st.rollEnd = null;
      api.fx('glowBurst', { x: re.x, y: .05, z: re.z, radius: 1.6, color: 0xd2492e, duration: .5 });
      return true;
    }

    /* ---- tether (Zincir Celladı signature): the hero is chained to the boss for a few seconds; past the leash the chain yanks */
    function tetherStart(e, seconds) { st.tether = { e: e, t: seconds, leash: 6.5, over: 0 }; st.yankCd = .6; api.sound('rage', { enemy: true }); }
    function tetherStep(dt) {
      var tt = st.tether; if (!tt) { chain.count = 0; return; }
      var e = tt.e;
      tt.t -= dt; st.yankCd -= dt;
      if (tt.t <= 0 || e.dead || !e.active || player.dead || game.state !== 'playing') { st.tether = null; chain.count = 0; api.fx('glowBurst', { x: player.x, y: .05, z: player.z, radius: 1.2, color: 0x8a5a3a, duration: .4 }); return; }
      var dx = player.x - e.x, dz = player.z - e.z, d = hyp(dx, dz);
      tt.over = d > tt.leash ? tt.over + dt : 0;
      if (tt.over > .3 && st.yankCd <= 0) {
        st.yankCd = 1.6; tt.over = 0;
        var a = Math.atan2(dx, dz);
        api.addHazard({ owner: e, enemy: e.name, x: e.x, z: e.z, face: a, shape: 'line', width: 1.6, length: d + 1, warn: .45, duration: .15, damage: 9, pull: true, pullTo: 2.6,
          style: 'chain', fill: 'converge', attack: tr('Hüküm Zinciri · çekiş'), near: true, cancelOnStagger: false });
      }
      // links along a sagging line from the executioner's fist to the hero's waist
      var n = Math.min(LINKS, Math.max(6, Math.round(d / .36))), y0 = 1.45, y1 = 1.0, sag = Math.min(.9, d * .07);
      for (var i = 0; i < n; i++) {
        var u = (i + .5) / n, x = e.x + dx * u, z = e.z + dz * u, y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * sag + Math.sin(time * 9 + i) * .02;
        tmp.position.set(x, y, z); tmp.rotation.set(0, Math.atan2(dx, dz) + (i % 2 ? Math.PI / 2 : 0), i % 2 ? 0 : Math.PI / 2); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
        chain.setMatrixAt(i, tmp.matrix);
      }
      chain.count = n; chain.instanceMatrix.needsUpdate = true;
      chain.material.emissiveIntensity = 1.5 + .7 * Math.sin(time * 6) + (tt.over > 0 ? 2.5 : 0);
    }

    /* ---- enrage: closing arena (a persistent burning band around the walls; owner-less so the bosses' own floor counters ignore it) */
    function edgeStep(e, p) {
      var want = e.enraged && !e.dead && e.active && game.state === 'playing';
      if (st.edge && hazards.indexOf(st.edge) < 0) st.edge = null;
      if (!want) { if (st.edge) { var i = hazards.indexOf(st.edge); if (i >= 0) hazards.splice(i, 1); st.edge = null; } return; }
      if (st.edge) return;
      var ar = arenaOf(e); if (!ar) return;
      var w = ar.w || 20, dd = ar.d || 20, inner = Math.max(7, Math.min(w, dd) / 2 - 1.3);
      st.edge = api.addHazard({ owner: null, enemy: e.name, x: ar.x || 0, z: ar.z, face: 0, shape: 'ring', inner: inner, radius: hyp(w, dd) * .5 + 2, arc: TAU, warn: 2.2, duration: 900,
        damage: 5, periodic: true, interval: .9, persistent: true, unblockable: true, pool: p.pool || 'lava', poolGain: .7, tellGain: .45, style: p.style || 'ember', fill: 'inward',
        attack: tr('Daralan Arena'), near: false, cancelOnStagger: false });
      api.emit('toast', { text: tr('Arena daralıyor. Duvarlardan uzak dur, ortada savaş.') });
    }

    /* ---- per frame */
    function update(dt) {
      time += dt; stepOverlay(dt); trackRolls(dt);
      var e = game.boss, p = profileOf(e);
      if (!e || !p) { aura.visible = false; return; }
      if (st.boss !== e) { st = Object.assign(fresh(), { boss: e }); }
      // checkpoint reset / respawn: the boss is back at full health and asleep
      if (!e.activated && st.intro) { st = Object.assign(fresh(), { boss: e }); hideOverlay(); chain.count = 0; }
      if (e.dead || game.state !== 'playing') {
        aura.visible = false; st.tether = null; chain.count = 0;
        if (st.edge) { var ix = hazards.indexOf(st.edge); if (ix >= 0) hazards.splice(ix, 1); st.edge = null; }
        if (e.dead) slain(e);
        else if (game.state === 'dead' && cine && cine.barsT > 0) cine.barsT = .01;
        return;
      }
      if (e.active && !st.intro) {
        st.intro = true; st.phaseKey = e.phase + (e.enraged ? 'e' : '');
        showCard(p.sub || tr('BOSS'), p.title || e.name, p.epithet || '', 3.8, 3.2, false, p.color);
        st.sigAt = time + (p.signature ? p.signature.first || 14 : 1e9) * pace(); st.pursuitAt = time + 6;
        st.sig2At = time + (p.signature2 ? p.signature2.first || 30 : 1e9) * pace();
        // the held breath: a harmless war roar while the title burns in (the first real blow comes after it)
        if (!e.action) { e.face = Math.atan2(player.x - e.x, player.z - e.z); api.beginMove(e, { id: 'roar', name: p.title || e.name, duration: 1.9, pose: 'roar', cooldown: .6,
          hits: [kit.hit(1.1, 1.1, 'ring', 5, 0, 'roar', { inner: 0, arc: TAU, harmless: true, style: p.style || 'roar', fill: 'radial' })] }); }
        else e.cooldown = Math.max(e.cooldown, 1.8);
        api.sound('bossPhase');
        api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 5.5, color: p.color || 0xb8452d, duration: 1.4 });
      }
      if (!e.active) { aura.visible = false; return; }
      var key = e.phase + (e.enraged ? 'e' : '');
      if (key !== st.phaseKey) {
        var label = e.enraged && p.enraged ? p.enraged : p.phases && p.phases[e.phase] || '';
        st.phaseKey = key;
        if (label) showCard(e.enraged ? tr('ÖFKE') : ['', 'I', 'II', 'III', 'IV', 'V'][e.phase] + ' · ' + tr('EVRE'), label, p.title || e.name, 3.2, 2.2, true, p.color);
        api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 7, color: p.color || 0xb8452d, duration: 1.1 });
        if (api.slowMotion) api.slowMotion(.3);
        api.emit('impact', { x: e.x, z: e.z, strength: 1, radius: 9 });
        st.sigAt = Math.min(st.sigAt, time + 6); st.sig2At = Math.min(st.sig2At, time + 14);
      }
      st.exposed = Math.max(0, st.exposed - dt); st.perfectCd = Math.max(0, st.perfectCd - dt);
      // aura: crimson while enraged, gold while exposed by a perfect dodge
      var want = st.exposed > 0 ? 1 : e.enraged ? .75 : 0;
      st.auraA += (want - st.auraA) * Math.min(1, dt * 5);
      aura.visible = st.auraA > .02;
      if (aura.visible) {
        var u = aura.material.uniforms, R = (e.radius || 1) * 3.2;
        aura.position.set(e.x, (api.groundY ? api.groundY(e.x, e.z) : .05) + .03, e.z); aura.scale.set(R, R, 1);
        u.uT.value = time; u.uA.value = st.auraA * (st.exposed > 0 ? .55 + .25 * Math.sin(time * 14) : .5);
        if (st.exposed > 0) u.uCol.value.setRGB(1.5, .95, .3); else u.uCol.value.setRGB(1.4, .18, .06);
      }
      edgeStep(e, p);
      tetherStep(dt);
      if (!e.action && e.stagger <= 0) pursuit(e, p);
    }

    // The fall: a short title card and the bars close in once more. Called from combat.js killEnemy (the game may leave 'playing' at once,
    // so this card fades on its own wall clock instead of the combat step).
    function slain(e) {
      var p = profileOf(e); if (!p || st.slain || !st.intro || e !== st.boss) return;
      st.slain = true; showCard(tr('YENİLDİ'), p.title || e.name, p.epithet || '', 30, 30, true, p.color);
      if (api.slowMotion) api.slowMotion(.5);
      api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 8, color: p.color || 0xb8452d, duration: 1.6 });
      setTimeout(function () { if (cine) { cine.barsT = 0; cine.el.classList.remove('on'); } }, 2600);
      setTimeout(hideOverlay, 3600);
    }
    /* ---- hooks called by combat.js */
    function attack(e, d) {
      var p = profileOf(e); if (!p || !st.intro || st.boss !== e) return false;
      for (var k = 0; k < 2; k++) {
        var s = k ? p.signature2 : p.signature, at = k ? 'sig2At' : 'sigAt', other = k ? 'sigAt' : 'sig2At';
        if (!s || time < st[at] || e.phase < (s.phase || 1) || d > (s.range || 15) || busy(e)) continue;
        var mv = s.build(e, d, kit, api);
        if (!mv || !api.beginMove(e, mv)) { st[at] = time + 2; continue; }
        var cds = s.cd || [20], cd = cds[Math.min(cds.length - 1, e.phase - 1)];
        st[at] = time + cd * pace() * (e.enraged ? .85 : 1);
        st[other] = Math.max(st[other], time + 7);   // two signatures never follow each other directly
        return true;
      }
      return false;
    }
    function hurt(e, damage) { return st.exposed > 0 && e === st.boss ? Math.round(damage * 1.3) : damage; }
    function evaded(h) {
      var o = h.owner; if (!o || !o.boss || h.harmless || h.periodic || h.persistent || !(player.dodge > 0) || st.perfectCd > 0 || o !== st.boss) return;
      var age = DODGE_LEN - player.dodge;
      if (age > PERFECT) return;
      // only a deliberate roll counts: a roll chained straight out of another one (spam) earns nothing
      for (var i = 0, n = 0; i < st.rolls.length; i++) if (time - st.rolls[i] < 1.15) n++;
      if (n > 1) return;
      st.perfectCd = 3; st.exposed = 2.6;
      player.stamina = Math.min(player.maxStamina || 100, (player.stamina || 0) + 14);
      flash(tr('KUSURSUZ KAÇIŞ'));
      api.fx('glowBurst', { x: player.x, y: .05, z: player.z, radius: 2.2, color: 0xf0c060, duration: .55 });
      api.fx('glowBurst', { x: o.x, y: .05, z: o.z, radius: 3.2, color: 0xf0c060, duration: .8 });
      if (api.slowMotion) api.slowMotion(.12);
      api.sound('parry', {});
    }
    function reset() { st = fresh(); chain.count = 0; aura.visible = false; hideOverlay(); }
    function dispose() { reset(); root.parent && root.parent.remove(root); aura.geometry.dispose(); aura.material.dispose(); chain.geometry.dispose(); chain.material.dispose(); if (BF.current === dir) BF.current = null; }
    var dir = { update: update, attack: attack, slain: slain, hurt: hurt, evaded: evaded, reset: reset, dispose: dispose, tetherStart: tetherStart, kit: kit,
      get state() { return st; } };
    BF.current = dir;
    return dir;
  }

  /* ------------------------------------------------------------------ the four chapter bosses */
  BF.register('boss', {
    title: tr('Zincir Celladı'), epithet: tr('Kurban Salonunun Yargıcı'), sub: tr('KURBAN SALONU'), color: 0xc2452a, style: 'chain', pool: 'lava',
    phases: { 2: tr('KANLI YEMİN') }, enraged: tr('SON YEMİN'),
    pursuit: { name: tr('Celladın Takibi'), pose: 'charge', dmg: 16, after: 12 },
    signature: { id: 'tether', first: 16, cd: [26, 20, 16], phase: 1, range: 12, hint: tr('Zincir sana kilitlendi. Celladın yakınında kal; uzaklaşırsan seni çeker.'),
      build: function (e, d, k, api) {
        var name = tr('Hüküm Zinciri'), player = api.player;
        return { id: 'tether', name: name, duration: 2.0, pose: 'hookSwing', cooldown: .7, hits: [
          k.hit(1.1, 1.1, 'line', 0, 8, 'hookSwing', { width: 1.2, length: api.clipLine(e, e.face, Math.min(13, d + 1.5)), style: 'chain', fill: 'forward', projectile: { kind: 'hook', flight: .22, fromY: 1.7 }, attack: name,
            onHitPlayer: function () { if (BF.current && !e.dead) BF.current.tetherStart(e, e.enraged ? 6.5 : 5.5); } })] };
      } },
    // Zincir Kafesi (phase II): a cage of burning chain closes round the hero and the executioner for 7 s; the floor inside stays clean.
    // The ring is shown 1.3 s before it ignites (step out of it or stay in); then he fights you inside it, the edge bites if you cross.
    signature2: { id: 'chainCage', first: 22, cd: [30, 26, 21], phase: 2, range: 9, hint: tr('Zincir kafesi kapanıyor. Halkanın içinde kal; kızgın zincire basma.'),
      build: function (e, d, k, api) {
        var p = api.player, o = { x: (e.x + p.x) / 2, z: (e.z + p.z) / 2 }, name = tr('Zincir Kafesi');
        return { id: 'chainCage', name: name, duration: 2.2, pose: 'chainLash', cooldown: .6, hits: [
          k.hit(1.3, 1.3, 'ring', 7.4, 6, 'chainLash', { inner: 5.9, arc: TAU, origin: o, persistent: true, periodic: true, interval: .7, duration: 7, pool: 'lava', poolGain: .8, style: 'chain', fill: 'inward', attack: name, beat: true }),
          k.hit(1.3, 1.3, 'circle', 2.2, 18, 'chainLash', { origin: { x: p.x, z: p.z }, style: 'chain', fill: 'inward', beat: false, attack: name + tr(' · darbe') })] };
      } }
  });
  BF.register('bell', {
    title: tr('Derinliklerin Çancısı'), epithet: tr('Boğulmuşların Çağrıcısı'), sub: tr('BOĞULMUŞ ÇANLIK'), color: 0x3fa49a, style: 'tide', pool: 'brine',
    phases: { 2: tr('DENİZİN YEMİNİ'), 3: tr('MEZAR KÖKLERİ'), 4: tr('SON ÇAN') }, enraged: tr('SON ÇAN'),
    pursuit: { name: tr('Dalganın Takibi'), pose: 'charge', dmg: 15, after: 12 },
    signature: { id: 'echoToll', first: 15, cd: [24, 20, 17, 14], phase: 1, range: 15, hint: tr('Halkalar dıştan içe kapanır. Halka geçince dışarı yürü; merkez en son patlar.'),
      build: function (e, d, k, api) {
        var o = { x: api.player.x, z: api.player.z }, n = e.phase >= 3 ? 4 : 3, name = tr('Yankı Çanı');
        return { id: 'echoToll', name: name, duration: 1.3 + n * .55 + 1.1, pose: 'roar', cooldown: 1.0, hits: k.rings(e, o, name, 'tide', n, 2.4, 14, 24) };
      } },
    signature2: { id: 'drownWell', first: 20, cd: [28, 24, 19], phase: 2, range: 15, hint: tr('Kuyunun duvarı seni kapatır; merkez çökecek. Duvar yanmadan yürü ya da duvarı tek yuvarlanışla geç.'),
      build: function (e, d, k, api) { var o = { x: api.player.x, z: api.player.z }, name = tr('Boğulma Kuyusu');
        return { id: 'drownWell', name: name, duration: 3.9, pose: 'castHigh', cooldown: .9, hits: k.prison(e, o, name, 'tide', 'brine', 5, 30) }; } }
  });
  BF.register('hollowking', {
    title: tr('Oyukların Kralı'), epithet: tr('Sessiz Tahtın Sahibi'), sub: tr('SESSİZ TAHT'), color: 0x8a9ccf, style: 'rune', pool: 'lava',
    phases: { 2: tr('TAŞ TAHT ÇÖKÜYOR'), 3: tr('OYUKLAR AÇILDI') },
    pursuit: { name: tr('Kralın Takibi'), pose: 'charge', dmg: 17, after: 13 },
    signature: { id: 'crystalGrid', first: 14, cd: [24, 19, 15], phase: 1, range: 16, hint: tr('Billur ızgara: bir renk patlarken diğerine geç. Yuvarlanma değil, yer seçmek kurtarır.'),
      build: function (e, d, k, api) {
        var o = { x: api.player.x, z: api.player.z }, name = tr('Billur Izgara');
        var waves = e.phase >= 3 ? 3 : 2;
        return { id: 'crystalGrid', name: name, duration: 1.45 + waves * .95 + .8, pose: 'castHigh', cooldown: 1.0, hits: k.grid(e, o, name, 'rune', 4, 3.0, waves, 16) };
      } },
    signature2: { id: 'crystalPrison', first: 20, cd: [28, 24, 19], phase: 2, range: 15, hint: tr('Billur duvar seni kapatır; merkez çökecek. Duvar yanmadan yürü ya da duvarı tek yuvarlanışla geç.'),
      build: function (e, d, k, api) { var o = { x: api.player.x, z: api.player.z }, name = tr('Billur Hapis');
        return { id: 'crystalPrison', name: name, duration: 3.9, pose: 'castHigh', cooldown: .9, hits: k.prison(e, o, name, 'rune', '', 5, 30) }; } }
  });
  BF.register('furnaceheart', {
    title: tr('Ocağın Kalbi'), epithet: tr('Son Dökümün Efendisi'), sub: tr('SON DÖKÜM'), color: 0xe0661c, style: 'ember', pool: 'lava',
    phases: { 2: tr('OCAK BASINCI YÜKSELİYOR'), 3: tr('SON DÖKÜM') },
    pursuit: { name: tr('Ocağın Takibi'), pose: 'charge', dmg: 18, after: 14 },
    signature: { id: 'furnaceBeam', first: 13, cd: [22, 18, 14], phase: 1, range: 13, hint: tr('Ocak nefesi döner. Işının döndüğü yöne doğru koş ya da tam geçerken yuvarlan.'),
      build: function (e, d, k, api) {
        var p = api.player, toHero = Math.atan2(p.x - e.x, p.z - e.z), dir = (Math.floor(e.picks || 0) % 2) ? 1 : -1, steps = e.phase >= 3 ? 16 : 13, name = tr('Ocak Nefesi');
        return { id: 'furnaceBeam', name: name, duration: 1.35 + steps * .15 + .8, pose: 'castHigh', cooldown: 1.1, hits: k.beam(e, name, 'ember', steps, dir, toHero - dir * 1.2, 15, e.phase >= 3) };
      } },
    signature2: { id: 'crucible', first: 20, cd: [28, 24, 19], phase: 2, range: 15, hint: tr('Pota duvarı seni kapatır; merkez çökecek. Duvar yanmadan yürü ya da duvarı tek yuvarlanışla geç.'),
      build: function (e, d, k, api) { var o = { x: api.player.x, z: api.player.z }, name = tr('Pota');
        return { id: 'crucible', name: name, duration: 3.9, pose: 'castHigh', cooldown: .9, hits: k.prison(e, o, name, 'ember', 'lava', 5, 30) }; } }
  });
}());
