// Survival mode rules (2026-10-04): the wave director, XP and ship levels,
// level-up choices, the auto-firing core weapons, fire pools and loot.
// Pure logic over a survival run (engine/survivalRun.mjs builds one); no
// DOM or Canvas. Content lives in data/survival.mjs.

import { initLord } from './warlord.mjs';
import { DEV } from './devTuning.mjs';
import { DASH, SYNERGIES, FINAL_STRETCH } from '../data/survival.mjs';
import {
  SURVIVAL, SV_WEAPONS, SV_WEAPON_IDS, SV_WEAPON_MAX, PASSIVES, PASSIVE_BY_ID, PASSIVE_MAX,
  WAVES, waveScaling, HORDE_FOR_BIOME, LOOT, GEMS, GEM_CAP, xpToNext,
} from '../data/survival.mjs';
import { ARMAMENTS, ARMAMENT_BY_ID, ARMAMENT_MAX_LEVEL } from '../data/armaments.mjs';
import { getEnemy, ARCHETYPES } from '../data/enemies.mjs';
import { stagePool, bossForStage, stageScaling } from '../data/stages.mjs';
import { createEnemy, passesOverLand, currentCounter } from './enemies.mjs';
import { applyDamageToEnemy } from './combat.mjs';
import { interceptHeading } from './aim.mjs';
import { sampleField } from './terrain.mjs';
import { armamentLevel } from './armaments.mjs';

let nextPickupId = 9_000_000;
let nextShotId = 8_000_000;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// State

export function createSurvivalState({ stage = 1, levelIndex = 0, biomeId = 'tropical' } = {}) {
  const pool = stagePool(stage, levelIndex);
  return {
    stage, levelIndex,
    wave: 0, // 0-based; WAVES[wave]
    waveTime: 0,
    time: 0,
    spawnTimer: 1.2,
    eventsDone: {},
    xp: 0, shipLevel: 1, xpNeed: xpToNext(1), pendingLevelUps: 0,
    weapons: {}, // core weapon id -> level
    evolved: {}, // core weapon id -> true
    passives: {}, // passive id -> level
    timers: {},
    pools: [],
    orbitAngle: 0, trailTimer: 0,
    hordeId: HORDE_FOR_BIOME[biomeId] || HORDE_FOR_BIOME.tropical,
    specials: pool.filter((id) => !getEnemy(id).isBoss),
    bossId: null, // the enemy id of this level's warlord / stage boss
    bossDefId: levelIndex >= 4 ? bossForStage(stage) : null,
    finished: false,
    pendingChests: 0,
    kills: 0,
    coins: 0,
    stats: null,
    // Tallies for contracts, achievements and the bestiary.
    killsByDef: {}, eliteKills: 0, chestsOpened: 0, hullLost: 0,
    // Daily-voyage modifiers (data/progression.mjs DAILY_MODS).
    countMult: 1, xpMult: 1, enemySpeed: 1,
  };
}

// Every weapon slot (core weapons and armaments) in the order they were taken.
export function weaponSlots(run) {
  const sv = run.sv;
  return [...Object.keys(sv.weapons), ...Object.keys(run.armaments || {})];
}

// Totals from passives and the meta loadout. Recomputed on every choice.
export function recomputeStats(run) {
  const sv = run.sv;
  const t = { cooldown: 0, damage: 0, resist: 0, maxHull: 0, speed: 0, turn: 0, pickup: 0, salvage: 0, projSpeed: 0, range: 0, regen: 0, ram: 0, contact: 0, dash: 0 };
  for (const [id, lv] of Object.entries(sv.passives)) {
    const p = PASSIVE_BY_ID[id];
    for (const [k, v] of Object.entries(p.per)) t[k] += v * lv;
  }
  const base = run.baseStats;
  sv.stats = {
    cooldownMult: Math.max(0.45, (1 + t.cooldown) * (base.cooldownMult ?? 1)) / DEV.fireRate,
    damageMult: (1 + t.damage) * (base.damageMult ?? 1) * DEV.playerDamage,
    damageTaken: Math.max(0.4, 1 - t.resist) * (base.takenMult ?? 1),
    pickup: (1 + t.pickup) * (base.pickupMult ?? 1) * DEV.pickup,
    salvageMult: 1 + t.salvage,
    projSpeed: 1 + t.projSpeed,
    rangeMult: 1 + t.range,
    regen: t.regen,
    ram: t.ram + (base.ram || 0),
    contactTaken: Math.max(0.4, (1 + t.contact) * (base.contactTaken ?? 1)),
    dashCooldown: Math.max(DASH.minCooldown, DASH.cooldown * (1 + t.dash) * (base.dashMult ?? 1)),
  };
  // Ship handling and hull.
  const tuning = base.tuning;
  run.tuning = {
    ...tuning,
    maxSpeed: tuning.maxSpeed * (1 + t.speed) * DEV.playerSpeed,
    acceleration: tuning.acceleration * (1 + t.speed) * DEV.playerSpeed,
    turnRate: tuning.turnRate * (1 + t.turn),
  };
  const newMax = Math.round((base.maxHull + t.maxHull) * DEV.playerHull);
  if (newMax > run.boat.maxHull) run.boat.health += newMax - run.boat.maxHull; // the new planks are whole
  run.boat.maxHull = newMax;
  run.boat.health = Math.min(run.boat.health, run.boat.maxHull);
  run.hullRegenPerSecond = sv.stats.regen;
  run.ramDamage = sv.stats.ram;
  run.contactDamageTaken = sv.stats.contactTaken;
  return sv.stats;
}

// ---------------------------------------------------------------------------
// XP, ship levels and choices

export function addXp(run, amount) {
  const sv = run.sv;
  sv.xp += amount * (sv.xpMult || 1) * DEV.xp;
  let ups = 0;
  while (sv.xp >= sv.xpNeed) {
    sv.xp -= sv.xpNeed;
    sv.shipLevel += 1;
    sv.xpNeed = xpToNext(sv.shipLevel);
    sv.pendingLevelUps += 1;
    ups += 1;
  }
  return ups;
}

