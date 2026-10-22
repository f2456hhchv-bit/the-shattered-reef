// Depth (2026-10-22): the story's progress, the keys, the crew and the
// levelled shop tracks — the meta state that turns "another level" into a
// voyage with people in it. Pure logic over the meta object
// (engine/meta.mjs loads and saves it; this module owns these fields).

import { CHARACTERS, CHAPTER_BY_STAGE, KEY_FOR_STAGE, RECRUIT_FOR_STAGE, NANA_SUNK, NANA_WON, NANA_IDLE } from '../data/story.mjs';
import { KEYS, KEY_IDS, KEY_MAX_LEVEL } from '../data/keys.mjs';
import { CREW, CREW_IDS, BOND_LEVELS, BOND_BONUS } from '../data/crew.mjs';
import {
  REFIT_TRACKS, REFIT_MAX, refitCost, refitScales, refitCap,
  MASTERY_MAX, MASTERY_PER, masteryCost, masteryScales, masteryCap,
  keyCost, keyScales, CREW_QUARTERS, WAKES, WAKE_BY_ID,
} from '../data/shop.mjs';
import { SV_WEAPON_IDS } from '../data/survival.mjs';
import { getEnemy } from '../data/enemies.mjs';

export function defaultDepth() {
  return {
    storySeen: {}, // 'prologue', 'intro:<stage>', 'outro:<stage>'
    keysOwned: ['anchor'], keyEquipped: 'anchor', keyLevels: {},
    crewOwned: ['barnaby'], crewAboard: ['barnaby'], crewSlots: 2, crewBond: {},
    refits: {}, // hullId -> { plating, rigging, guns }
    mastery: {}, // weaponId -> level
    wakesOwned: ['foam'], wake: 'foam',
  };
}

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const int = (v, lo, hi) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : lo);

// Keeps only what still exists in data; never throws.
export function sanitizeDepth(meta, parsed = {}) {
  const d = defaultDepth();
  meta.storySeen = {};
  for (const [k, v] of Object.entries(obj(parsed.storySeen))) if (v) meta.storySeen[k] = true;
  meta.keysOwned = [...new Set(['anchor', ...arr(parsed.keysOwned).filter((k) => KEYS[k])])];
  meta.keyEquipped = meta.keysOwned.includes(parsed.keyEquipped) ? parsed.keyEquipped : 'anchor';
  meta.keyLevels = {};
  for (const [k, v] of Object.entries(obj(parsed.keyLevels))) if (KEYS[k]) meta.keyLevels[k] = int(v, 1, KEY_MAX_LEVEL);
  meta.crewOwned = [...new Set(['barnaby', ...arr(parsed.crewOwned).filter((c) => CREW[c])])];
  meta.crewSlots = int(parsed.crewSlots ?? d.crewSlots, 2, 3);
  meta.crewAboard = [...new Set(arr(parsed.crewAboard ?? d.crewAboard).filter((c) => meta.crewOwned.includes(c)))].slice(0, meta.crewSlots);
  meta.crewBond = {};
  for (const [c, v] of Object.entries(obj(parsed.crewBond))) if (CREW[c] && Number.isFinite(v) && v >= 0) meta.crewBond[c] = v;
  meta.refits = {};
  for (const [h, t] of Object.entries(obj(parsed.refits))) {
    const o = {};
    for (const tr of REFIT_TRACKS) { const v = obj(t)[tr.id]; if (Number.isInteger(v) && v > 0) o[tr.id] = Math.min(REFIT_MAX, v); }
    if (Object.keys(o).length) meta.refits[h] = o;
  }
  meta.mastery = {};
  for (const [w, v] of Object.entries(obj(parsed.mastery))) if (SV_WEAPON_IDS.includes(w) && Number.isInteger(v) && v > 0) meta.mastery[w] = Math.min(MASTERY_MAX, v);
  meta.wakesOwned = [...new Set(['foam', ...arr(parsed.wakesOwned).filter((w) => WAKE_BY_ID[w])])];
  meta.wake = meta.wakesOwned.includes(parsed.wake) ? parsed.wake : 'foam';
  return meta;
}

// --- Progress gates ----------------------------------------------------------
export function stagesCleared(meta) { return Math.max(0, (meta.highestStageUnlocked || 1) - 1); }
export function meetsRequires(meta, requires) { return !requires || (meta.highestStageUnlocked || 1) >= requires; }
function pay(meta, salvage, scales = 0) {
  if (meta.salvage < salvage) return { ok: false, reason: 'cannot_afford' };
  if ((meta.krakenScales || 0) < scales) return { ok: false, reason: 'scales' };
  meta.salvage -= salvage; meta.krakenScales -= scales;
  return { ok: true };
}

