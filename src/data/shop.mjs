// Shop depth and pacing (2026-10-22, project owner: "Think about what can
// be bought in the shop to improve hulls, weaponry, 'skins'..." and
// "you shouldn't be able to unlock everything in a full day's game play.
// Some QoL upgrades early on but the true end game ones are grinders").
//
// THE CURVE. Income is about 250-400 Salvage a level (~3,500 an hour, see
// tools/economy.mjs). So:
//   - quality-of-life buys cost one or two levels' haul
//   - the mid game is a few hundred to a couple of thousand, and some of it
//     waits on how far you've sailed (`requires`: highest stage reached)
//   - the end game is LEVELLED tracks with costs that grow ×1.5-1.9 a level,
//     capped by stage progress, the top levels also costing Kraken Scales.
// Everything together is ~75 hours of Salvage, and a player maxing one
// favourite ship still has ~35 hours of goals.

// --- Ships with personality ------------------------------------------------
// Every hull is a named ship with a figurehead and a temper. Shown in the
// Shipyard; the figurehead is drawn art when it arrives (art batch Y).
export const SHIP_PERSONA = {
  sloop: { shipName: 'The Little Wren', figurehead: 'a carved wren, wings back', temper: 'Your grandfather\'s first ship. Small, patched, and stubborn as a barnacle.' },
  longboat: { shipName: 'Old Thunder', figurehead: 'a roaring dragon', temper: 'Forty oars and a drum. Doesn\'t turn so much as decide to face elsewhere.' },
  skiff: { shipName: 'Skipjack', figurehead: 'a leaping fish', temper: 'Light, quick and a little rude. Skims over the waves like it owes them money.' },
  catamaran: { shipName: 'Twin Tails', figurehead: 'two otters holding paws', temper: 'Two hulls that never agree, and somehow the fastest thing on the water.' },
  junk: { shipName: 'Lucky Lantern', figurehead: 'a painted eye on each bow', temper: 'Sees everything coming. Hold full of fireworks. Bad luck to anyone downwind.' },
  steamer: { shipName: 'Iron Nell', figurehead: 'a brass bulldog', temper: 'Coal, rivets and grumbling pistons. Built by the Iron Accord, stolen by Cinder.' },
  galleon: { shipName: 'The Grand Duchess', figurehead: 'a crowned mermaid', temper: 'Three masts, forty guns and a very high opinion of herself. Deserved.' },
};

// --- Level-cost helper -----------------------------------------------------
export function levelCost(base, growth, level) {
  return Math.round((base * Math.pow(growth, level - 1)) / 5) * 5;
}

// --- Shipyard refits: per hull, three tracks of 10 levels -----------------
// Each level: plating +8 max hull, rigging +3% speed and turning, gun deck
// +5% damage for every gun. You can refit up to 2 levels, plus 2 for every
// stage you've cleared. Levels 8-10 also take Kraken Scales.
export const REFIT_TRACKS = [
  { id: 'plating', name: 'Plating', icon: '🛡️', per: 'max hull +8', fx: { hull: 8 } },
  { id: 'rigging', name: 'Rigging', icon: '⛵', per: 'speed and turning +3%', fx: { speed: 0.03, turn: 0.03 } },
  { id: 'guns', name: 'Gun deck', icon: '💥', per: 'damage +5%', fx: { damage: 0.05 } },
];
export const REFIT_MAX = 10;
export function refitCost(level) { return levelCost(40, 1.6, level); }
export function refitScales(level) { return level >= 8 ? level - 7 : 0; }
export function refitCap(stagesCleared) { return Math.min(REFIT_MAX, 2 + 2 * stagesCleared); }

// --- Gunsmith: weapon mastery, 10 levels per core weapon --------------------
// +6% damage a level; at 5 a faster reload (−8%); at 10 one more shot per
// volley. Cap 2 + 2 per stage cleared; levels 8-10 also take Scales.
export const MASTERY_MAX = 10;
export const MASTERY_PER = 0.06;
export function masteryCost(level) { return levelCost(60, 1.55, level); }
export function masteryScales(level) { return level >= 8 ? level - 6 : 0; }
export function masteryCap(stagesCleared) { return Math.min(MASTERY_MAX, 2 + 2 * stagesCleared); }

