// The 2026-10-22 gameplay pass: XP flow, the carried stage build,
// broadsides, counters as a choice (wave headliners, glancing hits,
// reroll/banish) and the last fight as an event (guard, phases, cage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivalRun } from '../src/engine/survivalRun.mjs';
import {
  stepDirector, stepPickups, makeGem, sweepPickups, broadsideTargets, snapshotBuild, applyChoice, rollChoices,
  rerollChoices, banishChoice, confineToCage, addXp,
} from '../src/engine/survival.mjs';
import { stepSurvivalFrame } from '../src/engine/survivalLoop.mjs';
import { initLord, stepLord } from '../src/engine/warlord.mjs';
import { resolveHits, applyDamageToEnemy } from '../src/engine/combat.mjs';
import { currentCounter } from '../src/engine/enemies.mjs';
import { SURVIVAL, WAVES, xpToNext } from '../src/data/survival.mjs';
import { getEnemy } from '../src/data/enemies.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';
import { getBiome } from '../src/data/biomes.mjs';

test('xp: the first cards come within a few kills', () => {
  assert.ok(xpToNext(1) <= 3 && xpToNext(2) <= 5);
  for (let lv = 1; lv < 40; lv++) assert.ok(xpToNext(lv + 1) > xpToNext(lv), `lv ${lv}`);
  const run = createSurvivalRun(1);
  assert.equal(addXp(run, 3), 1);
});

test('glass drifts toward the ship, and a new wave sweeps it all in', () => {
  const run = createSurvivalRun(3);
  const b = run.boat;
  const near = makeGem(b.x + 200, b.y, 1); const far = makeGem(b.x + 600, b.y, 1);
  run.pickups.push(near, far);
  stepPickups(run, 0.5);
  assert.ok(near.x < b.x + 200 - 10, 'in-sight glass drifted closer');
  assert.equal(far.x, b.x + 600, 'far glass stays put');
  sweepPickups(run);
  assert.ok(far.pulled);
  let xp = 0;
  for (let i = 0; i < 120 && !far.collected; i++) xp += stepPickups(run, 1 / 30).xp;
  assert.ok(far.collected && xp >= 1);
  // The director asks for the sweep when a wave turns.
  const r2 = createSurvivalRun(4);
  r2.sv.waveTime = SURVIVAL.waveSeconds - 0.01;
  const out = stepDirector(r2, 0.05, { spawnDist: 520 }, makeSeededRng(1));
  assert.equal(out.waveStarted, 1); assert.ok(out.sweep);
});

test('broadside: guns bear off the beam, not over the bow or stern; the beam rakes', () => {
  const boat = { x: 0, y: 0, heading: 0 }; // bow east
  const at = (a, d = 150) => ({ e: { x: Math.cos(a) * d, y: Math.sin(a) * d, radius: 10 }, d });
  assert.equal(broadsideTargets(boat, [at(0)]).length, 0, 'dead ahead: no broadside');
  assert.equal(broadsideTargets(boat, [at(Math.PI)]).length, 0, 'dead astern: no broadside');
  const beam = broadsideTargets(boat, [at(Math.PI / 2)]);
  assert.equal(beam.length, 1); assert.ok(beam[0].list[0].rake, 'on the beam: raking');
  const quarter = broadsideTargets(boat, [at(Math.PI / 2 + 0.8)]);
  assert.equal(quarter.length, 1); assert.ok(!quarter[0].list[0].rake);
  assert.equal(broadsideTargets(boat, [at(Math.PI / 2), at(-Math.PI / 2)]).length, 2, 'both sides fire');
  assert.equal(broadsideTargets(boat, [at(0, 25)]).length, 1, 'point blank: the guns still reach');
});

