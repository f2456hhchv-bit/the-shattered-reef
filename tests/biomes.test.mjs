// The six stage 5-10 biomes (2026-09-29): volcanic, caverns, mangrove,
// abyss, bone sands, crystal — their data, their tricks, and that every
// level of every stage builds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES } from '../src/data/biomes.mjs';
import { STAGES, stageInfo, stageScaling, bossForStage } from '../src/data/stages.mjs';
import { ENEMY_IDS, getEnemy, GUNS } from '../src/data/enemies.mjs';
import { WEAPONS } from '../src/data/weapons.mjs';
import { createRun, biomeForStage, checkReachedExit } from '../src/engine/run.mjs';
import { buildTerrain } from '../src/engine/terrain.mjs';
import { glowingDecorations } from '../src/engine/terrainRenderer.mjs';
import { createEnemy, updateEnemies, updateEnemy, resolveEnemyContactEvents, isRevealed, spawnReefEnemies } from '../src/engine/enemies.mjs';
import { updateEnemyGuns, stepEnemyProjectiles } from '../src/engine/enemyGuns.mjs';
import { createBoat, statusTuning, tickBoatStatus, applyAffliction, hasAffliction, DEFAULT_BOAT_TUNING, AFFLICTIONS } from '../src/engine/boat.mjs';
import { createWeaponState, stepCombat, resolveHits, frontArmorFactor } from '../src/engine/combat.mjs';
import { ambientLight, canSee, viewRadius } from '../src/engine/ambient.mjs';
import { createWeather, startWeather, stepWeather } from '../src/engine/weather.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

const DT = 1 / 60;
const W = 80;
const openGrid = () => ({ width: W, height: W, tiles: Array.from({ length: W }, () => Array(W).fill(0)) });
const wall = (g, x0, x1) => { for (let y = 0; y < W; y++) for (let x = x0; x < x1; x++) g.tiles[y][x] = 1; return g; };

test('ten stages, ten biomes, ten bosses; past the table they cycle, harder each lap', () => {
  assert.equal(STAGES.length, 10);
  assert.equal(new Set(STAGES.map((s) => s.biome)).size, 10);
  for (const s of STAGES) {
    assert.ok(BIOMES[s.biome], s.biome);
    for (const pool of s.pools) for (const id of pool) assert.ok(getEnemy(id), id);
    assert.ok(getEnemy(s.boss).isBoss);
  }
  assert.equal(biomeForStage(11), biomeForStage(1));
  assert.equal(bossForStage(15), bossForStage(5));
  for (let st = 2; st <= 14; st++) assert.ok(stageScaling(st).health >= stageScaling(st - 1).health, `stage ${st} not harder`);
  assert.ok(stageScaling(11).health > stageScaling(10).health);
});

test('every new enemy has a real counter, and every new gun a known shot kind', () => {
  for (const s of STAGES.slice(4)) {
    for (const id of new Set(s.pools.flat())) assert.ok(WEAPONS[getEnemy(id).counter], id);
    for (const ph of getEnemy(s.boss).phases) assert.ok(WEAPONS[ph.counter], s.boss);
  }
  for (const g of Object.values(GUNS)) assert.ok(g.kind);
});

test('every level of stages 5-10 builds, spawns its own roster, and each lair holds its boss', () => {
  for (let stage = 5; stage <= 10; stage++) {
    const run = createRun(stage * 101, undefined, { stage });
    assert.equal(run.level.biomeId, STAGES[stage - 1].biome);
    const allowed = new Set([...STAGES[stage - 1].pools.flat()]);
    while (run.reefIndex < 4) {
      for (const e of run.enemies) assert.ok(allowed.has(e.defId) || e.elite, `${stage}: ${e.defId}`);
      Object.assign(run.boat, { x: run.exitWorld.x, y: run.exitWorld.y });
      assert.equal(checkReachedExit(run), 'advanced');
    }
    assert.equal(run.enemies.find((e) => e.isBoss).defId, bossForStage(stage));
  }
});

