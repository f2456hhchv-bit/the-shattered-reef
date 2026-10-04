// One simulated frame of a survival level (2026-10-04), in the order the
// systems must run. Shared by main.mjs (which adds the feedback: sound,
// particles, HUD) and tools/survival-sim.mjs (which plays it headless), so
// the game and the balance numbers can never drift apart.
//
// Returns everything that happened this frame as plain events; nothing in
// here touches the DOM or a canvas.

import { stepBoat, resolveCoastCollision, applyWallImpactDamage, statusTuning, tickBoatStatus } from './boat.mjs';
import { stepWeather, weatherModifiers } from './weather.mjs';
import { updateEnemies, stepSummons, currentCounter, factionMultiplierFor, incomingMultiplierFor, resolveEnemyContactEvents, isRevealed, fireShipBlast } from './enemies.mjs';
import { trackEnemyMotion } from './aim.mjs';
import { stepCombat, resolveHits, cleanupProjectiles, stepBurn, applyDamageToEnemy } from './combat.mjs';
import { stepArmaments, chainLightning } from './armaments.mjs';
import { updateEnemyGuns, stepEnemyProjectiles } from './enemyGuns.mjs';
import { ambientLight, viewRadius, canSee } from './ambient.mjs';
import {
  stepDirector, recycleStragglers, separateEnemies, knockBack, fireWeapons, afterHits, stepWeaponExtras, dropLoot, stepPickups, addXp,
} from './survival.mjs';
import { addLevelSalvage } from './survivalRun.mjs';
import { getEnemy } from '../data/enemies.mjs';

export const BOAT_RADIUS = 11;

// What the crew can see to shoot at: fog, darkness and camouflage hide the rest.
export function visibleEnemies(run, biome) {
  const wv = weatherModifiers(run.weather).view;
  const view = viewRadius(run, biome, wv != null ? wv * 0.8 / 0.9 : null);
  return run.enemies.filter((e) => e.health > 0 && canSee(run, e, view) && isRevealed(e, run.boat));
}

