# Production Hazirlik Analizi

## Zaten mevcut olanlar

- Lokal veri saklama SQLite uzerinde.
- Migration islemleri transaction icinde calisiyor; hata olursa rollback yapiliyor.
- Firebase firma verileri `companies/{firmaKodu}` altinda tutuluyor.
- Firestore Rules ornegi firma bazli erisim icin eklendi.
- Lisans katilimi transaction ile yapiliyor; `maxUsers` limiti ayni anda katilimlarda da korunuyor.
- Kritik ekranlarda UI seviyesinde `isSaving` / `loading` ile cift tiklama riski azaltiliyor.
- Musteri ve tasarim tarafinda soft-delete temeli var.
- Firebase yedekleme ayni dokuman ID'sine `set` yaptigi icin ayni yedek iki kez yuklenince cift dokuman olusmuyor.
- Uygulama Firebase ulasilamazsa lokal veritabanindan calismaya devam ediyor.

## Bu turda iyilestirilenler

- Tasarim editorune lokal autosave eklendi. Kaydedilmemis taslak, uygulama kapanirsa ayni tasarim acildiginda geri yuklenir.
- Firebase Email/Password icin sifre sifirlama akisi eklendi.
- Migration baslamadan once SQLite backup dosyasi olusturuluyor.
- Firebase restore akisi lokal silinmis kayitlari da dikkate alacak sekilde guclendirildi.
- Silinmis musteri ve tasarimlar icin Geri Donusum ekrani eklendi.
- Mevcut logger, Firebase altinda `errorReports` koleksiyonuna merkezi hata raporu yazabilecek hale getirildi.

## Bilerek ertelenenler

- Sentry veya Firebase Crashlytics native entegrasyonu: yeni native bagimlilik ve yeni build riski olusturdugu icin bu turda hafif Firebase errorReports tercih edildi.
- Tam iki yonlu conflict ekranlari: su an `updatedAt` karsilastirmasi ile yeni olan kazanir. Ayni kayit iki cihazda ayni anda degisirse ileride kullaniciya secim yaptiran conflict ekrani eklenmeli.
- Tum kayit tipleri icin detayli Recycle Bin: bu turda musteri ve tasarim geri alma eklendi. Is, teklif ve kasa kayitlari icin ayrintili geri alma sonraki fazda ele alinabilir.

## Teslim oncesi onerilen manuel test

1. Tasarimda degisiklik yap, Kaydet'e basmadan uygulamayi kapat/ac; taslak geri geliyor mu bak.
2. Sifremi Unuttum butonu ile Firebase reset e-postasi geliyor mu test et.
3. Bir musteri sil, Diger > Geri Donusum ekranindan geri al.
4. Internet kapaliyken musteri/tasarim/teklif kaydet, uygulamayi kapat/ac.
5. Interneti ac, Tam Bulut Yedegi yap; Firebase `companies/{firmaKodu}` altinda kayitlar var mi bak.
6. APK temiz kurulum yap, firma kodu ile gir, buluttan veri geri geliyor mu kontrol et.
