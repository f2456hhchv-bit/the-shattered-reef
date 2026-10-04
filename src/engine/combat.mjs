// Combat core — weapon firing, projectile movement, and hit resolution.
// Pure logic, no rendering/DOM: same split as boat.mjs/maze.mjs so this is
// unit-testable with node --test and only wired to Canvas/touch in main.mjs.

import { WEAPON_IDS, WEAPONS, getWeapon, damageAgainst } from '../data/weapons.mjs';

let nextProjectileId = 1;

// Only Cannonballs is held from the start by default — the four niche
// weapons are found in-run as weapon caches (data/pickups.mjs), unless the
// Cargo Loadouts meta-progression track (data/meta.mjs, step 7) grants
// some of them from Reef 1. `extraHeldWeapons` is that track's
// `extraHeldWeapons` list; `startingAmmoMultiplier` its ammo-reserve
// bonus, applied only to what's held at run start (a weapon found later
// via a pickup still gets the pickup's own fixed amount, unaffected).
export function createWeaponState(extraHeldWeapons = [], startingAmmoMultiplier = 1) {
  const ammo = {};
  const heldWeapons = new Set();
  for (const weapon of Object.values(WEAPONS)) {
    if (Number.isFinite(weapon.ammoMax)) {
      ammo[weapon.id] = 0; // starts empty — a weapon cache both unlocks and fills it
    } else {
      heldWeapons.add(weapon.id); // Cannonballs: unlimited ammo, held from the start
    }
  }
  for (const weaponId of extraHeldWeapons) {
    const weapon = getWeapon(weaponId);
    if (!Number.isFinite(weapon.ammoMax)) continue; // already held, no ammo to grant
    heldWeapons.add(weaponId);
    ammo[weaponId] = Math.min(weapon.ammoMax, Math.round(weapon.ammoMax * startingAmmoMultiplier));
  }
  return {
    activeWeaponId: WEAPON_IDS.CANNONBALLS,
    ammo,
    heldWeapons,
    cooldownRemaining: 0,
    projectiles: [],
    ammoRegenPerSecond: 0, // set by the Steady Hands charm, see stepAmmoRegen
    baseRegenPerSecond: 0, // every special weapon's own slow trickle (run.mjs sets it)
    ammoRegenAccum: {},
    mods: createWeaponMods(),
  };
}

// In-run weapon modifiers (2026-09-29): what the upgrade cards change
// (data/upgrades.mjs). Neutral by default, so a state without upgrades
// fires exactly the base weapon data.
export function createWeaponMods() {
  return {
    damage: {}, // weaponId -> multiplier
    extraShots: {}, // weaponId -> extra projectiles per shot
    pierce: {}, // weaponId -> extra enemies each projectile passes through
    cooldown: 1, // all weapons
    range: 1, // all weapons
    blast: 1, // Depth Charge blast radius
    burn: 1, // Flame Barrel burn duration
    ammoMax: 1, // special weapons' capacity
  };
}

// The weapon as it fires right now: base data with this run's upgrades.
export function effectiveWeapon(state, weaponId) {
  const w = getWeapon(weaponId);
  if (!WEAPONS[weaponId]) return w; // armament guns: their own stats, no upgrades
  const m = state.mods || createWeaponMods();
  return {
    ...w,
    damage: w.damage * (m.damage[weaponId] || 1),
    cooldown: w.cooldown * m.cooldown,
    range: w.range * m.range,
    pelletCount: w.pelletCount + (m.extraShots[weaponId] || 0),
    pierce: (w.pierce || 0) + (m.pierce[weaponId] || 0),
    blastRadius: (w.blastRadius || DEPTH_CHARGE_BLAST_RADIUS) * m.blast,
    burnDurationSeconds: (w.burnDurationSeconds || 0) * m.burn,
    ammoMax: Number.isFinite(w.ammoMax) ? Math.round(w.ammoMax * m.ammoMax) : Infinity,
  };
}