test('biome art data: glowing decorations exist where the biome glows, and lava only in the volcano', () => {
  for (let stage = 5; stage <= 10; stage++) {
    const run = createRun(7, undefined, { stage });
    const biome = BIOMES[run.level.biomeId];
    const terrain = buildTerrain(run.grid, run.tileSize, run.coastSeed, biome, run.coast);
    const glows = glowingDecorations(terrain, biome);
    if (biome.glow) assert.ok(glows.length > 5, `${biome.id} should glow`);
    else assert.equal(glows.length, 0);
  }
  assert.ok(BIOMES.volcanic.lava && !BIOMES.caverns.lava);
});

test('afflictions: burn and poison hurt over time, shock stalls the sails, all wear off', () => {
  const b = createBoat(0, 0, 0);
  applyAffliction(b, 'burn', 2); applyAffliction(b, 'poison', 2);
  let lost = 0;
  for (let t = 0; t < 3; t += DT) lost += tickBoatStatus(b, DT);
  const want = (AFFLICTIONS.burn.dps + AFFLICTIONS.poison.dps) * 2;
  assert.ok(Math.abs(lost - want) < 0.5, `${lost} vs ${want}`);
  assert.ok(!hasAffliction(b, 'burn') && !hasAffliction(b, 'poison'));
  applyAffliction(b, 'shock', 0.8);
  const tn = statusTuning(DEFAULT_BOAT_TUNING, b);
  assert.ok(tn.acceleration < DEFAULT_BOAT_TUNING.acceleration * 0.3 && tn.turnRate < DEFAULT_BOAT_TUNING.turnRate * 0.5);
  applyAffliction(b, 'shock', 0.2); // a shorter hit never shortens it
  assert.ok(b.afflictions.shock >= 0.79);
});

test('contact and shots put their status on you: bat burns, leech poisons, jelly shocks, squid inks', () => {
  for (const [id, kind] of [[ENEMY_IDS.CINDER_BAT, 'burn'], [ENEMY_IDS.LEECH_SWARM, 'poison'], [ENEMY_IDS.JELLY_BLOOM, 'shock']]) {
    const b = createBoat(400, 400, 0);
    const e = createEnemy(id, 404, 400);
    resolveEnemyContactEvents([e], b, 11);
    assert.ok(hasAffliction(b, kind), id);
  }
  const b = createBoat(400, 400, 0);
  const sq = createEnemy(ENEMY_IDS.INK_SQUID, 520, 400); sq.aggro = true; sq.gunTimer = 0;
  const shots = []; let hit = false;
  for (let t = 0; t < 6 && !hit; t += DT) {
    updateEnemyGuns([sq], b, DT, { grid: openGrid(), tileSize: 16 }, shots, makeSeededRng(3));
    hit = stepEnemyProjectiles(shots, b, 11, DT, { grid: openGrid(), tileSize: 16 }).hits.length > 0;
  }
  assert.ok(hit && hasAffliction(b, 'ink'));
});

test('darkness: caverns are dark with a lantern radius; ink blinds you anywhere; a boss can swallow the light', () => {
  const cave = createRun(3, undefined, { stage: 6 });
  const a = ambientLight(cave, BIOMES.caverns);
  assert.ok(a.dark > 0.8 && a.light > 100 && a.light < 300);
  const trop = createRun(3, undefined, { stage: 1 });
  assert.equal(ambientLight(trop, BIOMES.tropical).light, null);
  applyAffliction(trop.boat, 'ink', 2);
  assert.ok(ambientLight(trop, BIOMES.tropical).light <= 110);
  const king = createEnemy(ENEMY_IDS.HOLLOW_KING, cave.boat.x + 50, cave.boat.y); king.aggro = true;
  cave.enemies = [king];
  assert.ok(ambientLight(cave, BIOMES.caverns).light < a.light * 0.7, 'phase 1 darkens');
  // Blackout weather dims it too.
  cave.enemies = []; cave.weather = createWeather('caverns');
  assert.ok(startWeather(cave, 'blackout', makeSeededRng(2))); cave.weather.time = 5;
  assert.ok(ambientLight(cave, BIOMES.caverns).light < a.light * 0.7);
});

