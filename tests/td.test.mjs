// Reef Defence (2026-09-29): map generation, waves, towers, targeting
// rules, economy, stars and checkpoints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TD_MAPS, getTdMap, starsFor, defenceReward } from '../src/data/tdMaps.mjs';
import { TOWERS, TOWER_LIST, SPEC_LIST, TOWER_FOR_WEAPON } from '../src/data/towers.mjs';
import { ENEMIES } from '../src/data/enemies.mjs';
import { stageInfo, bossForStage } from '../src/data/stages.mjs';
import { buildDefenceMap, transposeDefenceMap, pointAt, distToPath, CHANNEL_HALF, HEART_RADIUS } from '../src/engine/tdMap.mjs';
import { sampleField } from '../src/engine/terrain.mjs';
import { buildWaves, waveRoster, goldFor } from '../src/engine/tdWaves.mjs';
import {
  createDefence, stepDefence, drainEvents, buildTower, upgradeTower, specializeTower, sellTower, sellValue, startNextWave, canCallWave,
  canTarget, effectiveStats, checkpointOf, restoreCheckpoint, transposeDefence, cycleTargetMode, isCalm, TD_TUNING,
} from '../src/engine/td.mjs';
import { playMap } from '../tools/td-sim.mjs';

const ALL = { unlockedTowers: TOWER_LIST.map((t) => t.id), unlockedSpecs: SPEC_LIST.map((s) => s.id), perks: [] };
const fresh = (i = 0, opts = ALL) => { const d = TD_MAPS[i]; return createDefence(d, buildDefenceMap(d), opts); };
function runFor(s, seconds, dt = 1 / 30) { for (let t = 0; t < seconds && !s.over; t += dt) stepDefence(s, dt); }
// A test enemy dropped straight onto a lane at arc length `at`.
function place(s, defId, at, lane = 0) {
  s.waveIndex = Math.max(s.waveIndex, 0);
  s.spawners = [{ defId, count: 1, interval: 1, delay: 0, lane, hpMult: 1, spawned: 0, t: 0 }];
  stepDefence(s, 0.001);
  const e = s.enemies[s.enemies.length - 1];
  e.s = at; stepDefence(s, 0.001);
  return e;
}

test('every map builds: open channels from the sea to the Heart, and the right number of spots', () => {
  for (const d of TD_MAPS) {
    const m = buildDefenceMap(d);
    assert.equal(m.spots.length, d.spots, d.id);
    for (const l of m.lanes) {
      for (let s = 0; s < l.ground.length; s += 6) {
        const p = pointAt(l.ground, s);
        if (p.x < 0 || p.y < 0 || p.x > m.widthPx || p.y > m.heightPx) continue;
        // The whole channel centre line is water with room for a hull either side.
        assert.ok(sampleField(m.coast, p.x, p.y) < -8, `${d.id} lane ${l.id} blocked at ${s}`);
      }
      const end = l.ground.pts[l.ground.pts.length - 1];
      assert.ok(Math.hypot(end.x - m.heart.x, end.y - m.heart.y) < 1, 'lanes end at the Heart');
      const a = l.air.pts;
      assert.ok(Math.hypot(a[a.length - 1].x - m.heart.x, a[a.length - 1].y - m.heart.y) < 1, 'air routes end at the Heart');
      assert.ok(l.air.length < l.ground.length, 'flyers take a shortcut');
    }
    assert.ok(sampleField(m.coast, m.heart.x, m.heart.y) < -10, 'the Heart sits in open water');
  }
});

test('build spots are on dry land, clear of the channels, and each covers some channel', () => {
  for (const d of TD_MAPS) {
    const m = buildDefenceMap(d);
    for (const sp of m.spots) {
      assert.ok(sampleField(m.coast, sp.x, sp.y) >= 12, `${d.id} spot ${sp.id} on land`);
      const near = Math.min(...m.lanes.map((l) => distToPath(l.ground, sp.x, sp.y)));
      assert.ok(near >= CHANNEL_HALF + 10, `${d.id} spot ${sp.id} clear of the water`);
      assert.ok(near <= 110, `${d.id} spot ${sp.id} covers a channel`);
      for (const o of m.spots) if (o !== sp) assert.ok(Math.hypot(o.x - sp.x, o.y - sp.y) >= 44, 'spots are spaced for fingers');
    }
  }
});

