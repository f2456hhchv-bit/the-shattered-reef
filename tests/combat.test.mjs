import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeaponState, setActiveWeapon, canFire, tryFire, ammoFor, isHeld,
  collectWeaponCache, stepCombat, cleanupProjectiles, resolveHits, applyDamageToEnemy, stepBurn,
  stepAmmoRegen, craftedMultiplierFor,
} from '../src/engine/combat.mjs';
import { WEAPON_IDS, WEAPONS, damageAgainst } from '../src/data/weapons.mjs';
import { ENEMY_IDS } from '../src/data/enemies.mjs';
import { createEnemy } from '../src/engine/enemies.mjs';

function openGrid(width = 60, height = 60) {
  const tiles = Array.from({ length: height }, () => Array(width).fill(0));
  return { width, height, tiles };
}

// Most combat tests are about a niche weapon's damage/behavior once it's
// in hand, not about the find-it-first pickup flow (that's
// tests/pickups.test.mjs and the held-weapon tests below) — this fills
// the weapon's ammo to max and equips it in one call.
function holdAndEquip(state, weaponId) {
  collectWeaponCache(state, weaponId, WEAPONS[weaponId].ammoMax);
  setActiveWeapon(state, weaponId);
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
  holdAndEquip(state, WEAPON_IDS.GRAPESHOT);
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
  holdAndEquip(state, WEAPON_IDS.GRAPESHOT); // counters Reef Skimmer; fires 5 pellets/shot
  const grid = openGrid();
  const skimmer = createEnemy(ENEMY_IDS.REEF_SKIMMER, 40, 0);
  tryFire(state, 0, 0, 0, () => 0.5); // rng=0.5 -> zero spread offset, straight at +x, all pellets overlap

  const events = fireDirectUntilHit(state, [skimmer], grid, 16);
  assert.ok(events.length >= 1, 'at least one pellet should have landed');
  for (const event of events) assert.equal(event.damage, WEAPONS[WEAPON_IDS.GRAPESHOT].damage);
});

