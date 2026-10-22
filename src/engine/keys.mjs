// Turning a key in a run (2026-10-22): data/keys.mjs holds the keys; this
// is their charge, their use and their lingering effects. Pure logic over a
// survival run; survivalLoop calls it, main.mjs draws what it reports.

import { KEYS, KEY_CHARGE, KEY_MAX_LEVEL } from '../data/keys.mjs';
import { KEY_PER_POWER, KEY_PER_CHARGE } from '../data/shop.mjs';
import { getEnemy } from '../data/enemies.mjs';
import { applyDamageToEnemy } from './combat.mjs';
import { knockBack } from './survival.mjs';
import { passesOverLand } from './enemies.mjs';

const TAU = Math.PI * 2;
const LORD_SCALE = 0.5; // keys hit warlords and bosses for half (their guard applies on top)

export function keyStats(id, level = 1) {
  const k = KEYS[id] || KEYS.anchor;
  const lv = Math.max(1, Math.min(KEY_MAX_LEVEL, level));
  return { ...k, level: lv, power: 1 + KEY_PER_POWER * (lv - 1), need: Math.round(k.charge * (1 - KEY_PER_CHARGE * (lv - 1))) };
}

export function createKeyState(id = 'anchor', level = 1, chargeMult = 1) {
  const st = keyStats(id, level);
  return { id: st.id, level: st.level, need: st.need, charge: 0, mult: chargeMult, uses: 0, active: [] };
}

export const keyReady = (run) => !!run.key && run.key.charge >= run.key.need;

// Sinks fill the key: the horde a little, specialists more, elites a lot.
export function chargeKey(run, kills) {
  const K = run.key; if (!K) return 0;
  let add = 0;
  for (const e of kills) {
    if (e.isBoss || e.warlord) continue;
    add += e.elite ? KEY_CHARGE.elite : getEnemy(e.defId).horde ? KEY_CHARGE.horde : KEY_CHARGE.special;
  }
  const before = K.charge;
  K.charge = Math.min(K.need, K.charge + add * (K.mult || 1));
  return before < K.need && K.charge >= K.need ? 1 : 0; // 1 on the frame it fills
}

function hit(run, e, dmg, out) {
  if (e.health <= 0 || e.warded) return;
  const d = dmg * ((e.isBoss || e.warlord) ? LORD_SCALE : 1) * (run.sv?.stats?.damageMult ?? 1);
  const killed = applyDamageToEnemy(e, d);
  out.push({ enemy: e, weaponId: 'key', damage: d, killed, keyHit: true });
}

// Turns the key. Returns { kind, x, y, r, heading, arcs } for the effects,
// or null if it isn't charged. Damage events go into `hits`.
export function useKey(run, hits = [], rng = Math.random) {
  const K = run.key; if (!K || K.charge < K.need) return null;
  K.charge = 0; K.uses++;
  const st = keyStats(K.id, K.level); const f = st.fx; const P = st.power;
  const b = run.boat; const fx = { kind: f.kind, key: K.id, x: b.x, y: b.y, r: f.radius || 0, heading: b.heading || 0, colour: st.colour };
  const near = (R) => run.enemies.filter((e) => e.health > 0 && Math.hypot(e.x - b.x, e.y - b.y) <= R + e.radius);
  switch (f.kind) {
    case 'shock':
      for (const e of near(f.radius)) { hit(run, e, f.damage * P, hits); if (!e.isBoss && !e.warlord) knockBack(e, b, f.push); }
      break;
    case 'wave': {
      const h = b.heading || 0;
      for (const e of near(f.radius)) {
        let a = Math.atan2(e.y - b.y, e.x - b.x) - h; a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) > f.arc && Math.hypot(e.x - b.x, e.y - b.y) > 70) continue;
        hit(run, e, f.damage * P, hits);
        if (!e.isBoss && !e.warlord) { e.vx = Math.cos(h) * f.push; e.vy = Math.sin(h) * f.push; e.recoil = 0.6; e.x += Math.cos(h) * 30; e.y += Math.sin(h) * 30; }
      }
      break;
    }
    case 'storm': {
      const list = near(f.radius).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y)).slice(0, f.count);
      fx.arcs = list.map((e) => ({ x1: e.x + (rng() - 0.5) * 30, y1: e.y - 220, x2: e.x, y2: e.y }));
      for (const e of list) hit(run, e, f.damage * P, hits);
      break;
    }
    case 'freeze':
      for (const e of near(f.radius)) {
        hit(run, e, f.damage * P, hits);
        if (e.isBoss || e.warlord) continue;
        e.frozenT = f.seconds * (1 + (P - 1) * 0.5); e.frozenTaken = f.taken;
      }
      break;
    case 'ghost':
      run.dash.iframes = Math.max(run.dash.iframes || 0, f.seconds * (1 + (P - 1) * 0.5));
      K.active.push({ kind: 'pierce', t: f.seconds * (1 + (P - 1) * 0.5), pierce: f.pierce });
      break;
    case 'fire':
      for (let i = 0; i < f.count; i++) {
        const a = (i / f.count) * TAU;
        run.sv.pools.push({ x: b.x + Math.cos(a) * f.ring, y: b.y + Math.sin(a) * f.ring, r: f.pool, t: 0, duration: f.seconds, burn: f.burn * P * (run.sv.stats?.damageMult ?? 1), every: 0.3, tick: 0.05, key: true });
      }
      run.sv.pools.push({ x: b.x, y: b.y, r: f.pool * 1.3, t: 0, duration: f.seconds * 0.6, burn: f.burn * P * (run.sv.stats?.damageMult ?? 1), every: 0.3, tick: 0.05, key: true });
      fx.r = f.ring + f.pool;
      break;
    case 'buff':
      K.active.push({ kind: 'buff', t: f.seconds, reload: f.reload, damage: 1 + (f.damage - 1) * P });
      break;
    case 'aura':
      K.active.push({ kind: 'aura', t: f.seconds, r: f.radius, dps: f.dps * P, tick: 0 });
      fx.r = f.radius;
      break;
    case 'vortex':
      K.active.push({ kind: 'vortex', t: f.seconds, x: b.x, y: b.y, r: f.radius, pull: f.pull, blast: f.blast, damage: f.damage * P });
      break;
    case 'slow':
      for (const e of near(f.radius)) {
        if (e.isBoss || e.warlord) continue;
        if (!e._baseSpeed) { e._baseSpeed = e.speed; e.speed *= f.slow; }
        e._slowT = Math.max(e._slowT || 0, f.seconds);
      }
      K.active.push({ kind: 'sand', t: f.seconds, r: f.radius, dps: f.dps * P, tick: 0 });
      break;
    case 'split':
      K.active.push({ kind: 'split', t: f.seconds * (1 + (P - 1) * 0.5), spread: f.spread });
      break;
    default: break;
  }
  return fx;
}