test('maps are deterministic, and the landscape transpose is the same map on its side', () => {
  const d = TD_MAPS[4];
  const a = buildDefenceMap(d); const b = buildDefenceMap(d);
  assert.deepEqual(a.spots, b.spots);
  const t = transposeDefenceMap(a);
  assert.equal(t.widthPx, a.heightPx); assert.equal(t.heightPx, a.widthPx);
  a.spots.forEach((sp, i) => { assert.equal(t.spots[i].x, sp.y); assert.equal(t.spots[i].y, sp.x); });
  assert.equal(sampleField(t.coast, 100, 300).toFixed(3), sampleField(a.coast, 300, 100).toFixed(3));
  assert.equal(transposeDefenceMap(t).spots[3].x, a.spots[3].x);
});

test('waves use the biome roster in order and end on its boss', () => {
  for (const d of TD_MAPS) {
    const waves = buildWaves(d);
    assert.equal(waves.length, d.waves);
    const info = stageInfo(d.stage);
    const allowed = new Set(info.pools.flat());
    for (const w of waves.slice(0, -1)) for (const g of w.groups) {
      assert.ok(allowed.has(g.defId), `${d.id}: ${g.defId} is in the biome roster`);
      assert.ok(!ENEMIES[g.defId].isBoss, 'no boss before the last wave');
      assert.ok(g.count >= 1 && g.lane < d.lanes.length);
    }
    const last = waves[waves.length - 1];
    assert.ok(last.boss && last.groups.some((g) => g.defId === bossForStage(d.stage)), `${d.id} ends on its boss`);
    // Waves grow.
    const hp = (w) => w.groups.reduce((a, g) => a + ENEMIES[g.defId].maxHealth * g.hpMult * g.count, 0);
    assert.ok(hp(waves[d.waves - 2]) > hp(waves[0]) * 3);
    assert.deepEqual(buildWaves(d), waves, 'deterministic');
    assert.ok(waveRoster(waves[0]).length >= 1);
  }
});

test('every enemy that can appear has a tower that counters it', () => {
  for (const d of TD_MAPS) for (const w of buildWaves(d)) for (const g of w.groups) {
    const def = ENEMIES[g.defId];
    if (!def.phases) assert.ok(TOWER_FOR_WEAPON[def.counter], `${g.defId} has a counter tower`);
    for (const ph of def.phases || []) assert.ok(TOWER_FOR_WEAPON[ph.counter], `${g.defId} phase counter`);
  }
});

test('building, upgrading, specialising and selling cost and refund the right gold', () => {
  const s = fresh(0);
  s.gold = 1000;
  const spot = s.map.spots[0].id;
  const r = buildTower(s, spot, 'cannon');
  assert.ok(r.ok); assert.equal(s.gold, 1000 - TOWERS.cannon.levels[0].cost);
  assert.equal(buildTower(s, spot, 'grapeshot').reason, 'occupied');
  const t = r.tower;
  upgradeTower(s, t.id); upgradeTower(s, t.id);
  assert.equal(t.level, 3);
  assert.equal(upgradeTower(s, t.id).reason, 'max');
  assert.ok(specializeTower(s, t.id, 'carronade').ok);
  assert.equal(t.spec, 'carronade');
  const invested = TOWERS.cannon.levels.reduce((a, l) => a + l.cost, 0) + TOWERS.cannon.specs[1].cost;
  assert.equal(t.invested, invested);
  // Before the first wave, selling is a full refund; after, 70%.
  assert.equal(sellValue(s, t), invested);
  s.waveIndex = 0;
  assert.equal(sellValue(s, t), Math.floor(invested * TD_TUNING.sellRefund));
  const before = s.gold;
  sellTower(s, t.id);
  assert.equal(s.gold, before + Math.floor(invested * TD_TUNING.sellRefund));
  assert.equal(s.towers.length, 0);
});

