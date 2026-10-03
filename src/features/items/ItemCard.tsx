import { formatAffix } from '../../game/format'
import { RARITY_CLASS, RARITY_LABEL } from '../../game/rarity'
import type { EquipSlot, Item } from '../../game/types'
import { equippedInSlot } from '../../game/equipment'

export function ItemCard({
  item,
  equipped,
  selected,
  onSelect,
}: {
  item: Item
  equipped?: Item
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
        {RARITY_LABEL[item.rarity]} · {item.slotType}
        {item.weaponHand ? ` · ${item.weaponHand.replace('_', ' ')}` : ''}
        {item.equippedSlot ? ' · equipped' : ''}
      </p>
      <ul className="mt-2 space-y-0.5 text-xs text-stone-300">
        {item.affixes.map((affix, i) => (
          <li key={`${affix.stat}-${i}`}>
            {formatAffix(affix)}
            {equipped && compare(affix.stat, item, equipped)}
          </li>
        ))}
      </ul>
    </button>
  )
}

function compare(stat: Item['affixes'][0]['stat'], item: Item, equipped: Item) {
  const a = item.affixes.filter((x) => x.stat === stat).reduce((s, x) => s + x.value, 0)
  const b = equipped.affixes.filter((x) => x.stat === stat).reduce((s, x) => s + x.value, 0)
  const d = a - b
  if (Math.abs(d) < 1e-6) return null
  return <span className={d > 0 ? ' text-emerald-400' : ' text-red-400'}> ({d > 0 ? '+' : ''}{d.toFixed(2)})</span>
}

export function slotLabel(slot: EquipSlot): string {
  return slot.replace('_', ' ')
}

export function compareTarget(items: Item[], slot: EquipSlot | null): Item | undefined {
  if (!slot) return undefined
  return equippedInSlot(items, slot)
}
