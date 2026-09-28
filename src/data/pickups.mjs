// Pickup definitions — step 5 (Loot/economy). A "weapon cache" is the one
// pickup type for niche weapons: found unheld, it unlocks that weapon into
// the player's kit with starting ammo; found already-held, it just tops
// the ammo up. This matches the PRD's Weapons section ("Ammo... is a
// limited in-run resource restocked by pickups") and its Meta-Progression
// section (Cargo Loadouts start you with weapons "rather than found as
// in-run pickups" — the *default*, un-upgraded case is finding them).

import { WEAPON_IDS, getWeapon } from './weapons.mjs';

export const PICKUP_KINDS = Object.freeze({
  WEAPON_CACHE: 'weapon_cache',
  SALVAGE: 'salvage',
});

// The niche weapons a reef guarantees one cache of each — Cannonballs
// needs no cache (unlimited ammo, held from the start).
export const CACHE_WEAPON_IDS = Object.freeze([
  WEAPON_IDS.CHAIN_SHOT, WEAPON_IDS.GRAPESHOT, WEAPON_IDS.DEPTH_CHARGES, WEAPON_IDS.FLAME_BARRELS,
]);

export const PICKUP_TUNING = Object.freeze({
  weaponCacheRadius: 10,
  weaponCacheAmmoFraction: 0.5, // fraction of the weapon's ammoMax granted per cache, unlock or refill alike
  salvageRadius: 7,
  salvagePickupRange: [3, 6], // Salvage granted per pickup
  salvageCountPerReef: 6,
});

export function weaponCacheAmount(weaponId) {
  const weapon = getWeapon(weaponId);
  return Math.round(weapon.ammoMax * PICKUP_TUNING.weaponCacheAmmoFraction);
}
