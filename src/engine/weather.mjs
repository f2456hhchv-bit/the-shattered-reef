// Weather and hazards at work (data in data/weather.mjs). Pure logic over a
// run: picks the next event for the level's biome, moves every hazard,
// pushes the boat and the enemies around, and reports what hit whom so the
// game loop can do the feedback. Nothing here draws (engine/weatherArt.mjs).

import { WEATHER, BIOME_WEATHER, WEATHER_TIMING } from '../data/weather.mjs';
import { sampleField } from './terrain.mjs';
import { ARCHETYPES } from '../data/enemies.mjs';

const TAU = Math.PI * 2;
const BOAT_R = 11;
const rand = (rng, [a, b]) => a + rng() * (b - a);

export function createWeather(biomeId, rng = Math.random) {
  return {
    biome: biomeId, timer: rand(rng, WEATHER_TIMING.first), active: null,
    wind: { x: 0, y: 0 }, strikes: [], drops: [], spouts: [], floes: [], lights: [],
    whirl: null, wave: null, flash: 0, coreTick: 0,
  };
}

function pickEvent(biomeId, rng) {
  const table = BIOME_WEATHER[biomeId] || BIOME_WEATHER.tropical;
  const entries = Object.entries(table);
  let r = rng() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of entries) { r -= w; if (r <= 0) return id; }
  return entries[0][0];
}

// Water deep enough at (x, y): `clear` px from any shore.
function isWater(run, x, y, clear) {
  if (x < clear || y < clear || x > run.widthPx - clear || y > run.heightPx - clear) return false;
  return run.coast ? sampleField(run.coast, x, y) < -clear : true;
}

function waterNear(run, rng, from, [dMin, dMax], clear, tries = 80) {
  for (let i = 0; i < tries; i++) {
    const a = rng() * TAU; const d = dMin + rng() * (dMax - dMin);
    const x = from.x + Math.cos(a) * d; const y = from.y + Math.sin(a) * d;
    if (isWater(run, x, y, clear)) return { x, y };
  }
  return null;
}

// Starts event `id` now (the scheduler calls this; so can a test or the
// debug hook). Returns false if the level has no room for it.
export function startWeather(run, id, rng = Math.random) {
  const w = run.weather; const def = WEATHER[id];
  if (!w || !def) return false;
  const boat = run.boat;
  const ev = { id, def, total: rand(rng, def.duration) };
  w.strikes = []; w.drops = []; w.spouts = []; w.floes = []; w.lights = []; w.whirl = null; w.wave = null;
  const a = rng() * TAU;
  w.wind = def.wind ? { x: Math.cos(a) * def.wind, y: Math.sin(a) * def.wind } : { x: 0, y: 0 };
  if (id === 'whirlpool') {
    const p = waterNear(run, rng, boat, [100, 380], 28, 240);
    if (!p) return false;
    w.whirl = { x: p.x, y: p.y, r: def.radius, spin: rng() < 0.5 ? 1 : -1, age: 0 };
  } else if (id === 'rogue_wave') {
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const proj = (x, y) => x * dir.x + y * dir.y;
    const corners = [proj(0, 0), proj(run.widthPx, 0), proj(0, run.heightPx), proj(run.widthPx, run.heightPx)];
    const s0 = Math.min(...corners) - 60; const s1 = Math.max(...corners) + 60;
    w.wave = { dir, s: s0, end: s1, warn: def.warn, hit: new Set() };
    ev.total = def.warn + (s1 - s0) / def.speed;
  } else if (id === 'waterspout') {
    const n = Math.round(rand(rng, def.count));
    for (let i = 0; i < n; i++) {
      const p = waterNear(run, rng, boat, [100, 340], def.radius, 200);
      if (p) w.spouts.push({ x: p.x, y: p.y, heading: rng() * TAU, hitCd: 0, id: i });
    }
    if (!w.spouts.length) return false;
  } else if (id === 'ice_floes' || id === 'wreckage') {
    const n = Math.round(rand(rng, def.count));
    const drift = rng() * TAU;
    for (let i = 0; i < n; i++) {
      const r = rand(rng, def.size);
      const p = waterNear(run, rng, boat, [110, 420], r + 6);
      if (!p) continue;
      const sp = rand(rng, def.drift); const da = drift + (rng() - 0.5) * 0.8;
      const pts = Array.from({ length: 7 }, (_, k) => 0.75 + rng() * 0.35);
      w.floes.push({ x: p.x, y: p.y, vx: Math.cos(da) * sp, vy: Math.sin(da) * sp, r, rot: rng() * TAU, spin: (rng() - 0.5) * 0.4, pts, color: def.colors[i % def.colors.length], age: 0 });
    }
    if (!w.floes.length) return false;
  } else if (id === 'ghost_lights') {
    const n = Math.round(rand(rng, def.count));
    for (let i = 0; i < n; i++) {
      const p = waterNear(run, rng, boat, [90, 360], 14);
      if (p) w.lights.push({ x: p.x, y: p.y, phase: rng() * TAU, taken: false });
    }
    if (!w.lights.length) return false;
  }
  if (def.strikeEvery || def.every) ev.next = 0.6;
  w.active = ev;
  w.time = 0;
  return true;
}