export function ammoMaxFor(state, weaponId) {
  return effectiveWeapon(state, weaponId).ammoMax;
}

// Steady Hands charm support: slowly regenerates ammo for every held,
// finite-ammo weapon over time, independent of pickups. A no-op (cheap to
// call unconditionally) when ammoRegenPerSecond is 0 — no charm owned.
//
// Returns true if any weapon actually gained ammo this call, so the caller
// can refresh the ammo display only then — without it the regen was
// invisible (the weapon bar only redrew on fire/pickup), making the charm
// look broken on a phone (found in a live playtest, 2026-09-28).
export function stepAmmoRegen(state, dt) {
  const rate = state.ammoRegenPerSecond + (state.baseRegenPerSecond || 0);
  if (rate <= 0) return false;
  let changed = false;
  for (const weaponId of state.heldWeapons) {
    const weapon = { ammoMax: ammoMaxFor(state, weaponId) };
    if (!Number.isFinite(weapon.ammoMax)) continue;
    if (state.ammo[weaponId] >= weapon.ammoMax) continue;
    const accum = (state.ammoRegenAccum[weaponId] || 0) + rate * dt;
    // The tiny epsilon guards against float drift landing just under a
    // whole number (e.g. 0.4 + 0.6 evaluating to 0.999999999999994) and
    // silently dropping a tick that should have fired this frame.
    const gained = Math.floor(accum + 1e-9);
    if (gained > 0) {
      state.ammo[weaponId] = Math.min(weapon.ammoMax, state.ammo[weaponId] + gained);
      state.ammoRegenAccum[weaponId] = accum - gained;
      changed = true;
    } else {
      state.ammoRegenAccum[weaponId] = accum;
    }
  }
  return changed;
}

export function isHeld(state, weaponId) {
  return state.heldWeapons.has(weaponId);
}

// Only switches to a weapon the player has actually found. Returns
// whether the switch happened, so UI code can no-op cleanly on a locked
// weapon rather than needing its own held-check.
export function setActiveWeapon(state, weaponId) {
  getWeapon(weaponId); // throws on an unknown id
  if (!isHeld(state, weaponId)) return false;
  state.activeWeaponId = weaponId;
  return true;
}

// Unlocks a weapon cache's weapon into the held set (if not already held)
// and adds ammo, clamped at the weapon's max — the same effect whether
// this is the first cache of that weapon found (an unlock) or a repeat
// (a refill). Returns true if this was a fresh unlock (for UI feedback:
// "New weapon!" vs. a plain ammo-pickup toast).
export function collectWeaponCache(state, weaponId, amount) {
  const max = ammoMaxFor(state, weaponId);
  if (!Number.isFinite(max)) return false; // Cannonballs needs no cache
  const freshUnlock = !isHeld(state, weaponId);
  state.heldWeapons.add(weaponId);
  state.ammo[weaponId] = Math.min(max, (state.ammo[weaponId] || 0) + amount);
  return freshUnlock;
}

// Post-slice Workshop crafting (data/meta.mjs) — builds a
// getWeaponMultiplier callback for resolveHits from a run's resolved
// `craftedDamageMultipliers` map. Mirrors enemies.mjs's
// factionMultiplierFor: a plain closure so call sites don't need to know
// the map's shape.
export function craftedMultiplierFor(craftedDamageMultipliers) {
  return (weaponId) => craftedDamageMultipliers[weaponId] || 1;
}

export function ammoFor(state, weaponId) {
  const weapon = getWeapon(weaponId);
  return Number.isFinite(weapon.ammoMax) ? state.ammo[weaponId] : Infinity;
}

export function canFire(state) {
  const weapon = getWeapon(state.activeWeaponId);
  if (state.cooldownRemaining > 0) return false;
  if (!isHeld(state, weapon.id)) return false;
  return ammoFor(state, weapon.id) > 0;
}

