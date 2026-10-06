import { z } from 'zod'
import type { Affix, EquipSlot, Item, PlayerState, Rarity, SlotType, WeaponHand } from '../game/types'
import { getRealm, huntIndex } from '../game/combat'
import { EQUIP_SLOTS, RARITIES, SLOT_TYPES, STAT_KEYS, WEAPON_HANDS } from '../game/types'

export const affixSchema = z.object({
  stat: z.enum(STAT_KEYS),
  value: z.number(),
})

export const itemSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  slotType: z.enum(SLOT_TYPES),
  weaponHand: z.enum(WEAPON_HANDS).nullable(),
  rarity: z.preprocess((value) => (value === 'uncommon' ? 'magic' : value), z.enum(RARITIES)),
  baseId: z.string(),
  name: z.string(),
  affixes: z.array(affixSchema),
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
  affixes: Affix[]
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

export function itemFromRow(row: ItemRow): Item {
  return itemSchema.parse({
    id: row.id,
    playerId: row.player_id,
    slotType: row.slot_type,
    weaponHand: row.weapon_hand,
    rarity: row.rarity,
    baseId: row.base_id,
    name: row.name.replace(/^Uncommon /, 'Magic '),
    affixes: row.affixes,
    equippedSlot: row.equipped_slot,
    locked: row.locked,
  })
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
    affixes: item.affixes,
    equipped_slot: item.equippedSlot,
    locked: item.locked,
  }
}
