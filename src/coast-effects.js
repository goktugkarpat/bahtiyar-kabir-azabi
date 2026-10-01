/* KARA KIYI — pooled roots and shaped water impacts; no fight-time GPU allocations. */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('bolum') !== '2') return;
  var B = window.BABA, T = window.THREE, original = B.Effects.create;
  B.Effects.create = function(scene,getGame,getSettings) {
    var api = original(scene,getGame,getSettings), pool = new Array(96), cursor=0, textures=[];
    var points=[new T.Vector3(0,0,0),new T.Vector3(.12,.28,0),new T.Vector3(-.06,.65,.08),new T.Vector3(.04,1.04,.04)];
    var geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points),18,.085,7,false), p=geometry.attributes.position;
    for(var i=0;i<p.count;i++){var y=p.getY(i), k=Math.max(.10,1-y*.78);p.setXYZ(i,p.getX(i)*k,p.getY(i),p.getZ(i)*k);}
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    var material=new T.MeshStandardMaterial(Object.assign(B.Materials.createSurface('wood',textures,2),{color:0x899075,roughness:.74}));material.normalScale.set(.8,.8);
    var mesh=new T.InstancedMesh(geometry,material,pool.length);mesh.name='Kara Kıyı kök patlamaları';mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.visible=false;mesh.count=0;scene.add(mesh);
    var position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),matrix=new T.Matrix4(),axis=new T.Vector3(0,1,0);
    var calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(var i=0;i<pool.length;i++)pool[i]={live:false,x:0,z:0,angle:0,height:1,age:0,life:.85};
    // Line casts remain narrow jets; the bell's tide stays an annulus with a safe centre.
    // Both have compact analytic support, rather than a broad Gaussian clipped by a square.
    var waterGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),water=[],waterCursor=0;
    var waterBase=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
      uniforms:{uBeam:{value:0},uAge:{value:0},uShape:{value:0},uSpan:{value:new T.Vector2(1,1)},uWidth:{value:1},uLength:{value:1},uRadius:{value:1},uInner:{value:0},uSeed:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uBeam,uAge,uShape,uWidth,uLength,uRadius,uInner,uSeed;uniform vec2 uSpan;
      void main(){vec2 p=(vUv-.5)*uSpan;float t=uAge/.62,mask,flow,crest,px;
        if(uShape<.5){float x=abs(p.x),z=p.y+uLength*.5;px=max(fwidth(x),.015);
          mask=(1.-smoothstep(uWidth*.5-max(px,.09),uWidth*.5+px,x))*smoothstep(0.,.12,z)*(1.-smoothstep(uLength-.12,uLength,z));
          flow=sin(z*8.+p.x*5.+uAge*19.+sin(z*2.+uSeed));
          crest=exp(-pow((x-uWidth*(.26+.10*sin(z*3.+uAge*11.)))/max(.04,uWidth*.12),2.));
        }else{float r=length(p),a=atan(p.x,p.y);px=max(fwidth(r),.02);
          mask=(1.-smoothstep(uRadius-px,uRadius+px,r));if(uInner>.01)mask*=smoothstep(uInner-px,uInner+px,r);
          flow=sin(r*8.-uAge*19.+sin(a*7.+uSeed)*.8+sin(a*13.-r*2.)*.35);
          float band=mix(max(uInner,.1),uRadius,clamp(t*1.45,0.,1.));crest=exp(-pow((r-band)/.16,2.));
        }
        float breakUp=.55+.45*sin(p.x*4.+sin(p.y*3.)+uSeed);float foam=pow(max(0.,flow),9.)*.34+crest*.44*breakUp;
        if(uBeam>.5)foam+=exp(-pow(p.x/max(.04,uWidth*.17),2.))*(.55+.25*sin(p.y*17.-uAge*24.));
        float fade=smoothstep(0.,.035,uAge)*(1.-smoothstep(.12,.62,uAge));
        vec3 col=(vec3(.006,.018,.025)+vec3(.14,.26,.29)*foam)*mask*fade;
        if(max(col.r,max(col.g,col.b))<.002)discard;gl_FragColor=vec4(col,1.);
      }`});
    for(var i=0;i<24;i++){var wm=waterBase.clone(),wo=new T.Mesh(waterGeo,wm);wo.visible=false;wo.frustumCulled=false;wo.renderOrder=2;wo.rotation.order='YXZ';wo.name='Kara Kıyı su darbesi';scene.add(wo);water.push({mesh:wo,mat:wm,age:1,live:false});}
    function waterBurst(d){
      var line=d.shape==='line';if(line&&!(d.length>.05))return;var w=water[waterCursor++%water.length],r=d.radius||2,L=line?d.length:2*r,W=line?d.width:2*r;
      w.live=true;w.age=0;w.mesh.visible=true;w.mesh.scale.set(W+.4,1,L+.4);w.mesh.rotation.set(0,line?d.face||0:0,0);
      var x=d.x+(line?Math.sin(d.face||0)*L*.5:0),z=d.z+(line?Math.cos(d.face||0)*L*.5:0),world=B.app&&B.app.world;
      var floor=world&&world.effectHeightAt?world.effectHeightAt(x,z,line?L*.5:r):.065,beam=line&&d.ownerType==='lantern';w.mesh.position.set(x,floor,z);if(beam){var tilt=Math.atan2(2.05-floor,L);w.mesh.rotation.x=tilt;w.mesh.scale.z=(L+.4)/Math.cos(tilt);w.mesh.position.y=(2.05+floor)*.5;}
      var u=w.mat.uniforms;u.uBeam.value=beam?1:0;u.uAge.value=0;u.uShape.value=line?0:1;u.uSpan.value.set(W+.4,L+.4);u.uWidth.value=d.width||1;u.uLength.value=L;u.uRadius.value=r;u.uInner.value=d.inner||0;u.uSeed.value=waterCursor*.73;
    }
    function root(x,z,angle,height){var r=pool[cursor++%pool.length];r.live=true;r.x=x;r.z=z;r.angle=angle;r.height=height;r.age=0;}
    function burst(name,d){
      if(name!=='strike'||!d||d.style!=='root')return;
      var count=d.shape==='line'?Math.min(15,Math.ceil(d.length/.7)):12;
      for(var i=0;i<count;i++){var u=(i+.5)/count,x,z;
        if(d.shape==='line'){var along=u*d.length,side=(i%2?1:-1)*d.width*.22;x=d.x+Math.sin(d.face)*along+Math.cos(d.face)*side;z=d.z+Math.cos(d.face)*along-Math.sin(d.face)*side;}
        else{var a=i/count*Math.PI*2,r=d.inner+(d.radius-d.inner)*.58;x=d.x+Math.sin(a)*r;z=d.z+Math.cos(a)*r;}
        root(x,z,i*2.4,.65+(i%3)*.18);
      }
    }
    function update(dt){var n=0;for(var i=0;i<pool.length;i++){var r=pool[i];if(!r.live)continue;r.age+=dt;if(r.age>=r.life){r.live=false;continue;}var up=calm?1:Math.min(1,r.age/.12),down=Math.min(1,(r.life-r.age)/.3);position.set(r.x,.025,r.z);scale.set(.7,Math.max(.001,r.height*up*down),.7);rotation.setFromAxisAngle(axis,r.angle);matrix.compose(position,rotation,scale);mesh.setMatrixAt(n++,matrix);}mesh.count=n;mesh.visible=n>0;if(n)mesh.instanceMatrix.needsUpdate=true;
      for(var i=0;i<water.length;i++){var w=water[i];if(!w.live)continue;w.age+=dt;w.mat.uniforms.uAge.value=w.age;if(w.age>=.62){w.live=false;w.mesh.visible=false;}}
    }
    var oldBurst=api.burst,oldUpdate=api.update,oldClear=api.clear,oldDispose=api.dispose;
    api.burst=function(name,d){oldBurst(name,d);burst(name,d);if(name==='strike'&&d&&d.style==='tide')waterBurst(d);};api.update=function(dt){oldUpdate(dt);update(dt);};
    var oldWarm=api.warm;api.warm=function(){if(oldWarm)oldWarm();position.set(0,-1000,0);scale.set(.001,.001,.001);rotation.identity();matrix.compose(position,rotation,scale);mesh.setMatrixAt(0,matrix);mesh.instanceMatrix.needsUpdate=true;mesh.count=1;mesh.visible=true;water[0].mesh.visible=true;water[0].mat.uniforms.uAge.value=1;};
    api.clear=function(){oldClear();for(var i=0;i<pool.length;i++)pool[i].live=false;for(var i=0;i<water.length;i++){water[i].live=false;water[i].mesh.visible=false;}mesh.visible=false;mesh.count=0;};
    api.dispose=function(){oldDispose();scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();textures.forEach(function(t){t.dispose();});for(var i=0;i<water.length;i++){scene.remove(water[i].mesh);water[i].mat.dispose();}waterBase.dispose();waterGeo.dispose();};
    return api;
  };
}());
