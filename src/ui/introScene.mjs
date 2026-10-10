// The opening scene (2026-10-05, redone for the V3 art direction): a short
// chase drawn entirely with the game's own art. A Tropical reef from the
// real terrain renderer; your painted Sloop running a channel with two
// pirate ships on its tail; cannon fire both ways; one pirate goes down;
// a shark circles and a sea serpent breaks the surface. The title and
// loading bar sit on top (ui/intro.mjs).
//
// build() is the slow part (~100-250ms): ui/intro.mjs runs it after the
// first frame is up and starts this scene's clock when it's done.

import { makeSeededRng } from '../engine/rng.mjs';
import { buildArenaGrid } from '../engine/arena.mjs';
import { buildCoastField, buildTerrain, sampleField } from '../engine/terrain.mjs';
import { createTerrainRenderer } from '../engine/terrainRenderer.mjs';
import { getBiome, BIOME_IDS } from '../data/biomes.mjs';
import { drawBoat, drawEnemyBody, drawParticles } from '../engine/renderer.mjs';
import { spawnSplash, spawnExplosion, updateParticles } from '../engine/juice.mjs';

const TILE = 16;
const SPEED = 54; // px/s, the Sloop's run
const SEED = 20736145; // first seed with a clear diagonal run down the screen (searched from 20261005)

