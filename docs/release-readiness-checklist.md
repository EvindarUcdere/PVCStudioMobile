# PVC Studio Mobile Teslim Kontrol Listesi

Bu belge teslimden once uygulamanin veri, guvenlik ve kararlilik tarafinda kontrol edilmesi gereken maddeleri toplar.

## Zorunlu kontroller

- Firebase Authentication icinde Anonymous ve Email/Password aktif olmali.
- Firestore Database olusturulmus olmali.
- Firestore Rules, `docs/firestore-security-rules.example` temel alinarak yayina alinmali.
- `.env` dosyasi GitHub'a gonderilmemeli; repo icinde sadece `.env.example` kalmali.
- Her firma icin `licenses/{FIRMA-KODU}` dokumani elle veya admin panelinden olusturulmali.
- Firma kodu dokuman ID'si ile ayni olmalidir. Ornek: `licenses/ALI-PVC-2026`.
- APK yayinlamadan once temiz kurulum, firma kodu girisi, tasarim, teklif, odeme, atelye, PDF onizleme ve bulut senkron testi yapilmali.

## Veri dayanikliligi

- Uygulama once lokal SQLite veritabanina yazar.
- Internet varsa Firebase'e yedekler.
- Uygulama acilisinda Firebase'deki daha yeni kayitlar lokale geri yuklenir.
- Offline durumda uygulama calismaya devam eder; internet gelince manuel veya akisa bagli yedekleme tekrar denenir.
- Silme islemleri soft-delete mantigiyla tutulur; ani veri kaybi riskini azaltir.

## Guvenlik notlari

- Client tarafinda firma kodu kontrolu tek basina yeterli degildir; Firestore Rules mutlaka yayinlanmalidir.
- Lisans dokumanlari listeleme izni almamalidir. Uygulama sadece `licenses/{firmaKodu}` dokumanini okur.
- Firma verileri `companies/{firmaKodu}` altinda tutulur.
- Calisanlar ayni firma kodu ile katildiginda ayni firma verisini gorur.
- Loglarda `actorUserId` ve uygun yerlerde `actorName` tutulur; kimin ne yaptigi daha sonra takip edilebilir.

## Yayin oncesi test

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npx expo-doctor`
- `npx expo export --platform android --clear`

## Bilinen audit durumu

`npm audit --omit=dev` kalan uyarilarin cogunu Expo/React Native arac zincirinden raporlar. `npm audit fix --force` su anda Expo/RN ana surumlerini kirici bicimde yukseltmek istedigi icin teslim oncesi uygulanmamalidir. Expo SDK guncellemesi ayri bir faz olarak ele alinmalidir.
