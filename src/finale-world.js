/* KABİR AZABI — V: Son Mahkeme (finale). The last court hangs in a broken void above the grave: floating platforms of black basalt and
   bone-white judgement stone, bridges over a bleeding ember abyss, colossal chains rising into a cracked sky. Structure, walkable shapes,
   collision and navigation live here; every platform's look is composed in finale-rooms.js on top of ruins-kit.js (merged geometry,
   decals, shader sprites). Adapted from ruins-world.js (III/IV), which is left untouched. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, PI = Math.PI;
  var NAMES = [KabirI18n.t('Kırık Gök Eşiği'), KabirI18n.t('Asılı Zincirler'), KabirI18n.t('Tanıkların Köprüsü'), KabirI18n.t('Mahkûmlar Kuyusu'), KabirI18n.t('Celladın Gölgesi'),
    KabirI18n.t('Çancının Gölgesi'), KabirI18n.t('Kralın Gölgesi'), KabirI18n.t('Ocağın Gölgesi'), KabirI18n.t('Yüzen Taşlar'), KabirI18n.t('Hüküm Defteri'), KabirI18n.t('Kanlı Terazi'),
    KabirI18n.t('Son Tanıklık'), KabirI18n.t('Kürsü Merdiveni'), KabirI18n.t('Son Mahkeme')];
  // Platform layout: centre x, width, depth and the walkable shape (local rectangles; outside them is the void).
  var LAYOUT = [
    { x: 0, w: 30, d: 20, shape: 'oct' },
    { x: -4, w: 34, d: 21, shape: 'oct' },
    { x: 0, w: 22, d: 22, shape: 'bridge' },
    { x: 4, w: 32, d: 22, shape: 'well' },
    { x: -3, w: 34, d: 22, shape: 'oct' },
    { x: 4, w: 32, d: 21, shape: 'cross' },
    { x: -4, w: 34, d: 22, shape: 'oct' },
    { x: 4, w: 32, d: 22, shape: 'oct' },
    { x: -2, w: 34, d: 22, shape: 'isles' },
    { x: 4, w: 34, d: 22, shape: 'oct' },
    { x: -3, w: 34, d: 22, shape: 'cross' },
    { x: 0, w: 28, d: 20, shape: 'round' },
    { x: 3, w: 26, d: 21, shape: 'stair' },
    { x: 0, w: 38, d: 30, shape: 'arena' }
  ];
  function shapeRects(L) {
    var w = L.w, d = L.d, c = 4.2;
    switch (L.shape) {
      case 'bridge': return [[0, 0, 12, d], [-8, 0, 5, 9], [8, 0, 5, 9]];
      case 'well': return [[0, -(d / 2 - 3.5), w - 2 * c, 7], [0, d / 2 - 3.5, w - 2 * c, 7], [-(w / 2 - 5.5), 0, 11, d - 2 * c], [w / 2 - 5.5, 0, 11, d - 2 * c]];
      case 'cross': return [[0, 0, w - 10, d], [0, 0, w, d - 10]];
      case 'isles': return [[0, 0, 13, d], [-11, -4, 10, 9], [11, 4, 10, 9], [-6, 6, 8, 6], [6, -6, 8, 6]];
      case 'round': return [[0, 0, w - 2 * c, d], [0, 0, w, d - 2 * c], [0, 0, w - c, d - c * .5]];
      case 'stair': return [[0, 0, 16, d], [-9, 2, 6, 10], [9, -2, 6, 10]];
      case 'arena': return [[0, 0, w - 10, d], [0, 0, w, d - 10], [0, 0, w - 5, d - 4], [0, 0, w - 3, d - 7]];
      default: return [[0, 0, w - 2 * c, d], [0, 0, w, d - 2 * c]];
    }
  }
  function build(scene, options) {
    var buildT0 = performance.now(), chapter = 5;
    var root = new T.Group(); root.name = KabirI18n.t('Son Mahkeme'); scene.add(root);
    var textures = [], materials = {}, geometries = [], colliders = [], groups = [], lights = [], sources = [], flames = [], disposed = false;
    var hero = { value: new T.Vector3(0, 1, 10) }, clock = { value: 0 };
    function geo(g) { geometries.push(g); return g; }
    var shapes = { box: geo(new T.BoxGeometry(1, 1, 1)), rock: geo(new T.IcosahedronGeometry(.5, 1)), spike: geo(new T.ConeGeometry(.5, 1, 8)), urn: geo(new T.SphereGeometry(.5, 8, 6)) };
    var white = null; function whiteMap() { if (!white) { white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, T.RGBAFormat); white.name = 'kara:white'; white.needsUpdate = true; textures.push(white); } return white; }
    function surface(key, scan, color, scale) {
      var props = B.CoastMaterials.createSurface(scan, textures), m = new T.MeshStandardMaterial(Object.assign(props, { color: color, roughness: .9, metalness: 0, aoMapIntensity: .55, vertexColors: true }));
      m.onBeforeCompile = function (sh) {
        sh.uniforms.ruinTile = { value: scale }; sh.uniforms.ruinHero = hero;
        sh.vertexShader = 'varying vec3 ruinP;varying vec3 ruinN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vec4 rp=vec4(transformed,1.);vec3 rn=objectNormal;
          ruinP=(modelMatrix*rp).xyz;ruinN=normalize(mat3(modelMatrix)*rn);`);
        sh.fragmentShader = 'varying vec3 ruinP;varying vec3 ruinN;uniform float ruinTile;uniform vec3 ruinHero;\n' + sh.fragmentShader
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if(ruinP.y>1.7){vec3 re=vec3(ruinHero.x,1.2,ruinHero.z),rd=cameraPosition-re;float rt=clamp(dot(ruinP-re,rd)/dot(rd,rd),0.,1.);if(rt>.03&&rt<.97&&distance(ruinP,re+rd*rt)<1.15+rt*.9)discard;}\n float rcd=distance(ruinP,cameraPosition);if(ruinP.y>2.4&&rcd<9.){float dth=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(rcd<5.2||dth>(rcd-5.2)/3.8)discard;}')
          .replace('#include <map_fragment>', `vec3 rn=abs(ruinN);vec2 ru=rn.y>max(rn.x,rn.z)?ruinP.xz:(rn.x>rn.z?ruinP.zy:ruinP.xy);ru*=ruinTile;
            vec4 sampledDiffuseColor=texture2D(map,ru);diffuseColor*=sampledDiffuseColor;diffuseColor.rgb*=.94+.06*sin(ruinP.x*.31+sin(ruinP.z*.21));
            diffuseColor.rgb*=mix(.35,1.,smoothstep(-7.,-.4,ruinP.y));`)
          .replace('#include <roughnessmap_fragment>', T.ShaderChunk.roughnessmap_fragment.replace(/vRoughnessMapUv/g, 'ru'))
          .replace('#include <metalnessmap_fragment>', T.ShaderChunk.metalnessmap_fragment.replace(/vMetalnessMapUv/g, 'ru'))
          .replace('#include <aomap_fragment>', T.ShaderChunk.aomap_fragment.replace(/vAoMapUv/g, 'ru'))
          .replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace(/vNormalMapUv/g, 'ru'))
          .replace('#include <normal_fragment_maps>', T.ShaderChunk.normal_fragment_maps.replace(/vNormalMapUv/g, 'ru'));
      };
      // (the underside darkening above makes the floating platforms sink into the void instead of ending in a lit cut)
      m.customProgramCacheKey = function () { return 'finale-scan-1'; }; m.normalScale.set(.7, .7); m.name = 'finale-' + key; materials[key] = m; return m;
    }
    // Judgement stone is bone-pale limestone; the platforms are black basalt; iron is old, blood-browned.
    surface('floor', 'monastery', 0x9a9088, .44); surface('stone', 'paving', 0xc9c0b4, .38); surface('wall', 'wall', 0x8e8a86, .26);
    surface('rock', 'rock', 0x6e6660, .5); surface('earth', 'rock', 0x8a8078, .36); surface('iron', 'metal', 0x8b8a8c, .6);
    surface('wood', 'wood', 0x7a6058, .5);
    function glowing(key, scan, color, emissive, intensity, scale) { var m = surface(key, scan, color, scale); m.emissive.setHex(emissive); m.emissiveIntensity = intensity; m.metalness = .2; m.roughness = .32; return m; }
    glowing('crystal', 'rock', 0xe8c0c0, 0xb01818, 1.2, .65); glowing('crystalV', 'rock', 0xd8c0ff, 0x6a24c6, 1.1, .65); glowing('crystalA', 'rock', 0xffd8b0, 0xd85020, 1.15, .65);
    glowing('slag', 'rock', 0x2a1e1c, 0xe8200c, 1.35, .5);
    materials.iron.color.setHex(0xb8aaa2); materials.iron.metalness = .34; materials.iron.metalnessMap = whiteMap(); materials.iron.roughness = .62;
    materials.lamp = new T.MeshBasicMaterial({ color: 0xff7a5a, vertexColors: true, toneMapped: false, fog: false });
    materials.hot = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false, fog: false });
    // Shared sculpted profiles (same set as III/IV, so the kit's composite props work unchanged).
    var shaft = geo(new T.LatheGeometry([new T.Vector2(.58, -.5), new T.Vector2(.58, -.44), new T.Vector2(.48, -.40), new T.Vector2(.44, -.34), new T.Vector2(.42, .30), new T.Vector2(.46, .38), new T.Vector2(.58, .44), new T.Vector2(.58, .5)], 16));
    var sp = shaft.attributes.position;
    for (var v = 0; v < sp.count; v++) { var x = sp.getX(v), z = sp.getZ(v), y = sp.getY(v), a = Math.atan2(z, x), f = 1 - .045 * (1 + Math.cos(a * 12)) * Math.max(0, 1 - Math.pow(y / .45, 8)); sp.setXYZ(v, x * f, y, z * f); }
    shaft.computeVertexNormals(); shapes.column = shaft;
    shapes.inlay = geo(new T.RingGeometry(.476, .5, 40)); shapes.inlay.rotateX(-PI / 2);
    shapes.rim = geo(new T.TorusGeometry(.5, .045, 6, 24));
    shapes.vat = geo(new T.LatheGeometry([new T.Vector2(.30, -.5), new T.Vector2(.42, -.42), new T.Vector2(.50, .25), new T.Vector2(.50, .46), new T.Vector2(.43, .46), new T.Vector2(.40, .25), new T.Vector2(.27, -.30)], 16));
    shapes.tooth = geo(new T.LatheGeometry([new T.Vector2(.46, -.5), new T.Vector2(.39, -.25), new T.Vector2(.23, .12), new T.Vector2(.10, .36), new T.Vector2(.015, .5)], 8));
    var crag = geo(new T.IcosahedronGeometry(.5, 2)), cp = crag.attributes.position;
    for (var v = 0; v < cp.count; v++) { var x = cp.getX(v), y = cp.getY(v), z = cp.getZ(v), f = 1 + .16 * Math.sin(x * 23 + y * 17 + z * 9) + .06 * Math.sin(z * 31 - y * 13); cp.setXYZ(v, x * f, y * f, z * f); }
    crag.computeVertexNormals(); shapes.crag = crag;
    shapes.link = geo(new T.TorusGeometry(.3, .06, 4, 8));
    shapes.disc = geo(new T.CircleGeometry(.5, 20)); shapes.disc.rotateX(-PI / 2);
    shapes.panel = geo(new T.PlaneGeometry(1, 1)); shapes.panel.rotateX(-PI / 2);
    shapes.cyl = geo(new T.CylinderGeometry(.5, .5, 1, 12, 1)); shapes.cyl6 = geo(new T.CylinderGeometry(.5, .5, 1, 6, 1)); shapes.cone4 = geo(new T.ConeGeometry(.5, 1, 4));
    shapes.crystal = geo(new T.LatheGeometry([new T.Vector2(0, -.5), new T.Vector2(.5, -.5), new T.Vector2(.5, .2), new T.Vector2(.3, .4), new T.Vector2(0, .5)], 6));
    var wedge = new T.Shape(); wedge.moveTo(-.5, -.5); wedge.lineTo(.5, -.5); wedge.lineTo(.5, .5); wedge.closePath(); shapes.wedge = geo(new T.ExtrudeGeometry(wedge, { depth: 1, bevelEnabled: false })); shapes.wedge.translate(0, 0, -.5);
    var stoneShape = new T.Shape(); stoneShape.moveTo(-.5, -.45); stoneShape.lineTo(-.43, -.5); stoneShape.lineTo(.44, -.49); stoneShape.lineTo(.5, -.40); stoneShape.lineTo(.49, .42); stoneShape.lineTo(.4, .5); stoneShape.lineTo(-.44, .48); stoneShape.lineTo(-.5, .36); stoneShape.closePath();
    var cutStone = new T.ExtrudeGeometry(stoneShape, { depth: 1, bevelEnabled: false, steps: 1 }); cutStone.translate(0, 0, -.5); shapes.block = geo(cutStone);
    var tileShape = new T.Shape(); tileShape.moveTo(-.5, -.5); tileShape.lineTo(.5, -.5); tileShape.lineTo(.5, .5); tileShape.lineTo(-.5, .5); tileShape.closePath();
    shapes.tile = geo(new T.ExtrudeGeometry(tileShape, { depth: .92, bevelEnabled: true, bevelSize: .022, bevelThickness: .04, bevelSegments: 1, steps: 1 })); shapes.tile.rotateX(-PI / 2); shapes.tile.translate(0, -.46, 0);
    function gearShape(teeth, inner) { var sh = new T.Shape(), n = teeth * 4; for (var k = 0; k < n; k++) { var a = k / n * PI * 2, hi = (k % 4 === 1 || k % 4 === 2), r = hi ? .5 : .41; sh[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } sh.closePath(); var hole = new T.Path(); hole.absarc(0, 0, inner, 0, PI * 2, true); sh.holes.push(hole); var g = new T.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -.5); return g; }
    shapes.gear12 = geo(gearShape(12, .14)); shapes.gear18 = geo(gearShape(18, .3)); shapes.gear8 = geo(gearShape(8, .1));
    // Molten blood-iron (lava channels of the furnace's shadow) and the bleeding abyss under the court.
    var flowNormal = B.CoastMaterials.waterNormal(textures);
    materials.lava = new T.ShaderMaterial({ uniforms: { clock: clock, norm: { value: flowNormal }, grain: { value: materials.rock.map } }, depthWrite: true, toneMapped: false,
      vertexShader: 'attribute vec3 color;varying vec3 vP;varying vec3 vE;varying vec2 vUv;void main(){vP=(modelMatrix*vec4(position,1.)).xyz;vE=color;vUv=uv;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
      fragmentShader: ['varying vec3 vP;varying vec3 vE;varying vec2 vUv;uniform float clock;uniform sampler2D norm;uniform sampler2D grain;',
        'void main(){vec2 p=vP.xz;vec2 fl=vec2(0.,-clock*.07);vec3 a=texture2D(norm,p*.11+fl*.4).rgb;vec3 b=texture2D(norm,p*.23-fl*.6+(a.rg-.5)*.7).rgb;',
        ' float f=.5+(a.r-.5)*2.4+(b.g-.5)*1.5;float crust=smoothstep(.5,.64,f);vec2 e=min(vUv,1.-vUv)*vE.xy*2.;float bank=1.-smoothstep(0.,.45,min(e.x,e.y));crust=clamp(crust+bank*.85,0.,1.);',
        ' float pulse=.55+.45*sin(clock*1.1+p.y*.7+a.g*7.);vec3 molten=mix(vec3(.5,.03,.02),vec3(.95,.16,.05),pulse*.6+b.g*.4);vec3 crustCol=vec3(.025,.012,.012);',
        ' gl_FragColor=vec4(mix(molten,crustCol,smoothstep(.2,.7,crust)),1.);}'].join('\n') });
    var abyssMat = new T.ShaderMaterial({ uniforms: { clock: clock, norm: { value: flowNormal } }, depthWrite: false, toneMapped: false, transparent: false, fog: false,
      vertexShader: 'varying vec3 vP;void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
      fragmentShader: ['varying vec3 vP;uniform float clock;uniform sampler2D norm;',
        'void main(){vec2 p=vP.xz;vec3 a=texture2D(norm,p*.013+vec2(clock*.004,-clock*.006)).rgb;vec3 b=texture2D(norm,p*.041-vec2(clock*.009,clock*.003)+(a.rg-.5)*.6).rgb;vec3 c=texture2D(norm,p*.11+(b.rg-.5)*.5+vec2(0.,clock*.012)).rgb;',
        ' float v=(a.r-.5)*1.8+(b.g-.5)*1.4+(c.r-.5)*.6;float vein=smoothstep(.18,.0,abs(v-.05));float pool=smoothstep(.25,.75,a.g*.6+b.r*.5);',
        ' float pulse=.75+.25*sin(clock*.6+a.b*9.);vec3 col=vec3(.012,.004,.006)+vec3(.30,.025,.015)*vein*pulse+vec3(.10,.008,.01)*pool;',
        ' float d=distance(cameraPosition,vP);col*=1.-smoothstep(70.,150.,d)*.85;gl_FragColor=vec4(col,1.);}'].join('\n') });
    materials.abyss = abyssMat;
    var rooms = LAYOUT.map(function (L, i) { return { id: i, name: NAMES[i], x: L.x, z: 8 - i * 26, w: L.w, d: L.d, shape: L.shape }; });
    var floors = [], paths = [], encounters = [];
    rooms.forEach(function (r) {
      r.rects = shapeRects(LAYOUT[r.id]).map(function (q) { return { x: r.x + q[0], z: r.z + q[1], w: q[2], d: q[3] }; });
      r.rects.forEach(function (q) { floors.push(q); });
      var group = new T.Group(); group.name = r.name; root.add(group); groups.push(group);
    });
    // Bridges: each gap is crossed by a stone causeway (width varies), wider where the court opens up.
    var BRIDGE_W = [9, 8, 9, 10, 8, 9, 10, 8, 9, 10, 9, 12, 12];
    var bridges = [];
    rooms.forEach(function (r, i) {
      if (i >= rooms.length - 1) return; var next = rooms[i + 1], a = r.z - r.d / 2 + .6, b = next.z + next.d / 2 - .6, w = BRIDGE_W[i];
      var br = { x: 0, z: (a + b) / 2, w: w, d: a - b, room: i }; floors.push(br); bridges.push(br); paths.push({ a: { x: 0, z: r.z }, b: { x: 0, z: next.z }, width: w });
    });
    function onFloor(x, z) { for (var k = 0; k < floors.length; k++) { var f = floors[k]; if (Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2) return true; } return false; }
    function solid(x, z, w, d) { colliders.push({ x: x, z: z, w: w, d: d }); }
    var K = B.RuinsKit.create({ forge: true, root: root, materials: materials, textures: textures, groups: groups, shapes: shapes, clock: clock, sources: sources, flames: flames, geometries: geometries, rooms: rooms, solid: solid });
    // The abyss: one huge plane far below the whole route (one draw call, no lights), plus the fog swallowing the drop.
    var abyss = new T.Mesh(geo(new T.PlaneGeometry(320, 520)), abyssMat); abyss.rotation.x = -PI / 2; abyss.position.set(0, -34, -170); abyss.renderOrder = -10; abyss.name = 'finale-abyss'; root.add(abyss);
    // Encounters (a fixed, hand-placed formation per platform; local coordinates; all on walkable stone).
    var FORM = {
      0: [['damned', -4, -3], ['damned', 4, -4], ['verdictseer', 0, -7]],
      1: [['damned', -6, 2], ['voidcrawler', 5, -3], ['damned', 2, 4], ['verdictseer', -3, -6], ['chainjailer', 7, 3]],
      2: [['voidcrawler', -3, 4], ['voidcrawler', 3, 4], ['chainjailer', 0, -5], ['verdictseer', -8, 0], ['verdictseer', 8, 0]],
      3: [['damned', -10, -3], ['damned', 10, 3], ['voidcrawler', -9, 6], ['chainjailer', 9, -6], ['verdictseer', 0, -8], ['damned', 0, 8]],
      4: [['damned', -4, 3], ['damned', 4, 3], ['chainjailer', -7, -3], ['verdictseer', 7, -3], ['voidcrawler', 0, 2], ['verdictwarden', 0, -3.8, true]],
      5: [['voidcrawler', -9, 0], ['voidcrawler', 9, 0], ['damned', 0, 6], ['verdictseer', -3, -5], ['chainjailer', 3, -5]],
      6: [['chainjailer', -5, -4], ['chainjailer', 5, -4], ['verdictseer', 0, -5.2], ['damned', -7, 3], ['damned', 7, 3], ['voidcrawler', 0, 3]],
      7: [['voidcrawler', -6, 2], ['damned', 6, 2], ['verdictseer', -4.5, -8.5], ['verdictseer', 9, -5], ['chainjailer', 0, -4]],
      8: [['voidcrawler', -11, -4], ['voidcrawler', 11, 4], ['damned', 0, 3], ['damned', 0, -4], ['verdictseer', -6, 6], ['chainjailer', 6, -6]],
      9: [['chainjailer', -5, 3], ['chainjailer', 5, 3], ['verdictseer', -9, -2], ['damned', 9, -2], ['voidcrawler', 0, 0], ['verdictwarden', 0, -7, true]],
      10: [['damned', -6, 4], ['damned', 6, 4], ['voidcrawler', -11, 0], ['voidcrawler', 11, 0], ['verdictseer', 0, -8.5], ['chainjailer', 0, 0]],
      12: [['chainjailer', -4, -4], ['chainjailer', 4, -4], ['verdictseer', -9, 2], ['verdictseer', 9, -2], ['damned', 0, 2]]
    };
    rooms.forEach(function (r, i) {
      if (i === 11) return;
      if (i === 13) { solid(0, r.z - 13.2, 9, 2.4); encounters.push({ id: 'last-judgement', room: i, name: KabirI18n.t('Son Hükmün Kürsüsü'), spawns: [{ type: 'lastjudge', x: 0, z: r.z - 2, boss: true }], stage: 1.24 }); return; }
      var spawns = FORM[i].map(function (q) { var s = { type: q[0], x: r.x + q[1], z: r.z + q[2] }; if (q[3]) s.elite = true; return s; });
      encounters.push({ id: 'finale-' + i, room: i, name: r.name, clearText: KabirI18n.t('Platform sustu. Boşluğun üstündeki yol açık.'), stage: 1.1 + i * .016, spawns: spawns });
    });
    var info = { rooms: rooms, bridges: bridges, onFloor: onFloor, names: NAMES };
    rooms.forEach(function (r, i) { B.FinaleRooms.dress(K, r, i, info); });
    B.FinaleRooms.bridges(K, info);
    var meshes = K.finish().concat(K.finishFx());
    var gearSpin = K.spinners;
    // Broad phase (identical predicate to III/IV: a point is walkable inside any floor rectangle and outside every collider by its radius).
    var grid = new Map(), cell = 8, lastF = 0, nf = floors.length;
    colliders.forEach(function (c) { c.x0 = c.x - c.w / 2; c.x1 = c.x + c.w / 2; c.z0 = c.z - c.d / 2; c.z1 = c.z + c.d / 2; for (var x = Math.floor(c.x0 / cell); x <= Math.floor(c.x1 / cell); x++) for (var z = Math.floor(c.z0 / cell); z <= Math.floor(c.z1 / cell); z++) { var k = x * 4096 + z, l = grid.get(k); if (!l) grid.set(k, l = []); l.push(c); } });
    function isWalkable(x, z, r) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false; r = r == null ? .46 : Math.max(.01, r);
      var f = floors[lastF];
      if (!(Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2)) { var hit = -1; for (var i = 0; i < nf; i++) { f = floors[i]; if (Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2) { hit = i; break; } } if (hit < 0) return false; lastF = hit; }
      var rr = r * r - 1e-6, g1 = Math.floor((x + r) / cell), h1 = Math.floor((z + r) / cell), h0 = Math.floor((z - r) / cell);
      for (var gx = Math.floor((x - r) / cell); gx <= g1; gx++) for (var gz = h0; gz <= h1; gz++) { var list = grid.get(gx * 4096 + gz); if (!list) continue; for (var j = 0; j < list.length; j++) { var c = list[j], dx = x - (x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x), dz = z - (z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z); if (dx * dx + dz * dz < rr) return false; } }
      return true;
    }
    function move(p, dx, dz, r) { if (!Number.isFinite(dx) || !Number.isFinite(dz)) return p; var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .18)), sx = dx / n, sz = dz / n; for (var i = 0; i < n; i++) { if (isWalkable(p.x + sx, p.z + sz, r)) { p.x += sx; p.z += sz; } else { if (isWalkable(p.x + sx, p.z, r)) p.x += sx; if (isWalkable(p.x, p.z + sz, r)) p.z += sz; } } return p; }
    function hasClearPath(ax, az, bx, bz, r) { var n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / .3)); for (var i = 0; i <= n; i++) if (!isWalkable(ax + (bx - ax) * i / n, az + (bz - az) * i / n, r)) return false; return true; }
    var nodes = []; rooms.forEach(function (r) { [-12, -6, 0, 6, 12].forEach(function (x) { [-8, 0, 8].forEach(function (z) { if (isWalkable(r.x + x, r.z + z, 1.05)) nodes.push({ x: r.x + x, z: r.z + z, edges: [] }); }); }); });
    bridges.forEach(function (b) { if (isWalkable(0, b.z, 1.05)) nodes.push({ x: 0, z: b.z, edges: [] }); });
    for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) < 30 && hasClearPath(nodes[i].x, nodes[i].z, nodes[j].x, nodes[j].z, 1.05)) { nodes[i].edges.push(j); nodes[j].edges.push(i); }
    var dist = new Float64Array(nodes.length), prev = new Int16Array(nodes.length), used = new Uint8Array(nodes.length);
    function pathTo(from, to, r) {
      if (!isWalkable(to.x, to.z, r)) return []; if (hasClearPath(from.x, from.z, to.x, to.z, r)) return [{ x: to.x, z: to.z }];
      dist.fill(Infinity); prev.fill(-1); used.fill(0);
      for (var i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].x - from.x, nodes[i].z - from.z) < 24 && hasClearPath(from.x, from.z, nodes[i].x, nodes[i].z, r)) dist[i] = Math.hypot(nodes[i].x - from.x, nodes[i].z - from.z);
      var end = -1; for (var k = 0; k < nodes.length; k++) { var at = -1, best = Infinity; for (var i = 0; i < nodes.length; i++) if (!used[i] && dist[i] < best) { best = dist[i]; at = i; } if (at < 0) break; used[at] = 1; var n = nodes[at]; if (Math.hypot(to.x - n.x, to.z - n.z) < 24 && hasClearPath(n.x, n.z, to.x, to.z, r)) { end = at; break; } for (var j = 0; j < n.edges.length; j++) { var id = n.edges[j], next = nodes[id], cost = best + Math.hypot(next.x - n.x, next.z - n.z); if (cost < dist[id]) { dist[id] = cost; prev[id] = at; } } }
      if (end < 0) return []; var path = [{ x: to.x, z: to.z }]; for (var at = end, guard = 0; at >= 0 && guard++ < nodes.length; at = prev[at]) path.unshift({ x: nodes[at].x, z: nodes[at].z }); return path;
    }
    function roomAt(x, z) { var closest = rooms[0], best = Infinity; for (var i = 0; i < rooms.length; i++) { var r = rooms[i]; if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) return r; var d = Math.abs(z - r.z); if (d < best) { best = d; closest = r; } } return closest; }
    // Three pooled point lights handed from source to source (as in III/IV: the light COUNT never changes).
    for (var i = 0; i < 3; i++) { var light = new T.PointLight(0xff6a4a, 0, 13, 2); root.add(light); lights.push(light); }
    var slots = [{ src: null, w: 0 }, { src: null, w: 0 }, { src: null, w: 0 }], near = [];
    function byEff(a, b) { return b.eff - a.eff; }
    function lightStep(dt, time, p) {
      var i, k, sl, s; near.length = 0;
      for (i = 0; i < sources.length; i++) { s = sources[i]; var dx = s.x - p.x, dz = s.z - p.z; s.distance = Math.hypot(dx, dz); if (s.distance < 18) { s.score = s.intensity / (1 + s.distance * s.distance / 30); s.held = false; near.push(s); } }
      for (k = 0; k < 3; k++) { if (slots[k].src) slots[k].src.held = true; }
      for (i = 0; i < near.length; i++) near[i].eff = near[i].score * (near[i].held ? 1.35 : 1);
      near.sort(byEff);
      for (k = 0; k < 3; k++) { sl = slots[k]; if (!sl.src) continue; var ix = near.indexOf(sl.src), want = ix >= 0 && ix < 3; sl.w = want ? Math.min(1, sl.w + dt * 3.6) : Math.max(0, sl.w - dt * 4.2); if (sl.w <= 0) sl.src = null; }
      for (k = 0; k < 3; k++) { if (slots[k].src) continue; for (var j = 0; j < 3 && j < near.length; j++) { var c = near[j], taken = false; for (var q = 0; q < 3; q++) if (slots[q].src === c) taken = true; if (!taken) { slots[k].src = c; slots[k].w = 0; break; } } }
      for (k = 0; k < 3; k++) { var l = lights[k]; sl = slots[k]; s = sl.src; l.visible = quality !== 'low'; l.intensity = 0;
        if (s) { l.position.set(s.x, s.y, s.z); l.color.copy(s.color); l.distance = s.range || 13; l.intensity = s.intensity * (sl.w * sl.w * (3 - 2 * sl.w)) * (1 + s.flicker * .65 * (.5 * Math.sin(time * 11.3 + s.phase * 5) + .3 * Math.sin(time * 17.9 + s.phase * 2.3))); } }
    }
    var Script = B.FinaleRooms, moods = B.RuinsKit.makeMoods(Script.moodBase, Script.moodSpecs), live = B.RuinsKit.makeMood(Script.moodBase), moodKeys = Object.keys(live);
    function atmosphereAt(x, z) {
      var u = Math.max(0, Math.min(rooms.length - 1.001, (rooms[0].z - z) / 26)), a = Math.floor(u), f = u - a; f = f < .38 ? 0 : f > .62 ? 1 : (f - .38) / .24; f = f * f * (3 - 2 * f);
      B.RuinsKit.blendMood(live, moods[a], moods[a + 1], f, moodKeys); live.room = Math.min(6, Math.floor(Math.round(u) / 2)); live.keyIntensity = live.keyI; live.rimIntensity = live.rimI; live.saturation = live.sat;
      return live;
    }
    var quality = 'high', groupGain = { ruins: 1 }, oath = false, drift = Script.drifters || [];
    function update(dt, time, p) {
      p = p || { x: 0, z: 10 }; hero.value.set(p.x, 1, p.z); clock.value = time || 0;
      for (var i = 0; i < groups.length; i++) { var dz = rooms[i].z - p.z; groups[i].visible = dz > -40 && dz < 34; }
      abyss.position.z = p.z - 20;
      lightStep(dt, time || 0, p);
      for (var g = 0; g < gearSpin.length; g++) { var m = gearSpin[g]; m.rotation.z = (time || 0) * m.userData.rate; }
      if (materials.crystalA) materials.crystalA.emissiveIntensity = 1.1 + (oath ? .35 : 0) + .12 * Math.sin((time || 0) * 1.7);
      if (materials.crystal) materials.crystal.emissiveIntensity = 1.15 + .2 * Math.sin((time || 0) * .8);
      if (materials.slag) materials.slag.emissiveIntensity = 1.25 + .2 * Math.sin((time || 0) * 1.3 + 1);
    }
    // Quest sites for quests.js (STORY.md contract): every point walkable, clear of colliders and of the fixed formations.
    var questSites = {};
    [['ledger-seal-1', 5, -5, 3], ['ledger-seal-2', 6, -3, 6], ['ledger-seal-3', 7, -4, 7], ['selvi-cell', 10, 11, -4.5], ['selvi-goal', 11, 3, 3.5], ['c5.hunt', 8, -10, -3],
      ['c5.page1', 2, -8.5, -3.5], ['c5.page2', 9, 12, -1], ['c5.page3', 12, -9, 5], ['c5.altar', 1, 14, -5]].forEach(function (q) { var r = rooms[q[1]]; questSites[q[0]] = { x: r.x + q[2], z: r.z + q[3], room: q[1] }; });
    root.updateMatrixWorld(true);
    B.FinaleWorld.lastBuildMs = Math.round(performance.now() - buildT0);
    return { chapter: chapter, name: KabirI18n.t('Son Mahkeme'), root: root, rooms: rooms, paths: paths, encounters: encounters, colliders: colliders, occluders: [], materials: materials, questSites: questSites, spawn: { x: 0, z: 14 }, checkpoint: { x: 0, z: rooms[11].z }, bossSpawn: { x: 0, z: rooms[13].z - 2 },
      isWalkable: isWalkable, move: move, hasClearPath: hasClearPath, pathTo: pathTo, roomAt: roomAt, update: update, atmosphereAt: atmosphereAt, effectHeightAt: function () { return .065; },
      setQuality: function (cfg) { quality = typeof cfg === 'string' ? cfg : cfg.quality || cfg.preset || 'high'; },
      lighting: { sources: sources, flames: flames, shafts: [], moods: [live], groupGain: groupGain, prepareTextures: function () { return textures; }, setGroup: function (k, v) { groupGain[k] = v; }, setGroupTint: function () {}, setCorpses: function () {}, setOathGlow: function (v, lit) { oath = !!lit; }, setPlayerLightFx: function () {}, wantsShadows: function () { return false; } },
      dispose: function () { if (disposed) return; disposed = true; geometries.forEach(function (g) { g.dispose(); }); K.dispose(); Object.keys(materials).forEach(function (k) { materials[k].dispose(); }); textures.forEach(function (t) { t.dispose(); }); lights.forEach(function (l) { l.dispose(); }); root.removeFromParent(); root.clear(); }
    };
  }
  // Objective line for app.js (chapter V only).
  function objective(game, room, key) {
    if (game.state === 'won') return KabirI18n.t('Hüküm kırıldı. Kabir sustu.');
    if (!room) return KabirI18n.t('Boşluğun üstündeki köprülerden kuzeye ilerle.');
    if (room.id === 11) return game.checkpointIndex ? KabirI18n.t('Son Tanıklık mühürlendi. Kürsü Merdiveni’ni çık.') : KabirI18n.t('Son Tanıklık taşına yaklaş ve ') + key + KabirI18n.t(' ile dokun.');
    if (room.id === 13) return KabirI18n.t('Kara Kadı’yı yen. Hüküm halkalarının boşluklarını ve terazinin dengesini izle.');
    var n = game.enemies.filter(function (e) { return !e.dead && !e.reserve && e.encounter.room === room.id; }).length;
    return n ? KabirI18n.t('Bu platformda ') + n + KabirI18n.t(' düşman var.') : KabirI18n.t('Kuzeydeki köprüye ilerle.');
  }
  B.FinaleWorld = { build: build, objective: objective };
}());