// --- Keys ----------------------------------------------------------------------
export function keyLevel(meta, id) { return meta.keyLevels?.[id] || 1; }
export function equipKey(meta, id) {
  if (!meta.keysOwned.includes(id)) return false;
  meta.keyEquipped = id; return true;
}
// What the next key level costs, or null when maxed.
export function nextKeyPrice(meta, id) {
  const lv = keyLevel(meta, id);
  if (lv >= KEY_MAX_LEVEL) return null;
  return { level: lv + 1, salvage: keyCost(lv + 1), scales: keyScales(lv + 1) };
}
export function purchaseKeyLevel(meta, id) {
  if (!meta.keysOwned.includes(id)) return { ok: false, reason: 'not_owned' };
  const p = nextKeyPrice(meta, id);
  if (!p) return { ok: false, reason: 'maxed' };
  const r = pay(meta, p.salvage, p.scales);
  if (r.ok) meta.keyLevels[id] = p.level;
  return r;
}

// --- Crew ------------------------------------------------------------------------
export function bondLevel(meta, id) {
  const v = meta.crewBond?.[id] || 0;
  let lv = 0; for (const need of BOND_LEVELS) if (v >= need) lv++;
  return lv;
}
export function bondProgress(meta, id) {
  const v = meta.crewBond?.[id] || 0; const lv = bondLevel(meta, id);
  if (lv >= BOND_LEVELS.length) return { level: lv, into: 1 };
  const lo = lv ? BOND_LEVELS[lv - 1] : 0; const hi = BOND_LEVELS[lv];
  return { level: lv, into: (v - lo) / (hi - lo) };
}
// Puts someone aboard or ashore. Full berths: the first one aboard steps off.
export function toggleCrew(meta, id) {
  if (!meta.crewOwned.includes(id)) return false;
  const i = meta.crewAboard.indexOf(id);
  if (i >= 0) { meta.crewAboard.splice(i, 1); return true; }
  meta.crewAboard.push(id);
  while (meta.crewAboard.length > meta.crewSlots) meta.crewAboard.shift();
  return true;
}
export function purchaseCrewQuarters(meta) {
  if (meta.crewSlots >= 3) return { ok: false, reason: 'owned' };
  if (!meetsRequires(meta, CREW_QUARTERS.requires)) return { ok: false, reason: 'locked' };
  const r = pay(meta, CREW_QUARTERS.cost, CREW_QUARTERS.scales);
  if (r.ok) meta.crewSlots = 3;
  return r;
}
// The aboard crew's passives, each strengthened by its bond level.
export function crewEffects(meta, aboard = meta.crewAboard) {
  const out = { weapon: {}, xpMult: 1, pickupMult: 1, speedMult: 1, keyCharge: 1, lantern: 1, dashMult: 1, statusFade: 1, regen: 0, hull: 0, rakeBonus: 0, cheatDeath: 0 };
  for (const id of aboard || []) {
    const c = CREW[id]; if (!c) continue;
    const k = 1 + BOND_BONUS * bondLevel(meta, id);
    for (const [f, v] of Object.entries(c.fx)) {
      if (f === 'weapon') { for (const [w, m] of Object.entries(v)) out.weapon[w] = (out.weapon[w] || 1) * (1 + (m - 1) * k); }
      else if (f === 'dashMult') out.dashMult *= 1 - (1 - v) * k;
      else if (f === 'cheatDeath') out.cheatDeath += v;
      else if (f === 'regen' || f === 'hull' || f === 'rakeBonus') out[f] += v * k;
      else out[f] *= 1 + (v - 1) * k;
    }
  }
  return out;
}

// --- Shipyard refits ---------------------------------------------------------------
export function refitLevel(meta, hullId, track) { return meta.refits?.[hullId]?.[track] || 0; }
export function nextRefitPrice(meta, hullId, track) {
  const lv = refitLevel(meta, hullId, track);
  if (lv >= REFIT_MAX) return null;
  return { level: lv + 1, salvage: refitCost(lv + 1), scales: refitScales(lv + 1), capped: lv + 1 > refitCap(stagesCleared(meta)) };
}
export function purchaseRefit(meta, hullId, track) {
  if (!meta.ownedHulls.includes(hullId)) return { ok: false, reason: 'not_owned' };
  const p = nextRefitPrice(meta, hullId, track);
  if (!p) return { ok: false, reason: 'maxed' };
  if (p.capped) return { ok: false, reason: 'locked' };
  const r = pay(meta, p.salvage, p.scales);
  if (r.ok) (meta.refits[hullId] ||= {})[track] = p.level;
  return r;
}
export function refitEffects(meta, hullId) {
  const out = { hull: 0, speed: 0, turn: 0, damage: 0 };
  for (const tr of REFIT_TRACKS) {
    const lv = refitLevel(meta, hullId, tr.id);
    for (const [k, v] of Object.entries(tr.fx)) out[k] += v * lv;
  }
  return out;
}

