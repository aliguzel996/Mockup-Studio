# GoDaddy cPanel kurulumu

Hazır paket: `Responsive-Mockup-Studio-Web-cPanel-1.3.7.zip`

Hedef adres: `https://ycswu.co/mockup-studio/`

1. GoDaddy cPanel > File Manager'ı aç.
2. `public_html` içine gir.
3. Burada `mockup-studio` adında bir klasör oluştur.
4. Önceki sürüm varsa klasörün adını `mockup-studio-backup` yap; boş bir `mockup-studio` klasörü oluştur. Bu yöntem cPanel'in “File already exists” hatasını engeller.
5. ZIP dosyasını yeni `public_html/mockup-studio` klasörüne yükle.
6. ZIP'i seçip **Extract** de; hedef aynı `mockup-studio` klasörü olsun.
7. Çıkartma sonunda `public_html/mockup-studio/index.html` bulunduğunu kontrol et. `mockup-studio/Responsive-Mockup-Studio-Web/...` gibi fazladan iç klasör olmamalı.
8. ZIP dosyasını sunucudan silebilirsin.
9. `https://ycswu.co/mockup-studio/` adresini gizli sekmede aç. Eski cache görünürse sürüme özel `https://ycswu.co/mockup-studio/index-1.3.7.html` adresini bir kez aç.

## Beklenen kök dosyalar

- `index.html`
- `index-1.3.7.html`
- `release-1.3.7.json`
- `assets/`
- `icon.svg`
- `og-image.png`
- `robots.txt`
- `sitemap.xml`
- `site.webmanifest`
- `llms.txt`
- `app.manifest.json`

## Hızlı doğrulama

- Sayfa `200 OK` ile açılmalı.
- Ağ panelinde `assets/*.js` ve `assets/*.css` istekleri `200` dönmeli.
- URL sonunda `/mockup-studio/` bulunmalı.
- `https://ycswu.co/mockup-studio/robots.txt` ve `/sitemap.xml` açılmalı.
- Paket gizli `.htaccess` dosyası kullanmaz. Uygulama hash tabanlı gezinir ve tüm varlık yolları alt klasöre göre görecelidir.

Web sürümü normal tarayıcı güvenlik kurallarına uyar. `X-Frame-Options` veya CSP ile iframe kullanımını engelleyen harici siteler web uygulamasının iç ekranında açılmayabilir; bu tür sitelerin sınırsız capture'ı Windows sürümünde yapılır.
