import { equippedInSlot, slotsForType } from '../../game/equipment'
import { salvageScrap } from '../../game/salvage'
import { RARITY_CHIP, RARITY_CLASS, RARITY_LABEL } from '../../game/rarity'
import {
  MAX_INVENTORY,
  RARITIES,
  SLOT_TYPES,
  type EquipSlot,
  type Item,
  type Rarity,
  type SlotType,
} from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { ItemCard, slotLabel } from '../items/ItemCard'
import { SLOT_ICON, TYPE_LABEL } from '../items/slotIcons'
import { Modal } from '../ui/Modal'
import { useMemo, useState } from 'react'

export function InventoryScreen() {
  const items = useGameStore((s) => s.items)
  const selectedItemId = useGameStore((s) => s.selectedItemId)
  const selectItem = useGameStore((s) => s.selectItem)
  const equip = useGameStore((s) => s.equip)
  const salvage = useGameStore((s) => s.salvage)
  const unseenItemIds = useGameStore((s) => s.unseenItemIds)
  const unseen = useMemo(() => new Set(unseenItemIds), [unseenItemIds])
  const selected = items.find((item) => item.id === selectedItemId && !item.equippedSlot)
  const equippedComparisons = useMemo(() => {
    if (!selected) return [] as { slot: EquipSlot; equipped: Item }[]
    const filled: { slot: EquipSlot; equipped: Item }[] = []
    for (const slot of slotsForType(selected.slotType)) {
      const equipped = equippedInSlot(items, slot)
      if (equipped) filled.push({ slot, equipped })
    }
    return filled
  }, [items, selected])
  const [filterOpen, setFilterOpen] = useState(false)
  const [types, setTypes] = useState<SlotType[]>([])
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [draftTypes, setDraftTypes] = useState<SlotType[]>([])
  const [draftRarities, setDraftRarities] = useState<Rarity[]>([])
  const [salvageOpen, setSalvageOpen] = useState(false)
  const [salvageRarities, setSalvageRarities] = useState<Rarity[]>([])

  const unequipped = useMemo(() => items.filter((item) => !item.equippedSlot), [items])
  const bag = useMemo(() => {
    const filtered = unequipped.filter((item) => {
      if (types.length && !types.includes(item.slotType)) return false
      if (rarities.length && !rarities.includes(item.rarity)) return false
      return true
    })
    return [...filtered].reverse()
  }, [unequipped, types, rarities])

  const activeFilters = types.length + rarities.length
  const salvageTargets = useMemo(
    () => unequipped.filter((item) => !item.locked && salvageRarities.includes(item.rarity)),
    [unequipped, salvageRarities],
  )
  const salvageTotal = salvageTargets.reduce((sum, item) => sum + salvageScrap(item), 0)

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl text-amber-100">Equipment</h2>
          <p className="text-sm text-stone-400">
            {unequipped.length}/{MAX_INVENTORY} in bag
          </p>
        </div>
        <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm disabled:opacity-40"
          disabled={unequipped.length === 0}
          onClick={() => {
            setSalvageRarities([])
            setSalvageOpen(true)
          }}
        >
          Salvage
        </button>
        <button
          type="button"
          className="relative rounded-lg border border-stone-600 px-3 py-1.5 text-sm"
          onClick={() => {
            setDraftTypes(types)
            setDraftRarities(rarities)
            setFilterOpen(true)
          }}
        >
          Filter
          {activeFilters > 0 && (
            <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-stone-950">{activeFilters}</span>
          )}
        </button>
        </div>
      </div>
      {bag.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-700 p-8 text-stone-500">
          {unequipped.length === 0
            ? 'No spare equipment. Stay on combat and let the expedition farm.'
            : 'No equipment matches these filters.'}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {bag.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(item.id)}
              className={`relative flex flex-col items-center rounded-xl border-2 bg-stone-950 px-1 py-1.5 text-center ${RARITY_CLASS[item.rarity]} ${
                item.id === selectedItemId ? 'ring-2 ring-white/70' : ''
              }`}
            >
              {unseen.has(item.id) ? (
                <span className="absolute right-1 top-1 rounded-full bg-amber-400 px-1.5 text-[9px] font-semibold leading-4 text-stone-950">
                  New
                </span>
              ) : null}
              <img src={SLOT_ICON[item.slotType]} alt="" className="h-14 w-full object-contain" />
              <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-stone-100">{item.name}</span>
              <span className="text-[9px] uppercase tracking-wide">{TYPE_LABEL[item.slotType]}</span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => selectItem(null)}>
          <ItemCard
            item={selected}
            compareWith={equippedComparisons.map(({ slot, equipped }) => ({
              label: equippedComparisons.length > 1 ? slotLabel(slot) : undefined,
              item: equipped,
            }))}
          />
          {equippedComparisons.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Currently equipped
              </p>
              {equippedComparisons.map(({ slot, equipped }) => (
                <div key={slot}>
                  {equippedComparisons.length > 1 && (
                    <p className="mb-1 text-[11px] text-stone-500">{slotLabel(slot)}</p>
                  )}
                  <ItemCard item={equipped} compareWith={[{ item: selected }]} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {slotsForType(selected.slotType).map((slot) => (
              <button
                key={slot}
                type="button"
                className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm"
                onClick={() => {
                  equip(selected.id, slot)
                  selectItem(null)
                }}
              >
                Equip {slotLabel(slot)}
              </button>
            ))}
            <button
              type="button"
              className="rounded-lg border border-red-900/80 px-3 py-1.5 text-sm text-red-300"
              onClick={() => {
                salvage([selected.id])
                selectItem(null)
              }}
            >
              Salvage · +{salvageScrap(selected)} scrap
            </button>
          </div>
        </Modal>
      )}
      {salvageOpen && (
        <Modal
          title="Mass salvage"
          onClose={() => setSalvageOpen(false)}
          footer={
            <button
              type="button"
              disabled={salvageTargets.length === 0}
              className="w-full rounded-lg bg-red-900 py-2 text-sm text-red-50 disabled:opacity-40"
              onClick={() => {
                salvage(salvageTargets.map((item) => item.id))
                setSalvageOpen(false)
              }}
            >
              {salvageTargets.length === 0
                ? 'Nothing to salvage'
                : `Salvage ${salvageTargets.length} · +${salvageTotal.toLocaleString()} scrap`}
            </button>
          }
        >
          <p className="text-xs text-stone-500">
            Break spare gear into scrap. Equipped items stay on your hero. Select rarities to include.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {RARITIES.map((rarity) => {
              const on = salvageRarities.includes(rarity)
              return (
                <button
                  key={rarity}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-xs ${RARITY_CHIP[rarity]} ${
                    on ? 'ring-2 ring-white/70' : 'opacity-50'
                  }`}
                  onClick={() =>
                    setSalvageRarities((current) =>
                      on ? current.filter((entry) => entry !== rarity) : [...current, rarity],
                    )
                  }
                >
                  {RARITY_LABEL[rarity]}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-stone-300">
            {salvageTargets.length} item{salvageTargets.length === 1 ? '' : 's'} · +{salvageTotal.toLocaleString()} scrap
          </p>
        </Modal>
      )}
      {filterOpen && (
        <Modal
          title="Filter equipment"
          onClose={() => setFilterOpen(false)}
          footer={
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                type="button"
                className="rounded-lg border border-stone-600 py-2"
                onClick={() => {
                  setDraftTypes([])
                  setDraftRarities([])
                  setTypes([])
                  setRarities([])
                  setFilterOpen(false)
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-700 py-2"
                onClick={() => {
                  setTypes(draftTypes)
                  setRarities(draftRarities)
                  setFilterOpen(false)
                }}
              >
                Apply
              </button>
            </div>
          }
        >
          <p className="text-xs text-stone-500">Leave a group empty to include all.</p>
          <fieldset className="mt-3">
            <legend className="mb-2 text-xs uppercase tracking-wide text-stone-500">Equipment type</legend>
            <div className="flex flex-wrap gap-1.5">
              {SLOT_TYPES.map((type) => {
                const on = draftTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      on ? 'bg-amber-700 text-amber-50' : 'bg-stone-800 text-stone-300'
                    }`}
                    onClick={() =>
                      setDraftTypes((current) =>
                        on ? current.filter((entry) => entry !== type) : [...current, type],
                      )
                    }
                  >
                    {TYPE_LABEL[type]}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="mb-2 text-xs uppercase tracking-wide text-stone-500">Rarity</legend>
            <div className="flex flex-wrap gap-1.5">
              {RARITIES.map((rarity) => {
                const on = draftRarities.includes(rarity)
                return (
                  <button
                    key={rarity}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-xs ${RARITY_CHIP[rarity]} ${
                      on ? 'ring-2 ring-white/70' : 'opacity-80'
                    }`}
                    onClick={() =>
                      setDraftRarities((current) =>
                        on ? current.filter((entry) => entry !== rarity) : [...current, rarity],
                      )
                    }
                  >
                    {RARITY_LABEL[rarity]}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </Modal>
      )}
    </div>
  )
}
