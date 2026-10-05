// Asset gallery (dev tool, 2026-10-05): every piece of art the game draws in
// code, each in its own tile with a name and whether that code art is what
// players see ("code art in use") or only a fallback behind a painted image.
// Open tools/asset-gallery.html from the repo root's dev server. Painted
// images are deliberately never loaded here, so every tile shows code art.

import { ENEMIES } from '../src/data/enemies.mjs';
import { ENEMY_SHIP_LOOKS } from '../src/data/enemyShipLooks.mjs';
import { CREATURE_ART } from '../src/data/creatureArt.mjs';
import { BIOMES } from '../src/data/biomes.mjs';
import { BASE_BUILDINGS } from '../src/data/base.mjs';
import { BUILDING_SPRITES } from '../src/engine/buildingSprites.mjs';
import { SHIP_SPRITE_FRAMES } from '../src/engine/shipSprites.mjs';
import { GEMS } from '../src/data/survival.mjs';
import { createEnemy } from '../src/engine/enemies.mjs';
import { drawEnemy, drawProjectile, drawPickup } from '../src/engine/renderer.mjs';
import { drawShipArt } from '../src/engine/shipArt.mjs';
import { drawEnemyProjectiles } from '../src/engine/enemySprites.mjs';
import { drawBaseBuildings, drawHarbourDecor } from '../src/engine/baseRenderer.mjs';
import { drawLandmarkKind, drawIsland } from '../src/engine/islandArt.mjs';
import { STAGES } from '../src/data/stages.mjs';
import { drawDecoration } from '../src/engine/terrainRenderer.mjs';
import { drawSurvivalPickups, drawFirePools, drawOrbitBlades } from '../src/engine/survivalArt.mjs';
import { drawChest, drawSpirits, drawLightning, drawEliteAura, drawWard, drawEnrage } from '../src/engine/armamentArt.mjs';
import { drawLords } from '../src/engine/warlordArt.mjs';
import { drawTower, drawHeart, drawSpot, drawMine } from '../src/engine/tdArt.mjs';
import { drawWeatherWorld, drawWeatherAbove } from '../src/engine/weatherArt.mjs';
import { WEATHER } from '../src/data/weather.mjs';
import { createParticlePool, spawnHitSpark, spawnKillBurst, spawnExplosion, spawnSplash, spawnMuzzleFlash, updateParticles, createDamageNumberPool, spawnDamageNumber, updateDamageNumbers } from '../src/engine/juice.mjs';
import { drawParticles, drawDamageNumbers, drawTargetReticle, drawWake, drawBoatStatus, drawDiveTelegraph } from '../src/engine/renderer.mjs';
import { drawHullBar, drawRings, drawSinkers } from '../src/engine/survivalArt.mjs';
import { drawGulls } from '../src/engine/baseRenderer.mjs';

const T = 1.3; // animation time frozen at a flattering frame
const VIEW = { left: -1e4, top: -1e4, right: 1e4, bottom: 1e4, x: -1e4, y: -1e4, w: 2e4, h: 2e4 };
const tiles = [];
const add = (cat, name, status, draw, zoom = 2) => tiles.push({ cat, name, status, draw, zoom });
const IN_USE = 'code'; const FALLBACK = 'fallback';

// --- Player ships -----------------------------------------------------------
for (const style of ['sloop', 'longboat', 'skiff', 'catamaran', 'junk', 'steamer', 'galleon']) {
  add('Player ships', style[0].toUpperCase() + style.slice(1), SHIP_SPRITE_FRAMES[style] ? FALLBACK : IN_USE,
    (ctx) => { ctx.rotate(-Math.PI / 2); drawShipArt(ctx, style, 11, T, -Math.PI / 2, 40); }, 2.6);
}

