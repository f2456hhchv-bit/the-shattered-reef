import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV, setDev, resetDev, loadDev, saveDev, devActive, DEV_STORAGE_KEY } from '../src/engine/devTuning.mjs';
import { createSurvivalRun } from '../src/engine/survivalRun.mjs';
import { addXp, recomputeStats } from '../src/engine/survival.mjs';

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('dev tuning: defaults, clamping, persistence', () => {
  resetDev();
  assert.equal(devActive(), false);
  assert.equal(setDev('enemyCount', 99), 4); // clamped to the slider max
  assert.equal(setDev('god', 1), true);
  const st = fakeStorage(); saveDev(st);
  resetDev(); assert.equal(DEV.enemyCount, 1);
  loadDev(st); assert.equal(DEV.enemyCount, 4); assert.equal(DEV.god, true); assert.ok(devActive());
  st.setItem(DEV_STORAGE_KEY, '{broken'); loadDev(st); assert.equal(DEV.enemyCount, 1);
  resetDev();
});

test('dev tuning reaches the survival rules', () => {
  resetDev();
  const run = createSurvivalRun(7, undefined, { stage: 1, levelIndex: 0 });
  const hull = run.boat.maxHull;
  setDev('playerHull', 2); recomputeStats(run);
  assert.equal(run.boat.maxHull, hull * 2);
  setDev('xp', 10); addXp(run, 1);
  assert.ok(run.sv.shipLevel > 1);
  resetDev(); recomputeStats(run);
  assert.equal(run.boat.maxHull, hull);
});
