import { slotsForType } from '../../game/equipment'
import { RARITY_CHIP, RARITY_LABEL } from '../../game/rarity'
import { MAX_INVENTORY, RARITIES, SLOT_TYPES, type Rarity, type SlotType } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { ItemCard } from '../items/ItemCard'
import { Modal } from '../ui/Modal'
import { useMemo, useState } from 'react'

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

export function InventoryScreen() {
  const items = useGameStore((s) => s.items)
  const selectedItemId = useGameStore((s) => s.selectedItemId)
  const selectItem = useGameStore((s) => s.selectItem)
  const equip = useGameStore((s) => s.equip)
  const setScreen = useGameStore((s) => s.setScreen)
  const selected = items.find((item) => item.id === selectedItemId && !item.equippedSlot)
  const [filterOpen, setFilterOpen] = useState(false)
  const [types, setTypes] = useState<SlotType[]>([])
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [draftTypes, setDraftTypes] = useState<SlotType[]>([])
  const [draftRarities, setDraftRarities] = useState<Rarity[]>([])

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

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl text-amber-100">Equipment</h2>
          <p className="text-sm text-stone-400">
            {unequipped.length}/{MAX_INVENTORY} in bag
          </p>
        </div>
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
      {bag.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-700 p-8 text-stone-500">
          {unequipped.length === 0
            ? 'No spare equipment. Stay on combat and let the expedition farm.'
            : 'No equipment matches these filters.'}
        </p>
      ) : (
        <div className="grid gap-2">
          {bag.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              selected={item.id === selectedItemId}
              onSelect={() => selectItem(item.id)}
            />
          ))}
        </div>
      )}
      {selected && (
        <div className="mt-4 flex flex-wrap gap-2">
          {slotsForType(selected.slotType).map((slot) => (
            <button
              key={slot}
              type="button"
              className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm"
              onClick={() => {
                equip(selected.id, slot)
                setScreen('character')
              }}
            >
              Equip {slot.replace('_', ' ')}
            </button>
          ))}
        </div>
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
