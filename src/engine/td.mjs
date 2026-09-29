// Reef Defence simulation (2026-09-29, second game mode). Pure logic: no
// canvas, no DOM. The mode's glue (td/tdMode.mjs) draws it and turns taps
// into build/upgrade/sell calls; tools/td-sim.mjs plays it headless.
//
// Rules in one place:
//  - Enemies follow their lane's channel (flyers: the air route) to the
//    Heart of the Reef. Each one that gets through costs Heart lives.
//  - Towers stand on the map's build spots. A tower only targets what it
//    can reach (flyers need an anti-air tower; things under the water need
//    Depth Charges), what it can see (camouflage and ghosts need a
//    Lighthouse or a tower right beside them; in the dark, light), and
//    deals its counter bonus to enemies its weapon counters.
//  - Enemies with guns shoot at towers: a hit rattles the tower (stunned,
//    or slowed by frost, blinded by ink...). Towers are never destroyed.
//  - Gold comes from kills and from calling waves early.

import { getEnemy, ARCHETYPES as A } from '../data/enemies.mjs';
import { getTower, towerStats, TOWER_FOR_WEAPON, TD_PERK_BY_ID } from '../data/towers.mjs';
import { TD_LIVES, starsFor } from '../data/tdMaps.mjs';
import { getBiome } from '../data/biomes.mjs';
import { stageInfo } from '../data/stages.mjs';
import { pointAt, LEAK_RADIUS } from './tdMap.mjs';
import { buildWaves, goldFor, livesCost, isFlyer, WAVE_TUNING, waveBounty } from './tdWaves.mjs';

export const TD_TUNING = Object.freeze({
  waveGap: 20, // seconds between a wave's last spawn and the next wave (auto)
  earlyGoldPerSecond: 2, // gold for each second a wave is called early
  sellRefund: 0.7,
  revealRadius: 52, // a tower spots camouflage this close
  towerLight: 50, // in the dark, a tower lights this far
  heartLight: 110,
  burnLight: 34,
  speedScale: 0.42, // voyage speeds → channel speeds
});

// A map's towers stand on spots; enemies with guns target them. How a hit
// affects a tower, by shot kind.
const RATTLE = {
  frost: { slowT: 2.5 }, fire: { fireT: 3 }, ink: { inkT: 3 }, shock: { stunT: 1.5 },
  hex: { poisonT: 3 }, spore: { poisonT: 3 }, glob: { poisonT: 2.5 },
};

