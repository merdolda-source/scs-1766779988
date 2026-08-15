# Domino Sürpriz — prototip

Domino zinciri devrildikçe yere düşen taşların bir resmi ortaya çıkardığı
bulmaca oyunu. Bu klasör oyunun kendisi (HTML5 + WebGL); `../app` ise onu
APK içine paketleyen ince Android sarmalayıcısı.

## Oynanış

Alan, resmi kaplayan tek bir yılankavi domino dizisidir. Dizi birkaç yerinden
kesilmiştir. Oyuncunun sınırlı sayıda taşı vardır ve boşlukları köprülemek için
akış yönünde parmağını sürükler. Bütçe kasten bütün boşlukları düz köprülemeye
yetmez, yani her boşlukta bir seçim vardır:

- **Düz köprüle** (~7 taş) — o bölüm tamamen açılır.
- **Yan sıraya atla** (~1-2 taş) — ucuz, ama atlanan kısım karanlıkta kalır.

Zincir bitince açılan yüzde ve resmin adı gösterilir; %60 üstü koleksiyona
eklenir. Resim koşu bitene kadar gizlidir — sürpriz mekanik budur.

## Mimari

| Dosya | İş |
|---|---|
| `src/level.js` | Alanı kurar: yılankavi merkez hattı, U dönüşleri, boşluklar, köprü ekleme |
| `src/sim.js` | Devrilme simülasyonu |
| `src/view.js` | three.js ile çizim (tüm alan tek instanced draw call) |
| `src/images.js` | Resimler canvas'a çizilip taş başına örneklenir |
| `src/main.js` | Oyun akışı, giriş, arayüz |

### İki tasarım kararı

**Fizik motoru yok.** Her taş yazılı bir devrilme eğrisi izler ve dönüşünün
%44'ünde ardıllarını tetikler — gerçek dominoda da temas, taş yere yatmadan çok
önce olur. Maliyet aktif taş sayısıyla orantılı ve aynı anda sadece 2-3 taş
hareket ettiği için alan büyüklüğü kare süresini neredeyse hiç etkilemiyor.

**Tetikleme yakınlıkla değil, açık bağ grafiğiyle.** Yazılı bağlar yanlış
ateşleyemez, yani koşu tamamen deterministik. Ödül her seferinde doğru çıkması
gereken bir resim olduğu için bu şart.

Geometri, taşın ekrandaki izdüşümü kare bir "piksel" olacak şekilde ayarlı:
sıralar Z'de 0.46 aralıklı, 62 derecelik kamera bunu ~0.41'e sıkıştırıyor, sıra
içindeki 0.40 adımla eşleşiyor. Yatan alanın leke değil resim gibi okunmasının
sebebi bu.

## Süreler

Taş başına ~0.075 sn. Gerçek domino koşularıyla aynı mertebede.

| Bölüm | Taş | Süre (1x) |
|---|---|---|
| 1 — Isınma | ~370 | ~28 sn |
| 2 — Mozaik | ~750 | ~56 sn |
| 3 — Büyük Alan | ~1170 | ~1 dk 26 sn |

Oyun içinde 2x ve 4x hız düğmeleri var.

## Geliştirme

```bash
npm install
npx esbuild src/main.js --bundle --format=iife --outfile=bundle.js
node tools/shot.mjs 0        # başsız Chromium'da çalıştırıp shots/ altına ekran görüntüsü alır
```

`tools/shot.mjs` oyunu yükler, boşlukları otomatik köprüler, zinciri çalıştırır
ve her aşamanın görüntüsünü kaydeder. Emülatör olmadan görsel doğrulama yolu bu.

APK'yı yeniden üretmek için `bundle.js` ve `index.html` dosyalarını
`../app/src/main/assets/` içine kopyalayıp `gradle :app:assembleDebug` çalıştır.
