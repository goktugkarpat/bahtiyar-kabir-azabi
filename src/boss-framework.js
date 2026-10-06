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

     arena     the room itself fights (profile.arena): Çöken Zemin pits (Cellat), Yükselen Gelgit flood (Çancı), Billur Damar vents in a
               fixed turning order (Kral), Döküm Olukları molten channels (Ocak). Owner-less hazards, never on top of the boss's set pieces.
     body      the silhouette swells a little each phase, motes of the boss's element pour off it, a phase change bursts shards outward;
               synthesised heavy sound layers (boss-sound.js via audio.js 'bossLayer') at intro / phase / signature / fall.
     text      cards use "text lanes": they wait for / move around the narrator subtitle, the level-up banner, the announcement and the
               boss instruction panel instead of covering them.

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
          arena: { phase: 1, first: 12, every: [16, 13], build: function (e, ar, n, k, api) { BF.env(e, hazard); return true; } },
          sound: 'chain' | 'tide' | 'crystal' | 'forge',
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
      '#bf-cine .card{position:absolute;left:50%;top:27%;transform:translateX(-50%);width:min(900px,86vw);text-align:center;opacity:0;transition:opacity .6s,top .35s ease-out}' +
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
  /* Text lanes: the card never sits on top of the narrator's subtitle, the level-up banner, the HUD announcement or the boss
     instruction panel. place() tries a few vertical lanes and keeps the one with the least overlap; a card that would collide
     waits (queue, at most 1.6 s) for a free lane; while shown it is re-laid every .25 s, so a subtitle that appears pushes it aside. */
  var BLOCKERS = ['narration', 'level-up', 'announcement', 'boss-mechanic', 'tutorial'];
  function blockers(intro) {
    var out = [];
    for (var i = 0; i < BLOCKERS.length; i++) {
      if (intro && BLOCKERS[i] === 'boss-mechanic') continue;   // the intro card hides that panel itself
      var el = document.getElementById(BLOCKERS[i]); if (!el) continue;
      if (BLOCKERS[i] === 'narration' && (el.classList.contains('hidden') || !(el.textContent || '').trim())) continue;
      if ((BLOCKERS[i] === 'level-up' || BLOCKERS[i] === 'announcement') && !el.classList.contains('show')) continue;
      var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .05) continue;
      var r = el.getBoundingClientRect(); if (r.height > 2 && r.width > 2) out.push(r);
    }
    return out;
  }
  function place(c, lanes) {
    var H = window.innerHeight || 540, W = window.innerWidth || 960, h = c.card.offsetHeight || 110, bl = blockers(!c.isPhase), best = lanes[0] * H, bestO = 1e9;
    for (var i = 0; i < lanes.length; i++) {
      var top = lanes[i] * H, o = 0;
      for (var j = 0; j < bl.length; j++) { var r = bl[j]; if (r.right < W * .2 || r.left > W * .8) continue; o += Math.max(0, Math.min(top + h, r.bottom + 6) - Math.max(top, r.top - 6)); }
      if (o < bestO) { bestO = o; best = top; } if (o === 0) break;
    }
    c.card.style.top = Math.round(best) + 'px'; return bestO;
  }
  function showCard(sub, title, epithet, seconds, bars, phase, color, now) {
    var c = overlay(); c.pending = { sub: sub, title: title, epithet: epithet, seconds: seconds, bars: bars, phase: phase, color: color, wait: 1.6 };
    if (bars) { c.barsT = Math.max(c.barsT, bars); c.el.classList.add('on'); }
    tryShow(c, now);
  }
  function tryShow(c, force) {
    var q = c.pending; if (!q) return;
    var hex = '#' + ('00000' + (q.color || 0xb8452d).toString(16)).slice(-6);
    c.sub.textContent = q.sub || ''; c.title.textContent = q.title || ''; c.epithet.textContent = q.epithet || '';
    c.card.className = 'card' + (q.phase ? ' phase' : ''); c.isPhase = !!q.phase;
    c.lanes = q.phase ? [.6, .3, .45, .7] : [.27, .43, .6];
    var o = place(c, c.lanes);
    if (o > 0 && q.wait > 0 && !force) return;   // collides: stay queued a moment
    c.pending = null;
    c.el.style.setProperty('--bf-line', hex); c.el.style.setProperty('--bf-glow', hex + '99');
    void c.card.offsetWidth; c.card.className = 'card show' + (q.phase ? ' phase' : '');
    c.cardT = q.seconds; c.layoutT = .25;
    document.body.classList.toggle('bf-intro', !q.phase);
  }
  function flash(text) { var c = overlay(); c.flash.textContent = text; c.flash.className = 'flash'; void c.flash.offsetWidth; c.flash.className = 'flash show'; c.flashT = 1.1; }
  function stepOverlay(dt) {
    if (!cine) return;
    if (cine.pending) { cine.pending.wait -= dt; tryShow(cine, false); }
    else if (cine.cardT > 0 && (cine.layoutT -= dt) <= 0) { cine.layoutT = .25; place(cine, cine.lanes); }
    if (cine.cardT > 0 && (cine.cardT -= dt) <= 0) { cine.card.className = 'card'; document.body.classList.remove('bf-intro'); }
    if (cine.barsT > 0 && (cine.barsT -= dt) <= 0) cine.el.classList.remove('on');
    if (cine.flashT > 0 && (cine.flashT -= dt) <= 0) cine.flash.className = 'flash';
  }
  function hideOverlay() { if (!cine) return; cine.pending = null; cine.cardT = cine.barsT = cine.flashT = 0; cine.card.className = 'card'; cine.flash.className = 'flash'; cine.el.classList.remove('on'); document.body.classList.remove('bf-intro'); }

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
      // A beam sweeping round the boss: one line per step, every step shown .62 s ahead, so the safe side is always readable.
      beam: function (e, name, style, steps, dir, a0, dmg, twin) {
        var hits = [];
        for (var s = 0; s < steps; s++) {
          var a = a0 + dir * s * .3, at = 1.35 + s * .15;
          hits.push(hit(at, s ? .62 : 1.35, 'line', 0, dmg, 'castHigh', { origin: { x: e.x, z: e.z }, face: a, width: 1.7, length: api.clipLine(e, a, 13), style: style, fill: 'forward', beat: s === 0, attack: name, duration: .14 }));
          if (twin) hits.push(hit(at, s ? .62 : 1.35, 'line', 0, dmg, 'castHigh', { origin: { x: e.x, z: e.z }, face: a + Math.PI, width: 1.7, length: api.clipLine(e, a + Math.PI, 13), style: style, fill: 'forward', beat: false, attack: name, duration: .14 }));
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
        edge: null, tether: null, yankCd: 0, hold: 0, auraA: 0, arenaAt: 0, arenaN: 0 };
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

    /* ---- arena feature: the room itself fights (profile.arena), owner-less hazards on their own clock, never during the boss's big set pieces */
    function arenaStep(e, p) {
      var A = p.arena; if (!A || e.phase < (A.phase || 1) || game.state !== 'playing') return;
      if (!st.arenaAt) { st.arenaAt = time + (A.first || 12) * pace(); return; }
      if (time < st.arenaAt) return;
      var m = B.BossMech && B.BossMech.current;
      if ((m && (m.liveOrbs() > 0 || (m.riteActive && m.riteActive()) || (m.majorActive && m.majorActive(e)))) || st.tether || busy(e)) { st.arenaAt = time + 1.2; return; }
      var ar = arenaOf(e); if (!ar) { st.arenaAt = time + 1e9; return; }
      st.arenaN++;
      var made = A.build(e, { x: ar.x || 0, z: ar.z, w: ar.w || 20, d: ar.d || 20 }, st.arenaN, kit, api);
      var every = A.every || [16]; st.arenaAt = time + every[Math.min(every.length - 1, e.phase - 1)] * pace() * (made === false ? .15 : 1);
    }
    function env(e, o) { o.owner = null; o.enemy = e.name; o.near = false; o.cancelOnStagger = false; return api.addHazard(o); }
    BF.env = env;

    /* ---- the body changes with the fight: the silhouette swells a little each phase, motes of the boss's element pour off it
       (more with every phase, a stream when enraged), and a phase change bursts shards and embers outward. Pooled particles only
       (the telegraph emitter, B.Boss2.out), no new meshes. */
    function rgb(hex, k) { return [((hex >> 16) & 255) / 255 * k, ((hex >> 8) & 255) / 255 * k, (hex & 255) / 255 * k]; }
    function emitter() { var o = B.Boss2 && B.Boss2.out; return o && o.emit ? o : null; }
    function body(e, p, dt) {
      var root = e.model && e.model.root; if (!root) return;
      if (e.__bfBase == null) e.__bfBase = root.scale.x || 1;
      var want = e.__bfBase * (1 + .045 * Math.max(0, e.phase - 1) + (e.enraged ? .035 : 0)), cur = root.scale.x;
      if (Math.abs(want - cur) > .0005) { var nx = cur + (want - cur) * Math.min(1, dt * 2.5); root.scale.set(nx, nx, nx); }
      var out = emitter(); if (!out || reduced.matches) return;
      var rate = (e.phase - 1) * 5 + (e.enraged ? 14 : 0); if (rate <= 0) return;
      st.moteAcc = (st.moteAcc || 0) + rate * dt;
      var c = p.rgb || (p.rgb = rgb(p.color || 0xb8452d, 1.8)), H = (e.model.height || 2.6) * root.scale.y / (e.__bfBase || 1);
      while (st.moteAcc >= 1) { st.moteAcc -= 1; var a = Math.random() * TAU, r = (e.radius || 1) * (.5 + Math.random() * .6);
        out.emit(e.x + Math.sin(a) * r, .2 + Math.random() * H, e.z + Math.cos(a) * r, Math.random() < .7 ? 4 : 5, Math.random() < .25 ? [.06, .05, .045] : c, (Math.random() - .5) * .4, .7 + Math.random() * 1.1, (Math.random() - .5) * .4, .9 + Math.random() * .8, .05 + Math.random() * .05); }
    }
    function shatter(e, p, k) {
      var out = emitter(); if (!out) return;
      var c = p.rgb || (p.rgb = rgb(p.color || 0xb8452d, 1.8)), n = Math.round(70 * k), H = (e.model && e.model.height) || 2.6;
      for (var i = 0; i < n; i++) { var a = Math.random() * TAU, sp = 3 + Math.random() * 6, y = .4 + Math.random() * H * .9, dark = Math.random() < .4;
        out.emit(e.x + Math.sin(a) * .5, y, e.z + Math.cos(a) * .5, dark ? 1 : (Math.random() < .5 ? 4 : 1), dark ? [.09, .075, .06] : c, Math.sin(a) * sp, 1 + Math.random() * 4, Math.cos(a) * sp, .5 + Math.random() * .7, dark ? .09 : .06); }
    }
    var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

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
        api.sound('bossPhase'); api.sound('bossLayer', { kind: p.sound, size: 'intro' });
        api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 5.5, color: p.color || 0xb8452d, duration: 1.4 });
      }
      if (!e.active) { aura.visible = false; return; }
      body(e, p, dt);
      var key = e.phase + (e.enraged ? 'e' : '');
      if (key !== st.phaseKey) {
        var label = e.enraged && p.enraged ? p.enraged : p.phases && p.phases[e.phase] || '';
        st.phaseKey = key;
        if (label) showCard(e.enraged ? tr('ÖFKE') : ['', 'I', 'II', 'III', 'IV', 'V'][e.phase] + ' · ' + tr('EVRE'), label, p.title || e.name, 3.2, 2.2, true, p.color);
        api.fx('glowBurst', { x: e.x, y: .05, z: e.z, radius: 7, color: p.color || 0xb8452d, duration: 1.1 });
        if (api.slowMotion) api.slowMotion(.3);
        api.emit('impact', { x: e.x, z: e.z, strength: 1, radius: 9 });
        st.sigAt = Math.min(st.sigAt, time + 6); st.sig2At = Math.min(st.sig2At, time + 14);
        api.sound('bossLayer', { kind: p.sound, size: 'phase' }); shatter(e, p, 1);
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
      arenaStep(e, p);
      tetherStep(dt);
      if (!e.action && e.stagger <= 0) pursuit(e, p);
    }

    // The fall: a short title card and the bars close in once more. Called from combat.js killEnemy (the game may leave 'playing' at once,
    // so this card fades on its own wall clock instead of the combat step).
    function slain(e) {
      var p = profileOf(e); if (!p || st.slain || !st.intro || e !== st.boss) return;
      api.sound('bossLayer', { kind: p.sound, size: 'fall' }); shatter(e, p, 1.4);
      st.slain = true; showCard(tr('YENİLDİ'), p.title || e.name, p.epithet || '', 30, 30, true, p.color, true);
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
        api.sound('bossLayer', { kind: p.sound, size: 'cast' });
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
    function reset() { var b = game.boss; if (b && b.model && b.__bfBase) b.model.root.scale.setScalar(b.__bfBase); st = fresh(); chain.count = 0; aura.visible = false; hideOverlay(); }
    function dispose() { reset(); root.parent && root.parent.remove(root); aura.geometry.dispose(); aura.material.dispose(); chain.geometry.dispose(); chain.material.dispose(); if (BF.current === dir) BF.current = null; }
    var dir = { update: update, attack: attack, slain: slain, env: env, hurt: hurt, evaded: evaded, reset: reset, dispose: dispose, tetherStart: tetherStart, kit: kit,
      get state() { return st; } };
    BF.current = dir;
    return dir;
  }

  /* ------------------------------------------------------------------ the four chapter bosses */
  // Arena features (one per boss; each boss's room plays differently): profile.arena = { phase, first, every:[per phase], build(e, arena, n, kit, api) }.
  // build() places owner-less hazards through BF.env(e, hazard); return false to retry soon.
  BF.register('boss', {
    // Çöken Zemin: from the Blood Oath on, the old sacrificial floor gives way under the fight, a slab at a time; the pit stays.
    arena: { phase: 2, first: 8, every: [12, 11, 9], build: function (e, ar, n, k, api) {
      var p = api.player, hz = api.hazards, live = 0, i;
      for (i = 0; i < hz.length; i++) if (hz[i].envPit && hz[i].age < hz[i].warn + hz[i].duration) live++;
      if (live >= 4) return false;
      for (var tries = 0; tries < 10; tries++) {
        var a = (n * 2.39 + tries * 1.7) % (Math.PI * 2), r = 3 + (tries % 3) * 1.6, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        if (!api.walkable(x, z, 1.2) || Math.hypot(x - e.x, z - e.z) < 3) continue;
        BF.env(e, { x: x, z: z, shape: 'circle', radius: 2.3, warn: 1.6, duration: .2, damage: 16, unblockable: true, style: 'fall', fill: 'inward', scar: true, attack: tr('Çöken Zemin') });
        BF.env(e, { x: x, z: z, shape: 'circle', radius: 2.1, warn: 1.8, duration: 28, damage: 6, periodic: true, interval: .8, persistent: true, unblockable: true, pool: 'lava', poolGain: .5, style: 'quake', envPit: true, attack: tr('Çöken Zemin · çukur') });
        return true;
      }
      return false;
    } },
    title: tr('Zincir Celladı'), epithet: tr('Kurban Salonunun Yargıcı'), sub: tr('KURBAN SALONU'), color: 0xc2452a, style: 'chain', pool: 'lava', sound: 'chain',
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
    // Yükselen Gelgit: the sea pours over the belfry's outer floor for six seconds; only the raised centre stays dry.
    arena: { phase: 1, first: 16, every: [24, 21, 18, 16], build: function (e, ar, n, k, api) {
      var inner = Math.max(5.5, Math.min(ar.w, ar.d) * .3);
      BF.env(e, { x: ar.x, z: ar.z, face: 0, shape: 'ring', inner: inner, radius: Math.hypot(ar.w, ar.d) * .5 + 2, arc: Math.PI * 2, warn: 2.2, duration: 6, damage: 5, periodic: true, interval: .9,
        persistent: true, unblockable: true, pool: 'brine', poolGain: .8, tellGain: .5, style: 'tide', fill: 'inward', attack: tr('Yükselen Gelgit') });
      api.emit('toast', { text: tr('Gelgit yükseliyor. Ortadaki kuru zemine çık.') });
      return true;
    } },
    title: tr('Derinliklerin Çancısı'), epithet: tr('Boğulmuşların Çağrıcısı'), sub: tr('BOĞULMUŞ ÇANLIK'), color: 0x3fa49a, style: 'tide', pool: 'brine', sound: 'tide',
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
    // Billur Damarlar: six crystal veins in the throne room's floor erupt in a fixed turning order (two opposite vents a time),
    // plus the vent nearest the hero: learn the order, keep off the next pair.
    arena: { phase: 1, first: 10, every: [10, 8.5, 7], build: function (e, ar, n, k, api) {
      var R = Math.min(ar.w, ar.d) * .3, p = api.player, near = -1, best = 1e9, i, pts = [];
      for (i = 0; i < 6; i++) { var a = i * Math.PI / 3 + .5, o = { x: ar.x + Math.sin(a) * R, z: ar.z + Math.cos(a) * R }; pts.push(o); var dd = Math.hypot(o.x - p.x, o.z - p.z); if (dd < best) { best = dd; near = i; } }
      var pick = [n % 3, n % 3 + 3]; if (pick.indexOf(near) < 0 && e.phase >= 2) pick.push(near);
      pick.forEach(function (j, q) { var o = pts[j]; if (!api.walkable(o.x, o.z, .8)) return;
        BF.env(e, { x: o.x, z: o.z, shape: 'circle', radius: 2.6, warn: 1.4 + q * .2, duration: .2, damage: 16, unblockable: true, style: 'rune', fill: 'inward', scar: true, attack: tr('Billur Damar') }); });
      return true;
    } },
    title: tr('Oyukların Kralı'), epithet: tr('Sessiz Tahtın Sahibi'), sub: tr('SESSİZ TAHT'), color: 0x8a9ccf, style: 'rune', pool: 'lava', sound: 'crystal',
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
    // Döküm Olukları: two casting channels across the forge floor fill with molten metal for five seconds, axis alternating each time.
    arena: { phase: 1, first: 12, every: [17, 15, 12], build: function (e, ar, n, k, api) {
      var alongX = n % 2 === 0, off = (alongX ? ar.d : ar.w) * .17;
      [-1, 1].forEach(function (sgn) {
        var o = alongX ? { x: ar.x - ar.w / 2, z: ar.z + sgn * off } : { x: ar.x + sgn * off, z: ar.z - ar.d / 2 };
        BF.env(e, { x: o.x, z: o.z, face: alongX ? Math.PI / 2 : 0, shape: 'line', width: 2.3, length: alongX ? ar.w : ar.d, warn: 1.8, duration: 5, damage: 6, periodic: true, interval: .7,
          persistent: true, unblockable: true, pool: 'lava', poolGain: .9, style: 'ember', fill: 'forward', attack: tr('Döküm Oluğu') });
      });
      return true;
    } },
    title: tr('Ocağın Kalbi'), epithet: tr('Son Dökümün Efendisi'), sub: tr('SON DÖKÜM'), color: 0xe0661c, style: 'ember', pool: 'lava', sound: 'forge',
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
