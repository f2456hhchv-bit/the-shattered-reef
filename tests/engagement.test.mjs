// The engagement pass (2026-10-04): dash, evolution moments, weapon combos,
// the final stretch, the unlock drip, liveries, daily voyages, contracts,
// achievements, the bestiary and the first-launch tutorial.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivalRun } from '../src/engine/survivalRun.mjs';
import { stepSurvivalFrame, stepDash } from '../src/engine/survivalLoop.mjs';
import { createEnemy } from '../src/engine/enemies.mjs';
import { applyChoice } from '../src/engine/survival.mjs';
import { DASH } from '../src/data/survival.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

function openRun(seed = 1, opts) {
  const run = createSurvivalRun(seed, undefined, opts);
  const N = run.grid.width;
  run.grid = { width: N, height: N, tiles: Array.from({ length: N }, () => Array(N).fill(0)) };
  run.coast = null;
  run.arena.waterDist = Array.from({ length: N }, () => new Float32Array(N).fill(99));
  run.pickups = [];
  return run;
}
const ctx = { spawnDist: 520, rng: makeSeededRng(3) };

test('dash: a burst along the stick, then a cooldown', () => {
  const run = openRun();
  const x0 = run.boat.x;
  let started = 0;
  for (let i = 0; i < 20; i++) started += stepDash(run, { x: 1, y: 0, dash: i === 0 }, 1 / 60) ? 1 : 0;
  assert.equal(started, 1);
  assert.ok(run.boat.x - x0 > 30, `moved ${run.boat.x - x0}`);
  assert.ok(run.dash.cd > 2.5);
  assert.ok(!stepDash(run, { x: 1, y: 0, dash: true }, 1 / 60), 'no second dash on cooldown');
});

test('dash: nothing hurts you during the i-frames', () => {
  const run = createSurvivalRun(1);
  run.sv.director = null;
  const e = createEnemy('pirate_cutter', run.boat.x + 5, run.boat.y);
  e.hunting = true; e.aggro = true; e.contactCooldownRemaining = 0;
  run.enemies.push(e);
  run.enemyProjectiles.push({ id: 1, x: run.boat.x + 4, y: run.boat.y, vx: -10, vy: 0, radius: 4, damage: 30, life: 2, kind: 'ball' });
  const hp = run.boat.health;
  run.sv.time = 0; run.sv.finished = true; // no spawns
  const twin = structuredClone(run);
  stepSurvivalFrame(run, 1 / 60, { x: 0, y: 1, dash: true }, ctx);
  assert.equal(run.boat.health, hp);
  // The same frame without the dash does hurt.
  stepSurvivalFrame(twin, 1 / 60, { x: 0, y: 1, dash: false }, ctx);
  assert.ok(twin.boat.health < hp);
});

test('Swift Sails shortens the dash cooldown', () => {
  const run = openRun();
  const base = run.sv.stats.dashCooldown;
  assert.equal(base, DASH.cooldown);
  for (let k = 0; k < 5; k++) applyChoice(run, { kind: 'passive', id: 'sails' });
  assert.ok(run.sv.stats.dashCooldown < base * 0.7);
});

import { activeSynergies, synergiesCompletedBy, applySynergies, describeChoice } from '../src/engine/survival.mjs';
import { SYNERGIES } from '../src/data/survival.mjs';

test('combos: active only with both weapons, and named on the completing card', () => {
  const run = openRun();
  assert.equal(activeSynergies(run).length, 0);
  run.sv.weapons.grapeshot = 1;
  const v = describeChoice(run, { kind: 'weapon', id: 'flame_barrels' });
  assert.ok(v.combos.some((c) => c.id === 'burning_shrapnel'));
  run.sv.weapons.flame_barrels = 1;
  assert.ok(activeSynergies(run).some((c) => c.id === 'burning_shrapnel'));
  for (const x of SYNERGIES) assert.equal(x.needs.length, 2);
});

test('combos: each one does its job', () => {
  const run = openRun();
  Object.assign(run.sv.weapons, { cannonballs: 1, grapeshot: 1, flame_barrels: 1, chain_shot: 1, depth_charges: 1 });
  const mk = (dx) => { const e = createEnemy('pirate_cutter', run.boat.x + dx, run.boat.y + 40); run.enemies.push(e); return e; };
  const a = mk(0); const b = mk(60); const c = mk(120); const d = mk(200); const f = mk(260);
  const speed = b.speed; const pools = run.sv.pools.length; const cx = c.x;
  d.health = 0;
  applySynergies(run, [
    { enemy: a, weaponId: 'grapeshot', damage: 5, killed: false },
    { enemy: b, weaponId: 'chain_shot', damage: 5, killed: false },
    { enemy: c, weaponId: 'cannonballs', damage: 5, killed: false },
    { enemy: d, weaponId: 'cannonballs', damage: 5, killed: true },
  ], [{ x: f.x - 30, y: f.y, r: 40, weaponId: 'depth_charges' }], 1 / 60);
  assert.ok(a.burn, 'burning shrapnel');
  assert.ok(b.speed < speed, 'rigging shredder');
  assert.ok(Math.abs(c.vx) > 50 || c.x !== cx, 'shock shells');
  assert.equal(run.sv.pools.length, pools + 1, 'heated shot');
  assert.ok(f.x < run.boat.x + 260, 'undertow');
  // Slows wear off.
  for (let i = 0; i < 120; i++) applySynergies(run, [], [], 1 / 60);
  assert.equal(b.speed, speed);
});

