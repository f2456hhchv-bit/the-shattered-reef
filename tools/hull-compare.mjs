// Standalone hull comparison (unaligned, no other unlocks) on the same
// seeds, with the same speed-independent voyage-survival metric as
// tools/faction-compare.mjs. Usage: node tools/hull-compare.mjs [runs] [seedOffset]
// HULL=id:field=val;... overrides stats for a sweep (never shipped).
import { runBatch } from './balance-sim.mjs';
import { SHIP_HULL_LIST, SHIP_HULLS } from '../src/data/meta.mjs';
import { SPAWN_POOLS } from '../src/data/enemies.mjs';
import { createDefaultMeta, purchaseHull, selectHull, resolveLoadout } from '../src/engine/meta.mjs';

const n = Number(process.argv[2]) || 200;
const seedOffset = Number(process.argv[3]) || 5000;
if (process.env.POOL2_ADD) SPAWN_POOLS[1].push(...process.env.POOL2_ADD.split(','));
if (process.env.HULL) for (const spec of process.env.HULL.split(';')) {
  const [id, kv] = spec.split(':'); const [k, v] = kv.split('='); SHIP_HULLS[id][k] = Number(v);
}
const rows = [];
for (const hull of SHIP_HULL_LIST) {
  const meta = createDefaultMeta(); meta.salvage = 99999;
  if (hull.cost > 0) purchaseHull(meta, hull.id);
  selectHull(meta, hull.id);
  const res = runBatch(n, seedOffset, resolveLoadout(meta));
  let survive = 1; const per = [];
  for (let reef = 1; reef <= 3; reef++) {
    const entered = res.filter((r) => r.reefsReached >= reef).length;
    const sank = res.filter((r) => r.outcome === 'sunk' && r.reefsReached === reef).length;
    const rate = entered ? sank / entered : 0; per.push(`${Math.round(100 * rate)}%`); survive *= 1 - rate;
  }
  const avg = (fn) => res.reduce((s, r) => s + fn(r), 0) / res.length;
  rows.push({ hull: hull.id, maxHull: hull.maxHull, sinkR1: per[0], sinkR2: per[1], sinkR3: per[2], voyageSurvival: `${Math.round(100 * survive)}%`,
    contact: avg((r) => r.damageBySource.enemyContact).toFixed(1), wall: avg((r) => r.damageBySource.wall).toFixed(1), reachR3: `${Math.round(100 * avg((r) => (r.reefsReached >= 3 ? 1 : 0)))}%` });
}
console.table(rows);
