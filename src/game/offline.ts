import { averageRealmTimeToKillMs, getRealm, pickMonster } from './combat'
import { PLAYER_SWING_MS } from './types'
import { CONTENT_VERSION, OFFLINE_CAP_HOURS } from './types'
import { applyKill } from './rewards'
import { hashSeed, mulberry32 } from './rng'
import { deriveStats } from './stats'
import type { Item, OfflineGrant, PlayerState } from './types'

export function settleOffline(
  player: PlayerState,
  items: Item[],
  nowMs: number,
): OfflineGrant {
  const capMs = OFFLINE_CAP_HOURS * 60 * 60 * 1000
  const elapsed = Math.max(0, Math.min(capMs, nowMs - player.lastSettledAt))
  const seconds = Math.floor(elapsed / 1000)
  if (seconds < 8) {
    return {
      player: { ...player, lastSettledAt: nowMs, contentVersion: CONTENT_VERSION },
      items,
      kills: 0,
      xp: 0,
      gold: 0,
      scrap: 0,
      drops: 0,
      seconds,
    }
  }

  const stats = deriveStats(player, items)
  const realm = getRealm(player.realmId)
  const ttk = averageRealmTimeToKillMs(
    realm,
    stats.attack,
    stats.critChance,
    stats.critMulti,
    PLAYER_SWING_MS,
  )
  const kills = Math.max(0, Math.floor((elapsed / ttk) * 0.92))
  const rng = mulberry32(hashSeed(`${player.id}:${player.lastSettledAt}:${kills}`))

  let nextPlayer = { ...player }
  let nextItems = items
  let xp = 0
  let gold = 0
  let scrap = 0
  let drops = 0
  let killIndex = 0

  for (let i = 0; i < kills; i++) {
    const def = pickMonster(getRealm(nextPlayer.realmId), killIndex++)
    const result = applyKill(nextPlayer, nextItems, { def, hp: 0, maxHp: def.hp }, deriveStats(nextPlayer, nextItems), rng)
    nextPlayer = result.player
    nextItems = result.items
    xp += result.reward.xp
    gold += result.reward.gold
    scrap += result.reward.scrap
    if (result.reward.item) drops += 1
  }

  nextPlayer = { ...nextPlayer, lastSettledAt: nowMs, contentVersion: CONTENT_VERSION }
  return { player: nextPlayer, items: nextItems, kills, xp, gold, scrap, drops, seconds }
}
