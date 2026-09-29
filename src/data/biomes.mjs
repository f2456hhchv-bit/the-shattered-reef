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
  // 2026-09-29 (project owner: "New biomes too. Think lava/volcanoes.
  // Caverns/caves/dark. Any more?"): stages 5-10.
  VOLCANIC: 'volcanic',
  CAVERNS: 'caverns',
  MANGROVE: 'mangrove',
  ABYSS: 'abyss',
  BONE_SANDS: 'bone_sands',
  CRYSTAL: 'crystal',
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
  // ---- 2026-09-29: six more biomes (stages 5-10). Optional fields the
  // renderer and game read on top of the colour stops:
  //   decor: { palm|bush|boulder|coral|shell: style } — draw a decoration
  //     kind in another style ('charred', 'stalagmite', 'mushroom',
  //     'mangrove', 'lilypad', 'tubeworm', 'anemone', 'cactus', 'bones',
  //     'crystal', 'skull'); placement is unchanged.
  //   glow: { kind: [r, g, b] } — decorations that give off light (seen in
  //     the dark, and haloed).
  //   lava: molten pools inland, unshaded so they glow.
  //   ambient: darkness with a light radius around your ship (engine/
  //     ambient.mjs), or a colour haze, or drifting embers/spores/sand.
  //   ricochet: shots bounce off the shore this many times.
  [BIOME_IDS.VOLCANIC]: {
    id: BIOME_IDS.VOLCANIC,
    code: 'VO',
    name: 'Volcanic Caldera',
    water: [[0, '#e8a060'], [3.5, '#8a5a40'], [9, '#3a3e42'], [26, '#232c34'], [70, '#12181e']],
    foam: '#f3d9b0',
    foamWidth: 2.6,
    land: [[0, '#3a3330'], [2.5, '#4a403a'], [8, '#3b3533'], [12, '#2c2826'], [20, '#262221'], [40, '#1f1c1b']],
    jungleDark: '#161312',
    rock: '#5f5650',
    rockDark: '#2a2524',
    rockStart: 22,
    outside: '#120d0c',
    lava: { color: '#ff5a14', hot: '#ffd060', threshold: 0.5, start: 13 },
    palm: { trunk: '#2a2220', frond: '#3a3230', frondLight: '#4a403c', density: 0.2 },
    bush: ['#3a3431', '#4d4540'],
    boulder: ['#5a5460', '#1c1a20'], // obsidian
    coral: ['#ff7a2a', '#ffb347', '#d9481f', '#ffcf6b'], // glowing magma rocks in the shallows
    decor: { palm: 'charred', coral: 'ember' },
    glow: { coral: [255, 140, 50] },
    sparkle: 'rgba(255, 170, 90, 0.85)',
    ambient: { embers: [255, 140, 50], tint: [255, 80, 20], tintAlpha: 0.07 },
  },
  [BIOME_IDS.CAVERNS]: {
    id: BIOME_IDS.CAVERNS,
    code: 'CV',
    name: 'Sunless Caverns',
    water: [[0, '#5fb8b0'], [5, '#2f7f86'], [16, '#1d5663'], [38, '#12394a'], [80, '#0a2230']],
    foam: '#bfe8e2',
    foamWidth: 2.2,
    land: [[0, '#5a5048'], [2.5, '#6b6056'], [8, '#5a5149'], [12, '#4a433d'], [20, '#3f3934'], [40, '#35302c']],
    jungleDark: '#2a2622',
    rock: '#6e665e',
    rockDark: '#3a3531',
    rockStart: 10,
    outside: '#050607',
    palm: { trunk: '#6e665e', frond: '#8a8076', frondLight: '#a39a90', density: 0.5 },
    bush: ['#23a898', '#b6fff4'],
    boulder: ['#7a7068', '#3e3833'],
    coral: ['#3fe0c8', '#7af0ff', '#b07aff', '#5affa8'],
    decor: { palm: 'stalagmite', bush: 'mushroom', coral: 'glowcoral' },
    glow: { bush: [80, 255, 225], coral: [120, 240, 255] },
    sparkle: 'rgba(150, 255, 235, 0.8)',
    ambient: { dark: 0.93, light: 195, color: [4, 6, 12], spores: [140, 255, 230] },
  },
  [BIOME_IDS.MANGROVE]: {
    id: BIOME_IDS.MANGROVE,
    code: 'MG',
    name: 'Mangrove Bayou',
    water: [[0, '#7fa070'], [4, '#4f7a5a'], [12, '#2f5a4a'], [30, '#1f4238'], [70, '#122a24']],
    foam: '#d6e2b8',
    foamWidth: 2,
    land: [[0, '#5c4b33'], [2.5, '#6b5a3c'], [6, '#4f5a2e'], [11, '#3f5a28'], [18, '#2f4a20'], [40, '#263d1b']],
    jungleDark: '#18290f',
    rock: '#5e5a4c',
    rockDark: '#35322a',
    rockStart: 50,
    outside: '#0d1a12',
    palm: { trunk: '#4a3a26', frond: '#2c4a1e', frondLight: '#44692c', density: 0.6 },
    bush: ['#2a4a1f', '#3d6a2a'],
    boulder: ['#6a6452', '#3b382d'],
    coral: ['#4f8a3a', '#6fae4a', '#e79ac0', '#f4f0d8'],
    decor: { palm: 'mangrove', coral: 'lilypad' },
    sparkle: 'rgba(220, 240, 170, 0.6)',
    ambient: { tint: [70, 110, 50], tintAlpha: 0.14, fireflies: [220, 255, 120] },
  },
  [BIOME_IDS.ABYSS]: {
    id: BIOME_IDS.ABYSS,
    code: 'AB',
    name: 'Abyssal Trench',
    water: [[0, '#3fd6d0'], [4, '#1b7a96'], [14, '#10405e'], [34, '#0a2442'], [80, '#050f24']],
    foam: '#8ff5ff',
    foamWidth: 1.8,
    land: [[0, '#2a2f3a'], [2.5, '#343a48'], [8, '#2a2f3b'], [14, '#222631'], [40, '#1b1e27']],
    jungleDark: '#12141b',
    rock: '#4a5163',
    rockDark: '#1c2029',
    rockStart: 18,
    outside: '#02040a',
    palm: { trunk: '#e8e2f0', frond: '#ff4a6a', frondLight: '#ffb0c0', density: 0.4 },
    bush: ['#b0306a', '#ffb0dc'],
    boulder: ['#3f4659', '#171a22'],
    coral: ['#5afff0', '#b07aff', '#ff7ad9', '#7ab8ff'],
    decor: { palm: 'tubeworm', bush: 'anemone', coral: 'glowcoral' },
    glow: { palm: [255, 90, 130], bush: [255, 120, 200], coral: [110, 255, 240] },
    sparkle: 'rgba(120, 255, 240, 0.9)',
    ambient: { dark: 0.78, light: 235, color: [2, 4, 16], spores: [110, 220, 255] },
  },
  [BIOME_IDS.BONE_SANDS]: {
    id: BIOME_IDS.BONE_SANDS,
    code: 'BS',
    name: 'Bone Sands',
    water: [[0, '#a8e8d8'], [5, '#62c8c0'], [16, '#2fa0b0'], [38, '#1d7090'], [80, '#134c6c']],
    foam: '#fff8e8',
    foamWidth: 2.8,
    land: [[0, '#d9bf8a'], [2.5, '#ecd4a0'], [8, '#e8c98e'], [14, '#dcb676'], [24, '#cfa465'], [40, '#c4975a']],
    jungleDark: '#b8894e', // wind ripples in the dunes
    rock: '#c9885a',
    rockDark: '#8a5236', // red sandstone
    rockStart: 30,
    outside: '#134c6c',
    palm: { trunk: '#8a6a40', frond: '#5f8a3a', frondLight: '#86ad52', density: 0.12 },
    bush: ['#5a8a4a', '#7aa85e'],
    boulder: ['#efe6d0', '#b8ad94'],
    coral: ['#e0a070', '#f2c49a', '#c87a5a', '#8fd8c8'],
    decor: { bush: 'cactus', boulder: 'bones', shell: 'skull' },
    sparkle: 'rgba(255, 255, 240, 0.95)',
    ambient: { tint: [255, 190, 110], tintAlpha: 0.06, sand: [230, 200, 150] },
  },
  [BIOME_IDS.CRYSTAL]: {
    id: BIOME_IDS.CRYSTAL,
    code: 'CR',
    name: 'Crystal Lagoon',
    water: [[0, '#c8f0ff'], [5, '#8ad0f0'], [16, '#6a8fe0'], [38, '#4a58b0'], [80, '#2a2a70']],
    foam: '#ffffff',
    foamWidth: 2.4,
    land: [[0, '#b8a8d0'], [2.5, '#d0c4e4'], [8, '#c2b4dc'], [14, '#a898c8'], [40, '#9282b8']],
    jungleDark: '#7a68a8',
    rock: '#e0d8f4',
    rockDark: '#6a5a9a',
    rockStart: 20,
    outside: '#140f30',
    palm: { trunk: '#7af0ff', frond: '#b89cff', frondLight: '#f0e6ff', density: 0.45 },
    bush: ['#8ab8ff', '#e6f4ff'],
    boulder: ['#f4eeff', '#9a88d0'],
    coral: ['#ff9ae0', '#9affff', '#c8a8ff', '#ffffff'],
    decor: { palm: 'crystal', bush: 'crystal', coral: 'glowcoral' },
    glow: { palm: [200, 170, 255] },
    sparkle: 'rgba(255, 240, 255, 0.95)',
    ricochet: 1,
    ambient: { tint: [170, 130, 255], tintAlpha: 0.05, glints: [255, 240, 255] },
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
