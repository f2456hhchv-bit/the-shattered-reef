// Unlock pace (2026-10-22): every thing the harbour sells, its price, the
// stage it waits for and its tier, and roughly how long a player takes to
// afford each tier. The owner's rule: some quality-of-life buys early, the
// true end game a grind, and nobody unlocks everything in a day's play.
//
//   node tools/economy.mjs            summary by tier and shop
//   node tools/economy.mjs --list     every item
//
// Income is measured with tools/survival-sim.mjs (starter ship, bot): a
// cleared level pays ~1,700-2,800 Salvage at stages 1-4 and takes 5-7
// minutes; a sinking keeps half of very little. PACE below is the average
// with sinkings and harbour time in, not the best case. Scales only come
// from stage bosses (one per boss sunk), so they gate the end game.

import { SHIP_HULLS, CARGO_TIERS, CHARMS, PLAYABLE_FACTIONS, WORKSHOP_UPGRADES } from '../src/data/meta.mjs';
import { LIVERIES } from '../src/data/progression.mjs';
import {
  REFIT_TRACKS, REFIT_MAX, refitCost, refitScales, MASTERY_MAX, masteryCost, masteryScales,
  keyCost, keyScales, CREW_QUARTERS, WAKES,
} from '../src/data/shop.mjs';
import { KEYS, KEY_IDS, KEY_MAX_LEVEL } from '../src/data/keys.mjs';
import { SV_WEAPONS, SV_WEAPON_IDS } from '../src/data/survival.mjs';

export const PACE = {
  salvagePerHour: 15000, // average play, sinkings included
  minutesPerStage: 50, // five levels, a few retries, harbour time
  scalesPerHour: 7, // farming boss levels flat out (normal play: ~2)
};

// Levelled tracks unlock a level per cleared stage pair (refitCap/masteryCap:
// 2 + 2 per stage cleared), so level L waits for stage ceil(L/2).
const capStage = (level) => Math.max(1, Math.ceil(level / 2));

function tierOf(it) {
  if (it.scales > 0 || it.salvage >= 2500 || (it.level || 0) >= 6) return 'end';
  if (it.requires <= 1 && it.salvage <= 500) return 'qol';
  return 'mid';
}

export function shopCatalogue() {
  const out = [];
  const push = (shop, name, salvage, scales = 0, requires = 1, level = 0) => out.push({ shop, name, salvage, scales, requires, level });
  for (const h of Object.values(SHIP_HULLS)) if (h.cost) push('Shipyard', h.name, h.cost, 0, h.requires || 1);
  for (const c of Object.values(CARGO_TIERS)) push('Armory', c.name, c.cost, 0, c.requires || 1);
  for (const c of Object.values(CHARMS)) push('Charm Shrine', c.name, c.cost, 0, c.requires || 1);
  for (const f of Object.values(PLAYABLE_FACTIONS)) push('Faction Hall', f.name, f.cost, 0, f.requires || 1);
  for (const w of Object.values(WORKSHOP_UPGRADES)) push('Workshop', w.name, w.salvageCost, w.krakenScaleCost || 0, w.requires || 1);
  for (const h of Object.values(SHIP_HULLS)) {
    for (const tr of REFIT_TRACKS) {
      for (let lv = 1; lv <= REFIT_MAX; lv++) push('Shipyard refits', `${h.name} ${tr.name} ${lv}`, refitCost(lv), refitScales(lv), Math.max(h.requires || 1, capStage(lv)), lv);
    }
  }
  for (const id of SV_WEAPON_IDS) {
    for (let lv = 1; lv <= MASTERY_MAX; lv++) push('Gunsmith', `${SV_WEAPONS[id].name} mastery ${lv}`, masteryCost(lv), masteryScales(lv), capStage(lv), lv);
  }
  for (const id of KEY_IDS) {
    // A key is won from its stage boss; the Keysmith can only work it after.
    for (let lv = 2; lv <= KEY_MAX_LEVEL; lv++) push('Keysmith', `${KEYS[id].name} ${lv}`, keyCost(lv), keyScales(lv), Math.max(1, KEYS[id].stage + 1), lv);
  }
  push('Crew', 'Crew Quarters', CREW_QUARTERS.cost, CREW_QUARTERS.scales, CREW_QUARTERS.requires);
  for (const w of WAKES) if (w.cost) push('Wakes', w.name, w.cost, 0, w.requires || 1);
  for (const l of LIVERIES) if (l.cost) push('Liveries', l.name, l.cost, 0, 1);
  for (const it of out) it.tier = tierOf(it);
  return out;
}

// Hours of play to afford each tier (cumulative), at PACE. Each is the
// longest of: earning the Salvage, earning the Scales, and sailing far
// enough to reach the stages the tier waits for. A floor, not a forecast.
export function unlockHours(items = shopCatalogue(), pace = PACE) {
  const sum = (list, f) => list.reduce((a, it) => a + it[f], 0);
  const hoursFor = (list) => Math.max(
    sum(list, 'salvage') / pace.salvagePerHour,
    sum(list, 'scales') / pace.scalesPerHour,
    (Math.max(1, ...list.map((it) => it.requires)) - 1) * pace.minutesPerStage / 60,
  );
  const qol = items.filter((it) => it.tier === 'qol');
  const mid = items.filter((it) => it.tier !== 'end');
  return { qol: hoursFor(qol), mid: hoursFor(mid), all: hoursFor(items) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = shopCatalogue();
  const h = unlockHours(items);
  const by = (k) => { const m = {}; for (const it of items) { const g = (m[it[k]] ||= { n: 0, salvage: 0, scales: 0 }); g.n++; g.salvage += it.salvage; g.scales += it.scales; } return m; };
  console.log('By tier'); console.table(by('tier'));
  console.log('By shop'); console.table(by('shop'));
  console.log(`Hours to afford (at ${PACE.salvagePerHour.toLocaleString()} Salvage/h, ${PACE.scalesPerHour} Scales/h farming):`);
  console.log(`  QoL ${h.qol.toFixed(1)}h · QoL + mid game ${h.mid.toFixed(1)}h · everything ${h.all.toFixed(1)}h`);
  if (process.argv.includes('--list')) for (const it of items) console.log(`${it.tier.padEnd(4)} ${it.shop.padEnd(16)} ${it.name.padEnd(34)} ${String(it.salvage).padStart(6)}${it.scales ? ` +${it.scales}🦑` : ''}  stage ${it.requires}`);
}
