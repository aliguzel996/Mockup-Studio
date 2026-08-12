# Responsive Mockup Studio

<p align="center"><img src="docs/logo.png" width="256" alt="Responsive Mockup Studio logosu: siyah zemin üzerinde düz çift kontürlü çerçeve"></p>

[English](README.md) · [Türkçe](README.tr.md)

Responsive Mockup Studio, canlı web sitelerini düzenli ve sunuma hazır cihaz görsellerine dönüştüren bir YCSWU Tools creative uygulamasıdır. Responsive tarayıcı viewport'unu, ayarlanabilir cihaz çerçevelerini, kompozisyon kontrollerini ve profesyonel dışa aktarma seçeneklerini tek çalışma alanında birleştirir.

![Responsive Mockup Studio arayüzü](docs/responsive-mockup-studio.png)

## Hangi problemi çözer?

Bir website mockup'ı hazırlamak çoğunlukla tarayıcı, ekran görüntüsü aracı, görsel editörü ve ayrı cihaz dosyaları arasında gidip gelmeyi gerektirir. Website ölçüsü değiştiğinde ekran görüntüsü çerçeveyle eşleşmeyebilir; yüksek çözünürlüklü çıktılarda sayfa esneyebilir, boşluk bırakabilir veya tekrarlanabilir.

Responsive Mockup Studio; websiteyi, viewport'u, cihaz geometrisini ve çıktı kompozisyonunu birbirine bağlı tutar. Kullanıcı gerçek bir URL'yi masaüstü, tablet ve telefon ölçülerinde deneyebilir, cihazın içinde konumlandırabilir, görünümünü düzenleyebilir ve önizlemede gördüğü kompozisyonu dışa aktarabilir.

## Kimler için?

- Portfolyo, case study, sunum ve sosyal medya görselleri hazırlayan tasarımcılar.
- Responsive davranışı kontrol ederken aynı anda sunuma hazır çıktı almak isteyen geliştiriciler.
- Birden fazla müşteri veya sayfa için tutarlı cihaz görselleri üreten ajanslar.
- Web sitelerini farklı viewport ölçülerinde belgeleyen ürün ekipleri.
- Mockup'ları tekrar tekrar görsel editöründe kurmak istemeyen içerik üreticileri.

## Canlı responsive website akışı

Bir URL girildiğinde website seçili cihaz ekranında açılır. Cihaz veya viewport değiştiğinde website gerçek ekran alanını takip eder; responsive breakpoint'ler çerçeveyle eşzamanlı kalır ve sabit ekran görüntüsünden kaynaklanan boşluklar oluşmaz.

Windows sürümü canlı harici siteler, gezinme, oturumlar ve capture için gömülü Chromium kullanır. Statik web sürümü tarayıcının normal gömme kurallarına uyar; iframe veya cross-origin erişimini engelleyen sitelerde Windows sürümü ya da yüklenen bir ekran görüntüsü kullanılabilir.

Tarayıcı çalışma alanı şunları içerir:

- Masaüstü, tablet ve telefon kısayolları.
- Otomatik responsive ölçü veya elle girilen en ve boy.
- En-boy değiştirme ve sıfırlama kontrolleri.
- Geri, ileri ve yenileme işlevli düzenlenebilir adres çubuğu.
- Recent URL listesi ve kalıcı bookmark'lar.
- Scrollbar, imleç, animasyon ve sayfa zemini kontrolleri.
- Özel CSS ve bulunan sayfa elemanları için güvenli görünürlük yönetimi.
- Canlı sayfanın gömülemediği durumlar için ekran görüntüsü yükleme.

## Cihaz mockup'ları

Özel bilgisayar, tablet veya telefon çerçevesi seçilebilir ya da hazır bir ekran oranıyla başlanabilir. Hazır çerçeveler teknik oranlarını korurken desteklenen görünüm özellikleri değiştirilebilir.

Cihaz kontrolleri:

