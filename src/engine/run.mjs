// Assembles and advances a whole voyage: a fixed sequence of reefs (3, per
// the PRD's locked vertical-slice scope), increasing in size/density.
//
// Seeds (2026-09-28): every reef is a *level* — { biomeId, tier, seed } —
// and is built from its own rng seeded by that level alone (engine/
// levels.mjs). A run's reefs derive their seeds from the run seed, so a
// whole voyage is still replayable from one number, but any single reef
// can also be rebuilt on its own from its level code.
//
// The boat, its hull, and the weapon/ammo state all carry over between
// reefs — no mid-run healing, no re-arming. Salvage has real permadeath
// stakes: what's collected in the *current* reef is only "banked" (safe)
// once its exit is reached; sinking before that loses it. `bankedSalvage`
// is therefore the only total that survives a run ending in `sunk`.

import { makeSeededRng } from './rng.mjs';
import { buildCoastField } from './terrain.mjs';
import { buildLairGrid } from './lair.mjs';
import { mixSeed, encodeLevelCode } from './levels.mjs';
import { BIOME_IDS } from '../data/biomes.mjs';
import { generateMazeGraph, farthestCell, buildOrganicReefGrid, cellCenterTile, braidMaze } from './maze.mjs';
import { createBoat } from './boat.mjs';
import { createWeaponState } from './combat.mjs';
import { spawnReefEnemies, createEnemy, updateWards } from './enemies.mjs';
import { treasureSpots } from './treasure.mjs';
import { grantArmament } from './armaments.mjs';
import { createWeather } from './weather.mjs';
import { getEnemy, ENEMY_IDS } from '../data/enemies.mjs';
import { stagePool, bossForStage, stageScaling } from '../data/stages.mjs';
import { CACHE_WEAPON_IDS } from '../data/pickups.mjs';
import { spawnReefPickups, makeChest } from './pickups.mjs';
import { SHIP_HULLS, HULL_IDS, tuningForHull, CHARMS, CHARM_IDS } from '../data/meta.mjs';

// A run with no meta-progression applied yet (a first-ever run, or Salvage
// hasn't been spent on anything) — the Sloop hull, no extra held weapons,
// no ammo bonus, no charms. `createRun`'s default when no loadout is
// passed, so every existing call site (and every test) keeps working
// unchanged.
export const BASELINE_LOADOUT = Object.freeze({
  hull: SHIP_HULLS[HULL_IDS.SLOOP],
  extraHeldWeapons: [],
  startingAmmoMultiplier: 1,
  faction: null, // unaligned — no post-slice combat-triangle effect (data/factions.mjs)
  craftedDamageMultipliers: Object.freeze({}), // no Workshop upgrades (data/meta.mjs)
  extraMaxHull: 0,
  charms: { steadyHands: false, lastGasp: false, firstHaul: false },
});

// An elite guards each level's first treasure chest: tougher, harder
// hitting, richer.
export const ELITE = Object.freeze({ health: 2.8, damage: 1.25, salvage: 3 });

export const TILE_SIZE = 16; // px per tile at 1x zoom
export const BOAT_RADIUS = 11; // px, collision + draw radius
export const EXIT_RADIUS_TILES = 1.5; // how close (in tiles) counts as "reached the exit"
// A stage (2026-09-28, project owner): 5 levels (reefs) in one biome. A run
// is one attempt at a stage — sinking restarts it from level 1.
export const LEVELS_PER_STAGE = 5;
export const REEF_COUNT = LEVELS_PER_STAGE; // legacy name, kept for existing call sites
// 7/3 (was 6/2) once coastlines went organic: thicker land reads as islands
// rather than rock ridges, and the rock grown into rooms brings open water
// back to roughly the old 6/2 area, so enemy density is about unchanged.
const ROOM = 7;
const WALL = 3;

