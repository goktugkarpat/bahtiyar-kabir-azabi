const CACHE='kara-gecit-v151';
// Only files changed since v146 get a new ?v=; unchanged ones keep their URL, so they are reused from the browser and the old cache.
const VER={'./src/app.js':'151','./src/effects.js':'151','./src/authored-models.js':'150','./src/character-ui.js':'148','./src/display.js':'148','./src/lighting.js':'148','./src/post.js':'148','./src/smaa.js':'148','./src/telegraphs.js':'148','./src/world.js':'148'};
const FILES=['./','./index.html','./credits.html','./ASSET-LICENSES.md','./assets/characters/ANIMATION-LICENSE.txt','./assets/characters/CHARACTER-LICENSE.txt','./vendor/THREE-LICENSE.txt','./icon.svg','./icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png','./manifest.webmanifest','./vendor/three.js','./vendor/gltf-loader.js','./src/ui.css','./src/materials.js','./assets/coast/surfaces.js','./assets/ruins/surfaces.js','./src/coast-materials.js','./src/telegraphs.js','./src/effects.js','./src/chapter-expansion.js','./src/world.js','./src/coast-world.js','./src/forge-world.js','./src/forge-models.js','./src/forge-combat.js','./src/forge-effects.js','./src/boss2.js','./src/ruins-kit.js','./src/ruins-rooms.js','./src/forge-rooms.js','./src/ruins-world.js','./src/ruins-models.js','./src/ruins-combat.js','./src/ruins-effects.js','./src/coast-models.js','./src/coast-combat.js','./src/coast-effects.js','./src/motion.js','./src/models.js','./assets/characters/characters.js','./assets/characters/authored-clips.js','./src/authored-models.js','./src/authored-motion.js','./src/limbs.js','./src/globes.js','./src/ground-loot.js','./src/quests.js','./src/quest-ui.js','./src/quests.css','./src/skill-art.js','./src/gate.js','./src/boss-mech.js','./src/combat.js','./src/audio.js','./src/narration.js','./src/music.js','./src/hud.js','./src/buffs.js','./src/target-hud.js','./assets/ui/target-prisoner.webp','./assets/ui/target-guard.webp','./assets/ui/target-cultist.webp','./assets/ui/target-stalker.webp','./assets/ui/target-carrier.webp','./assets/ui/target-boss.webp','./assets/ui/target-drowned.webp','./assets/ui/target-rootborn.webp','./assets/ui/target-crawler.webp','./assets/ui/target-urchin.webp','./assets/ui/target-lantern.webp','./assets/ui/target-bell.webp','./assets/ui/target-ashbound.webp','./assets/ui/target-shardseer.webp','./assets/ui/target-cavefang.webp','./assets/ui/target-gravemason.webp','./assets/ui/target-ruinwarden.webp','./assets/ui/target-hollowking.webp','./assets/ui/target-emberbound.webp','./assets/ui/target-chainseer.webp','./assets/ui/target-slagcrawler.webp','./assets/ui/target-forgesentinel.webp','./assets/ui/target-ashwarden.webp','./assets/ui/target-furnaceheart.webp','./assets/ui/boss.webp','./assets/ui/btn-red.webp','./assets/ui/btn.webp','./assets/ui/crest.webp','./assets/ui/divider.webp','./assets/ui/fog.webp','./assets/ui/frame.webp','./assets/ui/groove.webp','./assets/ui/iron.webp','./assets/ui/key.webp','./assets/ui/knob.webp','./assets/ui/medal.webp','./assets/ui/orb-l.webp','./assets/ui/orb-r.webp','./assets/ui/plate.webp','./assets/ui/portrait.webp','./assets/ui/portrait-v47.webp','./assets/ui/ring.webp','./assets/ui/skills.webp','./assets/ui/slot.webp','./assets/ui/stone.webp','./assets/ui/title-death.webp','./assets/ui/title-victory.webp','./src/lighting.js','./src/display.js','./src/pacing.js','./src/performance.js','./src/smaa.js','./src/post.js','./src/levelup.js','./src/charge.js','./src/skill-fx.js','./src/progression.js','./src/character-preview.js','./src/character-ui.js','./src/character-ui.css','./src/ui-polish.css','./src/warmup.js','./src/controller.js','./src/app.js'].map(path=>/\.(js|css)$/.test(path)?path+'?v='+(VER[path]||'146'):path);
// Files already stored by an older version of this game are copied, not downloaded again (a new release no longer re-downloads ~40 MB).
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const c=await caches.open(CACHE),old=(await caches.keys()).filter(k=>k.startsWith('kara-gecit-')&&k!==CACHE);
  await Promise.all(FILES.map(async f=>{
    for(const k of old){const r=await(await caches.open(k)).match(f);if(r){await c.put(f,r);return;}}
    await c.add(f);
  }));
  await self.skipWaiting();
})()));
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