// --- Enemies and bosses ------------------------------------------------------
let eid = 1;
for (const def of Object.values(ENEMIES)) {
  const key = def.sprite || def.id;
  const painted = (ENEMY_SHIP_LOOKS[key] ? 'painted ship' : null) || (CREATURE_ART[def.id] || CREATURE_ART[key] ? 'creature sprite' : null);
  const cat = def.isBoss ? 'Bosses' : 'Enemies';
  let e;
  try { e = createEnemy(def.id, 0, 0, () => 0.5); } catch { e = { defId: def.id, radius: def.radius || 12 }; }
  Object.assign(e, { x: 0, y: 0, id: eid++, vx: 30, vy: 10, heading: 0.3, health: e.maxHealth || 50, hitFlash: 0, aggro: true, invulnerable: false, submergedState: null, phased: false });
  const r = e.radius || 12;
  add(cat, def.name, painted ? FALLBACK : IN_USE, (ctx) => drawEnemy(ctx, e, def.color || '#888', T), Math.min(3, (def.isBoss ? 34 : 44) / r));
}

// --- Boss and elite effects ----------------------------------------------------
const bossStub = () => ({ x: 0, y: 0, radius: 22, id: 9, enraged: true });
add('Boss effects', 'Elite aura (gold ring)', IN_USE, (ctx) => drawEliteAura(ctx, { x: 0, y: 0, radius: 14, id: 3 }, T));
add('Boss effects', 'Warlord crown + aura', IN_USE, (ctx) => { const e = createEnemy('reef_shark', 0, 0, () => 0.5); Object.assign(e, { x: 0, y: 0, id: 7, heading: 0.3, vx: 30, vy: 10, health: 50, lord: { novaWindup: 0, novaMax: 1, novaSpin: 0, extraShots: 0 } }); drawEnemy(ctx, e, '#5d7688', T); drawLords(ctx, [e], T); }, 1.6);
add('Boss effects', 'Ward bubble', IN_USE, (ctx) => drawWard(ctx, bossStub(), [{ x: -60, y: 40, health: 1 }, { x: 60, y: 40, health: 1 }], T), 1.3);
add('Boss effects', 'Enrage ring', IN_USE, (ctx) => drawEnrage(ctx, bossStub(), T), 1.6);

// --- Harbour --------------------------------------------------------------------
for (const b of BASE_BUILDINGS) {
  add('Harbour buildings', b.name, BUILDING_SPRITES[b.id] ? FALLBACK : IN_USE,
    (ctx) => { ctx.translate(0, 30); drawBaseBuildings(ctx, [{ ...b, x: 0, y: 0, lagoonX: 0, lagoonY: 100 }], T, { selectedFaction: 'reavers' }); }, 0.85);
}
const decorShip = () => {};
const decorLandmark = (ctx, kind, x, y, t, s, a) => drawLandmarkKind(ctx, kind, x, y, t, s, a);
add('Harbour props', 'Jetty with lantern', IN_USE, (ctx) => drawHarbourDecor(ctx, [{ kind: 'jetty', x: -40, y: 0, angle: 0, len: 80 }], T, { drawShip: decorShip, drawLandmark: decorLandmark }), 1.4);
add('Harbour props', 'Rock cluster', IN_USE, (ctx) => drawHarbourDecor(ctx, [{ kind: 'rocks', x: 0, y: 0, stones: [{ dx: 0, dy: 0, r: 7 }, { dx: 9, dy: 4, r: 5 }, { dx: -8, dy: 5, r: 4.5 }] }], T, { drawShip: decorShip, drawLandmark: decorLandmark }), 2.6);
add('Harbour props', 'Channel buoys', IN_USE, (ctx) => drawHarbourDecor(ctx, [{ kind: 'buoy', x: -12, y: 4, color: '#c8402e' }, { kind: 'buoy', x: 12, y: 4, color: '#2f8f4e' }], T, { drawShip: decorShip, drawLandmark: decorLandmark }), 3);
add('Harbour props', 'Rowboat', IN_USE, (ctx) => drawHarbourDecor(ctx, [{ kind: 'rowboat', x: 0, y: 0, heading: -0.5 }], T, { drawShip: decorShip, drawLandmark: decorLandmark }), 3.5);

// --- Landmarks ----------------------------------------------------------------
const LM = { fort: 'Pirate fort', lighthouse: 'Lighthouse', ice: 'Ice spires', wreck: 'Shipwreck', volcano: 'Volcano', cave: 'Cave mouth', hut: 'Stilt hut', rift: 'Drowned temple rift', skull: 'Giant skull', crystal: 'Crystal spire' };
for (const [kind, name] of Object.entries(LM)) add('Landmarks', name, IN_USE, (ctx) => drawLandmarkKind(ctx, kind, 0, 18, T, 1, 0), 2.2);

