import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HULL_IDS, SHIP_HULLS, tuningForHull,
  CARGO_TIER_IDS, cargoLoadoutFor,
  CHARM_IDS, CHARMS,
  PLAYABLE_FACTIONS, getPlayableFaction,
  WORKSHOP_UPGRADE_IDS, WORKSHOP_UPGRADES,
} from '../src/data/meta.mjs';
import { FACTION_IDS, FACTION_LIST } from '../src/data/factions.mjs';
import { ENEMIES } from '../src/data/enemies.mjs';
import { WEAPON_IDS } from '../src/data/weapons.mjs';
import {
  createDefaultMeta, loadMeta, saveMeta,
  purchaseHull, selectHull, purchaseCargoTier, purchaseCharm,
  purchaseFaction, selectFaction,
  purchaseWorkshopUpgrade, canAffordWorkshopUpgrade,
  resolveLoadout, recordRunResult,
} from '../src/engine/meta.mjs';
import { DEFAULT_BOAT_TUNING, MAX_HULL } from '../src/engine/boat.mjs';
import { createRun, checkSunk, addSalvage, BASELINE_LOADOUT } from '../src/engine/run.mjs';

// A minimal in-memory stand-in for window.localStorage, so meta.mjs's
// storage-injection design is actually exercised the same way main.mjs
// uses it, without needing a browser.
function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    _dump: () => store,
  };
}

test('tuningForHull: the Sloop matches the baseline tuning/hull exactly', () => {
  const t = tuningForHull(SHIP_HULLS[HULL_IDS.SLOOP]);
  assert.deepEqual(t, DEFAULT_BOAT_TUNING);
  assert.equal(SHIP_HULLS[HULL_IDS.SLOOP].maxHull, MAX_HULL);
});

test('tuningForHull: the Longboat is tankier and slower, the Skiff is faster and frailer', () => {
  const longboat = tuningForHull(SHIP_HULLS[HULL_IDS.LONGBOAT]);
  const skiff = tuningForHull(SHIP_HULLS[HULL_IDS.SKIFF]);
  assert.ok(SHIP_HULLS[HULL_IDS.LONGBOAT].maxHull > MAX_HULL);
  assert.ok(longboat.maxSpeed < DEFAULT_BOAT_TUNING.maxSpeed);
  assert.ok(SHIP_HULLS[HULL_IDS.SKIFF].maxHull < MAX_HULL);
  assert.ok(skiff.maxSpeed > DEFAULT_BOAT_TUNING.maxSpeed);
});

test('cargoLoadoutFor combines owned tiers additively', () => {
  const none = cargoLoadoutFor([]);
  assert.deepEqual(none, { extraHeldWeapons: [], startingAmmoMultiplier: 1 });

  const some = cargoLoadoutFor([CARGO_TIER_IDS.CHAIN_LOCKER, CARGO_TIER_IDS.FORWARD_MAGAZINE]);
  assert.deepEqual(some.extraHeldWeapons, ['chain_shot']);
  assert.equal(some.startingAmmoMultiplier, 1.5);

  const all = cargoLoadoutFor([
    CARGO_TIER_IDS.CHAIN_LOCKER, CARGO_TIER_IDS.DEEP_STORES, CARGO_TIER_IDS.FORWARD_MAGAZINE,
  ]);
  assert.deepEqual(all.extraHeldWeapons.sort(), ['chain_shot', 'depth_charges']);
});

test('createDefaultMeta starts with zero Salvage, only the Sloop owned/selected, nothing else bought', () => {
  const meta = createDefaultMeta();
  assert.equal(meta.salvage, 0);
  assert.deepEqual(meta.ownedHulls, [HULL_IDS.SLOOP]);
  assert.equal(meta.selectedHull, HULL_IDS.SLOOP);
  assert.deepEqual(meta.ownedCargoTiers, []);
  assert.deepEqual(meta.ownedCharms, []);
});

test('loadMeta returns defaults when storage is empty, and never throws on corrupt data', () => {
  assert.deepEqual(loadMeta(fakeStorage()), createDefaultMeta());
  const corrupt = fakeStorage({ 'shatteredReef.meta.v1': '{not valid json' });
  assert.deepEqual(loadMeta(corrupt), createDefaultMeta());
  const wrongShape = fakeStorage({ 'shatteredReef.meta.v1': '"just a string"' });
  assert.deepEqual(loadMeta(wrongShape), createDefaultMeta());
});

