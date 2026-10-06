/* KABİR AZABI — furnished side routes. Shared scanned surfaces, static batches,
   and the world's existing navigation: no new renderer or combat-time geometry. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE;
  function build(root, materials, baseRooms, encounters, colliders, chapter, lightSources) {
    var coast = chapter === 2;
    var rooms = coast ? [
      {id:7,name:KabirI18n.t('Batık Gümrük Avlusu'),x:-30,z:-59,w:24,d:22,parent:2,portal:-10,entryZ:-63},
      {id:8,name:KabirI18n.t('Kara Ağacın Mezarlığı'),x:-32,z:-112,w:24,d:24,parent:4,portal:-11},
      {id:9,name:KabirI18n.t('Kül Balıkçılarının Evleri'),x:-30,z:4,w:28,d:22,parent:0,portal:-10},
      {id:10,name:KabirI18n.t('Köksüzlerin Çukuru'),x:-33,z:-23,w:28,d:22,parent:1,portal:-10,entryZ:-27},
      {id:11,name:KabirI18n.t('Çürümüş Tersane'),x:-32,z:-81,w:28,d:20,parent:3,portal:-10},
      {id:12,name:KabirI18n.t('Fenersiz Sığınak'),x:-32,z:-140,w:28,d:24,parent:5,portal:-9}
    ] : [
      {id:7,name:KabirI18n.t('Unutulanların Mahzeni'),x:-28,z:-21,w:22,d:22,parent:1,portal:-11},
      {id:8,name:KabirI18n.t('Sönmüş Kandiller'),x:32,z:-74,w:26,d:24,parent:3,portal:11},
      {id:9,name:KabirI18n.t('İsimsizlerin Mezarı'),x:30,z:4,w:28,d:22,parent:0,portal:7},
      {id:10,name:KabirI18n.t('Yitik Etler Reviri'),x:-31,z:-47,w:28,d:24,parent:2,portal:-9},
      {id:11,name:KabirI18n.t('Kefen Dokuma Odası'),x:32,z:-101,w:28,d:24,parent:4,portal:8},
      {id:12,name:KabirI18n.t('Kırık Yeminler'),x:-30,z:-125,w:28,d:20,parent:5,portal:-7}
    ];
    var floors = [], groups = [], batches = {}, geometry = {
      box:new T.BoxGeometry(1,1,1), column:new T.CylinderGeometry(.5,.58,1,12),
      urn:new T.SphereGeometry(.5,12,8), root:new T.CylinderGeometry(.5,.7,1,8)
    }, dummy = new T.Object3D();
    var paths = baseRooms.slice(0,7).slice(1).map(function(r,i){return {a:baseRooms[i],b:r,width:6.6};});
    // Separate VAO identity per instance matrix, shared immutable vertex buffers.
    var views=[];
    function view(g){var v=new T.BufferGeometry();v.setIndex(g.index);Object.keys(g.attributes).forEach(function(k){v.setAttribute(k,g.attributes[k]);});views.push(v);return v;}
    var stoneShape=new T.Shape();stoneShape.moveTo(-.5,-.45);stoneShape.lineTo(-.43,-.5);stoneShape.lineTo(.44,-.49);stoneShape.lineTo(.5,-.40);stoneShape.lineTo(.49,.42);stoneShape.lineTo(.4,.5);stoneShape.lineTo(-.44,.48);stoneShape.lineTo(-.5,.36);stoneShape.closePath();
    var cutStone=new T.ExtrudeGeometry(stoneShape,{depth:.92,bevelEnabled:true,bevelSize:.022,bevelThickness:.04,bevelSegments:1,steps:1});cutStone.translate(0,0,-.46);
    geometry.block=cutStone;
    function put(id,kind,mat,x,y,z,w,h,d,angle) {
      if(kind==='box'&&h>.2&&['stone','dark','pale','wall'].indexOf(mat)>=0)kind='block';
      var material=materials[mat] || materials.stone || materials.wall;
      var key=id+':'+kind+':'+mat;
      if(!batches[key])batches[key]={id:id,g:geometry[kind],m:material,matrices:[]};
      dummy.position.set(x,y,z);dummy.rotation.set(0,angle||0,0);dummy.scale.set(w,h,d);dummy.updateMatrix();batches[key].matrices.push(dummy.matrix.clone());
    }
    function solid(x,z,w,d){colliders.push({x:x,z:z,w:w,d:d});}
    rooms.forEach(function(r,i){
      var group=new T.Group();group.name=r.name;root.add(group);groups.push(group);
      var side=r.x<0?1:-1,edge=r.x+side*r.w/2;
      floors.push({x:r.x,z:r.z,w:r.w,d:r.d});
      var entryZ=r.entryZ==null?r.z:r.entryZ;
      var corridor={x:(edge+r.portal)/2,z:entryZ,w:Math.abs(edge-r.portal)+1,d:6};floors.push(corridor);
      paths.push({a:{x:r.portal,z:entryZ},b:{x:edge-side*2,z:entryZ},width:6});
      var floorMat=coast?(i?'earth':'floor'):'floor';
      // ajan:world-a — the temple's side crypts are drawn (walls, colliders, props, lights) by worlda-temple.js inside world.js.
      if(!coast&&B.WorldATemple&&B.WorldATemple.active){pushEncounter(r,i);return;}
      put(i,'box',floorMat,r.x,-.15,r.z,r.w,.3,r.d);
      var main=baseRooms[r.parent],mainEdge=main.x-side*main.w/2;
      put(i,'box',floorMat,(edge+mainEdge)/2,-.15,entryZ,Math.abs(edge-mainEdge),.3,6);
      // Peripheral architecture leaves wide, readable fighting lanes and a clear doorway.
      if(!coast){
        [-1,1].forEach(function(s){put(i,'box','stone',r.x,1.8,r.z+s*r.d/2,r.w+.6,3.6,.7);solid(r.x,r.z+s*r.d/2,r.w+.6,.7);});
        var back=r.x-side*r.w/2;put(i,'box','stone',back,1.8,r.z,.7,3.6,r.d);solid(back,r.z,.7,r.d);
        [-1,1].forEach(function(s){var length=(r.d-6)/2,z=r.z+s*(3+length/2);put(i,'box','stone',edge,1.8,z,.7,3.6,length);solid(edge,z,.7,length);});
        [-1,1].forEach(function(s){put(i,'box','dark',corridor.x,1.2,r.z+s*3.35,corridor.w,2.4,.65);solid(corridor.x,r.z+s*3.35,corridor.w,.65);});
        // Alternating pilasters, capitals and recessed burial slabs use the original PBR stone.
        [-1,1].forEach(function(s){[-.33,0,.33].forEach(function(f){var x=r.x-s*(r.w/2-1.1),z=r.z+f*r.d;
          if(s===-side&&f===0)return;
          put(i,'column','dark',x,1.7,z,.9,3.4,.9);put(i,'box','pale',x,3.45,z,1.4,.23,1.4);
          put(i,'box','pale',x,.12,z,1.45,.24,1.45);solid(x,z,1.2,1.2);
        });});
        for(var n=0;n<6;n++){var x=r.x-side*(r.w/2-2.7)+(n%2?side*2.4:0),z=r.z+(Math.floor(n/2)-1)*5.5;
          put(i,'box','dark',x,.48,z,1.7,.96,2.8);put(i,'box','pale',x,1.01,z,1.9,.14,3);solid(x,z,1.9,3);
          put(i,'box','iron',x,1.13,z,.12,.1,1.4);put(i,'box','iron',x,1.13,z,.8,.1,.12);
          put(i,'urn','stone',x+(n%2?-.95:.95),.55,z-1.7,.7,1.1,.7);
        }
        if(i){put(i,'box','dark',r.x,1,r.z-r.d/2+2,5,2,1.3);solid(r.x,r.z-r.d/2+2,5,1.3);}
        // Furnish the chamber edges; the entry fan and central fighting lane stay open.
        [-1,1].forEach(function(sign){
          var bx=r.x-side*2,bz=r.z+sign*(r.d/2-2.3);
          put(i,'box','wood',bx,.53,bz,4,.20,.9);
          [-1,1].forEach(function(leg){put(i,'box','dark',bx+leg*1.45,.22,bz,.28,.44,.6);});
          solid(bx,bz,4,.9);
          for(var j=0;j<3;j++)put(i,'urn',j%2?'dark':'stone',bx-1.2+j*1.2,.9,bz,.42,.64,.42);
          put(i,'box','iron',bx,.12,bz-sign*1.1,3.7,.08,.12);
        });
      } else if(i===0||i===2||i===3||i===4){
        // Broken customs arcade, collapsed roof beams and stacked confiscated cargo.
        [-1,1].forEach(function(s){put(i,'box','wall',r.x,1.2,r.z+s*r.d/2,r.w,2.4,.65);solid(r.x,r.z+s*r.d/2,r.w,.65);});
        put(i,'box','wall',r.x-r.w/2,1.5,r.z,.8,3,r.d);solid(r.x-r.w/2,r.z,.8,r.d);
        for(var n=0;n<6;n++){var x=r.x+(n%2?1:-1)*7,z=r.z+(Math.floor(n/2)-1)*6;
          put(i,'column','wall',x,1.9,z,.8,3.8,.8);put(i,'box','stone',x,3.9,z,1.3,.3,1.2);solid(x,z,.9,.9);
          put(i,'box','wood',x,4.15,z,1.1,.24,4.4,.15*(n%2?1:-1));
          put(i,'box','wood',x,.65,z+1.7,1.4,1.3,1.5,.12);solid(x,z+1.7,1.4,1.5);
          put(i,'box','iron',x,.67,z+1.7,1.46,.10,1.56);
        }
      } else {
        // A root-bound burial yard: connected trunks and roots, not loose hanging rods.
        [-1,1].forEach(function(s){for(var n=0;n<4;n++){var x=r.x+s*7.8,z=r.z+(n-1.5)*5;
          put(i,'root','char',x,2.8,z,.9,5.6,.9);solid(x,z,1.1,1.1);
          for(var k=0;k<3;k++){var a=k*2.094+n*.4;put(i,'box','char',x+Math.sin(a)*1.0,.14,z+Math.cos(a)*1.0,.27,.28,2.4,a);}
          put(i,'box','grave',x-s*1.7,.15,z,1.3,.3,2.3,.15*s);
          put(i,'box','stone',x-s*1.7,.7,z-.85,1.05,1.4,.3,.15*s);
          solid(x-s*1.7,z-.85,1.05,.3);
        }});
      }
      // Stone edging and threshold seams stay level; no overlapping coplanar floors.
      for(var n=0;n<8;n++){var z=r.z+(n-3.5)*(r.d-1)/8;put(i,'box',coast?'rock':'pale',r.x-side*(r.w/2-.3),.18,z,.55,.36,1.7,.04*(n%3-1));}
      // Existing pooled lamps illuminate side routes; no light count increase.
      [-1,1].forEach(function(sign){var x=r.x+sign*4.6,z=r.z+6.7,color=new T.Color(coast?0xb9c9b3:0xe3ae78);
        put(i,'column',coast?'rust':'iron',x,.85,z,.2,1.7,.2);
        put(i,'box',coast?'rust':'iron',x,1.75,z,.5,.1,.5);
        put(i,'urn',coast?'lamp':'ember',x,1.96,z,.18,.32,.18);
        if(lightSources)lightSources.push({x:x,y:2,z:z,color:color,intensity:2.1,distance:10,flicker:.4,phase:i*1.7+sign,score:0,kind:'candle',scatter:.35,glowRadius:.55,shadowNear:null,group:null,tintGroup:null,dim:color.clone(),live:1,liveColor:color.clone(),livePos:{x:x,y:2,z:z},spotW:0});
      });
      pushEncounter(r,i);
    });
    function pushEncounter(r,i){
      var types=coast?(i%2?['rootborn','crawler','urchin','lantern']:['drowned','urchin','crawler','lantern']):(i%2?['cultist','guard','stalker','carrier']:['prisoner','guard','carrier','stalker']);
      encounters.push({id:(coast?'coast-side-':'temple-side-')+r.id,room:r.id,name:r.name,stage:coast?1.1+r.parent*.025:.56+r.parent*.085,clearText:KabirI18n.t('Bu alan sustu. Ana yola geri dön.'),spawns:types.concat(types[(i+1)%4]).map(function(type,n){return {type:type,x:r.x+(n===4?0:n%2?-3:3),z:r.z+(n===4?0:n<2?-4:4),elite:n===4&&(i===1||i===4),name:n===4&&(i===1||i===4)?(coast?(i===1?KabirI18n.t('Köklerin Adsız Bekçisi'):KabirI18n.t('Tuz İçindeki Yeminli')):(i===1?KabirI18n.t('Sönmüş Kandilin Bekçisi'):'Kefen Dokuyucu')):undefined};})});
    }
    Object.keys(batches).forEach(function(key){var b=batches[key],m=new T.InstancedMesh(view(b.g),b.m,b.matrices.length);b.matrices.forEach(function(matrix,i){m.setMatrixAt(i,matrix);});m.instanceMatrix.needsUpdate=true;m.castShadow=b.m!==materials.floor&&b.m!==materials.earth;m.receiveShadow=true;m.computeBoundingSphere();m.matrixAutoUpdate=false;groups[b.id].add(m);});
    return {rooms:rooms,floors:floors,paths:paths,
      update:function(p){if(!p)return;groups.forEach(function(g,i){var r=rooms[i];g.visible=Math.abs(p.z-r.z)<48&&Math.abs(p.x-r.x)<65;});},
      dispose:function(){groups.forEach(function(g){g.traverse(function(o){if(o.isInstancedMesh)o.dispose();});g.removeFromParent();});views.forEach(function(g){g.dispose();});Object.keys(geometry).forEach(function(k){geometry[k].dispose();});}
    };
  }
  B.ChapterExpansion={build:build};
}());
