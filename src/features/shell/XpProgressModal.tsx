import { xpIntoLevel, xpToNext } from '../../game'
import {
  averagePace,
  etaToNextMs,
  formatLevelEta,
  formatXpRate,
  killXp,
  projectedXpPerMinute,
} from '../../game/xpForecast'
import { useGameStore } from '../../state/gameStore'
import { Modal } from '../ui/Modal'
import { useEffect, useState } from 'react'
import { currentXpPerMinute } from './xpRateTracker'

const LEVEL_CAP = 200
const REFRESH_MS = 5_000
/** One minute of 5-second pace readings. */
const PACE_SAMPLES = 12
let paceReadings: number[] = []
let lastPaceSampleAt = 0

function resetPaceSamples(): void {
  paceReadings = []
  lastPaceSampleAt = 0
}

type PaceView = {
  level: number
  into: number
  need: number
  remaining: number
  pct: number
  atCap: boolean
  xpPerMinute: number
  live: boolean
  eta: number | null
  monsterName: string | null
  perKill: number
}

/** Snapshot the averaged pace. The modal keeps it until the next 5s refresh. */
function capturePace(now: number): PaceView {
  const { player, stats, combat } = useGameStore.getState()
  const level = player?.level ?? 1
  const xp = player?.xp ?? 0
  const into = xpIntoLevel(xp, level)
  const need = xpToNext(level)
  const remaining = Math.max(0, need - into)
  const pct = need > 0 ? Math.min(100, (into / need) * 100) : 100
  const atCap = level >= LEVEL_CAP
  const monster = combat?.monster.def ?? null
  const perKill = monster && stats ? killXp(monster.xp, stats.xpMod) : 0
  const projected =
    monster && stats
      ? projectedXpPerMinute({
          monsterXp: monster.xp,
          xpMod: stats.xpMod,
          attack: stats.attack,
          critChance: stats.critChance,
          critMulti: stats.critMulti,
          monsterHp: monster.hp,
          monsterDefense: monster.defense,
        })
      : 0
  const measured = player ? currentXpPerMinute(xp, now) : null
  const live = measured != null
  if (paceReadings.length === 0 || now - lastPaceSampleAt >= REFRESH_MS - 250) {
    paceReadings.push(measured ?? projected)
    lastPaceSampleAt = now
    if (paceReadings.length > PACE_SAMPLES) paceReadings.splice(0, paceReadings.length - PACE_SAMPLES)
  }
  const xpPerMinute = averagePace(paceReadings)
  return {
    level,
    into,
    need,
    remaining,
    pct,
    atCap,
    xpPerMinute,
    live,
    eta: atCap ? null : etaToNextMs(remaining, xpPerMinute),
    monsterName: monster?.name ?? null,
    perKill,
  }
}

export function XpProgressModal({ onClose }: { onClose: () => void }) {
  const [pace, setPace] = useState(() => {
    resetPaceSamples()
    return capturePace(Date.now())
  })

  useEffect(() => {
    const id = window.setInterval(() => setPace(capturePace(Date.now())), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { level, into, need, remaining, pct, atCap, xpPerMinute, live, eta, monsterName, perKill } = pace
  const pctLabel = pct >= 100 ? '100%' : `${pct.toFixed(1)}%`

  return (
    <Modal title="Level progress" onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex items-center gap-4">
          <ProgressRing pct={pct} label={pctLabel} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">Level</p>
            <p className="font-serif text-4xl leading-none text-amber-50 tabular-nums">{level}</p>
            <p className="mt-2 text-xs text-stone-400 tabular-nums">
              {into.toLocaleString()} / {need.toLocaleString()} XP
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-stone-800 ring-1 ring-white/10">
          <div
            className="xp-sheen h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-400 to-violet-300 shadow-[0_0_16px_rgba(192,132,252,0.75)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <article className="rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/15 to-stone-950 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-violet-200/80">Pace</p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${
                  live ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-stone-300'
                }`}
              >
                {live ? 'Live' : 'Estimate'}
              </span>
            </div>
            <p className="mt-2 font-serif text-2xl leading-none text-violet-50 tabular-nums">
              {formatXpRate(xpPerMinute)}
            </p>
            <p className="mt-1 text-[11px] text-stone-400">avg XP / min</p>
          </article>

          <article className="rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-500/15 to-stone-950 p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-amber-200/80">Next level</p>
            <p
              className="mt-2 font-serif text-2xl leading-none text-amber-50 tabular-nums"
              aria-live="polite"
            >
              {atCap ? 'Max' : formatLevelEta(eta)}
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              {atCap ? 'Level cap reached' : `${remaining.toLocaleString()} XP left`}
            </p>
          </article>
        </div>

        <p className="text-xs leading-5 text-stone-500">
          {atCap
            ? 'This is the highest level.'
            : live
              ? xpPerMinute > 0
                ? 'Average XP over the last minute of combat. Updates every 5 seconds.'
                : 'No XP gained in the last minute, so a level-up time is not available yet.'
              : monsterName
                ? `${monsterName} awards ${perKill.toLocaleString()} XP. This average updates every 5 seconds.`
                : 'Start a fight to estimate when you will level up.'}
        </p>
      </div>
    </Modal>
  )
}

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center">
      <div
        className="absolute inset-0 rounded-full shadow-[0_0_24px_rgba(167,139,250,0.35)]"
        style={{
          background: `conic-gradient(#c084fc ${pct}%, rgba(255,255,255,0.08) 0)`,
        }}
      />
      <div className="absolute inset-[5px] rounded-full bg-stone-900" />
      <span className="relative text-sm font-semibold text-violet-100 tabular-nums">{label}</span>
    </div>
  )
}
