// Biome art direction as data (2026-09-28 art pass). The terrain renderer
// (engine/terrainRenderer.mjs) is generic: it turns a reef's tile grid
// into a signed-distance field (px from the coastline, + = land, - = water)
// and looks every colour up here. A new biome (Cliff & Cove, Glacial
// Fjords, Shipwreck Coast) is a new entry, not new rendering code.
//
// Colour stops are [distance px, '#rrggbb'], linearly blended between
// stops. Water stops are keyed by depth (px from shore), land stops by
// distance inland.

export const BIOME_IDS = Object.freeze({
  TROPICAL: 'tropical',
  CLIFF_COVE: 'cliff_cove',
  GLACIAL: 'glacial',
  SHIPWRECK: 'shipwreck',
});

export const BIOMES = Object.freeze({
  [BIOME_IDS.TROPICAL]: {
    id: BIOME_IDS.TROPICAL,
    code: 'TR', // level-code prefix (engine/levels.mjs) — unique per biome
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
  // 2026-09-29: the other three biomes from the painted reference sheet,
  // one per stage (engine/run.mjs biomeForStage). Same renderer, new data:
  // decoration kinds stay palm/bush/boulder/coral, recoloured to read as
  // pines, ice floes, shingle or wreck timber.
  [BIOME_IDS.CLIFF_COVE]: {
    id: BIOME_IDS.CLIFF_COVE,
    code: 'CC',
    name: 'Cliff & Cove',
    water: [[0, '#8fe0d8'], [5, '#4bbfc4'], [16, '#2a93b3'], [38, '#1c6690'], [80, '#123f63']],
    foam: '#f2fbf8',
    foamWidth: 2.8,
    land: [[0, '#b9a88a'], [2.5, '#cdbd97'], [6, '#8f9a66'], [10, '#6d8f4a'], [18, '#5a7d3e'], [40, '#4c6d36']],
    jungleDark: '#3b5a2c',
    rock: '#a19b90',
    rockDark: '#5f5c57',
    rockStart: 16, // cliffs almost straight off the beach
    outside: '#0f3a57',
    palm: { trunk: '#6b5335', frond: '#4e7a3a', frondLight: '#6f9a4f', density: 0.08 },
    bush: ['#4f7a3a', '#6a9448'],
    boulder: ['#b0aa9f', '#77736c'],
    coral: ['#d9d3c2', '#b7c7cf', '#e7a98f', '#9ec7b8'],
    sparkle: 'rgba(240, 255, 252, 0.9)',
  },
  [BIOME_IDS.GLACIAL]: {
    id: BIOME_IDS.GLACIAL,
    code: 'GF',
    name: 'Glacial Fjords',
    water: [[0, '#bff1f4'], [5, '#7fd0e0'], [16, '#4a9fc2'], [38, '#2b6f9a'], [80, '#173f66']],
    foam: '#ffffff',
    foamWidth: 3.2,
    land: [[0, '#9fb3bd'], [2.5, '#c9d6dc'], [6, '#e6eef2'], [11, '#dfe8ee'], [18, '#d3dfe7'], [40, '#eef4f8']],
    jungleDark: '#b3c3ce',
    rock: '#7d8a94',
    rockDark: '#4d5862',
    rockStart: 26,
    outside: '#0e2f4a',
    palm: { trunk: '#5a4a3a', frond: '#2f5a45', frondLight: '#3d6e55', density: 0 },
    bush: ['#24503c', '#34684f'], // pines
    boulder: ['#eaf2f7', '#a9bccb'], // ice
    coral: ['#e8f6ff', '#bfe3f2', '#9fd0e6', '#ffffff'], // floes
    sparkle: 'rgba(255, 255, 255, 0.95)',
  },
  [BIOME_IDS.SHIPWRECK]: {
    id: BIOME_IDS.SHIPWRECK,
    code: 'SW',
    name: 'Shipwreck Coast',
    water: [[0, '#8ad0c0'], [5, '#4fa6a3'], [16, '#2e7f8a'], [38, '#1d5870'], [80, '#123a52']],
    foam: '#e6f0ea',
    foamWidth: 2.4,
    land: [[0, '#8f7f64'], [2.5, '#a8966f'], [8, '#9b8c66'], [11, '#6f7446'], [15, '#5a6038'], [40, '#4a4f2f']],
    jungleDark: '#3a3d25',
    rock: '#6f6a62',
    rockDark: '#403d39',
    rockStart: 34,
    outside: '#0c2d42',
    palm: { trunk: '#5e4a33', frond: '#5d6e34', frondLight: '#7a8a45', density: 0.18 },
    bush: ['#4a5230', '#5e6a3a'],
    boulder: ['#7a746a', '#4f4b45'],
    coral: ['#6b4a2a', '#8a6a44', '#5a3d22', '#a8906a'], // wreck timber
    sparkle: 'rgba(225, 245, 238, 0.85)',
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
