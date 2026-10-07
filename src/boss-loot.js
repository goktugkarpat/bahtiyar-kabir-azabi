/* KABİR AZABI — boss loot tables (ajan: bossloot).
   Loaded BEFORE progression.js (it publishes BABA.BossLootSpecs: item rows in the item() argument order, and
   BABA.BossLootTables: which boss / warden owns which iconic items). Every item below drops ONLY from its own boss:
   progression.js excludes them from the general picker, and loot() asserts it. Powers live in gear-powers.js,
   meshes in gear-weapons.js / gear-armor.js (rarity 'boss' = unique look), icons in assets/equipment/boss-thumbnails.js.
   Every visible string is registered in both languages through L(tr, en) into KabirI18n.dictionary. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {};
  var I = window.KabirI18n, DICT = I && I.dictionary;
  function L(tr, en) { if (DICT && en && !DICT[tr]) DICT[tr] = en; return I ? I.t(tr) : tr; }

  // ---- bosses and wardens: key = chapter number (chapter boss) or enemy type (warden), as used by progression.js bossSignatures.
  // crest: small emblem on the item card; the FIRST id of a table is the signature (guaranteed on the first kill).
  var BOSSES = {
    1: { tr: 'Zincir Celladı', trFrom: 'Zincir Celladı’ndan', en: 'Chain Executioner', crest: 'chain', ids: ['executioner-axe', 'rusted-mail-chest', 'headsman-hood', 'hook-chain-gauntlets'] },
    2: { tr: 'Derinliklerin Çancısı', trFrom: 'Derinliklerin Çancısı’ndan', en: 'Bellringer of the Depths', crest: 'bell', ids: ['bell-spear', 'drowned-clapper-axe', 'bellringer-bronze-chest', 'drowned-ringer-helm', 'tide-chain-boots'] },
    3: { tr: 'Oyukların Kralı', trFrom: 'Oyukların Kralı’ndan', en: 'King of the Hollows', crest: 'crown', ids: ['hollow-crown-blade', 'hollow-scepter-spear', 'king-ossuary-chest', 'hollow-king-spurs'] },
    ruinwarden: { tr: 'Harabe Muhafızı', trFrom: 'Harabe Muhafızı’ndan', en: 'Ruin Warden', crest: 'visor', ids: ['warden-chainmail', 'warden-verdict-helm', 'warden-iron-claws'] },
    4: { tr: 'Ocağın Kalbi', trFrom: 'Ocağın Kalbi’nden', en: 'Heart of the Furnace', crest: 'flame', ids: ['furnace-oath-axe', 'heart-forged-sword', 'anvil-heart-chest', 'furnace-heart-helm', 'cinder-breath-boots'] },
    ashwarden: { tr: 'Külün Baş Muhafızı', trFrom: 'Külün Baş Muhafızı’ndan', en: 'High Warden of Ash', crest: 'visor', ids: ['ash-warden-chest', 'ash-warden-grasp', 'ash-warden-greaves'] },
    5: { tr: 'Kara Kadı', trFrom: 'Kara Kadı’dan', en: 'Black Qadi', crest: 'scales', ids: ['last-verdict-blade', 'black-gavel-axe', 'qadi-black-robe', 'qadi-iron-turban'] },
    verdictwarden: { tr: 'Hüküm Bekçisi', trFrom: 'Hüküm Bekçisi’nden', en: 'Verdict Warden', crest: 'visor', ids: ['verdict-warden-helm', 'verdict-warden-chest', 'verdict-warden-boots'] }
  };
  var SOURCE_TR_EN = {};   // 'Zincir Celladı’ndan' -> 'From the Chain Executioner'
  var sourceOf = {};       // item id -> boss key
  Object.keys(BOSSES).forEach(function (key) {
    var b = BOSSES[key];
    SOURCE_TR_EN[b.trFrom] = 'From the ' + b.en;
    L(b.trFrom, 'From the ' + b.en);
    b.ids.forEach(function (id) { sourceOf[id] = key; });
  });
  L('Boss ganimeti', 'Boss loot');
  L('Yalnız bu düşmandan düşer', 'Drops only from this foe');

  // [id, name, slot, level, rarity, damage, defense, hp, type, description, modelId, finish]   (modelId = fitted core or the weapon's own mesh id)
  var SPECS = [
    // ---- Chapter I — Zincir Celladı
    ['rusted-mail-chest', L('Celladın Paslı Zırhı', 'The Executioner’s Rusted Mail'), 'chest', 4, 'boss', 0, .075, 3, null,
      L('Celladın boynundaki zincirlerden örülmüş ağır halkalar. Her halkada bir ismin paslı izi var.', 'Heavy rings woven from the chains about the executioner’s neck. Each link bears the rusted trace of a name.'), 'chainmail-chest', 'rust'],
    ['headsman-hood', L('Celladın Kara Başlığı', 'The Headsman’s Black Hood'), 'head', 4, 'boss', 0, .045, 4, null,
      L('Kütüğün başında kararmış kalın bir başlık. Kimsenin yüzünü hatırlamaz.', 'A thick hood blackened at the block. It remembers no one’s face.'), 'buried-hood', 'blood'],
    ['hook-chain-gauntlets', L('Kanca Zincirli Eldivenler', 'Hook-Chain Gauntlets'), 'hands', 4, 'boss', 0, .045, 2, null,
      L('Bileklerinden sarkan zincirlerin ucunda eski kancalar var. Tutunduğunu bırakmaz.', 'Old hooks hang from the chains at the wrists. Whatever they catch, they do not release.'), 'chain-gloves', 'rust'],
    // ---- Chapter II — Derinliklerin Çancısı
    ['drowned-clapper-axe', L('Boğulmuş Çan Dili', 'The Drowned Clapper'), 'weapon', 7, 'boss', .17, 0, 2, 'axe',
      L('Çancının kendi çan dilinden dövülmüş balta. Çan çoktan sustu; ağırlığı kaldı.', 'An axe beaten from the ringer’s own clapper. The bell fell silent; the weight remained.'), 'drowned-clapper-axe', 'brine'],
    ['bellringer-bronze-chest', L('Çancının Bronz Zırhı', 'The Bellringer’s Bronze Cuirass'), 'chest', 7, 'boss', 0, .105, 3, null,
      L('Derinlikte yeşile dönmüş bronz plakalar. Tuz içlerinden akmış, ama çatlatamamış.', 'Bronze plates turned green in the deep. Salt ran through them but never cracked them.'), 'coast-chest', 'brine'],
    ['drowned-ringer-helm', L('Boğulmuş Çancının Yüzü', 'Face of the Drowned Ringer'), 'head', 7, 'boss', 0, .075, 3, null,
      L('Siperinin ardında yutulmuş bir çığlık kalmış. Tuz hâlâ kemirir.', 'A swallowed scream remains behind the visor. The salt still gnaws at it.'), 'bell-helm', 'brine'],
    ['tide-chain-boots', L('Gelgit Zincirinin Adımları', 'Steps of the Tide Chain'), 'boots', 7, 'boss', 0, .075, 2, null,
      L('Bileklerinde kopmuş bir çapa zinciri sallanır. Dibe çekilen her adımı geri alır.', 'A snapped anchor chain swings at the ankles. It takes back every step the deep pulled down.'), 'shackle-boots', 'brine'],
    // ---- Chapter III — Oyukların Kralı
    ['hollow-scepter-spear', L('Oyuk Kralının Kemik Asası', 'The Hollow King’s Bone Scepter'), 'weapon', 10, 'boss', .235, 0, 2, 'spear',
      L('Tahtın önünde taşınan uzun kemik asa. Tacı boş kalmış, ama hâlâ bir ordu yönetecek kadar ağır.', 'The long bone scepter once borne before the throne. Its crown is empty, yet it is still heavy enough to command an army.'), 'hollow-scepter-spear', 'bone'],
    ['king-ossuary-chest', L('Kralın Kemik Zırhı', 'The King’s Ossuary Plate'), 'chest', 10, 'boss', 0, .13, 3, null,
      L('Oyukta ölen kralların kaburgalarından örülmüş göğüslük. Her kemik bir hükümdarın son nefesini tutar.', 'A cuirass woven from the ribs of kings who died in the hollow. Each bone holds a ruler’s last breath.'), 'rib-chest', 'bone'],
    ['hollow-king-spurs', L('Oyuk Kralının Mahmuzları', 'The Hollow King’s Spurs'), 'boots', 10, 'boss', 0, .09, 3, null,
      L('Taht odasının taşını çizmiş altın mahmuzlar. Artık hiçbir ata binmez; yalnız yürür.', 'Gold spurs that scored the throne room’s stone. They ride no horse now; they only walk.'), 'crown-boots', 'bone'],
    ['warden-iron-claws', L('Muhafızın Demir Pençeleri', 'The Warden’s Iron Claws'), 'hands', 8, 'boss', 0, .09, 2, null,
      L('Harabe kapısını kırmak için dökülmüş kalın pençeler. Kapı yıkıldı, pençeler durdu.', 'Thick claws cast to break the ruin’s gate. The gate fell; the claws stayed.'), 'claw-gauntlets', 'bone'],
    // ---- Chapter IV — Ocağın Kalbi
    ['heart-forged-sword', L('Kalbin Döküm Kılıcı', 'Heartforged Blade'), 'weapon', 12, 'boss', .28, 0, 3, 'sword',
      L('Ocağın kalbinde bir kez kızarmış, bir daha soğumamış kılıç. Sapı elini yakmaz; yalnız hatırlatır.', 'A blade that reddened once in the furnace’s heart and never cooled. Its hilt does not burn the hand; it only reminds it.'), 'heart-forged-sword', 'blood'],
    ['anvil-heart-chest', L('Örs Kalbinin Zırhı', 'Anvil-Heart Plate'), 'chest', 12, 'boss', 0, .15, 3, null,
      L('Dev örsün kırılan parçasından dövülmüş göğüslük. Her darbeyi hatırlar, hiçbirini geri vermez.', 'A cuirass hammered from a broken piece of the great anvil. It remembers every blow and returns none.'), 'warden-chest', 'rust'],
    ['furnace-heart-helm', L('Ocak Kalbinin Siperi', 'Visor of the Furnace Heart'), 'head', 12, 'boss', 0, .105, 3, null,
      L('Gözlerin arkasında hâlâ bir kor dönüyor. Bakışı eritir, vazgeçmez.', 'An ember still turns behind the eyes. Its gaze melts and does not relent.'), 'furnace-mask', 'blood'],
    ['cinder-breath-boots', L('Köz Soluğunun Adımları', 'Steps of the Cinder Breath'), 'boots', 12, 'boss', 0, .11, 3, null,
      L('Tabanlarında kömür tozu, ağızlarında körük sesi. Sıcak tabanlı kimse üşümez.', 'Coal dust in the soles, the sound of bellows in the throats. Whoever walks on warm soles never feels the cold.'), 'crown-boots', 'ash'],
    ['ash-warden-greaves', L('Kül Muhafızının Kaval Zırhı', 'The Ash Warden’s Greaves'), 'boots', 11, 'boss', 0, .105, 2, null,
      L('Nöbet boyunca hiç oturmayan bir muhafızın demir kavalları. Külün içinde bile ayakta kalır.', 'Iron greaves of a warden who never sat during his watch. They stand even in the ash.'), 'shackle-boots', 'ash'],
    // ---- Chapter V — Kara Kadı
    ['black-gavel-axe', L('Kara Tokmak', 'The Black Gavel'), 'weapon', 13, 'boss', .32, 0, 4, 'axe',
      L('Kürsüye vurularak binlerce hüküm veren ağır tokmak balta. Tek bir sanığı bile bağışlamadı.', 'The heavy gavel-axe that pronounced a thousand sentences on the bench. It spared not one defendant.'), 'black-gavel-axe', 'blood'],
    ['qadi-black-robe', L('Kadı’nın Kara Cübbesi', 'The Black Qadi’s Robe'), 'chest', 13, 'boss', 0, .155, 6, null,
      L('Hüküm okurken giyilen ağır cübbe. Kıvrımlarında dört efendinin mührü kurumuş.', 'The heavy robe worn when reading a verdict. The seals of four masters have dried in its folds.'), 'brigandine-chest', 'blood'],
    ['qadi-iron-turban', L('Kadı’nın Demir Sarığı', 'The Qadi’s Iron Turban'), 'head', 13, 'boss', 0, .11, 5, null,
      L('Sarığın demir katları hüküm kadar ağır. Altındaki baş hiç eğilmedi.', 'The turban’s iron folds weigh as much as a verdict. The head beneath it never bowed.'), 'warden-crown', 'ash'],
    ['verdict-warden-boots', L('Hüküm Bekçisinin Zincirli Adımları', 'The Verdict Warden’s Chained Steps'), 'boots', 13, 'boss', 0, .115, 4, null,
      L('Her adımda bir mahkûmu kürsüye çeken zincirler. Zincirler şimdi boş.', 'Chains that dragged a prisoner to the bench with every step. The chains are empty now.'), 'shackle-boots', 'blood']
  ];

  // Small crest emblems (24x24, stroke only) shown on the item card; own vectors, no textures.
  var CREST = {
    chain: '<ellipse cx="8" cy="9" rx="5" ry="3.2" transform="rotate(-35 8 9)"/><ellipse cx="16" cy="15" rx="5" ry="3.2" transform="rotate(-35 16 15)"/>',
    bell: '<path d="M12 3c-3 0-5 3-5 7v4l-2 3h14l-2-3v-4c0-4-2-7-5-7Zm-2 17a2 2 0 0 0 4 0"/>',
    crown: '<path d="M3 18 4 8l5 4 3-7 3 7 5-4 1 10Z"/>',
    flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 2 3-5Z"/>',
    scales: '<path d="M12 3v17M6 21h12M4 7h16M4 7 1.5 14a3 3 0 0 0 5 0Zm16 0-2.5 7a3 3 0 0 0 5 0Z"/>',
    visor: '<path d="M5 21V10c0-6 14-6 14 0v11l-4-3-3 3-3-3Zm2-9h3m4 0h3"/>'
  };
  function crestSvg(id) {
    var key = sourceOf[id]; if (!key) return '';
    return '<svg class="cd-crest" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + CREST[BOSSES[key].crest] + '</svg>';
  }

  var signatures = {}, order = [];
  Object.keys(BOSSES).forEach(function (key) { signatures[key] = Object.freeze(BOSSES[key].ids.slice()); order.push(key); });

  B.BossLootSpecs = SPECS;
  B.BossLootTables = { signatures: Object.freeze(signatures), bosses: BOSSES, sourceOf: sourceOf, order: order, extraChance: Object.freeze([35, 10]) };
  B.BossLoot = {
    sourceOf: function (id) { return sourceOf[id] || null; },
    // 'Zincir Celladı’ndan' / 'From the Chain Executioner' for the item card (empty for items without a boss).
    sourceText: function (id) { var k = sourceOf[id]; return k ? (I ? I.t(BOSSES[k].trFrom) : BOSSES[k].trFrom) : ''; },
    crest: crestSvg,
    // Card line: crest + source + "only from this foe".
    cardLine: function (id) {
      var text = B.BossLoot.sourceText(id); if (!text) return '';
      return '<div class="cd-source">' + crestSvg(id) + '<span>' + text + '</span><em>' + (I ? I.t('Yalnız bu düşmandan düşer') : '') + '</em></div>';
    }
  };
}());
