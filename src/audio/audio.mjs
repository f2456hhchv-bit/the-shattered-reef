// Audio hooks — step 8. The vertical slice's scope is explicitly "audio
// hooks", not a full sound-asset pipeline (CLAUDE.md's locked scope: "audio
// beyond hooks" is out of scope), so this is a small, dependency-free
// synthesizer (WebAudio oscillators/noise bursts) rather than loaded sample
// files — it needs no asset pipeline, adds nothing to deploy, and gives
// every gameplay event a real, distinct sound *now*. Swapping in real
// sampled SFX later only means changing what each cue function does
// internally; every call site in main.mjs stays the same.
//
// Like renderer.mjs/joystick.mjs, this is DOM/browser-API-coupled and not
// meaningfully unit-testable (no WebAudio in `node --test`'s Node runtime)
// — verified by ear in real headless-browser playtesting instead, same as
// the rendering glue.

// Browsers require a user gesture before an AudioContext can produce sound,
// so it's created lazily on first call rather than at module load — calling
// any cue function before that gesture is a harmless no-op, not an error.
let ctx = null;
let unlocked = false;

function getCtx() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null; // no WebAudio support — every cue below no-ops
  ctx = new AudioContextClass();
  return ctx;
}

// Call once, from the first real user gesture (e.g. the fire button's own
// pointerdown) — resumes a context a browser created in "suspended" state.
export function unlockAudio() {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  unlocked = true;
}

let masterMuted = false;
export function setMuted(muted) {
  masterMuted = muted;
}
export function isMuted() {
  return masterMuted;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

// A single short tone with a percussive volume envelope — the building
// block for every beep-like cue (fire, pickups, UI).
function tone(freq, { duration = 0.12, type = 'sine', gain = 0.18, glideTo = null } = {}) {
  if (masterMuted) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now());
  if (glideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), now() + duration);
  amp.gain.setValueAtTime(0, now());
  amp.gain.linearRampToValueAtTime(gain, now() + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, now() + duration);
  osc.connect(amp).connect(c.destination);
  osc.start();
  osc.stop(now() + duration + 0.02);
}

// A short burst of filtered white noise — for splashy/explosive/impact
// cues a pure tone can't sell (wall hits, blasts, sinking).
function noiseBurst({ duration = 0.18, gain = 0.22, filterFreq = 900, filterType = 'lowpass' } = {}) {
  if (masterMuted) return;
  const c = getCtx();
  if (!c) return;
  const bufferSize = Math.max(1, Math.round(c.sampleRate * duration));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const amp = c.createGain();
  amp.gain.setValueAtTime(gain, now());
  amp.gain.exponentialRampToValueAtTime(0.0001, now() + duration);

  src.connect(filter).connect(amp).connect(c.destination);
  src.start();
  src.stop(now() + duration + 0.02);
}

// --- Named cues — one call site each in main.mjs, so a future real-SFX
// swap only touches this file. ---------------------------------------------

const WEAPON_FIRE_TONE = {
  cannonballs: { freq: 160, type: 'square', duration: 0.1, gain: 0.14 },
  chain_shot: { freq: 320, type: 'square', duration: 0.08, gain: 0.12 },
  grapeshot: { freq: 260, type: 'sawtooth', duration: 0.07, gain: 0.1 },
  depth_charges: { freq: 110, type: 'sine', duration: 0.16, gain: 0.16, glideTo: 60 },
  flame_barrels: { freq: 200, type: 'sawtooth', duration: 0.12, gain: 0.13, glideTo: 140 },
};

export function playFire(weaponId) {
  const preset = WEAPON_FIRE_TONE[weaponId] || WEAPON_FIRE_TONE.cannonballs;
  tone(preset.freq, preset);
}

export function playHit() {
  tone(180, { duration: 0.07, type: 'square', gain: 0.12, glideTo: 90 });
}

export function playKill() {
  tone(420, { duration: 0.09, type: 'square', gain: 0.16, glideTo: 700 });
  tone(220, { duration: 0.18, type: 'sine', gain: 0.14, glideTo: 90 });
}

export function playExplosion() {
  noiseBurst({ duration: 0.28, gain: 0.28, filterFreq: 500 });
  tone(90, { duration: 0.22, type: 'sine', gain: 0.15, glideTo: 40 });
}

// `intensity` in [0,1] — a graze near the damage threshold barely registers,
// a hard ram sounds like one.
export function playWallImpact(intensity) {
  noiseBurst({ duration: 0.12 + intensity * 0.1, gain: 0.12 + intensity * 0.2, filterFreq: 300 + intensity * 400 });
}

export function playPickupWeapon() {
  tone(520, { duration: 0.09, type: 'triangle', gain: 0.15, glideTo: 780 });
}

export function playPickupSalvage() {
  tone(700, { duration: 0.06, type: 'sine', gain: 0.12, glideTo: 900 });
}

export function playReefCleared() {
  tone(440, { duration: 0.14, type: 'triangle', gain: 0.16, glideTo: 660 });
  setTimeout(() => tone(660, { duration: 0.18, type: 'triangle', gain: 0.16, glideTo: 880 }), 90);
}

export function playVictory() {
  const notes = [440, 554, 659, 880];
  notes.forEach((f, i) => setTimeout(() => tone(f, { duration: 0.22, type: 'triangle', gain: 0.18 }), i * 110));
}

export function playSunk() {
  noiseBurst({ duration: 0.5, gain: 0.22, filterFreq: 260 });
  tone(160, { duration: 0.6, type: 'sine', gain: 0.14, glideTo: 40 });
}

export function playRevive() {
  tone(300, { duration: 0.14, type: 'triangle', gain: 0.16, glideTo: 520 });
}

export function playLockedWeapon() {
  tone(140, { duration: 0.06, type: 'square', gain: 0.08 });
}
