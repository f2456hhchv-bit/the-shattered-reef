// Survival mode (2026-10-04): the arena, the wave director, XP and
// level-ups, the auto-firing weapons, loot, progression and saving.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArenaGrid, BIOME_LANDMARKS } from '../src/engine/arena.mjs';
import { createSurvivalRun, buildSurvivalWorld, completeLevel, sinkLevel, levelClearBonus } from '../src/engine/survivalRun.mjs';
import {
  stepDirector, rollChoices, applyChoice, addXp, weaponStats, fireWeapons, afterHits, stepWeaponExtras, dropLoot, stepPickups,
  separateEnemies, recycleStragglers, canEvolve, weaponSlots, timeToBoss, countersInLevel,
} from '../src/engine/survival.mjs';
import { stepSurvivalFrame } from '../src/engine/survivalLoop.mjs';
import { SURVIVAL, SV_WEAPONS, SV_WEAPON_IDS, PASSIVES, WAVES, xpToNext, HORDE_FOR_BIOME } from '../src/data/survival.mjs';
import { ARMAMENTS } from '../src/data/armaments.mjs';
import { getEnemy, ENEMY_LIST } from '../src/data/enemies.mjs';
import { BIOME_IDS, getBiome } from '../src/data/biomes.mjs';
import { createEnemy } from '../src/engine/enemies.mjs';
import { stepCombat, resolveHits, cleanupProjectiles } from '../src/engine/combat.mjs';
import { currentCounter } from '../src/engine/enemies.mjs';
import { sampleField } from '../src/engine/terrain.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';
import { createDefaultMeta, recordLevelResult, isLevelUnlocked, furthestLevel, loadMeta } from '../src/engine/meta.mjs';
import { serializeRun, deserializeRun } from '../src/engine/save.mjs';
import { playLevel } from '../tools/survival-sim.mjs';

const ctx = { spawnDist: 520 };

// An open, rock-free run for weapon tests: the real run, every tile water.
function openRun(seed = 1) {
  const run = createSurvivalRun(seed);
  const N = run.grid.width;
  run.grid = { width: N, height: N, tiles: Array.from({ length: N }, () => Array(N).fill(0)) };
  run.coast = null;
  run.arena.waterDist = Array.from({ length: N }, () => new Float32Array(N).fill(99));
  run.pickups = [];
  return run;
}
function addEnemy(run, defId, dx, dy, hp = null) {
  const e = createEnemy(defId, run.boat.x + dx, run.boat.y + dy);
  e.hunting = true; e.aggro = true;
  if (hp != null) { e.health = hp; e.maxHealth = hp; }
  run.enemies.push(e);
  return e;
}
function shoot(run, seconds) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 30) {
    fireWeapons(run, 1 / 30, run.enemies.filter((e) => e.health > 0), () => 0.5);
    stepCombat(run.weapons, 1 / 30, run.grid, run.tileSize, run.enemies);
    events.push(...resolveHits(run.weapons, run.enemies, currentCounter));
    afterHits(run);
    cleanupProjectiles(run.weapons);
    events.push(...stepWeaponExtras(run, 1 / 30));
  }
  return events;
}

test('arena: deterministic, open in the middle, every pool of water reachable', () => {
  const a = buildArenaGrid(makeSeededRng(5), 'tropical');
  const b = buildArenaGrid(makeSeededRng(5), 'tropical');
  assert.deepEqual(a.grid.tiles, b.grid.tiles);
  const N = a.grid.width; const c = Math.floor(N / 2);
  assert.equal(a.grid.tiles[c][c], 0);
  // Flood fill from the centre reaches every water tile.
  const seen = new Set([`${c},${c}`]); const q = [[c, c]]; let water = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!a.grid.tiles[y][x]) water++;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(k) || a.grid.tiles[ny][nx]) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  assert.equal(seen.size, water);
});

