import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, updateEnemy, updateEnemies, stepSummons, wakeEnemy, currentCounter } from '../src/engine/enemies.mjs';
import { updateEnemyGuns, stepEnemyProjectiles } from '../src/engine/enemyGuns.mjs';
import { ENEMY_IDS, getEnemy, ENEMY_LIST } from '../src/data/enemies.mjs';
import { STAGES, stagePool, bossForStage, stageScaling } from '../src/data/stages.mjs';
import { createRun } from '../src/engine/run.mjs';
import { PICKUP_KINDS } from '../src/data/pickups.mjs';
import { createWeaponState, collectWeaponCache, setActiveWeapon, tryFire, stepCombat, resolveHits, cleanupProjectiles, stepBurn } from '../src/engine/combat.mjs';
import { getWeapon } from '../src/data/weapons.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

const DT = 1 / 60;
const N = 80;
const open = () => ({ width: N, height: N, tiles: Array.from({ length: N }, () => Array(N).fill(0)) });

function sim(enemy, boat, seconds, grid = open(), shots = []) {
  const enemies = Array.isArray(enemy) ? enemy : [enemy];
  let hits = 0;
  for (let t = 0; t < seconds; t += DT) {
    updateEnemies(enemies, boat, DT, grid, 16);
    stepSummons(enemies, DT, makeSeededRng(1));
    updateEnemyGuns(enemies, boat, DT, { grid, tileSize: 16 }, shots, makeSeededRng(2));
    hits += stepEnemyProjectiles(shots, boat, 11, DT, { grid, tileSize: 16 }).hits.length;
  }
  return { hits, shots };
}

test('stage 1 is ships only and every one of them is countered by Cannonballs', () => {
  for (const pool of STAGES[0].pools) for (const id of pool) {
    const d = getEnemy(id);
    assert.ok(d.gun || d.explodes, `${d.name} should shoot back (or ram, the fire ship)`);
    assert.equal(d.counter, 'cannonballs');
  }
  assert.equal(bossForStage(1), ENEMY_IDS.PIRATE_FLAGSHIP);
});

test('monsters arrive in later stages, and each stage has a different boss', () => {
  const s1 = new Set(STAGES[0].pools.flat());
  assert.ok(!s1.has(ENEMY_IDS.REEF_SHARK) && !s1.has(ENEMY_IDS.GULLSWARM_HARPY));
  assert.ok(STAGES[1].pools.flat().includes(ENEMY_IDS.REEF_SHARK));
  assert.ok(STAGES[2].pools.flat().includes(ENEMY_IDS.SEA_SERPENT));
  assert.equal(new Set([1, 2, 3].map(bossForStage)).size, 3);
  assert.ok(bossForStage(7));
});

test('stages past the table scale enemy hull and damage', () => {
  assert.deepEqual(stageScaling(1), { health: 1, damage: 1 });
  const s6 = stageScaling(STAGES.length + 2);
  assert.ok(s6.health > 1.3 && s6.damage > 1.1);
  const e = createEnemy(ENEMY_IDS.PIRATE_CUTTER, 0, 0, Math.random, { scale: s6 });
  assert.ok(e.maxHealth > getEnemy(ENEMY_IDS.PIRATE_CUTTER).maxHealth);
});

test('a level only offers weapon caches its enemies need', () => {
  const run = createRun(11, undefined, { stage: 1 });
  assert.equal(run.pickups.filter((p) => p.kind === PICKUP_KINDS.WEAPON_CACHE).length, 0, 'stage 1 is all Cannonballs');
  const run2 = createRun(11, undefined, { stage: 2 });
  const caches = run2.pickups.filter((p) => p.kind === PICKUP_KINDS.WEAPON_CACHE).map((p) => p.weaponId);
  assert.ok(caches.includes('grapeshot'), 'sharks → Grapeshot');
});

test('a Pirate Cutter keeps its distance and lands aimed shots on a sitting target', () => {
  const boat = { x: 600, y: 600, vx: 0, vy: 0, heading: 0, health: 1000, maxHull: 1000 };
  const e = createEnemy(ENEMY_IDS.PIRATE_CUTTER, 700, 600, makeSeededRng(3)); wakeEnemy(e);
  const { hits } = sim(e, boat, 12);
  const d = Math.hypot(e.x - boat.x, e.y - boat.y);
  assert.ok(d > 80 && d < 175, `holds range (${d.toFixed(0)}px)`);
  assert.ok(hits >= 2, `hits a still boat (${hits})`);
  assert.ok(boat.health < 1000);
});

