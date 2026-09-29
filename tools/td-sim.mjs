// Reef Defence balance sim (2026-09-29). Plays every defence map headless
// with a bot that builds like a sensible player: it reads the coming
// waves and builds the towers that counter them (anti-air for flyers,
// Depth Charges for divers, a Lighthouse for hidden or ghostly enemies
// and in the dark), on the spots that cover the most channel, then
// upgrades. Reports stars, lives left and the wave it fell on.
//
// Usage: node tools/td-sim.mjs [kit] [mapIndex]
//   kit: fresh (Cannon + Grapeshot only) | towers (every tower, no specs)
//        | full (every tower, spec and perk). Default: towers.

import { TD_MAPS } from '../src/data/tdMaps.mjs';
import { TOWERS, TOWER_LIST, SPEC_LIST, TD_PERKS, TOWER_FOR_WEAPON } from '../src/data/towers.mjs';
import { getEnemy } from '../src/data/enemies.mjs';
import { buildDefenceMap } from '../src/engine/tdMap.mjs';
import {
  createDefence, stepDefence, drainEvents, buildTower, upgradeTower, specializeTower, startNextWave, canCallWave, upgradeCost, towerAt,
} from '../src/engine/td.mjs';
import { isFlyer } from '../src/engine/tdWaves.mjs';

const KITS = {
  fresh: { unlockedTowers: ['cannon', 'grapeshot'], unlockedSpecs: [], perks: [] },
  towers: { unlockedTowers: TOWER_LIST.map((t) => t.id), unlockedSpecs: [], perks: [] },
  full: { unlockedTowers: TOWER_LIST.map((t) => t.id), unlockedSpecs: SPEC_LIST.map((s) => s.id), perks: TD_PERKS.map((p) => p.id) },
};

function coverage(map, spot, r = 100) {
  let n = 0;
  for (const l of map.lanes) for (const p of l.ground.pts) if (Math.hypot(p.x - spot.x, p.y - spot.y) < r) n++;
  return n;
}

// What the next couple of waves need, weighted by hull.
function needs(s) {
  const want = {};
  let air = 0; let sub = 0; let hidden = 0;
  for (let w = Math.max(0, s.waveIndex + 1); w < Math.min(s.waves.length, s.waveIndex + 3); w++) {
    for (const g of s.waves[w].groups) {
      const d = getEnemy(g.defId);
      const hp = d.maxHealth * g.count * g.hpMult;
      const tid = TOWER_FOR_WEAPON[d.counter] || 'cannon';
      want[tid] = (want[tid] || 0) + hp;
      if (isFlyer(d)) air += hp;
      if (d.archetype === 'submerged' || d.archetype === 'serpent' || d.burrows) sub += hp;
      if (d.camo || d.archetype === 'ghost') hidden += hp;
    }
  }
  return { want, air, sub, hidden };
}

function chooseTower(s) {
  const unlocked = s.unlockedTowers;
  const have = (id) => s.towers.filter((t) => t.towerId === id).length;
  const n = needs(s);
  if ((n.hidden > 0 || s.dark) && unlocked.has('lighthouse') && have('lighthouse') < (s.dark ? 2 : 1)) return 'lighthouse';
  if (n.sub > 0 && unlocked.has('depth') && have('depth') < 1) return 'depth';
  if (n.air > 0 && unlocked.has('chain') && have('chain') < 1) return 'chain';
  const total = Object.values(n.want).reduce((a, b) => a + b, 0) || 1;
  const airCapable = s.towers.filter((t) => TOWERS[t.towerId].reach.air).length;
  if (n.air / total > 0.25 && airCapable < s.towers.length * 0.6) {
    const pick = (n.want.grapeshot || 0) > (n.want.chain || 0) ? 'grapeshot' : 'chain';
    if (unlocked.has(pick)) return pick;
  }
  let best = 'cannon'; let bestScore = -1;
  for (const [tid, hp] of Object.entries(n.want)) {
    if (!unlocked.has(tid)) continue;
    const score = hp / (1 + have(tid) * 0.8);
    if (score > bestScore) { bestScore = score; best = tid; }
  }
  if (!unlocked.has(best)) best = 'cannon';
  return best;
}

