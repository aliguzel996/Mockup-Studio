const path = require('node:path');
const fs = require('node:fs/promises');
const fontkit = require('fontkit');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const SVG_NS = 'http://www.w3.org/2000/svg';
const FONT_DATA_PATTERN = /data:(?:font\/[\w.+-]+|application\/(?:font-[\w.+-]+|x-font-[\w.+-]+|vnd\.ms-fontobject));base64,([a-z0-9+/=]+)/gi;
const FONT_URL_PATTERN = /\.(?:woff2?|ttf|otf|ttc)(?:[?#]|$)/i;
const OUTLINE_SKIP_ATTRIBUTES = new Set([
  'x', 'y', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
  'font-family', 'font-size', 'font-size-adjust', 'font-stretch', 'font-style',
  'font-variant', 'font-weight', 'letter-spacing', 'word-spacing',
  'text-anchor', 'dominant-baseline', 'alignment-baseline', 'writing-mode',
]);

const SYSTEM_FONT_FILES = [
  'segoeui.ttf', 'segoeuib.ttf', 'segoeuii.ttf', 'segoeuiz.ttf', 'segoeuil.ttf', 'segoeuisl.ttf',
  'arial.ttf', 'arialbd.ttf', 'ariali.ttf', 'arialbi.ttf',
  'calibri.ttf', 'calibrib.ttf', 'calibrii.ttf', 'calibriz.ttf',
  'tahoma.ttf', 'tahomabd.ttf', 'verdana.ttf', 'verdanab.ttf', 'verdanai.ttf', 'verdanaz.ttf',
  'georgia.ttf', 'georgiab.ttf', 'georgiai.ttf', 'georgiaz.ttf',
  'times.ttf', 'timesbd.ttf', 'timesi.ttf', 'timesbi.ttf',
  'cour.ttf', 'courbd.ttf', 'couri.ttf', 'courbi.ttf',
  'consola.ttf', 'consolab.ttf', 'consolai.ttf', 'consolaz.ttf',
  'seguisym.ttf', 'seguiemj.ttf', 'SegoeIcons.ttf',
];

const BUNDLED_FONT_FILES = [
  'space-mono-latin-400-normal.woff2',
  'space-mono-latin-400-italic.woff2',
  'space-mono-latin-700-normal.woff2',
  'space-mono-latin-700-italic.woff2',
  'space-mono-latin-ext-400-normal.woff2',
  'space-mono-latin-ext-400-italic.woff2',
  'space-mono-latin-ext-700-normal.woff2',
  'space-mono-latin-ext-700-italic.woff2',
];

function number(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value || '').replace(/px$/i, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFamily(value) {
  return String(value || '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function familyList(value) {
  return String(value || '')
    .split(',')
    .map((part) => normalizeFamily(part))
    .filter(Boolean);
}

function requestedWeight(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bold' || normalized === 'bolder') return 700;
  if (normalized === 'normal' || normalized === 'lighter' || !normalized) return 400;
  return Math.max(1, Math.min(1000, Math.round(number(normalized, 400))));
}

function requestedItalic(value) {
  return /italic|oblique/i.test(String(value || ''));
}

function fontWeight(font) {
  return Number(font?.['OS/2']?.usWeightClass) || (/bold|black|heavy/i.test(String(font?.subfamilyName || '')) ? 700 : 400);
}

function fontItalic(font) {
  return Boolean(font?.['OS/2']?.fsSelection?.italic || /italic|oblique/i.test(String(font?.subfamilyName || '')));
}

function registerFont(registry, buffer, source) {
  try {
    const parsed = fontkit.create(buffer);
    const fonts = parsed?.fonts || [parsed];
    for (const font of fonts) {
      const names = new Set([
        font.familyName,
        font.fullName,
        font.postscriptName,
        String(font.postscriptName || '').replace(/[-_](?:regular|bold|italic|oblique|light|medium|semibold|black).*$/i, ''),
      ].map(normalizeFamily).filter(Boolean));
      const record = {
        font,
        source,
        names,
        weight: fontWeight(font),
        italic: fontItalic(font),
      };
      registry.all.push(record);
      for (const name of names) {
        if (!registry.byFamily.has(name)) registry.byFamily.set(name, []);
        registry.byFamily.get(name).push(record);
      }
    }
    return fonts.length;
  } catch {
    return 0;
  }
}

function decodeDataFontBuffers(svg) {
  const buffers = [];
  const seen = new Set();
  for (const match of String(svg).matchAll(FONT_DATA_PATTERN)) {
    try {
      const buffer = Buffer.from(match[1], 'base64');
      if (buffer.length < 256) continue;
      const digest = `${buffer.length}:${buffer.subarray(0, 32).toString('base64')}`;
      if (seen.has(digest)) continue;
      seen.add(digest);
      buffers.push(buffer);
    } catch {}
  }
  return buffers;
}

async function pageFontUrls(target) {
  try {
    return await target.executeJavaScript(`(() => {
      const urls = new Set();
      const add = (value, base = document.baseURI) => {
        if (!value || /^(?:data:|blob:)/i.test(value)) return;
        try { urls.add(new URL(value, base).href); } catch {}
      };
      for (const entry of performance.getEntriesByType('resource')) {
        if (/\\.(?:woff2?|ttf|otf|ttc)(?:[?#]|$)/i.test(entry.name) || /(?:font|typeface|glyph)/i.test(entry.name)) add(entry.name);
      }
      const inspectRules = (rules, base) => {
        for (const rule of Array.from(rules || [])) {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            for (const match of String(rule.cssText || '').matchAll(/url\\(\\s*['\"]?([^'\")]+)['\"]?\\s*\\)/gi)) add(match[1], base);
          }
          if (rule.cssRules) inspectRules(rule.cssRules, base);
        }
      };
      for (const sheet of Array.from(document.styleSheets || [])) {
        try { inspectRules(sheet.cssRules, sheet.href || document.baseURI); } catch {}
      }
      return Array.from(urls).slice(0, 120);
    })()`, true);
  } catch {
    return [];
  }
}

async function fetchFontBuffers(urls, targetSession) {
  const resources = [];
  await Promise.all(urls.map(async (url) => {
    try {
      const response = await Promise.race([
        targetSession.fetch(url, { referrerPolicy: 'no-referrer-when-downgrade' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Font timeout')), 12000)),
      ]);
      if (!response.ok) return;
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!FONT_URL_PATTERN.test(url) && !/(?:font|woff|truetype|opentype)/i.test(contentType)) return;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length >= 256 && buffer.length <= 30 * 1024 * 1024) resources.push({ buffer, source: url });
    } catch {}
  }));
  return resources;
}

async function localFontBuffers(appRoot) {
  const resources = [];
  const fontRoot = process.env.WINDIR ? path.join(process.env.WINDIR, 'Fonts') : 'C:\\Windows\\Fonts';
  const bundledRoot = path.join(appRoot, 'node_modules', '@fontsource', 'space-mono', 'files');
  for (const [root, files] of [[fontRoot, SYSTEM_FONT_FILES], [bundledRoot, BUNDLED_FONT_FILES]]) {
    for (const file of files) {
      const source = path.join(root, file);
      try {
        const buffer = await fs.readFile(source);
        resources.push({ buffer, source });
      } catch {}
    }
  }
  return resources;
}

async function createFontRegistry(svg, target, appRoot) {
  const registry = { all: [], byFamily: new Map() };
  const dataFonts = decodeDataFontBuffers(svg).map((buffer, index) => ({ buffer, source: `embedded-font-${index + 1}` }));
  const urls = target ? await pageFontUrls(target) : [];
  const [remoteFonts, localFonts] = await Promise.all([
    target ? fetchFontBuffers(urls, target.session) : Promise.resolve([]),
    localFontBuffers(appRoot),
  ]);
  const seen = new Set();
  for (const resource of [...dataFonts, ...remoteFonts, ...localFonts]) {
    const digest = `${resource.buffer.length}:${resource.buffer.subarray(0, 32).toString('base64')}`;
    if (seen.has(digest)) continue;
    seen.add(digest);
    registerFont(registry, resource.buffer, resource.source);
  }
  return registry;
}

function aliasFamilies(family) {
  if (family === '-apple-system' || family === 'blinkmacsystemfont' || family === 'system-ui' || family === 'sans-serif') return ['segoe ui', 'arial'];
  if (family === 'serif') return ['times new roman', 'georgia'];
  if (family === 'monospace') return ['consolas', 'courier new', 'space mono'];
  if (family === 'cursive') return ['segoe script'];
  if (family === 'fantasy') return ['arial'];
  return [family];
}

function chooseFont(registry, familyValue, weightValue, styleValue, text) {
  const weight = requestedWeight(weightValue);
  const italic = requestedItalic(styleValue);
  const requested = familyList(familyValue).flatMap(aliasFamilies);
  let candidates = [];
  for (const family of requested) {
    const matches = registry.byFamily.get(family);
    if (matches?.length) {
      candidates = matches;
      break;
    }
  }
  if (!candidates.length) candidates = registry.byFamily.get('segoe ui') || registry.byFamily.get('arial') || registry.all;
  const supports = (record) => Array.from(text).every((character) => /[\s\u200b-\u200d\ufe0e\ufe0f]/u.test(character) || record.font.hasGlyphForCodePoint(character.codePointAt(0)));
  const supported = candidates.filter(supports);
  const pool = supported.length ? supported : candidates;
  return pool.slice().sort((a, b) => {
    const aScore = Math.abs(a.weight - weight) + (a.italic === italic ? 0 : 350);
    const bScore = Math.abs(b.weight - weight) + (b.italic === italic ? 0 : 350);
    return aScore - bScore;
  })[0] || null;
}

function inheritedAttribute(node, name, fallback = '') {
  let current = node;
  while (current?.nodeType === 1) {
    if (current.hasAttribute(name)) return current.getAttribute(name);
    current = current.parentNode;
  }
  return fallback;
}

function copyOutlineAttributes(source, target) {
  for (const attribute of Array.from(source.attributes || [])) {
    if (!OUTLINE_SKIP_ATTRIBUTES.has(attribute.name)) target.setAttribute(attribute.name, attribute.value);
  }
}

function layoutTextRun(doc, node, parent, registry, fallbackIndex) {
  const text = String(node.textContent || '');
  if (!text) return { group: null, fallback: false };
  const family = inheritedAttribute(node, 'font-family', 'sans-serif');
  const weight = inheritedAttribute(node, 'font-weight', '400');
  const style = inheritedAttribute(node, 'font-style', 'normal');
  const record = chooseFont(registry, family, weight, style, text);
  if (!record) return { group: null, fallback: true };

  let font = record.font;
  if (font.variationAxes?.wght) {
    try { font = font.getVariation({ wght: requestedWeight(weight) }); } catch {}
  }
  const size = Math.max(0.01, number(inheritedAttribute(node, 'font-size', '16'), 16));
  const scaleY = size / Math.max(1, number(font.unitsPerEm, 1000));
  const letterSpacingPx = number(inheritedAttribute(node, 'letter-spacing', '0'), 0);
  const wordSpacingPx = number(inheritedAttribute(node, 'word-spacing', '0'), 0);
  const features = inheritedAttribute(node, 'font-variant', '').includes('none') ? [] : undefined;
  const run = font.layout(text, features);
  const glyphs = run.glyphs || [];
  const positions = run.positions || [];
  let advanceUnits = 0;
  for (let index = 0; index < glyphs.length; index += 1) {
    advanceUnits += number(positions[index]?.xAdvance, glyphs[index]?.advanceWidth || 0);
    if (index < glyphs.length - 1) advanceUnits += letterSpacingPx / scaleY;
    if (text[index] === ' ') advanceUnits += wordSpacingPx / scaleY;
  }
  if (!glyphs.length || advanceUnits <= 0) return { group: null, fallback: false };

  const targetLength = number(node.getAttribute('textLength') || parent.getAttribute('textLength'), 0);
  const naturalWidth = advanceUnits * scaleY;
  const scaleX = targetLength > 0 ? targetLength / advanceUnits : scaleY;
  let x = number(node.getAttribute('x') || parent.getAttribute('x'), 0) + number(node.getAttribute('dx') || parent.getAttribute('dx'), 0);
  const edgeY = number(node.getAttribute('y') || parent.getAttribute('y'), 0) + number(node.getAttribute('dy') || parent.getAttribute('dy'), 0);
  const baselineMode = inheritedAttribute(node, 'dominant-baseline', 'auto');
  let baselineY = edgeY;
  if (/text-after-edge|after-edge|bottom/i.test(baselineMode)) baselineY = edgeY + number(font.descent, 0) * scaleY;
  else if (/text-before-edge|before-edge|top|hanging/i.test(baselineMode)) baselineY = edgeY + number(font.ascent, 0) * scaleY;
  else if (/middle|central/i.test(baselineMode)) baselineY = edgeY + ((number(font.ascent, 0) + number(font.descent, 0)) / 2) * scaleY;
  const anchor = inheritedAttribute(node, 'text-anchor', 'start');
  const renderedWidth = targetLength > 0 ? targetLength : naturalWidth;
  if (anchor === 'middle') x -= renderedWidth / 2;
  else if (anchor === 'end') x -= renderedWidth;

  const group = doc.createElementNS(SVG_NS, 'g');
  group.setAttribute('data-rms-text-run', String(fallbackIndex));
  group.setAttribute('data-rms-font-source', path.basename(String(record.source || 'font')));
  group.setAttribute('transform', `translate(${x} ${baselineY}) scale(${scaleX} ${-scaleY})`);
  if (node !== parent) copyOutlineAttributes(node, group);
  let cursor = 0;
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    const position = positions[index] || {};
    const d = glyph.path?.toSVG?.();
    if (d) {
      const glyphPath = doc.createElementNS(SVG_NS, 'path');
      glyphPath.setAttribute('d', d);
      const offsetX = cursor + number(position.xOffset, 0);
      const offsetY = number(position.yOffset, 0);
      if (offsetX || offsetY) glyphPath.setAttribute('transform', `translate(${offsetX} ${offsetY})`);
      group.appendChild(glyphPath);
    }
    cursor += number(position.xAdvance, glyph.advanceWidth || 0);
    if (index < glyphs.length - 1) cursor += letterSpacingPx / scaleY;
    if (text[index] === ' ') cursor += wordSpacingPx / scaleY;
  }
  return { group, fallback: !familyList(family).flatMap(aliasFamilies).some((name) => record.names.has(name)) };
}

function stripFontFaceRules(svg) {
  return String(svg).replace(/@font-face\s*\{[^{}]*\}/gi, '');
}

async function outlineSvgText(svg, target, appRoot) {
  const source = String(svg || '');
  const parserErrors = [];
  const doc = new DOMParser({ onError: (level, message) => parserErrors.push(`${level}:${message}`) }).parseFromString(source, 'image/svg+xml');
  if (!doc?.documentElement || doc.documentElement.localName !== 'svg') throw new Error(`SVG text outline parser failed: ${parserErrors[0] || 'invalid document'}`);
  const textNodes = Array.from(doc.getElementsByTagName('text'));
  if (!textNodes.length) return { svg: source, outlinedTextNodes: 0, outlinedTextRuns: 0, fallbackRuns: 0, fontsLoaded: 0 };
  const registry = await createFontRegistry(source, target, appRoot);
  if (!registry.all.length) throw new Error('SVG text outlining could not load any usable font.');

  let outlinedTextNodes = 0;
  let outlinedTextRuns = 0;
  let fallbackRuns = 0;
  for (const textNode of textNodes) {
    const replacement = doc.createElementNS(SVG_NS, 'g');
    replacement.setAttribute('data-rms-text-outline', 'true');
    copyOutlineAttributes(textNode, replacement);
    const tspans = Array.from(textNode.childNodes || []).filter((child) => child.nodeType === 1 && child.localName === 'tspan');
    const runs = tspans.length ? tspans : [textNode];
    for (const runNode of runs) {
      const result = layoutTextRun(doc, runNode, textNode, registry, outlinedTextRuns + 1);
      if (!result.group) continue;
      replacement.appendChild(result.group);
      outlinedTextRuns += 1;
      if (result.fallback) fallbackRuns += 1;
    }
    textNode.parentNode.replaceChild(replacement, textNode);
    outlinedTextNodes += 1;
  }
  doc.documentElement.setAttribute('data-rms-text-outlined', 'true');
  doc.documentElement.setAttribute('data-rms-text-outline-runs', String(outlinedTextRuns));
  doc.documentElement.setAttribute('data-rms-text-outline-fallbacks', String(fallbackRuns));
  const serialized = new XMLSerializer().serializeToString(doc);
  return {
    svg: stripFontFaceRules(serialized),
    outlinedTextNodes,
    outlinedTextRuns,
    fallbackRuns,
    fontsLoaded: registry.all.length,
  };
}

module.exports = { outlineSvgText };