// One entry per reef in the fixed sequence — larger, denser mazes and more
// enemies as the voyage progresses. The last entry repeats if REEF_COUNT
// ever grows past this table without a matching tuning update.
const REEF_TUNING = [
  // Short rounds: level 1 is a small reef you can clear in a minute or so;
  // level 5 is the big one, with the boss guarding its exit.
  { cols: 5, rows: 5, enemyCount: 7, repairs: 1, chests: 1 },
  { cols: 6, rows: 6, enemyCount: 10, repairs: 2, chests: 2 },
  { cols: 7, rows: 7, enemyCount: 13, repairs: 2, chests: 2 },
  { cols: 8, rows: 8, enemyCount: 16, repairs: 3, chests: 3 },
  // Level 5 is the boss lair (engine/lair.mjs): a round atoll, not a maze.
  { cols: 9, rows: 9, enemyCount: 16, boss: true, layout: 'lair', repairs: 3 },
]

export const TIER_COUNT = REEF_TUNING.length;

// Tier is 1-based (level codes), REEF_TUNING is 0-based.
function tuningFor(tier) {
  return REEF_TUNING[Math.min(tier - 1, REEF_TUNING.length - 1)];
}

// The level a given reef of a run plays, unless the run was started with an
// explicit one (a level code). Each reef's seed is derived independently
// from the run seed, so any reef can be rebuilt on its own from its code.
export function levelForReef(runSeed, reefIndex, biomeId = BIOME_IDS.TROPICAL) {
  return { biomeId, tier: Math.min(reefIndex + 1, TIER_COUNT), seed: mixSeed(runSeed, reefIndex) };
}

// Stages are FIXED: "Stage 2 – Level 3" is the same reef for every player,
// every attempt (learnable, shareable, and the basis for a numbered level
// catalogue). Stage 1 is Tropical; later stages will take later biomes.
const STAGE_SEED_BASE = 0x5eed2026;
// Each stage is an island group in its own biome (2026-09-29); the four
// cycle after stage 4 (data/stages.mjs names each stage).
const STAGE_BIOMES = [BIOME_IDS.TROPICAL, BIOME_IDS.CLIFF_COVE, BIOME_IDS.GLACIAL, BIOME_IDS.SHIPWRECK];
export function biomeForStage(stage) {
  return STAGE_BIOMES[(Math.max(1, stage || 1) - 1) % STAGE_BIOMES.length];
}
export function stageLevel(stage, levelIndex) {
  return { biomeId: biomeForStage(stage), tier: levelIndex + 1, seed: mixSeed(STAGE_SEED_BASE + stage, levelIndex) };
}

function buildLairWorld(rng) {
  const lair = buildLairGrid(rng);
  const coastSeed = Math.floor(rng() * 2 ** 31);
  const coast = buildCoastField(lair.grid, TILE_SIZE, coastSeed);
  return {
    maze: null, // no graph maze: the lair is rings and spokes
    lair: {
      centre: { x: lair.centreTile.tx * TILE_SIZE, y: lair.centreTile.ty * TILE_SIZE },
      pitRadius: lair.pitRadiusTiles * TILE_SIZE,
      seals: lair.seals.map((t) => ({ x: t.tx * TILE_SIZE, y: t.ty * TILE_SIZE, ring: t.ring })),
    },
    grid: lair.grid,
    coast,
    coastSeed,
    tileSize: TILE_SIZE,
    spawnWorld: { x: lair.spawnTile.tx * TILE_SIZE, y: lair.spawnTile.ty * TILE_SIZE },
    exitWorld: { x: lair.centreTile.tx * TILE_SIZE, y: lair.centreTile.ty * TILE_SIZE },
    widthPx: lair.grid.width * TILE_SIZE,
    heightPx: lair.grid.height * TILE_SIZE,
  };
}

function buildReefWorld(rng, tier) {
  const tuning = tuningFor(tier);
  if (tuning.layout === 'lair') return buildLairWorld(rng);
  const maze = generateMazeGraph(tuning.cols, tuning.rows, rng);
  // No pointless dead ends: loops everywhere except where treasure waits.
  braidMaze(maze, rng, tuning.chests || 0);
  const grid = buildOrganicReefGrid(maze, rng, { room: ROOM, wall: WALL });
  // The smooth coastline (engine/terrain.mjs) is what the boat collides
  // with and what the art draws, so it belongs to the world, not the view.
  const coastSeed = Math.floor(rng() * 2 ** 31);
  const coast = buildCoastField(grid, TILE_SIZE, coastSeed);
  const exitCell = maze.exitCell || farthestCell(maze, maze.start);
  const startTile = cellCenterTile(maze.start, grid);
  const exitTile = cellCenterTile(exitCell, grid);
  return {
    maze,
    grid,
    coast,
    coastSeed,
    tileSize: TILE_SIZE,
    // cellCenterTile is already the geometric centre in tile units (x0 +
    // room/2); the old `+ 0.5` put spawn/exit half a tile toward a wall.
    spawnWorld: { x: startTile.tx * TILE_SIZE, y: startTile.ty * TILE_SIZE },
    exitWorld: { x: exitTile.tx * TILE_SIZE, y: exitTile.ty * TILE_SIZE },
    widthPx: grid.width * TILE_SIZE,
    heightPx: grid.height * TILE_SIZE,
  };
}

