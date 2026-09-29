// Glacial + Shipwreck rosters and their bosses (2026-09-29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, updateEnemies, resolveEnemyContactEvents, isHittable, passesOverLand } from '../src/engine/enemies.mjs';
import { updateEnemyGuns, stepEnemyProjectiles } from '../src/engine/enemyGuns.mjs';
import { createBoat, stepBoat, statusTuning, tickBoatStatus, DEFAULT_BOAT_TUNING, CHILL } from '../src/engine/boat.mjs';
import { ENEMY_IDS, getEnemy } from '../src/data/enemies.mjs';
import { STAGES, bossForStage } from '../src/data/stages.mjs';
import { createRun, checkReachedExit } from '../src/engine/run.mjs';
import { PICKUP_KINDS } from '../src/data/pickups.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

const DT = 1 / 60;
const W = 80;
const openGrid = () => ({ width: W, height: W, tiles: Array.from({ length: W }, () => Array(W).fill(0)) });

test('stage 3 is the glacial roster, stage 4 the shipwreck roster, each with its own boss', () => {
  const s3 = new Set(STAGES[2].pools.flat()); const s4 = new Set(STAGES[3].pools.flat());
  for (const id of [ENEMY_IDS.FROST_NARWHAL, ENEMY_IDS.ICE_GOLEM, ENEMY_IDS.FROST_WISP]) assert.ok(s3.has(id), id);
  for (const id of [ENEMY_IDS.GHOST_SHIP, ENEMY_IDS.DROWNED_SKIFF, ENEMY_IDS.SIREN]) assert.ok(s4.has(id), id);
  assert.equal(bossForStage(3), ENEMY_IDS.FROST_LEVIATHAN);
  assert.equal(bossForStage(4), ENEMY_IDS.DROWNED_ADMIRAL);
  const later = new Set([5, 6, 7, 8, 9].map(bossForStage));
  assert.equal(later.size, 5, 'stages past the table rotate through all five bosses');
});

test('the new bosses sit in their lairs, with caches for every weapon they need', () => {
  for (const stage of [3, 4]) {
    const run = createRun(21, undefined, { stage });
    while (run.reefIndex < 4) {
      Object.assign(run.boat, { x: run.exitWorld.x, y: run.exitWorld.y });
      assert.equal(checkReachedExit(run), 'advanced');
    }
    const boss = run.enemies.find((e) => e.isBoss);
    assert.equal(boss.defId, bossForStage(stage));
    assert.ok(Math.hypot(boss.x - run.lair.centre.x, boss.y - run.lair.centre.y) < 40);
    const caches = new Set(run.pickups.filter((p) => p.kind === PICKUP_KINDS.WEAPON_CACHE).map((p) => p.weaponId));
    for (const ph of getEnemy(boss.defId).phases) if (ph.counter !== 'cannonballs') assert.ok(caches.has(ph.counter), `${stage}: ${ph.counter}`);
  }
});

test('ghost ship: fades out (untouchable, passes through rock, holds fire) then returns solid over water', () => {
  const grid = openGrid();
  // A wall of rock between the ghost and the boat.
  for (let y = 0; y < W; y++) for (let x = 30; x < 34; x++) grid.tiles[y][x] = 1;
  const boat = createBoat(40 * 16, 40 * 16, 0);
  const g = createEnemy(ENEMY_IDS.GHOST_SHIP, 22 * 16, 40 * 16, makeSeededRng(3)); g.aggro = true;
  let sawPhased = false; let crossed = false; let solidInRock = false;
  const shots = [];
  for (let t = 0; t < 25; t += DT) {
    updateEnemies([g], boat, DT, grid, 16);
    updateEnemyGuns([g], boat, DT, { grid, tileSize: 16 }, shots, makeSeededRng(4));
    if (g.phased) {
      sawPhased = true;
      assert.ok(!isHittable(g), 'untouchable while faded');
      assert.equal(g.gunWindup || 0, 0, 'no shooting while faded');
      assert.ok(passesOverLand(g));
    } else {
      const tx = Math.floor(g.x / 16); const ty = Math.floor(g.y / 16);
      if (grid.tiles[ty]?.[tx] === 1) solidInRock = true;
    }
    if (g.x > 34 * 16) crossed = true;
  }
  assert.ok(sawPhased, 'it fades');
  assert.ok(crossed, 'it crossed the rock wall while faded');
  assert.ok(!solidInRock, 'never turns solid inside rock');
  // Contact does nothing while faded.
  g.phased = true; g.x = boat.x + 5; g.y = boat.y; g.contactCooldownRemaining = 0;
  assert.equal(resolveEnemyContactEvents([g], boat, 11).length, 0);
});

