# Kabir Azabı — görsel kaynaklar

Oyunun kaynak kodu ve bu dosyada adı geçen üçüncü taraf görsel içerikler ayrı lisanslara sahiptir. Aşağıdaki kaynaklar 28 Eylül 2026 tarihinde edinildi; değiştirilmiş oyun sürümleri `assets/characters/characters.js`, `assets/characters/authored-clips.js` ve `src/materials.js` içinde gömülüdür.

## Karakterler — thecubber / OpenGameArt

**Model by thecubber, commissioned by the OpenGameArt.org community (https://opengameart.org).**

- [Rigged Textured Barbarian](https://opengameart.org/content/rigged-textured-barbarian)
- [Rigged Textured Executioner](https://opengameart.org/content/rigged-textured-executioner)

Her iki eser için sunulan alternatifler arasından **[Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/)** seçilmiştir. [Lisansın tam metni](https://creativecommons.org/licenses/by/3.0/legalcode).

Yapılan değişiklikler: eski Blender malzemelerinin glTF/PBR dönüşümü, normal haritası yönünün düzeltilmesi, renk/pürüzlülük ayarı, isteğe bağlı mavi boya katmanlarının kaldırılması, sakal/bıyık eklenmesi, beden yüzeyinin yumuşatılması, farklı düşman oranları/kostümleri ve başka bir iskeletin animasyonlarının uyarlanması. Kaynak sanatçının bu oyunu desteklediği ima edilmez.

Karakter ayrıntı geçişi 2: Bu sürümde barbar ve cellat modellerinin renk ve normal haritaları kaynaktaki 2048 px çözünürlükte bırakılıp WebP olarak yeniden kodlandı (ortam örtüşmesi 512 px). Renk haritasının alfa kanalına derleme sırasında bir deri maskesi yazıldı; saydamlık için değil, deri gölgelendirmesi için kullanılır. Geometri sıkıştırıldı. Aşınma, kir, pas, kan, yara izleri ve bütün zırh, kumaş, kürk ve silahlar oyunun kendi koduyla eklenir.

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
pizzicato ve katedral yankısı gibi tek vuruşluk sesler, kodun içindeki matematiksel tariflerle (kısmi titreşimler,
süzülmüş gürültü, Karplus-Strong tel modeli) ilk karelerde hesaplanır; drone, alçak erkek korosu (formant süzgeçleri),
yaylılar/çello, bakır nefesliler ve boğaz şarkısı sesleri canlı osilatörlerdir.

- Besteci / ses tasarımı: bu proje için Claude (Anthropic) tarafından, oyunun sahibinin isteğiyle yazıldı.
- Lisans: oyunun kendi kaynak koduyla aynı koşullar (üçüncü taraf lisans yükümlülüğü yoktur, atıf gerekmez).
- Test araçları (yalnızca geliştirme sırasında, oyuna dahil değil): Google Chrome headless `OfflineAudioContext`
  ile sessiz ölçüm render'ları. Hiçbir ses dinlenmedi veya çalınmadı.

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

Yapılan değişiklikler (hepsi `tools/gen_narration.py` içinde, yeniden üretilebilir): mono'ya indirme, baş/son sessizliğini kırpma, kesit alma, bant hızıyla perde ve süre değiştirme (`rate`), rubberband ile perde kaydırma (sesler, yaratıklar ve kahramanın zorlanma sesleri 1,5–5 yarım ton pes), yüksek/alçak geçiren süzgeç, sönüm, tepe seviyesinin −1 dBFS'ye getirilmesi; ardından parçalar üç mono MP3 "sprite" dosyasında birleştirildi (16 kHz/24 kbps, 22,05 kHz/32 kbps, 32 kHz/48 kbps) ve base64 olarak `src/narration.js` içindeki `BABA.SoundBank` nesnesine gömüldü (yaklaşık 290 KB). Oyun dosyadan (file://) açılırken hiçbir harici ses dosyası ya da sunucu kullanılmaz. İndirilen paketler proje dışında önbellekte tutulur (`KARA_AUDIO_CACHE` ya da `~/.cache/kara-gecit-audio`).

Müzik, ortam sesi, kılıç rüzgârı, darbe gövdesi, metal çınlaması, uyarı ve arayüz sesleri üçüncü taraf kayıt değildir; `src/audio.js` içinde Web Audio ile gerçek zamanlı sentezlenir. Kılıç darbelerinin çelik ısırığı, et tokadı, gövde vuruşu, alt gümbürtü, metal çınlaması, kan spreyi, blok şangırtısı ve savuşturma tıngırtısı katmanları da aynı dosyada, açılışta düz JavaScript ile (gürültü, süzgeç ve sönümlü sinüsler) hesaplanır; yeni kayıt, örnek veya indirilen dosya yoktur.

## Anlatıcı ve tarikatçı ilahileri — sentez konuşma

Anlatıcı cümleleri ve Kül Rahibi ilahileri (`chant1–3`) Microsoft Edge metin-okuma hizmetinin `tr-TR-AhmetNeural` sesiyle, açık kaynaklı `edge-tts` istemcisi aracılığıyla üretildi; üçüncü taraf bir ses kaydı değildir. Kayıtlar ffmpeg ile işlendi (perde ve formant düşürme, göğüs/anlaşılırlık eşitlemesi, sıkıştırma, çok hafif fısıltı katmanı, ölçülü taş oda yankısı, −16 LUFS eşitleme; ilahilerde üç sesli koro katmanı) ve MP3 olarak `src/narration.js` içinde `BABA.Narration` olarak gömüldü. Bu çıktılar açık lisanslı içerik olarak sunulmaz; kullanımları Microsoft'un hizmet koşullarına tabidir. Metinler oyuna özgüdür ve `tools/gen_narration.py` içindeki `LINES` / `CHANTS` tablolarındadır.

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
  saçılması, karakterlere özel kenar/dolgu ışığı, karakter altı temas gölgesi, Adak Ayini / Sessiz Şapel / Zincir Mahkemesi
  ışık senaryoları. Bu oyun için yazıldı. Sis parçaları three.js'in `fog_*` shader parçalarının yerine geçer; o parçaların
  yapısı three.js kaynak kodundan türetildi (**MIT**, three.js authors, tam metin `vendor/THREE-LICENSE.txt`).
- `src/post.js` — HDR sahne hedefi, ortam örtüşmesi (SAO), bloom, ısı dalgası, ton eğrisi, oda renk ayarı, vinyet, FXAA,
  film greni. Kod bu oyun için yazıldı; izlenen yöntemler herkese açık yayınlardan: Scalable Ambient Obscurance
  (McGuire, Mara, Luebke 2012), 13 örnekli küçültme + çadır filtreli büyütme bloom zinciri (Jimenez 2014, "Next Generation
  Post Processing in Call of Duty: Advanced Warfare"), FXAA (Timothy Lottes; three.js examples `FXAAShader` ile aynı fikir,
  **MIT**). ACES ton eğrisi yaklaşımı (Stephen Hill), three.js `ACESFilmicToneMapping` ile birebir aynı sayılarla
  (**MIT**, three.js authors).
- `src/world.js` — pencere, ızgara, çatlak ve tavan gözü (oculus) ışık desenleri, temas gölgesi diski ve damla halkaları
  harici görsel kullanmadan açılışta tuvalde / shader'da çizilir; bu oyun için yazıldı.

Oyun sırasında hiçbir harici sunucuya bağlanılmaz; dosyadan (file://) açılış desteklenir.
