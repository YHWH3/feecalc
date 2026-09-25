// Minimal Lighthouse audit against the production build.
// Usage: pnpm build && node scripts/lighthouse.mjs
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const PORT = 4899;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? '/index.html' : (req.url?.split('?')[0] ?? '/');
    let file = join(DIST, path);
    let body;
    try {
      body = await readFile(file);
    } catch {
      body = await readFile(join(DIST, path, 'index.html'));
      file = join(path, 'index.html');
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));
const chrome = await launch({ chromeFlags: ['--headless'] });

const result = await lighthouse(`http://localhost:${PORT}/`, {
  port: chrome.port,
  output: 'json',
  onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  formFactor: 'mobile',
  screenEmulation: { mobile: true },
});

const { categories, audits } = result.lhr;
const score = (c) => Math.round((c?.score ?? 0) * 100);
console.log(
  `performance=${score(categories.performance)} accessibility=${score(categories.accessibility)} ` +
    `best-practices=${score(categories['best-practices'])} seo=${score(categories.seo)}`,
);
console.log(
  `LCP=${audits['largest-contentful-paint'].displayValue} TBT=${audits['total-blocking-time'].displayValue} CLS=${audits['cumulative-layout-shift'].displayValue}`,
);

chrome.kill();
server.close();

const fail = Object.values(categories).some((c) => (c?.score ?? 0) < 0.95);
process.exit(fail ? 1 : 0);
