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
    const hash = (x,y) => { const v = Math.sin(x*127.1+y*311.7+19.19)*43758.5453; return v-Math.floor(v); };
    for (let y=0;y<n;y++) for(let x=0;x<n;x++) {
      const i=y*n+x, grain=hash(x,y), broad=hash(Math.floor(x/12),Math.floor(y/12));
      let h=.5, c=.84, r=.7;
      if(kind==='metal') { h=.5+(grain-.5)*.065+Math.sin(y*1.8)*.025; c=.82+(grain-.5)*.07; r=.75+(grain-.5)*.18; }
      if(kind==='leather') { const fold=Math.sin(x*.041+Math.sin(y*.023)*2.5)*Math.sin(y*.035+Math.cos(x*.017)), pores=Math.pow(grain,5); h=.45+pores*.12+fold*.045; c=.73+fold*.08+(grain-.5)*.06; r=.86+pores*.10+fold*.025; }
      if(kind==='cloth') { const a=Math.sin(x*TAU/8), b=Math.sin(y*TAU/8); h=.5+.12*a*b+.03*grain; c=.77+.08*a*b; r=.95; }
      if(kind==='wood') { const line=Math.sin((x+Math.sin(y*.024)*6)*.22); h=.5+line*.035+grain*.03; c=.64+.11*line+grain*.04; r=.78; }
      if(kind==='bone') { h=.5+Math.sin(x*.18+y*.011)*.018+grain*.035; c=.89+grain*.07; r=.74; }
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
      const map=await loader.loadAsync(B.EquipmentTextureData[kind]);
      map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
      map.colorSpace=kind==='metal'?T.NoColorSpace:T.SRGBColorSpace;
      map.name='equipment-scan-'+kind;
      // Companion maps are derived once, before shader warm-up. A local file
      // origin can deny canvas readback; retain the procedural companions there.
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
    steel:['metal',0xd9dee0,.82,.90], salt:['metal',0xb3cbcc,.88,.86], rust:['metal',0xa59786,.94,.72],
    edge:['metal',0xe7ecee,.46,.98], brass:['metal',0xd3ac68,.55,.88], dark:['metal',0x647078,.64,.88],
    leather:['leather',0xe0d3c5,.92,0], strap:['leather',0x817063,.95,0], cloth:['cloth',0xe8e3dc,1,0],
    rag:['cloth',0xe4caae,1,0], wood:['wood',0x65482c,1,0], bone:['bone',0xb9b09a,1,0]
  };
  function material(key) {
    if(palette[key])return palette[key];const s=spec[key]||spec.steel;
    const m=new T.MeshStandardMaterial({...(key==='edge'?surface(s[0]):scanned[s[0]]||surface(s[0])),color:s[1],roughness:s[2],metalness:s[3],normalScale:new T.Vector2(s[0]==='metal'?.36:.72,s[0]==='metal'?.36:.72)});
    m.name='kara-equipment-'+key;m.userData.equipmentKind=s[0];return palette[key]=m;
  }
  function finish(source,name) {
    if(!name||!source.userData.equipmentKind||/-(edge|brass|dark|strap|bone)$/.test(source.name))return source;
    const tones={ash:0x79818b,rust:0x9b7760,brine:0x7b9998,blood:0x86534b,bone:0xb0a187};if(!tones[name])return source;
    const key=source.name+':'+name;if(finishes[key])return finishes[key];
    const m=source.clone();m.color.lerp(new T.Color(tones[name]),source.userData.equipmentKind==='metal'?.26:.26);m.name=source.name+'-'+name;
    m.roughness=clamp(source.roughness+(name==='rust'?.08:0),0,1);return finishes[key]=m;
  }
  function build({A,part,sleeve,equipmentWeapon,rayRadius}) {
    const BODY=['skin','leather'], torsoBones=['pelvis','spine01','spine02','spine03'];
    const v3 = p => new T.Vector3().fromArray(p), emit=(slot,id,mat,list,bone,opts)=>{if(list.length)part(slot,id,mat,G.merge(list),bone,opts);};
    const line=(fn,count=48)=>Array.from({length:count+1},(_,i)=>fn(i/count));
    // Smooth the sampled body field before shaping fitted breastplates. Sparse body triangles
    // must not produce the ridges and holes of a raw nearest-vertex shrink wrap.
    const cloud=A.cloud(torsoBones,['skin'],.25), cz=A.P('spine03').z-.008, grid=[], NU=48,NV=32;
    for(let j=0;j<=NV;j++){grid[j]=[];const y=mix(.86,1.58,j/NV);for(let i=0;i<NU;i++){const a=i/NU*TAU;let r=0;for(const p of cloud){if(Math.abs(p.y-y)>.055)continue;const d=Math.atan2(Math.sin(Math.atan2(p.x,p.z-cz)-a),Math.cos(Math.atan2(p.x,p.z-cz)-a));if(Math.abs(d)<.25)r=Math.max(r,Math.hypot(p.x,p.z-cz)*Math.cos(d));}grid[j][i]=r||(.17+.035*Math.sin(j/NV*PI));}}
    for(let pass=0;pass<5;pass++){const next=grid.map((row,j)=>row.map((r,i)=>{let sum=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)sum+=grid[clamp(j+dj,0,NV)][(i+di+NU)%NU];return Math.max(r*.975,sum/9);}));for(let j=0;j<=NV;j++)grid[j]=next[j];}
    function chest(u,v,lift=.025,metal=false) {
      const a=u*TAU, side=Math.abs(Math.sin(a)), y=mix(.89,1.51-.135*Math.pow(side,3),v), gu=((u%1)+1)%1*NU, gv=clamp((y-.86)/.72,0,1)*NV, i=Math.floor(gu)%NU,j=Math.min(NV-1,Math.floor(gv));
      const r=mix(mix(grid[j][i],grid[j][(i+1)%NU],gu%1),mix(grid[j+1][i],grid[j+1][(i+1)%NU],gu%1),gv-j)+lift;
      const keel=metal?.017*Math.pow(Math.max(0,Math.cos(a)),12)*Math.sin(v*PI):.002*Math.sin(a*16)*Math.sin(v*PI);
      return [Math.sin(a)*(r+keel),y,cz+Math.cos(a)*(r+keel)];
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
    function piping(slot,id,mat,fn,bone,r=.003,opts) {part(slot,id,mat,G.tube(line(fn),r,6,64,true),bone,opts);}
    function studs(slot,id,fn,count,bone,mat='brass',radius=.0034,opts) {const out=[];for(let i=0;i<count;i++){const p=fn((i+.5)/count),n=v3(p).sub(new T.Vector3(0,p[1],cz)).normalize();out.push(G.stud(radius,p,n));}emit(slot,id,mat,out,bone,opts);}
    function shoulder(id,s,mat) {
      const bone='upper_arm'+s, bc=A.box(A.cloud([bone],['skin'],.38)), c=bc.getCenter(new T.Vector3()), sz=bc.getSize(new T.Vector3()), sign=s==='L'?1:-1;
      c.y=bc.max.y-.028;
      // A domed cap and three overlapping curved lames, seated on the upper arm.
      const rx=Math.max(.10,sz.x*.46),rz=Math.max(.085,sz.z*.55);
      const cap=(u,v,layer)=>{const a=u*TAU,e=mix(.02,1.30,v),d=layer*.026;return[c.x+Math.sin(a)*rx*Math.sin(e)+sign*d,c.y+Math.cos(e)*(.115-layer*.01)-d*.72,c.z+Math.cos(a)*rz*Math.sin(e)];};
      part('chest',id,mat,G.shell(40,14,(u,v)=>cap(u,v,0),.008,true),bone);
      for(let l=1;l<=3;l++){part('chest',id,mat,G.shell(40,5,(u,v)=>{const p=cap(u,.71+v*.27,l);p[1]-=l*.012;return p;},.006,true),bone);piping('chest',id,mat==='leather'?'strap':'edge',u=>{const p=cap(u,.98,l);p[1]-=l*.012;return p;},bone,.0024);}
      const riv=[];for(let i=0;i<10;i++){const p=cap(i/10,.76,0);riv.push(G.stud(.0035,p,v3(p).sub(c).normalize()));}emit('chest',id,'brass',riv,bone);
    }
    // Tailored garments have an open neckline and separate fronts, back and
    // shoulder bridges. They are not closed breastplate cylinders in cloth.
    function tailoredChest(id,style) {
      const coat=style===2, armored=style===1;
      function panel(side,u,v,lift=.028) {
        const a=side*mix(.009,.244,u), angle=Math.abs(a);
        // V neck rises to the shoulder, then falls into the actual armhole.
        const top=angle<.12?mix(style===0?1.355:1.44,1.515,(angle-.009)/.111):mix(1.515,1.275,(angle-.12)/.124);
        const hem=.945+.038*Math.sin(u*PI)+.015*Math.cos(u*PI*3);
        const y=mix(hem,top,v), bodyTop=1.51-.135*Math.pow(Math.abs(Math.sin(a*TAU)),3);
        const q=chest(a,(y-.89)/(bodyTop-.89),lift,false);
        const fold=.004*Math.sin(u*PI*5+v*.8)*Math.sin(v*PI)+.003*Math.sin(v*PI*4)*Math.sin(u*PI);
        q[0]+=Math.sin(a*TAU)*fold;q[2]+=Math.cos(a*TAU)*fold;
        return q;
      }
      const backSkin=cloud.filter(p=>p.z<cz);
      function backDepth(x,y){
        const near=backSkin.map(p=>({p,d:(p.x-x)**2+(p.y-y)**2})).sort((a,b)=>a.d-b.d).slice(0,8);
        let weight=0,depth=0;for(const n of near){const w=1/(.00015+n.d);weight+=w;depth+=n.p.z*w;}
        return weight?depth/weight:cz-.16;
      }
      const back=(u,v,lift=.028)=>{
        const a=mix(.258,.742,u),top=1.28+.245*Math.pow(Math.sin(u*PI),.55),y=mix(.97,top,v);
        const p=chest(a,(y-.89)/(1.51-.135*Math.pow(Math.abs(Math.sin(a*TAU)),3)-.89),lift);
        // Fit the back in Cartesian space; a single radial origin turns the
        // curved spine into an inflated, bottle-shaped leather sack.
        p[2]=mix(p[2],backDepth(p[0],y)-lift,Math.pow(Math.sin(u*PI),.5));return p;
      };
      const thread=[],seams=[];
      const stitch=(fn,n=40)=>{for(let j=0;j<n;j++){const p=fn((j+.15)/n),q=fn((j+.65)/n);thread.push(G.tube([p,q],.0008,4,2,true));}};
      for(const side of[-1,1]) {
        part('chest',id,coat?'cloth':'leather',G.shell(32,30,(u,v)=>panel(side,u,v),.009,false,side<0));
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
            const a=side*mix(.055,.45,u),r=.23+v*.027+.004*Math.sin(u*PI*5),y=.97-v*(.28+.025*Math.sin(u*PI));
            return[Math.sin(a*TAU)*r,y,cz+Math.cos(a*TAU)*r];
          };
          part('chest',id,'cloth',G.shell(34,20,skirt,.008,false,side>0),null,{bones:['pelvis','spine01']});
          piping('chest',id,'strap',u=>skirt(u,1),'pelvis',.003);
        }
      }
      part('chest',id,coat?'cloth':'leather',G.shell(48,26,(u,v)=>back(u,v),.009,false));
      for(const edge of[0,1]){piping('chest',id,'strap',u=>back(u,edge,.034),null,.003);stitch(u=>back(u,edge?.98:.02,.037),56);}
      for(const u of[.22,.5,.78]){
        piping('chest',id,'strap',v=>back(u,v,.032),null,.002);
        stitch(v=>back(u+.009,v,.035),40);
      }
      // Wide curved shoulder bridges connect front and back above the armholes.
      for(const side of[-1,1]){
        const strap=(u,v)=>{
          const f=v3(panel(side,.43+u*.12,1,.032)),b=v3(back(side>0?.22-u*.05:.78+u*.05,1,.032));
          const p=f.lerp(b,v);p.y+=.085*Math.sin(v*PI);
          return p.toArray();
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
        part('chest',id,'cloth',sleeve(A,upper,fore,.02,1.03,.018,.006,['skin']).geometry,upper);
        part('chest',id,'cloth',sleeve(A,fore,hand,-.02,.82,.014,.005,['skin']).geometry,fore);
        const cuff=sleeve(A,fore,hand,.73,.84,.021,.005,['skin']);part('chest',id,'strap',cuff.geometry,fore);
        piping('chest',id,'brass',u=>cuff.at(u*TAU,.76,.005)[0].toArray(),fore,.0018);
        shoulder(id,side,'leather');
      }
    }
    function warSkirt(id,mat,plate) {
      const guard=[],trim=[],bolts=[];
      for(const sign of[-1,1])for(let leaf=0;leaf<3;leaf++){
        const u0=sign*(.012+leaf*.071),width=.070;
        const flap=(u,v)=>{
          const a=u0+sign*u*width,waist=chest(a,.17,.055),r=Math.hypot(waist[0],waist[2]-cz)+v*.020+.006*Math.sin(u*PI),
            y=1.002-v*(.255-leaf*.02)+.025*v*v*Math.pow(Math.abs(u-.5)*2,2);
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
    function facingAngle(cover) {
      const n0=cover.at(0,.5,0)[1],n90=cover.at(PI/2,.5,0)[1];
      return Math.atan2(n90.z,n0.z);
    }
    function armUnderlayer(id,style) {
      const torso=(u,v)=>{
        const side=Math.abs(Math.sin(u*TAU)),top=1.55-.20*Math.pow(side,9),y=mix(.92,top,v);
        return chest(u,(y-.89)/(1.51-.135*Math.pow(side,3)-.89),.013,false);
      };
      part('chest',id,'cloth',G.shell(64,32,torso,.004,true));
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
        if(style===6){
          const rings=[];
          for(let row=0;row<14;row++)for(let col=0;col<24;col++){
            const a=(col+(row%2)*.5)/24*TAU,t=.22+row*.053,q=cover.at(a,t,.006);
            const ring=G.ring(.006,.00125,null,null,4,8);
            G.orient(ring,q[0],q[1]);rings.push(ring);
          }
          emit('chest',id,'dark',rings,upper);
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
      const heavy=[1,2,4,6,7,8].includes(style), leather=style===0||style===3;
      for(const side of['L','R']) {
        const thigh='thigh'+side,shin='shin'+side,foot='tarsal'+side;
        const upper=sleeve(A,thigh,shin,.04,1.035,.013,.004,['skin']);
        const lower=sleeve(A,shin,foot,-.045,.96,.012,.004,['skin']);
        part('chest',id,leather?'leather':'cloth',upper.geometry,thigh);
        part('chest',id,'cloth',lower.geometry,shin);
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
        if(!heavy)continue;
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
      if([1,2,4,6,7,8].includes(k))armUnderlayer(id,k);
      if(k===0||k===3||k===5){tailoredChest(id,k===0?0:k===3?1:2);warSkirt(id,k===3?'dark':'leather',k===3);return;}
      const plate=[1,2,7,8].includes(k), mat=plate?(k===2?'salt':'steel'):k===6?'dark':'leather';
      part('chest',id,mat,G.shell(64,32,(u,v)=>plate?cuirass(u,v,.027):chest(u,v,.027,false),plate?.009:.006,true),null,plate?{spineWeights:true}:undefined);
      [0,1].forEach(v=>piping('chest',id,plate?'brass':'strap',u=>plate?cuirass(u,v,.034):chest(u,v,.032,false),null,plate?.0035:.0025,plate?{spineWeights:true}:undefined));
      ['L','R'].forEach(s=>shoulder(id,s,k===2?'salt':k===8?'dark':'steel'));
      if(k===4){
        const scales=[],rivets=[],cells=[],spines=['spine01','spine02','spine03'];
        for(let row=0;row<9;row++)for(let col=0;col<28;col++){
          const u=(col+(row%2)*.5)/28,v=.03+row*.103;
          const scale=G.shell(5,4,(x,y)=>chest(u+(x-.5)*.034,v+y*.113,.034+.004*Math.sin(y*PI),true),.004,false),riv=[];
          for(const du of[-.009,.009]){const p=chest(u+du,v+.08,.040,true);riv.push(G.stud(.0024,p,new T.Vector3(Math.sin(u*TAU),0,Math.cos(u*TAU))));}
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
      if(k===6){const rings=[];for(let row=0;row<32;row++)for(let col=0;col<72;col++){const u=(col+(row%2)*.5)/72,v=.015+row*.03,p=chest(u,v,.036);const g=G.ring(.007,.00155,null,null,4,10);g.rotateX(PI/2);g.rotateY(u*TAU+(row%2?.35:-.35));g.translate(...p);rings.push(g);}emit('chest',id,'steel',rings);}
      if(plate){for(let l=0;l<3;l++){part('chest',id,mat,G.shell(48,5,(u,v)=>{const p=chest(u,.09,.027+l*.006,true);p[1]-=.02+l*.034+v*.043;return p;},.006,true),null,{bones:['pelvis','spine01']});}}
      if(plate){
        const channels=[];
        for(const side of[-1,1])for(let n=0;n<3;n++){
          channels.push(G.tube(line(t=>chest(side*(.018+n*.023+t*.025),.23+t*.61,.038,true),24),.00165,5,32,true));
        }
        emit('chest',id,'dark',channels,null,{spineWeights:true});
        const relief=[],emboss=[];
        for(const side of[-1,1]){
          for(let rib=0;rib<3;rib++){
            const path=line(t=>chest(side*(.034+rib*.027+t*.017),.31+t*.53,.048+.004*Math.sin(t*PI),true),32);
            relief.push(G.tube(path,.0034,8,32,true));
          }
          const scroll=line(t=>{const a=t*TAU*1.25,r=.017*(1-t*.65);return chest(side*(.086+Math.sin(a)*r),.78+Math.cos(a)*r*3,.052,true);},40);
          emboss.push(G.tube(scroll,.0025,6,40,true));
        }
        emit('chest',id,mat,relief,null,{spineWeights:true});emit('chest',id,'brass',emboss,null,{spineWeights:true});
        // An embossed bronze escutcheon is seated on the breastplate, with a steel inset.
        const p=chest(0,.72,.039,true),crest=G.extrude([[-.025,.029],[0,.041],[.025,.029],[.019,-.013],[0,-.035],[-.019,-.013]],.007,.0025);
        crest.translate(...p);part('chest',id,'brass',crest,null,{spineWeights:true});
        const inset=G.extrude([[-.017,.019],[0,.027],[.017,.019],[.012,-.008],[0,-.024],[-.012,-.008]],.006,.0015);inset.translate(p[0],p[1],p[2]+.005);part('chest',id,'dark',inset,null,{spineWeights:true});
        for(const u of[.14,.86])studs('chest',id,t=>chest(u,.09+t*.74,.035,true),17,null,'brass',.0032,{spineWeights:true});
      }
      if(k===7||k===8){const ornaments=[];for(let side of[-1,1])for(let row=0;row<5;row++){
        const u=side>0?.035:.965,v=.29+row*.12;const path=line(t=>chest(u+side*t*.105,v+.035*Math.sin(t*PI)-t*.04,.043,true),16);
        ornaments.push(G.tube(path,t=>.0025+.006*Math.sin(t*PI),8,24,true));
      }emit('chest',id,k===8?'bone':'brass',ornaments,null,{spineWeights:true});
        const keel=line(v=>chest(0,.15+v*.7,.046,true),32);part('chest',id,'dark',G.tube(keel,.0025,6,36,true),null,{spineWeights:true});
      }
      warSkirt(id,plate?mat:k===6?'dark':'leather',plate||k===6);
      // A broad leather belt, with a bevelled buckle and punched fastening holes.
      part('chest',id,'strap',G.shell(48,4,(u,v)=>chest(u,.095+v*.07,.040,plate),.004,true),null,{bones:['pelvis','spine01']});
      const bp=chest(0,.13,.047,plate),buckle=G.buckle(.045,.032,.0035);buckle.translate(...bp);part('chest',id,'brass',buckle,'spine01');
      studs('chest',id,u=>chest(.03+u*.1,.13,.045,plate),7,'spine01','dark',.002);
    });
    const headBox=A.box(A.cloud(['head'],['skin'],.6)),hc=headBox.getCenter(new T.Vector3()),hs=headBox.getSize(new T.Vector3());
    const rx=hs.x*.54+.012,rz=hs.z*.53+.012,ry=hs.y*.56+.012;
    ['cloth-hood','prayer-hood','buried-hood'].forEach((id,k)=>{
      const p=(u,v)=>{const a=mix(.73,TAU-.73,u),e=mix(-.70,PI/2-.008,v),r=1+.018*Math.sin(a*10+v*3)*(1-v);return[hc.x+Math.sin(a)*Math.cos(e)*rx*r,hc.y+Math.sin(e)*ry+.045*Math.pow(v,5),hc.z+Math.cos(a)*Math.cos(e)*rz*r-.012*v];};
      part('head',id,'cloth',G.shell(56,28,p,.006,false),'head');
      for(const edge of[0,1])piping('head',id,'strap',v=>p(edge,v),'head',.0028);
      part('head',id,'cloth',G.shell(48,18,(u,v)=>{const a=u*TAU,r=mix(.071,.20+k*.01,v);return[hc.x+Math.sin(a)*r,hc.y-ry*.56-v*(.14+k*.015)+Math.sin(a*12)*.006*v,hc.z+Math.cos(a)*r*.76];},.006,true),'spine03');
    });
    ['iron-helm','drowned-helm','sealed-mask','furnace-mask','bell-helm','bone-crown','warden-crown'].forEach((id,k)=>{
      const mat=k===1?'salt':'steel',crown=k>=5;
      const dome=(u,v)=>{const a=u*TAU,front=Math.max(0,Math.cos(a)),e=mix(crown?.03:-.19+.43*Math.pow(front,6),PI/2-.004,v),ridge=.006*Math.pow(front,18)*Math.sin(v*PI);return[hc.x+Math.sin(a)*Math.cos(e)*(rx+ridge),hc.y+Math.sin(e)*ry,hc.z+Math.cos(a)*Math.cos(e)*(rz+ridge)];};
      part('head',id,mat,G.shell(64,30,dome,.007,true),'head');
      piping('head',id,'brass',u=>dome(u,0),'head',.0034);
      if(!crown){
        // Separate forehead and pointed visor preserve an actual narrow eye slit.
        const visor=(u,v)=>{const a=mix(-1.27,1.27,u),tip=1-Math.abs(Math.sin(a)),y=hc.y+mix(-ry*.88+ry*.18*Math.abs(Math.sin(a)),ry*.09,v),r=rz+.012+.026*tip*Math.sin(v*PI);return[hc.x+Math.sin(a)*rx,y,hc.z+Math.cos(a)*r];};
        const outline=[[-rx*.95,ry*.09],[rx*.95,ry*.09],[rx*.94,-ry*.53],[rx*.57,-ry*.78],[0,-ry*.90],[-rx*.57,-ry*.78],[-rx*.94,-ry*.53]],vents=[];
        for(const side of[-1,1])for(let row=0;row<3;row++)for(let col=0;col<4;col++)vents.push(G.circle(.0027,10,side*rx*(.22+col*.16),-ry*(.22+row*.17)));
        // Pierced steel has actual thickness and open ventilation, rather than dark dots laid over a solid face.
        const face=curveReady(G.extrude(outline,.008,.0011,vents)),positions=face.attributes.position;
        for(let i=0;i<positions.count;i++){
          const x=positions.getX(i),y=positions.getY(i),a=Math.asin(clamp(x/rx,-.995,.995)),v=clamp((y+ry*.88)/(ry*.97),0,1),tip=1-Math.abs(Math.sin(a));
          const z=hc.z+Math.cos(a)*(rz+.012+.026*tip*Math.sin(v*PI));
          positions.setXYZ(i,hc.x+x,hc.y+y,z+positions.getZ(i));
        }
        G.smoothNormals(face,.65);part('head',id,k===3?'dark':mat,face,'head');
        piping('head',id,'edge',u=>visor(u,1),'head',.0026);
        for(const s of[-1,1]){const p=[hc.x+s*rx*.96,hc.y+ry*.05,hc.z];part('head',id,'brass',G.sphere(.009,p,[.35,1,1],16,10),'head');}
        if(k===4){part('head',id,mat,G.shell(64,4,(u,v)=>{const p=dome(u,.1),a=u*TAU;return[p[0]+Math.sin(a)*v*.045,p[1]-.015*v,p[2]+Math.cos(a)*v*.045];},.004,true),'head');}
      }
      if(k===0||k===1||k===3){part('head',id,'dark',G.shell(6,32,(u,v)=>{const e=mix(-.1,PI-.05,v),r=ry+.008+.012*Math.sin(v*PI);return[hc.x+(u-.5)*.009,hc.y+Math.sin(e)*r,hc.z+Math.cos(e)*rz];},.004,false),'head');}
      const seams=[];
      for(const u of[.12,.88,.5])seams.push(G.tube(line(v=>dome(u,.08+v*.79),32),.0024,6,32,true));
      emit('head',id,k===5?'bone':'brass',seams,'head');
      if(!crown){
        const p=[hc.x,hc.y+ry*.11,hc.z+rz+.021];
        const nasal=G.extrude([[-.007,.028],[.007,.028],[.011,-.037],[0,-.052],[-.011,-.037]],.008,.002);nasal.translate(...p);part('head',id,'brass',nasal,'head');
      }
      if(crown){const teeth=[];for(let i=0;i<9;i++){const a=i/9*TAU,p=dome(i/9,0),h=.05+(i%2)*.025;const g=G.extrude([[-.015,0],[.015,0],[.008,h*.65],[0,h],[-.008,h*.65]],.006,.002);g.rotateY(a);g.translate(p[0],p[1]-.007,p[2]);teeth.push(g);}emit('head',id,k===5?'bone':'brass',teeth,'head');}
    });
    for(const s of['L','R']){
      const fore='forearm'+s,hand='hand'+s,shin='shin'+s,foot='tarsal'+s;
      ['rag-wraps','chain-gloves','salt-gauntlets','claw-gauntlets','warden-grasp'].forEach((id,k)=>{
        const cover=sleeve(A,fore,hand,.30,.97,.009,.005,BODY);part('hands',id,k?'leather':'rag',cover.geometry,fore);
        if(!k){const path=line(t=>cover.at(t*TAU*8,.33+t*.60,.003)[0],120);part('hands',id,'cloth',G.tube(path,.004,6,120,true),fore);return;}
        const armor=sleeve(A,fore,hand,.29,.83,.023,.007,BODY,.008);part('hands',id,k===2?'salt':'steel',armor.geometry,fore);
        for(const t of[.31,.80])piping('hands',id,'brass',u=>armor.at(u*TAU,t,.003)[0].toArray(),fore,.0025);
        for(let l=0;l<3;l++){const arm=sleeve(A,fore,hand,.80+l*.045,.86+l*.045,.018,.004,BODY);part('hands',id,k===2?'salt':'steel',arm.geometry,fore);}
        const flute=[],bolts=[];
        for(const a of[-.65,0,.65])flute.push(G.tube(line(t=>armor.at(a,.37+t*.35,.012)[0].toArray(),24),.0022,6,24,true));
        for(let i=0;i<8;i++){const q=armor.at(i/8*TAU,.37,.008);bolts.push(G.stud(.0035,q[0],q[1]));}
        emit('hands',id,'edge',flute,fore);emit('hands',id,'brass',bolts,fore);
        const hb=A.box(A.cloud([hand],['skin'],.5)),c=hb.getCenter(new T.Vector3()),sz=hb.getSize(new T.Vector3());
        part('hands',id,'strap',G.sphere(1,c.toArray(),[Math.max(sz.x*.55,.025),Math.max(sz.y*.56,.024),Math.max(sz.z*.54,.035)],28,18),hand);
        part('hands',id,'steel',G.shell(18,14,(u,v)=>[mix(hb.min.x-.006,hb.max.x+.006,u),hb.max.y+.009+.014*Math.sin(u*PI)*Math.sin(v*PI),mix(hb.min.z-.006,hb.max.z+.006,v)],.005,false),hand);
        const knuckles=[];for(let i=0;i<4;i++)knuckles.push(G.sphere(.010,[mix(hb.min.x,hb.max.x,(i+.5)/4),hb.max.y+.015,c.z+sz.z*.28],[1,.65,1.35],16,10));emit('hands',id,k>=3?'dark':'steel',knuckles,hand);
        // Small articulated scales follow each native finger rather than a solid mitten.
        for(const name of Object.keys(A.index).filter(n=>n.startsWith('finger_')&&n.endsWith(s))){const p=A.P(name),end=A.tail(name);if(!end||end.distanceTo(p)<.009)continue;const center=p.clone().lerp(end,.38);part('hands',id,k>=3?'dark':'steel',G.sphere(.01,center.toArray(),[1,.7,1.6],12,8),name);}
      });
      const fb=A.box(A.cloud([foot,'toe'+s],['skin'],.35)),fc=fb.getCenter(new T.Vector3()),fs=fb.getSize(new T.Vector3());
      ['worn-boots','grave-boots','tide-boots','shackle-boots','crown-boots'].forEach((id,k)=>{
        const cover=sleeve(A,shin,foot,k?.49:.66,1.02,.012,.006,BODY);part('boots',id,'leather',cover.geometry,shin);
        const sole=fb.min.y-.012, w=Math.max(fs.x*.58,.055), length=Math.max(fs.z*.6,.115);
        const shoe=(u,v)=>{const a=u*TAU,e=v*PI/2,r=Math.cos(e),z=fc.z+Math.cos(a)*length*r;const toe=.90+.10*Math.cos(a);return[fc.x+Math.sin(a)*w*toe*r,sole+.018+Math.sin(e)*Math.max(fs.y*.85,.072)*(1-.23*Math.cos(a)),z];};
        part('boots',id,'leather',G.shell(48,20,shoe,.006,true),foot);
        part('boots',id,'strap',G.shell(48,3,(u,v)=>{const p=shoe(u,0);p[1]=sole+v*.030;return p;},.012,true),foot);
        piping('boots',id,'rag',u=>{const p=shoe(u,0);p[1]+=.008;return p;},foot,.0015);
        // Sewn uppers and a distinct heel/toe silhouette replace the old flattened sphere.
        for(const u of[.12,.88])piping('boots',id,'strap',v=>shoe(u,.05+v*.83),foot,.002);
        for(const t of[.74,.89]){part('boots',id,'strap',G.shell(40,3,(u,v)=>cover.at(u*TAU,t+v*.04,.005)[0].toArray(),.004,true),shin);const q=cover.at(0,t+.02,.012),b=G.buckle(.026,.026,.0025);G.orient(b,q[0],q[1]);part('boots',id,'brass',b,shin);}
        const welt=[];for(let stitch=0;stitch<48;stitch++){
          const p=shoe(stitch/48,0),q=shoe((stitch+.42)/48,0);p[1]+=.025;q[1]+=.025;welt.push(G.tube([p,q],.0012,4,2,true));
        }emit('boots',id,'rag',welt,foot);
        if(k){const greave=sleeve(A,shin,foot,.49,.89,.027,.007,BODY,.011),front=facingAngle(greave);part('boots',id,k===2?'salt':'steel',G.shell(40,24,(u,v)=>greave.at(front+mix(-PI*.72,PI*.72,u),.49+v*.40,.004+.007*Math.pow(Math.cos(mix(-PI*.72,PI*.72,u)),8))[0].toArray(),.007,false),shin);
          piping('boots',id,'brass',u=>greave.at(u*TAU,.5,.004)[0].toArray(),shin,.0027);
          for(let l=0;l<4;l++)part('boots',id,k===2?'salt':'steel',G.shell(28,8,(u,v)=>{const a=mix(-PI*.43,PI*.43,u),t=.20+l*.18+v*.22,e=mix(.07,.82,t),r=Math.cos(e);return[fc.x+Math.sin(a)*w*1.06*r,sole+.027+Math.sin(e)*Math.max(fs.y*.9,.076),fc.z+Math.cos(a)*length*1.02*r];},.005,false),foot);
          const ridge=line(t=>greave.at(front,.52+t*.33,.006)[0],32);part('boots',id,k===4?'brass':'edge',G.tube(ridge,.002,6,32,true),shin);
          if(k===3){const a=cover.at(0,.92,.01)[0];part('boots',id,'dark',G.chain([a.toArray(),[a.x+.02,a.y-.05,a.z+.01],[a.x,a.y-.085,a.z]],.012),shin);}
        }
      });
    }
    // Catalog-specific fittings are separate, joint-bound parts. The shared core
    // remains efficient while each named piece has its own physical silhouette.
    const plainArmor=new Set(['torn-chest','grave-chest','coast-chest','cloth-hood','iron-helm','drowned-helm','rag-wraps','chain-gloves','salt-gauntlets','worn-boots','grave-boots','tide-boots']);
    const armorCatalog=B.Progression.items.filter(item=>item.slot!=='weapon'&&!plainArmor.has(item.id));
    armorCatalog.forEach((item,index)=>{
      const id='variant@'+item.id,pattern=(index+(['buried-road-boots','black-anvil-grasp'].includes(item.id)?1:0))%5,mat=item.finish==='bone'?'bone':item.finish==='brine'?'salt':item.finish==='blood'?'dark':'brass';
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
          const crestHeight=[.047,.071,.033,.087,.060][pattern];
          const profile=[[-rz*.63,0],[-rz*.48,crestHeight*.50],[-rz*.17,crestHeight],[rz*.32,crestHeight*.73],[rz*.64,.015],[rz*.55,-.013],[-rz*.63,-.010]];
          const crest=G.extrude(profile,.012,.0025);crest.rotateY(-PI/2);crest.translate(hc.x,hc.y+ry*.96,hc.z);part('head',id,mat,crest,'head');
          // Distinct cheek rims and a cast brow mount have thickness and riveted joins.
          for(const side of[-1,1]){
            const p=[hc.x+side*rx*.71,hc.y-ry*.41,hc.z+rz*.72+.017];
            const cheek=G.extrude([[-.009,.041],[.009,.036],[.016,-.018],[0,-.042],[-.010,-.028]],.007,.002);
            cheek.rotateY(side*.48);cheek.translate(...p);part('head',id,mat,cheek,'head');
            part('head',id,'dark',G.stud(.0038,[p[0],p[1]+.020,p[2]+.008],[side*.40,0,1]),'head');
          }
          if(pattern===1||pattern===3){
            const collar=(u,v)=>{const a=u*TAU,r=.074+v*.025;return[hc.x+Math.sin(a)*r,hc.y-ry*.69-v*.056,hc.z+Math.cos(a)*r*.87];};
            part('head',id,'dark',G.shell(48,10,collar,.006,true),'spine03');
            piping('head',id,'edge',u=>collar(u,1),'spine03',.0022);
          }
        }
      }else if(item.slot==='chest'){
        const tabardLength=[.25,.19,.33,.23,.29][pattern],sideCount=pattern===1?1:2;
        for(let leaf=0;leaf<sideCount;leaf++){
          const side=leaf===0?1:-1;
          const cloth=(u,v)=>{const x=side*(.012+u*(pattern===1?.19:.13)),fold=.008*Math.sin(u*PI*3)*Math.sin(v*PI),y=.973-v*tabardLength+.027*v*Math.pow(Math.abs(u-.5)*2,2);return[x,y,cz+.235+v*.025+fold];};
          part('chest',id,pattern===4?'leather':'cloth',G.shell(20,24,cloth,.006,false,side<0),'pelvis');
          for(const edge of[0,1])piping('chest',id,'strap',v=>cloth(edge,v),'pelvis',.0022);
          piping('chest',id,'rag',u=>cloth(u,1),'pelvis',.0016);
          const stitches=[];for(let n=0;n<30;n++)stitches.push(G.tube([cloth(.06,.03+n*.030),cloth(.09,.044+n*.030)],.0007,4,2,true));emit('chest',id,'rag',stitches,'pelvis');
        }
        // A different shield/coin/knotted escutcheon identifies the named cuirass.
        const p=chest(pattern===1?.032:0,.65,.060,true),scale=.025+pattern*.0025;
        if(pattern===0||pattern===4){const shield=G.extrude([[-scale,scale*.7],[0,scale*1.3],[scale,scale*.7],[scale*.8,-scale*.6],[0,-scale*1.4],[-scale*.8,-scale*.6]],.008,.0025);shield.translate(...p);part('chest',id,mat,shield,'spine03');}
        else {const medal=G.ring(scale,.0035,p,[0,0,1],8,32);part('chest',id,mat,medal,'spine03');}
        for(const side of[-1,1]){
          const strap=(u,v)=>chest(side*(.032+v*.075+(u-.5)*.020),.40+v*.43,.063,true);
          part('chest',id,'strap',G.shell(5,28,strap,.003,false,side<0));
          studs('chest',id,t=>strap(.5,.12+t*.73),6,null,mat,.0027);
        }
        if(pattern===2||pattern===3){
          for(const side of['L','R']){
            const bone='upper_arm'+side,fore='forearm'+side,cover=sleeve(A,bone,fore,.23,.46,.030,.005,['skin']),front=facingAngle(cover);
            part('chest',id,'dark',G.shell(20,8,(u,v)=>cover.at(front+mix(-1.05,1.05,u),.24+v*.19,.007)[0].toArray(),.006,false),bone);
            piping('chest',id,mat,u=>cover.at(front+mix(-1.05,1.05,u),.43,.014)[0].toArray(),bone,.0022);
          }
        }
      }else if(item.slot==='hands'){
        for(const side of['L','R']){
          const fore='forearm'+side,hand='hand'+side,cover=sleeve(A,fore,hand,.40,.77,.028,.004,['skin','leather']),front=facingAngle(cover);
          if(wrap){
            for(let n=0;n<3+pattern;n++){const t=.42+n*.04;part('hands',id,'strap',G.shell(32,3,(u,v)=>cover.at(u*TAU,t+v*.022,.003)[0].toArray(),.003,true),fore);}
            const knot=cover.at(front,.58,.008)[0];part('hands',id,'bone',G.stud(.005,knot,[0,0,1]),fore);
          }else{
            const plate=(u,v)=>cover.at(front+mix(-.79,.79,u),.43+v*.25,.008+.005*Math.sin(u*PI))[0].toArray();
            part('hands',id,mat,G.shell(24,14,plate,.005,false),fore);
            for(const edge of[0,1])piping('hands',id,'edge',u=>plate(u,edge),fore,.0019);
            for(let n=0;n<2+pattern;n++)piping('hands',id,'dark',v=>plate((n+1)/(3+pattern),.09+v*.82),fore,.0014);
          }
        }
      }else if(item.slot==='boots'){
        for(const side of['L','R']){
          const shin='shin'+side,foot='tarsal'+side,cover=sleeve(A,shin,foot,.55,.90,.034,.004,['skin','leather']),front=facingAngle(cover);
          if(wrap||/pilgrim|mourning|worker/.test(item.id)){
            for(let n=0;n<3+pattern;n++){const t=.62+n*.046;part('boots',id,'strap',G.shell(32,3,(u,v)=>cover.at(u*TAU,t+v*.030,.005)[0].toArray(),.004,true),shin);}
          }else{
            const plate=(u,v)=>cover.at(front+mix(-.70,.70,u),.58+v*.26,.009+.004*Math.sin(u*PI))[0].toArray();
            part('boots',id,mat,G.shell(24,16,plate,.005,false),shin);
            for(const edge of[0,1])piping('boots',id,'dark',v=>plate(edge,v),shin,.002);
            const crest=cover.at(front,.68,.020)[0];part('boots',id,'brass',G.stud(.005,crest,[0,0,1]),shin);
            for(let n=0;n<2+pattern;n++)piping('boots',id,'edge',v=>plate((n+1)/(3+pattern),.06+v*.84),shin,.0016);
          }
        }
      }
    });

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
    return weapons;
  }
  B.EquipmentArt={material,finish,build,finishes,prepare,uniqueWeapons:new Set(['dull-sword', 'grave-sword', 'widow-sword', 'black-tide-sword', 'slag-edge-sword', 'hollow-crown-blade', 'ruin-lament-sword', 'cave-verdict-sword', 'black-forge-sword', 'rust-axe', 'executioner-axe', 'mourning-axe', 'furnace-oath-axe', 'sepulcher-axe', 'broken-throne-axe', 'ember-vow-axe', 'bone-spear', 'bell-spear', 'orphan-spear', 'starved-spear', 'furnace-mourning-spear', 'last-coal-spear'])};
})();
