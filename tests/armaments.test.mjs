// The depth pass (2026-09-29): treasure chests in dead ends, armaments
// that fire on their own, elites guarding treasure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, checkSunk, retryLevel, TILE_SIZE } from '../src/engine/run.mjs';
import { ARMAMENTS, ARMAMENT_MAX_LEVEL } from '../src/data/armaments.mjs';
import {
  armamentLevel, grantArmament, rollArmamentChoices, stepArmaments, spiritPositions, chainLightning,
} from '../src/engine/armaments.mjs';
import { stepCombat, resolveHits, cleanupProjectiles } from '../src/engine/combat.mjs';
import { createEnemy, currentCounter } from '../src/engine/enemies.mjs';
import { ENEMY_IDS } from '../src/data/enemies.mjs';
import { collectPickups } from '../src/engine/pickups.mjs';
import { sampleField } from '../src/engine/terrain.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

// An open-water test arena: no rock anywhere.
function arena() {
  const run = createRun(1);
  const W = 60;
  run.grid = { width: W, height: W, tiles: Array.from({ length: W }, () => Array(W).fill(0)) };
  run.coast = null;
  run.enemies = [];
  run.weapons.projectiles = [];
  run.boat.x = 400; run.boat.y = 400; run.boat.heading = 0; run.boat.vx = 0; run.boat.vy = 0;
  return run;
}
const world = (run) => ({ grid: run.grid, tileSize: run.tileSize, coast: null });

function simulate(run, seconds, enemy) {
  let dealt = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const ev = stepArmaments(run, 1 / 60, world(run), { rng: () => 0.5 }).events;
    stepCombat(run.weapons, 1 / 60, run.grid, run.tileSize, run.enemies);
    const hits = resolveHits(run.weapons, run.enemies, currentCounter);
    cleanupProjectiles(run.weapons);
    for (const e of [...ev, ...hits]) dealt += e.damage;
    if (enemy) { enemy.x = enemy.home.x; enemy.y = enemy.home.y; enemy.health = Math.max(enemy.health, 1); }
  }
  return dealt;
}

test('armaments: levels cap at 3 and maxed ones stop being offered', () => {
  const run = arena();
  for (let i = 0; i < 5; i++) grantArmament(run, 'harpoon');
  assert.equal(armamentLevel(run, 'harpoon'), ARMAMENT_MAX_LEVEL);
  for (let i = 0; i < 50; i++) assert.ok(!rollArmamentChoices(run, Math.random, 3).includes('harpoon'));
  assert.equal(grantArmament(run, 'nonsense'), 0);
  for (const a of ARMAMENTS) for (let i = 0; i < 3; i++) grantArmament(run, a.id);
  assert.deepEqual(rollArmamentChoices(run), []);
});

test('armaments: every one actually damages an enemy in range, on its own', () => {
  for (const a of ARMAMENTS) {
    const run = arena();
    grantArmament(run, a.id);
    // St Elmo's Fire rides on Cannonball hits: test it separately below.
    if (a.id === 'st_elmos_fire') continue;
    // Place the target where each armament reaches: behind for the stern
    // chaser, beside for the broadside, on the wake for kegs.
    let x = run.boat.x + 70; let y = run.boat.y;
    if (a.id === 'stern_chaser') x = run.boat.x - 70;
    if (a.id === 'broadside') { x = run.boat.x; y = run.boat.y + 60; }
    if (a.id === 'sea_spirit') x = run.boat.x + a.orbit;
    if (a.id === 'mortar') x = run.boat.x + 150;
    const e = createEnemy(ENEMY_IDS.PIRATE_BRIG, x, y);
    e.maxHealth = e.health = 5000; e.aggro = true;
    run.enemies = [e];
    if (a.id === 'powder_kegs') {
      // Drops kegs only under way; sail past the enemy.
      run.boat.vx = 90; run.boat.x = x - 120;
      let dealt = 0;
      for (let i = 0; i < 9 * 60; i++) {
        run.boat.x += 90 / 60; if (run.boat.x > x + 40) run.boat.x = x - 120;
        stepArmaments(run, 1 / 60, world(run));
        stepCombat(run.weapons, 1 / 60, run.grid, run.tileSize, run.enemies);
        for (const h of resolveHits(run.weapons, run.enemies, currentCounter)) dealt += h.damage;
        cleanupProjectiles(run.weapons);
      }
      assert.ok(dealt > 0, 'powder kegs never went off');
      continue;
    }
    const dealt = simulate(run, 6, e);
    assert.ok(dealt > 0, `${a.name} dealt no damage`);
  }
});

test('armaments: higher levels deal more over time', () => {
  for (const id of ['swivel_gun', 'harpoon', 'sea_spirit']) {
    const out = [1, 3].map((lv) => {
      const run = arena();
      for (let i = 0; i < lv; i++) grantArmament(run, id);
      const e = createEnemy(ENEMY_IDS.PIRATE_BRIG, run.boat.x + (id === 'sea_spirit' ? 36 : 80), run.boat.y);
      e.maxHealth = e.health = 5000; e.aggro = true; run.enemies = [e];
      return simulate(run, 8, e);
    });
    assert.ok(out[1] > out[0] * 1.3, `${id}: lv3 ${out[1]} vs lv1 ${out[0]}`);
  }
});

