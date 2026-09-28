// Directional faction comparison: runs the balance-sim bot through the SAME
// seeds once per faction package (plus Unaligned as a control), resolved
// through the real meta pipeline (resolveLoadout), and reports relative
// survival/performance. The bot's absolute win rate is known-unreliable
// (see CLAUDE.md) — what this measures is the *spread between factions*
// under an identical, faction-blind bot, which the bot's flaws affect
// equally. Usage: node tools/faction-compare.mjs [runsPerFaction] [seedOffset]
import { runBatch } from './balance-sim.mjs';
import { createDefaultMeta, purchaseFaction, selectFaction, resolveLoadout } from '../src/engine/meta.mjs';
import { FACTION_LIST, INCOMING_TRIANGLE } from '../src/data/factions.mjs';
import { SPAWN_POOLS } from '../src/data/enemies.mjs';
import { SHIP_HULLS } from '../src/data/meta.mjs';

// POOL2_ADD=id[,id] appends ids to reef 2's spawn pool; HULL=id:field=val
// overrides a hull stat — both for sweeps only, never shipped.
if (process.env.POOL2_ADD) SPAWN_POOLS[1].push(...process.env.POOL2_ADD.split(','));
if (process.env.HULL) for (const spec of process.env.HULL.split(';')) {
  const [id, kv] = spec.split(':'); const [k, v] = kv.split('='); SHIP_HULLS[id][k] = Number(v);
}

// INCOMING=adv,disadv overrides the incoming-triangle magnitudes for a
// sweep (e.g. INCOMING=1,1 = one-directional triangle).
if (process.env.INCOMING) {
  const [a, d] = process.env.INCOMING.split(',').map(Number);
  INCOMING_TRIANGLE.advantage = a;
  INCOMING_TRIANGLE.disadvantage = d;
}

const n = Number(process.argv[2]) || 40;
const seedOffset = Number(process.argv[3]) || 5000;

function loadoutFor(factionId) {
  const meta = createDefaultMeta();
  if (factionId) { meta.salvage = 10000; purchaseFaction(meta, factionId); selectFaction(meta, factionId); }
  return resolveLoadout(meta);
}

const rows = [];
for (const f of [null, ...FACTION_LIST.map((x) => x.id)]) {
  const t0 = Date.now();
  const res = runBatch(n, seedOffset, loadoutFor(f));
  const avg = (fn) => res.reduce((s, r) => s + fn(r), 0) / res.length;
  const kills = (r) => Object.values(r.kills).reduce((a, b) => a + b, 0);
  rows.push({
    faction: f || 'unaligned',
    // Per-reef sink rate GIVEN the voyage entered that reef, chained into a
    // voyage-survival estimate. Raw "sunk %" is confounded by speed: a slow
    // ship times out (a bot artifact — players don't) before reaching the
    // deadliest reef, so it looks safer than it is. This controls for that.
    ...(() => {
      const out = {}; let survive = 1;
      for (let reef = 1; reef <= 3; reef++) {
        const entered = res.filter((r) => r.reefsReached >= reef).length;
        const sank = res.filter((r) => r.outcome === 'sunk' && r.reefsReached === reef).length;
        const rate = entered ? sank / entered : 0;
        out[`sinkR${reef}`] = `${Math.round(100 * rate)}%`;
        survive *= 1 - rate;
      }
      out.voyageSurvival = `${Math.round(100 * survive)}%`;
      return out;
    })(),
    avgReefsReached: avg((r) => r.reefsReached).toFixed(2),
    reachedReef3: `${Math.round(100 * avg((r) => (r.reefsReached >= 3 ? 1 : 0)))}%`,
    sunk: `${Math.round(100 * avg((r) => (r.outcome === 'sunk' ? 1 : 0)))}%`,
    avgKills: avg(kills).toFixed(1),
    avgContactDmg: avg((r) => r.damageBySource.enemyContact).toFixed(1),
    contactBy: (() => { const t = {}; for (const r of res) for (const [k, v] of Object.entries(r.contactByFaction)) t[k] = (t[k] || 0) + v / res.length; return Object.entries(t).map(([k, v]) => `${k.slice(0, 4)}:${v.toFixed(0)}`).join(' '); })(),
    bossKills: `${Math.round(100 * avg((r) => (r.bossDefeated ? 1 : 0)))}%`,
    secs: ((Date.now() - t0) / 1000).toFixed(0),
  });
}
console.table(rows);
