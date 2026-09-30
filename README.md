# Kabir Azabı – Bahtiyar ve Kurban Tapınağı 🗡️

Yetişkinler için hazırlanmış, üç boyutlu, Türkçe seslendirmeli, karanlık fantezi aksiyon oyunu (18+, şiddet ve kan içerir).
Bahtiyar, Kurban Tapınağı'nın mahzenlerinde ölüleri, tarikatçıları ve Zincir Celladı'nı yenip tapınağın derinlerine iniyor.

## Nasıl açılır

- **Bilgisayarda:** `index.html` dosyasına çift tıklamanız yeterli. Kurulum ya da internet gerekmez. Mac'te `OYNA.command` da oyunu tarayıcıda açar.
- **İnternette:** https://goktugkarpat.github.io/bahtiyar-kabir-azabi/ adresini açın. İlk açılıştan sonra **internet olmadan da** çalışır (`sw.js` her şeyi cihaza kaydeder).
- **iPad'de:** Safari ile adresi açıp Paylaş › **Ana Ekrana Ekle** deyin, oyun uygulama gibi tam ekran açılır.

## Nasıl oynanır

- **Fare:** Boş yere tıkla, Bahtiyar oraya yürür (basılı tutarsan fareyi izler). Düşmana sol tıkla: ona koşar ve vurur. Sağ tık düşmana ağır vurur.
- **Shift + tık:** Yürümeden fareye doğru vurur (boşluğa vurmanın tek yolu).
- **Space:** Yuvarlanma. Başında korunursun, dayanıklılık harcar.
- **Q** can iksiri, **R** Kan Öfkesi, **F** Zincir Girdabı, **E** yemin taşı, **ESC** menü.
- Tuşları ve fare düğmelerini Ayarlar › Tuşlar ekranından değiştirebilirsin.
- **Gamepad:** sol çubuk yürür, X hafif, Y ağır, A kaçın, LB girdap, RB öfke.
- **Dokunmatik:** düşmana dokun, ona vurur; yere dokun, oraya yürür.
- Düşman vurmadan önce zemine bir işaret çıkar: **altın kenar** sıradan darbe, **kızıl kenar** ağır darbe. Kızıllardan mutlaka kaç.
- Ölen düşmanlardan arada kırmızı **sağlık küreleri** düşer, üstünden geçince can verir.
- Adresin sonuna `?sessiz` eklersen oyun tamamen sessiz açılır (test için).

## Ayarlar

Grafik kalitesi (Düşük / Orta / Yüksek), çözünürlük çarpanı (1×, 1,25×, 1,5×), parlaklık, ses seviyeleri ve arayüz boyutu.
Kare hızını ve çözünürlüğü görmek için oyun sırasında **.** (nokta) tuşuna bas.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Oyunun girişi |
| `src/*.js`, `src/ui.css` | Oyunun kodu: savaş, dünya, karakterler, ses, arayüz |
| `assets/characters/` | Karakter modelleri ve hareketleri |
| `assets/ui/` | Arayüz resimleri |
| `vendor/` | 3D kütüphanesi (three.js r170, MIT lisansı) |
| `src/narration.js` | Anlatıcı sesi ve ses efektleri (oyuna gömülü) |
| `tools/gen_narration.py` | Cümle değişirse sesleri yeniden üretmek için |
| `manifest.webmanifest`, `sw.js`, `icons/` | Uygulama gibi açılma, simge ve internetsiz çalışma |
| `serve.py`, `OYNA.command` | İsteğe bağlı yerel sunucu |
| `ASSET-LICENSES.md`, `credits.html` | Kaynaklar, sanatçılar ve lisanslar |

## Anlatıcıyı değiştirmek

Anlatıcı pes ve ağır bir erkek sesiyle (`tr-TR-AhmetNeural`) seslendirildi. Bir cümleyi değiştirdikten sonra:

```bash
python3 -m pip install edge-tts
python3 tools/gen_narration.py voice
```

`ffmpeg` kuruluysa (`brew install ffmpeg`) kayıtların başındaki ve sonundaki sessizlik otomatik kırpılır.