// A level's world on its own (layout, coast, spawn, exit) — for previews.
// Same rng order as enterReef, so it's the reef you'll actually sail.
export function buildLevelWorld(level) {
  return buildReefWorld(makeSeededRng(level.seed), level.tier);
}

// Mutates `run` into its next reef: new maze/grid/exit/enemies/pickups,
// boat repositioned to the new spawn with velocity/turn-jam cleared (but
// hull and weapons untouched — those persist across the whole voyage) and
// this reef's at-risk Salvage tally reset to 0.
// Which level a reef plays. Every attempt at a level gets a fresh layout
// (2026-09-29, project owner: replaying the same maps after a loss was
// tedious); a shared level code still pins one exact reef.
export function levelForAttempt(runSeed, reefIndex, attempt, biomeId = BIOME_IDS.TROPICAL) {
  if (attempt === 0) return levelForReef(runSeed, reefIndex, biomeId);
  return { biomeId, tier: Math.min(reefIndex + 1, TIER_COUNT), seed: mixSeed(mixSeed(runSeed, reefIndex), attempt) };
}

function enterReef(run, reefIndex) {
  const attempt = run.attempts[reefIndex] || 0;
  const override = attempt === 0 ? run.levelOverrides[reefIndex] : null;
  const level = override ?? levelForAttempt(run.seed, reefIndex, attempt, run.stage ? biomeForStage(run.stage) : BIOME_IDS.TROPICAL);
  // One rng per reef, from that reef's own seed — the whole reef (layout,
  // coast, enemies, pickups) is a pure function of its level.
  const rng = makeSeededRng(level.seed);
  const world = buildReefWorld(rng, level.tier);
  const tuning = tuningFor(level.tier);

  run.reefIndex = reefIndex;
  run.level = level;
  run.levelCode = encodeLevelCode(level);
  run.levelCodes[reefIndex] = run.levelCode;
  run.maze = world.maze;
  run.lair = world.lair || null;
  // A lair's exit is a sealed whirlpool until its boss dies (isExitOpen).
  run.exitLocked = !!world.lair;
  run.grid = world.grid;
  run.coast = world.coast;
  run.coastSeed = world.coastSeed;
  run.tileSize = world.tileSize;
  run.exitWorld = world.exitWorld;
  run.widthPx = world.widthPx;
  run.heightPx = world.heightPx;

  run.boat.x = world.spawnWorld.x;
  run.boat.y = world.spawnWorld.y;
  run.boat.vx = 0;
  run.boat.vy = 0;
  run.boat.heading = 0;
  run.boat.turnJamRemaining = 0;

  // Stage rosters (data/stages.mjs): ships first, monsters later, and
  // stages past the table scale enemy hull/damage up.
  const stage = run.stage || 1;
  const pool = stagePool(stage, level.tier - 1);
  const scale = stageScaling(stage);
  run.enemies = spawnReefEnemies(
    pool, run.grid, run.tileSize,
    world.spawnWorld, run.exitWorld, tuning.enemyCount, rng,
    // In a lair the pit belongs to the boss alone.
    world.lair ? { exitClearance: world.lair.pitRadius + run.tileSize * 2, scale } : { scale },
  );
  run.enemyProjectiles = [];
  const bossId = tuning.boss ? bossForStage(stage) : null;
  if (tuning.boss) {
    // The stage finale: the stage's boss waits in the lair at level 5.
    const bosses = spawnReefEnemies([bossId], run.grid, run.tileSize, world.spawnWorld, run.exitWorld, 1, rng, { scale });
    if (world.lair) {
      for (const b of bosses) {
        // Lives in its pit: centred, and tethered so it never follows you
        // out through the spokes.
        b.x = b.home.x = world.lair.centre.x;
        b.y = b.home.y = world.lair.centre.y;
        b.tether = world.lair.pitRadius - b.radius - 4;
      }
    }
    run.enemies.push(...bosses);
    // Warding seals, one per ring: the boss can't be hurt until all fall.
    for (const st of world.lair?.seals || []) {
      const seal = createEnemy(ENEMY_IDS.WARDING_SEAL, st.x, st.y, rng, { scale });
      seal.seal = true;
      run.enemies.push(seal);
    }
    updateWards(run.enemies);
  }
  // A weapon turns up in the level that first needs it: caches here are
  // for the weapons this level's enemies (and boss) are countered by.
  const needed = new Set(pool.map((id) => getEnemy(id).counter));
  if (bossId) {
    for (const ph of getEnemy(bossId).phases || []) {
      needed.add(ph.counter);
      if (ph.summon) needed.add(getEnemy(ph.summon.defId).counter);
    }
  }
  const cacheWeapons = CACHE_WEAPON_IDS.filter((w) => needed.has(w));
  run.pickups = spawnReefPickups(run.grid, run.tileSize, world.spawnWorld, rng, {
    cacheWeapons,
    repairs: tuning.repairs ?? 1,
    avoid: world.lair ? { x: world.lair.centre.x, y: world.lair.centre.y, r: world.lair.pitRadius } : null,
  });
  // Treasure in the dead ends (engine/treasure.mjs): armament chests, one
  // of them guarded by an elite. The lair has its seals instead.
  if (world.maze && tuning.chests) {
    const spots = treasureSpots(world.maze, run.grid, run.tileSize, tuning.chests, rng);
    // The elite guards the chest farthest from the start, so a level still
    // opens quiet (nothing awake within reach of the spawn).
    const far = spots.reduce((b, sp) => (!b || Math.hypot(sp.x - world.spawnWorld.x, sp.y - world.spawnWorld.y) > Math.hypot(b.x - world.spawnWorld.x, b.y - world.spawnWorld.y) ? sp : b), null);
    spots.forEach((sp) => {
      run.pickups.push(makeChest(sp.x, sp.y));
      if (sp === far && pool.length && Math.hypot(sp.x - world.spawnWorld.x, sp.y - world.spawnWorld.y) > 280) {
        const eliteId = pool[Math.floor(rng() * pool.length)];
        const e = createEnemy(eliteId, sp.x + (rng() - 0.5) * 30, sp.y + (rng() - 0.5) * 30, rng,
          { scale: { health: scale.health * ELITE.health, damage: scale.damage * ELITE.damage } });
        e.elite = true;
        e.salvageDrop = Math.round(e.salvageDrop * ELITE.salvage);
        run.enemies.push(e);
      }
    });
  }
  run.reefSalvage = 0;
  // Weather (engine/weather.mjs): a fresh sky for every level and retry.
  run.weather = createWeather(level.biomeId || BIOME_IDS.TROPICAL);
  snapshotLevelStart(run);
}