// --- Terrain: each biome's ground, water, shore and decor, as the chart
// island painted by the same terrain renderer the levels use.
STAGES.slice(0, 10).forEach((st, i) => {
  const biome = BIOMES[st.biome];
  add('Terrain (biome islands)', `${biome.name} (Stage ${i + 1})`, IN_USE, (ctx) => { ctx.translate(-100, -80); drawIsland(ctx, 200, 160, st.biome, i + 1); }, 0.8);
});

// --- Terrain decorations (baked into the island art) --------------------------
const seen = new Set();
for (const biome of Object.values(BIOMES)) {
  for (const kind of ['palm', 'bush', 'boulder', 'coral', 'shell']) {
    const style = biome.decor?.[kind] ?? kind;
    if (seen.has(style)) continue; seen.add(style);
    add('Island decorations', style === kind ? `${kind[0].toUpperCase()}${kind.slice(1)}` : `${style[0].toUpperCase()}${style.slice(1)} (${biome.name})`, IN_USE,
      (ctx) => drawDecoration(ctx, { x: 0, y: 8, kind, size: 10, variant: 0.45 }, biome), 4);
  }
}

// --- Pickups ---------------------------------------------------------------------
GEMS.forEach((g, i) => add('Pickups', `Sea-glass gem (${g.value} XP)`, IN_USE, (ctx) => drawSurvivalPickups(ctx, [{ kind: 'gem', tier: g, value: g.value, id: i, x: 0, y: 0 }], VIEW, T), 5));
add('Pickups', 'Anchor coin (Salvage)', IN_USE, (ctx) => drawSurvivalPickups(ctx, [{ kind: 'coin', amount: 5, id: 1, x: 0, y: 0 }], VIEW, T), 5);
add('Pickups', 'Lodestone (pull all)', IN_USE, (ctx) => drawSurvivalPickups(ctx, [{ kind: 'magnet', id: 1, x: 0, y: 0 }], VIEW, T), 4);
add('Pickups', 'Life ring (repair)', IN_USE, (ctx) => drawPickup(ctx, { kind: 'repair', id: 1, x: 0, y: 0 }, null, T), 4);
add('Pickups', 'Treasure chest', IN_USE, (ctx) => drawChest(ctx, { id: 1, x: 0, y: 0 }, T), 3.5);

// --- Player shots ------------------------------------------------------------------
const shot = (weaponId, extra = {}) => ({ x: 0, y: 0, vx: 200, vy: -60, weaponId, id: 3, radius: 3, fuseRemaining: 0.4, fuseTotal: 1, blastRadius: 30, armDelay: 0, ...extra });
const SHOTS = { cannonballs: 'Cannonball', chain_shot: 'Chain Shot', grapeshot: 'Grapeshot pellet', depth_charges: 'Depth Charge', flame_barrels: 'Flame Barrel', sv_barrel: 'Flame Barrel (lobbed)',
  arm_swivel: 'Swivel Gun shot', arm_harpoon: 'Harpoon', arm_mortar: 'Deck Mortar shell', arm_keg: 'Powder Keg', arm_stern: 'Stern Chaser shot', arm_broadside: 'Broadside Battery shot' };
