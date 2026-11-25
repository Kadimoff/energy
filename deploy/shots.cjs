// Integration screenshots of every route: node shots.cjs BASE OUTDIR [widths]
const p = require('/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:5190';
const OUT = process.argv[3] || '/home/hermes/projects/smart-energy/shots/integration';
const WIDTHS = (process.argv[4] || '1440,390').split(',').map(Number);
const ROUTES = ['/', '/live', '/equipment', '/equipment/comp-2', '/decisions', '/anomalies', '/forecast', '/carbon', '/mv', '/reports', '/settings'];
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await p.launch({ executablePath: '/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome', args: ['--no-sandbox'], protocolTimeout: 120000 });
  const problems = [];
  for (const w of WIDTHS) {
    const pg = await b.newPage();
    await pg.setViewport({ width: w, height: w < 600 ? 844 : 900, isMobile: w < 600, deviceScaleFactor: w < 600 ? 2 : 1 });
    pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${w} console.${m.type()}: ${m.text().slice(0, 200)}`); });
    pg.on('pageerror', (e) => problems.push(`${w} pageerror: ${String(e).slice(0, 200)}`));
    pg.on('response', (r) => { if (r.status() >= 400) problems.push(`${w} HTTP ${r.status()} ${r.url()}`); });
    for (const r of ROUTES) {
      const t0 = Date.now();
      await pg.goto(BASE + r, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((res) => setTimeout(res, 2500));
      const info = await pg.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim(), sw: document.documentElement.scrollWidth, iw: innerWidth }));
      if (info.sw > info.iw + 1) problems.push(`${w} ${r} horizontal overflow ${info.sw}>${info.iw}`);
      const name = (r === '/' ? 'overview' : r.slice(1).replace(/\//g, '_')) + `-${w}.png`;
      await pg.screenshot({ path: `${OUT}/${name}`, fullPage: true });
      console.log(w, r, 'h1=', info.h1, `${Date.now() - t0}ms`);
    }
    await pg.close();
  }
  console.log('PROBLEMS', problems.length); problems.forEach((x) => console.log(' -', x));
  await b.close();
})();