// What a retry of this level restores: the kit you arrived with (taken
// again after an upgrade card that changes it, e.g. Deep Magazines).
export function snapshotLevelStart(run) {
  run.levelStart = {
    heldWeapons: new Set(run.weapons.heldWeapons),
    ammo: { ...run.weapons.ammo },
    activeWeaponId: run.weapons.activeWeaponId,
    armaments: { ...(run.armaments || {}) },
  };
}

// After sinking (checkSunk === true): try the same level again with a new
// layout, a repaired hull and the weapons/ammo you entered it with. Salvage
// already banked is kept; what was at risk in this level went down.
export function retryLevel(run) {
  if (!run.over || run.outcome !== 'sunk') return false;
  run.attempts[run.reefIndex] = (run.attempts[run.reefIndex] || 0) + 1;
  run.retries += 1;
  const snap = run.levelStart;
  run.weapons.heldWeapons = new Set(snap.heldWeapons);
  run.weapons.ammo = { ...snap.ammo };
  run.weapons.activeWeaponId = snap.activeWeaponId;
  run.armaments = { ...(snap.armaments || {}) };
  run.armTimers = {};
  run.weapons.projectiles = [];
  run.weapons.cooldownRemaining = 0;
  run.enemyProjectiles = [];
  run.boat.health = run.boat.maxHull;
  run.over = false;
  run.outcome = null;
  enterReef(run, run.reefIndex);
  return true;
}

