/* KABİR AZABI — Chapter II: Kara Kıyı. Static, textured coastal ruins; shared combat/navigation contract. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, PI = Math.PI;
  var ROOMS = [
    { id: 0, name: KabirI18n.t('Yanmış Mezarlık'), x: 0, z: 4, w: 24, d: 22 },
    { id: 1, name: KabirI18n.t('Köklerin Yolu'), x: 0, z: -23, w: 24, d: 24 },
    { id: 2, name: KabirI18n.t('Boğulmuş Sokak'), x: 0, z: -52, w: 24, d: 24 },
    { id: 3, name: KabirI18n.t('Çürük İskele'), x: 0, z: -81, w: 24, d: 26 },
    { id: 4, name: KabirI18n.t('Kara Kök Meydanı'), x: 0, z: -112, w: 26, d: 26 },
    { id: 5, name: KabirI18n.t('Son Fener'), x: 0, z: -140, w: 22, d: 20 },
    { id: 6, name: KabirI18n.t('Boğulmuş Çanlık'), x: 0, z: -172, w: 32, d: 36 }
  ];
  var ENCOUNTERS = [
    { id: 'burnt-graves', room: 0, name: KabirI18n.t('Toprak Ölülerini Bırakmıyor'), clearText: KabirI18n.t('Kökler geri çekildi. Orman yoluna ilerle.'), spawns: [
      { type: 'drowned', x: -4, z: 1 }, { type: 'drowned', x: 4, z: -2 }, { type: 'crawler', x: 0, z: -4 }] },
    { id: 'root-road', room: 1, name: KabirI18n.t('Kara Kök Nöbeti'), clearText: KabirI18n.t('Yanmış ağaçlar sustu. Kasaba aşağıda.'), spawns: [
      { type: 'rootborn', x: -5, z: -18 }, { type: 'crawler', x: 5, z: -20 }, { type: 'drowned', x: -3, z: -25 },
      { type: 'urchin', x: 4, z: -27 }, { type: 'crawler', x: 0, z: -30 }] },
    { id: 'drowned-street', room: 2, name: KabirI18n.t('Denizin Geri Verdiği'), clearText: KabirI18n.t('Boğulmuş sokak açıldı. İskeleye git.'), spawns: [
      { type: 'drowned', x: -4, z: -45 }, { type: 'rootborn', x: 4, z: -47 }, { type: 'lantern', x: -6, z: -53 },
      { type: 'urchin', x: 5, z: -55 }, { type: 'drowned', x: -2, z: -58 }, { type: 'crawler', x: 3, z: -60 }] },
    { id: 'rotting-pier', room: 3, name: KabirI18n.t('İskelenin Altındaki Sesler'), clearText: KabirI18n.t('İskele sustu. Meydanın köklerini kes.'), spawns: [
      { type: 'urchin', x: -5, z: -73 }, { type: 'drowned', x: 4, z: -74 }, { type: 'crawler', x: -3, z: -79 },
      { type: 'lantern', x: 6, z: -81 }, { type: 'rootborn', x: 0, z: -84 }, { type: 'urchin', x: -5, z: -88 }, { type: 'crawler', x: 4, z: -90 }] },
    { id: 'black-root-square', room: 4, name: KabirI18n.t('Kıyının Son Nöbeti'), clearText: KabirI18n.t('Meydan açıldı. Son Fener’de yemini mühürle.'), spawns: [
      { type: 'rootborn', x: -6, z: -104 }, { type: 'rootborn', x: 6, z: -104 }, { type: 'lantern', x: 0, z: -111 },
      { type: 'drowned', x: -4, z: -112 }, { type: 'crawler', x: 5, z: -114 }, { type: 'urchin', x: -6, z: -118 },
      { type: 'lantern', x: 5, z: -120 }, { type: 'drowned', x: 0, z: -121 }] },
    { id: 'bell-of-the-deep', room: 6, name: KabirI18n.t('Derinliklerin Çancısı'), spawns: [{ type: 'bell', x: 0, z: -178, boss: true }] }
  ];
  function build(scene) {
    var root = new T.Group(); root.name = KabirI18n.t('Kara Kıyı'); scene.add(root);
    var rooms = ROOMS.map(function (r) { return Object.assign({}, r); });
    var colliders = [], occluders = [], textures = [], geometries = [], materials = {}, batches = {}, roomGroups = [];
    var animated = [], lightSources = [], lights = [], disposed = false, seed = 47291, quality = 'high';
    var heroCut = { value: new T.Vector3(0,1.2,10) };
    var clock = { value: 0 }, calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3(), rotation = new T.Quaternion(), euler = new T.Euler();
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    function geo(g) { geometries.push(g); return g; }
    // Texture scale is in metres, never in the stretched UVs of a unit box.
    // Only curved rocks use three-plane sampling; flat terrain and buildings keep one sample per map.
    function surface(key, source, color, roughness, metalness) {
      var scans={stone:'paving',wall:'wall',floor:'paving',sand:'sand',earth:'mud',char:'bark',wood:'wood',rock:'rock'};
      var props=scans[key]?B.CoastMaterials.createSurface(scans[key],textures):B.Materials.createSurface(source,textures,1);
      var m=new T.MeshStandardMaterial(Object.assign(props,{color:color,roughness:roughness,metalness:metalness||0,aoMapIntensity:.48}));
      var scale={sand:.28,earth:.38,stone:.48,wall:.20,floor:.48,wood:.29,char:.65,rock:.48}[key]||.5;
      var tint={sand:[.94,.87,.73],earth:[.68,.62,.52],stone:[.83,.83,.76],wall:[.68,.68,.65],floor:[.86,.84,.77],wood:[1.48,1.28,1.04],char:[.48,.45,.39],rock:[.66,.72,.73]}[key];
      if(tint)m.color.setRGB(tint[0],tint[1],tint[2],T.LinearSRGBColorSpace);
      if(scans[key]){
        m.onBeforeCompile=function(sh){
          sh.uniforms.coastHero=heroCut;sh.uniforms.coastGrime={value:B.Materials.noise()};sh.uniforms.coastTile={value:scale};
          var decl='varying vec3 coastWorld;varying vec3 coastNormal;varying float coastSeed;uniform float coastTile;';
          var vertex=[
            'vec4 coastP=vec4(transformed,1.);vec3 coastN=objectNormal;vec3 coastScale=vec3(1.);vec2 coastId=modelMatrix[3].xz;',
            '#ifdef USE_INSTANCING',
            'coastScale=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));',
            'coastP=instanceMatrix*coastP;coastN=mat3(instanceMatrix)*(coastN/max(coastScale*coastScale,vec3(.0001)));coastId+=instanceMatrix[3].xz+instanceMatrix[3].y;',
            '#endif',
            'coastWorld=(modelMatrix*coastP).xyz;coastNormal=normalize(mat3(modelMatrix)*coastN);',
            'coastSeed=fract(sin(dot(coastId,vec2(12.9898,78.233)))*43758.5453);',
            'vec3 ca=abs(coastNormal);vec2 cuv=ca.y>.6?coastWorld.xz:(ca.x>ca.z?coastWorld.zy:coastWorld.xy);',
            'cuv*=coastTile;'
          ];
          if(key==='wood')vertex.push(
            'vec3 la=abs(objectNormal);vec3 lp=transformed*coastScale;vec2 panel=la.y>.6?vec2(lp.x,lp.z):(la.x>la.z?vec2(lp.z,lp.y):vec2(lp.x,lp.y));',
            'vec2 panelScale=la.y>.6?coastScale.xz:(la.x>la.z?coastScale.zy:coastScale.xy);',
            'cuv=panelScale.x>=panelScale.y?vec2(panel.x*.29,panel.y*.10):vec2(panel.y*.29,panel.x*.10);',
            'cuv+=vec2(coastSeed*2.17,floor(coastSeed*8.)*.125);'
          );
          if(key==='stone'||key==='floor')vertex.push('cuv+=vec2(coastSeed*3.17,fract(coastSeed*13.7)*2.31);');
          if(key==='char')vertex.push('cuv=vMapUv*vec2(.85,.12*max(coastScale.x,max(coastScale.y,coastScale.z)));');
          ['Map','NormalMap','RoughnessMap','MetalnessMap','AoMap'].forEach(function(k){vertex.push('#ifdef USE_'+k.toUpperCase());vertex.push('v'+k+'Uv=cuv;','#endif');});
          sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+decl).replace('#include <fog_vertex>','#include <fog_vertex>\n'+vertex.join('\n'));
          sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+decl+'uniform vec3 coastHero;uniform sampler2D coastGrime;')
            .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 cr=cameraPosition-coastHero;float cd=length(cr);cr/=max(cd,.01);vec3 cp=coastWorld-coastHero;float ct=dot(cp,cr);if(coastWorld.y>1.7&&ct>.35&&ct<cd-.6){float cc=smoothstep(1.0,2.0,length(cp-cr*ct));float ch=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);if(ch>cc)discard;}')
            .replace('#include <color_fragment>','#include <color_fragment>\nvec2 grime=texture2D(coastGrime,coastWorld.xz*.047+coastWorld.y*.021).rg;float damp=(1.-smoothstep(.08,2.0,coastWorld.y))*smoothstep(.28,.73,grime.r);float salt=smoothstep(.74,.94,grime.g)*(1.-smoothstep(.3,1.8,coastWorld.y));diffuseColor.rgb*=mix(vec3(.83,.85,.82),vec3(1.12,1.07,.95),smoothstep(.24,.78,grime.g));diffuseColor.rgb*=mix(vec3(1.),vec3(.57,.66,.63),damp*.44);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.34,.29),salt*.12);');
          if(key==='wall'||key==='rock')sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),diffuseColor.rgb,.42);');
          if(key==='sand'||key==='earth'||key==='wood')sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(.39,roughnessFactor*.72),damp);');
          if(key==='rock'){
            var tri='vec3 cw=pow(abs(normalize(coastNormal)),vec3(6.));cw/=max(cw.x+cw.y+cw.z,.001);vec3 csign=sign(coastNormal);vec3 cpos=coastWorld*coastTile;vec2 cx=vec2(cpos.z*csign.x,cpos.y),cy=vec2(cpos.x*csign.y,-cpos.z),cz=vec2(-cpos.x*csign.z,cpos.y);';
            sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',tri+'\ndiffuseColor*=texture2D(map,cx)*cw.x+texture2D(map,cy)*cw.y+texture2D(map,cz)*cw.z;vec3 cArm=texture2D(roughnessMap,cx).rgb*cw.x+texture2D(roughnessMap,cy).rgb*cw.y+texture2D(roughnessMap,cz).rgb*cw.z;')
              .replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*cArm.g;')
              .replace('#include <metalnessmap_fragment>','float metalnessFactor=metalness*cArm.b;')
              .replace('#include <aomap_fragment>',T.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r','cArm.r'))
              .replace('#include <normal_fragment_maps>','vec3 cnx=texture2D(normalMap,cx).xyz*2.-1.;vec3 cny=texture2D(normalMap,cy).xyz*2.-1.;vec3 cnz=texture2D(normalMap,cz).xyz*2.-1.;cnx.xy*=normalScale;cny.xy*=normalScale;cnz.xy*=normalScale;vec3 cbase=normalize(coastNormal);vec3 cbx=vec3(cbase.x,cnx.y+cbase.y,cnx.x*csign.x+cbase.z);vec3 cby=vec3(cny.x*csign.y+cbase.x,cbase.y,-cny.y+cbase.z);vec3 cbz=vec3(-cnz.x*csign.z+cbase.x,cnz.y+cbase.y,cbase.z);normal=normalize(mat3(viewMatrix)*(cbx*cw.x+cby*cw.y+cbz*cw.z));');
          }
        };
        m.customProgramCacheKey=function(){return 'kara-coast-scans-84-'+key;};
      }
      var strength=key==='sand'?.65:key==='wood'?.72:key==='char'?.82:key==='rock'?1.05:.9;
      m.normalScale.set(strength,strength);m.name='coast-'+key;materials[key]=m;return m;
    }
    surface('stone','masonry',0xffffff,.92);surface('wall','masonry',0xffffff,.93);surface('rock','masonry',0xffffff,.9);
    surface('floor','floor',0xffffff,.9);surface('sand','floor',0xffffff,.96);
    surface('earth','masonry',0xffffff,.96);surface('char','wood',0xffffff,.94);
    surface('wood','wood',0xffffff,.90);surface('rust','rust',0x908474,.74,.5);
    surface('cloth','linen',0x827c65,.96);surface('flesh','leather',0x57443d,.6);
    materials.cloth.side = T.DoubleSide;
    // Roots share the scanned bark and compiled material; exposed ridges catch the coastal light.
    materials.root=materials.char.clone();materials.root.name='coast-root';
    materials.root.color.setRGB(.63,.58,.48,T.LinearSRGBColorSpace);materials.root.normalScale.set(1.12,1.12);
    materials.root.onBeforeCompile=materials.char.onBeforeCompile;materials.root.customProgramCacheKey=materials.char.customProgramCacheKey;
    materials.funeralPaving=materials.floor.clone();materials.funeralPaving.name='coast-funeral-paving';
    materials.funeralPaving.color.multiplyScalar(.68);materials.funeralPaving.roughness=.98;
    materials.funeralPaving.onBeforeCompile=materials.floor.onBeforeCompile;materials.funeralPaving.customProgramCacheKey=materials.floor.customProgramCacheKey;
    materials.grave=materials.earth.clone();materials.grave.name='coast-grave';materials.grave.onBeforeCompile=materials.earth.onBeforeCompile;materials.grave.customProgramCacheKey=materials.earth.customProgramCacheKey;

    materials.rope=new T.MeshStandardMaterial({color:0x766951,roughness:.96,map:materials.cloth.map,normalMap:materials.cloth.normalMap});
    materials.puddle=new T.MeshStandardMaterial({color:0x24363b,roughness:.28,metalness:0,normalMap:B.Materials.rippleNormal(),normalScale:new T.Vector2(.08,.08)});
    materials.dark = new T.MeshStandardMaterial({ color: 0x101917, roughness: .8 });
    materials.bone = new T.MeshStandardMaterial({ color: 0x8c8a6a, roughness: .8, normalMap: materials.stone.normalMap });
    materials.gold = new T.MeshStandardMaterial({ color: 0x755d2f, roughness: .48, metalness: .7 });
    materials.lamp = new T.MeshStandardMaterial({ color: 0x547b74, emissive: 0x87c5b7, emissiveIntensity: .7, roughness: .3 });
    materials.oath = new T.MeshStandardMaterial({ color: 0x88816d, emissive: 0xe8aa56, emissiveIntensity: .3, roughness: .7 });
    materials.ember = new T.MeshStandardMaterial({ color: 0x1a0c08, emissive: 0xd8400c, emissiveIntensity: 1.15, roughness: .9 });
    var box = geo(new T.BoxGeometry(1, 1, 1)), sphere = geo(new T.IcosahedronGeometry(1, 2));
    var cylinder = geo(new T.CylinderGeometry(1, 1, 1, 12)), cone = geo(new T.ConeGeometry(1, 1, 12));
    var ring = geo(new T.TorusGeometry(1, .065, 6, 20));
    var graveShape=new T.Shape();graveShape.moveTo(-.45,0);graveShape.lineTo(.45,0);graveShape.lineTo(.45,.92);graveShape.quadraticCurveTo(.43,1.30,0,1.37);graveShape.quadraticCurveTo(-.43,1.30,-.45,.92);graveShape.closePath();
    var headstone=geo(new T.ExtrudeGeometry(graveShape,{depth:.19,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.03,curveSegments:8}));headstone.translate(0,0,-.095);
    var plank=geo(new T.BoxGeometry(1,1,1,8,1,2)), vp=plank.attributes.position;
    for(var j=0;j<vp.count;j++){var xx=vp.getX(j),yy=vp.getY(j),zz=vp.getZ(j);vp.setXYZ(j,xx+(Math.abs(xx)>.49?Math.sin(zz*31+yy*11)*.013:0),yy,zz+(Math.abs(zz)>.49?Math.sin(xx*22+yy*13)*.014:0));}plank.computeVertexNormals();
    var branch=geo(new T.CylinderGeometry(.62,1,1,14,4)),bv=branch.attributes.position;for(var j=0;j<bv.count;j++){var x=bv.getX(j),z=bv.getZ(j),a=Math.atan2(z,x),k=1+Math.sin(a*7+bv.getY(j)*3)*.035;bv.setXYZ(j,x*k,bv.getY(j),z*k);}branch.computeVertexNormals();
    var pebble = geo(new T.IcosahedronGeometry(1, 0)), rock = geo(new T.IcosahedronGeometry(1, 2)), rp = rock.attributes.position;
    for (var i = 0; i < rp.count; i++) { var xx=rp.getX(i),yy=rp.getY(i),zz=rp.getZ(i),k=.96+Math.sin(xx*3.2+yy*2.1)*.075+Math.cos(zz*2.8-xx*1.7)*.09;rp.setXYZ(i,Math.max(-.75,Math.min(.88,xx*k)),Math.max(-.58,Math.min(.62,yy*k)),Math.max(-.79,Math.min(.84,zz*k))); }
    B.Gear.smoothNormals(rock,2.6);
    // Reusable chipped masonry and curved burnt-tree silhouettes. Prepared only at level load.
    var blockShape=new T.Shape();blockShape.moveTo(-.5,-.5);blockShape.lineTo(.5,-.5);blockShape.lineTo(.5,.5);blockShape.lineTo(-.5,.5);blockShape.closePath();
    var masonry=geo(new T.ExtrudeGeometry(blockShape,{depth:.92,bevelEnabled:true,bevelSize:.025,bevelThickness:.04,bevelSegments:1,steps:1}));masonry.translate(0,0,-.46);
    var wedgeShape=new T.Shape();for(var k=0;k<=5;k++){var a=k/5*PI/10;var xx=Math.cos(a),yy=Math.sin(a);if(k===0)wedgeShape.moveTo(xx,yy);else wedgeShape.lineTo(xx,yy);}for(var k=5;k>=0;k--){var a=k/5*PI/10;wedgeShape.lineTo(Math.cos(a)*.73,Math.sin(a)*.73);}wedgeShape.closePath();
    var archStone=geo(new T.ExtrudeGeometry(wedgeShape,{depth:.30,bevelEnabled:true,bevelSize:.018,bevelThickness:.015,bevelSegments:1,steps:1}));archStone.translate(0,0,-.15);
    var paving=[];
    for(var j=0;j<3;j++){var shape=new T.Shape();shape.moveTo(-.48,-.43);shape.lineTo(.34,-.49);shape.lineTo(.49,-.32);shape.lineTo(.45,.38);shape.lineTo(.25,.48);shape.lineTo(-.39,.44);shape.lineTo(-.50,.24);shape.closePath();var g=new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.025,bevelThickness:.008,bevelSegments:1,steps:1});g.rotateX(-PI/2);g.translate(0,-.038,0);var p=g.attributes.position;for(var k=0;k<p.count;k++)p.setXYZ(k,p.getX(k)+Math.sin(p.getZ(k)*9+j*2)*.025,p.getY(k),p.getZ(k)+Math.sin(p.getX(k)*7+j)*.025);g.computeVertexNormals();paving.push(geo(g));}
    // Static roots have flattened, twisted bark ridges rather than a perfectly circular hose profile.
    function rootTube(points,radius,phase) {
      var radial=16,segments=32,curve=new T.CatmullRomCurve3(points.map(function(p){return p.isVector3?p:new T.Vector3().fromArray(p);}),false,'centripetal');
      var g=B.Gear.tube(points,radius,radial,segments,true),p=g.attributes.position,c=new T.Vector3();
      for(var row=0;row<=segments;row++){
        var t=row/segments;curve.getPointAt(t,c);
        for(var col=0;col<=radial;col++){
          var i=row*(radial+1)+col,a=col/radial*PI*2;
          var ridge=1+.16*Math.cos(a*7+t*8+phase)+.045*Math.sin(t*23+phase)*Math.sin(a*3);
          p.setXYZ(i,c.x+(p.getX(i)-c.x)*ridge,c.y+(p.getY(i)-c.y)*ridge*.72,c.z+(p.getZ(i)-c.z)*ridge);
        }
      }
      g.computeVertexNormals();
      // Weld only the lighting at the UV seam, retaining the distinct bark coordinates.
      var n=g.attributes.normal,v=new T.Vector3();
      for(var row=0;row<=segments;row++){var a=row*(radial+1),b=a+radial;v.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
      return g;
    }
    var burialMound=geo(new T.SphereGeometry(1,16,10)),bp=burialMound.attributes.position;
    for(var i=0;i<bp.count;i++){var x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i);bp.setXYZ(i,x*(1+.07*Math.sin(z*8)),y*(1+.12*Math.sin(x*7+z*5)),z*(1+.06*Math.cos(x*9)));}burialMound.computeVertexNormals();
    var treeShapes=[],treeTrunks=[],treeJunctions=[];
    for(var variant=0;variant<3;variant++){
      var pieces=[],bend=.15+variant*.035;
      var trunkPoints=[[0,-.035,0],[-bend*.4,.23,.018],[bend*.18,.57,-.015],[bend,.82,.035],[bend*.75,1,.05]];
      var trunkCurve=new T.CatmullRomCurve3(trunkPoints.map(function(p){return new T.Vector3().fromArray(p);}));
      treeTrunks.push(trunkCurve);
      pieces.push(B.Gear.tube(trunkPoints,function(t){return .045*Math.pow(1-t,.62)+.007;},8,22,true));
      for(var b=0;b<6;b++){
        // Find the real trunk centre at the branch height; an approximate x offset left upper branches floating.
        var a=b*2.399+variant*.8,yy=.28+b*.095,len=.20+(b%3)*.055,lo=0,hi=1;
        for(var step=0;step<18;step++){var mid=(lo+hi)*.5;if(trunkCurve.getPointAt(mid).y<yy)lo=mid;else hi=mid;}
        var t=(lo+hi)*.5,base=trunkCurve.getPointAt(t),tr=.045*Math.pow(1-t,.62)+.007;
        var direction=new T.Vector3(Math.cos(a),0,Math.sin(a)),rise=.11+(b%2)*.065;
        var branchPoints=[base.clone().add(new T.Vector3(0,-.009,0)),base.clone().addScaledVector(direction,len*.23).add(new T.Vector3(0,.015,0)),base.clone().add(new T.Vector3(Math.cos(a+.12)*len*.70,rise*.50,Math.sin(a+.12)*len*.70)),base.clone().add(new T.Vector3(Math.cos(a+.30)*len,rise,Math.sin(a+.30)*len))];
        pieces.push(B.Gear.tube(branchPoints,function(t){return .016*Math.pow(1-t,.85)+.002;},6,10,true));
        pieces.push(B.Gear.sphere(tr*1.05,[base.x,base.y,base.z],[1,1.15,1],8,5));
        treeJunctions.push({variant:variant,distance:branchPoints[0].distanceTo(base),radius:tr});
        if(b%2===0){var forkCurve=new T.CatmullRomCurve3(branchPoints),fork=forkCurve.getPoint(.64);pieces.push(B.Gear.tube([fork,fork.clone().add(new T.Vector3(Math.cos(a-.6)*len*.18,.035,Math.sin(a-.6)*len*.18)),fork.clone().add(new T.Vector3(Math.cos(a-.9)*len*.42,.11,Math.sin(a-.9)*len*.42))],function(t){return .007*(1-t)+.0015;},5,6,true));}
      }
      for(var b=0;b<5;b++){var a=b*1.25+variant;pieces.push(B.Gear.tube([[0,.075,0],[Math.cos(a)*.10,.028,Math.sin(a)*.10],[Math.cos(a+.18)*.24,-.025,Math.sin(a+.18)*.24]],function(t){return .028*Math.pow(1-t,1.1)+.002;},6,8,true));}
      var treeGeo=geo(B.Gear.merge(pieces));treeGeo.userData.coastJunctions=treeJunctions.filter(function(j){return j.variant===variant;});treeShapes.push(treeGeo);
    }
    rooms.forEach(function (r) { var g = new T.Group(); g.name = r.name; root.add(g); roomGroups.push(g); });
    // Open coast (src/coast-open.js): organic side areas, a western cliff trail, a hill and a mole; one sculpted terrain around them.
    function mainTest(x,z){for(var i=0;i<rooms.length;i++){var r=rooms[i];if(x>=-r.w*.5&&x<=r.w*.5-4&&Math.abs(z-r.z)<=r.d*.5)return true;}return Math.abs(x)<=3.3&&z>=-190&&z<=15;}
    var open=B.CoastOpen.layout(rooms);open.mainTest=mainTest;
    var ground=B.CoastOpen.heightField(open);
    open.rooms.forEach(function(r){var g=new T.Group();g.name=r.name;root.add(g);roomGroups[r.id]=g;});
    function add(room, g, mat, x, y, z, sx, sy, sz, rx, ry, rz) {
      // Legacy rubble of the main road never lands on the open areas' walking floor; on the slopes it follows the terrain.
      if(room<7&&(mat==='rock'||mat==='char')&&x<-9){
        if(g===rock&&sy>.2&&open.floorTest(x,z,-Math.max(sx,sz)*.5)&&!mainTest(x,z))return;
        y+=ground.y(x,z);
      }
      // nothing solid-looking stands on the walkable strand: shore rocks are pushed seaward
      if(room<6&&room!==3&&g===rock&&mat==='rock'&&x>8&&sy>.2)x=Math.max(x,11.7+Math.max(sx,sz)*.8);
      var key = room + ':' + g.id + ':' + mat;
      if (!batches[key]) batches[key] = { room: room, geo: g, mat: materials[mat], matrices: [] };
      position.set(x, y, z); scale.set(sx, sy, sz); rotation.setFromEuler(euler.set(rx || 0, ry || 0, rz || 0));
      matrix.compose(position, rotation, scale); batches[key].matrices.push(matrix.clone());
    }
    function beam(room, mat, a, b, radius) {
      var p = new T.Vector3().fromArray(a), d = new T.Vector3().fromArray(b).sub(p), length = d.length();
      p.addScaledVector(d, .5); rotation.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      var g=mat==='char'?branch:cylinder,key = room + ':' + g.id + ':' + mat;
      if (!batches[key]) batches[key] = { room: room, geo: g, mat: materials[mat], matrices: [] };
      matrix.compose(p, rotation, new T.Vector3(radius, length, radius)); batches[key].matrices.push(matrix.clone());
    }
    function collision(x, z, w, d) { colliders.push({ x: x, z: z, w: w, d: d }); }
    function tree(room, x, z, h, trunk, leaning, y, force) {
      var baseRadius=Math.max(1,h*.16,trunk*5);
      var variant=Math.floor(rnd()*3),shape=treeShapes[variant],width=Math.max(h*.64,trunk*20);
      if(!force&&(open.floorTest(x,z,-baseRadius*.6)||mainTest(x,z))){rnd();return {at:function(){return new T.Vector3(x,0,z);}};}
      var key=room+':'+shape.id+':char';if(!batches[key])batches[key]={room:room,geo:shape,mat:materials.char,matrices:[]};
      position.set(x,y==null?ground.y(x,z)-.15:y,z);scale.set(width,h,width);rotation.setFromEuler(euler.set(0,rnd()*PI*2,(leaning||0)/h*.25));
      matrix.compose(position,rotation,scale);batches[key].matrices.push(matrix.clone());
      var transform=matrix.clone();
      // Split charred stump and a low broken limb distinguish fallen trunks from living silhouettes.
      var by=position.y+.15;if(trunk>.45)beam(room,'char',[x,by+.7,z],[x+.45,by+2.0,z-.35],trunk*.20);
      return {at:function(t){return treeTrunks[variant].getPointAt(t).applyMatrix4(transform);}};
    }
    function grave(room, x, z, angle, broken) {
      add(room, burialMound, 'grave', x, -.025, z, .62, .15, 1.13, 0, angle, 0);
      // Low stone borders frame the earth without adding an invisible obstacle to the route.
      for(var side=-1;side<=1;side+=2)add(room,masonry,'stone',x+side*Math.cos(angle)*.65,.035,z-side*Math.sin(angle)*.65,.13,.09,2.25,0,angle,broken?side*.06:0);
      add(room, headstone, 'stone', x, .035, z - .75, 1, 1, 1, broken ? .3 : 0, angle, broken ? .16 : 0);
      add(room, box, 'stone', x, .10, z-.75, 1.12, .18, .45, 0, angle, 0);
      for(var j=0;j<3;j++)add(room,box,'dark',x,.45+j*.095,z-.858,.40-j*.045,.014,.012,0,angle,0);
      add(room, box, 'dark', x, .89, z - .9, .06, .45, .024, 0, angle, 0);
      add(room, box, 'dark', x, .95, z - .9, .27, .06, .024, 0, angle, 0);
      if (broken) add(room, rock, 'rock', x + .45, .13, z + .6, .3, .15, .32, 0, angle, 0);
    }
    function lantern(room, x, y, z, group, warm) {
      add(room, box, 'rust', x, y - .34, z, .42, .04, .42); add(room, box, 'rust', x, y + .34, z, .42, .04, .42); add(room, box, 'lamp', x, y, z, .24, .52, .24);
      for (var a = 0; a < 4; a++) { var th = a * PI / 2 + PI / 4; add(room, cylinder, 'rust', x + Math.cos(th) * .17, y, z + Math.sin(th) * .17, .028, .65, .028); }
      add(room, cone, 'rust', x, y + .48, z, .3, .25, .3);
      var color = new T.Color(warm ? 0xe4a763 : 0x81b8ab);
      lightSources.push({ x: x, y: y, z: z, color: color, intensity: warm ? 2.4 : 2.8, scatter: .9, glowRadius: 1.6, live: 1, group: group || 'coast', room: room });
    }
    function building(room, x, z, w, d, h, angle) {
      collision(x, z, w + .3, d + .3);
      var ca=Math.cos(angle),sa=Math.sin(angle),front=d*.5;
      function part(g,mat,px,py,pz,sx,sy,sz,rx,ry,rz){add(room,g,mat,x+px*ca+pz*sa,py,z-px*sa+pz*ca,sx,sy,sz,rx||0,angle+(ry||0),rz||0);}
      function arch(px,yy,pz,r){for(var j=0;j<10;j++)part(archStone,'stone',px,yy,pz,r,r,1,0,0,j*PI/10);}
      part(masonry,'stone',0,.08,0,w+.35,.16,d+.35);
      // Hollow rooms: wall segments surround real openings, rather than painting black windows on a box.
      var spans=[[-w*.5,-w*.30-.47],[-w*.30+.47,-.72],[.72,w*.30-.47],[w*.30+.47,w*.5]];
      for(var j=0;j<spans.length;j++){var a=spans[j][0],b=spans[j][1];if(b>a)part(masonry,'wall',(a+b)*.5,h*.45,front,b-a,h*.9,.43);}
      for(var side=-1;side<=1;side+=2){
        var wx=side*w*.30,wy=h*.57;
        part(masonry,'wall',wx,(wy-.55)*.5,front,.94,wy-.55,.43);
        part(masonry,'wall',wx,(h+wy+.53)*.5,front,.94,Math.max(.15,h-wy-.53),.43);
        for(var q=-1;q<=1;q+=2)part(masonry,'stone',wx+q*.48,wy,front+.05,.14,1.12,.56);
        arch(wx,wy+.16,front+.12,.56);
        part(masonry,'stone',wx,wy-.57,front+.10,1.20,.13,.66);
        part(plank,'wood',wx,wy-.10,front+.28,1.13,.13,.08,0,0,side*.27);
        if(side<0)part(plank,'wood',wx,wy+.14,front+.29,1.02,.12,.07,0,0,-.31);
        // The gapped shutter hangs away from the opening, with visible hinges.
        part(plank,'wood',wx+side*.62,wy,front+.23,.34,.92,.06,0,side*.4,side*.11);
        for(var yy=0;yy<2;yy++)part(box,'rust',wx+side*.46,wy-.28+yy*.53,front+.3,.10,.045,.06);
      }
      part(masonry,'stone',0,(h+2.08)*.5,front,1.44,Math.max(.3,h-2.08),.43);
      for(var side=-1;side<=1;side+=2)part(masonry,'stone',side*.78,1.01,front+.04,.24,2.04,.63);
      arch(0,1.61,front+.10,.92);
      // A door remains ajar; the recess and broken interior beams are genuinely behind it.
      part(plank,'wood',-.55,.86,front+.18,.43,1.7,.085,0,-.55,.07);
      part(masonry,'stone',0,.12,front+.45,1.75,.19,1.0);
      for(var side=-1;side<=1;side+=2){
        for(var row=0;row<7;row++){
          var yy=.22+row*h/7,len=d*(row===6?.72:row===5?.89:1);
          part(masonry,'wall',side*w*.5,yy,-(d-len)*.5,.42,h/7*.95,len);
          part(masonry,'stone',side*(w*.5-.04),yy,front+.08,.57,h/7*.87,.57,0,0,(rnd()-.5)*.045);
        }
        part(box,'wood',side*w*.46,h*.45,front+.27,.13,h*.9,.14);
        part(box,'wood',side*w*.28,h*.47,front+.3,.10,h*.90,.13,0,0,side*.3);
      }
      part(masonry,'wall',0,h*.43,-d*.5,w,h*.86,.4);
      for(var row=0;row<2;row++)for(var col=0;col<Math.ceil(w/.63);col++){if((col+room+row)%5===0)continue;part(masonry,'stone',-w*.46+col*.63,h*.89+row*.23,front,.60,.24,.47,0,0,(rnd()-.5)*.12);}
      part(box,'wood',0,h*.28,front+.28,w,.11,.15);part(box,'wood',0,h*.87,front+.28,w,.13,.15);
      var ridge=h+.35+d*.24;
      for(var col=0;col<7;col++)for(var side=-1;side<=1;side+=2){
        var xx=-w*.44+col*w*.145;
        part(box,'char',xx,ridge-d*.15,side*d*.28,.085,.10,d*.70,side*.53);
        for(var row=0;row<4;row++){if((col+row*3+room)%7<2)continue;var zz=side*(.07+row*.15)*d;part(plank,'wood',xx,ridge-Math.abs(zz)*.59,zz,w*.151,.075,d*.19,side*.53,0,(rnd()-.5)*.035);}
      }
      part(box,'char',0,ridge,0,w+.3,.17,.18);
      for(var q=0;q<8;q++){var xx=(rnd()-.5)*w;part(masonry,'stone',xx,.12,front+.55+rnd()*.7,.25+rnd()*.3,.15+rnd()*.15,.32,0,rnd()*6,(rnd()-.5)*.3);}
      part(masonry,'stone',w*.28,h+.7,-d*.14,.64,1.35,.64,0,0,.08);part(masonry,'stone',w*.29,h+1.40,-d*.14,.83,.16,.80);
      part(box,'dark',w*.29,h+1.49,-d*.14,.43,.02,.4);
      // Salt-worn entry paving connects each ruin to the street without blocking the combat route.
      for(var row=0;row<3;row++)for(var col=0;col<3;col++)part(masonry,'stone',(col-1)*.64,.015,front+.9+row*.59,.58,.035,.53,0,(rnd()-.5)*.08);
    }
    function boat(room, x, z, length, angle, sunk, land, flip, hulk) {
      var g=new T.Group();g.position.set(x,land?(flip?1.02:-.12):hulk?-1.4:sunk?-.48:-.22,z);g.rotation.y=angle;g.rotation.z=flip?PI-.08:land?.16:hulk?.34:sunk?.22:.05;if(hulk)g.rotation.x=.12;
      var pieces=[],rope=[],N=20;
      function piece(geometry,sx,sy,sz,x,y,z,rx,ry,rz,list){var b=geometry.clone();scale.set(sx,sy,sz);position.set(x,y,z);rotation.setFromEuler(euler.set(rx||0,ry||0,rz||0));matrix.compose(position,rotation,scale);b.applyMatrix4(matrix);(list||pieces).push(b);}
      function spar(a,b,r,list){var pa=new T.Vector3().fromArray(a),dd=new T.Vector3().fromArray(b).sub(pa),len=dd.length();pa.addScaledVector(dd,.5);rotation.setFromUnitVectors(new T.Vector3(0,1,0),dd.normalize());matrix.compose(pa,rotation,new T.Vector3(r,len,r));var bb=cylinder.clone();bb.applyMatrix4(matrix);(list||pieces).push(bb);}
      // Four overlapping hull strakes per side; bow and stern rise clear of the water.
      for(var side=-1;side<=1;side+=2)for(var row=0;row<4;row++){
        var pos=[],uv=[],ix=[];
        for(var j=0;j<=N;j++){var t=j/N,zz=(t-.5)*length,width=Math.pow(Math.sin(t*PI),.72)*1.38;
          for(var k=0;k<2;k++){var lift=(row+k)/4;pos.push(side*width*(.40+lift*.60),.08+lift*.8+Math.pow(Math.abs(t-.5)*2,4)*.5,zz);uv.push(t*3,lift*2);}}
        for(var j=0;j<N;j++){var q=j*2;ix.push(q,q+2,q+1,q+1,q+2,q+3);}
        var hg=new T.BufferGeometry();hg.setAttribute('position',new T.Float32BufferAttribute(pos,3));hg.setAttribute('uv',new T.Float32BufferAttribute(uv,2));hg.setIndex(ix);hg.computeVertexNormals();pieces.push(hg);
        if(row===3)for(var j=0;j<N;j++){var t=j/N,tt=(j+1)/N; spar([side*Math.pow(Math.sin(t*PI),.72)*1.38,.9+Math.pow(Math.abs(t-.5)*2,4)*.5,(t-.5)*length],[side*Math.pow(Math.sin(tt*PI),.72)*1.38,.9+Math.pow(Math.abs(tt-.5)*2,4)*.5,(tt-.5)*length],.045);}
      }
      for(var j=1;j<9;j++){var t=j/10,zz=(t-.5)*length,w=Math.pow(Math.sin(t*PI),.72)*1.30;piece(plank,w*1.7,.09,.33,0,.52,zz);for(var side=-1;side<=1;side+=2)spar([side*w*.4,.12,zz],[side*w,.86,zz],.045);}
      spar([0,.12,-length*.48],[0,.12,length*.48],.10);
      if(!land){
      spar([0,.45,0],[-length*.23,length*.74,.2],.095);
      spar([-length*.23,length*.73,.2],[length*.20,length*.67,.2],.045);
      spar([-length*.23,length*.73,.2],[-1.1,.95,-length*.27],.018,rope);spar([-length*.23,length*.73,.2],[1.1,.95,length*.30],.018,rope);
      }
      piece(plank,.23,.07,1.1,1.55,.71,-length*.19,0,.32,-.13);spar([1.5,.75,-length*.16],[1.3,1.05,length*.28],.034);
      function baked(list,mat){var bb=geo(B.Gear.merge(list)),m=new T.Mesh(bb,mat);m.castShadow=m.receiveShadow=true;g.add(m);}
      // Double-sided hull preserves the visibly hollow interior. Source textures remain shared.
      if(!materials.hull){materials.hull=materials.wood.clone();materials.hull.side=T.DoubleSide;materials.hull.name='coast-hull';materials.hull.onBeforeCompile=materials.wood.onBeforeCompile;materials.hull.customProgramCacheKey=materials.wood.customProgramCacheKey;}
      baked(pieces,materials.hull);if(rope.length)baked(rope,materials.rope);
      if(land){var bc=Math.abs(Math.cos(angle)),bs=Math.abs(Math.sin(angle));collision(x,z,2.6*bc+length*bs*.9,2.6*bs+length*bc*.9);roomGroups[room].add(g);g.updateMatrixWorld(true);g.matrixAutoUpdate=false;g.children.forEach(function(c){c.matrixAutoUpdate=false;});return;}
      var sailGeo=geo(new T.PlaneGeometry(length*.38,length*.44,9,12)),pp=sailGeo.attributes.position,indices=[];
      for(var j=0;j<pp.count;j++){var yy=pp.getY(j);pp.setZ(j,.22*Math.sin(pp.getX(j)*1.7)+.14*Math.cos(yy*2.1));if(yy<-length*.10)pp.setY(j,yy+rnd()*.45);}
      var si=sailGeo.index;for(var j=0;j<si.count;j+=3){var a=si.getX(j),b=si.getX(j+1),c=si.getX(j+2);if(pp.getY(a)<0&&j%39===0)continue;indices.push(a,b,c);}sailGeo.setIndex(indices);sailGeo.computeVertexNormals();
      var sail=new T.Mesh(sailGeo,materials.cloth);sail.position.set(-length*.03,length*.51,.2);sail.rotation.y=-.3;sail.rotation.z=.18;g.add(sail);
      roomGroups[room].add(g);if(!hulk)animated.push({object:g,y:g.position.y,roll:g.rotation.z,phase:rnd()*6,boat:true});
    }
    // Static corpses are posed and baked once. They keep the artist textures without a live skeleton or per-frame animation.
    function corpseTemplate() {
      var actor = B.Models.create('drowned'), parts = [], vv = new T.Vector3();
      for (var f = 0; f < 120; f++) actor.animate(1 / 60, {dead:true,move:0,time:f/60,phase:'dead'});
      actor.root.updateMatrixWorld(true); actor.root.traverse(function (n) { if (n.isSkinnedMesh) n.skeleton.update(); });
      actor.root.traverse(function(n) {
        if (!n.isSkinnedMesh || n.userData.shadowProxy) return;
        var g = n.geometry.clone(), p = g.attributes.position;
        for (var i=0;i<p.count;i++){ vv.fromBufferAttribute(p,i); n.applyBoneTransform(i,vv); vv.applyMatrix4(n.matrixWorld); p.setXYZ(i,vv.x,vv.y,vv.z); }
        g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.deleteAttribute('tangent');g.computeVertexNormals();
        var key='coast-corpse-'+n.name;materials[key]=n.material;parts.push({geo:geo(g),mat:key});
      }); actor.dispose(); return parts;
    }
    var bodyParts = corpseTemplate();
    function corpse(room,x,z,angle) { bodyParts.forEach(function(p){add(room,p.geo,p.mat,x,.02,z,1,1,1,0,angle,0);}); }
    var skullArt = B.Gear.skull(.26,true), skullBone=geo(B.Gear.merge(skullArt.parts.bone)), skullHoles=geo(B.Gear.merge(skullArt.parts.void));
    function skull(room,x,y,z,angle){add(room,skullBone,'bone',x,y,z,1,1,1,0,angle,.2);add(room,skullHoles,'dark',x,y,z,1,1,1,0,angle,.2);}
    function cargo(room,x,z,angle) {
      add(room,box,'wood',x,.38,z,.88,.76,.88,0,angle,0);
      [-1,1].forEach(function(s){add(room,box,'rust',x+s*.30,.38,z,.045,.78,.91,0,angle,0);add(room,box,'wood',x,.4,z+s*.455,.92,.065,.06,0,angle,s*.7);});
      add(room,ring,'rope',x,.79,z,.35,.35,.35,PI/2,angle,0);
    }
    // Solid land and broad connected combat spaces. Decorative roots never block the central route.
    rooms.forEach(function (r, id) {
      add(id, box, id === 3 ? 'wood' : id<=1 ? 'earth' : id<5 ? 'sand' : 'floor', -2, -.13, r.z, r.w - 4, .26, r.d);
      if (id < 6) { var next = rooms[id + 1], lo = r.z - r.d * .5, hi = next.z + next.d * .5; add(id,box,'earth',-2,-.24,(lo+hi)*.5,r.w-4,.40,lo-hi+.8);add(id, box, id === 3 ? 'wood' : id<=1 ? 'earth' : id<5 ? 'sand' : 'floor', 0, -.13, (lo + hi) * .5, 6.6, .26, lo - hi);if(id===5)for(var side=-1;side<=1;side+=2)add(id,box,'stone',side*3.5,.035,(lo+hi)*.5,.16,.12,lo-hi+.6); }
      for (var i = 0; i < 24; i++) {
        var side = i % 2 ? 1 : -1, x = side * (r.w * .5 + .5 + rnd() * 3), z = r.z + (rnd() - .5) * r.d;
        add(id, rock, 'rock', x, .1 + rnd() * .3, z, .8 + rnd() * 1.7, .45 + rnd() * .65, .6 + rnd() * 1.5, rnd()*.25, rnd() * 6, rnd()*.25);
      }
      for (var t = 0; t < (id === 1 ? 17 : id === 6 ? 5 : 10); t++) {
        var x = -r.w * .5 - 1.5 - rnd() * 18, z = r.z + (rnd() - .5) * (r.d + 6);
        tree(id, x, z, 4 + rnd() * 7, .16 + rnd() * .22, (rnd() - .5) * 2);
      }
      // Shattered retaining wall, tide-washed pebbles and small barnacle clusters outside the route.
      if(id!==3)for(var j=0;j<9;j++){
        var shore=r.w*.5-3.55+(id<6?3.6:0),zz=r.z-r.d*.45+j*r.d*.11;
        add(id,box,'stone',shore,.12,zz,.42,.35,.95,0,(rnd()-.5)*.09,(rnd()-.5)*.07);
        if(j%3===0){add(id,rock,'rock',shore+.75,-.16,zz,.9,.45,.72,0,rnd()*3,0);for(var k=0;k<5;k++)add(id,rock,'rock',shore+.65+(rnd()-.5)*.55,.13+rnd()*.13,zz+(rnd()-.5)*.5,.055,.065,.055,0,rnd()*6,0);}
      }
      // Raised, twisted roots creep out of the forest and knot into the shoreline.
      var rootPieces=[];
      for (var n = 0; n < 5; n++) {
        var sx = -r.w * .5 + 1, zz = r.z + (rnd() - .5) * r.d * .8, points = [];
        for (var k = 0; k < 8; k++) points.push(new T.Vector3(sx + k * 1.4, .12 + Math.sin(k * .9 + n) * .08, zz + Math.sin(k * .75 + n) * .8));
        rootPieces.push(rootTube(points,function(t){return .005+(.20+Math.sin(n*2.3)*.025)*Math.pow(1-t,.92);},n*1.7));
        var fork=points[3],tip=points[5];rootPieces.push(rootTube([fork.clone(),new T.Vector3(fork.x+1.1,.06,fork.z+1.1),new T.Vector3(tip.x+.3,.01,tip.z+2.1)],function(t){return .065*Math.pow(1-t,1.1)+.003;},n*1.7+.8));
      }
      add(id,geo(B.Gear.merge(rootPieces)),'root',0,0,0,1,1,1);
      for (var q=0;q<45;q++){ var xx=(rnd()-.5)*(r.w-6)-2, zz=r.z+(rnd()-.5)*(r.d-2), sz=.08+rnd()*.23; if(Math.abs(xx)<1.7)continue; add(id,rock,'rock',xx,.035,zz,sz,.04+rnd()*.05,sz*.7,0,rnd()*6,0); }
      for(var q=0;q<5;q++){var zz=r.z+(rnd()-.5)*r.d;add(id,box,'char',-7+rnd()*13,.045,zz,1+rnd(),.07,.13,0,rnd()*6,0);}
      lantern(id, -r.w * .5 - 3.5, 2.3, r.z + r.d * .33, 'coast');
      lantern(id, r.w * .5 - 1.5, 2.3, r.z - r.d * .3, id === 6 ? 'brazier1' : 'coast');
    });
    // A continuous eroded bank hides rectangular land edges. The flat walking footprint is unchanged.
    rooms.forEach(function(r,id){if(id===3)return;var beach=id<6?3.6:0,edge=r.w*.5-4+beach,rows=6,N=Math.ceil(r.d/1.2),pos=[],uv=[],ix=[];
      // the strand: a flat, walkable band of wet sand that follows the whole shoreline (the old bank starts beyond it)
      if(beach){add(id,box,'sand',edge-beach*.5,-.13,r.z,beach+.1,.26,r.d+(id<5?6.2:0));}
      for(var j=0;j<=N;j++){var zz=r.z-r.d*.5+j*r.d/N,bulge=1.35+.65*Math.sin(zz*.41)+.38*Math.sin(zz*.97);
        for(var k=0;k<rows;k++){var t=k/(rows-1),xx=edge+t*(3.1+bulge),yy=-.018-.80*Math.pow(t,1.3)+Math.sin(zz*.6+k*.9)*.045*t;pos.push(xx,yy,zz);uv.push(xx*.31,zz*.31);}}
      for(var j=0;j<N;j++)for(var k=0;k<rows-1;k++){var a=j*rows+k;ix.push(a,a+rows,a+1,a+1,a+rows,a+rows+1);}
      var bank=geo(new T.BufferGeometry());bank.setAttribute('position',new T.Float32BufferAttribute(pos,3));bank.setAttribute('uv',new T.Float32BufferAttribute(uv,2));bank.setIndex(ix);bank.computeVertexNormals();add(id,bank,'sand',0,0,0,1,1,1);
      for(var j=0;j<N;j+=2){var zz=r.z-r.d*.5+j*r.d/N;for(var course=0;course<2;course++){if((j+course+id)%5===0)continue;add(id,masonry,'stone',edge+.26+course*.17,-.12-course*.29,zz,.55,.27,1.38,0,(rnd()-.5)*.13,(rnd()-.5)*.04);}if(j%4===0)add(id,rock,'rock',edge+1.6,-.38,zz+1.1,1.1,.42,.8,0,rnd()*6,0);}
    });
    // Worn paving survives in islands, with exposed earth between them. Low relief stays below attack warnings.
    [2,4,5].forEach(function(id){var r=rooms[id];for(var row=0;row<15;row++)for(var col=0;col<12;col++){if((row*13+col*7+id)%17<2)continue;var xx=-6.3+col*1.12+(row%2)*.5,zz=r.z+(row-7)*.90;if(xx>6.8)continue;add(id,paving[(row+col)%3],'floor',xx,.015,zz,1.04,.34,.81,0,(rnd()-.5)*.08,0);}});
    // Broken funeral paving gives the graveyard and forest a legible forward line.
    // The relief remains below the attack-warning plane and changes no collision or quest footprint.
    [0,1].forEach(function(id){var r=rooms[id];for(var row=0;row<17;row++)for(var col=0;col<5;col++){
      var wear=B.Gear.hash(row,col,id+91);if(wear<(col===0||col===4?.63:.34))continue;
      var shift=B.Gear.hash(col,row,id+37),size=B.Gear.hash(row+8,col+2,id+19);
      var xx=(col-2)*.92+Math.sin(row*.49+id)*.28+(shift-.5)*.30,zz=r.z+(row-8)*1.18+(wear-.5)*.40;
      add(id,paving[(row+col+id)%3],'funeralPaving',xx,.007,zz,.52+size*.32,.34,.57+shift*.33,0,(wear-.5)*.74,0);
    }});
    // Irregular shallow pools sit below the warning plane; they never change the walking surface.
    [0,1,2,4,5].forEach(function(id){var r=rooms[id];for(var j=0;j<4;j++){var x=j%2?-6.5:5.5,z=r.z+(j-1.5)*r.d*.18;add(id,rock,'puddle',x,-.047,z,.8+rnd(),.055,.6+rnd(),0,rnd()*6,0);}});
    // 0: blackened graveyard, exposed burial pits and an old funeral gate.
    for (var i = 0; i < 14; i++) grave(0, (i % 2 ? 1 : -1) * (7.4 + rnd() * 3), 9 - Math.floor(i / 2) * 2.6, (rnd() - .5) * .2, i % 3 === 0);
    for (var side = -1; side <= 1; side += 2) add(0, box, 'stone', side * 3.8, 2, 13, .7, 4, .8);
    add(0, box, 'wood', -6.7, 2.1, 13, 3, .23, .3, 0, 0, -.25);
    for (var i = 0; i < 5; i++) add(0, cone, 'rust', -7.8 + i * .6, 2.5, 13, .06, .5, .06);
    // The graveyard is a ruined burial precinct, with niches and uneven walls around the outer route.
    for(var side=-1;side<=1;side+=2){var xx=side<0?-12.8:10.8;for(var j=0;j<10;j++){var zz=12-j*2.0,hh=.45+(j%3)*.23;if(side<0&&Math.abs(zz-4)<4.9)continue;add(0,masonry,'stone',xx,hh*.5,zz,.65,hh,1.80,0,side*.06);if(j%3===0){add(0,masonry,'stone',xx,1.12,zz,.86,1.45,.82);add(0,masonry,'stone',xx,1.94,zz,1.04,.16,1.02);}}}
    for(var j=0;j<6;j++){var xx=-9.6+j*.39;add(0,cylinder,'rust',xx,.66,10.5,.022,1.18,.022,0,0,(j%2-.5)*.08);add(0,cone,'rust',xx,1.3,10.5,.055,.16,.055);}beam(0,'rust',[-9.8,.85,10.5],[-7.4,.8,10.5],.025);
    corpse(0,-8,6,.6);corpse(0,6,-2,2.4);skull(0,-7,.12,1,.4);
    // 1: a collapsed root arch and a charred shelter. The route beneath stays wide and flat.
    for (var side = -1; side <= 1; side += 2) {
      var treeAnchor=tree(1,side*11.8,side<0?-19.8:-27,9,.7,-side*2.2,0,true),start=treeAnchor.at(.50);
      var archPoints=[start,new T.Vector3(side*8.2,4.7,-27.6),new T.Vector3(side*4.9,5.15,-28.5),new T.Vector3(side*1.8,5.1,-29)],archCurve=new T.CatmullRomCurve3(archPoints),parts=[];
      parts.push(B.Gear.tube(archPoints,function(t){return .33-.18*t;},10,26,true));
      for(var j=0;j<3;j++){var p=archCurve.getPointAt(.30+j*.22);parts.push(B.Gear.tube([p,p.clone().add(new T.Vector3(-side*.30,.40,-.15)),p.clone().add(new T.Vector3(-side*.66,.82,.20))],function(t){return .09*(1-t)+.008;},7,12,true));}
      add(1,geo(B.Gear.merge(parts)),'char',0,0,0,1,1,1);
    }
    building(1, -17, -19, 5.5, 7, 3.2, .08);
    corpse(1,-8,-24,-.6);skull(1,6,.14,-27,1.2);
    // 2: salt-eaten houses and drowned shopfronts.
    building(2, -12, -47, 5.6, 7, 3.5, -.03); building(2, 12.1, -55, 5.1, 6, 4.4, .04);
    building(2, -13.3, -56.5, 4.2, 4.5, 2.7, .07);
    for (var i = 0; i < 12; i++) add(2, box, 'wood', 8 + rnd() * 3, .12, -47 - rnd() * 13, 1.6, .08, .18, 0, rnd() * 5, 0);
    corpse(2,-7.2,-48,2);corpse(2,6.5,-58,1);cargo(2,-8,-57,.2);cargo(2,6.4,-45,-.3);
    // 3: broad main pier, snapped piles, cargo and a wreck in the black water.
    for (var row = 0; row < 24; row++) for (var col = 0; col < 5; col++) add(3, plank, 'wood', (col - 2) * 4 - 2, .025, -69 - row * 1.04, 3.93, .065, .95, 0, 0, (rnd() - .5) * .013);
    for (var side = -1; side <= 1; side += 2) for (var n = 0; n < 7; n++) { var pierZ=-70-n*3.7; if(side<0&&n===3)pierZ=-85.4; add(3, cylinder, 'wood', side > 0 ? 7.7 : -11.7, .3, pierZ, .18, 2.2, .18, .05, 0, side * .05); if (n % 3 !== 1 && !(side<0&&(n===2||n===3))) beam(3, 'wood', [side > 0 ? 7.7 : -11.7, 1.1, pierZ], [side > 0 ? 7.7 : -11.7, 1.05, -73.5 - n * 3.7], .055); }
    for (var i = 0; i < 8; i++) { var x = (i % 2 ? -1 : 1) * (10 + rnd()), z = -72 - Math.floor(i / 2) * 5; if(x<0&&Math.abs(z+81)<6)z=-69-i*.35;if(x>0&&Math.abs(z+86.4)<3)z=-91.6; add(3, box, 'wood', x, .45, z, 1.2, .9, 1.1, 0, rnd(), 0); add(3, box, 'rust', x, .47, z, 1.25, .055, 1.15, 0, rnd(), .4); collision(x, z, 1.25, 1.15); }
    for(var row=0;row<24;row++)for(var col=0;col<5;col++)for(var side=-1;side<=1;side+=2)add(3,cylinder,'rust',(col-2)*4-2+side*1.74,.061,-69-row*1.04,.022,.009,.022);
    for(var side=-1;side<=1;side+=2)for(var n=0;n<7;n++){
      var px=side>0?7.7:-11.7,zz=-70-n*3.7;if(side<0&&n===3)zz=-85.4;add(3,ring,'rust',px,.88,zz,.19,.19,.19,PI/2);
      beam(3,'wood',[px,-.38,zz],[px-side*.8,.34,zz+1.15],.075);
      if(n%2===0)add(3,ring,'rust',px,1.32,zz,.12,.12,.12,0,0,.3);
    }
    for(var n=0;n<5;n++){var zz=-72-n*4.4;beam(3,'wood',[8.3,-.18,zz],[11+rnd()*2,-.3,zz+1],.055);add(3,plank,'wood',11+rnd()*2,-.29,zz,1.7,.07,.20,0,rnd()*3,0);}
    for(var j=0;j<7;j++){var zz=-70-j*3.7;add(3,box,'wood',-2,-.16,zz,20.1,.27,.30);for(var side=-1;side<=1;side+=2){var xx=side>0?8.6:-12.7;add(3,masonry,'stone',xx,-.40,zz,.65,.48,1.3,0,.09*side);add(3,cylinder,'wood',xx,-.2,zz,.25,2.1,.25,0,0,.06*side);add(3,ring,'rust',xx,.60,zz,.27,.27,.27,PI/2);}}
    for(var j=0;j<9;j++){var zz=-70-j*2.9;add(3,masonry,'stone',13.5+Math.sin(j)*.7,-.5,zz,1.5,.75,2.2,.12,rnd()*.3,.1);}
    boat(3, 23, -78, 9, -.35, true); boat(2, 24, -49, 6, .6, true);
    corpse(3,-8.4,-80,.8);corpse(3,6.1,-91,-.3);skull(3,6.3,.13,-76,.5);
    // 4: dry combat island around a dead fountain; roots engulf the surrounding houses.
    building(4, -15, -105, 5, 6, 4, -.08); building(4, 15, -115, 4.5, 7, 4.2, .1);
    add(4, cylinder, 'stone', -11, .35, -120, 2.3, .7, 2.3); add(4, ring, 'stone', -11, .7, -120, 2.25, 2.25, 2.25, PI / 2);
    add(4, cylinder, 'bone', -11, 1.4, -120, .45, 2.2, .45); collision(-11, -120, 4.8, 4.8);
    tree(4, -10.5, -120, 8, .65, 1.3, 0, true); for (var j = 0; j < 5; j++) grave(4, 11.5 + rnd() * 2, -103 - j * 4, .3, true);
    corpse(4,-8,-108,1.1);corpse(4,7,-117,-1.2);skull(4,-6.9,.12,-115,2);
    // 5: one refuge at the lighthouse; no extra saves inside the preceding fights.
    add(5, cylinder, 'stone', -8, 6, -146.5, 2.8, 12, 2.8); add(5, cylinder, 'rust', -8, 12.7, -146.5, 3.1, .5, 3.1);
    for(var j=0;j<6;j++)add(5,ring,'stone',-8,.9+j*1.85,-146.5,2.83,2.83,2.83,PI/2);
    for(var j=0;j<12;j++){var th=j/12*PI*2;add(5,cylinder,'rust',-8+Math.cos(th)*3.12,13.2,-146.5+Math.sin(th)*3.12,.045,.9,.045);}
    add(5,ring,'rust',-8,13.66,-146.5,3.13,3.13,3.13,PI/2);
    add(5, cone, 'wood', -8, 15, -146.5, 3.6, 2.4, 3.6); collision(-8, -146.5, 5.7, 5.7);
    for (var j = 0; j < 8; j++) { var a = j / 8 * PI * 2; add(5, cylinder, 'rust', -8 + Math.cos(a) * 2.7, 13.7, -146.5 + Math.sin(a) * 2.7, .09, 1.8, .09); }
    lantern(5, -8, 13.6, -146.5, 'lighthouse', true);
    // A weathered bronze oath lantern, carved steps and a restrained amber halo.
    add(5, cylinder, 'stone', 0, -.025, -141, 2.1, .10, 2.1);
    add(5, ring, 'gold', 0, .035, -141, 1.65, .30, 1.65, PI / 2);
    add(5, cylinder, 'stone', 0, .19, -141, .58, .36, .58);
    add(5, cylinder, 'rust', 0, .41, -141, .48, .09, .48);
    add(5, sphere, 'oath', 0, .83, -141, .13, .30, .13);
    for(var j=0;j<8;j++){var a=j/8*PI*2;add(5,cylinder,'gold',Math.sin(a)*.27,.83,-141+Math.cos(a)*.27,.018,.73,.018);}
    add(5,cone,'gold',0,1.28,-141,.38,.23,.38);add(5,ring,'rust',0,1.53,-141,.12,.12,.12);
    for(var s=-1;s<=1;s+=2){add(5,cylinder,'stone',s*1.6,.31,-141,.32,.60,.32);lantern(5,s*1.6,.90,-141,'oath',true);}
    // 6: exposed circular bell court. The ocean and root forest meet behind the giant.
    add(6, cylinder, 'floor', 0, -.04, -174, 16.8, .14, 16.8);
    for (var j = 0; j < 24; j++) { var a = j / 24 * PI * 2, x = Math.cos(a) * 18, z = -174 + Math.sin(a) * 15; add(6, rock, 'rock', x, .7, z, .8 + rnd(), 1 + rnd(), .8, rnd(), rnd() * 5, rnd()); }
    for (var s = -1; s <= 1; s += 2) { add(6, box, 'stone', s * 9, 4.4, -188, 1.3, 8.8, 1.5); beam(6, 'wood', [s * 9, 8.2, -188], [0, 9.4, -188], .33); tree(6, s * 14, -188, 12, .55, -s * 3, 0, true); }
    add(6, cylinder, 'rust', 0, 7.1, -188, 1.3, 2.6, 1.3); add(6, ring, 'gold', 0, 5.9, -188, 1.5, 1.5, 1.5, PI / 2);
    for(var side=-1;side<=1;side+=2){
      collision(side*9,-188,2.3,2.2);collision(side*10.1,-188.5,1.13,2.15);
      for(var j=0;j<8;j++){var zz=-179-j*1.35,hh=2.0+(j%3)*.7;add(6,masonry,'stone',side*15.5,hh*.5,zz,1.05,hh,1.22,0,side*.06);}
      for(var j=0;j<5;j++){add(6,masonry,'stone',side*9,1.0+j*1.55,-188,1.75,1.46,1.9,0,0,side*.006);add(6,masonry,'stone',side*10.1,.9+j*.9,-188.5,1.13,1.0,2.15,0,0,side*.10);}
      add(6,masonry,'stone',side*9,8.55,-188,2.30,.35,2.2);
    }
    for(var j=0;j<10;j++){if(j===4||j===5)continue;add(6,archStone,'stone',0,4.7,-188,9.6,9.6,4.6,0,0,j*PI/10);}
    for(var j=0;j<11;j++){var a=PI+j/10*PI,xx=Math.cos(a)*14.3,zz=-174+Math.sin(a)*14.3;add(6,masonry,'stone',xx,.55+(j%3)*.20,zz,1.9,1.1+(j%3)*.4,.85,0,-a,0);}
    for(var j=0;j<16;j++){var a=j/16*PI*2;add(6,masonry,'stone',Math.cos(a)*12.5,.019,-174+Math.sin(a)*12.5,2.9,.04,1.3,0,-a,0);}
    lantern(6, -12, 2.6, -180, 'brazier0'); lantern(6, 12, 2.6, -180, 'brazier2'); lantern(6, 0, 2.4, -188, 'brazier3');
    // Five directional wave trains share one mesh. Trochoidal drift sharpens the two main swells.
    var water=materials.water=new T.MeshStandardMaterial({color:0x164553,roughness:.21,metalness:0,normalMap:B.CoastMaterials.waterNormal(textures),normalScale:new T.Vector2(.50,.50),emissive:0x07121b,emissiveIntensity:.18});
    water.name='coast-water';
    var seaState=new T.Vector3();
    function seaStateAt(x,z,time){
      var xx=x-58,zz=z+89,u=Math.max(0,Math.min(1,(xx+50)/7)),e=.14+.86*u*u*(3-2*u),de=u>0&&u<1?.86*6*u*(1-u)/7:0;
      var a=xx*.32+zz*.11+time*.93,b=xx*-.13+zz*.29-time*.72,c=xx*.69-zz*.47+time*1.38,d=xx*-.85+zz*.61-time*1.86,f=xx*.22+zz*.74+time*1.18;
      var h=Math.sin(a)*.30+Math.sin(2*a)*.04+Math.sin(b)*.17+Math.sin(2*b)*.022+Math.sin(c)*.06+Math.sin(d)*.025+Math.sin(f)*.038;
      var ca=Math.cos(a)*.30+Math.cos(2*a)*.08,cb=Math.cos(b)*.17+Math.cos(2*b)*.044;
      return seaState.set(h*e,(ca*.32-cb*.13+Math.cos(c)*.06*.69-Math.cos(d)*.025*.85+Math.cos(f)*.038*.22)*e+h*de,(ca*.11+cb*.29-Math.cos(c)*.06*.47+Math.cos(d)*.025*.61+Math.cos(f)*.038*.74)*e);
    }
    water.onBeforeCompile = function (sh) {
      sh.uniforms.coastTime = clock;sh.uniforms.coastWaterNoise={value:B.Materials.noise()};
      var wave=`uniform float coastTime;varying vec3 coastSea;varying float coastCrest;
      vec3 coastWave(vec2 p){float a=dot(p,vec2(.32,.11))+coastTime*.93,b=dot(p,vec2(-.13,.29))-coastTime*.72,c=dot(p,vec2(.69,-.47))+coastTime*1.38,d=dot(p,vec2(-.85,.61))-coastTime*1.86,f=dot(p,vec2(.22,.74))+coastTime*1.18;
        float u=clamp((p.x+50.)/7.,0.,1.),e=.14+.86*u*u*(3.-2.*u),de=.86*6.*u*(1.-u)/7.;
        float h=sin(a)*.30+sin(2.*a)*.04+sin(b)*.17+sin(2.*b)*.022+sin(c)*.06+sin(d)*.025+sin(f)*.038;
        float ca=cos(a)*.30+cos(2.*a)*.08,cb=cos(b)*.17+cos(2.*b)*.044;
        return vec3(h*e,(ca*.32-cb*.13+cos(c)*.06*.69-cos(d)*.025*.85+cos(f)*.038*.22)*e+h*de,(ca*.11+cb*.29-cos(c)*.06*.47+cos(d)*.025*.61+cos(f)*.038*.74)*e);}
      vec2 coastDrift(vec2 p){float a=dot(p,vec2(.32,.11))+coastTime*.93,b=dot(p,vec2(-.13,.29))-coastTime*.72;float e=.14+.86*smoothstep(-50.,-43.,p.x);return (vec2(.946,.325)*cos(a)*.18+vec2(-.409,.913)*cos(b)*.085)*e;}
      vec3 coastNormal(vec2 p,vec3 w){float a=dot(p,vec2(.32,.11))+coastTime*.93,b=dot(p,vec2(-.13,.29))-coastTime*.72,u=clamp((p.x+50.)/7.,0.,1.),e=.14+.86*u*u*(3.-2.*u),de=.86*6.*u*(1.-u)/7.;vec2 da=vec2(.946,.325)*.18,db=vec2(-.409,.913)*.085;
        vec2 dx=-(da*sin(a)*.32-db*sin(b)*.13)*e+(da*cos(a)+db*cos(b))*de,dz=-(da*sin(a)*.11+db*sin(b)*.29)*e;
        return normalize(cross(vec3(dz.x,w.z,1.+dz.y),vec3(1.+dx.x,w.y,dx.y)));}`;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n'+wave)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 waveData=coastWave(position.xz);objectNormal=coastNormal(position.xz,waveData);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y+=waveData.x;transformed.xz+=coastDrift(position.xz);coastSea=transformed;coastCrest=waveData.x;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>','vec2 wuv=coastSea.xz;vec3 wn1=texture2D(normalMap,wuv*.065+vec2(coastTime*.013,-coastTime*.009)).xyz*2.-1.;vec3 wn2=texture2D(normalMap,vec2(-wuv.y,wuv.x)*.109+vec2(-coastTime*.008,coastTime*.011)).xyz*2.-1.;vec3 waterN=normalize(vec3((wn1.xy*.62+wn2.xy*.38)*normalScale,1.));normal=normalize(tbn*waterN);')
        .replace('#include <opaque_fragment>','vec3 waterWorldNormal=inverseTransformDirection(normal,viewMatrix);vec3 waterView=inverseTransformDirection(normalize(vViewPosition),viewMatrix);float waterFresnel=.025+.50*pow(1.-max(dot(waterWorldNormal,waterView),0.),4.);vec3 waterSky=mix(vec3(.014,.033,.047),vec3(.055,.105,.145),smoothstep(-.1,.7,reflect(-waterView,waterWorldNormal).y));outgoingLight=mix(outgoingLight,waterSky,waterFresnel);vec3 moonHalf=normalize(waterView+normalize(vec3(-.35,.8,-.42)));float moonGlint=pow(max(dot(waterWorldNormal,moonHalf),0.),80.);outgoingLight+=vec3(.18,.26,.30)*moonGlint;\n#include <opaque_fragment>')
        .replace('#include <common>','#include <common>\nuniform float coastTime;uniform sampler2D coastWaterNoise;varying vec3 coastSea;varying float coastCrest;')
        .replace('#include <color_fragment>','#include <color_fragment>\nvec2 current=texture2D(coastWaterNoise,coastSea.xz*.035+vec2(coastTime*.004,-coastTime*.003)).rg;float swell=smoothstep(-.36,.40,coastCrest);diffuseColor.rgb*=mix(.70,1.34,swell)*mix(.94,1.06,current.r);')
        .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat moonPool=exp(-pow((coastSea.x+25.)/19.,2.));totalEmissiveRadiance+=vec3(.012,.025,.040)*moonPool*mix(.18,1.,swell);float spume=smoothstep(.18,.37,coastCrest)*smoothstep(.52,.73,current.g);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.28,.29),spume*.42);float shore=1.-smoothstep(-49.,-42.,coastSea.x);float wash=.5+.5*sin(coastSea.z*.27-coastTime*.85+current.r*1.8);float lace=smoothstep(.63,.80,current.g)*smoothstep(.66,.91,wash)*shore;totalEmissiveRadiance+=vec3(.065,.090,.096)*spume+vec3(.050,.069,.071)*lace;');
    };
    water.customProgramCacheKey = function () { return 'kara-coast-water-7'; };
    var seaGeo = geo(new T.PlaneGeometry(100, 245, 70, 154)); seaGeo.rotateX(-PI / 2);
    var sea = new T.Mesh(seaGeo, water); sea.position.set(58, -.52, -89); sea.receiveShadow = true; sea.name = KabirI18n.t('Kara Deniz'); root.add(sea);
    // Broken, restrained shore foam; no straight bright strip or pixel noise.
    var foamCanvas=document.createElement('canvas');foamCanvas.width=128;foamCanvas.height=512;var fc=foamCanvas.getContext('2d');
    for(var j=0;j<34;j++){var x=50+rnd()*28,y=rnd()*512,r=5+rnd()*11,g=fc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(139,171,171,.20)');g.addColorStop(1,'rgba(139,171,171,0)');fc.fillStyle=g;fc.save();fc.translate(x,y);fc.scale(.65,1.6);fc.translate(-x,-y);fc.fillRect(x-r,y-r,r*2,r*2);fc.restore();}
    var foamTex=new T.CanvasTexture(foamCanvas);textures.push(foamTex);materials.foam=new T.MeshBasicMaterial({map:foamTex,transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide});
    var wetBands=[];rooms.forEach(function(r,id){if(id===3)return;var wg=geo(new T.PlaneGeometry(3.4,r.d+3));wg.rotateX(-PI/2);var wb=new T.Mesh(wg,materials.puddle);wb.position.set(r.w*.5-1.6+(id<6?3.6:0),-.4,r.z);wb.name='coast-wet-band';wb.receiveShadow=true;roomGroups[id].add(wb);wetBands.push(wb);});
    rooms.forEach(function(r,id){var fg=geo(new T.PlaneGeometry(.9,r.d+5));fg.rotateX(-PI/2);var f=new T.Mesh(fg,materials.foam);f.position.set(r.w*.5-3.65+(id!==3&&id<6?3.6:0),-.36,r.z);roomGroups[id].add(f);animated.push({object:f,x:f.position.x,foam:true,phase:id});});
    var encounterList=ENCOUNTERS.map(function(e){return Object.assign({},e);});
    B.CoastOpen.encounters(open,encounterList);
    var allRooms=rooms.concat(open.rooms);
    var openFx=B.CoastOpen.dress({add:add,beam:beam,tree:tree,grave:grave,lantern:lantern,building:building,boat:boat,corpse:corpse,skull:skull,cargo:cargo,collision:collision,geo:geo,rootTube:rootTube,
      materials:materials,textures:textures,rnd:rnd,root:root,groups:roomGroups,clock:clock,lightSources:lightSources,mainRooms:rooms,allRooms:function(){return allRooms;},
      G:{box:box,sphere:sphere,cylinder:cylinder,cone:cone,ring:ring,headstone:headstone,plank:plank,branch:branch,rock:rock,masonry:masonry,archStone:archStone,paving:paving,pebble:pebble}},open,ground);
    // Static instances are assembled once. Detail lives in texture maps and silhouettes, not frame-time allocations.
    // Draw-call budget: small/medium static props are baked into ONE mesh per room and material (instancing is kept only
    // for big repeated shapes and for scaled bark, whose texture scale comes from the instance matrix).
    var merged = {}, nmat = new T.Matrix3();
    Object.keys(batches).forEach(function (key) {
      var b = batches[key], nv = b.geo.attributes.position.count, bark = b.mat === materials.char || b.mat === materials.root;
      var scaled = bark && b.matrices.some(function (m) { var e = m.elements; return Math.abs(e[0] * e[0] + e[1] * e[1] + e[2] * e[2] - 1) > .01 || Math.abs(e[4] * e[4] + e[5] * e[5] + e[6] * e[6] - 1) > .01; });
      if (nv > 5000 || nv * b.matrices.length > 90000 || !b.geo.attributes.normal) return;
      var mk = b.room + '|' + b.mat.uuid; (merged[mk] = merged[mk] || { room: b.room, mat: b.mat, items: [], verts: 0, idx: 0, bark: bark });
      merged[mk].items.push(b); merged[mk].verts += nv * b.matrices.length; merged[mk].idx += (b.geo.index ? b.geo.index.count : nv) * b.matrices.length;
      delete batches[key];
    });
    Object.keys(merged).forEach(function (mk) {
      var g = merged[mk], P = new Float32Array(g.verts * 3), N = new Float32Array(g.verts * 3), U = new Float32Array(g.verts * 2), I = g.verts > 65535 ? new Uint32Array(g.idx) : new Uint16Array(g.idx), v = 0, k = 0;
      g.items.forEach(function (b) {
        var pa = b.geo.attributes.position, na = b.geo.attributes.normal, ua = b.geo.attributes.uv, ix = b.geo.index, c = pa.count;
        b.matrices.forEach(function (m) {
          var e = m.elements; nmat.getNormalMatrix(m); var n = nmat.elements, vs = g.bark ? Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])) : 1;
          for (var q = 0; q < c; q++) {
            var x = pa.getX(q), y = pa.getY(q), z = pa.getZ(q), o = (v + q) * 3;
            P[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
            var a = na.getX(q), bb = na.getY(q), cc = na.getZ(q), nx = n[0] * a + n[3] * bb + n[6] * cc, ny = n[1] * a + n[4] * bb + n[7] * cc, nz = n[2] * a + n[5] * bb + n[8] * cc, l = 1 / (Math.hypot(nx, ny, nz) || 1);
            N[o] = nx * l; N[o + 1] = ny * l; N[o + 2] = nz * l;
            if (ua) { U[(v + q) * 2] = ua.getX(q); U[(v + q) * 2 + 1] = ua.getY(q) * vs; }   // bark: the instance scale its shader read from instanceMatrix is baked into v
          }
          if (ix) for (q = 0; q < ix.count; q++) I[k++] = ix.getX(q) + v; else for (q = 0; q < c; q++) I[k++] = v + q;
          v += c;
        });
      });
      var mg = geo(new T.BufferGeometry()); mg.setAttribute('position', new T.BufferAttribute(P, 3)); mg.setAttribute('normal', new T.BufferAttribute(N, 3)); mg.setAttribute('uv', new T.BufferAttribute(U, 2)); mg.setIndex(new T.BufferAttribute(I, 1)); mg.computeBoundingSphere();
      var mesh = new T.Mesh(mg, g.mat); mesh.castShadow = [materials.lamp, materials.oath, materials.puddle, materials.funeralPaving, materials.floor, materials.sand, materials.grave, materials.bone, materials.rope, materials.flesh, materials.ember, materials.dark, materials.rock, materials.rust, materials.gold, materials.cloth].indexOf(g.mat) < 0; mesh.receiveShadow = true;
      mesh.name = 'coast-merged-' + g.room + ':' + (g.mat.name || ''); mesh.matrixAutoUpdate = false; roomGroups[g.room].add(mesh);
    });
    Object.keys(batches).forEach(function (key) {
      var b = batches[key], mesh = new T.InstancedMesh(b.geo, b.mat, b.matrices.length);
      b.matrices.forEach(function (m, i) { mesh.setMatrixAt(i, m); }); mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = b.mat !== materials.lamp && b.mat !== materials.oath && b.mat !== materials.puddle; mesh.receiveShadow = true;
      mesh.computeBoundingSphere(); mesh.name = 'coast-batch-' + key; mesh.matrixAutoUpdate = false; roomGroups[b.room].add(mesh);
    });
    // Three pooled lamps follow nearby sources, avoiding a new light for every street lantern.
    for (var i = 0; i < 3; i++) { var l = new T.PointLight(0x83b9ae, 0, 11, 2); root.add(l); lights.push(l); }
    var px = new T.PointLight(0xe4c08c, 1.1, 9.5, 2); root.add(px);
    var particlesGeo = geo(new T.BufferGeometry()), points = new Float32Array(180 * 3);
    for (var i = 0; i < 180; i++) { points[i * 3] = (rnd() - .5) * 38; points[i * 3 + 1] = .35 + rnd() * 7; points[i * 3 + 2] = -rnd() * 202 + 16; }
    particlesGeo.setAttribute('position', new T.BufferAttribute(points, 3)); materials.ash = new T.PointsMaterial({ color: 0x9ca898, size: .055, transparent: true, opacity: .36, depthWrite: false, sizeAttenuation: true });
    var ash = new T.Points(particlesGeo, materials.ash); ash.name = KabirI18n.t('Kıyı Külü'); root.add(ash);
    var expansion={rooms:open.rooms,paths:open.paths,update:function(){},dispose:function(){}};
    function inFloor(x, z, radius) {
      if(open.floorTest(x,z,radius))return true;
      for (var i = 0; i < rooms.length; i++) { var r = rooms[i]; if (x >= -r.w * .5 + radius && x <= r.w * .5 - 4 - radius && Math.abs(z - r.z) <= r.d * .5 - radius) return true; }
      return Math.abs(x) <= 3.3 - radius && z >= -190 + radius && z <= 15 - radius;
    }
    // Prepared spatial buckets preserve the exact rectangle checks; added scenery
    // doesn't make every movement/attack ray scan the entire coast.
    var collisionGrid=Object.create(null);
    colliders.forEach(function(c){for(var x=Math.floor((c.x-c.w/2-1.2)/8);x<=Math.floor((c.x+c.w/2+1.2)/8);x++)for(var z=Math.floor((c.z-c.d/2-1.2)/8);z<=Math.floor((c.z+c.d/2+1.2)/8);z++){var key=x+','+z;(collisionGrid[key]||(collisionGrid[key]=[])).push(c);}});
    function isWalkable(x, z, radius) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false; var r = radius == null ? .45 : Math.max(0, radius);
      if (!inFloor(x, z, r)) return false;
      var list=r>1.2?colliders:collisionGrid[Math.floor(x/8)+','+Math.floor(z/8)];
      if(list)for (var i = 0; i < list.length; i++) { var c = list[i]; if (Math.abs(x - c.x) < c.w * .5 + r && Math.abs(z - c.z) < c.d * .5 + r) return false; }
      return true;
    }
    function move(p, dx, dz, radius) {
      if (!Number.isFinite(dx) || !Number.isFinite(dz)) return p;
      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .18)), sx = dx / steps, sz = dz / steps;
      for (var i = 0; i < steps; i++) { if (isWalkable(p.x + sx, p.z + sz, radius)) { p.x += sx; p.z += sz; } else { if (isWalkable(p.x + sx, p.z, radius)) p.x += sx; if (isWalkable(p.x, p.z + sz, radius)) p.z += sz; } } return p;
    }
    function hasClearPath(ax, az, bx, bz, radius) { var d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / .3)); for (var i = 0; i <= n; i++) if (!isWalkable(ax + (bx - ax) * i / n, az + (bz - az) * i / n, radius)) return false; return true; }
    function roomAt(x, z) { for(var j=0;j<expansion.rooms.length;j++){var r=expansion.rooms[j];if(Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2)return r;} for (var i = 0; i < rooms.length; i++) if (Math.abs(x) <= rooms[i].w * .5 + 1 && Math.abs(z - rooms[i].z) <= rooms[i].d * .5 + 1) return rooms[i]; var best = rooms[0]; for (var j = 1; j < rooms.length; j++) if (Math.abs(z - rooms[j].z) < Math.abs(z - best.z)) best = rooms[j]; return best; }
    // Small prepared waypoint graph around the few solid buildings/cargo; never builds a combat-time raster grid.
    var nodes = [];
    rooms.forEach(function (r) { [-6,0,6].forEach(function (x) { [-r.d * .33, 0, r.d * .33].forEach(function (z) { if (isWalkable(x+r.x, r.z + z, .85)) nodes.push({ x: x+r.x, z: r.z + z, edges: [] }); }); }); });
    open.seeds.forEach(function(s){if(isWalkable(s[0],s[1],.85))nodes.push({x:s[0],z:s[1],edges:[]});});
    for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) < 23 && hasClearPath(nodes[i].x, nodes[i].z, nodes[j].x, nodes[j].z, .85)) { nodes[i].edges.push(j); nodes[j].edges.push(i); }
    var pathCosts=new Float64Array(nodes.length),pathPrev=new Int16Array(nodes.length),pathUsed=new Uint8Array(nodes.length);
    function pathTo(from, to, radius) {
      if (!isWalkable(to.x, to.z, radius)) return [];
      if (hasClearPath(from.x, from.z, to.x, to.z, radius)) return [{ x: to.x, z: to.z }];
      var costs=pathCosts,prev=pathPrev,used=pathUsed;used.fill(0); costs.fill(Infinity); prev.fill(-1);
      for (var i = 0; i < nodes.length; i++) if (Math.hypot(from.x-nodes[i].x,from.z-nodes[i].z)<23 && hasClearPath(from.x, from.z, nodes[i].x, nodes[i].z, radius)) costs[i] = Math.hypot(from.x - nodes[i].x, from.z - nodes[i].z);
      var end = -1, best = Infinity;
      for (var turn = 0; turn < nodes.length; turn++) { var at = -1, cost = Infinity; for (var j = 0; j < nodes.length; j++) if (!used[j] && costs[j]+Math.hypot(to.x-nodes[j].x,to.z-nodes[j].z) < cost) { cost = costs[j]+Math.hypot(to.x-nodes[j].x,to.z-nodes[j].z); at = j; } if (at < 0) break; used[at] = 1;cost=costs[at];
        if (Math.hypot(to.x-nodes[at].x,to.z-nodes[at].z)<23 && hasClearPath(nodes[at].x, nodes[at].z, to.x, to.z, radius)) { var total = cost + Math.hypot(to.x - nodes[at].x, to.z - nodes[at].z); if (total < best) { best = total; end = at; break; } }
        for (var k = 0; k < nodes[at].edges.length; k++) { var next = nodes[at].edges[k], nc = cost + Math.hypot(nodes[at].x - nodes[next].x, nodes[at].z - nodes[next].z); if (nc < costs[next]) { costs[next] = nc; prev[next] = at; } }
      }
      if (end < 0) return []; var path = [{ x: to.x, z: to.z }]; for (var at = end, guard = 0; at >= 0 && guard++ < nodes.length; at = prev[at]) path.unshift({ x: nodes[at].x, z: nodes[at].z }); return path;
    }
    var COLORS = ['fog', 'sky', 'ground', 'key', 'rim', 'charRim', 'mist'], VECS = ['lift', 'gain', 'shadowTint', 'highTint', 'vigColor', 'bloomTint'];
    var moods = rooms.map(function (r, i) { return {
      fog: i === 4 ? '#080c09' : '#070f12', fogDensity: .013, mist: '#0c1718', mistA: .17, mistH: .58, mistGlow: .75, scatter: .8, wind: [.04, -.025],
      sky: '#799597', ground: '#24281e', hemi: .78, env: .28, key: '#b1cdcf', keyI: 1.55, keyDir: [-10, 21, -6], rim: '#78aaa6', rimI: 1.1,
      charRim: '#b7d8cf', charRimI: 1.4, rimDir: [.25, .6, -1], rimWrap: 1, charFill: .21,
      lift: [.002, .006, .006], gain: [.95, 1.04, 1.05], sat: .78, contrast: .2, shadowTint: [.87, 1.02, 1.1], highTint: [1.05, 1.02, .86],
      vignette: .57, vigColor: [0, .01, .012], bloom: .42, bloomTint: [.86, 1, .94], exposure: 1.32
    }; });
    moods[5].key = '#d6c3a0'; moods[5].keyI = 1.25; moods[5].mistA = .12;
    moods[6].key = '#9ebfca'; moods[6].rim = '#7bbba9'; moods[6].fogDensity = .014;
    var cooked = moods.map(function (m) { var o = {}; Object.keys(m).forEach(function (k) { o[k] = COLORS.indexOf(k) >= 0 ? new T.Color(m[k]) : VECS.indexOf(k) >= 0 ? new T.Vector3().fromArray(m[k]) : Array.isArray(m[k]) ? m[k].slice() : m[k]; }); return o; });
    var atmo = { room: 0 }; Object.keys(cooked[0]).forEach(function (k) { var v = cooked[0][k]; atmo[k] = v && v.clone ? v.clone() : Array.isArray(v) ? v.slice() : v; });
    function atmosphereAt(x, z) {
      var a = 0, b = 0, mix = 0; for (var i = 1; i < rooms.length; i++) { if (z <= rooms[i - 1].z && z >= rooms[i].z) { a = i - 1; b = i; mix = (rooms[i - 1].z - z) / (rooms[i - 1].z - rooms[i].z); break; } if (z < rooms[i].z) a = b = i; }
      mix = mix * mix * (3 - 2 * mix); Object.keys(cooked[a]).forEach(function (k) { var va = cooked[a][k], vb = cooked[b][k]; if (va && va.isColor || va && va.isVector3) atmo[k].copy(va).lerp(vb, mix); else if (Array.isArray(va)) for (var j = 0; j < va.length; j++) atmo[k][j] = va[j] + (vb[j] - va[j]) * mix; else atmo[k] = va + (vb - va) * mix; }); atmo.room = mix < .5 ? a : b; atmo.saturation = atmo.sat; if (openFx && openFx.intro > .001) { var iI = openFx.intro; atmo.exposure *= 1 - .5 * iI * iI; atmo.mistA = (atmo.mistA || 0) + .25 * iI; atmo.fogDensity *= 1 + .8 * iI; } if (openFx && openFx.flash > .01) { atmo.keyI *= 1 + openFx.flash * 2.2; atmo.exposure *= 1 + openFx.flash * .35; atmo.hemi *= 1 + openFx.flash * .8; } return atmo;
    }
    var groupGain = {}, fxLight = null, nearby = [];
    var lampSlots = [{ src: null, w: 0 }, { src: null, w: 0 }, { src: null, w: 0 }], pxGain = 0;
    function byLampEff(a, b) { return b.cEff - a.cEff; }
    function setGroup(name, value) { groupGain[name] = value; }
    function update(dt, time, player) {
      expansion.update(player);
      clock.value = calm ? 0 : time;if(B.CoastClothClock)B.CoastClothClock.value=clock.value; var p = player || { x: 0, z: 8 }; heroCut.value.set(p.x,1.2,p.z);
      roomGroups.forEach(function (g, i) { var r = i < 7 ? rooms[i] : allRooms[i]; g.visible = r.z - r.d * .5 < p.z + 20 && r.z + r.d * .5 > p.z - 34 && Math.abs((r.x || 0) - p.x) < 33 + r.w * .5; });if(openFx)openFx.update(time,p);
      animated.forEach(function (a) { if (calm) return; if (a.boat) {var wave=seaStateAt(a.object.position.x,a.object.position.z,time);a.object.position.y=a.y+wave.x*.45;a.object.rotation.z=a.roll+wave.y*.18;a.object.rotation.x=-wave.z*.18;} else if (a.foam){var wash=.5+.5*Math.sin(time*.85+a.phase);a.object.position.x=a.x+wash*.38;a.object.position.y=-.38+wash*.035;} });
      ash.position.x = calm ? 0 : Math.sin(time * .09) * .3;
      // slow tide: the black sea breathes up and down the eroded bank (~2 min period)
      sea.position.y = -.52 + (calm ? 0 : Math.sin(time * .05) * .09);
      for (var wbI = 0; wbI < wetBands.length; wbI++) wetBands[wbI].position.y = sea.position.y + .13;
      nearby.length = 0;
      for (var i = 0; i < lightSources.length; i++) { var s = lightSources[i]; s.live = Math.max(.1, groupGain[s.group] == null ? 1 : groupGain[s.group]); s.distance = Math.hypot(s.x - p.x, s.z - p.z); if (s.distance < 18) { s.cHeld = false; s.cEff = s.intensity * s.live / (1 + s.distance * s.distance / 30); nearby.push(s); } }
      // Three pooled lamps with eased hand-offs (they used to jump to the new source in one frame) and a x1.35 lead needed to take a slot over its holder.
      var k, sl;
      for (k = 0; k < 3; k++) if (lampSlots[k].src) lampSlots[k].src.cHeld = true;
      for (i = 0; i < nearby.length; i++) if (nearby[i].cHeld) nearby[i].cEff *= 1.35;
      nearby.sort(byLampEff);
      for (k = 0; k < 3; k++) { sl = lampSlots[k]; if (!sl.src) continue; var ix = nearby.indexOf(sl.src); sl.w = ix >= 0 && ix < 3 ? Math.min(1, sl.w + dt * 3.6) : Math.max(0, sl.w - dt * 4.2); if (sl.w <= 0) sl.src = null; }
      for (k = 0; k < 3; k++) { if (lampSlots[k].src) continue; for (var j = 0; j < 3 && j < nearby.length; j++) { var c = nearby[j], taken = false; for (var q = 0; q < 3; q++) if (lampSlots[q].src === c) taken = true; if (!taken) { lampSlots[k].src = c; lampSlots[k].w = 0; break; } } }
      for (k = 0; k < lights.length; k++) { var l = lights[k]; sl = lampSlots[k]; s = sl.src; l.visible = quality !== 'low'; l.intensity = 0; if (s) { l.position.set(s.x, s.y, s.z); l.color.copy(s.color); l.intensity = s.intensity * s.live * sl.w * sl.w * (3 - 2 * sl.w); } }
      // the hero's own light eases into / out of the borrowed skill light instead of stepping by +.5
      pxGain += ((fxLight ? fxLight.gain || .5 : 0) - pxGain) * Math.min(1, dt * 14);
      px.position.set(p.x, 2.1, p.z); px.intensity = (quality === 'low' ? .7 : 1.1) + pxGain;
    }
    function setQuality(cfg) { quality = typeof cfg === 'string' ? cfg : cfg.quality || cfg.preset || 'high'; ash.visible = quality !== 'low'; }
    function dispose() { if (disposed) return; disposed = true; expansion.dispose(); scene.remove(root); root.traverse(function (n) { if (n.isInstancedMesh) n.dispose(); }); geometries.forEach(function (g) { g.dispose(); }); Object.keys(materials).forEach(function (k) { materials[k].dispose(); }); textures.forEach(function (t) { t.dispose(); }); root.clear(); }
    // Quest object sites in the open coast (read by src/quests.js); a site is kept only if it is clear ground.
    var questSites={};[['clapper',-35.5,-55.2],['grave-west',-37,-108.6],['grave-east',-26.8,-109.2],['bell-testimony',-25,-136.5],['c2.hunt',-28,-84.4],['c2.captive',-36.5,5.5],['c2.page1',-39.5,-19.5],['c2.page2',-60.5,-92.5],['c2.page3',-40,-145.5],['c2.altar',25.5,-89.6],['c2.chest',-25.5,-55.6],['c2.siege',-37,-28.5],['c2.hunt2',-68.5,-95],['c2.escape',27,-84],['c2.escape-goal',-4,-131],['c2.rescue-goal',3.5,-137]].forEach(function(q){for(var k=0;k<60;k++){var a=k*2.4,d=k?.45*Math.sqrt(k):0,x=q[1]+Math.cos(a)*d,z=q[2]+Math.sin(a)*d;if(isWalkable(x,z,1.3)&&pathTo({x:0,z:10},{x:x,z:z},.5).length){questSites[q[0]]={x:x,z:z};break;}}});
    root.updateMatrixWorld(true);
    return { chapter: 2, questSites: questSites, name: KabirI18n.t('Kara Kıyı'), root: root, rooms: allRooms, paths: expansion.paths, encounters: encounterList, spawn: { x: 0, z: 10 }, checkpoint: { x: 0, z: -141 }, bossSpawn: { x: 0, z: -178 },
      effectHeightAt: function(x,z,r){r=r||0;if(z-r<-68&&z+r>-94)return .14;if(z-r<-154)return .065;for(var i=0;i<rooms.length-1;i++){var lo=rooms[i].z-rooms[i].d*.5,hi=rooms[i+1].z+rooms[i+1].d*.5;if(z-r<lo&&z+r>hi)return .14;}return .055;},
      colliders: colliders, occluders: occluders, materials: materials, move: move, isWalkable: isWalkable, hasClearPath: hasClearPath, pathTo: pathTo, roomAt: roomAt,
      update: update, dispose: dispose, setQuality: setQuality, atmosphereAt: atmosphereAt,
      lighting: { sources: lightSources, flames: [], shafts: [], moods: moods, groupGain: groupGain, setGroup: setGroup, setGroupTint: function () {}, setCorpses: function () {},
        setOathGlow: function (gain) { materials.oath.emissiveIntensity = .25 + gain * .4; }, setPlayerLightFx: function (fx) { fxLight = fx; }, prepareTextures: function () { return textures; }, wantsShadows: function () { return false; } }
    };
  }
  B.CoastWorld = { build: build, rooms: ROOMS };
}());
