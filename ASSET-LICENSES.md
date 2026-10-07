# Kabir Azabı — görsel kaynaklar

Oyunun kaynak kodu ve bu dosyada adı geçen üçüncü taraf görsel içerikler ayrı lisanslara sahiptir. Aşağıdaki kaynaklar 28 Eylül 2026 tarihinde edinildi; değiştirilmiş oyun sürümleri `assets/characters/characters.js`, `assets/characters/authored-clips.js` ve `src/materials.js` içinde gömülüdür.

## Karakterler — thecubber / OpenGameArt

**Model by thecubber, commissioned by the OpenGameArt.org community (https://opengameart.org).**

- [Rigged Textured Barbarian](https://opengameart.org/content/rigged-textured-barbarian)
- [Rigged Textured Executioner](https://opengameart.org/content/rigged-textured-executioner)

Her iki eser için sunulan alternatifler arasından **[Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/)** seçilmiştir. [Lisansın tam metni](https://creativecommons.org/licenses/by/3.0/legalcode).

Yapılan değişiklikler: eski Blender malzemelerinin glTF/PBR dönüşümü, normal haritası yönünün düzeltilmesi, renk/pürüzlülük ayarı, isteğe bağlı mavi boya katmanlarının kaldırılması, sakal/bıyık eklenmesi, beden yüzeyinin yumuşatılması, farklı düşman oranları/kostümleri ve başka bir iskeletin animasyonlarının uyarlanması. Kaynak sanatçının bu oyunu desteklediği ima edilmez.

Karakter ayrıntı geçişi 2: Bu sürümde barbar ve cellat modellerinin renk ve normal haritaları kaynaktaki 2048 px çözünürlükte bırakılıp WebP olarak yeniden kodlandı (ortam örtüşmesi 512 px). Renk haritasının alfa kanalına derleme sırasında bir deri maskesi yazıldı; saydamlık için değil, deri gölgelendirmesi için kullanılır. Geometri sıkıştırıldı. Aşınma, kir, pas, kan, yara izleri ve bütün zırh, kumaş, kürk ve silahlar oyunun kendi koduyla eklenir.

Hedef portreleri (`assets/ui/target-*.webp`) bu değiştirilmiş karakter modellerinin yüz ve omuz kadrajlarından üretildi. Ayrı ışıklandırma ve karanlık arka plan kullanıldı; model kaynakları ve yukarıdaki CC BY 3.0 atfı bu portreler için de geçerlidir.

## Sakal ve bıyık — RehmanPolanski

MakeHuman topluluğunun [Bodyparts05 paketi](https://static.makehumancommunity.org/assets/assetpacks/bodyparts05.html): Viking beard ve Viking moustache. **CC0 1.0**. Geometri başa uyarlandı, baş kemiğine ağırlıklandırıldı, renk ve saydamlık ayarlandı.

## Hareketler — Quaternius

[Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) ve [Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html), ücretsiz Standard paketleri. **CC0 1.0**; arşivlerdeki `License.txt` belgeleriyle doğrulandı.

Seçili hareketler sıkıştırılmış eklem dönüşümlerine çevrildi ve yerel iskelete uyarlandı. Yatay kök hareketi çıkarıldı; yürüyüş, vuruş teması, kaçınma ve tepkiler oyunun gerçek zamanlamasına eşlendi.

## PBR yüzeyler — Poly Haven

Kaynak JPEG dosyaları albedo için kalite 92, normal/ARM için kalite 94 ayarıyla WebP biçimine dönüştürüldü; çözünürlük değişmedi. Oyun sırasında harici doku sunucusuna bağlanılmaz. Albedo sRGB; normal ve ARM renk dönüşümü uygulanmayan veridir. ARM kanalları R=ortam örtüşmesi, G=pürüzlülük, B=metalikliktir. OpenGL normal haritalarında yeşil kanal çevrilmez.

### Dark Rock 02 — `floor`

Kaynak: https://polyhaven.com/a/dark_rock_02

Sanatçılar: Amal Kumar (All).

- Albedo: `dark_rock_02_diff_1k.jpg` — kaynak MD5 `92e53acc3f9878b525d0234d8c51fadf`.
- OpenGL normal: `dark_rock_02_nor_gl_1k.jpg` — kaynak MD5 `ddae04d066a75ff94b7dd34e8c0f9b74`.
- ARM: `dark_rock_02_arm_1k.jpg` — kaynak MD5 `bfb86b730d4a917a55b7e98e843edaa1`.

### Worn Rock Natural 01 — `masonry`

Kaynak: https://polyhaven.com/a/worn_rock_natural_01

Sanatçılar: Rob Tuytel (Processing); Dimitrios Savva (Photography).

- Albedo: `worn_rock_natural_01_diff_1k.jpg` — kaynak MD5 `f410522eec19eb12e2b96ad4386b8493`.
- OpenGL normal: `worn_rock_natural_01_nor_gl_1k.jpg` — kaynak MD5 `8645b86f5cb360b626086a4dc286340a`.
- ARM: `worn_rock_natural_01_arm_1k.jpg` — kaynak MD5 `9ebd8c9c3b3db65349dca9c7c27f106e`.

### Rust Coarse 01 — `rust`

Kaynak: https://polyhaven.com/a/rust_coarse_01

Sanatçılar: Dimitrios Savva (Photography); Rico Cilliers (Processing).

- Albedo: `rust_coarse_01_diff_1k.jpg` — kaynak MD5 `c2d2facc7184f216d15a8f9957d3aa4c`.
- OpenGL normal: `rust_coarse_01_nor_gl_1k.jpg` — kaynak MD5 `77f701cbbf5042f6531e7a5af3a4d171`.
- ARM: `rust_coarse_01_arm_1k.jpg` — kaynak MD5 `28b26e393942bc25ef62f76b55fe4649`.

### Brown Leather — `leather`

Kaynak: https://polyhaven.com/a/brown_leather

Sanatçılar: Rob Tuytel (All).

- Albedo: `brown_leather_albedo_1k.jpg` — kaynak MD5 `080b3bf1372766ff2c7ff121ed07b5e8`.
- OpenGL normal: `brown_leather_nor_gl_1k.jpg` — kaynak MD5 `b63ae0121a415c23d74eed0b07fc6065`.
- ARM: `brown_leather_arm_1k.jpg` — kaynak MD5 `40778465932d0a0816a9fbdab00e2a5d`.

### Rough Linen — `linen`

Kaynak: https://polyhaven.com/a/rough_linen

Sanatçılar: colormass (Photography); Rico Cilliers (Processing).

- Albedo: `rough_linen_diff_1k.jpg` — kaynak MD5 `663db789fb075462b685c1f740e58930`.
- OpenGL normal: `rough_linen_nor_gl_1k.jpg` — kaynak MD5 `3350269a2e9c472aa406bd3cc1eaf2c8`.
- ARM: `rough_linen_arm_1k.jpg` — kaynak MD5 `ffe777973056d79d6b2a1324e8451295`.

### Dark Wooden Planks — `wood`

Kaynak: https://polyhaven.com/a/dark_wooden_planks

Sanatçılar: Amal Kumar (All).

- Albedo: `dark_wooden_planks_diff_1k.jpg` — kaynak MD5 `7ec8fe3e0b84289a4add3b10a54090bb`.
- OpenGL normal: `dark_wooden_planks_nor_gl_1k.jpg` — kaynak MD5 `4093b4023a4270b3a06b762076106d58`.
- ARM: `dark_wooden_planks_arm_1k.jpg` — kaynak MD5 `5e5911f2c6d4fbce78c995ec7591eaa9`.


## Three.js

Three.js r170 ve aynı sürümün GLTFLoader / toTrianglesDrawMode yardımcıları. **MIT**, three.js authors. Tam metin: `vendor/THREE-LICENSE.txt`.

Yükleyicide yalnızca ES module import/export sınırı klasik `window.THREE` script biçimine uyarlandı; oyun kurulum veya derleme gerektirmez.

## SMAA (kenar yumuşatma)

`src/smaa.js` — SMAA 1x (Subpixel Morphological Anti-Aliasing) klasik script portu. Shader kodu three.js r170'in
`examples/jsm/shaders/SMAAShader.js` dosyasından (**MIT**, three.js authors) türetildi; o da SMAA v2.8 referans uygulamasının
(**MIT**, © 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego Gutierrez; http://www.iryoku.com/smaa/)
WebGL portudur. İki arama dokusu (AreaTex 160×560 ve SearchTex 64×16, PNG olarak gömülü) three.js r170 `SMAAPass.js` dosyasından
alındı. Bu oyun için değişiklikler: klasik script biçimi, kalite kademesine göre eşik/adım ayarı, her ekran boyutu için önceden
ayrılan hedefler. Referanstaki köşe ve çapraz desen algılama eklenmedi. Referans lisans metni: Permission is hereby granted, free of
charge, to any person obtaining a copy of this software ... (MIT; tam metin `vendor/THREE-LICENSE.txt` ile aynı koşullar).

## Karakterler — Quaternius (CC0 1.0)

**Models by Quaternius** — https://quaternius.com — kaynakta atıf zorunlu değildir; yine de belirtilir.

- [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), ücretsiz *Standard* sürüm — `Universal Base Characters[Standard].zip` (itch.io: https://quaternius.itch.io/universal-base-characters), MD5 `295e8426e6e4574b6801cfea0e764286`.
- [Modular Character Outfits – Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), ücretsiz *Standard* sürüm — `Modular Character Outfits - Fantasy[Standard].zip` (itch.io: https://quaternius.itch.io/modular-character-outfits-fantasy), MD5 `994affe4637d4cb3336f70e576b636c9`.

Her iki arşivdeki `License_Standard.txt`: **CC0 1.0 Universal** (https://creativecommons.org/publicdomain/zero/1.0/). 28 Eylül 2026'da indirildi. Aynı yazarın *Bestiary* paketi CC0 değil (Quaternius Asset License) olduğu için kullanılmadı.

Kullanılan parçalar: `Superhero_Male_FullBody` gövdesi ve dokuları (mahkûm, pusucu; muhafız ve rahipte yalnızca baş), `Male_Peasant` pantolon ve ayakkabı, `Male_Ranger` gövde, kollar, bileklik, kemerler, kukuleta ve pantolon (el dokusu dahil).

Yapılan değişiklikler: dokular 1024/512 px WebP'ye küçültüldü; geometri KHR_mesh_quantization ile sıkıştırıldı; kıyafet parçaları gövde iskeletine yeniden bağlandı; yükleme sırasında kol/bacak/boyun uzunlukları ve zayıflık düzenlendi, görünmeyen gövde parçaları kesildi; renkler gölgelendiricide yeniden tonlandı (kir, kan, pas). Zırh, miğfer, kalkan, silahlar, zincirler, çuval başlık, cübbe, kafes, maske ve kürk pelerin oyuna özgü olarak prosedürel üretildi.

Barbar ve cellat (thecubber, CC BY 3.0) bu sürümde de kullanılır: kahraman ve veba taşıyıcısı/Zincir Celladı. Ek değişiklikler: dokular 1024/512 px WebP, geometri sıkıştırma, cellat modelinde sürülmeyen `neutral_bone` ağırlıklarının leğen kemiğine taşınması (ölüm pozundaki sivri bozulmayı giderir), taşıyıcıda karın/kambur şişirme.

Dağıtım: `assets/characters/characters.js` (gömülü GLB'ler), lisans notu `assets/characters/CHARACTER-LICENSE.txt`.

## Ortam grafikleri güncellemesi (28 Eylül 2026) — PBR paketinin yeniden sıkıştırılması

Bu güncellemede **yeni bir üçüncü taraf dosya indirilmedi**. Yukarıdaki altı Poly Haven yüzeyi (**CC0 1.0**, aynı kaynaklar, sanatçılar ve MD5 değerleri) `src/materials.js` içinde daha küçük bir biçimde yeniden paketlendi. Bu bölüm, yukarıdaki "1024 × 1024 haritalar … çözünürlük değişmedi" paragrafının yerini alır.

Yapılan değişiklikler:

- Çözünürlük kullanıma göre düşürüldü: `floor` (Dark Rock 02) ve `masonry` (Worn Rock Natural 01) **512 × 512**; `rust`, `leather`, `linen`, `wood` **256 × 256**.
- Her harita, tek kanallı kayıplı WebP düzlemlerine ayrıldı: normal X ve Y, pürüzlülük, gerekirse ortam örtüşmesi (AO) ve metaliklik. Normalin Z bileşeni ve ARM dokusu (R = AO, G = pürüzlülük, B = metaliklik) açılışta tarayıcıda yeniden oluşturulur. OpenGL normal yönü korunur.
- Taş albedoları (`floor`, `masonry`) ve `linen` yalnız parlaklık (gri ton) olarak saklanır; renk her odada `src/world.js` tarafından verilir (kül, pas, safra, kan, kemik tozu, mum ışığı tonları). `rust`, `leather`, `wood` renkli albedo olarak kalır.
- Görünüm için ek dokular (kan/kül/is/mum/küf/çatlak/rün lekeleri atlası, gürültü dokusu, dalga normali, duman ve kıvılcım sprite'ları) harici görsel kullanmadan açılışta kodla çizilir; bunlar bu oyun için yazıldı.
- Sonuç: `src/materials.js` 8.713.420 bayttan yaklaşık 434.000 bayta indi (−%95). Oyun sırasında harici doku sunucusuna bağlanılmaz; dosyadan (file://) açılış desteklenir.

## Müzik — özgün, çalışma anında sentezlenir (`src/music.js`)

Oyunun müziği bu proje için bestelendi ve tamamı tarayıcıda, oyun çalışırken Web Audio ile üretilir. **Üçüncü taraf
ses dosyası, örnek (sample), kayıt, ses bankası veya indirilmiş varlık kullanılmadı**; dosyada gömülü ses verisi yoktur
(0 bayt). Çan, taiko, çerçeve davul, örs, demir levha, zincir, kemik tıkırtısı, kalp atışı, yaylı çalgı vuruşları,
pizzicato, sempatik titreşimli demir tel ve katedral yankısı gibi tek vuruşluk sesler, kodun içindeki matematiksel tariflerle (kısmi titreşimler,
süzülmüş gürültü, Karplus-Strong tel modeli) yükleme sırasında hesaplanır; drone, alçak erkek korosu (formant süzgeçleri),
yaylılar/çello, bakır nefesliler ve boğaz şarkısı sesleri canlı osilatörlerdir.

- Besteci / ses tasarımı: ilk sürüm Claude (Anthropic) ile, demir tel/yemin motifi ve gece ses düzenlemeleri Codex (OpenAI) ile oyunun sahibinin isteğiyle yazıldı.
- Lisans: oyunun kendi kaynak koduyla aynı koşullar (üçüncü taraf lisans yükümlülüğü yoktur, atıf gerekmez).
- Test araçları (yalnızca geliştirme sırasında, oyuna dahil değil): önceki sessiz tarayıcı render'ları;
  bu sürümde `node-web-audio-api` gerçek `OfflineAudioContext` tamponları ve FFmpeg seviye ölçümleri. Hoparlörde ses çalınmadı.

English: the score is original and fully synthesised at runtime by `src/music.js`. No third-party audio, samples,
sound banks or downloaded assets are used; there is no embedded audio data. No attribution or licence obligations
beyond the game's own code.

## Ses efektleri — CC0 ses paketleri

28 Eylül 2026 tarihinde aşağıdaki sayfalardan indirildi; her sayfanın lisans alanı **CC0 1.0** (kamu malı) olarak doğrulandı (Kenney paketlerinde ayrıca arşivdeki `License.txt`). CC0 atıf istemez; emeğe saygı için yazarlar burada anılır. Kaynak sanatçıların bu oyunu desteklediği ima edilmez.

| Kaynak | Yazar | Oyunda kullanılan parçalar (`ses adı` ← dosyalar) |
|---|---|---|
| [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | `step` ← footstep_concrete_000/001/003/004; `armor` ← impactPlate_heavy_000/002/004; `metal` ← impactMetal_heavy_000/002/003; `clank` ← impactMetal_medium_001/003; `shield` ← impactPlank_medium_000/002; `bell` ← impactBell_heavy_000 |
| [RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney | `scuff` ← footstep01/03; `gear` ← beltHandle1; `cloth` ← cloth1 |
| [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack) | artisticdude | `gear` ← chainmail1; `cloth` ← cloth-heavy; `drink` ← bubble2; `cork` ← bottle; `shing` ← sword-unsheathe2; `guardGrunt` ← ogre1/3/5; `guardDeath` ← giant3; `bossRoar` ← giant2; `stalkerShriek` ← shade1/3/5; `stalkerDeath` ← shade7; `carrierGurgle` ← slime2/5/8 |
| [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | artisticdude | `swish` ← swish-3/4/7/9 |
| [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack) | artisticdude | `prisonerMoan` ← zombie-4/12 |
| [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) | rubberduck | `chain` ← chain_01/02/03; `debris` ← stones_01/03; `rune` ← spell_fire_06; `bossRoar` ← creature_roar_01/03; `bossDeath` ← creature_die_01 |
| [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) | rubberduck | `spit` ← spit_01/03; `carrierDeath` ← burble_01 |
| [80 CC0 creature SFX #2](https://opengameart.org/content/80-cc0-creture-sfx-2) | rubberduck | `stomp` ← stomp_01 |
| [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2) | rubberduck | `wetStep` ← sfx100v2_footstep_wet_01/03 |
| [15 vocal male strain/hurt/pain/jump sounds](https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds) | qubodup (sayfada: "CC0 starting 2024-08-30") | `effort` ← slightscream-01/03/11/14; `strain` ← slightscream-06/08; `hurt` ← slightscream-02/04/09/12 |
| [8 wet squish, slurp impacts](https://opengameart.org/content/8-wet-squish-slurp-impacts) | qubodup (Independent.nu ses bankası) | `flesh` ← impactsplat01/03/05/07 |
| [Fleshy Bone Break/Snap SFX](https://opengameart.org/content/fleshy-bone-breaksnap-sfx) | Zane Little Music | `bone` ← Wet Break 2/5/8 |
| [40 wet towel club/pound/hit/attack sounds](https://opengameart.org/content/40-wet-towel-clubpoundhitattack-sounds) | qubodup (sayfada: arşivdeki eski txt'yi değil CC0'ı esas alın) | `thump` ← wet_towel_on_body-03/11/24 |
| [Zombie / Skeleton / Monster Voice Effects](https://opengameart.org/content/zombie-skeleton-monster-voice-effects) | ArcadeParty | `prisonerYell` ← zombieYell1/2/6/10; `prisonerDeath` ← zombieDeath2/3; `cultistDeath` ← humanDeath1; `herodeath` ← humanDeath2; `roar` ← humanYell1 |
| [Metal footsteps on concrete](https://opengameart.org/content/metal-footsteps-on-concrete) | thimras | `armorStep` ← metal_steps_01/03/05 |
| [Chain winch sounds](https://opengameart.org/content/chain-winch-sounds) | bart | `winch` ← "winch - Marker #5" |
| [Ghost Monster Voice Moaning & Growling](https://opengameart.org/content/ghost-monster-voice-moaning-growling) | qubodup | `moan` ← qubodup-GhostMoan03 |
| [Male Grunt/Yelling sounds](https://opengameart.org/content/male-gruntyelling-sounds) | HaelDB | 19 işlenmiş kayıt: `tortScream` ← 1yell3/11, 2yell4/6, 3yell13/16, yell1/11; `tortMoan` ← 1yell4, 2yell11, 3grunt6, 3yell9; `tortSob` ← 3grunt1/2/6; `tortGurgle` ← 3yell13, 1yell16; `tortWhisper` ← 3grunt6/2 |

HaelDB'nin kaynak sayfasındaki CC0 seçeneği 30 Eylül 2026 tarihinde doğrulandı. İnsan sesleri dört oyuncunun rol yaparak kaydettiği çığlık ve zorlanma sesleridir; gerçek işkence kaydı kullanılmaz. Baş/son sessizliği kırpıldı, tempo en fazla %13 değiştirildi, 95–6000 Hz süzgeç ve kısa sönüm uygulandı; tepe −2 dBFS. 19 kayıt tek bir 32 kHz/48 kbps MP3 sprite'a gömüldü. Eski `tortSob` / `tortWhisper` adları zorlanma ve kesik nefes kayıtlarını taşır; bu kaynakta ağlama veya Türkçe fısıltı konuşma kaydı olduğu iddia edilmez.

Yapılan değişiklikler (hepsi `tools/gen_narration.py` içinde, yeniden üretilebilir): mono'ya indirme, baş/son sessizliğini kırpma, kesit alma, bant hızıyla perde ve süre değiştirme (`rate`), rubberband ile perde kaydırma (sesler, yaratıklar ve kahramanın zorlanma sesleri 1,5–5 yarım ton pes), yüksek/alçak geçiren süzgeç, sönüm, ilk efektlerde tepe seviyesinin −1 dBFS'ye getirilmesi. İlk efektler üç mono MP3 "sprite" dosyasında birleştirildi: `deep` (16 kHz/24 kbps), `lo` (22,05 kHz/32 kbps), `hi` (32 kHz/48 kbps); HaelDB'nin yukarıda açıklanan kayıtları dördüncü `pain` sprite'ına (32 kHz/48 kbps) eklendi. Dört sprite `src/narration.js` içindeki `BABA.SoundBank` nesnesine base64 olarak gömülüdür: toplam MP3 verisi 406.360 bayt, base64 metni 541.820 bayt (kesit bilgileri hariç). Oyun dosyadan (file://) açılırken hiçbir harici ses dosyası ya da sunucu kullanılmaz. İndirilen paketler proje dışında önbellekte tutulur (`KARA_AUDIO_CACHE` ya da `~/.cache/kara-gecit-audio`).

Özgün müzik `src/music.js` içinde sentezlenir. Ortamın uzak zincir, inilti, çığlık, vinç, kemik ve taş sesleri yukarıdaki CC0 efekt bankasından gelir; kaynakları ve yazarları tabloda belirtilmiştir. İnsan çığlık ve zorlanma katmanında ayrıca HaelDB'nin rol yapılarak kaydedilen sesleri kullanılır. Bunlara eklenen rüzgâr, damla, ateş çıtırtısı, kılıç rüzgârı, darbe gövdesi, metal çınlaması, uyarı ve arayüz sentez katmanları `src/audio.js` içinde Web Audio ile üretilir. Kılıç darbelerinin çelik ısırığı, et tokadı, gövde vuruşu, alt gümbürtü, metal çınlaması, kan spreyi, blok şangırtısı ve savuşturma tıngırtısı sentez katmanları da aynı dosyada, açılışta düz JavaScript ile (gürültü, süzgeç ve sönümlü sinüsler) hesaplanır; bu ek katmanlar için yeni kayıt, örnek veya indirilen dosya kullanılmaz.

## Anlatıcı ve tarikatçı ilahileri — sentez konuşma

Anlatıcı, Bahtiyar'ın kısa yemini, Zincir Celladı'nın meydan okuması ve Kül Rahibi ilahileri (`chant1–3`) Microsoft Edge metin-okuma hizmetinin anadili Türkçe erkek `tr-TR-AhmetNeural` sesiyle, açık kaynaklı `edge-tts` istemcisi aracılığıyla üretildi. 1 Ekim 2026'da yenilenen 26 konuşmaya Sessiz Taht ve Kızıl Ocak için aynı doğal stilde sekiz kayıt eklendi: toplam 34 konuşma her düşünceyi tek parçada seslendirir. Giriş ve bitişler Bahtiyar'ın güçsüz başlangıcından kıyıya, gömülü krallığa ve zincirlerin dövüldüğü ocağa uzanan yolculuğa uygundur. Anlatıcı D okumasında −8% hız ve yalnız −3 Hz perde kullanır; Bahtiyar'ın H ve celladın E okumaları aynı sesin küçük tempo farklarıdır, farklı gerçek oyuncularmış gibi sunulmaz. FFmpeg ile yalnız dış sessizlik kırpma, hafif göğüs EQ'su, de-esser, düşük oranlı sıkıştırma ve −16 LUFS eşitleme uygulandı. Formant düşürme, yapay fısıltı, son heceyi ayrıca yavaşlatma veya konuşmaya yankı ekleme yoktur; kayıtlar 32 kHz/96 kbps mono MP3 olarak `BABA.Narration` içinde gömülüdür. Son sözcük zamanları ve en az 100 ms son sessizlik payı üretimde denetlenir. Önceki ilahilerde üç sesli koro işlemesi korunur; efekt bankası bu ses yenilemesinde değiştirilmemiştir. Çıktılar açık lisanslı sesler olarak sunulmaz; kullanımları Microsoft'un hizmet koşullarına tabidir. Metinler oyuna özgüdür ve `tools/gen_narration.py` içindeki `LINES` / `CHANTS` tablolarındadır.

## Arayüz — ikinci geçiş (29 Eylül 2026): yazı tipleri ve çizimler

Bu bölüm, `ASSET-LICENSES.md` içindeki **"Yazı tipleri — arayüz"** ve **"Arayüz çizimleri ve uygulama simgesi"** bölümlerinin yerine geçer.

### Yazı tipleri (SIL Open Font License 1.1)

#### Source Sans 3 — arayüz, düğmeler, açıklamalar ve savaş sayıları

- Tasarımcı: Paul D. Hunt / Adobe. Kaynak: https://github.com/adobe-fonts/source-sans (release dalı).
- Dosya: `WOFF2/VF/SourceSans3VF-Upright.ttf.woff2`; değişken ağırlık 200–900, Türkçe dahil tam glif kümesi. Değiştirilmeden base64 `data:` adresi olarak `src/ui.css` içine gömülür; çevrimdışı ve file:// ile çalışır.
- Telif: Copyright 2010–2024 Adobe. Ayrılmış yazı tipi adı: Source. Lisans: SIL OFL 1.1; tam telif ve lisans metni `src/ui.css` içindedir. Kaynak: https://github.com/adobe-fonts/source-sans/blob/release/LICENSE.md
- Boyut: 170188 bayt; SHA-256: `5f16566f7a40d39b339ad26be151fa5a1ab1f0c2574c7a2e619765584a1acbd8`.
- Önceki Grenze ve Alegreya Sans dosyaları bu sürümde kaldırıldı.

#### Cinzel — yalnızca resme dönüştürülmüş bitiş başlıkları

- Tasarımcı: Natanael Gama. Kaynak: https://github.com/NDISCOVER/Cinzel · Telif: Copyright 2020 The Cinzel Project Authors. Lisans: SIL OFL 1.1.
- Artık `src/ui.css` içine gömülmüyor. Yalnızca geliştirme sırasında "TOPRAK SENİ İSTEMEDİ" ve "GEÇİT AÇILDI" harflerinin şekli için kullanıldı ve sonuç resim olarak kaydedildi (`assets/ui/title-death.webp`, `title-victory.webp`). OFL, yazı tipiyle üretilen belgeleri/resimleri lisans yükümlülüğünden muaf tutar; yine de kaynak olarak belirtilir. Kullanılan dosyalar önceki geçişle aynı (`title-victory.webp` değişmedi; `title-death.webp` Cinzel Black ile yeniden üretildi).

Ana başlık ve bölüm adı da Source Sans 3 ile canlı HTML metni olarak çizilir; eski koyu raster logo ve bölüm plakası kaldırıldı.

Gömülü yazı tipi verisi yaklaşık 166 KiB (base64 ile 221 KiB). Tek değişken aile tüm arayüz ağırlıklarını karşılar.

### Arayüz çizimleri — `assets/ui/*.webp` (bu oyun için üretildi)

Küre çerçeveleri (`orb-l`, `orb-r`), eylem çubuğu (`plate`), beceri yuvası (`slot`), yuvarlak madalyon (`medal`), harita halkası (`ring`), cellat çubuğu (`boss`), pencere çerçevesi (`frame`), düğmeler (`btn`, `btn-red`), tuş kapağı (`key`), oluk (`groove`), topuz (`knob`), ayraç (`divider`), kafatası arması (`crest`), bitiş başlıkları (`title-death`, `title-victory`), beceri simgeleri (`skills`), taş ve demir dokuları (`stone`, `iron`) ve sis (`fog`): hepsi bu oyun için yazılmış bir kabartma çizim aracıyla (başsız Chrome'da canvas; yükseklik haritası, yumuşak gölge, basit PBR metal/kemik/yakut ışıklandırması) **çevrimdışı** üretildi ve WebP olarak kaydedildi. Üçüncü taraf UI paketi veya Blizzard/Diablo çizimi, logosu ya da dosyası **kullanılmadı**; tasarım özgündür (Diablo IV / Diablo II Resurrected yalnızca kalite ve hava referansıdır).

Küre çerçeveleri (`orb-l`, `orb-r`) sonradan yeniden çizildi: ince, kararmış perçinli demir halka, kor ışıklı oyma işaretler, kırık dış halka ve zincir halkaları. `tools/gen_orb_frames.py` (Python + numpy + Pillow) çevrimdışı üretir; üçüncü taraf dosya kullanılmadı. Harita halkası (`ring`) da aynı biçimde yeniden çizildi (`tools/gen_map_frame.py`): ince kararmış demir, kehribar kor ışığı, kuzeyde mühür taşı. Yuvarlak madalyon (`medal`: portre çerçevesi, mola ve dokunmatik düğmeleri, pencere kapatma düğmeleri, anlatıcı simgesi) da aynı biçimde yeniden çizildi (`tools/gen_medal_frame.py`).

Yüzey ayrıntısı olarak aşağıdaki Poly Haven taramaları (**CC0 1.0**, yukarıdaki PBR bölümünde listelenen aynı dosyalar ve MD5 değerleri; önceki `src/materials.js` içindeki 1024 px sürümler) kullanıldı:

- **Rust Coarse 01** (Dimitrios Savva, Rico Cilliers) — demir, bronz, altın ve çelik kabartmaların renk/normal ayrıntısı; `iron.webp` dokusu.
- **Dark Rock 02** (Amal Kumar) — pencere zemini `stone.webp`; uygulama simgesi arka planı.
- **Worn Rock Natural 01** (Rob Tuytel, Dimitrios Savva) — kemik ve boynuz yüzeyleri.
- **Brown Leather** (Rob Tuytel) — kırmızı mine düğmeler ve simgelerdeki deri kabzalar.

Yapılan değişiklikler: dokular yeniden aydınlatıldı, karartıldı, renk tonu değiştirildi, küçültüldü ve kabartma çizimlerin içine karıştırıldı; hiçbiri özgün hâliyle ayrı dosya olarak dağıtılmaz.

`src/hud.js` içindeki sıvı küre gölgelendiricisi (WebGL) ve hasar sayıları da bu oyun için yazıldı.

### Uygulama simgesi

`icons/icon-512.png`, `icon-192.png`, `apple-touch-icon.png` (180 px): aynı araçla çizilen boynuzlu kafatası madalyonu (demir halka, bronz kenar), arka planda Dark Rock 02 (CC0) dokusu. `icon.svg` değişmedi.

## Işık ve ambiyans güncellemesi (29 Eylül 2026) — grafik geçişi 2

Bu güncellemede **yeni bir üçüncü taraf dosya indirilmedi** (doku, model, HDRI veya ses yok). Mevcut Poly Haven yüzeyleri
(CC0 1.0) ve three.js r170 (MIT) aynen kullanılmaya devam ediyor.

Yeni dosyalar ve kaynakları:

- `src/lighting.js` — oda başına ışık düzeni (ana ışık, dolgu, kenar ışığı), yere yakın hareketli sis, ışıkların havada
  saçılması, karakterlere özel kenar/dolgu ışığı, Adak Ayini / Sessiz Şapel / Zincir Mahkemesi
  ışık senaryoları. Bu oyun için yazıldı. Sis parçaları three.js'in `fog_*` shader parçalarının yerine geçer; o parçaların
  yapısı three.js kaynak kodundan türetildi (**MIT**, three.js authors, tam metin `vendor/THREE-LICENSE.txt`).
- `src/post.js` — HDR sahne hedefi, ortam örtüşmesi (SAO), bloom, ısı dalgası, ton eğrisi, oda renk ayarı, vinyet,
  film greni. Kod bu oyun için yazıldı; izlenen yöntemler herkese açık yayınlardan: Scalable Ambient Obscurance
  (McGuire, Mara, Luebke 2012), 13 örnekli küçültme + çadır filtreli büyütme bloom zinciri (Jimenez 2014, "Next Generation
  Post Processing in Call of Duty: Advanced Warfare"). FXAA ve ilgili ara görüntü geçişi önceki sürümlerde kaldırıldı.
  ACES ton eğrisi yaklaşımı (Stephen Hill), three.js `ACESFilmicToneMapping` ile birebir aynı sayılarla
  (**MIT**, three.js authors).
- `src/world.js` — pencere, ızgara, çatlak ve tavan gözü (oculus) ışık desenleri, damla halkaları
  harici görsel kullanmadan açılışta tuvalde / shader'da çizilir; bu oyun için yazıldı.

Bahtiyar'ın yeni arayüz portresi (`assets/ui/portrait-v47.webp`), oyunun gerçek modelinden alınan önceki `portrait.webp` referansıyla yerleşik OpenAI ImageGen kullanılarak bu oyun için üretildi. Yüz, poz ve karakter tasarımı korunarak resim kalitesi iyileştirildi. Bu çizim yeni bir 3D model veya oyunun ekran görüntüsü değildir. Üretim metni `tools/portrait-prompt.txt` içinde; seçilen görsel 512 × 512 WebP biçiminde saklanır. Önceki model portresi de projede korunur.

Oyun sırasında hiçbir harici sunucuya bağlanılmaz; dosyadan (file://) açılış desteklenir.

## Bölüm II · Kara Kıyı

Kıyı yerleşimi, kökler, mezarlar, gemi enkazları, düşmanların deniz/kök eklentileri, silahları ve saldırı görselleri projede kodla oluşturulmuştur (`src/coast-*.js`). Yeni düşmanlar yukarıda lisansları belirtilen Quaternius ve thecubber bedenleri ve hareketleri üzerinde özgün donanım ve oran değişiklikleri kullanır. Hedef portreleri bu oyun modellerinden oluşturulmuştur. Taş ve diğer mevcut kaplamalar Poly Haven kaynaklarından gelir. Kara Kıyı’nın temel yüzeyleri aşağıdaki taranmış PBR kaplamaları kullanır; yerel aşınma/ıslaklık/tuz katmanları `src/coast-world.js` içinde eklenir. Çürümüş deri haritası `src/coast-models.js` içinde özgün olarak üretilir. Yeni Türkçe anlatımlar mevcut `tr-TR-AhmetNeural` sesiyle hazırlanmıştır.

### Sürüm 84 — yüksek ayrıntılı yerel kaplamalar

`assets/coast/surfaces.js` tam renkli albedo, OpenGL normal ve paketlenmiş ARM haritalarını içerir. Ana çevre albedoları 2048×2048, normal haritaları 1024×1024; donanım/kumaş/deri albedoları 1024×1024, kabartı haritaları 512×512; bütün ARM haritaları 512×512. Albedolar WebP kalite 86, normal haritaları kalite 98, ARM kayıpsız WebP olarak saklanır. Üstteki eski haritalar ilk sürümlerin kaynak kaydıdır; sürüm 84 her iki bölümde taş, ahşap, metal, deri ve kumaş için aşağıdaki paketlenmiş sürümleri kullanır. Üretim tarifi ve kaynak dosyaların doğrulama özetleri `tools/coast-material-sources.json` içinde tutulur.

Bütün Poly Haven kaynakları **CC0**: https://polyhaven.com/license

| Kullanım | Kaynak |
| --- | --- |
| Kıyı kumu / küçük taşlar | https://polyhaven.com/a/coast_sand_01 |
| Orman toprağı / mezar çamuru | https://polyhaven.com/a/brown_mud_02 |
| Doğal kıyı kayaları | https://polyhaven.com/a/rock_boulder_cracked |
| Harabe duvarları / aşınmış harç | https://polyhaven.com/a/castle_brick_broken_06 |
| Ahşap / iskele / donanım | https://polyhaven.com/a/dark_wooden_planks |
| Ağaç kabuğu / kökler | https://polyhaven.com/a/bark_brown_02 |
| Döşeme / kesilmiş taş / ilk bölüm duvarları | https://polyhaven.com/a/worn_rock_natural_01 |
| İlk bölüm yer taşları | https://polyhaven.com/a/dark_rock_02 |
| Paslı metal / donanım yüzey ayrıntısı | https://polyhaven.com/a/rust_coarse_01 |
| Deri / kemer / silah sapı | https://polyhaven.com/a/brown_leather |
| Kumaş / bez / yelken | https://polyhaven.com/a/rough_linen |

Deniz yüzeyi normal haritası, Three.js r170 `examples/textures/waternormals.jpg` (1024×1024) dosyasından alınmıştır: https://github.com/mrdoob/three.js/blob/r170/examples/textures/waternormals.jpg — Three.js deposunun **MIT** lisansı (`vendor/THREE-LICENSE.txt`). JPEG özgün biçimiyle yerel pakete gömülür. İki farklı yön/hız/ölçekte örnekleme, geometri dalgaları, kamera açısına bağlı gökyüzü yansıması ve ay parıltısı bu oyun için yazılan su malzemesinde birleşir; ek sahne yansıması render geçişi açılmaz.

## Sessiz Taht ve Kızıl Ocak çevre geçişi (1 Ekim 2026)

Yeni zemin kaynağı: [Monastery Stone Floor](https://polyhaven.com/a/monastery_stone_floor), **Amal Kumar / Poly Haven, CC0 1.0**. Kaynak kontrolü `tools/ruins-material-sources.json`; tekrar üretim `tools/build_ruins_materials.py`. 2048 px renk haritası kalite 94 WebP, 1024 px OpenGL normal haritası kalite 98 WebP, 512 px ARM kayıpsız WebP. Yerel `assets/ruins/surfaces.js` içindedir; file:// ve internetsiz çalışır. Kaynak MD5 değerleri: Diffuse `35420aa52b8257920b1d7566fb80ab4d`, normal `6c71df7edca7120a011c03d5d3866355`, ARM `fbf01c48b7af8378d9cf66cd37a2bfc2`.

Duvar, doğal kaya ve demir yüzeyler mevcut CC0 Poly Haven taramalarını kullanır. Yüzey izdüşümü artık renk, normal, pürüzlülük ve ortam örtüşmesi haritalarında aynı fiziksel ölçeği ve yönü izler. Yivli sütunlar, taş kemer parçaları, mezar bezemeleri, düzensiz mağara kayaları, ocak kazanları ve fırın çerçeveleri oyuna özgü geometridir. Eklenen çevre ayrıntıları oda başına örneklenir; yeni dinamik ışık eklenmedi.

III/IV hedef portreleri (`assets/ui/target-ashbound.webp` ile `target-furnaceheart.webp` arasındaki 12 düşman resmi), `src/ruins-models.js` ve `src/forge-models.js` içindeki gerçek oyun modellerinden hazırlanmıştır. Yukarıdaki karakter, hareket ve kaplama lisansları geçerlidir; yeni dış kaynak kullanılmamıştır. 256×256 WebP resimleri ilgili bölümün yükleme ekranında hazırlanır; oyun sırasında portre için canlı üç boyutlu çizim yapılmaz.


## Local sepulchral UI artwork

The new menu backdrop, card illustrations, frame corners, ability miniatures and inventory family miniatures were generated specifically for this game with the built-in image generation tool. They are local files under `assets/ui/`; prompts and extraction mappings are documented in `UI-ART-PROMPTS.md`. This pass does not replace any third-party gameplay models or textures.

Local gothic UI figures and funeral cloth textures were authored with the built-in image generation tool. Prompt and extraction details are recorded in UI-ART-PROMPTS.md. No third-party download is used for these ornaments.

The active banner-demon-left.png and banner-demon-right.png ornaments were also authored with built-in image_gen (exec-98ba2491-1b78-425a-9659-c2a7e9d132eb.png). Their prompt and alpha extraction details are recorded in UI-ART-PROMPTS.md.


## Equipment material scans
Leather and steel albedo maps in `assets/equipment/material-scans.js`: original generated material textures created for this game using OpenAI image generation, October 2026. No third-party texture source.


### Overnight cloth and narration refresh (6 October 2026)

- Charcoal woven linen albedo: original generated artwork made with the built-in OpenAI image generation tool, embedded in `assets/equipment/material-scans.js` for offline use. Prompt: seamless evenly lit charcoal wool/linen diagonal twill, close material detail, no garment shapes or baked shadows. Normal and roughness companions are derived at preparation.
- Twenty-four concise Turkish narrator lines: original game text synthesized with Microsoft Edge Turkish `tr-TR-AhmetNeural`, restrained EQ and loudness, leading/trailing silence trimmed while preserving internal speech pauses. Embedded in `src/narration.js`.

Equipment thumbnails in `assets/equipment/thumbnails.js` are offline renders of this project's own equipment geometry and PBR materials; each catalog item uses its actual equipped model.


### Equipment PBR and set redesign (v222, 6 October 2026)

- Steel uses **Metal 012**, Lennart Demes / ambientCG, **CC0 1.0**. Source: https://ambientcg.com/view?id=Metal012 ; license: https://docs.ambientcg.com/license/ . The official `Metal012_1K-JPG.zip` contains matched PBR maps; this source is procedural PBR, not a photographic scan.
- Embedded in `assets/equipment/material-scans.js`: colour 1024 px WebP (sRGB), OpenGL normal 512 px WebP (linear), roughness 512 px lossless WebP (linear). Normal and roughness use the actual source maps rather than derivatives of albedo brightness. The polished-steel roughness is remapped to the 0.58–0.92 range for worn armour; the original source hash is recorded below. No source Blender/USD model is included.
- Source SHA-256: colour `9d32b9bbcf071433a3ed69f0409cc11886bb3c554300acaf0da93a92a2059e5b`; OpenGL normal `6ea43f0b48f5fc7d1d11ead571c22f11233053e2a1926c5e21ea27de7d3a4287`; roughness `d808a07ffe8786a8b410dfa29f19b0a31492e450256dd9191bb9731e110dba40`.
- Leather and cloth now reuse the existing Poly Haven **Brown Leather** and **Rough Linen** PBR source maps from the coastal package, already credited above. Three material maps remain in use per equipment surface; textures are embedded/shared for offline and file:// play. Original generated leather/linen images remain solely as local fallback data.

V hedef portreleri (`assets/ui/target-damned.webp`, `target-verdictseer.webp`, `target-voidcrawler.webp`, `target-chainjailer.webp`, `target-verdictwarden.webp`, `target-lastjudge.webp`), `src/finale-models.js` içindeki gerçek oyun modellerinden oyunun kendi çiziciyle hazırlanmıştır. Yukarıdaki karakter, hareket ve kaplama lisansları geçerlidir; yeni dış kaynak yoktur. Bölüm V seslendirmesi (`src/narration-finale.js`) `tools/gen_finale_voices.py` ile edge-tts (Microsoft neural sesler) üzerinden üretilmiştir, diğer anlatıcı dosyalarıyla aynı yöntem.

#### Cormorant SC (Bold) — oyun adı yazısı
- Tasarımcı: Christian Thalmann (Catharsis Fonts). Kaynak: https://github.com/CatharsisFonts/Cormorant · Telif: Copyright 2015 The Cormorant Project Authors. Lisans: SIL OFL 1.1 (https://openfontlicense.org). Yalnızca Latin harfleri ve Türkçe karakterleri içeren küçültülmüş (subset) kopya `src/ui-gothic.css` içine gömülüdür; harf şekilleri değiştirilmemiştir.
