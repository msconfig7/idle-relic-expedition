import type { Item, PlayerState } from '../game/types'
import { persistSave } from './persist'
import { supabase, supabaseConfigured } from './supabase'

/** Persists the sealed board, then asks the server to grant the diamond bonus. Local play returns null. */
export async function confirmHuntSeal(player: PlayerState, items: Item[]): Promise<number | null> {
  if (!supabaseConfigured || !supabase) return null
  if (player.hunt.unconfirmedSealBoard == null) return null
  await persistSave(player, items)
  const { data, error } = await supabase.rpc('award_hunt_seal')
  if (error) throw error
  const diamonds = Number(data)
  if (!Number.isFinite(diamonds)) throw new Error('Hunt seal reward was not granted')
  return diamonds
}
