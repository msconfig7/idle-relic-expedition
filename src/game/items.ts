import { itemBases } from '../content/items'
import {
  PREFIX_STATS,
  SPECIALS,
  SUFFIX_STATS,
  closestTier,
  parseTier,
  rollTier,
  tierName,
  tierValue,
  tiersForRarity,
} from '../content/mods'
import { isPercentStat } from './format'
import { normalizeRarity } from './rarity'
import { STAT_KEYS, type Item, type ItemMod, type Rarity, type StatKey } from './types'
import { RANK_STAT_BONUS } from './types'

export function modCap(rarity: Rarity): { prefixes: number; suffixes: number } {
  if (rarity === 'common') return { prefixes: 1, suffixes: 1 }
  if (rarity === 'magic') return { prefixes: 2, suffixes: 2 }
  return { prefixes: 3, suffixes: 3 }
}

export function specialRoll(rarity: Rarity): 'never' | 'chance' | 'always' {
  if (rarity === 'rare') return 'chance'
  if (rarity === 'epic' || rarity === 'legendary') return 'always'
  return 'never'
}

export const RARE_SPECIAL_CHANCE = 0.2

export function composeItemName(baseName: string, rank: number): string {
  return rank > 0 ? `${baseName} +${rank}` : baseName
}

export function baseItemName(baseId: string, fallback = 'Relic'): string {
  return itemBases.find((entry) => entry.id === baseId)?.name ?? fallback
}

export function withItemName(item: Item): Item {
  return {
    ...item,
    name: composeItemName(baseItemName(item.baseId, item.name), item.rank),
  }
}

export function scaleModValue(value: number, rank: number, special: boolean, stat: StatKey): number {
  const scaled = special ? value : value * (1 + rank * RANK_STAT_BONUS)
  if (isPercentStat(stat) || stat === 'hpRegen') return Math.round(scaled * 1000) / 1000
  return Math.round(scaled * 10) / 10
}

export type ListedMod = {
  kind: 'implicit' | 'prefix' | 'suffix' | 'special'
  index: number
  name: string
  stat: StatKey
  value: number
}

export function listItemMods(item: Item): ListedMod[] {
  const rows: ListedMod[] = [
    {
      kind: 'implicit',
      index: 0,
      name: item.implicit.name,
      stat: item.implicit.stat,
      value: scaleModValue(item.implicit.value, item.rank, false, item.implicit.stat),
    },
  ]
  item.prefixes.forEach((mod, index) => {
    rows.push({
      kind: 'prefix',
      index,
      name: mod.name,
      stat: mod.stat,
      value: scaleModValue(mod.value, item.rank, false, mod.stat),
    })
  })
  item.suffixes.forEach((mod, index) => {
    rows.push({
      kind: 'suffix',
      index,
      name: mod.name,
      stat: mod.stat,
      value: scaleModValue(mod.value, item.rank, false, mod.stat),
    })
  })
  if (item.special) {
    rows.push({
      kind: 'special',
      index: 0,
      name: item.special.name,
      stat: item.special.stat,
      value: scaleModValue(item.special.value, item.rank, true, item.special.stat),
    })
  }
  return rows
}

export function modTotal(item: Item, stat: StatKey): number {
  return listItemMods(item)
    .filter((mod) => mod.stat === stat)
    .reduce((sum, mod) => sum + mod.value, 0)
}

export function rollFromPool(
  rng: () => number,
  pool: readonly StatKey[],
  rarity: Rarity,
  used: Set<StatKey>,
): ItemMod {
  const choices = pool.filter((stat) => !used.has(stat))
  const stat = choices[Math.floor(rng() * choices.length)] ?? pool[Math.floor(rng() * pool.length)] ?? pool[0]
  used.add(stat)
  const tier = rollTier(rng, rarity)
  return { stat, name: tierName(tier), value: tierValue(stat, tier) }
}

export function snapToTier(mod: ItemMod, rarity: Rarity): ItemMod {
  const named = parseTier(mod.name)
  const allowed = tiersForRarity(rarity)
  const tier = named && allowed.includes(named) ? named : closestTier(mod.stat, mod.value, rarity)
  return { stat: mod.stat, name: tierName(tier), value: tierValue(mod.stat, tier) }
}

export function usedStats(item: Pick<Item, 'implicit' | 'prefixes' | 'suffixes' | 'special'>): Set<StatKey> {
  const used = new Set<StatKey>([item.implicit.stat])
  for (const mod of item.prefixes) used.add(mod.stat)
  for (const mod of item.suffixes) used.add(mod.stat)
  if (item.special) used.add(item.special.stat)
  return used
}

const STAT_SET = new Set<string>(STAT_KEYS)

function asStat(value: unknown): StatKey | null {
  return typeof value === 'string' && STAT_SET.has(value) ? (value as StatKey) : null
}

