// Upgrade cards: rolling the three offered after a level, and applying
// the one picked. Pure logic over a run (engine/run.mjs).

import { UPGRADES, UPGRADE_BY_ID } from '../data/upgrades.mjs';
import { stageInfo } from '../data/stages.mjs';
import { getEnemy } from '../data/enemies.mjs';
import { ammoMaxFor } from './combat.mjs';

// Weapons this stage's enemies (and boss) are countered by.
function stageWeapons(stage) {
  const info = stageInfo(stage);
  const ids = new Set(info.pools.flat());
  const out = new Set();
  for (const id of ids) out.add(getEnemy(id).counter);
  return out;
}

export function upgradeLevel(run, id) {
  return (run.upgrades && run.upgrades[id]) || 0;
}

export function isOfferable(run, u) {
  if (upgradeLevel(run, u.id) >= u.max) return false;
  if (u.weapon && !run.weapons.heldWeapons.has(u.weapon) && !stageWeapons(run.stage || 1).has(u.weapon)) return false;
  if (u.needsSpecial && run.weapons.heldWeapons.size <= 1 && ![...stageWeapons(run.stage || 1)].some((w) => w !== 'cannonballs')) return false;
  return true;
}

// Three distinct cards, weighted; fewer only if fewer are left to offer.
export function rollUpgradeChoices(run, rng = Math.random, count = 3) {
  const pool = UPGRADES.filter((u) => isOfferable(run, u));
  const picks = [];
  while (picks.length < count && pool.length) {
    const total = pool.reduce((a, u) => a + u.weight, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].weight; if (r <= 0) break; }
    picks.push(pool[i].id);
    pool.splice(i, 1);
  }
  return picks;
}

export function applyUpgrade(run, id) {
  const u = UPGRADE_BY_ID[id];
  if (!u || !isOfferable(run, u)) return false;
  run.upgrades ||= {};
  run.upgrades[id] = upgradeLevel(run, id) + 1;
  const m = run.weapons.mods;
  const mul = (obj, key, k) => { obj[key] = (obj[key] || 1) * k; };
  const add = (obj, key, n) => { obj[key] = (obj[key] || 0) + n; };
  switch (id) {
    case 'heavy_shot': mul(m.damage, 'cannonballs', 1.3); break;
    case 'twin_cannons': add(m.extraShots, 'cannonballs', 1); break;
    case 'piercing_shot': add(m.pierce, 'cannonballs', 1); break;
    case 'quick_reload': m.cooldown *= 0.85; break;
    case 'long_guns': m.range *= 1.2; break;
    case 'hull_plating':
      run.boat.maxHull += 25;
      run.boat.health = Math.min(run.boat.maxHull, run.boat.health + 25);
      break;
    case 'bilge_pumps': run.hullRegenPerSecond = (run.hullRegenPerSecond || 0) + 0.5; break;
    case 'swift_sails':
      run.tuning = { ...run.tuning, maxSpeed: run.tuning.maxSpeed * 1.12, acceleration: run.tuning.acceleration * 1.12 };
      break;
    case 'iron_ram':
      run.ramDamage = (run.ramDamage || 0) + 25;
      run.contactDamageTaken = (run.contactDamageTaken ?? 1) * 0.7;
      break;
    case 'salvage_magnet': run.pickupReach = 3; break;
    case 'deep_magazines':
      m.ammoMax *= 1.5;
      for (const w of run.weapons.heldWeapons) {
        const max = ammoMaxFor(run.weapons, w);
        if (Number.isFinite(max)) run.weapons.ammo[w] = max;
      }
      break;
    case 'scattershot': add(m.extraShots, 'grapeshot', 3); break;
    case 'bola_chains': add(m.pierce, 'chain_shot', 2); break;
    case 'big_charges': m.blast *= 1.4; break;
    case 'greek_fire': m.burn *= 1.6; mul(m.damage, 'flame_barrels', 1.25); break;
    default: return false;
  }
  return true;
}

