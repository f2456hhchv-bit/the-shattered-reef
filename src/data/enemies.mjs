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
  FIRE_SHIP: 'fire_ship', // rams you and blows up
  MORTAR_BOAT: 'mortar_boat', // lobs shells at where you'll be
  // Glacial (stage 3) and Shipwreck (stage 4) rosters, 2026-09-29.
  FROST_NARWHAL: 'frost_narwhal',
  ICE_GOLEM: 'ice_golem',
  FROST_WISP: 'frost_wisp',
  GHOST_SHIP: 'ghost_ship',
  DROWNED_SKIFF: 'drowned_skiff',
  SIREN: 'siren',
  FROST_LEVIATHAN: 'frost_leviathan', // boss, stage 3
  DROWNED_ADMIRAL: 'drowned_admiral', // boss, stage 4
  // 2026-09-29, stages 5-10 (one biome each).
  CINDER_BAT: 'cinder_bat', MAGMA_GOLEM: 'magma_golem', OBSIDIAN_GALLEY: 'obsidian_galley', CALDERA_WYRM: 'caldera_wyrm',
  CAVE_BATS: 'cave_bats', STALKER_EEL: 'stalker_eel', DEEP_TROLL: 'deep_troll', HOLLOW_KING: 'hollow_king',
  BAYOU_GATOR: 'bayou_gator', BOG_WITCH: 'bog_witch', LEECH_SWARM: 'leech_swarm', MIRE_MOTHER: 'mire_mother',
  ANGLERFISH: 'anglerfish', JELLY_BLOOM: 'jelly_bloom', INK_SQUID: 'ink_squid', DEEP_MOTHER: 'deep_mother',
  DUNE_RAIDER: 'dune_raider', BONE_VULTURE: 'bone_vulture', SAND_WYRM: 'sand_wyrm', DUNEMAW: 'dunemaw',
  PRISM_SPRITE: 'prism_sprite', MIRROR_TORTOISE: 'mirror_tortoise', CRYSTAL_CRAB: 'crystal_crab', PRISM_COLOSSUS: 'prism_colossus',
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
  RAMMER: 'rammer', // lights its sails, then drives straight at you
  GHOST: 'ghost', // fades out of this world (untouchable, sails through rock), then back to fire
  SIREN: 'siren', // rooted on the water; her song drags your ship toward her
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
  // A mortar shell: lobbed at where you're heading, lands after `flight`
  // seconds with a blast `blast` px wide. The landing spot is marked.
  mortar: { pattern: 'lob', count: 1, spread: 0, speed: 1, flight: 1.35, blast: 28, damage: 13, range: 240, windup: 0.6, cooldown: [3.0, 4.0], kind: 'shell' },
  // Frost: every hit chills your ship (stiff rudder, slower) for `chill` s.
  frostBolt: { pattern: 'aimed', count: 1, spread: 0, speed: 150, damage: 5, range: 190, windup: 0.6, cooldown: [2.2, 3.0], kind: 'frost', chill: 1.8 },
  icequake: { pattern: 'ring', count: 8, spread: 0, speed: 110, damage: 6, range: 170, windup: 1.0, cooldown: [3.5, 4.5], kind: 'frost', chill: 1.4 },
  frostBreath: { pattern: 'aimed', count: 5, spread: 0.22, speed: 150, damage: 8, range: 220, windup: 0.7, cooldown: [0.1, 0.1], kind: 'frost', chill: 1.8, onlyWhenSurfaced: true, oncePerSurface: true },
  leviathanQuake: { pattern: 'ring', count: 12, spread: 0, speed: 120, damage: 7, range: 210, windup: 1.1, cooldown: [2.6, 3.2], kind: 'frost', chill: 1.4 },
  // Spectral: ghost-ship fire.
  ghostBroadside: { pattern: 'broadside', count: 3, spread: 12, speed: 140, damage: 8, range: 170, windup: 0.8, cooldown: [2.8, 3.6], kind: 'spectral' },
  admiralBroadside: { pattern: 'broadside', count: 5, spread: 11, speed: 145, damage: 9, range: 200, windup: 0.9, cooldown: [2.4, 3.0], kind: 'spectral', bothSides: true },
  flagshipChase: { pattern: 'aimed', count: 3, spread: 0.28, speed: 160, damage: 8, range: 220, windup: 0.6, cooldown: [1.8, 2.4], kind: 'ball' },
  // 2026-09-29, stages 5-10. `afflict` puts a status on your ship when a
  // shot lands (engine/boat.mjs AFFLICTIONS): burn and poison hurt over
  // time, shock stalls your sails, ink blinds you.
  incendiaryBroadside: { pattern: 'broadside', count: 3, spread: 12, speed: 135, damage: 6, range: 175, windup: 0.9, cooldown: [3.0, 3.8], kind: 'fire', afflict: { burn: 1 } },
  magmaSlam: { pattern: 'ring', count: 10, spread: 0, speed: 105, damage: 6, range: 170, windup: 1.0, cooldown: [3.4, 4.4], kind: 'fire', afflict: { burn: 1.5 } },
  magmaSpit: { pattern: 'aimed', count: 5, spread: 0.24, speed: 150, damage: 8, range: 220, windup: 0.7, cooldown: [0.1, 0.1], kind: 'fire', afflict: { burn: 2 }, onlyWhenSurfaced: true, oncePerSurface: true },
  boulderLob: { pattern: 'lob', count: 1, spread: 0, speed: 1, flight: 1.5, blast: 32, damage: 15, range: 230, windup: 0.8, cooldown: [3.2, 4.2], kind: 'boulder' },
  boulderRing: { pattern: 'ring', count: 12, spread: 0, speed: 115, damage: 7, range: 200, windup: 1.1, cooldown: [2.8, 3.4], kind: 'boulder' },
  hexBolt: { pattern: 'aimed', count: 3, spread: 0.3, speed: 135, damage: 5, range: 200, windup: 0.7, cooldown: [2.6, 3.4], kind: 'hex', afflict: { poison: 3.5 } },
  sporeRing: { pattern: 'ring', count: 10, spread: 0, speed: 100, damage: 5, range: 180, windup: 1.0, cooldown: [3.0, 3.8], kind: 'spore', afflict: { poison: 3 } },
  inkSpray: { pattern: 'aimed', count: 3, spread: 0.22, speed: 135, damage: 4, range: 190, windup: 0.7, cooldown: [3.2, 4.0], kind: 'ink', afflict: { ink: 3 } },
  inkBreath: { pattern: 'aimed', count: 5, spread: 0.22, speed: 145, damage: 7, range: 220, windup: 0.7, cooldown: [0.1, 0.1], kind: 'ink', afflict: { ink: 2.5 }, onlyWhenSurfaced: true, oncePerSurface: true },
  shockRing: { pattern: 'ring', count: 12, spread: 0, speed: 110, damage: 6, range: 200, windup: 1.0, cooldown: [2.8, 3.4], kind: 'shock', afflict: { shock: 0.6 } },
  raiderVolley: { pattern: 'aimed', count: 2, spread: 0.2, speed: 150, damage: 4, range: 195, windup: 0.6, cooldown: [2.8, 3.6], kind: 'ball' },
  sandSpit: { pattern: 'aimed', count: 3, spread: 0.34, speed: 130, damage: 5, range: 180, windup: 0.5, cooldown: [0.1, 0.1], kind: 'sand', onlyWhenSurfaced: true, oncePerSurface: true },
  sandBurst: { pattern: 'ring', count: 12, spread: 0, speed: 115, damage: 8, range: 200, windup: 0.6, cooldown: [0.1, 0.1], kind: 'sand', onlyWhenSurfaced: true, oncePerSurface: true },
  sandVolley: { pattern: 'aimed', count: 5, spread: 0.2, speed: 150, damage: 7, range: 220, windup: 0.7, cooldown: [2.0, 2.6], kind: 'sand' },
  prismBolt: { pattern: 'aimed', count: 1, spread: 0, speed: 150, damage: 5, range: 200, windup: 0.6, cooldown: [2.6, 3.4], kind: 'prism' },
  prismSpiral: { pattern: 'ring', count: 6, spread: 0, speed: 120, damage: 6, range: 230, windup: 0.5, cooldown: [0.8, 0.9], kind: 'prism', spin: 0.33 },
  shardBurst: { pattern: 'ring', count: 10, spread: 0, speed: 125, damage: 7, range: 210, windup: 0.9, cooldown: [2.4, 3.0], kind: 'prism' },
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

