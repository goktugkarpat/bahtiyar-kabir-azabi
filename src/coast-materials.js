/* Kara Kıyı: full-colour scanned PBR surfaces, decoded on first use by either chapter.
   Shared Sources avoid duplicate GPU uploads. Embedded images also work from file://. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, bases = {}, pending = [], errors = [];
  function map(name, channel, url) {
    var entry = { source: new T.Source(null), users: [], loaded: false };
    pending.push(new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        entry.source.data = image; entry.loaded = true;
        entry.users.forEach(function (t) { t.needsUpdate = true; }); entry.users.length = 0; resolve();
      };
      image.onerror = function () { var error = new Error(KabirI18n.t('Kıyı kaplaması yüklenemedi: ') + name + '/' + channel); errors.push(error); reject(error); };
      image.src = url;
    }));
    entry.make = function () {
      var t = new T.Texture(); t.source = entry.source; t.name = 'coast-scan-' + name + '-' + channel;
      t.colorSpace = channel === 'albedo' ? T.SRGBColorSpace : T.NoColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
      t.userData.source = 'https://polyhaven.com/a/' + (B.CoastSurfaceData[name].source || 'three.js-ocean');
      if (entry.loaded) t.needsUpdate = true; else entry.users.push(t); return t;
    };
    return entry;
  }
  B.CoastMaterials = {
    createSurface: function (name, owned) {
      var base = bases[name];
      if (!base) {
        var d = B.CoastSurfaceData[name]; if (!d) throw new Error('Unknown coastal surface: ' + name);
        base = bases[name] = { albedo: map(name, 'albedo', d.albedo), normal: map(name, 'normal', d.normal), arm: map(name, 'arm', d.arm) };
      }
      var a = base.albedo.make(), n = base.normal.make(), arm = base.arm.make(); if (owned) owned.push(a, n, arm);
      return { map: a, normalMap: n, roughnessMap: arm, aoMap: arm, metalnessMap: arm };
    },
    waterNormal: function (owned) {
      if (!bases.water) bases.water = map('water', 'normal', B.CoastSurfaceData.water.normal);
      var t = bases.water.make(); owned.push(t); return t;
    },
    ready: function () { return Promise.all(pending); },
    errors: errors
  };
  // The original chapter and equipment keep their established scans and colour grading,
  // with finer colour/relief data. Both chapters share these decoded Sources.
  var originalSurface = B.Materials.createSurface;
  B.Materials.createSurface = function (name, owned, repeat) {
    var alias = { floor: 'crypt', masonry: 'paving', wood: 'wood', rust: 'metal', leather: 'leather', linen: 'linen' }[name];
    if (!alias) return originalSurface(name, owned, repeat);
    var props = B.CoastMaterials.createSurface(alias, owned);
    ['map','normalMap','roughnessMap'].forEach(function (k) { props[k].repeat.set(repeat || 1, repeat || 1); });
    return props;
  };
}());
