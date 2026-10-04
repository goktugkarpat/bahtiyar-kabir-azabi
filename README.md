# Kabir Azabı

Bahtiyar'ın karanlık yolculuğunu anlatan, üç boyutlu, Türkçe konuşmalar içeren bir aksiyon oyunu. **Yetişkinler içindir (18+); kan, yoğun şiddet ve korku içerir.**

**Bu klasördeki oyun sürümü: v146.**

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