// --- Gunsmith mastery ----------------------------------------------------------------
export function masteryLevel(meta, weaponId) { return meta.mastery?.[weaponId] || 0; }
export function nextMasteryPrice(meta, weaponId) {
  const lv = masteryLevel(meta, weaponId);
  if (lv >= MASTERY_MAX) return null;
  return { level: lv + 1, salvage: masteryCost(lv + 1), scales: masteryScales(lv + 1), capped: lv + 1 > masteryCap(stagesCleared(meta)) };
}
export function purchaseMastery(meta, weaponId) {
  if (!SV_WEAPON_IDS.includes(weaponId)) return { ok: false, reason: 'unknown' };
  const p = nextMasteryPrice(meta, weaponId);
  if (!p) return { ok: false, reason: 'maxed' };
  if (p.capped) return { ok: false, reason: 'locked' };
  const r = pay(meta, p.salvage, p.scales);
  if (r.ok) meta.mastery[weaponId] = p.level;
  return r;
}
// What a mastery level does to a weapon in a run (survival.weaponStats).
export function masteryFx(level) {
  return { damage: 1 + MASTERY_PER * level, cooldown: level >= 5 ? 0.92 : 1, extraShot: level >= 10 ? 1 : 0 };
}

// --- Wakes ---------------------------------------------------------------------------
export function purchaseWake(meta, id) {
  const w = WAKE_BY_ID[id];
  if (!w) return { ok: false, reason: 'unknown' };
  if (meta.wakesOwned.includes(id)) return { ok: false, reason: 'owned' };
  if (!meetsRequires(meta, w.requires)) return { ok: false, reason: 'locked' };
  const r = pay(meta, w.cost);
  if (r.ok) { meta.wakesOwned.push(id); meta.wake = id; }
  return r;
}
export function selectWake(meta, id) {
  if (!meta.wakesOwned.includes(id)) return false;
  meta.wake = id; return true;
}

// --- The loadout additions a run reads ------------------------------------------
export function resolveDepth(meta, hullId) {
  return {
    key: { id: meta.keyEquipped || 'anchor', level: keyLevel(meta, meta.keyEquipped || 'anchor') },
    crew: [...(meta.crewAboard || [])],
    crewFx: crewEffects(meta),
    refit: refitEffects(meta, hullId),
    mastery: { ...(meta.mastery || {}) },
    wake: meta.wake || 'foam',
  };
}

// --- Story -----------------------------------------------------------------------------
export function chapterFor(stage) { return CHAPTER_BY_STAGE[stage] || null; }
export function storyUnseen(meta, key) { return !meta.storySeen?.[key]; }
export function markStory(meta, key) { (meta.storySeen ||= {})[key] = true; }

// After a level: crew bonds grow, and the first sinking of a stage boss
// brings its key home and its chapter's recruit aboard. Returns
// { key, recruit, chapter } for the outro (nulls when nothing new).
export function recordDepth(meta, run) {
  const out = { key: null, recruit: null, chapter: null };
  if (run.daily) return out;
  const won = run.outcome === 'victory';
  for (const id of run.crew || []) meta.crewBond[id] = (meta.crewBond[id] || 0) + (won ? 1 : 0.25);
  if (won && run.bossDefeated && run.reefIndex >= 4) {
    const key = KEY_FOR_STAGE[run.stage]; const recruit = RECRUIT_FOR_STAGE[run.stage];
    if (key && !meta.keysOwned.includes(key)) { meta.keysOwned.push(key); out.key = key; }
    if (recruit && !meta.crewOwned.includes(recruit)) {
      meta.crewOwned.push(recruit); out.recruit = recruit;
      if (meta.crewAboard.length < meta.crewSlots) meta.crewAboard.push(recruit);
    }
    if (out.key || out.recruit) out.chapter = CHAPTER_BY_STAGE[run.stage] || null;
  }
  return out;
}

// Nana's word when you come home (after Hades: sinking is a story beat).
export function nanaLine(run, rng = Math.random) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  if (!run) return pick(NANA_IDLE);
  if (run.outcome === 'victory') return pick(NANA_WON).replace('{level}', String((run.reefIndex ?? 0) + 1));
  let enemy = 'pirate';
  try { if (run.sv?.lastHurtBy) enemy = getEnemy(run.sv.lastHurtBy).name; } catch { /* unknown id */ }
  return pick(NANA_SUNK).replaceAll('{enemy}', enemy);
}

export function character(id) { return CHARACTERS[id] || CHARACTERS.narrator; }
export { KEY_IDS, CREW_IDS, WAKES };
