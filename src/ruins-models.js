/* KÜL HARABELERİ — licensed articulated bodies; fitted scanned leather/linen/forged iron, banded plate, ash capes, grave crystal. */
(function () {
  'use strict';
  var B=window.BABA,T=window.THREE,G=B.Gear,TAU=Math.PI*2;
  function arr(p){return [p.x,p.y,p.z];}
  function V(x,y,z){return new T.Vector3(x,y,z);}
  // A broken detail must never take the whole roster down: each block is built on its own.
  function safe(label,fn){try{fn();}catch(e){if(window.console)console.warn('ruins-models: '+label,e);}}
  // Fit to the actual imported torso, not to the spine bone (whose Z origin sits inside the back).
  function torsoFit(A,exec,chest){
    var bones=exec?['spine01','spine02','spine03']:['spine_01','spine_02','spine_03'];
    var points=A.cloud?A.cloud(bones,['skin'],.25):[],box=points.length?A.box(points):new T.Box3(new T.Vector3(chest.x-.24,chest.y-.28,chest.z-.18),new T.Vector3(chest.x+.24,chest.y+.22,chest.z+.18));
    var cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
    function at(a,y,pad){var best=0,fallback=0,score=Infinity;for(var i=0;i<points.length;i++){var p=points[i],dx=p.x-cx,dz=p.z-cz,r=Math.hypot(dx,dz),delta=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(p.y-y);if(dy<.065&&delta<.24)best=Math.max(best,r);var s=dy*3+delta*.15;if(s<score){score=s;fallback=r;}}var r=(best||fallback||.2)+(pad||.024);return[cx+Math.sin(a)*r,y,cz+Math.cos(a)*r];}
    function attach(key,g){if(A.transfer)A.transfer(key,g,['skin'],{bones:bones});else A.rigid(key,g,exec?'spine03':'spine_03');}
    return{box:box,cx:cx,cz:cz,at:at,attach:attach};
  }
  // Soft dirty-metal wear on a hand-built plate: broad scuffs, not a bare-steel patch on every edge.
  function plateWear(g,edge){return G.wear(g,{edge:edge==null?.42:edge,border:.35,curv:.006,cavity:.02});}
  var GLOW=[];   // emissive materials the telegraph layer breathes (see telegraphs.js glowPulse)
  function make(type,cfg){cfg.chapter=3;B.Models.register(type,cfg,function(A,C){
    var exec=cfg.base==='executioner',head=exec?'head':'Head',spine=exec?'spine03':'spine_03',handL=exec?'handL':'hand_l',handR=exec?'handR':'hand_r',armL=exec?'upper_armL':'upperarm_l',armR=exec?'upper_armR':'upperarm_r';
    var skin=A.addFrom(C.bases[cfg.base],function(){return true;},'skin')[0];if(exec)A.remapBone('neutral_bone','pelvis');
    if(type==='cavefang'){A.lengthen({lowerarm_l:1.35,lowerarm_r:1.35,hand_l:1.25,hand_r:1.25});var slim={};slim[spine]=.78;A.slim(skin,slim,1);}
    var p=A.P(head),chest=A.P(spine),hip=A.P('pelvis'),stone=type==='gravemason'||type==='ruinwarden'||type==='hollowking';
    var fitted=torsoFit(A,exec,chest),fb=fitted.box,bw=Math.max(.34,fb.max.x-fb.min.x);
    // Ash-grey, dirty palettes: no clean cloth, no bare-steel patches. The linen scan is indigo, so it is desaturated first.
    var tint=type==='ashbound'?[1.02,.76,.60]:type==='shardseer'?[.82,.80,.94]:type==='cavefang'?[.84,.78,.70]:[1.12,.95,.78];
    var clothTint=type==='shardseer'?[.13,.10,.22]:type==='hollowking'?[.42,.06,.08]:type==='ruinwarden'?[.30,.07,.07]:type==='gravemason'?[.19,.15,.12]:type==='cavefang'?[.2,.18,.15]:[.22,.15,.10];
    var materials={skin:C.bodyMaterial(A.srcMaterial(exec?'Exec_mesh':'SuperHero_Male',C.bases[cfg.base]),'ruins-'+type+'-skin',{cls:'skin',skin:1,skinMap:exec,sat:.5,tint:tint,grime:.42,blood:type==='cavefang'?.45:.2,scale:8,fresh:true},{roughness:.7}),
      iron:C.bodyMaterial(C.gearMaterial('iron'),'ruins-'+type+'-iron',{cls:'metal',tint:[1.02,.9,.78],rust:.34,grime:.4,wear:.5,scale:8},{roughness:.66}),
      leather:C.bodyMaterial(C.gearMaterial('leather'),'ruins-'+type+'-leather',{cls:'leather',tint:stone?[.74,.52,.36]:type==='shardseer'?[.30,.25,.34]:[.62,.31,.16],grime:.32,blood:.12,scale:7},{roughness:.86}),
      rag:C.bodyMaterial(C.gearMaterial('rag'),'ruins-'+type+'-linen',{cls:'cloth',tear:true,sat:.3,tint:clothTint,grime:.32,blood:.2,scale:7},{roughness:.92,side:T.DoubleSide}),
      bone:C.bodyMaterial(C.gearMaterial('bone'),'ruins-'+type+'-bone',{cls:'bone',tint:type==='hollowking'?[.74,.66,.54]:[1.1,1.0,.78],grime:type==='hollowking'?.5:.34,blood:.15,scale:9},{roughness:.76}),
      glow:new T.MeshStandardMaterial({color:0x302a48,emissive:0x7552b4,emissiveIntensity:type==='hollowking'?1.1:.78,roughness:.48,metalness:.15}),
      ash:C.bodyMaterial(C.gearMaterial('ash'),'ruins-'+type+'-ash',{cls:'bone',tint:[.5,.48,.46],grime:.75,scale:6},{roughness:.92})};
    GLOW.push({mat:materials.glow,base:materials.glow.emissiveIntensity,type:type});
    // Banded plate that hugs the real torso, no floating bricks: n lames, each a rolled-rim shell flaring at its lower edge.
    function lames(key,count,top,gap,height,pad,flare){
      var list=[];
      for(var i=0;i<count;i++)(function(i){var yTop=top-i*gap;list.push(plateWear(G.shell(24,2,function(u,v){var a=u*TAU,front=Math.max(0,Math.cos(a)),crest=Math.pow(front,8)*.014*Math.sin(v*Math.PI);return fitted.at(a,yTop-v*height-.014*front*front*Math.sin(v*Math.PI),pad+i*.004+v*flare+crest);},.011,true,true),.38));})(i);
      fitted.attach(key,G.merge(list));
    }
    var torsoTop=fb.max.y-.07,torsoH=fb.max.y-fb.min.y;
    // Weathered skirt follows the pelvis, never floats.
    if(type!=='cavefang'){
      safe('skirt',function(){
        var cloth=G.sheet(28,12,function(u,v){var a=u*TAU,r=.21+v*.055;return[hip.x+Math.sin(a)*r,hip.y+.06-v*(type==='shardseer'?.65:.38)+Math.sin(a*9)*.035*v,hip.z+Math.cos(a)*r];},true);G.uvScale(cloth,3,2);A.rigid('rag',cloth,'pelvis');
      });
    }
    if(stone){
      safe('lames',function(){
        var n=type==='hollowking'?6:type==='ruinwarden'?5:4;
        lames(type==='hollowking'?'bone':'iron',n,torsoTop,(torsoH-.14)/n,.105,.034,.016);
      });
      // Spiked, stacked shoulder plates (big on the left, bare strapped one on the right).
      safe('pauldrons',function(){
        [[armL,1.0],[armR,type==='gravemason'?.7:.78]].forEach(function(e){
          var q=A.P(e[0]),k=e[1],plates=[];
          for(var i=0;i<(type==='gravemason'?2:3);i++)plates.push(plateWear(G.sphere((.15-i*.02)*k,arr(q.clone().add(V(0,.03-i*.05,0))),[1.12,.52,1.04],12,6),.4));
          if(type!=='gravemason'&&k>.9)for(var s=0;s<3;s++)plates.push(G.spike(.022,q.clone().add(V(-.1+s*.1,.07,0)),q.clone().add(V(-.12+s*.12,.2+s%2*.05,-.03))));
          A.rigid(type==='hollowking'?'bone':'iron',G.merge(plates),e[0]);
        });
      });
      var spikes=[],crown=type==='hollowking'?9:7;
      safe('crown',function(){for(var i=0;i<crown;i++){var a=i/crown*TAU,rr=type==='hollowking'?.125:.11,base=p.clone().add(V(Math.sin(a)*rr,.10,Math.cos(a)*rr)),tall=type==='hollowking'?(i%2?.42:.2):(.16+(i%2)*.08);spikes.push(G.spike(type==='hollowking'?.042:.035,base,base.clone().add(V(Math.sin(a)*.07,tall,Math.cos(a)*.07))));}A.rigid(type==='hollowking'?'bone':'iron',G.merge(spikes),head);});
    }
    if(type==='ashbound'){
      safe('ashbound',function(){
        // The surviving ash oath is armoured from the back as well as the front: leather jerkin, collar, belt, iron seal.
        var cuirass=G.sheet(32,14,function(u,v){return fitted.at(u*TAU,fb.max.y-.012-v*(fb.max.y-fb.min.y-.075),.026);},true,true);G.uvScale(cuirass,2.5,2);fitted.attach('leather',cuirass);
        var collar=G.tube([[chest.x-.20,chest.y+.20,chest.z],[chest.x-.10,chest.y+.27,chest.z-.085],[chest.x+.10,chest.y+.27,chest.z-.085],[chest.x+.20,chest.y+.20,chest.z]],.026,8,20,true);A.rigid('iron',collar,spine);
        var belt=G.sheet(28,3,function(u,v){var a=u*TAU;return[hip.x+Math.sin(a)*.23,hip.y+.05-v*.09,hip.z+Math.cos(a)*.19];},true,true);G.uvScale(belt,3,1);A.rigid('leather',belt,'pelvis');
        // Riveted breast plate, hugging the jerkin, and one bandolier.
        fitted.attach('iron',G.merge([plateWear(G.shell(14,5,function(u,v){var a=(u-.5)*1.7;return fitted.at(a,fb.max.y-.07-v*.2,.04+Math.sin(v*3.14)*.006);},.012,false,true),.4)]));
        fitted.attach('leather',G.sheet(4,16,function(u,v){var a=-.9+v*1.9,y=fb.max.y-.04-v*(torsoH*.68);return fitted.at(a,y+(u-.5)*.06,.043);},false,true));
        [armL,armR].forEach(function(b){var q=A.P(b);A.rigid('iron',G.sphere(.12,arr(q.clone().add(V(0,.015,0))),[1.05,.45,.95],14,8),b);});
        A.rigid('iron',G.ring(.055,.010,[chest.x-.045,chest.y+.055,chest.z-.158],[0,0,.3],6,20),spine);
        // Ragged ash mantle falling from both shoulders over the back: breaks the silhouette from the game camera.
        var mantle=G.sheet(16,12,function(u,v){var across=(u-.5)*(bw*.95+v*.14);return[fitted.cx+across,fb.max.y-.02-v*.62+Math.sin(u*21)*.03*v,fb.min.z-.03-.05*v+Math.sin(u*13+v*5)*.012];},true);G.uvScale(mantle,2,2);G.wear(mantle,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.7,width:.05,bottom:.2,base:.04}});A.rigid('rag',mantle,spine);
      });
    }
    if(type==='shardseer'){
      safe('shardseer',function(){
        var cloak=G.sheet(20,16,function(u,v){var across=(u-.5)*(.43+v*.12);return[chest.x+across,chest.y+.22-v*.73+Math.sin(u*19)*.035*v*v,fb.min.z-.025-.035*v+Math.sin(u*17+v*6)*.012];},true);G.uvScale(cloak,2,2.5);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.64,width:.045,bottom:.12,base:.025}});A.rigid('rag',cloak,spine);
        var binding=[];[-1,1].forEach(function(sign){binding.push(G.tube([[chest.x+sign*.18,chest.y+.18,chest.z-.10],[chest.x+sign*.14,chest.y+.24,chest.z],[chest.x+sign*.17,chest.y+.12,chest.z+.12]],.015,7,16,true));});A.rigid('iron',G.merge(binding),spine);
        // A halo of grave crystal grows out of the seer's spine and shoulder: tall emissive silhouette that blooms in the dark.
        var shard=[];
        for(var i=0;i<7;i++){var f=(i-3)/3,base=V(chest.x+f*.17,chest.y+.18-Math.abs(f)*.06,fb.min.z-.035),tall=.46-Math.abs(f)*.2+(i%2)*.1;shard.push(G.spike(.052-Math.abs(f)*.012,base,base.clone().add(V(f*.30,tall,-.14-Math.abs(f)*.04))));}
        [-1,1].forEach(function(s){var b0=A.P(s<0?armL:armR);shard.push(G.spike(.04,b0.clone().add(V(s*.08,.08,-.02)),b0.clone().add(V(s*.20,.30,-.05))));shard.push(G.spike(.03,b0.clone().add(V(s*.10,.07,.04)),b0.clone().add(V(s*.24,.2,.07))));});
        A.rigid('glow',G.merge(shard),spine);
        A.rigid('iron',G.tube([[chest.x-.17,chest.y+.12,chest.z-.14],[chest.x,chest.y+.08,chest.z-.18],[chest.x+.17,chest.y+.12,chest.z-.14]],.020,7,18,true),spine);
        // pale gem set in a rune-ring at the brow
        A.rigid('iron',G.ring(.05,.008,[p.x,p.y+.07,p.z+.095],[Math.PI/2.4,0,0],6,18),head);A.rigid('glow',G.sphere(.022,[p.x,p.y+.07,p.z+.105],[1,1.3,.7],8,6),head);
      });
    }
    if(type==='cavefang'){
      safe('cavefang',function(){
        var claws=[];[handL,handR].forEach(function(b){var parts=[],h=A.P(b);for(var i=0;i<4;i++){var q=h.clone().add(V((i-1.5)*.035,-.08,.02));parts.push(G.tube([arr(q),arr(q.clone().add(V(0,-.13,.07))),arr(q.clone().add(V(0,-.15,.19)))],.016,6,12,true));}A.rigid('bone',G.merge(parts),b);});
        var ribs=[];for(var j=0;j<5;j++)ribs.push(G.tube([[chest.x-.15,chest.y+.1-j*.08,chest.z-.07],[chest.x,chest.y+.13-j*.08,chest.z-.24],[chest.x+.15,chest.y+.1-j*.08,chest.z-.07]],.018,7,16,true));A.rigid('bone',G.merge(ribs),spine);
        // Bone ridge down the spine, shrinking toward the tail: reads as a creature, not a thin man, from above.
        var ridge=[];for(var k=0;k<9;k++){var y=chest.y+.20-k*.065,z=fb.min.z-.01-Math.sin(k/8*3)*.02,base=V(chest.x,y,z),h2=.13-k*.01;ridge.push(G.spike(.032-k*.0018,base,base.clone().add(V(0,h2*.5,-h2))));}A.rigid('bone',G.merge(ridge),spine);
        // Jaw plates strapped over a wrenched, too-wide mouth.
        A.rigid('bone',G.merge([G.sphere(.075,[p.x,p.y-.06,p.z+.07],[1.2,.45,.9],10,6),G.spike(.014,V(p.x-.05,p.y-.07,p.z+.1),V(p.x-.06,p.y-.15,p.z+.13)),G.spike(.014,V(p.x+.05,p.y-.07,p.z+.1),V(p.x+.06,p.y-.15,p.z+.13))]),head);
      });
    }
    if(type==='gravemason'){
      safe('gravemason',function(){
        // A carved headstone strapped to the back, rope-lashed: the mason carries the next grave.
        var slab=C.forgedBlock(.42,.5,.1,[0,0,0],.037).rotateX(-.3).rotateZ(.05).translate(fitted.cx,chest.y-.22,fb.min.z-.13);plateWear(slab,.25);
        A.rigid('ash',G.merge([slab,G.box(.33,.06,.13,[fitted.cx+.005,chest.y-.01,fb.min.z-.205],[-.3,0,.05])]),spine);
        var ropes=[];[0,1].forEach(function(i){ropes.push(G.tube([[chest.x-.25,chest.y+.28-i*.30,fb.min.z-.07],[chest.x,chest.y+.31-i*.30,fb.min.z-.24],[chest.x+.25,chest.y+.28-i*.30,fb.min.z-.07]],.016,6,14,false));});
        ropes.push(G.tube([[chest.x-.2,chest.y+.26,chest.z+.15],[chest.x,chest.y+.02,chest.z+.2],[chest.x+.2,chest.y-.22,chest.z+.15]],.02,6,14,false));
        A.rigid('leather',G.merge(ropes),spine);
      });
    }
    if(type==='ruinwarden'||type==='hollowking'){
      safe('cloak',function(){
        var king=type==='hollowking',len=king?1.25:.95,hw=king?bw*1.1:bw*.95;
        var cloak=G.sheet(20,14,function(u,v){var across=(u-.5)*(hw+v*.34);return[fitted.cx+across,fb.max.y-.04-v*len+Math.sin(u*23)*.04*v*v,fb.min.z-.04-.07*v+Math.sin(u*15+v*5)*.018];},true);G.uvScale(cloak,2.4,3);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.7,width:.05,bottom:.22,base:.03}});A.rigid('rag',cloak,spine);
        // tabard front, short and ragged
        var tab=G.sheet(10,12,function(u,v){return[fitted.cx+(u-.5)*(.34+v*.08),hip.y+.06-v*.5+Math.sin(u*17)*.03*v,hip.z+.2+Math.sin(u*9+v*4)*.01];},false);G.uvScale(tab,1.5,2);G.wear(tab,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.6,width:.05,bottom:.2,base:.03}});A.rigid('rag',tab,'pelvis');
      });
    }
    if(type==='hollowking'){
      safe('king',function(){
        // Broken throne behind the king: a fan of cracked slabs rising from his spine (the Silent Throne he cannot leave).
        var fan=[];
        for(var i=0;i<9;i++){var a=(i-4)/4*1.15,h=.95-Math.abs(a)*.28+(i%3)*.08,w=.10+(i%2)*.03,pts=[[-w,0],[w,0],[w*1.25,h*.55],[w*.1,h],[-w*1.1,h*.62]];
          var s=G.extrude(pts,.05,.008);s.translate(0,.08,0);fan.push(G.wear(s,{edge:.2}) && s);
          s.rotateZ(-a);s.translate(fitted.cx+Math.sin(a)*.12,fb.max.y-.05,fb.min.z-.24-Math.abs(a)*.04);}
        A.rigid('bone',G.merge(fan),spine);
        // Cracks of grave light through the chest and ribs.
        var cr=[];for(var k=0;k<6;k++){var a0=(k-2.5)*.38,pts2=[];for(var j=0;j<6;j++){pts2.push(fitted.at(a0+Math.sin(j*1.9+k*2.1)*.11,fb.max.y-.07-j*torsoH*.15,.046+(k%2)*.004));}cr.push(G.tube(pts2,.0065,5,18,false));}
        fitted.attach('glow',G.merge(cr));
        // glowing hollow eye-sockets behind the visor slit
        A.rigid('glow',G.merge([G.sphere(.016,[p.x-.045,p.y+.03,p.z+.13],[1.3,.7,.6],8,6),G.sphere(.016,[p.x+.045,p.y+.03,p.z+.13],[1.3,.7,.6],8,6)]),head);
        // heavy chain hung from the belt
        var ch=[];for(var c=0;c<10;c++)ch.push(G.ring(.03,.008,[hip.x-.22,hip.y-.02-c*.055,hip.z+.04],[c%2?Math.PI/2:0,0,0],5,10));A.rigid('iron',G.merge(ch),'pelvis');
      });
    }
    var weapon;
    if(type==='shardseer'){weapon={parts:{wood:[G.cyl(.025,.035,1.25,10,[0,.45,0])],glow:[G.spike(.075,new T.Vector3(0,1.04,0),new T.Vector3(0,1.48,0)),G.spike(.045,new T.Vector3(.06,1.02,0),new T.Vector3(.18,1.30,.0)),G.spike(.045,new T.Vector3(-.06,1.02,0),new T.Vector3(-.18,1.26,.02)),G.spike(.035,new T.Vector3(0,1.02,.06),new T.Vector3(.02,1.22,.16))],iron:[G.ring(.058,.013,[0,1.04,0],[Math.PI/2,0,0],6,20),G.cyl(.04,.032,.10,8,[0,1.0,0])]},tip:new T.Vector3(0,1.48,0)};}
    else if(type==='gravemason'){weapon={parts:{wood:[G.cyl(.035,.05,1.18,10,[0,.40,0])],iron:[C.forgedBlock(.44,.24,.22,[0,.99,0],.043),G.ring(.056,.012,[0,.75,0],[Math.PI/2,0,0],6,20),G.spike(.05,V(0,1.11,0),V(0,1.25,0),4)]},tip:new T.Vector3(0,1.11,0)};}
    else if(type!=='cavefang'){weapon={parts:{iron:[C.forgedBlade(1.05,.12,false),C.forgedBlock(.38,.055,.07,[0,.06,0],.012),G.cyl(.042,.048,.043,8,[0,-.27,0])],leather:[C.forgedGrip(.033,.25,-.25)]},tip:new T.Vector3(0,1.05,0)};}
    if(weapon) weapon.materials = { glow: materials.glow, iron: materials.iron, leather: materials.leather };
    return {materials:materials,weapon:weapon};
  });}
  make('ashbound',{base:'ubc',height:2.3,radius:.46,motionType:'guard'});
  make('shardseer',{base:'ubc',height:2.45,radius:.44,motionType:'cultist'});
  make('cavefang',{base:'ubc',height:1.82,radius:.54,motionType:'stalker'});
  make('gravemason',{base:'executioner',height:2.75,radius:.69,motionType:'carrier'});
  make('ruinwarden',{base:'executioner',height:3.05,radius:.78,motionType:'guard'});
  make('hollowking',{base:'executioner',height:4.0,radius:1.05,motionType:'boss'});
  B.RuinsModels={types:['ashbound','shardseer','cavefang','gravemason','ruinwarden','hollowking'],glow:GLOW};
}());
