# Destek ve Kurtarma Plani

Bu dokuman PVC Studio Mobile teslim edildikten sonra destek, lisans ve veri kurtarma surecinin nasil yonetilecegini tanimlar.

## Destek kanali

- Birincil destek kanali: WhatsApp veya telefon.
- Ikincil destek kanali: e-posta.
- Musteriden sorun bildirirken istenecek bilgiler:
  - Firma kodu
  - Kullanici adi
  - Telefon modeli
  - Sorunun oldugu ekran
  - Yapmaya calistigi islem
  - Varsa ekran goruntusu
  - Uygulama surumu

Uygulama hata kayitlarini Firebase `companies/{firmaKodu}/errorReports` altina yazar. Bu nedenle musteri yalnizca "uygulama kapandi" dediginde bile hata zamani, ekran, islem, cihaz ve hata mesaji kontrol edilebilir.

## Destek saatleri

Varsayilan destek modeli:

- Hafta ici: 09:00 - 18:00
- Cumartesi: 10:00 - 14:00
- Pazar ve resmi tatil: sadece acil veri erisim/kurtarma sorunlari

Acil destek sayilacak durumlar:

- Uygulama hic acilmiyor.
- Musteri verilerine erisemiyor.
- Teklif veya imalat PDF'i kritik bicimde hatali uretiliyor.
- Bulut yedegi veya firma kodu ile giris calismiyor.

## Ucretlendirme politikasi

- Hata duzeltmeleri: mevcut satin alinan surumdeki bozuk davranis ise ucretsiz destek kapsaminda degerlendirilir.
- Kurulum destegi: ilk teslimde dahil edilebilir; sonraki telefon degisimleri icin ayrica ucretlendirilebilir.
- Yeni ozellikler: ayri is kalemi olarak fiyatlandirilir.
- Mevcut ozelligin davranisini degistiren istekler: kapsama gore hata mi yeni istek mi oldugu netlestirilir.
- Firebase, EAS, Play Store veya benzeri ucuncu taraf servis ucretleri musteri veya uygulama sahibi tarafindan karsilanir.

## Veri yedegi sorumlulugu

Uygulama once lokal SQLite veritabanina yazar. Internet ve Firebase ayarlari varsa veriler Firebase'e yedeklenir.

Operasyon kuralı:

- Gunluk kullanimda internet varsa bulut yedek otomatik/akis icinde denenir.
- Teslimden once firma kodu ile buluta yedek alma testi yapilmalidir.
- Kritik islerden sonra kullaniciya `Buluta Yedekle` islemini kullanmasi ogretilmelidir.
- Uygulama sahibi belirli araliklarla Firebase export veya manuel Firestore yedegi almayi planlamalidir.

Musteriye soylenmesi gereken net cumle:

"Telefonunuzdaki veriler uygulama icinde lokal olarak tutulur; bulut yedek aciksa internet geldikce Firebase'e aktarilir. Telefon degisimi veya kayip riskine karsi bulut yedegin aktif oldugundan emin olun."

## Telefon degisimi

Telefon degisim sureci:

1. Eski telefonda uygulama acilabiliyorsa `Firma Bilgileri > Buluta Yedekle` calistirilir.
2. Firebase Console'da ilgili `licenses/{firmaKodu}` dokumaninda eski cihaz/kullanici UID'si gerekiyorsa pasife alinir.
3. Yeni telefona APK kurulur.
4. Firma kodu girilir.
5. E-posta/sifre ile giris yapilir veya firma koduyla katilma akisi kullanilir.
6. `Buluttan Al` ile veriler cihaza cekilir.
7. Musteri, tasarim, teklif, stok ve atelye ekranlari kontrol edilir.

Eski telefon yoksa:

- Firebase'deki son yedek kullanilir.
- Lisans koltugu doluysa Firebase `activeUserIds` icinden eski UID pasife alinir.
- Lokal yedek yoksa ve Firebase yedegi hic alinmadiysa kayip veri kurtarilamayabilir.

