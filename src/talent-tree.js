/* KABİR AZABI — talent tree 4: a build tree of CHOICES, 29 nodes, 13 points to spend. Data + rules only (no DOM, no THREE).
   Six columns (one per active skill line), four rows of decisions (no linear unlock order: any active can be the first point):
     row 1  actives (Mezar Yaran, Kan Nidası, Zincir Kasırgası, Kül Hücumu, Çengelli Çekiş, Demir Duruş), levels 2-4
     row 2  TWO exclusive forms under every active (A or B), each replaces the active in its slot; needs only that active + a modest level
     row 3  four archetype passives in two exclusive pairs (Öfke | Kanama, Savunma | Hücum)
     row 4  three exclusive keystones (Cellat | Kan Yemini | Demir Yemin), one under each board panel
   Every node costs one point: 8 from levels 2-9 and up to 5 from quests. The 17 compatible choices cannot all be learned.
   Exclusive groups: one node per `group`. No gates on points spent. Removed tree-3 nodes are unknown ids: validate() drops them (and later exclusive siblings), the points come back.
   Form ids reuse the older tiers (temper/brand, chainstorm/quake, rend/reap, havoc/grasp) so slots, art, motion and skill-fx keep working.
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
    { line: 'hook', name: t('ÇENGEL'), hint: t('Yakala ve çek'), color: '#7aa889' },
    { line: 'guard', name: t('DEMİR DURUŞ'), hint: t('Dayan ve karşılık ver'), color: '#a9a4c4' }
  ]);
  const ROWS = Object.freeze([
    { row: 1, name: t('I · YETENEKLER'), hint: t('İstediğini ilk al'), gate: 0 },
    { row: 2, name: t('II · BİÇİM'), hint: t('A ya da B'), gate: 0 },
    { row: 3, name: t('III · YAPI'), hint: t('İki yoldan biri'), gate: 0 },
    { row: 4, name: t('IV · KİLİT TAŞI'), hint: t('Yalnız biri'), gate: 0 }
  ]);
  // Build archetypes: which skills / passives belong together (shown in tooltips and in the inspector).
  const ARCH = Object.freeze({ bleed: t('Kanama yapısı'), rage: t('Öfke yapısı'), guard: t('Savunma yapısı'), charge: t('Hücum yapısı') });
  const ARCH_OF_LINE = Object.freeze({ cleave: 'bleed', hook: 'bleed', roar: 'rage', whirl: 'rage', guard: 'guard', charge: 'charge' });
  // kind: active | form | passive | key.  glyph: small engraved symbol for passives/keys (talent-ui.js draws it).
  const N = [];
  const node = o => { N.push(Object.freeze(Object.assign({ requires: null, group: null, gate: 0, level: 1, fx: {} }, o))); };
  // x: position in % of the board width; arch: build archetype of the pair
  const passive = (id, x, line, group, arch, level, name, desc, glyph) => node({ id, kind: 'passive', col: x / 100 * 6 - .5, x, row: 3, line, group, level, name: t(name), desc: t(desc), glyph, fx: {}, arch });
  const key = (id, col, line, name, desc, price, glyph, fx) => node({ id, kind: 'key', col, row: 4, line, group: 'keystone', level: 9, name: t(name), desc: t(desc), price: t(price), glyph, fx });

  // ---- row 3: eight archetype passives, four exclusive pairs (numbers: combat-tuning.js TALENT) --------------------------
  passive('p-bleed', 7.5, 'hook', 'pair-a', 'bleed', 5, 'Kanlı İz', 'Yeteneklerin düşmanı kanatır; kanayan düşmanlar %15 fazla hasar alır.', 'drop');
  passive('p-frenzy', 17.5, 'roar', 'pair-a', 'bleed', 5, 'Kan Çılgınlığı', 'Canın %40’ın altındayken %25 fazla hasar verir, %15 daha hızlı dayanıklılık toplarsın.', 'heart');
  passive('p-rage', 32.5, 'whirl', 'pair-b', 'rage', 5, 'Öfke Birikimi', 'Her 5 vuruşta 3 saniye boyunca %20 fazla hasar verir, dayanıklılığın %40 hızlı dolar.', 'burst');
  passive('p-momentum', 42.5, 'charge', 'pair-b', 'rage', 5, 'Hız Kazanımı', 'Kaçındıktan ya da hücum ettikten sonra 3 saniye vuruşların %20 daha ağır iner.', 'wing');
  passive('p-ironhide', 57.5, 'guard', 'pair-c', 'guard', 7, 'Demir Deri', 'Aldığın bütün hasar sabit %10 azalır.', 'circle');
  passive('p-vengeance', 67.5, 'guard', 'pair-c', 'guard', 7, 'Öç Alma', 'Aldığın darbenin %25’i bir sonraki vuruşuna hasar olarak eklenir.', 'hammer');
  passive('p-crush', 82.5, 'cleave', 'pair-d', 'charge', 7, 'Ezici Vuruş', 'Sersemlemiş düşmanlara %20 fazla hasar verirsin.', 'skull');
  passive('p-breath', 92.5, 'charge', 'pair-d', 'charge', 7, 'Yırtıcı Nefes', 'Bir düşmanı öldürünce 22 dayanıklılık ve canının %1’i geri gelir.', 'flame');
  // ---- row 4 keystones: exactly one per run ---------------------------------------------------------------------
  key('k-exec', 2, 'cleave', 'Cellat', 'Canı %40’ın altına düşen düşmanlara %25 fazla hasar verirsin. Canı %10’un altına inen sıradan düşmanlar tek vuruşta ölür.', 'Bedeli: en yüksek canın %20 azalır.', 'axe', { exec: true, hpMul: .8 });
  key('k-blood', 3, 'roar', 'Kan Yemini', 'Verdiğin bütün hasarın %2,5’i can olarak sana döner.', 'Bedeli: şifa matarası taşıyamazsın.', 'drop', { leech: .025, noFlask: true });
  key('k-iron', 5, 'guard', 'Demir Yemin', 'Aldığın bütün hasar %20 azalır. Öldürdüğün her düşman 8 dayanıklılık geri verir.', 'Bedeli: kaçınma atılışı iki kat dayanıklılık harcar.', 'shield', { taken: .8, killStamina: 8, dodgeMul: 2 });

  // ---- actives / forms come from progression.js (same ids, same params); placed in the grid here: [col, row, slot] ----
  const PLACE = { cleave: [0, 1], temper: [0, 2, 0], brand: [0, 2, 1], roar: [1, 1], chainstorm: [1, 2, 0], quake: [1, 2, 1], whirl: [2, 1], rend: [2, 2, 0], reap: [2, 2, 1],
    charge: [3, 1], havoc: [3, 2, 0], grasp: [3, 2, 1], hook: [4, 1], hook2: [4, 2, 0], hook3: [4, 2, 1], guard: [5, 1], guard2: [5, 2, 0], guard3: [5, 2, 1] };
  let index = null, list = null;
  function build() {
    if (index) return;
    const P = B.Progression; list = [];
    for (const s of P.skills) {
      const at = PLACE[s.id]; if (!at) continue;
      list.push(Object.freeze({ id: s.id, kind: s.tier > 1 ? 'form' : 'active', col: at[0], row: at[1], slot: at[2] == null ? null : at[2], line: s.line, requires: s.requires, group: s.tier > 1 ? 'form-' + s.line : null,
        gate: 0, level: s.level, requiredPowerLevel: s.requiredPowerLevel, requiredXp: s.requiredXp, name: s.name, desc: s.description, skill: s, fx: {}, arch: ARCH_OF_LINE[s.line] }));
    }
    for (const n of N) list.push(Object.freeze(Object.assign({}, n, { level: P.levelForPower(n.level), requiredPowerLevel: n.level, requiredXp: P.powerThresholds[n.level - 1] })));
    list.sort((a, b) => a.row - b.row || a.col - b.col || (a.slot || 0) - (b.slot || 0));
    index = Object.create(null); for (const n of list) index[n.id] = n;
  }
  const get = id => { build(); return index[id] || null; };
  const nodes = () => { build(); return list; };
  const spentOf = learned => learned.length;
  function legalCapacity() { build(); return new Set(list.map(n => n.group || 'single-' + n.id)).size; }
  function blockerOf(learned, n) {
    if (!n.group) return null;
    const other = learned.find(id => id !== n.id && index[id] && index[id].group === n.group);
    return other ? index[other] : null;
  }
  // { known, blocked, canLearn, reason, low, gateNeed, missingParent, exclusive }
  function access(state, id) {
    build(); const n = index[id], learned = state.learned || [];
    if (!n) return { known: false, blocked: true, canLearn: false, reason: t('Böyle bir yetenek yok.') };
    const rank = Number.isFinite(state.powerLevel) ? state.powerLevel : B.Progression.powerLevels[Math.max(0, Math.min(B.Progression.MAX_LEVEL - 1, state.level - 1))];
    const known = learned.includes(id), low = rank < n.requiredPowerLevel, spent = spentOf(learned);
    const missingParent = n.requires && !learned.includes(n.requires) ? index[n.requires] : null;
    const gateNeed = 0;
    const exclusive = !known ? blockerOf(learned, n) : null;
    const blocked = !known && (low || !!missingParent || gateNeed > 0 || !!exclusive);
    const en = KabirI18n.lang === 'en';
    const sameLevel = low && state.level >= n.level && Number.isFinite(state.xp), remaining = sameLevel ? Math.max(0, n.requiredXp - state.xp) : 0;
    const reason = known ? t('Öğrenildi') : low ? (sameLevel ? (en ? 'Earn ' + remaining + ' more experience.' : remaining + ' tecrübe daha kazan.') : en ? 'Requires level ' + n.level + '.' : n.level + '. seviye gerekli.')
      : exclusive ? (en ? 'Excludes ' + exclusive.name + '.' : exclusive.name + ' ile birlikte alınamaz.')
      : missingParent ? (en ? 'Learn ' + missingParent.name + ' first.' : 'Önce ' + missingParent.name + ' öğrenilmeli.')
      : gateNeed ? (en ? 'Spend ' + gateNeed + ' more point' + (gateNeed > 1 ? 's' : '') + ' in the tree.' : 'Ağaca ' + gateNeed + ' puan daha harca.')
      : state.points < 1 ? t('Yetenek puanın yok.') : t('1 puanla öğren');
    return { known, blocked, canLearn: !known && !blocked && state.points > 0, reason, low, gateNeed, missingParent, exclusive, missingTier: 0 };
  }
  // Rebuilds a legal learned list from any (possibly hand-edited / older) list for this level. Order of the result = learning order.
  // extra: skill points earned outside levels (quest boons, progression.js boons.points).
  function validate(ids, level, extra, previousBudget, powerLevel) {
    build();
    const want = (Array.isArray(ids) ? ids : []).filter((id, n, all) => typeof id === 'string' && index[id] && all.indexOf(id) === n);
    const base = B.Progression ? B.Progression.earnedPoints[Math.max(0, Math.min(B.Progression.MAX_LEVEL - 1, level - 1))] : 0;
    const budget = Math.min(legalCapacity(), Number.isFinite(previousBudget) ? Math.max(0, Math.floor(previousBudget)) : base + Math.max(0, extra | 0)), out = [];
    let grew = true;
    while (grew && out.length < budget) {
      grew = false;
      for (const id of want) {
        if (out.includes(id) || out.length >= budget) continue;
        const a = access({ learned: out, level, powerLevel, points: budget - out.length }, id);
        if (a.canLearn) { out.push(id); grew = true; }
      }
    }
    return out;
  }
  // A single node may be refunded when the rest of the tree stays legal without it.
  function canRefund(learned, id, level, extra, powerLevel) {
    if (!learned.includes(id)) return false;
    const rest = learned.filter(x => x !== id);
    return validate(rest, level, extra, undefined, powerLevel).length === rest.length;
  }
  // Flat effect bag of everything learned (passives, keystones). Cached per learned list.
  const fxCache = new Map();
  function effects(learned) {
    build(); const k = learned.join(','); let e = fxCache.get(k);
    if (e) return e;
    e = { has: new Set(learned), keystone: null };
    for (const id of learned) { const n = index[id]; if (n && n.kind === 'key') e.keystone = n; }
    const h = id => e.has.has(id), T = (B.CombatTuning && B.CombatTuning.TALENT) || {}, g = (k, d) => T[k] || d;
    const exec = h('k-exec'), X = g('exec', { below: .4, dmg: 1.25, kill: .1, hp: .8 });
    e.hpAdd = 0; e.hpMul = exec ? X.hp : 1; e.crit = 0; e.regen = 1; e.hunger = false;
    e.flasks = h('k-blood') ? -99 : 0; e.flaskHeal = 1; e.cd = 1;
    const M = g('mark', { skillBleed: .3, time: 4, taken: 1.15 });
    e.bleedMul = 1; e.bleedingTaken = h('p-bleed') ? M.taken : 1; e.skillBleed = h('p-bleed') ? M.skillBleed : 0; e.bleedTime = M.time;
    e.exec = exec; e.execBelow = X.below; e.execDmg = X.dmg; e.execKill = X.kill; e.leech = h('k-blood') ? g('blood', { leech: .025 }).leech : 0;
    e.taken = h('p-ironhide') ? g('ironhide', { taken: .9 }).taken : 1;
    const I = g('iron', { taken: .8, stamina: 8, dodge: 2 });   // Demir Yemin (keystone)
    e.iron = h('k-iron'); if (e.iron) e.taken *= I.taken; e.killStamina = e.iron ? I.stamina : 0; e.dodgeMul = e.iron ? I.dodge : 1;
    e.frenzy = h('p-frenzy') ? g('frenzy', { hp: 40, dmg: 1.25, regen: 1.15 }) : null; e.momentum = h('p-momentum') ? g('momentum', { dmg: 1.2, time: 3 }) : null;
    e.rage = h('p-rage') ? g('rage', { hits: 5, time: 3, dmg: 1.2, regen: 1.4 }) : null; e.vengeance = h('p-vengeance') ? g('vengeance', { share: .25, cap: 90 }) : null;
    e.vsStunned = h('p-crush') ? g('crush', { dmg: 1.2 }).dmg : 1; e.breath = h('p-breath') ? g('breath', { stamina: 22, heal: .01 }) : null;
    if (fxCache.size > 64) fxCache.clear(); fxCache.set(k, Object.freeze(e)); return e;
  }
  // The skill as it fights with this tree (forms carry their own numbers; only the global cooldown factor is folded in).
  function effective(skill, learned) {
    if (!skill) return skill;
    const e = effects(learned);
    return e.cd === 1 ? skill : Object.freeze(Object.assign({}, skill, { cooldown: +(skill.cooldown * e.cd).toFixed(2) }));
  }
  // Sample builds (data for the balance bench / debug: `build` = preset id; the tree page does not list them).
  const PRESETS = Object.freeze([
    { id: 'warlord', name: t('Savaş Beyi'), hint: '', nodes: ['cleave', 'whirl', 'roar', 'charge', 'temper', 'rend', 'p-frenzy', 'havoc', 'k-exec'] },
    { id: 'hook-haul', name: t('Çengelci'), hint: '', nodes: ['hook', 'cleave', 'charge', 'hook3', 'brand', 'p-bleed', 'grasp', 'whirl', 'k-exec'] },
    { id: 'iron-wall', name: t('Demir Duvar'), hint: '', nodes: ['guard', 'cleave', 'roar', 'guard2', 'quake', 'p-ironhide', 'temper', 'whirl', 'k-iron'] }
  ]);
  const archetype = () => '';
  const colOfLine = line => COLS.find(c => c.line === line) || COLS[0];
  const archOf = n => n && n.arch ? ARCH[n.arch] : '';
  const archMates = n => n && n.arch ? nodes().filter(o => o.arch === n.arch && (o.kind === 'active' || o.kind === 'passive') && o.id !== n.id).map(o => o.name) : [];
  B.TalentTree = Object.freeze({ presets: PRESETS, archetype, archOf, archMates, colOfLine, cols: COLS, rows: ROWS, nodes, get, access, validate, canRefund, effects, effective, get legalCapacity() { return legalCapacity(); }, get MAX_POINTS() { return B.Progression ? B.Progression.earnedPoints[B.Progression.MAX_LEVEL - 1] : 8; } });
}());