test('saveMeta then loadMeta round-trips a modified meta state', () => {
  const storage = fakeStorage();
  const meta = createDefaultMeta();
  meta.salvage = 250;
  purchaseHull(meta, HULL_IDS.LONGBOAT);
  purchaseCargoTier(meta, CARGO_TIER_IDS.CHAIN_LOCKER);
  purchaseCharm(meta, CHARM_IDS.FIRST_HAUL);
  assert.equal(saveMeta(storage, meta), true);

  const loaded = loadMeta(storage);
  assert.equal(loaded.salvage, meta.salvage);
  assert.deepEqual(loaded.ownedHulls.sort(), meta.ownedHulls.sort());
  assert.deepEqual(loaded.ownedCargoTiers, meta.ownedCargoTiers);
  assert.deepEqual(loaded.ownedCharms, meta.ownedCharms);
});

test('loadMeta merges an older/partial save onto current defaults rather than dropping fields', () => {
  const storage = fakeStorage({ 'shatteredReef.meta.v1': JSON.stringify({ salvage: 40 }) });
  const loaded = loadMeta(storage);
  assert.equal(loaded.salvage, 40);
  assert.deepEqual(loaded.ownedHulls, [HULL_IDS.SLOOP]);
  assert.deepEqual(loaded.stats, createDefaultMeta().stats);
});

test('purchaseHull: refuses without enough Salvage, refuses a re-purchase, otherwise deducts cost and owns it', () => {
  const meta = createDefaultMeta();
  const poor = purchaseHull(meta, HULL_IDS.LONGBOAT);
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, 'cannot_afford');
  assert.equal(meta.ownedHulls.includes(HULL_IDS.LONGBOAT), false);

  meta.salvage = SHIP_HULLS[HULL_IDS.LONGBOAT].cost;
  const bought = purchaseHull(meta, HULL_IDS.LONGBOAT);
  assert.equal(bought.ok, true);
  assert.equal(meta.salvage, 0);
  assert.ok(meta.ownedHulls.includes(HULL_IDS.LONGBOAT));

  const again = purchaseHull(meta, HULL_IDS.LONGBOAT);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'already_owned');
});

test('selectHull only switches to an owned hull', () => {
  const meta = createDefaultMeta();
  assert.equal(selectHull(meta, HULL_IDS.SKIFF), false, 'not owned yet');
  assert.equal(meta.selectedHull, HULL_IDS.SLOOP);
  meta.ownedHulls.push(HULL_IDS.SKIFF);
  assert.equal(selectHull(meta, HULL_IDS.SKIFF), true);
  assert.equal(meta.selectedHull, HULL_IDS.SKIFF);
});

test('purchaseCargoTier and purchaseCharm follow the same afford/already-owned rules', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  assert.equal(purchaseCargoTier(meta, CARGO_TIER_IDS.DEEP_STORES).ok, true);
  assert.equal(purchaseCargoTier(meta, CARGO_TIER_IDS.DEEP_STORES).ok, false);
  assert.equal(purchaseCharm(meta, CHARM_IDS.LAST_GASP).ok, true);
  assert.equal(purchaseCharm(meta, CHARM_IDS.LAST_GASP).ok, false);
});

test('resolveLoadout turns owned unlocks into the plain loadout createRun expects', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseHull(meta, HULL_IDS.SKIFF);
  selectHull(meta, HULL_IDS.SKIFF);
  purchaseCargoTier(meta, CARGO_TIER_IDS.CHAIN_LOCKER);
  purchaseCharm(meta, CHARM_IDS.STEADY_HANDS);

  const loadout = resolveLoadout(meta);
  assert.equal(loadout.hull.id, HULL_IDS.SKIFF);
  assert.deepEqual(loadout.extraHeldWeapons, ['chain_shot']);
  assert.equal(loadout.charms.steadyHands, true);
  assert.equal(loadout.charms.lastGasp, false);
});

