// Reef Defence towers (2026-09-29, second game mode). Data only;
// engine/td.mjs runs them.
//
// Every tower is one of the voyage's five weapons turned into a fort, so
// the game's core "read the enemy, answer with the right weapon" rule
// carries straight over: a tower hits an enemy whose `counter` is its
// weapon for `counterMult` damage, anything else for `offMult`. The sixth
// tower, the Lighthouse, doesn't shoot: it lights the dark, reveals
// camouflaged and ghostly enemies, and makes nearby towers better.
//
// Reach rules (what a tower can target at all):
//   air        — can hit flyers
//   submerged  — can hit enemies under the water (only Depth Charges)
// Levels 1-3 are bought in the map; level 4 is one of two specialisations,
// each unlocked for good in the harbour's Tower Yard first.
//
// Per-level fields: cost (to build, or to upgrade to this level), damage,
// cooldown (s), range (px), and the tower's own extras:
//   splash      — blast radius around the target (px)
//   slow/slowFor — speed ×(1 - slow) for slowFor seconds
//   pierce      — extra enemies a shot passes through
//   burnDps/burnFor — burning damage over time (counts as flame)
//   stun        — seconds a hit stops an enemy
//   shred       — enemies hit take +shred damage from everything for 3 s
//   mines       — lays mines on the channel instead of firing (mine layer)
//   pool        — leaves burning pitch on the water (Greek fire)
//   cone        — continuous flame in a cone (Dragon's Breath)
//   aura        — lighthouse: { rangeBonus, damageBonus, reveal, light }
//   bounty      — extra gold per kill inside its range
//   beam        — lighthouse: enemies in range slowed and take more damage

import { WEAPON_IDS as W } from './weapons.mjs';

export const TOWER_IDS = Object.freeze({
  CANNON: 'cannon', GRAPESHOT: 'grapeshot', CHAIN: 'chain', DEPTH: 'depth', FLAME: 'flame', LIGHTHOUSE: 'lighthouse',
});

