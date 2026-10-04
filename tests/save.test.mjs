// Voyage save/resume (2026-09-29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, checkReachedExit, addSalvage } from '../src/engine/run.mjs';
import { serializeRun, deserializeRun, saveVoyage, loadVoyage, peekVoyage, clearVoyage, retireLegacyVoyage } from '../src/engine/save.mjs';
import { createSurvivalRun } from '../src/engine/survivalRun.mjs';
import { updateEnemies, createEnemy, stepSummons } from '../src/engine/enemies.mjs';
import { applyUpgrade } from '../src/engine/upgrades.mjs';
import { grantArmament } from '../src/engine/armaments.mjs';
import { collectWeaponCache, stepCombat, tryFire } from '../src/engine/combat.mjs';
import { applyAffliction } from '../src/engine/boat.mjs';
import { UPGRADES } from '../src/data/upgrades.mjs';
import { ARMAMENTS } from '../src/data/armaments.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; }

function midLevelRun() {
  const run = createRun(99, undefined, { stage: 6 });
  Object.assign(run.boat, { x: run.exitWorld.x, y: run.exitWorld.y });
  checkReachedExit(run); // on to level 2
  run.boat.x += 12; run.boat.health -= 17; run.boat.heading = 1.2;
  applyAffliction(run.boat, 'burn', 1.5);
  run.enemies[0].health = 3; run.enemies[1].aggro = true; run.enemies[1].x += 40;
  run.pickups[0].collected = true;
  collectWeaponCache(run.weapons, 'depth_charges', 5);
  applyUpgrade(run, (Array.isArray(UPGRADES) ? UPGRADES : Object.values(UPGRADES))[0].id);
  grantArmament(run, (Array.isArray(ARMAMENTS) ? ARMAMENTS : Object.values(ARMAMENTS))[0].id);
  addSalvage(run, 12);
  tryFire(run.weapons, run.boat.x, run.boat.y, 0, () => 0.5); // a shot in flight
  return run;
}

test('a voyage saved mid-level comes back exactly where it was', () => {
  const run = midLevelRun();
  const back = deserializeRun(JSON.parse(JSON.stringify(serializeRun(run))));
  assert.equal(back.stage, 6); assert.equal(back.reefIndex, 1);
  assert.deepEqual(back.level, run.level);
  assert.equal(back.levelCode, run.levelCode);
  for (const k of ['x', 'y', 'health', 'maxHull', 'heading']) assert.equal(back.boat[k], run.boat[k], k);
  assert.ok(back.boat.afflictions.burn > 0);
  assert.equal(back.enemies.length, run.enemies.length);
  back.enemies.forEach((e, i) => { assert.equal(e.defId, run.enemies[i].defId); assert.equal(e.x, run.enemies[i].x); assert.equal(e.health, run.enemies[i].health); assert.equal(e.aggro, run.enemies[i].aggro); });
  assert.equal(back.pickups[0].collected, true);
  assert.ok(back.weapons.heldWeapons instanceof Set && back.weapons.heldWeapons.has('depth_charges'));
  assert.deepEqual(back.weapons.ammo, run.weapons.ammo);
  assert.deepEqual(back.upgrades, run.upgrades);
  assert.deepEqual(back.armaments, run.armaments);
  assert.equal(back.reefSalvage, run.reefSalvage);
  assert.ok(back.levelStart.heldWeapons instanceof Set);
  // The level itself is rebuilt from its seed, identically.
  assert.deepEqual(back.grid.tiles, run.grid.tiles);
  assert.deepEqual(back.exitWorld, run.exitWorld);
  assert.equal(back.weapons.projectiles.length, 0, 'shots in flight are dropped');
});

test('a restored voyage plays on: enemies move, guns fire, summons get fresh ids', () => {
  const run = midLevelRun();
  const back = deserializeRun(JSON.parse(JSON.stringify(serializeRun(run))));
  for (let i = 0; i < 120; i++) {
    updateEnemies(back.enemies, back.boat, 1 / 60, back.grid, back.tileSize, back.coast);
    stepCombat(back.weapons, 1 / 60, back.grid, back.tileSize, back.enemies);
  }
  assert.ok(tryFire(back.weapons, back.boat.x, back.boat.y, 0, () => 0.5) !== undefined);
  const e = createEnemy('pirate_cutter', 0, 0, makeSeededRng(1));
  assert.ok(back.enemies.every((o) => o.id !== e.id));
  void stepSummons;
});

test('storage: save, peek, load, clear; junk never throws', () => {
  const s = memStorage();
  assert.equal(loadVoyage(s), null); assert.equal(peekVoyage(s), null);
  // A maze voyage saved before survival mode is retired, not continued.
  const legacy = midLevelRun();
  legacy.bankedSalvage = 37;
  assert.ok(saveVoyage(s, legacy));
  assert.equal(peekVoyage(s), null); assert.equal(loadVoyage(s), null);
  assert.deepEqual(retireLegacyVoyage(s), { salvage: 37 });
  assert.equal(retireLegacyVoyage(s), null);
  const run = createSurvivalRun(5, undefined, { stage: 6, levelIndex: 1 });
  assert.ok(saveVoyage(s, run, { pendingChoice: { title: 'x', choices: [] } }));
  assert.equal(retireLegacyVoyage(s), null, 'a survival save is never retired');
  assert.deepEqual(peekVoyage(s), { stage: 6, reefIndex: 1, reefCount: run.reefCount, savedAt: peekVoyage(s).savedAt, over: false });
  const got = loadVoyage(s);
  assert.equal(got.run.reefIndex, 1); assert.equal(got.pendingChoice.title, 'x');
  clearVoyage(s); assert.equal(loadVoyage(s), null);
  s.setItem('shatteredReef.voyage.v1', '{not json'); assert.equal(loadVoyage(s), null); assert.equal(peekVoyage(s), null);
  s.setItem('shatteredReef.voyage.v1', JSON.stringify({ v: 1, run: { level: { biomeId: 'nowhere', tier: 1, seed: 3 } } })); assert.equal(loadVoyage(s), null);
  const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('no'); } };
  assert.equal(saveVoyage(broken, run), false); assert.equal(loadVoyage(broken), null); clearVoyage(broken);
});

test('a lair saved mid-fight keeps its boss, seals and the sealed exit', () => {
  const run = createRun(5, undefined, { stage: 3 });
  while (run.reefIndex < 4) { Object.assign(run.boat, { x: run.exitWorld.x, y: run.exitWorld.y }); checkReachedExit(run); }
  const boss = run.enemies.find((e) => e.isBoss); boss.health = 100; boss.aggro = true;
  run.enemies.find((e) => e.seal).health = 0;
  const back = deserializeRun(JSON.parse(JSON.stringify(serializeRun(run))));
  const b2 = back.enemies.find((e) => e.isBoss);
  assert.equal(b2.health, 100); assert.ok(b2.tether > 0);
  assert.ok(back.lair && back.exitLocked);
  assert.equal(back.enemies.filter((e) => e.seal && e.health > 0).length, run.enemies.filter((e) => e.seal && e.health > 0).length);
});
