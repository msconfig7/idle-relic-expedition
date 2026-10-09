import { essencesInRealm } from '../../content/essences'
import { getRealm } from '../../game'
import { ascendCost, ascendTarget, essenceHeld, rerollCost, temperChance, temperCost } from '../../game/craft'
import { RARITY_LABEL } from '../../game/rarity'
import { STAT_LABELS } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { ItemCard } from '../items/ItemCard'
import { Modal } from '../ui/Modal'
import { useEffect, useRef, useState } from 'react'

type Phase = 'idle' | 'forging' | 'success' | 'fail'

export function ForgeModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = useGameStore((s) => s.items.find((entry) => entry.id === itemId))
  const player = useGameStore((s) => s.player)
  const temper = useGameStore((s) => s.temperItem)
  const reroll = useGameStore((s) => s.rerollItemMod)
  const ascend = useGameStore((s) => s.ascendItem)
  const [phase, setPhase] = useState<Phase>('idle')
  const [banner, setBanner] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => {
    const bucket = timers.current
    return () => {
      for (const timer of bucket) window.clearTimeout(timer)
    }
  }, [])

  if (!item || !player) return null

  const busy = phase === 'forging'
  const temperPrice = temperCost(item)
  const ascendPrice = ascendCost(item)
  const ascendTo = ascendTarget(item)
  const rerollPrice = rerollCost(item)
  const essences = player.essences ?? {}

  function later(ms: number, run: () => void) {
    const timer = window.setTimeout(run, ms)
    timers.current.push(timer)
  }

  function forge(
    action: () => { ok: true; success: boolean } | { ok: false; reason: string },
    successText: () => string,
    failText: () => string,
  ) {
    if (phase !== 'idle') return
    setPhase('forging')
    setBanner('')
    later(1500, () => {
      const result = action()
      if (!result.ok) {
        setPhase('fail')
        setBanner(result.reason)
      } else if (result.success) {
        setPhase('success')
        setBanner(successText())
      } else {
        setPhase('fail')
        setBanner(failText())
      }
      later(900, () => setPhase('idle'))
    })
  }

  return (
    <Modal title="Forge" onClose={busy ? () => undefined : onClose}>
      <div className={`forge-stage forge-stage-${phase}`}>
        <span className="forge-ember" />
        <span className="forge-hammer" aria-hidden="true">
          <Hammer />
        </span>
        {phase === 'success' && <span className="forge-flash" />}
        {phase === 'fail' && <span className="forge-crack" />}
        <p className="relative z-10 px-6 text-center text-sm font-medium text-amber-50">{item.name}</p>
      </div>
      <p className="mt-2 min-h-5 text-center text-xs text-stone-300">
        {banner || `${RARITY_LABEL[item.rarity]} · rank +${item.rank}`}
      </p>
      <div className="mt-3">
        <ItemCard item={item} />
      </div>

      <section className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-wide text-stone-500">Temper</h4>
        {temperPrice ? (
          <>
            <CostLines
              scrap={player.scrap}
              costScrap={temperPrice.scrap}
              essenceRealm={temperPrice.essenceRealm}
              essenceCount={temperPrice.essenceCount}
              essences={essences}
            />
            <p className="mt-1 text-xs text-stone-400">
              Success {Math.round(temperChance(item) * 100)}%
              {item.forgePity > 0 ? ` · pity +${item.forgePity * 10}%` : ''}
            </p>
            <button
              type="button"
              disabled={busy || !canPay(player.scrap, essences, temperPrice)}
              className="mt-2 w-full rounded-lg bg-amber-700 py-2 text-sm disabled:opacity-40"
              onClick={() =>
                forge(
                  () => temper(item.id),
                  () => {
                    const next = useGameStore.getState().items.find((entry) => entry.id === item.id)
                    return next ? `Tempered to +${next.rank}.` : 'The metal holds.'
                  },
                  () => {
                    const next = useGameStore.getState().items.find((entry) => entry.id === item.id)
                    const pity = (next?.forgePity ?? item.forgePity + 1) * 10
                    return `The metal cracks. Pity +${pity}%.`
                  },
                )
              }
            >
              Temper to +{item.rank + 1}
            </button>
          </>
        ) : (
          <p className="mt-1 text-xs text-stone-400">This relic is already +10.</p>
        )}
      </section>

      {ascendPrice && ascendTo && (
        <section className="mt-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-stone-500">Ascend</h4>
          <p className="mt-1 text-xs text-stone-400">
            Opens the next prefix and suffix. Special affixes still only drop.
          </p>
          <CostLines
            scrap={player.scrap}
            costScrap={ascendPrice.scrap}
            essenceRealm={ascendPrice.essenceRealm}
            essenceCount={ascendPrice.essenceCount}
            essences={essences}
          />
          <button
            type="button"
            disabled={busy || !canPay(player.scrap, essences, ascendPrice)}
            className="mt-2 w-full rounded-lg border border-amber-700 py-2 text-sm text-amber-100 disabled:opacity-40"
            onClick={() =>
              forge(
                () => ascend(item.id),
                () => `Ascended to ${RARITY_LABEL[ascendTo]}.`,
                () => 'The ascend failed.',
              )
            }
          >
            Ascend to {RARITY_LABEL[ascendTo]}
          </button>
        </section>
      )}

      <section className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-wide text-stone-500">Reroll</h4>
        <CostLines
          scrap={player.scrap}
          costScrap={rerollPrice.scrap}
          essenceRealm={rerollPrice.essenceRealm}
          essenceCount={rerollPrice.essenceCount}
          essences={essences}
        />
        <ul className="mt-2 space-y-1.5">
          {item.prefixes.map((mod, index) => (
            <ModRow
              key={`prefix-${index}`}
              label={`${mod.name} ${STAT_LABELS[mod.stat]}`}
              kind="Prefix"
              disabled={busy || !canPay(player.scrap, essences, rerollPrice)}
              onReroll={() =>
                forge(
                  () => reroll(item.id, 'prefix', index),
                  () => `Rerolled ${mod.name}.`,
                  () => 'The reroll failed.',
                )
              }
            />
          ))}
          {item.suffixes.map((mod, index) => (
            <ModRow
              key={`suffix-${index}`}
              label={`${mod.name} ${STAT_LABELS[mod.stat]}`}
              kind="Suffix"
              disabled={busy || !canPay(player.scrap, essences, rerollPrice)}
              onReroll={() =>
                forge(
                  () => reroll(item.id, 'suffix', index),
                  () => `Rerolled ${mod.name}.`,
                  () => 'The reroll failed.',
                )
              }
            />
          ))}
        </ul>
        {item.special && (
          <p className="mt-2 text-[11px] text-amber-200/80">{item.special.name} cannot be rerolled.</p>
        )}
      </section>
    </Modal>
  )
}

