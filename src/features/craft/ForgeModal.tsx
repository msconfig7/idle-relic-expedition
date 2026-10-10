import { essencesInRealm } from '../../content/essences'
import { getRealm } from '../../game'
import { essenceHeld, rerollCost, temperChance, temperCost } from '../../game/craft'
import { formatAffix } from '../../game/format'
import { listItemMods } from '../../game/items'
import { RARITY_CLASS, RARITY_LABEL } from '../../game/rarity'
import { STAT_LABELS, type StatKey } from '../../game/types'
import { TYPE_LABEL } from '../items/slotIcons'
import { useGameStore } from '../../state/gameStore'
import { Modal } from '../ui/Modal'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Phase = 'idle' | 'success' | 'fail'

const MOD_CLASS = {
  implicit: 'text-stone-300',
  prefix: 'text-sky-300',
  suffix: 'text-emerald-300',
  special: 'text-amber-200',
} as const

const FORGE_SPARKS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 2) * 0.18
  const dist = 42 + (i % 4) * 22
  return {
    dx: `${Math.cos(angle) * dist}px`,
    dy: `${Math.sin(angle) * dist}px`,
    delay: `${(i % 5) * 32}ms`,
    size: i % 4 === 0 ? 7 : 4,
    color: i % 3 === 0 ? '#fff7ed' : i % 3 === 1 ? '#fde68a' : '#fb923c',
  }
})

