/* KABİR AZABI — boss mechanics for chapters I and II (round 7): homing orbs, ritual chain anchors, fight clock / frenzy.
   Not a rendering layer for tells: the ground warnings of every new attack are ordinary hazards (combat.js addHazard -> telegraphs.js), drawn with the same
   gold = ordinary / crimson = severe language. This file only owns the two things hazards cannot express:
     * ORBS   (Zincir Celladı: ember seals, Derinliklerin Çancısı: drowned lanterns). A slow orb rises from the boss, then homes on the hero at ~3 m/s (the hero
              runs 5.35 m/s and rolls ~5 m, so it can always be outrun). When it gets within FUSE_NEAR of the hero (or its life ends) it stops, a crimson circle
              appears under it and it bursts .9 s later: no instant hit exists. A hero blow that reaches it before the fuse pops it harmlessly.
     * ANCHORS (Zincir Celladı rite). Four chain-lit braziers around the boss while he channels a huge three-pulse nova (combat.js 'rite' move). The nova's
              damage scales with the anchors still lit; standing beside an anchor (or striking it) snuffs it; all four dark = the channel breaks and he is stunned.
   Everything is pooled and built once at setup (meshes sit in the scene hidden; warmup.js shows every scene object once, so nothing compiles in a fight).
   No lights, no per-frame allocation. Contract: BABA.BossMech.create(api) -> mech; BABA.BossMech.current is the live instance (coast-combat.js uses it).
   api = { root, player, game, hazards, addHazard, cancelHazards, walkable, emit, sound, fx, groundY }. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, TAU = Math.PI * 2;
  var MAX_ORB = 4, MAX_ANCHOR = 4, FUSE_NEAR = 2.9, FUSE_TIME = .92, FRENZY_AT = 170;
  var KIND = {
    ember: { core: [4.2, 1.5, .35], halo: [1.5, .42, .08], blast: 3.2, style: 'ember', name: 'Kor Mühür' },
    brine: { core: [.7, 3.2, 3.0], halo: [.12, .75, .8], blast: 3.2, style: 'tide', name: 'Boğulmuş Fener' }
  };
  function hypot(x, z) { return Math.sqrt(x * x + z * z); }

  B.BossMech = {
    current: null,
    create: function (api) {
      var player = api.player, hazards = api.hazards, root = new T.Group(), time = 0, fightT = 0;
      root.name = 'boss1_mech'; api.root.add(root);
      var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
      // One stable record for the HUD; text changes are revision-driven, clocks never allocate DOM/data.
      var instruction = api.game.bossMechanic = { active:false, revision:0, kind:'', title:'', instruction:'', progress:0, remaining:0, duration:0, safe:false, targets:0, ownerId:'' };
      function say(kind,title,text,age,duration,safe,targets,owner) {
        var active=!!title;
        if(instruction.active!==active||instruction.kind!==kind||instruction.title!==title||instruction.instruction!==text||instruction.safe!==!!safe||instruction.targets!==(targets||0))instruction.revision++;
        instruction.active=active;instruction.kind=kind;instruction.title=title;instruction.instruction=text;instruction.duration=duration||0;
        instruction.remaining=Math.max(0,(duration||0)-(age||0));instruction.progress=duration>0?Math.min(1,Math.max(0,age/duration)):0;
        instruction.safe=!!safe;instruction.targets=targets||0;instruction.ownerId=owner&&owner.id||'';
      }
      function floorCount(owner,pool) {var n=0;for(var i=0;i<hazards.length;i++){var h=hazards[i];if(h.owner===owner&&h.persistent&&(!pool||h.pool===pool)&&h.age<h.warn+h.duration)n++;}return n;}
      function sheltered(source,x,z,margin) {
        for(var i=0;i<hazards.length;i++){var h=hazards[i];if(h.pool!=='dark'||h.owner!==source.owner||h.age<0||h.age>h.warn+h.duration)continue;
          if((h.active||h.warn-h.age<=1)&&hypot(x-h.x,z-h.z)<h.inner-(margin||0))return true;
        }return false;
      }
      function updateInstruction() {
        var boss=api.game.boss, core=B.Boss2&&B.Boss2.current, a=boss&&boss.action, i,h,dark=null,next=null;
        if(api.game.state!=='playing'||player.dead){say('','','',0,0);return;}
        if(!boss||boss.dead||!boss.active){boss=null;var foes=api.game.enemies||[],nearest=18*18;
          for(i=0;i<foes.length;i++){var foe=foes[i];if(foe.dead||!foe.active||!(foe.elite||foe.type==='ruinwarden'||foe.type==='ashwarden'))continue;var dx=foe.x-player.x,dz=foe.z-player.z,d2=dx*dx+dz*dz;if(d2<nearest){nearest=d2;boss=foe;}}
          if(!boss){say('','','',0,0);return;}a=boss.action;
        }
        for(i=0;i<hazards.length;i++){h=hazards[i];if(h.owner!==boss||h.pool!=='dark')continue;if(h.active&&h.age<h.warn+h.duration)dark=h;else if(h.age>=0&&!h.active&&(!next||h.warn-h.age<next.warn-next.age))next=h;}
        if(dark||next){h=dark||next;var safe=sheltered(h,player.x,player.z,.43),handoff=next&&dark&&next.warn-next.age<=1;
          say('shelter','Karanlık Gelgit',handoff?'Yeni siper açıldı; diğer mavi halkaya geç.':next&&dark?'Kesikli halka hazırlanıyor; sınırı dolunca geç.':safe?'Siperdesin. Soluk mavi halkanın içinde kal.':'Soluk mavi halkanın içine gir; dışarıdaki su hasar verir.',h.active?h.age-h.warn:h.age,h.active?h.duration:h.warn,safe,0,boss);return;}
        if(rite&&!rite.done){say('strike','Yemin Çapaları','Yanan çapaları vur veya yanında bekleyerek söndür.',rite.age,rite.seconds,false,litCount(),boss);return;}
        if(core&&core.ext.game===api.game&&core.nova.on&&core.nova.owner===boss){var covered=!!core.pillars.blocks(core.nova.x,core.nova.z,player.x,player.z),limit=0;
          for(i=0;i<hazards.length;i++)if(hazards[i].owner===boss&&hazards[i].attack==='Sessiz Nova')limit=hazards[i].warn;
          say('shelter','Sessiz Nova',covered?'Siperdesin. Sütun darbeyi yutana kadar bekle.':'Taş sütunun arkasındaki mavi sipere geç. Sütuna vurma.',core.nova.t,limit||4.6,covered,core.pillars.up(),boss);return;}
        if(a&&a.moveId==='furnaceClock'){say('move','Ocağın Saati','Mavi açık dilime geç; kırmızı dilimler sırayla patlar.',a.age,a.duration,false,0,boss);return;}
        var flying=liveOrbs();if(flying){say('strike',boss.type==='bell'?'Boğulmuş Fenerler':'Kor Mühürler','Havada süzülürken vurup kır; kızıl çember çıkınca uzaklaş.',0,0,false,flying,boss);return;}
        if(core&&core.ext.game===api.game&&core.orbs.count()){say('dodge',core.chapter===3?'Soluk Küreler':'Cüruf Küreleri',core.chapter===3?'Kürelere vurulmaz. Yana kaç veya taş sipere çarptır.':'Kürelere vurulmaz. Yana kaç; bıraktıkları közden uzak dur.',0,0,false,core.orbs.count(),boss);return;}
        var id=a&&a.moveId, text='';
        if(id==='pull')text='Zincir seni çeker; merkeze düştüğünde hemen yana kaç.';
        else if(id==='hooks'||id==='hook')text='Kancanın çizgisinden yana çık; ardından gelen savuruşu bekle.';
        else if(id==='tides')text='Dalgaların arasındaki açık koridoru kullan.';
        else if(id==='toll'||id==='tide'||id==='hollowPulse'||id==='furnaceCrown'||id==='anvilSlam'||id==='cyclone')text='Halkalar sırayla patlar. İşaretsiz aralığa geç.';
        else if(id==='crystalStar'||id==='lavaLanes'||id==='chainWhip'||id==='fissures'||id==='vents'||id==='fall'||id==='bells'||id==='ashLava'||id==='chainLanes'||id==='piston'||id==='wardenStar')text='İşaretler sırayla vurur. Parlayan sınırların dışına çık.';
        else if(id==='hollowBurrow'||id==='kingRush'||id==='overheatDash'||id==='bellRush'||id==='wardenBurrow'||id==='ashDash'||id==='slam'||id==='leap'||id==='charge')text='Kızıl alanı boşalt. Darbeden sonra karşılık ver.';
        else if(id==='hollowCall'||id==='furnaceCall')text='Çağrı çemberinden uzak dur; çıkan yaratıkları yen.';
        else if(id==='hollowEcho')text='Yankılar sırayla vurur. Altın dilimlerin dışına çık.';
        if(text){say(id==='hollowCall'||id==='furnaceCall'?'adds':'move',a.attack||'Boss saldırısı',text,a.age,a.duration,false,0,boss);return;}
        if(id==='lanterns'){say('shelter','Karanlık Gelgit','Mavi siper hazırlanıyor; sınırı dolunca içinde kal.',a.age,1.9,false,0,boss);return;}
        if(id==='brine'&&boss.type==='bell'){say('move','Tuzlu Havuzlar','Dairelerden uzaklaş; kızıl kenarlı su hasar vermeyi sürdürür.',a.age,a.duration,false,0,boss);return;}
        if(floorCount(boss)){say('move','Tehlikeli Zemin','Sınırı kızıl olan su ve köz birikintilerinden uzak dur.',0,0,false,0,boss);return;}
        say('','','',0,0);
      }

      // ---------------------------------------------------------------- shared geometry / materials (setup only)
      var orbGeo = new T.IcosahedronGeometry(.3, 2), haloGeo = new T.SphereGeometry(.66, 14, 10), markGeo = new T.RingGeometry(.55, .72, 28).rotateX(-Math.PI / 2);
      var postGeo = new T.CylinderGeometry(.2, .3, 1.7, 10), bowlGeo = new T.CylinderGeometry(.62, .34, .42, 12), flameGeo = new T.ConeGeometry(.34, 1.0, 9, 1, true);
      var baseGeo = new T.CylinderGeometry(.5, .6, .18, 12), ringGeo = new T.RingGeometry(1.35, 1.62, 40).rotateX(-Math.PI / 2), chainGeo = new T.CylinderGeometry(.05, .05, 1, 5);
      chainGeo.translate(0, .5, 0);
      var ironMat = new T.MeshStandardMaterial({ color: 0x2c2724, roughness: .52, metalness: .85 });
      var flameMat = new T.MeshBasicMaterial({ color: new T.Color(1.5, .52, .12), transparent: true, opacity: .65, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
      var litRingMat = new T.MeshBasicMaterial({ color: new T.Color(.92, .67, .27), transparent: true, opacity: .42, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
      var chainMat = new T.MeshBasicMaterial({ color: new T.Color(.58, .21, .07), transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending, fog: false });

      // ---------------------------------------------------------------- orbs
      var orbs = [], i;
      for (i = 0; i < MAX_ORB; i++) {
        var oc = new T.MeshBasicMaterial({ color: new T.Color(4, 1.4, .3), fog: false });
        var oh = new T.MeshBasicMaterial({ color: new T.Color(1.5, .4, .08), transparent: true, opacity: .42, depthWrite: false, blending: T.AdditiveBlending, fog: false });
        var om = new T.MeshBasicMaterial({ color: new T.Color(1.2, .35, .1), transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
        var core = new T.Mesh(orbGeo, oc), halo = new T.Mesh(haloGeo, oh), spot = new T.Mesh(markGeo, om);
        core.visible = halo.visible = spot.visible = false; core.frustumCulled = halo.frustumCulled = spot.frustumCulled = false;
        halo.renderOrder = 4; spot.renderOrder = 3; core.name = 'boss1_orb'; halo.name = 'boss1_orb_halo'; spot.name = 'boss1_orb_mark';
        root.add(core, halo, spot);
        orbs.push({ live: false, state: 0, x: 0, z: 0, y: 1, vx: 0, vz: 0, age: 0, life: 8, speed: 3, fuse: 0, kind: 'ember', owner: null, hazard: null, core: core, halo: halo, mark: spot, cm: oc, hm: oh, mm: om, trail: 0, slot: i });
      }
      function setOrbKind(o, k) {
        var c = KIND[k]; o.kind = k; o.cm.color.setRGB(c.core[0], c.core[1], c.core[2]); o.hm.color.setRGB(c.halo[0], c.halo[1], c.halo[2]); o.mm.color.setRGB(c.halo[0] * .8, c.halo[1] * .8, c.halo[2] * .8);
      }
      function showOrb(o, on) { o.core.visible = o.halo.visible = o.mark.visible = on; }
      function liveOrbs() { var n = 0; for (var k = 0; k < MAX_ORB; k++) if (orbs[k].live) n++; return n; }
      // Launch n orbs from the owner. cfg: { kind, speed, life, spread }. Returns how many were launched.
      function launchOrbs(owner, n, cfg) {
        cfg = cfg || {}; var made = 0, base = Math.atan2(player.x - owner.x, player.z - owner.z), kind = cfg.kind || 'ember';
        for (var k = 0; k < MAX_ORB && made < n; k++) {
          var o = orbs[k]; if (o.live) continue;
          var a = base + (made - (n - 1) / 2) * 1.15 + (made % 2 ? .25 : -.25);
          o.live = true; o.state = 0; o.age = 0; o.owner = owner; o.hazard = null; o.burst = false; o.speed = cfg.speed || 3.05; o.life = cfg.life || 8.5; o.fuse = 0;
          o.x = owner.x + Math.sin(a) * 1.5; o.z = owner.z + Math.cos(a) * 1.5; o.y = 2.3; o.vx = Math.sin(a) * 4.2; o.vz = Math.cos(a) * 4.2; o.trail = 0;
          setOrbKind(o, kind); showOrb(o, true); made++;
          api.fx('boss1Orb', { x: o.x, y: o.y, z: o.z, kind: kind, phase: 'spawn' });
        }
        if (made) api.sound('boss1Orb', { x: owner.x, z: owner.z, kind: kind });
        return made;
      }
      function killOrb(o, burst) {
        if (!o.live) return;
        o.live = false; showOrb(o, false); o.hazard = null;
        if (burst) api.fx('boss1Orb', { x: o.x, y: .6, z: o.z, kind: o.kind, phase: burst === 2 ? 'blast' : 'pop', radius: KIND[o.kind].blast });
      }
      function armOrb(o) {
        var c = KIND[o.kind]; o.state = 2; o.fuse = 0; o.vx = o.vz = 0;
        o.hazard = api.addHazard({ owner: o.owner, enemy: o.owner ? o.owner.name : 'Boss', x: o.x, z: o.z, shape: 'circle', radius: c.blast, warn: FUSE_TIME, duration: .17,
          damage: 22, unblockable: true, style: c.style, fill: 'inward', attack: c.name + ' Patlaması', scar: true,
          onActive: function () { api.fx('boss1Orb', { x: o.x, y: .6, z: o.z, kind: o.kind, phase: 'blast', radius: c.blast }); o.burst = true; } });
        api.sound('boss1OrbFuse', { x: o.x, z: o.z, kind: o.kind });
      }
      function stepOrbs(dt) {
        for (var k = 0; k < MAX_ORB; k++) {
          var o = orbs[k]; if (!o.live) continue;
          o.age += dt;
          if (!o.owner || o.owner.dead || api.game.state !== 'playing') { killOrb(o, 0); continue; }
          var dx = player.x - o.x, dz = player.z - o.z, d = hypot(dx, dz) || 1;
          if (o.state === 0) {          // rising away from the boss
            o.vx *= 1 - Math.min(1, dt * 2.2); o.vz *= 1 - Math.min(1, dt * 2.2);
            o.y += (1.25 - o.y) * Math.min(1, dt * 2.4);
            if (o.age > .85) o.state = 1;
          } else if (o.state === 1) {   // homing: the velocity turns toward the hero, never snaps
            var turn = Math.min(1, dt * 1.7), tx = dx / d * o.speed, tz = dz / d * o.speed;
            o.vx += (tx - o.vx) * turn; o.vz += (tz - o.vz) * turn;
            var sp = hypot(o.vx, o.vz); if (sp > o.speed) { o.vx *= o.speed / sp; o.vz *= o.speed / sp; }
            o.y = 1.25 + (calm.matches ? 0 : Math.sin(o.age * 5 + k) * .12);
            if (d < FUSE_NEAR || o.age > o.life) armOrb(o);
          } else {                      // fused: sits and swells until its circle bursts
            o.fuse += dt; o.y += (.75 - o.y) * Math.min(1, dt * 3);
            if (o.burst) { killOrb(o, 1); continue; }
            if (o.hazard && hazards.indexOf(o.hazard) < 0) { killOrb(o, 1); continue; }   // the owner's stagger / a reset withdrew the tell: the orb gutters out
          }
          if (o.state < 2) {
            var nx = o.x + o.vx * dt, nz = o.z + o.vz * dt;
            if (api.walkable(nx, nz, .25)) { o.x = nx; o.z = nz; } else if (api.walkable(nx, o.z, .25)) o.x = nx; else if (api.walkable(o.x, nz, .25)) o.z = nz; else o.state === 1 && armOrb(o);
          }
          var gy = api.groundY(o.x, o.z), pulse = o.state === 2 ? 1 + o.fuse * .5 : 1, flick = calm.matches ? 1 : .92 + .08 * Math.sin(o.age * 17 + k * 2);
          o.core.position.set(o.x, gy + o.y, o.z); o.core.scale.setScalar(pulse * flick);
          o.halo.position.copy(o.core.position); o.halo.scale.setScalar((1.05 + (o.state === 2 ? o.fuse * .75 : 0)) * flick);
          o.mark.position.set(o.x, gy + .05, o.z); o.mark.scale.setScalar(o.state === 2 ? 1.2 + o.fuse * 1.6 : 1);
          // Pale gold target ring only while a real hero blow can destroy it; crimson means leave.
          o.mm.color.setRGB(o.state===2?1.15:.95,o.state===2?.12:.72,o.state===2?.07:.34);
          o.hm.opacity=o.state===2?.24:.18;
          o.trail -= dt; if (o.trail <= 0 && o.state < 2) { o.trail = .07; api.fx('boss1Orb', { x: o.x, y: gy + o.y, z: o.z, kind: o.kind, phase: 'trail' }); }
        }
      }

      // ---------------------------------------------------------------- anchors (the rite)
      var anchors = [], rite = null;
      for (i = 0; i < MAX_ANCHOR; i++) {
        var g = new T.Group(); g.visible = false; g.name = 'boss1_anchor';
        var base = new T.Mesh(baseGeo, ironMat), post = new T.Mesh(postGeo, ironMat), bowl = new T.Mesh(bowlGeo, ironMat), flame = new T.Mesh(flameGeo, flameMat);
        var ring = new T.Mesh(ringGeo, litRingMat), chain = new T.Mesh(chainGeo, chainMat);
        base.position.y = .09; post.position.y = .95; bowl.position.y = 1.92; flame.position.y = 2.55; ring.position.y = .06;
        base.frustumCulled = post.frustumCulled = bowl.frustumCulled = flame.frustumCulled = ring.frustumCulled = chain.frustumCulled = false;
        flame.renderOrder = 4; ring.renderOrder = 3; chain.renderOrder = 4; chain.visible = false;
        g.add(base, post, bowl, flame, ring); root.add(g, chain);
        anchors.push({ live: false, lit: false, x: 0, z: 0, hp: 3, prog: 0, flash: 0, fade: 0, g: g, flame: flame, ring: ring, chain: chain });
      }
      var AQ = new T.Quaternion(), AV = new T.Vector3(), AUP = new T.Vector3(0, 1, 0);
      function litCount() { var n = 0; for (var k = 0; k < MAX_ANCHOR; k++) if (anchors[k].live && anchors[k].lit) n++; return n; }
      // Lays n anchors around the owner at radius r (falls back to nearer rings where the floor is blocked). Returns the number placed.
      function startRite(owner, n, r, seconds) {
        var placed = 0, a0 = Math.atan2(player.x - owner.x, player.z - owner.z) + Math.PI / n;
        for (var k = 0; k < MAX_ANCHOR; k++) { anchors[k].live = false; anchors[k].g.visible = false; anchors[k].chain.visible = false; }
        for (var j = 0; j < n; j++) {
          var a = a0 + j * TAU / n, rr = r, x = 0, z = 0, ok = false;
          for (var t = 0; t < 5; t++, rr -= 1.4) { x = owner.x + Math.sin(a) * rr; z = owner.z + Math.cos(a) * rr; if (api.walkable(x, z, .9)) { ok = true; break; } }
          if (!ok) continue;
          var an = anchors[placed++]; an.live = true; an.lit = true; an.x = x; an.z = z; an.hp = 3; an.prog = 0; an.flash = 0; an.fade = 0;
          an.g.position.set(x, api.groundY(x, z), z); an.g.visible = true; an.g.scale.setScalar(.01); an.flame.scale.set(1, 1, 1); an.chain.visible = true;
        }
        if (placed < 2) { for (var q = 0; q < MAX_ANCHOR; q++) { anchors[q].live = false; anchors[q].g.visible = false; anchors[q].chain.visible = false; } return 0; }
        rite = { owner: owner, age: 0, total: placed, seconds: seconds, spike: 2.2, done: false };
        api.sound('boss1Rite', { x: owner.x, z: owner.z });
        return placed;
      }
      function snuff(an, silent) {
        if (!an.lit) return;
        an.lit = false; an.hp = 0; an.fade = 0;
        api.fx('boss1Anchor', { x: an.x, y: 1.2, z: an.z, phase: 'break' }); api.sound('boss1Snap', { x: an.x, z: an.z });
        an.chain.visible = false;
        if (!silent && rite && litCount() === 0) breakRite();
      }
      function hitAnchor(an, units) {
        if (!an.lit) return;
        an.hp -= units; an.flash = 1; an.prog = Math.max(0, an.prog);
        api.fx('boss1Anchor', { x: an.x, y: 1.6, z: an.z, phase: 'hit' }); api.sound('boss1Anchor', { x: an.x, z: an.z });
        if (an.hp <= 0) snuff(an, false);
      }
      // All four dark: the nova is withdrawn, the owner reels.
      function breakRite() {
        var o = rite && rite.owner; rite.done = true;
        if (!o || o.dead) return;
        api.cancelHazards(o, false);
        o.action = null; o.faceLocked = false; o.stagger = o.staggerTotal = 3.1; o.staggerKind = 'heavy'; o.cooldown = Math.max(o.cooldown, .8); o.hurt = 1; o.hurtHeavy = true;
        api.fx('boss1Anchor', { x: o.x, y: 1.4, z: o.z, phase: 'broken' });
        api.emit('impact', { x: o.x, z: o.z, strength: 1, radius: 8 });
        api.emit('toast', { text: 'Çapalar söndü. Yemin yarıda kaldı: şimdi vur.' });
        api.sound('bossPhase');
      }
      function endRite() {
        rite = null;
        for (var k = 0; k < MAX_ANCHOR; k++) { var an = anchors[k]; if (an.live) { an.live = false; if (an.lit) { an.lit = false; api.fx('boss1Anchor', { x: an.x, y: 1.2, z: an.z, phase: 'break' }); } an.g.visible = false; an.chain.visible = false; } }
      }
      function stepAnchors(dt) {
        if (!rite) return;
        var o = rite.owner; rite.age += dt;
        if (o.dead || api.game.state !== 'playing' || (!rite.done && (!o.action || o.action.moveId !== 'rite'))) { endRite(); return; }
        if (rite.done) { endRite(); return; }
        // Ground spikes under the hero while the channel lasts: a gold circle, locked at the hero's feet, one second of warning.
        rite.spike -= dt;
        if (rite.spike <= 0 && rite.age > 1.4 && rite.age < rite.seconds - 1.5) {
          rite.spike = 2.3;
          api.addHazard({ owner: o, enemy: o.name, x: player.x, z: player.z, shape: 'circle', radius: 1.7, warn: 1.05, duration: .17, damage: 12, style: 'fall', fill: 'inward', attack: 'Çapa Zinciri', scar: true });
        }
        var sx = o.x, sy = 1.9, sz = o.z;
        for (var k = 0; k < MAX_ANCHOR; k++) {
          var an = anchors[k]; if (!an.live) continue;
          var grow = Math.min(1, rite.age / .6); an.g.scale.setScalar(Math.max(.01, an.lit ? grow : an.g.scale.x));
          an.flash = Math.max(0, an.flash - dt * 3.2);
          if (an.lit) {
            // Standing beside it (not rolling, not reeling) snuffs it over ~2.4 s; a blow does the same faster (heroBlow below).
            var near = hypot(player.x - an.x, player.z - an.z) < 2.1 && player.dodge <= 0 && !player.dead && player.stagger <= 0;
            an.prog = near ? an.prog + dt : Math.max(0, an.prog - dt * .35);
            if (an.prog >= 2.4) { an.prog = 0; hitAnchor(an, 3); if (!an.lit && !rite) return; }
            var f = Math.max(.35, an.hp / 3);
            an.flame.scale.set(f * (1 + an.flash * .5), f * (1 + an.flash * .6 + (calm.matches ? 0 : .09 * Math.sin(rite.age * 14 + k * 3))), f * (1 + an.flash * .5));
            an.ring.scale.setScalar(1 + an.prog / 2.4 * .35 + an.flash * .12);
            litRingMat.opacity = .5;
            // chain from the boss's chest to the brazier
            var ex = an.x, ey = an.g.position.y + 2.1, ez = an.z; AV.set(ex - sx, ey - sy, ez - sz); var len = AV.length();
            if (len > .01) { AV.multiplyScalar(1 / len); AQ.setFromUnitVectors(AUP, AV); an.chain.quaternion.copy(AQ); an.chain.position.set(sx, sy, sz); an.chain.scale.set(1, len, 1); }
          } else { an.g.scale.setScalar(Math.max(.01, an.g.scale.x - dt * 2)); an.flame.scale.set(.01, .01, .01); }
        }
      }

      // ---------------------------------------------------------------- hero blows (an attack that reaches an anchor or an orb)
      function blow(x, z, reach, units) {
        var k;
        if (rite) for (k = 0; k < MAX_ANCHOR; k++) { var an = anchors[k]; if (an.live && an.lit && hypot(an.x - x, an.z - z) <= reach + .6) hitAnchor(an, units); }
        for (k = 0; k < MAX_ORB; k++) { var o = orbs[k]; if (o.live && o.state < 2 && hypot(o.x - x, o.z - z) <= reach * .85 + .4) { api.sound('boss1Pop', { x: o.x, z: o.z }); killOrb(o, 1); } }
      }
      function heroBlows() {
        var a = player.attack;
        if (player.roar && player.roar.released && !player.roar.b1) { player.roar.b1 = 1; blow(player.x, player.z, 5, 1); }
        if (!a) return;
        if (a.line === 'charge') { var h = player.chargeHandle; if (h && h.impacted && !a.b1) { a.b1 = 1; blow(h.impactX, h.impactZ, 3.4, 3); } return; }
        if (a.whirl) { if (a.b1t !== a.ticks) { a.b1t = a.ticks; if (a.ticks) blow(player.x, player.z, a.radius || 3.4, 1); } return; }
        if (a.hit && !a.b1) { a.b1 = 1; blow(player.x, player.z, a.radius > 0 ? a.radius : 4.2, a.skill ? 3 : a.heavy ? 2 : 1); }
      }

      // ---------------------------------------------------------------- fight clock, frenzy, cool-downs
      var last = Object.create(null);
      function ready(e, id, cd) { var k = e.id + id; return !(k in last) || time - last[k] >= cd; }
      function mark(e, id) { last[e.id + id] = time; }
      function frenzied(e) { return !!e && e.b1Frenzy === 1; }
      var counts = Object.create(null);
      function count(e, id) { return counts[e.id + id] || 0; }
      function bump(e, id) { counts[e.id + id] = (counts[e.id + id] || 0) + 1; }
      var mech = {
        launchOrbs: launchOrbs, liveOrbs: liveOrbs, startRite: startRite, ready: ready, mark: mark, count: count, bump: bump, frenzied: frenzied, blow: blow,
        floorCount:floorCount, sheltered:sheltered, majorActive:function(owner){return floorCount(owner,'dark')>0;},
        state: function () { return { anchors: anchors.filter(function (a) { return a.live && a.lit; }).map(function (a) { return { x: a.x, z: a.z }; }), orbs: orbs.filter(function (o) { return o.live; }).map(function (o) { return { x: o.x, z: o.z, state: o.state }; }), fight: fightT }; },   // QA only
        riteLit: litCount, riteActive: function () { return !!rite; }, time: function () { return time; }, fightTime: function () { return fightT; },
        clear: function () {
          time = 0; fightT = 0; say('','','',0,0); for (var k in last) delete last[k]; for (k in counts) delete counts[k];
          for (var q = 0; q < MAX_ORB; q++) { orbs[q].live = false; orbs[q].hazard = null; showOrb(orbs[q], false); }
          endRite(); for (q = 0; q < MAX_ANCHOR; q++) { anchors[q].live = false; anchors[q].g.visible = false; anchors[q].chain.visible = false; }
          if (api.game.boss) api.game.boss.b1Frenzy = 0;
        },
        step: function (dt) {
          time += dt;
          var boss = api.game.boss;
          if (boss && boss.active && !boss.dead && api.game.state === 'playing' && !player.dead) {
            fightT += dt;
            if (fightT > FRENZY_AT && !boss.b1Frenzy && !(boss.stats && (boss.stats.ruins || boss.stats.forge))) {
              boss.b1Frenzy = 1; api.emit('toast', { text: boss.type === 'bell' ? 'Çan kudurdu. Gelgit hızlanıyor.' : 'Cellat kudurdu. Darbeleri sıklaşıyor.' });
              api.fx('boss1Orb', { x: boss.x, y: 1.4, z: boss.z, kind: boss.type === 'bell' ? 'brine' : 'ember', phase: 'blast', radius: 5 });
              api.sound('bossPhase');
            }
          }
          heroBlows(); stepOrbs(dt); stepAnchors(dt); updateInstruction();
        },
        dispose: function () { api.root.remove(root); [orbGeo, haloGeo, markGeo, postGeo, bowlGeo, flameGeo, baseGeo, ringGeo, chainGeo, ironMat, flameMat, litRingMat, chainMat].forEach(function (r) { r.dispose(); });
          orbs.forEach(function (o) { o.cm.dispose(); o.hm.dispose(); o.mm.dispose(); }); if (B.BossMech.current === mech) B.BossMech.current = null; }
      };
      B.BossMech.current = mech;
      return mech;
    }
  };
}());
