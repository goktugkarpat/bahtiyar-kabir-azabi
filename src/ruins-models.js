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
  // Mineral and cinder plates follow measured skin clouds. The contact rig stays unchanged.
  function creatureCarapace(A,C,key,head,spine,handL,handR,fitted,forge){
    var hp=A.cloud([head],['skin'],.35),hb=A.box(hp),hc=hb.getCenter(new T.Vector3()),hs=hb.getSize(new T.Vector3());
    if(!hp.length)return;
    var h=Math.max(.16,hs.y),rx=Math.max(.065,hs.x*.52),rz=Math.max(.065,hs.z*.53);
    function headSurface(a,y,pad){
      var best=0,nearest=0,score=Infinity;
      for(var i=0;i<hp.length;i++){var p=hp[i],dx=p.x-hc.x,dz=p.z-hc.z,r=Math.hypot(dx,dz),da=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(p.y-y);if(dy<h*.16&&da<.32)best=Math.max(best,r);var sc=dy*3+da*.12;if(sc<score){score=sc;nearest=r;}}
      var r=(best||nearest||Math.min(rx,rz))+(pad||.01);return [hc.x+Math.sin(a)*r,y,hc.z+Math.cos(a)*r];
    }
    // Broken supraorbital and temple growths leave the face and eyes visible.
    var brows=[];for(var side=-1;side<=1;side+=2)(function(side){
      brows.push(G.shell(10,4,function(u,v){var a=side*(.14+u*.74),y=hb.min.y+h*(.78-v*.19)+Math.sin(u*Math.PI)*h*.024;return headSurface(a,y,.014+.014*Math.sin(v*Math.PI));},.008,false,true));
      brows.push(G.shell(8,4,function(u,v){var a=side*(.94+u*.88),y=hb.min.y+h*(.80-v*(side<0?.40:.29))+.006*Math.sin(u*9)*v;return headSurface(a,y,.013+.010*Math.sin(v*Math.PI));},.008,false,true));
    })(side);var crown=G.merge(brows);G.uvScale(crown,1.1,.8);plateWear(crown,.16);A.rigid(key,crown,head);
    // Split jaw cheeks leave an actual face opening; teeth grow from the face, never the neck pivot.
    var cheeks=[];
    for(var side=-1;side<=1;side+=2)(function(side){
      cheeks.push(G.shell(10,5,function(u,v){var a=side*(.22+u*1.10),y=hb.min.y+h*(.46-v*.33)+Math.sin(u*Math.PI)*h*.025;return headSurface(a,y,.016+.009*Math.sin(v*Math.PI));},.008,false,true));
    })(side);
    for(var i=0;i<6;i++){var a=(i-2.5)*.105,y=hb.min.y+h*(.24+Math.abs(i-2.5)*.022),q=V.apply(null,headSurface(a,y,.019)),tip=q.clone().add(V(Math.sin(a)*.009,h*(.11+(i%2)*.025),.018));
      cheeks.push(G.tube([q,q.clone().lerp(tip,.5).add(V(0,0,.007)),tip],function(t){return .0075*(1-t)+.0008;},5,8,true));
    }
    for(var side=-1;side<=1;side+=2){var hinge=V.apply(null,headSurface(side*.82,hb.min.y+h*.34,.016)),tip=hinge.clone().add(V(side*.012,-h*.15,.047));cheeks.push(G.tube([hinge,hinge.clone().lerp(tip,.5).add(V(0,0,.016)),tip],function(t){return .010*Math.pow(1-t,1.4)+.001;},6,10,true));}
    var crest=[];for(var k=0;k<4;k++){var a=Math.PI+(k-1.5)*.43,q=V.apply(null,headSurface(a,hb.min.y+h*(.69+(k%2)*.05),.014)),tip=q.clone().add(V(Math.sin(a)*.020,h*(.14+(k%2)*.04),Math.cos(a)*.031));crest.push(G.tube([q,q.clone().lerp(tip,.5).add(V(0,h*.05,0)),tip],function(t){return .012*Math.pow(1-t,1.3)+.001;},6,10,true));}A.rigid(key,G.merge(crest),head);
    var jaw=G.merge(cheeks);G.uvScale(jaw,1.1,.8);plateWear(jaw,.16);A.rigid(key,jaw,head);
    // Short hooked talons align to the imported palm direction, with a skin-sized knuckle base.
    [handL,handR].forEach(function(hand){
      var fore=hand==='hand_l'?'lowerarm_l':'lowerarm_r',origin=A.P(hand),axis=origin.clone().sub(A.P(fore)).normalize(),normal=V(0,0,1),side=normal.clone().cross(axis).normalize();
      if(side.lengthSq()<.01)side.set(1,0,0);normal=axis.clone().cross(side).normalize();if(normal.z<0)normal.negate();
      var cloud=A.cloud([hand],['skin'],.3),end=.1,span=.065;for(var j=0;j<cloud.length;j++){var d=cloud[j].clone().sub(origin);end=Math.max(end,d.dot(axis));span=Math.max(span,Math.abs(d.dot(side)));}
      var parts=[];
      for(var k=0;k<4;k++){var q=origin.clone().addScaledVector(axis,end*.82).addScaledVector(side,(k-1.5)*span*.46).addScaledVector(normal,.006),mid=q.clone().addScaledVector(axis,.065).addScaledVector(normal,.012),tip=q.clone().addScaledVector(axis,.11).addScaledVector(normal,.055);
        parts.push(G.sphere(.016,arr(q),[.75,1,1],7,5),G.tube([q,mid,tip],function(t){return .0125*Math.pow(1-t,1.25)+.001;},6,10,true));
      }
      var claws=G.merge(parts);plateWear(claws,.12);A.rigid(key,claws,hand);
    });
    // Broken overlapping chest and back plates skin to the existing spine influences.
    var fb=fitted.box,height=fb.max.y-fb.min.y,panels=[];
    for(var row=0;row<4;row++)for(var side=-1;side<=1;side+=2)(function(row,side){
      var center=side*(forge?.70:.68),width=.59-row*.045,top=fb.max.y-.028-row*height*.18;
      panels.push(G.shell(9,4,function(u,v){var a=center+(u-.5)*width,y=top-v*height*.185+Math.sin(u*Math.PI)*.012-.006*Math.sin(u*13+row)*v*v;return fitted.at(a,y,.017+.019*Math.sin(v*Math.PI)+.006*Math.sin(u*11+row)*v);},.009,false,true));
      panels.push(G.shell(9,4,function(u,v){var a=Math.PI+side*.46+(u-.5)*.62,y=top-v*height*.18+.008*Math.sin(u*9+row)*v*v;return fitted.at(a,y,.015+.024*Math.sin(v*Math.PI));},.009,false,true));
    })(row,side);
    var shell=G.merge(panels);G.uvScale(shell,1.4,1.3);plateWear(shell,.18);fitted.attach(key,shell);
    // A few organic outer limb scales interrupt the exposed humanoid outline without covering a joint.
    [['lowerarm_l','hand_l',-1],['lowerarm_r','hand_r',1],['thigh_l','calf_l',-1],['thigh_r','calf_r',1]].forEach(function(entry){
      var from=entry[0],to=entry[1],q=C.sleeve(A,from,to,.18,.87,.013,.006,['skin'],0,{u:12,v:4}),desired=V(entry[2]*.7,0,.7),bestAngle=0,best=-Infinity;
      for(var j=0;j<12;j++){var a=j/12*TAU,score=q.at(a,.45,0)[1].dot(desired);if(score>best){best=score;bestAngle=a;}}
      var scales=[];for(var row=0;row<(forge?3:2);row++)(function(row){scales.push(G.shell(9,4,function(u,v){var angle=bestAngle+(u-.5)*1.65*(1-.58*v),t=.20+row*.21+v*.22,point=q.at(angle,t,.003+.012*Math.sin(v*Math.PI))[0];return arr(point);},.006,false,true));})(row);
      q.geometry.dispose();var g=G.merge(scales);G.uvScale(g,.9,.9);plateWear(g,.18);A.transfer(key,g,['skin'],{bones:[from,to]});
    });
    // Sparse asymmetric hip growths follow the existing pelvis and leave the skin outline visible.
    var hip=A.P('pelvis'),cloud=A.cloud(['pelvis','thigh_l','thigh_r'],['skin'],.35),near=cloud.filter(function(q){return q.y>hip.y-.19&&q.y<hip.y+.08;}),box=A.box(near.length?near:cloud),cx=(box.min.x+box.max.x)*.5,cz=(box.min.z+box.max.z)*.5;
    function scuteAt(a,y,pad){var best=0,fallback=.19,score=Infinity;for(var j=0;j<cloud.length;j++){var q=cloud[j],dx=q.x-cx,dz=q.z-cz,r=Math.hypot(dx,dz),df=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(q.y-y);if(dy<.055&&df<.30)best=Math.max(best,r);var sc=dy*4+df*.15;if(sc<score){score=sc;fallback=r;}}var r=(best||fallback)+pad;return[cx+Math.sin(a)*r,y,cz+Math.cos(a)*r];}
    var scutes=[];[-1.30,1.43,Math.PI-.76].forEach(function(a,i){scutes.push(G.shell(7,4,function(u,v){var angle=a+(u-.5)*.53*(1-.58*v),y=hip.y+.03-v*(i===1?.17:.12)+.009*Math.sin(u*Math.PI)*v;return scuteAt(angle,y,.015+.012*Math.sin(v*Math.PI));},.007,false,true));});
    var pelvisShell=G.merge(scutes);G.uvScale(pelvisShell,1.2,.8);plateWear(pelvisShell,.15);A.weighted(key,pelvisShell,C.clothWeights(A,'pelvis','thigh_l','thigh_r',hip.y+.065,hip.y-.195,.14));
    return {center:hc,box:hb,height:h,surface:headSurface};
  }
  var GLOW=[];   // emissive materials the telegraph layer breathes (see telegraphs.js glowPulse)
  function make(type,cfg){cfg.chapter=3;B.Models.register(type,cfg,function(A,C){
    var exec=cfg.base==='executioner',head=exec?'head':'Head',spine=exec?'spine03':'spine_03',handL=exec?'handL':'hand_l',handR=exec?'handR':'hand_r',armL=exec?'upper_armL':'upperarm_l',armR=exec?'upper_armR':'upperarm_r',thighL=exec?'thighL':'thigh_l',thighR=exec?'thighR':'thigh_r';
    var skin=A.addFrom(C.bases[cfg.base],function(){return true;},'skin')[0];if(exec)A.remapBone('neutral_bone','pelvis');
    if(type==='cavefang'){A.lengthen({lowerarm_l:1.35,lowerarm_r:1.35,hand_l:1.25,hand_r:1.25});var slim={};slim[spine]=.78;A.slim(skin,slim,1);}
    var p=A.P(head),chest=A.P(spine),hip=A.P('pelvis'),stone=type==='gravemason'||type==='ruinwarden'||type==='hollowking';
    var fitted=torsoFit(A,exec,chest),fb=fitted.box,bw=Math.max(.34,fb.max.x-fb.min.x);
    // Ash-grey, dirty palettes: no clean cloth, no bare-steel patches. The linen scan is indigo, so it is desaturated first.
    var tint=type==='ashbound'?[1.02,.76,.60]:type==='shardseer'?[.82,.80,.94]:type==='cavefang'?[.52,.63,.67]:[1.12,.95,.78];
    var clothTint=type==='shardseer'?[.13,.10,.22]:type==='hollowking'?[.13,.025,.028]:type==='ruinwarden'?[.09,.026,.026]:type==='gravemason'?[.19,.15,.12]:type==='cavefang'?[.2,.18,.15]:[.22,.15,.10];
    var materials={skin:C.bodyMaterial(A.srcMaterial(exec?'Exec_mesh':'SuperHero_Male',C.bases[cfg.base]),'ruins-'+type+'-skin',{cls:'skin',skin:1,skinMap:exec,sat:type==='cavefang'?.30:.5,tint:tint,grime:type==='cavefang'?.56:.42,blood:type==='cavefang'?.26:.2,scale:8,fresh:true},{roughness:.7}),
      iron:C.bodyMaterial(C.gearMaterial('iron'),'ruins-'+type+'-iron',{cls:'metal',tint:[1.02,.9,.78],rust:.34,grime:.4,wear:.5,scale:8},{roughness:.66}),
      leather:C.bodyMaterial(C.gearMaterial('leather'),'ruins-'+type+'-leather',{cls:'leather',tint:stone?[.74,.52,.36]:type==='shardseer'?[.30,.25,.34]:[.62,.31,.16],grime:.32,blood:.12,scale:7},{roughness:.86}),
      rag:C.bodyMaterial(C.gearMaterial('rag'),'ruins-'+type+'-linen',{cls:'cloth',tear:true,sat:.3,tint:clothTint,grime:.32,blood:.2,scale:7},{roughness:.92,side:T.DoubleSide}),
      bone:C.bodyMaterial(C.gearMaterial('bone'),'ruins-'+type+'-bone',{cls:'bone',tint:type==='cavefang'?[.43,.42,.37]:type==='hollowking'?[.74,.66,.54]:[1.1,1.0,.78],grime:type==='cavefang'?.56:type==='hollowking'?.5:.34,blood:.15,scale:9},{roughness:.76}),
      glow:new T.MeshStandardMaterial({color:0x302a48,emissive:0x7552b4,emissiveIntensity:type==='hollowking'?1.1:.78,roughness:.48,metalness:.15}),
      ash:C.bodyMaterial(C.gearMaterial('ash'),'ruins-'+type+'-ash',{cls:'bone',tint:[.5,.48,.46],grime:.75,scale:6},{roughness:.92})};
    GLOW.push({mat:materials.glow,base:materials.glow.emissiveIntensity,type:type});
    // Reuse the hero's measured limb fitting, with a camera-appropriate NPC mesh budget.
    // Every piece joins an existing material group and the original skeleton.
    function limbCover(key,from,to,t0,t1,pad,thickness,flare){
      var q=C.sleeve(A,from,to,t0,t1,pad,thickness,['skin'],flare,{u:20,v:6});
      G.uvScale(q.geometry,.8,.7);G.wear(q.geometry,{edge:key==='iron'?.18:0,border:.2,cavity:.025,curv:.004});
      A.transfer(key,q.geometry,['skin'],{bones:[from,to]});return q;
    }
    function boot(foot,toe,key){
      var pts=A.cloud([foot,toe],['skin'],.35),box=A.box(pts),c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3());
      if(!pts.length)return;
      var w=Math.max(.054,sz.x*.54),len=Math.max(.13,sz.z*.55),base=box.min.y+.005;
      var shoe=G.shell(20,7,function(u,v){var a=u*TAU,e=v*Math.PI/2,r=Math.pow(Math.max(0,Math.cos(e)),.35),toeShape=.92+.08*Math.cos(a);return[c.x+Math.sin(a)*w*toeShape*r,base+.018+Math.sin(e)*Math.max(.12,sz.y*1.02),c.z+Math.cos(a)*len*r];},.004,false,true);
      G.uvScale(shoe,.8,.7);A.rigid(key||'leather',shoe,foot);
    }

    // Banded plate that hugs the real torso, no floating bricks: n lames, each a rolled-rim shell flaring at its lower edge.
    function lames(key,count,top,gap,height,pad,flare){
      var list=[];
      for(var i=0;i<count;i++)(function(i){var yTop=top-i*gap;list.push(plateWear(G.shell(24,2,function(u,v){var a=u*TAU,front=Math.max(0,Math.cos(a)),crest=Math.pow(front,8)*.014*Math.sin(v*Math.PI);return fitted.at(a,yTop-v*height-.014*front*front*Math.sin(v*Math.PI),pad+i*.004+v*flare+crest);},.011,true,true),.38));})(i);
      fitted.attach(key,G.merge(list));
    }
    var torsoTop=fb.max.y-.07,torsoH=fb.max.y-fb.min.y;
    // Weathered skirt follows the pelvis, never floats.
    if(type==='ashbound'){
      safe('skirt',function(){
        var cloth=G.sheet(28,12,function(u,v){var a=u*TAU,r=.21+v*.055;return[hip.x+Math.sin(a)*r,hip.y+.06-v*(type==='shardseer'?.65:.38)+Math.sin(a*9)*.035*v,hip.z+Math.cos(a)*r];},true);G.uvScale(cloth,3,2);A.rigid('rag',cloth,'pelvis');
      });
    }
    if(stone)safe('articulated waist armour',function(){
      // Short curved tassets replace the broad hanging cloth. Their surface follows
      // the imported hips; a small thigh influence separates them during a stride.
      var upper=hip.y+.085,lower=hip.y-(type==='hollowking'?.38:type==='ruinwarden'?.32:.27),cloud=A.cloud(['pelvis',thighL,thighR],['skin'],.25),near=cloud.filter(function(q){return q.y<upper+.03&&q.y>lower-.04;}),hb=A.box(near.length?near:cloud),cx=(hb.min.x+hb.max.x)*.5,cz=(hb.min.z+hb.max.z)*.5;
      function surface(a,y,pad){var best=0,fallback=.25,score=Infinity;for(var k=0;k<cloud.length;k++){var q=cloud[k],dx=q.x-cx,dz=q.z-cz,r=Math.hypot(dx,dz),df=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(q.y-y);if(dy<.065&&df<.25)best=Math.max(best,r);var sc=dy*4+df*.18;if(sc<score){score=sc;fallback=r;}}var r=Math.max(.21,best||fallback)+pad;return[cx+Math.sin(a)*r,y,cz+Math.cos(a)*r];}
      var count=type==='hollowking'?8:type==='ruinwarden'?8:6,parts=[];
      for(var i=0;i<count;i++)(function(i){var center=(i+.5)*TAU/count,half=TAU/count*.43;
        var panel=G.shell(10,5,function(u,v){var a=center+(u-.5)*half*2*(1-v*.12),y=upper+(lower-upper)*v+.018*Math.pow(Math.sin(u*Math.PI),2)*v*v;return surface(a,y,.029+.027*v+.006*Math.sin(v*Math.PI));},.010,false,true);
        G.uvScale(panel,.7,.8);parts.push(plateWear(panel,.28));
        for(var j=0;j<2;j++){var p2=surface(center+(j?-.18:.18)*half,upper-.045,.043);parts.push(G.sphere(.009,p2,[1,.8,1],6,4));}
      })(i);
      var belt=G.shell(40,2,function(u,v){return surface(u*TAU,upper+.024-v*.060,.030);},.010,true,true);G.uvScale(belt,2,.3);parts.push(plateWear(belt,.22));
      A.weighted('iron',G.merge(parts),C.clothWeights(A,'pelvis',thighL,thighR,upper,lower,.24));
    });
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
    if(type==='ashbound')safe('ash militia clothing',function(){
      ['l','r'].forEach(function(side){limbCover('rag','upperarm_'+side,'lowerarm_'+side,.12,.9,.018,.002,.012);limbCover('leather','thigh_'+side,'calf_'+side,.04,1.02,.016,.003,.010);limbCover('leather','calf_'+side,'foot_'+side,-.02,.88,.019,.003,.008);boot('foot_'+side,'ball_'+side);});
    });
    if(type==='shardseer')safe('grave seer vestments',function(){
      var top=hip.y+.07,bottom=Math.min(A.P('foot_l').y,A.P('foot_r').y)+.15,cloud=A.cloud(['pelvis','thigh_l','thigh_r','calf_l','calf_r'],['skin'],.25);
      function radial(a,y){var best=0,fallback=.24,score=Infinity;for(var i=0;i<cloud.length;i++){var q=cloud[i],dx=q.x-hip.x,dz=q.z-hip.z,r=Math.hypot(dx,dz),df=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(q.y-y);if(dy<.07&&df<.3)best=Math.max(best,r);var sc=dy*4+df*.2;if(sc<score){score=sc;fallback=r;}}return Math.max(.24,best||fallback)+.050;}
      var robe=G.shell(32,12,function(u,v){var gap=.10+v*.17,a=gap+u*(TAU-gap*2),y=top+(bottom-top)*v,r=radial(a,y)+v*.018+Math.sin(a*8+v)*.026*v*v;return[hip.x+Math.sin(a)*r,y+Math.sin(a*9)*.014*v*v,hip.z+Math.cos(a)*r];},.003,false,true);G.uvScale(robe,1,.9);G.wear(robe,{edge:0,tear:{amount:.2,width:.018,bottom:.025,base:.008}});A.weighted('rag',robe,C.clothWeights(A,'pelvis','thigh_l','thigh_r',top,bottom,.40));
      var cuirass=G.sheet(32,14,function(u,v){return fitted.at(u*TAU,fb.max.y-.014-v*(fb.max.y-fb.min.y-.07),.025);},true,true);G.uvScale(cuirass,1,1);G.fillWear(cuirass);fitted.attach('rag',cuirass);
      var hc=A.cloud([head],['skin'],.55),hb=A.box(hc),h=hb.getCenter(new T.Vector3()),hs=hb.getSize(new T.Vector3());
      var hood=G.shell(28,10,function(u,v){var a=.72+u*(TAU-1.44),r=Math.max(.14,hs.x*.56)*Math.sin(v*Math.PI*.65)+.025+v*v*.045;return[h.x+Math.sin(a)*r,hb.max.y+.045+(hb.min.y-hb.max.y-.085)*v,h.z+Math.cos(a)*r-.012];},.003,false,true);G.uvScale(hood,.8,.8);G.fillWear(hood);A.rigid('rag',hood,head);
      ['l','r'].forEach(function(side){limbCover('rag','upperarm_'+side,'lowerarm_'+side,.07,.94,.024,.002,.016);limbCover('rag','lowerarm_'+side,'hand_'+side,.02,.87,.026,.002,.017);limbCover('rag','thigh_'+side,'calf_'+side,-.02,1.06,.025,.003,.006);limbCover('rag','calf_'+side,'foot_'+side,-.05,.94,.022,.003,.005);boot('foot_'+side,'ball_'+side,'rag');});
    });
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
        var shard=[],veins=[];
        for(var i=0;i<7;i++){var f=(i-3)/3,base=V(chest.x+f*.17,chest.y+.18-Math.abs(f)*.06,fb.min.z-.035),tall=.46-Math.abs(f)*.2+(i%2)*.1;var end=base.clone().add(V(f*.30,tall,-.14-Math.abs(f)*.04));shard.push(G.spike(.052-Math.abs(f)*.012,base,end));veins.push(G.spike(.008,base.clone().add(V(0,0,.024)),end.clone().add(V(0,-.045,.010))));}
        [-1,1].forEach(function(s){var b0=A.P(s<0?armL:armR);shard.push(G.spike(.04,b0.clone().add(V(s*.08,.08,-.02)),b0.clone().add(V(s*.20,.30,-.05))));shard.push(G.spike(.03,b0.clone().add(V(s*.10,.07,.04)),b0.clone().add(V(s*.24,.2,.07))));});
        A.rigid('ash',G.merge(shard),spine);A.rigid('glow',G.merge(veins),spine);
        A.rigid('iron',G.tube([[chest.x-.17,chest.y+.12,chest.z-.14],[chest.x,chest.y+.08,chest.z-.18],[chest.x+.17,chest.y+.12,chest.z-.14]],.020,7,18,true),spine);
        // pale gem set in a rune-ring at the brow
        A.rigid('iron',G.ring(.05,.008,[p.x,p.y+.07,p.z+.095],[Math.PI/2.4,0,0],6,18),head);A.rigid('glow',G.sphere(.022,[p.x,p.y+.07,p.z+.105],[1,1.3,.7],8,6),head);
      });
    }
    if(type==='cavefang'){
      safe('cavefang',function(){
        creatureCarapace(A,C,'bone',head,spine,handL,handR,fitted,false);
        // Bone ridge down the spine, shrinking toward the tail: reads as a creature, not a thin man, from above.
        var ridge=[];for(var k=0;k<9;k++){var y=chest.y+.20-k*.065,z=fb.min.z-.01-Math.sin(k/8*3)*.02,base=V(chest.x,y,z),h2=.13-k*.01;ridge.push(G.spike(.032-k*.0018,base,base.clone().add(V(0,h2*.5,-h2))));}A.rigid('bone',G.merge(ridge),spine);

      });
    }
    if(type==='gravemason'){
      safe('gravemason',function(){
        // A carved headstone strapped to the back, rope-lashed: the mason carries the next grave. (visual-dark: arched top so it reads as a grave, not a crate)
        var slab=G.merge([C.forgedBlock(.42,.5,.1,[0,0,0],.037),G.cyl(.205,.205,.094,18,[0,.25,0],[Math.PI/2,0,0]),G.box(.045,.26,.024,[0,.1,-.058]),G.box(.17,.045,.024,[0,.16,-.058])]).rotateX(-.3).rotateZ(.05).translate(fitted.cx,chest.y-.22,fb.min.z-.13);plateWear(slab,.25);
        A.rigid('ash',G.merge([slab,G.box(.33,.06,.13,[fitted.cx+.005,chest.y-.01,fb.min.z-.205],[-.3,0,.05])]),spine);
        var ropes=[];[0,1].forEach(function(i){ropes.push(G.tube([[chest.x-.25,chest.y+.28-i*.30,fb.min.z-.07],[chest.x,chest.y+.31-i*.30,fb.min.z-.24],[chest.x+.25,chest.y+.28-i*.30,fb.min.z-.07]],.016,6,14,false));});
        ropes.push(G.tube([[chest.x-.2,chest.y+.26,chest.z+.15],[chest.x,chest.y+.02,chest.z+.2],[chest.x+.2,chest.y-.22,chest.z+.15]],.02,6,14,false));
        A.rigid('leather',G.merge(ropes),spine);
      });
    }
    if(type==='ruinwarden'||type==='hollowking'){
      safe('cloak',function(){
        var king=type==='hollowking',len=king?1.25:.95,hw=king?bw*1.1:bw*.95;
        var cloak=G.sheet(20,14,function(u,v){var across=(u-.5)*(hw+v*.34);return[fitted.cx+across,fb.max.y-.04-v*len+Math.sin(u*23)*.04*v*v,fb.min.z-.04-.07*v+Math.sin(u*15+v*5)*.018];},true);G.uvScale(cloak,2.4,3);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.28,width:.025,bottom:.07,base:.012}});A.rigid('rag',cloak,spine);

      });
    }
    if(type==='hollowking'){
      safe('king',function(){
        // Broken throne behind the king: a fan of cracked slabs rising from his spine (the Silent Throne he cannot leave).
        var fan=[];
        for(var i=0;i<9;i++){var a=(i-4)/4*1.15,h=.95-Math.abs(a)*.28+(i%3)*.08,w=.10+(i%2)*.03,pts=[[-w,0],[w,0],[w*1.12,h*.34],[w*.82,h*.62],[w*.20,h*.91],[w*.06,h],[-w*.38,h*.87],[-w*.97,h*.65],[-w*1.05,h*.29]];
          var s=G.extrude(pts,.075,.016);s.translate(0,.08,0);fan.push(G.wear(s,{edge:.12,border:.28,cavity:.04}) && s);
          s.rotateZ(-a);s.translate(fitted.cx+Math.sin(a)*.12,fb.max.y-.05,fb.min.z-.24-Math.abs(a)*.04);}
        A.rigid('ash',G.merge(fan),spine);
        // Cracks of grave light through the chest and ribs.
        var cr=[];for(var k=0;k<6;k++){var a0=(k-2.5)*.38,pts2=[];for(var j=0;j<6;j++){pts2.push(fitted.at(a0+Math.sin(j*1.9+k*2.1)*.11,fb.max.y-.07-j*torsoH*.15,.046+(k%2)*.004));}cr.push(G.tube(pts2,.0065,5,18,false));}
        fitted.attach('glow',G.merge(cr));
        // glowing hollow eye-sockets behind the visor slit
        A.rigid('glow',G.merge([G.sphere(.016,[p.x-.045,p.y+.03,p.z+.13],[1.3,.7,.6],8,6),G.sphere(.016,[p.x+.045,p.y+.03,p.z+.13],[1.3,.7,.6],8,6)]),head);
        // heavy chain hung from the belt
        var ch=[];for(var c=0;c<10;c++)ch.push(G.ring(.03,.008,[hip.x-.22,hip.y-.02-c*.055,hip.z+.04],[c%2?Math.PI/2:0,0,0],5,10));A.rigid('iron',G.merge(ch),'pelvis');
      });
    }
    if(type==='shardseer')safe('covered thigh skin',function(){
      var knee=Math.max(A.P('calf_l').y,A.P('calf_r').y)+.035;
      function covered(q){return /^thigh_[lr]$/.test(q.bone)&&q.p.y<hip.y-.025&&q.p.y>knee;}
      A.trim(skin,function(a,b,c){return !(covered(a)&&covered(b)&&covered(c));});
    });
    var weapon;
    if(type==='shardseer'){weapon={parts:{wood:[G.cyl(.025,.035,1.25,10,[0,.45,0])],ash:[G.spike(.075,new T.Vector3(0,1.04,0),new T.Vector3(0,1.48,0)),G.spike(.045,new T.Vector3(.06,1.02,0),new T.Vector3(.18,1.30,.0)),G.spike(.045,new T.Vector3(-.06,1.02,0),new T.Vector3(-.18,1.26,.02)),G.spike(.035,new T.Vector3(0,1.02,.06),new T.Vector3(.02,1.22,.16))],glow:[G.spike(.012,new T.Vector3(0,1.06,.055),new T.Vector3(0,1.46,.014))],iron:[G.ring(.058,.013,[0,1.04,0],[Math.PI/2,0,0],6,20),G.cyl(.04,.032,.10,8,[0,1.0,0])]},tip:new T.Vector3(0,1.48,0)};}
    else if(type==='gravemason'){weapon={parts:{wood:[G.cyl(.035,.05,1.18,10,[0,.40,0])],iron:[C.forgedBlock(.44,.24,.22,[0,.99,0],.043),G.ring(.056,.012,[0,.75,0],[Math.PI/2,0,0],6,20),G.spike(.05,V(0,1.11,0),V(0,1.25,0),4)]},tip:new T.Vector3(0,1.11,0)};}
    else if(type!=='cavefang'){weapon={parts:{iron:[C.forgedBlade(1.05,.12,false),C.forgedBlock(.38,.055,.07,[0,.06,0],.012),G.cyl(.042,.048,.043,8,[0,-.27,0])],leather:[C.forgedGrip(.033,.25,-.25)]},tip:new T.Vector3(0,1.05,0)};}
    if(weapon) weapon.materials = { ash: materials.ash, glow: materials.glow, iron: materials.iron, leather: materials.leather };
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