// `loadout` is a resolved meta-progression loadout (see BASELINE_LOADOUT's
// shape) — the Captain's Hub (main.mjs, step 7) computes it from persisted
// unlocks via data/meta.mjs's cargoLoadoutFor()/getHull() before calling
// this. run.mjs itself never reads raw unlock/ownership state, only the
// already-resolved numbers, keeping it decoupled from how meta-progression
// is stored.
// `options.levels` (optional): explicit levels by reef index, e.g.
// `{ 0: decodeLevelCode('TR1-0K3F9ZA') }` to play a specific reef first.
// Reefs without one use levelForReef(seed, index).
// `options.stage` (optional): play that stage's fixed levels (stageLevel)
// instead of levels derived from the run seed.
export function createRun(seed, loadout = BASELINE_LOADOUT, { levels = {}, stage = null } = {}) {
  const run = {
    seed: seed >>> 0,
    stage,
    levelOverrides: levels,
    levelCodes: [], // the code of every reef this run has entered, in order
    attempts: [], // per level: how many times it has been retried
    retries: 0,
    enemyProjectiles: [],
    reefIndex: 0,
    reefCount: REEF_COUNT,
    tuning: tuningForHull(loadout.hull),
    // extraMaxHull is a flat Workshop-upgrade bonus (Reinforced Ribs) on
    // top of whichever hull's own maxHull, not a hull-specific number.
    boat: createBoat(0, 0, 0, loadout.hull.maxHull + (loadout.extraMaxHull || 0)),
    // Post-slice combat triangle (data/factions.mjs) — null (unaligned) is
    // valid and means no triangle effect; a call site resolves the actual
    // damage multiplier via engine/enemies.mjs's factionMultiplierFor(run.faction).
    faction: loadout.faction ?? null,
    // Post-slice Workshop crafting (data/meta.mjs) — per-weapon permanent
    // damage multipliers; a call site resolves this via combat.resolveHits'
    // getWeaponMultiplier parameter. {} (no upgrades owned) is a no-op.
    craftedDamageMultipliers: loadout.craftedDamageMultipliers || {},
    // Set true the moment The Kraken's Anchor is killed this run (main.mjs/
    // tools/balance-sim.mjs, on the boss-kill branch) — read by
    // engine/meta.mjs's recordRunResult to award a Kraken Scale. Survives
    // regardless of how the rest of the voyage ends afterward.
    bossDefeated: false,
    weapons: createWeaponState(loadout.extraHeldWeapons, loadout.startingAmmoMultiplier),
    bankedSalvage: 0, // safe — carried from every reef already cleared
    reefSalvage: 0,   // at risk — lost if the boat sinks before this reef's exit
    charms: {
      firstHaul: loadout.charms.firstHaul,
      lastGasp: loadout.charms.lastGasp,
      lastGaspUsed: false,
    },
    over: false,
    outcome: null, // 'victory' | 'sunk', once over
  };
  // Every special weapon trickles back slowly on its own (2026-09-29), so
  // auto-fire can never leave you with a counter weapon stuck at zero.
  run.weapons.baseRegenPerSecond = 0.2;
  run.upgrades = {};
  run.boat.style = loadout.hull.id;
  // Hull perks (data/meta.mjs): a starting build on the same run fields
  // the upgrade cards use.
  const perks = loadout.hull.perks || {};
  if (perks.pickupReach) run.pickupReach = perks.pickupReach;
  if (perks.ammoMaxMult) run.weapons.mods.ammoMax *= perks.ammoMaxMult;
  if (perks.regenMult) run.weapons.baseRegenPerSecond *= perks.regenMult;
  if (perks.ramDamage) run.ramDamage = (run.ramDamage || 0) + perks.ramDamage;
  if (perks.contactDamageTaken) run.contactDamageTaken = (run.contactDamageTaken ?? 1) * perks.contactDamageTaken;
  if (perks.extraCannonballs) run.weapons.mods.extraShots.cannonballs = (run.weapons.mods.extraShots.cannonballs || 0) + perks.extraCannonballs;
  // Shop unlocks beyond the original three tracks (2026-09-29).
  const fx = loadout.charmEffects || {};
  run.salvageMult = fx.salvageMult ?? 1;
  run.boat.wallDamageTaken = fx.wallDamageTaken ?? 1;
  run.boat.repairMult = fx.repairMult ?? 1;
  run.chestChoices = fx.chestChoices ?? 3;
  run.chestSalvage = fx.chestSalvage ?? 0;
  run.levelClearHeal = fx.levelClearHeal ?? 0;
  run.extraCardChoices = fx.extraCardChoices ?? 0;
  run.armamentDamage = loadout.armamentDamageMult ?? 1;
  if (loadout.speedMult && loadout.speedMult !== 1) {
    run.tuning = { ...run.tuning, maxSpeed: run.tuning.maxSpeed * loadout.speedMult, acceleration: run.tuning.acceleration * loadout.speedMult };
  }
  for (const id of loadout.startingArmaments || []) grantArmament(run, id);
  if (loadout.charms.steadyHands) {
    run.weapons.ammoRegenPerSecond = CHARMS[CHARM_IDS.STEADY_HANDS].ammoRegenPerSecond;
  }
  enterReef(run, 0);
  return run;
}

