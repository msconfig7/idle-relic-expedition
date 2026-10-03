import type { Rarity } from './types'

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  magic: 'Magic',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

export const RARITY_CLASS: Record<Rarity, string> = {
  common: 'border-stone-500 text-stone-400',
  magic: 'border-blue-500 text-blue-400',
  rare: 'border-yellow-400 text-yellow-300',
  epic: 'border-purple-500 text-purple-400',
  legendary: 'border-[#8a5a2b] text-[#c4a574]',
}

export const RARITY_CHIP: Record<Rarity, string> = {
  common: 'bg-stone-800 text-stone-300 border-stone-500',
  magic: 'bg-blue-950 text-blue-400 border-blue-500',
  rare: 'bg-yellow-950 text-yellow-300 border-yellow-400',
  epic: 'bg-purple-950 text-purple-300 border-purple-500',
  legendary: 'bg-[#2a1c12] text-[#c4a574] border-[#8a5a2b]',
}

export function normalizeRarity(value: string): Rarity {
  if (value === 'uncommon') return 'magic'
  return value as Rarity
}
