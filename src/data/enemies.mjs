// Enemy definitions — five niches + one boss, each with exactly one real
// counter weapon (src/data/weapons.mjs) and a distinct movement/attack
// archetype so the player can read the threat by silhouette and behavior
// before it's in range, per the PRD's Enemies section.

import { WEAPON_IDS } from './weapons.mjs';
import { FACTION_IDS } from './factions.mjs';

export const ENEMY_IDS = Object.freeze({
  REEF_SKIMMER: 'reef_skimmer',
  GULLSWARM_HARPY: 'gullswarm_harpy',
  DEEP_CRAWLER: 'deep_crawler',
  IRONCLAD_BRIGAND: 'ironclad_brigand',
  RIGGER: 'rigger',
  KRAKENS_ANCHOR: 'krakens_anchor', // boss
  // 2026-09-29 roster rework: ships first, monsters later.
  PIRATE_CUTTER: 'pirate_cutter',
  PIRATE_BRIG: 'pirate_brig',
  REEF_SHARK: 'reef_shark',
  SEA_SERPENT: 'sea_serpent',
  PIRATE_FLAGSHIP: 'pirate_flagship', // boss, stage 1
  BLOODFIN_MATRIARCH: 'bloodfin_matriarch', // boss, stage 2
  WARDING_SEAL: 'warding_seal', // lair: shields the boss until destroyed
});

// Movement/attack archetypes — engine/enemies.mjs switches on this string.
export const ARCHETYPES = Object.freeze({
  SWARM: 'swarm', // small, fast, packs, orbits then darts in
  FLYER: 'flyer', // ignores tile collision, dive-bombs
  SUBMERGED: 'submerged', // invulnerable/hidden until it surfaces to strike
  TANK: 'tank', // slow, high HP, armored, relentless approach
  FLANKER: 'flanker', // fast, circles, tries to stay off the player's bow
  SKIRMISHER: 'skirmisher', // keeps its distance and shoots
  BROADSIDER: 'broadsider', // circles to bring its broadside to bear
  SHARK: 'shark', // circles, telegraphs, charges in a straight line
  SERPENT: 'serpent', // dives, resurfaces beside you, spits
  TOTEM: 'totem', // never moves; shoots whatever comes in range
});

// Enemy guns (engine/enemyGuns.mjs). Every shot has a wind-up the player
// can see (glowing gunports, a sighting line) and a projectile slow enough
// to dodge; early ships reload slowly. `pattern`:
//   aimed     — `count` balls at where you're heading, `spread` apart
//   broadside — `count` parallel balls fired off the side facing you
//   ring      — `count` balls in all directions (boss finale)
export const GUNS = Object.freeze({
  cutter: { pattern: 'aimed', count: 1, spread: 0, speed: 150, damage: 6, range: 190, windup: 0.55, cooldown: [2.4, 3.4], kind: 'ball' },
  brig: { pattern: 'broadside', count: 3, spread: 12, speed: 140, damage: 8, range: 170, windup: 0.8, cooldown: [3.2, 4.2], kind: 'ball' },
  ironclad: { pattern: 'aimed', count: 1, spread: 0, speed: 120, damage: 14, range: 200, windup: 0.9, cooldown: [3.5, 4.5], kind: 'heavy' },
  serpent: { pattern: 'aimed', count: 3, spread: 0.32, speed: 135, damage: 7, range: 170, windup: 0.5, cooldown: [0.1, 0.1], kind: 'glob', onlyWhenSurfaced: true, oncePerSurface: true },
  flagshipBroadside: { pattern: 'broadside', count: 5, spread: 11, speed: 145, damage: 9, range: 200, windup: 0.9, cooldown: [2.4, 3.0], kind: 'ball', bothSides: true },
  seal: { pattern: 'aimed', count: 3, spread: 0.34, speed: 125, damage: 7, range: 210, windup: 0.8, cooldown: [2.4, 3.2], kind: 'glob' },
  flagshipChase: { pattern: 'aimed', count: 3, spread: 0.28, speed: 160, damage: 8, range: 220, windup: 0.6, cooldown: [1.8, 2.4], kind: 'ball' },
});