// --- Keysmith: each key levels 1-5 ---------------------------------------
// +15% power and −6% charge needed a level; levels 4 and 5 take Scales.
export const KEY_PER_POWER = 0.15;
export const KEY_PER_CHARGE = 0.06;
export function keyCost(level) { return levelCost(150, 1.9, level - 1); } // buying `level` (2-5)
export function keyScales(level) { return level >= 4 ? level - 3 : 0; }

// --- Crew quarters: a third berth -----------------------------------------
export const CREW_QUARTERS = { cost: 6000, scales: 5, requires: 5 };

// --- Wakes (cosmetic): the trail behind your ship --------------------------
// Pure look, no stats: something for collectors to grind.
export const WAKES = [
  { id: 'foam', name: 'Sea Foam', cost: 0, desc: 'Plain white water.', colours: ['#ffffff', '#d8f4ff'] },
  { id: 'bubbles', name: 'Bubble Trail', cost: 600, desc: 'A fizz of bubbles that pop as you pass.', colours: ['#bfeaff', '#ffffff'], bubbles: true },
  { id: 'gold', name: 'Golden Wake', cost: 1500, requires: 2, desc: 'Every ship you pass will know you\'re rich.', colours: ['#ffd65c', '#fff2b8'], sparkle: true },
  { id: 'ember', name: 'Ember Wake', cost: 3000, requires: 5, desc: 'Cinder\'s idea. The sea steams behind you.', colours: ['#ff7a2e', '#ffd166'], sparkle: true },
  { id: 'ghost', name: 'Ghostlight', cost: 3000, requires: 4, desc: 'Hollis insists. Pale lights follow the stern.', colours: ['#9fe3d0', '#e8fffa'], sparkle: true },
  { id: 'abyss', name: 'Abyssal Ink', cost: 6000, requires: 8, desc: 'A trail of ink and drifting glow.', colours: ['#3b4fc4', '#a6b4ff'], bubbles: true },
  { id: 'rainbow', name: 'Prism Wake', cost: 15000, requires: 10, desc: 'All ten keys\' colours. The grind of a lifetime.', colours: ['#ff5d5d', '#ffd65c', '#5dff9a', '#5dc8ff', '#b48cf0'], sparkle: true },
];
export const WAKE_BY_ID = Object.fromEntries(WAKES.map((w) => [w.id, w]));

// --- One-off prices on the curve (applied over data/meta.mjs) --------------
// [cost, requires stage]. QoL first, then the mid game, then end game.
export const PRICES = {
  hulls: { longboat: [250, 1], skiff: [350, 1], catamaran: [1200, 2], junk: [1800, 3], steamer: [2600, 4], galleon: [5000, 6] },
  cargo: {
    forward_magazine: [60, 1], chain_locker: [450, 1], grape_racks: [450, 1], deep_stores: [800, 2], pitch_hold: [800, 2],
    swivel_mount: [700, 2], harpoon_rack: [1100, 3], keg_hold: [1100, 3], mortar_bed: [1600, 4], spirit_lantern: [2400, 5],
  },
  charms: {
    first_haul: [60, 1], sea_legs: [80, 1], menders_knot: [150, 1], steady_hands: [400, 1], last_gasp: [900, 2],
    salvagers_luck: [1200, 2], second_wind: [3500, 5], treasure_hunter: [4000, 5], lucky_draw: [9000, 6],
  },
  factions: { reavers: [1500, 3], wyrdtide: [1500, 3], iron_accord: [1500, 3] },
  // Workshop: [salvage, scales] — scales are the gate already.
  workshop: {
    reinforced_barrels: [600, 1], sharpened_grapeshot: [600, 1], honed_chain: [600, 1], deep_fuses: [700, 1], hot_pitch: [700, 1],
    reinforced_ribs: [900, 2], master_rigging: [1400, 3], armament_forge: [1800, 3], kraken_hide: [2500, 5],
  },
};
