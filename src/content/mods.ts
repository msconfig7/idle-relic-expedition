import type { Rarity, StatKey } from '../game/types'

export type ModTier = 1 | 2 | 3 | 4 | 5

export const PREFIX_STATS: StatKey[] = ['attack', 'str', 'critChance', 'critMulti', 'lifeSteal', 'itemDrop']

export const SUFFIX_STATS: StatKey[] = [
  'hp',
  'defense',
  'dex',
  'int',
  'block',
  'hpRegen',
  'xpMod',
  'goldMod',
  'materialDrop',
]

// Index 0 is T1. T1 is the spike; each step down is a clear cut.
const TIER_VALUES: Record<StatKey, readonly [number, number, number, number, number]> = {
  attack: [15, 10, 7, 5, 3],
  str: [8, 5, 4, 3, 2],
  dex: [8, 5, 4, 3, 2],
  int: [8, 5, 4, 3, 2],
  hp: [40, 26, 18, 12, 8],
  defense: [12, 8, 6, 4, 2],
  hpRegen: [1.2, 0.8, 0.5, 0.3, 0.15],
  critChance: [0.08, 0.05, 0.035, 0.02, 0.01],
  critMulti: [0.2, 0.12, 0.08, 0.05, 0.03],
  block: [0.08, 0.05, 0.035, 0.02, 0.01],
  lifeSteal: [0.06, 0.04, 0.025, 0.015, 0.008],
  itemDrop: [0.08, 0.05, 0.03, 0.02, 0.01],
  materialDrop: [0.08, 0.05, 0.03, 0.02, 0.01],
  xpMod: [0.12, 0.08, 0.05, 0.03, 0.02],
  goldMod: [0.12, 0.08, 0.05, 0.03, 0.02],
}

const TIER_WEIGHT: Record<ModTier, number> = {
  1: 4,
  2: 12,
  3: 26,
  4: 30,
  5: 28,
}

export function tierName(tier: ModTier): string {
  return `T${tier}`
}

export function tierValue(stat: StatKey, tier: ModTier): number {
  return TIER_VALUES[stat][tier - 1]
}

export function tiersForRarity(rarity: Rarity): ModTier[] {
  if (rarity === 'common') return [3, 4, 5]
  if (rarity === 'magic') return [2, 3, 4, 5]
  return [1, 2, 3, 4, 5]
}

export function rollTier(rng: () => number, rarity: Rarity): ModTier {
  const allowed = tiersForRarity(rarity)
  const entries = allowed.map((tier) => ({ tier, weight: TIER_WEIGHT[tier] }))
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = rng() * total
  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) return entry.tier
  }
  return entries[entries.length - 1].tier
}

export function closestTier(stat: StatKey, value: number, rarity: Rarity): ModTier {
  const allowed = tiersForRarity(rarity)
  let best = allowed[0]
  let bestDist = Infinity
  for (const tier of allowed) {
    const dist = Math.abs(tierValue(stat, tier) - value)
    if (dist < bestDist) {
      best = tier
      bestDist = dist
    }
  }
  return best
}

export function parseTier(name: string): ModTier | null {
  const match = /^T([1-5])$/.exec(name)
  if (!match) return null
  return Number(match[1]) as ModTier
}

export const SPECIALS: { stat: StatKey; name: string; value: number }[] = [
  { stat: 'attack', name: "Titan's Grip", value: 22 },
  { stat: 'defense', name: "Warden's Oath", value: 18 },
  { stat: 'lifeSteal', name: 'Emberheart', value: 0.09 },
  { stat: 'itemDrop', name: 'Relic Sense', value: 0.12 },
  { stat: 'xpMod', name: "Scholar's Mark", value: 0.18 },
  { stat: 'goldMod', name: 'Midas Touch', value: 0.18 },
  { stat: 'hpRegen', name: 'Second Wind', value: 1.8 },
  { stat: 'critMulti', name: 'Executioner', value: 0.3 },
]
