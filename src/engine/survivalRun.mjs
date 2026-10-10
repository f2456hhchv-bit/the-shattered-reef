// A survival level (2026-10-04): one open arena (engine/arena.mjs), ten
// waves (engine/survival.mjs), a fresh build that grows from a small ship
// with Cannonballs. Same run shape the rest of the game reads (boat,
// weapons.projectiles, enemies, pickups, coast, weather...), so physics,
// combat, enemy AI, armaments, weather, darkness and rendering all work
// on it unchanged.
//
// A stage is LEVELS_PER_STAGE levels in one biome; each level is its own
// run. Clearing a level unlocks the next (engine/meta.mjs).

import { makeSeededRng } from './rng.mjs';
import { DEV } from './devTuning.mjs';
import { buildCoastField } from './terrain.mjs';
import { buildArenaGrid } from './arena.mjs';
import { encodeLevelCode, mixSeed } from './levels.mjs';
import { createBoat } from './boat.mjs';
import { createWeaponState } from './combat.mjs';
import { createWeather } from './weather.mjs';
import { createSurvivalState, recomputeStats } from './survival.mjs';
import { BASELINE_LOADOUT, biomeForStage, LEVELS_PER_STAGE, TILE_SIZE } from './run.mjs';
import { BIOMES } from '../data/biomes.mjs';
import { SURVIVAL, SV_WEAPONS } from '../data/survival.mjs';
import { tuningForHull, CHARMS, CHARM_IDS } from '../data/meta.mjs';
import { ARMAMENT_BY_ID } from '../data/armaments.mjs';

let nextChestId = 7_000_000;

// The arena for a level: pure function of { biomeId, tier, seed }.
export function buildSurvivalWorld(level) {
  const rng = makeSeededRng(level.seed);
  const arena = buildArenaGrid(rng, level.biomeId);
  const coastSeed = Math.floor(rng() * 2 ** 31);
  const coast = buildCoastField(arena.grid, TILE_SIZE, coastSeed);
  const T = TILE_SIZE;
  return {
    arena,
    grid: arena.grid,
    coast,
    coastSeed,
    tileSize: T,
    spawnWorld: { x: arena.spawnTile.tx * T, y: arena.spawnTile.ty * T },
    widthPx: arena.grid.width * T,
    heightPx: arena.grid.height * T,
    landmarks: arena.landmarks.map((l) => ({ ...l, x: l.tx * T, y: l.ty * T })),
    seaIslands: arena.seaIslands.map((l) => ({ ...l, x: l.tx * T, y: l.ty * T, size: l.r * 2 * T })),
    chests: arena.chestTiles.map((c) => ({ x: c.tx * T, y: c.ty * T })),
  };
}

export function survivalLevel(seed, stage, levelIndex) {
  return { biomeId: biomeForStage(stage), tier: levelIndex + 1, seed: mixSeed(seed >>> 0, stage * 16 + levelIndex) };
}

function applyWorld(run, world) {
  run.arena = world.arena;
  run.grid = world.grid;
  run.coast = world.coast;
  run.coastSeed = world.coastSeed;
  run.tileSize = world.tileSize;
  run.widthPx = world.widthPx;
  run.heightPx = world.heightPx;
  run.landmarks = world.landmarks;
  run.seaIslands = world.seaIslands;
  run.exitWorld = world.spawnWorld; // no exit: kept for code that lights it
  run.maze = null; run.lair = null; run.exitLocked = true;
}

