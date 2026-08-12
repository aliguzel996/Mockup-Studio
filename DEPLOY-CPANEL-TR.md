# GoDaddy cPanel kurulumu

Hazır paket: `Responsive-Mockup-Studio-Web-cPanel-1.2.5.zip`

Hedef adres: `https://ycswu.co/mockup-studio/`

1. GoDaddy cPanel > File Manager'ı aç.
2. `public_html` içine gir.
3. Burada `mockup-studio` adında bir klasör oluştur.
4. ZIP dosyasını `public_html/mockup-studio` içine yükle.
5. ZIP'i seçip **Extract** de; hedef aynı `mockup-studio` klasörü olsun.
6. Çıkartma sonunda `public_html/mockup-studio/index.html` bulunduğunu kontrol et. `mockup-studio/Responsive-Mockup-Studio-Web/...` gibi fazladan iç klasör olmamalı.
7. ZIP dosyasını sunucudan silebilirsin.
8. `https://ycswu.co/mockup-studio/` adresini gizli sekmede aç.

## Beklenen kök dosyalar

- `.htaccess`
- `index.html`
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
- cPanel gizli dosyaları göstermiyorsa Settings > **Show Hidden Files** ile `.htaccess` dosyasını kontrol et.

Web sürümü normal tarayıcı güvenlik kurallarına uyar. `X-Frame-Options` veya CSP ile iframe kullanımını engelleyen harici siteler web uygulamasının iç ekranında açılmayabilir; bu tür sitelerin sınırsız capture'ı Windows sürümünde yapılır.
