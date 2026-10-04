// Enemy AI — spawning and per-archetype movement/attack behavior. Pure
// logic (no rendering), same split as the rest of engine/*.mjs. Each
// archetype (data/enemies.mjs ARCHETYPES) gets a distinct movement pattern
// so enemies are readable by silhouette+behavior before they're in range —
// the whole point of the counter-swap hook is being able to tell what
// you're looking at.

import { BOSS_ENRAGE, getEnemy, ENEMY_IDS, ARCHETYPES } from '../data/enemies.mjs';
import { triangleMultiplier, incomingTriangleMultiplier } from '../data/factions.mjs';
import { resolveTileCollision, resolveCoastCollision, applyAfflictions } from './boat.mjs';
import { sampleField } from './terrain.mjs';
import { isOpenWithClearance } from './maze.mjs';

let nextEnemyId = 1;

function randRange(rng, [min, max]) {
  return min + rng() * (max - min);
}

// Aggro tuning (2026-09-28). Before this every enemy on the map hunted the
// boat from the first frame, and flyers crossed land in a straight line:
// an idle player was hit ~7s in and sank within 20s about half the time
// on reef 1 (measured, and it predates the art pass). Now enemies wake
// only when they can see the boat — within `radius`, with line of sight
// over water for ships (flyers see over land) — or when hit, or when a
// packmate nearby wakes. Past `leash` they give up and drift home.
export const AGGRO = Object.freeze({
  radius: 190, // px — a def can override with `aggroRadius`
  leashMultiplier: 2.2,
  packAlertRadius: 90, // px — waking one wakes dormant enemies this close
  senseInterval: 0.2, // s between sight checks while dormant
  idleRadius: 16, // px — lazy drift around home while dormant
  idleSpeedScale: 0.22,
});

export function aggroRadiusOf(enemy) {
  return getEnemy(enemy.defId).aggroRadius ?? AGGRO.radius;
}

// Straight-line sight from enemy to boat, blocked by land. Uses the smooth
// coast field when given (what the player sees), else the tile grid.
export function hasLineOfSight(enemy, boat, grid, tileSize, coast = null) {
  const dx = boat.x - enemy.x; const dy = boat.y - enemy.y;
  const steps = Math.ceil(Math.hypot(dx, dy) / 10);
  for (let i = 1; i < steps; i++) {
    const x = enemy.x + (dx * i) / steps; const y = enemy.y + (dy * i) / steps;
    if (coast) { if (sampleField(coast, x, y) > 0) return false; }
    else {
      const tx = Math.floor(x / tileSize); const ty = Math.floor(y / tileSize);
      if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height || grid.tiles[ty][tx] === 1) return false;
    }
  }
  return true;
}

export function wakeEnemy(enemy) {
  enemy.aggro = true;
}

export function createEnemy(defId, x, y, rng = Math.random, { scale = null } = {}) {
  const def = getEnemy(defId);
  // A boss's *effective* starting archetype is its phase-0 archetype, not
  // its top-level `def.archetype` (which only exists as a fallback/label —
  // see data/enemies.mjs). Archetype-specific state below must init off
  // this effective value, not `def.archetype` directly: a boss whose
  // phase-0 archetype is SUBMERGED but whose `def.archetype` is TANK would
  // otherwise never get `submergedState`/`submergedTimer`/`invulnerable`
  // set up, silently skipping its own invulnerable/surfaced cycle from the
  // moment it spawns — a real bug found during the balance pass (see
  // CLAUDE.md's decisions log for the full failure mode, including how it
  // could leave the boss permanently invulnerable after looping phases).
  const startArchetype = def.isBoss ? def.phases[0].archetype : def.archetype;
  const enemy = {
    id: nextEnemyId++,
    defId,
    x, y,
    vx: 0, vy: 0,
    heading: 0,
    health: Math.round(def.maxHealth * (scale?.health ?? 1)),
    maxHealth: Math.round(def.maxHealth * (scale?.health ?? 1)),
    damageScale: scale?.damage ?? 1,
    radius: def.radius,
    speed: def.speed,
    archetype: startArchetype,
    counter: def.isBoss ? def.phases[0].counter : def.counter, // fixed for non-bosses; bosses override via currentCounter()
    // Post-slice combat triangle (data/factions.mjs) — `def.faction` is
    // undefined for the boss (deliberately faction-less), which normalizes
    // to null here so callers can check truthiness uniformly.
    faction: def.faction || null,
    contactDamage: def.contactDamage * (scale?.damage ?? 1),
    gun: def.isBoss ? (def.phases[0].gun || null) : (def.gun || null),
    contactCooldownRemaining: 0,
    invulnerable: false,
    salvageDrop: def.salvageDrop ? Math.round(randRange(rng, def.salvageDrop)) : 0,
    isBoss: !!def.isBoss,
    burn: null,
    // Aggro (2026-09-28): dormant until the boat is in sight — see
    // updateEnemy. `home` is where it idles and returns to when leashed.
    aggro: false,
    home: { x, y },
    idlePhase: rng() * Math.PI * 2,
    senseTimer: rng() * AGGRO.senseInterval,
    lastHealth: 0,
    frontArmor: def.frontArmor ?? null,
    // Which sprite to draw (renderer): survival's horde reuses others' art.
    sprite: def.sprite || null,
  };
  enemy.lastHealth = enemy.health;

  initArchetypeState(enemy, startArchetype, def, rng);
  if (def.isBoss) {
    enemy.phaseIndex = 0;
    enemy.phaseTimer = def.phases[0].durationSeconds;
  }

  return enemy;
}