test('arena: a large open map with islands, not a maze — across every biome', () => {
  for (const biomeId of Object.values(BIOME_IDS)) {
    for (let seed = 1; seed <= 4; seed++) {
      const a = buildArenaGrid(makeSeededRng(seed * 31 + 7), biomeId);
      const N = a.grid.width;
      let water = 0;
      for (const row of a.grid.tiles) for (const v of row) if (!v) water++;
      const share = water / (N * N);
      assert.ok(share > 0.45 && share < 0.82, `${biomeId} water share ${share.toFixed(2)}`);
      // A good stretch of open water round the spawn.
      const c = N / 2;
      assert.ok(a.waterDist[Math.floor(c)][Math.floor(c)] >= 8, 'clear water at the spawn');
      // Landmarks stand on land; treasure floats in clear water.
      assert.ok(a.landmarks.length >= 3, `${biomeId} has landmarks`);
      for (const l of a.landmarks) assert.equal(a.grid.tiles[Math.floor(l.ty)][Math.floor(l.tx)], 1);
      for (const ch of a.chestTiles) assert.ok(a.waterDist[Math.floor(ch.ty)][Math.floor(ch.tx)] >= 2.5);
      assert.ok(a.landmarks.some((l) => l.kind === BIOME_LANDMARKS[biomeId]) || a.landmarks.every((l) => l.kind === 'wreck'));
    }
  }
});

test('arena: no water sliver a ship could get jammed in', () => {
  const a = buildArenaGrid(makeSeededRng(99), 'cliff_cove');
  const N = a.grid.width; const T = a.grid.tiles;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (T[y][x]) continue;
      let ok = false;
      for (let oy = -2; oy <= 0 && !ok; oy++) for (let ox = -2; ox <= 0 && !ok; ox++) {
        let all = true;
        for (let dy = 0; dy < 3 && all; dy++) for (let dx = 0; dx < 3; dx++) { const yy = y + oy + dy; const xx = x + ox + dx; if (yy < 0 || xx < 0 || yy >= N || xx >= N || T[yy][xx]) { all = false; break; } }
        ok = all;
      }
      assert.ok(ok, `water tile ${x},${y} sits in a sliver`);
    }
  }
});

test('survival run: a small ship with Cannonballs in the middle of the map', () => {
  const run = createSurvivalRun(42, undefined, { stage: 1, levelIndex: 0 });
  assert.equal(run.mode, 'survival');
  assert.deepEqual(run.sv.weapons, { cannonballs: 1 });
  assert.equal(run.boat.health, run.boat.maxHull);
  assert.equal(run.enemies.length, 0);
  assert.ok(Math.abs(run.boat.x - run.widthPx / 2) < 1 && Math.abs(run.boat.y - run.heightPx / 2) < 1);
  assert.ok(sampleField(run.coast, run.boat.x, run.boat.y) < -60, 'open water round the spawn');
  assert.ok(run.widthPx >= 1800, 'the map is several screens across');
  assert.ok(run.pickups.some((p) => p.kind === 'chest'), 'treasure by the landmarks');
});

test('director: enemies spawn just off-screen on water, waves advance every 30s, the warlord ends it', () => {
  const run = createSurvivalRun(3);
  const rng = makeSeededRng(8);
  let first = null;
  for (let t = 0; t < 5; t += 0.1) {
    const out = stepDirector(run, 0.1, ctx, rng);
    if (!first && out.spawned.length) first = out.spawned;
  }
  assert.ok(first && first.length > 0);
  for (const e of run.enemies) {
    const d = Math.hypot(e.x - run.boat.x, e.y - run.boat.y);
    assert.ok(d > ctx.spawnDist * 0.65, `spawned ${d | 0}px away`);
    assert.ok(e.hunting && e.aggro, 'hunting from the moment it appears');
    if (!getEnemy(e.defId).flies) assert.ok(sampleField(run.coast, e.x, e.y) < 0, 'ships spawn on water');
  }
  assert.equal(run.sv.wave, 0);
  // Run the clock to the final wave.
  for (let t = 0; t < SURVIVAL.waveSeconds * 9 + 1; t += 0.5) stepDirector(run, 0.5, ctx, rng);
  assert.equal(run.sv.wave, WAVES.length - 1);
  assert.equal(timeToBoss(run), 0);
  const boss = run.enemies.find((e) => e.id === run.sv.bossId);
  assert.ok(boss && boss.warlord, 'a warlord leads the last wave of levels 1-4');
  assert.ok(boss.maxHealth > getEnemy(boss.defId).maxHealth * 8);
  assert.ok(!run.sv.finished);
  boss.health = 0;
  stepDirector(run, 0.1, ctx, rng);
  assert.ok(run.sv.finished);
});

