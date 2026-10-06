import type { EquipSlot, SlotType } from '../../game/types'

export const SLOT_ICON: Record<SlotType, string> = {
  helmet: '/equipment/helmet.png',
  amulet: '/equipment/amulet.png',
  weapon: '/equipment/sword.png',
  armour: '/equipment/armour.png?v=2',
  belt: '/equipment/belt.png',
  ring: '/equipment/ring.png',
  gloves: '/equipment/gloves.png',
  boots: '/equipment/boots.png',
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
