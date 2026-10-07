/* KABİR AZABI — skip hidden subtrees when the scene's matrices are refreshed.
 * Three.js walks every child in updateMatrixWorld, visible or not. The pooled effects, the off-screen foe holders and
 * the idle projectile groups add up to ~11 000 hidden nodes, which cost 2-3 ms of CPU each frame (the 120 -> 100 FPS dips).
 * A hidden object is not drawn, so its matrices are only refreshed once it is shown again (the next render does it).
 * getWorldPosition & co. use updateWorldMatrix, which is untouched. `?nohidden` switches this off. */
(function () {
  'use strict';
  var T = window.THREE; if (!T || /[?&]nohidden/.test(location.search)) return;
  var proto = T.Object3D.prototype, orig = proto.updateMatrixWorld;
  proto.updateMatrixWorld = function (force) {
    if (this.visible === false && !this.isScene) { this.matrixWorldNeedsUpdate = true; return; }
    return orig.call(this, force);
  };
})();
