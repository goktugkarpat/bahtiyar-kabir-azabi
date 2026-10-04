# Kabir Azabı

Bahtiyar'ın karanlık yolculuğunu anlatan, üç boyutlu, Türkçe konuşmalar içeren bir aksiyon oyunu. **Yetişkinler içindir (18+); kan, yoğun şiddet ve korku içerir.**

**Bu klasördeki oyun sürümü: v150.**

[Oyunu aç](https://goktugkarpat.github.io/bahtiyar-kabir-azabi/)

## Bölümler

1. **Kurban Tapınağı:** Zincir Celladı'nın mahzenleri.
2. **Kara Kıyı:** Yanmış mezarlık, boğulmuş liman ve Derinliklerin Çancısı.
3. **Sessiz Taht:** Mezar avluları, kristalli mağaralar ve Oyukların Kralı.
4. **Kızıl Ocak:** Zincir kuyuları, dökümhane ve Ocağın Kalbi.

Bölümler birbirinin devamıdır. İlk üç bölümün sonunda yolculuk sonraki bölüme geçer. Hikâye görevleri, yemin noktaları, karakter gelişimi ve düşen eşyalar yolculuğun parçalarıdır. Görev günlüğü sıradaki adımları gösterir; ölümde son yemin noktasına dönülür.

## Açılış

- **Bilgisayarda:** Klasördeki `index.html` dosyasını çift tıklayarak açın. Oyun dosyaları ve kütüphaneler klasörde bulunur; kurulum gerekmez.
- **İnternette:** Yukarıdaki oyun bağlantısını açın. İlk yükleme ve çevrimdışı dosyaların hazırlanması tamamlandıktan sonra aynı tarayıcıda internetsiz açılabilir.
- **Ana ekrana ekleme:** Safari'de Paylaş → Ana Ekrana Ekle seçeneği kullanılabilir. Oyun öncelikle masaüstü bilgisayarlar için geliştirilmiştir.
- İlerleme ve ayarlar kullanılan tarayıcıda saklanır; farklı tarayıcı veya bilgisayara kendiliğinden taşınmaz.

## Kontroller

| Kontrol | İşlev |
|---|---|
| Sol fare tuşu | Yere tıklayarak hareket; düşmana tıklayarak normal saldırı |
| Shift + sol tık | Yürümeden fareye doğru saldırı |
| Sağ fare tuşu, 1, 2, 3 | Atanmış yetenek yuvaları |
| Space | Kaçınma / yuvarlanma |
| Q | Can iksiri |
| E | Yakındaki görev nesnesiyle etkileşim |
| I / C | Karakter ve çanta |
| T | Yetenek ağacı |
| Esc | Mola |
| . (nokta) | Performans göstergesi |

Tuşlar Ayarlar → Kontroller ekranından değiştirilebilir. Oyun kolu ve dokunmatik kontroller de bulunur. Çantadaki bir eşyaya çift tıklamak onu giyer.

Düşman saldırılarından önce yerde uyarı çıkar. Altın kenar sıradan, kızıl kenar ağır darbeyi gösterir. Boss saldırılarındaki açıklamalar ve güvenli alan işaretleri kaçınma yönünü anlamaya yardımcı olur.

## Görüntü ve ses ayarları

- **Grafik kalitesi:** Düşük ve Yüksek.
- **Görüntü boyutu:** Otomatik veya ekranın doğal çözünürlüğü. Otomatik seçenek, Retina gibi yüksek piksel yoğunluğundaki ekranlarda çizim çözünürlüğünü azaltabilir.
- **Kare hızı:** 60, 90, 120 FPS veya ekran hızı. Mac'te başlangıç sınırı 60 FPS'dir; menülerde ve hareketsiz beklerken kare hızı ayrıca azaltılır.
- **Kenar yumuşatma:** SMAA açık kullanılır; ayrı MSAA veya süper örnekleme seçeneği bulunmaz.
- Parlaklık, kamera sarsıntısı, arayüz boyutu, altyazılar ve müzik / efekt / konuşma sesleri ayarlanabilir.

Sessiz açılış için adresin sonuna `?sessiz` ekleyin. Oyun testleri bu şekilde yapılır.

## Son güncellemeler ve bilinen durum

- **v142:** Kare sınırı, çizimin yanında oyun hesaplamasını da sınırlar. Aynı karede tekrarlanan karakter animasyonu hesaplamaları azaltıldı.
- **v143:** Windows Direct3D11 çizim yolunda emüle edilen çoklu çizim yerine yerel örnekleme kullanılır.
- **v144:** Canlı ses işleme hızı, çıkış cihazının yüksek örnekleme hızından bağımsız olarak 48 kHz seçilir; desteklenmezse 44,1 kHz denenir.
- **v145:** NVIDIA / Direct3D11 yolunda ışığın sis içindeki dağılımı aynı hesap ve sırayla, daha küçük bir görüntü programında yapılır. Salonlar yalnızca derlenmez; ışıkların sis içindeki katkıları etkinleştirilerek yükleme ekranı altında oyun kamerasıyla gerçekten çizilir ve çizimin tamamlanması beklenir. İlk kullanım hazırlığının mümkün olduğunca yükleme ekranında tamamlanması amaçlanır. Karakter penceresi dünya malzemelerinden sonra hazırlanır. Küçük harita ve hasar yazıları için küçük yazılım çizim yüzeyleri kullanılır. Grafik kalitesi, çözünürlük ve seçilen kare hızı korunur; Mac'in sis çizim yolu değişmez.

- **v150:** Karakter gölgelendiricisinde farklı sayıda yara izi olan malzemeler tek program paylaşıyor (aynı görüntü; kahraman portresi piksel piksel aynı çıktı). Program sayısı 153→152, karakter gölgelendirici kodu ~%2 küçüldü. Pas/kir dallarını ayırmak program sayısını artırdığı için denendi ve bırakıldı.
- **v149:** Küçük harita saniyede en çok ~30 kez yenilenir (120 FPS'te her karede yenileniyordu); görüntü aynı kalır, tarayıcı işlemci ve ekran kartı süreci biraz daha az çalışır.
- **v148:** Yetenek ağacı açıkken T'ye tekrar basmak da pencereyi kapatır (I ve C gibi). Yeni sürümde değişmeyen dosyalar yeniden indirilmez; ilk açılış hızlı kalır.
- **v147:** Grafik kalitesi iki seçeneğe indi: Düşük ve Yüksek. Yeni Yüksek, eski Orta ayarıdır; eski Yüksek kaldırıldı. Eski Orta/Yüksek kayıtları kendiliğinden Yüksek'e geçer. Karakter / çanta (I) ve yetenek ağacı (T) sayfaları yükleme ekranı altında bir kez çizilir; ilk açılışta takılma olmaması amaçlanır.
- **v146:** Parçacık, kan izi, zemin lekesi, kopan parçalar ve silah izi tamponlarında yalnızca kullanılan bölüm güncellenir; henüz çizilmemiş güncellemeler korunur. Bitmiş kan çizgileri çizim aralığının dışında bırakılır. Gerçek efekt kodunun uzun süreli karşılaştırmasında geometri aynı kalırken bu kapsamdaki aktarım miktarı %55 azaldı. Bu sonuç tarayıcı işlemci yükü veya sıcaklık ölçümü değildir.

**Bilinen durum:** Kullanıcının Ryzen 9950X / RTX 4090 bilgisayarında, özellikle yeni düşmanlara yaklaşırken işlemci sıcaklığı sıçraması bildirildi. Windows işlem kaydında yükün büyük kısmı tarayıcının ekran kartı işlemindeki NVIDIA görüntü programı hazırlama bileşeninde görüldü. Aynı bilgisayardaki sessiz karşılaştırmada eski sis kodu yeni düşmanlara yaklaşınca uzun süre devam eden yük üretti; v145 bu uzun hazırlık yükünü azalttı, ancak ilk görülen düşmanlarda kısa yük sıçramaları hâlâ ölçüldü. İşlemci işi işlem kimliğine göre ham zaman farklarıyla ölçülür; arka planda çizimin yavaşlatıldığı denemeler sürekli oynanış karşılaştırması sayılmaz. Bu test toplam bilgisayar yükü veya sıcaklık ölçümü değildir; sıcaklık sorununun bütünüyle giderildiği henüz doğrulanmadı. Yükleme sırasında görüntü programları bir kez hazırlanır ve işlemci işi gerektirir. Gözlem yalnızca bu bilgisayara aittir; genel bir Ryzen sorunu olduğu gösterilmedi.

## Dosyalar ve yayın

| Dosya / klasör | İçerik |
|---|---|
| `index.html` | Oyunun giriş sayfası |
| `src/` | Oynanış, dünya, karakter, ses ve arayüz kodu |
| `assets/` | Modeller, kaplamalar ve arayüz görselleri |
| `vendor/` | Yerel üç boyutlu görüntü kütüphanesi ve yükleyici |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ana ekrana ekleme ve çevrimdışı çalışma |
| `ASSET-LICENSES.md`, `credits.html` | Kaynaklar ve lisans bilgileri |
| `yayinla.command` | Mac'te GitHub'a yayınlama aracı |

Çevrimdışı önbellek yalnız bu oyunun `kara-gecit-` önekiyle temizlenir; diğer oyunların önbelleği silinmez. GitHub yayını `goktugkarpat/bahtiyar-kabir-azabi` deposunun `main` dalından yapılır.
