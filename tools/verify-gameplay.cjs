'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os'),{performance}=require('node:perf_hooks'),inspector=require('node:inspector');
// CPU-only actual-model regression: no browser, GPU or audio output. No packages required.
const root=process.argv[2]||path.resolve(__dirname,'..');global.window=global;global.self=global;Object.defineProperty(global,'navigator',{value:{userAgent:'Node CPU benchmark; no browser',platform:'Win32'},configurable:true});global.location={search:'?sessiz',href:'file:///cpu-benchmark'};global.matchMedia=()=>({matches:false,addEventListener(){}});global.innerWidth=1920;global.innerHeight=1080;global.devicePixelRatio=1;global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
function canvas(){const c={width:1,height:1,style:{},toDataURL:()=>'',getBoundingClientRect:()=>({width:c.width,height:c.height})};const ctx=new Proxy({canvas:c,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),measureText:s=>({width:String(s).length*10})},{get:(o,k)=>k in o?o[k]:()=>{}});c.getContext=k=>k==='2d'?ctx:null;return c;}
global.document={createElement:k=>canvas(),getElementById:()=>({width:1920,height:1080}),readyState:'loading',addEventListener(){}};
global.Image=class{constructor(){this.width=this.height=1024;}set src(s){queueMicrotask(()=>this.onload&&this.onload());}};
const load=n=>vm.runInThisContext(fs.readFileSync(path.join(root,n),'utf8'),{filename:path.join(root,n)});
load('vendor/three.js');load('vendor/gltf-loader.js');
THREE.TextureLoader.prototype.load=function(url,onLoad){const t=new THREE.Texture({width:1024,height:1024});queueMicrotask(()=>onLoad(t));return t;};
THREE.PMREMGenerator=class{fromScene(){return{texture:new THREE.Texture()}}dispose(){}};
for(const n of ['src/materials.js','src/models.js','assets/characters/characters.js','assets/characters/authored-clips.js','src/authored-motion.js','src/authored-models.js','src/world.js','src/limbs.js','src/globes.js','src/combat.js','src/telegraphs.js','src/effects.js','src/lighting.js'])load(n);
const assert=require('node:assert');
(async()=>{
 await BABA.Models.prepare({textureScale:1});const scene=new THREE.Scene(),world=BABA.World.build(scene,{multiDraw:true});const store=new Map();global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};const events=[],fx=[],sounds=[];const game=BABA.Game.create(world,{scene,emit:(n,d)=>events.push({n,d}),fx:(n,d)=>fx.push({n,d}),sound:(n,d)=>sounds.push({n,d})});game.setQuality({impact:0});game.start();
 const tick=(seconds,input={},fps=120)=>{for(let i=0;i<Math.ceil(seconds*fps);i++){game.update(1/fps,typeof input==='function'?input(i):input);assert(Number.isFinite(game.player.x)&&Number.isFinite(game.player.z));assert(world.isWalkable(game.player.x,game.player.z,game.player.model.radius));}};
 const balancedHp={prisoner:195,guard:338,cultist:191,stalker:215,carrier:284,boss:3150};
 for(const enemy of game.enemies){assert.equal(enemy.hp,balancedHp[enemy.type]);assert.equal(enemy.maxHp,balancedHp[enemy.type]);}
 console.log('DIFFICULTY all five mobs/boss modest health step: PASS');
 game.debug.invincible(true);for(const e of game.enemies)e.cooldown=999;game.debug.teleport(0,-4.8);tick(1,{z:-1});assert(game.player.z>=-5.65+game.player.model.radius-1e-5);assert(game.enemies.filter(e=>e.encounter.room>0).every(e=>!e.active));for(const e of game.enemies.filter(e=>e.encounter.room===0))game.debug.damageEnemy(e.id,10000);tick(2,{z:-1});assert(game.player.z<-7);assert(game.debug.snapshot().seals[0].open);console.log('SEAL blocked/open/next-room: PASS');
 for(const e of game.enemies.filter(e=>!e.boss&&!e.dead))game.debug.damageEnemy(e.id,10000);
 game.debug.teleport(0,-120);tick(.01);game.update(1/120,{stand:true,clickLight:true,target:game.boss,pointX:game.boss.x,pointZ:game.boss.z});assert(game.attackTarget===game.boss,'A visible selected attack target is available before contact');
 game.globes.spawn(0,-120,0,1);assert(game.globes.stats().alive>0);game.debug.teleport(0,-128);game.debug.setPlayer({hp:30,stamina:20,flasks:1});game.player.specialCd=5;game.player.rageCd=12;tick(.05);assert.equal(game.checkpointIndex,1);assert.equal(game.attackTarget,null,'Checkpoint clears the old attack target');assert.equal(game.globes.stats().alive,0,'Checkpoint clears old room drops');assert.equal(game.player.hp,125);assert.equal(game.player.stamina,110);assert.equal(game.player.flasks,4);assert.equal(game.player.specialCd,0);assert.equal(game.player.rageCd,0);const saved=JSON.parse(store.get(game.debug.storageKey));assert.equal(saved.dead.length,30);assert(game.hasSave);
 game.debug.invincible(false);game.debug.strike({damage:1000});assert.equal(game.state,'dead');game.respawn();assert.equal(game.state,'playing');assert.equal(game.player.z,-128);assert(game.enemies.filter(e=>!e.boss).every(e=>e.dead));assert.equal(game.boss.hp,balancedHp.boss);assert.equal(events.filter(e=>e.n==='encounterCleared').length,5);assert.deepEqual(events.filter(e=>e.n==='encounterCleared').map(e=>e.d.nextName),['Zincir Avlusu','Çürüyen Revir','Adak Salonu','Kemik Geçidi','Sessiz Şapel']);console.log('CHECKPOINT restore/resources/death and five unique room clears: PASS');
 const resumed=BABA.Game.create(world,{scene,emit(){},fx(){},sound(){}});assert(resumed.hasSave);resumed.toTitle();assert.equal(resumed.player.z,8);resumed.start();assert.equal(resumed.player.z,-128);resumed.dispose();
 const corrupted={...saved,dead:saved.dead.slice(0,10)};store.set(game.debug.storageKey,JSON.stringify(corrupted));const invalid=BABA.Game.create(world,{scene,emit(){},fx(){},sound(){}});assert(!invalid.hasSave);invalid.start();assert.equal(invalid.player.z,8);invalid.dispose();store.set(game.debug.storageKey,JSON.stringify(saved));console.log('SAVE valid/malformed/title: PASS');
 game.debug.invincible(true);game.debug.teleport(0,-157);game.debug.activateBoss();game.debug.damageEnemy(game.boss.id,1511);assert.equal(game.boss.hp,1639);assert.equal(game.boss.phase,1,'Health just above 52% retains the first phase');game.debug.damageEnemy(game.boss.id,1);assert.equal(game.boss.phase,2);assert.equal(game.boss.action.moveId,'roar');assert(game.hazards.filter(h=>h.owner===game.boss).every(h=>h.attack==='Kanlı Yemin'));assert.equal(sounds.filter(s=>s.n==='bossPhase').length,1);tick(2);game.debug.damageEnemy(game.boss.id,850);tick(.03);assert.equal(game.boss.hp,788);assert(!game.boss.enraged,'Health just above 25% retains the second phase');game.debug.damageEnemy(game.boss.id,1);tick(.03);assert(game.boss.enraged);assert.equal(game.boss.action.moveId,'roar');assert.equal(sounds.filter(s=>s.n==='bossPhase').length,2);game.respawn();assert.equal(game.boss.phase,1);assert(!game.boss.enraged);assert.equal(game.boss.hp,balancedHp.boss);console.log('BOSS unchanged 52%/25% thresholds, phase/last oath/respawn: PASS');
 game.restart();game.debug.invincible(false);game.player.rageTime=1;events.length=fx.length=0;game.debug.strike({damage:10});assert.equal(game.player.hp,117);assert.equal(events.find(e=>e.n==='hit').d.damage,8);assert.equal(fx.find(e=>e.n==='blood').d.damage,8);tick(.2);game.player.roar={age:0,released:false,serial:123};const hp=game.player.hp;events.length=fx.length=0;game.debug.strike({damage:10});assert.equal(game.player.hp,hp-5);assert.equal(events.find(e=>e.n==='hit').d.damage,5);console.log('DAMAGE fury/cry/event/can loss: PASS');
 // Owned enemy damage gets the small increase once; health, labels and cry/fury defence use the same final wound.
 for(const type of ['prisoner','boss'])for(const defence of ['plain','fury','cry']){
   game.restart();game.debug.invincible(false);for(const enemy of game.enemies)enemy.cooldown=999;
   if(defence==='fury')game.player.rageTime=1;else if(defence==='cry')game.player.roar={age:0,released:false,serial:123};
   const owner=game.enemies.find(e=>e.type===type),expected=type==='boss'?{plain:54,fury:41,cry:27}:{plain:31,fury:24,cry:16};events.length=fx.length=0;
   game.debug.strike({damage:type==='boss'?50:25,owner});
   assert.equal(game.player.hp,125-expected[defence]);assert.equal(events.find(e=>e.n==='hit').d.damage,expected[defence]);assert.equal(fx.find(e=>e.n==='blood').d.damage,expected[defence]);
 }
 console.log('DIFFICULTY common/boss contact damage, unchanged fury/cry protection and matching labels: PASS');
 const rates=[];for(const fps of [30,60,120,200,240]){game.restart();game.debug.invincible(true);const e=game.enemies[0],speed=e.stats.speed;for(const other of game.enemies){other.dead=other!==e;other.active=other===e;other.activated=other===e;}e.encounter.activated=true;e.cooldown=0;e.spWait=0;e.spHold=0;e.stats.speed=0;e.index=0;game.debug.teleport(e.x,e.z+6);let began=0;for(let i=0;i<fps*2;i++){game.update(1/fps,{});if(e.action){began=game.elapsed;break;}}e.stats.speed=speed;assert(began>=1.5-1e-5&&began<=1.5+1/fps+1e-5,JSON.stringify({fps,began}));rates.push({fps,began});}console.log('AI_HOLD',JSON.stringify(rates));
 game.restart();game.debug.invincible(true);const e=game.enemies[0],speed=e.stats.speed;for(const other of game.enemies){other.dead=other!==e;other.active=other===e;other.activated=other===e;}e.encounter.activated=true;e.x=-5.6;e.z=-123.15;e.cooldown=999;e.stats.speed=0;game.debug.teleport(-5.6,-126.7);assert(world.isWalkable((game.player.x+e.x)*.5,(game.player.z+e.z)*.5,.12),'Old midpoint should falsely look clear');assert(!world.hasClearPath(game.player.x,game.player.z,e.x,e.z,.08));const hp0=e.hp;tick(.65,i=>({stand:true,clickHeavy:i===0,pointX:e.x,pointZ:e.z,target:e}));assert.equal(e.hp,hp0);game.debug.teleport(-5.6,-126.1);tick(.1,i=>({clickHeavy:i===0,pointX:e.x,pointZ:e.z,target:e}));assert(!game.player.attack,'Never start a click attack through furniture');tick(4);assert(e.hp<hp0,'Click should route around pew and land its attack');e.stats.speed=speed;console.log('WALL stand attack blocked/click detour/hit: PASS');
 game.restart();game.debug.invincible(true);const follower=game.enemies[0];for(const other of game.enemies){other.dead=other!==follower;other.active=other===follower;other.activated=other===follower;}follower.encounter.activated=true;follower.x=-5.6;follower.z=-123.15;follower.cooldown=0;follower.spWait=2;game.debug.teleport(-5.6,-126.7);tick(.2);assert(!follower.action,'Foe should navigate before attacking through a pew');let found=false;for(let i=0;i<700;i++){game.update(1/120,{});assert(world.isWalkable(follower.x,follower.z,follower.radius));if(follower.action){found=true;break;}}assert(found);console.log('ENEMY obstacle detour/fair attack: PASS');
 game.restart();game.debug.invincible(true);game.debug.setPlayer({hp:55,flasks:4});game.update(1/120,{heal:true});assert.equal(game.player.hp,119);assert.equal(game.player.flasks,3);game.update(1/120,{heal:true});assert.equal(game.player.flasks,3);game.update(1/120,{special:true});assert(game.player.attack.whirl);const stamina=game.player.stamina;assert(stamina>=65);tick(1.4);assert(game.player.specialCd>6);assert(!game.player.attack);tick(.4,i=>({rage:i===0}));assert(game.player.rageTime>10);tick(.55,i=>({dodge:i===0,z:1}));assert(!game.player.dodge);assert(game.player.stamina>=0);console.log('HEAL guard/shared-stamina skills/cooldowns/cry/dodge: PASS');
 // Cheap mouse attacks retain their damage; an actual cry still boosts blows and returns 4% as health.
 for(const fps of [30,200])for(const buff of [false,true])for(const heavy of [false,true]){
   game.restart();game.debug.invincible(true);for(const foe of game.enemies)foe.cooldown=999;
   if(buff){game.update(1/fps,{rage:true});assert.equal(game.player.stamina,65);tick(.4,{},fps);assert(game.player.rageTime>10);assert(game.player.rageCd>23);}
   const foe=game.enemies[0],speed=foe.stats.speed;for(const other of game.enemies){other.dead=other!==foe;other.active=other===foe;other.activated=other===foe;}
   foe.stats.speed=0;foe.encounter.activated=true;foe.x=-3.5;foe.z=1;game.debug.teleport(-3.5,3);game.debug.setPlayer({hp:70});events.length=fx.length=0;
   const before=game.player.stamina,hp=foe.hp;game.update(1/fps,{stand:true,[heavy?'clickHeavy':'clickLight']:true,pointX:foe.x,pointZ:foe.z,target:foe});
   assert(game.player.attack&&!game.player.attack.whirl);assert.equal(game.player.stamina,before-(heavy?8:4));tick(heavy?.4:.3,{},fps);
   const damage=buff?(heavy?89:37):(heavy?60:25);assert.equal(foe.hp,hp-damage);assert.equal(events.filter(e=>e.n==='hit'&&e.d.target==='enemy').length,1);
   assert.equal(events.find(e=>e.n==='hit'&&e.d.target==='enemy').d.damage,damage);assert(Math.abs(game.player.hp-(70+(buff?damage*.04:0)))<1e-7,'Cry keeps life steal; ordinary attacks grant none');
   if(buff){game.debug.invincible(false);const beforeHit=game.player.hp;game.debug.strike({damage:10});assert.equal(game.player.hp,beforeHit-8,'Actual cry keeps its 25% damage protection');}
   foe.stats.speed=speed;
 }
 console.log('MOUSE light/heavy small costs, unchanged damage, actual-cry boost/guard/leech: PASS');
 // The target card follows chosen attacks, not passive hovering. Every mob type and the boss use the same contract.
 for(const fps of [30,200])for(const type of ['prisoner','guard','cultist','stalker','carrier','boss'])for(const key of ['light','heavy','special']){
   game.restart();game.debug.invincible(true);assert.equal(game.attackTarget,null);
   const foe=game.enemies.find(e=>e.type===type),speed=foe.stats.speed;
   for(const other of game.enemies){other.dead=other!==foe;other.active=other===foe;other.activated=other===foe;other.cooldown=999;}
   foe.encounter.activated=true;foe.stats.speed=0;foe.x=-3.5;foe.z=1;game.debug.teleport(-3.5,3);game.player.face=Math.PI;
   game.update(1/fps,{target:foe});assert.equal(game.attackTarget,null,'Hover alone cannot select the upper target card');
   const hp=foe.hp;game.update(1/fps,{[key]:true});assert(game.player.attack);assert(game.attackTarget===foe,'Select the intended '+type+' before the '+key+' contact');assert.equal(foe.hp,hp);
   assert.equal(game.debug.snapshot().attackTarget,foe.id);tick(key==='heavy'?.4:.24,{},fps);assert(foe.hp<hp);assert(game.attackTarget===foe);
   game.debug.damageEnemy(foe.id,10000);assert.equal(game.attackTarget,null,'A killed target cannot leave a live health card');foe.stats.speed=speed;
 }
 for(const fps of [30,200]){
   game.restart();game.debug.invincible(true);for(const foe of game.enemies)foe.cooldown=999;
   const a=game.enemies[0],b=game.enemies[1];a.x=-3.5;a.z=1;b.x=3.5;b.z=1;game.debug.teleport(0,3);
   game.update(1/fps,{clickLight:true,target:a});assert(game.attackTarget===a);assert(!game.player.attack,'A distant click selects while the hero approaches');
   game.update(1/fps,{target:b});assert(game.attackTarget===a,'Hovering another foe does not replace the chosen target');
   game.update(1/fps,{holdLight:true,target:b});assert(game.attackTarget===b,'A held mouse attack can deliberately change targets');
   game.update(1/fps,{clickLight:true,pointX:0,pointZ:5});assert(game.attackTarget===b,'Walking retains the last attacked/selected foe');
   game.restart();for(const foe of game.enemies)foe.cooldown=999;const near=game.enemies[0];near.x=0;near.z=5;game.debug.teleport(0,3);game.player.face=Math.PI;
   game.update(1/fps,{near:true,light:true});assert(game.attackTarget===near,'The touch near-assist selects its actual foe even behind the hero');
 }
 for(const fps of [30,200])for(const key of ['light','heavy','special']){
   game.restart();game.debug.invincible(true);const a=game.enemies[0],b=game.enemies[1],speedA=a.stats.speed,speedB=b.stats.speed;
   for(const foe of game.enemies){foe.dead=foe!==a&&foe!==b;foe.active=!foe.dead;foe.activated=!foe.dead;foe.cooldown=999;}
   a.stats.speed=b.stats.speed=0;a.x=-3.5;a.z=1;b.x=5;b.z=1;game.debug.teleport(-3.5,3);game.player.face=Math.PI;
   const hpA=a.hp,hpB=b.hp;game.update(1/fps,key==='special'?{special:true}:{[key==='heavy'?'clickHeavy':'clickLight']:true,target:a});assert(game.attackTarget===a);
   // The aimed foe escapes; another living foe occupies the strike's actual contact point.
   a.x=6;a.z=5;b.x=-3.5;b.z=1;tick(key==='heavy'?.4:.24,{},fps);
   assert.equal(a.hp,hpA);assert(b.hp<hpB);assert(game.attackTarget===b,'A real '+key+' contact replaces an old attack intention with the foe actually hit');
   a.stats.speed=speedA;b.stats.speed=speedB;
 }
 for(const ending of ['death','win']){
   game.restart();game.debug.invincible(true);for(const foe of game.enemies)foe.cooldown=999;
   game.update(1/120,{clickLight:true,target:game.enemies[0]});assert(game.attackTarget);
   if(ending==='death'){game.debug.invincible(false);game.debug.strike({damage:1000});}else game.debug.damageEnemy(game.boss.id,10000);
   assert.equal(game.attackTarget,null,'The upper target clears on '+ending);
 }
 console.log('ATTACK TARGET all mobs/boss, pre-contact and actual-hit handoff, click/hold/near, hover isolation, kill/death/win: PASS');
 // Both skills can be cast in a fresh fight from one bar, with separate readiness and unchanged four-tick whirlwind.
 for(const fps of [30,200])for(const buff of [false,true]){
   game.restart();game.debug.invincible(true);for(const foe of game.enemies)foe.cooldown=999;
   if(buff){game.update(1/fps,{rage:true});assert.equal(game.player.stamina,65);tick(.4,{},fps);assert(game.player.rageTime>10);}
   game.debug.teleport(-3.5,2);events.length=fx.length=0;game.update(1/fps,{special:true});assert.equal(game.player.stamina,buff?20:65);tick(1.7-1/fps,{},fps);
   const contacts=events.filter(e=>e.n==='hit'&&e.d.target==='enemy');assert.equal(contacts.length,4);assert(contacts.every(e=>e.d.damage===(buff?49:33)));assert.equal(game.kills,buff?1:0);
   assert.equal(fx.filter(e=>e.n==='whirlTick').length,4,'A kill does not skip the remaining visual contact ticks');assert(game.player.specialCd>6);
   if(buff)assert(game.player.rageCd>21,'The two cooldowns run independently while the buff stays active');
 }
 console.log('WHIRLWIND shared stamina/independent cooldowns/four ticks/cry damage/kill: PASS');
 // Real boss brain: normal swings start sooner and repeat faster at both simulation rates.
 for(const fps of [30,120])for(const phase of [1,2]){
   game.restart();game.debug.invincible(true);const boss=game.boss,speed=boss.stats.speed;
   for(const foe of game.enemies){foe.dead=foe!==boss;foe.active=foe===boss;foe.activated=foe===boss;}
   boss.encounter.activated=true;boss.phase=phase;boss.spWait=999;boss.cooldown=0;boss.stats.speed=0;boss.x=0;boss.z=-158;game.debug.teleport(0,-153);
   const starts=[];let previous=null;
   for(let i=0;i<4*fps&&starts.length<2;i++){game.update(1/fps,{});const a=boss.action;if(a&&a!==previous){starts.push({time:i/fps,move:a.moveId,duration:a.duration,strike:a.beats[0].strike});}previous=a;}
   assert.equal(starts.length,2);assert(['sweep','lash'].includes(starts[0].move));assert(starts[0].strike<=.85);assert(starts[1].time-starts[0].time<(phase===2?2.55:2.15));
   boss.stats.speed=speed;
 }
 console.log('BOSS normal attack warning/contact cadence and repeat pressure at30/120Hz: PASS');
 // Actual AI/hazards, not debug.strike: refusing to dodge/heal must become lethal.
 for(const fps of [30,120])for(const type of ['prisoner','boss']){
  game.restart();game.debug.invincible(false);const foe=game.enemies.find(e=>e.type===type);
  for(const e of game.enemies){e.dead=e!==foe;e.active=e===foe;e.activated=e===foe;}foe.encounter.activated=true;foe.cooldown=0;foe.spWait=1;
  if(type==='boss'){foe.x=0;foe.z=-158;game.debug.teleport(0,-153);}else game.debug.teleport(foe.x,foe.z+1.8);
  for(let i=0;i<30*fps&&game.state==='playing';i++)game.update(1/fps,{});
  assert.equal(game.state,'dead',type+' must threaten an idle full-health hero');assert(game.lastDeath);
 }
 console.log('DANGER actual prisoner/boss AI kills idle hero at30/120Hz without injected wounds: PASS');
 // Derived visual state is read even without Game.update on the title screen.
 for(const reset of ['titleStart','restart','respawn']){
   game.restart();for(const foe of game.enemies)foe.cooldown=999;game.update(1/120,{rage:true});tick(.4);game.update(1/120,{special:true});tick(.4);
   const visual=game.player.special;assert(visual.active);assert(visual.spin>0);
   game.update(1/120,{clickLight:true,target:game.enemies[0]});assert(game.attackTarget);
   if(reset==='titleStart')game.toTitle();else game[reset]();
   assert.equal(game.attackTarget,null,'Title/restart/respawn clears selected attack targets');
   assert.equal(game.player.rageCd,0);assert.equal(game.player.specialCd,0);assert.equal(game.player.rageTime,0);assert.equal(game.player.roar,null);
   assert.strictEqual(game.player.special,visual);assert(!visual.active);assert.equal(visual.t,0);assert.equal(visual.tick,0);assert.equal(visual.spin,0);assert.equal(visual.serial,0);
   if(reset==='titleStart')game.start();game.update(1/120,{});assert(!visual.active);assert.equal(visual.spin,0);assert(Math.abs(game.player.model.root.rotation.y-game.player.yaw)<1e-7);
 }
 console.log('WHIRLWIND title/start/restart/respawn derived-state reset: PASS');
 game.debug.invincible(true);for(const foe of game.enemies)if(!foe.dead)game.debug.damageEnemy(foe.id,10000);assert.equal(game.state,'won');assert(!game.hasSave);assert(!store.has(game.debug.storageKey));game.toTitle();game.start();assert.equal(game.player.z,8);assert(game.enemies.every(e=>!e.dead));assert.equal(game.kills,0);console.log('WIN title/new run: PASS');
 game.restart();game.debug.invincible(true);for(const foe of game.enemies)foe.cooldown=999;const gateFoe=game.enemies.find(e=>e.encounter.room===1);gateFoe.x=0;gateFoe.z=-7.2;game.debug.teleport(0,-4.8);let gateHp=gateFoe.hp;tick(.65,i=>({stand:true,clickHeavy:i===0,pointX:gateFoe.x,pointZ:gateFoe.z,target:gateFoe}));assert.equal(gateFoe.hp,gateHp,'A closed seal blocks damage');assert(!gateFoe.activated,'Do not wake the hall behind the seal');for(const foe of game.enemies.filter(e=>e.encounter.room===0))game.debug.damageEnemy(foe.id,10000);tick(.65,i=>({stand:true,clickHeavy:i===0,pointX:gateFoe.x,pointZ:gateFoe.z,target:gateFoe}));assert(gateFoe.hp<gateHp,'Opening a seal clears the same line without rebuilding navigation');console.log('DYNAMIC SEAL closed attack/open attack: PASS');
 // The executioner's closed rear gate and masonry are physical surfaces, not floor destinations.
 game.restart();game.debug.invincible(true);for(const foe of game.enemies)foe.cooldown=999;
 assert(!world.isWalkable(0,-169.6,game.player.model.radius));
 for(const x of [-7.4,7.4])assert(!world.isWalkable(x,-170,game.player.model.radius));
 assert(game.debug.teleport(0,-168.8));tick(.4,{z:-1});assert(game.player.z>=-169.34+game.player.model.radius-1e-5,'Held movement must stop before the closed gate');
 console.log('FINAL GATE central bars/stone wings/held movement: PASS');
 // Storage failures must not hide the usable session checkpoint or resurrect a cleared journey.
 const writableStorage=global.localStorage,saveKey=game.debug.storageKey;
 game.restart();store.clear();global.localStorage={...writableStorage,setItem(){throw Error('QuotaExceededError');}};
 for(const foe of game.enemies.filter(e=>!e.boss))game.debug.damageEnemy(foe.id,10000);
 game.debug.teleport(0,-128);tick(.025);assert.equal(game.checkpointIndex,1);assert(game.hasSave);assert(!store.has(saveKey));
 game.toTitle();game.start();assert.equal(game.player.z,-128);assert.equal(game.kills,30);
 global.localStorage={...writableStorage,removeItem(){throw Error('SecurityError');}};store.set(saveKey,JSON.stringify(saved));
 game.restart();assert.equal(store.get(saveKey),'null');assert(!game.hasSave);assert.equal(game.player.z,8);
 const afterDelete=BABA.Game.create(world,{scene,emit(){},fx(){},sound(){}});afterDelete.start();assert(!afterDelete.hasSave);assert.equal(afterDelete.player.z,8);afterDelete.dispose();
 global.localStorage={...writableStorage,setItem(){throw Error('QuotaExceededError');},removeItem(){throw Error('SecurityError');}};store.set(saveKey,JSON.stringify(saved));
 const beforeErrors=events.length;game.restart();assert.equal(game.player.z,8);assert(!game.hasSave);assert.equal(JSON.parse(store.get(saveKey)).index,1);
 assert(events.slice(beforeErrors).some(e=>e.n==='toast'&&e.d.text==='Bu cihazdaki eski mühür kaydı silinemedi.'));
 global.localStorage=writableStorage;console.log('SAVE quota/session, deletion fallback, dual-failure notice: PASS');
 game.dispose();world.dispose();console.log('ALL GAMEPLAY: PASS (actual embedded models + real world and combat CPU; no WebGL/browser/GPU/audio playback)');
})().catch(e=>{console.error(e);process.exitCode=1});
