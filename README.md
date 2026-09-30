# KABİR AZABI
## Bölüm I — Kurban Tapınağı

Yetişkinlere yönelik, bağımsız bir karanlık fantezi aksiyon RPG bölümü. Yoğun şiddet, kan ve korku teması içerir. Feza oyunlarıyla kayıt veya dosya paylaşmaz.

Bahtiyar ile Kurban Tapınağı'nın mühürlü salonlarında ilerle, düşmanların saldırılarından yuvarlanarak kaç ve iki aşamalı Zincir Celladı ile yüzleş. Türkçe konuşmalar, karanlık zindanlar, fareyle hareket ve iki özel yetenek içeren üç boyutlu bir macera.

**[Tarayıcıda oyna](https://goktugkarpat.github.io/bahtiyar-kabir-azabi/)** · [Kaynaklar ve lisanslar](ASSET-LICENSES.md)

## Nasıl açılır

- **İnternette:** [oyun bağlantısını](https://goktugkarpat.github.io/bahtiyar-kabir-azabi/) aç. Hesap veya oyun kurulumu gerekmez. Masaüstü bilgisayar önerilir.
- Mac: `OYNA.command` dosyasına çift tıkla. Oyun hazır olduğunda varsa Microsoft Edge açılır; başlangıç hatasında terminaldeki mesaj korunur.
- PC/Mac: `index.html` doğrudan tarayıcıda açılabilir. Kurulum gerekmez.
- **iPad'de uygulama gibi:** Safari'de oyun bağlantısını aç, Paylaş › **Ana Ekrana Ekle** seç. Oyun kendi simgesiyle tam ekran açılır; yatay ekran önerilir. İlk başarılı çevrimiçi açılış ve dosyaların kaydedilmesinden sonra internetsiz de çalışır.
- Tablet: `python3 serve.py` çalışırken aynı Wi-Fi üzerindeki bilgisayarın IP adresine `http://BILGISAYAR-IP:8787` ile bağlan. Yatay ekran önerilir.
- Yerel adres: `http://localhost:8787`.

## Nasıl oynanır

| İşlem | Fare / klavye |
|---|---|
| Yürü | Yere sol tıkla; basılı tutarak yön ver |
| Hafif / ağır vur | Düşmana sol / sağ tıkla |
| Yerinde vur | Shift + tık |
| Kaçın | Space |
| Zincir Girdabı / Kan Öfkesi | 1 / 2 |
| Can iksiri / yemin taşı | Q / E |
| Mola / yardım | Esc / H |

**Amaç:** Salondaki düşmanları yenerek çıkış mührünü aç, şapeldeki yemin taşına ulaş ve Cellat'ı yen. Can biterse son kontrol noktasına dönersin. Saldırının ışığı dolmadan yuvarlan; kızıl işaretli ağır darbelerden özellikle kaçın. Harita yolu gösterir, üst ortadaki portre vurduğun düşmanın canını gösterir. Etkin yeteneklerin kalan süresi alttaki yetenek barının üstündedir.

Tuş atamaları, ses, altyazı ve görüntü seçenekleri Ayarlar'dan değiştirilebilir. `?sessiz` ile ses kapalı açılır.

Kontroller (Diablo IV gibi): Klavyeyle yürünmez: hareket fareyle (tıkla-yürü); Space yuvarlanması fare imlecine doğrudur. **Sol tık bir düşmana**: kahraman ona koşar ve hafif kombo ile vurur; tuşu basılı tutarsan vurmaya devam eder (fare başka düşmanın üstüne kayarsa hedef değişir); düşmanın ayağında ince kor halkası yanar. **Sol tık boş yere**: oraya yürür (basılı tutarsan fareyi izler); boşa kılıç savurmaz. **Sağ tık bir düşmana**: ona ağır vurur (boşluğa sağ tık bir şey yapmaz). **Shift + tık**: yürümeden, fareye doğru vurur (boşluğa vurmanın tek yolu); Shift tek başına bir şey yapmaz. Yuvarlanmak düşmana koşmayı iptal eder. J/K: önündeki, yakın düşmana hafif/ağır vurur (yoksa bir şey olmaz). 1 Zincir Girdabı, 2 Kan Öfkesi (savaş narası), Space kaçınma (yürüdüğün yöne; yürümüyorsan fareye doğru), Q iksir, E etkileşim, Esc mola, H kontrol yardımı. Blok ve savuşturma yok: her darbeden Space ile yuvarlanarak kurtulursun. Tuşlar Ayarlar/Kontroller › Tuş atamaları ekranından değiştirilebilir (her işlem için ana + yedek tuş; "Yerinde vur" düzenleyici tuşu Shift; saldırı/kaçınma/iksir/öfke/özel yetenek için fare tuşları da seçilir; çakışan tuş yer değiştirir; Esc ve H sabit; ayar `karaGecit.settings.v2` içindeki `binds` alanında saklanır; HUD tuş etiketleri ve Kontroller yardımı güncel atamayı gösterir). Yalnızca `.` tuşu ölçüm göstergesini açıp kapatır; her açılışta gizlidir. FPS, kare aralığı, işlemci hesaplama/çizim gönderimi, ekran kartı sahne/efekt süreleri, gerçek MSAA, çizilen piksel boyutu ve kullanılan ekran kartı adı gösterilir. Tarayıcı GPU ölçümünü desteklemiyorsa bu açıkça yazılır. **Ölçümü indir** düğmesi yerel `kabir-performans.json` raporu üretir; ortalamaların yanında en uzun kare aralıklarını ve ölçüm boyunca görülen en ağır 20 aralığı saklar; hiçbir sunucuya göndermez. Yeni oda verileri yükleme ekranında ekran kartına hazırlanır. Ayrıntılı rapor gölge, ana görüntü ve efekt çizimlerini ayırır; duraklama sırasında yeni görüntü verisi hazırlanıp hazırlanmadığını da kaydeder. Ölçüm açıkken ekran kartı süresi 100 ms aralıklarla örneklenir; kare aralıkları her çizimde kaydedilir. GPU süreleri ana görüntüyü ölçer; arayüzün ayrı çizimi ve ekran sunumu dahil değildir. CPU ve GPU aynı anda çalışır; süreleri toplanmaz.
Masaüstü alt çubuğunda soldan sağa: **Zincir Girdabı (1) → Kan Öfkesi (2) → Kaçınma (Space) → Hafif saldırı (sol tık) → Ağır saldırı (sağ tık)**. Can iksiri (Q) ayrı şişe düğmesinde kalır. Bu etiketler varsayılan tuşlardır; kişisel tuş atamaları ekranda gösterilir.

Gamepad: sol çubuk hareket; X hafif, Y ağır (önündeki yakın düşmana, yoksa vurmaz); sağ çubuk + X/Y yerinde vurur (çubuğun yönüne); A kaçınma, LB Zincir Girdabı, B iksir, RB öfke, Start mola.
Tablette bir düşmana dokun: ona koşar ve vurur (parmağı basılı tutarsan sürer); yere dokun: oraya yürür; sol çubuk da yürütür; sağ düğmeler en yakın düşmana vurur (yakında düşman yoksa bir şey olmaz); üstte mola, altta iksir/öfke.
Arayüz boyutları: alttaki beceri çubuğu, tuş etiketleri ve iksir sayısı büyük; can ve dayanıklılık küreleri çubuktan biraz büyük (yaklaşık iki beceri yuvası boyunda) ve içlerinde altın renkte "şimdiki / en çok" sayısı vardır; mini harita çerçevesi, portre çerçevesi ve yuvarlak düğmeler (mola, dokunmatik savaş düğmeleri, kapatma) de küreler gibi ince, kararmış demirden yapıldı. Portre, mini harita ve yazılar büyütüldü. Arayüz ekran yüksekliği 982 pikseli aşınca ekranla birlikte büyümeye devam eder; Ayarlar > Görüntü > **Arayüz boyutu** (Küçük 0,85× / Normal / Büyük 1,25×) bunu ayrıca çarpar. Yalnızca görünüm değişti, oynanış aynı.

Saldırı uyarıları ("Kor ve Kül"): önce saldıranın gövdesinde ve silahında bir kor ışığı belirir, sonra darbenin ineceği yerde yerde ışık birikir ve darbenin gideceği yöne doğru dolar. Işık alanı doldurduğunda darbe iner; son anda kısa bir parlama olur. **Altın kenarlı** işaretler sıradan darbedir: kaçabilirsen kaç, istersen vurup değiş tokuş et. **Kızıl kenarlı** (içinde soluk bir çizgi ve içe çekilen kıvılcımlar olan, çan sesiyle gelen) işaretler ağır darbedir: mutlaka kaçınman gerekir. Blok olmadığı için ikisinden de Space ile yuvarlanarak (ya da yerinden çıkarak) kurtulursun. Bu kural her grafik ayarında ve boss'un ikinci aşamasında da aynıdır. Alan işaretleri yanan zemin gibi yumuşak, gürültülü kenarlı bir ışıktır (altın: sıradan, kızıl: ağır, kaç; kutu çerçevesi yok). Sıradan vuruşlar (pençe, balyoz, biçme...) için yerde hiç işaret çıkmaz: yalnızca saldıranın hareketi ve gövde/silah kor ışığı vardır; kaçılması gereken, uzaktan gelen ve özel yetenek vuruşlarının işareti kalır. Ekran dışından gelen ağır vuruşlarda ok yanında "DİKKAT" (altın) / "KAÇIN" (kızıl) etiketi ve saldırı adı görünür.

Kaçınmanın koruma süresi yuvarlanmanın neredeyse tamamıdır (0,48 saniyenin ilk 0,45'i); gecikmiş kaçınma hasarı geri almaz. Kaçınma 20 dayanıklılık yer. Ağır saldırı gardı kırar; yaklaşık 0,7 saniyede biter (vuruş 0,35. saniyede). **İksir (Q) anında içilir:** can hemen dolar, baba kilitlenmez, saldırı/kaçınma sırasında da kullanılabilir; art arda çift basış tek iksir harcar. Düşmanlar saldırı yönünü uyarıdan sonra keyfî değiştirmez.

Hafif vuruş **4**, ağır vuruş **8**, kaçınma **20** dayanıklılık harcar. Dayanıklılık esas olarak kaçınma ve yetenekler içindir. **1 — Zincir Girdabı:** 45 dayanıklılık, 8 saniye bekleme. **2 — Kan Öfkesi:** 45 dayanıklılık, 24 saniye bekleme. İkisi de sağdaki dayanıklılık küresinden harcar; düğmelerin üstünde maliyetleri ve kalan bekleme saniyeleri görünür. Kan Öfkesi etkinken simge yanar; alttaki düğmede yeniden kullanımın büyük sayacı bulunur.

Etkin süreli etkiler alttaki yetenek barının hemen üstünde küçük kare kutular olarak yan yana görünür. Kan Öfkesi kutusunda kalan saniye yazılır; son 3 saniyede yanıp söner ve süre bitince kaybolur. Azaltılmış hareket seçiliyse yanıp sönmek yerine sabit bir vurgu gösterilir. Aynı alan ileride birden fazla süreli etkiyi de gösterebilir.

Süre simgenin altında görünür; simgeyi örtmez. Saldırdığın düşmanın portresi ve adı üst ortada çıkar; can çubuğunun içinde kalan ve toplam can yazılır. Başka düşmana saldırınca gösterge ona geçer; yalnız fareyi üstüne götürmek hedefi değiştirmez. Bütün düşman türleri ve Cellat bu alanı kullanır. Düşmanların başının üstündeki ince can çizgileri de sürer.

Portreler ve ilk tıklamada kullanılan küçük hedef/yürüme halkaları yükleme ekranında hazırlanır. Süreli etki kutuları ile hedef göstergesi yan yana sığar; telefonda ilk etki çıkınca hedef göstergesi yer değiştirmez. Resim yüklenemese bile düşmanın adı ve canı gösterilir.

2 ile **savaş narası** atılır (basıştan yaklaşık 0,2 saniye sonra dalga çıkar, toplam yaklaşık 0,4 saniye sürer, yürümeye devam edilir; bu kısa sürede gelen darbeler yarıya iner): yerde bir şok dalgası yakındaki düşmanları sendeletir (henüz inmemiş uyarıları bozulur), uzaktakiler bir an sinip durur, cellat irkilir. Ardından 11 saniye boyunca Bahtiyar %48 daha sert vurur, %25 daha az hasar alır ve engellenmeyen vuruş hasarının %4'ünü can olarak geri kazanır; biraz daha hızlı yürür ve dayanıklılığı daha çabuk dolar. Gözleri ve kılıcı kor gibi yanar. Ayrı bir öfke kaynağı biriktirilmez; yetenek kullanılırken dayanıklılık geri verilmez.

## Bölüm

Kül Eşiği → Zincir Nöbeti → Çürüyenlerin Duası → Adak Ayini → Kemik Geçidi → Sessiz Şapel → Zincir Mahkemesi.

Beş normal düşman türü, 30 normal düşman ve iki aşamalı Zincir Celladı. Her salonun çıkış mührü o salondaki düşmanlar yenilince açılır. İlk bölüm için hedef 7–8 dakika; oynama tarzı ve ölümler süreyi değiştirir. Uyarılara neredeyse kusursuz tepki veren otomatik savaş testi yaklaşık 4 dakikadır; bu insan oynanış süresi ölçümü değildir.

Düşmanlar özel yeteneklerini daha sık kullanır; iki özel yetenek arasında en az bir sade vuruş yaparlar. Sürüm 60'a göre normal düşman canı yaklaşık %26, Cellat canı %24 ve düşman hasarı %45 artırıldı. Hepsi daha hızlı yaklaşır; saldırı araları kısaldı. Normal vuruşlarla sendeletildiğinde daha çabuk toparlanır, art arda tekrar sendeletmeye daha uzun direnç gösterirler. Uyarı süreleri, kaçınma ve oyuncu yeteneklerinin hasar/maliyetleri korunur. Ayrıntı ve ölçümler DESIGN.md'de.

Yalnızca başlangıç ve boss öncesindeki yemin taşı kontrol noktasıdır. Yemin taşı tarayıcının yerel kaydına yazılır. Ölümde can/iksirler ve ilgili düşmanlar kontrol noktası durumuna döner. Menüden yeni yolculuk bu oyunun kaydını sıfırlar. Eşya/altın ekonomisi ilk bölüm prototipinde yoktur.

## Grafik ve ses

Ayarlar masaüstü bilgisayar kullanımına göre düzenlendi. İlk açılışta PC'de **Grafik kalitesi: Yüksek**, Mac'te **Orta**; **Görüntü boyutu: Otomatik**, MSAA **kapalı** seçilir. Otomatik, normal ekranı doğal boyutta; Retina gibi yoğun ekranı seçilen kaliteye uygun daha küçük boyutta çizer. Menü ve yazılar net kalır. **Tam boyut** açıkça seçilirse bütün ekran pikselleri kullanılır; bu seçim kalite düşürülünce de korunur. Pencere büyütülünce veya başka bir ekrana taşınınca çizim boyutu yeniden hesaplanır.

**Düşük**, sisin ayrıntısını ve parıltı işlemlerini azaltır; gölgeleri kapatır. Otomatik görüntü boyutunda Retina yükü de azalır. **Orta**: ana gölge boyutu 1536, çevre ışığı sayısı 5, savaş efekti bütçesi 500 ve cesetlerin kalma süresi 68 saniyedir. Ayrıntılı yüzeyler ve sıcak hava dalgalanması korunur. **Yüksek**: ana gölgeler 2048, çevre ışıkları 6, savaş efekti bütçesi 650 ve ceset süresi 90 saniyedir; meşale ve pencere gölgeleri 1024, ortam gölgesi ve parlama daha ayrıntılıdır. Ana gölge Yüksek'te saniyede en fazla 60, Orta'da 30 kez yenilenir; çevre gölgeleri ayrı karelere dağıtılır. Yüksek ayarın yüzey ve gölge çözünürlükleri korunur.

**Görüntü boyutu** yalnız üç seçenek sunar: **Otomatik, Tam boyut ve Akıcı**. Akıcı, Otomatik'in genişlik ve yüksekliğini %25 azaltır; Retina'da da Otomatik'ten daha hafiftir. MacBook için hedef **Orta + Otomatik + 60 FPS + MSAA kapalı** ayarında akıcı oyundur. Orta'nın ayrıntılı yüzeyleri korunur. Önceden seçilmiş tam çözünürlük korunur; önceki Daha akıcı seçimi Akıcı olarak devam eder. **Güçlü bilgisayarlar için** bölümünde **MSAA: Kapalı / 2× / 4×** seçilebilir. `.` göstergesi gerçek çizim boyutunu ve gerçekten kullanılan kenar yumuşatmayı gösterir.

**Kare hızı** yalnız **60 veya 120 FPS** seçeneği sunar. PC'de başlangıç seçimi 120, Mac'te 60 FPS'tir. Eski sınırsız/144 seçimleri 120'ye geçer. Gerçek hız bilgisayara, ekran yenilemesine ve tarayıcıya bağlıdır. Seçimler bu cihazda saklanır; önceki ses, parlaklık, altyazı ve tuş atamaları korunur. Görüntü boyutu kalite veya pencere boyutu değişince hesaplanır; savaş sırasında FPS düştü diye kendiliğinden değişmez.

Görüntü hesapları yalnızca çizilecek karelerde yapılır; hareket, saldırı ve ses zamanları kendi sürelerini korur. Can ve dayanıklılık göstergeleri aynı çizim döngüsünü kullanır. Kare sınırlayıcı ekran zamanlamasındaki küçük oynamalara uyum sağlar; uzun duraklamalardan sonra birikmiş görüntüleri arka arkaya çizmez. Bu düzenleme çözünürlüğü, grafik kalitesini veya seçilen MSAA değerini azaltmaz.

Destekleyen ekran kartlarında aynı malzemeli sabit dünya parçaları birlikte çizilir; görünmeyen parçalar her kamera ve gölge için ayrı ayıklanır. Görüntü ayrıntıları, MSAA, çözünürlük ve kare sınırı değişmez. İlk öldürmede gereken kesim hazırlıkları, pencere ışık maskeleri ve darbe izleri yükleme ekranında tamamlanır. Hasar yazıları, parlamalar, düşman silah izleri ve kaçınma kopyaları aynı çizim kaynaklarını tekrar kullanır. Değişmeyen can yazıları yeniden oluşturulmaz; sabit ses hedefleri her karede tekrar gönderilmez. Aynı kişiye 120 ms içinde gelen hasarlar tek toplam sayı olarak görünür; farklı kişilerin hasarları birleşmez ve eski rakamlar sonraki yazıda kalmaz. Vuruş anında etkiyi güçlendiren kısa duruşlar azaltıldı; sıradan vuruşun vurgusu artık 12 ms, ağır vuruşunki 20 ms'dir. Hareket ve yetenekler bu kısa duruşlarda gelen tuşları da korur.

**Parlaklık** ve **Arayüz boyutu** (Küçük / Normal / Büyük) ayrıca ayarlanır; kamera sarsıntısı ve darbe vurgusu sabittir, azaltılmış hareket tercihinde kapanır. Ses: Ana ses, Müzik, Efektler, Anlatıcı ve Altyazılar (ayarlar açıkken ses duyulmaya devam eder, böylece seviyeler denenebilir). Hiçbir görüntü ayarı düşman sayısını veya saldırı zamanlamasını değiştirmez. **Düşük** karakter kaplamalarını yarı boyutta yükler; bu kısım oyun yeniden açılınca geçerli olur. Yükleme ekranı gölgelendiricileri (shader) önceden hazırlar; grafik kalitesi değişince kısa bir "Grafik hazırlanıyor…" ekranı aynı işi yapar.

Ses bir kullanıcı etkileşiminden sonra başlar. Müzik bu oyun için bestelenmiştir ve tarayıcıda çalınırken üretilir (`src/music.js`): salona, dövüşe ve Cellat aşamalarına göre değişir. Bahtiyar'ın yemini, şapelde ve finalde tekrar duyulan özgün bir demir tel melodisiyle bağlanır. Darbe, zincir, yaratık ve adım sesleri CC0 paketlerden işlenmiş kayıtlardır; uyarı çanı, rüzgâr ve arayüz sesleri Web Audio ile üretilir. Kılıç sesleri ilk yüklemede hazırlanan çelik, gövde ve alt gümbürtü katmanlarıyla güçlendirilir; vuruştan vuruşa küçük perde ve seçim farkları vardır. Zindan ortamında seyrek boğuk çığlık, inilti, hıçkırık, zincir, kırbaç ve uzak çekiç duyulur. Çığlıklar dört oyuncunun canlandırma kayıtlarından işlenmiştir. Zincir Nöbeti ve Adak Ayini'nde daha yakın, Zincir Mahkemesi'nde sessizdir; savaş ve konuşma sırasında azalır. Efektler yükleme ekranında hazırlanır. 14 Türkçe kayıt tr-TR-AhmetNeural ile bütün cümleler halinde, hafif tempo/ton farklarıyla seslendirilmiştir. Anlatıcı, Bahtiyar ve Zincir Celladı konuşmaları sırayla çalar; altyazı konuşmacıyı gösterir. Müzik ve ortam konuşmalara ve saldırı uyarılarına yer açar. Ses seviyeleri ve altyazı ayrıca ayarlanır. `?sessiz` hiçbir ses bağlamı oluşturmaz; geliştirme testlerinde zorunludur.

## 30 Eylül — sürüm 61

Düşman hasarı ve saldırı baskısı belirgin artırıldı. Canları yükseldi, özel saldırıları daha sık kullanırlar; normal vuruşlarla sürekli kilitlenmeye daha dayanıklıdırlar. Cellat daha hızlı yaklaşır ve daha kısa aralıklarla saldırır. Küçük uyarı mesajları sol kenara alındı; anlatıcı/ipucu yüksekliğine göre üstte ayrı yer tutar, metinleri örtmez.

## 30 Eylül — sürüm 60

Düşmanlar yeteneklerle hemen ölmesin diye canları yeniden artırıldı. Cellat'ın hareketi, normal vuruşları ve vuruş araları hızlandırıldı. Kan Öfkesi ve ilerideki diğer süreli etki simgeleri yetenek barının hemen üstünde dizilir; süreler simgelerin altında kalır. Altyazı ve ipucu bu alanı örtmez.

## 30 Eylül — sürüm 59

Başlayan anlatıcı cümlesi oda değişse, savaş başlasa veya final gelse de tamamlanır. Henüz başlamamış eski oda cümleleri yeni odanın konuşmasına yer bırakır. Saldırı ya da kaçınma sırasında basılan uygun Girdap, o hareket bitince çalışır; sırada olduğu alt çubukta yazılır. Kan Öfkesi normal saldırıyı kesip başlayabilir, kaçınma bitene kadar basışı korur. İksir saldırı ve kaçınma sırasında hemen kullanılır. Dayanıklılık veya bekleme süresi yeterli değilse neden açıkça gösterilir. İki yetenek ortak dayanıklılık kaynağı ve ayrı bekleme süreleri kullanır; normal vuruşların maliyeti azaltıldı.

Gölgeler her yüksek hızlı karede tekrar çizilmez; sabit dünya parçalarının değişmeyen hesapları tekrar kullanılır. Son sürüm RTX 5080'de, 2560×1440 Yüksek ve gerçek 4× MSAA ile, ölçüm göstergesi kapalı altı dakikalık sessiz savaş denemesinde ortalama 118,8 FPS verdi. 25 ms'yi aşan kare aralığı görülmedi; ilk tıklamalar ve yetenekler dahil yeni doku, geometri veya çizim programı oluşmadı. Daha önceki, ayrıntılı ölçüm ve izleme açık yaklaşık 12 dakikalık deneme ortalama 117,4 FPS verdi; ara sıra kısa takılmalar sürdü. Ölçüm aracının ağır okumaları bazı gecikmelerin hemen öncesine denk geldi, fakat bu bütün gecikmelerin nedenini açıklamıyor. Oyun çizilmeyen boş tarayıcı denemesinde de tek büyük gecikme görüldü. Bu sonuçlar bütün bilgisayarlarda takılmasız oyun garantisi değildir. Önceki 130,5 → 180 ölçümünde salon düşmanları etkin değildi; o sonuç aktif savaş karşılaştırması sayılmaz. Mac hedefi Orta + Otomatik + 60 FPS'tir; Retina çizim yükü azaltıldı, ancak bu sürüm gerçek M4 üzerinde henüz ölçülmedi. Önceden kaydedilmiş Tam boyut seçimi korunur; eski ayarlar kayıtlıysa Otomatik ayrıca seçilmelidir.

Gerçek FPS göstergesi ve ekran kartı ölçümü açıkken yapılan sekiz dakikalık son savaş denemesi ortalama 119,4 FPS verdi. 25 ms üzerinde üç kısa aralık, 50 ms üzerinde sıfır aralık görüldü; çizim kaynakları sabit kaldı. Bu deneme de bütün cihazlarda kusursuz akıcılık garantisi değildir. Gerçek tarayıcıda bağlantı kesilerek yeniden açılan oyun, altı düşman portresi ve süreli etki göstergesi çalıştı; önbellek yenilenirken başka oyunun dosyaları korundu.

Anlatıcının daha doğal kayıtları için üretim ayarları hazır: yapay konuşma yankısı kaldırılıyor ve sorunlu okunan sözcükler sadeleştiriliyor. Bu çalışma ortamında ses servisine erişim ve gereken araçların indirilmesi ağ onayını bekliyor. Yeni 14 kayıt henüz üretilmedi; oyundaki mevcut kayıtlar korunuyor.

`node tools/verify-ability-input.cjs` yetenek sırasını, açık ret nedenlerini ve eksik/bozuk kaçınma yönlerini farklı kare hızlarında kontrol eder. `node tools/verify-display.cjs` Retina boyutlarını, kayıt geçişlerini ve kare sınırlamasını kontrol eder. `node tools/verify-narration.cjs` başlayan cümlenin tamamlanmasını ve konuşma sırasını gerçek ses açmadan denetler. `node tools/verify-buffs.cjs` birden fazla süreli etkiyi, sayaçları ve biten kutuların temizlenmesini; `node tools/verify-shadow-budget.cjs` gölge işlerinin farklı ekran hızlarında dağıtılmasını kontrol eder. Bunlar ekran kartı performansı ölçmez.

`node tools/verify-combat-prewarm.cjs` ilk tıklama hazırlığının oyunu değiştirmediğini, aynı halkaların tekrar kullanıldığını ve ölüm/yeniden başlamada eski yürüme işaretinin temizlendiğini denetler.

## 30 Eylül gece geliştirmesi — sürüm 47–49

Engellerin arkasındaki hedeflere ve düşmanlara güvenli yol bulma eklendi; kapalı mühürlerin arkasına vurulmaz. Özel saldırıların bekleme süresi bilgisayarın hızına göre değişmez. Salon temizlenince sonraki hedef yazılır; görev satırı kalan düşmanları, kapıyı ve yemin taşını takip eder. İksir, iki yetenek, Cellat'ın iki evresi, ölüm, kontrol noktası ve yeni yolculuk akışları birlikte denetlendi.

Uzun saldırıların yerdeki ışığı gerçek vuruş alanıyla aynı genişlik ve uzunluktadır. Oyuncunun bedeni bu alana değmiyorsa dış köşelerden hasar almaz. Ağır darbelerin içeri çekilen kızıl zerreleri de doğru yerden başlayıp merkeze gider.

Yürürken yön değişimindeki ani bacak dönüşleri düzeltildi. Cellat'ın zinciri sabit fizik adımlarıyla farklı kare hızlarında tutarlı hareket eder. Zincir Girdabı'nın uçları ayrıntılı demir kancalar oldu; ikinci evre pas/kızıl dalgalar ve yükselen korlarla ayrılır. Alan saldırılarının parçacıkları bütün kalite seviyelerinde tam halka çizer. Bahtiyar'ın arayüz portresi gerçek modelin önceki portresine dayanarak ImageGen ile yeniden resmedildi; bu, yeni bir 3D model değildir.

Oyun kumandasında hassas küçük hareket, çapraz yön ve tuş kenarları düzeltildi; bağlantı kesilirse oyun durur. Görüntü bağlamı kaybolup geri gelirse oyun duraklar, görüntü biçimleri ve MSAA desteği yeniden denetlenir, kaynaklar hazırlanır ve oyuncu devam eder. Büyük arayüz seçeneği tekrar kullanılabilir. Düşük can vurgusu sürekli gölge hesaplamak yerine saydamlıkla canlandırılır.

Doğrulama: gerçek karakter geometrileri/hareketleri, engeller ve dövüş akışları CPU üzerinde; kaynak temizliği ve görüntü kurtarma sahte çizim bağlamlarında; ses ise gerçek offline Web Audio ile kontrol edildi. On dakikalık ses yaşam döngüsü örneğinde sayısal hata, taşma veya kuyruk birikimi bulunmadı. Bunlar yeni tarayıcı/GPU ölçümü veya bütün bilgisayarlarda sabit FPS garantisi değildir. `node tools/verify-release.cjs` dosyaların varlığını, JavaScript sözdizimini, simgeleri ve çevrimdışı sürüm uyumunu kontrol eder; paket kurulumu gerekmez.

`node tools/verify-gameplay.cjs` gerçek harita ve modellerle kapılar, engel etrafından yürüme, yetenekler, iksir, hasar sayıları, farklı kare hızlarında saldırı beklemesi, patron evreleri, kayıt, ölüm ve yeni oyun akışlarını denetler. Çizim ve ses çıkışı kullanmaz; FPS ölçmez.

Sürüm 48'de karakterlerin eski pozunun her kare yeniden hesaplanan ikinci taraması kaldırıldı. Ayak kilitleri, temaslar, iskeletler, zincirler ve silah izleri eski sürümle birebir korunuyor. Üçer CPU karşılaştırmasında oyun işlemi %10,5–12,6, kalabalık sahnelerde ölçülen toplam CPU işi yaklaşık %8 azaldı; tarayıcı/GPU süresi ölçüme dahil değildir. Kalite değişiminde grafikler hazırlanırken erken devam edilmesi de engellendi: dövüş duraklar, hazırlık bitince oyuncu devam eder. Ayarlardaki ses davranışı korunur.

Sürüm 49'da Esc basılı tutulunca oyunun kendiliğinden devam etmesi, ölüm/final ekranından önce can ve sayaçların eski kalması, kişisel tuş atamalarındaki yanlış açıklamalar ve yeniden başlarken kaybolan dayanıklılık uyarısı düzeltildi. Tıklayarak yürümeyi kaldıran bir tuş atamasına izin verilmez; eski böyle bir kayıt varsa bir fare tuşu geri eklenir. Karakteri örten kemerlerin saydamlık ayarı yüklemede hazırlanır; başlığa dönünce kemerler ve kızıl savaş örtüsü normale döner. Üçüncü ölüm konuşması artık yanlış düşman adı söylemez. Finalden hemen yeni yolculuğa dönülürse final melodisinin sonraki notaları yeni oyuna karışmaz.

Sürüm 50'de ekran dışındaki tehlike okları gerçek saldırı süresini izler: gecikmeli saldırı henüz başlamadan gösterilmez, duraklatmada zamanı korunur ve iptal olunca temizlenir. Kamera arkasındaki düşmanın oku ters yana dönmez. Boğucu Kavrayış'ın yerdeki yay işareti tehlikeli dış köşesini de kapsar. İyileşme yazıları uzun ondalıklar yerine tam sayı gösterir; kazanılan gerçek can değişmez. Azaltılmış hareket tercihinde sağlık küresinin iç dönmesi ve ömür sonu parlaması durur. Yemin taşına varınca önceki salonların küreleri temizlenir.

Kayıtlı ses seviyeleri ilk yüklemeden itibaren uygulanır. Sekmeye dönerken ayarlar ve final/ölüm ekranlarının sesi yeniden açılır; duraklatılmış dövüş duraklatılmış kalır. Anlatıcı sesi kapalıysa altyazı sürer ve konuşma müziği kısmaz. Önbelleği okuma veya yazma başarısız olduğunda, internetten başarıyla gelen dosya kaybolmaz. `node tools/verify-offline.cjs` gerçek çevrimdışı işleyicilerin önbellek sırasını, tüm dosyaların geri dönüşünü ve diğer oyunların önbelleğinin korunmasını; `node tools/verify-warnings.cjs` gerçek uyarı kodunu ve kamera hesabını denetler. Bu kontroller tarayıcı veya ekran kartı ölçümü değildir.

Sürüm 51'de ses veya arayüz ayarını değiştirirken aynı boyuttaki çizim alanı tekrar sıfırlanmaz. Ekran boyutu gerçekten değişince tek işlemle yenilenir; gizli veya çok küçük pencerede son geçerli görüntü boyutu korunur. Ekran yoğunluğu değişince can/dayanıklılık küreleri de yenilenir. Girdap sonrası başlığa dönülünce kamera normal açısına gelir.

Menü öncesindeki dokunuş oyuna dönünce komut üretmez. Tarayıcının Control/Command kısayolları yanlışlıkla yetenek çalıştırmaz; oyuncunun kendi Control ataması korunur. Cihaz kayıt yazmayı reddetse de bu oturumdaki yemin taşından devam seçeneği doğru görünür. Yeni oyun/finalde eski kayıt silinemiyorsa geçersizleştirme denenir; cihaz her iki işlemi de engellerse açık mesaj gösterilir. Yeni oyun, devam ve yeniden doğuş mesajları eski bildirimler temizlenirken kaybolmaz. Kayıt hatası kontrolleri `tools/verify-gameplay.cjs` içinde de bulunur.

Gerçek harita ve modellerle, normal can/hasar ve oyun girdileri kullanılarak yapılan 21 otomatik tam bölüm denemesi tamamlandı. Farklı hızlar, kaçırılmış saldırı uyarıları, kapalı mühür, Cellat'ın son evresinde ölüm, yemin taşından dönüş ve finalden yeni yolculuk birlikte denetlendi. Bu otomatik denemeler insanın oynama süresini/zorluğunu veya ekran kartı performansını ölçmez.

Girdap'ın öfke kazancı önce ölçeklenip sonra sınırlandırılır: dolmaya yakın çubuk artık %100'e ulaşır ve savaş narası kullanılabilir. Yeni yolculuk ve yeniden doğuş, önceki yeteneğin ışığını, kamera etkisini ve ekran parlamasını temizler. Efektler tamamen kapatıldığında hazırlık kopyaları ve zincir arabellekleri de bırakılır.

Düşman kılıcının sesi kendi konumundan ve kendi vuruş zamanına göre gelir; Bahtiyar'ın saldırısı bu sesi değiştirmez. Sessiz Şapel ve Zincir Mahkemesi'ne girerken süren işkence ortamı da söner. Yeni yolculuk ve yeniden doğuşta ilk 30 saniyelik sakin başlangıç korunur. Bu düzeltmeler gerçek dövüş kodu, kaynak temizleme kontrolleri ve kısa çevrimdışı ses üretimleriyle denetlendi; yeni tarayıcı/GPU ölçümü yapılmadı.

Son salonun arka kapısı ve yan taş blokları artık karakteri fiziksel olarak durdurur. Öfke göstergesi savaş narası gerçekten kullanılabildiğinde hazır olur. Yuvarlanma inişi ağır adım verir; yeni yolculukta eski adımların sesi ve tozu yeniden oluşmaz. Bir konuşma kaydı çözülemezse kalan sağlam kayıtlar hazırlanır, sorunlu cümlede altyazı ve yeniden deneme korunur.

## Teknik yapı

Three.js r170, klasik JavaScript; oynamak için paket yöneticisi veya derleme adımı yoktur. Gerçek UV kaplamalı ve iskeletli karakterler başlangıçta gömülü glTF verisinden yüklenir. `file://` ve çevrimdışı kullanım desteklenir.

- `src/authored-models.js`: sanatçı modellerinin yüklenmesi, iskelet kopyalama, sınıfa özgü görünüşler, silahlar ve kaynak temizliği.
- `src/authored-motion.js`: Quaternius hareketlerinin karakter iskeletlerine uyarlanması; hareket geçişleri, parmak tutuşları, ayak basışı ve vuruş zamanlaması.
- `assets/characters/characters.js`: barbar ve cellat gövdeleri, gerçek UV renk/normal/pürüzlülük/örtülme haritaları, sakal ve bıyık.
- `assets/characters/authored-clips.js`: seçili 32 animasyonun sıkıştırılmış hareket verisi.
- `src/models.js`, `src/motion.js`: kılıç, balta, asa ve kalkan gibi özgün silahların üretiminde kullanılan önceki geometrik altyapı. Aktif karakter gövdeleri ve hareketleri yukarıdaki yeni modülleri kullanır.
- `src/materials.js`: altı ayrı Poly Haven PBR yüzeyi; renk, normal ve ARM haritaları.
- `src/world.js`: harita, mimari, oda oda ışık ve renk tasarımı (atmosfer), meşaleler ve çarpışmalar.
- `src/lighting.js`: anahtar/dolgu/kenar ışıkları, zemin sisi, karakterlerin kenar ışığı, temas gölgeleri ve senaryolu anlar (ayin yıldızı, yemin taşı, cellat salonunun iki aşaması).
- `src/post.js`: HDR görüntü zinciri: ortam gölgesi (AO), parlama (bloom), ısı dalgası ve renk derecelendirme; isteğe bağlı MSAA ana sahne hedefinde uygulanır.
- `src/performance.js`: yalnız ölçüm açıkken tutulan kare aralıkları ve işlemci süreleri; `app.js` raporu ile `post.js` eşlenmiş GPU ölçümleri.
- `src/limbs.js`: öldürücü vuruşta uzuv/kafa kesme (düşmanın kendi ağından kesilip fizikle savrulan parça, kesit kapağı, kan izi). Her zaman açık, ayarı yok; patronlar kesilmez.
- `src/globes.js`: ölen düşmanlardan arada kırmızı sağlık küresi düşer (sıradan %10, ağır/bitirici vuruş %14, Muhafız/Taşıyıcı %30, 10 boşluktan sonra garanti; Cellat'ta yalnızca evre geçişlerinde). 3,2 m'de çekilir, 0,7 m'de toplanır: azami canın %12'si (öfkedeyken %16), can doluyken toplanmaz. 25 sn yaşar (son 4 sn yanıp söner; azaltılmış harekette sabit kalır), en çok 8. Kaydedilmez; iki çizim çağrısı, ışık eklemez.
- `src/combat.js`: dövüş, düşmanlar, boss, darbe duraklaması, girdi tamponu ve kontrol noktaları.
- `src/telegraphs.js`: "Kor ve Kül" saldırı uyarıları ve savaş narasının görüntüsü.
- `src/effects.js`: gerçek bıçak hareketini izleyen şeritler, kan, kıvılcım ve darbe parçacıkları.
- `src/app.js`, `src/ui.css`, `src/hud.js`, `assets/ui/`: kamera, kontroller, menüler, ayarlar, gölgelendirici ön hazırlığı; Diablo tarzı arayüz, sıvı can/dayanıklılık küreleri ve oyma hasar sayıları.
- `src/audio.js`, `src/music.js`, `src/narration.js`: ses motoru, bestelenmiş uyarlanır müzik ve gömülü Türkçe kayıtlar/efektler.
- `ASSET-LICENSES.md`, `credits.html`: kaynaklar, sanatçılar, lisanslar ve yapılan değişiklikler.

Barbar ve cellat modelleri thecubber / OpenGameArt kaynaklıdır (CC BY 3.0); sakal/bıyık RehmanPolanski / MakeHuman, düşman gövdeleri ve kıyafet parçaları ile hareketler Quaternius, yüzeyler Poly Haven kaynaklıdır (CC0). Ses efektleri Kenney, artisticdude, rubberduck, qubodup ve diğer CC0 yazarlarındandır; yazı tipleri Source Sans 3 ve resme dönüştürülmüş bitiş başlıklarında Cinzel (SIL OFL 1.1). Bunlar foto-gerçekçi taranmış karakterler değildir; sanatçılar tarafından hazırlanmış oyun modelleridir. Oyun içi ana menüden kaynak bilgilerine ulaşılabilir.

Darbe vurgusu bütün dövüş saatlerine birlikte uygulanan kısa duraklamadır (sabit bir değer; ayarlarda yoktur). Duraklama sırasında basılan tuşlar kaybolmaz, sıradaki harekete aktarılır. İşletim sistemindeki hareket azaltma tercihi darbe duraklamasını ve kamera geri tepmesini kapatır. Yeni görsel çalışma can, hasar, saldırı süreleri, bölüm güzergâhı ve kayıt noktalarını değiştirmez.

GitHub yayını bağımsız `goktugkarpat/bahtiyar-kabir-azabi` deposunu ve doğrudan `main` dalını kullanır. Windows'ta `yayinla.cmd`, Mac'te `yayinla.command` çift tıklanarak gönderim yapılabilir. Git ve GitHub CLI gerekir; ilk kullanımda GitHub'ın resmî giriş ekranı açılır. Göndermeden önce aktif hesabın `goktugkarpat` olduğu doğrulanır. Bu dosyalar değişiklikleri kaydeder, gönderir ve GitHub Pages'i etkinleştirir.

## Anlatıcıyı yeniden kaydetmek

`python3 tools/gen_narration.py` anlatıcı cümlelerini (tr-TR-AhmetNeural) yeniden kaydeder ve ses bankasını (`src/narration.js`) yeniden üretir. Gerekenler: `pip install edge-tts` ve rubberband + lame destekli ffmpeg (Homebrew ffmpeg'de vardır). İndirilen paketler ve kayıtlar Dropbox dışında önbelleğe alınır.
