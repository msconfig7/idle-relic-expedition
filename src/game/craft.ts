import { essencesInRealm } from '../content/essences'
import { PREFIX_STATS, SUFFIX_STATS } from '../content/mods'
import { chance } from './rng'
import { modCap, rollFromPool, usedStats, withItemName } from './items'
import { MAX_ITEM_RANK, type EssenceCounts, type Item, type PlayerState, type Rarity, type StatKey } from './types'

export type CraftCost = {
  scrap: number
  essenceRealm: number
  essenceCount: number
}

export type CraftOutcome =
  | { ok: false; reason: string }
  | { ok: true; success: boolean; player: PlayerState; item: Item }

const RARITY_COST: Record<Rarity, number> = {
  common: 1,
  magic: 2,
  rare: 4,
  epic: 8,
  legendary: 16,
}

const TEMPER_CHANCE = [0, 1, 0.9, 0.8, 0.7, 0.58, 0.46, 0.34, 0.24, 0.16, 0.1]

export function realmForRank(rank: number): number {
  if (rank <= 3) return 1
  if (rank <= 6) return 2
  if (rank <= 7) return 3
  return 4
}

export function temperChance(item: Item): number {
  const base = TEMPER_CHANCE[item.rank + 1] ?? 0.1
  return Math.min(1, base + item.forgePity * 0.1)
}

export function temperCost(item: Item): CraftCost | null {
  if (item.rank >= MAX_ITEM_RANK) return null
  const next = item.rank + 1
  return {
    scrap: Math.round((8 + next * 6) * RARITY_COST[item.rarity]),
    essenceRealm: realmForRank(next),
    essenceCount: next <= 3 ? 1 : next <= 6 ? 2 : 3,
  }
}

export function rerollCost(item: Item): CraftCost {
  return {
    scrap: Math.round((10 + item.rank * 4) * RARITY_COST[item.rarity]),
    essenceRealm: item.rank === 0 ? 1 : realmForRank(item.rank),
    essenceCount: 1,
  }
}

export const ASCEND_SACRIFICE_COUNT = 2

export function ascendTarget(item: Item): Rarity | null {
  if (item.rarity === 'common') return 'magic'
  if (item.rarity === 'magic') return 'rare'
  return null
}

export function ascendKeeperReason(item: Item): string | null {
  if (item.equippedSlot) return 'Unequip this relic before ascending.'
  if (!ascendTarget(item)) return 'Only common and magic relics can ascend.'
  return null
}

export function ascendFodderReason(keeper: Item, fodder: Item): string | null {
  if (fodder.id === keeper.id) return 'Choose two other relics.'
  if (fodder.equippedSlot) return 'Unequip a sacrifice before ascending.'
  if (fodder.locked) return 'Locked relics cannot be sacrificed.'
  if (fodder.slotType !== keeper.slotType) return 'Sacrifices must be the same type.'
  return null
}

export function essenceHeld(essences: EssenceCounts, realmId: number): number {
  return essencesInRealm(realmId).reduce((sum, entry) => sum + (essences[entry.id] ?? 0), 0)
}

export function spendMaterials(player: PlayerState, cost: CraftCost): PlayerState | null {
  if (player.scrap < cost.scrap) return null
  const pool = essencesInRealm(cost.essenceRealm)
  if (essenceHeld(player.essences, cost.essenceRealm) < cost.essenceCount) return null
  const essences = { ...player.essences }
  let left = cost.essenceCount
  const ordered = [...pool].sort((a, b) => (essences[b.id] ?? 0) - (essences[a.id] ?? 0))
  for (const entry of ordered) {
    if (left <= 0) break
    const have = essences[entry.id] ?? 0
    const take = Math.min(have, left)
    if (take <= 0) continue
    const next = have - take
    if (next === 0) delete essences[entry.id]
    else essences[entry.id] = next
    left -= take
  }
  return { ...player, scrap: player.scrap - cost.scrap, essences }
}

