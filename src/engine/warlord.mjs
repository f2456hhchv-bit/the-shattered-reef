// Warlords and bosses with signature moves (2026-10-04, project owner:
// "Boss needs to be a bit more 'special' each level"). Pure logic.
//
// Wave 10 brings a warlord on levels 1-4 and the stage boss on level 5.
// Each gets a kit of traits that grows level by level, so the last fight
// of every level is bigger than the one before. Every move is telegraphed:
//   escort — calls in a ring of its crew
//   nova   — winds up (a tightening red ring), then fires a full ring of shot
//   charge — marks a lane at you, then rams down it
//   shield — at 2/3 and 1/3 hull, raises a ward for a few seconds and calls
//            its crew; shots glance off until it drops
// Traits go on the enemy as `e.lord`; survivalLoop steps them after the
// normal enemy AI. Nothing here draws (engine/warlordArt.mjs does).

import { resolveCoastCollision } from './boat.mjs';

const TAU = Math.PI * 2;

// What each level's final enemy brings (level index 0-4; 4 = the boss).
export const LORD_KITS = Object.freeze([
  ['escort'],
  ['escort', 'nova'],
  ['nova', 'charge'],
  ['escort', 'nova', 'charge'],
  ['escort', 'nova', 'shield'], // the stage boss, on top of its own phases
]);

export const LORD_TRAITS = Object.freeze({
  escort: { icon: '⚔️', name: 'Calls its crew', every: [10, 12], count: 5 },
  nova: { icon: '💥', name: 'Ring of shot', every: [6, 7.5], windup: 1.1, count: 14, speed: 140, damage: 8 },
  charge: { icon: '🐂', name: 'Rams', every: [6.5, 8], windup: 0.95, speed: 330, time: 0.65, damage: 16, width: 26 },
  shield: { icon: '🛡️', name: 'Ward at ⅔ and ⅓ hull', at: [0.66, 0.33], time: 3.5 },
});

const TITLES = ['Blackhand', 'Redsail', 'Ironjaw', 'the Drowned', 'Grimtide', 'Saltbeard', 'the Widowmaker', 'Stormcrow', 'Barnacle Bill', 'Scourge', 'the Hollow', 'Cutlass Kate'];

function range(rng, [a, b]) { return a + rng() * (b - a); }

// Gives a warlord/boss its kit. Harder stages add one extra nova shot per
// two stages and shorten the cooldowns a touch.
export function initLord(e, { levelIndex = 0, stage = 1, boss = false }, rng = Math.random) {
  const kit = LORD_KITS[boss ? 4 : Math.min(3, levelIndex)];
  const pace = 1 / (1 + Math.min(0.3, (stage - 1) * 0.03));
  const lord = {
    kit: [...kit], pace, extraShots: Math.min(6, Math.floor((stage - 1) / 2)),
    title: boss ? null : TITLES[(stage * 5 + levelIndex * 3 + Math.floor(rng() * 3)) % TITLES.length],
    timers: {}, novaWindup: 0, novaSpin: rng() * TAU,
    charge: null, // { state: 'aim' | 'run', t, ax, ay, dx, dy }
    shieldsLeft: kit.includes('shield') ? [...LORD_TRAITS.shield.at] : [], shieldTime: 0,
  };
  for (const k of kit) if (LORD_TRAITS[k].every) lord.timers[k] = range(rng, LORD_TRAITS[k].every) * pace * 0.6;
  e.lord = lord;
  return lord;
}

export function lordName(e, baseName) {
  return e.lord?.title ? `${e.lord.title} · ${baseName}` : baseName;
}

