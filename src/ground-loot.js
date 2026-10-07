/* KABİR AZABI — visible enemy loot. Prepared instances, click-to-pick (Diablo style), rarity name labels, no per-drop GPU allocations.
   Pickup: hovering highlights an item, a click walks the hero to it (combat.js order kind 'loot'), E takes the nearest one within 2 m.
   B.GroundLoot.auto = the old proximity auto-pickup (settings "Eşyaları otomatik topla", default OFF). Boss rewards never deadlock: see FALLBACK_*. */
(function () {
  'use strict';
  const B = window.BABA, T = window.THREE;
  const CAPACITY = 96, REACH = 3.25, BOSS_REACH = 5, DELAY = .5, BOSS_DELAY = 1.1, FLIGHT = .32;
  const FALL = .36, LANDED = .5, TAKE_REACH = 1.4, TAKE_KEY = 2, FALLBACK_WAIT = 25, FALLBACK_REACH = 4, MAX_LABELS = 24, LABEL_BASE = 20; let LABEL_H = 20, LK = 1;   // LK: label scale for big screens (1 up to ~2133 px wide, 1.3 max)
  const GLOW_K = [.30, .45, .65, .85, 1.05];   // ground-ring strength by rarity rank (common ... unique)
  let atlas = null, atlasTask = null, labelBox = null, labelPool = null;
  const dict = {
    'Çanta dolu. Yer açmadan bu eşyayı alamazsın.': 'Bag full. Make room before you can take this item.',
    'Efendi yenildi. Düşürdüğü eşyaya tıkla ve al.': 'The master has fallen. Click the item it dropped to take it.',
    'Efendinin düşürdüğü eşyayı al.': "Take the boss's drop.",
    'Eşyaları otomatik topla': 'Auto-pickup items',
    'Yakına düşen eşyalar kendiliğinden çantaya uçar. Kapalıyken eşyaya tıkla (ya da E).': 'Items that land nearby fly into your bag on their own. When off, click an item (or press E).',
    'Eşya adları': 'Item names',
    'Basılı tutunca yerdeki bütün eşyaların adı görünür': 'Hold to show the names of every item on the ground',
    'Basılı tutunca yerdeki bütün eşyaların adı görünür · eşyaya tıkla: yürür ve alır · E: yakındakini al': 'Hold to show the names of every item on the ground · click an item: walk there and take it · E: take the nearest one',
    'Efendinin düşürdüğü eşyayı al.': "Take the boss's drop."
  };
  try { Object.assign(window.KabirI18n.dictionary, dict); } catch (_) { /* dictionary is optional */ }
  const L = s => (window.KabirI18n ? KabirI18n.t(s) : s);

  /* ───────────── name labels (DOM, pooled, positioned from world → screen each frame) ───────────── */
  const CSS = '#loot-labels{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}' +
    '.loot-label{position:absolute;left:0;top:0;height:calc(' + LABEL_BASE + 'px*var(--lk,1));padding:0 9px;box-sizing:border-box;white-space:nowrap;opacity:0;font:700 calc(15px*var(--lk,1))/calc(' + LABEL_BASE + 'px*var(--lk,1)) var(--text,system-ui,sans-serif);letter-spacing:.015em;' +
    'color:var(--lc,#c7bdae);text-shadow:0 1px 2px #000,0 0 3px #000,0 0 6px #000a;background:linear-gradient(90deg,#0a080500,#0a0805c4 14%,#0a0805c4 86%,#0a080500);will-change:transform,opacity;contain:layout paint}' +
    '.loot-label.hl{background:linear-gradient(90deg,#0a080500,#0a0805e0 14%,#0a0805e0 86%,#0a080500);color:#fff;text-shadow:0 1px 2px #000,0 0 7px var(--lc)}' +
    '.loot-label.reward{font-size:calc(16px*var(--lk,1));box-shadow:0 1px 0 0 var(--lc);animation:loot-reward 1.7s ease-in-out infinite}' +
    '@keyframes loot-reward{50%{filter:brightness(1.35)}}' +
    '@media (prefers-reduced-motion:reduce){.loot-label.reward{animation:none}}';
  function labels() {
    if (labelPool) return labelPool;
    const style = document.createElement('style'); style.id = 'loot-style'; style.textContent = CSS; document.head.appendChild(style);
    labelBox = document.createElement('div'); labelBox.id = 'loot-labels'; labelBox.setAttribute('aria-hidden', 'true');
    const hud = document.getElementById('hud'); (hud || document.body).insertBefore(labelBox, (hud || document.body).firstChild);
    labelPool = [];
    for (let n = 0; n < MAX_LABELS; n++) {
      const el = document.createElement('div'); el.className = 'loot-label'; labelBox.appendChild(el);
      labelPool.push({ el, uid: '', text: '', w: 0, x: -1e4, y: -1e4, o: 0, cls: '', on: false });
    }
    return labelPool;
  }
  function paintLabel(l, text, color, cls) {
    if (l.text !== text) { l.text = text; l.el.textContent = text; l.w = (text.length * 8.3 + 22) * LK; }
    if (l.color !== color) { l.color = color; l.el.style.setProperty('--lc', color); }
    if (l.cls !== cls) { l.cls = cls; l.el.className = 'loot-label' + cls; }
  }
  function hideLabel(l) { if (l.on) { l.on = false; l.o = 0; l.el.style.opacity = '0'; } }

  function prepare() {
    if (atlasTask) return atlasTask;
    const columns = 8, cell = 192, rows = Math.ceil(B.Progression.items.length / columns);
    const canvas = document.createElement('canvas'); canvas.width = columns * cell; canvas.height = rows * cell;
    const ctx = canvas.getContext('2d'), cells = new Map();
    atlasTask = Promise.all(B.Progression.items.map((def, index) => new Promise((resolve, reject) => {
      cells.set(def.id,index);
      const image = new Image();
      image.onload = () => { ctx.drawImage(image,(index%columns)*cell+6,Math.floor(index/columns)*cell+6,cell-12,cell-12); resolve(); };
      // World symbols require transparent model renders; the opaque UI cards remain in the menus.
      const rendered = B.GroundEquipmentThumbnails && B.GroundEquipmentThumbnails[def.id];
      const hasRender = typeof rendered === 'string' && rendered.indexOf('data:image/') === 0;
      let fallback = !hasRender;
      function svgFallback() {
        const svg = B.CharacterUI.gearIcon(def).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ');
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }
      image.onerror = () => {
        if (!fallback) { fallback = true; image.src = svgFallback(); }
        else reject(Error(KabirI18n.t('Ganimet simgesi hazırlanamadı: ')+def.name));
      };
      image.src = hasRender ? rendered : svgFallback();
    }))).then(() => {
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
      atlas = {texture,cells,columns,rows,cell}; return true;
    });
    return atlasTask;
  }
  function create(root, world, services) {
    const {player, progression, chapter, sound, fx, onCollect, emit, isFinalReward, bossDead} = services;
    const pool = labels();
    const group = new T.Group(); group.name = 'EnemyGroundLoot'; root.add(group);
    const owned = [], geometries = [], meshes = [];
    function mesh(geometry, material, colored) {
      geometries.push(geometry);
      const m = new T.InstancedMesh(geometry, material, CAPACITY);
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      if (colored) for (let n=0;n<CAPACITY;n++) m.setColorAt(n,new T.Color(0xffffff));
      m.count = 0; group.add(m); meshes.push(m); return m;
    }
    // All painted equipment symbols share one prepared atlas and one draw call.
    const art = atlas || {texture:new T.Texture(),cells:new Map(),columns:8,rows:11};
    if (!atlas) owned.push(art.texture); // Isolated combat fixtures do not decode browser images.
    const symbolGeometry = new T.PlaneGeometry(1,1), cells = new Float32Array(CAPACITY), fxs = new Float32Array(CAPACITY);
    symbolGeometry.setAttribute('aCell',new T.InstancedBufferAttribute(cells,1).setUsage(T.DynamicDrawUsage));
    symbolGeometry.setAttribute('aFx',new T.InstancedBufferAttribute(fxs,1).setUsage(T.DynamicDrawUsage));
    // The item itself: its transparent-background render cut out and laid on the floor (no plate, no frame). A dark hairline edge keeps it readable
    // on stone; aFx (hover / landing flash / boss reward) brightens it and draws a thin rarity-coloured glow along its silhouette.
    const symbolMaterial = new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
      uniforms:{atlas:{value:art.texture},grid:{value:new T.Vector2(art.columns,art.rows)},texel:{value:new T.Vector2(1/(art.columns*(art.cell||128)),1/(art.rows*(art.cell||128)))}},
      vertexShader:`attribute float aCell;attribute float aFx;uniform vec2 grid;varying vec2 vL;varying vec2 vOrg;varying float vFx;varying vec3 vTint;void main(){
        vL=uv;vOrg=vec2(mod(aCell,grid.x),floor(aCell/grid.x));vFx=aFx;
        #ifdef USE_INSTANCING_COLOR
        vTint=instanceColor;
        #else
        vTint=vec3(1.);
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D atlas;uniform vec2 grid;uniform vec2 texel;varying vec2 vL;varying vec2 vOrg;varying float vFx;varying vec3 vTint;
      vec2 at(vec2 l){return vec2((vOrg.x+l.x)/grid.x,1.-(vOrg.y+1.-l.y)/grid.y);}
      void main(){
        vec4 c=texture2D(atlas,at(vL));float o=0.;
        for(int i=0;i<8;i++){float a=float(i)*.785398;o=max(o,texture2D(atlas,at(vL)+vec2(cos(a),sin(a))*texel*3.).a);}
        float fx=clamp(vFx,0.,1.5),rim=clamp(o-c.a,0.,1.);
        float alpha=max(c.a,rim*(.45+.5*min(fx,1.)));if(alpha<.04)discard;
        vec3 body=c.rgb*(1.32+.45*fx)+vTint*(.04+.10*fx);
        vec3 edge=mix(vec3(.015),vTint*1.5+.12,min(fx,1.));
        gl_FragColor=vec4(mix(edge,body,c.a/max(alpha,.001)),alpha);
      #include <colorspace_fragment>
      }`});
    owned.push(symbolMaterial);
    const symbol = mesh(symbolGeometry,symbolMaterial,true); symbol.name='GroundLootEquipmentSymbols'; symbol.renderOrder = 6;
    // A soft ring-and-pool of rarity light on the floor (no extra lights) plus a dark contact shadow under the floating plate.
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
    const glowContext = glowCanvas.getContext('2d'), glowGradient = glowContext.createRadialGradient(64,64,0,64,64,64);
    glowGradient.addColorStop(0,'rgba(255,255,255,.55)'); glowGradient.addColorStop(.45,'rgba(255,255,255,.22)'); glowGradient.addColorStop(1,'rgba(255,255,255,0)');
    glowContext.fillStyle = glowGradient; glowContext.fillRect(0,0,128,128);
    glowContext.strokeStyle = 'rgba(255,255,255,.14)'; glowContext.lineWidth = 6; glowContext.shadowColor = 'rgba(255,255,255,.6)'; glowContext.shadowBlur = 6; glowContext.beginPath(); glowContext.arc(64,64,45,0,Math.PI*2); glowContext.stroke();
    const glowTexture = new T.CanvasTexture(glowCanvas);
    const glowMaterial = new T.MeshBasicMaterial({color:0xffffff,map:glowTexture,transparent:true,opacity:.30,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}); owned.push(glowMaterial);
    const groundGlow = mesh(new T.PlaneGeometry(1.5,1.5),glowMaterial,true); groundGlow.name = 'GroundLootQualityGlow'; groundGlow.renderOrder = 2;
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const shadowContext = shadowCanvas.getContext('2d'), shadowGradient = shadowContext.createRadialGradient(32,32,0,32,32,32);
    shadowGradient.addColorStop(0,'rgba(255,255,255,.9)'); shadowGradient.addColorStop(.6,'rgba(255,255,255,.35)'); shadowGradient.addColorStop(1,'rgba(255,255,255,0)');
    shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0,0,64,64);
    const shadowTexture = new T.CanvasTexture(shadowCanvas);
    const shadowMaterial = new T.MeshBasicMaterial({color:0x000000,map:shadowTexture,transparent:true,opacity:.5,depthWrite:false,toneMapped:false}); owned.push(shadowMaterial);
    const groundShadow = mesh(new T.PlaneGeometry(1.0,.7),shadowMaterial,false); groundShadow.name = 'GroundLootShadow'; groundShadow.renderOrder = 1;
    // Short, dim light shaft over epic and unique drops only. One additive draw.
    const pillarGeometry = new T.CylinderGeometry(.09,.17,1,14,1,true); pillarGeometry.translate(0,.5,0);
    const pillarMaterial = new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,uniforms:{time:{value:0}},
      vertexShader:`varying float vY;varying vec3 vTint;void main(){vY=uv.y;
        #ifdef USE_INSTANCING_COLOR
        vTint=instanceColor;
        #else
        vTint=vec3(1.);
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float time;varying float vY;varying vec3 vTint;void main(){float a=pow(1.-vY,1.9)*(.8+.2*sin(time*2.2+vY*9.))*smoothstep(0.,.06,vY)*.55;gl_FragColor=vec4(vTint*a,a);
      #include <colorspace_fragment>
      }`});
    owned.push(pillarMaterial);
    const pillar = mesh(pillarGeometry,pillarMaterial,true); pillar.name = 'GroundLootLightPillars'; pillar.renderOrder = 5;
    // Tiny rising glints for rare and better drops (soft dots, additive, billboarded).
    const sparkMaterial = new T.MeshBasicMaterial({color:0xffffff,map:glowTexture,transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}); owned.push(sparkMaterial);
    const SPARKS = [0,0,2,3,4];
    const sparkle = (function(){ const g = new T.PlaneGeometry(.12,.12); geometries.push(g); const m = new T.InstancedMesh(g,sparkMaterial,CAPACITY*4);
      m.frustumCulled=false; m.castShadow=m.receiveShadow=false; for(let n=0;n<CAPACITY*4;n++)m.setColorAt(n,new T.Color(0xffffff)); m.count=0; m.renderOrder=7; m.name='GroundLootSparkles'; group.add(m); return m; }());
    const PILLAR = { epic: 1.5, boss: 2.0 }, pillarGold = new T.Color(.9, .62, .2);
    const tint2 = new T.Color(), object = new T.Object3D(); object.rotation.order = 'YXZ'; const SIZE = {weapon:.7,chest:.62,head:.55,hands:.5,boots:.5};
    const hashOf = s => { let h = 7; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0; return h; };
    const  color = new T.Color(), tint = new T.Color(), motion = new Map(), v3 = new T.Vector3();
    const vis = new Array(CAPACITY).fill(null), cand = new Int16Array(CAPACITY), prio = new Float32Array(CAPACITY);
    const rx = new Float32Array(MAX_LABELS), ry = new Float32Array(MAX_LABELS), rw = new Float32Array(MAX_LABELS);
    let clock = 0, frame = 0, disposed = false, picked = 0, visCount = 0, hoverUid = '', fullAt = -9, labelCount = 0;
    const pickResult = { drop: null, score: 0 };
    const hop = a => a < FALL ? 4.4 * (a / FALL) * (1 - a / FALL) : a < FALL + .17 ? 1.04 * ((a - FALL) / .17) * (1 - (a - FALL) / .17) : a < FALL + .27 ? .28 * ((a - FALL - .17) / .1) * (1 - (a - FALL - .17) / .1) : 0;
    const clear = (x, z) => !world.hasClearPath || world.hasClearPath(player.x, player.z, x, z, .08);
    const find = uid => progression.groundLoot.find(d => d.uid === uid && d.chapter === chapter) || null;
    function bagFull(drop) { return !drop.boss && progression.bagFull && progression.bagFull(); }
    function warnFull() {
      if (clock - fullAt < 2) return; fullAt = clock;
      if (emit) emit('toast', { text: L('Çanta dolu. Yer açmadan bu eşyayı alamazsın.') });
    }
    // Starts the fly-to-bag: the item is added to the bag when it arrives (update). false = it stays on the ground (bag full / unknown).
    function take(uid) {
      const m = motion.get(uid), drop = m && m.drop;
      if (!m || m.flying || !drop || drop.chapter !== chapter) return false;
      if (bagFull(drop)) { warnFull(); return false; }
      m.flying = true; return true;
    }
    // E: the nearest item within `reach` metres. Returns true when there was one (even if the bag was full), so the key is consumed.
    function takeNearest(x, z, reach) {
      let best = null, bd = (reach || TAKE_KEY);
      for (const drop of progression.groundLoot) {
        if (drop.chapter !== chapter) continue;
        const m = motion.get(drop.uid); if (!m || m.flying || m.age < LANDED * .6) continue;
        const d = Math.hypot(drop.x - x, drop.z - z);
        if (d <= bd && clear(drop.x, drop.z)) { bd = d; best = drop; }
      }
      if (!best) return false;
      take(best.uid); return true;
    }
    function setHover(uid) { hoverUid = uid || ''; }
    // The item (or its name label) under the cursor: screen-space test against the plates measured in the last update. score < 0 = inside.
    function pick(cx, cy, soft) {
      let best = null, bs = 1e9;
      for (let k = 0; k < visCount; k++) {
        const m = vis[k]; if (!m || m.flying || m.age < FALL) continue;
        const dx = Math.abs(cx - m.sx), dy = Math.abs(cy - m.sy), hit = Math.max(m.sr * 1.1, 20);
        let s = Math.max(dx, dy) - hit;
        if (m.labeled) { const ox = Math.max(m.lx - cx, 0, cx - (m.lx + m.lw)), oy = Math.max(m.ly - cy, 0, cy - (m.ly + LABEL_H)); const sl = ox || oy ? Math.hypot(ox, oy) : -1; if (sl < s) s = sl; }
        if (s < bs) { bs = s; best = m; }
      }
      if (!best || bs > (soft || 14)) return null;
      pickResult.drop = best.drop; pickResult.score = bs; return pickResult;
    }
    function update(dt) {
      if (disposed) return;
      clock += dt; frame++; let count = 0, pillars = 0, hopMax = 0, sparks = 0; visCount = 0; pillarMaterial.uniforms.time.value = clock;
      const drops = progression.groundLoot, camera = B.app && B.app.camera, auto = B.GroundLoot.auto, dead = bossDead ? bossDead() : false;
      const W = window.innerWidth, H = window.innerHeight;
      let ve = null, pe = null;
      if (camera) { ve = camera.matrixWorldInverse.elements; pe = camera.projectionMatrix.elements; }
      // Iterate backwards because collecting removes one authoritative pending entry.
      for (let i=drops.length-1;i>=0;i--) {
        const drop=drops[i]; if (drop.chapter!==chapter) continue;
        const def=B.Progression.catalog[drop.id]; if(!def)continue;
        const quality=B.Progression.qualities[def.rarity];
        let m=motion.get(drop.uid);
        if (!m) {
          m={age:drop.fresh===true?0:9,flight:0,flying:false,landed:drop.fresh!==true,flash:0,hl:0,seen:0,wait:0,drop,reward:false,labeled:false,sx:0,sy:0,sr:0,lx:0,ly:0,lw:0,rank:quality.rank,label:null,yaw:((hashOf(drop.uid)&255)/255-.5)*1.5+(def.slot==='weapon'?.5:0),size:SIZE[def.slot]||.9};
          motion.set(drop.uid,m);
          if(sound&&(drop.boss||def.rarity==='boss'))sound('gearUniqueDrop',{x:drop.x,z:drop.z});
        }
        m.seen=frame; m.drop=drop; m.age+=dt;
        const a=m.age, distance=Math.hypot(player.x-drop.x,player.z-drop.z);
        if (!m.landed && a>=FALL) { m.landed=true; m.flash=1; if(sound&&!(drop.boss||def.rarity==='boss'))sound('lootDrop',{x:drop.x,z:drop.z,rarity:def.rarity}); }
        m.flash=Math.max(0,m.flash-dt*2.6);
        const reward = !!(isFinalReward && isFinalReward(drop)); m.reward = reward;
        if (!m.flying) {
          if (auto && a>=(drop.boss?BOSS_DELAY:DELAY) && distance<=(drop.boss?BOSS_REACH:REACH) && clear(drop.x,drop.z)) take(drop.uid);
          // No deadlock: the chapter's boss reward is the one thing the story waits for, so if it is still lying there a while after the boss fell, a hero standing by takes it.
          if (reward && dead) { m.wait+=dt; if (m.wait>=FALLBACK_WAIT && distance<=FALLBACK_REACH && clear(drop.x,drop.z)) take(drop.uid); }
        }
        const target = (drop.uid===hoverUid ? 1 : 0); m.hl += (target-m.hl)*Math.min(1,dt*16);
        const base=world.effectHeightAt?world.effectHeightAt(drop.x,drop.z,.4):.06;
        const lift = a<FALL+.3 ? hop(a) : 0; if (lift>hopMax) hopMax=lift;
        let x=drop.x,z=drop.z,y=base+.16+(a<FALL+.3?0:Math.sin(clock*2.7+i)*.02)+lift,scale=a<.14?.5+.65*(a/.14):a<.3?1.15-.15*((a-.14)/.16):1;
        if (m.flying) {
          m.flight+=dt; const u=Math.min(1,m.flight/FLIGHT),k=u*u*(3-2*u);
          x=drop.x+(player.x-drop.x)*k; z=drop.z+(player.z-drop.z)*k;
          y+=Math.sin(u*Math.PI)*.7+u*.6; scale*=1-.55*u;
          if (u>=1) {
            const got = progression.collectLoot(drop.uid);
            if (!got) { m.flying=false; m.flight=0; warnFull(); }
            else { if(onCollect)onCollect(); motion.delete(drop.uid); picked++;
              if(sound)sound('lootPickup',{x:player.x,z:player.z,rarity:def.rarity,signature:drop.boss,weaponType:def.type,slot:def.slot});
              if(fx)fx('lootCollect',{x:player.x,y:1,z:player.z,color:quality.color,rarity:def.rarity,signature:drop.boss});
              continue; }
          }
        }
        if (count>=CAPACITY || !m.flying && distance>28) { m.labeled=false; continue; }
        color.set(quality.color);
        const cy=y+.16, rewardPulse = reward ? .3+.2*Math.sin(clock*4.2) : 0;
        object.position.set(x,cy,z); object.rotation.set(-.95,m.yaw*.6,0);
        object.scale.setScalar(scale*m.size); object.updateMatrix(); symbol.setMatrixAt(count,object.matrix);
        cells[count]=art.cells.get(drop.id)||0; fxs[count]=m.hl+m.flash*1.3+rewardPulse; symbol.setColorAt(count,color);
        // ground ring (rarity coloured, brighter for higher rarity; a one-time ring of light on landing)
        const ring = m.flying ? 0 : scale*(1+.55*Math.sin((1-m.flash)*Math.PI)*(m.flash>0?1:0)+.08*m.hl+rewardPulse*.4);
        tint.copy(color).multiplyScalar(GLOW_K[quality.rank]*(1+m.flash*2+m.hl*.6+rewardPulse));
        object.position.set(x,base+.02,z); object.rotation.set(-Math.PI/2,0,0); object.scale.setScalar(ring); object.updateMatrix();
        groundGlow.setMatrixAt(count,object.matrix); groundGlow.setColorAt(count,tint);
        object.position.set(x,base+.012,z); object.rotation.set(-Math.PI/2,m.yaw,0); object.scale.setScalar(m.flying?0:scale*m.size*(1-Math.min(.5,lift*.4))); object.updateMatrix(); groundShadow.setMatrixAt(count,object.matrix);
        const ph = drop.boss ? PILLAR.boss : PILLAR[def.rarity] || 0;
        if (ph && !m.flying) { object.position.set(x,base,z); object.rotation.set(0,0,0); const wide=drop.boss||def.rarity==='boss'?1.1:1; object.scale.set(wide,ph*Math.min(1,a/.35),wide); object.updateMatrix(); pillar.setMatrixAt(pillars,object.matrix); pillar.setColorAt(pillars,wide>1?pillarGold:color); pillars++; }
        const nsp = m.flying || a<FALL ? 0 : SPARKS[quality.rank];
        for (let q = 0; q < nsp; q++) { const ph=(clock*.45+q/nsp+(m.yaw+1)*.37)%1, ang=q*2.4+m.yaw*5;
          object.position.set(x+Math.cos(ang)*.45*(.4+ph*.6)*m.size*.6,base+.12+ph*.9,z+Math.sin(ang)*.35*m.size*.6);
          if (camera) object.quaternion.copy(camera.quaternion); object.scale.setScalar(Math.sin(ph*Math.PI)*(1+.3*m.hl)); object.updateMatrix();
          sparkle.setMatrixAt(sparks,object.matrix); sparkle.setColorAt(sparks,tint2.copy(color).multiplyScalar(1.3)); sparks++; }
        // screen measurements for hit-testing and labels (no allocation)
        m.labeled=false;
        if (ve && !m.flying) {
          const vz=ve[2]*x+ve[6]*cy+ve[10]*z+ve[14];
          if (vz<-.2) {
            const w=-vz, vx=ve[0]*x+ve[4]*cy+ve[8]*z+ve[12], vy=ve[1]*x+ve[5]*cy+ve[9]*z+ve[13];
            m.sx=(pe[0]*vx/w*.5+.5)*W; m.sy=(-pe[5]*vy/w*.5+.5)*H; m.sr=H*.5*pe[5]/w*.45*scale*m.size;
            if (m.sx>-60&&m.sx<W+60&&m.sy>-60&&m.sy<H+60) vis[visCount++]=m;
          }
        }
        count++;
      }
      motion.forEach(sweep, frame);
      for (const mesh of meshes) { mesh.count=count; mesh.instanceMatrix.needsUpdate=true; if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true; }
      pillar.count=pillars; sparkle.count=sparks; sparkle.instanceMatrix.needsUpdate=true; if(sparkle.instanceColor)sparkle.instanceColor.needsUpdate=true;
      symbolGeometry.attributes.aCell.needsUpdate=true; symbolGeometry.attributes.aFx.needsUpdate=true; group.visible=count>0;
      layoutLabels();
    }
    function sweep(m, uid) { if (m.seen !== frame) motion.delete(uid); }
    // Names above the icons in their rarity colour, de-overlapped (a label that would collide climbs above the one in its way), faded with distance.
    function layoutLabels() {
      const k = Math.max(1, Math.min(1.3, (window.innerWidth || 1920) / 2133));
      if (Math.abs(k - LK) > .02) { LK = k; LABEL_H = Math.round(LABEL_BASE * k); if (labelBox) labelBox.style.setProperty('--lk', k.toFixed(3)); for (const l of pool) l.text = ''; }
      const all = !!B.GroundLoot.labelsHeld, mx = player.x, mz = player.z; let n = 0;
      for (let k = 0; k < visCount; k++) {
        const m = vis[k], drop = m.drop, hot = m.hl > .3 || m.reward, d = Math.hypot(drop.x - mx, drop.z - mz);
        if (m.age < FALL + .1) continue;
        if (!(hot || all || m.rank >= 1)) continue;
        if (!hot && d > 21) continue;
        cand[n] = k; prio[k] = (m.reward ? 1e4 : 0) + (m.hl > .3 ? 5e3 : 0) + m.rank * 100 - d; n++;
      }
      // insertion sort by priority (descending), n <= CAPACITY
      for (let a = 1; a < n; a++) { const c = cand[a], p = prio[c]; let b = a - 1; while (b >= 0 && prio[cand[b]] < p) { cand[b + 1] = cand[b]; b--; } cand[b + 1] = c; }
      let used = 0;
      for (let a = 0; a < n && used < MAX_LABELS; a++) {
        const m = vis[cand[a]], drop = m.drop, def = B.Progression.catalog[drop.id], l = pool[used];
        const hot = m.hl > .3 || m.reward;
        const name = L(def.name), cls = (m.hl > .3 ? ' hl' : '') + (m.reward ? ' reward' : '');
        paintLabel(l, name, B.Progression.qualities[def.rarity].color, cls);
        const w = l.w; let x = m.sx - w / 2, y = m.sy - m.sr - 5 - LABEL_H;
        for (let pass = 0; pass < 12; pass++) {
          let hit = -1;
          for (let j = 0; j < used; j++) if (x < rx[j] + rw[j] && x + w > rx[j] && y < ry[j] + LABEL_H && y + LABEL_H > ry[j]) { hit = j; break; }
          if (hit < 0) break; y = ry[hit] - LABEL_H - 1;
        }
        rx[used] = x; ry[used] = y; rw[used] = w;
        m.labeled = true; m.lx = x; m.ly = y; m.lw = w;
        const d = Math.hypot(drop.x - mx, drop.z - mz), o = hot ? 1 : Math.max(0, Math.min(1, (21 - d) / 6));
        l.on = true;
        if (Math.abs(l.x - x) > .4 || Math.abs(l.y - y) > .4) { l.x = x; l.y = y; l.el.style.transform = 'translate(' + (x | 0) + 'px,' + (y | 0) + 'px)'; }
        if (Math.abs(l.o - o) > .03) { l.o = o; l.el.style.opacity = o.toFixed(2); }
        used++;
      }
      for (let j = used; j < MAX_LABELS; j++) hideLabel(pool[j]);
      labelCount = used;
    }
    function reset() { motion.clear(); clock=0; visCount=0; for(const m of meshes)m.count=0; sparkle.count=0; group.visible=false; for (const l of pool) hideLabel(l); }
    function dispose() { if(disposed)return;disposed=true;motion.clear();for (const l of pool) hideLabel(l);for(const m of meshes)m.dispose();sparkle.dispose();for(const g of geometries)g.dispose();for(const m of owned)m.dispose();glowTexture.dispose();shadowTexture.dispose();group.removeFromParent(); }
    return {update,reset,dispose,take,takeNearest,pick,find,setHover,
      stats:()=>({pending:progression.groundLoot.filter(i=>i.chapter===chapter).length,visible:symbol.count,picked,draws:meshes.length,labels:labelCount,motion:motion.size}),
      screen:uid=>{const m=motion.get(uid);return m?{x:m.sx,y:m.sy,r:m.sr,age:m.age,lx:m.lx,ly:m.ly,lw:m.lw,labeled:m.labeled,flying:m.flying,hl:m.hl}:null;},
      reach:REACH,takeReach:TAKE_REACH};
  }
  // Called by the warm-up on a clone of the HUD: shows the label styles (shadows, gradient) once so their first real paint is not a hitch.
  function warmLabels(box) { if (!box) return; for (const el of box.children) { el.style.opacity = '1'; el.style.setProperty('--lc', '#b394ce'); el.textContent = 'Kemik Ayini'; el.classList.add('hl', 'reward'); } }
  B.GroundLoot={create,prepare,warmLabels,auto:false,labelsHeld:false,TAKE_REACH,TAKE_KEY};
}());