test('specialists shrug off weapons that don\'t counter them (a grey glancing hit)', () => {
  const run = createSurvivalRun(5, undefined, { stage: 1, levelIndex: 2 });
  run.sv.wave = 4;
  const rng = makeSeededRng(3);
  for (let i = 0; i < 400 && !run.enemies.some((e) => !getEnemy(e.defId).horde); i++) stepDirector(run, 0.1, { spawnDist: 520 }, rng);
  const e = run.enemies.find((x) => !getEnemy(x.defId).horde);
  assert.ok(e, 'a specialist spawned');
  assert.equal(e.offCounterMult, SURVIVAL.offCounter);
  const wrong = ['cannonballs', 'chain_shot', 'grapeshot'].find((w) => w !== currentCounter(e));
  const shot = (id) => ({ id: 1, weaponId: id, x: e.x, y: e.y, vx: 1, vy: 0, radius: 4, traveled: 0, maxRange: 50, fuseRemaining: null, pierceLeft: 0, hitIds: null, spent: false, damage: 10, counterMult: 1.75, counterId: id });
  e.health = 1000;
  const [g] = resolveHits({ projectiles: [shot(wrong)] }, [e], currentCounter);
  assert.ok(g.glance); assert.ok(Math.abs(g.damage - 10 * SURVIVAL.offCounter) < 1e-9);
});

test('the build carries to the next level; a retry restores the build you arrived with', () => {
  const rng = makeSeededRng(8);
  const run = createSurvivalRun(9);
  for (let i = 0; i < 6; i++) applyChoice(run, rollChoices(run, rng)[0]);
  run.sv.shipLevel = 9;
  const b = snapshotBuild(run);
  const next = createSurvivalRun(10, undefined, { stage: 1, levelIndex: 1, build: b });
  assert.deepEqual(next.sv.weapons, run.sv.weapons);
  assert.deepEqual(next.sv.passives, run.sv.passives);
  assert.equal(next.sv.shipLevel, 9);
  assert.equal(next.sv.rerolls, b.rerolls + SURVIVAL.rerolls[1], 'a new level adds a reroll');
  assert.equal(next.boat.health, next.boat.maxHull, 'whole hull on a new level');
  // Spend it, then retry from what you arrived with.
  applyChoice(next, { kind: 'weapon', id: 'grapeshot' });
  const retry = createSurvivalRun(11, undefined, { stage: 1, levelIndex: 1, build: next.carryIn, retry: true });
  assert.deepEqual(retry.sv.weapons, next.carryIn.weapons);
  assert.equal(retry.sv.rerolls, next.carryIn.rerolls, 'no free rerolls from retrying');
});

test('a later level without a carried build gets a head start of picks', () => {
  const run = createSurvivalRun(12, undefined, { stage: 2, levelIndex: 3 });
  assert.equal(run.catchUp, SURVIVAL.catchUpPicks * 3);
  assert.equal(run.sv.pendingLevelUps, run.catchUp);
  assert.equal(createSurvivalRun(12).catchUp, 0);
});

test('reroll and banish: limited, and a banished card never comes back this stage', () => {
  const rng = makeSeededRng(2);
  const run = createSurvivalRun(13);
  const r0 = run.sv.rerolls;
  assert.ok(rerollChoices(run, rng)); assert.equal(run.sv.rerolls, r0 - 1);
  run.sv.rerolls = 0; assert.equal(rerollChoices(run, rng), null);
  const card = rollChoices(run, rng).find((c) => c.kind === 'weapon' || c.kind === 'passive' || c.kind === 'armament');
  assert.ok(banishChoice(run, card, rng));
  for (let i = 0; i < 200; i++) assert.ok(!rollChoices(run, rng).some((c) => c.id === card.id), 'banished stays gone');
  run.sv.banishes = 0; assert.equal(banishChoice(run, card, rng), null);
  // ...and it carries with the build.
  assert.ok(snapshotBuild(run).banished.includes(card.id));
});

test('waves have a headline specialist, previewed before the wave turns', () => {
  const run = createSurvivalRun(14, undefined, { stage: 2, levelIndex: 0 });
  const rng = makeSeededRng(6);
  let preview = null; let feature = null;
  for (let t = 0; t < SURVIVAL.waveSeconds + 1 && !feature; t += 0.1) {
    const out = stepDirector(run, 0.1, { spawnDist: 520 }, rng);
    if (out.preview) preview = out.preview;
    if (out.waveStarted === 1) feature = out.feature;
  }
  assert.ok(feature && run.sv.specials.includes(feature));
  assert.equal(preview, feature, 'the preview named the wave that came');
});