test('director: level 5 brings the stage boss; elites come on wave 5', () => {
  const run = createSurvivalRun(4, undefined, { stage: 2, levelIndex: 4 });
  const rng = makeSeededRng(2);
  let elites = 0; let boss = null;
  for (let t = 0; t < SURVIVAL.waveSeconds * 9 + 1; t += 0.5) {
    const out = stepDirector(run, 0.5, ctx, rng);
    elites += out.elites.length;
    if (out.boss) boss = out.boss;
  }
  assert.ok(elites >= 3, 'elites on waves 5 and 8');
  assert.ok(boss && boss.isBoss);
  assert.equal(run.sv.bossDefId, boss.defId);
});

test('director: later levels and stages bring more enemies, barely tougher ones', () => {
  const count = (stage, levelIndex) => {
    const run = createSurvivalRun(11, undefined, { stage, levelIndex });
    const rng = makeSeededRng(5);
    run.sv.wave = 6;
    let n = 0;
    for (let t = 0; t < 20; t += 0.1) n += stepDirector(run, 0.1, { spawnDist: 520 }, rng).spawned.length;
    return { n, hp: run.enemies.reduce((a, e) => a + e.maxHealth / getEnemy(e.defId).maxHealth, 0) / Math.max(1, run.enemies.length) };
  };
  const l1 = count(1, 0); const l5 = count(1, 4);
  assert.ok(l5.n > l1.n * 1.2, `more enemies on level 5 (${l1.n} → ${l5.n})`);
  assert.ok(l5.hp < l1.hp * 1.35, 'not bullet sponges');
});

test('xp: ship levels need a little more each time, and level-ups queue', () => {
  const run = createSurvivalRun(1);
  for (let lv = 1; lv < 30; lv++) assert.ok(xpToNext(lv + 1) > xpToNext(lv));
  const ups = addXp(run, xpToNext(1) + xpToNext(2) + 1);
  assert.equal(ups, 2);
  assert.equal(run.sv.shipLevel, 3);
  assert.equal(run.sv.pendingLevelUps, 2);
});

test('choices: three distinct cards; slots cap at six weapons and six upgrades', () => {
  const run = createSurvivalRun(1);
  const rng = makeSeededRng(3);
  for (let k = 0; k < 40; k++) {
    const cards = rollChoices(run, rng);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((c) => `${c.kind}:${c.id}`)).size, 3);
    applyChoice(run, cards[k % 3]);
    assert.ok(weaponSlots(run).length <= SURVIVAL.maxWeapons);
    assert.ok(Object.keys(run.sv.passives).length <= SURVIVAL.maxPassives);
  }
  // With every slot full, no new weapon is ever offered.
  const full = createSurvivalRun(2);
  for (const id of SV_WEAPON_IDS) full.sv.weapons[id] = 1;
  full.armaments = { harpoon: 1 };
  for (let k = 0; k < 50; k++) {
    for (const c of rollChoices(full, rng)) {
      if (c.kind === 'weapon') assert.ok(full.sv.weapons[c.id], 'only levels for weapons you have');
      if (c.kind === 'armament') assert.ok(full.armaments[c.id]);
    }
  }
});

test('choices: a maxed weapon with its partner upgrade is always offered its evolution', () => {
  for (const id of SV_WEAPON_IDS) {
    const run = createSurvivalRun(1);
    run.sv.weapons[id] = 5;
    assert.ok(!canEvolve(run, id));
    applyChoice(run, { kind: 'passive', id: SV_WEAPONS[id].evolve.with });
    assert.ok(canEvolve(run, id));
    const cards = rollChoices(run, Math.random);
    assert.deepEqual(cards[0], { kind: 'evolve', id });
    applyChoice(run, cards[0]);
    assert.ok(run.sv.evolved[id]);
    assert.ok(weaponStats(run, id).damage >= SV_WEAPONS[id].levels[4].damage);
  }
});

