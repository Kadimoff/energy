/** Deterministic, order-independent noise. Same inputs always give the same value. */

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash3(a: number, b: number, c: number): number {
  let h = fmix((a | 0) ^ 0x9e3779b9);
  h = fmix(h ^ Math.imul(b | 0, 0x27d4eb2d));
  h = fmix(h ^ Math.imul(c | 0, 0x165667b1));
  return h;
}

/** Uniform in [0, 1). */
export function uniform(a: number, b: number, c: number): number {
  return hash3(a, b, c) / 4294967296;
}

/** Standard normal via Box-Muller on two hashed uniforms. */
export function gauss(a: number, b: number, c: number): number {
  const u1 = Math.max(1e-12, uniform(a, b, c));
  const u2 = uniform(a ^ 0x5bd1e995, b + 7919, c ^ 0x1b873593);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Small seeded PRNG (mulberry32) for sequential use, e.g. live ticks. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stringSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
