import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createParticlePool, spawnHitSpark, spawnKillBurst, spawnExplosion, spawnSplash, updateParticles,
  createDamageNumberPool, spawnDamageNumber, updateDamageNumbers,
  createShake, addShake, updateShake,
  createHitStop, triggerHitStop, applyHitStop,
} from '../src/engine/juice.mjs';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

test('spawnHitSpark adds the requested particle count, all alive with full life', () => {
  const pool = createParticlePool();
  spawnHitSpark(pool, 10, 20, '#fff', seeded(1), 6);
  assert.equal(pool.length, 6);
  for (const p of pool) {
    assert.equal(p.life, p.maxLife);
    assert.ok(p.life > 0);
  }
});

test('spawnKillBurst produces more particles than a plain hit spark (bigger feedback on a kill)', () => {
  const hitPool = createParticlePool();
  spawnHitSpark(hitPool, 0, 0, '#fff', seeded(2), 8);
  const killPool = createParticlePool();
  spawnKillBurst(killPool, 0, 0, '#fff', seeded(2));
  assert.ok(killPool.length > hitPool.length);
});

test('spawnExplosion scales particle count with blast radius', () => {
  const small = createParticlePool();
  spawnExplosion(small, 0, 0, 20, seeded(3));
  const big = createParticlePool();
  spawnExplosion(big, 0, 0, 60, seeded(3));
  assert.ok(big.length > small.length);
});

test('spawnSplash adds the default particle count', () => {
  const pool = createParticlePool();
  spawnSplash(pool, 5, 5, seeded(4));
  assert.equal(pool.length, 6);
});

test('updateParticles advances position, decays life, and removes dead particles', () => {
  let pool = createParticlePool();
  spawnParticleForTest(pool, { x: 0, y: 0, vx: 100, vy: 0, life: 0.05, size: 2, color: '#fff', drag: 0 });
  pool = updateParticles(pool, 0.02);
  assert.equal(pool.length, 1);
  assert.ok(pool[0].x > 0); // moved
  assert.ok(pool[0].life < 0.05); // decayed

  pool = updateParticles(pool, 1); // well past its remaining life
  assert.equal(pool.length, 0);
});

function spawnParticleForTest(pool, opts) {
  // Mirrors juice.mjs's internal spawnParticle shape without importing a
  // non-exported helper — used only to seed a controlled particle for the
  // updateParticles test above.
  pool.push({ ...opts, maxLife: opts.life });
}

test('updateParticles applies drag, slowing velocity over time', () => {
  let pool = createParticlePool();
  spawnParticleForTest(pool, { x: 0, y: 0, vx: 100, vy: 0, life: 5, size: 2, color: '#fff', drag: 5 });
  const startVx = pool[0].vx;
  pool = updateParticles(pool, 0.1);
  assert.ok(pool[0].vx < startVx);
  assert.ok(pool[0].vx > 0); // drag slows but drag*dt=0.5 here, shouldn't reverse
});

test('spawnDamageNumber creates a number with the rounded amount and full life', () => {
  const pool = createDamageNumberPool();
  spawnDamageNumber(pool, 10, 20, 7.6);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].amount, 8);
  assert.equal(pool[0].life, pool[0].maxLife);
  assert.equal(pool[0].crit, false);
});

test('spawnDamageNumber marks crit hits distinctly', () => {
  const pool = createDamageNumberPool();
  spawnDamageNumber(pool, 0, 0, 10, { crit: true });
  assert.equal(pool[0].crit, true);
});

test('spawnDamageNumber records the post-slice combat-triangle status, defaulting to null', () => {
  const pool = createDamageNumberPool();
  spawnDamageNumber(pool, 0, 0, 10);
  assert.equal(pool[0].triangle, null);
  spawnDamageNumber(pool, 0, 0, 10, { triangle: 'advantage' });
  assert.equal(pool[1].triangle, 'advantage');
  spawnDamageNumber(pool, 0, 0, 10, { triangle: 'disadvantage' });
  assert.equal(pool[2].triangle, 'disadvantage');
});

test('updateDamageNumbers rises then falls back and expires', () => {
  let pool = createDamageNumberPool();
  spawnDamageNumber(pool, 0, 100, 5);
  const startY = pool[0].y;
  pool = updateDamageNumbers(pool, 0.1);
  assert.ok(pool[0].y < startY); // moved upward first (negative vy)

  pool = updateDamageNumbers(pool, 10); // far past its life
  assert.equal(pool.length, 0);
});