test('build caps: 5 weapons, 5 upgrades, only 3 evolutions', () => {
  assert.equal(SURVIVAL.maxWeapons, 5);
  assert.equal(SURVIVAL.maxPassives, 5);
  const run = createSurvivalRun(3);
  for (const id of SV_WEAPON_IDS) {
    run.sv.weapons[id] = 5;
    run.sv.passives[SV_WEAPONS[id].evolve.with] = 1;
  }
  const evolved = [];
  for (const id of SV_WEAPON_IDS) if (canEvolve(run, id)) { applyChoice(run, { kind: 'evolve', id }); evolved.push(id); }
  assert.equal(evolved.length, 3);
  for (const id of SV_WEAPON_IDS) if (!run.sv.evolved[id]) assert.ok(!canEvolve(run, id));
  // Full slots: no new weapon, armament or upgrade is offered.
  for (let k = 0; k < 40; k++) {
    for (const c of rollChoices(run, Math.random)) {
      assert.notEqual(c.kind, 'evolve');
      if (c.kind === 'armament') assert.ok(false, 'armament offered with full weapon slots');
      if (c.kind === 'passive') assert.ok(run.sv.passives[c.id], 'new upgrade offered with full upgrade slots');
    }
  }
});

test('passives change the ship: hull, speed, reload, pickup reach', () => {
  const run = createSurvivalRun(1);
  const hull = run.boat.maxHull; const speed = run.tuning.maxSpeed; const cd = weaponStats(run, 'cannonballs').cooldown;
  run.boat.health = 50;
  applyChoice(run, { kind: 'passive', id: 'hull' });
  assert.equal(run.boat.maxHull, hull + 20);
  assert.equal(run.boat.health, 70, 'the new planks come whole');
  applyChoice(run, { kind: 'passive', id: 'sails' });
  assert.ok(run.tuning.maxSpeed > speed);
  applyChoice(run, { kind: 'passive', id: 'gun_crew' });
  assert.ok(weaponStats(run, 'cannonballs').cooldown < cd);
  applyChoice(run, { kind: 'passive', id: 'armour' });
  assert.ok(run.sv.stats.damageTaken < 1);
  for (const p of PASSIVES) for (let k = 0; k < 6; k++) applyChoice(run, { kind: 'passive', id: p.id });
  for (const v of Object.values(run.sv.passives)) assert.ok(v <= 5);
});

test('weapons: each core weapon fires on its own and sinks what it counters faster', () => {
  for (const id of SV_WEAPON_IDS) {
    const counterFoe = ENEMY_LIST.find((e) => e.counter === id && !e.isBoss && !e.flies && e.archetype !== 'submerged' && e.archetype !== 'serpent' && e.archetype !== 'ghost' && e.archetype !== 'siren');
    const otherFoe = ENEMY_LIST.find((e) => e.counter !== id && !e.isBoss && !e.flies && e.archetype === 'tank');
    const hitWith = (foe) => {
      const run = openRun();
      delete run.sv.weapons.cannonballs;
      run.sv.weapons[id] = 3;
      const e = addEnemy(run, foe.id, 90, 0, 5000);
      e.speed = 0;
      shoot(run, 4);
      return 5000 - e.health;
    };
    const onCounter = hitWith(counterFoe); const off = hitWith(otherFoe);
    assert.ok(onCounter > 0, `${id} damages ${counterFoe.id}`);
    assert.ok(off > 0, `${id} still hurts what it doesn't counter`);
    assert.ok(onCounter > off * 1.3, `${id}: counter ${onCounter | 0} vs off ${off | 0}`);
  }
});

