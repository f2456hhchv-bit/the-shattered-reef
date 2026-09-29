// Voyage save/resume (2026-09-29, project owner: "would be good to be able
// to leave, but when you return it's a finish-where-you-left-off thing").
//
// The whole run is saved mid-level — boat, hull, statuses, every enemy's
// position and health, what's been collected, your kit and upgrades — but
// not what can be rebuilt: a level's layout and coast are a pure function
// of its seed (engine/run.mjs buildLevelWorld), so they're regenerated on
// load. Shots in flight and the current weather event are dropped (the sky
// starts fresh). Pure: storage is injected, like engine/meta.mjs.

import { buildLevelWorld } from './run.mjs';
import { createWeather } from './weather.mjs';
import { ensureEnemyIdsAbove } from './enemies.mjs';

export const VOYAGE_STORAGE_KEY = 'shatteredReef.voyage.v1';
const VERSION = 1;
// Rebuilt from the level seed, or transient: never written.
const SKIP = new Set(['grid', 'coast', 'maze', 'lair', 'weather', 'enemyProjectiles', 'projectiles']);

function pack(value, depth = 0) {
  if (value instanceof Set) return { __set: [...value].map((v) => pack(v, depth + 1)) };
  if (Array.isArray(value)) return value.map((v) => pack(v, depth + 1));
  if (value && typeof value === 'object') {
    if (ArrayBuffer.isView(value)) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (depth <= 1 && SKIP.has(k)) continue;
      if (typeof v === 'function') continue;
      const p = pack(v, depth + 1);
      if (p !== undefined) out[k] = p;
    }
    return out;
  }
  return value;
}

function unpack(value) {
  if (Array.isArray(value)) return value.map(unpack);
  if (value && typeof value === 'object') {
    if (Array.isArray(value.__set)) return new Set(value.__set.map(unpack));
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = unpack(v);
    return out;
  }
  return value;
}

// A plain JSON-safe snapshot of a run.
export function serializeRun(run) {
  return { v: VERSION, savedAt: Date.now(), run: pack(run) };
}

// Rebuilds a playable run from serializeRun's output. Throws on a save it
// can't use (the caller treats that as "no save").
export function deserializeRun(data) {
  if (!data || data.v !== VERSION || !data.run?.level || !data.run?.boat) throw new Error('bad save');
  const run = unpack(data.run);
  const world = buildLevelWorld(run.level);
  run.maze = world.maze;
  run.lair = world.lair || null;
  run.grid = world.grid;
  run.coast = world.coast;
  run.coastSeed = world.coastSeed;
  run.tileSize = world.tileSize;
  run.exitWorld = world.exitWorld;
  run.widthPx = world.widthPx;
  run.heightPx = world.heightPx;
  run.enemyProjectiles = [];
  run.weapons.projectiles = [];
  run.weapons.cooldownRemaining = 0;
  run.weather = createWeather(run.level.biomeId);
  if (!(run.weapons.heldWeapons instanceof Set)) run.weapons.heldWeapons = new Set(run.weapons.heldWeapons || ['cannonballs']);
  ensureEnemyIdsAbove(Math.max(0, ...run.enemies.map((e) => e.id || 0)));
  return run;
}

export function saveVoyage(storage, run, extra = {}) {
  try {
    storage.setItem(VOYAGE_STORAGE_KEY, JSON.stringify({ ...serializeRun(run), ...extra }));
    return true;
  } catch {
    return false; // storage full or disabled: the game plays on
  }
}

// The saved voyage (run rebuilt, plus any extra fields saved with it), or
// null — never throws, whatever is in storage.
export function loadVoyage(storage) {
  try {
    const raw = storage.getItem(VOYAGE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { ...data, run: deserializeRun(data) };
  } catch {
    return null;
  }
}

// Just the summary, without rebuilding the level (for the harbour button).
export function peekVoyage(storage) {
  try {
    const data = JSON.parse(storage.getItem(VOYAGE_STORAGE_KEY) || 'null');
    if (!data || data.v !== VERSION || !data.run?.level) return null;
    return { stage: data.run.stage, reefIndex: data.run.reefIndex, reefCount: data.run.reefCount, savedAt: data.savedAt, over: !!data.run.over };
  } catch {
    return null;
  }
}

export function clearVoyage(storage) {
  try { storage.removeItem(VOYAGE_STORAGE_KEY); } catch { /* nothing to clear */ }
}