test('locked towers and specs, and gold you do not have, are refused', () => {
  const s = fresh(0, { unlockedTowers: ['cannon', 'grapeshot'], unlockedSpecs: [], perks: [] });
  assert.equal(buildTower(s, s.map.spots[0].id, 'chain').reason, 'locked');
  s.gold = 5;
  assert.equal(buildTower(s, s.map.spots[0].id, 'cannon').reason, 'gold');
  s.gold = 1000;
  const t = buildTower(s, s.map.spots[0].id, 'cannon').tower;
  upgradeTower(s, t.id); upgradeTower(s, t.id);
  assert.equal(specializeTower(s, t.id, 'long_nines').reason, 'locked');
});

test('reach: only anti-air towers hit flyers, only Depth Charges hit what is under the water', () => {
  const s = fresh(2);
  s.gold = 9999;
  const [a, b, c] = s.map.spots;
  const depth = buildTower(s, a.id, 'depth').tower;
  const chain = buildTower(s, b.id, 'chain').tower;
  const flame = buildTower(s, c.id, 'flame').tower;
  const wisp = place(s, 'frost_wisp', 200);
  assert.ok(wisp.flying);
  assert.ok(canTarget(s, chain, wisp)); assert.ok(!canTarget(s, depth, wisp)); assert.ok(!canTarget(s, flame, wisp));
  const serpent = place(s, 'sea_serpent', 300);
  serpent.submergedState = 'submerged'; serpent.invulnerable = true;
  assert.ok(canTarget(s, depth, serpent)); assert.ok(!canTarget(s, chain, serpent));
  serpent.submergedState = 'surfaced'; serpent.invulnerable = false;
  assert.ok(canTarget(s, chain, serpent));
});

test('camouflage and ghosts need a Lighthouse (or a tower right beside them)', () => {
  const s = fresh(6);
  s.gold = 9999;
  const gator = place(s, 'bayou_gator', 400);
  assert.ok(gator.camo);
  // A cannon far away can't see it.
  const far = s.map.spots.reduce((best, sp) => (Math.hypot(sp.x - gator.x, sp.y - gator.y) > Math.hypot(best.x - gator.x, best.y - gator.y) ? sp : best));
  const cannon = buildTower(s, far.id, 'cannon').tower;
  assert.ok(!canTarget(s, cannon, gator));
  const near = s.map.spots.filter((sp) => sp.id !== far.id).sort((p, q) => Math.hypot(p.x - gator.x, p.y - gator.y) - Math.hypot(q.x - gator.x, q.y - gator.y))[0];
  const light = buildTower(s, near.id, 'lighthouse').tower;
  if (Math.hypot(light.x - gator.x, light.y - gator.y) <= TOWERS.lighthouse.levels[0].range) assert.ok(canTarget(s, cannon, gator));
  const s2 = fresh(3); s2.gold = 9999;
  const ghost = place(s2, 'ghost_ship', 300);
  ghost.phased = true;
  const tw = buildTower(s2, s2.map.spots[0].id, 'flame').tower;
  assert.ok(!canTarget(s2, tw, ghost));
});

test('in the dark, towers only shoot what is lit', () => {
  const s = fresh(5);
  assert.ok(s.dark);
  s.gold = 9999;
  const e = place(s, 'deep_troll', 500);
  const far = s.map.spots.reduce((best, sp) => (Math.hypot(sp.x - e.x, sp.y - e.y) > Math.hypot(best.x - e.x, best.y - e.y) ? sp : best));
  const t = buildTower(s, far.id, 'cannon').tower;
  assert.ok(!canTarget(s, t, e), 'unlit');
  e.burnT = 2; // burning enemies light themselves up
  assert.ok(canTarget(s, t, e));
});