// Which stage enemies (horde included) a weapon counters — for the cards.
export function countersInLevel(run, weaponId) {
  const ids = new Set([run.sv.hordeId, ...run.sv.specials]);
  if (run.sv.bossDefId) {
    const b = getEnemy(run.sv.bossDefId);
    for (const ph of b.phases || []) if (ph.counter === weaponId) ids.add(run.sv.bossDefId);
  }
  return [...ids].filter((id) => getEnemy(id).counter === weaponId || id === run.sv.bossDefId).map((id) => getEnemy(id).name);
}

export function evolutionsUsed(run) {
  return Object.keys(run.sv.evolved).filter((k) => run.sv.evolved[k]).length;
}

export function canEvolve(run, weaponId) {
  const sv = run.sv;
  const w = SV_WEAPONS[weaponId];
  return !!w && !sv.evolved[weaponId] && evolutionsUsed(run) < SURVIVAL.maxEvolutions && (sv.weapons[weaponId] || 0) >= SV_WEAPON_MAX && (sv.passives[w.evolve.with] || 0) > 0;
}

// Up to `count` distinct cards: { kind, id }. kind: 'weapon' | 'armament' |
// 'passive' | 'evolve' | 'repair' | 'salvage'. An available evolution is
// always offered.
export function rollChoices(run, rng = Math.random, count = SURVIVAL.choices) {
  const sv = run.sv;
  const slotsFull = weaponSlots(run).length >= SURVIVAL.maxWeapons;
  const passivesFull = Object.keys(sv.passives).length >= SURVIVAL.maxPassives;
  const out = [];
  for (const id of SV_WEAPON_IDS) if (canEvolve(run, id) && out.length < count) out.push({ kind: 'evolve', id });
  const cands = [];
  for (const id of SV_WEAPON_IDS) {
    const lv = sv.weapons[id] || 0;
    if (lv > 0 && lv < SV_WEAPON_MAX) cands.push({ kind: 'weapon', id, w: 11 });
    // Early on a build wants guns: new weapons dominate the first picks.
    else if (lv === 0 && !slotsFull && !run.poolLocked?.has(id)) cands.push({ kind: 'weapon', id, w: (countersInLevel(run, id).length ? 12 : 7) * (weaponSlots(run).length < 3 ? 1.6 : 1) });
  }
  for (const a of ARMAMENTS) {
    const lv = armamentLevel(run, a.id);
    if (lv > 0 && lv < ARMAMENT_MAX_LEVEL) cands.push({ kind: 'armament', id: a.id, w: 9 });
    else if (lv === 0 && !slotsFull && !run.poolLocked?.has(a.id)) cands.push({ kind: 'armament', id: a.id, w: 3 });
  }
  for (const p of PASSIVES) {
    const lv = sv.passives[p.id] || 0;
    if (lv > 0 && lv < PASSIVE_MAX) cands.push({ kind: 'passive', id: p.id, w: 7 });
    else if (lv === 0 && !passivesFull) cands.push({ kind: 'passive', id: p.id, w: weaponSlots(run).length < 3 ? 2 : 4 });
  }
  while (out.length < count && cands.length) {
    const total = cands.reduce((a, c) => a + c.w, 0);
    let r = rng() * total; let i = 0;
    for (; i < cands.length - 1; i++) { r -= cands[i].w; if (r <= 0) break; }
    const c = cands.splice(i, 1)[0];
    out.push({ kind: c.kind, id: c.id });
  }
  // Everything maxed: patch the hull or take Salvage.
  if (out.length < count) out.push({ kind: 'repair', id: 'repair' });
  if (out.length < count) out.push({ kind: 'salvage', id: 'salvage' });
  return out;
}

// The level a card would take something to (for the card's stars).
export function levelOf(run, card) {
  if (card.kind === 'weapon') return run.sv.weapons[card.id] || 0;
  if (card.kind === 'armament') return armamentLevel(run, card.id);
  if (card.kind === 'passive') return run.sv.passives[card.id] || 0;
  return 0;
}

export function applyChoice(run, card) {
  const sv = run.sv;
  switch (card.kind) {
    case 'weapon': sv.weapons[card.id] = Math.min(SV_WEAPON_MAX, (sv.weapons[card.id] || 0) + 1); sv.timers[card.id] ??= 0.3; break;
    case 'armament': run.armaments ||= {}; run.armaments[card.id] = Math.min(ARMAMENT_MAX_LEVEL, armamentLevel(run, card.id) + 1); break;
    case 'passive': {
      sv.passives[card.id] = Math.min(PASSIVE_MAX, (sv.passives[card.id] || 0) + 1);
      break;
    }
    case 'evolve': sv.evolved[card.id] = true; break;
    case 'repair': run.boat.health = Math.min(run.boat.maxHull, run.boat.health + run.boat.maxHull * 0.35); break;
    case 'salvage': return { salvage: 20 };
    default: return null;
  }
  recomputeStats(run);
  return {};
}

// ---------------------------------------------------------------------------
// The wave director

function hittable(e) {
  return e.health > 0 && !e.warded && !e.phased;
}

function isFlyerDef(def) {
  return def.archetype === ARCHETYPES.FLYER || !!def.flies;
}

// A spawn point `dist` px from the boat at angle `a`, or null if that's
// land (ships) or off the map.
function spawnPoint(run, a, dist, flyer) {
  const x = run.boat.x + Math.cos(a) * dist; const y = run.boat.y + Math.sin(a) * dist;
  const pad = run.tileSize * 3;
  if (x < pad || y < pad || x > run.widthPx - pad || y > run.heightPx - pad) return null;
  if (flyer) return { x, y };
  const tx = Math.floor(x / run.tileSize); const ty = Math.floor(y / run.tileSize);
  return run.arena.waterDist[ty]?.[tx] >= 1.6 ? { x, y } : null;
}