// Per-archetype state, set on spawn and again whenever a boss enters a
// phase with that archetype (a phase swap must restart the state machine,
// or e.g. a SUBMERGED phase entered twice would never surface again).
function initArchetypeState(enemy, archetype, def, rng = Math.random) {
  enemy.invulnerable = false;
  if (archetype === ARCHETYPES.FLYER) {
    enemy.diveState = 'circling';
    enemy.diveTimer = randRange(rng, def.diveIntervalSeconds || [1.6, 2.6]);
  }
  if (archetype === ARCHETYPES.SUBMERGED) {
    enemy.submergedState = 'submerged';
    enemy.submergedTimer = randRange(rng, def.submergedSeconds);
    enemy.invulnerable = true;
  }
  if (archetype === ARCHETYPES.SERPENT) {
    enemy.submergedState = 'submerged';
    enemy.submergedTimer = randRange(rng, def.submergedSeconds);
    enemy.invulnerable = true;
    enemy.surfaceAngle = rng() * Math.PI * 2;
  }
  if (archetype === ARCHETYPES.SHARK) {
    enemy.sharkState = 'circling';
    enemy.sharkTimer = randRange(rng, def.chargeEvery);
  }
  if (archetype === ARCHETYPES.SWARM || archetype === ARCHETYPES.SKIRMISHER || archetype === ARCHETYPES.BROADSIDER || archetype === ARCHETYPES.SHARK) {
    enemy.orbitSign = enemy.orbitSign ?? (rng() < 0.5 ? -1 : 1);
  }
  if (archetype === ARCHETYPES.FLANKER) {
    enemy.flankSign = rng() < 0.5 ? -1 : 1;
  }
  enemy.phased = false;
  if (archetype === ARCHETYPES.GHOST) {
    enemy.ghostTimer = randRange(rng, def.solidSeconds || [3, 4]);
    enemy.orbitSign = enemy.orbitSign ?? (rng() < 0.5 ? -1 : 1);
  }
}

// GHOST: alternates solid (fires broadsides, can be hit) and phased (faded,
// untouchable, sails straight through rock toward you). It only turns solid
// again over open water — never inside an island.
function stepGhostPhase(enemy, def, dt, coast, grid, tileSize) {
  enemy.ghostTimer -= dt;
  if (enemy.ghostTimer > 0) return;
  if (!enemy.phased) {
    enemy.phased = true; enemy.invulnerable = true;
    enemy.ghostTimer = randRange(Math.random, def.phasedSeconds || [2, 3]);
  } else if (overOpenWater(enemy, coast, grid, tileSize)) {
    enemy.phased = false; enemy.invulnerable = false;
    enemy.ghostTimer = randRange(Math.random, def.solidSeconds || [3, 4]);
    if (enemy.gun) enemy.gunTimer = Math.max(enemy.gunTimer || 0, 0.4);
  } else {
    enemy.ghostTimer = 0.25; // still inside rock: stay a ghost a little longer
  }
}

function overOpenWater(enemy, coast, grid, tileSize) {
  if (coast) return sampleField(coast, enemy.x, enemy.y) < -(enemy.radius + 2);
  if (!grid) return true;
  const tx = Math.floor(enemy.x / tileSize); const ty = Math.floor(enemy.y / tileSize);
  return grid.tiles[ty]?.[tx] === 0;
}

function updateGhost(enemy, boat, dt, def) {
  if (enemy.phased) steerToward(enemy, boat.x, boat.y, dt, 1.3);
  else updateBroadsider(enemy, boat, dt, def);
}

// Does this enemy ignore the shore? (Flyers, wisps, and ghosts while faded.)
export function passesOverLand(enemy, def = getEnemy(enemy.defId)) {
  return enemy.archetype === ARCHETYPES.FLYER || !!def.flies || !!enemy.phased
    || (!!def.burrows && enemy.submergedState === 'submerged');
}

// Resolves an enemy's *current* counter weapon — a plain field for regular
// enemies, but bosses change it by phase. Pass this to combat.resolveHits'
// getEnemyCounter and combat.stepBurn's damage calc stays keyed off the
// counter recorded on the burn status at the moment it was applied, so a
// phase change mid-burn doesn't retroactively change already-applied DoT.
export function currentCounter(enemy) {
  return enemy.counter;
}

// Returns the damage multiplier `playerFactionId` deals to this enemy —
// pass as combat.resolveHits'/stepBurn's getFactionMultiplier. Bakes in
// triangleMultiplier's own no-faction/no-op rule (1x), so callers can wire
// this unconditionally even before a playable faction is ever chosen
// (playerFactionId null) and against the faction-less boss (enemy.faction
// null).
export function factionMultiplierFor(playerFactionId) {
  return (enemy) => triangleMultiplier(playerFactionId, enemy.faction);
}

// The triangle in the other direction: damage an enemy deals TO the
// player. Pass as resolveEnemyContact(s)'s getIncomingMultiplier. Your
// predator hits you harder, your prey softer — rock-paper-scissors is
// symmetric by nature, and the PRD describes each matchup as a whole
// fight ("speed overwhelms heavy armor before it can react"), not a
// one-way damage bonus. Same no-op rules: unaligned player or faction-less
// boss → 1x.
export function incomingMultiplierFor(playerFactionId) {
  return (enemy) => incomingTriangleMultiplier(enemy.faction, playerFactionId);
}