// 2026-09-29 (project owner: "not enough enemies per stage"): two new
// ships that ask for different reactions.
// Fire Ship: a hulk packed with powder. It lights its sails, then drives
// straight at you and blows up on contact. Sink it at range — and when it
// goes up, it burns whatever pirates are sailing beside it.
ENEMIES[ENEMY_IDS.FIRE_SHIP] = {
  id: ENEMY_IDS.FIRE_SHIP,
  name: 'Fire Ship',
  archetype: ARCHETYPES.RAMMER,
  counter: WEAPON_IDS.CANNONBALLS,
  faction: FACTION_IDS.REAVERS,
  maxHealth: 26,
  radius: 11,
  speed: 92, // slower than every hull: you can always outrun it
  kindleSeconds: 0.9, // the tell: its sails catch before it charges
  contactDamage: 24, // the explosion
  contactCooldown: 1,
  explodes: { radius: 60, damage: 30 }, // sunk by you: hurts enemies nearby
  salvageDrop: [3, 6],
  color: '#d9772b',
};
// Mortar Gunboat: hangs back and lobs shells at where you'll be. The
// landing spot is marked on the water — keep moving.
ENEMIES[ENEMY_IDS.MORTAR_BOAT] = {
  id: ENEMY_IDS.MORTAR_BOAT,
  name: 'Mortar Gunboat',
  archetype: ARCHETYPES.SKIRMISHER,
  counter: WEAPON_IDS.CANNONBALLS,
  faction: FACTION_IDS.IRON_ACCORD,
  maxHealth: 40,
  radius: 11,
  speed: 55,
  preferredRange: 175,
  contactDamage: 6,
  contactCooldown: 1,
  gun: GUNS.mortar,
  salvageDrop: [5, 8],
  color: '#5b6b3a',
};

