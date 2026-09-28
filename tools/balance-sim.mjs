// Headless balance simulator — runs many full voyages with a scripted bot
// player (BFS pathfinding over the maze graph, counter-aware weapon
// switching, aim-assist firing matching main.mjs's own logic) and reports
// aggregate stats: win rate, death causes, per-reef survival, weapon
// usage, boss encounter/defeat rate, and Salvage economy pace vs. Hub
// costs. Built for the balance/content pass (2026-09-28) — the project's
// own numbers (weapons.mjs/enemies.mjs/meta.mjs) are documented as
// first-pass guesses with "no real playtesting data yet"; this is how we
// get that data without hand-playing dozens of runs.
//
// Pure Node, no browser — every module this drives (run.mjs, boat.mjs,
// combat.mjs, enemies.mjs, pickups.mjs) is already pure logic per the
// project's own engine/rendering split, so a real (if simplified) voyage
// can be simulated at full speed. Rendering/DOM/audio/juice are
// deliberately not exercised here — this measures gameplay balance, not
// UX, which is what headless-browser playtesting is still for.
//
// The bot: BFS-pathfinds cell-to-cell over the maze graph (not per-tile)
// toward a priority target — an unheld weapon cache, else the nearest
// live enemy within a realistic detection radius, else an uncollected
// Salvage pickup, else the exit — switches to a target enemy's counter
// weapon when held, and fires with the same aim-assist main.mjs uses. It
// gives up (blacklists) on a target it's chased too long without
// progress, rather than looping forever on maze geometry a real player
// would just nudge around — see the replan/stuck-timer logic below; this
// was found and fixed via exactly the oscillation bug it now guards
// against (see the balance-pass decisions log entry in CLAUDE.md).
//
// Usage: node tools/balance-sim.mjs [runCount] [seedOffset]

import {
  createRun, checkReachedExit, checkSunk, addSalvage, BASELINE_LOADOUT, REEF_COUNT,
} from '../src/engine/run.mjs';
import { stepBoat, resolveTileCollision, applyWallImpactDamage } from '../src/engine/boat.mjs';
import {
  tryFire, stepCombat, stepAmmoRegen, resolveHits, cleanupProjectiles, stepBurn, setActiveWeapon, isHeld, ammoFor,
  craftedMultiplierFor,
} from '../src/engine/combat.mjs';
import { updateEnemies, resolveEnemyContactEvents, currentCounter, factionMultiplierFor, incomingMultiplierFor } from '../src/engine/enemies.mjs';
import { collectPickups } from '../src/engine/pickups.mjs';
import { getWeapon, WEAPON_IDS } from '../src/data/weapons.mjs';
import { PICKUP_KINDS } from '../src/data/pickups.mjs';

const DT = 1 / 30;
const BOAT_RADIUS = 11;
const REEF_TIMEOUT_SECONDS = 240; // a reef that takes >4 sim-minutes counts as stuck/abandoned, not a death
const DETECTION_RADIUS = 220; // a player doesn't crisscross the whole maze hunting every last enemy

// --- BFS pathfinding over the maze graph (cell-to-cell, not per-tile) ---

function cellOf(run, x, y) {
  const grid = run.grid;
  const tx = Math.floor(x / run.tileSize);
  const ty = Math.floor(y / run.tileSize);
  const c = Math.min(run.maze.cols - 1, Math.max(0, Math.floor((tx - grid.wall) / grid.unit)));
  const r = Math.min(run.maze.rows - 1, Math.max(0, Math.floor((ty - grid.wall) / grid.unit)));
  return { r, c };
}

function cellWorldCenter(run, cell) {
  const grid = run.grid;
  const x0 = cell.c * grid.unit + grid.wall;
  const y0 = cell.r * grid.unit + grid.wall;
  return { x: (x0 + grid.room / 2) * run.tileSize, y: (y0 + grid.room / 2) * run.tileSize };
}

