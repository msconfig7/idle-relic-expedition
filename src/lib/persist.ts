import { createPlayer } from '../game/player'
import { settleOffline } from '../game/offline'
import { normalizeRarity } from '../game/rarity'
import type { Item, OfflineGrant, PlayerState } from '../game/types'
import { itemFromRow, itemToRow, playerFromRow, playerToRow, type ItemRow, type PlayerRow } from './mappers'
import { supabase, supabaseConfigured } from './supabase'

const LOCAL_KEY = 'idle-relic-expedition:save'

type SaveBlob = { player: PlayerState; items: Item[] }

function readLocal(): SaveBlob | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SaveBlob
    const player = {
      ...parsed.player,
      highestRealmId: Math.max(parsed.player.highestRealmId ?? parsed.player.realmId, parsed.player.realmId),
    }
    const items = parsed.items.map((item) => {
      const rarity = normalizeRarity(String(item.rarity))
      return {
        ...item,
        rarity,
        name: item.name.replace(/^Uncommon /, 'Magic '),
      }
    }) as Item[]
    return { player, items }
  } catch {
    return null
  }
}

function writeLocal(player: PlayerState, items: Item[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ player, items }))
}

export async function loadSave(userId: string): Promise<SaveBlob> {
  if (!supabaseConfigured || !supabase) {
    const existing = readLocal()
    if (existing && existing.player.id === userId) return existing
    const player = createPlayer(userId)
    writeLocal(player, [])
    return { player, items: [] }
  }

  const { data: playerRow, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error

  let player: PlayerState
  if (!playerRow) {
    player = createPlayer(userId)
    const { error: insertError } = await supabase.from('players').insert(playerToRow(player))
    if (insertError) throw insertError
    return { player, items: [] }
  }

  player = playerFromRow(playerRow as PlayerRow)
  const { data: itemRows, error: itemsError } = await supabase
    .from('items')
    .select('*')
    .eq('player_id', userId)
  if (itemsError) throw itemsError
  const items = ((itemRows ?? []) as ItemRow[]).map(itemFromRow)
  return { player, items }
}

export async function persistSave(player: PlayerState, items: Item[]): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    writeLocal(player, items)
    return
  }

  const row = playerToRow(player)
  const progress = { ...row }
  delete (progress as { diamonds?: number }).diamonds
  const { error } = await supabase.from('players').update(progress).eq('id', player.id)
  if (error) throw error

  const { data: existing, error: existingError } = await supabase
    .from('items')
    .select('id')
    .eq('player_id', player.id)
  if (existingError) throw existingError

  const keep = new Set(items.map((item) => item.id))
  const toDelete = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keep.has(id))
  if (toDelete.length) {
    const { error: deleteError } = await supabase.from('items').delete().in('id', toDelete)
    if (deleteError) throw deleteError
  }

  if (items.length) {
    const { error: upsertError } = await supabase.from('items').upsert(items.map(itemToRow))
    if (upsertError) throw upsertError
  }
}

export async function runSettlement(
  player: PlayerState,
  items: Item[],
): Promise<{ grant: OfflineGrant; remote: boolean }> {
  if (supabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke('settle-offline')
    if (!error && data?.player) {
      const nextPlayer = playerFromRow(data.player as PlayerRow)
      const nextItems = ((data.items ?? []) as ItemRow[]).map(itemFromRow)
      return {
        grant: {
          player: nextPlayer,
          items: nextItems,
          kills: data.kills ?? 0,
          xp: data.xp ?? 0,
          gold: data.gold ?? 0,
          scrap: data.scrap ?? 0,
          drops: data.drops ?? 0,
          seconds: data.seconds ?? 0,
        },
        remote: true,
      }
    }
  }
  const grant = settleOffline(player, items, Date.now())
  await persistSave(grant.player, grant.items)
  return { grant, remote: false }
}
