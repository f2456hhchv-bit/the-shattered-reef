import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeLevelCode, decodeLevelCode, mixSeed } from '../src/engine/levels.mjs';
import { createRun, checkReachedExit, levelForReef, BASELINE_LOADOUT } from '../src/engine/run.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

const snapshot = (run) => ({
  tiles: run.grid.tiles.map((r) => r.join('')).join('/'),
  coast: Array.from(run.coast.data.slice(0, 4000)).map((v) => v.toFixed(3)).join(','),
  exit: run.exitWorld,
  spawn: { x: run.boat.x, y: run.boat.y },
  enemies: run.enemies.map((e) => [e.defId, e.x.toFixed(2), e.y.toFixed(2)]),
  pickups: run.pickups.map((p) => [p.kind, p.weaponId ?? null, p.x.toFixed(2), p.y.toFixed(2)]),
});

function advanceTo(run, reefIndex) {
  while (run.reefIndex < reefIndex) {
    run.boat.x = run.exitWorld.x; run.boat.y = run.exitWorld.y;
    checkReachedExit(run);
  }
}

test('level codes round-trip for any seed and tier', () => {
  const rng = makeSeededRng(1);
  for (let i = 0; i < 500; i++) {
    const level = { biomeId: 'tropical', tier: 1 + Math.floor(rng() * 3), seed: Math.floor(rng() * 2 ** 32) >>> 0 };
    const code = encodeLevelCode(level);
    assert.match(code, /^TR[1-3]-[0-9A-Z]{7}$/);
    assert.deepEqual(decodeLevelCode(code), level);
  }
  assert.deepEqual(decodeLevelCode(encodeLevelCode({ biomeId: 'tropical', tier: 1, seed: 0xffffffff })).seed, 0xffffffff);
});

test('decodeLevelCode rejects junk instead of throwing (codes are typed by people)', () => {
  for (const bad of ['', 'TR', 'XX1-ABC', 'TR9-ABC', 'TR0-ABC', 'TR1-', 'TR1-ABC!', 'TR1-ZZZZZZZZ', null, 42]) {
    assert.equal(decodeLevelCode(bad), null, String(bad));
  }
  assert.ok(decodeLevelCode(' tr2-0000abc '), 'case and whitespace are forgiven');
});

test('a reef rebuilt from its code is identical to the one played in the original run', () => {
  for (const [seed, reef] of [[5, 0], [5, 2], [123, 1], [77, 2]]) {
    const original = createRun(seed);
    advanceTo(original, reef);
    const code = original.levelCode;
    const replay = createRun(999999, BASELINE_LOADOUT, { levels: { 0: decodeLevelCode(code) } });
    assert.equal(replay.levelCode, code);
    assert.deepEqual(snapshot(replay), snapshot(original), `${code} should rebuild identically`);
  }
});

test('reefs are independent: a reef\'s layout does not depend on the reefs before it', () => {
  const run = createRun(31);
  advanceTo(run, 2);
  assert.deepEqual(run.level, levelForReef(31, 2));
  assert.deepEqual(run.levelCodes.length, 3);
});

test('seeds give distinct reefs: 300 consecutive level seeds, 300 different layouts', () => {
  const seen = new Set();
  for (let n = 0; n < 300; n++) {
    const run = createRun(0, BASELINE_LOADOUT, { levels: { 0: { biomeId: 'tropical', tier: 1, seed: mixSeed(2026, n) } } });
    seen.add(run.grid.tiles.map((r) => r.join('')).join('/'));
  }
  assert.equal(seen.size, 300);
});
