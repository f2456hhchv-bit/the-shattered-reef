// Directional faction comparison: runs the balance-sim bot through the SAME
// seeds once per faction package (plus Unaligned as a control), resolved
// through the real meta pipeline (resolveLoadout), and reports relative
// survival/performance. The bot's absolute win rate is known-unreliable
// (see CLAUDE.md) — what this measures is the *spread between factions*
// under an identical, faction-blind bot, which the bot's flaws affect
// equally. Usage: node tools/faction-compare.mjs [runsPerFaction] [seedOffset]
import { runBatch } from './balance-sim.mjs';
import { createDefaultMeta, purchaseFaction, selectFaction, resolveLoadout } from '../src/engine/meta.mjs';
import { FACTION_LIST } from '../src/data/factions.mjs';

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
    avgReefsReached: avg((r) => r.reefsReached).toFixed(2),
    reachedReef3: `${Math.round(100 * avg((r) => (r.reefsReached >= 3 ? 1 : 0)))}%`,
    sunk: `${Math.round(100 * avg((r) => (r.outcome === 'sunk' ? 1 : 0)))}%`,
    avgKills: avg(kills).toFixed(1),
    avgContactDmg: avg((r) => r.damageBySource.enemyContact).toFixed(1),
    bossKills: `${Math.round(100 * avg((r) => (r.bossDefeated ? 1 : 0)))}%`,
    secs: ((Date.now() - t0) / 1000).toFixed(0),
  });
}
console.table(rows);
