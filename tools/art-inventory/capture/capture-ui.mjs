// UI captures for the art inventory (UI · * items), portrait phone.
// Needs the repo served on :8940. usage: node capture-ui.mjs <outdir>
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'shots-ui'; mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8940/index.html';
const man = []; const errs = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const META = {
  salvage: 1850, krakenScales: 1, highestStageUnlocked: 3, levelsCleared: { 1: 5, 2: 5, 3: 2 },
  ownedHulls: ['sloop', 'longboat'], selectedHull: 'longboat', tutorialDone: true,
  stats: { runsPlayed: 14, bestReefsCleared: 12, deepestReefReached: 13, totalSalvageEarned: 5200 },
  bestiary: { pirate_cutter: 40, pirate_brig: 12, fire_ship: 8, mortar_boat: 6, reef_shark: 20, gullswarm_harpy: 15, raider_longboat: 300, skimmer_raider: 200, frost_narwhal: 9, ice_skiff: 80 },
};
await ctx.addInitScript((m) => { try { localStorage.setItem('shatteredReef.meta.v1', JSON.stringify(m)); localStorage.setItem('shatteredReef.muted.v1', '1'); } catch { /* */ } }, META);
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push('PAGE ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('CON ' + m.text()); });
const wait = (ms) => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
async function shot(cat, name, file) { await p.screenshot({ path: `${OUT}/${file}.png` }); man.push({ cat, name, file, kind: 'screen' }); }
async function el(cat, name, file, sel) {
  try { await p.locator(sel).first().screenshot({ path: `${OUT}/${file}.png`, timeout: 4000 }); man.push({ cat, name, file, kind: 'el' }); }
  catch (e) { errs.push(`EL ${name} (${sel}): ${e.message.split('\n')[0]}`); }
}
const click = (sel) => ev((s) => { const n = document.querySelector(s); if (n) n.click(); return !!n; }, sel);

// Opening scene.
await p.goto(URL + '?intro'); await wait(2200); await shot('UI · Screens', 'Opening scene (early)', 'intro-a');
await wait(2600); await shot('UI · Screens', 'Opening scene with title', 'intro-b');
await wait(2600); await shot('UI · Screens', 'Opening scene (late)', 'intro-c');

// Harbour.
await p.goto(URL); await wait(4500);
await shot('UI · Screens', 'Harbour (main screen)', 'harbour');
const H = 'UI · Harbour HUD';
await el(H, 'Top bar', 'h-topbar', '#base-topbar');
await el(H, 'Captain chip', 'h-captain', '#captain-chip');
await el(H, 'Currency pills', 'h-pills', '#base-topbar .currency-pills');
await el(H, 'Daily chip', 'h-daily', '#daily-chip');
await el(H, 'Contracts chip', 'h-contracts', '#contracts-chip');
await el(H, 'Sound button', 'h-mute', '#mute-button');
await el(H, 'Building label chip (with alert badge)', 'h-chip', '.base-chip:has(.bc-badge:not([hidden]))');
const V = 'UI · Voyage card';
await el(V, 'Voyage card', 'v-card', '#voyage-card');
await el(V, 'Voyage Chart button', 'v-chart', '#open-chart');
await el(V, 'Stage picker', 'v-picker', '#hub-stage-picker');
await el(V, 'Level pips', 'v-pips', '#vc-pips');
await el(V, 'Set Sail button', 'v-sail', '#hub-set-sail');
await el(V, 'Defend the Reef button', 'v-defend', '#vc-defend');

// Building panels.
const P = 'UI · Building panels';
const panels = [['hulls', 'Shipyard panel'], ['towers', 'Tower Yard panel'], ['charms', 'Charm Shrine panel'], ['cargo', 'Armory panel'], ['workshop', 'Workshop panel'], ['factions', 'Faction Hall panel']];
for (const [id, name] of panels) {
  await click(`#base-chips [data-panel="${id}"]`); await wait(500);
  await shot(P, name, 'p-' + id);
  if (id === 'hulls') {
    const Q = 'UI · Panel parts';
    await el(Q, 'Panel header + back button', 'pp-head', '#base-panel .bp-head');
    await el(Q, 'Shop row', 'pp-row', '#hub-hulls .hub-item');
    await el(Q, 'Buy button', 'pp-buy', '#base-panel button.hub-item-btn:not([disabled]):not(.selected)');
    await el(Q, 'Selected button', 'pp-selected', '#base-panel button.hub-item-btn.selected, #base-panel button.hub-item-btn[disabled]');
  }
  await click('#base-panel-back'); await wait(300);
}
await click('#captain-chip'); await wait(600); await shot(P, "Captain's Log panel", 'p-log');
await el('UI · Panel parts', 'Log tabs', 'pp-tabs', '#base-panel .log-tabs');
await click('#base-panel .log-tabs [data-tab="achievements"]'); await wait(300); await shot('Review', 'Log: achievements', 'r-achievements');
await click('#base-panel .log-tabs [data-tab="bestiary"]'); await wait(800); await shot('Review', 'Log: bestiary', 'r-bestiary');
await click('#base-panel-back'); await wait(300);
await click('#daily-chip'); await wait(500); await shot(P, 'Daily voyage panel', 'p-daily'); await click('#base-panel-back'); await wait(300);
await click('#contracts-chip'); await wait(500); await shot(P, 'Contracts panel', 'p-contracts'); await click('#base-panel-back'); await wait(300);

// Voyage chart.
await click('#open-chart'); await wait(2500);
await shot('UI · Screens', 'Voyage chart', 'chart');
await el('UI · Chart parts', 'Chart island label', 'c-node', '.wm-node.current');
await click('.wm-node.current'); await wait(900);
await el('UI · Chart parts', 'Stage sheet', 'c-sheet', '.wm-sheet-card');
await click('.wm-sheet-close'); await wait(300); await click('.wm-back'); await wait(600);

// Reef Defence.
await click('#vc-defend'); await wait(1800);
await shot('UI · Screens', 'Reef Defence chart', 'td-chart');
const mapId = await ev(async () => (await import('/src/data/tdMaps.mjs')).TD_MAPS[0].id);
await ev((id) => window.__shatteredReefTd.start(id), mapId); await wait(2500);
await ev(async () => {
  const td = await import('/src/engine/td.mjs');
  const s = window.__shatteredReefTd.state(); s.gold = 5000;
  const ids = ['cannon', 'grapeshot', 'cannon', 'grapeshot', 'cannon', 'grapeshot'];
  s.map.spots.slice(0, 6).forEach((sp, i) => td.buildTower(s, sp.id, ids[i]));
  s.gold = 260;
});
await click('#td-call'); await wait(6000);
await shot('UI · Screens', 'Reef Defence in play', 'td-play');
const R = 'UI · Reef Defence UI';
await el(R, 'Top bar', 'td-top', '#td-top');
await el(R, 'Bottom bar', 'td-bottom', '#td-bottom');
await el(R, 'Incoming wave strip', 'td-incoming', '#td-incoming');

// In play.
await p.goto(URL); await wait(4000);
await ev(() => window.__shatteredReefSailStage(1, 0)); await wait(3500);
await p.mouse.move(195, 640); await p.mouse.down(); await p.mouse.move(225, 610, { steps: 4 }); await wait(400);
await shot('UI · Screens', 'In-play HUD (with joystick)', 'play');
await el('UI · In-play HUD', 'Virtual joystick', 'i-joy', '.joystick-base');
await p.mouse.up();
const I = 'UI · In-play HUD';
await el(I, 'Top bar (place, timer, Salvage)', 'i-top', '#sv-top');
await el(I, 'XP bar + ship level', 'i-xp', '#sv-xp');
await el(I, 'Wave pips', 'i-waves', '#sv-waves');
await el(I, 'Pause button', 'i-pause', '#pause-button');
await el(I, 'Dash button', 'i-dash', '#dash-btn');
await el(I, 'Weapon dock', 'i-dock', '#weapon-bar');
await ev(() => {
  const g = window.__shatteredReefSv.give;
  g('weapon', 'chain_shot', 3); g('weapon', 'grapeshot', 2); g('weapon', 'depth_charges', 1);
  g('armament', 'harpoon', 2); g('passive', 'gun_crew', 2); g('passive', 'heavy_shot', 1); g('passive', 'sails', 1);
});
await wait(500);
await el(I, 'Weapon dock (filled)', 'i-dock2', '#weapon-bar');
await el(I, 'Upgrade strip', 'i-strip', '#upgrade-strip');
await ev(() => window.__shatteredReefWeather('gale')); await wait(350);
await el(I, 'Weather chip', 'i-weather', '#weather-chip');
await el(I, 'Toast message', 'i-toast', '#pickup-toast');
await ev(() => window.__shatteredReefSv.addXp(40)); await wait(900);
await shot('UI · Screens', 'Level-up choice', 'levelup');
await el('UI · Cards', 'Level-up card', 'k-card', '.up-card');
for (let k = 0; k < 25; k++) { const ok = await ev(() => window.__shatteredReefSv.pick(0)); await wait(ok ? 1800 : 50); if (!ok) break; }
await wait(800);
await ev(() => window.__shatteredReefSv.toWave(10));
// The banner animates in and out, so wait until it's fully shown and clip it.
for (let k = 0; k < 30; k++) {
  await wait(150);
  const r = await ev(() => { const e = document.getElementById('lord-banner'); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, op: +getComputedStyle(e).opacity }; });
  if (r && r.width > 0 && r.op > 0.9) { await p.screenshot({ path: `${OUT}/i-banner.png`, clip: { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: r.height + 8 } }); man.push({ cat: I, name: 'Warlord entrance banner', file: 'i-banner', kind: 'el' }); break; }
}
await wait(2600);
await shot('Review', 'Warlord arrives', 'r-warlord');
await el(I, 'Boss / warlord bar', 'i-boss', '#sv-boss');
await click('#pause-button'); await wait(500);
await shot('UI · Screens', 'Pause menu', 'pause');
await el('UI · Menus', 'Pause menu card', 'm-pause', '#pause-menu .pm-card');
await click('#pm-resume'); await wait(3800);
await ev(() => window.__shatteredReefSetHull(0)); await wait(3500);
await shot('UI · Screens', 'Run summary (sunk)', 'summary');
await el('UI · Menus', 'Summary card', 'm-summary', '#run-summary-card');

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(man, null, 1));
console.log(man.length, 'captures'); console.log(errs.join('\n') || 'no errors');
await b.close();