// `input`: the stick vector {x, y}. `ctx`: { spawnDist, biome, rng, t }.
export function stepSurvivalFrame(run, dt, input, ctx) {
  const rng = ctx.rng || Math.random;
  const sv = run.sv;
  const boat = run.boat;
  const ev = {
    wallDamage: 0, dot: 0, boatHits: [], contacts: [], shots: null, hits: [], arcs: [], explosions: [],
    fired: [], armFired: [], director: null, kills: [], pickups: null, levelUps: 0, weather: null, summoned: 0,
  };
  const wmods = weatherModifiers(run.weather);
  boat.sightMult = wmods.sight;
  const tuning = statusTuning(run.tuning, boat, wmods.turn);
  stepBoat(boat, input, dt, tuning);
  ev.weather = stepWeather(run, dt, rng);
  const impact = resolveCoastCollision(boat, BOAT_RADIUS, run.coast);
  ev.wallDamage = applyWallImpactDamage(boat, impact);
  ev.dot = tickBoatStatus(boat, dt);
  if (run.hullRegenPerSecond && boat.health > 0 && boat.health < boat.maxHull) {
    boat.health = Math.min(boat.maxHull, boat.health + run.hullRegenPerSecond * dt);
  }

  // Enemies: spawn, move, crowd, catch up.
  ev.director = stepDirector(run, dt, ctx, rng);
  updateEnemies(run.enemies, boat, dt, run.grid, run.tileSize, run.coast);
  for (const e of stepSummons(run.enemies, dt, rng)) { e.hunting = true; e.xp = 1; ev.summoned++; }
  separateEnemies(run.enemies);
  sv.recycleTimer = (sv.recycleTimer || 0) - dt;
  if (sv.recycleTimer <= 0) { sv.recycleTimer = 0.8; recycleStragglers(run, ctx, rng); }
  trackEnemyMotion(run.enemies, dt);

  // Your guns.
  const visible = visibleEnemies(run, ctx.biome);
  ev.fired = fireWeapons(run, dt, visible, rng);
  const world = { grid: run.grid, tileSize: run.tileSize, coast: run.coast, ricochet: run.ricochet || 0 };
  const arm = stepArmaments(run, dt, world, { rng, t: ctx.t || 0 });
  ev.armFired = arm.fired;
  ev.hits.push(...arm.events);
  stepCombat(run.weapons, dt, run.grid, run.tileSize, run.enemies);
  for (const p of run.weapons.projectiles) {
    if (p.spent && !p.detonated && p.fuseRemaining != null) ev.explosions.push({ x: p.x, y: p.y, r: p.blastRadius || 28, weaponId: p.counterId || p.weaponId });
  }
  const hits = resolveHits(run.weapons, run.enemies, currentCounter, factionMultiplierFor(run.faction), () => 1);
  ev.explosions.push(...afterHits(run));
  cleanupProjectiles(run.weapons);
  ev.hits.push(...hits);
  const chain = chainLightning(run, hits);
  ev.hits.push(...chain.events); ev.arcs = chain.arcs;
  ev.hits.push(...stepWeaponExtras(run, dt));
  for (const e of run.enemies) {
    const b = stepBurn(e, dt);
    if (b) ev.hits.push({ ...b, burn: true });
  }
  // Iron Ram: touching an enemy hurts it.
  if (run.ramDamage) {
    for (const e of run.enemies) {
      if ((e.ramCooldown || 0) > 0) { e.ramCooldown -= dt; continue; }
      if (e.health <= 0 || e.invulnerable || e.warded) continue;
      if (Math.hypot(e.x - boat.x, e.y - boat.y) > e.radius + BOAT_RADIUS + 2) continue;
      e.ramCooldown = 0.6;
      const killed = applyDamageToEnemy(e, run.ramDamage);
      ev.hits.push({ enemy: e, weaponId: 'cannonballs', damage: run.ramDamage, killed, ram: true });
    }
  }
  // Weather hits enemies too.
  for (const h of ev.weather.enemyHits || []) ev.hits.push({ ...h, burn: true });

  // Their guns, their teeth.
  const taken = sv.stats.damageTaken;
  const incoming = incomingMultiplierFor(run.faction);
  updateEnemyGuns(run.enemies, boat, dt, world, run.enemyProjectiles, rng);
  ev.shots = stepEnemyProjectiles(run.enemyProjectiles, boat, BOAT_RADIUS, dt, world, (s) => incoming(s) * taken);
  run.enemyProjectiles = run.enemyProjectiles.filter((s) => !s.spent);
  ev.contacts = resolveEnemyContactEvents(run.enemies, boat, BOAT_RADIUS, (e) => incoming(e) * (run.contactDamageTaken ?? 1) * taken);
  for (const c of ev.contacts) knockBack(c.enemy, boat);

  // The fallen: loot, fire ships going up, and clear them off the water.
  for (const e of run.enemies) {
    if (e.health > 0 || e._looted) continue;
    e._looted = true;
    if (e.detonated) continue; // a fire ship that reached you: no loot
    sv.kills++;
    ev.kills.push(e);
    dropLoot(run, e, rng);
    const def = getEnemy(e.defId);
    if (def.explodes) {
      for (const bev of fireShipBlast(e, run.enemies)) ev.hits.push({ ...bev, burn: true });
      ev.explosions.push({ x: e.x, y: e.y, r: def.explodes.radius, fireShip: true });
    }
    if (e.isBoss) run.bossDefeated = true;
  }
  // Second pass for anything a fire ship's blast just sank.
  for (const e of run.enemies) {
    if (e.health > 0 || e._looted) continue;
    e._looted = true; sv.kills++; ev.kills.push(e); dropLoot(run, e, rng);
  }
  if (run.enemies.length > 40) run.enemies = run.enemies.filter((e) => e.health > 0);

  // Sea glass, coins, chests.
  ev.pickups = stepPickups(run, dt, BOAT_RADIUS);
  if (ev.pickups.xp) ev.levelUps = addXp(run, ev.pickups.xp);
  if (ev.pickups.salvage) ev.pickups.salvageGained = addLevelSalvage(run, ev.pickups.salvage);
  if (ev.weather.salvage) addLevelSalvage(run, ev.weather.salvage);
  return ev;
}

export { ambientLight };
