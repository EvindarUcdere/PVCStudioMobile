# Guvenlik Kontrol Notlari

Bu dokuman teslim oncesi guvenlik kontrollerinin ozetidir.

## Mevcut korumalar

- Sifreler uygulama veritabaninda tutulmaz; giris/kayit Firebase Authentication ile yapilir.
- Sifre alani `secureTextEntry` kullanir ve basarili giris/kayit/cikis sonrasi ekrandaki gecici state temizlenir.
- Firebase config degerleri kaynak koda sabit yazilmaz; `.env` ve EAS environment uzerinden okunur.
- `.gitignore`, `.env` ve `.env.*` dosyalarini Git disinda tutar. Repoda yalnizca `.env.example` bulunur.
- Firma verileri `companies/{firmaKodu}` altinda tutulur.
- Firestore Rules ornegi, kullanicinin sadece kendi firmasinin verisini okumasina/yazmasina izin verir.
- Lisans join islemi Firestore transaction ile yapilir; kullanici limiti ayni anda gelen islemlerde de kontrol edilir.
- Tekil bulut yazma islemleri mobil tarafta da lisansli firma alani dogrulamasi yapar.
- Hata loglari Firebase'e yazilmadan once e-posta, token, API key ve sifre benzeri metinler maskelenir.
- Firestore varsayilan catch-all kuralinda tum diger okuma/yazmalar kapali tutulur.

## Operasyonel zorunluluklar

- Firebase Console > Firestore Rules alanina `docs/firestore-security-rules.example` icerigi yayinlanmali.
- Firestore kesinlikle test modunda veya `allow read, write: if true` ile birakilmamali.
- Gercek Firebase config degerleri GitHub'a commit edilmemeli.
- Lisans dokumanlari sadece yonetici tarafindan olusturulmali; mobil uygulama lisans yaratmaz.
- Firebase Authentication tarafinda Email/Password ve gerekiyorsa Anonymous giris aktif olmali.
- Cihaz kaybi veya personel ayrilmasinda lisans dokumanindaki ilgili `activeUserIds` kaydi pasife alinmali.

## Bilinen not

Firebase Web API key mobil uygulamada tamamen gizli kabul edilmez. Bu nedenle asil guvenlik API key'in gizlenmesi degil,
Firebase Authentication, Firestore Security Rules ve firma/lisans kontrolunun birlikte uygulanmasidir.