const LOBBED = new Set(['depth_charges', 'sv_barrel', 'arm_mortar']);
for (const [id, name] of Object.entries(SHOTS)) {
  const lob = LOBBED.has(id);
  add('Player shots', name, IN_USE, (ctx) => { if (lob) ctx.translate(0, 16); drawProjectile(ctx, shot(id, lob ? { fuseRemaining: 0.9, fuseTotal: 1, vx: 60, vy: -20 } : {}), '#333', T); }, lob ? 2.4 : 5);
}
add('Player shots', 'Evolved shot (gold corona)', IN_USE, (ctx) => drawProjectile(ctx, shot('cannonballs', { evo: true }), '#333', T), 5);
add('Player shots', 'Sea Spirit wisps', IN_USE, (ctx) => drawSpirits(ctx, [{ x: -14, y: 0 }, { x: 14, y: 0 }], 0, T), 3);
add('Player shots', "St Elmo's Fire arc", IN_USE, (ctx) => drawLightning(ctx, [{ x1: -40, y1: -10, x2: 40, y2: 12, life: 1, maxLife: 1, jag: [0.1, 0.9, 0.3, 0.7, 0.2, 0.8] }]), 1.8);
add('Player shots', 'Reaper Chains blades', IN_USE, (ctx) => drawOrbitBlades(ctx, [{ x: -16, y: 0, a: 0 }, { x: 16, y: 0, a: 2 }], T), 3);
add('Player shots', 'Fire pool', IN_USE, (ctx) => drawFirePools(ctx, [{ x: 0, y: 0, r: 22, t: 0.5, duration: 3 }], VIEW, T), 2.6);

// --- Enemy shots -------------------------------------------------------------------
const eshot = (kind, extra = {}) => ({ x: 0, y: 0, vx: 120, vy: 30, id: 4, radius: 4, kind, ...extra });
const ESH = { ball: 'Cannonball', fire: 'Fire bolt', hex: 'Hex bolt', spore: 'Spore', ink: 'Ink glob', shock: 'Shock bolt', sand: 'Sand blast', prism: 'Prism bolt', boulder: 'Boulder', frost: 'Frost shard', spectral: 'Spectral shot', glob: 'Glob' };
for (const [kind, name] of Object.entries(ESH)) add('Enemy shots', name, IN_USE, (ctx) => drawEnemyProjectiles(ctx, [eshot(kind === 'ball' ? undefined : kind)], T), 5);
add('Enemy shots', 'Mortar shell + target ring', IN_USE, (ctx) => drawEnemyProjectiles(ctx, [eshot(undefined, { lob: true, t: 0.5, flight: 1, blast: 26, tx: 0, ty: 20, y: 20 })], T), 1.8);

// --- Reef Defence --------------------------------------------------------------------
const TOWERS = { cannon: 'Cannon Battery', grapeshot: 'Grapeshot Nest', chain: 'Chain Mast', depth: 'Depth Charge Post', flame: 'Fire Brazier', lighthouse: 'Lighthouse tower' };
for (const [id, name] of Object.entries(TOWERS)) add('Reef Defence', name, IN_USE, (ctx) => drawTower(ctx, { towerId: id, x: 0, y: 12, level: 3, angle: -0.6, id: 1, spec: null, recoil: 0, stunT: 0, slowT: 0, fireT: 0, inkT: 0, poisonT: 0 }, T), 3);
add('Reef Defence', 'Heart of the Reef', IN_USE, (ctx) => drawHeart(ctx, { x: 0, y: 0 }, T, { lives: 18, maxLives: 20 }), 2);
add('Reef Defence', 'Build spot', IN_USE, (ctx) => drawSpot(ctx, { x: 0, y: 0 }, T), 4);
add('Reef Defence', 'Mine', IN_USE, (ctx) => drawMine(ctx, { x: 0, y: 0, id: 1 }, T), 5);

