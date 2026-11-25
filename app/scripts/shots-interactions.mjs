// Interaction screenshots: copilot sheet, mobile "more" sheet, range menu.
// node scripts/shots-interactions.mjs <baseUrl> <outDir>
import puppeteer from '/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const [base = 'http://127.0.0.1:5177', out = '../shots/foundation'] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: '/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const errors = [];
async function open(w, h, path) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
  await page.setViewport({ width: w, height: h });
  await page.goto(base + path, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  return page;
}
let page = await open(1440, 900, '/decisions');
await page.keyboard.down('Control');
await page.keyboard.press('k');
await page.keyboard.up('Control');
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${out}/copilot-open-1440.png` });
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 400));
await page.click('button[aria-label^="Dövr"]');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${out}/range-menu-1440.png` });
await page.keyboard.press('Escape');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await new Promise((r) => setTimeout(r, 200));
await page.screenshot({
  path: `${out}/focus-ring-1440.png`,
  clip: { x: 0, y: 0, width: 600, height: 300 },
});
await page.close();

page = await open(390, 844, '/anomalies');
await page.click('nav[aria-label] button[aria-haspopup="dialog"]');
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${out}/mobile-more-390.png` });
await page.close();
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