test('enemy shots can be dodged: a boat moving across the line of fire takes few hits', () => {
  const boat = { x: 600, y: 600, vx: 0, vy: 0, heading: 0, health: 1000, maxHull: 1000 };
  const e = createEnemy(ENEMY_IDS.PIRATE_CUTTER, 600, 480, makeSeededRng(4)); wakeEnemy(e);
  const shots = []; let hits = 0; const grid = open();
  for (let t = 0; t < 12; t += DT) {
    // Weave: reverse direction every 0.9s (a player steering out of the lane).
    const dir = Math.floor(t / 0.9) % 2 ? -1 : 1;
    boat.vx = dir * 110; boat.x += boat.vx * DT;
    updateEnemies([e], boat, DT, grid, 16);
    updateEnemyGuns([e], boat, DT, { grid, tileSize: 16 }, shots, makeSeededRng(5));
    hits += stepEnemyProjectiles(shots, boat, 11, DT, { grid, tileSize: 16 }).hits.length;
  }
  const still = { x: 600, y: 600, vx: 0, vy: 0, heading: 0, health: 1000, maxHull: 1000 };
  const e2 = createEnemy(ENEMY_IDS.PIRATE_CUTTER, 600, 480, makeSeededRng(4)); wakeEnemy(e2);
  const stillHits = sim(e2, still, 12).hits;
  assert.ok(hits < stillHits, `weaving (${hits}) beats sitting still (${stillHits})`);
});

test('a Pirate Brig fires its broadside off the side facing the boat', () => {
  const boat = { x: 600, y: 600, vx: 0, vy: 0, heading: 0, health: 1000, maxHull: 1000 };
  const e = createEnemy(ENEMY_IDS.PIRATE_BRIG, 710, 600, makeSeededRng(6)); wakeEnemy(e);
  const shots = [];
  const grid = open();
  let volley = null;
  for (let t = 0; t < 12 && !volley; t += DT) {
    updateEnemies([e], boat, DT, grid, 16);
    const before = shots.length;
    updateEnemyGuns([e], boat, DT, { grid, tileSize: 16 }, shots, makeSeededRng(7));
    if (shots.length > before) volley = shots.slice(before);
  }
  assert.ok(volley && volley.length === 3, 'three-ball broadside');
  for (const s of volley) {
    const toBoat = Math.atan2(boat.y - s.y, boat.x - s.x);
    const dir = Math.atan2(s.vy, s.vx);
    let diff = Math.abs(toBoat - dir); if (diff > Math.PI) diff = 2 * Math.PI - diff;
    assert.ok(diff < 1.0, 'fired toward the boat side');
  }
});

test('a Reef Shark telegraphs, charges, and stuns itself on the shore', () => {
  const grid = open();
  for (let y = 0; y < N; y++) for (let x = 0; x < 20; x++) grid.tiles[y][x] = 1; // land to the west
  // Boat just off the western shore, shark to the east about to charge:
  // the charge runs past the boat and into the land.
  const boat = { x: 360, y: 600, vx: 0, vy: 0, heading: 0, health: 1000 };
  const e = createEnemy(ENEMY_IDS.REEF_SHARK, 470, 600, makeSeededRng(8)); wakeEnemy(e);
  e.sharkTimer = 0;
  const seen = [];
  for (let t = 0; t < 20; t += DT) {
    updateEnemy(e, boat, DT, grid, 16);
    if (seen[seen.length - 1] !== e.sharkState) seen.push(e.sharkState);
  }
  const iW = seen.indexOf('windup'); const iC = seen.indexOf('charging');
  assert.ok(iW >= 0 && iC === iW + 1, `windup precedes every charge: ${seen.join('>')}`);
  assert.ok(seen.includes('stunned'), 'a charge into the shore stuns it');
});

test('a Sea Serpent is untouchable under water and spits once per surfacing', () => {
  const boat = { x: 600, y: 600, vx: 0, vy: 0, heading: 0, health: 1000 };
  const e = createEnemy(ENEMY_IDS.SEA_SERPENT, 700, 600, makeSeededRng(9)); wakeEnemy(e);
  assert.equal(e.invulnerable, true);
  const shots = []; const grid = open(); let surfacings = 0; let volleys = 0; let prev = e.submergedState;
  for (let t = 0; t < 20; t += DT) {
    updateEnemy(e, boat, DT, grid, 16);
    if (prev !== 'surfaced' && e.submergedState === 'surfaced') surfacings++;
    prev = e.submergedState;
    volleys += updateEnemyGuns([e], boat, DT, { grid, tileSize: 16 }, shots, makeSeededRng(10));
    if (e.submergedState === 'submerged') assert.equal(e.invulnerable, true);
  }
  assert.ok(surfacings >= 3);
  assert.ok(volleys >= surfacings - 1 && volleys <= surfacings, `${volleys} volleys over ${surfacings} surfacings`);
});

test('the Black Gale calls in cutters during its chase phase, never more than its cap', () => {
  const boat = { x: 600, y: 600, vx: 0, vy: 0, heading: 0, health: 1e6 };
  const boss = createEnemy(ENEMY_IDS.PIRATE_FLAGSHIP, 700, 600, makeSeededRng(11)); wakeEnemy(boss);
  const enemies = [boss];
  sim(enemies, boat, 60);
  const summoned = enemies.filter((e) => e.summonedBy === boss.id);
  assert.ok(summoned.length >= 2, 'reinforcements arrive');
  assert.ok(summoned.filter((e) => e.health > 0).length <= 4);
  assert.ok(summoned.every((e) => e.defId === ENEMY_IDS.PIRATE_CUTTER && e.aggro));
});

