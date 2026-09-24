import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const versionCode = 13002;
const deliveryBase = process.env.RMS_DELIVERY_DIR
  ? path.resolve(process.env.RMS_DELIVERY_DIR)
  : path.resolve(root, '..', '..', 'deliveries');
const delivery = path.join(deliveryBase, `Responsive-Mockup-Studio-${version}`);
const staging = path.join(deliveryBase, `.responsive-mockup-studio-${version}-staging`);

const assertInside = (parent, child) => {
  if (child !== parent && !child.startsWith(parent + path.sep)) throw new Error(`Unsafe path outside ${parent}: ${child}`);
};
assertInside(deliveryBase, delivery);
assertInside(deliveryBase, staging);
await fs.mkdir(deliveryBase, { recursive: true });
await fs.rm(delivery, { recursive: true, force: true });
await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(delivery, { recursive: true });
await fs.mkdir(staging, { recursive: true });

const dirs = Object.fromEntries(['ANDROID', 'WEB-CPANEL', 'WINDOWS', 'STORE', 'SOURCE', 'REPORT'].map((name) => [name, path.join(delivery, name)]));
await Promise.all(Object.values(dirs).map((directory) => fs.mkdir(directory, { recursive: true })));

const sha256 = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
};
const runNpm = (args) => run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`]);
const walkFiles = async (directory) => {
  const files = [];
  const visit = async (current) => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  await visit(directory);
  return files.sort((left, right) => left.localeCompare(right));
};
const zipFolder = (source, destination) => {
  fsSync.rmSync(destination, { force: true });
  const entries = fsSync.readdirSync(source).sort((left, right) => left.localeCompare(right));
  run('tar.exe', ['-a', '-c', '-f', destination, '-C', source, ...entries]);
};

// Android: signed update-compatible artifacts and verification manifest.
const androidRelease = path.join(root, 'release', 'android');
const apkName = `Responsive-Mockup-Studio-${version}-${versionCode}.apk`;
const aabName = `Responsive-Mockup-Studio-${version}-${versionCode}.aab`;
const androidManifestName = `Responsive-Mockup-Studio-Android-${version}.json`;
for (const name of [apkName, aabName, androidManifestName]) {
  await fs.copyFile(path.join(androidRelease, name), path.join(dirs.ANDROID, name));
}
if (fsSync.existsSync(path.join(androidRelease, 'aab-jarsigner-verify.txt'))) {
  await fs.copyFile(path.join(androidRelease, 'aab-jarsigner-verify.txt'), path.join(dirs.ANDROID, 'aab-jarsigner-verify.txt'));
}
await fs.writeFile(path.join(dirs.ANDROID, 'KURULUM-VE-GUNCELLEME-TR.txt'), [
  `Kurulacak APK: ${apkName}`,
  'Paket kimliği: co.ycswu.responsivemockupstudio',
  `Sürüm: ${version} / versionCode ${versionCode}`,
  '',
  'İlk kurulum: Android Ayarlar > Bilinmeyen uygulama yükleme iznini dosya yöneticin için aç, APK dosyasına dokun ve Kur seç.',
  'Güncelleme: Daha sonraki APK aynı applicationId ve aynı imzayla, daha yüksek versionCode ile üretildiğinde eskisini kaldırmadan üzerine kurulabilir.',
  'Projeler ve tercihler uygulamanın yerel WebView depolamasındadır. Uygulamayı kaldırmak yerel verileri siler; güncelleme kaldırmaz.',
  '',
  'Tablet kontrol listesi:',
  '- Dikey ve yatay yönde arayüzü çevir.',
  '- Tek parmak/kalemle cihazı taşı; iki parmakla pinch zoom yap.',
  '- URL alanına yaz, panel ve slider kontrollerini dokunarak kullan.',
  '- Görsel dosya seçiciyi açıp Geri/İptal ile çık.',
  '- PNG ve SVG çıktı al; Downloads/Responsive Mockup Studio klasörünü kontrol et.',
  '- Uygulamayı kapatıp aç; tema, bookmark, recent URL ve proje durumunu kontrol et.',
  '',
  'Fiziksel Android tablet testi bu teslimi üreten bilgisayarda yapılmadı.',
].join('\r\n'), 'utf8');

// cPanel: clean root ZIP, versioned entry point, local font licenses, no hidden .htaccess dependency.
const webStage = path.join(staging, 'cpanel-root');
await fs.cp(path.join(root, 'dist'), webStage, { recursive: true });
await fs.rm(path.join(webStage, 'qa.html'), { force: true });
await fs.rm(path.join(webStage, '.htaccess'), { force: true });
for (const entry of await fs.readdir(path.join(webStage, 'assets'))) {
  if (/^qa-.*\.js$/i.test(entry)) await fs.rm(path.join(webStage, 'assets', entry), { force: true });
}
await fs.copyFile(path.join(webStage, 'index.html'), path.join(webStage, `index-${version}.html`));
await fs.copyFile(path.join(root, 'app.manifest.json'), path.join(webStage, 'app.manifest.json'));
await fs.copyFile(path.join(root, 'DEPLOY-CPANEL-TR.md'), path.join(webStage, 'DEPLOY-CPANEL-TR.md'));
await fs.copyFile(path.join(root, 'LICENSE'), path.join(webStage, 'LICENSE.txt'));
const licenseDir = path.join(webStage, 'THIRD-PARTY-LICENSES');
await fs.mkdir(licenseDir, { recursive: true });
await fs.copyFile(path.join(root, 'node_modules', '@fontsource', 'space-grotesk', 'LICENSE'), path.join(licenseDir, 'Space-Grotesk-OFL.txt'));
await fs.copyFile(path.join(root, 'node_modules', '@fontsource', 'space-mono', 'LICENSE'), path.join(licenseDir, 'Space-Mono-OFL.txt'));
await fs.writeFile(path.join(webStage, `release-${version}.json`), JSON.stringify({
  product: 'Responsive Mockup Studio', version, versionCode, path: '/mockup-studio/', privacy: '#privacy-policy', generatedAt: new Date().toISOString(),
}, null, 2), 'utf8');

const cpanelRequired = [
  'index.html', `index-${version}.html`, `release-${version}.json`, 'assets', 'icon.svg', 'favicon.ico',
  'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.png',
  'robots.txt', 'sitemap.xml', 'site.webmanifest', 'llms.txt', 'app.manifest.json', 'THIRD-PARTY-LICENSES',
];
for (const required of cpanelRequired) await fs.access(path.join(webStage, required));
if (fsSync.existsSync(path.join(webStage, '.htaccess'))) throw new Error('cPanel package unexpectedly contains .htaccess');
const webIndex = await fs.readFile(path.join(webStage, 'index.html'), 'utf8');
for (const expected of ['./assets/', 'https://ycswu.co/mockup-studio/', 'Content-Security-Policy', 'application/ld+json']) {
  if (!webIndex.includes(expected)) throw new Error(`cPanel index is missing ${expected}`);
}

const cpanelZipName = `Responsive-Mockup-Studio-Web-cPanel-${version}.zip`;
const cpanelZip = path.join(dirs['WEB-CPANEL'], cpanelZipName);
zipFolder(webStage, cpanelZip);
const zipEntries = run('tar.exe', ['-tf', cpanelZip]).split(/\r?\n/).filter(Boolean).map((entry) => entry.replaceAll('\\', '/'));
const normalizedEntries = zipEntries.map((entry) => entry.replace(/^\.\//, '').replace(/\/$/, ''));
if (normalizedEntries.some((entry) => !entry || entry.startsWith('/') || entry.includes('../') || /^[A-Za-z]:/.test(entry))) throw new Error('cPanel ZIP has unsafe paths');
const folded = new Map();
for (const entry of normalizedEntries) {
  const key = entry.toLocaleLowerCase('en-US');
  if (folded.has(key) && folded.get(key) !== entry) throw new Error(`Case-colliding ZIP entries: ${folded.get(key)} / ${entry}`);
  folded.set(key, entry);
}
for (const required of cpanelRequired.filter((entry) => !['assets', 'THIRD-PARTY-LICENSES'].includes(entry))) {
  if (!normalizedEntries.includes(required)) throw new Error(`cPanel ZIP is missing ${required}`);
}

const cleanExtract = path.join(staging, 'clean-extract');
const updateExtract = path.join(staging, 'update-extract');
await fs.mkdir(cleanExtract, { recursive: true });
await fs.mkdir(updateExtract, { recursive: true });
run('tar.exe', ['-xf', cpanelZip, '-C', cleanExtract]);
await fs.writeFile(path.join(updateExtract, 'index.html'), 'OLD INDEX', 'utf8');
await fs.mkdir(path.join(updateExtract, 'assets'), { recursive: true });
await fs.writeFile(path.join(updateExtract, 'assets', 'old-cache-file.js'), 'old', 'utf8');
run('tar.exe', ['-xf', cpanelZip, '-C', updateExtract]);
const stagedFiles = await walkFiles(webStage);
for (const stagedFile of stagedFiles) {
  const relative = path.relative(webStage, stagedFile);
  const cleanFile = path.join(cleanExtract, relative);
  const updateFile = path.join(updateExtract, relative);
  if (await sha256(stagedFile) !== await sha256(cleanFile)) throw new Error(`Clean extraction mismatch: ${relative}`);
  if (await sha256(stagedFile) !== await sha256(updateFile)) throw new Error(`Update extraction mismatch: ${relative}`);
}
await fs.copyFile(path.join(root, 'DEPLOY-CPANEL-TR.md'), path.join(dirs['WEB-CPANEL'], 'DEPLOY-CPANEL-TR.md'));
await fs.writeFile(path.join(dirs['WEB-CPANEL'], 'SINGLE-FILE-NOT-PROVIDED.txt'), [
  'Tek dosyalı index.html bu sürümde verilmedi.',
  'Uygulama kod bölme, dinamik export modülleri ve yerel font dosyaları kullanır. Bunları tek HTML içine zorlamak çalışma zamanı ve export güvenilirliğini azaltacağı için doğrulanmış çok dosyalı statik paket tercih edildi.',
].join('\r\n'), 'utf8');

// Windows artifacts. A Microsoft Store identity is intentionally not fabricated.
const windowsRelease = path.join(root, 'release', 'windows');
const setupName = `Responsive-Mockup-Studio-Setup-${version}-x64.exe`;
const portableName = `Responsive-Mockup-Studio-Portable-${version}-x64.exe`;
for (const name of [setupName, portableName]) await fs.copyFile(path.join(windowsRelease, name), path.join(dirs.WINDOWS, name));
await fs.writeFile(path.join(dirs.WINDOWS, 'WINDOWS-DURUMU-TR.txt'), [
  `Setup: ${setupName}`,
  `Portable: ${portableName}`,
  'Bu EXE dosyaları uygulama tarafından üretilen güncel Windows sürümüdür. Microsoft Store imzalı MSIX değildir.',
  'Partner Center kimliği ve mağaza imza sertifikası bulunmadığı için MSIX/MSIXUPLOAD üretilmedi ve Store yayını yapılmadı.',
].join('\r\n'), 'utf8');

// Store drafts, real screenshots, icons, and Play bundle.
await fs.cp(path.join(root, 'store'), dirs.STORE, { recursive: true });
const playDir = path.join(dirs.STORE, 'Google-Play');
const microsoftDir = path.join(dirs.STORE, 'Microsoft-Store');
const screenshotTarget = path.join(dirs.STORE, 'Screenshots');
const iconTarget = path.join(dirs.STORE, 'Icons');
await Promise.all([playDir, microsoftDir, screenshotTarget, iconTarget].map((directory) => fs.mkdir(directory, { recursive: true })));
await fs.copyFile(path.join(androidRelease, aabName), path.join(playDir, aabName));
for (const name of ['google-play-listing-en.md', 'google-play-listing-tr.md', 'google-play-data-safety-en.md', 'release-notes-en.txt', 'release-notes-tr.txt']) {
  await fs.copyFile(path.join(root, 'store', name), path.join(playDir, name));
}
for (const name of ['microsoft-store-listing-en.md', 'release-notes-en.txt', 'release-notes-tr.txt', 'STORE-IDENTITY-REQUIRED.md']) {
  await fs.copyFile(path.join(root, 'store', name), path.join(microsoftDir, name));
}
for (const name of ['icon.svg', 'icon-512.png', 'icon-192.png']) await fs.copyFile(path.join(root, 'public', name), path.join(iconTarget, name));
for (const screenshot of await fs.readdir(path.join(root, 'release', 'store-screenshots'))) {
  if (/\.png$/i.test(screenshot)) await fs.copyFile(path.join(root, 'release', 'store-screenshots', screenshot), path.join(screenshotTarget, screenshot));
}
await fs.writeFile(path.join(microsoftDir, 'MSIX-NOT-BUILT.txt'), 'Partner Center product identity and its signing certificate are required before a truthful Store-signed MSIX/MSIXUPLOAD can be built. No placeholder identity was used.\r\n', 'utf8');

// Source ZIP excludes builds, generated web assets, and all private signing material.
const sourceStage = path.join(staging, 'source');
await fs.cp(root, sourceStage, {
  recursive: true,
  filter: (source) => {
    const relative = path.relative(root, source);
    if (!relative) return true;
    const normalized = relative.replaceAll('\\', '/');
    const first = normalized.split('/')[0];
    if (['node_modules', 'release', 'dist', '.git'].includes(first) || first.startsWith('qa-') || first.startsWith('.tmp-')) return false;
    if (normalized === 'android/local.properties' || normalized.startsWith('android/.gradle/') || normalized.startsWith('android/app/build/') || normalized.startsWith('android/app/src/main/assets/')) return false;
    if (/\.(?:jks|keystore|p12|pfx)$/i.test(normalized) || /signing\.properties$/i.test(normalized)) return false;
    return true;
  },
});
const sourceFiles = await walkFiles(sourceStage);
for (const file of sourceFiles) {
  const relative = path.relative(sourceStage, file).replaceAll('\\', '/');
  if (/\.(?:jks|keystore|p12|pfx)$/i.test(relative) || /local\.properties$|signing\.properties$/i.test(relative)) throw new Error(`Private signing material entered source stage: ${relative}`);
}
const sourceZipName = `Responsive-Mockup-Studio-Source-${version}.zip`;
zipFolder(sourceStage, path.join(dirs.SOURCE, sourceZipName));

const cpanelAudit = {
  zip: cpanelZipName,
  entries: normalizedEntries.length,
  safeRelativeForwardSlashPaths: true,
  caseCollisions: 0,
  hiddenHtaccessIncluded: false,
  cleanExtractionVerified: true,
  updateOverwriteVerified: true,
  versionedEntry: `index-${version}.html`,
};
await fs.writeFile(path.join(dirs.REPORT, 'cpanel-audit.json'), JSON.stringify(cpanelAudit, null, 2), 'utf8');
await fs.copyFile(path.join(androidRelease, androidManifestName), path.join(dirs.REPORT, androidManifestName));
const qaCandidates = [];
for (const entry of await fs.readdir(path.join(root, 'release'), { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('qa-')) continue;
  const reportPath = path.join(root, 'release', entry.name, 'qa-report.json');
  const stat = await fs.stat(reportPath).catch(() => null);
  if (stat) qaCandidates.push({ directory: path.dirname(reportPath), reportPath, modifiedAt: stat.mtimeMs });
}
qaCandidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
const latestQa = qaCandidates[0];
if (!latestQa) throw new Error('A passing desktop smoke QA report is required before packaging');
const desktopQa = JSON.parse(await fs.readFile(latestQa.reportPath, 'utf8'));
if (!desktopQa.passed) throw new Error(`Desktop smoke QA did not pass: ${latestQa.reportPath}`);
await fs.copyFile(latestQa.reportPath, path.join(dirs.REPORT, `desktop-smoke-${version}.json`));
const dependencyAudit = JSON.parse(runNpm(['audit', '--json']));
const productionAudit = JSON.parse(runNpm(['audit', '--omit=dev', '--json']));
if (dependencyAudit.metadata?.vulnerabilities?.total !== 0 || productionAudit.metadata?.vulnerabilities?.total !== 0) {
  throw new Error('Dependency audit must be clean before packaging');
}
await fs.writeFile(path.join(dirs.REPORT, 'npm-audit-all.json'), JSON.stringify(dependencyAudit, null, 2), 'utf8');
await fs.writeFile(path.join(dirs.REPORT, 'npm-audit-production.json'), JSON.stringify(productionAudit, null, 2), 'utf8');
for (const name of ['electron-ui-1600x980.png', 'electron-device-panel-1600x980.png', 'electron-framing-1600x980.png']) {
  const source = path.join(latestQa.directory, name);
  if (fsSync.existsSync(source)) await fs.copyFile(source, path.join(screenshotTarget, `windows-${name}`));
}
await fs.writeFile(path.join(dirs.REPORT, 'TESLIM-RAPORU-TR.md'), [
  '# Responsive Mockup Studio 1.3.2 teslim raporu',
  '',
  '## Değişiklik',
  '',
  '- Web sitesi içindeki canvas ve video gibi dinamik pikseller PNG/JPG/SVG çıktılarında korunacak şekilde export zinciri düzeltildi.',
  '- Android sürümünde farklı kaynaktan açılan web siteleri, görünen ekran bölgesini yerel PixelCopy ile yakalayarak eksiksiz dışa aktarır.',
  '- Web ve Windows SVG yakalama işlemi, dinamik medya katmanlarını veri görseline dönüştürüp cihaz kompozisyonuna tek kez yerleştirir.',
  '- Kullanıcının sağladığı yeni SVG logo web faviconu, PWA, Windows ve Android ikonlarına uygulandı.',
  '- Gerçek canvas deseninin export dosyasında bulunduğu piksel analiziyle otomatik doğrulandı.',
  '',
  '## Durum',
  '',
  '- İmzalı APK: üretildi ve statik olarak doğrulandı.',
  '- Google Play AAB: üretildi; Play Console internal testine yüklenmedi.',
  '- Windows Setup/Portable: üretildi; Microsoft Store MSIX kimliği olmadığı için Store paketi üretilmedi.',
  '- cPanel ZIP: temiz ve mevcut dosya üzerine extraction senaryolarında doğrulandı; canlı sunucuya yüklenmedi.',
  `- Windows tam smoke QA: geçti (${Object.keys(desktopQa.assertions || {}).length} assertion, ${(desktopQa.exports || []).length} gerçek çıktı, ${(desktopQa.captures || []).length} capture, ${(desktopQa.errors || []).length} hata).`,
  '- npm üretim ve tam bağımlılık güvenlik taraması: 0 bilinen açık.',
  '- Fiziksel Android tablet, canlı ycswu.co ve mağaza onayı test edilmedi.',
  '',
  '## Kullanıcının kalan adımı',
  '',
  `1. ANDROID/${apkName} dosyasını tablete kurup ANDROID/KURULUM-VE-GUNCELLEME-TR.txt listesini uygula.`,
  `2. WEB-CPANEL/${cpanelZipName} dosyasını cPanel'de public_html/mockup-studio/ içine temiz klasöre çıkart.`,
  '3. Yükleme sonrası https://ycswu.co/mockup-studio/ ve https://ycswu.co/mockup-studio/#privacy-policy adreslerini doğrulat.',
  '4. Google Play internal test ve Microsoft Partner Center kimlik bilgilerini mağaza gönderiminden önce sağla.',
].join('\r\n'), 'utf8');

