// Pickup spawning and collection — step 5 (Loot/economy). Pure logic, no
// rendering, same split as the rest of engine/*.mjs.

import { PICKUP_KINDS, PICKUP_TUNING, CACHE_WEAPON_IDS, weaponCacheAmount } from '../data/pickups.mjs';
import { collectWeaponCache } from './combat.mjs';

let nextPickupId = 1;

function randRange(rng, [min, max]) {
  return Math.round(min + rng() * (max - min));
}

function findOpenSpawnTile(grid, tileSize, rng, avoid, minDistFromAvoid) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const tx = Math.floor(rng() * grid.width);
    const ty = Math.floor(rng() * grid.height);
    if (grid.tiles[ty][tx] !== 0) continue;
    const x = (tx + 0.5) * tileSize;
    const y = (ty + 0.5) * tileSize;
    if (Math.hypot(x - avoid.x, y - avoid.y) < minDistFromAvoid) continue;
    return { x, y };
  }
  return null;
}

// Spawns one weapon cache per niche weapon (so a reef always lets a
// player find the full kit) plus a handful of Salvage pickups, all on
// open water away from the boat's spawn point — mirrors
// enemies.mjs's spawnReefEnemies placement logic.
export function spawnReefPickups(grid, tileSize, boatSpawn, rng = Math.random) {
  const pickups = [];
  const minDist = tileSize * 2;

  for (const weaponId of CACHE_WEAPON_IDS) {
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

  return pickups;
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
    const radius = pickup.kind === PICKUP_KINDS.WEAPON_CACHE
      ? PICKUP_TUNING.weaponCacheRadius
      : PICKUP_TUNING.salvageRadius;
    const dist = Math.hypot(pickup.x - boat.x, pickup.y - boat.y);
    if (dist > radius + boatRadius) continue;

    pickup.collected = true;
    if (pickup.kind === PICKUP_KINDS.WEAPON_CACHE) {
      const freshUnlock = collectWeaponCache(weaponState, pickup.weaponId, pickup.amount);
      events.push({ kind: pickup.kind, weaponId: pickup.weaponId, amount: pickup.amount, freshUnlock });
    } else {
      events.push({ kind: pickup.kind, amount: pickup.amount });
    }
  }
  return events;
}
