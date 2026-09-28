// Music player (2026-09-28): a lookahead step sequencer over Web Audio,
// playing the tracks in data/music.mjs with a few synthesised voices
// (whistle lead, accordion pad, plucked bass, kick / hand drum / shaker).
// No sample files: nothing to download, nothing to deploy.
//
// Browser-coupled like audio.mjs, so it's verified by playtest, not
// node --test. `noteToMidi` and `buildTimeline` are pure and tested.

import { MUSIC_TRACKS } from '../data/music.mjs';
import { audioGraph, onAudioUnlock, isMuted } from './audio.mjs';

const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function noteToMidi(name) {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return 12 * (Number(m[2]) + 1) + NOTE_INDEX[m[1]];
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Flattens a track into per-part step lists (each part loops on its own).
export function buildTimeline(track) {
  const lead = [];
  let step = 0;
  for (const [note, len] of track.lead) {
    if (note) lead.push({ step, midi: noteToMidi(note), len });
    step += len;
  }
  const chords = track.chords.map(([root, q]) => {
    const r = noteToMidi(root);
    return { root: r, notes: [r, r + (q === 'm' ? 3 : 4), r + 7] };
  });
  return { lead, leadLength: step, chords, chordLength: chords.length * track.barSteps };
}

let current = null; // { id, track, timeline, gain, step, nextTime }
let fading = [];
let wanted = null;
let timer = null;
let noiseBuf = null;

function noise(ctx) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function envGain(ctx, dest, t, peak, attack, hold, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak * 0.75, t + attack + Math.max(0, hold));
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + Math.max(0, hold) + release);
  g.connect(dest);
  return g;
}

function voiceLead(ctx, dest, t, midi, dur, gain) {
  const g = envGain(ctx, dest, t, gain, 0.02, dur * 0.8, 0.14);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(midi);
  const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
  const vibAmt = ctx.createGain(); vibAmt.gain.setValueAtTime(0, t); vibAmt.gain.linearRampToValueAtTime(hz(midi) * 0.006, t + 0.25);
  vib.connect(vibAmt).connect(o.frequency);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(midi + 12);
  const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2).connect(g);
  o.connect(g);
  const end = t + dur + 0.2;
  for (const x of [o, o2, vib]) { x.start(t); x.stop(end); }
}

function voicePad(ctx, dest, t, notes, dur, gain) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
  const g = envGain(ctx, lp, t, gain, 0.25, dur - 0.35, 0.4);
  lp.connect(dest);
  for (const n of notes) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n + 12); o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 0.5);
    }
  }
}

function voiceBass(ctx, dest, t, midi, gain) {
  const g = envGain(ctx, dest, t, gain, 0.008, 0.05, 0.35);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(midi);
  const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = hz(midi);
  o.connect(g); s.connect(g);
  o.start(t); s.start(t); o.stop(t + 0.5); s.stop(t + 0.5);
}

function voiceKick(ctx, dest, t) {
  const g = envGain(ctx, dest, t, 0.45, 0.004, 0.02, 0.16);
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  o.connect(g); o.start(t); o.stop(t + 0.25);
}

function voiceNoise(ctx, dest, t, { type, freq, gain, len }) {
  const src = ctx.createBufferSource(); src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.9;
  const g = envGain(ctx, dest, t, gain, 0.003, 0.005, len);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.5); src.stop(t + len + 0.05);
}

function scheduleStep(ctx, m, t, stepDur) {
  const { track, timeline, gain, leadBus } = m;
  const s = m.step;
  const inBar = s % track.barSteps;
  // Lead
  const ls = s % timeline.leadLength;
  for (const n of timeline.lead) if (n.step === ls) voiceLead(ctx, leadBus, t, n.midi, n.len * stepDur, track.leadGain);
  // Chord pad + bass
  const chord = timeline.chords[Math.floor((s % timeline.chordLength) / track.barSteps)];
  if (inBar === 0) voicePad(ctx, gain, t, chord.notes, track.barSteps * stepDur, track.padGain);
  const b = track.bassPattern[inBar];
  if (b) voiceBass(ctx, gain, t, chord.root + (b === '5' ? 7 : b === 'O' ? 12 : 0) - 12, track.bassGain);
  // Drums
  if (track.drums.kick.includes(inBar)) voiceKick(ctx, gain, t);
  if (track.drums.snare.includes(inBar)) voiceNoise(ctx, gain, t, { type: 'bandpass', freq: 1400, gain: 0.16, len: 0.12 });
  if (track.drums.hat.includes(inBar)) voiceNoise(ctx, gain, t, { type: 'highpass', freq: 6500, gain: 0.035, len: 0.04 });
}

function tick() {
  const g = audioGraph();
  if (!g) return;
  const { ctx } = g;
  if (wanted && (!current || current.id !== wanted)) start(ctx, g.musicBus, wanted);
  if (!wanted && current) fadeOut(ctx);
  fading = fading.filter((f) => ctx.currentTime < f.until);
  if (!current) return;
  const stepDur = 60 / current.track.bpm / current.track.stepsPerBeat;
  if (current.nextTime < ctx.currentTime - 0.5) current.nextTime = ctx.currentTime + 0.05; // resumed after a pause
  while (current.nextTime < ctx.currentTime + 0.2) {
    if (!isMuted()) scheduleStep(ctx, current, current.nextTime, stepDur);
    current.nextTime += stepDur;
    current.step++;
  }
}

function start(ctx, bus, id) {
  const track = MUSIC_TRACKS[id];
  if (!track) { wanted = null; return; }
  if (current) fadeOut(ctx);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
  gain.connect(bus);
  // A soft echo on the lead only: space without mud.
  const leadBus = ctx.createGain(); leadBus.connect(gain);
  const delay = ctx.createDelay(1); delay.delayTime.value = (60 / track.bpm) * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  leadBus.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(gain);
  current = { id, track, timeline: buildTimeline(track), gain, leadBus, step: 0, nextTime: ctx.currentTime + 0.1 };
}

function fadeOut(ctx) {
  if (!current) return;
  const g = current.gain;
  g.gain.cancelScheduledValues(ctx.currentTime);
  g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
  setTimeout(() => { try { g.disconnect(); } catch { /* already gone */ } }, 1800);
  fading.push({ until: ctx.currentTime + 1.2 });
  current = null;
}

// Asks for a track by id (or null for silence). Safe before the first
// gesture: it starts as soon as audio unlocks.
export function playMusic(id) {
  wanted = id;
  if (!timer) timer = setInterval(tick, 40);
  tick();
}
export function currentMusic() { return current ? current.id : null; }

onAudioUnlock(() => tick());
