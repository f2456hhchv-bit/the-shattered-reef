// Balance regression guards (2026-09-28). Driven through the REAL engine
// loop via tools/ttk-check.mjs, not hand arithmetic — two hand models of
// Flame Barrels' burn in the build log were wrong. These fail if a future
// data change breaks a counter pair or the boss fight, not merely if a
// number moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { killStats, bossFight } from '../tools/ttk-check.mjs';
import { ENEMY_LIST } from '../src/data/enemies.mjs';
import { WEAPONS, WEAPON_IDS } from '../src/data/weapons.mjs';
import { TRIANGLE_DISADVANTAGE_MULTIPLIER } from '../src/data/factions.mjs';

test('every enemy dies to its own counter within 60% of one cache, even under a triangle disadvantage', () => {
  for (const e of ENEMY_LIST) {
    if (e.isBoss) continue;
    const k = killStats(e.id, e.counter, TRIANGLE_DISADVANTAGE_MULTIPLIER, e.counter === WEAPON_IDS.DEPTH_CHARGES ? 81 : 60);
    assert.ok(k.ammoShare <= 0.6, `${e.name}: ${k.shots} shots = ${Math.round(100 * k.ammoShare)}% of a ${WEAPONS[e.counter].name} cache`);
  }
});

test('the Kraken\'s Anchor dies to its phase counters with Flame Barrels to spare (the reason Flame damage is 5)', () => {
  // Spamming Depth Charges (the less skilled pattern) at perfect aim: at
  // Flame damage 4 this averaged 13/14 Flame Barrels — no margin for a
  // single miss; at 5 it averages ~10.
  const fights = Array.from({ length: 30 }, () => bossFight({ depthMode: 'spam' }));
  assert.ok(fights.every((f) => f.killed), 'every fight should end in a kill');
  const avgFlame = fights.reduce((a, f) => a + f.used.flame_barrels, 0) / fights.length;
  assert.ok(avgFlame <= 12, `phase-1 needs ${avgFlame.toFixed(1)}/14 Flame Barrels on average — too little margin for misses`);
});