test('the last fight: guarded until it moves, then exposed; phases at 2/3 and 1/3', () => {
  const e = { id: 1, x: 300, y: 300, vx: 0, vy: 0, radius: 18, health: 1000, maxHealth: 1000, damageScale: 1, takenMult: SURVIVAL.lordGuard.guarded };
  initLord(e, { levelIndex: 1, stage: 1 }, makeSeededRng(2));
  const run = { boat: { x: 300, y: 460, vx: 0, vy: 0, health: 100 }, coast: null };
  applyDamageToEnemy(e, 100);
  assert.equal(e.health, 1000 - 100 * SURVIVAL.lordGuard.guarded, 'armoured');
  let exposed = false;
  for (let t = 0; t < 12 && !exposed; t += 0.05) exposed = !!stepLord(run, e, 0.05, makeSeededRng(t * 100 | 0), () => null, []).exposed;
  assert.ok(exposed); assert.equal(e.takenMult, SURVIVAL.lordGuard.exposed);
  e.health = 600;
  const p1 = stepLord(run, e, 0.01, Math.random, () => null, []);
  assert.equal(p1.phase, 1);
  e.health = 300;
  const p2 = stepLord(run, e, 0.01, Math.random, () => null, []);
  assert.equal(p2.phase, 2); assert.ok(e.enraged);
});

test('the storm cage: forms round you when the last fight comes, and holds you in', () => {
  const run = createSurvivalRun(15);
  run.sv.wave = WAVES.length - 1; run.sv.waveTime = 0;
  const out = stepDirector(run, 0.05, { spawnDist: 520 }, makeSeededRng(3));
  assert.ok(out.boss && run.sv.cage);
  const c = run.sv.cage;
  assert.ok(Math.hypot(out.boss.x - c.x, out.boss.y - c.y) < c.r, 'the boss is inside');
  const o = { x: c.x + c.r + 50, y: c.y, vx: 100, vy: 0 };
  assert.ok(confineToCage(o, c, 11));
  assert.ok(Math.hypot(o.x - c.x, o.y - c.y) <= c.r - 11 + 1e-6 && o.vx < 0);
  for (const e of run.enemies) if (e !== out.boss && e.health > 0 && !e.lord) assert.ok(Math.hypot(e.x - c.x, e.y - c.y) > c.r, 'the crowd was thrown clear');
});

test('a gale can never blow the ship off the chart', () => {
  const run = createSurvivalRun(16);
  run.boat.x = run.widthPx + 300; run.boat.y = -50;
  stepSurvivalFrame(run, 1 / 30, { x: 0, y: 0 }, { spawnDist: 520, biome: getBiome(run.level.biomeId), rng: makeSeededRng(1), t: 0 });
  assert.ok(run.boat.x < run.widthPx && run.boat.y > 0);
});

// --- Second pass (2026-10-22): research-led additions ----------------------
import { openChest, seedFlotsam, stepFlotsam, powderKeg, spawnRush, stepRushers } from '../src/engine/survival.mjs';
import { FLOTSAM, RUSH } from '../src/data/survival.mjs';
import { resolveLoadout, createDefaultMeta } from '../src/engine/meta.mjs';

test('treasure: the first chest is a sure 3; later ones roll 1, 3 or 5; elites roll better', () => {
  const run = createSurvivalRun(20);
  const rng = makeSeededRng(4);
  const first = openChest(run, rng);
  assert.equal(first.items.length, 3); assert.ok(first.gold > 0);
  const tally = (elite) => { const c = { 1: 0, 3: 0, 5: 0 }; for (let i = 0; i < 300; i++) { const r = createSurvivalRun(21); r.sv.chestsThisLevel = 1; c[openChest(r, rng, { elite }).items.length]++; } return c; };
  const n = tally(false); const e = tally(true);
  assert.ok(n[1] > n[3] && n[3] > n[5] && n[5] > 0);
  assert.ok(e[3] + e[5] > n[3] + n[5], 'elite chests roll bigger');
});

test('flotsam: afloat at the start, broken by ramming, spills loot, drifts back in', () => {
  const run = createSurvivalRun(22);
  assert.equal(run.flotsam.length, FLOTSAM.count);
  const f = run.flotsam[0];
  run.boat.x = f.x; run.boat.y = f.y;
  const before = run.pickups.length;
  const broke = stepFlotsam(run, 1 / 30, [], 11, makeSeededRng(2));
  assert.equal(broke.length, 1);
  assert.ok(run.pickups.length > before, 'loot spilled');
  for (let t = 0; t < FLOTSAM.respawn[1] + 1; t += 0.5) stepFlotsam(run, 0.5, [], 11, makeSeededRng(t * 10 | 0));
  assert.equal(run.flotsam.length, FLOTSAM.count, 'a new crate drifted in');
});