function findSpawn(run, dist, flyer, rng, aim = null, spread = Math.PI) {
  for (let tries = 0; tries < 14; tries++) {
    const a = aim == null ? rng() * TAU : aim + (rng() - 0.5) * 2 * spread;
    const d = dist * (0.95 + rng() * 0.25);
    const p = spawnPoint(run, a, d, flyer);
    if (p) return p;
  }
  // Nothing on the ring (a coast all round): try further in.
  for (let tries = 0; tries < 10; tries++) {
    const p = spawnPoint(run, rng() * TAU, dist * (0.7 + rng() * 0.2), flyer);
    if (p) return p;
  }
  return null;
}

function spawnEnemy(run, defId, p, rng, { health = 1, radius = 1, damage = 1, elite = false, warlord = false } = {}) {
  const sv = run.sv;
  const ws = waveScaling(sv.stage, sv.levelIndex, sv.wave);
  // Stage toughness is halved here: a survival level faces a whole crowd,
  // and later stages already bring more of them (waveScaling).
  const vs = stageScaling(sv.stage);
  const ss = { health: 1 + (vs.health - 1) * 0.5, damage: 1 + (vs.damage - 1) * 0.5 };
  // The horde stays one-shot fodder for a fresh build in every stage; the
  // stage's toughness lives in its specialists.
  const hordeDef = getEnemy(defId).horde;
  const e = createEnemy(defId, p.x, p.y, rng, { scale: { health: (hordeDef ? 1 : ss.health) * ws.health * health * DEV.enemyHealth * (warlord || run.sv.bossDefId === defId ? DEV.bossHealth : 1), damage: ss.damage * damage * SURVIVAL.enemyDamage * DEV.enemyDamage } });
  e.hunting = true; e.aggro = true;
  e.speed *= ws.speed * (sv.enemySpeed || 1) * DEV.enemySpeed;
  if (radius !== 1) e.radius *= radius;
  const def = getEnemy(defId);
  e.xp = def.horde ? 1 : Math.max(2, Math.round(def.maxHealth / 10));
  if (elite) { e.elite = true; e.xp = 20; e.salvageDrop = Math.max(6, e.salvageDrop * 3); }
  if (warlord) { e.warlord = true; e.xp = 60; e.salvageDrop = 30; }
  run.enemies.push(e);
  return e;
}

// A warlord's crew (engine/warlord.mjs): one horde enemy at a point on
// water (flyers anywhere), or null.
export function spawnCrew(run, x, y, rng = Math.random) {
  const id = run.sv.hordeId;
  const flyer = isFlyerDef(getEnemy(id));
  if (!flyer) {
    const tx = Math.floor(x / run.tileSize); const ty = Math.floor(y / run.tileSize);
    if (!(run.arena?.waterDist[ty]?.[tx] >= 1.2)) return null;
  }
  return spawnEnemy(run, id, { x, y }, rng);
}

// How many gun-carrying specialists may be afloat at once: enemy fire is
// the deadliest thing in the water, so it ramps with the wave and level
// instead of with the crowd (a hundred cutters would be a bullet hell).
export function gunnerCap(sv) {
  return Math.round(3 + sv.wave * 0.55 + sv.levelIndex * 0.8 + Math.min(4, (sv.stage - 1) * 0.4));
}

function pickSpecial(run, rng) {
  const s = run.sv.specials;
  if (!s.length) return run.sv.hordeId;
  let gunners = 0;
  for (const e of run.enemies) if (e.health > 0 && e.gun && !e.isBoss && !e.warlord) gunners++;
  const capped = gunners >= gunnerCap(run.sv);
  // At most one rooted siren at a time.
  for (let k = 0; k < 4; k++) {
    const id = s[Math.floor(rng() * s.length)];
    if (getEnemy(id).archetype === ARCHETYPES.SIREN && run.enemies.some((e) => e.defId === id && e.health > 0)) continue;
    if (capped && getEnemy(id).gun) continue;
    return id;
  }
  return run.sv.hordeId;
}

function toughestSpecial(run) {
  let best = run.sv.hordeId;
  for (const id of run.sv.specials) {
    const d = getEnemy(id);
    if (d.archetype === ARCHETYPES.SIREN || d.archetype === ARCHETYPES.TOTEM) continue;
    if (d.maxHealth > getEnemy(best).maxHealth) best = id;
  }
  return best;
}

function runEvent(run, event, ctx, rng, out) {
  const sv = run.sv;
  const ws = waveScaling(sv.stage, sv.levelIndex, sv.wave);
  if (event === 'encircle') {
    // A ring of the horde closes in from every side at once.
    const n = Math.round((12 + sv.wave * 1.5) * ws.count * DEV.enemyCount);
    const def = getEnemy(sv.hordeId);
    const R = ctx.spawnDist * 0.9;
    for (let i = 0; i < n; i++) {
      const p = spawnPoint(run, (i / n) * TAU, R, isFlyerDef(def));
      if (p) out.spawned.push(spawnEnemy(run, sv.hordeId, p, rng));
    }
    out.encircle = true;
  } else if (event === 'elite' || event === 'elite2') {
    for (let k = 0; k < (event === 'elite2' ? 2 : 1); k++) {
      const id = pickSpecial(run, rng);
      const p = findSpawn(run, ctx.spawnDist, isFlyerDef(getEnemy(id)), rng);
      if (!p) continue;
      const e = spawnEnemy(run, id, p, rng, { health: SURVIVAL.eliteHp + sv.levelIndex * 0.5, radius: 1.3, damage: 1.2, elite: true });
      out.elites.push(e);
    }
  } else if (event === 'boss') {
    const heading = Math.atan2(run.boat.vy || 0, run.boat.vx || 1);
    let e;
    if (sv.bossDefId) {
      const def = getEnemy(sv.bossDefId);
      const p = findSpawn(run, ctx.spawnDist * 0.85, isFlyerDef(def), rng, heading, 1.2) || { x: run.boat.x, y: run.boat.y - ctx.spawnDist * 0.8 };
      e = spawnEnemy(run, sv.bossDefId, p, rng, { health: SURVIVAL.bossHp });
      e.xp = 0;
    } else {
      const id = toughestSpecial(run);
      const def = getEnemy(id);
      const p = findSpawn(run, ctx.spawnDist * 0.85, isFlyerDef(def), rng, heading, 1.2) || { x: run.boat.x, y: run.boat.y - ctx.spawnDist * 0.8 };
      e = spawnEnemy(run, id, p, rng, { health: SURVIVAL.warlordHp * (def.horde ? 3 : 1), radius: 1.75, damage: 1.4, elite: true, warlord: true });
      e.contactCooldownRemaining = 0;
    }
    initLord(e, { levelIndex: sv.levelIndex, stage: sv.stage, boss: !!sv.bossDefId }, rng);
    sv.bossId = e.id;
    out.boss = e;
    // An escort ring arrives with it.
    runEvent(run, 'encircle', ctx, rng, out);
  }
}

