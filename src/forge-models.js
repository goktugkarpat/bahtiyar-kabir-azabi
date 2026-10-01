/* KIZIL OCAK — licensed rigs, scanned forged iron/leather/linen, fitted furnace armour. */
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
  function make(type,cfg){cfg.chapter=4;B.Models.register(type,cfg,function(A,C){
    var exec=cfg.base==='executioner',head=exec?'head':'Head',spine=exec?'spine03':'spine_03',handL=exec?'handL':'hand_l',handR=exec?'handR':'hand_r';
    var skin=A.addFrom(C.bases[cfg.base],function(){return true;},'skin')[0];if(exec)A.remapBone('neutral_bone','pelvis');
    var p=A.P(head),chest=A.P(spine),hip=A.P('pelvis');
    if(type==='slagcrawler'){A.lengthen({lowerarm_l:1.4,lowerarm_r:1.4,hand_l:1.28,hand_r:1.28});var slim={};slim[spine]=.75;A.slim(skin,slim,1);}
    var fitted=torsoFit(A,exec,chest);
    var materials={
      skin:C.bodyMaterial(A.srcMaterial(exec?'Exec_mesh':'SuperHero_Male',C.bases[cfg.base]),'forge-'+type+'-skin',{cls:'skin',skin:1,skinMap:exec,tint:type==='slagcrawler'?[.70,.63,.49]:[1.06,.80,.65],sat:.48,grime:.36,blood:.2,scale:9,fresh:true},{roughness:.73}),
      iron:C.bodyMaterial(C.gearMaterial('iron'),'forge-'+type+'-iron',{cls:'metal',tint:[.83,.71,.64],rust:.25,grime:.33,wear:1.0,scale:8},{roughness:.65}),
      leather:C.bodyMaterial(C.gearMaterial('leather'),'forge-'+type+'-leather',{cls:'leather',tint:[.38,.25,.17],grime:.35,blood:.2,scale:8},{roughness:.92}),
      rag:C.bodyMaterial(C.gearMaterial('rag'),'forge-'+type+'-linen',{cls:'cloth',tear:true,tint:type==='chainseer'?[.34,.21,.17]:[.31,.25,.21],grime:.36,blood:.16,scale:8},{roughness:.95,side:T.DoubleSide}),
      bone:C.bodyMaterial(C.gearMaterial('bone'),'forge-'+type+'-bone',{cls:'bone',tint:[.90,.77,.58],grime:.3,blood:.16,scale:10},{roughness:.78}),
      glow:C.bodyMaterial(C.gearMaterial('iron'),'forge-'+type+'-hot-iron',{cls:'metal',tint:[.69,.44,.26],rust:.2,grime:.3,wear:.6,scale:10},{color:new T.Color(0x594132),emissive:new T.Color(0xdc6329),emissiveIntensity:.28,roughness:.64,metalness:.60})
    };
    var armour=type==='forgesentinel'||type==='ashwarden'||type==='furnaceheart';
    if(type!=='slagcrawler'){
      var shell=G.sheet(32,14,function(u,v){return fitted.at(u*Math.PI*2,fitted.box.max.y-.012-v*(fitted.box.max.y-fitted.box.min.y-.075),.028);},true,true);G.uvScale(shell,2.5,2);fitted.attach(armour?'iron':'leather',shell);
      var apron=G.sheet(20,15,function(u,v){return[hip.x+(u-.5)*(.42+v*.12),hip.y+.05-v*(type==='chainseer'?.62:.43)+Math.sin(u*17)*.04*v*v,hip.z+.21+Math.sin(u*12+v*5)*.01];},true);G.uvScale(apron,2.5,2);G.wear(apron,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.6,width:.045,bottom:.12,base:.03}});A.rigid('rag',apron,'pelvis');
    }
    if(type==='emberbound'){
      var bands=[];for(var bi=0;bi<3;bi++)bands.push(G.box(.35,.026,.025,fitted.at(0,chest.y+.13-bi*.115,.041)));fitted.attach('iron',G.merge(bands));
      var collar=G.tube([[chest.x-.19,chest.y+.21,chest.z],[chest.x-.10,chest.y+.27,chest.z-.10],[chest.x+.10,chest.y+.27,chest.z-.10],[chest.x+.19,chest.y+.21,chest.z]],.025,7,20,true);A.rigid('iron',collar,spine);
      var rivets=[];for(var i=0;i<7;i++)rivets.push(G.sphere(.017,[chest.x+(i%2?-.17:.17),chest.y+.16-i*.045,chest.z+.14],[1,.75,1],8,6));A.rigid('glow',G.merge(rivets),spine);
    }
    if(type==='chainseer'){
      A.rigid('iron',G.sphere(.115,arr(p.clone().add(new T.Vector3(0,.025,.07))),[.86,1.22,.5],16,10),head);
      var chains=[];for(var side=-1;side<=1;side+=2)for(var i=0;i<12;i++)chains.push(G.ring(.017,.005,[chest.x+side*.18,chest.y+.19-i*.035,chest.z+.16],[i%2?Math.PI/2:0,0,0],5,10));A.rigid('iron',G.merge(chains),spine);
      A.rigid('glow',G.box(.07,.008,.014,[p.x,p.y+.055,p.z+.134]),head);
    }
    if(type==='slagcrawler'){
      var scales=[];for(var i=0;i<6;i++)scales.push(G.sphere(.14,[chest.x,chest.y+.16-i*.073,chest.z-.14],[1.12,.55,.65],14,8));A.rigid('iron',G.merge(scales),spine);
      var seams=[];for(var j=0;j<5;j++)seams.push(G.tube([[chest.x-.13,chest.y+.1-j*.075,chest.z-.13],[chest.x,chest.y+.11-j*.075,chest.z-.245],[chest.x+.13,chest.y+.1-j*.075,chest.z-.13]],.008,6,12,true));A.rigid('glow',G.merge(seams),spine);
      [handL,handR].forEach(function(b){var h=A.P(b),claws=[];for(var j=0;j<4;j++){var q=h.clone().add(new T.Vector3((j-1.5)*.034,-.07,.03));claws.push(G.spike(.015,q,q.clone().add(new T.Vector3(0,-.13,.17))));}A.rigid('bone',G.merge(claws),b);});
    }
    if(armour){
      ['upper_armL','upper_armR'].forEach(function(b){var q=A.P(b),plates=[];for(var i=0;i<3;i++)plates.push(G.sphere(.14-i*.018,arr(q.clone().add(new T.Vector3(0,-i*.055,0))),[1.1,.5,1],14,8));A.rigid('iron',G.merge(plates),b);});
      A.rigid('iron',G.ring(.135,.030,arr(p.clone().add(new T.Vector3(0,.11,0))),[Math.PI/2,0,0],8,24),head);
    }
    if(type==='furnaceheart'){
      var core=new T.Vector3().fromArray(fitted.at(0,chest.y+.03,.045));A.rigid('glow',G.sphere(.085,arr(core),[1,1.35,.45],16,12),spine);
      var cage=[G.ring(.13,.025,arr(core.clone().add(new T.Vector3(0,0,.018))),[0,0,0],8,28)];for(var i=-1;i<=1;i++)cage.push(G.box(.018,.24,.032,[core.x+i*.065,core.y,core.z+.04]));A.rigid('iron',G.merge(cage),spine);
      var chimney=[G.cyl(.05,.08,.31,12,[chest.x-.15,chest.y+.29,chest.z-.14]),G.cyl(.06,.08,.24,12,[chest.x+.16,chest.y+.25,chest.z-.14])];A.rigid('iron',G.merge(chimney),spine);
    }
    var weapon;
    if(type==='chainseer'){weapon={parts:{iron:[G.cyl(.025,.035,1.08,10,[0,.40,0]),G.ring(.15,.026,[0,1.02,0],[0,0,0],8,24)],glow:[G.sphere(.04,[0,1.02,0],[1,1,1],10,8)]},tip:new T.Vector3(0,1.2,0)};}
    else if(type==='forgesentinel'||type==='furnaceheart'){weapon={parts:{wood:[G.cyl(.04,.055,1.2,12,[0,.38,0])],iron:[G.box(.52,.27,.25,[0,1.02,0]),G.box(.42,.08,.29,[0,.87,0])],glow:[G.box(.36,.012,.012,[0,1.10,.133])]},tip:new T.Vector3(0,1.17,0)};}
    else if(type!=='slagcrawler'){weapon={parts:{iron:[G.extrude([[-.05,0],[.06,0],[.08,.70],[.28,.79],[.20,.98],[-.06,.94]],.055,.008),G.box(.33,.05,.075,[0,.05,0])],leather:[G.cyl(.03,.035,.25,10,[0,-.13,0])]},tip:new T.Vector3(.20,.98,0)};}
    if(weapon)weapon.materials={iron:materials.iron,leather:materials.leather,glow:materials.glow};
    return {materials:materials,weapon:weapon};
  });}
  make('emberbound',{base:'ubc',height:2.35,radius:.47,motionType:'guard'});
  make('chainseer',{base:'ubc',height:2.55,radius:.45,motionType:'cultist'});
  make('slagcrawler',{base:'ubc',height:1.8,radius:.56,motionType:'stalker'});
  make('forgesentinel',{base:'executioner',height:2.90,radius:.72,motionType:'carrier'});
  make('ashwarden',{base:'executioner',height:3.15,radius:.82,motionType:'guard'});
  make('furnaceheart',{base:'executioner',height:4.2,radius:1.10,motionType:'boss'});
  B.ForgeModels={types:['emberbound','chainseer','slagcrawler','forgesentinel','ashwarden','furnaceheart']};
}());
