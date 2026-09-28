import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnemy, spawnReefEnemies, updateEnemy, updateEnemies,
  resolveEnemyContact, currentCounter, factionMultiplierFor, incomingMultiplierFor, resolveEnemyContactEvents,
} from '../src/engine/enemies.mjs';
import { ENEMY_IDS, ARCHETYPES, getEnemy, spawnPoolForReefIndex } from '../src/data/enemies.mjs';
import { createBoat } from '../src/engine/boat.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

function openGrid(width = 40, height = 40) {
  const tiles = Array.from({ length: height }, () => Array(width).fill(0));
  return { width, height, tiles };
}

test('createEnemy sets health, counter and archetype from its data definition', () => {
  const def = getEnemy(ENEMY_IDS.IRONCLAD_BRIGAND);
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 5, 5);
  assert.equal(enemy.health, def.maxHealth);
  assert.equal(enemy.maxHealth, def.maxHealth);
  assert.equal(currentCounter(enemy), def.counter);
  assert.equal(enemy.archetype, ARCHETYPES.TANK);
});

test('a submerged enemy starts invulnerable', () => {
  const crawler = createEnemy(ENEMY_IDS.DEEP_CRAWLER, 0, 0);
  assert.equal(crawler.invulnerable, true);
});

test('a boss starts on phase 0 with that phase\'s counter and archetype', () => {
  const def = getEnemy(ENEMY_IDS.KRAKENS_ANCHOR);
  const boss = createEnemy(ENEMY_IDS.KRAKENS_ANCHOR, 0, 0);
  assert.equal(boss.counter, def.phases[0].counter);
  assert.equal(boss.archetype, def.phases[0].archetype);
});

// Regression test (balance pass, 2026-09-28): a boss whose phase-0
// archetype is SUBMERGED must get the same submerge/surface state machine
// a regular SUBMERGED enemy gets — createEnemy previously only did that
// init when `def.archetype` (the boss's top-level, mostly-cosmetic label)
// was SUBMERGED, which for the Kraken's Anchor is TANK, not its actual
// phase-0 archetype. The boss silently spawned with invulnerable=false
// and no submerged state/timer at all, so Depth Charges (its supposed
// phase-0 counter) never actually mattered — it was just always
// vulnerable to everything from the first frame.
test('a boss whose phase-0 archetype is SUBMERGED starts invulnerable with a real submerge timer', () => {
  const boss = createEnemy(ENEMY_IDS.KRAKENS_ANCHOR, 0, 0);
  assert.equal(boss.invulnerable, true);
  assert.equal(boss.submergedState, 'submerged');
  assert.ok(Number.isFinite(boss.submergedTimer) && boss.submergedTimer > 0);
});

// Regression test: without resetting the submerge state machine on every
// entry into a SUBMERGED phase (not just the first), a boss fight lasting
// long enough to loop back through phase 0 a second time would go
// invulnerable via updateBossPhase's flag flip but never surface again —
// updateSubmerged's own timer/state were never re-primed, so it could
// never reach the `submergedTimer <= 0` branch that toggles it back off.
test('a boss surfaces and re-submerges correctly across a full phase loop, never getting stuck invulnerable', () => {
  const boat = createBoat(400, 0, 0);
  const grid = openGrid();
  const boss = createEnemy(ENEMY_IDS.KRAKENS_ANCHOR, 0, 0);
  let sawVulnerableInPhase0Again = false;
  // Run well past 2 full phase cycles (2 * (14 + 14) = 56s) at 30fps.
  for (let i = 0; i < 30 * 70; i++) {
    updateEnemy(boss, boat, 1 / 30, grid, 16);
    if (boss.phaseIndex === 0 && !boss.invulnerable) sawVulnerableInPhase0Again = true;
  }
  assert.ok(sawVulnerableInPhase0Again, 'the boss should surface (become vulnerable) again after looping back into phase 0');
});