// ---- Glacial roster (stage 3, Frostfang Fjord). Ice melts to fire; frost
// chills your ship. ----
ENEMIES[ENEMY_IDS.FROST_NARWHAL] = {
  id: ENEMY_IDS.FROST_NARWHAL, name: 'Frost Narwhal', archetype: ARCHETYPES.SHARK,
  counter: WEAPON_IDS.GRAPESHOT, faction: FACTION_IDS.REAVERS,
  maxHealth: 34, radius: 10, speed: 100, chargeSpeed: 265, circleRadius: 100,
  chargeWindup: 0.7, chargeSeconds: 0.7, chargeEvery: [2.2, 3.2],
  contactDamage: 12, contactCooldown: 0.9, chillOnHit: 2.2, // its tusk leaves ice on your rudder
  salvageDrop: [5, 8], color: '#d8ecf5',
};
ENEMIES[ENEMY_IDS.ICE_GOLEM] = {
  id: ENEMY_IDS.ICE_GOLEM, name: 'Ice Golem', archetype: ARCHETYPES.TANK,
  counter: WEAPON_IDS.FLAME_BARRELS, faction: FACTION_IDS.IRON_ACCORD,
  maxHealth: 70, radius: 13, speed: 40, contactDamage: 14, contactCooldown: 1.2,
  gun: GUNS.icequake, // slams the water: a ring of ice shards
  salvageDrop: [8, 12], color: '#bfe3f2',
};
ENEMIES[ENEMY_IDS.FROST_WISP] = {
  id: ENEMY_IDS.FROST_WISP, name: 'Frost Wisp', archetype: ARCHETYPES.SKIRMISHER, flies: true,
  counter: WEAPON_IDS.CHAIN_SHOT, faction: FACTION_IDS.WYRDTIDE,
  maxHealth: 20, radius: 8, speed: 85, preferredRange: 130, contactDamage: 4, contactCooldown: 1,
  gun: GUNS.frostBolt, salvageDrop: [3, 6], color: '#9fe3ff',
};
// ---- Shipwreck roster (stage 4, The Wreckers' Graveyard). ----
ENEMIES[ENEMY_IDS.GHOST_SHIP] = {
  id: ENEMY_IDS.GHOST_SHIP, name: 'Ghost Ship', archetype: ARCHETYPES.GHOST,
  counter: WEAPON_IDS.FLAME_BARRELS, faction: FACTION_IDS.WYRDTIDE,
  maxHealth: 50, radius: 12, speed: 60, preferredRange: 110,
  phasedSeconds: [2.2, 3.2], solidSeconds: [3.2, 4.2],
  contactDamage: 8, contactCooldown: 1, gun: GUNS.ghostBroadside,
  salvageDrop: [7, 11], color: '#7fffd0',
};
ENEMIES[ENEMY_IDS.DROWNED_SKIFF] = {
  id: ENEMY_IDS.DROWNED_SKIFF, name: 'Drowned Skiff', archetype: ARCHETYPES.SWARM,
  counter: WEAPON_IDS.GRAPESHOT, faction: FACTION_IDS.REAVERS,
  maxHealth: 14, radius: 8, speed: 105, packSize: [3, 4],
  contactDamage: 6, contactCooldown: 0.8, salvageDrop: [2, 4], color: '#6b7b6a',
};
ENEMIES[ENEMY_IDS.SIREN] = {
  id: ENEMY_IDS.SIREN, name: 'Siren', archetype: ARCHETYPES.SIREN,
  counter: WEAPON_IDS.CANNONBALLS, faction: FACTION_IDS.WYRDTIDE,
  maxHealth: 45, radius: 11, speed: 0, aggroRadius: 220,
  lureRadius: 220, lure: 75, // her song pulls your ship in (you can still sail away)
  contactDamage: 14, contactCooldown: 1, salvageDrop: [8, 12], color: '#e7a0c8',
};
// ---- Their bosses. ----
ENEMIES[ENEMY_IDS.FROST_LEVIATHAN] = {
  id: ENEMY_IDS.FROST_LEVIATHAN, name: 'The Frost Leviathan', archetype: ARCHETYPES.SERPENT, isBoss: true,
  maxHealth: 420, radius: 20, speed: 95, surfaceDistance: 115,
  submergedSeconds: [2.0, 2.8], surfacedSeconds: 2.4,
  contactDamage: 16, contactCooldown: 1.1, salvageDrop: [45, 65], color: '#a8d8ec',
  phases: [
    // Dives, surfaces beside you and breathes a fan of frost.
    { archetype: ARCHETYPES.SERPENT, counter: WEAPON_IDS.DEPTH_CHARGES, durationSeconds: 14, gun: GUNS.frostBreath },
    // Rears up and slams the ice: rings of shards, and the wisps come.
    { archetype: ARCHETYPES.TANK, counter: WEAPON_IDS.FLAME_BARRELS, durationSeconds: 12, gun: GUNS.leviathanQuake,
      summon: { defId: ENEMY_IDS.FROST_WISP, count: 2, everySeconds: 6, max: 4 } },
  ],
};
ENEMIES[ENEMY_IDS.DROWNED_ADMIRAL] = {
  id: ENEMY_IDS.DROWNED_ADMIRAL, name: 'The Drowned Admiral', archetype: ARCHETYPES.GHOST, isBoss: true,
  maxHealth: 420, radius: 20, speed: 50, preferredRange: 115,
  phasedSeconds: [2.0, 2.8], solidSeconds: [4.0, 5.0],
  contactDamage: 15, contactCooldown: 1.2, salvageDrop: [45, 65], color: '#6fffc6',
  phases: [
    // A ghost galleon: fades out, reappears, looses spectral broadsides.
    { archetype: ARCHETYPES.GHOST, counter: WEAPON_IDS.FLAME_BARRELS, durationSeconds: 14, gun: GUNS.admiralBroadside },
    // Solid and furious, calling up his drowned crew.
    { archetype: ARCHETYPES.BROADSIDER, counter: WEAPON_IDS.GRAPESHOT, durationSeconds: 12, gun: GUNS.flagshipChase,
      summon: { defId: ENEMY_IDS.DROWNED_SKIFF, count: 3, everySeconds: 6, max: 6 } },
  ],
};


