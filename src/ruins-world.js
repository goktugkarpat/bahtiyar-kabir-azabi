/* KABİR AZABI — III: Sessiz Taht. A ruined mortuary city gives way to a
   limestone cavern and the king's buried court. Local scanned PBR maps only. */
(function () {
  'use strict';
  var B=window.BABA,T=window.THREE,PI=Math.PI;
  var NAMES=['Kıyının Ardındaki Yol','Yitik Sütunlar','Kül Kapısı','Kralların Mezarları','Yemin Bozan Avlu','Çöken Anıt','Mağaranın Ağzı','Kör Kristaller','Fısıltı Geçidi','Taşın İçindeki Ölüler','Yutulan Saray','Son Yemin','Tahtın Nöbeti','Sessiz Taht'];
  var FORGE_NAMES=['Kralın Altındaki Geçit','Kör Körükler','Kömür Mahkûmları','Kızgın Nakliye','Kül Vezirinin Avlusu','Sönen Dökümhane','Demirin Duası','Zincir Kuyuları','Yutulan Çarklar','Cüruf Meydanı','Kızıl Fırınlar','Köz Yemini','Son Döküm','Kızıl Ocak'];
  function build(scene,options){
    var forge=!!options&&options.chapter===4,chapter=forge?4:3;
    var root=new T.Group();root.name=forge?'Kızıl Ocak':'Sessiz Taht';scene.add(root);
    var textures=[],materials={},geometries=[],colliders=[],batches={},groups=[],lights=[],sources=[],disposed=false;
    var seed=935713,tmp=new T.Object3D(),hero={value:new T.Vector3(0,1,10)};
    function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    function geo(g){geometries.push(g);return g;}
    var shapes={box:geo(new T.BoxGeometry(1,1,1)),rock:geo(new T.IcosahedronGeometry(.5,2)),spike:geo(new T.ConeGeometry(.5,1,8)),urn:geo(new T.SphereGeometry(.5,14,10))};
    function surface(key,scan,color,scale){
      var props=B.CoastMaterials.createSurface(scan,textures),m=new T.MeshStandardMaterial(Object.assign(props,{color:color,roughness:.9,metalness:0,aoMapIntensity:.55}));
      // World-space projection keeps the physical grain size constant across pillars,
      // floor slabs and cave boulders. One set of samplers; no three-plane blending.
      m.onBeforeCompile=function(sh){
        sh.uniforms.ruinTile={value:scale};sh.uniforms.ruinHero=hero;
        sh.vertexShader='varying vec3 ruinP;varying vec3 ruinN;\n'+sh.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
          vec4 rp=vec4(transformed,1.);vec3 rn=objectNormal;
          #ifdef USE_INSTANCING
          rp=instanceMatrix*rp;vec3 rs=vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));rn=mat3(instanceMatrix)*(rn/max(rs,vec3(.0001)));
          #endif
          ruinP=(modelMatrix*rp).xyz;ruinN=normalize(mat3(modelMatrix)*rn);`);
        sh.fragmentShader='varying vec3 ruinP;varying vec3 ruinN;uniform float ruinTile;uniform vec3 ruinHero;\n'+sh.fragmentShader
          .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(ruinP.y>1.8 && distance(ruinP.xz,ruinHero.xz)<1.3)discard;')
          .replace('#include <map_fragment>',`vec3 rn=abs(ruinN);vec2 ru=rn.y>max(rn.x,rn.z)?ruinP.xz:(rn.x>rn.z?ruinP.zy:ruinP.xy);ru*=ruinTile;
            vec4 sampledDiffuseColor=texture2D(map,ru);diffuseColor*=sampledDiffuseColor;diffuseColor.rgb*=.94+.06*sin(ruinP.x*.31+sin(ruinP.z*.21));`)
          .replace('#include <roughnessmap_fragment>',T.ShaderChunk.roughnessmap_fragment.replace(/vRoughnessMapUv/g,'ru'))
          .replace('#include <metalnessmap_fragment>',T.ShaderChunk.metalnessmap_fragment.replace(/vMetalnessMapUv/g,'ru'))
          .replace('#include <aomap_fragment>',T.ShaderChunk.aomap_fragment.replace(/vAoMapUv/g,'ru'))
          .replace('#include <normal_fragment_begin>',T.ShaderChunk.normal_fragment_begin.replace(/vNormalMapUv/g,'ru'))
          .replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace(/vNormalMapUv/g,'ru'));
      };
      m.customProgramCacheKey=function(){return 'ruin-scan-107';};m.normalScale.set(.65,.65);m.name='ruins-'+key;materials[key]=m;
    }
    surface('floor','monastery',forge?0xaa8e76:0xc5c1b4,.46);surface('stone','paving',0xc8c4b9,.38);surface('wall','wall',0xa4a7a3,.26);
    surface('rock','rock',forge?0x938575:0xa2adb3,.55);surface('earth','rock',0xb7b1a6,.36);surface('iron','metal',0x8b999f,.6);
    surface('crystal','rock',0x8aa3c4,.65);materials.crystal.emissive.setHex(forge?0x6c2107:0x314465);materials.crystal.emissiveIntensity=.6;materials.crystal.metalness=.24;materials.crystal.roughness=.35;
    materials.iron.color.setHex(0xc7b5a0);materials.iron.metalness=.32;materials.iron.metalnessMap=null;materials.iron.roughness=.66;
    materials.lamp=new T.MeshBasicMaterial({color:forge?0xe9a376:0xf3bc74});
    // Shared sculpted profiles: one vertex buffer per shape, instanced per room.
    var shaft=geo(new T.LatheGeometry([new T.Vector2(.58,-.5),new T.Vector2(.58,-.44),new T.Vector2(.48,-.40),new T.Vector2(.44,-.34),new T.Vector2(.42,.30),new T.Vector2(.46,.38),new T.Vector2(.58,.44),new T.Vector2(.58,.5)],24));
    var sp=shaft.attributes.position;
    for(var v=0;v<sp.count;v++){var x=sp.getX(v),z=sp.getZ(v),y=sp.getY(v),a=Math.atan2(z,x),f=1-.045*(1+Math.cos(a*12))*Math.max(0,1-Math.pow(y/.45,8));sp.setXYZ(v,x*f,y,z*f);}
    shaft.computeVertexNormals();shapes.column=shaft;
    shapes.inlay=geo(new T.RingGeometry(.476,.5,40));shapes.inlay.rotateX(-PI/2);
    shapes.rim=geo(new T.TorusGeometry(.5,.045,6,24));
    shapes.vat=geo(new T.LatheGeometry([new T.Vector2(.30,-.5),new T.Vector2(.42,-.42),new T.Vector2(.50,.25),new T.Vector2(.50,.46),new T.Vector2(.43,.46),new T.Vector2(.40,.25),new T.Vector2(.27,-.30)],20));
    shapes.tooth=geo(new T.LatheGeometry([new T.Vector2(.46,-.5),new T.Vector2(.39,-.25),new T.Vector2(.23,.12),new T.Vector2(.10,.36),new T.Vector2(.015,.5)],10));
    var crag=geo(new T.IcosahedronGeometry(.5,2)),cp=crag.attributes.position;
    for(var v=0;v<cp.count;v++){var x=cp.getX(v),y=cp.getY(v),z=cp.getZ(v),f=1+.16*Math.sin(x*23+y*17+z*9)+.06*Math.sin(z*31-y*13);cp.setXYZ(v,x*f,y*f,z*f);}
    crag.computeVertexNormals();shapes.crag=crag;
    shapes.link=geo(new T.TorusGeometry(.3,.06,6,14));
    shapes.disc=geo(new T.CircleGeometry(.5,24));shapes.disc.rotateX(-PI/2);
    shapes.panel=geo(new T.PlaneGeometry(1,1));shapes.panel.rotateX(-PI/2);
    var clock={value:0},lavaNormal=forge?B.CoastMaterials.waterNormal(textures):null;
    if(forge){
      materials.lava=new T.ShaderMaterial({uniforms:{clock:clock,norm:{value:lavaNormal},grain:{value:materials.rock.map}},depthWrite:true,
        vertexShader:'varying vec3 vP;void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\nvP=(modelMatrix*p).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
        fragmentShader:'varying vec3 vP;uniform float clock;uniform sampler2D norm;uniform sampler2D grain;void main(){vec2 uv=vP.xz*.36;vec3 n=texture2D(norm,uv+vec2(clock*.013,-clock*.019)).rgb;vec3 r=texture2D(grain,uv+n.rg*.17).rgb;float h=smoothstep(.31,.67,r.r+n.b*.24);vec3 col=mix(vec3(.055,.018,.009),vec3(1.6,.29,.025),h);col+=vec3(1.15,.32,.04)*pow(h,7.);gl_FragColor=vec4(col,1.);}' });
    }
    var rooms=(forge?FORGE_NAMES:NAMES).map(function(name,i){return {id:i,name:name,x:[0,-4,4,-5,5,0,-3,4,-4,5,-4,0,3,0][i],z:8-i*26,w:i===13?32:28,d:i===13?26:22};});
    var floors=rooms.map(function(r){return {x:r.x,z:r.z,w:r.w,d:r.d};}),paths=[],encounters=[];
    // Separate VAO identity per instance matrix, shared immutable vertex buffers.
    var views=[];
    function view(g){var v=new T.BufferGeometry();v.setIndex(g.index);Object.keys(g.attributes).forEach(function(k){v.setAttribute(k,g.attributes[k]);});views.push(v);return v;}
    var stoneShape=new T.Shape();stoneShape.moveTo(-.5,-.45);stoneShape.lineTo(-.43,-.5);stoneShape.lineTo(.44,-.49);stoneShape.lineTo(.5,-.40);stoneShape.lineTo(.49,.42);stoneShape.lineTo(.4,.5);stoneShape.lineTo(-.44,.48);stoneShape.lineTo(-.5,.36);stoneShape.closePath();
    var cutStone=new T.ExtrudeGeometry(stoneShape,{depth:.92,bevelEnabled:true,bevelSize:.022,bevelThickness:.04,bevelSegments:1,steps:1});cutStone.translate(0,0,-.46);
    shapes.block=geo(cutStone);
    function put(id,kind,key,x,y,z,w,h,d,a,rx,rz){
      if(kind==='box'&&h>.2&&['stone','wall'].indexOf(key)>=0)kind='block';
      var k=id+':'+kind+':'+key;if(!batches[k])batches[k]={room:id,geo:shapes[kind],mat:materials[key],list:[],key:key};
      tmp.position.set(x,y,z);tmp.rotation.set(rx||0,a||0,rz||0);tmp.scale.set(w,h,d);tmp.updateMatrix();batches[k].list.push(tmp.matrix.clone());
    }
    function solid(x,z,w,d){colliders.push({x:x,z:z,w:w,d:d});}
    function lamp(id,x,z){
      put(id,'box','iron',x,1.3,z,.22,2.6,.22);put(id,'box','iron',x,2.6,z,.75,.12,.75);put(id,'urn','lamp',x,2.85,z,.25,.45,.25);
      put(id,'column','stone',x,.13,z,.68,.26,.68);
      put(id,'rim','iron',x,2.63,z,.53,.53,.53,0,PI/2);put(id,'rim','iron',x,3.23,z,.53,.53,.53,0,PI/2);
      put(id,'box','iron',x,3.3,z,.65,.12,.65);
      for(var k=0;k<4;k++){var a=k*PI/2;put(id,'box','iron',x+Math.sin(a)*.23,2.94,z+Math.cos(a)*.23,.045,.6,.045);}
      var color=new T.Color(forge?0xd98951:id<6?0xe4ab76:0x8aadc6);
      sources.push({x:x,y:2.9,z:z,color:color,intensity:2.6,distance:12,flicker:.35,phase:id*1.7,score:0,kind:'lantern',scatter:.4,glowRadius:.65,shadowNear:null,group:'ruins',tintGroup:null,dim:color.clone(),live:1,liveColor:color.clone(),livePos:{x:x,y:2.9,z:z},spotW:0});
    }
    function stoneArch(id,x,z,radius,spring){
      for(var k=0;k<13;k++){var a=(k+.5)*PI/13;put(id,'block','stone',x+Math.cos(a)*radius,spring+Math.sin(a)*radius,z,.88,.72,1.0,0,0,a-PI/2);}
      put(id,'block','stone',x,spring+radius+.15,z,.86,1.1,1.2);
    }
    function dressRoom(r,i){
      // The combat floor remains level; joints have real bevels rather than decals.
      for(var z=0;z<7;z++)for(var x=0;x<8;x++){
        if(!forge&&i>=6&&i!==10&&i!==13)continue;
        var px=r.x+(x-3.5)*2.22+(z%2?.16:-.16),pz=r.z+(z-3)*2.6;
        if(forge&&Math.abs(px-r.x)>7.8)continue;
        put(i,'block',forge?'floor':i<6?'floor':'earth',px,-.067,pz,2.14,.18,2.5,(rnd()-.5)*.018);
      }
      if(!forge&&i<6){
        if(i===3||i===4){put(i,'inlay','wall',r.x,.035,r.z,6.2,1,6.2);
          for(var k=0;k<8;k++){var a=k*PI/4;put(i,'block','wall',r.x+Math.sin(a)*2.7,-.015,r.z+Math.cos(a)*2.7,.14,.10,.48,a);}}
        for(var n=0;n<7;n++)[-1,1].forEach(function(sign){put(i,'block','wall',r.x+sign*5.4,-.016,r.z+(n-3)*2.65,.14,.10,1.85);});
      }
      if(!forge&&i>=6){
        // Weathered palace stones disappear into the cave, rather than a tiled cave.
        for(var n=0;n<16;n++){var sign=n%2?1:-1,x=r.x+sign*(5.7+rnd()*2),z=r.z+(rnd()-.5)*17;put(i,'crag','rock',x,.045,z,.6+rnd()*.7,.09,1+rnd(),rnd()*PI);}
      }
      if(forge){
        for(var n=0;n<7;n++)[-1,1].forEach(function(sign){
          var x=r.x+sign*4.9,z=r.z+(n-3)*2.65;
          put(i,'block','iron',x,-.015,z,.35,.10,2.5);
          for(var k=0;k<2;k++)put(i,'urn','iron',x,.039,z+(k?1:-1),.10,.035,.10);
        });
        [-1,1].forEach(function(sign){
          for(var n=0;n<3;n++){
            var x=r.x+sign*12.5,z=r.z+(n-1)*6.3;
            // Furnace backs, inset hot mouths and stone lintels: no extra lights.
            put(i,'block','wall',x,1.6,z,2.7,3.2,3.7);
            put(i,'block','rock',x-sign*1.45,1.2,z, .22,2.15,2.2);
            put(i,'box','lamp',x-sign*1.58,1.2,z,.04,1.05,1.05);
            for(var b=0;b<5;b++)put(i,'box','iron',x-sign*1.64,1.2,z+(b-2)*.24,.1,1.55,.085);
            put(i,'block','stone',x-sign*1.3,2.45,z,.65,.5,2.65);
            put(i,'box','iron',x,3.3,z,2.9,.22,3.95);
          }
          for(var n=0;n<4;n++){
            var x=r.x+sign*8.3,z=r.z+(n-1.5)*5.2;
            put(i,'block','stone',x,.25,z,1.45,.5,1.4);
            for(var h=0;h<3;h++)put(i,'box','iron',x,.9+h*1.25,z,.95,.16,.95);
            for(var b=0;b<3;b++)put(i,'urn','iron',x-sign*.43,.92+b*1.25,z,.12,.12,.12);
          }
          for(var n=0;n<3;n++){
            var x=r.x+sign*9.3,z=r.z+(n-1)*6.5;
            put(i,'vat','iron',x,.70,z,1.7,1.4,1.7);
            put(i,'disc','lava',x,1.15,z,1.15,1,1.15);
            put(i,'rim','iron',x,1.35,z,1.75,1.75,1.75,0,PI/2);
            put(i,'crag','rock',x-sign*1.2,.15,z+1.1,.8,.3,.6,rnd()*PI);
          }
        });
        // Distant overhead ribs terminate in real supports, outside the clear lane.
        if(i%2===0){put(i,'box','iron',r.x,5.0,r.z-8.5,18.2,.42,.7);[-1,1].forEach(function(sign){put(i,'box','iron',r.x+sign*7,4.5,r.z-8.5,3.8,.24,.6,0,0,sign*.35);});}
      }else if(i<6){
        [-1,1].forEach(function(sign){
          for(var n=0;n<4;n++){
            var x=r.x+sign*12,z=r.z+(n-1.5)*5.2;
            put(i,'block','stone',x,.13,z,2.4,.26,2.1);
            put(i,'block','stone',x,1.1,z,1.55,.14,1.55);
            // Recessed wall courses and broken buttress crowns.
            put(i,'block','stone',r.x+sign*13.6,.30,z,1.7,.6,4.8);
            put(i,'block','wall',r.x+sign*13.6,1.4,z,1.05,2.2,.9);
            put(i,'block','stone',r.x+sign*13.6,2.7,z,1.5,.35,1.25);
            if(n%2===1){put(i,'column','stone',x-sign*1.6,.42,z+.9,1.0,2.6,1.0,.45,0,PI/2-.12);put(i,'block','stone',x-sign*2,.14,z+2,.7,.28,.9,.6);}
          }
          // Tomb lids with raised borders and inset inscriptions, no flat overlays.
          for(var n=0;n<2;n++){
            var x=r.x+sign*8,z=r.z+(n?4:-4);
            put(i,'block','stone',x,1.40,z,1.78,.12,2.85);
            for(var side=-1;side<=1;side+=2){put(i,'block','stone',x+side*.83,1.53,z,.16,.16,2.9);put(i,'column','stone',x+side*.8,.55,z+1.35,.30,1.1,.30);}
            put(i,'block','stone',x,1.53,z-1.32,1.85,.16,.18);
            put(i,'urn','rock',x,1.61,z-.60,.30,.22,.30);
            put(i,'block','rock',x,1.57,z+.15,.22,.17,.98);
            put(i,'block','wall',x,1.47,z,.12,.08,1.5);
            put(i,'block','wall',x,1.47,z+.15,.7,.08,.12);
            for(var k=0;k<4;k++)put(i,'block','rock',x-sign*(1.3+rnd()),.08,z+(rnd()-.5)*3,.25+rnd()*.3,.16,.3+rnd()*.5,rnd()*PI);
          }
        });
        if(i===0||i===4)stoneArch(i,r.x,r.z-9,5.1,1.8);
      }else{
        [-1,1].forEach(function(sign){
          for(var n=0;n<5;n++){
            var z=r.z+(n-2)*4.1,x=r.x+sign*12.3;
            put(i,'crag','rock',x,.45,z,3.5,.9,3.8,rnd()*PI);
            put(i,'crag','rock',x+sign*.7,3.1,z,3.0,2.6,3.5,.3,sign*.4,.2);
            put(i,'tooth','rock',x-sign*1.3,.9,z+.7,.65,1.8,.8,.4,0,sign*.18);
            if(n%2===0)put(i,'tooth','rock',x,4.0,z,.8,2.5,.8,0,PI,sign*.12);
          }
          // A buried palace remains visible through the natural rock shelves.
          if(i===10||i===12||i===13){for(var n=0;n<3;n++){var x=r.x+sign*9.1,z=r.z+(n-1)*6;put(i,'column','stone',x,1.2,z,1.3,2.4,1.3);put(i,'block','stone',x,2.5,z,1.8,.25,1.8);}}
        });
      }
      if(i===13){
        // Broad steps and paired monuments frame the boss; dodge space stays clear.
        for(var n=0;n<3;n++)put(i,'block','stone',0,.065+n*.12,r.z-10.5-n*.55,9-n*.7,.13+n*.24,.85);
        [-1,1].forEach(function(sign){put(i,'column',forge?'iron':'stone',sign*5.5,2.3,r.z-9,1.5,4.6,1.5);put(i,'block','stone',sign*5.5,.3,r.z-9,2.4,.6,2.4);});
      }
    }
    rooms.forEach(function(r,i){
      var group=new T.Group();group.name=r.name;root.add(group);groups.push(group);
      put(i,'box',forge?'floor':i<6?'floor':'earth',r.x,-.18,r.z,r.w,.36,r.d);
      if(i<rooms.length-1){var next=rooms[i+1],a=r.z-r.d/2,b=next.z+next.d/2,d=a-b+.08;
        floors.push({x:0,z:(a+b)/2,w:7,d:d});paths.push({a:{x:0,z:r.z},b:{x:0,z:next.z},width:7});
        put(i,'box',forge?'floor':i<5?'floor':'earth',0,-.18,(a+b)/2,7,.36,d);
        if(i<5){[-1,1].forEach(function(s){put(i,'box','wall',s*3.8,1.1,(a+b)/2,.65,2.2,d);solid(s*3.8,(a+b)/2,.65,d);});}
      }
      if(forge){
        [-1,1].forEach(function(sign){
          var x=r.x+sign*11;
          put(i,'box','wall',r.x+sign*r.w/2,2,r.z,.8,4,r.d);solid(r.x+sign*r.w/2,r.z,.8,r.d);
          put(i,'panel','lava',x,.015,r.z,2.3,1,r.d-3);
          // Raised gutters, riveted girders and slag vats leave a wide clear central lane.
          [-1,1].forEach(function(side){put(i,'box','iron',x+side*1.25,.2,r.z,.16,.4,r.d-3);});
          for(var n=0;n<4;n++){var z=r.z+(n-1.5)*5.2;
            put(i,'column','iron',r.x+sign*8.3,2.4,z,.7,4.8,.7);solid(r.x+sign*8.3,z,.9,.9);
            put(i,'box','iron',r.x+sign*8.3,4.9,z,1.5,.22,1.4);
            put(i,'urn','rock',r.x+sign*9.9,.6,z,1.5,1.2,1.5);
            for(var k=0;k<9;k++)put(i,'link','iron',r.x+sign*8.5,4.1-k*.32,z,.45,.45,.45,k%2?PI/2:0);
          }
          for(var n=0;n<6;n++){var z=r.z+(n-2.5)*3;put(i,'box','iron',r.x+sign*5.9,.095,z,1.1,.13,.45,.16*sign);}
        });
        if(i%3===1){[-1,1].forEach(function(sign){put(i,'box','rock',r.x+sign*6.8,1.1,r.z-7,3.2,2.2,2.2);solid(r.x+sign*6.8,r.z-7,3.2,2.2);put(i,'box','iron',r.x+sign*6.8,2.27,r.z-7,3.4,.16,2.4);});}
      }else if(i<6){
        // Shattered arcade: varied intact columns, fractured capitals and stone ledges.
        [-1,1].forEach(function(s){
          put(i,'box','wall',r.x+s*r.w/2,1.5,r.z,.7,3,r.d);solid(r.x+s*r.w/2,r.z,.7,r.d);
          for(var n=0;n<4;n++){var x=r.x+s*(r.w/2-2.2),z=r.z+(n-1.5)*5.2,h=2.4+((i+n)%3)*1.05;
            put(i,'column','stone',x,h/2,z,1.2,h,1.2);put(i,'box','stone',x,h+.16,z,1.9,.32,1.9);put(i,'box','wall',x,.18,z,1.65,.36,1.65);solid(x,z,1.45,1.45);
            if(n%2===0){put(i,'box','stone',x-s*.6,.3,z+1.2,2.4,.6,1.5,.27*s);solid(x-s*.6,z+1.2,2.4,1.5);}
          }
        });
        // Tomb niches and weathered lids occupy the sides, keeping the central lane open.
        for(var n=0;n<4;n++){var s=n%2?-1:1,x=r.x+s*8,z=r.z+(n<2?-4:4);
          put(i,'box','wall',x,.6,z,2.0,1.2,3.2);put(i,'box','stone',x,1.28,z,2.25,.16,3.5,.045*s);solid(x,z,2.25,3.5);
          put(i,'urn','stone',x-s*1.5,.45,z+1.5,.7,.9,.7);
        }
        if(i===4){put(i,'box','stone',r.x,1.35,r.z-9.5,5,2.7,1.2);solid(r.x,r.z-9.5,5,1.2);}
        if(i===1||i===3){stoneArch(i,0,r.z-8,4,2.8);[-1,1].forEach(function(sign){put(i,'column','stone',sign*4,1.4,r.z-8,1,2.8,1);solid(sign*4,r.z-8,1,1);});}
        if(i===5){[-1,1].forEach(function(s){put(i,'column','stone',s*4,2.8,r.z-7,1.5,5.6,1.5);put(i,'box','wall',s*4,5.6,r.z-7,2,.5,2);});put(i,'box','wall',0,5.8,r.z-7,9,.65,1.8);}
      }else{
        // Large broken limestone masses, smaller buttresses, connected crystal seams.
        [-1,1].forEach(function(s){
          for(var n=0;n<7;n++){var x=r.x+s*(r.w/2+.2),z=r.z+(n-3)*3.1,h=4.2+rnd()*3.2;
            put(i,'crag','rock',x,h*.43,z,5+rnd()*2,h,5+rnd()*2,rnd()*PI,.1*rnd(),.12*s);solid(x-s*.5,z,3.4,4);
            put(i,'rock','rock',x-s*1.6,.7,z,2.0,1.4,2.5,rnd()*PI);
          }
          for(var n=0;n<5;n++){var x=r.x+s*(10+rnd()),z=r.z+(n-2)*4.2,h=1.1+rnd()*2.3;
            put(i,'tooth','rock',x,h/2,z,.65,h,.65,.2,0,s*.12);solid(x,z,.75,.75);
            if(n%2===i%2){put(i,'spike','crystal',x-s*.55,.65,z,.38,1.3,.38,.4,0,s*.25);put(i,'spike','crystal',x-s*.8,.38,z+.3,.3,.76,.3,.7,0,-s*.32);}
          }
        });
        if(i===9||i===10){for(var n=0;n<4;n++){var s=n%2?1:-1,x=r.x+s*7.7,z=r.z+(n<2?-5:5);put(i,'box','stone',x,.55,z,1.8,1.1,2.7);solid(x,z,1.8,2.7);put(i,'box','iron',x,1.15,z,.11,.1,1.2);}}
      }
      if(!forge&&i>=6){
        // Low rubble on the margins gives the cave floor depth without obstructing combat.
        [-1,1].forEach(function(sign){for(var q=0;q<7;q++){
          var rx=r.x+sign*(7.4+rnd()*1.5),rz=r.z+(q-3)*2.1,sz=.28+rnd()*.38;
          put(i,'rock','rock',rx,sz*.16,rz,sz,sz*.32,sz*.8,rnd()*PI,.1,.1);
        }});
      }
      [-1,1].forEach(function(s){lamp(i,r.x+s*6.7,r.z+7.8);});
      // Uneven stone edging is above the ground, with no coplanar texture overlap.
      for(var n=0;n<9;n++)put(i,'rock',i<6?'stone':'rock',r.x+(n%2?-1:1)*11,.14,r.z+(Math.floor(n/2)-2)*4.2,.7,.28,1.1,rnd()*PI);
      var artSeed=seed;dressRoom(r,i);seed=artSeed;
      if(i===11){
        put(i,'column','stone',0,.45,r.z,2,.9,2);put(i,'column','crystal',0,1.18,r.z,.75,.55,.75);put(i,'spike','crystal',0,1.8,r.z,.65,.8,.65);
        return;
      }
      if(i===13){
        // The court has no decorative obstacle inside the dodge/safe-pocket zone.
        if(forge){
          put(i,'box','stone',0,.25,r.z-9,8,.5,4);
          put(i,'column','iron',0,2.2,r.z-9,4.8,4.2,2);
          put(i,'column','crystal',0,2.2,r.z-7.95,2.8,2.8,.3,PI/2);
          [-1,1].forEach(function(s){put(i,'box','iron',s*3,2.7,r.z-9,.8,5.4,2);put(i,'box','iron',s*3,5.4,r.z-9,1.6,.3,2.6);});
        }else{ put(i,'box','wall',0,.25,r.z-8,8,.5,4);put(i,'box','stone',0,2.2,r.z-9,4.8,4,1.6);put(i,'box','stone',0,1.1,r.z-7.5,3.8,1.5,2); }
        solid(0,r.z-9,4.8,1.6);
        encounters.push({id:forge?'furnace-heart':'hollow-court',room:i,name:forge?'Ocağın Son Dökümü':'Tahtın İçindeki Boşluk',spawns:[{type:forge?'furnaceheart':'hollowking',x:0,z:r.z-1,boss:true}],stage:1.2});return;
      }
      var types=forge?(i<6?['emberbound','chainseer','forgesentinel','emberbound','slagcrawler']:['slagcrawler','forgesentinel','chainseer','slagcrawler','emberbound']):i<6?['ashbound','shardseer','gravemason','ashbound','cavefang']:['cavefang','gravemason','shardseer','cavefang','ashbound'];
      var spawns=types.map(function(type,n){return {type:type,x:r.x+(n===4?0:n%2?3.4:-3.4),z:r.z+(n===4?0:n<2?-4:4)};});
      if(i===4||i===9)spawns.push({type:forge?'ashwarden':'ruinwarden',x:r.x,z:r.z-7,elite:true});
      encounters.push({id:(forge?'forge-':'ruin-')+i,room:i,name:r.name,clearText:'Buradaki sesler sustu. Kuzeydeki yol açık.',stage:forge?1.08+i*.016:1.02+i*.018,spawns:spawns});
    });
    Object.keys(batches).forEach(function(k){var b=batches[k],mesh=new T.InstancedMesh(view(b.geo),b.mat,b.list.length);b.list.forEach(function(m,i){mesh.setMatrixAt(i,m);});mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=b.key!=='lamp'&&b.key!=='lava'&&b.key!=='earth'&&b.key!=='floor'&&b.list.some(function(m){return m.elements[13]>.22;});mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.name='ruins-'+k;groups[b.room].add(mesh);});
    // Broad phase bounds prevent collision cost from growing with the art detail.
    var grid=Object.create(null),cell=8;
    colliders.forEach(function(c){for(var x=Math.floor((c.x-c.w/2)/cell);x<=Math.floor((c.x+c.w/2)/cell);x++)for(var z=Math.floor((c.z-c.d/2)/cell);z<=Math.floor((c.z+c.d/2)/cell);z++){var k=x+','+z;(grid[k]||(grid[k]=[])).push(c);}});
    function isWalkable(x,z,r){
      if(!Number.isFinite(x)||!Number.isFinite(z))return false;r=r==null?.46:Math.max(.01,r);
      var floor=false;for(var i=0;i<floors.length;i++){var f=floors[i];if(Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2){floor=true;break;}}if(!floor)return false;
      for(var gx=Math.floor((x-r)/cell);gx<=Math.floor((x+r)/cell);gx++)for(var gz=Math.floor((z-r)/cell);gz<=Math.floor((z+r)/cell);gz++){var list=grid[gx+','+gz];if(!list)continue;for(var j=0;j<list.length;j++){var c=list[j],dx=x-Math.max(c.x-c.w/2,Math.min(x,c.x+c.w/2)),dz=z-Math.max(c.z-c.d/2,Math.min(z,c.z+c.d/2));if(dx*dx+dz*dz<r*r-1e-6)return false;}}
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
    for(var i=0;i<3;i++){var light=new T.PointLight(0xe4ab76,0,13,2);root.add(light);lights.push(light);}
    var mood={fog:new T.Color('#0c0e12'),fogDensity:.012,mist:new T.Color('#141722'),mistA:.12,mistH:.7,mistGlow:.5,scatter:.65,wind:[.025,-.015],
      sky:new T.Color('#9eacb8'),ground:new T.Color('#302e2b'),hemi:.85,env:.28,key:new T.Color('#b2bfd0'),keyI:1.65,keyDir:[-12,24,-8],rim:new T.Color('#7a9abc'),rimI:1.15,charRim:new T.Color('#c3d4df'),charRimI:1.3,rimDir:[.4,.6,-1],rimWrap:1,charFill:.23,
      lift:new T.Vector3(.003,.005,.008),gain:new T.Vector3(1,1.03,1.07),sat:.82,contrast:.2,shadowTint:new T.Vector3(.9,1,1.1),highTint:new T.Vector3(1.08,1.02,.9),vignette:.5,vigColor:new T.Vector3(.005,.005,.01),bloom:.38,bloomTint:new T.Vector3(.94,1,1.05),exposure:1.25,room:0,keyIntensity:1.65,rimIntensity:1.15,saturation:.82};
    function atmosphereAt(x,z){var r=roomAt(x,z);if(forge){mood.fog.setHex(0x120e0c);mood.mist.setHex(0x21150e);mood.sky.setHex(0xb9a68e);mood.key.setHex(0xe0c1a1);mood.rim.setHex(0xb86539);mood.charRim.setHex(0xe4cbb4);mood.gain.set(1.06,1.01,.93);}mood.room=Math.min(6,Math.floor(r.id/2));mood.keyIntensity=mood.keyI=r.id<6?1.65:1.35;mood.mistA=r.id<6?.10:.18;return mood;}
    var near=[],quality='high',groupGain={ruins:1},oath=false;
    function update(dt,time,p){p=p||{x:0,z:10};hero.value.set(p.x,1,p.z);clock.value=time||0;groups.forEach(function(g,i){g.visible=Math.abs(rooms[i].z-p.z)<55;});near.length=0;for(var i=0;i<sources.length;i++){var s=sources[i];s.distance=Math.hypot(s.x-p.x,s.z-p.z);if(s.distance<15)near.push(s);}near.sort(function(a,b){return a.distance-b.distance;});for(var i=0;i<lights.length;i++){var l=lights[i],s=near[i];l.visible=quality!=='low'&&!!s;if(s){l.position.set(s.x,s.y,s.z);l.color.copy(s.color);l.intensity=s.intensity;}}materials.crystal.emissiveIntensity=.55+(oath?.15:0);}
    root.updateMatrixWorld(true);
    return {chapter:chapter,name:forge?'Kızıl Ocak':'Sessiz Taht',root:root,rooms:rooms,paths:paths,encounters:encounters,colliders:colliders,occluders:[],materials:materials,spawn:{x:0,z:14},checkpoint:{x:0,z:rooms[11].z},bossSpawn:{x:0,z:rooms[13].z-1},
      isWalkable:isWalkable,move:move,hasClearPath:hasClearPath,pathTo:pathTo,roomAt:roomAt,update:update,atmosphereAt:atmosphereAt,effectHeightAt:function(){return .065;},
      setQuality:function(cfg){quality=typeof cfg==='string'?cfg:cfg.quality||cfg.preset||'high';},
      lighting:{sources:sources,flames:[],shafts:[],moods:[mood],groupGain:groupGain,prepareTextures:function(){return textures;},setGroup:function(k,v){groupGain[k]=v;},setGroupTint:function(){},setCorpses:function(){},setOathGlow:function(v,lit){oath=!!lit;},setPlayerLightFx:function(){},wantsShadows:function(){return false;}},
      dispose:function(){if(disposed)return;disposed=true;root.traverse(function(o){if(o.isInstancedMesh)o.dispose();});views.forEach(function(g){g.dispose();});geometries.forEach(function(g){g.dispose();});Object.keys(materials).forEach(function(k){materials[k].dispose();});textures.forEach(function(t){t.dispose();});lights.forEach(function(l){l.dispose();});root.removeFromParent();root.clear();}
    };
  }
  B.RuinsWorld={build:build};
}());
