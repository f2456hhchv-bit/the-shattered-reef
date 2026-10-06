// Survival mode content (2026-10-04, project owner: "Survivor.io gameplay
// structure, but unmistakably The Shattered Reef"). Data only — the rules
// that read it live in engine/survival.mjs.
//
// A level is 10 timed waves on an open arena (engine/arena.mjs). Kills
// drop sea-glass XP; each ship level offers three cards: a new weapon, a
// weapon level, or a ship upgrade. The five Shattered Reef weapons are
// the core kit — each fires on its own, levels 1-5, and evolves when
// maxed alongside its partner upgrade. The eight armaments join the same
// pool. Counters still matter: every weapon picks out the enemies it
// counters first and hits them for COUNTER_BONUS.

import { WEAPON_IDS as W } from './weapons.mjs';
import { BIOME_IDS as B } from './biomes.mjs';
import { HORDE_IDS as H } from './enemies.mjs';

export const SURVIVAL = Object.freeze({
  waves: 10,
  waveSeconds: 30,
  maxWeapons: 5, // core weapons + armaments together (project owner: 5 + 5)
  maxPassives: 5,
  maxEvolutions: 3, // once three weapons evolve, the rest can't
  enemyDamage: 1.05, // owner 2026-10-04: a bit easy
  counterBonus: 1.75, // damage vs. the enemies a weapon counters
  spawnMargin: 70, // px beyond the screen edge enemies appear
  recycleBeyond: 1.7, // × spawn distance: further than this, a straggler is moved back in
  pickupRadius: 46, // px: gems and coins within this start flying to you
  bossHp: 6, // × a stage boss's voyage hull (it has a whole build to face)
  warlordHp: 14, // × the toughest enemy in the level's pool
  eliteHp: 4.5,
  levelClearSalvage: [24, 8], // base + per level index, × stage multiplier
  sinkKeepsSalvage: 0.5, // fraction of the level's Salvage kept when you sink
  choices: 3,
  // The crowd (owner playtest 2026-10-06: ×4 enemies and ×4 spawn speed
  // "felt good" and ran smoothly on the phone). Reached by wave 4; the
  // first waves build up to it so a fresh build isn't swamped at once.
  // Full crowd per stage: a fresh captain on stage 1 meets ×2, and it
  // reaches the owner's ×4 by stage 4 (stage 5+ stays at ×4).
  crowdByStage: [2, 2.75, 3.5, 4],
  crowdRampWaves: 4,
  // Four times the kills would mean four times the XP, so later ship
  // levels need up to this much more (the first few stay quick, so the
  // opening build comes together before the crowd peaks).
  xpPerCrowd: 0.7, // later levels need up to crowd × this much more XP
});

// How much of the full crowd a wave gets (0-based wave index).
export function crowdRamp(waveIndex) {
  return Math.min(1, waveIndex / SURVIVAL.crowdRampWaves);
}
export function stageCrowd(stage) {
  const t = SURVIVAL.crowdByStage;
  return t[Math.min(t.length, Math.max(1, stage)) - 1];
}
// Enemies afloat and spawn speed both scale by the crowd.
export function crowdMult(waveIndex, stage = 1) {
  return 1 + (stageCrowd(stage) - 1) * crowdRamp(waveIndex);
}
export const spawnPaceMult = crowdMult;
// Horde coins thin out as the crowd grows (by its square root: the owner
// asked for rewards scaled down, not held flat).
export function hordeCoinChance(stage = 1) {
  return LOOT.hordeCoin / Math.sqrt(stageCrowd(stage));
}

// The dash (2026-10-04): a short burst of speed you can't be hurt during.
// Swift Sails also shortens its cooldown.
export const DASH = Object.freeze({ speed: 390, time: 0.2, iframes: 0.34, cooldown: 3.6, minCooldown: 1.6 });

// XP to reach the next ship level from `lv` (1-based).
export function xpToNext(lv, stage = 1) {
  const scale = Math.max(1, Math.min(stageCrowd(stage) * SURVIVAL.xpPerCrowd, 1 + (lv - 1) * 0.3));
  return Math.round((5 + 3.4 * (lv - 1) + Math.pow(lv - 1, 1.55)) * scale);
}

// Sea glass: XP gems by value. Many small gems merge into bigger ones
// when there are too many on the water.
export const GEMS = Object.freeze([
  { value: 1, color: '#6fd3ff', glow: '#bff0ff' },
  { value: 5, color: '#5fe08a', glow: '#c8ffd8' },
  { value: 25, color: '#c77dff', glow: '#f0d6ff' },
]);
export const GEM_CAP = 220;

