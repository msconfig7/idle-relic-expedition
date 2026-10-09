import { itemBases } from '../content/items'
import { PREFIX_STATS, SUFFIX_STATS } from '../content/mods'
import { chance, pickWeighted, randInt } from './rng'
import { modCap, rollFromPool, rollSpecial, scaleModValue } from './items'
import { withItemName } from './items'
import type { Item, ItemBase, ItemMod, Rarity } from './types'
import { newId } from '../lib/id'

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

function implicitFor(base: ItemBase, rarity: Rarity, realmId: number): ItemMod {
  const value = scaleModValue(base.implicit.value, 0, true, base.implicit.stat)
  const rarityScale: Record<Rarity, number> = {
    common: 1,
    magic: 1.25,
    rare: 1.55,
    epic: 2,
    legendary: 2.7,
  }
  const scaled = value * rarityScale[rarity] * (1 + (realmId - 1) * 0.2)
  const rounded =
    base.implicit.stat === 'hpRegen' ||
    base.implicit.stat === 'critChance' ||
    base.implicit.stat === 'critMulti' ||
    base.implicit.stat === 'block' ||
    base.implicit.stat === 'xpMod' ||
    base.implicit.stat === 'goldMod' ||
    base.implicit.stat === 'itemDrop' ||
    base.implicit.stat === 'materialDrop' ||
    base.implicit.stat === 'lifeSteal'
      ? Math.round(scaled * 1000) / 1000
      : Math.round(scaled * 10) / 10
  return { stat: base.implicit.stat, value: rounded, name: '' }
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
  const implicit = implicitFor(base, rarity, realmId)
  const used = new Set([implicit.stat])
  const cap = modCap(rarity)
  const prefixes = []
  const suffixes = []
  for (let i = 0; i < cap.prefixes; i++) prefixes.push(rollFromPool(rng, PREFIX_STATS, rarity, used))
  for (let i = 0; i < cap.suffixes; i++) suffixes.push(rollFromPool(rng, SUFFIX_STATS, rarity, used))
  const special = rollSpecial(rng, rarity)
  return withItemName({
    id: newId(),
    playerId,
    slotType: base.slotType,
    weaponHand: base.weaponHand,
    rarity,
    baseId: base.id,
    name: base.name,
    implicit,
    prefixes,
    suffixes,
    special,
    rank: 0,
    forgePity: 0,
    equippedSlot: null,
    locked: false,
  })
}

export function rollScrap(rng: () => number, materialChance: number, realmId: number): number {
  if (!chance(rng, materialChance)) return 0
  return randInt(rng, 1, 2 + realmId)
}

export { RARITIES } from './types'