test('a fresh meta state resolves to BASELINE_LOADOUT-equivalent stats', () => {
  const loadout = resolveLoadout(createDefaultMeta());
  assert.equal(loadout.hull.id, BASELINE_LOADOUT.hull.id);
  assert.deepEqual(loadout.extraHeldWeapons, BASELINE_LOADOUT.extraHeldWeapons);
  assert.equal(loadout.startingAmmoMultiplier, BASELINE_LOADOUT.startingAmmoMultiplier);
  assert.deepEqual(loadout.charms, BASELINE_LOADOUT.charms);
});

test('recordRunResult banks Salvage into meta and tracks best-run stats across runs', () => {
  const meta = createDefaultMeta();
  recordRunResult(meta, { bankedSalvage: 40, outcome: 'sunk', reefIndex: 1, reefCount: 3 });
  assert.equal(meta.salvage, 40);
  assert.equal(meta.stats.runsPlayed, 1);
  assert.equal(meta.stats.bestReefsCleared, 1);
  assert.equal(meta.stats.deepestReefReached, 2);

  recordRunResult(meta, { bankedSalvage: 90, outcome: 'victory', reefIndex: 2, reefCount: 3 });
  assert.equal(meta.salvage, 130);
  assert.equal(meta.stats.runsPlayed, 2);
  assert.equal(meta.stats.bestReefsCleared, 3, 'a later, better run should raise the best-run tally');
  assert.equal(meta.stats.deepestReefReached, 3);

  // A worse run afterward should not lower the recorded best.
  recordRunResult(meta, { bankedSalvage: 5, outcome: 'sunk', reefIndex: 0, reefCount: 3 });
  assert.equal(meta.stats.bestReefsCleared, 3);
});

// --- run.mjs integration: hull selection, cargo loadout, charms --------

test('createRun applies a selected hull\'s maxHull and tuning', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseHull(meta, HULL_IDS.LONGBOAT);
  selectHull(meta, HULL_IDS.LONGBOAT);
  const run = createRun(1, resolveLoadout(meta));
  assert.equal(run.boat.maxHull, SHIP_HULLS[HULL_IDS.LONGBOAT].maxHull);
  assert.equal(run.boat.health, SHIP_HULLS[HULL_IDS.LONGBOAT].maxHull);
  assert.deepEqual(run.tuning, tuningForHull(SHIP_HULLS[HULL_IDS.LONGBOAT]));
});

test('createRun applies a Cargo Loadout\'s extra held weapons and starting ammo bonus', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseCargoTier(meta, CARGO_TIER_IDS.CHAIN_LOCKER);
  purchaseCargoTier(meta, CARGO_TIER_IDS.FORWARD_MAGAZINE);
  const run = createRun(2, resolveLoadout(meta));
  assert.ok(run.weapons.heldWeapons.has('chain_shot'));
  assert.ok(run.weapons.ammo.chain_shot > 0);
});

test('the Last Gasp charm revives the boat at 1 hull exactly once per run instead of ending it', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseCharm(meta, CHARM_IDS.LAST_GASP);
  const run = createRun(3, resolveLoadout(meta));

  run.boat.health = 0;
  const first = checkSunk(run);
  assert.equal(first, 'revived');
  assert.equal(run.boat.health, 1);
  assert.equal(run.over, false);

  run.boat.health = 0;
  const second = checkSunk(run);
  assert.equal(second, true, 'Last Gasp should not trigger a second time in the same run');
  assert.equal(run.over, true);
  assert.equal(run.outcome, 'sunk');
});

test('without Last Gasp, checkSunk ends the run on the first 0-hull frame as before', () => {
  const run = createRun(4); // BASELINE_LOADOUT — no charms
  run.boat.health = 0;
  assert.equal(checkSunk(run), true);
});

test('the First Haul charm boosts Salvage gained only on the first reef', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseCharm(meta, CHARM_IDS.FIRST_HAUL);
  const run = createRun(5, resolveLoadout(meta));

  addSalvage(run, 10);
  assert.equal(run.reefSalvage, 10 * CHARMS[CHARM_IDS.FIRST_HAUL].firstReefSalvageMultiplier);

  run.reefIndex = 1; // simulate having advanced past reef 1
  run.reefSalvage = 0;
  addSalvage(run, 10);
  assert.equal(run.reefSalvage, 10, 'no bonus once past the first reef');
});

