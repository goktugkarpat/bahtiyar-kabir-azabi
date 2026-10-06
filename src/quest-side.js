/* KABİR AZABI — side, hidden and campaign-story quests (ajan: quests).
   Loaded BEFORE progression.js (it publishes BABA.QuestItemSpecs, the quest-only unique items) and before quests.js,
   which calls BABA.QuestSide.create(...) and owns persistence, prompts and the shared prop kit.
   Every visible string is registered in both languages through L(tr, en) into KabirI18n.dictionary.
   Kinds: hunt (named mini-boss promoted from an existing foe), rescue (living captive follows you to the oath stone),
   lore (three Ledger pages per chapter), altar (hidden blood-price choice), chest (opened with the hunt's key).
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
    ['ink-headsman-helm', L('Mürekkep Cellatının Yüzü', 'Face of the Ink Headsman'), 'head', 12, 'boss', 0, .095, 5, null, L('Siyah mürekkeple kaplı ağır miğfer. Kesilen her ad, içinde bir damla bırakmış.', 'A heavy helm slick with black ink. Every name it cut left a drop inside.'), 'iron-helm', 'blood']
  ];

  // ---------------------------------------------------------------- common UI words
  var W = {
    hunt: L('Ad Avı', 'Named Hunt'), rescue: L('Kurtarma', 'Rescue'), lore: L('Kâtibin Sayfaları', 'The Scribe’s Pages'), altar: L('Kan Bedeli', 'Blood Price'), siege: L('Hayatta Kal', 'Survive'), wave: L('Dalga ', 'Wave '), survive: L(' · hayatta kal', ' · survive'), chest: L('Zincirli Sandık', 'Chained Chest'), main: L('Ana Hikâye', 'Main Story'),
    reward: L('Ödül: ', 'Reward: '), done: L('Tamamlandı', 'Complete'), secret: L('Gizli', 'Hidden'),
    guarded: L('Önce etraftaki ölüleri sustur', 'First silence the dead around you'), locked: L('Zincirli. Anahtarı bu bölümün av hedefi taşıyor.', 'Chained shut. This chapter’s hunted foe carries the key.'),
    follow: L('Seni izliyor. Onu yemin taşına götür.', 'Following you. Lead them to the oath stone.'), waiting: L('Yakında düşman var; kurtardığın kişi siniyor.', 'Enemies are near; the one you freed cowers.'),
    point: L('+1 yetenek puanı', '+1 skill point'), flask: L('Kalıcı +1 şifa matarası', 'Permanent +1 healing flask'), hp: L('Kalıcı +6 can', 'Permanent +6 health'), dmg: L('Kalıcı +%3 hasar', 'Permanent +3% damage'),
    found: L('Gizli bir şey buldun', 'You found something hidden'), keyGot: L('Bir anahtar düştü', 'A key fell'), read: L('Sayfa okundu', 'Page read')
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
        story: L('Kefen Dokuyucu düştü. Tezgâhında yarım kalmış bir kefen var; yakasına senin adın işlenmiş. Göğsünden paslı bir anahtar kaydı.', 'The Shroud Weaver has fallen. On her loom lies an unfinished shroud with your name stitched at the collar. A rusted key slips from her chest.'),
        reward: { item: 'shroud-needle-grasp', xp: 60 }, rewardText: L('Kefen Dokuyucunun İğneleri (Eşsiz eldiven) ve Kırık Yeminler’deki sandığın anahtarı', 'The Shroud Weaver’s Needles (Unique gloves) and the key to the chest in Broken Oaths') },
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
        ], fallbacks: [{ room: 9, dx: 4, dz: 3 }, { room: 12, dx: -4, dz: 2 }, { room: 1, dx: -6, dz: -5 }] },
      { id: 'c1-altar', kind: 'altar', site: 'c1.altar', fallback: { room: 4, dx: 5.5, dz: 4 }, hidden: true, voice: 'altar1',
        name: L('Kan Sunağı', 'The Blood Altar'), description: L('Kemik Geçidi’nin kenarında hâlâ sıcak bir sunak. Kan isteyen her şey gibi bedel bekliyor.', 'At the edge of the Bone Passage, an altar still warm. Like everything that thirsts, it waits for a price.'),
        objective: L('Kan Sunağı’na dokun ve bedeli seç.', 'Touch the Blood Altar and choose the price.'),
        verdict: { title: L('Kanın bedeli', 'The price of blood'), question: L('Sunak bu bölüm boyunca bir şifa matarasını istiyor. Karşılığında kanla bilenmiş bir kılıç verecek.', 'For the rest of this chapter the altar demands one of your healing flasks. In return it offers a blade honed in blood.'), options: [
          { id: 'pay', name: L('Kanını sun', 'Offer your blood'), effect: L('Bu bölümde 1 şifa matarası eksik. Kazanç: Kan Bedeli (Eşsiz kılıç).', 'One less healing flask this chapter. Gain: Blood Price (Unique sword).'), story: L('Avucunu sunağa bastırıyorsun. Taş kanını içiyor ve içinden ince, kızıl bir kılıç yükseliyor.', 'You press your palm to the altar. The stone drinks your blood and a thin crimson blade rises from it.'), cost: { flaskDebt: 1 }, reward: { item: 'blood-price-blade' } },
          { id: 'refuse', name: L('Sunağı reddet', 'Refuse the altar'), effect: L('Bedel yok, ödül yok. Sunak soğuyor.', 'No price, no reward. The altar cools.'), story: L('Elini geri çekiyorsun. Yirmi yıl başkalarının kanını yazdın; bu kez kendi kanın sende kalıyor.', 'You draw your hand back. For twenty years you wrote other men’s blood; this time yours stays with you.'), reward: { xp: 30 } }
        ] } },
      { id: 'c1-siege', kind: 'siege', site: 'c1.siege', fallback: { room: 9, dx: -6, dz: -4 }, waves: [3, 3, 4], verbTr: 'Mangalı yak',
        name: L('Kül Rahiplerinin Ayini', 'The Ash Priests’ Rite'), verb: L('Mangalı yak', 'Light the brazier'),
        description: L('İsimsizlerin Mezarı’nda sönmüş bir mangal duruyor. Yakarsan, tapınağın rahipleri ayinlerini bölen kâtibi cezalandırmaya gelir.', 'In the Grave of the Nameless stands a cold brazier. Light it, and the temple’s priests will come to punish the scribe who broke their rite.'),
        objective: L('Mangalı yak ve üç dalga boyunca hayatta kal.', 'Light the brazier and survive three waves.'),
        story: L('Son rahip mangalın küllerine düşüyor. Ateş artık kimseyi çağırmıyor; yalnızca seni ısıtıyor.', 'The last priest falls into the brazier’s ashes. The fire calls no one now; it only warms you.'),
        reward: { hp: 6, xp: 80 }, rewardText: L('Kalıcı +6 can', 'Permanent +6 health') },
      { id: 'c1-chest', kind: 'chest', site: 'c1.chest', fallback: { room: 12, dx: 5, dz: -3 }, key: 'c1-hunt', voice: null,
        name: L('Kâtiplerin Zincirli Sandığı', 'The Scribes’ Chained Chest'), description: L('Kırık Yeminler salonunda zincirle bağlanmış bir sandık. Anahtarı Kefen Dokuyucu taşıyor.', 'A chest bound in chains in the hall of Broken Oaths. The Shroud Weaver carries its key.'),
        objective: L('Kefen Dokuyucu’nun anahtarıyla Kırık Yeminler’deki sandığı aç.', 'Open the chest in Broken Oaths with the Shroud Weaver’s key.'),
        story: L('Sandıkta mahkeme kâtiplerinin başlığı var. Astarına işlenen yüzlerce adın arasında seninki yok; onun için ayrı bir yer bırakılmış.', 'Inside lies the hood of the court scribes. Among the hundreds of names in its lining yours is missing; a space has been left for it.'),
        reward: { item: 'scribe-clasp-helm', xp: 40 }, rewardText: L('Kâtibin Mühürlü Başlığı (Eşsiz başlık)', 'The Scribe’s Sealed Hood (Unique hood)') }
    ],
    2: [
      { id: 'c2-hunt', kind: 'hunt', site: 'c2.hunt', fallback: { room: 11, dx: 0, dz: 0 }, voice: 'hunt2',
        name: L('Tuz İçindeki Yeminli', 'The Salt-Sworn'), target: { name: L('Tuz İçindeki Yeminli', 'The Salt-Sworn'), types: ['urchin', 'drowned'], scale: 2.4 },
        description: L('Çürümüş Tersane’de Çancı’ya yemin etmiş bir nöbetçi dolaşıyor. Tuz onu çürütmemiş; korumuş.', 'In the Rotten Shipyard walks a sentry sworn to the Bellringer. The salt did not rot him; it preserved him.'),
        objective: L('Çürümüş Tersane’de Tuz İçindeki Yeminli’yi avla.', 'Hunt the Salt-Sworn in the Rotten Shipyard.'),
        story: L('Yeminli düştü. Tuz kabuğu çatlarken içinden paslı bir anahtar ve bir tekne kaydı çıkıyor: “Bir kız. Adı defterde var. Krala.”', 'The Salt-Sworn has fallen. As his crust of salt cracks, a rusted key and a boat log spill out: “One girl. Her name is in the Ledger. For the King.”'),
        reward: { item: 'salt-oath-steps', xp: 90 }, rewardText: L('Tuz Yeminlisinin Adımları (Eşsiz çizme) ve batık sandığın anahtarı', 'Steps of the Salt-Sworn (Unique boots) and the key to the sunken chest') },
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
        ], fallbacks: [{ room: 10, dx: 5, dz: 3 }, { room: 3, dx: -6, dz: 5 }, { room: 12, dx: 5, dz: -4 }] },
      { id: 'c2-altar', kind: 'altar', site: 'c2.altar', fallback: { room: 3, dx: 6, dz: -6 }, hidden: true, voice: 'altar2',
        name: L('Dönmeyenlerin Pazarlığı', 'The Bargain of the Unreturned'), description: L('Çürük İskele’nin ucunda deniz bir sunak bırakmış. Dönmeyenler pazarlık istiyor.', 'At the end of the Rotten Pier the sea has left an altar. The unreturned want to bargain.'),
        objective: L('Deniz sunağına dokun ve pazarlığı yap ya da reddet.', 'Touch the sea altar and make the bargain or refuse it.'),
        verdict: { title: L('Denizin pazarlığı', 'The sea’s bargain'), question: L('Deniz kalıcı olarak canından bir parça istiyor. Karşılığında boğulanların mızrağını verecek.', 'The sea asks for a piece of your life, forever. In return it will give you the spear of the drowned.'), options: [
          { id: 'pay', name: L('Canından ver', 'Give of your life'), effect: L('Kalıcı -8 can. Kazanç: Dönmeyenlerin Pazarlığı (Eşsiz mızrak).', 'Permanent -8 health. Gain: The Bargain of the Unreturned (Unique spear).'), story: L('Dalgalar bileklerine dolanıyor ve bir şey çekip alıyor. Sudan, ucunda son bir nefes asılı bir mızrak yükseliyor.', 'The waves wrap your wrists and pull something away. From the water rises a spear with a last breath hanging on its point.'), cost: { hp: -8 }, reward: { item: 'drowned-bargain-spear' } },
          { id: 'refuse', name: L('Denize sırtını dön', 'Turn your back on the sea'), effect: L('Bedel yok. Dönmeyenler fısıldamaya devam ediyor.', 'No price. The unreturned keep whispering.'), story: L('Denize sırtını dönüyorsun. Arkandan yüz yirmi ses aynı anda adını söylüyor.', 'You turn your back on the sea. Behind you a hundred and twenty voices speak your name at once.'), reward: { xp: 50 } }
        ] } },
      { id: 'c2-siege', kind: 'siege', site: 'c2.siege', fallback: { room: 10, dx: -6, dz: -5 }, waves: [3, 3, 4], verbTr: 'Gelgit çanını çal',
        name: L('Gelgit Çanı', 'The Tide Bell'), verb: L('Gelgit çanını çal', 'Ring the tide bell'),
        description: L('Köksüzlerin Çukuru’nda yarı gömülü bir şamandıra çanı var. Çalarsan, deniz boğduklarını geri yollar.', 'In the Rootless Pit lies a half-buried buoy bell. Ring it and the sea sends back the ones it drowned.'),
        objective: L('Gelgit çanını çal ve boğulanların üç dalgasına dayan.', 'Ring the tide bell and withstand three waves of the drowned.'),
        story: L('Son boğulmuş tuza dönüşüyor. Çanın dili kırıldı; gelgit bu kıyıya bir daha ölü getirmeyecek.', 'The last of the drowned crumbles into salt. The bell’s tongue is broken; the tide will bring no more dead to this shore.'),
        reward: { damage: .03, xp: 140 }, rewardText: L('Kalıcı +%3 hasar', 'Permanent +3% damage') },
      { id: 'c2-chest', kind: 'chest', site: 'c2.chest', fallback: { room: 7, dx: 5, dz: -4 }, key: 'c2-hunt',
        name: L('Batık Gümrük Sandığı', 'The Sunken Customs Chest'), description: L('Batık Gümrük Avlusu’nda zincirle bağlı bir sandık. Anahtarı Tuz İçindeki Yeminli taşıyor.', 'A chained chest in the Sunken Customs Yard. The Salt-Sworn carries its key.'),
        objective: L('Yeminli’nin anahtarıyla Batık Gümrük’teki sandığı aç.', 'Open the chest in the Sunken Customs with the Salt-Sworn’s key.'),
        story: L('Sandıkta fenercinin kaftanı var. Cebindeki kayıtta Selvi’nin adı ve bir varış yeri: “Harabelerin altındaki taht.”', 'Inside is the lantern keeper’s coat. The log in its pocket holds Selvi’s name and a destination: “The throne beneath the ruins.”'),
        reward: { item: 'keeper-salt-coat', xp: 60 }, rewardText: L('Fenercinin Tuzlu Kaftanı (Eşsiz zırh)', 'The Keeper’s Salted Coat (Unique armor)') }
    ],
    3: [
      { id: 'c3-hunt', kind: 'hunt', site: 'c3.hunt', fallback: { room: 8, dx: 0, dz: 0 }, voice: 'hunt3',
        name: L('Taht Kehanetçisi Ulvi', 'Ulvi, Seer of the Throne'), target: { name: L('Taht Kehanetçisi Ulvi', 'Ulvi, Seer of the Throne'), types: ['shardseer'], scale: 2.6 },
        description: L('Fısıltı Geçidi’nde kralın kör kehanetçisi dolaşıyor. Her kehaneti bir adın Defter’e yazılmasıyla bitmiş.', 'In the Whispering Pass walks the king’s blind seer. Every prophecy he spoke ended with a name written in the Ledger.'),
        objective: L('Fısıltı Geçidi’nde Taht Kehanetçisi Ulvi’yi avla.', 'Hunt Ulvi, Seer of the Throne, in the Whispering Pass.'),
        story: L('Ulvi diz çökerken gülüyor: “Son kehanetim senin için, kâtip: kendi adını kendi elinle yazacaksın.” Elinden kraliyet mühürlü bir anahtar düşüyor.', 'Ulvi laughs as he kneels: “My last prophecy is yours, scribe: you will write your own name with your own hand.” A key with the royal seal falls from his fingers.'),
        reward: { item: 'blind-seer-gaze', xp: 140 }, rewardText: L('Kör Kehanetin Gözü (Eşsiz miğfer) ve kraliyet sandığının anahtarı', 'Eye of the Blind Prophecy (Unique helm) and the key to the royal chest') },
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
        ], fallbacks: [{ room: 1, dx: -7, dz: 4 }, { room: 6, dx: 7, dz: -3 }, { room: 10, dx: 6, dz: 4 }] },
      { id: 'c3-altar', kind: 'altar', site: 'c3.altar', fallback: { room: 2, dx: -7, dz: -4 }, hidden: true, voice: 'altar3',
        name: L('Kralın Kadehi', 'The King’s Cup'), description: L('Kül Kapısı’nın bir köşesinde hiç boşalmayan bir kadeh duruyor. İçen her kral tahta zincirlenmiş.', 'In a corner of the Ash Gate stands a cup that never empties. Every king who drank was chained to the throne.'),
        objective: L('Kralın Kadehi’ne dokun: iç ya da dök.', 'Touch the King’s Cup: drink or pour it out.'),
        verdict: { title: L('Kralların içkisi', 'The drink of kings'), question: L('Kadehi içersen kalıcı güç kazanırsın ama canından bir parça tahta kalır. Dökersen sarayın son yasını tutarsın.', 'Drink, and you gain lasting strength while a piece of your life stays with the throne. Pour it out, and you mourn the palace’s last.'), options: [
          { id: 'pay', name: L('Kadehi iç', 'Drink the cup'), effect: L('Kalıcı -8 can, kalıcı +%5 hasar. Kazanç: Kralın Kadehi (Eşsiz balta).', 'Permanent -8 health, permanent +5% damage. Gain: The King’s Cup (Unique axe).'), story: L('İçki demir tadında. Damarlarında bir kralın susuzluğu uyanıyor ve kadeh elinde bir baltaya dönüşüyor.', 'The drink tastes of iron. A king’s thirst wakes in your veins, and the cup becomes an axe in your hand.'), cost: { hp: -8 }, reward: { item: 'kings-cup-axe', damage: .05 } },
          { id: 'refuse', name: L('Kadehi yere dök', 'Pour the cup out'), effect: L('Kalıcı +6 can. Saray bir kral daha kaybetmez.', 'Permanent +6 health. The palace loses no more kings.'), story: L('Kadehi taşa döküyorsun. İçki kana dönüşüyor ve toprağa çekiliyor. Bir yerde bir zincir gevşiyor.', 'You pour the cup onto the stone. The drink turns to blood and sinks into the earth. Somewhere a chain loosens.'), reward: { hp: 6 } }
        ] } },
      { id: 'c3-siege', kind: 'siege', site: 'c3.siege', fallback: { room: 6, dx: -7, dz: 4 }, waves: [3, 3, 4], verbTr: 'Yemin taşını kır',
        name: L('Muhafızların Son Yemini', 'The Wardens’ Last Oath'), verb: L('Yemin taşını kır', 'Shatter the oath stone'),
        description: L('Mağaranın Ağzı’nda kırık bir yemin taşı var. Kırarsan, tahta yemin etmiş ölüler yeminlerini bozanı aramaya çıkar.', 'At the Cave Mouth lies a cracked oath stone. Shatter it and the dead sworn to the throne will rise to hunt the oathbreaker.'),
        objective: L('Yemin taşını kır ve üç dalga boyunca hayatta kal.', 'Shatter the oath stone and survive three waves.'),
        story: L('Son yeminli diz çöküyor. Yemin taşının parçalarında artık hiçbir ad yazmıyor.', 'The last oath-bound kneels. No name remains on the shards of the oath stone.'),
        reward: { hp: 6, xp: 220 }, rewardText: L('Kalıcı +6 can', 'Permanent +6 health') },
      { id: 'c3-chest', kind: 'chest', site: 'c3.chest', fallback: { room: 12, dx: -6, dz: 3 }, key: 'c3-hunt',
        name: L('Kraliyet Sandığı', 'The Royal Chest'), description: L('Tahtın Nöbeti’nde kraliyet mührüyle kilitli bir sandık. Anahtarı Ulvi taşıyor.', 'A chest locked with the royal seal at the Throne’s Watch. Ulvi carries its key.'),
        objective: L('Ulvi’nin anahtarıyla Tahtın Nöbeti’ndeki kraliyet sandığını aç.', 'Open the royal chest at the Throne’s Watch with Ulvi’s key.'),
        story: L('Sandıkta saray kâtibinin eldivenleri var; senin eldivenlerin. Kral onları saklamış. Bir notta: “Geri dönerse ver. Dönmezse yak.”', 'Inside are the court scribe’s gauntlets: your gauntlets. The king kept them. A note: “If he returns, give them back. If not, burn them.”'),
        reward: { item: 'royal-scribe-gauntlets', xp: 120 }, rewardText: L('Saray Kâtibinin Eldivenleri (Eşsiz eldiven)', 'Gauntlets of the Court Scribe (Unique gauntlets)') }
    ],
    4: [
      { id: 'c4-hunt', kind: 'hunt', site: 'c4.hunt', fallback: { room: 4, dx: 0, dz: 0 }, voice: 'hunt4',
        name: L('Kül Veziri', 'The Ash Vizier'), target: { name: L('Kül Veziri', 'The Ash Vizier'), types: ['chainseer', 'emberbound'], scale: 2.6 },
        description: L('Kül Vezirinin Avlusu’nda ocağın hesabını tutan vezir hâlâ halka sayıyor. Kadı’ya giden yolu o biliyor.', 'In the Ash Vizier’s Court the vizier who keeps the furnace’s accounts still counts links. He knows the road to the Judge.'),
        objective: L('Kül Vezirinin Avlusu’nda Kül Veziri’ni avla.', 'Hunt the Ash Vizier in his court.'),
        story: L('Vezir düşüyor; cübbesinin astarına dikilmiş harita ocağın ardını gösteriyor: mürekkepten bir nehir ve sonsuz raflar. Kemerinden kızgın bir anahtar sarkıyor.', 'The vizier falls; the map stitched into his robe shows what lies beyond the furnace: a river of ink and endless shelves. A glowing key hangs from his belt.'),
        reward: { item: 'ash-vizier-robe', xp: 180 }, rewardText: L('Kül Vezirinin Cübbesi (Eşsiz zırh) ve Kızıl Fırınlar’daki sandığın anahtarı', 'Robe of the Ash Vizier (Unique armor) and the key to the chest in the Crimson Kilns') },
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
        ], fallbacks: [{ room: 1, dx: 7, dz: 4 }, { room: 6, dx: -7, dz: -3 }, { room: 8, dx: 6, dz: 4 }] },
      { id: 'c4-altar', kind: 'altar', site: 'c4.altar', fallback: { room: 9, dx: -7, dz: -4 }, hidden: true, voice: 'altar4',
        name: L('Kanlı Örs', 'The Bloody Anvil'), description: L('Cüruf Meydanı’nın kıyısında, hâlâ kızgın bir örs. Demirci kanı olmadan soğumuyor.', 'At the edge of the Slag Square, an anvil still glowing. It will not cool without a smith’s blood.'),
        objective: L('Kanlı Örs’e dokun ve bedeli seç.', 'Touch the Bloody Anvil and choose the price.'),
        verdict: { title: L('Örsün bedeli', 'The anvil’s price'), question: L('Örs çeliği senin kanınla soğutmak istiyor: kalıcı can kaybı karşılığında ocağın en keskin kılıcı.', 'The anvil wants to quench steel in your blood: a lasting loss of health for the furnace’s sharpest blade.'), options: [
          { id: 'pay', name: L('Kanınla soğut', 'Quench it in your blood'), effect: L('Kalıcı -10 can. Kazanç: Kanlı Örsün Kılıcı (Eşsiz kılıç).', 'Permanent -10 health. Gain: Sword of the Bloody Anvil (Unique sword).'), story: L('Kolunu kızgın çeliğin üstüne tutuyorsun. Buhar çığlık gibi yükseliyor; çelik sana ait bir kılıca dönüşüyor.', 'You hold your arm over the glowing steel. Steam rises like a scream; the steel becomes a blade that is yours.'), cost: { hp: -10 }, reward: { item: 'bloody-anvil-sword' } },
          { id: 'refuse', name: L('Örsü suya göm', 'Drown the anvil'), effect: L('Bedel yok. Ocak bir ağız daha kaybediyor.', 'No price. The furnace loses one more mouth.'), story: L('Örsü soğutma havuzuna itiyorsun. Ocak acıyla homurdanıyor; bir halka daha dövülmeyecek.', 'You push the anvil into the quenching pool. The furnace groans; one more link will never be forged.'), reward: { xp: 120 } }
        ] } },
      { id: 'c4-siege', kind: 'siege', site: 'c4.siege', fallback: { room: 6, dx: 7, dz: 4 }, waves: [3, 3, 4], verbTr: 'Körük zincirlerini kır',
        name: L('Körük Ayaklanması', 'The Bellows Uprising'), verb: L('Körük zincirlerini kır', 'Break the bellows chains'),
        description: L('Demirin Duası’nda körükler hâlâ zincirli kölelerle bağlı. Zincirleri kırarsan, ocağın bekçileri isyanı bastırmaya gelir.', 'In the Prayer of Iron the bellows are still bound to chained slaves. Break the chains and the furnace’s keepers will come to crush the uprising.'),
        objective: L('Körük zincirlerini kır ve üç dalga boyunca hayatta kal.', 'Break the bellows chains and survive three waves.'),
        story: L('Son bekçi körüğün altında eziliyor. Köleler ilk kez kendi soluklarıyla nefes alıyor.', 'The last keeper is crushed beneath the bellows. For the first time, the slaves breathe with their own breath.'),
        reward: { damage: .03, xp: 260 }, rewardText: L('Kalıcı +%3 hasar', 'Permanent +3% damage') },
      { id: 'c4-chest', kind: 'chest', site: 'c4.chest', fallback: { room: 10, dx: 6, dz: -3 }, key: 'c4-hunt',
        name: L('Selvi’nin Emanet Sandığı', 'Selvi’s Keepsake Chest'), description: L('Kızıl Fırınlar’da, halkaların arasında küçük bir sandık. Anahtarı Kül Veziri taşıyor.', 'In the Crimson Kilns, a small chest among the links. The Ash Vizier carries its key.'),
        objective: L('Vezirin anahtarıyla Kızıl Fırınlar’daki emanet sandığını aç.', 'Open the keepsake chest in the Crimson Kilns with the vizier’s key.'),
        story: L('Sandıkta boş bir halka ve küçük çizmeler var. Halkada tek bir ad: Selvi. İçinden geçen zincir yok. O yanmadı.', 'Inside lie an empty link and a pair of small boots. One name on the link: Selvi. No chain runs through it. She did not burn.'),
        reward: { item: 'selvi-last-road', xp: 160 }, rewardText: L('Selvi’nin Son Yolu (Eşsiz çizme)', 'Selvi’s Last Road (Unique boots)') }
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
        ], fallbacks: [{ index: .25 }, { index: .55 }, { index: .8 }] },
      { id: 'c5-altar', kind: 'altar', site: 'c5.altar', fallback: { index: .6 }, hidden: true, voice: 'altar5',
        name: L('Boş Satır', 'The Empty Line'), description: L('Arşivin gizli köşesinde açık duran bir sayfa. Son satırı boş.', 'In a hidden corner of the archive lies an open page. Its last line is empty.'),
        objective: L('Boş satıra dokun.', 'Touch the empty line.'),
        verdict: { title: L('Adını erken yaz', 'Write your name early'), question: L('Adını şimdi yazarsan Defter seni Kadı’dan önce tanır: efendiye karşı güç kazanırsın, ama ölüm seni daha kolay bulur.', 'Write your name now and the Ledger will know you before the Judge does: strength against its master, but death will find you more easily.'), options: [
          { id: 'pay', name: L('Adını yaz', 'Write your name'), effect: L('Bu bölümde 1 şifa matarası eksik. Kalıcı +%5 hasar.', 'One less healing flask this chapter. Permanent +5% damage.'), story: L('Kalem elinde ağırlaşıyor. Adının ilk harfini yazıyorsun; Defter bir kalp gibi atıyor.', 'The pen grows heavy in your hand. You write the first letter of your name; the Ledger beats like a heart.'), cost: { flaskDebt: 1 }, reward: { damage: .05 } },
          { id: 'refuse', name: L('Satırı boş bırak', 'Leave the line empty'), effect: L('Bedel yok.', 'No price.'), story: L('Kalemi bırakıyorsun. Satır boş kalıyor; şimdilik.', 'You set the pen down. The line stays empty, for now.'), reward: { xp: 120 } }
        ] } }
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
      } else if (kind === 'altar') {
        kit.box(body, S, 1.1, .62, .7, 0, .31, 0); kit.box(body, S, 1.24, .1, .82, 0, .67, 0); kit.box(body, R, 1.26, .03, .84, 0, .6, 0);
        kit.cyl(body, M, .3, .24, .14, 0, .79, 0);
        for (var h = -1; h <= 1; h += 2) { kit.put(body, BONE, new T.ConeGeometry(.07, .7, 6), h * .5, 1.0, -.22, .25, 0, -h * .45); kit.put(body, BONE, new T.ConeGeometry(.05, .5, 6), h * .38, .94, .25, -.3, 0, -h * .3); }
        kit.cyl(body, BLOOD, .24, .24, .03, 0, .86, 0); kit.box(body, BLOOD, .08, .5, .02, .2, .4, .36); kit.box(body, BLOOD, .05, .34, .02, -.25, .46, .36);
        for (var sk = -1; sk <= 1; sk += 2) kit.put(body, BONE, new T.SphereGeometry(.09, 10, 8), sk * .42, .78, .2);
        kit.cyl(glowParts, EMBER, .1, .1, .012, 0, .885, 0);
        for (var c = 0; c < 4; c++) kit.ring(chains, M, .09, .02, -.62 + c * .025, .3 + c * .13, .36, c % 2 ? PI / 2 : 0);
      } else if (kind === 'chest') {
        kit.box(body, Wd, .9, .48, .58, 0, .26, 0); kit.box(body, M, .94, .05, .62, 0, .07, 0);
        for (var b = -1; b <= 1; b += 2) kit.box(body, M, .05, .5, .62, b * .3, .27, 0);
        kit.box(lid, Wd, .9, .14, .58, 0, 0, .29); kit.box(lid, M, .94, .04, .62, 0, .06, .29); kit.box(lid, R, .12, .14, .04, 0, -.02, .6);
        for (var k = 0; k < 7; k++) kit.ring(chains, M, .075, .022, -.42 + k * .14, .52, .3, PI / 2, 0, (k % 2) * PI / 2);
        for (var k2 = 0; k2 < 3; k2++) kit.ring(chains, M, .075, .022, .05, .3 + k2 * .12, .31, 0, PI / 2, (k2 % 2) * PI / 2);
        kit.put(glowParts, EMBER, new T.SphereGeometry(.045, 10, 8), 0, .44, .32);
      } else if (kind === 'brazier') {
        kit.cyl(body, S, .42, .5, .22, 0, .11, 0); kit.cyl(body, M, .1, .12, .7, 0, .55, 0);
        kit.put(body, M, new T.LatheGeometry([new T.Vector2(.08, 0), new T.Vector2(.42, .12), new T.Vector2(.55, .3), new T.Vector2(.5, .34)], 20), 0, .86, 0);
        kit.ring(body, R, .54, .03, 0, 1.18, 0, PI / 2);
        for (var sp = 0; sp < 3; sp++) { var an = sp * PI * 2 / 3; kit.box(body, M, .05, .9, .05, Math.sin(an) * .3, .45, Math.cos(an) * .3, Math.cos(an) * .35, 0, -Math.sin(an) * .35); }
        kit.cyl(glowParts, EMBER, .4, .44, .05, 0, 1.13, 0); for (var em = 0; em < 5; em++) kit.put(glowParts, EMBER, new T.OctahedronGeometry(.07, 0), Math.sin(em * 1.3) * .22, 1.18, Math.cos(em * 1.3) * .22);
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
      var halo = [], hg = new T.Group(); kit.ring(halo, kit.glow, .55, .018, 0, .04, 0, PI / 2); kit.merge(halo, hg); actor.halo = hg; kit.root.add(hg);
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

    // ---- build quests
    defs.forEach(function (def, qi) {
      var q = { def: def, index: qi, nodes: [], entry: null };
      var entry = { id: def.id, kind: def.kind, kindName: W[def.kind], name: def.name, description: def.description, objective: def.objective,
        rewardText: def.rewardText || '', hidden: !!def.hidden, discovered: !def.hidden, complete: false, progress: 0, total: 1, outcome: '', choice: null,
        pages: null, target: null, available: false };
      q.entry = entry; quests.push(q); state[def.id] = { stage: 0, bits: 0, choice: null, done: false, discovered: !def.hidden };
      try {
        if (def.kind === 'hunt') {
          var at = spot(def.site, def.fallback), best = null, bestD = Infinity;
          (api.enemies || []).forEach(function (e) {
            if (e.boss || e.reserve || e.huntQuest || e.type === 'ruinwarden' || e.type === 'ashwarden') return;
            // The named prey keeps its kind when one lives within ~45 m of its den; otherwise the nearest foe takes the name.
            var raw = Math.hypot(e.x - at.x, e.z - at.z), match = !def.target.types.length || def.target.types.indexOf(e.type) >= 0;
            var d = (match && raw < 45 ? raw : raw + 1000) * (e.elite ? .85 : 1);
            if (d < bestD) { bestD = d; best = e; }
          });
          if (!best) { q.disabled = true; return; }
          best.huntQuest = def.id; best.name = def.target.name; best.elite = true;
          best.baseMaxHp = Math.round((best.baseMaxHp || best.maxHp) * def.target.scale); best.maxHp = Math.round(best.maxHp * def.target.scale); best.hp = best.maxHp;
          best.campaignDamage = (best.campaignDamage || 1) * 1.22; best.radius = (best.radius || .6) * 1.08;
          if (best.model && best.model.root) best.model.root.scale.multiplyScalar(1.16);
          q.enemy = best;
        } else if (def.kind === 'rescue') {
          q.captive = node(q, 'post', def.site, def.fallback, { verb: L('Zincirini çöz', 'Break the chain'), role: 'captive' });
          q.actor = makeActor(def); q.actor.x = q.captive.x + .55; q.actor.z = q.captive.z + .35; q.actor.face = 0;
          var goalAt = world.questSites && world.questSites[def.goal] ? world.questSites[def.goal] : world.checkpoint || { x: q.captive.x, z: q.captive.z };
          q.goal = { x: goalAt.x, z: goalAt.z };
        } else if (def.kind === 'lore') {
          entry.total = def.pages.length; entry.pages = [];
          def.pages.forEach(function (pg, i) { var n = node(q, 'page', pg.site, def.fallbacks[i], { verb: L('Sayfayı oku', 'Read the page'), role: 'page', page: i }); q.nodes.push(n); entry.pages.push({ name: pg.name, text: pg.text, found: false }); });
        } else if (def.kind === 'altar') {
          q.altar = node(q, 'altar', def.site, def.fallback, { verb: L('Sunağa dokun', 'Touch the altar'), role: 'altar' });
        } else if (def.kind === 'siege') {
          q.brazier = node(q, 'brazier', def.site, def.fallback, { verb: def.verb, role: 'siege' }); entry.total = def.waves.length;
        } else if (def.kind === 'chest') {
          q.chest = node(q, 'chest', def.site, def.fallback, { verb: L('Sandığı aç', 'Open the chest'), role: 'chest' });
        }
      } catch (e) { console.warn('[quests] side quest disabled', def.id, e); q.disabled = true; }
      if (q.captive) q.nodes.push(q.captive); if (q.altar) q.nodes.push(q.altar); if (q.chest) q.nodes.push(q.chest); if (q.brazier) q.nodes.push(q.brazier);
    });
    quests = quests.filter(function (q) { return !q.disabled; });
    info.side = quests.map(function (q) { return q.entry; });
    info.sideMarkers = [];
    nodes.forEach(function (n) { n.marker = { id: n.id, side: n.quest.def.id, kind: n.quest.def.kind, name: n.quest.def.name, x: n.x, z: n.z, active: false, complete: false }; info.sideMarkers.push(n.marker); });
    quests.forEach(function (q) { if (q.enemy) { q.marker = { id: q.def.id, side: q.def.id, kind: 'hunt', name: q.def.target.name, x: q.enemy.x, z: q.enemy.z, active: true, complete: false, moving: true }; info.sideMarkers.push(q.marker); } });

    function keyOwned(q) { var src = state[q.def.key]; return !!(src && src.done); }
    function mainDone(i) { return !!(info.entries[i] && info.entries[i].complete); }
    function refresh() {
      quests.forEach(function (q) {
        var s = state[q.def.id], e = q.entry, d = q.def;
        e.complete = s.done; e.discovered = s.discovered || s.done; e.choice = s.choice;
        if (d.kind === 'lore') { e.progress = 0; for (var i = 0; i < q.nodes.length; i++) { var got = !!(s.bits & (1 << i)); q.nodes[i].done = got; e.pages[i].found = got; if (got) e.progress++; } }
        else if (d.kind === 'rescue') { e.total = 2; e.progress = s.done ? 2 : s.stage >= 1 ? 1 : 0; }
        else if (d.kind === 'siege') { e.total = d.waves.length; e.progress = s.done ? d.waves.length : Math.max(0, s.stage - 1); }
        else e.progress = s.done ? 1 : 0;
        e.objective = s.done ? W.done : d.kind === 'siege' && s.stage >= 1 ? W.wave + s.stage + ' / ' + d.waves.length + W.survive : d.kind === 'rescue' && s.stage >= 1 ? d.follow : d.kind === 'chest' && !keyOwned(q) ? W.locked : d.objective;
        e.available = !s.done && e.discovered && !(d.requiresMain != null && !mainDone(d.requiresMain));
        e.outcome = s.done ? (d.kind === 'altar' && s.choice ? (d.verdict.options.find(function (x) { return x.id === s.choice; }) || {}).story || '' : d.story) : '';
        e.target = null;
        q.nodes.forEach(function (n) {
          if (d.kind === 'rescue') n.done = s.stage >= 1 || s.done;
          if (d.kind === 'altar' || d.kind === 'chest') n.done = s.done;
          if (d.kind === 'siege') n.done = s.done || s.stage >= 1;
          n.marker.complete = n.done; n.marker.active = e.available && !n.done && !(d.kind === 'chest' && !keyOwned(q));
          if (!e.target && n.marker.active) e.target = n.marker;
          var pr = n.parts; if (!pr) return;
          if (pr.glow) pr.glow.visible = n.marker.active || (d.kind === 'altar' && !s.done) || (d.kind === 'siege' && s.stage >= 1 && !s.done);
          if (d.kind === 'lore') pr.group.visible = !n.done;
          if (pr.chains) pr.chains.visible = !(d.kind === 'chest' ? s.done : d.kind === 'rescue' ? s.stage >= 1 || s.done : false);
          if (pr.lid) { pr.lid.rotation.x = s.done ? -1.9 : 0; pr.lid.updateMatrix(); }
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
        var n = nodes[i], q = n.quest, s = state[q.def.id]; if (n.done || s.done || !q.entry.discovered) continue;
        if (q.def.requiresMain != null && !mainDone(q.def.requiresMain)) continue;
        var dx = player.x - n.x, dz = player.z - n.z, d = dx * dx + dz * dz; if (d >= best) continue;
        if (world.hasClearPath && !world.hasClearPath(player.x, player.z, n.x, n.z, .25)) continue;
        near = n; best = d;
      }
      if (!near) return null;
      var qd = near.quest.def, blocked = '';
      if (qd.kind === 'chest' && !keyOwned(near.quest)) blocked = W.locked;
      else if (qd.kind === 'rescue' && guarded(near, 9)) blocked = W.guarded;
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
        if (count === d.pages.length) complete(q, pg.name + ' — ' + pg.text + ' ' + d.story);
        else { if (api.onChange) api.onChange(); notify(q, pg.name + ' — ' + pg.text, false); }
        return true;
      }
      if (d.kind === 'chest') { complete(q, d.story); return true; }
      if (d.kind === 'siege') { s.stage = 1; q.wave = null; q.pause = .6; refresh(); notify(q, d.description, false); api.sound('sealOpen', { x: n.x, z: n.z }); return true; }
      if (d.kind === 'rescue') {
        s.stage = 1; q.actor.x = n.x + .9; q.actor.z = n.z + .6; refresh(); if (api.onChange) api.onChange();
        notify(q, d.freeStory, false); api.sound('sealOpen', { x: n.x, z: n.z }); return true;
      }
      if (d.kind === 'altar') {
        info.pendingChoice = { questId: d.id, nodeId: n.id, title: d.verdict.title, question: d.verdict.question, options: d.verdict.options, side: true };
        bump(); api.emit('questChoice', info.pendingChoice); return true;
      }
      return false;
    }
    function choose(questId, optionId) {
      var pending = info.pendingChoice; if (!pending || !pending.side || pending.questId !== questId) return false;
      if (pending.finale) return chooseFinale(optionId);
      var q = quests.find(function (x) { return x.def.id === questId; }); if (!q) return false;
      var opt = q.def.verdict.options.find(function (x) { return x.id === optionId; }); if (!opt) return false;
      var s = state[q.def.id]; s.choice = optionId; info.pendingChoice = null;
      if (opt.cost && opt.cost.flaskDebt) local.flaskDebt += opt.cost.flaskDebt;
      if (opt.cost && opt.cost.hp) grant(q.def.id + ':cost', { hp: opt.cost.hp });
      complete(q, opt.story, q.def.id + ':' + optionId, opt.reward);
      return true;
    }

    // ---- finale (chapter 5, after the master falls)
    function openFinale() {
      if (finaleOpen || local.finale) return; finaleOpen = true;
      var b = boons(), pages = b.claimed.filter(function (k) { return /:c\d-pages$/.test(k); }).length, truth = pages >= 5;
      var opts = FINALE.options.map(function (x) { return x.id === 'name' && truth ? Object.assign({}, x, { effect: FINALE.truth }) : x; });
      info.pendingChoice = { questId: 'finale', nodeId: 'finale', title: FINALE.title, question: FINALE.question, options: opts, side: true, finale: true };
      bump(); api.emit('questChoice', info.pendingChoice);
    }
    function chooseFinale(optionId) {
      var opt = FINALE.options.find(function (x) { return x.id === optionId; }); if (!opt) return false;
      local.finale = optionId; info.pendingChoice = null; info.finale = { id: optionId, name: opt.name, story: opt.story };
      grant('finale:' + optionId, { xp: 1 }); bump(); if (api.onChange) api.onChange();
      api.emit('quest', { id: 'finale', name: FINALE.title, text: opt.story, side: true, kind: 'main', complete: true, completed: info.completed, total: 2, step: 1, steps: 1, choice: optionId });
      say(opt.voice); return true;
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
    // ---- survival: the rite pulls dormant dead from far, unvisited halls in three waves around the site.
    function pull(q, count) {
      var site = q.brazier, list = (api.enemies || []).filter(function (e) {
        return !e.dead && !e.boss && !e.reserve && !e.huntQuest && !e.active && !e.siege && Math.hypot(e.x - player.x, e.z - player.z) > 26;
      }).sort(function (a, b) { return Math.hypot(b.x - site.x, b.z - site.z) - Math.hypot(a.x - site.x, a.z - site.z); });
      var wave = [];
      for (var i = 0; i < list.length && wave.length < count; i++) {
        var e = list[i], placed = false;
        for (var k = 0; k < 10 && !placed; k++) {
          var an = (wave.length / count + k * .13) * PI * 2 + (q.index || 0), r = 6 + (k % 3), x = site.x + Math.sin(an) * r, z = site.z + Math.cos(an) * r;
          if (world.isWalkable && !world.isWalkable(x, z, .6)) continue;
          e.x = e.spawnX = x; e.z = e.spawnZ = z; e.face = Math.atan2(player.x - x, player.z - z); e.active = e.activated = true; e.returning = false;
          if (e.encounter && typeof e.encounter === 'object') e.encounter.announced = true; e.siege = q.def.id; e.cooldown = 1.2 + wave.length * .35; e.navigation = null;
          if (e.model && e.model.root) { e.model.root.position.set(x, 0, z); e.model.root.visible = true; }
          try { api.fx('boss2Summon', { x: x, z: z }); } catch (err) {} placed = true; wave.push(e);
        }
      }
      return wave;
    }
    function updateSiege(q, s, dt) {
      if (player.dead) return;
      if (q.wave && q.wave.some(function (e) { return !e.dead; })) return;
      if (q.wave) { q.wave = null; q.pause = 2.2; if (s.stage >= q.def.waves.length) { s.stage = 2; complete(q, q.def.story); return; } s.stage++; refresh(); }
      q.pause -= dt; if (q.pause > 0) return;
      var n = q.def.waves[Math.max(0, s.stage - 1)] - (api.difficulty === 'easy' || (B.app && B.app.game && B.app.game.difficulty === 'easy') ? 1 : 0);
      q.wave = pull(q, n);
      api.emit('toast', { text: W.wave + s.stage + ' / ' + q.def.waves.length + ' · ' + q.def.name });
      if (!q.wave.length) { s.stage = q.def.waves.length; q.wave = []; }
    }
    function update(dt) {
      if (disposed) return;
      var dirty = false;
      // Flask capacity: permanent quest boons minus this chapter's blood debts.
      if (player.baseFlasks === undefined) player.baseFlasks = player.maxFlasks || 4;
      var want = Math.max(1, Math.min(8, player.baseFlasks + (boons().flasks || 0) - local.flaskDebt));
      if (player.maxFlasks !== want) { if (want > player.maxFlasks) player.flasks = (player.flasks || 0) + (want - player.maxFlasks); player.maxFlasks = want; player.flasks = Math.min(player.flasks, want); }
      for (var i = 0; i < quests.length; i++) {
        var q = quests[i], s = state[q.def.id];
        if (q.def.kind === 'hunt' && q.enemy) {
          if (q.marker && !q.enemy.dead) { q.marker.x = q.enemy.x; q.marker.z = q.enemy.z; }
          if (!s.done && !q.sighted && !q.enemy.dead && Math.hypot(q.enemy.x - player.x, q.enemy.z - player.z) < 16) { q.sighted = true; api.emit('toast', { text: W.hunt + ': ' + q.def.target.name + L(' yakında. Ondan kaçma.', ' is near. Do not run from it.') }); }
          if (!s.done && q.enemy.dead) complete(q, q.def.story);
        }
        if (q.def.kind === 'rescue') updateFollower(q, dt);
        if (q.def.kind === 'siege' && s.stage >= 1 && !s.done) updateSiege(q, s, dt);
        if (!s.discovered && q.def.hidden) {
          var n0 = q.nodes[0];
          if (n0 && Math.hypot(player.x - n0.x, player.z - n0.z) < 10 && (!world.hasClearPath || world.hasClearPath(player.x, player.z, n0.x, n0.z, .25))) {
            s.discovered = true; dirty = true; api.emit('toast', { text: W.found + ': ' + q.def.name });
            if (api.onChange) api.onChange(); say(q.def.voice);
          }
        }
        if (q.def.kind === 'rescue' && q.def.requiresMain != null && !s.stage && mainDone(q.def.requiresMain)) { s.stage = 1; q.actor.x = q.captive.x + .9; q.actor.z = q.captive.z + .6; dirty = true; }
      }
      // Story beats: a recollection once the first calm minute passes, and the master's last words when it falls.
      beatClock += dt;
      var beats = STORY_BEATS[chapter];
      if (beats && !(local.beats & 1) && beatClock > 40) { local.beats |= 1; say(beats.start); }
      var g = B.app && B.app.game, boss = g && (g.boss || (g.enemies || []).find(function (e) { return e.boss; }));
      if (boss && boss.dead && !bossSeen) { bossSeen = true; if (beats && beats.boss && !(local.beats & 2)) { local.beats |= 2; say(beats.boss); } if (chapter === 5) openFinale(); }
      timer -= dt; if (dirty || timer <= 0) { timer = .5; refresh();
        // Far props leave the render traversal (same 32 m window as the main quest props).
        for (var c = 0; c < nodes.length; c++) { var pr = nodes[c].parts; if (!pr) continue; var near = Math.abs(player.x - nodes[c].x) < 32 && Math.abs(player.z - nodes[c].z) < 30;
          var keep = near && !(nodes[c].quest.def.kind === 'lore' && nodes[c].done); if (pr.group.visible !== keep) pr.group.visible = keep; }
      }
    }
    function snapshot() {
      var out = { v: 1, flaskDebt: local.flaskDebt, finale: local.finale, beats: local.beats, q: {} };
      quests.forEach(function (q) { var s = state[q.def.id]; out.q[q.def.id] = [q.def.kind === 'siege' && !s.done ? 0 : s.stage, s.bits, s.choice, s.done ? 1 : 0, s.discovered ? 1 : 0]; });
      return out;
    }
    function restore(saved) {
      local.flaskDebt = 0; local.finale = null; local.beats = 0; finaleOpen = false;
      quests.forEach(function (q) { q.wave = null; q.pause = 0; });
      quests.forEach(function (q) { state[q.def.id] = { stage: 0, bits: 0, choice: null, done: false, discovered: !q.def.hidden }; });
      if (saved && saved.v === 1 && saved.q) {
        local.flaskDebt = Math.max(0, Math.min(2, saved.flaskDebt | 0)); local.finale = typeof saved.finale === 'string' ? saved.finale : null; local.beats = saved.beats | 0;
        quests.forEach(function (q) {
          var r = saved.q[q.def.id]; if (!Array.isArray(r)) return;
          var s = state[q.def.id]; s.stage = Math.max(0, Math.min(2, r[0] | 0)); s.bits = (r[1] | 0) & 7; s.choice = typeof r[2] === 'string' ? r[2] : null; s.done = !!r[3]; s.discovered = !!r[4] || !q.def.hidden;
          if (q.actor && s.stage === 1 && !s.done) { q.actor.x = player.x + 1.2; q.actor.z = player.z + 1.2; }
          if (q.actor && s.done) { q.actor.x = q.goal.x + 1.4; q.actor.z = q.goal.z + 1.1; }
        });
      }
      if (local.finale) { var f = FINALE.options.find(function (x) { return x.id === local.finale; }); if (f) info.finale = { id: f.id, name: f.name, story: f.story }; }
      quests.forEach(function (q) { if (q.actor) { q.actor.root.position.set(q.actor.x, 0, q.actor.z); } });
      refresh();
    }
    function dispose() { disposed = true; quests.forEach(function (q) { if (q.actor && q.actor.root) q.actor.root.removeFromParent(); }); }
    quests.forEach(function (q) { if (q.actor) animateActor(q.actor, 0); });
    refresh();
    // QA hook: BABA.QuestSide.debug() lists live quest actors and states (no gameplay effect).
    B.QuestSide.debug = function () { return quests.map(function (q) { var s = state[q.def.id]; return { id: q.def.id, stage: s.stage, done: s.done, actor: q.actor ? { x: +q.actor.x.toFixed(2), z: +q.actor.z.toFixed(2), visible: q.actor.root.visible, model: !!q.actor.model } : null, goal: q.goal || null }; }); };
    return { scan: scan, interact: interact, choose: choose, update: update, snapshot: snapshot, restore: restore, dispose: dispose, openFinale: openFinale,
      get count() { return quests.length; } };
  }

  B.QuestSide = { VERSION: 1, chapters: SIDE, finale: FINALE, create: create, L: L };
})();