function rnd(state) {
  // Small deterministic LCG per defence, so the sim is reproducible.
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

export function perksFrom(ownedPerks = []) {
  const p = { startGold: 0, lives: 0, sellRefund: TD_TUNING.sellRefund, earlyBonus: 0, damageBonus: 0, rangeBonus: 0 };
  for (const id of ownedPerks) {
    const d = TD_PERK_BY_ID[id]; if (!d) continue;
    p.startGold += d.startGold || 0; p.lives += d.lives || 0; p.earlyBonus += d.earlyBonus || 0;
    p.damageBonus += d.damageBonus || 0; p.rangeBonus += d.rangeBonus || 0;
    if (d.sellRefund) p.sellRefund = Math.max(p.sellRefund, d.sellRefund);
  }
  return p;
}

// opts: { unlockedTowers: [...ids], unlockedSpecs: [...ids], perks: [...ids] }
export function createDefence(mapDef, map, opts = {}) {
  const perks = perksFrom(opts.perks);
  const biome = getBiome(stageInfo(mapDef.stage).biome);
  const maxLives = TD_LIVES + perks.lives;
  return {
    mapDef, map, biome,
    waves: buildWaves(mapDef),
    gold: mapDef.startGold + perks.startGold,
    lives: maxLives, maxLives,
    waveIndex: -1,
    spawners: [],
    nextWaveTimer: null,
    enemies: [], towers: [], projectiles: [], mines: [], pools: [], enemyShots: [],
    time: 0, over: false, outcome: null, stars: 0,
    perks,
    unlockedTowers: new Set(opts.unlockedTowers || ['cannon', 'grapeshot']),
    unlockedSpecs: new Set(opts.unlockedSpecs || []),
    dark: !!biome.ambient?.light,
    seed: (mapDef.seed * 7919 + 17) >>> 0,
    nextId: 1,
    stats: { kills: 0, leaked: 0, goldEarned: 0, built: 0, bossKilled: false },
    events: [],
  };
}

const emit = (s, e) => { s.events.push(e); };
export function drainEvents(s) { const e = s.events; s.events = []; return e; }

// ---------------------------------------------------------------- towers
export function towerAt(s, spotId) { return s.towers.find((t) => t.spotId === spotId) || null; }

export function canBuild(s, spotId, towerId) {
  if (s.over) return { ok: false, reason: 'over' };
  if (!s.map.spots.some((p) => p.id === spotId)) return { ok: false, reason: 'no-spot' };
  if (towerAt(s, spotId)) return { ok: false, reason: 'occupied' };
  if (!s.unlockedTowers.has(towerId)) return { ok: false, reason: 'locked' };
  const cost = getTower(towerId).levels[0].cost;
  if (s.gold < cost) return { ok: false, reason: 'gold', cost };
  return { ok: true, cost };
}

export function buildTower(s, spotId, towerId) {
  const c = canBuild(s, spotId, towerId);
  if (!c.ok) return c;
  const spot = s.map.spots.find((p) => p.id === spotId);
  s.gold -= c.cost;
  const t = {
    id: s.nextId++, spotId, towerId, level: 1, spec: null, invested: c.cost, x: spot.x, y: spot.y,
    cooldownT: 0.3, targetMode: 'first', angle: -Math.PI / 2, stunT: 0, slowT: 0, fireT: 0, inkT: 0, poisonT: 0,
    kills: 0, damage: 0, mineT: 0, recoil: 0, builtAt: s.time,
  };
  s.towers.push(t);
  s.stats.built++;
  emit(s, { type: 'build', tower: t });
  return { ok: true, tower: t };
}

export function upgradeCost(t) {
  if (t.spec) return null;
  const def = getTower(t.towerId);
  return t.level < 3 ? def.levels[t.level].cost : null;
}

export function upgradeTower(s, towerIdNum) {
  const t = s.towers.find((q) => q.id === towerIdNum);
  if (!t || s.over) return { ok: false, reason: 'none' };
  const cost = upgradeCost(t);
  if (cost == null) return { ok: false, reason: 'max' };
  if (s.gold < cost) return { ok: false, reason: 'gold', cost };
  s.gold -= cost; t.invested += cost; t.level++;
  emit(s, { type: 'upgrade', tower: t });
  return { ok: true, tower: t };
}

export function specializeTower(s, towerIdNum, specId) {
  const t = s.towers.find((q) => q.id === towerIdNum);
  if (!t || s.over) return { ok: false, reason: 'none' };
  if (t.level < 3 || t.spec) return { ok: false, reason: 'level' };
  const spec = getTower(t.towerId).specs.find((p) => p.id === specId);
  if (!spec) return { ok: false, reason: 'no-spec' };
  if (!s.unlockedSpecs.has(specId)) return { ok: false, reason: 'locked' };
  if (s.gold < spec.cost) return { ok: false, reason: 'gold', cost: spec.cost };
  s.gold -= spec.cost; t.invested += spec.cost; t.spec = specId;
  emit(s, { type: 'upgrade', tower: t, spec: specId });
  return { ok: true, tower: t };
}

export function sellValue(s, t) {
  return Math.floor(t.invested * (s.waveIndex < 0 ? 1 : s.perks.sellRefund));
}

export function sellTower(s, towerIdNum) {
  const i = s.towers.findIndex((q) => q.id === towerIdNum);
  if (i < 0 || s.over) return { ok: false };
  const t = s.towers[i];
  const refund = sellValue(s, t);
  s.gold += refund;
  s.towers.splice(i, 1);
  s.mines = s.mines.filter((m) => m.towerId !== t.id);
  emit(s, { type: 'sell', tower: t, refund });
  return { ok: true, refund };
}

export const TARGET_MODES = ['first', 'last', 'strong', 'close'];
export function cycleTargetMode(s, towerIdNum) {
  const t = s.towers.find((q) => q.id === towerIdNum);
  if (!t) return null;
  t.targetMode = TARGET_MODES[(TARGET_MODES.indexOf(t.targetMode) + 1) % TARGET_MODES.length];
  return t.targetMode;
}

// Aura from lighthouses covering a spot (the best one applies).
function auraAt(s, x, y) {
  let range = 0; let damage = 0;
  for (const t of s.towers) {
    if (t.towerId !== 'lighthouse') continue;
    const st = towerStats(t);
    if (Math.hypot(t.x - x, t.y - y) <= st.range) { range = Math.max(range, st.aura.rangeBonus); damage = Math.max(damage, st.aura.damageBonus); }
  }
  return { range, damage };
}

// A tower's live numbers: its level/spec stats, lighthouse aura, perks,
// and whatever enemy fire has done to it.
export function effectiveStats(s, t) {
  const st = towerStats(t);
  const def = getTower(t.towerId);
  if (def.support) return { ...st, range: st.range * (1 + s.perks.rangeBonus) };
  const aura = auraAt(s, t.x, t.y);
  let range = st.range * (1 + aura.range + s.perks.rangeBonus);
  let damage = (st.damage || 0) * (1 + aura.damage + s.perks.damageBonus);
  let cooldown = st.cooldown;
  if (t.inkT > 0) range *= 0.7;
  if (t.poisonT > 0) damage *= 0.75;
  if (t.slowT > 0) cooldown *= 1.6;
  if (t.fireT > 0) cooldown *= 1.3;
  if (sirenNear(s, t)) cooldown *= 1.4;
  const burnDps = st.burnDps ? st.burnDps * (1 + aura.damage + s.perks.damageBonus) * (t.poisonT > 0 ? 0.75 : 1) : 0;
  return { ...st, range, damage, cooldown, burnDps };
}

function sirenNear(s, t) {
  for (const e of s.enemies) if (e.song && e.health > 0 && Math.hypot(e.x - t.x, e.y - t.y) < 95) return true;
  return false;
}

// ---------------------------------------------------------------- enemies
function isSubmerger(archetype, def) {
  return archetype === A.SUBMERGED || archetype === A.SERPENT || !!def.burrows;
}

function spawnEnemy(s, defId, lane, hpMult, opts = {}) {
  const def = getEnemy(defId);
  const flying = isFlyer(def);
  const L = s.map.lanes[lane % s.map.lanes.length];
  const route = flying ? 'air' : 'ground';
  const path = route === 'air' ? L.air : L.ground;
  const base = def.speed || 0;
  const speed = def.isBoss ? Math.max(12, Math.min(16, base * 0.22)) : Math.max(20, Math.min(flying ? 60 : 56, base * TD_TUNING.speedScale));
  const e = {
    id: s.nextId++, defId, name: def.name, radius: def.radius || 9, color: def.color,
    health: def.maxHealth * hpMult, maxHealth: def.maxHealth * hpMult,
    lane: lane % s.map.lanes.length, route, s: opts.s ?? 0, offset: opts.offset ?? (rnd(s) - 0.5) * (flying ? 14 : 20),
    speed, flying, isBoss: !!def.isBoss, archetype: def.archetype, counter: def.counter,
    x: path.pts[0].x, y: path.pts[0].y, vx: 0, vy: 0, heading: 0,
    slowMult: 1, slowT: 0, stunT: 0, burnDps: 0, burnT: 0, shredT: 0, shred: 0, dotAcc: 0,
    invulnerable: false, submergedState: null, subT: 0, phased: false, ghostT: 0,
    camo: !!def.camo, song: def.archetype === A.SIREN, singing: def.archetype === A.SIREN,
    gunT: 1.5 + rnd(s) * 2, gold: goldFor(defId), lives: livesCost(defId),
    phaseIndex: 0, phaseT: 0, summonT: 0, enraged: false, sharkState: null, sharkT: 2 + rnd(s) * 2, wobble: rnd(s) * 6,
    summonedBy: opts.summonedBy ?? null, reward: opts.reward ?? true,
  };
  if (def.phases) applyPhase(e, def, 0);
  else if (isSubmerger(def.archetype, def)) { e.submergedState = 'surfaced'; e.subT = 1 + rnd(s) * 1.5; }
  if (def.archetype === A.GHOST) e.ghostT = 1.5 + rnd(s);
  placeOnPath(s, e);
  s.enemies.push(e);
  return e;
}

function applyPhase(e, def, i) {
  const ph = def.phases[i];
  e.phaseIndex = i; e.phaseT = ph.durationSeconds || 12;
  e.counter = ph.counter || def.counter;
  e.archetype = ph.archetype || def.archetype;
  e.summonT = ph.summon ? ph.summon.everySeconds * 0.5 : 0;
  e.airborne = e.archetype === A.FLYER;
  if (isSubmerger(e.archetype, def)) { e.submergedState = 'surfaced'; e.subT = 1.5; } else { e.submergedState = null; e.invulnerable = false; }
  e.ghostPhase = e.archetype === A.GHOST;
  if (!e.ghostPhase) e.phased = false;
}

function pathOf(s, e) { const L = s.map.lanes[e.lane]; return e.route === 'air' ? L.air : L.ground; }

function placeOnPath(s, e) {
  const p = pointAt(pathOf(s, e), e.s);
  const wob = e.flying ? Math.sin(s.time * 1.7 + e.wobble) * 6 : 0;
  const off = e.offset + wob;
  e.x = p.x - p.dy * off; e.y = p.y + p.dx * off;
  e.dirX = p.dx; e.dirY = p.dy;
}

export function currentCounterTower(e) { return TOWER_FOR_WEAPON[e.counter] || null; }

// Can this tower see this enemy right now?
export function isRevealed(s, e) {
  if (!e.camo && !e.phased) return true;
  for (const t of s.towers) {
    if (t.towerId === 'lighthouse' && Math.hypot(t.x - e.x, t.y - e.y) <= towerStats(t).range) return true;
    if (e.camo && !e.phased && Math.hypot(t.x - e.x, t.y - e.y) <= TD_TUNING.revealRadius) return true;
  }
  return false;
}

export function lightsOf(s) {
  const out = [{ x: s.map.heart.x, y: s.map.heart.y, r: TD_TUNING.heartLight }];
  for (const t of s.towers) {
    if (t.towerId === 'lighthouse') out.push({ x: t.x, y: t.y, r: towerStats(t).range * towerStats(t).aura.light });
    else out.push({ x: t.x, y: t.y, r: TD_TUNING.towerLight, k: 0.8 });
  }
  for (const e of s.enemies) {
    if (e.health <= 0) continue;
    if (e.burnT > 0) out.push({ x: e.x, y: e.y, r: TD_TUNING.burnLight, k: 0.9 });
    const g = getEnemy(e.defId).glow;
    if (g) out.push({ x: e.x, y: e.y, r: g * 0.8, k: 0.7 });
  }
  for (const p of s.pools) out.push({ x: p.x, y: p.y, r: p.r * 1.4, k: 0.9 });
  return out;
}

function isLit(s, e) {
  if (!s.dark) return true;
  if (e.burnT > 0 || getEnemy(e.defId).glow) return true;
  if (Math.hypot(e.x - s.map.heart.x, e.y - s.map.heart.y) < TD_TUNING.heartLight * 0.9) return true;
  for (const t of s.towers) {
    const r = t.towerId === 'lighthouse' ? towerStats(t).range * towerStats(t).aura.light : TD_TUNING.towerLight;
    if (Math.hypot(t.x - e.x, t.y - e.y) < r * 0.9) return true;
  }
  return false;
}

function isAirborne(e) { return e.flying || e.airborne; }

// Could this tower hit this enemy at all (ignoring range)?
export function canTarget(s, t, e) {
  if (e.health <= 0 || e.gone) return false;
  const reach = getTower(t.towerId).reach;
  if (isAirborne(e) && !reach.air) return false;
  if (e.invulnerable && !reach.submerged) return false;
  if (e.phased && !isRevealed(s, e)) return false;
  if (e.camo && !isRevealed(s, e)) return false;
  if (!isLit(s, e)) return false;
  return true;
}

function progressOf(s, e) { return e.s / pathOf(s, e).length; }

function pickTarget(s, t, range) {
  let best = null; let bestScore = -Infinity;
  for (const e of s.enemies) {
    if (!canTarget(s, t, e)) continue;
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d > range + e.radius * 0.5) continue;
    let score;
    switch (t.targetMode) {
      case 'last': score = -progressOf(s, e); break;
      case 'strong': score = e.health + progressOf(s, e); break;
      case 'close': score = -d; break;
      default: score = progressOf(s, e) + (e.isBoss ? 0 : 0);
    }
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

// Damage from tower `t` to enemy `e`, before it lands.
function damageFor(s, t, st, e, base) {
  const def = getTower(t.towerId);
  const counter = currentCounterTower(e) === t.towerId;
  let d = base * (counter ? def.counterMult : def.offMult);
  if (st.bigBonus && e.maxHealth >= 100) d *= 1 + st.bigBonus;
  d *= 1 + (e.shredT > 0 ? e.shred : 0) + beamVuln(s, e);
  return { amount: d, counter };
}

function beamVuln(s, e) {
  let v = 0;
  for (const t of s.towers) {
    if (t.spec !== 'blinding_lamp') continue;
    const st = towerStats(t);
    if (Math.hypot(t.x - e.x, t.y - e.y) <= st.range) v = Math.max(v, st.beam.vuln);
  }
  return v;
}

function hurt(s, e, amount, t, opts = {}) {
  if (e.health <= 0 || amount <= 0) return;
  e.health -= amount;
  if (t) t.damage += amount;
  if (!opts.silent) emit(s, { type: 'hit', x: e.x, y: e.y - e.radius, amount, crit: !!opts.crit, enemy: e, tower: t?.towerId });
  if (e.health <= 0) killEnemy(s, e, t);
}

function killEnemy(s, e, t) {
  e.health = 0; e.gone = true;
  let gold = e.reward ? e.gold : Math.ceil(e.gold * 0.3);
  for (const b of s.towers) {
    if (b.spec !== 'beacon_of_fortune') continue;
    const st = towerStats(b);
    if (Math.hypot(b.x - e.x, b.y - e.y) <= st.range) { gold += st.bounty; break; }
  }
  s.gold += gold; s.stats.goldEarned += gold; s.stats.kills++;
  if (t) t.kills++;
  if (e.isBoss) s.stats.bossKilled = true;
  emit(s, { type: 'kill', enemy: e, gold, x: e.x, y: e.y, boss: e.isBoss });
  // Fire ships go up when sunk and burn whatever sails beside them.
  if (e.defId === 'fire_ship') {
    emit(s, { type: 'blast', x: e.x, y: e.y, r: 46, kind: 'fire' });
    for (const o of s.enemies) if (o !== e && o.health > 0 && !isAirborne(o) && Math.hypot(o.x - e.x, o.y - e.y) < 46) hurt(s, o, 26, null);
  }
}

// ---------------------------------------------------------------- waves
export function wavesTotal(s) { return s.waves.length; }
export function canCallWave(s) { return !s.over && s.waveIndex + 1 < s.waves.length && (s.waveIndex < 0 || s.hold || s.nextWaveTimer != null); }

export function startNextWave(s) {
  if (!canCallWave(s)) return { ok: false };
  let bonus = 0;
  if (s.nextWaveTimer != null && s.nextWaveTimer > 0) {
    bonus = Math.round(s.nextWaveTimer * TD_TUNING.earlyGoldPerSecond * (1 + s.perks.earlyBonus));
    s.gold += bonus; s.stats.goldEarned += bonus;
  }
  s.nextWaveTimer = null; s.hold = false;
  s.waveIndex++;
  const bounty = waveBounty(s.waveIndex);
  s.gold += bounty; s.stats.goldEarned += bounty;
  const wave = s.waves[s.waveIndex];
  for (const g of wave.groups) s.spawners.push({ ...g, spawned: 0, t: g.delay });
  emit(s, { type: 'waveStart', index: s.waveIndex, bonus, bounty, boss: wave.boss });
  return { ok: true, bonus };
}

function stepSpawners(s, dt) {
  for (const sp of s.spawners) {
    if (sp.spawned >= sp.count) continue;
    sp.t -= dt;
    while (sp.t <= 0 && sp.spawned < sp.count) {
      const e = spawnEnemy(s, sp.defId, sp.lane, sp.hpMult);
      if (sp.boss) emit(s, { type: 'bossArrives', enemy: e });
      sp.spawned++;
      sp.t += sp.interval;
    }
  }
  s.spawners = s.spawners.filter((sp) => sp.spawned < sp.count);
}

// ---------------------------------------------------------------- stepping
export function stepDefence(s, dt) {
  if (s.over) return;
  s.time += dt;
  stepSpawners(s, dt);
  // Countdown to the next wave once this one has fully arrived.
  if (!s.hold && s.waveIndex >= 0 && s.spawners.length === 0 && s.waveIndex + 1 < s.waves.length) {
    if (s.nextWaveTimer == null) { s.nextWaveTimer = TD_TUNING.waveGap; emit(s, { type: 'waveReady', index: s.waveIndex + 1 }); }
    s.nextWaveTimer -= dt;
    if (s.nextWaveTimer <= 0) { s.nextWaveTimer = 0; startNextWave(s); }
  }
  stepEnemies(s, dt);
  stepTowers(s, dt);
  stepProjectiles(s, dt);
  stepMines(s, dt);
  stepPools(s, dt);
  stepEnemyShots(s, dt);
  s.enemies = s.enemies.filter((e) => !e.gone);
  if (s.lives <= 0) {
    s.lives = 0; s.over = true; s.outcome = 'lost'; s.stars = 0;
    emit(s, { type: 'lost' });
  } else if (s.waveIndex === s.waves.length - 1 && s.spawners.length === 0 && s.enemies.length === 0) {
    s.over = true; s.outcome = 'won'; s.stars = starsFor(s.lives, s.maxLives);
    emit(s, { type: 'won', stars: s.stars });
  }
}

function stepEnemies(s, dt) {
  for (const e of s.enemies) {
    if (e.health <= 0) continue;
    const def = getEnemy(e.defId);
    // Boss phases: counter, archetype and summons change on a timer.
    if (def.phases) {
      e.phaseT -= dt;
      if (e.phaseT <= 0) { applyPhase(e, def, (e.phaseIndex + 1) % def.phases.length); emit(s, { type: 'bossPhase', enemy: e }); }
      const sm = def.phases[e.phaseIndex].summon;
      if (sm) {
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = sm.everySeconds;
          const alive = s.enemies.filter((o) => o.summonedBy === e.id && o.health > 0).length;
          for (let k = 0; k < Math.min(sm.count, sm.max - alive); k++) {
            const md = getEnemy(sm.defId);
            const air = isFlyer(md);
            const L = s.map.lanes[e.lane];
            const frac = progressOf(s, e);
            spawnEnemy(s, sm.defId, e.lane, e.maxHealth / def.maxHealth / WAVE_TUNING.bossHp * 0.8, {
              s: Math.max(0, frac * (air ? L.air.length : L.ground.length) - 10 - k * 14), summonedBy: e.id, reward: false,
            });
          }
          emit(s, { type: 'summon', enemy: e });
        }
      }
      if (!e.enraged && e.health < e.maxHealth * 0.5) { e.enraged = true; emit(s, { type: 'enrage', enemy: e }); }
    }
    // Under the water and back up.
    if (e.submergedState) {
      e.subT -= dt;
      if (e.subT <= 0) {
        // Bosses stay under only briefly: most of the fight is on the surface.
        if (e.submergedState === 'surfaced') { e.submergedState = 'submerged'; e.subT = (def.submergedSeconds ? def.submergedSeconds[0] : 2.2) * (e.isBoss ? 0.8 : 1.2); }
        else { e.submergedState = 'surfaced'; e.subT = (def.surfacedSeconds || 1.6) * (e.isBoss ? 2.2 : 1.4); }
      }
      e.invulnerable = e.submergedState === 'submerged';
    }
    // Ghost ships fade out of this world, then back.
    if (def.archetype === A.GHOST || e.ghostPhase) {
      e.ghostT -= dt;
      if (e.ghostT <= 0) { e.phased = !e.phased; e.ghostT = e.phased ? 2.4 : 1.9; }
    }
    // Sharks (and anything that charges) put on bursts of speed.
    let burst = 1;
    if (e.archetype === A.SHARK || e.archetype === A.RAMMER) {
      e.sharkT -= dt;
      if (e.sharkState === null && e.sharkT <= 0) { e.sharkState = 'windup'; e.sharkT = 0.5; }
      else if (e.sharkState === 'windup' && e.sharkT <= 0) { e.sharkState = 'charging'; e.sharkT = 0.9; }
      else if (e.sharkState === 'charging' && e.sharkT <= 0) { e.sharkState = null; e.sharkT = 2.5 + rnd(s) * 1.5; }
      burst = e.sharkState === 'charging' ? (e.isBoss ? 1.7 : 2.3) : e.sharkState === 'windup' ? 0.4 : 1;
    }
    // Status: slow, stun, burn, shred.
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMult = 1; }
    if (e.shredT > 0) e.shredT -= dt;
    let beamSlow = 0;
    for (const t of s.towers) {
      if (t.spec !== 'blinding_lamp') continue;
      const st = towerStats(t);
      if (Math.hypot(t.x - e.x, t.y - e.y) <= st.range) beamSlow = Math.max(beamSlow, st.beam.slow);
    }
    let move = e.speed * burst * Math.min(e.slowMult, 1 - beamSlow) * (e.enraged ? 1.3 : 1) * (e.invulnerable ? 1.2 : 1);
    if (e.stunT > 0) { e.stunT -= dt; move = 0; }
    if (e.burnT > 0) {
      e.burnT -= dt;
      const dmg = e.burnDps * dt;
      e.dotAcc += dmg;
      e.health -= dmg;
      if (e.dotAcc >= 4 || (e.health <= 0 && e.dotAcc > 0)) { emit(s, { type: 'hit', x: e.x, y: e.y - e.radius, amount: e.dotAcc, burn: true, enemy: e }); e.dotAcc = 0; }
      if (e.health <= 0) { killEnemy(s, e, e.burnBy ? s.towers.find((t) => t.id === e.burnBy) : null); continue; }
      if (e.burnT <= 0) e.burnDps = 0;
    }
    const path = pathOf(s, e);
    e.s += move * dt;
    const px = e.x; const py = e.y;
    placeOnPath(s, e);
    e.vx = (e.x - px) / Math.max(dt, 1e-4); e.vy = (e.y - py) / Math.max(dt, 1e-4);
    if (move > 0) e.heading = Math.atan2(e.dirY, e.dirX);
    if (e.s >= path.length - LEAK_RADIUS) {
      emit(s, { type: 'leak', enemy: e, lives: e.lives, x: e.x, y: e.y, hpLeft: e.health });
      e.gone = true; e.health = 0;
      s.lives -= e.lives; s.stats.leaked++;
      continue;
    }
    // Guns: shoot at the nearest tower in reach.
    const gun = def.phases ? def.phases[e.phaseIndex].gun : def.gun;
    if (gun && !e.invulnerable && !e.phased && s.towers.length) {
      e.gunT -= dt;
      if (e.gunT <= 0) {
        const reach = Math.min(160, gun.range * 0.75);
        let tgt = null; let bd = reach;
        for (const t of s.towers) { const d = Math.hypot(t.x - e.x, t.y - e.y); if (d < bd) { bd = d; tgt = t; } }
        const cd = gun.cooldown[0] + rnd(s) * (gun.cooldown[1] - gun.cooldown[0]);
        e.gunT = Math.max(2.2, cd * 1.6);
        if (tgt) fireAtTower(s, e, gun, tgt);
      }
    }
  }
}

