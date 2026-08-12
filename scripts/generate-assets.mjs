import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public', 'icon.svg');
const build = path.join(root, 'build');
const publicDir = path.join(root, 'public');
const docsDir = path.join(root, 'docs');
await fs.mkdir(build, { recursive: true });
await fs.mkdir(docsDir, { recursive: true });
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const size of sizes) {
  const output = path.join(build, `icon-${size}.png`);
  await sharp(source, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toFile(output);
  pngs.push(output);
}
await fs.writeFile(path.join(build, 'icon.png'), await fs.readFile(path.join(build, 'icon-256.png')));
const ico = await pngToIco(pngs);
await fs.writeFile(path.join(build, 'icon.ico'), ico);
await fs.copyFile(path.join(build, 'icon-16.png'), path.join(publicDir, 'favicon-16.png'));
await fs.copyFile(path.join(build, 'icon-32.png'), path.join(publicDir, 'favicon-32.png'));
await fs.writeFile(path.join(publicDir, 'favicon.ico'), ico);
await sharp(source, { density: 384 }).resize(180, 180, { fit: 'contain' }).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
await sharp(source, { density: 384 }).resize(192, 192, { fit: 'contain' }).png().toFile(path.join(publicDir, 'icon-192.png'));
await sharp(source, { density: 384 }).resize(512, 512, { fit: 'contain' }).png().toFile(path.join(publicDir, 'icon-512.png'));
await fs.copyFile(path.join(build, 'icon-256.png'), path.join(docsDir, 'logo.png'));
process.stdout.write(`Generated Windows, web, PWA and documentation icons from ${source}\n`);