// Each stage boss dies to its counters in a pinned duel (weapon output,
// not positioning), inside two minutes.
for (const bossId of [ENEMY_IDS.PIRATE_FLAGSHIP, ENEMY_IDS.BLOODFIN_MATRIARCH, ENEMY_IDS.FROST_LEVIATHAN, ENEMY_IDS.DROWNED_ADMIRAL]) {
  test(`${getEnemy(bossId).name} can be sunk with its counter weapons`, () => {
    const s = createWeaponState();
    for (const w of ['grapeshot', 'chain_shot', 'depth_charges', 'flame_barrels']) collectWeaponCache(s, w, 999);
    const boat = { x: 400, y: 400, vx: 0, vy: 0, heading: 0, health: 1e6 };
    const boss = createEnemy(bossId, 460, 400, makeSeededRng(12)); wakeEnemy(boss);
    const pin = { x: boss.x, y: boss.y };
    let t = 0;
    while (boss.health > 0 && t < 120) {
      updateEnemy(boss, boat, DT, open(), 16);
      boss.x = pin.x; boss.y = pin.y;
      setActiveWeapon(s, currentCounter(boss));
      s.ammo[currentCounter(boss)] = 999;
      tryFire(s, 400, 400, 0, () => 0.5);
      stepCombat(s, DT, open(), 16, [boss]);
      resolveHits(s, [boss], currentCounter);
      cleanupProjectiles(s);
      stepBurn(boss, DT);
      t += DT;
    }
    assert.ok(boss.health <= 0, `${getEnemy(bossId).name} survived ${t.toFixed(0)}s at ${boss.health.toFixed(0)} hp`);
  });
}

test('fire ship: lights up, then rams; reaching you blows it up, sunk by you it burns its neighbours', async () => {
  const { createEnemy, updateEnemies, resolveEnemyContactEvents, fireShipBlast } = await import('../src/engine/enemies.mjs');
  const { createBoat } = await import('../src/engine/boat.mjs');
  const W = 60; const grid = { width: W, height: W, tiles: Array.from({ length: W }, () => Array(W).fill(0)) };
  const boat = createBoat(400, 400, 0);
  const f = createEnemy(ENEMY_IDS.FIRE_SHIP, 520, 400); f.aggro = true;
  updateEnemies([f], boat, 0.3, grid, 16);
  assert.ok(!f.kindled, 'kindles before charging');
  const d0 = Math.hypot(f.x - boat.x, f.y - boat.y);
  for (let i = 0; i < 60 * 3; i++) updateEnemies([f], boat, 1 / 60, grid, 16);
  assert.ok(f.kindled);
  assert.ok(Math.hypot(f.x - boat.x, f.y - boat.y) < d0 - 60, 'charges at the boat');
  f.x = boat.x + 12; f.y = boat.y;
  const hp = boat.health;
  const ev = resolveEnemyContactEvents([f], boat, 11);
  assert.equal(ev.length, 1);
  assert.ok(boat.health <= hp - 20 && f.health === 0 && f.detonated && f.salvageDrop === 0);
  // Sunk at range: its blast damages nearby enemies, never the boat.
  const g = createEnemy(ENEMY_IDS.FIRE_SHIP, 700, 700); const c = createEnemy(ENEMY_IDS.PIRATE_CUTTER, 740, 700);
  const far = createEnemy(ENEMY_IDS.PIRATE_CUTTER, 900, 700);
  g.health = 0;
  const blast = fireShipBlast(g, [g, c, far]);
  assert.equal(blast.length, 1);
  assert.ok(c.health < c.maxHealth && far.health === far.maxHealth);
  assert.deepEqual(fireShipBlast(g, [g, c, far]), [], 'only blows once');
});

test('mortar gunboat: its shell lands on the marked spot, hits only if you stay there', async () => {
  const { createEnemy } = await import('../src/engine/enemies.mjs');
  const { updateEnemyGuns, stepEnemyProjectiles } = await import('../src/engine/enemyGuns.mjs');
  const { createBoat } = await import('../src/engine/boat.mjs');
  const W = 60; const grid = { width: W, height: W, tiles: Array.from({ length: W }, () => Array(W).fill(0)) };
  for (const stay of [true, false]) {
    const boat = createBoat(400, 400, 0);
    const m = createEnemy(ENEMY_IDS.MORTAR_BOAT, 560, 400); m.aggro = true; m.gunTimer = 0;
    const shots = []; let hits = 0;
    for (let i = 0; i < 60 * 3 && !shots.some((s) => s.lob) ; i++) updateEnemyGuns([m], boat, 1 / 60, { grid, tileSize: 16 }, shots);
    const shell = shots.find((s) => s.lob);
    assert.ok(shell, 'fires a shell');
    assert.ok(Math.hypot(shell.tx - boat.x, shell.ty - boat.y) < 5, 'aims at a still boat');
    if (!stay) { boat.x += 120; }
    for (let i = 0; i < 60 * 2; i++) hits += stepEnemyProjectiles(shots, boat, 11, 1 / 60, { grid, tileSize: 16 }).hits.length;
    assert.equal(hits, stay ? 1 : 0);
  }
});
