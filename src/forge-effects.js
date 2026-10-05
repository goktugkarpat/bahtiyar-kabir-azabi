/* Ocak actives: warmed native crimson arc/chain particle pools, no per-cast surfaces/lights. */
(function(){
  'use strict';var B=window.BABA,create=B.Effects.create;
  B.Effects.create=function(){var api=create.apply(this,arguments),burst=api.burst,tells=api.tells;
    // Chapter IV set pieces: molten waves, floor cracks and pooled glow only (warmed pools, no per-cast lights, surfaces or textures).
    function furnace(name,d){
      if(!tells||B.ActiveChapter!==4)return false;
      var x=d.x,z=d.z;
      if(name==='bossPhase'){
        burst(name,d);
        var p=d.phase||0,intro=!!d.intro;
        burst('strike',{x:x,z:z,radius:intro?3.4:4.4,shape:'circle',style:'quake',scar:true,heavy:true,pressureEcho:false});
        tells.wave(x,z,{radius:intro?4.4:6.2,life:intro?.85:1,width:.065,color:p>=3?[.65,.11,.035]:[.58,.22,.07],soft:.12,delay:.1});
        tells.glowBurst(x,z,{radius:intro?2.6:3.2,life:.8,color:p>=3?[.6,.13,.04]:[.55,.24,.075],peak:.09});
        return true;
      }
      if(name==='death'&&d.boss){
        burst(name,d);
        burst('strike',{x:x,z:z,radius:5.4,shape:'circle',style:'quake',scar:true,heavy:true,pressureEcho:false});
        tells.wave(x,z,{radius:9,life:1.2,width:.07,color:[.7,.3,.1],soft:.1,delay:.08});
        tells.wave(x,z,{radius:5.2,life:.9,width:.045,color:[.5,.36,.18],soft:.12,delay:.25});
        tells.glowBurst(x,z,{radius:3.6,life:1.5,color:[.65,.25,.07],peak:.14});
        return true;
      }
      return false;
    }
    api.burst=function(name,d){
      if(furnace(name,d))return;
      if(name!=='heroSkill'||!['temper','chainstorm'].includes(d.skill))return burst(name,d);
      if(d.phase==='gather')return burst(name,Object.assign({},d,{skill:'cleave'}));
      if(d.skill==='temper'){
        burst('heroSkill',{skill:'cleave',phase:'release',x:d.x,z:d.z,face:d.face,radius:7,arc:2.5});
        burst('strike',{x:d.x,z:d.z,face:d.face,radius:7,arc:2.5,shape:'cone',style:'blade',heavy:true,unblockable:true});
        return;
      }
      burst('strike',{x:d.x,z:d.z,face:0,radius:d.radius,inner:d.inner,arc:Math.PI*2,shape:'ring',style:'chain',heavy:true});
    };return api;
  };
}());