function fireAtTower(s, e, gun, t) {
  emit(s, { type: 'enemyFire', enemy: e, tower: t });
  if (gun.pattern === 'lob') {
    s.enemyShots.push({ id: s.nextId++, lob: true, x: e.x, y: e.y, sx: e.x, sy: e.y, tx: t.x, ty: t.y, t: 0, flight: gun.flight || 1.3, blast: Math.max(20, gun.blast || 24), kind: gun.kind, target: t.id });
    return;
  }
  const n = Math.min(3, gun.count || 1);
  const a0 = Math.atan2(t.y - e.y, t.x - e.x);
  for (let k = 0; k < n; k++) {
    const a = a0 + (k - (n - 1) / 2) * 0.16;
    const sp = gun.speed || 140;
    s.enemyShots.push({ id: s.nextId++, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, radius: gun.kind === 'heavy' ? 4 : 3, kind: gun.kind, life: (Math.hypot(t.x - e.x, t.y - e.y) + 20) / sp });
  }
}

function rattle(s, t, kind) {
  const r = RATTLE[kind] || { stunT: 1.0 };
  for (const k of Object.keys(r)) t[k] = Math.max(t[k], r[k]);
  emit(s, { type: 'rattle', tower: t, kind });
}

function stepEnemyShots(s, dt) {
  for (const sh of s.enemyShots) {
    if (sh.lob) {
      sh.t += dt;
      const u = Math.min(1, sh.t / sh.flight);
      sh.x = sh.sx + (sh.tx - sh.sx) * u; sh.y = sh.sy + (sh.ty - sh.sy) * u;
      if (u >= 1) {
        sh.done = true;
        emit(s, { type: 'blast', x: sh.tx, y: sh.ty, r: sh.blast, kind: sh.kind });
        for (const t of s.towers) if (Math.hypot(t.x - sh.tx, t.y - sh.ty) < sh.blast + 8) rattle(s, t, sh.kind);
      }
      continue;
    }
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
    for (const t of s.towers) {
      if (Math.hypot(t.x - sh.x, t.y - sh.y) < 13) { rattle(s, t, sh.kind); sh.done = true; emit(s, { type: 'towerHit', x: sh.x, y: sh.y, kind: sh.kind }); break; }
    }
    if (sh.life <= 0) sh.done = true;
  }
  s.enemyShots = s.enemyShots.filter((sh) => !sh.done);
}

