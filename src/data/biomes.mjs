// Biome art direction as data (2026-09-28 art pass). The terrain renderer
// (engine/terrainRenderer.mjs) is generic: it turns a reef's tile grid
// into a signed-distance field (px from the coastline, + = land, - = water)
// and looks every colour up here. A new biome (Cliff & Cove, Glacial
// Fjords, Shipwreck Coast) is a new entry, not new rendering code.
//
// Colour stops are [distance px, '#rrggbb'], linearly blended between
// stops. Water stops are keyed by depth (px from shore), land stops by
// distance inland.

export const BIOME_IDS = Object.freeze({ TROPICAL: 'tropical' });

export const BIOMES = Object.freeze({
  [BIOME_IDS.TROPICAL]: {
    id: BIOME_IDS.TROPICAL,
    name: 'Tropical Reef Labyrinth',
    water: [
      [0, '#7fe3cf'],
      [5, '#3fc3bd'],
      [16, '#1f9fb0'],
      [38, '#12708f'],
      [80, '#0c4c6c'],
    ],
    foam: '#eafaf2',
    foamWidth: 2.6, // px of surf line at the shore
    land: [
      [0, '#d6bd83'], // wet sand
      [2.5, '#e9d59b'], // beach
      [8, '#ead69c'],
      [11, '#6f9a3f'], // grass fringe
      [15, '#3f7f33'], // jungle
      [40, '#2f6a2a'],
    ],
    jungleDark: '#1f4e1c', // mottling blended in by noise
    rock: '#8b8a82',
    rockDark: '#55575a',
    rockStart: 44, // px inland where exposed rock can start (noise-shifted)
    outside: '#0a3f5e', // beyond the map edge
    // Decorations baked into the terrain.
    palm: { trunk: '#7a5a33', frond: '#2f8a34', frondLight: '#58b04a', density: 0.5 },
    bush: ['#2d6f2a', '#3b8a33'],
    boulder: ['#9a988f', '#6b6c69'],
    coral: ['#e0766a', '#f0a45b', '#c85f9a', '#7fd3c0'],
    sparkle: 'rgba(235, 255, 250, 0.9)',
  },
});

export function getBiome(id) {
  const b = BIOMES[id];
  if (!b) throw new Error(`Unknown biome: ${id}`);
  return b;
}

// '#rrggbb' → [r, g, b]
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blends colour stops at distance d. Pure, used by the renderer's pixel
// loop via a precomputed lookup table (see terrainRenderer.mjs).
export function colorAtStops(stops, d) {
  if (d <= stops[0][0]) return hexToRgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (d <= stops[i][0]) {
      const [d0, c0] = stops[i - 1]; const [d1, c1] = stops[i];
      const t = (d - d0) / (d1 - d0);
      const a = hexToRgb(c0); const b = hexToRgb(c1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return hexToRgb(stops[stops.length - 1][1]);
}