test('weapons: only Depth Charges reach an enemy hiding underwater', () => {
  const tryWith = (id) => {
    const run = openRun();
    delete run.sv.weapons.cannonballs;
    run.sv.weapons[id] = 3;
    const e = addEnemy(run, 'deep_crawler', 100, 0, 5000);
    e.speed = 0; e.submergedState = 'submerged'; e.invulnerable = true; e.submergedTimer = 999;
    shoot(run, 4);
    return 5000 - e.health;
  };
  assert.ok(tryWith('depth_charges') > 0);
  assert.equal(tryWith('cannonballs'), 0);
  assert.equal(tryWith('grapeshot'), 0);
});

test('Flame Barrels leave fire on the water that burns ships but not flyers', () => {
  const run = openRun();
  delete run.sv.weapons.cannonballs;
  run.sv.weapons.flame_barrels = 2;
  const ship = addEnemy(run, 'ironclad_brigand', 120, 0, 5000); ship.speed = 0;
  shoot(run, 3);
  assert.ok(run.sv.pools.length > 0 || 5000 - ship.health > 0);
  assert.ok(5000 - ship.health > 20, 'the pool burns the ship sitting in it');
  const flyer = addEnemy(run, 'gullswarm_harpy', 0, 0, 500); flyer.speed = 0;
  run.sv.pools = [{ x: flyer.x, y: flyer.y, r: 40, t: 0, duration: 3, burn: 10, every: 0.4, tick: 0 }];
  const ev = stepWeaponExtras(run, 0.05);
  assert.ok(!ev.some((h) => h.enemy === flyer));
});

test('loot: kills drop sea glass, and anything sunk over land spills toward you onto water', () => {
  const run = createSurvivalRun(9);
  const e = createEnemy('raider_longboat', run.boat.x + 100, run.boat.y);
  e.xp = 7;
  dropLoot(run, e, makeSeededRng(1));
  const gems = run.pickups.filter((p) => p.kind === 'gem');
  assert.equal(gems.reduce((a, g) => a + g.value, 0), 7);
  // A flyer sunk over an island.
  let land = null;
  for (let y = 40; y < run.heightPx && !land; y += 16) for (let x = 40; x < run.widthPx; x += 16) if (sampleField(run.coast, x, y) > 30) { land = { x, y }; break; }
  const f = createEnemy('gullswarm_harpy', land.x, land.y);
  run.pickups = [];
  dropLoot(run, f, makeSeededRng(1));
  for (const p of run.pickups) assert.ok(sampleField(run.coast, p.x, p.y) < 0, 'the gem lands on water');
});

test('pickups: gems in reach fly to the ship and level it up', () => {
  const run = createSurvivalRun(9);
  run.pickups = [];
  const e = createEnemy('raider_longboat', run.boat.x + 30, run.boat.y); e.xp = 30;
  dropLoot(run, e, makeSeededRng(1));
  let xp = 0;
  for (let t = 0; t < 1.5; t += 1 / 30) xp += stepPickups(run, 1 / 30).xp;
  assert.equal(xp, 30);
  // Out of reach stays put.
  const far = createEnemy('raider_longboat', run.boat.x + 300, run.boat.y); far.xp = 1;
  dropLoot(run, far, makeSeededRng(1));
  for (let t = 0; t < 1; t += 1 / 30) stepPickups(run, 1 / 30);
  assert.ok(run.pickups.some((p) => p.kind === 'gem' && !p.collected));
});

test('crowds: overlapping enemies push apart; stragglers are brought back in', () => {
  const run = openRun();
  const a = addEnemy(run, 'raider_longboat', 100, 0); const b = addEnemy(run, 'raider_longboat', 101, 0);
  separateEnemies(run.enemies);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 6);
  const far = addEnemy(run, 'raider_longboat', 1500, 0);
  recycleStragglers(run, ctx, makeSeededRng(1));
  assert.ok(Math.hypot(far.x - run.boat.x, far.y - run.boat.y) < 1000);
});

test('every biome has a horde, and each horde enemy keeps a counter', () => {
  for (const b of Object.values(BIOME_IDS)) {
    const id = HORDE_FOR_BIOME[b];
    assert.ok(id, b);
    const d = getEnemy(id);
    assert.ok(d.horde && d.counter && d.maxHealth <= 16);
  }
  for (const id of SV_WEAPON_IDS) assert.ok(SV_WEAPONS[id].levels.length === 5 && SV_WEAPONS[id].evolve.with);
  for (const a of ARMAMENTS) assert.ok(a.desc.length >= 5);
});

