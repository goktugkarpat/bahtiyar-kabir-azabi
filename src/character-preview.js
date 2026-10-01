/* Live equipment portrait: isolated rig/mixer, shared surfaces, one existing WebGL renderer. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE;
  function create({ renderer, game }) {
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, .7, .1, 20), model = B.Models.create('hero');
    scene.name = 'character-preview'; scene.background = new T.Color('#101820'); scene.add(model.root);
    model.root.rotation.y = -.22;
    scene.add(new T.HemisphereLight(0xd7deea, 0x332322, 1.7));
    const key = new T.DirectionalLight(0xffe0b8, 2.7); key.position.set(-3, 4, 5); scene.add(key);
    const rim = new T.DirectionalLight(0x8fabc7, 1.7); rim.position.set(3, 3, -2); scene.add(rim);
    const owned = [], stageGeometry = [], stageMaterials = [];
    const stone = new T.MeshStandardMaterial({ ...B.CoastMaterials.createSurface('crypt', owned), color: 0x44596a, roughness: .94, metalness: 0, normalScale: new T.Vector2(.6, .6) });
    stageMaterials.push(stone);
    const plinthGeometry = new T.CylinderGeometry(1.05, 1.14, .13, 32); stageGeometry.push(plinthGeometry);
    const plinth = new T.Mesh(plinthGeometry, stone); plinth.position.y = -.08; scene.add(plinth);
    const pillarGeometry = new T.BoxGeometry(.28, .43, .3), lintelGeometry = new T.BoxGeometry(.45, .25, .32); stageGeometry.push(pillarGeometry, lintelGeometry);
    for (const x of [-1.08, 1.08]) for (let tier = 0; tier < 7; tier++) { const block = new T.Mesh(pillarGeometry, stone); block.position.set(x + Math.sin(tier * 4) * .015, tier * .445 + .15, -.85); scene.add(block); }
    for (let i = 0; i < 5; i++) { const block = new T.Mesh(lintelGeometry, stone); block.position.set((i - 2) * .46, 3.05, -.85); scene.add(block); }
    camera.position.set(0, 1.42, 4.8); camera.lookAt(0, 1.18, 0); camera.updateMatrixWorld(true);
    const viewport = new T.Vector4(), scissor = new T.Vector4(), clearColor = new T.Color();
    const state = { time: 0, move: 0, attack: 0, attackTime: -1, heavy: false, dodge: 0, hurt: 0, dead: false, reset: false };
    let lastTime = null, animationTime = 0, revision = -1, sourceModel = null, disposed = false, lastCanvas = null;
    function syncEquipment() {
      const source = game.player && game.player.model;
      if (!source) return false;
      const current = source.root.userData.equipmentRevision || 0;
      if (source === sourceModel && current === revision) return false;
      sourceModel = source; revision = current;
      if (source.equipment && model.setEquipment) model.setEquipment(source.equipment);
      return true;
    }
    function draw(canvas, now) {
      if (disposed || !canvas || !canvas.isConnected || !game.player.model || !canvas.width || !canvas.height) return false;
      const changed = syncEquipment(), time = Number.isFinite(now) ? now : performance.now();
      if (!changed && canvas === lastCanvas && lastTime !== null && time - lastTime < 1000 / 30) return false;
      const dt = lastTime !== null ? Math.min(.08, Math.max(0, (time - lastTime) / 1000)) : 1 / 30;
      lastTime = time; lastCanvas = canvas; animationTime += dt; state.time = animationTime;
      model.animate(dt, state); scene.updateMatrixWorld(true);
      const source = renderer.domElement, canvasRect = canvas.getBoundingClientRect(), sourceRect = source.getBoundingClientRect();
      if (!sourceRect.width || !sourceRect.height || canvasRect.bottom <= sourceRect.top || canvasRect.top >= sourceRect.bottom) return false;
      // Render only beneath the opaque portrait card; copying this crop avoids a full scene/post render.
      const sx = source.width / sourceRect.width, sy = source.height / sourceRect.height;
      const portraitScale = Math.min(sx, sy, 512 / canvasRect.width, 768 / canvasRect.height);
      const w = Math.max(1, Math.round(canvasRect.width * portraitScale)), h = Math.max(1, Math.round(canvasRect.height * portraitScale));
      const x = Math.max(0, Math.min(source.width - w, Math.round((canvasRect.left - sourceRect.left) * sx)));
      const y = Math.max(0, Math.min(source.height - h, Math.round(source.height - (canvasRect.top - sourceRect.top) * sy - h)));
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.getViewport(viewport); renderer.getScissor(scissor); renderer.getClearColor(clearColor);
      const target = renderer.getRenderTarget(), oldScissor = renderer.getScissorTest(), autoClear = renderer.autoClear, alpha = renderer.getClearAlpha();
      const pixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : 1, outputColorSpace = renderer.outputColorSpace, toneMapping = renderer.toneMapping, exposure = renderer.toneMappingExposure;
      try {
        // Three accepts logical coordinates here; the canvas crop below is in physical pixels.
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
        renderer.setRenderTarget(null); renderer.setViewport(x / pixelRatio, y / pixelRatio, w / pixelRatio, h / pixelRatio); renderer.setScissor(x / pixelRatio, y / pixelRatio, w / pixelRatio, h / pixelRatio); renderer.setScissorTest(true); renderer.autoClear = true;
        renderer.render(scene, camera);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, x, source.height - y - h, w, h, 0, 0, canvas.width, canvas.height); }
      } finally {
        renderer.outputColorSpace = outputColorSpace; renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
        renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(oldScissor); renderer.autoClear = autoClear; renderer.setClearColor(clearColor, alpha);
      }
      return true;
    }
    async function warm() {
      if (disposed) return;
      const visibility = [];
      model.root.traverse(o => { visibility.push([o, o.visible]); o.visible = true; });
      renderer.getViewport(viewport); renderer.getScissor(scissor); renderer.getClearColor(clearColor);
      const target = renderer.getRenderTarget(), oldScissor = renderer.getScissorTest(), autoClear = renderer.autoClear, alpha = renderer.getClearAlpha();
      const pixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : 1, outputColorSpace = renderer.outputColorSpace, toneMapping = renderer.toneMapping, exposure = renderer.toneMappingExposure;
      try {
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
        renderer.setRenderTarget(null);
        if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
        if (disposed) return;
        // The loading overlay covers this tiny default-framebuffer warm-up. Skeleton buffers and
        // all prepared equipment geometries are uploaded before the first inventory frame.
        renderer.setRenderTarget(null); renderer.setViewport(0, 0, 8 / pixelRatio, 8 / pixelRatio); renderer.setScissor(0, 0, 8 / pixelRatio, 8 / pixelRatio); renderer.setScissorTest(true); renderer.autoClear = true;
        renderer.render(scene, camera);
      } finally {
        for (const entry of visibility) entry[0].visible = entry[1];
        renderer.outputColorSpace = outputColorSpace; renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
        renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(oldScissor); renderer.autoClear = autoClear; renderer.setClearColor(clearColor, alpha);
      }
    }
    syncEquipment(); model.animate(0, state);
    return { draw, warm, turn(direction) { model.root.rotation.y += direction * Math.PI / 6; lastTime = null; }, warmScene: scene, warmCamera: camera, model, dispose() { if (disposed) return; disposed = true; model.dispose(); stageGeometry.forEach(g => g.dispose()); stageMaterials.forEach(m => m.dispose()); owned.forEach(t => t.dispose()); scene.clear(); } };
  }
  B.CharacterPreview = { create };
})();
