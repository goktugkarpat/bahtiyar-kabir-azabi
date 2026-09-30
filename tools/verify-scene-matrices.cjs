'use strict';
// Production scene-matrix guard against the native path, with actual models/world and inert audio.
// Run normally for correctness/counts; add --benchmark for alternating CPU timings (not gameplay FPS).
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || path.resolve(__dirname, '..'));
const benchmark = process.argv.includes('--benchmark');
global.window = global; global.self = global;
Object.defineProperty(global, 'navigator', { value: { userAgent: 'Node silent scene matrix QA', platform: 'Win32' }, configurable: true });
global.location = { search: '?sessiz', href: 'file:///scene-matrix-qa?sessiz' };
global.matchMedia = () => ({ matches: false, addEventListener() {} });
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
function canvas() {
  const c = { width: 1, height: 1, style: {}, toDataURL: () => '', getBoundingClientRect: () => ({ width: c.width, height: c.height }) };
  const ctx = new Proxy({ canvas: c, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), measureText: s => ({ width: String(s).length * 10 }) },
  { get: (o, k) => k in o ? o[k] : () => {} });
  c.getContext = k => k === '2d' ? ctx : null; return c;
}
global.document = { createElement: () => canvas(), getElementById: () => ({ width: 1920, height: 1080 }), readyState: 'loading', addEventListener() {} };
global.Image = class { constructor() { this.width = this.height = 1024; } set src(s) { queueMicrotask(() => this.onload && this.onload()); } };
const load = n => vm.runInThisContext(fs.readFileSync(path.join(root, n), 'utf8'), { filename: path.join(root, n) });
load('vendor/three.js'); load('vendor/gltf-loader.js');
THREE.TextureLoader.prototype.load = function (url, onLoad) { const t = new THREE.Texture({ width: 1024, height: 1024 }); queueMicrotask(() => onLoad(t)); return t; };
THREE.PMREMGenerator = class { fromScene() { return { texture: new THREE.Texture() }; } dispose() {} };
for (const n of ['src/materials.js', 'src/models.js', 'assets/characters/characters.js', 'assets/characters/authored-clips.js',
  'src/authored-motion.js', 'src/authored-models.js', 'src/world.js', 'src/limbs.js', 'src/globes.js', 'src/combat.js']) load(n);