function bfsPath(run, fromCell, toCell) {
  if (fromCell.r === toCell.r && fromCell.c === toCell.c) return [fromCell];
  const { cells, cols, rows } = run.maze;
  const key = (c) => c.r * cols + c.c;
  const visited = new Set([key(fromCell)]);
  const prev = new Map();
  const queue = [fromCell];
  const dirs = [['N', -1, 0], ['S', 1, 0], ['E', 0, 1], ['W', 0, -1]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.r === toCell.r && cur.c === toCell.c) {
      const path = [cur];
      let k = key(cur);
      while (prev.has(k)) {
        const p = prev.get(k);
        path.unshift(p);
        k = key(p);
      }
      return path;
    }
    const cell = cells[cur.r][cur.c];
    for (const [dir, dr, dc] of dirs) {
      if (!cell[dir]) continue;
      const nr = cur.r + dr, nc = cur.c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nk = nr * cols + nc;
      if (visited.has(nk)) continue;
      visited.add(nk);
      prev.set(nk, cur);
      queue.push({ r: nr, c: nc });
    }
  }
  return [fromCell]; // unreachable (shouldn't happen — mazes are fully connected)
}

// --- Bot ---

function createBot() {
  return {
    waypoints: [], waypointIdx: 0, replanTimer: 0, targetKind: null, targetId: null,
    blacklist: new Set(), stuckTimer: 0, lastEnemyHealth: null,
  };
}

function pickTarget(run, blacklist) {
  const cache = run.pickups.find((p) => !p.collected && !blacklist.has(p.id) && p.kind === PICKUP_KINDS.WEAPON_CACHE && !isHeld(run.weapons, p.weaponId));
  if (cache) return { kind: 'pickup', x: cache.x, y: cache.y, id: cache.id };

  let nearestEnemy = null, bestDist = DETECTION_RADIUS;
  for (const enemy of run.enemies) {
    if (enemy.health <= 0 || blacklist.has(enemy)) continue;
    const dist = Math.hypot(enemy.x - run.boat.x, enemy.y - run.boat.y);
    if (dist < bestDist) { bestDist = dist; nearestEnemy = enemy; }
  }
  if (nearestEnemy) return { kind: 'enemy', x: nearestEnemy.x, y: nearestEnemy.y, id: nearestEnemy };

  const salvage = run.pickups.find((p) => !p.collected && !blacklist.has(p.id) && p.kind === PICKUP_KINDS.SALVAGE);
  if (salvage) return { kind: 'pickup', x: salvage.x, y: salvage.y, id: salvage.id };

  return { kind: 'exit', x: run.exitWorld.x, y: run.exitWorld.y, id: 'exit' };
}

function replanIfNeeded(run, bot, dt) {
  bot.replanTimer -= dt;

  // Stuck detection: a hard cap on total time spent pursuing the same
  // target without resolving it — usually wall geometry the simplistic
  // steering can't quite thread, or an evasive enemy it can't catch.
  // Once exceeded, give up on it for this reef rather than looping
  // forever. For an enemy target specifically, actually damaging it
  // counts as progress and resets the clock — otherwise the bot would
  // walk away mid-kill from a tanky, stationary-ish fight (a boss) just
  // because its *position* wasn't the thing making progress. This was a
  // real gap in the first version: it measured only position, so the
  // sim's own boss-defeat-rate numbers were unusable (see CLAUDE.md).
  if (bot.targetKind === 'pickup') {
    bot.stuckTimer += dt;
    if (bot.stuckTimer > 10) {
      bot.blacklist.add(bot.targetId);
      bot.stuckTimer = 0;
      bot.waypoints = [];
    }
  } else if (bot.targetKind === 'enemy') {
    const enemy = bot.targetId; // the enemy object itself, see pickTarget
    const health = enemy.health;
    if (bot.lastEnemyHealth == null || health < bot.lastEnemyHealth - 0.01) {
      bot.stuckTimer = 0;
    } else {
      bot.stuckTimer += dt;
    }
    bot.lastEnemyHealth = health;
    if (bot.stuckTimer > 15) {
      bot.blacklist.add(bot.targetId);
      bot.stuckTimer = 0;
      bot.waypoints = [];
    }
  }

  const target = pickTarget(run, bot.blacklist);
  const targetChanged = target.kind !== bot.targetKind || target.id !== bot.targetId;
  const waypointsExhausted = bot.waypointIdx >= bot.waypoints.length - 1 && bot.waypoints.length > 0
    && Math.hypot(bot.waypoints[bot.waypoints.length - 1].x - run.boat.x, bot.waypoints[bot.waypoints.length - 1].y - run.boat.y) > run.tileSize * 2;
  const needsPeriodicReplan = target.kind === 'enemy' && bot.replanTimer <= 0;
  if (!targetChanged && bot.waypoints.length && !needsPeriodicReplan && !waypointsExhausted) return target;

  bot.replanTimer = 1.2;
  // Only reset the stuck timer when the target itself actually changed —
  // a re-path onto the *same* target (waypointsExhausted firing while
  // still circling it) must not restart the clock, or a target that
  // keeps triggering waypointsExhausted would never hit the cap above.
  if (targetChanged) {
    bot.stuckTimer = 0;
    bot.lastEnemyHealth = null;
  }
  bot.targetKind = target.kind;
  bot.targetId = target.id;
  const fromCell = cellOf(run, run.boat.x, run.boat.y);
  const toCell = cellOf(run, target.x, target.y);
  const path = bfsPath(run, fromCell, toCell);
  bot.waypoints = path.map((c) => cellWorldCenter(run, c));
  bot.waypoints.push({ x: target.x, y: target.y }); // final approach to the exact target
  bot.waypointIdx = 0;
  return target;
}

