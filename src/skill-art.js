/* KABİR AZABI — one set of original, engraved ability miniatures for tree and action bar.
   Built once as immutable SVG images. No SVG filters, external assets or runtime drawing.
   prepare() decodes every image; Warmup paints the SAME URLs at HUD/tree sizes before play.
   API: url(id), markup(id, className), prepare() -> Promise, ready, ids. Unknown IDs return empty.
   IDs follow progression.js; notably brand = overhead strike, quake = death cry, chainstorm = final cry. */
(() => {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const steel = 'url(#steel)', hot = 'url(#heat)', dark = '#0a0a0e';
  const path = (d, fill, stroke, width) => '<path d="' + d + '" fill="' + (fill || 'none') + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (width || 1.4) + '" stroke-linecap="round" stroke-linejoin="round"' : '') + '/>';
  const skull = (tier, red) => '<g transform="translate(0 ' + (tier === 3 ? 3 : 0) + ')">' +
    path('M41 29Q49 18 64 18Q83 18 89 34L86 55 80 63 77 79 52 79 48 64 41 55Z', steel, dark, 2.2) +
    path('M43 34 56 26 65 29 76 24 87 35 80 42 48 42Z', '#f7e7ce', null) +
    path('m46 46 14 5-4 10-10-5Zm23 5 15-5-1 10-11 5ZM60 61l5-8 5 9Z', dark) +
    path('M56 66Q65 62 74 66L75 88Q65 96 54 87Z', red ? '#2a030b' : '#0b1016', '#9d7563', 1.2) +
    path('m57 66 2 7 3-8m7 0 2 8 3-7M57 83l2-4 3 8m7 0 2-8 3 4', 'none', '#f2dcc0', 2) +
    path('M50 35 58 32m11-1 9 3M47 43l6-2m26 2-6-2M62 24l-2 9 4 5-3 5', 'none', '#554c48', 1.5) + '</g>';
  const sword = (heavy) => '<g transform="rotate(39 64 64)">' +
    path(heavy ? 'M57 12 75 17 77 50 69 75 53 74 49 40Z' : 'M64 8 73 26 69 77 59 77 55 26Z', steel, dark, 2.3) +
    path(heavy ? 'M57 17 56 66 63 57 64 19Z' : 'M64 13 64 74 58 71 59 26Z', '#eee3cf') +
    path('M58 76h12l-1 30H59Z', '#3b2220', '#0d0b0b', 2) +
    path('M44 72 52 70 59 76 70 76 77 69 85 72 80 80 70 83 57 82 48 79Z', steel, dark, 1.8) +
    path('M57 104h14l3 9-11 5-10-5Z', hot, dark, 1.8) +
    path('M59 85h10m-10 6h10m-10 6h10M67 28l-3 9 3 8-3 7', 'none', '#b79a79', 1.6) + '</g>';
  const cleaver = (last) => '<g transform="rotate(' + (last ? -20 : 12) + ' 64 55)">' +
    path('M58 37h11v63H58Z', '#4b2725', dark, 2) +
    path('M35 25 75 20 93 28 90 52 77 62 65 55 32 54 25 41Z', steel, dark, 2.4) +
    path('M30 32 71 26 83 30 81 40 29 44Z', '#eee3cf') +
    path('M29 46 67 44 86 43 78 54 65 50 34 51Z', '#715b52') +
    path('M58 63h11m-11 7h11m-11 7h11m-11 7h11m-11 7h11M39 33l3 6m11-8-2 9m10-10 3 8', 'none', '#b39e7c', 1.5) +
    path('m57 97 15-1 2 10-10 6-9-5Z', hot, dark, 1.6) + '</g>';
  const hook = (rotation) => '<g transform="rotate(' + rotation + ' 64 64)">' +
    path('M66 18C93 12 112 35 107 58C103 45 96 37 81 34L72 40 67 34 47 77 42 73 61 32 55 27Z', steel, dark, 2) +
    path('M71 22C87 19 99 31 103 41 92 30 82 28 71 28Z', '#f7e7cf') +
    path('m45 66 6 3m-10 4 6 3m-10 4 6 3', 'none', '#b68f65', 1.6) + '</g>';
  const ram = (tier) => {
    const horns = tier === 1 ? '' : path('M49 42C23 37 20 16 34 13 24 34 43 27 52 34ZM79 42C105 37 108 16 94 13 104 34 85 27 76 34Z', steel, dark, 2);
    return '<g transform="translate(5 2)">' + horns + path('M45 31 63 23 82 33 90 56 80 78 67 91 47 82 37 61Z', steel, dark, 2.2) +
      path('M62 27 72 34 69 60 77 70 66 88 59 65Z', hot, dark, 1.4) +
      path('m42 47 17 7-3 9-15-7Zm30 6 14-6-3 10-10 5Z', '#130b0d') +
      path('M45 38l11-5m23 7-8-6M44 66l10 7m24-7-8 8M47 79l9 3', 'none', '#f1dfbd', 1.4) +
      path('m40 80-16 10-7 19 45-4 35-1-15-21-15 8-13-2Z', '#2d2b2b', '#a88e71', 1.5) +
      path('m26 94 20-6 12 10-33 5Zm44 2 10-7 8 9Z', steel) + '</g>';
  };
  const wave = (r, wide, opacity) => '<circle cx="64" cy="62" r="' + r + '" fill="none" stroke="url(#heat)" stroke-width="' + wide + '" opacity="' + opacity + '"/>';
  const fractures = path('m62 80-8 12 8 5-14 15m21-29 10 12-4 7 12 11M48 85l-14 8 4 8-18 5m60-22 13 7-1 8 16 3', 'none', hot, 3) + path('m57 88 2 4-4 4m24-2 4 4m-49-2-6 3', 'none', '#efe0b4', 1.1);
  const motifs = {
    cleave: () => path('M20 97C-1 52 33 18 93 13 59 26 30 42 22 69L30 87Z', hot) + path('M23 89C13 48 49 21 89 16', 'none', '#f5d3a9', 2) + sword(false),
    brand: () => wave(38, 2, .45) + fractures + cleaver(false) + path('m22 78 9-7 10 8-9 7Zm66 2 12-5 4 10-13 3ZM52 99l6-3 7 8-5 5Z', steel, dark, 1.3),
    temper: () => path('m22 21 6 39 14 19-7-27ZM95 15l-7 30-5 28 16-34Z', hot) + wave(40, 3, .5) + fractures + cleaver(true) + path('M18 107 44 98 50 110 72 100 93 110 111 100', 'none', '#c8b3d9', 2),
    roar: () => wave(44, 6, .4) + path('M25 42C13 54 14 75 26 86M104 40c13 14 13 34-1 48', 'none', '#dd6450', 3) + skull(1, true),
    quake: () => wave(49, 2, .65) + wave(38, 4, .55) + path('M29 19 23 33 14 35m86-16 5 14 10 3M13 74l10 4 6 20m73-1 6-19 10-3', 'none', '#e5cf9c', 2.4) + skull(2, false),
    chainstorm: () => wave(49, 3, .6) + wave(41, 2, .4) + path('M43 31 35 6 53 17 65 4 78 17 96 6 85 33Z', steel, dark, 2) + path('M41 26 87 26', 'none', '#d58d67', 2) + skull(3, true) + path('m22 91 8 16 11 4m66-19-8 16-10 4M59 109l6 10 6-10', 'none', hot, 3),
    whirl: () => {
      let links='';for(let n=0;n<10;n++){const a=n*Math.PI/5;links+='<ellipse cx="'+(64+39*Math.sin(a)).toFixed(2)+'" cy="'+(63+39*Math.cos(a)).toFixed(2)+'" rx="6" ry="11" transform="rotate('+(-n*36)+' '+(64+39*Math.sin(a)).toFixed(2)+' '+(63+39*Math.cos(a)).toFixed(2)+')" fill="none" stroke="url(#steel)" stroke-width="4"/>';}
      return wave(40, 8, .25)+links+path('M44 62 63 40 83 61 63 84Z',hot,dark,2)+path('m51 60 11-10 12 12-11 11Z',steel);
    },
    reap: () => wave(40, 6, .25) + hook(0) + hook(180) + path('M62 54 72 63 62 73 53 63Z', hot, dark, 2),
    rend: () => wave(41, 3, .55) + hook(0) + hook(120) + hook(240) + path('M64 50 77 64 64 79 50 64Z',hot,dark,2) + path('m64 58 6 7-6 7-6-7Z','#f1dfdb'),
    charge: () => path('m10 41 19 11-19 12m0 11 16 8-16 12','none',hot,5) + ram(1),
    grasp: () => path('M15 96C1 76 18 53 14 23c16 13 10 32 16 40 6-8 1-17 7-29 2 21 20 39 13 54Z',hot) + ram(2) + path('M16 104 26 113 46 108','none','#e8b261',2),
    havoc: () => path('M15 17 23 48 12 71 29 104 51 114 34 87 34 50ZM104 15 92 46 107 74 87 114 106 102 119 72Z',hot) + ram(3) + path('m21 112 24-6 15 9 13-8 31 5','none','#deb7d9',2.3),
    light: () => sword(false),
    dodge: () => path('M28 84 52 59 44 43 66 25 83 30 76 45 86 69 70 88 65 76 72 65 62 55 56 75 39 95Z',steel,dark,2)+path('m16 40 23 3m-27 13 24 1m-21 16 17-1','none',hot,4),
    heal: () => path('M50 18h28v13l-5 6v13c29 13 33 57-9 63-42-6-39-50-9-63V37l-5-6Z',steel,dark,2.3)+path('M56 53c-22 18-20 48 8 54 28-6 30-36 8-54Z','#831e2b','#d56b55',2)+path('M55 23h18m-20 8h22M49 73c-4 10-2 18 2 23','none','#f0d3a2',3)
  };
  const palette = {
    cleave:['#2b1112','#9d2b24','#f0b58b'], brand:['#281b0e','#aa6828','#f6d6a2'], temper:['#201122','#804454','#d7b2e5'],
    roar:['#300d17','#9d263f','#f1b29b'], quake:['#241e16','#997040','#f1dfb4'], chainstorm:['#231023','#904351','#dab4d3'],
    whirl:['#241312','#a54930','#eac28d'], reap:['#262015','#a28343','#f0deae'], rend:['#1e132a','#7c4e97','#d9bde9'],
    charge:['#24190e','#986633','#edd0a0'], grasp:['#301711','#b75724','#f1cf89'], havoc:['#261027','#913963','#dfb0dc'],
    light:['#151c22','#577580','#d1ded7'], dodge:['#132125','#437f83','#b9d3c9'], heal:['#301318','#962c37','#efba9c']
  };
  const images = Object.create(null), urls = Object.create(null), SVG = Object.create(null);
  const ids = Object.freeze(Object.keys(motifs));
  for (const id of ids) {
    const c=palette[id];
    const defs='<defs><radialGradient id="bg" cx=".44" cy=".32" r=".78"><stop stop-color="'+c[0]+'"/><stop offset="1" stop-color="#080b10"/></radialGradient><linearGradient id="steel" x1=".12" y1="0" x2=".83" y2="1"><stop stop-color="#f2e4c9"/><stop offset=".26" stop-color="#c2b49b"/><stop offset=".47" stop-color="#77767a"/><stop offset=".53" stop-color="#d3cbb9"/><stop offset=".72" stop-color="#77716b"/><stop offset="1" stop-color="#393439"/></linearGradient><linearGradient id="heat" x1="0" y1="1" x2=".7" y2="0"><stop stop-color="'+c[1]+'"/><stop offset=".58" stop-color="'+c[1]+'"/><stop offset="1" stop-color="'+c[2]+'"/></linearGradient></defs>';
    let scratches='';for(let i=0;i<20;i++){const x=12+(i*37%105),y=10+(i*53%107);scratches+=path('m'+x+' '+y+' '+(2+i%5)+' -2','none',c[2],.55);}
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">'+defs+'<rect width="128" height="128" rx="10" fill="url(#bg)"/><path d="M9 27V9h27m56 0h27v27m0 57v26H93m-58 0H9V93" fill="none" stroke="#977b53" stroke-opacity=".65" stroke-width="1.2"/><circle cx="64" cy="64" r="51" fill="none" stroke="'+c[1]+'" stroke-width=".6" opacity=".55"/><g opacity=".18">'+scratches+'</g>'+motifs[id]()+'<path d="M8 20 20 8m88 0 12 12M8 108l12 12m88 0 12-12" fill="none" stroke="#d0ab73" stroke-width="1.4" opacity=".65"/></svg>';
    SVG[id]=svg;urls[id]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    const image=new Image();image.decoding='async';image.src=urls[id];images[id]=image;
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
