import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public', 'icon.svg');
const build = path.join(root, 'build');
await fs.mkdir(build, { recursive: true });
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const size of sizes) {
  const output = path.join(build, `icon-${size}.png`);
  await sharp(source, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toFile(output);
  pngs.push(output);
}
await fs.writeFile(path.join(build, 'icon.png'), await fs.readFile(path.join(build, 'icon-256.png')));
await fs.writeFile(path.join(build, 'icon.ico'), await pngToIco(pngs));
process.stdout.write(`Generated ${path.join(build, 'icon.ico')}\n`);
