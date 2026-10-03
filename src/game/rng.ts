export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickWeighted<T extends { weight: number }>(
  rng: () => number,
  entries: readonly T[],
): T {
  const usable = entries.filter((entry) => entry.weight > 0)
  const pool = usable.length ? usable : entries
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = rng() * total
  for (const entry of pool) {
    roll -= entry.weight
    if (roll <= 0) return entry
  }
  return pool[pool.length - 1]
}

export function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function chance(rng: () => number, p: number): boolean {
  return rng() < p
}