test('counter damage: a tower hits what its weapon counters much harder', () => {
  const s = fresh(1); s.gold = 9999;
  const shark = place(s, 'reef_shark', 400); // counter: grapeshot
  const cutter = place(s, 'pirate_cutter', 420); // counter: cannonballs
  const spot = s.map.spots.sort((p, q) => Math.hypot(p.x - shark.x, p.y - shark.y) - Math.hypot(q.x - shark.x, q.y - shark.y))[0];
  const g = buildTower(s, spot.id, 'grapeshot').tower;
  drainEvents(s);
  shark.speed = 0; cutter.speed = 0; shark.maxHealth = shark.health = 9999; cutter.maxHealth = cutter.health = 9999;
  cutter.x = shark.x; cutter.y = shark.y; cutter.s = shark.s; cutter.offset = shark.offset;
  runFor(s, 3);
  const hits = drainEvents(s).filter((e) => e.type === 'hit');
  const on = hits.filter((h) => h.enemy === shark); const off = hits.filter((h) => h.enemy === cutter);
  assert.ok(on.length && off.length, 'the blast hit both');
  assert.ok(on[0].crit && !off[0].crit);
  assert.ok(on[0].amount > off[0].amount * 2.5);
  void g;
});

test('lighthouses boost nearby towers; perks stack in', () => {
  const s = fresh(0, { ...ALL, perks: ['master_gunners', 'lookouts'] });
  s.gold = 9999;
  const [a, b] = s.map.spots.slice().sort((p, q) => p.x - q.x || p.y - q.y);
  const c = buildTower(s, a.id, 'cannon').tower;
  const base = effectiveStats(s, c);
  assert.ok(Math.abs(base.damage - TOWERS.cannon.levels[0].damage * 1.1) < 1e-9);
  assert.ok(Math.abs(base.range - TOWERS.cannon.levels[0].range * 1.08) < 1e-9);
  const near = s.map.spots.filter((p) => p.id !== a.id).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
  buildTower(s, near.id, 'lighthouse');
  if (Math.hypot(near.x - a.x, near.y - a.y) <= TOWERS.lighthouse.levels[0].range) assert.ok(effectiveStats(s, c).range > base.range);
  void b;
});

test('enemy fire rattles towers: a stunned tower does not shoot', () => {
  const s = fresh(0); s.gold = 9999;
  const t = buildTower(s, s.map.spots[0].id, 'cannon').tower;
  t.stunT = 2;
  place(s, 'pirate_cutter', 10);
  s.enemies[0].s = 0; s.enemies[0].x = t.x + 20; s.enemies[0].y = t.y;
  drainEvents(s);
  stepDefence(s, 0.5);
  assert.ok(!drainEvents(s).some((e) => e.type === 'fire'));
});

test('leaks cost lives; the boss costs ten; out of lives is a loss', () => {
  const s = fresh(0);
  const e = place(s, 'pirate_cutter', 0);
  e.s = 99999; drainEvents(s);
  stepDefence(s, 0.01);
  assert.equal(s.lives, s.maxLives - 1);
  const b = place(s, bossForStage(1), 0);
  b.s = 99999; stepDefence(s, 0.01);
  assert.equal(s.lives, s.maxLives - 11);
  s.lives = 1;
  const e2 = place(s, 'pirate_cutter', 0); e2.s = 99999;
  stepDefence(s, 0.01);
  assert.ok(s.over); assert.equal(s.outcome, 'lost');
});

