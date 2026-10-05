import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
await p.goto('http://localhost:8940/tools/asset-gallery.html'); await p.waitForTimeout(1500);
const data = await p.evaluate(() => [...document.querySelectorAll('.tile')].map((f, i) => ({ ...window.__galleryTiles[+f.dataset.i], img: f.querySelector('canvas').toDataURL('image/webp', 0.82) })));
writeFileSync('gallery-data.json', JSON.stringify(data));
console.log(data.length, Math.round(JSON.stringify(data).length / 1024) + 'KB', data.filter(d => d.status === 'code').length + ' in use');
await b.close();