test('createShake starts at zero trauma', () => {
  const shake = createShake();
  assert.equal(shake.trauma, 0);
});

test('addShake increases trauma, clamped at 1', () => {
  const shake = createShake();
  addShake(shake, 0.4);
  assert.equal(shake.trauma, 0.4);
  addShake(shake, 10);
  assert.equal(shake.trauma, 1);
});

test('updateShake decays trauma over time and returns a zero offset once fully decayed', () => {
  const shake = createShake();
  addShake(shake, 1);
  let offset = updateShake(shake, 0.1, seeded(5));
  assert.ok(Math.abs(offset.x) <= 10);
  assert.ok(Math.abs(offset.y) <= 10);

  for (let i = 0; i < 20; i++) offset = updateShake(shake, 0.5, seeded(5));
  assert.equal(shake.trauma, 0);
  // === (not Object.is) treats -0 and 0 as equal — a zero-trauma offset can
  // legitimately land on -0 depending on the rng draw, which is fine.
  assert.ok(offset.x === 0);
  assert.ok(offset.y === 0);
});

test('updateShake produces a bigger typical offset at high trauma than at low trauma (squared falloff)', () => {
  const lowShake = createShake();
  addShake(lowShake, 0.1);
  const highShake = createShake();
  addShake(highShake, 1);
  // Use a fixed rng returning 1 (max magnitude) to compare deterministically.
  const fixedRng = () => 1;
  const lowOffset = updateShake(lowShake, 0, fixedRng);
  const highOffset = updateShake(highShake, 0, fixedRng);
  assert.ok(Math.abs(highOffset.x) > Math.abs(lowOffset.x));
});

test('createHitStop starts with no freeze remaining', () => {
  const hitStop = createHitStop();
  assert.equal(hitStop.remaining, 0);
});

test('applyHitStop returns 0 while frozen and the real dt once expired', () => {
  const hitStop = createHitStop();
  triggerHitStop(hitStop, 0.1);
  const simDt1 = applyHitStop(hitStop, 0.05);
  assert.equal(simDt1, 0);
  assert.ok(hitStop.remaining > 0);

  const simDt2 = applyHitStop(hitStop, 0.2); // more than remaining — freeze ends this call
  assert.equal(simDt2, 0); // still returns 0 for the frame that ends the freeze
  assert.equal(hitStop.remaining, 0);

  const simDt3 = applyHitStop(hitStop, 0.016);
  assert.equal(simDt3, 0.016); // no freeze active — passes dt through unchanged
});

test('triggerHitStop never shortens an already-longer freeze in progress', () => {
  const hitStop = createHitStop();
  triggerHitStop(hitStop, 0.2);
  triggerHitStop(hitStop, 0.05); // a smaller hit landing mid-freeze shouldn't cut it short
  assert.equal(hitStop.remaining, 0.2);
  triggerHitStop(hitStop, 0.5); // but a bigger one can extend it
  assert.equal(hitStop.remaining, 0.5);
});

test('spawnDamageNumber marks damage the player took as incoming, separately from damage dealt', () => {
  const pool = createDamageNumberPool();
  spawnDamageNumber(pool, 0, 0, 7, { incoming: true, triangle: 'danger' });
  spawnDamageNumber(pool, 0, 0, 7);
  assert.equal(pool[0].incoming, true);
  assert.equal(pool[0].triangle, 'danger');
  assert.equal(pool[1].incoming, false);
});

// --- Damage-number visual language (2026-09-28 legibility pass) ----------
import { damageNumberStyle, DAMAGE_NUMBER_COLORS } from '../src/engine/juice.mjs';
import { BIOMES, BIOME_IDS } from '../src/data/biomes.mjs';

// WCAG relative luminance / contrast ratio.
function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

const ALL_CASES = [];
for (const incoming of [false, true]) for (const crit of [false, true])
  for (const triangle of incoming ? [null, 'danger', 'resist'] : [null, 'advantage', 'disadvantage'])
    ALL_CASES.push({ amount: 9, crit, triangle, incoming, life: 0.1, maxLife: 0.9 });