export const TOWERS = {
  cannon: {
    id: 'cannon', name: 'Cannon Battery', short: 'Cannon', icon: '⚫', weapon: W.CANNONBALLS,
    blurb: 'Steady all-rounder. Hits ships, monsters and flyers alike.',
    reach: { air: true, submerged: false }, counterMult: 1.35, offMult: 0.85,
    projectile: 'ball', shotSpeed: 330, color: '#3a3d42',
    levels: [
      { cost: 70, damage: 14, cooldown: 1.1, range: 104 },
      { cost: 80, damage: 22, cooldown: 1.0, range: 112 },
      { cost: 120, damage: 34, cooldown: 0.95, range: 120 },
    ],
    specs: [
      { id: 'long_nines', name: 'Long Nines', blurb: 'Huge range and a heavy ball; +50% against anything big.', cost: 190,
        damage: 72, cooldown: 1.7, range: 170, bigBonus: 0.5 },
      { id: 'carronade', name: 'Carronade', blurb: 'Short, brutal guns: every ball bursts over a crowd.', cost: 180,
        damage: 42, cooldown: 1.05, range: 115, splash: 36 },
    ],
  },
  grapeshot: {
    id: 'grapeshot', name: 'Grapeshot Nest', short: 'Grape', icon: '💥', weapon: W.GRAPESHOT,
    blurb: 'Short range, sprays a whole pack at once. Shreds swarms and small boats.',
    reach: { air: true, submerged: false }, counterMult: 1.6, offMult: 0.6,
    projectile: 'grape', shotSpeed: 380, color: '#8a7550',
    levels: [
      { cost: 80, damage: 9, cooldown: 0.85, range: 80, splash: 28 },
      { cost: 90, damage: 14, cooldown: 0.8, range: 86, splash: 31 },
      { cost: 130, damage: 21, cooldown: 0.75, range: 92, splash: 34 },
    ],
    specs: [
      { id: 'canister', name: 'Canister Shot', blurb: 'A wider blast; everything hit takes +20% damage from all towers for 3 s.', cost: 170,
        damage: 26, cooldown: 0.8, range: 94, splash: 46, shred: 0.2 },
      { id: 'swivel_battery', name: 'Swivel Battery', blurb: 'Four swivel guns: fires almost three times as often.', cost: 180,
        damage: 15, cooldown: 0.3, range: 96, splash: 24 },
    ],
  },
  chain: {
    id: 'chain', name: 'Chain Mast', short: 'Chain', icon: '⛓️', weapon: W.CHAIN_SHOT,
    blurb: 'Long reach, tangles and slows what it hits. The answer to flyers.',
    reach: { air: true, submerged: false }, counterMult: 1.7, offMult: 0.6,
    projectile: 'chain', shotSpeed: 300, color: '#7d848e',
    levels: [
      { cost: 90, damage: 10, cooldown: 0.9, range: 122, slow: 0.25, slowFor: 1.2, pierce: 1 },
      { cost: 90, damage: 16, cooldown: 0.85, range: 130, slow: 0.3, slowFor: 1.3, pierce: 1 },
      { cost: 130, damage: 24, cooldown: 0.8, range: 140, slow: 0.35, slowFor: 1.4, pierce: 1 },
    ],
    specs: [
      { id: 'bola_mast', name: 'Bola Mast', blurb: 'Heavy bolas: anything hit is slowed by more than half.', cost: 170,
        damage: 28, cooldown: 0.8, range: 145, slow: 0.55, slowFor: 2.4, pierce: 2 },
      { id: 'harpoon_ballista', name: 'Harpoon Ballista', blurb: 'A harpoon that skewers a whole line of enemies.', cost: 200,
        damage: 64, cooldown: 1.3, range: 175, slow: 0.2, slowFor: 1, pierce: 6 },
    ],
  },
  depth: {
    id: 'depth', name: 'Depth Charge Post', short: 'Depth', icon: '💣', weapon: W.DEPTH_CHARGES,
    blurb: 'Lobs charges into the channel. The only tower that hits what swims below.',
    reach: { air: false, submerged: true }, counterMult: 1.6, offMult: 0.7,
    projectile: 'charge', shotSpeed: 0, flight: 0.8, color: '#3d5a4a',
    levels: [
      { cost: 100, damage: 22, cooldown: 1.8, range: 96, splash: 34 },
      { cost: 100, damage: 34, cooldown: 1.7, range: 102, splash: 38 },
      { cost: 140, damage: 50, cooldown: 1.6, range: 110, splash: 42 },
    ],
    specs: [
      { id: 'mine_layer', name: 'Mine Layer', blurb: 'Seeds the channel with mines that blow as enemies pass.', cost: 190,
        damage: 64, cooldown: 2.2, range: 112, splash: 32, mines: 4 },
      { id: 'heavy_charges', name: 'Heavy Charges', blurb: 'Massive charges: a wide blast that stuns.', cost: 200,
        damage: 92, cooldown: 2.4, range: 112, splash: 58, stun: 0.8 },
    ],
  },
  flame: {
    id: 'flame', name: 'Fire Brazier', short: 'Flame', icon: '🔥', weapon: W.FLAME_BARRELS,
    blurb: 'Sets targets burning. Melts armour and anything big and slow.',
    reach: { air: false, submerged: false }, counterMult: 1.6, offMult: 0.7,
    projectile: 'fire', shotSpeed: 220, color: '#d9622f',
    levels: [
      { cost: 110, damage: 8, cooldown: 1.2, range: 86, burnDps: 7, burnFor: 3 },
      { cost: 100, damage: 12, cooldown: 1.15, range: 92, burnDps: 11, burnFor: 3 },
      { cost: 150, damage: 18, cooldown: 1.1, range: 98, burnDps: 17, burnFor: 3 },
    ],
    specs: [
      { id: 'greek_fire', name: 'Greek Fire', blurb: 'Every shot leaves a pool of burning pitch on the water.', cost: 190,
        damage: 22, cooldown: 1.2, range: 104, burnDps: 22, burnFor: 3, pool: { radius: 30, seconds: 3.5, dps: 18 } },
      { id: 'dragons_breath', name: "Dragon's Breath", blurb: 'A roaring jet of flame that burns everything in a cone.', cost: 210,
        damage: 0, cooldown: 0.25, range: 100, burnDps: 30, burnFor: 1.5, cone: 0.42 },
    ],
  },
  lighthouse: {
    id: 'lighthouse', name: 'Lighthouse', short: 'Light', icon: '🗼', weapon: null,
    blurb: "Doesn't shoot. Lights the dark, reveals hidden and ghostly enemies, and boosts nearby towers.",
    reach: { air: false, submerged: false }, counterMult: 1, offMult: 1,
    projectile: null, color: '#f3e7c4', support: true,
    levels: [
      { cost: 90, range: 120, aura: { rangeBonus: 0.1, damageBonus: 0, reveal: true, light: 1.15 } },
      { cost: 80, range: 138, aura: { rangeBonus: 0.14, damageBonus: 0.1, reveal: true, light: 1.15 } },
      { cost: 120, range: 156, aura: { rangeBonus: 0.18, damageBonus: 0.15, reveal: true, light: 1.2 } },
    ],
    specs: [
      { id: 'beacon_of_fortune', name: 'Beacon of Fortune', blurb: '+3 gold for every kill in its light.', cost: 170,
        range: 165, aura: { rangeBonus: 0.18, damageBonus: 0.15, reveal: true, light: 1.2 }, bounty: 3 },
      { id: 'blinding_lamp', name: 'Blinding Lamp', blurb: 'Enemies in its beam are slowed and take +20% damage.', cost: 200,
        range: 160, aura: { rangeBonus: 0.18, damageBonus: 0.15, reveal: true, light: 1.2 }, beam: { slow: 0.25, vuln: 0.2 } },
    ],
  },
};