// The key's lingering effects, each frame. Returns { hits, fx } (fx: a
// vortex bursting).
export function stepKeyEffects(run, dt) {
  const out = { hits: [], fx: [] };
  const K = run.key; if (!K) return out;
  const b = run.boat;
  for (const a of K.active) {
    a.t -= dt;
    if (a.kind === 'aura' || a.kind === 'sand') {
      a.tick -= dt;
      if (a.tick <= 0) {
        a.tick += 0.25;
        for (const e of run.enemies) if (e.health > 0 && Math.hypot(e.x - b.x, e.y - b.y) <= a.r + e.radius) hit(run, e, a.dps * 0.25, out.hits);
      }
    } else if (a.kind === 'vortex') {
      for (const e of run.enemies) {
        if (e.health <= 0 || e.isBoss || e.warlord) continue;
        const dx = a.x - e.x; const dy = a.y - e.y; const d = Math.hypot(dx, dy);
        if (d > a.r || d < 6) continue;
        e.x += (dx / d) * a.pull * dt; e.y += (dy / d) * a.pull * dt;
      }
      if (a.t <= 0) {
        for (const e of run.enemies) if (e.health > 0 && Math.hypot(e.x - a.x, e.y - a.y) <= a.blast + e.radius) hit(run, e, a.damage, out.hits);
        out.fx.push({ kind: 'burst', x: a.x, y: a.y, r: a.blast, colour: KEYS.deep.colour });
      }
    }
  }
  K.active = K.active.filter((a) => a.t > 0);
  // Frozen enemies thaw.
  for (const e of run.enemies) if (e.frozenT > 0) { e.frozenT -= dt; if (e.frozenT <= 0) { e.frozenT = 0; e.frozenTaken = null; } }
  return out;
}

// Buffs the guns read (survival.weaponStats): reload and damage multipliers,
// extra pierce, and whether shots split.
export function keyBuffs(run) {
  const o = { reload: 1, damage: 1, pierce: 0, split: 0 };
  for (const a of run.key?.active || []) {
    if (a.kind === 'buff') { o.reload *= a.reload; o.damage *= a.damage; }
    else if (a.kind === 'pierce') o.pierce += a.pierce;
    else if (a.kind === 'split') o.split = Math.max(o.split, a.spread);
  }
  return o;
}

// Prism Split: every shot fired this frame becomes three.
export function splitShots(run, fromIndex) {
  const s = keyBuffs(run).split; if (!s) return 0;
  const P = run.weapons.projectiles; const end = P.length; let n = 0;
  for (let i = fromIndex; i < end; i++) {
    const p = P[i];
    if (p.fuseRemaining != null || p.split) continue;
    const sp = Math.hypot(p.vx, p.vy); const h = Math.atan2(p.vy, p.vx);
    for (const d of [-s, s]) {
      P.push({ ...p, id: `${p.id}s${d > 0 ? 'b' : 'a'}`, vx: Math.cos(h + d) * sp, vy: Math.sin(h + d) * sp, hitIds: null, split: true });
      n++;
    }
    p.split = true;
  }
  return n;
}

// Frozen enemies hold still (call with positions taken before the AI ran).
export function holdFrozen(enemies, before) {
  for (const [e, x, y] of before) { e.x = x; e.y = y; e.vx = 0; e.vy = 0; if (e.gunTimer != null) e.gunTimer = Math.max(e.gunTimer, 0.3); }
}
export function frozenSnapshot(enemies) {
  const out = [];
  for (const e of enemies) if (e.frozenT > 0 && e.health > 0) out.push([e, e.x, e.y]);
  return out;
}
export { passesOverLand };