// ---------------------------------------------------------------- towers firing
function stepTowers(s, dt) {
  for (const t of s.towers) {
    for (const k of ['stunT', 'slowT', 'fireT', 'inkT', 'poisonT']) if (t[k] > 0) t[k] = Math.max(0, t[k] - dt);
    t.recoil = Math.max(0, t.recoil - dt * 4);
    const def = getTower(t.towerId);
    if (def.support) continue;
    if (t.stunT > 0) continue;
    const st = effectiveStats(s, t);
    t.cooldownT -= dt;
    if (st.mines) { stepMineLayer(s, t, st, dt); continue; }
    if (t.cooldownT > 0) continue;
    const target = pickTarget(s, t, st.range);
    if (!target) { t.cooldownT = 0; continue; }
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    t.cooldownT = st.cooldown;
    t.recoil = 1;
    if (st.cone) { breathe(s, t, st, target); continue; }
    fire(s, t, st, target);
  }
}

function fire(s, t, st, target) {
  const def = getTower(t.towerId);
  emit(s, { type: 'fire', tower: t, kind: def.projectile });
  if (def.projectile === 'charge') {
    // Lobbed to where the target will be when it lands.
    const lead = target.speed * target.slowMult * (def.flight || 0.8);
    const path = pathOf(s, target);
    const p = pointAt(path, Math.min(path.length, target.s + lead));
    const tx = p.x - p.dy * target.offset; const ty = p.y + p.dx * target.offset;
    s.projectiles.push({ id: s.nextId++, kind: 'charge', towerRef: t.id, x: t.x, y: t.y, sx: t.x, sy: t.y, tx, ty, t: 0, flight: def.flight || 0.8, st });
    return;
  }
  s.projectiles.push({
    id: s.nextId++, kind: def.projectile, towerRef: t.id, x: t.x, y: t.y - 8, target: target.id, tx: target.x, ty: target.y,
    speed: def.shotSpeed, st, hit: [], pierceLeft: st.pierce || 0,
  });
}

