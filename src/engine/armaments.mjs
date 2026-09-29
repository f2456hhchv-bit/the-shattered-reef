// Armaments at work (2026-09-29): the second guns and devices from
// treasure chests (data/armaments.mjs). Pure logic over a run: timers,
// targeting, and the projectiles they add to the run's weapon state, plus
// the two that resolve their own hits (Sea Spirit, St Elmo's Fire).

import { ARMAMENTS, ARMAMENT_BY_ID, ARMAMENT_MAX_LEVEL } from '../data/armaments.mjs';
import { ARMAMENT_WEAPONS } from '../data/weapons.mjs';
import { computeAim } from './aim.mjs';
import { applyDamageToEnemy } from './combat.mjs';

let nextId = 5_000_000;

export function armamentLevel(run, id) {
  return (run.armaments && run.armaments[id]) || 0;
}

export function grantArmament(run, id) {
  if (!ARMAMENT_BY_ID[id]) return 0;
  run.armaments ||= {};
  run.armaments[id] = Math.min(ARMAMENT_MAX_LEVEL, armamentLevel(run, id) + 1);
  return run.armaments[id];
}

// Up to `count` armaments to choose from. New ones and level-ups both
// count; maxed ones never appear.
export function rollArmamentChoices(run, rng = Math.random, count = 3) {
  const pool = ARMAMENTS.filter((a) => armamentLevel(run, a.id) < ARMAMENT_MAX_LEVEL).map((a) => a.id);
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

function shoot(run, weaponId, x, y, heading, damage, extra = {}) {
  const w = ARMAMENT_WEAPONS[weaponId];
  run.weapons.projectiles.push({
    id: nextId++, weaponId, x, y,
    vx: Math.cos(heading) * w.projectileSpeed, vy: Math.sin(heading) * w.projectileSpeed,
    radius: w.projectileRadius, traveled: 0, maxRange: w.range,
    fuseRemaining: w.kind === 'lobbed' ? w.fuseSeconds : null,
    pierceLeft: w.pierce || 0, hitIds: null, spent: false, damage, ...extra,
  });
}

// Advances every armament. `world` = { grid, tileSize, coast }.
// Returns { fired: [weaponId...], events: [hit events] } — events from the
// Sea Spirit, in resolveHits' shape, for the caller's hit feedback.
export function stepArmaments(run, dt, world, { rng = Math.random, t = 0 } = {}) {
  const fired = []; const events = [];
  if (!run.armaments) return { fired, events };
  run.armTimers ||= {};
  const boat = run.boat;
  const live = run.enemies.filter((e) => e.health > 0 && !e.invulnerable && !e.warded);
  const aimAt = (enemies, weaponId, range) => computeAim(enemies, boat, { id: weaponId, projectileSpeed: ARMAMENT_WEAPONS[weaponId].projectileSpeed || 200, range }, { ...world, counterOf: () => null });
  const ready = (id, cd) => {
    run.armTimers[id] = (run.armTimers[id] ?? cd * 0.5) - dt;
    if (run.armTimers[id] > 0) return false;
    return true;
  };
  const reset = (id, cd) => { run.armTimers[id] = cd; };

  for (const [id, lv] of Object.entries(run.armaments)) {
    const a = ARMAMENT_BY_ID[id]; const i = lv - 1;
    switch (id) {
      case 'swivel_gun': {
        if (!ready(id, a.cooldown[i])) break;
        const aim = aimAt(live, 'arm_swivel', a.range);
        if (!aim) { run.armTimers[id] = 0.1; break; }
        shoot(run, 'arm_swivel', boat.x, boat.y, aim.heading + (rng() - 0.5) * 0.08, a.damage[i]);
        fired.push('arm_swivel'); reset(id, a.cooldown[i]);
        break;
      }
      case 'harpoon': {
        if (!ready(id, a.cooldown[i])) break;
        const aim = aimAt(live, 'arm_harpoon', a.range);
        if (!aim) { run.armTimers[id] = 0.15; break; }
        shoot(run, 'arm_harpoon', boat.x, boat.y, aim.heading, a.damage[i]);
        fired.push('arm_harpoon'); reset(id, a.cooldown[i]);
        break;
      }
      case 'mortar': {
        if (!ready(id, a.cooldown[i])) break;
        // The farthest enemy in reach: the mortar covers what your guns can't.
        let best = null; let bd = 60;
        for (const e of live) { if (!e.aggro) continue; const d = Math.hypot(e.x - boat.x, e.y - boat.y); if (d <= a.range && d > bd) { bd = d; best = e; } }
        if (!best) { run.armTimers[id] = 0.2; break; }
        const heading = Math.atan2(best.y - boat.y, best.x - boat.x);
        shoot(run, 'arm_mortar', boat.x, boat.y, heading, a.damage[i], { fuseRemaining: bd / ARMAMENT_WEAPONS.arm_mortar.projectileSpeed, fuseTotal: bd / ARMAMENT_WEAPONS.arm_mortar.projectileSpeed, blastRadius: a.blast[i], overLand: true });
        fired.push('arm_mortar'); reset(id, a.cooldown[i]);
        break;
      }
      case 'powder_kegs': {
        if (!ready(id, a.cooldown[i])) break;
        if (Math.hypot(boat.vx || 0, boat.vy || 0) < 30) { run.armTimers[id] = 0.1; break; } // only drops under way
        const bx = boat.x - Math.cos(boat.heading) * 16; const by = boat.y - Math.sin(boat.heading) * 16;
        shoot(run, 'arm_keg', bx, by, 0, a.damage[i], { vx: 0, vy: 0, fuseRemaining: a.fuse, fuseTotal: a.fuse, blastRadius: a.blast[i], armDelay: 0.6 });
        fired.push('arm_keg'); reset(id, a.cooldown[i]);
        break;
      }
      case 'stern_chaser': {
        if (!ready(id, a.cooldown[i])) break;
        const hx = Math.cos(boat.heading); const hy = Math.sin(boat.heading);
        const behind = live.filter((e) => (e.x - boat.x) * hx + (e.y - boat.y) * hy < -4);
        const aim = aimAt(behind, 'arm_stern', a.range);
        if (!aim) { run.armTimers[id] = 0.1; break; }
        for (let k = 0; k < a.shots[i]; k++) shoot(run, 'arm_stern', boat.x - hx * 8, boat.y - hy * 8, aim.heading + (k - (a.shots[i] - 1) / 2) * 0.12, a.damage[i]);
        fired.push('arm_stern'); reset(id, a.cooldown[i]);
        break;
      }
      case 'broadside': {
        if (!ready(id, a.cooldown[i])) break;
        if (!live.some((e) => Math.hypot(e.x - boat.x, e.y - boat.y) < a.range * 0.9)) { run.armTimers[id] = 0.2; break; }
        const hx = Math.cos(boat.heading); const hy = Math.sin(boat.heading);
        for (const side of [-1, 1]) {
          const ang = boat.heading + side * Math.PI / 2;
          for (let k = 0; k < a.perSide[i]; k++) {
            const along = (k - (a.perSide[i] - 1) / 2) * 7;
            shoot(run, 'arm_broadside', boat.x + hx * along, boat.y + hy * along, ang, a.damage[i]);
          }
        }
        fired.push('arm_broadside'); reset(id, a.cooldown[i]);
        break;
      }
      case 'sea_spirit': {
        run.spiritAngle = (run.spiritAngle || 0) + a.spin[i] * dt;
        for (const p of spiritPositions(run)) {
          for (const e of live) {
            if ((e._spiritCd || 0) > 0) continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) > e.radius + 7) continue;
            e._spiritCd = 0.45;
            const killed = applyDamageToEnemy(e, a.damage[i]);
            events.push({ enemy: e, weaponId: 'sea_spirit', damage: a.damage[i], killed });
          }
        }
        for (const e of run.enemies) if (e._spiritCd > 0) e._spiritCd -= dt;
        break;
      }
      default: break;
    }
  }
  return { fired, events };
}

