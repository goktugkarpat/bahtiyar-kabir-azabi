/* Hand-built fitted equipment. Shared geometry and tileable PBR surfaces are created once. */
(() => {
  'use strict';
  const B = window.BABA, T = window.THREE, G = B.Gear, PI = Math.PI, TAU = PI * 2;
  const mix = (a,b,t) => a+(b-a)*t, clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const surfaces = {}, palette = {}, finishes = {};
  function surface(kind) {
    if (surfaces[kind]) return surfaces[kind];
    const n = 512, heights = new Float32Array(n*n), color = new Uint8Array(n*n*4), normal = new Uint8Array(n*n*4), rough = new Uint8Array(n*n*4);
    const hash = (x,y) => { const v = Math.sin(x*127.1+y*311.7+19.19)*43758.5453; return v-Math.floor(v); };
    for (let y=0;y<n;y++) for(let x=0;x<n;x++) {
      const i=y*n+x, grain=hash(x,y), broad=hash(Math.floor(x/12),Math.floor(y/12));
      let h=.5, c=.84, r=.7;
      if(kind==='metal') { h=.5+(grain-.5)*.065+Math.sin(y*1.8)*.025; c=.82+(grain-.5)*.07; r=.75+(grain-.5)*.18; }
      if(kind==='leather') { h=.45+Math.pow(grain,3)*.16+(broad-.5)*.04; c=.69+grain*.12+(broad-.5)*.035; r=.83+grain*.12; }
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
  const spec = {
    steel:['metal',0xb1b6bb,.62,.94], salt:['metal',0x819aa0,.72,.9], rust:['metal',0x786c60,.95,.74],
    edge:['metal',0xe1e3e0,.36,1], brass:['metal',0x9d7845,.68,.88], dark:['metal',0x353b42,.8,.86],
    leather:['leather',0x654234,1,0], strap:['leather',0x30271f,1,0], cloth:['cloth',0x413b3b,1,0],
    rag:['cloth',0x777060,1,0], wood:['wood',0x65482c,1,0], bone:['bone',0xb9b09a,1,0]
  };
  function material(key) {
    if(palette[key])return palette[key];const s=spec[key]||spec.steel;
    const m=new T.MeshStandardMaterial({...surface(s[0]),color:s[1],roughness:s[2],metalness:s[3],normalScale:new T.Vector2(s[0]==='metal'?.18:.38,s[0]==='metal'?.18:.38)});
    m.name='kara-equipment-'+key;m.userData.equipmentKind=s[0];return palette[key]=m;
  }
  function finish(source,name) {
    if(!name||!source.userData.equipmentKind||/-(edge|brass|dark|strap|bone)$/.test(source.name))return source;
    const tones={ash:0x79818b,rust:0x9b7760,brine:0x7b9998,blood:0x86534b,bone:0xb0a187};if(!tones[name])return source;
    const key=source.name+':'+name;if(finishes[key])return finishes[key];
    const m=source.clone();m.color.lerp(new T.Color(tones[name]),source.userData.equipmentKind==='metal'?.32:.45);m.name=source.name+'-'+name;
    m.roughness=clamp(source.roughness+(name==='rust'?.08:0),0,1);return finishes[key]=m;
  }
  function build({A,part,sleeve,equipmentWeapon,rayRadius}) {
    const BODY=['skin','leather'], torsoBones=['pelvis','spine01','spine02','spine03'];
    const v3 = p => new T.Vector3().fromArray(p), emit=(slot,id,mat,list,bone,opts)=>{if(list.length)part(slot,id,mat,G.merge(list),bone,opts);};
    const line=(fn,count=48)=>Array.from({length:count+1},(_,i)=>fn(i/count));
    // Smooth the sampled body field before shaping fitted breastplates. Sparse body triangles
    // must not produce the ridges and holes of a raw nearest-vertex shrink wrap.
    const cloud=A.cloud(torsoBones,BODY,.2), cz=A.P('spine03').z-.008, grid=[], NU=48,NV=32;
    for(let j=0;j<=NV;j++){grid[j]=[];const y=mix(.86,1.58,j/NV);for(let i=0;i<NU;i++){const a=i/NU*TAU;let r=0;for(const p of cloud){if(Math.abs(p.y-y)>.055)continue;const d=Math.atan2(Math.sin(Math.atan2(p.x,p.z-cz)-a),Math.cos(Math.atan2(p.x,p.z-cz)-a));if(Math.abs(d)<.25)r=Math.max(r,Math.hypot(p.x,p.z-cz)*Math.cos(d));}grid[j][i]=r||(.17+.035*Math.sin(j/NV*PI));}}
    for(let pass=0;pass<5;pass++){const next=grid.map((row,j)=>row.map((r,i)=>{let sum=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)sum+=grid[clamp(j+dj,0,NV)][(i+di+NU)%NU];return Math.max(r*.975,sum/9);}));for(let j=0;j<=NV;j++)grid[j]=next[j];}
    function chest(u,v,lift=.025,metal=false) {
      const a=u*TAU, side=Math.abs(Math.sin(a)), y=mix(.89,1.51-.135*Math.pow(side,3),v), gu=((u%1)+1)%1*NU, gv=clamp((y-.86)/.72,0,1)*NV, i=Math.floor(gu)%NU,j=Math.min(NV-1,Math.floor(gv));
      const r=mix(mix(grid[j][i],grid[j][(i+1)%NU],gu%1),mix(grid[j+1][i],grid[j+1][(i+1)%NU],gu%1),gv-j)+lift;
      const keel=metal?.017*Math.pow(Math.max(0,Math.cos(a)),12)*Math.sin(v*PI):.002*Math.sin(a*16)*Math.sin(v*PI);
      return [Math.sin(a)*(r+keel),y,cz+Math.cos(a)*(r+keel)];
    }
    function piping(slot,id,mat,fn,bone,r=.003) {part(slot,id,mat,G.tube(line(fn),r,6,64,true),bone);}
    function studs(slot,id,fn,count,bone,mat='brass',radius=.0034) {const out=[];for(let i=0;i<count;i++){const p=fn((i+.5)/count),n=v3(p).sub(new T.Vector3(0,p[1],cz)).normalize();out.push(G.stud(radius,p,n));}emit(slot,id,mat,out,bone);}
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
    const chestIDs=['torn-chest','grave-chest','coast-chest','brigandine-chest','lamellar-chest','sailcoat-chest','chainmail-chest','warden-chest','rib-chest'];
    chestIDs.forEach((id,k)=>{
      const plate=[1,2,7,8].includes(k), mat=plate?(k===2?'salt':'steel'):k===6?'dark':k===0?'rag':k===5?'cloth':'leather';
      part('chest',id,mat,G.shell(64,32,(u,v)=>chest(u,v,.027,plate),plate?.009:.006,true));
      // Deliberate fitted edging: neckline, armholes and waist are outlined in the same material family.
      [0,1].forEach(v=>piping('chest',id,plate?'brass':'strap',u=>chest(u,v,.032,plate),null,plate?.0035:.0025));
      if(k!==0)['L','R'].forEach(s=>shoulder(id,s,[3,5].includes(k)?'leather':k===2?'salt':k===8?'dark':'steel'));
      if(k===0||k===3||k===5){
        const seams=[],thread=[];for(let col=0;col<12;col++){const u=(col+.5)/12;seams.push(G.tube(line(v=>chest(u,.03+v*.94,.029)),.0017,4,24,true));for(let row=0;row<18;row++){const v=.04+row*.052;const p=chest(u-.005,v,.031),q=chest(u+.005,v+.009,.031);thread.push(G.tube([p,q],.0009,4,2,true));}}
        emit('chest',id,'strap',seams);emit('chest',id,'rag',thread);
        if(k===3){for(let row=0;row<9;row++)studs('chest',id,u=>chest(u,.08+row*.1,.033),28,null,'brass',.0028);}
      }
      if(k===4){const scales=[],riv=[];for(let row=0;row<9;row++)for(let col=0;col<28;col++){
        const u=(col+(row%2)*.5)/28,v=.03+row*.103;
        scales.push(G.shell(5,4,(x,y)=>chest(u+(x-.5)*.034,v+y*.113,.034+.004*Math.sin(y*PI),true),.004,false));
        for(const du of[-.009,.009]){const p=chest(u+du,v+.08,.040,true);riv.push(G.stud(.0024,p,new T.Vector3(Math.sin(u*TAU),0,Math.cos(u*TAU))));}
      }emit('chest',id,'steel',scales);emit('chest',id,'brass',riv);}
      if(k===6){const rings=[];for(let row=0;row<32;row++)for(let col=0;col<72;col++){const u=(col+(row%2)*.5)/72,v=.015+row*.03,p=chest(u,v,.036);const g=G.ring(.007,.00155,null,null,4,10);g.rotateX(PI/2);g.rotateY(u*TAU+(row%2?.35:-.35));g.translate(...p);rings.push(g);}emit('chest',id,'steel',rings);}
      if(plate){for(let l=0;l<3;l++){part('chest',id,mat,G.shell(48,5,(u,v)=>{const p=chest(u,.09,.027+l*.006,true);p[1]-=.02+l*.034+v*.043;return p;},.006,true),null,{bones:['pelvis','spine01']});}}
      if(plate){
        const channels=[];
        for(const side of[-1,1])for(let n=0;n<3;n++){
          channels.push(G.tube(line(t=>chest(side*(.018+n*.023+t*.025),.23+t*.61,.038,true),24),.00165,5,32,true));
        }
        emit('chest',id,'dark',channels);
        // An embossed bronze escutcheon is seated on the breastplate, with a steel inset.
        const p=chest(0,.72,.039,true),crest=G.extrude([[-.025,.029],[0,.041],[.025,.029],[.019,-.013],[0,-.035],[-.019,-.013]],.007,.0025);
        crest.translate(...p);part('chest',id,'brass',crest,'spine03');
        const inset=G.extrude([[-.017,.019],[0,.027],[.017,.019],[.012,-.008],[0,-.024],[-.012,-.008]],.006,.0015);inset.translate(p[0],p[1],p[2]+.005);part('chest',id,'dark',inset,'spine03');
        for(const u of[.14,.86])studs('chest',id,t=>chest(u,.09+t*.74,.035,true),17,null,'brass',.0032);
      }
      if(k===7||k===8){const ornaments=[];for(let side of[-1,1])for(let row=0;row<5;row++){
        const u=side>0?.035:.965,v=.29+row*.12;const path=line(t=>chest(u+side*t*.105,v+.035*Math.sin(t*PI)-t*.04,.043,true),16);
        ornaments.push(G.tube(path,t=>.0025+.006*Math.sin(t*PI),8,24,true));
      }emit('chest',id,k===8?'bone':'brass',ornaments);
        const keel=line(v=>chest(0,.15+v*.7,.046,true),32);part('chest',id,'dark',G.tube(keel,.0025,6,36,true));
      }
      if(k===5){for(let side=0;side<2;side++)part('chest',id,'cloth',G.shell(30,18,(u,v)=>{const a=mix(side?PI+.13:.13,side?TAU-.13:PI-.13,u),r=.22+v*.02+.004*Math.sin(u*PI*8);return[Math.sin(a)*r,.94-v*.30,cz+Math.cos(a)*r];},.006,false),null,{bones:['pelvis','spine01']});}
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
      const dome=(u,v)=>{const a=u*TAU,e=mix(crown?.03:-.19,PI/2-.004,v),front=Math.max(0,Math.cos(a)),ridge=.006*Math.pow(front,18)*Math.sin(v*PI);return[hc.x+Math.sin(a)*Math.cos(e)*(rx+ridge),hc.y+Math.sin(e)*ry,hc.z+Math.cos(a)*Math.cos(e)*(rz+ridge)];};
      part('head',id,mat,G.shell(64,30,dome,.007,true),'head');
      piping('head',id,'brass',u=>dome(u,0),'head',.0034);
      if(!crown){
        // Separate forehead and pointed visor preserve an actual narrow eye slit.
        const visor=(u,v)=>{const a=mix(-1.27,1.27,u),tip=1-Math.abs(Math.sin(a)),y=hc.y+mix(-ry*.88+ry*.18*Math.abs(Math.sin(a)),ry*.09,v),r=rz+.012+.026*tip*Math.sin(v*PI);return[hc.x+Math.sin(a)*rx,y,hc.z+Math.cos(a)*r];};
        part('head',id,k===3?'dark':mat,G.shell(40,16,visor,.008,false),'head');
        piping('head',id,'edge',u=>visor(u,1),'head',.0026);
        const holes=[];for(let s of[-1,1])for(let row=0;row<3;row++)for(let col=0;col<5;col++){const u=.5+s*(.075+col*.055),p=visor(u,.31+row*.14);holes.push(G.sphere(.0028,p,[1,1,.42],8,6));}emit('head',id,'dark',holes,'head');
        for(const s of[-1,1]){const p=[hc.x+s*rx*.96,hc.y+ry*.05,hc.z];part('head',id,'brass',G.sphere(.009,p,[.35,1,1],16,10),'head');}
        if(k===4){part('head',id,mat,G.shell(64,4,(u,v)=>{const p=dome(u,.1),a=u*TAU;return[p[0]+Math.sin(a)*v*.045,p[1]-.015*v,p[2]+Math.cos(a)*v*.045];},.004,true),'head');}
      }
      if(k===0||k===1||k===3){part('head',id,'dark',G.shell(6,32,(u,v)=>{const e=mix(-.1,PI-.05,v),r=ry+.008+.012*Math.sin(v*PI);return[hc.x+(u-.5)*.009,hc.y+Math.sin(e)*r,hc.z+Math.cos(e)*rz];},.004,false),'head');}
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
        part('boots',id,'strap',G.shell(48,3,(u,v)=>{const p=shoe(u,0);p[1]=sole+v*.022;return p;},.012,true),foot);
        piping('boots',id,'rag',u=>{const p=shoe(u,0);p[1]+=.008;return p;},foot,.0015);
        // Sewn uppers and a distinct heel/toe silhouette replace the old flattened sphere.
        for(const u of[.12,.88])piping('boots',id,'strap',v=>shoe(u,.05+v*.83),foot,.002);
        for(const t of[.74,.89]){part('boots',id,'strap',G.shell(40,3,(u,v)=>cover.at(u*TAU,t+v*.04,.005)[0].toArray(),.004,true),shin);const q=cover.at(0,t+.02,.012),b=G.buckle(.026,.026,.0025);G.orient(b,q[0],q[1]);part('boots',id,'brass',b,shin);}
        if(k){const greave=sleeve(A,shin,foot,.49,.89,.027,.007,BODY,.011);part('boots',id,k===2?'salt':'steel',G.shell(40,24,(u,v)=>greave.at(mix(-PI*.72,PI*.72,u),.49+v*.40,.004+.007*Math.pow(Math.cos(mix(-PI*.72,PI*.72,u)),8))[0].toArray(),.007,false),shin);
          piping('boots',id,'brass',u=>greave.at(u*TAU,.5,.004)[0].toArray(),shin,.0027);
          for(let l=0;l<4;l++)part('boots',id,k===2?'salt':'steel',G.shell(28,8,(u,v)=>{const a=mix(-PI*.43,PI*.43,u),t=.20+l*.18+v*.22,e=mix(.07,.82,t),r=Math.cos(e);return[fc.x+Math.sin(a)*w*1.06*r,sole+.027+Math.sin(e)*Math.max(fs.y*.9,.076),fc.z+Math.cos(a)*length*1.02*r];},.005,false),foot);
          const ridge=line(t=>greave.at(0,.52+t*.33,.006)[0],32);part('boots',id,k===4?'brass':'edge',G.tube(ridge,.002,6,32,true),shin);
          if(k===3){const a=cover.at(0,.92,.01)[0];part('boots',id,'dark',G.chain([a.toArray(),[a.x+.02,a.y-.05,a.z+.01],[a.x,a.y-.085,a.z]],.012),shin);}
        }
      });
    }
    const weapons={};
    const baseParts=()=>({steel:[],edge:[],dark:[],brass:[],leather:[],wood:[],bone:[]});
    function grip(P,length=.29,y=-.28){G.add(P,G.grip(length,.023,12,y));P.brass.push(G.lathe([[0,-.025],[.026,-.025],[.039,-.01],[.035,.014],[.019,.025],[0,.025]],32).translate(0,y-.03,0));}
    ['dull-sword','grave-sword','vow-sword','tide-blade','slag-blade','crown-blade'].forEach((id,k)=>{
      const P=baseParts(),top=[1.04,1.34,1.22,1.30,1.28,1.38][k],b=G.blade(.095,top,80,y=>{const t=(y-.095)/(top-.095),tip=clamp((1-t)/.17,0,1);
        if(k===0){const edge=.046+.05*Math.sin(t*PI*.85),back=-.032+(t>.72?(t-.72)*.30:0);return[back,Math.max(back+.001,edge*clamp((1-t)/.06,0,1))];}
        if(k===1){let back=-.066-t*.044,edge=.072+t*.075;if(t>.91)back=mix(back,edge-.003,(t-.91)/.09);return[back,edge];}
        const curve=k===3?.14*t*t:0,w=([.052,.087,.061,.080,.088,.074][k])*(1-.32*t)*tip;
        const notch=k===4?.009*Math.pow(Math.max(0,Math.sin(t*PI*12)),8)*Math.sin(t*PI):0;return[curve-w+notch,curve+w-notch];},.028,.24,[.28,.56]);
      P.steel.push(b.body);P.edge.push(b.edge);grip(P,k===1?.34:.29,k===1?-.34:-.29);
      const guard=G.extrude([[-.20,.036],[-.18,.073],[-.075,.088],[0,.062],[.075,.088],[.18,.073],[.20,.036],[.17,.025],[.067,.048],[-.067,.048],[-.17,.025]],.044,.006);P.dark.push(guard);
      P.brass.push(G.tube([[-.185,.056,.026],[-.09,.068,.027],[0,.061,.027],[.09,.068,.027],[.185,.056,.026]],.0025,6,32,true));
      P.steel.push(G.extrude([[-.043,.058],[.043,.058],[.04,.15],[-.04,.15]],.032,.003));
      for(const side of[-1,1]){P.brass.push(G.stud(.006,[0,.085,side*.024],[0,0,side]));for(let i=0;i<5;i++){const y=.24+i*.10;P.dark.push(G.tube([[-.009,y-.011,side*.014],[0,y+.011,side*.014],[.009,y-.011,side*.014]],.0013,5,6,true));}}
      if(k===5){for(const side of[-1,1]){
        P.brass.push(G.extrude([[side*.055,.077],[side*.13,.105],[side*.19,.19],[side*.18,.10],[side*.22,.08],[side*.18,.035],[side*.065,.051]],.025,.003));
        P.brass.push(G.tube([[side*.015,.19,.020],[side*.023,.31,.020],[side*.017,.43,.020]],.0018,6,20,true));
      }}
      if(k===2){P.bone.push(G.ring(.028,.004,[0,-.305,0],null,8,32));}
      if(k===5){const jewel=G.extrude([[0,-.012],[.01,0],[0,.016],[-.01,0]],.008,.002);jewel.translate(0,-.32,.033);P.bone.push(jewel);}
      weapons[id]=equipmentWeapon({parts:P,tip:new T.Vector3(k===3?.055:0,top,0)},id,'sword',k===0?'rust':k===3?'salt':'steel');
    });
    ['rust-axe','executioner-axe','hook-axe','furnace-axe'].forEach((id,k)=>{
      const P=baseParts(),top=[.90,1.16,1.08,1.23][k],y=top-.20;
      P.wood.push(G.lathe([[.020,-.43],[.023,-.3],[.025,.25],[.027,y+.10]],24));G.add(P,G.grip(.30,.026,12,-.36));
      const shape=k===2?[[-.033,y+.11],[-.15,y+.19],[-.25,y+.13],[-.31,y-.08],[-.20,y-.29],[-.22,y-.12],[-.13,y-.07],[-.033,y-.08]]:k===3?[[-.033,y+.11],[-.13,y+.20],[-.27,y+.19],[-.32,y+.07],[-.32,y-.11],[-.27,y-.20],[-.12,y-.15],[-.033,y-.08]]:[[-.033,y+.11],[-.15,y+.20],[-.29,y+.16],[-.32,y-.06],[-.28,y-.20],[-.13,y-.10],[-.033,y-.08]];
      P.steel.push(G.extrude(shape,.037,.007,[G.circle(.024,24,-.155,y+.025)]));const boundary=shape.slice(2,5),inner=boundary.map(p=>[p[0]+.023,p[1]]).reverse();P.edge.push(G.extrude(boundary.concat(inner),.013,.002));
      P.dark.push(G.extrude([[.02,y+.10],[.13,y+.06],[.19,y+.12],[.155,y-.06],[.024,y-.08]],.035,.006));
      P.steel.push(G.lathe([[.028,y-.11],[.043,y-.09],[.043,y+.12],[.028,y+.14]],24));
      for(const yy of[y-.09,y+.11])P.brass.push(G.ring(.044,.003,[0,yy,0],null,8,32));
      for(const side of[-1,1])for(let i=0;i<4;i++)P.brass.push(G.stud(.0035,[-.085-i*.047,y+.10-Math.sin(i)*.014,side*.027],[0,0,side]));
      for(const side of[-1,1]){
        const border=shape.slice(1,6).map(p=>[p[0]*.84,p[1]*.97+y*.03,side*.026]);P.dark.push(G.tube(border,.0018,6,28,true));
        const motif=[[-.12,y-.03,side*.027],[-.19,y-.09,side*.027],[-.21,y-.03,side*.027]];P.brass.push(G.tube(motif,.002,6,14,true));
      }
      P.brass.push(G.lathe([[0,-.014],[.029,-.014],[.031,.007],[0,.014]],24).translate(0,-.445,0));
      weapons[id]=equipmentWeapon({parts:P,tip:new T.Vector3(-.15,top,0)},id,'axe',k===0?'rust':'steel');
    });
    ['bone-spear','bell-spear','fork-spear'].forEach((id,k)=>{
      const P=baseParts(),top=1.75+k*.08;P.wood.push(G.lathe([[.018,-.54],[.023,-.40],[.022,top-.37]],24));G.add(P,G.grip(.40,.024,16,-.20));
      const b=G.blade(top-.43,top,64,y=>{const t=(y-top+.43)/.43,w=.065*Math.sin(t*PI)*Math.pow(1-t,.25);return[-w,w];},.027,.25,[.27,.55]);P.steel.push(b.body);P.edge.push(b.edge);
      P.steel.push(G.lathe([[.025,top-.49],[.028,top-.36],[.019,top-.28]],24));
      for(const yy of[top-.46,top-.37,-.48])P.brass.push(G.ring(.028,.003,[0,yy,0],null,8,28));
      P.steel.push(G.lathe([[.007,-.69],[.024,-.54],[.023,-.50]],24));
      if(k===1){P.brass.push(G.lathe([[.017,0],[.022,-.03],[.033,-.07],[.051,-.10],[.052,-.11],[.042,-.11],[.025,-.07],[.017,0]],32).translate(0,top-.49,0));P.dark.push(G.sphere(.010,[0,top-.58,0],null,16,10));}
      if(k===2)for(const s of[-1,1]){P.steel.push(G.extrude([[s*.025,top-.38],[s*.095,top-.28],[s*.115,top-.05],[s*.103,top+.005],[s*.087,top-.24],[s*.024,top-.32]],.016,.003));}
      weapons[id]=equipmentWeapon({parts:P,tip:new T.Vector3(0,top,0)},id,'spear',k===1?'salt':'steel');
    });
    return weapons;
  }
  B.EquipmentArt={material,finish,build,finishes};
})();