// ==== Stages 5-10 (2026-09-29, project owner: "New biomes too... lava/
// volcanoes, caverns/caves/dark... any more?"). Each biome brings its own
// trick, always telegraphed or escapable, and every enemy still pairs
// with one counter weapon:
//   Volcanic   — burning (fire shots and bites keep hurting for a moment)
//   Caverns    — darkness (you see the attacks and their eyes, not them)
//   Mangrove   — camouflage (gators hide until close) and poison
//   Abyss      — dim light, lures, ink that blinds you, shocks that stall you
//   Bone Sands — burrowers that travel under the dunes
//   Crystal    — shots bounce off the crystal shore; armoured fronts
// `onHit` puts a status on your ship on contact; `glow` makes an enemy
// visible (and a light) in the dark; `camo` hides it until you're within
// that many px; `ambush` lurks at home and strikes inside `ambushRange`;
// `burrows` lets a serpent travel under land; `frontArmor` is the damage
// fraction taken from the front (flank it, or blast it from below).
const F = FACTION_IDS; const W = WEAPON_IDS; const A = ARCHETYPES; const E = ENEMY_IDS;
Object.assign(ENEMIES, {
  // ---- Volcanic ----
  [E.CINDER_BAT]: {
    id: E.CINDER_BAT, name: 'Cinder Bat', archetype: A.FLYER, counter: W.CHAIN_SHOT, faction: F.WYRDTIDE,
    maxHealth: 22, radius: 8, speed: 140, contactDamage: 8, contactCooldown: 1, diveIntervalSeconds: [1.5, 2.4],
    onHit: { burn: 1.5 }, glow: 30, salvageDrop: [4, 7], color: '#ff7a2a',
  },
  [E.MAGMA_GOLEM]: {
    id: E.MAGMA_GOLEM, name: 'Magma Golem', archetype: A.TANK, counter: W.DEPTH_CHARGES, faction: F.IRON_ACCORD,
    maxHealth: 80, radius: 13, speed: 40, contactDamage: 14, contactCooldown: 1.2, onHit: { burn: 1.5 },
    gun: GUNS.magmaSlam, glow: 40, salvageDrop: [9, 14], color: '#3a2a26',
  },
  [E.OBSIDIAN_GALLEY]: {
    id: E.OBSIDIAN_GALLEY, name: 'Obsidian Galley', archetype: A.BROADSIDER, counter: W.GRAPESHOT, faction: F.REAVERS,
    maxHealth: 48, radius: 12, speed: 60, preferredRange: 105, contactDamage: 8, contactCooldown: 1,
    gun: GUNS.incendiaryBroadside, salvageDrop: [7, 11], color: '#e8521f',
  },
  [E.CALDERA_WYRM]: {
    id: E.CALDERA_WYRM, name: 'The Caldera Wyrm', archetype: A.SERPENT, isBoss: true,
    maxHealth: 420, radius: 20, speed: 100, surfaceDistance: 115, submergedSeconds: [2.0, 2.8], surfacedSeconds: 2.4,
    diveIntervalSeconds: [1.8, 2.6], contactDamage: 16, contactCooldown: 1.1, onHit: { burn: 3 }, glow: 70,
    salvageDrop: [45, 65], color: '#d9481f',
    phases: [
      // Swims through the magma-hot water, surfaces beside you and spits fire.
      { archetype: A.SERPENT, counter: W.DEPTH_CHARGES, durationSeconds: 14, gun: GUNS.magmaSpit },
      // Takes wing: dive-bombs across the pit while the cinder bats come.
      { archetype: A.FLYER, counter: W.CHAIN_SHOT, durationSeconds: 12,
        summon: { defId: E.CINDER_BAT, count: 2, everySeconds: 6, max: 4 } },
    ],
  },
  // ---- Caverns ----
  [E.CAVE_BATS]: {
    id: E.CAVE_BATS, name: 'Cave Bats', archetype: A.SWARM, flies: true, counter: W.GRAPESHOT, faction: F.REAVERS,
    maxHealth: 12, radius: 6, speed: 118, packSize: [3, 5], contactDamage: 5, contactCooldown: 0.8,
    salvageDrop: [2, 3], color: '#4a3a4a', eyes: '#ff4a3a',
  },
  [E.STALKER_EEL]: {
    id: E.STALKER_EEL, name: 'Stalker Eel', archetype: A.SHARK, counter: W.DEPTH_CHARGES, faction: F.WYRDTIDE,
    maxHealth: 40, radius: 9, speed: 90, chargeSpeed: 270, circleRadius: 90, chargeWindup: 0.7, chargeSeconds: 0.65,
    chargeEvery: [1.6, 2.4], ambush: true, ambushRange: 130, contactDamage: 13, contactCooldown: 0.9, onHit: { shock: 0.5 },
    salvageDrop: [5, 8], color: '#3f6a5a', eyes: '#c8ff5a',
  },
  [E.DEEP_TROLL]: {
    id: E.DEEP_TROLL, name: 'Deep Troll', archetype: A.TANK, counter: W.FLAME_BARRELS, faction: F.IRON_ACCORD,
    maxHealth: 76, radius: 13, speed: 36, contactDamage: 16, contactCooldown: 1.3,
    gun: GUNS.boulderLob, salvageDrop: [9, 14], color: '#6a7a6a', eyes: '#ffd24a',
  },
  [E.HOLLOW_KING]: {
    id: E.HOLLOW_KING, name: 'The Hollow King', archetype: A.SUBMERGED, isBoss: true,
    maxHealth: 420, radius: 20, speed: 60, submergedSeconds: [1.8, 2.8], surfacedSeconds: 1.6,
    contactDamage: 17, contactCooldown: 1.2, salvageDrop: [45, 65], color: '#d8d2c4', eyes: '#9ae8ff',
    phases: [
      // Sinks under and swallows the light (your lantern shrinks).
      { archetype: A.SUBMERGED, counter: W.DEPTH_CHARGES, durationSeconds: 14, darken: 0.6 },
      // Rises, hurls rings of rock, and the bats pour out of the dark.
      { archetype: A.TANK, counter: W.FLAME_BARRELS, durationSeconds: 12, gun: GUNS.boulderRing,
        summon: { defId: E.CAVE_BATS, count: 3, everySeconds: 6, max: 6 } },
    ],
  },
  // ---- Mangrove ----
  [E.BAYOU_GATOR]: {
    id: E.BAYOU_GATOR, name: 'Bayou Gator', archetype: A.SHARK, counter: W.GRAPESHOT, faction: F.IRON_ACCORD,
    maxHealth: 46, radius: 10, speed: 80, chargeSpeed: 250, circleRadius: 95, chargeWindup: 0.7, chargeSeconds: 0.7,
    chargeEvery: [2.0, 3.0], ambush: true, ambushRange: 120, camo: 95, contactDamage: 13, contactCooldown: 1,
    salvageDrop: [6, 9], color: '#4f6a3a',
  },
  [E.BOG_WITCH]: {
    id: E.BOG_WITCH, name: 'Bog Witch', archetype: A.SKIRMISHER, flies: true, counter: W.CHAIN_SHOT, faction: F.WYRDTIDE,
    maxHealth: 32, radius: 9, speed: 70, preferredRange: 145, contactDamage: 5, contactCooldown: 1,
    gun: GUNS.hexBolt, glow: 28, salvageDrop: [5, 9], color: '#6a3a8a',
  },
  [E.LEECH_SWARM]: {
    id: E.LEECH_SWARM, name: 'Leech Swarm', archetype: A.SWARM, counter: W.FLAME_BARRELS, faction: F.REAVERS,
    maxHealth: 11, radius: 6, speed: 95, packSize: [4, 5], contactDamage: 3, contactCooldown: 0.7, onHit: { poison: 3 },
    salvageDrop: [1, 3], color: '#3a2a2a',
  },
  [E.MIRE_MOTHER]: {
    id: E.MIRE_MOTHER, name: 'Old Mother Mire', archetype: A.TANK, isBoss: true,
    maxHealth: 420, radius: 21, speed: 42, submergedSeconds: [1.8, 2.6], surfacedSeconds: 1.4,
    contactDamage: 16, contactCooldown: 1.2, onHit: { poison: 4 }, salvageDrop: [45, 65], color: '#5a6a3a',
    phases: [
      // Wades at you, puffing poison spores; leeches drop off her roots.
      { archetype: A.TANK, counter: W.FLAME_BARRELS, durationSeconds: 14, gun: GUNS.sporeRing,
        summon: { defId: E.LEECH_SWARM, count: 3, everySeconds: 6, max: 6 } },
      // Sinks into the mire and rises beside you.
      { archetype: A.SUBMERGED, counter: W.DEPTH_CHARGES, durationSeconds: 12 },
    ],
  },
  // ---- Abyss ----
  [E.ANGLERFISH]: {
    id: E.ANGLERFISH, name: 'Anglerfish', archetype: A.SHARK, counter: W.DEPTH_CHARGES, faction: F.WYRDTIDE,
    maxHealth: 50, radius: 11, speed: 70, chargeSpeed: 260, circleRadius: 90, chargeWindup: 0.6, chargeSeconds: 0.6,
    chargeEvery: [2.2, 3.0], ambush: true, ambushRange: 95, contactDamage: 14, contactCooldown: 1,
    glow: 55, salvageDrop: [8, 12], color: '#3a4a5a', lure: true,
  },
  [E.JELLY_BLOOM]: {
    id: E.JELLY_BLOOM, name: 'Jelly Bloom', archetype: A.TANK, counter: W.GRAPESHOT, faction: F.REAVERS,
    maxHealth: 16, radius: 8, speed: 32, packSize: [2, 3], contactDamage: 5, contactCooldown: 1.2, onHit: { shock: 0.5 },
    glow: 34, salvageDrop: [2, 4], color: '#b07aff',
  },
  [E.INK_SQUID]: {
    id: E.INK_SQUID, name: 'Ink Squid', archetype: A.SKIRMISHER, counter: W.CHAIN_SHOT, faction: F.IRON_ACCORD,
    maxHealth: 36, radius: 10, speed: 85, preferredRange: 135, contactDamage: 7, contactCooldown: 1,
    gun: GUNS.inkSpray, glow: 22, salvageDrop: [6, 9], color: '#c24a6a',
  },
  [E.DEEP_MOTHER]: {
    id: E.DEEP_MOTHER, name: 'The Deep Mother', archetype: A.SERPENT, isBoss: true,
    maxHealth: 420, radius: 21, speed: 95, surfaceDistance: 120, submergedSeconds: [2.0, 2.8], surfacedSeconds: 2.2,
    contactDamage: 16, contactCooldown: 1.1, glow: 80, salvageDrop: [45, 65], color: '#5a3aa8',
    phases: [
      { archetype: A.SERPENT, counter: W.DEPTH_CHARGES, durationSeconds: 14, gun: GUNS.inkBreath },
      { archetype: A.TANK, counter: W.CHAIN_SHOT, durationSeconds: 12, gun: GUNS.shockRing,
        summon: { defId: E.JELLY_BLOOM, count: 3, everySeconds: 6, max: 6 } },
    ],
  },
  // ---- Bone Sands ----
  [E.DUNE_RAIDER]: {
    id: E.DUNE_RAIDER, name: 'Dune Raider', archetype: A.SKIRMISHER, counter: W.CANNONBALLS, faction: F.REAVERS,
    maxHealth: 34, radius: 10, speed: 84, preferredRange: 135, contactDamage: 6, contactCooldown: 1,
    gun: GUNS.raiderVolley, salvageDrop: [6, 9], color: '#e0b050',
  },
  [E.BONE_VULTURE]: {
    id: E.BONE_VULTURE, name: 'Bone Vulture', archetype: A.FLYER, counter: W.CHAIN_SHOT, faction: F.WYRDTIDE,
    maxHealth: 24, radius: 9, speed: 130, contactDamage: 8, contactCooldown: 1, diveIntervalSeconds: [2.0, 3.0],
    salvageDrop: [4, 7], color: '#e8e0cc',
  },
  [E.SAND_WYRM]: {
    id: E.SAND_WYRM, name: 'Sand Wyrm', archetype: A.SERPENT, burrows: true, counter: W.DEPTH_CHARGES, faction: F.IRON_ACCORD,
    maxHealth: 44, radius: 10, speed: 110, submergedSeconds: [2.2, 3.0], surfacedSeconds: 1.6, surfaceDistance: 105,
    contactDamage: 9, contactCooldown: 1, gun: GUNS.sandSpit, salvageDrop: [6, 10], color: '#c8965a',
  },
  [E.DUNEMAW]: {
    id: E.DUNEMAW, name: 'The Dunemaw', archetype: A.SERPENT, burrows: true, isBoss: true,
    maxHealth: 420, radius: 22, speed: 105, surfaceDistance: 115, submergedSeconds: [1.8, 2.6], surfacedSeconds: 2.2,
    contactDamage: 18, contactCooldown: 1.2, salvageDrop: [45, 65], color: '#b8864a',
    phases: [
      // Burrows through the dunes and bursts up beside you in a ring of sand.
      { archetype: A.SERPENT, counter: W.DEPTH_CHARGES, durationSeconds: 14, gun: GUNS.sandBurst },
      // Rears out of the sand, spitting volleys; the vultures circle in.
      { archetype: A.TANK, counter: W.FLAME_BARRELS, durationSeconds: 12, gun: GUNS.sandVolley,
        summon: { defId: E.BONE_VULTURE, count: 2, everySeconds: 6, max: 4 } },
    ],
  },
  // ---- Crystal ----
  [E.PRISM_SPRITE]: {
    id: E.PRISM_SPRITE, name: 'Prism Sprite', archetype: A.SKIRMISHER, flies: true, counter: W.CHAIN_SHOT, faction: F.WYRDTIDE,
    maxHealth: 26, radius: 8, speed: 90, preferredRange: 140, contactDamage: 5, contactCooldown: 1,
    gun: GUNS.prismBolt, glow: 30, salvageDrop: [4, 7], color: '#c8a8ff',
  },
  [E.MIRROR_TORTOISE]: {
    id: E.MIRROR_TORTOISE, name: 'Mirror Tortoise', archetype: A.TANK, counter: W.DEPTH_CHARGES, faction: F.IRON_ACCORD,
    maxHealth: 80, radius: 13, speed: 34, frontArmor: 0.35, contactDamage: 11, contactCooldown: 1.3,
    salvageDrop: [10, 15], color: '#8ad8e8',
  },
  [E.CRYSTAL_CRAB]: {
    id: E.CRYSTAL_CRAB, name: 'Crystal Crab', archetype: A.SWARM, counter: W.GRAPESHOT, faction: F.REAVERS,
    maxHealth: 18, radius: 7, speed: 100, packSize: [3, 4], contactDamage: 6, contactCooldown: 0.8,
    salvageDrop: [2, 4], color: '#ff9ae0',
  },
  [E.PRISM_COLOSSUS]: {
    id: E.PRISM_COLOSSUS, name: 'The Prism Colossus', archetype: A.TOTEM, isBoss: true,
    maxHealth: 420, radius: 22, speed: 40, contactDamage: 16, contactCooldown: 1.2, glow: 90,
    salvageDrop: [45, 65], color: '#b89cff',
    phases: [
      // Rooted in the pit, spinning spirals of light off its facets.
      { archetype: A.TOTEM, counter: W.FLAME_BARRELS, durationSeconds: 13, gun: GUNS.prismSpiral },
      // Tears itself loose and wades after you; the sprites join in.
      { archetype: A.TANK, counter: W.GRAPESHOT, durationSeconds: 12, gun: GUNS.shardBurst,
        summon: { defId: E.PRISM_SPRITE, count: 2, everySeconds: 6, max: 4 } },
    ],
  },
});

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
