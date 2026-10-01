/* KÜL HARABELERİ — licensed articulated bodies; fitted scanned leather/linen/forged iron. */
(function () {
  'use strict';
  var B=window.BABA,T=window.THREE,G=B.Gear;
  function arr(p){return [p.x,p.y,p.z];}
  // Fit to the actual imported torso, not to the spine bone (whose Z origin sits inside the back).
  function torsoFit(A,exec,chest){
    var bones=exec?['spine01','spine02','spine03']:['spine_01','spine_02','spine_03'];
    var points=A.cloud?A.cloud(bones,['skin'],.25):[],box=points.length?A.box(points):new T.Box3(new T.Vector3(chest.x-.24,chest.y-.28,chest.z-.18),new T.Vector3(chest.x+.24,chest.y+.22,chest.z+.18));
    var cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
    function at(a,y,pad){var best=0,fallback=0,score=Infinity;for(var i=0;i<points.length;i++){var p=points[i],dx=p.x-cx,dz=p.z-cz,r=Math.hypot(dx,dz),delta=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(p.y-y);if(dy<.065&&delta<.24)best=Math.max(best,r);var s=dy*3+delta*.15;if(s<score){score=s;fallback=r;}}var r=(best||fallback||.2)+(pad||.024);return[cx+Math.sin(a)*r,y,cz+Math.cos(a)*r];}
    function attach(key,g){if(A.transfer)A.transfer(key,g,['skin'],{bones:bones});else A.rigid(key,g,exec?'spine03':'spine_03');}
    return{box:box,cx:cx,cz:cz,at:at,attach:attach};
  }
  function make(type,cfg){cfg.chapter=3;B.Models.register(type,cfg,function(A,C){
    var exec=cfg.base==='executioner',head=exec?'head':'Head',spine=exec?'spine03':'spine_03',handL=exec?'handL':'hand_l',handR=exec?'handR':'hand_r';
    var skin=A.addFrom(C.bases[cfg.base],function(){return true;},'skin')[0];if(exec)A.remapBone('neutral_bone','pelvis');
    if(type==='cavefang'){A.lengthen({lowerarm_l:1.35,lowerarm_r:1.35,hand_l:1.25,hand_r:1.25});var slim={};slim[spine]=.78;A.slim(skin,slim,1);}
    var p=A.P(head),chest=A.P(spine),hip=A.P('pelvis'),stone=type==='gravemason'||type==='ruinwarden'||type==='hollowking';
    var fitted=torsoFit(A,exec,chest);
    var tint=type==='ashbound'?[1.18,.76,.51]:type==='shardseer'?[.86,.83,.96]:type==='cavefang'?[1.23,1.12,.81]:[1.12,.95,.78];
    var materials={skin:C.bodyMaterial(A.srcMaterial(exec?'Exec_mesh':'SuperHero_Male',C.bases[cfg.base]),'ruins-'+type+'-skin',{cls:'skin',skin:1,skinMap:exec,sat:.55,tint:tint,grime:.26,blood:.2,scale:8,fresh:true},{roughness:.67}),
      iron:C.bodyMaterial(C.gearMaterial('iron'),'ruins-'+type+'-iron',{cls:'metal',tint:[1.25,1.08,.85],rust:.26,grime:.28,wear:1.1,scale:8},{roughness:.62}),
      leather:C.bodyMaterial(C.gearMaterial('leather'),'ruins-'+type+'-leather',{cls:'leather',tint:stone?[.86,.60,.39]:type==='shardseer'?[.30,.25,.32]:[.68,.33,.16],grime:.25,blood:.12,scale:7},{roughness:.86}),
      rag:C.bodyMaterial(C.gearMaterial('rag'),'ruins-'+type+'-linen',{cls:'cloth',tear:true,tint:type==='shardseer'?[.28,.23,.31]:type==='hollowking'?[.51,.15,.18]:[.52,.36,.24],grime:.25,blood:.2,scale:7},{roughness:.91,side:T.DoubleSide}),
      bone:C.bodyMaterial(C.gearMaterial('bone'),'ruins-'+type+'-bone',{cls:'bone',tint:[1.2,1.1,.83],grime:.22,blood:.15,scale:9},{roughness:.72}),
      glow:new T.MeshStandardMaterial({color:0x48414f,emissive:0x816a9b,emissiveIntensity:.24,roughness:.48,metalness:.15})};
    // Tangible overlapping cuirass plates and weathered skirt follow their skeleton, never float.
    if(type!=='cavefang'){
      var plates=[];for(var i=0;i<(stone?5:3);i++){var y=chest.y+.16-i*.11,front=fitted.at(0,y,.034);plates.push(G.box(.40+i*.008,.10,.045,front));}fitted.attach(stone?'iron':'leather',G.merge(plates));
      var cloth=G.sheet(28,12,function(u,v){var a=u*Math.PI*2,r=.21+v*.055;return[hip.x+Math.sin(a)*r,hip.y+.06-v*(type==='shardseer'?.65:.38)+Math.sin(a*9)*.035*v,hip.z+Math.cos(a)*r];},true);G.uvScale(cloth,3,2);A.rigid('rag',cloth,'pelvis');
    }
    if(stone){var horns=[];for(var i=0;i<7;i++){var a=i/7*Math.PI*2,base=p.clone().add(new T.Vector3(Math.sin(a)*.11,.10,Math.cos(a)*.11));horns.push(G.spike(.035,base,base.clone().add(new T.Vector3(Math.sin(a)*.06,.16+(i%2)*.08,Math.cos(a)*.06))));}A.rigid(type==='hollowking'?'bone':'iron',G.merge(horns),head);}
    if(type==='ashbound'){
      // The surviving ash oath is visibly armoured from the back as well as the front.
      var cuirass=G.sheet(32,14,function(u,v){return fitted.at(u*Math.PI*2,fitted.box.max.y-.012-v*(fitted.box.max.y-fitted.box.min.y-.075),.026);},true,true);G.uvScale(cuirass,2.5,2);fitted.attach('leather',cuirass);
      var collar=G.tube([[chest.x-.20,chest.y+.20,chest.z],[chest.x-.10,chest.y+.27,chest.z-.085],[chest.x+.10,chest.y+.27,chest.z-.085],[chest.x+.20,chest.y+.20,chest.z]],.026,8,20,true);A.rigid('iron',collar,spine);
      var belt=G.sheet(28,3,function(u,v){var a=u*Math.PI*2;return[hip.x+Math.sin(a)*.23,hip.y+.05-v*.09,hip.z+Math.cos(a)*.19];},true,true);G.uvScale(belt,3,1);A.rigid('leather',belt,'pelvis');
      ['upperarm_l','upperarm_r'].forEach(function(b){var q=A.P(b);A.rigid('iron',G.sphere(.12,arr(q.clone().add(new T.Vector3(0,.015,0))),[1.05,.45,.95],14,8),b);});
      // A small asymmetric broken iron seal anchors the visible rear leather panel.
      A.rigid('iron',G.ring(.055,.010,[chest.x-.045,chest.y+.055,chest.z-.158],[0,0,.3],6,20),spine);
    }
    if(type==='shardseer'){
      var cloak=G.sheet(20,16,function(u,v){var across=(u-.5)*(.43+v*.12);return[chest.x+across,chest.y+.22-v*.73+Math.sin(u*19)*.035*v*v,fitted.box.min.z-.025-.035*v+Math.sin(u*17+v*6)*.012];},true);G.uvScale(cloak,2,2.5);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.64,width:.045,bottom:.12,base:.025}});A.rigid('rag',cloak,spine);
      var binding=[];[-1,1].forEach(function(sign){binding.push(G.tube([[chest.x+sign*.18,chest.y+.18,chest.z-.10],[chest.x+sign*.14,chest.y+.24,chest.z],[chest.x+sign*.17,chest.y+.12,chest.z+.12]],.015,7,16,true));});A.rigid('iron',G.merge(binding),spine);
    }
    if(type==='shardseer'){var shard=[];for(var i=0;i<5;i++){var q=chest.clone().add(new T.Vector3((i-2)*.075,.16,-.12));shard.push(G.spike(.06,q,q.clone().add(new T.Vector3((i-2)*.055,.23+i%2*.1,-.09))));}A.rigid('glow',G.merge(shard),spine);A.rigid('iron',G.tube([[chest.x-.17,chest.y+.12,chest.z-.14],[chest.x,chest.y+.08,chest.z-.18],[chest.x+.17,chest.y+.12,chest.z-.14]],.020,7,18,true),spine);}
    if(type==='cavefang'){var claws=[];[handL,handR].forEach(function(b){var parts=[],h=A.P(b);for(var i=0;i<4;i++){var q=h.clone().add(new T.Vector3((i-1.5)*.035,-.08,.02));parts.push(G.tube([arr(q),arr(q.clone().add(new T.Vector3(0,-.13,.07))),arr(q.clone().add(new T.Vector3(0,-.15,.19)))],.016,6,12,true));}A.rigid('bone',G.merge(parts),b);});var ribs=[];for(var j=0;j<5;j++)ribs.push(G.tube([[chest.x-.15,chest.y+.1-j*.08,chest.z-.07],[chest.x,chest.y+.13-j*.08,chest.z-.24],[chest.x+.15,chest.y+.1-j*.08,chest.z-.07]],.018,7,16,true));A.rigid('bone',G.merge(ribs),spine);}
    var weapon;
    if(type==='shardseer'){weapon={parts:{wood:[G.cyl(.025,.035,1.25,10,[0,.45,0])],glow:[G.spike(.08,new T.Vector3(0,1.04,0),new T.Vector3(0,1.44,0))],iron:[G.ring(.055,.012,[0,1.04,0],[Math.PI/2,0,0],6,20)]},tip:new T.Vector3(0,1.44,0)};}
    else if(type==='gravemason'){weapon={parts:{wood:[G.cyl(.035,.05,1.18,10,[0,.40,0])],iron:[G.box(.44,.24,.22,[0,.99,0]),G.ring(.056,.012,[0,.75,0],[Math.PI/2,0,0],6,20)]},tip:new T.Vector3(0,1.11,0)};}
    else if(type!=='cavefang'){weapon={parts:{iron:[G.extrude([[-.06,0],[.06,0],[.11,.82],[0,1.05],[-.11,.82]],.045,.007),G.box(.38,.055,.07,[0,.06,0])],leather:[G.cyl(.03,.035,.25,10,[0,-.125,0])]},tip:new T.Vector3(0,1.05,0)};}
    if(weapon) weapon.materials = { glow: materials.glow, iron: materials.iron, leather: materials.leather };
    return {materials:materials,weapon:weapon};
  });}
  make('ashbound',{base:'ubc',height:2.3,radius:.46,motionType:'guard'});
  make('shardseer',{base:'ubc',height:2.45,radius:.44,motionType:'cultist'});
  make('cavefang',{base:'ubc',height:1.82,radius:.54,motionType:'stalker'});
  make('gravemason',{base:'executioner',height:2.75,radius:.69,motionType:'carrier'});
  make('ruinwarden',{base:'executioner',height:3.05,radius:.78,motionType:'guard'});
  make('hollowking',{base:'executioner',height:4.0,radius:1.05,motionType:'boss'});
  B.RuinsModels={types:['ashbound','shardseer','cavefang','gravemason','ruinwarden','hollowking']};
}());