test('in the dark you can only aim at what the lantern shows — or what glows', () => {
  const run = createRun(3, undefined, { stage: 6 });
  const r = viewRadius(run, BIOMES.caverns);
  const far = createEnemy(ENEMY_IDS.DEEP_TROLL, run.boat.x + r * 1.1, run.boat.y);
  const near = createEnemy(ENEMY_IDS.DEEP_TROLL, run.boat.x + r * 0.5, run.boat.y);
  const glowing = createEnemy(ENEMY_IDS.JELLY_BLOOM, run.boat.x + r * 1.1, run.boat.y);
  assert.ok(!canSee(run, far, r) && canSee(run, near, r) && canSee(run, glowing, r));
});

test('camouflage: a gator is hidden until you are close, it attacks, or it is hurt', () => {
  const boat = createBoat(400, 400, 0);
  const g = createEnemy(ENEMY_IDS.BAYOU_GATOR, 560, 400);
  assert.equal(isRevealed(g, boat), false);
  g.x = 480; assert.equal(isRevealed(g, boat), true);
  g.x = 560; g.sharkState = 'windup'; assert.equal(isRevealed(g, boat), true);
  g.sharkState = 'circling'; g.health -= 1; assert.equal(isRevealed(g, boat), true);
});

test('ambush: an anglerfish holds still at its lure, then strikes when you come close', () => {
  const grid = openGrid();
  const boat = createBoat(400, 400, 0);
  const a = createEnemy(ENEMY_IDS.ANGLERFISH, 570, 400, makeSeededRng(4)); a.aggro = true;
  for (let t = 0; t < 4; t += DT) updateEnemy(a, boat, DT, grid, 16);
  assert.ok(Math.hypot(a.x - 570, a.y - 400) < 20, 'stays home while you keep your distance');
  assert.equal(a.sharkState, 'circling');
  boat.x = 500;
  let struck = false;
  for (let t = 0; t < 2; t += DT) { updateEnemy(a, boat, DT, grid, 16); if (a.sharkState === 'charging') struck = true; }
  assert.ok(struck, 'strikes at close range');
});

test('burrowing: a sand wyrm swims under the dunes but only ever surfaces in water', () => {
  const grid = wall(openGrid(), 30, 36);
  const boat = createBoat(40 * 16, 40 * 16, 0);
  const w = createEnemy(ENEMY_IDS.SAND_WYRM, 24 * 16, 40 * 16, makeSeededRng(5)); w.aggro = true;
  let crossed = false;
  for (let t = 0; t < 30; t += DT) {
    updateEnemy(w, boat, DT, grid, 16);
    if (w.x > 36 * 16) crossed = true;
    if (w.submergedState === 'surfaced') {
      const tx = Math.floor(w.x / 16); const ty = Math.floor(w.y / 16);
      assert.notEqual(grid.tiles[ty]?.[tx], 1, 'surfaced inside the dune');
    }
  }
  assert.ok(crossed, 'it tunnelled under the dune');
});

test('front armour: a mirror tortoise shrugs off hits from ahead, not from the side or below', () => {
  const t = createEnemy(ENEMY_IDS.MIRROR_TORTOISE, 0, 0); t.heading = 0;
  assert.equal(frontArmorFactor(t, { vx: -200, vy: 0 }), getEnemy(ENEMY_IDS.MIRROR_TORTOISE).frontArmor, 'from the front');
  assert.equal(frontArmorFactor(t, { vx: 0, vy: 200 }), 1, 'from the side');
  assert.equal(frontArmorFactor(t, { vx: 200, vy: 0 }), 1, 'from behind');
  // Depth Charges ignore it (a blast from below).
  const s = createWeaponState(['depth_charges']);
  s.projectiles.push({ id: 1, weaponId: 'depth_charges', x: 0, y: 0, vx: -100, vy: 0, radius: 4, traveled: 0, maxRange: 999, fuseRemaining: 0, spent: true });
  const ev = resolveHits(s, [t], (e) => e.counter);
  assert.ok(ev.length === 1 && !ev[0].armored && ev[0].damage >= WEAPONS.depth_charges.damage * 0.99);
});

