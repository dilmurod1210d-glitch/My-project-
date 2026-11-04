const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const tl = JSON.parse(fs.readFileSync('build/timeline.json'));
  const preview = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve('scene.html'));
  await p.evaluate(t => window.init(t), tl);
  await p.waitForTimeout(300);
  const times = preview || Array.from({ length: tl.fps * tl.duration }, (_, i) => i / tl.fps);
  fs.mkdirSync('build/frames', { recursive: true });
  for (let i = 0; i < times.length; i++) {
    await p.evaluate(t => window.render(t), times[i]);
    const out = preview ? `build/prev_${times[i]}.jpg` : `build/frames/f${String(i).padStart(4, '0')}.jpg`;
    await p.screenshot({ path: out, type: 'jpeg', quality: 92 });
    if (!preview && i % 150 === 0) console.log('frame', i);
  }
  await b.close();
})();