// Dragon's Breath: every enemy in the cone catches fire.
function breathe(s, t, st, target) {
  emit(s, { type: 'breath', tower: t, angle: t.angle, range: st.range, cone: st.cone });
  for (const e of s.enemies) {
    if (!canTarget(s, t, e)) continue;
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d > st.range + e.radius) continue;
    let da = Math.atan2(e.y - t.y, e.x - t.x) - t.angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > st.cone) continue;
    ignite(s, t, st, e);
  }
}

function ignite(s, t, st, e) {
  const { amount } = damageFor(s, t, st, e, st.burnDps);
  if (amount >= e.burnDps || e.burnT <= 0) { e.burnDps = amount; e.burnBy = t.id; }
  e.burnT = Math.max(e.burnT, st.burnFor);
}

function enemyById(s, id) { return s.enemies.find((e) => e.id === id && e.health > 0) || null; }

function stepProjectiles(s, dt) {
  for (const p of s.projectiles) {
    const t = s.towers.find((q) => q.id === p.towerRef) || { towerId: p.kind === 'charge' ? 'depth' : towerKindOf(p.kind), damage: 0, kills: 0, id: -1 };
    if (p.kind === 'charge') {
      p.t += dt;
      const u = Math.min(1, p.t / p.flight);
      p.x = p.sx + (p.tx - p.sx) * u; p.y = p.sy + (p.ty - p.sy) * u;
      if (u >= 1) { p.done = true; explode(s, t, p.st, p.tx, p.ty, 'depth'); }
      continue;
    }
    const tgt = enemyById(s, p.target);
    if (tgt) { p.tx = tgt.x; p.ty = tgt.y; }
    const dx = p.tx - p.x; const dy = p.ty - p.y; const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    p.vx = (dx / (d || 1)) * p.speed; p.vy = (dy / (d || 1)) * p.speed;
    if (d <= step + 4) {
      p.x = p.tx; p.y = p.ty;
      if (tgt) land(s, t, p, tgt);
      else if (p.st.splash) explode(s, t, p.st, p.x, p.y, p.kind);
      if (!p.retarget) p.done = true;
      p.retarget = false;
    } else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
  }
  s.projectiles = s.projectiles.filter((p) => !p.done);
}

