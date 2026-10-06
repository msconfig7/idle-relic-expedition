import type { EquipSlot, Item, SlotType } from './types'

export function slotsForType(slotType: SlotType): EquipSlot[] {
  switch (slotType) {
    case 'weapon':
      return ['weapon_main', 'weapon_offhand']
    case 'ring':
      return ['ring_1', 'ring_2']
    case 'helmet':
      return ['helmet']
    case 'amulet':
      return ['amulet']
    case 'armour':
      return ['armour']
    case 'belt':
      return ['belt']
    case 'gloves':
      return ['gloves']
    case 'boots':
      return ['boots']
  }
}

export function itemFitsSlot(item: Item, slot: EquipSlot): boolean {
  if (!slotsForType(item.slotType).includes(slot)) return false
  if (item.weaponHand === 'two_hand' && slot !== 'weapon_main') return false
  if (item.weaponHand === 'offhand' && slot !== 'weapon_offhand') return false
  if (item.weaponHand === 'one_hand' && slot !== 'weapon_main' && slot !== 'weapon_offhand') {
    return false
  }
  return true
}

export function equippedInSlot(items: Item[], slot: EquipSlot): Item | undefined {
  return items.find((item) => item.equippedSlot === slot)
}

export function mainIsTwoHanded(items: Item[]): boolean {
  const main = equippedInSlot(items, 'weapon_main')
  return main?.weaponHand === 'two_hand'
}

export function canEquip(items: Item[], item: Item, slot: EquipSlot): { ok: true } | { ok: false; reason: string } {
  if (!itemFitsSlot(item, slot)) {
    return { ok: false, reason: 'That item does not fit this slot.' }
  }
  if (slot === 'weapon_offhand' && mainIsTwoHanded(items) && equippedInSlot(items, 'weapon_main')?.id !== item.id) {
    return { ok: false, reason: 'A two-handed weapon occupies both hands.' }
  }
  if (item.weaponHand === 'two_hand' && slot === 'weapon_main') {
    return { ok: true }
  }
  return { ok: true }
}

export function applyEquip(items: Item[], itemId: string, slot: EquipSlot): Item[] {
  const item = items.find((entry) => entry.id === itemId)
  if (!item || item.equippedSlot) return items
  const check = canEquip(items, item, slot)
  if (!check.ok) return items

  return items.map((entry) => {
    if (entry.id === itemId) {
      return { ...entry, equippedSlot: slot }
    }
    if (entry.equippedSlot === slot) {
      return { ...entry, equippedSlot: null }
    }
    if (item.weaponHand === 'two_hand' && slot === 'weapon_main' && entry.equippedSlot === 'weapon_offhand') {
      return { ...entry, equippedSlot: null }
    }
    return entry
  })
}

export function applyUnequip(items: Item[], itemId: string): Item[] {
  return items.map((entry) => (entry.id === itemId ? { ...entry, equippedSlot: null } : entry))
}

export function equippedItems(items: Item[]): Item[] {
  return items.filter((item) => item.equippedSlot !== null)
}