function findOpenSpawnTile(grid, tileSize, rng, avoid, minDistFromAvoid) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const tx = Math.floor(rng() * grid.width);
    const ty = Math.floor(rng() * grid.height);
    if (!isOpenWithClearance(grid, tx, ty)) continue;
    const x = (tx + 0.5) * tileSize;
    const y = (ty + 0.5) * tileSize;
    if (Math.hypot(x - avoid.x, y - avoid.y) < minDistFromAvoid) continue;
    return { x, y };
  }
  return null; // maze too small/dense to place one more — caller just spawns fewer
}

// Spawns a reef's enemy roster from `spawnPool` (a list of enemy ids to
// pick from — see data/enemies.mjs spawnPoolForReefIndex), placed away
// from both the boat spawn and the exit so nothing greets the player
// standing on top of them. `count` is the total number of enemies (a
// Reef Skimmer pick spawns its whole pack at once, so the returned list
// can run a little over `count`).
//
// A boss (`isBoss: true` in its data definition — currently only The
// Kraken's Anchor) is the one exception to "away from the exit": it's
// drawn from the pool the same as everything else (a chance-based
// appearance, not guaranteed — see spawnPoolForReefIndex), but when
// drawn it's placed *guarding the exit* instead of hidden in the maze,
// so the player can't finish the voyage without confronting it, and
// can't miss it by never wandering near wherever it landed. At most one
// boss is ever placed per reef even if the random draw hits it more than
// once — a redraw, not a second boss.
// `exitClearance` (px): regular enemies stay at least this far from the exit
// (the boss lair passes its pit radius, keeping the pit the boss's alone).
export function spawnReefEnemies(spawnPool, grid, tileSize, boatSpawn, exitWorld, count, rng = Math.random, { exitClearance = tileSize * 2, scale = null } = {}) {
  const enemies = [];
  // Safe opening (2026-09-28): nothing spawns within ~1.6 maze cells of the
  // boat (was 3 tiles — inside the start room), and that's beyond aggro
  // range, so a level always opens quiet.
  const minDist = Math.max(tileSize * 3, (grid.unit || 8) * tileSize * 1.6);
  let placed = 0;
  let bossPlaced = false;
  // Bounds the whole loop, not just findOpenSpawnTile's own internal
  // attempt cap — a pool that's *entirely* the boss (or otherwise can't
  // reach `count`) would otherwise redraw the same already-placed boss
  // forever, since `continue` on that path never increments `placed`.
  const maxAttempts = count * 50 + 200;
  let attempts = 0;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const defId = spawnPool[Math.floor(rng() * spawnPool.length)];
    const def = getEnemy(defId);

    if (def.isBoss) {
      if (bossPlaced) continue; // already have one this reef — redraw
      const jitterX = exitWorld.x + (rng() - 0.5) * tileSize * 1.4;
      const jitterY = exitWorld.y + (rng() - 0.5) * tileSize * 1.4;
      enemies.push(createEnemy(defId, jitterX, jitterY, rng, { scale }));
      placed++;
      bossPlaced = true;
      continue;
    }

    const spot = findOpenSpawnTile(grid, tileSize, rng, boatSpawn, minDist);
    if (!spot) break;
    // Keep spawns off the exit tile too, loosely.
    if (Math.hypot(spot.x - exitWorld.x, spot.y - exitWorld.y) < exitClearance) continue;

    if (def.packSize) {
      const packSize = Math.round(randRange(rng, def.packSize));
      for (let i = 0; i < packSize && placed < count; i++) {
        const jitterX = spot.x + (rng() - 0.5) * tileSize * 2;
        const jitterY = spot.y + (rng() - 0.5) * tileSize * 2;
        enemies.push(createEnemy(defId, jitterX, jitterY, rng, { scale }));
        placed++;
      }
    } else {
      enemies.push(createEnemy(defId, spot.x, spot.y, rng, { scale }));
      placed++;
    }
  }

  return enemies;
}

function steerToward(enemy, targetX, targetY, dt, speedScale = 1) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  enemy.heading = Math.atan2(dy, dx);
  // Arrive instead of overshooting: at full speed a target closer than one
  // frame's travel made the enemy jitter back and forth across it.
  const speed = Math.min(enemy.speed * speedScale, dist / Math.max(dt, 1e-6));
  enemy.vx = (dx / dist) * speed;
  enemy.vy = (dy / dist) * speed;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}

function steerOrbit(enemy, targetX, targetY, dt, radius, sign, speedScale = 1) {
  const dx = enemy.x - targetX;
  const dy = enemy.y - targetY;
  const dist = Math.hypot(dx, dy) || 1;
  // Tangential direction around the target, plus a mild pull toward the
  // desired orbit radius so it doesn't drift away or collapse inward.
  const tangentX = -dy / dist * sign;
  const tangentY = dx / dist * sign;
  const radialError = (dist - radius) / radius;
  const radialX = -dx / dist * radialError;
  const radialY = -dy / dist * radialError;
  const dirX = tangentX + radialX * 0.6;
  const dirY = tangentY + radialY * 0.6;
  const dirLen = Math.hypot(dirX, dirY) || 1;
  const speed = enemy.speed * speedScale;
  enemy.vx = (dirX / dirLen) * speed;
  enemy.vy = (dirY / dirLen) * speed;
  enemy.heading = Math.atan2(enemy.vy, enemy.vx);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}