// `loadout` is engine/meta.mjs's resolveLoadout() shape (BASELINE_LOADOUT
// for no meta). Meta still matters here: your hull, faction, Workshop
// crafts and charms carry in, and Cargo Loadouts / faction weapons start
// you with those weapons at level 1.
// `locked`: weapon/armament ids kept out of the level-up pool (engine/
// progression.mjs lockedPool). `daily`: { key, mod } for a daily voyage,
// whose modifier effects (mod.fx) are applied here. `livery`: sail colours.
export function createSurvivalRun(seed, loadout = BASELINE_LOADOUT, { stage = 1, levelIndex = 0, level = null, locked = [], daily = null, livery = null } = {}) {
  const lvl = level || survivalLevel(seed, stage, levelIndex);
  const world = buildSurvivalWorld(lvl);
  const hull = loadout.hull;
  const perks = hull.perks || {};
  const fx = loadout.charmEffects || {};
  let tuning = tuningForHull(hull);
  if (loadout.speedMult && loadout.speedMult !== 1) tuning = { ...tuning, maxSpeed: tuning.maxSpeed * loadout.speedMult, acceleration: tuning.acceleration * loadout.speedMult };
  const maxHull = hull.maxHull + (loadout.extraMaxHull || 0);
  const run = {
    mode: 'survival',
    seed: seed >>> 0,
    stage,
    reefIndex: levelIndex,
    reefCount: LEVELS_PER_STAGE,
    level: lvl,
    levelCode: encodeLevelCode(lvl),
    levelCodes: [encodeLevelCode(lvl)],
    attempts: [], retries: 0,
    tuning,
    boat: createBoat(world.spawnWorld.x, world.spawnWorld.y, -Math.PI / 2, maxHull),
    faction: loadout.faction ?? null,
    craftedDamageMultipliers: loadout.craftedDamageMultipliers || {},
    bossDefeated: false,
    weapons: createWeaponState(),
    enemies: [],
    enemyProjectiles: [],
    pickups: [],
    bankedSalvage: 0,
    reefSalvage: 0,
    charms: { firstHaul: loadout.charms.firstHaul, lastGasp: loadout.charms.lastGasp, lastGaspUsed: false },
    over: false,
    outcome: null,
    armaments: {},
    armTimers: {},
    upgrades: {},
    ricochet: BIOMES[lvl.biomeId]?.ricochet || 0,
    lanternMult: 1.35,
    dash: { cd: 0, t: 0, iframes: 0, uses: 0, dx: 1, dy: 0 },
  };
  applyWorld(run, world);
  run.weapons.ricochet = run.ricochet;
  run.boat.style = hull.id;
  run.boat.repairMult = fx.repairMult ?? 1;
  run.boat.wallDamageTaken = fx.wallDamageTaken ?? 1;
  run.salvageMult = fx.salvageMult ?? 1;
  run.chestSalvage = fx.chestSalvage ?? 0;
  run.extraCardChoices = fx.extraCardChoices ?? 0;
  run.armamentDamage = loadout.armamentDamageMult ?? 1;
  // What the ship brings before any level-up (survival.recomputeStats adds
  // the passives on top).
  run.baseStats = {
    tuning,
    maxHull,
    pickupMult: perks.pickupReach || 1,
    ram: perks.ramDamage || 0,
    contactTaken: perks.contactDamageTaken ?? 1,
    extraCannonballs: perks.extraCannonballs || 0,
    // Steady Hands (a voyage ammo charm) becomes a steadier gun crew here.
    cooldownMult: loadout.charms.steadyHands ? 0.95 : 1,
    damageMult: daily?.mod?.fx?.damageDealt ?? 1,
    takenMult: daily?.mod?.fx?.damageTaken ?? 1,
    dashMult: daily?.mod?.fx?.dashMult ?? 1,
  };
  run.sv = createSurvivalState({ stage, levelIndex, biomeId: lvl.biomeId });
  run.sv.weapons.cannonballs = 1;
  run.poolLocked = new Set(locked);
  if (livery) run.boat.livery = livery;
  if (daily) {
    const fx = daily.mod?.fx || {};
    run.daily = { key: daily.key, modId: daily.mod?.id, stage, levelIndex };
    run.salvageMult *= fx.salvageMult ?? 1;
    run.sv.countMult = fx.countMult ?? 1;
    run.sv.xpMult = fx.xpMult ?? 1;
    run.sv.enemySpeed = fx.enemySpeed ?? 1;
  }
  // Meta weapons start at level 1 (Cargo Loadouts, a faction's weapon bias,
  // Armory armament fittings), up to the six weapon slots.
  for (const id of loadout.extraHeldWeapons || []) {
    if (SV_WEAPONS[id] && Object.keys(run.sv.weapons).length < SURVIVAL.maxWeapons) run.sv.weapons[id] = 1;
  }
  for (const id of loadout.startingArmaments || []) {
    if (ARMAMENT_BY_ID[id] && Object.keys(run.sv.weapons).length + Object.keys(run.armaments).length < SURVIVAL.maxWeapons) run.armaments[id] = 1;
  }
  recomputeStats(run);
  run.boat.health = run.boat.maxHull;
  // Treasure floating by the wrecks and landmarks.
  for (const c of world.chests) run.pickups.push({ id: nextChestId++, kind: 'chest', x: c.x, y: c.y, amount: 1, collected: false, age: 0, map: true });
  run.weather = createWeather(lvl.biomeId);
  // Weather waits a little longer on a survival level: the first waves are
  // for learning the build.
  if (run.weather) run.weather.timer = Math.max(run.weather.timer || 0, 45);
  return run;
}

// Salvage for clearing the level, on top of what was collected.
export function levelClearBonus(run) {
  const [base, per] = SURVIVAL.levelClearSalvage;
  const stageMult = 1 + 0.25 * (Math.max(1, run.stage) - 1);
  return Math.round((base + per * run.reefIndex) * stageMult);
}

// Survival Salvage: coins go to the level's tally (bonus charms apply).
export function addLevelSalvage(run, amount) {
  const first = run.charms.firstHaul && run.reefIndex === 0 ? CHARMS[CHARM_IDS.FIRST_HAUL].firstReefSalvageMultiplier : 1;
  const v = amount * first * (run.salvageMult ?? 1) * (run.sv?.stats?.salvageMult ?? 1) * DEV.salvage;
  run.reefSalvage += v;
  return v;
}

// The level is won: bank everything plus the clear bonus.
export function completeLevel(run) {
  if (run.over) return 0;
  const bonus = levelClearBonus(run);
  run.bankedSalvage += run.reefSalvage + bonus;
  run.reefSalvage = 0;
  run.over = true;
  run.outcome = 'victory';
  run.levelBonus = bonus;
  return bonus;
}

// Sunk: half of what you collected is kept (survivor games keep your run's
// haul; a voyage-style total loss felt too punishing with retries).
export function sinkLevel(run) {
  run.bankedSalvage += run.reefSalvage * SURVIVAL.sinkKeepsSalvage;
  run.lostSalvage = run.reefSalvage * (1 - SURVIVAL.sinkKeepsSalvage);
  run.reefSalvage = 0;
}