// Fires the active weapon from (x, y) toward `heading` (radians). Returns
// true if it fired. `rng` is an optional () => [0,1) function for spread —
// defaults to Math.random so callers can pass a seeded rng in tests.
export function tryFire(state, x, y, heading, rng = Math.random) {
  if (!canFire(state)) return false;
  const weapon = effectiveWeapon(state, state.activeWeaponId);
  const extra = weapon.pelletCount - getWeapon(weapon.id).pelletCount;

  for (let i = 0; i < weapon.pelletCount; i++) {
    let spreadOffset = weapon.spreadRad === 0 ? 0 : (rng() - 0.5) * weapon.spreadRad;
    // Extra balls from a no-spread weapon (Twin Cannons) fan out evenly.
    if (weapon.spreadRad === 0 && extra > 0) spreadOffset = (i - (weapon.pelletCount - 1) / 2) * 0.13;
    const angle = heading + spreadOffset;
    state.projectiles.push({
      id: nextProjectileId++,
      weaponId: weapon.id,
      x, y,
      vx: Math.cos(angle) * weapon.projectileSpeed,
      vy: Math.sin(angle) * weapon.projectileSpeed,
      radius: weapon.projectileRadius,
      traveled: 0,
      maxRange: weapon.range,
      fuseRemaining: weapon.kind === 'lobbed' ? weapon.fuseSeconds : null,
      pierceLeft: weapon.pierce,
      hitIds: null,
      spent: false, // set true once it has dealt its damage / detonated
    });
  }

  if (Number.isFinite(weapon.ammoMax)) state.ammo[weapon.id] -= 1;
  state.cooldownRemaining = weapon.cooldown;
  return true;
}

function isSolidAt(grid, x, y, tileSize) {
  const tx = Math.floor(x / tileSize);
  const ty = Math.floor(y / tileSize);
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true;
  return grid.tiles[ty][tx] === 1;
}

// Advances cooldown and every live projectile. Projectiles that leave their
// range, hit a wall, or (for lobbed weapons) run out their fuse are marked
// `spent` here; resolveHits still gets a look at them the same frame (a
// depth charge should detonate even if nothing was directly under it) and
// stepCombat's own cleanup pass removes spent projectiles afterward.
// Proximity fuse (2026-09-28): a lobbed charge in flight detonates the
// moment it passes within this margin of a live, *surfaced* enemy. Without
// it the fixed ~81px fuse flew straight past anything hugging the boat,
// making Deep Crawlers and the boss's Depth phase unwinnable at close range.
// Submerged (invulnerable) targets never trigger it — you still have to
// time the surfacing, which is the weapon's identity.
export const DEPTH_CHARGE_PROXIMITY_MARGIN = 6;

export function stepCombat(state, dt, grid, tileSize, enemies = []) {
  if (state.cooldownRemaining > 0) {
    state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
  }

  for (const p of state.projectiles) {
    if (p.spent) continue;
    const stepX = p.vx * dt;
    const stepY = p.vy * dt;
    p.x += stepX;
    p.y += stepY;
    p.traveled += Math.hypot(stepX, stepY);

    if (p.fuseRemaining != null) {
      p.fuseRemaining -= dt;
      if (p.armDelay > 0) p.armDelay -= dt; // a dropped keg arms after a moment
      if (p.fuseRemaining <= 0) p.spent = true; // detonate at end of fuse
      else if (!(p.armDelay > 0) && !p.noProximity && enemies.some((e) => e.health > 0 && !e.invulnerable && !e.warded
        && Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + (p.radius ?? 0) + DEPTH_CHARGE_PROXIMITY_MARGIN)) {
        p.spent = true; // proximity fuse
      }
    }
    if (p.traveled >= p.maxRange) p.spent = true;
    // A mortar shell arcs over land; everything else stops at the shore —
    // or, on crystal shores (`state.ricochet`), glances off once.
    if (!p.overLand && isSolidAt(grid, p.x, p.y, tileSize)) {
      if (state.ricochet && (p.bounces || 0) < state.ricochet && p.fuseRemaining == null) {
        const ox = p.x - stepX; const oy = p.y - stepY;
        const hx = isSolidAt(grid, p.x, oy, tileSize); const hy = isSolidAt(grid, ox, p.y, tileSize);
        if (hx || !hy) p.vx = -p.vx;
        if (hy || !hx) p.vy = -p.vy;
        p.x = ox; p.y = oy; p.bounces = (p.bounces || 0) + 1;
      } else p.spent = true;
    }
  }
}