// -- The core kit ------------------------------------------------------------
// Each level is the full stat line at that level. `desc` says what the
// level adds (shown on its card). `evolve` names the partner upgrade.
export const SV_WEAPONS = {
  [W.CANNONBALLS]: {
    id: W.CANNONBALLS, name: 'Cannonballs', icon: '⚫', kind: 'cannon',
    blurb: 'Fires at the nearest enemies.',
    levels: [
      { damage: 14, cooldown: 0.75, count: 1, pierce: 0, speed: 360, range: 260, desc: 'A cannon that fires at the nearest enemy' },
      { damage: 14, cooldown: 0.7, count: 2, pierce: 0, speed: 360, range: 260, desc: '+1 cannonball per volley' },
      { damage: 19, cooldown: 0.65, count: 2, pierce: 0, speed: 370, range: 270, desc: '+35% damage, faster reload' },
      { damage: 19, cooldown: 0.6, count: 3, pierce: 1, speed: 380, range: 280, desc: '+1 cannonball; shots pass through one enemy' },
      { damage: 25, cooldown: 0.55, count: 4, pierce: 1, speed: 390, range: 290, desc: '+1 cannonball, +30% damage' },
    ],
    evolve: {
      with: 'gun_crew', id: 'ship_of_the_line', name: 'Ship of the Line', icon: '🎇',
      desc: 'Six heavy balls a volley that smash through three enemies each',
      stats: { damage: 32, cooldown: 0.45, count: 6, pierce: 3, speed: 430, range: 310, radius: 4.6 },
    },
  },
  [W.CHAIN_SHOT]: {
    id: W.CHAIN_SHOT, name: 'Chain Shot', icon: '⛓️', kind: 'chain',
    blurb: 'Spinning bolas that scythe through a line of enemies. Brings down flyers.',
    levels: [
      { damage: 12, cooldown: 1.2, count: 1, pierce: 3, speed: 300, range: 280, desc: 'Spinning bolas that cut through 4 enemies' },
      { damage: 12, cooldown: 1.1, count: 2, pierce: 3, speed: 300, range: 280, desc: '+1 bolas per throw' },
      { damage: 16, cooldown: 1.0, count: 2, pierce: 4, speed: 310, range: 290, desc: '+33% damage, cuts one more' },
      { damage: 16, cooldown: 0.9, count: 3, pierce: 5, speed: 320, range: 300, desc: '+1 bolas, cuts one more' },
      { damage: 21, cooldown: 0.8, count: 3, pierce: 6, speed: 330, range: 310, desc: '+30% damage, faster throws' },
    ],
    evolve: {
      with: 'rudder', id: 'reaper_chains', name: 'Reaper Chains', icon: '⚔️',
      desc: 'Three chain-blades whirl round your ship, and the bolas keep flying',
      stats: { damage: 21, cooldown: 0.75, count: 3, pierce: 7, speed: 340, range: 320, orbit: { count: 3, radius: 54, damage: 18, spin: 3.4, every: 0.35 } },
    },
  },
  [W.GRAPESHOT]: {
    id: W.GRAPESHOT, name: 'Grapeshot', icon: '💥', kind: 'grape',
    blurb: 'A close-range blast of shot that shreds packs.',
    levels: [
      { damage: 7, cooldown: 1.0, count: 6, spread: 0.6, speed: 380, range: 150, desc: 'A spray of shot at anything close' },
      { damage: 7, cooldown: 0.9, count: 8, spread: 0.65, speed: 380, range: 150, desc: '+2 pellets' },
      { damage: 9, cooldown: 0.85, count: 9, spread: 0.7, speed: 390, range: 160, desc: '+30% damage, +1 pellet' },
      { damage: 9, cooldown: 0.75, count: 11, spread: 0.75, speed: 400, range: 165, desc: '+2 pellets, faster reload' },
      { damage: 11, cooldown: 0.65, count: 13, spread: 0.8, speed: 410, range: 175, desc: '+2 pellets, +20% damage' },
    ],
    evolve: {
      with: 'powder', id: 'hailstorm', name: 'Hailstorm', icon: '🌨️',
      desc: 'A ring of shot in every direction, all the time',
      stats: { damage: 12, cooldown: 0.65, count: 26, spread: Math.PI * 2, speed: 420, range: 195, ring: true },
    },
  },
  [W.DEPTH_CHARGES]: {
    id: W.DEPTH_CHARGES, name: 'Depth Charges', icon: '💣', kind: 'depth',
    blurb: 'Lobbed charges that blow up under crowds. The only weapon that hits what hides underwater.',
    levels: [
      { damage: 26, cooldown: 2.4, count: 1, blast: 42, speed: 220, range: 230, desc: 'Lobs a charge that blasts a crowd, even underwater' },
      { damage: 26, cooldown: 2.2, count: 2, blast: 44, speed: 220, range: 230, desc: '+1 charge' },
      { damage: 34, cooldown: 2.0, count: 2, blast: 48, speed: 230, range: 240, desc: '+30% damage, bigger blasts' },
      { damage: 34, cooldown: 1.8, count: 3, blast: 52, speed: 240, range: 250, desc: '+1 charge' },
      { damage: 44, cooldown: 1.6, count: 3, blast: 58, speed: 250, range: 260, desc: '+30% damage, bigger blasts' },
    ],
    evolve: {
      with: 'heavy_shot', id: 'krakens_wrath', name: "Kraken's Wrath", icon: '🐙',
      desc: 'Every charge goes off twice — the second blast is huge',
      stats: { damage: 46, cooldown: 1.5, count: 3, blast: 60, speed: 260, range: 270, aftershock: { blast: 92, damage: 40, delay: 0.35 } },
    },
  },
  [W.FLAME_BARRELS]: {
    id: W.FLAME_BARRELS, name: 'Flame Barrels', icon: '🔥', kind: 'flame',
    blurb: 'Barrels that burst into burning pools on the water. Ships can\'t outrun the fire.',
    levels: [
      { damage: 8, cooldown: 2.8, count: 1, pool: 34, burn: 6, every: 0.4, duration: 3.0, speed: 200, range: 220, desc: 'Tosses a barrel that leaves a pool of fire' },
      { damage: 8, cooldown: 2.6, count: 1, pool: 38, burn: 7, every: 0.4, duration: 3.2, speed: 200, range: 220, desc: 'Bigger, hotter fire' },
      { damage: 10, cooldown: 2.5, count: 2, pool: 40, burn: 7, every: 0.4, duration: 3.2, speed: 210, range: 230, desc: '+1 barrel' },
      { damage: 10, cooldown: 2.3, count: 2, pool: 44, burn: 9, every: 0.4, duration: 3.6, speed: 220, range: 240, desc: 'Fire burns longer and hotter' },
      { damage: 12, cooldown: 2.1, count: 3, pool: 48, burn: 11, every: 0.4, duration: 3.8, speed: 230, range: 250, desc: '+1 barrel, hotter fire' },
    ],
    evolve: {
      with: 'sails', id: 'greek_fire', name: 'Greek Fire', icon: '☄️',
      desc: 'Your wake burns: a trail of fire behind you, and bigger barrels',
      stats: { damage: 14, cooldown: 2.0, count: 3, pool: 54, burn: 12, every: 0.35, duration: 4, speed: 240, range: 260, trail: { every: 0.3, pool: 26, duration: 2.4, burn: 9 } },
    },
  },
};
export const SV_WEAPON_IDS = Object.keys(SV_WEAPONS);