// Advances the level clock, the spawns and the set pieces. `ctx.spawnDist`
// is how far from the boat (px) enemies appear: just off the screen.
// Returns { spawned, elites, boss, waveStarted, encircle, finished }.
export function stepDirector(run, dt, ctx, rng = Math.random) {
  const sv = run.sv;
  const out = { spawned: [], elites: [], boss: null, waveStarted: null, encircle: false, finished: false };
  if (sv.finished) return out;
  sv.time += dt; sv.waveTime += dt;
  const last = WAVES.length - 1;
  if (sv.wave < last && sv.waveTime >= SURVIVAL.waveSeconds * DEV.waveLength) {
    sv.wave += 1; sv.waveTime = 0;
    out.waveStarted = sv.wave;
  }
  const W = WAVES[sv.wave];
  if (out.waveStarted === FINAL_STRETCH) out.finalStretch = true;
  // The final stretch: an elite hunter every so often.
  if (W.hunters) {
    sv.hunterTimer = (sv.hunterTimer ?? W.hunters * 0.5) - dt;
    if (sv.hunterTimer <= 0) {
      sv.hunterTimer = W.hunters;
      runEvent(run, 'elite', ctx, rng, out);
    }
  }
  if (W.event && !sv.eventsDone[sv.wave]) {
    sv.eventsDone[sv.wave] = true;
    runEvent(run, W.event, ctx, rng, out);
  }
  if (sv.wave === 0 && !sv.eventsDone.start) {
    sv.eventsDone.start = true;
    out.waveStarted = 0;
  }

  // Steady spawns.
  const ws = waveScaling(sv.stage, sv.levelIndex, sv.wave);
  sv.spawnTimer -= dt * ws.rate * DEV.spawnRate;
  if (sv.spawnTimer <= 0) {
    sv.spawnTimer += W.every;
    let alive = 0;
    for (const e of run.enemies) if (e.health > 0) alive++;
    const cm = (sv.countMult || 1) * DEV.enemyCount;
    const cap = Math.round(W.alive * ws.count * cm);
    const want = Math.min(cap - alive, Math.max(1, Math.round(W.batch * ws.count * cm)));
    // A batch arrives together from one direction, so you can read it.
    const aim = rng() * TAU;
    for (let i = 0; i < want; i++) {
      const id = rng() < W.special ? pickSpecial(run, rng) : sv.hordeId;
      const p = findSpawn(run, ctx.spawnDist, isFlyerDef(getEnemy(id)), rng, aim, 0.5);
      if (p) out.spawned.push(spawnEnemy(run, id, p, rng));
    }
  }

  // The level ends when the last wave's warlord or boss is sunk.
  if (sv.wave === last && sv.bossId != null) {
    const b = run.enemies.find((e) => e.id === sv.bossId);
    if (!b || b.health <= 0) { sv.finished = true; out.finished = true; }
  }
  return out;
}

// Seconds left until the boss wave (0 once it's here).
export function timeToBoss(run) {
  const sv = run.sv;
  const last = WAVES.length - 1;
  if (sv.wave >= last) return 0;
  return (last - sv.wave) * SURVIVAL.waveSeconds * DEV.waveLength - sv.waveTime;
}

// Enemies left far behind are brought back in ahead of you, so the
// pressure never drops just because you sailed away.
export function recycleStragglers(run, ctx, rng = Math.random) {
  const far = ctx.spawnDist * SURVIVAL.recycleBeyond;
  const heading = Math.atan2(run.boat.vy || 0, run.boat.vx || 1);
  const moving = Math.hypot(run.boat.vx || 0, run.boat.vy || 0) > 30;
  let n = 0;
  for (const e of run.enemies) {
    if (e.health <= 0 || e.isBoss || e.warlord || e.tether) continue;
    const d = Math.hypot(e.x - run.boat.x, e.y - run.boat.y);
    if (d < far) continue;
    const p = findSpawn(run, ctx.spawnDist, passesOverLand(e), rng, moving ? heading : null, 1.1);
    if (!p) continue;
    e.x = p.x; e.y = p.y; e.vx = 0; e.vy = 0; e._aimX = null;
    n++;
  }
  return n;
}

// Keeps the crowd from stacking into one blob: overlapping enemies push
// apart (ships from ships, flyers from flyers). A spatial hash keeps it
// cheap with a hundred on the water.
export function separateEnemies(enemies, cell = 28) {
  const grid = new Map();
  const key = (cx, cy) => cx * 73856093 ^ cy * 19349663;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell));
    let b = grid.get(k); if (!b) grid.set(k, b = []);
    b.push(e);
  }
  for (const e of enemies) {
    if (e.health <= 0 || e.isBoss) continue;
    const cx = Math.floor(e.x / cell); const cy = Math.floor(e.y / cell);
    const fly = passesOverLand(e);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const b = grid.get(key(cx + dx, cy + dy)); if (!b) continue;
      for (const o of b) {
        if (o === e || o.health <= 0 || o.id < e.id && !o.isBoss) continue;
        if (passesOverLand(o) !== fly) continue;
        const ddx = e.x - o.x; const ddy = e.y - o.y;
        const d = Math.hypot(ddx, ddy); const min = (e.radius + o.radius) * 0.9;
        if (d >= min || d < 1e-3) continue;
        const push = (min - d) / d;
        const we = o.isBoss ? 1 : 0.5; const wo = o.isBoss ? 0 : 0.5;
        e.x += ddx * push * we; e.y += ddy * push * we;
        o.x -= ddx * push * wo; o.y -= ddy * push * wo;
      }
    }
  }
}

