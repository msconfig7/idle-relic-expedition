import {
  BAG_LEVEL_MAX,
  bagCapacity,
  bagUpgradeOffer,
  type BagPayWith,
} from '../../game/bag'
import { useGameStore } from '../../state/gameStore'
import { Modal } from '../ui/Modal'
import { useState } from 'react'

export function ExpandBagModal({ onClose }: { onClose: () => void }) {
  const player = useGameStore((s) => s.player)
  const items = useGameStore((s) => s.items)
  const expandBag = useGameStore((s) => s.expandBag)
  const [busy, setBusy] = useState<BagPayWith | null>(null)
  const [error, setError] = useState('')

  if (!player) return null

  const level = player.bagLevel
  const slots = bagCapacity(level)
  const used = items.filter((item) => !item.equippedSlot).length
  const offer = bagUpgradeOffer(level)

  async function buy(payWith: BagPayWith) {
    if (busy) return
    setBusy(payWith)
    setError('')
    const outcome = await expandBag(payWith)
    setBusy(null)
    if (!outcome.ok) setError(outcome.reason)
  }

  return (
    <Modal title="Expand bag" onClose={onClose}>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-stone-700 bg-stone-950 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-stone-500">Slots</dt>
          <dd className="mt-0.5 font-serif text-xl tabular-nums text-amber-100">
            {used}/{slots}
          </dd>
        </div>
        <div className="rounded-xl border border-stone-700 bg-stone-950 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-stone-500">Bag level</dt>
          <dd className="mt-0.5 font-serif text-xl tabular-nums text-amber-100">
            {level}/{BAG_LEVEL_MAX}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-stone-500">
        {player.gold.toLocaleString()} gold · {player.diamonds.toLocaleString()} diamonds
      </p>
      {offer ? (
        <div className="mt-3">
          <p className="text-sm text-stone-300">
            Next level adds {offer.nextSlots - offer.slots} slots
            <span className="text-stone-500">
              {' '}
              · {offer.slots} → {offer.nextSlots}
            </span>
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Bag level {level}/{BAG_LEVEL_MAX} → {offer.nextLevel}/{BAG_LEVEL_MAX}
          </p>
          <div className="mt-3 grid gap-2">
            {offer.gold != null && (
              <button
                type="button"
                disabled={busy != null || player.gold < offer.gold}
                className="rounded-lg bg-amber-700 py-2 text-sm font-medium text-amber-50 disabled:opacity-40"
                onClick={() => void buy('gold')}
              >
                {busy === 'gold' ? 'Expanding…' : `${offer.gold.toLocaleString()} gold`}
              </button>
            )}
            <button
              type="button"
              disabled={busy != null || player.diamonds < offer.diamonds}
              className="rounded-lg bg-cyan-800 py-2 text-sm font-medium text-cyan-50 disabled:opacity-40"
              onClick={() => void buy('diamonds')}
            >
              {busy === 'diamonds' ? 'Expanding…' : `${offer.diamonds.toLocaleString()} diamonds`}
            </button>
          </div>
          {offer.gold != null && (
            <p className="mt-2 text-xs text-stone-500">Gold expansions can also be bought for 5 diamonds.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-300">This bag is fully expanded.</p>
      )}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </Modal>
  )
}