(async () => {
 const {performance}=require('node:perf_hooks');
 await BABA.Models.prepare({textureScale:1});
 const scene=new THREE.Scene(), world=BABA.World.build(scene,{multiDraw:true}), events=[];
 let counting=false,composeCount=0,matrixCount=0;
 const composeNative=THREE.Matrix4.prototype.compose,updateNative=THREE.Object3D.prototype.updateMatrixWorld;
 THREE.Matrix4.prototype.compose=function(){if(counting)composeCount++;return composeNative.apply(this,arguments)};
 THREE.Object3D.prototype.updateMatrixWorld=function(){if(counting)matrixCount++;return updateNative.apply(this,arguments)};
 // Remember inherited and custom own methods before Game installs its instance guards.
 const ownership=[],modelCreate=BABA.Models.create;let ownInstalled=false;
 BABA.Models.create=function(type){
  const model=modelCreate(type),node=model.root;
  if(type==='prisoner'&&!ownInstalled){
   const native=node.updateMatrixWorld;node.updateMatrixWorld=function(force){return native.call(this,force)};ownInstalled=true;
  }
  ownership.push({node,descriptor:Object.getOwnPropertyDescriptor(node,'updateMatrixWorld'),method:node.updateMatrixWorld});return model;
 };
 const game=BABA.Game.create(world,{scene,emit:(name,data)=>events.push({name,data}),fx(){},sound(){}});
 BABA.Models.create=modelCreate;
 game.setQuality({impact:0}); game.start(); game.debug.invincible(true);
 for(const enemy of game.enemies) enemy.cooldown=999;
 const draw=enabled=>{if(enabled)game.beginRenderTraversal();try{scene.updateMatrixWorld()}finally{if(enabled)game.endRenderTraversal()}};
 const nodes=()=>{const list=[];scene.traverse(n=>list.push(n));return list};
 const snapshot=list=>list.map(n=>[n,n.matrixWorld.elements.slice(),n.matrix.elements.slice(),n.matrixWorldNeedsUpdate]);
 const restore=states=>{for(const [n,mw,m,dirty]of states){n.matrixWorld.fromArray(mw);n.matrix.fromArray(m);n.matrixWorldNeedsUpdate=dirty}};
 const visible=n=>{for(let p=n;p;p=p.parent)if(!p.visible)return false;return true};
 let maxDiff=0,compared=0;
 const equal=(a,b,label)=>{assert.equal(a.length,b.length,label+' shape');for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);maxDiff=Math.max(maxDiff,d);assert(d<1e-9,label+' index '+i+' difference '+d);compared++}};
 const boneMatrices=()=>{const seen=new Set(),result=[];scene.traverse(n=>{if(n.isSkinnedMesh&&visible(n)&&!seen.has(n.skeleton)){seen.add(n.skeleton);n.skeleton.update();result.push([n.skeleton,Array.from(n.skeleton.boneMatrices)])}});return result};
 const camera=new THREE.PerspectiveCamera(45,16/9,.1,250);camera.position.set(7,19,15);camera.lookAt(0,0,-25);scene.add(camera);
 const light=new THREE.DirectionalLight(0xffffff,1);light.position.set(9,18,7);scene.add(light,light.target);light.target.position.set(0,0,-20);
 const cameraDir=new THREE.Vector3();
 const renderList=frustum=>nodes().filter(n=>visible(n)&&(n.isMesh||n.isLine||n.isPoints)&&(!n.frustumCulled||frustum.intersectsObject(n))).map(n=>n.uuid);
 const shadowList=frustum=>nodes().filter(n=>visible(n)&&n.castShadow&&(n.isMesh||n.isLine||n.isPoints)&&(!n.frustumCulled||frustum.intersectsObject(n))).map(n=>n.uuid);
 const cameraFrustum=()=>new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const checkPass=label=>{
  const list=nodes(),before=snapshot(list);draw(false);const baseline=snapshot(list),skin=boneMatrices();light.shadow.updateMatrices(light);const shadow=light.shadow.matrix.elements.slice();camera.getWorldDirection(cameraDir);const cam=cameraDir.toArray();
  const rendered=renderList(cameraFrustum()),shadowed=shadowList(light.shadow.getFrustum());
  restore(before);draw(true);
  for(const[n,mw]of baseline)if(visible(n))equal(n.matrixWorld.elements,mw,label+' visible '+n.name);
  for(const[skel,m]of skin){skel.update();equal(skel.boneMatrices,m,label+' skin')}
  light.shadow.updateMatrices(light);equal(light.shadow.matrix.elements,shadow,label+' shadow');camera.getWorldDirection(cameraDir);equal(cameraDir.toArray(),cam,label+' camera');
  assert.deepEqual(renderList(cameraFrustum()),rendered,label+' visible render candidates');
  assert.deepEqual(shadowList(light.shadow.getFrustum()),shadowed,label+' visible shadow candidates');
  // Every direct force update keeps the full native contract, including invisible models.
  scene.updateMatrixWorld(true);for(const[n,mw]of baseline)equal(n.matrixWorld.elements,mw,label+' explicit '+n.name);
 };
 const combatRoot=scene.getObjectByName('KaraGecitCombat');
 for(const z of [8,-35,-90,-128,-156]){game.debug.teleport(0,z);game.update(1/120,{});combatRoot.position.set(.3,-.2,.5);combatRoot.rotation.y=.17;checkPass('teleport '+z)}
 // A child added after model setup and an ancestor transform must catch up on visible entry.
 const foe=game.enemies[0],marker=new THREE.Object3D();marker.name='late_attachment';marker.position.set(.23,.32,-.12);foe.model.bones.weapon.add(marker);
 foe.model.root.visible=false;foe.model.root.position.set(-4,.9,-130);foe.model.root.rotation.y=1.13;combatRoot.position.set(-.7,.3,1.1);combatRoot.rotation.y=-.28;
 const before=snapshot(nodes());draw(false);const expectedMarker=marker.getWorldPosition(new THREE.Vector3()).toArray();restore(before);draw(true);equal(marker.getWorldPosition(new THREE.Vector3()).toArray(),expectedMarker,'hidden getWorldPosition');
 foe.model.root.visible=true;checkPass('visible entry/late attachment/parent yaw/airborne');
 // A true stalker leap and a death pose still use the same visible matrices.
 game.restart();game.debug.invincible(true);for(const enemy of game.enemies)enemy.cooldown=999;
 combatRoot.position.set(0,0,0);combatRoot.rotation.y=0;
 const stalker=game.enemies.find(e=>e.type==='stalker');
 for(const e of game.enemies){e.active=e===stalker;e.activated=e===stalker;e.dead=e!==stalker}
 stalker.encounter.activated=true;stalker.x=0;stalker.z=2;game.debug.teleport(0,8);game.debug.forceMove(stalker.id,'leap');
 let leapSeen=false;for(let i=0;i<260;i++){game.update(1/120,{});if(stalker.model.root.position.y>.2){leapSeen=true;checkPass('real stalker leap');break}}
 assert(leapSeen,'Real AI leap fixture must be airborne');game.debug.damageEnemy(stalker.id,10000);for(let i=0;i<6;i++)game.update(1/120,{});checkPass('death pose');
 // Cut capture from a hidden, transformed actor must stay native outside the renderer scope.
 game.restart();game.debug.invincible(true);game.debug.teleport(0,8);game.update(1/120,{});
 await game.limbs.prepare(game.enemies,()=>Promise.resolve());
 const cutFoe=game.enemies.find(e=>e.type==='guard');cutFoe.model.root.visible=false;cutFoe.model.root.position.set(6,.7,-130);cutFoe.model.root.rotation.y=.63;
 combatRoot.position.set(.2,.1,-.4);combatRoot.rotation.y=.11;
 const cutBefore=snapshot(nodes());
 const cutCapture=enabled=>{draw(enabled);BABA.Limbs.force=[['head']];assert(game.limbs.cut(cutFoe,'heavy',.4,()=>0,game.player)>0);BABA.Limbs.force=null;const slot=game.limbs.slots.find(s=>s.alive);assert(slot);return [...slot.used.flatMap(i=>slot.frozen[i].elements),...slot.j0.toArray(),...slot.a0.toArray(),slot.L]};
 const cutBaseline=cutCapture(false);game.limbs.reset(game.enemies);restore(cutBefore);const cutVariant=cutCapture(true);equal(cutVariant,cutBaseline,'hidden force limb capture');game.limbs.reset(game.enemies);
 // Execute the app's real scope, including its finally path when post.render throws.
 const appSource=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
 const renderScope=appSource.match(/game\.beginRenderTraversal\(\);\s*try\s*\{[\s\S]*?\}\s*finally\s*\{\s*game\.endRenderTraversal\(\);\s*\}/);
 assert(renderScope,'The actual post.render call must close its traversal scope in finally');
 for(const throws of[false,true]){
  cutFoe.model.root.visible=false;cutFoe.model.root.updateMatrixWorld(true);
  const oldWorld=cutFoe.model.root.matrixWorld.elements.slice();cutFoe.model.root.position.x+=2;
  const failure=Error('Deliberate render failure');let drew=false,resets=0;
  const environment={game,elapsed:17,renderer:{info:{reset(){resets++}}},post:{render(time){
   assert.equal(time,17);scene.updateMatrixWorld();drew=true;
   equal(cutFoe.model.root.matrixWorld.elements,oldWorld,'hidden tree skipped only inside actual app render');
   if(throws)throw failure;
  }}};
  if(throws)assert.throws(()=>vm.runInNewContext(renderScope[0],environment),error=>error===failure);
  else vm.runInNewContext(renderScope[0],environment);
  assert(drew);assert.equal(resets,1);cutFoe.model.root.updateMatrixWorld(true);
  assert.notDeepEqual(cutFoe.model.root.matrixWorld.elements,oldWorld,'The finally path restores hidden explicit updates after success or throw');
 }
 // The flag belongs to this game, even when two games temporarily share one scene during checkpoint QA.
 const other=BABA.Game.create(world,{scene,emit(){},fx(){},sound(){}}),otherRoot=other.enemies[0].model.root;
 otherRoot.visible=false;otherRoot.updateMatrixWorld(true);const otherBefore=otherRoot.matrixWorld.elements.slice();otherRoot.position.x+=3;
 game.beginRenderTraversal();try{otherRoot.updateMatrixWorld(true)}finally{game.endRenderTraversal()}
 assert.notDeepEqual(otherRoot.matrixWorld.elements,otherBefore,'A render scope cannot suppress another game\'s actors');other.dispose();
 console.log('CORRECTNESS',JSON.stringify({maxDiff,compared,realLeap:leapSeen,hiddenLimbCapture:true}));
 // Warm and time only native scene matrix passes, with alternating order to reduce JIT/order noise.
 function timings(label,z,title=false){game.restart();game.debug.invincible(true);for(const e of game.enemies)e.cooldown=999;game.debug.teleport(0,z);game.update(1/120,{});if(title)game.toTitle();combatRoot.position.set(0,0,0);combatRoot.rotation.y=0;
  const all=nodes();let modelNodes=0,hiddenModelNodes=0;for(const e of game.enemies){let n=0;e.model.root.traverse(()=>n++);modelNodes+=n;if(!e.model.root.visible)hiddenModelNodes+=n}
  if(benchmark)for(let i=0;i<500;i++)draw(i%2===0);
  const samples={baseline:[],guard:[]};if(benchmark)for(let round=0;round<8;round++){for(const enabled of round%2?[true,false]:[false,true]){const start=performance.now();for(let i=0;i<1000;i++)draw(enabled);samples[enabled?'guard':'baseline'].push((performance.now()-start)/1000)}}
  const counts={};for(const enabled of[false,true]){composeCount=matrixCount=0;counting=true;draw(enabled);counting=false;counts[enabled?'guard':'baseline']={composes:composeCount,matrixCalls:matrixCount}}
  if(hiddenModelNodes){assert(counts.guard.composes<counts.baseline.composes);assert(counts.guard.matrixCalls<counts.baseline.matrixCalls)}
  else assert.deepEqual(counts.guard,counts.baseline,'A fully visible scene retains all native matrix work');
  const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;return{label,nodes:all.length,modelNodes,hiddenModelNodes,visibleFoes:game.enemies.filter(e=>e.model.root.visible).length,...(benchmark?{msPerPass:{baseline:mean(samples.baseline),guard:mean(samples.guard)},samples}:{}),counts};
 }
 for(const spec of[['spawn',8],['middle',-90],['chapel',-128],['boss',-156],['title',8,true]])console.log('CPU',JSON.stringify(timings(...spec)));
 // Disposal restores inherited/custom ownership, and does not overwrite a newer outside owner.
 const foreignNode=game.enemies.at(-1).model.root,foreignMethod=function(){};foreignNode.updateMatrixWorld=foreignMethod;
 game.beginRenderTraversal();game.dispose();assert.equal(foreignNode.updateMatrixWorld,foreignMethod);
 for(const saved of ownership){
  if(saved.node===foreignNode)continue;
  assert.equal(saved.node.updateMatrixWorld,saved.method,'Disposal restores the previous update method');
  assert.deepEqual(Object.getOwnPropertyDescriptor(saved.node,'updateMatrixWorld'),saved.descriptor,'Disposal restores own/inherited method ownership');
 }
 THREE.Matrix4.prototype.compose=composeNative;THREE.Object3D.prototype.updateMatrixWorld=updateNative;
 world.dispose();console.log('ALL SCENE MATRICES: PASS (actual world/models and production render guard; no WebGL/audio)');
})().catch(e=>{console.error(e);process.exitCode=1});
