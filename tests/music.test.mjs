import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_TRACKS } from '../src/data/music.mjs';

// music.mjs imports audio.mjs, which touches `document` only when defined.
const { noteToMidi, buildTimeline } = await import('../src/audio/music.mjs');

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
    for (const k of ['kick', 'snare', 'hat']) for (const s of t.drums[k]) assert.ok(s >= 0 && s < t.barSteps, `${id}: ${k} step ${s}`);
    for (const n of tl.lead) assert.ok(n.midi >= 55 && n.midi <= 90, `${id}: lead note ${n.midi} out of whistle range`);
  }
});
