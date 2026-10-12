import { eliteScaled, getRealm, pickMonster, spawnMonster, timeToKillMs } from './combat'
import { dueElite, noteKill } from './contracts'
import { migratePlayer } from './migrate'
import { PLAYER_SWING_MS } from './types'
import { CONTENT_VERSION, ELITE_EVERY, OFFLINE_CAP_HOURS } from './types'
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
  const base = migratePlayer(player)
  if (seconds < 8) {
    return {
      player: { ...base, lastSettledAt: nowMs, contentVersion: CONTENT_VERSION },
      items,
      kills: 0,
      xp: 0,
      gold: 0,
      scrap: 0,
      drops: 0,
      seconds,
      elites: 0,
      fulfilledHunts: [],
    }
  }

  const stats = deriveStats(base, items)
  const hunted = pickMonster(getRealm(base.realmId), base.queuedMonsterIndex)
  const normalMs = timeToKillMs(stats.attack, stats.critChance, stats.critMulti, hunted, PLAYER_SWING_MS)
  const eliteMs = timeToKillMs(stats.attack, stats.critChance, stats.critMulti, eliteScaled(hunted), PLAYER_SWING_MS)
  const cycleMs = (normalMs * ELITE_EVERY + eliteMs) / (ELITE_EVERY + 1)
  const kills = Math.max(0, Math.floor((elapsed / cycleMs) * 0.92))
  const rng = mulberry32(hashSeed(`${base.id}:${base.lastSettledAt}:${kills}`))

  let nextPlayer = base
  let nextItems = items
  let xp = 0
  let gold = 0
  let scrap = 0
  let drops = 0
  let elites = 0
  const fulfilledHunts: string[] = []

  const killSpan = kills > 0 ? elapsed / kills : 0
  for (let i = 0; i < kills; i++) {
    const elite = dueElite(nextPlayer)
    const def = pickMonster(getRealm(nextPlayer.realmId), nextPlayer.queuedMonsterIndex)
    const monster = spawnMonster(def, elite)
    const result = applyKill(nextPlayer, nextItems, monster, deriveStats(nextPlayer, nextItems), rng)
    const noted = noteKill(
      result.player,
      {
        monsterId: def.id,
        realmId: nextPlayer.realmId,
        elite,
        boss: false,
      },
      base.lastSettledAt + Math.floor((i + 1) * killSpan),
    )
    nextPlayer = noted.player
    nextItems = result.items
    xp += result.reward.xp
    gold += result.reward.gold
    scrap += result.reward.scrap
    if (result.reward.item) drops += 1
    if (elite) elites += 1
    for (const contract of noted.fulfilled) fulfilledHunts.push(contract.title)
  }

  nextPlayer = { ...nextPlayer, lastSettledAt: nowMs, contentVersion: CONTENT_VERSION }
  return { player: nextPlayer, items: nextItems, kills, xp, gold, scrap, drops, seconds, elites, fulfilledHunts }
}
