/* KIZIL OCAK — licensed rigs, scanned forged iron/leather/linen, fitted furnace armour, hot iron, chains and slag. */
(function () {
  'use strict';
  var B=window.BABA,T=window.THREE,G=B.Gear,TAU=Math.PI*2;
  function arr(p){return [p.x,p.y,p.z];}
  function V(x,y,z){return new T.Vector3(x,y,z);}
  // A broken detail must never take the whole roster down: each block is built on its own.
  function safe(label,fn){try{fn();}catch(e){if(window.console)console.warn('forge-models: '+label,e);}}
  // Fit to the actual imported torso, not to the spine bone (whose Z origin sits inside the back).
  function torsoFit(A,exec,chest){
    var bones=exec?['spine01','spine02','spine03']:['spine_01','spine_02','spine_03'];
    var points=A.cloud?A.cloud(bones,['skin'],.25):[],box=points.length?A.box(points):new T.Box3(new T.Vector3(chest.x-.24,chest.y-.28,chest.z-.18),new T.Vector3(chest.x+.24,chest.y+.22,chest.z+.18));
    var cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
    function at(a,y,pad){var best=0,fallback=0,score=Infinity;for(var i=0;i<points.length;i++){var p=points[i],dx=p.x-cx,dz=p.z-cz,r=Math.hypot(dx,dz),delta=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(p.y-y);if(dy<.065&&delta<.24)best=Math.max(best,r);var s=dy*3+delta*.15;if(s<score){score=s;fallback=r;}}var r=(best||fallback||.2)+(pad||.024);return[cx+Math.sin(a)*r,y,cz+Math.cos(a)*r];}
    function attach(key,g){if(A.transfer)A.transfer(key,g,['skin'],{bones:bones});else A.rigid(key,g,exec?'spine03':'spine_03');}
    return{box:box,cx:cx,cz:cz,at:at,attach:attach};
  }
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
      panels.push(G.shell(9,4,function(u,v){var a=center+(u-.5)*width,y=top-v*height*.185+Math.sin(u*Math.PI)*.012-.006*Math.sin(u*13+row)*v*v;return fitted.at(a,y,.012+.010*Math.sin(v*Math.PI)+.006*Math.sin(u*11+row)*v);},.009,false,true));
      panels.push(G.shell(9,4,function(u,v){var a=Math.PI+side*.46+(u-.5)*.62,y=top-v*height*.18+.008*Math.sin(u*9+row)*v*v;return fitted.at(a,y,.012+.012*Math.sin(v*Math.PI));},.009,false,true));
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
  var GLOW=[];   // emissive hot-iron materials the telegraph layer breathes (see telegraphs.js glowPulse)
  function make(type,cfg){cfg.chapter=4;B.Models.register(type,cfg,function(A,C){
    var exec=cfg.base==='executioner',head=exec?'head':'Head',spine=exec?'spine03':'spine_03',handL=exec?'handL':'hand_l',handR=exec?'handR':'hand_r',armL=exec?'upper_armL':'upperarm_l',armR=exec?'upper_armR':'upperarm_r',foreL=exec?'forearmL':'lowerarm_l',foreR=exec?'forearmR':'lowerarm_r',thighL=exec?'thighL':'thigh_l',thighR=exec?'thighR':'thigh_r';
    var skin=A.addFrom(C.bases[cfg.base],function(){return true;},'skin')[0];if(exec)A.remapBone('neutral_bone','pelvis');
    var p=A.P(head),chest=A.P(spine),hip=A.P('pelvis');
    if(type==='forgesentinel'&&exec)A.slim(skin,{spine01:.68,spine02:.72,spine03:.8,pelvis:.86},1);   // fat-fix: barrel torso of the executioner base slimmed toward the spine axis
    if(type==='slagcrawler'){A.lengthen({lowerarm_l:1.4,lowerarm_r:1.4,hand_l:1.28,hand_r:1.28});var slim={};slim[spine]=.75;A.slim(skin,slim,1);}
    var fitted=torsoFit(A,exec,chest),fb=fitted.box,bw=Math.max(.34,fb.max.x-fb.min.x),torsoH=fb.max.y-fb.min.y;
    var armour=type==='forgesentinel'||type==='ashwarden'||type==='furnaceheart';
    var boss=type==='furnaceheart',elite=type==='ashwarden';
    var clothTint=type==='chainseer'?[.25,.10,.07]:boss?[.045,.040,.037]:elite?[.055,.045,.040]:[.19,.14,.10];
    var materials={
      skin:C.bodyMaterial(A.srcMaterial(exec?'Exec_mesh':'SuperHero_Male',C.bases[cfg.base]),'forge-'+type+'-skin',{cls:'skin',skin:1,skinMap:exec,tint:type==='slagcrawler'?[.44,.36,.30]:[.96,.72,.58],sat:.46,grime:type==='slagcrawler'?.7:.5,blood:.2,scale:9,fresh:true},{roughness:.76}),
      iron:C.bodyMaterial(C.gearMaterial('iron'),'forge-'+type+'-iron',{cls:'metal',tint:[.78,.66,.58],rust:.3,grime:.42,wear:.5,scale:8},{roughness:.66}),
      leather:C.bodyMaterial(C.gearMaterial('leather'),'forge-'+type+'-leather',{cls:'leather',tint:[.36,.24,.17],grime:.4,blood:.2,scale:8},{roughness:.92}),
      rag:C.bodyMaterial(C.gearMaterial('rag'),'forge-'+type+'-linen',{cls:'cloth',tear:true,sat:.3,tint:clothTint,grime:.46,blood:.16,scale:8},{roughness:.95,side:T.DoubleSide}),
      bone:C.bodyMaterial(C.gearMaterial('bone'),'forge-'+type+'-bone',{cls:'bone',tint:[.90,.77,.58],grime:.34,blood:.16,scale:10},{roughness:.78}),
      glow:C.bodyMaterial(C.gearMaterial('iron'),'forge-'+type+'-hot-iron',{cls:'metal',tint:[.69,.44,.26],rust:.2,grime:.3,wear:.6,scale:10},{color:new T.Color(0x4a2a1a),emissive:new T.Color(0xff6a22),emissiveIntensity:boss?1.5:1.05,roughness:.6,metalness:.5})
    };
    GLOW.push({mat:materials.glow,base:materials.glow.emissiveIntensity,type:type});
    // Reuse the hero's measured limb fitting, with a camera-appropriate NPC mesh budget.
    // Every piece joins an existing material group and the original skeleton.
    function limbCover(key,from,to,t0,t1,pad,thickness,flare){
      var q=C.sleeve(A,from,to,t0,t1,pad,thickness,['skin'],flare,{u:20,v:6});
      G.uvScale(q.geometry,.8,.7);G.wear(q.geometry,{edge:key==='iron'?.18:0,border:.2,cavity:.025,curv:.004});
      A.transfer(key,q.geometry,['skin'],{bones:[from,to]});return q;
    }
    function boot(foot,toe){
      var pts=A.cloud([foot,toe],['skin'],.35),box=A.box(pts),c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3());
      if(!pts.length)return;
      var w=Math.max(.054,sz.x*.54),len=Math.max(.13,sz.z*.55),base=box.min.y+.005;
      var shoe=G.shell(20,7,function(u,v){var a=u*TAU,e=v*Math.PI/2,r=Math.pow(Math.max(0,Math.cos(e)),.35),toeShape=.92+.08*Math.cos(a);return[c.x+Math.sin(a)*w*toeShape*r,base+.018+Math.sin(e)*Math.max(.12,sz.y*1.02),c.z+Math.cos(a)*len*r];},.004,false,true);
      G.uvScale(shoe,.8,.7);A.rigid('leather',shoe,foot);
    }

    function lames(key,count,top,gap,height,pad,flare){
      var list=[];
      for(var i=0;i<count;i++)(function(i){var yTop=top-i*gap;list.push(plateWear(G.shell(24,2,function(u,v){var a=u*TAU,front=Math.max(0,Math.cos(a)),rib=.010*Math.pow(Math.max(0,Math.cos(a*4)),4)*Math.sin(v*Math.PI);return fitted.at(a,yTop-v*height-.01*front*front,pad+i*.004+v*flare+rib);},.011,true,true),.38));})(i);
      fitted.attach(key,G.merge(list));
    }
    // bone-straight crack of light along a limb bone (a seam through the skin or the plates)
    function seam(bone,off,radius,wob){
      var a=A.P(bone),b=A.tail(bone)||a.clone().add(V(0,-.25,0)),pts=[],n=5,d=b.clone().sub(a),side=V(d.z,0,-d.x).normalize().multiplyScalar(off);
      for(var i=0;i<=n;i++){var t=i/n;pts.push(a.clone().lerp(b,t).add(side.clone().multiplyScalar(1+Math.sin(i*2.3+off*40)*(wob||.4))));}
      return G.tube(pts,radius,5,16,false);
    }
    if(type!=='slagcrawler'){
      safe('shell',function(){
        var shell=G.sheet(32,14,function(u,v){return fitted.at(u*TAU,fb.max.y-.012-v*(fb.max.y-fb.min.y-.075),.028);},true,true);G.uvScale(shell,2.5,2);fitted.attach(armour?'iron':type==='chainseer'?'rag':'leather',shell);
      });
      if(type!=='chainseer'&&!armour)safe('apron',function(){
        var apron=G.sheet(20,15,function(u,v){return[hip.x+(u-.5)*(.42+v*.12),hip.y+.05-v*(type==='chainseer'?.62:.43)+Math.sin(u*17)*.04*v*v,hip.z+.21+Math.sin(u*12+v*5)*.01];},true);G.uvScale(apron,2.5,2);G.wear(apron,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.6,width:.045,bottom:.12,base:.03}});A.rigid('rag',apron,'pelvis');
      });
    }
    if(armour)safe('articulated waist armour',function(){
      // Short curved tassets replace the broad hanging cloth. Their surface follows
      // the imported hips; a small thigh influence separates them during a stride.
      var upper=hip.y+.085,lower=hip.y-(boss?.40:elite?.35:.30),cloud=A.cloud(['pelvis',thighL,thighR],['skin'],.25),near=cloud.filter(function(q){return q.y<upper+.03&&q.y>lower-.04;}),hb=A.box(near.length?near:cloud),cx=(hb.min.x+hb.max.x)*.5,cz=(hb.min.z+hb.max.z)*.5;
      function surface(a,y,pad){var best=0,fallback=.25,score=Infinity;for(var k=0;k<cloud.length;k++){var q=cloud[k],dx=q.x-cx,dz=q.z-cz,r=Math.hypot(dx,dz),df=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(q.y-y);if(dy<.065&&df<.25)best=Math.max(best,r);var sc=dy*4+df*.18;if(sc<score){score=sc;fallback=r;}}var r=Math.max(.21,best||fallback)+pad;return[cx+Math.sin(a)*r,y,cz+Math.cos(a)*r];}
      var count=boss?10:8,parts=[];
      for(var i=0;i<count;i++)(function(i){var center=(i+.5)*TAU/count,half=TAU/count*.43;
        var panel=G.shell(10,5,function(u,v){var a=center+(u-.5)*half*2*(1-v*.12),y=upper+(lower-upper)*v+.018*Math.pow(Math.sin(u*Math.PI),2)*v*v;return surface(a,y,.029+.027*v+.006*Math.sin(v*Math.PI));},.010,false,true);
        G.uvScale(panel,.7,.8);parts.push(plateWear(panel,.28));
        for(var j=0;j<2;j++){var p2=surface(center+(j?-.18:.18)*half,upper-.045,.043);parts.push(G.sphere(.009,p2,[1,.8,1],6,4));}
      })(i);
      var belt=G.shell(40,2,function(u,v){return surface(u*TAU,upper+.024-v*.060,.030);},.010,true,true);G.uvScale(belt,2,.3);parts.push(plateWear(belt,.22));
      A.weighted('iron',G.merge(parts),C.clothWeights(A,'pelvis',thighL,thighR,upper,lower,.24));
    });
    if(type==='emberbound')safe('forge work clothes',function(){
      ['l','r'].forEach(function(side){var upper='upperarm_'+side,fore='lowerarm_'+side,thigh='thigh_'+side,calf='calf_'+side,foot='foot_'+side;
        limbCover('rag',upper,fore,.11,.92,.015,.002,.008);
        limbCover('rag',thigh,calf,.06,1.035,.021,.002,.010);
        limbCover('rag',calf,foot,-.04,.96,.021,.002,.005);
        limbCover(side==='l'?'leather':'iron',calf,foot,.28,.83,.030,.006,.020);
        boot(foot,'ball_'+side);
      });
    });
    if(type==='chainseer')safe('chainseer vestments',function(){
      var hc=A.cloud([head],['skin'],.55),hb=A.box(hc),h=hc.length?hb.getCenter(new T.Vector3()):p.clone(),hs=hb.getSize(new T.Vector3());
      var hoodTop=(hc.length?hb.max.y:p.y+.17)+.09,hoodBottom=(hc.length?hb.min.y:p.y-.13)-.06;
      var hood=G.shell(28,11,function(u,v){var a=.62+u*(TAU-1.24),r=Math.max(.14,hs.x*.55)*Math.sin(v*Math.PI*.75)+.012+Math.pow(v,4)*.065;return[h.x+Math.sin(a)*r,hoodTop+(hoodBottom-hoodTop)*v,h.z+Math.cos(a)*r-.013];},.003,false,true);
      G.uvScale(hood,.8,.8);G.fillWear(hood);A.rigid('rag',hood,head);
      var footY=Math.min(A.P('foot_l').y,A.P('foot_r').y),top=hip.y+.065,bottom=footY+.13,robeCloud=A.cloud(['pelvis','thigh_l','thigh_r','calf_l','calf_r'],['skin'],.25);
      function robeRadius(a,y){var best=0,fallback=0,score=Infinity;for(var k=0;k<robeCloud.length;k++){var q=robeCloud[k],dx=q.x-hip.x,dz=q.z-hip.z,r=Math.hypot(dx,dz),df=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-a),Math.cos(Math.atan2(dx,dz)-a))),dy=Math.abs(q.y-y);if(dy<.07&&df<.3)best=Math.max(best,r);var sc=dy*4+df*.2;if(sc<score){score=sc;fallback=r;}}return Math.max(.25,best||fallback)+.035;}
      var robe=G.shell(32,12,function(u,v){var gap=.12+v*.22,a=gap+u*(TAU-gap*2),fold=(Math.sin(a*7+v*2)*.033+Math.sin(a*13-v*3)*.009)*v*v,y=top+(bottom-top)*v,r=robeRadius(a,y)+v*.025+fold;return[hip.x+Math.sin(a)*r,y+Math.sin(a*9)*.018*v*v,hip.z+Math.cos(a)*r];},.003,false,true);
      G.uvScale(robe,.9,.9);G.wear(robe,{edge:0,border:0,cavity:0,curv:0,tear:{amount:.38,width:.025,bottom:.045,base:.012}});
      A.weighted('rag',robe,C.clothWeights(A,'pelvis','thigh_l','thigh_r',top,bottom,.65));
      ['l','r'].forEach(function(side){limbCover('rag','thigh_'+side,'calf_'+side,-.02,1.06,.025,.003,.006);limbCover('rag','calf_'+side,'foot_'+side,-.05,.94,.022,.003,.005);limbCover('rag','upperarm_'+side,'lowerarm_'+side,.06,.94,.024,.002,.018);limbCover('rag','lowerarm_'+side,'hand_'+side,.03,.82,.030,.002,.022);boot('foot_'+side,'ball_'+side);});
    });
    if(type==='forgesentinel')safe('sentinel articulated leg plates',function(){
      ['L','R'].forEach(function(side){
        var thigh='thigh'+side,shin='shin'+side,foot='tarsal'+side;
        limbCover('rag',thigh,shin,.16,.94,.020,.003,.010);
        limbCover('iron',shin,foot,.12,.82,.029,.009,.025);
        var knee=A.P(shin),plates=[];for(var j=0;j<2;j++){var g=G.extrude([[-.085,0],[.085,0],[.075,.10],[0,.14],[-.075,.10]],.018,.009);g.rotateX(-.12);g.translate(knee.x,knee.y-.04-j*.07,knee.z+.105);plates.push(plateWear(g,.22));}
        A.rigid('iron',G.merge(plates),shin);
        limbCover('iron',thigh,shin,.20,.52,.030,.008,.018);
      });
    });
    if(type==='emberbound'){
      safe('emberbound',function(){
        // iron hoops bound round the leather jerkin, a collar, a heated brand and one hot-iron pauldron
        lames('iron',3,fb.max.y-.10,.115,.05,.042,.008);
        var collar=G.tube([[chest.x-.19,chest.y+.21,chest.z],[chest.x-.10,chest.y+.27,chest.z-.10],[chest.x+.10,chest.y+.27,chest.z-.10],[chest.x+.19,chest.y+.21,chest.z]],.025,7,20,true);A.rigid('iron',collar,spine);
        var rivets=[];for(var i=0;i<7;i++)rivets.push(G.sphere(.017,[chest.x+(i%2?-.17:.17),chest.y+.16-i*.045,chest.z+.14],[1,.75,1],8,6));A.rigid('glow',G.merge(rivets),spine);
        var q=A.P(armL);A.rigid('iron',G.merge([plateWear(G.sphere(.15,arr(q.clone().add(V(0,.02,0))),[1.12,.5,1.05],12,6),.4),plateWear(G.sphere(.12,arr(q.clone().add(V(0,-.045,0))),[1.1,.45,1.0],12,6),.4)]),armL);
        A.rigid('glow',G.ring(.138,.007,arr(q.clone().add(V(0,-.015,0))),[0,0,0],5,26),armL);
        var br=fitted.at(0,chest.y+.01,.058);A.rigid('glow',G.ring(.05,.0075,br,[Math.PI/2,0,0],5,22),spine);
        // coiled slag-rag on the right shoulder
        var q2=A.P(armR);A.rigid('rag',G.sheet(10,6,function(u,v){var a=(u-.5)*2.4;return[q2.x+Math.sin(a)*(.13+v*.02),q2.y+.07-v*.18,q2.z+Math.cos(a)*(.11+v*.02)];},false,true),armR);
      });
    }
    if(type==='chainseer'){
      safe('chainseer',function(){
        A.rigid('iron',G.sphere(.115,arr(p.clone().add(V(0,.025,.07))),[.86,1.22,.5],16,10),head);
        // a hooded cowl behind the iron mask: a dark, tall silhouette instead of a bald head
        // The sewn cowl above is fitted to the head cloud and has an actual open face.
        var chains=[];for(var side=-1;side<=1;side+=2)for(var i=0;i<12;i++)chains.push(G.ring(.017,.005,[chest.x+side*.18,chest.y+.19-i*.035,chest.z+.16],[i%2?Math.PI/2:0,0,0],5,10));A.rigid('iron',G.merge(chains),spine);
        A.rigid('glow',G.box(.07,.008,.014,[p.x,p.y+.055,p.z+.134]),head);
        // heavy chain bandolier from shoulder to hip with a hot hook
        var band=[];for(var k=0;k<13;k++){var t=k/12;band.push(G.ring(.03,.008,fitted.at(-1.0+t*1.9,fb.max.y-.04-t*torsoH*.72,.05),[k%2?Math.PI/2:0,k%2?0:Math.PI/2,.4],4,9));}
        fitted.attach('iron',G.merge(band));
        var loops=[];for(var s=-1;s<=1;s+=2){for(var c=0;c<5;c++)loops.push(G.ring(.026,.007,[hip.x+s*.2,hip.y-.03-c*.06,hip.z+.05],[c%2?Math.PI/2:0,0,0],4,9));}
        A.rigid('iron',G.merge(loops),'pelvis');A.rigid('glow',G.merge([G.sphere(.032,[hip.x+.2,hip.y-.34,hip.z+.05],[1,1.2,1],8,6),G.sphere(.032,[hip.x-.2,hip.y-.34,hip.z+.05],[1,1.2,1],8,6)]),'pelvis');
      });
    }
    if(type==='slagcrawler'){
      safe('slagcrawler',function(){
        var creature=creatureCarapace(A,C,'iron',head,spine,handL,handR,fitted,true);
        // slag crust ridge down the spine, glowing cracks through arms and thighs: a burnt thing, not a bare man
        var ridge=[];for(var k=0;k<9;k++){var y=chest.y+.20-k*.065,base=V(chest.x,y,fb.min.z-.01),h2=.15-k*.011;ridge.push(G.spike(.034-k*.0019,base,base.clone().add(V(0,h2*.5,-h2))));}A.rigid('iron',G.merge(ridge),spine);
        var cracks=[];[[armL,.03],[armR,-.03]].forEach(function(e){cracks.push(seam(e[0],e[1],.007));});[[foreL,.028],[foreR,-.028]].forEach(function(e){cracks.push(seam(e[0],e[1],.006));});
        A.rigid('glow',G.merge(cracks.slice(0,1)),armL);A.rigid('glow',G.merge(cracks.slice(1,2)),armR);A.rigid('glow',G.merge(cracks.slice(2,3)),foreL);A.rigid('glow',G.merge(cracks.slice(3,4)),foreR);
        A.rigid('glow',seam(thighL,.04,.008),thighL);A.rigid('glow',seam(thighR,-.04,.008),thighR);
        // fire cracks across the burnt chest, belly and shoulders
        var fc=[];for(var m=0;m<5;m++){var a0=(m-2)*.55,pts=[];for(var j=0;j<5;j++)pts.push(fitted.at(a0+Math.sin(j*2.1+m*1.7)*.16,fb.max.y-.04-j*torsoH*.17,.02));fc.push(G.tube(pts,.0065,5,16,false));}
        fitted.attach('glow',G.merge(fc));
        // ember eyes
        if(creature){var eyeY=creature.box.min.y+creature.height*.58,eyes=[];for(var side=-1;side<=1;side+=2){var eye=creature.surface(side*.28,eyeY,.006);eyes.push(G.sphere(.009,eye,[1.6,.55,.65],8,5));}A.rigid('glow',G.merge(eyes),head);}
      });
    }
    if(armour){
      safe('armour',function(){
        // stacked shoulder plates + rolled head ring (kept from the base build), now with banded lames and hot trim
        [armL,armR].forEach(function(b){var q=A.P(b),plates=[];for(var i=0;i<3;i++)plates.push(plateWear(G.sphere(.14-i*.018,arr(q.clone().add(V(0,-i*.055,0))),[1.1,.5,1],12,6),.4));A.rigid('iron',G.merge(plates),b);});
        A.rigid('iron',G.ring(.135,.030,arr(p.clone().add(V(0,.11,0))),[Math.PI/2,0,0],8,24),head);
        var n=boss?6:elite?5:4;lames('iron',n,fb.max.y-.08,(torsoH-.14)/n,.105,.04,.016);
        if(!boss){   // furnace window across the breast: three glowing slits
          var slits=[];for(var i=0;i<3;i++){var q=fitted.at(0,chest.y+.10-i*.075,.07);slits.push(G.box(.2-i*.03,.013,.014,q));}A.rigid('glow',G.merge(slits),spine);
        }
      });
    }
    if(type==='forgesentinel'){
      safe('sentinel',function(){
        // a coal cage and flue on the back: the sentinel carries his own fire
        var cage=[G.ring(.13,.014,[fitted.cx,chest.y-.02,fb.min.z-.15],[Math.PI/2,0,0],6,20),G.ring(.13,.014,[fitted.cx,chest.y-.24,fb.min.z-.15],[Math.PI/2,0,0],6,20),G.ring(.10,.012,[fitted.cx,chest.y+.12,fb.min.z-.15],[Math.PI/2,0,0],6,20)];
        for(var i=0;i<6;i++){var a=i/6*TAU;cage.push(G.box(.016,.36,.016,[fitted.cx+Math.sin(a)*.12,chest.y-.06,fb.min.z-.15+Math.cos(a)*.12]));}
        cage.push(G.cyl(.045,.06,.36,10,[fitted.cx+.14,chest.y+.20,fb.min.z-.11]),G.cyl(.035,.05,.30,10,[fitted.cx-.15,chest.y+.17,fb.min.z-.11]));
        A.rigid('iron',G.merge(cage),spine);
        var coals=[];for(var ci=0;ci<7;ci++){var ca=ci*2.399,cr=ci?.045:0;coals.push(G.sphere(.032+.012*((ci*5)%3),[fitted.cx+Math.cos(ca)*cr,chest.y-.2+ci*.022,fb.min.z-.15+Math.sin(ca)*cr],[1,.8+.15*(ci%3),1.1],7,5));}
        // (visual-dark) heaped coals, not one smooth glowing ball
        A.rigid('glow',G.merge(coals.concat([G.ring(.042,.007,[fitted.cx+.14,chest.y+.385,fb.min.z-.11],[0,0,0],5,16)])),spine);
      });
    }
    if(elite){
      safe('ashwarden',function(){
        // curved horns, cloak of charred sailcloth, chain at the hip
        [-1,1].forEach(function(s){A.rigid('iron',G.tube([[p.x+s*.11,p.y+.06,p.z+.0],[p.x+s*.22,p.y+.12,p.z+.0],[p.x+s*.30,p.y+.30,p.z+.04],[p.x+s*.26,p.y+.46,p.z+.1]],function(t){return .036*(1-t*.82)+.004;},7,20,true),head);});
        var cloak=G.sheet(20,14,function(u,v){var across=(u-.5)*(bw*.95+v*.3);return[fitted.cx+across,fb.max.y-.04-v*1.0+Math.sin(u*23)*.04*v*v,fb.min.z-.04-.06*v+Math.sin(u*15+v*5)*.016];},true);G.uvScale(cloak,2.4,3);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.32,width:.025,bottom:.08,base:.015}});A.rigid('rag',cloak,spine);
        var ch=[];for(var c=0;c<9;c++)ch.push(G.ring(.03,.008,[hip.x-.22,hip.y-.02-c*.055,hip.z+.04],[c%2?Math.PI/2:0,0,0],5,10));A.rigid('iron',G.merge(ch),'pelvis');
        A.rigid('glow',G.merge([G.ring(.03,.007,[hip.x-.22,hip.y-.52,hip.z+.04],[Math.PI/2,0,0],5,12)]),'pelvis');
      });
    }
    if(boss){
      safe('furnaceheart',function(){
        var core=new T.Vector3().fromArray(fitted.at(0,chest.y+.03,.045));A.rigid('glow',G.sphere(.095,arr(core),[1,1.35,.45],16,12),spine);
        var cage=[G.ring(.13,.025,arr(core.clone().add(V(0,0,.018))),[0,0,0],8,28)];for(var i=-1;i<=1;i++)cage.push(G.box(.018,.24,.032,[core.x+i*.065,core.y,core.z+.04]));A.rigid('iron',G.merge(cage),spine);
        // exhaust fan: a crown of five flues rising behind the shoulders, hot at the mouth, plus a ring of hot spikes round the helm
        var pipes=[],mouths=[];
        for(var k=0;k<5;k++){var a=(k-2)*.42,base=V(fitted.cx+Math.sin(a)*.18,fb.max.y-.04,fb.min.z-.12),top=base.clone().add(V(Math.sin(a)*.28,.62+(k%2)*.12,-.12));pipes.push(G.tube([arr(base),arr(base.clone().lerp(top,.5).add(V(0,0,-.03))),arr(top)],.055-Math.abs(a)*.02,8,14,false));mouths.push(G.ring(.052-Math.abs(a)*.018,.01,arr(top),[Math.PI/2+Math.sin(a)*.5,0,0],5,14));}
        A.rigid('iron',G.merge(pipes),spine);A.rigid('glow',G.merge(mouths),spine);
        var hs=[];for(var h=0;h<8;h++){var ha=h/8*TAU,hb=p.clone().add(V(Math.sin(ha)*.12,.12,Math.cos(ha)*.12));hs.push(G.spike(.026,hb,hb.clone().add(V(Math.sin(ha)*.06,.20+(h%2)*.1,Math.cos(ha)*.06))));}
        A.rigid('glow',G.merge(hs),head);
        // molten seams down both arms and across the plates
        A.rigid('glow',seam(armL,.045,.01,.5),armL);A.rigid('glow',seam(armR,-.045,.01,.5),armR);A.rigid('glow',seam(foreL,.04,.009,.5),foreL);A.rigid('glow',seam(foreR,-.04,.009,.5),foreR);
        var cr=[];for(var m=0;m<5;m++){var a0=(m-2)*.42,pts=[];for(var j=0;j<6;j++)pts.push(fitted.at(a0+Math.sin(j*1.9+m*2.1)*.12,fb.max.y-.1-j*torsoH*.14,.062));cr.push(G.tube(pts,.007,5,18,false));}
        fitted.attach('glow',G.merge(cr));
        // belt of hanging chain and a slag-stained tabard
        var ch=[];for(var c=0;c<12;c++)ch.push(G.ring(.032,.009,[hip.x+.24,hip.y-.02-c*.06,hip.z+.05],[c%2?Math.PI/2:0,0,0],5,10));A.rigid('iron',G.merge(ch),'pelvis');
        var cloak=G.sheet(20,14,function(u,v){var across=(u-.5)*(bw*1.0+v*.34);return[fitted.cx+across,fb.max.y-.06-v*.9+Math.sin(u*23)*.04*v*v,fb.min.z-.34-.05*v+Math.sin(u*15+v*5)*.016];},true);G.uvScale(cloak,2.4,3);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.32,width:.025,bottom:.08,base:.015}});A.rigid('rag',cloak,spine);
      });
    }
    if(type==='chainseer')safe('covered thigh skin',function(){
      var knee=Math.max(A.P('calf_l').y,A.P('calf_r').y)+.035;
      function covered(q){return /^thigh_[lr]$/.test(q.bone)&&q.p.y<hip.y-.025&&q.p.y>knee;}
      A.trim(skin,function(a,b,c){return !(covered(a)&&covered(b)&&covered(c));});
    });
    var weapon;
    if(type==='chainseer'){weapon={parts:{iron:[G.cyl(.025,.035,1.08,10,[0,.40,0]),G.ring(.15,.026,[0,1.02,0],[0,0,0],8,24)],glow:[G.sphere(.045,[0,1.02,0],[1,1,1],10,8),G.ring(.15,.01,[0,1.02,0],[0,0,0],5,26),G.sphere(.03,[0,1.02,.14],[1,1,1],8,6)]},tip:new T.Vector3(0,1.2,0)};}
    else if(type==='forgesentinel'||type==='furnaceheart'){weapon={parts:{wood:[G.cyl(.04,.055,1.2,12,[0,.38,0])],iron:[C.forgedBlock(.52,.27,.25,[0,1.02,0],.052),C.forgedBlock(.42,.08,.29,[0,.87,0],.019),G.ring(.071,.012,[0,.80,0],[Math.PI/2,0,0],5,16)],glow:[G.box(.36,.02,.02,[0,1.10,.133]),G.box(.36,.02,.02,[0,.95,.133])]},tip:new T.Vector3(0,1.17,0)};}
    else if(type!=='slagcrawler'){weapon={parts:{iron:[C.forgedBlade(.98,.14,true),C.forgedBlock(.33,.05,.075,[0,.05,0],.010),G.cyl(.043,.048,.04,8,[0,-.27,0])],leather:[C.forgedGrip(.033,.25,-.255)],glow:[G.extrude([[-.008,.14],[.005,.14],[.018,.40],[.008,.60],[.012,.73],[.002,.68],[.0,.41]],.038,.001)]},tip:new T.Vector3(.20,.98,0)};}
    /* ajan:EN4 */ if(B.ForgeModels&&B.ForgeModels.ext&&B.ForgeModels.ext[type])safe('ext '+type,function(){var x=B.ForgeModels.ext[type]({A:A,C:C,G:G,T:T,V:V,arr:arr,materials:materials,fitted:fitted,fb:fb,bw:bw,torsoH:torsoH,p:p,chest:chest,hip:hip,head:head,spine:spine,handL:handL,handR:handR,armL:armL,armR:armR,foreL:foreL,foreR:foreR,thighL:thighL,thighR:thighR,limbCover:limbCover,boot:boot,lames:lames,seam:seam,plateWear:plateWear});if(x&&x.weapon)weapon=x.weapon;}); /* /ajan:EN4 */
    if(weapon)weapon.materials={iron:materials.iron,leather:materials.leather,glow:materials.glow};
    return {materials:materials,weapon:weapon};
  });}
  make('emberbound',{base:'ubc',height:2.35,radius:.47,motionType:'guard'});
  make('chainseer',{base:'ubc',height:2.55,radius:.45,motionType:'cultist'});
  make('slagcrawler',{base:'ubc',height:1.8,radius:.56,motionType:'stalker'});
  make('forgesentinel',{base:'executioner',height:2.90,radius:.72,motionType:'carrier'});
  make('ashwarden',{base:'executioner',height:3.15,radius:.82,motionType:'guard'});
  make('furnaceheart',{base:'executioner',height:4.2,radius:1.10,motionType:'boss'});
  B.ForgeModels={types:['emberbound','chainseer','slagcrawler','forgesentinel','ashwarden','furnaceheart'],glow:GLOW,make:make,ext:{}};
}());
