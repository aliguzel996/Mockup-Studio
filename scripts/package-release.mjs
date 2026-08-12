import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const outputDir = process.env.RMS_OUTPUT_DIR
  ? path.resolve(process.env.RMS_OUTPUT_DIR)
  : path.resolve(root, '..', '..', 'outputs');
const staging = path.join(outputDir, '.rms-release-staging');
if (!staging.startsWith(outputDir + path.sep)) throw new Error(`Unsafe staging path: ${staging}`);
await fs.mkdir(outputDir, { recursive: true });
await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(staging, { recursive: true });

const webStage = path.join(staging, 'Responsive-Mockup-Studio-Web');
await fs.cp(path.join(root, 'dist'), webStage, { recursive: true });
await fs.rm(path.join(webStage, 'qa.html'), { force: true });
for (const entry of await fs.readdir(path.join(webStage, 'assets'))) {
  if (/^qa-.*\.js$/i.test(entry)) await fs.rm(path.join(webStage, 'assets', entry), { force: true });
}
await fs.copyFile(path.join(root, 'README.md'), path.join(webStage, 'README.md'));
await fs.copyFile(path.join(root, 'README.tr.md'), path.join(webStage, 'README.tr.md'));
await fs.copyFile(path.join(root, 'DEPLOY-CPANEL-TR.md'), path.join(webStage, 'DEPLOY-CPANEL-TR.md'));
await fs.copyFile(path.join(root, 'LICENSE'), path.join(webStage, 'LICENSE'));
await fs.copyFile(path.join(root, 'app.manifest.json'), path.join(webStage, 'app.manifest.json'));

const cpanelRequired = [
  '.htaccess',
  'index.html',
  'assets',
  'icon.svg',
  'favicon.ico',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'og-image.png',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'llms.txt',
  'app.manifest.json',
];
for (const required of cpanelRequired) {
  await fs.access(path.join(webStage, required));
}
const builtIndex = await fs.readFile(path.join(webStage, 'index.html'), 'utf8');
for (const expectation of [
  'https://ycswu.co/mockup-studio/',
  'application/ld+json',
  './assets/',
  './site.webmanifest',
  './llms.txt',
]) {
  if (!builtIndex.includes(expectation)) throw new Error(`cPanel index is missing ${expectation}`);
}

const sourceStage = path.join(staging, 'Responsive-Mockup-Studio-Source');
await fs.cp(root, sourceStage, {
  recursive: true,
  filter: (source) => {
    const relative = path.relative(root, source);
    if (!relative) return true;
    const first = relative.split(path.sep)[0];
    return !['node_modules', 'release', 'dist', '.git', '.release-staging', '.rms-release-staging'].includes(first)
      && !first.startsWith('qa-')
      && !first.startsWith('.tmp-');
  },
});

function zipFolder(source, destination) {
  const entries = fsSync.readdirSync(source);
  fsSync.rmSync(destination, { force: true });
  const result = spawnSync('tar.exe', ['-a', '-c', '-f', destination, '-C', source, ...entries], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `ZIP creation failed for ${source}`);
}

const webZip = path.join(outputDir, `Responsive-Mockup-Studio-Web-${version}.zip`);
const cpanelZip = path.join(outputDir, `Responsive-Mockup-Studio-Web-cPanel-${version}.zip`);
const sourceZip = path.join(outputDir, `Responsive-Mockup-Studio-Source-${version}.zip`);
zipFolder(webStage, webZip);
zipFolder(webStage, cpanelZip);
zipFolder(sourceStage, sourceZip);

