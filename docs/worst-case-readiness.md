# En Kotu Senaryo Kontrolu

Bu belge teslimden once uygulamanin zor durumlarda nasil davranmasi gerektigini ve mevcut durumu ozetler.

## Veri kaybi

| Senaryo | Mevcut durum | Risk | Aksiyon |
| --- | --- | --- | --- |
| Uygulama aniden kapanirsa | Kaydet butonuna basilmis veriler SQLite'a yazilir. Editor icindeki kaydedilmemis son degisiklikler kaybolabilir. | Orta | Kritik ekranlarda Kaydet butonu gorunur tutuldu; ileride otomatik taslak kayit eklenebilir. |
| Telefon kapanirsa/sarj biterse | SQLite'a yazilmis veri kalir. Firebase yedek internet varsa daha sonra tamamlanir. | Dusuk-Orta | APK testinde kaydet, uygulamayi kapat, tekrar ac testi yapilmali. |
| Internet kesilirse | Uygulama lokal veritabanindan calisir. Bulut yedekleme basarisiz olursa app kilitlenmez. | Dusuk | Offline olusturulan kayitlar internet gelince manuel/toplu yedekleme ile gonderilmeli. |
| Veritabani bozulursa | Firebase'de yedek varsa geri yuklenebilir. | Orta | Firebase yedeginin calistigi teslim oncesi test edilmeli. |
| Telefon degisirse | Ayni firma kodu ile girilince Firebase'deki firma verileri yeni telefona geri yuklenir. | Dusuk | Temiz kurulum + firma kodu + veri geri gelme testi yapilmali. |

## Guvenlik

| Senaryo | Mevcut durum | Risk | Aksiyon |
| --- | --- | --- | --- |
| Baska firma verisine erisim | Veriler `companies/{firmaKodu}` altinda tutulur. Firestore Rules uygulanirsa diger firmalar okunamaz. | Dusuk | `docs/firestore-security-rules.example` Firebase'de yayinda olmali. |
| Lisans kontrol sistemi calismazsa | Kayitli firma profili varsa lokal kullanim devam eder; yeni firma katilimi yapilamaz. | Dusuk-Orta | Bu bilincli davranis: mevcut esnafin isi kilitlenmez, yeni lisans girisi icin internet gerekir. |
| Sunucuya erisilemezse | Bulut sync/log yedegi calismaz ama lokal app acilir. | Dusuk | Kullaniciya manuel yedekleme/geri yukleme sonucu gosteriliyor. |
| Kullanici sifresini unutursa | Email/Password kullaniliyorsa Firebase reset akisi gerekir; Anonymous kullanici sifresizdir. | Orta | Gercek satis icin ileride "Sifremi unuttum" ekrani eklenmeli. |
| Ayni firma koduna fazla calisan katilirsa | Lisans katilimi Firestore transaction ile kontrol edilir. | Dusuk | `maxUsers` Firebase lisans dokumaninda dogru girilmeli. |

## Cift islem ve yanlis islem

| Senaryo | Mevcut durum | Risk | Aksiyon |
| --- | --- | --- | --- |
| Ayni butona iki kez basilmasi | Kritik kayit butonlarinda `isSaving`/`loading` ile buton pasiflenir. | Dusuk-Orta | APK testinde teklif/odeme/stok dusme butonlari hizli cift tiklanarak denenmeli. |
| Stok iki kez dusulmesi | Tasarim icin stok dusumu daha once yapildiysa kullanici uyarilir. | Dusuk | Atolye akisi test edilmeli. |
| Yanlislikla musteri silme | Musteri silme arsivleme mantigiyla yapilir. | Dusuk | Silinenleri geri getirme arayuzu ileride eklenebilir. |
| Yanlislikla tasarim silme | Tasarim repository soft-delete/restore destekler. | Dusuk-Orta | Tasarim geri alma arayuzu ileride guclendirilebilir. |

## Guncelleme ve surum

| Senaryo | Mevcut durum | Risk | Aksiyon |
| --- | --- | --- | --- |
| Uygulama guncellenince eski veri | SQLite migration sistemi vardir; her migration transaction icinde calisir. | Dusuk | Her yeni surumde eski APK'dan yeni APK'ya guncelleme testi yapilmali. |
| Migration yarida kalirsa | Transaction rollback kullanilir; basarisiz migration tekrar denenir. | Dusuk | Migration hatasi olursa uygulama baslatma ekraninda tekrar deneme gorunur. |
| Firebase veri formati degisirse | Lokal schema ve domain validasyonlari veri bozulmasini azaltir. | Orta | Buyuk veri modeli degisiklikleri icin ayri cloud migration plani gerekir. |

## Teslim oncesi manuel test sirasi

1. APK temiz kurulum yap.
2. Firma kodu gir ve uygulamaya gir.
3. Interneti kapat, musteri + tasarim + teklif kaydet.
4. Uygulamayi tamamen kapat/ac; kayitlar duruyor mu bak.
5. Interneti ac, manuel bulut yedekle.
6. Firebase Console'da `companies/{firmaKodu}` altinda veriler var mi bak.
7. APK'yi silip tekrar kur, ayni firma koduyla gir; Firebase'deki veriler geri geliyor mu bak.
8. Odeme, atolye, imalat PDF, stok dusme ve log ekranlarini kontrol et.
