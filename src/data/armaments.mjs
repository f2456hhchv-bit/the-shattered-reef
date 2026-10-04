// Armaments (2026-09-29, project owner: "no real new weapons during play;
// upgrades were more hull buffs or damage"). An armament is a second gun
// or device that works on its own alongside your main weapon, found in
// treasure chests and sometimes offered after a level. Each levels up to
// 3 if found again. Stats are per level (index 0 = level 1).
//
// Projectile armaments fire through combat.mjs like any weapon (their
// weapon entries are ARMAMENT_WEAPONS in data/weapons.mjs); the Sea Spirit
// and St Elmo's Fire resolve their own hits (engine/armaments.mjs).

export const ARMAMENTS = [
  {
    id: 'swivel_gun', name: 'Swivel Gun', icon: '🔫', color: '#e8e2d0',
    desc: ['A rail gun that peppers the nearest enemy', 'Faster and harder', 'A storm of shot', 'Heavier shot', 'A gale of shot'],
    cooldown: [0.42, 0.32, 0.24, 0.22, 0.18], damage: [5, 6, 8, 10, 12], range: 150,
  },
  {
    id: 'harpoon', name: 'Harpoon Launcher', icon: '🔱', color: '#c9d4dc',
    desc: ['A harpoon every few seconds that runs through everything in a line', 'Heavier harpoons, more often', 'A whaler\'s broadside', 'Barbed harpoons', 'A harpoon storm'],
    cooldown: [2.3, 1.8, 1.4, 1.25, 1.0], damage: [24, 32, 42, 52, 64], range: 270,
  },
  {
    id: 'mortar', name: 'Deck Mortar', icon: '☄️', color: '#ffb347',
    desc: ['Lobs an exploding shell at distant enemies', 'Bigger blasts', 'Fires twice as often', 'Heavier shells', 'A barrage'],
    cooldown: [3.2, 2.7, 1.7, 1.5, 1.2], damage: [24, 32, 36, 46, 54], range: 240, blast: [34, 44, 46, 52, 58],
  },
  {
    id: 'powder_kegs', name: 'Powder Kegs', icon: '🛢️', color: '#8a5a2b',
    desc: ['Drops a floating keg in your wake that blows up anything that touches it', 'More kegs, bigger bangs', 'A minefield behind you', 'Blackpowder kegs', 'Kegs everywhere'],
    cooldown: [2.4, 1.8, 1.3, 1.1, 0.85], damage: [28, 36, 46, 56, 66], blast: [36, 42, 48, 52, 58], fuse: 6,
  },
  {
    id: 'stern_chaser', name: 'Stern Chaser', icon: '↩️', color: '#d9b36a',
    desc: ['A rear cannon that shoots whatever is chasing you', 'Faster reload', 'Two stern guns', 'Heavier balls', 'Three stern guns'],
    cooldown: [0.9, 0.7, 0.55, 0.5, 0.45], damage: [10, 13, 14, 18, 20], range: 220, shots: [1, 1, 2, 2, 3],
  },
  {
    id: 'broadside', name: 'Broadside Battery', icon: '🧨', color: '#f0c070',
    desc: ['Every few seconds, a volley off both sides', 'More guns per side', 'A full broadside', 'Heavier guns', 'A first-rate broadside'],
    cooldown: [3.0, 2.5, 2.0, 1.8, 1.5], damage: [12, 13, 15, 19, 22], range: 200, perSide: [2, 3, 4, 4, 5],
  },
  {
    id: 'sea_spirit', name: 'Sea Spirit', icon: '🌀', color: '#7ff0e0',
    desc: ['A glowing wisp circles your ship and burns what it touches', 'Two wisps', 'Three wisps, faster', 'Four wisps', 'Five blazing wisps'],
    count: [1, 2, 3, 4, 5], damage: [9, 11, 13, 15, 18], orbit: 36, spin: [3, 3.2, 4, 4.2, 4.6],
  },
  {
    id: 'st_elmos_fire', name: "St Elmo's Fire", icon: '⚡', color: '#b8e4ff',
    desc: ['Your cannonballs arc lightning to a nearby enemy', 'Arcs to two more', 'Arcs to three, harder', 'Arcs to four', 'Arcs to five, harder'],
    chains: [1, 2, 3, 4, 5], share: [0.5, 0.55, 0.7, 0.75, 0.85], reach: 80,
  },
];

export const ARMAMENT_BY_ID = Object.fromEntries(ARMAMENTS.map((a) => [a.id, a]));
// Five levels since survival mode (2026-10-04): armaments level up from
// the same cards as the core weapons.
export const ARMAMENT_MAX_LEVEL = 5;
