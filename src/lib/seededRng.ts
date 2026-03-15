/**
 * Mulberry32 seeded PRNG — deterministic random number generator.
 * Given the same seed, always produces the same sequence.
 */
export function createRng(seed: number) {
  let state = seed | 0

  /** Returns a float in [0, 1) */
  function next(): number {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Returns integer in [min, max] inclusive */
  function int(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min
  }

  /** Returns true with given probability (0–1) */
  function chance(probability: number): boolean {
    return next() < probability
  }

  /** Pick a random element from array */
  function pick<T>(arr: T[]): T {
    return arr[Math.floor(next() * arr.length)]
  }

  return { next, int, chance, pick }
}

export type SeededRng = ReturnType<typeof createRng>

/**
 * Convert a string seed to a numeric seed via simple hash.
 * Used to turn matchSeed (string) into a number for the PRNG.
 */
export function hashSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}
