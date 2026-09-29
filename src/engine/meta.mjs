// Persistent meta-progression — step 7. Salvage banked across *runs* (not
// just within one, which run.mjs's bankedSalvage already handles) is spent
// here on permanent unlocks (data/meta.mjs). Storage is injected (any
// object shaped like localStorage: getItem/setItem) rather than reached
// for globally, so this stays pure logic like the rest of engine/*.mjs —
// only main.mjs ever passes the real window.localStorage; tests pass an
// in-memory fake.

import {
  HULL_IDS, getHull,
  CARGO_TIER_LIST, cargoLoadoutFor,
  CHARM_LIST, CHARM_IDS, charmEffectsFor,
  PLAYABLE_FACTION_LIST, getPlayableFaction,
  WORKSHOP_UPGRADE_LIST, getWorkshopUpgrade, workshopBonusesFor,
} from '../data/meta.mjs';

const STORAGE_KEY = 'shatteredReef.meta.v1';

const isKnownHull = (id) => { try { getHull(id); return true; } catch { return false; } };
const isKnownFaction = (id) => { try { getPlayableFaction(id); return true; } catch { return false; } };

export function createDefaultMeta() {
  return {
    salvage: 0,
    ownedHulls: [HULL_IDS.SLOOP],
    selectedHull: HULL_IDS.SLOOP,
    ownedCargoTiers: [],
    ownedCharms: [],
    ownedFactions: [],
    selectedFaction: null, // null = unaligned (baseline), matching BASELINE_LOADOUT
    krakenScales: 0, // the Workshop's rare-drop currency — see recordRunResult
    ownedWorkshopUpgrades: [],
    // Stages (2026-09-28): the highest stage the player may sail. Clearing
    // it (all 5 levels) unlocks the next; cleared stages stay replayable.
    highestStageUnlocked: 1,
    stats: { runsPlayed: 0, bestReefsCleared: 0, deepestReefReached: 0, totalSalvageEarned: 0 },
  };
}

// Never throws — a missing key, disabled storage, or corrupt/partial JSON
// all degrade to sensible defaults rather than crashing the app over save
// data. Merges onto the defaults field-by-field so an older save (missing
// a field a later version added) still loads cleanly.
export function loadMeta(storage) {
  const defaults = createDefaultMeta();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    const meta = {
      ...defaults,
      ...parsed,
      stats: { ...defaults.stats, ...(parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {}) },
      ownedHulls: Array.isArray(parsed.ownedHulls) ? parsed.ownedHulls : defaults.ownedHulls,
      ownedCargoTiers: Array.isArray(parsed.ownedCargoTiers) ? parsed.ownedCargoTiers : defaults.ownedCargoTiers,
      ownedCharms: Array.isArray(parsed.ownedCharms) ? parsed.ownedCharms : defaults.ownedCharms,
      ownedFactions: Array.isArray(parsed.ownedFactions) ? parsed.ownedFactions : defaults.ownedFactions,
      ownedWorkshopUpgrades: Array.isArray(parsed.ownedWorkshopUpgrades) ? parsed.ownedWorkshopUpgrades : defaults.ownedWorkshopUpgrades,
    };
    // Selections must point at something owned AND still defined in data —
    // resolveLoadout() throws on an unknown hull/faction id, so a stale or
    // hand-edited save would otherwise crash every "Set Sail" and strand
    // the player in the Hub. Fall back to the always-valid baseline instead.
    if (!meta.ownedHulls.includes(HULL_IDS.SLOOP)) meta.ownedHulls = [HULL_IDS.SLOOP, ...meta.ownedHulls];
    if (!meta.ownedHulls.includes(meta.selectedHull) || !isKnownHull(meta.selectedHull)) meta.selectedHull = HULL_IDS.SLOOP;
    if (meta.selectedFaction !== null
      && (!meta.ownedFactions.includes(meta.selectedFaction) || !isKnownFaction(meta.selectedFaction))) {
      meta.selectedFaction = null;
    }
    if (!Number.isFinite(meta.salvage)) meta.salvage = 0;
    if (!Number.isFinite(meta.krakenScales)) meta.krakenScales = 0;
    if (!Number.isInteger(meta.highestStageUnlocked) || meta.highestStageUnlocked < 1) meta.highestStageUnlocked = 1;
    return meta;
  } catch {
    return defaults;
  }
}

