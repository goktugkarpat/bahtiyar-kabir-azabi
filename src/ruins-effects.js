/* Additional active skills use already-warmed feedback pools, never create runtime GPU surfaces. */
(function () {
  'use strict';
  var B=window.BABA,create=B.Effects.create;
  B.Effects.create=function(){
    var api=create.apply(this,arguments),burst=api.burst;
    api.burst=function(name,d){
      if(name!=='heroSkill'||!['brand','grasp','rend'].includes(d.skill))return burst(name,d);
      var f=d.face||0,x=d.x,z=d.z,sx=Math.sin(f),sz=Math.cos(f);
      if(d.phase==='gather'){
        if(d.skill==='brand')return burst('glowBurst',{x:x+sx*4,z:z+sz*4,radius:3.2,duration:.65,color:'#df8b3f'});
        return burst(name,Object.assign({},d,{skill:'reap'}));
      }
      if(d.skill==='brand'){
        burst('strike',{x:x+sx*4,z:z+sz*4,radius:3.2,shape:'circle',style:'quake',scar:true,heavy:true});
        return burst('glowBurst',{x:x+sx*4,z:z+sz*4,radius:3.2,duration:.45,color:'#ed9948'});
      }
      if(d.skill==='grasp'){
        burst('strike',{x:x,z:z,face:f,radius:6,arc:2.4,shape:'cone',style:'chain',sweepDir:-1,heavy:true});
        return burst('heroSkill',{skill:'cleave',phase:'release',x:x,z:z,face:f,radius:6,arc:2.4});
      }
      burst('heroSkill',{skill:'reap',phase:'release',x:x,z:z,face:f,length:9,width:2.8});
      burst('strike',{x:x,z:z,face:f,length:9,width:2.8,shape:'line',style:'shadow',heavy:true});
    };
    return api;
  };
}());