test('ricochet: on crystal shores your shots and theirs glance off once, elsewhere they stop', () => {
  const grid = wall(openGrid(), 40, 44);
  for (const ricochet of [0, 1]) {
    const s = createWeaponState(); s.ricochet = ricochet;
    s.projectiles.push({ id: 1, weaponId: 'cannonballs', x: 38 * 16, y: 300, vx: 300, vy: 0, radius: 3, traveled: 0, maxRange: 2000 });
    for (let i = 0; i < 60; i++) stepCombat(s, DT, grid, 16);
    const p = s.projectiles[0];
    if (!ricochet) assert.ok(p.spent);
    else { assert.ok(!p.spent || p.bounces === 1, 'bounced'); assert.ok(p.vx < 0 && p.x < 40 * 16, 'heading back'); }
  }
  const boat = createBoat(0, 0, 0);
  const shots = [{ id: 1, x: 38 * 16, y: 300, vx: 200, vy: 0, radius: 3, damage: 5, life: 5, kind: 'prism' }];
  for (let i = 0; i < 30; i++) stepEnemyProjectiles(shots, boat, 11, DT, { grid, tileSize: 16, ricochet: 1 });
  assert.ok(shots.length === 1 && shots[0].vx < 0 && shots[0].bounces === 1);
});

test('the Prism Colossus is rooted in its first phase and still changes phase; its spiral turns', () => {
  const grid = openGrid();
  const boat = { ...createBoat(400, 400, 0), health: 1e6 };
  const c = createEnemy(ENEMY_IDS.PRISM_COLOSSUS, 500, 400, makeSeededRng(6)); c.aggro = true;
  const shots = []; const angles = new Set();
  let moved = false;
  for (let t = 0; t < 30; t += DT) {
    updateEnemies([c], boat, DT, grid, 16);
    const n = shots.length;
    updateEnemyGuns([c], boat, DT, { grid, tileSize: 16 }, shots, makeSeededRng(7));
    if (shots.length > n && c.phaseIndex === 0) angles.add(Math.atan2(shots[n].vy, shots[n].vx).toFixed(2));
    if (c.phaseIndex === 0) assert.ok(Math.hypot(c.x - 500, c.y - 400) < 0.01, 'rooted');
    if (c.phaseIndex === 1 && Math.hypot(c.x - 500, c.y - 400) > 5) moved = true;
    shots.length = Math.min(shots.length, 200);
  }
  assert.ok(angles.size >= 3, 'the spiral rotates between volleys');
  assert.ok(moved, 'phase 2 tears loose');
});

test('packs: cave bats, leeches, jellies, crabs and drowned skiffs arrive in groups', () => {
  for (const id of [ENEMY_IDS.CAVE_BATS, ENEMY_IDS.LEECH_SWARM, ENEMY_IDS.JELLY_BLOOM, ENEMY_IDS.CRYSTAL_CRAB, ENEMY_IDS.DROWNED_SKIFF]) {
    const grid = openGrid();
    const es = spawnReefEnemies([id], grid, 16, { x: 100, y: 100 }, { x: 1200, y: 1200 }, 8, makeSeededRng(8));
    const first = es[0];
    const pack = es.filter((e) => Math.hypot(e.x - first.x, e.y - first.y) < 40);
    assert.ok(pack.length >= 3, `${id}: ${pack.length}`);
  }
});

test('weather that burns: an eruption sets your ship alight when a lava bomb lands on it', () => {
  const run = createRun(1, undefined, { stage: 5 });
  run.weather = createWeather('volcanic');
  assert.ok(startWeather(run, 'eruption', makeSeededRng(1)));
  run.weather.active.next = 99;
  run.weather.drops.push({ x: run.boat.x, y: run.boat.y, warn: 0.05, max: 1, r: 30, spin: 0, kind: 'eruption' });
  stepWeather(run, 0.1);
  assert.ok(hasAffliction(run.boat, 'burn'));
});
