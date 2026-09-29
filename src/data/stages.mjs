// Stage rosters (2026-09-29, project owner): "start off battling other
// ships, easy to defeat; as we progress through stages introduce monsters
// with different fighting strategies."
//
// Each stage lists one enemy pool per level (levels 1-4 are mazes, level 5
// is the lair) and the boss waiting in the lair. Ids listed twice are
// twice as likely per draw. Weapon caches in a level are for the weapons
// that counter its pool (engine/run.mjs), so a weapon turns up in the
// level that first needs it.
//
// Stages past the table repeat the last roster, harder: every enemy's hull
// and damage scale up with the stage number (stageScaling).

import { ENEMY_IDS as E } from './enemies.mjs';
import { BIOME_IDS as B } from './biomes.mjs';

export const STAGES = [
  {
    name: 'Pirate Waters',
    biome: B.TROPICAL,
    island: 'The Corsair Keys',
    blurb: 'Pirate cutters, brigs, fire ships and mortar boats. Cannonballs sink them all.',
    pools: [
      [E.PIRATE_CUTTER],
      [E.PIRATE_CUTTER, E.PIRATE_CUTTER, E.PIRATE_BRIG, E.FIRE_SHIP],
      [E.PIRATE_CUTTER, E.PIRATE_BRIG, E.FIRE_SHIP, E.MORTAR_BOAT],
      [E.PIRATE_CUTTER, E.PIRATE_BRIG, E.PIRATE_BRIG, E.FIRE_SHIP, E.MORTAR_BOAT],
      [E.PIRATE_CUTTER, E.PIRATE_CUTTER, E.PIRATE_BRIG, E.FIRE_SHIP, E.MORTAR_BOAT],
    ],
    boss: E.PIRATE_FLAGSHIP,
  },
  {
    name: 'Shark Shallows',
    biome: B.CLIFF_COVE,
    island: 'Sharkstooth Cove',
    blurb: 'Sharks charge, gulls dive. Grapeshot and Chain Shot.',
    pools: [
      [E.PIRATE_CUTTER, E.REEF_SHARK],
      [E.REEF_SHARK, E.REEF_SHARK, E.PIRATE_CUTTER, E.GULLSWARM_HARPY],
      [E.REEF_SHARK, E.GULLSWARM_HARPY, E.PIRATE_BRIG],
      [E.REEF_SHARK, E.GULLSWARM_HARPY, E.PIRATE_BRIG, E.PIRATE_CUTTER, E.FIRE_SHIP],
      [E.REEF_SHARK, E.GULLSWARM_HARPY, E.PIRATE_CUTTER, E.FIRE_SHIP],
    ],
    boss: E.BLOODFIN_MATRIARCH,
  },
  {
    name: 'The Deep Reach',
    biome: B.GLACIAL,
    island: 'Frostfang Fjord',
    blurb: 'Narwhals, ice golems, frost wisps, and serpents under the ice. Frost stiffens your rudder. Flame, Depth Charges, Chain Shot.',
    pools: [
      [E.FROST_NARWHAL, E.FROST_NARWHAL, E.PIRATE_CUTTER, E.SEA_SERPENT],
      [E.FROST_NARWHAL, E.ICE_GOLEM, E.SEA_SERPENT, E.FROST_WISP],
      [E.ICE_GOLEM, E.FROST_WISP, E.DEEP_CRAWLER, E.FROST_NARWHAL, E.MORTAR_BOAT],
      [E.ICE_GOLEM, E.FROST_WISP, E.SEA_SERPENT, E.DEEP_CRAWLER, E.FROST_NARWHAL, E.IRONCLAD_BRIGAND],
      [E.ICE_GOLEM, E.FROST_WISP, E.SEA_SERPENT, E.FROST_NARWHAL],
    ],
    boss: E.FROST_LEVIATHAN,
  },
  {
    name: 'The Shattered Reef',
    biome: B.SHIPWRECK,
    island: "The Wreckers' Graveyard",
    blurb: 'Ghost ships fade through the rocks, drowned crews swarm, sirens sing you onto them. Flame, Grapeshot, and Cannonballs for the sirens.',
    pools: [
      [E.DROWNED_SKIFF, E.PIRATE_CUTTER, E.GHOST_SHIP],
      [E.DROWNED_SKIFF, E.GHOST_SHIP, E.SIREN, E.RIGGER],
      [E.GHOST_SHIP, E.SIREN, E.DROWNED_SKIFF, E.GULLSWARM_HARPY, E.FIRE_SHIP],
      [E.GHOST_SHIP, E.SIREN, E.DROWNED_SKIFF, E.RIGGER, E.IRONCLAD_BRIGAND, E.MORTAR_BOAT, E.GULLSWARM_HARPY],
      [E.GHOST_SHIP, E.DROWNED_SKIFF, E.SIREN, E.RIGGER],
    ],
    boss: E.DROWNED_ADMIRAL,
  },
  // ---- 2026-09-29: six more biomes, each harder than the last (`scaling`
  // multiplies every enemy's hull and damage on top of its own stats).
  {
    name: 'Fire and Ash',
    biome: B.VOLCANIC,
    island: 'The Emberforge',
    blurb: 'Lava shores, cinder bats and burning galleys. Fire keeps hurting after it hits — Depth Charges quench the golems.',
    scaling: { health: 1.05, damage: 1 },
    pools: [
      [E.OBSIDIAN_GALLEY, E.PIRATE_CUTTER, E.PIRATE_CUTTER],
      [E.OBSIDIAN_GALLEY, E.CINDER_BAT, E.FIRE_SHIP, E.MORTAR_BOAT],
      [E.MAGMA_GOLEM, E.CINDER_BAT, E.OBSIDIAN_GALLEY, E.FIRE_SHIP],
      [E.MAGMA_GOLEM, E.CINDER_BAT, E.OBSIDIAN_GALLEY, E.MORTAR_BOAT, E.FIRE_SHIP, E.SEA_SERPENT],
      [E.MAGMA_GOLEM, E.CINDER_BAT, E.OBSIDIAN_GALLEY, E.FIRE_SHIP],
    ],
    boss: E.CALDERA_WYRM,
  },
  {
    name: 'The Sunless Deep',
    biome: B.CAVERNS,
    island: 'The Hollow Deep',
    blurb: 'Pitch-dark caverns: your lantern is all you see by. Watch for eyes in the dark, bat swarms and lurking eels.',
    scaling: { health: 1.1, damage: 1.03 },
    pools: [
      [E.CAVE_BATS, E.DEEP_CRAWLER],
      [E.CAVE_BATS, E.STALKER_EEL, E.DEEP_CRAWLER],
      [E.STALKER_EEL, E.DEEP_TROLL, E.CAVE_BATS, E.SEA_SERPENT],
      [E.STALKER_EEL, E.DEEP_TROLL, E.CAVE_BATS, E.DEEP_CRAWLER, E.SEA_SERPENT],
      [E.STALKER_EEL, E.DEEP_TROLL, E.CAVE_BATS],
    ],
    boss: E.HOLLOW_KING,
  },
  {
    name: 'The Bayou',
    biome: B.MANGROVE,
    island: 'Blackroot Bayou',
    blurb: 'Gators hide in the murk until you are close; witches and leeches poison your hull. Flame burns the leeches off.',
    scaling: { health: 1.15, damage: 1.06 },
    pools: [
      [E.LEECH_SWARM, E.BAYOU_GATOR, E.PIRATE_CUTTER],
      [E.BAYOU_GATOR, E.LEECH_SWARM, E.BOG_WITCH],
      [E.BOG_WITCH, E.BAYOU_GATOR, E.LEECH_SWARM, E.GULLSWARM_HARPY, E.DEEP_CRAWLER],
      [E.BOG_WITCH, E.BAYOU_GATOR, E.LEECH_SWARM, E.RIGGER, E.IRONCLAD_BRIGAND],
      [E.BOG_WITCH, E.BAYOU_GATOR, E.LEECH_SWARM],
    ],
    boss: E.MIRE_MOTHER,
  },
  {
    name: 'The Abyss',
    biome: B.ABYSS,
    island: 'The Drowned Abyss',
    blurb: 'The deepest dark water. Lights that lure you in, jellies that shock your sails still, squid ink that blinds you.',
    scaling: { health: 1.2, damage: 1.09 },
    pools: [
      [E.JELLY_BLOOM, E.SEA_SERPENT],
      [E.JELLY_BLOOM, E.ANGLERFISH, E.INK_SQUID],
      [E.ANGLERFISH, E.INK_SQUID, E.JELLY_BLOOM, E.DEEP_CRAWLER],
      [E.ANGLERFISH, E.INK_SQUID, E.JELLY_BLOOM, E.SEA_SERPENT, E.GHOST_SHIP],
      [E.ANGLERFISH, E.INK_SQUID, E.JELLY_BLOOM],
    ],
    boss: E.DEEP_MOTHER,
  },
  {
    name: 'The Bone Sands',
    biome: B.BONE_SANDS,
    island: 'The Ossuary Dunes',
    blurb: 'A desert coast. Raiders, vultures, and wyrms that swim under the dunes and burst up beside you. Sandstorms blind.',
    scaling: { health: 1.25, damage: 1.12 },
    pools: [
      [E.DUNE_RAIDER, E.PIRATE_CUTTER, E.DUNE_RAIDER],
      [E.DUNE_RAIDER, E.DUNE_RAIDER, E.BONE_VULTURE, E.SAND_WYRM],
      [E.SAND_WYRM, E.DUNE_RAIDER, E.BONE_VULTURE, E.MORTAR_BOAT, E.REEF_SHARK],
      [E.SAND_WYRM, E.DUNE_RAIDER, E.BONE_VULTURE, E.FIRE_SHIP, E.IRONCLAD_BRIGAND],
      [E.SAND_WYRM, E.DUNE_RAIDER, E.BONE_VULTURE],
    ],
    boss: E.DUNEMAW,
  },
  {
    name: 'The Prism Sea',
    biome: B.CRYSTAL,
    island: 'The Prism Lagoon',
    blurb: 'Crystal shores bounce every shot — yours and theirs. Mirror tortoises shrug off hits from the front: flank them, or blast from below.',
    scaling: { health: 1.3, damage: 1.15 },
    pools: [
      [E.CRYSTAL_CRAB, E.PRISM_SPRITE],
      [E.CRYSTAL_CRAB, E.PRISM_SPRITE, E.MIRROR_TORTOISE],
      [E.MIRROR_TORTOISE, E.PRISM_SPRITE, E.CRYSTAL_CRAB, E.FROST_WISP, E.SIREN],
      [E.MIRROR_TORTOISE, E.PRISM_SPRITE, E.CRYSTAL_CRAB, E.GHOST_SHIP, E.ICE_GOLEM],
      [E.MIRROR_TORTOISE, E.PRISM_SPRITE, E.CRYSTAL_CRAB],
    ],
    boss: E.PRISM_COLOSSUS,
  },
  // Stages past the table start over from stage 1's biome, harder each lap.
];