// Weapon combos (2026-10-04): carry both weapons (any level) and the pair
// does something neither does alone. Level-up cards name the combo a pick
// would complete. engine/survival.mjs applySynergies runs them.
export const SYNERGIES = [
  { id: 'burning_shrapnel', name: 'Burning Shrapnel', icon: '🔥', needs: [W.GRAPESHOT, W.FLAME_BARRELS], desc: 'Grapeshot pellets set what they hit alight' },
  { id: 'undertow', name: 'Undertow', icon: '🌀', needs: [W.CHAIN_SHOT, W.DEPTH_CHARGES], desc: 'Depth-charge blasts drag nearby enemies into a clump' },
  { id: 'heated_shot', name: 'Heated Shot', icon: '♨️', needs: [W.CANNONBALLS, W.FLAME_BARRELS], desc: 'Cannonball kills burst into a pool of fire' },
  { id: 'rigging_shredder', name: 'Rigging Shredder', icon: '🪝', needs: [W.CHAIN_SHOT, W.GRAPESHOT], desc: 'Chain Shot slows what it hits by 40%' },
  { id: 'shock_shells', name: 'Shock Shells', icon: '💫', needs: [W.CANNONBALLS, W.DEPTH_CHARGES], desc: 'Cannonballs knock enemies back' },
];
export const SYNERGY_BY_ID = Object.fromEntries(SYNERGIES.map((x) => [x.id, x]));
export const SV_WEAPON_MAX = 5;

