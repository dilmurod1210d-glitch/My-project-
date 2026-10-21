// node render.mjs stills 40 86 150 230      -> stills/fNNN.png
// node render.mjs film <outDir>              -> 720 PNGs at 59.94 fps (half frames)
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const here = path.dirname(new URL(import.meta.url).pathname);
const [mode, ...args] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
page.on('pageerror', e => { console.error('page error:', e.message); process.exit(1); });
await page.goto('file://' + path.join(here, 'index.html'));
await page.evaluate(() => window.ready);
const stage = await page.$('#stage');
async function shot(f, file) {
  await page.evaluate(fr => window.seek(fr), f);
  await stage.screenshot({ path: file });
}
if (mode === 'stills') {
  fs.mkdirSync(path.join(here, 'stills'), { recursive: true });
  for (const a of args) await shot(parseFloat(a), path.join(here, 'stills', `f${String(a).padStart(3, '0')}.png`));
} else if (mode === 'film') {
  const out = args[0]; fs.mkdirSync(out, { recursive: true });
  for (let i = 0; i < 720; i++) {
    await shot(i / 2, path.join(out, `${String(i).padStart(4, '0')}.png`));
    if (i % 60 === 0) console.log('frame', i);
  }
}
await browser.close();
