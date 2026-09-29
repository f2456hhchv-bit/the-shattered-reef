import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_TRACKS, BIOME_MUSIC, musicFor } from '../src/data/music.mjs';
import { BIOMES } from '../src/data/biomes.mjs';

// music.mjs imports audio.mjs, which touches `document` only when defined.
const { noteToMidi, buildTimeline, LEAD_VOICE_NAMES, PAD_VOICE_NAMES } = await import('../src/audio/music.mjs');

test('note names map to MIDI', () => {
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('F#5'), 78);
  assert.equal(noteToMidi('Bb1'), 34);
  assert.throws(() => noteToMidi('H2'));
});

test('every track is well formed: whole bars, known notes, patterns fit the bar', () => {
  for (const [id, t] of Object.entries(MUSIC_TRACKS)) {
    const tl = buildTimeline(t);
    assert.equal(tl.leadLength % t.barSteps, 0, `${id}: lead is ${tl.leadLength} steps, not whole bars`);
    assert.equal(t.bassPattern.length, t.barSteps, `${id}: bass pattern length`);
    for (const [k, steps] of Object.entries(t.drums)) for (const s of steps) assert.ok(s >= 0 && s < t.barSteps, `${id}: ${k} step ${s}`);
    for (const k of Object.keys(t.drums)) assert.ok(['kick', 'snare', 'hat', 'tom', 'tak', 'drip'].includes(k), `${id}: unknown drum ${k}`);
    for (const [, q] of t.chords) assert.ok(['M', 'm', 'P'].includes(q), `${id}: chord quality ${q}`);
    assert.ok(!t.leadVoice || LEAD_VOICE_NAMES.includes(t.leadVoice), `${id}: lead voice`);
    assert.ok(!t.padVoice || PAD_VOICE_NAMES.includes(t.padVoice), `${id}: pad voice`);
    for (const n of tl.lead) assert.ok(n.midi >= 55 && n.midi <= 90, `${id}: lead note ${n.midi} out of whistle range`);
  }
});

test('every biome has its own sea theme and lair theme', () => {
  const seen = new Set();
  for (const id of Object.keys(BIOMES)) {
    const m = BIOME_MUSIC[id];
    assert.ok(m && MUSIC_TRACKS[m.voyage] && MUSIC_TRACKS[m.lair], id);
    assert.equal(musicFor(id, false), m.voyage); assert.equal(musicFor(id, true), m.lair);
    assert.ok(!seen.has(m.voyage) && !seen.has(m.lair), `${id} shares a theme`);
    seen.add(m.voyage); seen.add(m.lair);
  }
  assert.equal(musicFor('nowhere', false), 'voyage');
});

test('a lair theme is faster than its biome sea theme', () => {
  for (const [id, m] of Object.entries(BIOME_MUSIC)) assert.ok(MUSIC_TRACKS[m.lair].bpm > MUSIC_TRACKS[m.voyage].bpm, id);
});
