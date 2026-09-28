// Meta-progression content — step 7. Three small, curated unlock tracks
// per the PRD's Meta-Progression section (depth over quantity, 2-3 tiers
// each), spent with Salvage banked across runs at the Captain's Hub.
// Costs/numbers below are a first balance pass with no real playtesting
// data yet (the PRD deliberately left exact numbers open) — expect to
// retune once real earn-rate data exists from played runs.

import { WEAPON_IDS } from './weapons.mjs';
import { MAX_HULL, DEFAULT_BOAT_TUNING } from '../engine/boat.mjs';
import { FACTION_IDS, FACTIONS } from './factions.mjs';

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
    // Retuned 2026-09-28 (faction balance pass): was 140 hull / dragMult
    // 1.1 — 91% voyage survival vs the Sloop's 67% on the speed-independent
    // metric (tools/hull-compare.mjs), a strictly dominant pick: its only
    // real cost, slower traversal, isn't a cost at all without a timer, and
    // the extra drag also cut its wall slams to a third of the Sloop's.
    // Now 115 / drag 1.0 → ~79%: still the safest hull, not the only one.
    maxHull: Math.round(MAX_HULL * 1.15), // 115
    accelMult: 0.9,
    maxSpeedMult: 0.85,
    turnRateMult: 0.85,
    dragMult: 1.0,
  },
  [HULL_IDS.SKIFF]: {
    id: HULL_IDS.SKIFF,
    name: 'Skiff',
    description: 'Fast and nimble but fragile — outrun trouble instead of tanking it.',
    cost: 150,
    // Retuned 2026-09-28 (faction balance pass): was 75 hull / dragMult
    // 0.95. Low drag made the fastest hull also the slipperiest — it
    // coasted into rock far more than any other hull (wall damage ~2x the
    // Sloop's even with a wall-aware evasive bot), so it sank ~45% of
    // voyages vs the Sloop's ~19%: a 150-Salvage downgrade. "Nimble" means
    // snappy, so drag is now HIGHER than baseline (stops/turns crisply),
    // and hull 85 — still the frailest hull, but its agility now buys
    // Sloop-level survival (~20% sunk, less contact damage taken) instead
    // of losing to it. See tools/faction-compare.mjs.
    maxHull: Math.round(MAX_HULL * 0.85), // 85
    accelMult: 1.15,
    maxSpeedMult: 1.2,
    turnRateMult: 1.3,
    dragMult: 1.15,
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

// --- Playable Factions (post-slice, PRD "Post-Slice Direction") --------
// PRD: "the player picks (or unlocks) a starting faction, determining
// their starting ship hull, a passive, and weapon bias — implemented as an
// extension of the already-planned Ship Hulls and Cargo Loadouts unlock
// tracks (Meta-Progression, step 7), not a bolted-on separate system."
// Literally an extension, not new mechanics: each faction's hull bias
// reuses an existing HULL_IDS entry, its weapon bias an existing niche
// weapon (mirrors a Cargo Loadout tier's extraHeldWeapon), and its passive
// an existing Captain's Charm effect (mirrors owning that charm) —
// selecting a faction grants that charm's effect for free on top of
// anything separately owned, rather than inventing a fourth passive
// system. Mutually exclusive like Ship Hulls (one active faction, or none
// — `null` is a valid, always-available "unaligned" selection matching the
// baseline loadout). The combat-TRIANGLE damage bonus itself (Reavers >
// Iron Accord > Wyrdtide > Reavers) lives in data/factions.mjs and applies
// automatically once selectedFaction is set — nothing here computes it.
//
// WEAPON-BIAS RULE — "cover your weakness" (decided 2026-09-28 with data,
// enforced by tests/meta.test.mjs): each faction starts holding the counter
// weapon for an enemy of the faction that BEATS it. The triangle already
// favors you against your prey; your kit is what gets you through your
// predator. The roster is heavily skewed (Reavers ~70% of enemies, Iron
// Accord absent until reef 3), and this rule puts each faction's help
// exactly where its triangle hurts most: Iron Accord's worst reef is 1
// (Reaver packs) → Grapeshot; the Reavers' worst is 2 (Harpies + Crawlers)
// → Chain Shot; Wyrdtide, already the strongest, gets Flame Barrels, which
// only matters against reef-3 Brigands. The "hunter" rule (counter your
// prey) was measured and rejected: it hands the dominant faction the best
// early weapon. Passives were swapped the same way: the fragile Reavers
// get the survival charm (Last Gasp), the strongest faction gets the
// economy one (First Haul). Measured with tools/faction-compare.mjs.
export const PLAYABLE_FACTION_IDS = FACTION_IDS;

export const PLAYABLE_FACTIONS = {
  [FACTION_IDS.REAVERS]: {
    id: FACTION_IDS.REAVERS,
    name: FACTIONS[FACTION_IDS.REAVERS].name,
    description: 'Sail as the Reavers: the Skiff hull, Chain Shot loaded from Reef 1 to bring down the Wyrdtide flyers that prey on you, and a raider\'s refusal to sink (Last Gasp\'s once-per-run revive, free).',
    cost: 200,
    hullId: HULL_IDS.SKIFF,
    extraHeldWeapon: WEAPON_IDS.CHAIN_SHOT,
    grantsCharm: CHARM_IDS.LAST_GASP,
  },
  [FACTION_IDS.WYRDTIDE]: {
    id: FACTION_IDS.WYRDTIDE,
    name: FACTIONS[FACTION_IDS.WYRDTIDE].name,
    description: 'Sail as Wyrdtide: the Sloop hull, Flame Barrels loaded from Reef 1 to burn through the Iron Accord armor that preys on you, and the tide\'s early favor (First Haul\'s Salvage bonus, free).',
    cost: 200,
    hullId: HULL_IDS.SLOOP,
    extraHeldWeapon: WEAPON_IDS.FLAME_BARRELS,
    grantsCharm: CHARM_IDS.FIRST_HAUL,
  },
  [FACTION_IDS.IRON_ACCORD]: {
    id: FACTION_IDS.IRON_ACCORD,
    name: FACTIONS[FACTION_IDS.IRON_ACCORD].name,
    description: 'Sail as the Iron Accord: the Longboat hull, Grapeshot loaded from Reef 1 to shred the Reaver packs that prey on you, and disciplined reload drills (Steady Hands\' ammo regen, free).',
    cost: 200,
    hullId: HULL_IDS.LONGBOAT,
    extraHeldWeapon: WEAPON_IDS.GRAPESHOT,
    grantsCharm: CHARM_IDS.STEADY_HANDS,
  },
};

export const PLAYABLE_FACTION_LIST = Object.values(PLAYABLE_FACTIONS);

export function getPlayableFaction(id) {
  const faction = PLAYABLE_FACTIONS[id];
  if (!faction) throw new Error(`Unknown playable faction id: ${id}`);
  return faction;
}

// --- Workshop / Crafting (post-slice, PRD "Hub & Workshop") -------------
// PRD: "the Captain's Hub grows into a proper base between runs... The
// Workshop is where the already-flagged, deliberately-deferred Crafting
// system lives — combining Salvage and rare drops into weapon and ship
// upgrades." Salvage is the existing currency; the "rare drop" is a new
// one, Kraken Scales — awarded once per run for defeating The Kraken's
// Anchor (engine/meta.mjs's recordRunResult), not purchasable with
// Salvage, so a Workshop upgrade is genuinely gated behind a real boss
// kill, not just grinding currency. Permanent and stacking (own every
// upgrade at once), matching Cargo Loadouts/Charms rather than the
// mutually-exclusive Hulls/Factions tracks.
export const WORKSHOP_UPGRADE_IDS = Object.freeze({
  REINFORCED_BARRELS: 'reinforced_barrels',
  SHARPENED_GRAPESHOT: 'sharpened_grapeshot',
  REINFORCED_RIBS: 'reinforced_ribs',
});

export const WORKSHOP_UPGRADES = {
  [WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS]: {
    id: WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS,
    name: 'Reinforced Barrels',
    description: 'Forge stronger Cannonball casings — +20% Cannonballs damage, permanently.',
    salvageCost: 150,
    krakenScaleCost: 1,
    weaponId: WEAPON_IDS.CANNONBALLS,
    damageMultiplier: 1.2,
  },
  [WORKSHOP_UPGRADE_IDS.SHARPENED_GRAPESHOT]: {
    id: WORKSHOP_UPGRADE_IDS.SHARPENED_GRAPESHOT,
    name: 'Sharpened Grapeshot',
    description: 'Hand-file every shard — +25% Grapeshot damage, permanently.',
    salvageCost: 150,
    krakenScaleCost: 1,
    weaponId: WEAPON_IDS.GRAPESHOT,
    damageMultiplier: 1.25,
  },
  [WORKSHOP_UPGRADE_IDS.REINFORCED_RIBS]: {
    id: WORKSHOP_UPGRADE_IDS.REINFORCED_RIBS,
    name: 'Reinforced Ribs',
    description: 'Kraken-scale plating along the keel — +15 max hull on every hull, permanently.',
    salvageCost: 180,
    krakenScaleCost: 2,
    extraMaxHull: 15,
  },
};

export const WORKSHOP_UPGRADE_LIST = Object.values(WORKSHOP_UPGRADES);

export function getWorkshopUpgrade(id) {
  const upgrade = WORKSHOP_UPGRADES[id];
  if (!upgrade) throw new Error(`Unknown workshop upgrade id: ${id}`);
  return upgrade;
}

// Combines every owned Workshop upgrade into: a per-weapon damage
// multiplier map (multiple upgrades on the same weapon would stack
// multiplicatively, though the current 3 upgrades don't overlap a
// weapon) and a flat extra-max-hull total.
export function workshopBonusesFor(ownedUpgradeIds) {
  const damageMultipliers = {};
  let extraMaxHull = 0;
  for (const upgradeId of ownedUpgradeIds) {
    const upgrade = WORKSHOP_UPGRADES[upgradeId];
    if (!upgrade) continue;
    if (upgrade.weaponId) {
      damageMultipliers[upgrade.weaponId] = (damageMultipliers[upgrade.weaponId] || 1) * upgrade.damageMultiplier;
    }
    if (upgrade.extraMaxHull) extraMaxHull += upgrade.extraMaxHull;
  }
  return { damageMultipliers, extraMaxHull };
}
