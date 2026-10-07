/* KABİR AZABI — talent tree 3 ("build" tree), slimmed down to 25 nodes. Data + rules only (no DOM, no THREE).
   Six columns (one per active skill line), five rows:
     row 1  actives (Mezar Yaran, Kan Nidası, Zincir Kasırgası, Kül Hücumu, Kor Mührü, Ölüm Çanı)
     row 2  ONE seal (modifier) under every active
     row 3  one archetype passive per column
     row 4  final forms (old tier III, they replace the active in its slot) / the column passives of Kor and Çürüme
     row 5  keystones: ONE per run, each a strong identity with a price
   Every node costs one point; points = level - 1 (12 at level 13) + up to 5 quest points: 25 nodes, a full run takes ~65 % of them.
   Gates: a node needs `level` and `gate` points already spent in the tree. Exclusive groups: one node per `group`.
   Removed nodes (old tier II forms, extra seals, body filler, 4 keystones) are simply unknown ids: validate() drops them, so the points come back.
   Forms keep their ids (temper, chainstorm, rend, havoc), so slots, art, motion and skill-fx keep working.
   Effects are DATA here; src/talent-runtime.js applies them in the fight, effective() turns them into skill params. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const t = s => KabirI18n.t(s);
  const COLS = Object.freeze([
    { line: 'cleave', name: t('AĞIR DARBE'), hint: t('Sersemletme ve ezme'), color: '#d9884b' },
    { line: 'roar', name: t('KAN BEDELİ'), hint: t('Can çalma ve öfke'), color: '#c8473f' },
    { line: 'whirl', name: t('ZİNCİR'), hint: t('Çekiş ve alan'), color: '#7f9fbd' },
    { line: 'charge', name: t('HÜCUM'), hint: t('Hız ve atılış'), color: '#c9a45a' },
    { line: 'pyre', name: t('KOR'), hint: t('Yanma ve ateş'), color: '#e0662f' },
    { line: 'knell', name: t('ÇÜRÜME'), hint: t('Lanet ve ölüm'), color: '#8fae6a' }
  ]);
  const ROWS = Object.freeze([
    { row: 1, name: t('I · UYANIŞ'), hint: t('Aktif yetenekler'), gate: 0 },
    { row: 2, name: t('II · MÜHÜR'), hint: t('Her yeteneğe tek mühür'), gate: 1 },
    { row: 3, name: t('III · BEDEN'), hint: t('3 puan harca'), gate: 3 },
    { row: 4, name: t('IV · DÖNÜŞÜM'), hint: t('5 puan harca'), gate: 5 },
    { row: 5, name: t('V · KİLİT TAŞI'), hint: t('8 puan · yalnız biri'), gate: 8 }
  ]);
  // kind: active | form | mod | passive | key.  glyph: small engraved symbol for mods/passives/keys (talent-ui.js draws it).
  const N = [];
  const node = o => { N.push(Object.freeze(Object.assign({ requires: null, group: null, gate: 0, level: 1, fx: {} }, o))); };
  // ---- row 2: one seal per active -------------------------------------------------------------------------------
  const mod = (id, col, name, desc, glyph, fx, level) => node({ id, kind: 'mod', col, slot: 1, row: 2, line: COLS[col].line, requires: COLS[col].line, group: 'seal-' + COLS[col].line, gate: 1, level: level || 3, name: t(name), desc: t(desc), glyph, fx });
  // ---- rows 3 / 4: passives ----------------------------------------------------------------------------------------
  const passive = (id, col, row, name, desc, glyph, fx, extra) => node(Object.assign({ id, kind: 'passive', col, row, line: COLS[col].line, gate: row === 3 ? 3 : 5, level: row === 3 ? 4 : 6, name: t(name), desc: t(desc), glyph, fx }, extra || {}));
  const key = (id, col, name, desc, price, glyph, fx) => node({ id, kind: 'key', col, row: 5, line: COLS[col].line, group: 'keystone', gate: 8, level: 9, name: t(name), desc: t(desc), price: t(price), glyph, fx });

  mod('cleave-sunder', 0, 'Kemik Yarma', 'Darbe daha ağır iner: +%30 hasar ve +0,5 sn sersemletme. Biraz daha çok dayanıklılık ister.', 'hammer', { dmg: 1.3, stun: .5, cost: 6 });
  mod('roar-blood', 1, 'Kan Bedeli', 'Nida dayanıklılık yerine canının %10’unu yer. Karşılığında öfkedeyken can çalman iki buçuk katına çıkar.', 'drop', { bloodCost: .10, steal: 2.5 });
  mod('whirl-hook', 2, 'Kanca Zincir', 'Zincirlere kanca takılır: çekiş güçlenir, çember %10 genişler.', 'hook', { pull: 1.8, radius: 1.1 });
  mod('charge-echo', 3, 'Gölge Adım', 'Hücum %40 daha ucuz ve %40 daha sık; çarpma %15 daha hafif.', 'wing', { cost: .6, cd: .6, dmg: .85 }, 6);
  mod('pyre-burst', 4, 'Patlayan Mühür', 'Mühür sönerken patlar: içindekilere ağır hasar verir ve sersemletir.', 'burst', { burst: 90 }, 5);
  mod('knell-chain', 5, 'Salgın', 'Lanetli bir düşman ölüp patladığında, patlamanın değdiği düşmanlar da lanetlenir.', 'spread', { spread: true }, 5);
  // ---- row 3: one archetype-defining passive per column -------------------------------------------------------------
  passive('p-aftershock', 0, 3, 'Artçı Sarsıntı', 'Sersemlemiş bir düşman ölünce yer sarsılır: çevresindekilere hasar verir ve onları sersemletir.', 'burst', { aftershock: 24 });
  passive('p-frenzy', 1, 3, 'Kan Çılgınlığı', 'Canın %40’ın altındayken %25 fazla hasar verir, %15 daha hızlı dayanıklılık toplarsın.', 'heart', { frenzy: true });
  passive('p-lash', 2, 3, 'Zincir Kırbacı', 'Kasırga bitince ya da hücum vardığında zincir savrulur: 7 metredeki en yakın üç düşmana çarpar.', 'chain', { lash: 32 });
  passive('p-momentum', 3, 3, 'Hız Kazanımı', 'Kaçındıktan ya da hücum ettikten sonra 3 saniye vuruşların %20 daha ağır iner.', 'wing', { momentum: true });
  passive('p-kindle', 4, 3, 'Alev Saçağı', 'Yanan düşmanların alevi yanındakine sıçrar: her yanma vuruşunda yakındaki bir düşman tutuşabilir.', 'spread', { kindle: true });
  passive('p-plague', 5, 3, 'Kara Veba', 'Lanetli düşmanların kanaması ve yanması %50 daha çok acıtır.', 'skull', { plague: true });
  // ---- row 4: column passives of the two newer actives (the four older lines hold their final form there) -----------
  passive('p-ember', 4, 4, 'Kor Kalp', 'Yanma %50 daha çok hasar verir ve 2 saniye daha uzun sürer.', 'flame', { burnMul: 1.5, burnTime: 2 }, { requires: 'pyre' });
  passive('p-rot', 5, 4, 'Çürük Kan', 'Kanama %50 daha çok hasar verir; kanayan düşmanlar %8 fazla hasar alır.', 'drop', { bleedMul: 1.5, bleedingTaken: 1.08 }, { requires: 'knell' });
  // ---- row 5 keystones: exactly one per run ---------------------------------------------------------------------
  key('k-exec', 0, 'Cellat', 'Canı %40’ın altına düşen düşmanlara %25 fazla hasar verirsin. Canı %10’un altına inen sıradan düşmanlar tek vuruşta ölür.', 'Bedeli: en yüksek canın %20 azalır.', 'axe', { exec: true, hpMul: .8 });
  key('k-blood', 1, 'Kan Yemini', 'Verdiğin bütün hasarın %7’si can olarak sana döner.', 'Bedeli: şifa matarası taşıyamazsın.', 'drop', { leech: .07, noFlask: true });
  // KÜL panel (Zincir + Kor): chains and embers feed each other. Numbers: combat-tuning.js TALENT.CHAINFIRE.
  key('k-chainfire', 4, 'Kor Zinciri', 'Zincirlerin korla dövülür: Zincir Kasırgası, Son Hüküm ve Zincir Kırbacı’nın değdiği her düşman tutuşur. Yanan düşmanlara %25 fazla hasar verirsin.', 'Bedeli: aldığın bütün hasar %20 artar.', 'chain', { chainfire: true });

  // ---- actives / forms come from progression.js (same ids, same params); placed in the grid here ----------------
  const PLACE = { cleave: [0, 1], temper: [0, 4], roar: [1, 1], chainstorm: [1, 4], whirl: [2, 1], rend: [2, 4], charge: [3, 1], havoc: [3, 4], pyre: [4, 1], knell: [5, 1] };
  const FORM_OF = { temper: 'cleave', chainstorm: 'roar', rend: 'whirl', havoc: 'charge' };   // a final form replaces its active directly
  let index = null, list = null;
  function build() {
    if (index) return;
    const P = B.Progression; list = [];
    for (const s of P.skills) {
      const at = PLACE[s.id]; if (!at) continue;
      list.push(Object.freeze({ id: s.id, kind: s.tier > 1 ? 'form' : 'active', col: at[0], row: at[1], line: s.line, requires: FORM_OF[s.id] || s.requires, group: null,
        gate: at[1] === 4 ? 5 : 0, level: s.level, name: s.name, desc: s.description, skill: s, fx: {} }));
    }
    for (const n of N) list.push(n);
    list.sort((a, b) => a.row - b.row || a.col - b.col || (a.slot || 0) - (b.slot || 0));
    index = Object.create(null); for (const n of list) index[n.id] = n;
  }
  const get = id => { build(); return index[id] || null; };
  const nodes = () => { build(); return list; };
  const spentOf = learned => learned.length;
  function blockerOf(learned, n) {
    if (!n.group) return null;
    const other = learned.find(id => id !== n.id && index[id] && index[id].group === n.group);
    return other ? index[other] : null;
  }
  // { known, blocked, canLearn, reason, low, gateNeed, missingParent, exclusive }
  function access(state, id) {
    build(); const n = index[id], learned = state.learned || [];
    if (!n) return { known: false, blocked: true, canLearn: false, reason: t('Böyle bir yetenek yok.') };
    const known = learned.includes(id), low = state.level < n.level, spent = spentOf(learned);
    const missingParent = n.requires && !learned.includes(n.requires) ? index[n.requires] : null;
    const gateNeed = !known && spent < n.gate ? n.gate - spent : 0;
    const exclusive = !known ? blockerOf(learned, n) : null;
    const blocked = !known && (low || !!missingParent || gateNeed > 0 || !!exclusive);
    const en = KabirI18n.lang === 'en';
    const reason = known ? t('Öğrenildi') : low ? (en ? 'Requires level ' + n.level + '.' : n.level + '. seviye gerekli.')
      : exclusive ? (en ? 'Excludes ' + exclusive.name + '.' : exclusive.name + ' ile birlikte alınamaz.')
      : missingParent ? (en ? 'Learn ' + missingParent.name + ' first.' : 'Önce ' + missingParent.name + ' öğrenilmeli.')
      : gateNeed ? (en ? 'Spend ' + gateNeed + ' more point' + (gateNeed > 1 ? 's' : '') + ' in the tree.' : 'Ağaca ' + gateNeed + ' puan daha harca.')
      : state.points < 1 ? t('Yetenek puanın yok.') : t('1 puanla öğren');
    return { known, blocked, canLearn: !known && !blocked && state.points > 0, reason, low, gateNeed, missingParent, exclusive, missingTier: 0 };
  }
  // Rebuilds a legal learned list from any (possibly hand-edited / older) list for this level. Order of the result = learning order.
  // extra: skill points earned outside levels (quest boons, progression.js boons.points).
  function validate(ids, level, extra) {
    build();
    const want = (Array.isArray(ids) ? ids : []).filter((id, n, all) => typeof id === 'string' && index[id] && all.indexOf(id) === n);
    const budget = Math.max(0, Math.min(B.Progression ? B.Progression.MAX_LEVEL - 1 : 12, level - 1)) + Math.max(0, extra | 0), out = [];
    let grew = true;
    while (grew && out.length < budget) {
      grew = false;
      for (const id of want) {
        if (out.includes(id) || out.length >= budget) continue;
        const a = access({ learned: out, level, points: budget - out.length }, id);
        if (a.canLearn) { out.push(id); grew = true; }
      }
    }
    return out;
  }
  // A single node may be refunded when the rest of the tree stays legal without it.
  function canRefund(learned, id, level, extra) {
    if (!learned.includes(id)) return false;
    const rest = learned.filter(x => x !== id);
    return validate(rest, level, extra).length === rest.length;
  }
  // Flat effect bag of everything learned (passives, keystones, seals). Cached per learned list.
  const fxCache = new Map();
  function effects(learned) {
    build(); const k = learned.join(','); let e = fxCache.get(k);
    if (e) return e;
    e = { has: new Set(learned), seal: Object.create(null), keystone: null };
    for (const id of learned) {
      const n = index[id]; if (!n) continue;
      if (n.kind === 'mod') e.seal[n.line] = n;
      if (n.kind === 'key') e.keystone = n;
    }
    const f = id => (index[id] && e.has.has(id) ? index[id].fx : null);
    const hp = f('p-iron'), exec = f('k-exec'), crit = f('p-crit'), wind = f('p-wind'), flask = f('p-flask'), rotW = f('k-rot');
    const ember = f('p-ember'), pyreK = f('k-pyre'), rot = f('p-rot');
    e.hpAdd = hp ? hp.hp : 0; e.hpMul = exec ? exec.hpMul : 1; e.crit = crit ? crit.crit : 0;
    e.regen = (wind ? wind.regen : 1); e.hunger = e.has.has('k-hunger');
    e.flasks = e.has.has('k-blood') ? -99 : flask ? flask.flasks : 0; e.flaskHeal = (flask ? flask.flaskHeal : 1) * (rotW ? rotW.flaskHeal : 1);
    e.cd = e.has.has('p-haste') ? .85 : 1;
    e.burnMul = (ember ? ember.burnMul : 1) * (pyreK ? pyreK.burnMul : 1); e.burnTime = ember ? ember.burnTime : 0;
    e.bleedMul = rot ? rot.bleedMul : 1; e.bleedingTaken = rot ? rot.bleedingTaken : 1;
    e.vsStunned = e.has.has('p-crush') ? 1.2 : 1; e.exec = !!exec; e.leech = e.has.has('k-blood') ? .07 : 0;
    const CF = e.has.has('k-chainfire') ? Object.assign({ burnFrac: .35, burnTime: 3, lashBurn: 16, vsBurning: 1.25, taken: 1.2 }, B.CombatTuning && B.CombatTuning.TALENT && B.CombatTuning.TALENT.CHAINFIRE) : null;
    e.chainDodge = e.has.has('k-chains'); e.allBurn = !!pyreK; e.taken = (pyreK ? pyreK.taken : 1) * (CF ? CF.taken : 1); e.rotWorld = !!rotW; e.chainfire = CF;
    e.ashfall = e.has.has('p-ashfall'); e.harvest = e.has.has('p-harvest');
    e.aftershock = e.has.has('p-aftershock'); e.frenzy = e.has.has('p-frenzy'); e.lash = e.has.has('p-lash'); e.momentum = e.has.has('p-momentum'); e.kindle = e.has.has('p-kindle'); e.plague = e.has.has('p-plague');
    if (fxCache.size > 64) fxCache.clear(); fxCache.set(k, Object.freeze(e)); return e;
  }
  // The skill as it fights with this tree: seal of its line + global passives folded into cost / cooldown / params.
  const effCache = new Map();
  function effective(skill, learned) {
    if (!skill) return skill;
    const k = skill.id + '|' + learned.join(','); let s = effCache.get(k);
    if (s) return s;
    const e = effects(learned), seal = e.seal[skill.line], p = Object.assign({}, skill.params), F = seal ? seal.fx : {};
    let cost = skill.cost, cooldown = skill.cooldown;
    if (seal) {
      if (F.dmg) for (const f of ['damage', 'pathDamage', 'damage2', 'waveDamage']) if (p[f]) p[f] = Math.round(p[f] * F.dmg);
      if (F.stun && skill.line !== 'knell') { if (p.stun != null) p.stun += F.stun; if (p.stunLast != null) p.stunLast += F.stun; }
      if (F.cost && F.cost > 1) cost += F.cost; else if (F.cost) cost = Math.round(cost * F.cost);
      if (F.cd) cooldown = cooldown * F.cd;
      if (F.fear) p.fear = +(p.fear * F.fear).toFixed(2);
      if (F.pull) p.pull = +(p.pull * F.pull + .8).toFixed(2);
      if (F.pullAdd) p.pull = (p.pull || 0) + F.pullAdd;
      if (F.radius && skill.line !== 'pyre' && skill.line !== 'knell') p.radius = +(p.radius * F.radius).toFixed(2);
      if (F.bloodCost) cost = 0;
      if (F.steal) p.steal = +(p.steal * F.steal).toFixed(3);
      if (skill.line === 'pyre') { if (F.radius) p.radius = +(p.radius * F.radius).toFixed(2); if (F.time) p.time += F.time; if (F.burst) p.burst = F.burst; }
      if (skill.line === 'knell') { if (F.radius) p.radius = +(p.radius * F.radius).toFixed(2); if (F.stun) p.stun = F.stun; if (F.damage) p.damage = F.damage; }
    }
    cooldown = +(cooldown * e.cd).toFixed(2);
    s = Object.freeze(Object.assign({}, skill, { cost, cooldown, params: Object.freeze(p), seal: seal ? seal.id : null }));
    if (effCache.size > 128) effCache.clear(); effCache.set(k, s); return s;
  }
  // Recommended builds (shown in the tree; "apply" relearns them in this order as far as level and points allow).
  const PRESETS = Object.freeze([
    { id: 'pyre-priest', name: t('Kor Rahibi'), hint: t('Yere mühür kaz, her şeyi yak. Alev Saçağı ile ateş düşmandan düşmana geçer.'), nodes: ['pyre', 'cleave', 'pyre-burst', 'whirl', 'p-kindle', 'p-ember', 'whirl-hook', 'temper', 'k-exec'] },
    { id: 'chain-reaper', name: t('Zincirli Cellat'), hint: t('Düşmanları çekip yığ, sersemlet, Cellat ile bitir.'), nodes: ['cleave', 'whirl', 'whirl-hook', 'cleave-sunder', 'p-lash', 'p-aftershock', 'charge', 'rend', 'temper', 'k-exec'] },
    { id: 'plague-bearer', name: t('Veba Taşıyıcı'), hint: t('Çanla lanetle, kanat; ölenler patlayıp yenilerini lanetler.'), nodes: ['knell', 'cleave', 'knell-chain', 'whirl', 'p-plague', 'p-lash', 'p-rot', 'rend', 'roar', 'k-blood'] },
    { id: 'blood-penitent', name: t('Kan Kefareti'), hint: t('Can ile öde, can ile al: matara yok, her vuruş seni iyileştirir.'), nodes: ['roar', 'cleave', 'roar-blood', 'charge', 'p-frenzy', 'p-momentum', 'chainstorm', 'temper', 'k-blood'] },
    { id: 'storm-rider', name: t('Kara Fırtına'), hint: t('Hiç durma: hücum, kaçın, zincirle çek, yeniden hücum.'), nodes: ['charge', 'whirl', 'charge-echo', 'whirl-hook', 'p-momentum', 'p-lash', 'havoc', 'rend', 'roar', 'k-exec'] }
  ]);
  // Identity title of the two strongest columns (order-free).
  const ARCHETYPE = { 'cleave+pyre': t('Kor Celladı'), 'cleave+whirl': t('Zincirli Cellat'), 'cleave+roar': t('Kanlı Balyoz'), 'charge+cleave': t('Koç Başı'), 'cleave+knell': t('Mezar Kazıcı'),
    'pyre+roar': t('Kor Nidası'), 'pyre+whirl': t('Kül Fırtınası'), 'charge+pyre': t('Kor Rahibi'), 'knell+pyre': t('Kül ve Kemik'), 'roar+whirl': t('Kan Girdabı'), 'charge+roar': t('Kan Hücumu'),
    'knell+roar': t('Kan Kefareti'), 'charge+whirl': t('Kara Fırtına'), 'knell+whirl': t('Paslı Veba'), 'charge+knell': t('Ölüm Habercisi') };
  const archetype = (a, b) => ARCHETYPE[[a, b].sort().join('+')] || '';
  B.TalentTree = Object.freeze({ presets: PRESETS, archetype, cols: COLS, rows: ROWS, nodes, get, access, validate, canRefund, effects, effective, get MAX_POINTS() { return B.Progression ? B.Progression.MAX_LEVEL - 1 : 12; } });
}());
