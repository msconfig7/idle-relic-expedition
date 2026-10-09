import { z } from 'zod'
import type { EquipSlot, EssenceCounts, Item, ItemMod, PlayerState, Rarity, SlotType, WeaponHand } from '../game/types'
import { getRealm, huntIndex } from '../game/combat'
import { normalizeItem } from '../game/items'
import { EQUIP_SLOTS, RARITIES, SLOT_TYPES, STAT_KEYS, WEAPON_HANDS } from '../game/types'

export const affixSchema = z.object({
  stat: z.enum(STAT_KEYS),
  value: z.number(),
})

export const itemModSchema = z.object({
  stat: z.enum(STAT_KEYS),
  value: z.number(),
  name: z.string(),
})

export const itemSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  slotType: z.enum(SLOT_TYPES),
  weaponHand: z.enum(WEAPON_HANDS).nullable(),
  rarity: z.preprocess((value) => (value === 'uncommon' ? 'magic' : value), z.enum(RARITIES)),
  baseId: z.string(),
  name: z.string(),
  implicit: itemModSchema,
  prefixes: z.array(itemModSchema),
  suffixes: z.array(itemModSchema),
  special: itemModSchema.nullable(),
  rank: z.number().int().min(0).max(10),
  forgePity: z.number().int().nonnegative(),
  equippedSlot: z.enum(EQUIP_SLOTS).nullable(),
  locked: z.boolean(),
})

export const playerSchema = z.object({
  id: z.string(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  diamonds: z.number().int().nonnegative(),
  scrap: z.number().int().nonnegative(),
  essences: z.record(z.string(), z.number().int().nonnegative()).optional(),
  realmId: z.number().int().positive(),
  highestRealmId: z.number().int().positive().optional(),
  realmProgress: z.number().int().min(0).max(10_000),
  monsterIndex: z.number().int().nonnegative().optional(),
  queuedMonsterIndex: z.number().int().nonnegative().optional(),
  skillPointsUnspent: z.number().int().nonnegative(),
  allocatedNodeIds: z.array(z.number().int()),
  lastSettledAt: z.number(),
  contentVersion: z.number().int(),
})

export type PlayerRow = {
  id: string
  level: number
  xp: number
  gold: number
  diamonds: number
  scrap: number
  essences?: EssenceCounts
  realm_id: number
  realm_progress: number
  monster_index?: number
  queued_monster_index?: number
  skill_points_unspent: number
  allocated_node_ids: number[]
  highest_realm_id?: number
  last_settled_at: string
  content_version: number
}

export type ItemRow = {
  id: string
  player_id: string
  slot_type: SlotType
  weapon_hand: WeaponHand | null
  rarity: Rarity
  base_id: string
  name: string
  affixes?: { stat: ItemMod['stat']; value: number }[]
  implicit?: ItemMod | null
  prefixes?: ItemMod[]
  suffixes?: ItemMod[]
  special?: ItemMod | null
  rank?: number
  forge_pity?: number
  equipped_slot: EquipSlot | null
  locked: boolean
}

export function playerFromRow(row: PlayerRow): PlayerState {
  const parsed = playerSchema.parse({
    id: row.id,
    level: row.level,
    xp: Number(row.xp),
    gold: Number(row.gold),
    diamonds: Number(row.diamonds),
    scrap: Number(row.scrap),
    essences: row.essences ?? {},
    realmId: row.realm_id,
    highestRealmId: row.highest_realm_id ?? row.realm_id,
    realmProgress: row.realm_progress,
    monsterIndex: row.monster_index ?? 0,
    queuedMonsterIndex: row.queued_monster_index ?? row.monster_index ?? 0,
    skillPointsUnspent: row.skill_points_unspent,
    allocatedNodeIds: row.allocated_node_ids ?? [0],
    lastSettledAt: new Date(row.last_settled_at).getTime(),
    contentVersion: row.content_version,
  })
  const realm = getRealm(parsed.realmId)
  const monsterIndex = huntIndex(realm, parsed.monsterIndex)
  return {
    ...parsed,
    essences: parsed.essences ?? {},
    highestRealmId: Math.max(parsed.highestRealmId ?? parsed.realmId, parsed.realmId),
    monsterIndex,
    queuedMonsterIndex: huntIndex(realm, parsed.queuedMonsterIndex ?? monsterIndex),
  }
}

export function playerToRow(player: PlayerState): PlayerRow {
  return {
    id: player.id,
    level: player.level,
    xp: player.xp,
    gold: player.gold,
    diamonds: player.diamonds,
    scrap: player.scrap,
    essences: player.essences ?? {},
    realm_id: player.realmId,
    highest_realm_id: player.highestRealmId,
    realm_progress: player.realmProgress,
    monster_index: player.monsterIndex,
    queued_monster_index: player.queuedMonsterIndex,
    skill_points_unspent: player.skillPointsUnspent,
    allocated_node_ids: player.allocatedNodeIds,
    last_settled_at: new Date(player.lastSettledAt).toISOString(),
    content_version: player.contentVersion,
  }
}

function flatAffixes(item: Item): { stat: ItemMod['stat']; value: number }[] {
  return [item.implicit, ...item.prefixes, ...item.suffixes, ...(item.special ? [item.special] : [])].map(
    (mod) => ({ stat: mod.stat, value: mod.value }),
  )
}

export function itemFromRow(row: ItemRow): Item {
  const normalized = normalizeItem({
    id: row.id,
    playerId: row.player_id,
    slotType: row.slot_type,
    weaponHand: row.weapon_hand,
    rarity: row.rarity,
    baseId: row.base_id,
    name: row.name,
    affixes: row.affixes,
    implicit: row.implicit,
    prefixes: row.prefixes,
    suffixes: row.suffixes,
    special: row.special,
    rank: row.rank,
    forgePity: row.forge_pity,
    equippedSlot: row.equipped_slot,
    locked: row.locked,
  })
  if (!normalized) {
    throw new Error(`Invalid item ${row.id}`)
  }
  return itemSchema.parse(normalized)
}

export function itemToRow(item: Item): ItemRow {
  return {
    id: item.id,
    player_id: item.playerId,
    slot_type: item.slotType,
    weapon_hand: item.weaponHand,
    rarity: item.rarity,
    base_id: item.baseId,
    name: item.name,
    affixes: flatAffixes(item),
    implicit: item.implicit,
    prefixes: item.prefixes,
    suffixes: item.suffixes,
    special: item.special,
    rank: item.rank,
    forge_pity: item.forgePity,
    equipped_slot: item.equippedSlot,
    locked: item.locked,
  }
}
