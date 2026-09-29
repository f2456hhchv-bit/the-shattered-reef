// Reef Defence waves (2026-09-29). Pure and deterministic: a map's waves
// are built from its biome's voyage roster (data/stages.mjs), so every
// enemy you meet in the voyage turns up here too, in the same order:
// the first pools early, the late pools later, and the biome's boss as
// the final wave.
//
// Each wave has an HP budget that grows with the wave number; it's spent
// on 1-3 groups drawn from the wave's pool. A group is one enemy type in
// one lane, spawned at an interval (packs arrive tight, big ones spaced).

import { makeSeededRng } from './rng.mjs';
import { getEnemy, ARCHETYPES } from '../data/enemies.mjs';
import { stageInfo, bossForStage, stageScaling } from '../data/stages.mjs';

export const WAVE_TUNING = Object.freeze({
  budget: 125, // HP budget of wave 1
  linear: 0.42, quadratic: 0.05, // budget × (1 + linear·w + quadratic·w²)
  hpPerWave: 0.035, // every enemy's hull grows this much per wave
  bossHp: 4.6, // bosses have this many times their voyage hull
  bossEscort: 0.55, // the boss wave's escort budget, as a fraction of a normal wave's
});

export function isFlyer(def) { return def.archetype === ARCHETYPES.FLYER || !!def.flies; }

// Gold for sinking one. (Each wave also pays a bounty when it starts: waveBounty.)
export function waveBounty(w) { return 12 + w * 3; }

export function goldFor(defId) {
  const d = getEnemy(defId);
  if (d.isBoss) return 150;
  return Math.round(4 + d.maxHealth * 0.16);
}

// How many Heart hits an enemy costs if it gets through.
export function livesCost(defId) {
  const d = getEnemy(defId);
  if (d.isBoss) return 10;
  return d.maxHealth >= 60 ? 2 : 1;
}

function spawnInterval(def) {
  if (def.packSize) return 0.38;
  if (isFlyer(def)) return 0.85;
  if (def.maxHealth >= 60) return 1.9;
  if (def.maxHealth >= 40) return 1.35;
  return 0.95;
}

export function buildWaves(mapDef) {
  const rng = makeSeededRng((mapDef.seed * 2654435761) >>> 0);
  const stage = mapDef.stage;
  const info = stageInfo(stage);
  const scale = stageScaling(stage).health * (mapDef.hp || 1);
  const N = mapDef.waves;
  const laneCount = mapDef.lanes.length;
  const T = WAVE_TUNING;
  const waves = [];
  let laneCursor = 0;
  for (let w = 0; w < N; w++) {
    const isBossWave = w === N - 1;
    // New enemies arrive every couple of waves: pool 1 → 4 across the map.
    const poolIdx = isBossWave ? 4 : Math.min(3, Math.floor((w * 4.6) / (N - 1)));
    const pool = info.pools[poolIdx];
    // Mix a little of the previous pool in so new enemies arrive alongside familiar ones.
    const prev = poolIdx > 0 ? info.pools[poolIdx - 1] : pool;
    const hpMult = scale * (1 + T.hpPerWave * w);
    let budget = T.budget * (1 + T.linear * w + T.quadratic * w * w);
    const groups = [];
    let clock = 0;
    if (isBossWave) {
      const bossId = bossForStage(stage);
      budget *= T.bossEscort;
      groups.push({ defId: bossId, count: 1, interval: 1, delay: 6, lane: laneCursor % laneCount, hpMult: hpMult * T.bossHp, boss: true });
    }
    const groupCount = w < 2 ? 1 : w < 6 ? 2 : 3;
    for (let g = 0; g < groupCount && budget > 10; g++) {
      const src = rng() < 0.25 ? prev : pool;
      const defId = src[Math.floor(rng() * src.length)];
      const def = getEnemy(defId);
      const share = g === groupCount - 1 ? budget : budget * (0.4 + rng() * 0.25);
      let count = Math.max(1, Math.round(share / (def.maxHealth * hpMult)));
      if (def.packSize) count = Math.max(def.packSize[0], count);
      count = Math.min(count, def.packSize ? 18 : 12);
      const interval = spawnInterval(def);
      groups.push({ defId, count, interval, delay: clock, lane: laneCursor % laneCount, hpMult });
      laneCursor++;
      budget -= count * def.maxHealth * hpMult;
      clock += count * interval * 0.55 + 1.5;
    }
    waves.push({ index: w, boss: isBossWave, groups });
  }
  return waves;
}

// Enemy ids in a wave (for the "incoming" preview), first appearance order.
export function waveRoster(wave) {
  const out = [];
  for (const g of wave.groups) if (!out.includes(g.defId)) out.push(g.defId);
  return out;
}