test('resolveHits deals reduced damage when the weapon does not counter the enemy', () => {
  const state = createWeaponState();
  holdAndEquip(state, WEAPON_IDS.CHAIN_SHOT); // does not counter an Ironclad Brigand; fires 3 pellets/shot
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
  holdAndEquip(state, WEAPON_IDS.GRAPESHOT);
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
  holdAndEquip(probeState, WEAPON_IDS.DEPTH_CHARGES);
  tryFire(probeState, 0, 0, 0);
  for (let i = 0; i < 200 && !probeState.projectiles[0].spent; i++) stepCombat(probeState, 1 / 30, grid, 16);
  const { x: blastX, y: blastY } = probeState.projectiles[0];

  const state = createWeaponState();
  holdAndEquip(state, WEAPON_IDS.DEPTH_CHARGES); // counters Deep Crawler
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
  holdAndEquip(state, WEAPON_IDS.FLAME_BARRELS); // counters Ironclad Brigand
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

test('a fresh weapon state holds only Cannonballs; the niche weapons must be found', () => {
  const state = createWeaponState();
  assert.equal(isHeld(state, WEAPON_IDS.CANNONBALLS), true);
  for (const id of [WEAPON_IDS.CHAIN_SHOT, WEAPON_IDS.GRAPESHOT, WEAPON_IDS.DEPTH_CHARGES, WEAPON_IDS.FLAME_BARRELS]) {
    assert.equal(isHeld(state, id), false, `${id} should not be held from the start`);
  }
});

test('setActiveWeapon refuses to switch to a weapon that has not been found', () => {
  const state = createWeaponState();
  const switched = setActiveWeapon(state, WEAPON_IDS.CHAIN_SHOT);
  assert.equal(switched, false);
  assert.equal(state.activeWeaponId, WEAPON_IDS.CANNONBALLS, 'active weapon should not have changed');
});

test('canFire refuses to fire an unheld weapon even if somehow made active', () => {
  const state = createWeaponState();
  state.activeWeaponId = WEAPON_IDS.CHAIN_SHOT; // bypass setActiveWeapon's guard directly
  assert.equal(canFire(state), false);
});

test('collectWeaponCache unlocks a new weapon with starting ammo', () => {
  const state = createWeaponState();
  const freshUnlock = collectWeaponCache(state, WEAPON_IDS.GRAPESHOT, 20);
  assert.equal(freshUnlock, true);
  assert.equal(isHeld(state, WEAPON_IDS.GRAPESHOT), true);
  assert.equal(ammoFor(state, WEAPON_IDS.GRAPESHOT), 20);
});

test('collectWeaponCache on an already-held weapon just refills ammo, clamped at max', () => {
  const state = createWeaponState();
  collectWeaponCache(state, WEAPON_IDS.GRAPESHOT, 20);
  const maxAmmo = WEAPONS[WEAPON_IDS.GRAPESHOT].ammoMax;
  const secondPickup = collectWeaponCache(state, WEAPON_IDS.GRAPESHOT, maxAmmo);
  assert.equal(secondPickup, false, 'should report this as a refill, not a fresh unlock');
  assert.equal(ammoFor(state, WEAPON_IDS.GRAPESHOT), maxAmmo, 'ammo should clamp at the weapon max, not overflow');
});

test('applyDamageToEnemy reports a kill once health reaches 0', () => {
  const enemy = createEnemy(ENEMY_IDS.REEF_SKIMMER, 0, 0);
  const killed = applyDamageToEnemy(enemy, enemy.maxHealth + 10);
  assert.equal(killed, true);
  assert.equal(enemy.health, 0);
});

// --- createWeaponState's Cargo Loadout params (step 7) ------------------

test('createWeaponState grants extra held weapons with ammo scaled by the starting-ammo multiplier', () => {
  const state = createWeaponState([WEAPON_IDS.CHAIN_SHOT], 1);
  assert.equal(isHeld(state, WEAPON_IDS.CHAIN_SHOT), true);
  assert.equal(ammoFor(state, WEAPON_IDS.CHAIN_SHOT), WEAPONS[WEAPON_IDS.CHAIN_SHOT].ammoMax);

  const boosted = createWeaponState([WEAPON_IDS.GRAPESHOT], 1.5);
  const expected = Math.min(WEAPONS[WEAPON_IDS.GRAPESHOT].ammoMax, Math.round(WEAPONS[WEAPON_IDS.GRAPESHOT].ammoMax * 1.5));
  assert.equal(ammoFor(boosted, WEAPON_IDS.GRAPESHOT), expected);
});

test('createWeaponState with no extra weapons behaves exactly like the no-arg call (backward compatible)', () => {
  const state = createWeaponState();
  assert.deepEqual(Array.from(state.heldWeapons), [WEAPON_IDS.CANNONBALLS]);
});

// --- stepAmmoRegen (Steady Hands charm support) -------------------------

test('stepAmmoRegen does nothing when ammoRegenPerSecond is 0 (no charm owned)', () => {
  const state = createWeaponState([WEAPON_IDS.CHAIN_SHOT], 0);
  const before = ammoFor(state, WEAPON_IDS.CHAIN_SHOT);
  stepAmmoRegen(state, 100);
  assert.equal(ammoFor(state, WEAPON_IDS.CHAIN_SHOT), before);
});

test('stepAmmoRegen slowly regenerates ammo for held finite-ammo weapons over time, clamped at max', () => {
  const state = createWeaponState([WEAPON_IDS.CHAIN_SHOT], 0);
  state.ammoRegenPerSecond = 1; // 1 ammo/sec for this test, easy to reason about
  assert.equal(ammoFor(state, WEAPON_IDS.CHAIN_SHOT), 0);
  stepAmmoRegen(state, 3.4);
  assert.equal(ammoFor(state, WEAPON_IDS.CHAIN_SHOT), 3, 'partial seconds should accumulate, not round up early');
  stepAmmoRegen(state, 0.6);
  assert.equal(ammoFor(state, WEAPON_IDS.CHAIN_SHOT), 4, 'the leftover 0.6+0.4 should now cross a whole ammo');

  stepAmmoRegen(state, 1000);
  assert.equal(ammoFor(state, WEAPON_IDS.CHAIN_SHOT), WEAPONS[WEAPON_IDS.CHAIN_SHOT].ammoMax, 'should clamp at the weapon max');
});

test('stepAmmoRegen never touches Cannonballs (unlimited ammo already, nothing to regen)', () => {
  const state = createWeaponState();
  state.ammoRegenPerSecond = 5;
  stepAmmoRegen(state, 10);
  assert.equal(ammoFor(state, WEAPON_IDS.CANNONBALLS), Infinity);
});

// --- Post-slice combat triangle (getFactionMultiplier hook) -------------

test('resolveHits applies the faction multiplier on top of the weapon-counter damage', () => {
  const state = createWeaponState();
  holdAndEquip(state, WEAPON_IDS.CANNONBALLS); // any weapon; Cannonballs keeps this simple
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 100, 0); // Iron Accord faction
  const grid = openGrid();
  tryFire(state, 0, 0, 0);
  const noMultiplier = fireDirectUntilHit(state, [enemy], grid, 16);
  assert.equal(noMultiplier.length, 1, 'sanity: the shot should land with no multiplier hook passed');
  const baseDamage = noMultiplier[0].damage;

  // A fresh shot at a fresh copy of the same enemy, this time with an
  // advantage multiplier (2x, easy to check) wired in.
  const state2 = createWeaponState();
  holdAndEquip(state2, WEAPON_IDS.CANNONBALLS);
  const enemy2 = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 100, 0);
  tryFire(state2, 0, 0, 0);
  let events = [];
  for (let i = 0; i < 200 && events.length === 0; i++) {
    stepCombat(state2, 1 / 30, grid, 16);
    events = resolveHits(state2, [enemy2], (e) => e.counter, () => 2);
    if (events.length === 0) cleanupProjectiles(state2);
  }
  assert.equal(events.length, 1);
  assert.equal(events[0].damage, baseDamage * 2, 'the faction multiplier should scale the final damage dealt');
});

