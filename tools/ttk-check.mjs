// Empirical time-to-kill / ammo check, driven through the REAL engine loop
// in main.mjs's order (tryFire → stepCombat → resolveHits → stepBurn), not
// hand arithmetic — both hand models of Flame Barrels' burn overlap in the
// build log turned out wrong (see CLAUDE.md, 2026-09-28).
//
// Two reports:
//  1. Every regular enemy vs its own counter weapon, under each combat-
//     triangle state (neutral / advantage / disadvantage): shots, seconds,
//     share of one full cache (ammoMax).
//  2. The Kraken's Anchor fought "correctly" — Depth Charges while it's
//     submerged/surfacing (phase 0), Flame Barrels while it tanks (phase 1)
//     — with the boss pinned in range so this measures weapon output, not
//     positioning. Depth Charges are modelled two ways because their fuse
//     makes timing a real skill: SPAM (fire whenever ready) and REACTIVE
//     (fire the instant it surfaces).
//
// Usage: node tools/ttk-check.mjs            (current data)
//        FLAME_DAMAGE=4 node tools/ttk-check.mjs   (override for comparison)
import {
  createWeaponState, collectWeaponCache, setActiveWeapon, tryFire, stepCombat,
  resolveHits, cleanupProjectiles, stepBurn,
} from '../src/engine/combat.mjs';
import { createEnemy, updateEnemy, currentCounter } from '../src/engine/enemies.mjs';
import { WEAPONS, WEAPON_IDS } from '../src/data/weapons.mjs';
import { ENEMY_LIST, ENEMY_IDS } from '../src/data/enemies.mjs';
import { createBoat } from '../src/engine/boat.mjs';
import { TRIANGLE_ADVANTAGE_MULTIPLIER, TRIANGLE_DISADVANTAGE_MULTIPLIER } from '../src/data/factions.mjs';

if (process.env.FLAME_DAMAGE) WEAPONS[WEAPON_IDS.FLAME_BARRELS].damage = Number(process.env.FLAME_DAMAGE);

const DT = 1 / 60;
const GRID = { width: 80, height: 80, tiles: Array.from({ length: 80 }, () => Array(80).fill(0)) };
const straight = () => 0.5; // no spread: measures output, not luck

export function killStats(enemyId, weaponId, mult = 1, distance = 60) {
  const s = createWeaponState();
  collectWeaponCache(s, weaponId, 999);
  setActiveWeapon(s, weaponId);
  const e = createEnemy(enemyId, 400 + distance, 400);
  e.invulnerable = false; e.submergedState = null; // regular-enemy table: measure raw output
  let shots = 0; let t = 0;
  while (e.health > 0 && t < 120) {
    if (tryFire(s, 400, 400, 0, straight)) shots++;
    stepCombat(s, DT, GRID, 16);
    resolveHits(s, [e], currentCounter, () => mult);
    cleanupProjectiles(s);
    stepBurn(e, DT);
    t += DT;
  }
  return { shots, seconds: t, ammoShare: shots / WEAPONS[weaponId].ammoMax };
}

export function bossFight({ depthMode = 'reactive', maxSeconds = 180, missRate = 0 } = {}) {
  const s = createWeaponState();
  collectWeaponCache(s, WEAPON_IDS.DEPTH_CHARGES, WEAPONS[WEAPON_IDS.DEPTH_CHARGES].ammoMax);
  collectWeaponCache(s, WEAPON_IDS.FLAME_BARRELS, WEAPONS[WEAPON_IDS.FLAME_BARRELS].ammoMax);
  const boat = createBoat(400, 400, 0);
  const boss = createEnemy(ENEMY_IDS.KRAKENS_ANCHOR, 480, 400);
  const pin = { x: boss.x, y: boss.y };
  const used = { depth_charges: 0, flame_barrels: 0 };
  let t = 0; let wasSubmerged = boss.invulnerable; const ranDry = {};
  while (boss.health > 0 && t < maxSeconds) {
    updateEnemy(boss, boat, DT, GRID, 16);
    boss.x = pin.x; boss.y = pin.y; // pinned in range: weapon output, not positioning
    const phaseWeapon = boss.counter;
    setActiveWeapon(s, phaseWeapon);
    const surfacedNow = wasSubmerged && !boss.invulnerable;
    wasSubmerged = boss.invulnerable;
    let wantFire = true;
    if (phaseWeapon === WEAPON_IDS.DEPTH_CHARGES && depthMode === 'reactive') wantFire = surfacedNow;
    // A miss still spends the ammo — it just goes wide (real play: a
    // moving, kited boss and imperfect aim-assist geometry).
    const heading = Math.random() < missRate ? Math.PI : 0;
    if (wantFire && tryFire(s, boat.x, boat.y, heading, straight)) used[phaseWeapon]++;
    if (s.ammo[phaseWeapon] === 0 && ranDry[phaseWeapon] == null) ranDry[phaseWeapon] = t;
    stepCombat(s, DT, GRID, 16);
    resolveHits(s, [boss], currentCounter);
    cleanupProjectiles(s);
    stepBurn(boss, DT);
    t += DT;
  }
  return { killed: boss.health <= 0, seconds: t, hpLeft: Math.max(0, boss.health), used, ranDry };
}

if (process.argv[1] && process.argv[1].endsWith('ttk-check.mjs')) {
  console.log(`Flame Barrels damage = ${WEAPONS[WEAPON_IDS.FLAME_BARRELS].damage}\n`);
  const rows = [];
  for (const e of ENEMY_LIST) {
    if (e.isBoss) continue;
    const row = { enemy: e.name, counter: WEAPONS[e.counter].name };
    for (const [label, m] of [['neutral', 1], ['adv', TRIANGLE_ADVANTAGE_MULTIPLIER], ['disadv', TRIANGLE_DISADVANTAGE_MULTIPLIER]]) {
      const k = killStats(e.id, e.counter, m, e.counter === WEAPON_IDS.DEPTH_CHARGES ? 81 : 60);
      row[label] = `${k.shots} shots / ${k.seconds.toFixed(1)}s / ${Math.round(100 * k.ammoShare)}%`;
    }
    rows.push(row);
  }
  console.table(rows);
  for (const [mode, missRate] of [['reactive', 0], ['spam', 0], ['reactive', 0.2], ['reactive', 0.35], ['spam', 0.2]]) {
    const fights = Array.from({ length: 60 }, () => bossFight({ depthMode: mode, missRate }));
    const avg = (f) => fights.reduce((a, x) => a + f(x), 0) / fights.length;
    console.log(`Boss (${mode} Depth, ${Math.round(missRate * 100)}% misses, 60 fights): killed ${Math.round(100 * avg((f) => (f.killed ? 1 : 0)))}%`
      + ` | avg ${avg((f) => f.seconds).toFixed(1)}s | Depth used ${avg((f) => f.used.depth_charges).toFixed(1)}/${WEAPONS.depth_charges.ammoMax}`
      + ` | Flame used ${avg((f) => f.used.flame_barrels).toFixed(1)}/${WEAPONS.flame_barrels.ammoMax}`
      + ` | Flame ran dry ${Math.round(100 * avg((f) => (f.ranDry.flame_barrels != null ? 1 : 0)))}%`
      + ` | Depth ran dry ${Math.round(100 * avg((f) => (f.ranDry.depth_charges != null ? 1 : 0)))}%`);
  }
}
