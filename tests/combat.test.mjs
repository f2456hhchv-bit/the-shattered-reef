import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeaponState, setActiveWeapon, canFire, tryFire, ammoFor,
  stepCombat, cleanupProjectiles, resolveHits, applyDamageToEnemy, stepBurn,
} from '../src/engine/combat.mjs';
import { WEAPON_IDS, WEAPONS, damageAgainst } from '../src/data/weapons.mjs';
import { ENEMY_IDS } from '../src/data/enemies.mjs';
import { createEnemy } from '../src/engine/enemies.mjs';

function openGrid(width = 60, height = 60) {
  const tiles = Array.from({ length: height }, () => Array(width).fill(0));
  return { width, height, tiles };
}

// Mirrors the game loop's per-frame order (stepCombat then resolveHits)
// for a direct-hit weapon: runs until something gets hit or the
// projectile is gone, whichever comes first.
function fireDirectUntilHit(state, enemies, grid, tileSize, maxFrames = 200) {
  for (let i = 0; i < maxFrames; i++) {
    stepCombat(state, 1 / 30, grid, tileSize);
    const events = resolveHits(state, enemies);
    if (events.length > 0) return events;
    cleanupProjectiles(state);
    if (state.projectiles.length === 0) return [];
  }
  return [];
}

// For a lobbed (AoE) weapon: runs until its fuse detonates it, then
// resolves the blast exactly once (matching the game loop's one
// resolveHits call per frame — the detonation and its damage happen in
// the same frame).
function fireLobbedUntilDetonation(state, enemies, grid, tileSize, maxFrames = 200) {
  for (let i = 0; i < maxFrames; i++) {
    stepCombat(state, 1 / 30, grid, tileSize);
    if (state.projectiles[0]?.spent) {
      return resolveHits(state, enemies);
    }
  }
  return [];
}

test('damageAgainst: full damage on the correct counter, reduced otherwise', () => {
  const weapon = WEAPONS[WEAPON_IDS.CHAIN_SHOT];
  assert.equal(damageAgainst(weapon, WEAPON_IDS.CHAIN_SHOT), weapon.damage);
  const reduced = damageAgainst(weapon, WEAPON_IDS.DEPTH_CHARGES);
  assert.ok(reduced < weapon.damage);
  assert.equal(reduced, weapon.damage * weapon.offCounterFraction);
});

test('Cannonballs keeps a much higher off-counter fraction than the niche weapons', () => {
  assert.ok(WEAPONS[WEAPON_IDS.CANNONBALLS].offCounterFraction > WEAPONS[WEAPON_IDS.CHAIN_SHOT].offCounterFraction * 2);
});

test('tryFire respects its cooldown', () => {
  const state = createWeaponState();
  assert.ok(tryFire(state, 0, 0, 0));
  assert.equal(canFire(state), false);
  assert.equal(tryFire(state, 0, 0, 0), false);
  assert.equal(state.projectiles.length, 1);
});

test('tryFire respects finite ammo and Cannonballs never runs dry', () => {
  const state = createWeaponState();
  setActiveWeapon(state, WEAPON_IDS.GRAPESHOT);
  const maxAmmo = WEAPONS[WEAPON_IDS.GRAPESHOT].ammoMax;
  for (let i = 0; i < maxAmmo; i++) {
    state.cooldownRemaining = 0; // simulate cooldown elapsed between shots
    assert.ok(tryFire(state, 0, 0, 0), `shot ${i} should have ammo`);
  }
  state.cooldownRemaining = 0;
  assert.equal(ammoFor(state, WEAPON_IDS.GRAPESHOT), 0);
  assert.equal(tryFire(state, 0, 0, 0), false, 'out of ammo should refuse to fire');

  setActiveWeapon(state, WEAPON_IDS.CANNONBALLS);
  assert.equal(ammoFor(state, WEAPON_IDS.CANNONBALLS), Infinity);
});

test('a straight-shot projectile travels toward its heading and expires at max range', () => {
  const state = createWeaponState(); // Cannonballs, single pellet, no spread
  tryFire(state, 0, 0, 0); // heading 0 = +x
  const grid = openGrid();
  const tileSize = 16;
  let frames = 0;
  while (state.projectiles.length && frames < 300) {
    stepCombat(state, 1 / 30, grid, tileSize);
    cleanupProjectiles(state);
    frames++;
  }
  assert.equal(state.projectiles.length, 0, 'projectile should have expired at max range');
  assert.ok(frames > 1 && frames < 300, `expected the projectile to travel for a while, got ${frames} frames`);
});

test('a projectile is removed the frame it hits a solid tile', () => {
  const state = createWeaponState();
  const grid = openGrid();
  const tileSize = 16;
  const wallTx = 5;
  for (let y = 0; y < grid.height; y++) grid.tiles[y][wallTx] = 1;
  tryFire(state, (wallTx - 3) * tileSize, 5 * tileSize, 0); // heading 0 = +x, toward the wall
  let hitWall = false;
  for (let i = 0; i < 60; i++) {
    stepCombat(state, 1 / 30, grid, tileSize);
    if (state.projectiles[0]?.spent) { hitWall = true; break; }
  }
  assert.ok(hitWall, 'projectile should have been marked spent on hitting the wall');
});

