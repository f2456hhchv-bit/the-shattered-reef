// Meta-progression content — step 7. Three small, curated unlock tracks
// per the PRD's Meta-Progression section (depth over quantity, 2-3 tiers
// each), spent with Salvage banked across runs at the Captain's Hub.
// Costs/numbers below are a first balance pass with no real playtesting
// data yet (the PRD deliberately left exact numbers open) — expect to
// retune once real earn-rate data exists from played runs.

import { WEAPON_IDS } from './weapons.mjs';
import { MAX_HULL, DEFAULT_BOAT_TUNING } from '../engine/boat.mjs';

// --- Ship Hulls ---------------------------------------------------------
// Alternative starting hulls that trade max hull, speed and turn rate
// against each other (PRD: "changes the feel of every run, not just its
// numbers"). Mutually exclusive — the player selects one active hull, not
// a stack of all owned hulls. `sloop` is the current boat's stats
// unchanged, always owned, and the default. Multipliers apply to
// DEFAULT_BOAT_TUNING; `maxHull` is an absolute value, not a bonus.
export const HULL_IDS = Object.freeze({
  SLOOP: 'sloop',
  LONGBOAT: 'longboat',
  SKIFF: 'skiff',
});

export const SHIP_HULLS = {
  [HULL_IDS.SLOOP]: {
    id: HULL_IDS.SLOOP,
    name: 'Sloop',
    description: 'The reliable starting hull — balanced in every way.',
    cost: 0, // always owned
    maxHull: MAX_HULL,
    accelMult: 1,
    maxSpeedMult: 1,
    turnRateMult: 1,
    dragMult: 1,
  },
  [HULL_IDS.LONGBOAT]: {
    id: HULL_IDS.LONGBOAT,
    name: 'Longboat',
    description: 'Heavier and slower to turn, but takes a real beating — trades speed for survivability.',
    cost: 120,
    maxHull: Math.round(MAX_HULL * 1.4), // 140
    accelMult: 0.9,
    maxSpeedMult: 0.85,
    turnRateMult: 0.85,
    dragMult: 1.1,
  },
  [HULL_IDS.SKIFF]: {
    id: HULL_IDS.SKIFF,
    name: 'Skiff',
    description: 'Fast and nimble but fragile — outrun trouble instead of tanking it.',
    cost: 150,
    maxHull: Math.round(MAX_HULL * 0.75), // 75
    accelMult: 1.15,
    maxSpeedMult: 1.2,
    turnRateMult: 1.3,
    dragMult: 0.95,
  },
};

export const SHIP_HULL_LIST = Object.values(SHIP_HULLS);

export function getHull(id) {
  const hull = SHIP_HULLS[id];
  if (!hull) throw new Error(`Unknown hull id: ${id}`);
  return hull;
}

// Combines a hull definition with the baseline boat tuning into a
// ready-to-use tuning object for stepBoat — keeps the "how a hull modifies
// the boat" math in one place instead of scattered at call sites.
export function tuningForHull(hullDef) {
  return {
    acceleration: DEFAULT_BOAT_TUNING.acceleration * hullDef.accelMult,
    maxSpeed: DEFAULT_BOAT_TUNING.maxSpeed * hullDef.maxSpeedMult,
    drag: DEFAULT_BOAT_TUNING.drag * hullDef.dragMult,
    turnRate: DEFAULT_BOAT_TUNING.turnRate * hullDef.turnRateMult,
  };
}

// --- Cargo Loadouts -------------------------------------------------
// PRD: "starting ammo reserves and which of the four niche weapons... are
// available from Reef 1 rather than found as in-run pickups". Unlike
// hulls, these are permanent, stacking, non-exclusive unlocks — every
// tier ever bought stays in effect on every future run.
export const CARGO_TIER_IDS = Object.freeze({
  FORWARD_MAGAZINE: 'forward_magazine',
  CHAIN_LOCKER: 'chain_locker',
  DEEP_STORES: 'deep_stores',
});

