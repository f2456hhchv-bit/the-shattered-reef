// Game review captures: true-scale enemy lineups, every biome's arena with
// its roster and boss, Reef Defence maps, landscape. node capture-game.mjs <outdir> [parts]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'shots-game'; mkdirSync(OUT, { recursive: true });
const PARTS = (process.argv[3] || 'lineup,arena,td,land').split(',');
const BASE = 'http://localhost:8940';
const man = []; const errs = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const META = { salvage: 900, highestStageUnlocked: 10, levelsCleared: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5, 10: 4 }, tutorialDone: true, stats: { runsPlayed: 40, bestReefsCleared: 50, deepestReefReached: 50, totalSalvageEarned: 9000 }, tdStars: { } };
async function page(w = 390, h = 844) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await ctx.addInitScript((m) => { try { localStorage.setItem('shatteredReef.meta.v1', JSON.stringify(m)); localStorage.setItem('shatteredReef.muted.v1', '1'); localStorage.setItem('shatteredReef.dev.v1', JSON.stringify({ godMode: true, enemyCount: 0.05 })); } catch { /* */ } }, META);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('CON ' + m.text()); });
  return p;
}
const W = (p, ms) => p.waitForTimeout(ms);

if (PARTS.includes('lineup')) {
  // Every stage's roster, horde and boss next to the player's sloop, at the
  // game's own scale (1 world px = 1 CSS px), on toy water.
  const p = await page(1200, 900);
  await p.goto(BASE + '/tools/asset-gallery.html'); await W(p, 300);
  await p.evaluate(async () => {
    document.body.innerHTML = ''; document.body.style.background = '#2e8fb5';
    const [{ STAGES }, { ENEMIES }, { HORDE_FOR_BIOME }, { createEnemy }, R, CS, SS] = await Promise.all([
      import('/src/data/stages.mjs'), import('/src/data/enemies.mjs'), import('/src/data/survival.mjs'),
      import('/src/engine/enemies.mjs'), import('/src/engine/renderer.mjs'), import('/src/engine/creatureSprites.mjs'), import('/src/engine/shipSprites.mjs')]);
    CS.loadCreatureSprites('/assets/creatures/'); SS.loadShipSprites('/assets/ships/');
    await new Promise((r) => setTimeout(r, 2500));
    const COLW = 92; const ROWH = 120;
    const cv = document.createElement('canvas'); const dpr = 2;
    const cols = 12; cv.width = COLW * cols * dpr; cv.height = ROWH * 10 * dpr; cv.style.width = `${COLW * cols}px`;
    document.body.appendChild(cv); const x = cv.getContext('2d'); x.scale(dpr, dpr);
    x.font = '10px system-ui'; x.textAlign = 'center';
    let id = 1;
    STAGES.slice(0, 10).forEach((st, row) => {
      const y0 = row * ROWH;
      x.fillStyle = row % 2 ? '#2a86ab' : '#3194ba'; x.fillRect(0, y0, COLW * cols, ROWH);
      const ids = [...new Set(st.pools.flat())];
      const horde = HORDE_FOR_BIOME[st.biome];
      const list = [horde, ...ids, st.boss];
      // player sloop first
      R.drawBoat(x, { x: COLW / 2, y: y0 + 52, heading: -Math.PI / 2, vx: 0, vy: -40, style: 'sloop', health: 100, maxHull: 100 }, 11, 1.3);
      x.fillStyle = '#fff'; x.fillText('player sloop', COLW / 2, y0 + ROWH - 8);
      list.forEach((eid, k) => {
        const def = ENEMIES[eid]; if (!def) return;
        let e; try { e = createEnemy(eid, 0, 0, () => 0.5); } catch { return; }
        const cx = COLW * (k + 1) + COLW / 2; const cy = y0 + 52;
        Object.assign(e, { x: cx, y: cy, id: id++, heading: -Math.PI / 2, vx: 0, vy: -30, health: e.maxHealth || 50, hitFlash: 0, aggro: true, hunting: true, invulnerable: false, submergedState: 'surfaced', phased: false, camo: false, burrowed: false });
        R.drawEnemy(x, e, def.color || '#888', 1.3);
        x.fillStyle = '#fff'; x.fillText((def.name || eid).slice(0, 18), cx, y0 + ROWH - 8);
      });
      x.fillStyle = 'rgba(255,255,255,.8)'; x.textAlign = 'left'; x.fillText(`Stage ${row + 1}`, 4, y0 + 12); x.textAlign = 'center';
    });
    window.__done = true;
  });
  await p.locator('canvas').screenshot({ path: `${OUT}/lineup.png` });
  man.push({ file: 'lineup', kind: 'review' });
  await p.context().close();
}