- Renk seçici ve doğrudan HEX girişiyle cihaz rengi.
- Materyal, pürüzlülük, yansıma ve yüzey görünümü.
- Özel cihazlarda çerçeve kalınlığı, ekran boyutu ve köşe geometrisi.
- Mat ekran ve cam yansıması.
- Parça gradient yönü, boyutu ve yumuşaklığı.
- Bağımsız kontür rengi ve kalınlığı bulunan, yalnızca cihazı etkileyen wireframe modu.
- Desteklenen cihazlarda monitör borusu, taban, cihaz detayı, laptop dudağı ve telefon yan tuşlarını kaldırma veya geri getirme.
- Thumbnail'li kayıtlı özel cihazlar ve hazır çerçeveler için kalıcı favoriler.

Wireframe açıldığında website görünür kalır; kontür, ekran içeriğini kapatmak yerine camın dışına doğru büyür.

## Kompozisyon ve kamera

Cihaz yerleşimi çıktıdan sonra düzeltilmek yerine doğrudan önizleme alanında hazırlanır.

- Orta mouse tuşuyla önizlemede hareket etme.
- Mouse tekerleğiyle zoom.
- Kamera X/Y, rotasyon, vertical tilt ve horizontal tilt ayarları.
- Her kontrolü ayrı sıfırlama veya slider'a çift tıklayarak varsayılana dönme.
- Tek tuşla cihazı geometrik merkeze alma.
- İsteğe bağlı 1:1, 4:5 ve 16:9 kompozisyon frame'leri.
- Yatay ve dikey kompozisyon seçimi.
- Cihaz Ayarları panelini görselin önünden uzaklaştırmak için sürükleme.
- Sol Çerçeveler panelini kapatarak cihaz merkezde kalırken önizleme alanını büyütme.

## Arka plan tasarımı

Uygulamadan çıkmadan kompozisyonun çevresi hazırlanabilir:

- Siyah, beyaz, şeffaf veya özel renkli arka plan.
- Yüklenen arka plan görselleri.
- Linear ve radial gradient.
- HEX ve pozisyon kontrollü istenildiği kadar gradient rengi.
- Gradient açısı ve geçiş davranışı.
- Dark ve light uygulama teması.

## Dışa aktarma

Aktif önizleme veya seçilen kompozisyon frame'i şu formatlarda dışa aktarılabilir:

- PNG
- Şeffaf PNG
- JPG
- WebP
- SVG

Raster çıktılarda uzun kenar, DPI ve JPEG/WebP kalitesi ayarlanabilir. Şeffaf PNG, cihazın dışındaki piksellerin şeffaflığını korur.

SVG çıktıda cihaz geometrisi ve uyumlu website grafikleri vektörel kalır. Website metinleri fonttan bağımsız vektör path'lerine dönüştürüldüğü için dosya başka bir bilgisayarda açıldığında yazı görünümü değişmez. Fotoğraflar gerektiğinde gömülü bitmap olarak korunur.

Kaydedilen cihazlar, başka tasarım akışlarında kullanılmak üzere ekranı boş ve zemini şeffaf PNG olarak da dışa aktarılabilir.

## Yerel çalışma alanı ve gizlilik

Bookmark'lar, Recent URL listesi, favoriler, kayıtlı cihazlar ve editör tercihleri yerel tarayıcı veya uygulama profilinde saklanır. Statik web sürümü veritabanı, hesap veya server-side uygulama altyapısı gerektirmez.

## Sürümler

- **Windows Setup:** tam Chromium capture akışına sahip kurulan masaüstü uygulaması.
- **Windows Portable:** kurulum gerektirmeyen aynı masaüstü deneyimi.
- **Web:** normal bir web sunucusunda veya cPanel hesabında çalışabilen statik tarayıcı sürümü.

Responsive Mockup Studio, **YCSWU Tools** ailesinin bir parçasıdır.

MIT lisanslıdır. Ali Guzel / YCSWU tarafından geliştirilmiştir.
