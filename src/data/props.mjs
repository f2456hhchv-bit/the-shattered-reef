// Toy props (assets/props/<file>.png, 2026-10-11): upright pieces scattered
// on a biome's land in the survival arenas. `size` is the longest side on
// screen in px. Biomes without an entry show no props yet.
export const PROPS = {
  tropical: [
    { file: 'tropical_palm', size: 64, w: 3 }, { file: 'tropical_bush', size: 42, w: 3 },
    { file: 'tropical_boulder', size: 42, w: 1 }, { file: 'tropical_coral', size: 36, w: 1 },
  ],
  cliff_cove: [
    { file: 'cliff_cove_boulders', size: 48, w: 2 }, { file: 'cliff_cove_grass', size: 36, w: 3 },
    { file: 'cliff_cove_cairn', size: 42, w: 1 }, { file: 'cliff_cove_shell', size: 31, w: 1 },
  ],
  glacial: [
    { file: 'glacial_pine', size: 62, w: 3 }, { file: 'glacial_iceberg', size: 48, w: 2 },
    { file: 'glacial_snowdrift', size: 45, w: 2 }, { file: 'glacial_icecrystal', size: 42, w: 1 },
  ],
  shipwreck: [
    { file: 'shipwreck_mast', size: 56, w: 1 }, { file: 'shipwreck_barrel', size: 31, w: 2 },
    { file: 'shipwreck_boulder', size: 45, w: 3 }, { file: 'shipwreck_net', size: 42, w: 1 },
  ],
  // One prop each so far (2026-10-12); more arrive with batch P.
  volcanic: [{ file: 'volcanic_stump', size: 48, w: 1 }],
  caverns: [{ file: 'caverns_stalagmite', size: 52, w: 1 }],
  mangrove: [{ file: 'mangrove_tree', size: 60, w: 1 }],
  abyss: [{ file: 'abyss_anemone', size: 42, w: 1 }],
  bone_sands: [{ file: 'bone_sands_cactus', size: 48, w: 1 }],
  crystal: [{ file: 'crystal_cluster', size: 48, w: 1 }],
};

// Sea rock islets (assets/islands/rock_<colour>.png): small obstacles.
export const ROCK_ISLETS = {
  tropical: 'rock_grey', cliff_cove: 'rock_grey', glacial: 'rock_ice', shipwreck: 'rock_grey',
  volcanic: 'rock_black', caverns: 'rock_purple', mangrove: 'rock_grey', abyss: 'rock_navy',
  bone_sands: 'rock_sand', crystal: 'rock_lilac',
};