// --- Playable factions (post-slice) --------------------------------------

test('createDefaultMeta starts unaligned, owning no factions', () => {
  const meta = createDefaultMeta();
  assert.deepEqual(meta.ownedFactions, []);
  assert.equal(meta.selectedFaction, null);
});

test('purchaseFaction respects cost/ownership, selectFaction respects ownership (or null for unaligned)', () => {
  const meta = createDefaultMeta();
  meta.salvage = 50;
  let res = purchaseFaction(meta, FACTION_IDS.REAVERS);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'cannot_afford');

  meta.salvage = 1000;
  res = purchaseFaction(meta, FACTION_IDS.REAVERS);
  assert.equal(res.ok, true);
  assert.ok(meta.ownedFactions.includes(FACTION_IDS.REAVERS));
  assert.equal(meta.salvage, 1000 - PLAYABLE_FACTIONS[FACTION_IDS.REAVERS].cost);

  assert.equal(purchaseFaction(meta, FACTION_IDS.REAVERS).ok, false, 'cannot buy the same faction twice');

  assert.equal(selectFaction(meta, FACTION_IDS.WYRDTIDE), false, 'cannot select an unowned faction');
  assert.equal(selectFaction(meta, FACTION_IDS.REAVERS), true);
  assert.equal(meta.selectedFaction, FACTION_IDS.REAVERS);
  assert.equal(selectFaction(meta, null), true, 'null (unaligned) is always selectable');
  assert.equal(meta.selectedFaction, null);
});

test('resolveLoadout with no faction selected matches the baseline exactly (backward compatible)', () => {
  const meta = createDefaultMeta();
  const loadout = resolveLoadout(meta);
  assert.equal(loadout.faction, null);
  assert.equal(loadout.hull.id, HULL_IDS.SLOOP);
  assert.deepEqual(loadout.extraHeldWeapons, []);
});

test('resolveLoadout with a faction selected overrides the hull, adds its weapon bias, and grants its passive charm', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseFaction(meta, FACTION_IDS.IRON_ACCORD);
  selectFaction(meta, FACTION_IDS.IRON_ACCORD);
  const faction = getPlayableFaction(FACTION_IDS.IRON_ACCORD);

  const loadout = resolveLoadout(meta);
  assert.equal(loadout.faction, FACTION_IDS.IRON_ACCORD);
  assert.equal(loadout.hull.id, faction.hullId, 'the faction\'s hull should override the separately-selected hull');
  assert.ok(loadout.extraHeldWeapons.includes(faction.extraHeldWeapon));
  assert.equal(loadout.charms.steadyHands, true, 'Iron Accord grants Steady Hands\' effect for free');
  assert.equal(loadout.charms.lastGasp, false);
});

test('a faction\'s weapon bias does not duplicate one already granted by an owned Cargo Loadout tier', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  const faction = getPlayableFaction(FACTION_IDS.REAVERS); // grants Chain Shot
  assert.equal(faction.extraHeldWeapon, WEAPON_IDS.CHAIN_SHOT, 'precondition: this test needs an overlap to be meaningful');
  // Chain Locker also grants Chain Shot.
  purchaseCargoTier(meta, CARGO_TIER_IDS.CHAIN_LOCKER);
  purchaseFaction(meta, FACTION_IDS.REAVERS);
  selectFaction(meta, FACTION_IDS.REAVERS);

  const loadout = resolveLoadout(meta);
  const count = loadout.extraHeldWeapons.filter((w) => w === faction.extraHeldWeapon).length;
  assert.equal(count, 1, 'the same weapon id should not appear twice in extraHeldWeapons');
});

test('a faction\'s granted passive stacks with (does not replace) a separately owned charm', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseCharm(meta, CHARM_IDS.FIRST_HAUL);
  purchaseFaction(meta, FACTION_IDS.REAVERS); // grants Last Gasp
  selectFaction(meta, FACTION_IDS.REAVERS);

  const loadout = resolveLoadout(meta);
  assert.equal(loadout.charms.firstHaul, true, 'separately owned charm should still apply');
  assert.equal(loadout.charms.lastGasp, true, 'faction-granted charm should also apply');
});

