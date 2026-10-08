// Juice — step 8: particles, screen shake, hit-stop, and floating damage
// numbers. Pure logic (spawn/update return/mutate plain arrays and small
// state objects, no DOM/Canvas calls), mirroring boat.mjs/combat.mjs's
// split — drawing lives in renderer.mjs, wiring lives in main.mjs.

let nextParticleId = 1;
let nextDamageNumberId = 1;

// --- Particles -------------------------------------------------------------
// One flat pool of {x,y,vx,vy,life,maxLife,size,color,drag}. No per-effect
// classes — every spawn* function below is just a tuned preset over the
// same particle shape, so updateParticles/drawParticles stay generic.

export function createParticlePool() {
  return [];
}

function spawnParticle(pool, opts) {
  pool.push({
    id: nextParticleId++,
    x: opts.x, y: opts.y,
    vx: opts.vx, vy: opts.vy,
    life: opts.life, maxLife: opts.life,
    size: opts.size, color: opts.color,
    drag: opts.drag ?? 3,
  });
}

// A weapon-colored burst on a non-kill hit — the everyday "that landed"
// feedback for every shot, direct or AoE.
export function spawnHitSpark(pool, x, y, color, rng = Math.random, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 40 + rng() * 90;
    spawnParticle(pool, {
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.22 + rng() * 0.15, size: 1.5 + rng() * 1.5,
      color, drag: 5,
    });
  }
}

// A bigger, two-tone burst (weapon color + a bright flash tone) on a kill —
// meant to read as distinctly more satisfying than a regular hit.
export function spawnKillBurst(pool, x, y, color, rng = Math.random) {
  spawnHitSpark(pool, x, y, color, rng, 14);
  for (let i = 0; i < 8; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 15 + rng() * 35;
    spawnParticle(pool, {
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.4 + rng() * 0.3, size: 2.5 + rng() * 2,
      color: '#f4ead0', drag: 1.8,
    });
  }
}

// A fiery ring for Depth Charges' AoE detonation — bigger radius, bigger
// burst, so an off-screen-ish blast still reads clearly.
export function spawnExplosion(pool, x, y, radius, rng = Math.random) {
  // The toy explosion strip (engine/fxSprites.mjs) is the blast itself; its
  // frames grow, so `size` is the half-width of the whole animation. A few
  // embers fly out on top.
  pool.push({
    id: nextParticleId++, sprite: 'explosion', x, y, vx: 0, vy: 0,
    life: 0.42 + Math.min(0.2, radius / 250), maxLife: 0, size: Math.max(14, radius * 1.25),
    rot: rng() * Math.PI * 2, color: '#e8b54b', drag: 0,
  });
  pool[pool.length - 1].maxLife = pool[pool.length - 1].life;
  const count = Math.max(4, Math.round(radius / 4));
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = radius * (1.3 + rng() * 1.2);
    spawnParticle(pool, {
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.3 + rng() * 0.25, size: 2 + rng() * 3,
      color: rng() < 0.5 ? '#e8b54b' : '#d9503f', drag: 2.5,
    });
  }
}

// A small pale splash — wall impacts and the boat's idle wake trail.
export function spawnSplash(pool, x, y, rng = Math.random, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 15 + rng() * 45;
    spawnParticle(pool, {
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.3 + rng() * 0.2, size: 1 + rng() * 2,
      color: 'rgba(191, 228, 240, 0.8)', drag: 3.5,
    });
  }
}

