// Every weather kind once, in the first biome that has it (35), as square crops.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'shots-weather'; mkdirSync(OUT, { recursive: true });
const man = []; const errs = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { localStorage.setItem('shatteredReef.meta.v1', JSON.stringify({ highestStageUnlocked: 10, tutorialDone: true, stats: { runsPlayed: 9 } })); localStorage.setItem('shatteredReef.muted.v1', '1'); localStorage.setItem('shatteredReef.dev.v1', JSON.stringify({ godMode: true, enemyCount: 0.05 })); });
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push('PAGE ' + e.message));
await p.goto('http://localhost:8940/index.html'); await p.waitForTimeout(3500);
const plan = await p.evaluate(async () => {
  const [{ STAGES }, { BIOMES }, { WEATHER, BIOME_WEATHER }] = await Promise.all([import('/src/data/stages.mjs'), import('/src/data/biomes.mjs'), import('/src/data/weather.mjs')]);
  const seen = new Set(); const out = [];
  STAGES.slice(0, 10).forEach((st, i) => { for (const id of Object.keys(BIOME_WEATHER[st.biome] || {})) if (!seen.has(id)) { seen.add(id); out.push({ stage: i + 1, id, name: `${WEATHER[id].name} · ${BIOMES[st.biome].name}` }); } });
  return out;
});
let cur = 0;
for (const it of plan) {
  if (it.stage !== cur) { await p.evaluate((s) => window.__shatteredReefSailStage(s, 0), it.stage); cur = it.stage; await p.waitForTimeout(2200); }
  const ok = await p.evaluate((id) => window.__shatteredReefWeather(id), it.id);
  if (!ok) errs.push('weather did not start: ' + it.id);
  await p.waitForTimeout(400);
  await p.evaluate(() => { const d = window.__shatteredReefDebug(); const w = d.weather?.whirl; if (w) window.__shatteredReefWarp(w.x + 120, w.y + 90); });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/w-${it.id}.png`, clip: { x: 0, y: 227, width: 390, height: 390 } });
  man.push({ cat: 'Weather effects (in play)', name: it.name, file: `w-${it.id}`, kind: 'sq' });
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(man, null, 1));
console.log(man.length, 'captures'); console.log(errs.join('\n') || 'no errors');
await b.close();
