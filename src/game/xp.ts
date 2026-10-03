import { XP_BASE, XP_GROWTH } from './types'

export function xpToNext(level: number): number {
  return Math.floor(XP_BASE * XP_GROWTH ** (level - 1))
}

export function totalXpForLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) total += xpToNext(i)
  return total
}

export function levelFromTotalXp(xp: number): number {
  let level = 1
  let remaining = xp
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level += 1
    if (level >= 200) break
  }
  return level
}

export function xpIntoLevel(xp: number, level: number): number {
  return Math.max(0, xp - totalXpForLevel(level))
}

export function grantXp(
  xp: number,
  level: number,
  unspent: number,
  amount: number,
): { xp: number; level: number; skillPointsUnspent: number; leveled: boolean } {
  let nextXp = xp + amount
  let nextLevel = level
  let points = unspent
  let leveled = false
  while (nextXp >= totalXpForLevel(nextLevel + 1)) {
    nextLevel += 1
    points += 1
    leveled = true
    if (nextLevel >= 200) break
  }
  return { xp: nextXp, level: nextLevel, skillPointsUnspent: points, leveled }
}