export const ENEMIES = {
  [ENEMY_IDS.REEF_SKIMMER]: {
    id: ENEMY_IDS.REEF_SKIMMER,
    name: 'Reef Skimmer',
    archetype: ARCHETYPES.SWARM,
    counter: WEAPON_IDS.GRAPESHOT,
    // Faction (post-slice combat triangle, PRD's own faction/enemy mapping
    // table) — a second, separate multiplier stacked on the weapon-counter
    // system above, not a substitute for it.
    faction: FACTION_IDS.REAVERS,
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
    faction: FACTION_IDS.WYRDTIDE,
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
    faction: FACTION_IDS.WYRDTIDE,
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
    faction: FACTION_IDS.IRON_ACCORD,
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
    faction: FACTION_IDS.REAVERS,
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
    // Deliberately no `faction` field — "an Ancient-tier threat, not
    // faction-aligned" per the PRD. triangleMultiplier() treats a missing
    // faction as a no-op (1x), so the boss is never triangle-affected
    // regardless of the player's chosen faction.
    maxHealth: 380,
    radius: 22,
    speed: 55,
    contactDamage: 18,
    contactCooldown: 1.2,
    salvageDrop: [40, 60],
    color: '#3a2a4a',
    // Read by engine/enemies.mjs's updateSubmerged during phase 0 (and
    // any later phase whose archetype is SUBMERGED) — the same shape as
    // Deep Crawler's own fields, reused rather than invented fresh so
    // Depth Charges' existing tuning (already balanced against exactly
    // this submerge/surface cadence) applies unchanged to the boss.
    submergedSeconds: [1.8, 3.0],
    surfacedSeconds: 1.1,
    // Alternates phases; engine/enemies.mjs reads `phases[phaseIndex]` to
    // pick the current counter weapon and archetype behavior.
    phases: [
      { archetype: ARCHETYPES.SUBMERGED, counter: WEAPON_IDS.DEPTH_CHARGES, durationSeconds: 14 },
      { archetype: ARCHETYPES.TANK, counter: WEAPON_IDS.FLAME_BARRELS, durationSeconds: 14 },
    ],
  },

  // ---- 2026-09-29 roster: stage 1 is ships only, easy to sink. ----
  [ENEMY_IDS.PIRATE_CUTTER]: {
    id: ENEMY_IDS.PIRATE_CUTTER,
    name: 'Pirate Cutter',
    archetype: ARCHETYPES.SKIRMISHER,
    counter: WEAPON_IDS.CANNONBALLS,
    faction: FACTION_IDS.REAVERS,
    maxHealth: 22,
    radius: 10,
    speed: 72, // slower than any hull: you can always catch or escape it
    preferredRange: 125,
    contactDamage: 5,
    contactCooldown: 1.0,
    gun: GUNS.cutter,
    salvageDrop: [3, 5],
    color: '#c0392b', // red sail
  },
  [ENEMY_IDS.PIRATE_BRIG]: {
    id: ENEMY_IDS.PIRATE_BRIG,
    name: 'Pirate Brig',
    archetype: ARCHETYPES.BROADSIDER,
    counter: WEAPON_IDS.CANNONBALLS,
    faction: FACTION_IDS.IRON_ACCORD,
    maxHealth: 48,
    radius: 12,
    speed: 58,
    preferredRange: 105,
    contactDamage: 8,
    contactCooldown: 1.0,
    gun: GUNS.brig,
    salvageDrop: [6, 10],
    color: '#2c3e50', // black sails
  },
  // ---- Monsters, from stage 2 on. ----
  [ENEMY_IDS.REEF_SHARK]: {
    id: ENEMY_IDS.REEF_SHARK,
    name: 'Reef Shark',
    archetype: ARCHETYPES.SHARK,
    counter: WEAPON_IDS.GRAPESHOT,
    faction: FACTION_IDS.REAVERS,
    maxHealth: 28,
    radius: 9,
    speed: 95,
    chargeSpeed: 250,
    circleRadius: 95,
    chargeWindup: 0.65,
    chargeSeconds: 0.7,
    chargeEvery: [2.2, 3.4],
    contactDamage: 11,
    contactCooldown: 0.9,
    salvageDrop: [4, 7],
    color: '#5d7688',
  },
  [ENEMY_IDS.SEA_SERPENT]: {
    id: ENEMY_IDS.SEA_SERPENT,
    name: 'Sea Serpent',
    archetype: ARCHETYPES.SERPENT,
    counter: WEAPON_IDS.DEPTH_CHARGES,
    faction: FACTION_IDS.WYRDTIDE,
    maxHealth: 36,
    radius: 10,
    speed: 115, // while submerged, closing in
    submergedSeconds: [1.6, 2.4],
    surfacedSeconds: 1.8,
    surfaceDistance: 80, // resurfaces this far from the boat
    contactDamage: 9,
    contactCooldown: 1.0,
    gun: GUNS.serpent,
    salvageDrop: [5, 9],
    color: '#2e8b6f',
  },
  // ---- Stage bosses (engine/run.mjs puts one in each lair). ----
  [ENEMY_IDS.PIRATE_FLAGSHIP]: {
    id: ENEMY_IDS.PIRATE_FLAGSHIP,
    name: 'The Black Gale',
    archetype: ARCHETYPES.BROADSIDER,
    isBoss: true,
    maxHealth: 400,
    radius: 20,
    speed: 48,
    preferredRange: 110,
    contactDamage: 14,
    contactCooldown: 1.2,
    salvageDrop: [40, 60],
    color: '#1b1b22',
    phases: [
      { archetype: ARCHETYPES.BROADSIDER, counter: WEAPON_IDS.CANNONBALLS, durationSeconds: 13, gun: GUNS.flagshipBroadside },
      { archetype: ARCHETYPES.SKIRMISHER, counter: WEAPON_IDS.CANNONBALLS, durationSeconds: 11, gun: GUNS.flagshipChase,
        summon: { defId: ENEMY_IDS.PIRATE_CUTTER, count: 2, everySeconds: 7, max: 4 } },
    ],
  },
  [ENEMY_IDS.BLOODFIN_MATRIARCH]: {
    id: ENEMY_IDS.BLOODFIN_MATRIARCH,
    name: 'Bloodfin Matriarch',
    archetype: ARCHETYPES.SHARK,
    isBoss: true,
    maxHealth: 420,
    radius: 18,
    speed: 90,
    chargeSpeed: 230,
    circleRadius: 115,
    chargeWindup: 0.8,
    chargeSeconds: 0.9,
    chargeEvery: [1.8, 2.6],
    contactDamage: 16,
    contactCooldown: 1.0,
    submergedSeconds: [2.2, 3.0],
    surfacedSeconds: 1.6,
    salvageDrop: [45, 65],
    color: '#8a4b52',
    phases: [
      { archetype: ARCHETYPES.SHARK, counter: WEAPON_IDS.GRAPESHOT, durationSeconds: 14 },
      // Dives out of reach and sends the gulls: kill the Harpies (Chain
      // Shot), then punish her when she surfaces (Grapeshot).
      { archetype: ARCHETYPES.SUBMERGED, counter: WEAPON_IDS.GRAPESHOT, durationSeconds: 12,
        summon: { defId: ENEMY_IDS.GULLSWARM_HARPY, count: 2, everySeconds: 5, max: 4 } },
    ],
  },
};