// A real player holding fire on a target doesn't keep driving into
// point-blank/contact range once it's within weapon range — they stand
// off and shoot. Without this the bot rammed straight into every enemy's
// contact-damage radius on every approach, which inflated enemy-contact
// damage in a way no attentive player's run would show. Only applies
// once genuinely in range; getting there in the first place still uses
// full pathing.
function standOffDistance(run, bot) {
  if (bot.targetKind !== 'enemy') return null;
  const enemy = bot.targetId;
  if (enemy.health <= 0) return null;
  const weapon = getWeapon(run.weapons.activeWeaponId);
  return Math.max(enemy.radius + BOAT_RADIUS + 6, weapon.range * 0.6);
}

// Evasion (added 2026-09-28, Opus faction pass): the bot previously never
// retreated, so every hull took the same contact damage and a speed-based
// hull (the Skiff, i.e. the Reavers) was systematically undervalued — the
// tool was blind to exactly the variable being tuned. Now any live enemy
// inside DANGER_RADIUS of contact range pushes a weighted flee vector
// (1 at contact, 0 at the edge), blended with the route so the bot kites
// around threats instead of pinning itself in a corner. BOT_EVASION=0
// restores the old behaviour for A/B comparison on the same seeds.
const EVASION = process.env.BOT_EVASION !== '0';
const DANGER_RADIUS = 55;
function threatVector(run) {
  let tx = 0, ty = 0;
  for (const e of run.enemies) {
    if (e.health <= 0) continue;
    const dx = run.boat.x - e.x, dy = run.boat.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const contact = e.radius + BOAT_RADIUS;
    if (d > contact + DANGER_RADIUS) continue;
    const w = Math.min(1, 1 - (d - contact) / DANGER_RADIUS);
    tx += (dx / d) * w;
    ty += (dy / d) * w;
  }
  return { x: tx, y: ty, mag: Math.hypot(tx, ty) };
}

// Context steering: score 16 candidate headings by how well they flee the
// threat, follow the route, and keep clear of rock (a short raycast into
// the tile grid) — a naive "flee straight away" rammed walls constantly
// (wall damage rose from ~4 to 30-40 per voyage), which no real player
// does. Only engages when something is actually inside DANGER_RADIUS.
function wallClearance(run, dirX, dirY) {
  const step = run.tileSize / 2;
  const maxDist = run.tileSize * 3;
  for (let d = step; d <= maxDist; d += step) {
    const tx = Math.floor((run.boat.x + dirX * d) / run.tileSize);
    const ty = Math.floor((run.boat.y + dirY * d) / run.tileSize);
    if (tx < 0 || ty < 0 || tx >= run.grid.width || ty >= run.grid.height) return d / maxDist;
    if (run.grid.tiles[ty][tx] === 1) return d / maxDist;
  }
  return 1;
}

function steerVector(run, bot) {
  const base = routeVector(run, bot);
  if (!EVASION) return base;
  const t = threatVector(run);
  if (t.mag < 0.15) return base;
  const threatW = Math.min(1.5, t.mag);
  let best = base, bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const clear = wallClearance(run, dx, dy);
    const score = threatW * (dx * t.x + dy * t.y) / t.mag
      + 0.6 * (dx * base.x + dy * base.y)
      - 2.2 * (1 - clear);
    if (score > bestScore) { bestScore = score; best = { x: dx, y: dy }; }
  }
  return best;
}

