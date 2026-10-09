/* Live equipment portrait: isolated rig/mixer, shared surfaces, one existing WebGL renderer. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE;
  function create({ renderer, game, worldScene }) {
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(34, .7, .1, 20), model = B.Models.create('hero');
    scene.name = 'character-preview'; scene.background = new T.Color('#151615'); scene.add(model.root);
    // Share the already prepared world reflections. Metallic blades otherwise turn black
    // at most portrait angles; no second environment render or texture allocation is needed.
    function syncEnvironment() {
      if (worldScene && scene.environment !== worldScene.environment) scene.environment = worldScene.environment;
      scene.environmentIntensity = .6;
    }
    syncEnvironment();
    model.root.rotation.y = -.22;
    // (ajan:visual-dark) low fill, warm key from the upper left and a cold back rim: the figure is modelled by light, not flat-lit.
    scene.add(new T.HemisphereLight(0xc9d2e0, 0x2a1d1a, .62));
    const key = new T.DirectionalLight(0xffd9ae, 2.7); key.position.set(-3.4, 4.2, 3.6); scene.add(key);
    // The resting blade tilts down; the existing fill reveals its metal from below eye level.
    const rim = new T.DirectionalLight(0x8fabc7, .6); rim.position.set(3, .3, 4); scene.add(rim);
    const backLight = new T.DirectionalLight(0xb8c9df, 2.3); backLight.position.set(2.6, 3, -3.6); scene.add(backLight);
    const owned = [], stageGeometry = [], stageMaterials = [];
    const stone = new T.MeshStandardMaterial({ ...B.CoastMaterials.createSurface('crypt', owned), color: 0x373b3a, roughness: .94, metalness: 0, normalScale: new T.Vector2(.6, .6) });
    stageMaterials.push(stone);
    const plinthGeometry = new T.CylinderGeometry(1.05, 1.14, .13, 32); stageGeometry.push(plinthGeometry);
    const plinth = new T.Mesh(plinthGeometry, stone); plinth.position.y = -.08; scene.add(plinth);
    const pillarGeometry = new T.BoxGeometry(.28, .43, .3), lintelGeometry = new T.BoxGeometry(.45, .25, .32); stageGeometry.push(pillarGeometry, lintelGeometry);
    for (const x of [-1.08, 1.08]) for (let tier = 0; tier < 7; tier++) { const block = new T.Mesh(pillarGeometry, stone); block.position.set(x + Math.sin(tier * 4) * .015, tier * .445 + .15, -.85); scene.add(block); }
    for (let i = 0; i < 5; i++) { const block = new T.Mesh(lintelGeometry, stone); block.position.set((i - 2) * .46, 3.05, -.85); scene.add(block); }
    camera.position.set(0, 1.42, 4.8); camera.lookAt(0, 1.18, 0); camera.updateMatrixWorld(true);
    const viewport = new T.Vector4(), scissor = new T.Vector4(), clearColor = new T.Color();
    const state = { time: 0, move: 0, attack: 0, attackTime: -1, heavy: false, dodge: 0, hurt: 0, dead: false, reset: false };
    const portraitTarget = new T.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false, samples: Math.min(4, renderer.capabilities.maxSamples || 0) });
    portraitTarget.texture.colorSpace = T.SRGBColorSpace;
    const maxPortraitSize = Math.min(renderer.capabilities.maxTextureSize, renderer.capabilities.maxRenderbufferSize || renderer.capabilities.maxTextureSize);
    let portraitPixels = null, portraitImage = null;
    let readPending = false, asyncFailed = false, presentationEpoch = 0;
    function present(canvas, w, h, pixels) {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;
      if (!portraitImage || portraitImage.width !== w || portraitImage.height !== h) portraitImage = ctx.createImageData(w, h);
      const rowBytes = w * 4;
      for (let row = 0; row < h; row++) portraitImage.data.set(pixels.subarray((h - row - 1) * rowBytes, (h - row) * rowBytes), row * rowBytes);
      ctx.putImageData(portraitImage, 0, 0);
    }
    let lastTime = null, animationTime = 0, revision = -1, sourceModel = null, disposed = false, lastCanvas = null;
    let nextDrawTime = null, cadenceHz = 30;
    function syncEquipment() {
      const source = game.player && game.player.model;
      if (!source) return false;
      const current = source.root.userData.equipmentRevision || 0;
      if (source === sourceModel && current === revision) return false;
      sourceModel = source; revision = current;
      if (source.equipment && model.setEquipment) model.setEquipment(source.equipment);
      return true;
    }
    function draw(canvas, now, preparing = false) {
      if ((!preparing && document.body.dataset.view !== 'character') || disposed || !canvas || !canvas.isConnected || !game.player.model || !canvas.width || !canvas.height) return false;
      // Only one GPU readback may own the target/buffer; never queue unbounded work.
      if (readPending) return false;
      syncEnvironment();
      const changed = syncEquipment(), time = Number.isFinite(now) ? now : performance.now();
      // This inventory-only RAF renders its isolated target; the paused world keeps
      // its existing cadence. Healthy asynchronous reads may present at 60 Hz,
      // while synchronous/unsupported paths retain 30 Hz and a lower user cap.
      const requested = B.app && B.app.settings && B.app.settings.frameRate;
      const userHz = Number.isFinite(requested) && requested > 0 ? requested : 60;
      const healthyAsync = !preparing && portraitImage && !asyncFailed && typeof renderer.readRenderTargetPixelsAsync === 'function';
      const hz = Math.min(healthyAsync ? 60 : 30, userHz), interval = 1000 / hz;
      if (cadenceHz !== hz) { cadenceHz = hz; nextDrawTime = lastTime !== null ? lastTime + interval : null; }
      const immediate = changed || canvas !== lastCanvas || lastTime === null;
      if (!immediate && nextDrawTime !== null && time + .01 < nextDrawTime) return false;
      // Keep phase under fast browser callbacks, never submit a catch-up burst.
      if (immediate || nextDrawTime === null || time - nextDrawTime > interval * 2) nextDrawTime = time + interval;
      else nextDrawTime += Math.max(1, Math.floor((time - nextDrawTime) / interval) + 1) * interval;
      const dt = lastTime !== null ? Math.min(.08, Math.max(0, (time - lastTime) / 1000)) : 1 / 30;
      const sameCanvas = canvas === lastCanvas;
      lastTime = time; lastCanvas = canvas; animationTime += dt; state.time = animationTime;
      model.animate(dt, state); scene.updateMatrixWorld(true);
      const canvasRect = canvas.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return false;
      // A dedicated multisampled target keeps the portrait crisp even when the world uses Auto/DRS.
      const portraitScale = Math.min(Math.max(1.5, window.devicePixelRatio || 1), 1024 / canvasRect.width, 1536 / canvasRect.height, maxPortraitSize / canvasRect.width, maxPortraitSize / canvasRect.height);
      const w = Math.max(1, Math.round(canvasRect.width * portraitScale)), h = Math.max(1, Math.round(canvasRect.height * portraitScale));
      if (portraitTarget.width !== w || portraitTarget.height !== h) {
        portraitTarget.setSize(w, h); portraitPixels = new Uint8Array(w * h * 4); portraitImage = null;
      }
      if (!portraitPixels) portraitPixels = new Uint8Array(w * h * 4);
      camera.aspect = w / h;
      const halfFov = Math.tan(camera.fov * Math.PI / 360);
      const distance = Math.max(4.8, (model.height + .4) / (2 * halfFov), 1.6 / (2 * halfFov * camera.aspect));
      camera.position.set(0, 1.35, distance); camera.lookAt(0, 1.22, 0);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      renderer.getViewport(viewport); renderer.getScissor(scissor); renderer.getClearColor(clearColor);
      const target = renderer.getRenderTarget(), oldScissor = renderer.getScissorTest(), autoClear = renderer.autoClear, alpha = renderer.getClearAlpha();
      const outputColorSpace = renderer.outputColorSpace, toneMapping = renderer.toneMapping, exposure = renderer.toneMappingExposure;
      try {
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
        // Render targets already use physical pixels. setViewport() would multiply them
        // by the world's pixel ratio again and crop/shift the portrait at 1.25x/1.5x.
        portraitTarget.viewport.set(0, 0, w, h);
        renderer.setRenderTarget(portraitTarget); renderer.setScissorTest(false); renderer.autoClear = true;
        renderer.render(scene, camera);
        // Switching targets resolves MSAA before the bounded portrait readback.
        renderer.setRenderTarget(target);
        // First/preparing frames stay immediate; subsequent portraits read through
        // Three's fenced WebGL2 PBO without synchronously waiting for the GPU.
        if (!preparing && sameCanvas && portraitImage && !asyncFailed && typeof renderer.readRenderTargetPixelsAsync === 'function') {
          const pixels = portraitPixels, epoch = presentationEpoch, source = sourceModel, equipRevision = revision;
          const rectWidth = canvasRect.width, rectHeight = canvasRect.height;
          readPending = true;
          let pending;
          try {
            pending = renderer.readRenderTargetPixelsAsync(portraitTarget, 0, 0, w, h, pixels);
          } catch (_) {
            readPending = false; asyncFailed = true;
            const gl = renderer.getContext();
            if (gl && gl.PIXEL_PACK_BUFFER !== undefined) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
            renderer.readRenderTargetPixels(portraitTarget, 0, 0, w, h, pixels);
            present(canvas, w, h, pixels);
          } finally {
            // Bundled Three leaves its PBO bound while awaiting the fence. Restore
            // the neutral binding so other synchronous readbacks remain valid.
            const gl = renderer.getContext();
            if (gl && gl.PIXEL_PACK_BUFFER !== undefined) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
          }
          if (pending) Promise.resolve(pending).then(() => {
            if (disposed || epoch !== presentationEpoch || document.body.dataset.view !== 'character' || document.visibilityState === 'hidden' || !canvas.isConnected || canvas !== lastCanvas) return;
            const current = game.player && game.player.model;
            if (current !== source || (current.root.userData.equipmentRevision || 0) !== equipRevision) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width !== rectWidth || rect.height !== rectHeight) return;
            present(canvas, w, h, pixels);
          }).catch(() => {
            // A lost/unsupported async read never strands the portrait pipeline.
            // The next normal draw uses the original synchronous implementation.
            asyncFailed = true;
          }).finally(() => { readPending = false; });
        } else {
          renderer.readRenderTargetPixels(portraitTarget, 0, 0, w, h, portraitPixels);
          present(canvas, w, h, portraitPixels);
        }
      } finally {
        renderer.outputColorSpace = outputColorSpace; renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
        renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(oldScissor); renderer.autoClear = autoClear; renderer.setClearColor(clearColor, alpha);
      }
      return true;
    }
    async function warm() {
      if (disposed) return;
      syncEnvironment();
      const visibility = [];
      model.root.traverse(o => { visibility.push([o, o.visible]); o.visible = true; });
      renderer.getViewport(viewport); renderer.getScissor(scissor); renderer.getClearColor(clearColor);
      const target = renderer.getRenderTarget(), oldScissor = renderer.getScissorTest(), autoClear = renderer.autoClear, alpha = renderer.getClearAlpha();
      const outputColorSpace = renderer.outputColorSpace, toneMapping = renderer.toneMapping, exposure = renderer.toneMappingExposure;
      try {
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
        // Compile the same offscreen shader variants used by draw(), not the world's
        // default framebuffer variants (which differ in tone mapping/output colour).
        portraitTarget.setSize(8, 8); portraitTarget.viewport.set(0, 0, 8, 8);
        renderer.setRenderTarget(portraitTarget); renderer.setScissorTest(false);
        if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
        if (disposed) return;
        // Upload the shared skeleton, surfaces and equipment while the loading cover is up.
        renderer.setRenderTarget(portraitTarget); renderer.setScissorTest(false); renderer.autoClear = true;
        renderer.render(scene, camera);
      } finally {
        for (const entry of visibility) entry[0].visible = entry[1];
        renderer.outputColorSpace = outputColorSpace; renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
        renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(oldScissor); renderer.autoClear = autoClear; renderer.setClearColor(clearColor, alpha);
      }
    }
    syncEquipment(); model.animate(0, state);
    return { draw, warm, turn(direction) { presentationEpoch++; model.root.rotation.y += direction * Math.PI / 6; lastTime = null; }, warmScene: scene, warmCamera: camera, model, dispose() { if (disposed) return; disposed = true; presentationEpoch++; portraitTarget.dispose(); portraitPixels = portraitImage = null; model.dispose(); stageGeometry.forEach(g => g.dispose()); stageMaterials.forEach(m => m.dispose()); owned.forEach(t => t.dispose()); scene.clear(); } };
  }
  B.CharacterPreview = { create };
})();
