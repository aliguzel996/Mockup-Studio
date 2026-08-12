import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const read = (relative) => fs.readFileSync(path.join(dist, relative), 'utf8');

const required = [
  '.htaccess',
  'index.html',
  'assets',
  'icon.svg',
  'og-image.png',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'llms.txt',
];
for (const entry of required) assert.ok(fs.existsSync(path.join(dist, entry)), `Missing cPanel entry: ${entry}`);

const index = read('index.html');
assert.match(index, /src="\.\/assets\/[^"/]+\.js"/);
assert.match(index, /href="\.\/assets\/[^"/]+\.css"/);
assert.match(index, /href="\.\/icon\.svg"/);
assert.match(index, /href="\.\/site\.webmanifest"/);
assert.match(index, /href="\.\/llms\.txt"/);
assert.match(index, /rel="canonical" href="https:\/\/ycswu\.co\/mockup-studio\/"/);
assert.match(index, /property="og:image" content="https:\/\/ycswu\.co\/mockup-studio\/og-image\.png"/);

const jsonLdSource = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
assert.ok(jsonLdSource, 'SoftwareApplication JSON-LD is missing');
const jsonLd = JSON.parse(jsonLdSource);
assert.deepEqual(jsonLd['@type'], ['SoftwareApplication', 'WebApplication']);
assert.equal(jsonLd.url, 'https://ycswu.co/mockup-studio/');
assert.equal(jsonLd.softwareVersion, '1.2.4');
assert.ok(jsonLd.featureList.length >= 8);

assert.match(read('robots.txt'), /Sitemap: https:\/\/ycswu\.co\/mockup-studio\/sitemap\.xml/);
assert.match(read('sitemap.xml'), /<loc>https:\/\/ycswu\.co\/mockup-studio\/<\/loc>/);
assert.match(read('llms.txt'), /## Core capabilities/);
assert.match(read('.htaccess'), /RewriteBase \/mockup-studio\//);
assert.match(read('.htaccess'), /RewriteRule \^ index\.html \[L\]/);
assert.equal(JSON.parse(read('site.webmanifest')).start_url, './');
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'app.manifest.json'), 'utf8')).version, '1.2.4');

process.stdout.write(`cPanel/SEO build validated: ${required.length} required root entries, relative assets, JSON-LD, Open Graph, sitemap, robots and llms.txt\n`);
