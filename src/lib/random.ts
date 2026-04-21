/**
 * Cryptographically-strong random utilities.
 * Math.random() can be biased / predictable in some browsers, which led to
 * users complaining about "10 epics in a row". These helpers use the Web
 * Crypto API for true randomness suitable for pack/buff drops.
 */

/** Uniform float in [0, 1). */
export function secureRandom(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const u = new Uint32Array(1);
    crypto.getRandomValues(u);
    return u[0] / 0xffffffff;
  }
  return Math.random();
}

/** Random integer in [0, max). */
export function secureRandomInt(max: number): number {
  return Math.floor(secureRandom() * max);
}

/** Pick a random element from an array. */
export function securePick<T>(arr: readonly T[]): T {
  return arr[secureRandomInt(arr.length)];
}
