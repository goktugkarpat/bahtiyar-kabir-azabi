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
  // Save IDs retain their legacy names; visible story follows Mezara Sığmayan.
  // Save IDs retain their legacy names; visible story follows Mezara Sığmayan.
  // Save IDs retain their legacy names; visible story follows Mezara Sığmayan.
  // Save IDs retain their legacy names; visible story follows Mezara Sığmayan.
  var CHAPTERS = {
    "1": {
      "title": L5("Mezara Sığmayan", "The Unburied"),
      "introduction": L5("Seni yaralı ele geçirdiler. Kara Kadı’nın emriyle canlı gömdüler. Taş kapak kırıldı; şimdi çıkış yolunu bul.", "They captured you wounded and buried you alive on the Black Judge’s orders. The stone lid has broken. Find your way out."),
      "quests": [
        {
          "id": "lost-names",
          "name": L5("Mezarın Kilidi", "The Grave Lock"),
          "description": L5("Gardiyanların sakladığı kilit levhasını bul ve hücre düzeneğini aç.", "Find the lock plate hidden by the wardens and release the cells."),
          "steps": [
            {
              "id": "names",
              "room": 7,
              "dx": -2.6,
              "dz": 2.6,
              "shape": "tablet",
              "name": L5("Gardiyanın Kilit Levhası", "Warden’s Lock Plate"),
              "verb": L5("Kilit levhasını al", "Take the lock plate"),
              "objective": L5("Unutulanların Mahzeni’nde kilit levhasını bul.", "Find the lock plate in the Forgotten Vault."),
              "story": L5("Levhada Kara Kadı’nın mührü var: “Barbar canlı gömülsün.” Hücre kilidine uyuyor.", "The plate bears the Black Judge’s seal: “Bury the barbarian alive.” It fits the cell mechanism.")
            },
            {
              "id": "memorial",
              "room": 2,
              "dx": 4.2,
              "dz": 3,
              "shape": "memorial",
              "name": L5("Hücre Kilidi", "Cell Lock"),
              "verb": L5("Kilit levhasını yerleştir", "Fit the lock plate"),
              "objective": L5("Çürüyen Revir’de hücre düzeneğini aç.", "Open the cell mechanism in the Rotting Infirmary."),
              "story": L5("Demir sürgüler geri çekiliyor. Hücrelerdeki insanlar hâlâ yaşıyor.", "The iron bolts withdraw. People inside the cells are still alive.")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "rest",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "damageReduction",
                "amount": 0.06,
                "effect": KabirI18n.t("Bu bölümde alınan tüm hasar %6 azalır.")
              },
              {
                "id": "expose",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "bossDamage",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümün efendisine verilen hasar %10 artar.")
              }
            ]
          },
          "voice": "questNames",
          "completeStory": L5("Bağ çözüldü. Esirlerin kaçış yolu artık güvenli.", "The bond is broken. The captives now have a safe escape route.")
        },
        {
          "id": "blood-verdict",
          "name": L5("Duvarın Ardındakiler", "Those Behind the Walls"),
          "description": L5("Esirlerin tutulduğu ayinin iki bağını kır.", "Break the two ritual bonds holding the captives."),
          "steps": [
            {
              "id": "ash",
              "room": 3,
              "dx": -5.4,
              "dz": 3.4,
              "shape": "censer",
              "name": L5("Kurban Mangalı", "Sacrificial Brazier"),
              "verb": L5("Mangalı söndür", "Extinguish the brazier"),
              "objective": L5("Adak Salonu’nda kurban mangalını söndür.", "Extinguish the sacrificial brazier in the Hall of Offerings."),
              "story": L5("Duman kesiliyor. Duvarın arkasından bir adam sesleniyor: “Bizi limana götürecekler.”", "The smoke clears. A man calls from behind the wall: “They are taking us to the port.”")
            },
            {
              "id": "oath",
              "room": 3,
              "dx": 5.4,
              "dz": 3.4,
              "shape": "seal",
              "name": L5("Esirlerin Bağı", "Captives’ Bond"),
              "verb": L5("Esirlerin mührünü kır", "Break the captives’ seal"),
              "objective": L5("Adak Salonu’nda esirlerin bağını kır.", "Break the captives’ bond in the Hall of Offerings."),
              "story": L5("Zincirler düşüyor. Kıyıya çıkan yolu mezarın gardiyanı tutuyor.", "The chains fall. The grave warden guards the passage to the shore.")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "break",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "staminaRecovery",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.")
              },
              {
                "id": "bear",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "healingBonus",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde iksir ve can çalmayla iyileşme %10 artar.")
              }
            ]
          },
          "voice": "questVerdict",
          "completeStory": L5("Bağ çözüldü. Kadı’ya giden yol açılıyor.", "The bond is broken. The road to the Judge opens.")
        }
      ]
    },
    "2": {
      "title": L5("Esir Limanı", "Port of Captives"),
      "introduction": L5("Kara Kadı’nın kurbanları bu limandan taşınıyor. Esirleri çıkar, sevkiyatı durdur ve harabelere giden yolu bul.", "The Black Judge’s sacrifices pass through this port. Free the captives, stop the shipment and find the road to the ruins."),
      "quests": [
        {
          "id": "last-voice",
          "name": L5("Kurban Gemisi", "The Sacrifice Ship"),
          "description": L5("Sevkiyat çanının dilini bul; geminin esir kilitlerini aç.", "Find the shipment bell’s clapper and unlock the captive hold."),
          "steps": [
            {
              "id": "clapper",
              "room": 7,
              "dx": -2.8,
              "dz": 3,
              "shape": "relic",
              "name": L5("Sevkiyat Çanının Dili", "Shipment Bell Clapper"),
              "verb": L5("Çan dilini al", "Take the clapper"),
              "objective": L5("Batık Gümrük Avlusu’nda sevkiyat çanının dilini bul.", "Find the shipment bell’s clapper in the Sunken Customs Yard."),
              "story": L5("Bu çan geminin kilitlerini açıyor. Esirler hâlâ ambarın içinde.", "This bell releases the ship’s locks. The captives are still in the hold.")
            },
            {
              "id": "mourning-bell",
              "room": 5,
              "dx": -4.5,
              "dz": 4,
              "shape": "bell",
              "name": L5("Ambar Kilidi Çanı", "Hold Release Bell"),
              "verb": L5("Çanı çal, ambarı aç", "Ring the bell and open the hold"),
              "objective": L5("Son Fener’de ambar kilidi çanını çal.", "Ring the hold release bell at the Last Lantern."),
              "story": L5("Geminin ambarı açılıyor. Esirler fenerin ışığına doğru koşuyor.", "The ship’s hold opens. The captives run toward the lantern light.")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "silence",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "damageReduction",
                "amount": 0.06,
                "effect": KabirI18n.t("Bu bölümde alınan tüm hasar %6 azalır.")
              },
              {
                "id": "accuse",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "bossDamage",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümün efendisine verilen hasar %10 artar.")
              }
            ]
          },
          "voice": "questBell",
          "completeStory": L5("Bağ çözüldü. Esirlerin kaçış yolu artık güvenli.", "The bond is broken. The captives now have a safe escape route.")
        },
        {
          "id": "root-memory",
          "name": L5("Kara Sevkiyat", "Black Shipment"),
          "completeStory": L5("Bağ çözüldü. Kadı’ya giden yol açılıyor.", "The bond is broken. The road to the Judge opens."),
          "description": L5("Mezarlıkta gizlenen iki sevkiyat bağını kır.", "Break the two shipment bonds hidden in the cemetery."),
          "anyOrder": true,
          "steps": [
            {
              "id": "grave-west",
              "room": 8,
              "dx": -3.7,
              "dz": 2.8,
              "shape": "urn",
              "name": L5("Batı Sevkiyat Mührü", "West Shipment Seal"),
              "verb": L5("Batı mührünü kır", "Break the west seal"),
              "objective": L5("Kara Ağacın Mezarlığı’nda batı sevkiyat bağını kır.", "Break the west shipment bond in the Black Tree Cemetery."),
              "story": L5("Kilit kabının içindeki kayıt, esirlerin harabelere gönderildiğini gösteriyor. Emir Kara Kadı’dan.", "The record inside the lock vessel sends the captives to the ruins. The order comes from the Black Judge."),
              "guard": 9
            },
            {
              "id": "grave-east",
              "room": 8,
              "dx": 3.7,
              "dz": -2.8,
              "shape": "urn",
              "name": L5("Doğu Sevkiyat Mührü", "East Shipment Seal"),
              "verb": L5("Doğu mührünü kır", "Break the east seal"),
              "objective": L5("Kara Ağacın Mezarlığı’nda doğu sevkiyat bağını kır.", "Break the east shipment bond in the Black Tree Cemetery."),
              "story": L5("Nakil zinciri gevşiyor. Limanın efendisi kaçış yolunu tutuyor.", "The transport chain slackens. The master of the port bars the escape route."),
              "guard": 9
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "release",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "staminaRecovery",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.")
              },
              {
                "id": "carry",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "healingBonus",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde iksir ve can çalmayla iyileşme %10 artar.")
              }
            ]
          },
          "voice": "questMemory"
        }
      ]
    },
    "3": {
      "title": L5("Toprağın Tutsakları", "Prisoners of the Earth"),
      "introduction": L5("Kadı’nın eski kurbanları taşın içinde tutuluyor. Bağlarını kır; ocağa inen geçidi aç.", "The Judge’s old victims are held within the stone. Break their bonds and open the passage to the forge."),
      "quests": [
        {
          "id": "kings-name",
          "name": L5("Toprağa Bağlananlar", "Bound Beneath the Earth"),
          "description": L5("Kurbanların bağ levhasını bul ve taş kilidine yerleştir.", "Find the victims’ bond plate and fit it into the stone lock."),
          "steps": [
            {
              "id": "epitaph",
              "room": 3,
              "dx": 3.8,
              "dz": 3.4,
              "shape": "tablet",
              "name": L5("Kurbanların Bağ Levhası", "Victims’ Bond Plate"),
              "verb": L5("Bağ levhasını al", "Take the bond plate"),
              "objective": L5("Kralların Mezarları’nda kurbanların bağ levhasını bul.", "Find the victims’ bond plate among the Kings’ Tombs."),
              "story": L5("Kadı’nın eski kurbanları taşın altında nefes alıyor. Levha onların kilidini açabilir.", "The Judge’s old victims breathe beneath the stone. This plate can open their lock.")
            },
            {
              "id": "name-monument",
              "room": 5,
              "dx": -3.5,
              "dz": -1.8,
              "shape": "memorial",
              "name": L5("Taş Hücre Kilidi", "Stone Cell Lock"),
              "verb": L5("Levhayla bağı aç", "Release the bond with the plate"),
              "objective": L5("Çöken Anıt’ta taş hücre kilidini aç.", "Open the stone cell lock at the Collapsed Monument."),
              "story": L5("Taş yarılıyor. İçeride tutulan insanların sesleri artık emirleri tekrar etmiyor.", "The stone splits. The voices held within no longer repeat commands.")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "name",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "bossDamage",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümün efendisine verilen hasar %10 artar.")
              },
              {
                "id": "erase",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "damageReduction",
                "amount": 0.06,
                "effect": KabirI18n.t("Bu bölümde alınan tüm hasar %6 azalır.")
              }
            ]
          },
          "voice": "questKing",
          "completeStory": L5("Bağ çözüldü. Esirlerin kaçış yolu artık güvenli.", "The bond is broken. The captives now have a safe escape route.")
        },
        {
          "id": "cave-breath",
          "name": L5("Ocağın Yolu", "Road to the Forge"),
          "description": L5("Mağaradaki iki geçit bağını çöz.", "Release the cavern’s two passage bonds."),
          "steps": [
            {
              "id": "echo",
              "room": 7,
              "dx": 3.6,
              "dz": 2.7,
              "shape": "crystal",
              "name": L5("Mağara Zinciri", "Cavern Chain"),
              "verb": L5("Mağara zincirini çöz", "Release the cavern chain"),
              "objective": L5("Kör Kristaller’de geçidin zincirini çöz.", "Release the passage chain at the Blind Crystals."),
              "story": L5("Demir halka açılıyor. Taşın ardından sıcak hava yükseliyor.", "The iron ring opens. Hot air rises from behind the stone."),
              "guard": 9
            },
            {
              "id": "silence",
              "room": 9,
              "dx": -3.4,
              "dz": 2.2,
              "shape": "seal",
              "name": L5("Son Geçit Mührü", "Last Passage Seal"),
              "verb": L5("Geçit mührünü kır", "Break the passage seal"),
              "objective": L5("Taşın İçindeki Ölüler’de son geçit mührünü kır.", "Break the last passage seal among the Dead Within Stone."),
              "story": L5("Ocağa inen merdiven açıldı. Kurban Bekçisi yolun üzerinde.", "The stairs to the forge open. The Sacrifice Warden stands in the way.")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "open",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "staminaRecovery",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde dayanıklılık yenilenmesi %10 hızlanır.")
              },
              {
                "id": "keep",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "healingBonus",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde iksir ve can çalmayla iyileşme %10 artar.")
              }
            ]
          },
          "voice": "questEcho",
          "completeStory": L5("Bağ çözüldü. Kadı’ya giden yol açılıyor.", "The bond is broken. The road to the Judge opens.")
        }
      ]
    },
    "4": {
      "title": L5("Zincirlerin Kaynağı", "Source of the Chains"),
      "introduction": L5("Kadı’nın gardiyanları burada silahlanıyor. Esir işçileri çıkar; zincir üretimini durdur.", "The Judge’s wardens are armed here. Free the captive workers and stop the forging of chains."),
      "quests": [
        {
          "id": "last-prisoner",
          "name": L5("Esirlerin Ocağı", "Forge of Captives"),
          "description": L5("Vinç anahtarını bul ve işçilerin zincirlerini bırak.", "Find the winch key and release the workers’ chains."),
          "steps": [
            {
              "id": "last-shackle",
              "room": 2,
              "dx": -3.8,
              "dz": 2.6,
              "shape": "relic",
              "name": L5("Vinç Anahtarı Halkası", "Winch Key Ring"),
              "verb": L5("Anahtar halkasını al", "Take the key ring"),
              "objective": L5("Kömür Mahkûmları’nda vinç anahtarını bul.", "Find the winch key among the Coal Prisoners."),
              "story": L5("Bir işçi halkayı uzatıyor: “Vinci bırak. Hepimizin zinciri ona bağlı.”", "A worker hands you the ring: “Release the winch. Every chain runs through it.”")
            },
            {
              "id": "prison-winch",
              "room": 7,
              "dx": 3.8,
              "dz": 2.5,
              "shape": "winch",
              "name": L5("Esir İşçilerin Vinci", "Captive Workers’ Winch"),
              "verb": L5("Vinci aç, zincirleri bırak", "Open the winch and release the chains"),
              "objective": L5("Zincir Kuyuları’nda işçilerin vincini aç.", "Open the workers’ winch at the Chain Pits."),
              "story": L5("Vinç duruyor. İşçiler ellerini örsten çekip kaçış yoluna ilerliyor.", "The winch stops. The workers pull their hands from the anvils and head for the escape route."),
              "guard": 9
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "free",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "damageReduction",
                "amount": 0.06,
                "effect": KabirI18n.t("Bu bölümde alınan tüm hasar %6 azalır.")
              },
              {
                "id": "turn",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "bossDamage",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümün efendisine verilen hasar %10 artar.")
              }
            ]
          },
          "voice": "questPrisoner",
          "completeStory": L5("Bağ çözüldü. Esirlerin kaçış yolu artık güvenli.", "The bond is broken. The captives now have a safe escape route.")
        },
        {
          "id": "heart-feeds",
          "name": L5("Son Döküm", "The Last Casting"),
          "description": L5("Dökümü durdur ve mahkeme kapısının beslemesini kes.", "Stop the casting and cut the court gate’s feed."),
          "steps": [
            {
              "id": "casting-feed",
              "room": 5,
              "dx": -3.5,
              "dz": 3.3,
              "shape": "valve",
              "name": L5("Döküm Vanası", "Casting Valve"),
              "verb": L5("Döküm vanasını kapat", "Close the casting valve"),
              "objective": L5("Sönen Dökümhane’de döküm vanasını kapat.", "Close the casting valve in the Dying Foundry."),
              "story": L5("Yeni zincirler artık dökülmüyor. Ana basınç hattı hâlâ açık.", "No new chains are being cast. The main pressure line is still open.")
            },
            {
              "id": "heart-feed",
              "room": 12,
              "dx": -3.6,
              "dz": 2.5,
              "shape": "valve",
              "name": L5("Mahkeme Besleme Vanası", "Court Gate Feed Valve"),
              "verb": L5("Ana beslemeyi kes", "Cut the main feed"),
              "objective": L5("Son Döküm’de mahkeme kapısının beslemesini kes.", "Cut the court gate’s feed at the Last Casting."),
              "story": L5("Mahkemenin demir sürgüsü geri çekiliyor. Ocağın ustası son geçidi tutuyor.", "The court’s iron bolt withdraws. The master of the forge holds the final passage.")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "shelter",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "healingBonus",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde iksir ve can çalmayla iyileşme %10 artar.")
              },
              {
                "id": "starve",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "bossDamage",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümün efendisine verilen hasar %10 artar.")
              }
            ]
          },
          "voice": "questHeart",
          "completeStory": L5("Bağ çözüldü. Kadı’ya giden yol açılıyor.", "The bond is broken. The road to the Judge opens.")
        }
      ]
    },
    "5": {
      "title": L5("Son Mahkeme", "The Last Court"),
      "introduction": L5("Kadı seni yeniden zincirlemek istiyor. Son esirleri çıkar, kurban bağlarını kır ve hesabı kapat.", "The Judge means to chain you again. Free the last captives, break the tribute bonds and settle the score."),
      "quests": [
        {
          "id": "four-seals",
          "name": L5("Tahtın Zincirleri", "Chains of the Throne"),
          "anyOrder": true,
          "voice": "questSeals",
          "completeStory": L5("Bağ çözüldü. Esirlerin kaçış yolu artık güvenli.", "The bond is broken. The captives now have a safe escape route."),
          "description": L5("Kadı’nın kürsüsünü besleyen üç kurban bağını kır.", "Break the three tribute bonds feeding the Judge’s dais."),
          "steps": [
            {
              "id": "ledger-seal-1",
              "fallback": {
                "index": 0.3
              },
              "shape": "seal",
              "name": L5("Mezarın Kurban Bağı", "Grave Tribute Bond"),
              "verb": L5("Mezar bağını kır", "Break the grave bond"),
              "objective": L5("Arşivde mezarın kurban bağını kır.", "Break the grave tribute bond in the archive."),
              "story": L5("Mezardan alınan nefesleri taşıyan zincir kopuyor. Kadı’nın kürsüsü sarsılıyor.", "The chain carrying breaths from the grave snaps. The Judge’s dais shakes.")
            },
            {
              "id": "ledger-seal-2",
              "fallback": {
                "index": 0.45
              },
              "shape": "memorial",
              "name": L5("Limanın Kurban Bağı", "Port Tribute Bond"),
              "verb": L5("Liman bağını kır", "Break the port bond"),
              "objective": L5("Arşivde limanın kurban bağını kır.", "Break the port tribute bond in the archive."),
              "story": L5("Denizden getirilen esirlerin bağı düşüyor. Kadı artık o zincirden güç alamıyor.", "The bond of the captives brought by sea falls. The Judge can no longer draw strength through it.")
            },
            {
              "id": "ledger-seal-3",
              "fallback": {
                "index": 0.62
              },
              "shape": "tablet",
              "name": L5("Ocağın Kurban Bağı", "Forge Tribute Bond"),
              "verb": L5("Ocak bağını kır", "Break the forge bond"),
              "objective": L5("Arşivde ocağın kurban bağını kır.", "Break the forge tribute bond in the archive."),
              "story": L5("Son zincir kırılıyor. Kürsünün altındaki kurban düzeneği sustu.", "The last chain breaks. The tribute mechanism beneath the dais falls silent.")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "break",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "damageReduction",
                "amount": 0.06,
                "effect": KabirI18n.t("Bu bölümde alınan tüm hasar %6 azalır.")
              },
              {
                "id": "wield",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "bossDamage",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümün efendisine verilen hasar %10 artar.")
              }
            ]
          }
        },
        {
          "id": "selvi",
          "name": L5("Son Kurbanlar", "The Last Sacrifices"),
          "voice": "questSelvi",
          "description": L5("Arşivin derinliklerindeki son esirlerin kilidini aç.", "Open the lock holding the last captives deep in the archive."),
          "steps": [
            {
              "id": "selvi-cell",
              "fallback": {
                "index": 0.8
              },
              "shape": "seal",
              "name": L5("Son Esirlerin Kilidi", "Last Captives’ Lock"),
              "verb": L5("Son esirlerin zincirini kır", "Break the last captives’ chain"),
              "objective": L5("Arşivin derinliklerinde son esirlerin kilidini aç.", "Open the last captives’ lock deep in the archive."),
              "story": L5("Zincirler yere düşüyor. “Yol açık,” diyorsun. “Bir daha arkanıza bakmayın.”", "The chains fall. “The way is clear,” you say. “Do not look back.”")
            }
          ],
          "verdict": {
            "title": L5("Yola devam etmeden", "Before moving on"),
            "question": L5("Bağlar kırıldı. Geride kalan malzemeyi nasıl kullanacaksın?", "The bonds are broken. How will you use the remaining supplies?"),
            "options": [
              {
                "id": "free",
                "name": L5("Savunmanı hazırla", "Prepare your defenses"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "healingBonus",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümde iksir ve can çalmayla iyileşme %10 artar.")
              },
              {
                "id": "ask",
                "name": L5("Saldırını hazırla", "Prepare your attack"),
                "story": L5("Kırık bağlardan kalan malzemeyi yanına alıyorsun. Yoluna devam etmek için hazırlanıyorsun.", "You take the supplies left by the broken bonds and prepare to press onward."),
                "benefit": "bossDamage",
                "amount": 0.1,
                "effect": KabirI18n.t("Bu bölümün efendisine verilen hasar %10 artar.")
              }
            ]
          },
          "completeStory": L5("Bağ çözüldü. Kadı’ya giden yol açılıyor.", "The bond is broken. The road to the Judge opens.")
        }
      ]
    }
  };

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
    function makeCaptiveStation(node) {
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
      // The captive station remains after release; no extra actor or light.
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
      if (node.id === 'selvi-cell') { makeCaptiveStation(node); return; }
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
