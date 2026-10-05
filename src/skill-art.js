/* KABİR AZABI — one set of original, engraved ability miniatures for tree and action bar.
   Original painted miniatures extracted from a single authored atlas; decoded once. Local predecoded assets; no SVG filters or runtime drawing.
   prepare() decodes every image; Warmup paints the SAME URLs at HUD/tree sizes before play.
   API: url(id), markup(id, className), prepare() -> Promise, ready, ids. Unknown IDs return empty.
   IDs follow progression.js; notably brand = overhead strike, quake = death cry, chainstorm = final cry. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const ids = Object.freeze(['cleave', 'brand', 'temper', 'roar', 'quake', 'chainstorm', 'whirl', 'reap', 'rend', 'charge', 'grasp', 'havoc', 'light', 'dodge', 'heal']);
  const images = Object.create(null), urls = Object.create(null);
  for (const id of ids) {
    urls[id] = 'assets/ui/abilities/' + id + '.png';
    const image = new Image(); image.decoding = 'async'; image.src = urls[id]; images[id] = image;
  }
  let preparation;
  function prepare() {
    if (!preparation) preparation=Promise.all(ids.map(id=>{
      const img=images[id], error=()=>new Error('Yetenek simgesi yüklenemedi: '+id);
      const verify=()=>{if(!img.complete||!img.naturalWidth)throw error();};
      if(img.decode)return img.decode().then(verify);
      if(img.complete)return img.naturalWidth?Promise.resolve():Promise.reject(error());
      return new Promise((resolve,reject)=>{img.onload=()=>img.naturalWidth?resolve():reject(error());img.onerror=()=>reject(error());});
    }));
    return preparation;
  }
  function url(id) {return urls[id] || '';}
  function markup(id, className) { const src=url(id);return src?'<img class="'+(className||'char-icon power-art')+'" src="'+src+'" width="128" height="128" alt="" aria-hidden="true" draggable="false">':''; }
  B.SkillArt=Object.freeze({ids,url,markup,prepare,get ready(){return ids.every(id=>images[id].complete&&images[id].naturalWidth>0);}});
})();