function missingReason(player: PlayerState, cost: CraftCost): string | null {
  if (player.scrap < cost.scrap) return `Needs ${cost.scrap.toLocaleString()} scrap.`
  const held = essenceHeld(player.essences, cost.essenceRealm)
  if (held < cost.essenceCount) {
    return `Needs ${cost.essenceCount} essence${cost.essenceCount === 1 ? '' : 's'} from realm ${cost.essenceRealm}.`
  }
  return null
}

export function temperItem(player: PlayerState, item: Item, rng: () => number): CraftOutcome {
  const cost = temperCost(item)
  if (!cost) return { ok: false, reason: 'This relic is already +10.' }
  const missing = missingReason(player, cost)
  if (missing) return { ok: false, reason: missing }
  const paid = spendMaterials(player, cost)
  if (!paid) return { ok: false, reason: missing ?? 'Not enough materials.' }
  const success = chance(rng, temperChance(item))
  const next = success
    ? withItemName({ ...item, rank: item.rank + 1, forgePity: 0 })
    : { ...item, forgePity: item.forgePity + 1 }
  return { ok: true, success, player: paid, item: next }
}

export function rerollItemMod(
  player: PlayerState,
  item: Item,
  kind: 'prefix' | 'suffix',
  index: number,
  rng: () => number,
): CraftOutcome {
  const list = kind === 'prefix' ? item.prefixes : item.suffixes
  if (!list[index]) return { ok: false, reason: 'That mod is gone.' }
  const cost = rerollCost(item)
  const missing = missingReason(player, cost)
  if (missing) return { ok: false, reason: missing }
  const paid = spendMaterials(player, cost)
  if (!paid) return { ok: false, reason: missing ?? 'Not enough materials.' }
  const used = usedStats(item)
  used.delete(list[index].stat)
  const pool = kind === 'prefix' ? PREFIX_STATS : SUFFIX_STATS
  const rolled = rollFromPool(rng, pool, item.rarity, used)
  const prefixes = kind === 'prefix' ? item.prefixes.map((mod, i) => (i === index ? rolled : mod)) : item.prefixes
  const suffixes = kind === 'suffix' ? item.suffixes.map((mod, i) => (i === index ? rolled : mod)) : item.suffixes
  return {
    ok: true,
    success: true,
    player: paid,
    item: withItemName({ ...item, prefixes, suffixes }),
  }
}

function rollAscendedSuffixes(keeper: Item, rarity: Rarity, rng: () => number): Item['suffixes'] {
  const used = new Set<StatKey>([keeper.implicit.stat])
  for (const mod of keeper.prefixes) used.add(mod.stat)
  if (keeper.special) used.add(keeper.special.stat)
  const count = modCap(rarity).suffixes
  const suffixes: Item['suffixes'] = []
  for (let i = 0; i < count; i++) suffixes.push(rollFromPool(rng, SUFFIX_STATS, rarity, used))
  return suffixes
}

export function ascendItem(
  keeper: Item,
  fodder: Item[],
  rng: () => number,
): { ok: false; reason: string } | { ok: true; item: Item } {
  const keeperReason = ascendKeeperReason(keeper)
  if (keeperReason) return { ok: false, reason: keeperReason }
  const nextRarity = ascendTarget(keeper)
  if (!nextRarity) return { ok: false, reason: 'Only common and magic relics can ascend.' }
  if (fodder.length !== ASCEND_SACRIFICE_COUNT) return { ok: false, reason: 'Sacrifice 2 relics of the same type.' }
  const ids = new Set(fodder.map((item) => item.id))
  if (ids.size !== fodder.length) return { ok: false, reason: 'Choose two other relics.' }
  for (const item of fodder) {
    const reason = ascendFodderReason(keeper, item)
    if (reason) return { ok: false, reason: reason }
  }
  return {
    ok: true,
    item: withItemName({
      ...keeper,
      rarity: nextRarity,
      suffixes: rollAscendedSuffixes(keeper, nextRarity, rng),
    }),
  }
}
