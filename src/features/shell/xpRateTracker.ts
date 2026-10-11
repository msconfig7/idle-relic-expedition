import {
  measuredXpPerMinute,
  recordXpSample,
  trimXpSamples,
  type XpSample,
} from '../../game/xpForecast'

let samples: XpSample[] = []
let seenXp: number | null = null
let seenPlayer: string | null = null
let hadGain = false

/** Record total XP as combat pays it out. Safe to call on every relevant render. */
export function observeXp(playerId: string, xp: number, burstLimit: number, now = Date.now()): void {
  if (seenPlayer !== playerId) {
    samples = []
    seenXp = null
    hadGain = false
    seenPlayer = playerId
  }
  if (seenXp === xp) {
    samples = trimXpSamples(samples, now)
    return
  }
  const prev = seenXp
  if (prev != null && xp > prev && xp - prev <= burstLimit) hadGain = true
  else hadGain = false
  samples = recordXpSample(prev == null ? [] : samples, xp, now, burstLimit)
  seenXp = xp
}

/** Live XP/min from recent kills, or null when there isn't a trustworthy sample yet. */
export function currentXpPerMinute(xp: number, now = Date.now()): number | null {
  return measuredXpPerMinute(samples, xp, now, hadGain)
}

export function resetXpRateTracker(): void {
  samples = []
  seenXp = null
  seenPlayer = null
  hadGain = false
}
