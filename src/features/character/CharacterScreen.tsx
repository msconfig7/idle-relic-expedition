import { STAT_HELP, STAT_LABELS, formatStat, type EquipSlot } from '../../game'
import { canEquip, equippedInSlot, mainIsTwoHanded } from '../../game'
import { useGameStore } from '../../state/gameStore'
import { ItemCard, slotLabel } from '../items/ItemCard'
import { useEffect, useRef, useState } from 'react'
import type { StatKey } from '../../game/types'

const layout: EquipSlot[] = [
  'helmet',
  'amulet',
  'weapon_main',
  'weapon_offhand',
  'armour',
  'gloves',
  'belt',
  'boots',
  'ring_1',
  'ring_2',
]

export function CharacterScreen() {
  const player = useGameStore((s) => s.player)!
  const items = useGameStore((s) => s.items)
  const stats = useGameStore((s) => s.stats)!
  const selectedItemId = useGameStore((s) => s.selectedItemId)
  const selectItem = useGameStore((s) => s.selectItem)
  const equip = useGameStore((s) => s.equip)
  const unequip = useGameStore((s) => s.unequip)
  const twoHand = mainIsTwoHanded(items)
  const selected = items.find((item) => item.id === selectedItemId)
  const [helpStat, setHelpStat] = useState<StatKey | null>(null)
  const helpBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!helpStat) return
    const onPointerDown = (event: PointerEvent) => {
      if (helpBoxRef.current?.contains(event.target as Node)) return
      setHelpStat(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [helpStat])

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        {layout.map((slot) => {
          const filled = equippedInSlot(items, slot)
          const blocked = slot === 'weapon_offhand' && twoHand
          return (
            <button
              key={slot}
              type="button"
              disabled={blocked}
              aria-disabled={blocked}
              onClick={() => {
                if (selected && !blocked) {
                  const check = canEquip(items, selected, slot)
                  if (check.ok) equip(selected.id, slot)
                } else if (filled) {
                  selectItem(filled.id)
                }
              }}
              className={`min-h-[4.5rem] rounded-xl border p-2 text-left text-xs ${
                blocked
                  ? 'cursor-not-allowed border-red-900/80 bg-red-950/40 text-red-400/80'
                  : filled
                    ? 'border-amber-800 bg-stone-900'
                    : 'border-dashed border-stone-700 bg-stone-950 text-stone-500'
              }`}
            >
              <p className="uppercase tracking-wide text-stone-500">{slotLabel(slot)}</p>
              {blocked ? (
                <p className="mt-1 font-medium text-red-400">Disabled — 2H occupies both hands</p>
              ) : filled ? (
                <p className="text-amber-100">{filled.name}</p>
              ) : (
                <p>Empty</p>
              )}
            </button>
          )
        })}
      </div>
      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-3">
        <h2 className="font-serif text-xl text-amber-100">Attributes</h2>
        <p className="text-xs text-stone-500">
          Level {player.level} · {player.skillPointsUnspent} unspent skill points
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(STAT_LABELS) as StatKey[]).map((key) => {
            const open = helpStat === key
            return (
              <div
                key={key}
                ref={open ? helpBoxRef : undefined}
                className="relative flex h-14 items-center gap-2 rounded-lg bg-stone-950 px-2.5"
              >
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
                    {STAT_LABELS[key]}
                  </dt>
                  <dd className="truncate text-sm tabular-nums text-stone-100">{formatStat(key, stats[key])}</dd>
                </div>
                <button
                  type="button"
                  aria-label={`${STAT_LABELS[key]} info`}
                  aria-expanded={open}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    open ? 'bg-amber-800 text-amber-100' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                  onClick={() => setHelpStat((current) => (current === key ? null : key))}
                >
                  <HelpGlyph />
                </button>
                {open && (
                  <p className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-lg border border-amber-900/70 bg-stone-900 px-2.5 py-2 text-[11px] leading-snug text-amber-50 shadow-lg">
                    {STAT_HELP[key]}
                  </p>
                )}
              </div>
            )
          })}
        </dl>
      </section>
      {selected && (
        <div>
          <ItemCard item={selected} />
          {selected.equippedSlot && (
            <button
              type="button"
              className="mt-2 rounded-lg border border-stone-700 px-3 py-1 text-sm"
              onClick={() => unequip(selected.id)}
            >
              Unequip
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-stone-500">
        Select an inventory item, then tap a slot to equip. Two-handed weapons disable the offhand.
      </p>
    </div>
  )
}

function HelpGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M5.75 6.1a2.25 2.25 0 0 1 4.4.7c0 1.35-1.55 1.7-2.15 2.35-.3.35-.4.7-.4 1.15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8" cy="12.15" r="1" fill="currentColor" />
    </svg>
  )
}