import { stepDirector } from '../src/engine/survival.mjs';
import { FINAL_STRETCH, WAVES } from '../src/data/survival.mjs';

test('final stretch: announced, and elite hunters arrive on a timer', () => {
  const run = createSurvivalRun(4);
  run.sv.wave = FINAL_STRETCH - 1; run.sv.waveTime = 29.99;
  const rng = makeSeededRng(2);
  const first = stepDirector(run, 0.02, { spawnDist: 420 }, rng);
  assert.ok(first.finalStretch);
  let elites = 0;
  for (let t = 0; t < 30; t += 0.1) elites += stepDirector(run, 0.1, { spawnDist: 420 }, rng).elites.length;
  assert.ok(WAVES[FINAL_STRETCH].hunters);
  assert.ok(elites >= 2, `elites ${elites}`);
});

import { createDefaultMeta, loadMeta, recordLevelResult } from '../src/engine/meta.mjs';
import {
  lockedPool, levelsWonTotal, nextPoolUnlock, newlyUnlocked, purchaseLivery, selectLivery, liveryColours,
  dailyVoyage, ensureContracts, recordProgress, bestiaryIds, bestiaryByStage, checkAchievements, dayKey,
} from '../src/engine/progression.mjs';
import { POOL_UNLOCKS, CONTRACT_SLOTS, ACHIEVEMENTS, LIVERIES } from '../src/data/progression.mjs';
import { rollChoices } from '../src/engine/survival.mjs';
import { completeLevel } from '../src/engine/survivalRun.mjs';

const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('unlock drip: new captains start with a smaller pool that grows with wins', () => {
  const meta = createDefaultMeta();
  const locked = lockedPool(meta);
  assert.equal(locked.length, Object.keys(POOL_UNLOCKS).length);
  const run = createSurvivalRun(5, undefined, { locked });
  for (let k = 0; k < 200; k++) for (const c of rollChoices(run, Math.random)) assert.ok(!locked.includes(c.id), `${c.id} offered while locked`);
  meta.levelsCleared[1] = 4;
  assert.equal(levelsWonTotal(meta), 4);
  assert.ok(!lockedPool(meta).includes('depth_charges'));
  assert.deepEqual(newlyUnlocked(1, 2), ['depth_charges']);
  assert.equal(nextPoolUnlock(meta).id, 'stern_chaser');
  meta.highestStageUnlocked = 4; // three stages behind you count in full
  assert.ok(levelsWonTotal(meta) >= 15);
  assert.equal(lockedPool(meta).length, 0);
});

test('liveries: buy, select, colour the boat; achievement liveries can\'t be bought', () => {
  const meta = createDefaultMeta();
  meta.salvage = 1000;
  assert.ok(purchaseLivery(meta, 'crimson').ok);
  assert.ok(selectLivery(meta, 'crimson'));
  assert.equal(liveryColours(meta).sail, LIVERIES.find((l) => l.id === 'crimson').sail);
  assert.equal(purchaseLivery(meta, 'jolly').reason, 'achievement');
  // Survives a save round trip; a bad selection falls back.
  const st = memStore(); st.setItem('shatteredReef.meta.v1', JSON.stringify({ ...meta, livery: 'nope' }));
  const back = loadMeta({ getItem: () => JSON.stringify({ ...meta, livery: 'nope' }) });
  assert.equal(back.livery, 'classic');
  assert.ok(back.ownedLiveries.includes('crimson'));
});

test('daily voyage: same for everyone on the same day, within your stages', () => {
  const meta = createDefaultMeta();
  const a = dailyVoyage(meta, new Date(2026, 9, 4));
  const b = dailyVoyage(meta, new Date(2026, 9, 4, 22));
  assert.deepEqual(a, b);
  assert.equal(a.stage, 1);
  assert.ok(a.levelIndex >= 0 && a.levelIndex <= 3);
  const c = dailyVoyage(meta, new Date(2026, 9, 5));
  assert.notEqual(c.seed, a.seed);
  meta.highestStageUnlocked = 6;
  for (let d = 0; d < 30; d++) assert.ok(dailyVoyage(meta, new Date(2026, 9, d + 1)).stage <= 6);
});

function finishedRun(opts = {}, { win = true, kills = 120 } = {}) {
  const run = createSurvivalRun(9, undefined, opts);
  run.sv.kills = kills;
  run.sv.killsByDef = { raider_longboat: kills - 2, pirate_cutter: 2 };
  run.sv.eliteKills = 1; run.sv.chestsOpened = 2; run.sv.shipLevel = 14;
  if (win) completeLevel(run); else { run.over = true; run.outcome = 'sunk'; }
  return run;
}

