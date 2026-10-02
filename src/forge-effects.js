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
        burst('strike',{x:x,z:z,radius:intro?5.2:6.6,shape:'circle',style:'quake',scar:true,heavy:true});
        tells.wave(x,z,{radius:intro?7.5:10.5,life:intro?.95:1.1,width:.18,color:p>=3?[1.9,.32,.08]:[1.7,.62,.16],soft:0,delay:.1});
        tells.glowBurst(x,z,{radius:intro?4.5:6.5,life:1.0,color:p>=3?[1.6,.28,.07]:[1.5,.55,.15],peak:.55});
        return true;
      }
      if(name==='death'&&d.boss){
        burst(name,d);
        burst('strike',{x:x,z:z,radius:7.5,shape:'circle',style:'quake',scar:true,heavy:true});
        tells.wave(x,z,{radius:13,life:1.2,width:.22,color:[1.8,.6,.14],soft:0,delay:.05});
        tells.wave(x,z,{radius:8,life:.9,width:.15,color:[1.9,1.2,.5],soft:.1,delay:.35});
        tells.glowBurst(x,z,{radius:9,life:1.7,color:[1.6,.5,.12],peak:.6});
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
