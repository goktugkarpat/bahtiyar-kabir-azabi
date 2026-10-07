/* KABİR AZABI — III: Sessiz Taht / IV: Kızıl Ocak. A ruined mortuary city gives way to a limestone cavern and the king's buried court;
   the foundry below it is iron and fire. Local scanned PBR maps only. Structure, collision and navigation live here; every room's own look
   is composed in ruins-rooms.js (III) / forge-rooms.js (IV) on top of ruins-kit.js (merged geometry, decals, shader sprites). */
(function () {
  'use strict';
  var B=window.BABA,T=window.THREE,PI=Math.PI;
  var NAMES=[KabirI18n.t('Kıyının Ardındaki Yol'),KabirI18n.t('Yitik Sütunlar'),KabirI18n.t('Kül Kapısı'),KabirI18n.t('Kralların Mezarları'),KabirI18n.t('Yemin Bozan Avlu'),KabirI18n.t('Çöken Anıt'),KabirI18n.t('Mağaranın Ağzı'),KabirI18n.t('Kör Kristaller'),KabirI18n.t('Fısıltı Geçidi'),KabirI18n.t('Taşın İçindeki Ölüler'),KabirI18n.t('Yutulan Saray'),KabirI18n.t('Son Yemin'),KabirI18n.t('Tahtın Nöbeti'),KabirI18n.t('Sessiz Taht')];
  var FORGE_NAMES=[KabirI18n.t('Kralın Altındaki Geçit'),KabirI18n.t('Kör Körükler'),KabirI18n.t('Kömür Mahkûmları'),KabirI18n.t('Kızgın Nakliye'),KabirI18n.t('Kül Vezirinin Avlusu'),KabirI18n.t('Sönen Dökümhane'),KabirI18n.t('Demirin Duası'),KabirI18n.t('Zincir Kuyuları'),KabirI18n.t('Yutulan Çarklar'),KabirI18n.t('Cüruf Meydanı'),KabirI18n.t('Kızıl Fırınlar'),KabirI18n.t('Köz Yemini'),KabirI18n.t('Son Döküm'),KabirI18n.t('Kızıl Ocak')];
  function build(scene,options){
    var buildT0=performance.now(),forge=!!options&&options.chapter===4,chapter=forge?4:3;
    var root=new T.Group();root.name=forge?KabirI18n.t('Kızıl Ocak'):KabirI18n.t('Sessiz Taht');scene.add(root);
    var textures=[],materials={},geometries=[],colliders=[],groups=[],lights=[],sources=[],flames=[],disposed=false;
    var seed=935713,hero={value:new T.Vector3(0,1,10)},clock={value:0};
    function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    function geo(g){geometries.push(g);return g;}
    var shapes={box:geo(new T.BoxGeometry(1,1,1)),rock:geo(new T.IcosahedronGeometry(.5,1)),spike:geo(new T.ConeGeometry(.5,1,8)),urn:geo(new T.SphereGeometry(.5,8,6))};
    // 1x1 white map = exact x1: iron keeps its flat metalness but shares the sampler set (and so the shader program) of the scanned stones.
    var white=null;function whiteMap(){if(!white){white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1,T.RGBAFormat);white.name='kara:white';white.needsUpdate=true;textures.push(white);}return white;}
    function surface(key,scan,color,scale){
      var props=B.CoastMaterials.createSurface(scan,textures),m=new T.MeshStandardMaterial(Object.assign(props,{color:color,roughness:.9,metalness:0,aoMapIntensity:.55,vertexColors:true}));
      // World-space projection keeps the physical grain size constant across pillars,
      // floor slabs and cave boulders. One set of samplers; no three-plane blending.
      m.onBeforeCompile=function(sh){
        sh.uniforms.ruinTile={value:scale};sh.uniforms.ruinHero=hero;
        sh.vertexShader='varying vec3 ruinP;varying vec3 ruinN;\n'+sh.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
          vec4 rp=vec4(transformed,1.);vec3 rn=objectNormal;
          ruinP=(modelMatrix*rp).xyz;ruinN=normalize(mat3(modelMatrix)*rn);`);
        // Anything tall that stands between the camera and the hero is cut away in a thin cone along the view ray (never a hole over his head).
        sh.fragmentShader='varying vec3 ruinP;varying vec3 ruinN;uniform float ruinTile;uniform vec3 ruinHero;\n'+(WA?WA_DECL:'')+sh.fragmentShader
          .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(ruinP.y>1.7){vec3 re=vec3(ruinHero.x,1.2,ruinHero.z),rd=cameraPosition-re;float rt=clamp(dot(ruinP-re,rd)/dot(rd,rd),0.,1.);if(rt>.03&&rt<.97&&distance(ruinP,re+rd*rt)<1.15+rt*.9)discard;}\n float rcd=distance(ruinP,cameraPosition);if(ruinP.y>2.4&&rcd<9.){float dth=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(rcd<5.2||dth>(rcd-5.2)/3.8)discard;}')
          .replace('#include <map_fragment>',`vec3 rn=abs(ruinN);vec2 ru=rn.y>max(rn.x,rn.z)?ruinP.xz:(rn.x>rn.z?ruinP.zy:ruinP.xy);ru*=ruinTile;
            vec4 sampledDiffuseColor=texture2D(map,ru);diffuseColor*=sampledDiffuseColor;diffuseColor.rgb*=.94+.06*sin(ruinP.x*.31+sin(ruinP.z*.21));`+(WA?WA_ALBEDO:''))
          .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>'+(WA?'\n totalEmissiveRadiance+=vec3(.12,.07,.02)*waGold;':''))
          .replace('#include <roughnessmap_fragment>',T.ShaderChunk.roughnessmap_fragment.replace(/vRoughnessMapUv/g,'ru'))
          .replace('#include <metalnessmap_fragment>',T.ShaderChunk.metalnessmap_fragment.replace(/vMetalnessMapUv/g,'ru'))
          .replace('#include <aomap_fragment>',T.ShaderChunk.aomap_fragment.replace(/vAoMapUv/g,'ru'))
          .replace('#include <normal_fragment_begin>',T.ShaderChunk.normal_fragment_begin.replace(/vNormalMapUv/g,'ru'))
          .replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace(/vNormalMapUv/g,'ru')+(WA?WA_NORMAL:''));
      };
      m.customProgramCacheKey=function(){return 'ruin-scan-108'+(WA?'-wa':'');};m.normalScale.set(.65,.65);m.name='ruins-'+key;materials[key]=m;return m;
    }
    // ajan:world-a — Sessiz Taht stone identity (chapter III only, ?nomat: off): gold-veined basalt / tomb marble. A two-scale tonal field
    // breaks the scan's repeat, hairline cracks are darkened and pressed into the normal, and in the king's halls (z < -240) thin gold
    // veins run through the floor and glow faintly. All procedural, no new textures or draws.
    var WA=!forge&&B.WorldARuins&&B.WorldARuins.active&&!/[?&]nomat\b/.test(location.search);
    var WA_DECL='float waH1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float waN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(waH1(i),waH1(i+vec2(1.,0.)),f.x),mix(waH1(i+vec2(0.,1.)),waH1(i+vec2(1.,1.)),f.x),f.y);}\n';
    var WA_ALBEDO='\n float waM=waN(ruinP.xz*.09+ruinP.y*.05)*.6+waN(ruinP.xz*.27+5.3)*.4;'+
      ' diffuseColor.rgb*=mix(vec3(.8,.83,.9),vec3(1.1,1.0,.88),smoothstep(.3,.7,waM))*(.9+.2*waN(ruinP.xz*1.3+ruinP.y));'+
      ' float waC=(1.-smoothstep(0.,.03,abs(waN(ruinP.xz*.55+ruinP.y*.3)-.5)))*smoothstep(.5,.72,waN(ruinP.xz*.05+3.1));'+
      ' diffuseColor.rgb*=1.-waC*.55;'+
      ' float waGold=(ruinP.z<-240.&&ruinN.y>.7)?(1.-smoothstep(0.,.012,abs(waN(ruinP.xz*.8+7.)-.5)))*smoothstep(.62,.85,waN(ruinP.xz*.12))*(.4+.6*waN(ruinP.xz*3.1)):0.;'+
      ' diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.9,.66,.3),waGold*.5);\n';
    var WA_NORMAL='\n { float wh=-waC*.05+(waM-.5)*.01; vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition); vec3 r1=cross(sy,normal),r2=cross(normal,sx); float dt=dot(sx,r1);'+
      ' vec3 gr=sign(dt)*(dFdx(wh)*r1+dFdy(wh)*r2); normal=normalize(abs(dt)*normal-gr); }\n';
    surface('floor','monastery',forge?0xaa8e76:0xc5c1b4,.46);surface('stone','paving',0xc8c4b9,.38);surface('wall','wall',0xa4a7a3,.26);
    surface('rock','rock',forge?0x938575:0xa2adb3,.55);surface('earth','rock',0xb7b1a6,.36);surface('iron','metal',0x8b999f,.6);
    surface('wood','wood',0x9a8070,.5);
    // Glowing minerals / metal: emissive stays on the material (bloom does the rest), colour varies per vertex.
    function glowing(key,scan,color,emissive,intensity,scale){var m=surface(key,scan,color,scale);m.emissive.setHex(emissive);m.emissiveIntensity=intensity;m.metalness=.2;m.roughness=.32;return m;}
    glowing('crystal','rock',0xb8e8f4,0x19b5c6,1.15,.65);glowing('crystalV','rock',0xd8c0ff,0x7a34d6,1.2,.65);glowing('crystalA','rock',0xffe2b0,0xd88a24,1.1,.65);
    glowing('slag','rock',0x3a312c,0xff4a0e,1.35,.5);
    materials.iron.color.setHex(0xc7b5a0);materials.iron.metalness=.32;materials.iron.metalnessMap=/[?&]nowhite/.test(location.search)?null:whiteMap();materials.iron.roughness=.66;
    materials.lamp=new T.MeshBasicMaterial({color:forge?0xe9a376:0xf3bc74,vertexColors:true,toneMapped:false,fog:false});
    materials.hot=new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,toneMapped:false,fog:false});
    // Shared sculpted profiles: one vertex buffer per shape, baked into the room meshes.
    var shaft=geo(new T.LatheGeometry([new T.Vector2(.58,-.5),new T.Vector2(.58,-.44),new T.Vector2(.48,-.40),new T.Vector2(.44,-.34),new T.Vector2(.42,.30),new T.Vector2(.46,.38),new T.Vector2(.58,.44),new T.Vector2(.58,.5)],16));
    var sp=shaft.attributes.position;
    for(var v=0;v<sp.count;v++){var x=sp.getX(v),z=sp.getZ(v),y=sp.getY(v),a=Math.atan2(z,x),f=1-.045*(1+Math.cos(a*12))*Math.max(0,1-Math.pow(y/.45,8));sp.setXYZ(v,x*f,y,z*f);}
    shaft.computeVertexNormals();shapes.column=shaft;
    shapes.inlay=geo(new T.RingGeometry(.476,.5,40));shapes.inlay.rotateX(-PI/2);
    shapes.rim=geo(new T.TorusGeometry(.5,.045,6,24));
    shapes.vat=geo(new T.LatheGeometry([new T.Vector2(.30,-.5),new T.Vector2(.42,-.42),new T.Vector2(.50,.25),new T.Vector2(.50,.46),new T.Vector2(.43,.46),new T.Vector2(.40,.25),new T.Vector2(.27,-.30)],16));
    shapes.tooth=geo(new T.LatheGeometry([new T.Vector2(.46,-.5),new T.Vector2(.39,-.25),new T.Vector2(.23,.12),new T.Vector2(.10,.36),new T.Vector2(.015,.5)],8));
    var crag=geo(new T.IcosahedronGeometry(.5,2)),cp=crag.attributes.position;
    for(var v=0;v<cp.count;v++){var x=cp.getX(v),y=cp.getY(v),z=cp.getZ(v),f=1+.16*Math.sin(x*23+y*17+z*9)+.06*Math.sin(z*31-y*13);cp.setXYZ(v,x*f,y*f,z*f);}
    crag.computeVertexNormals();shapes.crag=crag;
    shapes.link=geo(new T.TorusGeometry(.3,.06,3,6));
    shapes.disc=geo(new T.CircleGeometry(.5,20));shapes.disc.rotateX(-PI/2);
    shapes.panel=geo(new T.PlaneGeometry(1,1));shapes.panel.rotateX(-PI/2);
    shapes.cyl=geo(new T.CylinderGeometry(.5,.5,1,12,1));shapes.cyl6=geo(new T.CylinderGeometry(.5,.5,1,6,1));shapes.cone4=geo(new T.ConeGeometry(.5,1,4));
    shapes.crystal=geo(new T.LatheGeometry([new T.Vector2(0,-.5),new T.Vector2(.5,-.5),new T.Vector2(.5,.2),new T.Vector2(.3,.4),new T.Vector2(0,.5)],6));
    var wedge=new T.Shape();wedge.moveTo(-.5,-.5);wedge.lineTo(.5,-.5);wedge.lineTo(.5,.5);wedge.closePath();shapes.wedge=geo(new T.ExtrudeGeometry(wedge,{depth:1,bevelEnabled:false}));shapes.wedge.translate(0,0,-.5);
    var stoneShape=new T.Shape();stoneShape.moveTo(-.5,-.45);stoneShape.lineTo(-.43,-.5);stoneShape.lineTo(.44,-.49);stoneShape.lineTo(.5,-.40);stoneShape.lineTo(.49,.42);stoneShape.lineTo(.4,.5);stoneShape.lineTo(-.44,.48);stoneShape.lineTo(-.5,.36);stoneShape.closePath();
    var cutStone=new T.ExtrudeGeometry(stoneShape,{depth:1,bevelEnabled:false,steps:1});cutStone.translate(0,0,-.5);
    shapes.block=geo(cutStone);
    var tileShape=new T.Shape();tileShape.moveTo(-.5,-.5);tileShape.lineTo(.5,-.5);tileShape.lineTo(.5,.5);tileShape.lineTo(-.5,.5);tileShape.closePath();
    shapes.tile=geo(new T.ExtrudeGeometry(tileShape,{depth:.92,bevelEnabled:true,bevelSize:.022,bevelThickness:.04,bevelSegments:1,steps:1}));shapes.tile.rotateX(-PI/2);shapes.tile.translate(0,-.46,0);
    function gearShape(teeth,inner){var sh=new T.Shape(),n=teeth*4;for(var k=0;k<n;k++){var a=k/n*PI*2,hi=(k%4===1||k%4===2),r=hi?.5:.41;sh[k?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r);}sh.closePath();var hole=new T.Path();hole.absarc(0,0,inner,0,PI*2,true);sh.holes.push(hole);var g=new T.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false});g.translate(0,0,-.5);return g;}
    shapes.gear12=geo(gearShape(12,.14));shapes.gear18=geo(gearShape(18,.3));shapes.gear8=geo(gearShape(8,.1));
    var lavaNormal=forge?B.CoastMaterials.waterNormal(textures):null;
    if(forge){
      materials.lava=new T.ShaderMaterial({uniforms:{clock:clock,norm:{value:lavaNormal},grain:{value:materials.rock.map}},depthWrite:true,toneMapped:false,
        vertexShader:'attribute vec3 color;varying vec3 vP;varying vec3 vE;varying vec2 vUv;void main(){vP=(modelMatrix*vec4(position,1.)).xyz;vE=color;vUv=uv;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
        fragmentShader:`varying vec3 vP;varying vec3 vE;varying vec2 vUv;uniform float clock;uniform sampler2D norm;uniform sampler2D grain;
          void main(){
            vec2 p=vP.xz;vec2 fl=vec2(0.,-clock*.12);
            vec3 n1=texture2D(norm,p*.22+fl*.6).rgb;vec3 n2=texture2D(norm,p*.55+fl+(n1.rg-.5)*.4).rgb;
            float plates=texture2D(grain,p*.5+fl*.7+(n1.rg-.5)*.25).r;
            float c=smoothstep(.30,.56,plates*.95+(n1.r-.5)*.5+.04);
            vec2 e=min(vUv,1.-vUv)*vE.xy*2.;float bank=smoothstep(0.,.7,min(e.x,e.y));
            c=clamp(c+(1.-bank)*.8,0.,1.);
            float gl=.6+.4*sin(clock*1.3+p.y*.9+n1.g*8.);
            vec3 molten=mix(vec3(1.05,.2,.02),vec3(1.5,.55,.12),gl*.7+n2.g*.3);
            vec3 crust=vec3(.05,.02,.014);
            float rim=smoothstep(.0,.25,c)*(1.-smoothstep(.25,.6,c));
            vec3 col=mix(molten,crust,smoothstep(.35,.75,c));col+=vec3(1.0,.32,.05)*rim*.7;
            gl_FragColor=vec4(col,1.);}`});
    }
    var rooms=(forge?FORGE_NAMES:NAMES).map(function(name,i){return {id:i,name:name,x:[0,-4,4,-5,5,0,-3,4,-4,5,-4,0,3,0][i],z:8-i*26,w:i===13?32:28,d:i===13?26:22};});
    var floors=rooms.map(function(r){return {x:r.x,z:r.z,w:r.w,d:r.d};}),paths=[],encounters=[];
    rooms.forEach(function(r){var group=new T.Group();group.name=r.name;root.add(group);groups.push(group);});
    var K=B.RuinsKit.create({forge:forge,root:root,materials:materials,textures:textures,groups:groups,shapes:shapes,clock:clock,sources:sources,flames:flames,geometries:geometries,rooms:rooms,solid:solid});
    var Script=forge?B.ForgeRooms:B.RuinsRooms;
    // Legacy structure (collision-bearing walls, columns, tomb blocks, cave masses). Its random sequence defines the collision geometry and is kept
    // bit-for-bit; only some of its meshes are still drawn (the rooms' own scripts dress everything else).
    var keep=true;
    function put(id,kind,key,x,y,z,w,h,d,a,rx,rz){if(keep)K.put(id,kind,key,x,y,z,w,h,d,a,rx,rz,null,id>=6&&!forge?.35:0);}
    function solid(x,z,w,d){colliders.push({x:x,z:z,w:w,d:d});}
    rooms.forEach(function(r,i){
      keep=true;
      K.put(i,'box',forge?'floor':i<6?'floor':'earth',r.x,-.18,r.z,r.w,.36,r.d,0,0,0,null,0);
      if(i<rooms.length-1){var next=rooms[i+1],a=r.z-r.d/2,b=next.z+next.d/2,d=a-b+.08;
        floors.push({x:0,z:(a+b)/2,w:7,d:d});paths.push({a:{x:0,z:r.z},b:{x:0,z:next.z},width:7});
        K.put(i,'box',forge?'floor':i<5?'floor':'earth',0,-.18,(a+b)/2,7,.36,d,0,0,0,null,0);
        if(i<5){[-1,1].forEach(function(s){solid(s*3.8,(a+b)/2,.65,d);});}
      }
      keep=false;
      if(forge){
        [-1,1].forEach(function(sign){
          solid(r.x+sign*r.w/2,r.z,.8,r.d);
          for(var n=0;n<4;n++){var z=r.z+(n-1.5)*5.2;solid(r.x+sign*8.3,z,.9,.9);}
        });
        if(i%3===1){[-1,1].forEach(function(sign){solid(r.x+sign*(i===7?10.8:i===4&&sign<0?9.8:6.8),r.z-7,i===7?3.4:3.2,i===7?3.4:2.2);});}
      }else if(i<6){
        [-1,1].forEach(function(s){
          solid(r.x+s*r.w/2,r.z,.7,r.d);
          for(var n=0;n<4;n++){var x=r.x+s*(r.w/2-2.2),z=r.z+(n-1.5)*5.2;solid(x,z,1.45,1.45);if(n%2===0){solid(x-s*.6,z+1.2,2.4,1.5);}}
        });
        for(var n=0;n<4;n++){var s=n%2?-1:1,x=r.x+s*8,z=r.z+(n<2?-4:4);solid(x,z,2.25,3.5);}
        if(i===4){solid(r.x,r.z-9.5,5,1.2);}
        if(i===1||i===3){[-1,1].forEach(function(sign){solid(sign*4,r.z-8,1,1);});}
      }else{
        keep=true;
        // Large broken limestone masses, smaller buttresses, connected crystal seams (kept: their random sequence places the colliders).
        [-1,1].forEach(function(s){
          for(var n=0;n<7;n++){var x=r.x+s*(r.w/2+.2),z=r.z+(n-3)*3.1,h=4.2+rnd()*3.2;
            put(i,'crag','rock',x,h*.43,z,5+rnd()*2,h,5+rnd()*2,rnd()*PI,.1*rnd(),.12*s);solid(x-s*.5,z,3.4,4);
            put(i,'rock','rock',x-s*1.6,.7,z,2.0,1.4,2.5,rnd()*PI);
          }
          for(var n=0;n<5;n++){var x=r.x+s*(10+rnd()),z=r.z+(n-2)*4.2,h=1.1+rnd()*2.3;
            put(i,'tooth','rock',x,h/2,z,.65,h,.65,.2,0,s*.12);solid(x,z,.75,.75);
            if(n%2===i%2&&!(B.WorldARuins&&B.WorldARuins.active)){put(i,'spike','crystal',x-s*.55,.65,z,.38,1.3,.38,.4,0,s*.25);put(i,'spike','crystal',x-s*.8,.38,z+.3,.3,.76,.3,.7,0,-s*.32);}
          }
        });
        if(i===9||i===10){for(var n=0;n<4;n++){var s=n%2?1:-1,x=r.x+s*7.7,z=r.z+(n<2?-5:5);keep=false;solid(x,z,1.8,2.7);}}
        keep=true;
        // Low rubble on the margins gives the cave floor depth without obstructing combat.
        [-1,1].forEach(function(sign){for(var q=0;q<7;q++){
          var rx=r.x+sign*(7.4+rnd()*1.5),rz=r.z+(q-3)*2.1,sz=.28+rnd()*.38;
          put(i,'rock','rock',rx,sz*.16,rz,sz,sz*.32,sz*.8,rnd()*PI,.1,.1);
        }});
      }
      keep=true;
      // Uneven stone edging is above the ground, with no coplanar texture overlap (random draws kept; meshes only in the caves).
      for(var n=0;n<9;n++){var ex=r.x+(n%2?-1:1)*11,ez=r.z+(Math.floor(n/2)-2)*4.2,es=.7,er=rnd();if(i>=6&&!forge)put(i,'rock','rock',ex,.14,ez,es,.28,1.1,er*PI);}
      keep=false;
      if(i===11)return;
      if(i===13){
        solid(0,r.z-9,4.8,1.6);
        encounters.push({id:forge?'furnace-heart':'hollow-court',room:i,name:forge?KabirI18n.t('Ocağın Son Dökümü'):KabirI18n.t('Tahtın İçindeki Boşluk'),spawns:[{type:forge?'furnaceheart':'hollowking',x:0,z:r.z-1,boss:true}],stage:1.2});return;
      }
      var types=forge?(i<6?['emberbound','chainseer','forgesentinel','emberbound','slagcrawler']:['slagcrawler','forgesentinel','chainseer','slagcrawler','emberbound']):i<6?['ashbound','shardseer','gravemason','ashbound','cavefang']:['cavefang','gravemason','shardseer','cavefang','ashbound'];
      var spawns=types.map(function(type,n){return {type:type,x:r.x+(n===4?0:n%2?3.4:-3.4),z:r.z+(n===4?0:n<2?-4:4)};});
      if(i===4||i===9)spawns.push({type:forge?'ashwarden':'ruinwarden',x:r.x,z:r.z-7,elite:true});
      encounters.push({id:(forge?'forge-':'ruin-')+i,room:i,name:r.name,clearText:KabirI18n.t('Buradaki sesler sustu. Kuzeydeki yol açık.'),stage:forge?1.08+i*.016:1.02+i*.018,spawns:spawns});
    });
    // Each room's own composition.
    var info={rooms:rooms,forge:forge,names:forge?FORGE_NAMES:NAMES};
    rooms.forEach(function(r,i){Script.dress(K,r,i,info);});
    /* ajan:world-a */ if(!forge&&B.WorldARuins&&B.WorldARuins.active)B.WorldARuins.dress(K,rooms,{solid:solid,floors:floors,paths:paths,colliders:colliders,root:root}); /* /ajan:world-a */
    var meshes=K.finish().concat(K.finishFx());
    var gearSpin=K.spinners;
    // Broad phase bounds prevent collision cost from growing with the art detail.
    // Same predicate as before (a point is walkable inside any floor rectangle and outside every collider by its radius), but numeric cell keys,
    // pre-computed collider bounds and a last-hit floor cache: the enemies' path search calls this thousands of times when a fight starts.
    var grid=new Map(),cell=8,lastF=0,nf=floors.length;
    colliders.forEach(function(c){c.x0=c.x-c.w/2;c.x1=c.x+c.w/2;c.z0=c.z-c.d/2;c.z1=c.z+c.d/2;for(var x=Math.floor(c.x0/cell);x<=Math.floor(c.x1/cell);x++)for(var z=Math.floor(c.z0/cell);z<=Math.floor(c.z1/cell);z++){var k=x*4096+z,l=grid.get(k);if(!l)grid.set(k,l=[]);l.push(c);}});
    function isWalkable(x,z,r){
      if(!Number.isFinite(x)||!Number.isFinite(z))return false;r=r==null?.46:Math.max(.01,r);
      var f=floors[lastF];
      if(!(Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2)){var hit=-1;for(var i=0;i<nf;i++){f=floors[i];if(Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2){hit=i;break;}}if(hit<0)return false;lastF=hit;}
      var rr=r*r-1e-6,g1=Math.floor((x+r)/cell),h1=Math.floor((z+r)/cell),h0=Math.floor((z-r)/cell);
      for(var gx=Math.floor((x-r)/cell);gx<=g1;gx++)for(var gz=h0;gz<=h1;gz++){var list=grid.get(gx*4096+gz);if(!list)continue;for(var j=0;j<list.length;j++){var c=list[j],dx=x-(x<c.x0?c.x0:x>c.x1?c.x1:x),dz=z-(z<c.z0?c.z0:z>c.z1?c.z1:z);if(dx*dx+dz*dz<rr)return false;}}
      return true;
    }
    function move(p,dx,dz,r){if(!Number.isFinite(dx)||!Number.isFinite(dz))return p;var n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.18)),sx=dx/n,sz=dz/n;for(var i=0;i<n;i++){if(isWalkable(p.x+sx,p.z+sz,r)){p.x+=sx;p.z+=sz;}else{if(isWalkable(p.x+sx,p.z,r))p.x+=sx;if(isWalkable(p.x,p.z+sz,r))p.z+=sz;}}return p;}
    function hasClearPath(ax,az,bx,bz,r){var n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/.3));for(var i=0;i<=n;i++)if(!isWalkable(ax+(bx-ax)*i/n,az+(bz-az)*i/n,r))return false;return true;}
    var nodes=[];rooms.forEach(function(r){[-6,0,6].forEach(function(x){[-7,0,7].forEach(function(z){if(isWalkable(x,r.z+z,1.05))nodes.push({x:x,z:r.z+z,edges:[]});});});});
    for(var i=0;i<nodes.length;i++)for(var j=i+1;j<nodes.length;j++)if(Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z)<30&&hasClearPath(nodes[i].x,nodes[i].z,nodes[j].x,nodes[j].z,1.05)){nodes[i].edges.push(j);nodes[j].edges.push(i);}
    var dist=new Float64Array(nodes.length),prev=new Int16Array(nodes.length),used=new Uint8Array(nodes.length);
    function pathTo(from,to,r){
      if(!isWalkable(to.x,to.z,r))return[];if(hasClearPath(from.x,from.z,to.x,to.z,r))return[{x:to.x,z:to.z}];
      dist.fill(Infinity);prev.fill(-1);used.fill(0);
      for(var i=0;i<nodes.length;i++)if(Math.hypot(nodes[i].x-from.x,nodes[i].z-from.z)<24&&hasClearPath(from.x,from.z,nodes[i].x,nodes[i].z,r))dist[i]=Math.hypot(nodes[i].x-from.x,nodes[i].z-from.z);
      var end=-1;for(var k=0;k<nodes.length;k++){var at=-1,best=Infinity;for(var i=0;i<nodes.length;i++)if(!used[i]&&dist[i]<best){best=dist[i];at=i;}if(at<0)break;used[at]=1;var n=nodes[at];if(Math.hypot(to.x-n.x,to.z-n.z)<24&&hasClearPath(n.x,n.z,to.x,to.z,r)){end=at;break;}for(var j=0;j<n.edges.length;j++){var id=n.edges[j],next=nodes[id],cost=best+Math.hypot(next.x-n.x,next.z-n.z);if(cost<dist[id]){dist[id]=cost;prev[id]=at;}}}
      if(end<0)return[];var path=[{x:to.x,z:to.z}];for(var at=end,guard=0;at>=0&&guard++<nodes.length;at=prev[at])path.unshift({x:nodes[at].x,z:nodes[at].z});return path;
    }
    function roomAt(x,z){var closest=rooms[0],best=Infinity;for(var i=0;i<rooms.length;i++){var r=rooms[i];if(Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2)return r;var d=Math.abs(z-r.z);if(d<best){best=d;closest=r;}}return closest;}
    // Three pooled point lights, handed from source to source with a short fade, so a torch is never snapped away (and the light COUNT never changes).
    // Holders rank x1.35 (hysteresis): two torches of similar score never trade places back and forth while the hero fights or turns around.
    // The fade is eased (smoothstep) and the incoming source starts as soon as the outgoing one has gone dark.
    for(var i=0;i<3;i++){var light=new T.PointLight(0xe4ab76,0,13,2);root.add(light);lights.push(light);}
    var slots=[{src:null,w:0},{src:null,w:0},{src:null,w:0}],near=[];
    function byEff(a,b){return b.eff-a.eff;}
    function lightStep(dt,time,p){
      var i,k,sl,s;
      near.length=0;
      for(i=0;i<sources.length;i++){s=sources[i];var dx=s.x-p.x,dz=s.z-p.z;s.distance=Math.hypot(dx,dz);if(s.distance<18){s.score=s.intensity/(1+s.distance*s.distance/30);s.held=false;near.push(s);}}
      for(k=0;k<3;k++){if(slots[k].src)slots[k].src.held=true;}
      for(i=0;i<near.length;i++)near[i].eff=near[i].score*(near[i].held?1.35:1);
      near.sort(byEff);
      for(k=0;k<3;k++){sl=slots[k];if(!sl.src)continue;var ix=near.indexOf(sl.src),want=ix>=0&&ix<3;sl.w=want?Math.min(1,sl.w+dt*3.6):Math.max(0,sl.w-dt*4.2);if(sl.w<=0)sl.src=null;}
      for(k=0;k<3;k++){if(slots[k].src)continue;for(var j=0;j<3&&j<near.length;j++){var c=near[j],taken=false;for(var q=0;q<3;q++)if(slots[q].src===c)taken=true;if(!taken){slots[k].src=c;slots[k].w=0;break;}}}
      for(k=0;k<3;k++){var l=lights[k];sl=slots[k];s=sl.src;l.visible=quality!=='low';l.intensity=0;
        if(s){l.position.set(s.x,s.y,s.z);l.color.copy(s.color);l.distance=s.range||13;l.intensity=s.intensity*(sl.w*sl.w*(3-2*sl.w))*(1+s.flicker*.65*(.5*Math.sin(time*11.3+s.phase*5)+.3*Math.sin(time*17.9+s.phase*2.3)));}}
    }
    // Per-room mood (fog, ambient, key, grade), blended smoothly along the route.
    var moods=B.RuinsKit.makeMoods(Script.moodBase,Script.moodSpecs),live=B.RuinsKit.makeMood(Script.moodBase),moodKeys=Object.keys(live);
    function atmosphereAt(x,z){
      var u=Math.max(0,Math.min(rooms.length-1.001,(rooms[0].z-z)/26)),a=Math.floor(u),f=u-a;f=f<.38?0:f>.62?1:(f-.38)/.24;f=f*f*(3-2*f);
      B.RuinsKit.blendMood(live,moods[a],moods[a+1],f,moodKeys);live.room=Math.min(6,Math.floor(Math.round(u)/2));live.keyIntensity=live.keyI;live.rimIntensity=live.rimI;live.saturation=live.sat;
      return live;
    }
    var quality='high',groupGain={ruins:1},oath=false;
    function update(dt,time,p){p=p||{x:0,z:10};hero.value.set(p.x,1,p.z);clock.value=time||0;
      for(var i=0;i<groups.length;i++){var dz=rooms[i].z-p.z;groups[i].visible=dz>-37&&dz<30;}
      lightStep(dt,time||0,p);
      for(var g=0;g<gearSpin.length;g++){var m=gearSpin[g];m.rotation.z=(time||0)*m.userData.rate;}
      if(materials.crystalA)materials.crystalA.emissiveIntensity=1.1+(oath?.35:0)+.12*Math.sin((time||0)*1.7);
      if(materials.crystal)materials.crystal.emissiveIntensity=1.1+.12*Math.sin((time||0)*.9);
      if(materials.crystalV)materials.crystalV.emissiveIntensity=1.15+.14*Math.sin((time||0)*1.1+2);
    }
    root.updateMatrixWorld(true);
    B.RuinsWorld.lastBuildMs=Math.round(performance.now()-buildT0);
    return {chapter:chapter,name:forge?KabirI18n.t('Kızıl Ocak'):KabirI18n.t('Sessiz Taht'),root:root,rooms:rooms,paths:paths,encounters:encounters,colliders:colliders,occluders:[],materials:materials,questSites:!forge&&B.WorldARuins&&B.WorldARuins.active?Object.assign({},B.WorldARuins.sites):undefined,spawn:{x:0,z:14},checkpoint:{x:0,z:rooms[11].z},bossSpawn:{x:0,z:rooms[13].z-1},
      isWalkable:isWalkable,move:move,hasClearPath:hasClearPath,pathTo:pathTo,roomAt:roomAt,update:update,atmosphereAt:atmosphereAt,effectHeightAt:function(){return .065;},
      setQuality:function(cfg){quality=typeof cfg==='string'?cfg:cfg.quality||cfg.preset||'high';},
      lighting:{sources:sources,flames:flames,shafts:[],moods:[live],groupGain:groupGain,prepareTextures:function(){return textures;},setGroup:function(k,v){groupGain[k]=v;},setGroupTint:function(){},setCorpses:function(){},setOathGlow:function(v,lit){oath=!!lit;},setPlayerLightFx:function(){},wantsShadows:function(){return false;}},
      dispose:function(){if(disposed)return;disposed=true;geometries.forEach(function(g){g.dispose();});K.dispose();Object.keys(materials).forEach(function(k){materials[k].dispose();});textures.forEach(function(t){t.dispose();});lights.forEach(function(l){l.dispose();});root.removeFromParent();root.clear();}
    };
  }
  B.RuinsWorld={build:build};
}());