function canPay(
  scrap: number,
  essences: Record<string, number>,
  cost: { scrap: number; essenceRealm: number; essenceCount: number },
): boolean {
  return scrap >= cost.scrap && essenceHeld(essences, cost.essenceRealm) >= cost.essenceCount
}

function CostLines({
  scrap,
  costScrap,
  essenceRealm,
  essenceCount,
  essences,
}: {
  scrap: number
  costScrap: number
  essenceRealm: number
  essenceCount: number
  essences: Record<string, number>
}) {
  const held = essenceHeld(essences, essenceRealm)
  const realm = getRealm(essenceRealm)
  return (
    <div className="mt-1 text-xs text-stone-400">
      <p className={scrap >= costScrap ? 'text-stone-300' : 'text-red-300'}>
        Scrap {scrap.toLocaleString()} / {costScrap.toLocaleString()}
      </p>
      <p className={held >= essenceCount ? 'text-stone-300' : 'text-red-300'}>
        {essenceCount} essence{essenceCount === 1 ? '' : 's'} from {realm.name} · {held} held
      </p>
      <ul className="mt-1 space-y-0.5">
        {essencesInRealm(essenceRealm).map((entry) => (
          <li key={entry.id} className="flex justify-between gap-3 text-[11px] text-stone-500">
            <span>{entry.name}</span>
            <span className="tabular-nums text-stone-300">{essences[entry.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ModRow({
  label,
  kind,
  disabled,
  onReroll,
}: {
  label: string
  kind: string
  disabled: boolean
  onReroll: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-stone-950 px-2 py-1.5">
      <span className="min-w-0 truncate text-xs text-stone-300">
        <span className="text-stone-500">{kind}</span> {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        className="shrink-0 rounded-md border border-stone-600 px-2 py-1 text-[11px] text-stone-200 disabled:opacity-40"
        onClick={onReroll}
      >
        Reroll
      </button>
    </li>
  )
}

function Hammer() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 text-stone-200">
      <path d="M6 8h14l2 3H8L6 8Z" fill="currentColor" />
      <path d="M18 11 22 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 20h16" stroke="#fb923c" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
