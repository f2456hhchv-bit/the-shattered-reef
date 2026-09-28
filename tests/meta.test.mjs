import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HULL_IDS, SHIP_HULLS, tuningForHull,
  CARGO_TIER_IDS, cargoLoadoutFor,
  CHARM_IDS, CHARMS,
} from '../src/data/meta.mjs';
import {
  createDefaultMeta, loadMeta, saveMeta,
  purchaseHull, selectHull, purchaseCargoTier, purchaseCharm,
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
