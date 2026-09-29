// Upgrade cards (2026-09-29, project owner chose "better counter weapons +
// pick-1-of-3 upgrades"). After each level you clear, three cards are
// offered and you keep one for the rest of the stage attempt, so a build
// grows over a stage. Data only; engine/upgrades.mjs applies them.
//
// `max`: how many times it can be taken. `weapon`: only offered when that
// weapon is held or this stage's enemies call for it (no Greek Fire on a
// stage with nothing to burn). `weight`: relative odds of being offered.

export const UPGRADES = [
  { id: 'heavy_shot', name: 'Heavy Shot', icon: '⚫', desc: '+30% Cannonball damage', max: 3, weight: 10 },
  { id: 'twin_cannons', name: 'Twin Cannons', icon: '⚔️', desc: 'Cannonballs fire one more ball', max: 2, weight: 7 },
  { id: 'piercing_shot', name: 'Piercing Shot', icon: '🎯', desc: 'Cannonballs pass through one more enemy', max: 2, weight: 6 },
  { id: 'quick_reload', name: 'Quick Reload', icon: '⏱️', desc: 'All weapons reload 15% faster', max: 3, weight: 9 },
  { id: 'long_guns', name: 'Long Guns', icon: '🔭', desc: '+20% range for every weapon', max: 2, weight: 6 },
  { id: 'hull_plating', name: 'Hull Plating', icon: '🛡️', desc: '+25 max hull, and patch 25 now', max: 3, weight: 9 },
  { id: 'bilge_pumps', name: 'Bilge Pumps', icon: '🔧', desc: 'Repair 1 hull every 2 seconds', max: 2, weight: 6 },
  { id: 'swift_sails', name: 'Swift Sails', icon: '⛵', desc: '+12% speed and acceleration', max: 2, weight: 6 },
  { id: 'iron_ram', name: 'Iron Ram', icon: '🐏', desc: 'Ramming deals 25 damage; take 30% less from rams and bites', max: 2, weight: 5 },
  { id: 'salvage_magnet', name: 'Salvage Magnet', icon: '🧲', desc: 'Pick things up from three times as far', max: 1, weight: 4 },
  { id: 'deep_magazines', name: 'Deep Magazines', icon: '📦', desc: 'Special weapons carry 50% more, and refill now', max: 2, weight: 6, needsSpecial: true },
  { id: 'scattershot', name: 'Scattershot', icon: '💥', desc: 'Grapeshot fires 3 more pellets', max: 2, weight: 7, weapon: 'grapeshot' },
  { id: 'bola_chains', name: 'Bola Chains', icon: '⛓️', desc: 'Chain Shot passes through 2 more enemies', max: 2, weight: 7, weapon: 'chain_shot' },
  { id: 'big_charges', name: 'Big Charges', icon: '💣', desc: 'Depth Charge blasts 40% wider', max: 2, weight: 7, weapon: 'depth_charges' },
  { id: 'greek_fire', name: 'Greek Fire', icon: '🔥', desc: 'Flame Barrels burn 60% longer and hit 25% harder', max: 2, weight: 7, weapon: 'flame_barrels' },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
