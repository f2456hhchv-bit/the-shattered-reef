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
  CHARM_LIST, CHARM_IDS,
} from '../data/meta.mjs';

const STORAGE_KEY = 'shatteredReef.meta.v1';

export function createDefaultMeta() {
  return {
    salvage: 0,
    ownedHulls: [HULL_IDS.SLOOP],
    selectedHull: HULL_IDS.SLOOP,
    ownedCargoTiers: [],
    ownedCharms: [],
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
    return {
      ...defaults,
      ...parsed,
      stats: { ...defaults.stats, ...(parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {}) },
      ownedHulls: Array.isArray(parsed.ownedHulls) ? parsed.ownedHulls : defaults.ownedHulls,
      ownedCargoTiers: Array.isArray(parsed.ownedCargoTiers) ? parsed.ownedCargoTiers : defaults.ownedCargoTiers,
      ownedCharms: Array.isArray(parsed.ownedCharms) ? parsed.ownedCharms : defaults.ownedCharms,
    };
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
  const hull = getHull(meta.selectedHull);
  const { extraHeldWeapons, startingAmmoMultiplier } = cargoLoadoutFor(meta.ownedCargoTiers);
  return {
    hull,
    extraHeldWeapons,
    startingAmmoMultiplier,
    charms: {
      steadyHands: meta.ownedCharms.includes(CHARM_IDS.STEADY_HANDS),
      lastGasp: meta.ownedCharms.includes(CHARM_IDS.LAST_GASP),
      firstHaul: meta.ownedCharms.includes(CHARM_IDS.FIRST_HAUL),
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
}
