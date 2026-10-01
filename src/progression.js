/* KABİR AZABI — four-chapter, kill-earned progression. No idle XP or passive talents. */
(function () {
  'use strict';
  const B = window.BABA = window.BABA || {};
  const MAX_LEVEL = 12, VERSION = 2;
  const POINTS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const LEGACY_THRESHOLDS = Object.freeze([0, 40, 100, 350, 850, 1450, 2000]);
  // Expanded route: ~60 temple foes, ~59 coastal foes, then ~60 ruin/cave and ~60 forge foes.
  // Final chapter skills arrive before the forge boss on a mostly-cleared route.
  const THRESHOLDS = Object.freeze([0, 60, 160, 550, 1200, 2100, 3200, 4600, 6000, 7600, 11000, 13000]);
  const MILESTONES = Object.freeze([5, 8, 10, 12]);
  const chapterId = n => Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1;
  const skills = Object.freeze([
    { id: 'cleave', name: 'Mezar Yaran', level: 2, requires: null, branch: 0, cost: 22, cooldown: 3,
      description: 'Kızıl bir yarım ayla önündeki düşmanları yar. Ağır silah darbesi gardı kırar.' },
    { id: 'roar', name: 'Kan Nidası', level: 2, requires: null, branch: 1, cost: 35, cooldown: 20,
      description: 'Kanlı bir şok dalgasıyla düşmanları sars; kısa süre saldırırken can kazan.' },
    { id: 'whirl', name: 'Zincir Kasırgası', level: 3, requires: null, branch: 2, cost: 40, cooldown: 8,
      description: 'Kızıl zincirlerden bir kasırga içinde dönerek çevrendeki düşmanlara dört kez vur.' },
    { id: 'charge', name: 'Kül Hücumu', level: 5, requires: 'cleave', branch: 0, cost: 30, cooldown: 7,
      description: 'Kül ve kıvılcımlar içinde ileri atıl; dar bir hatta düşmanları delip geç.' },
    { id: 'quake', name: 'Kabir Darbesi', level: 6, requires: 'roar', branch: 1, cost: 38, cooldown: 10,
      description: 'Silahını yere indir; mezar çatlakları çevrene yayılıp düşmanları sarsar.' },
    { id: 'reap', name: 'Ölüm Biçeni', level: 7, requires: 'whirl', branch: 2, cost: 42, cooldown: 12,
      description: 'Üç hayalet hilalle önündeki düşmanları tek bir dalgada biç.' },
    { id: 'brand', name: 'Kül Mührü', level: 8, requires: 'charge', branch: 0, cost: 34, cooldown: 9,
      description: 'Önündeki zemine kızgın bir mühür bas. Kısa bir gecikmeden sonra geniş bir kül patlaması düşmanları vurur.' },
    { id: 'grasp', name: 'Mezar Pençesi', level: 9, requires: 'quake', branch: 1, cost: 36, cooldown: 11,
      description: 'Önündeki düşmanları mezar zincirleriyle yarala ve yakına çek. Zincirler duvarların içinden geçmez.' },
    { id: 'rend', name: 'Son Hüküm', level: 10, requires: 'reap', branch: 2, cost: 48, cooldown: 14,
      description: 'Önüne art arda üç uzun, dar ölüm dalgası gönder. Her dalga yolundaki düşmanları yeniden yaralar.' }
,
    { id: "temper", name: "Ocak Öfkesi", level: 11, requires: "brand", branch: 0, cost: 42, cooldown: 15,
      description: "Önüne geniş bir kızgın alev yelpazesi savur. Ocak ateşi konideki düşmanları tek ağır darbeyle kavurur." },
    { id: "chainstorm", name: "Zincir Mahşeri", level: 12, requires: "grasp", branch: 1, cost: 52, cooldown: 18,
      description: "Çevrene art arda üç genişleyen zincir halkası gönder. Her halka yalnız geçtiği kuşaktaki düşmanları yaralar." }
  ].map(s => Object.freeze(Object.assign({},s,{cost:s.cost*100/110}))));
  const skillIndex = Object.fromEntries(skills.map(s => [s.id, s]));
  function item(id, name, slot, level, rarity, damage, defense, hp, type, description, modelId, finish) {
    const visualScale = slot === 'weapon' && modelId ? type === 'axe' ? [1.16, .97, 1.04] : type === 'spear' ? [.91, 1.11, .93] : finish === 'brine' ? [1.08, 1.14, .98] : [.88, 1.08, .96] : [1, 1, 1];
    return Object.freeze({ id, name, slot, level, rarity, damage: damage || 0, defense: defense || 0, hp: hp || 0,
      type: type || slot, description, icon: slot === 'weapon' ? type : slot, modelId: modelId || id, finish: finish || 'worn', visualScale: Object.freeze(visualScale) });
  }
  const items = Object.freeze([
    item('dull-sword', 'Kör Mahkûm Kılıcı', 'weapon', 1, 'common', 0, 0, 0, 'sword', 'Bir mezar mahkûmunun aşınmış, çentikli kılıcı.'),
    item('grave-sword', 'Mezar Nöbetçisi', 'weapon', 2, 'uncommon', .06, 0, 0, 'sword', 'Küller içinden çıkarılmış, hâlâ keskin bir demir kılıç.'),
    item('rust-axe', 'Paslı Yemin Baltası', 'weapon', 2, 'uncommon', .065, 0, 0, 'axe', 'Sapına bozulmuş yeminler kazınmış bir savaş baltası.'),
    item('bone-spear', 'Kemik Geçidi Mızrağı', 'weapon', 3, 'uncommon', .085, 0, 0, 'spear', 'Kemik halkalarla bağlanmış uzun bir mezar mızrağı.'),
    item('executioner-axe', 'Celladın Son Hükmü', 'weapon', 4, 'boss', .12, 0, 0, 'axe', 'Zincir Celladı’nın kırılmış mührünü taşıyan baltası. Garantili ganimet.'),
    item('bell-spear', 'Derinliklerin Suskunluğu', 'weapon', 7, 'boss', .18, 0, 0, 'spear', 'Çancının sustuğu anda karaya bıraktığı karanlık mızrak. Garantili ganimet.'),
    item('torn-chest', 'Yırtık Mahkûm Yeleği', 'chest', 1, 'common', 0, 0, 0, null, 'Soğuk taşın üstünde parçalanmış bir deri yelek.'),
    item('grave-chest', 'Kül Muhafızının Zırhı', 'chest', 3, 'uncommon', 0, .05, 4, null, 'Kararmış demir plakalar eski yaraları örter.'),
    item('coast-chest', 'Boğulmuşun Zırhı', 'chest', 5, 'rare', 0, .08, 5, null, 'Tuzla aşınmış zırhın altında kalın, koyu deri vardır.'),
    item('cloth-hood', 'Kara Bez Başlık', 'head', 1, 'common', 0, .015, 0, null, 'Sert rüzgârı kesen isli bir başlık.'),
    item('iron-helm', 'Mezar Demiri Miğfer', 'head', 3, 'uncommon', 0, .04, 1, null, 'Çatlamış ama sağlam bir mezar muhafızı miğferi.'),
    item('drowned-helm', 'Çan Nöbetçisi Miğferi', 'head', 5, 'rare', 0, .06, 2, null, 'Tuz lekeleri arasından silinmiş bir çan arması seçilir.'),
    item('rag-wraps', 'Kanlı Bez Sargılar', 'hands', 1, 'common', 0, .01, 0, null, 'Avuçların eski yaralarını tutan yıpranmış sargılar.'),
    item('chain-gloves', 'Zincir Kıran Eldivenler', 'hands', 3, 'uncommon', 0, .03, 0, null, 'Demir halkalarla güçlendirilmiş deri eldivenler.'),
    item('salt-gauntlets', 'Tuz Çeliği Eldivenler', 'hands', 6, 'rare', 0, .055, 1, null, 'Deniz kabuğu gibi aşınmış ağır çelik eldivenler.'),
    item('worn-boots', 'Yıpranmış Yol Çizmeleri', 'boots', 1, 'common', 0, .015, 0, null, 'Taş zeminde çok yürümüş çatlak deri çizmeler.'),
    item('grave-boots', 'Mezar Yolu Çizmeleri', 'boots', 3, 'uncommon', 0, .035, 1, null, 'Kalın tabanları kemik ve kömür tozuyla kaplı.'),
    item('tide-boots', 'Kara Gelgit Çizmeleri', 'boots', 5, 'rare', 0, .055, 1, null, 'Suya dayanıklı deri ile kararmış demir birlikte örülmüş.' ),
    // Variants reuse authored silhouettes and scanned material maps. Their statistics offer real choices.
    item('widow-sword', 'Dulun Son Duası', 'weapon', 3, 'uncommon', .075, 0, 2, 'sword', 'Kabzasına bir mezar duası sarılmış. Keskinlikten biraz vazgeçip yaralarını ayakta tutar.', 'grave-sword', 'ash'),
    item('mourning-axe', 'Yasın Kör Dişi', 'weapon', 4, 'rare', .10, .015, 0, 'axe', 'Çentikli ağzının ardında kalın bir demir muhafaza vardır. Celladın baltasından zayıf, daha koruyucu.', 'rust-axe', 'blood'),
    item('black-tide-sword', 'Kara Suyun Hükmü', 'weapon', 6, 'epic', .15, 0, 0, 'sword', 'Bir batığın içinde hâlâ keskin kalan siyah çelik. Üzerindeki tuz izi silinmez.', 'grave-sword', 'brine'),
    item('orphan-spear', 'Yetimin Mezarsız Yemini', 'weapon', 5, 'rare', .105, 0, 3, 'spear', 'Mızrağın kemik halkalarında adı unutulmuş bir çocuğun yemini durur.', 'bone-spear', 'bone'),
    item('ash-chest', 'Kül Kefeni', 'chest', 1, 'common', 0, .018, 1, null, 'Ateşten geriye kalan sert bez. Zırh sayılmaz ama soğuğu biraz keser.', 'torn-chest', 'ash'),
    item('mourner-chest', 'Yas Tutmayanın Yeleği', 'chest', 2, 'uncommon', 0, .025, 3, null, 'İç dikişlerine eski sargılar sıkıştırılmış karanlık deri. Demir kadar korumaz.', 'torn-chest', 'blood'),
    item('empty-vow-chest', 'Boş Yeminin Demiri', 'chest', 4, 'rare', 0, .065, 1, null, 'Sahibi sözünü tuttu; mezar yine de onu yuttu. Ağır demir yüksek koruma sağlar.', 'grave-chest', 'rust'),
    item('salt-shroud', 'Dönmeyenin Tuz Kefeni', 'chest', 5, 'rare', 0, .04, 6, null, 'Boğulmuş deri ve yelken bezi birbirine dikilmiş. Darbeleri az keser, bedeni ayakta tutar.', 'coast-chest', 'brine'),
    item('sunken-vow-chest', 'Batmış Yeminin Zırhı', 'chest', 6, 'epic', 0, .09, 2, null, 'Dipten çıkarılan plakaların arasında deniz kabukları vardır. Güçlü koruma, az can desteği.', 'coast-chest', 'rust'),
    item('funeral-hood', 'Son Duanın Başlığı', 'head', 1, 'common', 0, .005, 2, null, 'Alnına kurumuş bir dua dikilmiş isli kumaş. Koruması zayıf, sıcaklığı hâlâ vardır.', 'cloth-hood', 'ash'),
    item('orphan-hood', 'Kimsesizin Kara Örtüsü', 'head', 2, 'uncommon', 0, .02, 1, null, 'İs ve yağmurla ağırlaşmış bir başlık. İçinde hiçbir isim yazmaz.', 'cloth-hood', 'blood'),
    item('no-witness-helm', 'Şahitsiz Ölüm Miğferi', 'head', 4, 'rare', 0, .05, 0, null, 'Yüzü örten demirde gözler için iki ince yarık bırakılmış.', 'iron-helm', 'rust'),
    item('silent-watch-helm', 'Sessiz Nöbetin Yüzü', 'head', 5, 'rare', 0, .035, 3, null, 'Kaybolan fener nöbetçisinin miğferi. Tuzla ağırlaşmış astarı başını korur.', 'drowned-helm', 'brine'),
    item('last-breath-helm', 'Son Nefesin Demiri', 'head', 6, 'epic', 0, .065, 1, null, 'İç yüzündeki tırnak izleri hiçbir ateşle silinmemiş.', 'drowned-helm', 'bone'),
    item('burial-wraps', 'Gömülmeyenin Sargıları', 'hands', 1, 'common', 0, .005, 1, null, 'Mezarı hazırlanmamış bir ölünün koyu sargıları. Parmakları sıcak tutar.', 'rag-wraps', 'ash'),
    item('cold-prayer-gloves', 'Soğuk Duanın Elleri', 'hands', 2, 'uncommon', 0, .02, 0, null, 'Çatlak deriye birkaç demir halka işlenmiş. Avuçlarda eski dua izleri vardır.', 'chain-gloves', 'rust'),
    item('nameless-gauntlets', 'İsimsizin Demir Parmakları', 'hands', 4, 'rare', 0, .04, 0, null, 'Eklemlerini pas tutmuş eldivenlerin her parmağında bir çentik sayılır.', 'chain-gloves', 'blood'),
    item('drowned-wraps', 'Boğulmuş Duanın Sargıları', 'hands', 5, 'rare', 0, .025, 3, null, 'Tuzla sertleşmiş bezin içine kuru ot ve deri sıkıştırılmış.', 'rag-wraps', 'brine'),
    item('widow-gauntlets', 'Dulun Son Dokunuşu', 'hands', 6, 'epic', 0, .06, 0, null, 'Demir parmakların üstünde yüzük izleri kalmış. Güçlü koruması dışında hiçbir tesellisi yok.', 'salt-gauntlets', 'bone'),
    item('ash-footwraps', 'Kül İçinde Kalan Adımlar', 'boots', 1, 'common', 0, .005, 1, null, 'İs tutmuş deri bağlar kırık tabanları bir arada tutar.', 'worn-boots', 'ash'),
    item('gallows-boots', 'Darağacının Son Yolu', 'boots', 2, 'uncommon', 0, .025, 0, null, 'Tabanındaki demir çiviler mahkûmun yürüdüğü son yolu hatırlar.', 'grave-boots', 'rust'),
    item('lost-pilgrim-boots', 'Dönmeyen Hacının İzleri', 'boots', 4, 'rare', 0, .025, 3, null, 'Çatlak derinin altında kalın kumaş vardır. Ağır zırh kadar korumaz.', 'worn-boots', 'blood'),
    item('sunken-steps', 'Dipte Unutulan Adımlar', 'boots', 5, 'rare', 0, .045, 2, null, 'Islak çelik ve kararmış deri, çoktan batmış bir yolcudan kalmış.', 'tide-boots', 'brine'),
    item('grave-silence-boots', 'Mezar Sessizliğinin Çizmeleri', 'boots', 6, 'epic', 0, .065, 0, null, 'İçlerine kum dolmuş ağır demir çizmeler. Güçlü koruması her adımda hissedilir.', 'tide-boots', 'bone'),
    item('ruin-lament-sword', 'Harabenin Susmayan Ağıdı', 'weapon', 7, 'epic', .175, 0, 2, 'sword', 'Yıkık bir sunağın altından çıkarılmış kılıç. Kabzasındaki adları kimse hatırlamaz.', 'grave-sword', 'ash'),
    item('sepulcher-axe', 'Boş Lahdin Ağzı', 'weapon', 8, 'epic', .195, 0, 0, 'axe', 'Bir lahit kapağından dövülmüş ağır balta. Taş tozu hâlâ ağzında durur.', 'executioner-axe', 'bone'),
    item('starved-spear', 'Açlığın Son Yemini', 'weapon', 8, 'epic', .175, .015, 2, 'spear', 'Yeraltında açlıktan ölmüş bir nöbetçinin mızrağı. Sapı kuru deriyle tekrar bağlanmış.', 'bone-spear', 'rust'),
    item('cave-verdict-sword', 'Kör Mağaranın Hükmü', 'weapon', 9, 'epic', .21, 0, 1, 'sword', 'Işıksız kayaların arasından keskin bir ağız olarak doğmuş siyah demir.', 'grave-sword', 'blood'),
    item('broken-throne-axe', 'Kırık Tahtın İntikamı', 'weapon', 9, 'epic', .195, 0, 4, 'axe', 'Çökmüş tahtın demirinden yapılmış balta. Keskinlik yerine sahibini hayatta tutar.', 'executioner-axe', 'ash'),
    item('hollow-crown-blade', 'Tahtsız Kralın Son Sözü', 'weapon', 10, 'boss', .25, 0, 3, 'sword', 'Boş Kral düştüğünde bıraktığı kemik kabzalı kılıç. Artık hiçbir tahta yemin etmez.', 'grave-sword', 'bone'),
    item('ruin-burial-chest', 'Yıkıntının Kefen Zırhı', 'chest', 7, 'epic', 0, .095, 2, null, 'Harabe taşlarının altında çürümüş deri ve ağır demir, son bir kez bir araya getirildi.', 'grave-chest', 'ash'),
    item('warden-chainmail', 'Mezar Ustasının Son Nöbeti', 'chest', 8, 'epic', 0, .10, 3, null, 'Harabe bekçisinin örülmüş karanlık zırhı. Pasın altında sağlam halkalar kalmış.', 'coast-chest', 'rust'),
    item('hollow-heart-chest', 'İçi Boş Kalbin Kefeni', 'chest', 9, 'epic', 0, .065, 8, null, 'Kalp hizasındaki demir sökülmüş; geriye kalın, kanla sertleşmiş deri bırakılmış.', 'torn-chest', 'blood'),
    item('sunless-vow-chest', 'Güneşsiz Yeminin Zırhı', 'chest', 10, 'epic', 0, .115, 1, null, 'Işığa hiç çıkmamış demir plakalar ağır darbeleri keser; içinde bir umut saklamaz.', 'coast-chest', 'bone'),
    item('forgotten-face-helm', 'Unutulan Yüzün Demiri', 'head', 7, 'epic', 0, .07, 1, null, 'Yüz kısmı külle tıkanmış bir mezar miğferi. İçinde bir isim bulunmaz.', 'iron-helm', 'ash'),
    item('buried-prayer-hood', 'Göçük Altındaki Dua', 'head', 8, 'epic', 0, .045, 5, null, 'Bir mağara göçüğünün altında kalmış kalın kumaş. Darbeleri az keser ama sıcaklığı kalır.', 'cloth-hood', 'blood'),
    item('sealed-gaze-helm', 'Mühürlü Bakış', 'head', 9, 'epic', 0, .08, 1, null, 'Göz çevresine kemik halkalar bağlanmış kararmış çelik. Görmediği ölüler hâlâ önündedir.', 'drowned-helm', 'bone'),
    item('last-witness-helm', 'Son Şahidin Suskunluğu', 'head', 10, 'epic', 0, .055, 6, null, 'Astarına son tanıklığın yazıldığı miğfer. Mürekkep kanla karışmış, sözler okunmaz olmuş.', 'drowned-helm', 'rust'),
    item('grave-digger-grasp', 'Gömülemeyenin Parmakları', 'hands', 7, 'epic', 0, .065, 1, null, 'Taş kazmaktan aşınmış metal parmaklar. El sahibine bir mezar açamamış.', 'chain-gloves', 'ash'),
    item('black-stone-gauntlets', 'Kara Taşın Pençeleri', 'hands', 8, 'epic', 0, .075, 0, null, 'Demir eklemlerde mağaranın kara tozu birikmiş. Ağır korumanın altında deri incelmiştir.', 'salt-gauntlets', 'bone'),
    item('blood-oath-wraps', 'Ödenmemiş Kan Borcu', 'hands', 9, 'epic', 0, .045, 5, null, 'Sargıların arasında tutulmuş son bir yemin vardır. Kimse o borcu ödeyememiş.', 'rag-wraps', 'blood'),
    item('buried-road-boots', 'Gömülen Yolun İzleri', 'boots', 7, 'epic', 0, .07, 1, null, 'Tabanlarında kapanmış tünellerin taşları kalmış. Geri dönülecek bir yol yok.', 'grave-boots', 'rust'),
    item('cave-mourning-boots', 'Mağaranın Kara Yası', 'boots', 8, 'epic', 0, .045, 5, null, 'Yırtık derinin içine kalın mezar bezi dikilmiş. Her adımı son adım gibi tutar.', 'worn-boots', 'ash'),
    item('throneless-steps', 'Tahtsızların Son Yürüyüşü', 'boots', 10, 'epic', 0, .08, 2, null, 'İç yüzünde sökülmüş bir kral arması olan ağır çizmeler. Artık sahibinden başka kimseye hizmet etmez.', 'tide-boots', 'bone')
,
    item("slag-edge-sword", "Cürufun Son Ağzı", "weapon", 10, "epic", 0.235, 0, 2, "sword", "Kapanmış ocağın siyah cürufu kılıcın ağzına işlemiş. Keskinliğin ardında kalın demir kalır.", "grave-sword", "rust"),
    item("furnace-mourning-spear", "Ocağın Yas Mızrağı", "weapon", 10, "epic", 0.225, 0.015, 3, "spear", "Isıyla eğrilmiş mızrak yeniden doğrultulmuş; sapında unutulmuş nöbetlerin izleri vardır.", "bell-spear", "ash"),
    item("ember-vow-axe", "Sönmeyen Yemin", "weapon", 11, "epic", 0.255, 0, 0, "axe", "Kızgın ocak demirinden dövülmüş çentikli balta. Sahibinin yemini çoktan yanmış, metal kalmıştır.", "executioner-axe", "blood"),
    item("black-forge-sword", "Kara Dövmenin Hükmü", "weapon", 11, "epic", 0.24, 0, 4, "sword", "Ağzına açılmış küçük deliklerde ocak isi birikir. Keskinlikten vazgeçip savaşçıyı ayakta tutar.", "grave-sword", "bone"),
    item("last-coal-spear", "Son Kömürün Duası", "weapon", 12, "epic", 0.27, 0, 1, "spear", "Demir ucunun üzerinde dua yerine kül durur. Ocağın son kömürü bu silah için söndürülmüş.", "bell-spear", "rust"),
    item("furnace-oath-axe", "Ocağın Son Hükmü", "weapon", 12, "boss", 0.3, 0, 0, "axe", "Ocak Kalbi sustuğunda geriye bıraktığı ağır infaz baltası. Artık hiçbir ateşe hizmet etmez.", "executioner-axe", "blood"),
    item("slag-burial-chest", "Cüruf Kefeni", "chest", 10, "epic", 0, 0.12, 2, null, "Soğuyan demir parçaları mezar derisine dikilmiş. Ölü bir ocağın ağırlığını taşır.", "coast-chest", "rust"),
    item("ash-warden-chest", "Kül Nöbetinin Son Zırhı", "chest", 11, "epic", 0, 0.125, 3, null, "Kül nöbetçisinin kararmış plakalarında yalnız son vardiyanın izleri kalmış.", "coast-chest", "ash"),
    item("hollow-ember-chest", "İçi Boş Korun Kefeni", "chest", 11, "epic", 0, 0.08, 9, null, "Kalın bezin içine kat kat deri dikilmiş. Demirden zayıf, bedeni ayakta tutmakta daha kuvvetli.", "torn-chest", "blood"),
    item("buried-fire-chest", "Gömülen Ateşin Demiri", "chest", 12, "epic", 0, 0.135, 1, null, "Ateşte unutulup yeniden sertleşmiş plakalar. Sahibinin adı da onlar kadar kararmış.", "grave-chest", "bone"),
    item("last-shift-helm", "Son Vardiyanın Yüzü", "head", 10, "epic", 0, 0.085, 1, null, "Siperindeki kurum hiç çıkmamış. Vardiya bitmiş ama miğfer sahibine dönememiş.", "iron-helm", "ash"),
    item("coal-mourner-hood", "Kömür Yasçısının Örtüsü", "head", 10, "epic", 0, 0.055, 6, null, "Ocakta kalanları arayan bir yasçının kalın başlığı. İç astarı eski yaraları sıcak tutar.", "cloth-hood", "blood"),
    item("sealed-furnace-helm", "Mühürlü Ocağın Bakışı", "head", 11, "epic", 0, 0.095, 0, null, "Yüzünü bir döküm maskesi örter. İçindeki tırnak izleri siperden dışarı hiç ulaşmamış.", "drowned-helm", "rust"),
    item("no-dawn-helm", "Şafaksızın Son Yüzü", "head", 12, "epic", 0, 0.07, 6, null, "Şafağı bekleyen bir işçinin demiri. Bekleyiş sona ermiş; kalın astar hâlâ sağlam.", "drowned-helm", "bone"),
    item("slag-fingers", "Cüruf Parmakları", "hands", 10, "epic", 0, 0.085, 1, null, "Erimiş metalin izleri eklemleri örtmüş. Bu eller artık bir ocak yakmayacak.", "salt-gauntlets", "rust"),
    item("burnt-oath-wraps", "Yanmış Yeminin Sargıları", "hands", 11, "epic", 0, 0.05, 6, null, "Kurumuş sargıların içine ağır deri sıkıştırılmış. Koru yumruklayan bir mahkûmdan kalmış.", "rag-wraps", "blood"),
    item("black-anvil-grasp", "Kara Örsün Pençeleri", "hands", 12, "epic", 0, 0.1, 0, null, "Kalın demir parmaklar ocağın örsünden yapılmış. Eldivenlerin içi sessiz ve soğuk.", "chain-gloves", "bone"),
    item("ash-road-boots", "Kül Yolunun Son Adımları", "boots", 10, "epic", 0, 0.08, 2, null, "Tabanlarına kül ve çelik talaşı dolmuş. Geldikleri yol artık bir göçüğün altında.", "grave-boots", "ash"),
    item("last-worker-boots", "Son İşçinin Çizmeleri", "boots", 11, "epic", 0, 0.055, 6, null, "Yırtık tabanları kat kat deriyle kapanmış. Sahibi ocağın son sesini bunlarla duymuş.", "worn-boots", "blood"),
    item("dead-forge-steps", "Ölü Dövmenin İzleri", "boots", 12, "epic", 0, 0.1, 1, null, "Demir uçlarında kapanmış dökümhanenin işaretleri bulunur. Hiçbir kapı artık bu izleri tanımaz.", "tide-boots", "rust")
  ]);
  const catalog = Object.freeze(Object.fromEntries(items.map(i => [i.id, i])));
  const qualities = Object.freeze({ common: { name: 'Sıradan', rank: 0, color:'#c7bdae' }, uncommon: { name: 'Sıradışı', rank: 1, color:'#92ad7d' }, rare: { name: 'Nadir', rank: 2, color:'#82aac5' }, epic: { name: 'Epik', rank: 3, color:'#b394ce' }, boss: { name: 'Eşsiz', rank: 4, color:'#d6b475' } });
  // Every identity has a fixed quality. Individual drops vary slightly in craftsmanship.
  function resolveItem(entry) {
    const def = entry && catalog[entry.id]; if (!def) return null;
    const roll = def.rarity === 'boss' ? 0 : Math.max(-2, Math.min(2, Number.isInteger(entry.roll) ? entry.roll : 0));
    const factor = 1 + roll * .025;
    return Object.assign({}, def, { roll, power: def.level * 10 + qualities[def.rarity].rank * 4 + roll,
      damage: def.damage * factor, defense: def.defense * factor, hp: Math.round(def.hp * factor) });
  }
  const slots = Object.freeze(['weapon', 'head', 'chest', 'hands', 'boots']);
  const XP = Object.freeze({ prisoner: 19, guard: 25, cultist: 23, stalker: 23, carrier: 25 });
  const hash = value => { let h = 2166136261; for (let n = 0; n < value.length; n++) h = Math.imul(h ^ value.charCodeAt(n), 16777619); return h >>> 0; };
  const result = (ok, reason) => ({ ok, reason: reason || '' });
  const int = (v, fallback) => Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;

  function create(options) {
    options = options || {};
    const emit = typeof options.emit === 'function' ? options.emit : function () {};
    const state = { level: 1, xp: 0, points: 0, learned: [], loadout: [null, null, null], inventory: [],
      equipment: {}, groundLoot: [], revision: 0, chapter: chapterId(options.chapter), completed: [] };
    let lootSeed = 0, lootDry = 0, rewards = Object.create(null), serial = 0, statCache = null, statRevision = -1;
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
      state.level = 1; state.xp = 0; state.points = 0; state.learned = []; state.loadout = [null, null, null];
      state.inventory = []; state.groundLoot = []; state.equipment = { weapon: null, head: null, chest: null, hands: null, boots: null };
      lootSeed = Math.floor(Math.random() * 4294967296) >>> 0; lootDry = 0;
      state.chapter = 1; state.completed = []; rewards = Object.create(null); serial = 0;
      state.equipment.weapon = addItem('dull-sword').uid;
      state.equipment.chest = addItem('torn-chest').uid;
      changed(); return state;
    }
    function snapshot() {
      return { version: VERSION, level: state.level, xp: state.xp, points: state.points,
        learned: state.learned.slice(), loadout: state.loadout.slice(), inventory: state.inventory.map(i => ({ uid: i.uid, id: i.id, roll: i.roll || 0 })),
        equipment: Object.assign({}, state.equipment), chapter: state.chapter, completed: state.completed.slice(),
        rewards: Object.keys(rewards), serial, lootSeed, lootDry,
        groundLoot: state.groundLoot.map(i => ({ uid:i.uid, id:i.id, roll:i.roll, x:i.x, z:i.z, chapter:i.chapter, boss:i.boss })) };
    }
    function restore(profile) {
      if (!profile || (profile.version !== VERSION && profile.version !== 1) || !Array.isArray(profile.inventory)) return false;
      lootSeed = Number.isInteger(profile.lootSeed) ? profile.lootSeed >>> 0 : hash(JSON.stringify(profile.inventory));
      lootDry = Math.min(8, int(profile.lootDry, 0));
      let restoredXp = int(profile.xp, 0);
      if (profile.version === 1) {
        // Preserve earned levels in older two-chapter saves, using XP rather than a claimed level/point count.
        let tier = 0;
        for (let n = 1; n < LEGACY_THRESHOLDS.length; n++) if (restoredXp >= LEGACY_THRESHOLDS[n]) tier = n;
        const fraction = tier < LEGACY_THRESHOLDS.length - 1 ? (restoredXp - LEGACY_THRESHOLDS[tier]) / (LEGACY_THRESHOLDS[tier + 1] - LEGACY_THRESHOLDS[tier]) : 0;
        restoredXp = Math.floor(THRESHOLDS[tier] + fraction * (THRESHOLDS[tier + 1] - THRESHOLDS[tier]));
      }
      state.xp = Math.min(THRESHOLDS[MAX_LEVEL - 1], restoredXp); recalculate();
      const learned = new Set();
      for (const skill of skills) if (learned.size < POINTS[state.level - 1] && Array.isArray(profile.learned) && profile.learned.includes(skill.id) && state.level >= skill.level &&
        (!skill.requires || learned.has(skill.requires))) learned.add(skill.id);
      state.learned = Array.isArray(profile.learned) ? profile.learned.filter((id, n, list) => learned.has(id) && list.indexOf(id) === n) : []; recalculate();
      const seen = new Set();
      state.inventory = profile.inventory.filter(i => i && typeof i.uid === 'string' && i.uid.length < 160 && catalog[i.id] && !seen.has(i.uid) && seen.add(i.uid))
        .map(i => ({ uid: i.uid, id: i.id, roll: catalog[i.id].rarity === 'boss' ? 0 : Math.max(-2, Math.min(2, Number.isInteger(i.roll) ? i.roll : 0)) }));
      state.groundLoot = (Array.isArray(profile.groundLoot) ? profile.groundLoot : []).filter(i =>
        i && typeof i.uid === 'string' && /^drop-[1234]:/.test(i.uid) && i.uid.length < 160 && catalog[i.id] &&
        Number.isFinite(i.x) && Number.isFinite(i.z) && Math.abs(i.x)<2048 && Math.abs(i.z)<2048 &&
        [1,2,3,4].includes(i.chapter) && !seen.has(i.uid) && seen.add(i.uid)).slice(0,96)
        .map(i => ({ uid:i.uid, id:i.id, roll:catalog[i.id].rarity==='boss'?0:Math.max(-2,Math.min(2,Number.isInteger(i.roll)?i.roll:0)), x:i.x, z:i.z, chapter:i.chapter, boss:!!i.boss }));
      serial = Math.max(int(profile.serial, 0), state.inventory.reduce((n, i) => Math.max(n, /^gear-\d+$/.test(i.uid) ? Number(i.uid.slice(5)) : 0), 0));
      state.equipment = {};
      for (const slot of slots) {
        const entry = state.inventory.find(i => profile.equipment && i.uid === profile.equipment[slot]);
        state.equipment[slot] = entry && catalog[entry.id].slot === slot && catalog[entry.id].level <= state.level ? entry.uid : null;
      }
      if (!profile.equipment || !Object.prototype.hasOwnProperty.call(profile.equipment,'weapon')) state.equipment.weapon = addItem('dull-sword').uid;
      state.loadout = [0, 1, 2].map(n => Array.isArray(profile.loadout) && learned.has(profile.loadout[n]) ? profile.loadout[n] : null);
      // A skill has one home: copied/corrupt saves cannot equip it twice.
      state.loadout = state.loadout.map((id, n, list) => id && list.indexOf(id) !== n ? null : id);
      rewards = Object.create(null);
      if (Array.isArray(profile.rewards)) for (const key of profile.rewards) if (typeof key === 'string' && /^[1234]:/.test(key) && key.length < 240) rewards[key] = true;
      state.chapter = chapterId(profile.chapter);
      state.completed = [1, 2, 3, 4].filter(n => Array.isArray(profile.completed) && profile.completed.includes(n));
      changed(); return true;
    }
    function unlock(id) {
      const skill = skillIndex[id];
      if (!skill) return result(false, 'Böyle bir yetenek yok.');
      if (state.learned.includes(id)) return result(false, 'Bu yetenek zaten öğrenildi.');
      if (state.level < skill.level) return result(false, skill.level + '. seviye gerekli.');
      if (skill.requires && !state.learned.includes(skill.requires)) return result(false, 'Önce ' + skillIndex[skill.requires].name + ' öğrenilmeli.');
      if (state.points < 1) return result(false, 'Yetenek puanın yok.');
      state.learned.push(id); state.points--;
      const free = state.loadout.indexOf(null); if (free >= 0) state.loadout[free] = id;
      changed('progression', { unlocked: id, level: state.level, points: state.points }); return result(true);
    }
    function assign(slot, id) {
      if (!Number.isInteger(slot) || slot < 0 || slot > 2) return result(false, 'Geçersiz yetenek yuvası.');
      if (id !== null && !state.learned.includes(id)) return result(false, 'Önce bu yeteneği öğren.');
      const previous = state.loadout[slot], other = id === null ? -1 : state.loadout.indexOf(id);
      if (other !== -1 && other !== slot) state.loadout[other] = previous;
      state.loadout[slot] = id; changed(); return result(true);
    }
    function equip(uid) {
      const entry = state.inventory.find(i => i.uid === uid);
      if (!entry) return result(false, 'Bu eşya çantanda değil.');
      const def = catalog[entry.id];
      if (def.level > state.level) return result(false, def.level + '. seviye gerekli.');
      state.equipment[def.slot] = uid; changed('progression', { equipped: uid, slot: def.slot }); return result(true);
    }
    function unequip(slot) {
      if (!slots.includes(slot)) return result(false,'Geçersiz donanım yuvası.');
      if (!state.equipment[slot]) return result(false,'Bu yuva zaten boş.');
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
      statRevision = state.revision;
      statCache = Object.freeze({ maxHp: hp, maxHealth: hp, damage, damageMultiplier: damage, defense, defenseReduction: defense,
        weaponId, weaponType: weaponId ? catalog[weaponId].type : 'unarmed', criticalChance: .08, criticalMultiplier: 1.5 });
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
    function loot(enemyId, type, boss, chapter, elite, position) {
      chapter = chapterId(chapter);
      const key = chapter + ':' + String(enemyId), seed = hash(key + ':' + type + ':' + lootSeed);
      const uid = 'drop-' + key;
      if (state.inventory.some(i => i.uid === uid) || state.groundLoot.some(i => i.uid === uid)) return [];
      let id;
      if (boss) id = chapter === 4 ? 'furnace-oath-axe' : chapter === 3 ? 'hollow-crown-blade' : chapter === 2 ? 'bell-spear' : 'executioner-axe';
      else if (chapter === 3 && type === 'ruinwarden') id = 'warden-chainmail';
      else if (chapter === 4 && type === 'ashwarden') id = 'ash-warden-chest';
      else {
        if (seed % 100 >= (elite ? 55 : 18) && lootDry < 8) { lootDry++; return []; }
        const lootLevel = Math.min(state.level, chapter === 4 ? MAX_LEVEL : chapter === 3 ? 10 : chapter === 2 ? 8 : 5);
        const pool = items.filter(i => i.rarity !== 'boss' && i.id !== 'dull-sword' && i.id !== 'torn-chest' &&
          i.level <= lootLevel && i.level >= Math.max(1, lootLevel - 2));
        if (!pool.length) return [];
        const tier = elite ? pool.filter(def => def.level >= Math.max(1, state.level - 1)) : pool;
        const available = tier.length ? tier : pool;
        const fresh = available.filter(def => !state.inventory.some(entry => entry.id === def.id) && !state.groundLoot.some(entry => entry.id === def.id));
        const choices = fresh.length ? fresh : available;
        id = choices[(seed >>> 8) % choices.length].id;
      }
      lootDry = 0;
      const roll = boss ? 0 : (hash(key + ':craft:' + lootSeed) % 5) - 2;
      if (options.groundLoot) {
        // Ground-loot games never bypass pickup by inserting a reward straight into the bag.
        if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return [];
        const entry = {uid,id,roll,x:position.x,z:position.z,chapter,boss:!!boss};
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
      state.groundLoot = state.groundLoot.filter(i => i.chapter !== chapter);
      state.chapter = Math.min(4, chapter + 1); changed(); return true;
    }
    Object.assign(state, { snapshot, restore, grantEnemy, unlock, assign, equip, stats, loot, completedChapter, reset,
      skillForSlot: slot => skillIndex[state.loadout[slot]] || null,
      collectLoot, unequip, isUpgrade,
      itemForSlot: slot => { const entry = state.inventory.find(i => i.uid === state.equipment[slot]); return resolveItem(entry); },
      nextLevelXp: () => state.level < MAX_LEVEL ? THRESHOLDS[state.level] : null });
    reset(); state.chapter = chapterId(options.chapter); if (options.profile) restore(options.profile);
    return state;
  }
  B.Progression = Object.freeze({ create, skills, items, catalog, qualities, resolveItem, slots, MAX_LEVEL, VERSION, thresholds: THRESHOLDS, earnedPoints: POINTS, milestones: MILESTONES });
}());