const cpanelEntriesResult = spawnSync('tar.exe', ['-tf', cpanelZip], { encoding: 'utf8' });
if (cpanelEntriesResult.status !== 0) throw new Error(cpanelEntriesResult.stderr || 'Unable to inspect cPanel ZIP');
const cpanelEntries = cpanelEntriesResult.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replaceAll('\\', '/'));
for (const required of cpanelRequired) {
  const normalized = required.replaceAll('\\', '/');
  if (!cpanelEntries.some((entry) => entry.replace(/\/$/, '') === normalized)) {
    throw new Error(`cPanel ZIP is missing root entry: ${required}`);
  }
}
if (cpanelEntries.some((entry) => entry.startsWith('/') || entry.includes('../') || /^[A-Za-z]:/.test(entry))) {
  throw new Error('cPanel ZIP contains an unsafe path');
}

const windowsDir = path.join(root, 'release', 'windows');
const windowsFiles = [
  `Responsive-Mockup-Studio-Setup-${version}-x64.exe`,
  `Responsive-Mockup-Studio-Portable-${version}-x64.exe`,
];
const deliverables = [webZip, cpanelZip, sourceZip];
for (const fileName of windowsFiles) {
  const source = path.join(windowsDir, fileName);
  await fs.access(source);
  const destination = path.join(outputDir, fileName);
  await fs.copyFile(source, destination);
  deliverables.push(destination);
}

const qaCandidates = [];
for (const entry of await fs.readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('qa-installed-')) continue;
  const candidate = path.join(root, entry.name, 'qa-report.json');
  const stats = await fs.stat(candidate).catch(() => null);
  if (stats) qaCandidates.push({ path: candidate, modifiedAt: stats.mtimeMs });
}
qaCandidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
const qaSource = qaCandidates[0]?.path;
if (qaSource) {
  const qaDestination = path.join(outputDir, `Responsive-Mockup-Studio-QA-${version}.json`);
  await fs.copyFile(qaSource, qaDestination);
  deliverables.push(qaDestination);
}

const deliveryPath = path.join(outputDir, `Responsive-Mockup-Studio-${version}-DELIVERY.txt`);
await fs.writeFile(deliveryPath, [
  'RESPONSIVE MOCKUP STUDIO / YCSWU',
  `Version: ${version}`,
  '',
  'Windows Setup: run the Setup EXE and choose an installation directory.',
  'Windows Portable: run the Portable EXE directly; no installation is required.',
  'Web: extract the Web ZIP and serve its files over HTTP(S).',
  'cPanel: create public_html/mockup-studio and extract the cPanel ZIP directly inside it.',
  'Expected URL: https://ycswu.co/mockup-studio/',
  '',
  'The Windows executables are not code-signed and may trigger Microsoft SmartScreen.',
  'The static web build follows browser iframe restrictions; unrestricted URL capture is available in the Windows build.',
].join('\r\n'), 'utf8');
deliverables.push(deliveryPath);

const manifest = [];
for (const file of deliverables) {
  const buffer = await fs.readFile(file);
  const stats = await fs.stat(file);
  manifest.push({
    file: path.basename(file),
    bytes: stats.size,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  });
}
const manifestPath = path.join(outputDir, `Responsive-Mockup-Studio-${version}-SHA256.json`);
await fs.writeFile(manifestPath, JSON.stringify({ product: packageJson.build?.productName || packageJson.name, version, generatedAt: new Date().toISOString(), files: manifest }, null, 2));

// Keep the handoff directory and output root on the latest release only.
const currentDir = path.join(outputDir, 'CURRENT');
if (!currentDir.startsWith(outputDir + path.sep)) throw new Error(`Unsafe current release path: ${currentDir}`);
const currentFiles = [...deliverables, manifestPath];
const keepNames = new Set(currentFiles.map((file) => path.basename(file)));
for (const entry of await fs.readdir(outputDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.startsWith('Responsive-Mockup-Studio-') || keepNames.has(entry.name)) continue;
  await fs.rm(path.join(outputDir, entry.name), { force: true });
}
await fs.rm(currentDir, { recursive: true, force: true });
await fs.mkdir(currentDir, { recursive: true });
for (const file of currentFiles) await fs.copyFile(file, path.join(currentDir, path.basename(file)));

await fs.rm(staging, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({ outputDir, manifest }, null, 2)}\n`);