test('selecting a faction actually reaches a real run: hull, held weapon, and combat-triangle faction all land on run', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  purchaseFaction(meta, FACTION_IDS.REAVERS);
  selectFaction(meta, FACTION_IDS.REAVERS);
  const faction = getPlayableFaction(FACTION_IDS.REAVERS);

  const run = createRun(9, resolveLoadout(meta));
  assert.equal(run.faction, FACTION_IDS.REAVERS);
  assert.equal(run.boat.maxHull, SHIP_HULLS[faction.hullId].maxHull);
  assert.ok(run.weapons.heldWeapons.has(faction.extraHeldWeapon));
});

// --- Workshop / Crafting (post-slice) ------------------------------------

test('createDefaultMeta starts with no Kraken Scales and no Workshop upgrades', () => {
  const meta = createDefaultMeta();
  assert.equal(meta.krakenScales, 0);
  assert.deepEqual(meta.ownedWorkshopUpgrades, []);
});

test('purchaseWorkshopUpgrade requires BOTH enough Salvage and enough Kraken Scales', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  meta.krakenScales = 0;
  let res = purchaseWorkshopUpgrade(meta, WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'cannot_afford', 'Salvage alone should not be enough without a Kraken Scale');

  meta.krakenScales = 1;
  res = purchaseWorkshopUpgrade(meta, WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS);
  assert.equal(res.ok, true);
  assert.ok(meta.ownedWorkshopUpgrades.includes(WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS));
  assert.equal(meta.krakenScales, 0, 'the Kraken Scale should be spent');
  assert.equal(meta.salvage, 1000 - WORKSHOP_UPGRADES[WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS].salvageCost);

  assert.equal(purchaseWorkshopUpgrade(meta, WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS).ok, false, 'cannot craft the same upgrade twice');
});

test('resolveLoadout with no Workshop upgrades owned matches baseline (no crafted multipliers, no extra hull)', () => {
  const meta = createDefaultMeta();
  const loadout = resolveLoadout(meta);
  assert.deepEqual(loadout.craftedDamageMultipliers, {});
  assert.equal(loadout.extraMaxHull, 0);
});

test('resolveLoadout resolves owned Workshop upgrades into per-weapon multipliers and a flat hull bonus', () => {
  const meta = createDefaultMeta();
  meta.salvage = 10000;
  meta.krakenScales = 10;
  purchaseWorkshopUpgrade(meta, WORKSHOP_UPGRADE_IDS.REINFORCED_BARRELS); // Cannonballs x1.2
  purchaseWorkshopUpgrade(meta, WORKSHOP_UPGRADE_IDS.REINFORCED_RIBS); // +15 max hull

  const loadout = resolveLoadout(meta);
  assert.equal(loadout.craftedDamageMultipliers[WEAPON_IDS.CANNONBALLS], 1.2);
  assert.equal(loadout.extraMaxHull, 15);

  const run = createRun(11, loadout);
  assert.equal(run.boat.maxHull, SHIP_HULLS[HULL_IDS.SLOOP].maxHull + 15, 'extraMaxHull should reach the actual boat');
  assert.deepEqual(run.craftedDamageMultipliers, loadout.craftedDamageMultipliers);
});

test('recordRunResult awards exactly one Kraken Scale when run.bossDefeated is true, none otherwise', () => {
  const meta = createDefaultMeta();
  const run = createRun(12);
  run.bossDefeated = true;
  recordRunResult(meta, run);
  assert.equal(meta.krakenScales, 1);

  const meta2 = createDefaultMeta();
  const run2 = createRun(13);
  run2.bossDefeated = false;
  recordRunResult(meta2, run2);
  assert.equal(meta2.krakenScales, 0);
});

