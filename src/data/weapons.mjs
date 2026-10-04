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
    damage: 14,
    offCounterFraction: 0.55, // weak all-purpose default, never useless
    cooldown: 0.5, // seconds between shots
    projectileSpeed: 330,
    projectileRadius: 3.5,
    range: 240,
    spreadRad: 0,
    pelletCount: 1,
    ammoMax: Infinity,
    color: '#4a3a2a',
  },
  [WEAPON_IDS.CHAIN_SHOT]: {
    id: WEAPON_IDS.CHAIN_SHOT,
    name: 'Chain Shot',
    kind: 'projectile',
    damage: 12,
    offCounterFraction: 0.12,
    cooldown: 0.55,
    projectileSpeed: 280,
    projectileRadius: 5,
    range: 210,
    spreadRad: 0.3, // wide horizontal-feeling spread
    pelletCount: 2,
    ammoMax: 24,
    pierce: 1, // bolas scythe through a flock: each hits two
    color: '#8a8a95',
  },
  [WEAPON_IDS.GRAPESHOT]: {
    id: WEAPON_IDS.GRAPESHOT,
    name: 'Grapeshot',
    kind: 'projectile',
    damage: 6,
    offCounterFraction: 0.12,
    cooldown: 0.35, // fast, close-range burst
    projectileSpeed: 360,
    projectileRadius: 2,
    range: 125,
    spreadRad: Math.PI / 5,
    pelletCount: 6,
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
    projectileSpeed: 110, // slow arc-lob
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
    // Damage 5 (was 4). DECIDED 2026-09-28 with tools/ttk-check.mjs, which
    // drives the real engine loop. The original reason for 4 → 5 ("at 4 a
    // Brigand needs 15 hits vs ammoMax 14") was wrong: it ignored burn,
    // which lands two ticks between shots (0.35s ticks vs 0.8s cooldown),
    // so a Brigand dies in ~6 shots even at 4. The real reason to keep 5
    // is the boss: Flame Barrels is the Kraken's Anchor's phase-2 counter,
    // and at 4 an average player (spamming Depth Charges, 20% misses) ran
    // Flame dry and failed to kill it in 30% of fights (avg 72s); at 5 it
    // dies every time in ~24s. tests/balance.test.mjs guards this.
    damage: 5, // per tick while burning
    offCounterFraction: 0.15,
    cooldown: 0.8,
    projectileSpeed: 180,
    projectileRadius: 6,
    range: 130,
    spreadRad: Math.PI / 10,
    pelletCount: 1,
    burnDurationSeconds: 2.2,
    burnTickSeconds: 0.35,
    ammoMax: 14,
    color: '#d9622f',
  },
};

export const WEAPON_LIST = Object.values(WEAPONS);

// Armament guns (data/armaments.mjs): fired automatically alongside your
// main weapon. Not in WEAPON_LIST (they never appear in the weapon dock).
// They ignore the counter rule (offCounterFraction 1); each projectile
// carries its own damage from the armament's level.
const armamentGun = (id, o) => ({ id, pelletCount: 1, spreadRad: 0, ammoMax: Infinity, offCounterFraction: 1, cooldown: 0, damage: 0, projectileRadius: 3, ...o });
export const ARMAMENT_WEAPONS = {
  arm_swivel: armamentGun('arm_swivel', { name: 'Swivel Gun', kind: 'projectile', projectileSpeed: 380, projectileRadius: 2.2, range: 150, color: '#e8e2d0' }),
  arm_harpoon: armamentGun('arm_harpoon', { name: 'Harpoon', kind: 'projectile', projectileSpeed: 420, projectileRadius: 3.5, range: 270, pierce: 99, color: '#c9d4dc' }),
  arm_mortar: armamentGun('arm_mortar', { name: 'Deck Mortar', kind: 'lobbed', projectileSpeed: 170, projectileRadius: 4, range: 260, fuseSeconds: 1, blastRadius: 34, color: '#ffb347' }),
  arm_keg: armamentGun('arm_keg', { name: 'Powder Keg', kind: 'lobbed', projectileSpeed: 0, projectileRadius: 5, range: 9999, fuseSeconds: 6, blastRadius: 36, color: '#8a5a2b' }),
  arm_stern: armamentGun('arm_stern', { name: 'Stern Chaser', kind: 'projectile', projectileSpeed: 340, projectileRadius: 3, range: 220, color: '#d9b36a' }),
  arm_broadside: armamentGun('arm_broadside', { name: 'Broadside Battery', kind: 'projectile', projectileSpeed: 330, projectileRadius: 3.2, range: 200, color: '#f0c070' }),
  // Survival Flame Barrels (engine/survival.mjs): a lobbed barrel that
  // bursts into a pool of fire where it lands.
  sv_barrel: armamentGun('sv_barrel', { name: 'Flame Barrel', kind: 'lobbed', projectileSpeed: 200, projectileRadius: 5, range: 260, fuseSeconds: 1, blastRadius: 22, color: '#d9622f' }),
  sea_spirit: armamentGun('sea_spirit', { name: 'Sea Spirit', kind: 'aura', projectileSpeed: 0, range: 0, color: '#7ff0e0' }),
  st_elmos_fire: armamentGun('st_elmos_fire', { name: "St Elmo's Fire", kind: 'aura', projectileSpeed: 0, range: 0, color: '#b8e4ff' }),
};

export function getWeapon(id) {
  const weapon = WEAPONS[id] || ARMAMENT_WEAPONS[id];
  if (!weapon) throw new Error(`Unknown weapon id: ${id}`);
  return weapon;
}

// Damage a weapon deals to a given enemy definition, respecting the
// counter-swap rule. `enemyCounterId` is the enemy's current counter
// weapon id (bosses may change this by phase).
export function damageAgainst(weapon, enemyCounterId) {
  return weapon.id === enemyCounterId ? weapon.damage : weapon.damage * weapon.offCounterFraction;
}
