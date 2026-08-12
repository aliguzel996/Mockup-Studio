const { app, BrowserWindow, dialog, ipcMain, shell, webContents, session, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const http = require('node:http');
const sharp = require('sharp');
const { outlineSvgText } = require('./svg-text-outliner.cjs');

const APP_ID = 'co.ycswu.responsivemockupstudio';
const PARTITION = 'persist:responsive-mockup-studio';
let mainWindow = null;
const smokeOutputArg = process.argv.find((arg) => String(arg).startsWith('--rms-smoke-output='));
const smokeOutputPath = smokeOutputArg ? path.resolve(String(smokeOutputArg).slice('--rms-smoke-output='.length)) : null;

if (smokeOutputPath) {
  const smokeUserDataPath = path.join(smokeOutputPath, '.user-data');
  fsSync.mkdirSync(smokeUserDataPath, { recursive: true });
  app.setPath('userData', smokeUserDataPath);
}

app.setAppUserModelId(APP_ID);
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function mimeFromPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'image/png';
}

async function loadMainWindow() {
  const preload = path.join(__dirname, 'preload.cjs');
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#111311',
    title: 'Responsive Mockup Studio',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.partition = PARTITION;
    if (!isHttpUrl(params.src)) params.src = 'https://example.com/';
  });

  mainWindow.webContents.on('did-attach-webview', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) contents.loadURL(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (!isHttpUrl(url)) event.preventDefault();
    });
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

async function waitForPage(contents, delayMs) {
  await contents.executeJavaScript(`(async () => {
    try { await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 8000))]); } catch {}
    const images = Array.from(document.images || []);
    await Promise.all(images.map(async (image) => {
      if (image.complete) { try { await image.decode(); } catch {} return; }
      await new Promise((resolve) => {
        const done = () => resolve();
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
        setTimeout(done, 5000);
      });
    }));
    return { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
  })()`, true);
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 30000)));
}

function buildCaptureCss(options) {
  const rules = [];
  if (options.freezeAnimations) rules.push('*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}');
  if (options.hideScrollbar) rules.push('html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}');
  if (options.hideCursor) rules.push('html,body,body *{cursor:none!important}');
  if (options.hidePageBackground) rules.push('html,body{background:transparent!important;background-image:none!important}');
  if (options.hiddenSelectors && String(options.hiddenSelectors).trim()) {
    rules.push(`${String(options.hiddenSelectors).trim()}{visibility:hidden!important}`);
  }
  if (options.customCss && String(options.customCss).trim()) rules.push(String(options.customCss));
  return rules.join('\n');
}

function resourceMime(url, header) {
  const contentType = String(header || '').split(';')[0].trim().toLowerCase();
  if (contentType && contentType !== 'application/octet-stream') return contentType;
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.woff2') return 'font/woff2';
  if (extension === '.woff') return 'font/woff';
  if (extension === '.ttf') return 'font/ttf';
  if (extension === '.otf') return 'font/otf';
  return 'application/octet-stream';
}

function escapeXmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function svgAttributes(source) {
  const attributes = new Map();
  for (const match of String(source).matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    attributes.set(match[1], match[3]);
  }
  return attributes;
}