// Returns whether the write actually succeeded (storage can be full,
// disabled by the browser, or unavailable in a private-mode edge case) —
// callers can choose to warn, but a failed save should never block play.
export function saveMeta(storage, meta) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function canAfford(meta, cost) {
  return meta.salvage >= cost;
}

export function purchaseHull(meta, hullId) {
  if (meta.ownedHulls.includes(hullId)) return { ok: false, reason: 'already_owned' };
  const hull = getHull(hullId);
  if (!canAfford(meta, hull.cost)) return { ok: false, reason: 'cannot_afford' };
  meta.salvage -= hull.cost;
  meta.ownedHulls.push(hullId);
  return { ok: true };
}

export function selectHull(meta, hullId) {
  if (!meta.ownedHulls.includes(hullId)) return false;
  meta.selectedHull = hullId;
  return true;
}

export function purchaseCargoTier(meta, tierId) {
  if (meta.ownedCargoTiers.includes(tierId)) return { ok: false, reason: 'already_owned' };
  const tier = CARGO_TIER_LIST.find((t) => t.id === tierId);
  if (!tier) return { ok: false, reason: 'unknown' };
  if (!canAfford(meta, tier.cost)) return { ok: false, reason: 'cannot_afford' };
  meta.salvage -= tier.cost;
  meta.ownedCargoTiers.push(tierId);
  return { ok: true };
}

export function purchaseFaction(meta, factionId) {
  if (meta.ownedFactions.includes(factionId)) return { ok: false, reason: 'already_owned' };
  const faction = getPlayableFaction(factionId); // throws on an unknown id
  if (!canAfford(meta, faction.cost)) return { ok: false, reason: 'cannot_afford' };
  meta.salvage -= faction.cost;
  meta.ownedFactions.push(factionId);
  return { ok: true };
}

// `factionId` may be null — "unaligned", the always-available baseline
// selection (mirrors having no faction chosen, or none owned yet).
export function selectFaction(meta, factionId) {
  if (factionId !== null && !meta.ownedFactions.includes(factionId)) return false;
  meta.selectedFaction = factionId;
  return true;
}

// Workshop upgrades cost BOTH Salvage and Kraken Scales (the boss-drop
// rare material, see recordRunResult) — genuinely gated behind a boss
// kill, not just Salvage grinding, matching the PRD's "Salvage and rare
// drops" framing.
export function canAffordWorkshopUpgrade(meta, upgrade) {
  return meta.salvage >= upgrade.salvageCost && meta.krakenScales >= upgrade.krakenScaleCost;
}

export function purchaseWorkshopUpgrade(meta, upgradeId) {
  if (meta.ownedWorkshopUpgrades.includes(upgradeId)) return { ok: false, reason: 'already_owned' };
  const upgrade = getWorkshopUpgrade(upgradeId); // throws on an unknown id
  if (!canAffordWorkshopUpgrade(meta, upgrade)) return { ok: false, reason: 'cannot_afford' };
  meta.salvage -= upgrade.salvageCost;
  meta.krakenScales -= upgrade.krakenScaleCost;
  meta.ownedWorkshopUpgrades.push(upgradeId);
  return { ok: true };
}

export function purchaseCharm(meta, charmId) {
  if (meta.ownedCharms.includes(charmId)) return { ok: false, reason: 'already_owned' };
  const charm = CHARM_LIST.find((c) => c.id === charmId);
  if (!charm) return { ok: false, reason: 'unknown' };
  if (!canAfford(meta, charm.cost)) return { ok: false, reason: 'cannot_afford' };
  meta.salvage -= charm.cost;
  meta.ownedCharms.push(charmId);
  return { ok: true };
}