function updateSwarm(enemy, boat, dt) {
  const engageRadius = 70;
  const dist = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
  if (dist > engageRadius) steerToward(enemy, boat.x, boat.y, dt);
  else steerOrbit(enemy, boat.x, boat.y, dt, engageRadius * 0.6, enemy.orbitSign, 0.9);
}

export const FLYER_WINDUP_SECONDS = 0.55;

function updateFlyer(enemy, boat, dt) {
  enemy.diveTimer -= dt;
  if (enemy.diveState === 'circling') {
    steerOrbit(enemy, boat.x, boat.y, dt, 90, 1, 0.6);
    if (enemy.diveTimer <= 0) {
      // Telegraph (2026-09-28): hover and mark the spot before diving, so
      // a dive is something you can see coming and steer out of.
      enemy.diveState = 'windup';
      enemy.diveTargetX = boat.x;
      enemy.diveTargetY = boat.y;
      enemy.diveTimer = FLYER_WINDUP_SECONDS;
    }
  } else if (enemy.diveState === 'windup') {
    enemy.vx *= Math.exp(-6 * dt); enemy.vy *= Math.exp(-6 * dt);
    enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
    enemy.heading = Math.atan2(enemy.diveTargetY - enemy.y, enemy.diveTargetX - enemy.x);
    if (enemy.diveTimer <= 0) {
      enemy.diveState = 'diving';
      // Overshoot past the marked spot so the dive is a committed line.
      const dx = enemy.diveTargetX - enemy.x; const dy = enemy.diveTargetY - enemy.y; const d = Math.hypot(dx, dy) || 1;
      enemy.diveTargetX += (dx / d) * 40; enemy.diveTargetY += (dy / d) * 40;
      enemy.diveTimer = 0.9;
    }
  } else {
    steerToward(enemy, enemy.diveTargetX, enemy.diveTargetY, dt, 1.6);
    if (enemy.diveTimer <= 0) {
      enemy.diveState = 'circling';
      enemy.diveTimer = randRange(Math.random, [1.6, 2.6]);
    }
  }
  // Flyers ignore tile collision on purpose — they fly over the rock the
  // boat can't reach, per the PRD's Enemies section.
}

function updateSubmerged(enemy, boat, dt, def) {
  enemy.submergedTimer -= dt;
  if (enemy.submergedState === 'submerged') {
    enemy.invulnerable = true;
    // Drifts slowly toward the boat while hidden, so it isn't stationary
    // when it finally surfaces.
    steerToward(enemy, boat.x, boat.y, dt, 0.25);
    if (enemy.submergedTimer <= 0) {
      enemy.submergedState = 'surfaced';
      enemy.invulnerable = false;
      enemy.submergedTimer = def.surfacedSeconds;
    }
  } else {
    steerToward(enemy, boat.x, boat.y, dt, 1.1);
    if (enemy.submergedTimer <= 0) {
      enemy.submergedState = 'submerged';
      enemy.invulnerable = true;
      enemy.submergedTimer = randRange(Math.random, def.submergedSeconds);
    }
  }
}

// HORDE (survival): heads for you along its own slightly-offset line, so
// a crowd fans out and closes from all sides instead of queuing in a file.
// After a bump (`recoil`, set by engine/survival.mjs) it falls back a
// moment before coming again.
function updateHorde(enemy, boat, dt) {
  if (enemy.recoil > 0) {
    enemy.recoil -= dt;
    enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
    enemy.vx *= Math.max(0, 1 - 4 * dt); enemy.vy *= Math.max(0, 1 - 4 * dt);
    return;
  }
  enemy.idlePhase += dt * 0.7;
  const dx = boat.x - enemy.x; const dy = boat.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  // Far away: angle in by up to ~35 degrees; close: straight at you.
  const off = Math.sin(enemy.idlePhase) * 0.6 * Math.min(1, d / 220);
  const a = Math.atan2(dy, dx) + off;
  steerToward(enemy, enemy.x + Math.cos(a) * 40, enemy.y + Math.sin(a) * 40, dt);
}

function updateTank(enemy, boat, dt) {
  steerToward(enemy, boat.x, boat.y, dt);
}

// RAMMER (Fire Ship): on first sighting it lights its sails (the tell),
// then drives straight at you. Slower than any hull, so it can be outrun.
function updateRammer(enemy, boat, dt, def) {
  if (!enemy.kindled) {
    enemy.kindleTimer = (enemy.kindleTimer ?? def.kindleSeconds ?? 0.9) - dt;
    steerToward(enemy, boat.x, boat.y, dt, 0.25);
    if (enemy.kindleTimer <= 0) enemy.kindled = true;
    return;
  }
  steerToward(enemy, boat.x, boat.y, dt);
}

function updateFlanker(enemy, boat, dt) {
  const flankDist = 55;
  const perpX = -Math.sin(boat.heading) * flankDist * enemy.flankSign;
  const perpY = Math.cos(boat.heading) * flankDist * enemy.flankSign;
  steerToward(enemy, boat.x + perpX, boat.y + perpY, dt, 1.1);
}

