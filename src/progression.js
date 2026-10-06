/* KABİR AZABI — four-chapter, kill-earned progression. No idle XP or passive talents. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const MAX_LEVEL = 13, VERSION = 2, SKILL_TREE = 3;   // SKILL_TREE 3: build tree (src/talent-tree.js); saves of trees 1-2 get every point refunded in restore()
  const POINTS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const LEGACY_THRESHOLDS = Object.freeze([0, 40, 100, 350, 850, 1450, 2000]);
  // Expanded route: ~60 temple foes, ~59 coastal foes, then ~60 ruin/cave and ~60 forge foes.
  // Three opening prisoners award 60 XP: the first seal clear grants level 2 and its first active skill point.
  // Final chapter skills arrive before the forge boss on a mostly-cleared route.
  // Active skill slots: right mouse, key 1, key 2, key 3 (round 7; saves with a 3-entry loadout load with the 4th slot empty / auto-filled).
  const SLOT_COUNT = 4;
  const THRESHOLDS = Object.freeze([0, 60, 160, 550, 1200, 2100, 3200, 4600, 6000, 7600, 11000, 13000, 15000]);
  const MILESTONES = Object.freeze([5, 8, 10, 13]);
  const chapterId = n => Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1;
  // Skill tree: 4 lines (columns), 3 tiers each (rows). A lower tier REPLACES its predecessor in the slot it is learned into.
  // line: 'cleave' heavy strike | 'roar' war cry | 'whirl' chain whirlwind | 'charge' dash. params feed combat.js, so numbers in
  // the UI and in the fight are one source. cost is stamina out of 100, cooldown in seconds. `new` lists the highlighted changes.
  const LINES = Object.freeze([
    { id: 'cleave', name: KabirI18n.t('KÜLÜN ÇELİĞİ'), short: KabirI18n.t('Sert vuruş'), color: '#d9884b' },
    { id: 'roar', name: KabirI18n.t('KANIN YEMİNİ'), short: KabirI18n.t('Nida'), color: '#c8473f' },
    { id: 'whirl', name: KabirI18n.t('MEZARIN ZİNCİRİ'), short: KabirI18n.t('Kasırga'), color: '#7f9fbd' },
    { id: 'charge', name: KabirI18n.t('KARA ADIM'), short: KabirI18n.t('Hücum'), color: '#c9a45a' },
    { id: 'pyre', name: KabirI18n.t('KOR'), short: KabirI18n.t('Mühür'), color: '#e0662f' },
    { id: 'knell', name: KabirI18n.t('ÇÜRÜME'), short: KabirI18n.t('Lanet'), color: '#8fae6a' }
  ]);
  const skills = Object.freeze([
    { id: 'cleave', name: KabirI18n.t('Mezar Yaran'), line: 'cleave', tier: 1, level: 2, requires: null, branch: 0, cost: 22, cooldown: 4,
      params: { damage: 78, radius: 3.7, arc: 3.65, stun: .55 },
      description: KabirI18n.t('Kızıl bir yarım ayla önündeki düşmanları yar. Ağır darbe gardı kırar.'), delta: '' },
    { id: 'brand', name: KabirI18n.t('Kemik Kıran'), line: 'cleave', tier: 2, level: 6, requires: 'cleave', branch: 0, cost: 33, cooldown: 6,
      params: { damage: 106, radius: 4.5, reach: 4.2, duration: .68, strike: .22, stun: 1.1 },
      description: KabirI18n.t('Silahı başının üstüne kaldırıp önündeki zemine var gücüyle indir. Kehribar rengi bir şok halkası ve zemin yarıkları düşmanları ezer, sersemletir.'), delta: KabirI18n.t('Tepeden ezme: daha çok hasar, geniş şok halkası, uzun sersemletme.') },
    { id: 'temper', name: KabirI18n.t('Kabir Balyozu'), line: 'cleave', tier: 3, level: 10, requires: 'brand', branch: 0, cost: 44, cooldown: 8,
      params: { damage: 140, radius: 7, arc: 2.5, duration: .74, strike: .26, stun: 1.7 },
      description: KabirI18n.t('İleri sıçra, omuzdan gelen ağır çapraz darbeyle önünü yar. Zemin kara-mor yarıklarla çatlar; önündeki geniş koninin içindeki düşmanlar ezilir ve yere devrilir.'), delta: KabirI18n.t('Sıçrayışlı yer darbesi: çok geniş koni, en yüksek hasar, en uzun sersemletme.') },
    { id: 'roar', name: KabirI18n.t('Kan Nidası'), line: 'roar', tier: 1, level: 2, requires: null, branch: 1, cost: 34, cooldown: 22,
      params: { near: 6.5, far: 10, time: 11, guard: .75, steal: .04, stun: 1.35, fear: 2.2, damage: 0, waves: 1 },
      description: KabirI18n.t('Kanlı bir şok dalgasıyla düşmanları sars; kısa süre saldırırken can kazan.'), delta: '' },
    { id: 'quake', name: KabirI18n.t('Ölüm Çığlığı'), line: 'roar', tier: 2, level: 6, requires: 'roar', branch: 1, cost: 45, cooldown: 27,
      params: { near: 8.4, far: 13, time: 14.5, guard: .68, steal: .06, stun: 1.9, fear: 3, damage: 44, waves: 1 },
      description: KabirI18n.t('Başını geriye atıp çığlık at: kemik beyazı ve kehribar şok halkaları yayılır, zemin yarılır, sarsılan düşmanlar hasar görür ve titrer. Öfke daha uzun sürer.'), delta: KabirI18n.t('Çığlık: daha geniş halkalar, hasar, daha uzun öfke ve can çalma.') },
    { id: 'chainstorm', name: KabirI18n.t('Kıyamet Narası'), line: 'roar', tier: 3, level: 10, requires: 'quake', branch: 1, cost: 56, cooldown: 34,
      params: { near: 11, far: 16, time: 18, guard: .6, steal: .09, stun: 2.5, fear: 3.8, damage: 52, waves: 3, waveDamage: 38 },
      description: KabirI18n.t('İki aşamalı kıyamet narası: yer yarılır, kemik ışığıyla kızıl köz parçacıkları savrulur ve üç halka art arda yayılır. Her halka düşmanları yeniden sarsıp yaralar; öfken çok uzun ve güçlü sürer.'), delta: KabirI18n.t('İki aşamalı nara, üç halka, en geniş alan, en uzun ve güçlü öfke.') },
    { id: 'whirl', name: KabirI18n.t('Zincir Kasırgası'), line: 'whirl', tier: 1, level: 3, requires: null, branch: 2, cost: 36, cooldown: 8,
      params: { ticks: 4, damage: 33, radius: 3.6, first: .06, gap: .28, duration: 1.3, stun: .6, stunLast: 1.15, pull: .45, fling: .9, grow: 1, turns: 2, move: .6 },
      description: KabirI18n.t('Kızıl zincirlerden bir kasırga içinde dönerek çevrendeki düşmanlara dört kez vur.'), delta: '' },
    { id: 'reap', name: KabirI18n.t('Ölüm Biçeni'), line: 'whirl', tier: 2, level: 6, requires: 'whirl', branch: 2, cost: 54, cooldown: 11,
      params: { ticks: 5, damage: 36, radius: 4.8, first: .06, gap: .27, duration: 1.6, stun: .7, stunLast: 1.5, pull: 1.1, fling: 1.8, grow: 1, turns: 4, move: .65 },
      description: KabirI18n.t('Zincirler uzun, parlak orak yaylarına dönüşür: yerde altın bir biçme izi bırakır, beş vuruş vurur, düşmanları içeri çeker. Son vuruş onları uzağa savurur.'), delta: KabirI18n.t('Beş vuruş, daha geniş çember, daha sert çekiş ve savurma.') },
    { id: 'rend', name: KabirI18n.t('Son Hüküm'), line: 'whirl', tier: 3, level: 10, requires: 'reap', branch: 2, cost: 74, cooldown: 15,
      params: { ticks: 7, damage: 35, radius: 6.2, first: .06, gap: .24, duration: 2.05, stun: .85, stunLast: 2, pull: 1.9, fling: 3.4, grow: .68, turns: 6, move: .7 },
      description: KabirI18n.t('Zincirler mor ateşli bir ölüm fırtınasına dönüşür: başta yer çatlar, çember dönerken genişler, yedi vuruş vurur. Son vuruş yeri sarsar ve düşmanları fırlatır.'), delta: KabirI18n.t('Yedi vuruş, genişleyen en büyük çember, en güçlü çekiş, sarsıcı son vuruş.') },
    { id: 'charge', name: KabirI18n.t('Kül Hücumu'), line: 'charge', tier: 1, level: 5, requires: null, branch: 3, cost: 30, cooldown: 7,
      params: { range: 8, speed: 20, damage: 86, ringMul: .55, radius: 2.6, stun: 1.4, width: 1.5, pathDamage: 0, shove: 0, knock: 2.6, hitStop: .07, pull: 0, impacts: 1 },
      description: KabirI18n.t('Fare imlecine doğru kül ve kıvılcımlar içinde atıl. Yoldakileri it, varınca yere çarpıp çevrendekileri sersemlet.'), delta: '' },
    { id: 'grasp', name: KabirI18n.t('Kor Hücumu'), line: 'charge', tier: 2, level: 6, requires: 'charge', branch: 3, cost: 46, cooldown: 10,
      params: { range: 11, speed: 27, damage: 116, ringMul: .55, radius: 3.8, stun: 1.9, width: 2.4, pathDamage: 26, shove: 3.6, knock: 3.6, hitStop: .09, pull: 2.4, impacts: 1 },
      description: KabirI18n.t('Omzunu öne verip kor gibi parlayan bir iz bırakarak koş: yoldaki düşmanları kıvılcımlarla yana devirir, varışta yer çatlaklarla yarılır ve düşmanlar çarpma noktasına çekilir.'), delta: KabirI18n.t('Daha uzun ve hızlı atılış, yoldakileri devirir, çatlak açan daha büyük çarpma.') },
    { id: 'havoc', name: KabirI18n.t('Mahşer Hücumu'), line: 'charge', tier: 3, level: 10, requires: 'grasp', branch: 3, cost: 66, cooldown: 14,
      params: { range: 14, speed: 32, damage: 160, ringMul: .55, radius: 5, stun: 2.6, width: 3.4, pathDamage: 44, shove: 6.5, knock: 4.8, hitStop: .12, pull: 3.6, impacts: 2, damage2: 110, radius2: 6.6 },
      description: KabirI18n.t('Kükreyip koç gibi atıl: geniş, karanlık bir iz bırakır, yoldakileri havaya fırlatır. Varışta yer iki kez çatlar; ikinci çarpma daha ağırdır ve sersemletir.'), delta: KabirI18n.t('Çifte çarpma, yoldakileri fırlatır, en geniş alan ve en uzun sersemletme.') },
    // Talent tree 3 actives (runtime: src/talent-runtime.js, look: src/talent-fx.js).
    { id: 'pyre', name: KabirI18n.t('Kor Mührü'), line: 'pyre', tier: 1, level: 4, requires: null, branch: 4, cost: 30, cooldown: 9,
      params: { damage: 40, radius: 3.4, time: 5, dps: 14, burn: 24, reach: 2.4, burst: 0 },
      description: KabirI18n.t('Silahını yere vurup önüne kor bir mühür kaz. Mühür birkaç saniye yanar; içine giren düşmanlar tutuşur.'), delta: '' },
    { id: 'knell', name: KabirI18n.t('Ölüm Çanı'), line: 'knell', tier: 1, level: 4, requires: null, branch: 5, cost: 26, cooldown: 14,
      params: { radius: 7, time: 8, amp: 1.3, burst: 52, burstRadius: 3.2, stun: 0, damage: 0 },
      description: KabirI18n.t('Başının üstünde hayalet bir çan çalar. Çevredeki düşmanlar lanetlenir: daha çok hasar alır, ölünce çürüyüp patlar.'), delta: '' }
  ].map(s => Object.freeze(Object.assign({}, s, { params: Object.freeze(s.params), cost: s.cost }))));
  const skillIndex = Object.fromEntries(skills.map(s => [s.id, s]));
  const skillsByLine = line => skills.filter(s => s.line === line).sort((a, b) => a.tier - b.tier);
  // A new tier opens as a whole after all four lines of the previous tier.
  // Restore deliberately keeps the old per-line validation: already-earned
  // upgrades remain usable even when a legacy profile has uneven tiers.
  function skillAccess(state, id) {
    if (B.TalentTree) return B.TalentTree.access(state, id);
    const skill = skillIndex[id], learned = new Set(state.learned || []);
    if (!skill) return { known:false, blocked:true, canLearn:false, reason:KabirI18n.t('Böyle bir yetenek yok.') };
    const known = learned.has(id), low = state.level < skill.level;
    const missingParent = skill.requires && !learned.has(skill.requires);
    const previous = skill.tier > 1 ? skills.filter(s => s.tier === skill.tier - 1) : [];
    const missingTier = previous.filter(s => !learned.has(s.id)).length;
    const blocked = !known && (low || !!missingParent || missingTier > 0);
    const reason = known ? KabirI18n.t('Öğrenildi') : low ? (KabirI18n.lang === 'en' ? 'Requires level ' + skill.level + '.' : skill.level + KabirI18n.t('. seviye gerekli.')) : missingParent ? KabirI18n.t('Önce ') + skillIndex[skill.requires].name + KabirI18n.t(' öğrenilmeli.') : missingTier ? KabirI18n.t('Önce ') + (skill.tier - 1) + KabirI18n.t('. aşamadaki dört yeteneği öğren.') : state.points < 1 ? KabirI18n.t('Yetenek puanın yok.') : KabirI18n.t('1 puanla öğren');
    return { known, blocked, canLearn:!known && !blocked && state.points > 0, reason, missingTier, low, missingParent };
  }

  // Numbers shown on the tree page and in tooltips: [label, text]. Same params the fight uses.
  const num = n => String(Number(n.toFixed(2))).replace('.', KabirI18n.lang === 'en' ? '.' : ',');
  function skillFacts(s) {
    const p = s.params, out = [];
    if (s.line === 'cleave') {
      out.push([KabirI18n.t('Temel hasar'), String(p.damage)], [KabirI18n.t('Alan'), num(p.radius) + ' m'], [KabirI18n.t('Sersemletme'), num(p.stun) + KabirI18n.t(' sn')]);
    } else if (s.line === 'roar') {
      out.push([KabirI18n.t('Sarsma alanı'), num(p.near) + ' m'], [KabirI18n.t('Korkutma alanı'), num(p.far) + ' m'], [KabirI18n.t('Temel hasar'), p.damage ? (p.waves > 1 ? p.damage + ' + ' + (p.waves - 1) + '×' + p.waveDamage : String(p.damage)) : '—'],
        [KabirI18n.t('Öfke süresi'), num(p.time) + KabirI18n.t(' sn')], [KabirI18n.t('Hasar azaltma'), '%' + Math.round((1 - p.guard) * 100)], [KabirI18n.t('Can çalma'), '%' + Math.round(p.steal * 100)], [KabirI18n.t('Dalga'), String(p.waves)]);
    } else if (s.line === 'whirl') {
      out.push([KabirI18n.t('Temel vuruş'), p.ticks + '×' + p.damage + ' = ' + p.ticks * p.damage], [KabirI18n.t('Çember'), p.grow < 1 ? num(p.radius * p.grow) + ' → ' + num(p.radius) + ' m' : num(p.radius) + ' m'], [KabirI18n.t('Çekiş'), num(p.pull) + ' m'], [KabirI18n.t('Son vuruşta savurma'), num(p.fling) + ' m'], [KabirI18n.t('Son vuruş sersemletmesi'), num(p.stunLast) + KabirI18n.t(' sn')]);
    } else if (s.line === 'pyre') {
      out.push([KabirI18n.t('Temel vuruş'), String(p.damage)], [KabirI18n.t('Mühür alanı'), num(p.radius) + ' m'], [KabirI18n.t('Mühür süresi'), num(p.time) + KabirI18n.t(' sn')], [KabirI18n.t('Saniyede yanma'), String(p.dps)]);
      if (p.burst) out.push([KabirI18n.t('Sönerken patlama'), String(p.burst)]);
    } else if (s.line === 'knell') {
      out.push([KabirI18n.t('Lanet alanı'), num(p.radius) + ' m'], [KabirI18n.t('Lanet süresi'), num(p.time) + KabirI18n.t(' sn')], [KabirI18n.t('Fazladan hasar'), '%' + Math.round((p.amp - 1) * 100)], [KabirI18n.t('Ölünce patlama'), String(p.burst)]);
      if (p.stun) out.push([KabirI18n.t('Sersemletme'), num(p.stun) + KabirI18n.t(' sn')]);
    } else {
      out.push([KabirI18n.t('Mesafe'), num(p.range) + ' m'], [KabirI18n.t('Temel çarpma'), p.impacts > 1 ? p.damage + ' + ' + p.damage2 : String(p.damage)], [KabirI18n.t('Temel yol hasarı'), p.pathDamage ? String(p.pathDamage) : '—'], [KabirI18n.t('Yol genişliği'), num(p.width) + ' m'], [KabirI18n.t('Yoldakini savurma'), p.shove ? num(p.shove) + ' m' : '—'],
        [KabirI18n.t('Çarpma alanı'), p.impacts > 1 ? num(p.radius) + ' / ' + num(p.radius2) + ' m' : num(p.radius) + ' m'], [KabirI18n.t('Sersemletme'), num(p.stun) + KabirI18n.t(' sn')], [KabirI18n.t('Çekiş'), p.pull ? num(p.pull) + ' m' : '—']);
    }
    out.push([KabirI18n.t('Maliyet'), Math.round(s.cost) + ''], [KabirI18n.t('Bekleme'), num(s.cooldown) + KabirI18n.t(' sn')]);
    return out;
  }
  // Old saves (before skillTree 2) used other prerequisites for the same skill ids. Rebuild a valid set with the SAME number of spent points:
  // a skill whose new prerequisite chain is incomplete turns into the earliest missing link of that chain (duplicates fall away, which refunds
  // the point). Returns { learned, map } where map sends every old id to its new id (or null when its level is not reached).
  function migrateLearned(list, level) {
    const old = skills.filter(s => list.includes(s.id)).sort((a, b) => a.tier - b.tier || a.level - b.level), out = new Set(), map = new Map();
    for (const s of old) {
      const chain = []; for (let c = s; c; c = skillIndex[c.requires]) chain.unshift(c);
      const first = chain.find(c => !out.has(c.id)) || s;
      if (first.level <= level) { out.add(first.id); map.set(s.id, first.id); } else map.set(s.id, null);
    }
    return { learned: skills.filter(s => out.has(s.id)).map(s => s.id), map };
  }
  // Maps the learned skills and loadout of a pre-skillTree-2 profile (see migrateLearned); points stay consistent because they derive from level - learned.
  function migrateProfileSkills(profile) {
    // Tree 3 changed the whole tree: every point of an older save is refunded (level stays, points = level - 1) and the UI says so.
    if (B.TalentTree) return Object.assign({}, profile, { learned: [], loadout: [null, null, null, null], skillTree: SKILL_TREE });
    const m = migrateLearned(Array.isArray(profile.learned) ? profile.learned.filter(id => typeof id === 'string') : [], 12);
    const loadout = [0, 1, 2, 3].map(n => { const id = Array.isArray(profile.loadout) ? m.map.get(profile.loadout[n]) : null; return id || null; });
    // Old tiers of one line were separate skills; they now upgrade one slot: keep the highest slotted tier in the first slot of that line.
    for (let n = 0; n < SLOT_COUNT; n++) {
      if (!loadout[n]) continue;
      for (let k = n + 1; k < SLOT_COUNT; k++) if (loadout[k] && skillIndex[loadout[k]].line === skillIndex[loadout[n]].line) {
        if (skillIndex[loadout[k]].tier > skillIndex[loadout[n]].tier) loadout[n] = loadout[k];
        loadout[k] = null;
      }
    }
    return Object.assign({}, profile, { learned: m.learned, loadout, skillTree: SKILL_TREE });
  }
  function item(id, name, slot, level, rarity, damage, defense, hp, type, description, modelId, finish) {
    const visualScale = slot === 'weapon' && modelId ? type === 'axe' ? [1.16, .97, 1.04] : type === 'spear' ? [.91, 1.11, .93] : finish === 'brine' ? [1.08, 1.14, .98] : [.88, 1.08, .96] : [1, 1, 1];
    return Object.freeze({ id, name, slot, level, rarity, damage: damage || 0, defense: defense || 0, hp: hp || 0,
      type: type || slot, description, icon: slot === 'weapon' ? type : slot, modelId: modelId || id, finish: finish || 'worn', visualScale: Object.freeze(visualScale) });
  }
  const items = Object.freeze([
    item('dull-sword', KabirI18n.t('Kör Mahkûm Kılıcı'), 'weapon', 1, 'common', 0, 0, 0, 'sword', KabirI18n.t('Bir mezar mahkûmunun aşınmış, çentikli kılıcı.')),
    item('grave-sword', KabirI18n.t('Mezar Nöbetçisi'), 'weapon', 2, 'uncommon', .06, 0, 0, 'sword', KabirI18n.t('Küller içinden çıkarılmış, hâlâ keskin bir demir kılıç.')),
    item('rust-axe', KabirI18n.t('Paslı Yemin Baltası'), 'weapon', 2, 'uncommon', .065, 0, 0, 'axe', KabirI18n.t('Sapına bozulmuş yeminler kazınmış bir savaş baltası.')),
    item('bone-spear', KabirI18n.t('Kemik Geçidi Mızrağı'), 'weapon', 3, 'uncommon', .085, 0, 0, 'spear', KabirI18n.t('Kemik halkalarla bağlanmış uzun bir mezar mızrağı.')),
    item('executioner-axe', KabirI18n.t('Celladın Son Hükmü'), 'weapon', 4, 'boss', .12, 0, 0, 'axe', KabirI18n.t('Zincir Celladı’nın kırılmış mührünü taşıyan baltası. Garantili ganimet.')),
    item('bell-spear', KabirI18n.t('Derinliklerin Suskunluğu'), 'weapon', 7, 'boss', .18, 0, 0, 'spear', KabirI18n.t('Çancının sustuğu anda karaya bıraktığı karanlık mızrak. Garantili ganimet.')),
    item('torn-chest', KabirI18n.t('Yırtık Mahkûm Yeleği'), 'chest', 1, 'common', 0, 0, 0, null, KabirI18n.t('Soğuk taşın üstünde parçalanmış bir deri yelek.')),
    item('grave-chest', KabirI18n.t('Kül Muhafızının Zırhı'), 'chest', 3, 'uncommon', 0, .05, 4, null, KabirI18n.t('Kararmış demir plakalar eski yaraları örter.')),
    item('coast-chest', KabirI18n.t('Boğulmuşun Zırhı'), 'chest', 5, 'rare', 0, .08, 5, null, KabirI18n.t('Tuzla aşınmış zırhın altında kalın, koyu deri vardır.')),
    item('cloth-hood', KabirI18n.t('Kara Bez Başlık'), 'head', 1, 'common', 0, .015, 0, null, KabirI18n.t('Sert rüzgârı kesen isli bir başlık.')),
    item('iron-helm', KabirI18n.t('Mezar Demiri Miğfer'), 'head', 3, 'uncommon', 0, .04, 1, null, KabirI18n.t('Çatlamış ama sağlam bir mezar muhafızı miğferi.')),
    item('drowned-helm', KabirI18n.t('Çan Nöbetçisi Miğferi'), 'head', 5, 'rare', 0, .06, 2, null, KabirI18n.t('Tuz lekeleri arasından silinmiş bir çan arması seçilir.')),
    item('rag-wraps', KabirI18n.t('Kanlı Bez Sargılar'), 'hands', 1, 'common', 0, .01, 0, null, KabirI18n.t('Avuçların eski yaralarını tutan yıpranmış sargılar.')),
    item('chain-gloves', KabirI18n.t('Zincir Kıran Eldivenler'), 'hands', 3, 'uncommon', 0, .03, 0, null, KabirI18n.t('Demir halkalarla güçlendirilmiş deri eldivenler.')),
    item('salt-gauntlets', KabirI18n.t('Tuz Çeliği Eldivenler'), 'hands', 6, 'rare', 0, .055, 1, null, KabirI18n.t('Deniz kabuğu gibi aşınmış ağır çelik eldivenler.')),
    item('worn-boots', KabirI18n.t('Yıpranmış Yol Çizmeleri'), 'boots', 1, 'common', 0, .015, 0, null, KabirI18n.t('Taş zeminde çok yürümüş çatlak deri çizmeler.')),
    item('grave-boots', KabirI18n.t('Mezar Yolu Çizmeleri'), 'boots', 3, 'uncommon', 0, .035, 1, null, KabirI18n.t('Kalın tabanları kemik ve kömür tozuyla kaplı.')),
    item('tide-boots', KabirI18n.t('Kara Gelgit Çizmeleri'), 'boots', 5, 'rare', 0, .055, 1, null, KabirI18n.t('Suya dayanıklı deri ile kararmış demir birlikte örülmüş.') ),
    // Variants reuse authored silhouettes and scanned material maps. Their statistics offer real choices.
    item('widow-sword', KabirI18n.t('Dulun Son Duası'), 'weapon', 3, 'uncommon', .075, 0, 2, 'sword', KabirI18n.t('Kabzasına bir mezar duası sarılmış. Keskinlikten biraz vazgeçip yaralarını ayakta tutar.'), 'grave-sword', 'ash'),
    item('mourning-axe', KabirI18n.t('Yasın Kör Dişi'), 'weapon', 4, 'rare', .10, .015, 0, 'axe', KabirI18n.t('Çentikli ağzının ardında kalın bir demir muhafaza vardır. Celladın baltasından zayıf, daha koruyucu.'), 'rust-axe', 'blood'),
    item('black-tide-sword', KabirI18n.t('Kara Suyun Hükmü'), 'weapon', 6, 'epic', .15, 0, 0, 'sword', KabirI18n.t('Bir batığın içinde hâlâ keskin kalan siyah çelik. Üzerindeki tuz izi silinmez.'), 'grave-sword', 'brine'),
    item('orphan-spear', KabirI18n.t('Yetimin Mezarsız Yemini'), 'weapon', 5, 'rare', .105, 0, 3, 'spear', KabirI18n.t('Mızrağın kemik halkalarında adı unutulmuş bir çocuğun yemini durur.'), 'bone-spear', 'bone'),
    item('ash-chest', KabirI18n.t('Kül Kefeni'), 'chest', 1, 'common', 0, .018, 1, null, KabirI18n.t('Ateşten geriye kalan sert bez. Zırh sayılmaz ama soğuğu biraz keser.'), 'torn-chest', 'ash'),
    item('mourner-chest', KabirI18n.t('Yas Tutmayanın Yeleği'), 'chest', 2, 'uncommon', 0, .025, 3, null, KabirI18n.t('İç dikişlerine eski sargılar sıkıştırılmış karanlık deri. Demir kadar korumaz.'), 'torn-chest', 'blood'),
    item('empty-vow-chest', KabirI18n.t('Boş Yeminin Demiri'), 'chest', 4, 'rare', 0, .065, 1, null, KabirI18n.t('Sahibi sözünü tuttu; mezar yine de onu yuttu. Ağır demir yüksek koruma sağlar.'), 'grave-chest', 'rust'),
    item('salt-shroud', KabirI18n.t('Dönmeyenin Tuz Kefeni'), 'chest', 5, 'rare', 0, .04, 6, null, KabirI18n.t('Boğulmuş deri ve yelken bezi birbirine dikilmiş. Darbeleri az keser, bedeni ayakta tutar.'), 'coast-chest', 'brine'),
    item('sunken-vow-chest', KabirI18n.t('Batmış Yeminin Zırhı'), 'chest', 6, 'epic', 0, .09, 2, null, KabirI18n.t('Dipten çıkarılan plakaların arasında deniz kabukları vardır. Güçlü koruma, az can desteği.'), 'coast-chest', 'rust'),
    item('funeral-hood', KabirI18n.t('Son Duanın Başlığı'), 'head', 1, 'common', 0, .005, 2, null, KabirI18n.t('Alnına kurumuş bir dua dikilmiş isli kumaş. Koruması zayıf, sıcaklığı hâlâ vardır.'), 'cloth-hood', 'ash'),
    item('orphan-hood', KabirI18n.t('Kimsesizin Kara Örtüsü'), 'head', 2, 'uncommon', 0, .02, 1, null, KabirI18n.t('İs ve yağmurla ağırlaşmış bir başlık. İçinde hiçbir isim yazmaz.'), 'cloth-hood', 'blood'),
    item('no-witness-helm', KabirI18n.t('Şahitsiz Ölüm Miğferi'), 'head', 4, 'rare', 0, .05, 0, null, KabirI18n.t('Yüzü örten demirde gözler için iki ince yarık bırakılmış.'), 'iron-helm', 'rust'),
    item('silent-watch-helm', KabirI18n.t('Sessiz Nöbetin Yüzü'), 'head', 5, 'rare', 0, .035, 3, null, KabirI18n.t('Kaybolan fener nöbetçisinin miğferi. Tuzla ağırlaşmış astarı başını korur.'), 'drowned-helm', 'brine'),
    item('last-breath-helm', KabirI18n.t('Son Nefesin Demiri'), 'head', 6, 'epic', 0, .065, 1, null, KabirI18n.t('İç yüzündeki tırnak izleri hiçbir ateşle silinmemiş.'), 'drowned-helm', 'bone'),
    item('burial-wraps', KabirI18n.t('Gömülmeyenin Sargıları'), 'hands', 1, 'common', 0, .005, 1, null, KabirI18n.t('Mezarı hazırlanmamış bir ölünün koyu sargıları. Parmakları sıcak tutar.'), 'rag-wraps', 'ash'),
    item('cold-prayer-gloves', KabirI18n.t('Soğuk Duanın Elleri'), 'hands', 2, 'uncommon', 0, .02, 0, null, KabirI18n.t('Çatlak deriye birkaç demir halka işlenmiş. Avuçlarda eski dua izleri vardır.'), 'chain-gloves', 'rust'),
    item('nameless-gauntlets', KabirI18n.t('İsimsizin Demir Parmakları'), 'hands', 4, 'rare', 0, .04, 0, null, KabirI18n.t('Eklemlerini pas tutmuş eldivenlerin her parmağında bir çentik sayılır.'), 'chain-gloves', 'blood'),
    item('drowned-wraps', KabirI18n.t('Boğulmuş Duanın Sargıları'), 'hands', 5, 'rare', 0, .025, 3, null, KabirI18n.t('Tuzla sertleşmiş bezin içine kuru ot ve deri sıkıştırılmış.'), 'rag-wraps', 'brine'),
    item('widow-gauntlets', KabirI18n.t('Dulun Son Dokunuşu'), 'hands', 6, 'epic', 0, .06, 0, null, KabirI18n.t('Demir parmakların üstünde yüzük izleri kalmış. Güçlü koruması dışında hiçbir tesellisi yok.'), 'salt-gauntlets', 'bone'),
    item('ash-footwraps', KabirI18n.t('Kül İçinde Kalan Adımlar'), 'boots', 1, 'common', 0, .005, 1, null, KabirI18n.t('İs tutmuş deri bağlar kırık tabanları bir arada tutar.'), 'worn-boots', 'ash'),
    item('gallows-boots', KabirI18n.t('Darağacının Son Yolu'), 'boots', 2, 'uncommon', 0, .025, 0, null, KabirI18n.t('Tabanındaki demir çiviler mahkûmun yürüdüğü son yolu hatırlar.'), 'grave-boots', 'rust'),
    item('lost-pilgrim-boots', KabirI18n.t('Dönmeyen Hacının İzleri'), 'boots', 4, 'rare', 0, .025, 3, null, KabirI18n.t('Çatlak derinin altında kalın kumaş vardır. Ağır zırh kadar korumaz.'), 'worn-boots', 'blood'),
    item('sunken-steps', KabirI18n.t('Dipte Unutulan Adımlar'), 'boots', 5, 'rare', 0, .045, 2, null, KabirI18n.t('Islak çelik ve kararmış deri, çoktan batmış bir yolcudan kalmış.'), 'tide-boots', 'brine'),
    item('grave-silence-boots', KabirI18n.t('Mezar Sessizliğinin Çizmeleri'), 'boots', 6, 'epic', 0, .065, 0, null, KabirI18n.t('İçlerine kum dolmuş ağır demir çizmeler. Güçlü koruması her adımda hissedilir.'), 'tide-boots', 'bone'),
    item('ruin-lament-sword', KabirI18n.t('Harabenin Susmayan Ağıdı'), 'weapon', 7, 'epic', .175, 0, 2, 'sword', KabirI18n.t('Yıkık bir sunağın altından çıkarılmış kılıç. Kabzasındaki adları kimse hatırlamaz.'), 'grave-sword', 'ash'),
    item('sepulcher-axe', KabirI18n.t('Boş Lahdin Ağzı'), 'weapon', 8, 'epic', .195, 0, 0, 'axe', KabirI18n.t('Bir lahit kapağından dövülmüş ağır balta. Taş tozu hâlâ ağzında durur.'), 'executioner-axe', 'bone'),
    item('starved-spear', KabirI18n.t('Açlığın Son Yemini'), 'weapon', 8, 'epic', .175, .015, 2, 'spear', KabirI18n.t('Yeraltında açlıktan ölmüş bir nöbetçinin mızrağı. Sapı kuru deriyle tekrar bağlanmış.'), 'bone-spear', 'rust'),
    item('cave-verdict-sword', KabirI18n.t('Kör Mağaranın Hükmü'), 'weapon', 9, 'epic', .21, 0, 1, 'sword', KabirI18n.t('Işıksız kayaların arasından keskin bir ağız olarak doğmuş siyah demir.'), 'grave-sword', 'blood'),
    item('broken-throne-axe', KabirI18n.t('Kırık Tahtın İntikamı'), 'weapon', 9, 'epic', .195, 0, 4, 'axe', KabirI18n.t('Çökmüş tahtın demirinden yapılmış balta. Keskinlik yerine sahibini hayatta tutar.'), 'executioner-axe', 'ash'),
    item('hollow-crown-blade', KabirI18n.t('Tahtsız Kralın Son Sözü'), 'weapon', 10, 'boss', .25, 0, 3, 'sword', KabirI18n.t('Boş Kral düştüğünde bıraktığı kemik kabzalı kılıç. Artık hiçbir tahta yemin etmez.'), 'grave-sword', 'bone'),
    item('ruin-burial-chest', KabirI18n.t('Yıkıntının Kefen Zırhı'), 'chest', 7, 'epic', 0, .095, 2, null, KabirI18n.t('Harabe taşlarının altında çürümüş deri ve ağır demir, son bir kez bir araya getirildi.'), 'grave-chest', 'ash'),
    item('warden-chainmail', KabirI18n.t('Mezar Ustasının Son Nöbeti'), 'chest', 8, 'epic', 0, .10, 3, null, KabirI18n.t('Harabe bekçisinin örülmüş karanlık zırhı. Pasın altında sağlam halkalar kalmış.'), 'coast-chest', 'rust'),
    item('hollow-heart-chest', KabirI18n.t('İçi Boş Kalbin Kefeni'), 'chest', 9, 'epic', 0, .065, 8, null, KabirI18n.t('Kalp hizasındaki demir sökülmüş; geriye kalın, kanla sertleşmiş deri bırakılmış.'), 'torn-chest', 'blood'),
    item('sunless-vow-chest', KabirI18n.t('Güneşsiz Yeminin Zırhı'), 'chest', 10, 'epic', 0, .115, 1, null, KabirI18n.t('Işığa hiç çıkmamış demir plakalar ağır darbeleri keser; içinde bir umut saklamaz.'), 'coast-chest', 'bone'),
    item('forgotten-face-helm', KabirI18n.t('Unutulan Yüzün Demiri'), 'head', 7, 'epic', 0, .07, 1, null, KabirI18n.t('Yüz kısmı külle tıkanmış bir mezar miğferi. İçinde bir isim bulunmaz.'), 'iron-helm', 'ash'),
    item('buried-prayer-hood', KabirI18n.t('Göçük Altındaki Dua'), 'head', 8, 'epic', 0, .045, 5, null, KabirI18n.t('Bir mağara göçüğünün altında kalmış kalın kumaş. Darbeleri az keser ama sıcaklığı kalır.'), 'cloth-hood', 'blood'),
    item('sealed-gaze-helm', KabirI18n.t('Mühürlü Bakış'), 'head', 9, 'epic', 0, .08, 1, null, KabirI18n.t('Göz çevresine kemik halkalar bağlanmış kararmış çelik. Görmediği ölüler hâlâ önündedir.'), 'drowned-helm', 'bone'),
    item('last-witness-helm', KabirI18n.t('Son Şahidin Suskunluğu'), 'head', 10, 'epic', 0, .055, 6, null, KabirI18n.t('Astarına son tanıklığın yazıldığı miğfer. Mürekkep kanla karışmış, sözler okunmaz olmuş.'), 'drowned-helm', 'rust'),
    item('grave-digger-grasp', KabirI18n.t('Gömülemeyenin Parmakları'), 'hands', 7, 'epic', 0, .065, 1, null, KabirI18n.t('Taş kazmaktan aşınmış metal parmaklar. El sahibine bir mezar açamamış.'), 'chain-gloves', 'ash'),
    item('black-stone-gauntlets', KabirI18n.t('Kara Taşın Pençeleri'), 'hands', 8, 'epic', 0, .075, 0, null, KabirI18n.t('Demir eklemlerde mağaranın kara tozu birikmiş. Ağır korumanın altında deri incelmiştir.'), 'salt-gauntlets', 'bone'),
    item('blood-oath-wraps', KabirI18n.t('Ödenmemiş Kan Borcu'), 'hands', 9, 'epic', 0, .045, 5, null, KabirI18n.t('Sargıların arasında tutulmuş son bir yemin vardır. Kimse o borcu ödeyememiş.'), 'rag-wraps', 'blood'),
    item('buried-road-boots', KabirI18n.t('Gömülen Yolun İzleri'), 'boots', 7, 'epic', 0, .07, 1, null, KabirI18n.t('Tabanlarında kapanmış tünellerin taşları kalmış. Geri dönülecek bir yol yok.'), 'grave-boots', 'rust'),
    item('cave-mourning-boots', KabirI18n.t('Mağaranın Kara Yası'), 'boots', 8, 'epic', 0, .045, 5, null, KabirI18n.t('Yırtık derinin içine kalın mezar bezi dikilmiş. Her adımı son adım gibi tutar.'), 'worn-boots', 'ash'),
    item('throneless-steps', KabirI18n.t('Tahtsızların Son Yürüyüşü'), 'boots', 10, 'epic', 0, .08, 2, null, KabirI18n.t('İç yüzünde sökülmüş bir kral arması olan ağır çizmeler. Artık sahibinden başka kimseye hizmet etmez.'), 'tide-boots', 'bone')
,
    item("slag-edge-sword", KabirI18n.t("Cürufun Son Ağzı"), "weapon", 10, "epic", 0.235, 0, 2, "sword", KabirI18n.t("Kapanmış ocağın siyah cürufu kılıcın ağzına işlemiş. Keskinliğin ardında kalın demir kalır."), "grave-sword", "rust"),
    item("furnace-mourning-spear", KabirI18n.t("Ocağın Yas Mızrağı"), "weapon", 10, "epic", 0.225, 0.015, 3, "spear", KabirI18n.t("Isıyla eğrilmiş mızrak yeniden doğrultulmuş; sapında unutulmuş nöbetlerin izleri vardır."), "bell-spear", "ash"),
    item("ember-vow-axe", KabirI18n.t("Sönmeyen Yemin"), "weapon", 11, "epic", 0.255, 0, 0, "axe", KabirI18n.t("Kızgın ocak demirinden dövülmüş çentikli balta. Sahibinin yemini çoktan yanmış, metal kalmıştır."), "executioner-axe", "blood"),
    item("black-forge-sword", KabirI18n.t("Kara Dövmenin Hükmü"), "weapon", 11, "epic", 0.24, 0, 4, "sword", KabirI18n.t("Ağzına açılmış küçük deliklerde ocak isi birikir. Keskinlikten vazgeçip savaşçıyı ayakta tutar."), "grave-sword", "bone"),
    item("last-coal-spear", KabirI18n.t("Son Kömürün Duası"), "weapon", 12, "epic", 0.27, 0, 1, "spear", KabirI18n.t("Demir ucunun üzerinde dua yerine kül durur. Ocağın son kömürü bu silah için söndürülmüş."), "bell-spear", "rust"),
    item("furnace-oath-axe", KabirI18n.t("Ocağın Son Hükmü"), "weapon", 12, "boss", 0.3, 0, 0, "axe", KabirI18n.t("Ocak Kalbi sustuğunda geriye bıraktığı ağır infaz baltası. Artık hiçbir ateşe hizmet etmez."), "executioner-axe", "blood"),
    item("slag-burial-chest", KabirI18n.t("Cüruf Kefeni"), "chest", 10, "epic", 0, 0.12, 2, null, KabirI18n.t("Soğuyan demir parçaları mezar derisine dikilmiş. Ölü bir ocağın ağırlığını taşır."), "coast-chest", "rust"),
    item("ash-warden-chest", KabirI18n.t("Kül Nöbetinin Son Zırhı"), "chest", 11, "epic", 0, 0.125, 3, null, KabirI18n.t("Kül nöbetçisinin kararmış plakalarında yalnız son vardiyanın izleri kalmış."), "coast-chest", "ash"),
    item("hollow-ember-chest", KabirI18n.t("İçi Boş Korun Kefeni"), "chest", 11, "epic", 0, 0.08, 9, null, KabirI18n.t("Kalın bezin içine kat kat deri dikilmiş. Demirden zayıf, bedeni ayakta tutmakta daha kuvvetli."), "torn-chest", "blood"),
    item("buried-fire-chest", KabirI18n.t("Gömülen Ateşin Demiri"), "chest", 12, "epic", 0, 0.135, 1, null, KabirI18n.t("Ateşte unutulup yeniden sertleşmiş plakalar. Sahibinin adı da onlar kadar kararmış."), "grave-chest", "bone"),
    item("last-shift-helm", KabirI18n.t("Son Vardiyanın Yüzü"), "head", 10, "epic", 0, 0.085, 1, null, KabirI18n.t("Siperindeki kurum hiç çıkmamış. Vardiya bitmiş ama miğfer sahibine dönememiş."), "iron-helm", "ash"),
    item("coal-mourner-hood", KabirI18n.t("Kömür Yasçısının Örtüsü"), "head", 10, "epic", 0, 0.055, 6, null, KabirI18n.t("Ocakta kalanları arayan bir yasçının kalın başlığı. İç astarı eski yaraları sıcak tutar."), "cloth-hood", "blood"),
    item("sealed-furnace-helm", KabirI18n.t("Mühürlü Ocağın Bakışı"), "head", 11, "epic", 0, 0.095, 0, null, KabirI18n.t("Yüzünü bir döküm maskesi örter. İçindeki tırnak izleri siperden dışarı hiç ulaşmamış."), "drowned-helm", "rust"),
    item("no-dawn-helm", KabirI18n.t("Şafaksızın Son Yüzü"), "head", 12, "epic", 0, 0.07, 6, null, KabirI18n.t("Şafağı bekleyen bir işçinin demiri. Bekleyiş sona ermiş; kalın astar hâlâ sağlam."), "drowned-helm", "bone"),
    item("slag-fingers", KabirI18n.t("Cüruf Parmakları"), "hands", 10, "epic", 0, 0.085, 1, null, KabirI18n.t("Erimiş metalin izleri eklemleri örtmüş. Bu eller artık bir ocak yakmayacak."), "salt-gauntlets", "rust"),
    item("burnt-oath-wraps", KabirI18n.t("Yanmış Yeminin Sargıları"), "hands", 11, "epic", 0, 0.05, 6, null, KabirI18n.t("Kurumuş sargıların içine ağır deri sıkıştırılmış. Koru yumruklayan bir mahkûmdan kalmış."), "rag-wraps", "blood"),
    item("black-anvil-grasp", KabirI18n.t("Kara Örsün Pençeleri"), "hands", 12, "epic", 0, 0.1, 0, null, KabirI18n.t("Kalın demir parmaklar ocağın örsünden yapılmış. Eldivenlerin içi sessiz ve soğuk."), "chain-gloves", "bone"),
    item("ash-road-boots", KabirI18n.t("Kül Yolunun Son Adımları"), "boots", 10, "epic", 0, 0.08, 2, null, KabirI18n.t("Tabanlarına kül ve çelik talaşı dolmuş. Geldikleri yol artık bir göçüğün altında."), "grave-boots", "ash"),
    item("last-worker-boots", KabirI18n.t("Son İşçinin Çizmeleri"), "boots", 11, "epic", 0, 0.055, 6, null, KabirI18n.t("Yırtık tabanları kat kat deriyle kapanmış. Sahibi ocağın son sesini bunlarla duymuş."), "worn-boots", "blood"),
    item("dead-forge-steps", KabirI18n.t("Ölü Dövmenin İzleri"), "boots", 12, "epic", 0, 0.1, 1, null, KabirI18n.t("Demir uçlarında kapanmış dökümhanenin işaretleri bulunur. Hiçbir kapı artık bu izleri tanımaz."), "tide-boots", "rust")
    ,item('warden-verdict-helm', KabirI18n.t('Harabe Yargıcının Son Yüzü'), 'head', 8, 'boss', 0, .065, 3, null, KabirI18n.t('Harabelerin ikinci muhafızının kemik perçinli hüküm miğferi. Bir daha aynı hüküm verilmeyecek.'), 'iron-helm', 'bone')
    ,item('ash-warden-grasp', KabirI18n.t('Kül Muhafızının Son Pençesi'), 'hands', 11, 'boss', 0, .085, 3, null, KabirI18n.t('İkinci ocak muhafızının kan çizgili döküm eldiveni. Tutsakları ocağa sürükleyen parmaklar artık sessiz.'), 'salt-gauntlets', 'blood')
  ]);
  const catalog = Object.freeze(Object.fromEntries(items.map(i => [i.id, i])));
  const bossSignatures = Object.freeze({ 1:Object.freeze(['executioner-axe']),2:Object.freeze(['bell-spear']),3:Object.freeze(['hollow-crown-blade']),4:Object.freeze(['furnace-oath-axe']),ruinwarden:Object.freeze(['warden-chainmail','warden-verdict-helm']),ashwarden:Object.freeze(['ash-warden-chest','ash-warden-grasp']) });
  const signatureIds = new Set(Object.values(bossSignatures).flat());
  const qualities = Object.freeze({ common: { name: KabirI18n.t('Sıradan'), rank: 0, color:'#c7bdae' }, uncommon: { name: KabirI18n.t('Sıradışı'), rank: 1, color:'#92ad7d' }, rare: { name: KabirI18n.t('Nadir'), rank: 2, color:'#82aac5' }, epic: { name: KabirI18n.t('Epik'), rank: 3, color:'#b394ce' }, boss: { name: KabirI18n.t('Eşsiz'), rank: 4, color:'#d6b475' } });
  // Every identity has a fixed quality. Individual drops vary slightly in craftsmanship.
  function resolveItem(entry) {
    const def = entry && catalog[entry.id]; if (!def) return null;
    const roll = def.rarity === 'boss' ? 0 : Math.max(-2, Math.min(2, Number.isInteger(entry.roll) ? entry.roll : 0));
    const factor = 1 + roll * .025;
    return Object.assign({}, def, { roll, power: def.level * 10 + qualities[def.rarity].rank * 4 + roll,
      damage: def.damage * factor, defense: def.defense * factor, hp: Math.round(def.hp * factor) });
  }
  const slots = Object.freeze(['weapon', 'head', 'chest', 'hands', 'boots']);
  // Drop tuning (round 6): ordinary foes 9 %, elites 35 %, guaranteed after 14 dry kills; see lootPick().
  const LOOT_NORMAL = 18, LOOT_ELITE = 45, LOOT_PITY = 14, LOOT_JUNK = .12;
  const XP = Object.freeze({ prisoner: 20, guard: 25, cultist: 23, stalker: 23, carrier: 25 });
  const hash = value => { let h = 2166136261; for (let n = 0; n < value.length; n++) h = Math.imul(h ^ value.charCodeAt(n), 16777619); return h >>> 0; };
  const result = (ok, reason) => ({ ok, reason: reason || '' });
  const int = (v, fallback) => Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;

  // create() wraps the raw state: snapshots carry skillTree, and restore() (also the initial options.profile) migrates pre-skillTree-2 saves first.
  function create(options) {
    options = options || {};
    const needs = p => p && typeof p === 'object' && p.skillTree !== SKILL_TREE;
    const state = createState(needs(options.profile) ? Object.assign({}, options, { profile: migrateProfileSkills(options.profile) }) : options);
    const rawRestore = state.restore, rawSnapshot = state.snapshot;
    state.restore = profile => { const old = needs(profile), ok = rawRestore(old ? migrateProfileSkills(profile) : profile); if (ok && old && Array.isArray(profile.learned) && profile.learned.length) state.talentRefunded = true; return ok; };
    if (needs(options.profile) && Array.isArray(options.profile.learned) && options.profile.learned.length) state.talentRefunded = true;
    state.snapshot = () => Object.assign(rawSnapshot(), { skillTree: SKILL_TREE });
    return state;
  }
  function createState(options) {
    options = options || {};
    const emit = typeof options.emit === 'function' ? options.emit : function () {};
    const state = { level: 1, xp: 0, points: 0, learned: [], loadout: [null, null, null, null], inventory: [],
      equipment: {}, groundLoot: [], revision: 0, chapter: chapterId(options.chapter), completed: [] };
    let lootSeed = 0, lootDry = 0, lootSeen = [], lootIdentities = new Set(), lootSlots = [], signatureClaims = Object.create(null), rewards = Object.create(null), serial = 0, statCache = null, statRevision = -1;
    function changed(kind, data) { state.revision++; statCache = null; emit(kind || 'progression', data || { level: state.level, points: state.points }); }
    function recalculate() {
      state.level = 1;
      for (let i = 1; i < MAX_LEVEL; i++) if (state.xp >= THRESHOLDS[i]) state.level = i + 1;
      state.points = Math.max(0, POINTS[state.level - 1] - state.learned.length);
    }
    function addItem(id, uid, roll = 0) {
      if (!catalog[id]) return null;
      const entry = { uid: uid || 'gear-' + (++serial), id, roll: catalog[id].rarity === 'boss' ? 0 : Math.max(-2, Math.min(2, Number.isInteger(roll) ? roll : 0)) };
      const found = state.inventory.find(i => i.uid === entry.uid);
      if (found) return found;
      state.inventory.push(entry); return entry;
    }
    function reset() {
      state.level = 1; state.xp = 0; state.points = 0; state.learned = []; state.loadout = [null, null, null, null];
      state.inventory = []; state.groundLoot = []; state.equipment = { weapon: null, head: null, chest: null, hands: null, boots: null };
      lootSeed = Math.floor(Math.random() * 4294967296) >>> 0; lootDry = 0; lootSeen = []; lootIdentities = new Set(); lootSlots = []; signatureClaims = Object.create(null);
      state.chapter = 1; state.completed = []; rewards = Object.create(null); serial = 0;
      state.equipment.weapon = addItem('dull-sword').uid;
      state.equipment.chest = addItem('torn-chest').uid;
      changed(); return state;
    }
    function snapshot() {
      return { version: VERSION, level: state.level, xp: state.xp, points: state.points,
        learned: state.learned.slice(), loadout: state.loadout.slice(), inventory: state.inventory.map(i => ({ uid: i.uid, id: i.id, roll: i.roll || 0 })),
        equipment: Object.assign({}, state.equipment), chapter: state.chapter, completed: state.completed.slice(),
        rewards: Object.keys(rewards), serial, lootSeed, lootDry, lootSeen: lootSeen.slice(-40), lootIdentities:Array.from(lootIdentities), lootSlots:lootSlots.slice(-6), signatureClaims:Object.assign({},signatureClaims),
        groundLoot: state.groundLoot.map(i => ({ uid:i.uid, id:i.id, roll:i.roll, x:i.x, z:i.z, chapter:i.chapter, boss:i.boss })) };
    }
    function restore(profile) {
      if (!profile || (profile.version !== VERSION && profile.version !== 1) || !Array.isArray(profile.inventory)) return false;
      lootSeed = Number.isInteger(profile.lootSeed) ? profile.lootSeed >>> 0 : hash(JSON.stringify(profile.inventory));
      lootDry = Math.min(LOOT_PITY, int(profile.lootDry, 0));
      lootSeen = (Array.isArray(profile.lootSeen) ? profile.lootSeen : []).filter(k => typeof k === 'string' && k.length < 80).slice(-40);
      lootIdentities = new Set((Array.isArray(profile.lootIdentities)?profile.lootIdentities:[]).filter(id=>catalog[id]).slice(0,items.length));
      for(const k of lootSeen){const id=k.slice(k.indexOf(':')+1);if(catalog[id])lootIdentities.add(id);}
      lootSlots=(Array.isArray(profile.lootSlots)?profile.lootSlots:[]).filter(slot=>slots.includes(slot)).slice(-6);
      signatureClaims=Object.create(null);if(profile.signatureClaims&&typeof profile.signatureClaims==='object')for(const key of Object.keys(profile.signatureClaims)){const id=profile.signatureClaims[key];if(/^[1234]:/.test(key)&&key.length<240&&signatureIds.has(id))signatureClaims[key]=id;}
      let restoredXp = int(profile.xp, 0);
      if (profile.version === 1) {
        // Preserve earned levels in older two-chapter saves, using XP rather than a claimed level/point count.
        let tier = 0;
        for (let n = 1; n < LEGACY_THRESHOLDS.length; n++) if (restoredXp >= LEGACY_THRESHOLDS[n]) tier = n;
        const fraction = tier < LEGACY_THRESHOLDS.length - 1 ? (restoredXp - LEGACY_THRESHOLDS[tier]) / (LEGACY_THRESHOLDS[tier + 1] - LEGACY_THRESHOLDS[tier]) : 0;
        restoredXp = Math.floor(THRESHOLDS[tier] + fraction * (THRESHOLDS[tier + 1] - THRESHOLDS[tier]));
      }
      state.xp = Math.min(THRESHOLDS[MAX_LEVEL - 1], restoredXp); recalculate();
      const learned = new Set(B.TalentTree ? B.TalentTree.validate(profile.learned, state.level) : []);
      if (!B.TalentTree) for (const skill of skills) if (learned.size < POINTS[state.level - 1] && Array.isArray(profile.learned) && profile.learned.includes(skill.id) && state.level >= skill.level &&
        (!skill.requires || learned.has(skill.requires))) learned.add(skill.id);
      state.learned = B.TalentTree ? Array.from(learned) : Array.isArray(profile.learned) ? profile.learned.filter((id, n, list) => learned.has(id) && list.indexOf(id) === n) : []; recalculate();
      const seen = new Set();
      state.inventory = profile.inventory.filter(i => i && typeof i.uid === 'string' && i.uid.length < 160 && catalog[i.id] && !seen.has(i.uid) && seen.add(i.uid))
        .map(i => ({ uid: i.uid, id: i.id, roll: catalog[i.id].rarity === 'boss' ? 0 : Math.max(-2, Math.min(2, Number.isInteger(i.roll) ? i.roll : 0)) }));
      state.groundLoot = (Array.isArray(profile.groundLoot) ? profile.groundLoot : []).filter(i =>
        i && typeof i.uid === 'string' && /^drop-[1234]:/.test(i.uid) && i.uid.length < 160 && catalog[i.id] &&
        Number.isFinite(i.x) && Number.isFinite(i.z) && Math.abs(i.x)<2048 && Math.abs(i.z)<2048 &&
        [1,2,3,4].includes(i.chapter) && !seen.has(i.uid) && seen.add(i.uid)).slice(0,96)
        .map(i => ({ uid:i.uid, id:i.id, roll:catalog[i.id].rarity==='boss'?0:Math.max(-2,Math.min(2,Number.isInteger(i.roll)?i.roll:0)), x:i.x, z:i.z, chapter:i.chapter, boss:!!i.boss }));
      for(const e of state.inventory.concat(state.groundLoot))lootIdentities.add(e.id);
      serial = Math.max(int(profile.serial, 0), state.inventory.reduce((n, i) => Math.max(n, /^gear-\d+$/.test(i.uid) ? Number(i.uid.slice(5)) : 0), 0));
      state.equipment = {};
      for (const slot of slots) {
        const entry = state.inventory.find(i => profile.equipment && i.uid === profile.equipment[slot]);
        state.equipment[slot] = entry && catalog[entry.id].slot === slot && catalog[entry.id].level <= state.level ? entry.uid : null;
      }
      if (!profile.equipment || !Object.prototype.hasOwnProperty.call(profile.equipment,'weapon')) state.equipment.weapon = addItem('dull-sword').uid;
      state.loadout = [0, 1, 2, 3].map(n => Array.isArray(profile.loadout) && learned.has(profile.loadout[n]) && skillIndex[profile.loadout[n]] ? profile.loadout[n] : null);
      // A skill line has one home (tiers replace each other): copied/corrupt saves cannot equip a line twice.
      state.loadout = state.loadout.map((id, n, list) => id && list.findIndex(o => o && skillIndex[o].line === skillIndex[id].line) !== n ? null : id);
      // A save from the three-slot days: a learned line that had no slot yet takes the new 4th slot.
      if (Array.isArray(profile.loadout) && profile.loadout.length <= 3 && !state.loadout[3]) {
        const open = state.learned.map(id => skillIndex[id]).filter(sk => !state.loadout.some(o => o && skillIndex[o].line === sk.line)).sort((a, b) => b.tier - a.tier)[0];
        if (open) state.loadout[3] = open.id;
      }
      rewards = Object.create(null);
      if (Array.isArray(profile.rewards)) for (const key of profile.rewards) if (typeof key === 'string' && /^[1234]:/.test(key) && key.length < 240) rewards[key] = true;
      state.chapter = chapterId(profile.chapter);
      state.completed = [1, 2, 3, 4].filter(n => Array.isArray(profile.completed) && profile.completed.includes(n));
      changed(); return true;
    }
    function unlock(id) {
      const skill = skillIndex[id];
      const access = skillAccess(state, id);
      if (!access.canLearn) return result(false, access.known ? KabirI18n.t('Bu yetenek zaten öğrenildi.') : access.reason);
      state.learned.push(id); state.points--;
      if (!skill) { changed('progression', { unlocked: id, level: state.level, points: state.points }); return result(true); }   // seal / passive / keystone: no slot
      // An upgrade takes the place of its predecessor (same slot, same key); a first skill of a line takes a free slot.
      const upgraded = skill.requires ? state.loadout.indexOf(skill.requires) : -1, free = state.loadout.indexOf(null);
      if (upgraded >= 0) state.loadout[upgraded] = id; else if (free >= 0 && !state.loadout.some(o => o && skillIndex[o].line === skill.line)) state.loadout[free] = id;
      changed('progression', { unlocked: id, level: state.level, points: state.points }); return result(true);
    }
    // Talent tree 3: give one node back (when the rest of the tree stays legal) or every node at once. The caller decides when (out of combat).
    function refund(id) {
      if (!B.TalentTree || !B.TalentTree.canRefund(state.learned, id, state.level)) return result(false, KabirI18n.t('Bu düğüme ya da harcanan puan sayısına bağlı başka düğümler var; önce onları geri al.'));
      const skill = skillIndex[id];
      state.learned = state.learned.filter(x => x !== id); recalculate();
      state.loadout = state.loadout.map(o => o !== id ? o : skill && skill.requires && state.learned.includes(skill.requires) ? skill.requires : null);
      changed('progression', { refunded: id, level: state.level, points: state.points }); return result(true);
    }
    function respec() {
      if (!state.learned.length) return result(false, KabirI18n.t('Geri alınacak puan yok.'));
      state.learned = []; state.loadout = [null, null, null, null]; recalculate();
      changed('progression', { respec: true, level: state.level, points: state.points }); return result(true);
    }
    function assign(slot, id) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) return result(false, KabirI18n.t('Geçersiz yetenek yuvası.'));
      if (id !== null && !state.learned.includes(id)) return result(false, KabirI18n.t('Önce bu yeteneği öğren.'));
      if (id !== null && !skillIndex[id]) return result(false, KabirI18n.t('Yalnız aktif yetenekler yuvaya konur.'));
      const previous = state.loadout[slot], other = id === null ? -1 : state.loadout.findIndex(o => o && skillIndex[o].line === skillIndex[id].line);
      if (other !== -1 && other !== slot) state.loadout[other] = previous;
      state.loadout[slot] = id; changed(); return result(true);
    }
    function equip(uid) {
      const entry = state.inventory.find(i => i.uid === uid);
      if (!entry) return result(false, KabirI18n.t('Bu eşya çantanda değil.'));
      const def = catalog[entry.id];
      if (def.level > state.level) return result(false, (KabirI18n.lang === 'en' ? 'Requires level ' + def.level + '.' : def.level + KabirI18n.t('. seviye gerekli.')));
      state.equipment[def.slot] = uid; changed('progression', { equipped: uid, slot: def.slot }); return result(true);
    }
    function unequip(slot) {
      if (!slots.includes(slot)) return result(false,KabirI18n.t('Geçersiz donanım yuvası.'));
      if (!state.equipment[slot]) return result(false,KabirI18n.t('Bu yuva zaten boş.'));
      state.equipment[slot] = null; changed('progression',{unequipped:slot}); return result(true);
    }
    function stats() {
      if (statCache && statRevision === state.revision) return statCache;
      let hp = 95 + (state.level - 1) * 6, damage = .72 + Math.min(6, state.level - 1) * (.53 / 6) + Math.max(0, state.level - 7) * .05, defense = 0, weaponId = null;
      for (const slot of slots) {
        const entry = state.inventory.find(i => i.uid === state.equipment[slot]);
        if (!entry) continue;
        const def = resolveItem(entry); hp += def.hp; defense += def.defense;
        if (slot === 'weapon') { damage *= 1 + def.damage; weaponId = def.id; }
      }
      hp = Math.min(184, hp); damage = Math.min(1.95, damage); defense = Math.min(.30, defense);
      const tal = B.TalentTree ? B.TalentTree.effects(state.learned) : null;
      if (tal) hp = Math.round(hp * tal.hpMul + tal.hpAdd);
      statRevision = state.revision;
      statCache = Object.freeze({ maxHp: hp, maxHealth: hp, damage, damageMultiplier: damage, defense, defenseReduction: defense,
        weaponId, weaponType: weaponId ? catalog[weaponId].type : 'unarmed', criticalChance: .08 + (tal ? tal.crit : 0), criticalMultiplier: 1.5 });
      return statCache;
    }
    // Compare actual combat values in the same slot, including craftsmanship and stat caps.
    function isUpgrade(entry) {
      const def = resolveItem(entry);
      if (!def || state.equipment[def.slot] === entry.uid) return false;
      const oldEntry = state.inventory.find(i => i.uid === state.equipment[def.slot]);
      const old = resolveItem(oldEntry);
      if (!old) return true;
      if (def.slot === 'weapon') {
        const base = .72 + Math.min(6, state.level - 1) * (.53 / 6) + Math.max(0, state.level - 7) * .05;
        return Math.min(1.95, base * (1 + def.damage)) > Math.min(1.95, base * (1 + old.damage)) + .00001;
      }
      let hp = 95 + (state.level - 1) * 6, defense = 0;
      for (const slot of slots) {
        if (slot === def.slot) continue;
        const part = resolveItem(state.inventory.find(i => i.uid === state.equipment[slot]));
        if (part) { hp += part.hp; defense += part.defense; }
      }
      const endurance = part => Math.min(184, hp + part.hp) / (1 - Math.min(.30, defense + part.defense));
      return endurance(def) > endurance(old) + .00001;
    }
    // Combat value of a candidate in its slot (same formulas as isUpgrade), used to rank drops against what the hero owns.
    function slotValue(def, others) {
      if (def.slot === 'weapon') return Math.min(1.95, others.base * (1 + def.damage));
      return Math.min(184, others.hp + def.hp) / (1 - Math.min(.30, others.defense + def.defense));
    }
    function slotContext(slot) {
      let hp = 95 + (state.level - 1) * 6, defense = 0;
      const base = .72 + Math.min(6, state.level - 1) * (.53 / 6) + Math.max(0, state.level - 7) * .05;
      for (const other of slots) {
        if (other === slot) continue;
        const part = resolveItem(state.inventory.find(i => i.uid === state.equipment[other]));
        if (part) { hp += part.hp; defense += part.defense; }
      }
      return { hp, defense, base };
    }
    // Picks the item base of an ordinary drop: favours real upgrades over everything the hero owns, the weakest slots first,
    // never repeats a base already dropped this chapter / owned / lying on the ground, and keeps junk to a small share.
    function lootPick(chapter, elite, seed, roll) {
      const lootLevel = Math.min(state.level, chapter === 4 ? MAX_LEVEL : chapter === 3 ? 10 : chapter === 2 ? 8 : 5);
      const pool = items.filter(i => i.rarity !== 'boss' && !signatureIds.has(i.id) && i.id !== 'dull-sword' && i.id !== 'torn-chest' &&
        i.level <= lootLevel && i.level >= Math.max(1, lootLevel - 2));
      if (!pool.length) return null;
      const tier = elite ? pool.filter(def => def.level >= Math.max(1, state.level - 1)) : pool;
      const available = tier.length ? tier : pool;
      const taken = id => state.inventory.some(e => e.id === id) || state.groundLoot.some(e => e.id === id) || lootIdentities.has(id);
      const contexts = {}, best = {}, need = {};
      for (const slot of slots) {
        contexts[slot] = slotContext(slot);
        let top = 0, topLevel = 0;
        for (const e of state.inventory) {
          const d = resolveItem(e); if (!d || d.slot !== slot || d.level > state.level) continue;
          top = Math.max(top, slotValue(d, contexts[slot])); if (state.equipment[slot] === e.uid) topLevel = d.level;
        }
        best[slot] = top; need[slot] = Math.max(0, Math.min(6, lootLevel - topLevel));
      }
      const scored = available.filter(def => !taken(def.id)).map(def => {
        const d = resolveItem({ id: def.id, roll });   // judged with the craftsmanship this very drop will have
        return { def, up: slotValue(d, contexts[def.slot]) > best[def.slot] + .00001 };
      });
      if (!scored.length) return null;
      const ups = scored.filter(c => c.up);
      // Roughly one drop in five may be a lesser piece (and only when the hero has none better on offer).
      const wantJunk = ((seed >>> 20) % 100) / 100 < LOOT_JUNK;
      const lesser = scored.filter(c => !c.up);
      const choices = ups.length ? (wantJunk && lesser.length ? lesser : ups) : scored;
      if (!ups.length && ((seed >>> 24) % 3)) return null;   // nothing to gain: two of three such drops simply do not happen
      let total = 0; const weights = choices.map(c => { const w = (1 + .3 * qualities[c.def.rarity].rank) * (1 + .35 * need[c.def.slot]) * (c.up ? 3 : 1) * (lootSlots[lootSlots.length-1] === c.def.slot ? .18 : lootSlots.slice(-3).includes(c.def.slot) ? .6 : 1); total += w; return w; });
      let r = (((seed >>> 8) & 0xfff) / 4096) * total;
      for (let n = 0; n < choices.length; n++) { r -= weights[n]; if (r < 0) return choices[n].def.id; }
      return choices[choices.length - 1].def.id;
    }
    function loot(enemyId, type, boss, chapter, elite, position) {
      chapter = chapterId(chapter);
      const key = chapter + ':' + String(enemyId), seed = hash(key + ':' + type + ':' + lootSeed);
      const uid = 'drop-' + key;
      if(options.groundLoot&&(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z)))return [];
      if (state.inventory.some(i => i.uid === uid) || state.groundLoot.some(i => i.uid === uid)) return [];
      let id;
      const signature = boss ? bossSignatures[chapter] : bossSignatures[type];
      if(signature) { id=signatureClaims[key] || signature.find(id=>!lootIdentities.has(id)); if(!id)return []; signatureClaims[key]=id; }
      else {
        if (seed % 100 >= (elite ? LOOT_ELITE : LOOT_NORMAL) && lootDry < LOOT_PITY) { lootDry++; return []; }
        id = lootPick(chapter, elite, seed, (hash(key + ':craft:' + lootSeed) % 5) - 2);
        if (!id) return [];   // nothing useful left to offer: no drop, the pity counter keeps waiting
      }
      lootIdentities.add(id);lootSlots.push(catalog[id].slot);if(lootSlots.length>6)lootSlots.shift();
      lootDry = 0; lootSeen.push(chapter + ':' + id); if (lootSeen.length > 40) lootSeen.shift();
      const roll = signature ? 0 : (hash(key + ':craft:' + lootSeed) % 5) - 2;
      if (options.groundLoot) {
        // Ground-loot games never bypass pickup by inserting a reward straight into the bag.
        if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return [];
        const entry = {uid,id,roll,x:position.x,z:position.z,chapter,boss:!!signature};
        state.groundLoot.push(entry); changed('lootDrop', {items:[entry],boss:!!boss,chapter}); return [entry];
      }
      const entry = addItem(id, uid, roll); changed('loot', { items: [entry], boss: !!boss, chapter }); return [entry];
    }
    function grantEnemy(enemyId, type, boss, chapter, difficulty, elite, position) {
      chapter = chapterId(chapter);
      if (enemyId === null || enemyId === undefined || String(enemyId).length > 200) return { xp: 0, levels: 0, items: [], duplicate: true };
      const key = chapter + ':' + String(enemyId);
      if (rewards[key]) return { xp: 0, levels: 0, items: [], duplicate: true };
      rewards[key] = true;
      const before = state.xp, oldLevel = state.level;
      // Difficulty changes combat, never asks the player to farm longer for the same active skills.
      let gain = boss ? (chapter === 4 ? 550 : chapter === 3 ? 400 : chapter === 2 ? 360 : 110) : chapter === 4 ? (type === 'ashwarden' ? 160 : 80 + hash(key + type) % 13) : chapter === 3 ? (type === 'ruinwarden' ? 120 : 60 + hash(key + type) % 13) : chapter === 2 ? 45 + hash(key + type) % 13 : XP[type] || 22;
      if (elite && !boss && type !== 'ruinwarden' && type !== 'ashwarden') gain = Math.round(gain * 1.6);
      state.xp = Math.min(THRESHOLDS[MAX_LEVEL - 1], state.xp + gain);
      if (boss) state.xp = Math.max(state.xp, THRESHOLDS[MILESTONES[chapter - 1] - 1]);
      recalculate();
      const dropped = loot(enemyId, type, boss, chapter, elite || type === 'ruinwarden' || type === 'ashwarden', position);
      const reward = { xp: state.xp - before, levels: state.level - oldLevel, items: dropped, duplicate: false,
        level: state.level, points: state.points, enemyId: String(enemyId), chapter };
      changed('progression', reward); return reward;
    }
    function collectLoot(uid) {
      const n = state.groundLoot.findIndex(i => i.uid === uid);
      if (n < 0) return null;
      const drop = state.groundLoot.splice(n,1)[0], entry = addItem(drop.id,drop.uid,drop.roll);
      changed('loot', {items:[entry],boss:drop.boss,chapter:drop.chapter}); return entry;
    }
    function completedChapter(chapter) {
      if (chapter !== 1 && chapter !== 2 && chapter !== 3 && chapter !== 4) return false;
      if (!state.completed.includes(chapter)) state.completed.push(chapter);
      state.xp = Math.max(state.xp, THRESHOLDS[MILESTONES[chapter - 1] - 1]); recalculate();
      // A hurried chapter transition must not destroy the promised signature reward.
      const carried=state.groundLoot.filter(i=>i.chapter===chapter&&signatureIds.has(i.id));
      for(const drop of carried)if(!state.inventory.some(i=>i.uid===drop.uid))addItem(drop.id,drop.uid,0);
      state.groundLoot = state.groundLoot.filter(i => i.chapter !== chapter);
      if(carried.length)changed('loot',{items:carried,boss:true,chapter,transition:true});
      state.chapter = Math.min(4, chapter + 1); changed(); return true;
    }
    Object.assign(state, { snapshot, restore, grantEnemy, unlock, assign, equip, stats, loot, completedChapter, reset, refund, respec,
      skillForSlot: slot => { const s = skillIndex[state.loadout[slot]] || null; return s && B.TalentTree ? B.TalentTree.effective(s, state.learned) : s; },
      collectLoot, unequip, isUpgrade,
      itemForSlot: slot => { const entry = state.inventory.find(i => i.uid === state.equipment[slot]); return resolveItem(entry); },
      nextLevelXp: () => state.level < MAX_LEVEL ? THRESHOLDS[state.level] : null });
    reset(); state.chapter = chapterId(options.chapter); if (options.profile) restore(options.profile);
    return state;
  }
  B.Progression = Object.freeze({ create, skills, lines: LINES, skillsByLine, skillFacts, skillAccess, SKILL_TREE, items, catalog, bossSignatures, qualities, resolveItem, slots, MAX_LEVEL, VERSION, thresholds: THRESHOLDS, earnedPoints: POINTS, milestones: MILESTONES });
}());
