// Survival balance sim (2026-10-04): plays survival levels headless with a
// bot, through engine/survivalLoop.mjs — the exact frame the game runs.
// The bot kites: it steers away from nearby enemies and shots, toward sea
// glass, and away from land; it takes evolutions, then weapons, then
// upgrades. A skilled player dodges better, so read sink rates as an upper
// bound and clear times as roughly right.
//
// Usage: node tools/survival-sim.mjs [runs] [stage] [level] [seedOffset]

import { createSurvivalRun, completeLevel, sinkLevel } from '../src/engine/survivalRun.mjs';
import { stepSurvivalFrame, BOAT_RADIUS } from '../src/engine/survivalLoop.mjs';
import { rollChoices, applyChoice, timeToBoss } from '../src/engine/survival.mjs';
import { checkSunk } from '../src/engine/run.mjs';
import { sampleField } from '../src/engine/terrain.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';
import { getBiome } from '../src/data/biomes.mjs';
import { SV_WEAPONS } from '../src/data/survival.mjs';


export function botInput(run) {
  const b = run.boat;
  let best = null; let bestScore = -Infinity;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const dx = Math.cos(a); const dy = Math.sin(a);
    let score = 0;
    for (const e of run.enemies) {
      if (e.health <= 0) continue;
      const ex = e.x - b.x; const ey = e.y - b.y; const d = Math.hypot(ex, ey);
      if (d > 260) continue;
      const toward = (ex * dx + ey * dy) / (d || 1);
      score -= toward * (e.isBoss || e.warlord ? 3 : 1) * 4000 / (d * d + 400);
    }
    for (const s of run.enemyProjectiles) {
      const ex = (s.tx ?? s.x) - b.x; const ey = (s.ty ?? s.y) - b.y; const d = Math.hypot(ex, ey);
      if (d > 120) continue;
      score -= ((ex * dx + ey * dy) / (d || 1)) * 3000 / (d * d + 300);
    }
    let gem = null; let gd = 220;
    for (const p of run.pickups) {
      if (p.collected || p.kind === 'magnet' && false) continue;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < gd) { gd = d; gem = p; }
    }
    if (gem) score += ((gem.x - b.x) * dx + (gem.y - b.y) * dy) / (gd || 1) * (gem.kind === 'chest' ? 1.4 : 0.5);
    // Land ahead is bad; open water ahead is good.
    for (const look of [30, 60, 100]) {
      const s = sampleField(run.coast, b.x + dx * look, b.y + dy * look);
      if (s > -14) score -= (look === 30 ? 6 : look === 60 ? 3 : 1.2);
    }
    // Drift back toward the middle of the map when there's nothing to do.
    const cx = run.widthPx / 2 - b.x; const cy = run.heightPx / 2 - b.y;
    score += ((cx * dx + cy * dy) / (Math.hypot(cx, cy) || 1)) * 0.15;
    if (score > bestScore) { bestScore = score; best = { x: dx, y: dy }; }
  }
  return best;
}

// A sensible player: evolve, then level what you have (four weapons is
// plenty), shore up the hull when it's taking a beating, and take the
// partner upgrade of a maxed weapon.
export function botPick(run, rng) {
  const cards = rollChoices(run, rng, 3 + (run.extraCardChoices || 0));
  const sv = run.sv; const hurt = run.boat.health / run.boat.maxHull < 0.6;
  const owned = Object.keys(sv.weapons).length + Object.keys(run.armaments || {}).length;
  const score = (c) => {
    if (c.kind === 'evolve') return 100;
    if (c.kind === 'weapon' && sv.weapons[c.id]) return 60 + sv.weapons[c.id];
    if (c.kind === 'armament' && run.armaments?.[c.id]) return 50;
    if (c.kind === 'passive') {
      const partner = Object.entries(sv.weapons).some(([w, lv]) => lv >= 4 && SV_WEAPONS[w].evolve.with === c.id);
      if (partner) return 90;
      if (hurt && (c.id === 'armour' || c.id === 'hull' || c.id === 'bilge')) return 80;
      return ['armour', 'hull', 'gun_crew', 'heavy_shot', 'lodestone'].includes(c.id) ? 45 : 30;
    }
    if (c.kind === 'weapon' || c.kind === 'armament') return owned < 4 ? 70 : 10;
    return 0;
  };
  cards.sort((a, b) => score(b) - score(a));
  return cards[0];
}

