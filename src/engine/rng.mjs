// Seeded RNG so combat/AI simulations are reproducible in tests. Production
// code can still pass Math.random — anything matching `() => number in [0,1)`
// works anywhere an `rng` parameter is accepted.

export function makeSeededRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
