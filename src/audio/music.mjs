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
    const notes = q === 'P' ? [r, r + 7, r + 12] : [r, r + (q === 'm' ? 3 : 4), r + 7];
    return { root: r, notes };
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

// ---- Biome instruments (2026-09-29). Each is a few oscillators and an
// envelope; the character comes from waveform, filter and decay.
function voiceBell(ctx, dest, t, midi, dur, gain) {
  // Struck metal: a sine plus an inharmonic partial, fast decay, long ring.
  const g = envGain(ctx, dest, t, gain, 0.004, 0.02, Math.min(2.2, 0.6 + dur));
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(midi);
  const p = ctx.createOscillator(); p.type = 'sine'; p.frequency.value = hz(midi) * 2.76;
  const pg = ctx.createGain(); pg.gain.setValueAtTime(0.35, t); pg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g); p.connect(pg).connect(g);
  const end = t + dur + 2.4; o.start(t); p.start(t); o.stop(end); p.stop(t + 0.5);
}
function voiceGlass(ctx, dest, t, midi, dur, gain) {
  // Glass harmonica: soft attack, slow wide vibrato, a quiet fifth above.
  const g = envGain(ctx, dest, t, gain, 0.12, dur * 0.7, 0.5);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(midi);
  const f = ctx.createOscillator(); f.type = 'sine'; f.frequency.value = hz(midi + 19);
  const fg = ctx.createGain(); fg.gain.value = 0.12;
  const vib = ctx.createOscillator(); vib.frequency.value = 3.2;
  const va = ctx.createGain(); va.gain.value = hz(midi) * 0.01;
  vib.connect(va).connect(o.frequency);
  o.connect(g); f.connect(fg).connect(g);
  const end = t + dur + 0.7; for (const x of [o, f, vib]) { x.start(t); x.stop(end); }
}
function voiceBrass(ctx, dest, t, midi, dur, gain) {
  // A horn: sawtooth through a filter that opens as the note speaks.
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
  lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2400, t + 0.08); lp.frequency.linearRampToValueAtTime(1300, t + 0.3);
  const g = envGain(ctx, dest, t, gain, 0.03, dur * 0.85, 0.12);
  lp.connect(g);
  for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(midi); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.2); }
}
function voiceReed(ctx, dest, t, midi, dur, gain) {
  // Harmonica: a square wave through a nasal band-pass, with a bend up.
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz(midi) * 2.2; bp.Q.value = 1.2;
  const g = envGain(ctx, dest, t, gain, 0.03, dur * 0.8, 0.12);
  bp.connect(g);
  const o = ctx.createOscillator(); o.type = 'square';
  o.frequency.setValueAtTime(hz(midi - 1), t); o.frequency.linearRampToValueAtTime(hz(midi), t + 0.07);
  const vib = ctx.createOscillator(); vib.frequency.value = 6;
  const va = ctx.createGain(); va.gain.setValueAtTime(0, t); va.gain.linearRampToValueAtTime(hz(midi) * 0.01, t + 0.3);
  vib.connect(va).connect(o.frequency);
  o.connect(bp);
  const end = t + dur + 0.2; o.start(t); vib.start(t); o.stop(end); vib.stop(end);
}
function voicePluck(ctx, dest, t, midi, dur, gain) {
  // Oud: a bright pluck that decays fast, with a sympathetic octave.
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.35);
  const g = envGain(ctx, dest, t, gain, 0.003, 0.02, Math.min(0.9, 0.25 + dur * 0.5));
  lp.connect(g);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(midi);
  const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = hz(midi + 12);
  const g2 = ctx.createGain(); g2.gain.value = 0.3;
  o.connect(lp); o2.connect(g2).connect(lp);
  const end = t + dur + 1; o.start(t); o2.start(t); o.stop(end); o2.stop(end);
}
function voiceOrgan(ctx, dest, t, midi, dur, gain) {
  // A cave organ: drawbar sines (fundamental, octave, twelfth), no vibrato.
  const g = envGain(ctx, dest, t, gain, 0.06, dur * 0.9, 0.4);
  for (const [iv, k] of [[0, 1], [12, 0.5], [19, 0.3], [-12, 0.4]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(midi + iv);
    const og = ctx.createGain(); og.gain.value = k; o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.5);
  }
}
const LEAD_VOICES = { whistle: voiceLead, bell: voiceBell, glass: voiceGlass, brass: voiceBrass, reed: voiceReed, pluck: voicePluck, organ: voiceOrgan };
export const LEAD_VOICE_NAMES = Object.keys(LEAD_VOICES);
export const PAD_VOICE_NAMES = ['accordion', 'choir', 'drone', 'arp'];