// A bump: the enemy that rammed you is thrown back (the horde regroups and
// comes again rather than grinding against your hull).
export function knockBack(enemy, boat, strength = 110) {
  const dx = enemy.x - boat.x; const dy = enemy.y - boat.y;
  const d = Math.hypot(dx, dy) || 1;
  enemy.vx = (dx / d) * strength; enemy.vy = (dy / d) * strength;
  if (getEnemy(enemy.defId).horde) enemy.recoil = 0.35;
  else { enemy.x += (dx / d) * 4; enemy.y += (dy / d) * 4; }
}

// ---------------------------------------------------------------------------
// Loot

function gemTier(value) {
  return value >= 25 ? GEMS[2] : value >= 5 ? GEMS[1] : GEMS[0];
}

export function makeGem(x, y, value) {
  return { id: nextPickupId++, kind: 'gem', x, y, value, tier: gemTier(value), collected: false, pulled: false, age: 0 };
}

function pushGem(run, x, y, value) {
  let gems = 0; let nearest = null; let nd = Infinity;
  for (const p of run.pickups) {
    if (p.kind !== 'gem' || p.collected) continue;
    gems++;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < nd) { nd = d; nearest = p; }
  }
  // Too much glass on the water: fold this one into the nearest gem.
  if (gems >= GEM_CAP && nearest) { nearest.value += value; nearest.tier = gemTier(nearest.value); return; }
  run.pickups.push(makeGem(x, y, value));
}

// Loot must land where a ship can reach it: something sunk over an island
// (a flyer, a burrower) spills toward you until it's over water.
function lootSpot(run, x, y) {
  if (!run.coast || sampleField(run.coast, x, y) < -6) return { x, y };
  const dx = run.boat.x - x; const dy = run.boat.y - y; const d = Math.hypot(dx, dy) || 1;
  for (let s = 8; s < d; s += 8) {
    const px = x + (dx / d) * s; const py = y + (dy / d) * s;
    if (sampleField(run.coast, px, py) < -8) return { x: px, y: py };
  }
  return { x: run.boat.x, y: run.boat.y };
}

export function dropLoot(run, enemy, rng = Math.random) {
  const def = getEnemy(enemy.defId);
  const spot = lootSpot(run, enemy.x, enemy.y);
  enemy = { ...enemy, x: spot.x, y: spot.y };
  let xp = enemy.xp ?? (def.horde ? 1 : 2);
  // Big rewards come as a spill of glass.
  const spill = [];
  while (xp >= 25 && spill.length < 4) { spill.push(25); xp -= 25; }
  while (xp >= 5 && spill.length < 6) { spill.push(5); xp -= 5; }
  if (xp > 0) spill.push(xp);
  spill.forEach((v, i) => {
    const a = (i / spill.length) * TAU + rng(); const r = spill.length > 1 ? 6 + rng() * 10 : 0;
    pushGem(run, enemy.x + Math.cos(a) * r, enemy.y + Math.sin(a) * r, v);
  });
  const coin = (amount) => run.pickups.push({ id: nextPickupId++, kind: 'coin', x: enemy.x + (rng() - 0.5) * 12, y: enemy.y + (rng() - 0.5) * 12, amount, collected: false, pulled: false, age: 0 });
  if (enemy.elite || enemy.warlord) {
    coin(enemy.salvageDrop);
    run.pickups.push({ id: nextPickupId++, kind: 'chest', x: enemy.x, y: enemy.y, amount: 1, collected: false, age: 0 });
  } else if (def.horde) {
    if (rng() < LOOT.hordeCoin) coin(1);
  } else if (rng() < LOOT.specialCoin) {
    coin(Math.max(1, Math.round(enemy.salvageDrop / 3)));
  }
  if (rng() < LOOT.repair) run.pickups.push({ id: nextPickupId++, kind: 'repair', x: enemy.x, y: enemy.y, amount: 0.25, collected: false, pulled: false, age: 0 });
  else if (rng() < LOOT.magnet) run.pickups.push({ id: nextPickupId++, kind: 'magnet', x: enemy.x, y: enemy.y, amount: 1, collected: false, pulled: false, age: 0 });
}

// Pulls nearby gems/coins to the boat and collects what reaches it.
// Returns { xp, salvage, repaired, chests, magnet } for this frame.
export function stepPickups(run, dt, boatRadius = 11) {
  const out = { xp: 0, salvage: 0, repaired: 0, chests: 0, magnet: false, collected: 0 };
  const b = run.boat;
  const reach = SURVIVAL.pickupRadius * (run.sv.stats?.pickup ?? 1);
  for (const p of run.pickups) {
    if (p.collected) continue;
    p.age = (p.age || 0) + dt;
    const dx = b.x - p.x; const dy = b.y - p.y; const d = Math.hypot(dx, dy);
    if (p.kind === 'chest') {
      if (d < boatRadius + 14) { p.collected = true; out.chests++; }
      continue;
    }
    if (p.kind === 'repair' && b.health >= b.maxHull && !p.pulled) continue;
    if (!p.pulled && d < reach) p.pulled = true;
    if (p.pulled) {
      p.pullT = (p.pullT || 0) + dt;
      const sp = Math.min(760, 140 + p.pullT * 900);
      const step = Math.min(d, sp * dt);
      p.x += (dx / (d || 1)) * step; p.y += (dy / (d || 1)) * step;
    }
    if (Math.hypot(b.x - p.x, b.y - p.y) < boatRadius + 4) {
      p.collected = true; out.collected++;
      if (p.kind === 'gem') out.xp += p.value;
      else if (p.kind === 'coin') out.salvage += p.amount;
      else if (p.kind === 'repair') {
        const before = b.health;
        b.health = Math.min(b.maxHull, b.health + b.maxHull * p.amount * (b.repairMult ?? 1));
        out.repaired += b.health - before;
      } else if (p.kind === 'magnet') {
        out.magnet = true;
        for (const q of run.pickups) if (!q.collected && (q.kind === 'gem' || q.kind === 'coin')) q.pulled = true;
      }
    }
  }
  if (run.pickups.length > 60 && run.pickups.some((p) => p.collected)) run.pickups = run.pickups.filter((p) => !p.collected);
  return out;
}

