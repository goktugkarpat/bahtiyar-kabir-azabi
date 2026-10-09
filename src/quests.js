/* KABİR AZABI — persistent story verdicts with explicit, chapter-local consequences.
   Loaded before gate.js / combat.js. create({root,world,chapter,player,emit,sound,fx,onChange})
   returns {info,restore,snapshot,interact,update,dispose}. info is game.quests:
   entries (two), completed/total/ready, objective, prompt, markers, revision.
   Every accepted interaction and irreversible verdict is saved by onChange. Old version-1 saves remain valid.
   Props use the world's already decoded scanned materials and are merged at setup.
   There are no lights, runtime material/geometry/texture creation or per-frame arrays. */
(function () {
  'use strict';
  var B = window.BABA, T = window.THREE, PI = Math.PI, RANGE = 2.35;
  var L5 = (window.BABA && window.BABA.QuestText) || function (tr) { return KabirI18n.t(tr); };
  var CHAPTERS = {
    1: { title: KabirI18n.t('İsimleri Çalınanlar'), introduction: KabirI18n.t('Cellat yalnız bedenleri zincirlememiş. Ölülerin isimlerini ve yeminlerini de kapıya bağlamış.'), quests: [
      { id: 'lost-names', name: KabirI18n.t('İsimsizlerin Yemini'), description: KabirI18n.t('Unutulanların adlarını bul ve sahiplerine geri ver.'), steps: [
        { id: 'names', room: 7, dx: -2.6, dz: 2.6, shape: 'tablet', name: KabirI18n.t('İsim Levhası'), verb: KabirI18n.t('İsim levhasını al'), objective: KabirI18n.t('Unutulanların Mahzeni’nde isim levhasını bul.'), story: KabirI18n.t('Taşa kazınmış her isim bir mahkûma ait. Son satır henüz boş: Bahtiyar. Levhayı Çürüyen Revir’deki anı taşına götür.') },
        { id: 'memorial', room: 2, dx: 4.2, dz: 3, shape: 'memorial', name: KabirI18n.t('Mahkûmların Anı Taşı'), verb: KabirI18n.t('İsimleri anı taşına yerleştir'), objective: KabirI18n.t('Çürüyen Revir’de isimleri anı taşına yerleştir.'), story: L5("İsimler anı taşına geçiyor. Zincirler gevşerken tek bir uğultunun içinden ayrı ayrı insan sesleri duyuluyor. Celladın ilk bağı çözüldü.", "The names pass into the memorial stone. As the chains loosen, individual human voices emerge from the single murmur. The Executioner’s first bond is broken.") }
      ] },
      { id: 'blood-verdict', name: KabirI18n.t('Kanla Yazılan Hüküm'), description: KabirI18n.t('Adak Salonu’ndaki hükmü tersine çevir: önce Kül, sonra Kan, son olarak Yemin.'), steps: [
        { id: 'ash', room: 3, dx: -5.4, dz: 3.4, shape: 'censer', name: KabirI18n.t('Kül Çanağı'), verb: KabirI18n.t('Kül çanağını söndür'), objective: KabirI18n.t('Adak Salonu’nda ayini boz: Kül → Kan → Yemin.'), story: L5("Kül çanağı sönüyor. Kazınmış söz ortaya çıktı: “Beden unutulur; kan tanıklık eder.” Sırada Hüküm Mührü var.", "The Ash Bowl goes out. An inscription appears: “The body is forgotten; blood bears witness.” The Verdict Seal is next.") },
        { id: 'oath', room: 3, dx: 5.4, dz: 3.4, shape: 'seal', name: KabirI18n.t('Hüküm Mührü'), verb: KabirI18n.t('Yemin mührünü tersine çevir'), objective: KabirI18n.t('Adak Salonu’nda Yemin Mührü’nü tersine çevir.'), story: L5("Yemin mührü yerinden ayrılıyor. Mahkeme kapısının kanla beslenen bağı çözülüyor. Yeraltından kıyıya çıkan yolu Cellat koruyor.", "The oath seal comes free. The blood-fed bond on the court’s gate loosens. The Executioner guards the passage from the depths to the shore.") }
      ] }
    ] },
    2: { title: KabirI18n.t('Denizin Sakladığı'), introduction: KabirI18n.t('Kıyıdaki ölüler çanın sesiyle uyanıyor. Fener sönmeden önce burada neler olduğunu hatırlayanlar hâlâ köklerin altında.'), quests: [
      { id: 'last-voice', name: KabirI18n.t('Boğulanların Son Sesi'), description: KabirI18n.t('Batık Gümrük’te kaybolan çan dilini bul; Son Fener’deki yas çanına geri tak.'), steps: [
        { id: 'clapper', room: 7, dx: -2.8, dz: 3, shape: 'relic', name: KabirI18n.t('Kırık Çan Dili'), verb: KabirI18n.t('Kırık çan dilini al'), objective: KabirI18n.t('Batık Gümrük Avlusu’nda kırık çan dilini bul.'), story: KabirI18n.t('Çan diline bir fenercinin yemini kazınmış: “Dönenleri değil, dönmeyenleri çağır.” Son Fener’deki küçük yas çanı bunu bekliyor.') },
        { id: 'mourning-bell', room: 5, dx: -4.5, dz: 4, shape: 'bell', name: KabirI18n.t('Yas Çanı'), verb: KabirI18n.t('Çan dilini yerine tak ve çanı çal'), objective: KabirI18n.t('Son Fener’de çan dilini yas çanına tak.'), story: KabirI18n.t('Yas çanı ilk kez ölüler için çalıyor. Denizdeki çığlıklar bir an durdu; büyük çanın ilk bağı koptu.') }
      ] },
      { id: 'root-memory', name: KabirI18n.t('Kara Kökün Hafızası'), completeStory: L5("İki kabın köklerle bağı çözüldü. Taşta aynı arma beliriyor: boş bir tahtın altında yanan ocak. Çancının ikinci bağı çözüldü.", "Both vessels are freed from the roots. The same device appears on the stone: a furnace burning beneath an empty throne. The Bellringer’s second bond is broken."), description: KabirI18n.t('Kara Ağacın Mezarlığı’ndaki iki mezar kabını aç; köklerin tutsak ettiği hatıraları serbest bırak.'), anyOrder: true, steps: [
        { id: 'grave-west', room: 8, dx: -3.7, dz: 2.8, shape: 'urn', name: KabirI18n.t('Tuzla Mühürlü Mezar Kabı'), verb: KabirI18n.t('Tuz mührünü çöz'), objective: KabirI18n.t('Kara Ağacın Mezarlığı’nda tuzla mühürlü mezar kabını aç.'), story: L5("Mezar kabından kül ve bir sevk izi çıkıyor: krala canlı götürülenler kıyıya adsız dönmüş. Selvi’nin kaydı bu hesabın içinde; dönüşünün izi yok.", "Ash and a delivery trace fall from the burial vessel: those taken alive to the King returned to the shore without names. Selvi’s entry lies in the same account, but there is no record of her return.") },
        { id: 'grave-east', room: 8, dx: 3.7, dz: -2.8, shape: 'urn', name: KabirI18n.t('Kökle Mühürlü Mezar Kabı'), verb: KabirI18n.t('Kök mührünü çöz'), objective: KabirI18n.t('Kara Ağacın Mezarlığı’nda kökle mühürlü mezar kabını aç.'), story: L5("Mezar kabı köklerden ayrılıyor. Taşta boş bir tahtın altında yanan ocak beliriyor. Kıyının acısı o ateşe bağlı.", "The burial vessel comes free of the roots. A furnace burning beneath an empty throne appears on the stone. The shore’s torment is tied to that fire.") }
      ] }
    ] },
    3: { title: KabirI18n.t('Boş Tahtın Altında'), introduction: KabirI18n.t('Kıyının çanı sustu; fakat ölüleri çağıran ses mağaranın içinden geliyor. Kral kendi adını taşın içine saklamış.'), quests: [
      { id: 'kings-name', name: KabirI18n.t('Kralın Çalınmış Adı'), description: KabirI18n.t('Kralların Mezarları’ndaki ad levhasını al ve Çöken Anıt’ın eksik yerine yerleştir.'), steps: [
        { id: 'epitaph', room: 3, dx: 3.8, dz: 3.4, shape: 'tablet', name: KabirI18n.t('Kazınmış Ad Levhası'), verb: KabirI18n.t('Kazınmış ad levhasını al'), objective: KabirI18n.t('Kralların Mezarları’nda kazınmış ad levhasını bul.'), story: KabirI18n.t('Levhanın arkasında başka bir unvan var: “Ocağın ilk mahkûmu.” Kralın adı anıttan sökülmüş; yerine koymalısın.') },
        { id: 'name-monument', room: 5, dx: -3.5, dz: -1.8, shape: 'memorial', name: KabirI18n.t('Kırık Kral Anıtı'), verb: KabirI18n.t('Ad levhasını anıta yerleştir'), objective: KabirI18n.t('Çöken Anıt’ta levhayı eksik yuvaya yerleştir.'), story: L5("Anıtın oyukları birleşiyor. Tahtını korumak için sattığı ad, kralın kendi hükmünün altında ortaya çıkıyor. Tahtın ilk mührü çatladı.", "The hollows of the monument join. The name the King sold to preserve his throne appears beneath his own sentence. The throne’s first seal cracks.") }
      ] },
      { id: 'cave-breath', name: KabirI18n.t('Mağaranın Nefesi'), description: KabirI18n.t('Kör Kristaller’de yankıyı serbest bırak; Taşın İçindeki Ölüler’de son ses bağını sustur.'), steps: [
        { id: 'echo', room: 7, dx: 3.6, dz: 2.7, shape: 'crystal', name: KabirI18n.t('Zincirli Yankı'), verb: KabirI18n.t('Yankının demir bağını aç'), objective: KabirI18n.t('Kör Kristaller’de zincirli yankıyı serbest bırak.'), story: KabirI18n.t('Kristalden bir emir değil, bir insan nefesi yükseliyor. Yankı kuzeydeki son ses bağına cevap veriyor.') },
        { id: 'silence', room: 9, dx: -3.4, dz: 2.2, shape: 'seal', name: KabirI18n.t('Son Ses Bağı'), verb: KabirI18n.t('Son ses bağını sustur'), objective: KabirI18n.t('Taşın İçindeki Ölüler’de son ses bağını sustur.'), story: L5("Ses mührü yerinden ayrıldı. Mağaranın emri kesiliyor; tahtın ardındaki merdiven Kızıl Ocak’a iniyor.", "The voice seal comes free. The cavern’s command falls silent; the stair behind the throne descends to the Crimson Furnace.") }
      ] }
    ] },
    4: { title: KabirI18n.t('Zincirlerin Kaynağı'), introduction: KabirI18n.t('Tapınağın hükmü, kıyının ağıdı, kralın sesi: hepsi bu ocakta dövülmüş. Kapıyı açmak yetmez; kalbi besleyen düzeni de bozmalısın.'), quests: [
      { id: 'last-prisoner', name: KabirI18n.t('Son Mahkûmun Yemini'), description: KabirI18n.t('Kömür Mahkûmları’ndaki yemin halkasını al; Zincir Kuyuları’nın vincinde kullan.'), steps: [
        { id: 'last-shackle', room: 2, dx: -3.8, dz: 2.6, shape: 'relic', name: KabirI18n.t('Son Yemin Halkası'), verb: KabirI18n.t('Yemin halkasını al'), objective: KabirI18n.t('Kömür Mahkûmları’nda son yemin halkasını bul.'), story: KabirI18n.t('Halka elini yakmıyor. Üzerinde mahkûmların ortak yemini var: “Son çıkan, zinciri de kıracak.” Kuyu vincinin kilidine uyuyor.') },
        { id: 'prison-winch', room: 7, dx: 3.8, dz: 2.5, shape: 'winch', name: KabirI18n.t('Mahkûm Vinci'), verb: KabirI18n.t('Halkayı tak ve kuyu zincirlerini bırak'), objective: KabirI18n.t('Zincir Kuyuları’nda yemin halkasıyla vinci aç.'), story: L5("Kuyu vincinin kilidi açıldı. Halkalar artık mahkûmların bedenlerine yük bindirmiyor; ocağın ilk bağı çözüldü.", "The pit winch unlocks. The links no longer bear down on the prisoners’ bodies; the furnace’s first bond is broken.") }
      ] },
      { id: 'heart-feeds', name: KabirI18n.t('Kalbi Besleyen Ateş'), description: KabirI18n.t('Önce döküm akışını, sonra kalbin ana beslemesini kapat.'), steps: [
        { id: 'casting-feed', room: 5, dx: -3.5, dz: 3.3, shape: 'valve', name: KabirI18n.t('Döküm Vanası'), verb: KabirI18n.t('Döküm akışını kapat'), objective: KabirI18n.t('Sönen Dökümhane’de döküm vanasını kapat.'), story: KabirI18n.t('Sıvı demirin sesi azalıyor. Basıncı geri döndüren cüruf hattı hâlâ açık; sıradaki vana Cüruf Meydanı’nda.') },
        { id: 'heart-feed', room: 12, dx: -3.6, dz: 2.5, shape: 'valve', name: KabirI18n.t('Kalp Besleme Vanası'), verb: KabirI18n.t('Kalbin ana beslemesini kes'), objective: KabirI18n.t('Son Döküm’de kalbin ana beslemesini kes.'), story: L5("Ana besleme kesildi. Kalp artık tutsaklardan beslenemiyor; ama kendi ateşi hâlâ canlı. Ocağı ayakta tutan o ateş içeride.", "The main feed is cut. The Heart can no longer feed on the captives, but its own fire still lives. The fire that sustains the furnace waits within.") }
      ] }
    ] }
  };

  // ajan:quests — chapter 5 (Kara Defter). Sites come from world.questSites (see STORY.md); fallbacks spread along the rooms.
  CHAPTERS[5] = { title: L5('Kara Defter', 'The Black Ledger'), introduction: L5("Selvi senin el yazını taklit ederek Kara Defter'i doldurmaya zorlanıyor. Kadı, bir kâtibin yerine başkasını bağladı; kardeşini kurtarırken onun yerine geçmeni bekliyor.", "Selvi is forced to fill the Black Ledger by copying your handwriting. The Judge chained one scribe in another's place; he expects you to take her seat when you rescue her."), quests: [
    { id: 'four-seals', name: L5('Efendilerin Mühürleri', 'The Masters’ Seals'), anyOrder: true, voice: 'questSeals',
      completeStory: L5('Üç mühür yerinde. Defter’in kilidi çözülüyor; sayfalar kendiliğinden çevriliyor ve senin el yazına geliyor.', 'All three seals are in place. The Ledger’s lock gives way; its pages turn by themselves until they reach your handwriting.'),
      description: L5('Düşürdüğün efendilerin mühürlerini arşivin üç kürsüsüne koy. Defter’in kilidi ancak böyle açılır.', 'Lay the seals of the masters you felled on the archive’s three lecterns. Only then will the Ledger’s lock open.'), steps: [
      { id: 'ledger-seal-1', fallback: { index: .3 }, shape: 'seal', name: L5('Cellat’ın Mührü', 'The Executioner’s Seal'), verb: L5('Cellat’ın mührünü kürsüye koy', 'Lay the Executioner’s seal on the lectern'), objective: L5('Arşivde Cellat’ın mührünün kürsüsünü bul.', 'Find the lectern for the Executioner’s seal in the archive.'), story: L5('Cellat’ın mührü kürsüye oturuyor. Taştan bir fısıltı yükseliyor: “Sen yazdın, ben kestim.”', 'The Executioner’s seal settles on the lectern. A whisper rises from the stone: “You wrote, I cut.”') },
      { id: 'ledger-seal-2', fallback: { index: .45 }, shape: 'memorial', name: L5('Çancı’nın Mührü', 'The Bellringer’s Seal'), verb: L5('Çancı’nın mührünü kürsüye koy', 'Lay the Bellringer’s seal on the lectern'), objective: L5('Arşivde Çancı’nın mührünün kürsüsünü bul.', 'Find the lectern for the Bellringer’s seal in the archive.'), story: L5('Çan mührü yerine oturuyor. Raflar arasında deniz tuzu kokusu yayılıyor; yüz yirmi ad bir an soluk alıyor.', 'The bell seal settles into place. The smell of sea salt drifts between the shelves; a hundred and twenty names breathe for a moment.') },
      { id: 'ledger-seal-3', fallback: { index: .62 }, shape: 'tablet', name: L5('Kralın Mührü', 'The King’s Seal'), verb: L5('Kralın mührünü kürsüye koy', 'Lay the King’s seal on the lectern'), objective: L5('Arşivde Kralın mührünün kürsüsünü bul.', 'Find the lectern for the King’s seal in the archive.'), story: L5('Kralın mührü kürsüye yerleşiyor. Defter’in ilk satırındaki ad soluyor: tahta satılmış bir ad.', 'The King’s seal settles on the lectern. The name on the Ledger’s first line fades: a name sold for a throne.') }
    ] },
    { id: 'selvi', name: L5('Selvi', 'Selvi'), voice: 'questSelvi', description: L5('Kadı’nın yeni kâtibi, senin kız kardeşin. Yazı masasına zincirli; kalemi bırakamıyor.', 'The Judge’s new scribe, your sister. Chained to the writing desk; she cannot put the pen down.'), steps: [
      { id: 'selvi-cell', fallback: { index: .8 }, shape: 'seal', name: L5('Selvi’nin Yazı Masası', 'Selvi’s Writing Desk'), verb: L5('Selvi’nin zincirini çöz', 'Break Selvi’s chain'), objective: L5('Arşivin derinlerinde Selvi’nin yazı masasını bul.', 'Find Selvi’s writing desk deep in the archive.'), story: L5('Selvi başını kaldırıyor: “Abi. Adımı sen yazdın, biliyorum. Yine de geldin.”', 'Selvi raises her head: “Brother. You wrote my name, I know. Still, you came.”') }
    ] }
  ] };

  // The ledger introductions carry the campaign arc (who Bahtiyar was, what each master owes him).
  CHAPTERS[1].introduction = L5("Seni ölü sanıp Kurban Tapınağı'nın kuyusuna attılar. Yirmi yıl Kara Defter'e ad yazan elin şimdi toprağı kazıyor; hükmettiğin insanlar Cellat'ın kapısına bağlanmış.", "They thought you dead and threw you into the well of the Temple of Sacrifice. The hand that wrote names in the Black Ledger for twenty years now claws at the earth; the people you condemned are bound to the Executioner's gate.");
  CHAPTERS[2].introduction = L5("Defter'e 'borç ödendi' diye kaydettiğin kıyıdasın. Çan, boğulanları her defasında son nefeslerine döndürüyor; kız kardeşin Selvi'nin sevk kaydı bu insanların arasından geçiyor.", "You stand on the shore you recorded as 'debt paid.' Each toll returns the drowned to their final breath; your sister Selvi's delivery record passes through the same account.");
  CHAPTERS[3].introduction = L5("Kralın emirleri taşın içine kapatılmış insanların nefesinden çıkıyor. Sana kalemi veren kral kendi adını sakladı; Selvi'ye ulaşan yol onun unvanının ardında.", "The King's commands issue from the breaths of people sealed within the stone. The King who gave you the pen hid his own name; the path to Selvi lies behind his title.");
  CHAPTERS[4].introduction = L5("Tapınağın hükmünü, kıyının boğulmasını ve kralın emrini besleyen düzenin kalbindesin. Yazdığın her ad burada bitmeyen bir ateş gününe çevrildi; Selvi'nin halkasını arıyorsun.", "You stand at the heart of the order that fed the temple's sentence, the shore's drowning and the King's command. Every name you wrote became an endless day of fire here; you seek Selvi's link.");

  // The blood rite becomes a riddle: all three bowls answer, the incisions on their fronts (I, II, III) and the inscription give the order,
  // and a wrong bowl spills the hero's blood and resets the rite.
  (function (rite) {
    rite.description = L5('Adak Salonu’ndaki hükmü tersine çevir: önce Kül Çanağı’nı söndür, sonra Hüküm Mührü’nü çevir.', 'Reverse the sentence in the Hall of Offerings: put out the Ash Bowl first, then turn the Verdict Seal.');
    rite.steps[0].objective = L5('Adak Salonu’nda Kül Çanağı’nı söndür.', 'Put out the Ash Bowl in the Hall of Offerings.');
    rite.steps[1].objective = L5('Adak Salonu’nda Hüküm Mührü’nü tersine çevir.', 'Turn the Verdict Seal in the Hall of Offerings.');
  })(CHAPTERS[1].quests[1]);
  // Guarded relics: the urns, the chained echo and the prisoners' winch cannot be touched while their dead still stand nearby.
  CHAPTERS[2].quests[1].steps.forEach(function (step) { step.guard = 9; });
  CHAPTERS[3].quests[1].steps[0].guard = 9;
  CHAPTERS[4].quests[0].steps[1].guard = 9;

  function verdict(title, question, options) { return { title: title, question: question, options: options }; }
  function option(id, name, story, benefit, amount, effect) { return { id: id, name: name, story: story, benefit: benefit, amount: amount, effect: effect }; }
  CHAPTERS[1].quests[0].verdict = verdict(KabirI18n.t('İsimler kimin için?'),L5("Mahkûmlar levhadaki adlarını tanıyor. Cellat'ın gerçek adı da aralarında. Onlara kendi yaslarını bırakacak mısın, yoksa tanıklıklarını Cellat'a karşı kullanacak mısın?", "The prisoners recognize their names on the tablet. The Executioner's true name lies among them. Will you leave them their own mourning, or use their testimony against him?"), [
    option('rest', KabirI18n.t('Mahkûmlara huzur ver'),L5("Adları anı taşına geri veriyorsun. Fısıltılar dinmiyor; ilk kez sana hüküm değil insan sesiyle cevap veriyor. Bedenlerinde açtığın yaralar kapanmadı. Onları yeniden bir silah yapmadın.", "You return the names to the memorial stone. The whispers do not vanish; for the first time they answer with human voices instead of a sentence. The wounds you caused have not healed. You have not made them weapons again."), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('expose', KabirI18n.t('Celladın gerçek adını açığa çıkar'),L5("Cellat'ın adını ölülerin tanıklığına bağlıyorsun. Kapısını açan elini onlar izliyor. Bir kez daha başkalarının acısıyla kendi yolunu açtın; bu kez bıçağın sahibine doğru.", "You bind the Executioner's name to the testimony of the dead. They watch the hand that opens his gate. Once again, you have made a path with someone else's pain; this time toward the hand that held the blade."), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  CHAPTERS[1].quests[1].verdict = verdict(KabirI18n.t('Hükmün son tanığı'),L5("Mühürde mahkûmların kanı kurumuş. Hükmü parçalayarak tekrarını önleyebilir ya da son tanıklığı kendine bağlayabilirsin. Taşıyacağın güç kadar, taşıyacağın acıyı da seçiyorsun.", "The prisoners' blood has dried on the seal. Break the sentence to prevent its repetition, or bind the last testimony to yourself. You choose the pain you will carry as well as the strength."), [
    option('break', KabirI18n.t('Hükmü bütünüyle parçala'),L5("Taşı ikiye ayırıyorsun. Kesik izleri yok olmuyor; yalnız hükmün onları yeniden açacak sesi kesiliyor. İlk kez bir mahkemenin önünden emri yerine getirmeden geçiyorsun.", "You split the stone. The cuts remain; only the sentence that would open them again falls silent. For the first time, you pass a court without carrying out its order."), 'staminaRecovery', .1, KabirI18n.t('Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.')),
    option('bear', KabirI18n.t('Son tanıklığı üstlen'),L5("Cellat'ın adını kazıyıp mühürü avucuna kapatıyorsun. Kurumuş kan yaranla birleşiyor. Tanıklık seni ayakta tutacak; fakat her iyileşmede kimin kanını taşıdığını hatırlayacaksın.", "You scrape away the Executioner's name and close your hand around the seal. Dried blood meets your wound. The testimony will keep you standing; every recovery will remind you whose blood you carry."), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.'))
  ]);
  CHAPTERS[2].quests[0].verdict = verdict(KabirI18n.t('Çanın çağrısı'),L5("Çan ölüleri son nefeslerine geri çağırıyor. Sesi onların yasına bırakabilir ya da o nefesi Çancı'nın adına bağlayabilirsin. Hangi sesi bir kez daha kullanacaksın?", "The bell calls the dead back into their final breath. Leave its voice to their mourning, or bind that breath to the Bellringer's name. Which voice will you use once more?"), [
    option('silence', KabirI18n.t('Boğulanları sessizliğe bırak'),L5("Yas çanını susturuyorsun. Kıyıda kalan ayakkabılar dalgaya cevap vermiyor. Ölüler seni aklamadı; yalnız son nefeslerini bir emir olmaktan çıkardın.", "You silence the mourning bell. The shoes left on shore no longer answer the tide. The dead have not absolved you; you have only stopped making an order of their final breath."), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('accuse', KabirI18n.t('Çancıyı kendi sesiyle çağır'),L5("Ölülerin son sesini Çancı'ya çeviriyorsun. Her vuruş kendi adıyla dönüyor. Kıyının yasını bitirmedin; hesabı, onu tutan ele götürdün.", "You turn the last voice of the dead against the Bellringer. Every toll returns with his own name. You have not ended the shore's mourning; you have brought the account to the hand that kept it."), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  CHAPTERS[2].quests[1].verdict = verdict(KabirI18n.t('Köklerin tuttuğu hatıra'),L5("Köklerin sakladığı hatıralar isim değil yüz taşıyor. Onları mezarlarına bırakacak mısın, yoksa külünü alıp son anlarını yanında mı taşıyacaksın?", "The memories held by the roots carry faces, not merely names. Will you leave them to their graves, or take the ash and carry their last moments with you?"), [
    option('release', KabirI18n.t('Hatıraları köklerden kurtar'),L5("Mezar kaplarını açıp kökleri ayırıyorsun. Kül yerinde kalıyor. Defter'e sayı olarak geçirdiğin insanlar, senden bir pay istemeden kendi hatıralarına kavuşuyor.", "You open the burial vessels and part the roots. The ash remains where it belongs. The people you reduced to numbers recover their memories without being asked to pay you a share."), 'staminaRecovery', .1, KabirI18n.t('Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.')),
    option('carry', KabirI18n.t('Yaslarını yanında taşı'),L5("Külü bir beze sarıyorsun. Birinin son hatırası tuz değil, evinin kapısı. Yaraların kapanırken o kapıyı göreceksin. Onun gidemediği yola sen devam ediyorsun.", "You wrap the ash in cloth. One person's final memory is not salt but the door of their home. When your wounds close, you will see that door. You continue along the road they could not take."), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.'))
  ]);
  CHAPTERS[3].quests[0].verdict = verdict(KabirI18n.t('Tahtın altındaki isim'),L5("Kral kendi adını sattı, insanların adlarıyla hükmetti. Suçunu kendi adıyla görünür kılabilir ya da tacının hâlâ güç verdiği unvanı silebilirsin. Hangisini taşta bırakacaksın?", "The King sold his own name and ruled through other people's names. Expose his crime under his own name, or erase the title that still empowers his crown. Which will you leave in the stone?"), [
    option('name', KabirI18n.t('Gerçek adını tahta kazı'),L5("Kralın gerçek adını tahta kazıyorsun. Taşın içindeki ağızlar ilk kez emrini değil adını söylüyor. Tacın altından bir insanın korkusu çıkıyor; korkması, işlediği suçu küçültmüyor.", "You carve the King's true name into the throne. For the first time, the mouths inside the stone speak his name instead of his command. A man's fear emerges beneath the crown; his fear does not lessen his crime."), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.')),
    option('erase', KabirI18n.t('Krallığını tarihten sil'),L5("Unvanını taşın üzerinden kaldırıyorsun. Mahkûmun adını silmiyorsun. Artık tacı tanıklığı susturamayacak; taşta kral değil, hüküm giymiş bir insan kalıyor.", "You strip his title from the stone. You do not erase the prisoner's name. His crown can no longer silence testimony; a condemned man remains in the stone, not a king."), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.'))
  ]);
  CHAPTERS[3].quests[1].verdict = verdict(KabirI18n.t('Mağaranın son nefesi'),L5("Son ses bağında tek bir nefes kalmış. Onu taşın dışına bırakabilir ya da ölüm sana yaklaşınca kullanmak üzere mühürde tutabilirsin. Özgürlük mü, kendine sakladığın bir nefes mi?", "One breath remains in the last sound bond. Release it beyond the stone, or keep it in the seal for when death approaches. Freedom, or a breath kept for yourself?"), [
    option('open', KabirI18n.t('Yankıya çıkış yolu aç'),L5("Mührü açıyorsun. İçerideki nefes sana cevap vermeden çıkıyor. Kimin nefesi olduğunu öğrenemeyeceksin. Bu kez bir insanın gitmesi için adını istemedin.", "You open the seal. The breath escapes without answering you. You will never know whose it was. This time, you did not demand a person's name before allowing them to leave."), 'staminaRecovery', .1, KabirI18n.t('Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.')),
    option('keep', KabirI18n.t('Son nefesi mühürde sakla'),L5("Son nefesi mühürde saklıyorsun. Kendi soluğun kesildiğinde onunki geri gelecek. Parmaklarını kapatırken bir an elini kalemin üstünde görüyorsun.", "You keep the final breath in the seal. When your own breath fails, theirs will return. As your fingers close, for a moment you see your hand closing around the pen."), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.'))
  ]);
  CHAPTERS[4].quests[0].verdict = verdict(KabirI18n.t('Son çıkanın yemini'),L5("Vinç bırakılırsa mahkûmların zincirleri çözülecek. Onları hemen serbest bırakabilir ya da zincirleri kalbin beslemesine geri bağlayıp azabın ağırlığını sahibine çevirebilirsin.", "Releasing the winch will loosen the prisoners' chains. Set them free now, or turn the chains back into the heart's feed and make the source bear the weight of its own torment."), [
    option('free', KabirI18n.t('Bütün mahkûm zincirlerini bırak'),L5("Vinci bırakıyorsun. Zincirler düşerken kuyudan bir övgü gelmiyor; yalnız zorla alınmamış bir nefes yükseliyor. Bunu duymak için kendi adının anılmasına ihtiyacın yok.", "You release the winch. No praise rises as the chains fall; only a breath that has not been forced from a body. You do not need to hear your own name to recognize it."), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('turn', KabirI18n.t('Zincirleri kalbe geri bağla'),L5("Mahkûmların halkalarını kalbin beslemesine geçiriyorsun. Bedenleri artık tutmuyorlar. Zincir gerildiğinde ocak, yıllardır başkalarının taşıdığı ağırlığı kendi üstünde duyuyor.", "You turn the prisoners' links into the heart's feed. They no longer hold the bodies. When the chain tightens, the furnace feels the weight it made others bear for years."), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  CHAPTERS[4].quests[1].verdict = verdict(KabirI18n.t('Ocak sönerken'),L5("Besleme kesildi. Son koru yaranı kapatmak için saklayabilir ya da kalbin kendi ateşini ona geri çevirebilirsin. İnsan acısı bu ateşin yakıtı olmaktan çıktı; şimdi son kullanımı senin elinde.", "The feed is cut. Keep the last ember to close your wounds, or turn the heart's own fire back against it. Human pain no longer fuels this fire; its last use lies in your hands."), [
    option('shelter', KabirI18n.t('Son koru bir sığınağa çevir'),L5("Koru bir bezin içinde saklıyorsun. İlk kez bu ocaktan alınan sıcaklık bir bedeni açmak için değil, yarasını kapatmak için kullanılacak. Kül yine kül; yaptığını değiştirmiyor.", "You keep the ember within a cloth. For the first time, heat taken from this furnace will close a wound instead of opening a body. Ash is still ash. It does not change what you did."), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.')),
    option('starve', KabirI18n.t('Kalbi kendi ateşiyle tüket'),L5("Geri dönüş vanasını açıyorsun. Kalp kendi ateşini içine çekiyor. Mahkûmların soluğu bu hattan çekildi; son yükü artık onlara taşıtmıyorsun.", "You open the return valve. The heart draws its own fire inward. The prisoners' breath has been removed from the feed; you do not make them bear its final weight."), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);

  CHAPTERS[5].quests[0].verdict = verdict(L5('Mühürlerin akıbeti', 'The fate of the seals'),L5("Üç mühür, susturduğun efendilerin hükmünü taşıyor. Onları kırabilir ya da Kadı'ya karşı göğsüne bağlayabilirsin. Güçlerini kullanırsan ağırlıklarını da üstlenirsin.", "Three seals carry the sentences of the masters you silenced. Break them, or bind them to your chest against the Judge. If you use their strength, you take on their weight."), [
    option('break', L5('Mühürleri kır', 'Break the seals'),L5("Mühürler elinde çatlıyor. Cellat'ın bıçağı, çanın çağrısı ve kralın emri artık yeni bir hükme imza olamaz. Kadı'nın önüne onların makamını almadan çıkıyorsun.", "The seals crack in your hand. The blade, the bell's summons and the royal command can no longer sign a new sentence. You face the Judge without taking the masters' offices for yourself."), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('wield', L5('Mühürleri kuşan', 'Wear the seals'),L5("Üç mührü göğsüne bağlıyorsun. Taşın ağırlığı kaburgalarına oturuyor. Kadı kendi hükmünün izlerini üzerinde görecek. Bunları yalnız onu yıkmak için taşıdığını söylüyorsun.", "You bind the three seals to your chest. Their weight settles against your ribs. The Judge will see the marks of his own sentences on you. You tell yourself you carry them only to destroy him."), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  CHAPTERS[5].quests[1].verdict = verdict(L5('Selvi’nin kalemi', 'Selvi’s pen'),L5("Selvi'nin bileğindeki zincir çözülmüş, eli hâlâ kaleme kilitli. Kalemi kırabilir ya da bir satır daha isteyebilirsin: Kadı'nın gerçek adı. Bu satırın bedelini sen ödemeyeceksin.", "The chain at Selvi's wrist is loose, but her hand is still locked to the pen. Break it, or ask for one more line: the Judge's true name. You will not be the one who pays for that line."), [
    option('free', L5('Kalemi kır, onu serbest bırak', 'Break the pen and free her'),L5("Kalemi kırıyorsun. Selvi kan bulaşmış parmağıyla masadaki toza kendi adını çiziyor. Bu bir hüküm değil. Elini geri çekiyor; ilk kez bırakmasına izin verilen şey yalnız kalem değil.", "You break the pen. With a bloodstained finger, Selvi traces her own name in the dust on the desk. It is not a sentence. She draws back her hand; for the first time, the pen is not the only thing she is allowed to let go."), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.')),
    option('ask', L5('Kadı’nın zaafını yazdır', 'Make her write the Judge’s weakness'),L5("Selvi Kadı'nın gerçek adını yazıyor. Son harfte bileği yeniden kasılıyor; saçındaki tek bir tutam beyaza dönüyor. Kalem sonunda avucundan düşüyor. Sana bakmıyor. Bir satır daha istedin. Onu kurtarmaya geldiğini söyledin.", "Selvi writes the Judge's true name. At the last letter her wrist locks again; one strand of her hair turns white. The pen finally falls from her palm. She does not look at you. You asked for one more line. You said you had come to save her."), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);

  // The forceful verdict opens a later, forward-facing route through an existing defended chamber.
  // The quieter verdict finishes here; the risky route only earns its boss advantage when its guardians are defeated.
  [
    { chapter: 1, choice: 'expose', room: 8, dx: -3.8, dz: 2.8, id: 'witness-proof', name: KabirI18n.t('Celladın Saklı Tanıklığı'), objective: KabirI18n.t('Sönmüş Kandiller’deki bekçileri yen ve saklı tanıklığı ortaya çıkar.'), story: KabirI18n.t('Kandillerin son bekçisi düştü. Celladın adını saklayan tanıklık serbest; artık hükmü ona geri çevirebilirsin.'), effect: KabirI18n.t('Sönmüş Kandiller’deki bekçileri yen. Ardından efendiye hasar %10 artar.') },
    { chapter: 2, choice: 'accuse', room: 12, dx: 3.4, dz: 2.6, id: 'bell-testimony', name: KabirI18n.t('Fenercinin Son Tanıklığı'), objective: KabirI18n.t('Fenersiz Sığınak’taki nöbeti kır ve fenercinin tanıklığını çana bağla.'), story: KabirI18n.t('Sığınaktaki nöbet sustu. Fenercinin tanıklığı yas çanına ulaşıyor; Çancı kendi sesinin içinde açıkta kalıyor.'), effect: KabirI18n.t('Fenersiz Sığınak’ın nöbetini yen. Ardından efendiye hasar %10 artar.') },
    { chapter: 3, choice: 'name', room: 10, dx: -3.4, dz: 2.6, id: 'royal-testimony', name: KabirI18n.t('Kralın Son Tanığı'), objective: KabirI18n.t('Yutulan Saray’daki muhafızları yen ve kralın tanıklık mührünü kır.'), story: KabirI18n.t('Sarayın son muhafızı düştü. Taç, mahkûmun adını artık saklayamıyor. Kral kendi geçmişiyle yüzleşmek zorunda.'), effect: KabirI18n.t('Yutulan Saray’ın muhafızlarını yen. Ardından efendiye hasar %10 artar.') },
    { chapter: 4, choice: 'turn', room: 10, dx: 3.2, dz: 2.4, id: 'turned-oath', name: KabirI18n.t('Kalbe Dönen Yemin'), objective: KabirI18n.t('Kızıl Fırınlar’daki bekçileri yen ve halkaları kalbin beslemesine döndür.'), story: KabirI18n.t('Korun bekçileri düştü. Mahkûmların zinciri artık kalbin kendi ateşini bağlıyor; son vuruşun yolu açıldı.'), effect: KabirI18n.t('Kızıl Fırınlar’ın bekçilerini yen. Ardından efendiye hasar %10 artar.') }
  ].slice(0, 0).forEach(function (trial) {
    var q = CHAPTERS[trial.chapter].quests[0], chosen = q.verdict.options.find(function (choice) { return choice.id === trial.choice; });
    trial.shape = ({ expose: 'tablet', accuse: 'bell', name: 'memorial', turn: 'winch' })[trial.choice];
    trial.verb = ({ expose: KabirI18n.t('Saklı tanıklığı al'), accuse: KabirI18n.t('Tanıklığı yas çanına bağla'), name: KabirI18n.t('Kraliyet mührünü kır'), turn: KabirI18n.t('Halkaları kalbin beslemesine geçir') })[trial.choice]; trial.trial = true;
    q.trial = trial; chosen.trial = trial; chosen.effect = trial.effect;
    chosen.story = ({ expose: KabirI18n.t('Celladın adını gizlememeyi seçtin. Saklı tanıklık doğrulanana kadar hükmün ona ulaşamaz.'), accuse: KabirI18n.t('Ölülerin yasını Çancıya çevirmeyi seçtin. Fenercinin tanıklığı olmadan çanın sesi onu ele vermez.'), name: KabirI18n.t('Kralı kendi adıyla yüzleştirmeyi seçtin. Son tanığın mührü kırılmadan taç geçmişini saklayabilir.'), turn: KabirI18n.t('Mahkûmların yeminini kalbe çevirmeyi seçtin. Besleme hattı bağlanana kadar zincir henüz onun ateşini tutmuyor.') })[trial.choice];
  });

  function create(api) {
    var world = api.world, chapter = Math.max(1, Math.min(B.FINAL_CHAPTER || 5, api.chapter || 1));
    if (!CHAPTERS[chapter]) chapter = 4;   // chapter V's verdicts are added by finale-quests.js
    var definition = CHAPTERS[chapter], nodes = [], geometry = [], states = [0, 0], choices = [null, null], disposed = false;
    var info = { chapter: chapter, title: definition.title, introduction: definition.introduction, entries: [], completed: 0, total: 2,
      ready: false, objective: '', prompt: null, markers: [], revision: 0, legacyComplete: false, pendingChoice: null,
      benefits: { damageReduction: 0, bossDamage: 0, staminaRecovery: 0, healingBonus: 0 } };
    var root = new T.Group(); root.name = KabirI18n.t('Hikâye görevleri'); api.root.add(root);
    var materials = world.materials || {};
    var stone = materials['pale~p'] || materials.pale || materials.stone || materials.wall || materials.rock;
    var metal = materials.rust || materials.iron || stone;
    var trim = materials.brass || materials.gold || materials.iron || stone;
    var glow = materials.sanctuary || materials.oath || materials.crystalA || materials.lamp || materials.ember || trim;
    var wood = materials.wood || stone;
    var matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3(1, 1, 1), rotation = new T.Euler(), quaternion = new T.Quaternion();
    function put(buckets, material, g, x, y, z, rx, ry, rz) {
      if (!material) { g.dispose(); return; }
      var source = g.index ? g.toNonIndexed() : g; if (source !== g) g.dispose();
      position.set(x, y, z); rotation.set(rx || 0, ry || 0, rz || 0); quaternion.setFromEuler(rotation);
      matrix.compose(position, quaternion, scale); source.applyMatrix4(matrix);
      var bucket = buckets.find(function (b) { return b.material === material; });
      if (!bucket) { bucket = { material: material, pieces: [] }; buckets.push(bucket); }
      bucket.pieces.push(source);
    }
    function box(b, m, w, h, d, x, y, z, rx, ry, rz) { put(b, m, new T.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
    function cyl(b, m, r0, r1, h, x, y, z, rx, ry, rz) { put(b, m, new T.CylinderGeometry(r1, r0, h, 24, 1), x, y, z, rx, ry, rz); }
    function ring(b, m, r, tube, x, y, z, rx, ry, rz) { put(b, m, new T.TorusGeometry(r, tube, 7, 32), x, y, z, rx, ry, rz); }
    function merge(buckets, group) {
      for (var b = 0; b < buckets.length; b++) {
        var entry = buckets[b], list = entry.pieces, count = 0, i;
        for (i = 0; i < list.length; i++) count += list[i].attributes.position.count;
        var positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2), colors = new Float32Array(count * 3), offset = 0;
        colors.fill(1);
        for (i = 0; i < list.length; i++) {
          var a = list[i].attributes, n = a.position.count;
          positions.set(a.position.array, offset * 3); normals.set(a.normal.array, offset * 3); uvs.set(a.uv.array, offset * 2);
          offset += n; list[i].dispose();
        }
        var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(positions, 3)); g.setAttribute('normal', new T.BufferAttribute(normals, 3));
        g.setAttribute('uv', new T.BufferAttribute(uvs, 2)); g.setAttribute('color', new T.BufferAttribute(colors, 3)); g.computeBoundingSphere(); geometry.push(g);
        var mesh = new T.Mesh(g, entry.material); mesh.name = KabirI18n.t('Görev nesnesi · ') + (entry.material.name || KabirI18n.t('yüzey'));
        mesh.castShadow = false; mesh.receiveShadow = entry.material !== glow; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); group.add(mesh);
      }
    }
    function makeSelviDesk(node) {
      var group = new T.Group(), body = [], bound = [], signal = [];
      var paper = materials.shroud || materials.cloth || materials.bone || stone;
      var ink = materials.rock || materials.earth || metal;
      group.name = node.name; group.position.set(node.x, node.y, node.z);
      group.matrixAutoUpdate = false; group.updateMatrix(); root.add(group); node.group = group;
      // Same reserved .81 m stone foot as every reliquary; the desk fits inside it.
      put(body, stone, new T.CylinderGeometry(.73, .81, .13, 8), 0, .065, 0, 0, PI / 8);
      put(body, stone, new T.CylinderGeometry(.56, .65, .12, 8), 0, .19, 0, 0, PI / 8);
      // Four pegged legs and a restrained bronze edge, rather than a floating seal.
      for (var x = -1; x <= 1; x += 2) for (var z = -1; z <= 1; z += 2) {
        box(body, wood, .09, .70, .09, x * .38, .62, z * .23);
        box(body, metal, .12, .07, .12, x * .38, .30, z * .23);
        box(body, trim, .11, .05, .11, x * .38, .92, z * .23);
        put(body, trim, new T.SphereGeometry(.016, 8, 5), x * .43, .91, z * .23);
      }
      box(body, wood, .78, .065, .07, 0, .44, -.23);
      box(body, wood, .07, .065, .46, -.38, .44, 0);
      box(body, wood, .07, .065, .46, .38, .44, 0);
      box(body, wood, 1.04, .10, .68, 0, 1.02, -.035);
      box(body, trim, 1.055, .018, .025, 0, 1.077, .307);
      box(body, metal, .018, .032, .67, -.522, 1.068, -.035);
      box(body, metal, .018, .032, .67, .522, 1.068, -.035);
      // The empty chair remains after her release: a place, not another actor.
      box(body, wood, .34, .055, .29, 0, .66, -.46);
      for (var leg = -1; leg <= 1; leg += 2) {
        box(body, wood, .055, .55, .055, leg * .13, .45, -.54);
        box(body, wood, .055, .40, .055, leg * .13, .47, -.37);
        box(body, wood, .055, .52, .055, leg * .15, 1.02, -.57);
      }
      box(body, wood, .34, .15, .065, 0, 1.20, -.57);
      box(body, trim, .30, .018, .025, 0, 1.28, -.57);
      // Thin physical sheets, unequal writing strokes, a metal ink flask.
      box(body, paper, .48, .014, .33, -.10, 1.085, -.04, 0, -.08);
      box(body, paper, .44, .012, .29, -.085, 1.101, -.025, 0, .07);
      for (var row = 0; row < 4; row++) box(body, wood, row % 2 ? .23 : .31, .004, .008, -.09, 1.110, -.11 + row * .043, 0, .07);
      cyl(body, metal, .072, .060, .105, .30, 1.129, -.19);
      ring(body, trim, .055, .010, .30, 1.188, -.19, PI / 2);
      cyl(body, ink, .041, .041, .012, .30, 1.193, -.19);
      // One cuff is chained to the desk; no added light, actor, collision or logic.
      ring(bound, metal, .078, .015, .285, 1.111, .155, PI / 2);
      box(bound, trim, .045, .033, .03, .285, 1.112, .238);
      for (var link = 0; link < 5; link++) ring(bound, metal, .035, .009, .35, 1.09 - link * .067, .285, link % 2 ? PI / 2 : 0);
      box(bound, metal, .11, .065, .024, .38, .78, .281);
      function quill(bucket, x, y, z, rx, ry, rz, short) {
        var length = short ? .14 : .31;
        var center = new T.Vector3(0, length / 2, 0).applyEuler(new T.Euler(rx || 0, ry || 0, rz || 0));
        box(bucket, wood, .009, length, .009, x + center.x, y + center.y, z + center.z, rx, ry, rz);
        if (short) return;
        var feather = new T.Shape();
        feather.moveTo(0, .04); feather.lineTo(-.055, .13); feather.lineTo(-.034, .16);
        feather.lineTo(-.057, .19); feather.lineTo(-.027, .25); feather.lineTo(0, .31);
        feather.lineTo(.045, .24); feather.lineTo(.059, .17); feather.lineTo(.024, .10); feather.lineTo(0, .04);
        put(bucket, paper, new T.ShapeGeometry(feather), x, y, z, rx, ry, rz);
      }
      quill(bound, -.245, 1.09, .12, .10, -.05, -.25, false);
      put(signal, glow, new T.SphereGeometry(.022, 10, 7), -.38, 1.10, -.18);
      var bodyGroup = new T.Group(); bodyGroup.name = KabirI18n.t('Bağlı hatıra'); bodyGroup.matrixAutoUpdate = false; bodyGroup.updateMatrix(); group.add(bodyGroup); merge(body, bodyGroup); node.bodyVisual = bodyGroup;
      var bindings = new T.Group(); bindings.name = KabirI18n.t('Fiziksel bağ'); bindings.matrixAutoUpdate = false; bindings.updateMatrix(); group.add(bindings); merge(bound, bindings); node.boundVisual = bindings; node.bindingReleasedOnUse = true;
      var active = new T.Group(); active.name = KabirI18n.t('Görev mührü'); active.matrixAutoUpdate = false; active.updateMatrix(); group.add(active); merge(signal, active); node.activeVisual = active;
      node.aftermath = Object.create(null);
      definition.quests[node.quest].verdict.options.forEach(function (choice) {
        var variant = new T.Group(), pieces = [];
        variant.name = choice.name; variant.matrixAutoUpdate = false; variant.updateMatrix(); variant.visible = false;
        if (choice.id === 'free') {
          quill(pieces, -.20, 1.112, .075, -PI / 2, .5, .35, true);
          quill(pieces, -.04, 1.112, .02, -PI / 2, -.4, -.4, true);
        } else quill(pieces, -.15, 1.112, .10, -PI / 2, .15, .12, false);
        group.add(variant); merge(pieces, variant); node.aftermath[choice.id] = variant;
      });
    }

    function makeProp(node, index) {
      if (node.id === 'selvi-cell') { makeSelviDesk(node); return; }
      var group = new T.Group(), body = [], detail = [], bindings = [], s = node.shape, relief = materials.bone || stone;
      group.name = node.name; group.position.set(node.x, node.y, node.z); group.matrixAutoUpdate = false; group.updateMatrix(); root.add(group); node.group = group;
      // A bevelled octagonal reliquary foot: physical stone and brass, no added light.
      put(body, stone, new T.CylinderGeometry(.73, .81, .13, 8), 0, .065, 0, 0, PI / 8);
      put(body, relief, new T.CylinderGeometry(.56, .65, .12, 8), 0, .19, 0, 0, PI / 8);
      ring(body, trim, .59, .017, 0, .255, 0, PI / 2);
      for (var k = 0; k < 8; k++) {
        var angle = k * PI / 4;
        box(body, trim, .035, .018, .13, Math.sin(angle) * .68, .136, Math.cos(angle) * .68, 0, angle);
        if (k % 2 === 0) box(body, stone, .16, .12, .2, Math.sin(angle) * .64, .13, Math.cos(angle) * .64, 0, angle);
      }
      var pedestal = body; body = [];
      if (s === 'tablet' || s === 'memorial' || s === 'seal') {
        var slabHeight = s === 'memorial' ? .88 : .7, slabY = .26 + slabHeight / 2;
        box(body, relief, .78, slabHeight, .28, 0, slabY, 0, -.13);
        // Header and foot sit on the slab instead of hovering above the shorter tablet.
        box(body, metal, .83, .055, .31, 0, .26 + slabHeight, -.05, -.13);
        box(body, trim, .8, .035, .31, 0, .295, .028, -.13);
        box(body, trim, .035, slabHeight - .1, .035, -.31, slabY, .145, -.13);
        box(body, trim, .035, slabHeight - .1, .035, .31, slabY, .145, -.13);
        for (var row = 0; row < 4; row++) box(body, trim, row % 2 ? .29 : .39, .016, .022, 0, .4 + row * .084, .165 - row * .011, -.13);
        ring(body, trim, .11, .018, 0, .26 + slabHeight - .14, .13);
        ring(detail, glow, .055, .012, 0, .26 + slabHeight - .14, .15);
      } else if (s === 'censer' || s === 'urn') {
        var points = [new T.Vector2(.17, .26), new T.Vector2(.29, .36), new T.Vector2(.35, .56), new T.Vector2(.27, .76), new T.Vector2(.22, .81), new T.Vector2(.17, .81), new T.Vector2(.21, .7), new T.Vector2(.23, .54)];
        put(body, s === 'urn' ? stone : metal, new T.LatheGeometry(points, 28), 0, 0, 0);
        ring(body, trim, .25, .028, 0, .775, 0, PI / 2); ring(body, trim, .315, .024, 0, .49, 0, PI / 2);
        for (var chain = -1; chain <= 1; chain += 2) { box(s === 'urn' ? bindings : body, trim, .025, .45, .025, chain * .3, .47, .06, 0, 0, chain * .13); }
        put(detail, glow, new T.SphereGeometry(.085, 12, 8), 0, .78, 0); // small contained ember; no flat light disk
        // The ritual order is also encoded as one, two or three incisions on the front.
        var marks = s === 'censer' ? index % 3 + 1 : 2;
        for (var rune = 0; rune < marks; rune++) box(body, trim, .025, .13, .025, (rune - (marks - 1) / 2) * .085, .54, .328);
      } else if (s === 'bell') {
        for (var side = -1; side <= 1; side += 2) box(body, wood, .13, 1.42, .18, side * .42, .88, 0);
        box(body, wood, 1.04, .14, .2, 0, 1.58, 0); box(body, metal, .06, .25, .06, 0, 1.43, 0);
        put(body, metal, new T.LatheGeometry([new T.Vector2(.33, .56), new T.Vector2(.35, .61), new T.Vector2(.25, .69), new T.Vector2(.17, 1.1), new T.Vector2(.08, 1.2)], 28), 0, 0, 0);
        ring(body, trim, .33, .025, 0, .62, 0, PI / 2); cyl(detail, glow, .045, .045, .36, 0, .79, 0);
      } else if (s === 'valve' || s === 'winch') {
        box(body, stone, .66, .45, .52, 0, .45, 0); cyl(body, metal, .16, .16, .56, 0, .88, 0);
        ring(body, trim, .4, .045, 0, 1.12, .15, .26); cyl(body, metal, .105, .105, .14, 0, 1.12, .15, PI / 2 + .26);
        for (var spoke = 0; spoke < 4; spoke++) { var a = spoke * PI / 2; box(body, metal, .035, .78, .055, 0, 1.12, .15, .26, 0, a); }
        if (s === 'winch') { cyl(body, wood, .2, .2, .86, 0, .57, -.1, 0, 0, PI / 2); for (var link = 0; link < 5; link++) ring(bindings, metal, .085, .024, .31, .33 + link * .14, .14, link % 2 ? PI / 2 : 0); }
        else { cyl(body, metal, .18, .18, .7, 0, .4, -.18, PI / 2); ring(body, trim, .19, .03, 0, .4, .17); }
        put(detail, glow, new T.SphereGeometry(.04, 12, 8), 0, 1.12, .29);
      } else if (s === 'crystal') {
        for (var crystal = -1; crystal <= 1; crystal++) put(body, stone, new T.ConeGeometry(.18, .72, 5), crystal * .22, .61 + (crystal === 0 ? .2 : 0), 0, 0, 0, -crystal * .3);
        ring(bindings, metal, .31, .036, 0, .57, 0, PI / 2); box(bindings, metal, .06, .7, .06, 0, .6, .21);
        put(detail, glow, new T.OctahedronGeometry(.17, 0), 0, .98, 0);
      } else {
        box(body, stone, .65, .34, .56, 0, .4, 0); box(body, trim, .69, .045, .59, 0, .59, 0);
        if (chapter === 2) { cyl(body, metal, .06, .05, .48, 0, .74, 0); put(body, trim, new T.SphereGeometry(.12, 12, 8), 0, .53, 0); }
        else { ring(body, metal, .17, .035, 0, .75, .04, .4); box(body, metal, .07, .29, .07, 0, .62, .07, .4); }
        put(detail, glow, new T.SphereGeometry(.04, 12, 8), 0, .83, .11);
      }
      var pickup = s === 'tablet' || s === 'relic';
      if (pickup) {
        merge(pedestal, group);
        var payload = new T.Group(); payload.name = KabirI18n.t('Alınabilir hatıra'); payload.matrixAutoUpdate = false; payload.updateMatrix(); group.add(payload); merge(body, payload); node.payloadVisual = payload;
      } else { merge(pedestal, group); var bodyGroup = new T.Group(); bodyGroup.name = KabirI18n.t('Bağlı hatıra'); bodyGroup.matrixAutoUpdate = false; bodyGroup.updateMatrix(); group.add(bodyGroup); merge(body, bodyGroup); node.bodyVisual = bodyGroup; }
      var active = new T.Group(); active.name = KabirI18n.t('Görev mührü'); active.matrixAutoUpdate = false; active.updateMatrix(); group.add(active); merge(detail, active); node.activeVisual = active;
      if (bindings.length) { var bound = new T.Group(); bound.name = KabirI18n.t('Fiziksel bağ'); bound.matrixAutoUpdate = false; bound.updateMatrix(); group.add(bound); merge(bindings,bound);node.boundVisual=bound;node.bindingReleasedOnUse=s!=='winch'; }
      node.aftermath = Object.create(null);
      var questDefinition = definition.quests[node.quest];
      // Verdict variants are built once with the same scanned materials as the world. They never create a light or a particle fountain.
      if (node.index === questDefinition.steps.length - 1 || questDefinition.anyOrder || node.trial) {
        questDefinition.verdict.options.forEach(function (choice) {
          var variant = new T.Group(), fragments = [], liberate = /^(rest|break|silence|release|erase|open|free|starve)$/.test(choice.id);
          variant.name = choice.name; variant.matrixAutoUpdate = false; variant.updateMatrix(); variant.visible = false; group.add(variant);
          if (s === 'memorial' || s === 'seal') {
            if (liberate) {
              // A broken inscription remains as heavy, bevelled stone fragments rather than vanishing into a sparkle.
              box(fragments, stone, .58, .17, .35, -.13, .32, .07, .04, -.15, -.12);
              box(fragments, stone, .34, .22, .27, .22, .37, -.06, -.12, .28, .13);
              box(fragments, stone, .19, .10, .24, .39, .27, .21, .11, -.4, -.19);
              for (var fragment = 0; fragment < 3; fragment++) box(fragments, trim, .026, .09, .12, -.24 + fragment * .13, .41 + fragment * .018, .12, -.3, -.15, -.12);
              variant.userData.replacesBody = true;
            } else {
              // Keeping the testimony adds an inset cast seal, with a physical split and a riveted retaining frame.
              ring(fragments, trim, .20, .019, 0, .70, .193); ring(fragments, metal, .16, .012, 0, .70, .196);
              for (var stud = 0; stud < 8; stud++) { var theta = stud * PI / 4; put(fragments, trim, new T.SphereGeometry(.013, 8, 5), Math.sin(theta)*.24, .70+Math.cos(theta)*.24, .198); }
              box(fragments, trim, .019, .27, .019, 0, .70, .211, 0, 0, -.18);
            }
          } else if (s === 'urn') {
            cyl(fragments, stone, .25, .20, .09, liberate ? .36 : 0, liberate ? .32 : .83, liberate ? .21 : 0, 0, 0, liberate ? -.3 : 0);
            ring(fragments, trim, .20, .013, liberate ? .36 : 0, liberate ? .375 : .89, liberate ? .21 : 0, PI/2, 0, liberate ? -.3 : 0);
            if (liberate) for (var rootEnd = -1; rootEnd <= 1; rootEnd += 2) box(fragments, wood, .10, .055, .46, rootEnd*.30, .29, .12, 0, rootEnd*.6, 0);
            else for (var binder = -1; binder <= 1; binder += 2) box(fragments, metal, .032, .36, .035, binder*.13, .70, .24, 0, 0, binder*.1);
          } else if (s === 'bell') {
            if (!liberate) { cyl(fragments, metal, .055, .035, .36, 0, .79, 0); put(fragments, trim, new T.SphereGeometry(.075, 12, 8), 0, .63, 0); }
            else { cyl(fragments, metal, .055, .035, .36, .21, .30, .18, 0, 0, PI/2); put(fragments, trim, new T.SphereGeometry(.075, 12, 8), .38, .30, .18); }
          } else if (s === 'winch' || s === 'valve') {
            for (var tooth = 0; tooth < 12; tooth++) { var phi=tooth*PI/6; box(fragments, metal, .028,.055,.035,Math.sin(phi)*.22,.49+Math.cos(phi)*.22,.195,0,0,-phi); }
            if (liberate) for (var loose=0; loose<4; loose++) ring(fragments,metal,.069,.014,.34+loose*.035,.30,.06+loose*.10,PI/2,loose*.3);
            else for(var tension=0;tension<4;tension++) ring(fragments,metal,.069,.014,-.29,.38+tension*.10,.17,tension%2?PI/2:0);
          } else if (s === 'crystal') {
            for (var shard=0;shard<3;shard++) put(fragments,stone,new T.ConeGeometry(.10,.26,7),-.30+shard*.27,.36,.20,(shard-1)*.35,.3,-.9+shard*.8);
          }
          merge(fragments, variant); node.aftermath[choice.id] = variant;
        });
      }
    }
    // ajan:quests — placement never throws: world.questSites[id] (open-world layouts, see STORY.md) → authored room + offset
    // → room by name → a room picked along the route → spawn. Every candidate is tested against the real collision/navigation.
    var reserved = [];
    function reserve(x, z) { reserved.push({ x: x, z: z }); }
    function placeSite(id, fb) {
      fb = fb || {}; var rooms = world.rooms || [], site = world.questSites && world.questSites[id], room = null, desired;
      if (site && Number.isFinite(site.x) && Number.isFinite(site.z)) desired = { x: site.x, z: site.z };
      else {
        if (fb.room !== undefined) room = rooms.find(function (r) { return String(r.id) === String(fb.room); }) || null;
        if (!room && fb.roomName) room = rooms.find(function (r) { return r.name === fb.roomName; }) || null;
        if (!room && rooms.length) { var f = Number.isFinite(fb.index) ? fb.index : ((String(id).length * 37) % 100) / 100; room = rooms[Math.max(0, Math.min(rooms.length - 1, Math.round(f * (rooms.length - 1))))]; }
        desired = room ? { x: room.x + (fb.dx || 0), z: room.z + (fb.dz || 0) } : { x: world.spawn ? world.spawn.x : 0, z: world.spawn ? world.spawn.z - 8 : -8 };
      }
      for (var pass = 0; pass < 2; pass++) {
        var best = null, bestDistance = Infinity, reach = pass ? 10 : 5, bounded = room && !pass && !site;
        // Leave room for the full prop + the hero on every side. Decorative blocks cannot conceal the use point; no world RNG is used.
        for (var iz = -reach; iz <= reach; iz++) for (var ix = -reach; ix <= reach; ix++) {
          var x = desired.x + ix * .7, z = desired.z + iz * .7, d = ix * ix + iz * iz;
          if (d >= bestDistance || bounded && room.w && (Math.abs(x - room.x) > room.w / 2 - 2 || Math.abs(z - room.z) > room.d / 2 - 2)) continue;
          if (world.isWalkable && !world.isWalkable(x, z, 1.35)) continue;
          var overlaps = false;
          for (var n = 0; n < reserved.length; n++) if (Math.hypot(reserved[n].x - x, reserved[n].z - z) < 2.8) { overlaps = true; break; }
          if (overlaps || world.checkpoint && Math.hypot(world.checkpoint.x - x, world.checkpoint.z - z) < 3.2) continue;
          if (world.pathTo && world.spawn) { var route = world.pathTo(world.spawn, { x: x, z: z }, .5); if (!route || !route.length) continue; }
          best = { x: x, z: z }; bestDistance = d;
        }
        if (best) return best;
      }
      console.warn('[quests] no clear spot for', chapter + '/' + id);
      return desired;
    }
    function place(step) { var p = placeSite(step.id, step.fallback || { room: step.room, dx: step.dx, dz: step.dz }); reserve(p.x, p.z); return p; }
    definition.quests.forEach(function (q, qi) {
      var entry = { id: q.id, name: q.name, description: q.description, complete: false, step: 0, steps: q.steps.length, objective: '', target: null, choice: null, outcome: '', consequence: '' };
      info.entries.push(entry);
      q.steps.forEach(function (step, si) {
        var p = place(step), node = Object.assign({}, step, p, { quest: qi, index: si, bit: 1 << si, complete: false, available: false });
        node.y = world.effectHeightAt ? world.effectHeightAt(p.x, p.z, .65) + .018 : .065;
        node.marker = { id: step.id, quest: qi, name: step.name, x: p.x, z: p.z, active: false, complete: false };
        nodes.push(node); info.markers.push(node.marker); makeProp(node, si);
      });
      if (q.trial) {
        var trial = q.trial, location = place(trial), proof = Object.assign({}, trial, location, { quest: qi, index: q.steps.length, bit: 1 << q.steps.length, complete: false, available: false });
        proof.y = world.effectHeightAt ? world.effectHeightAt(location.x, location.z, .65) + .018 : .065;
        proof.marker = { id: trial.id, quest: qi, name: trial.name, x: location.x, z: location.z, active: false, complete: false, trial: true };
        nodes.push(proof); info.markers.push(proof.marker); makeProp(proof, q.steps.length);
      }
    });
    var side = null;
    if (B.QuestSide) try {
      side = B.QuestSide.create({ api: api, world: world, chapter: chapter, info: info, placeSite: placeSite, reserve: reserve,
        kit: { root: root, T: T, put: put, box: box, cyl: cyl, ring: ring, merge: merge, stone: stone, metal: metal, trim: trim, glow: glow, wood: wood, materials: materials } });
    } catch (e) { console.warn('[quests] side quests unavailable', e); side = null; info.side = []; }
    var prompt = { id: '', text: '', name: '', quest: '', x: 0, z: 0, available: false }, nearNode = null, nextScan = 0, tracked = null;
    function refresh() {
      var completed = 0;
      for (var qi = 0; qi < 2; qi++) {
        var q = definition.quests[qi], entry = info.entries[qi], count = 0, target = null;
        var selectedChoice = choices[qi] && q.verdict.options.find(function (option) { return option.id === choices[qi]; }), hasTrial = !!(selectedChoice && selectedChoice.trial);
        entry.steps = q.steps.length + (hasTrial ? 1 : 0);
        for (var ni = 0; ni < nodes.length; ni++) {
          var node = nodes[ni]; if (node.quest !== qi) continue;
          node.complete = !!(states[qi] & node.bit) && (!node.trial || hasTrial); if (node.complete) count++;
          node.available = !node.complete && (node.trial ? hasTrial && (states[qi] & (node.bit - 1)) === node.bit - 1 : q.anyOrder || q.ritual || states[qi] === node.bit - 1);
          node.marker.complete = node.complete; node.marker.active = node.available;
          node.activeVisual.visible = node.available;
          if (node.payloadVisual) node.payloadVisual.visible = !node.complete;
          if (node.bodyVisual) node.bodyVisual.visible = true;
          if (node.boundVisual) node.boundVisual.visible = !(node.complete && (node.bindingReleasedOnUse || !choices[qi] || /^(rest|break|silence|release|erase|open|free|starve)$/.test(choices[qi])));
          Object.keys(node.aftermath).forEach(function (choiceId) {
            var variant = node.aftermath[choiceId], visible = node.complete && choices[qi] === choiceId;
            variant.visible = visible;
            if (visible && variant.userData.replacesBody && node.bodyVisual) node.bodyVisual.visible = false;
          });
          if (!target && node.available) target = node;
        }
        entry.step = count; entry.complete = count === entry.steps; entry.target = target ? target.marker : null;
        entry.choice = choices[qi];
        var verdict = choices[qi] && q.verdict.options.find(function (option) { return option.id === choices[qi]; });
        entry.outcome = verdict ? entry.complete && verdict.trial ? verdict.trial.story : verdict.story : ''; entry.consequence = verdict ? verdict.trial ? entry.complete ? KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.') : KabirI18n.t('Tanıklık doğrulandığında bu bölümün efendisine verilen hasar %10 artar.') : verdict.effect : '';
        entry.objective = entry.complete ? KabirI18n.t('Tamamlandı') : target ? target.objective : q.description;
        if (entry.complete) completed++;
      }
      var benefits = info.benefits; benefits.damageReduction = benefits.bossDamage = benefits.staminaRecovery = benefits.healingBonus = 0;
      for (var bi = 0; bi < 2; bi++) {
        var selected = choices[bi] && definition.quests[bi].verdict.options.find(function (option) { return option.id === choices[bi]; });
        if (selected && info.entries[bi].complete) benefits[selected.benefit] += selected.amount;
      }
      benefits.damageReduction = Math.min(.12, benefits.damageReduction); benefits.bossDamage = Math.min(.2, benefits.bossDamage);
      benefits.staminaRecovery = Math.min(.2, benefits.staminaRecovery); benefits.healingBonus = Math.min(.2, benefits.healingBonus);
      // Keep the earned source with each chapter benefit; pending trials grant no icon.
      info.activeBenefits = [];
      for (var qi = 0; qi < 2; qi++) {
        var q = definition.quests[qi], chosen = choices[qi] && q.verdict.options.find(function (option) { return option.id === choices[qi]; });
        if (chosen && info.entries[qi].complete) info.activeBenefits.push({ id: q.id, name: chosen.label || chosen.name || chosen.title, quest: q.name, effect: info.entries[qi].consequence, benefit: chosen.benefit, amount: chosen.amount });
      }
      info.completed = completed; info.ready = completed === 2;
      info.objective = info.ready ? KabirI18n.t('İki bağ çözüldü. Açılan kapıdan geç ve bölümün efendisini yen.') : info.entries[0].complete ? info.entries[1].objective : info.entries[0].objective;
      info.revision++; nextScan = 0; scan();
    }
    function guarded(node) {
      // ajan:quests: some relics are watched by their own dead; living foes within `guard` metres must fall first.
      if (node && node.guard && api.enemies) { for (var gi = 0; gi < api.enemies.length; gi++) { var ge = api.enemies[gi]; if (!ge.dead && !ge.reserve && !ge.boss && Math.hypot(ge.x - node.x, ge.z - node.z) < node.guard) return true; } return false; }
      if (!node || !node.trial || !api.enemies) return false;
      var room = world.rooms.find(function (r) { return String(r.id) === String(node.room); });
      if (!room) return false;
      for (var i = 0; i < api.enemies.length; i++) { var enemy = api.enemies[i];
        if (enemy.dead || enemy.reserve) continue;
        var x = Number.isFinite(enemy.spawnX) ? enemy.spawnX : enemy.x, z = Number.isFinite(enemy.spawnZ) ? enemy.spawnZ : enemy.z;
        if (Math.abs(x - room.x) <= room.w / 2 + .5 && Math.abs(z - room.z) <= room.d / 2 + .5) return true;
      }
      return false;
    }
    function trialAlreadyCleared(node) {
      if (!node || !node.trial || !api.enemies) return false;
      var room = world.rooms.find(function (r) { return String(r.id) === String(node.room); }), defenders = 0;
      if (!room) return false;
      for (var i = 0; i < api.enemies.length; i++) { var enemy = api.enemies[i];
        if (enemy.reserve) continue;
        var x = Number.isFinite(enemy.spawnX) ? enemy.spawnX : enemy.x, z = Number.isFinite(enemy.spawnZ) ? enemy.spawnZ : enemy.z;
        if (Math.abs(x - room.x) > room.w / 2 + .5 || Math.abs(z - room.z) > room.d / 2 + .5) continue;
        defenders++; if (!enemy.dead) return false;
      }
      return defenders > 0;
    }
    function scan() {
      var p = api.player, distance = RANGE * RANGE, selected = null, closest = null, closestDistance = Infinity;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i], dx = p.x - node.x, dz = p.z - node.z, d = dx * dx + dz * dz;
        if (node.available && d < closestDistance) { closest = node; closestDistance = d; }
        if (node.complete || d >= distance) continue;
        if (world.hasClearPath && !world.hasClearPath(p.x, p.z, node.x, node.z, .25)) continue;
        selected = node; distance = d;
      }
      // Follow a nearby unfinished thread, rather than send the player past another
      // available task. A substantial distance advantage prevents text flickering
      // between two equally distant goals while walking through their midpoint.
      if (closest) {
        var tx = tracked ? p.x - tracked.x : 0, tz = tracked ? p.z - tracked.z : 0;
        if (!tracked || !tracked.available || closestDistance < (tx * tx + tz * tz) * .64) tracked = closest;
        info.objective = tracked.objective;
      } else tracked = null;
      nearNode = selected;
      var sidePrompt = side ? side.scan() : null;
      if (sidePrompt && (!selected || sidePrompt.distance * sidePrompt.distance < distance)) { nearNode = null; info.prompt = sidePrompt; return; }
      if (!selected) { info.prompt = null; return; }
      prompt.id = selected.id; prompt.name = selected.name; prompt.quest = info.entries[selected.quest].name; prompt.x = selected.x; prompt.z = selected.z;
      prompt.available = selected.available && !guarded(selected);
      prompt.text = selected.available ? guarded(selected) ? KabirI18n.t('Önce bu salonun bekçilerini yen') : selected.verb : KabirI18n.t('Önce ') + (info.entries[selected.quest].target ? info.entries[selected.quest].target.name : KabirI18n.t('önceki bağı')) + ' · ' + selected.name;
      info.prompt = prompt;
    }
    function restore(saved, legacy) {
      states[0] = states[1] = 0; choices[0] = choices[1] = null; info.legacyComplete = false; info.pendingChoice = null;
      if (saved && (saved.version === 1 || saved.version === 2) && saved.chapter === chapter && Array.isArray(saved.progress)) {
        for (var qi = 0; qi < 2; qi++) {
          var q = definition.quests[qi], baseMax = (1 << q.steps.length) - 1, max = q.trial ? (1 << (q.steps.length + 1)) - 1 : baseMax, n = saved.progress[qi];
          if (!Number.isInteger(n) || n < 0 || n > max) continue;
          if (q.anyOrder || (n & (n + 1)) === 0) states[qi] = n;
          var savedChoice = saved.version === 2 && Array.isArray(saved.choices) ? saved.choices[qi] : null;
          if ((states[qi] & baseMax) === baseMax && q.verdict.options.some(function (option) { return option.id === savedChoice; })) choices[qi] = savedChoice;
          var restoredChoice = choices[qi] && q.verdict.options.find(function (option) { return option.id === choices[qi]; });
          if (!restoredChoice || !restoredChoice.trial) states[qi] &= baseMax;
        }
      } else if (legacy) { states[0] = (1 << definition.quests[0].steps.length) - 1; states[1] = (1 << definition.quests[1].steps.length) - 1; info.legacyComplete = true; }
      refresh();
      if (side) side.restore(saved && saved.chapter === chapter ? saved.side : null);
    }
    function snapshot() { return { version: 2, chapter: chapter, progress: [states[0], states[1]], choices: [choices[0], choices[1]], side: side ? side.snapshot() : null }; }
    function finish(node, verdict) {
      var q = definition.quests[node.quest];
      if (verdict) { choices[node.quest] = verdict.id;
        var g = B.app && B.app.game, pr = api.progression || g && g.progression;   // ajan:quests: the finale reads every verdict
        if (pr && pr.grantQuest) pr.grantQuest('c' + chapter + ':verdict:' + q.id + ':' + verdict.id, {}); }
      states[node.quest] |= node.bit; info.pendingChoice = null; refresh();
      if (Math.hypot(api.player.x - node.x, api.player.z - node.z) < 14) {
        api.sound('sealOpen', { x: node.x, z: node.z });
        api.fx('parry', { x: node.x, y: node.y + .8, z: node.z });
      }
      if (api.onChange) api.onChange();
      var completedEntry = info.entries[node.quest];
      api.emit('quest', { id: completedEntry.id, name: completedEntry.name, text: verdict ? completedEntry.outcome + ' ' + completedEntry.consequence : node.trial ? node.story + KabirI18n.t(' Bu bölümün efendisine verilen hasar %10 artar.') : completedEntry.complete && q.completeStory ? q.completeStory : node.story,
        complete: completedEntry.complete, completed: info.completed, total: 2, step: completedEntry.step, steps: completedEntry.steps, choice: verdict ? verdict.id : null });
      if (completedEntry.complete && q.voice && B.Audio && B.Audio.say) B.Audio.say(q.voice);
      return true;
    }
    function choose(questId, optionId) {
      if (side && info.pendingChoice && info.pendingChoice.side) return !disposed && !api.player.dead && side.choose(questId, optionId);
      if (disposed || api.player.dead || !info.pendingChoice || info.pendingChoice.questId !== questId) return false;
      var pending = info.pendingChoice, node = nodes.find(function (candidate) { return candidate.id === pending.nodeId && candidate.available; });
      if (!node) return false;
      var q = definition.quests[node.quest], option = q.verdict.options.find(function (candidate) { return candidate.id === optionId; });
      if (!option) return false;
      finish(node, option);
      if (option.trial) { var proof = nodes.find(function (candidate) { return candidate.quest === node.quest && candidate.trial; });
        if (trialAlreadyCleared(proof)) finish(proof, null);
      }
      return true;
    }
    function interact() {
      if (disposed || api.player.dead) return false;
      scan(); var node = nearNode; if (!node) return side ? side.interact() : false;
      if (!node.available) { api.emit('toast', { text: info.entries[node.quest].objective }); return true; }
      if (guarded(node)) { api.emit('toast', { text: node.guard ? L5('Ölüler bu emaneti hâlâ bekliyor. Önce etrafındakileri sustur.', 'The dead still watch over this relic. Silence those around it first.') : KabirI18n.t('Tanıklık hâlâ korunuyor. Önce bu salonun bekçilerini yen.') }); return true; }
      if (node.trial) return finish(node, null);
      var q = definition.quests[node.quest], max = (1 << q.steps.length) - 1;
      if (q.ritual && !node.trial && states[node.quest] !== node.bit - 1) {
        states[node.quest] = 0; api.player.hp = Math.max(1, api.player.hp - 14); refresh();
        api.sound('hurt', { x: node.x, z: node.z }); api.fx('parry', { x: node.x, y: node.y + .8, z: node.z });
        api.emit('toast', { text: q.wrong }); if (api.onChange) api.onChange(); return true;
      }
      if ((states[node.quest] | node.bit) === max) {
        info.pendingChoice = { questId: q.id, nodeId: node.id, title: q.verdict.title, question: q.verdict.question, options: q.verdict.options };
        info.revision++;
        api.emit('questChoice', info.pendingChoice);
        return true;
      }
      return finish(node, null);
    }
    info.choose = choose;
    info.openFinale = function () {
      var g = B.app && B.app.game;
      if (chapter === 5 && side && g && g.state === 'won' && g.campaignCompleted) return side.openFinale();
      return false;
    };
    function update(dt) {
      if (disposed) return;
      var p = api.player;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i], visible = Math.abs(p.z - node.z) < 30 && Math.abs(p.x - node.x) < 32;
        if (node.group.visible !== visible) node.group.visible = visible;
      }
      nextScan -= dt; if (nextScan <= 0) { nextScan = .12; scan(); }
      if (side) side.update(dt);
    }
    function dispose() { if (disposed) return; disposed = true; if (side) side.dispose(); root.removeFromParent(); geometry.forEach(function (g) { g.dispose(); }); root.clear(); }
    refresh();
    return { info: info, snapshot: snapshot, restore: restore, interact: interact, update: update, dispose: dispose };
  }
  B.Quests = { VERSION: 2, chapters: CHAPTERS, create: create };
})();
