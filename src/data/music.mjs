// Music (2026-09-28): original shanty-style themes, played by the small
// synthesiser in audio/music.mjs. Data only: a new track is a new entry.
//
// Timing is in steps (eighth notes). `lead` is a flat [note, steps] list
// (null = rest). `chords` is one [root, quality] per bar; the pad plays the
// triad and the bass follows `bassPattern` (R root, 5 fifth, O octave).
// Drums list the steps within a bar each voice hits.
//
// 2026-09-29 (project owner: "Make the music now"): every biome has its
// own sea theme and its own lair theme, each with its own instruments:
//   leadVoice: whistle (default) | bell | glass | brass | reed | pluck | organ
//   padVoice:  accordion (default) | choir | drone | arp (arpeggiated bells)
//   drums: kick, snare, hat, plus tom (taiko), tak (darbuka), drip (water)
//   volume: loudness trim (set from offline renders so themes match), echo: lead echo feedback
// Chord qualities: M major, m minor, P power (root + fifth + octave).

export const MUSIC_TRACKS = {
  // The harbour: an unhurried 6/8 in D dorian — accordion pad, plucked
  // bass, a whistle-like lead. Comfortable to sit in while shopping.
  harbour: {
    bpm: 84, stepsPerBeat: 3, barSteps: 6, leadGain: 0.12, padGain: 0.018, bassGain: 0.16,
    lead: [
      ['A4', 2], ['D5', 1], ['D5', 2], ['E5', 1],
      ['F5', 2], ['E5', 1], ['D5', 3],
      ['C5', 2], ['A4', 1], ['C5', 2], ['D5', 1],
      ['E5', 3], ['A4', 3],
      ['A4', 2], ['D5', 1], ['D5', 2], ['E5', 1],
      ['F5', 2], ['G5', 1], ['A5', 3],
      ['G5', 2], ['E5', 1], ['C5', 2], ['E5', 1],
      ['D5', 6],
      [null, 6],
      ['F5', 2], ['E5', 1], ['D5', 2], ['C5', 1],
      ['A4', 3], ['G4', 2], ['A4', 1],
      ['C5', 2], ['D5', 1], ['E5', 2], ['F5', 1],
      ['E5', 2], ['D5', 1], ['C5', 3],
      ['A4', 2], ['C5', 1], ['D5', 2], ['E5', 1],
      ['D5', 6],
      [null, 6],
    ],
    chords: [
      ['D3', 'm'], ['D3', 'm'], ['C3', 'M'], ['A2', 'm'], ['D3', 'm'], ['F3', 'M'], ['C3', 'M'], ['D3', 'm'],
      ['D3', 'm'], ['D3', 'm'], ['F3', 'M'], ['A2', 'm'], ['C3', 'M'], ['A2', 'm'], ['D3', 'm'], ['D3', 'm'],
    ],
    bassPattern: ['R', null, null, '5', null, null],
    drums: { kick: [0], snare: [], hat: [] },
  },

  // Under sail: a driving 4/4 in A dorian with a stomping kick, a hand-drum
  // backbeat and a busier lead. Loops every 16 bars.
  voyage: {
    bpm: 112, stepsPerBeat: 2, barSteps: 8, leadGain: 0.1, padGain: 0.014, bassGain: 0.17,
    lead: [
      ['E5', 1], ['E5', 1], ['A5', 2], ['G5', 1], ['E5', 1], ['D5', 2],
      ['E5', 2], ['C5', 1], ['D5', 1], ['E5', 4],
      ['E5', 1], ['E5', 1], ['A5', 2], ['B5', 1], ['A5', 1], ['G5', 2],
      ['A5', 6], [null, 2],
      ['G5', 2], ['E5', 1], ['G5', 1], ['A5', 2], ['G5', 2],
      ['E5', 1], ['D5', 1], ['C5', 2], ['D5', 4],
      ['E5', 1], ['D5', 1], ['C5', 1], ['B4', 1], ['A4', 2], ['B4', 2],
      ['A4', 6], [null, 2],
      [null, 8],
      ['A4', 1], ['C5', 1], ['E5', 2], ['A4', 1], ['C5', 1], ['E5', 2],
      ['G5', 2], ['F#5', 1], ['E5', 1], ['D5', 4],
      ['C5', 1], ['D5', 1], ['E5', 2], ['G5', 2], ['E5', 2],
      ['A5', 4], ['G5', 2], ['E5', 2],
      ['D5', 2], ['E5', 1], ['D5', 1], ['C5', 2], ['B4', 2],
      ['A4', 1], ['B4', 1], ['C5', 2], ['B4', 2], ['G4', 2],
      ['A4', 6], [null, 2],
    ],
    chords: [
      ['A2', 'm'], ['C3', 'M'], ['A2', 'm'], ['D3', 'M'], ['G2', 'M'], ['C3', 'M'], ['E2', 'm'], ['A2', 'm'],
      ['A2', 'm'], ['A2', 'm'], ['G2', 'M'], ['C3', 'M'], ['D3', 'M'], ['G2', 'M'], ['E2', 'm'], ['A2', 'm'],
    ],
    bassPattern: ['R', null, 'O', null, '5', null, 'O', null],
    drums: { kick: [0, 4], snare: [2, 6], hat: [1, 3, 5, 7] },
  },

  // The Kraken's lair: a low D-minor ostinato, war drums and a slow,
  // uneasy lead. Tension over tune.
  lair: {
    bpm: 128, stepsPerBeat: 2, barSteps: 8, leadGain: 0.085, padGain: 0.016, bassGain: 0.2,
    lead: [
      ['A4', 8], ['Bb4', 8], ['A4', 4], ['G4', 4], ['F4', 8],
      ['D5', 6], ['C#5', 2], ['D5', 8], ['F5', 4], ['E5', 4], ['D5', 8],
      ['A4', 8], ['Bb4', 6], ['C5', 2], ['A4', 8], [null, 8],
    ],
    chords: [
      ['D2', 'm'], ['D2', 'm'], ['Bb1', 'M'], ['D2', 'm'], ['D2', 'm'], ['G2', 'm'], ['A1', 'M'], ['D2', 'm'],
    ],
    bassPattern: ['R', 'R', 'O', 'R', '5', 'R', 'O', '5'],
    drums: { kick: [0, 3, 4], snare: [6], hat: [2, 7] },
  },
};

