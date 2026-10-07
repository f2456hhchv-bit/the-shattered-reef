// Image sprites for sea creatures and monsters (2026-10-05, the project
// owner's 30-creature pack, cleaned into assets/creatures/<file>.png).
// Looked up by enemy id first, then sprite key, so a horde can have its own
// picture (cave_bat, shard_crab) while sharing its parent's code art as a
// fallback. Anything not listed (most bosses, the warding seal) keeps its
// code-drawn sprite.
//
//   file     image in assets/creatures/
//   mode     'turn'  top-down art, rotated to the heading
//            'face'  upright art (golems, sirens, wisps); flipped to face
//                    left or right, never rotated
//   forward  for 'turn': which way the art points ('up' or 'right')
//   size     longest side on screen, in collision radii
//   flies    shadow drawn further below (it's in the air)

export const CREATURE_ART = {
  // Bosses in the toy-render style (2026-10-06, owner's ChatGPT batch A).
  krakens_anchor: { file: 'krakens_anchor', mode: 'face', size: 3.0 },
  hollow_king: { file: 'hollow_king', mode: 'face', size: 3.2 },
  frost_leviathan: { file: 'frost_leviathan', mode: 'turn', forward: 'up', size: 3.4 },
  caldera_wyrm: { file: 'caldera_wyrm', mode: 'turn', forward: 'up', size: 3.6 },
  caldera_wyrm_flying: { file: 'caldera_wyrm_flying', mode: 'turn', forward: 'up', size: 4.2, flies: true },
  reef_shark: { file: 'reef_shark', mode: 'turn', forward: 'up', size: 3.3 },
  bloodfin_matriarch: { file: 'bloodfin_matriarch', mode: 'turn', forward: 'up', size: 3.0 },
  sea_serpent: { file: 'sea_serpent', mode: 'turn', forward: 'up', size: 3.4 },
  sand_wyrm: { file: 'sand_wyrm', mode: 'turn', forward: 'up', size: 3.4 },
  frost_narwhal: { file: 'frost_narwhal', mode: 'turn', forward: 'up', size: 3.6 },
  stalker_eel: { file: 'stalker_eel', mode: 'turn', forward: 'up', size: 3.6 },
  bayou_gator: { file: 'bayou_gator', mode: 'turn', forward: 'up', size: 3.6 },
  leech_swarm: { file: 'leech_swarm', mode: 'turn', forward: 'up', size: 3.0 },
  bog_leech: { file: 'leech_swarm', mode: 'turn', forward: 'up', size: 3.0 },
  anglerfish: { file: 'anglerfish', mode: 'turn', forward: 'up', size: 3.2 },
  ink_squid: { file: 'ink_squid', mode: 'turn', forward: 'up', size: 3.2 },
  mirror_tortoise: { file: 'mirror_tortoise', mode: 'turn', forward: 'up', size: 3.0 },
  crystal_crab: { file: 'crystal_crab', mode: 'turn', forward: 'up', size: 2.9 },
  shard_crab: { file: 'shard_crab', mode: 'turn', forward: 'up', size: 2.9 },
  deep_crawler: { file: 'deep_crawler', mode: 'turn', forward: 'up', size: 3.0 },
  gullswarm_harpy: { file: 'gullswarm_harpy', mode: 'turn', forward: 'up', size: 3.2, flies: true },
  bone_vulture: { file: 'bone_vulture', mode: 'turn', forward: 'up', size: 3.8, flies: true },
  cave_bats: { file: 'cave_bats', mode: 'turn', forward: 'up', size: 3.6, flies: true },
  cave_bat: { file: 'cave_bat', mode: 'turn', forward: 'up', size: 3.6, flies: true },
  cinder_bat: { file: 'cinder_bat', mode: 'turn', forward: 'up', size: 3.6, flies: true },
  bog_witch: { file: 'bog_witch', mode: 'turn', forward: 'up', size: 3.0, flies: true },
  frost_wisp: { file: 'frost_wisp', mode: 'face', size: 2.8, flies: true },
  prism_sprite: { file: 'prism_sprite', mode: 'turn', forward: 'up', size: 3.0, flies: true },
  jelly_bloom: { file: 'jelly_bloom', mode: 'face', size: 3.0 },
  drift_jelly: { file: 'jelly_bloom', mode: 'face', size: 3.0 },
  ice_golem: { file: 'ice_golem', mode: 'face', size: 2.7 },
  magma_golem: { file: 'magma_golem', mode: 'face', size: 2.7 },
  deep_troll: { file: 'deep_troll', mode: 'face', size: 2.7 },
  siren: { file: 'siren', mode: 'face', size: 3.0 },
};

export const CREATURE_FILES = [...new Set(Object.values(CREATURE_ART).map((a) => a.file))];