// ---------------------------------------------------------------------------
// The core weapons, firing on their own

// A weapon's stats at its level (or evolved), with the ship's upgrades.
export function weaponStats(run, id) {
  const sv = run.sv; const w = SV_WEAPONS[id];
  const lv = sv.weapons[id] || 0;
  if (!lv) return null;
  const base = sv.evolved[id] ? w.evolve.stats : w.levels[lv - 1];
  const st = sv.stats;
  const crafted = run.craftedDamageMultipliers?.[id] || 1;
  return {
    ...base,
    damage: base.damage * st.damageMult * crafted,
    burn: base.burn != null ? base.burn * st.damageMult * crafted : undefined,
    cooldown: base.cooldown * st.cooldownMult,
    range: base.range * st.rangeMult,
    speed: base.speed * st.projSpeed,
    count: base.count + (id === 'cannonballs' ? (run.baseStats.extraCannonballs || 0) : 0),
  };
}

function shot(run, weaponId, x, y, heading, speed, o) {
  const p = {
    id: nextShotId++, weaponId, x, y,
    vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed,
    radius: o.radius ?? 3.5, traveled: 0, maxRange: o.range,
    fuseRemaining: o.fuse ?? null, pierceLeft: o.pierce || 0, hitIds: null, spent: false,
    damage: o.damage, counterMult: SURVIVAL.counterBonus, counterId: o.counterId || weaponId,
    evo: !!run.sv.evolved[o.counterId || weaponId],
    ...o.extra,
  };
  run.weapons.projectiles.push(p);
  return p;
}

// Can this weapon hurt this enemy right now?
function canHit(e, id) {
  if (!hittable(e)) return false;
  if (e.invulnerable) return id === 'depth_charges' && e.submergedState === 'submerged';
  return true;
}

// Targets in reach, what the weapon counters first, then nearest.
function targetsFor(run, enemies, id, range) {
  const b = run.boat;
  const list = [];
  for (const e of enemies) {
    if (!canHit(e, id)) continue;
    const d = Math.hypot(e.x - b.x, e.y - b.y);
    if (d > range + e.radius) continue;
    const counter = currentCounter(e) === id;
    list.push({ e, d, score: d * (counter ? 0.45 : 1) * (id === 'depth_charges' && e.invulnerable ? 0.4 : 1) });
  }
  list.sort((a, b2) => a.score - b2.score);
  return list;
}

// Where a crowd is thickest near `e` (for blasts and fire).
function crowdCentre(enemies, e, r = 50) {
  let sx = 0; let sy = 0; let n = 0;
  for (const o of enemies) {
    if (o.health <= 0) continue;
    if (Math.hypot(o.x - e.x, o.y - e.y) <= r) { sx += o.x; sy += o.y; n++; }
  }
  return n ? { x: sx / n, y: sy / n, n } : { x: e.x, y: e.y, n: 1 };
}

// Fires every core weapon whose reload is up and has something to shoot.
// `visible` is what your crew can see (fog and darkness hide the rest).
// Returns the weapon ids that fired (for sounds and muzzle flashes).
export function fireWeapons(run, dt, visible, rng = Math.random) {
  const sv = run.sv; const b = run.boat;
  const fired = [];
  for (const id of Object.keys(sv.weapons)) {
    const st = weaponStats(run, id);
    sv.timers[id] = (sv.timers[id] ?? 0) - dt;
    if (sv.timers[id] > 0) continue;
    const t = targetsFor(run, visible, id, st.range);
    if (!t.length) { sv.timers[id] = 0.12; continue; }
    sv.timers[id] = st.cooldown;
    fired.push({ id, heading: Math.atan2(t[0].e.y - b.y, t[0].e.x - b.x) });
    switch (SV_WEAPONS[id].kind) {
      case 'cannon': {
        for (let i = 0; i < st.count; i++) {
          const tg = t[i % t.length].e;
          const aim = interceptHeading(b.x, b.y, tg, st.speed);
          const fan = i >= t.length ? (Math.floor(i / t.length) % 2 ? 1 : -1) * 0.12 * Math.ceil(i / t.length) : 0;
          shot(run, id, b.x, b.y, aim.heading + fan, st.speed, { damage: st.damage, range: st.range * 1.1, pierce: st.pierce, radius: st.radius ?? 3.6 });
        }
        break;
      }
      case 'chain': {
        for (let i = 0; i < st.count; i++) {
          const tg = t[i % t.length].e;
          const aim = interceptHeading(b.x, b.y, tg, st.speed);
          shot(run, id, b.x, b.y, aim.heading + (i >= t.length ? (rng() - 0.5) * 0.5 : 0), st.speed, { damage: st.damage, range: st.range * 1.1, pierce: st.pierce, radius: 5.5 });
        }
        break;
      }
      case 'grape': {
        if (st.ring) {
          for (let i = 0; i < st.count; i++) shot(run, id, b.x, b.y, (i / st.count) * TAU + rng() * 0.1, st.speed * (0.9 + rng() * 0.2), { damage: st.damage, range: st.range, radius: 2.4 });
        } else {
          const aim = interceptHeading(b.x, b.y, t[0].e, st.speed);
          for (let i = 0; i < st.count; i++) {
            const off = (i / Math.max(1, st.count - 1) - 0.5) * st.spread + (rng() - 0.5) * 0.08;
            shot(run, id, b.x, b.y, aim.heading + off, st.speed * (0.9 + rng() * 0.2), { damage: st.damage, range: st.range, radius: 2.4 });
          }
        }
        break;
      }
      case 'depth': {
        const used = new Set();
        for (let i = 0; i < st.count; i++) {
          const pick = t.find((x) => !used.has(x.e.id)) || t[i % t.length];
          used.add(pick.e.id);
          const c = pick.e.invulnerable ? { x: pick.e.x, y: pick.e.y } : crowdCentre(visible, pick.e);
          const jx = i >= t.length ? (rng() - 0.5) * 40 : 0; const jy = i >= t.length ? (rng() - 0.5) * 40 : 0;
          const tx = c.x + jx; const ty = c.y + jy;
          const d = Math.hypot(tx - b.x, ty - b.y);
          shot(run, id, b.x, b.y, Math.atan2(ty - b.y, tx - b.x), st.speed, {
            damage: st.damage, range: d + 4, radius: 5, fuse: Math.max(0.15, d / st.speed),
            extra: { blastRadius: st.blast, hitsSubmerged: true, overLand: true, noProximity: true, fuseTotal: Math.max(0.15, d / st.speed), aftershock: st.aftershock || null },
          });
        }
        break;
      }
      case 'flame': {
        const used = new Set();
        for (let i = 0; i < st.count; i++) {
          const pick = t.find((x) => !used.has(x.e.id)) || t[i % t.length];
          used.add(pick.e.id);
          const c = crowdCentre(visible, pick.e, 40);
          const tx = c.x + (i >= t.length ? (rng() - 0.5) * 50 : 0); const ty = c.y + (i >= t.length ? (rng() - 0.5) * 50 : 0);
          const d = Math.hypot(tx - b.x, ty - b.y);
          shot(run, 'sv_barrel', b.x, b.y, Math.atan2(ty - b.y, tx - b.x), st.speed, {
            damage: st.damage, range: d + 4, radius: 5, fuse: Math.max(0.15, d / st.speed), counterId: 'flame_barrels',
            extra: { blastRadius: 22, overLand: true, noProximity: true, fuseTotal: Math.max(0.15, d / st.speed), pool: { r: st.pool, duration: st.duration, burn: st.burn, every: st.every } },
          });
        }
        break;
      }
      default: break;
    }
  }
  return fired;
}