if (PARTS.includes('arena')) {
  const p = await page();
  await p.goto(BASE + '/index.html'); await W(p, 4000);
  const plan = await p.evaluate(async () => {
    const [{ STAGES }, { HORDE_FOR_BIOME }, { BIOMES }] = await Promise.all([import('/src/data/stages.mjs'), import('/src/data/survival.mjs'), import('/src/data/biomes.mjs')]);
    return STAGES.slice(0, 10).map((st) => ({ biome: st.biome, name: BIOMES[st.biome].name, ids: [HORDE_FOR_BIOME[st.biome], ...new Set(st.pools.flat())], boss: st.boss }));
  });
  for (let s = 1; s <= 10; s++) {
    const pl = plan[s - 1];
    await p.evaluate((st) => window.__shatteredReefSailStage(st, 0), s); await W(p, 1500);
    // Terrain: next to the nearest sea island, so land, shore, props and sea show.
    await p.evaluate(() => {
      const d = window.__shatteredReefDebug();
      const bx = d.boat?.x ?? d.boatX; const by = d.boat?.y ?? d.boatY;
      const pool = [...(d.props || []), ...(d.seaIslands || [])];
      pool.sort((a, b) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(b.x - bx, b.y - by));
      const t = pool[0]; if (t) window.__shatteredReefWarp(t.x + 90, t.y + 70);
    });
    await W(p, 2600);
    await p.screenshot({ path: `${OUT}/terrain-${s}.png`, clip: { x: 0, y: 227, width: 390, height: 390 } });
    man.push({ cat: 'Terrain in play (arena view)', stage: s, file: `terrain-${s}`, kind: 'sq' });
    // Roster in a ring round the ship.
    await p.evaluate((ids) => {
      const d = window.__shatteredReefDebug(); const bx = d.boat?.x ?? d.boatX; const by = d.boat?.y ?? d.boatY;
      ids.forEach((id, k) => { const a = (k / ids.length) * Math.PI * 2; window.__shatteredReefSpawnEnemy(id, bx + Math.cos(a) * 120, by + Math.sin(a) * 120); });
    }, pl.ids);
    await W(p, 220);
    await p.screenshot({ path: `${OUT}/roster-${s}.png` }); man.push({ file: `roster-${s}`, kind: 'review' });
    await p.evaluate((id) => {
      const d = window.__shatteredReefDebug(); const bx = d.boat?.x ?? d.boatX; const by = d.boat?.y ?? d.boatY;
      window.__shatteredReefSpawnEnemy(id, bx, by - 150);
    }, pl.boss);
    await W(p, 450);
    await p.screenshot({ path: `${OUT}/boss-${s}.png` }); man.push({ file: `boss-${s}`, kind: 'review' });
  }
  await p.context().close();
}

if (PARTS.includes('td')) {
  const p = await page();
  const ids = await (async () => { await p.goto(BASE + '/index.html'); await W(p, 3000); return p.evaluate(async () => (await import('/src/data/tdMaps.mjs')).TD_MAPS.map((m) => m.id)); })();
  for (const [i, id] of ids.entries()) {
    if (i) { await p.goto(BASE + '/index.html'); await W(p, 3000); }
    await p.evaluate((m) => window.__shatteredReefTd.start(m), id); await W(p, 3000);
    await p.screenshot({ path: `${OUT}/td-${i + 1}.png` }); man.push({ file: `td-${i + 1}`, kind: 'review' });
  }
  await p.context().close();
}

if (PARTS.includes('land')) {
  const p = await page(844, 390);
  await p.goto(BASE + '/index.html'); await W(p, 4500);
  await p.screenshot({ path: `${OUT}/land-harbour.png` });
  await p.evaluate(() => window.__shatteredReefSailStage(5, 0)); await W(p, 3000);
  await p.evaluate(() => window.__shatteredReefSv.toWave(4)); await W(p, 6000);
  await p.screenshot({ path: `${OUT}/land-play.png` });
  await p.context().close();
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(man, null, 1));
console.log(man.length, 'captures'); console.log(errs.slice(0, 30).join('\n') || 'no errors');
await b.close();
