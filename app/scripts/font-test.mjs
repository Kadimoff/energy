import puppeteer from '/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const browser = await puppeteer.launch({
  executablePath: '/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome',
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 420 });
await page.goto('file://' + here + 'font-test.html');
const res = await page.evaluate(() => window.runTest());
// CDP platform fonts per sample node
const cdp = await page.createCDPSession();
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.s' });
for (const id of nodeIds) {
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id });
  const attrs = (await cdp.send('DOM.getAttributes', { nodeId: id })).attributes;
  const f = attrs[attrs.indexOf('data-font') + 1];
  res[f].platformFonts = fonts.map(
    (x) => `${x.familyName}${x.isCustomFont ? '' : ' (system)'}:${x.glyphCount}`,
  );
}
console.log(JSON.stringify(res, null, 1));
await page.screenshot({ path: here + '../../shots/foundation/font-test.png' });
await browser.close();
