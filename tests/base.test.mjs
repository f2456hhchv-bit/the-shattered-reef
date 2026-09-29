import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseWorld, boatOrbitPoint, computeBaseView, labelRect } from '../src/engine/base.mjs';
import { BASE_BUILDINGS, BASE_LAYOUT } from '../src/data/base.mjs';
import { sampleField } from '../src/engine/terrain.mjs';

const world = buildBaseWorld();

test('base: every building stands well inland on its island', () => {
  for (const b of world.buildings) {
    const s = sampleField(world.coast, b.x, b.y);
    assert.ok(s > 30, `${b.id} is only ${s.toFixed(1)}px from the shore`);
  }
});

test('base: the boat\'s lagoon orbit is open water all the way round, with room for the hull', () => {
  for (let t = 0; t < BASE_LAYOUT.boatOrbit.secondsPerLap; t += 0.25) {
    const p = boatOrbitPoint(t);
    assert.ok(sampleField(world.coast, p.x, p.y) < -14, `orbit touches land at t=${t}`);
  }
});

test('base: the lagoon opens to the sea through channels (not a closed pond)', () => {
  const g = world.grid; const W = g.width;
  const start = [Math.floor(W / 2), Math.floor(W / 2)];
  const seen = new Set([start.join()]); const q = [start]; let reachedFar = false;
  while (q.length) {
    const [x, y] = q.pop();
    if (Math.hypot(x - W / 2, y - W / 2) > 30) { reachedFar = true; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= W || g.tiles[ny][nx] !== 0 || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`); q.push([nx, ny]);
    }
  }
  assert.ok(reachedFar);
});

test('base: every building has a real Hub panel, and ids are unique', () => {
  const panels = new Set(['hulls', 'cargo', 'charms', 'factions', 'workshop', 'log', 'towers']);
  const ids = new Set();
  for (const b of BASE_BUILDINGS) {
    assert.ok(panels.has(b.panel), `${b.id} opens unknown panel ${b.panel}`);
    assert.ok(!ids.has(b.id)); ids.add(b.id);
  }
  // The Captain's Log is opened from the captain chip (main.mjs), every other panel from a building.
  assert.deepEqual(new Set([...BASE_BUILDINGS.map((b) => b.panel), 'log']), panels, 'every panel is reachable');
});

test('base view: every building and its label chip fit the free region on phones', () => {
  for (const [vw, vh, free] of [
    [390, 844, { top: 70, bottom: 240, left: 0, right: 0 }],
    [360, 740, { top: 66, bottom: 232, left: 0, right: 0 }],
    [375, 553, { top: 62, bottom: 194, left: 0, right: 0 }], // iPhone SE, Safari bars
    [390, 664, { top: 62, bottom: 194, left: 0, right: 0 }],
    [844, 390, { top: 62, bottom: 6, left: 6, right: 266 }],
    [667, 375, { top: 62, bottom: 6, left: 6, right: 266 }],
  ]) {
    const v = computeBaseView(vw, vh, free);
    for (const b of world.buildings) {
      const s = v.toScreen(b.x, b.y - BASE_LAYOUT.spriteAbove);
      assert.ok(s.y >= free.top - 1, `${vw}x${vh}: ${b.id} art top ${s.y.toFixed(0)}`);
      const r = labelRect(v, b);
      assert.ok(r.left >= free.left - 1 && r.right <= vw - free.right + 1, `${vw}x${vh}: ${b.id} label x ${r.left.toFixed(0)}..${r.right.toFixed(0)}`);
      assert.ok(r.bottom <= vh - free.bottom + 1, `${vw}x${vh}: ${b.id} label bottom ${r.bottom.toFixed(0)}`);
    }
  }
});