test('powder keg: blasts everything near; a boss loses only a slice', () => {
  const run = createSurvivalRun(23);
  const b = run.boat;
  const near = { id: 1, x: b.x + 100, y: b.y, health: 50, maxHealth: 50 };
  const boss = { id: 2, x: b.x - 100, y: b.y, health: 1000, maxHealth: 1000, isBoss: true };
  const far = { id: 3, x: b.x + 2000, y: b.y, health: 50, maxHealth: 50 };
  run.enemies.push(near, boss, far);
  powderKeg(run);
  assert.equal(near.health, 0); assert.equal(far.health, 50);
  assert.ok(boss.health > 900 && boss.health < 1000);
});

test('becalmed: enemies hold still', () => {
  const run = createSurvivalRun(24);
  const rng = makeSeededRng(3);
  run.sv.waveTime = 5;
  for (let i = 0; i < 90; i++) stepSurvivalFrame(run, 1 / 30, { x: 0, y: 0 }, { spawnDist: 520, biome: getBiome(run.level.biomeId), rng, t: i / 30 });
  const e = run.enemies.find((x) => x.health > 0);
  assert.ok(e);
  run.sv.becalm = 3;
  const x0 = e.x; const y0 = e.y;
  for (let i = 0; i < 30; i++) stepSurvivalFrame(run, 1 / 30, { x: 0, y: 0 }, { spawnDist: 520, biome: getBiome(run.level.biomeId), rng, t: 3 + i / 30 });
  assert.ok(Math.hypot(e.x - x0, e.y - y0) < 3);
});

test('a rush crosses in a straight line and leaves without loot', () => {
  const run = createSurvivalRun(25);
  const n = spawnRush(run, { spawnDist: 520 }, makeSeededRng(7));
  assert.ok(n >= RUSH.count[0] * 0.5);
  const e = run.enemies.find((x) => x.rush);
  const { dx, dy } = e.rush; const x0 = e.x; const y0 = e.y;
  stepRushers(run, 0.5);
  const mx = e.x - x0; const my = e.y - y0;
  assert.ok((mx * dx + my * dy) / Math.hypot(mx, my) > 0.9, 'moving along its line');
  for (let t = 0; t < RUSH.life + 1; t += 0.5) stepRushers(run, 0.5);
  assert.ok(e.health <= 0 && e.detonated, 'gone, no loot');
});

test('each hull starts with its own gun', () => {
  const meta = createDefaultMeta();
  for (const [hull, gun] of [['sloop', 'cannonballs'], ['skiff', 'chain_shot'], ['junk', 'flame_barrels']]) {
    meta.ownedHulls = [...new Set([...meta.ownedHulls, hull])]; meta.selectedHull = hull;
    const run = createSurvivalRun(26, resolveLoadout(meta));
    assert.ok(run.sv.weapons[gun] >= 1, `${hull} → ${gun}`);
  }
});

import { rollOrders, applyOrder, hasOrder, counterBonus } from '../src/engine/survival.mjs';
test('captain\'s orders: three to choose from, they bite, and they carry with the build', () => {
  const run = createSurvivalRun(30);
  const opts = rollOrders(run, makeSeededRng(1));
  assert.equal(opts.length, 3); assert.equal(new Set(opts.map((o) => o.id)).size, 3);
  const n0 = run.flotsam.length;
  assert.ok(applyOrder(run, 'salvage'));
  assert.equal(run.flotsam.length, n0 * 2, 'twice the flotsam');
  assert.ok(!applyOrder(run, 'salvage'), 'not twice');
  assert.ok(!rollOrders(run, makeSeededRng(2)).some((o) => o.id === 'salvage'));
  applyOrder(run, 'specialist');
  assert.equal(counterBonus(run), 2.4);
  const next = createSurvivalRun(31, undefined, { stage: 1, levelIndex: 1, build: snapshotBuild(run) });
  assert.ok(hasOrder(next, 'salvage') && hasOrder(next, 'specialist'));
  assert.equal(next.flotsam.length, n0 * 2, 'the order holds on the next level');
  const r2 = createSurvivalRun(32); applyOrder(r2, 'treasure'); r2.sv.chestsThisLevel = 5;
  for (let i = 0; i < 30; i++) assert.ok(openChest(r2, makeSeededRng(i)).items.length >= 3);
});
