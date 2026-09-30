const CACHE='kara-gecit-v66';
const FILES=['./','./index.html','./credits.html','./ASSET-LICENSES.md','./assets/characters/ANIMATION-LICENSE.txt','./assets/characters/CHARACTER-LICENSE.txt','./vendor/THREE-LICENSE.txt','./icon.svg','./icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png','./manifest.webmanifest','./vendor/three.js','./vendor/gltf-loader.js','./src/ui.css','./src/materials.js','./src/telegraphs.js','./src/effects.js','./src/world.js','./src/motion.js','./src/models.js','./assets/characters/characters.js','./assets/characters/authored-clips.js','./src/authored-models.js','./src/authored-motion.js','./src/limbs.js','./src/globes.js','./src/combat.js','./src/audio.js','./src/narration.js','./src/music.js','./src/hud.js','./src/buffs.js','./src/target-hud.js','./assets/ui/target-prisoner.webp','./assets/ui/target-guard.webp','./assets/ui/target-cultist.webp','./assets/ui/target-stalker.webp','./assets/ui/target-carrier.webp','./assets/ui/target-boss.webp','./assets/ui/boss.webp','./assets/ui/btn-red.webp','./assets/ui/btn.webp','./assets/ui/crest.webp','./assets/ui/divider.webp','./assets/ui/fog.webp','./assets/ui/frame.webp','./assets/ui/groove.webp','./assets/ui/iron.webp','./assets/ui/key.webp','./assets/ui/knob.webp','./assets/ui/medal.webp','./assets/ui/orb-l.webp','./assets/ui/orb-r.webp','./assets/ui/plate.webp','./assets/ui/portrait.webp','./assets/ui/portrait-v47.webp','./assets/ui/ring.webp','./assets/ui/skills.webp','./assets/ui/slot.webp','./assets/ui/stone.webp','./assets/ui/title-death.webp','./assets/ui/title-victory.webp','./src/lighting.js','./src/display.js','./src/pacing.js','./src/performance.js','./src/smaa.js','./src/post.js','./src/app.js'].map(path=>/\.(js|css)$/.test(path)?path+'?v=66':path);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kara-gecit-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  const navigation=e.request.mode==='navigate';
  // Storage failure must not discard a successful online response.
  const match=async q=>{try{return await caches.match(q);}catch(error){return undefined;}};
  const network=async()=>{const r=await fetch(e.request);if(r.ok)try{const c=await caches.open(CACHE);await c.put(e.request,r.clone());}catch(error){}return r;};
  e.respondWith((async()=>{
    if(!navigation){const cached=await match(e.request);if(cached)return cached;}
    try{return await network();}
    catch(error){return await match(e.request)||(navigation?await match('./index.html'):undefined)||Response.error();}
  })());
});
