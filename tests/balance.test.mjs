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

test('the Kraken\'s Anchor is a real fight: always winnable with its counters (plus the Cannonball fallback), never a quick kill', () => {
  // 2026-09-29 (project owner: "Boss too easy"): boss hull was raised
  // 220 -> 380. Even at perfect aim, pure damage output now takes ~25s+,
  // before the seals and dodging; with misses it still always dies.
  const fights = Array.from({ length: 30 }, () => bossFight({ depthMode: 'spam' }));
  assert.ok(fights.every((f) => f.killed), 'every fight should end in a kill');
  const avg = fights.reduce((a, f) => a + f.seconds, 0) / fights.length;
  assert.ok(avg >= 20, `boss dies in ${avg.toFixed(1)}s of perfect fire — too quick`);
  const sloppy = Array.from({ length: 20 }, () => bossFight({ depthMode: 'reactive', missRate: 0.35 }));
  assert.ok(sloppy.every((f) => f.killed && f.seconds < 120), 'a sloppy player must still be able to finish it');
});
