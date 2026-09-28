// Seeded levels (2026-09-28). A level is { biomeId, tier, seed }. That fully
// determines one reef: its layout, coastline, art, enemies and pickups. The
// same code always rebuilds the same reef, on any device, in any run.
//
// Tier is the size/density step (run.mjs's REEF_TUNING index: 1 = small,
// 3 = large with the boss in the pool). Seed is a uint32.
//
// Code format: <biome code><tier>-<seed, base-36, 7 chars>, e.g. TR1-0K3F9ZA.
// Short enough to read out or type, and it's the hook for the growth plan:
// thousands of short, individually replayable levels (CLAUDE.md,
// "Confirmed growth direction").

import { BIOMES } from '../data/biomes.mjs';

const SEED_CHARS = 7; // 36^7 > 2^32, so every uint32 seed fits

// Well-mixed uint32 from (a, b): used to derive independent per-reef seeds,
// so reef 2's layout never depends on what happened in reef 1.
export function mixSeed(a, b) {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function encodeLevelCode({ biomeId, tier, seed }) {
  const biome = BIOMES[biomeId];
  if (!biome) throw new Error(`Unknown biome: ${biomeId}`);
  return `${biome.code}${tier}-${(seed >>> 0).toString(36).toUpperCase().padStart(SEED_CHARS, '0')}`;
}

// Returns { biomeId, tier, seed } or null for anything malformed or unknown
// (never throws — codes come from people typing or pasting them).
export function decodeLevelCode(code, maxTier = 3) {
  if (typeof code !== 'string') return null;
  const m = /^([A-Z]{2})(\d)-([0-9A-Z]{1,7})$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const biome = Object.values(BIOMES).find((b) => b.code === m[1]);
  const tier = Number(m[2]);
  const seed = parseInt(m[3], 36);
  if (!biome || tier < 1 || tier > maxTier || !Number.isFinite(seed) || seed > 0xffffffff) return null;
  return { biomeId: biome.id, tier, seed };
}