// Resolves the persisted meta state into the plain loadout object
// createRun() (run.mjs) expects — the one place "which unlocks are owned"
// turns into "what a run actually starts with". run.mjs itself never
// reads ownership arrays directly, only this resolved shape.
export function resolveLoadout(meta) {
  // A selected faction is an EXTENSION of the hull/cargo/charm tracks, per
  // the PRD, not a fourth system: it overrides the active hull with its
  // own (the PRD's "determining their starting ship hull"), adds its
  // weapon bias on top of any owned Cargo Loadout weapons, and grants its
  // passive as if that Captain's Charm were owned — all reusing existing
  // fields/mechanics rather than new ones. `meta.selectedHull` is ignored
  // while a faction is active; it's restored the moment the player selects
  // "unaligned" (factionId null) again.
  const faction = meta.selectedFaction ? getPlayableFaction(meta.selectedFaction) : null;
  const hull = getHull(faction ? faction.hullId : meta.selectedHull);
  const { extraHeldWeapons, startingAmmoMultiplier, startingArmaments } = cargoLoadoutFor(meta.ownedCargoTiers);
  if (faction && !extraHeldWeapons.includes(faction.extraHeldWeapon)) {
    extraHeldWeapons.push(faction.extraHeldWeapon);
  }
  const grantedCharm = faction ? faction.grantsCharm : null;
  const { damageMultipliers, extraMaxHull, armamentDamageMult, speedMult } = workshopBonusesFor(meta.ownedWorkshopUpgrades);
  return {
    hull,
    extraHeldWeapons,
    startingAmmoMultiplier,
    startingArmaments,
    armamentDamageMult,
    speedMult,
    charmEffects: charmEffectsFor([...meta.ownedCharms, ...(grantedCharm ? [grantedCharm] : [])]),
    faction: meta.selectedFaction, // for the combat-triangle multiplier (data/factions.mjs)
    craftedDamageMultipliers: damageMultipliers, // Workshop upgrades — data/meta.mjs
    extraMaxHull, // flat bonus on top of the selected hull's own maxHull
    charms: {
      steadyHands: meta.ownedCharms.includes(CHARM_IDS.STEADY_HANDS) || grantedCharm === CHARM_IDS.STEADY_HANDS,
      lastGasp: meta.ownedCharms.includes(CHARM_IDS.LAST_GASP) || grantedCharm === CHARM_IDS.LAST_GASP,
      firstHaul: meta.ownedCharms.includes(CHARM_IDS.FIRST_HAUL) || grantedCharm === CHARM_IDS.FIRST_HAUL,
    },
  };
}

// Called once a run ends (main.mjs, on `run.over`) — folds its banked
// Salvage and best-run stats into the persistent meta state. Does not
// save to storage itself, so a caller can batch other changes (if any)
// into the same write.
export function recordRunResult(meta, run) {
  const banked = Math.round(run.bankedSalvage);
  meta.salvage += banked;
  meta.stats.totalSalvageEarned += banked;
  meta.stats.runsPlayed += 1;
  const reefsCleared = run.outcome === 'victory' ? run.reefCount : run.reefIndex;
  meta.stats.bestReefsCleared = Math.max(meta.stats.bestReefsCleared, reefsCleared);
  meta.stats.deepestReefReached = Math.max(meta.stats.deepestReefReached, run.reefIndex + 1);
  // The Workshop's rare-drop currency — one Kraken Scale per run in which
  // The Kraken's Anchor was actually defeated (run.bossDefeated, set by
  // main.mjs/tools on a boss kill event), regardless of whether the
  // voyage was ultimately won or lost afterward — killing the boss is the
  // achievement being rewarded, not surviving the rest of the voyage.
  if (run.bossDefeated) meta.krakenScales += 1;
  // Clearing a stage for the first time unlocks the next one.
  if (run.outcome === 'victory' && run.stage && run.stage >= meta.highestStageUnlocked) {
    meta.highestStageUnlocked = run.stage + 1;
  }
}