function routeVector(run, bot) {
  if (!bot.waypoints.length) return { x: 0, y: 0 };

  const standOff = standOffDistance(run, bot);
  if (standOff != null) {
    const dx = run.boat.x - bot.targetId.x, dy = run.boat.y - bot.targetId.y;
    const dist = Math.hypot(dx, dy);
    if (dist < standOff) return { x: 0, y: 0 }; // close enough — hold and fire
  }

  while (bot.waypointIdx < bot.waypoints.length - 1) {
    const wp = bot.waypoints[bot.waypointIdx];
    const dist = Math.hypot(wp.x - run.boat.x, wp.y - run.boat.y);
    if (dist < run.tileSize * 2.2) { bot.waypointIdx++; continue; }
    break;
  }
  const wp = bot.waypoints[bot.waypointIdx];
  const dx = wp.x - run.boat.x, dy = wp.y - run.boat.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return { x: 0, y: 0 };
  return { x: dx / dist, y: dy / dist };
}

function computeFireHeading(run) {
  const weapon = getWeapon(run.weapons.activeWeaponId);
  let target = null, bestDist = weapon.range;
  for (const enemy of run.enemies) {
    if (enemy.health <= 0 || enemy.invulnerable) continue;
    const dist = Math.hypot(enemy.x - run.boat.x, enemy.y - run.boat.y);
    if (dist <= bestDist) { bestDist = dist; target = enemy; }
  }
  return target ? Math.atan2(target.y - run.boat.y, target.x - run.boat.x) : run.boat.heading;
}

// Switches to the nearest threatening enemy's counter weapon if it's
// held — mirrors what an attentive player does. Falls back to Cannonballs
// if the counter isn't held yet.
const ENGAGE_RADIUS = 150;
function maybeSwitchWeapon(run) {
  let nearest = null, bestDist = ENGAGE_RADIUS;
  for (const enemy of run.enemies) {
    if (enemy.health <= 0) continue;
    const dist = Math.hypot(enemy.x - run.boat.x, enemy.y - run.boat.y);
    if (dist < bestDist) { bestDist = dist; nearest = enemy; }
  }
  if (!nearest) return;
  const counter = currentCounter(nearest);
  if (isHeld(run.weapons, counter) && ammoFor(run.weapons, counter) > 0) {
    setActiveWeapon(run.weapons, counter);
  } else if (run.weapons.activeWeaponId !== WEAPON_IDS.CANNONBALLS) {
    setActiveWeapon(run.weapons, WEAPON_IDS.CANNONBALLS);
  }
}

// --- One voyage ---

function simulateVoyage(seed, loadout = BASELINE_LOADOUT) {
  const run = createRun(seed, loadout);
  const bot = createBot();
  const stats = {
    seed, outcome: null, reefsReached: 1, timeoutReef: null,
    bankedSalvage: 0, weaponsFound: new Set(), kills: {},
    damageBySource: { wall: 0, enemyContact: 0 },
    contactByFaction: {},
    bossEncountered: false, bossDefeated: false,
    finalHull: 0,
  };

  let reefTimer = 0;
  let lastReefIndex = run.reefIndex;

  for (let frame = 0; frame < 30 * REEF_TIMEOUT_SECONDS * REEF_COUNT * 1.2; frame++) {
    if (run.over) break;
    if (run.reefIndex !== lastReefIndex) {
      reefTimer = 0;
      lastReefIndex = run.reefIndex;
      stats.reefsReached++;
      bot.blacklist.clear(); // last reef's pickup ids / enemy objects are gone
    }
    reefTimer += DT;
    if (reefTimer > REEF_TIMEOUT_SECONDS) { stats.timeoutReef = run.reefIndex; break; }

    const boss = run.enemies.find((e) => e.isBoss);
    if (boss) stats.bossEncountered = true;

    replanIfNeeded(run, bot, DT);
    maybeSwitchWeapon(run);
    const input = steerVector(run, bot);
    stepBoat(run.boat, input, DT, run.tuning);
    const impact = resolveTileCollision(run.boat, BOAT_RADIUS, run.grid, run.tileSize);
    const wallDmg = applyWallImpactDamage(run.boat, impact);
    if (wallDmg > 0) stats.damageBySource.wall += wallDmg;

    const heading = computeFireHeading(run);
    tryFire(run.weapons, run.boat.x, run.boat.y, heading);
    stepCombat(run.weapons, DT, run.grid, run.tileSize);
    stepAmmoRegen(run.weapons, DT);
    updateEnemies(run.enemies, run.boat, DT, run.grid, run.tileSize);

    const hitEvents = resolveHits(
      run.weapons, run.enemies, currentCounter,
      factionMultiplierFor(run.faction), craftedMultiplierFor(run.craftedDamageMultipliers)
    );
    for (const ev of hitEvents) {
      if (ev.killed) {
        stats.kills[ev.enemy.defId] = (stats.kills[ev.enemy.defId] || 0) + 1;
        addSalvage(run, ev.enemy.salvageDrop);
        if (ev.enemy.isBoss) stats.bossDefeated = true;
      }
    }
    for (const enemy of run.enemies) {
      const burnEv = stepBurn(enemy, DT);
      if (burnEv && burnEv.killed) {
        stats.kills[enemy.defId] = (stats.kills[enemy.defId] || 0) + 1;
        addSalvage(run, enemy.salvageDrop);
        if (enemy.isBoss) stats.bossDefeated = true;
      }
    }
    cleanupProjectiles(run.weapons);

    for (const ev of resolveEnemyContactEvents(run.enemies, run.boat, BOAT_RADIUS, incomingMultiplierFor(run.faction))) {
      stats.damageBySource.enemyContact += ev.damage;
      const k = ev.enemy.faction || 'boss';
      stats.contactByFaction[k] = (stats.contactByFaction[k] || 0) + ev.damage;
    }

    const pickupEvents = collectPickups(run.pickups, run.boat, BOAT_RADIUS, run.weapons);
    for (const ev of pickupEvents) {
      if (ev.kind === PICKUP_KINDS.WEAPON_CACHE) stats.weaponsFound.add(ev.weaponId);
      else addSalvage(run, ev.amount);
    }

    if (checkSunk(run) === true) break;
    checkReachedExit(run);
  }

  stats.outcome = run.outcome || (stats.timeoutReef != null ? 'timeout' : 'incomplete');
  stats.bankedSalvage = run.bankedSalvage;
  stats.finalHull = run.boat.health;
  return stats;
}