## Lisans tasima

- Lisans firma koduna baglidir.
- Calisanlar ayni firma koduyla ayni firma verilerine erisir.
- Cihaz/kullanici limiti `licenses/{firmaKodu}.maxUsers` ile sinirlanir.
- Cihaz degisiminde eski UID pasife alinabilir.
- Uygulamadaki `Firma Bilgileri > Lisans cihazlari > Bu Cihazi Cikar` sadece mevcut cihazin lisans koltugunu bosaltir; verileri silmez.

## Musteri odeme yapmazsa

Veri guvenligi acisindan lisans iptali veri silme islemi olmamalidir.

Onerilen politika:

- Odeme gecikirse once uyari verilir.
- Kisa bir ek sure taninir.
- Sonrasinda yeni yedekleme/senkron veya yeni is olusturma kisitlanabilir.
- Musterinin kendi verisini goruntulemesi engellenmemelidir.
- Veri silme kesinlikle otomatik yapilmamalidir.

Pratik operasyon:

- Tam kapatma yerine salt-okunur mod hedeflenmelidir.
- Salt-okunur modda musteri eski kayitlarini, PDF'lerini ve cari bilgilerini gorebilir.
- Yeni kayit, duzenleme, yedekleme veya paylasim gibi aktif islemler kisitlanabilir.

## Lisans sunucusu veya Firebase erisilemezse

Beklenen davranis:

- Yerel SQLite verisi cihazda kalir.
- Uygulama mevcut lokal veriyi acabilmelidir.
- Bulut yedekleme ve buluttan geri yukleme gecici olarak calismayabilir.
- Lisans kontrolu yapilamadigi icin kullanici verisi silinmemelidir.

Operasyon karari:

- Sunucu gecici kapaliysa musterinin verisine erisimi kesilmemeli.
- Uygulama en azindan mevcut lokal kayitlari goruntuleyebilmelidir.
- Sunucu geri geldiginde yedek/senkron tekrar denenmelidir.

## Kurtarma senaryolari

### Uygulama acilmiyor

1. APK surumu ve telefon modeli alinir.
2. Firebase `errorReports` kontrol edilir.
3. Kullaniciya uygulamayi tamamen kapatip acmasi soylenir.
4. Gerekirse yeni APK verilir.
5. Uygulama silinmeden once yedek durumu kontrol edilir.

### Kullanici verileri goremiyor

1. Firma kodu kontrol edilir.
2. Firebase Authentication kullanicisi kontrol edilir.
3. `licenses/{firmaKodu}` dokumaninda `isActive`, `maxUsers`, `activeUserIds` kontrol edilir.
4. `companies/{firmaKodu}` altinda veri var mi kontrol edilir.
5. Gerekirse `Buluttan Al` islemi yaptirilir.

### Telefon kayboldu

1. Firebase'deki son yedek kontrol edilir.
2. Eski UID lisans koltugundan pasife alinir.
3. Yeni cihaza APK kurulur.
4. Firma kodu ve hesapla veriler geri yuklenir.

### Lisans doldu

1. `licenses/{firmaKodu}.activeUserIds` kontrol edilir.
2. Eski veya test cihazlari pasife alinir.
3. Gerekirse `maxUsers` artirilir.
4. Kullaniciya verilerin silinmedigi, yalnizca cihaz limiti nedeniyle giris kisitlandigi aciklanir.

## Teslimde musteriye verilecek kisa metin

"Bu uygulamada veriler once telefonunuzda tutulur, internet varsa Firebase'e yedeklenir. Lisans veya odeme problemi olursa verileriniz silinmez. Telefon degistirirken once buluta yedek alinir, yeni telefonda firma kodu ile geri yuklenir. Destek icin firma kodu, telefon modeli ve sorun ekranini iletmeniz yeterlidir."
