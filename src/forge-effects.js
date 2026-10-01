/* Ocak actives: warmed native crimson arc/chain particle pools, no per-cast surfaces/lights. */
(function(){
  'use strict';var B=window.BABA,create=B.Effects.create;
  B.Effects.create=function(){var api=create.apply(this,arguments),burst=api.burst;
    api.burst=function(name,d){
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