// --- Aggregate + report ---

function runBatch(count, seedOffset = 0, loadout = BASELINE_LOADOUT) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(simulateVoyage(seedOffset + i * 7919, loadout));
  return results;
}

function summarize(results) {
  const n = results.length;
  const outcomes = {};
  const reefsReachedHist = {};
  let totalBanked = 0;
  const killsByType = {};
  let bossEncounters = 0, bossDefeats = 0;
  let totalWallDmg = 0, totalContactDmg = 0;
  const weaponFoundCount = {};

  for (const r of results) {
    outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
    reefsReachedHist[r.reefsReached] = (reefsReachedHist[r.reefsReached] || 0) + 1;
    totalBanked += r.bankedSalvage;
    for (const [k, v] of Object.entries(r.kills)) killsByType[k] = (killsByType[k] || 0) + v;
    if (r.bossEncountered) bossEncounters++;
    if (r.bossDefeated) bossDefeats++;
    totalWallDmg += r.damageBySource.wall;
    totalContactDmg += r.damageBySource.enemyContact;
    for (const w of r.weaponsFound) weaponFoundCount[w] = (weaponFoundCount[w] || 0) + 1;
  }

  console.log(`\n=== Balance sim: ${n} voyages ===`);
  console.log('Outcomes:', outcomes, `(${((outcomes.victory || 0) / n * 100).toFixed(1)}% victory)`);
  console.log('Reefs reached histogram:', reefsReachedHist);
  console.log(`Avg banked Salvage per run: ${(totalBanked / n).toFixed(1)}`);
  console.log('Kills by enemy type:', killsByType);
  console.log(`Boss encounter rate: ${(bossEncounters / n * 100).toFixed(1)}% | defeat rate (of encounters): ${bossEncounters ? (bossDefeats / bossEncounters * 100).toFixed(1) : 'n/a'}%`);
  console.log(`Avg wall-impact damage taken per run: ${(totalWallDmg / n).toFixed(1)} | avg enemy-contact damage: ${(totalContactDmg / n).toFixed(1)}`);
  console.log('Weapon-cache find rate:', Object.fromEntries(Object.entries(weaponFoundCount).map(([k, v]) => [k, (v / n * 100).toFixed(0) + '%'])));
}

const runCount = Number(process.argv[2]) || 60;
const seedOffset = Number(process.argv[3]) || 1000;
export { simulateVoyage, runBatch, summarize };

if (process.argv[1] && process.argv[1].endsWith('balance-sim.mjs')) {
  const results = runBatch(runCount, seedOffset);
  summarize(results);
}