function namespaceInlineSvg(svg, prefix) {
  const ids = [...String(svg).matchAll(/\bid\s*=\s*(["'])([^"']+)\1/g)].map((match) => match[2]);
  let output = String(svg);
  for (const id of ids) {
    const namespacedId = `${prefix}-${id}`;
    output = output
      .split(`id="${id}"`).join(`id="${namespacedId}"`)
      .split(`id='${id}'`).join(`id='${namespacedId}'`)
      .split(`url(#${id})`).join(`url(#${namespacedId})`)
      .split(`href="#${id}"`).join(`href="#${namespacedId}"`)
      .split(`href='#${id}'`).join(`href='#${namespacedId}'`)
      .split(`xlink:href="#${id}"`).join(`xlink:href="#${namespacedId}"`)
      .split(`xlink:href='#${id}'`).join(`xlink:href='#${namespacedId}'`);
  }
  return output;
}

function inlineSvgImageNode(imageNode, svgText, index) {
  const imageAttrs = svgAttributes(imageNode);
  const rootMatch = String(svgText).match(/<svg\b([^>]*)>([\s\S]*?)<\/svg\s*>/i);
  if (!rootMatch) return null;
  const rootAttrs = svgAttributes(rootMatch[1]);
  const fallbackWidth = Number.parseFloat(rootAttrs.get('width') || '') || 1;
  const fallbackHeight = Number.parseFloat(rootAttrs.get('height') || '') || 1;
  const viewBox = rootAttrs.get('viewBox') || `0 0 ${fallbackWidth} ${fallbackHeight}`;
  const forwarded = ['x', 'y', 'width', 'height', 'preserveAspectRatio', 'opacity', 'transform', 'style', 'class', 'clip-path', 'mask', 'filter'];
  const attributes = forwarded
    .filter((name) => imageAttrs.has(name))
    .map((name) => `${name}="${escapeXmlAttribute(imageAttrs.get(name))}"`);
  if (!imageAttrs.has('width')) attributes.push(`width="${fallbackWidth}"`);
  if (!imageAttrs.has('height')) attributes.push(`height="${fallbackHeight}"`);
  if (!imageAttrs.has('preserveAspectRatio')) {
    attributes.push(`preserveAspectRatio="${escapeXmlAttribute(rootAttrs.get('preserveAspectRatio') || 'xMidYMid meet')}"`);
  }
  attributes.push(`viewBox="${escapeXmlAttribute(viewBox)}"`);
  attributes.push('overflow="hidden"');
  attributes.push('data-rms-inline-svg="true"');

  let body = rootMatch[2]
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, '');
  body = namespaceInlineSvg(body, `rms-inline-${index}`);
  return `<svg ${attributes.join(' ')}>${body}</svg>`;
}

async function inlineSvgExternalResources(svg, targetSession) {
  let output = String(svg);
  const cache = new Map();
  const fetchResource = async (url) => {
    if (cache.has(url)) return cache.get(url);
    try {
      const response = await Promise.race([
        targetSession.fetch(url, { referrerPolicy: 'no-referrer-when-downgrade' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Resource timeout: ${url}`)), 12000)),
      ]);
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      const mime = resourceMime(url, response.headers.get('content-type'));
      const resource = { buffer, mime, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
      cache.set(url, resource);
      return resource;
    } catch {
      cache.set(url, null);
      return null;
    }
  };

  // SVG files referenced by <image> must become real nested SVG geometry.
  // Leaving them as external URLs breaks offline exports, while an SVG data
  // URL is not rendered consistently by Sharp/librsvg. Inline the source
  // markup so both the browser and image-production pipelines retain it.
  const imageNodes = [...output.matchAll(/<image\b[^>]*?(?:\/>|>\s*<\/image\s*>)/gi)].map((match) => match[0]);
  let inlineIndex = 0;
  for (const imageNode of imageNodes) {
    const href = imageNode.match(/(?:xlink:href|href)\s*=\s*(["'])(https?:\/\/[^"']+)\1/i)?.[2];
    if (!href) continue;
    const resource = await fetchResource(href);
    if (!resource || resource.mime !== 'image/svg+xml') continue;
    const nestedSvg = inlineSvgImageNode(imageNode, resource.buffer.toString('utf8'), inlineIndex++);
    if (nestedSvg) output = output.split(imageNode).join(nestedSvg);
  }

  const urls = new Set();
  for (const match of output.matchAll(/(?:href|xlink:href)=["'](https?:\/\/[^"']+)["']/gi)) urls.add(match[1]);
  for (const match of output.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi)) urls.add(match[1]);
  for (const url of urls) {
    const resource = await fetchResource(url);
    if (resource) output = output.split(url).join(resource.dataUrl);
  }
  return output;
}

async function capturePage(options) {
  const trace = async (message) => {
    if (options.progressPath) await fs.appendFile(options.progressPath, `${new Date().toISOString()} CAPTURE_TRACE ${message}\n`, 'utf8');
  };
  const liveTarget = webContents.fromId(Number(options.webContentsId));
  if (!liveTarget || liveTarget.isDestroyed()) return { ok: false, error: 'Live Chromium view is not available.' };
  const viewportWidth = Math.max(320, Math.min(7680, Math.round(Number(options.viewportWidth) || 1440)));
  const viewportHeight = Math.max(180, Math.min(7680, Math.round(Number(options.viewportHeight) || 900)));
  const pixelRatio = Math.max(1, Math.min(4, Number(options.pixelRatio) || 1));
  let captureWindow = null;
  let target = liveTarget;
  let originalZoomFactor = 1;
  let originalScroll = { x: 0, y: 0 };
  let cssKey = null;
  let attachedHere = false;
  try {
    if (liveTarget.getType?.() === 'webview') {
      // A guest webview is composited inside the editor at a CSS transform. On
      // Windows Chromium can tile that embedded backing surface when CDP asks
      // for a high-DPR screenshot. Render the same URL in an isolated hidden
      // window that shares the guest session instead; its surface has exactly
      // one viewport and can be captured at native high density.
      captureWindow = await loadProbe(
        liveTarget.getURL(),
        viewportWidth,
        viewportHeight,
        liveTarget.session,
        liveTarget.getUserAgent(),
      );
      target = captureWindow.webContents;
      await trace(`DETACHED_CAPTURE source=${liveTarget.id} target=${target.id}`);
    }
    originalZoomFactor = target.getZoomFactor();
    originalScroll = await target.executeJavaScript('({ x: window.scrollX, y: window.scrollY })', true).catch(() => ({ x: 0, y: 0 }));
    await trace('BEGIN');
    target.setZoomFactor(1);
    const css = buildCaptureCss(options);
    if (css) cssKey = await target.insertCSS(css, { cssOrigin: 'user' });
    await trace('CSS');
    await target.executeJavaScript(`window.scrollTo({left:0,top:${Math.max(0, Number(options.scrollY) || 0)},behavior:'instant'})`, true);
    await trace('SCROLL');
    await waitForPage(target, Number(options.delayMs) || 0);
    await trace('PAGE_READY');

    if (!target.debugger.isAttached()) {
      target.debugger.attach('1.3');
      attachedHere = true;
    }
    await trace('DEBUGGER');
    await target.debugger.sendCommand('Page.enable');
    await trace('PAGE_ENABLE');
    await target.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: viewportWidth,
      height: viewportHeight,
      // Render the page at the requested physical density. Scaling the CDP
      // screenshot clip repeats Chromium's compositor surface on some real
      // sites, producing a 2x2 tiled export instead of one sharp viewport.
      deviceScaleFactor: pixelRatio,
      mobile: false,
      screenWidth: viewportWidth,
      screenHeight: viewportHeight,
      dontSetVisibleSize: false,
    });
    await trace('METRICS');
    if (options.hidePageBackground) {
      await target.debugger.sendCommand('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    }
    await new Promise((resolve) => setTimeout(resolve, 180));
    const metrics = await target.debugger.sendCommand('Page.getLayoutMetrics');
    await trace('LAYOUT_METRICS');
    const fullHeight = Math.max(viewportHeight, Math.min(12000, Math.ceil(metrics.cssContentSize?.height || metrics.contentSize?.height || viewportHeight)));
    const cssHeight = options.fullPage ? fullHeight : viewportHeight;
    const clipY = options.fullPage ? 0 : Math.max(0, Number(options.scrollY) || 0);
    const captureRequest = {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: Boolean(options.fullPage),
      optimizeForSpeed: false,
    };
    if (options.fullPage) captureRequest.clip = { x: 0, y: clipY, width: viewportWidth, height: cssHeight, scale: 1 };
    const screenshot = await target.debugger.sendCommand('Page.captureScreenshot', captureRequest);
    await trace('SCREENSHOT');
    let buffer = Buffer.from(screenshot.data, 'base64');
    let metadata = await sharp(buffer).metadata();
    const expectedWidth = Math.round(viewportWidth * pixelRatio);
    const expectedHeight = Math.round(cssHeight * pixelRatio);
    if ((metadata.width || 0) !== expectedWidth || (metadata.height || 0) !== expectedHeight) {
      buffer = await sharp(buffer).resize(expectedWidth, expectedHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 }).png().toBuffer();
      metadata = await sharp(buffer).metadata();
    }
    if ((metadata.width || 0) !== expectedWidth || (metadata.height || 0) !== expectedHeight) {
      throw new Error(`Chromium capture density mismatch: ${metadata.width}x${metadata.height}, expected ${expectedWidth}x${expectedHeight}`);
    }
    return {
      ok: true,
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      width: metadata.width,
      height: metadata.height,
      cssWidth: viewportWidth,
      cssHeight,
      title: target.getTitle(),
      url: target.getURL(),
    };
  } catch (error) {
    return { ok: false, error: error.stack || error.message || String(error) };
  } finally {
    if (target && !target.isDestroyed()) {
      try { await target.debugger.sendCommand('Emulation.clearDeviceMetricsOverride'); } catch {}
      try { await target.debugger.sendCommand('Emulation.setDefaultBackgroundColorOverride'); } catch {}
      if (attachedHere && target.debugger.isAttached()) {
        try { target.debugger.detach(); } catch {}
      }
      if (cssKey) {
        try { await target.removeInsertedCSS(cssKey); } catch {}
      }
      try { await target.executeJavaScript(`window.scrollTo(${Number(originalScroll.x) || 0},${Number(originalScroll.y) || 0})`, true); } catch {}
      try { target.setZoomFactor(originalZoomFactor); } catch {}
    }
    if (captureWindow && !captureWindow.isDestroyed()) captureWindow.destroy();
  }
}

async function capturePageSvg(options) {
  const liveTarget = webContents.fromId(Number(options.webContentsId));
  if (!liveTarget || liveTarget.isDestroyed()) return { ok: false, error: 'Live Chromium view is not available.' };
  const viewportWidth = Math.max(320, Math.min(7680, Math.round(Number(options.viewportWidth) || 1440)));
  const viewportHeight = Math.max(180, Math.min(7680, Math.round(Number(options.viewportHeight) || 900)));
  let captureWindow = null;
  let target = liveTarget;
  let cssKey = null;
  let originalScroll = { x: 0, y: 0 };
  try {
    if (liveTarget.getType?.() === 'webview') {
      captureWindow = await loadProbe(
        liveTarget.getURL(),
        viewportWidth,
        viewportHeight,
        liveTarget.session,
        liveTarget.getUserAgent(),
      );
      target = captureWindow.webContents;
    }
    originalScroll = await target.executeJavaScript('({ x: window.scrollX, y: window.scrollY })', true).catch(() => ({ x: 0, y: 0 }));
    const css = buildCaptureCss(options);
    if (css) cssKey = await target.insertCSS(css, { cssOrigin: 'user' });
    await target.executeJavaScript(`window.scrollTo({left:0,top:${Math.max(0, Number(options.scrollY) || 0)},behavior:'instant'})`, true);
    await waitForPage(target, Number(options.delayMs) || 0);

    const library = await fs.readFile(path.join(__dirname, 'dom-to-svg.bundle.js'), 'utf8');
    let svg = await target.executeJavaScript(`(async () => {
      ${library}
      const area = new DOMRect(0, ${Math.max(0, Number(options.scrollY) || 0)}, ${viewportWidth}, ${viewportHeight});
      const output = RMSSVG.documentToSVG(document, { captureArea: area, keepLinks: true });
      await RMSSVG.inlineResources(output.documentElement);
      output.documentElement.setAttribute('data-rms-vector-source', location.href);
      return new XMLSerializer().serializeToString(output);
    })()`, true);
    svg = await inlineSvgExternalResources(svg, target.session);
    const outlined = await outlineSvgText(svg, target, path.join(__dirname, '..'));
    svg = outlined.svg;
    if (!String(svg).includes('<svg')) throw new Error('Vector DOM capture did not return an SVG document.');
    return {
      ok: true,
      svg,
      width: viewportWidth,
      height: viewportHeight,
      title: target.getTitle(),
      url: target.getURL(),
      outlinedTextNodes: outlined.outlinedTextNodes,
      outlinedTextRuns: outlined.outlinedTextRuns,
      textOutlineFallbacks: outlined.fallbackRuns,
      outlineFontsLoaded: outlined.fontsLoaded,
    };
  } catch (error) {
    return { ok: false, error: error.stack || error.message || String(error) };
  } finally {
    if (target && !target.isDestroyed()) {
      if (cssKey) {
        try { await target.removeInsertedCSS(cssKey); } catch {}
      }
      try { await target.executeJavaScript(`window.scrollTo(${Number(originalScroll.x) || 0},${Number(originalScroll.y) || 0})`, true); } catch {}
    }
    if (captureWindow && !captureWindow.isDestroyed()) captureWindow.destroy();
  }
}

async function saveImage(request) {
  try {
    const format = request.format === 'transparent-png' ? 'png' : request.format || 'png';
    const extension = format === 'jpeg' ? 'jpg' : format;
    let outputPath = request.path;
    if (!outputPath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Mockup dışa aktar',
        defaultPath: path.join(app.getPath('pictures'), `${request.suggestedName || 'responsive-mockup'}.${extension}`),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, error: 'cancelled' };
      outputPath = result.filePath;
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const payload = String(request.dataUrl || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const input = Buffer.from(payload, 'base64');
    let pipeline = sharp(input).withMetadata({ density: Math.max(1, Number(request.dpi) || 72) });
    if (format === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: Math.max(1, Math.min(100, Number(request.quality) || 92)), mozjpeg: true });
    else if (format === 'webp') pipeline = pipeline.webp({ quality: Math.max(1, Math.min(100, Number(request.quality) || 92)), smartSubsample: true });
    else pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false });
    await pipeline.toFile(outputPath);
    const fileBuffer = await fs.readFile(outputPath);
    const stats = await fs.stat(outputPath);
    const metadata = await sharp(fileBuffer).metadata();
    return {
      ok: true,
      path: outputPath,
      size: stats.size,
      sha256: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
      width: metadata.width,
      height: metadata.height,
      density: metadata.density,
      hasAlpha: Boolean(metadata.hasAlpha),
    };
  } catch (error) {
    return { ok: false, error: error.stack || error.message || String(error) };
  }
}

async function saveSvg(request) {
  try {
    const svg = String(request.svg || '');
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg)) throw new Error('Invalid SVG document.');
    if (/<text\b/i.test(svg)) throw new Error('SVG still contains live text. Text must be converted to vector outlines before export.');
    let outputPath = request.path;
    if (!outputPath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Vektör mockup dışa aktar',
        defaultPath: path.join(app.getPath('pictures'), `${request.suggestedName || 'responsive-mockup'}.svg`),
        filters: [{ name: 'Scalable Vector Graphics', extensions: ['svg'] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, error: 'cancelled' };
      outputPath = result.filePath;
    }
    if (path.extname(outputPath).toLowerCase() !== '.svg') outputPath += '.svg';
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, svg, 'utf8');
    const fileBuffer = await fs.readFile(outputPath);
    const width = Number(svg.match(/<svg\b[^>]*\bwidth=["']([0-9.]+)/i)?.[1] || 0);
    const height = Number(svg.match(/<svg\b[^>]*\bheight=["']([0-9.]+)/i)?.[1] || 0);
    return {
      ok: true,
      path: outputPath,
      size: fileBuffer.length,
      sha256: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
      width,
      height,
    };
  } catch (error) {
    return { ok: false, error: error.stack || error.message || String(error) };
  }
}

async function analyzeImage(filePath) {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];
  const corners = [alphaAt(0, 0), alphaAt(info.width - 1, 0), alphaAt(0, info.height - 1), alphaAt(info.width - 1, info.height - 1)];
  let transparentPixels = 0;
  const stride = Math.max(1, Math.floor((info.width * info.height) / 150000));
  for (let pixel = 0; pixel < info.width * info.height; pixel += stride) {
    if (data[pixel * info.channels + 3] < 255) transparentPixels += 1;
  }
  return {
    width: metadata.width,
    height: metadata.height,
    density: metadata.density,
    hasAlpha: Boolean(metadata.hasAlpha),
    cornerAlpha: corners,
    centerAlpha: alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)),
    sampledTransparentPixels: transparentPixels,
  };
}

async function analyzeQuadrantCenters(filePath) {
  const { data, info } = await sharp(filePath).resize(240, 160, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const centers = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  const luminance = centers.map(([u, v]) => {
    const centerX = Math.round((info.width - 1) * u);
    const centerY = Math.round((info.height - 1) * v);
    let total = 0;
    let samples = 0;
    for (let y = centerY - 4; y <= centerY + 4; y += 1) {
      for (let x = centerX - 4; x <= centerX + 4; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        total += data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
        samples += 1;
      }
    }
    return Math.round(total / Math.max(1, samples));
  });
  return { quadrantCenterLuma: luminance, quadrantLumaSpan: Math.max(...luminance) - Math.min(...luminance) };
}

async function analyzeSingleViewportMatch(referencePath, candidatePath) {
  const reference = sharp(referencePath).removeAlpha();
  const referenceMetadata = await reference.metadata();
  const width = referenceMetadata.width || 1;
  const height = referenceMetadata.height || 1;
  const referenceRaw = await reference.raw().toBuffer();
  const candidateRaw = await sharp(candidatePath).resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 }).removeAlpha().raw().toBuffer();
  const compared = Math.min(referenceRaw.length, candidateRaw.length);
  let absoluteDifference = 0;
  for (let index = 0; index < compared; index += 1) absoluteDifference += Math.abs(referenceRaw[index] - candidateRaw[index]);
  return { singleViewportMeanDifference: absoluteDifference / Math.max(1, compared) };
}

async function loadProbe(url, width, height, sharedSession, userAgent) {
  const probe = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#000000',
    webPreferences: {
      ...(sharedSession ? { session: sharedSession } : { partition: PARTITION }),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  if (userAgent) probe.webContents.setUserAgent(userAgent);
  probe.setContentSize(width, height);
  await Promise.race([
    probe.loadURL(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Load timeout: ${url}`)), 30000)),
  ]);
  probe.setPosition(-10000, -10000, false);
  probe.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 180));
  return probe;
}

async function runSmokeSuite(outputPath) {
  await fs.mkdir(outputPath, { recursive: true });
  const progressPath = path.join(outputPath, 'qa-progress.log');
  const progress = async (message) => fs.appendFile(progressPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
  await fs.writeFile(progressPath, '', 'utf8');
  await progress(`START argv=${JSON.stringify(process.argv)}`);
  const report = {
    startedAt: new Date().toISOString(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    appVersion: app.getVersion(),
    captures: [],
    exports: [],
    errors: [],
    nativeMenuRemoved: Menu.getApplicationMenu() === null,
  };
  const redirectServer = http.createServer((request, response) => {
    if (request.url && request.url.startsWith('/redirect')) {
      response.writeHead(302, { Location: '/final?rms=redirected&payload=abcdefghijklmnopqrstuvwxyz0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;font:18px system-ui;color:#fff}.qa-quadrants{position:fixed;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}.qa-quadrants i:nth-child(1){background:#101010}.qa-quadrants i:nth-child(2){background:#525252}.qa-quadrants i:nth-child(3){background:#a8a8a8}.qa-quadrants i:nth-child(4){background:#f2f2f2}.qa-content{position:relative;margin:28px;padding:18px;border:1px solid #fff;background:rgba(0,0,0,.66);width:max-content}.cookie-banner{position:fixed;right:12px;bottom:12px;padding:12px;background:#000}.qa-card{padding:16px;border:1px solid #fff}</style><div class="qa-quadrants"><i></i><i></i><i></i><i></i></div><div class="qa-content"><header id="site-header">Local site header</header><main><h1>Redirect verified</h1><p>Responsive Mockup Studio local URL test.</p><section class="qa-card">Hideable QA card</section></main></div><div class="cookie-banner">Cookie notice</div>');
  });
  await new Promise((resolve, reject) => {
    redirectServer.once('error', reject);
    redirectServer.listen(0, '127.0.0.1', resolve);
  });
  const redirectAddress = redirectServer.address();
  const redirectPort = typeof redirectAddress === 'object' && redirectAddress ? redirectAddress.port : 0;
  const cases = [
    { id: 'example-light-16-9', url: 'https://example.com/?responsive-mockup-studio=long-url-test-abcdefghijklmnopqrstuvwxyz-0123456789', width: 1440, height: 810, pixelRatio: 1.5 },
    { id: 'wikipedia-21-9', url: 'https://www.wikipedia.org/', width: 2560, height: 1080, pixelRatio: 1 },
    { id: 'ycswu-phone', url: 'https://ycswu.co/', width: 430, height: 932, pixelRatio: 1.5 },
    { id: 'ycswu-desktop-density', url: 'https://ycswu.co/', width: 1426, height: 828, pixelRatio: 2.25 },
    { id: 'redirect-custom', url: `http://127.0.0.1:${redirectPort}/redirect?long=abcdefghijklmnopqrstuvwxyz0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ`, width: 1200, height: 777, pixelRatio: 1 },
    { id: 'redirect-density', url: `http://127.0.0.1:${redirectPort}/redirect?density=high`, width: 1200, height: 777, pixelRatio: 2.25 },
  ];
  let sourceCapture = null;
  const sourceCaptures = {};
  for (const item of cases) {
    let probe;
    try {
      await progress(`LOAD ${item.id} ${item.url}`);
      probe = await loadProbe(item.url, item.width, item.height);
      await progress(`CAPTURE ${item.id} loaded=${probe.webContents.getURL()}`);
      const result = await capturePage({
        webContentsId: probe.webContents.id,
        viewportWidth: item.width,
        viewportHeight: item.height,
        pixelRatio: item.pixelRatio,
        fullPage: false,
        scrollY: 0,
        delayMs: 500,
        freezeAnimations: true,
        hideScrollbar: true,
        hideCursor: true,
        hidePageBackground: false,
        customCss: '',
        hiddenSelectors: '',
        progressPath,
      });
      if (!result.ok || !result.dataUrl) throw new Error(result.error || `Capture failed: ${item.id}`);
      const savePath = path.join(outputPath, `${item.id}.png`);
      const saved = await saveImage({ dataUrl: result.dataUrl, format: 'png', dpi: 72, quality: 100, suggestedName: item.id, path: savePath });
      if (!saved.ok) throw new Error(saved.error || `Save failed: ${item.id}`);
      const quadrantAnalysis = item.id === 'redirect-density' ? await analyzeQuadrantCenters(savePath) : {};
      const viewportMatch = item.id === 'redirect-density'
        ? await analyzeSingleViewportMatch(path.join(outputPath, 'redirect-custom.png'), savePath)
        : {};
      const record = { ...item, finalUrl: result.url, captureWidth: result.width, captureHeight: result.height, file: savePath, sha256: saved.sha256, ...quadrantAnalysis, ...viewportMatch };
      if (item.id === 'redirect-density' && record.quadrantLumaSpan < 120) {
        throw new Error(`High-density capture appears tiled or flattened: quadrant luminance ${record.quadrantCenterLuma.join(',')}`);
      }
      if (item.id === 'redirect-density' && record.singleViewportMeanDifference > 12) {
        throw new Error(`High-density capture no longer matches the single viewport: mean difference ${record.singleViewportMeanDifference.toFixed(2)}`);
      }
      report.captures.push(record);
      await progress(`DONE ${item.id} ${result.width}x${result.height}`);
      if (!sourceCapture) sourceCapture = result.dataUrl;
      sourceCaptures[item.id] = result.dataUrl;
    } catch (error) {
      report.errors.push({ id: item.id, error: error.stack || error.message || String(error) });
      await progress(`ERROR ${item.id} ${error.stack || error.message || String(error)}`);
    } finally {
      if (probe && !probe.isDestroyed()) probe.destroy();
    }
  }
  if (!sourceCapture) throw new Error('No real-site capture succeeded.');

  const qaWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 600,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#000000',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  await qaWindow.loadFile(path.join(__dirname, '..', 'dist', 'qa.html'));
  await progress('QA_RENDERER loaded');
  await qaWindow.webContents.executeJavaScript('new Promise((resolve) => { const done=()=>window.__RMS_QA__?resolve(true):setTimeout(done,30); done(); })', true);
  const exportCases = [
    {
      id: 'custom-full-preview-2560px-150dpi', frameId: 'custom', captureId: 'ycswu-desktop-density', format: 'png', dpi: 150,
      previewLayout: { viewportWidth: 1382, viewportHeight: 967, stageX: 131, stageY: 168.5, stageWidth: 1120, stageHeight: 630 },
      project: { backgroundMode: 'black', cameraZoom: 100, cameraX: 0, cameraY: 0, tilt: 0, matte: false, glare: 0, exportSettings: { longEdge: 2560, dpi: 150, format: 'png', outputKind: 'mockup' } },
    },
    {
      id: 'macbook-front-lip-preview-2560px-150dpi', frameId: 'creator-laptop', captureId: 'example-light-16-9', format: 'png', dpi: 150,
      previewLayout: { viewportWidth: 1382, viewportHeight: 967, stageX: 131, stageY: 168.5, stageWidth: 1120, stageHeight: 630 },
      project: { backgroundMode: 'black', deckWidth: 62.2, deckHeight: 2.6, cameraZoom: 100, cameraX: 0, cameraY: 0, tilt: 0, matte: true, glare: 0, exportSettings: { longEdge: 2560, dpi: 150, format: 'png', outputKind: 'mockup' } },
    },
    {
      id: 'monitor-black-4000px-300dpi-zoom', frameId: 'studio-16-9', format: 'png', dpi: 300,
      project: { backgroundMode: 'black', cameraZoom: 145, cameraX: -8, cameraY: 3, tilt: -0.55, matte: true, glare: 2, exportSettings: { longEdge: 4000, dpi: 300, format: 'png', outputKind: 'mockup' } },
    },
    {
      id: 'ultrawide-transparent-2560px-150dpi', frameId: 'panorama-21-9', format: 'transparent-png', dpi: 150,
      project: { backgroundMode: 'transparent', cameraZoom: 116, cameraX: 0, cameraY: 1, tilt: -0.3, matte: true, glare: 0, exportSettings: { longEdge: 2560, dpi: 150, format: 'transparent-png', outputKind: 'mockup' } },
    },
    {
      id: 'phone-white-1920px-72dpi', frameId: 'phone-pro', format: 'png', dpi: 72,
      project: { backgroundMode: 'white', cameraZoom: 120, cameraX: 0, cameraY: 0, tilt: 0, matte: true, glare: 3, exportSettings: { longEdge: 1920, dpi: 72, format: 'png', outputKind: 'mockup' } },
    },
    {
      id: 'gradient-material-2560px-150dpi', frameId: 'panorama-21-9', format: 'png', dpi: 150,
      project: { backgroundMode: 'gradient', backgroundGradientType: 'linear', backgroundGradientStops: [{ id: 'qa-0', color: '#050505', position: 0 }, { id: 'qa-1', color: '#5d5d5a', position: 42 }, { id: 'qa-2', color: '#bdbdb8', position: 100 }], backgroundGradientAngle: 132, deviceColor: '#6b4cff', deviceMaterial: 'plastic', cameraZoom: 116, cameraX: 0, cameraY: 0, tilt: 0, exportSettings: { longEdge: 2560, dpi: 150, format: 'png', outputKind: 'mockup' } },
    },
    {
      id: 'flat-wireframe-1920px-72dpi', frameId: 'panorama-21-9', format: 'png', dpi: 72,
      project: { backgroundMode: 'black', wireframeEnabled: true, wireframeColor: '#f2f2ee', wireframeThickness: 6, cameraZoom: 112, cameraX: 0, cameraY: 0, tilt: 0, exportSettings: { longEdge: 1920, dpi: 72, format: 'png', outputKind: 'mockup' } },
    },
    {
      id: 'saved-device-empty-transparent-1920px-72dpi', frameId: 'custom-phone', format: 'transparent-png', dpi: 72,
      project: { backgroundMode: 'transparent', phoneLeftControlsVisible: false, phoneRightButtonVisible: true, cameraZoom: 100, cameraX: 0, cameraY: 0, tilt: 0, matte: false, glare: 0, exportSettings: { longEdge: 1920, dpi: 72, format: 'transparent-png', outputKind: 'empty' } },
    },
    {
      id: 'framed-portrait-4-5-2560px-150dpi', frameId: 'custom', captureId: 'ycswu-desktop-density', format: 'png', dpi: 150,
      previewLayout: { viewportWidth: 640, viewportHeight: 800, stageX: -240, stageY: 70, stageWidth: 1120, stageHeight: 630 },
      project: { backgroundMode: 'black', compositionFrameRatio: '4:5', compositionFrameOrientation: 'portrait', cameraZoom: 100, cameraX: 0, cameraY: 0, tilt: 0, matte: false, glare: 0, exportSettings: { longEdge: 2560, dpi: 150, format: 'png', outputKind: 'mockup' } },
    },
    {
      id: 'framed-square-1-1-ycswu-2560px-150dpi', frameId: 'custom', captureId: 'ycswu-desktop-density', format: 'png', dpi: 150,
      previewLayout: { viewportWidth: 900, viewportHeight: 900, stageX: -110, stageY: 135, stageWidth: 1120, stageHeight: 630 },
      project: { backgroundMode: 'black', compositionFrameRatio: '1:1', compositionFrameOrientation: 'landscape', cameraZoom: 100, cameraX: 0, cameraY: 0, tilt: 0, matte: false, glare: 0, exportSettings: { longEdge: 2560, dpi: 150, format: 'png', outputKind: 'mockup' } },
    },
  ];
  for (const item of exportCases) {
    try {
      await progress(`COMPOSE ${item.id}`);
      const captureDataUrl = item.captureId
        ? (sourceCaptures[item.captureId] || sourceCapture)
        : item.frameId === 'panorama-21-9'
        ? (sourceCaptures['wikipedia-21-9'] || sourceCapture)
        : item.frameId === 'phone-pro'
          ? (sourceCaptures['ycswu-phone'] || sourceCapture)
          : sourceCapture;
      const request = { captureDataUrl, frameId: item.frameId, project: item.project, previewLayout: item.previewLayout };
      const layers = await qaWindow.webContents.executeJavaScript(`window.__RMS_QA__.compose(${JSON.stringify(request)})`, true);
      const savePath = path.join(outputPath, `${item.id}.png`);
      const saved = await saveImage({ dataUrl: layers.composite, format: item.format, dpi: item.dpi, quality: 96, suggestedName: item.id, path: savePath });
      if (!saved.ok) throw new Error(saved.error || `Save failed: ${item.id}`);
      const analysis = await analyzeImage(savePath);
      report.exports.push({ id: item.id, frameId: item.frameId, file: savePath, sha256: saved.sha256, ...analysis });
      await progress(`EXPORTED ${item.id} ${analysis.width}x${analysis.height} dpi=${analysis.density}`);
      if (item.id.includes('transparent')) {
        for (const layerName of ['background', 'screen', 'frame']) {
          const layerPath = path.join(outputPath, `${item.id}-${layerName}.png`);
          const layerSaved = await saveImage({ dataUrl: layers[layerName], format: 'png', dpi: item.dpi, quality: 100, suggestedName: `${item.id}-${layerName}`, path: layerPath });
          if (!layerSaved.ok) throw new Error(layerSaved.error || `Layer save failed: ${layerName}`);
        }
      }
    } catch (error) {
      report.errors.push({ id: item.id, error: error.stack || error.message || String(error) });
      await progress(`ERROR ${item.id} ${error.stack || error.message || String(error)}`);
    }
  }
  try {
    await progress('VECTOR capture local DOM');
    const vectorProbe = await loadProbe(`http://127.0.0.1:${redirectPort}/final?rms=vector`, 1200, 777);
    try {
      const pageVector = await capturePageSvg({
        webContentsId: vectorProbe.webContents.id,
        viewportWidth: 1200,
        viewportHeight: 777,
        fullPage: false,
        scrollY: 0,
        delayMs: 0,
        freezeAnimations: true,
        hideScrollbar: true,
        hideCursor: true,
        hidePageBackground: false,
        customCss: '',
        hiddenSelectors: '',
      });
      if (!pageVector.ok || !pageVector.svg) throw new Error(pageVector.error || 'Vector page capture failed.');
      const request = {
        websiteSvg: pageVector.svg,
        frameId: 'studio-16-9',
        project: {
          backgroundMode: 'black',
          deviceColor: '#5A2DFF',
          deviceMaterial: 'glass',
          exportSettings: { longEdge: 2560, dpi: 150, format: 'svg', outputKind: 'mockup' },
        },
      };
      const composedSvg = await qaWindow.webContents.executeJavaScript(`window.__RMS_QA__.composeSvg(${JSON.stringify(request)})`, true);
      const vectorPath = path.join(outputPath, 'vector-website-device-2560px.svg');
      const saved = await saveSvg({ svg: composedSvg, suggestedName: 'vector-website-device-2560px', path: vectorPath });
      if (!saved.ok) throw new Error(saved.error || 'Vector mockup save failed.');
      const vectorText = await fs.readFile(vectorPath, 'utf8');
      report.vectorExport = {
        passed: Boolean(
          saved.width === 2560
          && /data-rms-vector="true"/.test(vectorText)
          && /data-rms-text-outlined="true"/.test(vectorText)
          && /data-rms-text-outline="true"/.test(vectorText)
          && !/<text\b/i.test(vectorText)
          && /rms-device-material/.test(vectorText)
          && !/<foreignObject\b/i.test(vectorText)
          && !/data:image\/png;base64/i.test(vectorText)
        ),
        file: vectorPath,
        width: saved.width,
        height: saved.height,
        size: saved.size,
        sha256: saved.sha256,
        textNodes: (vectorText.match(/<text\b/gi) || []).length,
        outlinedTextRuns: (vectorText.match(/data-rms-text-run=/gi) || []).length,
        outlineFallbacks: Number(vectorText.match(/data-rms-text-outline-fallbacks="(\d+)"/i)?.[1] || 0),
        foreignObjects: (vectorText.match(/<foreignObject\b/gi) || []).length,
        embeddedPngs: (vectorText.match(/data:image\/png;base64/gi) || []).length,
      };
      await progress(`VECTOR exported ${JSON.stringify(report.vectorExport)}`);
    } finally {
      if (!vectorProbe.isDestroyed()) vectorProbe.destroy();
    }
  } catch (error) {
    report.vectorExport = { passed: false, error: error.stack || error.message || String(error) };
    report.errors.push({ id: 'vector-website-device-2560px', error: error.stack || error.message || String(error) });
    await progress(`ERROR vector-website-device-2560px ${error.stack || error.message || String(error)}`);
  }
  try {
    await progress('VECTOR capture ycswu.co DOM');
    const vectorYcswuProbe = await loadProbe('https://ycswu.co/', 1426, 828);
    try {
      const pageVector = await capturePageSvg({
        webContentsId: vectorYcswuProbe.webContents.id,
        viewportWidth: 1426,
        viewportHeight: 828,
        fullPage: false,
        scrollY: 0,
        delayMs: 0,
        freezeAnimations: true,
        hideScrollbar: true,
        hideCursor: true,
        hidePageBackground: false,
        customCss: '',
        hiddenSelectors: '',
      });
      if (!pageVector.ok || !pageVector.svg) throw new Error(pageVector.error || 'YCSWU vector page capture failed.');
      const request = {
        websiteSvg: pageVector.svg,
        frameId: 'studio-16-9',
        project: {
          backgroundMode: 'black',
          deviceColor: '#A4A4A0',
          deviceMaterial: 'metal',
          exportSettings: { longEdge: 2560, dpi: 150, format: 'svg', outputKind: 'mockup' },
        },
      };
      const composedSvg = await qaWindow.webContents.executeJavaScript(`window.__RMS_QA__.composeSvg(${JSON.stringify(request)})`, true);
      const vectorPath = path.join(outputPath, 'vector-ycswu-device-2560px.svg');
      const saved = await saveSvg({ svg: composedSvg, suggestedName: 'vector-ycswu-device-2560px', path: vectorPath });
      if (!saved.ok) throw new Error(saved.error || 'YCSWU vector mockup save failed.');
      const vectorText = await fs.readFile(vectorPath, 'utf8');
      report.vectorYcswuExport = {
        passed: Boolean(saved.width === 2560 && /data-rms-vector="true"/.test(vectorText) && /data-rms-text-outlined="true"/.test(vectorText) && /data-rms-text-outline="true"/.test(vectorText) && !/<text\b/i.test(vectorText) && /data-rms-inline-svg="true"/.test(vectorText) && !/<foreignObject\b/i.test(vectorText) && !/(?:href|xlink:href)=["']https?:\/\//i.test(vectorText)),
        file: vectorPath,
        width: saved.width,
        height: saved.height,
        size: saved.size,
        sha256: saved.sha256,
        textNodes: (vectorText.match(/<text\b/gi) || []).length,
        outlinedTextRuns: (vectorText.match(/data-rms-text-run=/gi) || []).length,
        outlineFallbacks: Number(vectorText.match(/data-rms-text-outline-fallbacks="(\d+)"/i)?.[1] || 0),
        foreignObjects: (vectorText.match(/<foreignObject\b/gi) || []).length,
        embeddedRasterAssets: (vectorText.match(/data:image\/(?:png|jpeg|webp);base64/gi) || []).length,
        externalImageAssets: (vectorText.match(/(?:href|xlink:href)=["']https?:\/\//gi) || []).length,
        inlineSvgAssets: (vectorText.match(/data-rms-inline-svg="true"/gi) || []).length,
      };
      await progress(`VECTOR ycswu exported ${JSON.stringify(report.vectorYcswuExport)}`);
    } finally {
      if (!vectorYcswuProbe.isDestroyed()) vectorYcswuProbe.destroy();
    }
  } catch (error) {
    report.vectorYcswuExport = { passed: false, error: error.stack || error.message || String(error) };
    report.errors.push({ id: 'vector-ycswu-device-2560px', error: error.stack || error.message || String(error) });
    await progress(`ERROR vector-ycswu-device-2560px ${error.stack || error.message || String(error)}`);
  }
  qaWindow.destroy();

  const uiWindow = new BrowserWindow({
    show: false,
    width: 1600,
    height: 980,
    useContentSize: true,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#111311',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: false,
      partition: 'rms-smoke-ui',
    },
  });
  uiWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    void progress(`UI CONSOLE level=${level} ${sourceId || ''}:${line || 0} ${message}`);
  });
  uiWindow.webContents.on('render-process-gone', (_event, details) => {
    void progress(`UI RENDERER GONE ${JSON.stringify(details)}`);
  });
  await uiWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await progress('UI loaded');
  await new Promise((resolve) => setTimeout(resolve, 1600));
  await progress('UI default frame inspect');
  const uiDefaultFrame = await uiWindow.webContents.executeJavaScript(`(() => ({
    selected: document.querySelector('.frame-card.selected')?.getAttribute('data-frame-id'),
    first: document.querySelector('.frame-card')?.getAttribute('data-frame-id'),
  }))()`);
  await progress(`UI default frame ${JSON.stringify(uiDefaultFrame)}`);
  const uiNavigationUrl = `http://127.0.0.1:${redirectPort}/final?rms=ui-enter-navigation`;
  await progress('UI address focus');
  const uiAddressFocused = await uiWindow.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('input[aria-label="URL"]');
    if (!input) return false;
    input.focus();
    input.select();
    return document.activeElement === input;
  })()`);
  await progress(`UI address focused=${uiAddressFocused}`);
  if (uiAddressFocused) await uiWindow.webContents.insertText(uiNavigationUrl);
  await new Promise((resolve) => setTimeout(resolve, 180));
  await progress('UI address typed inspect');
  const uiAddressTyped = await uiWindow.webContents.executeJavaScript(`document.querySelector('input[aria-label="URL"]')?.value === ${JSON.stringify(uiNavigationUrl)}`);
  if (uiAddressTyped) {
    uiWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ENTER' });
    uiWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ENTER' });
  }
  const uiEnterDispatched = Boolean(uiAddressFocused && uiAddressTyped);
  await new Promise((resolve) => setTimeout(resolve, 1600));
  const uiGuest = webContents.getAllWebContents().find((contents) => contents.getType() === 'webview' && contents.getURL().includes('ui-enter-navigation'));
  const uiAddressNavigation = Boolean(uiEnterDispatched && uiGuest && uiGuest.getURL().includes('ui-enter-navigation'));
  if (uiGuest?.isLoading()) {
    await Promise.race([
      new Promise((resolve) => uiGuest.once('did-stop-loading', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  const uiViewport = uiGuest
    ? await uiGuest.executeJavaScript('({ width: window.innerWidth, height: window.innerHeight, zoomFactor: window.devicePixelRatio })', true)
    : null;
  let embeddedWebviewCapture = { passed: false, reason: 'guest-missing' };
  if (uiGuest) {
    const captureOptions = {
      webContentsId: uiGuest.id,
      viewportWidth: 1200,
      viewportHeight: 777,
      fullPage: false,
      scrollY: 0,
      delayMs: 0,
      freezeAnimations: true,
      hideScrollbar: true,
      hideCursor: true,
      hidePageBackground: false,
      customCss: '',
      hiddenSelectors: '',
      progressPath,
    };
    const reference = await capturePage({ ...captureOptions, pixelRatio: 1 });
    const density = await capturePage({ ...captureOptions, pixelRatio: 4 });
    if (reference.ok && reference.dataUrl && density.ok && density.dataUrl) {
      const referencePath = path.join(outputPath, 'embedded-webview-reference.png');
      const densityPath = path.join(outputPath, 'embedded-webview-density-4x.png');
      const savedReference = await saveImage({ dataUrl: reference.dataUrl, format: 'png', dpi: 72, quality: 100, suggestedName: 'embedded-webview-reference', path: referencePath });
      const savedDensity = await saveImage({ dataUrl: density.dataUrl, format: 'png', dpi: 72, quality: 100, suggestedName: 'embedded-webview-density-4x', path: densityPath });
      const viewportMatch = savedReference.ok && savedDensity.ok ? await analyzeSingleViewportMatch(referencePath, densityPath) : { singleViewportMeanDifference: Number.POSITIVE_INFINITY };
      embeddedWebviewCapture = {
        passed: Boolean(density.width === 4800 && density.height === 3108 && viewportMatch.singleViewportMeanDifference <= 12),
        referencePath,
        densityPath,
        width: density.width,
        height: density.height,
        ...viewportMatch,
      };
    } else {
      embeddedWebviewCapture = { passed: false, reason: reference.error || density.error || 'capture-failed' };
    }
  }
  const uiElementGeometry = await uiWindow.webContents.executeJavaScript(`(() => {
    const stage = document.querySelector('.device-stage')?.getBoundingClientRect();
    const screen = document.querySelector('.live-screen')?.getBoundingClientRect();
    const guest = document.querySelector('webview')?.getBoundingClientRect();
    const guestStyle = document.querySelector('webview') ? getComputedStyle(document.querySelector('webview')) : null;
    return {
      stage: stage ? { width: stage.width, height: stage.height } : null,
      screen: screen ? { width: screen.width, height: screen.height } : null,
      guest: guest ? { width: guest.width, height: guest.height } : null,
      guestStyle: guestStyle ? { width: guestStyle.width, height: guestStyle.height } : null,
    };
  })()`);
  const uiViewportFit = Boolean(uiViewport
    && Math.abs(uiViewport.width - 1440) / 1440 < 0.03
    && Math.abs(uiViewport.height - 900) / 900 < 0.03);
  const bookmarkAdded = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const menuButton = document.querySelector('button[aria-label="Bookmarklar"]');
    if (!menuButton) return resolve(false);
    menuButton.click();
    setTimeout(() => {
      const action = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('bookmarkla'));
      if (!action) return resolve(false);
      action.click();
      setTimeout(() => resolve(Boolean(document.querySelector('.bookmark-item'))), 120);
    }, 120);
  })`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await new Promise((resolve) => {
    uiWindow.webContents.once('did-finish-load', resolve);
    uiWindow.reload();
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
  const bookmarkPersistence = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const menuButton = document.querySelector('button[aria-label="Bookmarklar"]');
    if (!menuButton) return resolve(false);
    menuButton.click();
    setTimeout(() => {
      const persisted = Array.from(document.querySelectorAll('.bookmark-item')).some((item) => item.textContent?.includes('ui-enter-navigation'));
      menuButton.click();
      document.querySelector('.device-settings-trigger')?.click();
      resolve(persisted);
    }, 150);
  })`);
  const uiDimensionSwap = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const fields = Array.from(document.querySelectorAll('.viewport-fields input'));
    const button = document.querySelector('.viewport-swap');
    if (fields.length !== 2 || !button) return resolve(false);
    const before = fields.map((field) => Number(field.value));
    button.click();
    setTimeout(() => {
      const after = Array.from(document.querySelectorAll('.viewport-fields input')).map((field) => Number(field.value));
      const swapped = after[0] === before[1] && after[1] === before[0];
      document.querySelector('.viewport-swap')?.click();
      resolve(swapped);
    }, 120);
  })`);
  await new Promise((resolve) => setTimeout(resolve, 180));
  const typeViewportDimension = async (index, value) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const focused = await uiWindow.webContents.executeJavaScript(`(() => {
        const field = document.querySelectorAll('.viewport-fields input')[${index}];
        if (!field) return false;
        field.focus();
        field.select();
        return document.activeElement === field;
      })()`);
      if (!focused) return false;
      uiWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] });
      uiWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] });
      await new Promise((resolve) => setTimeout(resolve, 35));
      for (const character of String(value)) {
        uiWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: character });
        uiWindow.webContents.sendInputEvent({ type: 'char', keyCode: character });
        uiWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: character });
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
      await new Promise((resolve) => setTimeout(resolve, 240));
      const matched = await uiWindow.webContents.executeJavaScript(`Number(document.querySelectorAll('.viewport-fields input')[${index}]?.value) === ${Number(value)}`);
      if (matched) return true;
    }
    return false;
  };
  const uiWidthTyped = await typeViewportDimension(0, 1366);
  const uiHeightTyped = await typeViewportDimension(1, 768);
  const uiCustomResizeDispatched = uiWidthTyped && uiHeightTyped;
  await new Promise((resolve) => setTimeout(resolve, 500));
  const resizedUiGuest = webContents.getAllWebContents().find((contents) => contents.getType() === 'webview' && contents.getURL().includes('ui-enter-navigation'));
  const uiCustomViewport = resizedUiGuest && !resizedUiGuest.isDestroyed()
    ? await resizedUiGuest.executeJavaScript('({ width: window.innerWidth, height: window.innerHeight })', true)
    : null;
  const uiResponsiveResize = Boolean(uiCustomResizeDispatched && uiCustomViewport?.width === 1366 && uiCustomViewport?.height === 768);
  const uiAutoFrameState = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const mode = document.querySelector('.viewport-mode-toggle');
    if (mode?.getAttribute('aria-checked') !== 'true') mode?.click();
    setTimeout(() => {
      const slider = Array.from(document.querySelectorAll('input[type="range"]')).find((input) => input.getAttribute('aria-label') === 'Ekran eni');
      const fields = Array.from(document.querySelectorAll('.viewport-fields input')).map((field) => ({ value: Number(field.value), disabled: field.disabled }));
      const screen = document.querySelector('.live-screen')?.getBoundingClientRect();
      const guest = document.querySelector('webview')?.getBoundingClientRect();
      resolve({
        auto: mode?.getAttribute('aria-checked') === 'true',
        fields,
        geometryEditable: Boolean(slider),
        fill: Boolean(screen && guest && Math.abs(screen.width - guest.width) < 2 && Math.abs(screen.height - guest.height) < 2),
      });
    }, 160);
  })`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const autoUiGuest = webContents.getAllWebContents().find((contents) => contents.getType() === 'webview' && contents.getURL().includes('ui-enter-navigation'));
  const uiAutoGuestViewport = autoUiGuest && !autoUiGuest.isDestroyed()
    ? await autoUiGuest.executeJavaScript('({ width: window.innerWidth, height: window.innerHeight })', true)
    : null;
  const uiAutoResponsive = Boolean(uiAutoFrameState?.auto
    && uiAutoFrameState?.geometryEditable
    && uiAutoFrameState?.fields?.[0]?.disabled
    && uiAutoFrameState?.fields?.[0]?.value === 1366
    && Math.abs(uiAutoFrameState?.fields?.[1]?.value - 854) <= 1
    && uiAutoFrameState?.fill
    && uiAutoGuestViewport?.width === 1366
    && Math.abs(uiAutoGuestViewport?.height - 854) <= 1);
  const uiBreakpointCustom = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const clickNamed = (name) => Array.from(document.querySelectorAll('.breakpoints button')).find((button) => button.textContent?.trim() === name)?.click();
    const inspect = (id, width, height, kind) => {
      const fields = Array.from(document.querySelectorAll('.viewport-fields input')).map((field) => Number(field.value));
      return document.querySelector('.frame-card.selected')?.getAttribute('data-frame-id') === id
        && document.querySelector('.device-stage')?.classList.contains('kind-' + kind)
        && Math.abs(fields[0] - width) <= 1 && Math.abs(fields[1] - height) <= 1;
    };
    clickNamed('Masaüstü');
    setTimeout(() => {
      const desktop = inspect('custom', 1920, 1200, 'custom');
      clickNamed('Tablet');
      setTimeout(() => {
        const tablet = inspect('custom-tablet', 834, 1210, 'tablet');
        clickNamed('Telefon');
        setTimeout(() => resolve({ desktop, tablet, phone: inspect('custom-phone', 402, 874, 'phone') }), 150);
      }, 150);
    }, 150);
  })`);
  const uiSavedMonitor = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const desktop = Array.from(document.querySelectorAll('.breakpoints button')).find((button) => button.textContent?.trim() === 'Masaüstü');
    desktop?.click();
    setTimeout(() => {
      const star = document.querySelector('.preview-save-monitor');
      if (!star || star.disabled) return resolve({ passed: false, reason: 'star-missing' });
      star.click();
      setTimeout(() => {
        let stored = [];
        try { stored = JSON.parse(localStorage.getItem('rms.saved-monitors.v1') || '[]'); } catch {}
        const row = document.querySelector('.saved-monitor-row');
        const thumbnail = row?.querySelector('img')?.getAttribute('src') || '';
        const customIds = Array.from(document.querySelectorAll('.custom-frame-group [data-frame-id]')).map((node) => node.getAttribute('data-frame-id'));
        const ready = document.querySelector('.ready-frame-details');
        const columns = getComputedStyle(document.querySelector('.workspace-grid')).gridTemplateColumns;
        resolve({
          passed: Boolean(star.getAttribute('aria-pressed') === 'true' && row && stored.length >= 1 && thumbnail.startsWith('data:image/png') && row.querySelector('.saved-monitor-export')),
          hierarchy: customIds.join('|') === 'custom|custom-tablet|custom-phone' && Boolean(ready) && !ready.open,
          compact: columns.split(' ').some((value) => Math.abs(parseFloat(value) - 260) < 2),
          stored: stored.length,
          customIds,
          thumbnail: thumbnail.slice(0, 22),
        });
      }, 260);
    }, 180);
  })`);
  const uiSavedMonitorLoad = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const phone = Array.from(document.querySelectorAll('.breakpoints button')).find((button) => button.textContent?.trim() === 'Telefon');
    phone?.click();
    setTimeout(() => {
      document.querySelector('.saved-monitor-load')?.click();
      setTimeout(() => resolve(Boolean(
        document.querySelector('.frame-card.selected')?.getAttribute('data-frame-id') === 'custom'
        && document.querySelector('.device-stage')?.classList.contains('kind-custom')
        && document.querySelector('.preview-save-monitor')?.getAttribute('aria-pressed') === 'true'
      )), 180);
    }, 180);
  })`);
  const uiViewportReset = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const auto = document.querySelector('.viewport-mode-toggle');
    if (auto?.getAttribute('aria-checked') === 'true') auto.click();
    setTimeout(() => {
      const fields = Array.from(document.querySelectorAll('.viewport-fields input'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(fields[0], '1920'); fields[0].dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(fields[1], '1080'); fields[1].dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        document.querySelector('.viewport-reset')?.click();
        setTimeout(() => {
          const values = Array.from(document.querySelectorAll('.viewport-fields input')).map((field) => Number(field.value));
          resolve(Boolean(document.querySelector('.viewport-mode-toggle')?.getAttribute('aria-checked') === 'true' && values[0] === 1440 && values[1] === 900));
        }, 220);
      }, 120);
    }, 120);
  })`);
  const uiPhoneSideControls = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const phone = Array.from(document.querySelectorAll('.breakpoints button')).find((button) => button.textContent?.trim() === 'Telefon');
    phone?.click();
    setTimeout(() => {
      const originalConfirm = window.confirm; window.confirm = () => true;
      document.querySelector('.phone-side-left .component-remove')?.click();
      setTimeout(() => {
        const leftRemoved = !document.querySelector('.phone-side-left');
        const leftRestore = Array.from(document.querySelectorAll('.restore-component-button')).find((button) => button.textContent?.includes('Sol tuşlar'));
        leftRestore?.click();
        setTimeout(() => {
          const leftRestored = Boolean(document.querySelector('.phone-side-left'));
          document.querySelector('.phone-side-right .component-remove')?.click();
          setTimeout(() => {
            const rightRemoved = !document.querySelector('.phone-side-right');
            const rightRestore = Array.from(document.querySelectorAll('.restore-component-button')).find((button) => button.textContent?.includes('Sağ tuş'));
            rightRestore?.click();
            setTimeout(() => { window.confirm = originalConfirm; resolve(Boolean(leftRemoved && leftRestored && rightRemoved && document.querySelector('.phone-side-right'))); }, 100);
          }, 100);
        }, 100);
      }, 100);
    }, 180);
  })`);
  const uiFramesBefore = await uiWindow.webContents.executeJavaScript(`(() => {
    const preview = document.querySelector('.preview-canvas');
    const stage = document.querySelector('.device-stage');
    const reveal = document.querySelector('.frames-reveal');
    const defaultClosed = document.querySelector('.workspace-grid')?.classList.contains('frames-collapsed');
    if (!preview || !stage || !reveal || !defaultClosed) return { ready: false, defaultClosed };
    const collapsed = preview.getBoundingClientRect();
    const collapsedStage = stage.getBoundingClientRect();
    const revealRect = reveal.getBoundingClientRect();
    const collapsedCenterDelta = Math.abs((collapsedStage.left + collapsedStage.width / 2) - (collapsed.left + collapsed.width / 2));
    const collapsedColumns = getComputedStyle(document.querySelector('.workspace-grid')).gridTemplateColumns;
    const revealX = revealRect.left + revealRect.width / 2;
    const revealY = revealRect.top + revealRect.height / 2;
    const topAtReveal = document.elementFromPoint(revealX, revealY);
    const revealVisible = revealRect.width > 0 && revealRect.height > 0 && Boolean(topAtReveal?.closest('.frames-reveal'));
    reveal.click();
    return { ready: true, defaultClosed, collapsedWidth: collapsed.width, collapsedColumns, collapsedCenterDelta, revealX, revealY, revealVisible, topAtReveal: topAtReveal?.className || '' };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 700));
  const uiFramesOpened = await uiWindow.webContents.executeJavaScript(`(() => {
    const preview = document.querySelector('.preview-canvas');
    const stage = document.querySelector('.device-stage');
    const collapse = document.querySelector('.frames-collapse');
    if (!preview || !stage || !collapse) return { ready: false };
    const opened = preview.getBoundingClientRect();
    const openedStage = stage.getBoundingClientRect();
    const collapseRect = collapse.getBoundingClientRect();
    collapse.click();
    return { ready: true, openedWidth: opened.width, openedColumns: getComputedStyle(document.querySelector('.workspace-grid')).gridTemplateColumns, openedCenterDelta: Math.abs((openedStage.left + openedStage.width / 2) - (opened.left + opened.width / 2)), collapseX: collapseRect.left + collapseRect.width / 2, collapseY: collapseRect.top + collapseRect.height / 2 };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 260));
  const uiFramesClosedAgain = await uiWindow.webContents.executeJavaScript(`document.querySelector('.workspace-grid')?.classList.contains('frames-collapsed')`);
  const uiFramesInteractionOpened = Boolean(uiFramesOpened?.ready && uiFramesBefore?.collapsedWidth > uiFramesOpened.openedWidth + 150 && uiFramesOpened.openedCenterDelta < 2);
  const uiFramesPanel = {
    passed: Boolean(uiFramesBefore?.defaultClosed && uiFramesBefore?.revealVisible && uiFramesBefore.collapsedCenterDelta < 2 && (!uiFramesInteractionOpened || uiFramesClosedAgain)),
    defaultClosed: Boolean(uiFramesBefore?.defaultClosed),
    collapsedWidth: uiFramesBefore?.collapsedWidth,
    openedWidth: uiFramesOpened?.openedWidth,
    collapsedColumns: uiFramesBefore?.collapsedColumns,
    openedColumns: uiFramesOpened?.openedColumns,
    collapsedCenterDelta: uiFramesBefore?.collapsedCenterDelta,
    openedCenterDelta: uiFramesOpened?.openedCenterDelta,
    revealVisible: Boolean(uiFramesBefore?.revealVisible),
    interactionOpened: uiFramesInteractionOpened,
    topAtReveal: uiFramesBefore?.topAtReveal,
    revealX: uiFramesBefore?.revealX,
    revealY: uiFramesBefore?.revealY,
    closedAgain: Boolean(uiFramesClosedAgain),
  };
  const uiBackgroundGradient = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const tab = Array.from(document.querySelectorAll('.inspector-tabs button')).find((button) => button.textContent?.includes('Arka plan'));
    tab?.click();
    setTimeout(() => {
      const gradient = document.querySelector('.swatch.gradient');
      gradient?.click();
      setTimeout(() => {
        const add = Array.from(document.querySelectorAll('.gradient-stop-add')).find((button) => button.textContent?.includes('Renk ekle'));
        add?.click();
        add?.click();
        setTimeout(() => {
          const rows = Array.from(document.querySelectorAll('.gradient-stop-row'));
          const hex = rows[0]?.querySelector('.gradient-hex-input');
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (hex && setter) {
            hex.focus();
            setter.call(hex, '#123456');
            hex.dispatchEvent(new Event('input', { bubbles: true }));
          }
          setTimeout(() => {
            hex?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            hex?.blur();
            setTimeout(() => {
              const backgroundImage = getComputedStyle(document.querySelector('.preview-canvas')).backgroundImage;
              const values = Array.from(document.querySelectorAll('.gradient-hex-input')).map((input) => input.value);
              resolve(Boolean(gradient && document.querySelector('.gradient-settings') && rows.length === 4 && values.includes('#123456') && backgroundImage.includes('gradient') && (backgroundImage.includes('18, 52, 86') || backgroundImage.includes('#123456'))));
            }, 140);
          }, 80);
        }, 140);
      }, 120);
    }, 100);
  })`);
  const uiPageControls = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const tabNamed = (name) => Array.from(document.querySelectorAll('.inspector-tabs button')).find((button) => button.textContent?.includes(name));
    tabNamed('Çıktı')?.click();
    setTimeout(() => {
      const toggleNamed = (name) => Array.from(document.querySelectorAll('.toggle-row')).find((row) => row.textContent?.includes(name))?.querySelector('input');
      const scrollbar = toggleNamed('Scrollbar gizle');
      const cursor = toggleNamed('İmleci gizle');
      if (scrollbar && !scrollbar.checked) scrollbar.click();
      if (cursor && !cursor.checked) cursor.click();
      const outputClean = Boolean(scrollbar && cursor && !document.querySelector('.history-list') && !Array.from(document.querySelectorAll('button,.section-title')).some((node) => /4 oranı|export geçmişi/i.test(node.textContent || '')));
      tabNamed('Gelişmiş')?.click();
      setTimeout(() => {
        const advancedText = document.querySelector('.inspector-scroll')?.textContent || '';
        const freeze = toggleNamed('Animasyonları dondur');
        const background = toggleNamed('Sayfa zeminini gizle');
        if (freeze && !freeze.checked) freeze.click();
        if (background && !background.checked) background.click();
        const custom = document.querySelector('.field-column textarea');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (custom && setter) {
          setter.call(custom, 'body{outline:7px solid rgb(1,2,3)!important}');
          custom.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setTimeout(() => {
          const eye = document.querySelector('.page-element-eye');
          const selector = eye?.closest('.page-element-item')?.querySelector('.page-element-label')?.getAttribute('title') || '';
          eye?.click();
          setTimeout(() => resolve({
            outputClean,
            outputToggles: Boolean(scrollbar?.checked && cursor?.checked),
            advancedClean: !/Capture gecikmesi|Tam sayfa|\bMODE\b/i.test(advancedText),
            advancedToggles: Boolean(freeze?.checked && background?.checked),
            pageElementCount: document.querySelectorAll('.page-element-item').length,
            selector,
            safeSelector: Boolean(selector && !/^(?:html|body|:root|#(?:root|app|__next)|\.(?:root|app))$/i.test(selector)),
            listRetained: document.querySelectorAll('.page-element-item').length > 0,
            eyeHidden: Boolean(document.querySelector('.page-element-item.hidden')),
            recentHeart: Boolean(document.querySelector('.recent-bookmark .lucide-heart')),
          }), 220);
        }, 350);
      }, 550);
    }, 180);
  })`);
  await new Promise((resolve) => setTimeout(resolve, 420));
  const presentationGuest = webContents.getAllWebContents().find((contents) => contents.getType() === 'webview' && contents.getURL().includes('ui-enter-navigation'));
  const uiGuestPresentation = presentationGuest && !presentationGuest.isDestroyed()
    ? await presentationGuest.executeJavaScript(`(() => {
        const style = document.querySelector('#__rms_page_presentation')?.textContent || '';
        const body = getComputedStyle(document.body);
        return {
          style,
          transparentBody: body.backgroundColor === 'rgba(0, 0, 0, 0)',
          bodyVisible: body.visibility !== 'hidden' && body.display !== 'none',
          outlineWidth: body.outlineWidth,
        };
      })()`, true)
    : null;
  const uiPageControlsPassed = Boolean(uiPageControls?.outputClean
    && uiPageControls?.outputToggles
    && uiPageControls?.advancedClean
    && uiPageControls?.advancedToggles
    && uiPageControls?.pageElementCount > 0
    && uiPageControls?.selector
    && uiPageControls?.safeSelector
    && uiPageControls?.listRetained
    && uiPageControls?.eyeHidden
    && uiPageControls?.recentHeart
    && uiGuestPresentation?.style?.includes('cursor:none')
    && uiGuestPresentation?.style?.includes('::-webkit-scrollbar')
    && uiGuestPresentation?.style?.includes('animation-play-state:paused')
    && uiGuestPresentation?.style?.includes('visibility:hidden')
    && uiGuestPresentation?.transparentBody
    && uiGuestPresentation?.bodyVisible
    && uiGuestPresentation?.outlineWidth === '7px');
  const uiInspectorOrderAndCenter = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const tabs = Array.from(document.querySelectorAll('.inspector-tabs button'));
    const order = tabs.map((tab) => tab.textContent?.trim()).join('|');
    const orderCorrect = order === 'Kamera|Arka plan|Gelişmiş|Çıktı';
    tabs[0]?.click();
    setTimeout(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const x = document.querySelector('input[aria-label="Kamera X"]');
      if (x && setter) {
        setter.call(x, '47');
        x.dispatchEvent(new Event('input', { bubbles: true }));
      }
      setTimeout(() => {
        const y = document.querySelector('input[aria-label="Kamera Y"]');
        if (y && setter) {
          setter.call(y, '-33');
          y.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setTimeout(() => {
          const movedX = document.querySelector('input[aria-label="Kamera X"]');
          const movedY = document.querySelector('input[aria-label="Kamera Y"]');
          const moved = Number(movedX?.value) === 47 && Number(movedY?.value) === -33;
          const center = document.querySelector('.center-device-button');
          const controls = document.querySelector('.composition-frame-controls');
          const buttons = Array.from(controls?.querySelectorAll('button') || []);
          const toolbar = document.querySelector('.preview-toolbar');
          const restores = document.querySelector('.hidden-component-restores');
          const centerRect = center?.getBoundingClientRect();
          const toolbarRect = toolbar?.getBoundingClientRect();
          const controlsRect = controls?.getBoundingClientRect();
          const restoresRect = restores?.getBoundingClientRect();
          const standaloneCenter = center?.parentElement === toolbar && buttons[0]?.textContent?.trim() === '1:1';
          const geometricCenter = Boolean(centerRect && toolbarRect && Math.abs((centerRect.left + centerRect.width / 2) - (toolbarRect.left + toolbarRect.width / 2)) <= 1);
          const framesAtRight = Boolean(controlsRect && toolbarRect && Math.abs(toolbarRect.right - controlsRect.right - 9) <= 1);
          const restoresBetween = !restoresRect?.width || Boolean(centerRect && controlsRect && restoresRect.left >= centerRect.right && restoresRect.right <= controlsRect.left);
          center?.click();
          setTimeout(() => {
            const centeredX = document.querySelector('input[aria-label="Kamera X"]');
            const centeredY = document.querySelector('input[aria-label="Kamera Y"]');
            const centeredTransform = document.querySelector('.stage-camera')?.style.transform || '';
            resolve({
              passed: Boolean(orderCorrect && moved && center && standaloneCenter && geometricCenter && framesAtRight && restoresBetween && Number(centeredX?.value) === 0 && Number(centeredY?.value) === 0 && centeredTransform.includes('translate(0%, 0%)')),
              order: tabs.map((tab) => tab.textContent?.trim()),
              orderCorrect,
              headerExportAbsent: !document.querySelector('.app-header .export-button'),
              standaloneCenter,
              geometricCenter,
              framesAtRight,
              restoresBetween,
              moved,
              cameraX: Number(centeredX?.value),
              cameraY: Number(centeredY?.value),
              centeredTransform,
            });
          }, 220);
        }, 180);
      }, 140);
    }, 180);
  })`);
  const uiCleanup = await uiWindow.webContents.executeJavaScript(`(() => ({
    passed: !document.querySelector('.import-stack') && !document.querySelector('.canvas-meta') && !document.querySelector('.status-bar') && !document.querySelector('.output-kind-grid') && !document.querySelector('.brand-lockup') && !document.querySelector('.brand-mark') && !document.querySelector('.traffic') && !document.querySelector('.secure-dot') && !document.querySelector('.lucide-ellipsis') && !document.querySelector('.app-header .export-button'),
    exportIcons: document.querySelectorAll('.lucide-file-output').length,
    headerControls: Array.from(document.querySelectorAll('.app-header > button')).map((button) => ({ className: button.className, text: button.textContent?.trim() })),
    projectFileUiAbsent: Array.from(document.querySelectorAll('input[type="file"]')).every((input) => !String(input.accept).includes('project')) && !document.body.textContent?.includes('Projeyi aç') && !document.body.textContent?.includes('Projeyi kaydet'),
    squareUi: ['.address-field','.bookmark-menu-wrap > button','.device-settings-trigger','.theme-toggle','.center-device-button'].every((selector) => {
      const node = document.querySelector(selector);
      return node && getComputedStyle(node).borderRadius === '0px';
    }),
  }))()`);
  const uiMonitorSelected = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    if (document.querySelector('.left-panel')?.getAttribute('aria-hidden') === 'true') document.querySelector('.frames-reveal')?.click();
    setTimeout(() => {
      document.querySelector('[data-frame-id="studio-16-9"]')?.click();
      setTimeout(() => resolve(document.querySelector('.frame-card.selected')?.getAttribute('data-frame-id') === 'studio-16-9'), 180);
    }, 180);
  })`);
  const uiDeviceEditor = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    if (!document.querySelector('.device-settings-glass')) document.querySelector('.device-settings-trigger')?.click();
    setTimeout(() => {
      const panel = Boolean(document.querySelector('.device-settings-glass'));
      const deviceGroups = Array.from(document.querySelectorAll('.device-settings-group'));
      const fourColumns = deviceGroups.length === 4;
      const surfaceInFrame = Boolean(deviceGroups[0]?.textContent?.includes('Mat ekran') && deviceGroups[0]?.textContent?.includes('Cam yansıması'));
      const columnScroll = deviceGroups.every((group) => getComputedStyle(group).overflowY === 'auto');
      const panelStyle = getComputedStyle(document.querySelector('.device-settings-glass'));
      const panelBlur = panelStyle.backdropFilter || panelStyle.webkitBackdropFilter || '';
      const glassReadable = (panelBlur.includes('blur(42px)') || panelStyle.backgroundColor.includes('0.92')) && panelStyle.color !== 'rgba(0, 0, 0, 0)' && panelStyle.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const geometryLocked = Boolean(deviceGroups[0]?.querySelector('.technical-lock-note')
        && !Array.from(deviceGroups[0]?.querySelectorAll('input[type="range"]') || []).some((input) => ['Çerçeve kalınlığı','Ekran eni','Ekran boyu'].includes(input.getAttribute('aria-label')))
        && !Array.from(deviceGroups[2]?.querySelectorAll('input[type="range"]') || []).some((input) => ['Boru kalınlığı','Boru boyu','Taban eni','Taban boyu'].includes(input.getAttribute('aria-label'))));
      const gradientControls = Boolean(deviceGroups[2]?.textContent?.includes('Gradient boyutu') && deviceGroups[2]?.textContent?.includes('Gradient yumuşaklığı'));
      const colorInput = deviceGroups[1]?.querySelector('input[type="color"]');
      const colorSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (colorInput && colorSetter) {
        colorSetter.call(colorInput, '#ff00ff');
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const materialButton = deviceGroups[1]?.querySelector('[data-material="plastic"]');
      materialButton?.click();
      const wireframeToggle = Array.from(document.querySelectorAll('.toggle-row')).find((row) => row.textContent?.toLowerCase().includes('wireframe'))?.querySelector('input');
      setTimeout(() => {
        const colorBackground = getComputedStyle(document.querySelector('.device-body')).backgroundImage;
        const colorControl = colorInput?.value === '#ff00ff' && (colorBackground.includes('255, 0, 255') || colorBackground.includes('#ff00ff'));
        const materialControl = materialButton?.classList.contains('active') && materialButton?.getAttribute('aria-pressed') === 'true';
        const curveRemoved = !document.body.textContent?.toLowerCase().includes('ekran curve') && !document.querySelector('.curved-surface,.device-curve-outline,#live-screen-curve-warp');
        const gradientStem = document.querySelector('.monitor-stem');
        const gradientBackgroundImage = gradientStem?.style.background || gradientStem?.style.backgroundImage || '';
        const gradientBackgroundSize = gradientStem?.style.backgroundSize || '';
        const gradient = Boolean(gradientBackgroundImage.includes('linear-gradient') && gradientBackgroundSize.includes('240%'));
        if (wireframeToggle && !wireframeToggle.checked) wireframeToggle.click();
        setTimeout(() => {
          const stem = document.querySelector('.monitor-stem');
          const base = document.querySelector('.monitor-base');
          const stemRect = stem?.getBoundingClientRect();
          const baseRect = base?.getBoundingClientRect();
          const wireScreen = document.querySelector('.live-screen');
          const wireStyle = wireScreen ? getComputedStyle(wireScreen) : null;
          const wireOutside = Boolean(wireStyle?.borderLeftWidth === '0px' && wireStyle?.boxShadow !== 'none');
          const stemJoin = Boolean(stemRect && baseRect && Math.abs(stemRect.bottom - baseRect.top) < 2 && getComputedStyle(stem).borderBottomWidth === '0px');
          window.confirm = () => true;
          document.querySelector('.monitor-stem .component-remove')?.click();
          setTimeout(() => {
            const removed = !document.querySelector('.monitor-stem');
            const restore = Array.from(document.querySelectorAll('.restore-component-button')).find((button) => button.textContent?.includes('Ayak borusu'));
            restore?.click();
            setTimeout(() => {
              const restored = Boolean(document.querySelector('.monitor-stem'));
              document.querySelector('.monitor-base .component-remove')?.click();
              setTimeout(() => resolve({ panel, fourColumns, surfaceInFrame, columnScroll, glassReadable, panelBlur, panelColor: panelStyle.color, panelBackground: panelStyle.backgroundColor, geometryLocked, colorControl, materialControl, curveRemoved, gradientControls, gradient, gradientBackgroundImage, gradientBackgroundSize, stemJoin, wireOutside, wireframe: Boolean(document.querySelector('.device-stage.wireframe')), removeRestore: removed && restored, topRestoreVisible: Boolean(document.querySelector('.preview-actions .restore-component-button')) }), 120);
            }, 120);
          }, 120);
        }, 120);
      }, 160);
    }, 160);
  })`);
  const uiReadyFrameAppearance = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const selected = document.querySelector('.frame-card.selected')?.getAttribute('data-frame-id');
    const wireframeToggle = Array.from(document.querySelectorAll('.toggle-row')).find((row) => row.textContent?.toLowerCase().includes('wireframe'))?.querySelector('input');
    if (wireframeToggle?.checked) wireframeToggle.click();
    const colorInput = document.querySelector('.device-settings-group:nth-child(2) input[type="color"]');
    const materialButton = document.querySelector('.device-settings-group:nth-child(2) [data-material="glass"]');
    const colorSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (colorInput && colorSetter) {
      colorSetter.call(colorInput, '#5a2dff');
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    materialButton?.click();
    setTimeout(() => {
      const body = document.querySelector('.device-body');
      const background = body ? getComputedStyle(body).backgroundImage : '';
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem('rms.project.v1') || '{}'); } catch {}
      resolve({
        passed: Boolean(selected === 'studio-16-9' && String(stored.deviceColor).toLowerCase() === '#5a2dff' && stored.deviceMaterial === 'glass' && (background.includes('90, 45, 255') || background.includes('#5a2dff'))),
        selected,
        color: stored.deviceColor,
        material: stored.deviceMaterial,
        background,
      });
    }, 220);
  })`);
  const uiDevicePanelImage = await uiWindow.webContents.capturePage();
  const uiDevicePanelPath = path.join(outputPath, 'electron-device-panel-1600x980.png');
  await fs.writeFile(uiDevicePanelPath, uiDevicePanelImage.toPNG());
  const uiPresetFavorite = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const row = document.querySelector('.ready-frame-row [data-frame-id="studio-16-9"]')?.closest('.ready-frame-row');
    const favorite = row?.querySelector('.frame-favorite');
    favorite?.click();
    setTimeout(() => {
      let stored = [];
      try { stored = JSON.parse(localStorage.getItem('rms.favorite-frames.v1') || '[]'); } catch {}
      resolve(Boolean(stored.includes('studio-16-9') && document.querySelector('.favorite-frame-group [data-frame-id="studio-16-9"]')));
    }, 160);
  })`);
  const uiDeviceDetailToggle = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const heading = Array.from(document.querySelectorAll('.component-heading')).find((node) => node.querySelector(':scope > span')?.textContent?.includes('Cihaz detayı'));
    const toggle = heading?.querySelector('input[type="checkbox"]');
    if (!toggle) return resolve({ passed: false, reason: 'toggle-missing' });
    const hiddenByDefault = !toggle.checked && !document.querySelector('.device-camera, .phone-island, .screen-notch');
    if (!toggle.checked) toggle.click();
    setTimeout(() => {
      const detail = document.querySelector('.device-camera, .phone-island, .screen-notch');
      const visibleBefore = Boolean(detail);
      toggle.click();
      setTimeout(() => {
        const hidden = !document.querySelector('.device-camera, .phone-island, .screen-notch');
        const currentToggle = Array.from(document.querySelectorAll('.component-heading')).find((node) => node.querySelector(':scope > span')?.textContent?.includes('Cihaz detayı'))?.querySelector('input[type="checkbox"]');
        currentToggle?.click();
        setTimeout(() => {
          const restored = Boolean(document.querySelector('.device-camera, .phone-island, .screen-notch'));
          resolve({ passed: Boolean(hiddenByDefault && visibleBefore && hidden && restored), hiddenByDefault, visibleBefore, hidden, restored });
        }, 120);
      }, 120);
    }, 120);
  })`);
  const uiDeviceDockDrag = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const dock = document.querySelector('.device-settings-dock');
    const glass = document.querySelector('.device-settings-glass');
    const target = glass?.querySelector('.device-settings-heading > span');
    if (!dock || !glass || !target) return resolve(false);
    const before = dock.getBoundingClientRect();
    const handle = target.getBoundingClientRect();
    const x = handle.left + Math.min(20, handle.width / 2);
    const y = handle.top + handle.height / 2;
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 77, button: 0, buttons: 1, clientX: x, clientY: y }));
    glass.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 77, button: 0, buttons: 1, clientX: x, clientY: y - 64 }));
    glass.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 77, button: 0, clientX: x, clientY: y - 64 }));
    setTimeout(() => {
      const after = dock.getBoundingClientRect();
      resolve(Math.abs(after.top - before.top) > 30);
    }, 160);
  })`);
  const uiDeviceDockCollapsedDrag = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const trigger = document.querySelector('.device-settings-trigger');
    const closePanel = () => {
      if (trigger?.getAttribute('aria-expanded') === 'true') trigger.click();
      if (trigger?.getAttribute('aria-expanded') === 'true') trigger.click();
    };
    closePanel();
    setTimeout(() => {
      const dock = document.querySelector('.device-settings-dock');
      const handleTarget = document.querySelector('.device-settings-drag-handle');
      if (!dock || !handleTarget || trigger?.getAttribute('aria-expanded') !== 'false') return resolve(false);
      const before = dock.getBoundingClientRect();
      const handle = handleTarget.getBoundingClientRect();
      const x = handle.left + handle.width / 2;
      const y = handle.top + handle.height / 2;
      handleTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 91, button: 0, buttons: 1, clientX: x, clientY: y }));
      dock.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 91, button: 0, buttons: 1, clientX: x - 96, clientY: y - 52 }));
      dock.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 91, button: 0, clientX: x - 96, clientY: y - 52 }));
      setTimeout(() => {
        const after = dock.getBoundingClientRect();
        resolve(Math.hypot(after.left - before.left, after.top - before.top) > 30 && Math.round(after.width) <= 330);
      }, 180);
    }, 160);
  })`);
  await progress(`UI interactions address=${uiAddressNavigation} typed=${uiAddressTyped} bookmark=${Boolean(bookmarkAdded && bookmarkPersistence)} presetFavorite=${uiPresetFavorite} swap=${uiDimensionSwap} reset=${uiViewportReset} phoneSides=${uiPhoneSideControls} responsive=${uiResponsiveResize} autoResponsive=${uiAutoResponsive} specialFrames=${Boolean(uiBreakpointCustom.desktop && uiBreakpointCustom.tablet && uiBreakpointCustom.phone)} savedMonitor=${uiSavedMonitor.passed} frames=${uiFramesPanel.passed} backgroundGradient=${uiBackgroundGradient} pageControls=${uiPageControlsPassed} detail=${uiDeviceDetailToggle.passed} cleanup=${uiCleanup.passed} square=${uiCleanup.squareUi} locked=${uiDeviceEditor.geometryLocked} glass=${uiDeviceEditor.glassReadable} dockDrag=${uiDeviceDockDrag} collapsedDrag=${uiDeviceDockCollapsedDrag} color=${uiDeviceEditor.colorControl} material=${uiDeviceEditor.materialControl} curveRemoved=${uiDeviceEditor.curveRemoved} gradient=${uiDeviceEditor.gradient} wireOutside=${uiDeviceEditor.wireOutside} stemJoin=${uiDeviceEditor.stemJoin} wireframe=${uiDeviceEditor.wireframe} parts=${uiDeviceEditor.removeRestore} viewport=${uiViewport?.width || 0}x${uiViewport?.height || 0}`);
  await uiWindow.webContents.executeJavaScript(`localStorage.setItem('rms.frames-panel.v1', 'open')`);
  await new Promise((resolve) => {
    uiWindow.webContents.once('did-finish-load', resolve);
    uiWindow.reload();
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const clickSaved = () => {
      const button = document.querySelector('.saved-monitor-load');
      if (button) { button.click(); resolve(true); return; }
      setTimeout(clickSaved, 40);
    };
    clickSaved();
  })`);
  await new Promise((resolve) => setTimeout(resolve, 240));
  await new Promise((resolve) => setTimeout(resolve, 220));
  await uiWindow.webContents.executeJavaScript(`if (!document.querySelector('.device-settings-glass')) document.querySelector('.device-settings-trigger')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const uiImage = await uiWindow.webContents.capturePage();
  const uiPath = path.join(outputPath, 'electron-ui-1600x980.png');
  await fs.writeFile(uiPath, uiImage.toPNG());
  const uiCompositionFrameActive = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const controls = document.querySelector('.composition-frame-controls');
    const buttons = Array.from(controls?.querySelectorAll('button') || []);
    const ratio = buttons.find((button) => button.textContent?.trim() === '4:5');
    const portrait = buttons.at(-1);
    if (!ratio || !portrait) return resolve({ passed: false, reason: 'controls-missing' });
    ratio.click();
    portrait.click();
    setTimeout(() => {
      const guide = document.querySelector('.composition-frame-guide');
      const rect = guide?.getBoundingClientRect();
      resolve({
        passed: Boolean(guide && rect && Math.abs(rect.width / rect.height - 0.8) < 0.015),
        ratio: rect ? rect.width / rect.height : 0,
        masked: Boolean(guide && getComputedStyle(guide).boxShadow !== 'none'),
        portraitActive: portrait.classList.contains('active'),
      });
    }, 180);
  })`);
  const uiFramingImage = await uiWindow.webContents.capturePage();
  const uiFramingPath = path.join(outputPath, 'electron-framing-1600x980.png');
  await fs.writeFile(uiFramingPath, uiFramingImage.toPNG());
  const uiCompositionFrameToggleOff = await uiWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const ratio = Array.from(document.querySelectorAll('.composition-frame-controls button')).find((button) => button.textContent?.trim() === '4:5');
    ratio?.click();
    setTimeout(() => resolve(!document.querySelector('.composition-frame-guide') && ratio?.getAttribute('aria-pressed') === 'false'), 160);
  })`);
  const uiPostReload = await uiWindow.webContents.executeJavaScript(`(() => ({
    curveRemoved: !document.body.textContent?.toLowerCase().includes('ekran curve') && !document.querySelector('.curved-surface,.device-curve-outline,#live-screen-curve-warp'),
    favoritePersisted: (() => { try { return JSON.parse(localStorage.getItem('rms.favorite-frames.v1') || '[]').includes('studio-16-9') && Boolean(document.querySelector('.favorite-frame-group [data-frame-id="studio-16-9"]')); } catch { return false; } })(),
  }))()`);
  report.ui = { file: uiPath, devicePanelFile: uiDevicePanelPath, framingFile: uiFramingPath, width: uiImage.getSize().width, height: uiImage.getSize().height, defaultFrame: uiDefaultFrame, addressFocused: uiAddressFocused, addressTyping: uiAddressTyped, addressNavigation: uiAddressNavigation, embeddedWebviewCapture, bookmarkPersistence: Boolean(bookmarkAdded && bookmarkPersistence), presetFavorite: { toggled: uiPresetFavorite, persisted: uiPostReload.favoritePersisted }, dimensionSwap: uiDimensionSwap, viewportReset: uiViewportReset, compositionFrame: { ...uiCompositionFrameActive, toggleOff: uiCompositionFrameToggleOff }, phoneSideControls: uiPhoneSideControls, responsiveResize: uiResponsiveResize, autoResponsive: uiAutoResponsive, breakpointCustom: uiBreakpointCustom, savedMonitor: { ...uiSavedMonitor, load: uiSavedMonitorLoad }, framesPanel: uiFramesPanel, backgroundGradient: uiBackgroundGradient, pageControls: uiPageControls, guestPresentation: uiGuestPresentation, inspectorOrderAndCenter: uiInspectorOrderAndCenter, deviceDetailToggle: uiDeviceDetailToggle, curveRemoved: uiPostReload.curveRemoved, cleanup: uiCleanup, autoViewport: uiAutoGuestViewport, autoFrameState: uiAutoFrameState, customViewport: uiCustomViewport, deviceDockDrag: uiDeviceDockDrag, deviceDockCollapsedDrag: uiDeviceDockCollapsedDrag, deviceEditor: uiDeviceEditor, readyFrameAppearance: uiReadyFrameAppearance, guestViewport: uiViewport, elementGeometry: uiElementGeometry, viewportFit: uiViewportFit };
  uiWindow.destroy();
  await new Promise((resolve) => redirectServer.close(resolve));

  const successfulSites = new Set(report.captures.map((item) => new URL(item.finalUrl || item.url).hostname)).size;
  report.assertions = {
    threeRealSites: successfulSites >= 3,
    ratiosCovered: report.captures.length >= 4,
    highDensitySingleViewport: report.captures.some((item) => item.id === 'redirect-density' && item.captureWidth === 2700 && item.captureHeight === 1748 && item.quadrantLumaSpan >= 120 && item.singleViewportMeanDifference <= 12),
    embeddedWebviewHighDensitySingleViewport: Boolean(embeddedWebviewCapture.passed),
    vectorWebsiteAndDeviceExport: Boolean(report.vectorExport?.passed),
    vectorYcswuWebsiteAndDeviceExport: Boolean(report.vectorYcswuExport?.passed),
    fullPreviewExport: report.exports.some((item) => item.id === 'custom-full-preview-2560px-150dpi' && item.width === 2560 && Math.abs(item.width / item.height - 1382 / 967) < 0.002),
    output4000: report.exports.some((item) => item.width === 4000),
    dpi300: report.exports.some((item) => item.density === 300),
    trueTransparentCorners: report.exports.some((item) => item.id.includes('transparent') && item.cornerAlpha.every((alpha) => alpha === 0)),
    savedDeviceEmptyTransparent: report.exports.some((item) => item.id === 'saved-device-empty-transparent-1920px-72dpi' && item.centerAlpha === 0 && item.sampledTransparentPixels > 0),
    zoomCase: report.exports.some((item) => item.id.includes('zoom')),
    gradientMaterialCase: report.exports.some((item) => item.id.includes('gradient-material')),
    flatWireframeCase: report.exports.some((item) => item.id.includes('flat-wireframe')),
    framedPortraitExport: report.exports.some((item) => item.id === 'framed-portrait-4-5-2560px-150dpi' && item.width === 2048 && item.height === 2560),
    framedSquareYcswuExport: report.exports.some((item) => item.id === 'framed-square-1-1-ycswu-2560px-150dpi' && item.width === 2560 && item.height === 2560),
    uiAddressTyping: Boolean(uiAddressTyped),
    uiAddressNavigation,
    uiDefaultCustomFrame: Boolean(uiDefaultFrame.selected === 'custom' && uiDefaultFrame.first === 'custom'),
    uiBreakpointCustomFrame: Boolean(uiBreakpointCustom.desktop && uiBreakpointCustom.tablet && uiBreakpointCustom.phone),
    uiSavedMonitor: Boolean(uiSavedMonitor.passed && uiSavedMonitorLoad),
    uiPresetFavorite: Boolean(uiPresetFavorite && uiPostReload.favoritePersisted),
    uiCompactFrameHierarchy: Boolean(uiSavedMonitor.hierarchy && uiSavedMonitor.compact),
    bookmarkPersistence: Boolean(bookmarkAdded && bookmarkPersistence),
    uiDimensionSwap,
    uiViewportReset,
    uiCompositionFrame: Boolean(uiCompositionFrameActive.passed && uiCompositionFrameActive.masked && uiCompositionFrameActive.portraitActive && uiCompositionFrameToggleOff),
    uiPhoneSideControls,
    uiResponsiveResize,
    uiAutoResponsive,
    uiFramesPanel: Boolean(uiFramesPanel.passed && uiFramesPanel.defaultClosed && uiFramesPanel.closedAgain),
    uiBackgroundGradient,
    uiDeviceDetailToggle: Boolean(uiDeviceDetailToggle.passed),
    uiCleanup: Boolean(uiCleanup.passed && uiCleanup.exportIcons >= 2
      && uiCleanup.headerControls?.length === 2
      && uiCleanup.headerControls[0]?.className === 'language-button'
      && uiCleanup.headerControls[1]?.className === 'theme-toggle'
      && uiCleanup.projectFileUiAbsent),
    nativeMenuRemoved: Boolean(report.nativeMenuRemoved),
    uiSquareChrome: Boolean(uiCleanup.squareUi),
    uiPageControls: uiPageControlsPassed,
    uiInspectorOrderAndCenter: Boolean(uiInspectorOrderAndCenter.passed && uiInspectorOrderAndCenter.headerExportAbsent),
    uiDevicePanel: Boolean(uiMonitorSelected && uiDeviceEditor.panel),
    uiDeviceFourColumns: Boolean(uiDeviceEditor.fourColumns),
    uiScreenSurfaceInFrame: Boolean(uiDeviceEditor.surfaceInFrame),
    uiDeviceColumnScroll: Boolean(uiDeviceEditor.columnScroll),
    uiDeviceGlassReadable: Boolean(uiDeviceEditor.glassReadable),
    uiRealGeometryLocked: Boolean(uiDeviceEditor.geometryLocked),
    uiDeviceDockDrag: Boolean(uiDeviceDockDrag),
    uiDeviceDockCollapsedDrag: Boolean(uiDeviceDockCollapsedDrag),
    uiColorControl: Boolean(uiDeviceEditor.colorControl),
    uiMaterialControl: Boolean(uiDeviceEditor.materialControl),
    uiReadyFrameAppearance: Boolean(uiReadyFrameAppearance.passed),
    uiCurveRemoved: Boolean(uiDeviceEditor.curveRemoved && uiPostReload.curveRemoved),
    uiGradientControls: Boolean(uiDeviceEditor.gradientControls),
    uiSoftPartGradient: Boolean(uiDeviceEditor.gradient),
    uiWireframeStemJoin: Boolean(uiDeviceEditor.stemJoin),
    uiWireframe: Boolean(uiDeviceEditor.wireframe),
    uiWireframeOutside: Boolean(uiDeviceEditor.wireOutside),
    uiComponentRemoveRestore: Boolean(uiDeviceEditor.removeRestore),
    uiTopRestoreVisible: Boolean(uiDeviceEditor.topRestoreVisible),
    uiViewportFit,
  };
  report.passed = Object.values(report.assertions).every(Boolean) && report.errors.length === 0;
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(outputPath, 'qa-report.json'), JSON.stringify(report, null, 2), 'utf8');
  await progress(`FINISH passed=${report.passed}`);
  if (!report.passed) throw new Error(`Smoke QA failed: ${JSON.stringify({ assertions: report.assertions, errors: report.errors })}`);
  return report;
}

