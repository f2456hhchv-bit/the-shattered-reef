// Enemy definitions — five niches + one boss, each with exactly one real
// counter weapon (src/data/weapons.mjs) and a distinct movement/attack
// archetype so the player can read the threat by silhouette and behavior
// before it's in range, per the PRD's Enemies section.

import { WEAPON_IDS } from './weapons.mjs';

export const ENEMY_IDS = Object.freeze({
  REEF_SKIMMER: 'reef_skimmer',
  GULLSWARM_HARPY: 'gullswarm_harpy',
  DEEP_CRAWLER: 'deep_crawler',
  IRONCLAD_BRIGAND: 'ironclad_brigand',
  RIGGER: 'rigger',
  KRAKENS_ANCHOR: 'krakens_anchor', // boss
});

// Movement/attack archetypes — engine/enemies.mjs switches on this string.
export const ARCHETYPES = Object.freeze({
  SWARM: 'swarm', // small, fast, packs, orbits then darts in
  FLYER: 'flyer', // ignores tile collision, dive-bombs
  SUBMERGED: 'submerged', // invulnerable/hidden until it surfaces to strike
  TANK: 'tank', // slow, high HP, armored, relentless approach
  FLANKER: 'flanker', // fast, circles, tries to stay off the player's bow
});

export const ENEMIES = {
  [ENEMY_IDS.REEF_SKIMMER]: {
    id: ENEMY_IDS.REEF_SKIMMER,
    name: 'Reef Skimmer',
    archetype: ARCHETYPES.SWARM,
    counter: WEAPON_IDS.GRAPESHOT,
    maxHealth: 14,
    radius: 7,
    speed: 105,
    contactDamage: 6,
    contactCooldown: 0.6,
    packSize: [3, 5],
    salvageDrop: [2, 4],
    color: '#5aa0c8',
  },
  [ENEMY_IDS.GULLSWARM_HARPY]: {
    id: ENEMY_IDS.GULLSWARM_HARPY,
    name: 'Gullswarm Harpy',
    archetype: ARCHETYPES.FLYER,
    counter: WEAPON_IDS.CHAIN_SHOT,
    maxHealth: 18,
    radius: 8,
    speed: 130,
    contactDamage: 9,
    contactCooldown: 1.0,
    diveIntervalSeconds: [1.6, 2.6],
    salvageDrop: [3, 6],
    color: '#e8dfc4',
  },
  [ENEMY_IDS.DEEP_CRAWLER]: {
    id: ENEMY_IDS.DEEP_CRAWLER,
    name: 'Deep Crawler',
    archetype: ARCHETYPES.SUBMERGED,
    counter: WEAPON_IDS.DEPTH_CHARGES,
    maxHealth: 22,
    radius: 9,
    speed: 70,
    contactDamage: 14,
    contactCooldown: 1.4,
    submergedSeconds: [1.8, 3.0],
    surfacedSeconds: 1.1, // vulnerable + attacking window
    salvageDrop: [4, 8],
    color: '#2f5240',
  },
  [ENEMY_IDS.IRONCLAD_BRIGAND]: {
    id: ENEMY_IDS.IRONCLAD_BRIGAND,
    name: 'Ironclad Brigand',
    archetype: ARCHETYPES.TANK,
    counter: WEAPON_IDS.FLAME_BARRELS,
    maxHealth: 60,
    radius: 12,
    speed: 45,
    contactDamage: 12,
    contactCooldown: 1.0,
    salvageDrop: [8, 14],
    color: '#6b5638',
  },
  [ENEMY_IDS.RIGGER]: {
    id: ENEMY_IDS.RIGGER,
    name: 'Rigger',
    archetype: ARCHETYPES.FLANKER,
    counter: WEAPON_IDS.CHAIN_SHOT,
    maxHealth: 16,
    radius: 7,
    speed: 150,
    contactDamage: 7,
    contactCooldown: 0.7,
    salvageDrop: [3, 5],
    color: '#b04a4a',
  },
  [ENEMY_IDS.KRAKENS_ANCHOR]: {
    id: ENEMY_IDS.KRAKENS_ANCHOR,
    name: "The Kraken's Anchor",
    archetype: ARCHETYPES.TANK, // phase logic overrides movement in engine/enemies.mjs
    isBoss: true,
    maxHealth: 220,
    radius: 22,
    speed: 55,
    contactDamage: 18,
    contactCooldown: 1.2,
    salvageDrop: [40, 60],
    color: '#3a2a4a',
    // Alternates phases; engine/enemies.mjs reads `phases[phaseIndex]` to
    // pick the current counter weapon and archetype behavior.
    phases: [
      { archetype: ARCHETYPES.SUBMERGED, counter: WEAPON_IDS.DEPTH_CHARGES, durationSeconds: 14 },
      { archetype: ARCHETYPES.TANK, counter: WEAPON_IDS.FLAME_BARRELS, durationSeconds: 14 },
    ],
  },
};

export const ENEMY_LIST = Object.values(ENEMIES);

export function getEnemy(id) {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy id: ${id}`);
  return enemy;
}

// Early-reef vs later-reef spawn mix, per the PRD's Enemies section
// ("early reefs favor Skimmers and Harpies... later reefs mix in Crawlers,
// Brigands, and Riggers together").
export function spawnPoolForReefIndex(reefIndex) {
  if (reefIndex <= 0) {
    return [ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY];
  }
  if (reefIndex === 1) {
    return [ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY, ENEMY_IDS.DEEP_CRAWLER, ENEMY_IDS.RIGGER];
  }
  return [
    ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY, ENEMY_IDS.DEEP_CRAWLER,
    ENEMY_IDS.IRONCLAD_BRIGAND, ENEMY_IDS.RIGGER,
  ];
}
