// Enemy AI — spawning and per-archetype movement/attack behavior. Pure
// logic (no rendering), same split as the rest of engine/*.mjs. Each
// archetype (data/enemies.mjs ARCHETYPES) gets a distinct movement pattern
// so enemies are readable by silhouette+behavior before they're in range —
// the whole point of the counter-swap hook is being able to tell what
// you're looking at.

import { getEnemy, ENEMY_IDS, ARCHETYPES } from '../data/enemies.mjs';
import { resolveTileCollision } from './boat.mjs';

let nextEnemyId = 1;

function randRange(rng, [min, max]) {
  return min + rng() * (max - min);
}

export function createEnemy(defId, x, y, rng = Math.random) {
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
    health: def.maxHealth,
    maxHealth: def.maxHealth,
    radius: def.radius,
    speed: def.speed,
    archetype: startArchetype,
    counter: def.isBoss ? def.phases[0].counter : def.counter, // fixed for non-bosses; bosses override via currentCounter()
    contactDamage: def.contactDamage,
    contactCooldownRemaining: 0,
    invulnerable: false,
    salvageDrop: def.salvageDrop ? Math.round(randRange(rng, def.salvageDrop)) : 0,
    isBoss: !!def.isBoss,
    burn: null,
  };

  if (startArchetype === ARCHETYPES.FLYER) {
    enemy.diveState = 'circling';
    enemy.diveTimer = randRange(rng, def.diveIntervalSeconds);
  }
  if (startArchetype === ARCHETYPES.SUBMERGED) {
    enemy.submergedState = 'submerged';
    enemy.submergedTimer = randRange(rng, def.submergedSeconds);
    enemy.invulnerable = true;
  }
  if (startArchetype === ARCHETYPES.SWARM) {
    enemy.orbitSign = rng() < 0.5 ? -1 : 1;
  }
  if (startArchetype === ARCHETYPES.FLANKER) {
    enemy.flankSign = rng() < 0.5 ? -1 : 1;
  }
  if (def.isBoss) {
    enemy.phaseIndex = 0;
    enemy.phaseTimer = def.phases[0].durationSeconds;
  }

  return enemy;
}

// Resolves an enemy's *current* counter weapon — a plain field for regular
// enemies, but bosses change it by phase. Pass this to combat.resolveHits'
// getEnemyCounter and combat.stepBurn's damage calc stays keyed off the
// counter recorded on the burn status at the moment it was applied, so a
// phase change mid-burn doesn't retroactively change already-applied DoT.
export function currentCounter(enemy) {
  return enemy.counter;
}

