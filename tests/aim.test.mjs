import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictPosition, interceptHeading, trackEnemyMotion, computeAim } from '../src/engine/aim.mjs';
import { getWeapon, WEAPON_IDS } from '../src/data/weapons.mjs';
import { ENEMY_IDS } from '../src/data/enemies.mjs';
import { measure } from '../tools/aim-check.mjs';

const cannon = getWeapon(WEAPON_IDS.CANNONBALLS);

test('intercept meets a straight-line target', () => {
  const e = { x: 100, y: 0, vx: 0, vy: 80, _aimVx: 0, _aimVy: 80, _aimOmega: 0 };
  const { heading, t } = interceptHeading(0, 0, e, 260);
  const shot = { x: Math.cos(heading) * 260 * t, y: Math.sin(heading) * 260 * t };
  const tgt = predictPosition(e, t);
  assert.ok(Math.hypot(shot.x - tgt.x, shot.y - tgt.y) < 1);
  assert.ok(Math.abs(tgt.y - 80 * t) < 1e-6);
});

test('tracking learns a circular path and predicts along the arc', () => {
  const R = 40, w = 2.2, dt = 1 / 60;
  const e = { x: R, y: 0, vx: 0, vy: 0 };
  for (let i = 1; i <= 90; i++) {
    const a = w * i * dt; e.x = R * Math.cos(a); e.y = R * Math.sin(a);
    trackEnemyMotion([e], dt);
  }
  const a0 = w * 90 * dt; const t = 0.25;
  const p = predictPosition(e, t);
  const truth = { x: R * Math.cos(a0 + w * t), y: R * Math.sin(a0 + w * t) };
  const straight = { x: e.x + e._aimVx * t, y: e.y + e._aimVy * t };
  const errArc = Math.hypot(p.x - truth.x, p.y - truth.y);
  const errLine = Math.hypot(straight.x - truth.x, straight.y - truth.y);
  assert.ok(errArc < 4, `arc error ${errArc}`);
  assert.ok(errArc < errLine / 3);
});

test('aim skips a target behind land and prefers the countered enemy', () => {
  const N = 30; const tiles = Array.from({ length: N }, () => Array(N).fill(0));
  for (let y = 0; y < N; y++) tiles[y][18] = 1; // wall at x = 288..304
  const grid = { width: N, height: N, tiles };
  const boat = { x: 240, y: 240 };
  const behindWall = { x: 330, y: 240, radius: 7, health: 10, counter: WEAPON_IDS.GRAPESHOT, vx: 0, vy: 0 };
  const inOpen = { x: 240, y: 330, radius: 7, health: 10, counter: WEAPON_IDS.GRAPESHOT, vx: 0, vy: 0 };
  assert.equal(computeAim([behindWall, inOpen], boat, cannon, { grid, tileSize: 16 }).target, inOpen);
  const nearer = { x: 240, y: 200, radius: 7, health: 10, counter: WEAPON_IDS.GRAPESHOT, vx: 0, vy: 0 };
  const countered = { x: 190, y: 240, radius: 7, health: 10, counter: WEAPON_IDS.CANNONBALLS, vx: 0, vy: 0 };
  assert.equal(computeAim([nearer, countered], boat, cannon, { grid, tileSize: 16 }).target, countered);
  assert.equal(computeAim([behindWall], boat, cannon, { grid, tileSize: 16 }), null);
});

test('cannonballs land on orbiting skimmers and flanking riggers', () => {
  for (const [defId, moving, min] of [
    [ENEMY_IDS.REEF_SKIMMER, false, 0.85], [ENEMY_IDS.REEF_SKIMMER, true, 0.85],
    [ENEMY_IDS.RIGGER, false, 0.85], [ENEMY_IDS.RIGGER, true, 0.8],
    [ENEMY_IDS.GULLSWARM_HARPY, false, 0.8],
  ]) {
    let s = 0, h = 0;
    for (let seed = 1; seed <= 4; seed++) { const r = measure(defId, WEAPON_IDS.CANNONBALLS, computeAim, { moving, seed, seconds: 8 }); s += r.shots; h += r.hits; }
    assert.ok(h / s >= min, `${defId} moving=${moving}: ${(h / s).toFixed(2)}`);
  }
});
