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
let master = null; // everything → master → destination (mute = master 0)
let sfxBus = null;
let analyser = null;
let musicBus = null;

function getCtx() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null; // no WebAudio support — every cue below no-ops
  ctx = new AudioContextClass();
  master = ctx.createGain(); master.gain.value = masterMuted ? 0 : 1; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
  return ctx;
}

// Testing/diagnostics: current output level (RMS and peak, 0..1).
export function audioLevel() {
  // The analyser is only created when asked for (tests): running one all
  // the time cost the audio thread for nothing.
  if (ctx && !analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser); }
  if (!analyser) return { state: ctx ? ctx.state : 'none', rms: 0, peak: 0 };
  const buf = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(buf);
  let sum = 0, peak = 0; for (const v of buf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
  return { state: ctx.state, rms: Math.sqrt(sum / buf.length), peak };
}

// For music.mjs: the shared context and its bus (null until unlocked).
export function audioGraph() {
  return ctx && unlockedRunning() ? { ctx, musicBus } : null;
}
function unlockedRunning() { return ctx && ctx.state === 'running'; }

// iPhones silence Web Audio when the ring/silent switch is on, which is
// why "I can't hear anything" on iOS. Two fixes: the Audio Session API
// (Safari 17+) declares us a playback app, and on older iOS a looping,
// silent <audio> element flips the page into the playback category.
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
let silentEl = null;
function enablePlaybackSession() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
  if (silentEl) return;
  try {
    silentEl = document.createElement('audio');
    silentEl.src = SILENT_WAV; silentEl.loop = true; silentEl.setAttribute('playsinline', '');
    silentEl.volume = 0.01;
    const p = silentEl.play(); if (p && p.catch) p.catch(() => {});
  } catch { /* ignore */ }
}

// Call from real user gestures. Safe to call repeatedly: iOS sometimes
// needs a second gesture, and a context suspended in the background has
// to be resumed again on return.
export function unlockAudio() {
  // Already running: nothing to do. (It used to redo the whole unlock on
  // every touch, all game long — a small hitch on each joystick release.)
  if (ctx && ctx.state === 'running' && unlockedOnce) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'running') unlockedOnce = true;
  enablePlaybackSession();
  if (c.state !== 'running') { const p = c.resume(); if (p && p.catch) p.catch(() => {}); }
  // A one-sample silent buffer: the documented way to fully unlock iOS.
  try { const b = c.createBuffer(1, 1, 22050); const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); } catch { /* ignore */ }
  onUnlockCallbacks.forEach((fn) => fn());
}
let unlockedOnce = false;
const onUnlockCallbacks = [];
export function onAudioUnlock(fn) { onUnlockCallbacks.push(fn); }

// Battery: stop the audio clock while the page is hidden.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

let masterMuted = false;
export function setMuted(muted) {
  masterMuted = muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
}
export function isMuted() {
  return masterMuted;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

// A single short tone with a percussive volume envelope — the building
// block for every beep-like cue (fire, pickups, UI).
function tone(freq, { duration = 0.12, type = 'sine', gain = 0.18, glideTo = null, delay = 0 } = {}) {
  if (masterMuted) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  const t0 = now() + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + duration);
  amp.gain.setValueAtTime(0, now());
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(sfxBus);
  osc.start(now());
  osc.stop(t0 + duration + 0.02);
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

  src.connect(filter).connect(amp).connect(sfxBus);
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
  // Armaments (2026-09-29): quieter, so a busy kit doesn't drown the guns.
  arm_swivel: { freq: 520, type: 'square', duration: 0.04, gain: 0.05 },
  arm_harpoon: { freq: 700, type: 'triangle', duration: 0.14, gain: 0.08, glideTo: 240 },
  arm_mortar: { freq: 90, type: 'sine', duration: 0.22, gain: 0.14, glideTo: 50 },
  arm_keg: { freq: 150, type: 'triangle', duration: 0.08, gain: 0.06 },
  arm_stern: { freq: 190, type: 'square', duration: 0.08, gain: 0.08 },
  arm_broadside: { freq: 130, type: 'square', duration: 0.16, gain: 0.14, glideTo: 80 },
};

// Thunder: a crack, then a long low roll.
export function playThunder() {
  noiseBurst({ duration: 0.12, gain: 0.3, filterFreq: 2500 });
  noiseBurst({ duration: 1.1, gain: 0.22, filterFreq: 260 });
}

// A lightning mark appearing: a rising electric hum, 3s before it hits.
export function playStrikeMark() {
  tone(90, { duration: 0.6, type: 'sawtooth', gain: 0.035, glideTo: 180 });
}

// A weather event rolling in.
export function playWeatherWarning() {
  tone(220, { duration: 0.5, type: 'sine', gain: 0.08, glideTo: 180 });
  tone(330, { duration: 0.5, type: 'sine', gain: 0.05, glideTo: 270, delay: 0.12 });
}

// Opening a treasure chest: a bright rising arpeggio.
export function playTreasure() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, { duration: 0.16, type: 'triangle', gain: 0.1, delay: i * 0.07 }));
}

// A shot glancing off a boss's ward.
export function playWardClink() {
  tone(1400, { duration: 0.05, type: 'sine', gain: 0.05, glideTo: 1900 });
}

// St Elmo's Fire arcing.
export function playZap() {
  noiseBurst({ duration: 0.06, gain: 0.06, filterFreq: 3000 });
}

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

// A dedicated boss-only phase-swap cue, distinct from every other tone
// here — the whole point of the boss fight is "notice your weapon just
// stopped working and swap," so this needs to be unmistakable on a phone
// speaker mid-combat, not just another hit-adjacent blip.
export function playBossPhaseChange() {
  tone(520, { duration: 0.2, type: 'sawtooth', gain: 0.18, glideTo: 180 });
  tone(240, { duration: 0.32, type: 'sine', gain: 0.15, glideTo: 480 });
}

// A short fanfare on top of the regular kill cue — a 220-HP boss with a
// mid-fight phase mechanic earns a bigger "you actually won that" moment
// than a Reef Skimmer dying does.
export function playBossDefeated() {
  const notes = [220, 330, 440, 660, 880];
  notes.forEach((freq, i) => setTimeout(
    () => tone(freq, { duration: 0.26, type: 'sawtooth', gain: 0.2, glideTo: freq * 1.3 }),
    i * 90,
  ));
  setTimeout(() => noiseBurst({ duration: 0.4, gain: 0.25, filterFreq: 400 }), 260);
}

// An enemy cannon going off: deeper and duller than yours, so you can tell
// incoming fire from your own by ear.
export function playEnemyFire() {
  tone(95, { duration: 0.16, type: 'triangle', gain: 0.12, glideTo: 55 });
  noiseBurst({ duration: 0.12, gain: 0.09, filterFreq: 420 });
}