// --- Weather -----------------------------------------------------------------------
const wx = (id, w) => (ctx) => { const st = { active: { def: WEATHER[id] }, strikes: [], drops: [], spouts: [], floes: [], lights: [], whirl: null, wave: null, ...w }; drawWeatherWorld(ctx, st, T); drawWeatherAbove(ctx, st, T); };
add('Weather', 'Whirlpool', IN_USE, wx('whirlpool', { whirl: { x: 0, y: 0, r: WEATHER.whirlpool.radius, spin: 1, age: 3, strength: 1 } }), 0.8);
add('Weather', 'Waterspout', IN_USE, wx('waterspout', { spouts: [{ x: 0, y: 20, heading: 0, id: 1 }] }), 1.6);
add('Weather', 'Ice floe', IN_USE, wx('ice_floes', { floes: [{ x: 0, y: 0, r: 24, rot: 0.4, pts: [1, 0.85, 0.95, 0.8, 1, 0.9, 0.85], color: WEATHER.ice_floes.colors[0] }] }), 2.2);
add('Weather', 'Wreckage', IN_USE, wx('wreckage', { floes: [{ x: 0, y: 0, r: 22, rot: 0.4, pts: [1, 0.85, 0.95, 0.8, 1, 0.9, 0.85], color: WEATHER.wreckage.colors[0] }] }), 2.2);
add('Weather', 'Ghost light', IN_USE, wx('ghost_lights', { lights: [{ x: 0, y: 0, phase: 0 }] }), 3);
add('Weather', 'Lightning strike mark', IN_USE, wx('thunderstorm', { strikes: [{ x: 0, y: 0, warn: 1.2, max: 3, r: WEATHER.thunderstorm.strikeRadius }] }), 1.5);
add('Weather', 'Rockfall', IN_USE, wx('rockfall', { drops: [{ x: 0, y: 10, warn: 0.6, max: 2.2, r: WEATHER.rockfall.radius, spin: 0.5 }] }), 1.6);
add('Weather', 'Icefall', IN_USE, wx('icefall', { drops: [{ x: 0, y: 10, warn: 0.6, max: 2.2, r: WEATHER.icefall.radius, spin: 0.5 }] }), 1.6);


