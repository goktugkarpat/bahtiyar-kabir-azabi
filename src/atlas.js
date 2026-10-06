/* KABİR AZABI — explored cartography from the actual collision footprint, never a room-box diagram. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const TITLES = [KabirI18n.t('Kurban Tapınağı'), KabirI18n.t('Boğulmuş Kıyı'), KabirI18n.t('Sessiz Taht'), KabirI18n.t('Kızıl Ocak'), KabirI18n.t('Son Mahkeme')];
  const STORAGE = 'kabir-azabi-atlas-v1';
  function node(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function create(options) {
    const world = options.world, game = options.game, chapter = Math.max(1, Math.min(TITLES.length, world.chapter || game.chapter || 1));
    const rooms = world.rooms || [], visited = new Set(), seenIds = new Set(rooms.map(r => String(r.id)));
    let opened = false, disposed = false, timer = 0, camera = { x: game.player.x, z: game.player.z, scale: 4 }, dragging = null;
    let campaign = null, lastReset = -1, version = 0, drawnVersion = -1, floorPath = null, reveals = null, previousFocus = null, lastLedger = null;
    let width = 1, height = 1, pixelRatio = 1, fitOnce = false, fitted = false;
    let record = { version: 1, campaign: null, chapters: {} };
    const element = node('div', 'screen modal hidden'); element.id = 'atlas'; element.setAttribute('role', 'dialog'); element.setAttribute('aria-modal', 'true'); element.setAttribute('aria-labelledby', 'atlas-title');
    const panel = node('div', 'panel atlas-panel'), head = node('header', 'panel-head'), titleBlock = node('div');
    titleBlock.append(node('span', 'eyebrow', KabirI18n.t('KABİR AZABI'))); const title = node('h2', '', TITLES[chapter - 1]); title.id = 'atlas-title'; titleBlock.append(title);
    const closeButton = node('button', 'close', '×'); closeButton.type = 'button'; closeButton.setAttribute('aria-label', KabirI18n.t('Haritayı kapat')); closeButton.onclick = () => options.onClose ? options.onClose() : close(); head.append(titleBlock, closeButton);
    const workspace = node('div', 'atlas-workspace'), map = node('div', 'atlas-map'), canvas = node('canvas', 'atlas-canvas'); canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', KabirI18n.t('Keşfettiğin yolların haritası. Sürükleyerek gez, tekerlekle yakınlaştır.'));
    const controls = node('div', 'atlas-controls');
    function button(text, name, action) { const e = node('button', '', text); e.type = 'button'; e.setAttribute('aria-label', name); e.onclick = action; controls.append(e); return e; }
    button('−', KabirI18n.t('Haritayı uzaklaştır'), () => zoom(.8)); button('+', KabirI18n.t('Haritayı yakınlaştır'), () => zoom(1.25));
    button('◎', KabirI18n.t('Bahtiyar’a dön'), () => { camera.x = game.player.x; camera.z = game.player.z; fitted = false; draw(); }); button('↔', KabirI18n.t('Keşfedilen yolları sığdır'), () => fit(false));
    const compass = node('div', 'atlas-compass'); compass.setAttribute('aria-hidden', 'true'); compass.innerHTML = '<span>K</span><svg viewBox="0 0 100 100"><path d="M50 9 57 43 91 50 57 57 50 91 43 57 9 50 43 43Z" fill="none" stroke="currentColor"/><path d="M50 9 50 50 43 43Z" fill="currentColor"/><circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" opacity=".5"/><circle cx="50" cy="50" r="4" fill="currentColor"/></svg>';
    const instructions = node('p', 'atlas-instructions', KabirI18n.t('Sürükle · Yakınlaştır · M ile dön'));
    map.append(canvas, controls, compass, instructions);
    const aside = node('aside', 'atlas-ledger'), hereHeading = node('h3', '', KabirI18n.t('Bulunduğun yer')), here = node('p', 'atlas-here'), knowledge = node('small', 'atlas-knowledge');
    const goalHeading = node('h3', '', KabirI18n.t('İzlenen yeminler')), goals = node('div', 'atlas-goals');
    const landmarkHeading = node('h3', '', KabirI18n.t('Yakındaki duraklar')), landmarks = node('div', 'atlas-landmarks');
    const legend = node('div', 'atlas-legend'); legend.innerHTML = KabirI18n.t('<span><i class="atlas-symbol hero"></i>Bahtiyar</span><span><i class="atlas-symbol oath"></i>Yemin taşı</span><span><i class="atlas-symbol quest"></i>Görev izi</span>');
    aside.append(hereHeading, here, knowledge, goalHeading, goals, landmarkHeading, landmarks, legend); workspace.append(map, aside);
    const footer = node('footer'), note = node('p', 'atlas-note', KabirI18n.t('Yalnızca gördüğün yollar ve tanıdığın yerler işlenir.'));
    const done = node('button', 'btn small', KabirI18n.t('Oyuna dön')); done.type = 'button'; done.onclick = closeButton.onclick; footer.append(note, done); panel.append(head, workspace, footer); element.append(panel);
    const context = canvas.getContext('2d');
    const grain = document.createElement('canvas'); grain.width = grain.height = 192; const gx = grain.getContext('2d'), image = gx.createImageData(192, 192); let seed = chapter * 7919 + 31;
    for (let i = 0; i < image.data.length; i += 4) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; const a = ((seed >>> 24) - 128) * .035; image.data[i] = 35 + a; image.data[i + 1] = 32 + a; image.data[i + 2] = 26 + a; image.data[i + 3] = 255; } gx.putImageData(image, 0, 0);
    const bounds = rooms.reduce((b, r) => ({ x0: Math.min(b.x0, r.x - r.w / 2 - 5), z0: Math.min(b.z0, r.z - r.d / 2 - 5), x1: Math.max(b.x1, r.x + r.w / 2 + 5), z1: Math.max(b.z1, r.z + r.d / 2 + 5) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
    const step = .6, columns = Math.ceil((bounds.x1 - bounds.x0) / step), rows = Math.ceil((bounds.z1 - bounds.z0) / step), count = columns * rows;
    let footprint = null, roomIndex = null;
    function readCampaign() {
      if (lastReset === game.resetSerial && campaign !== null) return;
      lastReset = game.resetSerial;
      const snapshot = game.progression && game.progression.snapshot ? game.progression.snapshot() : null;
      const key = String(options.campaignKey === undefined ? snapshot && snapshot.lootSeed !== undefined ? snapshot.lootSeed : 'legacy' : typeof options.campaignKey === 'function' ? options.campaignKey() : options.campaignKey);
      const changed = key !== campaign, knownBefore = visited.size;
      if (changed) {
        campaign = key; visited.clear();
        try { const saved = JSON.parse(localStorage.getItem(STORAGE)); record = saved && saved.version === 1 && String(saved.campaign) === key && saved.chapters && typeof saved.chapters === 'object' ? saved : { version: 1, campaign: key, chapters: {} }; } catch (_) { record = { version: 1, campaign: key, chapters: {} }; }
        const stored = record.chapters[chapter]; if (Array.isArray(stored)) for (const id of stored.slice(0, 64)) if (seenIds.has(String(id))) visited.add(String(id));
      }
      // Prior versions did not save exploration. A discovered late checkpoint certifies the main route to that checkpoint, never optional side rooms.
      if (game.checkpointIndex && world.checkpoint) for (const r of rooms) if (Math.abs(r.x - world.checkpoint.x) < 11 && r.z >= world.checkpoint.z - 3) visited.add(String(r.id));
      // A dead encounter is also evidence that its room was visited.
      for (const encounter of world.encounters || []) {
        const enemies = (game.enemies || []).filter(e => !e.reserve && (e.encounter === encounter || e.encounter === encounter.id || e.encounter && e.encounter.id === encounter.id || e.encounterId === encounter.id));
        if (enemies.length && enemies.every(e => e.dead)) visited.add(String(encounter.room));
      }
      if (changed || visited.size !== knownBefore) { version++; fitOnce = false; }
    }
    function persist() { record.chapters[chapter] = Array.from(visited); try { localStorage.setItem(STORAGE, JSON.stringify(record)); } catch (_) {} }
    function explore() {
      readCampaign(); const p = game.player;
      for (const r of rooms) {
        if (Math.abs(p.x - r.x) > r.w / 2 + .5 || Math.abs(p.z - r.z) > r.d / 2 + .5) continue;
        const id = String(r.id); if (!visited.has(id)) { visited.add(id); version++; persist(); }
      }
    }
    function sample() {
      if (footprint) return;
      const start = performance.now(); footprint = new Uint8Array(count); roomIndex = new Int16Array(count); roomIndex.fill(-1);
      for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) {
        const wx = bounds.x0 + (x + .5) * step, wz = bounds.z0 + (z + .5) * step, index = z * columns + x;
        if (!world.isWalkable || !world.isWalkable(wx, wz, .12)) continue;
        footprint[index] = 1; let nearest = -1, distance = Infinity;
        for (let i = 0; i < rooms.length; i++) { const r = rooms[i], dx = Math.max(0, Math.abs(wx - r.x) - r.w / 2), dz = Math.max(0, Math.abs(wz - r.z) - r.d / 2), d = dx * dx + dz * dz; if (d < distance) { nearest = i; distance = d; } }
        roomIndex[index] = nearest;
      }
      element.dataset.sampleMs = (performance.now() - start).toFixed(1);
    }
    function rebuild() {
      sample(); if (drawnVersion === version && floorPath) return;
      drawnVersion = version; reveals = new Uint8Array(count);
      for (let i = 0; i < count; i++) reveals[i] = footprint[i] && roomIndex[i] >= 0 && visited.has(String(rooms[roomIndex[i]].id)) ? 1 : 0;
      const at = (x, z) => x >= 0 && z >= 0 && x < columns && z < rows ? reveals[z * columns + x] : 0;
      const edges = new Map(); let edgeCount = 0;
      function edge(ax, az, bx, bz) { const key = az * (columns + 1) + ax, list = edges.get(key) || []; list.push([bx, bz]); edges.set(key, list); edgeCount++; }
      for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) if (at(x, z)) {
        if (!at(x, z - 1)) edge(x, z, x + 1, z); if (!at(x + 1, z)) edge(x + 1, z, x + 1, z + 1);
        if (!at(x, z + 1)) edge(x + 1, z + 1, x, z + 1); if (!at(x - 1, z)) edge(x, z + 1, x, z);
      }
      floorPath = new Path2D(); let loops = 0;
      while (edges.size) {
        const first = edges.keys().next().value, start = [first % (columns + 1), Math.floor(first / (columns + 1))], points = [start]; let current = start, limit = edgeCount + 2;
        while (limit-- > 0) { const key = current[1] * (columns + 1) + current[0], list = edges.get(key); if (!list || !list.length) break; const next = list.pop(); if (!list.length) edges.delete(key); points.push(next); current = next; if (next[0] === start[0] && next[1] === start[1]) break; }
        if (points.length < 4) continue; loops++; points.pop();
        const last = points[points.length - 1], firstPoint = points[0];
        floorPath.moveTo(bounds.x0 + (last[0] + firstPoint[0]) * step / 2, bounds.z0 + (last[1] + firstPoint[1]) * step / 2);
        for (let i = 0; i < points.length; i++) { const p = points[i], next = points[(i + 1) % points.length]; floorPath.quadraticCurveTo(bounds.x0 + p[0] * step, bounds.z0 + p[1] * step, bounds.x0 + (p[0] + next[0]) * step / 2, bounds.z0 + (p[1] + next[1]) * step / 2); } floorPath.closePath();
      }
      element.dataset.contours = String(loops); element.dataset.explored = String(visited.size);
    }
    // The HUD uses the same cached explored collision contours. Preparing never
    // explores: the loading room tour must not disclose rooms the hero has not visited.
    function prepareTerrain() { if (!disposed) rebuild(); }
    function drawTerrain(ctx) {
      if (disposed) return false;
      rebuild();
      ctx.lineJoin = 'round'; ctx.strokeStyle = '#b49b6526'; ctx.lineWidth = 1.15; ctx.stroke(floorPath);
      ctx.fillStyle = '#413c2d'; ctx.fill(floorPath, 'evenodd');
      ctx.strokeStyle = '#ad96698c'; ctx.lineWidth = .19; ctx.stroke(floorPath);
      ctx.strokeStyle = '#e0c59138'; ctx.lineWidth = .065; ctx.stroke(floorPath);
      return true;
    }
    function fit(nearby = false) {
      let known = rooms.filter(r => visited.has(String(r.id))); if (!known.length) return;
      if (nearby) { const local = known.filter(r => Math.hypot(r.x-game.player.x,r.z-game.player.z) < 65); if (local.length) known = local; }
      const b = known.reduce((v, r) => ({ x0: Math.min(v.x0, r.x - r.w / 2), z0: Math.min(v.z0, r.z - r.d / 2), x1: Math.max(v.x1, r.x + r.w / 2), z1: Math.max(v.z1, r.z + r.d / 2) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
      camera.x = (b.x0 + b.x1) / 2; camera.z = (b.z0 + b.z1) / 2; camera.scale = Math.max(1.1, Math.min(24, (width - 110) / (b.x1 - b.x0 + 8), (height - 100) / (b.z1 - b.z0 + 8))); fitOnce = true; fitted = nearby ? 'nearby' : 'all'; draw();
    }
    function zoom(factor, x, y) {
      const old = camera.scale, next = Math.max(1.1, Math.min(24, old * factor));
      if (x !== undefined && y !== undefined) { camera.x += (x - width / 2) * (1 / old - 1 / next); camera.z += (y - height / 2) * (1 / old - 1 / next); }
      camera.scale = next; fitted = false; draw();
    }
    function mark(wx, wz, kind, numeral) {
      const x = (wx - camera.x) * camera.scale + width / 2, y = (wz - camera.z) * camera.scale + height / 2;
      if (x < 10 || y < 10 || x > width - 10 || y > height - 10) return;
      context.save(); context.translate(x, y);
      if (kind === 'hero') { const halo = context.createRadialGradient(0,0,3,0,0,28); halo.addColorStop(0,'#e7cd944c');halo.addColorStop(1,'#e7cd9400');context.fillStyle=halo;context.fillRect(-28,-28,56,56);context.strokeStyle='#d3b783a8';context.lineWidth=.9;context.beginPath();context.arc(0,0,15,0,Math.PI*2);context.stroke(); }
      context.fillStyle = kind === 'hero' ? '#eedbb5' : kind === 'oath' ? '#b5c2a1' : '#d8b57a'; context.strokeStyle = '#151512'; context.lineWidth = 2;
      context.beginPath();
      if (kind === 'hero') { context.rotate(-game.player.face); context.moveTo(0, 9); context.lineTo(-6, -5); context.lineTo(0, -2); context.lineTo(6, -5); }
      else { context.moveTo(0, -8); context.lineTo(7, 0); context.lineTo(0, 8); context.lineTo(-7, 0); }
      context.closePath(); context.fill(); context.stroke();
      if (numeral) { context.fillStyle = '#141410';context.strokeStyle='#c5a770';context.lineWidth=1;context.beginPath();context.arc(0,0,13,0,Math.PI*2);context.fill();context.stroke();context.fillStyle = '#ebd0a2'; context.font = 'bold 12px Georgia'; context.textAlign = 'center'; context.fillText(numeral, 0, 4); }
      context.restore();
    }
    function ledger() {
      const reward = game.pendingBossReward || null, r = world.roomAt && world.roomAt(game.player.x, game.player.z); const key = String(r && r.id) + ':' + version + ':' + (game.quests ? game.quests.revision : -1) + ':' + (reward ? reward.uid : ''); if (key === lastLedger) return;lastLedger=key; here.textContent = r ? r.name : TITLES[chapter - 1]; knowledge.textContent = visited.size + KabirI18n.t(' keşfedilen durak');
      goals.replaceChildren();
      const quests = game.quests;
      goalHeading.textContent = reward ? KabirI18n.t('Zafer emaneti') : quests && quests.ready ? KabirI18n.t('Sonraki hedef') : KabirI18n.t('İzlenen yeminler');
      function goal(name, objective, complete, onMap) {
        const block = node(typeof onMap === 'function' || typeof options.onJournal === 'function' ? 'button' : 'div', 'atlas-goal');
        if (complete) block.classList.add('complete');
        if (typeof onMap === 'function') { block.type = 'button'; block.onclick = onMap; block.setAttribute('aria-label', name + KabirI18n.t(' · Emanete odaklan')); }
        else if (typeof options.onJournal === 'function') { block.type = 'button'; block.onclick = () => { close(false); options.onJournal(); }; block.setAttribute('aria-label', name + KabirI18n.t(' · Görev günlüğünü aç')); }
        block.append(node('strong', '', name), node('p', '', objective)); goals.append(block);
      }
      if (reward) {
        const item = B.Progression && Array.isArray(B.Progression.items) && B.Progression.items.find(def => def.id === reward.id);
        const rewardRoom = Number.isFinite(reward.x) && Number.isFinite(reward.z) && world.roomAt && world.roomAt(reward.x, reward.z);
        goal(item && item.name || KabirI18n.t('Zafer emaneti'), KabirI18n.t('Efendi yenildi. Emanetine yaklaş.'), false, () => {
          if (!rewardRoom || !visited.has(String(rewardRoom.id))) return;
          camera.x = reward.x; camera.z = reward.z; fitted = false; draw(); canvas.focus({preventScroll:true});
        });
      } else if (quests && quests.ready) goal(KabirI18n.t('Efendinin kapısı açık'), quests.objective, false);
      else for (const entry of quests && quests.entries || []) goal(entry.name, entry.complete ? KabirI18n.t('Bağ çözüldü') : entry.objective, entry.complete);
      const nearby = rooms.filter(room => visited.has(String(room.id))).sort((a, b) => Math.hypot(a.x-game.player.x,a.z-game.player.z)-Math.hypot(b.x-game.player.x,b.z-game.player.z)).slice(0, 6); landmarks.replaceChildren();
      for (const room of nearby) { const b = node('button', '', room.name); b.type = 'button'; if (r === room) b.classList.add('here'); b.onclick = () => { camera.x = room.x; camera.z = room.z; camera.scale = Math.max(camera.scale, 4); fitted = false; draw(); }; landmarks.append(b); }
    }
    function draw() {
      if (!opened || disposed || width < 2 || height < 2) return;
      rebuild(); context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); context.clearRect(0,0,width,height);
      context.fillStyle = '#171812'; context.fillRect(0,0,width,height);context.globalAlpha=.28;context.fillStyle=context.createPattern(grain,'repeat');context.fillRect(0,0,width,height);context.globalAlpha=1;
      const background = context.createRadialGradient(width*.48,height*.48,0,width*.5,height*.5,Math.max(width,height)*.72); background.addColorStop(0,'#292a2240');background.addColorStop(1,'#070908b0'); context.fillStyle=background;context.fillRect(0,0,width,height);
      context.save(); context.translate(width/2,height/2);context.scale(camera.scale,camera.scale);context.translate(-camera.x,-camera.z);
      // Fine double engraving follows real walkable boundaries, with internal pillar/rubble holes retained.
      context.strokeStyle='#b49b6520';context.lineWidth=Math.min(1.45,8/camera.scale);context.stroke(floorPath);context.fillStyle='#413c2d';context.fill(floorPath,'evenodd');
      context.save();context.clip(floorPath,'evenodd');const pattern=context.createPattern(grain,'repeat');if(pattern&&pattern.setTransform)pattern.setTransform({a:.05,b:0,c:0,d:.05,e:0,f:0});context.globalAlpha=.72;context.fillStyle=pattern;context.fillRect(bounds.x0,bounds.z0,bounds.x1-bounds.x0,bounds.z1-bounds.z0);context.globalAlpha=1;
      const warmth=context.createRadialGradient(game.player.x,game.player.z,0,game.player.x,game.player.z,22);warmth.addColorStop(0,'#dfbc732c');warmth.addColorStop(1,'#dfbc7300');context.fillStyle=warmth;context.fillRect(bounds.x0,bounds.z0,bounds.x1-bounds.x0,bounds.z1-bounds.z0);
      context.strokeStyle='#b7a17913';context.lineWidth=.10;context.beginPath();for(let z=Math.floor(bounds.z0/2)*2;z<bounds.z1;z+=2){context.moveTo(bounds.x0,z);context.lineTo(bounds.x1,z+(bounds.x1-bounds.x0)*.20);}context.stroke();context.restore();
      context.strokeStyle='#ad966985';context.lineWidth=Math.min(.21,2.2/camera.scale);context.stroke(floorPath);context.strokeStyle='#e0c59138';context.lineWidth=Math.min(.06,.8/camera.scale);context.stroke(floorPath);
      // Structural hatching: rock/column footprints appear as holes in the same surface, not a second box diagram.
      context.restore();context.setTransform(pixelRatio,0,0,pixelRatio,0,0);
      const hereRoom=world.roomAt && world.roomAt(game.player.x,game.player.z);
      const labels=rooms.filter(r=>visited.has(String(r.id))).sort((a,b)=>Math.hypot(a.x-camera.x,a.z-camera.z)-Math.hypot(b.x-camera.x,b.z-camera.z));
      const occupied=[];context.textAlign='center';
      for(const room of labels){const current=room===hereRoom,branch=Math.abs(room.x)>12;context.font=(current?'bold 15px':branch?'italic 12px':'13px')+' Georgia';const x=(room.x-camera.x)*camera.scale+width/2,y=(room.z-room.d*.3-camera.z)*camera.scale+height/2,text=room.name,w=context.measureText(text).width;
        if(x-w/2<15||x+w/2>width-15||y<24||y>height-40||occupied.some(b=>Math.abs(b.x-x)<(b.w+w)/2+12&&Math.abs(b.y-y)<26))continue;
        if(camera.scale<2.5&&room!==hereRoom)continue;occupied.push({x,y,w});context.strokeStyle='#121411';context.lineWidth=4;context.strokeText(text,x,y);context.fillStyle=current?'#f0d5a1':branch?'#aebba3':'#c6af85';context.fillText(text,x,y);
        if(current){context.strokeStyle='#c6a16c88';context.lineWidth=.7;context.beginPath();context.moveTo(x-24,y+8);context.lineTo(x+24,y+8);context.stroke();}
      }
      if(world.checkpoint){const cr=world.roomAt&&world.roomAt(world.checkpoint.x,world.checkpoint.z);if(cr&&visited.has(String(cr.id)))mark(world.checkpoint.x,world.checkpoint.z,'oath');}
      const questMarkers=game.quests&&Array.isArray(game.quests.markers)?game.quests.markers.filter(marker=>marker.active&&!marker.complete):(game.quests&&game.quests.entries||[]).map((entry,quest)=>entry.target&&Object.assign({quest},entry.target)).filter(Boolean);
      for(const target of questMarkers){const r=world.roomAt&&world.roomAt(target.x,target.z);if(r&&visited.has(String(r.id)))mark(target.x,target.z,'quest',target.quest?'II':'I');}
      /* ajan:quests: discovered side threads (hunt target moves) */ for(const target of (game.quests&&game.quests.sideMarkers||[]).filter(m=>m.active&&!m.complete)){const r=world.roomAt&&world.roomAt(target.x,target.z);if(r&&visited.has(String(r.id)))mark(target.x,target.z,'quest',({hunt:'✠',rescue:'⛓',lore:'¶',altar:'♱',chest:'▣',siege:'♨',escape:'➶',puzzle:'⁂'})[target.kind]||'•');}
      const reward=game.pendingBossReward;
      if(reward&&Number.isFinite(reward.x)&&Number.isFinite(reward.z)){const r=world.roomAt&&world.roomAt(reward.x,reward.z);if(r&&visited.has(String(r.id)))mark(reward.x,reward.z,'quest','★');}
      mark(game.player.x,game.player.z,'hero');
      const vignette=context.createRadialGradient(width/2,height/2,Math.min(width,height)*.30,width/2,height/2,Math.max(width,height)*.72);vignette.addColorStop(0,'#08090800');vignette.addColorStop(1,'#080908cc');context.fillStyle=vignette;context.fillRect(0,0,width,height);
      ledger();
    }
    function resize() { const r = map.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; width = Math.round(r.width); height = Math.round(r.height); pixelRatio = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio); if (opened) { if (!fitOnce || fitted) fit(!fitOnce || fitted === 'nearby'); else draw(); } }
    function keydown(e) {
      if (!opened) return;
      if (e.key === 'Escape') {e.preventDefault();e.stopPropagation();options.onClose&&options.onClose();return;}
      if(e.key==='Tab'){const all=Array.from(element.querySelectorAll('button,[tabindex]')).filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length),i=all.indexOf(document.activeElement);if(i<0||(e.shiftKey?i===0:i===all.length-1)){e.preventDefault();all[e.shiftKey?all.length-1:0].focus();}return;}
      if (document.activeElement !== canvas) return;
      if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25);}else if(e.key==='-'){e.preventDefault();zoom(.8);}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();fitted=false;camera.x+=(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)*40/camera.scale;camera.z+=(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)*40/camera.scale;draw();}
    }
    canvas.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();zoom(Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.002),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
    canvas.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button&&e.button!==0)return;canvas.focus({preventScroll:true});dragging={id:e.pointerId,x:e.clientX,y:e.clientY,cx:camera.x,cz:camera.z};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
    canvas.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.id)return;fitted=false;camera.x=dragging.cx-(e.clientX-dragging.x)/camera.scale;camera.z=dragging.cz-(e.clientY-dragging.y)/camera.scale;draw();});
    function release(e){if(dragging&&e.pointerId===dragging.id){dragging=null;canvas.classList.remove('dragging');}}
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
    const observer=new ResizeObserver(resize);observer.observe(map);
    function open() { if(disposed)return;if(opened){explore();draw();return;}const openStart=performance.now();explore();element.classList.remove('hidden');opened=true;previousFocus=document.activeElement;resize();if(!fitOnce)fit(true);else draw();canvas.focus({preventScroll:true});window.addEventListener('keydown',keydown,true);element.dataset.openMs=(performance.now()-openStart).toFixed(1); }
    function close(restore=true) {if(dragging){try{canvas.releasePointerCapture(dragging.id);}catch(_){}dragging=null;canvas.classList.remove('dragging');}opened=false;element.classList.add('hidden');window.removeEventListener('keydown',keydown,true);if(restore&&previousFocus&&previousFocus.isConnected&&previousFocus.getClientRects().length)previousFocus.focus({preventScroll:true});previousFocus=null;}
    function update(dt=0) {if(disposed)return;timer-=Math.max(0,dt);if(timer>0)return;timer=.45;const before=version,reward=game.pendingBossReward,rewardUid=reward?reward.uid:'';explore();if(opened&&(before!==version||game.quests&&game.quests.revision!==lastQuest||rewardUid!==lastReward)){lastQuest=game.quests?game.quests.revision:-1;lastReward=rewardUid;draw();}}
    let lastQuest=-1,lastReward='';
    function clear(){visited.clear();record.chapters[chapter]=[];version++;fitOnce=false;persist();explore();if(opened)fit(true);}
    function dispose(){if(disposed)return;close(false);disposed=true;observer.disconnect();element.remove();footprint=roomIndex=reveals=floorPath=null;}
    explore();
    return {element,open,close,update,clear,dispose,prepareTerrain,drawTerrain,get terrainVersion(){return version;},get explored(){return visited.size;}};
  }
  B.Atlas={create};
})();
