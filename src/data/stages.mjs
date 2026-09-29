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
    blurb: 'Pirate cutters and brigs. Cannonballs sink them all.',
    pools: [
      [E.PIRATE_CUTTER],
      [E.PIRATE_CUTTER, E.PIRATE_CUTTER, E.PIRATE_BRIG],
      [E.PIRATE_CUTTER, E.PIRATE_BRIG],
      [E.PIRATE_CUTTER, E.PIRATE_BRIG, E.PIRATE_BRIG],
      [E.PIRATE_CUTTER, E.PIRATE_CUTTER, E.PIRATE_BRIG],
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
      [E.REEF_SHARK, E.GULLSWARM_HARPY, E.PIRATE_BRIG, E.PIRATE_CUTTER],
      [E.REEF_SHARK, E.GULLSWARM_HARPY, E.PIRATE_CUTTER],
    ],
    boss: E.BLOODFIN_MATRIARCH,
  },
  {
    name: 'The Deep Reach',
    island: 'Frostfang Fjord',
    blurb: 'Things under the water, and ironclads. Depth Charges and Flame Barrels.',
    pools: [
      [E.SEA_SERPENT, E.PIRATE_CUTTER, E.REEF_SHARK],
      [E.SEA_SERPENT, E.DEEP_CRAWLER, E.GULLSWARM_HARPY],
      [E.SEA_SERPENT, E.DEEP_CRAWLER, E.IRONCLAD_BRIGAND, E.REEF_SHARK],
      [E.SEA_SERPENT, E.DEEP_CRAWLER, E.IRONCLAD_BRIGAND, E.PIRATE_BRIG, E.GULLSWARM_HARPY],
      [E.SEA_SERPENT, E.DEEP_CRAWLER, E.IRONCLAD_BRIGAND],
    ],
    boss: E.KRAKENS_ANCHOR,
  },
  {
    name: 'The Shattered Reef',
    island: "The Wreckers' Graveyard",
    blurb: 'Everything at once. Riggers jam your rudder.',
    pools: [
      [E.PIRATE_CUTTER, E.PIRATE_BRIG, E.REEF_SHARK, E.RIGGER],
      [E.REEF_SHARK, E.GULLSWARM_HARPY, E.SEA_SERPENT, E.RIGGER, E.REEF_SKIMMER],
      [E.PIRATE_BRIG, E.SEA_SERPENT, E.DEEP_CRAWLER, E.IRONCLAD_BRIGAND, E.RIGGER],
      [E.PIRATE_CUTTER, E.PIRATE_BRIG, E.REEF_SHARK, E.GULLSWARM_HARPY, E.SEA_SERPENT, E.DEEP_CRAWLER, E.IRONCLAD_BRIGAND, E.RIGGER],
      [E.REEF_SHARK, E.GULLSWARM_HARPY, E.SEA_SERPENT, E.IRONCLAD_BRIGAND, E.RIGGER],
    ],
    boss: null, // rotates through every boss (bossForStage)
  },
];

const BOSS_ROTATION = [E.PIRATE_FLAGSHIP, E.BLOODFIN_MATRIARCH, E.KRAKENS_ANCHOR];

export function stageInfo(stage) {
  return STAGES[Math.min(Math.max(1, stage || 1), STAGES.length) - 1];
}

export function stagePool(stage, levelIndex) {
  const pools = stageInfo(stage).pools;
  return [...pools[Math.min(Math.max(levelIndex, 0), pools.length - 1)]];
}

export function bossForStage(stage) {
  const s = Math.max(1, stage || 1);
  return stageInfo(s).boss ?? BOSS_ROTATION[(s - 1) % BOSS_ROTATION.length];
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
  let h = (s * 2654435761) >>> 0; h ^= h >>> 13;
  return `${NAME_FIRST[h % NAME_FIRST.length]} ${NAME_SECOND[(h >>> 8) % NAME_SECOND.length]}`;
}
