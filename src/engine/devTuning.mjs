// Dev tuning (2026-10-06, project owner: "a proper game development tool"
// to scale enemies, strength, health etc. while playtesting). One live
// object of multipliers, all 1 by default, read by the survival rules at
// the moment they apply, so a slider takes effect straight away. Saved to
// localStorage (main.mjs passes the storage) so a tuned setup survives a
// reload. Pure: no DOM here; the panel is ui/devPanel.mjs.

export const DEV_STORAGE_KEY = 'shatteredReef.dev.v1';

// Every slider: key, label, group, range, and when it bites.
export const DEV_SLIDERS = Object.freeze([
  { key: 'enemyCount', group: 'Enemies', label: 'How many afloat', min: 0.1, max: 4, step: 0.05, live: true },
  { key: 'spawnRate', group: 'Enemies', label: 'Spawn speed', min: 0.1, max: 4, step: 0.05, live: true },
  { key: 'enemyHealth', group: 'Enemies', label: 'Health', min: 0.1, max: 5, step: 0.05 },
  { key: 'enemyDamage', group: 'Enemies', label: 'Damage', min: 0, max: 5, step: 0.05 },
  { key: 'enemySpeed', group: 'Enemies', label: 'Speed', min: 0.25, max: 3, step: 0.05 },
  { key: 'bossHealth', group: 'Enemies', label: 'Boss & warlord health', min: 0.1, max: 5, step: 0.05 },
  { key: 'playerDamage', group: 'Your ship', label: 'Damage', min: 0.1, max: 10, step: 0.1, live: true },
  { key: 'fireRate', group: 'Your ship', label: 'Fire rate', min: 0.25, max: 5, step: 0.05, live: true },
  { key: 'playerHull', group: 'Your ship', label: 'Max hull', min: 0.25, max: 10, step: 0.25, live: true },
  { key: 'playerSpeed', group: 'Your ship', label: 'Speed', min: 0.5, max: 3, step: 0.05, live: true },
  { key: 'pickup', group: 'Your ship', label: 'Pickup reach', min: 0.5, max: 10, step: 0.25, live: true },
  { key: 'xp', group: 'Level', label: 'XP gain', min: 0.1, max: 10, step: 0.1, live: true },
  { key: 'salvage', group: 'Level', label: 'Salvage gain', min: 0, max: 10, step: 0.1, live: true },
  { key: 'waveLength', group: 'Level', label: 'Wave length', min: 0.1, max: 3, step: 0.05, live: true },
]);

export const DEV_TOGGLES = Object.freeze([
  { key: 'god', label: 'God mode (no damage)' },
  { key: 'showStats', label: 'Show live stats' },
]);

function defaults() {
  const d = {};
  for (const s of DEV_SLIDERS) d[s.key] = 1;
  for (const t of DEV_TOGGLES) d[t.key] = false;
  return d;
}

// The live values. Mutated in place so every module sees the same object.
export const DEV = defaults();

export function clampDev(key, v) {
  const s = DEV_SLIDERS.find((x) => x.key === key);
  if (!s) return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(s.max, Math.max(s.min, n));
}

export function setDev(key, value) {
  if (DEV_TOGGLES.some((t) => t.key === key)) DEV[key] = !!value;
  else if (key in DEV) DEV[key] = clampDev(key, value);
  return DEV[key];
}

export function resetDev() {
  Object.assign(DEV, defaults());
}

// True when anything differs from normal play (the HUD shows a DEV badge).
export function devActive() {
  return DEV_SLIDERS.some((s) => DEV[s.key] !== 1) || DEV.god;
}

export function loadDev(storage) {
  resetDev();
  try {
    const raw = storage?.getItem(DEV_STORAGE_KEY);
    if (!raw) return DEV;
    const saved = JSON.parse(raw);
    for (const k of Object.keys(DEV)) if (k in saved) setDev(k, saved[k]);
  } catch { /* a broken save just means default tuning */ }
  return DEV;
}

export function saveDev(storage) {
  try { storage?.setItem(DEV_STORAGE_KEY, JSON.stringify(DEV)); } catch { /* storage off */ }
}