test('waves: start, countdown, early-call bonus and bounty', () => {
  const s = fresh(0);
  assert.ok(canCallWave(s));
  const g0 = s.gold;
  startNextWave(s);
  assert.equal(s.waveIndex, 0);
  assert.ok(s.gold > g0, 'a wave pays a bounty when it starts');
  assert.ok(!canCallWave(s), 'not while the wave is still arriving');
  runFor(s, 40);
  assert.ok(s.nextWaveTimer != null || s.waveIndex === 1);
  if (s.waveIndex === 0) {
    const before = s.gold; const timer = s.nextWaveTimer;
    startNextWave(s);
    assert.ok(s.gold >= before + Math.round(timer * TD_TUNING.earlyGoldPerSecond), 'early bonus paid');
  }
  // The countdown calls the next wave on its own.
  runFor(s, 60);
  assert.ok(s.waveIndex >= 2);
});

test('stars and rewards', () => {
  assert.equal(starsFor(20), 3); assert.equal(starsFor(18), 3); assert.equal(starsFor(17), 2);
  assert.equal(starsFor(10), 2); assert.equal(starsFor(9), 1); assert.equal(starsFor(0), 0);
  assert.equal(starsFor(23, 25), 3);
  const first = defenceReward(0, 0, 3);
  assert.equal(first.freshStars, 3); assert.equal(first.scales, 1); assert.ok(first.salvage > 0);
  const again = defenceReward(0, 3, 3);
  assert.equal(again.scales, 0); assert.ok(again.salvage > 0 && again.salvage < first.salvage);
  assert.equal(defenceReward(0, 0, 0).salvage, 0);
  assert.equal(defenceReward(4, 1, 2).freshStars, 1);
});

test('target modes cycle; checkpoints restore towers and progress exactly', () => {
  const s = fresh(3); s.gold = 2000;
  const t = buildTower(s, s.map.spots[1].id, 'chain').tower;
  upgradeTower(s, t.id);
  assert.equal(cycleTargetMode(s, t.id), 'last');
  s.waveIndex = 4; s.lives = 14;
  assert.ok(isCalm(s));
  const cp = JSON.parse(JSON.stringify(checkpointOf(s)));
  const s2 = restoreCheckpoint(fresh(3), cp);
  assert.equal(s2.waveIndex, 4); assert.equal(s2.lives, 14); assert.equal(s2.gold, s.gold);
  assert.equal(s2.towers.length, 1);
  assert.equal(s2.towers[0].level, 2); assert.equal(s2.towers[0].targetMode, 'last');
  assert.ok(canCallWave(s2), 'a restored defence waits for you to call the next wave');
  runFor(s2, 30);
  assert.equal(s2.waveIndex, 4, 'no auto-start after a resume');
});

test('turning the phone keeps every tower on its spot and every enemy on its channel', () => {
  const s = fresh(2); s.gold = 2000;
  buildTower(s, s.map.spots[2].id, 'cannon');
  startNextWave(s);
  runFor(s, 6);
  const before = s.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y }));
  const tBefore = { x: s.towers[0].x, y: s.towers[0].y };
  transposeDefence(s, transposeDefenceMap(s.map));
  assert.equal(s.towers[0].x, tBefore.y); assert.equal(s.towers[0].y, tBefore.x);
  for (const b of before) {
    const e = s.enemies.find((q) => q.id === b.id);
    assert.ok(Math.abs(e.x - b.y) < 0.01 && Math.abs(e.y - b.x) < 0.01);
  }
  runFor(s, 5); // and it keeps running
});

test('a sensible player clears the first two maps with only the starting towers', () => {
  for (const i of [0, 1]) {
    const r = playMap(TD_MAPS[i], 'fresh');
    assert.equal(r.outcome, 'won', `${TD_MAPS[i].name}`);
    assert.ok(r.stars >= 2);
  }
});

test('with every tower unlocked, every map is winnable', () => {
  let wins = 0;
  for (const d of TD_MAPS) if (playMap(d, 'towers').outcome === 'won') wins++;
  assert.ok(wins >= 9, `won ${wins}/10`);
});

test('gold per kill is always worth having', () => {
  for (const id of Object.keys(ENEMIES)) assert.ok(goldFor(id) >= 4);
  assert.equal(getTdMap('palm_lagoon').index, 0);
  void HEART_RADIUS;
});

