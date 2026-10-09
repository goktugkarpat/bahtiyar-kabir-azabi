/* Short chapter shots: existing scanned materials, no lights or runtime assets.
   Gameplay waits only for the grave lid to break; all later shots yield to input. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE;
  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function create({ scene, world, game, chapter, reduced }) {
    let age = 0, active = false, locked = false, struck = false;
    const duration = chapter === 1 ? 4.2 : 3.2, root = new T.Group();
    const geometry = [], pieces = [], pose = { time: 0, move: 0, attack: 0, attackTime: -1, heavy: true, dodge: 0, hurt: 0, dead: false };
    root.name = 'unburied-opening'; root.visible = false;
    if (chapter === 1) {
      const stone = world.materials['stone~p'] || world.materials.stone;
      function block(w, h, d, x, y, z) {
        const geo = new T.BoxGeometry(w, h, d); geometry.push(geo);
        const mesh = new T.Mesh(geo, stone); mesh.position.set(x, y, z); mesh.receiveShadow = true; root.add(mesh); return mesh;
      }
      block(1.9, .16, 2.5, 0, .08, 0);
      block(.18, .8, 2.5, -.9, .48, 0); block(.18, .8, 2.5, .9, .48, 0);
      block(1.9, .8, .16, 0, .48, -1.2); block(1.9, .8, .16, 0, .48, 1.2);
      for (let i = 0; i < 4; i++) { const m = block(.45, .15, 2.3, (i - 1.5) * .45, .98, 0); pieces.push(m); }
      scene.add(root);
    }
    function start() {
      if (reduced.matches) return false;
      age = 0; active = true; locked = chapter === 1; struck = false;
      const p = game.player;
      root.position.set(p.x, 0, p.z); root.rotation.y = p.face; root.visible = chapter === 1;
      for (let i = 0; i < pieces.length; i++) { pieces[i].position.set((i - 1.5) * .45, .98, 0); pieces[i].rotation.set(0, 0, 0); }
      document.body.classList.add('story-opening');
      return true;
    }
    function finish() {
      if (!active) return;
      const wasLocked = locked;
      active = locked = false; root.visible = false;
      if (wasLocked) game.player.model.root.position.y = 0;
      document.body.classList.remove('story-opening');
    }
    function step(dt, live, inputActive) {
      if (!active || !live) return;
      age += dt;
      if (chapter === 1 && locked) {
        const rise = ease((age - .8) / 1.05), p = game.player, model = p.model;
        model.root.position.y = -.92 * (1 - rise);
        pose.time = age; pose.move = .12 * rise; model.animate(dt, pose);
        if (age > .75 && !struck) { struck = true; B.Audio.play('slam', { x: p.x, z: p.z, volume: .3 }); }
        const burst = Math.max(0, age - .8);
        for (let i = 0; i < pieces.length; i++) {
          const sign = i < 2 ? -1 : 1, spread = Math.min(1, burst / .6);
          pieces[i].position.x = (i - 1.5) * .45 + sign * spread * (1.2 + i * .08);
          pieces[i].position.y = .98 + Math.sin(Math.min(1, burst / .8) * Math.PI) * .8 - spread * .73;
          pieces[i].rotation.z = sign * spread * (.25 + i * .12);
        }
        if (age >= 1.85) { locked = false; model.root.position.y = 0; }
      }
      if (age >= duration || !locked && inputActive) finish();
    }
    function camera(position, look, target, lookTarget) {
      if (!active) return false;
      const p = game.player, blend = ease((age - (chapter === 1 ? 1.2 : .25)) / (duration - (chapter === 1 ? 1.2 : .25)));
      const width = innerWidth / innerHeight < 1.1 ? 1.25 : 1;
      position.set(p.x + (chapter === 1 ? -3.2 : -5) * width, chapter === 1 ? 3.3 : 5, p.z + (chapter === 1 ? 4.3 : 7) * width).lerp(target, blend);
      look.set(p.x, chapter === 1 ? .8 : 1.2, p.z).lerp(lookTarget, blend);
      return true;
    }
    return { start, step, camera, clear: finish, get active() { return active; }, get locked() { return locked; }, get age() { return age; }, dispose() { finish(); root.removeFromParent(); geometry.forEach(g => g.dispose()); } };
  }
  B.StoryScenes = { create };
})();
