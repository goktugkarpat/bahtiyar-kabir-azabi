/* KARA GEÇİT — character assembly. Artist bodies (thecubber, Quaternius) + fitted original gear.
 * Sources and licences: ASSET-LICENSES.md.
 *
 * Public API (DESIGN.md): BABA.Models.prepare() -> Promise, BABA.Models.create(type) ->
 *   { root, height, radius, weaponTip, bones, animate(dt, state), dispose() }
 * Rig contract for animation work (authored-motion.js):
 *   hero, carrier, boss : thecubber rig   — pelvis, spine01..03, neck, head, shoulderL/R, upper_armL/R, forearmL/R, handL/R,
 *                                           thighL/R, shinL/R, tarsalL/R, toeL/R, finger_*.0n.L/R (dots removed by the loader)
 *   prisoner, guard, cultist, stalker : Quaternius UE-style rig — root, pelvis, spine_01..03, neck_01, Head, clavicle_l/r,
 *                                           upperarm_l/r, lowerarm_l/r, hand_l/r, thigh_l/r, calf_l/r, foot_l/r, ball_l/r, index_01_l…
 *   Every character is ONE skeleton; all body, outfit and armour pieces are skinned to it (few draw calls).
 *   bones.weapon is a Group on the right hand; authored-motion sets its position/rotation each frame.
 *   Hand-held weapons point along the weapon's local +Y, grip at the origin; weaponTip marks the striking end.
 *   Stalker/prisoner/guard/cultist proportions are edited in the bind pose (longer limbs, thinner bodies) before
 *   inverse bind matrices are recomputed, so retargeted clips see the real proportions.
 *   bones (returned) = authored-motion aliases: hips, spine, head, left/rightArm, left/rightElbow, left/rightHand,
 *   left/rightLeg, left/rightKnee, left/rightFoot, weapon. The HUD portrait frames bones.head.
 * Per type (skinned mesh names = material keys; weapons are plain meshes under bones.weapon):
 *   hero     barbarian body, fur mantle + collar + fringe/tufts, brooches, hip pouch, bone charm, war sash, brows, moustache, full
 *            salt-and-pepper beard (strand fringe + rounded hair mass), bald head with grey side hair, brown eyes,
 *            healed scars | weapon: cleaver greatsword with engraved runes, tip ~1.40 along +Y
 *   prisoner starved body, burlap sack hood, iron collar + back chain, wrist shackles | live 13-link chain between the wrists
 *   guard    gambeson, cuirass, lamellar pauldrons, spiked great helm, tower shield skinned to lowerarm_l | weapon: falchion
 *   cultist  floor-length robe (pelvis/thigh/calf weights), stole, rope belt, horned bone mask | weapon: brazier staff
 *   stalker  long-limbed ash body, blindfold, spine spurs, forearm spikes, bone claws skinned to hand_l/hand_r | no weapon
 *   carrier  inflated executioner body, bandaged head and belly, boils, back cage + lantern, glowing vials | no weapon
 *   boss     executioner, face grille, solid spiked pauldrons, fitted vambraces, chest chains, belt hooks, apron | weapon: great
 *            axe; verlet drag chain + hook from handL (resets on state.reset)
 * Pass 2 (detail): all pass-1 mesh keys, bones and the create()/Gear API are unchanged; some types gained extra skinned
 *   meshes (hero dark/strap/bone/tabard, cultist paint, carrier rope/wood, guard bone). Every geometry carries a baked
 *   vec4 kwear (edge wear, cavity/contact occlusion, blood paint, gloss or cloth tear) read by the shared grade shader. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, G = B.Gear;
  var PI = Math.PI, TAU = PI * 2;
  var bases = {}, blueprints = {}, prepared = null, surfaces = {}, library = {}, surfaceTextures = [];
  var TYPES = {
    hero: { base: 'barbarian', height: 2.38, radius: .46 },
    prisoner: { base: 'ubc', height: 2.19, radius: .40 },
    guard: { base: 'ubc', height: 2.37, radius: .49 },
    cultist: { base: 'ubc', height: 2.67, radius: .40 },
    stalker: { base: 'ubc', height: 2.14, radius: .48 },
    carrier: { base: 'executioner', height: 2.27, radius: .60 },
    boss: { base: 'executioner', height: 3.79, radius: .85 }
  };
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function decode(s) { var raw = atob(s), data = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i); return data.buffer; }
  function cloneSkin(source) {
    var copy = source.clone(true), lookup = new Map(), skeletons = new Map();
    function pair(a, b) { lookup.set(a, b); for (var i = 0; i < a.children.length; i++) pair(a.children[i], b.children[i]); } pair(source, copy);
    source.traverse(function (node) {
      if (!node.isSkinnedMesh) return; var clone = lookup.get(node);
      if (!skeletons.has(node.skeleton)) { var skeleton = node.skeleton.clone(); skeleton.bones = node.skeleton.bones.map(function (bone) { return lookup.get(bone); }); skeletons.set(node.skeleton, skeleton); }
      clone.skeleton = skeletons.get(node.skeleton); clone.bindMatrix.copy(node.bindMatrix); clone.bind(clone.skeleton, clone.bindMatrix);
    });
    return copy;
  }

  // ---------------------------------------------------------------- materials
  // One shared shader extension grades every character material. Inputs are the bind-space position (stable on the
  // body: noise never swims) and the per-vertex wear attribute kwear baked at build time by G.wear():
  //   x edge wear, y cavity/contact occlusion, z blood paint, w gloss (eyes, wet flesh, glass) — or tear on cloth.
  // Per material class (KARA_CLASS) it adds: bare worn metal on edges, scuffed leather/wood edges, grime, rust in
  // cavities, drying and fresh blood with runs, procedural micro-relief (hammer dents, scratches, grain, pores —
  // faded by pixel footprint so the gameplay camera never shimmers), subsurface-like wrap light on skin (masked by
  // the albedo alpha on the hero/executioner atlases), a catch-light on glossy eyes and torn cloth hems (discard).
  var CLASS_ID = { plain: 0, metal: 1, leather: 2, cloth: 3, skin: 4, bone: 5, wood: 6, fur: 7 };
  var KEY_CLASS = { iron: 'metal', steel: 'metal', dark: 'metal', blade: 'metal', 'blade-runes': 'metal', edge: 'metal', brass: 'metal',
    leather: 'leather', strap: 'leather', apron: 'leather', wood: 'wood', bone: 'bone', ash: 'bone', rope: 'cloth', burlap: 'cloth', rag: 'cloth',
    robe: 'cloth', sash: 'cloth', tabard: 'cloth', bandage: 'cloth', fur: 'fur', furfringe: 'fur', flesh: 'skin' };
  var TEAR_KEYS = { burlap: 1, rag: 1, robe: 1, tabard: 1, bandage: 1, sash: 1 };
  function classOf(key) { return KEY_CLASS[key] || 'plain'; }
  // Default build-time wear for a gear key (recipes and builders may bake their own first).
  function wearDefaults(key) {
    var c = classOf(key);
    if (c === 'metal') return {};
    if (c === 'leather') return { edge: .8 };
    if (c === 'wood') return { edge: .6 };
    if (c === 'bone') return { edge: .5, cavity: .02 };
    if (TEAR_KEYS[key]) return { edge: 0, tear: { amount: .72, width: .05, bottom: .32, base: .05 } };
    return { edge: 0, cavity: 0, border: 0, curv: 0 };
  }
  var GRADE_HEAD = 'varying vec3 vKara;varying vec4 vKWear;uniform vec3 kTint;uniform float kSat,kGrime,kBlood,kScale,kContrast,kLowTop,kLowBottom,kRust,kWear,kBump,kSkin,kCatch;uniform vec3 kScatter;\n' +
    '#ifdef KARA_ENGRAVE\nuniform sampler2D kEngrave;uniform vec4 kEngraveRect;\n#endif\n' +
    '#ifdef KARA_HAIR\nuniform vec4 kHair;\n#endif\n' +
    'float kSkinMask=0.,kScar=0.,kFaceH=0.;\n#ifdef KARA_SCARS\nuniform vec4 kScarA[KARA_SCARS];uniform vec4 kScarB[KARA_SCARS];uniform float kScarFresh;\n#endif\n' +
    'float kH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\n' +
    'float kN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(kH(i),kH(i+vec3(1,0,0)),f.x),mix(kH(i+vec3(0,1,0)),kH(i+vec3(1,1,0)),f.x),f.y),mix(mix(kH(i+vec3(0,0,1)),kH(i+vec3(1,0,1)),f.x),mix(kH(i+vec3(0,1,1)),kH(i+vec3(1,1,1)),f.x),f.y),f.z);}\n' +
    'float kF(vec3 p){return .55*kN(p)+.3*kN(p*2.13)+.15*kN(p*4.37);}\n' +
    'float kRidge(vec3 p){return 1.-abs(2.*kN(p)-1.);}\n' +
    '#if defined(KARA_HAIR) || defined(KARA_FACE)\n' +
    // beard area in metres of the finished hero (fits beardMass): from the cheek line down to a bottom edge that rises toward the ears, with a window for the lips
    'float kMouth(vec3 w){float ax=abs(w.x);vec2 m=vec2(ax/.026,(w.y-2.153)/.0105);return 1.-smoothstep(.55,1.,length(m));}\n' +
    'float kBeard(vec3 w,vec3 p){float ax=abs(w.x),a=abs(atan(w.x,w.z+.02)),top=2.192+max(ax-.05,0.)*.75,bot=2.05+.11*pow(smoothstep(0.,1.2,a),1.3);\n' +
    ' return smoothstep(top+.008,top-.032,w.y+(kN(p*55.)-.5)*.02+(kN(p*160.)-.5)*.008)*smoothstep(bot-.002,bot+.016,w.y)*smoothstep(-.03,0.,w.z)*smoothstep(1.52,1.32,a)*(1.-kMouth(w));}\n' +
    'float kGrey(vec3 w,vec3 p,float bias,float sc,float depth){float g=smoothstep(2.19,2.1,w.y)+bias+smoothstep(.055,.12,abs(w.x))*.35;vec3 q=vec3(p.x,p.y*.3,p.z);return clamp(g+(kN(q*sc)-.5)*depth+(kN(q*sc*.2+3.)-.5)*.3,0.,1.);}\n#endif\n' +
    'float kFade(float px,float size){return 1.-smoothstep(.3,.9,px/size);}\n' +
    'vec3 kPerturb(vec3 sp,vec3 sn,vec2 dH,float fd){vec3 sx=normalize(dFdx(sp)),sy=normalize(dFdy(sp)),r1=cross(sy,sn),r2=cross(sn,sx);float det=dot(sx,r1)*fd;vec3 gr=sign(det)*(dH.x*r1+dH.y*r2);return normalize(abs(det)*sn-gr);}\n' +
    // micro-relief height (metres) per class. Every layer fades out with the pixel footprint (kFade is exactly 0 once
    // px >= .9 * size); a layer that is already faded out is not evaluated at all (same value, a fraction of the noise work).
    // The tests use px, which is a derivative of the interpolated position: they only skip terms that would be added as exact zeros.
    'float kHeight(vec3 p,float px){float h=0.;\n' +
    '#if KARA_CLASS == 1\n' +
    ' if(px<.045)h+=(kN(p*14.)-.5)*.0022*kFade(px,.05);if(px<.0162)h+=(kN(p*42.+3.)-.5)*.0011*kFade(px,.018);\n' +
    ' if(px<.0027){float s1=pow(kRidge(vec3(p.x*7.,p.y*300.,p.z*7.)+kN(p*5.)*3.),18.),s2=pow(kRidge(vec3(p.x*260.+p.y*120.,p.y*9.,p.z*260.)+vec3(5.)),18.),s3=pow(kRidge(vec3(p.z*240.,p.x*8.+p.y*190.,p.y*8.)+vec3(9.)),20.);\n' +
    '  h-=(s1+s2*.8+s3*.7)*.00032*kFade(px,.003);}\n' +
    ' if(px<.0036)h-=smoothstep(.6,.9,kN(p*160.))*.0003*kFade(px,.004);\n' +
    '#elif KARA_CLASS == 2\n' +
    ' if(px<.0036)h+=(kN(p*230.)-.5)*.00028*kFade(px,.004);if(px<.0108)h-=pow(kRidge(p*vec3(26.,70.,26.)),6.)*.0009*kFade(px,.012);if(px<.0027)h-=pow(kRidge(vec3(p.x*180.,p.y*12.,p.z*180.)+vec3(3.)),16.)*.0003*kFade(px,.003);\n' +
    '#elif KARA_CLASS == 3\n' +
    ' if(px<.0135)h-=pow(kRidge(p*vec3(18.,55.,18.)),5.)*.0012*kFade(px,.015);\n' +
    '#elif KARA_CLASS == 4\n' +
    ' {float a=0.;if(px<.00144)a+=(kN(p*520.)-.5)*.00011*kFade(px,.0016);if(px<.0036)a-=pow(kRidge(p*vec3(70.,190.,70.)),8.)*.00016*kFade(px,.004);h+=a*kSkinMask;}\n' +
    ' {float b=0.;if(px<.0036)b+=(kN(p*200.)-.5)*.0003*kFade(px,.004);if(px<.0108)b-=pow(kRidge(p*vec3(20.,60.,20.)),5.)*.0008*kFade(px,.012);h+=b*(1.-kSkinMask);}\n' +
    '#elif KARA_CLASS == 5\n' +
    ' if(px<.0036)h+=(kN(p*170.)-.5)*.0004*kFade(px,.004);if(px<.009)h-=pow(kRidge(p*28.+2.),22.)*.0014*kFade(px,.01);\n' +
    '#elif KARA_CLASS == 6\n' +
    ' if(px<.0072)h-=pow(kRidge(vec3(p.x*90.,p.y*6.,p.z*90.)),10.)*.001*kFade(px,.008);if(px<.0135)h+=(kN(p*60.)-.5)*.0008*kFade(px,.015);\n' +
    '#endif\n' +
    ' return h*kBump;}\n';
  var PHYS_PARS = null;
  function physicalPars() {
    if (PHYS_PARS) return PHYS_PARS;
    var src = T.ShaderChunk.lights_physical_pars_fragment, line = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', at = src.indexOf(line);
    // wrap lighting (red wraps furthest): light bleeding past the terminator, the look of skin and flesh
    PHYS_PARS = at < 0 ? src : src.slice(0, at + line.length) + '\n#ifdef KARA_SSS\n{float kd=dot(geometryNormal,directLight.direction);vec3 kw=clamp((vec3(kd)+kScatter)/(1.+kScatter),0.,1.);reflectedLight.directDiffuse+=directLight.color*(kw-vec3(clamp(kd,0.,1.)))*kSkinMask*BRDF_Lambert(material.diffuseColor);}\n#endif\n' + src.slice(at + line.length);
    return PHYS_PARS;
  }
  function grade(m, o) {
    o = o || {};
    var tint = Array.isArray(o.tint) ? new T.Color().setRGB(o.tint[0], o.tint[1], o.tint[2]) : new T.Color(o.tint === undefined ? 0xffffff : o.tint), cls = o.cls || 'plain';
    var u = { kTint: { value: tint }, kRust: { value: o.rust || 0 }, kSat: { value: o.sat === undefined ? 1 : o.sat },
      kGrime: { value: o.grime || 0 }, kBlood: { value: o.blood || 0 }, kScale: { value: o.scale || 7 }, kContrast: { value: o.contrast || 1 },
      kLowTop: { value: o.lowTop === undefined ? .55 : o.lowTop }, kLowBottom: { value: o.lowBottom === undefined ? 0 : o.lowBottom },
      kWear: { value: o.wear === undefined ? 1 : o.wear }, kBump: { value: o.bump === undefined ? 1 : o.bump }, kSkin: { value: o.skin || 0 },
      kCatch: { value: o.catchLight === undefined ? 1.2 : o.catchLight }, kScatter: { value: new T.Vector3().fromArray(o.scatter || [.62, .24, .13]) } };
    var defs = { KARA_CLASS: CLASS_ID[cls] };
    if (o.bump !== 0 && cls !== 'plain' && cls !== 'fur') defs.KARA_BUMP = '';
    if (cls === 'skin' && o.skin) defs.KARA_SSS = '';
    if (o.skinMap) defs.KARA_SKINMAP = '';
    if (o.tear) defs.KARA_TEAR = '';
    // hero-only face: hair = salt-and-pepper beard/moustache [grey bias, dark-strand multiplier, noise scale, noise depth]; face = head skin details
    // (grey side hair, forehead lines, lids, crow's feet, stubble under the beard); mass = the dithered, streaked beard shell
    if (o.hair) { defs.KARA_HAIR = ''; u.kHair = { value: new T.Vector4().fromArray(o.hair) }; }
    if (o.face) defs.KARA_FACE = '';
    if (o.mass) defs.KARA_MASS = '';
    if (o.scars && o.scars.length) {
      defs.KARA_SCARS = o.scars.length; u.kScarFresh = { value: o.fresh ? 1 : 0 };
      u.kScarA = { value: o.scars.map(function (sc) { return new T.Vector4(sc[0].x, sc[0].y, sc[0].z, sc[2] || .004); }) };
      u.kScarB = { value: o.scars.map(function (sc) { return new T.Vector4(sc[1].x, sc[1].y, sc[1].z, sc[3] ? 1 : 0); }) };
    }
    if (o.engrave) { defs.KARA_ENGRAVE = ''; u.kEngrave = { value: o.engrave }; u.kEngraveRect = { value: o.engrave.userData.rect }; }
    m.defines = Object.assign(m.defines || {}, defs);
    m.defaultAttributeValues = { kwear: [0, 0, 0, 0] };
    m.userData.grade = u;
    var cacheKey = 'kara-grade-9-' + Object.keys(defs).map(function (k) { return k + defs[k]; }).join('.');
    m.onBeforeCompile = function (sh) {
      Object.keys(u).forEach(function (k) { sh.uniforms[k] = u[k]; });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 kwear;varying vec3 vKara;varying vec4 vKWear;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKara=position;vKWear=kwear;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GRADE_HEAD)
        .replace('#include <lights_physical_pars_fragment>', physicalPars())
        .replace('void main() {', 'void main() {\nfloat kBloodMask=0.,kEdgeMask=0.,kCav=0.,kGloss=0.,kWet=0.,kCut=0.,kRustMask=0.;\n' +
          '#ifdef KARA_TEAR\nif(vKWear.w>.004){float tn=kF(vKara*47.+vec3(11.))*.8+kN(vKara*230.)*.2;if(tn<vKWear.w*.95)discard;}\n#endif\n')
        .replace('#include <map_fragment>', '#include <map_fragment>\n{float l=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=mix(vec3(l),diffuseColor.rgb,kSat);' +
          'diffuseColor.rgb=pow(max(diffuseColor.rgb,vec3(0.)),vec3(kContrast))*kTint;\n' +
          '#ifdef KARA_SKINMAP\nkSkinMask=sampledDiffuseColor.a*kSkin;\n#else\nkSkinMask=kSkin;\n#endif\n' +
          'kCav=clamp(vKWear.y,0.,1.);\n#ifndef KARA_TEAR\nkGloss=clamp(vKWear.w,0.,1.);\n#endif\n' +
          'float en=kN(vKara*kScale*9.)*.6+kN(vKara*kScale*31.)*.4;kEdgeMask=smoothstep(.22,.72,clamp(vKWear.x*kWear,0.,1.5)*(.45+.9*en));\n' +
          'if(kRust>0.){float rn=kF(vKara*kScale*2.3+vec3(4.,9.,1.)),pit=kN(vKara*kScale*19.+vec3(1.,7.,3.))*.65+kN(vKara*kScale*47.)*.35;kRustMask=clamp(max(smoothstep(.62-.25*kRust,.72-.25*kRust,rn)*smoothstep(.3,.62,pit)*.85,kCav*kRust*1.6*smoothstep(.35,.6,rn)*smoothstep(.2,.5,pit)),0.,.88);diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.045,.018,.009),vec3(.13,.048,.018),kN(vKara*kScale*11.)*.6+pit*.4),kRustMask);}\n' +
          '#if KARA_CLASS == 1\n{float ox=kF(vKara*kScale*1.3+vec3(3.,1.,7.));diffuseColor.rgb*=.72+.56*ox;vec3 bare=vec3(.47,.46,.445)*(.8+.4*kN(vKara*140.));diffuseColor.rgb=mix(diffuseColor.rgb,bare,kEdgeMask*.82);}\n' +
          '#elif KARA_CLASS == 2 || KARA_CLASS == 6\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.7+vec3(.035,.028,.02),kEdgeMask*.55);\n' +
          '#elif KARA_CLASS == 5\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.3+.03,kEdgeMask*.5);\n#endif\n' +
          'float g=kF(vKara*kScale),low=smoothstep(kLowTop,kLowBottom,vKara.y);diffuseColor.rgb*=1.-kGrime*clamp(.75*g+.6*low-.25,0.,.85);diffuseColor.rgb*=1.-kCav*.55;\n' +
          '#ifdef KARA_SCARS\n{float sc=0.,st=0.;for(int i=0;i<KARA_SCARS;i++){vec3 a=kScarA[i].xyz,ab=kScarB[i].xyz-a;float L=length(ab),t=clamp(dot(vKara-a,ab)/(L*L),0.,1.),d=length(vKara-a-ab*t),w=kScarA[i].w*(.55+.9*kN(vKara*260.+float(i)*7.));' +
          'sc=max(sc,smoothstep(w,w*.3,d)*smoothstep(0.,.1,t)*smoothstep(1.,.9,t));float q=abs(fract(t*L/.011)-.5)*.011;st=max(st,kScarB[i].w*smoothstep(.0016,.0006,q)*smoothstep(w*3.2,w*2.2,d)*step(.08,t)*step(t,.92));}' +
          'float sk=step(.5,kSkinMask);kScar=max(sc,st)*sk;vec3 healed=diffuseColor.rgb*vec3(1.22,1.02,.98)+vec3(.035,.02,.02),fresh=mix(vec3(.11,.012,.008),vec3(.24,.03,.02),kN(vKara*120.));' +
          'diffuseColor.rgb=mix(diffuseColor.rgb,mix(healed,fresh,kScarFresh),sc*sk*.85);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.03,.02,.015),st*sk);kWet=max(kWet,sc*sk*kScarFresh);}\n#endif\n' +
          'float paint=clamp(vKWear.z,0.,1.),zone=smoothstep(.3,.7,kN(vKara*kScale*.33+vec3(7.,1.,3.))),bn=kF(vKara*kScale*1.6+vec3(13.,5.,2.))*.7+kN(vKara*kScale*6.)*.3;\n' +
          'float drip=kN(vec3(vKara.x*kScale*10.,vKara.y*kScale*.8,vKara.z*kScale*10.)+vec3(2.,9.,4.)),th=.24*kBlood*(.35+.9*zone)+paint*.4;\n' +
          'if(kBlood+paint>0.){kBloodMask=max(smoothstep(.73-th,.79-th,bn),smoothstep(.9-th*.7,.95-th*.7,drip)*zone*clamp(kBlood*2.+paint,0.,1.));}\n' +
          'kWet=clamp(paint*1.6,0.,1.)*kBloodMask;vec3 bc=mix(vec3(.022,.004,.003),vec3(.075,.007,.005),kN(vKara*kScale*3.1+vec3(2.)));bc=mix(bc,vec3(.15,.01,.007),kWet*.75);diffuseColor.rgb=mix(diffuseColor.rgb,bc,kBloodMask*.92);\n' +
          '#ifdef KARA_ENGRAVE\n{vec2 eu=(vKara.xy-kEngraveRect.xy)/kEngraveRect.zw;kCut=(eu.x>0.&&eu.x<1.&&eu.y>0.&&eu.y<1.)?1.-texture2D(kEngrave,eu).r:0.;diffuseColor.rgb*=1.-kCut*.72;}\n#endif\n' +
          '}')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' +
          // hero beard and moustache: dark brown near the mouth and cheeks, greying toward the chin and jaw (kGrey), strand by strand
          '#ifdef KARA_HAIR\n{vec3 w=vKara*1.2965;if(w.z>.05&&kMouth(w)>.5)discard;float g=kGrey(w,vKara,kHair.x,kHair.z,kHair.w),l=dot(diffuseColor.rgb,vec3(.299,.587,.114)),gb=.25;\n#ifdef KARA_MASS\ngb=.5;\n#endif\ndiffuseColor.rgb=mix(diffuseColor.rgb*kHair.y,vec3(l*.5+gb)*vec3(1.,.97,.92),g*.9);\n' +
          // beard mass: dithered edges, fine vertical strands
          '#ifdef KARA_MASS\n{float e=kBeard(vKara*1.2965,vKara);if(e<.999&&e<kH(floor(vKara*900.)))discard;diffuseColor.rgb*=.5+.9*kN(vec3(vKara.x*700.,vKara.y*110.,vKara.z*700.))*(.6+.8*kN(vKara*1200.));}\n#endif\n}\n#endif\n' +
          // hero head skin, in metres of the finished hero: grey hair at the sides of the skull, beard stubble under the strand cards,
          // forehead lines, lids, eye bags and crow's feet (front of the face only)
          '#ifdef KARA_FACE\n{vec3 w=vKara*1.2965;float ax=abs(w.x);if(w.y>2.04){\n' +
          ' {vec3 bd=w-vec3(0.,2.25,0.);float az=abs(atan(bd.x,bd.z)),yy=w.y+(kN(vKara*75.)-.5)*.009,low=mix(mix(2.2885,2.305,smoothstep(1.2,1.6,az)),2.13,smoothstep(1.9,2.4,az)),top=mix(2.335,2.365,smoothstep(1.3,2.9,az)),m=smoothstep(1.05,1.3,az)*smoothstep(low-.004,low+.004,yy)*smoothstep(top+.004,top-.004,yy);\n' +
          '  vec3 hr=mix(vec3(.05,.045,.04),vec3(.15,.14,.13),smoothstep(.25,.85,.65*kN(vKara*1300.)+.35*kN(vKara*300.)));diffuseColor.rgb=mix(diffuseColor.rgb,hr,m*.75);kSkinMask*=1.-m*.9;}\n' +
          // the atlas has a bright dotted seam along the midline of the skull: pull it down to the local average
          '#ifdef USE_MAP\n {float sm=(1.-smoothstep(.002,.006,ax))*smoothstep(2.29,2.32,w.y);if(sm>0.){float r=dot(textureLod(map,vMapUv,2.5).rgb,vec3(.299,.587,.114))/max(dot(sampledDiffuseColor.rgb,vec3(.299,.587,.114)),.02);diffuseColor.rgb*=mix(1.,clamp(r,.8,1.),sm);}}\n#endif\n' +
          ' float fm=smoothstep(.03,.07,w.z)*(1.-smoothstep(.13,.16,ax))*smoothstep(2.07,2.12,w.y)*(1.-smoothstep(2.4,2.44,w.y));\n' +
          ' if(fm>0.){\n' +
          '  float fl=0.;for(int i=0;i<3;i++){float y0=2.316+float(i)*.017-1.7*w.x*w.x;fl=max(fl,smoothstep(.0016,.0003,abs(w.y-y0+(kN(vec3(w.x*70.,float(i)*5.,2.))-.5)*.0035))*smoothstep(.2,.4,kN(vec3(w.x*24.,float(i)*3.,1.)))*(1.-smoothstep(.04,.085,ax)));}\n' +
          '  vec2 e=vec2(ax-.042,w.y-2.252),q=e/vec2(.03,.02);\n' +
          '  float sock=exp(-dot(q,q)),crease=smoothstep(.0011,.0003,abs(e.y-.0135+7.*e.x*e.x))*(1.-smoothstep(.016,.024,abs(e.x+.004))),lower=smoothstep(.0008,.0002,abs(e.y+.0125-3.*e.x*e.x))*(1.-smoothstep(.012,.02,abs(e.x))),bag=exp(-pow((e.y+.022)/.0055,2.))*(1.-smoothstep(.015,.03,abs(e.x-.003))),crow=0.;\n' +
          '  for(int i=0;i<3;i++){float a=float(i)*.4-.3;vec2 d=vec2(cos(a),sin(a)),r=e-vec2(.013,0.);float al=dot(r,d),pp=abs(r.x*d.y-r.y*d.x);crow=max(crow,smoothstep(.0007,.0002,pp)*smoothstep(0.,.004,al)*smoothstep(.022,.008,al)*smoothstep(.25,.6,kN(vec3(al*90.,float(i),4.))));}\n' +
          '  diffuseColor.rgb*=1.-fm*(.16*sock+.3*crease+.16*lower+.1*bag+.16*crow+.15*fl);kFaceH=-fm*(.0007*fl+.0006*crease+.0003*lower+.0002*crow);}\n' +
          ' float bm=kBeard(w,vKara);\n' +
          ' if(bm>0.){float g=kGrey(w,vKara,.05,600.,.8);vec3 hc=mix(vec3(.05,.036,.03),vec3(.58,.56,.52),g)*(.65+.7*kN(vKara*900.));diffuseColor.rgb=mix(diffuseColor.rgb,hc,bm*.88);kSkinMask*=1.-bm*.95;}}}\n#endif\n')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' +
          '#if KARA_CLASS == 1\nroughnessFactor*=.72+.56*kN(vKara*kScale*4.+vec3(5.));roughnessFactor=mix(roughnessFactor,.26,kEdgeMask);\n' +
          '#elif KARA_CLASS == 4\nroughnessFactor=mix(roughnessFactor,.46+.2*kN(vKara*90.),kSkinMask);\n#endif\n' +
          'roughnessFactor=mix(roughnessFactor,1.,kCav*.35+kCut*.3+kRustMask*.6);roughnessFactor=mix(roughnessFactor,mix(.48,.2,kWet),kBloodMask);roughnessFactor=mix(roughnessFactor,.07,kGloss);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' +
          '#if KARA_CLASS == 1\nmetalnessFactor=mix(metalnessFactor,1.,kEdgeMask*.8);\n#endif\nmetalnessFactor=mix(metalnessFactor,0.,max(max(kBloodMask,kGloss),kRustMask));')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' +
          '#ifdef KARA_BUMP\n{float kPx=length(fwidth(vKara));float kh=kHeight(vKara,kPx)-kCut*.0007*kFade(kPx,.004)+kFaceH*kFade(kPx,.006);\n#ifdef KARA_SCARS\nkh+=kScar*mix(.0005,-.0006,kScarFresh)*kFade(kPx,.006);\n#endif\nnormal=kPerturb(-vViewPosition,normal,vec2(dFdx(kh),dFdy(kh)),faceDirection);}\n#endif\n')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef KARA_MASS\n{float kPx=length(fwidth(vKara)),kh=(kN(vec3(vKara.x*700.,vKara.y*110.,vKara.z*700.))-.5)*.0011*kFade(kPx,.004);normal=kPerturb(-vViewPosition,normal,vec2(dFdx(kh),dFdy(kh)),faceDirection);}\n#endif\n')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif(kGloss>.01){vec3 kHv=normalize(vec3(-.32,.42,1.)+vec3(0.,0.,1.));totalEmissiveRadiance+=vec3(kCatch*kGloss*pow(max(dot(normal,kHv),0.),110.));}')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{float kAO=1.-kCav*.75;reflectedLight.indirectDiffuse*=kAO;reflectedLight.indirectSpecular*=kAO;reflectedLight.directDiffuse*=1.-kCav*.3;}');
    };
    m.customProgramCacheKey = function () { return cacheKey; };
    return m;
  }
  function std(props, g) { var m = new T.MeshStandardMaterial(props); if (g) grade(m, g); return m; }
  // Forged metal: rust-scan relief and roughness, flat albedo so the value is controlled (the rust albedo is too orange).
  function metal(value, metalness, roughness, g) {
    var s = surfaces.iron || {}, m = new T.MeshStandardMaterial({ color: new T.Color().setRGB(value, value, value * 1.03), metalness: metalness, roughness: roughness, normalMap: s.normalMap || null, roughnessMap: s.roughnessMap || null, aoMap: s.aoMap || null });
    m.normalScale.set(.6, .6); grade(m, Object.assign({ cls: 'metal' }, g || {})); return m;
  }
  function surfaceProps(name, extra) { var s = surfaces[name], p = {}; if (s) Object.keys(s).forEach(function (k) { p[k] = s[k]; }); return Object.assign(p, extra || {}); }
  // Shared gear materials; created once, never disposed by characters.
  function gearMaterial(key) {
    if (library[key]) return library[key];
    var m;
    switch (key) {
      case 'iron': m = metal(.15, .72, .66, { rust: .14, grime: .3, blood: .12 }); break;
      case 'steel': m = metal(.16, .78, .5, { rust: .06, grime: .3 }); m.normalScale.set(.4, .4); break;
      case 'dark': m = metal(.07, .62, .7, { rust: .1, grime: .2, wear: .75 }); break;
      case 'blade': m = metal(.19, .8, .42, { grime: .15, blood: .3, scale: 8, wear: 1.2 }); break;
      case 'blade-runes': m = metal(.19, .8, .42, { grime: .15, blood: .3, scale: 8, wear: 1.2, engrave: G.runeTexture() }); break;
      case 'edge': m = std({ color: new T.Color().setRGB(.5, .505, .52), metalness: .9, roughness: .3, normalMap: surfaces.iron && surfaces.iron.normalMap }, { cls: 'metal', blood: .4, scale: 9, wear: .4 }); m.normalScale.set(.18, .18); break;
      case 'brass': m = metal(1, .8, .4, { tint: [.46, .3, .12], grime: .35, wear: .7 }); break;
      case 'leather': m = std(surfaceProps('leather', { roughness: .88 }), { cls: 'leather', sat: .8, tint: [.9, .8, .72], grime: .35 }); break;
      case 'strap': m = std(surfaceProps('leather', { roughness: .82 }), { cls: 'leather', sat: .6, tint: [.5, .42, .36], grime: .2 }); break;
      case 'wood': m = std(surfaceProps('wood', { roughness: .85 }), { cls: 'wood', sat: .7, tint: [1.35, 1.2, 1.05], grime: .3 }); break;
      case 'rope': m = std(surfaceProps('linen', { roughness: 1 }), { cls: 'cloth', sat: .6, tint: [.6, .48, .32], grime: .4 }); break;
      case 'burlap': m = std(surfaceProps('linen', { roughness: 1, side: T.DoubleSide }), { cls: 'cloth', tear: true, sat: .7, tint: [.42, .31, .2], grime: .6, blood: .7, scale: 10 }); m.normalScale.set(1.6, 1.6); break;
      case 'rag': m = std(surfaceProps('linen', { roughness: 1, side: T.DoubleSide }), { cls: 'cloth', tear: true, sat: .35, tint: [.17, .15, .13], grime: .7, blood: .35 }); break;
      case 'robe': m = std(surfaceProps('linen', { roughness: .92, side: T.DoubleSide }), { cls: 'cloth', tear: true, sat: 1, tint: [.46, .055, .04], grime: .7, lowTop: .5, lowBottom: 0, blood: .15 }); break;
      case 'sash': m = std(surfaceProps('linen', { roughness: .95, side: T.DoubleSide }), { cls: 'cloth', tear: true, sat: .5, tint: [.07, .065, .06], grime: .3 }); break;
      case 'tabard': m = std(surfaceProps('linen', { roughness: .95, side: T.DoubleSide }), { cls: 'cloth', tear: true, sat: .8, tint: [.15, .03, .025], grime: .5, blood: .25 }); break;
      case 'bandage': m = std(surfaceProps('linen', { roughness: 1, side: T.DoubleSide }), { cls: 'cloth', tear: true, sat: .5, tint: [.3, .26, .18], grime: .85, blood: .6, scale: 11 }); break;
      case 'apron': m = std(surfaceProps('leather', { roughness: .78, side: T.DoubleSide }), { cls: 'leather', tear: true, sat: .7, tint: [.62, .5, .42], grime: .4, blood: .45 }); break;
      case 'bone': m = std({ color: new T.Color().setRGB(.36, .31, .22), roughness: .7, normalMap: surfaces.masonry && surfaces.masonry.normalMap }, { cls: 'bone', grime: .5, scale: 9 }); m.normalScale.set(.6, .6); break;
      case 'ash': m = std({ color: new T.Color().setRGB(.2, .19, .18), roughness: .9, normalMap: surfaces.masonry && surfaces.masonry.normalMap }, { cls: 'bone', grime: .6 }); break;
      case 'fur': { var fur = G.furTexture(); m = std({ color: 0xffffff, map: fur.map, bumpMap: fur.bump, bumpScale: 2.2, roughness: .92, side: T.DoubleSide }, { cls: 'fur', sat: .85, tint: [1.35, 1.25, 1.15], grime: .15 }); break; }
      case 'furfringe': { var fr = G.fringeTexture(); m = std({ color: 0xd8c6ae, map: fr, alphaTest: .42, roughness: .95, side: T.DoubleSide }, { cls: 'fur', sat: .85 }); break; }
      case 'ember': m = std({ color: 0x2a0d06, emissive: 0xff5a14, emissiveIntensity: 2.6, roughness: .8 }); break;
      case 'glow': m = std({ color: 0x3a4a14, emissive: 0x8ec43a, emissiveIntensity: 1.25, roughness: .35 }, { catchLight: .8 }); break;
      case 'flesh': m = std(surfaceProps('leather', { roughness: .45 }), { cls: 'skin', skin: 1, sat: .5, tint: [1.1, .8, .6], blood: .5, scatter: [.8, .3, .15] }); break;
      case 'void': m = std({ color: 0x030303, roughness: 1, metalness: 0 }, { catchLight: 1.1 }); break;
      case 'paint': m = std({ color: 0xffffff, map: G.decalTexture(), transparent: false, alphaTest: .45, roughness: .75, polygonOffset: true, polygonOffsetFactor: -2 }, { sat: .9, grime: .2 }); break;
      default: throw Error('Bilinmeyen malzeme: ' + key);
    }
    m.name = 'kara-' + key; library[key] = m; return m;
  }
  function bodyMaterial(src, key, g, extra) {
    if (library[key]) return library[key];
    var m = src.clone(); Object.assign(m, extra || {}); grade(m, g); m.name = 'kara-' + key;
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(function (t) { if (m[t]) m[t].anisotropy = 8; });
    library[key] = m; return m;
  }

  // ---------------------------------------------------------------- assembly
  // Collects skinned parts on one master skeleton in the bind pose, lets recipes edit proportions and fit gear,
  // then merges everything per material into a few SkinnedMeshes.
  function Assembly(baseName) {
    var scene = cloneSkin(bases[baseName]); scene.updateMatrixWorld(true);
    var first = null, parent = null; scene.traverse(function (n) { if (n.isSkinnedMesh && !first) first = n; });
    parent = first.parent;
    var bones = first.skeleton.bones.slice(), inverses = first.skeleton.boneInverses.map(function (m) { return m.clone(); });
    var index = {}; bones.forEach(function (b, i) { index[b.name] = i; });
    var parts = [], old = []; scene.traverse(function (n) { if (n.isSkinnedMesh) old.push(n); });
    old.forEach(function (n) { n.parent.remove(n); });
    var A = { scene: scene, bones: bones, index: index, parts: parts, base: baseName };
    function world(j) { return new T.Matrix4().copy(inverses[j]).invert(); }
    A.world = world;
    A.P = function (name) { var j = index[name]; if (j === undefined) throw Error('Kemik yok: ' + name); return new T.Vector3().setFromMatrixPosition(world(j)); };
    A.has = function (name) { return index[name] !== undefined; };
    A.tail = function (name) {
      var j = index[name], b = bones[j], best = null, bestD = -1, p = A.P(name);
      b.children.forEach(function (c) { if (index[c.name] === undefined) return; var d = A.P(c.name).distanceTo(p); if (d > bestD) { bestD = d; best = c.name; } });
      return best ? A.P(best) : null;
    };
    // Adds a SkinnedMesh's geometry, re-expressed on the master skeleton at its bind pose.
    A.add = function (mesh, key) {
      var g = floatGeometry(mesh.geometry), sk = mesh.skeleton, p = g.attributes.position, n = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      var remap = sk.bones.map(function (b) { var j = index[b.name]; if (j === undefined) throw Error('Kemik eşleşmedi: ' + b.name); return j; });
      var same = sk.bones.every(function (b, i) { return b === bones[i]; }) || sk.bones.every(function (b, i) { return b.name === bones[i].name && sk.boneInverses[i].equals(inverses[i]); });
      var mats = sk.bones.map(function (b, i) { return world(remap[i]).multiply(sk.boneInverses[i]); });
      var outIndex = new Uint16Array(si.count * 4), outWeight = new Float32Array(si.count * 4), v = new T.Vector3(), acc = new T.Vector3(), tmp = new T.Vector3(), nn = new T.Vector3(), nacc = new T.Vector3(), m3 = new T.Matrix3();
      for (var i = 0; i < si.count; i++) {
        v.fromBufferAttribute(p, i); if (n) nn.fromBufferAttribute(n, i); acc.set(0, 0, 0); nacc.set(0, 0, 0); var total = 0;
        for (var k = 0; k < 4; k++) {
          var j = si.getComponent(i, k), w = sw.getComponent(i, k); outIndex[i * 4 + k] = remap[j]; outWeight[i * 4 + k] = w;
          if (!same && w > 0) { tmp.copy(v).applyMatrix4(mats[j]); acc.addScaledVector(tmp, w); if (n) { m3.setFromMatrix4(mats[j]); tmp.copy(nn).applyMatrix3(m3); nacc.addScaledVector(tmp, w); } total += w; }
        }
        if (!same && total > 0) { acc.multiplyScalar(1 / total); p.setXYZ(i, acc.x, acc.y, acc.z); if (n) { nacc.normalize(); n.setXYZ(i, nacc.x, nacc.y, nacc.z); } }
      }
      g.setAttribute('skinIndex', new T.BufferAttribute(outIndex, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(outWeight, 4));
      Object.keys(g.attributes).forEach(function (a) { if (!/^(position|normal|uv|skinIndex|skinWeight)$/.test(a)) g.deleteAttribute(a); });
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(p.count * 2), 2));
      var cls = classOf(key); if (cls === 'metal' || cls === 'leather') G.wear(g, wearDefaults(key)); else G.fillWear(g);
      var part = { geometry: g, key: key, body: true, name: mesh.name }; parts.push(part); return part;
    };
    // Move skin influence from a helper bone the retarget never drives onto a driven one.
    A.remapBone = function (from, to) {
      var jf = index[from], jt = index[to]; if (jf === undefined || jt === undefined) return;
      parts.forEach(function (part) { var si = part.geometry.attributes.skinIndex; for (var i = 0; i < si.count; i++) for (var k = 0; k < 4; k++) if (si.getComponent(i, k) === jf) si.setComponent(i, k, jt); si.needsUpdate = true; });
    };
    A.addFrom = function (baseScene, test, key) {
      var found = [];
      baseScene.traverse(function (n) { if (n.isSkinnedMesh && test(n)) found.push(n); });
      return found.map(function (n) { return A.add(n, typeof key === 'function' ? key(n) : key); });
    };
    function dominant(si, sw, i) { var best = 0, bw = -1; for (var k = 0; k < 4; k++) { var w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } } return best; }
    A.dominant = dominant;
    // Keep only triangles for which keep(a,b,c) is true; a,b,c are {p, bone} records.
    A.trim = function (part, keep) {
      var g = part.geometry, idx = g.index.array, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, out = [];
      function rec(i) { return { p: new T.Vector3().fromBufferAttribute(p, i), bone: bones[dominant(si, sw, i)].name, i: i }; }
      for (var t = 0; t < idx.length; t += 3) if (keep(rec(idx[t]), rec(idx[t + 1]), rec(idx[t + 2]))) out.push(idx[t], idx[t + 1], idx[t + 2]);
      part.geometry = compact(g, out);
    };
    // Proportion edit: scale bone offsets (child position relative to parent), bake vertices, recompute inverses.
    A.lengthen = function (factors) {
      Object.keys(factors).forEach(function (name) { var j = index[name]; if (j !== undefined) bones[j].position.multiplyScalar(factors[name]); });
      scene.updateMatrixWorld(true);
      var mats = bones.map(function (b, j) { return new T.Matrix4().multiplyMatrices(b.matrixWorld, inverses[j]); }), m3 = new T.Matrix3();
      parts.forEach(function (part) { skinBake(part.geometry, mats); });
      bones.forEach(function (b, j) { inverses[j].copy(b.matrixWorld).invert(); });
    };
    function skinBake(g, mats) {
      var p = g.attributes.position, n = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, v = new T.Vector3(), a = new T.Vector3(), t = new T.Vector3(), nn = new T.Vector3(), na = new T.Vector3(), m3 = new T.Matrix3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); a.set(0, 0, 0); if (n) { nn.fromBufferAttribute(n, i); na.set(0, 0, 0); } var tw = 0;
        for (var k = 0; k < 4; k++) { var w = sw.getComponent(i, k); if (w <= 0) continue; var M = mats[si.getComponent(i, k)]; a.addScaledVector(t.copy(v).applyMatrix4(M), w); if (n) { m3.setFromMatrix4(M); na.addScaledVector(t.copy(nn).applyMatrix3(m3), w); } tw += w; }
        if (tw > 0) { a.multiplyScalar(1 / tw); p.setXYZ(i, a.x, a.y, a.z); if (n) { na.normalize(); n.setXYZ(i, na.x, na.y, na.z); } }
      }
      p.needsUpdate = true;
    }
    // Slim or bulk flesh toward each bone's axis. factors: {boneName: f}; missing bones keep 1.
    A.slim = function (part, factors, fallback) {
      var segs = bones.map(function (b) { var a = A.P(b.name), t = A.tail(b.name); return { a: a, b: t || a.clone() }; });
      var f = bones.map(function (b) { return factors[b.name] !== undefined ? factors[b.name] : (fallback === undefined ? 1 : fallback); });
      var g = part.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, v = new T.Vector3(), out = new T.Vector3(), q = new T.Vector3(), d = new T.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); out.set(0, 0, 0); var tw = 0;
        for (var k = 0; k < 4; k++) {
          var w = sw.getComponent(i, k); if (w <= 0) continue; var j = si.getComponent(i, k), s = segs[j];
          d.copy(s.b).sub(s.a); var len2 = d.lengthSq(), t = len2 > 1e-8 ? clamp(q.copy(v).sub(s.a).dot(d) / len2, 0, 1) : 0;
          q.copy(s.a).addScaledVector(d, t); out.addScaledVector(q.clone().add(v.clone().sub(q).multiplyScalar(f[j])), w); tw += w;
        }
        if (tw > 0) { out.multiplyScalar(1 / tw); p.setXYZ(i, out.x, out.y, out.z); }
      }
      g.computeVertexNormals();
    };
    // Gaussian inflation along the vertex normal (bellies, humps, swellings).
    A.inflate = function (part, center, radius, amount, stretch) {
      var g = part.geometry, p = g.attributes.position, n = g.attributes.normal, v = new T.Vector3(), nn = new T.Vector3(), sc = stretch || [1, 1, 1];
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
        var dx = (v.x - center.x) / sc[0], dy = (v.y - center.y) / sc[1], dz = (v.z - center.z) / sc[2], k = Math.exp(-(dx * dx + dy * dy + dz * dz) / (radius * radius));
        if (k < .002) continue; v.addScaledVector(nn, amount * k); p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
    };
    // Vertex cloud of parts (optionally filtered by dominant bone names and part keys).
    A.cloud = function (boneNames, keys, minWeight) {
      var out = [], want = boneNames ? new Set(boneNames.map(function (n) { return index[n]; })) : null;
      parts.forEach(function (part) {
        if (!part.body || (keys && keys.indexOf(part.key) < 0)) return;
        var g = part.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, used = new Uint8Array(p.count);
        var idx = g.index ? g.index.array : null; if (idx) for (var t = 0; t < idx.length; t++) used[idx[t]] = 1; else used.fill(1);
        for (var i = 0; i < p.count; i++) {
          if (!used[i]) continue;
          if (want) { var ok = false; for (var k = 0; k < 4; k++) if (sw.getComponent(i, k) >= (minWeight || .5) && want.has(si.getComponent(i, k))) ok = true; if (!ok) continue; }
          out.push(new T.Vector3().fromBufferAttribute(p, i));
        }
      });
      return out;
    };
    A.box = function (cloud) { var b = new T.Box3(); cloud.forEach(function (p) { b.expandByPoint(p); }); return b; };
    // Nearest-vertex weight transfer from body parts (so fitted plates and shells follow the flesh they sit on).
    var hash = null;
    function buildHash() {
      hash = { cell: .045, map: new Map(), src: [] };
      parts.forEach(function (part) {
        if (!part.body) return; var g = part.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, nrm = g.attributes.normal;
        for (var i = 0; i < p.count; i++) {
          var x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = Math.floor(x / hash.cell) + ',' + Math.floor(y / hash.cell) + ',' + Math.floor(z / hash.cell);
          var rec = { x: x, y: y, z: z, j: [si.getComponent(i, 0), si.getComponent(i, 1), si.getComponent(i, 2), si.getComponent(i, 3)], w: [sw.getComponent(i, 0), sw.getComponent(i, 1), sw.getComponent(i, 2), sw.getComponent(i, 3)], key: part.key, dom: dominant(si, sw, i), nx: nrm ? nrm.getX(i) : 0, ny: nrm ? nrm.getY(i) : 1, nz: nrm ? nrm.getZ(i) : 0 };
          if (!hash.map.has(key)) hash.map.set(key, []); hash.map.get(key).push(rec);
        }
      });
    }
    function nearest(x, y, z, keys, allow) {
      var c = hash.cell, cx = Math.floor(x / c), cy = Math.floor(y / c), cz = Math.floor(z / c), best = null, bd = Infinity;
      for (var r = 0; r < 12 && (!best || r < 2); r++) {
        for (var i = -r; i <= r; i++) for (var j = -r; j <= r; j++) for (var k = -r; k <= r; k++) {
          if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
          var list = hash.map.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)); if (!list) continue;
          for (var q = 0; q < list.length; q++) { var s = list[q]; if (keys && keys.indexOf(s.key) < 0) continue; if (allow && !allow.has(s.dom)) continue; var d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) + (s.z - z) * (s.z - z); if (d < bd) { bd = d; best = s; } }
        }
      }
      return best;
    }
    A.nearest = function (v, keys) { if (!hash) buildHash(); return nearest(v.x, v.y, v.z, keys); };
    function allowSet(names) { if (!names) return null; var set = new Set(); names.forEach(function (n) { if (index[n] !== undefined) set.add(index[n]); }); return set; }
    function finishGear(g, key, weights) {
      var p = g.attributes.position, si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4), v = new T.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); var w = weights(v, i);
        var sum = 0; for (var k = 0; k < Math.min(4, w.length); k++) { si[i * 4 + k] = w[k][0]; sw[i * 4 + k] = w[k][1]; sum += w[k][1]; }
        if (sum > 0) for (k = 0; k < 4; k++) sw[i * 4 + k] /= sum; else { si[i * 4] = 0; sw[i * 4] = 1; }
      }
      g.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
      if (!g.attributes.kwear) G.wear(g, wearDefaults(key));
      parts.push({ geometry: g, key: key, body: false }); return g;
    }
    // Rigid attachment to one bone.
    A.rigid = function (key, g, bone) { var j = typeof bone === 'number' ? bone : index[bone]; if (j === undefined) throw Error('Kemik yok: ' + bone); return finishGear(g, key, function () { return [[j, 1]]; }); };
    // Weights copied from the nearest body vertex (optionally only from parts with the listed keys).
    // opts.bones: only copy from vertices whose dominant bone is listed (keeps belts off hanging arms);
    // opts.pin: one weight set for the whole piece, taken at its centre (small rigid props never stretch).
    A.transfer = function (key, g, keys, opts) {
      if (!hash) buildHash(); opts = opts || {};
      var allow = allowSet(opts.bones), pinned = null;
      if (opts.pin) { g.computeBoundingBox(); var c = g.boundingBox.getCenter(new T.Vector3()); pinned = nearest(c.x, c.y, c.z, keys, allow); }
      return finishGear(g, key, function (v) { var s = pinned || nearest(v.x, v.y, v.z, keys, allow); if (!s) return [[0, 1]]; return s.j.map(function (j, k) { return [j, s.w[k]]; }).filter(function (e) { return e[1] > 0; }); });
    };
    A.weighted = function (key, g, fn) { return finishGear(g, key, fn); };
    // Rigid geometry positioned in a bone frame: origin at the bone head (+offset along the bone), +Y along the bone,
    // +Z toward the character's front (or hint). Returns the placed geometry.
    A.frame = function (name, along, zHint, originOffset) {
      var a = A.P(name), t = A.tail(name) || a.clone().add(new T.Vector3(0, .1, 0)), y = along === false ? new T.Vector3(0, 1, 0) : t.clone().sub(a).normalize();
      var z = (zHint || new T.Vector3(0, 0, 1)).clone(); z.addScaledVector(y, -z.dot(y)); if (z.lengthSq() < 1e-6) z.set(1, 0, 0); z.normalize();
      var x = new T.Vector3().crossVectors(y, z), m = new T.Matrix4().makeBasis(x, y, z);
      var o = a.clone(); if (originOffset) o.addScaledVector(t.clone().sub(a), originOffset);
      m.setPosition(o); return m;
    };
    // Contact occlusion baked into kwear.y: gear darkens where it presses on the body, and the body under straps,
    // plates and cloth darkens where gear sits (vertex-distance estimate, within ~3 cm).
    A.contact = function () {
      if (!hash) buildHash();
      var cell = .03, gear = new Map();
      parts.forEach(function (part) { if (part.body) return; var p = part.geometry.attributes.position; for (var i = 0; i < p.count; i++) { var k = Math.floor(p.getX(i) / cell) + ',' + Math.floor(p.getY(i) / cell) + ',' + Math.floor(p.getZ(i) / cell); if (!gear.has(k)) gear.set(k, []); gear.get(k).push(p.getX(i), p.getY(i), p.getZ(i)); } });
      function near(map, c, x, y, z) { var cx = Math.floor(x / c), cy = Math.floor(y / c), cz = Math.floor(z / c), best = c * c; for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) for (var k = -1; k <= 1; k++) { var l = map.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)); if (!l) continue; for (var q = 0; q < l.length; q += 3) { var dx = l[q] - x, dy = l[q + 1] - y, dz = l[q + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < best) best = d; } } return Math.sqrt(best); }
      var bodyMap = new Map(); hash.map.forEach(function (list) { list.forEach(function (r) { var k = Math.floor(r.x / cell) + ',' + Math.floor(r.y / cell) + ',' + Math.floor(r.z / cell); if (!bodyMap.has(k)) bodyMap.set(k, []); bodyMap.get(k).push(r.x, r.y, r.z); }); });
      parts.forEach(function (part) {
        var g = part.geometry, p = g.attributes.position, w = g.attributes.kwear, cls = classOf(part.key); if (!w || cls === 'fur') return;
        var map = part.body ? gear : bodyMap, amount = part.body ? .42 : .5; if (!map.size) return;
        for (var i = 0; i < p.count; i++) { var d = near(map, cell, p.getX(i), p.getY(i), p.getZ(i)); if (d < cell) w.setY(i, Math.min(1, w.getY(i) + amount * (1 - d / cell))); }
        w.needsUpdate = true;
      });
    };
    A.build = function (materials) {
      A.contact();
      var byKey = {};
      parts.forEach(function (part) { if (part.geometry.index && part.geometry.index.count === 0) return; (byKey[part.key] = byKey[part.key] || []).push(part.geometry); });
      var skeleton = new T.Skeleton(bones, inverses), meshes = [];
      Object.keys(byKey).forEach(function (key) {
        var geo = mergeSkinned(byKey[key]), mat = materials[key] || gearMaterial(key);
        var mesh = new T.SkinnedMesh(geo, mat); mesh.name = key; mesh.castShadow = mesh.receiveShadow = true;
        mesh.frustumCulled = true; parent.add(mesh); mesh.bind(skeleton, new T.Matrix4()); meshes.push(mesh);
      });
      scene.updateMatrixWorld(true);
      return { scene: scene, skeleton: skeleton, meshes: meshes };
    };
    return A;
  }
  // Quantized glTF attributes (KHR_mesh_quantization: int8 normals with 4-byte stride, uint16 UVs, uint8 weights)
  // are expanded to plain float arrays before any bind-pose editing.
  function floatGeometry(src) {
    var g = new T.BufferGeometry();
    Object.keys(src.attributes).forEach(function (name) {
      var a = src.attributes[name], n = a.itemSize, count = a.count;
      if (name === 'skinIndex') { var ia = new Uint16Array(count * 4); for (var i = 0; i < count; i++) for (var k = 0; k < 4; k++) ia[i * 4 + k] = a.getComponent(i, k); g.setAttribute(name, new T.BufferAttribute(ia, 4)); return; }
      var arr = new Float32Array(count * n); for (var j = 0; j < count; j++) for (var c = 0; c < n; c++) arr[j * n + c] = a.getComponent(j, c);
      g.setAttribute(name, new T.BufferAttribute(arr, n));
    });
    if (src.index) g.setIndex(new T.BufferAttribute(src.index.array.slice(), 1));
    return g;
  }
  // Drop vertices no triangle uses any more (after trimming hidden body parts).
  function compact(g, indices) {
    var map = new Int32Array(g.attributes.position.count).fill(-1), order = [];
    for (var i = 0; i < indices.length; i++) { var v = indices[i]; if (map[v] < 0) { map[v] = order.length; order.push(v); } }
    var out = new T.BufferGeometry();
    Object.keys(g.attributes).forEach(function (name) {
      var a = g.attributes[name], n = a.itemSize, arr = new a.array.constructor(order.length * n);
      for (var j = 0; j < order.length; j++) for (var k = 0; k < n; k++) arr[j * n + k] = a.array[order[j] * n + k];
      out.setAttribute(name, new T.BufferAttribute(arr, n, a.normalized));
    });
    out.setIndex(indices.map(function (v) { return map[v]; })); g.dispose(); return out;
  }
  function mergeSkinned(list) {
    var total = 0, totalIndex = 0;
    list.forEach(function (g) { if (!g.index) { var n = g.attributes.position.count, id = []; for (var i = 0; i < n; i++) id.push(i); g.setIndex(id); } if (!g.attributes.normal) g.computeVertexNormals(); total += g.attributes.position.count; totalIndex += g.index.count; });
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), si = new Uint16Array(total * 4), sw = new Float32Array(total * 4), kw = new Float32Array(total * 4), index = new Uint32Array(totalIndex), v = 0, k = 0;
    list.forEach(function (g) {
      var P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, KW = g.attributes.kwear, c = P.count;
      for (var i = 0; i < c; i++) {
        var o = v + i; pos[o * 3] = P.getX(i); pos[o * 3 + 1] = P.getY(i); pos[o * 3 + 2] = P.getZ(i); nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
        if (U) { uv[o * 2] = U.getX(i); uv[o * 2 + 1] = U.getY(i); }
        for (var q = 0; q < 4; q++) { si[o * 4 + q] = SI.getComponent(i, q); sw[o * 4 + q] = SW.getComponent(i, q); if (KW) kw[o * 4 + q] = KW.getComponent(i, q); }
      }
      var I = g.index; for (var j = 0; j < I.count; j++) index[k + j] = I.getX(j) + v; v += c; k += I.count; g.dispose();
    });
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    out.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); out.setAttribute('skinWeight', new T.BufferAttribute(sw, 4)); out.setAttribute('kwear', new T.BufferAttribute(kw, 4));
    out.setIndex(new T.BufferAttribute(total > 65535 ? index : new Uint16Array(index), 1)); out.computeBoundingBox(); out.computeBoundingSphere();
    return out;
  }
  // Put a gear piece (parts by material key) into bind space with a matrix and hand it to the assembly.
  function place(A, piece, matrix, attach, scale) {
    Object.keys(piece.parts).forEach(function (key) {
      var list = piece.parts[key]; if (!list.length) return;
      list.forEach(function (q) { if (!q.attributes.kwear) G.wear(q, wearDefaults(key)); });
      var g = G.merge(list); if (scale) g.scale(scale, scale, scale); g.applyMatrix4(matrix);
      if (typeof attach === 'function') attach(key, g); else if (attach && attach.transfer) A.transfer(key, g, attach.keys, attach); else if (attach === 'transfer') A.transfer(key, g); else A.rigid(key, g, attach);
    });
  }
  // Orthonormal frame: +Y along yAxis, +Z as close as possible to zHint.
  function frameAt(origin, yAxis, zHint) {
    var y = yAxis.clone().normalize(), z = (zHint || new T.Vector3(0, 0, 1)).clone(); z.addScaledVector(y, -z.dot(y)); if (z.lengthSq() < 1e-6) z.set(1, 0, 0); z.normalize();
    var x = new T.Vector3().crossVectors(y, z), m = new T.Matrix4().makeBasis(x, y, z); m.setPosition(origin); return m;
  }
  function T4(x, y, z, rx, ry, rz, s) { var m = new T.Matrix4(); m.compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(s || 1, s || 1, s || 1)); return m; }
  // Weapons are ordinary meshes (not skinned) under bones.weapon; one merged mesh per material.
  function weaponGroup(piece) {
    var group = new T.Group(); group.name = 'weapon_art';
    Object.keys(piece.parts).forEach(function (key) {
      var list = piece.parts[key]; if (!list.length) return; list.forEach(function (q) { if (!q.attributes.kwear) G.wear(q, wearDefaults(key)); });
      var mesh = new T.Mesh(G.merge(list), gearMaterial((piece.materialKeys && piece.materialKeys[key]) || key)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = key; group.add(mesh);
    });
    return group;
  }

  // Shrink-wrap a sphere around a vertex cloud (hoods, sacks, helmets); returns radius function by direction.
  function wrapRadius(cloud, center, cone) {
    var dirs = cloud.map(function (p) { var d = p.clone().sub(center), l = d.length(); return { d: d.multiplyScalar(1 / (l || 1)), l: l }; }), cosCone = Math.cos(cone || .35);
    return function (dir) { var best = 0; for (var i = 0; i < dirs.length; i++) { var c = dirs[i].d.dot(dir); if (c > cosCone) best = Math.max(best, dirs[i].l * (.6 + .4 * c)); } return best; };
  }
  // Distance from a centre to the surface of a vertex cloud along a ray (points within eps of the ray).
  function rayRadius(cloud, center, eps, fallback) {
    var rel = cloud.map(function (p) { return p.clone().sub(center); }), e2 = eps * eps, wide = wrapRadius(cloud, center, .5);
    return function (dir) {
      var best = -1; for (var i = 0; i < rel.length; i++) { var q = rel[i], t = q.x * dir.x + q.y * dir.y + q.z * dir.z; if (t <= best) continue; var px = q.x - dir.x * t, py = q.y - dir.y * t, pz = q.z - dir.z * t; if (px * px + py * py + pz * pz < e2) best = t; }
      return best > 0 ? best : (fallback === undefined ? wide(dir) * .85 : fallback);
    };
  }
  // Cylindrical radius field of a cloud around a vertical axis through (cx, cz).
  function radialField(cloud, cx, cz, dy, da) {
    return function (a, y) {
      var best = 0; for (var i = 0; i < cloud.length; i++) {
        var p = cloud[i]; if (Math.abs(p.y - y) > dy) continue;
        var pa = Math.atan2(p.x - cx, p.z - cz), diff = Math.abs(Math.atan2(Math.sin(pa - a), Math.cos(pa - a))); if (diff > da) continue;
        best = Math.max(best, Math.hypot(p.x - cx, p.z - cz) * Math.cos(diff));
      }
      return best;
    };
  }

  // Fitted limb sleeve (vambraces, greaves): a solid shell shrink-wrapped around the flesh of one bone segment.
  // t0..t1 are fractions along from->to; angle 0 is the upper/outer face (world up projected off the bone axis).
  // Returns { geometry, at(angle, t, lift) -> [point, outwardNormal] } in bind space.
  function sleeve(A, from, to, t0, t1, offset, thickness, keys, flare) {
    var a = A.P(from), b = A.P(to), axis = b.clone().sub(a), len = axis.length(); axis.multiplyScalar(1 / len);
    var ey = new T.Vector3(0, 1, 0); if (Math.abs(ey.dot(axis)) > .9) ey.set(1, 0, 0); ey.addScaledVector(axis, -ey.dot(axis)).normalize();
    var ex = new T.Vector3().crossVectors(axis, ey).normalize(), d = new T.Vector3();
    var pts = A.cloud([from], keys, .45).map(function (p) { d.copy(p).sub(a); return { t: d.dot(axis) / len, ang: Math.atan2(d.dot(ex), d.dot(ey)), r: Math.hypot(d.dot(ex), d.dot(ey)) }; });
    var NU = 20, NV = 8, grid = [], fallback = 0;
    pts.forEach(function (p) { if (p.t > t0 && p.t < t1) fallback = Math.max(fallback, p.r * .8); });
    for (var j = 0; j <= NV; j++) {
      grid.push([]); var t = mix(t0, t1, j / NV);
      for (var i = 0; i < NU; i++) {
        var ang = i / NU * TAU, best = 0;
        pts.forEach(function (p) { if (Math.abs(p.t - t) > .09) return; var df = Math.abs(Math.atan2(Math.sin(p.ang - ang), Math.cos(p.ang - ang))); if (df < .5) best = Math.max(best, p.r * Math.cos(df)); });
        grid[j].push(best || fallback || .05);
      }
    }
    for (var pass = 0; pass < 2; pass++) grid = grid.map(function (row, j2) { return row.map(function (r, i2) { var s = 0, n = 0; for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) { var rr = grid[clamp(j2 + dj, 0, NV)]; s += Math.max(rr[(i2 + di + NU) % NU], r * .9); n++; } return s / n; }); });
    function radius(ang, v) {
      var gu = ((ang / TAU) % 1 + 1) % 1 * NU, gv = clamp(v, 0, 1) * NV, i0 = Math.floor(gu) % NU, i1 = (i0 + 1) % NU, j0 = Math.min(NV - 1, Math.floor(gv)), fu = gu - Math.floor(gu), fv = gv - j0;
      return mix(mix(grid[j0][i0], grid[j0][i1], fu), mix(grid[j0 + 1][i0], grid[j0 + 1][i1], fu), fv);
    }
    function at(ang, v, lift) {
      var r = radius(ang, v) + offset + (flare || 0) * Math.pow(Math.max(0, 1 - v * 3), 2) + (lift || 0), n = ey.clone().multiplyScalar(Math.cos(ang)).addScaledVector(ex, Math.sin(ang));
      return [a.clone().addScaledVector(axis, mix(t0, t1, v) * len).addScaledVector(n, r), n];
    }
    var g = G.shell(NU * 2, NV * 2, function (u, v) { var p = at(u * TAU, v)[0]; return [p.x, p.y, p.z]; }, thickness, true);
    return { geometry: g, at: function (ang, t, lift) { return at(ang, (t - t0) / (t1 - t0), lift); } };
  }

  // ---------------------------------------------------------------- recipes
  var R = {};
  var EXEC_TORSO = ['pelvis', 'spine01', 'spine02', 'spine03', 'neck', 'head', 'shoulderL', 'shoulderR'], UBC_TORSO = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r'];
  function V3(x, y, z) { return Array.isArray(x) ? new T.Vector3(x[0], x[1], x[2]) : x && x.isVector3 ? x.clone() : new T.Vector3(x, y, z); }
  // Nearest body surface point and its normal (optionally only parts with the given keys).
  function surf(A, p, keys) { var s = A.nearest(V3(p), keys); return s ? { p: new T.Vector3(s.x, s.y, s.z), n: new T.Vector3(s.nx, s.ny, s.nz).normalize() } : { p: V3(p), n: new T.Vector3(0, 0, 1) }; }
  // Scar segments: probe polylines projected onto the skin. line = { pts: [[x,y,z]...], w: width, stitch: bool }.
  function scarLines(A, lines, keys) { var out = []; lines.forEach(function (l) { var pts = l.pts.map(function (q) { return surf(A, q, keys).p; }); for (var i = 0; i < pts.length - 1; i++) out.push([pts[i], pts[i + 1], l.w || .004, !!l.stitch]); }); return out; }
  // Frame on the body surface: +Z along the surface normal, +Y toward up (projected), origin lifted off the skin.
  function onBody(A, p, keys, up, lift) {
    var s = surf(A, p, keys), z = s.n.clone(), y = (up || new T.Vector3(0, 1, 0)).clone(); y.addScaledVector(z, -y.dot(z)); if (y.lengthSq() < 1e-6) y.set(0, 0, 1); y.normalize();
    var m = new T.Matrix4().makeBasis(new T.Vector3().crossVectors(y, z), y, z); m.setPosition(s.p.addScaledVector(z, lift || 0)); return m;
  }
  function frameFrom(origin, y, z) { y = y.clone().normalize(); z = z.clone(); z.addScaledVector(y, -z.dot(y)).normalize(); var m = new T.Matrix4().makeBasis(new T.Vector3().crossVectors(y, z), y, z); m.setPosition(origin); return m; }
  function flipV(g) { var uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return g; }
  // Closed loop around the body at height y: ring of points on a radial field (belts, collars, rope girdles).
  function loop(field, cx, cz, y, off, n, wobble) { var pts = []; for (var i = 0; i < n; i++) { var a = i / n * TAU, r = field(a, y) + off, yy = y + (wobble ? wobble(a) : 0); pts.push([cx + Math.sin(a) * r, yy, cz + Math.cos(a) * r]); } pts.push(pts[0].slice()); return pts; }
  function loopNormals(pts, cx, cz) { return pts.map(function (p) { return new T.Vector3(p[0] - cx, 0, p[2] - cz).normalize(); }); }
  // Hanging cloth weights: pelvis at the top, blending smoothly into both thighs lower down (no seam at the centre).
  function clothWeights(A, pelvis, thighL, thighR, yTop, yBottom, share, spine) {
    return function (v) { var t = smooth(yTop, yBottom, v.y) * (share || .6), side = smooth(-.09, .09, v.x), up = spine && v.y > yTop ? Math.min(1, (v.y - yTop) / .1) * .5 : 0; var out = [[A.index[pelvis], 1 - t - up], [A.index[thighL], t * side], [A.index[thighR], t * (1 - side)]]; if (up) out.push([A.index[spine], up]); return out.filter(function (e) { return e[1] > 0; }); };
  }
  function glossy(g, w) { var kw = g.attributes.kwear; if (!kw) G.wear(g, {}); kw = g.attributes.kwear; for (var i = 0; i < kw.count; i++) kw.setW(i, w); return g; }
  function paintAll(g, z) { var kw = g.attributes.kwear; if (!kw) { G.wear(g, {}); kw = g.attributes.kwear; } for (var i = 0; i < kw.count; i++) kw.setZ(i, Math.max(kw.getZ(i), typeof z === 'function' ? z(V3(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i))) : z)); return g; }
  // Executioner atlas: the eyeballs sit in one UV rectangle; mark them glossy (wet eyes that catch the light).
  function execEyes(part) { var uv = part.geometry.attributes.uv, kw = part.geometry.attributes.kwear; for (var i = 0; i < uv.count; i++) { var u = uv.getX(i), v = uv.getY(i); if (u > .725 && u < .805 && v > .615 && v < .665) kw.setW(i, 1); } }
  function skullPiece(A, size, m, attach, jaw, voidKey) {
    var sk = G.skull(size, jaw); if (voidKey) { sk.parts[voidKey] = sk.parts.void; delete sk.parts.void; }
    place(A, sk, m, attach);
  }

  // Baba's eyes: a warm dark-brown iris with a visible pupil and limbal ring on off-white, edge-darkened sclera (the stock
  // atlas eyes are teal with a white glare). The eye mesh is a shallow dome; its UVs are re-projected onto this texture.
  var eyeMap = null;
  function eyeTexture() {
    if (eyeMap) return eyeMap;
    var S = 256, c = document.createElement('canvas'); c.width = c.height = S; var g = c.getContext('2d'), i, a, r0, r1;
    var sc = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * .62); sc.addColorStop(0, '#a99a89'); sc.addColorStop(.55, '#8c7868'); sc.addColorStop(1, '#4e3a32');
    g.fillStyle = sc; g.fillRect(0, 0, S, S);
    for (i = 0; i < 26; i++) { a = G.hash(i, 1, 5) * TAU; r0 = 70 + G.hash(i, 2, 5) * 20; g.strokeStyle = 'rgba(150,70,60,' + (.1 + G.hash(i, 3, 5) * .12) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); g.lineTo(S / 2 + Math.cos(a + .1) * (r0 + 38), S / 2 + Math.sin(a + .1) * (r0 + 38)); g.stroke(); }
    var R = 58, ir = g.createRadialGradient(S / 2, S / 2, 18, S / 2, S / 2, R); ir.addColorStop(0, '#54371c'); ir.addColorStop(.45, '#3a220e'); ir.addColorStop(1, '#140a04');
    g.fillStyle = ir; g.beginPath(); g.arc(S / 2, S / 2, R, 0, TAU); g.fill();
    for (i = 0; i < 110; i++) { a = G.hash(i, 4, 5) * TAU; r0 = 17 + G.hash(i, 5, 5) * 8; r1 = r0 + 14 + G.hash(i, 6, 5) * 20; g.strokeStyle = G.hash(i, 7, 5) < .5 ? 'rgba(20,9,3,.4)' : 'rgba(130,90,50,.2)'; g.lineWidth = 1 + G.hash(i, 8, 5); g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); g.lineTo(S / 2 + Math.cos(a) * Math.min(r1, R - 2), S / 2 + Math.sin(a) * Math.min(r1, R - 2)); g.stroke(); }
    g.strokeStyle = 'rgba(15,8,4,.85)'; g.lineWidth = 6; g.beginPath(); g.arc(S / 2, S / 2, R - 1, 0, TAU); g.stroke();
    g.fillStyle = '#060403'; g.beginPath(); g.arc(S / 2, S / 2, 19, 0, TAU); g.fill();
    eyeMap = new T.CanvasTexture(c); eyeMap.colorSpace = T.SRGBColorSpace; eyeMap.anisotropy = 4; return eyeMap;
  }
  // Re-project the eye dome onto eyeTexture (planar, iris at the dome axis), then shrink each eye about its centre and
  // sink it a little: the lids frame it instead of a bulging ball (heavy upper lid, smaller whites).
  function heroEyes(g) {
    var p = g.attributes.position, uv = g.attributes.uv, c = [new T.Vector3(), new T.Vector3()], n = [0, 0], v = new T.Vector3(), R = [0, 0], i, s;
    for (i = 0; i < p.count; i++) { s = p.getX(i) < 0 ? 0 : 1; c[s].add(v.fromBufferAttribute(p, i)); n[s]++; }
    for (s = 0; s < 2; s++) if (n[s]) c[s].multiplyScalar(1 / n[s]);
    for (i = 0; i < p.count; i++) { s = p.getX(i) < 0 ? 0 : 1; R[s] = Math.max(R[s], Math.hypot(p.getX(i) - c[s].x, p.getY(i) - c[s].y)); }
    for (i = 0; i < p.count; i++) {
      s = p.getX(i) < 0 ? 0 : 1; v.fromBufferAttribute(p, i).sub(c[s]);
      uv.setXY(i, .5 + v.x / (2 * R[s]), .5 + v.y / (2 * R[s]));
      v.multiplyScalar(.92).add(c[s]); p.setXYZ(i, v.x, v.y + .0006, v.z - .0012);
    }
    p.needsUpdate = true; uv.needsUpdate = true;
  }
  // Wider-open eyes: the stock lids are narrow slits. Grow the lid ring (skin within 3 cm) and the eyeball together, in the face plane,
  // about each eye centre; k = 0.22 is 22 % at the eye, fading out over the surrounding skin.
  function openEyes(skin, eyes, k) {
    var K = 1.2965, ep = eyes.attributes.position, sp = skin.attributes.position, c = [new T.Vector3(), new T.Vector3()], n = [0, 0], i, s, dx, dy, f;
    for (i = 0; i < ep.count; i++) { s = ep.getX(i) < 0 ? 0 : 1; c[s].x += ep.getX(i); c[s].y += ep.getY(i); n[s]++; }
    for (s = 0; s < 2; s++) { c[s].x /= n[s]; c[s].y /= n[s]; }
    for (i = 0; i < ep.count; i++) { s = ep.getX(i) < 0 ? 0 : 1; ep.setXY(i, c[s].x + (ep.getX(i) - c[s].x) * (1 + k), c[s].y + (ep.getY(i) - c[s].y) * (1 + k)); }
    for (i = 0; i < sp.count; i++) {
      if (sp.getZ(i) * K < .03 || sp.getY(i) * K < 2.19 || sp.getY(i) * K > 2.32) continue;
      s = sp.getX(i) < 0 ? 0 : 1; dx = sp.getX(i) - c[s].x; dy = sp.getY(i) - c[s].y;
      f = k * (1 - smooth(.009, .032, Math.hypot(dx, dy) * K)); if (f > 0) sp.setXY(i, c[s].x + dx * (1 + f), c[s].y + dy * (1 + f));
    }
    sp.needsUpdate = true; ep.needsUpdate = true;
  }
  // Eyebrows: one arched strip per brow on the brow ridge (rigid on the head bone), textured with a procedural brow: a solid dark
  // body with a ragged edge and strokes that grow up and out at the inner end, along the arch, then down toward the tail.
  var browMap = null;
  function browTexture() {
    if (browMap) return browMap;
    var W = 512, H = 128, c = document.createElement('canvas'), g, px, d, i, x, y;
    c.width = W; c.height = H; g = c.getContext('2d'); px = g.createImageData(W, H); d = px.data;
    function half(u) { return .33 * smooth(-.02, .07, u) * (1 - .9 * Math.pow(smooth(.5, 1, u), 1.15)) + .02; }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var u = x / (W - 1), v = 1 - y / (H - 1), k = (y * W + x) * 4;
      d[k] = 34; d[k + 1] = 24; d[k + 2] = 18; d[k + 3] = 255 * smooth(-.04, .07, half(u) - Math.abs(v - .5) + (G.hash(x, y, 3) - .5) * .07);
    }
    g.putImageData(px, 0, 0); g.lineCap = 'round';
    for (i = 0; i < 1100; i++) {
      var u0 = G.hash(i, 1, 8), h0 = half(u0), v0 = .5 + (G.hash(i, 2, 8) - .5) * 1.9 * h0, a = mix(1.05, -.3, Math.pow(u0, .8)) + (G.hash(i, 3, 8) - .5) * .5,
        len = (36 + G.hash(i, 4, 8) * 40) * mix(1, .55, smooth(.6, 1, u0)), x0 = u0 * (W - 1), y0 = (1 - v0) * (H - 1), dx = Math.cos(a), dy = -Math.sin(a), r = G.hash(i, 5, 8);
      len = Math.min(len, dy < 0 ? (y0 - 3) / -dy : (H - 3 - y0) / (dy || 1e-6), dx > 0 ? (W - 3 - x0) / dx : 1e6);
      g.strokeStyle = r < .06 ? 'rgba(125,116,106,.95)' : r < .3 ? 'rgba(66,48,34,.88)' : r < .42 ? 'rgba(12,9,7,.95)' : 'rgba(32,22,16,.9)'; g.lineWidth = 1.6 + G.hash(i, 6, 8) * 1.6;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + dx * len * .5 - dy * len * .12, y0 + dy * len * .5 + dx * len * .12, x0 + dx * len, y0 + dy * len); g.stroke();
    }
    browMap = new T.CanvasTexture(c); browMap.colorSpace = T.SRGBColorSpace; browMap.anisotropy = 4; return browMap;
  }
  // Exact height of the frontmost head skin at (x, y) in the finished hero's frame (ray straight back from the front).
  function skinHeight(A) {
    var K = 1.2965, tris = [];
    A.parts.forEach(function (part) {
      if (part.key !== 'skin') return;
      var p = part.geometry.attributes.position, ix = part.geometry.index.array;
      for (var t = 0; t < ix.length; t += 3) {
        var q = [0, 1, 2].map(function (k) { return [p.getX(ix[t + k]) * K, p.getY(ix[t + k]) * K, p.getZ(ix[t + k]) * K]; });
        if (q.every(function (v) { return v[1] > 2.16 && v[1] < 2.42 && Math.abs(v[0]) < .16 && v[2] > .03; })) tris.push(q);
      }
    });
    return function (x, y) {
      var best = -1;
      tris.forEach(function (q) {
        var d = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]), a = ((q[1][1] - q[2][1]) * (x - q[2][0]) + (q[2][0] - q[1][0]) * (y - q[2][1])) / d, b = ((q[2][1] - q[0][1]) * (x - q[2][0]) + (q[0][0] - q[2][0]) * (y - q[2][1])) / d;
        if (a >= 0 && b >= 0 && a + b <= 1) best = Math.max(best, a * q[0][2] + b * q[1][2] + (1 - a - b) * q[2][2]);
      });
      return best;
    };
  }
  function browHair(A) {
    var K = 1.2965, zAt = skinHeight(A), out = [];
    // centre line of the arch (metres): inner end above the tear duct, peak two thirds out, tail dropping toward the temple
    var ARCH = [[.014, 2.271], [.026, 2.2755], [.04, 2.28], [.054, 2.2825], [.066, 2.2805], [.07, 2.2765], [.077, 2.269]], HH = .017, LIFT = .0014;
    function at(t) { var f = t * (ARCH.length - 1), i = Math.min(ARCH.length - 2, Math.floor(f)), k = f - i; return [mix(ARCH[i][0], ARCH[i + 1][0], k), mix(ARCH[i][1], ARCH[i + 1][1], k), ARCH[i + 1][0] - ARCH[i][0], ARCH[i + 1][1] - ARCH[i][1]]; }
    [-1, 1].forEach(function (sd) {
      out.push(G.sheet(28, 4, function (u, v) {
        var q = at(u), l = Math.hypot(q[2], q[3]), x = q[0] - q[3] / l * (v - .5) * HH, y = q[1] + q[2] / l * (v - .5) * HH;
        return [sd * x / K, y / K, (Math.max(zAt(sd * x, y), .09) + LIFT) / K];
      }, false, sd > 0));
    });
    return G.merge(out);
  }
  // The beard mass: a rounded shell hanging from the cheek line around the jaw and chin, ending in a soft dithered edge; its
  // strands and its grey come from the material (KARA_MASS). Radii follow the skin (metres of the finished hero, axis z -.02).
  function beardMass(A) {
    var K = 1.2965, CZ = -.02, NA = 52, NY = 18, A0 = 1.55, cols = [], i;
    var pts = A.cloud(null, ['skin']).map(function (p) { return p.clone().multiplyScalar(K); }).filter(function (p) { return p.y > 2 && p.y < 2.4 && Math.abs(p.x) < .2; });
    var rf = radialField(pts, 0, CZ, .012, .12);
    for (i = 0; i <= NA; i++) {
      var a = (i / NA * 2 - 1) * A0, aa = Math.abs(a), yj = 2.12 + .06 * smooth(.2, 1.2, aa), rj = Math.max(rf(a, yj), rf(a, yj + .01), rf(a, yj - .01)) || .1, rn = rf(a, 2.03) || .085;
      cols.push({ a: a, yj: yj, rj: rj, rn: rn, yb: 2.05 + .11 * Math.pow(smooth(0, 1.2, aa), 1.3), d: .006 + .011 * (1 - smooth(0, .9, aa)) });
    }
    return G.sheet(NA, NY, function (u, v) {
      var c = cols[Math.round(u * NA)], top = 2.192 + Math.max(Math.abs(Math.sin(c.a)) * c.rj - .05, 0) * .75, y = mix(top, c.yb, v), r;
      if (y >= c.yj) r = (rf(c.a, y) || c.rj) + c.d;
      else { var s = (c.yj - y) / (c.yj - c.yb); r = mix(c.rn + .006, c.rj + c.d, Math.pow(Math.max(0, 1 - Math.pow(s, 2.4)), 1 / 2.4)); }
      return [r * Math.sin(c.a) / K, y / K, (CZ + r * Math.cos(c.a)) / K];
    }, false);
  }
  // The imported beard is a straight curtain that hangs 6 cm in front of the chin and the moustache is centred on the nose.
  // Re-fit both in place (bind pose, all weights stay on the head bone) to the face; numbers are metres of the finished
  // 2.38 m hero (the base scene is ~1.2965x smaller, K): moustache squashed onto the upper lip below the nose, beard bent
  // back around the chin, shortened, rounded and lifted along the jaw line. The cards are only the fringe of the beard now.
  function fitBeard(A, beard, moustache) {
    var K = 1.2965, TABLE = [[2.19, 0], [2.18, .002], [2.15, .010], [2.13, .016], [2.11, .025], [2.097, .036], [2.08, .052], [2.06, .07], [2.03, .088], [1.9, .12]];
    function setback(y) { for (var i = 0; i < TABLE.length - 1; i++) { var a = TABLE[i], b = TABLE[i + 1]; if (y <= a[0] && y >= b[0]) return mix(a[1], b[1], (a[0] - y) / (a[0] - b[0])); } return y > 2.19 ? 0 : .12; }
    beard.forEach(function (part) {
      var p = part.geometry.attributes.position;
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i) * K, y = p.getY(i) * K, z = p.getZ(i) * K;
        if (y > 2.19) y = 2.19 + (y - 2.19) * .45;                                 // sideburns end at the middle of the ear
        y += .022 * smooth(.05, .1, Math.abs(x)) * smooth(2.1, 2.19, y);                     // cheek line climbs diagonally to the sideburn
        var front = smooth(.085, .125, z), depth = Math.max(0, 2.1 - y), t = Math.min(1, depth / .067);
        z -= setback(y) * front;                                                    // bend the front cards back around the chin
        x *= 1 + .8 * Math.pow(t, 1.4) * front;                                     // round the bottom instead of a spike
        if (y < 2.1) y = 2.1 - depth * .68;                                         // shorter
        y += 6 * x * x * smooth(2.22, 2.1, y);                                          // outline rises along the jaw
        p.setXYZ(i, x / K, y / K, z / K);
      }
      p.needsUpdate = true; part.geometry.computeBoundingBox(); part.geometry.computeBoundingSphere();
    });
    moustache.forEach(function (part) {
      var p = part.geometry.attributes.position;
      for (var i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * .85, (2.18 + (p.getY(i) * K - 2.2125) * .98) / K, (.142 + (p.getZ(i) * K - .167) * .7) / K);
      p.needsUpdate = true; part.geometry.computeBoundingBox(); part.geometry.computeBoundingSphere();
      A.trim(part, function (a, b, c) { return Math.max(Math.abs(a.p.x), Math.abs(b.p.x), Math.abs(c.p.x)) * K < .075; });   // no stray side strands
    });
    // beardMass carries the cheeks and sideburns: keep only the hanging lower part of the strand cards as a fringe
    beard.forEach(function (part) { A.trim(part, function (a, b, c) { return (a.p.y + b.p.y + c.p.y) / 3 * K < 2.16; }); });
    // fuller: a second, slightly wider copy of the fringe with mirrored strands (the moustache stays a single, smaller mesh than the iron:
    // the attacker rim glow in telegraphs.js picks the two largest meshes)
    beard.forEach(function (part) {
      var g = part.geometry.clone(), p = g.attributes.position, uv = g.attributes.uv, i;
      for (i = 0; i < p.count; i++) { p.setXYZ(i, p.getX(i) * 1.09, p.getY(i) - .0035 / K, p.getZ(i) + .003 / K); uv.setX(i, 1 - uv.getX(i)); }
      A.parts.push({ geometry: g, key: part.key, body: true, name: part.name + '2' });
    });
  }

  // Baba — the father-warrior: thecubber barbarian with a shaggy fur mantle (tufts, iron brooches), healed scars,
  // a hip pouch and a bone charm on a thong, a torn red war sash, forged cleaver greatsword with engraved runes.
  R.hero = function (A) {
    var base = bases.barbarian;
    var body = A.addFrom(base, function (n) { return /LOW_body/.test(n.name); }, 'skin')[0];
    var eyes = A.addFrom(base, function (n) { return /LOW_eyes/.test(n.name); }, 'eye');
    openEyes(body.geometry, eyes[0].geometry, .22); eyes.forEach(function (p) { heroEyes(p.geometry); });
    A.addFrom(base, function (n) { return /LOW_(cloth|leather)/.test(n.name); }, 'leather');
    A.addFrom(base, function (n) { return /LOW_metal/.test(n.name); }, 'iron');
    fitBeard(A, A.addFrom(base, function (n) { return /Beard/.test(n.name); }, 'beard'), A.addFrom(base, function (n) { return /Moustache/.test(n.name); }, 'moustache'));
    A.rigid('brow', browHair(A), 'head'); A.rigid('beardmass', beardMass(A), 'head');
    A.parts.slice(-2).forEach(function (part) { part.body = true; });   // hair like the imported beard: no contact shadow on the skin under it
    // Heavier build: thicker neck/traps/forearms; the father should read broad from above.
    A.slim(body, { spine03: 1.06, neck: 1.1, upper_armL: 1.05, upper_armR: 1.05, forearmL: 1.08, forearmR: 1.08 }, 1);
    var BODY = ['skin', 'iron', 'leather'];
    // Fur mantle shrink-wrapped over the shoulders and upper back, shaggy hem and a rolled collar.
    var cloud = A.cloud(['spine03', 'spine02', 'shoulderL', 'shoulderR', 'neck'], BODY, .3).filter(function (p) { return p.y > 1.1 && p.y < 1.62; });
    var c = A.P('spine03').clone(); c.y += .03; c.z += .06;
    var ray = rayRadius(cloud, c, .035), dir = new T.Vector3(), NU = 44, NV = 14, grid = [];
    function angles(u, v) { var az = mix(-2.3, 2.3, u) + PI, front = Math.max(0, Math.cos(az)); var elBottom = mix(-.9, -.32, Math.pow(1 - Math.max(0, -Math.cos(az)), 1.3)) + .12 * front + (G.fbm(u * 9, 1, 1) - .5) * .12, elTop = 1.05 - .2 * front; return [az, mix(elBottom, elTop, v)]; }
    for (var gj = 0; gj <= NV; gj++) { grid.push([]); for (var gi = 0; gi <= NU; gi++) { var an = angles(gi / NU, gj / NV); dir.set(Math.cos(an[1]) * Math.sin(an[0]), Math.sin(an[1]), Math.cos(an[1]) * Math.cos(an[0])); grid[gj].push(ray(dir)); } }
    for (var pass = 0; pass < 3; pass++) { var next = grid.map(function (row) { return row.slice(); }); for (gj = 0; gj <= NV; gj++) for (gi = 0; gi <= NU; gi++) { var sum = 0, n = 0; for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) { var rj = gj + dj, ri = gi + di; if (rj < 0 || rj > NV || ri < 0 || ri > NU) continue; sum += Math.max(grid[rj][ri], grid[gj][gi] * (dj || di ? .92 : 1)); n++; } next[gj][gi] = sum / n; } grid = next; }
    function mantlePoint(u, v, extra) {
      var an = angles(u, v), gi2 = u * NU, gj2 = v * NV, i0 = Math.min(NU - 1, Math.floor(gi2)), j0 = Math.min(NV - 1, Math.floor(gj2)), fu = gi2 - i0, fv = gj2 - j0;
      var b0 = mix(mix(grid[j0][i0], grid[j0][i0 + 1], fu), mix(grid[j0 + 1][i0], grid[j0 + 1][i0 + 1], fu), fv);
      dir.set(Math.cos(an[1]) * Math.sin(an[0]), Math.sin(an[1]), Math.cos(an[1]) * Math.cos(an[0]));
      var r = b0 + .03 + .014 * (1 - v) + (extra || 0) + .014 * (G.fbm(u * 18, v * 5, 2) - .5) + .01 * (G.fbm(u * 40, v * 12, 5) - .5);
      return [c.x + dir.x * r, c.y + dir.y * r, c.z + dir.z * r];
    }
    var mantle = G.shell(44, 14, mantlePoint, .022, false);
    G.uvScale(mantle, 3.2, 1.6); A.transfer('fur', mantle, BODY);
    // strands: hem fringe, clumped tufts over the pelt (downhill), a spiky ruff at the collar — all alpha cards
    var fringe = flipV(G.sheet(60, 2, function (u, v) { var p = mantlePoint(u, 0, .004), len = .1 + .09 * G.fbm(u * 23, 4, 4); return [p[0], p[1] - v * len, p[2] + v * len * .12 * Math.sign(p[2] - c.z)]; }, false));
    var tufts = [fringe], down = new T.Vector3(0, -1, 0);
    function tuftAt(p, hang, out, len, width, seed) { var g = G.tuft(len, width, .35, seed); flipV(g); g.applyMatrix4(frameFrom(p, hang.clone().negate(), out)); tufts.push(g); }
    for (var i = 0; i < 46; i++) {
      var u = .03 + G.hash(i, 1, 9) * .94, v = .1 + G.hash(i, 2, 9) * .85, p = V3(mantlePoint(u, v, .004)), below = V3(mantlePoint(u, Math.max(0, v - .12), .004)).sub(p).normalize(), out = p.clone().sub(c).normalize();
      tuftAt(p, below.lerp(down, .25).normalize(), out, .07 + G.hash(i, 3, 9) * .06, .05 + G.hash(i, 4, 9) * .035, i);
    }
    for (i = 0; i < 26; i++) { var uh = (i + .5) / 26, ph = V3(mantlePoint(uh, .02, .002)), oh = ph.clone().sub(c).normalize(); tuftAt(ph, down.clone().lerp(oh, .25).normalize(), oh, .1 + G.hash(i, 5, 9) * .09, .06, 60 + i); }
    for (i = 0; i < 16; i++) { var uc = .09 + i / 15 * .82, pc = V3(mantlePoint(uc, 1, .02)), oc = pc.clone().sub(c).normalize(); tuftAt(pc, new T.Vector3(0, -.35, 0).add(oc.clone().multiplyScalar(1)).normalize(), new T.Vector3(0, 1, 0), .05 + G.hash(i, 6, 9) * .035, .045, 90 + i); }
    A.transfer('furfringe', G.merge(tufts), BODY);
    var ring = []; for (i = 0; i <= 30; i++) ring.push(mantlePoint(.08 + i / 30 * .84, 1, -.004));
    var collar = G.tube(ring, function (t) { return .03 + .008 * Math.sin(t * 40) + .004 * Math.sin(t * 97); }, 9, 70, true); G.uvScale(collar, 1, .25);
    A.transfer('fur', collar, BODY);
    // iron brooches pinning the mantle's front corners (domed, studded rim)
    [.03, .97].forEach(function (ub, k) {
      var pb = V3(mantlePoint(ub, .74, .014)), nb = pb.clone().sub(c).normalize(), st = [G.lathe([[0, .013], [.022, .012], [.034, .007], [.04, .002], [.038, -.004], [0, -.004]], 16), G.sphere(.009, [0, .014, 0], [1, .6, 1], 8, 6)];
      for (var q = 0; q < 8; q++) { var a = q / 8 * TAU; st.push(G.stud(.0045, [Math.cos(a) * .031, .008, Math.sin(a) * .031], [Math.cos(a) * .3, 1, Math.sin(a) * .3])); }
      var g = G.merge(st); G.orient(g, pb, nb, k * .4); A.transfer('dark', g, BODY, { pin: true });
    });
    // hip pouch (right), hanging from the belt with a strap loop and an iron toggle
    var pm = onBody(A, [-.205, 1.0, .035], ['leather', 'iron', 'skin'], null, .004);
    function rrect(w, h, r) { var pts = []; [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI], [w / 2 - r, -h / 2 + r, PI * 1.5]].forEach(function (c2) { for (var k = 0; k <= 4; k++) { var a = c2[2] + k / 4 * PI / 2; pts.push([c2[0] + Math.cos(a) * r, c2[1] + Math.sin(a) * r]); } }); return pts; }
    var pouch = G.extrude(rrect(.085, .1, .02), .038, .006); pouch.translate(0, -.06, .022);
    var flap = G.extrude(rrect(.089, .05, .012), .007, .002); flap.translate(0, -.03, .045); flap.rotateX(-.08);
    var loopS = G.box(.03, .05, .006, [0, .005, .006]);
    place(A, { parts: { strap: [pouch, flap, loopS], dark: [G.stud(.008, [0, -.05, .049], [0, 0, 1], .9), G.buckle(.022, .02, .0025).translate(0, -.01, .012)] } }, pm, { transfer: true, keys: ['leather', 'iron', 'skin'], pin: true, bones: ['pelvis', 'spine01'] });
    // carved bone charm on a leather thong (left front hip) — something from home
    var cm = onBody(A, [.165, 1.035, .11], ['leather', 'iron', 'skin'], null, .006), thong = G.tube([[0, 0, 0], [.006, -.04, .008], [.002, -.085, .012], [-.004, -.115, .01]], .0028, 5, 16, true);
    var charm = G.merge([G.lathe([[0, .005], [.018, .005], [.022, .002], [.022, -.002], [.018, -.005], [0, -.005]], 16).rotateX(PI / 2).translate(-.004, -.14, .012), G.spike(.006, [-.004, -.162, .012], [-.002, -.2, .016], 6)]);
    place(A, { parts: { strap: [thong], bone: [charm] } }, cm, { transfer: true, keys: ['leather', 'iron', 'skin'], pin: true, bones: ['pelvis'] });
    // torn war sash hanging from the back of the belt (right), following the buttock and thigh
    [[-.085, .5, .13], [-.005, .36, .1]].forEach(function (sd, k) {
      var x0 = sd[0], L = sd[1], W = sd[2];
      var strip = G.sheet(4, 14, function (uu, vv) {
        var y = 1.085 - vv * L, x = x0 + (uu - .5) * W * (1 - vv * .3) + vv * vv * .04 * (k ? -1 : 1), back = A.nearest(new T.Vector3(x, y, -.35), ['skin', 'leather']);
        var z = (back ? back.z : -.16) - .02 - vv * .02 + (G.fbm(uu * 4, vv * 5, k) - .5) * .014 + Math.sin(uu * PI * 2 + vv * 2) * .006;
        return [x, y, z];
      }, false, true);
      A.weighted('tabard', strip, clothWeights(A, 'pelvis', 'thighL', 'thighR', 1.02, .6, .65));
    });
    var scars = scarLines(A, [
      { pts: [[.058, 1.81, .08], [.047, 1.764, .1], [.052, 1.735, .1], [.066, 1.7, .09]], w: .0036 },
      { pts: [[-.01, 1.838, .02], [-.06, 1.82, -.05], [-.09, 1.78, -.11]], w: .005 },
      { pts: [[.2, 1.47, .1], [.11, 1.37, .14]], w: .005 },
      { pts: [[-.29, 1.37, .03], [-.32, 1.29, .02]], w: .0045 }
    ], ['skin']);
    return { weapon: G.cleaver(), materials: {
      skin: bodyMaterial(A.srcMaterial('LOW_body'), 'hero-skin', { cls: 'skin', skin: 1, skinMap: true, sat: .62, tint: [.94, .86, .74], contrast: 1.06, grime: .3, blood: .18, scars: scars, face: true }),
      brow: library['hero-brow'] || (library['hero-brow'] = Object.assign(std({ map: browTexture(), alphaTest: .4, roughness: .8, side: T.DoubleSide }, { sat: 1 }), { name: 'kara-hero-brow' })),
      eye: library['hero-eye'] || (library['hero-eye'] = Object.assign(new T.MeshPhysicalMaterial({ map: eyeTexture(), roughness: .4, clearcoat: .6, clearcoatRoughness: .18 }), { name: 'kara-hero-eye' })),
      leather: bodyMaterial(A.srcMaterial('LOW_cloth'), 'hero-leather', { cls: 'leather', sat: .8, tint: [1.25, 1.12, 1.0], grime: .3, blood: .12 }),
      // the painted iron atlas is busy; keep its relief (normal/AO) with a controlled forged-steel value
      iron: bodyMaterial(A.srcMaterial('LOW_metal_shoulder'), 'hero-iron', { cls: 'metal', sat: 1, tint: [1, 1, 1], blood: .14, grime: .35, rust: .08 }, { map: null, color: new T.Color().setRGB(.15, .152, .16), metalness: .78, roughness: .5 }),
      // salt and pepper: dark brown at the moustache and upper cheeks, greying toward the chin and under the jaw (see kGrey)
      beard: bodyMaterial(A.srcMaterial('Beard'), 'hero-beard', { sat: 1, tint: 0xffffff, hair: [.05, 1.1, 600, .8] }, { color: new T.Color(0xb4a494) }),
      beardmass: library['hero-beardmass'] || (library['hero-beardmass'] = Object.assign(std({ color: 0x3a2c22, roughness: .92, side: T.DoubleSide }, { hair: [.2, 1, 600, 1], mass: true }), { name: 'kara-hero-beardmass' })),
      moustache: bodyMaterial(A.srcMaterial('Moustache'), 'hero-moustache', { sat: 1, hair: [-.25, 1.1, 600, .7] }, { color: new T.Color(0xa09080) })
    } };
  };
  // Zincirli Mahkûm — starved, hooded in a stitched, bloodied sack (eyes glinting in the holes), fresh lash wounds on
  // the back, torn trousers, riveted iron collar with a padlock and hanging chain, shackles with a live chain, rope belt.
  R.prisoner = function (A) {
    var body = A.addFrom(bases.ubc, function () { return true; }, 'skin')[0];
    var legs = A.addFrom(bases.peasant, function (n) { return /Legs/.test(n.name); }, 'trousers')[0];
    A.trim(legs, function (a, b, c) { function low(r) { return r.p.y < .60 + (G.fbm(r.p.x * 30, r.p.z * 30, 1) - .5) * .16; } return !(low(a) && low(b) && low(c)); });
    A.lengthen({ Head: 1.08, neck_01: 1.0 });
    var thin = { spine_01: .74, spine_02: .78, spine_03: .86, neck_01: .8, clavicle_l: .9, clavicle_r: .9, upperarm_l: .68, upperarm_r: .68, lowerarm_l: .72, lowerarm_r: .72, hand_l: .9, hand_r: .9, thigh_l: .74, thigh_r: .74, calf_l: .76, calf_r: .76, pelvis: .86 };
    A.slim(body, thin, 1); A.slim(legs, { thigh_l: .84, thigh_r: .84, calf_l: .86, calf_r: .86, pelvis: .92, spine_01: .9 }, 1);
    G.wear(legs.geometry, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .85, width: .07, bottom: .3, base: .05 } });
    sackHood(A, 'Head');
    shackles(A, 'lowerarm_l', 'hand_l'); shackles(A, 'lowerarm_r', 'hand_r');
    // riveted collar band with a hinge and a padlock
    var neck = A.P('neck_01'), nc = A.cloud(['neck_01'], ['skin'], .5), nf = radialField(nc, neck.x, neck.z, .03, .4), cy = neck.y - .015;
    var cpts = loop(nf, neck.x, neck.z + .005, cy, .012, 20, function (a) { return -.018 * Math.cos(a); });
    A.rigid('dark', G.band(cpts, .034, .01, loopNormals(cpts, neck.x, neck.z), { closed: true }), 'neck_01');
    var cst = []; cpts.slice(0, 20).forEach(function (q, i) { if (i % 2) return; var nn = new T.Vector3(q[0] - neck.x, 0, q[2] - neck.z).normalize(); cst.push(G.stud(.0045, [q[0] + nn.x * .01, q[1] + .009, q[2] + nn.z * .01], nn), G.stud(.0045, [q[0] + nn.x * .01, q[1] - .009, q[2] + nn.z * .01], nn)); });
    var front = V3(cpts[0]).add(new T.Vector3(0, 0, .012));
    cst.push(G.box(.028, .034, .013, [front.x, front.y - .045, front.z + .004]), G.ring(.011, .003, [front.x, front.y - .02, front.z + .004], [PI / 2, 0, 0], 5, 12));
    A.rigid('iron', G.merge(cst), 'neck_01');
    var hang = G.chain([[0, neck.y - .02, neck.z - .1], [.02, neck.y - .18, neck.z - .16], [-.01, neck.y - .38, neck.z - .15], [.02, neck.y - .56, neck.z - .12]], .045);
    A.transfer('dark', hang, null, { bones: UBC_TORSO });
    // rope belt, knotted at the front with frayed hanging ends
    var pel = A.P('pelvis'), hc = A.cloud(['pelvis', 'spine_01', 'thigh_l', 'thigh_r'], ['trousers'], .3), hf = radialField(hc.length ? hc : A.cloud(['pelvis'], null, .3), 0, pel.z, .03, .3);
    var rp = loop(hf, 0, pel.z, 1.0, .008, 26, function (a) { return .012 * Math.sin(a * 2); });
    var knot = V3(rp[0]); A.transfer('rope', G.merge([G.rope(rp, .009, 3, .06), G.blob(.017, [knot.x + .01, knot.y, knot.z + .008], [1.3, 1, .9], .4, 3, 10), G.rope([[knot.x + .012, knot.y - .01, knot.z + .012], [knot.x + .02, knot.y - .08, knot.z + .02], [knot.x + .015, knot.y - .16, knot.z + .018]], .008, 3, .05), G.rope([[knot.x, knot.y - .01, knot.z + .014], [knot.x - .012, knot.y - .1, knot.z + .02], [knot.x - .01, knot.y - .19, knot.z + .016]], .008, 3, .05)]), ['trousers', 'skin'], { bones: ['pelvis', 'spine_01'] });
    // fresh lash wounds across the back, a few cuts on the arms
    var lash = [];
    for (var k = 0; k < 6; k++) { var y0 = 1.13 + k * .055 + (G.hash(k, 1, 3) - .5) * .02, s = k % 2 ? 1 : -1; lash.push({ pts: [[.15 * s, y0 + .07, -.3], [.04 * s, y0 + .03, -.3], [-.07 * s, y0 - .015, -.3], [-.15 * s, y0 - .05, -.3]], w: .0045 + G.hash(k, 2, 3) * .002 }); }
    lash.push({ pts: [[.3, 1.47, .03], [.36, 1.465, .02]], w: .004 }, { pts: [[-.52, 1.465, .02], [-.59, 1.46, .02]], w: .004 });
    var skin = bodyMaterial(A.srcMaterial('SuperHero_Male', bases.ubc), 'prisoner-skin', { cls: 'skin', skin: .8, sat: .32, tint: 0xd2cac0, contrast: 1.12, grime: .8, blood: .42, scale: 8, scars: scarLines(A, lash, ['skin']), fresh: true }); skin.normalScale.multiplyScalar(.5);
    return { chainBetween: ['lowerarm_l', 'hand_l', 'lowerarm_r', 'hand_r'], materials: {
      skin: skin,
      trousers: bodyMaterial(A.srcMaterial('Male_Peasant_Legs', bases.peasant), 'prisoner-trousers', { cls: 'cloth', tear: true, sat: .35, tint: 0x9a9082, grime: .75, blood: .35 })
    } };
  };
  function sackHood(A, headBone) {
    var head = A.cloud([headBone], ['skin'], .6), box = A.box(head), c = box.getCenter(new T.Vector3()); c.y += .01;
    var radius = wrapRadius(head, c, .4), g = new T.SphereGeometry(1, 36, 26, 0, TAU, 0, PI * .86), p = g.attributes.position, d = new T.Vector3(), neckBone = A.index.neck_01 !== undefined ? 'neck_01' : 'neck';
    for (var i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize(); var r = Math.max(radius(d), .06) + .02;
      var fold = (G.fbm(d.x * 3.5 + 3, d.y * 5, d.z * 3.5, 3) - .5) * .045 + Math.max(0, Math.sin(Math.atan2(d.x, d.z) * 7 + d.y * 3)) * .008;
      var q = c.clone().addScaledVector(d, r + fold);
      // the empty closed end of the sack slumps backwards over the skull
      if (d.y > .35) { var k = (d.y - .35) / .65; q.z -= k * k * .11; q.y += k * .05 - k * k * .06; q.x += Math.sin(d.x * 3) * k * .01; }
      if (d.y < -.5) { var k2 = (-.5 - d.y) / .5; q.x = mix(q.x, c.x + d.x * .06, k2 * .7); q.z = mix(q.z, c.z + d.z * .06, k2 * .7); q.y -= k2 * .06; }
      p.setXYZ(i, q.x, q.y, q.z);
    }
    g.computeVertexNormals(); G.uvScale(g, 3, 2.5);
    G.wear(g, { edge: 0, cavity: 0, border: 0, curv: 0, tear: { amount: .8, width: .05, bottom: .25, base: .07 } });
    A.weighted('burlap', g, function (v) { var t = smooth(c.y - .05, c.y - .13, v.y); return [[A.index[headBone], 1 - t * .7], [A.index[neckBone], t * .7]]; });
    // crude cut eye holes — something wet glints inside
    [-1, 1].forEach(function (s) { var dir = new T.Vector3(s * .33, .1, 1).normalize(), r = radius(dir) + .02, pnt = c.clone().addScaledVector(dir, r + .004); var hole = G.sphere(.017, [0, 0, 0], [1.25, .7, .3], 10, 8); hole.lookAt(dir); hole.translate(pnt.x, pnt.y, pnt.z); A.rigid('void', glossy(G.fillWear(hole), .85), headBone); });
    // rope stitches up the back seam and a hanging drawstring
    var st = []; for (i = 0; i < 9; i++) { var e = -.25 + i * .09, dd = new T.Vector3(0, e, -1).normalize(), rr = radius(dd) + .022, sp = c.clone().addScaledVector(dd, rr); if (e > .35) { var k3 = (e - .35) / .65; sp.z -= k3 * k3 * .11; } st.push(G.ring(.009, .0025, [sp.x, sp.y, sp.z], [0, 0, PI / 2 + (i % 2 ? .4 : -.4)], 4, 10)); }
    var ropeY = c.y - radius(new T.Vector3(0, -1, 0)) * .8 - .02, rope = G.ring(.068, .011, [c.x, ropeY, c.z + .005], [-.25, 0, 0], 5, 22);
    rope = G.merge([rope, G.rope([[c.x + .03, ropeY - .01, c.z + .07], [c.x + .05, ropeY - .08, c.z + .09], [c.x + .04, ropeY - .16, c.z + .08]], .008, 3, .045), G.rope([[c.x + .01, ropeY - .01, c.z + .075], [c.x - .0, ropeY - .1, c.z + .1], [c.x - .02, ropeY - .19, c.z + .09]], .008, 3, .045)]);
    A.transfer('rope', rope, null, { pin: true, bones: ['neck_01', 'neck', 'Head', 'head'] });
    A.rigid('rope', G.merge(st), headBone);
  }
  function shackles(A, fore, hand) {
    var a = A.P(fore), b = A.P(hand), dir = b.clone().sub(a).normalize(), at = a.clone().lerp(b, .86);
    var m = new T.Matrix4().makeBasis(new T.Vector3(0, 0, 1).cross(dir).normalize(), dir, new T.Vector3(0, 0, 1)); m.setPosition(at);
    var cuff = G.lathe([[.052, -.035], [.06, -.034], [.064, -.028], [.065, .028], [.06, .034], [.052, .035]], 18); cuff.applyMatrix4(m); A.rigid('iron', cuff, fore);
    var hw = [G.cyl(.011, .011, .08, 8, [0, 0, .066], [PI / 2, 0, 0]), G.ring(.014, .004, [0, 0, -.071], [PI / 2, 0, 0], 5, 12)];
    for (var i = 0; i < 6; i++) { var an = i / 6 * TAU + .5; hw.push(G.stud(.005, [Math.sin(an) * .064, (i % 2 ? .018 : -.018), Math.cos(an) * .064], [Math.sin(an), 0, Math.cos(an)])); }
    var hg = G.merge(hw); hg.applyMatrix4(m); A.rigid('dark', hg, fore);
  }
  // Mezar Muhafızı — tomb warden in blackened gambeson, riveted cuirass with rolled rims and side buckles, layered
  // pauldrons, dented great helm with a spike crown, torn tabard with the broken-chain sigil, iron skull on the belt,
  // battered tower shield (arrows, claw gouges, bloody handprint).
  R.guard = function (A) {
    var body = A.addFrom(bases.ubc, function () { return true; }, 'skin')[0];
    A.trim(body, function (a, b, c) { function keep(r) { return r.bone === 'Head' || (r.bone === 'neck_01' && r.p.y > 1.52); } return keep(a) && keep(b) && keep(c); });
    A.addFrom(bases.ranger, function (n) { return /Body|Legs|Bracer|Belt/.test(n.name) || (/Arms/.test(n.name) && !/Regular/.test(n.material.name)); }, 'gambeson');
    A.addFrom(bases.ranger, function (n) { return /Arms/.test(n.name) && /Regular/.test(n.material.name); }, 'hands');
    A.addFrom(bases.peasant, function (n) { return /Feet/.test(n.name); }, 'boots');
    A.lengthen({ upperarm_l: 1.16, upperarm_r: 1.16 }); // broad shoulders (longer clavicles)
    A.parts.forEach(function (p) { if (p.key === 'gambeson') A.slim(p, { spine_02: 1.12, spine_03: 1.1, upperarm_l: 1.12, upperarm_r: 1.12, thigh_l: 1.06, thigh_r: 1.06 }, 1); });
    var head = A.cloud(['Head'], ['skin'], .6), hb = A.box(head), hc = hb.getCenter(new T.Vector3()), hs = hb.getSize(new T.Vector3());
    var helm = G.greatHelm(Math.max(hs.x, hs.z) * .5 + .012, hs.y + .02); helm.parts.steel = helm.parts.iron; helm.parts.iron = []; place(A, helm, T4(hc.x, hc.y + .005, hc.z + .006), 'Head');
    // cuirass: thick fitted shell over the gambeson chest with rolled rims, a rivet row and side buckles
    var chest = A.cloud(['spine_01', 'spine_02', 'spine_03'], ['gambeson'], .35), sp = A.P('spine_03'), cz = sp.z - .01;
    var field = radialField(chest, 0, cz, .035, .2);
    function cuirass(u, v) {
      var a = u * TAU, side = Math.abs(Math.sin(a)), y0 = 1.10 - .02 * Math.cos(a), y1 = 1.50 - .14 * side + .02 * Math.cos(a), y = mix(y0, y1, v);
      var r = Math.max(field(a, y), .12) + .03 + (Math.cos(a) > .8 ? .012 * (1 - Math.abs(Math.sin(a)) * 5) : 0);
      return [Math.sin(a) * r, y, cz + Math.cos(a) * r];
    }
    A.transfer('steel', G.shell(36, 12, cuirass, .018, true, false, { rim: .009 }), ['gambeson']);
    var riv = [];
    for (var i = 0; i < 28; i++) { var uu = (i + .5) / 28, q = cuirass(uu, .06), nn = new T.Vector3(Math.sin(uu * TAU), 0, Math.cos(uu * TAU)); riv.push(G.stud(.0065, [q[0] + nn.x * .004, q[1], q[2] + nn.z * .004], nn)); if (Math.abs(Math.cos(uu * TAU)) > .5) { var q2 = cuirass(uu, .94); riv.push(G.stud(.006, [q2[0] + nn.x * .004, q2[1], q2[2] + nn.z * .004], nn)); } }
    for (i = 0; i < 6; i++) { var qv = cuirass(0, .15 + i * .13); riv.push(G.stud(.007, [qv[0], qv[1], qv[2] + .018], [0, 0, 1])); }
    A.transfer('brass', G.merge(riv), ['gambeson'], { bones: UBC_TORSO });
    [-1, 1].forEach(function (s) { [1.2, 1.33].forEach(function (y) { var a = s * PI / 2, q3 = cuirass(a / TAU < 0 ? 1 + a / TAU : a / TAU, (y - 1.1) / .36), n3 = new T.Vector3(Math.sin(a), 0, Math.cos(a)); var fm = frameFrom(V3(q3).addScaledVector(n3, .006), new T.Vector3(0, 0, s), n3); var st = G.merge([G.box(.02, .07, .005, [0, 0, 0]), G.buckle(.022, .02, .0025).translate(0, .012, .004)]); st.applyMatrix4(fm); A.transfer('leather', st, ['gambeson'], { pin: true }); }); });
    // pauldrons: layered lames with rolled rims and rivets
    ['l', 'r'].forEach(function (s) {
      var sh = A.P('upperarm_' + s), el = A.P('lowerarm_' + s), dir = el.clone().sub(sh).normalize(), sg = s === 'l' ? 1 : -1;
      for (var k = 0; k < 3; k++) {
        var dome = G.lathe([[0, .1], [.07, .095], [.12, .07], [.15, .02], [.155, -.01]], 20, 0, PI), rimPts = [], stds = [];
        for (var j = 0; j <= 16; j++) { var ph = j / 16 * PI; rimPts.push([Math.sin(ph) * .157, -.012, Math.cos(ph) * .157]); if (j % 3 === 1) stds.push(G.stud(.0055, [Math.sin(ph) * .148, .004, Math.cos(ph) * .148], [Math.sin(ph) * .3, 1, Math.cos(ph) * .3])); }
        var piece = G.merge([dome, G.tube(rimPts, .007, 5, 32, true)]), studs = G.merge(stds);
        [piece, studs].forEach(function (g) { g.rotateY(PI / 2 * sg); var m = new T.Matrix4().makeBasis(dir.clone(), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)); m.setPosition(sh.clone().addScaledVector(dir, .03 + k * .05).add(new T.Vector3(0, .02 - k * .018, -.005))); g.scale(1 - k * .08, 1, 1.05 - k * .08); g.applyMatrix4(m); });
        A.transfer(k ? 'dark' : 'steel', piece, ['gambeson'], { pin: true }); A.transfer('brass', studs, ['gambeson'], { pin: true });
      }
    });
    // tabard front and back, torn, weighted smoothly across both thighs; sigil painted on the front
    var pel = A.P('pelvis'), tw = clothWeights(A, 'pelvis', 'thigh_l', 'thigh_r', 1.05, .55, .6);
    [1, -1].forEach(function (f) {
      function tab(u, v, lift) { var x = mix(-.13, .13, u) * (1 + v * .15), y = mix(1.12, .5, v) + (v > .9 ? (G.hash(u * 7, 1, f) - .5) * .06 : 0), z = pel.z + f * (.155 + v * .035 + (lift || 0)) + (G.fbm(u * 5, v * 4, f) - .5) * .02 + f * Math.pow(Math.abs(Math.sin(u * PI * 3)), 2) * .008 * v; return [x, y, z]; }
      A.weighted('tabard', G.sheet(8, 14, tab, false, f < 0), tw);
      if (f > 0) { var sig = G.decal(0, .15, .15, 3), sgp = sig.attributes.position; for (var k2 = 0; k2 < sgp.count; k2++) { var uu2 = .5 + sgp.getX(k2) / .26 * (1 / 1.05), vv2 = (1.12 - (.86 + sgp.getY(k2))) / .62, t3 = tab(uu2, vv2, .003); sgp.setXYZ(k2, t3[0], t3[1], t3[2]); } sig.computeVertexNormals(); A.weighted('paint', sig, tw); }
    });
    // iron skull buckle on the belt
    var bf = surf(A, [0, 1.2, .3], ['gambeson']);
    skullPiece(A, .052, frameFrom(bf.p.clone().add(new T.Vector3(0, 0, .014)), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)), { transfer: true, keys: ['gambeson'], pin: true, bones: ['pelvis', 'spine_01'] }, false, 'void');
    var shield = G.towerShield();
    var fa = A.P('lowerarm_l'), hd = A.P('hand_l'), mid = fa.clone().lerp(hd, .45);
    var sm = new T.Matrix4().makeBasis(new T.Vector3(-1, 0, 0), new T.Vector3(0, 0, 1), new T.Vector3(0, 1, 0)); sm.setPosition(mid.x, mid.y + .085, mid.z + .02);
    place(A, shield, sm, 'lowerarm_l', .78);
    return { weapon: G.falchion(), materials: {
      skin: bodyMaterial(A.srcMaterial('SuperHero_Male', bases.ubc), 'guard-skin', { cls: 'skin', skin: 1, sat: .5, tint: 0xb8a898, grime: .4 }),
      hands: bodyMaterial(A.srcMaterial('Male_Ranger_Arms', bases.ranger, 1), 'guard-hands', { cls: 'skin', skin: .8, sat: .5, tint: 0xb0a090, grime: .5, blood: .25 }),
      gambeson: bodyMaterial(A.srcMaterial('Male_Ranger_Body', bases.ranger), 'guard-gambeson', { cls: 'cloth', sat: .12, tint: 0x8a7a6e, contrast: 1.1, grime: .5, blood: .18 }),
      boots: bodyMaterial(A.srcMaterial('Male_Peasant_Feet', bases.peasant), 'guard-boots', { cls: 'leather', sat: .4, tint: 0x6a5a4c, grime: .6 })
    } };
  };
  // Kül Rahibi — ash priest: crimson robe to the floor with a torn, blood-soaked hem, sigil-marked stole, twisted
  // rope girdle with skull and finger-bone fetishes, cracked horned bone mask (eyes glint in the sockets), brazier staff.
  R.cultist = function (A) {
    var body = A.addFrom(bases.ubc, function () { return true; }, 'skin')[0];
    A.trim(body, function (a, b, c) { function keep(r) { return r.bone === 'Head' || (r.bone === 'neck_01' && r.p.y > 1.5); } return keep(a) && keep(b) && keep(c); });
    A.addFrom(bases.ranger, function (n) { return /Body|Hood|Belt/.test(n.name) || (/Arms/.test(n.name) && !/Bracer/.test(n.name) && !/Regular/.test(n.material.name)); }, 'vestment');
    A.addFrom(bases.ranger, function (n) { return /Arms/.test(n.name) && /Regular/.test(n.material.name); }, 'hands');
    A.addFrom(bases.peasant, function (n) { return /Feet/.test(n.name); }, 'boots');
    A.lengthen({ spine_02: 1.06, spine_03: 1.06, neck_01: 1.12, lowerarm_l: 1.05, lowerarm_r: 1.05, hand_l: 1.1, hand_r: 1.1 });
    A.parts.forEach(function (p) { if (p.key !== 'skin') A.slim(p, { spine_01: .9, spine_02: .9, upperarm_l: .85, upperarm_r: .85, lowerarm_l: .88, lowerarm_r: .88, thigh_l: .9, thigh_r: .9 }, 1); });
    var waist = A.cloud(['pelvis', 'spine_01', 'spine_02', 'thigh_l', 'thigh_r'], ['vestment'], .3), pel = A.P('pelvis');
    var wf = radialField(waist.length ? waist : A.cloud(['pelvis', 'spine_01'], null, .3), 0, pel.z, .04, .28);
    var top = 1.16, r0 = [];
    for (var i = 0; i <= 40; i++) r0.push(Math.max(wf(i / 40 * TAU, top), .14) + .012);
    // floor-length robe: deep folds that open toward the hem, heavier at the back, torn and bloodied at the bottom
    var robe = G.sheet(48, 28, function (u, v) {
      var a = u * TAU, i2 = Math.round(u * 40) % 40, y = mix(top, .015, v), flare = mix(r0[i2], .33 + .05 * Math.abs(Math.sin(a)), Math.pow(v, .85));
      var hem = v > .9 ? (G.hash(Math.floor(u * 48), 3, 1) - .5) * .09 * (v - .9) / .1 : 0;
      var folds = (Math.pow(Math.abs(Math.sin(a * 5.5 + v * 1.5 + G.fbm(u * 3, v, 2) * 1.5)), .6) - .5) * .05 * Math.pow(v, .65) + (G.fbm(u * 12, v * 5, 1) - .5) * .025 * v + Math.pow(Math.abs(Math.sin(a * 13 + v * 3)), 3) * .008 * v;
      return [Math.sin(a) * (flare + folds), y + hem, pel.z + Math.cos(a) * (flare + folds) * (Math.cos(a) > 0 ? 1.05 : .98)];
    }, true);
    G.uvScale(robe, 4, 3);
    G.wear(robe, { edge: 0, cavity: 0, border: 0, curv: 0, paint: function (p) { return smooth(.35, .05, p.y) * (.35 + .65 * G.fbm(p.x * 9, p.y * 4, p.z * 9, 2)) * (p.z > pel.z ? .5 : .28); }, tear: { amount: .78, width: .07, bottom: .12, base: .03 } });
    A.weighted('robe', robe, function (v) {
      var t = clamp((top - v.y) / (top - .02), 0, 1), side = smooth(-.12, .12, v.x), legW = Math.pow(clamp((t - .12) / .88, 0, 1), .8) * .8, calf = t > .55 ? (t - .55) * .5 : 0, up = Math.max(0, 1 - t / .12);
      return [[A.index.spine_01, up * .7], [A.index.pelvis, (1 - legW) - up * .7], [A.index.thigh_l, (legW - calf) * side], [A.index.thigh_r, (legW - calf) * (1 - side)], [A.index.calf_l, calf * side], [A.index.calf_r, calf * (1 - side)]].filter(function (e) { return e[1] > 0; });
    });
    var sash = G.sheet(40, 3, function (u, v) { var a = u * TAU, y = mix(top - .09, top + .03, v) + Math.sin(a * 3) * .012, r = Math.max(wf(a, y), .14) + .024 + .01 * Math.sin(v * PI) + .006 * Math.sin(a * 11); return [Math.sin(a) * r, y, pel.z + Math.cos(a) * r * 1.03]; }, true);
    A.transfer('sash', sash, ['vestment']);
    // stole with a painted sigil near each end, frayed tips
    var chestF = A.cloud(['spine_02', 'spine_03'], ['vestment'], .3), cf = radialField(chestF, 0, A.P('spine_03').z, .04, .25), s3z = A.P('spine_03').z;
    function stoleAt(sd, u, v, lift) { var y = mix(1.55, .5, v), x = sd * (mix(.09, .06, v) + mix(-.03, .03, u)), zf = y > 1.1 ? cf(Math.atan2(x, 1), y) + .015 : Math.max(wf(Math.atan2(x, 1), Math.min(y, top)), .15) + .02 + (1.1 - y) * .08; return [x, y, s3z + zf + (lift || 0)]; }
    [-1, 1].forEach(function (sd) {
      var sw = function (p) { var t = smooth(1.35, 1.0, p.y), b2 = smooth(1.05, .7, p.y); return [[A.index.spine_03, 1 - t], [A.index.spine_01, t * (1 - b2)], [A.index.pelvis, t * b2 * .6], [A.index[sd > 0 ? 'thigh_l' : 'thigh_r'], t * b2 * .4]].filter(function (e) { return e[1] > 0; }); };
      A.weighted('sash', G.sheet(3, 20, function (u, v) { return stoleAt(sd, u, v); }, false), sw);
      var dc = G.decal(0, .06, .06, 2), dp = dc.attributes.position; for (var k = 0; k < dp.count; k++) { var q = stoleAt(sd, .5 + sd * dp.getX(k) / .06 * .9, .78 - dp.getY(k) / 1.05, .004); dp.setXYZ(k, q[0], q[1], q[2]); } dc.computeVertexNormals(); A.weighted('paint', dc, sw);
    });
    // twisted rope girdle, knot, and fetishes: two small skulls and finger bones on cords
    var gp = loop(function (a, y) { return Math.max(wf(a, y), .14) + .012; }, 0, pel.z, top - .09, .03, 30, function (a) { return .01 * Math.sin(a * 2); }), kn = V3(gp[0]);
    A.transfer('rope', G.merge([G.rope(gp, .011, 3, .07), G.blob(.02, [kn.x, kn.y, kn.z + .01], [1.3, 1, .9], .4, 2, 10), G.rope([[kn.x + .01, kn.y - .01, kn.z + .015], [kn.x + .02, kn.y - .12, kn.z + .03], [kn.x + .01, kn.y - .26, kn.z + .03]], .009, 3, .06)]), ['vestment']);
    [-.95, -.4, .45, 1.0].forEach(function (ang, k) {
      var r = Math.max(wf(ang, top - .1), .14) + .05, bx = Math.sin(ang) * r, bz = pel.z + Math.cos(ang) * r, len = .07 + k % 2 * .04, y1 = top - .1 - len, pinned = function () { return [[A.index.pelvis, 1]]; };
      A.weighted('rope', G.tube([[bx, top - .1, bz], [bx + .004, top - .1 - len * .5, bz + .01], [bx, y1, bz + .006]], .0035, 4, 10, true), pinned);
      if (k % 2 === 0) { var sk = G.skull(.045, k === 0); Object.keys(sk.parts).forEach(function (key) { sk.parts[key].forEach(function (g) { g.rotateY(ang); g.translate(bx, y1 - .026, bz + .008); A.weighted(key === 'void' ? 'void' : 'bone', g, pinned); }); }); }
      else { var fb = G.merge([0, 1, 2].map(function (j) { return G.between(G.cyl(.0045, .0035, 1, 5), [bx + (j - 1) * .012, y1, bz + .01], [bx + (j - 1) * .016, y1 - .045 - j % 2 * .01, bz + .014]); })); A.weighted('bone', fb, pinned); }
    });
    // bone mask with horns, fitted to the face; cracked, carved and soot-streaked
    var head = A.cloud(['Head'], ['skin'], .6), hb = A.box(head), hc = hb.getCenter(new T.Vector3());
    var mask = G.extrude([[-.07, .07], [-.075, .02], [-.06, -.05], [-.03, -.09], [0, -.1], [.03, -.09], [.06, -.05], [.075, .02], [.07, .07], [.03, .095], [-.03, .095]], .012, .004,
      [G.circle(.018, 8, -.032, .02), G.circle(.018, 8, .032, .02), [[-.02, -.055], [.02, -.055], [.015, -.045], [-.015, -.045]]]);
    mask = G.subdivide(mask, .014); var mp = mask.attributes.position; for (i = 0; i < mp.count; i++) { var x = mp.getX(i), z = mp.getZ(i), y = mp.getY(i), rr = .1, crack = z > 0 ? -Math.max(0, 1 - Math.abs(x - .018 - (y - .03) * .35) / .004) * .003 * (y > -.02 ? 1 : 0) : 0; mp.setXYZ(i, Math.sin(x / rr) * (rr + z + crack), y, Math.cos(x / rr) * (rr + z + crack) - rr); } mask.computeVertexNormals();
    var maskAt = T4(hc.x, hc.y - .01, hb.max.z + .012, -.08); mask.applyMatrix4(maskAt); A.rigid('bone', mask, 'Head');
    var sockets = G.merge([-1, 1].map(function (sd) { return G.sphere(.02, [sd * .032, .02, -.004], [1, .8, .35], 10, 8); })); sockets.applyMatrix4(maskAt); A.rigid('void', glossy(G.fillWear(sockets), .7), 'Head');
    [-1, 1].forEach(function (s) {
      var pts = []; for (var k = 0; k <= 10; k++) { var t = k / 10; pts.push([hc.x + s * (.07 + t * .13 + t * t * .05), hc.y + .09 + t * .16 - t * t * .08, hc.z - .02 - t * .1 + t * t * .06]); }
      A.rigid('bone', G.tube(pts, function (t) { return mix(.026, .004, t) * (1 + .09 * Math.max(0, Math.sin(t * 60))); }, 8, 44, true), 'Head');
    });
    return { weapon: G.priestStaff(), materials: {
      skin: bodyMaterial(A.srcMaterial('SuperHero_Male', bases.ubc), 'cultist-skin', { cls: 'skin', skin: .8, sat: .2, tint: 0x8a8480, grime: .7 }),
      vestment: bodyMaterial(A.srcMaterial('Male_Ranger_Body', bases.ranger), 'cultist-vestment', { cls: 'cloth', sat: .15, tint: 0x9a3a30, contrast: 1.1, grime: .45, blood: .12 }),
      hands: bodyMaterial(A.srcMaterial('Male_Ranger_Arms', bases.ranger, 1), 'cultist-hands', { cls: 'skin', skin: .6, sat: .15, tint: 0x9a948c, grime: .6, blood: .3 }),
      boots: bodyMaterial(A.srcMaterial('Male_Peasant_Feet', bases.peasant), 'cultist-boots', { cls: 'leather', sat: .3, tint: 0x4a3c34, grime: .7 })
    } };
  };
  // Karanlık Pusucusu — ash-skinned, too-long limbs, a torn blindfold weeping blood, ridged bone spurs down the spine,
  // jointed hooked claws, self-inflicted cuts, rag loincloth on a twisted rope.
  R.stalker = function (A) {
    var body = A.addFrom(bases.ubc, function () { return true; }, 'skin')[0];
    A.lengthen({ neck_01: 1.0, Head: 1.45, lowerarm_l: 1.14, lowerarm_r: 1.14, hand_l: 1.36, hand_r: 1.36, calf_l: 1.06, calf_r: 1.06, foot_l: 1.12, foot_r: 1.12, clavicle_l: 1.08, clavicle_r: 1.08 });
    A.slim(body, { spine_01: .7, spine_02: .74, spine_03: .82, neck_01: .72, Head: .96, clavicle_l: .85, clavicle_r: .85, upperarm_l: .6, upperarm_r: .6, lowerarm_l: .64, lowerarm_r: .64, hand_l: .85, hand_r: .85, thigh_l: .68, thigh_r: .68, calf_l: .7, calf_r: .7, pelvis: .8 }, .9);
    var head = A.cloud(['Head'], ['skin'], .6), hb = A.box(head), hc = hb.getCenter(new T.Vector3()), rad = wrapRadius(head, hc, .45);
    var band = G.sheet(40, 4, function (u, v) { var a = u * TAU, dir = new T.Vector3(Math.sin(a), 0, Math.cos(a)), y = hc.y + .015 + mix(-.027, .027, v) + (Math.cos(a) < -.5 ? -.02 : 0) + (G.fbm(u * 9, v * 2, 3) - .5) * .008; var r = rad(dir.clone().setY(.1).normalize()) + .012 + (G.fbm(u * 14, v, 1) - .5) * .004; return [hc.x + dir.x * r, y, hc.z + dir.z * r]; }, true);
    G.wear(band, { edge: 0, cavity: 0, border: 0, curv: 0, paint: function (p) { return p.z > hc.z + .03 && Math.abs(Math.abs(p.x - hc.x) - .03) < .025 ? .9 : 0; }, tear: { amount: .5, width: .015, bottom: .5, base: .02 } });
    A.rigid('rag', band, 'Head');
    var tailA = [hc.x, hc.y + .01, hb.min.z - .005]; A.rigid('rag', G.merge([G.sheet(2, 8, function (u, v) { return [tailA[0] + mix(-.02, .02, u) + v * .02, tailA[1] - v * .22, tailA[2] - v * .05 - Math.sin(v * 3) * .02]; }, false), G.sheet(2, 8, function (u, v) { return [tailA[0] + mix(-.02, .02, u) - v * .03, tailA[1] - v * .17, tailA[2] - v * .03 - Math.sin(v * 3) * .02]; }, false)]), 'Head');
    // ridged spine spurs growing out of the back
    ['spine_01', 'spine_02', 'spine_03', 'neck_01'].forEach(function (bn, i) {
      var p = A.P(bn), back = A.nearest(new T.Vector3(p.x, p.y + .03, p.z - .3), ['skin']), bz = back ? back.z : p.z - .12;
      for (var k = 0; k < 2; k++) {
        var y = p.y + k * .05, len = .08 + (i === 2 ? .06 : .03) + k * .01, a = new T.Vector3(0, y, bz + .01), b = new T.Vector3(0, y + len * .45, bz - len * .9);
        A.rigid('bone', G.merge([G.tube([a, a.clone().lerp(b, .5).add(new T.Vector3(0, .01, 0)), b], function (t) { return mix(.019, .002, t) * (1 + .12 * Math.max(0, Math.sin(t * 30))); }, 7, 16, true), G.blob(.022, [0, y, bz + .012], [1, .6, 1], .4, i * 2 + k, 8)]), bn);
      }
    });
    ['l', 'r'].forEach(function (s) {
      var el = A.P('lowerarm_' + s), hand = A.P('hand_' + s), dir = hand.clone().sub(el).normalize(), up = new T.Vector3(0, 1, 0);
      A.rigid('bone', G.spike(.016, [el.x, el.y + .01, el.z - .03], [el.x - dir.x * .10, el.y + .03, el.z - .12]), 'lowerarm_' + s);
      var cl = G.claws(4, .24), m = new T.Matrix4().makeBasis(dir.clone().cross(up).normalize(), dir, up);
      m.setPosition(hand.clone().addScaledVector(dir, .07));
      place(A, cl, m, 'hand_' + s);
    });
    var pel = A.P('pelvis');
    [[-.09, 1], [.09, 1], [0, -1], [.1, -1], [-.12, -1]].forEach(function (e, i) {
      var strip = G.sheet(3, 10, function (u, v) { return [e[0] + mix(-.05, .05, u) * (1 - v * .4), mix(.98, .6 - i * .03, v), pel.z + e[1] * (.12 + v * .02) + Math.sin(v * 4 + i) * .01 + (G.fbm(u * 3, v * 4, i) - .5) * .01]; }, false, e[1] < 0);
      A.weighted('rag', strip, clothWeights(A, 'pelvis', 'thigh_l', 'thigh_r', .95, .65, .5));
    });
    var hipsC = A.cloud(['pelvis', 'spine_01'], ['skin'], .3), hfS = radialField(hipsC, 0, pel.z, .03, .3);
    A.transfer('rope', G.rope(loop(hfS, 0, pel.z, .985, .01, 26), .009, 3, .06), ['skin'], { bones: ['pelvis', 'spine_01'] });
    var cuts = [{ pts: [[.12, 1.3, .2], [.05, 1.22, .2]], w: .004 }, { pts: [[.14, 1.24, .2], [.07, 1.17, .2]], w: .0035 }, { pts: [[-.08, 1.36, .2], [-.13, 1.28, .2]], w: .004 },
      { pts: [[hc.x - .03, hc.y - .005, hc.z + .2], [hc.x - .032, hc.y - .06, hc.z + .2], [hc.x - .028, hc.y - .1, hc.z + .2]], w: .004 }, { pts: [[hc.x + .03, hc.y - .005, hc.z + .2], [hc.x + .034, hc.y - .07, hc.z + .2]], w: .0038 },
      { pts: [[.62, 1.49, .02], [.72, 1.485, .01]], w: .0035 }, { pts: [[-.6, 1.45, .02], [-.7, 1.45, .02]], w: .0035 }];
    var skin = bodyMaterial(A.srcMaterial('SuperHero_Male', bases.ubc), 'stalker-skin', { cls: 'skin', skin: .55, scatter: [.4, .3, .28], sat: .1, tint: 0x8c8894, contrast: 1.25, grime: .75, blood: .3, scale: 9, lowTop: .75, scars: scarLines(A, cuts, ['skin']), fresh: true }); skin.normalScale.multiplyScalar(.6);
    return { materials: { skin: skin } };
  };
  // Veba Taşıyıcısı — bloated plague carrier: glistening boils, seeping torn bandages, a bone cage lashed to his hump
  // with rope, plague lantern, corked glowing vials on the belt, buckled straps; one wet eye left open.
  R.carrier = function (A) {
    var body = A.addFrom(bases.executioner, function () { return true; }, 'skin')[0];
    A.remapBone('neutral_bone', 'pelvis');
    A.inflate(body, new T.Vector3(0, 1.08, .18), .2, .1, [1.35, 1, 1]);
    A.inflate(body, new T.Vector3(0, 1.45, -.2), .17, .06, [1.5, 1, 1]);
    A.inflate(body, new T.Vector3(.1, 1.26, .2), .1, .03); A.inflate(body, new T.Vector3(-.12, 1.0, .2), .09, .025);
    execEyes(body);
    var cloud = A.cloud(['spine01', 'spine02', 'pelvis', 'upper_armL', 'upper_armR', 'spine03'], ['skin'], .4);
    for (var i = 0; i < 26; i++) {
      var p = cloud[Math.floor(G.hash(i, 4, 2) * cloud.length)];
      var size = .012 + G.hash(i, 5, 1) * .024, boil = G.blob(size, [p.x, p.y, p.z], [1, 1, .8], .35, i, 10);
      A.transfer(i % 4 === 0 ? 'glow' : 'flesh', glossy(G.fillWear(boil, 0, 0, i % 3 === 0 ? .6 : 0), i % 4 === 0 ? 1 : .65), ['skin'], { pin: true });
    }
    var belly = A.cloud(['spine01', 'pelvis', 'spine02'], ['skin'], .3), bf = radialField(belly, 0, .0, .04, .25);
    var wrap = G.merge([0, 1].map(function (w) { return G.sheet(40, 4, function (u, v) { var a = u * TAU, y = mix(.955, 1.045, v) + w * .13 + Math.sin(a * 2 + w) * .035, r = bf(a, y) + .014 + (G.fbm(u * 20, v * 2, w) - .5) * .004; return [Math.sin(a) * r, y, Math.cos(a) * r]; }, true); }));
    G.wear(wrap, { edge: 0, cavity: 0, border: 0, curv: 0, paint: function (q) { return q.z > .1 ? smooth(.4, .8, G.fbm(q.x * 12, q.y * 12, 1, 2)) : 0; }, tear: { amount: .55, width: .02, bottom: .5, base: .06 } });
    A.transfer('bandage', wrap, ['skin'], { bones: EXEC_TORSO });
    var hd = A.cloud(['head'], ['skin'], .6), hdb = A.box(hd), hdc = hdb.getCenter(new T.Vector3()), hdr = rayRadius(hd, hdc, .03);
    [[.08, .05, .034], [.025, -.12, .03], [-.04, .1, .032], [-.095, -.04, .034], [.12, .02, .03]].forEach(function (b, k) {
      var band = G.sheet(34, 2, function (u, v) {
        var a = u * TAU, y = hdc.y + b[0] + Math.sin(a + k) * b[1] + mix(-b[2], b[2], v), dir = new T.Vector3(Math.sin(a), (y - hdc.y) * 2.2, Math.cos(a)).normalize();
        var r = hdr(dir) + .006 + k * .002 + (G.fbm(u * 9, v * 3, k) - .5) * .006; return [hdc.x + dir.x * r, y, hdc.z + dir.z * r];
      }, true);
      G.wear(band, { edge: 0, cavity: 0, border: 0, curv: 0, paint: function (q) { return G.fbm(q.x * 30, q.y * 30, q.z * 30, 2) > .62 ? .7 : 0; }, tear: { amount: .45, width: .012, bottom: .5, base: .03 } });
      A.rigid('bandage', band, 'head');
    });
    A.rigid('bandage', G.sheet(2, 8, function (u, v) { return [hdc.x + .03 + mix(-.018, .018, u), hdc.y - .02 - v * .2, hdb.min.z - .005 - v * .05 - Math.sin(v * 3) * .015]; }, false), 'head');
    // cage of iron bars and bone on the back, nailed joints, rope lashings, strapped flush to the hump
    var cy = 1.3, probe = A.nearest(new T.Vector3(0, cy, -.6), ['skin']), bz = (probe ? probe.z : -.3) - .01, cx = 0, W = .21, H = .2, D = .11, bars = [], nails = [], lash = [];
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { bars.push(G.cyl(.013, .013, H * 2 + .02, 6, [cx + sx * W, cy, bz - D + sz * D])); [cy - H, cy + H].forEach(function (y) { nails.push(G.sphere(.017, [cx + sx * W, y, bz - D + sz * D], [1, .8, 1], 7, 5)); lash.push(G.rope([[cx + sx * W - .02, y - .025, bz - D + sz * D - .01], [cx + sx * W + .02, y, bz - D + sz * D + .012], [cx + sx * W - .01, y + .025, bz - D + sz * D + .015]], .006, 3, .03)); }); }); });
    for (var k = -2; k <= 2; k++) { bars.push(G.cyl(.009, .009, H * 2, 5, [cx + k * W / 2.5, cy, bz - 2 * D])); if (k) bars.push(G.cyl(.008, .008, D * 2, 5, [cx + k * W / 2.5, cy + H, bz - D], [PI / 2, 0, 0])); }
    [cy - H, cy + H].forEach(function (y) { bars.push(G.box(W * 2 + .03, .026, .026, [cx, y, bz - 2 * D]), G.box(W * 2 + .03, .026, .026, [cx, y, bz]), G.box(.026, .026, D * 2, [cx - W, y, bz - D]), G.box(.026, .026, D * 2, [cx + W, y, bz - D])); });
    A.rigid('dark', G.wear(G.merge(bars.concat(nails)), { edge: .38 }), 'spine02');
    A.rigid('rope', G.merge(lash), 'spine02');
    var junk = [G.blob(.055, [cx + .11, cy - .15, bz - D * 1.1], [1, .9, 1], .25, 5, 12)];
    for (k = 0; k < 7; k++) junk.push(G.between(G.cyl(.013, .01, 1, 5), [cx - .18 + G.hash(k, 1, 1) * .36, cy - .2 + G.hash(k, 2, 2) * .25, bz - .04 - G.hash(k, 3, 3) * .18], [cx - .18 + G.hash(k, 4, 4) * .36, cy - .08 + G.hash(k, 5, 5) * .25, bz - .04 - G.hash(k, 6, 6) * .18]));
    A.rigid('bone', G.merge(junk), 'spine02');
    skullPiece(A, .1, frameFrom(new T.Vector3(cx - .07, cy - .1, bz - D), new T.Vector3(0, 1, 0), new T.Vector3(.3, .2, 1)), 'spine02', true);
    var lx = cx + W * .6, ly = cy + H + .02;
    var lantern = [G.lathe([[0, ly + .13], [.025, ly + .12], [.045, ly + .09], [.047, ly + .085], [.03, ly + .075], [0, ly + .075]], 10), G.lathe([[0, ly - .005], [.042, ly - .005], [.046, ly - .015], [0, ly - .02]], 10), G.ring(.012, .004, [0, ly + .15, 0])];
    for (k = 0; k < 4; k++) { var la = k / 4 * TAU + .4; lantern.push(G.cyl(.004, .004, .085, 4, [Math.cos(la) * .04, ly + .035, Math.sin(la) * .04])); }
    A.rigid('dark', G.merge(lantern).translate(lx, 0, bz - D), 'spine02');
    A.rigid('glow', glossy(G.fillWear(G.blob(.03, [lx, ly + .035, bz - D], [1, 1.25, 1], .1, 9, 10)), .8), 'spine02');
    // buckled straps over the shoulders
    ['L', 'R'].forEach(function (s) {
      var sh = A.P('shoulder' + s), sg = s === 'L' ? 1 : -1, pts = [[sg * .15, cy + H - .01, bz + .01], [sg * .19, sh.y + .1, sh.z - .08], [sg * .21, sh.y + .07, sh.z + .14], [sg * .19, sh.y - .25, .21]];
      var strap = G.band(pts, .045, .008, function (t, q) { var s2 = A.nearest(q, ['skin']); return s2 ? new T.Vector3(q.x - 0, q.y - 1.2, q.z).normalize().lerp(new T.Vector3(s2.nx, s2.ny, s2.nz), .7) : new T.Vector3(0, 1, 0); }, { studs: .07 });
      A.transfer('dark', G.merge(strap.userData.studs.map(function (q) { return G.stud(.007, q[0], q[1]); })), ['skin'], { bones: EXEC_TORSO });
      A.transfer('strap', strap, ['skin'], { bones: EXEC_TORSO });
      var bk = G.buckle(.05, .045, .004), bp2 = V3(pts[2]).lerp(V3(pts[3]), .35), bs = surf(A, bp2, ['skin']);
      bk.applyMatrix4(frameFrom(bs.p.clone().addScaledVector(bs.n, .016), V3(pts[3]).sub(V3(pts[2])), bs.n)); A.transfer('dark', bk, ['skin'], { pin: true, bones: EXEC_TORSO });
    });
    // leaking vials on the belt: glass (glossy glow), wooden corks, cords
    for (k = 0; k < 4; k++) {
      var a = -1.1 + k * .7, r = .4, vx = Math.sin(a) * r * .95, vz = Math.cos(a) * r * .75, vial = G.lathe([[0, 0], [.03, .01], [.035, .06], [.018, .09], [.015, .11], [0, .11]], 12);
      vial.translate(vx, .82, vz); var vb = { pin: true, bones: EXEC_TORSO.concat(['thighL', 'thighR']) };
      A.transfer('glow', glossy(G.fillWear(vial), 1), ['skin'], vb);
      A.transfer('wood', G.cyl(.016, .014, .025, 8, [vx, .94, vz]), ['skin'], vb);
      A.transfer('rope', G.tube([[vx, .96, vz], [vx * .98, 1.0, vz * .96], [vx * .96, 1.02, vz * .92]], .003, 4, 8, true), ['skin'], vb);
    }
    return { materials: {
      skin: bodyMaterial(A.srcMaterial('Exec_mesh', bases.executioner), 'carrier-skin', { cls: 'skin', skin: 1, skinMap: true, scatter: [.7, .4, .2], sat: .22, tint: 0xb4c498, contrast: .95, grime: .55, blood: .15, scale: 8 })
    } };
  };
  // Zincir Celladı — towering executioner: banded iron face grille (eyes glint behind it), layered spiked pauldrons with
  // rolled rims and rivets, strapped to the arms; chains across the body with a padlock, heavy studded belt with a
  // buckle, hooks, skull trophies and the jailer's key ring; torn blood-soaked leather apron; riveted vambraces;
  // stitched wounds; great axe; verlet drag chain + hook from handL (resets on state.reset).
  R.boss = function (A) {
    var body = A.addFrom(bases.executioner, function () { return true; }, 'skin')[0];
    A.remapBone('neutral_bone', 'pelvis');
    A.lengthen({ upper_armL: 1.15, upper_armR: 1.15 });
    A.slim(body, { upper_armL: 1.12, upper_armR: 1.12, forearmL: 1.1, forearmR: 1.1, spine03: 1.05 }, 1);
    execEyes(body);
    var head = A.cloud(['head'], ['skin'], .6), hb = A.box(head), hc = hb.getCenter(new T.Vector3()), hs = hb.getSize(new T.Vector3()), rr = Math.max(hs.x, hs.z) * .5 + .02;
    var grille = [G.lathe([[rr + .01, -.02], [rr + .02, -.008], [rr + .02, .016], [rr + .01, .03]], 22, -1.0, 2.0).translate(0, .02, 0), G.lathe([[rr + .01, -.02], [rr + .02, -.008], [rr + .02, .016], [rr + .01, .03]], 22, -1.0, 2.0).translate(0, -.12, 0)], gst = [];
    for (var i = 0; i < 7; i++) { var a = -.8 + i * (1.6 / 6); grille.push(G.between(G.cyl(.009, .009, 1, 6), [Math.sin(a) * (rr + .014), -.13, Math.cos(a) * (rr + .014)], [Math.sin(a) * (rr + .014), .04, Math.cos(a) * (rr + .014)])); [.024, -.116].forEach(function (y) { gst.push(G.stud(.006, [Math.sin(a) * (rr + .021), y, Math.cos(a) * (rr + .021)], [Math.sin(a), 0, Math.cos(a)])); }); }
    var gm = G.merge(grille), gs = G.merge(gst); [gm, gs].forEach(function (g) { g.translate(hc.x, hc.y - .01, hc.z + .015); }); A.rigid('dark', gm, 'head'); A.rigid('iron', gs, 'head');
    // spiked pauldrons: layered domes with rolled rims, rivet rings, collared spikes, and a strap round the arm
    ['L', 'R'].forEach(function (s) {
      var sh = A.P('upper_arm' + s), sg = s === 'L' ? 1 : -1, axis = new T.Vector3(sg * .55, 1, -.05).normalize();
      var top = A.nearest(sh.clone().add(new T.Vector3(sg * .05, .25, 0)), ['skin']), o = sh.clone().add(new T.Vector3(sg * .02, 0, -.01)); if (top) o.y = Math.max(o.y, top.y - .02);
      for (var k = 0; k < 3; k++) {
        // k 0: the domed cop with a rolled rim; k 1-2: flared lames stacked below it, each overlapping the one above
        var riv = [], rim = [], shellPiece, rr0 = k ? .19 : .165, ry0 = k ? -.03 : .012;
        var dome = k ? G.lathe([[.14, .012], [.172, -.004], [.192, -.03], [.204, -.056], [.198, -.064], [.184, -.042], [.166, -.016], [.136, .002]], 26) : G.lathe([[0, .12], [.08, .115], [.14, .085], [.18, .03], [.19, -.02], [.175, -.036], [.155, -.012], [.12, .045], [.07, .075], [0, .082]], 26);
        for (var j = 0; j < 14; j++) { var ph = j / 14 * TAU; riv.push(G.stud(.008, [Math.cos(ph) * rr0, ry0, Math.sin(ph) * rr0], [Math.cos(ph) * (k ? 1 : .5), k ? .35 : 1, Math.sin(ph) * (k ? 1 : .5)])); }
        if (!k) { for (j = 0; j <= 28; j++) { var p2 = j / 28 * TAU; rim.push([Math.cos(p2) * .19, -.024, Math.sin(p2) * .19]); } shellPiece = G.merge([dome, G.tube(rim, .01, 6, 56, false)]); } else shellPiece = dome;
        var studs = G.merge(riv), sc = [1 + k * .06, 1, 1.05 + k * .06];
        var fm = frameAt(o.clone().addScaledVector(axis, -k * .05).add(new T.Vector3(sg * k * .035, 0, 0)), axis.clone().add(new T.Vector3(sg * k * .2, 0, 0)), new T.Vector3(0, 0, 1));
        [shellPiece, studs].forEach(function (g) { g.scale(sc[0], sc[1], sc[2]); g.applyMatrix4(fm); });
        A.transfer(k ? 'dark' : 'iron', shellPiece, ['skin'], { pin: true }); A.transfer('iron', studs, ['skin'], { pin: true });
      }
      for (j = 0; j < 3; j++) { var ang = -.7 + j * .7, base = o.clone().addScaledVector(axis, .1).add(new T.Vector3(Math.cos(ang) * .06 * sg, 0, Math.sin(ang) * .09)); var tip = base.clone().addScaledVector(axis, .2 - Math.abs(j - 1) * .05).add(new T.Vector3(sg * .03, 0, Math.sin(ang) * .04)); A.transfer('dark', G.merge([G.spike(.028, base, tip), G.orient(new T.CylinderGeometry(.036, .04, .02, 8), base, tip.clone().sub(base))]), ['skin'], { pin: true }); }
      var el = A.P('forearm' + s), ua = sleeve(A, 'upper_arm' + s, 'forearm' + s, .42, .52, .012, .012, ['skin']); A.rigid('strap', ua.geometry, 'upper_arm' + s);
      var bkp = ua.at(PI / 2 * sg, .47, .012); var bk = G.buckle(.04, .036, .0035); bk.applyMatrix4(frameFrom(bkp[0], el.clone().sub(sh), bkp[1])); A.rigid('dark', bk, 'upper_arm' + s);
    });
    var torso = A.cloud(['spine01', 'spine02', 'spine03'], ['skin'], .3), tf = radialField(torso, 0, -.05, .04, .2);
    function onTorso(a, y, off) { var r = tf(a, y) + (off || .02); return [Math.sin(a) * r, y, -.05 + Math.cos(a) * r]; }
    var path = []; for (i = 0; i <= 24; i++) { var t = i / 24, an = mix(-1.1, 1.1 + TAU - 2.2, t); path.push(onTorso(an, mix(1.5, 1.05, t), .045)); }
    A.transfer('iron', G.chain(path.slice(0, 13), .07), ['skin'], { bones: EXEC_TORSO });
    var path2 = []; for (i = 0; i <= 12; i++) { var t2 = i / 12; path2.push(onTorso(mix(PI - 1.2, PI + 1.2, t2), mix(1.08, 1.45, t2), .045)); }
    A.transfer('iron', G.chain(path2, .07), ['skin'], { bones: EXEC_TORSO });
    var lockAt = V3(path[6]).add(new T.Vector3(0, -.04, .03));
    A.transfer('dark', G.wear(G.merge([G.box(.06, .07, .026, [lockAt.x, lockAt.y - .03, lockAt.z]), G.ring(.024, .006, [lockAt.x, lockAt.y + .012, lockAt.z], [PI / 2, 0, 0], 6, 16), G.cyl(.006, .006, .004, 6, [lockAt.x, lockAt.y - .035, lockAt.z + .014], [PI / 2, 0, 0])]), { edge: .45 }), ['skin'], { pin: true, bones: EXEC_TORSO });
    // heavy studded belt with a big buckle; hooks, skull trophies, the jailer's key ring
    var hips = A.cloud(['pelvis', 'spine01'], ['skin'], .3), hf = radialField(hips, 0, -.04, .04, .25);
    var bpts = loop(hf, 0, -.04, 1.06, .02, 32);
    A.transfer('strap', G.band(bpts.slice(0, -1), .085, .012, loopNormals(bpts.slice(0, -1), 0, -.04), { closed: true }), ['skin'], { bones: EXEC_TORSO });
    var bst = []; bpts.slice(0, -1).forEach(function (q, k) { if (k % 2 || k === 0 || k === 32) return; var nn = new T.Vector3(q[0], 0, q[2] + .04).normalize(); bst.push(G.stud(.008, [q[0] + nn.x * .012, q[1] + .022, q[2] + nn.z * .012], nn), G.stud(.008, [q[0] + nn.x * .012, q[1] - .022, q[2] + nn.z * .012], nn)); });
    var bf0 = V3(bpts[0]); bst.push(G.buckle(.1, .1, .009).translate(bf0.x, bf0.y, bf0.z + .016));
    A.transfer('dark', G.merge(bst), ['skin'], { bones: EXEC_TORSO });
    var apron = G.sheet(8, 14, function (u, v) { var r = hf(0, 1.02) + .03 + Math.cos((u - .5) * 2.2) * .02; return [mix(-.16, .16, u) * (1 + v * .25), mix(1.03, .4, v) + (v > .9 ? (G.hash(u * 9, 2, 2) - .5) * .06 : 0), -.04 + r + v * .06 + (G.fbm(u * 4, v * 4, 3) - .5) * .02 + Math.pow(Math.abs(Math.sin(u * PI * 2.5)), 2) * .01 * v]; }, false);
    G.wear(apron, { edge: .5, paint: function (q) { return smooth(.95, .5, q.y) * (.3 + .7 * G.fbm(q.x * 8, q.y * 5, 3, 2)); }, tear: { amount: .7, width: .06, bottom: .25, base: .02 } });
    A.weighted('apron', apron, clothWeights(A, 'pelvis', 'thighL', 'thighR', 1.0, .55, .7));
    [-.5, .6, 2.6].forEach(function (a, k) { var p = onTorso(a, 1.0, .05); var h = G.hook(); place(A, h, T4(p[0], p[1] - .03, p[2], 0, a, 0), { transfer: true, keys: ['skin'], pin: true, bones: EXEC_TORSO }, .7); });
    [[-1.35, .95, 0], [2.2, .96, 1]].forEach(function (q, k) { var p = onTorso(q[0], q[1], .09); skullPiece(A, .075, frameFrom(V3(p).add(new T.Vector3(0, -.06, 0)), new T.Vector3(0, 1, .2 * k), new T.Vector3(Math.sin(q[0]), 0, Math.cos(q[0]))), { transfer: true, keys: ['skin'], pin: true, bones: EXEC_TORSO }, !!q[2], 'void'); });
    var kr = V3(onTorso(1.25, 1.0, .07)), keys = [G.ring(.035, .006, [kr.x, kr.y - .04, kr.z], [0, 1.25, PI / 2], 6, 20)];
    for (i = 0; i < 4; i++) { var ka = -.9 + i * .6, kp = new T.Vector3(kr.x + Math.sin(ka) * .03 * Math.cos(1.25), kr.y - .04 - Math.cos(ka) * .03, kr.z - Math.sin(ka) * .03 * Math.sin(1.25)), kd = new T.Vector3(Math.sin(ka) * .2, -1, 0).normalize(), ke = kp.clone().addScaledVector(kd, .09 + i % 2 * .02);
      keys.push(G.between(G.cyl(.004, .004, 1, 5), kp, ke), G.ring(.011, .003, [kp.x, kp.y - .008, kp.z], [0, 1.25, PI / 2], 4, 10), G.box(.014, .018, .004, [ke.x + .007, ke.y + .008, ke.z], [0, 1.25, 0])); }
    A.transfer('iron', G.merge(keys), ['skin'], { pin: true, bones: EXEC_TORSO });
    // iron vambraces shrink-wrapped over the forearm with rolled rims and studs
    ['L', 'R'].forEach(function (s) {
      var vb = sleeve(A, 'forearm' + s, 'hand' + s, .3, .86, .018, .016, ['skin'], .012); A.rigid('iron', vb.geometry, 'forearm' + s);
      var rims = []; [.3, .86].forEach(function (t) { var ring2 = []; for (var k = 0; k <= 20; k++) ring2.push(vb.at(k / 20 * TAU, t, .006)[0]); rims.push(G.tube(ring2, .007, 5, 40, false)); });
      [.4, .55, .7].forEach(function (t) { var o = vb.at(0, t, .006), tip = o[0].clone().addScaledVector(o[1], .07); rims.push(G.spike(.017, o[0], tip)); });
      for (var k2 = 0; k2 < 8; k2++) { var o2 = vb.at(k2 / 8 * TAU + .3, .33, .008); rims.push(G.stud(.006, o2[0], o2[1])); var o3 = vb.at(k2 / 8 * TAU + .3, .83, .008); rims.push(G.stud(.006, o3[0], o3[1])); }
      A.rigid('dark', G.merge(rims), 'forearm' + s);
    });
    var wounds = scarLines(A, [{ pts: [[.22, 1.34, .3], [.1, 1.24, .32], [.0, 1.19, .32]], w: .005, stitch: true }, { pts: [[-.32, 1.3, .1], [-.36, 1.18, .08]], w: .0045, stitch: true }, { pts: [[.39, 1.2, .0], [.42, 1.08, -.02]], w: .004 }, { pts: [[-.12, 1.4, .3], [-.2, 1.46, .28]], w: .004 }], ['skin']);
    return { weapon: G.bossAxe(), dragChain: 'handL', materials: {
      skin: bodyMaterial(A.srcMaterial('Exec_mesh', bases.executioner), 'boss-skin', { cls: 'skin', skin: 1, skinMap: true, sat: .55, tint: 0xc0b2a8, contrast: 1.1, grime: .45, blood: .4, scale: 6, scars: wounds }),
      apron: gearMaterial('apron')
    } };
  };

  // ---------------------------------------------------------------- blueprint & instances
  function srcMaterialFinder(A) {
    return function (meshName, baseScene, primitive) {
      var found = null, scene = baseScene || bases[A.base], count = 0;
      scene.traverse(function (n) { if (found || !n.isMesh) return; if (n.name === meshName || (n.parent && n.parent.name === meshName) || n.name.indexOf(meshName) === 0) { if ((primitive || 0) === count) found = n.material; count++; } });
      if (!found) throw Error('Malzeme bulunamadı: ' + meshName);
      return found;
    };
  }
  function blueprint(type) {
    if (blueprints[type]) return blueprints[type];
    var cfg = TYPES[type], A = Assembly(cfg.base); A.srcMaterial = srcMaterialFinder(A);
    var recipe = R[type](A), built = A.build(recipe.materials || {});
    // body height from body parts only (helmets, horns and crowns may rise above it)
    var box = new T.Box3(); built.meshes.forEach(function (m) { if (A.parts.some(function (p) { return p.body && p.key === m.name; })) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); } });
    var h = box.max.y - box.min.y, scale = cfg.height / h;
    built.meshes.forEach(function (m) { m.boundingSphere = new T.Sphere(new T.Vector3(0, h * .5, 0), h * 1.1); });
    var anchors = {};
    function anchor(boneName, frac, toward) { var a = A.P(boneName), t = toward ? A.P(toward) : (A.tail(boneName) || a); var p = a.clone().lerp(t, frac); return { bone: boneName, local: p.applyMatrix4(new T.Matrix4().copy(A.world(A.index[boneName])).invert()) }; }
    if (recipe.chainBetween) { var c = recipe.chainBetween; anchors.chainA = anchor(c[0], .86, c[1]); anchors.chainB = anchor(c[2], .86, c[3]); }
    if (recipe.dragChain) anchors.drag = anchor(recipe.dragChain, .5);
    var bp = { type: type, scene: built.scene, scale: scale, yOffset: -box.min.y * scale, weapon: recipe.weapon ? { art: weaponGroup(recipe.weapon), tip: recipe.weapon.tip } : null, anchors: anchors, recipe: recipe };
    blueprints[type] = bp; return bp;
  }
  // Character maps are resized once, before their first upload: Düşük halves them (2048 -> 1024, 1024 -> 512) and
  // touch tablets cap them at 1024 px. The browser's own resampler keeps the unpremultiplied alpha (skin masks) intact;
  // where it is missing the original maps are kept.
  function fitTextures(model, opts) {
    var scale = opts && opts.textureScale || 1, cap = opts && opts.maxTexture || 8192, seen = new Set(), jobs = [];
    if (typeof createImageBitmap !== 'function') return Promise.resolve();
    model.traverse(function (n) {
      if (!n.isMesh) return;
      (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) {
        ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap', 'emissiveMap'].forEach(function (k) {
          var t = m[k], img = t && t.image; if (!img || seen.has(t)) return; seen.add(t);
          var w = img.width, h = img.height, f = Math.min(scale, cap / Math.max(w || 1, h || 1)); if (!w || !h || f >= 1) return;
          jobs.push(createImageBitmap(img, { resizeWidth: Math.max(1, Math.round(w * f)), resizeHeight: Math.max(1, Math.round(h * f)), resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
            .then(function (small) { if (img.close) img.close(); t.image = small; t.needsUpdate = true; }, function () { /* keep the full-size map */ }));
        });
      });
    });
    return Promise.all(jobs);
  }
  function prepare(opts) {
    if (prepared) return prepared;
    var data = B.CharacterData || {};
    prepared = Promise.all(Object.keys(data).map(function (name) {
      return new T.GLTFLoader().parseAsync(decode(data[name]), '').then(function (gltf) {
        var model = gltf.scene; model.updateMatrixWorld(true); bases[name] = model;
        model.traverse(function (n) { if (!n.isMesh) return; var ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach(function (m) { ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap'].forEach(function (k) { if (m[k]) m[k].anisotropy = 8; }); }); });
        return fitTextures(model, opts);
      });
    })).then(function () {
      if (B.Materials) ['rust', 'leather', 'linen', 'wood', 'masonry'].forEach(function (s) { surfaces[s === 'rust' ? 'iron' : s] = B.Materials.createSurface(s, surfaceTextures, 1); });
      Object.keys(TYPES).forEach(blueprint);
      // Every blueprint owns its own merged geometry now; release the imported source meshes (materials/textures stay shared).
      Object.keys(bases).forEach(function (name) { bases[name].traverse(function (n) { if (n.isMesh) { n.geometry.dispose(); n.geometry = new T.BufferGeometry(); } }); });
      delete B.CharacterData;
    });
    return prepared;
  }
  // ---- Blade trail (hero): a ribbon along the real blade, from the hilt-side edge (30 % up the blade) to the tip. A fixed ring of committed samples (one per
  // TRAIL_SPACING m of tip travel, never one per frame) plus the live blade at its head; each segment is a Catmull-Rom curve cut into ~.05 m columns, so a fast spin
  // (.4 m per frame) is a smooth arc at 60 or 120 fps. Width and brightness follow the tip speed, alpha falls off with age, the streak texture is glued to the path
  // length (no swimming). Premultiplied blending: rgb is added ember light, alpha is the darker steel smoke on the edges. One mesh, one draw call, no per-frame allocation.
  var TRAIL_MAX = 72, TRAIL_SPACING = .045, trailTexture = null, trailUsers = 0;
  function streakTexture() {
    if (trailTexture) return trailTexture;
    var w = 128, h = 32, data = new Uint8Array(w * h * 4), rows = [], seed = 12345;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    for (var j = 0; j < h; j++) rows.push({ base: .12 + .88 * Math.pow(rnd(), 1.4), f: 1 + rnd() * 2, ph: rnd() * TAU, f2: 3 + rnd() * 4, ph2: rnd() * TAU });
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var r0 = rows[y], r1 = rows[(y + 1) % h], k = (x / w) * TAU, blend = .5;
      var a = r0.base * (.55 + .45 * Math.sin(k * Math.round(r0.f) + r0.ph)) * (.8 + .2 * Math.sin(k * Math.round(r0.f2) + r0.ph2));
      var b = r1.base * (.55 + .45 * Math.sin(k * Math.round(r1.f) + r1.ph)) * (.8 + .2 * Math.sin(k * Math.round(r1.f2) + r1.ph2));
      var v = clamp(a * (1 - blend) + b * blend, 0, 1), o = (y * w + x) * 4; data[o] = data[o + 1] = data[o + 2] = Math.round(v * 255); data[o + 3] = 255;
    }
    trailTexture = new T.DataTexture(data, w, h, T.RGBAFormat); trailTexture.wrapS = T.RepeatWrapping; trailTexture.wrapT = T.ClampToEdgeWrapping;
    trailTexture.magFilter = trailTexture.minFilter = T.LinearFilter; trailTexture.generateMipmaps = false; trailTexture.needsUpdate = true;
    return trailTexture;
  }
  function bladeTrail() {
    var tipA = new Float32Array(TRAIL_MAX * 3), baseA = new Float32Array(TRAIL_MAX * 3), timeA = new Float32Array(TRAIL_MAX), pathA = new Float32Array(TRAIL_MAX), speedA = new Float32Array(TRAIL_MAX);
    var MAXC = TRAIL_MAX * 8 + 2, pos = new Float32Array(MAXC * 2 * 3), par = new Float32Array(MAXC * 2 * 4), idx = new Uint16Array((MAXC - 1) * 6);
    for (var c = 0; c < MAXC - 1; c++) { var i2 = c * 6, v0 = c * 2; idx[i2] = v0; idx[i2 + 1] = v0 + 1; idx[i2 + 2] = v0 + 2; idx[i2 + 3] = v0 + 1; idx[i2 + 4] = v0 + 3; idx[i2 + 5] = v0 + 2; }
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage)); geo.setAttribute('aP', new T.BufferAttribute(par, 4).setUsage(T.DynamicDrawUsage)); geo.setIndex(new T.BufferAttribute(idx, 1)); geo.setDrawRange(0, 0);
    trailUsers++;
    var mat = new T.ShaderMaterial({ side: T.DoubleSide, transparent: true, depthWrite: false, fog: false, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendEquation: T.AddEquation,
      uniforms: { map: { value: streakTexture() }, gain: { value: 1 }, core: { value: new T.Color(1.0, .2, .03) }, hot: { value: new T.Color(1.0, .62, .22) }, smoke: { value: new T.Color(.05, .06, .07) } },
      vertexShader: 'attribute vec4 aP;varying vec4 vP;void main(){vP=aP;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D map;uniform float gain;uniform vec3 core,hot,smoke;varying vec4 vP;void main(){float age=vP.x,v=vP.y;float s=texture2D(map,vec2(vP.z*.4,v)).r;' +
        'float fade=pow(max(0.,1.-age),1.5);float edge=smoothstep(0.,.3,v)*(1.-smoothstep(.93,1.,v));float heat=smoothstep(.2,1.,v)*(1.-age*.7);' +
        'float a=fade*edge*(.1+.9*s*s)*vP.w;vec3 ember=mix(core,hot,heat*heat*heat*(1.-age));vec3 add=ember*(.2+.8*heat)*a*gain*1.5;float sm=a*(1.-.5*heat)*.55*gain;' +
        'if(a<.003)discard;gl_FragColor=vec4(add+smoke*sm,sm);}' });
    var mesh = new T.Mesh(geo, mat); mesh.name = 'bladeTrail'; mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false;
    var n = 0, head = 0, time = 0, lastCommit = 0, live = false, path = 0, lastTip = new T.Vector3(), lastBase = new T.Vector3(), prevTip = new T.Vector3(), started = false, sn = 0, life = .3, disposed = false;
    var p0 = new T.Vector3(), p1 = new T.Vector3(), p2 = new T.Vector3(), p3 = new T.Vector3(), q = new T.Vector3(), r = new T.Vector3(), hb = new T.Vector3();
    var tail = { i: 0 };
    function at(k) { return (head - k + TRAIL_MAX * 2) % TRAIL_MAX; }   // k-th newest committed sample
    function commit(tip, base, speedN) {
      head = (head + 1) % TRAIL_MAX; if (n < TRAIL_MAX) n++;
      tipA[head * 3] = tip.x; tipA[head * 3 + 1] = tip.y; tipA[head * 3 + 2] = tip.z; baseA[head * 3] = base.x; baseA[head * 3 + 1] = base.y; baseA[head * 3 + 2] = base.z;
      timeA[head] = time; pathA[head] = path; speedA[head] = speedN; lastCommit = time; lastTip.copy(tip); lastBase.copy(base);
    }
    // sample k of the extended list: k = 0 is the live blade (when live), then the committed ones newest first
    var liveTip = new T.Vector3(), liveBase = new T.Vector3(), liveSpeed = 0;
    function get(k, out, isTip) {
      if (live) { if (k === 0) return out.copy(isTip ? liveTip : liveBase); k--; }
      var i = at(k), a = isTip ? tipA : baseA; return out.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
    }
    function meta(k, o) {
      if (live && k === 0) { o.t = time; o.s = path + liveTip.distanceTo(lastTip); o.w = liveSpeed; return; }
      if (live) k--; var i = at(k); o.t = timeA[i]; o.s = pathA[i]; o.w = speedA[i];
    }
    var mA = { t: 0, s: 0, w: 0 }, mB = { t: 0, s: 0, w: 0 };
    function cr(out, a, b, c, d, t) {   // Catmull-Rom between b and c
      var t2 = t * t, t3 = t2 * t;
      return out.set(.5 * (2 * b.x + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
        .5 * (2 * b.y + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3),
        .5 * (2 * b.z + (-a.z + c.z) * t + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * t2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * t3));
    }
    var bp0 = new T.Vector3(), bp1 = new T.Vector3(), bp2 = new T.Vector3(), bp3 = new T.Vector3(), tq = new T.Vector3(), bq = new T.Vector3();
    function build(detail) {
      var total = n + (live ? 1 : 0), col = 0, subMax = detail < .4 ? 3 : detail < .75 ? 5 : 8, pathHead = 0;
      if (total < 2) { geo.setDrawRange(0, 0); mesh.visible = false; return; }
      meta(0, mA); pathHead = mA.s;
      for (var k = 0; k < total - 1 && col < MAXC - 1; k++) {
        get(Math.max(0, k - 1), p0, true); get(k, p1, true); get(k + 1, p2, true); get(Math.min(total - 1, k + 2), p3, true);
        get(Math.max(0, k - 1), bp0, false); get(k, bp1, false); get(k + 1, bp2, false); get(Math.min(total - 1, k + 2), bp3, false);
        meta(k, mA); meta(k + 1, mB);
        var nSub = clamp(Math.ceil(p1.distanceTo(p2) / .05), 1, subMax), last = k === total - 2;
        for (var j = 0; j <= nSub; j++) {
          if (j === nSub && !last) break;
          var u = j / nSub, age = clamp((time - (mA.t + (mB.t - mA.t) * u)) / life, 0, 1), s = mA.s + (mB.s - mA.s) * u, w = mA.w + (mB.w - mA.w) * u;
          cr(tq, p0, p1, p2, p3, u); cr(bq, bp0, bp1, bp2, bp3, u);
          var span = .35 + .65 * w, taper = 1 - .55 * age * age;   // velocity-based width, pointed tail
          hb.copy(bq).sub(tq).multiplyScalar(span * taper);
          var o = col * 6, o4 = col * 8;
          pos[o] = tq.x + hb.x; pos[o + 1] = tq.y + hb.y; pos[o + 2] = tq.z + hb.z; pos[o + 3] = tq.x; pos[o + 4] = tq.y; pos[o + 5] = tq.z;
          var inten = .3 + .7 * w;
          par[o4] = age; par[o4 + 1] = 0; par[o4 + 2] = s; par[o4 + 3] = inten; par[o4 + 4] = age; par[o4 + 5] = 1; par[o4 + 6] = s; par[o4 + 7] = inten;
          col++; if (col >= MAXC) break;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aP.needsUpdate = true;
      geo.setDrawRange(0, Math.max(0, col - 1) * 6); mesh.visible = col > 1;
    }
    return {
      mesh: mesh,
      // tip / base: current blade points in the mesh parent's space; active: a swing is being drawn; cfg: { life, gain }
      update: function (dt, tip, base, active, cfg) {
        if (disposed) return; time += dt; life = cfg.life || .3; mat.uniforms.gain.value = cfg.gain === undefined ? 1 : cfg.gain;
        if (active) {
          var jump = started && tip.distanceTo(prevTip) > 4;
          if (!live || jump) { n = 0; path = 0; live = true; sn = 0; lastTip.copy(tip); lastBase.copy(base); commit(tip, base, 0); }
          var speed = dt > 1e-5 ? tip.distanceTo(prevTip) / dt : 0; sn += (clamp(speed / 16, 0, 1) - sn) * (dt > 0 ? 1 - Math.exp(-dt * 26) : 1);
          liveTip.copy(tip); liveBase.copy(base); liveSpeed = sn;
          var dist = tip.distanceTo(lastTip);
          if (dist >= TRAIL_SPACING || time - lastCommit > .05) { path += dist; commit(tip, base, sn); }
        } else if (live) { live = false; }
        prevTip.copy(tip); started = true;
        while (n > 0 && time - timeA[at(n - 1)] > life) n--;
        build(cfg.detail === undefined ? 1 : cfg.detail);
      },
      clear: function () { n = 0; live = false; mesh.visible = false; geo.setDrawRange(0, 0); started = false; },
      dispose: function () {
        if (disposed) return; disposed = true; if (mesh.parent) mesh.parent.remove(mesh); geo.dispose(); mat.dispose();
        if (--trailUsers <= 0 && trailTexture) { trailTexture.dispose(); trailTexture = null; trailUsers = 0; }
      }
    };
  }
  // Which swing (if any) the hero's blade draws right now: the whirlwind for its whole length, otherwise a short window around the damage frame of a blow.
  var trailCfg = { on: false, life: .3, gain: 1, detail: 1 };
  function trailWindow(state) {
    var c = trailCfg, s = B.app && B.app.settings, pc = s && s.particles, whirl = state.whirl;
    c.detail = pc ? clamp((pc - 120) / 420, .2, 1) : 1; c.on = false;
    if (Number.isFinite(whirl) && whirl >= 0) { c.on = true; c.life = .24; c.gain = 1.1; return c; }
    var age = state.attackTime, strike = state.attackStrike;
    if (Number.isFinite(age) && age >= 0 && Number.isFinite(strike)) {
      var heavy = !!state.heavy, cleave = !heavy && state.combo === 2, lead = heavy ? .17 : cleave ? .13 : .11, tl = heavy ? .12 : cleave ? .05 : .08;
      c.on = age > strike - lead && age < strike + tl; c.life = heavy ? .2 : cleave ? .16 : .14; c.gain = heavy ? 1 : cleave ? .9 : .75;
    }
    return c;
  }
  // ---- Whirlwind flare (hero): the mantle fur, the loincloth and the beard are skinned to the rigid spine / pelvis / head, so they cannot swing on their own. Their
  // (cloned) materials get a small vertex offset driven by kFlare (0..1, set from authored-motion's spin speed): pushed out from the body axis and lifted at the hem,
  // beard and moustache streaming back against the turn. [outward m, lift m, trail m, hem weight] per mesh; skin and metal never move.
  var FLARE = { fur: [.13, .07, .07, .45], furfringe: [.15, .09, .08, .55], tabard: [.2, .13, .04, 1], beard: [.05, .015, .12, 1], beardmass: [.06, .02, .14, 1], moustache: [.03, .01, .07, 1] };
  function flareMesh(mesh, u) {
    var spec = FLARE[mesh.name], src = mesh.material; if (!spec || !src || Array.isArray(src) || !src.onBeforeCompile) return;
    var g = mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
    var m = src.clone(), before = src.onBeforeCompile, key = src.customProgramCacheKey, top = g.boundingBox.max.y, bottom = g.boundingBox.min.y;
    m.defines = Object.assign({}, src.defines); m.defaultAttributeValues = src.defaultAttributeValues; m.userData = src.userData; m.name = src.name;
    m.onBeforeCompile = function (sh, r) {
      before.call(this, sh, r); sh.uniforms.kFlare = u; sh.uniforms.kFlareP = { value: new T.Vector4(spec[0], spec[1], spec[2], spec[3]) }; sh.uniforms.kFlareY = { value: new T.Vector2(top, bottom) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float kFlare;uniform vec4 kFlareP;uniform vec2 kFlareY;')
        .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n{float fw=kFlare*mix(kFlareP.w,1.,smoothstep(kFlareY.x,kFlareY.y,transformed.y));vec2 rd=transformed.xz/max(length(transformed.xz),.05);' +
          'transformed.xz+=rd*kFlareP.x*fw;transformed.y+=kFlareP.y*fw;transformed.x-=kFlareP.z*fw;}');
    };
    m.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flare-1'; };
    mesh.material = m; mesh.frustumCulled = false; return m;
  }
  var linkGeometry = null;
  function create(type) {
    type = TYPES[type] ? type : 'prisoner';
    var cfg = TYPES[type], bp = blueprints[type] || (bases[TYPES[type].base] ? blueprint(type) : null);
    if (!bp) throw Error('Karakter kaplamaları henüz yüklenmedi.');
    var root = new T.Group(); root.name = type;
    var scene = cloneSkin(bp.scene); root.add(scene); scene.scale.setScalar(bp.scale); scene.position.y = bp.yOffset;
    var native = {}; scene.traverse(function (n) { if (n.isBone) native[n.name] = n; });
    var flareU = { value: 0 }, flareMats = [];
    if (type === 'hero') scene.traverse(function (n) { if (n.isSkinnedMesh) { var fm = flareMesh(n, flareU); if (fm) flareMats.push(fm); } });
    root.updateMatrixWorld(true);
    function find(names) { for (var i = 0; i < names.length; i++) { var n = native[names[i]] || native[names[i].replace(/\./g, '')]; if (n) return n; } return null; }
    var rightHand = find(['hand_r', 'hand.R', 'handR']); if (!rightHand) throw Error('Karakterin sağ el kemiği eksik.');
    var weapon = new T.Group(); weapon.name = 'weapon'; rightHand.add(weapon);
    var marker = new T.Object3D(); marker.name = 'weapon_tip';
    if (bp.weapon) { weapon.add(bp.weapon.art.clone()); marker.position.copy(bp.weapon.tip); } else marker.position.set(0, .08, .22);
    weapon.add(marker); weapon.scale.setScalar(1 / bp.scale);
    var extras = [], disposables = [];
    function anchorObject(a) { var o = new T.Object3D(); o.position.copy(a.local); native[a.bone].add(o); return o; }
    if (bp.anchors.chainA) {
      // Live chain between the shackles: parabolic sag recomputed from the wrists every frame.
      if (!linkGeometry) linkGeometry = G.link(.075);
      var count = 13, links = new T.InstancedMesh(linkGeometry, gearMaterial('dark'), count); links.castShadow = true; links.frustumCulled = false; root.add(links); disposables.push(links);
      var aObj = anchorObject(bp.anchors.chainA), bObj = anchorObject(bp.anchors.chainB), pa = new T.Vector3(), pb = new T.Vector3(), pt = new T.Vector3(), nx = new T.Vector3(), mm = new T.Matrix4(), qq = new T.Quaternion(), qy = new T.Quaternion(), yAxis = new T.Vector3(0, 1, 0), one = new T.Vector3(1, 1, 1);
      extras.push(function () {
        aObj.getWorldPosition(pa); bObj.getWorldPosition(pb); root.worldToLocal(pa); root.worldToLocal(pb);
        var d = pa.distanceTo(pb), L = .95, sag = Math.sqrt(Math.max(0, L * L - d * d)) * .5;
        function at(t, out) { out.lerpVectors(pa, pb, t); out.y -= sag * 4 * t * (1 - t); out.y = Math.max(out.y, .03); return out; }
        for (var i = 0; i < count; i++) {
          var t0 = i / count, t1 = (i + 1) / count; at(t0, pt); at(t1, nx); var dir = nx.clone().sub(pt), len = dir.length(); if (len < 1e-5) dir.set(0, 1, 0); else dir.multiplyScalar(1 / len);
          qq.setFromUnitVectors(yAxis, dir); qy.setFromAxisAngle(yAxis, i % 2 ? PI / 2 : 0); qq.multiply(qy);
          mm.compose(pt.clone().add(nx).multiplyScalar(.5), qq, one); links.setMatrixAt(i, mm);
        }
        links.instanceMatrix.needsUpdate = true;
      });
    }
    if (bp.anchors.drag) {
      // Boss: heavy chain from the left fist, dragged on the floor behind him, hook at the end (verlet).
      if (!linkGeometry) linkGeometry = G.link(.075);
      var n = 22, seg = .16, dragLinks = new T.InstancedMesh(linkGeometry, gearMaterial('dark'), n * 2); dragLinks.castShadow = true; dragLinks.frustumCulled = false; root.add(dragLinks); disposables.push(dragLinks);
      var hookArt = weaponGroup(G.hook()); hookArt.scale.setScalar(1.6); root.add(hookArt); disposables.push(hookArt);
      var anchor = anchorObject(bp.anchors.drag), nodes = [], prev = [], ready = false, wp = new T.Vector3(), tmp = new T.Vector3(), q2 = new T.Quaternion(), q3 = new T.Quaternion(), mx = new T.Matrix4(), sc1 = new T.Vector3(1.9, 1.9, 1.9), up = new T.Vector3(0, 1, 0);
      for (var k = 0; k < n; k++) { nodes.push(new T.Vector3()); prev.push(new T.Vector3()); }
      extras.push(function (dt, state) {
        anchor.getWorldPosition(wp);
        if (!ready || state.reset || nodes[0].distanceTo(wp) > 4) { for (var i = 0; i < n; i++) { nodes[i].set(wp.x, Math.max(.04, wp.y - i * seg), wp.z); if (wp.y - i * seg < .04) { root.localToWorld(tmp.set(0, 0, -(i * seg - wp.y))); nodes[i].x = tmp.x; nodes[i].z = tmp.z; } prev[i].copy(nodes[i]); } ready = true; }
        var h = Math.min(dt || 0, 1 / 30);
        if (h > 0) {
          for (i = 1; i < n; i++) { var p = nodes[i], o = prev[i], vx = (p.x - o.x) * .985, vy = (p.y - o.y) * .985, vz = (p.z - o.z) * .985; o.copy(p); p.x += vx; p.y += vy - 9.8 * h * h; p.z += vz; if (p.y < .045) { p.y = .045; o.x = mix(o.x, p.x, .35); o.z = mix(o.z, p.z, .35); } }
          nodes[0].copy(wp); prev[0].copy(wp);
          for (var it = 0; it < 6; it++) for (i = 0; i < n - 1; i++) { var a = nodes[i], b = nodes[i + 1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, diff = (d - seg) / d; if (i === 0) { b.x -= dx * diff; b.y -= dy * diff; b.z -= dz * diff; } else { a.x += dx * diff * .5; a.y += dy * diff * .5; a.z += dz * diff * .5; b.x -= dx * diff * .5; b.y -= dy * diff * .5; b.z -= dz * diff * .5; } if (b.y < .045) b.y = .045; }
        }
        var inv = new T.Matrix4().copy(root.matrixWorld).invert();
        for (i = 0; i < n - 1; i++) {
          tmp.subVectors(nodes[i + 1], nodes[i]); var len = tmp.length() || 1e-6; tmp.multiplyScalar(1 / len); q2.setFromUnitVectors(up, tmp);
          for (var s2 = 0; s2 < 2; s2++) { q3.setFromAxisAngle(up, (i * 2 + s2) % 2 ? PI / 2 : 0); var q4 = q2.clone().multiply(q3); var mid = nodes[i].clone().lerp(nodes[i + 1], (s2 + .5) / 2); mx.compose(mid, q4, sc1).premultiply(inv); dragLinks.setMatrixAt(i * 2 + s2, mx); }
        }
        dragLinks.count = (n - 1) * 2; dragLinks.instanceMatrix.needsUpdate = true;
        var last = nodes[n - 1], beforeLast = nodes[n - 2]; tmp.subVectors(last, beforeLast).normalize(); q2.setFromUnitVectors(new T.Vector3(0, -1, 0), tmp);
        hookArt.position.copy(last).applyMatrix4(inv); hookArt.quaternion.copy(q2).premultiply(new T.Quaternion().setFromRotationMatrix(inv));
      });
    }
    var motion = B.AuthoredMotion.create({ root: root, modelScene: scene, type: type, bones: native, weapon: weapon, weaponTip: marker, scale: bp.scale });
    var aliases = motion.bones; aliases.weapon = weapon;
    var disposed = false, trail = type === 'hero' && bp.weapon ? bladeTrail() : null, trailA = new T.Vector3(), trailB = new T.Vector3(), trailInv = new T.Matrix4();
    if (flareMats.length) extras.push(function () { flareU.value = clamp(root.userData.whirlFlare || 0, 0, 1); });
    if (trail) extras.push(function (dt, state) {
      // the ribbon lives beside the hero (in his parent's space) so it stays in the world when he moves; reset on a restart / teleport
      var parent = root.parent; if (!parent) return;
      if (trail.mesh.parent !== parent) parent.add(trail.mesh);
      if (state.reset) trail.clear();
      var c = trailWindow(state); parent.updateWorldMatrix(true, false); trailInv.copy(parent.matrixWorld).invert();
      marker.getWorldPosition(trailA).applyMatrix4(trailInv); weapon.getWorldPosition(trailB); trailB.applyMatrix4(trailInv); trailB.lerp(trailA, .3);
      trail.update(dt, trailA, trailB, c.on && !state.dead, c);
    });
    return {
      root: root, height: cfg.height, radius: cfg.radius, weaponTip: marker, bones: aliases, type: type, ownTrail: !!trail,
      animate: function (dt, state) { state = state || {}; motion.animate(dt, state); for (var i = 0; i < extras.length; i++) extras[i](dt, state); },
      dispose: function () {
        if (disposed) return; disposed = true; motion.dispose(); if (trail) trail.dispose(); flareMats.forEach(function (fm) { fm.dispose(); }); if (root.parent) root.parent.remove(root);
        var skeletons = new Set(); scene.traverse(function (n) { if (n.isSkinnedMesh) skeletons.add(n.skeleton); }); skeletons.forEach(function (s) { s.dispose(); });
        disposables.forEach(function (d) { if (d.isInstancedMesh) d.dispose(); });
        root.clear();
      }
    };
  }
  B.Models = { create: create, prepare: prepare, templates: bases, blueprints: blueprints, types: TYPES };
})();