function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function ease(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

// The scripted beats, in scene seconds.
const BEATS = {
  enemyShots: [1.6, 2.5, 4.9],
  playerShots: [3.0, 3.45, 3.9],
  cutterSinks: 4.25,
  serpentRise: 4.4,
};

export function buildIntroScene(dpr = 1) {
  const biome = getBiome(BIOME_IDS.TROPICAL);
  // The chase needs a long clear run out of the centre: ~9.5s of sailing
  // with a lane ±56px wide for the weave and the pursuers. Try a few fixed
  // seeds and keep the first that has one (deterministic either way).
  const NEED = 9.5 * SPEED - 150 + 30;
  let pick = null;
  for (let k = 0; k < 80 && !(pick?.ok && Math.sin(pick.a) > 0.25 && Math.abs(Math.sin(2 * pick.a)) > 0.8); k++) {
    const seed = SEED + k * 7919;
    const arena = buildArenaGrid(makeSeededRng(seed), BIOME_IDS.TROPICAL, { size: 84, centreClear: 9, seaIslands: 0 });
    const coast = buildCoastField(arena.grid, TILE, seed >>> 3);
    const c = { x: (arena.grid.width * TILE) / 2, y: (arena.grid.height * TILE) / 2 };
    const clear = (x, y, ang) => [-56, -28, 0, 28, 56].every((o) => sampleField(coast, x - Math.sin(ang) * o, y + Math.cos(ang) * o) < -18);
    for (let j = 0; j < 48; j++) {
      const ang = (j / 48) * Math.PI * 2;
      let ok = true;
      for (let d = -170; d < 0 && ok; d += 8) ok = clear(c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d, ang);
      if (!ok) continue;
      let len = 0;
      while (len < 1000 && clear(c.x + Math.cos(ang) * len, c.y + Math.sin(ang) * len, ang)) len += 8;
      // Prefer diagonal runs heading down the screen: the painted ships
      // show their bows and sails coming toward the camera.
      const score = Math.min(len, NEED) * (Math.abs(Math.sin(2 * ang)) > 0.8 ? 1 : 0.4) * (Math.sin(ang) > 0.25 ? 1 : 0.5);
      if (!pick || (len >= NEED && !pick.ok) || ((len >= NEED) === pick.ok && score > pick.score)) {
        pick = { seed, arena, coast, a: ang, score, ok: len >= NEED };
      }
    }
  }
  const { arena, coast } = pick;
  const terrain = buildTerrain(arena.grid, TILE, pick.seed >>> 3, biome, coast, { shoals: true });
  const renderer = createTerrainRenderer(terrain, biome, { res: Math.min(1.5, dpr) });
  const W = arena.grid.width * TILE; const H = arena.grid.height * TILE;
  const centre = { x: W / 2, y: H / 2 };
  const best = pick;
  const dir = { x: Math.cos(best.a), y: Math.sin(best.a) };
  const side = { x: -dir.y, y: dir.x };
  const start = { x: centre.x - dir.x * 150, y: centre.y - dir.y * 150 };
  const along = (s, lat = 0) => ({ x: start.x + dir.x * s + side.x * lat, y: start.y + dir.y * s + side.y * lat });
  // A gentle weave so headings change and the sprites show their turns.
  const weave = (t, amp = 22, f = 0.55, ph = 0) => Math.sin(t * f + ph) * amp;

  const scene = {
    renderer, terrain, biome, W, H, dir, side, along, weave,
    particles: [], shots: [], wakes: [], lastT: 0, fired: new Set(),
    sinkT: null, prepared: false,
  };
  return scene;
}

function shipAt(sc, t, lag, lat, ph) {
  const s = Math.max(0, t - lag) * SPEED;
  const w = sc.weave(t - lag, 22, 0.55, ph);
  const p = sc.along(s, lat + w);
  const p2 = sc.along(s + 6, lat + sc.weave(t - lag + 6 / SPEED, 22, 0.55, ph));
  return { x: p.x, y: p.y, heading: Math.atan2(p2.y - p.y, p2.x - p.x) };
}

// One frame. `t` is scene time (s); returns the camera centre so the
// caller can hand it to the terrain prewarmer.
export function drawIntroScene(ctx, sc, w, h, t, now) {
  const dt = Math.min(0.05, Math.max(0, t - sc.lastT)); sc.lastT = t;
  const player = shipAt(sc, t, 0, 0, 0);
  const cutter = shipAt(sc, t, 0.9, -24, 1.3);
  const brig = shipAt(sc, t, 1.45, 28, 2.2);
  const shark = (() => {
    const c = sc.along(SPEED * 3.4, -62);
    const a = t * 1.1;
    return { x: c.x + Math.cos(a) * 52, y: c.y + Math.sin(a) * 34, vx: -Math.sin(a) * 50, vy: Math.cos(a) * 34 };
  })();
  const serp = sc.along(SPEED * (BEATS.serpentRise + 2.6), 44);

  // Camera: leads the Sloop, eases in from a wider shot.
  // The Sloop sits a little below centre, under the title.
  const zoom = Math.min(2.2, Math.max(1.05, Math.min(w, h) / 300)) * (0.8 + 0.2 * ease(t / 3.2));
  const cx = player.x - sc.dir.x * 12; const cy = player.y - sc.dir.y * 12 - (h * (w > h ? 0.2 : 0.1)) / zoom;
  const visible = { left: cx - w / 2 / zoom, right: cx + w / 2 / zoom, top: cy - h / 2 / zoom, bottom: cy + h / 2 / zoom };

  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
  sc.renderer.draw(ctx, visible, t, { forceVisible: !sc.prepared, maxNewChunks: 2 });
  sc.prepared = true;

  // Lasting foam wakes behind every hull.
  if (dt > 0) {
    for (const s of [player, brig, sc.sinkT == null ? cutter : null]) {
      if (s) sc.wakes.push({ x: s.x - Math.cos(s.heading) * 14, y: s.y - Math.sin(s.heading) * 14, life: 1.6 });
    }
  }
  for (const k of sc.wakes) k.life -= dt;
  sc.wakes = sc.wakes.filter((k) => k.life > 0);
  for (const k of sc.wakes) {
    ctx.fillStyle = `rgba(235, 250, 252, ${0.22 * k.life / 1.6})`;
    ctx.beginPath(); ctx.ellipse(k.x, k.y, 4 + (1.6 - k.life) * 7, 2.5 + (1.6 - k.life) * 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  // The shark circles ahead (visible from the start, a hint of danger).
  ctx.save(); ctx.translate(shark.x, shark.y);
  drawEnemyBody(ctx, { x: shark.x, y: shark.y, vx: shark.vx, vy: shark.vy, radius: 12, id: 7, defId: 'reef_shark', aggro: true }, '#5f7f99', t);
  ctx.restore();

  // The serpent breaks the surface beside the run.
  const su = (t - BEATS.serpentRise) / 2.6;
  if (su > 0 && su < 1) {
    const rise = Math.sin(su * Math.PI);
    ctx.save(); ctx.globalAlpha = Math.min(1, rise * 1.6);
    ctx.translate(serp.x, serp.y);
    drawEnemyBody(ctx, { x: serp.x, y: serp.y, vx: -sc.dir.x * 20, vy: -sc.dir.y * 20, radius: 15, id: 3, defId: 'sea_serpent', aggro: true }, '#3fa37f', t);
    ctx.restore();
    ctx.strokeStyle = `rgba(240, 252, 255, ${0.6 * rise})`; ctx.lineWidth = 2;
    for (let r = 0; r < 2; r++) { ctx.beginPath(); ctx.ellipse(serp.x, serp.y, 22 + r * 12 + su * 18, 12 + r * 6 + su * 9, 0, 0, Math.PI * 2); ctx.stroke(); }
  }

  // Cannon fire: scripted volleys, real splashes.
  const fire = (key, from, to, miss) => {
    if (sc.fired.has(key)) return;
    sc.fired.add(key);
    const tx = to.x + (miss ? sc.side.x * miss : 0); const ty = to.y + (miss ? sc.side.y * miss : 0);
    sc.shots.push({ x: from.x, y: from.y, sx: from.x, sy: from.y, tx, ty, age: 0, dur: 0.55, hit: !miss });
    spawnSplash(sc.particles, from.x, from.y, Math.random, 3);
  };
  for (const at of BEATS.enemyShots) if (t > at) fire(`e${at}`, at < 4 ? cutter : brig, player, at === 2.5 ? -22 : 20);
  for (const at of BEATS.playerShots) if (t > at && t < BEATS.cutterSinks + 0.2) fire(`p${at}`, player, cutter, at === 3.0 ? 14 : 0);
  for (const s of sc.shots) {
    s.age += dt;
    const k = clamp01(s.age / s.dur);
    s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 18;
    if (k >= 1 && !s.done) {
      s.done = true;
      spawnSplash(sc.particles, s.tx, s.ty, Math.random, s.hit ? 8 : 10);
      if (s.hit) spawnExplosion(sc.particles, s.tx, s.ty, 10);
    }
  }
  sc.shots = sc.shots.filter((s) => !s.done);

  // Ships, back to front.
  const sinking = t > BEATS.cutterSinks;
  if (sinking && sc.sinkT == null) { sc.sinkT = t; spawnExplosion(sc.particles, cutter.x, cutter.y, 26); }
  const ships = [
    { s: brig, id: 'pirate_brig', r: 12, c: '#5a2a22' },
    { s: sc.sinkT != null ? sc.sunk ||= { ...cutter } : cutter, id: 'pirate_cutter', r: 10, c: '#3a2a2a', sinking: sc.sinkT != null },
  ].sort((a, b) => a.s.y - b.s.y);
  for (const e of ships) {
    const st = e.sinking ? clamp01((t - sc.sinkT) / 1.6) : 0;
    if (st >= 1) continue;
    ctx.save();
    ctx.translate(e.s.x, e.s.y + st * 6);
    ctx.globalAlpha = 1 - st;
    if (st > 0) ctx.rotate(st * 0.5);
    drawEnemyBody(ctx, { x: e.s.x, y: e.s.y, vx: Math.cos(e.s.heading) * 40, vy: Math.sin(e.s.heading) * 40, radius: e.r, id: e.r, defId: e.id, aggro: true }, e.c, t);
    ctx.restore();
  }
  drawBoat(ctx, { x: player.x, y: player.y, heading: player.heading, vx: Math.cos(player.heading) * SPEED, vy: Math.sin(player.heading) * SPEED, style: 'sloop' }, 11, t);
  // Muzzle flashes at the moment of firing.
  for (const at of BEATS.playerShots) {
    const ft = t - at;
    if (ft > 0 && ft < 0.15 && t < BEATS.cutterSinks + 0.2) {
      ctx.fillStyle = `rgba(255, 220, 140, ${1 - ft / 0.15})`;
      ctx.beginPath(); ctx.arc(player.x + sc.side.x * -12, player.y + sc.side.y * -12, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Shot balls with a little shadow.
  for (const s of sc.shots) {
    ctx.fillStyle = 'rgba(4, 30, 40, 0.3)'; ctx.beginPath(); ctx.arc(s.sx + (s.tx - s.sx) * clamp01(s.age / s.dur), s.sy + (s.ty - s.sy) * clamp01(s.age / s.dur), 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1b1f'; ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  updateParticles(sc.particles, dt);
  drawParticles(ctx, sc.particles);
  ctx.restore();

  // Grade: night lifting to a warm morning, plus a vignette.
  const dawn = ease(t / 3);
  ctx.fillStyle = `rgba(6, 14, 34, ${0.62 * (1 - dawn)})`; ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.85, -h * 0.05, 0, w * 0.85, -h * 0.05, Math.max(w, h) * 0.9);
  sun.addColorStop(0, `rgba(255, 200, 120, ${0.22 * dawn})`); sun.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 10, 20, 0)'); vig.addColorStop(1, 'rgba(0, 10, 20, 0.55)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
  return { x: cx, y: cy };
}