test('red is reserved for damage the player took — no dealt-damage style uses it', () => {
  const reds = [DAMAGE_NUMBER_COLORS.hurt, DAMAGE_NUMBER_COLORS.hurtDanger, DAMAGE_NUMBER_COLORS.hurtResist];
  for (const d of ALL_CASES) {
    const colors = damageNumberStyle(d).parts.map((p) => p.color);
    if (d.incoming) assert.ok(colors.every((c) => reds.includes(c)), `incoming ${d.triangle} should be red`);
    else assert.ok(colors.every((c) => !reds.includes(c)), `dealt ${d.triangle} must not use red: ${colors}`);
  }
});

test('every number colour has strong contrast against its outline (legible on any background)', () => {
  for (const d of ALL_CASES) for (const p of damageNumberStyle(d).parts) {
    const r = contrast(p.color, DAMAGE_NUMBER_COLORS.outline);
    assert.ok(r >= 4.5, `${p.text} ${p.color} vs outline: ${r.toFixed(2)} < 4.5`);
  }
});

// 2026-09-28 art pass: the old near-black flat tiles are gone; the tropical
// ground runs from deep blue to turquoise to white sand. No single number
// colour can clear 3:1 against all of that on its own (the old "without
// its outline" test only passed because the old water was nearly black).
// The real contract: against every ground colour, the number OR its
// always-drawn dark outline stands out at 3:1.
const TROPICAL = BIOMES[BIOME_IDS.TROPICAL];
// Damage YOU take is drawn over the boat, which never leaves the water;
// hits on enemies can land over land too (Harpies fly over it).
const WATER = [...TROPICAL.water.map(([, c]) => c), TROPICAL.foam];
const GROUND = [...WATER, ...TROPICAL.land.map(([, c]) => c), TROPICAL.rock, TROPICAL.rockDark, TROPICAL.jungleDark];

test('against every terrain colour it can appear over, each number or its outline clears 3:1', () => {
  for (const d of ALL_CASES) for (const bg of (d.incoming ? WATER : GROUND)) for (const p of damageNumberStyle(d).parts) {
    const best = Math.max(contrast(p.color, bg), contrast(DAMAGE_NUMBER_COLORS.outline, bg));
    assert.ok(best >= 3, `${p.text} ${p.color} on ${bg}: best ${best.toFixed(2)} < 3`);
  }
});

test('a resisted hit keeps a full-brightness number — only its glyph is muted (the old version was near-invisible)', () => {
  const s = damageNumberStyle({ amount: 5, crit: false, triangle: 'disadvantage', incoming: false, life: 0.9, maxLife: 0.9 });
  assert.equal(s.parts[0].color, DAMAGE_NUMBER_COLORS.normal);
  assert.equal(s.parts[1].text, '▼');
});

test('the counter-weapon gold survives a triangle advantage — the two signals stack, not overwrite', () => {
  const s = damageNumberStyle({ amount: 30, crit: true, triangle: 'advantage', incoming: false, life: 0.9, maxLife: 0.9 });
  assert.equal(s.parts[0].color, DAMAGE_NUMBER_COLORS.counter);
  assert.equal(s.parts[1].color, DAMAGE_NUMBER_COLORS.favored);
});

test('amplified numbers (advantage / danger) pop in larger, then settle to their resting size', () => {
  for (const triangle of ['advantage', 'danger']) {
    const incoming = triangle === 'danger';
    const fresh = damageNumberStyle({ amount: 9, crit: false, triangle, incoming, life: 0.9, maxLife: 0.9 });
    const settled = damageNumberStyle({ amount: 9, crit: false, triangle, incoming, life: 0.5, maxLife: 0.9 });
    assert.ok(fresh.size > settled.size * 1.3, `${triangle} should pop`);
  }
  const plain = damageNumberStyle({ amount: 9, crit: false, triangle: null, incoming: false, life: 0.7, maxLife: 0.7 });
  assert.ok(plain.size >= 13, 'even plain numbers are at least 13px (was 11px)');
});

test('triangle-tagged numbers stay on screen longer than plain ones', () => {
  const pool = createDamageNumberPool();
  spawnDamageNumber(pool, 0, 0, 5);
  spawnDamageNumber(pool, 0, 0, 5, { triangle: 'advantage' });
  assert.ok(pool[1].maxLife > pool[0].maxLife);
});