export const TOWER_LIST = Object.values(TOWERS);
export const SPEC_LIST = TOWER_LIST.flatMap((t) => t.specs.map((s) => ({ ...s, towerId: t.id })));
export const SPEC_BY_ID = Object.fromEntries(SPEC_LIST.map((s) => [s.id, s]));

// Which tower answers an enemy (its voyage counter weapon → the tower).
export const TOWER_FOR_WEAPON = Object.freeze(Object.fromEntries(TOWER_LIST.filter((t) => t.weapon).map((t) => [t.weapon, t.id])));

export function getTower(id) {
  const t = TOWERS[id];
  if (!t) throw new Error(`Unknown tower id: ${id}`);
  return t;
}

// Stats a tower has right now: its level (1-3) or its specialisation.
export function towerStats(tower) {
  const def = getTower(tower.towerId);
  if (tower.spec) return { ...def.levels[2], ...def.specs.find((s) => s.id === tower.spec) };
  return def.levels[tower.level - 1];
}

// ---- Tower Yard (harbour building): permanent unlocks, paid in Salvage.
// Cannon Battery and Grapeshot Nest are yours from the start.
export const TOWER_UNLOCKS = Object.freeze({
  cannon: 0, grapeshot: 0, chain: 60, depth: 90, flame: 120, lighthouse: 140,
});
export const STARTING_TOWERS = Object.freeze(['cannon', 'grapeshot']);
// A specialisation costs Salvage to learn (and gold to build in a map).
export const SPEC_UNLOCKS = Object.freeze({
  long_nines: 120, carronade: 120, canister: 130, swivel_battery: 150,
  bola_mast: 140, harpoon_ballista: 170, mine_layer: 160, heavy_charges: 170,
  greek_fire: 160, dragons_breath: 190, beacon_of_fortune: 140, blinding_lamp: 180,
});

// Reef works: permanent perks for every defence.
export const TD_PERKS = [
  { id: 'war_chest', name: 'War Chest', blurb: 'Start every defence with +50 gold.', cost: 80, startGold: 50 },
  { id: 'coral_bulwark', name: 'Coral Bulwark', blurb: 'The Heart of the Reef can take 5 more hits.', cost: 110, lives: 5 },
  { id: 'salvage_crews', name: 'Salvage Crews', blurb: 'Selling a tower refunds 85% instead of 70%.', cost: 70, sellRefund: 0.85 },
  { id: 'early_bells', name: 'Early Bells', blurb: 'Calling a wave early pays +50% more gold.', cost: 90, earlyBonus: 0.5 },
  { id: 'master_gunners', name: 'Master Gunners', blurb: 'Every tower deals +10% damage.', cost: 200, scales: 1, damageBonus: 0.1 },
  { id: 'lookouts', name: 'Lookouts', blurb: 'Every tower has +8% range.', cost: 160, scales: 1, rangeBonus: 0.08 },
];
export const TD_PERK_BY_ID = Object.fromEntries(TD_PERKS.map((p) => [p.id, p]));