await fs.writeFile(path.join(delivery, 'START-HERE-TR.txt'), [
  'RESPONSIVE MOCKUP STUDIO 1.3.2',
  '',
  `Android tablet kurulumu: ANDROID/${apkName}`,
  `Google Play paketi: ANDROID/${aabName}`,
  `cPanel yükleme paketi: WEB-CPANEL/${cpanelZipName}`,
  `Windows kurulum: WINDOWS/${setupName}`,
  `Windows portable: WINDOWS/${portableName}`,
  `Kaynak: SOURCE/${sourceZipName}`,
  'Mağaza metinleri, ikonlar ve ekran görüntüleri: STORE/',
  'Durum, sınırlar ve kalan adımlar: REPORT/TESLIM-RAPORU-TR.md',
  'Tüm SHA-256 değerleri: REPORT/SHA256SUMS.txt',
].join('\r\n'), 'utf8');

// Final checksums for every payload except the checksum files themselves.
const payloadFiles = (await walkFiles(delivery)).filter((file) => !/SHA256SUMS\.(?:json|txt)$/i.test(file));
const checksums = [];
for (const file of payloadFiles) {
  const stat = await fs.stat(file);
  checksums.push({ file: path.relative(delivery, file).replaceAll('\\', '/'), bytes: stat.size, sha256: await sha256(file) });
}
await fs.writeFile(path.join(dirs.REPORT, 'SHA256SUMS.json'), JSON.stringify({ product: 'Responsive Mockup Studio', version, generatedAt: new Date().toISOString(), files: checksums }, null, 2), 'utf8');
await fs.writeFile(path.join(dirs.REPORT, 'SHA256SUMS.txt'), `${checksums.map((item) => `${item.sha256}  ${item.file}`).join('\n')}\n`, 'utf8');

await fs.rm(staging, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({ delivery, version, apk: path.join(dirs.ANDROID, apkName), cpanelZip, checksums: checksums.length, cpanelAudit }, null, 2)}\n`);
