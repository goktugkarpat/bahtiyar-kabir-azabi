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
  var CHAPTERS = {
    1: { title: KabirI18n.t('İsimleri Çalınanlar'), introduction: KabirI18n.t('Cellat yalnız bedenleri zincirlememiş. Ölülerin isimlerini ve yeminlerini de kapıya bağlamış.'), quests: [
      { id: 'lost-names', name: KabirI18n.t('İsimsizlerin Yemini'), description: KabirI18n.t('Unutulanların adlarını bul ve sahiplerine geri ver.'), steps: [
        { id: 'names', room: 7, dx: -2.6, dz: 2.6, shape: 'tablet', name: KabirI18n.t('İsim Levhası'), verb: KabirI18n.t('İsim levhasını al'), objective: KabirI18n.t('Unutulanların Mahzeni’nde isim levhasını bul.'), story: KabirI18n.t('Taşa kazınmış her isim bir mahkûma ait. Son satır henüz boş: Bahtiyar. Levhayı Çürüyen Revir’deki anı taşına götür.') },
        { id: 'memorial', room: 2, dx: 4.2, dz: 3, shape: 'memorial', name: KabirI18n.t('Mahkûmların Anı Taşı'), verb: KabirI18n.t('İsimleri anı taşına yerleştir'), objective: KabirI18n.t('Çürüyen Revir’de isimleri anı taşına yerleştir.'), story: KabirI18n.t('İsimler yerlerine dönünce zincirlerin içindeki fısıltı kesiliyor. Celladın ilk bağı çözüldü.') }
      ] },
      { id: 'blood-verdict', name: KabirI18n.t('Kanla Yazılan Hüküm'), description: KabirI18n.t('Adak Salonu’ndaki hükmü tersine çevir: önce Kül, sonra Kan, son olarak Yemin.'), steps: [
        { id: 'ash', room: 3, dx: -5.4, dz: 3.4, shape: 'censer', name: KabirI18n.t('Kül Çanağı'), verb: KabirI18n.t('Kül çanağını söndür'), objective: KabirI18n.t('Adak Salonu’nda ayini boz: Kül → Kan → Yemin.'), story: KabirI18n.t('Kül çanağı sönüyor. Kazınmış söz ortaya çıktı: “Beden unutulur; kan tanıklık eder.” Sırada Kan Çanağı var.') },
        { id: 'blood', room: 3, dx: 0, dz: -2.5, shape: 'censer', name: KabirI18n.t('Kan Çanağı'), verb: KabirI18n.t('Kan çanağının bağını çöz'), objective: KabirI18n.t('Adak Salonu’nda ikinci bağı çöz: Kan Çanağı.'), story: KabirI18n.t('Kan çanağının demir bağı açılıyor. Hükmü bozmak için son taşı çevir: Yemin.') },
        { id: 'oath', room: 3, dx: 5.4, dz: 3.4, shape: 'seal', name: KabirI18n.t('Hüküm Mührü'), verb: KabirI18n.t('Yemin mührünü tersine çevir'), objective: KabirI18n.t('Adak Salonu’nda Yemin Mührü’nü tersine çevir.'), story: KabirI18n.t('Kurbanın yemini celladına döndü. Mahkeme kapısının kanla beslenen bağı kırıldı. Yeraltından kıyıya çıkan yolu Cellat koruyor.') }
      ] }
    ] },
    2: { title: KabirI18n.t('Denizin Sakladığı'), introduction: KabirI18n.t('Kıyıdaki ölüler çanın sesiyle uyanıyor. Fener sönmeden önce burada neler olduğunu hatırlayanlar hâlâ köklerin altında.'), quests: [
      { id: 'last-voice', name: KabirI18n.t('Boğulanların Son Sesi'), description: KabirI18n.t('Batık Gümrük’te kaybolan çan dilini bul; Son Fener’deki yas çanına geri tak.'), steps: [
        { id: 'clapper', room: 7, dx: -2.8, dz: 3, shape: 'relic', name: KabirI18n.t('Kırık Çan Dili'), verb: KabirI18n.t('Kırık çan dilini al'), objective: KabirI18n.t('Batık Gümrük Avlusu’nda kırık çan dilini bul.'), story: KabirI18n.t('Çan diline bir fenercinin yemini kazınmış: “Dönenleri değil, dönmeyenleri çağır.” Son Fener’deki küçük yas çanı bunu bekliyor.') },
        { id: 'mourning-bell', room: 5, dx: -4.5, dz: 4, shape: 'bell', name: KabirI18n.t('Yas Çanı'), verb: KabirI18n.t('Çan dilini yerine tak ve çanı çal'), objective: KabirI18n.t('Son Fener’de çan dilini yas çanına tak.'), story: KabirI18n.t('Yas çanı ilk kez ölüler için çalıyor. Denizdeki çığlıklar bir an durdu; büyük çanın ilk bağı koptu.') }
      ] },
      { id: 'root-memory', name: KabirI18n.t('Kara Kökün Hafızası'), completeStory: KabirI18n.t('İki hatıra serbest kaldı. Kökler çekilirken taşta aynı arma beliriyor: boş bir tahtın altında yanan ocak. Çancının ikinci bağı çözüldü.'), description: KabirI18n.t('Kara Ağacın Mezarlığı’ndaki iki mezar kabını aç; köklerin tutsak ettiği hatıraları serbest bırak.'), anyOrder: true, steps: [
        { id: 'grave-west', room: 8, dx: -3.7, dz: 2.8, shape: 'urn', name: KabirI18n.t('Tuzla Mühürlü Mezar Kabı'), verb: KabirI18n.t('Tuz mührünü çöz'), objective: KabirI18n.t('Kara Ağacın Mezarlığı’nda tuzla mühürlü mezar kabını aç.'), story: KabirI18n.t('Kavanozun içinden su değil, kül dökülüyor. Kıyı halkı boğulmadan önce harabelerdeki krala götürülmüş.') },
        { id: 'grave-east', room: 8, dx: 3.7, dz: -2.8, shape: 'urn', name: KabirI18n.t('Kökle Mühürlü Mezar Kabı'), verb: KabirI18n.t('Kök mührünü çöz'), objective: KabirI18n.t('Kara Ağacın Mezarlığı’nda kökle mühürlü mezar kabını aç.'), story: KabirI18n.t('Köklerin tutsak ettiği hatıra serbest. Taşta boş bir tahtın altında yanan ocak beliriyor. Kıyının acısı o ateşe bağlı.') }
      ] }
    ] },
    3: { title: KabirI18n.t('Boş Tahtın Altında'), introduction: KabirI18n.t('Kıyının çanı sustu; fakat ölüleri çağıran ses mağaranın içinden geliyor. Kral kendi adını taşın içine saklamış.'), quests: [
      { id: 'kings-name', name: KabirI18n.t('Kralın Çalınmış Adı'), description: KabirI18n.t('Kralların Mezarları’ndaki ad levhasını al ve Çöken Anıt’ın eksik yerine yerleştir.'), steps: [
        { id: 'epitaph', room: 3, dx: 3.8, dz: 3.4, shape: 'tablet', name: KabirI18n.t('Kazınmış Ad Levhası'), verb: KabirI18n.t('Kazınmış ad levhasını al'), objective: KabirI18n.t('Kralların Mezarları’nda kazınmış ad levhasını bul.'), story: KabirI18n.t('Levhanın arkasında başka bir unvan var: “Ocağın ilk mahkûmu.” Kralın adı anıttan sökülmüş; yerine koymalısın.') },
        { id: 'name-monument', room: 5, dx: -3.5, dz: -1.8, shape: 'memorial', name: KabirI18n.t('Kırık Kral Anıtı'), verb: KabirI18n.t('Ad levhasını anıta yerleştir'), objective: KabirI18n.t('Çöken Anıt’ta levhayı eksik yuvaya yerleştir.'), story: KabirI18n.t('Anıt tamamlandı: kral, ocağı yönetmek için kendi adını kurban etmiş. Adı geri dönünce tahtın ilk mührü çatladı.') }
      ] },
      { id: 'cave-breath', name: KabirI18n.t('Mağaranın Nefesi'), description: KabirI18n.t('Kör Kristaller’de yankıyı serbest bırak; Taşın İçindeki Ölüler’de son ses bağını sustur.'), steps: [
        { id: 'echo', room: 7, dx: 3.6, dz: 2.7, shape: 'crystal', name: KabirI18n.t('Zincirli Yankı'), verb: KabirI18n.t('Yankının demir bağını aç'), objective: KabirI18n.t('Kör Kristaller’de zincirli yankıyı serbest bırak.'), story: KabirI18n.t('Kristalden bir emir değil, bir insan nefesi yükseliyor. Yankı kuzeydeki son ses bağına cevap veriyor.') },
        { id: 'silence', room: 9, dx: -3.4, dz: 2.2, shape: 'seal', name: KabirI18n.t('Son Ses Bağı'), verb: KabirI18n.t('Son ses bağını sustur'), objective: KabirI18n.t('Taşın İçindeki Ölüler’de son ses bağını sustur.'), story: KabirI18n.t('Mağara kendi sessizliğine kavuştu. Ses mührü söküldü; tahtın ardındaki merdiven Kızıl Ocak’a iniyor.') }
      ] }
    ] },
    4: { title: KabirI18n.t('Zincirlerin Kaynağı'), introduction: KabirI18n.t('Tapınağın hükmü, kıyının ağıdı, kralın sesi: hepsi bu ocakta dövülmüş. Kapıyı açmak yetmez; kalbi besleyen düzeni de bozmalısın.'), quests: [
      { id: 'last-prisoner', name: KabirI18n.t('Son Mahkûmun Yemini'), description: KabirI18n.t('Kömür Mahkûmları’ndaki yemin halkasını al; Zincir Kuyuları’nın vincinde kullan.'), steps: [
        { id: 'last-shackle', room: 2, dx: -3.8, dz: 2.6, shape: 'relic', name: KabirI18n.t('Son Yemin Halkası'), verb: KabirI18n.t('Yemin halkasını al'), objective: KabirI18n.t('Kömür Mahkûmları’nda son yemin halkasını bul.'), story: KabirI18n.t('Halka elini yakmıyor. Üzerinde mahkûmların ortak yemini var: “Son çıkan, zinciri de kıracak.” Kuyu vincinin kilidine uyuyor.') },
        { id: 'prison-winch', room: 7, dx: 3.8, dz: 2.5, shape: 'winch', name: KabirI18n.t('Mahkûm Vinci'), verb: KabirI18n.t('Halkayı tak ve kuyu zincirlerini bırak'), objective: KabirI18n.t('Zincir Kuyuları’nda yemin halkasıyla vinci aç.'), story: KabirI18n.t('Zincirler kuyuya boşalıyor. Artık ocak yeni bir mahkûmun nefesini çekemeyecek. İlk kilit açıldı.') }
      ] },
      { id: 'heart-feeds', name: KabirI18n.t('Kalbi Besleyen Ateş'), description: KabirI18n.t('Önce döküm akışını, sonra cüruf dönüşünü, son olarak ana beslemeyi kapat.'), steps: [
        { id: 'casting-feed', room: 5, dx: -3.5, dz: 3.3, shape: 'valve', name: KabirI18n.t('Döküm Vanası'), verb: KabirI18n.t('Döküm akışını kapat'), objective: KabirI18n.t('Sönen Dökümhane’de döküm vanasını kapat.'), story: KabirI18n.t('Sıvı demirin sesi azalıyor. Basıncı geri döndüren cüruf hattı hâlâ açık; sıradaki vana Cüruf Meydanı’nda.') },
        { id: 'slag-return', room: 9, dx: 3.6, dz: 2.8, shape: 'valve', name: KabirI18n.t('Cüruf Dönüş Vanası'), verb: KabirI18n.t('Cüruf dönüşünü kapat'), objective: KabirI18n.t('Cüruf Meydanı’nda dönüş vanasını kapat.'), story: KabirI18n.t('Geri dönüş sustu. Ana besleme artık güvenle kesilebilir. Son Döküm’deki mühürlü vanaya ulaş.') },
        { id: 'heart-feed', room: 12, dx: -3.6, dz: 2.5, shape: 'valve', name: KabirI18n.t('Kalp Besleme Vanası'), verb: KabirI18n.t('Kalbin ana beslemesini kes'), objective: KabirI18n.t('Son Döküm’de kalbin ana beslemesini kes.'), story: KabirI18n.t('Ana besleme kesildi. Kalp artık tutsaklardan beslenemiyor; ama kendi ateşi hâlâ canlı. Bu yolculuğun son zinciri içeride.') }
      ] }
    ] }
  };

  function verdict(title, question, options) { return { title: title, question: question, options: options }; }
  function option(id, name, story, benefit, amount, effect) { return { id: id, name: name, story: story, benefit: benefit, amount: amount, effect: effect }; }
  CHAPTERS[1].quests[0].verdict = verdict(KabirI18n.t('İsimler kimin için?'), KabirI18n.t('Levhada celladın gerçek adı da var. Mahkûmlara huzur mu vereceksin, yoksa onun gizlediği zaafı mı açığa çıkaracaksın?'), [
    option('rest', KabirI18n.t('Mahkûmlara huzur ver'), KabirI18n.t('Adlar anı taşına dönüyor. Seni izleyen fısıltılar birer uyarıya dönüşüyor; Celladın sırrı ölülerle kalıyor.'), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('expose', KabirI18n.t('Celladın gerçek adını açığa çıkar'), KabirI18n.t('Mahkûmların levhası Celladın adını taşıyor. Ölüler huzur bulamıyor; fakat onun her savunmasında bir çatlak görüyorsun.'), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  CHAPTERS[1].quests[1].verdict = verdict(KabirI18n.t('Hükmün son tanığı'), KabirI18n.t('Son mührü kırabilirsin; ya da hükmü saklayıp kanın onarıcı gücünü üstlenebilirsin. İki yemin birden taşınamaz.'), [
    option('break', KabirI18n.t('Hükmü bütünüyle parçala'), KabirI18n.t('Yemin taşı ikiye ayrılıyor. Mahkemenin ağır soluğu göğsünden çekiliyor; artık hiçbir ayin bu hükmü yeniden kuramayacak.'), 'staminaRecovery', .1, KabirI18n.t('Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.')),
    option('bear', KabirI18n.t('Son tanıklığı üstlen'), KabirI18n.t('Hükmü yok etmiyorsun; üzerindeki cellat adını kazıyıp mahkûmların yeminiyle mühürlüyorsun. Acı, iyileştirici bir tanıklığa dönüşüyor.'), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.'))
  ]);
  CHAPTERS[2].quests[0].verdict = verdict(KabirI18n.t('Çanın çağrısı'), KabirI18n.t('Çan artık seni dinliyor. Dönmeyenlerin ağıdını sonsuza dek susturabilir veya büyük Çancıyı kendi sesiyle yargılayabilirsin.'), [
    option('silence', KabirI18n.t('Boğulanları sessizliğe bırak'), KabirI18n.t('Son yas sesi denize karışıyor. Dönmeyenler seni koruyan bir sessizlik bırakıyor; kıyı ilk kez cevap vermiyor.'), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('accuse', KabirI18n.t('Çancıyı kendi sesiyle çağır'), KabirI18n.t('Küçük çanın sesi büyük çanın içine saplanıyor. Ölülerin ağıdı bitmiyor; Çancı artık saklanabileceği bir yankı bulamıyor.'), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  CHAPTERS[2].quests[1].verdict = verdict(KabirI18n.t('Köklerin tuttuğu hatıra'), KabirI18n.t('Kavanozlardaki kül, ocağın yolunu gösteriyor. Hatıraları köklerden kurtarmak mı, yaslarını yanında taşımak mı?'), [
    option('release', KabirI18n.t('Hatıraları köklerden kurtar'), KabirI18n.t('Kökler iki mezardan da çekiliyor. Hatıralar kıyıya yayılırken yürüyüşündeki ağırlık kayboluyor.'), 'staminaRecovery', .1, KabirI18n.t('Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.')),
    option('carry', KabirI18n.t('Yaslarını yanında taşı'), KabirI18n.t('Kökleri kesiyor ve mezar külünü saklıyorsun. Ölüler bir anlığına sana katılıyor; onların son hatırası yaranı kapatacak.'), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.'))
  ]);
  CHAPTERS[3].quests[0].verdict = verdict(KabirI18n.t('Tahtın altındaki isim'), KabirI18n.t('Levha kralın ocağın ilk mahkûmu olduğunu söylüyor. Adını geri verip suçunu görünür kılmak mı, krallığını tarihten silmek mi?'), [
    option('name', KabirI18n.t('Gerçek adını tahta kazı'), KabirI18n.t('Adı yeniden görünür oluyor. Kral artık tacının ardına saklanamıyor; ölüleri çağıran sesinde ilk kez korku duyuluyor.'), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.')),
    option('erase', KabirI18n.t('Krallığını tarihten sil'), KabirI18n.t('Unvanını kazıyor, mahkûmun adını mezarların arasına bırakıyorsun. Artık hiçbir hüküm onun tacından kuvvet alamıyor.'), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.'))
  ]);
  CHAPTERS[3].quests[1].verdict = verdict(KabirI18n.t('Mağaranın son nefesi'), KabirI18n.t('Özgür yankı dışarıya ulaşabilir. Ya da içindeki son nefesi mühürleyip ocağın derinlerine taşıyabilirsin.'), [
    option('open', KabirI18n.t('Yankıya çıkış yolu aç'), KabirI18n.t('Mağaranın çatlakları ilk kez birbirine cevap veriyor. Son nefes özgürleşirken sana daha uzun bir soluk bırakıyor.'), 'staminaRecovery', .1, KabirI18n.t('Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.')),
    option('keep', KabirI18n.t('Son nefesi mühürde sakla'), KabirI18n.t('Yankıyı susturmuyor, küçük bir mühürde koruyorsun. Gerektiğinde bu son nefes seni ölümün kıyısından çekecek.'), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.'))
  ]);
  CHAPTERS[4].quests[0].verdict = verdict(KabirI18n.t('Son çıkanın yemini'), KabirI18n.t('Vinç ocak kalbine bağlı. Mahkûmların zincirlerini bırakmak mı, zincirleri kalbin aleyhine son kez germek mi?'), [
    option('free', KabirI18n.t('Bütün mahkûm zincirlerini bırak'), KabirI18n.t('Kuyuya düşen zincirlerin ardından insan soluğu yükseliyor. Son çıkan sensin; ortak yemin sırtındaki yükü hafifletiyor.'), 'damageReduction', .06, KabirI18n.t('Bu bölümde alınan tüm hasar %6 azalır.')),
    option('turn', KabirI18n.t('Zincirleri kalbe geri bağla'), KabirI18n.t('Mahkûmların halkalarını söküp kalbin beslemesine geçiriyorsun. Tutsaklar özgür; kalp kendi hükmünün ağırlığını taşıyacak.'), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);
  CHAPTERS[4].quests[1].verdict = verdict(KabirI18n.t('Ocak sönerken'), KabirI18n.t('Ana besleme kesildi. Son koru yaraları onarmak için saklayabilir veya kalbin kendi ateşini tüketmesini sağlayabilirsin.'), [
    option('shelter', KabirI18n.t('Son koru bir sığınağa çevir'), KabirI18n.t('Koru ölüleri yakmak için değil, canlıyı korumak için saklıyorsun. Ocakta ilk kez acıdan başka bir sıcaklık kalıyor.'), 'healingBonus', .1, KabirI18n.t('Bu bölümde iksir ve can çalmayla iyileşme %10 artar.')),
    option('starve', KabirI18n.t('Kalbi kendi ateşiyle tüket'), KabirI18n.t('Geri dönüş vanasını son kez açıyor, kalbin kendi ateşini ona çeviriyorsun. Artık her yarası o ateşe hava verecek.'), 'bossDamage', .1, KabirI18n.t('Bu bölümün efendisine verilen hasar %10 artar.'))
  ]);

  // The forceful verdict opens a later, forward-facing route through an existing defended chamber.
  // The quieter verdict finishes here; the risky route only earns its boss advantage when its guardians are defeated.
  [
    { chapter: 1, choice: 'expose', room: 8, dx: -3.8, dz: 2.8, id: 'witness-proof', name: KabirI18n.t('Celladın Saklı Tanıklığı'), objective: KabirI18n.t('Sönmüş Kandiller’deki bekçileri yen ve saklı tanıklığı ortaya çıkar.'), story: KabirI18n.t('Kandillerin son bekçisi düştü. Celladın adını saklayan tanıklık serbest; artık hükmü ona geri çevirebilirsin.'), effect: KabirI18n.t('Sönmüş Kandiller’deki bekçileri yen. Ardından efendiye hasar %10 artar.') },
    { chapter: 2, choice: 'accuse', room: 12, dx: 3.4, dz: 2.6, id: 'bell-testimony', name: KabirI18n.t('Fenercinin Son Tanıklığı'), objective: KabirI18n.t('Fenersiz Sığınak’taki nöbeti kır ve fenercinin tanıklığını çana bağla.'), story: KabirI18n.t('Sığınaktaki nöbet sustu. Fenercinin tanıklığı yas çanına ulaşıyor; Çancı kendi sesinin içinde açıkta kalıyor.'), effect: KabirI18n.t('Fenersiz Sığınak’ın nöbetini yen. Ardından efendiye hasar %10 artar.') },
    { chapter: 3, choice: 'name', room: 10, dx: -3.4, dz: 2.6, id: 'royal-testimony', name: KabirI18n.t('Kralın Son Tanığı'), objective: KabirI18n.t('Yutulan Saray’daki muhafızları yen ve kralın tanıklık mührünü kır.'), story: KabirI18n.t('Sarayın son muhafızı düştü. Taç, mahkûmun adını artık saklayamıyor. Kral kendi geçmişiyle yüzleşmek zorunda.'), effect: KabirI18n.t('Yutulan Saray’ın muhafızlarını yen. Ardından efendiye hasar %10 artar.') },
    { chapter: 4, choice: 'turn', room: 10, dx: 3.2, dz: 2.4, id: 'turned-oath', name: KabirI18n.t('Kalbe Dönen Yemin'), objective: KabirI18n.t('Kızıl Fırınlar’daki bekçileri yen ve halkaları kalbin beslemesine döndür.'), story: KabirI18n.t('Korun bekçileri düştü. Mahkûmların zinciri artık kalbin kendi ateşini bağlıyor; son vuruşun yolu açıldı.'), effect: KabirI18n.t('Kızıl Fırınlar’ın bekçilerini yen. Ardından efendiye hasar %10 artar.') }
  ].forEach(function (trial) {
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
    var stone = materials.pale || materials.stone || materials.wall || materials.rock;
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
    function makeProp(node, index) {
      var group = new T.Group(), body = [], detail = [], bindings = [], s = node.shape;
      group.name = node.name; group.position.set(node.x, node.y, node.z); group.matrixAutoUpdate = false; group.updateMatrix(); root.add(group); node.group = group;
      // The low scalloped stone plinth frames the interactable without hiding actors or altering navigation.
      cyl(body, stone, .64, .58, .14, 0, .07, 0); cyl(body, stone, .49, .45, .11, 0, .195, 0);
      ring(body, trim, .47, .025, 0, .255, 0, PI / 2);
      for (var k = 0; k < 6; k++) { var angle = k * PI / 3; box(body, trim, .035, .025, .12, Math.sin(angle) * .49, .155, Math.cos(angle) * .49, 0, angle); }
      var pedestal = body; body = [];
      if (s === 'tablet' || s === 'memorial' || s === 'seal') {
        box(body, stone, .78, s === 'memorial' ? .88 : .62, .28, 0, s === 'memorial' ? .69 : .56, 0, -.13);
        box(body, metal, .83, .06, .31, 0, 1.04, -.05, -.13);
        box(body, trim, .055, .44, .045, -.27, .67, .16, -.13); box(body, trim, .055, .44, .045, .27, .67, .16, -.13);
        for (var row = 0; row < 4; row++) { box(body, trim, row % 2 ? .31 : .41, .023, .032, 0, .46 + row * .105, .17, -.13); }
        ring(detail, glow, .16, .025, 0, .9, .2); box(detail, glow, .025, .25, .022, 0, .9, .23);
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
    function place(step) {
      var room = world.rooms.find(function (r) { return String(r.id) === String(step.room); });
      if (!room) throw new Error(KabirI18n.t('Görev odası bulunamadı: ') + chapter + '/' + step.room);
      var desiredX = room.x + step.dx, desiredZ = room.z + step.dz, best = null, bestDistance = Infinity;
      // Leave room for the full prop + the hero on every side. This tests the actual collision/navigation functions,
      // so decorative blocks cannot conceal the use point. The deterministic search never changes world RNG.
      for (var iz = -5; iz <= 5; iz++) for (var ix = -5; ix <= 5; ix++) {
        var x = desiredX + ix * .7, z = desiredZ + iz * .7, d = ix * ix + iz * iz;
        if (d >= bestDistance || Math.abs(x - room.x) > room.w / 2 - 2 || Math.abs(z - room.z) > room.d / 2 - 2) continue;
        if (world.isWalkable && !world.isWalkable(x, z, 1.35)) continue;
        var overlaps = false;
        for (var n = 0; n < nodes.length; n++) if (Math.hypot(nodes[n].x - x, nodes[n].z - z) < 2.8) { overlaps = true; break; }
        if (overlaps) continue;
        if (world.pathTo && !world.pathTo(world.spawn, { x: x, z: z }, .5).length) continue;
        best = { x: x, z: z }; bestDistance = d;
      }
      if (!best) throw new Error(KabirI18n.t('Görev nesnesine açık yol bulunamadı: ') + chapter + '/' + step.id);
      return best;
    }
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
          node.available = !node.complete && (node.trial ? hasTrial && (states[qi] & (node.bit - 1)) === node.bit - 1 : q.anyOrder || states[qi] === node.bit - 1);
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
    }
    function snapshot() { return { version: 2, chapter: chapter, progress: [states[0], states[1]], choices: [choices[0], choices[1]] }; }
    function finish(node, verdict) {
      var q = definition.quests[node.quest];
      if (verdict) choices[node.quest] = verdict.id;
      states[node.quest] |= node.bit; info.pendingChoice = null; refresh();
      if (Math.hypot(api.player.x - node.x, api.player.z - node.z) < 14) {
        api.sound('sealOpen', { x: node.x, z: node.z });
        api.fx('parry', { x: node.x, y: node.y + .8, z: node.z });
      }
      if (api.onChange) api.onChange();
      var completedEntry = info.entries[node.quest];
      api.emit('quest', { id: completedEntry.id, name: completedEntry.name, text: verdict ? completedEntry.outcome + ' ' + completedEntry.consequence : node.trial ? node.story + KabirI18n.t(' Bu bölümün efendisine verilen hasar %10 artar.') : completedEntry.complete && q.completeStory ? q.completeStory : node.story,
        complete: completedEntry.complete, completed: info.completed, total: 2, step: completedEntry.step, steps: completedEntry.steps, choice: verdict ? verdict.id : null });
      return true;
    }
    function choose(questId, optionId) {
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
      scan(); var node = nearNode; if (!node) return false;
      if (!node.available) { api.emit('toast', { text: info.entries[node.quest].objective }); return true; }
      if (guarded(node)) { api.emit('toast', { text: KabirI18n.t('Tanıklık hâlâ korunuyor. Önce bu salonun bekçilerini yen.') }); return true; }
      if (node.trial) return finish(node, null);
      var q = definition.quests[node.quest], max = (1 << q.steps.length) - 1;
      if ((states[node.quest] | node.bit) === max) {
        info.pendingChoice = { questId: q.id, nodeId: node.id, title: q.verdict.title, question: q.verdict.question, options: q.verdict.options };
        info.revision++;
        api.emit('questChoice', info.pendingChoice);
        return true;
      }
      return finish(node, null);
    }
    info.choose = choose;
    function update(dt) {
      if (disposed) return;
      var p = api.player;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i], visible = Math.abs(p.z - node.z) < 30 && Math.abs(p.x - node.x) < 32;
        if (node.group.visible !== visible) node.group.visible = visible;
      }
      nextScan -= dt; if (nextScan <= 0) { nextScan = .12; scan(); }
    }
    function dispose() { if (disposed) return; disposed = true; root.removeFromParent(); geometry.forEach(function (g) { g.dispose(); }); root.clear(); }
    refresh();
    return { info: info, snapshot: snapshot, restore: restore, interact: interact, update: update, dispose: dispose };
  }
  B.Quests = { VERSION: 2, chapters: CHAPTERS, create: create };
})();