// Regression (Opus review, 2026-09-28): loadMeta promises never to throw,
// but resolveLoadout() throws on an unknown/unowned selection — a stale or
// hand-edited save must not be able to crash every "Set Sail".
test('loadMeta sanitizes stale/unowned selections so resolveLoadout can never throw on a loaded save', () => {
  const cases = [
    { selectedFaction: 'not_a_faction', ownedFactions: ['not_a_faction'] },
    { selectedFaction: FACTION_IDS.REAVERS, ownedFactions: [] }, // selected but not owned
    { selectedHull: 'galleon', ownedHulls: ['sloop', 'galleon'] },
    { selectedHull: HULL_IDS.SKIFF, ownedHulls: [HULL_IDS.SLOOP] }, // selected but not owned
    { ownedHulls: [] }, // lost the always-owned Sloop
    { salvage: 'lots', krakenScales: null },
  ];
  for (const bad of cases) {
    const storage = fakeStorage({ 'shatteredReef.meta.v1': JSON.stringify({ ...createDefaultMeta(), ...bad }) });
    const meta = loadMeta(storage);
    assert.doesNotThrow(() => resolveLoadout(meta), `resolveLoadout threw for ${JSON.stringify(bad)}`);
    assert.ok(Number.isFinite(meta.salvage) && Number.isFinite(meta.krakenScales));
  }
});

test('loadMeta keeps a valid, owned faction/hull selection untouched', () => {
  const saved = { ...createDefaultMeta(), ownedFactions: [FACTION_IDS.WYRDTIDE], selectedFaction: FACTION_IDS.WYRDTIDE,
    ownedHulls: [HULL_IDS.SLOOP, HULL_IDS.SKIFF], selectedHull: HULL_IDS.SKIFF, krakenScales: 3 };
  const meta = loadMeta(fakeStorage({ 'shatteredReef.meta.v1': JSON.stringify(saved) }));
  assert.equal(meta.selectedFaction, FACTION_IDS.WYRDTIDE);
  assert.equal(meta.selectedHull, HULL_IDS.SKIFF);
  assert.equal(meta.krakenScales, 3);
});

// The weapon-bias rule, enforced (2026-09-28): "cover your weakness" —
// each faction's starting weapon must counter at least one enemy of the
// faction that beats it. Guards against the biases drifting back to
// arbitrary picks (the original set satisfied no consistent rule).
test('every faction\'s weapon bias counters an enemy of the faction that beats it', () => {
  for (const pf of Object.values(PLAYABLE_FACTIONS)) {
    const predator = FACTION_LIST.find((f) => f.beats === pf.id);
    assert.ok(predator, `${pf.id} should have a predator in the triangle`);
    const predatorCounters = Object.values(ENEMIES)
      .filter((e) => e.faction === predator.id)
      .map((e) => e.counter);
    assert.ok(predatorCounters.length > 0, `${predator.id} should field at least one enemy`);
    assert.ok(predatorCounters.includes(pf.extraHeldWeapon),
      `${pf.id} starts with ${pf.extraHeldWeapon}, which counters none of its predator (${predator.id})'s enemies: ${predatorCounters}`);
  }
});

test('the three factions grant three different passives (no duplicated identity)', () => {
  const charms = Object.values(PLAYABLE_FACTIONS).map((f) => f.grantsCharm);
  assert.equal(new Set(charms).size, charms.length);
});

// --- Stages (2026-09-28) ------------------------------------------------------
test('stages: a fresh save starts with stage 1 unlocked; clearing it unlocks stage 2', () => {
  const meta = createDefaultMeta();
  assert.equal(meta.highestStageUnlocked, 1);
  recordRunResult(meta, { bankedSalvage: 0, outcome: 'sunk', reefIndex: 2, reefCount: 5, stage: 1 });
  assert.equal(meta.highestStageUnlocked, 1, 'sinking unlocks nothing');
  recordRunResult(meta, { bankedSalvage: 0, outcome: 'victory', reefIndex: 4, reefCount: 5, stage: 1 });
  assert.equal(meta.highestStageUnlocked, 2);
  recordRunResult(meta, { bankedSalvage: 0, outcome: 'victory', reefIndex: 4, reefCount: 5, stage: 1 });
  assert.equal(meta.highestStageUnlocked, 2, 'replaying a cleared stage does not skip ahead');
});

test('stages: a corrupt highestStageUnlocked loads as 1', () => {
  const store = new Map([['shatteredReef.meta.v1', JSON.stringify({ highestStageUnlocked: 'lots' })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(loadMeta(storage).highestStageUnlocked, 1);
});
