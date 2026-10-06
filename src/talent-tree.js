/* KABİR AZABI — talent tree 3 ("build" tree). Data + rules only (no DOM, no THREE).
   Six columns (one per active skill line), five rows:
     row 1  actives (Mezar Yaran, Kan Nidası, Zincir Kasırgası, Kül Hücumu, Kor Mührü, Ölüm Çanı)
     row 2  three MUTUALLY EXCLUSIVE "seals" (modifiers) under every active: one per active
     row 3  body passives (one per column, no parent)
     row 4  second forms (old tier II) / column passives      row 5  final forms (old tier III) / column passives
     row 6  keystones: ONE per run, each a strong identity with a price
   Every node costs one point; points = level - 1 (12 at level 13), the tree has 48 nodes: a run can never take everything.
   Gates: a node needs `level` and `gate` points already spent in the tree. Exclusive groups: one node per `group`.
   Forms keep their old ids/requires (cleave > brand > temper ...), so slots, art, motion and skill-fx keep working.
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
    { row: 1, name: t('I · UYANIŞ'), hint: t('Aktif yetenekler') },
    { row: 2, name: t('II · MÜHÜR'), hint: t('Her yeteneğe tek mühür') },
    { row: 3, name: t('III · BEDEN'), hint: t('3 puan harca') },
    { row: 4, name: t('IV · DÖNÜŞÜM'), hint: t('4 puan harca') },
    { row: 5, name: t('V · KIYAMET'), hint: t('7 puan harca') },
    { row: 6, name: t('VI · KİLİT TAŞI'), hint: t('6 puan · yalnız biri') }
  ]);
  // kind: active | form | mod | passive | key.  glyph: small engraved symbol for mods/passives/keys (talent-ui.js draws it).
  const N = [];
  const node = o => { N.push(Object.freeze(Object.assign({ requires: null, group: null, gate: 0, level: 1, fx: {} }, o))); };
  // ---- row 2: seals (3 per active, exclusive per active) --------------------------------------------------------
  const mod = (id, col, slot, name, desc, glyph, fx, level) => node({ id, kind: 'mod', col, slot, row: 2, line: COLS[col].line, requires: COLS[col].line, group: 'seal-' + COLS[col].line, gate: 1, level: level || 3, name: t(name), desc: t(desc), glyph, fx });
  // ---- row 3: body passives ------------------------------------------------------------------------------------
  const passive = (id, col, row, name, desc, glyph, fx, extra) => node(Object.assign({ id, kind: 'passive', col, row, line: COLS[col].line, gate: row === 3 ? 3 : row === 4 ? 4 : 7, level: row === 3 ? 4 : row === 4 ? 6 : 9, name: t(name), desc: t(desc), glyph, fx }, extra || {}));
  const key = (id, col, name, desc, price, glyph, fx) => node({ id, kind: 'key', col, row: 6, line: COLS[col].line, group: 'keystone', gate: 6, level: 8, name: t(name), desc: t(desc), price: t(price), glyph, fx });

  mod('cleave-sunder', 0, 0, 'Kemik Yarma', 'Darbe daha ağır iner: +%30 hasar ve +0,5 sn sersemletme. Biraz daha çok dayanıklılık ister.', 'hammer', { dmg: 1.3, stun: .5, cost: 6 });
  mod('cleave-bleed', 0, 1, 'Kanlı Yarık', 'Vurduğun her düşman kanar: vuruşun %60’ı kadar hasar 4 saniyede akar.', 'drop', { bleed: .6 });
  mod('cleave-ember', 0, 2, 'Kor Ağzı', 'Silahın kor tutar: vurduklarını tutuşturur ve önünde 3 saniye yanan bir yarık bırakır.', 'flame', { burn: .45, zone: 'crescent' });
  mod('roar-blood', 1, 0, 'Kan Bedeli', 'Nida dayanıklılık yerine canının %10’unu yer. Karşılığında öfkedeyken can çalman iki buçuk katına çıkar.', 'drop', { bloodCost: .10, steal: 2.5 });
  mod('roar-dread', 1, 1, 'Dehşet', 'Korkutma %70 uzar. Yakındaki düşmanlar dehşete düşer: 6 saniye %20 fazla hasar alır.', 'eye', { fear: 1.7, dread: 6 });
  mod('roar-ember', 1, 2, 'Kor Nefesi', 'Şok dalgası kor taşır: yakındaki bütün düşmanları tutuşturur.', 'flame', { igniteNear: 34 });
  mod('whirl-hook', 2, 0, 'Kanca Zincir', 'Zincirlere kanca takılır: çekiş çok güçlenir, çember %15 genişler.', 'hook', { pull: 2.5, radius: 1.15 });
  mod('whirl-bleed', 2, 1, 'Paslı Zincir', 'Her dönüş kanatır: her vuruşun %35’i 4 saniyede akar ve üst üste biner.', 'drop', { bleed: .35 });
  mod('whirl-ash', 2, 2, 'Kül Fırtınası', 'Kasırga bitince ayağının dibinde 4 saniye yanan bir kül çemberi kalır.', 'flame', { zone: 'ring' });
  mod('charge-trail', 3, 0, 'Kor İzi', 'Atıldığın yol 3,5 saniye yanar; içinde kalan düşmanlar tutuşur.', 'flame', { zone: 'trail' }, 6);
  mod('charge-echo', 3, 1, 'Gölge Adım', 'Hücum %40 daha ucuz ve %40 daha sık; çarpma %15 daha hafif.', 'wing', { cost: .6, cd: .6, dmg: .85 }, 6);
  mod('charge-chain', 3, 2, 'Zincir Kement', 'Varışta zincirler savrulur: çevredeki düşmanları çarpma noktasına çeker ve daha uzun sersemletir.', 'hook', { pullAdd: 4, stun: .6 }, 6);
  mod('pyre-wide', 4, 0, 'Geniş Mühür', 'Mühür %45 büyür ve 2 saniye daha uzun yanar.', 'circle', { radius: 1.45, time: 2 }, 5);
  mod('pyre-heart', 4, 1, 'Ocak Yüreği', 'Kendi mührünün içinde dayanıklılığın iki kat hızlı dolar ve saniyede canının %1,5’i yerine gelir.', 'heart', { hearth: true }, 5);
  mod('pyre-burst', 4, 2, 'Patlayan Mühür', 'Mühür sönerken patlar: içindekilere ağır hasar verir ve sersemletir.', 'burst', { burst: 90 }, 5);
  mod('knell-chain', 5, 0, 'Salgın', 'Lanetli bir düşman ölüp patladığında, patlamanın değdiği düşmanlar da lanetlenir.', 'spread', { spread: true }, 5);
  mod('knell-drain', 5, 1, 'Ruh Hasadı', 'Lanetli düşmanlar ölünce canının %5’i ve 10 dayanıklılık sana döner.', 'heart', { drain: true }, 5);
  mod('knell-toll', 5, 2, 'Ağır Çan', 'Çan %35 daha uzağa ulaşır, düşmanları 1,4 saniye sersemletir ve hasar verir.', 'bell', { radius: 1.35, stun: 1.4, damage: 30 }, 5);
  // ---- row 3 body passives (no parent: a build may skip actives for them) ------------------------------------
  passive('p-crush', 0, 3, 'Ezici', 'Sersemlemiş düşmanlara %25 fazla hasar verirsin.', 'hammer', { vsStunned: 1.25 });
  passive('p-iron', 1, 3, 'Demir Beden', 'En yüksek canın 15 artar.', 'shield', { hp: 15 });
  passive('p-wind', 2, 3, 'Derin Nefes', 'Dayanıklılığın %25 daha hızlı dolar.', 'wind', { regen: 1.25 });
  passive('p-haste', 3, 3, 'Sabırsız Öfke', 'Bütün yeteneklerin bekleme süresi %15 kısalır.', 'hourglass', { cd: .85 });
  passive('p-flask', 4, 3, 'Fazla Matara', 'Bir şifa matarası daha taşırsın; mataralar %20 daha çok iyileştirir.', 'flask', { flasks: 1, flaskHeal: 1.2 });
  passive('p-crit', 5, 3, 'Kemik Gözü', 'Kritik vuruş ihtimalin 8 puan artar.', 'eye', { crit: .08 });
  // ---- rows 4/5: the column passives of the two new actives (the four old lines hold their forms there) --------
  passive('p-ember', 4, 4, 'Kor Kalp', 'Yanma %50 daha çok hasar verir ve 2 saniye daha uzun sürer.', 'flame', { burnMul: 1.5, burnTime: 2 }, { requires: 'pyre' });
  passive('p-ashfall', 4, 5, 'Kül Yağmuru', 'Yanan bir düşman ölünce alev saçar: çevresindekiler tutuşur.', 'burst', { ashfall: true }, { requires: 'p-ember' });
  passive('p-rot', 5, 4, 'Çürük Kan', 'Kanama %50 daha çok hasar verir; kanayan düşmanlar %8 fazla hasar alır.', 'drop', { bleedMul: 1.5, bleedingTaken: 1.08 }, { requires: 'knell' });
  passive('p-harvest', 5, 5, 'Ruh Biçen', 'Her öldürme 8 dayanıklılık ve canının %1’ini geri verir.', 'scythe', { killStamina: 8, killHeal: .01 }, { requires: 'p-rot' });
  // ---- row 6 keystones: exactly one per run ---------------------------------------------------------------------
  key('k-exec', 0, 'Cellat', 'Canı %40’ın altına düşen düşmanlara %35 fazla hasar verirsin. Canı %12’nin altına inen sıradan düşmanlar tek vuruşta ölür.', 'Bedeli: en yüksek canın %20 azalır.', 'axe', { exec: true, hpMul: .8 });
  key('k-blood', 1, 'Kan Yemini', 'Verdiğin bütün hasarın %5’i can olarak sana döner.', 'Bedeli: şifa matarası taşıyamazsın.', 'drop', { leech: .05, noFlask: true });
  key('k-chains', 2, 'Zincirli Kader', 'Kaçınma dayanıklılık harcamaz; her kaçınmada zincirler 5 metredeki düşmanları yanına çeker ve sersemletir.', 'Bedeli: iki kaçınma arasında 2 saniye beklersin.', 'chain', { chainDodge: true });
  key('k-hunger', 3, 'Ölü Açlığı', 'Her vuruş 3, her öldürme 30 dayanıklılık verir.', 'Bedeli: dayanıklılığın 20’nin üstüne kendiliğinden çıkmaz.', 'skull', { hunger: true });
  key('k-pyre', 4, 'Yanan Beden', 'Bütün vuruşların tutuşturur ve yanma %30 daha çok hasar verir.', 'Bedeli: aldığın hasar %15 artar.', 'flame', { allBurn: true, burnMul: 1.3, taken: 1.15 });
  key('k-rot', 5, 'Çürüyen Dünya', 'Öldürdüğün her düşman çürüyerek patlar: çevresine hasar verir ve onları lanetler.', 'Bedeli: şifa mataraları %40 daha az iyileştirir.', 'skull', { rotWorld: true, flaskHeal: .6 });

  // ---- actives / forms come from progression.js (same ids, same params); placed in the grid here ----------------
  const PLACE = { cleave: [0, 1], brand: [0, 4], temper: [0, 5], roar: [1, 1], quake: [1, 4], chainstorm: [1, 5], whirl: [2, 1], reap: [2, 4], rend: [2, 5],
    charge: [3, 1], grasp: [3, 4], havoc: [3, 5], pyre: [4, 1], knell: [5, 1] };
  let index = null, list = null;
  function build() {
    if (index) return;
    const P = B.Progression; list = [];
    for (const s of P.skills) {
      const at = PLACE[s.id]; if (!at) continue;
      list.push(Object.freeze({ id: s.id, kind: s.tier > 1 ? 'form' : 'active', col: at[0], row: at[1], line: s.line, requires: s.requires, group: null,
        gate: at[1] === 4 ? 4 : at[1] === 5 ? 7 : 0, level: s.level, name: s.name, desc: s.description, skill: s, fx: {} }));
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
  function validate(ids, level) {
    build();
    const want = (Array.isArray(ids) ? ids : []).filter((id, n, all) => typeof id === 'string' && index[id] && all.indexOf(id) === n);
    const budget = Math.max(0, Math.min(12, level - 1)), out = [];
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
  function canRefund(learned, id, level) {
    if (!learned.includes(id)) return false;
    const rest = learned.filter(x => x !== id);
    return validate(rest, level).length === rest.length;
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
    e.vsStunned = e.has.has('p-crush') ? 1.25 : 1; e.exec = !!exec; e.leech = e.has.has('k-blood') ? .05 : 0;
    e.chainDodge = e.has.has('k-chains'); e.allBurn = !!pyreK; e.taken = pyreK ? pyreK.taken : 1; e.rotWorld = !!rotW;
    e.ashfall = e.has.has('p-ashfall'); e.harvest = e.has.has('p-harvest');
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
  B.TalentTree = Object.freeze({ cols: COLS, rows: ROWS, nodes, get, access, validate, canRefund, effects, effective, MAX_POINTS: 12 });
}());
