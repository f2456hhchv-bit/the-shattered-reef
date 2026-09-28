// Measures aim-assist hit rate against each enemy type through the real
// engine loop (enemy AI, projectiles, hit resolution) in open water.
// Usage: node tools/aim-check.mjs
import { createBoat, stepBoat, DEFAULT_BOAT_TUNING } from '../src/engine/boat.mjs';
import { createEnemy, updateEnemies, wakeEnemy, currentCounter } from '../src/engine/enemies.mjs';
import { createWeaponState, tryFire, stepCombat, resolveHits, cleanupProjectiles, collectWeaponCache, setActiveWeapon } from '../src/engine/combat.mjs';
import { computeAim, trackEnemyMotion } from '../src/engine/aim.mjs';
import { getWeapon, WEAPON_IDS } from '../src/data/weapons.mjs';
import { ENEMY_IDS } from '../src/data/enemies.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

const DT = 1 / 60; const TILE = 16; const N = 80;
const grid = { width: N, height: N, tiles: Array.from({ length: N }, () => Array(N).fill(0)) };

function naiveAim(enemies, boat, weapon) {
  let t = null; let bd = weapon.range;
  for (const e of enemies) { if (e.health <= 0 || e.invulnerable) continue; const d = Math.hypot(e.x - boat.x, e.y - boat.y); if (d <= bd) { bd = d; t = e; } }
  return t ? { heading: Math.atan2(t.y - boat.y, t.x - boat.x) } : null;
}

export function measure(defId, weaponId, aimFn, { moving = false, seconds = 12, seed = 1 } = {}) {
  const rng = makeSeededRng(seed);
  const origRandom = Math.random; Math.random = rng; // enemy AI uses Math.random for timers
  const c = (N * TILE) / 2;
  const boat = createBoat(c, c, 0);
  const weapons = createWeaponState();
  if (weaponId !== WEAPON_IDS.CANNONBALLS) { collectWeaponCache(weapons, weaponId, 999); setActiveWeapon(weapons, weaponId); }
  const weapon = getWeapon(weaponId);
  let shots = 0, hits = 0, prev = null; let enemies = [];
  const spawn = () => { const a = rng() * Math.PI * 2; const e = createEnemy(defId, c + Math.cos(a) * 120, c + Math.sin(a) * 120, rng); e.health = e.maxHealth = 1e9; wakeEnemy(e); return e; };
  enemies = [spawn()];
  for (let f = 0; f < seconds / DT; f++) {
    if (moving) stepBoat(boat, { x: Math.cos(f / 120), y: Math.sin(f / 90) }, DT, DEFAULT_BOAT_TUNING);
    boat.x = Math.max(200, Math.min(N * TILE - 200, boat.x)); boat.y = Math.max(200, Math.min(N * TILE - 200, boat.y));
    const aim = aimFn(enemies, boat, weapon, { grid, tileSize: TILE, counterOf: currentCounter, previousTarget: prev });
    prev = aim?.target ?? null;
    if (aim) {
      const before = weapons.projectiles.length;
      if (tryFire(weapons, boat.x, boat.y, aim.heading, rng)) shots += weapons.projectiles.length - before;
    }
    stepCombat(weapons, DT, grid, TILE, enemies);
    updateEnemies(enemies, boat, DT, grid, TILE, null);
    trackEnemyMotion(enemies, DT);
    for (const e of enemies) e.invulnerable = false; // measure pure aim, not surfacing
    const evs = resolveHits(weapons, enemies, currentCounter);
    hits += evs.length;
    cleanupProjectiles(weapons);
  }
  Math.random = origRandom;
  return { shots, hits, rate: shots ? hits / shots : 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [];
  for (const defId of [ENEMY_IDS.REEF_SKIMMER, ENEMY_IDS.GULLSWARM_HARPY, ENEMY_IDS.RIGGER, ENEMY_IDS.IRONCLAD_BRIGAND]) {
    for (const weaponId of [WEAPON_IDS.CANNONBALLS]) {
      for (const moving of [false, true]) {
        const agg = (fn) => { let s = 0, h = 0; for (let seed = 1; seed <= 8; seed++) { const r = measure(defId, weaponId, fn, { moving, seed }); s += r.shots; h += r.hits; } return h / s; };
        rows.push({ defId, weaponId, moving, naive: agg(naiveAim).toFixed(2), lead: agg(computeAim).toFixed(2) });
      }
    }
  }
  console.table(rows);
}
