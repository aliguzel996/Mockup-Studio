const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const target = process.argv.find((value) => /^https?:\/\//.test(value)) || 'http://127.0.0.1:4173/';
const profile = path.join(os.tmpdir(), `rms-tablet-runtime-${process.pid}-${Date.now()}`);
const screenshotDir = process.env.RMS_SCREENSHOT_DIR
  ? path.resolve(process.env.RMS_SCREENSHOT_DIR)
  : path.resolve(__dirname, '..', 'release', 'store-screenshots');
app.setPath('userData', profile);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (window, expression, timeout = 12000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`, true)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
};

const capture = async (window, name, width, height) => {
  window.setSize(width, height);
  await wait(350);
  const image = await window.webContents.capturePage();
  const file = path.join(screenshotDir, name);
  await fs.writeFile(file, image.toPNG());
  return { file, width: image.getSize().width, height: image.getSize().height };
};

app.whenReady().then(async () => {
  await fs.mkdir(screenshotDir, { recursive: true });
  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    backgroundColor: '#080808',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  let screenshotWindow = null;

  try {
    await window.loadURL(target);
    await waitFor(window, `document.querySelector('.preview-canvas') && document.querySelector('.publishing-footer')`);

    const initial = await window.webContents.executeJavaScript(`(() => ({
      drawer: Boolean(document.querySelector('.publishing-drawer')),
      storeDisabled: Array.from(document.querySelectorAll('.publishing-stores button')).every((button) => button.disabled),
      transform: document.querySelector('.stage-camera').style.transform,
    }))()`, true);
    assert.equal(initial.drawer, false, 'Publishing drawer must start closed');
    assert.equal(initial.storeDisabled, true, 'Store links must remain disabled until real listings exist');

    const touch = await window.webContents.executeJavaScript(`(() => {
      const canvas = document.querySelector('.preview-canvas');
      const stage = document.querySelector('.stage-camera');
      const emit = (type, pointerId, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 11,
        clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      }));
      const beforePan = stage.style.transform;
      emit('pointerdown', 11, 180, 260);
      emit('pointermove', 11, 250, 310);
      emit('pointercancel', 11, 250, 310);
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const afterPan = stage.style.transform;
        emit('pointerdown', 21, 280, 310);
        emit('pointerdown', 22, 380, 310);
        emit('pointermove', 22, 460, 310);
        emit('pointerup', 22, 460, 310);
        emit('pointerup', 21, 280, 310);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({
          beforePan,
          afterPan,
          afterPinch: stage.style.transform,
          stuck: canvas.classList.contains('is-panning'),
        })));
      })));
    })()`, true);
    assert.notEqual(touch.afterPan, touch.beforePan, 'A one-finger touch drag must pan the device');
    assert.notEqual(touch.afterPinch, touch.afterPan, 'A two-finger gesture must change zoom or position');
    assert.equal(touch.stuck, false, 'pointercancel/pointerup must not leave the canvas in a panning state');

    const dockDrag = await window.webContents.executeJavaScript(`(() => {
      const dock = document.querySelector('.device-settings-dock');
      const handle = dock.querySelector('[data-dock-drag-handle="true"]');
      const stage = document.querySelector('.stage-camera');
      const rect = handle.getBoundingClientRect();
      const emit = (target, type, x, y) => target.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 71, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      }));
      const stageBefore = stage.style.transform;
      const dockBefore = dock.getBoundingClientRect();
      emit(handle, 'pointerdown', rect.left + rect.width / 2, rect.top + rect.height / 2);
      emit(dock, 'pointermove', rect.left + rect.width / 2 + 80, rect.top + rect.height / 2 - 50);
      emit(dock, 'pointerup', rect.left + rect.width / 2 + 80, rect.top + rect.height / 2 - 50);
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const dockAfter = dock.getBoundingClientRect();
        resolve({ stageBefore, stageAfter: stage.style.transform, moved: Math.hypot(dockAfter.left - dockBefore.left, dockAfter.top - dockBefore.top) });
      })));
    })()`, true);
    assert.equal(dockDrag.stageAfter, dockDrag.stageBefore, 'Dragging the settings handle must not pan the preview');
    assert.ok(dockDrag.moved > 20, 'The settings handle must move the dock on touch input');

    const publishing = await window.webContents.executeJavaScript(`(async () => {
      const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const [aboutButton] = document.querySelectorAll('.publishing-links button');
      aboutButton.click();
      await tick();
      const aboutOpen = Boolean(document.querySelector('#app-about'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await tick();
      const escaped = !document.querySelector('.publishing-drawer');
      history.replaceState(null, '', '#privacy-policy');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await tick();
      const directPrivacy = Boolean(document.querySelector('#privacy-policy'));
      const select = document.querySelector('.publishing-language select');
      select.value = 'de';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await tick();
      const persisted = localStorage.getItem('rms.publishing-language.v1');
      const german = document.querySelector('.publishing-drawer-heading span')?.textContent || '';
      history.replaceState(null, '', '#privacy-policy.html');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await tick();
      return { aboutOpen, escaped, directPrivacy, persisted, german, legacyPrivacy: Boolean(document.querySelector('#privacy-policy')) };
    })()`, true);
    assert.equal(publishing.aboutOpen, true);
    assert.equal(publishing.escaped, true);
    assert.equal(publishing.directPrivacy, true);
    assert.equal(publishing.persisted, 'de');
    assert.match(publishing.german, /Datenschutz/);
    assert.equal(publishing.legacyPrivacy, true);

    screenshotWindow = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      backgroundColor: '#080808',
      webPreferences: { contextIsolation: true, sandbox: true, partition: `rms-tablet-capture-${Date.now()}` },
    });
    await screenshotWindow.loadURL(target);
    await waitFor(screenshotWindow, `document.querySelector('.preview-canvas') && !document.querySelector('.publishing-drawer') && document.querySelector('.stage-camera')?.style.transform.includes('scale(1)')`);
    // Allow the default remote preview to finish painting before the first store capture.
    await wait(1800);
    screenshotWindow.setSize(800, 1280);
    await wait(500);
    screenshotWindow.setSize(1280, 800);
    await wait(700);

    const screenshots = [
      await capture(screenshotWindow, 'android-tablet-landscape-1280x800.png', 1280, 800),
      await capture(screenshotWindow, 'android-tablet-portrait-800x1280.png', 800, 1280),
    ];
    for (const screenshot of screenshots) {
      assert.equal(screenshot.width > 0 && screenshot.height > 0, true);
      assert.equal((await fs.stat(screenshot.file)).size > 30000, true, `${screenshot.file} is unexpectedly small`);
    }

    process.stdout.write(`${JSON.stringify({ ok: true, touch, publishing, screenshots }, null, 2)}\n`);
  } finally {
    if (screenshotWindow && !screenshotWindow.isDestroyed()) screenshotWindow.destroy();
    if (!window.isDestroyed()) window.destroy();
    await fs.rm(profile, { recursive: true, force: true });
    app.quit();
  }
}).catch((error) => {
  console.error(error.stack || error);
  app.exit(1);
});
