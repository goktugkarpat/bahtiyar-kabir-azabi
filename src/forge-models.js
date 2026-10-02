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
  var GLOW=[];   // emissive hot-iron materials the telegraph layer breathes (see telegraphs.js glowPulse)
  function make(type,cfg){cfg.chapter=4;B.Models.register(type,cfg,function(A,C){
    var exec=cfg.base==='executioner',head=exec?'head':'Head',spine=exec?'spine03':'spine_03',handL=exec?'handL':'hand_l',handR=exec?'handR':'hand_r',armL=exec?'upper_armL':'upperarm_l',armR=exec?'upper_armR':'upperarm_r',foreL=exec?'forearmL':'lowerarm_l',foreR=exec?'forearmR':'lowerarm_r',thighL=exec?'thighL':'thigh_l',thighR=exec?'thighR':'thigh_r';
    var skin=A.addFrom(C.bases[cfg.base],function(){return true;},'skin')[0];if(exec)A.remapBone('neutral_bone','pelvis');
    var p=A.P(head),chest=A.P(spine),hip=A.P('pelvis');
    if(type==='slagcrawler'){A.lengthen({lowerarm_l:1.4,lowerarm_r:1.4,hand_l:1.28,hand_r:1.28});var slim={};slim[spine]=.75;A.slim(skin,slim,1);}
    var fitted=torsoFit(A,exec,chest),fb=fitted.box,bw=Math.max(.34,fb.max.x-fb.min.x),torsoH=fb.max.y-fb.min.y;
    var armour=type==='forgesentinel'||type==='ashwarden'||type==='furnaceheart';
    var boss=type==='furnaceheart',elite=type==='ashwarden';
    var clothTint=type==='chainseer'?[.25,.10,.07]:boss?[.15,.12,.10]:elite?[.17,.12,.10]:[.19,.14,.10];
    var materials={
      skin:C.bodyMaterial(A.srcMaterial(exec?'Exec_mesh':'SuperHero_Male',C.bases[cfg.base]),'forge-'+type+'-skin',{cls:'skin',skin:1,skinMap:exec,tint:type==='slagcrawler'?[.44,.36,.30]:[.96,.72,.58],sat:.46,grime:type==='slagcrawler'?.7:.5,blood:.2,scale:9,fresh:true},{roughness:.76}),
      iron:C.bodyMaterial(C.gearMaterial('iron'),'forge-'+type+'-iron',{cls:'metal',tint:[.78,.66,.58],rust:.3,grime:.42,wear:.5,scale:8},{roughness:.66}),
      leather:C.bodyMaterial(C.gearMaterial('leather'),'forge-'+type+'-leather',{cls:'leather',tint:[.36,.24,.17],grime:.4,blood:.2,scale:8},{roughness:.92}),
      rag:C.bodyMaterial(C.gearMaterial('rag'),'forge-'+type+'-linen',{cls:'cloth',tear:true,sat:.3,tint:clothTint,grime:.46,blood:.16,scale:8},{roughness:.95,side:T.DoubleSide}),
      bone:C.bodyMaterial(C.gearMaterial('bone'),'forge-'+type+'-bone',{cls:'bone',tint:[.90,.77,.58],grime:.34,blood:.16,scale:10},{roughness:.78}),
      glow:C.bodyMaterial(C.gearMaterial('iron'),'forge-'+type+'-hot-iron',{cls:'metal',tint:[.69,.44,.26],rust:.2,grime:.3,wear:.6,scale:10},{color:new T.Color(0x4a2a1a),emissive:new T.Color(0xff6a22),emissiveIntensity:boss?1.5:1.05,roughness:.6,metalness:.5})
    };
    GLOW.push({mat:materials.glow,base:materials.glow.emissiveIntensity,type:type});
    function lames(key,count,top,gap,height,pad,flare){
      var list=[];
      for(var i=0;i<count;i++)(function(i){var yTop=top-i*gap;list.push(plateWear(G.shell(24,2,function(u,v){return fitted.at(u*TAU,yTop-v*height,pad+i*.004+v*flare);},.011,true,true),.38));})(i);
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
        var shell=G.sheet(32,14,function(u,v){return fitted.at(u*TAU,fb.max.y-.012-v*(fb.max.y-fb.min.y-.075),.028);},true,true);G.uvScale(shell,2.5,2);fitted.attach(armour?'iron':'leather',shell);
      });
      safe('apron',function(){
        var apron=G.sheet(20,15,function(u,v){return[hip.x+(u-.5)*(.42+v*.12),hip.y+.05-v*(type==='chainseer'?.62:.43)+Math.sin(u*17)*.04*v*v,hip.z+.21+Math.sin(u*12+v*5)*.01];},true);G.uvScale(apron,2.5,2);G.wear(apron,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.6,width:.045,bottom:.12,base:.03}});A.rigid('rag',apron,'pelvis');
      });
    }
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
        A.rigid('leather',G.sphere(.15,arr(p.clone().add(V(0,.035,-.03))),[1.05,1.22,1.12],14,10),head);
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
        var scales=[];for(var i=0;i<6;i++)scales.push(plateWear(G.sphere(.14,[chest.x,chest.y+.16-i*.073,chest.z-.14],[1.12,.55,.65],12,6),.4));A.rigid('iron',G.merge(scales),spine);
        var seams=[];for(var j=0;j<5;j++)seams.push(G.tube([[chest.x-.13,chest.y+.1-j*.075,chest.z-.13],[chest.x,chest.y+.11-j*.075,chest.z-.245],[chest.x+.13,chest.y+.1-j*.075,chest.z-.13]],.0085,6,12,true));A.rigid('glow',G.merge(seams),spine);
        [handL,handR].forEach(function(b){var h=A.P(b),claws=[];for(var j=0;j<4;j++){var q=h.clone().add(V((j-1.5)*.034,-.07,.03));claws.push(G.spike(.015,q,q.clone().add(V(0,-.13,.17))));}A.rigid('bone',G.merge(claws),b);});
        // slag crust ridge down the spine, glowing cracks through arms and thighs: a burnt thing, not a bare man
        var ridge=[];for(var k=0;k<9;k++){var y=chest.y+.20-k*.065,base=V(chest.x,y,fb.min.z-.01),h2=.15-k*.011;ridge.push(G.spike(.034-k*.0019,base,base.clone().add(V(0,h2*.5,-h2))));}A.rigid('iron',G.merge(ridge),spine);
        var cracks=[];[[armL,.03],[armR,-.03]].forEach(function(e){cracks.push(seam(e[0],e[1],.007));});[[foreL,.028],[foreR,-.028]].forEach(function(e){cracks.push(seam(e[0],e[1],.006));});
        A.rigid('glow',G.merge(cracks.slice(0,1)),armL);A.rigid('glow',G.merge(cracks.slice(1,2)),armR);A.rigid('glow',G.merge(cracks.slice(2,3)),foreL);A.rigid('glow',G.merge(cracks.slice(3,4)),foreR);
        A.rigid('glow',seam(thighL,.04,.008),thighL);A.rigid('glow',seam(thighR,-.04,.008),thighR);
        // fire cracks across the burnt chest, belly and shoulders
        var fc=[];for(var m=0;m<5;m++){var a0=(m-2)*.55,pts=[];for(var j=0;j<5;j++)pts.push(fitted.at(a0+Math.sin(j*2.1+m*1.7)*.16,fb.max.y-.04-j*torsoH*.17,.02));fc.push(G.tube(pts,.0065,5,16,false));}
        fitted.attach('glow',G.merge(fc));
        // ember eyes
        A.rigid('glow',G.merge([G.sphere(.014,[p.x-.032,p.y+.05,p.z+.082],[1.3,.8,.7],8,6),G.sphere(.014,[p.x+.032,p.y+.05,p.z+.082],[1.3,.8,.7],8,6)]),head);
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
        A.rigid('glow',G.merge([G.sphere(.075,[fitted.cx,chest.y-.13,fb.min.z-.15],[1,1.25,1],12,8),G.ring(.042,.007,[fitted.cx+.14,chest.y+.385,fb.min.z-.11],[0,0,0],5,16)]),spine);
      });
    }
    if(elite){
      safe('ashwarden',function(){
        // curved horns, cloak of charred sailcloth, chain at the hip
        [-1,1].forEach(function(s){A.rigid('iron',G.tube([[p.x+s*.11,p.y+.06,p.z+.0],[p.x+s*.22,p.y+.12,p.z+.0],[p.x+s*.30,p.y+.30,p.z+.04],[p.x+s*.26,p.y+.46,p.z+.1]],function(t){return .036*(1-t*.82)+.004;},7,20,true),head);});
        var cloak=G.sheet(20,14,function(u,v){var across=(u-.5)*(bw*.95+v*.3);return[fitted.cx+across,fb.max.y-.04-v*1.0+Math.sin(u*23)*.04*v*v,fb.min.z-.04-.06*v+Math.sin(u*15+v*5)*.016];},true);G.uvScale(cloak,2.4,3);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.7,width:.05,bottom:.22,base:.03}});A.rigid('rag',cloak,spine);
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
        var cloak=G.sheet(20,14,function(u,v){var across=(u-.5)*(bw*1.0+v*.34);return[fitted.cx+across,fb.max.y-.06-v*.9+Math.sin(u*23)*.04*v*v,fb.min.z-.34-.05*v+Math.sin(u*15+v*5)*.016];},true);G.uvScale(cloak,2.4,3);G.wear(cloak,{edge:0,cavity:0,border:0,curv:0,tear:{amount:.7,width:.05,bottom:.22,base:.03}});A.rigid('rag',cloak,spine);
      });
    }
    var weapon;
    if(type==='chainseer'){weapon={parts:{iron:[G.cyl(.025,.035,1.08,10,[0,.40,0]),G.ring(.15,.026,[0,1.02,0],[0,0,0],8,24)],glow:[G.sphere(.045,[0,1.02,0],[1,1,1],10,8),G.ring(.15,.01,[0,1.02,0],[0,0,0],5,26),G.sphere(.03,[0,1.02,.14],[1,1,1],8,6)]},tip:new T.Vector3(0,1.2,0)};}
    else if(type==='forgesentinel'||type==='furnaceheart'){weapon={parts:{wood:[G.cyl(.04,.055,1.2,12,[0,.38,0])],iron:[G.box(.52,.27,.25,[0,1.02,0]),G.box(.42,.08,.29,[0,.87,0])],glow:[G.box(.36,.02,.02,[0,1.10,.133]),G.box(.36,.02,.02,[0,.95,.133])]},tip:new T.Vector3(0,1.17,0)};}
    else if(type!=='slagcrawler'){weapon={parts:{iron:[G.extrude([[-.05,0],[.06,0],[.08,.70],[.28,.79],[.20,.98],[-.06,.94]],.055,.008),G.box(.33,.05,.075,[0,.05,0])],leather:[G.cyl(.03,.035,.25,10,[0,-.13,0])],glow:[G.box(.014,.6,.062,[.03,.43,0],[0,0,.04])]},tip:new T.Vector3(.20,.98,0)};}
    if(weapon)weapon.materials={iron:materials.iron,leather:materials.leather,glow:materials.glow};
    return {materials:materials,weapon:weapon};
  });}
  make('emberbound',{base:'ubc',height:2.35,radius:.47,motionType:'guard'});
  make('chainseer',{base:'ubc',height:2.55,radius:.45,motionType:'cultist'});
  make('slagcrawler',{base:'ubc',height:1.8,radius:.56,motionType:'stalker'});
  make('forgesentinel',{base:'executioner',height:2.90,radius:.72,motionType:'carrier'});
  make('ashwarden',{base:'executioner',height:3.15,radius:.82,motionType:'guard'});
  make('furnaceheart',{base:'executioner',height:4.2,radius:1.10,motionType:'boss'});
  B.ForgeModels={types:['emberbound','chainseer','slagcrawler','forgesentinel','ashwarden','furnaceheart'],glow:GLOW};
}());
