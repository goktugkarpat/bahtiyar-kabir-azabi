/* KARA GEÇİT — "Kor ve Kül" (ember and ash): diegetic attack tells.
   The attacker tells first (an ember rim building on its body, the weapon heating like forge iron, a glint at the tip),
   then the floor: soft light pooling where the blow will land, continuous feathered edges, rune glyphs that ignite one
   by one, cracks that glow, a faint blade-arc ribbon, and a short flare .18 s before contact.
   Reading rules (the hero has no block, every blow is avoided by rolling): one soft gold edge + embers drifting out = an ordinary blow, avoid it
   if you can; crimson edge + a pale inner hairline + ash drawn inward (+ a bell) = a severe blow, dodge it. The fill moves the way the blow travels and carries the timing.
   Renderer only: reads game.hazards / enemies / player. All timing comes from the combat clocks (h.age, h.warn),
   never from render time or the preset, so hit-stop and slow motion freeze/slow the tells with the fight.
   Also draws the hero's war cry (shockwave, aura, eyes) and soft floor light bursts for effects.js. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {}, T = window.THREE;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const LEAD = .18;
  const groundY = (x,z,r) => { const w=B.app && B.app.world; return w && w.effectHeightAt ? w.effectHeightAt(x,z,r||0) : .035; };
  // Pool: the shader works in world XZ; the quad only has to cover the shape. Output is linear HDR (the app tone-maps later).
  const POOL_VS = 'varying vec2 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }';
  const POOL_FS = `uniform vec2 uOrigin; uniform float uFace; uniform int uShape; uniform vec4 uDim;
uniform float uU,uFlare,uHit,uFade,uGain,uSweepDir,uUnblock,uDetail,uTime,uSeed,uCalm,uHitK,uActive,uSafeReady; uniform int uFill,uStyle;
uniform vec3 uEdge,uFillCol,uFront; uniform vec4 uK,uE; uniform float uBreak,uF,uCk; uniform vec3 uHl; uniform vec3 uPA,uPB; uniform sampler2D uRune,uCrack; varying vec2 vW;
float rmax(float a, float b, float k){ return length(max(vec2(a+k, b+k), 0.)) + min(max(a, b)+k, 0.) - k; }
void main(){
  vec2 d = vW - uOrigin; float cs = cos(uFace), sn = sin(uFace);
  float side = cs*d.x - sn*d.y, fwd = sn*d.x + cs*d.y;
  float r = length(d), ang = r > 1e-6 ? atan(side, fwd) : 0., R = uDim.x, span = 6.2832, sd, t;
  if (uShape == 0) { sd = r - R; t = r/R; }
  // Cones keep the true sector boundary; a line's base is the exact combat width × length.
  // Noise, feathering and the halo below soften its edge without shrinking the danger area.
  else if (uShape == 1) { span = uDim.y; float a = abs(ang)-span*.5, sdS = a > 0. ? r*sin(min(a,1.5708)) : a*r;
         sd = max(r-R, sdS); sd = max(sd, .28-r); t = r/R; }
  else if (uShape == 2) { vec2 q = vec2(abs(side), abs(fwd-uDim.y*.5)) - vec2(uDim.x*.5, uDim.y*.5);
         sd = length(max(q, 0.)) + min(max(q.x, q.y), 0.); t = fwd/uDim.y; R = uDim.y; }
  else { span = uDim.z; float a = abs(ang)-span*.5, ring = max(uDim.x-r, r-uDim.y), rc = min(.4, (uDim.y-uDim.x)*.4);
         sd = span < 6.28 ? rmax(ring, a > 0. ? r*sin(min(a,1.5708)) : a*r, rc) : ring;
         t = (r-uDim.x)/max(.01, uDim.y-uDim.x); R = uDim.y; }
  if (sd > .7 && uStyle != 13) discard;
  // Continuous curved bands: no lattice cells or texture-resolution steps in warning light.
  float n = .5+.14*sin(dot(vW,vec2(1.13,.79))+uSeed)+.10*sin(dot(vW,vec2(-.67,1.41))-.7*uSeed);
  float aa = max(fwidth(sd),.004), inside = 1.-smoothstep(-aa, aa, sd);
  if (uStyle == 13) {   // shelter: blue is safe, muted red outside is damaging water
    if (r > uDim.y+.3) discard;
    float rimD = r-uDim.x, rimAA=max(fwidth(rimD),.015);
    float safe=1.-smoothstep(-rimAA,rimAA,rimD), rim=exp(-pow(rimD/.07,2.));
    float dashed=mix(.32,1.,smoothstep(-.1,.2,cos(ang*18.)));
    float ready=max(uActive,uSafeReady), border=mix(dashed*.38,1.,ready);
    float ink=(.035+.025*n)*uActive;
    vec3 c=mix(vec3(.23,.045,.032),vec3(.10,.27,.34),safe);
    c+=vec3(.19,.46,.57)*rim*border;
    float al=(1.-safe)*ink + safe*(.025+.07*ready) + rim*(.18+.50*border);
    gl_FragColor=vec4(c,al*uFade); return; }
  if (uStyle == 12) {   // settled bile: murky liquid with a wet meniscus (normal blending)
    float wob = .5+.20*sin(dot(vW,vec2(.73,.91))+uTime*.07+uSeed)+.12*sin(dot(vW,vec2(-1.31,.59))-uTime*.05);
    float men = exp(-abs(sd+.06)/(.05+.03*n)) * (.8+.2*sin(dot(vW,vec2(2.31,3.17))+uTime*.2));
    vec3 c = mix(uPA, uPB, wob) + uEdge*men*.6;
    float al = clamp(inside*(.62+.22*wob) + men*.35, 0., .9);
    gl_FragColor = vec4(c, al*uFade*uGain); return; }
  float sw = clamp((ang*uSweepDir + span*.5)/span, 0., 1.), tc = clamp(t, 0., 1.);
  float ft = uFill == 2 ? sw : uFill == 3 ? 1.-tc : uFill == 4 ? 1.-abs(2.*tc-1.) : tc;
  float e = 1.-(1.-uU)*(1.-uU), front = mix(.10, 1.06, e);
  float lit = 1.-smoothstep(front-.10, front, ft), band = smoothstep(front-.18, front-.03, ft)*lit;
  // A full-circle sweep starts and ends on the same radius: feather the start so the wrap never reads as a straight seam.
  // The bright front band also fades out over the last few degrees, where it would meet the start line.
  if (uFill == 2 && span > 6.2) { float fe = mix(smoothstep(0., .09, ft), 1., e*e); lit *= fe; band *= fe * (1.-smoothstep(.9, 1., ft)); }
  float edge = exp(-abs(sd)/max(uE.w,fwidth(sd)*1.5));
  float edgeK = uE.x + uE.y*uU*uU + uE.z*uFlare;
  if (uStyle == 5 && uShape == 0) {    // stalker landing shadow (circles only; lines/rings/cones of this style use the gold/crimson edge language below)
    // A dark disc gathers where it will land, a ring of gold light closes in on the centre as it drops.
    float core = 1.-smoothstep(0., 1., r/max(.01,R)), rr = 1.-e*.85, ringD = (t-rr)/.07, ringIn = exp(-(ringD*ringD))*inside;
    float al = clamp(inside*(.26+.5*uU*uU)*(.65+.35*n)*(.55+.45*core) + edge*(.55+.4*uFlare) + ringIn*.5, 0., .9);
    vec3 c = uEdge*(edge*(.12 + edgeK*3.) + ringIn*(.05+.25*uU*uU+.6*uFlare)*(.6+.4*n) + edge*uHit*.8);
    gl_FragColor = vec4(c, al*uFade); return; }
  // The exact danger boundary is a continuous light line with a soft Gaussian halo.
  // Texture stays inside the area; it never breaks the rim into cloudy chunks.
  float px = max(fwidth(sd), 1e-4);
  float sdj = sd, inJ = 1.-smoothstep(-px, px, sdj), depth = max(-sdj, 0.);
  float perim = uShape==2 ? fwd : ang*R;
  float dash = 1.;
  float flick = uCalm > .5 ? 1. : .94+.06*sin(uTime*3.);
  float ember = 1.;
  // The restrained burrow mark keeps the same SDF boundary, with a tighter light halo.
  float innerWidth=uE.w<.06?.036:.055,haloWidth=uE.w<.06?.10:.18;
  float inner = exp(-pow(sd/max(innerWidth,px*1.5),2.)), outer = exp(-pow(sd/haloWidth,2.));
  float coordT = (uShape==0||uShape==3) ? (uFill==3 ? -r : r) : (uShape==2 ? fwd : r);
  float chev = (uShape==1||uShape==2) ? abs(side)*.55 : 0.;
  float mv = uCalm > .5 ? 0. : uTime*.5*(uFill==3 ? -1. : 1.);
  float g = cos((coordT*.8 - chev - mv)*6.2832), stripe = smoothstep(.35,.92,g);
  float veinPhase=vW.x*2.3+vW.y*1.71+sin(vW.x*1.2-vW.y*.83+uSeed)*1.3;
  float vein = smoothstep(.65-fwidth(veinPhase),.96+fwidth(veinPhase),.5+.5*sin(veinPhase));
  float lamp = uU*uU*(3.-2.*uU), core = .45+.55*exp(-depth/.9);
  vec3 col = vec3(0.); float dark = 0.;
  dark += inJ*(uK.x + uK.y*uU)*.8 + exp(-max(sdj, 0.)/.4)*(1.-inJ)*.2*(1.-smoothstep(.25, .68, sd));
  col += uFillCol*inJ*(uK.x*.3 + uK.z*lit*(.5+.5*n)*core + uK.z*.35*lit*stripe*(.4+.6*lamp));
  col += uFillCol*inJ*uK.z*.5*lit*vein*(.35+.65*lamp);
  col += uFront*band*inJ*uK.w*(.6+.4*n)*(.75+.25*flick);
  col += uFront*inJ*uFlare*uF*(.5+.5*n);
  float rimK = edgeK*flick;
  col += uEdge*inner*rimK*ember*dash*.85 + uEdge*outer*rimK*ember*.25;
  col += uEdge*exp(-max(sdj, 0.)/.5)*(1.-inJ)*(uUnblock > .5 ? .13 : .06)*(.4+.6*lamp+uFlare)*(1.-smoothstep(.3, .69, sd));
  if (uUnblock > .5) { float crawl = 1.;
    col += vec3(1.25,1.05,.9)*exp(-abs(sd+.19)/.045)*crawl*(uHl.x+uHl.y*uU*uU+uHl.z*uFlare)*inJ*.8; }
  if (uStyle == 4) { vec2 cuv = uShape==2 ? vec2(side/uDim.x*.25+.5, fwd/uDim.y) : vec2(side,fwd)/(2.*R)+.5;
    float texEdge=min(min(cuv.x,1.-cuv.x),min(cuv.y,1.-cuv.y));
    float crack = (uShape==2 ? texture2D(uCrack,cuv).g : texture2D(uCrack,cuv).r)*smoothstep(0.,.04,texEdge);
    col += uEdge*crack*inside*(.1 + uCk*lit*uU + 2.*uHit); }
  if (uStyle == 2 && uShape == 0) { float glyph = texture2D(uRune, vec2(side,fwd)/(2.*R)+.5).r;
    float slot = (floor(fract(ang/6.2832+.5)*16.)+.5)/16.;
    col += uEdge*glyph*(.18 + 1.1*step(slot, uU*1.02) + uFlare); }
  // Contact: the whole area snaps white-hot for an instant, the rim flares.
  col += uFront*inJ*uHit*uHitK*(.9+.4*n) + uEdge*inner*uHit*1.6;   // uHitK: a boss-sized area flashes softer, so the contact moment stays crisp without a screen-wide glare
  dark *= 1.-uHit;
  float support=1.-smoothstep(.55,.69,max(sd,0.));
  col *= uFade*uGain*support; dark *= uFade*support;
  if (max(col.r,max(col.g,col.b)) < .002 && dark < .004) discard;
  gl_FragColor = vec4(col, clamp(dark, 0., .85));
}`;
  // Ghost arc: a faint light ribbon at weapon height along the real blade path; its head arrives at contact time.
  // MSAA can shade edge pixels at a centre just outside the triangle. Clamp fractional-power bases so
  // extrapolated UVs and rounded normals cannot generate NaNs that then spread through the HDR bloom chain.
  const RIB_VS = `uniform float uMode,uArc,uRad,uWidth,uLen,uDir; varying vec2 vUv; void main(){ vUv=uv; float t=uv.x, v=uv.y-.5; vec3 p;
 if (uMode < .5) { float a = (-uArc*.5 + uArc*t)*uDir; float rr = uRad + v*uWidth; p = vec3(sin(a)*rr, 0., cos(a)*rr); } else p = vec3(v*uWidth, 0., t*uLen);
 gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`;
  const RIB_FS = `uniform float uHead,uFlare,uFade,uCalm; uniform vec3 uColor; varying vec2 vUv; void main(){ float t=vUv.x;
 float headD = (t-uHead)*7.; float head = uCalm > .5 ? 0. : exp(-(headD*headD)); float tail = smoothstep(uHead-.4, uHead, t)*step(t, uHead+.02);
 float a = (.25*tail + .8*head)*smoothstep(.35,.85,uHead)*pow(clamp(1.-abs(vUv.y-.5)*2., 0., 1.), 1.5)*(1.+1.5*uFlare)*uFade; if (a < .003) discard; gl_FragColor = vec4(uColor*a, 1.); }`;
  // Rim shells: an inflated fresnel copy of the body (skinned) or of each weapon part (static). Additive.
  const RIM_VS = `#include <common>
#include <skinning_pars_vertex>
uniform float uInflate; varying vec3 vN; varying vec3 vV; varying vec3 vP;
vec3 tellUnit(vec3 v){ return v*inversesqrt(max(dot(v,v),1e-12)); }
void main(){
#include <skinbase_vertex>
#include <beginnormal_vertex>
#include <skinnormal_vertex>
#include <begin_vertex>
#include <skinning_vertex>
 vP = position; transformed += tellUnit(objectNormal) * uInflate;
 vec4 mv = modelViewMatrix * vec4(transformed, 1.);
 vN = tellUnit(normalMatrix * objectNormal); vV = tellUnit(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  // uVein > 0 (the raging hero only): ember veins flow up the whole body and blade, not just along the rim.
  const RIM_FS = `uniform vec3 uColor; uniform float uGlow, uVein, uVTime; uniform vec2 uP; varying vec3 vN; varying vec3 vV; varying vec3 vP;
vec3 tellUnit(vec3 v){ return v*inversesqrt(max(dot(v,v),1e-12)); }
float vh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
 return mix(mix(mix(vh(i), vh(i+vec3(1,0,0)), f.x), mix(vh(i+vec3(0,1,0)), vh(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(vh(i+vec3(0,0,1)), vh(i+vec3(1,0,1)), f.x), mix(vh(i+vec3(0,1,1)), vh(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main(){ float f = clamp(1. - abs(dot(tellUnit(vN), tellUnit(vV))), 0., 1.); float a = pow(f, uP.x) + uP.y;
 if (uVein > 0.) { float w = vn3(vP * 9. + vec3(0., -uVTime * 1.6, 0.)); float veins = pow(1. - abs(w * 2. - 1.), 20.);
  float w2 = vn3(vP * 21. + vec3(uVTime * .7, -uVTime * 2.4, 0.)); a += uVein * (veins * 1.3 + .22 * pow(1. - abs(w2 * 2. - 1.), 16.)); }
 a *= uGlow;
 if (a < .003) discard; gl_FragColor = vec4(uColor * a, 1.); }`;
  // Shockwave through the floor (war cry, roars): a continuous ring of heat running outward, glowing cracks at its heart.
  const WAVE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }';
  const WAVE_FS = `uniform float uR,uW,uA,uSeed,uMax,uCrackA,uCrackR,uSoft; uniform vec3 uCol; uniform sampler2D uCrack; varying vec2 vUv;
void main(){ vec2 p = (vUv-.5)*2.*uMax; float r = length(p), a = r > 1e-6 ? atan(p.x, p.y) : 0.;
 if(r>=uMax)discard;
 // Integer angular frequencies join seamlessly at the full-circle wrap.
 float n=.5+.5*sin(a*5.+sin(r*1.3)+uSeed), n2=.5+.5*sin(a*13.+r*3.1+uSeed*2.);
 float scallop=(.024+.007*uR)*(sin(a*13.+uSeed)+.55*sin(a*29.-uSeed));
 float px=max(fwidth(r),1e-4),ringD=(r-uR-scallop)/max(px*1.5,uW*(.80+.25*n));
 float ring=exp(-(ringD*ringD))*(.20+.80*smoothstep(.20,.70,n2));
 float heat = (1.-smoothstep(0., max(.01,uR), r)) * .18 * (.6+.4*n);
 vec3 col = uCol*(ring + heat*uSoft)*uA;
 vec2 cuv=p/(2.*max(.01,uCrackR))+.5;float texEdge=min(min(cuv.x,1.-cuv.x),min(cuv.y,1.-cuv.y));
 float crack=texture2D(uCrack,clamp(cuv,vec2(0.),vec2(1.))).r*smoothstep(0.,.045,texEdge)*(1.-smoothstep(.87,1.,r/max(.01,uCrackR)));
 col += uCol*crack*uCrackA;
 // A Gaussian never reaches zero: fade its distant tail inside a circular support,
 // before it can expose the rectangular carrier, even for very broad water waves.
 col *= 1.-smoothstep(uMax-max(.12,uW*.65),uMax,r);
 if (max(col.r,max(col.g,col.b)) < .002) discard; gl_FragColor = vec4(col, 1.); }`;
  // Soft pooled floor light (glowBurst) and aura sprites.
  const GLOW_FS = `uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv-.5)*2.; float a = pow(max(0.,1.-r),2.2)*uA; if (a < .002) discard; gl_FragColor = vec4(uCol*a, 1.); }`;

  function seeded(s) { return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  // The draw functions work in a 512-unit (or `base`) square; the canvas is rendered at `size` (1024/2048 on high) with the context scaled,
  // then mipmapped with anisotropic filtering, so the rune / crack detail stays sharp at any display resolution and MSAA level.
  function canvasTex(size, draw, srgb, base) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), k = size / (base || 512); x.scale(k, k); draw(x, base || 512, k);
    const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 8; t.needsUpdate = true; return t; }
  function runeTex(S) {
    return canvasTex(S, (x, sz, k) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.strokeStyle = '#f00'; x.shadowColor = '#f00'; x.shadowBlur = 6 * k; x.lineCap = 'round';
      x.lineWidth = 3; [.68, .93].forEach(k => { x.beginPath(); x.arc(256, 256, 256 * k, 0, TAU); x.stroke(); });
      const rnd = seeded(77); x.lineWidth = 5;
      for (let i = 0; i < 16; i++) {
        // slot i covers ang in [i/16 - .5, (i+1)/16 - .5] * TAU; canvas (u=side, v=fwd): ang = atan(side, fwd)
        const ang = ((i + .5) / 16 - .5) * TAU, cx = 256 + Math.sin(ang) * 205, cy = 256 - Math.cos(ang) * 205;
        x.save(); x.translate(cx, cy); x.rotate(-ang); const k = 3 + Math.floor(rnd() * 3); x.beginPath();
        for (let s = 0; s < k; s++) { const ax = (rnd() - .5) * 26, ay = (rnd() - .5) * 30; x.moveTo(ax, ay); x.lineTo(ax + (rnd() - .5) * 24, ay + (rnd() - .5) * 26); }
        x.stroke(); x.restore();
      }
    }, false, 512);
  }
  // R: nine random-walk cracks from the centre (circles). G: one jagged crack bottom->top with branches (lines).
  function crackWalks(x, color, radial, line) {
    let rnd = seeded(9);
    function walk(px, py, a, w, steps) {
      for (let s = 0; s < steps; s++) {
        const l = 10 + rnd() * 6, nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l; x.strokeStyle = color; x.lineWidth = Math.max(1, w * (1 - s / steps));
        x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); px = nx; py = ny; a += (rnd() - .5);
        if (rnd() < .06) walk(px, py, a + (rnd() < .5 ? .7 : -.7), w * .6, (steps - s) * .6 | 0);
      }
    }
    if (radial) { rnd = seeded(9); for (let i = 0; i < 9; i++) walk(256, 256, i / 9 * TAU + rnd() * .5, 5, 20); }
    if (line) { rnd = seeded(21); walk(256, 510, -Math.PI / 2, 5, 34); }
  }
  function crackTex(S) {
    return canvasTex(S, (x, sz, k) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.lineCap = 'round'; x.globalCompositeOperation = 'lighter';
      [['blur(' + 1.5 * k + 'px)'], ['none']].forEach(pass => { x.filter = pass[0]; crackWalks(x, '#f00', true, false); crackWalks(x, '#0f0', false, true); });
      x.filter = 'none';
    }, false, 512);
  }
  // Dark scars left in the floor by quakes and falling hooks (white on transparent; tinted by the material).
  function featherScar(x) {
    x.globalCompositeOperation='destination-in';
    [[0,0,12,512,0,0,12,0],[500,0,12,512,512,0,500,0],[0,0,512,12,0,0,0,12],[0,500,512,12,0,512,0,500]].forEach(v=>{
      x.save();x.beginPath();x.rect(v[0],v[1],v[2],v[3]);x.clip();const g=x.createLinearGradient(v[4],v[5],v[6],v[7]);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,1)');x.fillStyle=g;x.fillRect(v[0],v[1],v[2],v[3]);x.restore();
    });
    x.globalCompositeOperation='source-over';
  }
  function scarTex(radial,S,inner) {
    return canvasTex(S,(x)=>{
      x.clearRect(0,0,512,512);x.lineCap='butt';x.lineJoin='bevel';
      const rand=seeded(radial?191:213);
      function fracture(px,py,a,width,steps,branch){
        for(let j=0;j<steps;j++){
          const len=12+rand()*13,bend=(rand()-.5)*1.3;
          a+=bend;const nx=px+Math.cos(a)*len,ny=py+Math.sin(a)*len;
          const taper=Math.max(.12,1-j/steps),heatGap=rand();
          if(!inner||heatGap>.26){x.lineWidth=Math.max(inner?.55:1.0,width*taper*(inner?.18:1));x.strokeStyle=inner?'rgba(255,255,255,.72)':'rgba(255,255,255,.90)';
            x.beginPath();x.moveTo(px,py);x.lineTo(nx,ny);x.stroke();}
          const fork=rand();if(branch&&fork<.22)fracture(nx,ny,a+(rand()<.5?-.85:.85),width*.48,Math.max(2,(steps-j)*.4|0),false);
          px=nx;py=ny;
        }
      }
      if(radial){for(let i=0;i<6;i++)fracture(256,256,i/6*TAU+(rand()-.5)*.3,7+rand()*3,12+Math.floor(rand()*3),true);}
      else fracture(256,508,-Math.PI/2,8,24,true);
      if(!inner&&radial){const g=x.createRadialGradient(256,256,0,256,256,57);g.addColorStop(0,'rgba(255,255,255,.32)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,512,512);}
      featherScar(x);
    },false,512);
  }
  function starTex() {
    return canvasTex(256, x => {
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#fff'); g.addColorStop(.12, 'rgba(255,255,255,.55)'); g.addColorStop(.4, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.globalCompositeOperation = 'lighter';
      [[128, 3], [3, 128]].forEach(s => { const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr; x.fillRect(64 - s[0] / 2, 64 - s[1] / 2, s[0], s[1]); });
    }, false, 128);
  }
  function dotTex() { return canvasTex(128, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }, false, 64); }

  const SHAPE = { circle: 0, cone: 1, line: 2, ring: 3 };
  const FILL = { radial: 0, forward: 1, sweep: 2, inward: 3, converge: 4 };
  const STYLE = { blade: 0, blunt: 1, rune: 2, bile: 3, quake: 4, shadow: 5, chain: 6, ember: 7, fall: 8, thrust: 9, grab: 10, roar: 11, root: 4, tide: 6 };
  const DETAIL = { low: 1, high: 3 }, PFACTOR = { low: .3, high: .675 };
  const GOLD = { edge: [1.6, 1.05, .5], fill: [.7, .28, .07], front: [1.5, .95, .5] }, CRIMSON = { edge: [1.9, .16, .1], fill: [.85, .05, .04], front: [1.5, .3, .2] };
  const AMBER_RIM = [1.6, .7, .25], CRIMSON_RIM = [1.7, .12, .08], BILE_RIM = [1.2, .5, .12], RAGE_RIM = [1.05, .20, .055], COOL_RIM = [.55, .065, .025];

  B.Telegraphs = { create(root, getGame, getSettings, out) {
    // out: { emit(x,y,z,kind,color,vx,vy,vz,life,size), sound(name, opts) } from effects.js.
    const group = new T.Group(); group.name = 'kor_ve_kul_tells'; root.add(group);
    const hiTex = (((getSettings && getSettings()) || {}).quality || 'high') !== 'low', TS = hiTex ? 2048 : 1024;   // 2048 px = 21 MB with mips each for rune and crack
    const textures = { rune: runeTex(TS), crack: crackTex(TS), star: starTex(), dot: dotTex(), scarRadial: scarTex(true, TS / 2), scarLine: scarTex(false, TS / 2), scarRadialHot:scarTex(true,512,true), scarLineHot:scarTex(false,512,true) };
    const plane = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ribGeo = new T.PlaneGeometry(1, 1, 48, 1);
    const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const poolBase = new T.ShaderMaterial({ vertexShader: POOL_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false, depthTest: true,
      blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false,
      uniforms: { uOrigin: { value: new T.Vector2() }, uFace: { value: 0 }, uShape: { value: 0 }, uDim: { value: new T.Vector4() }, uU: { value: 0 }, uFlare: { value: 0 },
        uHit: { value: 0 }, uFade: { value: 0 }, uGain: { value: 1 }, uFill: { value: 0 }, uSweepDir: { value: 1 }, uUnblock: { value: 0 }, uStyle: { value: 0 }, uDetail: { value: 3 },
        uTime: { value: 0 }, uSeed: { value: 0 }, uCalm: { value: 0 }, uHitK: { value: 1 }, uActive: { value: 0 }, uSafeReady: { value: 0 }, uK: { value: new T.Vector4(.006, .012, .03, .10) }, uE: { value: new T.Vector4(.02, .14, .35, .07) },
        uBreak: { value: .85 }, uF: { value: .12 }, uCk: { value: .8 }, uHl: { value: new T.Vector3(.08, .25, .5) }, uPA: { value: new T.Vector3(.006, .011, .003) }, uPB: { value: new T.Vector3(.028, .05, .009) },
        uEdge: { value: new T.Vector3() }, uFillCol: { value: new T.Vector3() }, uFront: { value: new T.Vector3() }, uRune: { value: textures.rune }, uCrack: { value: textures.crack } } });
    const ribBase = new T.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      uniforms: { uMode: { value: 0 }, uArc: { value: 1 }, uRad: { value: 1 }, uWidth: { value: .16 }, uLen: { value: 1 }, uDir: { value: 1 }, uHead: { value: 0 }, uFlare: { value: 0 }, uFade: { value: 0 }, uCalm: { value: 0 }, uColor: { value: new T.Vector3() } } });
    const waveBase = new T.ShaderMaterial({ vertexShader: WAVE_VS, fragmentShader: WAVE_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { uR: { value: 0 }, uW: { value: .3 }, uA: { value: 0 }, uSeed: { value: 0 }, uMax: { value: 6 }, uCrackA: { value: 0 }, uCrackR: { value: 2 }, uSoft: { value: 1 }, uCol: { value: new T.Vector3() }, uCrack: { value: textures.crack } } });
    const glowBase = new T.ShaderMaterial({ vertexShader: WAVE_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, uniforms: { uCol: { value: new T.Vector3() }, uA: { value: 0 } } });

    // ------------------------------------------------------------------ pooled ground tells
    const tells = [], live = new Map(), seen = new Set();
    let clock = 0, lastReset = null, warmed = false, frameDt = 0;
    function makeTell() {
      const mat = poolBase.clone(); mat.uniforms.uRune.value = textures.rune; mat.uniforms.uCrack.value = textures.crack;
      const mesh = new T.Mesh(plane, mat); mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'tell';
      const ribMat = ribBase.clone(), rib = new T.Mesh(ribGeo, ribMat); rib.renderOrder = 3; rib.frustumCulled = false; rib.visible = false;
      group.add(mesh, rib);
      const t = { mesh, mat, rib, ribMat, h: null, busy: false, releasing: false, rel: 0, struck: false, acc: {}, flared: false, fade: 0, last: null, state: { u: 0, flare: 0, hit: 0 } };
      tells.push(t); return t;
    }
    for (let i = 0; i < 24; i++) makeTell();
    function acquire(h) {
      const t = tells.find(o => !o.busy) || makeTell();
      t.busy = true; t.releasing = false; t.rel = 0; t.h = h; t.struck = false; t.flared = false; t.acc = {}; t.fade = 0; t.snap = null;
      live.set(h, t); return t;
    }
    function free(t) { t.busy = false; t.releasing = false; t.h = null; t.mesh.visible = false; t.rib.visible = false; }
    function vec(v, a) { v.set(a[0], a[1], a[2]); }
    const POOLS = { lava: { a: [.04, .008, .003], b: [.19, .04, .008], edge: [1.2, .22, .07], bub: [3, 1, .2] }, dark: { a: [.002, .008, .011], b: [.007, .026, .03], edge: [.3, .9, .85], bub: [.2, .7, .6] }, brine: { a: [.003, .014, .014], b: [.014, .05, .044], edge: [1.15, .19, .12], bub: [.3, .85, .6] } };   // round 7: hazard.pool tints persistent floor liquids (burning strips, brine, drowning dark)
    const styleOf = h => h.pool === 'dark' ? 13 : (h.poison || h.pool) && h.persistent && h.active ? 12 : STYLE[h.style] != null ? STYLE[h.style] : 0;
    function place(t, h) {
      const u = t.mat.uniforms, shape = SHAPE[h.shape] != null ? SHAPE[h.shape] : 0, style = styleOf(h);
      const liquid = style === 12 || style === 13, unb = !!h.unblockable && !liquid, pal = unb ? CRIMSON : GOLD;
      // Capture this once: recovery must not brighten if the owner's action finishes first.
      t.burrow = !!(h.owner && h.owner.action && h.owner.action.burrow &&
        (h.shape === 'circle' || h.shape === 'ring') && (h.style === 'fall' || h.style === 'quake'));
      t.riteSpike = !!(h.owner && h.owner.action && h.owner.action.moveId === 'rite' &&
        h.attack === 'Çapa Zinciri' && h.style === 'fall' && h.shape === 'circle' && h.radius === 1.7);
      u.uOrigin.value.set(h.x, h.z); u.uFace.value = h.face || 0; u.uShape.value = shape; u.uStyle.value = style;
      if (shape === 0) u.uDim.value.set(h.radius, 0, 0, 0); else if (shape === 1) u.uDim.value.set(h.radius, h.arc, 0, 0);
      else if (shape === 2) u.uDim.value.set(h.width, h.length, 0, 0); else u.uDim.value.set(h.inner || 0, h.radius, h.arc || TAU, 0);
      u.uFill.value = FILL[h.fill] != null ? FILL[h.fill] : 0; u.uSweepDir.value = h.sweepDir || 1; u.uUnblock.value = unb ? 1 : 0;
      // Gold = continuous ordinary boundary; crimson = severe boundary plus a pale inner hairline.
      u.uBreak.value = unb ? .1 : .3; u.uHl.value.set(unb ? .4 : .08, .5, 1);
      u.uSeed.value = ((h.x * 3.1 + h.z) % 7 + 7) % 7;
      if (liquid) { const pl = POOLS[h.pool]; if (pl) { vec(u.uEdge.value, pl.edge); vec(u.uFront.value, pl.edge); vec(u.uFillCol.value, pl.b); vec(u.uPA.value, pl.a); vec(u.uPB.value, pl.b); } else { vec(u.uEdge.value, [.35, .55, .12]); vec(u.uFront.value, [.12, .2, .04]); vec(u.uFillCol.value, [.1, .18, .03]); u.uPA.value.set(.006, .011, .003); u.uPB.value.set(.028, .05, .009); } }
      // A flying vial lands inside a gold (or crimson) ring like every other blow; only its olive fill hints at the bile.
      else { vec(u.uEdge.value, pal.edge); vec(u.uFront.value, pal.front); vec(u.uFillCol.value, h.style === 'bile' ? [pal.fill[0] * .85, pal.fill[1] * .9 + .05, pal.fill[2]] : pal.fill); }
      if(h.style==='tide') u.uFillCol.value.set(.10,.25,.27);
      else if(h.style==='root') u.uFillCol.value.set(.17,.14,.06);
      t.mat.blending = (style === 5 && shape === 0) || liquid ? T.NormalBlending : T.CustomBlending;
      const m = t.mesh; m.rotation.set(0, 0, 0);
      if (shape === 2) { m.scale.set(h.width + 1.4, 1, h.length + 1.4); m.rotation.y = h.face; m.position.set(h.x + Math.sin(h.face) * h.length / 2, groundY(h.x,h.z,h.length), h.z + Math.cos(h.face) * h.length / 2); }
      else { const R = h.radius; m.scale.set(2 * R + 1.4, 1, 2 * R + 1.4); m.position.set(h.x, groundY(h.x,h.z,h.radius), h.z); }
      // Ribbon: slashes/whips/grabs along the blade arc, thrusts and chains along their line.
      const ribbon = !h.persistent && ((shape === 1 || shape === 3) && /blade|chain|grab/.test(h.style) || shape === 2 && /thrust|chain/.test(h.style));
      t.ribbon = ribbon;
      if (ribbon) {
        const r = t.ribMat.uniforms, boss = !!(h.owner && h.owner.boss);
        r.uMode.value = shape === 2 ? 1 : 0; r.uArc.value = shape === 3 ? (h.arc || TAU) : h.arc || 1; r.uRad.value = shape === 3 ? ((h.inner || 0) + h.radius) / 2 : .78 * h.radius;
        r.uWidth.value = boss ? .28 : .16; r.uLen.value = h.length || 1; r.uDir.value = h.sweepDir || 1;
        r.uColor.value.set(pal.edge[0] * .3, pal.edge[1] * .3, pal.edge[2] * .3);
        t.rib.position.set(h.x, boss ? 1.6 : h.owner && h.owner.type === 'prisoner' ? .8 : 1.0, h.z); t.rib.rotation.set(0, h.face || 0, 0);
      }
      t.placed = style;
    }
    const stateScratch = { u: 0, flare: 0, hit: 0 };
    function tellState(h, target) {
      const u = clamp(h.age / h.warn, 0, 1), flare = h.active ? Math.max(0, 1 - (h.age - h.warn) / .12) : smooth((h.age - (h.warn - LEAD)) / LEAD);
      const hit = h.active ? Math.max(0, 1 - (h.age - h.warn) / .25) : 0;
      const result = target || stateScratch; result.u = u; result.flare = flare; result.hit = hit; return result;
    }
    function update(t, h, cfg, calm) {
      if (t.placed !== styleOf(h)) place(t, h);
      const u = t.mat.uniforms, s = tellState(h, t.state), liquid = u.uStyle.value === 12 || u.uStyle.value === 13;
      let fade = clamp(h.age / .08, 0, 1);
      if (liquid) fade *= clamp((h.warn + h.duration - h.age) / .6, 0, 1);
      u.uActive.value = h.active ? 1 : 0; u.uSafeReady.value = h.warn-h.age <= 1 ? 1 : 0;
      u.uU.value = liquid ? 1 : s.u; u.uFlare.value = liquid ? 0 : s.flare; u.uHit.value = liquid ? 0 : s.hit; u.uFade.value = fade;
      u.uGain.value = (liquid ? (h.poolGain || .55) : (h.tellGain || 1)) * (cfg.tellGain || 1) * (u.uStyle.value === 5 && u.uShape.value !== 0 ? .4 : 1) * (t.burrow ? (u.uUnblock.value > .5 ? .64 : .42) : t.riteSpike ? .55 : 1);   // narrow 'shadow' lanes (shard volleys, pulses) would bloom to white: keep their light well under the bloom knee
      // Big areas (boss sweeps, rings) cover a lot of screen: their interior light is scaled down so it never reads as paint.
      const R = h.shape === 'line' ? Math.max(h.width, h.length * .35) : h.radius, big = clamp(2.8 / Math.max(.5, R), .38, 1);
      const open = h.owner && h.owner.boss && R > 8 ? .48 : 1;
      u.uK.value.set(.07 * big, .08 * big, .30 * big * open, .6 * (.5 + .5 * big) * open); u.uF.value = .35 * big; u.uHitK.value = .75 * (.35 + .65 * clamp((big - .38) / .62, 0, 1));
      // Gold edges read from the first moments of the warning; in the executioner's second phase (red court) the gold
      // edge and the pale unblockable hairline are lifted further so "gold = ordinary, crimson = severe" still holds.
      const unbT = u.uUnblock.value > .5, rs = h.owner && h.owner.boss && B.app && B.app.rig && B.app.rig.state, p2 = rs ? rs.phase2 || 0 : 0;
      u.uE.value.set(unbT ? .85 : .8, (unbT ? .9 : .9) * (1 + (unbT ? .25 : .6) * p2), 1.6, t.burrow || t.riteSpike ? .045 : .07);
      u.uCk.value = t.burrow ? .24 : t.riteSpike ? .3 : .8;
      u.uHl.value.set((unbT ? .4 : .08) * (1 + 1.6 * p2), .5 * (1 + p2), 1); u.uDetail.value = DETAIL[cfg.quality] || 3; u.uTime.value = clock; u.uCalm.value = calm ? 1 : 0;
      t.mesh.visible = fade > .001; t.fade = fade; t.last = s;
      if (h.active && !h.harmless) t.struck = true;
      if (t.ribbon) {
        const r = t.ribMat.uniforms; r.uHead.value = h.active ? 1 : 1 - (1 - s.u) * (1 - s.u); r.uFlare.value = s.flare;
        r.uFade.value = fade * (h.active ? Math.max(0, 1 - (h.age - h.warn) / .2) : 1); r.uCalm.value = calm ? 1 : 0; t.rib.visible = r.uFade.value > .002;
      }
    }
    function release(t, silent) {
      live.delete(t.h);
      if (silent) { free(t); return; }
      t.releasing = true; t.rel = 0; t.startFade = t.fade;
      // Cancelled before contact (parry, stagger, war cry, a broken rite): the tell crumbles into ash.
      if (!t.struck && t.fade > .2 && t.h) { ashPuff(t.h); if (out.sound) out.sound('tellCancel', { x: t.h.x, z: t.h.z }); }
    }
    function releaseAll() { for (const t of tells) if (t.busy) { live.delete(t.h); free(t); } live.clear(); }

    // ------------------------------------------------------------------ shape sampling (world XZ)
    const P = { x: 0, z: 0 };
    function local(h, side, fwd) { const c = Math.cos(h.face || 0), s = Math.sin(h.face || 0); P.x = h.x + c * side + s * fwd; P.z = h.z - s * side + c * fwd; return P; }
    function polar(h, a, r) { P.x = h.x + Math.sin((h.face || 0) + a) * r; P.z = h.z + Math.cos((h.face || 0) + a) * r; return P; }
    // mode: 'in' random inside, 'edge' on the outline, 'front' on the moving light front (k = front position 0..1)
    function sample(h, mode, k) {
      const R = h.radius || 1, rnd = Math.random();
      if (h.shape === 'line') {
        const W = h.width, L = h.length;
        if (mode === 'edge') { const q = Math.random(); return q < .8 ? local(h, (Math.random() < .5 ? -.5 : .5) * W, Math.random() * L) : local(h, (Math.random() - .5) * W, L); }
        if (mode === 'front') { const f = h.fill === 'converge' ? (Math.random() < .5 ? k / 2 : 1 - k / 2) : k; return local(h, (Math.random() - .5) * W, clamp(f, 0, 1) * L); }
        return local(h, (Math.random() - .5) * W, Math.random() * L);
      }
      const span = h.shape === 'circle' ? TAU : h.shape === 'ring' ? (h.arc || TAU) : h.arc, inner = h.shape === 'ring' ? h.inner || 0 : 0;
      if (mode === 'front') {
        if (h.fill === 'sweep') return polar(h, (clamp(k, 0, 1) * span - span / 2) * (h.sweepDir || 1), inner + (R - inner) * Math.sqrt(Math.random()));
        const rr = h.fill === 'inward' ? 1 - k : k; return polar(h, (rnd - .5) * span, inner + (R - inner) * clamp(rr, 0, 1));
      }
      if (mode === 'edge') { if (h.shape === 'cone' && Math.random() < .3) return polar(h, (Math.random() < .5 ? -.5 : .5) * span, R * Math.random()); return polar(h, (rnd - .5) * span, R); }
      return polar(h, (rnd - .5) * span, inner + (R - inner) * Math.sqrt(Math.random()));
    }
    function ashPuff(h) {
      const e = out.emit; if (!e) return;
      for (let i = 0; i < 10; i++) { const p = sample(h, 'edge'); e(p.x, .08, p.z, 2, [.07, .06, .055], (Math.random() - .5) * .6, .35 + Math.random() * .4, (Math.random() - .5) * .6, .7 + Math.random() * .4, .22 + Math.random() * .2); }
      for (let i = 0; i < 6; i++) { const p = sample(h, 'edge'); e(p.x, .1, p.z, 4, [.9, .35, .12], 0, .5, 0, .5, .04); }
    }

    // ------------------------------------------------------------------ per-style particles (rates per second per tell)
    function emitFor(t, h, dt, factor, calm) {
      const e = out.emit; if (!e || dt <= 0 || !t.last) return;
      const s = t.last, drift = calm ? .5 : 1, liquid = h.persistent && (h.poison || h.pool) && h.active;
      const rate = (key, n, fn) => { t.acc[key] = (t.acc[key] || 0) + n * factor * dt; while (t.acc[key] >= 1) { t.acc[key] -= 1; fn(); } };
      const eFront = 1 - (1 - s.u) * (1 - s.u), front = Math.min(1, .1 + .96 * eFront), left = h.warn - h.age;
      if (liquid) { const pl = POOLS[h.pool], bc = pl ? pl.bub : [.35, .6, .1]; rate('bub', h.shape === 'ring' ? 0 : pl && h.pool === 'lava' ? 6 : 3, () => { const p = sample(h, 'in'); e(p.x, .06, p.z, h.pool === 'lava' ? 4 : 5, bc, 0, (h.pool === 'lava' ? .5 : .12) * drift, 0, .45, h.pool === 'lava' ? .045 : .05); }); return; }
      if (h.active) return;
      switch (h.style) {
        case 'blade': case 'grab':
          rate('em', 18, () => { const p = sample(h, 'front', front); e(p.x, .06, p.z, 4, [2.2, 1.0, .35], (Math.random() - .5) * .3 * drift, (.25 + Math.random() * .35) * drift, (Math.random() - .5) * .3 * drift, .5 + Math.random() * .4, .05); }); break;
        case 'blunt': case 'thrust': case 'roar':
          rate('du', 16, () => { const p = sample(h, 'edge'), a = Math.atan2(p.x - h.x, p.z - h.z); e(p.x, .06, p.z, 2, [.10, .085, .07], Math.sin(a) * .4 * drift, .3 * drift, Math.cos(a) * .4 * drift, .7 + Math.random() * .4, .2 + Math.random() * .15); }); break;
        case 'chain':
          rate('du', 12, () => { const p = sample(h, 'front', front); e(p.x, .06, p.z, 2, [.10, .085, .07], 0, .25 * drift, 0, .7, .2); });
          rate('sp', 6, () => { const p = sample(h, 'front', front); e(p.x, .12, p.z, 1, [3.2, 2.0, .8], (Math.random() - .5) * 2, .8 + Math.random(), (Math.random() - .5) * 2, .25, .05); }); break;
        case 'rune':
          rate('mo', 20, () => { const p = h.shape === 'circle' ? polar(h, (Math.random() * clamp(s.u, 0, 1) - .5) * TAU, h.radius * .8) : sample(h, 'front', front);
            e(p.x, .08, p.z, 4, h.unblockable ? [1.8, .3, .12] : [2.0, .9, .3], 0, (.35 + Math.random() * .3) * drift, 0, .7 + Math.random() * .3, .05); }); break;
        case 'ember':
          if (left > .45) rate('fa', 24, () => { const p = sample(h, 'in'); e(p.x, 4.2 + Math.random() * 1.2, p.z, 1, [3.4, 1.4, .35], (Math.random() - .5) * .3, -5.5, (Math.random() - .5) * .3, .6, .07); }); break;
        case 'bile':
          rate('sm', 14, () => { const p = sample(h, 'in'); e(p.x, .1, p.z, 2, [.05, .09, .02], 0, .25 * drift, 0, .8, .28); });
          rate('mo', 4, () => { const p = sample(h, 'in'); e(p.x, .1, p.z, 5, [.6, .9, .2], 0, .25 * drift, 0, .6, .05); }); break;
        case 'quake':
          rate('du', 20, () => { const p = sample(h, 'in'); e(p.x, .05, p.z, 2, [.09, .075, .06], 0, .2 * drift, 0, .8, .22); });
          if (left < .4) rate('ch', 10, () => { const p = sample(h, 'in'); e(p.x, .05, p.z, 0, [.05, .04, .035], (Math.random() - .5), 1.5, (Math.random() - .5), .5, .06); }); break;
        case 'shadow':
          rate('wi', 10, () => { const p = sample(h, 'edge'); const dx = h.x - p.x, dz = h.z - p.z; e(p.x, .12, p.z, 5, [.012, .01, .014], dx * .9 * drift, .05, dz * .9 * drift, .7, .3); }); break;
        case 'fall':
          rate('fa', 16, () => { const p = sample(h, 'in'); e(p.x, 4 + Math.random(), p.z, 2, [.09, .075, .065], 0, -2.2, 0, 1.1, .16); });
          if (left < .3) rate('sp', 8, () => { const p = sample(h, 'in'); e(p.x, 2 + Math.random(), p.z, 1, [3.0, 2.0, .9], 0, -4, 0, .35, .06); }); break;
      }
      if (h.unblockable && !h.persistent) {
        // The floor drinks: crimson motes drawn inward from just outside the edge.
        rate('in', 24, () => {
          const p = sample(h, 'edge'), ox = p.x, oz = p.z;
          const cx = h.shape === 'line' ? local(h, 0, h.length / 2) : { x: h.x, z: h.z };
          const dx = (cx.x - ox), dz = (cx.z - oz), life = .6;
          e(ox + dx * -.08, .1, oz + dz * -.08, 5, [1.8, .15, .1], dx * .6 / life * drift, .08, dz * .6 / life * drift, life, .06);
        });
        const o = h.owner, bones = o && o.model && o.model.bones;
        if (bones && o.model.root.visible && !o.dead) rate('hs', 6, () => {
          const hand = Math.random() < .5 ? bones.leftHand : bones.rightHand; if (!hand) return; hand.getWorldPosition(V1);
          e(V1.x, V1.y, V1.z, 2, [.03, .01, .01], 0, .5 * drift, 0, .7, .22);
        });
      }
    }

    // ------------------------------------------------------------------ attacker rims, weapon heat, glints
    const rims = new Map(), V1 = new T.Vector3(), V2 = new T.Vector3();
    const EXCLUDE = /kara-void|kara-paint|furfringe|hair|beard|lash|brow|eye/i;
    // Rim shells of one foe: the two biggest skinned parts (and every plain weapon part) are merged into ONE shell draw each instead of two + one per weapon material.
    // The merged geometry is built once per foe type (the source geometries are shared by all instances).
    const rimGeoCache = new Map();
    function rimGeometry(list, skinned) {
      const key = (skinned ? 's' : 'w') + list.map(n => n.geometry.uuid).join();
      let g = rimGeoCache.get(key); if (g) return g;
      let total = 0, totalIndex = 0;
      const geos = list.map(n => { const q = n.geometry; if (!q.index) { const c = q.attributes.position.count, id = new Uint32Array(c); for (let i = 0; i < c; i++) id[i] = i; q.setIndex(new T.BufferAttribute(id, 1)); } total += q.attributes.position.count; totalIndex += q.index.count; return q; });
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), si = skinned ? new Uint16Array(total * 4) : null, sw = skinned ? new Float32Array(total * 4) : null, index = new Uint32Array(totalIndex);
      let v = 0, k = 0;
      for (const q of geos) {
        const P = q.attributes.position, N = q.attributes.normal, I = q.index, c = P.count, SI = skinned && q.attributes.skinIndex, SW = skinned && q.attributes.skinWeight;
        const plain = !P.isInterleavedBufferAttribute && !N.isInterleavedBufferAttribute && P.array instanceof Float32Array && N.array instanceof Float32Array && (!skinned || (!SI.isInterleavedBufferAttribute && !SW.isInterleavedBufferAttribute));
        if (plain) { pos.set(P.array, v * 3); nor.set(N.array, v * 3); if (skinned) { si.set(SI.array, v * 4); sw.set(SW.array, v * 4); } }
        else for (let i = 0; i < c; i++) {
          const o = v + i; pos[o * 3] = P.getX(i); pos[o * 3 + 1] = P.getY(i); pos[o * 3 + 2] = P.getZ(i); nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
          if (skinned) for (let j = 0; j < 4; j++) { si[o * 4 + j] = SI.getComponent(i, j); sw[o * 4 + j] = SW.getComponent(i, j); }
        }
        for (let j = 0; j < I.count; j++) index[k + j] = I.getX(j) + v;
        v += c; k += I.count;
      }
      g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
      if (skinned) { g.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4)); }
      g.setIndex(new T.BufferAttribute(total > 65535 ? index : new Uint16Array(index), 1)); g.computeBoundingSphere();
      rimGeoCache.set(key, g);
      const R = B.app && B.app.renderer; if (R && R.initGeometry) try { R.initGeometry({ geometry: g }); } catch (e) { /* the first draw uploads it instead */ }
      return g;
    }
    function rimFor(model) {
      if (rims.has(model)) return rims.get(model);
      const color = { value: new T.Vector3(1.6, .7, .25) }, glow = { value: 0 }, wglow = { value: 0 }, vein = { value: 0 }, veinTime = { value: 0 };
      const list = [];
      model.root.traverse(n => { if (n.isSkinnedMesh && n.geometry && n.geometry.attributes.normal && !(n.material && (n.material.transparent || EXCLUDE.test(n.material.name || '') || EXCLUDE.test(n.name || '')))) list.push(n); });
      list.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count);
      const shells = [];
      const top = list.slice(0, 2), mergeBody = top.length === 2 && top[0].parent === top[1].parent && top[0].skeleton === top[1].skeleton && top[0].bindMatrix.equals(top[1].bindMatrix) && top[0].matrix.equals(top[1].matrix);
      for (const src of (mergeBody ? [top[0]] : top)) {
        src.getWorldScale(V1);
        const mat = new T.ShaderMaterial({ vertexShader: RIM_VS, fragmentShader: RIM_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
          uniforms: { uColor: color, uGlow: glow, uVein: vein, uVTime: veinTime, uP: { value: new T.Vector2(4, 0) }, uInflate: { value: .012 / Math.max(.001, V1.x) } } });
        const s = new T.SkinnedMesh(mergeBody ? rimGeometry(top, true) : src.geometry, mat); s.bind(src.skeleton, src.bindMatrix); s.bindMode = src.bindMode;
        s.position.copy(src.position); s.quaternion.copy(src.quaternion); s.scale.copy(src.scale);
        // The shell has the source mesh's pose and parent space. Reuse its ready sorting bounds.
        s.boundingSphere = src.boundingSphere ? src.boundingSphere.clone() : null;
        s.frustumCulled = false; s.renderOrder = 3; s.castShadow = s.receiveShadow = false; s.visible = false; s.name = 'rim_shell'; s.userData.noGhost = true;
        src.parent.add(s); shells.push(s);
      }
      const parts = [], weapon = model.bones && model.bones.weapon;
      if (weapon) weapon.traverse(n => { if (n.isMesh && !n.isSkinnedMesh && !n.isInstancedMesh && n.geometry && n.geometry.attributes.normal && n.name !== 'rim_weapon') parts.push(n); });
      const wmat = new T.ShaderMaterial({ vertexShader: RIM_VS, fragmentShader: RIM_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
        uniforms: { uColor: color, uGlow: wglow, uVein: vein, uVTime: veinTime, uP: { value: new T.Vector2(1.5, 0) }, uInflate: { value: .012 } } });
      const mergeWeapon = parts.length > 1 && parts.every(n => n.parent === parts[0].parent && !n.userData.equipmentSlot && n.matrix.equals(parts[0].matrix));
      const wshells = (mergeWeapon ? [parts[0]] : parts).map(n => { const w = new T.Mesh(mergeWeapon ? rimGeometry(parts, false) : n.geometry, wmat); w.name = 'rim_weapon'; w.renderOrder = 3; w.frustumCulled = false; w.visible = false; w.castShadow = w.receiveShadow = false; w.userData.noGhost = true; n.add(w); return w; });
      const r = { model, shells, wshells, color, glow, wglow, vein, veinTime, value: 0, target: [1.6, .7, .25], cur: [1.6, .7, .25], armed: parts.length > 0, wmat };
      rims.set(model, r); return r;
    }
    function setRim(r, g, col, dt, weaponK) {
      const k = dt > 0 ? 1 - Math.exp(-dt * 14) : 1;
      r.value += (g - r.value) * k;
      for (let i = 0; i < 3; i++) r.cur[i] += (col[i] - r.cur[i]) * k;
      r.color.value.set(r.cur[0], r.cur[1], r.cur[2]); r.glow.value = r.value * .58; r.wglow.value = r.value * (weaponK || 3);
      const on = r.value > .005 && r.model.root.visible;
      for (const s of r.shells) s.visible = on; for (const w of r.wshells) w.visible = on;
    }
    // Glints: a small star at the weapon tip in the flare window; the unarmed get a faint glow in each hand while a tell is pending.
    const glints = [];
    function glint() {
      let g = glints.find(o => !o.used);
      if (!g) { const m = new T.SpriteMaterial({ map: textures.star, color: 0xffffff, blending: T.AdditiveBlending, depthTest: true, depthWrite: false, transparent: true, fog: false });
        const s = new T.Sprite(m); s.renderOrder = 12; s.visible = false; group.add(s); g = { s, m, used: false }; glints.push(g); }
      g.used = true; return g;
    }
    function showGlint(pos, scale, col) { const g = glint(); g.s.position.copy(pos); g.s.scale.set(scale, scale, 1); g.m.color.setRGB(col[0], col[1], col[2]); g.s.visible = true; }
    const enemyState = { g: 0, flare: 0, unb: false, pending: false, maxU: 0 }, silentState = { g: 0 };
    function enemyTell(e) {
      // Strongest tell of this enemy: intent (acting, nothing on the floor yet), pending (u), flare window.
      let g = 0, flare = 0, unb = false, next = Infinity, pending = false, maxU = 0;
      const game = getGame();
      for (const h of game.hazards) {
        if (h.owner !== e || h.harmless || h.persistent && !h.burst) continue;
        if (h.burst) { if (!h.active) { g = Math.max(g, .6 * smooth(h.age / h.warn)); unb = true; pending = true; } continue; }
        if (h.age < 0 || h.active) continue;
        const s = tellState(h); pending = true; maxU = Math.max(maxU, s.u);
        flare = Math.max(flare, s.flare); g = Math.max(g, s.flare > .01 ? .03 + .1 * s.u * s.u + .27 * s.flare : .03 + .1 * s.u * s.u);
        if (h.warn - h.age < next) { next = h.warn - h.age; unb = !!h.unblockable; }
      }
      if (!pending && e.action && !e.dead) { g = .05; unb = !!e.action.unblockable; }
      enemyState.g = g; enemyState.flare = flare; enemyState.unb = unb; enemyState.pending = pending; enemyState.maxU = maxU; return enemyState;
    }
    function ownsBurst(list, e) { for (let i = 0; i < list.length; i++) if (list[i].owner === e && list[i].burst) return true; return false; }
    const typeTell = {};   // strongest pending tell per enemy type this frame (drives the hot-iron / grave-crystal glow)
    function rimsStep(game, dt, calm) {
      for (const g of glints) { g.used = false; g.s.visible = false; }
      for (const k in typeTell) typeTell[k] = 0;
      for (const e of game.enemies) {
        const model = e.model; if (!model || !model.root) continue;
        const visible = model.root.visible && (!e.dead || ownsBurst(game.hazards, e));
        if (!visible && !rims.has(model)) continue;
        const r = rimFor(model), st = visible ? enemyTell(e) : silentState;
        let g = st.g, col = st.unb ? CRIMSON_RIM : AMBER_RIM;
        if (visible && !e.dead) {
          // The glow follows the attacker's tell, and a boss burns hotter with every phase (armour breaking open, the fire rising).
          const lit = e.boss && !st.pending ? (e.phase >= 3 ? .26 : e.phase === 2 ? .13 : 0) : st.g;
          if (lit > (typeTell[e.type] || 0)) typeTell[e.type] = lit;
        }
        // Elites carry a faint steady rim (amber, crimson once enraged) so they read apart from the rank and file.
        if (visible && !e.dead && e.elite && !e.boss && e.stats && (e.stats.ruins || e.stats.forge) && !st.pending && g < .045) { g = .045; col = AMBER_RIM; }
        if (e.dead && st.pending) col = BILE_RIM;
        if (!st.pending && !e.dead && visible) {
          if (e.buff > 0 && g < .08) { g = .08; col = CRIMSON_RIM; }                 // Kan Ayini made visible
          if (e.boss) { const base = e.enraged ? .12 : e.phase === 2 ? .08 : .06; if (g < base) { g = base; col = e.enraged ? CRIMSON_RIM : AMBER_RIM; } }
        } else if (e.boss && !st.pending && visible && g < .06) g = .06;
        if (e.fear > 0 && !e.dead && visible && g < .02) g = 0;
        setRim(r, visible ? g : 0, col, dt, e.boss && !st.pending ? 3 : 3);
        if (!visible || e.dead) continue;
        // Weapon tip glint at the commit flare; unarmed hands glow faintly for the whole pending window.
        if (st.flare > .01) {
          const tip = model.weaponTip; if (r.armed && tip) tip.getWorldPosition(V1); else if (model.bones && model.bones.rightHand) model.bones.rightHand.getWorldPosition(V1); else continue;
          const sc = (calm ? .25 : .26 + .18 * Math.sin(st.flare * Math.PI)) * (e.boss ? 1.35 : 1);
          showGlint(V1, sc, st.unb ? [1.6, .6, .5] : [1.9, 1.4, .8]);
        }
        if (!r.armed && st.pending && model.bones && /cultist|seer|lantern/.test(e.type)) for (let handSide = 0; handSide < 2; handSide++) {
          const hand = handSide ? model.bones.rightHand : model.bones.leftHand;
          if (!hand) continue; hand.getWorldPosition(V2); showGlint(V2, .11 + .07 * st.maxU, st.unb ? [1.2, .15, .08] : [1.3, .6, .2]);
        }
      }
    }

    // ------------------------------------------------------------------ projectiles (visual only; land exactly on the strike)
    const shots = [], shotGeometries = [], shotMaterials = [];
    const shotMetal = B.EquipmentArt ? B.EquipmentArt.material('dark').clone() : new T.MeshStandardMaterial({color:0x5d554b,roughness:.5,metalness:.82});
    const shotBone = new T.MeshStandardMaterial({color:0xb7ad91,roughness:.79,metalness:.025});
    const shotGlass = new T.MeshStandardMaterial({color:0x304522,roughness:.22,metalness:.1,transparent:true,opacity:.74});
    const shotBile = new T.MeshStandardMaterial({color:0x35501b,roughness:.36,metalness:0,emissive:0x0c1403});
    shotMaterials.push(shotMetal,shotBone,shotGlass,shotBile);
    const vialBody = B.Gear.lathe([[0,-.18],[.085,-.18],[.118,-.13],[.12,.05],[.075,.13],[.052,.18],[.052,.26]],24);
    const vialLiquid = B.Gear.lathe([[0,-.16],[.08,-.16],[.103,-.12],[.103,.07],[0,.07]],24);
    const vialCollar = B.Gear.merge([B.Gear.lathe([[.055,.14],[.066,.15],[.066,.18],[.055,.19]],24),B.Gear.lathe([[0,.24],[.059,.24],[.062,.28],[.054,.3],[0,.3]],24)]);
    const spurParts=[B.Gear.lathe([[0,-.42],[.043,-.39],[.08,-.22],[.062,.15],[.04,.31],[0,.51]],8).rotateX(Math.PI/2)];
    for(let i=0;i<3;i++){const g=new T.ConeGeometry(.046,.19,5);g.rotateX(-Math.PI/2+.55);g.rotateZ(i*TAU/3);g.translate(Math.cos(i*TAU/3)*.055,Math.sin(i*TAU/3)*.055,-.13);spurParts.push(g);}
    const spurGeo=B.Gear.merge(spurParts);
    const hookArc=new T.TorusGeometry(.19,.047,8,24,Math.PI*1.45);hookArc.rotateY(Math.PI/2);hookArc.translate(0,0,.075);
    const hookPoint=new T.ConeGeometry(.047,.22,8);hookPoint.rotateX(Math.PI/2-.25);hookPoint.translate(0,-.18,.06);
    const hookStem=new T.CylinderGeometry(.048,.034,.43,8);hookStem.rotateX(Math.PI/2);hookStem.translate(0,.19,-.26);
    const hookEye=new T.TorusGeometry(.076,.023,6,16);hookEye.rotateY(Math.PI/2);hookEye.translate(0,.19,-.51);
    const hookGeo=B.Gear.merge([hookArc,hookPoint,hookStem,hookEye]);
    shotGeometries.push(vialBody,vialLiquid,vialCollar,spurGeo,hookGeo);
    function shotRecord(){
      const body=new T.Group(), vial=new T.Group(), spur=new T.Mesh(spurGeo,shotBone),hook=new T.Mesh(hookGeo,shotMetal);
      vial.add(new T.Mesh(vialBody,shotGlass),new T.Mesh(vialLiquid,shotBile),new T.Mesh(vialCollar,shotMetal));
      body.add(vial,spur,hook);body.visible=false;body.name='thrown_projectile';group.add(body);
      const s={body,vial,spur,hook,used:false};shots.push(s);return s;
    }
    // Reserve the five-spur fans and overlapping throws before graphics warmup.
    for(let i=0;i<12;i++)shotRecord();
    const shotDirection=new T.Vector3(),shotUp=new T.Vector3(0,0,1);
    function projectiles(game, factor) {
      for (const s of shots) { s.used = false; s.body.visible = false; }
      for (const h of game.hazards) {
        const pr = h.projectile; if (!pr || h.active || h.age < 0 || !h.owner) continue;
        const k = (h.age - (h.warn - pr.flight)) / pr.flight; if (k < 0 || k > 1) continue;
        if (!h.fromPos) { const o = h.owner, hand = o.model && o.model.bones && o.model.bones.rightHand; if (hand) { hand.getWorldPosition(V1); h.fromPos = { x: V1.x, y: V1.y, z: V1.z }; } else h.fromPos = { x: o.x, y: pr.fromY || 1.4, z: o.z }; }
        const f = h.fromPos, to = h.shape === 'line' ? local(h, 0, h.length) : { x: h.x, z: h.z };
        const x = f.x + (to.x - f.x) * k, z = f.z + (to.z - f.z) * k, y = f.y + (.15 - f.y) * k + (pr.height || 0) * 4 * k * (1 - k);
        let s=shots.find(o=>!o.used);if(!s)s=shotRecord();s.used=true;s.body.visible=true;s.body.position.set(x,y,z);
        s.vial.visible=pr.kind==='vial';s.spur.visible=pr.kind==='spur';s.hook.visible=!s.vial.visible&&!s.spur.visible;
        shotDirection.set(to.x-f.x,.15-f.y+(pr.height||0)*4*(1-2*k),to.z-f.z).normalize();
        s.body.quaternion.setFromUnitVectors(shotUp,shotDirection);
        // The bottle tumbles; the barbed spur and grappling hook keep their nose
        // on the real velocity. Decoration never shifts the authoritative landing.
        s.vial.rotation.set(k*Math.PI*3.5,k*1.7,k*.8);s.spur.rotation.z=k*TAU*1.5;s.hook.rotation.z=k*TAU*.4;
        if(out.emit&&pr.kind==='vial'&&Math.random()<factor*.32)out.emit(x,y,z,5,[.17,.28,.05],0,.05,0,.18,.025);
      }
    }

    // ------------------------------------------------------------------ bursts on the floor (shockwaves, soft light)
    const waves = [], glows = [];
    function wave(x, z, o) {
      let w = waves.find(v => !v.used);
      if (!w) { const mat = waveBase.clone(); mat.uniforms.uCrack.value = textures.crack; const m = new T.Mesh(plane, mat); m.renderOrder = 2; m.frustumCulled = false; m.visible = false; group.add(m); w = { m, mat, used: false }; waves.push(w); }
      w.used = true; w.age = 0; w.o = Object.assign({ radius: 5, life: .6, width: .35, color: [1.6, .45, .12], crack: 0, crackR: 2.2, crackLife: 1.4, soft: 1, delay: 0 }, o);
      const R = Math.max(w.o.radius + Math.max(1.5,w.o.width*1.4*3.3),w.o.crack ? w.o.crackR+.2 : 0); w.m.scale.set(2 * R, 1, 2 * R); w.m.position.set(x, groundY(x,z,w.o.radius), z); w.mat.uniforms.uMax.value = R; w.mat.uniforms.uSeed.value = Math.random() * 10;
      w.mat.uniforms.uCol.value.set(w.o.color[0], w.o.color[1], w.o.color[2]); w.mat.uniforms.uCrackR.value = w.o.crackR; w.mat.uniforms.uSoft.value = w.o.soft; w.m.visible = false;
      return w;
    }
    function glowBurst(x, z, o) {
      let g = glows.find(v => !v.used);
      if (!g) { const mat = glowBase.clone(); const m = new T.Mesh(plane, mat); m.renderOrder = 1; m.frustumCulled = false; m.visible = false; group.add(m); g = { m, mat, used: false }; glows.push(g); }
      g.used = true; g.age = 0; g.o = Object.assign({ radius: 2, life: .6, color: [1.4, .9, .5], peak: .6, y: .05 }, o);
      const R = g.o.radius * 1.25; g.m.scale.set(2 * R, 1, 2 * R); g.m.position.set(x, Math.max(g.o.y,groundY(x,z,g.o.radius)), z); g.mat.uniforms.uCol.value.set(g.o.color[0], g.o.color[1], g.o.color[2]); g.m.visible = true; g.mat.uniforms.uA.value = 0;
      return g;
    }
    // A roar uses three fronts at once. Reserve their materials before loading finishes so the first ability
    // and the executioner's phase change only fill existing slots, including a small overlap with live tells.
    for (let i = 0; i < 6; i++) { const w = wave(0, 0, {}); w.m.visible = false; }
    for (const w of waves) w.used = false;
    for (let i = 0; i < 4; i++) { const g = glowBurst(0, 0, {}); g.m.visible = false; }
    for (const g of glows) g.used = false;
    function burstsStep(dt) {
      for (const w of waves) {
        if (!w.used) continue; w.age += dt; const t = w.age - w.o.delay; if (t < 0) { w.m.visible = false; continue; }
        const k = t / w.o.life, u = w.mat.uniforms, done = k >= 1 && t >= w.o.crackLife;
        const e = 1 - Math.pow(1 - Math.min(1, k), 2.4);
        u.uR.value = .3 + (w.o.radius - .3) * e; u.uW.value = w.o.width * (.6 + .8 * e); u.uA.value = k < 1 ? (1 - k * k) * Math.min(1, t / .04) : 0;
        u.uCrackA.value = w.o.crack * Math.max(0, 1 - t / w.o.crackLife) * Math.min(1, t / .05);
        w.m.visible = !done; if (done) w.used = false;
      }
      for (const g of glows) {
        if (!g.used) continue; g.age += dt; const k = g.age / g.o.life;
        g.mat.uniforms.uA.value = g.o.peak * Math.min(1, g.age / .06) * Math.max(0, 1 - k) * Math.max(0, 1 - k);
        if (k >= 1) { g.used = false; g.m.visible = false; }
      }
    }

    // ------------------------------------------------------------------ the father's fury (aura while rage lasts)
    const eyes = [0, 1].map(() => { const m = new T.SpriteMaterial({ map: textures.dot, color: 0xffffff, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      const s = new T.Sprite(m); s.renderOrder = 12; s.visible = false; group.add(s); return { s, m }; });
    let rageWas = 0, fadeOut = 0;
    const HEAD_OFF = new T.Vector3();
    function heroStep(game, dt, factor, calm) {
      const p = game.player, model = p && p.model; if (!model) return;
      const r = rimFor(model), roar = p.roar, raging = p.rageTime > 0 && !p.dead;
      let g = 0, col = RAGE_RIM;
      if (roar && !roar.released) g = .025 + .09 * smooth(roar.age / (roar.gather || .3));            // gathering
      if (raging) {
        const pulse = calm ? 0 : .008 * Math.sin(clock * 3.4), ending = p.rageTime < 1.6;
        g = Math.max(g, .07 + pulse + .20 * (p.rageFlash || 0));
        if (ending && !calm) g *= (.75+.25*Math.sin(clock*5.7))*p.rageTime/1.6;                 // gutters before it goes out
        fadeOut = 1;
      } else if (fadeOut > 0) {
        // The fury cools: a slow dull-red afterglow that darkens (the embers are already gone) instead of snapping off.
        fadeOut = Math.max(0, fadeOut - dt * 1.3); g = Math.max(g, .055 * fadeOut * fadeOut); col = COOL_RIM;
      }
      const veinTo = p.dead ? 0 : raging ? (.22*(p.rageTime < 1.6 ? p.rageTime/1.6 : 1)) : roar && !roar.released ? .12 * smooth(roar.age / (roar.gather || .3)) : .22*fadeOut*fadeOut;
      r.vein.value += (veinTo - r.vein.value) * (dt > 0 ? 1 - Math.exp(-dt * (veinTo > r.vein.value ? 10 : 3)) : 1); r.veinTime.value = clock;
      setRim(r, p.dead ? 0 : g, col, dt, 1.25);
      // Burning eyes.
      const head = model.bones && model.bones.head, show = (raging || (roar && roar.age > (roar.gather || .3) * .4)) && head && model.root.visible && !p.dead;
      if (show) {
        head.getWorldPosition(V1); const f = p.face, c = Math.cos(f), s = Math.sin(f), k = model.height ? model.height / 2.35 : 1;
        for (let i = 0; i < 2; i++) { const side = (i ? 1 : -1) * .045 * k; eyes[i].s.position.set(V1.x + s * .11 * k + c * side, V1.y + .03 * k, V1.z + c * .11 * k - s * side);
          const sc = (.075 + .045 * (p.rageFlash || 0) + (calm ? 0 : .006 * Math.sin(clock * 4 + i))) * k; eyes[i].s.scale.set(sc, sc, 1); eyes[i].m.color.setRGB(1.6, .25, .075); eyes[i].s.visible = true; }
      } else for (const e of eyes) e.s.visible = false;
      // Embers streaming off the father and the red-hot cleaver.
      if (raging && out.emit && dt > 0) {
        const n = 14 * factor * dt * (1 + 1.2 * (p.rageFlash || 0)); r.acc = (r.acc || 0) + n;
        // Embers lift off the whole body and drift up in a tall column; some are dark ash, a few white-hot.
        while (r.acc >= 1) { r.acc -= 1; const a = Math.random() * TAU, rr = .2 + Math.random() * .38, y = .15 + Math.random() * 1.9, q = Math.random();
          out.emit(p.x + Math.sin(a) * rr, y, p.z + Math.cos(a) * rr, q < .1 ? 2 : 4, q < .6 ? [.95,.32,.10] : q < .9 ? [.8,.12,.035] : q < .96 ? [1.3,.85,.35] : [.07, .05, .045], (Math.random() - .5) * .5, (.8 + Math.random() * 1.2) * (calm ? .5 : 1), (Math.random() - .5) * .5, .7 + Math.random() * .8, q < .9 ? .05 : .035); }
        const tip = model.weaponTip; if (tip && Math.random() < 8 * factor * dt) { tip.getWorldPosition(V1); out.emit(V1.x, V1.y, V1.z, 4, [1.0,.36,.1], (Math.random() - .5) * .6, .8, (Math.random() - .5) * .6, .55, .045); }
        // Heat-scorched ground: a small pool of light under his feet, refreshed while the fury burns.
        if ((r.pool = (r.pool || 0) - dt) <= 0 && !calm) { r.pool = .5; glowBurst(p.x, p.z, { radius:.8,life:.6,color:[.7,.13,.045],peak:.07 }); }
      }
      rageWas = raging ? 1 : 0;
    }

    // ------------------------------------------------------------------ chapter glow: hot iron breathes, grave crystal pulses, both flare with the attacker's tell
    let glowList = null;
    function glowPulse(dt, calm) {
      if (!glowList) glowList = [].concat((B.RuinsModels && B.RuinsModels.glow) || [], (B.ForgeModels && B.ForgeModels.glow) || []);
      for (let i = 0; i < glowList.length; i++) {
        const o = glowList[i], boost = Math.min(1, (typeTell[o.type] || 0) * 3.2), breath = calm ? 1 : .88 + .12 * Math.sin(clock * (o.type === 'hollowking' || o.type === 'furnaceheart' ? 1.6 : 2.3) + i * 1.7);
        o.mat.emissiveIntensity = o.base * breath * (1 + 1.1 * boost);
      }
    }

    // ------------------------------------------------------------------ living air around the chapter III / IV creatures (pooled particles only)
    // [kind, colour, per second, rise, life, size]: embers lift off forge units, violet motes off the grave casters, ash flakes off the rest.
    const AMB = {
      emberbound: [4, [2.2, .8, .25], 1.6, .5, 1.1, .04], chainseer: [4, [2.2, .8, .25], 1.4, .5, 1.1, .04], slagcrawler: [4, [2.4, .7, .2], 3.2, .6, .9, .04],
      forgesentinel: [4, [2.2, .75, .22], 4, .6, 1.2, .045], ashwarden: [4, [2.2, .75, .22], 4, .6, 1.2, .045], furnaceheart: [4, [2.4, .8, .25], 12, .8, 1.4, .05],
      shardseer: [4, [.9, .65, 2.2], 3, .35, 1.5, .04], hollowking: [4, [.9, .65, 2.2], 7, .4, 1.6, .05],
      ashbound: [2, [.07, .06, .055], .8, .2, 1.6, .12], gravemason: [2, [.07, .06, .055], 1.2, .2, 1.6, .14], ruinwarden: [2, [.08, .065, .06], 2, .25, 1.7, .14], cavefang: [2, [.07, .06, .055], .8, .2, 1.4, .1]
    };
    function ambient(game, dt, factor, calm) {
      if (!out.emit || !(dt > 0)) return;
      const p = game.player;
      for (const e of game.enemies) {
        const a = AMB[e.type]; if (!a || e.dead || !e.model || !e.model.root.visible || !e.stats || !(e.stats.ruins || e.stats.forge)) continue;
        if (Math.abs(e.x - p.x) > 18 || Math.abs(e.z - p.z) > 18) continue;
        e._amb = (e._amb || 0) + a[2] * factor * dt * (calm ? .4 : 1) * (e.active ? 1.6 : 1);
        while (e._amb >= 1) {
          e._amb -= 1; const h = e.model.height || 2.3, ang = Math.random() * TAU, rr = .15 + Math.random() * .35;
          out.emit(e.x + Math.sin(ang) * rr, h * (.25 + .65 * Math.random()), e.z + Math.cos(ang) * rr, a[0], a[1], (Math.random() - .5) * .3, a[3] * (.6 + .8 * Math.random()), (Math.random() - .5) * .3, a[4] * (.7 + .6 * Math.random()), a[5]);
        }
      }
    }

    // ------------------------------------------------------------------ wake-up of chapter III / IV bosses and elites: cracking floor + pooled wave (visual only, no combat timing)
    function introWatch(game) {
      const fxApi = B.Effects && B.Effects.current;
      for (const e of game.enemies) {
        if (!(e.boss || e.elite) || !e.stats || !(e.stats.ruins || e.stats.forge)) continue;
        if (e.active && !e.dead) {
          if (!e._introFx) { e._introFx = 1; if (fxApi && fxApi.burst && e.model && e.model.root && e.model.root.visible) try { fxApi.burst(e.boss ? 'bossPhase' : 'impact', { x: e.x, y: 1.4, z: e.z, radius: e.boss ? 5 : 3.2, intro: 1 }); } catch (err) { /* decoration only */ } }
        } else if (!e.active) e._introFx = 0;
      }
    }

    // ------------------------------------------------------------------ warm-up: compile every new program before the first fight
    function warmUp(game) {
      const app = B.app; if (!app || !app.renderer || !app.scene || !app.camera) return false;
      const kinds = new Set(), t = tells[0], models = [game.player.model].concat(game.enemies.filter(e => e.model && !kinds.has(e.model.type) && kinds.add(e.model.type)).map(e => e.model));   // one foe of every type: the merged rim shells are built (and uploaded) before the first fight
      const hidden = [];
      t.mat.uniforms.uGain.value = 0; t.mesh.visible = true; t.ribMat.uniforms.uFade.value = 0; t.rib.visible = true; hidden.push(t.mesh, t.rib);
      for (const m of models) { const r = rimFor(m); r.glow.value = 0; r.wglow.value = 0; for (const s of r.shells.concat(r.wshells)) { s.visible = true; hidden.push(s); } }
      const w = wave(0, 0, {}); w.m.visible = true; w.mat.uniforms.uA.value = 0; hidden.push(w.m);
      const gl = glowBurst(0, 0, {}); hidden.push(gl.m);
      const gs = glint(); gs.s.visible = true; gs.m.opacity = 0; hidden.push(gs.s);
      // app.js compiles the whole scene in small batches during loading; older shells compile here at once.
      if (!app.warmShaders) try { app.renderer.compile(app.scene, app.camera); } catch (e) { /* compile is only an optimisation */ }
      for (const o of hidden) o.visible = false; w.used = false; gl.used = false; gs.used = false; gs.m.opacity = 1;
      return true;
    }

    // ------------------------------------------------------------------ frame
    function sync(dt) {
      const game = getGame(); if (!game) return;
      const cfg = getSettings() || {}, calm = !!reduced.matches, factor = (PFACTOR[cfg.quality] || PFACTOR.high), frozen = game.hitStop > 0;
      frameDt = frozen ? 0 : dt * (game.timeScale == null ? 1 : game.timeScale);
      if (!warmed) warmed = warmUp(game) || warmed;
      if (game.resetSerial !== lastReset) { releaseAll(); lastReset = game.resetSerial; }
      clock += frameDt;
      seen.clear();
      for (const h of game.hazards) {
        if (h.age < 0 || h.harmless) continue;
        // Plain blows (claw, bash, cleave, swing...) that start at the attacker get no ground mark at all: the wind-up animation
        // and the attacker's own ember glow / weapon glint (rimsStep, commitSparks) are the tell. Must-dodge, ranged and
        // special moves (hazard not plain, unblockable, projectile, or centred away from its owner) keep the full mark.
        if (h.plain && !h.unblockable && !h.projectile && !h.persistent && h.owner && Math.hypot(h.x - h.owner.x, h.z - h.owner.z) < 1.2) {
          if (!h.tellFlared && !h.active && h.age >= h.warn - LEAD) { h.tellFlared = true; commitSparks(h, factor); }
          continue;
        }
        let t = live.get(h); if (!t) { t = acquire(h); place(t, h); }
        seen.add(t); update(t, h, cfg, calm); emitFor(t, h, frameDt, factor, calm);
        if (!t.flared && !h.active && h.age >= h.warn - LEAD && !h.persistent) { t.flared = true; commitSparks(h, factor); }
      }
      for (const t of tells) {
        if (!t.busy) continue;
        if (!t.releasing && !seen.has(t)) release(t, false);
        if (t.releasing) {
          t.rel += frameDt; const k = clamp(1 - t.rel / .18, 0, 1), u = t.mat.uniforms;
          u.uFade.value = t.startFade * k; if (t.struck && t.last) u.uHit.value = Math.max(0, (1 - (t.rel + .17) / .25));
          if (t.ribbon) t.ribMat.uniforms.uFade.value *= k;
          if (k <= 0) free(t);
        }
      }
      rimsStep(game, frameDt, calm); glowPulse(frameDt, calm); introWatch(game); ambient(game, frameDt, factor, calm); heroStep(game, frameDt, factor, calm); projectiles(game, factor); burstsStep(frameDt);
    }
    function commitSparks(h, factor) {
      const o = h.owner, e = out.emit; if (!o || !e || !o.model || o.dead) return;
      const model = o.model, tip = model.weaponTip && model.bones && model.bones.weapon ? model.weaponTip : model.bones && model.bones.rightHand; if (!tip) return;
      tip.getWorldPosition(V1); const n = Math.round((6 + 8 * factor) * (o.boss ? 1.4 : 1));
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU; e(V1.x, V1.y, V1.z, 1, h.unblockable ? [2.6, .5, .3] : [3.4, 2.2, .9], Math.sin(a) * 1.4, .6 + Math.random() * 1.4, Math.cos(a) * 1.4, .22 + Math.random() * .15, .05); }
    }
    function clear() {
      releaseAll();
      for (const w of waves) { w.used = false; w.m.visible = false; } for (const g of glows) { g.used = false; g.m.visible = false; }
      for (const r of rims.values()) { r.value = 0; setRim(r, 0, r.cur, 0); } for (const e of eyes) e.s.visible = false;
      for (const s of shots) { s.used=false; s.body.visible=false; }
    }
    function dispose() {
      clear();
      for (const r of rims.values()) { for (const s of r.shells) { s.removeFromParent(); s.material.dispose(); } for (const w of r.wshells) w.removeFromParent(); r.wmat.dispose(); }
      rims.clear();
      for (const t of tells) { t.mat.dispose(); t.ribMat.dispose(); } for (const w of waves) w.mat.dispose(); for (const g of glows) g.mat.dispose();
      for (const g of glints) g.m.dispose(); for (const m of shotMaterials) m.dispose(); for (const g of shotGeometries) g.dispose(); for (const e of eyes) e.m.dispose();
      poolBase.dispose(); ribBase.dispose(); waveBase.dispose(); glowBase.dispose(); plane.dispose(); ribGeo.dispose();
      Object.values(textures).forEach(t => t.dispose()); group.removeFromParent();
    }
    return { sync, clear, dispose, textures, wave, glowBurst, sample: (h, mode, k) => { const p = sample(h, mode, k); return { x: p.x, z: p.z }; },
      debug() { return { tells: tells.length, busy: tells.filter(t => t.busy).length, rims: rims.size, waves: waves.filter(w => w.used).length, glows: glows.filter(g => g.used).length }; } };
  } };
})();
