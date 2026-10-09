/* KABİR AZABI — side, hidden and campaign-story quests (ajan: quests).
   Loaded BEFORE progression.js (it publishes BABA.QuestItemSpecs, the quest-only unique items) and before quests.js,
   which calls BABA.QuestSide.create(...) and owns persistence, prompts and the shared prop kit.
   Every visible string is registered in both languages through L(tr, en) into KabirI18n.dictionary.
   Kinds (three optional threads per chapter): hunt (named mini-boss promoted from an existing foe), rescue (living captive follows you to the oath stone),
   lore (three records per chapter). Older saves may still list removed threads (altar, siege, escape, puzzle, chest, hunt2): restore() ignores unknown ids.
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
    [
      "shroud-needle-grasp",
      KabirI18n.t("Kefen Dokuyucunun İğneleri"),
      "hands",
      3,
      "boss",
      0,
      0.04,
      3,
      null,
      KabirI18n.t("Parmak uçlarına kemik iğneler dikilmiş eldivenler. Dokuyucu bunlarla canlıların kefenini dikerdi."),
      "chain-gloves",
      "ash"
    ],
    [
      "blood-price-blade",
      "Kan Bedeli",
      "weapon",
      3,
      "boss",
      0.115,
      0,
      0,
      "sword",
      KabirI18n.t("Sunağa akan kanla bilenmiş kılıç. Ödenen bedeli her darbede hatırlatır."),
      "grave-sword",
      "blood"
    ],
    [
      "scribe-clasp-helm",
      L("Mezar Gardiyanının Başlığı", "Grave Warden’s Hood"),
      "head",
      3,
      "boss",
      0,
      0.05,
      3,
      null,
      L("Esir kilitlerinin işaretini taşıyan ağır demir başlık.", "A heavy iron hood bearing the mark of the captive locks."),
      "iron-helm",
      "rust"
    ],
    [
      "salt-oath-steps",
      KabirI18n.t("Tuz Yeminlisinin Adımları"),
      "boots",
      5,
      "boss",
      0,
      0.06,
      3,
      null,
      KabirI18n.t("Tuza gömülü bir nöbetçinin çizmeleri. Deniz onları hiç ıslatamadı."),
      "tide-boots",
      "brine"
    ],
    [
      "drowned-bargain-spear",
      KabirI18n.t("Dönmeyenlerin Pazarlığı"),
      "weapon",
      5,
      "boss",
      0.195,
      0,
      0,
      "spear",
      KabirI18n.t("Denizden kana karşılık alınmış mızrak. Ucunda hâlâ birinin son nefesi asılı."),
      "bone-spear",
      "brine"
    ],
    [
      "keeper-salt-coat",
      KabirI18n.t("Fenercinin Tuzlu Kaftanı"),
      "chest",
      5,
      "boss",
      0,
      0.085,
      5,
      null,
      L("Esir gemisinin ambarından çıkarılan tuzlu kaftan.", "A salted coat recovered from the captive ship’s hold."),
      "coast-chest",
      "brine"
    ],
    [
      "blind-seer-gaze",
      KabirI18n.t("Kör Kehanetin Gözü"),
      "head",
      6,
      "boss",
      0,
      0.08,
      3,
      null,
      KabirI18n.t("Ulvi’nin miğferi. Göz yarıkları mühürlü; yine de içinden geleceği görürsün."),
      "drowned-helm",
      "ash"
    ],
    [
      "kings-cup-axe",
      L("Kurban Bekçisinin Baltası", "Sacrifice Warden’s Axe"),
      "weapon",
      7,
      "boss",
      0.24,
      0,
      0,
      "axe",
      L("Harabelerin bekçisinden alınmış, eski bronzla güçlendirilmiş balta.", "An axe taken from the ruins’ warden, reinforced with ancient bronze."),
      "executioner-axe",
      "ash"
    ],
    [
      "royal-scribe-gauntlets",
      L("Kurban Bekçisinin Eldivenleri", "Sacrifice Warden’s Gauntlets"),
      "hands",
      7,
      "boss",
      0,
      0.075,
      3,
      null,
      L("Taş kilitleri kavrayan demir eldivenler.", "Iron gauntlets made to grip the stone locks."),
      "salt-gauntlets",
      "bone"
    ],
    [
      "ash-vizier-robe",
      KabirI18n.t("Kül Vezirinin Cübbesi"),
      "chest",
      7,
      "boss",
      0,
      0.13,
      4,
      null,
      KabirI18n.t("Kadı’ya giden yol cübbenin astarına dikilmiş. Kül hiç dökülmüyor."),
      "grave-chest",
      "ash"
    ],
    [
      "bloody-anvil-sword",
      KabirI18n.t("Kanlı Örsün Kılıcı"),
      "weapon",
      9,
      "boss",
      0.29,
      0,
      0,
      "sword",
      KabirI18n.t("Senin kanınla soğutulan çelik. Ocak sönse de bu kılıç sıcak kalır."),
      "grave-sword",
      "blood"
    ],
    [
      "selvi-last-road",
      L("Esirin Son Yolu", "Captive’s Last Road"),
      "boots",
      9,
      "boss",
      0,
      0.09,
      4,
      null,
      L("Kaçış yolunda taş ve cürufa dayanacak kalın tabanlı çizmeler.", "Thick-soled boots made to cross stone and slag on the road to freedom."),
      "tide-boots",
      "bone"
    ],
    [
      "weaver-apprentice-wraps",
      KabirI18n.t("Çırağın Kanlı Makarası"),
      "hands",
      3,
      "boss",
      0,
      0.035,
      5,
      null,
      KabirI18n.t("Çırağın parmaklarına sardığı kefen ipliği. Hâlâ ılık."),
      "rag-wraps",
      "blood"
    ],
    [
      "crypt-walker-boots",
      KabirI18n.t("Mühürlü Mahzenin Adımları"),
      "boots",
      3,
      "boss",
      0,
      0.045,
      3,
      null,
      L("Esirleri tutmak için kullanılan eski demir donanım. Artık seni ileri taşıyor.", "Old iron gear used to hold captives. Now it carries you forward."),
      "grave-boots",
      "ash"
    ],
    [
      "tide-widow-helm",
      KabirI18n.t("Dul Gelgitin Yüzü"),
      "head",
      5,
      "boss",
      0,
      0.07,
      3,
      null,
      KabirI18n.t("Yeminlinin karısının tuzla dolmuş miğferi. Kocasını aramaktan hiç vazgeçmedi."),
      "drowned-helm",
      "brine"
    ],
    [
      "hidden-throne-chest",
      KabirI18n.t("Gizli Tahtın Kefeni"),
      "chest",
      7,
      "boss",
      0,
      0.115,
      5,
      null,
      L("Harabelerin gizli odasında saklanan ağır zırh.", "Heavy armor hidden in a secret chamber within the ruins."),
      "grave-chest",
      "bone"
    ],
    [
      "seer-echo-spear",
      KabirI18n.t("Kehanetin Yankısı"),
      "weapon",
      7,
      "boss",
      0.245,
      0,
      2,
      "spear",
      KabirI18n.t("Ulvi’nin öğrencisinin mızrağı. Ucu, saplanacağı yeri önceden bilir."),
      "bone-spear",
      "ash"
    ],
    [
      "vizier-clerk-grasp",
      KabirI18n.t("Hesap Kâtibinin Pençesi"),
      "hands",
      9,
      "boss",
      0,
      0.095,
      4,
      null,
      KabirI18n.t("Vezirin halka sayan kâtibinin demir eldiveni. Parmak boğumlarında sayılar kazılı."),
      "chain-gloves",
      "rust"
    ],
    [
      "ink-headsman-helm",
      KabirI18n.t("Mürekkep Cellatının Yüzü"),
      "head",
      9,
      "boss",
      0,
      0.095,
      5,
      null,
      KabirI18n.t("Siyah mürekkeple kaplı ağır miğfer. Kesilen her ad, içinde bir damla bırakmış."),
      "iron-helm",
      "blood"
    ]
  ];

  // ---------------------------------------------------------------- common UI words
  var W = {
    hunt: L('Ad Avı', 'Named Hunt'), rescue: L('Kurtarma', 'Rescue'), lore: L('Kadı’nın Kayıtları', 'The Judge’s Records'), main: L('Ana Hikâye', 'Main Story'),
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
    "1": [
      {
        "id": "c1-hunt",
        "kind": "hunt",
        "site": "c1.hunt",
        "fallback": {
          "room": 11,
          "dx": 0,
          "dz": 0
        },
        "voice": "hunt1",
        "name": "Kefen Dokuyucu",
        "target": {
          "name": "Kefen Dokuyucu",
          "types": [
            "guard"
          ],
          "scale": 2.4
        },
        "description": L("Kara Kadı’nın seçkin avcısı bu bölgede kaçan esirleri arıyor. Onu durdur.", "The Black Judge’s elite hunter searches this region for escaped captives. Stop them."),
        "objective": L("Kara Kadı’nın avcısını yen.", "Defeat the Black Judge’s hunter."),
        "story": L("Avcı düştü. Üzerindeki emir açıktı: “Barbar canlı alınacak.”", "The hunter falls. The order carried on their body was clear: “Take the barbarian alive.”"),
        "reward": {
          "item": "shroud-needle-grasp",
          "xp": 60
        },
        "rewardText": KabirI18n.t("Kefen Dokuyucunun İğneleri (Eşsiz eldiven)")
      },
      {
        "id": "c1-rescue",
        "kind": "rescue",
        "site": "c1.captive",
        "goal": "c1.rescue-goal",
        "fallback": {
          "room": 10,
          "dx": 3,
          "dz": -2
        },
        "voice": "rescue1",
        "name": L("Son Esir", "The Last Captive"),
        "npc": L("Ömer", "Ömer"),
        "description": L("Zincirli bir esir hâlâ yaşıyor. Onu serbest bırak ve yemin taşına götür.", "A chained captive is still alive. Free them and lead them to the oath stone."),
        "objective": L("Zincirli esiri kurtar.", "Free the chained captive."),
        "follow": L("Ömer adlı esiri yemin taşına götür.", "Lead Ömer to the oath stone."),
        "freeStory": L("Ömer doğruluyor: “Tabutunu taşıdıklarını gördüm. İçinden sen mi çıktın?”", "Ömer rises: “I saw them carrying your coffin. Was it you who broke out?”"),
        "story": L("Ömer güvenli yere ulaşıyor: “Liman yolunu gardiyan kullanır. Silahını hazır tut.”", "Ömer reaches safety: “The warden uses the port passage. Keep your weapon ready.”"),
        "reward": {
          "flasks": 1,
          "xp": 40
        },
        "rewardText": KabirI18n.t("Kalıcı +1 şifa matarası")
      },
      {
        "id": "c1-pages",
        "kind": "lore",
        "voice": "pages1",
        "name": L("Kadı’nın Kayıtları · 1", "The Judge’s Records · 1"),
        "description": L("Kurban düzeninin kayıtları bu bölgeye dağılmış.", "Records of the tribute machinery lie scattered through this region."),
        "objective": L("Üç kayıt parçasını bul.", "Find the three records."),
        "story": L("Kayıtlar Kara Kadı’nın düzenini ortaya koyuyor. Bir sonraki adım artık açık.", "The records reveal the Black Judge’s machinery. Your next step is clear."),
        "reward": {
          "points": 1
        },
        "rewardText": L("+1 yetenek puanı ve Kadı’nın düzenine ait kayıtlar", "+1 skill point and records of the Judge’s machinery"),
        "pages": [
          {
            "site": "c1.page1",
            "name": L("Kayıt: Canlı Gömme Emri", "Record: Order for Live Burial"),
            "text": L("Kara Kadı’nın mührü: Bahtiyar adlı barbar diri teslim alınsın. Güçlü beden mezara kapatılsın. Tabut sabaha kadar açılmasın. Gardiyanın kenar notu: Yaralı ama zinciri iki kez kopardı.", "The Black Judge’s seal: Take the barbarian Bahtiyar alive. Seal his strong body within the grave. Do not open the coffin before dawn. A warden’s note: Wounded, but he broke his chain twice.")
          },
          {
            "site": "c1.page2",
            "name": L("Kayıt: Esir Listesi", "Record: Captive Roster"),
            "text": L("Kurbanlar limandan alınır, zindanda bekletilir. Güçlü olanlar derin mezara; çalışabilecek olanlar ocağa gönderilir. Altında Kara Kadı’nın kara göz mührü var.", "Captives arrive through the port and wait in the dungeon. Send the strong to the deep grave and the able-bodied to the forge. The Black Judge’s black-eye seal lies beneath.")
          },
          {
            "site": "c1.page3",
            "name": L("Kayıt: Gardiyanın Uyarısı", "Record: Warden’s Warning"),
            "text": L("Taş kapaktan vurma sesi gelirse yaklaşmayın. Kadı kurbanın nefesini ister, başını değil. Mezar açılamaz sanmışlar. Kapakta içeriden kırılmış bir parça var.", "If blows sound beneath the stone lid, do not approach. The Judge wants the sacrifice’s breath, not his head. They thought the grave could not open. A piece of the lid has broken from within.")
          }
        ],
        "fallbacks": [
          {
            "room": 9,
            "dx": 4,
            "dz": 3
          },
          {
            "room": 12,
            "dx": -4,
            "dz": 2
          },
          {
            "room": 1,
            "dx": -6,
            "dz": -5
          }
        ]
      }
    ],
    "2": [
      {
        "id": "c2-hunt",
        "kind": "hunt",
        "site": "c2.hunt",
        "fallback": {
          "room": 11,
          "dx": 0,
          "dz": 0
        },
        "voice": "hunt2",
        "name": KabirI18n.t("Tuz İçindeki Yeminli"),
        "target": {
          "name": KabirI18n.t("Tuz İçindeki Yeminli"),
          "types": [
            "urchin",
            "drowned"
          ],
          "scale": 2.4
        },
        "description": L("Kara Kadı’nın seçkin avcısı bu bölgede kaçan esirleri arıyor. Onu durdur.", "The Black Judge’s elite hunter searches this region for escaped captives. Stop them."),
        "objective": L("Kara Kadı’nın avcısını yen.", "Defeat the Black Judge’s hunter."),
        "story": L("Avcı düştü. Üzerindeki emir açıktı: “Barbar canlı alınacak.”", "The hunter falls. The order carried on their body was clear: “Take the barbarian alive.”"),
        "reward": {
          "item": "salt-oath-steps",
          "xp": 90
        },
        "rewardText": KabirI18n.t("Tuz Yeminlisinin Adımları (Eşsiz çizme)")
      },
      {
        "id": "c2-rescue",
        "kind": "rescue",
        "site": "c2.captive",
        "goal": "c2.rescue-goal",
        "fallback": {
          "room": 9,
          "dx": -3,
          "dz": 3
        },
        "voice": "rescue2",
        "name": L("Ambarın Sağ Kalanı", "Survivor of the Hold"),
        "npc": L("Kerem", "Kerem"),
        "description": L("Zincirli bir esir hâlâ yaşıyor. Onu serbest bırak ve yemin taşına götür.", "A chained captive is still alive. Free them and lead them to the oath stone."),
        "objective": L("Zincirli esiri kurtar.", "Free the chained captive."),
        "follow": L("Kerem adlı esiri yemin taşına götür.", "Lead Kerem to the oath stone."),
        "freeStory": L("Kerem doğruluyor: “Bizi harabelere götüreceklerdi. Gemiden atlayanları çan geri çağırıyor.”", "Kerem rises: “They were taking us to the ruins. The bell calls back anyone who jumps overboard.”"),
        "story": L("Kerem güvenli yere ulaşıyor: “Harabelerin altında başka esirler var. Onları unutma.”", "Kerem reaches safety: “There are more captives under the ruins. Do not forget them.”"),
        "reward": {
          "hp": 6,
          "xp": 70
        },
        "rewardText": KabirI18n.t("Kalıcı +6 can")
      },
      {
        "id": "c2-pages",
        "kind": "lore",
        "voice": "pages2",
        "name": L("Kadı’nın Kayıtları · 2", "The Judge’s Records · 2"),
        "description": L("Kurban düzeninin kayıtları bu bölgeye dağılmış.", "Records of the tribute machinery lie scattered through this region."),
        "objective": L("Üç kayıt parçasını bul.", "Find the three records."),
        "story": L("Kayıtlar Kara Kadı’nın düzenini ortaya koyuyor. Bir sonraki adım artık açık.", "The records reveal the Black Judge’s machinery. Your next step is clear."),
        "reward": {
          "points": 1
        },
        "rewardText": L("+1 yetenek puanı ve Kadı’nın düzenine ait kayıtlar", "+1 skill point and records of the Judge’s machinery"),
        "pages": [
          {
            "site": "c2.page1",
            "name": L("Kayıt: Kara Sevkiyat", "Record: Black Shipment"),
            "text": L("İki gemi esir getirir. Biri ocağa, biri harabelere ayrılır. Kıyıda kalanlar köklerin altında tutulur. Hiçbir yolcu serbest bırakılmayacaktır. Emir Kara Kadı’dan.", "Two ships carry captives. One shipment is for the forge, the other for the ruins. Keep those left ashore beneath the roots. Release no passenger. By order of the Black Judge.")
          },
          {
            "site": "c2.page2",
            "name": L("Kayıt: Çancının Emri", "Record: The Bellringer’s Orders"),
            "text": L("Kaçanları yakalayın. Dalgaya kapılanları çanla geri çağırın. Mezardan çıkan barbar canlı alınacak. Kadı, gardiyanın başarısızlığını limanda tekrar görmek istemiyor.", "Catch the fugitives. Call back those taken by the waves with the bell. Take the barbarian who escaped the grave alive. The Judge will not tolerate the warden’s failure repeated at the port.")
          },
          {
            "site": "c2.page3",
            "name": L("Kayıt: Harabelerin Yolu", "Record: Road to the Ruins"),
            "text": L("Fenerin ardındaki patika eski mezarlara çıkar. Taş köprünün altında mağara ağzı var. Gemilerin kaptanları bu yolu bilir; esirlerin gözleri orada bağlanır.", "The path behind the lantern reaches the old tombs. A cavern opens beneath the stone bridge. The captains know the road; there the captives are blindfolded.")
          }
        ],
        "fallbacks": [
          {
            "room": 10,
            "dx": 5,
            "dz": 3
          },
          {
            "room": 3,
            "dx": -6,
            "dz": 5
          },
          {
            "room": 12,
            "dx": 5,
            "dz": -4
          }
        ]
      }
    ],
    "3": [
      {
        "id": "c3-hunt",
        "kind": "hunt",
        "site": "c3.hunt",
        "fallback": {
          "room": 8,
          "dx": 0,
          "dz": 0
        },
        "voice": "hunt3",
        "name": KabirI18n.t("Taht Kehanetçisi Ulvi"),
        "target": {
          "name": KabirI18n.t("Taht Kehanetçisi Ulvi"),
          "types": [
            "shardseer"
          ],
          "scale": 2.6
        },
        "description": L("Kara Kadı’nın seçkin avcısı bu bölgede kaçan esirleri arıyor. Onu durdur.", "The Black Judge’s elite hunter searches this region for escaped captives. Stop them."),
        "objective": L("Kara Kadı’nın avcısını yen.", "Defeat the Black Judge’s hunter."),
        "story": L("Avcı düştü. Üzerindeki emir açıktı: “Barbar canlı alınacak.”", "The hunter falls. The order carried on their body was clear: “Take the barbarian alive.”"),
        "reward": {
          "item": "blind-seer-gaze",
          "xp": 140
        },
        "rewardText": KabirI18n.t("Kör Kehanetin Gözü (Eşsiz miğfer)")
      },
      {
        "id": "c3-rescue",
        "kind": "rescue",
        "site": "c3.captive",
        "goal": "c3.rescue-goal",
        "fallback": {
          "room": 4,
          "dx": 4,
          "dz": 3
        },
        "voice": "rescue3",
        "name": L("Taşın İçindeki Adam", "The Man Within Stone"),
        "npc": L("Hıdır", "Hıdır"),
        "description": L("Zincirli bir esir hâlâ yaşıyor. Onu serbest bırak ve yemin taşına götür.", "A chained captive is still alive. Free them and lead them to the oath stone."),
        "objective": L("Zincirli esiri kurtar.", "Free the chained captive."),
        "follow": L("Hıdır adlı esiri yemin taşına götür.", "Lead Hıdır to the oath stone."),
        "freeStory": L("Hıdır doğruluyor: “Kadı kurtuluş dedi. Duvarın içinde yıllar geçirdim.”", "Hıdır rises: “The Judge called it salvation. I spent years inside that wall.”"),
        "story": L("Hıdır güvenli yere ulaşıyor: “Sıcak yolu izle. Ocağa çıkar. Kadı’nın gardiyanları orada silahlanır.”", "Hıdır reaches safety: “Follow the warm passage to the forge. The Judge’s wardens arm themselves there.”"),
        "reward": {
          "flasks": 1,
          "xp": 120
        },
        "rewardText": KabirI18n.t("Kalıcı +1 şifa matarası")
      },
      {
        "id": "c3-pages",
        "kind": "lore",
        "voice": "pages3",
        "name": L("Kadı’nın Kayıtları · 3", "The Judge’s Records · 3"),
        "description": L("Kurban düzeninin kayıtları bu bölgeye dağılmış.", "Records of the tribute machinery lie scattered through this region."),
        "objective": L("Üç kayıt parçasını bul.", "Find the three records."),
        "story": L("Kayıtlar Kara Kadı’nın düzenini ortaya koyuyor. Bir sonraki adım artık açık.", "The records reveal the Black Judge’s machinery. Your next step is clear."),
        "reward": {
          "points": 1
        },
        "rewardText": L("+1 yetenek puanı ve Kadı’nın düzenine ait kayıtlar", "+1 skill point and records of the Judge’s machinery"),
        "pages": [
          {
            "site": "c3.page1",
            "name": L("Kayıt: Taşın Altındakiler", "Record: Those Beneath the Stone"),
            "text": L("Kadı kurtuluş vaat etti. İnsanlar kendi ayaklarıyla geldi. Taş kapanınca onları kimse çıkarmadı. Duvarlara kulak ver: İçeridekiler hâlâ nefes alıyor.", "The Judge promised salvation. People came willingly. When the stone closed, no one let them out. Listen at the walls: They still breathe within.")
          },
          {
            "site": "c3.page2",
            "name": L("Kayıt: Bekçinin Buyruğu", "Record: The Warden’s Command"),
            "text": L("Kurban Bekçisi geçidi tutacak. Kadı’nın ömrünü uzatan bağlar koparılmayacak. Barbar harabelere girerse ocağa inmeden durdurulsun.", "The Sacrifice Warden will hold the passage. Preserve the bonds that prolong the Judge’s life. If the barbarian enters the ruins, stop him before he reaches the forge.")
          },
          {
            "site": "c3.page3",
            "name": L("Kayıt: Sıcak Geçit", "Record: The Warm Passage"),
            "text": L("Mağaranın kuzey duvarından sıcak hava gelir. İki kilit açılınca taş merdiven görünür. Aşağıdaki demir sesleri yıllardır susmadı.", "Warm air comes through the cavern’s north wall. Open both locks to reveal the stone stairs. The sound of iron below has not stopped for years.")
          }
        ],
        "fallbacks": [
          {
            "room": 1,
            "dx": -7,
            "dz": 4
          },
          {
            "room": 6,
            "dx": 7,
            "dz": -3
          },
          {
            "room": 10,
            "dx": 6,
            "dz": 4
          }
        ]
      }
    ],
    "4": [
      {
        "id": "c4-hunt",
        "kind": "hunt",
        "site": "c4.hunt",
        "fallback": {
          "room": 4,
          "dx": 0,
          "dz": 0
        },
        "voice": "hunt4",
        "name": KabirI18n.t("Kül Veziri"),
        "target": {
          "name": KabirI18n.t("Kül Veziri"),
          "types": [
            "chainseer",
            "emberbound"
          ],
          "scale": 2.6
        },
        "description": L("Kara Kadı’nın seçkin avcısı bu bölgede kaçan esirleri arıyor. Onu durdur.", "The Black Judge’s elite hunter searches this region for escaped captives. Stop them."),
        "objective": L("Kara Kadı’nın avcısını yen.", "Defeat the Black Judge’s hunter."),
        "story": L("Avcı düştü. Üzerindeki emir açıktı: “Barbar canlı alınacak.”", "The hunter falls. The order carried on their body was clear: “Take the barbarian alive.”"),
        "reward": {
          "item": "ash-vizier-robe",
          "xp": 180
        },
        "rewardText": KabirI18n.t("Kül Vezirinin Cübbesi (Eşsiz zırh)")
      },
      {
        "id": "c4-rescue",
        "kind": "rescue",
        "site": "c4.captive",
        "goal": "c4.rescue-goal",
        "fallback": {
          "room": 3,
          "dx": -4,
          "dz": 3
        },
        "voice": "rescue4",
        "name": L("Zincir Döven Esir", "The Captive Chainmaker"),
        "npc": L("Yusuf", "Yusuf"),
        "description": L("Zincirli bir esir hâlâ yaşıyor. Onu serbest bırak ve yemin taşına götür.", "A chained captive is still alive. Free them and lead them to the oath stone."),
        "objective": L("Zincirli esiri kurtar.", "Free the chained captive."),
        "follow": L("Yusuf adlı esiri yemin taşına götür.", "Lead Yusuf to the oath stone."),
        "freeStory": L("Yusuf doğruluyor: “Bu halkaları bize dövdürdüler. Ellerimiz örse bağlıydı.”", "Yusuf rises: “They made us forge these links. Our hands were chained to the anvils.”"),
        "story": L("Yusuf güvenli yere ulaşıyor: “Mahkemeye giden kapıyı ocak besler. Ana vanayı kapat.”", "Yusuf reaches safety: “The forge feeds the court gate. Close the main valve.”"),
        "reward": {
          "damage": 0.03,
          "xp": 160
        },
        "rewardText": KabirI18n.t("Kalıcı +%3 hasar")
      },
      {
        "id": "c4-pages",
        "kind": "lore",
        "voice": "pages4",
        "name": L("Kadı’nın Kayıtları · 4", "The Judge’s Records · 4"),
        "description": L("Kurban düzeninin kayıtları bu bölgeye dağılmış.", "Records of the tribute machinery lie scattered through this region."),
        "objective": L("Üç kayıt parçasını bul.", "Find the three records."),
        "story": L("Kayıtlar Kara Kadı’nın düzenini ortaya koyuyor. Bir sonraki adım artık açık.", "The records reveal the Black Judge’s machinery. Your next step is clear."),
        "reward": {
          "points": 1
        },
        "rewardText": L("+1 yetenek puanı ve Kadı’nın düzenine ait kayıtlar", "+1 skill point and records of the Judge’s machinery"),
        "pages": [
          {
            "site": "c4.page1",
            "name": L("Kayıt: Zincir Hesabı", "Record: Chain Tally"),
            "text": L("Bir halka, bir bilek. Bir zincir, bir esir. Ocak durmayacak. Yorgun işçiler yeni sevkiyatla değiştirilecek. Kara Kadı’nın muhafızlarına önce silah verilsin.", "One link, one wrist. One chain, one captive. The forge must not stop. Replace exhausted workers with the next shipment. Arm the Black Judge’s guards first.")
          },
          {
            "site": "c4.page2",
            "name": L("Kayıt: Kapının Basıncı", "Record: Gate Pressure"),
            "text": L("Son Mahkeme’nin sürgüsü ana döküm hattına bağlı. Besleme kesilirse kapı geri çekilir. Ocağın ustası vanaları koruyacak.", "The Last Court’s bolt runs from the main casting line. Cut the feed and the gate withdraws. The master of the forge must protect the valves.")
          },
          {
            "site": "c4.page3",
            "name": L("Kayıt: Son Sevkiyat", "Record: The Last Shipment"),
            "text": L("Liman susmuş. Harabelerin bağları kırılmış. Barbar ocağa ulaştı. Esirleri mahkemeye alın. Kadı son ayini kendi kürsüsünde yapacak.", "The port has fallen silent. The ruins’ bonds are broken. The barbarian has reached the forge. Move the captives to the court. The Judge will conduct the last rite upon his own dais.")
          }
        ],
        "fallbacks": [
          {
            "room": 1,
            "dx": 7,
            "dz": 4
          },
          {
            "room": 6,
            "dx": -7,
            "dz": -3
          },
          {
            "room": 8,
            "dx": 6,
            "dz": 4
          }
        ]
      }
    ],
    "5": [
      {
        "id": "c5-rescue",
        "kind": "rescue",
        "site": "selvi-cell",
        "goal": "selvi-goal",
        "requiresMain": 1,
        "fallback": {
          "index": 0.7
        },
        "voice": null,
        "name": L("Son Tutsak", "The Last Prisoner"),
        "npc": L("Narin", "Narin"),
        "description": L("Zincirli bir esir hâlâ yaşıyor. Onu serbest bırak ve yemin taşına götür.", "A chained captive is still alive. Free them and lead them to the oath stone."),
        "objective": L("Zincirli esiri kurtar.", "Free the chained captive."),
        "follow": L("Narin adlı esiri yemin taşına götür.", "Lead Narin to the oath stone."),
        "freeStory": L("Narin doğruluyor: “Kadı seni yeniden getireceklerini söyledi. Bu kez yürüyerek geldin.”", "Narin rises: “The Judge said they would bring you back. This time you came on your feet.”"),
        "story": L("Narin güvenli yere ulaşıyor: “Hepimiz dışarı çıkacağız. Sen de gel, barbar.”", "Narin reaches safety: “We are all getting out. You too, barbarian.”"),
        "reward": {
          "flasks": 1,
          "xp": 200
        },
        "rewardText": KabirI18n.t("Kalıcı +1 şifa matarası"),
        "female": true
      },
      {
        "id": "c5-hunt",
        "kind": "hunt",
        "site": "c5.hunt",
        "fallback": {
          "index": 0.45
        },
        "voice": "hunt5",
        "name": KabirI18n.t("Mürekkep Cellatı"),
        "target": {
          "name": KabirI18n.t("Mürekkep Cellatı"),
          "types": [

          ],
          "scale": 2.6
        },
        "description": L("Kara Kadı’nın seçkin avcısı bu bölgede kaçan esirleri arıyor. Onu durdur.", "The Black Judge’s elite hunter searches this region for escaped captives. Stop them."),
        "objective": L("Kara Kadı’nın avcısını yen.", "Defeat the Black Judge’s hunter."),
        "story": L("Avcı düştü. Üzerindeki emir açıktı: “Barbar canlı alınacak.”", "The hunter falls. The order carried on their body was clear: “Take the barbarian alive.”"),
        "reward": {
          "item": "ink-headsman-helm",
          "xp": 240
        },
        "rewardText": KabirI18n.t("Mürekkep Cellatının Yüzü (Eşsiz miğfer)")
      },
      {
        "id": "c5-pages",
        "kind": "lore",
        "voice": "pages5",
        "name": L("Kadı’nın Kayıtları · 5", "The Judge’s Records · 5"),
        "description": L("Kurban düzeninin kayıtları bu bölgeye dağılmış.", "Records of the tribute machinery lie scattered through this region."),
        "objective": L("Üç kayıt parçasını bul.", "Find the three records."),
        "story": L("Kayıtlar Kara Kadı’nın düzenini ortaya koyuyor. Bir sonraki adım artık açık.", "The records reveal the Black Judge’s machinery. Your next step is clear."),
        "reward": {
          "points": 1
        },
        "rewardText": L("+1 yetenek puanı ve Kadı’nın düzenine ait kayıtlar", "+1 skill point and records of the Judge’s machinery"),
        "pages": [
          {
            "site": "c5.page1",
            "name": L("Kayıt: Kadı’nın Buyruğu", "Record: The Judge’s Command"),
            "text": L("Barbarın dönüş yolu açık bırakılsın. İradesi kırılmadıysa bedeni yine bağlanabilir. Onu kürsüye getirin. Diz çöktüğünü görmek istiyorum. — Kara Kadı.", "Leave the barbarian’s return road open. If his will cannot be broken, his body can still be bound. Bring him before the dais. I wish to see him kneel. — The Black Judge.")
          },
          {
            "site": "c5.page2",
            "name": L("Kayıt: Son Esirlerin Sesi", "Record: Voices of the Last Captives"),
            "text": L("Dışarıdan demir sesi geldi. Gardiyanlar koştu. Biri mezardan çıkan adamın yaklaştığını söyledi. Kapının altında ışık var. Bu gece birimiz bile çıkarsa diğerlerini bırakmasın.", "Iron sounded outside. The wardens ran. Someone said the man who escaped the grave was coming. Light shows beneath the door. If even one of us gets out tonight, let them not leave the others.")
          },
          {
            "site": "c5.page3",
            "name": L("Kayıt: Kurban Bağları", "Record: Tribute Bonds"),
            "text": L("Kadı’nın ömrü mezarın, limanın ve ocağın zincirlerinden beslenir. Üç bağ da kırılırsa kürsünün koruması düşer. Son tutsaklar çıkarılmadan ayin durmaz.", "The Judge’s life feeds on the chains of grave, port and forge. Break all three bonds to strip the dais of its protection. The rite cannot end until the last prisoners are free.")
          }
        ],
        "fallbacks": [
          {
            "index": 0.25
          },
          {
            "index": 0.55
          },
          {
            "index": 0.8
          }
        ]
      }
    ]
  };
  var FINALE = {
    "title": L("Mezara Sığmayan", "The Unburied"),
    "question": L("Kara Kadı düştü. Son zincirler kırıldı. Gün ışığına çıkan yol açık.", "The Black Judge has fallen. The last chains are broken. The road to daylight is open."),
    "truth": L("Kurtulanlar dışarı çıkıyor. Sen de mezarı ardında bırak.", "The survivors are leaving. Leave the grave behind you, too."),
    "options": [
      {
        "id": "escape",
        "name": L("Mezardan çık", "Leave the grave"),
        "effect": L("Bahtiyar ve bütün esirler özgürce gün ışığına çıkar.", "Bahtiyar and all captives walk freely into daylight."),
        "voice": "endingName",
        "story": L("Kara Kadı’nın kürsüsü parçalanıyor. Zincirler yere düşüyor. Bahtiyar silahını omzuna alıp kurtulanların ardından yürür. Dışarıda sabah rüzgârı var. Bu mezara bir kurban indirdiler; içinden bir barbar çıktı.", "The Black Judge’s dais breaks apart. The chains fall. Bahtiyar shoulders his weapon and follows the survivors. The morning wind waits outside. They lowered a sacrifice into this grave. A barbarian walked out.")
      }
    ]
  };

  var STORY_BEATS = { 1: { start: 'story1', boss: 'truth1' }, 2: { start: 'story2', boss: 'truth2' }, 3: { start: 'story3', boss: 'truth3' }, 4: { start: 'story4', boss: 'truth4' }, 5: { start: 'story5', boss: null } };
  function resolveEnding(claimed, savedId) {
    // Already-completed old campaigns retain completion, never their abandoned moral ending.
    var endings = ['escape', 'name', 'burn', 'quill'];
    return endings.indexOf(savedId) >= 0 || (Array.isArray(claimed) && claimed.some(function (key) { return typeof key === 'string' && key.indexOf('c5:finale:') === 0 && endings.indexOf(key.slice(10)) >= 0; })) ? 'escape' : null;
  }
  function endingReflection(id) {
    return id === 'escape' ? { text: L('Mezar arkanda sessizleşiyor. Önünde yeni bir yol var.', 'The grave falls silent behind you. A new road lies ahead.'), mercy: 0, wrath: 0 } : null;
  }
  var LEAN = { rescueMercy: L('Zincirini kırdığını görünce elini tutuyor.', 'They take your hand when they see their chain break.'), rescueWrath: L('Silahına bakıp doğruluyor. Kaçış yolu açıldı.', 'They glance at your weapon and rise. The way out is open.') };

  // ---------------------------------------------------------------- engine
  function create(o) {
    var api = o.api, world = o.world, chapter = o.chapter, info = o.info, kit = o.kit, player = api.player;
    var defs = SIDE[chapter] || [], quests = [], nodes = [], disposed = false;
    var state = Object.create(null), local = { flaskDebt: 0, finale: null, beats: 0 };
    var timer = 0, beatClock = 0, bossSeen = false, followerActor = null, finaleOpen = false, finaleTimer = null;
    Object.defineProperty(info, 'openingSeen', { configurable: true, get: function () { return !!(local.beats & 4); } });
    Object.defineProperty(info, 'discoverySeen', { configurable: true, get: function () { return !!(local.beats & 1); } });
    info.markOpeningSeen = function () {
      if (local.beats & 4) return false;
      local.beats |= 4;
      if (api.onChange) api.onChange();
      return true;
    };
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
        notify(q, d.freeStory, false); api.sound('sealOpen', { x: n.x, z: n.z }); return true;
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
      info.pendingChoice = { questId: 'finale', nodeId: 'finale', title: FINALE.title, question: FINALE.question, options: FINALE.options, side: true, finale: true };
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
      if (cinema()) setTimeout(function () { cinema().epilogue({ id: optionId, title: opt.name, paragraphs: paras, tally: '' }); }, 1200);
      return true;
    }

    // ---- per-frame
    // A freed survivor walks around the physical captive station. This changes only
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
      var discovered = false, storyMarkers = info.markers || [];
      for (var sm = 0; sm < storyMarkers.length; sm++) if (storyMarkers[sm].complete) { discovered = true; break; }
      if (beats && discovered && !(local.beats & 1) && liveStory && !storyBusy) {
        local.beats |= 1; say(beats.start);
        if (api.onChange) api.onChange();
      }
      var g = B.app && B.app.game, boss = g && (g.boss || (g.enemies || []).find(function (e) { return e.boss; }));
      if (boss && boss.dead && !bossSeen) {
        bossSeen = true;
        if (beats && beats.boss && !(local.beats & 2)) { local.beats |= 2; say(beats.boss); }
        if (chapter === 5) finaleTimer = setTimeout(function () { if (!disposed) openFinale(); }, 4800);   // ajan:chapter5: the Qadi's fall (slow motion, light burst) plays before the last decision
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
    function dispose() { disposed = true; if (finaleTimer) clearTimeout(finaleTimer); if (pageSurface) pageSurface.dispose(); if (pageTexture) pageTexture.dispose(); if (beaconTex) beaconTex.dispose(); beacons.forEach(function (b) { b.mat.dispose(); b.mesh.geometry.dispose(); }); quests.forEach(function (q) { if (q.actor && q.actor.root) q.actor.root.removeFromParent(); }); }
    quests.forEach(function (q) { if (q.actor) animateActor(q.actor, 0); });
    refresh();
    // QA hook: BABA.QuestSide.debug() lists live quest actors and states (no gameplay effect).
    B.QuestSide.debug = function () { return quests.map(function (q) { var s = state[q.def.id]; return { id: q.def.id, stage: s.stage, done: s.done, actor: q.actor ? { x: +q.actor.x.toFixed(2), z: +q.actor.z.toFixed(2), visible: q.actor.root.visible, model: !!q.actor.model } : null, goal: q.goal || null }; }); };
    return { scan: scan, interact: interact, choose: choose, update: update, snapshot: snapshot, restore: restore, dispose: dispose, openFinale: openFinale,
      get count() { return quests.length; } };
  }

  B.QuestSide = { VERSION: 1, chapters: SIDE, finale: FINALE, resolveEnding: resolveEnding, endingReflection: endingReflection, create: create, L: L };
})();