test('contracts: three active, progress across levels, pay out and refill', () => {
  const meta = createDefaultMeta();
  ensureContracts(meta, makeSeededRng(1));
  assert.equal(meta.contracts.length, CONTRACT_SLOTS);
  meta.contracts = [{ id: 'sink', tier: 0, target: 300, progress: 0 }, { id: 'chests', tier: 0, target: 3, progress: 0 }, { id: 'levels', tier: 0, target: 1, progress: 0 }];
  const s0 = meta.salvage;
  const r1 = recordProgress(meta, finishedRun({}, { kills: 200 }), { rng: makeSeededRng(2) });
  assert.equal(r1.contracts.length, 1); // levels done; sink 200/300, chests 2/3
  const r2 = recordProgress(meta, finishedRun({}, { win: false, kills: 150 }), { rng: makeSeededRng(3) });
  // sink and chests finish; a contract refilled after level 1 may finish too.
  assert.ok(r2.contracts.some((c) => c.id === 'sink') && r2.contracts.some((c) => c.id === 'chests'));
  assert.equal(meta.contracts.length, CONTRACT_SLOTS);
  assert.ok(meta.contractsDone >= 3);
  assert.ok(meta.contracts.every((c) => c.progress < c.target));
  assert.ok(meta.salvage > s0);
});

test('bestiary and achievements: record kills, unlock once, pay once', () => {
  const meta = createDefaultMeta();
  const r = recordProgress(meta, finishedRun(), { rng: makeSeededRng(4) });
  assert.ok(r.bestiaryNew.includes('pirate_cutter'));
  assert.ok(meta.bestiary.raider_longboat > 0);
  assert.ok(r.achievements.some((a) => a.id === 'first_blood'));
  assert.ok(r.achievements.some((a) => a.id === 'first_clear'));
  assert.equal(checkAchievements(meta).length, 0, 'no double unlock');
  // Every achievement test runs cleanly on a fresh save.
  const fresh = createDefaultMeta();
  for (const a of ACHIEVEMENTS) assert.equal(typeof a.test(fresh, { bestiaryFrac: 0 }), 'boolean');
  // Bestiary covers every stage's pools, boss and horde.
  const ids = bestiaryIds();
  for (const s of bestiaryByStage()) for (const id of s.ids) assert.ok(ids.includes(id));
  // Set reward for stage 1.
  for (const id of bestiaryByStage()[0].ids) meta.bestiary[id] = 1;
  const r2 = recordProgress(meta, finishedRun({}, { win: false, kills: 5 }), { rng: makeSeededRng(5) });
  assert.deepEqual(r2.bestiarySets, [1]);
});

test('daily voyage results: best score kept, first clear pays and builds a streak', () => {
  const meta = createDefaultMeta();
  const v1 = dailyVoyage(meta, new Date(2026, 9, 4));
  const run = finishedRun({ stage: v1.stage, levelIndex: v1.levelIndex, daily: { key: v1.key, mod: v1.mod } }, { kills: 300 });
  const r = recordProgress(meta, run, { rng: makeSeededRng(6) });
  assert.ok(r.daily.firstClear && r.daily.reward > 0);
  assert.equal(meta.daily.streak, 1);
  const again = recordProgress(meta, finishedRun({ stage: v1.stage, levelIndex: v1.levelIndex, daily: { key: v1.key, mod: v1.mod } }, { kills: 100 }), { rng: makeSeededRng(7) });
  assert.ok(!again.daily.firstClear && !again.daily.newBest);
  const v2 = dailyVoyage(meta, new Date(2026, 9, 5));
  recordProgress(meta, finishedRun({ stage: v2.stage, levelIndex: v2.levelIndex, daily: { key: v2.key, mod: v2.mod } }), { rng: makeSeededRng(8) });
  assert.equal(meta.daily.streak, 2);
  assert.equal(dayKey(new Date(2026, 9, 4)), '2026-10-04');
});

test('daily modifiers reach the run', () => {
  const v = { key: '2026-10-04', mod: { id: 'glass', fx: { damageDealt: 1.5, damageTaken: 1.5, countMult: 1.4, xpMult: 1.3 } } };
  const run = createSurvivalRun(3, undefined, { daily: v });
  assert.equal(run.sv.stats.damageMult, 1.5);
  assert.equal(run.sv.stats.damageTaken, 1.5);
  assert.equal(run.sv.countMult, 1.4);
  assert.equal(run.daily.key, '2026-10-04');
});

test('old saves load with the new fields', () => {
  const meta = loadMeta({ getItem: () => JSON.stringify({ salvage: 50, levelsCleared: { 1: 3 } }) });
  assert.equal(meta.salvage, 50);
  assert.deepEqual(meta.ownedLiveries, ['classic']);
  assert.equal(meta.life.kills, 0);
  assert.equal(meta.tutorialDone, false);
  void recordLevelResult;
});