test('spawnReefEnemies only places enemies on open water tiles, away from the boat spawn', () => {
  const rng = makeSeededRng(42);
  const grid = openGrid();
  // Block off a ring so open tiles are a known subset.
  for (let x = 0; x < grid.width; x++) { grid.tiles[0][x] = 1; grid.tiles[grid.height - 1][x] = 1; }
  const boatSpawn = { x: 8 * 16, y: 8 * 16 };
  const exitWorld = { x: 30 * 16, y: 30 * 16 };
  const enemies = spawnReefEnemies(
    [ENEMY_IDS.IRONCLAD_BRIGAND], grid, 16, boatSpawn, exitWorld, 5, rng
  );
  assert.ok(enemies.length > 0, 'should have placed at least some enemies');
  for (const enemy of enemies) {
    const tx = Math.floor(enemy.x / 16);
    const ty = Math.floor(enemy.y / 16);
    assert.equal(grid.tiles[ty][tx], 0, 'enemy should be on open water');
    const dist = Math.hypot(enemy.x - boatSpawn.x, enemy.y - boatSpawn.y);
    assert.ok(dist >= 16 * 3, 'enemy should be spawned away from the boat');
  }
});

test('a Reef Skimmer pick spawns its whole pack at once', () => {
  const rng = makeSeededRng(7);
  const grid = openGrid();
  const boatSpawn = { x: 5 * 16, y: 5 * 16 };
  const exitWorld = { x: 30 * 16, y: 30 * 16 };
  const enemies = spawnReefEnemies([ENEMY_IDS.REEF_SKIMMER], grid, 16, boatSpawn, exitWorld, 3, rng);
  assert.ok(enemies.length >= 3, 'a skimmer pack should not spawn a single lone skimmer');
  for (const e of enemies) assert.equal(e.defId, ENEMY_IDS.REEF_SKIMMER);
});

test('spawnPoolForReefIndex includes the Kraken\'s Anchor only on the final reef (chance-based, not guaranteed elsewhere)', () => {
  assert.ok(!spawnPoolForReefIndex(0).includes(ENEMY_IDS.KRAKENS_ANCHOR));
  assert.ok(!spawnPoolForReefIndex(1).includes(ENEMY_IDS.KRAKENS_ANCHOR));
  assert.ok(spawnPoolForReefIndex(2).includes(ENEMY_IDS.KRAKENS_ANCHOR));
});

test('a boss pick from the spawn pool is placed guarding the exit, not hidden in the maze', () => {
  const rng = makeSeededRng(3);
  const grid = openGrid();
  const boatSpawn = { x: 5 * 16, y: 5 * 16 };
  const exitWorld = { x: 30 * 16, y: 30 * 16 };
  // A pool of only the boss forces every draw to hit it.
  const enemies = spawnReefEnemies([ENEMY_IDS.KRAKENS_ANCHOR], grid, 16, boatSpawn, exitWorld, 5, rng);
  assert.equal(enemies.length, 1, 'only one boss should ever be placed per reef, even with repeated draws');
  const boss = enemies[0];
  assert.equal(boss.defId, ENEMY_IDS.KRAKENS_ANCHOR);
  const distFromExit = Math.hypot(boss.x - exitWorld.x, boss.y - exitWorld.y);
  assert.ok(distFromExit < 16 * 2, 'the boss should spawn right at/near the exit, not away from it like regular enemies');
});

test('spawnReefEnemies places at most one boss even in a mixed pool with several other picks', () => {
  const rng = makeSeededRng(11);
  const grid = openGrid();
  const boatSpawn = { x: 5 * 16, y: 5 * 16 };
  const exitWorld = { x: 30 * 16, y: 30 * 16 };
  const pool = spawnPoolForReefIndex(2); // includes the boss alongside 5 regular enemies
  const enemies = spawnReefEnemies(pool, grid, 16, boatSpawn, exitWorld, 20, rng);
  const bossCount = enemies.filter((e) => e.defId === ENEMY_IDS.KRAKENS_ANCHOR).length;
  assert.ok(bossCount <= 1, `expected at most one boss, got ${bossCount}`);
});