test('resolveHits\' faction multiplier defaults to a no-op (1x) when no callback is passed', () => {
  const state = createWeaponState();
  holdAndEquip(state, WEAPON_IDS.CANNONBALLS);
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 100, 0);
  const grid = openGrid();
  tryFire(state, 0, 0, 0);
  const events = fireDirectUntilHit(state, [enemy], grid, 16);
  assert.equal(events.length, 1);
  assert.equal(events[0].damage, damageAgainst(WEAPONS[WEAPON_IDS.CANNONBALLS], enemy.counter));
});

test('a Flame Barrels burn tick bakes in the faction multiplier that was active at the moment of the hit', () => {
  const state = createWeaponState();
  holdAndEquip(state, WEAPON_IDS.FLAME_BARRELS);
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 60, 0); // its real counter, in range
  const grid = openGrid();
  tryFire(state, 0, 0, 0, () => 0.5); // fixed rng: Flame Barrels has spread, keep the shot dead straight
  let events = [];
  for (let i = 0; i < 200 && events.length === 0; i++) {
    stepCombat(state, 1 / 30, grid, 16);
    events = resolveHits(state, [enemy], (e) => e.counter, () => 1.3);
  }
  assert.equal(events.length, 1);
  const weapon = WEAPONS[WEAPON_IDS.FLAME_BARRELS];
  const expectedTick = damageAgainst(weapon, enemy.counter) * 1.3;
  assert.equal(enemy.burn.tickDamage, expectedTick);
  const tickEvent = stepBurn(enemy, weapon.burnTickSeconds);
  assert.equal(tickEvent.damage, expectedTick);
});

// --- Post-slice Workshop crafting (getWeaponMultiplier hook) ------------

test('craftedMultiplierFor builds a per-weapon multiplier callback, 1x for an unlisted weapon', () => {
  const mult = craftedMultiplierFor({ [WEAPON_IDS.CANNONBALLS]: 1.2 });
  assert.equal(mult(WEAPON_IDS.CANNONBALLS), 1.2);
  assert.equal(mult(WEAPON_IDS.GRAPESHOT), 1, 'a weapon with no crafted upgrade should be a no-op');
});

test('resolveHits applies the crafted weapon multiplier on top of the weapon-counter damage', () => {
  const state = createWeaponState();
  holdAndEquip(state, WEAPON_IDS.CANNONBALLS);
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 100, 0);
  const grid = openGrid();
  tryFire(state, 0, 0, 0);
  let events = [];
  for (let i = 0; i < 200 && events.length === 0; i++) {
    stepCombat(state, 1 / 30, grid, 16);
    events = resolveHits(state, [enemy], (e) => e.counter, () => 1, craftedMultiplierFor({ [WEAPON_IDS.CANNONBALLS]: 1.5 }));
    if (events.length === 0) cleanupProjectiles(state);
  }
  assert.equal(events.length, 1);
  const expected = damageAgainst(WEAPONS[WEAPON_IDS.CANNONBALLS], enemy.counter) * 1.5;
  assert.equal(events[0].damage, expected);
});

test('the faction and crafted multipliers stack multiplicatively', () => {
  const state = createWeaponState();
  holdAndEquip(state, WEAPON_IDS.CANNONBALLS);
  const enemy = createEnemy(ENEMY_IDS.IRONCLAD_BRIGAND, 100, 0);
  const grid = openGrid();
  tryFire(state, 0, 0, 0);
  let events = [];
  for (let i = 0; i < 200 && events.length === 0; i++) {
    stepCombat(state, 1 / 30, grid, 16);
    events = resolveHits(state, [enemy], (e) => e.counter, () => 1.3, () => 1.2);
    if (events.length === 0) cleanupProjectiles(state);
  }
  assert.equal(events.length, 1);
  const expected = damageAgainst(WEAPONS[WEAPON_IDS.CANNONBALLS], enemy.counter) * 1.3 * 1.2;
  assert.ok(Math.abs(events[0].damage - expected) < 1e-9);
});

test('stepAmmoRegen reports whether any ammo was actually gained (drives the ammo display refresh)', () => {
  const state = createWeaponState([WEAPON_IDS.CHAIN_SHOT], 0);
  assert.equal(stepAmmoRegen(state, 5), false, 'no charm: never reports a change');
  state.ammoRegenPerSecond = 1;
  assert.equal(stepAmmoRegen(state, 0.5), false, 'half a tick accumulated: nothing gained yet');
  assert.equal(stepAmmoRegen(state, 0.5), true, 'crossing a whole unit reports a change');
  state.ammo[WEAPON_IDS.CHAIN_SHOT] = WEAPONS[WEAPON_IDS.CHAIN_SHOT].ammoMax;
  assert.equal(stepAmmoRegen(state, 5), false, 'already full: no change to report');
});