// SKIRMISHER (Pirate Cutter): holds its preferred range and circles —
// comes in if you run, backs off if you close. Its gun does the work.
function updateSkirmisher(enemy, boat, dt, def) {
  const R = def.preferredRange || 120;
  const d = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
  if (d > R + 25) steerToward(enemy, boat.x, boat.y, dt);
  else if (d < R - 30) {
    const ax = enemy.x - boat.x; const ay = enemy.y - boat.y; const k = 1 / (d || 1);
    steerToward(enemy, enemy.x + ax * k * 40, enemy.y + ay * k * 40, dt, 0.9);
  } else steerOrbit(enemy, boat.x, boat.y, dt, R, enemy.orbitSign, 0.7);
}

// BROADSIDER (Pirate Brig, the flagship): circles you at close range. A
// ship circling you points its side at you, so its broadside bears.
function updateBroadsider(enemy, boat, dt, def) {
  const R = def.preferredRange || 105;
  const d = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
  if (d > R + 60) steerToward(enemy, boat.x, boat.y, dt);
  else steerOrbit(enemy, boat.x, boat.y, dt, R, enemy.orbitSign, 0.85);
}

// SHARK: circles with its fin up, marks a line (the telegraph), then
// charges along it at speed. A charge that ends in the shore stuns it:
// that's the moment to punish.
function updateShark(enemy, boat, dt, def) {
  enemy.sharkTimer -= dt;
  if (enemy.sharkState === 'circling') {
    const d = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
    if (def.ambush) {
      // Lurks where it lives and strikes when you come close.
      steerToward(enemy, enemy.home.x, enemy.home.y, dt, 0.35);
      if (enemy.sharkTimer > 0.4) enemy.sharkTimer = Math.min(enemy.sharkTimer, 0.4);
    } else steerOrbit(enemy, boat.x, boat.y, dt, def.circleRadius || 95, enemy.orbitSign, 0.85);
    const reach = def.ambush ? def.ambushRange : (def.circleRadius || 95) * 1.6;
    if (enemy.sharkTimer <= 0 && d < reach) {
      enemy.sharkState = 'windup';
      enemy.sharkTimer = def.chargeWindup;
      // Aim a little ahead of the boat, then commit.
      const t = 0.35;
      enemy.chargeTargetX = boat.x + (boat.vx || 0) * t;
      enemy.chargeTargetY = boat.y + (boat.vy || 0) * t;
    }
  } else if (enemy.sharkState === 'windup') {
    enemy.vx *= Math.exp(-5 * dt); enemy.vy *= Math.exp(-5 * dt);
    enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
    const a = Math.atan2(enemy.chargeTargetY - enemy.y, enemy.chargeTargetX - enemy.x);
    enemy.heading = a;
    if (enemy.sharkTimer <= 0) {
      enemy.sharkState = 'charging';
      enemy.sharkTimer = def.chargeSeconds;
      enemy.chargeDirX = Math.cos(a); enemy.chargeDirY = Math.sin(a);
    }
  } else if (enemy.sharkState === 'charging') {
    enemy.vx = enemy.chargeDirX * def.chargeSpeed; enemy.vy = enemy.chargeDirY * def.chargeSpeed;
    enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
    enemy.heading = Math.atan2(enemy.vy, enemy.vx);
    if (enemy.sharkTimer <= 0) { enemy.sharkState = 'recover'; enemy.sharkTimer = 0.7; }
  } else if (enemy.sharkState === 'stunned') {
    enemy.vx *= Math.exp(-4 * dt); enemy.vy *= Math.exp(-4 * dt);
    enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
    if (enemy.sharkTimer <= 0) { enemy.sharkState = 'recover'; enemy.sharkTimer = 0.5; }
  } else if (def.ambush) { // recover: slink back to its lair
    steerToward(enemy, enemy.home.x, enemy.home.y, dt, 0.8);
    if (enemy.sharkTimer <= 0) { enemy.sharkState = 'circling'; enemy.sharkTimer = randRange(Math.random, def.chargeEvery); }
  } else { // recover: swim off to circling distance
    const ax = enemy.x - boat.x; const ay = enemy.y - boat.y; const d = Math.hypot(ax, ay) || 1;
    steerToward(enemy, boat.x + (ax / d) * (def.circleRadius || 95), boat.y + (ay / d) * (def.circleRadius || 95), dt, 0.9);
    if (enemy.sharkTimer <= 0) { enemy.sharkState = 'circling'; enemy.sharkTimer = randRange(Math.random, def.chargeEvery); }
  }
}

