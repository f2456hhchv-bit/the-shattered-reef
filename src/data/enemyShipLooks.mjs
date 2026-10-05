// Enemy ships drawn with the painted player hulls (2026-10-05), recoloured
// so they match the V3 art and turn through 16 headings like the player.
// Keyed by enemy sprite key (def.sprite || def.id). `scale` multiplies the
// default on-screen length (radius × ENEMY_SHIP_LENGTH). `look` is a
// recolour (engine/shipRecolour.mjs). Creatures and anything not listed
// keep their code-drawn art.

export const ENEMY_SHIP_LENGTH = 3.7; // broadside width, in collision radii

export const ENEMY_SHIP_LOOKS = {
  // Stage 1 pirates: black and blood-red cloth.
  pirate_cutter: { hull: 'sloop', look: { sail: '#2a2222', flag: '#b8322a', hull: '#5a3a2a', hullMix: 0.35 } },
  pirate_brig: { hull: 'junk', scale: 1.05, look: { sail: '#8c1f1a', flag: '#1a1214', hull: '#3a2a22', hullMix: 0.45 } },
  pirate_flagship: { hull: 'junk', scale: 1.15, look: { sail: '#1c1a1a', flag: '#c0392b', hull: '#2a1c18', hullMix: 0.55 } },
  longboat: { hull: 'longboat', tintFromColor: true, look: { hull: '#5a3a24', hullMix: 0.3 } },
  fire_ship: { hull: 'skiff', look: { sail: '#3a2a20', flag: '#e05a1a', hull: '#2e1f14', hullMix: 0.6 }, fire: true },
  mortar_boat: { hull: 'steamer', look: { hull: '#4a4f55', hullMix: 0.55 } },
  // Maze-era roster and later stages.
  reef_skimmer: { hull: 'skiff', scale: 0.95, look: { sail: '#5aa0c8', flag: '#c0392b', hull: '#4a3a2a', hullMix: 0.25 } },
  rigger: { hull: 'skiff', look: { sail: '#b04a4a', flag: '#2a2222', hull: '#3a2a22', hullMix: 0.4 } },
  ironclad_brigand: { hull: 'steamer', look: { hull: '#6b5638', hullMix: 0.5 } },
  ghost_ship: { hull: 'sloop', scale: 1.1, look: { ghost: true } },
  drowned_admiral: { hull: 'junk', scale: 1.15, look: { ghost: true } },
  drowned_skiff: { hull: 'longboat', look: { sail: '#6b7b6a', flag: '#3a4a3a', hull: '#5a6a58', hullMix: 0.6 } },
  obsidian_galley: { hull: 'longboat', scale: 1.15, look: { sail: '#e8521f', flag: '#ffb347', hull: '#2a2228', hullMix: 0.7 } },
  dune_raider: { hull: 'skiff', look: { sail: '#e0b050', flag: '#7a3a1a', hull: '#6a4a2a', hullMix: 0.4 } },
};