test('siren: her song drags an idle ship in, but full sail away escapes', () => {
  const grid = openGrid();
  const idle = createBoat(400, 400, 0);
  const s = createEnemy(ENEMY_IDS.SIREN, 560, 400); s.aggro = true;
  for (let t = 0; t < 2.5; t += DT) {
    updateEnemies([s], idle, DT, grid, 16);
    stepBoat(idle, { x: 0, y: 0 }, DT); idle.x += idle.vx * DT; idle.y += idle.vy * DT;
  }
  assert.ok(s.singing);
  assert.ok(idle.x > 440, `pulled in: ${idle.x.toFixed(0)}`);
  assert.equal(s.x, 560, 'she never moves');
  const fleeing = createBoat(470, 400, Math.PI);
  const s2 = createEnemy(ENEMY_IDS.SIREN, 560, 400); s2.aggro = true;
  for (let t = 0; t < 4; t += DT) {
    updateEnemies([s2], fleeing, DT, grid, 16);
    stepBoat(fleeing, { x: -1, y: 0 }, DT); fleeing.x += fleeing.vx * DT; fleeing.y += fleeing.vy * DT;
  }
  assert.ok(fleeing.x < 340, `escaped: ${fleeing.x.toFixed(0)}`);
  // A rock between you and her blocks the song.
  const walled = openGrid();
  for (let y = 0; y < W; y++) for (let x = 30; x < 32; x++) walled.tiles[y][x] = 1;
  const b3 = createBoat(26 * 16, 400, 0);
  const s3 = createEnemy(ENEMY_IDS.SIREN, 36 * 16, 400); s3.aggro = true;
  updateEnemies([s3], b3, DT, walled, 16);
  assert.ok(!s3.singing && b3.vx === 0);
});

test('frost: shots and the narwhal tusk chill your ship — slower and stiffer, then it wears off', () => {
  const grid = openGrid();
  const boat = createBoat(400, 400, 0);
  const w = createEnemy(ENEMY_IDS.FROST_WISP, 520, 400); w.aggro = true; w.gunTimer = 0;
  const shots = []; let hit = false;
  for (let t = 0; t < 6 && !hit; t += DT) {
    updateEnemyGuns([w], boat, DT, { grid, tileSize: 16 }, shots, makeSeededRng(5));
    hit = stepEnemyProjectiles(shots, boat, 11, DT, { grid, tileSize: 16 }).hits.length > 0;
  }
  assert.ok(hit && boat.chillRemaining > 1, 'frost bolt chills');
  const tn = statusTuning(DEFAULT_BOAT_TUNING, boat);
  assert.ok(tn.turnRate < DEFAULT_BOAT_TUNING.turnRate * 0.7 && tn.maxSpeed === DEFAULT_BOAT_TUNING.maxSpeed * CHILL.speed);
  for (let t = 0; t < 3; t += DT) tickBoatStatus(boat, DT);
  assert.equal(boat.chillRemaining, 0);
  assert.equal(statusTuning(DEFAULT_BOAT_TUNING, boat), DEFAULT_BOAT_TUNING);
  const n = createEnemy(ENEMY_IDS.FROST_NARWHAL, 405, 400);
  resolveEnemyContactEvents([n], boat, 11);
  assert.ok(boat.chillRemaining >= 2);
});

test('frost wisps fly over land; ice golems slam out a ring of shards', () => {
  const grid = openGrid();
  for (let y = 0; y < W; y++) for (let x = 30; x < 34; x++) grid.tiles[y][x] = 1;
  const boat = createBoat(40 * 16, 40 * 16, 0);
  const w = createEnemy(ENEMY_IDS.FROST_WISP, 25 * 16, 40 * 16); w.aggro = true;
  for (let t = 0; t < 8; t += DT) updateEnemies([w], boat, DT, grid, 16);
  assert.ok(w.x > 34 * 16 - 40, 'crossed the rock');
  const gol = createEnemy(ENEMY_IDS.ICE_GOLEM, 400, 400); gol.aggro = true; gol.gunTimer = 0;
  const b2 = createBoat(500, 400, 0);
  const shots = [];
  for (let t = 0; t < 3 && !shots.length; t += DT) updateEnemyGuns([gol], b2, DT, { grid: openGrid(), tileSize: 16 }, shots);
  assert.equal(shots.length, 8);
  assert.ok(shots.every((s) => s.chill > 0));
});

test('drowned skiffs come in packs; Drowned Admiral phases then turns solid and calls his crew', async () => {
  const { stepSummons } = await import('../src/engine/enemies.mjs');
  const grid = openGrid();
  const boat = { ...createBoat(400, 400, 0), health: 1e6, maxHull: 1e6 };
  const a = createEnemy(ENEMY_IDS.DROWNED_ADMIRAL, 520, 400, makeSeededRng(8)); a.aggro = true;
  const enemies = [a];
  let phased = false; let solidPhase2 = false;
  for (let t = 0; t < 40; t += DT) {
    updateEnemies(enemies, boat, DT, grid, 16);
    stepSummons(enemies, DT, makeSeededRng(9));
    if (a.phased) phased = true;
    if (a.phaseIndex === 1 && !a.phased && isHittable(a)) solidPhase2 = true;
  }
  assert.ok(phased && solidPhase2);
  assert.ok(enemies.some((e) => e.defId === ENEMY_IDS.DROWNED_SKIFF));
});

test('every new level of stages 3-4 builds, and spawns only its own roster', () => {
  for (const stage of [3, 4]) {
    const run = createRun(77, undefined, { stage });
    const pool = new Set(STAGES[stage - 1].pools[0]);
    assert.ok(run.enemies.length > 0);
    for (const e of run.enemies) assert.ok(pool.has(e.defId) || e.elite || e.defId === ENEMY_IDS.WARDING_SEAL, e.defId);
    assert.ok(run.pickups.every((p) => p.kind !== PICKUP_KINDS.WEAPON_CACHE || typeof p.weaponId === 'string'));
  }
});