// -- Ship upgrades (passives) -------------------------------------------------
// `per` is the effect of one level; engine/survival.mjs sums them.
export const PASSIVES = [
  { id: 'gun_crew', name: 'Gun Crew', icon: '⏱️', desc: 'Every weapon reloads 8% faster', per: { cooldown: -0.08 } },
  { id: 'heavy_shot', name: 'Heavy Shot', icon: '🎯', desc: '+10% damage for every weapon', per: { damage: 0.1 } },
  { id: 'armour', name: 'Armour Plating', icon: '🛡️', desc: 'Take 7% less damage', per: { resist: 0.07 } },
  { id: 'hull', name: 'Reinforced Hull', icon: '🪵', desc: '+20 max hull, and patch 20 now', per: { maxHull: 20 } },
  { id: 'sails', name: 'Swift Sails', icon: '⛵', desc: '+7% speed, and dash 8% sooner', per: { speed: 0.07, dash: -0.08 } },
  { id: 'rudder', name: 'Fine Rigging', icon: '🪢', desc: 'Turn 12% faster', per: { turn: 0.12 } },
  { id: 'lodestone', name: 'Lodestone', icon: '🧲', desc: 'Pull in sea glass and coins from 30% further', per: { pickup: 0.3 } },
  { id: 'plunder', name: 'Plunderer', icon: '💰', desc: '+15% Salvage from coins and chests', per: { salvage: 0.15 } },
  { id: 'powder', name: 'Fine Powder', icon: '💨', desc: 'Shots fly 10% faster', per: { projSpeed: 0.1 } },
  { id: 'spyglass', name: 'Spyglass', icon: '🔭', desc: 'Every weapon reaches 10% further', per: { range: 0.1 } },
  { id: 'bilge', name: 'Bilge Pumps', icon: '🔧', desc: 'Repair 0.4 hull a second', per: { regen: 0.4 } },
  { id: 'ram', name: 'Iron Ram', icon: '🐏', desc: 'Ramming deals 15 damage; take 8% less from bumps and bites', per: { ram: 15, contact: -0.08 } },
];
export const PASSIVE_BY_ID = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
export const PASSIVE_MAX = 5;

// -- Waves --------------------------------------------------------------------
// Per wave: seconds between spawns, enemies per spawn, the cap on enemies
// alive, and the share of each spawn that's a stage specialist (the rest
// is the biome's horde). `event` adds a set piece at the wave's start.
// From FINAL_STRETCH on, the sky darkens, the music turns and `hunters`
// (seconds) sends an elite at you on a timer.
export const FINAL_STRETCH = 7;
export const WAVES = [
  { every: 1.4, batch: 2, alive: 16, special: 0.0 },
  { every: 1.15, batch: 2, alive: 22, special: 0.1 },
  { every: 1.0, batch: 3, alive: 28, special: 0.14, event: 'encircle' },
  { every: 0.95, batch: 3, alive: 34, special: 0.18 },
  { every: 0.9, batch: 3, alive: 38, special: 0.2, event: 'elite' },
  { every: 0.8, batch: 4, alive: 44, special: 0.24 },
  { every: 0.72, batch: 4, alive: 50, special: 0.28, event: 'encircle' },
  { every: 0.66, batch: 4, alive: 56, special: 0.3, event: 'elite2', hunters: 20 },
  { every: 0.6, batch: 5, alive: 62, special: 0.34, hunters: 18 },
  { every: 0.85, batch: 4, alive: 48, special: 0.3, event: 'boss' }, // until the warlord/boss sinks
];

// How a level and a stage push the waves (kept gentle on purpose: more,
// faster and more varied, barely tougher).
export function waveScaling(stage, levelIndex, waveIndex) {
  const L = levelIndex; const S = Math.max(1, stage) - 1;
  // Every level starts from a fresh build, so a later level's opening
  // waves stay close to level 1's; the extra pressure builds as it goes.
  const ramp = 0.3 + 0.7 * Math.min(1, waveIndex / 8);
  return {
    count: (1 + 0.14 * L * ramp) * (1 + 0.05 * Math.min(S, 10) * ramp),
    rate: 1 + (0.08 * L + 0.03 * Math.min(S, 10)) * ramp,
    health: 1 + 0.035 * waveIndex + 0.04 * L,
    speed: 1 + 0.025 * L + 0.01 * waveIndex,
  };
}

// The horde: one cheap chaser per biome (data/enemies.mjs HORDE_IDS).
export const HORDE_FOR_BIOME = Object.freeze({
  [B.TROPICAL]: H.RAIDER_LONGBOAT,
  [B.CLIFF_COVE]: H.SKIMMER_RAIDER,
  [B.GLACIAL]: H.ICE_SKIFF,
  [B.SHIPWRECK]: H.DROWNED_ROWER,
  [B.VOLCANIC]: H.EMBER_IMP,
  [B.CAVERNS]: H.CAVE_BAT,
  [B.MANGROVE]: H.BOG_LEECH,
  [B.ABYSS]: H.DRIFT_JELLY,
  [B.BONE_SANDS]: H.SAND_SKIFF,
  [B.CRYSTAL]: H.SHARD_CRAB,
});

// Loot odds (per kill).
export const LOOT = Object.freeze({
  hordeCoin: 0.07, // a 1-Salvage coin, before dividing by the crowd (hordeCoinChance)
  specialCoin: 0.5, // a coin worth a third of the enemy's salvage drop
  repair: 0.012, // a life ring
  magnet: 0.004, // a lodestone: pulls in every gem on the water
});
