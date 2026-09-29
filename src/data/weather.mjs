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
    strikeEvery: [1.4, 2.4], strikeWarn: 1.3, strikeRadius: 32, strikeDamage: 12, aimed: 0.3,
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
    duration: [9, 9], warn: 2.2, speed: 230, width: 70, push: 300, damage: 6,
  },
  waterspout: {
    name: 'Waterspout', icon: '🌪️', msg: 'Waterspouts loose on the reef — keep clear',
    duration: [16, 22], count: [1, 2], speed: 42, radius: 22, pullRadius: 80, pull: 110, damage: 10, hitEvery: 0.8,
    rain: 0.3,
  },
  rockfall: {
    name: 'Rockfall', icon: '🪨', msg: 'Rockfall! Keep off the cliffs',
    duration: [14, 20], every: [0.45, 0.8], warn: 1.1, radius: 24, damage: 18, shoreBand: [4, 34],
    rock: ['#8b8a82', '#55575a'],
  },
  icefall: {
    name: 'Icefall', icon: '🧊', msg: 'The ice cliffs are calving — keep off the shore',
    duration: [14, 20], every: [0.5, 0.9], warn: 1.1, radius: 26, damage: 16, shoreBand: [4, 34],
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
};

// Relative odds per biome. Every biome has something that pushes you,
// something that hides you, and something that hits.
export const BIOME_WEATHER = {
  tropical: { squall: 3, gale: 2, waterspout: 2, whirlpool: 2, thunderstorm: 2, rogue_wave: 1 },
  cliff_cove: { rockfall: 3, gale: 3, fog: 2, rogue_wave: 2, thunderstorm: 1 },
  glacial: { blizzard: 3, ice_floes: 3, icefall: 2, fog: 2, gale: 1 },
  shipwreck: { fog: 3, thunderstorm: 3, whirlpool: 2, wreckage: 2, ghost_lights: 2, rogue_wave: 1 },
};

// The quiet spell before the first event of a level, and between events.
export const WEATHER_TIMING = { first: [16, 28], between: [22, 40] };
