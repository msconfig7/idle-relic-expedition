import type { EquipSlot, SlotType } from '../../game/types'

const v = '?v=3'

export const SLOT_ICON: Record<SlotType, string> = {
  helmet: `/equipment/helmet.png${v}`,
  amulet: `/equipment/amulet.png${v}`,
  weapon: `/equipment/sword.png${v}`,
  armour: `/equipment/armour.png${v}`,
  belt: `/equipment/belt.png${v}`,
  ring: `/equipment/ring.png${v}`,
  gloves: `/equipment/gloves.png${v}`,
  boots: `/equipment/boots.png${v}`,
}

const WEAPON_ICON: Record<string, string> = {
  'short-sword': `/equipment/sword.png${v}`,
  hatchet: `/equipment/hatchet.png${v}`,
  'runed-wand': `/equipment/wand.png${v}`,
  greatsword: `/equipment/greatsword.png${v}`,
  'war-staff': `/equipment/staff.png${v}`,
  'oak-buckler': `/equipment/shield.png${v}`,
  'focus-orb': `/equipment/orb.png${v}`,
}

const WEAPON_KIND: Record<string, string> = {
  'short-sword': 'Sword',
  hatchet: 'Axe',
  'runed-wand': 'Wand',
  greatsword: '2H Sword',
  'war-staff': 'Staff',
  'oak-buckler': 'Shield',
  'focus-orb': 'Orb',
}

export function itemIcon(item: { slotType: SlotType; baseId: string }): string {
  if (item.slotType === 'weapon') return WEAPON_ICON[item.baseId] ?? SLOT_ICON.weapon
  return SLOT_ICON[item.slotType]
}

export function itemKindLabel(item: { slotType: SlotType; baseId: string }): string {
  if (item.slotType === 'weapon') return WEAPON_KIND[item.baseId] ?? TYPE_LABEL.weapon
  return TYPE_LABEL[item.slotType]
}

export const TYPE_LABEL: Record<SlotType, string> = {
  helmet: 'Helmet',
  amulet: 'Amulet',
  weapon: 'Weapon',
  armour: 'Armour',
  belt: 'Belt',
  ring: 'Ring',
  gloves: 'Gloves',
  boots: 'Boots',
}

const SLOT_TO_TYPE: Record<EquipSlot, SlotType> = {
  helmet: 'helmet',
  amulet: 'amulet',
  weapon_main: 'weapon',
  weapon_offhand: 'weapon',
  armour: 'armour',
  belt: 'belt',
  ring_1: 'ring',
  ring_2: 'ring',
  gloves: 'gloves',
  boots: 'boots',
}

export function slotTypeForEquip(slot: EquipSlot): SlotType {
  return SLOT_TO_TYPE[slot]
}

export function slotIconForEquip(slot: EquipSlot): string {
  return SLOT_ICON[SLOT_TO_TYPE[slot]]
}