test('armaments: Sea Spirit wisps circle the boat', () => {
  const run = arena();
  assert.deepEqual(spiritPositions(run), []);
  grantArmament(run, 'sea_spirit'); grantArmament(run, 'sea_spirit');
  const ps = spiritPositions(run);
  assert.equal(ps.length, 2);
  for (const p of ps) assert.ok(Math.abs(Math.hypot(p.x - run.boat.x, p.y - run.boat.y) - 36) < 1e-6);
});

test("armaments: St Elmo's Fire arcs from a Cannonball hit to a neighbour, never from a blocked shot", () => {
  const run = arena();
  grantArmament(run, 'st_elmos_fire');
  const a = createEnemy(ENEMY_IDS.PIRATE_BRIG, 500, 400); const b = createEnemy(ENEMY_IDS.PIRATE_BRIG, 540, 400);
  run.enemies = [a, b];
  const hp = b.health;
  const out = chainLightning(run, [{ enemy: a, weaponId: 'cannonballs', damage: 20, killed: false }]);
  assert.equal(out.arcs.length, 1);
  assert.ok(b.health < hp);
  assert.equal(chainLightning(run, [{ enemy: a, weaponId: 'cannonballs', damage: 0, killed: false, blocked: true }]).arcs.length, 0);
  assert.equal(chainLightning(run, [{ enemy: a, weaponId: 'grapeshot', damage: 20, killed: false }]).arcs.length, 0);
});

test('armaments: the mortar only lobs at enemies that are awake', () => {
  const run = arena();
  grantArmament(run, 'mortar');
  const e = createEnemy(ENEMY_IDS.PIRATE_BRIG, run.boat.x + 150, run.boat.y);
  run.enemies = [e];
  for (let i = 0; i < 300; i++) stepArmaments(run, 1 / 60, world(run));
  assert.equal(run.weapons.projectiles.length, 0);
  e.aggro = true;
  for (let i = 0; i < 300; i++) stepArmaments(run, 1 / 60, world(run));
  assert.ok(run.weapons.projectiles.some((p) => p.weaponId === 'arm_mortar' && p.overLand));
});

test('chests: levels 1-4 hide chests in open water, and opening one reports a chest event', () => {
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const run = createRun(seed * 31);
    const chests = run.pickups.filter((p) => p.kind === 'chest');
    assert.ok(chests.length >= 1, `seed ${seed}: no chest on level 1`);
    total += chests.length;
    for (const c of chests) assert.ok(sampleField(run.coast, c.x, c.y) < -8, `seed ${seed}: chest on land`);
    const c = chests[0];
    const ev = collectPickups(run.pickups, { x: c.x, y: c.y }, 11, run.weapons);
    assert.ok(ev.some((e) => e.kind === 'chest'));
    assert.ok(c.collected);
  }
  assert.ok(total >= 20);
});

test('chests: they sit off the route — farther from the spawn than a typical pickup', () => {
  let chestD = 0; let n = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const run = createRun(seed * 17);
    for (const c of run.pickups.filter((p) => p.kind === 'chest')) { chestD += Math.hypot(c.x - run.boat.x, c.y - run.boat.y); n++; }
  }
  assert.ok(chestD / n > 5 * TILE_SIZE * 3, `chests average ${Math.round(chestD / n)}px from the spawn`);
});

test('elites: when a level has one, it guards a chest, is tougher and pays more, and starts asleep far from the spawn', () => {
  let found = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const run = createRun(seed * 13);
    // Walk to level 2-4 so there are several chests.
    for (const e of run.enemies.filter((x) => x.elite)) {
      found++;
      const plain = createEnemy(e.defId, 0, 0, makeSeededRng(1));
      assert.ok(e.maxHealth > plain.maxHealth * 2);
      assert.ok(e.contactDamage > plain.contactDamage);
      assert.ok(!e.aggro);
      assert.ok(Math.hypot(e.x - run.boat.x, e.y - run.boat.y) > 250);
      const chest = run.pickups.filter((p) => p.kind === 'chest').some((c) => Math.hypot(c.x - e.x, c.y - e.y) < 40);
      assert.ok(chest, 'elite not beside a chest');
    }
  }
  assert.ok(found >= 10, `only ${found} elites across 40 levels`);
});

test('retry keeps the armaments you arrived with, not ones found in the failed attempt', () => {
  const run = createRun(5);
  grantArmament(run, 'harpoon');
  // Level start snapshot is taken when a level is entered or a card is picked.
  run.levelStart.armaments = { harpoon: 1 };
  grantArmament(run, 'mortar'); // found during the doomed attempt
  run.boat.health = 0;
  assert.equal(checkSunk(run), true);
  assert.ok(retryLevel(run));
  assert.deepEqual(run.armaments, { harpoon: 1 });
});