function botAct(s, spotOrder, cover) {
  for (let guard = 0; guard < 6; guard++) {
    const free = spotOrder.filter((sp) => !towerAt(s, sp.id));
    const used = s.towers.length / s.map.spots.length;
    const tid = chooseTower(s);
    const essential = ['lighthouse', 'depth', 'chain'].includes(tid) && !s.towers.some((t) => t.towerId === tid);
    const spec = s.towers.find((t) => t.level === 3 && !t.spec && TOWERS[t.towerId].specs.some((p) => s.unlockedSpecs.has(p.id)));
    if (spec) {
      const sp = TOWERS[spec.towerId].specs.find((p) => s.unlockedSpecs.has(p.id));
      if (specializeTower(s, spec.id, sp.id).ok) continue;
      if (s.gold < sp.cost && used > 0.5 && s.waveIndex > s.waves.length / 2) break; // saving up
    }
    if (free.length && (essential || used < 0.45)) {
      if (buildTower(s, free[0].id, tid).ok) continue;
      break;
    }
    const up = s.towers.filter((t) => upgradeCost(t) != null && (t.towerId !== 'lighthouse' || t.level < 2)).sort((a, b) => cover[b.spotId] - cover[a.spotId] || a.level - b.level)[0];
    if (up && (!free.length || Math.random() < 0.7)) { if (upgradeTower(s, up.id).ok) continue; break; }
    if (free.length && buildTower(s, free[0].id, tid).ok) continue;
    break;
  }
}

export function playMap(mapDef, kit, { callEarly = false } = {}) {
  const map = buildDefenceMap(mapDef);
  const s = createDefence(mapDef, map, KITS[kit]);
  const spotOrder = [...map.spots].sort((a, b) => coverage(map, b) - coverage(map, a));
  const cover = Object.fromEntries(map.spots.map((sp) => [sp.id, coverage(map, sp)]));
  botAct(s, spotOrder, cover);
  startNextWave(s);
  const dt = 1 / 30;
  let t = 0; let leakByDef = {};
  while (!s.over && t < 3600) {
    stepDefence(s, dt); t += dt;
    for (const ev of drainEvents(s)) {
      if (ev.type === 'leak') leakByDef[ev.enemy.defId] = (leakByDef[ev.enemy.defId] || 0) + ev.lives;
      if (ev.type === 'waveStart' && process.env.VERBOSE) console.log(`  w${ev.index + 1} t${Math.round(t)} gold ${s.gold} lives ${s.lives} towers ${s.towers.map((q) => q.towerId[0] + q.level + (q.spec ? '*' : '')).join(' ')}`);
      if (ev.type === 'bossArrives' && process.env.VERBOSE) ev.enemy._t0 = t;
      if (ev.type === 'kill' && ev.boss && process.env.VERBOSE) console.log(`  boss sunk after ${Math.round(t - ev.enemy._t0)}s`);
      if (ev.type === 'leak' && ev.enemy.isBoss && process.env.VERBOSE) console.log(`  boss leaked with ${Math.round(ev.hpLeft)}/${Math.round(ev.enemy.maxHealth)} after ${Math.round(t - ev.enemy._t0)}s`);
    }
    if (Math.round(t * 30) % 15 === 0) botAct(s, spotOrder, cover);
    if (callEarly && canCallWave(s) && s.enemies.length < 4 && s.nextWaveTimer != null) startNextWave(s);
  }
  return { outcome: s.outcome, stars: s.stars, lives: s.lives, wave: s.waveIndex + 1, waves: s.waves.length, time: Math.round(t), towers: s.towers.length, leaks: leakByDef };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const kit = process.argv[2] || 'towers';
  const only = process.argv[3] != null ? Number(process.argv[3]) : null;
  TD_MAPS.forEach((m, i) => {
    if (only != null && i !== only) return;
    const r = playMap(m, kit);
    const leaks = Object.entries(r.leaks).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`${String(i + 1).padStart(2)} ${m.name.padEnd(20)} ${r.outcome.padEnd(4)} ${'★'.repeat(r.stars).padEnd(3)} lives ${String(r.lives).padStart(2)} wave ${r.wave}/${r.waves} ${r.time}s towers ${r.towers}  ${leaks}`);
  });
}