test('SWARM archetype closes distance on the boat when far away', () => {
  const enemy = createEnemy(ENEMY_IDS.REEF_SKIMMER, 0, 0);
  const boat = createBoat(300, 0, 0);
  const grid = openGrid();
  const startDist = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
  for (let i = 0; i < 30; i++) updateEnemy(enemy, boat, 1 / 30, grid, 16);
  const endDist = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
  assert.ok(endDist < startDist, 'a swarm enemy should close in on a distant boat');
});

test('TANK archetype respects tile collision and does not pass through a wall', () => {
  const tileSize = 16;
  const wallTx = 5;
  const grid = openGrid();
  for (let y = 0; y < grid.height; y++) grid.tiles[y][wallTx] = 1;
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, (wallTx - 3) * tileSize, 5 * tileSize);
  const boat = createBoat((wallTx + 5) * tileSize, 5 * tileSize, 0); // boat on the far side of the wall
  for (let i = 0; i < 300; i++) updateEnemy(enemy, boat, 1 / 30, grid, tileSize);
  assert.ok(enemy.x < wallTx * tileSize, 'a tank enemy should be stopped by the wall, never pass through it');
});

test('FLYER archetype ignores tile collision (can fly over rock the boat cannot reach)', () => {
  const tileSize = 16;
  const grid = openGrid();
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) grid.tiles[y][x] = 1; // solid everywhere
  const harpy = createEnemy(ENEMY_IDS.GULLSWARM_HARPY, 5 * tileSize, 5 * tileSize);
  const boat = createBoat(20 * tileSize, 5 * tileSize, 0);
  assert.doesNotThrow(() => {
    for (let i = 0; i < 30; i++) updateEnemy(harpy, boat, 1 / 30, grid, tileSize);
  });
  // No collision resolution should have been applied — a flyer is free to
  // occupy the same tiles as solid rock.
});

test('SUBMERGED archetype alternates between invulnerable-submerged and vulnerable-surfaced', () => {
  const crawler = createEnemy(ENEMY_IDS.DEEP_CRAWLER, 0, 0);
  const boat = createBoat(200, 0, 0);
  const grid = openGrid();
  assert.equal(crawler.invulnerable, true);
  let becameVulnerable = false;
  for (let i = 0; i < 600; i++) {
    updateEnemy(crawler, boat, 1 / 30, grid, 16);
    if (!crawler.invulnerable) { becameVulnerable = true; break; }
  }
  assert.ok(becameVulnerable, 'a Deep Crawler should eventually surface and become vulnerable');
});

test('resolveEnemyContact damages the boat on contact and then cools down', () => {
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 0, 0);
  const boat = createBoat(0, 0, 0); // overlapping
  const startHealth = boat.health;
  const dmg = resolveEnemyContact(enemy, boat, 11);
  assert.ok(dmg > 0);
  assert.equal(boat.health, startHealth - dmg);
  // Still overlapping, but on cooldown — should not deal damage again immediately.
  const secondDmg = resolveEnemyContact(enemy, boat, 11);
  assert.equal(secondDmg, 0);
});

test('a Rigger contact jams the boat\'s turning briefly', () => {
  const rigger = createEnemy(ENEMY_IDS.RIGGER, 0, 0);
  const boat = createBoat(0, 0, 0);
  resolveEnemyContact(rigger, boat, 11);
  assert.ok(boat.turnJamRemaining > 0, 'a rigger hit should jam the boat\'s turning');
});

test('updateEnemies is a no-op on a dead enemy', () => {
  const enemy = createEnemy(ENEMY_IDS.REEF_SKIMMER, 0, 0);
  enemy.health = 0;
  const boat = createBoat(300, 0, 0);
  const grid = openGrid();
  updateEnemies([enemy], boat, 1 / 30, grid, 16);
  assert.equal(enemy.x, 0);
  assert.equal(enemy.y, 0);
});

// --- Post-slice combat triangle: enemy faction tagging ------------------

