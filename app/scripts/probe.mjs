// Debug helper: node scripts/probe.mjs <url> <js-expression>
import puppeteer from '/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const [url, expr] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: '/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', (m) => console.log('console', m.type(), m.text()));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.setViewport({ width: Number(process.env.W || 1440), height: 900 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
