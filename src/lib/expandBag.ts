import { z } from 'zod'
import type { Item, PlayerState } from '../game/types'
import { persistSave } from './persist'
import { supabase, supabaseConfigured } from './supabase'

const expandResultSchema = z.object({
  bag_level: z.number().int().min(1).max(10),
  gold: z.number().int().nonnegative(),
  diamonds: z.number().int().nonnegative(),
})

export type BagExpandBalances = {
  bagLevel: number
  gold: number
  diamonds: number
}

/** Saves pending progress, then asks the server to charge gold or diamonds. Local play returns null. */
export async function confirmBagExpand(
  player: PlayerState,
  items: Item[],
  payWith: 'gold' | 'diamonds',
): Promise<BagExpandBalances | null> {
  if (!supabaseConfigured || !supabase) return null
  await persistSave(player, items)
  const { data, error } = await supabase.rpc('expand_bag', { pay_with: payWith })
  if (error) throw error
  const parsed = expandResultSchema.parse(data)
  return {
    bagLevel: parsed.bag_level,
    gold: parsed.gold,
    diamonds: parsed.diamonds,
  }
}