// After resolveHits (and before cleanupProjectiles): detonated barrels
// become fire pools; Kraken's Wrath charges go off a second time.
// Returns explosions [{ x, y, r }] for the effects.
export function afterHits(run) {
  const out = [];
  for (const p of run.weapons.projectiles) {
    if (!p.detonated || p._after) continue;
    p._after = true;
    if (p.pool) {
      run.sv.pools.push({ x: p.x, y: p.y, r: p.pool.r, t: 0, duration: p.pool.duration, burn: p.pool.burn, every: p.pool.every, tick: 0.05 });
    }
    if (p.aftershock) {
      const a = p.aftershock;
      run.weapons.projectiles.push({
        id: nextShotId++, weaponId: 'depth_charges', x: p.x, y: p.y, vx: 0, vy: 0, radius: 5, traveled: 0, maxRange: 9999,
        fuseRemaining: a.delay, fuseTotal: a.delay, pierceLeft: 0, hitIds: null, spent: false,
        damage: a.damage * (run.sv.stats?.damageMult ?? 1), counterMult: SURVIVAL.counterBonus, counterId: 'depth_charges',
        blastRadius: a.blast, hitsSubmerged: true, overLand: true, noProximity: true, aftershockOf: p.id,
      });
      out.push({ x: p.x, y: p.y, r: a.blast, delayed: true });
    }
  }
  return out;
}

// Fire pools, the evolved weapons' extras (Reaper Chains' blades, Greek
// Fire's burning wake). Returns hit events in resolveHits' shape.
export function stepWeaponExtras(run, dt) {
  const sv = run.sv; const b = run.boat;
  const events = [];
  // Greek Fire: the wake burns.
  if (sv.evolved.flame_barrels) {
    const tr = SV_WEAPONS.flame_barrels.evolve.stats.trail;
    sv.trailTimer -= dt;
    if (sv.trailTimer <= 0 && Math.hypot(b.vx, b.vy) > 40) {
      sv.trailTimer = tr.every;
      sv.pools.push({ x: b.x - Math.cos(b.heading) * 14, y: b.y - Math.sin(b.heading) * 14, r: tr.pool, t: 0, duration: tr.duration, burn: tr.burn * sv.stats.damageMult, every: 0.4, tick: 0.2, wake: true });
    }
  }
  for (const pool of sv.pools) {
    pool.t += dt; pool.tick -= dt;
    if (pool.tick > 0) continue;
    pool.tick += pool.every;
    for (const e of run.enemies) {
      if (!hittable(e) || e.invulnerable || passesOverLand(e)) continue;
      if (Math.hypot(e.x - pool.x, e.y - pool.y) > pool.r + e.radius * 0.5) continue;
      const counter = currentCounter(e) === 'flame_barrels';
      const dmg = pool.burn * (counter ? SURVIVAL.counterBonus : 1);
      const killed = applyDamageToEnemy(e, dmg);
      events.push({ enemy: e, weaponId: 'flame_barrels', damage: dmg, killed, counter, burn: true });
    }
  }
  sv.pools = sv.pools.filter((p) => p.t < p.duration);
  // Reaper Chains: blades whirling round the ship.
  if (sv.evolved.chain_shot) {
    const o = SV_WEAPONS.chain_shot.evolve.stats.orbit;
    sv.orbitAngle += o.spin * dt;
    for (const p of orbitBlades(run)) {
      for (const e of run.enemies) {
        if (!hittable(e) || e.invulnerable) continue;
        if ((e._bladeCd || 0) > 0) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) > e.radius + 9) continue;
        e._bladeCd = o.every;
        const counter = currentCounter(e) === 'chain_shot';
        const dmg = o.damage * sv.stats.damageMult * (counter ? SURVIVAL.counterBonus : 1);
        const killed = applyDamageToEnemy(e, dmg);
        events.push({ enemy: e, weaponId: 'chain_shot', damage: dmg, killed, counter });
      }
    }
    for (const e of run.enemies) if (e._bladeCd > 0) e._bladeCd -= dt;
  }
  return events;
}