function voiceChoir(ctx, dest, t, notes, dur, gain) {
  // "Ooh" voices: detuned triangles through a soft low-pass, slow swell.
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
  const g = envGain(ctx, lp, t, gain, Math.min(0.8, dur * 0.3), dur * 0.5, 0.8);
  lp.connect(dest);
  for (const n of notes) for (const det of [-9, 0, 9]) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(n + 12); o.detune.value = det;
    o.connect(g); o.start(t); o.stop(t + dur + 1);
  }
}
function voiceDrone(ctx, dest, t, notes, dur, gain) {
  // Root and fifth only, dark and slowly breathing.
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
  lp.frequency.setValueAtTime(350, t); lp.frequency.linearRampToValueAtTime(700, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(350, t + dur);
  const g = envGain(ctx, lp, t, gain * 1.2, 0.3, dur - 0.4, 0.5);
  lp.connect(dest);
  for (const n of [notes[0], notes[0] + 7]) for (const det of [-5, 5]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n + 12); o.detune.value = det;
    o.connect(g); o.start(t); o.stop(t + dur + 0.6);
  }
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

function voiceTom(ctx, dest, t) {
  // Taiko: a big low drum with a long body and a slap of noise.
  const g = envGain(ctx, dest, t, 0.4, 0.004, 0.04, 0.45);
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
  o.connect(g); o.start(t); o.stop(t + 0.55);
  voiceNoise(ctx, dest, t, { type: 'lowpass', freq: 900, gain: 0.12, len: 0.08 });
}
function voiceDrip(ctx, dest, t) {
  // A water drop: a high sine that bends up and dies.
  const g = envGain(ctx, dest, t, 0.05, 0.002, 0.01, 0.18);
  const o = ctx.createOscillator(); o.type = 'sine';
  const f = 1100 + Math.random() * 900;
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.06);
  o.connect(g); o.start(t); o.stop(t + 0.25);
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
  const lead = LEAD_VOICES[track.leadVoice] || voiceLead;
  for (const n of timeline.lead) if (n.step === ls) lead(ctx, leadBus, t, n.midi, n.len * stepDur, track.leadGain);
  // Chord pad + bass
  const chord = timeline.chords[Math.floor((s % timeline.chordLength) / track.barSteps)];
  const pad = track.padVoice || 'accordion';
  if (pad === 'arp') {
    // Arpeggiated bells, up and down the chord two octaves up.
    const seq = [0, 1, 2, 1];
    voiceBell(ctx, gain, t, chord.notes[seq[inBar % 4]] + 24 + (inBar % 8 >= 4 ? 12 : 0), stepDur, track.padGain);
  } else if (inBar === 0) {
    const fn = pad === 'choir' ? voiceChoir : pad === 'drone' ? voiceDrone : voicePad;
    fn(ctx, gain, t, chord.notes, track.barSteps * stepDur, track.padGain);
  }
  const b = track.bassPattern[inBar];
  if (b) {
    let bm = chord.root + (b === '5' ? 7 : b === 'O' ? 12 : 0) - 12;
    while (bm < 36) bm += 12; // keep the bass where a phone speaker can play it
    voiceBass(ctx, gain, t, bm, track.bassGain);
  }
  // Drums
  if (track.drums.kick.includes(inBar)) voiceKick(ctx, gain, t);
  if (track.drums.snare.includes(inBar)) voiceNoise(ctx, gain, t, { type: 'bandpass', freq: 1400, gain: 0.16, len: 0.12 });
  if (track.drums.hat.includes(inBar)) voiceNoise(ctx, gain, t, { type: 'highpass', freq: 6500, gain: 0.035, len: 0.04 });
  if (track.drums.tom?.includes(inBar)) voiceTom(ctx, gain, t);
  if (track.drums.tak?.includes(inBar)) voiceNoise(ctx, gain, t, { type: 'bandpass', freq: 2600, gain: 0.14, len: 0.05 });
  if (track.drums.drip?.includes(inBar)) voiceDrip(ctx, gain, t);
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
  const { gain, leadBus } = trackChain(ctx, bus, track, 1.2);
  current = { id, track, timeline: buildTimeline(track), gain, leadBus, step: 0, nextTime: ctx.currentTime + 0.1 };
}

function trackChain(ctx, bus, track, fadeIn) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(track.volume ?? 1, ctx.currentTime + fadeIn);
  gain.connect(bus);
  // A soft echo on the lead only: space without mud (more in the caves).
  const leadBus = ctx.createGain(); leadBus.connect(gain);
  const delay = ctx.createDelay(1); delay.delayTime.value = (60 / track.bpm) * 0.75;
  const fb = ctx.createGain(); fb.gain.value = track.echo ?? 0.28;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  leadBus.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(gain);
  return { gain, leadBus };
}

// Renders `seconds` of a track into any context (an OfflineAudioContext
// for previews and loudness checks). Returns the number of steps scheduled.
export function scheduleTrack(ctx, dest, id, seconds) {
  const track = MUSIC_TRACKS[id];
  const { gain, leadBus } = trackChain(ctx, dest, track, 0.05);
  const m = { track, timeline: buildTimeline(track), gain, leadBus, step: 0 };
  const stepDur = 60 / track.bpm / track.stepsPerBeat;
  let t = 0.05;
  while (t < seconds) { scheduleStep(ctx, m, t, stepDur); t += stepDur; m.step++; }
  return m.step;
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