export function spiritPositions(run) {
  const lv = armamentLevel(run, 'sea_spirit');
  if (!lv) return [];
  const a = ARMAMENT_BY_ID.sea_spirit; const n = a.count[lv - 1];
  const out = [];
  for (let k = 0; k < n; k++) {
    const ang = (run.spiritAngle || 0) + (k * Math.PI * 2) / n;
    out.push({ x: run.boat.x + Math.cos(ang) * a.orbit, y: run.boat.y + Math.sin(ang) * a.orbit });
  }
  return out;
}

// St Elmo's Fire: every Cannonball hit arcs lightning on to nearby
// enemies. Returns { events, arcs } — arcs are { x1, y1, x2, y2 } for the
// renderer's flash.
export function chainLightning(run, hitEvents) {
  const lv = armamentLevel(run, 'st_elmos_fire');
  const events = []; const arcs = [];
  if (!lv) return { events, arcs };
  const a = ARMAMENT_BY_ID.st_elmos_fire; const i = lv - 1;
  for (const ev of hitEvents) {
    if (ev.weaponId !== 'cannonballs' || ev.blocked || !ev.damage) continue;
    let from = ev.enemy; const hit = new Set([from.id]);
    for (let k = 0; k < a.chains[i]; k++) {
      let best = null; let bd = a.reach;
      for (const e of run.enemies) {
        if (e.health <= 0 || e.invulnerable || e.warded || hit.has(e.id)) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hit.add(best.id);
      const dmg = ev.damage * a.share[i];
      const killed = applyDamageToEnemy(best, dmg);
      events.push({ enemy: best, weaponId: 'st_elmos_fire', damage: dmg, killed });
      arcs.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y });
      from = best;
    }
  }
  return { events, arcs };
}