// --- Effects (particles and one-shot effects), frozen mid-animation -------------
const seeded = (n) => { let v = n; return () => { v = (v * 16807) % 2147483647; return v / 2147483647; }; };
const fx = (spawn, age) => (ctx) => { const pool = createParticlePool(); spawn(pool, seeded(7)); updateParticles(pool, age); drawParticles(ctx, pool.particles || pool); };
add('Effects', 'Hit spark', IN_USE, fx((p, r) => spawnHitSpark(p, 0, 0, '#ffd27a', r, 12), 0.08));
add('Effects', 'Kill burst', IN_USE, fx((p, r) => spawnKillBurst(p, 0, 0, '#c0392b', r), 0.12));
add('Effects', 'Explosion', IN_USE, fx((p, r) => spawnExplosion(p, 0, 0, 40, r), 0.15));
add('Effects', 'Splash', IN_USE, fx((p, r) => spawnSplash(p, 0, 0, r, 14), 0.12));
add('Effects', 'Muzzle flash', IN_USE, fx((p, r) => spawnMuzzleFlash(p, 0, 0, -0.4, '#ffd27a', r), 0.03));
add('Effects', 'Shockwave rings', IN_USE, (ctx) => drawRings(ctx, [{ x: 0, y: 0, life: 0.35, maxLife: 0.6, r: 60, color: '255, 214, 92' }, { x: 0, y: 0, life: 0.2, maxLife: 0.6, r: 60, color: '150, 230, 255' }]));
add('Effects', 'Ship wake', IN_USE, (ctx) => drawWake(ctx, Array.from({ length: 9 }, (_, k) => ({ x: -k * 9, y: k * 3, heading: 0.3, life: 1.1 - k * 0.11, maxLife: 1.1 }))));
add('Effects', 'Sinking enemy', IN_USE, (ctx) => { const e = createEnemy('pirate_cutter', 0, 0, () => 0.5); Object.assign(e, { x: 0, y: 0, id: 3, heading: 0.3, vx: 20, vy: 5 }); drawSinkers(ctx, [{ e, life: 0.25, maxLife: 0.5 }], T, () => '#c0392b'); });
add('Effects', 'Damage numbers', IN_USE, (ctx) => { const pool = createDamageNumberPool(); spawnDamageNumber(pool, -20, 0, 12, {}); spawnDamageNumber(pool, 18, -6, 35, { crit: true }); spawnDamageNumber(pool, 0, 18, 9, { incoming: true }); updateDamageNumbers(pool, 0.15); drawDamageNumbers(ctx, pool.numbers || pool); });
for (const [k, name] of [['burn', 'Burning'], ['poison', 'Poisoned'], ['chill', 'Chilled'], ['shock', 'Shocked'], ['ink', 'Inked']]) {
  add('Effects', `Status on ship: ${name}`, IN_USE, (ctx) => { ctx.fillStyle = 'rgba(80,50,30,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2); ctx.fill(); drawBoatStatus(ctx, { x: 0, y: 0, afflictions: { [k]: 2 }, chillRemaining: k === 'chill' ? 2 : 0 }, 11, T); });
}

// --- In-world HUD ------------------------------------------------------------------
add('In-world HUD', 'Hull bar under the ship', IN_USE, (ctx) => drawHullBar(ctx, { x: 0, y: 0, health: 62, maxHull: 100 }, 11, 0), 3);
add('In-world HUD', 'Lock-on reticle', IN_USE, (ctx) => drawTargetReticle(ctx, { x: 0, y: 0, radius: 12, id: 1 }, T, true));
add('In-world HUD', 'Dive / charge telegraph', IN_USE, (ctx) => { const e = createEnemy('gullswarm_harpy', 0, 0, () => 0.5); Object.assign(e, { x: -30, y: -20, id: 4, diveTimer: 0.3, diveTargetX: 30, diveTargetY: 25 }); drawDiveTelegraph(ctx, e, T); });

// --- Ambient life -------------------------------------------------------------------
add('Ambient life', 'Gulls (harbour and intro)', IN_USE, (ctx) => { ctx.scale(3, 3); ctx.translate(-180, 0); drawGulls(ctx, { x: 0, y: 0 }, 0); });

// --- Render ------------------------------------------------------------------------
const SIZE = 168; const DPR = 2;
const root = document.getElementById('gallery');
const groups = new Map();
for (const tile of tiles) {
  if (!groups.has(tile.cat)) {
    const h = document.createElement('h2'); h.textContent = tile.cat; root.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'grid'; root.appendChild(grid);
    groups.set(tile.cat, grid);
  }
  const card = document.createElement('figure'); card.className = `tile ${tile.status}`;
  card.dataset.i = String(tiles.indexOf(tile));
  const cv = document.createElement('canvas'); cv.width = SIZE * DPR; cv.height = SIZE * DPR; cv.style.width = cv.style.height = `${SIZE}px`;
  const ctx = cv.getContext('2d');
  const sea = ctx.createRadialGradient(SIZE, SIZE, 10, SIZE, SIZE, SIZE * 1.4);
  sea.addColorStop(0, '#1d7fa3'); sea.addColorStop(1, '#0d4a66');
  ctx.fillStyle = sea; ctx.fillRect(0, 0, cv.width, cv.height);
  // Fit: draw once on a scratch canvas, measure what was painted, then
  // draw again scaled and centred to fill the tile.
  let ok = true; let fit = { k: tile.zoom, cx: 0, cy: 0 };
  try {
    const M = 900; const sc = document.createElement('canvas'); sc.width = sc.height = M;
    const s2 = sc.getContext('2d'); s2.setTransform(1, 0, 0, 1, M / 2, M / 2); tile.draw(s2);
    const d = s2.getImageData(0, 0, M, M).data; let x0 = M, y0 = M, x1 = -1, y1 = -1;
    for (let y = 0; y < M; y += 2) for (let x = 0; x < M; x += 2) if (d[(y * M + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 > x0) { const k = Math.min(6, (SIZE * 0.84) / Math.max(x1 - x0, y1 - y0, 8)); fit = { k, cx: (x0 + x1) / 2 - M / 2, cy: (y0 + y1) / 2 - M / 2 }; }
  } catch { /* drawn below, where a failure is reported */ }
  ctx.setTransform(DPR * fit.k, 0, 0, DPR * fit.k, SIZE * DPR / 2 - fit.cx * DPR * fit.k, SIZE * DPR / 2 - fit.cy * DPR * fit.k);
  try { tile.draw(ctx); } catch (err) { ok = false; console.warn(tile.name, err); }
  const cap = document.createElement('figcaption');
  cap.innerHTML = `<b>${tile.name}</b><span>${ok ? (tile.status === IN_USE ? 'Code art in use' : 'Fallback (painted art replaces it)') : 'Failed to render'}</span>`;
  card.append(cv, cap); groups.get(tile.cat).appendChild(card);
}
window.__galleryTiles = tiles.map((t) => ({ cat: t.cat, name: t.name, status: t.status }));
window.__galleryDone = true;