// Steps one lord. `spawnCrew(x, y)` puts a horde enemy at a point (or
// returns null). Pushes enemy shots into `shots`. Returns events:
// { escort, nova, chargeStart, rammed: damage, shieldUp, shieldDown }.
export function stepLord(run, e, dt, rng, spawnCrew, shots, boatRadius = 11) {
  const L = e.lord;
  const out = {};
  if (!L || e.health <= 0) return out;
  const boat = run.boat;
  const fast = e.enraged ? 0.7 : 1;

  // Shield: thresholds on hull.
  if (L.shieldTime > 0) {
    L.shieldTime -= dt;
    e.warded = true;
    if (L.shieldTime <= 0) { e.warded = false; out.shieldDown = true; }
  } else if (L.shieldsLeft.length && e.health / e.maxHealth <= L.shieldsLeft[0]) {
    L.shieldsLeft.shift();
    L.shieldTime = LORD_TRAITS.shield.time;
    e.warded = true;
    out.shieldUp = true;
    out.escort = callCrew(e, spawnCrew, LORD_TRAITS.escort.count + 2);
  }

  for (const k of L.kit) {
    const T = LORD_TRAITS[k];
    if (!T.every) continue;
    if (k === 'nova' && L.novaWindup > 0) continue;
    if (k === 'charge' && L.charge) continue;
    L.timers[k] -= dt / fast;
    if (L.timers[k] > 0) continue;
    L.timers[k] = range(rng, T.every) * L.pace;
    if (k === 'escort') out.escort = callCrew(e, spawnCrew, T.count);
    else if (k === 'nova') { L.novaWindup = T.windup; L.novaMax = T.windup; }
    else if (k === 'charge') {
      // Mark the lane at where you are now; the lord holds still to aim.
      L.charge = { state: 'aim', t: T.windup, hx: e.x, hy: e.y, ax: boat.x, ay: boat.y };
      out.chargeStart = true;
    }
  }

  if (L.novaWindup > 0) {
    L.novaWindup -= dt;
    if (L.novaWindup <= 0) {
      L.novaWindup = 0;
      const T = LORD_TRAITS.nova;
      const n = T.count + L.extraShots + (e.enraged ? 4 : 0);
      L.novaSpin += 0.37;
      for (let i = 0; i < n; i++) {
        const a = L.novaSpin + (i / n) * TAU;
        shots.push({
          id: `L${e.id}-${Math.floor(rng() * 1e9)}`, x: e.x + Math.cos(a) * e.radius, y: e.y + Math.sin(a) * e.radius,
          vx: Math.cos(a) * T.speed, vy: Math.sin(a) * T.speed, radius: 5, damage: T.damage * (e.damageScale || 1),
          life: 2.6, kind: 'heavy', faction: e.faction, sourceId: e.id, lordShot: true,
        });
      }
      out.nova = n;
    }
  }

  const C = L.charge;
  if (C) {
    const T = LORD_TRAITS.charge;
    if (C.state === 'aim') {
      C.t -= dt;
      e.x = C.hx; e.y = C.hy; e.vx = 0; e.vy = 0; // braced
      // The mark follows you a little, then locks for the last 0.35s.
      if (C.t > 0.35) { C.ax += (boat.x - C.ax) * Math.min(1, dt * 3); C.ay += (boat.y - C.ay) * Math.min(1, dt * 3); }
      if (C.t <= 0) {
        const d = Math.hypot(C.ax - e.x, C.ay - e.y) || 1;
        C.dx = (C.ax - e.x) / d; C.dy = (C.ay - e.y) / d;
        C.state = 'run'; C.t = T.time; C.hit = false;
        e.heading = Math.atan2(C.dy, C.dx);
      }
    } else {
      C.t -= dt;
      e.vx = C.dx * T.speed; e.vy = C.dy * T.speed;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.heading = Math.atan2(C.dy, C.dx);
      const impact = run.coast && !e.flies ? resolveCoastCollision(e, e.radius, run.coast) : 0;
      if (!C.hit && Math.hypot(boat.x - e.x, boat.y - e.y) <= e.radius + boatRadius + 4) {
        C.hit = true;
        out.rammed = T.damage * (e.damageScale || 1);
        // Shove the boat aside.
        boat.vx += C.dx * 140; boat.vy += C.dy * 140;
      }
      if (C.t <= 0 || impact > 60) { L.charge = null; e.vx *= 0.3; e.vy *= 0.3; if (impact > 60) out.chargeCrash = true; }
    }
  }
  return out;
}

function callCrew(e, spawnCrew, n) {
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    if (spawnCrew(e.x + Math.cos(a) * (e.radius + 34), e.y + Math.sin(a) * (e.radius + 34))) k++;
  }
  return k;
}
