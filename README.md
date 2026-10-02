# Kabir Azabı – Bahtiyar'ın karanlık yolculuğu 🗡️

Yetişkinler için hazırlanmış, üç boyutlu, Türkçe seslendirmeli, karanlık fantezi aksiyon oyunu (18+, şiddet ve kan içerir).
Bahtiyar, kör bir mahkûm kılıcıyla Kurban Tapınağı'nda uyanır ve dört bölümlük bir yolculukta Zincir Celladı'ndan Ocağın Kalbi'ne kadar inen yolu açar.

## Bölümler

1. **Kurban Tapınağı:** Zincir Celladı'nın mahzenleri.
2. **Kara Kıyı:** Yanmış mezarlık, boğulmuş liman, Derinliklerin Çancısı.
3. **Kül Harabeleri / Sessiz Taht:** Mezar avlularından kristalli mağaraya, Oyukların Kralı.
4. **Kızıl Ocak:** Zincir kuyuları ve dökümhane, Ocağın Kalbi.

Bölümler birbirinin devamıdır: boss düşünce bir sonrakine kendiliğinden geçilir. Her bölümde iki hikâye görevi tamamlanınca boss kapısı açılır. Görevler nesne bulma, eski yeminleri çözme ve mekanizmaları doğru sırada çalıştırma üzerine kuruludur; ilerleme ölümde korunur. Mola menüsündeki **Görev günlüğü** adımları gösterir.

## Nasıl açılır

- **Bilgisayarda:** `index.html` dosyasına çift tıklamanız yeterli. Kurulum ya da internet gerekmez. Mac'te `OYNA.command` da oyunu tarayıcıda açar.
- **İnternette:** https://goktugkarpat.github.io/bahtiyar-kabir-azabi/ adresini açın. İlk açılıştan sonra internet olmadan da çalışır.
- **iPad'de:** Safari ile adresi açıp Paylaş › **Ana Ekrana Ekle** deyin.

## Nasıl oynanır

- **Fare:** Boş yere tıkla, Bahtiyar oraya yürür (basılı tutarsan fareyi izler). Düşmana sol tıkla: ona koşar ve vurur. Shift + tık: yürümeden fareye doğru vurur.
- **Yetenekler:** Sağ tık, **1**, **2**, **3** yuvaları. Dört yol vardır (sert vuruş, bağırma, dönme, Charge); her yolda üç aşama, aşağıdaki aşama yukarıdakinin yerine geçer. Yetenek ağacı **T** ile açılır.
- **Space:** Fareye doğru yuvarlanma. **Q:** can iksiri. **E:** yakındaki görev nesnesi veya yemin taşı. **I:** karakter ve çanta (eşyaya çift tıkla: giy). **ESC:** mola.
- Tuşları Ayarlar › Kontroller ekranından değiştirebilirsin.
- **Xbox kolu:** sol çubuk hareket, A saldırı, B kaçınma, RT / X / Y / LT yetenekler. **Dokunmatik:** düşmana dokun, ona vurur; yere dokun, oraya yürür.
- Düşman vurmadan önce zemine işaret çıkar: **altın kenar** sıradan darbe, **kızıl kenar** ağır darbe, kızıllardan mutlaka kaç. Büyük boss saldırılarında can çubuğunun altındaki kısa açıklama neye vuracağını, nereden kaçacağını veya hangi siperi kullanacağını söyler; soluk mavi alan siper/güvenli yerdir.
- Ölen düşmanlardan kırmızı sağlık küreleri ve eşyalar düşer.
- Kare hızını görmek için oyun sırasında **.** (nokta) tuşuna bas. Adresin sonuna `?sessiz` eklersen oyun sessiz açılır.

## Ayarlar

Grafik kalitesi (Düşük / Orta / Yüksek), çözünürlük çarpanı, kare hızı (60 / 90 / 120 / ekran hızı), parlaklık, ses seviyeleri ve arayüz boyutu.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Oyunun girişi |
| `src/` | Oyunun kodu: savaş, dünya, karakterler, ses, arayüz |
| `assets/` | Karakter modelleri, kaplamalar, arayüz resimleri |
| `vendor/` | 3D kütüphanesi (three.js r170, MIT lisansı) |
| `tools/gen_narration.py` | Anlatıcı sesini yeniden üretmek için |
| `manifest.webmanifest`, `sw.js`, `icons/` | Uygulama gibi açılma, simge ve internetsiz çalışma |
| `serve.py`, `OYNA.command` | İsteğe bağlı yerel sunucu |
| `ASSET-LICENSES.md`, `credits.html` | Kaynaklar ve lisanslar |

## Anlatıcıyı değiştirmek

Anlatıcı pes ve ağır bir erkek sesiyle (`tr-TR-AhmetNeural`) seslendirildi:

```bash
python3 -m pip install edge-tts
python3 tools/gen_narration.py voice
```
