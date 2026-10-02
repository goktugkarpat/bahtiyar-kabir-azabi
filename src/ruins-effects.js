/* Additional active skills use already-warmed feedback pools, never create runtime GPU surfaces. */
(function () {
  'use strict';
  var B=window.BABA,create=B.Effects.create;
  B.Effects.create=function(){
    var api=create.apply(this,arguments),burst=api.burst;
    var tells=api.tells;
    // Chapter III set pieces: waves, cracks and pooled glow only (warmed pools, no per-cast lights, surfaces or textures).
    function grave(name,d){
      if(!tells||B.ActiveChapter!==3)return false;
      var x=d.x,z=d.z;
      if(name==='bossPhase'){
        burst(name,d);
        var p=d.phase||0,intro=!!d.intro;
        burst('strike',{x:x,z:z,radius:intro?5.2:6.4,shape:'circle',style:'quake',scar:true,heavy:true});
        tells.wave(x,z,{radius:intro?7.5:10.5,life:intro?.95:1.1,width:.17,color:p>=3?[1.5,.28,.34]:[.62,.5,1.25],soft:0,delay:.1});
        tells.glowBurst(x,z,{radius:intro?4.2:6,life:1.0,color:p>=3?[1.2,.2,.3]:[.5,.38,1.0],peak:.5});
        return true;
      }
      if(name==='death'&&d.boss){
        burst(name,d);
        burst('strike',{x:x,z:z,radius:7,shape:'circle',style:'quake',scar:true,heavy:true});
        tells.wave(x,z,{radius:13,life:1.2,width:.2,color:[.7,.55,1.3],soft:0,delay:.05});
        tells.wave(x,z,{radius:8,life:.9,width:.14,color:[.78,.62,1.3],soft:.1,delay:.35});
        tells.glowBurst(x,z,{radius:8,life:1.6,color:[.5,.4,1.0],peak:.55});
        return true;
      }
      return false;
    }
    api.burst=function(name,d){
      if(grave(name,d))return;
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