function towerKindOf(kind) { return { ball: 'cannon', grape: 'grapeshot', chain: 'chain', fire: 'flame' }[kind] || 'cannon'; }

function land(s, t, p, e) {
  const st = p.st;
  if (st.splash) { explode(s, t, st, e.x, e.y, p.kind); }
  else {
    const { amount, counter } = damageFor(s, t, st, e, st.damage);
    hurt(s, e, amount, t, { crit: counter });
  }
  if (st.slow) { e.slowMult = Math.min(e.slowMult, 1 - st.slow); e.slowT = Math.max(e.slowT, st.slowFor); }
  if (st.stun && !e.isBoss) e.stunT = Math.max(e.stunT, st.stun);
  if (st.shred) { e.shred = st.shred; e.shredT = 3; }
  if (st.burnDps && e.health > 0) ignite(s, t, st, e);
  if (st.pool) s.pools.push({ x: e.x, y: e.y, r: st.pool.radius, t: st.pool.seconds, dps: st.pool.dps, towerRef: t.id });
  // Chain shot and harpoons carry on to the next enemy in line.
  p.hit.push(e.id);
  if (p.pierceLeft > 0) {
    let next = null; let bd = 64;
    for (const o of s.enemies) {
      if (p.hit.includes(o.id) || !canTarget(s, t, o)) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bd) { bd = d; next = o; }
    }
    if (next) { p.pierceLeft--; p.target = next.id; p.retarget = true; }
  }
}

