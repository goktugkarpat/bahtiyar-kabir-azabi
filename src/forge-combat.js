/* KIZIL OCAK — iron pistons, locked chain lanes and cooling pockets. */
(function(){
  'use strict';var B=window.BABA,TAU=Math.PI*2;
  B.ForgeCombat={stats:{
    emberbound:{name:'Kor Yeminlisi',hp:218,speed:2.65,radius:.47,reach:8,cooldown:1.65,color:0xbd845d,forge:true},
    chainseer:{name:'Zincir Kâhini',hp:191,speed:2.05,radius:.45,reach:14,cooldown:2.25,color:0xab947d,forge:true,ranged:true},
    slagcrawler:{name:'Cüruf Sürüngeni',hp:209,speed:3.15,radius:.56,reach:9,cooldown:1.75,color:0xa19476,forge:true},
    forgesentinel:{name:'Döküm Nöbetçisi',hp:315,speed:1.85,radius:.72,reach:11,cooldown:2.3,color:0xb99c7f,forge:true},
    ashwarden:{name:'Külün Baş Muhafızı',hp:980,speed:2.2,radius:.82,reach:14,cooldown:1.9,color:0xc5a07a,forge:true,elite:true},
    furnaceheart:{name:'Ocağın Kalbi',hp:3950,speed:2.0,radius:1.10,reach:18,cooldown:1.25,color:0xd39b78,forge:true,boss:true}
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
    return{attack:function(e,d){var list=[];
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
        {id:'bellows',sp:1,ok:d<8,w:2,move:function(){return bellows(e,7.5);}}
      ];
      else if(e.type==='furnaceheart')list=[
        {id:'furnaceHammer',ok:d<6.7,w:4,move:function(){var m=cone('furnaceHammer','Ocağın Çekici',6.2,3.1,30,1.02,'overhead');if(e.phase>=2){m.hits.push(hit(1.95,.93,'circle',2.6,24,'overhead',{origin:point(),style:'quake',unblockable:true}));m.duration=2.8;}return m;}},
        {id:'furnaceCrown',sp:1,ok:d<17,w:3,move:function(){return crown(e,e.phase>=3?3:2);}},
        {id:'piston',sp:1,ok:d>3&&d<15,w:3,move:function(){return piston(e,e.phase>=2?4:2);}},
        {id:'vents',sp:1,ok:d<16,w:3,move:function(){return vents(e,e.phase>=3?6:4);}},
        {id:'bellows',ok:d>2&&d<9,w:2,move:function(){return bellows(e,9);}},
        {id:'furnaceKick',ok:d<2.5,w:2,move:function(){return cone('furnaceKick','Demir Topuk',3.2,2.5,18,.72,'kick');}}
      ];return api.pick(e,list);},
      phase:function(e){if(!e.boss||e.dead)return;var f=e.hp/e.maxHp,next=f<.25?3:f<.60?2:1;if(next<=e.phase)return;e.phase=next;e.enraged=next===3;e.action=null;e.stagger=0;e.faceLocked=false;api.cancelHazards(e,false);api.bonus(e.x,e.z,2);api.emit('warning',{x:e.x,z:e.z,text:next===2?'OCAK BASINCI YÜKSELİYOR':'SON DÖKÜM'});api.sound('bossPhase');api.fx('bossPhase',{x:e.x,y:1.5,z:e.z});api.beginMove(e,{id:'roar',name:'Kızıl Ant',duration:2.2,pose:'roar',hits:[hit(1.3,1.3,'ring',5,0,'roar',{inner:0,arc:TAU,harmless:true})]});}
    };
  }};
}());