// SERPENT: dives, swims under you to a spot beside the boat, rears up,
// spits a spread (engine/enemyGuns.mjs, once per surfacing), then dives.
// Only hittable while up; Depth Charges' proximity fuse ignores it while
// submerged, so time the throw to the surfacing.
function updateSerpent(enemy, boat, dt, def) {
  enemy.submergedTimer -= dt;
  if (enemy.submergedState === 'submerged') {
    enemy.invulnerable = true;
    enemy.surfaceAngle += dt * 0.6 * (enemy.orbitSign || 1);
    const tx = boat.x + Math.cos(enemy.surfaceAngle) * def.surfaceDistance;
    const ty = boat.y + Math.sin(enemy.surfaceAngle) * def.surfaceDistance;
    steerToward(enemy, tx, ty, dt);
    if (enemy.submergedTimer <= 0) {
      enemy.submergedState = 'surfaced';
      enemy.invulnerable = false;
      enemy.submergedTimer = def.surfacedSeconds;
      enemy._shotThisSurface = false;
      if (enemy.gun) enemy.gunTimer = 0.15; // rear up, then spit
    }
  } else {
    enemy.vx *= Math.exp(-4 * dt); enemy.vy *= Math.exp(-4 * dt);
    enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
    enemy.heading = Math.atan2(boat.y - enemy.y, boat.x - enemy.x);
    if (enemy.submergedTimer <= 0) {
      enemy.submergedState = 'submerged';
      enemy.invulnerable = true;
      enemy.submergedTimer = randRange(Math.random, def.submergedSeconds);
      enemy.surfaceAngle = Math.atan2(enemy.y - boat.y, enemy.x - boat.x) + (Math.random() - 0.5) * 2.4;
    }
  }
}

function updateBossPhase(enemy, def, dt) {
  enemy.phaseTimer -= dt;
  if (enemy.phaseTimer <= 0) {
    enemy.phaseIndex = (enemy.phaseIndex + 1) % def.phases.length;
    const phase = def.phases[enemy.phaseIndex];
    enemy.phaseTimer = phase.durationSeconds;
    enemy.counter = phase.counter;
    enemy.archetype = phase.archetype;
    enemy.gun = phase.gun || null;
    enemy.summonTimer = phase.summon ? phase.summon.everySeconds * 0.4 : 0;
    // Restart the phase's state machine from scratch — see initArchetypeState.
    initArchetypeState(enemy, phase.archetype, def);
  }
}

// Advances one enemy's AI + movement by dt, respecting tile collision for
// every archetype except FLYER (which deliberately ignores it). Does not
// touch combat/damage — see combat.mjs for that.
// `coast` (optional): the reef's smooth coastline field — when given, ships
// collide with the shore the player sees, same as the boat does.
export function updateEnemy(enemy, boat, dt, grid, tileSize, coast = null) {
  if (enemy.health <= 0) return;

  const def = getEnemy(enemy.defId);
  const dist = Math.hypot(boat.x - enemy.x, boat.y - enemy.y);
  // Rain, fog and snow (engine/weather.mjs) cut how far enemies can see.
  const radius = (def.aggroRadius ?? AGGRO.radius) * (boat.sightMult ?? 1);
  if (enemy.health < enemy.lastHealth) enemy.aggro = true; // shot at: always wakes
  // Boss enrage: below half hull (only reachable once its seals are down).
  if (def.isBoss && !enemy.enraged && enemy.health < enemy.maxHealth * BOSS_ENRAGE.at) {
    enemy.enraged = true;
    enemy.speed *= BOSS_ENRAGE.speed;
  }
  enemy.lastHealth = enemy.health;
  if (!enemy.aggro) {
    enemy.senseTimer -= dt;
    if (enemy.senseTimer <= 0) {
      enemy.senseTimer = AGGRO.senseInterval;
      if (dist <= radius && (enemy.archetype === ARCHETYPES.FLYER || def.flies || hasLineOfSight(enemy, boat, grid, tileSize, coast))) enemy.aggro = true;
    }
  } else if (dist > radius * AGGRO.leashMultiplier && !enemy.hunting) {
    enemy.aggro = false; // lost the boat: drift back home
  }
  // Survival mode (engine/survival.mjs): everything that spawns is hunting
  // you from the moment it appears, wherever you are.
  if (enemy.hunting) enemy.aggro = true;

  if (def.isBoss && enemy.aggro) updateBossPhase(enemy, def, dt);
  if (enemy.archetype === ARCHETYPES.GHOST && enemy.aggro) stepGhostPhase(enemy, def, dt, coast, grid, tileSize);
  else if (enemy.phased && !enemy.aggro) stepGhostPhase(enemy, def, dt, coast, grid, tileSize); // settle back to solid
  if (enemy.archetype === ARCHETYPES.TOTEM || enemy.archetype === ARCHETYPES.SIREN) {
    // Rooted in place: a seal never drifts or chases.
    enemy.x = enemy.home.x; enemy.y = enemy.home.y; enemy.vx = 0; enemy.vy = 0;
  } else if (!enemy.aggro) {
    // Dormant: a lazy drift around home (or back toward it after a leash).
    enemy.idlePhase += dt * 0.5;
    const tx = enemy.home.x + Math.cos(enemy.idlePhase) * AGGRO.idleRadius;
    const ty = enemy.home.y + Math.sin(enemy.idlePhase) * AGGRO.idleRadius;
    const far = Math.hypot(tx - enemy.x, ty - enemy.y) > AGGRO.idleRadius * 3;
    steerToward(enemy, tx, ty, dt, far ? 0.6 : AGGRO.idleSpeedScale);
  } else {
    // A burrower can only come up where there's water to come up in.
    if (def.burrows && enemy.submergedState === 'submerged' && enemy.submergedTimer <= dt
      && !overOpenWater(enemy, coast, grid, tileSize)) enemy.submergedTimer = 0.25;
    moveAggroed(enemy, boat, dt, def);
  }

  if (!passesOverLand(enemy, def)) {
    const impact = coast ? resolveCoastCollision(enemy, enemy.radius, coast) : resolveTileCollision(enemy, enemy.radius, grid, tileSize);
    // A shark that charges into the shore stuns itself.
    if (enemy.sharkState === 'charging' && impact > 60) {
      enemy.sharkState = 'stunned';
      enemy.sharkTimer = 1.1;
    }
  }
  // Tether (the boss lair): never leaves its circle around home.
  if (enemy.tether) {
    const tx = enemy.x - enemy.home.x; const ty = enemy.y - enemy.home.y;
    const d = Math.hypot(tx, ty);
    if (d > enemy.tether) {
      enemy.x = enemy.home.x + (tx / d) * enemy.tether;
      enemy.y = enemy.home.y + (ty / d) * enemy.tether;
      const out = (enemy.vx * tx + enemy.vy * ty) / d;
      if (out > 0) { enemy.vx -= (out * tx) / d; enemy.vy -= (out * ty) / d; }
    }
  }

  if (enemy.contactCooldownRemaining > 0) {
    enemy.contactCooldownRemaining = Math.max(0, enemy.contactCooldownRemaining - dt);
  }
}

