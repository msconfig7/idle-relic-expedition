import { formatAffix, isPercentStat } from '../../game/format'
import { modTotal } from '../../game/items'
import { RARITY_LABEL, RARITY_TEXT } from '../../game/rarity'
import { STAT_KEYS, type EquipSlot, type Item, type StatKey } from '../../game/types'
import { slotLabel } from './ItemCard'

export function SwapCompare({
  slot,
  next,
  current,
  onEquip,
}: {
  slot: EquipSlot
  next: Item
  current: Item
  onEquip: () => void
}) {
  const changes = swapChanges(next, current)
  const gains = changes.filter((row) => row.delta > 0)
  const losses = changes.filter((row) => row.delta < 0)
  const label = slotLabel(slot)

  return (
    <section className="rounded-xl border border-stone-800 bg-stone-950 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Replace {label}</p>
      <p className={`mt-1 truncate text-sm font-medium ${RARITY_TEXT[current.rarity]}`}>{current.name}</p>
      <p className="text-[11px] uppercase tracking-wide text-stone-500">{RARITY_LABEL[current.rarity]} · equipped</p>
      {gains.length > 0 && (
        <>
          <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-emerald-400">You gain</p>
          <ul className="mt-1 space-y-0.5 text-xs text-emerald-300">
            {gains.map((row) => (
              <li key={row.stat}>{formatAffix({ stat: row.stat, value: row.delta })}</li>
            ))}
          </ul>
        </>
      )}
      {losses.length > 0 && (
        <>
          <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-red-400">You lose</p>
          <ul className="mt-1 space-y-0.5 text-xs text-red-300">
            {losses.map((row) => (
              <li key={row.stat}>{formatAffix({ stat: row.stat, value: row.delta })}</li>
            ))}
          </ul>
        </>
      )}
      {changes.length === 0 && <p className="mt-2 text-xs text-stone-400">The stats match.</p>}
      <button type="button" className="mt-3 w-full rounded-lg bg-amber-800 py-2 text-sm" onClick={onEquip}>
        Equip {label}
      </button>
    </section>
  )
}

function roundDelta(stat: StatKey, value: number): number {
  if (stat === 'hpRegen' || isPercentStat(stat)) return Math.round(value * 1000) / 1000
  return Math.round(value * 10) / 10
}

function swapChanges(next: Item, current: Item): { stat: StatKey; delta: number }[] {
  const rows: { stat: StatKey; delta: number }[] = []
  for (const stat of STAT_KEYS) {
    const delta = roundDelta(stat, modTotal(next, stat) - modTotal(current, stat))
    if (Math.abs(delta) < 1e-6) continue
    rows.push({ stat, delta })
  }
  return rows
}
