// Music (2026-09-28): original shanty-style themes, played by the small
// synthesiser in audio/music.mjs. Data only: a new track is a new entry.
//
// Timing is in steps (eighth notes). `lead` is a flat [note, steps] list
// (null = rest). `chords` is one [root, quality] per bar; the pad plays the
// triad and the bass follows `bassPattern` (R root, 5 fifth, O octave).
// Drums list the steps within a bar each voice hits.

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