function moveAggroed(enemy, boat, dt, def) {
  switch (enemy.archetype) {
    case ARCHETYPES.SWARM: updateSwarm(enemy, boat, dt); break;
    case ARCHETYPES.FLYER: updateFlyer(enemy, boat, dt); break;
    case ARCHETYPES.SUBMERGED: updateSubmerged(enemy, boat, dt, def); break;
    case ARCHETYPES.TANK: updateTank(enemy, boat, dt); break;
    case ARCHETYPES.FLANKER: updateFlanker(enemy, boat, dt); break;
    case ARCHETYPES.SKIRMISHER: updateSkirmisher(enemy, boat, dt, def); break;
    case ARCHETYPES.BROADSIDER: updateBroadsider(enemy, boat, dt, def); break;
    case ARCHETYPES.SHARK: updateShark(enemy, boat, dt, def); break;
    case ARCHETYPES.SERPENT: updateSerpent(enemy, boat, dt, def); break;
    case ARCHETYPES.TOTEM: break;
    case ARCHETYPES.RAMMER: updateRammer(enemy, boat, dt, def); break;
    case ARCHETYPES.GHOST: updateGhost(enemy, boat, dt, def); break;
    case ARCHETYPES.SIREN: break;
    case ARCHETYPES.HORDE: updateHorde(enemy, boat, dt); break;
    default: updateTank(enemy, boat, dt); break;
  }
}

export function updateEnemies(enemies, boat, dt, grid, tileSize, coast = null) {
  const woke = [];
  for (const enemy of enemies) {
    const was = enemy.aggro;
    updateEnemy(enemy, boat, dt, grid, tileSize, coast);
    if (!was && enemy.aggro) woke.push(enemy);
  }
  updateWards(enemies);
  applySirenSong(enemies, boat, dt, grid, tileSize, coast);
  // Pack alert: one waking rouses dormant neighbours (a Skimmer pack
  // attacks together rather than trickling in one by one).
  for (const w of woke) {
    for (const e of enemies) {
      if (!e.aggro && e.health > 0 && Math.hypot(e.x - w.x, e.y - w.y) <= AGGRO.packAlertRadius) e.aggro = true;
    }
  }
}

// Sirens: while awake and in sight, each one's song pulls the boat toward
// her (a velocity change per second, weaker than full sail, so you can
// always steer away — but idle or turning, you drift in).
export function applySirenSong(enemies, boat, dt, grid, tileSize, coast = null) {
  for (const e of enemies) {
    e.singing = false;
    if (e.archetype !== ARCHETYPES.SIREN || e.health <= 0 || !e.aggro) continue;
    const def = getEnemy(e.defId);
    const dx = e.x - boat.x; const dy = e.y - boat.y; const d = Math.hypot(dx, dy);
    if (d > def.lureRadius || d < e.radius + 14) continue;
    if (grid && !hasLineOfSight(e, boat, grid, tileSize, coast)) continue;
    e.singing = true;
    const f = def.lure * (0.5 + 0.5 * (1 - d / def.lureRadius));
    boat.vx += (dx / d) * f * dt; boat.vy += (dy / d) * f * dt;
  }
}

// A fire ship sunk by the player blows up, hurting other enemies nearby
// (never the boat — that's the reward for sinking it at range). Returns hit
// events in resolveHits' shape; chains if the blast sinks another one.
export function fireShipBlast(enemy, enemies) {
  const def = getEnemy(enemy.defId);
  if (!def.explodes || enemy._blasted) return [];
  enemy._blasted = true;
  const events = [];
  for (const e of enemies) {
    if (e === enemy || e.health <= 0 || e.invulnerable || e.warded) continue;
    if (Math.hypot(e.x - enemy.x, e.y - enemy.y) > def.explodes.radius + e.radius) continue;
    e.health = Math.max(0, e.health - def.explodes.damage);
    events.push({ enemy: e, weaponId: 'fire_ship', damage: def.explodes.damage, killed: e.health <= 0 });
  }
  return events;
}

// Lair wards: while any warding seal stands, every boss is `warded` (takes
// no damage — see isHittable). Returns how many seals still stand.
export function updateWards(enemies) {
  let seals = 0;
  for (const e of enemies) if (e.seal && e.health > 0) seals++;
  for (const e of enemies) if (e.isBoss) e.warded = seals > 0;
  return seals;
}

