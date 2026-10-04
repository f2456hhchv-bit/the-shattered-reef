// Reasons to come back (2026-10-04): the unlock drip, liveries, the daily
// voyage, contracts, achievements and the bestiary. Pure logic over the
// meta save (engine/meta.mjs) and finished runs; content in
// data/progression.mjs.

import {
  POOL_UNLOCKS, LIVERIES, LIVERY_BY_ID, DAILY_MODS, DAILY_REWARD, CONTRACTS, CONTRACT_BY_ID, CONTRACT_SLOTS,
  ACHIEVEMENTS, ACHIEVEMENT_BY_ID, BESTIARY_SET_REWARD,
} from '../data/progression.mjs';
import { STAGES } from '../data/stages.mjs';
import { HORDE_FOR_BIOME } from '../data/survival.mjs';
import { activeSynergies, evolutionsUsed } from './survival.mjs';
import { mixSeed } from './levels.mjs';

// ---------------------------------------------------------------------------
// Save shape

export function defaultProgression() {
  return {
    life: { kills: 0, levels: 0, lords: 0, elites: 0, chests: 0, evolutions: 0, bestEvolutions: 0, evolvedWeapons: {}, combos: {}, bestShipLevel: 0, dashes: 0, cleanClears: 0 },
    bestiary: {}, // enemy id -> times sunk
    bestiarySets: [], // stage numbers whose set has paid out
    achievements: [], // ids unlocked
    contracts: [], // [{ id, tier, target, progress }]
    contractsDone: 0,
    daily: { lastKey: null, cleared: 0, streak: 0, bestStreak: 0, best: {} }, // best[key] = { kills, cleared }
    ownedLiveries: ['classic'],
    livery: 'classic',
    tutorialDone: false,
  };
}

// Folds the progression fields of a parsed save onto `meta` (never throws).
export function sanitizeProgression(meta, parsed = {}) {
  const d = defaultProgression();
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
  const life = obj(parsed.life);
  meta.life = { ...d.life };
  for (const k of Object.keys(d.life)) {
    if (typeof d.life[k] === 'number') meta.life[k] = num(life[k]);
    else meta.life[k] = { ...obj(life[k]) };
  }
  meta.bestiary = {};
  for (const [k, v] of Object.entries(obj(parsed.bestiary))) if (Number.isFinite(v) && v > 0) meta.bestiary[k] = v;
  meta.bestiarySets = Array.isArray(parsed.bestiarySets) ? parsed.bestiarySets.filter(Number.isInteger) : [];
  meta.achievements = Array.isArray(parsed.achievements) ? parsed.achievements.filter((id) => ACHIEVEMENT_BY_ID[id]) : [];
  meta.contracts = Array.isArray(parsed.contracts)
    ? parsed.contracts.filter((c) => c && CONTRACT_BY_ID[c.id] && Number.isFinite(c.target)).map((c) => ({ id: c.id, tier: c.tier | 0, target: c.target, progress: num(c.progress) }))
    : [];
  meta.contractsDone = num(parsed.contractsDone);
  const daily = obj(parsed.daily);
  meta.daily = { ...d.daily, ...daily, best: { ...obj(daily.best) } };
  meta.ownedLiveries = [...new Set(['classic', ...(Array.isArray(parsed.ownedLiveries) ? parsed.ownedLiveries.filter((id) => LIVERY_BY_ID[id]) : [])])];
  meta.livery = meta.ownedLiveries.includes(parsed.livery) ? parsed.livery : 'classic';
  meta.tutorialDone = !!parsed.tutorialDone;
  return meta;
}

// ---------------------------------------------------------------------------
// The unlock drip

export function levelsWonTotal(meta) {
  let n = 0;
  const top = meta.highestStageUnlocked || 1;
  for (let st = 1; st <= Math.max(top, ...Object.keys(meta.levelsCleared || {}).map(Number), 1); st++) {
    const c = meta.levelsCleared?.[st] || 0;
    n += st < top ? Math.max(5, c) : c;
  }
  return n;
}

// Ids still kept out of the level-up pool.
export function lockedPool(meta) {
  const won = levelsWonTotal(meta);
  return Object.entries(POOL_UNLOCKS).filter(([, at]) => won < at).map(([id]) => id);
}

// The next thing to join the pool: { id, at, left } or null.
export function nextPoolUnlock(meta) {
  const won = levelsWonTotal(meta);
  const next = Object.entries(POOL_UNLOCKS).filter(([, at]) => won < at).sort((a, b) => a[1] - b[1])[0];
  return next ? { id: next[0], at: next[1], left: next[1] - won } : null;
}

// What a level win just added to the pool (ids).
export function newlyUnlocked(before, after) {
  return Object.entries(POOL_UNLOCKS).filter(([, at]) => before < at && after >= at).map(([id]) => id);
}

// ---------------------------------------------------------------------------
// Liveries

