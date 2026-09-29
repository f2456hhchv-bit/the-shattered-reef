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

export const STAGES = [
  {
    name: 'Pirate Waters',
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
  // Stages past the table repeat this last roster (harder) and rotate bosses.
];

const BOSS_ROTATION = [E.PIRATE_FLAGSHIP, E.BLOODFIN_MATRIARCH, E.FROST_LEVIATHAN, E.DROWNED_ADMIRAL, E.KRAKENS_ANCHOR];

export function stageInfo(stage) {
  return STAGES[Math.min(Math.max(1, stage || 1), STAGES.length) - 1];
}

export function stagePool(stage, levelIndex) {
  const pools = stageInfo(stage).pools;
  return [...pools[Math.min(Math.max(levelIndex, 0), pools.length - 1)]];
}

export function bossForStage(stage) {
  const s = Math.max(1, stage || 1);
  if (s <= STAGES.length) return STAGES[s - 1].boss;
  return BOSS_ROTATION[(s - 1) % BOSS_ROTATION.length];
}

// Difficulty past the hand-built stages: +20% enemy hull and +10% enemy
// damage per stage beyond the table (stage 5 = 1.2x / 1.1x, stage 10 = 2.2x / 1.6x).
export function stageScaling(stage) {
  const extra = Math.max(0, (stage || 1) - STAGES.length);
  return { health: 1 + 0.2 * extra, damage: 1 + 0.1 * extra };
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
