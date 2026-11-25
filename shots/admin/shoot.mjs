// Screenshot script for the admin area (reports + settings).
// usage: node shoot.mjs <baseUrl> <outDir> [only]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/home/hermes/.hermes/tools/shotkit/node_modules/');
const puppeteer = require('puppeteer-core');

const base = process.argv[2] ?? 'http://127.0.0.1:5185';
const out = process.argv[3] ?? '.';
const only = process.argv[4] ?? '';
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const logs = [];
async function page(width, height = 900) {
  const p = await browser.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: 1 });
  p.on('console', (m) => {
    if (['error', 'warning', 'warn'].includes(m.type())) logs.push(`[${width}] ${m.type()}: ${m.text()}`);
  });
  p.on('pageerror', (e) => logs.push(`[${width}] pageerror: ${e.message}`));
  return p;
}
/** Full-page capture by growing the viewport (fullPage capture re-lays out transformed content). */
async function fullShot(p, path) {
  const vp = p.viewport();
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.setViewport({ ...vp, height: h });
  await new Promise((r) => setTimeout(r, 700));
  const h2 = await p.evaluate(() => document.documentElement.scrollHeight);
  if (h2 !== h) {
    await p.setViewport({ ...vp, height: h2 });
    await new Promise((r) => setTimeout(r, 500));
  }
  await p.screenshot({ path });
  await p.setViewport(vp);
}
async function ready(p, text) {
  await p.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 60000 }, text);
  await new Promise((r) => setTimeout(r, 900));
}

const shots = [
  { name: 'reports', url: '/reports', wait: 'Ən çox israf edən 3 avadanlıq' },
  { name: 'settings-tariffs', url: '/settings?section=tariffs', wait: 'Bu ayın hesablamalarına təsir' },
];
for (const s of shots) {
  if (only && !s.name.startsWith(only)) continue;
  for (const w of [1440, 1024, 390]) {
    const p = await page(w, w === 390 ? 844 : 900);
    await p.goto(base + s.url, { waitUntil: 'networkidle0' });
    await ready(p, s.wait);
    await fullShot(p, `${out}/${s.name}-${w}.png`);
    await p.close();
  }
}

if (!only || only === 'extra') {
  // other settings sections at 1440
  for (const sec of ['plant', 'budget', 'emissions', 'targets', 'alerts', 'sources', 'users']) {
    const p = await page(1440);
    await p.goto(`${base}/settings?section=${sec}`, { waitUntil: 'networkidle0' });
    await ready(p, 'Parametr');
    await new Promise((r) => setTimeout(r, 600));
    await fullShot(p, `${out}/settings-${sec}-1440.png`);
    await p.close();
  }
  // settings sections at 390 (alerts, users)
  for (const sec of ['alerts', 'users', 'plant']) {
    const p = await page(390, 844);
    await p.goto(`${base}/settings?section=${sec}`, { waitUntil: 'networkidle0' });
    await ready(p, 'Parametr');
    await new Promise((r) => setTimeout(r, 600));
    await fullShot(p, `${out}/settings-${sec}-390.png`);
    await p.close();
  }
  // propagation demo: change tariff, capture impact before/after
  {
    const p = await page(1440);
    await p.goto(`${base}/settings?section=tariffs`, { waitUntil: 'networkidle0' });
    await ready(p, 'Bu ayın hesablamalarına təsir');
    const before = await p.$eval('[data-testid="impact-elec"]', (e) => e.textContent);
    const input = await p.$('input[inputmode="decimal"]');
    await input.click({ clickCount: 3 });
    await input.type('0,15');
    await new Promise((r) => setTimeout(r, 400));
    const after = await p.$eval('[data-testid="impact-elec"]', (e) => e.textContent);
    logs.push(`propagation: impact-elec ${before} -> ${after}`);
    await p.screenshot({ path: `${out}/settings-tariff-changed-1440.png`, fullPage: false });
    // report reflects the changed tariff
    await p.goto(`${base}/reports`, { waitUntil: 'networkidle0' });
    await ready(p, 'Ən çox israf edən 3 avadanlıq');
    const footer = await p.$eval('.report-preview .report-page footer', (e) => e.textContent);
    logs.push(`report footer after change: ${footer}`);
    // reset
    await p.evaluate(() => localStorage.removeItem('sie:settings'));
    await p.close();
  }
  // all four templates: overflow check in the preview, print emulation screenshots and PDFs
}
if (!only || only === 'extra' || only === 'measure') {
  for (const tpl of ['director', 'energy_manager', 'carbon', 'iso50001']) {
    const p = await page(1440, 1400);
    await p.goto(`${base}/reports?t=${tpl}`, { waitUntil: 'networkidle0' });
    await ready(p, 'A4 önizləmə');
    await p.waitForSelector('.report-preview .report-page');
    await new Promise((r) => setTimeout(r, 800));
    const over = await p.$$eval('.report-preview .report-page', (els) =>
      els.map((e) => ({ scroll: e.scrollHeight, client: e.clientHeight })),
    );
    logs.push(`${tpl} pages: ${JSON.stringify(over)}`);
    if (tpl === 'director') {
      const el = await p.$('.report-preview');
      await el.screenshot({ path: `${out}/report-a4-preview-director.png` });
    }
    await p.emulateMediaType('print');
    const n = await p.$$eval('.report-print-host .report-page', (els) => els.length);
    await p.setViewport({ width: 794, height: 1123 * n });
    await new Promise((r) => setTimeout(r, 300));
    await p.screenshot({ path: `${out}/report-print-${tpl}.png`, fullPage: true });
    const pdfPath = tpl === 'director' ? `${out}/report.pdf` : `${out}/report-${tpl}.pdf`;
    await p.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pdf = fs.readFileSync(pdfPath, 'latin1');
    logs.push(`${tpl} pdf pages: ${(pdf.match(/\/Type\s*\/Page[^s]/g) || []).length}`);
    await p.close();
  }
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n') + '\n');
console.log(logs.join('\n'));
await browser.close();