export function purchaseLivery(meta, id) {
  const l = LIVERY_BY_ID[id];
  if (!l) return { ok: false, reason: 'unknown' };
  if (meta.ownedLiveries.includes(id)) return { ok: false, reason: 'already_owned' };
  if (l.from) return { ok: false, reason: 'achievement' };
  if (meta.salvage < l.cost) return { ok: false, reason: 'cannot_afford' };
  meta.salvage -= l.cost; meta.ownedLiveries.push(id);
  return { ok: true };
}

export function selectLivery(meta, id) {
  if (!meta.ownedLiveries.includes(id)) return false;
  meta.livery = id; return true;
}

export function liveryColours(meta) {
  const l = LIVERY_BY_ID[meta.livery];
  return l && l.sail ? { sail: l.sail, trim: l.trim, flag: l.flag } : null;
}

// ---------------------------------------------------------------------------
// The daily voyage

export function dayKey(date = new Date()) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function dayIndex(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

// Today's voyage, the same for everyone who has reached the same stage:
// a stage you have unlocked, a level 1-4, a modifier and a fixed seed.
export function dailyVoyage(meta, date = new Date()) {
  const key = dayKey(date);
  const di = dayIndex(key);
  const top = Math.max(1, Math.min(STAGES.length, meta.highestStageUnlocked || 1));
  const stage = 1 + (di % top);
  const levelIndex = Math.floor(di / 7) % 4;
  const mod = DAILY_MODS[di % DAILY_MODS.length];
  const seed = mixSeed(0x0da11e5 ^ di, 77) >>> 0;
  return { key, stage, levelIndex, mod, seed };
}

export function dailyReward(meta, voyage) {
  const streak = Math.min(DAILY_REWARD.streakCap, (meta.daily.streak || 0) + 1);
  return DAILY_REWARD.base + DAILY_REWARD.perStage * (voyage.stage - 1) + DAILY_REWARD.streakBonus * (streak - 1);
}

// ---------------------------------------------------------------------------
// Contracts

function contractTarget(tpl, tier) { return tpl.targets[Math.min(tier, tpl.targets.length - 1)]; }
export function contractReward(c) { const tpl = CONTRACT_BY_ID[c.id]; return tpl.reward[Math.min(c.tier, tpl.reward.length - 1)]; }
export function contractText(c) {
  const tpl = CONTRACT_BY_ID[c.id];
  return c.target === 1 && tpl.one ? tpl.one : tpl.text.replace('{n}', c.target.toLocaleString('en-GB'));
}

// Tops up to CONTRACT_SLOTS with templates not already active. Harder
// tiers as you complete more.
export function ensureContracts(meta, rng = Math.random) {
  while (meta.contracts.length < CONTRACT_SLOTS) {
    const free = CONTRACTS.filter((t) => !meta.contracts.some((c) => c.id === t.id));
    const tpl = free[Math.floor(rng() * free.length)];
    const tier = Math.min(2, Math.floor(meta.contractsDone / 4) + (rng() < 0.3 ? 1 : 0));
    meta.contracts.push({ id: tpl.id, tier, target: contractTarget(tpl, tier), progress: 0 });
  }
  return meta.contracts;
}

// ---------------------------------------------------------------------------
// Bestiary

// Every enemy a survival level can field, by stage: its pools, its boss
// and its biome's horde.
export function bestiaryByStage() {
  return STAGES.map((st, i) => {
    const ids = new Set([HORDE_FOR_BIOME[st.biome], ...st.pools.flat(), st.boss].filter(Boolean));
    return { stage: i + 1, biome: st.biome, name: st.name, ids: [...ids] };
  });
}
export function bestiaryIds() {
  return [...new Set(bestiaryByStage().flatMap((s) => s.ids))];
}
export function bestiaryFraction(meta) {
  const ids = bestiaryIds();
  return ids.filter((id) => meta.bestiary[id] > 0).length / ids.length;
}

// ---------------------------------------------------------------------------
// After a level

// The numbers a finished level contributes.
export function runTally(run) {
  const sv = run.sv;
  const win = run.outcome === 'victory';
  return {
    kills: sv.kills || 0,
    elites: sv.eliteKills || 0,
    lords: win ? 1 : 0,
    levels: win ? 1 : 0,
    chests: sv.chestsOpened || 0,
    evolutions: evolutionsUsed(run),
    dashes: run.dash?.uses || 0,
    shipLevel: sv.shipLevel || 1,
    combos: activeSynergies(run).length,
    salvage: Math.round(run.bankedSalvage || 0),
  };
}

function grant(meta, reward, report) {
  if (!reward) return;
  if (reward.salvage) { meta.salvage += reward.salvage; report.salvage += reward.salvage; }
  if (reward.scales) { meta.krakenScales += reward.scales; report.scales += reward.scales; }
  if (reward.livery && !meta.ownedLiveries.includes(reward.livery)) { meta.ownedLiveries.push(reward.livery); report.liveries.push(reward.livery); }
}

// Folds a finished level into lifetime stats, the bestiary, contracts, the
// daily voyage and achievements, paying their rewards into `meta`. Call
// after engine/meta.mjs recordLevelResult. Returns what happened, for the
// summary screen.
export function recordProgress(meta, run, { rng = Math.random } = {}) {
  const report = { salvage: 0, scales: 0, liveries: [], achievements: [], contracts: [], bestiaryNew: [], bestiarySets: [], daily: null };
  const t = runTally(run);
  const sv = run.sv;
  const L = meta.life;
  L.kills += t.kills; L.levels += t.levels; L.lords += t.lords; L.elites += t.elites; L.chests += t.chests;
  L.evolutions += t.evolutions; L.bestEvolutions = Math.max(L.bestEvolutions, t.evolutions);
  for (const [id, on] of Object.entries(sv.evolved || {})) if (on) L.evolvedWeapons[id] = (L.evolvedWeapons[id] || 0) + 1;
  for (const c of activeSynergies(run)) L.combos[c.id] = (L.combos[c.id] || 0) + 1;
  L.bestShipLevel = Math.max(L.bestShipLevel, t.shipLevel);
  L.dashes += t.dashes;
  if (run.outcome === 'victory' && (sv.hullLost || 0) < run.boat.maxHull * 0.1) L.cleanClears += 1;

  // Bestiary.
  for (const [id, n] of Object.entries(sv.killsByDef || {})) {
    if (!(n > 0)) continue;
    if (!(meta.bestiary[id] > 0)) report.bestiaryNew.push(id);
    meta.bestiary[id] = (meta.bestiary[id] || 0) + n;
  }
  for (const set of bestiaryByStage()) {
    if (meta.bestiarySets.includes(set.stage)) continue;
    if (set.ids.every((id) => meta.bestiary[id] > 0)) {
      meta.bestiarySets.push(set.stage);
      grant(meta, { salvage: BESTIARY_SET_REWARD * set.stage }, report);
      report.bestiarySets.push(set.stage);
    }
  }

  // Contracts.
  ensureContracts(meta, rng);
  for (const c of meta.contracts) {
    const tpl = CONTRACT_BY_ID[c.id];
    c.progress = tpl.max ? Math.max(c.progress, t[tpl.stat] || 0) : c.progress + (t[tpl.stat] || 0);
  }
  const done = meta.contracts.filter((c) => c.progress >= c.target);
  for (const c of done) {
    grant(meta, { salvage: contractReward(c) }, report);
    report.contracts.push({ ...c, text: contractText(c), reward: contractReward(c) });
    meta.contractsDone += 1;
  }
  meta.contracts = meta.contracts.filter((c) => c.progress < c.target);
  ensureContracts(meta, rng);

  // The daily voyage.
  if (run.daily) {
    const key = run.daily.key;
    const best = meta.daily.best[key] || { kills: 0, cleared: false };
    const firstClear = run.outcome === 'victory' && !best.cleared;
    meta.daily.best[key] = { kills: Math.max(best.kills, t.kills), cleared: best.cleared || run.outcome === 'victory' };
    report.daily = { key, kills: t.kills, best: meta.daily.best[key].kills, newBest: t.kills > best.kills, firstClear, reward: 0 };
    if (firstClear) {
      const prev = meta.daily.lastKey;
      const yesterday = prev && dayIndex(key) - dayIndex(prev) === 1;
      const reward = dailyReward({ daily: { streak: yesterday ? meta.daily.streak : 0 } }, run.daily);
      meta.daily.streak = yesterday ? meta.daily.streak + 1 : 1;
      meta.daily.bestStreak = Math.max(meta.daily.bestStreak, meta.daily.streak);
      meta.daily.lastKey = key;
      meta.daily.cleared += 1;
      grant(meta, { salvage: reward }, report);
      report.daily.reward = reward; report.daily.streak = meta.daily.streak;
    }
    // Keep the last fortnight of daily bests.
    const keys = Object.keys(meta.daily.best).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 14))) delete meta.daily.best[k];
  }

  report.achievements = checkAchievements(meta, report);
  return report;
}

// Unlocks every achievement whose test now passes; pays rewards. Returns
// the newly unlocked achievement records.
export function checkAchievements(meta, report = { salvage: 0, scales: 0, liveries: [] }) {
  const ctx = { bestiaryFrac: bestiaryFraction(meta) };
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (meta.achievements.includes(a.id)) continue;
    let ok = false;
    try { ok = a.test(meta, ctx); } catch { ok = false; }
    if (!ok) continue;
    meta.achievements.push(a.id);
    grant(meta, a.reward, report);
    out.push(a);
  }
  return out;
}

export { LIVERIES, LIVERY_BY_ID, ACHIEVEMENTS, DAILY_MODS };
