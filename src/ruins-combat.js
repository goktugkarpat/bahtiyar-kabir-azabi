/* KÜL HARABELERİ — locked warnings, distinct cave/ruin attacks, shared contact rules. */
(function () {
  'use strict';
  var B = window.BABA, TAU = Math.PI * 2;
  B.RuinsCombat = {
    stats: {
      ashbound: { name: 'Kül Yeminlisi', hp: 184, speed: 2.55, radius: .46, reach: 7, cooldown: 1.6, color: 0xb88b63, ruins: true },
      shardseer: { name: 'Kırık Kehanetçi', hp: 163, speed: 2.0, radius: .44, reach: 13, cooldown: 2.15, color: 0x928cd0, ruins: true, ranged: true },
      cavefang: { name: 'Mağara Çenesi', hp: 174, speed: 3.3, radius: .54, reach: 9, cooldown: 1.7, color: 0xc9bca2, ruins: true },
      gravemason: { name: 'Mezar Örücüsü', hp: 266, speed: 1.8, radius: .69, reach: 10, cooldown: 2.2, color: 0xa6907c, ruins: true },
      ruinwarden: { name: 'Harabe Muhafızı', hp: 940, speed: 2.25, radius: .78, reach: 13, cooldown: 1.8, color: 0xc5a372, ruins: true, elite: true },
      hollowking: { name: 'Oyukların Kralı', hp: 3200, speed: 2.05, radius: 1.05, reach: 17, cooldown: 1.2, color: 0xc2a0a3, ruins: true, boss: true }
    },
    create: function (api) {
      function hit(at, warn, shape, radius, damage, pose, extra) { return Object.assign({at:at,warn:warn,shape:shape,radius:radius,dmg:damage,pose:pose,style:'blade',fill:'radial'},extra||{}); }
      function point() { return {x:api.player.x,z:api.player.z}; }
      function cone(id,name,radius,arc,damage,at,pose) { return {id:id,name:name,duration:at+.75,pose:pose,hits:[hit(at,at,'cone',radius,damage,pose,{arc:arc,fill:'sweep',sweepDir:1})]}; }
      function fissures(e,count,name) {
        var p=point(),hits=[];
        for(var i=0;i<count;i++){var a=e.face+(i-(count-1)/2)*.38;hits.push(hit(1.15+i*.3,1.05,'line',0,20,'castHigh',{face:a,width:1.15,length:api.clipLine(e,a,12),style:'root',fill:'forward',unblockable:true,beat:i===0}));}
        hits.push(hit(1.9,1.25,'circle',2.1,22,'castHigh',{origin:p,style:'fall',unblockable:true}));
        return {id:'fissures',name:name,duration:2.9,pose:'castHigh',hits:hits,cooldown:2};
      }
      function shards(e,count) {
        var hits=[];for(var i=0;i<count;i++){var a=e.face+(i-(count-1)/2)*.20;hits.push(hit(.95+i*.22,.85,'line',0,15,'throw',{face:a,width:.65,length:api.clipLine(e,a,12),style:'shadow',fill:'forward',projectile:{kind:'spur',flight:.2,fromY:1.6},beat:i===0}));}
        return {id:'shards',name:'Kırık Kehanet',duration:1.8+count*.22,pose:'throw',hits:hits};
      }
      function fall(e,count) {
        var p=point(),hits=[];for(var i=0;i<count;i++){var a=e.face+i*2.399,origin=i?{x:p.x+Math.sin(a)*3.2,z:p.z+Math.cos(a)*3.2}:p;if(api.walkable(origin.x,origin.z,.5))hits.push(hit(1.3+i*.3,1.1,'circle',1.65,24,'castHigh',{origin:origin,style:'fall',unblockable:true,beat:i===0}));}
        return {id:'fall',name:'Çöken Tavan',duration:2.4+count*.3,pose:'castHigh',hits:hits,cooldown:2};
      }
      function rings(e,count) {
        var hits=[],origin={x:e.x,z:e.z};for(var i=0;i<count;i++)hits.push(hit(1.3+i*.65,i?.65:1.3,'ring',4.5+i*2.7,22,'roar',{origin:origin,inner:2+i*2.7,arc:TAU,style:'shadow',unblockable:true}));
        // Resonance (phase 2+): the pulse bursts every standing crystal pillar near the king; each one shows a gold circle first.
        if(core&&e.type==='hollowking'&&e.phase>=2){
          var last=hits[hits.length-1];
          core.pillars.list.forEach(function(p){
            if(p.state!==2||Math.hypot(p.x-e.x,p.z-e.z)>9)return;
            hits.push(hit(last.at,last.at,'circle',2.5,12,'roar',{origin:{x:p.x,z:p.z},style:'fall',beat:false,unblockable:false,attack:'Rezonans · sütun',onActive:function(){core.pillars.shatter(p,'pulse');}}));
          });
        }
        return {id:'hollowPulse',name:'Oyukların Nabzı',duration:2+count*.65,pose:'roar',hits:hits,cooldown:2};
      }
      function leap(e) {
        var p=point(),a=Math.atan2(p.x-e.x,p.z-e.z),d=Math.hypot(p.x-e.x,p.z-e.z),end={x:p.x-Math.sin(a)*Math.min(1,d),z:p.z-Math.cos(a)*Math.min(1,d)};
        return {id:'caveLeap',name:'Tavandan Sıçrayış',duration:2.1,pose:'crouch',movement:{start:.95,duration:.28,fromX:e.x,fromZ:e.z,x:end.x,z:end.z,leap:true},hits:[hit(1.23,1.0,'circle',2,20,'leap',{origin:p,style:'shadow',unblockable:true})]};
      }

      // ---- round 7 ----------------------------------------------------------------------------------------------------------
      var core=null;
      function track(id){var m=B.Boss2&&B.Boss2.moves;if(m)m[id]=(m[id]||0)+1;}
      function cd(e,id,sec){var c=e.b2cd||(e.b2cd={});c[id]=(core?core.time:0)+sec;}
      function ready(e,id){return !e.b2cd||!(e.b2cd[id]>(core?core.time:0));}
      function at(p,o){return {x:p.x+Math.sin(o.a)*o.r,z:p.z+Math.cos(o.a)*o.r};}
      // Gap closer: a straight crimson charge (phase 3 ends with a sweep).
      function rush(e,d){
        track('kingRush');
        var f=e.face,L=api.clipLine(e,f,Math.min(15,d+2.5)),run=Math.max(1,L-1.6);
        while(run>1.5&&!api.walkable(e.x+Math.sin(f)*run,e.z+Math.cos(f)*run,e.radius))run-=.5;
        var end={x:e.x+Math.sin(f)*run,z:e.z+Math.cos(f)*run},hits=[hit(1.1,1.1,'line',0,20,'charge',{face:f,width:2.4,length:L,style:'blunt',fill:'forward',unblockable:true,knockback:2.4,duration:.5})];
        if(e.phase>=3)hits.push(hit(2.1,.75,'cone',4.4,18,'sweep',{origin:end,arc:2.6,face:f,style:'blade',fill:'sweep',sweepDir:1}));
        return {id:'kingRush',name:'Taht Hücumu',duration:e.phase>=3?2.9:2.3,pose:'charge',movement:{start:1.1,duration:.42,fromX:e.x,fromZ:e.z,x:end.x,z:end.z},hits:hits};
      }
      // Crystal star: lines of crystal burst through the hero's spot one after the other (all of them are drawn from the start).
      function star(e,n,id,name){
        track(id);
        var p=point(),base=e.face+.4+(e.seed%7)*.09,hits=[];
        for(var i=0;i<n;i++){
          var a=base+i*Math.PI/n,lf=api.clipLine(p,a,9),lb=api.clipLine(p,a+Math.PI,9),org={x:p.x-Math.sin(a)*lb,z:p.z-Math.cos(a)*lb},t=1.25+i*.42;
          (function(org,a,len){
            hits.push(hit(t,1.25,'line',0,e.phase>=3?18:16,'castHigh',{origin:org,face:a,width:1.5,length:len,style:'root',fill:'forward',beat:i===0,unblockable:e.phase>=3,
              onActive:function(){api.fx('boss2Shards',{x:org.x,z:org.z,face:a,length:len,width:1.5});}}));
          }(org,a,lf+lb));
        }
        return {id:id,name:name,duration:1.25+n*.42+.9,pose:'castHigh',hits:hits,cooldown:1.7};
      }
      function orbs(e,n,hold,name){
        track('orbs');
        for(var i=0;i<n;i++)core.orbs.spawn(e,{kind:'arc',hold:hold+i*.18,speed:e.phase>=3?4.5:4.2,turn:1.3,damage:6,name:name,off:(i-(n-1)/2)*.8});
        return {id:e.boss?'orbs':'wardenOrb',name:name,duration:hold+.8+n*.18,pose:'castHigh',cooldown:1.5,hits:[hit(hold,hold,'ring',2,0,'castHigh',{origin:{x:e.x,z:e.z},inner:0,arc:TAU,harmless:true,style:'shadow'})]};
      }
      // Channelled nova: hide behind a crystal pillar (it takes the blast and shatters) or roll through the burst.
      function nova(e){
        track('hollowNova');
        var T=e.phase>=3?2.8:3.4,o={x:e.x,z:e.z};core.novaBegin(e);cd(e,'hollowNova',e.phase>=3?17:21);
        return {id:'hollowNova',name:'Sessiz Nova',duration:T+1.5,pose:'roar',cooldown:1.3,hits:[
          hit(.85,.85,'ring',3,0,'roar',{origin:o,inner:0,arc:TAU,harmless:true,style:'shadow'}),
          hit(T,T,'circle',Math.hypot(core.arena.w,core.arena.d),0,'roar',{origin:o,style:'blunt',tellGain:.55,fill:'inward',unblockable:true,hit:true,attack:'Sessiz Nova',onActive:function(){core.novaResolve(e,e.phase>=3?32:28,'Sessiz Nova');}})]};
      }
      // Burrow: the king sinks, travels under the floor and bursts up where the hero stood (circle first, then a debris ring).
      function burrow(e,mini){
        track(mini?'wardenBurrow':'hollowBurrow');
        var p=point(),warn=mini?1.3:1.55,end=api.walkable(p.x,p.z,e.radius)?p:{x:e.x,z:e.z},hits=[
          hit(warn,warn,'circle',mini?2.5:2.9,mini?20:26,'overhead',{origin:p,style:'fall',fill:'inward',unblockable:true,scar:true,onActive:function(){api.fx('boss2Burrow',{x:end.x,z:end.z,emerge:true});}})];
        if(!mini)hits.push(hit(warn+.6,warn+.6,'ring',6.4,17,'overhead',{origin:p,inner:2.9,arc:TAU,style:'quake',fill:'radial',beat:false,attack:'Oyuktan Fırlayan Taşlar'}));
        cd(e,mini?'wardenBurrow':'hollowBurrow',mini?13:22);
        return {id:mini?'wardenBurrow':'hollowBurrow',name:mini?'Kazıp Çıkış':'Oyuğa Gömülüş',duration:warn+(mini?1.0:1.5),pose:'crouch',
          movement:{start:.55,duration:.45,fromX:e.x,fromZ:e.z,x:end.x,z:end.z},hits:hits,onBegin:function(a,timing){var scale=timing?timing.scale:1,shift=timing?timing.shift:0;a.burrow={from:shift+.5*scale,to:shift+(warn-.04)*scale,dived:false};}};
      }
      // Echoes (phase 3): shadow columns of the king step out around the hero and swing one after another, then the king himself.
      function echo(e){
        track('hollowEcho');
        var p=point(),base=e.face+(e.seed%5)*.4,hits=[],n=0;
        for(var i=0;i<3;i++){
          var a=base+i*TAU/3,r=4.6,o=at(p,{a:a,r:r});if(!api.walkable(o.x,o.z,.5)){r=3.3;o=at(p,{a:a,r:r});if(!api.walkable(o.x,o.z,.5))continue;}
          var t=1.3+n*.55,f=Math.atan2(p.x-o.x,p.z-o.z);n++;
          api.fx('boss2Echo',{x:o.x,z:o.z});
          hits.push(hit(t,t,'cone',5.6,15,'sweep',{origin:o,face:f,arc:1.25,style:'blade',fill:'sweep',sweepDir:i%2?-1:1,beat:n===1}));
        }
        hits.push(hit(1.3+n*.55+.25,.95,'cone',6.2,24,'sweep',{arc:3.2,fill:'sweep',sweepDir:1}));
        cd(e,'hollowEcho',20);
        return {id:'hollowEcho',name:'Yankı Hükmü',duration:1.3+n*.55+1.5,pose:'sweep',hits:hits};
      }
      // Add wave: two gold circles open in the floor, the dormant foes of the court climb out (forced after every phase change).
      function call(e){
        track('hollowCall');
        cd(e, 'hollowCall', (e.phase >= 3 ? 17 : e.phase >= 2 ? 20 : 24) * (core.ext.game.difficulty === 'easy' ? 1.25 : 1)); e.spWait = 1; e.spStreak = 0;
        var p=point(),hits=[],found=0,have=core?core.freeReserve(e):0;
        for(var k=0;k<(e.phase>=2?2:1)&&k<have;k++){
          for(var tries=0;tries<8;tries++){
            var o=at(e,{a:e.face+(k?1:-1)*(1.1+tries*.22),r:6.5+tries*.4});
            if(core.inArena(o,3)&&api.walkable(o.x,o.z,.7)&&Math.hypot(o.x-p.x,o.z-p.z)>3.4){
              (function(o){hits.push(hit(1.4,1.4,'circle',2.3,14,'roar',{origin:o,style:'fall',beat:found===0,attack:'Oyuktan Gelenler',onActive:function(){core.summon(e,o.x,o.z);}}));}(o));found++;break;}
          }
        }
        if(!found)hits.push(hit(1.0,1.0,'ring',3,0,'roar',{origin:{x:e.x,z:e.z},inner:0,arc:TAU,harmless:true,style:'shadow'}));
        track('hollowCallWave');
        return {id:'hollowCall',name:'Oyukların Çağrısı',duration:2.6,pose:'roar',hits:hits,cooldown:1.2};
      }
      var self;
      return self={
        attach:function(c){core=c;if(c.chapter===3)c.hooks.push({tick:function(){self.tick();}});},
        attack:function(e,d){
          // A phase vow schedules one authored wave; consume it after the roar instead of silently losing it.
          // Calls are deliberate pressure beats; no new wave while orbs, a nova or burning lanes already occupy the court.
          if (core && e.boss && !e.dead && core.freeReserve(e) > 0 && core.orbs.count() === 0 && core.groundCount() === 0 && !core.nova.on && (e.forceMove === 'hollowCall' || e.b2 && e.b2.t >= 12 && ready(e, 'hollowCall'))) { e.forceMove = null; return api.beginMove(e, call(e)); }
          if (e.forceMove === 'hollowCall' && core && core.freeReserve(e) === 0) e.forceMove = null;
          var list=[];
          if(e.type==='ashbound')list=[
            {id:'ashCut',ok:d<3.7,w:4,move:function(){var m=cone('ashCut','Kül Biçişi',3.4,2.4,16,.75,'sweep');m.hits.push(hit(1.4,.6,'cone',3.5,13,'sweepBack',{arc:2,face:e.face+.5,fill:'sweep',sweepDir:-1}));m.duration=2.05;return m;}},
            {id:'ashThrust',ok:d>1.7&&d<4.2,w:2,move:function(){return {id:'ashThrust',name:'Yemin Dürtüşü',duration:1.4,pose:'thrust',hits:[hit(.72,.72,'line',0,14,'thrust',{width:1.0,length:4,style:'thrust',fill:'forward'})]};}},
            {id:'ashTrail',sp:1,ok:d<8,w:2,move:function(){return fissures(e,1,'Kül Yolu');}}
          ];
          else if(e.type==='shardseer')list=[
            {id:'shards',ok:d>3&&d<13,w:4,move:function(){return shards(e,3);}},
            {id:'stoneTouch',ok:d<3.7,w:3,move:function(){return cone('stoneTouch','Kırık Asa',3.2,1.9,14,.7,'clawR');}},
            {id:'fall',sp:1,ok:d<12,w:2,move:function(){return fall(e,3);}}
          ];
          else if(e.type==='cavefang')list=[
            {id:'jaw',ok:d<3.3,w:4,move:function(){return cone('jaw','Kemik Çenesi',3,1.5,17,.64,'clawR');}},
            {id:'caveLeap',sp:1,ok:d>3&&d<9,w:3,move:function(){return leap(e);}},
            {id:'tail',ok:d<4.5,w:2,move:function(){return {id:'tail',name:'Kemik Kuyruk',duration:1.9,pose:'sweep',hits:[hit(1,1,'ring',4.4,14,'sweep',{inner:1.8,arc:TAU,style:'chain',fill:'sweep',sweepDir:-1})]};}}
          ];
          else if(e.type==='gravemason')list=[
            {id:'stoneMaul',ok:d<4.8,w:4,move:function(){return cone('stoneMaul','Mezar Tokmağı',4.5,2.1,23,1.02,'overhead');}},
            {id:'stoneElbow',ok:d<2.9,w:2,move:function(){var mv=cone('stoneElbow','Taş Dirsek',3.2,2.2,13,.80,'bash');mv.hits[0].style='blunt';mv.hits[0].knockback=1.5;return mv;}},
            {id:'fissures',sp:1,ok:d>3&&d<11,w:3,move:function(){return fissures(e,2,'Kırılan Mezarlar');}},
            {id:'stoneCrown',sp:1,ok:d<7,w:2,move:function(){return rings(e,1);}}
          ];
          else if(e.type==='ruinwarden')list=[
            {id:'wardenCut',ok:d<5,w:4,move:function(){var m=cone('wardenCut','Yemin Kesen',4.7,3,23,.9,'sweep');m.hits.push(hit(1.65,.75,'cone',4.6,20,'sweepBack',{arc:2.7,face:e.face-.3,fill:'sweep',sweepDir:-1}));m.duration=2.45;return m;}},
            {id:'shards',sp:1,ok:d>4&&d<13,w:2,move:function(){return shards(e,5);}},
            {id:'fissures',sp:1,ok:d<12,w:3,move:function(){return fissures(e,3,'Muhafızın Hükmü');}},
            {id:'wardenOrb',sp:1,ok:!!core&&d<14&&core.orbs.free()>=2,w:3,move:function(){return orbs(e,2,.95,'Yemin Kürecikleri');}},
            {id:'wardenBurrow',sp:1,ok:!!core&&d<12&&ready(e,'wardenBurrow'),w:2.5,move:function(){return burrow(e,true);}}
          ];
          else if(e.type==='hollowking')list=[
            {id:'kingCut',ok:d<6.5,w:4,move:function(){var m=cone('kingCut','Tahtın Biçişi',6,3.4,28,.95,'sweep');if(e.phase>=2){m.hits.push(hit(1.8,.85,'cone',6,24,'sweepBack',{arc:3,face:e.face+.4,fill:'sweep',sweepDir:-1}));m.duration=2.6;}if(e.phase>=3){m.hits.push(hit(2.5,.7,'cone',3.6,14,'kick',{arc:2.4,face:e.face,style:'blunt',fill:'forward'}));m.duration=3.1;}return m;}},
            {id:'kingRush',ok:!!core&&d>6.2,w:e.phase>=2?3:2,move:function(){return rush(e,d);}},
            {id:'hollowPulse',sp:1,ok:d<16,w:3,move:function(){return rings(e,e.phase>=3?3:2);}},
            {id:'fall',sp:1,ok:d<16,w:2,move:function(){return fall(e,e.phase>=2?5:3);}},
            {id:'fissures',sp:1,ok:d>3&&d<15,w:2,move:function(){return fissures(e,e.phase>=3?5:3,'Tahtın Yarıkları');}},
            {id:'crystalStar',sp:1,ok:!!core&&d<15,w:2,move:function(){return star(e,3,'crystalStar','Billur Yıldızı');}},
            {id:'orbs',sp:1,ok:!!core&&d<17&&core.orbs.free()>=2,w:2,move:function(){return orbs(e,2,1.0,'Soluk Küreler');}},
            {id:'hollowNova',sp:1,ok:!!core&&e.phase>=2&&core.pillars.up()>0&&ready(e,'hollowNova')&&!core.nova.on,w:4,move:function(){return nova(e);}},
            {id:'hollowBurrow',sp:1,ok:!!core&&e.phase>=2&&d<16&&ready(e,'hollowBurrow'),w:2.5,move:function(){return burrow(e,false);}},
            {id:'hollowEcho',sp:1,ok:!!core&&e.phase>=3&&d<14&&ready(e,'hollowEcho'),w:2.5,move:function(){return echo(e);}},
            {id:'hollowCall',sp:1,ok:false,w:1,move:function(){return call(e);}},
            {id:'kingHeel',ok:d<2.4,w:2,move:function(){return cone('kingHeel','Taş Topuk',3,2.5,17,.7,'kick');}}
          ];
          if(core&&(e.boss||e.type==='ruinwarden')&&core.orbs.count()>0){for(var li=0;li<list.length;li++)if(list[li].sp||list[li].id==='kingRush')list[li].ok=false;}
          if(e.summoned&&core&&core.nova.on){for(var li=0;li<list.length;li++)if(list[li].sp)list[li].ok=false;}
          return api.pick(e,list);
        },
        tick:function(){
          var list=core.ext.enemies;
          for(var i=0;i<list.length;i++){
            var e=list[i],a=e.action;
            if(e.dead||!a||!a.burrow)continue;
            var b=a.burrow,hide=a.age>=b.from&&a.age<b.to;
            if(hide){
              if(!b.dived){b.dived=true;api.fx('boss2Burrow',{x:e.x,z:e.z});}
              e.model.root.visible=false;e.bar.root.visible=false;
              if(core.time-(b.dust||0)>.12&&B.Boss2.out&&B.Boss2.out.emit){b.dust=core.time;B.Boss2.out.emit(e.x+(Math.random()-.5),.12,e.z+(Math.random()-.5),2,[.14,.12,.1],0,.5,0,.7,.3);}
            }
          }
        },
        phase:function(e){if(!e.boss||e.dead)return;var f=e.hp/e.maxHp,next=f<.26?3:f<.62?2:1;if(next<=e.phase)return;e.phase=next;e.enraged=next===3;e.action=null;e.stagger=0;e.faceLocked=false;api.cancelHazards(e,false);if(core)core.novaEnd();e.forceMove='hollowCall';api.bonus(e.x,e.z,2);api.emit('warning',{x:e.x,z:e.z,text:next===2?'TAŞ TAHT ÇÖKÜYOR':'OYUKLAR AÇILDI'});api.sound('bossPhase');api.fx('bossPhase',{x:e.x,y:1.4,z:e.z,phase:next});api.emit('impact',{x:e.x,z:e.z,strength:1,radius:9});api.beginMove(e,{id:'roar',name:'Oyukların Yemini',duration:2.1,pose:'roar',hits:[hit(1.2,1.2,'ring',5,0,'roar',{inner:0,arc:TAU,harmless:true,style:'shadow'})]});}
      };
    }
  };
}());