function asMod(value: unknown, fallbackName?: string): ItemMod | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { stat?: unknown; value?: unknown; name?: unknown }
  const stat = asStat(raw.stat)
  if (!stat || typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return null
  const name = typeof raw.name === 'string' ? raw.name : (fallbackName ?? '')
  return { stat, value: raw.value, name }
}

type LooseItem = {
  id?: unknown
  playerId?: unknown
  player_id?: unknown
  slotType?: unknown
  slot_type?: unknown
  weaponHand?: unknown
  weapon_hand?: unknown
  rarity?: unknown
  baseId?: unknown
  base_id?: unknown
  name?: unknown
  affixes?: unknown
  implicit?: unknown
  prefixes?: unknown
  suffixes?: unknown
  special?: unknown
  rank?: unknown
  forgePity?: unknown
  forge_pity?: unknown
  equippedSlot?: unknown
  equipped_slot?: unknown
  locked?: unknown
}

export function normalizeItem(value: unknown): Item | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as LooseItem
  if (typeof raw.id !== 'string') return null
  const rarity = normalizeRarity(String(raw.rarity ?? 'common'))
  const baseId = String(raw.baseId ?? raw.base_id ?? '')
  const base = itemBases.find((entry) => entry.id === baseId)
  const slotType = (raw.slotType ?? raw.slot_type ?? base?.slotType) as Item['slotType']
  const weaponHand = (raw.weaponHand ?? raw.weapon_hand ?? base?.weaponHand ?? null) as Item['weaponHand']
  const equippedSlot = (raw.equippedSlot ?? raw.equipped_slot ?? null) as Item['equippedSlot']
  const playerId = String(raw.playerId ?? raw.player_id ?? '')

  if (raw.implicit && typeof raw.implicit === 'object') {
    const implicit = asMod(raw.implicit, '')
    if (!implicit) return null
    const prefixes = Array.isArray(raw.prefixes)
      ? raw.prefixes
          .map((entry) => asMod(entry))
          .filter((entry): entry is ItemMod => entry !== null)
          .map((entry) => snapToTier(entry, rarity))
      : []
    const suffixes = Array.isArray(raw.suffixes)
      ? raw.suffixes
          .map((entry) => asMod(entry))
          .filter((entry): entry is ItemMod => entry !== null)
          .map((entry) => snapToTier(entry, rarity))
      : []
    const special = raw.special == null ? null : asMod(raw.special)
    const rank = Math.max(0, Math.min(10, Math.floor(Number(raw.rank ?? 0)) || 0))
    const forgePity = Math.max(0, Math.floor(Number(raw.forgePity ?? raw.forge_pity ?? 0)) || 0)
    return withItemName({
      id: raw.id,
      playerId,
      slotType,
      weaponHand,
      rarity,
      baseId,
      name: typeof raw.name === 'string' ? raw.name : baseItemName(baseId),
      implicit,
      prefixes,
      suffixes,
      special,
      rank,
      forgePity,
      equippedSlot,
      locked: Boolean(raw.locked),
    })
  }

  const legacy = Array.isArray(raw.affixes) ? raw.affixes : []
  const first = asMod(legacy[0])
  const implicit: ItemMod = first
    ? { ...first, name: '' }
    : {
        stat: base?.implicit.stat ?? 'attack',
        value: base?.implicit.value ?? 1,
        name: '',
      }
  const cap = modCap(rarity)
  const prefixes: ItemMod[] = []
  const suffixes: ItemMod[] = []
  for (const entry of legacy.slice(1)) {
    const mod = asMod(entry)
    if (!mod) continue
    const prefixStat = PREFIX_STATS.includes(mod.stat)
    const suffixStat = SUFFIX_STATS.includes(mod.stat)
    if (prefixStat && prefixes.length < cap.prefixes) {
      prefixes.push(snapToTier(mod, rarity))
    } else if (suffixStat && suffixes.length < cap.suffixes) {
      suffixes.push(snapToTier(mod, rarity))
    } else if (prefixes.length < cap.prefixes) {
      prefixes.push(snapToTier(mod, rarity))
    } else if (suffixes.length < cap.suffixes) {
      suffixes.push(snapToTier(mod, rarity))
    }
  }

  return withItemName({
    id: raw.id,
    playerId,
    slotType,
    weaponHand,
    rarity,
    baseId,
    name: baseItemName(baseId),
    implicit,
    prefixes,
    suffixes,
    special: null,
    rank: 0,
    forgePity: 0,
    equippedSlot,
    locked: Boolean(raw.locked),
  })
}

export function rollSpecial(rng: () => number, rarity: Rarity): ItemMod | null {
  const mode = specialRoll(rarity)
  if (mode === 'never') return null
  if (mode === 'chance' && rng() >= RARE_SPECIAL_CHANCE) return null
  const pick = SPECIALS[Math.floor(rng() * SPECIALS.length)] ?? SPECIALS[0]
  return { stat: pick.stat, name: pick.name, value: pick.value }
}