export function orbitBlades(run) {
  const sv = run.sv;
  if (!sv.evolved.chain_shot) return [];
  const o = SV_WEAPONS.chain_shot.evolve.stats.orbit;
  const out = [];
  for (let k = 0; k < o.count; k++) {
    const a = sv.orbitAngle + (k * TAU) / o.count;
    out.push({ x: run.boat.x + Math.cos(a) * o.radius, y: run.boat.y + Math.sin(a) * o.radius, a });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weapon combos

export function activeSynergies(run) {
  const w = run.sv.weapons;
  return SYNERGIES.filter((x) => x.needs.every((id) => (w[id] || 0) > 0));
}

// Combos a new weapon would complete (for its card).
export function synergiesCompletedBy(run, weaponId) {
  const w = run.sv.weapons;
  if (w[weaponId]) return [];
  return SYNERGIES.filter((x) => x.needs.includes(weaponId) && x.needs.every((id) => id === weaponId || (w[id] || 0) > 0));
}

// Runs every active combo over this frame's hits and blasts. Returns extra
// hit events (same shape as resolveHits') for the feedback and loot.
export function applySynergies(run, hits, explosions, dt) {
  const on = new Set(activeSynergies(run).map((x) => x.id));
  const out = [];
  const dm = run.sv.stats?.damageMult ?? 1;
  // Slows wear off.
  for (const e of run.enemies) {
    if (e._slowT > 0) { e._slowT -= dt; if (e._slowT <= 0 && e._baseSpeed) { e.speed = e._baseSpeed; e._baseSpeed = null; } }
  }
  if (!on.size) return out;
  for (const h of hits) {
    const e = h.enemy;
    if (!e) continue;
    if (on.has('burning_shrapnel') && h.weaponId === 'grapeshot' && !h.killed && e.health > 0 && !e.burn) {
      e.burn = { weaponId: 'flame_barrels', tickDamage: 3 * dm, ticksRemaining: 4, tickInterval: 0.4, tickTimer: 0.4 };
    }
    if (on.has('rigging_shredder') && h.weaponId === 'chain_shot' && e.health > 0 && !e.isBoss) {
      if (!e._baseSpeed) { e._baseSpeed = e.speed; e.speed *= 0.6; }
      e._slowT = 1.6;
    }
    if (on.has('heated_shot') && h.weaponId === 'cannonballs' && h.killed && !h.burn) {
      run.sv.pools.push({ x: e.x, y: e.y, r: 24, t: 0, duration: 1.6, burn: 5 * dm, every: 0.4, tick: 0.1, combo: true });
    }
    if (on.has('shock_shells') && h.weaponId === 'cannonballs' && e.health > 0 && !e.isBoss && !e.warlord) {
      knockBack(e, run.boat, 150);
    }
  }
  if (on.has('undertow')) {
    for (const x of explosions) {
      if (x.weaponId !== 'depth_charges' && !x.delayed) continue;
      const R = (x.r || 40) * 2;
      for (const e of run.enemies) {
        if (e.health <= 0 || e.isBoss || e.warlord) continue;
        const d = Math.hypot(e.x - x.x, e.y - x.y);
        if (d > R || d < 4) continue;
        e.x += (x.x - e.x) * 0.45; e.y += (x.y - e.y) * 0.45;
      }
    }
  }
  return out;
}

// Card text for a choice (the UI, the pause menu and tests share it).
export function describeChoice(run, card) {
  if (card.kind === 'weapon') {
    const w = SV_WEAPONS[card.id]; const lv = run.sv.weapons[card.id] || 0;
    return { icon: w.icon, name: w.name, kindLabel: lv ? 'Weapon' : 'New weapon', level: lv + 1, max: SV_WEAPON_MAX, desc: w.levels[lv].desc, counters: countersInLevel(run, card.id), combos: synergiesCompletedBy(run, card.id) };
  }
  if (card.kind === 'evolve') {
    const w = SV_WEAPONS[card.id];
    return { icon: w.evolve.icon, name: w.evolve.name, kindLabel: `Evolution ${evolutionsUsed(run) + 1}/${SURVIVAL.maxEvolutions}`, level: 0, max: 0, desc: w.evolve.desc, evolve: true, counters: [] };
  }
  if (card.kind === 'armament') {
    const a = ARMAMENT_BY_ID[card.id]; const lv = armamentLevel(run, card.id);
    return { icon: a.icon, name: a.name, kindLabel: lv ? 'Armament' : 'New armament', level: lv + 1, max: ARMAMENT_MAX_LEVEL, desc: a.desc[lv], counters: [] };
  }
  if (card.kind === 'passive') {
    const p = PASSIVE_BY_ID[card.id]; const lv = run.sv.passives[card.id] || 0;
    const ev0 = SV_WEAPON_IDS.find((w) => SV_WEAPONS[w].evolve.with === card.id);
    // No evolution hint once the three evolutions are spent.
    const ev = ev0 && !run.sv.evolved[ev0] && evolutionsUsed(run) < SURVIVAL.maxEvolutions
      && (run.sv.weapons[ev0] || !run.poolLocked?.has(ev0)) ? ev0 : null;
    return { icon: p.icon, name: p.name, kindLabel: 'Ship upgrade', level: lv + 1, max: PASSIVE_MAX, desc: p.desc, counters: [], evolves: ev ? SV_WEAPONS[ev].name : null };
  }
  if (card.kind === 'repair') return { icon: '🛟', name: 'Patch the Hull', kindLabel: 'Supplies', level: 0, max: 0, desc: 'Repair 35% of your hull', counters: [] };
  return { icon: '⚓', name: 'Salvage', kindLabel: 'Supplies', level: 0, max: 0, desc: '+20 Salvage', counters: [] };
}
