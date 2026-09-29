// Enemy gunnery (2026-09-29). Ships shoot back; serpents spit. Pure logic.
//
// Every shot is readable: a wind-up (`enemy.gunWindup`, drawn as glowing
// gunports and a sighting line) before the projectile leaves, and shots
// slow enough to steer out of. Gun data lives in data/enemies.mjs (GUNS).

import { sampleField } from './terrain.mjs';
import { hasLineOfSight } from './enemies.mjs';

let nextShotId = 1;

function randRange(rng, [a, b]) { return a + rng() * (b - a); }

function canShoot(enemy) {
  const g = enemy.gun;
  if (!g || enemy.health <= 0 || !enemy.aggro) return false;
  if (g.onlyWhenSurfaced && enemy.submergedState !== 'surfaced') return false;
  if (g.oncePerSurface && enemy._shotThisSurface) return false;
  if (enemy.sharkState === 'stunned') return false;
  return true;
}

// Where to aim: lead the boat by its velocity over the flight time, a bit
// short of a perfect lead so a boat that keeps turning slips the shot.
function leadPoint(enemy, boat, speed) {
  const d = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
  const t = (d / speed) * 0.8;
  return { x: boat.x + (boat.vx || 0) * t, y: boat.y + (boat.vy || 0) * t };
}

function fire(enemy, boat, out) {
  const g = enemy.gun;
  const dmg = g.damage * (enemy.damageScale || 1);
  const mk = (x, y, ang) => out.push({
    id: nextShotId++, x, y, vx: Math.cos(ang) * g.speed, vy: Math.sin(ang) * g.speed,
    radius: g.kind === 'heavy' ? 5 : g.kind === 'glob' ? 4.5 : 3.5,
    damage: dmg, life: g.range / g.speed + 0.25, kind: g.kind, faction: enemy.faction, sourceId: enemy.id,
  });
  if (g.pattern === 'broadside') {
    // Parallel balls off the side facing the boat (both sides for a boss).
    const h = enemy.heading || 0;
    const nx = -Math.sin(h); const ny = Math.cos(h);
    const side = Math.sign(nx * (boat.x - enemy.x) + ny * (boat.y - enemy.y)) || 1;
    for (const s of g.bothSides ? [side, -side] : [side]) {
      const ang = Math.atan2(ny * s, nx * s);
      for (let i = 0; i < g.count; i++) {
        const along = (i - (g.count - 1) / 2) * g.spread;
        mk(enemy.x + Math.cos(h) * along + nx * s * enemy.radius * 0.8, enemy.y + Math.sin(h) * along + ny * s * enemy.radius * 0.8, ang);
      }
    }
  } else if (g.pattern === 'ring') {
    for (let i = 0; i < g.count; i++) mk(enemy.x, enemy.y, (i / g.count) * Math.PI * 2);
  } else {
    const a = Math.atan2(enemy.gunAimY - enemy.y, enemy.gunAimX - enemy.x);
    for (let i = 0; i < g.count; i++) mk(enemy.x, enemy.y, a + (i - (g.count - 1) / 2) * g.spread);
  }
  if (g.oncePerSurface) enemy._shotThisSurface = true;
}

// Advances every enemy's gun. New shots are appended to `out` (the run's
// enemyProjectiles). Returns how many shots were fired this step (for SFX).
export function updateEnemyGuns(enemies, boat, dt, { grid = null, tileSize = 16, coast = null } = {}, out, rng = Math.random) {
  let fired = 0;
  for (const e of enemies) {
    if (!canShoot(e)) { e.gunWindup = 0; continue; }
    const g = e.gun;
    if (e.gunTimer == null) e.gunTimer = randRange(rng, g.cooldown) * 0.6;
    if (e.gunWindup > 0) {
      e.gunWindup -= dt;
      if (g.pattern === 'aimed') { const p = leadPoint(e, boat, g.speed); e.gunAimX = p.x; e.gunAimY = p.y; }
      if (e.gunWindup <= 0) {
        e.gunWindup = 0;
        fire(e, boat, out);
        fired++;
        e.gunTimer = randRange(rng, g.cooldown);
      }
      continue;
    }
    e.gunTimer -= dt;
    if (e.gunTimer > 0) continue;
    const d = Math.hypot(boat.x - e.x, boat.y - e.y);
    if (d > g.range || !hasLineOfSight(e, boat, grid, tileSize, coast)) { e.gunTimer = 0.3; continue; }
    e.gunWindup = g.windup;
    e.gunWindupMax = g.windup;
    const p = leadPoint(e, boat, g.speed); e.gunAimX = p.x; e.gunAimY = p.y;
  }
  return fired;
}

// Moves enemy shots; they sink into land and hit the boat. Returns hit
// events [{ shot, damage }] (damage already multiplied by the triangle via
// `incomingMultiplier(shot)`), and splash events for shots that hit shore.
export function stepEnemyProjectiles(shots, boat, boatRadius, dt, { grid = null, tileSize = 16, coast = null } = {}, incomingMultiplier = () => 1) {
  const hits = []; const splashes = [];
  for (const s of shots) {
    if (s.spent) continue;
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (Math.hypot(s.x - boat.x, s.y - boat.y) <= s.radius + boatRadius) {
      s.spent = true;
      const damage = s.damage * incomingMultiplier(s);
      boat.health = Math.max(0, boat.health - damage);
      hits.push({ shot: s, damage });
      continue;
    }
    let land = false;
    if (coast) land = sampleField(coast, s.x, s.y) > 0;
    else if (grid) {
      const tx = Math.floor(s.x / tileSize); const ty = Math.floor(s.y / tileSize);
      land = tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height || grid.tiles[ty][tx] === 1;
    }
    if (land) { s.spent = true; splashes.push(s); continue; }
    if (s.life <= 0) { s.spent = true; splashes.push(s); }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].spent) shots.splice(i, 1);
  return { hits, splashes };
}
