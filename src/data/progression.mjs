// Reasons to come back (2026-10-04, project owner: "how else to improve the
// gameplay and make people want to pick it up" → "do all now"). Data only;
// engine/progression.mjs holds the rules.
//
//   POOL_UNLOCKS  weapons and armaments join the level-up pool as you clear
//                 levels, so there's always something new on the horizon
//   LIVERIES      sail, trim and flag colours for your ship
//   DAILY_MODS    the daily voyage's twist
//   CONTRACTS     rotating goals with Salvage rewards
//   ACHIEVEMENTS  milestones, each with a reward
//   BESTIARY      every enemy you sink is recorded; a full stage set pays out

import { WEAPON_IDS as W } from './weapons.mjs';

// Levels cleared (all stages together) before each joins the level-up pool.
// Missing ids are always in the pool. Cargo Loadouts, factions and Armory
// fittings still start you with their weapons whatever this says.
export const POOL_UNLOCKS = Object.freeze({
  [W.DEPTH_CHARGES]: 2,
  mortar: 3,
  [W.FLAME_BARRELS]: 4,
  stern_chaser: 6,
  broadside: 8,
  sea_spirit: 10,
  st_elmos_fire: 13,
});

// `cost` in Salvage, or `from` an achievement id. `sail`/`trim`/`flag` are
// colours; null keeps the hull's own.
export const LIVERIES = [
  { id: 'classic', name: 'Shipwright\'s Own', desc: 'Each hull\'s own colours', sail: null, trim: null, flag: null, cost: 0 },
  { id: 'crimson', name: 'Crimson Corsair', desc: 'Blood-red sails, black trim', sail: '#b8322a', trim: '#1a1214', flag: '#1a1214', cost: 150 },
  { id: 'midnight', name: 'Midnight Run', desc: 'Night-blue sails with silver', sail: '#22324f', trim: '#c9d4dc', flag: '#c9d4dc', cost: 200 },
  { id: 'reef', name: 'Reef Runner', desc: 'Sea-green and sand', sail: '#3aa58f', trim: '#f1e2b8', flag: '#f1e2b8', cost: 200 },
  { id: 'royal', name: 'Royal Navy', desc: 'Ivory sails, blue and gold', sail: '#f4ecd8', trim: '#1f4e8c', flag: '#e8b54b', cost: 300 },
  { id: 'jolly', name: 'Jolly Roger', desc: 'Black sails. You know the flag.', sail: '#1c1a1a', trim: '#e9e2d0', flag: '#111111', from: 'warlord_slayer' },
  { id: 'kraken', name: 'Kraken\'s Due', desc: 'Deep violet, inked tentacle trim', sail: '#4a2a6a', trim: '#b88cff', flag: '#b88cff', from: 'bestiary_half' },
  { id: 'gilded', name: 'Gilded Fleet', desc: 'Cloth of gold', sail: '#e8b54b', trim: '#7a4a08', flag: '#fff3c0', from: 'master_shipwright' },
  { id: 'ghost', name: 'Ghost Ship', desc: 'Pale spectral sails', sail: '#bfe9e4', trim: '#5fb8aa', flag: '#5fb8aa', from: 'untouchable' },
];
export const LIVERY_BY_ID = Object.fromEntries(LIVERIES.map((l) => [l.id, l]));

// The daily voyage's twist: effects read by engine/survivalRun.mjs.
export const DAILY_MODS = [
  { id: 'fortune', name: 'Fortune Tide', icon: '💰', desc: 'Double Salvage', fx: { salvageMult: 2 } },
  { id: 'glass', name: 'Glass Cannon', icon: '🔪', desc: '+50% damage dealt and taken', fx: { damageDealt: 1.5, damageTaken: 1.5 } },
  { id: 'swarm', name: 'Swarm Season', icon: '🐟', desc: '+40% enemies, +30% sea glass', fx: { countMult: 1.4, xpMult: 1.3 } },
  { id: 'fast', name: 'Fast Water', icon: '🌊', desc: 'Enemies 20% faster; dash recharges twice as fast', fx: { enemySpeed: 1.2, dashMult: 0.5 } },
  { id: 'iron', name: 'Iron Hulls', icon: '🛡️', desc: 'Take 30% less damage, deal 20% less', fx: { damageTaken: 0.7, damageDealt: 0.8 } },
  { id: 'scholar', name: 'Scholar\'s Sea', icon: '📜', desc: '+60% sea glass, but no Salvage coins', fx: { xpMult: 1.6, salvageMult: 0 } },
];
export const DAILY_MOD_BY_ID = Object.fromEntries(DAILY_MODS.map((m) => [m.id, m]));
export const DAILY_REWARD = { base: 60, perStage: 20, streakBonus: 15, streakCap: 7 };

