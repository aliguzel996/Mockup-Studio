import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'chrome120',
    sourcemap: false,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        qa: resolve(import.meta.dirname, 'qa.html'),
      },
    },
  },
});
