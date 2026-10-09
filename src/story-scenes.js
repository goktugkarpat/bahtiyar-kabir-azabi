/* Short chapter shots: existing scanned materials, no lights or runtime assets.
   Gameplay waits only for the grave lid to break; all later shots yield to input. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE;
  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function create({ scene, world, game, chapter, reduced }) {
    let age = 0, active = false, locked = false, struck = false, startX = 0, startZ = 0, face = 0;
    const duration = chapter === 1 ? 4.8 : 3.2, root = new T.Group();
    const geometry = [], pieces = [], pose = { time: 0, move: 0, attack: 0, attackTime: -1, heavy: false, openingTime: -1, wakeTime: -1, dodge: 0, hurt: 0, dead: false };
    root.name = 'unburied-opening'; root.visible = false;
    if (chapter === 1) {
      const stone = world.materials['stone~p'] || world.materials.stone;
      function block(w, h, d, x, y, z) {
        const geo = new T.BoxGeometry(w, h, d); geometry.push(geo);
        const mesh = new T.Mesh(geo, stone); mesh.position.set(x, y, z); mesh.receiveShadow = true; root.add(mesh); return mesh;
      }
      block(1.9, .16, 2.5, 0, .08, 0);
      block(.18, .8, 2.5, -.9, .48, 0); block(.18, .8, 2.5, .9, .48, 0);
      block(1.9, .8, .16, 0, .48, -1.2);
      // A broken foot end leaves a real exit rather than walking through a stone wall.
      block(.30, .48, .16, -.80, .32, 1.2); block(.30, .48, .16, .80, .32, 1.2);
      // Interlocking fracture edges, rather than four perfectly rectangular sliding panels.
      const seams = [-1.15, -.72, -.27, .22, .69, 1.15];
      function edge(boundary, j) {
        return (boundary - 2) * .45 + (boundary === 0 || boundary === 4 ? 0 : Math.sin(boundary * 4.7 + j * 2.3) * .065);
      }
      for (let i = 0; i < 4; i++) {
        const shape = new T.Shape(), center = (i - 1.5) * .45;
        seams.forEach((z, j) => { const x = edge(i, j) - center; if (j === 0) shape.moveTo(x, z); else shape.lineTo(x, z); });
        for (let j = seams.length - 1; j >= 0; j--) shape.lineTo(edge(i + 1, j) - center, seams[j]);
        shape.closePath();
        const geo = new T.ExtrudeGeometry(shape, { depth: .15, steps: 1, bevelEnabled: true, bevelThickness: .012, bevelSize: .008, bevelSegments: 1 });
        geo.rotateX(-Math.PI / 2); geometry.push(geo);
        const m = new T.Mesh(geo, stone); m.position.set(center, .98, 0); m.receiveShadow = true; root.add(m); pieces.push(m);
      }
      scene.add(root);
    }
    function start() {
      if (reduced.matches) return false;
      age = 0; active = true; locked = chapter === 1; struck = false;
      const p = game.player; startX = p.x; startZ = p.z; face = p.face;
      pose.reset = true; pose.openingTime = 0; pose.time = 0; pose.move = 0; pose.face = face;
      if (chapter === 1) p.model.root.position.set(p.x, -1.08, p.z);
      if (chapter === 1) p.model.animate(0, pose); pose.reset = false;
      root.position.set(p.x, 0, p.z); root.rotation.y = p.face; root.visible = chapter === 1;
      for (let i = 0; i < pieces.length; i++) { pieces[i].position.set((i - 1.5) * .45, .98, 0); pieces[i].rotation.set(0, 0, 0); }
      document.body.classList.add('story-opening');
      return true;
    }
    function finish() {
      if (!active) return;
      const wasLocked = locked;
      active = locked = false; root.visible = false;
      if (wasLocked) { game.player.model.root.position.y = 0; game.finishOpening?.(); }
      document.body.classList.remove('story-opening');
    }
    function step(dt, live, inputActive) {
      if (!active || !live) return;
      age += dt;
      if (chapter === 1 && locked) {
        const p = game.player, model = p.model;
        // Three continuous weight transfers: brace, push upright, then step through the broken foot end.
        const stride = ease((age - 2.35) / 1.45);
        p.x = startX + Math.sin(face) * 2.05 * stride;
        p.z = startZ + Math.cos(face) * 2.05 * stride;
        model.root.position.set(p.x, (-1.08 + 1.24 * ease((age - .68) / 1.2)) * (1 - stride), p.z);
        model.root.rotation.y = face;
        pose.time = age; pose.openingTime = age;
        pose.move = Math.sin(stride * Math.PI) * .62;
        model.animate(dt, pose);
        if (age >= .72 && !struck) {
          struck = true; B.Audio.play('slam', { x: p.x, z: p.z, volume: .3 });
        }
        const burst = Math.max(0, age - .72);
        for (let i = 0; i < pieces.length; i++) {
          // Each slab has its own release and weight; ballistic arcs settle without sliding forever.
          const t = Math.max(0, burst - Math.abs(i - 1.5) * .035), u = Math.min(1, t / .94);
          const sign = i < 2 ? -1 : 1, travel = 1 - Math.pow(1 - u, 2);
          const stone = pieces[i];
          stone.position.x = (i - 1.5) * .45 + sign * travel * (1.10 + (i % 2) * .18);
          stone.position.z = (i - 1.5) * .13 * travel;
          stone.position.y = .98 * (1 - ease(u)) + .13 * ease(u) + Math.sin(u * Math.PI) * (.39 + (i % 2) * .09);
          stone.rotation.z = sign * ease(u) * (.18 + (i % 2) * .10);
          stone.rotation.y = (i - 1.5) * .10 * ease(u);
          stone.rotation.x = sign * .07 * ease(u);
        }
        if (age >= 3.8) {
          locked = false; pose.openingTime = -1; model.root.position.y = 0;
          game.finishOpening?.();
        }
      }
      if (age >= duration || chapter !== 1 && !locked && inputActive) finish();
    }
    function camera(position, look, target, lookTarget) {
      if (!active) return false;
      const p = game.player, blend = ease((age - (chapter === 1 ? 1.8 : .25)) / (duration - (chapter === 1 ? 1.8 : .25)));
      const focusX = chapter === 1 ? startX + (p.x - startX) * .7 : p.x;
      const focusZ = chapter === 1 ? startZ + (p.z - startZ) * .7 : p.z;
      const width = innerWidth / innerHeight < 1.1 ? 1.25 : 1;
      position.set(focusX + (chapter === 1 ? -3.6 : -5) * width, chapter === 1 ? 3.3 : 5, focusZ + (chapter === 1 ? 4.8 : 7) * width).lerp(target, blend);
      look.set(focusX, chapter === 1 ? .95 : 1.2, focusZ).lerp(lookTarget, blend);
      return true;
    }
    return { start, step, camera, clear: finish, get active() { return active; }, get locked() { return locked; }, get age() { return age; }, dispose() { finish(); root.removeFromParent(); geometry.forEach(g => g.dispose()); } };
  }
  B.StoryScenes = { create };
})();