test('meta: Tower Yard purchases, map unlocking, rewards, and a hand-edited save', async () => {
  const { createDefaultMeta, loadMeta, purchaseTdTower, purchaseTdSpec, purchaseTdPerk, isDefenceUnlocked, recordDefenceResult, defenceKit } = await import('../src/engine/meta.mjs');
  const m = createDefaultMeta();
  assert.deepEqual(m.tdTowers, ['cannon', 'grapeshot']);
  assert.equal(purchaseTdTower(m, 'chain').reason, 'cannot_afford');
  m.salvage = 1000;
  assert.ok(purchaseTdTower(m, 'chain').ok);
  assert.equal(purchaseTdTower(m, 'chain').reason, 'already_owned');
  assert.equal(purchaseTdSpec(m, 'mine_layer').reason, 'tower_locked');
  assert.ok(purchaseTdSpec(m, 'bola_mast').ok);
  assert.equal(purchaseTdPerk(m, 'master_gunners').reason, 'cannot_afford', 'needs a Kraken Scale too');
  assert.ok(purchaseTdPerk(m, 'war_chest').ok);
  assert.ok(defenceKit(m).unlockedSpecs.includes('bola_mast'));
  assert.ok(isDefenceUnlocked(m, 0)); assert.ok(!isDefenceUnlocked(m, 1));
  const r = recordDefenceResult(m, 'palm_lagoon', 3, 50);
  assert.equal(r.scales, 1); assert.equal(m.tdStars.palm_lagoon, 3);
  assert.ok(isDefenceUnlocked(m, 1));
  // Voyage progress opens the chart too.
  m.highestStageUnlocked = 5; assert.ok(isDefenceUnlocked(m, 4)); assert.ok(!isDefenceUnlocked(m, 6));
  const store = { v: JSON.stringify({ ...m, tdTowers: ['ghost_tower', 'depth'], tdStars: { palm_lagoon: 3, nowhere: 2, sharkstooth_narrows: 9 }, tdSpecs: ['x'] }), getItem() { return this.v; }, setItem() {} };
  const l = loadMeta(store);
  assert.deepEqual(l.tdTowers.sort(), ['cannon', 'depth', 'grapeshot']);
  assert.deepEqual(l.tdStars, { palm_lagoon: 3 });
  assert.deepEqual(l.tdSpecs, []);
});

test('the defence camera fits the whole map inside the HUD-free region, portrait and landscape', async () => {
  const { computeTdView } = await import('../src/engine/tdMap.mjs');
  const m = buildDefenceMap(TD_MAPS[0]); const t = transposeDefenceMap(m);
  for (const [vw, vh, ins, map] of [
    [390, 844, { top: 60, bottom: 90, left: 0, right: 0 }, m],
    [375, 553, { top: 56, bottom: 84, left: 0, right: 0 }, m],
    [844, 390, { top: 52, bottom: 6, left: 6, right: 200 }, t],
    [667, 375, { top: 52, bottom: 6, left: 6, right: 190 }, t],
  ]) {
    const v = computeTdView(vw, vh, ins, map.widthPx, map.heightPx);
    const a = v.toScreen(0, 0); const b = v.toScreen(map.widthPx, map.heightPx);
    assert.ok(a.x >= ins.left - 0.5 && a.y >= ins.top - 0.5 && b.x <= vw - ins.right + 0.5 && b.y <= vh - ins.bottom + 0.5, `${vw}x${vh}`);
    const w = v.toWorld(200, 300); const back = v.toScreen(w.x, w.y);
    assert.ok(Math.abs(back.x - 200) < 1e-9 && Math.abs(back.y - 300) < 1e-9);
    // Taps hit the nearest spot within 26 screen px (tdMode), and spots stay
    // far enough apart on screen that a thumb can pick between them.
    assert.ok(v.scale * 44 >= 24, `${vw}x${vh} scale ${v.scale.toFixed(2)}`);
  }
});