test('level cards say which of this level\'s enemies a weapon counters', () => {
  const run = createSurvivalRun(1, undefined, { stage: 2, levelIndex: 2 });
  assert.ok(countersInLevel(run, 'chain_shot').includes('Gullswarm Harpy'));
});

test('progression: clearing a level opens the next; level 5 opens the next stage', () => {
  const meta = createDefaultMeta();
  assert.ok(isLevelUnlocked(meta, 1, 0));
  assert.ok(!isLevelUnlocked(meta, 1, 1));
  const run = createSurvivalRun(1, undefined, { stage: 1, levelIndex: 0 });
  run.reefSalvage = 40;
  completeLevel(run);
  assert.equal(run.bankedSalvage, 40 + levelClearBonus(run));
  const r = recordLevelResult(meta, run);
  assert.ok(r.unlockedLevel);
  assert.ok(isLevelUnlocked(meta, 1, 1));
  assert.equal(meta.salvage, 40 + levelClearBonus(run));
  const boss = createSurvivalRun(1, undefined, { stage: 1, levelIndex: 4 });
  boss.bossDefeated = true;
  completeLevel(boss);
  const r2 = recordLevelResult(meta, boss);
  assert.ok(r2.unlockedStage);
  assert.equal(meta.highestStageUnlocked, 2);
  assert.equal(meta.krakenScales, 1);
  assert.equal(furthestLevel(meta, 2), 0);
  // A sinking keeps half the haul and unlocks nothing.
  const sunk = createSurvivalRun(2, undefined, { stage: 2, levelIndex: 0 });
  sunk.reefSalvage = 30; sunk.over = true; sunk.outcome = 'sunk';
  sinkLevel(sunk);
  assert.equal(sunk.bankedSalvage, 15);
  assert.ok(!recordLevelResult(meta, sunk).unlockedLevel);
  // Saved and loaded intact; junk is dropped.
  const store = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  store.v = JSON.stringify({ ...meta, levelsCleared: { 1: 5, 2: 'x', 0: 3 } });
  assert.deepEqual(loadMeta(store).levelsCleared, { 1: 5 });
});

test('save: a survival level round-trips mid-wave', () => {
  const run = createSurvivalRun(77, undefined, { stage: 3, levelIndex: 2 });
  const rng = makeSeededRng(4);
  for (let t = 0; t < 8; t += 1 / 30) stepSurvivalFrame(run, 1 / 30, { x: 1, y: 0 }, { spawnDist: 520, biome: getBiome(run.level.biomeId), rng });
  applyChoice(run, { kind: 'weapon', id: 'chain_shot' });
  const back = deserializeRun(JSON.parse(JSON.stringify(serializeRun(run))));
  assert.equal(back.sv.wave, run.sv.wave);
  assert.deepEqual(back.sv.weapons, run.sv.weapons);
  assert.equal(back.boat.x, run.boat.x);
  assert.equal(back.enemies.length, run.enemies.filter((e) => e.health > 0).length);
  assert.deepEqual(back.grid.tiles, run.grid.tiles);
  assert.ok(back.landmarks.length > 0);
  // And it plays on.
  stepSurvivalFrame(back, 1 / 30, { x: 0, y: 1 }, { spawnDist: 520, biome: getBiome(back.level.biomeId), rng });
});

test('a bot clears stage 1 level 1 through the real frame loop', () => {
  const r = playLevel(1001, { stage: 1, levelIndex: 0, maxSeconds: 420 });
  assert.equal(r.outcome, 'victory', JSON.stringify(r));
  assert.ok(r.shipLevel >= 8, 'the ship grows over a level');
  assert.ok(r.kills > 300, 'and it faces a horde');
  assert.ok(r.t > 260 && r.t < 400, `about five minutes (${r.t}s)`);
});
