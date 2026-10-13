import type { PlayerState } from './types'

/** Starting unequipped capacity. Each bag level after 1 adds {@link BAG_SLOTS_PER_LEVEL}. */
export const BAG_BASE_SLOTS = 30
export const BAG_LEVEL_MIN = 1
export const BAG_LEVEL_MAX = 10
export const BAG_SLOTS_PER_LEVEL = 5
/** Diamond price that can replace any gold expansion. */
export const BAG_GOLD_DIAMOND_PRICE = 5

export type BagPayWith = 'gold' | 'diamonds'

/**
 * Upgrade purchased to reach the next level. Gold is null once expansions are diamond-only.
 * Keep supabase/migrations/20261013000000_bag_slots.sql in step with this table.
 */
export const BAG_UPGRADES: { gold: number | null; diamonds: number }[] = [
  { gold: 20_000, diamonds: BAG_GOLD_DIAMOND_PRICE },
  { gold: 50_000, diamonds: BAG_GOLD_DIAMOND_PRICE },
  { gold: 100_000, diamonds: BAG_GOLD_DIAMOND_PRICE },
  { gold: 200_000, diamonds: BAG_GOLD_DIAMOND_PRICE },
  { gold: null, diamonds: 5 },
  { gold: null, diamonds: 10 },
  { gold: null, diamonds: 15 },
  { gold: null, diamonds: 20 },
  { gold: null, diamonds: 25 },
]

export type BagUpgradeOffer = {
  nextLevel: number
  slots: number
  nextSlots: number
  gold: number | null
  diamonds: number
}

export function clampBagLevel(level: number | null | undefined): number {
  if (level == null || !Number.isFinite(level)) return BAG_LEVEL_MIN
  return Math.min(BAG_LEVEL_MAX, Math.max(BAG_LEVEL_MIN, Math.floor(level)))
}

export function bagCapacity(level: number | null | undefined): number {
  return BAG_BASE_SLOTS + (clampBagLevel(level) - BAG_LEVEL_MIN) * BAG_SLOTS_PER_LEVEL
}

export function bagUpgradeOffer(level: number | null | undefined): BagUpgradeOffer | null {
  const current = clampBagLevel(level)
  if (current >= BAG_LEVEL_MAX) return null
  const step = BAG_UPGRADES[current - BAG_LEVEL_MIN]
  if (!step) return null
  return {
    nextLevel: current + 1,
    slots: bagCapacity(current),
    nextSlots: bagCapacity(current + 1),
    gold: step.gold,
    diamonds: step.diamonds,
  }
}

export function purchaseBagUpgrade(
  player: PlayerState,
  payWith: BagPayWith,
): { ok: true; player: PlayerState } | { ok: false; reason: string } {
  const offer = bagUpgradeOffer(player.bagLevel)
  if (!offer) return { ok: false, reason: 'This bag is fully expanded.' }
  if (payWith === 'gold') {
    if (offer.gold == null) return { ok: false, reason: 'This expansion costs diamonds.' }
    if (player.gold < offer.gold) return { ok: false, reason: 'Not enough gold.' }
    return {
      ok: true,
      player: {
        ...player,
        bagLevel: offer.nextLevel,
        gold: player.gold - offer.gold,
      },
    }
  }
  if (player.diamonds < offer.diamonds) return { ok: false, reason: 'Not enough diamonds.' }
  return {
    ok: true,
    player: {
      ...player,
      bagLevel: offer.nextLevel,
      diamonds: player.diamonds - offer.diamonds,
    },
  }
}