export function ForgeModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = useGameStore((s) => s.items.find((entry) => entry.id === itemId))
  const player = useGameStore((s) => s.player)
  const temper = useGameStore((s) => s.temperItem)
  const reroll = useGameStore((s) => s.rerollItemMod)
  const [phase, setPhase] = useState<Phase>('idle')
  const [banner, setBanner] = useState('')
  const [blocked, setBlocked] = useState('')
  const [burstKey, setBurstKey] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const bucket = timers.current
    return () => {
      for (const timer of bucket) window.clearTimeout(timer)
    }
  }, [])

  if (!item || !player) return null

  const busy = phase !== 'idle'
  const temperPrice = temperCost(item)
  const rerollPrice = rerollCost(item)
  const essences = player.essences ?? {}
  const currentMods = listItemMods(item)
  const nextMods = temperPrice ? listItemMods({ ...item, rank: item.rank + 1 }) : null

  function later(ms: number, run: () => void) {
    const timer = window.setTimeout(run, ms)
    timers.current.push(timer)
  }

  function forge(
    action: () => { ok: true; success: boolean } | { ok: false; reason: string },
    successText: () => string,
  ) {
    if (phase !== 'idle') return
    const result = action()
    if (!result.ok) {
      setBlocked(result.reason)
      setPhase('fail')
      later(1400, () => setPhase('idle'))
      return
    }
    setBlocked('')
    if (result.success) {
      setBurstKey((key) => key + 1)
      setPhase('success')
      setBanner(successText())
      later(2400, () => setPhase('idle'))
      return
    }
    setBurstKey((key) => key + 1)
    setPhase('fail')
    later(2400, () => setPhase('idle'))
  }

  return (
    <Modal
      title="Forge"
      onClose={busy ? () => undefined : onClose}
      overlay={
        phase === 'success' ? (
          <ForgeBurst key={burstKey} label={banner} />
        ) : phase === 'fail' && !blocked ? (
          <ForgeHit key={burstKey} />
        ) : null
      }
    >
      <div className={`rounded-xl border bg-stone-950 px-3 py-2.5 ${RARITY_CLASS[item.rarity]}`}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{item.name}</p>
          <p className="shrink-0 font-serif text-amber-100">+{item.rank}</p>
        </div>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide opacity-80">
          {RARITY_LABEL[item.rarity]} · {TYPE_LABEL[item.slotType]}
        </p>
        <ul className="mt-2.5 space-y-1">
          {currentMods.map((mod) => {
            const next = nextMods?.find((entry) => entry.kind === mod.kind && entry.index === mod.index)
            const now = formatAmount(mod.stat, mod.value)
            const after = next ? formatAmount(next.stat, next.value) : now
            const grows = after !== now
            const tone = mod.name === 'T1' ? 'text-amber-200' : MOD_CLASS[mod.kind]
            return (
              <li key={`${mod.kind}-${mod.index}`} className="flex items-baseline justify-between gap-3 text-xs">
                <span className={`min-w-0 truncate ${tone}`}>
                  {mod.kind !== 'implicit' && mod.name ? <span className="font-medium">{mod.name} · </span> : null}
                  {STAT_LABELS[mod.stat]}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-stone-400">{now}</span>
                  {grows ? <span className="text-emerald-300"> → {after}</span> : null}
                </span>
              </li>
            )
          })}
        </ul>
        {temperPrice ? <p className="mt-2 text-[11px] text-stone-500">Green is the value after a successful temper.</p> : null}
      </div>
      {phase === 'fail' && blocked ? <p className="mt-2 text-center text-xs text-red-300">{blocked}</p> : null}

      <section className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-wide text-stone-500">Temper</h4>
        {temperPrice ? <ChanceTile chance={temperChance(item)} pity={item.forgePity * 0.1} /> : null}
        {temperPrice ? (
          <>
            <CostLines
              scrap={player.scrap}
              costScrap={temperPrice.scrap}
              essenceRealm={temperPrice.essenceRealm}
              essenceCount={temperPrice.essenceCount}
              essences={essences}
              showPiles
            />
            <button
              type="button"
              disabled={busy || !canPay(player.scrap, essences, temperPrice)}
              className="mt-2 w-full rounded-lg bg-amber-700 py-2 text-sm font-medium text-amber-50 disabled:opacity-40"
              onClick={() =>
                forge(() => temper(item.id), () => {
                  const next = useGameStore.getState().items.find((entry) => entry.id === item.id)
                  return next ? `+${next.rank}` : 'Tempered'
                })
              }
            >
              Temper to +{item.rank + 1}
            </button>
          </>
        ) : (
          <p className="mt-1 text-xs text-stone-400">This relic is already +10.</p>
        )}
      </section>

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
              onReroll={() => forge(() => reroll(item.id, 'prefix', index), () => 'Rerolled')}
            />
          ))}
          {item.suffixes.map((mod, index) => (
            <ModRow
              key={`suffix-${index}`}
              label={`${mod.name} ${STAT_LABELS[mod.stat]}`}
              kind="Suffix"
              disabled={busy || !canPay(player.scrap, essences, rerollPrice)}
              onReroll={() => forge(() => reroll(item.id, 'suffix', index), () => 'Rerolled')}
            />
          ))}
        </ul>
        {item.special ? <p className="mt-2 text-[11px] text-amber-200/80">{item.special.name} cannot be rerolled.</p> : null}
      </section>
    </Modal>
  )
}

function ChanceTile({ chance, pity }: { chance: number; pity: number }) {
  const totalPct = Math.round(chance * 100)
  const pityPct = Math.round(pity * 100)
  const basePct = Math.max(0, totalPct - Math.min(pityPct, totalPct))
  return (
    <div className="mt-2 rounded-lg border border-stone-800 bg-stone-950 p-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => {
          const start = index * 10
          const base = Math.min(10, Math.max(0, basePct - start))
          const bonus = Math.min(10 - base, Math.max(0, totalPct - Math.max(start, basePct)))
          return (
            <span key={index} className="relative h-2.5 flex-1 overflow-hidden rounded-[3px] bg-stone-800">
              {base > 0 ? <span className="absolute inset-y-0 left-0 bg-amber-500" style={{ width: `${base * 10}%` }} /> : null}
              {bonus > 0 ? (
                <span className="absolute inset-y-0 bg-emerald-400" style={{ left: `${base * 10}%`, width: `${bonus * 10}%` }} />
              ) : null}
            </span>
          )
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px]">
        <span className="rounded-md bg-stone-900 px-2 py-1 text-amber-100">{totalPct}% success</span>
        <span className={`rounded-md px-2 py-1 text-right ${pityPct > 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-900 text-stone-500'}`}>
          pity +{pityPct}%
        </span>
      </div>
    </div>
  )
}