function findOpenSpawnTile(grid, tileSize, rng, avoid, minDistFromAvoid) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const tx = Math.floor(rng() * grid.width);
    const ty = Math.floor(rng() * grid.height);
    if (grid.tiles[ty][tx] !== 0) continue;
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
export function spawnReefEnemies(spawnPool, grid, tileSize, boatSpawn, exitWorld, count, rng = Math.random) {
  const enemies = [];
  const minDist = tileSize * 3;
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
      enemies.push(createEnemy(defId, jitterX, jitterY, rng));
      placed++;
      bossPlaced = true;
      continue;
    }

    const spot = findOpenSpawnTile(grid, tileSize, rng, boatSpawn, minDist);
    if (!spot) break;
    // Keep spawns off the exit tile too, loosely.
    if (Math.hypot(spot.x - exitWorld.x, spot.y - exitWorld.y) < tileSize * 2) continue;

    if (defId === ENEMY_IDS.REEF_SKIMMER) {
      const packSize = Math.round(randRange(rng, def.packSize));
      for (let i = 0; i < packSize && placed < count; i++) {
        const jitterX = spot.x + (rng() - 0.5) * tileSize * 2;
        const jitterY = spot.y + (rng() - 0.5) * tileSize * 2;
        enemies.push(createEnemy(defId, jitterX, jitterY, rng));
        placed++;
      }
    } else {
      enemies.push(createEnemy(defId, spot.x, spot.y, rng));
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
  const speed = enemy.speed * speedScale;
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

function updateFlyer(enemy, boat, dt) {
  enemy.diveTimer -= dt;
  if (enemy.diveState === 'circling') {
    steerOrbit(enemy, boat.x, boat.y, dt, 90, 1, 0.6);
    if (enemy.diveTimer <= 0) {
      enemy.diveState = 'diving';
      enemy.diveTargetX = boat.x;
      enemy.diveTargetY = boat.y;
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

function updateTank(enemy, boat, dt) {
  steerToward(enemy, boat.x, boat.y, dt);
}

function updateFlanker(enemy, boat, dt) {
  const flankDist = 55;
  const perpX = -Math.sin(boat.heading) * flankDist * enemy.flankSign;
  const perpY = Math.cos(boat.heading) * flankDist * enemy.flankSign;
  steerToward(enemy, boat.x + perpX, boat.y + perpY, dt, 1.1);
}

function updateBossPhase(enemy, def, dt) {
  enemy.phaseTimer -= dt;
  if (enemy.phaseTimer <= 0) {
    enemy.phaseIndex = (enemy.phaseIndex + 1) % def.phases.length;
    const phase = def.phases[enemy.phaseIndex];
    enemy.phaseTimer = phase.durationSeconds;
    enemy.counter = phase.counter;
    enemy.archetype = phase.archetype;
    // A phase swap into SUBMERGED must (re)start its own submerge/surface
    // state machine, not just flip `invulnerable` — otherwise, on a long
    // fight that loops back through phase 0 a second time, the boss would
    // go invulnerable here but `updateSubmerged` never runs its own timer
    // (updateEnemy only calls it while enemy.archetype === SUBMERGED,
    // which is true, but its internal state was never reset), so it could
    // never surface again for the rest of the fight — permanently
    // unkillable. Explicitly reset the state machine on every entry into
    // a SUBMERGED phase, the same way createEnemy does for the first one.
    if (phase.archetype === ARCHETYPES.SUBMERGED) {
      enemy.submergedState = 'submerged';
      enemy.submergedTimer = randRange(Math.random, def.submergedSeconds);
      enemy.invulnerable = true;
    } else {
      enemy.invulnerable = false;
    }
  }
}

// Advances one enemy's AI + movement by dt, respecting tile collision for
// every archetype except FLYER (which deliberately ignores it). Does not
// touch combat/damage — see combat.mjs for that.
export function updateEnemy(enemy, boat, dt, grid, tileSize) {
  if (enemy.health <= 0) return;

  const def = getEnemy(enemy.defId);
  if (def.isBoss) updateBossPhase(enemy, def, dt);

  switch (enemy.archetype) {
    case ARCHETYPES.SWARM: updateSwarm(enemy, boat, dt); break;
    case ARCHETYPES.FLYER: updateFlyer(enemy, boat, dt); break;
    case ARCHETYPES.SUBMERGED: updateSubmerged(enemy, boat, dt, def); break;
    case ARCHETYPES.TANK: updateTank(enemy, boat, dt); break;
    case ARCHETYPES.FLANKER: updateFlanker(enemy, boat, dt); break;
    default: updateTank(enemy, boat, dt); break;
  }

  if (enemy.archetype !== ARCHETYPES.FLYER) {
    resolveTileCollision(enemy, enemy.radius, grid, tileSize);
  }

  if (enemy.contactCooldownRemaining > 0) {
    enemy.contactCooldownRemaining = Math.max(0, enemy.contactCooldownRemaining - dt);
  }
}

export function updateEnemies(enemies, boat, dt, grid, tileSize) {
  for (const enemy of enemies) updateEnemy(enemy, boat, dt, grid, tileSize);
}

// Contact damage: an enemy touching the boat hurts it, on its own
// per-enemy cooldown (not every frame of contact). Riggers additionally
// jam the boat's turning briefly on a successful hit — their whole
// identity is degrading control, not raw damage (PRD: "left alone they
// degrade the player's control"). Returns the damage dealt (0 if nothing
// happened this frame).
const RIGGER_JAM_SECONDS = 1.1;

export function resolveEnemyContact(enemy, boat, boatRadius) {
  if (enemy.health <= 0 || enemy.contactCooldownRemaining > 0) return 0;
  const dist = Math.hypot(enemy.x - boat.x, enemy.y - boat.y);
  if (dist > enemy.radius + boatRadius) return 0;

  enemy.contactCooldownRemaining = getEnemy(enemy.defId).contactCooldown;
  boat.health = Math.max(0, boat.health - enemy.contactDamage);
  if (enemy.defId === ENEMY_IDS.RIGGER) {
    boat.turnJamRemaining = Math.max(boat.turnJamRemaining || 0, RIGGER_JAM_SECONDS);
  }
  return enemy.contactDamage;
}

export function resolveEnemyContacts(enemies, boat, boatRadius) {
  let total = 0;
  for (const enemy of enemies) total += resolveEnemyContact(enemy, boat, boatRadius);
  return total;
}
