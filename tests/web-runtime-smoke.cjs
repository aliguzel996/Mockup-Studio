const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const target = process.argv.find((value) => /^https?:\/\//.test(value)) || 'http://127.0.0.1:4173/';

const waitFor = async (window, expression, timeout = 12000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`, true)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
};

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1600,
    height: 1000,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  window.webContents.on('console-message', (_event, level, message) => process.stderr.write(`[renderer:${level}] ${message}\n`));
  try {
    await window.loadURL(target);
    process.stderr.write('[phase] shell\n');
    await waitFor(window, `document.querySelector('.app-shell')`);
    const shell = await window.webContents.executeJavaScript(`(() => ({
      desktopApi: Boolean(window.rms),
      screenshotUpload: /upload screenshot|ekran görüntüsü yükle/i.test(document.body.textContent || ''),
      tabs: Array.from(document.querySelectorAll('.inspector-tabs button')).map((button) => button.textContent.trim()),
      outputToggles: Array.from(document.querySelectorAll('.inspector-tabs button')).at(-1)?.textContent.trim(),
      iframe: Boolean(document.querySelector('.live-screen iframe')),
      webview: Boolean(document.querySelector('.live-screen webview')),
    }))()`, true);
    assert.equal(shell.desktopApi, false);
    assert.equal(shell.screenshotUpload, false);
    assert.equal(shell.iframe, true);
    assert.equal(shell.webview, false);
    assert.match(shell.outputToggles, /çıktı|output/i);

    process.stderr.write('[phase] navigate fixture\n');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('input[aria-label="URL"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, new URL('qa.html', location.href).href);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()`, true);
    await waitFor(window, `document.querySelector('.live-screen iframe')?.contentDocument?.querySelector('#qa-status')`);
    process.stderr.write('[phase] advanced controls\n');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.inspector-tabs button')[2].click()`, true);
    await waitFor(window, `document.querySelectorAll('.page-element-item').length > 0`);

    const pageControls = await window.webContents.executeJavaScript(`(() => {
      const advanced = document.querySelector('.inspector-scroll');
      const text = advanced.textContent || '';
      const pageItems = Array.from(document.querySelectorAll('.page-element-item small')).map((item) => item.textContent.trim());
      return { text, pageItems };
    })()`, true);
    assert.match(pageControls.text, /sayfa elemanları|page elements/i);
    assert.ok(pageControls.pageItems.some((item) => item.includes('#qa-status')));

    const advancedApplied = await window.webContents.executeJavaScript(`(() => {
      const textarea = document.querySelector('.inspector-scroll textarea');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, '#qa-status{outline:3px solid rgb(1,2,3)!important}');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const eye = document.querySelector('.page-element-eye');
        eye.click();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const iframe = document.querySelector('.live-screen iframe');
          const iframeDocument = iframe.contentDocument;
          const iframeStyle = iframe.contentWindow.getComputedStyle.bind(iframe.contentWindow);
          resolve({
            injected: iframeDocument.querySelector('#__rms_page_presentation')?.textContent || '',
            rootVisibility: iframeStyle(iframeDocument.documentElement).visibility,
            bodyVisibility: iframeStyle(iframeDocument.body).visibility,
            targetVisibility: iframeStyle(iframeDocument.querySelector('#qa-status')).visibility,
            targetOutline: iframeStyle(iframeDocument.querySelector('#qa-status')).outlineWidth,
          });
        }));
      })));
    })()`, true);
    assert.match(advancedApplied.injected, /#qa-status\{visibility:hidden!important\}/);
    assert.equal(advancedApplied.rootVisibility, 'visible');
    assert.equal(advancedApplied.bodyVisibility, 'visible');
    assert.equal(advancedApplied.targetVisibility, 'hidden');
    assert.equal(advancedApplied.targetOutline, '3px');

    process.stderr.write('[phase] output controls\n');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.inspector-tabs button')[3].click()`, true);
    await waitFor(window, `document.querySelector('.inspector-scroll')?.textContent?.match(/scrollbar gizle|hide scrollbar/i)`);
    const toggleLabels = await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.toggle-row')).map((row) => row.textContent.trim())`, true);
    process.stderr.write(`[toggles] ${JSON.stringify(toggleLabels)}\n`);
    const toggles = await window.webContents.executeJavaScript(`(() => {
      const rows = Array.from(document.querySelectorAll('.toggle-row'));
      const scrollbar = rows.find((row) => /scrollbar gizle|hide scrollbar/i.test(row.textContent || ''));
      const cursor = rows.find((row) => /mleci gizle|hide cursor/i.test(row.textContent || ''));
      scrollbar.querySelector('input').click();
      cursor.querySelector('input').click();
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const iframe = document.querySelector('.live-screen iframe');
        const injected = iframe.contentDocument.querySelector('#__rms_page_presentation')?.textContent || '';
        resolve({ scrolling: iframe.getAttribute('scrolling'), pointerEvents: iframe.style.pointerEvents, injected });
      })));
    })()`, true);
    assert.equal(toggles.scrolling, 'no');
    assert.equal(toggles.pointerEvents, 'none');
    assert.match(toggles.injected, /scrollbar-width:none/);
    assert.match(toggles.injected, /cursor:none/);

    const downloadPath = path.join(os.tmpdir(), `rms-web-runtime-${Date.now()}.png`);
    const downloadFinished = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Web export download timed out.')), 15000);
      window.webContents.session.once('will-download', (_event, item) => {
        item.setSavePath(downloadPath);
        item.once('done', (_doneEvent, state) => {
          clearTimeout(timer);
          state === 'completed' ? resolve() : reject(new Error(`Web export ended with ${state}.`));
        });
      });
    });
    await window.webContents.executeJavaScript(`document.querySelector('.primary-wide').click()`, true);
    await downloadFinished;
    const exported = await fs.readFile(downloadPath);
    await fs.rm(downloadPath, { force: true });
    assert.ok(exported.length > 20000, `Web export was unexpectedly small: ${exported.length}`);
    assert.equal(exported.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

    process.stdout.write(`${JSON.stringify({ ok: true, shell, pageControls, advancedApplied, toggles, exportBytes: exported.length }, null, 2)}\n`);
  } finally {
    if (!window.isDestroyed()) window.destroy();
    app.quit();
  }
}).catch((error) => {
  console.error(error.stack || error);
  app.exit(1);
});
