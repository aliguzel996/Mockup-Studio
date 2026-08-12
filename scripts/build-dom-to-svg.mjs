import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(root, 'node_modules', 'dom-to-svg', 'lib', 'index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'RMSSVG',
  minify: true,
  outfile: path.join(root, 'electron', 'dom-to-svg.bundle.js'),
});
