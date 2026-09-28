// Weapon definitions — the counter-swap hook (Overboard!'s "read the enemy,
// switch the weapon"). Data-driven per the project's stack rules: adding or
// rebalancing a weapon should never require touching combat.mjs.
//
// Damage model: each weapon has a base `damage`. Against an enemy whose
// `counter` matches this weapon's id, the FULL `damage` lands. Against any
// other enemy, only `offCounterFraction` of it lands — for the four niche
// weapons that's "little/no effect" (the wrong-weapon punishment the whole
// hook depends on); Cannonballs deliberately keeps a much higher
// off-counter fraction since it's the always-available fallback with no
// real counter role of its own.

export const WEAPON_IDS = Object.freeze({
  CANNONBALLS: 'cannonballs',
  CHAIN_SHOT: 'chain_shot',
  GRAPESHOT: 'grapeshot',
  DEPTH_CHARGES: 'depth_charges',
  FLAME_BARRELS: 'flame_barrels',
});

export const WEAPONS = {
  [WEAPON_IDS.CANNONBALLS]: {
    id: WEAPON_IDS.CANNONBALLS,
    name: 'Cannonballs',
    kind: 'projectile',
    damage: 12,
    offCounterFraction: 0.55, // weak all-purpose default, never useless
    cooldown: 0.45, // seconds between shots
    projectileSpeed: 260,
    projectileRadius: 3,
    range: 260,
    spreadRad: 0,
    pelletCount: 1,
    ammoMax: Infinity,
    color: '#4a3a2a',
  },
  [WEAPON_IDS.CHAIN_SHOT]: {
    id: WEAPON_IDS.CHAIN_SHOT,
    name: 'Chain Shot',
    kind: 'projectile',
    damage: 9,
    offCounterFraction: 0.12,
    cooldown: 0.6,
    projectileSpeed: 220,
    projectileRadius: 3,
    range: 160,
    spreadRad: Math.PI / 6, // wide horizontal-feeling spread
    pelletCount: 3,
    ammoMax: 24,
    color: '#8a8a95',
  },
  [WEAPON_IDS.GRAPESHOT]: {
    id: WEAPON_IDS.GRAPESHOT,
    name: 'Grapeshot',
    kind: 'projectile',
    damage: 6,
    offCounterFraction: 0.12,
    cooldown: 0.2, // fast, close-range burst
    projectileSpeed: 300,
    projectileRadius: 2,
    range: 110,
    spreadRad: Math.PI / 5,
    pelletCount: 5,
    ammoMax: 40,
    color: '#c9c9c9',
  },
  [WEAPON_IDS.DEPTH_CHARGES]: {
    id: WEAPON_IDS.DEPTH_CHARGES,
    name: 'Depth Charges',
    kind: 'lobbed',
    damage: 26,
    offCounterFraction: 0.1,
    cooldown: 1.1,
    projectileSpeed: 90, // slow arc-lob
    projectileRadius: 5,
    range: 150,
    spreadRad: 0,
    pelletCount: 1,
    fuseSeconds: 0.9, // travels, then detonates after this long regardless of hit
    ammoMax: 10,
    color: '#2a4a3a',
  },
  [WEAPON_IDS.FLAME_BARRELS]: {
    id: WEAPON_IDS.FLAME_BARRELS,
    name: 'Flame Barrels',
    kind: 'area',
    // 4 → 5 (balance pass, 2026-09-28): at 4, killing its counter target
    // (Ironclad Brigand, 60 HP) needed 15 direct hits — one MORE than
    // ammoMax (14), leaving a single cache's worth of ammo unable to
    // finish the kill on direct-hit damage alone (only survivable via the
    // last shot's full burn tail landing uninterrupted). At 5, it's 12
    // hits for 60 direct damage — comfortably under ammoMax with margin
    // for missed shots, while every other weapon/counter pair already
    // kills its target well within one cache (see tools/balance-sim.mjs's
    // TTK math in the decisions log). Also raises the burn tick itself by
    // the same amount, since both reuse this one field.
    damage: 5, // per tick while burning
    offCounterFraction: 0.15,
    cooldown: 0.8,
    projectileSpeed: 140,
    projectileRadius: 6,
    range: 90,
    spreadRad: Math.PI / 10,
    pelletCount: 1,
    burnDurationSeconds: 2.2,
    burnTickSeconds: 0.35,
    ammoMax: 14,
    color: '#d9622f',
  },
};

export const WEAPON_LIST = Object.values(WEAPONS);

export function getWeapon(id) {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Unknown weapon id: ${id}`);
  return weapon;
}

// Damage a weapon deals to a given enemy definition, respecting the
// counter-swap rule. `enemyCounterId` is the enemy's current counter
// weapon id (bosses may change this by phase).
export function damageAgainst(weapon, enemyCounterId) {
  return weapon.id === enemyCounterId ? weapon.damage : weapon.damage * weapon.offCounterFraction;
}