// Contract templates. `stat` names a run tally (engine/progression.mjs
// runTally); `max` contracts take the best single level, the rest add up.
// Target and reward scale with `tier` (0-2).
export const CONTRACTS = [
  { id: 'sink', text: 'Sink {n} enemies', stat: 'kills', targets: [300, 800, 2000], reward: [60, 120, 220] },
  { id: 'elites', text: 'Sink {n} elites', stat: 'elites', targets: [3, 8, 15], reward: [60, 120, 200] },
  { id: 'lords', text: 'Sink {n} warlords or bosses', one: 'Sink a warlord or boss', stat: 'lords', targets: [1, 3, 6], reward: [70, 140, 240] },
  { id: 'levels', text: 'Clear {n} levels', one: 'Clear a level', stat: 'levels', targets: [1, 3, 6], reward: [60, 130, 230] },
  { id: 'chests', text: 'Open {n} treasure chests', stat: 'chests', targets: [3, 8, 15], reward: [50, 110, 190] },
  { id: 'evolve', text: 'Evolve {n} weapons', one: 'Evolve a weapon', stat: 'evolutions', targets: [1, 3, 6], reward: [70, 140, 240] },
  { id: 'dash', text: 'Dash {n} times', stat: 'dashes', targets: [30, 80, 200], reward: [40, 90, 160] },
  { id: 'shiplevel', text: 'Reach ship level {n} in one level', stat: 'shipLevel', max: true, targets: [12, 18, 24], reward: [60, 120, 200] },
  { id: 'combo', text: 'Sail with {n} weapon combos active in one level', one: 'Sail with a weapon combo active', stat: 'combos', max: true, targets: [1, 2, 3], reward: [60, 120, 200] },
  { id: 'salvage', text: 'Bank {n} Salvage', stat: 'salvage', targets: [150, 400, 900], reward: [50, 100, 180] },
];
export const CONTRACT_BY_ID = Object.fromEntries(CONTRACTS.map((c) => [c.id, c]));
export const CONTRACT_SLOTS = 3;

// `test(meta)` reads lifetime state after a level is recorded. Rewards are
// Salvage, Kraken Scales and/or a livery.
export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', icon: '⚔️', desc: 'Sink 100 enemies', test: (m) => m.life.kills >= 100, reward: { salvage: 40 } },
  { id: 'scourge', name: 'Scourge of the Seas', icon: '☠️', desc: 'Sink 2,500 enemies', test: (m) => m.life.kills >= 2500, reward: { salvage: 200 } },
  { id: 'legend', name: 'Living Legend', icon: '🏴‍☠️', desc: 'Sink 20,000 enemies', test: (m) => m.life.kills >= 20000, reward: { salvage: 800, scales: 2 } },
  { id: 'first_clear', name: 'Fair Winds', icon: '⛵', desc: 'Clear a level', test: (m) => m.life.levels >= 1, reward: { salvage: 40 } },
  { id: 'stage_clear', name: 'Conqueror', icon: '🏁', desc: 'Clear a whole stage', test: (m) => m.highestStageUnlocked >= 2, reward: { salvage: 150 } },
  { id: 'stage_5', name: 'Into the Fire', icon: '🌋', desc: 'Reach stage 5', test: (m) => m.highestStageUnlocked >= 5, reward: { salvage: 300 } },
  { id: 'all_stages', name: 'Master of the Reef', icon: '👑', desc: 'Clear all ten stages', test: (m) => m.highestStageUnlocked >= 11, reward: { salvage: 1000, scales: 3 } },
  { id: 'first_evolve', name: 'Something Bigger', icon: '✦', desc: 'Evolve a weapon', test: (m) => m.life.evolutions >= 1, reward: { salvage: 50 } },
  { id: 'triple_evolve', name: 'Full Fury', icon: '🔱', desc: 'Evolve three weapons in one level', test: (m) => m.life.bestEvolutions >= 3, reward: { salvage: 200 } },
  { id: 'master_shipwright', name: 'Master Shipwright', icon: '🛠️', desc: 'Evolve every weapon at least once', test: (m) => Object.keys(m.life.evolvedWeapons).length >= 5, reward: { salvage: 300, livery: 'gilded' } },
  { id: 'combo_all', name: 'Combo Captain', icon: '🔗', desc: 'Sail with every weapon combo at least once', test: (m) => Object.keys(m.life.combos).length >= 5, reward: { salvage: 250 } },
  { id: 'level_30', name: 'Seasoned', icon: '🎖️', desc: 'Reach ship level 30 in one level', test: (m) => m.life.bestShipLevel >= 30, reward: { salvage: 200 } },
  { id: 'dashing', name: 'Dashing', icon: '⚡', desc: 'Dash 250 times', test: (m) => m.life.dashes >= 250, reward: { salvage: 100 } },
  { id: 'warlord_slayer', name: 'Warlord Slayer', icon: '🗡️', desc: 'Sink 10 warlords or bosses', test: (m) => m.life.lords >= 10, reward: { salvage: 200, livery: 'jolly' } },
  { id: 'treasure', name: 'Treasure Hunter', icon: '💎', desc: 'Open 50 treasure chests', test: (m) => m.life.chests >= 50, reward: { salvage: 150 } },
  { id: 'untouchable', name: 'Untouchable', icon: '👻', desc: 'Clear a level losing less than 10% of your hull', test: (m) => m.life.cleanClears >= 1, reward: { salvage: 250, livery: 'ghost' } },
  { id: 'daily_3', name: 'Regular', icon: '📅', desc: 'Clear 3 daily voyages', test: (m) => m.daily.cleared >= 3, reward: { salvage: 120 } },
  { id: 'daily_streak', name: 'Never Miss a Tide', icon: '🔥', desc: 'Clear the daily voyage 7 days running', test: (m) => m.daily.bestStreak >= 7, reward: { salvage: 400, scales: 1 } },
  { id: 'contracts_10', name: 'Contractor', icon: '📜', desc: 'Complete 10 contracts', test: (m) => m.contractsDone >= 10, reward: { salvage: 200 } },
  { id: 'bestiary_half', name: 'Naturalist', icon: '📖', desc: 'Record half the bestiary', test: (m, ctx) => ctx.bestiaryFrac >= 0.5, reward: { salvage: 200, livery: 'kraken' } },
  { id: 'bestiary_all', name: 'Complete Bestiary', icon: '🐙', desc: 'Record every creature and ship', test: (m, ctx) => ctx.bestiaryFrac >= 1, reward: { salvage: 600, scales: 2 } },
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Salvage for completing a stage's bestiary set (every enemy, horde and
// boss of that stage recorded), × the stage number.
export const BESTIARY_SET_REWARD = 60;
