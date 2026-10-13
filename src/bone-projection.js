/* Skip only Bone-only, non-drawing branches during main-frame projection.
   Scene matrices and actor poses remain native; the canonical hierarchy is
   restored before after-render callbacks and by the caller's finally block. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  function create(scene, mainCamera) {
    const roots = new Map(), swapped = [];
    let depth = 0, disposed = false;
    const stats = { plans: 0, branches: 0, bones: 0 };
    const before = scene.onBeforeRender, after = scene.onAfterRender;
    function restore() {
      for (let i = swapped.length - 1; i >= 0; i--) swapped[i].parent.children = swapped[i].original;
      swapped.length = 0;
    }
    function watch(record, node) {
      if (record.watched.has(node)) return;
      record.watched.add(node);
      node.addEventListener('childadded', record.changed);
      node.addEventListener('childremoved', record.changed);
      for (const child of node.children) watch(record, child);
    }
    function unwatch(record, node) {
      if (!record.watched.delete(node)) return;
      node.removeEventListener('childadded', record.changed);
      node.removeEventListener('childremoved', record.changed);
      for (const child of node.children) unwatch(record, child);
    }
    function addRoot(root) {
      if (!root || roots.has(root)) return;
      const record = { root, watched: new Set(), dirty: true, plan: [] };
      record.changed = function (event) {
        // Preserve an addition/removal made by a native render callback to a
        // shortened parent, then restore before rebuilding any actor plan.
        for (const part of swapped) if (part.parent === event.target && part.parent.children === part.filtered) {
          const at = part.original.indexOf(event.child);
          if (event.type === 'childadded' && at < 0) part.original.push(event.child);
          if (event.type === 'childremoved' && at >= 0) part.original.splice(at, 1);
        }
        restore(); record.dirty = true;
        if (event.type === 'childadded') watch(record, event.child);
        else unwatch(record, event.child);
      };
      roots.set(root, record); watch(record, root);
    }
    function prepare(actors) {
      restore();
      for (const actor of actors || []) addRoot(actor && actor.model ? actor.model.root : actor);
      // Call after loading-time actor/effect setup so the first fight reuses
      // complete plans rather than discovering bone topology during play.
      for (const record of roots.values()) if (record.dirty) rebuild(record);
    }
    function rebuild(record) {
      const pure = new Map();
      function examine(node) {
        let onlyBones = node.isBone === true && !node.isMesh && !node.isLight && !node.isSprite && !node.isLine && !node.isPoints && !node.isLOD, count = 1;
        for (const child of node.children) {
          const result = examine(child); onlyBones = onlyBones && result.onlyBones; count += result.count;
        }
        const result = { onlyBones, count }; pure.set(node, result); return result;
      }
      examine(record.root); record.plan.length = 0;
      function plan(node) {
        const original = node.children; let branches = 0, bones = 0;
        for (const child of original) {
          const result = pure.get(child);
          if (result.onlyBones) { branches++; bones += result.count; }
        }
        if (branches) record.plan.push({ parent: node, original, filtered: original.filter(child => !pure.get(child).onlyBones), branches, bones });
        // Do not also shorten descendants of a branch already omitted above.
        for (const child of original) if (!pure.get(child).onlyBones) plan(child);
      }
      plan(record.root); record.dirty = false; stats.plans++;
    }
    function visible(root) {
      for (let n = root; n; n = n.parent) if (n.visible === false) return false;
      return true;
    }
    function shorten(camera) {
      stats.branches = stats.bones = 0;
      if (disposed || !depth || camera !== mainCamera) return;
      for (const record of roots.values()) {
        if (!record.root.parent || !visible(record.root)) continue;
        if (record.dirty) rebuild(record);
        // A replaced children array is a non-native structural edit; fall back
        // and rebuild its plan while the hierarchy is still canonical.
        let replaced = false;
        for (const part of record.plan) if (part.parent.children !== part.original) { replaced = true; break; }
        if (replaced) rebuild(record);
        for (const part of record.plan) {
          part.parent.children = part.filtered; swapped.push(part);
          stats.branches += part.branches; stats.bones += part.bones;
        }
      }
    }
    function beforeRender() {
      restore(); if (before) before.apply(this, arguments);
      shorten(arguments[2]);
    }
    function afterRender() {
      restore(); if (after) after.apply(this, arguments);
    }
    scene.onBeforeRender = beforeRender; scene.onAfterRender = afterRender;
    function beginRender() { if (!disposed && depth++ === 0) restore(); }
    function endRender() { if (depth > 0) depth--; if (depth === 0) restore(); }
    function dispose() {
      restore(); depth = 0; disposed = true;
      for (const record of roots.values()) unwatch(record, record.root);
      roots.clear();
      if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = before;
      if (scene.onAfterRender === afterRender) scene.onAfterRender = after;
    }
    return { prepare, beginRender, endRender, dispose, stats };
  }
  B.BoneProjection = { create };
})();
