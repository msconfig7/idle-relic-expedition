import type { Item, Rarity } from './types'

export const SALVAGE_SCRAP: Record<Rarity, number> = {
  common: 1,
  magic: 3,
  rare: 8,
  epic: 20,
  legendary: 50,
}

export function salvageScrap(item: Item): number {
  return SALVAGE_SCRAP[item.rarity]
}