export function updateParticles(pool, dt) {
  for (const p of pool) {
    p.life -= dt;
    const dragFactor = Math.max(0, 1 - p.drag * dt);
    p.vx *= dragFactor;
    p.vy *= dragFactor;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  return pool.filter((p) => p.life > 0);
}

// --- Floating damage numbers -------------------------------------------------

export function createDamageNumberPool() {
  return [];
}

export function spawnDamageNumber(pool, x, y, amount, options = {}) {
  pool.push({
    id: nextDamageNumberId++,
    x: x + (options.jitterX ?? 0),
    y,
    amount: Math.max(1, Math.round(amount)),
    vy: -30,
    // Triangle-tagged numbers live a little longer — they carry a second
    // piece of information (the matchup) that needs a moment to register.
    life: options.triangle ? 0.9 : 0.7,
    maxLife: options.triangle ? 0.9 : 0.7,
    crit: !!options.crit, // "on-counter" hit — drawn larger/gold
    // Post-slice combat-triangle feedback: 'advantage' | 'disadvantage' |
    // null/undefined (no faction chosen, a mirror match, or the
    // faction-less boss) — drawn as a distinct color + a small glyph,
    // independent of (and can combine with) the crit/on-counter styling.
    triangle: options.triangle || null,
    // Damage the PLAYER took (drawn over the boat, as a loss) rather than
    // damage dealt. With it, triangle is 'danger' (your predator hit you,
    // amplified) | 'resist' (your prey hit you, softened) | null.
    incoming: !!options.incoming,
    heal: !!options.heal, // hull repaired (green "+N")
  });
}

export function updateDamageNumbers(pool, dt) {
  for (const d of pool) {
    d.life -= dt;
    d.vy += 55 * dt; // decelerates then gently falls back, reads as a "pop"
    d.y += d.vy * dt;
  }
  return pool.filter((d) => d.life > 0);
}

// --- Screen shake ------------------------------------------------------------
// Trauma-based (the standard "squared falloff" approach): small hits barely
// move the camera, big hits/kills/wall rams punch harder, and it always
// decays back to 0 rather than needing an explicit "shake done" callback.

export function createShake() {
  return { trauma: 0 };
}

export function addShake(shake, amount) {
  shake.trauma = Math.min(1, shake.trauma + amount);
}

export function updateShake(shake, dt, rng = Math.random) {
  shake.trauma = Math.max(0, shake.trauma - dt * 2.2);
  const power = shake.trauma * shake.trauma;
  return {
    x: (rng() * 2 - 1) * 10 * power,
    y: (rng() * 2 - 1) * 10 * power,
  };
}

// --- Hit-stop ----------------------------------------------------------------
// A brief full freeze of gameplay simulation on a big impact (a kill, a
// hard wall ram) — makes the moment read rather than blurring past at 60fps.
// `applyHitStop` is the one call site: it hands back the dt the caller
// should actually simulate with this frame (0 while frozen) and always
// advances the freeze countdown using the real, unscaled frame time, so a
// freeze can't get "stuck" regardless of what dt the caller passes in.

export function createHitStop() {
  return { remaining: 0 };
}

export function triggerHitStop(hitStop, seconds) {
  hitStop.remaining = Math.max(hitStop.remaining, seconds);
}

export function applyHitStop(hitStop, realDt) {
  if (hitStop.remaining > 0) {
    hitStop.remaining = Math.max(0, hitStop.remaining - realDt);
    return 0;
  }
  return realDt;
}

// --- Damage-number visual language (2026-09-28 legibility pass) ----------
// Pure, so the rules are unit-tested (tests/juice.test.mjs) rather than
// left to taste; renderer.mjs only draws what this returns. The language:
//   * RED (with a minus sign) means damage YOU took — nothing else is red.
//     Its glyph: ▲ your predator hit harder, ▼ your prey hit softer.
//   * The NUMBER colour of damage you dealt reports the weapon match:
//     gold = counter weapon, cream = anything else (unchanged from step 8).
//   * A separately coloured GLYPH reports the faction match: cyan ▲ =
//     amplified against your prey, grey ▼ = resisted by your predator.
//     (Before: the whole number was tinted, a resisted hit became dark red
//     on dark water — near-invisible — and red meant two opposite things.)
//   * Every number has a dark outline so it reads on water, deep water and
//     rock alike, and amplified numbers (yours or theirs) pop in larger.
export const DAMAGE_NUMBER_COLORS = Object.freeze({
  normal: '#f2e8d0',
  counter: '#ffc94d',
  favored: '#5ff2d6',
  resisted: '#b3bdc8',
  hurt: '#ff6b5b',
  hurtDanger: '#ff5c4e', // was #ff4d40; lifted to clear 3:1 on the tropical deep water (2026-09-28)
  hurtResist: '#ff9d8f',
  heal: '#7dff8a',
  outline: '#07131c',
});

export function damageNumberStyle(d) {
  const C = DAMAGE_NUMBER_COLORS;
  const age = d.maxLife - d.life;
  const amplified = d.triangle === 'advantage' || d.triangle === 'danger';
  const pop = amplified ? 1 + 0.4 * Math.max(0, 1 - age / 0.18) : 1;
  let size;
  const parts = [];
  if (d.heal) {
    size = 16;
    parts.push({ text: `+${d.amount}`, color: C.heal });
  } else if (d.incoming) {
    size = d.triangle === 'danger' ? 17 : 14;
    const color = d.triangle === 'danger' ? C.hurtDanger : d.triangle === 'resist' ? C.hurtResist : C.hurt;
    parts.push({ text: `-${d.amount}`, color });
    if (d.triangle === 'danger') parts.push({ text: '\u25B2', color });
    if (d.triangle === 'resist') parts.push({ text: '\u25BC', color });
  } else {
    size = (d.crit ? 17 : 13) + (d.triangle === 'advantage' ? 2 : 0);
    parts.push({ text: String(d.amount), color: d.crit ? C.counter : C.normal });
    if (d.triangle === 'advantage') parts.push({ text: '\u25B2', color: C.favored });
    if (d.triangle === 'disadvantage') parts.push({ text: '\u25BC', color: C.resisted });
  }
  return { parts, size: size * pop, outline: C.outline, outlineWidth: 3.5 };
}

// A cannon's bark: a short cone of hot sparks and a puff of smoke out of
// the muzzle, along the firing direction.
export function spawnMuzzleFlash(pool, x, y, angle, color, rng = Math.random) {
  for (let i = 0; i < 6; i++) {
    const a = angle + (rng() - 0.5) * 0.7;
    const sp = 60 + rng() * 90;
    pool.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.12 + rng() * 0.08, maxLife: 0.2, size: 1.2 + rng() * 1.3, color: i < 3 ? '#ffd27a' : '#ff8a3d', drag: 6 });
  }
  for (let i = 0; i < 3; i++) {
    const a = angle + (rng() - 0.5) * 0.9;
    const sp = 20 + rng() * 30;
    pool.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + rng() * 0.2, maxLife: 0.55, size: 2.4 + rng() * 1.6, color: 'rgba(210,210,200,0.55)', drag: 3 });
  }
}
