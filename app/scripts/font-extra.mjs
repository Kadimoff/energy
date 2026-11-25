import puppeteer from '/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const browser = await puppeteer.launch({
  executablePath: '/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.goto('file://' + here + 'font-test.html?s=' + encodeURIComponent('·₂³°±≈→₼%€'));
console.log(JSON.stringify(await page.evaluate(() => window.runTest())));
await browser.close();