// Removes projectiles that were marked spent (by stepCombat or by
// resolveHits landing a non-AoE hit). Call after resolveHits each frame.
export function cleanupProjectiles(state) {
  state.projectiles = state.projectiles.filter((p) => !p.spent);
}

export function applyDamageToEnemy(enemy, amount) {
  enemy.health = Math.max(0, enemy.health - amount);
  return enemy.health <= 0;
}

const DEPTH_CHARGE_BLAST_RADIUS = 28;

// Front armour (Mirror Tortoise): a direct hit that comes from ahead of it
// (within 65° of where it's facing) does only `frontArmor` of its damage.
// Blasts (Depth Charges, mortars, kegs) aren't affected.
export function frontArmorFactor(enemy, p) {
  if (enemy.frontArmor == null) return 1;
  const sp = Math.hypot(p.vx, p.vy); if (sp < 1) return 1;
  const fx = Math.cos(enemy.heading || 0); const fy = Math.sin(enemy.heading || 0);
  // The shot travels toward the enemy; it hit the front if it came from ahead.
  const into = -(p.vx * fx + p.vy * fy) / sp;
  return into > Math.cos(65 * Math.PI / 180) ? enemy.frontArmor : 1;
}

// Checks every live projectile against every enemy and applies damage,
// respecting each weapon's counter rule (data/weapons.mjs). Returns an
// array of hit events: { enemy, weaponId, damage, killed } — callers (the
// game loop, tests) use this for salvage drops, feedback/VFX hooks, etc.
// `getEnemyCounter(enemy)` lets callers (bosses) resolve a phase-dependent
// counter instead of a fixed `enemy.counter` field. `getFactionMultiplier
// (enemy)` is the post-slice combat-triangle hook (data/factions.mjs) — a
// second, separate multiplier stacked on top of the weapon-counter
// fraction above. `getWeaponMultiplier(weaponId)` is the Workshop
// crafting hook (data/meta.mjs) — a third, independent multiplier for a
// permanently upgraded weapon. All three multiply together; each defaults
// to a no-op 1x so every pre-faction/pre-crafting call site keeps working
// unchanged.
export function resolveHits(state, enemies, getEnemyCounter = (e) => e.counter, getFactionMultiplier = () => 1, getWeaponMultiplier = () => 1) {
  const events = [];

  for (const p of state.projectiles) {
    const weapon = effectiveWeapon(state, p.weaponId);
    const lobbed = weapon.kind === 'lobbed';
    if (p.spent && !lobbed) continue; // already resolved elsewhere
    // An armament projectile carries its own damage and ignores counters.
    // Survival weapons (engine/survival.mjs) carry their damage too, plus a
    // counter bonus against what their weapon (`counterId`) counters.
    const baseDamage = (enemy) => (p.damage != null
      ? p.damage * (p.counterMult && getEnemyCounter(enemy) === (p.counterId || p.weaponId) ? p.counterMult : 1)
      : damageAgainst(weapon, getEnemyCounter(enemy)));

    if (lobbed && p.fuseRemaining != null && p.fuseRemaining > 0 && !p.spent) {
      continue; // still travelling — only resolves on impact/fuse-out below
    }

    if (lobbed) {
      // AoE on wall impact or fuse expiry, whichever came first (stepCombat
      // already marked `spent` in either case). Depth Charges, the Deck
      // Mortar and Powder Kegs all blow up this way.
      if (!p.spent || p.detonated) continue;
      p.detonated = true;
      const radius = p.blastRadius ?? weapon.blastRadius;
      for (const enemy of enemies) {
        if (enemy.health <= 0 || enemy.warded) continue;
        // Survival Depth Charges reach what's hiding underwater.
        if (enemy.invulnerable && !(p.hitsSubmerged && enemy.submergedState === 'submerged')) continue;
        const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (dist <= radius + enemy.radius) {
          const dmg = baseDamage(enemy) * getFactionMultiplier(enemy) * getWeaponMultiplier(weapon.id);
          const killed = applyDamageToEnemy(enemy, dmg);
          events.push({ enemy, weaponId: p.counterId || weapon.id, damage: dmg, killed, ...(p.counterMult && getEnemyCounter(enemy) === (p.counterId || p.weaponId) ? { counter: true } : {}) });
        }
      }
      continue; // detonated; cleanupProjectiles removes it (already spent)
    }

    if (p.spent) continue; // a non-AoE projectile that hit a wall: no damage

    for (const enemy of enemies) {
      if (enemy.health <= 0 || enemy.invulnerable) continue;
      if (enemy.warded) {
        // A seal's ward: the shot glances off the shield (no damage).
        if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= p.radius + enemy.radius + 6) {
          p.spent = true;
          events.push({ enemy, weaponId: weapon.id, damage: 0, killed: false, blocked: true });
          break;
        }
        continue;
      }
      if (p.hitIds && p.hitIds.has(enemy.id)) continue; // a piercing shot hits each enemy once
      const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (dist <= p.radius + enemy.radius) {
        // Combines the triangle and crafting multipliers into one factor —
        // they're independent (one keyed by enemy, one by weapon) but both
        // apply multiplicatively on top of the weapon-counter fraction.
        const extraMult = getFactionMultiplier(enemy) * getWeaponMultiplier(weapon.id);
        const armor = frontArmorFactor(enemy, p);
        const dmg = baseDamage(enemy) * extraMult * armor;
        const killed = applyDamageToEnemy(enemy, dmg);
        events.push({ enemy, weaponId: p.counterId || weapon.id, damage: dmg, killed, ...(armor < 1 ? { armored: true } : {}), ...(p.counterMult && getEnemyCounter(enemy) === (p.counterId || p.weaponId) ? { counter: true } : {}) });
        if (p.pierceLeft > 0) {
          p.pierceLeft -= 1;
          (p.hitIds ||= new Set()).add(enemy.id);
        } else {
          p.spent = true;
        }

        if (weapon.id === WEAPON_IDS.FLAME_BARRELS && p.damage == null) {
          enemy.burn = {
            weaponId: weapon.id,
            ticksRemaining: Math.round(weapon.burnDurationSeconds / weapon.burnTickSeconds),
            tickInterval: weapon.burnTickSeconds,
            tickTimer: weapon.burnTickSeconds,
            // Bakes the same combined multiplier into every burn tick, not
            // just the initial hit — a burn applied under a triangle
            // advantage/disadvantage (or a crafted weapon upgrade) should
            // keep that edge for its whole duration, not just the landing
            // blow.
            tickDamage: damageAgainst(weapon, getEnemyCounter(enemy)) * extraMult,
          };
        }
        if (p.spent) break; // one enemy per non-piercing projectile
      }
    }
  }

  return events;
}

// Advances any active burn status on an enemy, dealing tick damage on its
// own schedule. Returns a hit event like resolveHits' (or null if no burn
// is active / nothing ticked this frame) so callers can drive salvage/VFX
// the same way for burn ticks as for direct hits.
export function stepBurn(enemy, dt) {
  const burn = enemy.burn;
  if (!burn || enemy.health <= 0 || enemy.invulnerable || enemy.warded) return null;

  burn.tickTimer -= dt;
  if (burn.tickTimer > 0) return null;

  burn.tickTimer += burn.tickInterval;
  burn.ticksRemaining -= 1;
  const killed = applyDamageToEnemy(enemy, burn.tickDamage);
  if (burn.ticksRemaining <= 0 || killed) enemy.burn = null;
  return { enemy, weaponId: burn.weaponId, damage: burn.tickDamage, killed };
}
