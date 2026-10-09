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
    ['scribe-clasp-helm', L('Kâtibin Mühürlü Başlığı', 'The Scribe’s Sealed Hood'), 'head', 3, 'boss', 0, .05, 3, null, L('Mahkeme kâtiplerinin başlığı. İç astarına yüzlerce ad işlenmiş; hepsi senin el yazın.', 'The hood of the court scribes. Hundreds of names are stitched into its lining, all in your hand.'), 'iron-helm', 'rust'],
    ['salt-oath-steps', L('Tuz Yeminlisinin Adımları', 'Steps of the Salt-Sworn'), 'boots', 5, 'boss', 0, .06, 3, null, L('Tuza gömülü bir nöbetçinin çizmeleri. Deniz onları hiç ıslatamadı.', 'Boots of a sentry buried in salt. The sea never managed to soak them.'), 'tide-boots', 'brine'],
    ['drowned-bargain-spear', L('Dönmeyenlerin Pazarlığı', 'The Bargain of the Unreturned'), 'weapon', 5, 'boss', .195, 0, 0, 'spear', L('Denizden kana karşılık alınmış mızrak. Ucunda hâlâ birinin son nefesi asılı.', 'A spear bought from the sea with blood. Someone’s last breath still hangs on its point.'), 'bone-spear', 'brine'],
    ['keeper-salt-coat', L('Fenercinin Tuzlu Kaftanı', 'The Keeper’s Salted Coat'), 'chest', 5, 'boss', 0, .085, 5, null, L('Batık sandıktan çıkan kaftan. Cebinde, Selvi’yi taşıyan teknenin kaydı var.', 'A coat from the sunken chest. In its pocket, the log of the boat that carried Selvi.'), 'coast-chest', 'brine'],
    ['blind-seer-gaze', L('Kör Kehanetin Gözü', 'Eye of the Blind Prophecy'), 'head', 6, 'boss', 0, .08, 3, null, L('Ulvi’nin miğferi. Göz yarıkları mühürlü; yine de içinden geleceği görürsün.', 'Ulvi’s helm. Its eye slits are sealed, yet through it you see what comes.'), 'drowned-helm', 'ash'],
    ['kings-cup-axe', L('Kralın Kadehi', 'The King’s Cup'), 'weapon', 7, 'boss', .24, 0, 0, 'axe', L('Kadehin altından dökülmüş balta. İçen her kral gibi, o da susuzluğunu hiç gidermez.', 'An axe cast from the cup’s gold. Like every king who drank, its thirst is never quenched.'), 'executioner-axe', 'ash'],
    ['royal-scribe-gauntlets', L('Saray Kâtibinin Eldivenleri', 'Gauntlets of the Court Scribe'), 'hands', 7, 'boss', 0, .075, 3, null, L('Kralın kâtibine verdiği demir eldivenler. Mürekkep lekesi demirin içine işlemiş.', 'Iron gloves the king gave his scribe. The ink stain has soaked into the metal.'), 'salt-gauntlets', 'bone'],
    ['ash-vizier-robe', L('Kül Vezirinin Cübbesi', 'Robe of the Ash Vizier'), 'chest', 7, 'boss', 0, .13, 4, null, L('Kadı’ya giden yol cübbenin astarına dikilmiş. Kül hiç dökülmüyor.', 'The road to the Judge is stitched into the lining. The ash never falls away.'), 'grave-chest', 'ash'],
    ['bloody-anvil-sword', L('Kanlı Örsün Kılıcı', 'Sword of the Bloody Anvil'), 'weapon', 9, 'boss', .29, 0, 0, 'sword', L('Senin kanınla soğutulan çelik. Ocak sönse de bu kılıç sıcak kalır.', 'Steel quenched in your own blood. The furnace may die; this blade stays warm.'), 'grave-sword', 'blood'],
    ['selvi-last-road', L('Selvi’nin Son Yolu', 'Selvi’s Last Road'), 'boots', 9, 'boss', 0, .09, 4, null, L('Selvi’nin halkasıyla birlikte saklanan çizmeler. Tabanında bir çocuğun çizdiği yol haritası var.', 'Boots kept beside Selvi’s ring. A child’s drawing of a road is scratched into the sole.'), 'tide-boots', 'bone'],
    ['weaver-apprentice-wraps', L('Çırağın Kanlı Makarası', 'The Apprentice’s Bloody Spool'), 'hands', 3, 'boss', 0, .035, 5, null, L('Çırağın parmaklarına sardığı kefen ipliği. Hâlâ ılık.', 'Shroud thread the apprentice wound around her fingers. Still warm.'), 'rag-wraps', 'blood'],
    ['crypt-walker-boots', L('Mühürlü Mahzenin Adımları', 'Steps of the Sealed Crypt'), 'boots', 3, 'boss', 0, .045, 3, null, L('Mahzenin tozunda iz bırakmayan çizmeler. Kâtiplerin gizli yolu için yapılmış.', 'Boots that leave no print in the crypt dust. Made for the scribes’ hidden road.'), 'grave-boots', 'ash'],
    ['tide-widow-helm', L('Dul Gelgitin Yüzü', 'Face of the Widowed Tide'), 'head', 5, 'boss', 0, .07, 3, null, L('Yeminlinin karısının tuzla dolmuş miğferi. Kocasını aramaktan hiç vazgeçmedi.', 'The Salt-Sworn’s wife’s salt-choked helm. She never stopped searching for him.'), 'drowned-helm', 'brine'],
    ['hidden-throne-chest', L('Gizli Tahtın Kefeni', 'Shroud of the Hidden Throne'), 'chest', 7, 'boss', 0, .115, 5, null, L('Kralın gizli odasında saklanan zırh. Göğsünde silinmiş bir ad var: kralın kendi adı.', 'Armor hidden in the king’s secret room. A scraped-away name on the breast: the king’s own.'), 'grave-chest', 'bone'],
    ['seer-echo-spear', L('Kehanetin Yankısı', 'Echo of the Prophecy'), 'weapon', 7, 'boss', .245, 0, 2, 'spear', L('Ulvi’nin öğrencisinin mızrağı. Ucu, saplanacağı yeri önceden bilir.', 'The spear of Ulvi’s pupil. Its point knows where it will strike before it is thrown.'), 'bone-spear', 'ash'],
    ['vizier-clerk-grasp', L('Hesap Kâtibinin Pençesi', 'The Tally Clerk’s Grasp'), 'hands', 9, 'boss', 0, .095, 4, null, L('Vezirin halka sayan kâtibinin demir eldiveni. Parmak boğumlarında sayılar kazılı.', 'The iron glove of the vizier’s link-counting clerk. Numbers are carved into its knuckles.'), 'chain-gloves', 'rust'],
    ['ink-headsman-helm', L('Mürekkep Cellatının Yüzü', 'Face of the Ink Headsman'), 'head', 9, 'boss', 0, .095, 5, null, L('Siyah mürekkeple kaplı ağır miğfer. Kesilen her ad, içinde bir damla bırakmış.', 'A heavy helm slick with black ink. Every name it cut left a drop inside.'), 'iron-helm', 'blood']
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
        story: L("Üç sayfa, aynı el. İlkinde bir görev, ikincisinde paylaşılan bir suç, sonuncusunda Selvi'nin adı. Hiçbir satırda kalemi bırakmadın.", "Three pages, one hand. A duty on the first, a shared crime on the second, Selvi's name on the last. In none of those lines did you put down the pen."),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin ilk parçası', '+1 skill point and the first piece of your past'),
        pages: [
          page('c1.page1', L('Sayfa: Hüküm Kâtibi', 'Page: The Scribe of Sentences'),L("Yirminci yılım. İlk hükümde adamın yüzüne bakmıştım. Bugün yüzlere bakmıyorum. Kadı'nın mührünü, adın harflerini, satırın sonunda bıraktığım boşluğu görüyorum. Cellat kılıcını benden sonra kaldırır. Ben masadan kalkmadan bir beden eksilir. Akşam çocuklar sokakta oynuyor. Hiçbiri kalemimin sesini duymuyor. — B.", "My twentieth year. At the first sentence I looked at the man's face. Today I do not look at faces. I see the Judge's seal, the letters of a name, the space I leave at the end of a line. The Executioner raises his sword after I write. A body is gone before I leave my desk. Children play in the street that evening. None of them hears my pen. — B.")),
          page('c1.page2', L('Sayfa: Cellat’ın Payı', 'Page: The Executioner’s Share'),L("Cellat bileğini masaya koydu. Koluna kadar yıkamış; tırnağının altında bir başkasının kanı vardı. 'Sen yazmasan ben kesmem,' dedi. Ben de 'Sen kesmesen ben yalnız yazmış olurum,' dedim. İkimiz de güldük. Eve döndüğümde Selvi ellerime baktı. Ona mürekkep dedim. O gece suyun rengi açılana kadar yıkandım. — B.", "The Executioner laid his wrist on the table. He had washed up to the elbow; someone else's blood remained beneath a nail. 'If you did not write, I would not cut,' he said. 'If you did not cut, I would only have written,' I answered. We both laughed. At home, Selvi looked at my hands. I told her it was ink. That night I washed until the water ran clear. — B.")),
          page('c1.page3', L('Sayfa: Yeni Ad', 'Page: A New Name'),L("Mühür öğleden önce geldi. Bu kez bir liste değildi. Tek ad: Selvi. Kâğıdı çevirdim; arkasında iptal emri yoktu. Pencereden evimizin damını gördüm. Kalemi tuttum. Bir damla mürekkep, adın ilk harfini örttü. Üstünden geçtim. Sayfanın kenarı yırtılmış; imzanın yalnız ilk çizgisi kalmış.", "The seal arrived before noon. This time there was no list. One name: Selvi. I turned the paper over; no withdrawal order lay on the back. Through the window I could see our roof. I took the pen. A drop of ink covered the first letter. I traced it again. The page's edge is torn away; only the first stroke of the signature remains."))
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
        story: L("Selvi senden yalnız bir şey istedi: Abi, adımı sen yazma. Altında senin imzan var. Kıyının tuzu onu silemedi.", "Selvi asked only one thing of you: Brother, don't you write my name. Your signature lies beneath it. The shore's salt could not erase it."),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin ikinci parçası', '+1 skill point and the second piece of your past'),
        pages: [
          page('c2.page1', L('Sayfa: Borç Ödendi', 'Page: Debt Paid'),L("Kıyı hesabı: yüz yirmi ad. Kralın vergisi için canlı alınanlar, boş teknelerle geri gönderildi. Fenerci son tekneyi bağlayamadı; halat bir bileğe düğümlenmişti. Benden kayba bir ad vermemi istediler. Defter'e 'borç ödendi' yazdım. Satır kısaydı. Altındaki boşluk yüz yirmi kişiye yetti. — B.", "The shore account: one hundred and twenty names. Those taken alive for the King's levy were returned in empty boats. The keeper could not tie up the last one; its rope was knotted around a wrist. They asked me to give the loss a name. I wrote 'debt paid' in the Ledger. The line was short. The space beneath it held a hundred and twenty people. — B.")),
          page('c2.page2', L('Sayfa: Çancı’nın Mektubu', 'Page: The Bellringer’s Letter'),L("Kâtip, çan sustuğunda ölüler yine suyun dibine çöker. Kral onları sessiz istemiyor. Bana yeni adlar gönder. Ben onları son nefesleriyle uyandırırım. Selvi adlı kız dönüş teknesine bindirilmedi. Kral için ayrıldı. Bunu kıyı hesabına geçirme. Mühür: iç yüzünde tırnak izleri bulunan bir çan.", "Scribe, when the bell falls silent the dead sink again. The King does not want them quiet. Send me new names. I will wake them with their final breaths. The girl called Selvi was not put aboard the returning boat. She was set aside for the King. Do not enter this in the shore account. Seal: a bell scarred by fingernails on its inner face.")),
          page('c2.page3', L('Sayfa: Selvi', 'Page: Selvi'),L("Abi, beni almaya geldiklerinde senden söz etmedim. Elini tanırım. S harfini acele edince alta indirirsin. Adımı sen yazma. Başkası yazsın; onun elini bir gün unutabilirim. Seninkini unutamam. Mektubun altında kıyı teslim kaydı var. İmza Bahtiyar'ın. S harfi satırın altına inmiş.", "Brother, when they came for me I did not speak of you. I know your hand. When you hurry, you let the S fall below the line. Do not write my name. Let someone else write it; one day I might forget their hand. I cannot forget yours. A shore delivery entry lies beneath the letter. Bahtiyar signed it. The S falls below the line."))
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
        story: L("Kralın emrinin altında Kadı'nın mührü var. Yazmayı reddedersen kendi adın yazılacak, diri gömüleceksin. Tehdit gerçekti. Yazdığın insanlar da gerçekti.", "The Judge's seal lies beneath the King's order. Refuse to write, and your own name will be written. You will be buried alive. The threat was real. So were the people you condemned."),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin üçüncü parçası', '+1 skill point and the third piece of your past'),
        pages: [
          page('c3.page1', L('Sayfa: Kralın Pazarlığı', 'Page: The King’s Bargain'),L("Kral kendi adını tahttan sildirdi. Kadı onu Defter'in ilk satırına aldı. Karşılığında kralın hükmü, taşın içine kapatılan insanların ağzından çıkacaktı. Saray artık itiraz duymuyordu. İtiraz edenler duvarın içindeydi. Kenara küçük bir not düşülmüş: Satılan ad suçunu unutmaz. Yalnız sahibine itiraf ettirmez.", "The King had his name removed from the throne. The Judge took it into the Ledger's first line. In return, royal commands would issue from the mouths of people sealed inside the stone. The palace heard no objections now. Those who objected were inside its walls. A small note in the margin reads: A sold name does not forget its crime. It merely stops its owner confessing.")),
          page('c3.page2', L('Sayfa: Kâtibin Atanması', 'Page: The Scribe Appointed'),L("Bahtiyar, oğlum. Temiz yazın, sakin elin, itaatkâr sessizliğin var. Bundan sonra Kara Defter'i sen tutacaksın. Adlar sana ağır gelirse yüzlerini düşünme. Hükmün sorumluluğu mühürde, işinin doğruluğu harflerdedir. Kralın imzasının altında kâtibin ilk deneme satırı var. Kâğıt silinmiş; ucunda bir adamın adı kalmış.", "Bahtiyar, my son. You have a clean script, a steady hand, an obedient silence. From now on you will keep the Black Ledger. If the names weigh on you, do not think of faces. The seal bears responsibility for the sentence; the letters bear witness to the accuracy of your work. Beneath the King's signature lies the scribe's first practice line. The paper has been erased. A man's name remains at its edge.")),
          page('c3.page3', L('Sayfa: Kadı’nın Emri', 'Page: The Judge’s Order'),L("Kâtip ad yazmayı reddederse son satıra kendi adı geçirilsin. Cellat onu diri gömsün. Ağzına, susturduğu kişinin mezarından toprak koyulsun. Defter beklemeyi bilir. Yazı bitmediği sürece hüküm de bitmez. Emrin mührü kralın değil: kara bir göz. Kâğıdın altında bir itiraz yok. Yalnız teslim alındı işareti var.", "Should the scribe refuse to write, let his own name be entered on the last line. Let the Executioner bury him alive. Fill his mouth with earth from the grave of the person he silenced. The Ledger knows how to wait. While the writing continues, the sentence does not end. The seal is not the King's: a black eye. No objection appears beneath the order. Only an acknowledgment of receipt."))
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
        story: L("Halka hesabında bir satır eksik. Kadı, senin elin durduğunda başka bir el aramış. Yanık itirafında korkunu yazmışsın; boş bıraktığın satırda şimdi kendi adın bekliyor.", "A line is missing from the link account. When your hand stopped, the Judge sought another. You wrote your fear in a burned confession; now your own name waits in the line left empty."),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve geçmişin dördüncü parçası', '+1 skill point and the fourth piece of your past'),
        pages: [
          page('c4.page1', L('Sayfa: Halka Hesabı', 'Page: The Link Account'),L("Halka hesabı. Bir ad, bir halka. Bir halka, ateşte bir gün. Beden dayanmazsa kemiği tutulur; kemik dağılırsa adı tutulur. Ateşe sayı yetmez, tanıklık gerekir. Kâtip yazmaya devam ettikçe ocak sönmez. Bu ay on bin halka. Aynı sayının altına ikinci bir el tek kelime yazmış: İnsan.", "The link account. One name, one link. One link, one day in the fire. If the body fails, keep the bone; if the bone crumbles, keep the name. The fire needs testimony, not merely a number. As long as the scribe writes, the furnace does not die. Ten thousand links this month. Beneath that number another hand has written one word: Human.")),
          page('c4.page2', L('Sayfa: Selvi’nin Halkası', 'Page: Selvi’s Link'),L("Sevk emri: Selvi adıyla açılan hesap, Kara Kadı'nın kendi mührüyle ayrılmıştır. Gerekçe: Kız, kâtibin harflerini çocukluğundan bilir. Elleri bozulmadan arşive teslim edilsin. Emrin altında teslim alındı işareti yok. Yanık kenarda beş parmağın izi var; kimin eli olduğu belli değil.", "Transfer order: The account opened under Selvi's name has been reserved under the Black Judge's own seal. Reason: The girl has known the scribe's letters since childhood. Deliver her to the archive with her hands intact. No acknowledgment of receipt appears beneath the order. Five fingers mark the burned edge; whose hand it was is unclear.")),
          page('c4.page3', L('Sayfa: Yanmış İtiraf', 'Page: A Burned Confession'),L("Korktum. Kendi adımı düşündüm. Toprağın ağzıma dolmasını düşündüm. Onunkini yazdım. Sonra Defter'i ateşe tuttum. Yapraklar karardı; Selvi'nin adı kararmadı. Kalemimi kırdım. Yeni bir kalem getirdiler. Elim durursa başka bir el bulacaklarını söylediler. Bu yüzden yazmış olmam, yazmadığım anlamına gelmiyor. — B. Son cümle yarıya kadar yanmış.", "I was afraid. I thought of my own name. I thought of earth filling my mouth. I wrote hers. Then I held the Ledger to the fire. The leaves blackened; Selvi's name did not. I broke my pen. They brought another. They said that if my hand stopped, they would find a different hand. Writing for that reason does not mean I did not write. — B. The last sentence is half burned away."))
        ], fallbacks: [{ room: 1, dx: 7, dz: 4 }, { room: 6, dx: -7, dz: -3 }, { room: 8, dx: 6, dz: 4 }] }
    ],
    5: [
      { id: 'c5-rescue', kind: 'rescue', site: 'selvi-cell', goal: 'selvi-goal', requiresMain: 1, fallback: { index: .7 }, voice: null,
        name: L('Selvi’yi Eve Götür', 'Take Selvi Home'), npc: L('Selvi', 'Selvi'),
        description: L('Yazı masasındaki bağını çözdükten sonra Selvi’yi Kara Defter’in gölgesinden çıkar ve yemin taşına götür.', 'Once her bond to the writing desk is broken, lead Selvi out of the Black Ledger’s shadow to the oath stone.'),
        objective: L('Selvi’yi yemin taşına götür.', 'Lead Selvi to the oath stone.'), follow: L('Selvi’yi yemin taşına götür.', 'Lead Selvi to the oath stone.'),
        freeStory: L('Selvi senin arkandan yürüyor; mürekkebin yaktığı bileğini tutuyor. Kalem gitmiş, eli hâlâ yazacakmış gibi kasılıyor.', 'Selvi walks behind you, holding the wrist burned by ink. The pen is gone; her hand still contracts as if she must write.'),
        story: L('Selvi yemin taşına avucunu koyuyor. Parmakları hâlâ kasılıyor; bu kez elini geri çekebiliyor: “Abi, son satırı ben yazmayacağım. Sen de yazma.”', 'Selvi lays her palm on the oath stone. Her fingers still contract; this time she can draw her hand away: “Brother, I will not write the last line. Don’t you write it either.”'),
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
        story: L("Son sayfada elin sakin. Selvi'nin adı açık, imzan sağlam. Kadı seni geri getirmek için satırı boş bıraktı. Seni burada tutan şey yalnız Kadı'nın hükmü değil. Altındaki imzan.", "On the last page, your hand is steady. Selvi's name is clear. Your signature is firm. The Judge left one line empty to bring you back. It is not only his sentence that binds you here. It is your signature beneath it."),
        reward: { points: 1 }, rewardText: L('+1 yetenek puanı ve gerçeğin son parçası', '+1 skill point and the last piece of the truth'),
        pages: [
          page('c5.page1', L('Sayfa: Kadı’nın Sabrı', 'Page: The Judge’s Patience'),L("Kâtibin öldüğünü sanıyorlar. Ölmedi. Son satırı boş bıraktım. Aç kaldığında değil, kendi yazdıklarını gördüğünde geri gelecek. Geldiğinde kalemi kardeşi tutsun. Defter'i benden almak isteyecek. Ona tek bir adı silme hakkı verirsem bütün ötekileri yeniden yazmayı kabul eder. Kara gözün mührü kâğıdı delmiş.", "They think the scribe is dead. He is not. I left the final line empty. Hunger will not bring him back; the sight of what he wrote will. Let his sister hold the pen when he comes. He will want to take the Ledger from me. Give him the right to erase one name and he will agree to write all the others again. The black eye's seal has pierced the paper.")),
          page('c5.page2', L('Sayfa: Selvi’nin Günlüğü', 'Page: Selvi’s Diary'),L("Her gece onun el yazısını taklit ediyorum. Kadı bazı harfleri düzeltiyor; adımı yazdığı çizgiyi beğeniyor. Bileğimdeki zincir deriye gömüldü. Kalemi yere koyduğumda masadaki isimler ağlıyor. Abi, gelirsen beni eve götür. Ama bu masaya sen oturma. Benim için başka birini yazma. — Selvi.", "Every night I copy his handwriting. The Judge corrects some letters; he likes the stroke that wrote my name. The chain at my wrist has sunk into the skin. When I put down the pen, the names on the desk weep. Brother, if you come, take me home. But do not sit at this desk. Do not write someone else for me. — Selvi.")),
          page('c5.page3', L('Sayfa: Son Satır', 'Page: The Last Line'),L("Selvi. Harfler düzgün. Altında Bahtiyar'ın imzası var. Bir satır aşağıda boşluk duruyor. Kenardaki not: Kadı yaşarken hiçbir satır silinmez. Son tanık kendi adını yazarsa sicil kapanır. Kâğıdı yakarsa adlar kurtulur; taşıdıkları hatıra kurtulmaz. Kâtip, yazdığını hatırlamaya devam eder. Kalemi alırsa sicil devam eder.", "Selvi. The letters are even. Bahtiyar's signature lies beneath. One line lower, a space remains. The note in the margin reads: While the Judge lives, no line can be erased. If the last witness writes his own name, the register closes. If he burns the paper, the names escape; their memories do not. The scribe continues to remember what he wrote. If he takes the pen, the register continues."))
        ], fallbacks: [{ index: .25 }, { index: .55 }, { index: .8 }] }
    ]
  };

  // Lines spoken by the narrator when the chapter story turns (keys recorded in narration-quests.js).
  var STORY_BEATS = { 1: { start: 'story1', boss: 'truth1' }, 2: { start: 'story2', boss: 'truth2' }, 3: { start: 'story3', boss: 'truth3' }, 4: { start: 'story4', boss: 'truth4' }, 5: { start: 'story5', boss: null } };

  // The campaign finale (chapter 5, after its master falls). Choice text varies with the pages read across the campaign.
  var FINALE = {
    title: L('Son satır', 'The last line'),
    question: L("Kadı düştü. Defter'e bağlı insanlar hâlâ adlarını taşıyor. Son satır ve kalem önünde: birini kurtarmanın bedelini yine başkasına mı yazacaksın?", "The Judge has fallen. Those bound to the Ledger still bear their names. The final line and the pen lie before you: will you write the price of saving one person against somebody else again?"),
    truth: L("Bütün sayfaları okudun: Selvi'nin adını yazan el seninki. Kendi adın sicili kapatır; bu, geçmişi silmez.", "You have read every page: the hand that wrote Selvi's name was yours. Your own name will close the register. It will not erase the past."),
    options: [
      { id: 'name', name: L('Adını son satıra yaz', 'Write your name on the last line'), effect: L("Defter'e bağlı bütün adlar özgür kalır. Sen son hükmü üstlenir ve kabre dönersin.", "Every name bound to the Ledger goes free. You bear its final sentence and return to the grave."), voice: 'endingName',
        story: L("Bu kez kendi adını yazıyorsun. Zincirler birer birer düşerken kabirler ilk kez sessiz. Toprak ağzını dolduruyor; yeniden nefes almaya çalışmıyorsun. Selvi gün ışığına çıkıyor. Seni bağışladığını söylemiyor. Adını unutmuyor.", "This time, you write your own name. One by one the chains fall, and for the first time the graves are silent. Earth fills your mouth; you no longer struggle for breath. Selvi steps into daylight. She does not say she forgives you. She does not forget your name.") },
      { id: 'burn', name: L('Defter’i yak', 'Burn the Ledger'), effect: L("Mahkûmlar özgür kalır, kim olduklarını unutur. Selvi seni tanımaz; sen hatırlarsın.", "The prisoners go free and forget who they were. Selvi does not know you. You remember."), voice: 'endingBurn',
        story: L("Defter'i ateşe veriyorsun. Adları taşıyanlar özgür kalıyor; fakat annelerini, evlerini, kendi yüzlerini hatırlamıyorlar. Selvi sana bir yabancı gibi bakıyor. Sen her harfi hatırlıyorsun. Mahkûmları kendi pişmanlığından çıkardın. O pişmanlığın içinde yalnız kaldın.", "You set the Ledger alight. Those bound to its names go free, but they remember neither their mothers, their homes, nor their own faces. Selvi looks at you as a stranger. You remember every letter. You freed the prisoners from your remorse. You are left alone inside it.") },
      { id: 'quill', name: L('Kalemi al', 'Take up the pen'), effect: L("Selvi özgür kalır. Yeni Kadı sen olursun; başkalarının hükümleri sürer.", "Selvi goes free. You become the new Judge. Other people's sentences continue."), voice: 'endingQuill',
        story: L("Selvi'nin adını siliyorsun. Kapı onun için açılıyor. Kalem avucuna gömülürken ilk boş satır yeniden beliriyor. Birini kurtarmak için bir başkasını yazacağını söylüyorsun. Yirmi yıl önce de böyle başlamıştın. Kara Kadı öldü. Elin hâlâ yazıyor.", "You erase Selvi's name. The door opens for her. As the pen sinks into your palm, the first empty line appears again. You tell yourself you will write another name to save one person. That was how it began twenty years ago. The Black Judge is dead. Your hand is still writing.") }
    ]
  };

  // Verdict leanings change what the living say and how the story closes.
  var LEAN = {
    rescueMercy: L('Gözlerinde korku yok. Merhametinin adı ondan önce bu salonlara ulaşmış.', 'There is no fear in their eyes. Word of your mercy reached these halls before you did.'),
    rescueWrath: L('Seni görünce titriyor. Verdiğin hükümlerin sesi senden önce gelmiş; yine de elini tutuyor.', 'They tremble at the sight of you. The sound of your verdicts arrived first; still, they take your hand.'),
    epi: {
      name: [L("Selvi her bahar mezarına gelir. Bağışlandığını söylemez; seni, yalnız yazdıklarınla aynı şey yapmamak için, kendi adınla anar.", "Selvi comes to your grave each spring. She does not call you forgiven. She speaks your own name, so that remembering you will not repeat what you did to others."),
             L("Mezarının başında bir taş var, unvan yok. Kurtulanlar kâtibi hatırlar. Adını söylerken ne borç ne minnet taşırlar.", "A stone stands at your grave, without a title. Those who escaped remember the scribe. They speak your name without debt or gratitude.")],
      burn: [L("Selvi adını sormadan sana su uzatır. Seni hatırlamadan gösterdiği bu küçük merhameti hak ettiğini söyleyemezsin.", "Selvi offers you water without asking your name. You cannot claim to deserve this small kindness she shows without remembering you."),
             L("Kül soğur. Onlar ilk kez hafiftir. Her adı, her yüzü, her satırı taşıyan tek kişi sensin; mezara sığmayan azap budur.", "The ash cools. For the first time, their burden is light. You alone carry every name, every face, every line. This torment will not fit inside a grave.")],
      quill: [L("İlk sayfaya merhamet yazarsın. Kalem boşluğu açar; altına bir ad ister. Bir insanı kurtarmak için bir başka insan seçmen yeterlidir.", "You write mercy on the first page. The pen opens a space and demands a name beneath it. You need only choose one person to save another."),
              L("İlk satırda bir başkasının adı var. Elin titremez. Selvi kapının dışındadır. İçerideki insanların kardeşleri de vardır.", "Someone else's name fills the first line. Your hand does not tremble. Selvi is beyond the door. The people inside have siblings too.")]
    }
  };

  function resolveEnding(claimed, savedId) {
    var valid = function (id) { return FINALE.options.some(function (opt) { return opt.id === id; }); };
    var earned = (Array.isArray(claimed) ? claimed : []).filter(function (key) { return typeof key === 'string' && key.indexOf('c5:finale:') === 0 && valid(key.slice('c5:finale:'.length)); });
    if (earned.length === 1) return earned[0].slice('c5:finale:'.length);
    if (earned.length > 1) return valid(savedId) && earned.includes('c5:finale:' + savedId) ? savedId : earned[earned.length - 1].slice('c5:finale:'.length);
    return valid(savedId) ? savedId : null;
  }

  // Rebuild only the already-earned ending reflection from the verdict ledger.
  function endingReflection(id, claimed) {
    if (!LEAN.epi[id]) return null;
    var verdicts = (Array.isArray(claimed) ? claimed : []).filter(function (key) { return typeof key === 'string' && key.indexOf(':verdict:') > 0; });
    var mercy = verdicts.filter(function (key) { return /:(rest|break|silence|release|erase|open|free|starve|shelter)$/.test(key); }).length;
    var wrath = verdicts.length - mercy;
    return { text: LEAN.epi[id][mercy >= wrath ? 0 : 1], mercy: mercy, wrath: wrath };
  }

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
      var g = B.app && B.app.game; if (r && (r.xp || r.hp || r.damage) && g && g.syncProgression) g.syncProgression(false);
      return r;
    }
    function boons() { var p = prog(); return p && p.boons ? p.boons() : { points: 0, flasks: 0, hp: 0, damage: 0, claimed: [] }; }
    function say(key) { if (key && B.Audio && B.Audio.say) B.Audio.say(key); }
    function lineText(key) { var lines = KabirI18n.lang === 'en' ? B.NarrationEN : B.Narration; return lines && lines[key] ? lines[key].text : ''; }
    function lineDuration(key) { var lines = KabirI18n.lang === 'en' ? B.NarrationEN : B.Narration; return lines && lines[key] && Number.isFinite(lines[key].duration) ? lines[key].duration : 0; }
    var storyGateClock = 0;
    // Campaign leaning from every main-quest verdict so far: mercy (rest, break, free…) against judgment.
    function tally() {
      var v = boons().claimed.filter(function (k) { return k.indexOf(':verdict:') > 0; });
      var mercy = v.filter(function (k) { return /:(rest|break|silence|release|erase|open|free|starve|shelter)$/.test(k); }).length;
      return { mercy: mercy, wrath: v.length - mercy, total: v.length, lean: v.length < 2 ? '' : mercy >= v.length - mercy ? 'mercy' : 'wrath' };
    }
    var cinema = function () { return B.QuestCinema; };

    // ---- props (merged per material, like quests.js; no lights, no per-frame allocation)
    var pageSurface = null, pageTexture = null;
    function parchmentSurface() {
      if (pageSurface) return pageSurface;
      var canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      var context = canvas.getContext('2d'), seed = 7139;
      function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
      var pixels = context.createImageData(256, 256);
      for (var y = 0; y < 256; y++) for (var x = 0; x < 256; x++) {
        var edge = Math.min(x, y, 255 - x, 255 - y), mottling = Math.sin(x * .031 + Math.sin(y * .041)) * 5 + random() * 13;
        var shade = Math.max(0, 18 - edge) * .9, i = (y * 256 + x) * 4;
        pixels.data[i] = 205 + mottling - shade; pixels.data[i + 1] = 187 + mottling - shade;
        pixels.data[i + 2] = 147 + mottling - shade; pixels.data[i + 3] = 255;
      }
      context.putImageData(pixels, 0, 0);
      context.strokeStyle = 'rgba(60,39,23,.68)'; context.lineWidth = 1.3;
      for (var line = 0; line < 11; line++) {
        var penX = 25, penY = 33 + line * 16, end = 175 + random() * 50;
        while (penX < end) {
          var width = 3 + random() * 6;
          context.beginPath(); context.moveTo(penX, penY);
          context.bezierCurveTo(penX + 1, penY - 2 - random() * 6, penX + width, penY + 4, penX + width, penY);
          context.stroke(); penX += width + 1 + (random() > .8 ? 5 : 0);
        }
      }
      // Decorative handwriting is a texture; the readable story remains in the journal.
      pageTexture = new T.CanvasTexture(canvas); pageTexture.colorSpace = T.SRGBColorSpace; pageTexture.anisotropy = 4;
      pageSurface = new T.MeshStandardMaterial({ name: 'aged-quest-parchment', map: pageTexture, color: 0xffffff, roughness: .92, metalness: 0 });
      return pageSurface;
    }
    function prop(kind, x, y, z) {
      var g = new T.Group(), body = [], glowParts = [], lid = [], chains = [];
      g.position.set(x, y, z); g.matrixAutoUpdate = false; g.updateMatrix(); kit.root.add(g);
      var S = kit.stone, M = kit.metal, R = kit.trim, G = kit.glow, Wd = kit.wood, mt = kit.materials || {};
      var BLOOD = mt.blood || mt['coast-corpse-flesh'] || mt.lava || mt.hot || G, EMBER = mt.ember || mt.fire || mt.lava || mt.hot || mt.lamp || G;
      var PAPER = kind === 'page' ? parchmentSurface() : mt.shroud || mt.cloth || mt.pale || S, BONE = mt.bone || mt['coast-corpse-bone'] || S;
      g.scale.setScalar(1.3); g.updateMatrix();
      if (kind === 'page') {
        kit.put(body, S, new T.CylinderGeometry(.5, .6, .1, 8), 0, .05, 0, 0, PI / 8);
        kit.put(body, mt.bone || S, new T.CylinderGeometry(.42, .49, .055, 8), 0, .126, 0, 0, PI / 8);
        kit.ring(body, R, .47, .014, 0, .157, 0, PI / 2);
        kit.box(body, Wd, .1, .86, .1, 0, .52, 0);
        kit.box(body, R, .18, .035, .18, 0, .14, 0); kit.box(body, R, .15, .035, .15, 0, .78, 0);
        kit.box(body, Wd, .055, .36, .055, -.11, .77, 0, 0, 0, -.63);
        kit.box(body, Wd, .055, .36, .055, .11, .77, 0, 0, 0, .63);
        for (var foot = 0; foot < 2; foot++) {
          var footAngle = foot * PI / 2;
          kit.box(body, Wd, .055, .04, .7, 0, .14, 0, 0, footAngle);
        }
        kit.box(body, Wd, .62, .05, .46, 0, .93, 0, -.5); kit.box(body, R, .66, .025, .03, 0, .87, .2, -.5);
        kit.box(body, PAPER, .44, .012, .32, 0, .965, .01, -.5); kit.box(body, PAPER, .2, .01, .28, .12, .975, .02, -.5, .12);
        kit.cyl(body, mt.wax || PAPER, .035, .04, .16, .26, .99, -.14); kit.put(glowParts, EMBER, new T.ConeGeometry(.022, .07, 6), .26, 1.1, -.14);
        // Parchment and a wax seal replace the flat luminous page marker.
        kit.cyl(body, mt.wax || R, .028, .028, .009, .155, 1.02, .10, -.5);
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
          var wish = [def.female ? 'selvi' : null, 'prisoner', 'gravemason', 'drowned', 'emberbound', 'cultist', 'ashbound', 'lantern', 'chainseer', 'damned', 'verdictseer'].filter(Boolean);
          var pick = wish.find(function (t) { return types[t] && (types[t].chapter || 1) === active; }) || Object.keys(types).find(function (t) { return t !== 'hero' && (types[t].chapter || 1) === active; }) || 'prisoner';   // chapter V owns none of the older figures: use one of its own (only the active chapter's bases are decoded)
          actor.model = B.Models.create(pick); actor.root = actor.model.root;
          actor.authoredSelvi = pick === 'selvi' && !!types[pick].narrativeActor;
          actor.root.traverse(function (n) { if (n.name === 'weapon') n.visible = false; });
          actor.root.scale.setScalar(actor.authoredSelvi ? 1 : def.female ? .9 : .97);
        }
      } catch (e) { console.warn('[quests] captive model', e && e.message); actor.model = null; actor.root = null; }
      if (!actor.root) {
        var parts = [], grp = new T.Group();
        kit.cyl(parts, kit.wood, .28, .18, 1.1, 0, .55, 0); kit.put(parts, kit.stone, new T.SphereGeometry(.16, 10, 8), 0, 1.25, 0); kit.merge(parts, grp); actor.root = grp;
      }
      actor.root.name = def.npc; kit.root.add(actor.root);
      // A pale oath ring under the living captive keeps them apart from the hostile dead that share their silhouette.
      if (!actor.authoredSelvi) {
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
      }
      if (actor.authoredSelvi && actor.model.animate) {
        actor.cower = .58; actor.model.animate(0, { reset: true, time: 0, move: 0, attackTime: -1, beatTime: -1, fear: actor.cower, dead: false });
        for (var settle = 0; settle < 12; settle++) actor.model.animate(1 / 60, { time: settle / 60, move: 0, attackTime: -1, beatTime: -1, fear: actor.cower, dead: false });
      }
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

    function boundSelvi(q, bound) {
      if (!q.actor || !q.actor.authoredSelvi || q.def.id !== 'c5-rescue') return;
      var a = q.actor;
      if (bound) {
        var desk = (info.markers || []).find(function (m) { return m.id === 'selvi-cell'; });
        if (desk) {
          var candidates = [[.98, .32], [-.98, .32], [.98, -.32], [-.98, -.32]];
          for (var k = 0; k < candidates.length; k++) {
            var x = desk.x + candidates[k][0], z = desk.z + candidates[k][1];
            if (!world.isWalkable || world.isWalkable(x, z, .42)) { a.x = x; a.z = z; break; }
          }
          a.face = Math.atan2(desk.x - a.x, desk.z - a.z); a.boundDesk = true;
        }
        a.cower = .58;
      }
      a.root.traverse(function (mesh) { if (mesh.name === 'phase-selvi-cuffs') mesh.visible = bound; });
      animateActor(a, 0);
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
        if (d.kind === 'rescue' && q.actor) {
          var held = d.requiresMain != null && !mainDone(d.requiresMain) && !s.stage;
          q.actor.root.visible = q.actor.authoredSelvi || !held;
          boundSelvi(q, held);
        }
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
        grant('read:' + pg.site, {});   // Recorded page only; no XP, points, equipment or other reward.
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
      var t = endingReflection(optionId, boons().claimed), extra = t ? t.text : '';
      var parts = opt.story.replace(/([.!?”])\s+/g, '$1\n').split('\n'), paras = [];
      for (var pi = 0; pi < parts.length; pi += 2) paras.push(parts.slice(pi, pi + 2).join(' '));
      if (extra) paras.push(extra);
      if (cinema()) setTimeout(function () { cinema().epilogue({ id: optionId, title: opt.name, paragraphs: paras, tally: L('Merhamet ', 'Mercy ') + t.mercy + ' · ' + L('Yargı ', 'Judgment ') + t.wrath }); }, 1200);
      return true;
    }

    // ---- per-frame
    // A freed Selvi walks around her physical writing desk. This changes only
    // her local route: the authored escort goal, stage, speed and rewards stay.
    function selviDeskRoute(a, route) {
      if (!a.authoredSelvi || !a.boundDesk || !route || !route.length) return route;
      var desk = (info.markers || []).find(function (m) { return m.id === 'selvi-cell'; });
      if (!desk) return route;
      var sx = .5275 + .38 + .04, sz = .33 + .38 + .04;
      function inside(p) { return Math.abs(p.x - desk.x) < sx && Math.abs(p.z - desk.z) < sz; }
      function crosses(from, to) {
        var enter = 0, exit = 1, axes = [['x', desk.x - sx, desk.x + sx], ['z', desk.z - sz, desk.z + sz]];
        for (var j = 0; j < 2; j++) {
          var axis = axes[j], delta = to[axis[0]] - from[axis[0]];
          if (Math.abs(delta) < 1e-8) { if (from[axis[0]] <= axis[1] || from[axis[0]] >= axis[2]) return false; continue; }
          var lo = (axis[1] - from[axis[0]]) / delta, hi = (axis[2] - from[axis[0]]) / delta;
          enter = Math.max(enter, Math.min(lo, hi)); exit = Math.min(exit, Math.max(lo, hi));
          if (enter >= exit) return false;
        }
        return exit > 0 && enter < 1 && enter < exit;
      }
      var corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(function (sign) {
        return { x: desk.x + sign[0] * (sx + .03), z: desk.z + sign[1] * (sz + .03), selviDesk: true };
      }).filter(function (p) { return !world.isWalkable || world.isWalkable(p.x, p.z, .4); });
      function detour(from, to) {
        if (!crosses(from, to)) return [to];
        var nodes = [from, to].concat(corners), distance = nodes.map(function () { return Infinity; }), prior = nodes.map(function () { return -1; }), done = [];
        distance[0] = 0;
        for (var count = 0; count < nodes.length; count++) {
          var best = -1;
          for (var i = 0; i < nodes.length; i++) if (!done[i] && (best < 0 || distance[i] < distance[best])) best = i;
          if (best < 0 || !Number.isFinite(distance[best])) break;
          if (best === 1) { var indices = [], at = 1; while (at > 0) { indices.unshift(at); at = prior[at]; } return indices.map(function (i) { return nodes[i]; }); }
          done[best] = true;
          for (var next = 1; next < nodes.length; next++) {
            if (done[next] || crosses(nodes[best], nodes[next])) continue;
            if (world.hasClearPath && !world.hasClearPath(nodes[best].x, nodes[best].z, nodes[next].x, nodes[next].z, .4)) continue;
            var d = distance[best] + Math.hypot(nodes[next].x - nodes[best].x, nodes[next].z - nodes[best].z);
            if (d < distance[next]) { distance[next] = d; prior[next] = best; }
          }
        }
        return []; // Wait outside the furniture if a real nav obstacle blocks both sides.
      }
      var result = [], from = { x: a.x, z: a.z };
      for (var i = 0; i < route.length; i++) {
        if (inside(route[i])) continue;
        var segment = detour(from, route[i]); if (!segment.length) break;
        Array.prototype.push.apply(result, segment); from = route[i];
      }
      return result;
    }

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
        if (a.repath <= 0 && gap > 1.1) { a.repath = .4; a.route = world.pathTo ? world.pathTo({ x: a.x, z: a.z }, { x: tx, z: tz }, .4) : [{ x: tx, z: tz }]; a.route = selviDeskRoute(a, a.route); a.leg = 0; }
        // Progress watchdog: if the gap has not shrunk for 2.5 s (door, ledge, odd nav cell), step in behind the hero.
        if (gap <= 3 || a.best === undefined || gap < a.best - .3) { a.best = gap; a.stuck = 0; } else a.stuck = (a.stuck || 0) + dt;
        if (gap > 22 || a.stuck > 2.5 || gap > 6 && !(a.route && a.route.length)) { a.x = tx; a.z = tz; gap = 0; a.route = null; a.stuck = 0; a.best = undefined; }
        var wp = a.route && a.route[a.leg || 0];
        while (wp && Math.hypot(wp.x - a.x, wp.z - a.z) < (wp.selviDesk ? .04 : .25) && a.leg < a.route.length - 1) wp = a.route[++a.leg];
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
        if (q.def.kind === 'rescue' && q.def.requiresMain != null && !s.stage && mainDone(q.def.requiresMain)) { s.stage = 1; if (!q.actor.boundDesk) { q.actor.x = q.captive.x + .9; q.actor.z = q.captive.z + .6; } dirty = true; }
      }
      // Captions and narration belong to visible play, not time spent in menus or reading a page.
      var gm = B.app && B.app.game, storyUi = cinema();
      var liveStory = gm && gm.state === 'playing' && B.app.view === 'playing' && (typeof document === 'undefined' || !document.hidden);
      var storyBusy = storyUi && (storyUi.isReading || storyUi.isCaptionVisible);
      if (liveStory && !(storyUi && storyUi.isReading)) beatClock += dt;
      var beats = STORY_BEATS[chapter];
      if (!(local.beats & 4) && beatClock > 2 && liveStory && !storyBusy && storyUi && !gm.checkpointIndex && (gm.elapsed || 0) < 20) {
        var openingVoice = ['intro', 'coastIntro', 'ruinsIntro', 'forgeIntro', 'ch5Intro'][chapter - 1];
        var chapterStory = B.StoryJournal && B.StoryJournal.chapter ? B.StoryJournal.chapter(chapter) : null;
        local.beats |= 4;
        storyUi.letterbox({ kind: 'chapter', eyebrow: L('Bölüm ', 'Chapter ') + ['I', 'II', 'III', 'IV', 'V'][chapter - 1], title: chapterStory ? chapterStory.title : info.title,
          text: lineText(openingVoice) || info.introduction, voiceKey: openingVoice, audioSeconds: lineDuration(openingVoice) });
      }
      if (beats && !(local.beats & 1) && beatClock > 40 && liveStory && !storyBusy && beatClock >= storyGateClock) {
        storyGateClock = beatClock + .5;
        var narration = B.Audio && B.Audio.debug ? B.Audio.debug() : null;
        var calm = !(gm.enemies || []).some(function(e) { return !e.dead && Number.isFinite(e.x) && Math.hypot(e.x - player.x, e.z - player.z) < 13; });
        var recollection = lineText(beats.start);
        if (calm && recollection && (!narration || !narration.current && !(narration.queue || []).length)) {
          local.beats |= 1; say(beats.start);
          if (storyUi) storyUi.letterbox({ eyebrow: info.title, title: L('Hatıra', 'Recollection'), text: recollection, voiceKey: beats.start, audioSeconds: lineDuration(beats.start) });
        }
      }
      if (!(local.beats & 8) && beatClock > 95 && chapter >= 2 && liveStory && !storyBusy) { var tl = tally().lean; if (tl) { local.beats |= 8; say(tl === 'mercy' ? 'leanMercy' : 'leanWrath'); } }
      var g = B.app && B.app.game, boss = g && (g.boss || (g.enemies || []).find(function (e) { return e.boss; }));
      if (boss && boss.dead && !bossSeen) {
        bossSeen = true;
        if (beats && beats.boss && !(local.beats & 2)) { local.beats |= 2; say(beats.boss); if (cinema()) cinema().letterbox({ eyebrow: boss.name || '', title: L('Son söz', 'Last words'), text: lineText(beats.boss), voiceKey: beats.boss, audioSeconds: lineDuration(beats.boss) });
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
      beatClock = 0; storyGateClock = 0; bossSeen = false;
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
      info.finale = null;
      local.finale = chapter === 5 ? resolveEnding(boons().claimed, local.finale) : null;
      if (local.finale) { var f = FINALE.options.find(function (x) { return x.id === local.finale; }); if (f) info.finale = { id: f.id, name: f.name, story: f.story }; }
      quests.forEach(function (q) { if (q.actor) { q.actor.root.position.set(q.actor.x, 0, q.actor.z); } });
      refresh();
    }
    function dispose() { disposed = true; if (pageSurface) pageSurface.dispose(); if (pageTexture) pageTexture.dispose(); if (beaconTex) beaconTex.dispose(); beacons.forEach(function (b) { b.mat.dispose(); b.mesh.geometry.dispose(); }); quests.forEach(function (q) { if (q.actor && q.actor.root) q.actor.root.removeFromParent(); }); }
    quests.forEach(function (q) { if (q.actor) animateActor(q.actor, 0); });
    refresh();
    // QA hook: BABA.QuestSide.debug() lists live quest actors and states (no gameplay effect).
    B.QuestSide.debug = function () { return quests.map(function (q) { var s = state[q.def.id]; return { id: q.def.id, stage: s.stage, done: s.done, actor: q.actor ? { x: +q.actor.x.toFixed(2), z: +q.actor.z.toFixed(2), visible: q.actor.root.visible, model: !!q.actor.model } : null, goal: q.goal || null }; }); };
    return { scan: scan, interact: interact, choose: choose, update: update, snapshot: snapshot, restore: restore, dispose: dispose, openFinale: openFinale,
      get count() { return quests.length; } };
  }

  B.QuestSide = { VERSION: 1, chapters: SIDE, finale: FINALE, resolveEnding: resolveEnding, endingReflection: endingReflection, create: create, L: L };
})();
