/* KABİR AZABI — visible enemy loot. Prepared instances, proximity pickup, no per-drop GPU allocations. */
(function () {
  'use strict';
  const B = window.BABA, T = window.THREE;
  // Ordinary loot lands before a walking hero passes the magnet; the signature reward keeps its longer reveal.
  const CAPACITY = 96, REACH = 3.25, BOSS_REACH = 5, DELAY = .5, BOSS_DELAY = 1.1, FLIGHT = .32;
  let atlas = null, atlasTask = null;
  function prepare() {
    if (atlasTask) return atlasTask;
    const columns = 8, cell = 128, rows = Math.ceil(B.Progression.items.length / columns);
    const canvas = document.createElement('canvas'); canvas.width = columns * cell; canvas.height = rows * cell;
    const ctx = canvas.getContext('2d'), cells = new Map();
    atlasTask = Promise.all(B.Progression.items.map((def, index) => new Promise((resolve, reject) => {
      cells.set(def.id,index);
      const image = new Image();
      image.onload = () => { ctx.drawImage(image,(index%columns)*cell+8,Math.floor(index/columns)*cell+8,cell-16,cell-16); resolve(); };
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
      atlas = {texture,cells,columns,rows}; return true;
    });
    return atlasTask;
  }
  function create(root, world, services) {
    const {player, progression, chapter, sound, fx, onCollect} = services;
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
    const symbolGeometry = new T.PlaneGeometry(.58,.58), cells = new Float32Array(CAPACITY);
    symbolGeometry.setAttribute('aCell',new T.InstancedBufferAttribute(cells,1).setUsage(T.DynamicDrawUsage));
    const symbolMaterial = new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
      uniforms:{atlas:{value:art.texture},grid:{value:new T.Vector2(art.columns,art.rows)}},
      vertexShader:`attribute float aCell;uniform vec2 grid;varying vec2 vUv;void main(){
        vUv=vec2((mod(aCell,grid.x)+uv.x)/grid.x,1.-(floor(aCell/grid.x)+1.-uv.y)/grid.y);
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D atlas;varying vec2 vUv;void main(){vec4 c=texture2D(atlas,vUv);if(c.a<.04)discard;gl_FragColor=vec4(c.rgb*1.05,c.a);
      #include <colorspace_fragment>
      }`});
    owned.push(symbolMaterial);
    const symbol = mesh(symbolGeometry,symbolMaterial); symbol.name='GroundLootEquipmentSymbols';
    // A soft circular pool makes rarity readable without a square sprite edge or extra lights.
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
    const glowContext = glowCanvas.getContext('2d'), glowGradient = glowContext.createRadialGradient(32,32,0,32,32,32);
    glowGradient.addColorStop(0,'rgba(255,255,255,.85)'); glowGradient.addColorStop(.35,'rgba(255,255,255,.48)'); glowGradient.addColorStop(1,'rgba(255,255,255,0)');
    glowContext.fillStyle = glowGradient; glowContext.fillRect(0,0,64,64);
    const glowTexture = new T.CanvasTexture(glowCanvas);
    const glowMaterial = new T.MeshBasicMaterial({color:0xffffff,map:glowTexture,transparent:true,opacity:.32,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}); owned.push(glowMaterial);
    const groundGlow = mesh(new T.PlaneGeometry(.75,.75),glowMaterial,true); groundGlow.name = 'GroundLootQualityGlow';
    const object = new T.Object3D(), color = new T.Color(), motion = new Map();
    let clock = 0, disposed = false, picked = 0;
    function update(dt) {
      if (disposed) return;
      clock += dt; let count=0;
      const drops=progression.groundLoot;
      // Iterate backwards because collecting removes one authoritative pending entry.
      for (let i=drops.length-1;i>=0;i--) {
        const drop=drops[i]; if (drop.chapter!==chapter) continue;
        const def=B.Progression.catalog[drop.id]; if(!def)continue;
        const quality=B.Progression.qualities[def.rarity];
        let m=motion.get(drop.uid);
        if (!m) { m={age:0,flight:0,flying:false,x:drop.x,z:drop.z}; motion.set(drop.uid,m); }
        m.age+=dt;
        const distance=Math.hypot(player.x-drop.x,player.z-drop.z);
        if (!m.flying && m.age>=(drop.boss?BOSS_DELAY:DELAY) && distance<=(drop.boss?BOSS_REACH:REACH) && (!world.hasClearPath || world.hasClearPath(player.x,player.z,drop.x,drop.z,.08))) m.flying=true;
        const base=world.effectHeightAt?world.effectHeightAt(drop.x,drop.z,.4):.06;
        let x=drop.x,z=drop.z,y=base+.16+Math.sin(clock*2.7+i)*.02,scale=Math.min(1,m.age/.18);
        if (m.flying) {
          m.flight+=dt; const u=Math.min(1,m.flight/FLIGHT),k=u*u*(3-2*u);
          x=drop.x+(player.x-drop.x)*k; z=drop.z+(player.z-drop.z)*k;
          y+=Math.sin(u*Math.PI)*.7+u*.6; scale*=1-.55*u;
          if (u>=1) { progression.collectLoot(drop.uid); if(onCollect)onCollect(); motion.delete(drop.uid); picked++;
            if(sound)sound('lootPickup',{x:player.x,z:player.z,rarity:def.rarity,signature:drop.boss,weaponType:def.type,slot:def.slot});
            if(fx)fx('lootCollect',{x:player.x,y:1,z:player.z,color:quality.color,rarity:def.rarity,signature:drop.boss});
            continue; }
        }
        if (count>=CAPACITY || !m.flying && distance>28) continue;
        color.set(quality.color);
        object.position.set(x,y+.17,z);
        const camera = B.app && B.app.camera;
        if (camera) object.quaternion.copy(camera.quaternion); else object.rotation.set(0,0,0);
        object.scale.setScalar(scale); object.updateMatrix(); symbol.setMatrixAt(count,object.matrix);
        cells[count]=art.cells.get(drop.id)||0;
        object.position.set(x,base+.018,z); object.rotation.set(-Math.PI/2,0,0); object.scale.setScalar(m.flying?0:scale); object.updateMatrix();
        groundGlow.setMatrixAt(count,object.matrix); groundGlow.setColorAt(count,color);
        count++;
      }
      for (const [uid] of motion) if (!drops.some(drop=>drop.uid===uid)) motion.delete(uid);
      for (const mesh of meshes) { mesh.count=count; mesh.instanceMatrix.needsUpdate=true; if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true; }
      symbolGeometry.attributes.aCell.needsUpdate=true; group.visible=count>0;
    }
    function reset() { motion.clear(); clock=0; for(const m of meshes)m.count=0; group.visible=false; }
    function dispose() { if(disposed)return;disposed=true;motion.clear();for(const m of meshes)m.dispose();for(const g of geometries)g.dispose();for(const m of owned)m.dispose();glowTexture.dispose();group.removeFromParent(); }
    return {update,reset,dispose,stats:()=>({pending:progression.groundLoot.filter(i=>i.chapter===chapter).length,visible:symbol.count,picked,draws:meshes.length}),reach:REACH};
  }
  B.GroundLoot={create,prepare};
}());
