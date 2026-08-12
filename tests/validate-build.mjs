import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const indexPath = path.join(root, 'dist', 'index.html');
const html = await fs.readFile(indexPath, 'utf8');
assert.match(html, /<div id="root"><\/div>/);
assert.match(html, /\.\/assets\//);
const assets = await fs.readdir(path.join(root, 'dist', 'assets'));
assert.ok(assets.some((file) => file.endsWith('.js')));
assert.ok(assets.some((file) => file.endsWith('.css')));
for (const required of ['app.manifest.json', 'AI.md', 'electron/main.cjs', 'electron/preload.cjs', 'metadata/manifest/tool.manifest.json']) {
  await fs.access(path.join(root, required));
}
for (const script of ['electron/main.cjs', 'electron/preload.cjs']) {
  const check = spawnSync(process.execPath, ['--check', path.join(root, script)], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
}
process.stdout.write(`Build validated: ${assets.length} assets\n`);