test('createEnemy carries its data definition\'s faction onto the instance, null for the boss', () => {
  const skimmer = createEnemy(ENEMY_IDS.REEF_SKIMMER, 0, 0);
  assert.equal(skimmer.faction, 'reavers');
  const boss = createEnemy(ENEMY_IDS.KRAKENS_ANCHOR, 0, 0);
  assert.equal(boss.faction, null, 'the boss is deliberately faction-less — never triangle-affected');
});

test('factionMultiplierFor builds a getFactionMultiplier callback matching triangleMultiplier', () => {
  const skimmer = createEnemy(ENEMY_IDS.REEF_SKIMMER, 0, 0); // reavers
  const brigand = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 0, 0); // iron_accord
  const boss = createEnemy(ENEMY_IDS.KRAKENS_ANCHOR, 0, 0); // no faction

  const asReavers = factionMultiplierFor('reavers');
  assert.equal(asReavers(brigand), 1.3, 'reavers beat iron accord');
  assert.equal(asReavers(skimmer), 1, 'mirror match, no bonus');
  assert.equal(asReavers(boss), 1, 'the boss is never triangle-affected');

  const unaligned = factionMultiplierFor(null);
  assert.equal(unaligned(brigand), 1, 'no player faction chosen means no triangle effect at all');
});

// --- Incoming triangle on contact damage (2026-09-28) --------------------

test('resolveEnemyContact scales contact damage by the incoming multiplier', () => {
  const harpy = createEnemy(ENEMY_IDS.GULLSWARM_HARPY, 0, 0);
  const boat = createBoat(0, 0, 0);
  const before = boat.health;
  const dmg = resolveEnemyContact(harpy, boat, 11, () => 1.3);
  assert.equal(dmg, getEnemy(ENEMY_IDS.GULLSWARM_HARPY).contactDamage * 1.3);
  assert.equal(boat.health, before - dmg);
});

test('incomingMultiplierFor: predator enemies hit harder, prey softer, boss and unaligned unaffected', () => {
  const harpy = createEnemy(ENEMY_IDS.GULLSWARM_HARPY, 0, 0); // wyrdtide
  const brigand = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 0, 0); // iron_accord
  const boss = createEnemy(ENEMY_IDS.KRAKENS_ANCHOR, 0, 0);
  const asReavers = incomingMultiplierFor('reavers'); // beaten by wyrdtide, beats iron_accord
  assert.ok(asReavers(harpy) > 1);
  assert.ok(asReavers(brigand) < 1);
  assert.equal(asReavers(boss), 1);
  assert.equal(incomingMultiplierFor(null)(harpy), 1);
});

test('resolveEnemyContactEvents reports one event per contact hit with its real (scaled) damage', () => {
  const boat = createBoat(0, 0, 0);
  const a = createEnemy(ENEMY_IDS.GULLSWARM_HARPY, 0, 0);
  const b = createEnemy(ENEMY_IDS.REEF_SKIMMER, 500, 500); // out of range
  const events = resolveEnemyContactEvents([a, b], boat, 11, () => 0.9);
  assert.equal(events.length, 1);
  assert.equal(events[0].enemy, a);
  assert.equal(events[0].damage, getEnemy(ENEMY_IDS.GULLSWARM_HARPY).contactDamage * 0.9);
});

test('Iron Accord (Brigands) appear from reef 2, not only reef 3 — every faction is present by mid-voyage', () => {
  assert.ok(spawnPoolForReefIndex(1).includes(ENEMY_IDS.IRONCLAD_BRIGAND));
  const factionsByReef2 = new Set([...spawnPoolForReefIndex(0), ...spawnPoolForReefIndex(1)].map((id) => getEnemy(id).faction).filter(Boolean));
  assert.equal(factionsByReef2.size, 3);
});

test('spawnPoolForReefIndex returns a copy — callers cannot corrupt the shared pool', () => {
  const pool = spawnPoolForReefIndex(0);
  pool.push(ENEMY_IDS.KRAKENS_ANCHOR);
  assert.ok(!spawnPoolForReefIndex(0).includes(ENEMY_IDS.KRAKENS_ANCHOR));
});
