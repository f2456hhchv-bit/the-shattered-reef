// Weather and hazards (2026-09-29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER, BIOME_WEATHER } from '../src/data/weather.mjs';
import { createWeather, startWeather, stepWeather, weatherModifiers } from '../src/engine/weather.mjs';
import { createRun } from '../src/engine/run.mjs';
import { stepBoat, DEFAULT_BOAT_TUNING } from '../src/engine/boat.mjs';
import { createEnemy, updateEnemy } from '../src/engine/enemies.mjs';
import { ENEMY_IDS } from '../src/data/enemies.mjs';
import { sampleField } from '../src/engine/terrain.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

// Open sea, no shore: forces and hazards on their own.
function openRun() {
  const run = createRun(1);
  const W = 120;
  run.grid = { width: W, height: W, tiles: Array.from({ length: W }, () => Array(W).fill(0)) };
  run.coast = null; run.widthPx = W * 16; run.heightPx = W * 16;
  run.enemies = [];
  Object.assign(run.boat, { x: 960, y: 960, vx: 0, vy: 0, heading: 0 });
  run.weather = createWeather('tropical');
  return run;
}
const rng = () => makeSeededRng(42);

test('weather: every biome has at least five kinds of weather, all defined', () => {
  for (const [biome, table] of Object.entries(BIOME_WEATHER)) {
    assert.ok(Object.keys(table).length >= 5, biome);
    for (const id of Object.keys(table)) assert.ok(WEATHER[id], `${biome}: ${id}`);
  }
  assert.ok(Object.keys(WEATHER).length >= 12);
});

test('weather: quiet at the start of a level, then an event comes and goes', () => {
  const run = openRun();
  let started = null; let ended = null; let t = 0;
  const r = rng();
  for (; t < 120 && !ended; t += 1 / 30) {
    const res = stepWeather(run, 1 / 30, r);
    if (res.started) { started = t; assert.ok(t >= 15, 'no weather in the first 15s'); }
    if (res.ended) ended = t;
  }
  assert.ok(started != null && ended != null && ended > started);
  assert.equal(run.weather.active, null);
});

test('weather: a gale drifts a ship that is not steering', () => {
  const run = openRun();
  assert.ok(startWeather(run, 'gale', rng()));
  for (let i = 0; i < 90; i++) { stepBoat(run.boat, { x: 0, y: 0 }, 1 / 30, DEFAULT_BOAT_TUNING); stepWeather(run, 1 / 30); run.boat.x += 0; }
  const w = run.weather.wind;
  const along = run.boat.vx * w.x + run.boat.vy * w.y;
  assert.ok(along > 0 && Math.hypot(run.boat.vx, run.boat.vy) > 15, 'blown downwind');
});

test('weather: a whirlpool drags you in, but full sail away always escapes', () => {
  const run = openRun();
  assert.ok(startWeather(run, 'whirlpool', rng()));
  const wh = run.weather.whirl;
  // Idle at half radius: pulled toward the eye.
  Object.assign(run.boat, { x: wh.x + wh.r * 0.5, y: wh.y, vx: 0, vy: 0 });
  for (let i = 0; i < 60; i++) { stepBoat(run.boat, { x: 0, y: 0 }, 1 / 30); stepWeather(run, 1 / 30); run.boat.x += run.boat.vx / 30; run.boat.y += run.boat.vy / 30; }
  assert.ok(Math.hypot(run.boat.x - wh.x, run.boat.y - wh.y) < wh.r * 0.5, 'pulled in');
  // From right at the eye, sailing straight out gets clear.
  Object.assign(run.boat, { x: wh.x + 5, y: wh.y, vx: 0, vy: 0, heading: 0 });
  for (let i = 0; i < 30 * 6; i++) { stepBoat(run.boat, { x: 1, y: 0 }, 1 / 30); stepWeather(run, 1 / 30); run.boat.x += run.boat.vx / 30; run.boat.y += run.boat.vy / 30; }
  assert.ok(Math.hypot(run.boat.x - wh.x, run.boat.y - wh.y) > wh.r, 'escaped');
});

test('weather: lightning marks a spot first, then hits the boat and enemies inside it', () => {
  const run = openRun();
  assert.ok(startWeather(run, 'thunderstorm', rng()));
  const e = createEnemy(ENEMY_IDS.PIRATE_BRIG, 980, 960); run.enemies = [e];
  run.weather.active.next = 99; // no random strikes
  run.weather.strikes.push({ x: 965, y: 960, warn: 1.2, max: 1.2, r: 34 });
  const hp = run.boat.health; const ehp = e.health;
  let res;
  for (let i = 0; i < 30; i++) { res = stepWeather(run, 1 / 30); assert.equal(res.boatHits.length, 0, 'no damage during the warning'); }
  for (let i = 0; i < 10; i++) { res = stepWeather(run, 1 / 30); if (res.strikes.length) break; }
  assert.equal(res.strikes.length, 1);
  assert.ok(run.boat.health < hp && e.health < ehp);
});