function explode(s, t, st, x, y, kind) {
  emit(s, { type: 'blast', x, y, r: st.splash, kind });
  const reach = getTower(t.towerId).reach;
  for (const e of s.enemies) {
    if (e.health <= 0 || e.phased) continue;
    if (isAirborne(e) && !reach.air) continue;
    if (e.invulnerable && !reach.submerged) continue;
    if (Math.hypot(e.x - x, e.y - y) > st.splash + e.radius * 0.6) continue;
    const { amount, counter } = damageFor(s, t, st, e, st.damage);
    hurt(s, e, amount, t, { crit: counter });
    if (st.stun && !e.isBoss && e.health > 0) e.stunT = Math.max(e.stunT, st.stun);
    if (st.shred && e.health > 0) { e.shred = st.shred; e.shredT = 3; }
  }
}

// ---------------------------------------------------------------- mines & pools
function stepMineLayer(s, t, st, dt) {
  const mine = s.mines.filter((m) => m.towerId === t.id);
  if (t.cooldownT > 0 || mine.length >= st.mines) return;
  // A point on a channel in range, spread out from the other mines.
  let best = null; let bestScore = -Infinity;
  for (const l of s.map.lanes) {
    for (let k = 0; k < l.ground.pts.length; k += 3) {
      const p = l.ground.pts[k];
      if (Math.hypot(p.x - t.x, p.y - t.y) > st.range) continue;
      const sep = mine.reduce((m, q) => Math.min(m, Math.hypot(q.x - p.x, q.y - p.y)), 999);
      const score = Math.min(sep, 60) + rnd(s) * 20;
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  t.cooldownT = st.cooldown;
  if (!best) return;
  t.angle = Math.atan2(best.y - t.y, best.x - t.x); t.recoil = 1;
  s.mines.push({ id: s.nextId++, towerId: t.id, x: best.x, y: best.y, armT: 0.6, st });
  emit(s, { type: 'fire', tower: t, kind: 'mine' });
}

function stepMines(s, dt) {
  for (const m of s.mines) {
    if (m.armT > 0) { m.armT -= dt; continue; }
    const hit = s.enemies.find((e) => e.health > 0 && !isAirborne(e) && !e.phased && Math.hypot(e.x - m.x, e.y - m.y) < 18 + e.radius);
    if (!hit) continue;
    m.done = true;
    const t = s.towers.find((q) => q.id === m.towerId) || { towerId: 'depth', damage: 0, kills: 0, id: -1 };
    explode(s, t, m.st, m.x, m.y, 'mine');
  }
  s.mines = s.mines.filter((m) => !m.done);
}

function stepPools(s, dt) {
  for (const p of s.pools) {
    p.t -= dt;
    const t = s.towers.find((q) => q.id === p.towerRef);
    for (const e of s.enemies) {
      if (e.health <= 0 || isAirborne(e) || e.invulnerable || e.phased) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > p.r + e.radius * 0.5) continue;
      e.burnDps = Math.max(e.burnDps, p.dps); e.burnT = Math.max(e.burnT, 0.6);
      if (t) e.burnBy = t.id;
    }
  }
  s.pools = s.pools.filter((p) => p.t > 0);
}

// ---------------------------------------------------------------- landscape
// Swap every position to the transposed map (engine/tdMap.mjs).
export function transposeDefence(s, newMap) {
  s.map = newMap;
  const sw = (o, a = 'x', b = 'y') => { const v = o[a]; o[a] = o[b]; o[b] = v; };
  for (const t of s.towers) { const spot = newMap.spots.find((p) => p.id === t.spotId); t.x = spot.x; t.y = spot.y; t.angle = Math.PI / 2 - t.angle; }
  // A reflection flips which side of the channel is 'left': negate offsets.
  for (const e of s.enemies) { e.offset = -e.offset; placeOnPath(s, e); e.heading = Math.atan2(e.dirY, e.dirX); sw(e, 'vx', 'vy'); e._facing = undefined; }
  for (const p of s.projectiles) { sw(p); sw(p, 'tx', 'ty'); if ('sx' in p) sw(p, 'sx', 'sy'); if ('vx' in p) sw(p, 'vx', 'vy'); }
  for (const m of s.mines) sw(m);
  for (const p of s.pools) sw(p);
  for (const sh of s.enemyShots) { sw(sh); if (sh.lob) { sw(sh, 'sx', 'sy'); sw(sh, 'tx', 'ty'); } else sw(sh, 'vx', 'vy'); }
}

// ---------------------------------------------------------------- save
// A checkpoint is taken between waves (no enemies on the water), so it's
// tiny and exact: towers, gold, lives and how far you got.
export function checkpointOf(s) {
  return {
    v: 1, mapId: s.mapDef.id, waveIndex: s.waveIndex, gold: s.gold, lives: s.lives, stats: { ...s.stats },
    towers: s.towers.map((t) => ({ spotId: t.spotId, towerId: t.towerId, level: t.level, spec: t.spec, invested: t.invested, targetMode: t.targetMode })),
  };
}

export function restoreCheckpoint(s, cp) {
  s.waveIndex = cp.waveIndex; s.gold = cp.gold; s.lives = cp.lives; s.stats = { ...s.stats, ...cp.stats };
  s.towers = [];
  for (const c of cp.towers) {
    const spot = s.map.spots.find((p) => p.id === c.spotId);
    if (!spot) continue;
    s.towers.push({
      id: s.nextId++, spotId: c.spotId, towerId: c.towerId, level: c.level, spec: c.spec, invested: c.invested, x: spot.x, y: spot.y,
      cooldownT: 0.3, targetMode: c.targetMode || 'first', angle: -Math.PI / 2, stunT: 0, slowT: 0, fireT: 0, inkT: 0, poisonT: 0,
      kills: 0, damage: 0, mineT: 0, recoil: 0, builtAt: 0,
    });
  }
  // Resuming waits for you to call the next wave.
  s.nextWaveTimer = null; s.hold = s.waveIndex >= 0;
  return s;
}

// Between waves: nothing on the water, nothing still to arrive.
export function isCalm(s) { return s.enemies.length === 0 && s.spawners.length === 0; }
