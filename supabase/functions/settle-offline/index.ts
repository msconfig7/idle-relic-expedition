import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  itemFromRow,
  itemToRow,
  playerFromRow,
  playerToRow,
  settleOffline,
} from '../_shared/game-core.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) {
    return json({ error: 'Server is not configured' }, 500)
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { data: playerRow, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .single()
  if (playerError || !playerRow) {
    return json({ error: playerError?.message ?? 'Player not found' }, 400)
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('items')
    .select('*')
    .eq('player_id', user.id)
  if (itemsError) {
    return json({ error: itemsError.message }, 400)
  }

  const player = playerFromRow(playerRow)
  const items = (itemRows ?? []).map(itemFromRow)
  const grant = settleOffline(player, items, Date.now())

  const row = playerToRow(grant.player)
  const { diamonds: _diamonds, ...progress } = row
  const { error: updateError } = await supabase.from('players').update(progress).eq('id', user.id)
  if (updateError) {
    return json({ error: updateError.message }, 400)
  }

  const { data: existing, error: existingError } = await supabase
    .from('items')
    .select('id')
    .eq('player_id', user.id)
  if (existingError) {
    return json({ error: existingError.message }, 400)
  }

  const keep = new Set(grant.items.map((item) => item.id))
  const toDelete = (existing ?? []).map((entry) => entry.id as string).filter((id) => !keep.has(id))
  if (toDelete.length) {
    const { error: deleteError } = await supabase.from('items').delete().in('id', toDelete)
    if (deleteError) return json({ error: deleteError.message }, 400)
  }

  if (grant.items.length) {
    const { error: upsertError } = await supabase.from('items').upsert(grant.items.map(itemToRow))
    if (upsertError) return json({ error: upsertError.message }, 400)
  }

  const { data: savedPlayer } = await supabase.from('players').select('*').eq('id', user.id).single()
  const { data: savedItems } = await supabase.from('items').select('*').eq('player_id', user.id)

  return json({
    player: savedPlayer,
    items: savedItems ?? [],
    kills: grant.kills,
    xp: grant.xp,
    gold: grant.gold,
    scrap: grant.scrap,
    drops: grant.drops,
    seconds: grant.seconds,
  })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