export function playLevel(seed, { stage = 1, levelIndex = 0, maxSeconds = 900, dt = 1 / 30, loadout } = {}) {
  const rng = makeSeededRng(seed ^ 0x9e3779b9);
  const run = loadout ? createSurvivalRun(seed, loadout, { stage, levelIndex }) : createSurvivalRun(seed, undefined, { stage, levelIndex });
  const biome = getBiome(run.level.biomeId);
  const ctx = { spawnDist: 520, biome, rng };
  const dmg = { wall: 0, shots: 0, contact: 0, dot: 0, weather: 0 };
  let t = 0; let peakAlive = 0; let picks = 0; let bossAt = null; let chests = 0;
  while (t < maxSeconds) {
    t += dt; ctx.t = t;
    const hullBefore = run.boat.health;
    const ev = stepSurvivalFrame(run, dt, botInput(run), ctx);
    dmg.wall += ev.wallDamage; dmg.dot += ev.dot;
    for (const h of ev.shots.hits) dmg.shots += h.damage;
    for (const c of ev.contacts) dmg.contact += c.damage;
    for (const h of ev.weather.boatHits || []) dmg.weather += h.damage;
    let ups = ev.levelUps + ev.pickups.chests;
    chests += ev.pickups.chests;
    while (ups-- > 0) { applyChoice(run, botPick(run, rng)); picks++; }
    if (ev.director.boss) bossAt = t;
    let alive = 0; for (const e of run.enemies) if (e.health > 0) alive++;
    peakAlive = Math.max(peakAlive, alive);
    const sunk = checkSunk(run);
    if (sunk === true) { sinkLevel(run); break; }
    if (run.sv.finished) { completeLevel(run); break; }
    void hullBefore;
  }
  return {
    outcome: run.outcome || 'timeout', t: Math.round(t), wave: run.sv.wave + 1, shipLevel: run.sv.shipLevel, kills: run.sv.kills,
    weapons: { ...run.sv.weapons }, evolved: Object.keys(run.sv.evolved), armaments: { ...run.armaments }, passives: { ...run.sv.passives },
    salvage: Math.round(run.bankedSalvage), dmg, peakAlive, picks, bossAt: bossAt && Math.round(bossAt), chests, hull: Math.round(run.boat.health),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] || 6); const stage = Number(process.argv[3] || 1); const lv = Number(process.argv[4] || 0); const off = Number(process.argv[5] || 0);
  const res = [];
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const r = playLevel(1000 + off + i, { stage, levelIndex: lv });
    res.push(r);
    console.log(`#${i} ${r.outcome.padEnd(7)} t=${r.t}s wave ${r.wave} lv${r.shipLevel} kills ${r.kills} peak ${r.peakAlive} salv ${r.salvage} hull ${r.hull} boss@${r.bossAt} chests ${r.chests} dmg w${r.dmg.wall | 0}/s${r.dmg.shots | 0}/c${r.dmg.contact | 0}/d${r.dmg.dot | 0}/x${r.dmg.weather | 0} weapons ${JSON.stringify(r.weapons)} evo ${r.evolved} arm ${JSON.stringify(r.armaments)}`);
  }
  const wins = res.filter((r) => r.outcome === 'victory');
  console.log(`stage ${stage} level ${lv + 1}: ${wins.length}/${n} cleared, median t ${res.map((r) => r.t).sort((a, b) => a - b)[n >> 1]}s, sim ${((performance.now() - t0) / 1000).toFixed(1)}s`);
}