// Can this enemy take damage right now? (Not sunk, not submerged, not
// shielded by a seal.)
export function isHittable(enemy) {
  return enemy.health > 0 && !enemy.invulnerable && !enemy.warded;
}

// Camouflage (Bayou Gators): hidden until you're within `camo` px, or it's
// attacking, or it's been hurt. Aim-assist can't lock what it can't see.
export function isRevealed(enemy, boat) {
  const def = getEnemy(enemy.defId);
  if (!def.camo) return true;
  if (enemy.sharkState && enemy.sharkState !== 'circling') return true;
  if (enemy.health < enemy.maxHealth) return true;
  return Math.hypot(enemy.x - boat.x, enemy.y - boat.y) <= def.camo;
}

// The boss's current phase (null for regular enemies).
export function currentPhase(enemy) {
  return enemy.isBoss ? getEnemy(enemy.defId).phases?.[enemy.phaseIndex] ?? null : null;
}

// Contact damage: an enemy touching the boat hurts it, on its own
// per-enemy cooldown (not every frame of contact). Riggers additionally
// jam the boat's turning briefly on a successful hit — their whole
// identity is degrading control, not raw damage (PRD: "left alone they
// degrade the player's control"). Returns the damage dealt (0 if nothing
// happened this frame).
const RIGGER_JAM_SECONDS = 1.1;

// `getIncomingMultiplier(enemy)` is the post-slice combat triangle applied
// to damage the PLAYER takes (see incomingMultiplierFor) — defaults to a
// no-op 1x so every pre-triangle call site keeps working unchanged.
export function resolveEnemyContact(enemy, boat, boatRadius, getIncomingMultiplier = () => 1) {
  if (enemy.health <= 0 || enemy.contactCooldownRemaining > 0 || enemy.phased) return 0;
  const dist = Math.hypot(enemy.x - boat.x, enemy.y - boat.y);
  if (dist > enemy.radius + boatRadius) return 0;

  const def = getEnemy(enemy.defId);
  enemy.contactCooldownRemaining = def.contactCooldown;
  const damage = enemy.contactDamage * getIncomingMultiplier(enemy);
  boat.health = Math.max(0, boat.health - damage);
  if (def.explodes) {
    // A fire ship that reaches you goes up with it (no Salvage for that).
    enemy.health = 0;
    enemy.detonated = true;
    enemy.salvageDrop = 0;
  }
  if (def.chillOnHit) boat.chillRemaining = Math.max(boat.chillRemaining || 0, def.chillOnHit);
  if (def.onHit) applyAfflictions(boat, def.onHit);
  if (enemy.defId === ENEMY_IDS.RIGGER) {
    boat.turnJamRemaining = Math.max(boat.turnJamRemaining || 0, RIGGER_JAM_SECONDS);
  }
  return damage;
}

// Same as resolveEnemyContacts but returns one {enemy, damage} event per
// contact hit, so the UI can show *which* enemy hit and whether the
// triangle amplified or softened it.
export function resolveEnemyContactEvents(enemies, boat, boatRadius, getIncomingMultiplier = () => 1) {
  const events = [];
  for (const enemy of enemies) {
    const damage = resolveEnemyContact(enemy, boat, boatRadius, getIncomingMultiplier);
    if (damage > 0) events.push({ enemy, damage });
  }
  return events;
}

export function resolveEnemyContacts(enemies, boat, boatRadius, getIncomingMultiplier = () => 1) {
  let total = 0;
  for (const enemy of enemies) total += resolveEnemyContact(enemy, boat, boatRadius, getIncomingMultiplier);
  return total;
}

// Boss summons (a phase's `summon`: { defId, count, everySeconds, max }):
// reinforcements appear beside the boss while that phase lasts, up to
// `max` alive at once. They're already awake and carry little Salvage (no
// farming a boss for endless drops). Returns the newly spawned enemies,
// which are also appended to `enemies`.
export function stepSummons(enemies, dt, rng = Math.random) {
  const spawned = [];
  for (const boss of enemies) {
    if (!boss.isBoss || boss.health <= 0 || !boss.aggro) continue;
    const phase = getEnemy(boss.defId).phases?.[boss.phaseIndex];
    const sm = phase?.summon;
    if (!sm) continue;
    boss.summonTimer = (boss.summonTimer ?? sm.everySeconds * 0.4) - dt;
    if (boss.summonTimer > 0) continue;
    boss.summonTimer = sm.everySeconds;
    const alive = enemies.filter((e) => e.summonedBy === boss.id && e.health > 0).length;
    for (let i = 0; i < Math.min(sm.count, sm.max - alive); i++) {
      const a = rng() * Math.PI * 2;
      const e = createEnemy(sm.defId, boss.x + Math.cos(a) * (boss.radius + 22), boss.y + Math.sin(a) * (boss.radius + 22), rng,
        { scale: { health: 1, damage: boss.damageScale || 1 } });
      e.aggro = true;
      e.summonedBy = boss.id;
      e.salvageDrop = 1;
      enemies.push(e);
      spawned.push(e);
    }
  }
  return spawned;
}

// After restoring a saved voyage (engine/save.mjs): new enemies (boss
// summons) must never reuse a restored enemy's id.
export function ensureEnemyIdsAbove(maxId) {
  if (nextEnemyId <= maxId) nextEnemyId = maxId + 1;
}
