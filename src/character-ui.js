/* KABİR AZABI — paused character, equipment and active-talent ledger. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const LABELS = { weapon: 'Silah', head: 'Baş', chest: 'Gövde', hands: 'Eller', boots: 'Ayaklar' };
  const RARITY = { common: 'Sıradan', uncommon: 'Sıradışı', rare: 'Nadir', epic: 'Epik', boss: 'Eşsiz' };
  const TYPE = { sword: 'Kılıç', axe: 'Balta', spear: 'Mızrak' };
  const escape = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const percent = n => Number((n * 100).toFixed(1)).toLocaleString('tr-TR') + '%';
  // Prepainted miniatures match the weapon / armour family. The actual worn
  // object remains the live animated 3D figure; no extra thumbnail renderer is used.
  function menuGearIcon(def) {
    const thumbnail = B.EquipmentThumbnails && B.EquipmentThumbnails[def.id || def.modelId];
    if (typeof thumbnail === 'string' && thumbnail.startsWith('data:image/')) return '<img class="char-icon char-gear-icon char-model-thumbnail" src="' + thumbnail + '" width="256" height="256" alt="" aria-hidden="true" draggable="false">';
    // Hand-painted families follow the actual weapon / armour silhouette.
    // An item keeps its own name, finish, stats and quality frame.
    const familyKey = def.id || def.modelId || '';
    const tile = def.type === 'sword' ? (/dull/.test(familyKey) ? 0 : /crown|royal|throne/.test(familyKey) ? 5 : 1) :
      def.type === 'axe' ? (/forge|furnace|ember|ash/.test(familyKey) ? 4 : 2) : def.type === 'spear' ? 3 :
      def.slot === 'chest' ? (/torn|leather|cloth|pilgrim|worker|mourning/.test(familyKey) ? 6 : /chain|coast|salt|sunken/.test(familyKey) ? 7 : 8) :
      def.slot === 'head' ? (/hood|cloth|veil|shroud/.test(familyKey) ? 9 : /crown|royal|throne/.test(familyKey) ? 11 : 10) :
      def.slot === 'hands' ? (/wrap|cloth|rag/.test(familyKey) ? 13 : 12) : def.slot === 'boots' ? (/worn|cloth|wrap|pilgrim/.test(familyKey) ? 14 : 15) : null;
    if (tile !== null) return '<img class="char-icon char-gear-icon" src="assets/ui/gear/' + tile + '.png" width="256" height="256" alt="" aria-hidden="true" draggable="false">';
    return gearIcon(def);
  }
  // The loot renderer consumes this original SVG API; menu pictures stay separate.
  let gearSerial = 0;
  function gearIcon(def) {
    const id = 'gear-art-' + (++gearSerial), base = def.id || def.modelId, worn = def.finish || 'worn';
    const tones = { worn: ['#c2c9ca','#6b777a','#253035'], ash: ['#d6cfbe','#8e8778','#343333'], rust: ['#d2b086','#996442','#362722'], brine: ['#b8d1d1','#668d91','#20353e'], blood: ['#cabaa4','#8f5b52','#38262a'], bone: ['#e3d9b9','#9f9477','#3d3a32'] };
    const tone = tones[worn] || tones.worn;
    const steel = 'url(#' + id + '-steel)', leather = 'url(#' + id + '-leather)', gold = '#ae8453';
    let art = '', etch = '';
    if (def.type === 'sword') {
      const dull = base === 'dull-sword';
      art = '<path fill="' + steel + '" d="' + (dull ? 'M42 5 47 9 43 19 41 19 38 29 26 43 20 37Z' : 'M44 3 50 6 45 21 26 43 20 37Z') + '"/>' +
        '<path fill="' + leather + '" d="m15 40 6 5-9 12-6-5Z"/><path fill="' + steel + '" d="m15 34 4-2 15 13-3 4-8-5-5-6-5-2Z"/><path fill="' + gold + '" d="m6 50 9 7-3 4-10-7Z"/>';
      etch = '<path d="m44 9-20 29m3-2 16-22m-31 28 6 4m-9 1 6 4"/><path stroke="' + gold + '" d="m22 39 4 3"/>';
    } else if (def.type === 'axe') {
      art = '<path fill="' + leather + '" d="m8 56 26-43 5 3-25 43Z"/><path fill="' + steel + '" d="M27 12c10-11 20-9 30-4L44 30c-4-5-8-6-13-5l5-9Z"/><path fill="' + gold + '" d="m29 18 8 5-4 5-8-5Z"/>';
      if (base.includes('executioner') || def.rarity === 'boss') art += '<path fill="' + steel + '" d="M30 14C18 8 12 13 7 23l17 6 8-8Z"/>';
      etch = '<path d="M53 9 43 25M10 51l5 3m-2-8 5 3m-2-8 5 3m17-29 5 4"/>';
    } else if (def.type === 'spear') {
      art = '<path fill="' + leather + '" d="m10 57 34-40 3 3-34 40Z"/><path fill="' + steel + '" d="M56 3c0 15-3 22-17 26l2-16Z"/><path fill="' + gold + '" d="m34 24 10 9 3-4-10-9Z"/>';
      etch = '<path d="m52 9-11 15M17 48l4 4m0-10 5 4m0-10 5 4"/>';
      if (base.includes('bell')) art += '<path fill="' + gold + '" d="m29 28 6 3 1 7-9-4Z"/>';
    } else if (def.slot === 'head') {
      const cloth = base.includes('hood');
      art = cloth ? '<path fill="' + leather + '" d="M10 51 7 32C8 5 20 3 32 3S56 5 57 32l-3 19-15 9H23Z"/><path fill="#11171b" d="M17 30c1-19 29-19 30 0l-6 17H23Z"/>' : '<path fill="' + steel + '" d="M9 45V26C9 2 55 2 55 26v19l-14 11-9-17-9 17Z"/><path fill="#142028" d="m15 26 13 3-2 6-12-4Zm21 3 13-3 1 5-12 4Z"/><path fill="' + gold + '" d="M28 8h8v28l-4 5-4-5Z"/>';
      etch = cloth ? '<path d="M11 39 18 21m35 18-7-18M14 51l9 5m27-5-9 5"/>' : '<path d="M12 21c6-13 32-13 40 0M16 41l7 5m25-5-7 5M32 12v19"/>';
    } else if (def.slot === 'chest') {
      const torn = base === 'torn-chest';
      art = '<path fill="' + leather + '" d="m20 9-11 6-4 16 12 4-1 22 8-2 8 4 9-3 7 1-1-22 12-4-5-16-10-6c-4 10-19 10-25 0Z"/>';
      if (!torn) art += '<path fill="' + steel + '" d="m20 17-7 8 8 10 3 17 8 3 8-3 3-17 8-10-7-8-12 5Z"/><path fill="' + steel + '" d="m12 12-7 6 1 10 10 3 4-12Zm40 0 7 6-1 10-10 3-4-12Z"/><path fill="' + gold + '" d="m32 28 6 8-6 8-6-8Z"/>';
      etch = torn ? '<path d="M23 17 21 41m21-24 2 25M19 48h26m-13-22v18m-6 12 3-4m8 5-2-4"/>' : '<path d="M32 22v7m-10 7 3 13m17-13-3 13m-25-32 2 9m35-9-2 9"/>';
    } else if (def.slot === 'hands') {
      const wrapped = base.includes('wrap');
      art = '<path fill="' + leather + '" d="m7 20 11-3 3 11 6-3 5 7-9 12 2 13-15 2-2-15Zm32-3 11 3 5 24-1 15-15-2 2-13-9-12 5-7 6 3Z"/>';
      if (!wrapped) art += '<path fill="' + steel + '" d="m8 23 11-2 4 18-10 4Zm37-2 11 2-5 20-10-4ZM10 48l13-2 2 10-15 2Zm31-2 13 2v10l-15-2Z"/>';
      etch = wrapped ? '<path d="m9 26 12-3m-11 10 13-4m-12 11 13-4m-11 12 11-3m-11 10 12-3m21-29 12 3m-13 3 13 4m-13 3 13 4m-11 5 11 3m-12 4 12 3"/>' : '<path d="m11 29 9-2m-8 8 9-2m23-6 9 2m-10 4 9 2m-39 17 8-1m20 0 8 1"/>';
    } else {
      const metal = !base.includes('worn');
      art = '<path fill="' + leather + '" d="M9 10h17l-2 28 6 9-1 11H4V46l5-9Zm29 0h17l-1 27 7 9v12H36l-1-11 5-9Z"/><path fill="#191a19" d="M4 53h25v7H4Zm32 0h25v7H36Z"/>';
      if (metal) art += '<path fill="' + steel + '" d="M11 13h13l-2 21-9 4Zm30 0h12l-2 24-9-3Z"/>';
      etch = '<path d="M10 20h14m-14 8h13m18-8h12m-12 8h12M7 47h18m15 0h17"/>';
    }
    // Identity, not the reused 3D model, determines the large readable silhouette.
    // Broad cut-outs and two or three prominent shapes survive the inventory's 32px cells.
    const key = def.id || '', bone = '#c9bfa3', dark = '#0e1418', ember = '#a45238';
    const shape = (d, fill = steel) => '<path fill="' + fill + '" d="' + d + '"/>';
    const line = (d, color = bone, width = 2) => '<path fill="none" stroke="' + color + '" stroke-width="' + width + '" d="' + d + '"/>';
    const loop = (x,y,rx,ry,fill=steel) => '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="'+fill+'" stroke-width="3"/>';
    const chain = (x,y) => loop(x,y,4,6)+loop(x,y+9,3,5,bone)+loop(x,y+17,4,6);
    if (def.slot === 'weapon') {
      const grip=shape('m8 55 23-34 5 4-22 34Z',leather)+line('m13 49 5 4m-1-9 5 4',gold,2);
      if (def.type === 'sword') {
        if (/hollow-crown/.test(key)) {
          art=grip+shape('M44 2 55 7 50 23 27 46 18 37Z')+shape('m17 28 9 2 4-9 5 13 13 4-6 8-13-3-8-8Z',gold)+shape('m43 9 5 3-7 9-5-3Z',dark); etch=line('m44 23-18 17');
        } else if (/cave-verdict|ruin-lament/.test(key)) {
          art=grip+shape('M49 3 56 8 44 16 48 22 37 26 38 33 25 46 18 39 29 29 28 23 39 20 38 13Z')+shape('m13 35 8-3 15 13-5 5Z',gold);etch=line('m48 10-24 29');
        } else if (/slag-edge|black-forge/.test(key)) {
          art=grip+shape('M48 2 58 7 50 14 54 20 43 24 46 30 26 46 17 37Z')+shape('m14 35 7-5 16 15-5 5Z')+shape('m43 14 4 2-6 7-4-2Zm-10 12 4 2-6 7-4-2Z',dark);etch=line('m25 37 18-21',ember,1.5);
        } else if (/widow/.test(key)) {
          art=grip+shape('M46 4 50 7 27 43 20 38Z')+shape('m12 34 23 15 4-5-23-15Z',bone)+shape('m8 50 5 5-5 6-5-5Z',bone);etch=line('m22 32 6 4m-10 2 6 4');
        } else if (/black-tide/.test(key)) {
          art=grip+shape('M48 3c11 17-10 22-8 30L26 46 18 38 35 19Z')+shape('m13 34 23 16 6-4-9-1-10-9-8-6Z',gold);etch=line('M47 11c-1 10-12 13-16 22',tone[0]);
        }
      } else if (def.type === 'axe') {
        if (/sepulcher/.test(key)) { art=grip+shape('m24 11 12-9 22 12-11 22-23-8Z')+shape('m35 12 12 5-6 11-12-6Z',dark);etch=line('m27 16 17 9',bone,3); }
        else if (/broken-throne/.test(key)) { art=grip+shape('m26 17 5-12 5 5 5-8 4 9 12-3-2 15-13 10-16-10Z')+shape('m28 18-11-5-10 14 17 4Z',gold);etch=line('m35 12 8 17'); }
        else if (/furnace-oath|ember-vow/.test(key)) { art=grip+shape('M29 13 40 3l17 6-6 8 7 5-14 15-13-11L15 34 5 24l8-6-4-7 15 1Z')+shape('m31 16 8 5-5 9-8-6Z',ember);etch=line('m45 8-3 13 8 2-10 10',ember,2); }
        else if (/mourning/.test(key)) { art=grip+shape('M31 10 52 4 58 15 47 33 34 29 39 22 27 18Z')+shape('m49 18-5 8 9-3Z',dark);etch=line('m49 9-7 10',bone); }
      } else if (def.type === 'spear') {
        const shaft=shape('m10 58 31-38 4 3-31 38Z',leather);
        if (/bell-spear|furnace-mourning/.test(key)) { art=shaft+shape('M52 2 59 15 46 29 36 22Z')+shape('M27 27c8-9 16 0 12 8l4 8-19-8Z',gold)+shape('m29 33 8 4-1 3-9-4Z',dark);etch=line('m53 8-11 14'); }
        else if (/starved/.test(key)) { art=shaft+shape('M38 7 42 20 50 2 54 5 46 24 61 16 57 29 44 34 31 24Z',bone);etch=line('m41 23-7 13',gold); }
        else if (/last-coal/.test(key)) { art=shaft+shape('M47 2 56 8 48 24 38 27 40 13Z')+shape('m45 12 6-2-3 11-6-1Z',ember)+shape('m34 24 5 4-3 9-6-4Z',dark);etch=line('m19 46 5 4',gold,3); }
        else if (/orphan|bone-spear/.test(key)) { art=shaft+shape('M53 2 57 7 49 21 57 20 48 30 37 25 36 14 40 18Z',bone)+loop(31,35,4,3,bone);etch=line('m51 9-10 13',dark,1.5); }
      }
    } else if (def.slot === 'head') {
      if (/warden-verdict/.test(key)) {
        art=shape('M10 43 14 22 8 7 22 16 32 3 42 16 56 7 50 24 54 43 43 56 21 56Z',bone)+shape('M19 24 45 24 43 46 32 56 21 46Z')+shape('m20 29 10 3-2 5-8-3Zm14 3 10-3-1 5-7 3Z',dark);etch=line('M32 20v24m-8 1 8 7 8-7',gold);
      } else if (/sealed-gaze|sealed-furnace|no-witness|forgotten-face|no-dawn/.test(key)) {
        const furnace=/furnace/.test(key),blind=/forgotten/.test(key);
        art=shape('M11 47V22C11 3 53 3 53 22v25L40 59H24Z')+shape(blind?'M19 24h26v11H19Z':'m16 25 14 3v5l-14-3Zm18 3 14-3v5l-14 3Z',dark)+shape('M29 35h6v20h-6Z',gold);
        if(furnace)art+=shape('M11 21 3 8 17 14Zm42 0 8-13-14 6Z')+line('M21 39h4m14 0h4m-22 6h4m14 0h4',ember,3);
        else if(/no-dawn/.test(key))art+=shape('M15 15 13 4 24 12 32 3 40 12 51 4 49 15Z',bone);
        if(/sealed-gaze/.test(key))art+=shape('M15 23h34v6H15Z',bone)+shape('M29 19h6v18h-6Z',gold);
        if(/no-witness/.test(key))art+=shape('M17 24h30v14H17Z',dark)+shape('M22 29h20v2H22Z',tone[0]);
        etch=line('M16 18h32m-28 28 7 7m17-7-7 7');
      } else if (/last-breath|last-witness|silent-watch|drowned-helm/.test(key)) {
        art=shape('M8 41 11 18C15 2 49 2 53 18l3 23-16 15-8-15-8 15Z')+shape('M17 20h30v19H17Z',dark)+shape('M20 22h7v9h-7Zm17 0h7v9h-7Z',gold);
        if(/drowned|silent-watch/.test(key))art+=shape('M26 8c0-8 12-8 12 0l5 8H21Z',gold);
        else art+=shape('M9 23 3 6 18 15Zm46 0 6-17-15 9Z',bone);
        etch=line('M15 40 24 44m25-4-9 4');
      } else if (/funeral|buried-prayer|coal-mourner|orphan/.test(key)) {
        const point=/buried|funeral/.test(key);
        art=shape(point?'M32 2 54 21 58 51 43 59 36 50 28 50 21 59 6 51 10 21Z':'M32 5 50 14 57 34 53 57 38 52 26 58 11 53 7 34 14 14Z',leather)+shape('M19 27c2-16 24-16 26 0l-5 20H24Z',dark);
        if(/coal/.test(key))art+=shape('m11 43 13 10-7 5-9-5Zm30 10 12-10 3 10-9 5Z',ember);
        etch=line('M14 38 20 21m30 17-6-17m-12 5v17',bone,1.5);
      }
    } else if (def.slot === 'chest') {
      if (/hollow-heart|hollow-ember|ruin-burial|buried-fire/.test(key)) {
        art=shape('M20 9 8 15 4 31 16 35 17 56 29 61 46 56 48 35 60 31 55 15 43 9 38 17H26Z',leather)+shape('M22 20h20l4 29-14 8-14-8Z',dark);
        for(let r=0;r<4;r++)art+=shape('M20 '+(23+r*7)+'l11 3v4l-12-3Z',bone)+shape('M44 '+(23+r*7)+'l-11 3v4l12-3Z',bone);
        art+=shape('M30 19h4v37h-4Z',bone);etch=line('m10 17 8 9m36-9-8 9',gold);
      } else if (/warden-chainmail|grave-chest|ash-warden|empty-vow/.test(key)) {
        art=shape('M20 9 8 15 4 31 17 34 16 55 32 60 48 55 47 34 60 31 56 15 44 9 37 17H27Z')+shape('M22 20h20v31H22Z',dark);
        for(let r=0;r<3;r++)for(let c=0;c<3;c++)art+=loop(23+c*9,25+r*10,4,5,/ash-warden/.test(key)?gold:steel);
        if(/ash-warden/.test(key))art+=shape('m7 17 1-11 11 9Zm49 0-1-11-11 9Z',ember);etch=line('M14 42v10m36-10v10');
      } else if (/sunless|sunken-vow|slag-burial/.test(key)) {
        art=shape('M19 9 7 14 3 34 14 35 12 59 28 56 34 60 54 57 51 35 61 31 55 14 44 9 37 17H26Z',leather)+shape('M22 18 11 24 21 34 23 50 32 56 41 50 43 34 54 24 43 18 32 22Z')+shape('M29 24h6v26h-6Z',gold);etch=line('m15 24 7 5m27-5-7 5m-17 9 7 7 7-7');
      } else if (/ash-chest|mourner|salt-shroud/.test(key)) {
        art=shape('M21 8 9 14 5 34 18 31 15 57 23 53 29 61 35 53 47 59 48 30 59 34 55 14 43 8 39 19H25Z',leather)+shape('M24 22h16l5 18-9 11-12-4-3-12Z',tone[1])+shape('m23 25 6 7-5 8-4-8Zm16 13 5 5-7 7-3-7Z',dark);etch=line('M22 22 39 45m-19-7 19-7',bone,2);
      }
    } else if (def.slot === 'hands') {
      if (/grasp|gauntlet|slag-fingers/.test(key)) {
        art=shape('M8 14 23 12 25 28 31 26 33 33 26 45 28 58H9l-3-19Zm33-2 15 2 2 25-3 19H36l2-13-7-12 2-7 6 2Z')+shape('M10 19h12v18H10Zm32 0h12v18H42Z',dark)+shape('m11 47 13-2 2 11-15 1Zm29-2 13 2v10l-15-1Z',gold);
        if(/grasp|black-stone|slag/.test(key))art+=shape('M8 15 5 4 13 13 14 2 19 12 24 5 23 18Zm33 3-1-13 5 7 5-10 1 11 8-9-3 11Z',/ash-warden/.test(key)?ember:bone);
        if(/ash-warden-grasp/.test(key))art+=shape('M4 31 13 35 10 44 4 48Zm56 0-9 4 3 9 6 4Z',ember)+shape('M7 48h21v10H7Zm29 0h21v10H36Z')+shape('M11 51h13v3H11Zm29 0h13v3H40Z',dark);
        if(/black-anvil/.test(key))art+=shape('M6 14h20v11H6Zm32 0h20v11H38Z')+shape('M10 17h12v4H10Zm32 0h12v4H42Z',dark);
        else if(/widow/.test(key))art+=loop(18,27,5,6,gold)+loop(47,27,5,6,gold);
        etch=line('M14 25v10m5-10v10m26-10v10m5-10v10',tone[0],2);
      } else if (/chain|nameless|cold-prayer/.test(key)) { art+=chain(11,35)+chain(53,35);etch+=line('M10 21 23 38m31-17L41 38',gold,2); }
      else if (/wraps/.test(key)) { art+=shape('m9 42-5 12 7-1 7 7 5-9Zm32 9 7 9 3-7 9 2-6-13Z',worn==='blood'?ember:tone[1]);etch+=line('m9 31 14-4m17 0 14 4',bone,3); }
    } else if (def.slot === 'boots') {
      if (/throneless/.test(key)) { art+=shape('M8 13 5 3 15 8 18 1 22 9 28 3 26 15Zm30 2-2-12 9 5 4-7 4 8 6-6-3 12Z',gold);etch+=line('M12 23h10m21 0h10',bone,3); }
      else if (/grave|buried-road|gallows/.test(key)) { art+=loop(18,36,10,4,steel)+loop(46,36,10,4,steel)+chain(8,35)+chain(56,35);etch+=line('M15 18v12m30-12v12',bone,2); }
      else if (/dead-forge|ash-road/.test(key)) { art+=shape('M5 48 1 43 3 59h27l-3-10-5 3-3-8-6 9Zm34 1-3-6-1 16h28l-4-10-6 3-4-8-5 9Z',worn==='ash'?bone:steel);etch+=line('M15 14v19m31-19v19',ember,3); }
      else if (/footwraps|pilgrim|mourning|worker/.test(key)) { art=shape('M10 25h16l-2 15 7 6-2 13H4V47l6-8Zm29 0h16l-1 14 7 8v12H36l-1-13 5-6Z',leather)+shape('M9 8h17v23H9Zm30 0h17v23H39Z',tone[1]);etch=line('M10 14h15m-15 7h15m15-7h15m-15 7h15M9 43l18 8m13-8 18 8',bone,2); }
      else if (/tide|sunken/.test(key)) { art+=shape('M9 13 2 16l5 22-4 11 13-5 8-8Zm32 0 18 3-5 22 9 11-13-5-8-8Z',tone[1]);etch+=line('M9 17 19 33m33-16L43 33',bone,2); }
    }
    return '<svg class="char-icon char-gear-icon" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="' + id + '-steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + tone[0] + '"/><stop offset=".38" stop-color="' + tone[1] + '"/><stop offset=".55" stop-color="' + tone[0] + '"/><stop offset="1" stop-color="' + tone[2] + '"/></linearGradient><linearGradient id="' + id + '-leather" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#765341"/><stop offset=".5" stop-color="#42392e"/><stop offset="1" stop-color="#1d211f"/></linearGradient></defs><g stroke="#0b1013" stroke-width="1.2" stroke-linejoin="round">' + art + '</g><g fill="none" stroke="#e6d7bb" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round">' + etch + '</g></svg>';
  }
  // The tree and the action bar share the same decoded, prepainted miniature.
  function skillArt(type) { return B.SkillArt ? B.SkillArt.markup(type) : ''; }
  function icon(type) {
    const painted = skillArt(type); if (painted) return painted;
    const paths = {
      sword: '<path d="M30 5 34 13 19 31 13 25Z"/><path d="m10 23 12 12m-8-6-7 8m-3-1 6 5"/>',
      axe: '<path d="m9 39 20-30m-9 3c11-7 15-5 20 2l-8 11-10-8"/>',
      spear: '<path d="m8 40 23-27m-7 0 13-9-5 16Z"/>',
      head: '<path d="M10 30V19c0-15 28-15 28 0v11l-9 7-5-12-5 12Z"/><path d="M24 8v15m-13-1 8 2m10 0 8-2"/>',
      chest: '<path d="m15 7-9 6 4 12 5-3-2 17h22l-2-17 5 3 4-12-9-6c-3 8-15 8-18 0Z"/><path d="M24 17v20m-9-9h18"/>',
      hands: '<path d="m12 28-4-9c-2-5 3-6 5-2l3 5V9c0-4 5-4 5 0v10-13c0-4 5-4 5 0v13-10c0-4 5-4 5 0v12-6c0-4 5-4 5 0v13l-5 10H17Z"/>',
      boots: '<path d="M15 7h16l-1 20 9 7v6H9v-9l6-4Z"/><path d="M16 14h13m-13 6h13M10 35h27"/>',
      cleave: '<path d="M8 34C8 13 25 5 40 10 23 13 18 22 16 37Z"/><path d="m8 40 24-28"/>',
      roar: '<path d="M10 18v12l9 4V14Zm17-6c8 7 8 17 0 24m8-30c13 11 13 25 0 36"/>',
      whirl: '<path d="M13 34C0 16 29 1 39 17c8 14-11 30-22 17-7-9 5-20 12-10"/><path d="m7 29 6 5 2-8"/>',
      charge: '<path d="m6 11 11 12L6 35m13-24 11 12-11 12m13-24 11 12-11 12"/>',
      quake: '<path d="m23 5 2 17-6 7 7 4-5 11M5 33l11-7m13 0 14 7M8 42l8-6m15 0 9 6"/>',
      reap: '<path d="M5 32C6 11 19 6 28 9 17 12 13 21 12 34Zm12 6c1-21 14-26 23-23-11 3-15 12-16 25Z"/>',
      brand: '<path d="m24 5 14 19-14 19L10 24Zm0 9 7 10-7 10-7-10ZM5 24h7m24 0h7M24 3v9m0 24v9"/>',
      grasp: '<path d="m12 38-5-13 4-11 4 8 2-15 4 13 4-16 3 17 6-12 1 18 7-5-6 16-10 5ZM17 27l3 9m8-9-2 9"/>',
      rend: '<path d="M5 12h38M8 24h32M12 36h24m-11-31-7 16 11 7-8 15m-13-30 6 3m20 7 7-4m-24 18-6 4"/>',
      temper: '<path d="M24 4c2 10 12 11 10 21 9-5 7-12 7-12 8 17-2 29-17 29S-.5 30 7 13c0 9 6 12 7 12-3-11 10-13 10-21Z"/><path d="M24 23c0 7-8 9-5 14 3 5 11 3 11-2 0-4-4-6-6-12Z"/>',
      havoc: '<path d="m5 10 10 10-10 10m12-20 10 10-10 10m12-20 10 10-10 10M4 40h40M10 44l6-4m10 4 4-4m10 4 3-4"/>',
      chainstorm: '<ellipse cx="24" cy="25" rx="19" ry="15"/><ellipse cx="24" cy="25" rx="12" ry="9"/><ellipse cx="24" cy="25" rx="5" ry="4"/><path d="m10 12 4 5m20-5-4 5M5 25h7m24 0h7M11 37l4-5m18 5-4-5M24 7v10m0 16v10"/>'
    };
    return '<svg class="char-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + (paths[type === 'weapon' ? 'sword' : type] || paths.chest) + '</svg>';
  }
  // Skill tree page styles (round 6). Own class names (skt-*), injected once, so the rest of the character page styling is not touched.
  const SKILL_TREE_CSS = [
    '.skt-wrap{display:grid;gap:10px;min-width:0}',
    '.skt-top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.skt-top .skt-loadout{flex:1;min-width:0}',
    '.skt-points{flex:none;display:flex;align-items:baseline;gap:8px;padding:7px 14px;border:1px solid #b99458;background:linear-gradient(#3a2d1c,#17120d);color:#e8d3a6;font:600 13px/1 var(--text);letter-spacing:.04em;text-transform:uppercase;box-shadow:inset 0 0 0 2px #0006}',
    '.skt-points b{font:700 24px/1 var(--text);color:#ffe0a0;font-variant-numeric:tabular-nums}',
    '.skt-workspace{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;min-width:0}',
    '.skt-tree{position:relative;min-width:0;border:1px solid #725b3b88;background:radial-gradient(ellipse at 50% 0,#93753a22,transparent 65%),linear-gradient(#0c0c0be8,#10100de6),url(assets/ui/stone.webp) center/420px;box-shadow:inset 0 0 35px #000c;padding:10px 10px 8px}',
    '.skt-cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
    '.skt-col{--line:#bcbab0;display:flex;flex-direction:column;align-items:center;min-width:0;position:relative}',
    '.skt-col>header{width:100%;text-align:center;padding:0 2px 8px;margin-bottom:6px;border-bottom:2px solid var(--line)}',
    '.skt-col>header b{display:block;font:700 11px/1.2 var(--text);letter-spacing:.1em;color:var(--line)}',
    '.skt-col>header small{display:block;margin-top:3px;font:600 13px/1.2 var(--text);color:#e9dcc2}',
    '.skt-node{position:relative;display:flex;flex-direction:column;align-items:center;width:100%;min-height:112px;padding:6px 4px 4px;border:1px solid transparent;border-radius:4px;background:transparent;color:#cdbfa8;cursor:pointer;font-family:var(--text)}',
    '.skt-node:hover,.skt-node:focus-visible{background:#ffffff0a;border-color:#ffffff1f;outline:none}',
    '.skt-node.selected{background:color-mix(in srgb,var(--line) 14%,transparent);border-color:color-mix(in srgb,var(--line) 70%,#000)}',
    '.skt-emblem{position:relative;display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 44% 35%,#57442b 0,#17140f 49%,transparent 51%),url(assets/ui/medal.webp) center/100% 100% no-repeat;box-shadow:0 3px 9px #000b}',
    '.skt-emblem .char-icon{width:37px;height:37px;color:#a89a84}',
    '.skt-tier{position:absolute;left:-6px;top:-4px;min-width:22px;height:20px;padding:0 5px;display:grid;place-items:center;border:1px solid #1a130c;border-radius:3px;background:#6d5a3f;color:#fff3da;font:800 11px/1 var(--text);letter-spacing:.02em;box-shadow:0 1px 3px #000a}',
    '.skt-node[data-tier="2"] .skt-tier{background:#c4952f;color:#201505}',
    '.skt-node[data-tier="3"] .skt-tier{background:#b9a6ff;color:#120a2a}',
    '.skt-node strong{margin-top:6px;max-width:100%;font:700 15px/1.15 var(--text);text-align:center;color:#e9dcc3}',
    '.skt-state{margin-top:3px;font:600 11.5px/1.25 var(--text);color:#a99a80;text-align:center}',
    '.skt-node.learned .skt-emblem{background:radial-gradient(circle at 44% 35%,color-mix(in srgb,var(--line) 38%,#251e16),#17140f 49%,transparent 51%),url(assets/ui/medal.webp) center/100% 100% no-repeat}',
    '.skt-node.learned .char-icon{color:var(--line);filter:drop-shadow(0 2px 2px #000)}',
    '.skt-node.learned .skt-state{color:#cbd8b4}',
    '.skt-node.available .skt-emblem{box-shadow:0 3px 9px #000b,0 0 0 2px #e8c67a99,0 0 16px #e8c67a55}',
    '.skt-node.available .skt-state{color:#f0d596}',
    '.skt-node.available .char-icon{color:#e1cfa2}',
    '.skt-node.locked .skt-emblem{filter:saturate(.2);opacity:.5}',
    '.skt-node.locked strong{color:#9d927f}',
    '.skt-node.locked .skt-state{color:#867b69}',
    '.skt-node.slotted .skt-state{color:#ffe1a2}',
    '.skt-slotcap{position:absolute;right:2px;top:2px;display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border:1px solid #d9b266;border-radius:3px;background:#2a1e0f;color:#ffe3a8;font:800 10px/1.2 var(--text);letter-spacing:.04em;box-shadow:0 1px 4px #000a}',
    '.skt-mouse{width:10px;height:14px;fill:currentColor;flex:none}',
    '.skt-link{display:block;position:relative;width:2px;height:18px;margin:-1px 0;background:#5f5239;opacity:.8}',
    '.skt-link::after{content:"";position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);border:6px solid transparent;border-top:8px solid #5f5239;border-bottom:0}',
    '.skt-link.ready{background:repeating-linear-gradient(#e8c67a 0 4px,transparent 4px 7px)}',
    '.skt-link.ready::after{border-top-color:#e8c67a}',
    '.skt-link.lit{background:var(--line);opacity:1;box-shadow:0 0 6px color-mix(in srgb,var(--line) 60%,transparent)}',
    '.skt-link.lit::after{border-top-color:var(--line)}',
    '.skt-inspect{--line:#bcbab0;position:relative;min-width:0;padding:12px 14px 12px;border:1px solid #796145;border-top:3px solid var(--line);background:linear-gradient(#12110ff2,#080807f5),url(assets/ui/stone.webp) center/280px;box-shadow:inset 0 0 0 3px #0005;display:flex;flex-direction:column;gap:6px;align-self:start}',
    '.skt-kicker{font:700 11px/1.4 var(--text);letter-spacing:.08em;color:var(--line);text-transform:uppercase}',
    '.skt-tiernum{display:inline-block;margin-right:6px;padding:2px 7px;border-radius:3px;background:#6d5a3f;color:#fff3da}',
    '.skt-tiernum[data-tier="2"]{background:#c4952f;color:#201505}',
    '.skt-tiernum[data-tier="3"]{background:#b9a6ff;color:#120a2a}',
    '.skt-inspect header{display:flex;align-items:center;gap:12px}',
    '.skt-inspect header .char-icon{flex:none;width:46px;height:46px;color:var(--line)}',
    '.skt-inspect h3{margin:0;font:700 24px/1.1 var(--text);color:#f3e6c9}',
    '.skt-inspect>p{margin:0;font:400 14px/1.4 var(--text);color:#d6c8ae}',
    '.skt-inspect>.skt-delta{padding:7px 10px;border-left:3px solid #e0b85a;background:#e0b85a14;color:#f2dfae}',
    '.skt-delta b{color:#ffd77a}',
    '.skt-facts{display:grid;gap:2px}',
    '.skt-fact{display:grid;grid-template-columns:1fr auto;align-items:baseline;column-gap:10px;padding:3px 8px;border-radius:3px;background:#ffffff08;font:500 13.5px/1.3 var(--text);color:#bdb09a}',
    '.skt-fact b{font:700 15px/1.2 var(--text);color:#efe4cc;font-variant-numeric:tabular-nums}',
    '.skt-fact.changed{background:#e0b85a1c;color:#e9d7a8}',
    '.skt-fact.changed b{color:#ffd77a}',
    '.skt-fact em{font:500 11.5px/1.2 var(--text);font-style:normal;color:#9c8e75}',
    '.skt-learn{width:100%;min-height:40px;border:1px solid #b1925f;color:#f1dcb0;background:linear-gradient(#4a3822,#1a140d);font:700 15px/1.2 var(--text);letter-spacing:.02em;cursor:pointer;padding:6px 10px}',
    '.skt-learn:hover:not(:disabled){filter:brightness(1.2)}',
    '.skt-learn:disabled{opacity:.55;cursor:default}',
    '.skt-inspect:has(.skt-assign) .skt-learn{display:none}',
    '.skt-assign small{display:block;margin-bottom:6px;font:700 11px/1.2 var(--text);letter-spacing:.08em;text-transform:uppercase;color:#a99a80}',
    '.skt-assign>div{display:grid;gap:4px}',
    '.skt-assign button{display:flex;align-items:center;gap:10px;width:100%;min-height:32px;padding:2px 10px;border:1px solid #8a7048;background:linear-gradient(#35291b,#15110c);color:#ecd9b0;font:600 14px/1.2 var(--text);cursor:pointer;text-align:left}',
    '.skt-assign button:hover:not(:disabled){filter:brightness(1.2)}',
    '.skt-assign button:disabled{opacity:.6;cursor:default;border-color:#d9b266}',
    '.skt-cap{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:58px;padding:3px 8px;border:1px solid #d9b266;border-radius:3px;background:#2a1e0f;color:#ffe3a8;font:800 11.5px/1.2 var(--text);letter-spacing:.05em;white-space:nowrap}',
    '.skt-loadout h4{margin:0 0 6px;font:700 13px/1.2 var(--text);letter-spacing:.08em;text-transform:uppercase;color:#d8c9a8;display:flex;align-items:center;gap:10px}',
    '.skt-loadout h4 small{font:700 12px/1.2 var(--text);color:#ffe3a8;display:inline-flex;align-items:center;gap:6px}',
    '.skt-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
    '.skt-slot{--line:#6c604c;position:relative;display:flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--line) 70%,#000);border-left:4px solid var(--line);background:linear-gradient(#17130e,#0c0a08)}',
    '.skt-slot.empty{border-style:dashed;opacity:.8}',
    '.skt-slot>button:not(.skt-remove){display:flex;align-items:center;gap:10px;flex:1;min-width:0;border:0;background:transparent;color:#e9dcc3;text-align:left;cursor:pointer;padding:0;font-family:var(--text)}',
    '.skt-slot .char-icon{width:34px;height:34px;flex:none;color:var(--line)}',
    '.skt-slot strong{display:block;font:700 14.5px/1.2 var(--text)}',
    '.skt-slot small{display:block;font:500 11.5px/1.25 var(--text);color:#a99a80}',
    '.skt-remove{flex:none;width:28px;height:28px;border:1px solid #6b573a;background:#1a140d;color:#cdb98f;cursor:pointer;font-size:16px;line-height:1}',
    '.skt-tree .skt-note{margin:8px 4px 0;font:400 12.5px/1.45 var(--text);color:#a39379}',
    '@media(max-width:1100px){.skt-workspace{grid-template-columns:minmax(0,1fr) 290px}.skt-emblem{width:54px;height:54px}.skt-emblem .char-icon{width:34px;height:34px}.skt-node strong{font-size:13.5px}}',
    '@media(max-width:900px){.skt-workspace{grid-template-columns:1fr}.skt-slots{grid-template-columns:1fr}.skt-top{flex-direction:column;align-items:stretch}}',
    '@media(max-width:560px){.skt-cols{gap:2px}.skt-emblem{width:44px;height:44px}.skt-emblem .char-icon{width:28px;height:28px}.skt-node{padding:6px 1px;min-height:112px}.skt-node strong{font-size:12px}.skt-state{font-size:10.5px}.skt-slotcap{display:none}}',
    '@media(prefers-reduced-motion:no-preference){.skt-node.available .skt-emblem{animation:skt-pulse 2.2s ease-in-out infinite}@keyframes skt-pulse{50%{box-shadow:0 3px 9px #000b,0 0 0 2px #e8c67acc,0 0 22px #e8c67a77}}}'
  ].join('\n');
  function create(options) {
    options = options || {};
    const getGame = () => typeof options.game === 'function' ? options.game() : options.game;
    const getState = () => getGame() && getGame().progression;
    const overlay = document.createElement('section'); overlay.id = 'character'; overlay.className = 'screen overlay modal hidden';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'character-title');
    overlay.innerHTML = '<div class="panel character-panel"><span class="funeral-effigy effigy-left" aria-hidden="true"></span><span class="funeral-effigy effigy-right" aria-hidden="true"></span><header class="panel-head"><div><span class="mourning-title">KABİR AZABI</span><h2 id="character-title">Karakter ve yetenekler</h2></div><button class="close" data-char="close" aria-label="Oyuna dön">×</button></header>' +
      '<div class="funeral-verses"><span><span class="banner-inscription">Ölüm hakkın tezahürüdür</span></span><span><span class="banner-inscription">Her nefis ölümü tadacaktır</span></span></div><nav class="char-tabs" aria-label="Karakter sayfaları"><button data-char="tab" data-tab="inventory">Karakter ve çanta</button><button data-char="tab" data-tab="skills">Yetenek ağacı</button></nav>' +
      '<div class="char-content"></div><footer class="char-footer"><div class="char-progress"></div><span class="char-status" role="status" aria-live="polite"></span><span class="funeral-quote"><span class="banner-inscription">Sonra bize döndürüleceksiniz</span></span><button class="btn small" data-char="close">Oyuna dön</button></footer></div>';
    document.body.appendChild(overlay);
    if (!document.getElementById('skill-tree-style')) { const st = document.createElement('style'); st.id = 'skill-tree-style'; st.textContent = SKILL_TREE_CSS; document.head.appendChild(st); }
    const progress = overlay.querySelector('.char-progress'), content = overlay.querySelector('.char-content'), status = overlay.querySelector('.char-status');
    let renderedFilter = 'all';
    let opened = false, tab = 'inventory', selected = null, lastRevision = -1, priorFocus = null, previewFrame = 0, selectedSkill = 'cleave', selectedSlot = null, bagFilter = 'all', bagPage = 0, lastPointerType = 'mouse', tap = null, inspectScroll = 0;
    // ---- Item presentation: name, type line, one big primary stat with a difference arrow, then the rest. ----
    const ATTR = { damage: ['Hasar bonusu', true], defense: ['Hasar azaltma', true], hp: ['Can gücü', false] };
    const arrow = (d, pct) => Math.abs(d) < .00001 ? '<b class="cmp same" title="Aynı">=</b>' : '<b class="cmp ' + (d > 0 ? 'gain' : 'loss') + '"><i aria-hidden="true">' + (d > 0 ? '▲' : '▼') + '</i>' + (d > 0 ? '+' : '−') + (pct ? percent(Math.abs(d)) : Math.abs(d)) + '</b>';
    const amount = (v, pct) => v ? '+' + (pct ? percent(v) : v) : pct ? '0%' : '0';
    function statLines(def, old, compare) {
      const primary = def.slot === 'weapon' ? 'damage' : 'defense';
      const line = key => { const v = def[key] || 0, d = v - (old ? old[key] || 0 : 0), pct = ATTR[key][1]; return { key, v, d, pct, label: ATTR[key][0], text: amount(v, pct), arrow: compare ? arrow(d, pct) : '' }; };
      return { main: line(primary), rest: ['damage', 'defense', 'hp'].filter(k => k !== primary).map(line).filter(r => r.v || (compare && Math.abs(r.d) > .00001)) };
    }
    function itemDetail(state, entry, compact) {
      const def = B.Progression.resolveItem(entry);
      if (!def) return '<div class="char-empty-detail">' + icon(selectedSlot || 'chest') + '<h3>' + (selectedSlot ? LABELS[selectedSlot] + ' yuvası boş' : 'Bir eşya seç') + '</h3><p>Çantadan bir parçaya dokun. Özelliklerini ve giydiğinle farkını burada göreceksin.</p></div>';
      const old = state.itemForSlot(def.slot), equipped = state.equipment[def.slot] === entry.uid, compare = !equipped && !!old, locked = def.level > state.level;
      const lines = statLines(def, equipped ? null : old, compare);
      const head = '<div class="cd-head"><span class="char-item-art cd-art">' + menuGearIcon(def) + '</span><div class="cd-title"><span class="cd-sub">' + RARITY[def.rarity] + ' · ' + (TYPE[def.type] || LABELS[def.slot]) + '</span><h3>' + escape(def.name) + '</h3></div></div>';
      const primary = '<div class="cd-primary"><span class="cd-plabel">' + lines.main.label + '</span><div class="cd-pline"><strong>' + lines.main.text + '</strong>' + lines.main.arrow + '</div></div>';
      const rest = lines.rest.length ? '<div class="cd-rest">' + lines.rest.map(r => '<div class="cd-row"><span>' + r.label + '</span><strong>' + r.text + '</strong>' + r.arrow + '</div>').join('') + '</div>' : '';
      const req = '<div class="cd-chips"><span class="cd-chip ' + (locked ? 'bad' : 'ok') + '">' + (locked ? def.level + '. seviye gerekli' : 'Seviye ' + def.level) + '</span><span class="cd-chip power" title="Eşya gücü">Güç ' + def.power + '</span>' + (def.roll ? '<span class="cd-chip ' + (def.roll > 0 ? 'ok' : 'bad') + '" title="İşçilik">İşçilik ' + (def.roll > 0 ? '+' : '−') + Math.abs(def.roll) + '</span>' : '') + '</div>';
      const worn = equipped ? '<div class="cd-worn"><i aria-hidden="true">✓</i> Kuşanılmış parça</div>' : '';
      if (compact) return head + worn + primary + rest + req + '<p class="cd-hint">' + (equipped ? 'Çift tıkla: çıkar' : locked ? 'Henüz giyemezsin' : 'Çift tıkla: kuşan') + '</p>';
      const note = equipped ? '' : '<p class="cd-note">' + (old ? 'Giydiğinle karşılaştırma: <b>' + escape(old.name) + '</b>' : 'Bu yuva şu anda boş') + '</p>';
      const action = equipped ? '<button class="cd-btn calm" data-char="unequip" data-slot="' + def.slot + '">Çıkar</button>' : '<button class="cd-btn go" data-char="equip" data-uid="' + escape(entry.uid) + '" ' + (locked ? 'disabled' : '') + '>' + (locked ? def.level + '. seviye gerekli' : def.slot === 'weapon' ? 'Silahı kuşan' : 'Kuşan') + '</button>';
      return head + worn + primary + rest + note + req + (def.description ? '<p class="cd-lore">' + escape(def.description) + '</p>' : '') + '<div class="cd-actions">' + action + '</div>';
    }
    // Small filled stat icons (own vectors; no network, no textures).
    const STAT = {
      hp: ['#ef6b5e', '<path d="M24 42C8 31 4 22 4 15 4 9 9 6 14 6c4 0 8 2 10 6 2-4 6-6 10-6 5 0 10 3 10 9 0 7-4 16-20 27Z"/>'],
      hit: ['#f3a24c', '<path d="M34 4h10v10L24 34l-6-6Z"/><path d="m14 28 6 6-5 5-4-1-2-4Z"/><path d="M8 36l4 4-5 5-4-4Z"/>'],
      def: ['#6fb1f2', '<path d="M24 3 7 9v13c0 11 7 19 17 23 10-4 17-12 17-23V9Z"/>'],
      crit: ['#f1d35a', '<path d="m24 2 6 15 16 1-12 10 4 16-14-9-14 9 4-16L2 18l16-1Z"/>'],
      critx: ['#f08a5a', '<path d="M28 2 10 27h12l-4 19 20-27H26Z"/>'],
      power: ['#c9a7ff', '<path d="m24 3 18 21-18 21L6 24Z"/>']
    };
    const statIcon = key => '<svg class="st-ico" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor" style="color:' + STAT[key][0] + '">' + STAT[key][1] + '</svg>';
    function inventory(state) {
      // Resolve once per menu refresh; rarity leads, then stronger pieces of the
      // same quality. Sort a view, never the saved inventory or equipment IDs.
      const visible = state.inventory.map((entry, index) => ({ entry, index, def: B.Progression.resolveItem(entry) }))
        .filter(item => item.def && (bagFilter === 'all' || item.def.slot === bagFilter))
        .sort((a, b) => B.Progression.qualities[b.def.rarity].rank - B.Progression.qualities[a.def.rarity].rank || b.def.power - a.def.power || b.index - a.index)
        .map(item => item.entry);
      if (!selectedSlot && !visible.some(i => i.uid === selected)) selected = visible[0] && visible[0].uid;
      const stats = state.stats(), weapon = state.itemForSlot('weapon'), difficulty = getGame().difficulty;
      const damageScale = difficulty === 'normal' || difficulty === 'easy' ? 1.18 : 1;
      const questReduction = getGame().quests && getGame().quests.benefits && getGame().quests.benefits.damageReduction;
      const oathDefense = Number.isFinite(questReduction) ? Math.max(0, Math.min(.12, questReduction)) : 0;
      const permanentDefense = oathDefense ? 1 - (1 - stats.defense) * (1 - oathDefense) : stats.defense;
      const defenseTitle = 'Zırh ' + percent(stats.defense) + (oathDefense ? ' · Bu bölümün yemini ' + percent(oathDefense) + ' · Birlikte ' + percent(permanentDefense) : '');
      const attackProfile = typeof getGame().normalAttackProfile === 'function' ? getGame().normalAttackProfile() : null;
      const attackDamage = attackProfile && Array.isArray(attackProfile.damage) ? attackProfile.damage : [25, 29, 36];
      const equipment = B.Progression.slots.map(slot => {
        const def = state.itemForSlot(slot), uid = state.equipment[slot], active = uid ? uid === selected : slot === selectedSlot;
        return '<button class="char-equipment ' + (def ? 'worn rarity-' + def.rarity : 'empty') + (active ? ' selected' : '') + '" data-slot="' + slot + '" data-char="select" data-uid="' + escape(uid || '') + '" aria-pressed="' + active + '" aria-label="' + escape(LABELS[slot] + ' · ' + (def ? def.name + ' · Kuşanıldı · Çift tıkla çıkar' : 'Boş yuva')) + '">' + (def ? '<i class="eq-ribbon" aria-hidden="true" title="Kuşanıldı">✓</i>' : '') + '<span class="char-item-art">' + (def ? menuGearIcon(def) : icon(slot)) + '</span><span class="eq-label">' + LABELS[slot] + '</span><span class="eq-name">' + escape(def ? def.name : 'Boş') + '</span></button>';
      }).join('');
      const pageCount = Math.max(1, Math.ceil(visible.length / 16));
      bagPage = Math.min(bagPage, pageCount - 1);
      const pageItems = visible.slice(bagPage * 16, (bagPage + 1) * 16);
      const list = pageItems.map(entry => {
        const def = B.Progression.resolveItem(entry), equipped = state.equipment[def.slot] === entry.uid, upgrade = state.isUpgrade(entry), locked = def.level > state.level;
        return '<button class="char-item rarity-' + def.rarity + (entry.uid === selected ? ' selected' : '') + (equipped ? ' equipped' : '') + (locked ? ' too-high' : '') + '" data-char="select" data-uid="' + escape(entry.uid) + '" data-item-slot="' + def.slot + '" aria-pressed="' + (entry.uid === selected) + '" aria-label="' + escape(def.name + ' · ' + RARITY[def.rarity] + ' · Seviye ' + def.level + ' · Güç ' + def.power + (equipped ? ' · Kuşanıldı' : upgrade ? ' · Kuşandığından daha iyi' : '')) + '"><span class="char-item-art">' + menuGearIcon(def) + '</span><span class="char-item-level" aria-hidden="true">' + (locked ? 'Sv ' + def.level : def.power) + '</span><strong class="char-item-name">' + escape(def.name) + '</strong>' + (upgrade && !locked ? '<b class="char-item-upgrade" title="Kuşandığından daha iyi" aria-label="Kuşandığından daha iyi">▲</b>' : '') + (equipped ? '<i class="char-item-ribbon" aria-hidden="true" title="Kuşanıldı">✓</i>' : '') + '<i class="char-quality" aria-hidden="true" title="' + RARITY[def.rarity] + '"></i></button>';
      }).join('') + '<span class="char-item-empty" aria-hidden="true"></span>'.repeat(Math.max(0, 16 - pageItems.length));
      const pagination = '<div class="bag-pagination"><button data-char="bag-page" data-direction="-1" aria-label="Önceki eşya sayfası" ' + (bagPage === 0 ? 'disabled' : '') + '>‹</button><span>' + (visible.length ? visible.length + ' eşya · ' : 'Bu türde eşyan yok · ') + (bagPage + 1) + ' / ' + pageCount + '</span><button data-char="bag-page" data-direction="1" aria-label="Sonraki eşya sayfası" ' + (bagPage + 1 >= pageCount ? 'disabled' : '') + '>›</button></div>';
      const entry = state.inventory.find(i => i.uid === selected), def = B.Progression.resolveItem(entry);
      const filters = ['all', ...B.Progression.slots].map(slot => '<button class="char-filter' + (bagFilter === slot ? ' active' : '') + '" data-char="filter" data-filter="' + slot + '" aria-pressed="' + (bagFilter === slot) + '" title="' + (slot === 'all' ? 'Bütün eşyalar' : LABELS[slot]) + '" aria-label="' + (slot === 'all' ? 'Bütün eşyalar' : LABELS[slot] + ' eşyaları') + '">' + (slot === 'all' ? 'Tümü' : icon(slot)) + '</button>').join('');
      const preview = typeof options.onPreview === 'function' ? '<figure class="char-preview"><span class="char-preview-label">Bahtiyar</span><canvas id="character-preview" width="420" height="520" aria-label="Bahtiyar’ın kuşandığı silah ve zırhları gösteren canlı karakter görünümü"></canvas><div class="char-preview-turn"><button data-char="turn" data-direction="-1" aria-label="Karakteri sola çevir">‹</button><button data-char="turn" data-direction="1" aria-label="Karakteri sağa çevir">›</button></div><figcaption>' + escape(weapon ? (TYPE[weapon.type] || 'Silah') + ' · ' + weapon.name : 'Silah yuvası boş') + '</figcaption></figure>' : '';
      const gear = B.Progression.slots.reduce((sum, slot) => sum + (state.itemForSlot(slot)?.power || 0), 0);
      const tile = (key, label, value, title = '') => '<span class="st-tile"' + (title ? ' title="' + escape(title) + '"' : '') + '>' + statIcon(key) + '<span class="st-text"><small>' + label + '</small><strong style="color:' + STAT[key][0] + '">' + value + '</strong></span></span>';
      const statGrid = '<div class="char-stat-grid">' + tile('hp', 'Can', stats.maxHp) + tile('hit', 'Normal vuruş', Math.round(Math.round(attackDamage[0] * stats.damage) * damageScale) + '–' + Math.round(Math.round(attackDamage[2] * stats.damage) * damageScale)) + tile('def', 'Hasar azaltma', percent(permanentDefense), defenseTitle) + tile('crit', 'Kritik ihtimali', percent(stats.criticalChance)) + tile('critx', 'Kritik hasarı', '×' + stats.criticalMultiplier.toFixed(1)) + tile('power', 'Donanım gücü', gear) + '</div>';
      return '<div class="char-inventory-layout' + (preview ? ' has-preview' : '') + '"><section class="char-sheet"><h3>Donanım <small>Kuşandıkların</small></h3>' + (preview ? '<div class="char-doll">' + preview + equipment + '</div>' : equipment) + statGrid + '</section>' +
        '<section class="char-bag"><h3>Çanta <small>' + state.inventory.length + ' eşya</small></h3><div class="char-bag-toolbar">' + filters + '</div><div class="char-item-list char-bag-grid">' + (visible.length ? '' : '<p class="char-bag-empty">Bu türde eşyan yok.</p>') + list + '</div>' + pagination + '<p class="char-bag-help">Seç: incele · Çift tıkla veya iki kez dokun: kuşan / çıkar</p></section><section class="char-detail' + (def ? ' rarity-' + def.rarity : '') + '">' + itemDetail(state, entry, false) + '</section></div>';
    }
    // ---- Skill tree page: four horizontal paths, three tiers in each path. A lower tier upgrades the one above it in the same slot.
    const ROMAN = ['', 'I', 'II', 'III'];
    const keyLabels = () => { try { const k = typeof options.keyLabels === 'function' ? options.keyLabels() : null; if (Array.isArray(k) && k.length >= 4) return k; } catch (_) { /* fall back */ } return ['SAĞ TIK', '1', '2', '3']; };
    const capHtml = label => (label === 'SAĞ TIK' ? '<svg class="skt-mouse" aria-hidden="true"><use href="#i-mouse-r"/></svg>' : '') + escape(label);
    const slotWord = label => ({ 'SAĞ TIK': 'Sağ tık', 'SOL TIK': 'Sol tık', 'ORTA TIK': 'Orta tık', 'FARE 4': 'Fare 4', 'FARE 5': 'Fare 5' }[label] || label + ' tuşu');
    function talents(state) {
      const P = B.Progression, all = P.skills, chosen = all.find(s => s.id === selectedSkill) || all[0], byId = new Map(all.map(s => [s.id, s])), keys = keyLabels();
      const lineOf = id => P.lines.find(l => l.id === id) || P.lines[0];
      const learned = state.learned.includes(chosen.id), parent = byId.get(chosen.requires), prevFacts = parent ? new Map(P.skillFacts(parent)) : null;
      const access = P.skillAccess(state, chosen.id), slotOf = id => state.loadout.indexOf(id);
      const replaced = parent && slotOf(parent.id) >= 0 ? slotOf(parent.id) : -1;
      const reason = access.canLearn ? '1 puanla öğren' + (replaced >= 0 ? ' · ' + parent.name + ' yerine geçer' : '') : access.reason;
      const columns = P.lines.map((line, c) => {
        const list = P.skillsByLine(line.id);
        const nodes = list.map((s, i) => {
          const gate = P.skillAccess(state, s.id), known = gate.known, blocked = gate.blocked, slot = slotOf(s.id);
          const canLearn = gate.canLearn, superseded = known && slot < 0 && list.some(next => next.tier > s.tier && state.learned.includes(next.id));
          const stateText = slot >= 0 ? 'Etkin aşama' : superseded ? 'Önceki aşama' : known ? 'Öğrenildi' : gate.low ? 'Seviye ' + s.level : gate.missingTier ? 'Önce dört ' + ROMAN[s.tier - 1] + '. aşama' : escape(gate.reason);
          const link = i ? '<i class="skt-link ' + (known ? 'lit' : canLearn ? 'ready' : '') + '" aria-hidden="true"></i>' : '';
          return link + '<button data-char="skill" data-skill="' + s.id + '" data-line="' + line.id + '" data-tier="' + s.tier + '" class="skt-node ' + (known ? 'learned' : blocked ? 'locked' : canLearn ? 'available' : 'pending') + (superseded ? ' superseded' : '') + (slot >= 0 ? ' slotted' : '') + (s.id === chosen.id ? ' selected' : '') +
            '" aria-pressed="' + (s.id === chosen.id) + '" title="' + escape(s.name) + ' · ' + ROMAN[s.tier] + '. aşama · seviye ' + s.level + (s.tier > 1 ? ' · Önce ' + ROMAN[s.tier - 1] + '. aşamadaki dört yetenek' : '') + '">' +
            '<i class="skt-emblem">' + icon(s.id) + '<b class="skt-tier">' + ROMAN[s.tier] + '</b></i><strong>' + escape(s.name) + '</strong><small class="skt-state">' + stateText + '</small>' +
            (slot >= 0 ? '<span class="skt-slotcap">' + capHtml(keys[slot]) + '</span>' : '') + '</button>';
        }).join('');
        return '<section class="skt-col" data-line="' + line.id + '" style="--line:' + line.color + '"><header><b>' + escape(line.name) + '</b><small>' + escape(line.short) + '</small></header>' + nodes + '</section>';
      }).join('');
      const facts = P.skillFacts(chosen).map(([label, value]) => {
        const before = prevFacts ? prevFacts.get(label) : undefined, changed = before !== undefined && before !== value;
        const hint = (label.startsWith('Temel ') ? 'Silah, zorluk ve geçici etkiler gerçek hasarı değiştirir.' : '') + (changed ? ' Önceki aşama: ' + before : '');
        return '<div class="skt-fact' + (changed ? ' changed' : '') + '"><span' + (hint ? ' title="' + escape(hint.trim()) + '"' : '') + '>' + escape(label) + '</span><b>' + escape(value) + '</b></div>';
      }).join('');
      const assignment = learned ? '<div class="skt-assign"><small>Hangi yuvaya konsun?</small><div>' + [0, 1, 2, 3].map(slot => {
        const here = state.loadout[slot] === chosen.id, other = byId.get(state.loadout[slot]);
        return '<button aria-label="' + escape(slotWord(keys[slot], slot) + ' yuvasına ' + chosen.name + ' ata') + '" title="' + escape(here ? 'Bu yuvada' : other ? other.name + ' yerine ata' : 'Boş yuvaya ata') + '" data-char="assign" data-skill="' + chosen.id + '" data-slot="' + slot + '" ' + (here ? 'disabled' : '') + '><span class="skt-cap">' + capHtml(keys[slot]) + '</span><span>' + (here ? 'Burada' : other ? escape(other.name) + ' yerine' : 'Boş yuva') + '</span></button>';
      }).join('') + '</div></div>' : '';
      const loadout = state.loadout.map((id, slot) => {
        const s = byId.get(id), label = keys[slot];
        return '<div class="skt-slot' + (s ? '' : ' empty') + '"' + (s ? ' data-line="' + s.line + '" style="--line:' + lineOf(s.line).color + '"' : '') + '><span class="skt-cap">' + capHtml(label) + '</span><button aria-label="' + escape((s ? s.name : 'Boş yetenek yuvası') + ' · ' + label) + '" title="' + escape(s ? s.name : 'Yetenek öğren ve ata') + '" data-char="skill" data-skill="' + (id || chosen.id) + '">' + (s ? icon(s.id) + '<span><strong>' + escape(s.name) + '</strong><small>' + ROMAN[s.tier] + '. aşama</small></span>' : '<span><strong>Boş yuva</strong><small>Yetenek öğren ve ata</small></span>') + '</button>' + (s ? '<button class="skt-remove" data-char="assign" data-slot="' + slot + '" data-skill="" aria-label="' + escape(s.name) + ' yuvasını boşalt">×</button>' : '') + '</div>';
      }).join('');
      const line = lineOf(chosen.line);
      return '<div class="skt-wrap"><div class="skt-top"><div class="skt-loadout"><h4>Donanılan yetenekler <small>' + capHtml(keys[0]) + ' · ' + escape(keys[1]) + ' · ' + escape(keys[2]) + ' · ' + escape(keys[3]) + '</small></h4><div class="skt-slots">' + loadout + '</div></div>' +
        '<span class="skt-points"><b>' + state.points + '</b> yetenek puanı</span></div>' +
        '<div class="skt-workspace"><div class="skt-tree"><div class="skt-cols">' + columns + '</div><p class="skt-note">Çift tıkla veya iki kez dokun: öğren. Sonraki aşama için önceki dört yeteneği tamamla; ardından istediğin sırayla yükselt.</p></div>' +
        '<aside class="skt-inspect" data-line="' + chosen.line + '" style="--line:' + line.color + '"><small class="skt-kicker"><span class="skt-tiernum" data-tier="' + chosen.tier + '">' + ROMAN[chosen.tier] + '. AŞAMA</span> ' + escape(line.name) + ' · seviye ' + chosen.level + '</small>' +
        '<header>' + icon(chosen.id) + '<h3>' + escape(chosen.name) + '</h3></header><p>' + escape(chosen.description) + '</p>' +
        (chosen.delta ? '<p class="skt-delta" title="' + escape(chosen.delta) + '"><b>▲ ' + ROMAN[chosen.tier] + '. aşama:</b> Önceki aşamaya göre güçlendi.</p>' : '') +
        '<div class="skt-facts">' + facts + '</div>' +
        '<button class="skt-learn" data-char="unlock" data-skill="' + chosen.id + '" ' + (!access.canLearn ? 'disabled' : '') + '>' + escape(reason) + '</button>' + assignment + '</aside></div></div>';
    }
    const tooltip = document.createElement('div'); tooltip.className = 'char-hover-tooltip hidden'; tooltip.id = 'character-item-tooltip'; tooltip.setAttribute('role', 'tooltip'); overlay.appendChild(tooltip);
    let hoverButton = null, touchActionAt = -1000;
    function hideTooltip() { if (hoverButton) hoverButton.removeAttribute('aria-describedby'); hoverButton = null; tooltip.classList.add('hidden'); }
    function stopPreview() { if (previewFrame) cancelAnimationFrame(previewFrame); previewFrame = 0; }
    function startPreview() {
      stopPreview(); const canvas = content.querySelector('#character-preview');
      if (!canvas || typeof options.onPreview !== 'function') return;
      // Pointer capture keeps a drag continuous even when the hand leaves the portrait.
      let dragPointer = null, dragX = 0;
      canvas.onpointerdown = event => {
        if (event.button !== 0 || dragPointer !== null) return;
        dragPointer = event.pointerId; dragX = event.clientX;
        canvas.setPointerCapture(dragPointer); canvas.classList.add('turning'); event.preventDefault();
      };
      canvas.onpointermove = event => {
        if (event.pointerId !== dragPointer) return;
        const delta = event.clientX - dragX; dragX = event.clientX;
        if (delta && typeof options.onPreviewTurn === 'function') options.onPreviewTurn(delta * .012 / (Math.PI / 6));
      };
      const finishTurn = event => {
        if (event.pointerId !== dragPointer) return;
        dragPointer = null; canvas.classList.remove('turning');
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      canvas.onpointerup = finishTurn; canvas.onpointercancel = finishTurn; canvas.onlostpointercapture = finishTurn;

      function frame(now) {
        previewFrame = 0;
        if (!opened || tab !== 'inventory' || !canvas.isConnected || overlay.classList.contains('hidden')) return;
        options.onPreview(canvas, now);
        previewFrame = requestAnimationFrame(frame);
      }
      previewFrame = requestAnimationFrame(frame);
    }
    function rememberFocus() {
      const active = document.activeElement;
      if (!overlay.contains(active) || !active.dataset.char) return null;
      const keys = ['char','uid','slot','skill','line','tier','tab','filter','direction'], token = {};
      for (const key of keys) if (active.dataset[key] != null) token[key] = active.dataset[key];
      return token;
    }
    function restoreFocus(token) {
      if (!token) return;
      const controls = [...overlay.querySelectorAll('[data-char]:not(:disabled)')].filter(el => !el.hidden && !el.closest('.hidden,[hidden],[inert]') && el.getClientRects().length);
      let next = controls.find(el => Object.keys(token).every(key => el.dataset[key] === token[key]));
      if (!next && token.uid) next = controls.find(el => el.dataset.char === 'select' && el.dataset.uid === token.uid);
      if (!next && token.skill) next = controls.find(el => el.classList.contains('skt-node') && el.dataset.skill === token.skill) || controls.find(el => el.dataset.char === 'skill' && el.dataset.skill === token.skill);
      if (!next && token.slot) next = controls.find(el => el.dataset.char === 'select' && el.dataset.slot === token.slot);
      if (!next && token.char === 'assign') next = controls.find(el => el.classList.contains('skt-node') && el.dataset.skill === selectedSkill) || controls.find(el => el.dataset.char === 'skill' && el.dataset.skill === selectedSkill);
      if (!next && token.char === 'bag-page') next = controls.find(el => el.dataset.char === 'bag-page') || controls.find(el => el.dataset.char === 'filter');
      if (!next) next = controls[0];
      if (next) next.focus({ preventScroll: true });
    }
    function refresh(force) {
      const state = getState(); if (!opened || !state || (!force && lastRevision === state.revision + ':' + getGame().difficulty)) return;
      lastRevision = state.revision + ':' + getGame().difficulty;
      const samePage = overlay.querySelector('.character-panel').dataset.page === tab;
      const scroll = { content: content.scrollTop, bag: content.querySelector('.char-bag-grid')?.scrollTop || 0, tree: content.querySelector('.skt-tree')?.scrollTop || 0 };
      const focused = rememberFocus(); hideTooltip(); if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0;
      const min = B.Progression.thresholds[state.level - 1], max = state.nextLevelXp();
      progress.innerHTML = '<div><strong>Seviye ' + state.level + '</strong><span>' + (max ? 'Tecrübe ' + (state.xp - min) + ' / ' + (max - min) : 'En yüksek seviye') + '</span><b class="char-points' + (state.points ? ' on' : '') + '">' + state.points + ' yetenek puanı</b></div>';
      overlay.querySelectorAll('[data-char="tab"]').forEach(el => { const active = el.dataset.tab === tab; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
      overlay.querySelector('.character-panel').dataset.page = tab;
      overlay.querySelector('#character-title').textContent = tab === 'skills' ? 'Yetenek ağacı' : 'Karakter ve çanta';
      overlay.querySelector('[data-tab="skills"]').dataset.points = state.points;
      stopPreview(); content.innerHTML = tab === 'skills' ? talents(state) : inventory(state);
      if (samePage) {
        content.scrollTop = scroll.content;
        const bag = content.querySelector('.char-bag-grid'), tree = content.querySelector('.skt-tree');
        if (bag && renderedFilter === bagFilter) bag.scrollTop = scroll.bag;
        if (tree) tree.scrollTop = scroll.tree;
      } else content.scrollTop = 0;
      renderedFilter = bagFilter;
      restoreFocus(focused); if (tab === 'inventory') startPreview();
    }
    function inspect(button, event) {
      const state = getState(); if (!state) return;
      selected = button.dataset.uid || null; selectedSlot = selected ? null : button.dataset.slot || null;
      const entry = state.inventory.find(i => i.uid === selected), def = B.Progression.resolveItem(entry), detail = content.querySelector('.char-detail');
      content.querySelectorAll('[data-char="select"]').forEach(el => {
        const active = selected ? el.dataset.uid === selected : el.classList.contains('char-equipment') && el.dataset.slot === selectedSlot;
        el.classList.toggle('selected', active); el.setAttribute('aria-pressed', String(active));
      });
      if (detail) { detail.className = 'char-detail' + (def ? ' rarity-' + def.rarity : ''); detail.innerHTML = itemDetail(state, entry, false); }
      // Keep the clicked tile and live canvas in place. Replacing them on the first
      // click prevents browsers from delivering a genuine second click to that item.
      if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0;
      // Leave the tile under the pointer through a normal mouse double-click.
      if (window.innerWidth <= 1050 && event.detail > 0) inspectScroll = setTimeout(() => {
        inspectScroll = 0; if (opened && tab === 'inventory') detail?.scrollIntoView({ block: 'nearest' });
      }, lastPointerType === 'touch' || lastPointerType === 'pen' ? 420 : 600);
    }
    function change(result, message, separateFeedback = false) {
      if (!result) return;
      status.textContent = result.ok ? message || 'Değişiklik uygulandı.' : result.reason;
      if (result.ok && typeof options.onChange === 'function') options.onChange(getState());
      refresh(true);
      if (!separateFeedback) showToast(result.ok ? 'equip' : 'deny', status.textContent, '', result.ok ? FXC.calm : '#e0705c');
    }
    // ---- Equip / unequip feedback: flight from cell to slot, flash ring, persistent frame, toast, portrait glow. ----
    const FXC = { common: '#c4c2b8', uncommon: '#6fd25a', rare: '#4da3ff', epic: '#b57bff', boss: '#ffa43a', calm: '#8fa6c0' };
    const toast = document.createElement('div'); toast.className = 'char-toast hidden'; toast.setAttribute('aria-hidden', 'true'); overlay.querySelector('.character-panel').appendChild(toast);
    let toastTimer = 0;
    function showToast(kind, label, name, color) {
      clearTimeout(toastTimer); toast.className = 'char-toast ' + kind; toast.style.setProperty('--fxc', color);
      toast.innerHTML = '<i aria-hidden="true">' + (kind === 'equip' ? '✦' : kind === 'deny' ? '!' : '↩') + '</i><span>' + label + (name ? ': <b>' + escape(name) + '</b>' : '') + '</span>';
      void toast.offsetWidth; toast.classList.add('show');
      toastTimer = setTimeout(() => toast.classList.add('hidden'), 2300);
    }
    function pulse(el, cls, color) {
      if (!el) return; el.style.setProperty('--fxc', color); el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 1100);
    }
    function fly(html, from, to, color, calm, done) {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!from || !to || reduced || typeof Element.prototype.animate !== 'function') { done(); return; }
      const size = 62, el = document.createElement('div'); el.className = 'char-fly' + (calm ? ' calm' : '');
      el.style.cssText = 'left:' + (from.left + from.width / 2 - size / 2) + 'px;top:' + (from.top + from.height / 2 - size / 2) + 'px;--fxc:' + color;
      el.innerHTML = html; overlay.appendChild(el);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
      let over = false; const end = () => { if (over) return; over = true; el.remove(); done(); };
      const motion = el.animate([{ transform: 'translate(0,0) scale(1.2)', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.92)', opacity: calm ? .3 : 1 }], { duration: calm ? 300 : 320, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
      motion.onfinish = end; motion.oncancel = end; setTimeout(end, 480);
    }
    const artRect = el => { const art = el && (el.querySelector('.char-item-art') || el); return art ? art.getBoundingClientRect() : null; };
    const bagCell = uid => [...content.querySelectorAll('.char-item')].find(el => el.dataset.uid === uid) || null;
    function feedback(kind, def, uid, from) {
      const slotEl = [...content.querySelectorAll('.char-equipment')].find(el => el.dataset.slot === def.slot), cell = bagCell(uid), portrait = content.querySelector('.char-preview');
      const color = kind === 'equip' ? FXC[def.rarity] || FXC.common : FXC.calm;
      showToast(kind, kind === 'equip' ? 'Kuşanıldı' : 'Çıkarıldı', def.name, color);
      if (kind === 'equip') {
        try { if (B.Audio && B.Audio.play) B.Audio.play('parry', { volume: .17 }); } catch (e) { /* sound is optional */ }
        if (slotEl) slotEl.classList.add('fx-await');
        fly(menuGearIcon(def), from, artRect(slotEl), color, false, () => {
          if (slotEl) slotEl.classList.remove('fx-await');
          pulse(slotEl, 'fx-equip', color); pulse(portrait, 'fx-equip', color); pulse(cell, 'fx-bag', color);
        });
      } else {
        fly(menuGearIcon(def), from, cell ? artRect(cell) : null, color, true, () => { pulse(slotEl, 'fx-unequip', color); pulse(portrait, 'fx-unequip', color); pulse(cell, 'fx-bag', color); });
        if (!cell) { pulse(slotEl, 'fx-unequip', color); pulse(portrait, 'fx-unequip', color); }
      }
    }
    function doEquip(uid, source) {
      const state = getState(); if (!state) return;
      const entry = state.inventory.find(i => i.uid === uid), def = B.Progression.resolveItem(entry); if (!def) return;
      const from = artRect(source || bagCell(uid)), result = state.equip(uid);
      change(result, 'Kuşanıldı: ' + def.name, true);
      if (result.ok) feedback('equip', def, uid, from); else showToast('deny', result.reason, '', '#e0705c');
    }
    function doUnequip(slot, source) {
      const state = getState(); if (!state || typeof state.unequip !== 'function') return;
      const entry = state.inventory.find(i => i.uid === state.equipment[slot]), def = B.Progression.resolveItem(entry);
      if (!def) { status.textContent = 'Bu yuva zaten boş.'; return; }
      const from = artRect([...content.querySelectorAll('.char-equipment')].find(el => el.dataset.slot === slot) || source), result = state.unequip(slot);
      change(result, 'Çıkarıldı: ' + def.name, true);
      if (result.ok) feedback('unequip', def, entry.uid, from); else showToast('deny', result.reason, '', '#e0705c');
    }
    function toggleEquipment(button) {
      const state = getState(); if (!state) return;
      if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0; hideTooltip();
      if (button.classList.contains('char-equipment')) {
        if (!state.equipment[button.dataset.slot]) { status.textContent = 'Bu yuva zaten boş.'; return; }
        doUnequip(button.dataset.slot, button);
      } else {
        const entry = state.inventory.find(i => i.uid === button.dataset.uid), def = B.Progression.resolveItem(entry);
        if (!def) return;
        if (state.equipment[def.slot] === entry.uid) { doUnequip(def.slot, button); return; }
        doEquip(entry.uid, button);
      }
    }
    // Keep the clicked skill node mounted: replacing the tree on the first click
    // prevents the browser from delivering a double-click on that same node.
    function inspectSkill(button) {
      selectedSkill = button.dataset.skill;
      const state = getState(); if (!state) return;
      const holder = document.createElement('div'); holder.innerHTML = talents(state);
      const current = content.querySelector('.skt-inspect'), next = holder.querySelector('.skt-inspect');
      if (current && next) current.replaceWith(next);
      // Empty slots inspect the current selection, not the skill cached at the last full render.
      content.querySelectorAll('.skt-slot.empty [data-char="skill"]').forEach(node => { node.dataset.skill = selectedSkill; });
      content.querySelectorAll('[data-char="skill"]').forEach(node => {
        // Loadout controls inspect skills; only the actual tree nodes represent a selected toggle.
        if (!node.classList.contains('skt-node')) { node.classList.remove('selected'); node.removeAttribute('aria-pressed'); return; }
        const selected = node.dataset.skill === selectedSkill;
        node.classList.toggle('selected', selected); node.setAttribute('aria-pressed', String(selected));
      });
    }
    function learnSkill(id) {
      const state = getState(); if (!state || state.learned.includes(id)) return;
      selectedSkill = id;
      const skill = B.Progression.skills.find(s => s.id === id);
      change(state.unlock(id), skill ? 'Öğrenildi: ' + skill.name : undefined);
    }
    overlay.addEventListener('pointerdown', event => { lastPointerType = event.pointerType || 'mouse'; hideTooltip(); });
    overlay.addEventListener('click', event => {
      const button = event.target.closest('[data-char]'); if (!button || !overlay.contains(button)) return;
      event.stopPropagation(); const state = getState();
      switch (button.dataset.char) {
        case 'turn': if (typeof options.onPreviewTurn === 'function') options.onPreviewTurn(Number(button.dataset.direction)); break;
        case 'close': close(); break;
        case 'tab': tap = null; tab = button.dataset.tab; status.textContent = ''; refresh(true); content.scrollTop = 0; break;
        case 'bag-page': tap = null; bagPage = Math.max(0, bagPage + Number(button.dataset.direction)); refresh(true); break;
        case 'filter': tap = null; bagPage = 0; bagFilter = button.dataset.filter; selectedSlot = null; refresh(true); break;
        case 'select': {
          inspect(button, event);
          const key = (button.classList.contains('char-equipment') ? 'slot:' + button.dataset.slot : 'item:' + button.dataset.uid), now = performance.now();
          if ((lastPointerType === 'touch' || lastPointerType === 'pen') && event.detail > 0) {
            if (tap && tap.key === key && now - tap.time < 380 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 20) {
              tap = null; touchActionAt = now; toggleEquipment(button);
            } else tap = { key, time: now, x: event.clientX, y: event.clientY };
          } else tap = null;
          break;
        }
        case 'equip': if (state) doEquip(button.dataset.uid, null); break;
        case 'unequip': if (state) doUnequip(button.dataset.slot, null); break;
        case 'skill': {
          inspectSkill(button);
          const isNode = button.classList.contains('skt-node'), now = performance.now();
          if (isNode && (lastPointerType === 'touch' || lastPointerType === 'pen') && event.detail > 0) {
            const key = 'skill:' + button.dataset.skill;
            if (tap && tap.key === key && now - tap.time < 380 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 20) {
              tap = null; touchActionAt = now; learnSkill(button.dataset.skill);
            } else tap = { key, time: now, x: event.clientX, y: event.clientY };
          } else tap = null;
          if (!isNode && window.innerWidth <= 900) content.querySelector('.skt-inspect').scrollIntoView({ block: 'nearest' });
          break;
        }
        case 'assign': if (state) change(state.assign(Number(button.dataset.slot), button.dataset.skill || null)); break;
        case 'unlock': if (state) learnSkill(button.dataset.skill); break;
      }
    });
    overlay.addEventListener('dblclick', event => {
      const button = event.target.closest('[data-char="select"],.skt-node[data-char="skill"]'); if (!button || !overlay.contains(button)) return;
      event.preventDefault(); event.stopPropagation();
      if (performance.now() - touchActionAt <= 500) return;
      if (button.dataset.char === 'skill') learnSkill(button.dataset.skill); else toggleEquipment(button);
    });
    overlay.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const button = event.target.closest('[data-char="select"]'); if (!button || !button.dataset.uid || hoverButton === button) return;
      const state = getState(), entry = state?.inventory.find(i => i.uid === button.dataset.uid), def = B.Progression.resolveItem(entry);
      if (!def) return;
      hideTooltip(); hoverButton = button; tooltip.className = 'char-hover-tooltip rarity-' + def.rarity; tooltip.innerHTML = itemDetail(state, entry, true); button.setAttribute('aria-describedby', tooltip.id);
      const rect = button.getBoundingClientRect(), width = tooltip.offsetWidth, height = tooltip.offsetHeight;
      let left = rect.right + 12; if (left + width > innerWidth - 14) left = rect.left - width - 12;
      tooltip.style.left = Math.max(14, Math.min(innerWidth - width - 14, left)) + 'px'; tooltip.style.top = Math.max(14, Math.min(innerHeight - height - 14, rect.top - 6)) + 'px';
    });
    overlay.addEventListener('pointerout', event => { if (hoverButton && !hoverButton.contains(event.relatedTarget)) hideTooltip(); });
    overlay.addEventListener('scroll', hideTooltip, true);
    overlay.addEventListener('change', event => { if (event.target.dataset.char === 'assign') change(getState().assign(Number(event.target.dataset.slot), event.target.value || null)); });
    function onKey(event) {
      if (!opened || overlay.inert) return;
      if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.code !== 'Tab') return;
      const controls = Array.from(overlay.querySelectorAll('button:not(:disabled),select:not(:disabled)')).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (!controls.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true }); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    function open(nextTab) {
      if (!getState()) return false;
      if (!opened) { priorFocus = document.activeElement; bagPage = 0; }
      opened = true; tab = nextTab === 'skills' || nextTab === 'talents' ? 'skills' : 'inventory';
      overlay.classList.remove('hidden'); status.textContent = ''; tap = null; refresh(true); content.scrollTop = 0; overlay.querySelector('[data-char="close"]').focus(); return true;
    }
    function close(silent) {
      if (!opened) return;
      stopPreview(); hideTooltip(); if (inspectScroll) clearTimeout(inspectScroll); inspectScroll = 0; tap = null;
      opened = false; overlay.classList.add('hidden');
      if (priorFocus && priorFocus.isConnected && priorFocus.focus && priorFocus.getClientRects().length) priorFocus.focus({ preventScroll: true });
      priorFocus = null;
      if (!silent && typeof options.onClose === 'function') options.onClose();
    }
    // Paints both pages once, almost transparent and above the loading cover, so the first I / T press does not
    // draw the panel, the item icons, the skill tree and the portrait's 2D canvas for the first time during play.
    async function warm() {
      if (opened || !getState()) return;
      // Decode menu textures under the existing loading cover, never during combat.
      const art = ['hybrid-b-chamber.png', 'sepulchral-backdrop.png', 'menu-character.png', 'menu-talents.png', 'menu-journal.png', 'menu-settings.png', 'frame-tl.png', 'frame-tr.png', 'frame-bl.png', 'frame-br.png', 'effigy-left.png', 'effigy-right.png', 'funeral-cloth.png', 'funeral-cloth-dark.png', 'banner-demon-left.png', 'banner-demon-right.png'];
      for (let i = 0; i < 16; i++) art.push('gear/' + i + '.png');
      await Promise.all(art.map(name => { const image = new Image(); image.src = 'assets/ui/' + name; return image.decode().catch(() => {}); }));
      const frame = () => new Promise(res => { let done = false; const go = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(go); setTimeout(go, 120); });
      const style = overlay.getAttribute('style');
      overlay.inert = true; overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = 'opacity:.012;z-index:2147483000;pointer-events:none';
      opened = true;
      try {
        for (const page of ['inventory', 'skills', 'inventory']) {
          tab = page; overlay.classList.remove('hidden'); refresh(true);
          const canvas = content.querySelector('#character-preview');
          if (canvas) { stopPreview(); if (typeof options.onPreview === 'function') options.onPreview(canvas, performance.now(), true); }
          for (let i = 0; i < 4; i++) await frame();
        }
      } finally {
        stopPreview(); hideTooltip(); opened = false; tab = 'inventory'; lastRevision = -1; selected = null;
        overlay.classList.add('hidden'); overlay.inert = false; overlay.removeAttribute('aria-hidden');
        if (style == null) overlay.removeAttribute('style'); else overlay.setAttribute('style', style);
      }
    }
    return { open, close, refresh, warm, get isOpen() { return opened; }, get activeTab() { return tab; }, element: overlay,
      dispose: () => { close(true); stopPreview(); document.removeEventListener('keydown', onKey, true); overlay.remove(); } };
  }
  B.CharacterUI = Object.freeze({ create, gearIcon });
}());
