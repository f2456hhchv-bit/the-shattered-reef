// Weather and hazards (2026-09-29, project owner: "Weather effects at
// random… different weather varieties for different biomes... rock falls,
// whirlpools, sideways winds... think of every weather effect").
//
// One event at a time, rolled from the level's biome table, with a quiet
// spell between events. Every dangerous thing is telegraphed first (a
// marked spot, an arrow on the horizon, a toast), and everything that
// hurts you hurts enemies too, so weather is something to play around and
// use, not just a tax. Numbers are in world px and seconds; forces are
// velocity changes per second (the boat accelerates at ~240, tops out ~120).
// Data only; engine/weather.mjs runs it.

export const WEATHER = {
  gale: {
    name: 'Gale', icon: '🌬️', msg: 'A gale blows in — it shoves your ship',
    duration: [16, 24], wind: 70,
  },
  squall: {
    name: 'Rain Squall', icon: '🌧️', msg: 'Rain squall — enemies can’t see you coming',
    duration: [18, 26], wind: 25, sight: 0.6, rain: 1,
  },
  thunderstorm: {
    name: 'Thunderstorm', icon: '⛈️', msg: 'Lightning! Steer clear of the glowing marks',
    duration: [18, 24], wind: 30, sight: 0.8, rain: 0.8, dark: 0.35,
    strikeEvery: [1.2, 2.0], strikeWarn: 3.0, strikeRadius: 34, strikeDamage: 16, aimed: 0.45,
  },
  fog: {
    name: 'Fog Bank', icon: '🌫️', msg: 'Fog rolls in — you see less, and so do they',
    duration: [20, 28], sight: 0.5, view: 175, fogColor: [205, 218, 222],
  },
  whirlpool: {
    name: 'Whirlpool', icon: '🌀', msg: 'A whirlpool opens — keep your sails full to break free',
    duration: [16, 22], radius: 125, pull: 150, swirl: 0.7, core: 24, coreDps: 9,
  },
  rogue_wave: {
    name: 'Rogue Wave', icon: '🌊', msg: 'Rogue wave! Brace — it’ll carry you',
    duration: [9, 9], warn: 3.0, speed: 230, width: 70, push: 300, damage: 6,
  },
  waterspout: {
    name: 'Waterspout', icon: '🌪️', msg: 'Waterspouts loose on the reef — keep clear',
    duration: [16, 22], count: [1, 2], speed: 42, radius: 22, pullRadius: 80, pull: 110, damage: 10, hitEvery: 0.8,
    rain: 0.3,
  },
  rockfall: {
    name: 'Rockfall', icon: '🪨', msg: 'Rockfall! Keep off the cliffs',
    duration: [14, 20], every: [0.45, 0.8], warn: 2.2, radius: 24, damage: 18, shoreBand: [4, 34],
    rock: ['#8b8a82', '#55575a'],
  },
  icefall: {
    name: 'Icefall', icon: '🧊', msg: 'The ice cliffs are calving — keep off the shore',
    duration: [14, 20], every: [0.5, 0.9], warn: 2.2, radius: 26, damage: 16, shoreBand: [4, 34],
    rock: ['#eaf2f7', '#9fc4d8'],
  },
  blizzard: {
    name: 'Blizzard', icon: '❄️', msg: 'Blizzard — ice on the rudder, snow in your eyes',
    duration: [18, 26], wind: 45, sight: 0.55, view: 210, turn: 0.65, snow: 1, fogColor: [232, 240, 246],
  },
  ice_floes: {
    name: 'Ice Floes', icon: '🧊', msg: 'Ice floes drifting in — don’t ram them',
    duration: [22, 30], count: [6, 9], drift: [16, 30], size: [11, 19], damagePerSpeed: 0.09,
    colors: ['#f2f8fc', '#bfe0ef', '#8fc6de'],
  },
  wreckage: {
    name: 'Wreckage Drift', icon: '🪵', msg: 'Wreckage drifting through — mind the timbers',
    duration: [22, 30], count: [6, 9], drift: [14, 26], size: [10, 17], damagePerSpeed: 0.08,
    colors: ['#6b4a2a', '#8a6a44', '#4a3420'], salvage: 2,
  },
  ghost_lights: {
    name: 'Ghost Lights', icon: '👻', msg: 'Ghost lights over the wrecks… sail through them for Salvage',
    duration: [18, 24], count: [5, 7], radius: 12, salvage: 3, fog: 0.3, fogColor: [150, 200, 190],
  },
  // ---- 2026-09-29: the six new biomes. `kind` makes an event behave like
  // an existing one (a sinkhole is a whirlpool of sand); `palette` recolours
  // its art; `afflict` puts a status on your ship when it hits (burn,
  // poison, shock); `dim` shrinks your lantern in the dark biomes.
  eruption: {
    name: 'Eruption', icon: '🌋', msg: 'The volcano erupts! Lava bombs — watch the marks',
    duration: [14, 20], every: [0.7, 1.2], warn: 2.4, radius: 30, damage: 8, shoreBand: [6, 999],
    rock: ['#ff8a3a', '#3a2622'], afflict: { burn: 1.5 }, fiery: true, dark: 0.12,
  },
  ash_cloud: {
    name: 'Ash Cloud', icon: '🌫️', msg: 'Ash blots out the sky — you see less, and so do they',
    duration: [18, 26], sight: 0.55, view: 190, fogColor: [72, 64, 62],
  },
  fire_spout: {
    name: 'Fire Whirls', icon: '🔥', kind: 'waterspout', msg: 'Fire whirls on the water — keep clear',
    duration: [16, 22], count: [1, 2], speed: 40, radius: 22, pullRadius: 80, pull: 100, damage: 8, hitEvery: 0.8,
    afflict: { burn: 2 }, palette: { spout: [255, 120, 40] },
  },
  cave_in: {
    name: 'Cave-in', icon: '🪨', msg: 'The roof is coming down! Keep off the walls',
    duration: [14, 20], every: [0.45, 0.8], warn: 2.2, radius: 26, damage: 13, shoreBand: [4, 60],
    rock: ['#8a8078', '#4a433d'],
  },
  blackout: {
    name: 'Blackout', icon: '🌑', msg: 'Your lantern gutters — the dark closes in',
    duration: [14, 20], dim: 0.55,
  },
  glow_spores: {
    name: 'Glow Spores', icon: '✨', kind: 'ghost_lights', msg: 'Glowing spores drift by… sail through them for Salvage',
    duration: [18, 24], count: [5, 7], radius: 12, salvage: 3, palette: { light: [120, 255, 220] },
  },
  cave_mist: {
    name: 'Cave Mist', icon: '🌫️', msg: 'Mist rises off the black water',
    duration: [18, 24], sight: 0.7, fog: 0.35, fogColor: [90, 110, 120],
  },
  swamp_gas: {
    name: 'Swamp Gas', icon: '💨', msg: 'Marsh gas bubbling up — it ignites! Steer clear of the marks',
    duration: [14, 20], every: [0.45, 0.8], warn: 2.4, radius: 30, damage: 9, shoreBand: [4, 999],
    rock: ['#c8ff6a', '#4a6a2a'], afflict: { burn: 1.5 }, fiery: true,
  },
  bog_fog: {
    name: 'Bog Fog', icon: '🌫️', msg: 'Thick bog fog — gators love it',
    duration: [20, 28], sight: 0.5, view: 170, fogColor: [150, 170, 120],
  },
  will_o_wisps: {
    name: "Will-o'-the-Wisps", icon: '🕯️', kind: 'ghost_lights', msg: "Will-o'-the-wisps… sail through them for Salvage",
    duration: [18, 24], count: [5, 7], radius: 12, salvage: 3, palette: { light: [220, 255, 120] },
  },
  deadwood: {
    name: 'Deadwood', icon: '🪵', kind: 'wreckage', msg: 'Rotten logs drifting through — don’t ram them',
    duration: [22, 30], count: [6, 9], drift: [12, 22], size: [10, 16], damagePerSpeed: 0.08,
    colors: ['#4a3a26', '#5e4a30', '#3a2e1e'], salvage: 1,
  },
  vent_burst: {
    name: 'Pressure Vents', icon: '♨️', msg: 'Vents are bursting — the water marks where',
    duration: [14, 20], every: [0.45, 0.8], warn: 2.4, radius: 28, damage: 10, shoreBand: [6, 999],
    rock: ['#c8f8ff', '#3a6a8a'], afflict: { shock: 0.5 },
  },
  undertow: {
    name: 'Undertow', icon: '🌊', kind: 'gale', msg: 'A deep current drags at your hull',
    duration: [16, 22], wind: 60,
  },
  bloom: {
    name: 'Bioluminescent Bloom', icon: '✨', kind: 'ghost_lights', msg: 'A glowing bloom rises… sail through it for Salvage',
    duration: [18, 24], count: [5, 7], radius: 12, salvage: 3, palette: { light: [110, 220, 255] },
  },
  maelstrom: {
    name: 'Maelstrom', icon: '🌀', kind: 'whirlpool', msg: 'A maelstrom opens in the deep — full sail to break free',
    duration: [16, 22], radius: 145, pull: 160, swirl: 0.8, core: 26, coreDps: 10, palette: { whirl: [40, 20, 80] },
  },
  sandstorm: {
    name: 'Sandstorm', icon: '🏜️', msg: 'Sandstorm! It pushes you, and nobody can see far',
    duration: [18, 26], wind: 55, sight: 0.55, view: 200, fogColor: [214, 184, 132],
  },
  sinkhole: {
    name: 'Sinkhole', icon: '🌀', kind: 'whirlpool', msg: 'A sinkhole of sand and sea — keep your sails full',
    duration: [16, 22], radius: 120, pull: 145, swirl: 0.6, core: 24, coreDps: 9, palette: { whirl: [120, 90, 50] },
  },
  dust_devil: {
    name: 'Dust Devils', icon: '🌪️', kind: 'waterspout', msg: 'Dust devils spinning across the lagoon',
    duration: [16, 22], count: [1, 2], speed: 46, radius: 22, pullRadius: 80, pull: 110, damage: 9, hitEvery: 0.8,
    palette: { spout: [200, 160, 100] },
  },
  shard_rain: {
    name: 'Shard Rain', icon: '💎', msg: 'Crystal shards falling! Watch the marks',
    duration: [14, 20], every: [0.45, 0.8], warn: 2.2, radius: 24, damage: 11, shoreBand: [4, 999],
    rock: ['#f4ecff', '#9a88d0'],
  },
  static_storm: {
    name: 'Static Storm', icon: '⚡', msg: 'Static in the crystals — lightning marks the water',
    duration: [18, 24], sight: 0.85, dark: 0.2,
    strikeEvery: [1.2, 2.0], strikeWarn: 3.0, strikeRadius: 34, strikeDamage: 13, aimed: 0.4, afflict: { shock: 0.5 },
  },
  prism_lights: {
    name: 'Prism Lights', icon: '🌈', kind: 'ghost_lights', msg: 'Prism lights dance on the water… sail through them for Salvage',
    duration: [18, 24], count: [5, 7], radius: 12, salvage: 3, palette: { light: [255, 160, 240] },
  },
  crystal_mist: {
    name: 'Lilac Mist', icon: '🌫️', msg: 'A glittering mist rolls in',
    duration: [20, 28], sight: 0.55, view: 185, fogColor: [212, 196, 240],
  },
};