// Everything the weather moves: the boat and every live enemy that sails
// (flyers are above it all; a warding seal is rooted).
function bodies(run) {
  const out = [{ o: run.boat, r: BOAT_R, boat: true }];
  for (const e of run.enemies) {
    if (e.health <= 0 || e.archetype === ARCHETYPES.FLYER || e.archetype === ARCHETYPES.TOTEM || e.archetype === ARCHETYPES.SIREN || e.phased || e.submergedState === 'submerged') continue;
    out.push({ o: e, r: e.radius, boat: false });
  }
  return out;
}

function hurt(res, b, damage, kind, x, y) {
  if (damage <= 0) return;
  if (b.boat) {
    b.o.health = Math.max(0, b.o.health - damage);
    res.boatHits.push({ damage, kind, x: x ?? b.o.x, y: y ?? b.o.y });
  } else {
    const e = b.o;
    if (e.invulnerable || e.warded) return;
    e.health = Math.max(0, e.health - damage);
    res.enemyHits.push({ enemy: e, weaponId: 'weather', damage, killed: e.health <= 0 });
  }
}

// Advances the weather by dt. Returns what happened this step:
// { started, ended, boatHits, enemyHits, strikes, impacts, salvage }.
export function stepWeather(run, dt, rng = Math.random) {
  const res = { started: null, ended: null, boatHits: [], enemyHits: [], strikes: [], impacts: [], salvage: 0 };
  const w = run.weather;
  if (!w) return res;
  w.flash = Math.max(0, w.flash - dt);
  if (!w.active) {
    w.timer -= dt;
    if (w.timer <= 0 && !run.over) {
      let started = false;
      for (let tries = 0; tries < 4 && !started; tries++) started = startWeather(run, pickEvent(w.biome, rng), rng);
      w.timer = rand(rng, WEATHER_TIMING.between);
      if (started) res.started = w.active;
    }
    return res;
  }
  const ev = w.active; const def = ev.def;
  w.time += dt;
  const all = bodies(run);

  // Wind: a steady push (half as much on heavier enemy ships).
  if (w.wind.x || w.wind.y) {
    for (const b of all) { const k = b.boat ? 1 : 0.5; b.o.vx += w.wind.x * k * dt; b.o.vy += w.wind.y * k * dt; }
  }

  // Lightning strikes and falling rock/ice: a marked spot, then impact.
  if (ev.next != null && w.time < ev.total - (def.strikeWarn ?? def.warn ?? 1.2)) {
    ev.next -= dt;
    if (ev.next <= 0) {
      if (def.strikeEvery) {
        ev.next = rand(rng, def.strikeEvery);
        const aimed = rng() < (def.aimed ?? 0.3);
        const p = aimed
          ? { x: run.boat.x + (rng() - 0.5) * 30, y: run.boat.y + (rng() - 0.5) * 30 }
          : waterNear(run, rng, run.boat, [40, 260], 4, 20);
        if (p) { w.strikes.push({ x: p.x, y: p.y, warn: def.strikeWarn, max: def.strikeWarn, r: def.strikeRadius }); res.marks = (res.marks || 0) + 1; }
      } else {
        ev.next = rand(rng, def.every);
        // Near the cliffs, within reach of the boat.
        for (let i = 0; i < 30; i++) {
          const a = rng() * TAU; const d = 30 + rng() * 240;
          const x = run.boat.x + Math.cos(a) * d; const y = run.boat.y + Math.sin(a) * d;
          const depth = run.coast ? -sampleField(run.coast, x, y) : 20;
          if (depth >= def.shoreBand[0] && depth <= def.shoreBand[1]) {
            w.drops.push({ x, y, warn: def.warn, max: def.warn, r: def.radius, spin: rng() * TAU, kind: ev.id });
            break;
          }
        }
      }
    }
  }
  for (const list of [w.strikes, w.drops]) {
    for (const s of list) {
      s.warn -= dt;
      if (s.warn > 0 || s.done) continue;
      s.done = true;
      const dmg = def.strikeDamage ?? def.damage;
      for (const b of all) if (Math.hypot(b.o.x - s.x, b.o.y - s.y) <= s.r + b.r) hurt(res, b, dmg, ev.id, s.x, s.y);
      if (list === w.strikes) { res.strikes.push({ x: s.x, y: s.y }); w.flash = 0.18; }
      else res.impacts.push({ x: s.x, y: s.y, kind: ev.id, r: s.r });
    }
  }
  w.strikes = w.strikes.filter((s) => !s.done);
  w.drops = w.drops.filter((s) => !s.done);

  // Whirlpool: pulls in and around; the eye grinds your hull.
  if (w.whirl) {
    const wh = w.whirl; wh.age += dt;
    const grow = Math.min(1, wh.age / 1.5) * Math.min(1, Math.max(0, (ev.total - w.time) / 1.5));
    wh.strength = grow;
    w.coreTick -= dt;
    const tick = w.coreTick <= 0;
    if (tick) w.coreTick = 0.5;
    for (const b of all) {
      const dx = wh.x - b.o.x; const dy = wh.y - b.o.y; const d = Math.hypot(dx, dy);
      if (d > wh.r || d < 1) continue;
      const f = def.pull * (1 - d / wh.r) * grow * (b.boat ? 1 : 0.6);
      const ux = dx / d; const uy = dy / d;
      b.o.vx += (ux * f - uy * f * def.swirl * wh.spin) * dt;
      b.o.vy += (uy * f + ux * f * def.swirl * wh.spin) * dt;
      if (tick && d < def.core && grow > 0.5) hurt(res, b, def.coreDps * 0.5, ev.id);
    }
  }

  // Rogue wave: a wall of water sweeping across the reef, carrying
  // everything in it along.
  if (w.wave) {
    const wv = w.wave;
    if (wv.warn > 0) wv.warn -= dt;
    else {
      wv.s += def.speed * dt;
      for (const b of all) {
        const p = b.o.x * wv.dir.x + b.o.y * wv.dir.y;
        if (Math.abs(p - wv.s) > def.width / 2) continue;
        const along = b.o.vx * wv.dir.x + b.o.vy * wv.dir.y;
        const target = def.speed * (b.boat ? 0.85 : 0.7);
        if (along < target) { b.o.vx += wv.dir.x * (target - along); b.o.vy += wv.dir.y * (target - along); }
        if (!wv.hit.has(b.o)) { wv.hit.add(b.o); hurt(res, b, def.damage, ev.id); }
      }
    }
  }

  // Waterspouts wander, pull, and spin whatever they catch.
  for (const sp of w.spouts) {
    sp.heading += (rng() - 0.5) * 2.4 * dt;
    const nx = sp.x + Math.cos(sp.heading) * def.speed * dt; const ny = sp.y + Math.sin(sp.heading) * def.speed * dt;
    if (isWater(run, nx, ny, def.radius * 0.6)) { sp.x = nx; sp.y = ny; } else sp.heading += Math.PI * (0.6 + rng() * 0.8);
    sp.hitCd = Math.max(0, sp.hitCd - dt);
    for (const b of all) {
      const dx = sp.x - b.o.x; const dy = sp.y - b.o.y; const d = Math.hypot(dx, dy);
      if (d > def.pullRadius || d < 1) continue;
      const f = def.pull * (1 - d / def.pullRadius);
      b.o.vx += (dx / d) * f * dt; b.o.vy += (dy / d) * f * dt;
      if (d < def.radius + b.r && (b.boat ? sp.hitCd <= 0 : !(b.o._spoutCd > 0))) {
        hurt(res, b, def.damage, ev.id);
        if (b.boat) { sp.hitCd = def.hitEvery; b.o.turnJamRemaining = Math.max(b.o.turnJamRemaining || 0, 0.6); } else b.o._spoutCd = def.hitEvery;
      }
    }
  }
  for (const e of run.enemies) if (e._spoutCd > 0) e._spoutCd -= dt;

  // Floes and wreckage drift, bounce off the shore, and knock you about.
  for (const fl of w.floes) {
    fl.age += dt; fl.rot += fl.spin * dt;
    const nx = fl.x + fl.vx * dt; const ny = fl.y + fl.vy * dt;
    if (isWater(run, nx, ny, fl.r * 0.7)) { fl.x = nx; fl.y = ny; } else { fl.vx = -fl.vx; fl.vy = -fl.vy; }
    for (const b of all) {
      const dx = b.o.x - fl.x; const dy = b.o.y - fl.y; const d = Math.hypot(dx, dy);
      const min = fl.r + b.r;
      if (d >= min || d < 0.01) continue;
      const ux = dx / d; const uy = dy / d;
      b.o.x = fl.x + ux * min; b.o.y = fl.y + uy * min;
      const rel = (b.o.vx - fl.vx) * ux + (b.o.vy - fl.vy) * uy; // negative = moving into the floe
      if (rel < 0) {
        b.o.vx -= rel * ux * 1.4; b.o.vy -= rel * uy * 1.4;
        if (-rel > 45) hurt(res, b, (-rel - 45) * def.damagePerSpeed * (b.boat ? 1 : 2), ev.id, fl.x, fl.y);
      }
    }
  }

  // Ghost lights: sail through them for Salvage.
  for (const l of w.lights) {
    if (l.taken) continue;
    l.phase += dt;
    l.x += Math.cos(l.phase * 0.7) * 8 * dt; l.y += Math.sin(l.phase * 0.9) * 8 * dt;
    if (Math.hypot(l.x - run.boat.x, l.y - run.boat.y) <= def.radius + BOAT_R) { l.taken = true; res.salvage += def.salvage; }
  }

  if (w.time >= ev.total) {
    res.ended = ev;
    w.active = null; w.whirl = null; w.wave = null; w.spouts = []; w.floes = []; w.lights = []; w.strikes = []; w.drops = [];
    w.wind = { x: 0, y: 0 };
  }
  return res;
}

// How the current weather changes play and the view. `fade` eases the
// overlays in and out over the first/last two seconds.
export function weatherModifiers(w) {
  const none = { sight: 1, turn: 1, view: null, rain: 0, snow: 0, dark: 0, fog: 0, fogColor: null, fade: 0 };
  if (!w || !w.active) return none;
  const d = w.active.def;
  const fade = Math.min(1, w.time / 2, Math.max(0, (w.active.total - w.time) / 2));
  const k = (v, base) => base + (v - base) * fade;
  return {
    sight: k(d.sight ?? 1, 1),
    turn: k(d.turn ?? 1, 1),
    view: d.view ? d.view / Math.max(0.05, fade) : null,
    rain: (d.rain || 0) * fade,
    snow: (d.snow || 0) * fade,
    dark: (d.dark || 0) * fade,
    fog: (d.view ? 1 : (d.fog || 0)) * fade,
    fogColor: d.fogColor || null,
    fade,
  };
}
