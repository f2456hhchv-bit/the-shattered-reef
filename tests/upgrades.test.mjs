import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/engine/run.mjs';
import { rollUpgradeChoices, applyUpgrade, upgradeLevel } from '../src/engine/upgrades.mjs';
import { UPGRADES } from '../src/data/upgrades.mjs';
import { tryFire, resolveHits, stepCombat, collectWeaponCache, effectiveWeapon, ammoMaxFor, createWeaponState, stepAmmoRegen } from '../src/engine/combat.mjs';
import { chooseAutoFire } from '../src/engine/aim.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

const N = 60; const grid = { width: N, height: N, tiles: Array.from({ length: N }, () => Array(N).fill(0)) };

test('three distinct cards are offered, and a maxed upgrade stops appearing', () => {
  const run = createRun(1, undefined, { stage: 1 });
  const rng = makeSeededRng(4);
  for (let i = 0; i < 20; i++) {
    const c = rollUpgradeChoices(run, rng);
    assert.equal(c.length, 3); assert.equal(new Set(c).size, 3);
  }
  for (let i = 0; i < 3; i++) assert.ok(applyUpgrade(run, 'heavy_shot'));
  assert.equal(applyUpgrade(run, 'heavy_shot'), false);
  for (let i = 0; i < 50; i++) assert.ok(!rollUpgradeChoices(run, rng).includes('heavy_shot'));
});

test('weapon-specific cards only show up where that weapon matters', () => {
  const s1 = createRun(2, undefined, { stage: 1 });
  const seen = new Set(); const rng = makeSeededRng(5);
  for (let i = 0; i < 200; i++) rollUpgradeChoices(s1, rng).forEach((id) => seen.add(id));
  assert.ok(!seen.has('greek_fire') && !seen.has('big_charges'), 'stage 1 has nothing to burn or depth-charge');
  const s3 = createRun(2, undefined, { stage: 3 });
  const seen3 = new Set();
  for (let i = 0; i < 200; i++) rollUpgradeChoices(s3, rng).forEach((id) => seen3.add(id));
  assert.ok(seen3.has('big_charges') && seen3.has('greek_fire'));
});

test('every upgrade applies and does what its card says', () => {
  for (const u of UPGRADES) {
    const run = createRun(3, undefined, { stage: 3 });
    for (const w of ['chain_shot', 'grapeshot', 'depth_charges', 'flame_barrels']) collectWeaponCache(run.weapons, w, 1);
    assert.ok(applyUpgrade(run, u.id), u.id);
    assert.equal(upgradeLevel(run, u.id), 1);
  }
  const run = createRun(4);
  applyUpgrade(run, 'twin_cannons');
  tryFire(run.weapons, 100, 100, 0);
  assert.equal(run.weapons.projectiles.length, 2);
  const r2 = createRun(4);
  const hull = r2.boat.maxHull; applyUpgrade(r2, 'hull_plating');
  assert.equal(r2.boat.maxHull, hull + 25);
  const r3 = createRun(4);
  const cd = effectiveWeapon(r3.weapons, 'cannonballs').cooldown; applyUpgrade(r3, 'quick_reload');
  assert.ok(effectiveWeapon(r3.weapons, 'cannonballs').cooldown < cd);
  const r4 = createRun(4, undefined, { stage: 2 }); collectWeaponCache(r4.weapons, 'grapeshot', 5);
  applyUpgrade(r4, 'deep_magazines');
  assert.equal(r4.weapons.ammo.grapeshot, ammoMaxFor(r4.weapons, 'grapeshot'));
  assert.ok(ammoMaxFor(r4.weapons, 'grapeshot') > 40);
});

test('Piercing Shot sends one cannonball through two enemies in a line', () => {
  const run = createRun(5);
  applyUpgrade(run, 'piercing_shot');
  const a = { id: 9001, x: 140, y: 100, radius: 8, health: 100, counter: 'cannonballs' };
  const b = { id: 9002, x: 175, y: 100, radius: 8, health: 100, counter: 'cannonballs' };
  tryFire(run.weapons, 100, 100, 0);
  let hits = 0;
  for (let i = 0; i < 40; i++) { stepCombat(run.weapons, 1 / 60, grid, 16, [a, b]); hits += resolveHits(run.weapons, [a, b]).length; }
  assert.equal(hits, 2);
  assert.ok(a.health < 100 && b.health < 100);
});

test('special weapons trickle ammo back on their own in a run', () => {
  const run = createRun(6, undefined, { stage: 2 });
  collectWeaponCache(run.weapons, 'grapeshot', 1);
  run.weapons.ammo.grapeshot = 0;
  for (let i = 0; i < 600; i++) stepAmmoRegen(run.weapons, 1 / 60);
  assert.ok(run.weapons.ammo.grapeshot >= 1);
  const plain = createWeaponState(); // no run: no trickle (charm tests rely on this)
  collectWeaponCache(plain, 'grapeshot', 1); plain.ammo.grapeshot = 0;
  stepAmmoRegen(plain, 10);
  assert.equal(plain.ammo.grapeshot, 0);
});

test('auto-fire spends a special weapon only on what it counters, and falls back to Cannonballs', () => {
  const s = createWeaponState(); collectWeaponCache(s, 'grapeshot', 10);
  const boat = { x: 100, y: 100 };
  const cutter = { id: 1, x: 160, y: 100, radius: 9, health: 20, counter: 'cannonballs', vx: 0, vy: 0 };
  const shark = { id: 2, x: 100, y: 180, radius: 9, health: 20, counter: 'grapeshot', vx: 0, vy: 0 };
  const opts = { effectiveWeapon: (id) => effectiveWeapon(s, id), ammoOf: (id) => (id === 'cannonballs' ? Infinity : s.ammo[id]), grid, tileSize: 16 };
  assert.equal(chooseAutoFire([cutter], boat, 'grapeshot', opts).weaponId, 'cannonballs');
  const both = chooseAutoFire([cutter, shark], boat, 'grapeshot', opts);
  assert.equal(both.weaponId, 'grapeshot'); assert.equal(both.target, shark);
  s.ammo.grapeshot = 0;
  assert.equal(chooseAutoFire([shark], boat, 'grapeshot', opts).weaponId, 'cannonballs');
});
