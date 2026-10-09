import { STAT_HELP, STAT_LABELS, formatStat, type EquipSlot } from '../../game'
import { canEquip, equippedInSlot, mainIsTwoHanded } from '../../game'
import { RARITY_CLASS } from '../../game/rarity'
import type { Item } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { ForgeModal } from '../craft/ForgeModal'
import { ItemCard, slotLabel } from '../items/ItemCard'
import { SLOT_ICON, slotIconForEquip } from '../items/slotIcons'
import { Modal } from '../ui/Modal'
import { useEffect, useRef, useState } from 'react'
import type { StatKey } from '../../game/types'

const rows: (EquipSlot | null)[][] = [
  [null, 'helmet', 'amulet'],
  ['weapon_main', 'armour', 'weapon_offhand'],
  ['ring_1', 'belt', 'ring_2'],
  [null, 'gloves', 'boots'],
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
  const [forgeItemId, setForgeItemId] = useState<string | null>(null)
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
      <div className="mx-auto grid w-full max-w-[18rem] grid-cols-3 gap-2">
        {rows.flatMap((row, rowIndex) =>
          row.map((slot, colIndex) =>
            slot ? (
              <EquipSlotTile
                key={slot}
                slot={slot}
                filled={equippedInSlot(items, slot)}
                blocked={slot === 'weapon_offhand' && twoHand}
                selected={selectedItemId === equippedInSlot(items, slot)?.id}
                onSelect={() => {
                  const fromBag = selected && !selected.equippedSlot ? selected : null
                  if (fromBag && !(slot === 'weapon_offhand' && twoHand) && canEquip(items, fromBag, slot).ok) {
                    equip(fromBag.id, slot)
                    selectItem(null)
                    return
                  }
                  const filled = equippedInSlot(items, slot)
                  if (filled) selectItem(filled.id === selectedItemId ? null : filled.id)
                }}
              />
            ) : (
              <div key={`pad-${rowIndex}-${colIndex}`} />
            ),
          ),
        )}
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
                className="relative flex h-14 items-center gap-2 overflow-hidden rounded-lg bg-stone-950 px-2.5"
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
                  className={`relative z-20 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    open ? 'bg-amber-800 text-amber-100' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                  onClick={() => setHelpStat((current) => (current === key ? null : key))}
                >
                  <HelpGlyph />
                </button>
                {open && (
                  <p className="absolute inset-0 z-10 flex items-center bg-stone-900/95 px-2.5 py-1.5 pr-9 text-[11px] leading-snug text-amber-50">
                    {STAT_HELP[key]}
                  </p>
                )}
              </div>
            )
          })}
        </dl>
      </section>
      {selected?.equippedSlot && (
        <Modal title={selected.name} onClose={() => selectItem(null)}>
          <ItemCard item={selected} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-orange-900 px-3 py-1.5 text-sm text-orange-50"
              onClick={() => setForgeItemId(selected.id)}
            >
              Forge
            </button>
            <button
              type="button"
              className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm"
              onClick={() => {
                unequip(selected.id)
                selectItem(null)
              }}
            >
              Unequip
            </button>
          </div>
        </Modal>
      )}
      {forgeItemId && <ForgeModal itemId={forgeItemId} onClose={() => setForgeItemId(null)} />}
    </div>
  )
}

function EquipSlotTile({
  slot,
  filled,
  blocked,
  selected,
  onSelect,
}: {
  slot: EquipSlot
  filled: Item | undefined
  blocked: boolean
  selected: boolean
  onSelect: () => void
}) {
  const icon = filled ? SLOT_ICON[filled.slotType] : slotIconForEquip(slot)
  return (
    <button
      type="button"
      disabled={blocked}
      aria-label={filled ? filled.name : slotLabel(slot)}
      aria-disabled={blocked}
      onClick={onSelect}
      className={`relative flex aspect-square items-center justify-center rounded-xl border-2 bg-stone-950 p-2 ${
        blocked
          ? 'cursor-not-allowed border-red-900/70 opacity-35'
          : filled
            ? `${RARITY_CLASS[filled.rarity]} ${selected ? 'ring-2 ring-white/70' : ''}`
            : 'border-dashed border-stone-700'
      }`}
    >
      <img
        src={icon}
        alt=""
        className={`h-full w-full object-contain ${filled && !blocked ? '' : 'opacity-25'}`}
      />
      {!filled && !blocked ? <span className="sr-only">{slotLabel(slot)}</span> : null}
      {blocked ? <span className="sr-only">Occupied by two-handed weapon</span> : null}
    </button>
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
