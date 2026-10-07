/* KABİR AZABI — side, hidden and campaign-story quests (ajan: quests).
   Loaded BEFORE progression.js (it publishes BABA.QuestItemSpecs, the quest-only unique items) and before quests.js,
   which calls BABA.QuestSide.create(...) and owns persistence, prompts and the shared prop kit.
   Every visible string is registered in both languages through L(tr, en) into KabirI18n.dictionary.
   Kinds (three optional threads per chapter): hunt (named mini-boss promoted from an existing foe), rescue (living captive follows you to the oath stone),
   lore (three Ledger pages per chapter). Older saves may still list removed threads (altar, siege, escape, puzzle, chest, hunt2): restore() ignores unknown ids.
   Site ids follow STORY.md: world.questSites['c1.hunt'] = {x, z} overrides the room fallback. */
(function () {
  'use strict';
  var B = window.BABA = window.BABA || {}, T = window.THREE, PI = Math.PI, RANGE = 2.35;
  var I = window.KabirI18n, DICT = I && I.dictionary;
  function L(tr, en) { if (DICT && en && !DICT[tr]) DICT[tr] = en; return I ? I.t(tr) : tr; }
  B.QuestText = L;

  // ---------------------------------------------------------------- unique quest items (never dropped at random)
  // [id, name, slot, level, rarity, damage, defense, hp, type, description, modelId, finish]
  B.QuestItemSpecs = [
    ['shroud-needle-grasp', L('Kefen Dokuyucunun İğneleri', 'The Shroud Weaver’s Needles'), 'hands', 3, 'boss', 0, .04, 3, null, L('Parmak uçlarına kemik iğneler dikilmiş eldivenler. Dokuyucu bunlarla canlıların kefenini dikerdi.', 'Gloves with bone needles sewn into the fingertips. The weaver stitched shrouds for the living with them.'), 'chain-gloves', 'ash'],
    ['blood-price-blade', L('Kan Bedeli', 'Blood Price'), 'weapon', 3, 'boss', .115, 0, 0, 'sword', L('Sunağa akan kanla bilenmiş kılıç. Ödenen bedeli her darbede hatırlatır.', 'A blade honed on blood poured over the altar. Every blow recalls the price you paid.'), 'grave-sword', 'blood'],
    ['scribe-clasp-helm', L('Kâtibin Mühürlü Başlığı', 'The Scribe’s Sealed Hood'), 'head', 4, 'boss', 0, .05, 3, null, L('Mahkeme kâtiplerinin başlığı. İç astarına yüzlerce ad işlenmiş; hepsi senin el yazın.', 'The hood of the court scribes. Hundreds of names are stitched into its lining, all in your hand.'), 'iron-helm', 'rust'],
    ['salt-oath-steps', L('Tuz Yeminlisinin Adımları', 'Steps of the Salt-Sworn'), 'boots', 6, 'boss', 0, .06, 3, null, L('Tuza gömülü bir nöbetçinin çizmeleri. Deniz onları hiç ıslatamadı.', 'Boots of a sentry buried in salt. The sea never managed to soak them.'), 'tide-boots', 'brine'],
    ['drowned-bargain-spear', L('Dönmeyenlerin Pazarlığı', 'The Bargain of the Unreturned'), 'weapon', 7, 'boss', .195, 0, 0, 'spear', L('Denizden kana karşılık alınmış mızrak. Ucunda hâlâ birinin son nefesi asılı.', 'A spear bought from the sea with blood. Someone’s last breath still hangs on its point.'), 'bone-spear', 'brine'],
    ['keeper-salt-coat', L('Fenercinin Tuzlu Kaftanı', 'The Keeper’s Salted Coat'), 'chest', 6, 'boss', 0, .085, 5, null, L('Batık sandıktan çıkan kaftan. Cebinde, Selvi’yi taşıyan teknenin kaydı var.', 'A coat from the sunken chest. In its pocket, the log of the boat that carried Selvi.'), 'coast-chest', 'brine'],
    ['blind-seer-gaze', L('Kör Kehanetin Gözü', 'Eye of the Blind Prophecy'), 'head', 9, 'boss', 0, .08, 3, null, L('Ulvi’nin miğferi. Göz yarıkları mühürlü; yine de içinden geleceği görürsün.', 'Ulvi’s helm. Its eye slits are sealed, yet through it you see what comes.'), 'drowned-helm', 'ash'],
    ['kings-cup-axe', L('Kralın Kadehi', 'The King’s Cup'), 'weapon', 9, 'boss', .24, 0, 0, 'axe', L('Kadehin altından dökülmüş balta. İçen her kral gibi, o da susuzluğunu hiç gidermez.', 'An axe cast from the cup’s gold. Like every king who drank, its thirst is never quenched.'), 'executioner-axe', 'ash'],
    ['royal-scribe-gauntlets', L('Saray Kâtibinin Eldivenleri', 'Gauntlets of the Court Scribe'), 'hands', 9, 'boss', 0, .075, 3, null, L('Kralın kâtibine verdiği demir eldivenler. Mürekkep lekesi demirin içine işlemiş.', 'Iron gloves the king gave his scribe. The ink stain has soaked into the metal.'), 'salt-gauntlets', 'bone'],
    ['ash-vizier-robe', L('Kül Vezirinin Cübbesi', 'Robe of the Ash Vizier'), 'chest', 11, 'boss', 0, .13, 4, null, L('Kadı’ya giden yol cübbenin astarına dikilmiş. Kül hiç dökülmüyor.', 'The road to the Judge is stitched into the lining. The ash never falls away.'), 'grave-chest', 'ash'],
    ['bloody-anvil-sword', L('Kanlı Örsün Kılıcı', 'Sword of the Bloody Anvil'), 'weapon', 12, 'boss', .29, 0, 0, 'sword', L('Senin kanınla soğutulan çelik. Ocak sönse de bu kılıç sıcak kalır.', 'Steel quenched in your own blood. The furnace may die; this blade stays warm.'), 'grave-sword', 'blood'],
    ['selvi-last-road', L('Selvi’nin Son Yolu', 'Selvi’s Last Road'), 'boots', 11, 'boss', 0, .09, 4, null, L('Selvi’nin halkasıyla birlikte saklanan çizmeler. Tabanında bir çocuğun çizdiği yol haritası var.', 'Boots kept beside Selvi’s ring. A child’s drawing of a road is scratched into the sole.'), 'tide-boots', 'bone'],
    ['weaver-apprentice-wraps', L('Çırağın Kanlı Makarası', 'The Apprentice’s Bloody Spool'), 'hands', 4, 'boss', 0, .035, 5, null, L('Çırağın parmaklarına sardığı kefen ipliği. Hâlâ ılık.', 'Shroud thread the apprentice wound around her fingers. Still warm.'), 'rag-wraps', 'blood'],
    ['crypt-walker-boots', L('Mühürlü Mahzenin Adımları', 'Steps of the Sealed Crypt'), 'boots', 4, 'boss', 0, .045, 3, null, L('Mahzenin tozunda iz bırakmayan çizmeler. Kâtiplerin gizli yolu için yapılmış.', 'Boots that leave no print in the crypt dust. Made for the scribes’ hidden road.'), 'grave-boots', 'ash'],
    ['tide-widow-helm', L('Dul Gelgitin Yüzü', 'Face of the Widowed Tide'), 'head', 7, 'boss', 0, .07, 3, null, L('Yeminlinin karısının tuzla dolmuş miğferi. Kocasını aramaktan hiç vazgeçmedi.', 'The Salt-Sworn’s wife’s salt-choked helm. She never stopped searching for him.'), 'drowned-helm', 'brine'],
    ['hidden-throne-chest', L('Gizli Tahtın Kefeni', 'Shroud of the Hidden Throne'), 'chest', 10, 'boss', 0, .115, 5, null, L('Kralın gizli odasında saklanan zırh. Göğsünde silinmiş bir ad var: kralın kendi adı.', 'Armor hidden in the king’s secret room. A scraped-away name on the breast: the king’s own.'), 'grave-chest', 'bone'],
    ['seer-echo-spear', L('Kehanetin Yankısı', 'Echo of the Prophecy'), 'weapon', 10, 'boss', .245, 0, 2, 'spear', L('Ulvi’nin öğrencisinin mızrağı. Ucu, saplanacağı yeri önceden bilir.', 'The spear of Ulvi’s pupil. Its point knows where it will strike before it is thrown.'), 'bone-spear', 'ash'],
    ['vizier-clerk-grasp', L('Hesap Kâtibinin Pençesi', 'The Tally Clerk’s Grasp'), 'hands', 12, 'boss', 0, .095, 4, null, L('Vezirin halka sayan kâtibinin demir eldiveni. Parmak boğumlarında sayılar kazılı.', 'The iron glove of the vizier’s link-counting clerk. Numbers are carved into its knuckles.'), 'chain-gloves', 'rust'],
    ['ink-headsman-helm', L('Mürekkep Cellatının Yüzü', 'Face of the Ink Headsman'), 'head', 12, 'boss', 0, .095, 5, null, L('Siyah mürekkeple kaplı ağır miğfer. Kesilen her ad, içinde bir damla bırakmış.', 'A heavy helm slick with black ink. Every name it cut left a drop inside.'), 'iron-helm', 'blood']
  ];

  // ---------------------------------------------------------------- common UI words
  var W = {
    hunt: L('Ad Avı', 'Named Hunt'), rescue: L('Kurtarma', 'Rescue'), lore: L('Kâtibin Sayfaları', 'The Scribe’s Pages'), main: L('Ana Hikâye', 'Main Story'),
    reward: L('Ödül: ', 'Reward: '), done: L('Tamamlandı', 'Complete'),
    guarded: L('Önce etraftaki ölüleri sustur', 'First silence the dead around you'),
    follow: L('Seni izliyor. Onu yemin taşına götür.', 'Following you. Lead them to the oath stone.'), waiting: L('Yakında düşman var; kurtardığın kişi siniyor.', 'Enemies are near; the one you freed cowers.'),
    point: L('+1 yetenek puanı', '+1 skill point'), flask: L('Kalıcı +1 şifa matarası', 'Permanent +1 healing flask'), hp: L('Kalıcı +6 can', 'Permanent +6 health'), dmg: L('Kalıcı +%3 hasar', 'Permanent +3% damage'),
    read: L('Sayfa okundu', 'Page read')
  };
  B.QuestWords = W;

  // ---------------------------------------------------------------- chapter data
  function page(site, name, text) { return { site: site, name: name, text: text }; }
  var SIDE = {
    1: [
      { id: 'c1-hunt', kind: 'hunt', site: 'c1.hunt', fallback: { room: 11, dx: 0, dz: 0 }, voice: 'hunt1',
        name: L('Kefen Dokuyucu', 'The Shroud Weaver'), target: { name: L('Kefen Dokuyucu', 'The Shroud Weaver'), types: ['guard'], scale: 2.4 },
        description: L('Kefen Dokuma Odası’nda biri hâlâ kefen dokuyor; ama ölüler için değil. Onu bul ve dokuduğu son kefeni ona giydir.', 'In the Shroud Weaving Room someone still weaves shrouds, but not for the dead. Find her and dress her in the last one.'),
        objective: L('Kefen Dokuma Odası’nda Kefen Dokuyucu’yu avla.', 'Hunt the Shroud Weaver in the Shroud Weaving Room.'),
        story: L('Kefen Dokuyucu düştü. Tezgâhında yarım kalmış bir kefen var; yakasına senin adın işlenmiş.', 'The Shroud Weaver has fallen. On her loom lies an unfinished shroud with your name stitched at the collar.'),
        reward: { item: 'shroud-needle-grasp', xp: 60 }, rewardText: L('Kefen Dokuyucunun İğneleri (Eşsiz eldiven)', 'The Shroud Weaver’s Needles (Unique gloves)') },
      { id: 'c1-rescue', kind: 'rescue', site: 'c1.captive', goal: 'c1.rescue-goal', fallback: { room: 10, dx: 3, dz: -2 }, voice: 'rescue1',
        name: L('Son Nefesteki Derviş', 'The Dying Dervish'), npc: L('Derviş Ömer', 'Dervish Ömer'),
        description: L('Yitik Etler Reviri’nde zincirli bir adam hâlâ nefes alıyor. Zincirini çöz ve onu Sessiz Şapel’in yemin taşına götür.', 'In the Ward of Lost Flesh a chained man still breathes. Break his chain and lead him to the oath stone of the Silent Chapel.'),
        objective: L('Yitik Etler Reviri’nde zincirli dervişi bul ve serbest bırak.', 'Find the chained dervish in the Ward of Lost Flesh and free him.'),
        follow: L('Derviş Ömer’i Sessiz Şapel’deki yemin taşına götür.', 'Lead Dervish Ömer to the oath stone in the Silent Chapel.'),
        freeStory: L('Derviş gözlerini açıyor ve seni tanıyor: “Adımı sen yazmıştın, kâtip.” Yine de uzattığın eli tutuyor.', 'The dervish opens his eyes and knows you: “You wrote my name, scribe.” Still, he takes the hand you offer.'),
        story: L('Derviş yemin taşının önünde diz çöküyor. Matarasını sana veriyor: “Benim için doldurma. Yazdığın diğerleri için doldur.”', 'The dervish kneels before the oath stone and hands you his flask: “Do not fill it for me. Fill it for the others you wrote.”'),
        reward: { flasks: 1, xp: 40 }, rewardText: L('Kalıcı +1 şifa matarası', 'Permanent +1 healing flask') },
      { id: 'c1-pages', kind: 'lore', voice: 'pages1', name: L('Kâtibin Yırtık Sayfaları · I', 'The Scribe’s Torn Pages · I'),
        description: L('Kara Defter’den koparılmış sayfalar tapınağa dağılmış. Hepsi senin el yazın.', 'Pages torn from the Black Ledger lie scattered through the temple. Every one is in your hand.'),
        objective: L('Tapınağın yan salonlarında Kara Defter’in yırtık sayfalarını topla.', 'Gather the Black Ledger’s torn pages in the temple’s side halls.'),
        story: L('Üç sayfa da senin el yazın. Son satırda mürekkebi hâlâ ıslak bir ad var: Selvi. Kız kardeşinin adı.', 'All three pages are in your hand. On the last line, its ink still wet, a name: Selvi. Your sister’s name.'),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin ilk parçası', '+1 skill point and the first piece of your past'),
        pages: [
          page('c1.page1', L('Sayfa: Hüküm Kâtibi', 'Page: The Scribe of Sentences'), L('“Yirminci yılımda kalemim titremeyi bıraktı. Her sabah Kadı’nın mührü gelir, ben adları yazarım. Ad yazıldığında zincir kendiliğinden dövülür. Ben yalnızca yazarım.” — B.', '“In my twentieth year my pen stopped trembling. Each morning the Judge’s seal arrives, and I write the names. Once written, the chain forges itself. I only write.” — B.')),
          page('c1.page2', L('Sayfa: Cellat’ın Payı', 'Page: The Executioner’s Share'), L('“Cellat bugün yine meyhanede bekledi. ‘Sen yazmasan ben kesmem,’ dedi. Güldük. O gece ellerimi üç kez yıkadım.” — B.', '“The executioner waited at the tavern again today. ‘If you didn’t write, I wouldn’t cut,’ he said. We laughed. That night I washed my hands three times.” — B.')),
          page('c1.page3', L('Sayfa: Yeni Ad', 'Page: A New Name'), L('“Mühür geldi. Altında tek bir ad var. Kalemi tuttum ve bekledim. Mürekkep kâğıda damladı. Ad: Selvi.” Sayfanın kenarı yırtılmış.', '“The seal came. Beneath it, a single name. I held the pen and waited. Ink dripped onto the paper. The name: Selvi.” The edge of the page is torn away.'))
        ], fallbacks: [{ room: 9, dx: 4, dz: 3 }, { room: 12, dx: -4, dz: 2 }, { room: 1, dx: -6, dz: -5 }] }
    ],
    2: [
      { id: 'c2-hunt', kind: 'hunt', site: 'c2.hunt', fallback: { room: 11, dx: 0, dz: 0 }, voice: 'hunt2',
        name: L('Tuz İçindeki Yeminli', 'The Salt-Sworn'), target: { name: L('Tuz İçindeki Yeminli', 'The Salt-Sworn'), types: ['urchin', 'drowned'], scale: 2.4 },
        description: L('Çürümüş Tersane’de Çancı’ya yemin etmiş bir nöbetçi dolaşıyor. Tuz onu çürütmemiş; korumuş.', 'In the Rotten Shipyard walks a sentry sworn to the Bellringer. The salt did not rot him; it preserved him.'),
        objective: L('Çürümüş Tersane’de Tuz İçindeki Yeminli’yi avla.', 'Hunt the Salt-Sworn in the Rotten Shipyard.'),
        story: L('Yeminli düştü. Tuz kabuğu çatlarken içinden paslı bir anahtar ve bir tekne kaydı çıkıyor: “Bir kız. Adı defterde var. Krala.”', 'The Salt-Sworn has fallen. As his crust of salt cracks, a rusted key and a boat log spill out: “One girl. Her name is in the Ledger. For the King.”'),
        reward: { item: 'salt-oath-steps', xp: 90 }, rewardText: L('Tuz Yeminlisinin Adımları (Eşsiz çizme)', 'Steps of the Salt-Sworn (Unique boots)') },
      { id: 'c2-rescue', kind: 'rescue', site: 'c2.captive', goal: 'c2.rescue-goal', fallback: { room: 9, dx: -3, dz: 3 }, voice: 'rescue2',
        name: L('Fenercinin Oğlu', 'The Keeper’s Son'), npc: L('Kerem', 'Kerem'),
        description: L('Kül Balıkçılarının Evleri’nde bir genç, tuza gömülmüş halde nefes alıyor. Babası Son Fener’in bekçisiydi.', 'In the Ash Fishers’ Houses a young man breathes, half buried in salt. His father kept the Last Lantern.'),
        objective: L('Kül Balıkçılarının Evleri’nde tuza gömülü genci kurtar.', 'Free the young man buried in salt in the Ash Fishers’ Houses.'),
        follow: L('Kerem’i Son Fener’deki yemin taşına götür.', 'Lead Kerem to the oath stone at the Last Lantern.'),
        freeStory: L('Tuzu ellerinle kazıyorsun. Kerem öksürerek doğruluyor: “Babam çanı çalarken ağlıyordu. Çalmazsa beni alacaklardı.”', 'You dig the salt away with your hands. Kerem sits up, coughing: “My father wept as he rang the bell. If he hadn’t, they would have taken me.”'),
        story: L('Kerem fenerin yemin taşına dokunuyor ve babasının adını fısıldıyor. Sana kalın bir tuz bezi sarıyor: “Deniz seni bir kez daha yutmasın.”', 'Kerem touches the lantern’s oath stone and whispers his father’s name. He wraps a thick salt cloth around you: “May the sea not swallow you again.”'),
        reward: { hp: 6, xp: 70 }, rewardText: L('Kalıcı +6 can', 'Permanent +6 health') },
      { id: 'c2-pages', kind: 'lore', voice: 'pages2', name: L('Kâtibin Yırtık Sayfaları · II', 'The Scribe’s Torn Pages · II'),
        description: L('Boğulanların cebinden, sokakların çamurundan Kara Defter’in sayfaları çıkıyor.', 'From the pockets of the drowned and the mud of the streets, pages of the Black Ledger surface.'),
        objective: L('Kıyıya dağılmış defter sayfalarını topla.', 'Gather the Ledger pages scattered along the shore.'),
        story: L('Son sayfada Selvi’nin el yazısı var: “Abi, adımı sen yazma.” Altında senin imzan duruyor.', 'The last page bears Selvi’s handwriting: “Brother, don’t you write my name.” Beneath it stands your signature.'),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin ikinci parçası', '+1 skill point and the second piece of your past'),
        pages: [
          page('c2.page1', L('Sayfa: Borç Ödendi', 'Page: Debt Paid'), L('“Kıyıdan yüz yirmi ad. Fenerci çanı çaldı, tekneler döndü ama içleri boştu. Deftere yazdım: borç ödendi.” — B.', '“One hundred and twenty names from the shore. The keeper rang the bell; the boats came back empty. I wrote in the Ledger: debt paid.” — B.')),
          page('c2.page2', L('Sayfa: Çancı’nın Mektubu', 'Page: The Bellringer’s Letter'), L('“Kâtip, Kral daha fazlasını istiyor. Kıyı boşaldı. Bana ad gönder; ben de sana ölü göndereyim.” Mühür: bir çan.', '“Scribe, the King wants more. The shore is empty. Send me names, and I will send you the dead.” Seal: a bell.')),
          page('c2.page3', L('Sayfa: Selvi', 'Page: Selvi'), L('“Abi, adımı sen yazma. Başkası yazsın, ama sen yazma. Ellerini tanırım.” Kâğıdın altında kurumuş bir gözyaşı izi ve senin imzan.', '“Brother, don’t you write my name. Let someone else write it, but not you. I know your hands.” Below, a dried tear stain, and your signature.'))
        ], fallbacks: [{ room: 10, dx: 5, dz: 3 }, { room: 3, dx: -6, dz: 5 }, { room: 12, dx: 5, dz: -4 }] }
    ],
    3: [
      { id: 'c3-hunt', kind: 'hunt', site: 'c3.hunt', fallback: { room: 8, dx: 0, dz: 0 }, voice: 'hunt3',
        name: L('Taht Kehanetçisi Ulvi', 'Ulvi, Seer of the Throne'), target: { name: L('Taht Kehanetçisi Ulvi', 'Ulvi, Seer of the Throne'), types: ['shardseer'], scale: 2.6 },
        description: L('Fısıltı Geçidi’nde kralın kör kehanetçisi dolaşıyor. Her kehaneti bir adın Defter’e yazılmasıyla bitmiş.', 'In the Whispering Pass walks the king’s blind seer. Every prophecy he spoke ended with a name written in the Ledger.'),
        objective: L('Fısıltı Geçidi’nde Taht Kehanetçisi Ulvi’yi avla.', 'Hunt Ulvi, Seer of the Throne, in the Whispering Pass.'),
        story: L('Ulvi diz çökerken gülüyor: “Son kehanetim senin için, kâtip: kendi adını kendi elinle yazacaksın.”', 'Ulvi laughs as he kneels: “My last prophecy is yours, scribe: you will write your own name with your own hand.”'),
        reward: { item: 'blind-seer-gaze', xp: 140 }, rewardText: L('Kör Kehanetin Gözü (Eşsiz miğfer)', 'Eye of the Blind Prophecy (Unique helm)') },
      { id: 'c3-rescue', kind: 'rescue', site: 'c3.captive', goal: 'c3.rescue-goal', fallback: { room: 4, dx: 4, dz: 3 }, voice: 'rescue3',
        name: L('Kör Taşçı', 'The Blind Mason'), npc: L('Hıdır', 'Hıdır'),
        description: L('Yemin Bozan Avlu’da gözleri oyulmuş bir taşçı zincirli. Defter’e yazılan adları mezar taşlarına o kazırdı.', 'In the Oathbreaker Court a mason with gouged eyes sits in chains. He carved every name from the Ledger onto gravestones.'),
        objective: L('Yemin Bozan Avlu’da kör taşçıyı bul ve zincirini çöz.', 'Find the blind mason in the Oathbreaker Court and break his chain.'),
        follow: L('Hıdır’ı Son Yemin taşına götür.', 'Lead Hıdır to the Last Oath stone.'),
        freeStory: L('Hıdır parmaklarıyla yüzüne dokunuyor: “Bu el yazısını taşa yüz kez kazıdım. Sen kâtipsin.” Yine de omzuna tutunuyor.', 'Hıdır touches your face with his fingers: “I carved this handwriting into stone a hundred times. You are the scribe.” Still, he takes your shoulder.'),
        story: L('Hıdır yemin taşına senin adını kazıyor, sonra keskisiyle üzerini çiziyor: “Taş seni tanımasın. Daha işin bitmedi.”', 'Hıdır carves your name into the oath stone, then strikes it through with his chisel: “Let the stone not know you. Your work is not done.”'),
        reward: { flasks: 1, xp: 120 }, rewardText: L('Kalıcı +1 şifa matarası', 'Permanent +1 healing flask') },
      { id: 'c3-pages', kind: 'lore', voice: 'pages3', name: L('Kâtibin Yırtık Sayfaları · III', 'The Scribe’s Torn Pages · III'),
        description: L('Kralın arşivinden kaçırılmış sayfalar harabelerin arasına gömülmüş.', 'Pages smuggled from the king’s archive lie buried among the ruins.'),
        objective: L('Harabelerdeki defter sayfalarını topla.', 'Gather the Ledger pages in the ruins.'),
        story: L('Bütün sayfaların altında aynı mühür var: ne kralın, ne çancının. Kara Kadı’nın mührü. Defter’i tutan el başka.', 'Every page bears the same seal: neither the king’s nor the bellringer’s. The Black Judge’s seal. Another hand holds the Ledger.'),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin üçüncü parçası', '+1 skill point and the third piece of your past'),
        pages: [
          page('c3.page1', L('Sayfa: Kralın Pazarlığı', 'Page: The King’s Bargain'), L('“Kral tahtı için adını sattı. Kadı adı aldı, Defter’in ilk satırına yazdı. O günden beri her kral bir mahkûm, her mahkûm bir halka.”', '“The king sold his name for the throne. The Judge took it and wrote it on the Ledger’s first line. Since that day every king is a prisoner, every prisoner a link.”')),
          page('c3.page2', L('Sayfa: Kâtibin Atanması', 'Page: The Scribe Appointed'), L('“Bahtiyar, oğlum. Kalemin temiz, aklın sessiz. Bundan sonra Defter senin elinde.” Altında kralın silik imzası.', '“Bahtiyar, my son. Your pen is clean, your mind quiet. From now on the Ledger is in your hand.” Beneath, the king’s faded signature.')),
          page('c3.page3', L('Sayfa: Kadı’nın Emri', 'Page: The Judge’s Order'), L('“Kâtip ad yazmayı reddederse, son satıra kendi adı yazılsın. Cellat onu diri gömsün; Defter beklemeyi bilir.” Mühür: kara bir göz.', '“Should the scribe refuse to write, let his own name fill the last line. Let the executioner bury him alive; the Ledger knows how to wait.” Seal: a black eye.'))
        ], fallbacks: [{ room: 1, dx: -7, dz: 4 }, { room: 6, dx: 7, dz: -3 }, { room: 10, dx: 6, dz: 4 }] }
    ],
    4: [
      { id: 'c4-hunt', kind: 'hunt', site: 'c4.hunt', fallback: { room: 4, dx: 0, dz: 0 }, voice: 'hunt4',
        name: L('Kül Veziri', 'The Ash Vizier'), target: { name: L('Kül Veziri', 'The Ash Vizier'), types: ['chainseer', 'emberbound'], scale: 2.6 },
        description: L('Kül Vezirinin Avlusu’nda ocağın hesabını tutan vezir hâlâ halka sayıyor. Kadı’ya giden yolu o biliyor.', 'In the Ash Vizier’s Court the vizier who keeps the furnace’s accounts still counts links. He knows the road to the Judge.'),
        objective: L('Kül Vezirinin Avlusu’nda Kül Veziri’ni avla.', 'Hunt the Ash Vizier in his court.'),
        story: L('Vezir düşüyor; cübbesinin astarına dikilmiş harita ocağın ardını gösteriyor: mürekkepten bir nehir ve sonsuz raflar.', 'The vizier falls; the map stitched into his robe shows what lies beyond the furnace: a river of ink and endless shelves.'),
        reward: { item: 'ash-vizier-robe', xp: 180 }, rewardText: L('Kül Vezirinin Cübbesi (Eşsiz zırh)', 'Robe of the Ash Vizier (Unique armor)') },
      { id: 'c4-rescue', kind: 'rescue', site: 'c4.captive', goal: 'c4.rescue-goal', fallback: { room: 3, dx: -4, dz: 3 }, voice: 'rescue4',
        name: L('Demirci Çırağı', 'The Smith’s Apprentice'), npc: L('Yusuf', 'Yusuf'),
        description: L('Kızgın Nakliye’de halka döven bir çırak hâlâ yaşıyor. Elleri zincire, zinciri örse bağlı.', 'In the Scorching Haul an apprentice who forges links is still alive. His hands are chained to the chain, the chain to the anvil.'),
        objective: L('Kızgın Nakliye’de demirci çırağını örsten çöz.', 'Free the smith’s apprentice from the anvil in the Scorching Haul.'),
        follow: L('Yusuf’u Köz Yemini taşına götür.', 'Lead Yusuf to the Ember Oath stone.'),
        freeStory: L('Yusuf titreyen ellerine bakıyor: “Bin halka dövdüm. Birinin üstünde kız kardeşinin adı vardı, kâtip. Onu ben dövdüm.”', 'Yusuf stares at his shaking hands: “I forged a thousand links. One bore your sister’s name, scribe. I forged it.”'),
        story: L('Yusuf yemin taşının közünde kılıcını yeniden döğüyor: “Bin halkanın bedeli bir kılıç ağzı olsun.”', 'Yusuf reforges your blade in the oath stone’s embers: “Let a thousand links be paid for with one edge.”'),
        reward: { damage: .03, xp: 160 }, rewardText: L('Kalıcı +%3 hasar', 'Permanent +3% damage') },
      { id: 'c4-pages', kind: 'lore', voice: 'pages4', name: L('Kâtibin Yırtık Sayfaları · IV', 'The Scribe’s Torn Pages · IV'),
        description: L('Ocağın hesap defterlerinden kurtulmuş, kenarları yanmış sayfalar.', 'Pages saved from the furnace’s ledgers, their edges burned.'),
        objective: L('Ocağın yanık defter sayfalarını topla.', 'Gather the furnace’s burned Ledger pages.'),
        story: L('Yanık sayfaların sonunda yalnız senin adın kalıyor: “Bahtiyar. Kâtip. Boş satır.” Mürekkep taze; biri hâlâ yazıyor.', 'At the end of the burned pages only your name remains: “Bahtiyar. Scribe. Empty line.” The ink is fresh; someone is still writing.'),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin dördüncü parçası', '+1 skill point and the fourth piece of your past'),
        pages: [
          page('c4.page1', L('Sayfa: Halka Hesabı', 'Page: The Link Account'), L('“Her ad bir halka, her halka bir gün ateş. Bu ay on bin halka. Kâtip yazmaya devam ettikçe ocak sönmez.”', '“Each name a link, each link a day of fire. Ten thousand links this month. As long as the scribe keeps writing, the furnace never dies.”')),
          page('c4.page2', L('Sayfa: Selvi’nin Halkası', 'Page: Selvi’s Link'), L('“Selvi adlı halka ocağa gelmedi. Kadı onu istedi: ‘Bu kız kâtibin el yazısını tanır. Yeni kâtibim o olacak.’”', '“The link named Selvi never reached the furnace. The Judge asked for her: ‘This girl knows the scribe’s handwriting. She will be my new scribe.’”')),
          page('c4.page3', L('Sayfa: Yanmış İtiraf', 'Page: A Burned Confession'), L('“Korktum. Mühür geldi, adını yazdım. Sonra Defter’i yakmaya kalktım; ama ad bir kere yazılmıştı.” Gerisi kül.', '“I was afraid. The seal came and I wrote her name. Then I tried to burn the Ledger, but the name was already written.” The rest is ash.'))
        ], fallbacks: [{ room: 1, dx: 7, dz: 4 }, { room: 6, dx: -7, dz: -3 }, { room: 8, dx: 6, dz: 4 }] }
    ],
    5: [
      { id: 'c5-rescue', kind: 'rescue', site: 'selvi-cell', goal: 'selvi-goal', requiresMain: 1, fallback: { index: .7 }, voice: null,
        name: L('Selvi’yi Eve Götür', 'Take Selvi Home'), npc: L('Selvi', 'Selvi'),
        description: L('Selvi serbest. Onu Kara Defter’in gölgesinden çıkar ve yemin taşına götür.', 'Selvi is free. Lead her out of the Black Ledger’s shadow to the oath stone.'),
        objective: L('Selvi’yi yemin taşına götür.', 'Lead Selvi to the oath stone.'), follow: L('Selvi’yi yemin taşına götür.', 'Lead Selvi to the oath stone.'),
        freeStory: L('Selvi senin arkandan yürüyor. Elinde hâlâ kalem var; bırakamıyor.', 'Selvi walks behind you. The pen is still in her hand; she cannot let it go.'),
        story: L('Selvi yemin taşına dokunuyor ve kalemi sonunda bırakıyor: “Abi, son satırı ben yazmayacağım. Sen de yazma.”', 'Selvi touches the oath stone and finally lets the pen fall: “Brother, I will not write the last line. Don’t you write it either.”'),
        reward: { flasks: 1, xp: 200 }, rewardText: L('Kalıcı +1 şifa matarası', 'Permanent +1 healing flask'), female: true },
      { id: 'c5-hunt', kind: 'hunt', site: 'c5.hunt', fallback: { index: .45 }, voice: 'hunt5',
        name: L('Mürekkep Cellatı', 'The Ink Headsman'), target: { name: L('Mürekkep Cellatı', 'The Ink Headsman'), types: [], scale: 2.6 },
        description: L('Arşivin koridorlarında Kadı’nın cellatı dolaşıyor. Kestiği her başı Defter’de bir satırın üstünü çizerek siliyor.', 'The Judge’s headsman walks the archive halls. Every head he takes, he erases by striking out a line in the Ledger.'),
        objective: L('Arşivde Mürekkep Cellatı’nı avla.', 'Hunt the Ink Headsman in the archive.'),
        story: L('Mürekkep Cellatı düştü. Kanı siyah değil; yalnızca mürekkep. Yere döküldükçe bir ad okunuyor: Bahtiyar.', 'The Ink Headsman has fallen. His blood is not black; it is only ink. As it spills, a name can be read: Bahtiyar.'),
        reward: { item: 'ink-headsman-helm', xp: 240 }, rewardText: L('Mürekkep Cellatının Yüzü (Eşsiz miğfer)', 'Face of the Ink Headsman (Unique helm)') },
      { id: 'c5-pages', kind: 'lore', voice: 'pages5', name: L('Kâtibin Yırtık Sayfaları · V', 'The Scribe’s Torn Pages · V'),
        description: L('Arşivin raflarında Defter’in kayıp son sayfaları saklı.', 'The Ledger’s lost final pages are hidden on the archive’s shelves.'),
        objective: L('Arşivdeki son defter sayfalarını topla.', 'Gather the last Ledger pages in the archive.'),
        story: L('Son sayfa: Selvi’nin adını yazan el titremiyor. O el senin. Korkudan yazdın, sonra yakmaya kalktın. Artık biliyorsun.', 'The last page: the hand that wrote Selvi’s name does not tremble. That hand is yours. You wrote it in fear, then tried to burn it. Now you know.'),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve gerçeğin son parçası', '+1 skill point and the last piece of the truth'),
        pages: [
          page('c5.page1', L('Sayfa: Kadı’nın Sabrı', 'Page: The Judge’s Patience'), L('“Kâtip öldü sanıyorlar. Ölmedi. Defter’in boş satırı onu çağırır. Geldiğinde kalemi kardeşi tutacak.”', '“They think the scribe is dead. He is not. The Ledger’s empty line calls him. When he comes, his sister will hold the pen.”')),
          page('c5.page2', L('Sayfa: Selvi’nin Günlüğü', 'Page: Selvi’s Diary'), L('“Her gece onun el yazısını taklit ediyorum. Kadı memnun. Abi, gelirsen beni tanıma. Ellerim artık seninkiler.”', '“Every night I copy his handwriting. The Judge is pleased. Brother, if you come, do not know me. My hands are yours now.”')),
          page('c5.page3', L('Sayfa: Son Satır', 'Page: The Last Line'), L('“Selvi.” Mürekkep düzgün, harfler sakin. Altında senin imzan. Bir satır aşağıda, boşluk: senin adın için.', '“Selvi.” The ink is even, the letters calm. Beneath, your signature. One line lower, an empty space: for your name.'))
        ], fallbacks: [{ index: .25 }, { index: .55 }, { index: .8 }] }
    ]
  };

  // Lines spoken by the narrator when the chapter story turns (keys recorded in narration-quests.js).
  var STORY_BEATS = { 1: { start: 'story1', boss: 'truth1' }, 2: { start: 'story2', boss: 'truth2' }, 3: { start: 'story3', boss: 'truth3' }, 4: { start: 'story4', boss: 'truth4' }, 5: { start: 'story5', boss: null } };

  // The campaign finale (chapter 5, after its master falls). Choice text varies with the pages read across the campaign.
  var FINALE = {
    title: L('Son satır', 'The last line'),
    question: L('Kadı düştü. Kara Defter açık, kalem elinde. Son satır hâlâ boş.', 'The Judge has fallen. The Black Ledger lies open, the pen in your hand. The last line is still empty.'),
    truth: L('Bütün sayfaları okudun: Selvi’nin adını sen yazdın. Kefaretin bedeli sensin.', 'You have read every page: you wrote Selvi’s name. The price of atonement is you.'),
    options: [
      { id: 'name', name: L('Adını son satıra yaz', 'Write your name on the last line'), effect: L('Bütün adlar özgür. Sen kabre dönersin.', 'Every name goes free. You return to the grave.'), voice: 'endingName',
        story: L('Adını son satıra yazıyorsun. Defter’deki bütün adlar soluk alıp kayboluyor. Zincirler düşerken toprak seni geri çağırıyor; bu kez korkmadan yatıyorsun. Selvi güneşe çıkıyor.', 'You write your name on the last line. Every name in the Ledger draws breath and fades. As the chains fall the earth calls you back, and this time you lie down without fear. Selvi walks into the sun.') },
      { id: 'burn', name: L('Defter’i yak', 'Burn the Ledger'), effect: L('Adlar yanar. Kimse kim olduğunu hatırlamaz.', 'The names burn. No one remembers who they were.'), voice: 'endingBurn',
        story: L('Defter’i yakıyorsun. Bütün adlar alevle birlikte göğe yükseliyor. Mahkûmlar özgür ama hiçbiri kim olduğunu hatırlamıyor. Selvi yüzüne bakıyor ve seni tanımıyor.', 'You burn the Ledger. Every name rises into the sky with the flames. The prisoners are free, but none of them remembers who they were. Selvi looks at your face and does not know you.') },
      { id: 'quill', name: L('Kalemi al', 'Take up the pen'), effect: L('Yeni Kadı sen olursun.', 'You become the new Judge.'), voice: 'endingQuill',
        story: L('Kalemi alıyorsun. Mürekkep elinin sıcaklığını tanıyor. Selvi’nin adını siliyorsun, sonra yeni bir sayfa açıyorsun. Kara Defter’in yeni Kadısı kabrinden hiç çıkmayacak.', 'You take up the pen. The ink knows the warmth of your hand. You erase Selvi’s name, then turn to a new page. The Black Ledger’s new Judge will never leave his grave.') }
    ]
  };

  // Verdict leanings change what the living say and how the story closes.
  var LEAN = {
    rescueMercy: L('Gözlerinde korku yok. Merhametinin adı ondan önce bu salonlara ulaşmış.', 'There is no fear in their eyes. Word of your mercy reached these halls before you did.'),
    rescueWrath: L('Seni görünce titriyor. Verdiğin hükümlerin sesi senden önce gelmiş; yine de elini tutuyor.', 'They tremble at the sight of you. The sound of your verdicts arrived first; still, they take your hand.'),
    epi: {
      name: [L('Mezarının başında Selvi her bahar bir ad okur: seninkini. Defter’de başka hiçbir ad kalmadı.', 'Each spring Selvi reads one name at your grave: yours. No other name remains in the Ledger.'),
             L('Kimse mezarına gelmez. Ama özgür kalan binlerce ad, toprağın altında bile seni tanır.', 'No one visits your grave. But the thousands of names set free know you, even beneath the earth.')],
      burn: [L('Kül rüzgârla dağılırken bir çocuk sana gülümsüyor. Kim olduğunu bilmiyor; yine de gülümsüyor.', 'As the ash drifts away a child smiles at you. She does not know who you are; she smiles all the same.'),
             L('Kül soğuyor. Hatırlanmayan bir dünyada tek hatırlayan sensin; ve bu, kabrin en ağır azabı.', 'The ash grows cold. In a world without memory you alone remember, and that is the grave’s heaviest torment.')],
      quill: [L('İlk sayfaya kendi kararlarını yazıyorsun: merhamet. Ama kalem bu kelimeyi tanımıyor; mürekkep kâğıtta tutmuyor.', 'On the first page you write your own verdict: mercy. But the pen does not know the word; the ink will not hold.'),
              L('İlk sayfaya bir ad yazıyorsun. Kalem titremiyor. Yirmi yıl önce de titremiyordu.', 'On the first page you write a name. The pen does not tremble. Twenty years ago it did not tremble either.')]
    }
  };

  // ---------------------------------------------------------------- engine
  function create(o) {
    var api = o.api, world = o.world, chapter = o.chapter, info = o.info, kit = o.kit, player = api.player;
    var defs = SIDE[chapter] || [], quests = [], nodes = [], disposed = false;
    var state = Object.create(null), local = { flaskDebt: 0, finale: null, beats: 0 };
    var timer = 0, beatClock = 0, bossSeen = false, followerActor = null, finaleOpen = false;
    function prog() { var g = B.app && B.app.game; return api.progression || (g && g.progression) || null; }
    function bump() { info.revision++; }
    function grant(key, reward) {
      var p = prog(); if (!p || !p.grantQuest || !reward) return null;
      var r = p.grantQuest('c' + chapter + ':' + key, reward);
      var g = B.app && B.app.game; if (r && (reward.hp || reward.damage) && g && g.syncProgression) g.syncProgression(false);
      return r;
    }
    function boons() { var p = prog(); return p && p.boons ? p.boons() : { points: 0, flasks: 0, hp: 0, damage: 0, claimed: [] }; }
    function say(key) { if (key && B.Audio && B.Audio.say) B.Audio.say(key); }
    function lineText(key) { var lines = KabirI18n.lang === 'en' ? B.NarrationEN : B.Narration; return lines && lines[key] ? lines[key].text : ''; }
    // Campaign leaning from every main-quest verdict so far: mercy (rest, break, free…) against judgment.
    function tally() {
      var v = boons().claimed.filter(function (k) { return k.indexOf(':verdict:') > 0; });
      var mercy = v.filter(function (k) { return /:(rest|break|silence|release|erase|open|free|starve|shelter)$/.test(k); }).length;
      return { mercy: mercy, wrath: v.length - mercy, total: v.length, lean: v.length < 2 ? '' : mercy >= v.length - mercy ? 'mercy' : 'wrath' };
    }
    var cinema = function () { return B.QuestCinema; };

    // ---- props (merged per material, like quests.js; no lights, no per-frame allocation)
    function prop(kind, x, y, z) {
      var g = new T.Group(), body = [], glowParts = [], lid = [], chains = [];
      g.position.set(x, y, z); g.matrixAutoUpdate = false; g.updateMatrix(); kit.root.add(g);
      var S = kit.stone, M = kit.metal, R = kit.trim, G = kit.glow, Wd = kit.wood, mt = kit.materials || {};
      var BLOOD = mt.blood || mt['coast-corpse-flesh'] || mt.lava || mt.hot || G, EMBER = mt.ember || mt.fire || mt.lava || mt.hot || mt.lamp || G;
      var PAPER = mt.shroud || mt.cloth || mt.pale || S, BONE = mt.bone || mt['coast-corpse-bone'] || S;
      g.scale.setScalar(1.3); g.updateMatrix();
      if (kind === 'page') {
        kit.box(body, Wd, .08, .9, .08, 0, .45, 0); kit.box(body, Wd, .5, .05, .5, 0, .02, 0, 0, PI / 4);
        kit.box(body, Wd, .62, .05, .46, 0, .93, 0, -.5); kit.box(body, R, .66, .025, .03, 0, .87, .2, -.5);
        kit.box(body, PAPER, .44, .012, .32, 0, .965, .01, -.5); kit.box(body, PAPER, .2, .01, .28, .12, .975, .02, -.5, .12);
        kit.cyl(body, mt.wax || PAPER, .035, .04, .16, .26, .99, -.14); kit.put(glowParts, EMBER, new T.ConeGeometry(.022, .07, 6), .26, 1.1, -.14);
        kit.box(glowParts, G, .3, .006, .2, -.02, .975, .03, -.5);
      } else if (kind === 'post') {
        kit.box(body, Wd, .2, 1.8, .2, 0, .9, 0); kit.box(body, M, .3, .08, .3, 0, 1.2, 0); kit.box(body, S, .7, .12, .7, 0, .06, 0);
        for (var l = 0; l < 6; l++) kit.ring(chains, M, .08, .02, .12 + l * .1, 1.1 - l * .16, .1, l % 2 ? PI / 2 : 0, 0, .7);
      }
      var parts = { group: g };
      if (body.length) kit.merge(body, g);
      if (chains.length) { var cg = new T.Group(); cg.matrixAutoUpdate = false; cg.updateMatrix(); g.add(cg); kit.merge(chains, cg); parts.chains = cg; }
      if (lid.length) { var lg = new T.Group(); lg.position.set(0, .5, -.29); lg.updateMatrix(); lg.matrixAutoUpdate = false; g.add(lg); kit.merge(lid, lg); parts.lid = lg; }
      if (glowParts.length) { var gg = new T.Group(); gg.matrixAutoUpdate = false; gg.updateMatrix(); g.add(gg); kit.merge(glowParts, gg); parts.glow = gg; }
      return parts;
    }
    function spot(site, fallback, avoid) {
      var p = o.placeSite(site, fallback || {}, avoid);
      return { x: p.x, z: p.z, y: world.effectHeightAt ? world.effectHeightAt(p.x, p.z, .65) + .018 : .065 };
    }
    function node(q, kind, site, fallback, extra) {
      var at = spot(site, fallback), parts = kind ? prop(kind, at.x, at.y, at.z) : null;
      var n = Object.assign({ id: site || q.def.id, quest: q, x: at.x, z: at.z, y: at.y, parts: parts, done: false }, extra || {});
      nodes.push(n); o.reserve(n.x, n.z); return n;
    }

    // ---- follower (rescued captive): an authored prisoner figure without weapon, or a hooded stand-in.
    function makeActor(def) {
      var actor = { x: 0, z: 0, face: 0, speed: 0, model: null, root: null, time: 0, cower: 0 };
      try {
        if (B.Models && B.Models.create) {
          // Only the active chapter's character bases are decoded: pick the most human figure this chapter owns.
          var types = B.Models.types || {}, active = B.ActiveChapter || chapter;
          var wish = [def.female ? 'selvi' : null, 'prisoner', 'gravemason', 'drowned', 'emberbound', 'cultist', 'ashbound', 'lantern', 'chainseer'].filter(Boolean);
          var pick = wish.find(function (t) { return types[t] && (types[t].chapter || 1) === active; }) || 'prisoner';
          actor.model = B.Models.create(pick); actor.root = actor.model.root;
          actor.root.traverse(function (n) { if (n.name === 'weapon') n.visible = false; });
          actor.root.scale.setScalar(def.female ? .9 : .97);
        }
      } catch (e) { console.warn('[quests] captive model', e && e.message); actor.model = null; actor.root = null; }
      if (!actor.root) {
        var parts = [], grp = new T.Group();
        kit.cyl(parts, kit.wood, .28, .18, 1.1, 0, .55, 0); kit.put(parts, kit.stone, new T.SphereGeometry(.16, 10, 8), 0, 1.25, 0); kit.merge(parts, grp); actor.root = grp;
      }
      actor.root.name = def.npc; kit.root.add(actor.root);
      // A pale oath ring under the living captive keeps them apart from the hostile dead that share their silhouette.
      var halo = [], hg = new T.Group(); kit.ring(halo, kit.glow, .55, .018, 0, .04, 0, PI / 2); kit.ring(halo, kit.glow, .7, .01, 0, .04, 0, PI / 2); kit.merge(halo, hg); actor.halo = hg; kit.root.add(hg);
      try {
        var mt2 = kit.materials || {}, lamp = [], shroud = [], lg2 = new T.Group(), sg = new T.Group(), EMB = mt2.ember || mt2.fire || mt2.lamp || mt2.hot || kit.glow;
        // A small hand lantern hangs from a pole over the shoulder; a pale shroud covers the head and back.
        kit.box(lamp, kit.wood, .035, 1.5, .035, .32, 1.0, -.12, .35, 0, -.2); kit.box(lamp, kit.metal, .16, .2, .16, .58, 1.55, .12); kit.put(lamp, EMB, new T.OctahedronGeometry(.08, 0), .58, 1.55, .12); kit.box(lamp, kit.metal, .2, .03, .2, .58, 1.67, .12);
        kit.merge(lamp, lg2); actor.root.add(lg2);
        var PALE = mt2.shroud || mt2.cloth || mt2.pale || kit.stone;
        kit.put(shroud, PALE, new T.ConeGeometry(.34, 1.1, 10, 1, true), 0, 1.25, -.08, -.12, 0, 0); kit.put(shroud, PALE, new T.SphereGeometry(.2, 10, 8, 0, PI * 2, 0, PI * .55), 0, 1.78, -.04);
        kit.merge(shroud, sg); sg.scale.set(1, 1, .8); actor.root.add(sg);
      } catch (err) { /* decorative only */ }
      return actor;
    }
    var pose = { time: 0, move: 0, attack: 0, dead: false, face: 0, phase: 'idle', action: '', actionProgress: 0, hurt: 0, block: false, dodge: 0, stagger: 0, beat: 0, beatTime: -1, leap: 0, lookYaw: undefined, fear: 0, deathKind: '', hitAngle: 0 };
    function animateActor(actor, dt) {
      actor.time += dt;
      actor.root.position.set(actor.x, world.heightAt ? world.heightAt(actor.x, actor.z) || 0 : 0, actor.z); actor.root.rotation.y = actor.face;
      if (actor.halo) { actor.halo.position.set(actor.x, actor.root.position.y, actor.z); actor.halo.visible = actor.root.visible; }
      if (actor.model && actor.model.animate) {
        pose.time = actor.time; pose.move = actor.speed; pose.face = actor.face; pose.fear = actor.cower; pose.phase = 'idle';
        try { actor.model.animate(dt, pose); } catch (e) { console.warn('[quests] captive pose', e && e.message); actor.model = null; }
      }
    }

    // Promote the named prey (also retried later if the foes were not yet spawned when the quest was built).
    function promote(q) {
      var def = q.def;
      var at = q.huntAt, best = null, bestD = Infinity;
      (api.enemies || []).forEach(function (e) {
        if (e.boss || e.reserve || e.huntQuest || e.type === 'ruinwarden' || e.type === 'ashwarden') return;
        // The named prey keeps its kind when one lives within ~45 m of its den; otherwise the nearest foe takes the name.
        var raw = Math.hypot(e.x - at.x, e.z - at.z), match = !def.target.types.length || def.target.types.indexOf(e.type) >= 0;
        var d = (match && raw < 45 ? raw : raw + 1000) * (e.elite ? .85 : 1);
        if (d < bestD) { bestD = d; best = e; }
      });
      if (!best) return false;
      best.huntQuest = def.id; best.name = def.target.name; best.elite = true;
      best.baseMaxHp = Math.round((best.baseMaxHp || best.maxHp) * def.target.scale); best.maxHp = Math.round(best.maxHp * def.target.scale); best.hp = best.maxHp;
      best.campaignDamage = (best.campaignDamage || 1) * 1.22; best.radius = (best.radius || .6) * 1.08;
      if (best.model && best.model.root) {
        best.model.root.scale.multiplyScalar(def.after ? 1.22 : 1.16);
        // A thin smouldering brand above the named prey: visible across a hall, never a light source.
        var mt = kit.materials || {}, brand = [], bg = new T.Group(), hgt = (best.model.height || 2.1) / 1.16 + .28;
        kit.ring(brand, mt.ember || mt.hot || mt.lava || mt.lamp || kit.glow, .3, .022, 0, hgt, 0, PI / 2);
        for (var sp2 = 0; sp2 < 6; sp2++) { var an2 = sp2 * PI / 3; kit.put(brand, mt.ember || mt.hot || mt.lava || mt.lamp || kit.glow, new T.ConeGeometry(.035, .16, 5), Math.sin(an2) * .3, hgt + .07, Math.cos(an2) * .3); }
        kit.merge(brand, bg); bg.name = 'hunt-brand'; best.model.root.add(bg); q.brand = bg;
      }
      q.enemy = best; return true;
    }
    // ---- quest markers: a low, dim ground sigil (one thin ring, four ticks and a small diamond on the edge that faces the camera) under the
    // nearest live objectives. No light pillar and no bloom: additive alpha <= .3, a slow breath, fading out with distance and while the hero stands on it.
    // Three pooled sets, one canvas texture, built once at setup (and drawn once by the warm-up); reduced motion holds the sigil still.
    var beacons = [], beaconTex = null, calmMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; return t; }
    function buildBeacons() {
      if (typeof document === 'undefined') return;
      beaconTex = canvasTex(256, 256, function (x, w) {
        x.translate(w / 2, w / 2); x.strokeStyle = '#fff'; x.fillStyle = '#fff';
        x.lineWidth = 3.5; x.beginPath(); x.arc(0, 0, 118, 0, PI * 2); x.stroke();
        x.globalAlpha = .5; x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, 104, 0, PI * 2); x.stroke();
        x.globalAlpha = .8; x.lineWidth = 2.5;
        for (var i = 0; i < 4; i++) { x.save(); x.rotate(i * PI / 2); x.beginPath(); x.moveTo(0, -104); x.lineTo(0, -88); x.stroke(); x.restore(); }
        x.globalAlpha = 1; x.beginPath(); x.moveTo(0, 101); x.lineTo(10, 118); x.lineTo(0, 135); x.lineTo(-10, 118); x.closePath(); x.fill();   // the small diamond, bottom edge = camera side
      });
      var geo = new T.PlaneGeometry(2.6, 2.6); geo.rotateX(-PI / 2);
      for (var b = 0; b < 3; b++) {
        var m = new T.MeshBasicMaterial({ map: beaconTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xb89150, opacity: 0, fog: false });
        var mesh = new T.Mesh(geo, m); mesh.renderOrder = 6; mesh.castShadow = false; mesh.visible = false; mesh.name = 'quest-sigil'; mesh.position.y = .05; kit.root.add(mesh);
        beacons.push({ mesh: mesh, mat: m, kind: '' });
      }
    }
    try { buildBeacons(); } catch (e) { console.warn('[quests] markers', e && e.message); beacons = []; }
    var KIND_COLOR = { main: 0xb89150, hunt: 0xa8624a, rescue: 0x8fa38c, lore: 0xb8a67c };
    var KIND_ALPHA = { main: .3, hunt: .24, rescue: .24, lore: .24 };
    var beaconClock = 0, beaconList = [];
    function updateBeacons(dt) {
      if (!beacons.length) return;
      beaconClock += dt;
      var list = beaconList; list.length = 0;
      (info.markers || []).forEach(function (m) { if (m.active && !m.complete) list.push({ x: m.x, z: m.z, kind: 'main', d: 0 }); });
      (info.side || []).forEach(function (e) { if (e.available && e.target && Number.isFinite(e.target.x) && e.kind !== 'hunt') list.push({ x: e.target.x, z: e.target.z, kind: e.kind, d: 0 }); });
      for (var k = 0; k < list.length; k++) list[k].d = Math.hypot(list[k].x - player.x, list[k].z - player.z);
      list = list.filter(function (t) { return t.d < 34; }).sort(function (a, b) { return a.d - b.d; });
      var breath = calmMotion.matches ? 1 : .86 + Math.sin(beaconClock * 1.4) * .14;
      for (var i = 0; i < beacons.length; i++) {
        var bc = beacons[i], t = list[i];
        if (!t) { if (bc.mesh.visible) bc.mesh.visible = false; continue; }
        var far = Math.min(1, (34 - t.d) / 12), nearK = .35 + .65 * Math.min(1, Math.max(0, (t.d - 2.2) / 4));
        bc.mesh.position.set(t.x, (world.effectHeightAt ? world.effectHeightAt(t.x, t.z, .65) : 0) + .05, t.z); bc.mesh.visible = true;
        if (bc.kind !== t.kind) { bc.kind = t.kind; bc.mat.color.setHex(KIND_COLOR[t.kind] || KIND_COLOR.main); }
        bc.mat.opacity = (KIND_ALPHA[t.kind] || .24) * far * nearK * breath;
      }
    }

    // ---- build quests
    defs.forEach(function (def, qi) {
      var q = { def: def, index: qi, nodes: [], entry: null };
      var entry = { id: def.id, kind: def.kind, kindName: W[def.kind], name: def.name, description: def.description, objective: def.objective,
        rewardText: def.rewardText || '', discovered: true, complete: false, progress: 0, total: 1, outcome: '', choice: null,
        pages: null, target: null, available: false };
      q.entry = entry; quests.push(q); state[def.id] = { stage: 0, bits: 0, choice: null, done: false, discovered: true };
      try {
        if (def.kind === 'hunt') {
          q.huntAt = spot(def.site, def.fallback); promote(q);
        } else if (def.kind === 'rescue') {
          q.captive = node(q, 'post', def.site, def.fallback, { verb: L('Zincirini çöz', 'Break the chain'), role: 'captive' });
          q.actor = makeActor(def); q.actor.x = q.captive.x + .55; q.actor.z = q.captive.z + .35; q.actor.face = 0;
          var goalAt = world.questSites && world.questSites[def.goal] ? world.questSites[def.goal] : world.checkpoint || { x: q.captive.x, z: q.captive.z };
          q.goal = { x: goalAt.x, z: goalAt.z };
        } else if (def.kind === 'lore') {
          entry.total = def.pages.length; entry.pages = [];
          def.pages.forEach(function (pg, i) { var n = node(q, 'page', pg.site, def.fallbacks[i], { verb: L('Sayfayı oku', 'Read the page'), role: 'page', page: i }); q.nodes.push(n); entry.pages.push({ name: pg.name, text: pg.text, found: false }); });
        }
      } catch (e) { console.warn('[quests] side quest disabled', def.id, e); q.disabled = true; }
      if (q.captive) q.nodes.push(q.captive);
    });
    quests = quests.filter(function (q) { return !q.disabled; });
    info.side = quests.map(function (q) { return q.entry; });
    info.sideMarkers = [];
    nodes.forEach(function (n) { n.marker = { id: n.id, side: n.quest.def.id, kind: n.quest.def.kind, name: n.quest.def.name, x: n.x, z: n.z, active: false, complete: false }; info.sideMarkers.push(n.marker); });
    quests.forEach(function (q) { if (q.enemy) { q.marker = { id: q.def.id, side: q.def.id, kind: 'hunt', name: q.def.target.name, x: q.enemy.x, z: q.enemy.z, active: true, complete: false, moving: true }; info.sideMarkers.push(q.marker); } });

    function mainDone(i) { return !!(info.entries[i] && info.entries[i].complete); }
    function refresh() {
      quests.forEach(function (q) {
        var s = state[q.def.id], e = q.entry, d = q.def;
        e.complete = s.done; e.discovered = true; e.choice = s.choice;
        if (d.kind === 'lore') { e.progress = 0; for (var i = 0; i < q.nodes.length; i++) { var got = !!(s.bits & (1 << i)); q.nodes[i].done = got; e.pages[i].found = got; if (got) e.progress++; } }
        else if (d.kind === 'rescue') { e.total = 2; e.progress = s.done ? 2 : s.stage >= 1 ? 1 : 0; }
        else e.progress = s.done ? 1 : 0;
        e.locked = !s.done && d.requiresMain != null && !mainDone(d.requiresMain);
        e.objective = s.done ? W.done : d.kind === 'rescue' && s.stage >= 1 ? d.follow : d.objective;
        e.available = !s.done && !e.locked;
        e.outcome = s.done ? d.story : '';
        e.target = null; e.urgent = '';
        q.nodes.forEach(function (n) {
          if (d.kind === 'rescue') n.done = s.stage >= 1 || s.done;
          n.marker.complete = n.done; n.marker.active = e.available && !n.done;
          if (!e.target && n.marker.active) e.target = n.marker;
          var pr = n.parts; if (!pr) return;
          if (pr.glow) pr.glow.visible = n.marker.active;
          if (d.kind === 'lore') pr.group.visible = !n.done;
          if (pr.chains) pr.chains.visible = !(d.kind === 'rescue' && (s.stage >= 1 || s.done));
        });
        if (q.marker) { q.marker.complete = s.done; q.marker.active = !s.done && !!q.enemy && !q.enemy.dead; if (q.marker.active) e.target = q.marker; }
        if (d.kind === 'rescue' && s.stage >= 1 && !s.done) e.target = { id: d.goal, name: d.npc, x: q.goal.x, z: q.goal.z, active: true };
        if (d.kind === 'rescue' && q.actor) q.actor.root.visible = !(d.requiresMain != null && !mainDone(d.requiresMain) && !s.stage);
      });
      bump();
    }
    function notify(q, text, complete) {
      api.emit('quest', { id: q.def.id, name: q.def.name, text: text, side: true, kind: q.def.kind, complete: !!complete, completed: info.completed, total: 2, step: q.entry.progress, steps: q.entry.total, choice: null });
    }
    function rewardLine(r) {
      if (!r) return '';
      var bits = [];
      (r.items || []).forEach(function (it) { var def = B.Progression && B.Progression.catalog[it.id]; if (def) bits.push(def.name); });
      if (r.points) bits.push(W.point); if (r.flasks) bits.push(W.flask);
      if (r.hp) bits.push((r.hp > 0 ? '+' : '') + r.hp + L(' kalıcı can', ' permanent health'));
      if (r.damage) bits.push((r.damage > 0 ? '+%' : '-%') + Math.round(Math.abs(r.damage) * 100) + L(' kalıcı hasar', ' permanent damage'));
      if (r.xp) bits.push('+' + r.xp + L(' tecrübe', ' experience'));
      return bits.length ? ' ' + W.reward + bits.join(' · ') : '';
    }
    function complete(q, story, rewardKey, reward) {
      var s = state[q.def.id]; s.done = true; refresh();
      var got = grant(rewardKey || q.def.id, reward || q.def.reward);
      if (api.onChange) api.onChange();
      notify(q, story + rewardLine(got), true);
      api.sound('sealOpen', { x: player.x, z: player.z });
      say(q.def.voice);
    }

    // ---- interaction
    function guarded(n, r) {
      var list = api.enemies || [];
      for (var i = 0; i < list.length; i++) { var e = list[i]; if (!e.dead && !e.reserve && Math.hypot(e.x - n.x, e.z - n.z) < r) return true; }
      return false;
    }
    var near = null, prompt = { id: '', text: '', name: '', quest: '', x: 0, z: 0, available: false, side: true };
    function scan() {
      near = null; var best = RANGE * RANGE;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i], q = n.quest, s = state[q.def.id]; if (n.done || s.done) continue;
        if (q.def.requiresMain != null && !mainDone(q.def.requiresMain)) continue;
        var dx = player.x - n.x, dz = player.z - n.z, d = dx * dx + dz * dz; if (d >= best) continue;
        if (world.hasClearPath && !world.hasClearPath(player.x, player.z, n.x, n.z, .25)) continue;
        near = n; best = d;
      }
      if (!near) return null;
      var qd = near.quest.def, blocked = '';
      if (qd.kind === 'rescue' && guarded(near, 9)) blocked = W.guarded;
      prompt.id = near.id; prompt.name = qd.name; prompt.quest = qd.name; prompt.x = near.x; prompt.z = near.z;
      prompt.available = !blocked; prompt.text = blocked || near.verb; prompt.distance = Math.sqrt(best);
      return prompt;
    }
    function interact() {
      if (disposed || player.dead) return false;
      var p = scan(); if (!p) return false;
      var n = near, q = n.quest, d = q.def, s = state[d.id];
      if (!p.available) { api.emit('toast', { text: p.text }); return true; }
      if (d.kind === 'lore') {
        s.bits |= 1 << n.page; refresh(); api.sound('sealOpen', { x: n.x, z: n.z });
        var count = 0; for (var i = 0; i < d.pages.length; i++) if (s.bits & (1 << i)) count++;
        var pg = d.pages[n.page];
        if (cinema()) cinema().reader({ title: pg.name, text: pg.text, note: count === d.pages.length ? d.story : count + ' / ' + d.pages.length + L(' sayfa bulundu.', ' pages found.') });
        if (count === d.pages.length) complete(q, d.story);
        else { if (api.onChange) api.onChange(); notify(q, pg.name + ' · ' + count + ' / ' + d.pages.length, false); }
        return true;
      }
      if (d.kind === 'rescue') {
        s.stage = 1; q.actor.x = n.x + .9; q.actor.z = n.z + .6; refresh(); if (api.onChange) api.onChange();
        var lean = tally().lean; notify(q, d.freeStory + (lean ? ' ' + (lean === 'mercy' ? LEAN.rescueMercy : LEAN.rescueWrath) : ''), false); api.sound('sealOpen', { x: n.x, z: n.z }); return true;
      }
      return false;
    }
    function choose(questId, optionId) {
      var pending = info.pendingChoice; if (!pending || !pending.side || pending.questId !== questId) return false;
      return pending.finale ? chooseFinale(optionId) : false;
    }

    // ---- finale (chapter 5, after the master falls)
    function openFinale() {
      if (finaleOpen || local.finale) return; finaleOpen = true;
      var b = boons(), pages = b.claimed.filter(function (k) { return /:c\d-pages$/.test(k); }).length, truth = pages >= 5;
      var opts = FINALE.options.map(function (x) { return x.id === 'name' && truth ? Object.assign({}, x, { effect: FINALE.truth }) : x; });
      var verdicts = b.claimed.filter(function (k) { return k.indexOf(':verdict:') > 0; });
      var mercy = verdicts.filter(function (k) { return /:(rest|break|silence|release|erase|open|free|starve|shelter)$/.test(k); }).length, wrath = verdicts.length - mercy;
      var tally = verdicts.length ? ' ' + L('Yol boyunca verdiğin hükümler: merhamet ', 'The verdicts you gave along the way: mercy ') + mercy + L(' · yargı ', ' · judgment ') + wrath + '.' : '';
      info.pendingChoice = { questId: 'finale', nodeId: 'finale', title: FINALE.title, question: FINALE.question + tally, options: opts, side: true, finale: true };
      bump(); api.emit('questChoice', info.pendingChoice);
    }
    function chooseFinale(optionId) {
      var opt = FINALE.options.find(function (x) { return x.id === optionId; }); if (!opt) return false;
      local.finale = optionId; info.pendingChoice = null; info.finale = { id: optionId, name: opt.name, story: opt.story };
      grant('finale:' + optionId, { xp: 1 }); bump(); if (api.onChange) api.onChange();
      api.emit('quest', { id: 'finale', name: FINALE.title, text: opt.story, side: true, kind: 'main', complete: true, completed: info.completed, total: 2, step: 1, steps: 1, choice: optionId });
      say(opt.voice);
      var t = tally(), extra = LEAN.epi[optionId] ? LEAN.epi[optionId][t.mercy >= t.wrath ? 0 : 1] : '';
      var parts = opt.story.replace(/([.!?”])\s+/g, '$1\n').split('\n'), paras = [];
      for (var pi = 0; pi < parts.length; pi += 2) paras.push(parts.slice(pi, pi + 2).join(' '));
      if (extra) paras.push(extra);
      if (cinema()) setTimeout(function () { cinema().epilogue({ id: optionId, title: opt.name, paragraphs: paras, tally: L('Merhamet ', 'Mercy ') + t.mercy + ' · ' + L('Yargı ', 'Judgment ') + t.wrath }); }, 1200);
      return true;
    }

    // ---- per-frame
    function updateFollower(q, dt) {
      var a = q.actor, s = state[q.def.id]; if (!a) return;
      var active = s.stage >= 1 && !s.done;
      if (active) {
        var tx = player.x - Math.sin(player.face || 0) * 1.7, tz = player.z - Math.cos(player.face || 0) * 1.7;
        if (world.isWalkable && !world.isWalkable(tx, tz, .35)) { tx = player.x; tz = player.z; }
        var gap = Math.hypot(tx - a.x, tz - a.z), threat = guarded(a, 6.5);
        a.cower = threat ? Math.min(1, a.cower + dt * 3) : Math.max(0, a.cower - dt * 2);
        // Walk the navigation graph like the foes do; a captive left far behind (or wedged) catches up out of sight.
        a.repath = (a.repath || 0) - dt;
        if (a.repath <= 0 && gap > 1.1) { a.repath = .4; a.route = world.pathTo ? world.pathTo({ x: a.x, z: a.z }, { x: tx, z: tz }, .4) : [{ x: tx, z: tz }]; a.leg = 0; }
        // Progress watchdog: if the gap has not shrunk for 2.5 s (door, ledge, odd nav cell), step in behind the hero.
        if (gap <= 3 || a.best === undefined || gap < a.best - .3) { a.best = gap; a.stuck = 0; } else a.stuck = (a.stuck || 0) + dt;
        if (gap > 22 || a.stuck > 2.5 || gap > 6 && !(a.route && a.route.length)) { a.x = tx; a.z = tz; gap = 0; a.route = null; a.stuck = 0; a.best = undefined; }
        var wp = a.route && a.route[a.leg || 0];
        while (wp && Math.hypot(wp.x - a.x, wp.z - a.z) < .25 && a.leg < a.route.length - 1) wp = a.route[++a.leg];
        var dx = wp ? wp.x - a.x : 0, dz = wp ? wp.z - a.z : 0, dist = Math.hypot(dx, dz);
        var want = threat || gap < 1.1 ? 0 : Math.min(6.4, 1.8 + gap * 1.4);
        a.speed += (want - a.speed) * Math.min(1, dt * 6);
        if (a.speed > .05 && dist > .01) {
          var step = Math.min(dist, a.speed * dt); a.x += dx / dist * step; a.z += dz / dist * step;
          a.face = Math.atan2(dx, dz);
        } else if (gap < 3) a.face = Math.atan2(player.x - a.x, player.z - a.z);
        if (Math.hypot(a.x - q.goal.x, a.z - q.goal.z) < 4.6 && Math.hypot(player.x - q.goal.x, player.z - q.goal.z) < 7) {
          s.stage = 2; a.speed = 0; a.face = Math.atan2(q.goal.x - a.x, q.goal.z - a.z); complete(q, q.def.story);
        }
      } else a.speed = 0;
      var vis = Math.abs(player.x - a.x) < 34 && Math.abs(player.z - a.z) < 34 && a.root.visible !== false;
      if (vis) animateActor(a, dt);
    }
    function update(dt) {
      if (disposed) return;
      var dirty = false;
      // Flask capacity: permanent quest boons minus the blood debt a pre-trim save may still carry (the altar threads were removed).
      if (player.baseFlasks === undefined) player.baseFlasks = player.maxFlasks || 4;
      // talent tree 3 (talent-tree.js): Fazla Matara +1, Kan Yemini carries none at all
      var tp = prog(), tf = window.BABA.TalentTree && tp && tp.learned ? window.BABA.TalentTree.effects(tp.learned).flasks : 0;
      var want = tf <= -50 ? 0 : Math.max(1, Math.min(8, player.baseFlasks + (boons().flasks || 0) - local.flaskDebt + tf));
      if (player.maxFlasks !== want) { if (want > player.maxFlasks) player.flasks = (player.flasks || 0) + (want - player.maxFlasks); player.maxFlasks = want; player.flasks = Math.min(player.flasks, want); }
      for (var i = 0; i < quests.length; i++) {
        var q = quests[i], s = state[q.def.id];
        if (q.def.kind === 'hunt' && !q.enemy && !s.done) { q.retry = (q.retry || 0) - dt; if (q.retry <= 0) { q.retry = 2; if (promote(q)) { q.marker = { id: q.def.id, side: q.def.id, kind: 'hunt', name: q.def.target.name, x: q.enemy.x, z: q.enemy.z, active: false, complete: false, moving: true }; info.sideMarkers.push(q.marker); dirty = true; } } }
        if (q.def.kind === 'hunt' && q.enemy) {
          if (q.marker && !q.enemy.dead) { q.marker.x = q.enemy.x; q.marker.z = q.enemy.z; }
          if (!s.done && !q.sighted && !q.enemy.dead && Math.hypot(q.enemy.x - player.x, q.enemy.z - player.z) < 16) { q.sighted = true; api.emit('toast', { text: W.hunt + ': ' + q.def.target.name + L(' yakında. Ondan kaçma.', ' is near. Do not run from it.') }); }
          if (!s.done && q.enemy.dead) complete(q, q.def.story);
        }
        if (q.def.kind === 'rescue') updateFollower(q, dt);
        if (q.def.kind === 'rescue' && q.def.requiresMain != null && !s.stage && mainDone(q.def.requiresMain)) { s.stage = 1; q.actor.x = q.captive.x + .9; q.actor.z = q.captive.z + .6; dirty = true; }
      }
      // Story beats: a recollection once the first calm minute passes, and the master's last words when it falls.
      beatClock += dt;
      var beats = STORY_BEATS[chapter];
      if (beats && !(local.beats & 1) && beatClock > 40) { local.beats |= 1; say(beats.start); }
      var gm = B.app && B.app.game;
      if (!(local.beats & 4) && beatClock > 4.5 && gm && gm.state === 'playing' && !gm.checkpointIndex && (gm.elapsed || 0) < 20) {
        local.beats |= 4; if (cinema()) cinema().letterbox({ eyebrow: L('Bölüm ', 'Chapter ') + ['I', 'II', 'III', 'IV', 'V'][chapter - 1] + (chapter === 5 ? ' · ' + info.title : ''), title: chapter === 5 ? L('Son Mahkeme', 'The Last Court') : info.title, text: info.introduction, seconds: chapter === 5 ? 13 : 11 });   // V: one name (ajan:chapter5); the quest arc is the subtitle
      }
      if (!(local.beats & 8) && beatClock > 95 && chapter >= 2) { var tl = tally().lean; if (tl) { local.beats |= 8; say(tl === 'mercy' ? 'leanMercy' : 'leanWrath'); } }
      var g = B.app && B.app.game, boss = g && (g.boss || (g.enemies || []).find(function (e) { return e.boss; }));
      if (boss && boss.dead && !bossSeen) {
        bossSeen = true;
        if (beats && beats.boss && !(local.beats & 2)) { local.beats |= 2; say(beats.boss); if (cinema()) cinema().letterbox({ eyebrow: boss.name || '', title: L('Son söz', 'Last words'), text: lineText(beats.boss), seconds: 10 });
          // The chapter card that follows quotes the master's last words.
          var lw = lineText(beats.boss), tries = 0;
          if (lw && typeof document !== 'undefined') (function stamp() {
            ['#victory .end-quote', '#chapter-fade .end-quote'].forEach(function (sel) { var el = document.querySelector(sel); if (el && el.textContent.indexOf(lw) < 0) { var q2 = document.createElement('span'); q2.className = 'qc-lastwords'; q2.textContent = '“' + lw + '”'; el.appendChild(q2); } });
            if (++tries < 40) setTimeout(stamp, 400);
          })(); }
        if (chapter === 5) setTimeout(openFinale, 4800);   // ajan:chapter5: the Qadi's fall (slow motion, light burst) plays before the last decision
      }
      updateBeacons(dt);
      timer -= dt; if (dirty || timer <= 0) { timer = .5; refresh();
        // Far props leave the render traversal (same 32 m window as the main quest props).
        for (var c = 0; c < nodes.length; c++) { var pr = nodes[c].parts; if (!pr) continue; var near = Math.abs(player.x - nodes[c].x) < 32 && Math.abs(player.z - nodes[c].z) < 30;
          var keep = near && !(nodes[c].quest.def.kind === 'lore' && nodes[c].done); if (pr.group.visible !== keep) pr.group.visible = keep; }
      }
    }
    function snapshot() {
      var out = { v: 1, flaskDebt: local.flaskDebt, finale: local.finale, beats: local.beats, q: {} };
      quests.forEach(function (q) { var s = state[q.def.id]; out.q[q.def.id] = [s.stage, s.bits, s.choice, s.done ? 1 : 0, 1]; });
      return out;
    }
    function restore(saved) {
      local.flaskDebt = 0; local.finale = null; local.beats = 0; finaleOpen = false;
            quests.forEach(function (q) { state[q.def.id] = { stage: 0, bits: 0, choice: null, done: false, discovered: true }; });
      if (saved && saved.v === 1 && saved.q) {
        local.flaskDebt = Math.max(0, Math.min(2, saved.flaskDebt | 0)); local.finale = typeof saved.finale === 'string' ? saved.finale : null; local.beats = saved.beats | 0;
        quests.forEach(function (q) {
          var r = saved.q[q.def.id]; if (!Array.isArray(r)) return;
          var s = state[q.def.id]; s.stage = Math.max(0, Math.min(2, r[0] | 0)); s.bits = (r[1] | 0) & 7; s.choice = typeof r[2] === 'string' ? r[2] : null; s.done = !!r[3]; s.discovered = true;
          if (q.actor && s.stage === 1 && !s.done) { q.actor.x = player.x + 1.2; q.actor.z = player.z + 1.2; }
          if (q.actor && s.done) { q.actor.x = q.goal.x + 1.4; q.actor.z = q.goal.z + 1.1; }
        });
      }
      if (local.finale) { var f = FINALE.options.find(function (x) { return x.id === local.finale; }); if (f) info.finale = { id: f.id, name: f.name, story: f.story }; }
      quests.forEach(function (q) { if (q.actor) { q.actor.root.position.set(q.actor.x, 0, q.actor.z); } });
      refresh();
    }
    function dispose() { disposed = true; if (beaconTex) beaconTex.dispose(); beacons.forEach(function (b) { b.mat.dispose(); b.mesh.geometry.dispose(); }); quests.forEach(function (q) { if (q.actor && q.actor.root) q.actor.root.removeFromParent(); }); }
    quests.forEach(function (q) { if (q.actor) animateActor(q.actor, 0); });
    refresh();
    // QA hook: BABA.QuestSide.debug() lists live quest actors and states (no gameplay effect).
    B.QuestSide.debug = function () { return quests.map(function (q) { var s = state[q.def.id]; return { id: q.def.id, stage: s.stage, done: s.done, actor: q.actor ? { x: +q.actor.x.toFixed(2), z: +q.actor.z.toFixed(2), visible: q.actor.root.visible, model: !!q.actor.model } : null, goal: q.goal || null }; }); };
    return { scan: scan, interact: interact, choose: choose, update: update, snapshot: snapshot, restore: restore, dispose: dispose, openFinale: openFinale,
      get count() { return quests.length; } };
  }

  B.QuestSide = { VERSION: 1, chapters: SIDE, finale: FINALE, create: create, L: L };
})();