// Relative odds per biome. Every biome has something that pushes you,
// something that hides you, and something that hits.
export const BIOME_WEATHER = {
  tropical: { squall: 3, gale: 2, waterspout: 2, whirlpool: 2, thunderstorm: 2, fog: 2, rogue_wave: 1 },
  cliff_cove: { rockfall: 3, gale: 3, fog: 2, rogue_wave: 2, thunderstorm: 1 },
  glacial: { blizzard: 3, ice_floes: 3, icefall: 2, fog: 2, gale: 1 },
  shipwreck: { fog: 3, thunderstorm: 3, whirlpool: 2, wreckage: 2, ghost_lights: 2, rogue_wave: 1 },
  volcanic: { eruption: 3, ash_cloud: 3, fire_spout: 2, thunderstorm: 1, gale: 1 },
  caverns: { cave_in: 3, blackout: 2, glow_spores: 2, whirlpool: 2, cave_mist: 1 },
  mangrove: { swamp_gas: 3, bog_fog: 3, will_o_wisps: 2, deadwood: 2, squall: 2, thunderstorm: 1 },
  abyss: { vent_burst: 3, bloom: 2, maelstrom: 2, undertow: 2, blackout: 2 },
  bone_sands: { sandstorm: 3, dust_devil: 2, sinkhole: 2, gale: 2, rogue_wave: 1 },
  crystal: { shard_rain: 3, static_storm: 2, prism_lights: 2, crystal_mist: 2, whirlpool: 1 },
};

// The quiet spell before the first event of a level, and between events.
export const WEATHER_TIMING = { first: [16, 28], between: [22, 40] };
