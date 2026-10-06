/* Hand-built fitted equipment. Shared geometry and tileable PBR surfaces are created once. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE, G = B.Gear, PI = Math.PI, TAU = PI * 2;
  const mix = (a,b,t) => a+(b-a)*t, clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const surfaces = {}, palette = {}, finishes = {}, scanned = {};
  let prepared;
  function surface(kind) {
    if (surfaces[kind]) return surfaces[kind];
    const n = 512, heights = new Float32Array(n*n), color = new Uint8Array(n*n*4), normal = new Uint8Array(n*n*4), rough = new Uint8Array(n*n*4);
    let chainScan=null;
    if(kind==='chain'&&scanned.metal){try{const canvas=document.createElement('canvas');canvas.width=canvas.height=n;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(scanned.metal.map.image,0,0,n,n);chainScan=ctx.getImageData(0,0,n,n).data;}catch(error){/* Offline file origins retain the shared relief. */}}
    const hash = (x,y) => { const v = Math.sin(x*127.1+y*311.7+19.19)*43758.5453; return v-Math.floor(v); };
    for (let y=0;y<n;y++) for(let x=0;x<n;x++) {
      const i=y*n+x, grain=hash(x,y), broad=hash(Math.floor(x/12),Math.floor(y/12));
      let h=.5, c=.84, r=.7;
      if(kind==='metal') { h=.5+(grain-.5)*.065+Math.sin(y*1.8)*.025; c=.82+(grain-.5)*.07; r=.75+(grain-.5)*.18; }
      if(kind==='leather') { const fold=Math.sin(x*.041+Math.sin(y*.023)*2.5)*Math.sin(y*.035+Math.cos(x*.017)), pores=Math.pow(grain,5); h=.45+pores*.12+fold*.045; c=.73+fold*.08+(grain-.5)*.06; r=.86+pores*.10+fold*.025; }
      if(kind==='cloth') { const a=Math.sin(x*TAU/8), b=Math.sin(y*TAU/8); h=.5+.12*a*b+.03*grain; c=.77+.08*a*b; r=.95; }
      if(kind==='wood') { const line=Math.sin((x+Math.sin(y*.024)*6)*.22); h=.5+line*.035+grain*.03; c=.64+.11*line+grain*.04; r=.78; }
      if(kind==='bone') { h=.5+Math.sin(x*.18+y*.011)*.018+grain*.035; c=.89+grain*.07; r=.74; }
      if(kind==='chain'){
        // Interlocked iron rings over dark lining; the existing forged-steel
        // scan supplies the metal grain. This is relief on the fitted underlayer,
        // not thousands of skinned torus meshes or another draw group.
        const row=Math.floor(y/10),u=((x+(row%2)*5)%10)/10-.5,v=(y%10)/10-.5;
        const ring=Math.abs(Math.hypot(u,v)-.35),rim=clamp((.085-ring)/.032,0,1),scan=chainScan?chainScan[i*4]/255:.78;
        h=.30+rim*.23;c=mix(.14,.52+scan*.38,rim);r=mix(.94,.57+grain*.10,rim);
      }
      heights[i]=h; const k=i*4; color[k]=color[k+1]=color[k+2]=Math.round(c*255);color[k+3]=255;
      rough[k]=rough[k+1]=rough[k+2]=Math.round(r*255);rough[k+3]=255;
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const k=(y*n+x)*4, dx=(heights[y*n+(x+n-1)%n]-heights[y*n+(x+1)%n])*2, dy=(heights[((y+n-1)%n)*n+x]-heights[((y+1)%n)*n+x])*2, inv=1/Math.hypot(dx,dy,1);
      normal[k]=Math.round((dx*inv*.5+.5)*255);normal[k+1]=Math.round((dy*inv*.5+.5)*255);normal[k+2]=Math.round((inv*.5+.5)*255);normal[k+3]=255;
    }
    const tex = (bytes,srgb) => { const t=new T.DataTexture(bytes,n,n,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.needsUpdate=true;return t; };
    return surfaces[kind]={map:tex(color,true),normalMap:tex(normal,false),roughnessMap:tex(rough,false)};
  }
  function prepare() {
    if(prepared)return prepared;
    const loader=new T.TextureLoader();
    prepared=Promise.all([['leather','aged-leather'],['metal','forged-steel'],['cloth','woven-linen']].map(async([kind,file])=>{
      if((kind==='leather'||kind==='cloth')&&B.CoastMaterials){
        const scan=B.CoastMaterials.createSurface(kind==='leather'?'leather':'linen');
        scanned[kind]={map:scan.map,normalMap:scan.normalMap,roughnessMap:scan.roughnessMap};
        await B.CoastMaterials.ready();return;
      }
      const map=await loader.loadAsync(B.EquipmentTextureData[kind]);
      map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
      map.colorSpace=T.SRGBColorSpace;
      map.name='equipment-scan-'+kind;
      // Companion maps are derived once, before shader warm-up. A local file
      // origin can deny canvas readback; retain the procedural companions there.
      if(kind==='metal'&&B.EquipmentTextureData.metalNormal&&B.EquipmentTextureData.metalRoughness){
        const [normalMap,roughnessMap]=await Promise.all([loader.loadAsync(B.EquipmentTextureData.metalNormal),loader.loadAsync(B.EquipmentTextureData.metalRoughness)]);
        for(const texture of[normalMap,roughnessMap]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=8;texture.colorSpace=T.NoColorSpace;}
        normalMap.name='equipment-scan-metal-normal';roughnessMap.name='equipment-scan-metal-roughness';
        scanned[kind]={map,normalMap,roughnessMap};return;
      }
      const maps={...surface(kind),map};
      try {
        const n=512,canvas=document.createElement('canvas');canvas.width=canvas.height=n;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(map.image,0,0,n,n);
        const rgba=ctx.getImageData(0,0,n,n).data,h=new Float32Array(n*n),normal=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4);
        for(let i=0;i<h.length;i++)h[i]=(rgba[i*4]*.2126+rgba[i*4+1]*.7152+rgba[i*4+2]*.0722)/255;
        for(let y=0;y<n;y++)for(let x=0;x<n;x++){
          const i=y*n+x,k=i*4,scale=kind==='leather'?2.8:kind==='cloth'?3.2:1.4,
            dx=(h[y*n+(x+n-1)%n]-h[y*n+(x+1)%n])*scale,
            dy=(h[((y+n-1)%n)*n+x]-h[((y+1)%n)*n+x])*scale,inv=1/Math.hypot(dx,dy,1);
          normal[k]=(dx*inv*.5+.5)*255;normal[k+1]=(dy*inv*.5+.5)*255;normal[k+2]=(inv*.5+.5)*255;normal[k+3]=255;
          const r=kind==='leather'?clamp(.93-h[i]*.28,.67,.93):kind==='cloth'?clamp(.98-h[i]*.08,.90,.98):clamp(.86-h[i]*.52,.40,.80);
          rough[k]=rough[k+1]=rough[k+2]=r*255;rough[k+3]=255;
        }
        const tex=bytes=>{const t=new T.DataTexture(bytes,n,n,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;};
        maps.normalMap=tex(normal);maps.roughnessMap=tex(rough);
      }catch(error){if(location.protocol!=='file:')throw error;}
      scanned[kind]=maps;
    }));return prepared;
  }
  const spec = {
    steel:['metal',0xa3adb3,.87,.90], salt:['metal',0xa4bdba,.93,.86], rust:['metal',0x9d8773,.84,.72],
    edge:['metal',0xc5ccd0,.65,.95], brass:['metal',0x9c8661,.65,.88], dark:['metal',0x647078,.64,.88],
    leather:['leather',0xe0d3c5,.92,0], strap:['leather',0x817063,.95,0], cloth:['cloth',0x655b4e,1,0],
    rag:['cloth',0xe4caae,1,0], mail:['chain',0x8f979a,.74,.82], wood:['wood',0x65482c,1,0], bone:['bone',0xb9b09a,1,0]
  };
  // Extra gear surfaces (gear-* sets): tarnished grave gold, blackened iron, horn, dyed cloth, gems.
  Object.assign(spec,{
    gold:['metal',0xd9b066,.46,.72], bronze:['metal',0x7f8a5c,.58,.85], black:['metal',0x4a4d52,.58,.9], silver:['metal',0xc9cfd4,.42,.96],
    horn:['bone',0x5e4c3c,.62,0], fur:['leather',0x6b5641,1,0], crimson:['cloth',0x8a2a22,1,0], sable:['cloth',0x302b27,1,0], hide:['leather',0xa98a6c,.9,0],
    gem:['metal',0x8a1018,.18,.25], bright:['metal',0xb4bec6,.48,.96]
  });
  // Emissive inlays: rune channels, ember cracks, frost, venom, void and holy light. Unlit cores, bloom-friendly.
  const GLOW={ember:[0xff5a12,0x2a0d04,3.2], frost:[0x8fdcff,0x0c1a24,2.6], venom:[0x7dff3c,0x0b1a06,2.5], void:[0xa86bff,0x120a1c,2.9], holy:[0xffd27a,0x241a08,2.7], gore:[0xff1c10,0x200302,2.6]};
  // The shared character grade (edge wear, cavities, grime, rust, blood, micro relief) per surface kind.
  const GRADE={metal:{cls:'metal',grime:.28,rust:.05,blood:.06,wear:1.05,scale:7},chain:{cls:'metal',grime:.35,rust:.12,wear:.8,scale:9},
    leather:{cls:'leather',grime:.32,blood:.04},cloth:{cls:'cloth',grime:.42,blood:.05},bone:{cls:'bone',grime:.34,scale:9},wood:{cls:'wood',grime:.3}};
  const FINISH_GRADE={ash:{grime:.62},rust:{rust:.42,grime:.4},brine:{rust:.18,grime:.38},blood:{blood:.55,grime:.36},bone:{grime:.3}};
  function gradeOf(key,kind,extra){
    const g=Object.assign({},GRADE[kind]||GRADE.metal,extra||{});
    if(key==='rust')g.rust=.32;if(key==='bright')Object.assign(g,{rust:0,grime:.14,wear:.7});if(key==='edge')Object.assign(g,{wear:.45,blood:.22,grime:.1});if(key==='gold'||key==='brass'||key==='bronze')Object.assign(g,{grime:key==='gold'?.18:.4,wear:.75,rust:0});
    if(key==='dark'||key==='black')Object.assign(g,{rust:.1,wear:.85});if(key==='rag')g.blood=.25;return g;
  }
  function applyGrade(m,key,kind,extra){
    if(!(B.Models&&B.Models.grade)||/[?&]nogeargrade/.test(location.search))return m;
    const g=gradeOf(key,kind,extra);B.Models.grade(m,g);m.userData.gearGrade={key,kind,extra:extra||null};return m;
  }
  function material(key) {
    if(palette[key])return palette[key];
    if(GLOW[key]){
      const g=GLOW[key],m=new T.MeshStandardMaterial({color:g[1],emissive:g[0],emissiveIntensity:g[2],roughness:.35,metalness:0,toneMapped:true});
      m.name='kara-equipment-'+key;m.userData.equipmentGlow=key;
      // Living inlays: embers flicker, frost and void breathe slowly, holy light swells. Shared material, one scalar per frame.
      const base=g[2],rate={ember:7.3,gore:3.1,frost:1.3,void:.9,venom:2.2,holy:1.1}[key]||1.5,ember=key==='ember'||key==='gore';
      m.onBeforeRender=function(){const t=performance.now()*.001*rate;this.emissiveIntensity=base*(ember?.78+.16*Math.sin(t)+.1*Math.sin(t*2.7+1.3)+.06*Math.sin(t*6.1):.8+.22*Math.sin(t));};
      return palette[key]=m;
    }
    const s=spec[key]||spec.steel;
    const m=new T.MeshStandardMaterial({...(key==='edge'||key==='gold'||key==='silver'||key==='gem'?surface(s[0]):scanned[s[0]]||surface(s[0])),color:s[1],roughness:s[2],metalness:s[3],normalScale:new T.Vector2(s[0]==='metal'?.16:s[0]==='leather'?.42:s[0]==='cloth'?.25:.60,s[0]==='metal'?.16:s[0]==='leather'?.42:s[0]==='cloth'?.25:.60)});
    m.name='kara-equipment-'+key;m.userData.equipmentKind=s[0];applyGrade(m,key,s[0]);return palette[key]=m;
  }
  function finish(source,name) {
    if(!name||!source.userData.equipmentKind||/-(edge|brass|dark|strap|bone|gold|bronze|silver|gem|horn|crimson|sable|black)$/.test(source.name))return source;
    const tones={ash:0x79818b,rust:0x9b7760,brine:0x7b9998,blood:0x86534b,bone:0xb0a187};if(!tones[name])return source;
    const key=source.name+':'+name;if(finishes[key])return finishes[key];
    const m=source.clone();m.color.lerp(new T.Color(tones[name]),source.userData.equipmentKind==='metal'?.26:.26);m.name=source.name+'-'+name;
    m.roughness=clamp(source.roughness+(name==='rust'?.08:0),0,1);
    const gg=source.userData.gearGrade;if(gg)applyGrade(m,gg.key,gg.kind,Object.assign({},gg.extra||{},FINISH_GRADE[name]||{}));
    return finishes[key]=m;
  }
  function build({A,part,sleeve,equipmentWeapon,rayRadius}) {
    // A mail underlayer replaces the existing cloth group in plate sets. All
    // torso and limb pieces keep their old grouping and native skin bindings.
    const sourcePart=part,mailSets=new Set(['grave-chest','lamellar-chest','warden-chest','chainmail-chest']);
    part=(slot,id,mat,...args)=>sourcePart(slot,id,mat==='cloth'&&mailSets.has(id)?'mail':mat==='cloth'&&id==='rib-chest'?'leather':mat,...args);
    const BODY=['skin','leather'], torsoBones=['pelvis','spine01','spine02','spine03'];
    const v3 = p => new T.Vector3().fromArray(p), emit=(slot,id,mat,list,bone,opts)=>{if(list.length)part(slot,id,mat,G.merge(list),bone,opts);};
    const line=(fn,count=24)=>Array.from({length:count+1},(_,i)=>fn(i/count));
    // Smooth the sampled body field before shaping fitted breastplates. Sparse body triangles
    // must not produce the ridges and holes of a raw nearest-vertex shrink wrap.
    const cloud=A.cloud(torsoBones,['skin'],.25), cz=A.P('spine03').z-.008, grid=[], NU=48,NV=32;
    for(let j=0;j<=NV;j++){grid[j]=[];const y=mix(.86,1.58,j/NV);for(let i=0;i<NU;i++){const a=i/NU*TAU;let r=0;for(const p of cloud){if(Math.abs(p.y-y)>.055)continue;const d=Math.atan2(Math.sin(Math.atan2(p.x,p.z-cz)-a),Math.cos(Math.atan2(p.x,p.z-cz)-a));if(Math.abs(d)<.25)r=Math.max(r,Math.hypot(p.x,p.z-cz)*Math.cos(d));}grid[j][i]=r||(.17+.035*Math.sin(j/NV*PI));}}
    for(let pass=0;pass<5;pass++){const next=grid.map((row,j)=>row.map((r,i)=>{let sum=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)sum+=grid[clamp(j+dj,0,NV)][(i+di+NU)%NU];return Math.max(r*.975,sum/9);}));for(let j=0;j<=NV;j++)grid[j]=next[j];}
    // Fit rear equipment in Cartesian space. A radial chest origin measures the
    // shoulder blades as one large sack and inflates every armor's upper back.
    const rearSkin=cloud.filter(p=>p.z<cz),rearGrid=[],RX=24,RY=24;
    for(let j=0;j<=RY;j++){
      const row=[],y=.88+j/RY*.70;
      for(let i=0;i<=RX;i++){
        const x=-.32+i/RX*.64,near=[];
        for(const p of rearSkin){const d=(p.x-x)**2+(p.y-y)**2;let n=0;while(n<near.length&&near[n].d<d)n++;if(n<8){near.splice(n,0,{p,d});if(near.length>8)near.pop();}}
        let sum=0,weight=0;for(const n of near){const w=1/(.00012+n.d);sum+=n.p.z*w;weight+=w;}
        row.push(weight?sum/weight:cz-.14);
      }rearGrid.push(row);
    }
    // Suppress sparse shoulder-blade dents: fitted armor should be a smooth
    // saddle, never the corrugated outline of individual sampled vertices.
    for(let pass=0;pass<5;pass++){
      const next=rearGrid.map((row,j)=>row.map((z,i)=>{
        let sum=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)sum+=rearGrid[clamp(j+dj,0,RY)][clamp(i+di,0,RX)];
        return mix(z,sum/9,.72);
      }));for(let j=0;j<=RY;j++)rearGrid[j]=next[j];
    }
    function rearDepth(x,y){
      const u=clamp((x+.32)/.64,0,1)*RX,v=clamp((y-.88)/.70,0,1)*RY,i=Math.min(RX-1,Math.floor(u)),j=Math.min(RY-1,Math.floor(v));
      return mix(mix(rearGrid[j][i],rearGrid[j][i+1],u-i),mix(rearGrid[j+1][i],rearGrid[j+1][i+1],u-i),v-j);
    }
    function chest(u,v,lift=.025,metal=false) {
      const a=u*TAU, side=Math.abs(Math.sin(a)), y=mix(.89,1.51-.135*Math.pow(side,3),v), gu=((u%1)+1)%1*NU, gv=clamp((y-.86)/.72,0,1)*NV, i=Math.floor(gu)%NU,j=Math.min(NV-1,Math.floor(gv));
      const r=mix(mix(grid[j][i],grid[j][(i+1)%NU],gu%1),mix(grid[j+1][i],grid[j+1][(i+1)%NU],gu%1),gv-j)+lift;
      const keel=metal?.017*Math.pow(Math.max(0,Math.cos(a)),12)*Math.sin(v*PI):.002*Math.sin(a*16)*Math.sin(v*PI);
      const x=Math.sin(a)*(r+keel),back=Math.max(0,-Math.cos(a)),blend=clamp((back-.13)/.48,0,1);
      return [x,y,mix(cz+Math.cos(a)*(r+keel),rearDepth(x,y)-lift,blend)];
    }
    function cuirass(u,v,lift=.027) {
      const a=u*TAU,front=Math.max(0,Math.cos(a)),side=Math.abs(Math.sin(a));
      // A real dipped neck opening and pointed waist, with rising shoulder straps.
      const shoulder=Math.exp(-Math.pow((side-.66)/.24,2));
      const top=1.47-.11*Math.pow(front,8)-.16*Math.pow(side,10)+.055*shoulder;
      const hem=.957-.036*Math.pow(front,10)+.014*side;
      const y=mix(hem,top,v),bodyTop=1.51-.135*Math.pow(side,3);
      const p=chest(u,(y-.89)/(bodyTop-.89),lift,true);
      const keel=.011*Math.pow(front,16)*Math.exp(-Math.pow((v-.32)/.31,2));
      // A backplate is a broad forged surface, not a shrink-wrap of shoulder blades.
      // The sampled body field has sparse rear vertices: its radial peaks look like folds.
      const back=Math.max(0,-Math.cos(a)), blend=clamp((back-.12)/.55,0,1);
      p[0]=mix(p[0],Math.sin(a)*(.205+.036*Math.sin(v*PI)+lift),blend);
      // Three measured longitudinal stations make one smooth forged backplate.
      // A rigid metal back does not inherit every dent in skin or cloth.
      const t=clamp((y-.96)/.51,0,1),low=rearDepth(0,.96),mid=rearDepth(0,1.20),high=rearDepth(0,1.47);
      const profile=(1-t)*(1-t)*low+2*t*(1-t)*mid+t*t*high;
      p[2]=mix(p[2],profile+.008*Math.pow(p[0]/.25,2)-lift,blend);
      p[0]+=Math.sin(a)*keel;p[2]+=Math.cos(a)*keel;
      return p;
    }
    function curveReady(source,maxEdge=.011) {
      const p=source.attributes.position,uv=source.attributes.uv,pos=[],tex=[];
      const vertex=i=>[p.getX(i),p.getY(i),p.getZ(i),uv?uv.getX(i):0,uv?uv.getY(i):0];
      const edge=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
      const split=(a,b,c,depth)=>{
        const ab=edge(a,b),bc=edge(b,c),ca=edge(c,a),long=Math.max(ab,bc,ca);
        if(long>maxEdge*maxEdge&&depth<12){
          if(long===bc){const old=a;a=b;b=c;c=old;}else if(long===ca){const old=a;a=c;c=b;b=old;}
          const mid=a.map((x,i)=>(x+b[i])*.5);split(a,mid,c,depth+1);split(mid,b,c,depth+1);return;
        }
        for(const v of[a,b,c]){pos.push(v[0],v[1],v[2]);tex.push(v[3],v[4]);}
      };
      for(let i=0;i<p.count;i+=3)split(vertex(i),vertex(i+1),vertex(i+2),0);
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(tex,2));source.dispose();return g;
    }
    function piping(slot,id,mat,fn,bone,r=.003,opts) {part(slot,id,mat,G.tube(line(fn),r,6,24,true),bone,opts);}
    function studs(slot,id,fn,count,bone,mat='brass',radius=.0034,opts) {const out=[];for(let i=0;i<count;i++){const p=fn((i+.5)/count),n=v3(p).sub(new T.Vector3(0,p[1],cz)).normalize();out.push(G.stud(radius,p,n));}emit(slot,id,mat,out,bone,opts);}
    function shoulder(id,s,mat,style) {
      const bone='upper_arm'+s, bc=A.box(A.cloud([bone],['skin'],.38)), c=bc.getCenter(new T.Vector3()), sz=bc.getSize(new T.Vector3()), sign=s==='L'?1:-1;
      c.y=bc.max.y-.028;
      // A domed cap and three overlapping curved lames, seated on the upper arm.
      const heavy=style==='warden'||style==='iron', light=style==='chain';
      const width=heavy?(style==='iron'?1:s==='L'?1.20:.91):style==='salt'?(s==='L'?1.12:.94):light?.88:1;
      const rx=Math.max(.10,sz.x*.46)*width,rz=Math.max(.085,sz.z*.55)*(heavy?1.09:light?.90:1);
      const cap=(u,v,layer)=>{const a=u*TAU,e=mix(.02,1.30,v),d=layer*.026;return[c.x+Math.sin(a)*rx*Math.sin(e)+sign*d,c.y+Math.cos(e)*((style==='iron'?.118:heavy?.14:light?.092:.115)-layer*.01)-d*.72,c.z+Math.cos(a)*rz*Math.sin(e)];};
      if(style==='chain')return;
      if(style==='warden'||style==='ritual'){
        const pale=style==='ritual',surface=pale?'bone':mat,panels=[];
        for(let layer=0;layer<2;layer++){
          const shape=(u,v)=>{const a=u*TAU,facets=1/(Math.max(Math.abs(Math.sin(a)),Math.abs(Math.cos(a)))+.13),r=Math.sin(v*PI/2);return[c.x+Math.sin(a)*rx*r*facets+sign*layer*.027,c.y+.095-Math.pow(v,.85)*.105-layer*.028,c.z+Math.cos(a)*rz*r*facets];};
          panels.push(G.shell(16,6,shape,.007,true));
          part('chest',id,pale||mat==='leather'?'strap':'edge',G.tube(line(u=>shape(u,1),20),.0032,5,20,true),bone);
        }emit('chest',id,surface,panels,bone);return;
      }
      part('chest',id,mat,G.shell(32,12,(u,v)=>cap(u,v,0),light?.004:.008,true),bone);
      if(light){piping('chest',id,'edge',u=>cap(u,1,0),bone,.0022);return;}
      for(let l=1;l<=(style==='salt'?1:style==='iron'?2:1);l++){part('chest',id,mat,G.shell(32,5,(u,v)=>{const p=cap(u,.71+v*.27,l);p[1]-=l*.012;return p;},.006,true),bone);piping('chest',id,mat==='leather'?'strap':'edge',u=>{const p=cap(u,.98,l);p[1]-=l*.012;return p;},bone,.0024);}
      const riv=[];for(let i=0;i<10;i++){const p=cap(i/10,.76,0);riv.push(G.stud(.0035,p,v3(p).sub(c).normalize()));}emit('chest',id,'brass',riv,bone);
    }
    // Tailored garments have an open neckline and separate fronts, back and
    // shoulder bridges. They are not closed breastplate cylinders in cloth.
    function barbarianChest(id,armored){
      // Bare pectorals and back: leather protects the lower left ribs and a
      // single shoulder; straps visibly support it instead of a full cylinder.
      const ribs=(u,v)=>chest(.012+u*.222,.02+v*.43,.023);
      const shell=G.shell(24,14,ribs,.007,false);G.uvScale(shell,1.5,1.2);
      part('chest',id,'leather',shell);
      for(const edge of[0,1])piping('chest',id,'strap',v=>ribs(edge,v),null,.003);
      piping('chest',id,'strap',u=>ribs(u,0),null,.003);
      shoulder(id,'L',armored?'dark':'leather','warden');
      const straps=[],stitches=[];
      for(const back of[false,true]){
        const strap=(u,v)=>{
          const a=back?.65-v*.30:-.14+v*.28;
          const p=v3(chest(a+(u-.5)*.033,.13+v*.82,.031)),skin=A.nearest(p,['skin']);
          return skin?[skin.x+skin.nx*.011,skin.y+skin.ny*.011,skin.z+skin.nz*.011]:p.toArray();
        };
        straps.push(G.shell(6,28,strap,.005,false));
        for(let n=0;n<24;n++){const v=.04+n*.038;stitches.push(G.tube([strap(.1,v),strap(.17,v+.015)],.0009,4,2,true));}
      }
      // The load-bearing strap runs over the shoulder instead of ending on the scapula.
      const bridge=(u,v)=>{
        const f=v3(chest(.14+(u-.5)*.033,.95,.031)),b=v3(chest(.35+(u-.5)*.033,.95,.031));
        const p=f.lerp(b,v);p.y+=.11*Math.sin(v*PI);const skin=A.nearest(p,['skin']);return skin?[skin.x+skin.nx*.011,skin.y+skin.ny*.011,skin.z+skin.nz*.011]:p.toArray();
      };
      straps.push(G.shell(6,16,bridge,.005,false));
      emit('chest',id,'strap',straps);emit('chest',id,'rag',stitches);
      // The buckle at the sternum and a short articulated leather bracer are
      // equipment construction, not a decorative lump on the back.
      const bp=chest(0,.58,.042),buckle=G.buckle(.052,.045,.004);buckle.translate(...bp);part('chest',id,'brass',buckle,'spine02');
      const waist=G.shell(48,4,(u,v)=>chest(u,.11+v*.07,.030),.004,true);part('chest',id,'strap',waist,'spine01');
      const fore='forearmL',hand='handL',brace=sleeve(A,fore,hand,.38,.80,.020,.006,['skin']);
      part('chest',id,'leather',brace.geometry,fore);
      for(const v of[.40,.74])part('chest',id,'strap',G.shell(24,3,(u,t)=>brace.at(u*TAU,v+t*.022,.003)[0].toArray(),.003,true),fore);
      if(armored){
        const plates=[];for(let n=0;n<3;n++)plates.push(G.shell(8,6,(u,v)=>chest(.025+u*.18,.08+n*.10+v*.08,.036),.005,false));
        emit('chest',id,'dark',plates);
      }
      warSkirt(id,'leather',false);
    }
    function tailoredChest(id,style) {
      const coat=style===2, armored=style===1, sea=id==='coast-chest',mourning=id==='brigandine-chest';
      function panel(side,u,v,lift=.028) {
        const a=side*mix(.009,.244,u), angle=Math.abs(a);
        // V neck rises to the shoulder, then falls into the actual armhole.
        const top=angle<.12?mix(style===0?1.355:1.46,1.595,(angle-.009)/.111):mix(1.595,1.295,(angle-.12)/.124);
        const hem=.945+.038*Math.sin(u*PI)+.015*Math.cos(u*PI*3);
        const y=mix(hem,top,v), bodyTop=1.51-.135*Math.pow(Math.abs(Math.sin(a*TAU)),3);
        const q=chest(a,(y-.89)/(bodyTop-.89),lift,false);
        const fold=.004*Math.sin(u*PI*5+v*.8)*Math.sin(v*PI)+.003*Math.sin(v*PI*4)*Math.sin(u*PI);
        q[0]+=Math.sin(a*TAU)*fold;q[2]+=Math.cos(a*TAU)*fold;
        return q;
      }
      // The already-smoothed Cartesian surface is shared by all tailored sets.
      const backDepth=(x,y)=>rearDepth(x,y);
      const back=(u,v,lift=.028)=>{
        const a=mix(.258,.742,u),top=1.295+.30*Math.pow(Math.sin(u*PI),.55),y=mix(.97,top,v);
        const p=chest(a,(y-.89)/(1.51-.135*Math.pow(Math.abs(Math.sin(a*TAU)),3)-.89),lift);
        // Fit the back in Cartesian space; a single radial origin turns the
        // curved spine into an inflated, bottle-shaped leather sack.
        p[2]=mix(p[2],backDepth(p[0],y)-lift,Math.pow(Math.sin(u*PI),.5));return p;
      };
      const thread=[],seams=[];
      const stitch=(fn,n=40)=>{for(let j=0;j<n;j++){const p=fn((j+.15)/n),q=fn((j+.65)/n);thread.push(G.tube([p,q],.0008,4,2,true));}};
      for(const side of[-1,1]) {
        const frontPanel=G.shell(32,24,(u,v)=>panel(side,u,v),.007,false,side<0);G.uvScale(frontPanel,.82,.88);part('chest',id,coat?'cloth':'leather',frontPanel);
        for(const edge of[0,1]){
          piping('chest',id,'strap',v=>panel(side,edge,v,.035),null,.0032);
          stitch(v=>panel(side,edge? .98:.02,v,.037));
        }
        for(const edge of[0,1]){
          piping('chest',id,'strap',u=>panel(side,u,edge,.034),null,.0032);
          stitch(u=>panel(side,u,edge?.978:.024,.037));
        }
        // Raised tailored side seams, rather than a striped barrel.
        seams.push(G.tube(line(v=>panel(side,.70,v,.031),28),.0016,5,28,true));
        stitch(v=>panel(side,.72,v,.034));
        // Folded lapels define the open front and break the flat silhouette.
        part('chest',id,'strap',G.shell(10,20,(u,v)=>{
          const q=panel(side,.01+u*.13,.48+v*.51,.039+.014*Math.sin(u*PI));
          q[0]+=side*.007*Math.sin(v*PI);return q;
        },.006,false,side<0));
        // Riveted attachment tabs and actual crossing laces below the V.
        for(let row=0;row<4;row++){
          const v=.13+row*.09,p=panel(side,.018,v,.041),n=new T.Vector3(side*.12,0,1).normalize();
          part('chest',id,'brass',G.stud(.0035,p,n));
          const q=panel(-side,.018,v+.055,.041);
          part('chest',id,'strap',G.tube([p,[(p[0]+q[0])*.5,(p[1]+q[1])*.5,(p[2]+q[2])*.5+.007],q],.0022,6,12,true));
        }
        if(armored){
          const plates=[],rivets=[];
          for(let r=0;r<5;r++)for(let c=0;c<3;c++){
            const x=.19+c*.23,y=.10+r*.14;
            plates.push(G.shell(5,5,(u,v)=>panel(side,x+u*.19,y+v*.12,.041),.004,false,side<0));
            for(const dx of[.025,.16]){const p=panel(side,x+dx,y+.09,.047);rivets.push(G.stud(.0027,p,new T.Vector3(side*.5,0,1)));}
          }
          emit('chest',id,'dark',plates);emit('chest',id,'brass',rivets);
        }
        // A short split coat skirt follows each hip, leaving the legs free.
        if(coat){
          const skirt=(u,v)=>{
            const a=side*mix(.055,.45,u),r=.23+v*.027+.004*Math.sin(u*PI*5),y=.97-v*((sea?.215:mourning?.39:.31)+.025*Math.sin(u*PI));
            return[Math.sin(a*TAU)*r,y,cz+Math.cos(a*TAU)*r];
          };
          part('chest',id,'cloth',G.shell(34,20,skirt,.008,false,side>0),null,{bones:['pelvis','spine01']});
          piping('chest',id,'strap',u=>skirt(u,1),'pelvis',.003);
        }
      }
      const rearPanel=G.shell(40,20,(u,v)=>back(u,v),.007,false);G.uvScale(rearPanel,1.15,.88);part('chest',id,coat?'cloth':'leather',rearPanel);
      for(const edge of[0,1]){piping('chest',id,'strap',u=>back(u,edge,.034),null,.003);stitch(u=>back(u,edge?.98:.02,.037),56);}
      for(const u of[.22,.5,.78]){
        piping('chest',id,'strap',v=>back(u,v,.032),null,.002);
        stitch(v=>back(u+.009,v,.035),40);
      }
      // Wide curved shoulder bridges connect front and back above the armholes.
      for(const side of[-1,1]){
        const strap=(u,v)=>{
          const f=v3(panel(side,.43+u*.12,1,.032)),b=v3(back(side>0?.22-u*.05:.78+u*.05,1,.032));
          const p=f.lerp(b,v);p.y+=.055*Math.sin(v*PI);const skin=A.nearest(p,['skin']);
          return skin?[skin.x+skin.nx*.012,skin.y+skin.ny*.012,skin.z+skin.nz*.012]:p.toArray();
        };
        part('chest',id,'leather',G.shell(8,24,strap,.01,false));
        for(const e of[0,1]){piping('chest',id,'strap',v=>strap(e,v),null,.0025);stitch(v=>strap(e,v),24);}
      }
      emit('chest',id,'strap',seams);emit('chest',id,'rag',thread);
      // Waist belt is separate hardware, with a tongue, keeper and dark holes.
      part('chest',id,'strap',G.shell(64,5,(u,v)=>chest(u,.19+v*.075,.046),.005,true),null,{bones:['pelvis','spine01']});
      const bp=chest(.035,.228,.057),buckle=G.buckle(.048,.038,.004);buckle.rotateY(.035*TAU);buckle.translate(...bp);part('chest',id,'brass',buckle,'spine01');
      piping('chest',id,'brass',t=>[bp[0]-.014+t*.027,bp[1],bp[2]+.006],'spine01',.0018);
      studs('chest',id,u=>chest(.07+u*.09,.228,.053),6,'spine01','dark',.0018);
      if(style===0){
        shoulder(id,'L','leather');
        const patches=[],nails=[];
        for(const side of[-1,1])for(let row=0;row<3;row++){
          const x=.28,y=.23+row*.19;
          patches.push(G.shell(16,8,(u,v)=>panel(side,x+u*.43,y+v*.13,.042),.007,false,side<0));
          for(const u of[.32,.65]){const p=panel(side,u,y+.075,.050);nails.push(G.stud(.0038,p,new T.Vector3(side*.35,0,1)));}
        }
        emit('chest',id,'strap',patches);emit('chest',id,'brass',nails);
        // A diagonal load-bearing harness lies on the leather, with a keeper.
        for(const side of[-1,1])part('chest',id,'strap',G.shell(6,32,(u,v)=>panel(side,.34+v*.32+(u-.5)*.085,.15+v*.79,.052),.004,false,side<0));
      }
      if(armored)['L','R'].forEach(s=>shoulder(id,s,'dark'));
      if(coat)for(const side of['L','R']){
        const upper='upper_arm'+side,fore='forearm'+side,hand='hand'+side;
        part('chest',id,'cloth',garmentSleeve(upper,fore,.02,1.005,.013,.006,['skin'],.004).geometry,upper);
        part('chest',id,'cloth',garmentSleeve(fore,hand,-.02,.82,.009,.005,['skin'],.004).geometry,fore);
        const cuff=sleeve(A,fore,hand,.73,.84,.021,.005,['skin']);part('chest',id,'strap',cuff.geometry,fore);
        piping('chest',id,'brass',u=>cuff.at(u*TAU,.76,.005)[0].toArray(),fore,.0018);
        if(!mourning)shoulder(id,side,sea&&side==='L'?'salt':'leather',sea&&side==='L'?'salt':null);
      }
    }
    function warSkirt(id,mat,plate) {
      const guard=[],trim=[],bolts=[];
      for(const sign of[-1,1])for(let leaf=0;leaf<2;leaf++){
        const u0=sign*(.014+leaf*.102),width=.101;
        const flap=(u,v)=>{
          const a=u0+sign*u*width,waist=chest(a,.17,.055),r=Math.hypot(waist[0],waist[2]-cz)+v*.020+.006*Math.sin(u*PI),
            y=1.002-v*((id==='torn-chest'?.18:id==='grave-chest'?.155:id==='warden-chest'?.205:.235)-leaf*.02)+.025*v*v*Math.pow(Math.abs(u-.5)*2,2);
          return[Math.sin(a*TAU)*r,y,cz+Math.cos(a*TAU)*r];
        };
        guard.push(G.shell(12,18,flap,plate?.009:.01,false,sign>0,{rim:.0017}));
        trim.push(G.tube(line(u=>flap(u,1),20),.0026,6,20,true));
        for(const u of[.16,.84]){const p=flap(u,.08);bolts.push(G.stud(.0043,p,new T.Vector3(Math.sin(u0*TAU),0,Math.cos(u0*TAU))));}
        if(plate)trim.push(G.tube(line(v=>flap(.5,.10+v*.76),20),.0022,5,20,true));
      }
      emit('chest',id,mat,guard,null,{bones:['pelvis','spine01']});
      emit('chest',id,plate?'edge':'strap',trim,'pelvis');emit('chest',id,'brass',bolts,'pelvis');
    }
    function garmentSleeve(from,to,t0,t1,offset,thickness,keys,fold=.004) {
      const original=sleeve(A,from,to,t0,t1,offset,thickness,keys),a=A.P(from),axis=A.P(to).sub(a),len=axis.length();axis.multiplyScalar(1/len);
      const at=(angle,t,lift=0)=>{
        const v=clamp((t-t0)/(t1-t0),0,1),out=original.at(angle,t,lift),center=a.clone().addScaledVector(axis,t*len),radial=out[0].clone().sub(center);
        // Fabric narrows at knee/cuff and carries broad stitched fold valleys.
        radial.multiplyScalar(1-.085*Math.pow(v,3));
        const wrinkle=fold*Math.sin(v*PI)*Math.sin(v*PI*3+Math.sin(angle)*.6)*(.45+.55*Math.pow(Math.cos(angle),2));
        out[0]=center.add(radial).addScaledVector(out[1],wrinkle);return out;
      };
      original.geometry.dispose();
      const geometry=G.shell(32,12,(u,v)=>at(u*TAU,mix(t0,t1,v))[0].toArray(),thickness,true);G.uvScale(geometry,.85,.85);
      return{geometry,at};
    }
    function facingAngle(cover) {
      const n0=cover.at(0,.5,0)[1],n90=cover.at(PI/2,.5,0)[1];
      return Math.atan2(n90.z,n0.z);
    }
    function armUnderlayer(id,style) {
      const torso=(u,v)=>{
        const side=Math.abs(Math.sin(u*TAU)),top=1.535-.175*Math.pow(side,9)+.085*Math.exp(-Math.pow((side-.66)/.21,2)),y=mix(.92,top,v);
        return chest(u,(y-.89)/(1.51-.135*Math.pow(side,3)-.89),.013,false);
      };
      part('chest',id,'cloth',G.shell(48,24,torso,.004,true));
      piping('chest',id,'strap',u=>torso(u,1),null,.0023);

      for(const side of['L','R']) {
        const upper='upper_arm'+side,fore='forearm'+side,hand='hand'+side;
        const cover=sleeve(A,upper,fore,.16,1.025,.015,.005,['skin']);
        part('chest',id,'cloth',cover.geometry,upper);
        const lower=sleeve(A,fore,hand,-.035,.43,.010,.004,['skin']);
        part('chest',id,'cloth',lower.geometry,fore);
        // A sewn quilted arming doublet supports the plates; the elbow stays articulated.
        const front=facingAngle(cover);
        for(let row=0;row<6;row++)piping('chest',id,'strap',u=>cover.at(u*TAU,.25+row*.10,.003)[0].toArray(),upper,.0013);
        for(const a of[front-PI*.62,front+PI*.62])piping('chest',id,'strap',v=>cover.at(a,.19+v*.77,.004)[0].toArray(),upper,.0022);
        if(style===6)continue;
        if(style===1||style===7||style===8){
          const brace=sleeve(A,fore,hand,.26,.78,.021,.006,['skin']),face=facingAngle(brace),steel=style===8?'dark':'steel',lames=[];
          for(let n=0;n<2;n++)lames.push(G.shell(12,8,(u,v)=>brace.at(face+mix(-.92,.92,u),.30+n*.20+v*.19,.007)[0].toArray(),.005,false));
          emit('chest',id,steel,lames,fore);
          for(const t of[.31,.71])part('chest',id,'edge',G.tube(line(u=>brace.at(face+mix(-.92,.92,u),t,.014)[0].toArray(),24),.0024,5,24,true),fore);
        }
        const joint=A.P(fore),skin=A.box(A.cloud([fore],['skin'],.45));
        const center=skin.getCenter(new T.Vector3()),z=Math.max(joint.z+.070,center.z+.068),sign=side==='L'?1:-1;
        const elbow=G.extrude([[-.048,.018],[-.028,.049],[0,.059],[.035,.042],[.054,.006],[.034,-.039],[0,-.052],[-.037,-.032]],.019,.006);
        elbow.translate(joint.x,joint.y,z);part('chest',id,style===2?'salt':style===8?'dark':'steel',elbow,fore);
        const wing=G.extrude([[0,.018],[sign*.038,.047],[sign*.071,.021],[sign*.079,-.008],[sign*.040,-.037],[0,-.023]],.009,.003);
        wing.translate(joint.x+sign*.039,joint.y,z-.008);part('chest',id,'dark',wing,fore);
        part('chest',id,'brass',G.stud(.0045,[joint.x+sign*.038,joint.y,z+.012],[0,0,1]),fore);
      }
    }
    // Complete tailored underlayers and articulated leg armor follow native joints.
    function legwear(id,style) {
      const heavy=[1,4,7].includes(style), leather=[0,2,3,5].includes(style);
      for(const side of['L','R']) {
        const thigh='thigh'+side,shin='shin'+side,foot='tarsal'+side;
        const upper=garmentSleeve(thigh,shin,.04,1.005,.009,.004,['skin'],.0035);
        const lower=garmentSleeve(shin,foot,-.015,.96,.010,.004,['skin'],.0045);
        if(style!==0)part('chest',id,leather?'leather':'cloth',upper.geometry,thigh);
        part('chest',id,leather?'leather':'cloth',lower.geometry,shin);
        for(const a of[-PI*.50,PI*.50]) {
          piping('chest',id,'strap',t=>upper.at(a,.08+t*.85,.005)[0].toArray(),thigh,.0019);
          piping('chest',id,'strap',t=>lower.at(a,.07+t*.78,.004)[0].toArray(),shin,.0016);
        }
        if(leather) {
          const stitches=[];
          for(const a of[-PI*.50,PI*.50])for(let n=0;n<32;n++) {
            const p=upper.at(a,.10+n*.025,.006)[0],q=upper.at(a+.023,.108+n*.025,.006)[0];
            stitches.push(G.tube([p.toArray(),q.toArray()],.0009,4,2,true));
          }
          emit('chest',id,'rag',stitches,thigh);
        }
        if(!heavy||style===2&&side==='R')continue;
        const armorMat=style===2?'salt':style===8?'dark':'steel';
        const upperPlate=sleeve(A,thigh,shin,.23,.85,.027,.006,['skin']);
        const front=facingAngle(upperPlate);
        const plate=(u,v)=>upperPlate.at(front+mix(-PI*.64,PI*.64,u),.23+v*.61,.004+.007*Math.pow(Math.cos(mix(-PI*.64,PI*.64,u)),8))[0].toArray();
        part('chest',id,armorMat,G.shell(36,22,plate,.006,false),thigh);
        for(const edge of[0,1])piping('chest',id,'edge',u=>plate(u,edge),thigh,.0026);
        for(const edge of[0,1])piping('chest',id,'brass',v=>plate(edge,v),thigh,.0022);
        for(const u of[.33,.5,.67])piping('chest',id,armorMat,v=>{const p=plate(u,.12+v*.75);p[2]+=.005;return p;},thigh,.0023);
        for(const t of[.29,.77])part('chest',id,'strap',G.shell(40,3,(u,v)=>upper.at(u*TAU,t+v*.037,.023)[0].toArray(),.004,true),thigh);
        const knee=A.P(shin),skin=A.box(A.cloud([shin],['skin'],.42)),center=skin.getCenter(new T.Vector3());
        const kp=new T.Vector3(knee.x,knee.y+.012,Math.max(knee.z+.086,center.z+.070));
        const poleyn=G.extrude([[-.058,.032],[-.035,.064],[0,.076],[.035,.064],[.058,.032],[.050,-.034],[0,-.066],[-.050,-.034]],.024,.008);
        poleyn.translate(kp.x,kp.y,kp.z);part('chest',id,armorMat,poleyn,shin);
        part('chest',id,'edge',G.tube([[kp.x,kp.y-.045,kp.z+.017],[kp.x,kp.y+.012,kp.z+.023],[kp.x,kp.y+.052,kp.z+.017]],.0028,6,16,true),shin);
        const sign=side==='L'?1:-1;
        const wing=G.extrude([[0,.026],[sign*.042,.035],[sign*.070,.004],[sign*.037,-.030],[0,-.023]],.014,.004);
        wing.translate(kp.x+sign*.044,kp.y,kp.z-.008);part('chest',id,'dark',wing,shin);
        part('chest',id,'brass',G.stud(.005,[kp.x+sign*.043,kp.y,kp.z+.015],[0,0,1]),shin);
      }
    }

    const chestIDs=['torn-chest','grave-chest','coast-chest','brigandine-chest','lamellar-chest','sailcoat-chest','chainmail-chest','warden-chest','rib-chest'];
    chestIDs.forEach((id,k)=>{
      legwear(id,k);
      if([1,4,6,7,8].includes(k))armUnderlayer(id,k);
      if(k===0){barbarianChest(id,false);return;}
      if(k===2||k===3){tailoredChest(id,2);return;}
      if(k===5){tailoredChest(id,2);return;}
      const plate=[1,2,7].includes(k), mat=plate?(k===2?'salt':k===7?'dark':'steel'):k===6?'mail':'leather';
      if(plate){
        // Each set is built from different functional plates. No rear slab:
        // the existing mail underlayer carries thin straps on a natural back.
        const forge=(poly,matKey,y=.0)=>{
          const g=curveReady(G.extrude(poly,.008,.0035),.030),p=g.attributes.position;
          for(let i=0;i<p.count;i++){
            const x=p.getX(i),height=p.getY(i)+y,front=chest(0,clamp((height-.89)/.62,0,1),.025),r=Math.max(.18,front[2]-cz),z=cz+Math.sqrt(Math.max(.010,r*r-x*x));
            p.setXYZ(i,x,height,z+p.getZ(i));
          }G.smoothNormals(g,.7);G.uvScale(g,4.2,4.2);part('chest',id,matKey,g,'spine02');
        };
        if(k===1){
          forge([[-.155,1.35],[-.10,1.44],[0,1.43],[.10,1.44],[.155,1.35],[.145,1.13],[.095,1.07],[-.095,1.07],[-.145,1.13]],'steel');
          for(const side of[-1,1])forge([[side*.15,1.34],[side*.235,1.29],[side*.23,1.09],[side*.16,1.065]],'dark');
        }else if(k===2){
          forge([[.015,1.43],[.175,1.405],[.225,1.31],[.18,1.13],[.025,1.115],[-.005,1.25]],'salt');
          forge([[-.21,1.27],[-.115,1.34],[-.025,1.22],[-.045,1.05],[-.17,1.035]],'strap');
          for(const side of[-1,1])part('chest',id,'strap',G.shell(5,20,(u,v)=>chest(side*(.028+v*.10)+(u-.5)*.028,.18+v*.72,.040),.005,false,side<0));
        }else{
          forge([[-.16,1.395],[-.085,1.455],[0,1.37],[.085,1.455],[.16,1.395],[.125,1.14],[0,1.075],[-.125,1.14]],'dark');
          for(const side of[-1,1])forge([[side*.14,1.34],[side*.24,1.30],[side*.225,1.095],[side*.125,1.135]],'steel');
          const spine=G.extrude([[-.012,1.38],[.012,1.38],[.028,1.12],[0,1.08],[-.028,1.12]],.010,.003);spine.translate(0,0,chest(0,.52,.036)[2]);part('chest',id,'edge',spine,'spine02');
        }
        for(const side of[-1,1]){
          const strap=(u,v)=>chest(.5+side*(.02+v*.18)+(u-.5)*.019,.14+v*.71,.020);
          part('chest',id,'strap',G.shell(4,18,strap,.003,false,side<0));
        }
      }else{
        const shell=G.shell(48,24,(u,v)=>chest(u,v,k===6?.018:.025,false),.004,true);G.uvScale(shell,k===6?1.9:1.5,k===6?1.3:1.2);part('chest',id,mat,shell);
        [0,1].forEach(v=>piping('chest',id,'strap',u=>chest(u,v,.029),null,.0026));
      }
      ['L','R'].forEach(side=>{
        if(k===6)return;
        const style=k===1?'iron':k===2?'salt':k===8?'ritual':k===7||k===4?'warden':null;
        shoulder(id,side,k===2?(side==='L'?'salt':'strap'):k===8?'bone':k===7?'dark':'steel',style);
      });
      if(k===4){
        const scales=[],rivets=[],cells=[],spines=['spine01','spine02','spine03'];
        for(let row=0;row<7;row++)for(let col=0;col<16;col++){
          const u=(col+(row%2)*.5)/16,v=.03+row*.132;
          const scale=G.shell(5,4,(x,y)=>chest(u+(x-.5)*.059,v+y*.142,.034+.004*Math.sin(y*PI),true),.004,false),riv=[];
          for(const du of[-.018,.018]){const p=chest(u+du,v+.08,.040,true);riv.push(G.stud(.0024,p,new T.Vector3(Math.sin(u*TAU),0,Math.cos(u*TAU))));}
          const height=chest(u,v+.0565)[1],lower=height<A.P(spines[1]).y?0:1,lo=A.P(spines[lower]).y,hi=A.P(spines[lower+1]).y,blend=clamp((height-lo)/Math.max(.001,hi-lo),0,1);
          scales.push(scale);rivets.push(...riv);cells.push({scale,riv,weights:[[spines[lower],1-blend],[spines[lower+1],blend]]});
        }
        // Preserve the original merged wear field; only the plate attachment changes.
        for(const pieces of[scales,rivets]){
          const merged=G.merge(pieces);G.wear(merged,{edge:.85});let offset=0;
          for(const piece of pieces){const count=piece.attributes.position.count;piece.setAttribute('kwear',new T.BufferAttribute(merged.attributes.kwear.array.slice(offset*4,(offset+count)*4),4));offset+=count;}
          merged.dispose();
        }
        for(const cell of cells){part('chest',id,'steel',cell.scale,null,{rigidWeights:cell.weights});emit('chest',id,'brass',cell.riv,null,{rigidWeights:cell.weights});}
      }
      if(k===6){
        const rim=[];for(let n=0;n<48;n++){const u=n/48,q=chest(u,.04,.026),g=G.ring(.007,.0014,null,null,3,8);g.rotateX(PI/2);g.rotateY(u*TAU);g.translate(...q);rim.push(g);}emit('chest',id,'steel',rim);
        const harness=[];for(const side of[-1,1])harness.push(G.shell(4,20,(u,v)=>chest(side*(.018+v*.09)+(u-.5)*.018,.23+v*.65,.027),.003,false,side<0));emit('chest',id,'strap',harness);
      }
      // Overlapping waist lames protect the front only. Rear rings created the
      // protruding ruffled silhouette and are unnecessary beneath a backplate.
      if(plate){for(let l=0;l<3;l++){part('chest',id,mat,G.shell(28,5,(u,v)=>{const p=chest((u-.5)*.47,.09,.027+l*.006,true);p[1]-=.02+l*.034+v*.043;return p;},.006,false),null,{bones:['pelvis','spine01']});}}
      if(k===8){
        // Flattened carved bone splints are fitted into the cuirass leather:
        // broad low relief, not independent projecting tusks.
        const ribs=[];
        for(const side of[-1,1])for(let row=0;row<3;row++){
          const rib=(u,v)=>{
            const width=.012+.028*Math.sin(u*PI),level=.33+row*.17+.028*Math.sin(u*PI)-u*.08+(v-.5)*width;
            return chest(side*(.018+u*.135),level,.034+.0015*Math.sin(v*PI));
          };
          ribs.push(G.shell(20,4,rib,.003,false,side<0));
        }emit('chest',id,'bone',ribs);
        for(const side of[-1,1])part('chest',id,'strap',G.shell(4,20,(u,v)=>chest(side*(.15+(u-.5)*.02),.18+v*.72,.028),.003,false),'spine02');
      }
      if(k===6){
        // A split flexible mail hem replaces the broad metal tassets.
        const skirt=(u,v)=>{const a=.045+u*.91,p=chest(a,0,.018);return[p[0]*(1+v*.06),.915-v*.205,p[2]+(p[2]-cz)*v*.04];};
        part('chest',id,'mail',G.shell(40,8,skirt,.003,false),null,{bones:['pelvis','spine01']});
        const links=[];for(let row=0;row<1;row++)for(let col=0;col<48;col++){
          const u=(col+(row%2)*.5)/48,q=skirt(u,.95),g=G.ring(.008,.0016,null,null,3,8);
          g.rotateX(PI/2);g.rotateY((.045+u*.91)*TAU);g.translate(q[0],q[1],q[2]+Math.cos((.045+u*.91)*TAU)*.006);links.push(g);
        }emit('chest',id,'steel',links,null,{bones:['pelvis','spine01']});
      }else warSkirt(id,plate?mat:'leather',plate);
      // A broad leather belt, with a bevelled buckle and punched fastening holes.
      part('chest',id,'strap',G.shell(48,4,(u,v)=>chest(u,.095+v*.07,.040,plate),.004,true),null,{bones:['pelvis','spine01']});
      const bp=chest(0,.13,.047,plate),buckle=G.buckle(.045,.032,.0035);buckle.translate(...bp);part('chest',id,'brass',buckle,'spine01');
      studs('chest',id,u=>chest(.03+u*.1,.13,.045,plate),7,'spine01','dark',.002);
    });
    const headBox=A.box(A.cloud(['head'],['skin'],.6)),hc=headBox.getCenter(new T.Vector3()),hs=headBox.getSize(new T.Vector3());
    const rx=hs.x*.54+.012,rz=hs.z*.53+.012,ry=hs.y*.56+.012;
    ['cloth-hood','prayer-hood','buried-hood'].forEach((id,k)=>{
      const p=(u,v)=>{const a=mix(k===0?.91:k===1?.65:.80,TAU-(k===0?.91:k===1?.65:.80),u),e=mix(-.70,PI/2-.008,v),r=1+.018*Math.sin(a*10+v*3)*(1-v);return[hc.x+Math.sin(a)*Math.cos(e)*rx*r,hc.y+Math.sin(e)*ry+(k===1?.047:k===2?.012:.023)*Math.pow(v,5),hc.z+Math.cos(a)*Math.cos(e)*rz*r-.012*v];};
      part('head',id,'cloth',G.shell(40,22,p,.006,false),'head');
      for(const edge of[0,1])piping('head',id,'strap',v=>p(edge,v),'head',.0028);
      part('head',id,'cloth',G.shell(48,18,(u,v)=>{const a=u*TAU,r=mix(.071,.20+k*.01,v);return[hc.x+Math.sin(a)*r,hc.y-ry*.56-v*(k===0?.095:k===1?.24:.17)+Math.sin(a*12)*.006*v,hc.z+Math.cos(a)*r*.76];},.006,true),'spine03');
    });
    ['iron-helm','drowned-helm','sealed-mask','furnace-mask','bell-helm','bone-crown','warden-crown'].forEach((id,k)=>{
      const mat=k===1?'salt':k===3||k===6?'dark':'steel';
      const band=(u,v)=>{const a=u*TAU;return[hc.x+Math.sin(a)*(rx+.006),hc.y+ry*(.35+v*.22),hc.z+Math.cos(a)*(rz+.005)];};
      if(k>=5){
        // Crowns are actual open headbands; the skull and face remain visible.
        part('head',id,k===5?'leather':'dark',G.shell(36,4,band,.005,true),'head');
        const teeth=[],count=k===5?5:3;
        for(let i=0;i<count;i++){
          const a=mix(-1.22,1.22,i/(count-1)),w=k===5?.024:.037,h=k===5?.060:.041;
          const plate=G.extrude([[-w,0],[w,0],[w*.68,h*.66],[0,h],[-w*.68,h*.66]],.007,.002);
          plate.rotateY(a);plate.translate(hc.x+Math.sin(a)*(rx+.009),hc.y+ry*.52,hc.z+Math.cos(a)*(rz+.013));teeth.push(plate);
        }emit('head',id,k===5?'bone':'steel',teeth,'head');return;
      }
      const dome=(u,v)=>{
        const a=u*TAU,front=Math.max(0,Math.cos(a)),e=mix(-.17+.41*Math.pow(front,6),PI/2-.004,v),flat=k===3?.88+.12/Math.max(Math.abs(Math.sin(a)),Math.abs(Math.cos(a))):1;
        const height=k===0?1.19:k===1?1.055:k===4?1.055:1.04;
        return[hc.x+Math.sin(a)*Math.cos(e)*rx*flat,hc.y+Math.sin(e)*ry*height,hc.z+Math.cos(a)*Math.cos(e)*rz*flat];
      };
      part('head',id,mat,G.shell(k===3?24:40,18,dome,.006,true),'head');
      piping('head',id,'edge',u=>dome(u,0),'head',.003);
      if(k===0||k===1||k===4){
        // Open nasal, low sallet, and bell helmets have different face openings.
        for(const side of[-1,1]){
          const guard=G.extrude(k===0?[[-.020,.041],[.019,.032],[.021,-.048],[0,-.069],[-.019,-.052]]:[[-.026,.022],[.028,.019],[.039,-.021],[.015,-.049],[-.026,-.032]],.007,.002);
          guard.rotateY(side*.65);guard.translate(hc.x+side*rx*.79,hc.y-ry*.22,hc.z+rz*.52);part('head',id,mat,guard,'head');
        }
        if(k===0){
          const nose=G.extrude([[-.011,.029],[.011,.029],[.014,-.050],[0,-.071],[-.014,-.050]],.008,.002);nose.translate(hc.x,hc.y+ry*.30,hc.z+rz+.009);part('head',id,'steel',nose,'head');
          part('head',id,'dark',G.shell(5,20,(u,v)=>{const e=mix(.15,PI-.16,v);return[hc.x+(u-.5)*.010,hc.y+Math.sin(e)*ry*1.20,hc.z+Math.cos(e)*(rz+.005)];},.004,false),'head');
        }else{
          const rim=(u,v)=>{const a=u*TAU,back=Math.max(0,-Math.cos(a)),p=dome(u,0),r=(k===4?.036:.025)*v;return[p[0]+Math.sin(a)*r,p[1]-v*(.014+back*.043),p[2]+Math.cos(a)*r*(1+back*.75)];};
          part('head',id,mat,G.shell(40,5,rim,.004,true),'head');
        }
      }else{
        const eyeY=ry*.17,eyeW=rx*.52,eyeH=.009;
        const vents=k===2?[[[-eyeW,eyeY-eyeH],[eyeW,eyeY-eyeH],[eyeW,eyeY+eyeH],[-eyeW,eyeY+eyeH]]]:[-1,1].map(side=>[[side*.012,eyeY-eyeH],[side*(eyeW+.013),eyeY-eyeH],[side*(eyeW+.013),eyeY+eyeH],[side*.012,eyeY+eyeH]]);
        for(const side of[-1,1])vents.push([[side*.020,-ry*.30],[side*.053,-ry*.30],[side*.050,-ry*.45],[side*.020,-ry*.45]]);
        const outline=k===3?[[-rx*.90,ry*.36],[rx*.90,ry*.36],[rx*.94,-ry*.56],[rx*.54,-ry*.91],[-rx*.54,-ry*.91],[-rx*.94,-ry*.56]]:[[-rx*.76,ry*.36],[rx*.76,ry*.36],[rx*.91,-ry*.39],[0,-ry*.99],[-rx*.91,-ry*.39]];
        const face=curveReady(G.extrude(outline,.008,.0015,vents),.018),p=face.attributes.position;
        for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=hc.z+rz+.015-(k===3?.065:.085)*Math.pow(x/rx,2);p.setXYZ(i,hc.x+x,hc.y+y,z+p.getZ(i));}
        face.computeVertexNormals();G.uvScale(face,4,4);part('head',id,k===3?'dark':'steel',face,'head');
      }
    });
    for(const s of['L','R']){
      const fore='forearm'+s,hand='hand'+s,shin='shin'+s,foot='tarsal'+s;
      const hb=A.box(A.cloud([hand],['skin'],.5)),c=hb.getCenter(new T.Vector3()),sz=hb.getSize(new T.Vector3());
      ['rag-wraps','chain-gloves','salt-gauntlets','claw-gauntlets','warden-grasp'].forEach((id,k)=>{
        const length=k===0?.74:k===1?.91:k===2?.82:k===3?.94:.96;
        const cover=sleeve(A,fore,hand,k===3?.26:k===4?.22:.56,length,.012,.004,BODY);
        part('hands',id,k?'leather':'rag',cover.geometry,fore);
        const front=facingAngle(cover);
        if(!k){
          const bands=[];for(let n=0;n<3;n++)bands.push(G.shell(24,3,(u,v)=>cover.at(u*TAU,.58+n*.065+v*.05+.012*Math.sin(u*TAU),.003)[0].toArray(),.003,true));emit('hands',id,'cloth',bands,fore);return;
        }
        if(k===1){
          const mail=sleeve(A,fore,hand,.70,.93,.017,.004,BODY);part('hands',id,'mail',mail.geometry,fore);
        }else{
          const plate=(u,v)=>{const a=front+mix(k===4?-1.00:-.77,k===4?1.00:.77,u),t=(k===2?.58:k===3?.27:.23)+v*(k===2?.22:k===3?.54:.53);return cover.at(a,t,.008+.003*Math.sin(u*PI))[0].toArray();};
          part('hands',id,k===2?'salt':k===3?'steel':'dark',G.shell(16,12,plate,.006,false),fore);
          for(const edge of[0,1])piping('hands',id,'edge',u=>plate(u,edge),fore,.0025);
          if(k===4){const cuff=sleeve(A,fore,hand,.23,.35,.029,.006,BODY);part('hands',id,'dark',cuff.geometry,fore);}
        }
        for(const t of[k===1?.72:.58,.79])part('hands',id,'strap',G.shell(24,3,(u,v)=>cover.at(u*TAU,t+v*.033,.004)[0].toArray(),.003,true),fore);
        // A fitted hand back, leaving the palm flexible and each finger joint free.
        const back=(u,v)=>[mix(hb.min.x-.004,hb.max.x+.004,u),hb.max.y+.007+.005*Math.sin(u*PI),mix(hb.min.z-.003,hb.max.z+.005,v)];
        part('hands',id,'leather',G.shell(12,8,back,.004,false),hand);
        if(k===1)part('hands',id,'mail',G.shell(12,5,(u,v)=>back(u,.28+v*.70),.003,false),hand);
        else{
          const plates=[];for(let n=0;n<(k===3?3:2);n++){const g=G.extrude([[-.013,.009],[.013,.009],[.018,-.008],[0,-.014],[-.018,-.008]],.007,.002);g.rotateX(-PI/2);g.translate(mix(hb.min.x,hb.max.x,(n+.5)/(k===3?3:2)),hb.max.y+.018,c.z+sz.z*.28);plates.push(g);}emit('hands',id,k===2?'salt':k===3?'steel':'dark',plates,hand);
        }
        for(const name of Object.keys(A.index).filter(n=>n.startsWith('finger_')&&n.endsWith(s))){
          const start=A.P(name),end=A.tail(name);if(!end||end.distanceTo(start)<.009)continue;
          const mid=start.clone().lerp(end,.38);part('hands',id,k===1?'leather':k===2?'salt':k===3?'steel':'dark',G.sphere(.008,mid.toArray(),[1,.55,1.35],8,5),name);
        }
      });
      const fb=A.box(A.cloud([foot,'toe'+s],['skin'],.35)),fc=fb.getCenter(new T.Vector3()),fs=fb.getSize(new T.Vector3());
      ['worn-boots','grave-boots','tide-boots','shackle-boots','crown-boots'].forEach((id,k)=>{
        const top=k===0?.72:k===2?.76:k===3?.64:.47,cover=sleeve(A,shin,foot,top,1.02,.012,.005,BODY);
        part('boots',id,'leather',cover.geometry,shin);
        const sole=fb.min.y-.012,w=Math.max(fs.x*.58,.055),length=Math.max(fs.z*.6,.115);
        const shoe=(u,v)=>{const a=u*TAU,e=v*PI/2,r=Math.cos(e),toe=k===4?1.06:k===2?.94:1;return[fc.x+Math.sin(a)*w*(.91+.09*Math.cos(a))*r,sole+.018+Math.sin(e)*Math.max(fs.y*.82,.069)*(1-.20*Math.cos(a)),fc.z+Math.cos(a)*length*r*toe];};
        part('boots',id,'leather',G.shell(32,14,shoe,.005,true),foot);
        part('boots',id,'strap',G.shell(32,3,(u,v)=>{const p=shoe(u,0);p[1]=sole+v*.026;return p;},.009,true),foot);
        for(const t of[k===0?.76:.68,.90])part('boots',id,'strap',G.shell(24,3,(u,v)=>cover.at(u*TAU,t+v*.035,.004)[0].toArray(),.003,true),shin);
        for(const u of[.12,.88])piping('boots',id,'strap',v=>shoe(u,.04+v*.82),foot,.0017);
        if(k===1||k===4){
          const greave=sleeve(A,shin,foot,k===4?.44:.52,.89,.026,.006,BODY),front=facingAngle(greave),span=k===4?1.16:.76;
          const plate=(u,v)=>greave.at(front+mix(-span,span,u),(k===4?.44:.53)+v*(k===4?.43:.34),.007+.004*Math.sin(u*PI))[0].toArray();
          part('boots',id,k===4?'dark':'steel',G.shell(18,12,plate,.007,false),shin);
          for(const edge of[0,1])piping('boots',id,'edge',u=>plate(u,edge),shin,.0025);
          if(k===4){for(let row=0;row<3;row++)part('boots',id,'steel',G.shell(14,5,(u,v)=>shoe(.84+u*.32,.12+row*.17+v*.15),.004,false),foot);}
        }else if(k===2){
          part('boots',id,'salt',G.shell(18,9,(u,v)=>shoe(.83+u*.34,.02+v*.43),.005,false),foot);
          piping('boots',id,'edge',u=>shoe(.83+u*.34,.45),foot,.0022);
        }else if(k===3){
          const shackle=sleeve(A,shin,foot,.86,.94,.023,.005,BODY);part('boots',id,'dark',shackle.geometry,shin);
          const q=shackle.at(0,.90,.009)[0];part('boots',id,'dark',G.buckle(.022,.025,.004).translate(q.x,q.y,q.z),shin);
        }else{
          const welt=[];for(let n=0;n<28;n++){const p=shoe(n/28,0),q=shoe((n+.45)/28,0);p[1]+=.020;q[1]+=.020;welt.push(G.tube([p,q],.001,4,2,true));}emit('boots',id,'rag',welt,foot);
        }
      });
    }
    // Catalog-specific fittings are separate, joint-bound parts. The shared core
    // remains efficient while each named piece has its own physical silhouette.
    const plainArmor=new Set(['torn-chest','grave-chest','coast-chest','cloth-hood','iron-helm','drowned-helm','rag-wraps','chain-gloves','salt-gauntlets','worn-boots','grave-boots','tide-boots']);
    const armorCatalog=B.Progression.items.filter(item=>item.slot!=='weapon'&&!plainArmor.has(item.id));
    armorCatalog.forEach((item,index)=>{
      const namedPattern={'mourner-chest':1,'empty-vow-chest':2,'salt-shroud':4,'sunken-vow-chest':4,'ruin-burial-chest':2,'warden-chainmail':3,'hollow-heart-chest':0,'sunless-vow-chest':0,'slag-burial-chest':2,'ash-warden-chest':3,'hollow-ember-chest':0,'buried-fire-chest':2};
      const id='variant@'+item.id,pattern=namedPattern[item.id]??(/bone|sealed|warden/.test(item.id)?2:/salt|sunken|tide|drowned/.test(item.id)?4:/ash|furnace|coal|forge|slag/.test(item.id)?3:/blood|mourner|prayer/.test(item.id)?1:0),mat=item.finish==='bone'?'bone':item.finish==='brine'?'salt':item.finish==='blood'?'dark':'brass';
      const hood=/hood/.test(item.id),wrap=/wrap|footwrap/.test(item.id);
      if(item.slot==='head'){
        if(hood){
          const length=.12+[.035,.080,.015,.105,.055][pattern];
          const cape=(u,v)=>{const a=mix(.45,TAU-.45,u),r=.11+v*(.13+.01*pattern),fold=.006*Math.sin(a*(12+pattern*2))*v;return[hc.x+Math.sin(a)*(r+fold),hc.y-ry*.56-v*length+.018*Math.cos(a)*v,hc.z+Math.cos(a)*(r*.78+fold)];};
          part('head',id,'cloth',G.shell(52,22,cape,.005,false),'spine03');
          for(const edge of[0,1])piping('head',id,'strap',v=>cape(edge,v),'spine03',.0021);
          piping('head',id,'rag',u=>cape(u,1),'spine03',.0014);
          for(const side of[-1,1]){
            const pin=[hc.x+side*.064,hc.y-ry*.58,hc.z+.071];part('head',id,mat,G.stud(.0055,pin,[0,0,1]),'spine03');
            part('head',id,'strap',G.tube([pin,[hc.x,hc.y-ry*.65-.032,hc.z+.10],[hc.x-side*.064,hc.y-ry*.58,hc.z+.071]],.0018,6,24,true),'spine03');
          }
        }else{
          // Named helm identity is carried by its authored core; no floating crest.
        }
      }else if(item.slot==='chest'){
        const tabardLength=[.25,.19,.33,.23,.29][pattern],sideCount=/mourner|salt-shroud|sunken-vow/.test(item.id)?0:pattern===1?1:2;
        for(let leaf=0;leaf<sideCount;leaf++){
          const side=leaf===0?1:-1;
          const cloth=(u,v)=>{const x=side*(.012+u*(pattern===1?.19:.13)),fold=.008*Math.sin(u*PI*3)*Math.sin(v*PI),y=.973-v*tabardLength+.027*v*Math.pow(Math.abs(u-.5)*2,2);return[x,y,cz+.235+v*.025+fold];};
          part('chest',id,pattern===4?'leather':'cloth',G.shell(20,24,cloth,.006,false,side<0),'pelvis');
          for(const edge of[0,1])piping('chest',id,'strap',v=>cloth(edge,v),'pelvis',.0022);
          piping('chest',id,'rag',u=>cloth(u,1),'pelvis',.0016);
          const stitches=[];for(let n=0;n<30;n++)stitches.push(G.tube([cloth(.06,.03+n*.030),cloth(.09,.044+n*.030)],.0007,4,2,true));emit('chest',id,'rag',stitches,'pelvis');
        }
        // The archetype carries armor construction. Named variants retain one
        // meaningful belt/cloth treatment instead of random plate overlays.
        const clasp=chest(.03,.18,.044),buckle=G.buckle(.048,.040,.004);buckle.rotateY(.03*TAU);buckle.translate(...clasp);part('chest',id,mat,buckle,'spine01');
      }else if(item.slot==='hands'){
        for(const side of['L','R']){
          const fore='forearm'+side,hand='hand'+side,cover=sleeve(A,fore,hand,.40,.77,.028,.004,['skin','leather']),front=facingAngle(cover);
          if(wrap){
            for(let n=0;n<3+pattern;n++){const t=.42+n*.04;part('hands',id,'strap',G.shell(32,3,(u,v)=>cover.at(u*TAU,t+v*.022,.003)[0].toArray(),.003,true),fore);}
            const knot=cover.at(front,.58,.008)[0];part('hands',id,'bone',G.stud(.005,knot,[0,0,1]),fore);
          }else{
            // A small fitted wrist fastening retains named identity without masking the glove family.
            const q=cover.at(front,.71,.008)[0];part('hands',id,mat,G.buckle(.018,.022,.002).translate(q.x,q.y,q.z),fore);
          }
        }
      }else if(item.slot==='boots'){
        for(const side of['L','R']){
          const shin='shin'+side,foot='tarsal'+side,cover=sleeve(A,shin,foot,.55,.90,.034,.004,['skin','leather']),front=facingAngle(cover);
          if(wrap||/pilgrim|mourning|worker/.test(item.id)){
            for(let n=0;n<3+pattern;n++){const t=.62+n*.046;part('boots',id,'strap',G.shell(32,3,(u,v)=>cover.at(u*TAU,t+v*.030,.005)[0].toArray(),.004,true),shin);}
          }else{
            const q=cover.at(front,.85,.007)[0];part('boots',id,mat,G.buckle(.020,.025,.002).translate(q.x,q.y,q.z),shin);
          }
        }
      }
    });

    if(B.GearArmor&&!/[?&]oldgear/.test(location.search)){try{B.GearArmor.build({A,part,sleeve,chest,hc,rx,ry,rz,facingAngle,modelOf:item=>({'no-witness-helm':'sealed-mask','forgotten-face-helm':'sealed-mask','sealed-furnace-helm':'furnace-mask','no-dawn-helm':'furnace-mask'})[item.id]||(/hood/.test(item.id)?'cloth-hood':item.modelId)});}catch(error){console.warn('gear-armor',error);}}
    const weapons={};
    const baseParts=()=>({steel:[],edge:[],dark:[],brass:[],leather:[],wood:[],bone:[]});
    function grip(P,length=.29,y=-.28) {
      G.add(P,G.grip(length,.023,12,y));
      for(const yy of[y+.02,y+length-.015])P.brass.push(G.ring(.024,.0025,[0,yy,0],null,8,28));
      P.brass.push(G.lathe([[0,-.025],[.026,-.025],[.039,-.01],[.035,.014],[.019,.025],[0,.025]],32).translate(0,y-.03,0));
    }
    const swords=[['dull-sword',0],['grave-sword',1],['widow-sword',2],['black-tide-sword',3],['slag-edge-sword',4],['hollow-crown-blade',5],['ruin-lament-sword',6],['cave-verdict-sword',7],['black-forge-sword',8]];
    swords.forEach(([id,k])=>{
      const P=baseParts(),top=[1.04,1.34,1.22,1.30,1.28,1.38,1.47,1.25,1.28][k];
      const curve=t=>k===3?.14*t*t:k===8?.10*t*t:0;
      const profile=y=>{
        const t=(y-.095)/(top-.095),tip=clamp((1-t)/.17,0,1);
        if(k===0){const edge=.046+.05*Math.sin(t*PI*.85),back=-.032+(t>.72?(t-.72)*.30:0);return[back,Math.max(back+.001,edge*clamp((1-t)/.06,0,1))];}
        if(k===1){let back=-.066-t*.044,edge=.072+t*.075;if(t>.91)back=mix(back,edge-.003,(t-.91)/.09);return[back,edge];}
        if(k===7){const w=.091+.014*Math.sin(t*PI),end=clamp((1-t)/.045,0,1);return[-w*end,w*end];}
        if(k===8){const end=clamp((1-t)/.13,0,1);return[curve(t)-.033*end,curve(t)+(.073-.022*t)*end];}
        const w=[.052,.087,.061,.080,.088,.074,.070][k]*(1-(k===6?.22:.32)*t)*tip;
        const notch=k===4?.009*Math.pow(Math.max(0,Math.sin(t*PI*12)),8)*Math.sin(t*PI):0;
        return[curve(t)-w+notch,curve(t)+w-notch];
      };
      const blade=G.blade(.095,top,80,profile,k===7?.035:.028,.24,[.28,.56]);
      if(k===8){
        // Real openwork through the thick forged spine, rather than dark painted dots.
        const left=line(t=>{const y=.095+t*(top-.095);return[profile(y)[0],y];},72);
        const right=line(t=>{const y=top-t*(top-.095);return[profile(y)[1],y];},72);
        const holes=[.38,.59,.80].map(y=>{const t=(y-.095)/(top-.095);return G.circle(.010,20,curve(t)+.004,y);});
        P.steel.push(G.extrude(left.concat(right),.025,.0018,holes));
      }else P.steel.push(blade.body);
      P.edge.push(blade.edge);
      for(const side of[-1,1]){
        const fuller=line(t=>{const y=.20+t*(top-.33);return[curve((y-.095)/(top-.095)),y,side*(k===7?.018:.0145)];},48);
        if(k!==8)P.dark.push(G.tube(fuller,k===6?.0036:.0028,6,48,true));
        P.brass.push(G.tube(fuller.slice(0,10),.0015,6,12,true));
      }
      const handle=k===6?.40:k===1?.34:.29;
      grip(P,handle,-handle);
      let guard;
      if(k===6)guard=[[-.26,.035],[-.22,.07],[-.08,.063],[0,.052],[.08,.063],[.22,.07],[.26,.035],[.24,.013],[.07,.03],[-.07,.03],[-.24,.013]];
      else if(k===7)guard=[[-.14,.036],[-.115,.10],[-.065,.083],[0,.052],[.065,.083],[.115,.10],[.14,.036],[.10,.021],[-.10,.021]];
      else if(k===8)guard=[[-.075,.036],[-.06,.09],[-.034,.10],[.034,.08],[.10,.022],[.13,-.06],[.115,-.08],[.06,.025],[-.055,.025]];
      else guard=[[-.20,.036],[-.18,.073],[-.075,.088],[0,.062],[.075,.088],[.18,.073],[.20,.036],[.17,.025],[.067,.048],[-.067,.048],[-.17,.025]];
      P.dark.push(G.extrude(guard,.044,.006));
      P.brass.push(G.tube(guard.slice(0,k===8?6:7).map(p=>[p[0],p[1],.026]),.0025,6,36,true));
      P.steel.push(G.extrude([[-.043,.058],[.043,.058],[.04,.15],[-.04,.15]],.032,.003));
      for(const side of[-1,1]){
        P.brass.push(G.stud(.006,[0,.085,side*.024],[0,0,side]));
        for(let i=0;i<(k===7?3:5);i++){const y=.24+i*.10;P.dark.push(G.tube([[-.009,y-.011,side*.018],[0,y+.011,side*.018],[.009,y-.011,side*.018]],.0013,5,6,true));}
      }
      if(k===5)for(const side of[-1,1]){
        P.brass.push(G.extrude([[side*.055,.077],[side*.13,.105],[side*.19,.19],[side*.18,.10],[side*.22,.08],[side*.18,.035],[side*.065,.051]],.025,.003));
        P.brass.push(G.tube([[side*.015,.19,.020],[side*.023,.31,.020],[side*.017,.43,.020]],.0018,6,20,true));
      }
      if(k===2)P.bone.push(G.ring(.028,.004,[0,-.305,0],null,8,32));
      if(k===5){const jewel=G.extrude([[0,-.012],[.01,0],[0,.016],[-.01,0]],.008,.002);jewel.translate(0,-.32,.033);P.bone.push(jewel);}
      if(k===6)P.steel.push(G.lathe([[0,-.035],[.024,-.03],[.034,0],[.025,.025],[0,.03]],24).translate(0,-.465,0));
      weapons[id]=equipmentWeapon({parts:P,tip:new T.Vector3(curve(1),top,0)},id,'sword',k===0?'rust':k===3?'salt':k===8?'dark':'steel');
    });
    const axes=[['rust-axe',0],['executioner-axe',1],['mourning-axe',2],['furnace-oath-axe',3],['sepulcher-axe',4],['broken-throne-axe',5],['ember-vow-axe',6]];
    axes.forEach(([id,k])=>{
      const P=baseParts(),top=[.90,1.16,1.08,1.23,1.14,1.25,1.20][k],y=top-.20;
      P.wood.push(G.lathe([[.020,-.43],[.023,-.3],[.025,.25],[.027,y+.10]],24));G.add(P,G.grip(.30,.026,12,-.36));
      let shape;
      if(k===2)shape=[[-.033,y+.11],[-.15,y+.19],[-.25,y+.13],[-.31,y-.08],[-.20,y-.29],[-.22,y-.12],[-.13,y-.07],[-.033,y-.08]];
      else if(k===3)shape=[[-.033,y+.11],[-.13,y+.20],[-.27,y+.19],[-.32,y+.07],[-.32,y-.11],[-.27,y-.20],[-.12,y-.15],[-.033,y-.08]];
      else if(k===4)shape=[[-.033,y+.10],[-.14,y+.15],[-.25,y+.10],[-.29,y-.09],[-.23,y-.35],[-.14,y-.28],[-.14,y-.055],[-.033,y-.08]];
      else if(k===5)shape=[[-.033,y+.11],[-.18,y+.21],[-.32,y+.19],[-.35,y+.04],[-.32,y-.14],[-.21,y-.21],[-.11,y-.13],[-.033,y-.08]];
      else if(k===6)shape=[[-.033,y+.10],[-.08,y+.27],[-.21,y+.31],[-.32,y+.15],[-.35,y-.04],[-.28,y-.22],[-.18,y-.29],[-.12,y-.17],[-.033,y-.08]];
      else shape=[[-.033,y+.11],[-.15,y+.20],[-.29,y+.16],[-.32,y-.06],[-.28,y-.20],[-.13,y-.10],[-.033,y-.08]];
      const holes=k===6?[G.circle(.031,28,-.19,y+.055)]:k===4?[]:[G.circle(.024,24,-.155,y+.025)];
      P.steel.push(G.extrude(shape,.037,.007,holes));
      const boundary=shape.slice(2,k===6?7:5),inner=boundary.map(p=>[p[0]+.023,p[1]]).reverse();
      P.edge.push(G.extrude(boundary.concat(inner),.013,.002));
      if(k===5){const other=shape.map(p=>[-p[0],p[1]]).reverse();P.steel.push(G.extrude(other,.037,.007,[G.circle(.024,24,.155,y+.025)]));P.edge.push(G.extrude(boundary.concat(inner).map(p=>[-p[0],p[1]]).reverse(),.013,.002));}
      else if(k===4)P.dark.push(G.extrude([[.02,y+.06],[.12,y+.075],[.14,y+.035],[.10,y-.015],[.024,y-.05]],.035,.005));
      else P.dark.push(G.extrude([[.02,y+.10],[.13,y+.06],[.19,y+.12],[.155,y-.06],[.024,y-.08]],.035,.006));
      P.steel.push(G.lathe([[.028,y-.11],[.043,y-.09],[.043,y+.12],[.028,y+.14]],24));
      for(const yy of[y-.09,y+.11])P.brass.push(G.ring(.044,.003,[0,yy,0],null,8,32));
      for(const side of[-1,1])for(let i=0;i<4;i++)P.brass.push(G.stud(.0035,[-.085-i*.047,y+.10-Math.sin(i)*.014,side*.027],[0,0,side]));
      for(const side of[-1,1]){
        P.dark.push(G.tube(shape.slice(1,6).map(p=>[p[0]*.84,p[1]*.97+y*.03,side*.026]),.0018,6,28,true));
        P.brass.push(G.tube([[-.12,y-.03,side*.027],[-.19,y-.09,side*.027],[-.21,y-.03,side*.027]],.002,6,14,true));
      }
      P.brass.push(G.lathe([[0,-.014],[.029,-.014],[.031,.007],[0,.014]],24).translate(0,-.445,0));
      weapons[id]=equipmentWeapon({parts:P,tip:new T.Vector3(-.29,y+.08,0)},id,'axe',k===0?'rust':k===6?'dark':'steel');
    });
    const spears=[['bone-spear',0],['bell-spear',1],['orphan-spear',2],['starved-spear',3],['furnace-mourning-spear',4],['last-coal-spear',5]];
    spears.forEach(([id,k])=>{
      const P=baseParts(),top=[1.75,1.83,1.91,1.86,1.94,2.02][k],head=[.43,.43,.43,.55,.48,.58][k];
      P.wood.push(G.lathe([[.018,-.54],[.023,-.40],[.022,top-head+.06]],24));G.add(P,G.grip(.40,.024,16,-.20));
      const b=G.blade(top-head,top,72,y=>{
        const t=(y-top+head)/head;
        const w=k===3?.102*Math.sin(t*PI)*Math.pow(1-t,.12):k===4?.075*Math.pow(Math.sin(t*PI),.70):k===5?.043*Math.sin(t*PI)*Math.pow(1-t,.12):.065*Math.sin(t*PI)*Math.pow(1-t,.25);
        return[-w,w];
      },.027,.25,[.27,.55]);P.steel.push(b.body);P.edge.push(b.edge);
      P.steel.push(G.lathe([[.025,top-head-.06],[.028,top-head+.07],[.019,top-head+.15]],24));
      for(const yy of[top-head-.03,top-head+.06,-.48])P.brass.push(G.ring(.028,.003,[0,yy,0],null,8,28));
      P.steel.push(G.lathe([[.007,-.69],[.024,-.54],[.023,-.50]],24));
      if(k===1){P.brass.push(G.lathe([[.017,0],[.022,-.03],[.033,-.07],[.051,-.10],[.052,-.11],[.042,-.11],[.025,-.07],[.017,0]],32).translate(0,top-.49,0));P.dark.push(G.sphere(.010,[0,top-.58,0],null,16,10));}
      if(k===2)for(const s of[-1,1])P.steel.push(G.extrude([[s*.025,top-.38],[s*.095,top-.28],[s*.115,top-.05],[s*.103,top+.005],[s*.087,top-.24],[s*.024,top-.32]],.016,.003));
      if(k===3)for(const side of[-1,1])P.dark.push(G.tube([[0,top-head+.13,side*.016],[0,top-.16,side*.016]],.0025,6,18,true));
      if(k===4)for(const s of[-1,1])P.steel.push(G.extrude([[s*.020,top-head+.03],[s*.13,top-head+.02],[s*.15,top-head+.085],[s*.12,top-head+.10],[s*.020,top-head+.07]],.021,.004));
      if(k===5)for(const s of[-1,1])P.dark.push(G.extrude([[s*.02,top-head+.015],[s*.09,top-head+.06],[s*.085,top-head+.18],[s*.054,top-head+.11],[s*.021,top-head+.07]],.018,.003));
      weapons[id]=equipmentWeapon({parts:P,tip:new T.Vector3(0,top,0)},id,'spear',k===1?'salt':k===5?'dark':'steel');
    });
    if(B.GearWeapons&&!/[?&]oldgear/.test(location.search)){try{Object.assign(weapons,B.GearWeapons.build({equipmentWeapon}));}catch(error){console.warn('gear-weapons',error);}}
    return weapons;
  }
  B.EquipmentArt={material,finish,build,finishes,prepare,uniqueWeapons:new Set(['last-verdict-blade', 'void-oath-axe', 'chain-court-spear', 'dull-sword', 'grave-sword', 'widow-sword', 'black-tide-sword', 'slag-edge-sword', 'hollow-crown-blade', 'ruin-lament-sword', 'cave-verdict-sword', 'black-forge-sword', 'rust-axe', 'executioner-axe', 'mourning-axe', 'furnace-oath-axe', 'sepulcher-axe', 'broken-throne-axe', 'ember-vow-axe', 'bone-spear', 'bell-spear', 'orphan-spear', 'starved-spear', 'furnace-mourning-spear', 'last-coal-spear'])};
})();