export function stageInfo(stage) {
  const s = Math.max(1, stage || 1);
  return STAGES[(s - 1) % STAGES.length];
}

export function stagePool(stage, levelIndex) {
  const pools = stageInfo(stage).pools;
  return [...pools[Math.min(Math.max(levelIndex, 0), pools.length - 1)]];
}

export function bossForStage(stage) {
  return stageInfo(stage).boss;
}

// Difficulty: each hand-built stage carries its own `scaling`; past the
// table the stages cycle through the biomes again at the last stage's
// scaling plus +20% enemy hull and +10% damage per stage beyond it.
export function stageScaling(stage) {
  const s = Math.max(1, stage || 1);
  if (s <= STAGES.length) return { health: 1, damage: 1, ...(STAGES[s - 1].scaling || {}) };
  const last = STAGES[STAGES.length - 1].scaling || { health: 1, damage: 1 };
  const extra = s - STAGES.length;
  return { health: last.health + 0.2 * extra, damage: last.damage + 0.1 * extra };
}

// Island names (2026-09-29): every stage on the voyage map is an island
// group with a name. The first four are hand-named; later ones are
// generated from the stage number (the same stage always gets the same
// name), so the chart can run on for as long as there are stages.
const NAME_FIRST = ['Blackwater', 'Stormcrow', 'Saltbone', 'Mourning', 'Grimtide', 'Emberreach', "Siren's", 'Hollowmoon', "Dead Man's", 'Gallows', 'Brinewood', 'Thunderhead', 'Widow\'s', 'Lanternfall', 'Ravenmoor', 'Coralcrown'];
const NAME_SECOND = ['Isles', 'Atoll', 'Reach', 'Sound', 'Rock', 'Shoals', 'Straits', 'Keys', 'Skerries', 'Narrows', 'Haven', 'Spit'];
export function stageName(stage) {
  const s = Math.max(1, stage || 1);
  if (s <= STAGES.length) return STAGES[s - 1].island;
  let h = (s * 2654435761) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
  return `${NAME_FIRST[h % NAME_FIRST.length]} ${NAME_SECOND[(h >>> 8) % NAME_SECOND.length]}`;
}
