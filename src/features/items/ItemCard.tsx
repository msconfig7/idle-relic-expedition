import { formatAffix } from '../../game/format'
import { listItemMods } from '../../game/items'
import { RARITY_CLASS, RARITY_LABEL } from '../../game/rarity'
import type { EquipSlot, Item, SlotType, WeaponHand } from '../../game/types'
import { equippedInSlot } from '../../game/equipment'

export function ItemCard({
  item,
  selected,
  onSelect,
}: {
  item: Item
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border bg-stone-950 p-3 text-left text-sm ${RARITY_CLASS[item.rarity]} ${
        selected ? 'ring-2 ring-amber-400' : ''
      }`}
    >
      <p className="font-medium">{item.name}</p>
      <p className={`text-[11px] uppercase tracking-wide ${RARITY_CLASS[item.rarity]}`}>
        {RARITY_LABEL[item.rarity]} · {TYPE_LABEL[item.slotType]}
        {item.weaponHand ? ` · ${HAND_LABEL[item.weaponHand]}` : ''}
        {item.equippedSlot ? ' · equipped' : ''}
      </p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {listItemMods(item).map((mod) => (
          <li
            key={`${mod.kind}-${mod.index}`}
            className={mod.name === 'T1' ? 'text-amber-200' : MOD_CLASS[mod.kind]}
          >
            {mod.kind !== 'implicit' && <span className="font-medium">{mod.name} · </span>}
            {formatAffix({ stat: mod.stat, value: mod.value })}
          </li>
        ))}
      </ul>
    </button>
  )
}

const MOD_CLASS = {
  implicit: 'text-stone-300',
  prefix: 'text-sky-300',
  suffix: 'text-emerald-300',
  special: 'text-amber-200',
} as const

const SLOT_LABEL: Record<EquipSlot, string> = {
  helmet: 'Helmet',
  amulet: 'Amulet',
  weapon_main: 'Main hand',
  weapon_offhand: 'Off hand',
  armour: 'Armour',
  belt: 'Belt',
  ring_1: 'Ring 1',
  ring_2: 'Ring 2',
  gloves: 'Gloves',
  boots: 'Boots',
}

const TYPE_LABEL: Record<SlotType, string> = {
  helmet: 'Helmet',
  amulet: 'Amulet',
  weapon: 'Weapon',
  armour: 'Armour',
  belt: 'Belt',
  ring: 'Ring',
  gloves: 'Gloves',
  boots: 'Boots',
}

const HAND_LABEL: Record<WeaponHand, string> = {
  one_hand: 'One-handed',
  two_hand: 'Two-handed',
  offhand: 'Off hand',
}

export function slotLabel(slot: EquipSlot): string {
  return SLOT_LABEL[slot]
}

export function compareTarget(items: Item[], slot: EquipSlot | null): Item | undefined {
  if (!slot) return undefined
  return equippedInSlot(items, slot)
}
