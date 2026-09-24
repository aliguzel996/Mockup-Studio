import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electron = process.platform === 'win32'
  ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(root, 'node_modules', 'electron', 'dist', 'electron');
const url = 'http://127.0.0.1:4173/';
const screenshotDir = path.join(root, 'release', 'store-screenshots');

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options });
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code ?? signal}`)));
});

const preview = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173'], { cwd: root, stdio: 'ignore', windowsHide: true });
try {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (Date.now() >= deadline) throw new Error('Vite preview did not start in time');
  await run(electron, ['tests/web-runtime-smoke.cjs', url]);
  await run(electron, ['tests/tablet-runtime-smoke.cjs', url], { env: { ...process.env, RMS_SCREENSHOT_DIR: screenshotDir } });
} finally {
  preview.kill();
}