// The lair's warding seals (2026-09-29, project owner: "Boss too easy").
// One stands on each ring of the lair; while any stands, the boss can't be
// hurt. Stationary, spits a fan of shot at anything in range, and sinks to
// any weapon (counter: Cannonballs, so auto-fire always has an answer).
ENEMIES[ENEMY_IDS.WARDING_SEAL] = {
  id: ENEMY_IDS.WARDING_SEAL,
  name: 'Warding Seal',
  archetype: ARCHETYPES.TOTEM,
  counter: WEAPON_IDS.CANNONBALLS,
  maxHealth: 70,
  radius: 13,
  speed: 0,
  aggroRadius: 210,
  contactDamage: 0,
  contactCooldown: 1,
  gun: GUNS.seal,
  salvageDrop: [8, 12],
  color: '#7a5cff',
};

// Bosses enrage below half hull once their seals are gone: faster, and
// their guns reload quicker (engine/enemies.mjs, engine/enemyGuns.mjs).
export const BOSS_ENRAGE = Object.freeze({ at: 0.5, speed: 1.35, reload: 0.6 });

export const ENEMY_LIST = Object.values(ENEMIES);

export function getEnemy(id) {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy id: ${id}`);
  return enemy;
}

// Early-reef vs later-reef spawn mix, per the PRD's Enemies section
// ("early reefs favor Skimmers and Harpies... later reefs mix in Crawlers,
// Brigands, and Riggers together"). Plain data (one array per reef) so a
// balance tool can sweep pool compositions without editing code; ids
// listed more than once are proportionally more likely per draw.
//
// The Kraken's Anchor (step 8 follow-up) is a chance-based entry in the
// final pool rather than a guaranteed spawn, per the project owner's
// explicit decision: it's drawn the same way as every other reef-3 enemy,
// so a voyage isn't guaranteed to meet it, and reef 3's regular spawn count
// (REEF_TUNING in engine/run.mjs) is deliberately left unchanged rather
// than reduced to make room for it. engine/enemies.mjs's spawnReefEnemies
// still special-cases *placement* for anything with `isBoss: true` (guards
// the exit, unique per reef) even though it's drawn from this same pool.
// Stages (2026-09-28): a stage is 5 levels in one biome, and these are the
// per-level enemy pools, level 1 first. The roster ramps in one new threat
// at a time, so each weapon's counter-role gets introduced rather than
// dumped on the player at once:
//   1  Reef Skimmers only — learnable with Cannonballs alone
//   2  + Gullswarm Harpies (Chain Shot)
//   3  + Deep Crawlers, Ironclad Brigands (Depth Charges, Flame Barrels) —
//      Brigands stay early-ish so Iron Accord is not absent for most of a
//      run (see the 2026-09-28 faction balance entries in CLAUDE.md)
//   4  + Riggers — the full roster
//   5  the full roster, and The Kraken's Anchor is guaranteed at the exit
//      (run.mjs places it; it's no longer a random pool draw)
export const SPAWN_POOLS = [
  [ENEMY_IDS.REEF_SKIMMER],
  [ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY],
  [ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY, ENEMY_IDS.DEEP_CRAWLER, ENEMY_IDS.IRONCLAD_BRIGAND],
  [ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY, ENEMY_IDS.DEEP_CRAWLER, ENEMY_IDS.IRONCLAD_BRIGAND, ENEMY_IDS.RIGGER],
  [ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY, ENEMY_IDS.DEEP_CRAWLER, ENEMY_IDS.IRONCLAD_BRIGAND, ENEMY_IDS.RIGGER],
];

// Returns a copy, so a caller can never mutate the shared pool by accident.
export function spawnPoolForReefIndex(reefIndex) {
  const i = Math.min(Math.max(reefIndex, 0), SPAWN_POOLS.length - 1);
  return [...SPAWN_POOLS[i]];
}