test('weather: a rogue wave carries you along and hurts once', () => {
  const run = openRun();
  assert.ok(startWeather(run, 'rogue_wave', rng()));
  const dir = run.weather.wave.dir;
  let hits = 0; let carried = 0;
  for (let i = 0; i < 30 * 12 && run.weather.active; i++) {
    const res = stepWeather(run, 1 / 30); hits += res.boatHits.length;
    carried = Math.max(carried, run.boat.vx * dir.x + run.boat.vy * dir.y);
  }
  assert.equal(hits, 1);
  assert.ok(carried > 150);
});

test('weather: ramming an ice floe hurts and does not pass through it', () => {
  const run = openRun();
  run.weather = createWeather('glacial');
  assert.ok(startWeather(run, 'ice_floes', rng()));
  const fl = run.weather.floes[0];
  fl.vx = 0; fl.vy = 0;
  Object.assign(run.boat, { x: fl.x - fl.r - 30, y: fl.y, vx: 120, vy: 0 });
  let dmg = 0;
  for (let i = 0; i < 30; i++) {
    run.boat.x += run.boat.vx / 30; run.boat.y += run.boat.vy / 30;
    for (const h of stepWeather(run, 1 / 30).boatHits) dmg += h.damage;
    assert.ok(Math.hypot(run.boat.x - fl.x, run.boat.y - fl.y) >= fl.r + 11 - 0.01, 'inside the floe');
  }
  assert.ok(dmg > 0);
});

test('weather: fog and rain hide you — enemies wake at a shorter range', () => {
  const run = openRun();
  assert.ok(startWeather(run, 'fog', rng()));
  run.weather.time = 10; // fully rolled in
  const m = weatherModifiers(run.weather);
  assert.ok(m.sight <= 0.55 && m.view > 0);
  const e = createEnemy(ENEMY_IDS.PIRATE_CUTTER, 960 + 150, 960);
  run.boat.sightMult = m.sight;
  for (let i = 0; i < 60; i++) updateEnemy(e, run.boat, 1 / 30, run.grid, 16, null);
  assert.equal(e.aggro, false, 'hidden in the fog at 150px');
  run.boat.sightMult = 1;
  for (let i = 0; i < 60; i++) updateEnemy(e, run.boat, 1 / 30, run.grid, 16, null);
  assert.equal(e.aggro, true, 'seen in clear weather');
});

test('weather: rock and ice only fall near the cliffs', () => {
  for (const [biome, id] of [['cliff_cove', 'rockfall'], ['glacial', 'icefall']]) {
    for (let seed = 1; seed <= 6; seed++) {
      const run = createRun(seed * 11);
      run.weather = createWeather(biome);
      assert.ok(startWeather(run, id, makeSeededRng(seed)));
      const band = WEATHER[id].shoreBand;
      for (let i = 0; i < 30 * 8; i++) {
        stepWeather(run, 1 / 30, makeSeededRng(seed * 100 + i));
        for (const d of run.weather.drops) {
          const depth = -sampleField(run.coast, d.x, d.y);
          assert.ok(depth >= band[0] - 0.01 && depth <= band[1] + 0.01, `${id} off the shore band: ${depth}`);
        }
      }
    }
  }
});

test('weather: ghost lights pay Salvage when you sail through them', () => {
  const run = openRun();
  run.weather = createWeather('shipwreck');
  assert.ok(startWeather(run, 'ghost_lights', rng()));
  const l = run.weather.lights[0];
  Object.assign(run.boat, { x: l.x, y: l.y });
  assert.equal(stepWeather(run, 1 / 30).salvage, WEATHER.ghost_lights.salvage);
});

test('weather: every event can start on real levels of its biome and runs to the end without errors', () => {
  for (const [biome, table] of Object.entries(BIOME_WEATHER)) {
    for (const id of Object.keys(table)) {
      const run = createRun(5, undefined, { stage: 1 + Object.keys(BIOME_WEATHER).indexOf(biome) });
      run.weather = createWeather(biome);
      let ok = false;
      for (let s = 0; s < 5 && !ok; s++) ok = startWeather(run, id, makeSeededRng(s + 1));
      assert.ok(ok, `${biome}/${id} could not start`);
      for (let i = 0; i < 30 * 40 && run.weather.active; i++) stepWeather(run, 1 / 30);
      assert.equal(run.weather.active, null, `${biome}/${id} never ended`);
      assert.ok(Number.isFinite(run.boat.x) && Number.isFinite(run.boat.vx));
    }
  }
});
