/* KARA KIYI — original fitted sea-growth, tree and wreck equipment on licensed rigs. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, G = B.Gear, TAU = Math.PI * 2;
  function v(p) { return p.clone ? p.clone() : new T.Vector3().fromArray(p); }
  function arr(p) { return [p.x, p.y, p.z]; }
  function tube(A, key, bone, points, r) { A.rigid(key, G.tube(points, r, 7, 24, true), bone); }
  function growth(A, bone, origin, spread, count, key) {
    var p = v(origin), pieces = [];
    for (var i = 0; i < count; i++) {
      var a = i * 2.399, r = spread * (.4 + .6 * ((i * 7 % 13) / 13)), q = p.clone().add(new T.Vector3(Math.cos(a) * r, Math.sin(i * 1.9) * spread * .6, Math.sin(a) * r));
      pieces.push(G.cyl(.025, .043, .045, 7, arr(q), [Math.sin(a) * .7, 0, Math.cos(a) * .7]));
      pieces.push(G.ring(.025, .007, arr(q.clone().add(new T.Vector3(0, .024, 0))), [Math.PI / 2, 0, 0], 5, 10));
    }
    A.rigid(key || 'bone', G.merge(pieces), bone);
  }
  function roots(A, bone, origin, count, size) {
    var p = v(origin), pieces = [];
    for (var i = 0; i < count; i++) {
      var fan = /spine|Head|head/.test(bone), a = fan ? Math.PI + i / Math.max(1,count - 1) * Math.PI : i / count * TAU, s = i % 2 ? -1 : 1, b = p.clone().add(new T.Vector3(Math.cos(a) * .1, 0, Math.sin(a) * .1)), c = b.clone().add(new T.Vector3(Math.cos(a) * size * .5, size * .38, Math.sin(a) * size * .5)), d = b.clone().add(new T.Vector3(Math.cos(a + .35) * size, size * (.65 + i % 3 * .2), Math.sin(a + .35) * size));
      pieces.push(G.tube([arr(b), arr(c), arr(d)], function(t){return (.031+(i%3)*.012)*Math.pow(1-t,.75)+.003;}, 9, 22, true));
      var tip = d.clone().add(new T.Vector3(s * .06, size * .15, -.04)); pieces.push(G.spike(.025, d, tip));
    }
    var bark=G.merge(pieces);G.uvScale(bark,1.6,.7);A.rigid('wood',bark,bone);
  }
  function grin(A, head, p, size) {
    var teeth = [], rim = [], jaw = p.clone().add(new T.Vector3(0, -.07, .09));
    A.rigid('void', G.sphere(size, arr(jaw), [1.25, .56, .55], 20, 12), head);
    for (var i = 0; i < 13; i++) {
      var x = (i / 12 - .5) * size * 2.1, y = Math.pow(x / size, 2) * .035;
      [-1, 1].forEach(function (s) { var a = jaw.clone().add(new T.Vector3(x, s * size * .4 + y, size * .43)), b = a.clone().add(new T.Vector3(0, -s * (.035 + (i % 3) * .008), .008)); teeth.push(G.spike(.012, a, b)); });
      rim.push([jaw.x + x, jaw.y - size * .5 + y, jaw.z + size * .38]);
    }
    A.rigid('bone', G.merge(teeth), head); tube(A, 'flesh', head, rim, .016);
  }
  function eye(A, head, p, size, material) {
    [-1,1].forEach(function(s){
      var q=head==='head'?null:A.nearest(new T.Vector3(p.x+s*.054,p.y+.035,p.z+.12),['skin']),
        center=q?new T.Vector3(q.x,q.y,q.z):p.clone().add(new T.Vector3(s*.054,.035,.10)),
        n=q?new T.Vector3(q.nx,q.ny,q.nz).normalize():new T.Vector3(0,0,1),turn=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),n);
      // Recess each eye into the actual skull; a head turn must not leave the glowing eye floating beside it.
      var socket=G.sphere(size*1.4,null,[1,.75,.5],12,8),iris=G.sphere(size,null,[1,.7,.35],12,8);
      socket.applyQuaternion(turn);iris.applyQuaternion(turn);socket.translate(center.x,center.y,center.z);
      center.addScaledVector(n,q?size*.48:.017);iris.translate(center.x,center.y,center.z);
      A.rigid('void',socket,head);A.rigid(material||'sea-glow',iris,head);
    });
  }
  // Project accessories and wounds onto the actual licensed body's surface, in bind space.
  function skinPoint(A,p,lift){var q=A.nearest(p,['skin']);return q?new T.Vector3(q.x+q.nx*(lift||0),q.y+q.ny*(lift||0),q.z+q.nz*(lift||0)):v(p);}
  function wounds(A,c,exec){var lines=[],step=exec?.10:.075;for(var i=0;i<3;i++){var a=skinPoint(A,c.clone().add(new T.Vector3(-.16+i*.11,-.02-i*step,.55))),b=skinPoint(A,c.clone().add(new T.Vector3(-.08+i*.10,-.14-i*step,.55)));lines.push([a,b,.004+i*.0006,false]);}return lines;}
  // Thick layered shells, fitted to the skin. The edge and radial ridges are real geometry.
  function plate(A,bone,target,r,stretch,key,seed){
    var q=A.nearest(target,['skin']);if(!q)return;var p=new T.Vector3(q.x+q.nx*.013,q.y+q.ny*.013,q.z+q.nz*.013),n=new T.Vector3(q.nx,q.ny,q.nz).normalize();
    var ey=new T.Vector3(0,1,0);ey.addScaledVector(n,-ey.dot(n));if(ey.lengthSq()<.01)ey.set(0,0,1);ey.normalize();var ex=new T.Vector3().crossVectors(ey,n).normalize();
    function point(a,t){var theta=t*Math.PI*.5,rr=r*(1+.035*Math.sin(a*9+seed)),lift=Math.cos(theta)*r*.42+.009*Math.pow(Math.max(0,Math.sin(a*12+seed*.3)),4)*Math.sin(theta);return p.clone().addScaledVector(ex,Math.cos(a)*Math.sin(theta)*rr).addScaledVector(ey,Math.sin(a)*Math.sin(theta)*rr*stretch).addScaledVector(n,lift);}
    var g=G.shell(24,8,function(u,v){return arr(point(u*TAU,v));},.012,true,true);G.uvScale(g,2,2);A.rigid(key||'ash',g,bone);
    var lip=[];for(var j=0;j<=32;j++)lip.push(arr(point(j/32*TAU,1)));tube(A,'bone',bone,lip,.008);
  }
  function oar() {
    var blade=G.extrude([[-.055,-.24],[.048,-.24],[.11,-.10],[.105,.21],[.065,.25],[-.04,.23],[-.105,.16],[-.12,-.08]],.055,.006),
      haft=G.tube([[0,-.145,0],[.014,.48,0],[0,1.16,0]],function(t){return .034-.008*t+.002*Math.sin(t*28);},12,28,true);
    // Crop one weathered plank from the existing scan; grain follows the oar instead of crossing it like floorboards.
    [blade,haft].forEach(function(g,j){var uv=g.attributes.uv;for(var i=0;i<uv.count;i++){var u=uv.getX(i),v=uv.getY(i);uv.setXY(i,v*(j?.16:.65)+.18,u*(j?.04:.30)+.43);}});
    blade.rotateZ(-.09);blade.translate(0,1.22,0);
    return {parts:{wood:[haft,blade],iron:[G.ring(.04,.008,[0,.15,0],[Math.PI/2,0,0],6,20),G.box(.22,.035,.068,[0,1.10,0]),G.stud(.012,[.055,1.10,.04],[0,0,1]),G.stud(.012,[-.055,1.10,.04],[0,0,1])]},tip:new T.Vector3(.02,1.48,0)};
  }
  function anchor() {
    var p = { iron: [G.cyl(.042, .065, 1.55, 12, [0, .5, 0]), G.ring(.14, .038, [0, 1.3, 0], [0, 0, 0], 8, 24), G.box(.75, .09, .10, [0, 1.04, 0])], dark: [], brass: [] };
    [-1, 1].forEach(function (s) { p.iron.push(G.tube([[0, -.25, 0], [s * .26, -.17, 0], [s * .48, .12, 0]], .065, 8, 24, true), G.spike(.16, new T.Vector3(s * .47, .1, 0), new T.Vector3(s * .45, .47, 0))); });
    p.brass.push(G.cyl(.082, .082, .10, 12, [0, .3, 0])); return { parts: p, tip: new T.Vector3(.46, .43, 0) };
  }
  B.CoastClothClock={value:0};
  function coastMotion(type){return function(bones,scene,scale){
    var q=new T.Quaternion(),x=new T.Vector3(1,0,0),y=new T.Vector3(0,1,0),z=new T.Vector3(0,0,1),exec=type==='bell'||type==='urchin',spine=bones[exec?'spine03':'spine_03'],head=bones[exec?'head':'Head'],neck=bones[exec?'neck':'neck_01'],left=bones[exec?'forearmL':'lowerarm_l'];
    var calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function turn(b,axis,a){if(b&&Math.abs(a)>.0001){q.setFromAxisAngle(axis,a);b.quaternion.multiply(q);}}
    return function(dt,s){if(s.dead||s.hurt||s.stagger)return;var t=s.time||0,m=s.move||0,idle=1-Math.min(1,(s.attack||0)*8),breathe=Math.sin(t*(type==='bell'?1.5:2.1));
      if(type==='drowned'){turn(spine,z,.045+Math.sin(t*3.8)*.045*m*idle);turn(head,z,-.025);turn(left,x,.06*idle);}
      if(type==='rootborn'){turn(spine,x,.04+breathe*.016*idle);turn(neck,y,Math.sin(t*.8)*.035*idle);}
      if(type==='urchin'){turn(spine,x,.07+breathe*.018*idle);if(s.pose==='throw'||s.pose==='spit'){var coil=Math.sin(Math.min(1,s.attack||0)*Math.PI);turn(spine,x,-.12*coil);turn(head,x,.07*coil);}}
      if(type==='lantern'){turn(neck,x,.12);turn(head,x,-.12);turn(spine,y,calm?0:Math.sin(t*1.4)*.045*idle);if(s.pose==='castHigh'||s.pose==='cast'){var cast=Math.sin(Math.min(1,s.attack||0)*Math.PI);turn(head,x,-.16*cast);turn(left,z,-.15*cast);}}
      if(type==='bell'){turn(spine,x,breathe*.022*idle);turn(head,x,-breathe*.012*idle);if(s.pose==='roar'||s.pose==='castHigh'){var toll=Math.sin(Math.min(1,s.attack||0)*Math.PI);turn(spine,x,-.09*toll);turn(neck,x,.10*toll);}}
    };
  };}
  function make(type, cfg) {
    cfg.chapter = 2;if(!cfg.detailMotion)cfg.detailMotion=coastMotion(type);
    B.Models.register(type, cfg, function (A, C) {
      var exec = cfg.base === 'executioner', head = exec ? 'head' : 'Head', spine = exec ? 'spine03' : 'spine_03', neck = exec ? 'neck' : 'neck_01', handL = exec ? 'handL' : 'hand_l', handR = exec ? 'handR' : 'hand_r';
      var skin = A.addFrom(C.bases[cfg.base], function () { return true; }, 'skin')[0];
      if(exec) A.remapBone('neutral_bone','pelvis');
      var lens = {}; lens[neck] = type === 'lantern' ? 1.35 : type === 'crawler' ? 1.1 : 1.04;
      if (!exec) { lens.lowerarm_l = lens.lowerarm_r = type === 'crawler' ? 1.5 : 1.12; lens.hand_l = lens.hand_r = type === 'crawler' ? 1.5 : 1.13; }
      A.lengthen(lens);
      if(type==='drowned'){A.slim(skin,{spine_01:.84,spine_02:.88,upperarm_l:.91,upperarm_r:.91,thigh_l:.94,thigh_r:.94},1);}
      else if(type==='lantern'){A.slim(skin,{upperarm_l:.82,upperarm_r:.82,lowerarm_l:.88,lowerarm_r:.88},1);}
      if (type === 'lantern' || type === 'crawler') { var slim = {}; slim[spine] = .7; slim.pelvis = .75; A.slim(skin, slim, 1); }
      var headCloud=A.cloud([head],['skin'],.65), headBox=A.box(headCloud);
      var p = headCloud.length ? headBox.getCenter(new T.Vector3()) : A.P(head), chest = A.P(spine), hip = A.P('pelvis');
      if(type==='bell'){
        // The executioner's black hood is replaced with a fitted, rotten skull, not painted brighter.
        A.trim(skin,function(a,b,c){return !(a.bone===head&&b.bone===head&&c.bone===head);});
        var skull=G.skull(Math.min(.34,Math.max(.27,headBox.max.y-headBox.min.y)),false).parts;
        var cranium=skull.bone.shift(),cv=cranium.attributes.position;for(var j=0;j<cv.count;j++){var x=cv.getX(j),y=cv.getY(j),z=cv.getZ(j);if(z>0){var eyeDip=Math.exp(-Math.pow((Math.abs(x)-.054)/.038,2)-Math.pow((y-.026)/.03,2))*.023,nose=Math.exp(-Math.pow(x/.022,2)-Math.pow((y+.022)/.046,2))*.022;cv.setZ(j,z-eyeDip+nose);}}cranium.computeVertexNormals();cranium.translate(p.x,p.y+.01,p.z+.02);A.rigid('flesh',cranium,head);
        ['bone','void'].forEach(function(key){var g=G.merge(skull[key]);g.translate(p.x,p.y+.01,p.z+.02);A.rigid(key,g,head);});
      }
      var mat = new T.MeshStandardMaterial({ color: 0x273c39, emissive: 0x559f8b, emissiveIntensity: .72, roughness: .42 });
      var materials = { skin: C.bodyMaterial(A.srcMaterial(exec ? 'Exec_mesh' : 'SuperHero_Male', C.bases[cfg.base]), 'coast-' + type + '-skin',
        { cls: 'skin', skin: 1, skinMap: exec, sat: .42, tint: type==='bell'?[.78,.73,.59]:type==='rootborn'?[.64,.69,.52]:type==='urchin'?[.73,.71,.59]:type==='crawler'?[.53,.72,.60]:type==='drowned'?[.78,.84,.59]:[.70,.83,.78], grime: .55, blood: .40, contrast: 1.14, scale: 8, scatter:[.42,.36,.28], scars: wounds(A,chest,exec), fresh:true }, { roughness: type==='drowned'?.42:type==='crawler'?.46:.59 }), 'sea-glow': mat, wood: C.bodyMaterial(C.gearMaterial('wood'), 'coast-bark', {cls:'wood',sat:.55,tint:[1.22,1.15,.91],grime:.28,blood:.08,scale:7}, {roughness:.68}), brass: C.bodyMaterial(C.gearMaterial('brass'), 'coast-bronze', {cls:'metal',sat:.4,tint:[.70,.47,.22],grime:.24,rust:.18,wear:.9,scale:8}, {roughness:.48}) };
      // (ajan:visual-dark) drowned flesh: darker, mottled and wetter instead of pale plaster; silhouettes still read by the rim light.
      materials.skin.normalScale.multiplyScalar(exec?.72:.58);
      materials.bone=C.bodyMaterial(C.gearMaterial('bone'),'coast-salt-bone',{cls:'bone',sat:.5,tint:[.86,.87,.76],grime:.45,blood:.12,scale:10},{roughness:.70});materials.bone.normalScale.set(.32,.32);
      materials.flesh=C.bodyMaterial(C.gearMaterial('leather'),'coast-rotten-flesh',{cls:'skin',skin:1,sat:.3,tint:[.7,.86,.78],grime:.45,blood:.34,scatter:[.36,.40,.30],scale:11},{roughness:.55,color:new T.Color(0xffffff)});materials.flesh.normalScale.set(.23,.23);
      materials.ash=C.bodyMaterial(C.gearMaterial('leather'),'coast-chitin',{cls:'bone',sat:.15,tint:[.91,1.12,1.03],grime:.27,blood:.08,scale:9},{roughness:.49});materials.ash.normalScale.set(.44,.44);materials.ash.color.setRGB(.73,.83,.77);materials.bone.color.setRGB(.94,.89,.76);
      // Reuse the packaged leather and limestone albedo/relief scans for rotten hide and salt shell.
      // No flat procedural corpse map: fine pores, mineral grain and cracks remain attached to the mesh.
      materials.rope=C.bodyMaterial(C.gearMaterial('rope'),'coast-hemp-net',{cls:'cloth',sat:.7,tint:[1.30,.87,.42],grime:.18,scale:12},{roughness:.94});
      // Salt-stained sailcloth hangs in strips and follows the hips and thighs, not a rigid skirt.
      materials.rag = C.bodyMaterial(C.gearMaterial('rag'), 'coast-sailcloth-'+type, {cls:'cloth',tear:true,sat:.32,tint:type==='drowned'?[.38,.26,.15]:type==='lantern'?[.24,.09,.12]:type==='rootborn'?[.31,.24,.10]:type==='bell'?[.2,.16,.11]:[.23,.3,.25],grime:.48,blood:.28,scale:6}, {roughness:.92,side:T.DoubleSide});materials.rag.normalScale.set(1.1,1.1);
      if(!materials.rag.userData.coastWind){var oldCompile=materials.rag.onBeforeCompile,oldKey=materials.rag.customProgramCacheKey;materials.rag.onBeforeCompile=function(sh){oldCompile.call(this,sh);sh.uniforms.coastClothClock=B.CoastClothClock;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float coastClothClock;').replace('#include <begin_vertex>','#include <begin_vertex>\nfloat cw=1.-smoothstep(.6,1.35,position.y);transformed.z+=sin(position.y*8.+position.x*11.+coastClothClock*1.4)*.009*cw;transformed.x+=sin(position.z*9.+coastClothClock*1.1)*.004*cw;');};materials.rag.customProgramCacheKey=function(){return oldKey.call(this)+'-coast-wind-1';};materials.rag.userData.coastWind=true;}
      var top = hip.y + .08, bottom = hip.y - (type === 'lantern' ? .68 : type === 'bell' ? .52 : .36);
      // Outer/inner eight-row shell replaces the former sixteen-row single sheet.
      // Same main face budget, with a real hem and overlapping front edges instead of a paper-thin cutout.
      var cloth = G.shell(40, 8, function(u,v) {
        var a=-.15+u*(TAU+.30),hang=v*v*(3-2*v),
          // Cloth pulls tight at the rope belt, then breaks into deep, uneven folds.
          // Broad folds read at the game camera; the licensed linen supplies the fine weave.
          fold=(Math.sin(a*7+.3+v*.65)*.023+Math.sin(a*11-v*1.3)*.009)*hang,
          r=.20+v*.055+fold+Math.pow(u,12)*.005,hem=(Math.sin(a*7+.3)*.035+Math.sin(a*13)*.018)*hang;
        return [hip.x+Math.sin(a)*r,top+(bottom-top)*v+hem,hip.z+Math.cos(a)*r];
      }, .003, false, true);
      G.uvScale(cloth,.42,.28);G.wear(cloth,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.72,width:.06,bottom:.12,base:.03}});
      // A closed hem has no open border for wear() to detect: bake its frayed lower fringe explicitly.
      var cp=cloth.attributes.position,cw=cloth.attributes.kwear;
      for(var ci=0;ci<cp.count;ci++){var ct=Math.max(0,Math.min(1,(cp.getY(ci)-bottom+.035)/.085));cw.setW(ci,.03+.52*(1-ct*ct*(3-2*ct)));}
      A.weighted('rag',cloth,C.clothWeights(A,'pelvis',exec?'thighL':'thigh_l',exec?'thighR':'thigh_r',top,bottom,.68));
      if(type==='lantern') {
        var mantle=G.sheet(28,20,function(u,v){var a=Math.PI*.55+u*Math.PI*.9,r=.23+v*.07+Math.sin(u*35+v*3)*.018;return [chest.x+Math.sin(a)*r,chest.y+.1-v*.95+Math.sin(u*45)*.07*v*v,chest.z+Math.cos(a)*r];},false);
        G.uvScale(mantle,3,3);G.wear(mantle,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.8,width:.05,bottom:.18,base:.02}});
        A.transfer('rag',mantle,['skin']);
      }
      // Every new creature has original readable anatomy and gear, rather than the first chapter's outfit.
      if (type === 'drowned') {
        growth(A, spine, chest.clone().add(new T.Vector3(.13, -.09, .1)), .18, 19);
        growth(A, 'lowerarm_l', A.P('lowerarm_l'), .09, 10);
        [-1,1].forEach(function(s){for(var j=0;j<4;j++){var path=[];for(var k=0;k<=8;k++){var a=s*(.32+k*.085),q=skinPoint(A,chest.clone().add(new T.Vector3(Math.sin(a)*.4,-.10-j*.058,Math.cos(a)*.45)),.009);path.push(arr(q));}tube(A,'bone',spine,path,.014);}});
        grin(A, head, p.clone().add(new T.Vector3(0, -.01, .035)), .092); eye(A, head, p, .012);
        var belt=[];for(var b=0;b<=24;b++){var ba=b/24*TAU;belt.push([hip.x+Math.sin(ba)*.205,top-.022+Math.sin(ba*2)*.006,hip.z+Math.cos(ba)*.205]);}tube(A,'rope','pelvis',belt,.012);
        // Torn fishing net draped behind the shoulder, each strand has actual thickness.
        for (var i = 0; i < 7; i++) tube(A, 'rope', spine, [[-.22 + i * .07, chest.y + .12, chest.z - .12], [-.28 + i * .08, chest.y - .24, chest.z - .24], [-.33 + i * .10, hip.y - .17, hip.z - .23]], .007);
        for (var j = 0; j < 5; j++) tube(A, 'rope', spine, [[-.25 - j * .013, chest.y - j * .13, chest.z - .18], [.2 + j * .025, chest.y - j * .13, chest.z - .2]], .007);
        return { weapon: oar(), materials: materials };
      }
      if (type === 'rootborn' || type === 'bell') {
        [-1,1].forEach(function(s){plate(A,spine,chest.clone().add(new T.Vector3(s*.29,.035,.22)),type==='bell'?.18:.11,1.25,'wood',s);});
        roots(A, spine, chest.clone().add(new T.Vector3(0, .12, -.12)), type === 'bell' ? 13 : 9, type === 'bell' ? .66 : .43);
        roots(A, head, p.clone().add(new T.Vector3(0, .08, -.03)), 7, .32);
        [handL, handR].forEach(function (b) { roots(A, b, A.P(b), 4, .24); });
        for (var j = 0; j < 5; j++) tube(A, 'wood', spine, [[-.19, chest.y + .04 - j * .065, chest.z + .08], [0, chest.y - .14 - j * .045, chest.z + .20], [.21, chest.y - .09 - j * .055, chest.z + .05]], .025);
        grin(A, head, p, .11); eye(A, head, type==='bell'?p.clone().add(new T.Vector3(0,-.020,.085)):p, .015);
        growth(A, 'pelvis', hip, .20, type === 'bell' ? 26 : 10);
        if (type === 'bell') {
          // The chest is a barnacle-covered bronze bell with a jaw-like cracked rim.
          var front=skinPoint(A,chest.clone().add(new T.Vector3(0,-.10,.50)),.08),bz=front.z;
          var bell=G.lathe([[.045,0],[.12,.025],[.18,.09],[.24,.23],[.29,.36],[.38,.51],[.40,.55],[.385,.575],[.36,.55]],48);
          var bp=bell.attributes.position;for(var k=0;k<bp.count;k++){var y=bp.getY(k);if(y>.50)bp.setY(k,y+Math.pow(Math.max(0,Math.sin(Math.atan2(bp.getX(k),bp.getZ(k))*7+.6)),12)*.025);}
          bell.computeVertexNormals();bell.rotateX(Math.PI);bell.translate(chest.x,chest.y+.21,bz);A.rigid('brass',bell,spine);
          A.rigid('void',G.sphere(.35,[chest.x,chest.y-.36,bz],[1,.08,1],28,12),spine);
          A.rigid('sea-glow',G.sphere(.07,[chest.x,chest.y-.29,bz+.12],[1,1.5,1],16,12),spine);
          var trim=[],pins=[];for(var k=0;k<=40;k++){var a=k/40*TAU;trim.push([chest.x+Math.sin(a)*.305,chest.y-.17,bz+Math.cos(a)*.305]);if(k%4===0)pins.push(G.sphere(.011,[chest.x+Math.sin(a)*.315,chest.y-.17,bz+Math.cos(a)*.315],1,8,6));}
          tube(A,'brass',spine,trim,.008);A.rigid('bone',G.merge(pins),spine);
          growth(A,spine,new T.Vector3(chest.x+.24,chest.y-.16,bz+.29),.13,20);
          ['upper_armL','upper_armR'].forEach(function(b,i){var sh=A.P(b);plate(A,b,sh.clone().add(new T.Vector3(i?-.06:.06,.18,.12)),.19,1.10,'ash',i);growth(A,b,skinPoint(A,sh.clone().add(new T.Vector3(0,.26,.08)),.015),.13,11);});
          // A broken boat's keel has grown into the spine, with overlapping salt-crusted plates.
          for(var k=0;k<5;k++)plate(A,spine,chest.clone().add(new T.Vector3(0,.12-k*.11,-.30)),.20-k*.017,.70,'ash',k);
          var shroud=G.sheet(32,18,function(u,v){var a=Math.PI*.61+u*Math.PI*.78,r=.33+v*.1+Math.sin(u*33+v*4)*.022*v;return [chest.x+Math.sin(a)*r,chest.y+.08-v*.90+Math.sin(u*37)*.065*v*v,chest.z+Math.cos(a)*r-.09];},false);G.uvScale(shroud,3,3);G.wear(shroud,{tear:{amount:.8,width:.065,bottom:.2,base:.02}});A.transfer('rag',shroud,['skin']);
          return { weapon: anchor(), materials: materials };
        }
        var club = { parts: { wood: [G.tube([[0, -.12, 0], [.04, .38, .02], [-.08, .85, 0], [.03, 1.18, .06]], .07, 9, 28, true)], bone: [G.spike(.09, new T.Vector3(0, .85, 0), new T.Vector3(.22, 1.03, .03)), G.spike(.06, new T.Vector3(0, .98, 0), new T.Vector3(-.2, 1.2, -.03))] }, tip: new T.Vector3(0, 1.2, 0) };
        return { weapon: club, materials: materials };
      }
      if (type === 'urchin') {
        // Dorsal armoured shell and asymmetric salt spines.
        A.rigid('ash', G.blob(.31, [chest.x, chest.y -.12, chest.z -.19], [1.1, 1.3, .65], .20, 3, 20), spine);
        var spines = [];
        for (var i = 0; i < 38; i++) { var a = i * 2.399, u = (i / 37 - .5) * .57, base = new T.Vector3(Math.cos(a) * .28, chest.y -.12 + u, chest.z -.2 + Math.sin(a) * .11), tip = base.clone().add(new T.Vector3(Math.cos(a) * (.20 + i % 4 * .04), u * .4, -.18 - Math.abs(Math.sin(a)) * .12)); spines.push(G.spike(.028, base, tip)); }
        A.rigid('bone', G.merge(spines), spine);
        for(var k=0;k<4;k++)plate(A,spine,chest.clone().add(new T.Vector3(0,.10-k*.13,-.30)),.23-k*.024,.60,'ash',k);
        growth(A, head, p, .12, 12); grin(A, head, p, .10);
        roots(A, handL, A.P(handL), 4, .2); roots(A, handR, A.P(handR), 4, .2);
      } else if (type === 'crawler') {
        // Low, long-armed anatomy with an open segmented jaw and a ridged carapace.
        grin(A, head, p.clone().add(new T.Vector3(0, -.015, .07)), .16); eye(A, head, p, .018);
        A.rigid('ash', G.blob(.22, [chest.x, chest.y, chest.z -.15], [1.1, 1.5, .7], .15, 3, 18), spine);
        for(var k=0;k<4;k++)plate(A,spine,chest.clone().add(new T.Vector3(0,.12-k*.10,-.30)),.16-k*.013,.70,'ash',k);
        for (var j = 0; j < 8; j++) tube(A, 'bone', spine, [[-.18, chest.y + .12 - j * .06, chest.z -.10], [0, chest.y + .16 - j * .06, chest.z -.33], [.18, chest.y + .12 - j * .06, chest.z -.10]], .025);
        [handL, handR].forEach(function (b) { var h = A.P(b), claws = []; for (var j = 0; j < 4; j++) { var q = h.clone().add(new T.Vector3((j - 1.5) * .04, -.08, .015)); claws.push(G.tube([arr(q), arr(q.clone().add(new T.Vector3(0, -.12, .07))), arr(q.clone().add(new T.Vector3(0, -.16, .19)))], .018, 6, 14, true)); } A.rigid('bone', G.merge(claws), b); });
      } else if (type === 'lantern') {
        grin(A, head, p.clone().add(new T.Vector3(0, -.015, .02)), .135); eye(A, head, p, .012);
        // A real ribbed iron lantern replaces the back of the skull; the light stays inside the cage.
        var h = p.clone().add(new T.Vector3(0, .19, -.04)), cage = [];
        for (var j = 0; j < 12; j++) { var a=j/12*TAU; cage.push(G.tube([[h.x+Math.sin(a)*.12,h.y-.17,h.z+Math.cos(a)*.12],[h.x+Math.sin(a)*.15,h.y,h.z+Math.cos(a)*.15],[h.x+Math.sin(a)*.12,h.y+.17,h.z+Math.cos(a)*.12]],.0075,7,16,true)); }
        cage.push(G.cyl(.155, .155, .025, 16, [h.x, h.y -.17, h.z]), G.cyl(.13, .16, .07, 16, [h.x, h.y + .18, h.z]), G.ring(.07, .015, [h.x, h.y + .28, h.z], [0, 0, 0], 6, 16));
        [-.10,.10].forEach(function(y){A.rigid('brass',G.ring(.143,.008,[h.x,h.y+y,h.z],[Math.PI/2,0,0],6,32),head);});
        var seal=G.ring(.037,.005,[h.x,h.y-.17,h.z+.14],[0,0,0],6,24);A.rigid('brass',seal,head);
        A.rigid('iron', G.merge(cage), head); A.rigid('sea-glow', G.sphere(.071, arr(h), [1, 1.6, 1], 16, 12), head);
        roots(A, spine, chest.clone().add(new T.Vector3(0, -.05, -.09)), 5, .33);
        growth(A, handL, A.P(handL), .065, 7);
        tube(A,'rope',handR,[arr(A.P(handR)),arr(A.P(handR).add(new T.Vector3(.05,-.25,.03))),arr(A.P(handR).add(new T.Vector3(-.04,-.45,.04)))],.012);
      }
      return { materials: materials };
    });
  }
  make('drowned', { base: 'ubc', height: 2.2, radius: .46, motionType: 'guard' });
  make('rootborn', { base: 'ubc', height: 2.65, radius: .65, motionType: 'guard' });
  make('crawler', { base: 'ubc', height: 1.70, radius: .55, motionType: 'stalker', detailMotion: function (bones, scene, scale) {
    var pitch = new T.Quaternion(), axis = new T.Vector3(1,0,0), t = 0;
    return function(dt,state){
      if(state.dead)return;t+=dt;
      var lift=state.pose==='leap' ? .3 : .68;
      // Longer arms and a low four-limb silhouette distinguish its gait from the humanoids.
      pitch.setFromAxisAngle(axis,lift);bones.spine_01.quaternion.multiply(pitch);
      pitch.setFromAxisAngle(axis,-lift*.72);bones.Head.quaternion.multiply(pitch);
      bones.pelvis.position.y-=.13/scale;
      if(!state.attack){pitch.setFromAxisAngle(axis,Math.sin(t*5.2)*.07*(state.move||0));bones.neck_01.quaternion.multiply(pitch);}
    };
  } });
  make('urchin', { base: 'executioner', height: 2.2, radius: .61, motionType: 'carrier' });
  make('lantern', { base: 'ubc', height: 2.55, radius: .42, motionType: 'cultist' });
  make('bell', { base: 'executioner', height: 3.85, radius: 1.03, motionType: 'boss' });
}());
