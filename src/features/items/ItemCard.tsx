import { formatAffix, isPercentStat } from '../../game/format'
import { listItemMods, modTotal } from '../../game/items'
import { RARITY_CLASS, RARITY_LABEL } from '../../game/rarity'
import type { EquipSlot, Item, SlotType, StatKey, WeaponHand } from '../../game/types'
import { equippedInSlot } from '../../game/equipment'
import type { ReactNode } from 'react'

export function ItemCard({
  item,
  equipped,
  compareWith,
  selected,
  onSelect,
}: {
  item: Item
  equipped?: Item
  compareWith?: { label?: string; item: Item }[]
  selected?: boolean
  onSelect?: () => void
}) {
  const targets = compareWith ?? (equipped ? [{ item: equipped }] : undefined)

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
            {targets && compareDeltas(mod.stat, item, targets)}
          </li>
        ))}
      </ul>
    </button>
  )
}

function compareDeltas(
  stat: StatKey,
  item: Item,
  targets: { label?: string; item: Item }[],
): ReactNode {
  const parts = targets
    .map(({ label, item: equipped }) => {
      const text = formatDelta(stat, item, equipped)
      if (!text) return null
      const d = statTotal(item, stat) - statTotal(equipped, stat)
      return (
        <span key={label ?? equipped.id} className={d > 0 ? ' text-emerald-400' : ' text-red-400'}>
          {' '}
          ({label ? `${label} ` : ''}
          {text})
        </span>
      )
    })
    .filter(Boolean)
  return parts.length ? parts : null
}

const MOD_CLASS = {
  implicit: 'text-stone-300',
  prefix: 'text-sky-300',
  suffix: 'text-emerald-300',
  special: 'text-amber-200',
} as const

function statTotal(item: Item, stat: StatKey): number {
  return modTotal(item, stat)
}

function formatDelta(stat: StatKey, item: Item, equipped: Item): string | null {
  const d = statTotal(item, stat) - statTotal(equipped, stat)
  if (Math.abs(d) < 1e-6) return null
  const sign = d > 0 ? '+' : ''
  if (stat === 'hpRegen') return `${sign}${d.toFixed(1)}/s`
  if (isPercentStat(stat)) {
    const digits =
      stat === 'critMulti' || stat === 'xpMod' || stat === 'goldMod' || stat === 'lifeSteal' ? 0 : 1
    return `${sign}${(d * 100).toFixed(digits)}%`
  }
  return `${sign}${Number.isInteger(d) ? d : d.toFixed(1)}`
}

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
