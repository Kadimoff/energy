// Screenshot helper: node scripts/shots.mjs <baseUrl> <outDir> <path>[,<path>...] [widths]
import puppeteer from '/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { mkdirSync } from 'node:fs';

const [
  base = 'http://127.0.0.1:5177',
  out = '../shots/foundation',
  pathsArg = '/',
  widthsArg = '1440,1024,390',
] = process.argv.slice(2);
const paths = pathsArg.split(',');
const widths = widthsArg.split(',').map(Number);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const logs = [];
for (const w of widths) {
  for (const p of paths) {
    const page = await browser.newPage();
    page.on('console', (m) => {
      if (['error', 'warning', 'warn'].includes(m.type()))
        logs.push(`[${w} ${p}] ${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => logs.push(`[${w} ${p}] pageerror: ${e.message}`));
    await page.setViewport({ width: w, height: w < 600 ? 844 : 900, deviceScaleFactor: 1 });
    const t0 = Date.now();
    await page.goto(base + p, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const timing = await page.evaluate(() => document.title);
    const name = `${p === '/' ? 'home' : p.replace(/\//g, '_').replace(/^_/, '')}-${w}.png`;
    // grow the viewport to the full page height first (fullPage capture resizes mid-shot and
    // ResizeObserver based charts re-measure to 0 during the capture)
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({
      width: w,
      height: Math.max(h, w < 600 ? 844 : 900),
      deviceScaleFactor: 1,
    });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: `${out}/${name}` });
    console.log('shot', name, `${Date.now() - t0}ms`, timing);
    await page.close();
  }
}
console.log(logs.length ? logs.join('\n') : 'no console errors/warnings');
await browser.close();