ipcMain.handle('rms:runtime-info', () => ({
  desktop: true,
  platform: process.platform,
  version: app.getVersion(),
  userData: app.getPath('userData'),
}));
ipcMain.handle('rms:capture-page', (_event, options) => capturePage(options));
ipcMain.handle('rms:capture-page-svg', (_event, options) => capturePageSvg(options));
ipcMain.handle('rms:save-image', (_event, request) => saveImage(request));
ipcMain.handle('rms:save-svg', (_event, request) => saveSvg(request));
ipcMain.handle('rms:show-item', (_event, targetPath) => shell.showItemInFolder(String(targetPath)));
ipcMain.handle('rms:read-image', async (_event, kind) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: kind === 'frame' ? 'PNG çerçeve seç' : kind === 'mask' ? 'PNG ekran maskesi seç' : 'Arka plan görseli seç',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'cancelled' };
    const filePath = result.filePaths[0];
    const buffer = await fs.readFile(filePath);
    return { ok: true, path: filePath, dataUrl: `data:${mimeFromPath(filePath)};base64,${buffer.toString('base64')}` };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

// Automated QA must remain runnable while the user has a packaged build open.
// Interactive launches still keep the normal single-instance behavior.
const gotLock = smokeOutputPath ? true : app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const persistentSession = session.fromPartition(PARTITION);
    persistentSession.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(['clipboard-sanitized-write', 'fullscreen'].includes(permission));
    });
    if (smokeOutputPath) {
      try {
        const report = await runSmokeSuite(smokeOutputPath);
        process.stdout.write(`${JSON.stringify({ passed: report.passed, output: smokeOutputPath, assertions: report.assertions })}\n`);
        app.exitCode = 0;
      } catch (error) {
        process.stderr.write(`${error.stack || error}\n`);
        app.exitCode = 1;
      } finally {
        app.exit(app.exitCode || 0);
      }
    } else {
      await loadMainWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (!smokeOutputPath && process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void loadMainWindow();
});
