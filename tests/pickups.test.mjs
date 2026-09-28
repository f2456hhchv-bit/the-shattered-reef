import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnReefPickups, collectPickups } from '../src/engine/pickups.mjs';
import { PICKUP_KINDS, CACHE_WEAPON_IDS, PICKUP_TUNING, weaponCacheAmount } from '../src/data/pickups.mjs';
import { createWeaponState, isHeld, ammoFor } from '../src/engine/combat.mjs';
import { createBoat } from '../src/engine/boat.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';
import { WEAPON_IDS } from '../src/data/weapons.mjs';

function openGrid(width = 40, height = 40) {
  const tiles = Array.from({ length: height }, () => Array(width).fill(0));
  return { width, height, tiles };
}

test('spawnReefPickups places one weapon cache per niche weapon plus the configured Salvage count', () => {
  const rng = makeSeededRng(11);
  const grid = openGrid();
  const boatSpawn = { x: 5 * 16, y: 5 * 16 };
  const pickups = spawnReefPickups(grid, 16, boatSpawn, rng);

  const caches = pickups.filter((p) => p.kind === PICKUP_KINDS.WEAPON_CACHE);
  const salvage = pickups.filter((p) => p.kind === PICKUP_KINDS.SALVAGE);
  assert.equal(caches.length, CACHE_WEAPON_IDS.length);
  assert.deepEqual(caches.map((c) => c.weaponId).sort(), [...CACHE_WEAPON_IDS].sort());
  assert.equal(salvage.length, PICKUP_TUNING.salvageCountPerReef);
});

test('spawnReefPickups only places pickups on open water, away from the boat spawn', () => {
  const rng = makeSeededRng(23);
  const grid = openGrid();
  for (let x = 0; x < grid.width; x++) { grid.tiles[0][x] = 1; grid.tiles[grid.height - 1][x] = 1; }
  const boatSpawn = { x: 8 * 16, y: 8 * 16 };
  const pickups = spawnReefPickups(grid, 16, boatSpawn, rng);

  assert.ok(pickups.length > 0);
  for (const p of pickups) {
    const tx = Math.floor(p.x / 16);
    const ty = Math.floor(p.y / 16);
    assert.equal(grid.tiles[ty][tx], 0, 'pickup should be on open water');
    const dist = Math.hypot(p.x - boatSpawn.x, p.y - boatSpawn.y);
    assert.ok(dist >= 16 * 2, 'pickup should be spawned away from the boat');
  }
});

test('spawnReefPickups is deterministic for a given seed', () => {
  const grid = openGrid();
  const boatSpawn = { x: 5 * 16, y: 5 * 16 };
  const a = spawnReefPickups(grid, 16, boatSpawn, makeSeededRng(99));
  const b = spawnReefPickups(grid, 16, boatSpawn, makeSeededRng(99));
  assert.deepEqual(a.map((p) => [p.kind, p.weaponId, p.x, p.y]), b.map((p) => [p.kind, p.weaponId, p.x, p.y]));
});

test('weaponCacheAmount matches the tuned fraction of each weapon\'s ammo max', () => {
  const pickups = spawnReefPickups(openGrid(), 16, { x: 80, y: 80 }, makeSeededRng(5));
  for (const p of pickups.filter((x) => x.kind === PICKUP_KINDS.WEAPON_CACHE)) {
    assert.equal(p.amount, weaponCacheAmount(p.weaponId));
  }
});

test('collecting a weapon cache unlocks a new weapon and reports freshUnlock', () => {
  const boat = createBoat(100, 100, 0);
  const weapons = createWeaponState();
  assert.equal(isHeld(weapons, WEAPON_IDS.CHAIN_SHOT), false);
  const pickups = [{
    id: 1, kind: PICKUP_KINDS.WEAPON_CACHE, weaponId: WEAPON_IDS.CHAIN_SHOT,
    amount: weaponCacheAmount(WEAPON_IDS.CHAIN_SHOT), x: 100, y: 100, collected: false,
  }];
  const events = collectPickups(pickups, boat, 11, weapons);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, PICKUP_KINDS.WEAPON_CACHE);
  assert.equal(events[0].freshUnlock, true);
  assert.equal(isHeld(weapons, WEAPON_IDS.CHAIN_SHOT), true);
  assert.equal(ammoFor(weapons, WEAPON_IDS.CHAIN_SHOT), weaponCacheAmount(WEAPON_IDS.CHAIN_SHOT));
  assert.equal(pickups[0].collected, true);
});

test('collecting an already-held weapon\'s cache tops up ammo and reports no fresh unlock', () => {
  const boat = createBoat(100, 100, 0);
  const weapons = createWeaponState();
  const cacheAmount = weaponCacheAmount(WEAPON_IDS.GRAPESHOT);
  // First cache unlocks it.
  collectPickups(
    [{ id: 1, kind: PICKUP_KINDS.WEAPON_CACHE, weaponId: WEAPON_IDS.GRAPESHOT, amount: cacheAmount, x: 100, y: 100, collected: false }],
    boat, 11, weapons
  );
  const ammoAfterFirst = ammoFor(weapons, WEAPON_IDS.GRAPESHOT);
  // Spend some ammo so the second cache has room to add, then collect again.
  weapons.ammo[WEAPON_IDS.GRAPESHOT] = Math.max(0, ammoAfterFirst - 3);
  const secondPickup = [{
    id: 2, kind: PICKUP_KINDS.WEAPON_CACHE, weaponId: WEAPON_IDS.GRAPESHOT, amount: cacheAmount, x: 100, y: 100, collected: false,
  }];
  const events = collectPickups(secondPickup, boat, 11, weapons);
  assert.equal(events[0].freshUnlock, false);
  assert.ok(ammoFor(weapons, WEAPON_IDS.GRAPESHOT) > ammoAfterFirst - 3);
});

test('collecting Salvage reports its amount and does not touch weapon state', () => {
  const boat = createBoat(100, 100, 0);
  const weapons = createWeaponState();
  const pickups = [{ id: 1, kind: PICKUP_KINDS.SALVAGE, amount: 5, x: 100, y: 100, collected: false }];
  const events = collectPickups(pickups, boat, 11, weapons);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { kind: PICKUP_KINDS.SALVAGE, amount: 5 });
  assert.equal(pickups[0].collected, true);
});

test('collectPickups only collects pickups within range and ignores already-collected ones', () => {
  const boat = createBoat(0, 0, 0);
  const weapons = createWeaponState();
  const near = { id: 1, kind: PICKUP_KINDS.SALVAGE, amount: 4, x: 5, y: 0, collected: false };
  const far = { id: 2, kind: PICKUP_KINDS.SALVAGE, amount: 4, x: 500, y: 0, collected: false };
  const alreadyDone = { id: 3, kind: PICKUP_KINDS.SALVAGE, amount: 4, x: 0, y: 0, collected: true };
  const events = collectPickups([near, far, alreadyDone], boat, 11, weapons);
  assert.equal(events.length, 1);
  assert.equal(near.collected, true);
  assert.equal(far.collected, false);
});