function ForgeHit() {
  return (
    <>
      <div className="forge-hit-glow absolute left-1/2 top-[38%] h-40 w-40" />
      <div className="level-ring absolute left-1/2 top-[38%] h-24 w-24 rounded-full border border-red-100/80" />
      <div className="level-ring level-ring-late absolute left-1/2 top-[38%] h-16 w-16 rounded-full border border-red-400/75" />
      {FORGE_SPARKS.map((spark, index) => (
        <span
          key={index}
          className="level-spark absolute left-1/2 top-[38%] rounded-full"
          style={
            {
              width: spark.size,
              height: spark.size,
              background: index % 2 === 0 ? '#fecaca' : '#f87171',
              boxShadow: '0 0 10px #f87171',
              '--dx': spark.dx,
              '--dy': spark.dy,
              '--delay': spark.delay,
            } as CSSProperties
          }
        />
      ))}
      <p className="forge-hit-label absolute left-1/2 top-[38%] font-serif text-4xl font-semibold text-red-200">Fail</p>
    </>
  )
}

function ForgeBurst({ label }: { label: string }) {
  return (
    <>
      <div className="level-glow absolute left-1/2 top-[38%] h-40 w-40" />
      <div className="level-ring absolute left-1/2 top-[38%] h-24 w-24 rounded-full border border-amber-100/80" />
      <div className="level-ring level-ring-late absolute left-1/2 top-[38%] h-16 w-16 rounded-full border border-amber-300/70" />
      {FORGE_SPARKS.map((spark, index) => (
        <span
          key={index}
          className="level-spark absolute left-1/2 top-[38%] rounded-full"
          style={
            {
              width: spark.size,
              height: spark.size,
              background: spark.color,
              boxShadow: `0 0 10px ${spark.color}`,
              '--dx': spark.dx,
              '--dy': spark.dy,
              '--delay': spark.delay,
            } as CSSProperties
          }
        />
      ))}
      <p className="level-label absolute left-1/2 top-[38%] font-serif text-3xl tracking-wide text-amber-50">{label}</p>
    </>
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
  showPiles,
}: {
  scrap: number
  costScrap: number
  essenceRealm: number
  essenceCount: number
  essences: Record<string, number>
  showPiles?: boolean
}) {
  const held = essenceHeld(essences, essenceRealm)
  const realm = getRealm(essenceRealm)
  return (
    <div className="mt-2 space-y-1.5">
      <p className={`text-xs ${scrap >= costScrap ? 'text-stone-300' : 'text-red-300'}`}>
        Scrap {scrap.toLocaleString()} / {costScrap.toLocaleString()}
      </p>
      <p className={`text-xs ${held >= essenceCount ? 'text-stone-300' : 'text-red-300'}`}>
        {essenceCount} from {realm.name} · {held} held
      </p>
      {showPiles ? (
        <ul className="flex flex-wrap gap-1">
          {essencesInRealm(essenceRealm).map((entry) => (
            <li key={entry.id} className="rounded-full bg-stone-950 px-2 py-0.5 text-[11px] text-stone-400">
              {entry.name} <span className="tabular-nums text-stone-200">{essences[entry.id] ?? 0}</span>
            </li>
          ))}
        </ul>
      ) : null}
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

function formatAmount(stat: StatKey, value: number): string {
  const full = formatAffix({ stat, value })
  const label = ` ${STAT_LABELS[stat]}`
  return full.endsWith(label) ? full.slice(0, -label.length) : full
}
