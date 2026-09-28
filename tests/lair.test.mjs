import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLairGrid, LAIR_TUNING } from '../src/engine/lair.mjs';
import { isFullyConnected, isOpenWithClearance } from '../src/engine/maze.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';
import { createRun, checkReachedExit, isExitOpen, BOAT_RADIUS, TILE_SIZE } from '../src/engine/run.mjs';
import { sampleField } from '../src/engine/terrain.mjs';
import { updateEnemies } from '../src/engine/enemies.mjs';
import { createBoat } from '../src/engine/boat.mjs';

function toLair(seed) {
  const run = createRun(0, undefined, { stage: seed });
  for (let i = 0; i < 4; i++) { run.boat.x = run.exitWorld.x; run.boat.y = run.exitWorld.y; checkReachedExit(run); }
  return run;
}

// Tile BFS through tiles with a full ring of water (room for the hull).
function clearPathExists(grid, from, to) {
  const W = grid.width; const seen = new Uint8Array(W * grid.height);
  const q = [from.ty * W + from.tx]; seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const k = q[i]; if (k === to.ty * W + to.tx) return true;
    const x = k % W; const y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const nk = ny * W + nx;
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= grid.height - 1 || seen[nk] || !isOpenWithClearance(grid, nx, ny)) continue;
      seen[nk] = 1; q.push(nk);
    }
  }
  return false;
}

test('lair: fully connected, and the pit centre is reachable from the spawn with hull clearance, across seeds', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const L = buildLairGrid(makeSeededRng(seed));
    const s = { tx: Math.floor(L.spawnTile.tx), ty: Math.floor(L.spawnTile.ty) };
    assert.ok(isFullyConnected(L.grid, s), `seed ${seed} connected`);
    const c = { tx: Math.floor(L.centreTile.tx) + 2, ty: Math.floor(L.centreTile.ty) };
    assert.ok(clearPathExists(L.grid, s, { tx: Math.floor(L.centreTile.tx), ty: Math.floor(L.centreTile.ty) }) || clearPathExists(L.grid, s, c), `seed ${seed}: pit reachable`);
  }
});

test('lair: it is round — the map corners are solid and the pit is open water', () => {
  const L = buildLairGrid(makeSeededRng(7));
  const W = L.grid.width;
  for (const [x, y] of [[2, 2], [W - 3, 2], [2, W - 3], [W - 3, W - 3]]) assert.equal(L.grid.tiles[y][x], 1);
  assert.equal(L.grid.tiles[Math.floor(W / 2)][Math.floor(W / 2)], 0);
});

test('lair: channels never pinch below a hull-width in the drawn coast along both rings', () => {
  for (let stage = 1; stage <= 12; stage++) {
    const run = toLair(stage);
    assert.ok(run.lair, `stage ${stage} level 5 should be a lair`);
    const c = run.lair.centre;
    // Along each ring, the best radius at every angle must leave room for the hull.
    for (const ring of [LAIR_TUNING.middleRing, LAIR_TUNING.outerRing]) {
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        let best = Infinity;
        for (let dr = -ring.halfWidth - 3; dr <= ring.halfWidth + 3; dr += 0.25) {
          const r = (ring.radius + dr) * TILE_SIZE;
          best = Math.min(best, sampleField(run.coast, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r));
        }
        assert.ok(best <= -(BOAT_RADIUS + 1), `stage ${stage}: ring r=${ring.radius} pinched at angle ${a.toFixed(2)} (${best.toFixed(1)}px)`);
      }
    }
  }
});

test('lair: the boss lives in the pit, regular enemies stay out of it, and the spawn is quiet', () => {
  for (let stage = 1; stage <= 12; stage++) {
    const run = toLair(stage);
    const boss = run.enemies.find((e) => e.isBoss);
    assert.ok(boss);
    assert.ok(Math.hypot(boss.x - run.lair.centre.x, boss.y - run.lair.centre.y) < 1);
    for (const e of run.enemies) {
      if (e.isBoss) continue;
      assert.ok(Math.hypot(e.x - run.lair.centre.x, e.y - run.lair.centre.y) > run.lair.pitRadius, `stage ${stage}: ${e.defId} spawned in the pit`);
    }
    assert.ok(sampleField(run.coast, run.boat.x, run.boat.y) < -BOAT_RADIUS, 'spawn in open water');
  }
});

test('lair: the boss is tethered to its pit and never follows the boat out', () => {
  const run = toLair(3);
  const boss = run.enemies.find((e) => e.isBoss);
  boss.aggro = true;
  const far = createBoat(run.lair.centre.x, run.lair.centre.y + run.lair.pitRadius * 2.4, 0); // out on the middle ring
  for (let i = 0; i < 60 * 20; i++) {
    updateEnemies([boss], far, 1 / 60, run.grid, run.tileSize, run.coast);
    assert.ok(Math.hypot(boss.x - run.lair.centre.x, boss.y - run.lair.centre.y) <= run.lair.pitRadius, 'boss left its pit');
  }
});

test('lair: the exit is sealed until the boss dies, then opens', () => {
  const run = toLair(5);
  run.boat.x = run.exitWorld.x; run.boat.y = run.exitWorld.y;
  assert.equal(isExitOpen(run), false);
  assert.equal(checkReachedExit(run), null);
  run.enemies.find((e) => e.isBoss).health = 0;
  assert.equal(isExitOpen(run), true);
  assert.equal(checkReachedExit(run), 'victory');
});

test('lair: deterministic from its level', () => {
  const a = toLair(9); const b = toLair(9);
  assert.deepEqual(a.grid.tiles, b.grid.tiles);
  assert.equal(a.levelCode, b.levelCode);
});
