import { itemBases } from '../content/items'
import { chance, pickWeighted, randInt } from './rng'
import { isPercentStat } from './format'
import type { Affix, Item, ItemBase, Rarity, StatKey } from './types'
import { RARITY_LABEL } from './rarity'
import { newId } from '../lib/id'

const affixCount: Record<Rarity, number> = {
  common: 1,
  magic: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
}

const pool: { stat: StatKey; kind: 'flat' | 'pct' }[] = [
  { stat: 'hp', kind: 'flat' },
  { stat: 'attack', kind: 'flat' },
  { stat: 'defense', kind: 'flat' },
  { stat: 'str', kind: 'flat' },
  { stat: 'dex', kind: 'flat' },
  { stat: 'int', kind: 'flat' },
  { stat: 'critChance', kind: 'pct' },
  { stat: 'critMulti', kind: 'pct' },
  { stat: 'block', kind: 'pct' },
  { stat: 'xpMod', kind: 'pct' },
  { stat: 'goldMod', kind: 'pct' },
  { stat: 'itemDrop', kind: 'pct' },
  { stat: 'materialDrop', kind: 'pct' },
  { stat: 'hpRegen', kind: 'flat' },
  { stat: 'lifeSteal', kind: 'pct' },
]

const rarityScale: Record<Rarity, number> = {
  common: 1,
  magic: 1.25,
  rare: 1.55,
  epic: 2,
  legendary: 2.7,
}

function rarityWeights(realmId: number): { rarity: Rarity; weight: number }[] {
  if (realmId <= 1) {
    return [
      { rarity: 'common', weight: 92 },
      { rarity: 'magic', weight: 7.5 },
      { rarity: 'rare', weight: 0.5 },
      { rarity: 'epic', weight: 0 },
      { rarity: 'legendary', weight: 0 },
    ]
  }
  if (realmId === 2) {
    return [
      { rarity: 'common', weight: 78 },
      { rarity: 'magic', weight: 17 },
      { rarity: 'rare', weight: 4.5 },
      { rarity: 'epic', weight: 0.5 },
      { rarity: 'legendary', weight: 0 },
    ]
  }
  return [
    { rarity: 'common', weight: 62 },
    { rarity: 'magic', weight: 24 },
    { rarity: 'rare', weight: 11 },
    { rarity: 'epic', weight: 2.6 },
    { rarity: 'legendary', weight: 0.4 },
  ]
}

function scaleImplicit(implicit: Affix, rarity: Rarity, realmId: number): number {
  const scaled = implicit.value * rarityScale[rarity] * (1 + (realmId - 1) * 0.2)
  if (isPercentStat(implicit.stat)) {
    return Math.round(scaled * 1000) / 1000
  }
  return Math.round(scaled * 10) / 10
}

function rollAffix(rng: () => number, rarity: Rarity, realmId: number, used: Set<StatKey>): Affix {
  const choices = pool.filter((entry) => !used.has(entry.stat))
  const pick = choices[Math.floor(rng() * choices.length)] ?? pool[0]
  used.add(pick.stat)
  const scale = rarityScale[rarity] * (1 + (realmId - 1) * 0.35)
  if (pick.kind === 'flat') {
    if (pick.stat === 'hpRegen') {
      return { stat: pick.stat, value: Math.round(randInt(rng, 2, 6) * scale) / 10 }
    }
    const base = pick.stat === 'hp' ? randInt(rng, 8, 22) : randInt(rng, 1, 6)
    return { stat: pick.stat, value: Math.max(1, Math.round(base * scale)) }
  }
  const pct = pick.stat === 'critMulti' || pick.stat === 'xpMod' || pick.stat === 'goldMod'
    ? randInt(rng, 3, 8) / 100
    : randInt(rng, 1, 4) / 100
  return { stat: pick.stat, value: Math.round(pct * scale * 1000) / 1000 }
}

export function rollItemDrop(
  rng: () => number,
  playerId: string,
  realmId: number,
  itemChance: number,
): Item | null {
  if (!chance(rng, itemChance)) return null
  const { rarity } = pickWeighted(rng, rarityWeights(realmId))
  const base: ItemBase = itemBases[Math.floor(rng() * itemBases.length)]
  const used = new Set<StatKey>([base.implicit.stat])
  const affixes: Affix[] = [
    {
      ...base.implicit,
      value: scaleImplicit(base.implicit, rarity, realmId),
    },
  ]
  const extra = affixCount[rarity] - 1
  for (let i = 0; i < extra; i++) {
    affixes.push(rollAffix(rng, rarity, realmId, used))
  }
  const prefix = rarity === 'common' ? '' : `${RARITY_LABEL[rarity]} `
  return {
    id: newId(),
    playerId,
    slotType: base.slotType,
    weaponHand: base.weaponHand,
    rarity,
    baseId: base.id,
    name: `${prefix}${base.name}`,
    affixes,
    equippedSlot: null,
    locked: false,
  }
}

export function rollScrap(rng: () => number, materialChance: number, realmId: number): number {
  if (!chance(rng, materialChance)) return 0
  return randInt(rng, 1, 2 + realmId)
}

export { RARITIES } from './types'
