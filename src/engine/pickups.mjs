// Pickup spawning and collection — step 5 (Loot/economy). Pure logic, no
// rendering, same split as the rest of engine/*.mjs.

import { PICKUP_KINDS, PICKUP_TUNING, CACHE_WEAPON_IDS, weaponCacheAmount } from '../data/pickups.mjs';
import { collectWeaponCache } from './combat.mjs';
import { isOpenWithClearance } from './maze.mjs';

let nextPickupId = 1;

function randRange(rng, [min, max]) {
  return Math.round(min + rng() * (max - min));
}

function findOpenSpawnTile(grid, tileSize, rng, avoid, minDistFromAvoid, zone = null) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const tx = Math.floor(rng() * grid.width);
    const ty = Math.floor(rng() * grid.height);
    if (!isOpenWithClearance(grid, tx, ty)) continue;
    const x = (tx + 0.5) * tileSize;
    const y = (ty + 0.5) * tileSize;
    if (Math.hypot(x - avoid.x, y - avoid.y) < minDistFromAvoid) continue;
    if (zone && Math.hypot(x - zone.x, y - zone.y) < zone.r) continue;
    return { x, y };
  }
  return null;
}

// Spawns one weapon cache per niche weapon (so a reef always lets a
// player find the full kit) plus a handful of Salvage pickups, all on
// open water away from the boat's spawn point — mirrors
// enemies.mjs's spawnReefEnemies placement logic.
export function spawnReefPickups(grid, tileSize, boatSpawn, rng = Math.random, { repairs = 1, avoid = null, cacheWeapons = CACHE_WEAPON_IDS } = {}) {
  const pickups = [];
  const minDist = tileSize * 2;

  for (const weaponId of cacheWeapons) {
    const spot = findOpenSpawnTile(grid, tileSize, rng, boatSpawn, minDist);
    if (!spot) continue;
    pickups.push({
      id: nextPickupId++,
      kind: PICKUP_KINDS.WEAPON_CACHE,
      weaponId,
      amount: weaponCacheAmount(weaponId),
      x: spot.x, y: spot.y,
      collected: false,
    });
  }

  for (let i = 0; i < PICKUP_TUNING.salvageCountPerReef; i++) {
    const spot = findOpenSpawnTile(grid, tileSize, rng, boatSpawn, minDist);
    if (!spot) continue;
    pickups.push({
      id: nextPickupId++,
      kind: PICKUP_KINDS.SALVAGE,
      amount: randRange(rng, PICKUP_TUNING.salvagePickupRange),
      x: spot.x, y: spot.y,
      collected: false,
    });
  }

  // Repair kits: spread out, and never right at the spawn (they're for
  // later in the level, once you've taken some hits).
  for (let i = 0; i < repairs; i++) {
    const spot = findOpenSpawnTile(grid, tileSize, rng, boatSpawn, tileSize * 10, avoid)
      || findOpenSpawnTile(grid, tileSize, rng, boatSpawn, minDist, avoid);
    if (!spot) continue;
    pickups.push(makeRepairKit(spot.x, spot.y));
  }

  return pickups;
}

export function makeChest(x, y) {
  return { id: nextPickupId++, kind: PICKUP_KINDS.CHEST, amount: 1, x, y, collected: false };
}

export function makeRepairKit(x, y) {
  return { id: nextPickupId++, kind: PICKUP_KINDS.REPAIR, amount: PICKUP_TUNING.repairFraction, x, y, collected: false };
}

// Checks every uncollected pickup against the boat's position and applies
// its effect on pickup. Returns an array of collection events —
// { kind, weaponId?, amount, freshUnlock? } — so callers (the game loop,
// tests) can drive HUD toasts/salvage tallies without re-deriving what
// happened. Mutates `pickup.collected` in place rather than removing from
// the array, so a caller that's mid-iteration elsewhere doesn't have the
// list shift under it; render/update code should skip collected pickups.
export function collectPickups(pickups, boat, boatRadius, weaponState) {
  const events = [];
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    const radius = pickup.kind === PICKUP_KINDS.WEAPON_CACHE || pickup.kind === PICKUP_KINDS.CHEST ? PICKUP_TUNING.weaponCacheRadius
      : pickup.kind === PICKUP_KINDS.REPAIR ? PICKUP_TUNING.repairRadius
        : PICKUP_TUNING.salvageRadius;
    const dist = Math.hypot(pickup.x - boat.x, pickup.y - boat.y);
    if (dist > radius + boatRadius) continue;
    // A repair kit stays afloat for later if the hull is already whole.
    if (pickup.kind === PICKUP_KINDS.REPAIR && boat.health >= boat.maxHull) continue;

    pickup.collected = true;
    if (pickup.kind === PICKUP_KINDS.WEAPON_CACHE) {
      const freshUnlock = collectWeaponCache(weaponState, pickup.weaponId, pickup.amount);
      events.push({ kind: pickup.kind, weaponId: pickup.weaponId, amount: pickup.amount, freshUnlock });
    } else if (pickup.kind === PICKUP_KINDS.REPAIR) {
      const before = boat.health;
      boat.health = Math.min(boat.maxHull, boat.health + boat.maxHull * pickup.amount);
      events.push({ kind: pickup.kind, amount: boat.health - before });
    } else {
      events.push({ kind: pickup.kind, amount: pickup.amount });
    }
  }
  return events;
}