export function totalSalvage(run) {
  return run.bankedSalvage + run.reefSalvage;
}

// Call whenever Salvage is gained (a kill drop or a pickup) — it's at risk
// until the current reef's exit is reached. Applies the First Haul charm's
// bonus while still on the first reef, if owned.
export function addSalvage(run, amount) {
  const boosted = ((run.charms.firstHaul && run.reefIndex === 0)
    ? amount * CHARMS[CHARM_IDS.FIRST_HAUL].firstReefSalvageMultiplier
    : amount) * (run.salvageMult ?? 1);
  run.reefSalvage += boosted;
}

// Checked every frame. Returns:
//   null      — not at the exit, nothing happened
//   'advanced' — this reef's Salvage was banked and the voyage moved on to
//                the next reef (run stays in progress)
//   'victory'  — the last reef's exit was reached; the whole voyage is over
// The exit is open unless it's a lair's sealed whirlpool with its boss
// still alive.
export function isExitOpen(run) {
  return !run.exitLocked || !run.enemies.some((e) => e.isBoss && e.health > 0);
}

export function checkReachedExit(run) {
  if (run.over) return null;
  if (!isExitOpen(run)) return null;
  const dx = run.boat.x - run.exitWorld.x;
  const dy = run.boat.y - run.exitWorld.y;
  if (Math.hypot(dx, dy) > EXIT_RADIUS_TILES * run.tileSize) return null;

  run.bankedSalvage += run.reefSalvage;
  run.reefSalvage = 0;

  if (run.reefIndex >= run.reefCount - 1) {
    run.over = true;
    run.outcome = 'victory';
    return 'victory';
  }
  // Second Wind (charm): clearing a level patches some hull.
  if (run.levelClearHeal) run.boat.health = Math.min(run.boat.maxHull, run.boat.health + run.boat.maxHull * run.levelClearHeal);
  enterReef(run, run.reefIndex + 1);
  return 'advanced';
}

// Checked every frame after collision/damage is applied. A sunk boat ends
// the voyage unless the player retries the level (retryLevel) — whatever
// Salvage was still at risk in the current reef (run.reefSalvage) is lost
// either way; only run.bankedSalvage survives. Returns:
//   false      — hull is above 0, nothing happened
//   true       — the boat sank; the whole voyage is over
//   'revived'  — the boat would have sunk, but the Last Gasp charm (owned,
//                unused this run) patched it through at 1 hull instead;
//                the run continues
export function checkSunk(run) {
  if (run.over) return false;
  if (run.boat.health > 0) return false;

  if (run.charms.lastGasp && !run.charms.lastGaspUsed) {
    run.charms.lastGaspUsed = true;
    run.boat.health = 1;
    return 'revived';
  }

  run.over = true;
  run.outcome = 'sunk';
  return true;
}
