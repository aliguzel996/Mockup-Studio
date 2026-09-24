import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'dist');
const target = path.join(root, 'android', 'app', 'src', 'main', 'assets');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  throw new Error('dist/index.html is missing. Run npm run build:web first.');
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });
for (const file of ['qa.html']) fs.rmSync(path.join(target, file), { force: true });
for (const entry of fs.readdirSync(path.join(target, 'assets'))) {
  if (/^qa-.*\.js$/i.test(entry)) fs.rmSync(path.join(target, 'assets', entry), { force: true });
}

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(target, 'android-build.json'), JSON.stringify({ version, generatedAt: new Date().toISOString() }, null, 2));
console.log(`Prepared Android web assets for ${version}: ${target}`);