test('resolveHits deals full damage with the correct counter', () => {
  const state = createWeaponState();
  setActiveWeapon(state, WEAPON_IDS.GRAPESHOT); // counters Reef Skimmer; fires 5 pellets/shot
  const grid = openGrid();
  const skimmer = createEnemy(ENEMY_IDS.REEF_SKIMMER, 40, 0);
  tryFire(state, 0, 0, 0, () => 0.5); // rng=0.5 -> zero spread offset, straight at +x, all pellets overlap

  const events = fireDirectUntilHit(state, [skimmer], grid, 16);
  assert.ok(events.length >= 1, 'at least one pellet should have landed');
  for (const event of events) assert.equal(event.damage, WEAPONS[WEAPON_IDS.GRAPESHOT].damage);
});

test('resolveHits deals reduced damage when the weapon does not counter the enemy', () => {
  const state = createWeaponState();
  setActiveWeapon(state, WEAPON_IDS.CHAIN_SHOT); // does not counter an Ironclad Brigand; fires 3 pellets/shot
  const grid = openGrid();
  const brigand = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 40, 0);
  const weapon = WEAPONS[WEAPON_IDS.CHAIN_SHOT];

  tryFire(state, 0, 0, 0, () => 0.5);
  const events = fireDirectUntilHit(state, [brigand], grid, 16);
  assert.ok(events.length >= 1, 'at least one pellet should have landed');
  for (const event of events) assert.equal(event.damage, weapon.damage * weapon.offCounterFraction);
});

test('resolveHits ignores invulnerable (submerged) enemies', () => {
  const state = createWeaponState();
  setActiveWeapon(state, WEAPON_IDS.GRAPESHOT);
  const grid = openGrid();
  const skimmer = createEnemy(ENEMY_IDS.REEF_SKIMMER, 40, 0);
  skimmer.invulnerable = true;

  tryFire(state, 0, 0, 0, () => 0.5);
  const events = fireDirectUntilHit(state, [skimmer], grid, 16);
  assert.equal(events.length, 0, 'an invulnerable enemy should take no damage');
});

test('Depth Charges deal AoE damage to multiple enemies in the blast radius, not to one far away', () => {
  const grid = openGrid();

  // Find the actual detonation point empirically (travel speed/fuse are
  // data-driven, not worth hard-coding the arithmetic here).
  const probeState = createWeaponState();
  setActiveWeapon(probeState, WEAPON_IDS.DEPTH_CHARGES);
  tryFire(probeState, 0, 0, 0);
  for (let i = 0; i < 200 && !probeState.projectiles[0].spent; i++) stepCombat(probeState, 1 / 30, grid, 16);
  const { x: blastX, y: blastY } = probeState.projectiles[0];

  const state = createWeaponState();
  setActiveWeapon(state, WEAPON_IDS.DEPTH_CHARGES); // counters Deep Crawler
  // Depth Charges are meant to be pre-placed for the moment a Deep Crawler
  // surfaces (it's invulnerable while submerged) — surface these targets
  // so the blast actually has something vulnerable to hit.
  const a = createEnemy(ENEMY_IDS.DEEP_CRAWLER, blastX + 5, blastY);
  a.invulnerable = false;
  const b = createEnemy(ENEMY_IDS.DEEP_CRAWLER, blastX - 5, blastY + 8);
  b.invulnerable = false;
  const farAway = createEnemy(ENEMY_IDS.DEEP_CRAWLER, blastX + 500, blastY + 500);

  tryFire(state, 0, 0, 0);
  const events = fireLobbedUntilDetonation(state, [a, b, farAway], grid, 16);
  const hitIds = events.map((e) => e.enemy.id);
  assert.ok(hitIds.includes(a.id), 'the nearer enemy should be caught in the blast');
  assert.ok(hitIds.includes(b.id), 'the other nearby enemy should also be caught in the blast');
  assert.ok(!hitIds.includes(farAway.id), 'an enemy far outside the blast radius should be untouched');
});

test('Flame Barrels attach a burn that keeps ticking after the initial hit', () => {
  const state = createWeaponState();
  setActiveWeapon(state, WEAPON_IDS.FLAME_BARRELS); // counters Ironclad Brigand
  const grid = openGrid();
  const brigand = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 30, 0);

  tryFire(state, 0, 0, 0, () => 0.5);
  const events = fireDirectUntilHit(state, [brigand], grid, 16);
  assert.equal(events.length, 1);
  assert.ok(brigand.burn, 'a burn status should be attached on a Flame Barrels hit');

  const healthAfterHit = brigand.health;
  let ticked = false;
  for (let i = 0; i < 200 && brigand.burn; i++) {
    const ev = stepBurn(brigand, 1 / 30);
    if (ev) ticked = true;
  }
  assert.ok(ticked, 'burn should have dealt at least one tick of damage');
  assert.ok(brigand.health < healthAfterHit, 'burn ticks should keep lowering health after the initial hit');
  assert.equal(brigand.burn, null, 'burn should clear itself once it runs out');
});

test('applyDamageToEnemy reports a kill once health reaches 0', () => {
  const enemy = createEnemy(ENEMY_IDS.REEF_SKIMMER, 0, 0);
  const killed = applyDamageToEnemy(enemy, enemy.maxHealth + 10);
  assert.equal(killed, true);
  assert.equal(enemy.health, 0);
});
