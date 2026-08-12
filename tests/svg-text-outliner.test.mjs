import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { outlineSvgText } = require('../electron/svg-text-outliner.cjs');
const root = path.resolve(import.meta.dirname, '..');

test('SVG export converts live text into font-independent vector paths', async () => {
  const source = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="420" height="120" viewBox="0 0 420 120"><rect width="420" height="120" fill="#fff"/><text font-family="Space Mono, monospace" font-size="32px" font-weight="700" dominant-baseline="text-after-edge" fill="#111"><tspan x="20" y="76" textLength="287" lengthAdjust="spacingAndGlyphs">YCSWU VECTOR</tspan></text></svg>`;
  const result = await outlineSvgText(source, null, root);
  assert.equal(result.outlinedTextNodes, 1);
  assert.equal(result.outlinedTextRuns, 1);
  assert.match(result.svg, /data-rms-text-outlined="true"/);
  assert.match(result.svg, /data-rms-text-outline="true"/);
  assert.match(result.svg, /<path\b[^>]*\bd="M/);
  assert.doesNotMatch(result.svg, /<text\b/i);
  assert.doesNotMatch(result.svg, /font-family=/i);
  const rendered = await sharp(Buffer.from(result.svg)).png().toBuffer();
  const stats = await sharp(rendered).stats();
  assert.ok(stats.channels.some((channel) => channel.min < 40), 'outlined text should render as dark vector geometry');
});
