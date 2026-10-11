import { averageTimeToKillMs } from './combat'
import { PLAYER_SWING_MS } from './types'

/** How far back a live XP/min sample looks. */
export const XP_RATE_WINDOW_MS = 60_000
/** Ignore a window shorter than this so one instant doesn't define the pace. */
export const XP_RATE_MIN_SPAN_MS = 8_000

export type XpSample = { t: number; xp: number }

/** XP awarded for one kill. Matches `applyKill`. */
export function killXp(monsterXp: number, xpMod: number): number {
  return Math.max(1, Math.floor(monsterXp * Math.max(0, xpMod)))
}

/**
 * Steady XP per minute for the monster being fought.
 * Kill-to-kill time is `averageTimeToKillMs`: the despawn gap is loaded into
 * the next swing, so it is not added again.
 */
export function projectedXpPerMinute(input: {
  monsterXp: number
  xpMod: number
  attack: number
  critChance: number
  critMulti: number
  monsterHp: number
  monsterDefense: number
}): number {
  const xp = killXp(input.monsterXp, input.xpMod)
  const cycleMs = Math.max(
    PLAYER_SWING_MS,
    averageTimeToKillMs(
      input.attack,
      input.critChance,
      input.critMulti,
      Math.max(1, input.monsterHp),
      Math.max(0, input.monsterDefense),
      PLAYER_SWING_MS,
    ),
  )
  return (xp / cycleMs) * 60_000
}

export function trimXpSamples(samples: readonly XpSample[], now: number): XpSample[] {
  const cutoff = now - XP_RATE_WINDOW_MS
  let start = 0
  while (start < samples.length - 1 && samples[start + 1].t <= cutoff) start += 1
  return start === 0 ? samples.slice() : samples.slice(start)
}

/**
 * Append an XP snapshot. A drop, or a jump larger than `burstLimit` (an offline
 * settlement, not a kill), starts a fresh window so it doesn't distort XP/min.
 */
export function recordXpSample(
  samples: readonly XpSample[],
  xp: number,
  now: number,
  burstLimit: number,
): XpSample[] {
  if (!Number.isFinite(xp) || !Number.isFinite(now)) return samples.slice()
  if (samples.length === 0) return [{ t: now, xp }]
  const last = samples[samples.length - 1]
  if (xp === last.xp) return trimXpSamples(samples, now)
  const delta = xp - last.xp
  if (delta < 0 || delta > burstLimit) return [{ t: now, xp }]
  return trimXpSamples([...samples, { t: now, xp }], now)
}

/**
 * XP per minute over the recent window.
 * Returns null until a real gain has been observed for long enough to trust.
 * Returns 0 when gains were seen and then stopped.
 */
export function measuredXpPerMinute(
  samples: readonly XpSample[],
  xp: number,
  now: number,
  hadGain: boolean,
): number | null {
  if (!hadGain || samples.length === 0) return null
  const cutoff = now - XP_RATE_WINDOW_MS
  let anchorXp = samples[0].xp
  let anchorT = samples[0].t
  for (const sample of samples) {
    if (sample.t <= cutoff) {
      anchorXp = sample.xp
      anchorT = cutoff
    } else {
      break
    }
  }
  const span = now - anchorT
  if (span < XP_RATE_MIN_SPAN_MS) return null
  const gained = xp - anchorXp
  if (gained <= 0) return 0
  return (gained / span) * 60_000
}

/** Mean of pace readings taken on each refresh. */
export function averagePace(readings: readonly number[]): number {
  if (readings.length === 0) return 0
  let sum = 0
  for (const value of readings) sum += value
  return sum / readings.length
}

export function etaToNextMs(remainingXp: number, xpPerMinute: number): number | null {
  if (!Number.isFinite(remainingXp) || remainingXp <= 0) return 0
  if (!Number.isFinite(xpPerMinute) || xpPerMinute <= 0) return null
  return (remainingXp / xpPerMinute) * 60_000
}

export function formatLevelEta(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const totalMinutes = Math.round(ms / 60_000)
  if (totalMinutes < 1) return '< 1 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes} min`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function formatXpRate(xpPerMinute: number): string {
  if (!Number.isFinite(xpPerMinute) || xpPerMinute <= 0) return '0'
  if (xpPerMinute >= 100) return Math.round(xpPerMinute).toLocaleString()
  return xpPerMinute.toFixed(1)
}
