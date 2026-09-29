import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, checkSunk, retryLevel, checkReachedExit, addSalvage, BASELINE_LOADOUT } from '../src/engine/run.mjs';
import { collectPickups, makeRepairKit, spawnReefPickups } from '../src/engine/pickups.mjs';
import { collectWeaponCache } from '../src/engine/combat.mjs';
import { PICKUP_KINDS } from '../src/data/pickups.mjs';

function advance(run) { run.boat.x = run.exitWorld.x; run.boat.y = run.exitWorld.y; return checkReachedExit(run); }

test('sinking on level 3 retries level 3 on a new reef, repaired, keeping banked Salvage', () => {
  const run = createRun(77, BASELINE_LOADOUT, { stage: 1 });
  addSalvage(run, 10); advance(run); addSalvage(run, 5); advance(run);
  assert.equal(run.reefIndex, 2);
  const firstCode = run.levelCode;
  const kitOnArrival = { ...run.weapons.ammo };
  collectWeaponCache(run.weapons, 'grapeshot', 20); // found during the failed attempt
  addSalvage(run, 7);
  run.boat.health = 0;
  assert.equal(checkSunk(run), true);
  assert.equal(run.outcome, 'sunk');
  assert.ok(retryLevel(run));
  assert.equal(run.over, false);
  assert.equal(run.reefIndex, 2, 'same level, not level 1');
  assert.notEqual(run.levelCode, firstCode, 'a different reef layout');
  assert.equal(run.boat.health, run.boat.maxHull);
  assert.equal(run.bankedSalvage, 15);
  assert.equal(run.reefSalvage, 0, 'what was at risk went down with the ship');
  assert.deepEqual(run.weapons.ammo, kitOnArrival, 'kit restored to what you arrived with');
  assert.equal(run.retries, 1);
});

test('retryLevel does nothing unless the boat actually sank', () => {
  const run = createRun(5);
  assert.equal(retryLevel(run), false);
});

test('each retry of the same level is a different layout, deterministic per run', () => {
  const codes = new Set();
  const run = createRun(99);
  for (let i = 0; i < 5; i++) { codes.add(run.levelCode); run.boat.health = 0; checkSunk(run); retryLevel(run); }
  assert.equal(codes.size, 5);
  const again = createRun(99);
  again.boat.health = 0; checkSunk(again); retryLevel(again);
  const other = createRun(99);
  other.boat.health = 0; checkSunk(other); retryLevel(other);
  assert.equal(again.levelCode, other.levelCode);
});

test('repair kits heal a share of max hull, and stay afloat while the hull is whole', () => {
  const boat = { x: 0, y: 0, health: 100, maxHull: 100 };
  const kit = makeRepairKit(0, 0);
  assert.deepEqual(collectPickups([kit], boat, 11, {}), []);
  assert.equal(kit.collected, false);
  boat.health = 30;
  const ev = collectPickups([kit], boat, 11, {});
  assert.equal(ev[0].kind, PICKUP_KINDS.REPAIR);
  assert.equal(boat.health, 65);
  boat.health = 90;
  const kit2 = makeRepairKit(0, 0);
  collectPickups([kit2], boat, 11, {});
  assert.equal(boat.health, 100, 'never above max');
});

test('every level places repair kits, more on later levels', () => {
  const run = createRun(3);
  const kits = (r) => r.pickups.filter((p) => p.kind === PICKUP_KINDS.REPAIR).length;
  assert.ok(kits(run) >= 1);
  advance(run); advance(run);
  assert.ok(kits(run) >= 2);
});