// ---- Per-biome themes. Each voyage theme loops every 16 bars; each
// lair theme is a tense 8-bar loop in the same key. ----
const K = (kick, snare = [], hat = [], extra = {}) => ({ kick, snare, hat, ...extra });

Object.assign(MUSIC_TRACKS, {
  // Cliff & Cove: a windswept jig in E dorian — tin whistle and bodhrán.
  cliff_cove: {
    volume: 0.72,
    bpm: 116, stepsPerBeat: 3, barSteps: 6, leadGain: 0.1, padGain: 0.014, bassGain: 0.16,
    lead: [
      ['B4', 2], ['E5', 1], ['E5', 2], ['F#5', 1], ['G5', 2], ['F#5', 1], ['E5', 2], ['D5', 1],
      ['B4', 2], ['D5', 1], ['A4', 2], ['D5', 1], ['D5', 2], ['A4', 1], ['F#4', 3],
      ['B4', 2], ['E5', 1], ['E5', 2], ['F#5', 1], ['G5', 2], ['A5', 1], ['B5', 2], ['A5', 1],
      ['G5', 2], ['E5', 1], ['D5', 2], ['B4', 1], ['E5', 3], ['E5', 3],
      ['E5', 1], ['F#5', 1], ['G5', 1], ['A5', 3], ['B5', 2], ['A5', 1], ['G5', 2], ['E5', 1],
      ['D5', 1], ['E5', 1], ['F#5', 1], ['G5', 3], ['A5', 2], ['G5', 1], ['F#5', 2], ['D5', 1],
      ['E5', 1], ['F#5', 1], ['G5', 1], ['A5', 2], ['B5', 1], ['C#6', 2], ['B5', 1], ['A5', 2], ['F#5', 1],
      ['G5', 2], ['E5', 1], ['D5', 2], ['B4', 1], ['E5', 6],
    ],
    chords: [
      ['E2', 'm'], ['E2', 'm'], ['D3', 'M'], ['D3', 'M'], ['E2', 'm'], ['G2', 'M'], ['D3', 'M'], ['E2', 'm'],
      ['E2', 'm'], ['G2', 'M'], ['D3', 'M'], ['G2', 'M'], ['E2', 'm'], ['A2', 'M'], ['D3', 'M'], ['E2', 'm'],
    ],
    bassPattern: ['R', null, 'O', '5', null, 'O'],
    drums: K([0, 3], [], [1, 2, 4, 5], { tom: [5] }),
  },
  cliff_cove_lair: {
    volume: 0.87,
    bpm: 132, stepsPerBeat: 2, barSteps: 8, leadGain: 0.09, padGain: 0.015, bassGain: 0.2,
    lead: [['E5', 8], ['G5', 4], ['F#5', 4], ['E5', 6], ['D5', 2], ['B4', 8], ['E5', 4], ['G5', 4], ['A5', 8], ['G5', 4], ['F#5', 2], ['D5', 2], ['E5', 8]],
    chords: [['E2', 'm'], ['E2', 'm'], ['C3', 'M'], ['D3', 'M'], ['E2', 'm'], ['A2', 'm'], ['B2', 'M'], ['E2', 'm']],
    bassPattern: ['R', 'R', 'O', 'R', '5', 'R', 'O', '5'],
    drums: K([0, 3, 4], [6], [2, 7], { tom: [0, 4] }),
  },

  // Glacial Fjords: a slow waltz in B minor — glass bells over a choir.
  glacial: {
    volume: 1.26,
    bpm: 84, stepsPerBeat: 2, barSteps: 6, leadGain: 0.11, padGain: 0.02, bassGain: 0.13, leadVoice: 'bell', padVoice: 'choir',
    lead: [
      ['F#5', 4], ['E5', 2], ['D5', 4], ['C#5', 2], ['B4', 6], [null, 2], ['F#4', 2], ['B4', 2],
      ['D5', 4], ['E5', 2], ['F#5', 2], ['G5', 2], ['F#5', 2], ['E5', 6], [null, 6],
      ['A5', 4], ['G5', 2], ['F#5', 4], ['E5', 2], ['D5', 2], ['E5', 2], ['F#5', 2], ['B4', 6],
      ['G5', 4], ['F#5', 2], ['E5', 2], ['D5', 2], ['C#5', 2], ['B4', 6], [null, 6],
    ],
    chords: [
      ['B2', 'm'], ['B2', 'm'], ['G2', 'M'], ['G2', 'M'], ['B2', 'm'], ['D3', 'M'], ['A2', 'M'], ['A2', 'M'],
      ['D3', 'M'], ['D3', 'M'], ['B2', 'm'], ['G2', 'M'], ['E2', 'm'], ['E2', 'm'], ['F#2', 'M'], ['B2', 'm'],
    ],
    bassPattern: ['R', null, '5', null, 'O', null],
    drums: K([0], [], [], { drip: [3] }),
  },
  glacial_lair: {
    volume: 1.08,
    bpm: 124, stepsPerBeat: 2, barSteps: 8, leadGain: 0.1, padGain: 0.018, bassGain: 0.19, leadVoice: 'bell', padVoice: 'choir',
    lead: [['F#5', 8], ['G5', 8], ['F#5', 4], ['E5', 4], ['D5', 8], ['B4', 8], ['C#5', 4], ['D5', 4], ['E5', 4], ['C#5', 4], ['B4', 8]],
    chords: [['B1', 'm'], ['B1', 'm'], ['G1', 'M'], ['B1', 'm'], ['B1', 'm'], ['E2', 'm'], ['F#1', 'M'], ['B1', 'm']],
    bassPattern: ['R', 'R', 'O', 'R', '5', 'R', 'O', '5'],
    drums: K([0, 4], [6], [2], { drip: [3, 7] }),
  },

  // Shipwreck Coast: a drowned sailors' lament in A harmonic minor.
  shipwreck: {
    bpm: 72, stepsPerBeat: 3, barSteps: 6, leadGain: 0.1, padGain: 0.02, bassGain: 0.14, leadVoice: 'glass', padVoice: 'choir',
    lead: [
      ['E5', 3], ['F5', 2], ['E5', 1], ['D5', 2], ['C5', 1], ['B4', 3], ['C5', 2], ['D5', 1], ['E5', 2], ['A4', 1], ['G#4', 6],
      ['A4', 2], ['C5', 1], ['E5', 3], ['F5', 2], ['E5', 1], ['D5', 2], ['C5', 1], ['B4', 2], ['C5', 1], ['D5', 2], ['B4', 1], ['A4', 6],
      ['A5', 3], ['G#5', 2], ['A5', 1], ['B5', 2], ['A5', 1], ['F5', 3], ['E5', 2], ['F5', 1], ['E5', 2], ['D5', 1], ['E5', 6],
      ['C5', 2], ['D5', 1], ['E5', 2], ['F5', 1], ['E5', 2], ['D5', 1], ['C5', 2], ['B4', 1], ['C5', 2], ['B4', 1], ['G#4', 3], ['A4', 6],
    ],
    chords: [
      ['A2', 'm'], ['A2', 'm'], ['F2', 'M'], ['E2', 'M'], ['A2', 'm'], ['D2', 'm'], ['E2', 'M'], ['A2', 'm'],
      ['F2', 'M'], ['D2', 'm'], ['A2', 'm'], ['E2', 'M'], ['F2', 'M'], ['D2', 'm'], ['E2', 'M'], ['A2', 'm'],
    ],
    bassPattern: ['R', null, null, '5', null, null],
    drums: K([0], [], [], { drip: [4] }),
  },
  shipwreck_lair: {
    volume: 0.92,
    bpm: 120, stepsPerBeat: 2, barSteps: 8, leadGain: 0.1, padGain: 0.018, bassGain: 0.2, leadVoice: 'glass', padVoice: 'choir',
    lead: [['E5', 8], ['F5', 8], ['E5', 4], ['D5', 4], ['C5', 8], ['B4', 8], ['C5', 4], ['D5', 4], ['E5', 6], ['G#4', 2], ['A4', 8]],
    chords: [['A1', 'm'], ['A1', 'm'], ['F1', 'M'], ['A1', 'm'], ['D2', 'm'], ['A1', 'm'], ['E1', 'M'], ['A1', 'm']],
    bassPattern: ['R', 'R', 'O', 'R', '5', 'R', 'O', '5'],
    drums: K([0, 3, 4], [6], [7], { tom: [2] }),
  },

  // Volcanic: E phrygian, power chords, brass and taiko.
  volcanic: {
    volume: 0.72,
    bpm: 132, stepsPerBeat: 2, barSteps: 8, leadGain: 0.08, padGain: 0.016, bassGain: 0.2, leadVoice: 'brass', padVoice: 'drone',
    lead: [
      ['E5', 2], ['F5', 2], ['E5', 4], ['G5', 2], ['F5', 1], ['E5', 1], ['D5', 4],
      ['E5', 2], ['F5', 2], ['G5', 2], ['A5', 2], ['B5', 6], [null, 2],
      ['C6', 2], ['B5', 2], ['A5', 2], ['G5', 2], ['F5', 2], ['G5', 1], ['F5', 1], ['E5', 4],
      ['D5', 2], ['E5', 2], ['F5', 2], ['D5', 2], ['E5', 6], [null, 2],
      ['E4', 2], ['E4', 1], ['F4', 1], ['G4', 4], ['A4', 2], ['G4', 1], ['F4', 1], ['E4', 4],
      ['E4', 2], ['E4', 1], ['F4', 1], ['G4', 2], ['B4', 2], ['C5', 6], [null, 2],
      ['B4', 2], ['C5', 2], ['D5', 2], ['E5', 2], ['F5', 4], ['E5', 2], ['D5', 2],
      ['C5', 2], ['B4', 2], ['A4', 2], ['F4', 2], ['E4', 6], [null, 2],
    ],
    chords: [
      ['E2', 'P'], ['E2', 'P'], ['F2', 'P'], ['E2', 'P'], ['C3', 'M'], ['D3', 'm'], ['G2', 'P'], ['E2', 'P'],
      ['E2', 'P'], ['F2', 'P'], ['E2', 'P'], ['C3', 'M'], ['G2', 'P'], ['F2', 'P'], ['D2', 'm'], ['E2', 'P'],
    ],
    bassPattern: ['R', 'R', null, 'R', 'R', null, 'O', 'R'],
    drums: K([0, 4], [4], [2, 6], { tom: [0, 3, 6] }),
  },
  volcanic_lair: {
    volume: 0.7,
    bpm: 150, stepsPerBeat: 2, barSteps: 8, leadGain: 0.08, padGain: 0.016, bassGain: 0.22, leadVoice: 'brass', padVoice: 'drone',
    lead: [['E5', 4], ['F5', 4], ['E5', 8], ['G5', 4], ['F5', 4], ['E5', 8], ['B4', 4], ['C5', 4], ['B4', 4], ['A4', 4], ['F4', 8], ['E4', 8]],
    chords: [['E1', 'P'], ['E1', 'P'], ['F1', 'P'], ['E1', 'P'], ['C2', 'P'], ['D2', 'P'], ['F1', 'P'], ['E1', 'P']],
    bassPattern: ['R', 'R', 'R', 'O', 'R', 'R', '5', 'O'],
    drums: K([0, 2, 4, 6], [4], [], { tom: [0, 3, 6, 7] }),
  },

  // Caverns: slow, echoing organ over a drone, and water dripping.
  caverns: {
    volume: 1.16,
    echo: 0.5,
    bpm: 70, stepsPerBeat: 2, barSteps: 8, leadGain: 0.07, padGain: 0.02, bassGain: 0.15, leadVoice: 'organ', padVoice: 'drone',
    lead: [
      ['D5', 8], ['F5', 4], ['E5', 4], ['C5', 6], ['D5', 2], ['A4', 8],
      [null, 4], ['A4', 2], ['Bb4', 2], ['C5', 4], ['D5', 4], ['E5', 4], ['C#5', 4], ['D5', 8],
      ['F5', 6], ['G5', 2], ['A5', 8], ['G5', 4], ['F5', 2], ['E5', 2], ['D5', 8],
      ['Bb4', 4], ['C5', 4], ['D5', 4], ['A4', 4], ['C#5', 8], [null, 8],
    ],
    chords: [
      ['D2', 'm'], ['D2', 'm'], ['A2', 'm'], ['D2', 'm'], ['Bb2', 'M'], ['C3', 'M'], ['A2', 'M'], ['D2', 'm'],
      ['D2', 'm'], ['F2', 'M'], ['C3', 'M'], ['D2', 'm'], ['Bb2', 'M'], ['G2', 'm'], ['A2', 'M'], ['D2', 'm'],
    ],
    bassPattern: ['R', null, null, null, '5', null, null, null],
    drums: K([0], [], [], { drip: [3, 6] }),
  },
  caverns_lair: {
    volume: 0.9,
    bpm: 110, stepsPerBeat: 2, barSteps: 8, leadGain: 0.075, padGain: 0.02, bassGain: 0.21, leadVoice: 'organ', padVoice: 'drone',
    lead: [['A4', 8], ['Bb4', 8], ['A4', 4], ['G4', 4], ['F4', 8], ['D5', 8], ['C#5', 8], ['E5', 4], ['C#5', 4], ['D5', 8]],
    chords: [['D1', 'm'], ['D1', 'm'], ['Bb1', 'M'], ['D1', 'm'], ['G1', 'm'], ['A1', 'M'], ['A1', 'M'], ['D1', 'm']],
    bassPattern: ['R', 'R', 'O', 'R', '5', 'R', 'O', '5'],
    drums: K([0, 3, 4], [], [], { tom: [6], drip: [2] }),
  },

  // Mangrove Bayou: a slow 12/8 blues shuffle in E — harmonica and washboard.
  mangrove: {
    bpm: 88, stepsPerBeat: 3, barSteps: 12, leadGain: 0.08, padGain: 0.013, bassGain: 0.17, leadVoice: 'reed',
    lead: [
      ['E5', 2], ['G5', 1], ['A5', 2], ['Bb5', 1], ['B5', 3], ['G5', 3], ['E5', 6], [null, 6],
      ['G5', 2], ['E5', 1], ['D5', 2], ['E5', 1], ['G5', 3], ['A5', 3], ['B5', 6], [null, 6],
      ['A5', 2], ['C6', 1], ['A5', 2], ['G5', 1], ['E5', 3], ['G5', 3], ['A5', 9], [null, 3],
      ['B5', 2], ['A5', 1], ['G5', 2], ['E5', 1], ['D5', 3], ['E5', 3], ['E5', 6], [null, 6],
      ['F#5', 3], ['A5', 3], ['B5', 3], ['D6', 3], ['C6', 3], ['A5', 3], ['G5', 3], ['E5', 3],
      ['G5', 2], ['A5', 1], ['Bb5', 2], ['B5', 1], ['D6', 3], ['B5', 3], ['E5', 9], [null, 3],
    ],
    chords: [
      ['E2', 'm'], ['E2', 'm'], ['E2', 'm'], ['E2', 'm'], ['A2', 'm'], ['A2', 'm'],
      ['E2', 'm'], ['E2', 'm'], ['B2', 'M'], ['A2', 'm'], ['E2', 'm'], ['B2', 'M'],
    ],
    bassPattern: ['R', null, '5', 'O', null, '5', 'R', null, '5', 'O', null, '5'],
    drums: K([0, 6], [3, 9], [2, 5, 8, 11]),
  },
  mangrove_lair: {
    volume: 1.05,
    bpm: 104, stepsPerBeat: 3, barSteps: 12, leadGain: 0.08, padGain: 0.013, bassGain: 0.2, leadVoice: 'reed',
    lead: [['E5', 12], ['G5', 6], ['E5', 6], ['Bb5', 12], ['B5', 12], ['A5', 6], ['G5', 6], ['E5', 12], ['D5', 6], ['B4', 6], ['E5', 12]],
    chords: [['E2', 'm'], ['E2', 'm'], ['E2', 'm'], ['E2', 'm'], ['A2', 'm'], ['E2', 'm'], ['B2', 'M'], ['E2', 'm']],
    bassPattern: ['R', null, '5', 'O', null, '5', 'R', null, '5', 'O', null, '5'],
    drums: K([0, 3, 6, 9], [3, 9], [2, 5, 8, 11]),
  },

  // Abyssal Trench: vast and slow, D lydian bells over a choir, a heartbeat.
  abyss: {
    volume: 1.67,
    echo: 0.45,
    bpm: 60, stepsPerBeat: 2, barSteps: 8, leadGain: 0.1, padGain: 0.022, bassGain: 0.14, leadVoice: 'bell', padVoice: 'choir',
    lead: [
      ['A5', 8], ['G#5', 4], ['F#5', 4], ['E5', 8], [null, 8],
      ['F#5', 4], ['A5', 4], ['C#6', 6], ['B5', 2], ['A5', 8], [null, 8],
      ['D5', 4], ['E5', 4], ['F#5', 4], ['G#5', 4], ['A5', 6], ['E5', 2], ['F#5', 8],
      ['B5', 4], ['A5', 4], ['G#5', 4], ['E5', 4], ['F#5', 8], [null, 8],
    ],
    chords: [
      ['D2', 'M'], ['E2', 'M'], ['D2', 'M'], ['B1', 'm'], ['D2', 'M'], ['F#2', 'm'], ['B1', 'm'], ['E2', 'M'],
      ['D2', 'M'], ['E2', 'M'], ['A2', 'M'], ['F#2', 'm'], ['B1', 'm'], ['E2', 'M'], ['D2', 'M'], ['D2', 'M'],
    ],
    bassPattern: ['R', null, null, null, null, null, null, null],
    drums: K([0, 1], [], [], { drip: [5] }),
  },
  abyss_lair: {
    volume: 1.2,
    bpm: 96, stepsPerBeat: 2, barSteps: 8, leadGain: 0.1, padGain: 0.022, bassGain: 0.2, leadVoice: 'bell', padVoice: 'choir',
    lead: [['A5', 8], ['G#5', 8], ['F#5', 8], ['E5', 8], ['D5', 8], ['E5', 4], ['F#5', 4], ['G#5', 8], ['A5', 8]],
    chords: [['D1', 'M'], ['E1', 'M'], ['F#1', 'm'], ['E1', 'M'], ['D1', 'M'], ['E1', 'M'], ['E1', 'M'], ['D1', 'M']],
    bassPattern: ['R', 'R', null, 'R', 'O', null, 'R', '5'],
    drums: K([0, 1, 4, 5], [], [], { drip: [3, 7] }),
  },

  // Bone Sands: D hijaz on an oud, darbuka playing maqsum, a drone beneath.
  bone_sands: {
    volume: 1.1,
    bpm: 108, stepsPerBeat: 2, barSteps: 8, leadGain: 0.11, padGain: 0.014, bassGain: 0.16, leadVoice: 'pluck', padVoice: 'drone',
    lead: [
      ['D5', 2], ['Eb5', 1], ['F#5', 1], ['G5', 2], ['F#5', 2], ['Eb5', 2], ['D5', 2], ['D5', 4],
      ['A5', 2], ['Bb5', 1], ['A5', 1], ['G5', 2], ['F#5', 2], ['G5', 4], ['F#5', 2], ['Eb5', 2],
      ['D5', 1], ['Eb5', 1], ['F#5', 1], ['G5', 1], ['A5', 2], ['Bb5', 2], ['C6', 2], ['Bb5', 1], ['A5', 1], ['Bb5', 2], ['A5', 2],
      ['G5', 2], ['F#5', 1], ['Eb5', 1], ['F#5', 2], ['Eb5', 2], ['D5', 6], [null, 2],
      ['A4', 2], ['D5', 2], ['Eb5', 2], ['D5', 2], ['C5', 2], ['Bb4', 1], ['A4', 1], ['Bb4', 4],
      ['A4', 2], ['Bb4', 1], ['C5', 1], ['D5', 2], ['Eb5', 2], ['F#5', 6], [null, 2],
      ['G5', 2], ['A5', 2], ['Bb5', 2], ['A5', 2], ['G5', 2], ['F#5', 2], ['Eb5', 2], ['F#5', 2],
      ['G5', 1], ['F#5', 1], ['Eb5', 1], ['D5', 1], ['Eb5', 2], ['C5', 2], ['D5', 6], [null, 2],
    ],
    chords: [
      ['D2', 'M'], ['D2', 'M'], ['G2', 'm'], ['D2', 'M'], ['D2', 'M'], ['C2', 'm'], ['G2', 'm'], ['D2', 'M'],
      ['D2', 'M'], ['Bb1', 'M'], ['C2', 'm'], ['D2', 'M'], ['G2', 'm'], ['C2', 'm'], ['Eb2', 'M'], ['D2', 'M'],
    ],
    bassPattern: ['R', null, null, 'R', '5', null, 'R', null],
    drums: K([0, 4], [], [7], { tak: [2, 3, 6] }),
  },
  bone_sands_lair: {
    volume: 1.1,
    bpm: 132, stepsPerBeat: 2, barSteps: 8, leadGain: 0.11, padGain: 0.014, bassGain: 0.2, leadVoice: 'pluck', padVoice: 'drone',
    lead: [['D5', 4], ['Eb5', 4], ['F#5', 8], ['G5', 4], ['F#5', 4], ['Eb5', 8], ['A5', 4], ['Bb5', 4], ['A5', 4], ['G5', 4], ['F#5', 4], ['Eb5', 4], ['D5', 8]],
    chords: [['D2', 'M'], ['D2', 'M'], ['G1', 'm'], ['D2', 'M'], ['C2', 'm'], ['G1', 'm'], ['D2', 'M'], ['D2', 'M']],
    bassPattern: ['R', 'R', null, 'R', '5', 'R', 'O', null],
    drums: K([0, 4], [], [], { tak: [2, 3, 6, 7], tom: [0] }),
  },

  // Crystal Lagoon: E lydian, arpeggiated bells and a glass lead.
  crystal: {
    volume: 1.14,
    bpm: 104, stepsPerBeat: 2, barSteps: 8, leadGain: 0.09, padGain: 0.05, bassGain: 0.14, leadVoice: 'glass', padVoice: 'arp',
    lead: [
      ['B5', 4], ['G#5', 2], ['A#5', 2], ['B5', 2], ['C#6', 2], ['D#6', 4], ['C#6', 4], ['B5', 2], ['G#5', 2], ['F#5', 8],
      ['E5', 2], ['F#5', 2], ['G#5', 2], ['B5', 2], ['A#5', 4], ['G#5', 4], ['F#5', 2], ['G#5', 2], ['E5', 4], [null, 8],
      ['G#5', 2], ['A#5', 2], ['B5', 4], ['C#6', 2], ['B5', 2], ['A#5', 2], ['F#5', 2], ['G#5', 6], ['E5', 2], ['F#5', 8],
      ['B5', 2], ['A#5', 2], ['G#5', 2], ['F#5', 2], ['E5', 2], ['F#5', 2], ['G#5', 4], ['D#5', 4], ['F#5', 4], ['E5', 8],
    ],
    chords: [
      ['E2', 'M'], ['E2', 'M'], ['C#2', 'm'], ['F#2', 'M'], ['E2', 'M'], ['F#2', 'M'], ['E2', 'M'], ['B1', 'M'],
      ['E2', 'M'], ['C#2', 'm'], ['G#2', 'm'], ['F#2', 'M'], ['E2', 'M'], ['C#2', 'm'], ['B1', 'M'], ['E2', 'M'],
    ],
    bassPattern: ['R', null, null, null, '5', null, null, null],
    drums: K([0], [], [2, 6]),
  },
  crystal_lair: {
    volume: 0.92,
    bpm: 128, stepsPerBeat: 2, barSteps: 8, leadGain: 0.09, padGain: 0.05, bassGain: 0.2, leadVoice: 'glass', padVoice: 'arp',
    lead: [['B5', 8], ['A#5', 8], ['G#5', 4], ['F#5', 4], ['E5', 8], ['C#6', 8], ['B5', 4], ['A#5', 4], ['G#5', 4], ['D#5', 4], ['E5', 8]],
    chords: [['E2', 'M'], ['F#2', 'M'], ['C#2', 'm'], ['E2', 'M'], ['F#2', 'M'], ['E2', 'M'], ['B1', 'M'], ['E2', 'M']],
    bassPattern: ['R', 'R', 'O', 'R', '5', 'R', 'O', '5'],
    drums: K([0, 3, 4], [6], [1, 3, 5, 7]),
  },
});

// Which themes each biome plays at sea and in its boss lair. Tropical keeps
// the original shanty and Kraken lair theme.
export const BIOME_MUSIC = {
  tropical: { voyage: 'voyage', lair: 'lair' },
  cliff_cove: { voyage: 'cliff_cove', lair: 'cliff_cove_lair' },
  glacial: { voyage: 'glacial', lair: 'glacial_lair' },
  shipwreck: { voyage: 'shipwreck', lair: 'shipwreck_lair' },
  volcanic: { voyage: 'volcanic', lair: 'volcanic_lair' },
  caverns: { voyage: 'caverns', lair: 'caverns_lair' },
  mangrove: { voyage: 'mangrove', lair: 'mangrove_lair' },
  abyss: { voyage: 'abyss', lair: 'abyss_lair' },
  bone_sands: { voyage: 'bone_sands', lair: 'bone_sands_lair' },
  crystal: { voyage: 'crystal', lair: 'crystal_lair' },
};

export function musicFor(biomeId, inLair) {
  const m = BIOME_MUSIC[biomeId] || BIOME_MUSIC.tropical;
  return inLair ? m.lair : m.voyage;
}
