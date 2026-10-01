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
      ruinwarden: { name: 'Harabe Muhafızı', hp: 820, speed: 2.25, radius: .78, reach: 13, cooldown: 1.8, color: 0xc5a372, ruins: true, elite: true },
      hollowking: { name: 'Oyukların Kralı', hp: 3300, speed: 2.05, radius: 1.05, reach: 17, cooldown: 1.2, color: 0xc2a0a3, ruins: true, boss: true }
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
        return {id:'hollowPulse',name:'Oyukların Nabzı',duration:2+count*.65,pose:'roar',hits:hits,cooldown:2};
      }
      function leap(e) {
        var p=point(),a=Math.atan2(p.x-e.x,p.z-e.z),d=Math.hypot(p.x-e.x,p.z-e.z),end={x:p.x-Math.sin(a)*Math.min(1,d),z:p.z-Math.cos(a)*Math.min(1,d)};
        return {id:'caveLeap',name:'Tavandan Sıçrayış',duration:2.1,pose:'crouch',movement:{start:.95,duration:.28,fromX:e.x,fromZ:e.z,x:end.x,z:end.z,leap:true},hits:[hit(1.23,1.0,'circle',2,20,'leap',{origin:p,style:'shadow',unblockable:true})]};
      }
      return {
        attack:function(e,d){
          var list=[];
          if(e.type==='ashbound')list=[
            {id:'ashCut',ok:d<3.7,w:4,move:function(){var m=cone('ashCut','Kül Biçişi',3.4,2.4,16,.75,'sweep');m.hits.push(hit(1.4,.6,'cone',3.5,13,'sweepBack',{arc:2,face:e.face+.5,fill:'sweep',sweepDir:-1}));m.duration=2.05;return m;}},
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
            {id:'fissures',sp:1,ok:d>3&&d<11,w:3,move:function(){return fissures(e,2,'Kırılan Mezarlar');}},
            {id:'stoneCrown',sp:1,ok:d<7,w:2,move:function(){return rings(e,1);}}
          ];
          else if(e.type==='ruinwarden')list=[
            {id:'wardenCut',ok:d<5,w:4,move:function(){var m=cone('wardenCut','Yemin Kesen',4.7,3,23,.9,'sweep');m.hits.push(hit(1.65,.75,'cone',4.6,20,'sweepBack',{arc:2.7,face:e.face-.3,fill:'sweep',sweepDir:-1}));m.duration=2.45;return m;}},
            {id:'shards',sp:1,ok:d>4&&d<13,w:2,move:function(){return shards(e,5);}},
            {id:'fissures',sp:1,ok:d<12,w:3,move:function(){return fissures(e,3,'Muhafızın Hükmü');}}
          ];
          else if(e.type==='hollowking')list=[
            {id:'kingCut',ok:d<6.5,w:4,move:function(){var m=cone('kingCut','Tahtın Biçişi',6,3.4,28,.95,'sweep');if(e.phase>=2){m.hits.push(hit(1.8,.85,'cone',6,24,'sweepBack',{arc:3,face:e.face+.4,fill:'sweep',sweepDir:-1}));m.duration=2.6;}return m;}},
            {id:'hollowPulse',sp:1,ok:d<16,w:3,move:function(){return rings(e,e.phase>=3?3:2);}},
            {id:'fall',sp:1,ok:d<16,w:3,move:function(){return fall(e,e.phase>=2?5:3);}},
            {id:'fissures',sp:1,ok:d>3&&d<15,w:2,move:function(){return fissures(e,e.phase>=3?5:3,'Tahtın Yarıkları');}},
            {id:'kingHeel',ok:d<2.4,w:2,move:function(){return cone('kingHeel','Taş Topuk',3,2.5,17,.7,'kick');}}
          ];
          return api.pick(e,list);
        },
        phase:function(e){if(!e.boss||e.dead)return;var f=e.hp/e.maxHp,next=f<.26?3:f<.62?2:1;if(next<=e.phase)return;e.phase=next;e.enraged=next===3;e.action=null;e.stagger=0;e.faceLocked=false;api.cancelHazards(e,false);api.bonus(e.x,e.z,2);api.emit('warning',{x:e.x,z:e.z,text:next===2?'TAŞ TAHT ÇÖKÜYOR':'OYUKLAR AÇILDI'});api.sound('bossPhase');api.fx('bossPhase',{x:e.x,y:1.4,z:e.z});api.beginMove(e,{id:'roar',name:'Oyukların Yemini',duration:2.1,pose:'roar',hits:[hit(1.2,1.2,'ring',5,0,'roar',{inner:0,arc:TAU,harmless:true,style:'shadow'})]});}
      };
    }
  };
}());
