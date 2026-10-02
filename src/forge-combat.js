/* KIZIL OCAK — iron pistons, locked chain lanes and cooling pockets. */
(function(){
  'use strict';var B=window.BABA,TAU=Math.PI*2;
  B.ForgeCombat={stats:{
    emberbound:{name:'Kor Yeminlisi',hp:218,speed:2.65,radius:.47,reach:8,cooldown:1.65,color:0xbd845d,forge:true},
    chainseer:{name:'Zincir Kâhini',hp:191,speed:2.05,radius:.45,reach:14,cooldown:2.25,color:0xab947d,forge:true,ranged:true},
    slagcrawler:{name:'Cüruf Sürüngeni',hp:209,speed:3.15,radius:.56,reach:9,cooldown:1.75,color:0xa19476,forge:true},
    forgesentinel:{name:'Döküm Nöbetçisi',hp:315,speed:1.85,radius:.72,reach:11,cooldown:2.3,color:0xb99c7f,forge:true},
    ashwarden:{name:'Külün Baş Muhafızı',hp:1120,speed:2.2,radius:.82,reach:14,cooldown:1.9,color:0xc5a07a,forge:true,elite:true},
    furnaceheart:{name:'Ocağın Kalbi',hp:4100,speed:2.0,radius:1.10,reach:18,cooldown:1.25,color:0xd39b78,forge:true,boss:true}
  },create:function(api){
    function hit(at,warn,shape,r,dmg,pose,more){return Object.assign({at:at,warn:warn,shape:shape,radius:r,dmg:dmg,pose:pose,style:'ember',fill:'radial'},more||{});}
    function point(){return{x:api.player.x,z:api.player.z};}
    function cone(id,name,r,arc,dmg,at,pose){return{id:id,name:name,duration:at+.8,pose:pose,hits:[hit(at,at,'cone',r,dmg,pose,{arc:arc,style:'blade',fill:'sweep'})]};}
    function sweep(e,id,name,r,dmg){var m=cone(id,name,r,2.8,dmg,.9,'sweep');m.hits.push(hit(1.7,.8,'cone',r+.2,dmg-3,'sweepBack',{arc:2.5,face:e.face-.4,style:'chain',fill:'sweep',sweepDir:-1}));m.duration=2.5;return m;}
    function lanes(e,count){var hits=[];for(var i=0;i<count;i++){var a=e.face+(i-(count-1)/2)*.28;hits.push(hit(1.1+i*.28,1,'line',0,19,'hookSwing',{face:a,width:.8,length:api.clipLine(e,a,14),style:'chain',fill:'forward',beat:i===0,knockback:1.2}));}return{id:'chainLanes',name:'Zincir Tezgâhı',duration:1.9+count*.28,pose:'hookSwing',hits:hits};}
    function piston(e,count){var hits=[],origin={x:e.x,z:e.z};for(var i=0;i<count;i++){var a=e.face+(i%2?-.12:.12);hits.push(hit(1.05+i*.62,i?.62:1.05,'line',0,23,'overhead',{origin:origin,face:a,width:1.6,length:api.clipLine(e,a,11),style:'quake',fill:'forward',unblockable:true,beat:i===0}));}return{id:'piston',name:'Demir Pistonlar',duration:1.8+count*.62,pose:'overhead',hits:hits,cooldown:2.1};}
    function vents(e,count){var p=point(),hits=[];for(var i=0;i<count;i++){var a=e.face+i*TAU/count,origin={x:p.x+Math.sin(a)*2.8,z:p.z+Math.cos(a)*2.8};if(api.walkable(origin.x,origin.z,.5))hits.push(hit(1.35+i*.18,1.2,'circle',1.55,22,'castHigh',{origin:origin,style:'ember',unblockable:true,beat:i===0}));}return{id:'vents',name:'Kor Bacaları',duration:2.2+count*.18,pose:'castHigh',hits:hits,cooldown:2.0};}
    function bellows(e,r){return{id:'bellows',name:'Ocağın Nefesi',duration:2.0,pose:'roar',hits:[hit(1.2,1.2,'cone',r,24,'roar',{arc:1.25,style:'ember',fill:'forward',unblockable:true})]};}
    function leap(e){var p=point(),a=Math.atan2(p.x-e.x,p.z-e.z),end={x:p.x-Math.sin(a),z:p.z-Math.cos(a)};return{id:'slagLeap',name:'Kor Sıçrayışı',duration:2.15,pose:'crouch',movement:{start:1,duration:.30,fromX:e.x,fromZ:e.z,x:end.x,z:end.z,leap:true},hits:[hit(1.3,1.1,'circle',1.9,21,'leap',{origin:p,style:'ember',unblockable:true})]};}
    function crown(e,count){var hits=[],origin={x:e.x,z:e.z};for(var i=0;i<count;i++)hits.push(hit(1.35+i*.75,i?.75:1.35,'ring',4.8+i*2.9,23,'roar',{origin:origin,inner:2.5+i*2.9,arc:TAU,style:'ember',unblockable:true}));return{id:'furnaceCrown',name:'Kızıl Basınç',duration:2.0+count*.75,pose:'roar',hits:hits,cooldown:2.1};}

    // ---- round 7 ------------------------------------------------------------------------------------------------------------
    var core=null,self;
    function track(id){var m=B.Boss2&&B.Boss2.moves;if(m)m[id]=(m[id]||0)+1;}
    function cd(e,id,sec){var c=e.b2cd||(e.b2cd={});c[id]=(core?core.time:0)+sec;}
    function ready(e,id){return !e.b2cd||!(e.b2cd[id]>(core?core.time:0));}
    function at(p,o){return {x:p.x+Math.sin(o.a)*o.r,z:p.z+Math.cos(o.a)*o.r};}
    // Burning ground that starts as a hit with its own tell: the eruption (crimson line) and, right behind it, the lasting lane.
    function lane(hits,org,a,L,w,t,dmg,i,lasting,name){
      hits.push(hit(t,t,'line',0,dmg,'overhead',{origin:org,face:a,width:w,length:L,style:'quake',fill:'forward',unblockable:true,beat:i===0,attack:name,
        onActive:function(){api.fx('boss2Geyser',{x:org.x,z:org.z,face:a,length:L,width:w,forge:true});}}));
      hits.push(hit(t+.17,.3,'line',0,4,'overhead',{origin:org,face:a,width:w,length:L,persistent:true,periodic:true,interval:.8,duration:lasting,b2ground:true,style:'ember',fill:'forward',beat:false,near:false,attack:'Kor Seli'}));
    }
    // Lava geysers: parallel lanes across the hero's side of the court, then they keep burning.
    function lava(e,count,id,name,lasting){
      track(id);
      var p=point(),base=Math.atan2(p.x-e.x,p.z-e.z),hits=[],sp=3.4,cx=Math.cos(base),cz=-Math.sin(base);
      for(var i=0;i<count;i++){
        var off=(i-(count-1)/2)*sp,org={x:e.x+cx*off,z:e.z+cz*off};
        if(!api.walkable(org.x,org.z,.3)){org={x:e.x,z:e.z};}
        var L=api.clipLine(org,base,15);
        lane(hits,org,base,L,1.9,1.3+i*.14,e.phase>=3||e.elite?15:13,i,lasting,name);
      }
      return {id:id,name:name,duration:1.3+count*.14+1.2,pose:'overhead',hits:hits,cooldown:1.9};
    }
    // Molten chain whip: wedges of chain swing round the master like a windmill (all drawn from the start, they land in turn).
    function whip(e,n){
      track('chainWhip');
      var f0=e.face+.15,hits=[],gap=Math.PI*2/n;
      for(var i=0;i<n;i++){var t=1.1+i*.62;hits.push(hit(t,t,'cone',9.2,19,i%2?'sweepBack':'sweep',{arc:n>3?1.05:1.25,face:f0+i*gap*1.0+i*.0,style:'chain',fill:'sweep',sweepDir:i%2?-1:1,beat:true,unblockable:false}));}
      return {id:'chainWhip',name:'Erimiş Zincir Kırbacı',duration:1.1+n*.62+.8,pose:'chainWhip',hits:hits};
    }
    function orbs(e,n,hold){
      track('slagOrbs');
      for(var i=0;i<n;i++)core.orbs.spawn(e,{kind:'slag',hold:hold+i*.2,speed:e.phase>=3?4.2:3.8,turn:1.7,life:4.6,damage:5,name:'Cüruf Küresi',off:(i-(n-1)/2)*.75});
      return {id:'slagOrbs',name:'Cüruf Küreleri',duration:hold+.8+n*.2,pose:'castHigh',cooldown:1.5,hits:[hit(hold,hold,'ring',2,0,'castHigh',{origin:{x:e.x,z:e.z},inner:0,arc:TAU,harmless:true})]};
    }
    // Anvil slam: a leap onto the hero's spot, then two shock rings with a safe band between them.
    function anvil(e){
      track('anvilSlam');
      var p=point(),a=Math.atan2(p.x-e.x,p.z-e.z),end={x:p.x-Math.sin(a),z:p.z-Math.cos(a)};
      return {id:'anvilSlam',name:'Örs Sarsıntısı',duration:3.5,pose:'crouch',movement:{start:.95,duration:.34,fromX:e.x,fromZ:e.z,x:end.x,z:end.z,leap:true},hits:[
        hit(1.3,1.3,'circle',2.4,22,'leap',{origin:p,style:'quake',fill:'inward',unblockable:true,scar:true}),
        hit(2.0,2.0,'ring',6.4,17,'overhead',{origin:p,inner:4.3,arc:TAU,style:'quake',fill:'radial',unblockable:true,beat:false,attack:'Örs Sarsıntısı · birinci'}),
        hit(2.7,2.7,'ring',10.6,15,'overhead',{origin:p,inner:8.4,arc:TAU,style:'quake',fill:'radial',unblockable:true,beat:false,attack:'Örs Sarsıntısı · ikinci'})]};
    }
    // The furnace clock: the court is cut in four wedges; one (phase 3) or two (phase 2) stay safe, the safe wedge turns clockwise.
    function clock(e){
      track('furnaceClock');
      var c=core.arena,p=point(),a0=Math.atan2(p.x-c.x,p.z-c.z),safe=((Math.round(a0/(Math.PI/2))%4)+4)%4,steps=e.phase>=3?4:3,hits=[],P2=e.phase<3;
      cd(e,'furnaceClock',e.phase>=3?18:22);
      for(var j=0;j<steps;j++){
        var t=1.7+j*1.5,warn=j?1.25:1.7,s=(safe+j)%4;
        for(var q=0;q<4;q++){
          var isSafe=P2?(q===s||q===(s+2)%4):q===s;
          if(isSafe)continue;
          hits.push(hit(t,warn,'ring',22,16,'roar',{origin:{x:c.x,z:c.z},inner:0,arc:Math.PI/2,face:q*Math.PI/2,style:'blunt',fill:'radial',unblockable:true,beat:j===0&&hits.length===0,attack:'Ocağın Saati',scar:false}));
        }
      }
      return {id:'furnaceClock',name:'Ocağın Saati',duration:1.7+steps*1.5+.8,pose:'roar',hits:hits,cooldown:1.4};
    }
    // Fire-trail dash: a crimson charge along a line, the line keeps burning behind him.
    function dash(e,d,id,name){
      track(id);
      var f=e.face,L=api.clipLine(e,f,Math.min(16,d+4)),run=Math.max(1,L-1.5);
      while(run>1.5&&!api.walkable(e.x+Math.sin(f)*run,e.z+Math.cos(f)*run,e.radius))run-=.5;
      var end={x:e.x+Math.sin(f)*run,z:e.z+Math.cos(f)*run};
      return {id:id,name:name,duration:2.5,pose:'charge',movement:{start:1.15,duration:.4,fromX:e.x,fromZ:e.z,x:end.x,z:end.z},hits:[
        hit(1.15,1.15,'line',0,19,'charge',{face:f,width:2.3,length:L,style:'blunt',fill:'forward',unblockable:true,knockback:2.2,duration:.5}),
        hit(1.55,.3,'line',0,4,'charge',{face:f,width:2.0,length:L,persistent:true,periodic:true,interval:.7,duration:4.2,b2ground:true,style:'ember',fill:'forward',beat:false,near:false,attack:'Kor İzi'})]};
    }
    // Add wave: two gold circles, the dormant thralls of the furnace climb out (forced after every phase change).
    function call(e){
      track('furnaceCall');
      var p=point(),hits=[],found=0,have=core?core.freeReserve(e):0;
      for(var k=0;k<(e.phase>=3?2:1)&&k<have;k++){
        for(var tries=0;tries<8;tries++){
          var o=at(e,{a:e.face+(k?1:-1)*(1.1+tries*.22),r:6.5+tries*.4});
          if(core.inArena(o,3)&&api.walkable(o.x,o.z,.7)&&Math.hypot(o.x-p.x,o.z-p.z)>3.4){
            (function(o){hits.push(hit(1.4,1.4,'circle',2.3,14,'roar',{origin:o,style:'ember',beat:found===0,attack:'Ocaktan Gelenler',onActive:function(){core.summon(e,o.x,o.z);}}));}(o));found++;break;}
        }
      }
      if(!found)hits.push(hit(1.0,1.0,'ring',3,0,'roar',{origin:{x:e.x,z:e.z},inner:0,arc:TAU,harmless:true}));
      return {id:'furnaceCall',name:'Ocağın Çağrısı',duration:2.6,pose:'roar',hits:hits,cooldown:1.2};
    }
    return self={attach:function(c){core=c;if(c.chapter===4)c.hooks.push({tick:function(){self.tick();}});},
      tick:function(){
        var list=core.ext.enemies,hz=core.ext.hazards,clockOn=false;
        for(var c=0;c<list.length;c++){
          var ce=list[c];if(ce.dead||!ce.action||ce.action.moveId!=='furnaceClock')continue;
          var best=9,deadly=[false,false,false,false],j;
          for(j=0;j<hz.length;j++){var h=hz[j];if(h.owner===ce&&h.moveId==='furnaceClock'&&!h.active&&h.age>=0&&h.warn-h.age<best)best=h.warn-h.age;}
          if(best<9){
            for(j=0;j<hz.length;j++){var g=hz[j];if(g.owner===ce&&g.moveId==='furnaceClock'&&!g.active&&g.age>=0&&g.warn-g.age<best+.06)deadly[((Math.round(g.face/(Math.PI/2))%4)+4)%4]=true;}
            var shown=0,ar=core.arena;
            for(var q=0;q<4&&shown<2;q++)if(!deadly[q]){core.fanSet(shown,ar.x,ar.z,21,q*Math.PI/2-Math.PI/4,q*Math.PI/2+Math.PI/4);shown++;}
            for(;shown<2;shown++)core.fans[shown].visible=false;
            clockOn=true;
          }
        }
        if(!clockOn&&core.fans[0].visible)core.fanHide();
        // (embers over the overheated master)
        for(var i=0;i<list.length;i++){var e=list[i];
          if(e.dead||!e.overheat||!e.active)continue;
          if(core.time-(e.b2fx||0)>.14&&B.Boss2.out&&B.Boss2.out.emit){e.b2fx=core.time;var a=Math.random()*TAU;B.Boss2.out.emit(e.x+Math.sin(a)*.9,.3+Math.random()*2.2,e.z+Math.cos(a)*.9,4,[3.2,1.1,.3],0,.8,0,.7,.1);}
        }
      },
      attack:function(e,d){var list=[];
      if(e.type==='emberbound')list=[
        {id:'coalSweep',ok:d<4,w:4,move:function(){return sweep(e,'coalSweep','Kor Biçişi',3.6,18);}},
        {id:'bellows',sp:1,ok:d>2&&d<7,w:2,move:function(){return bellows(e,6.5);}},
        {id:'coalHeel',ok:d<2.3,w:2,move:function(){var m=cone('coalHeel','Kızgın Tekme',2.9,1.8,15,.65,'kick');m.hits[0].knockback=2.4;return m;}}
      ];
      else if(e.type==='chainseer')list=[
        {id:'chainLanes',ok:d>3&&d<14,w:4,move:function(){return lanes(e,3);}},
        {id:'chainTouch',ok:d<3.7,w:3,move:function(){return cone('chainTouch','Zincir Halkası',3.3,2.2,16,.72,'chainLash');}},
        {id:'vents',sp:1,ok:d<13,w:2,move:function(){return vents(e,3);}}
      ];
      else if(e.type==='slagcrawler')list=[
        {id:'slagBite',ok:d<3.3,w:4,move:function(){var m=cone('slagBite','Cüruf Çenesi',3,1.7,18,.68,'clawR');m.hits.push(hit(1.25,.55,'cone',3.1,12,'clawL',{arc:1.5,face:e.face+.25,style:'blade',fill:'sweep',sweepDir:-1}));m.duration=2;return m;}},
        {id:'slagLeap',sp:1,ok:d>3&&d<9,w:3,move:function(){return leap(e);}},
        {id:'slagTail',ok:d<5,w:2,move:function(){return{id:'slagTail',name:'Cüruf Kuyruğu',duration:2.0,pose:'sweep',hits:[hit(1.05,1.05,'ring',4.6,15,'sweep',{inner:1.9,arc:TAU,style:'chain',fill:'sweep'})]};}}
      ];
      else if(e.type==='forgesentinel')list=[
        {id:'ironHammer',ok:d<5,w:4,move:function(){return cone('ironHammer','Döküm Çekici',4.7,2.0,25,1.05,'overhead');}},
        {id:'piston',sp:1,ok:d>3&&d<11,w:3,move:function(){return piston(e,3);}},
        {id:'vents',sp:1,ok:d<8,w:2,move:function(){return vents(e,4);}}
      ];
      else if(e.type==='ashwarden')list=[
        {id:'wardenForge',ok:d<5.5,w:4,move:function(){return sweep(e,'wardenForge','Kül Antlaşması',5.1,25);}},
        {id:'chainLanes',sp:1,ok:d>4&&d<14,w:3,move:function(){return lanes(e,5);}},
        {id:'piston',sp:1,ok:d<11,w:2,move:function(){return piston(e,2);}},
        {id:'bellows',sp:1,ok:d<8,w:2,move:function(){return bellows(e,7.5);}},
        {id:'ashLava',sp:1,ok:!!core&&d<14&&core.groundCount()<4,w:3,move:function(){return lava(e,2,'ashLava','Kül Fışkırması',4);}},
        {id:'ashDash',sp:1,ok:!!core&&d>3&&d<12&&ready(e,'ashDash')&&core.groundCount()<5,w:2.5,move:function(){cd(e,'ashDash',12);return dash(e,d,'ashDash','Kül İzi Hücumu');}}
      ];
      else if(e.type==='furnaceheart')list=[
        {id:'furnaceHammer',ok:d<6.7,w:4,move:function(){var m=cone('furnaceHammer','Ocağın Çekici',6.2,3.1,30,1.02,'overhead');if(e.phase>=2){m.hits.push(hit(1.95,.93,'circle',2.6,24,'overhead',{origin:point(),style:'quake',unblockable:true}));m.duration=2.8;}if(e.phase>=3){m.hits.push(hit(2.85,.75,'cone',3.4,14,'kick',{arc:2.4,face:e.face,style:'blunt',fill:'forward'}));m.duration=3.5;}return m;}},
        {id:'chainWhip',ok:!!core&&d<12,w:2,move:function(){return whip(e,e.phase>=3?4:3);}},
        {id:'furnaceCrown',sp:1,ok:d<17,w:2,move:function(){return crown(e,e.phase>=3?3:2);}},
        {id:'piston',sp:1,ok:d>3&&d<15,w:2,move:function(){return piston(e,e.phase>=2?4:2);}},
        {id:'vents',sp:1,ok:d<16,w:2,move:function(){return vents(e,e.phase>=3?6:4);}},
        {id:'lavaLanes',sp:1,ok:!!core&&d<16&&core.groundCount()<4,w:2,move:function(){return lava(e,e.phase>=3?4:3,'lavaLanes','Lav Fışkırması',4);}},
        {id:'slagOrbs',sp:1,ok:!!core&&d<17&&core.orbs.free()>=2,w:2,move:function(){return orbs(e,2,1.1);}},
        {id:'anvilSlam',sp:1,ok:!!core&&d>2.5&&d<14&&ready(e,'anvilSlam'),w:2.5,move:function(){cd(e,'anvilSlam',12);return anvil(e);}},
        {id:'furnaceClock',sp:1,ok:!!core&&e.phase>=2&&ready(e,'furnaceClock'),w:2.5,move:function(){return clock(e);}},
        {id:'overheatDash',sp:1,ok:!!core&&e.phase>=3&&d>3.5&&d<16&&ready(e,'overheatDash')&&core.groundCount()<5,w:2.5,move:function(){cd(e,'overheatDash',12);return dash(e,d,'overheatDash','Kor İzi Hücumu');}},
        {id:'furnaceCall',sp:1,ok:false,w:1,move:function(){return call(e);}},
        {id:'bellows',ok:d>2&&d<9,w:2,move:function(){return bellows(e,9);}},
        {id:'furnaceKick',ok:d<2.5,w:2,move:function(){return cone('furnaceKick','Demir Topuk',3.2,2.5,18,.72,'kick');}}
      ];return api.pick(e,list);},
      phase:function(e){if(!e.boss||e.dead)return;var f=e.hp/e.maxHp,next=f<.25?3:f<.60?2:1;if(next<=e.phase)return;e.phase=next;e.enraged=next===3;e.action=null;e.stagger=0;e.faceLocked=false;api.cancelHazards(e,false);if(core){var hz=core.ext.hazards;for(var i=hz.length-1;i>=0;i--)if(hz[i].b2ground&&hz[i].owner===e&&!hz[i].active)hz.splice(i,1);}e.forceMove='furnaceCall';if(next===3){e.overheat=true;api.fx('boss2Overheat',{x:e.x,z:e.z});}api.bonus(e.x,e.z,2);api.emit('warning',{x:e.x,z:e.z,text:next===2?'OCAK BASINCI YÜKSELİYOR':'SON DÖKÜM'});api.sound('bossPhase');api.fx('bossPhase',{x:e.x,y:1.5,z:e.z,phase:next});api.emit('impact',{x:e.x,z:e.z,strength:1,radius:9});api.beginMove(e,{id:'roar',name:'Kızıl Ant',duration:2.2,pose:'roar',hits:[hit(1.3,1.3,'ring',5,0,'roar',{inner:0,arc:TAU,harmless:true})]});}
    };
  }};
}());
