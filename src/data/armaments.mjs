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
    desc: ['A rail gun that peppers the nearest enemy', 'Faster and harder', 'A storm of shot'],
    cooldown: [0.42, 0.32, 0.24], damage: [5, 6, 8], range: 150,
  },
  {
    id: 'harpoon', name: 'Harpoon Launcher', icon: '🔱', color: '#c9d4dc',
    desc: ['A harpoon every few seconds that runs through everything in a line', 'Heavier harpoons, more often', 'A whaler\'s broadside'],
    cooldown: [2.3, 1.8, 1.4], damage: [24, 32, 42], range: 270,
  },
  {
    id: 'mortar', name: 'Deck Mortar', icon: '☄️', color: '#ffb347',
    desc: ['Lobs an exploding shell at distant enemies', 'Bigger blasts', 'Fires twice as often'],
    cooldown: [3.2, 2.7, 1.7], damage: [24, 32, 36], range: 240, blast: [34, 44, 46],
  },
  {
    id: 'powder_kegs', name: 'Powder Kegs', icon: '🛢️', color: '#8a5a2b',
    desc: ['Drops a floating keg in your wake that blows up anything that touches it', 'More kegs, bigger bangs', 'A minefield behind you'],
    cooldown: [2.4, 1.8, 1.3], damage: [28, 36, 46], blast: [36, 42, 48], fuse: 6,
  },
  {
    id: 'stern_chaser', name: 'Stern Chaser', icon: '↩️', color: '#d9b36a',
    desc: ['A rear cannon that shoots whatever is chasing you', 'Faster reload', 'Two stern guns'],
    cooldown: [0.9, 0.7, 0.55], damage: [10, 13, 14], range: 220, shots: [1, 1, 2],
  },
  {
    id: 'broadside', name: 'Broadside Battery', icon: '🧨', color: '#f0c070',
    desc: ['Every few seconds, a volley off both sides', 'More guns per side', 'A full broadside'],
    cooldown: [3.0, 2.5, 2.0], damage: [12, 13, 15], range: 200, perSide: [2, 3, 4],
  },
  {
    id: 'sea_spirit', name: 'Sea Spirit', icon: '🌀', color: '#7ff0e0',
    desc: ['A glowing wisp circles your ship and burns what it touches', 'Two wisps', 'Three wisps, faster'],
    count: [1, 2, 3], damage: [9, 11, 13], orbit: 36, spin: [3, 3.2, 4],
  },
  {
    id: 'st_elmos_fire', name: "St Elmo's Fire", icon: '⚡', color: '#b8e4ff',
    desc: ['Your cannonballs arc lightning to a nearby enemy', 'Arcs to two more', 'Arcs to three, harder'],
    chains: [1, 2, 3], share: [0.5, 0.55, 0.7], reach: 80,
  },
];

export const ARMAMENT_BY_ID = Object.fromEntries(ARMAMENTS.map((a) => [a.id, a]));
export const ARMAMENT_MAX_LEVEL = 3;