export const CARGO_TIERS = {
  [CARGO_TIER_IDS.FORWARD_MAGAZINE]: {
    id: CARGO_TIER_IDS.FORWARD_MAGAZINE,
    name: 'Forward Magazine',
    description: 'Pack more ammo before you cast off — +50% starting ammo for any weapon you begin a run holding.',
    cost: 70,
    extraHeldWeapon: null,
    startingAmmoMultiplier: 1.5,
  },
  [CARGO_TIER_IDS.CHAIN_LOCKER]: {
    id: CARGO_TIER_IDS.CHAIN_LOCKER,
    name: 'Chain Locker',
    description: 'A dedicated hold for Chain Shot — start every run with it already loaded.',
    cost: 90,
    extraHeldWeapon: WEAPON_IDS.CHAIN_SHOT,
    startingAmmoMultiplier: 1,
  },
  [CARGO_TIER_IDS.DEEP_STORES]: {
    id: CARGO_TIER_IDS.DEEP_STORES,
    name: 'Deep Stores',
    description: 'Reinforced barrel racks below deck — start every run with Depth Charges already loaded.',
    cost: 160,
    extraHeldWeapon: WEAPON_IDS.DEPTH_CHARGES,
    startingAmmoMultiplier: 1,
  },
};

export const CARGO_TIER_LIST = Object.values(CARGO_TIERS);

export function getCargoTier(id) {
  const tier = CARGO_TIERS[id];
  if (!tier) throw new Error(`Unknown cargo tier id: ${id}`);
  return tier;
}

// Combines every owned cargo tier into one loadout: which niche weapons
// start held, and the ammo multiplier applied to every weapon held at run
// start (Cannonballs excluded — it has no ammo to multiply).
export function cargoLoadoutFor(ownedTierIds) {
  const extraHeldWeapons = [];
  let startingAmmoMultiplier = 1;
  for (const tierId of ownedTierIds) {
    const tier = CARGO_TIERS[tierId];
    if (!tier) continue;
    if (tier.extraHeldWeapon) extraHeldWeapons.push(tier.extraHeldWeapon);
    startingAmmoMultiplier *= tier.startingAmmoMultiplier;
  }
  return { extraHeldWeapons, startingAmmoMultiplier };
}

// --- Captain's Charms -----------------------------------------------
// Passive run-modifiers, per the PRD's own explicit examples — stacking,
// non-exclusive like Cargo Loadouts (each owned charm is simply always
// active).
export const CHARM_IDS = Object.freeze({
  STEADY_HANDS: 'steady_hands',
  LAST_GASP: 'last_gasp',
  FIRST_HAUL: 'first_haul',
});

export const CHARMS = {
  [CHARM_IDS.STEADY_HANDS]: {
    id: CHARM_IDS.STEADY_HANDS,
    name: 'Steady Hands',
    description: 'Held weapons slowly regenerate ammo over time, even between pickups.',
    cost: 130,
    ammoRegenPerSecond: 1 / 8, // ~1 ammo every 8s, per held weapon with finite ammo
  },
  [CHARM_IDS.LAST_GASP]: {
    id: CHARM_IDS.LAST_GASP,
    name: "Last Gasp",
    description: 'The first time your hull would hit 0 this run, patch through at 1 hull instead. Once per run.',
    cost: 200,
  },
  [CHARM_IDS.FIRST_HAUL]: {
    id: CHARM_IDS.FIRST_HAUL,
    name: 'First Haul',
    description: 'Salvage earned in the first reef of every run is boosted by 50%.',
    cost: 80,
    firstReefSalvageMultiplier: 1.5,
  },
};

export const CHARM_LIST = Object.values(CHARMS);

export function getCharm(id) {
  const charm = CHARMS[id];
  if (!charm) throw new Error(`Unknown charm id: ${id}`);
  return charm;
}
