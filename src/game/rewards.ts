import { essenceDef } from '../content/essences'
import { rollItemDrop, rollScrap } from './drops'
import { grantXp } from './xp'
import { nextRealm } from './combat'
import type { DerivedStats, EssenceCounts, Item, KillReward, LiveMonster, PlayerState } from './types'
import { MAX_INVENTORY, REALM_PROGRESS_CAP } from './types'

export function applyKill(
  player: PlayerState,
  items: Item[],
  monster: LiveMonster,
  stats: DerivedStats,
  rng: () => number,
): { player: PlayerState; items: Item[]; reward: KillReward } {
  const xpGain = Math.max(1, Math.floor(monster.def.xp * stats.xpMod))
  const goldGain = Math.max(1, Math.floor(monster.def.gold * stats.goldMod))
  const scrap = rollScrap(rng, monster.def.materialDrop * (stats.materialDrop / 0.18), player.realmId)
  const essenceId = scrap > 0 && essenceDef(monster.def.id) ? monster.def.id : null
  const currentEssences = player.essences ?? {}
  const essences: EssenceCounts = essenceId
    ? { ...currentEssences, [essenceId]: (currentEssences[essenceId] ?? 0) + 1 }
    : currentEssences
  const itemChance = monster.def.itemDrop * (stats.itemDrop / 0.08)
  const bagCount = items.filter((entry) => !entry.equippedSlot).length
  const item =
    bagCount >= MAX_INVENTORY ? null : rollItemDrop(rng, player.id, player.realmId, itemChance)
  const leveled = grantXp(player.xp, player.level, player.skillPointsUnspent, xpGain)
  const nextItems = item ? [...items, item] : items
  const onFrontier = player.realmId === player.highestRealmId
  const nextProgress = onFrontier
    ? Math.min(REALM_PROGRESS_CAP, player.realmProgress + monster.def.progress)
    : player.realmProgress
  let highestRealmId = player.highestRealmId
  if (onFrontier && nextProgress >= REALM_PROGRESS_CAP) {
    const nxt = nextRealm(player.realmId)
    if (nxt) highestRealmId = nxt.id
  }
  const nextPlayer: PlayerState = {
    ...player,
    xp: leveled.xp,
    level: leveled.level,
    skillPointsUnspent: leveled.skillPointsUnspent,
    gold: player.gold + goldGain,
    scrap: player.scrap + scrap,
    essences,
    realmProgress: nextProgress,
    highestRealmId,
  }
  return {
    player: nextPlayer,
    items: nextItems,
    reward: {
      xp: xpGain,
      gold: goldGain,
      scrap,
      essenceId,
      item,
      leveled: leveled.leveled,
      newLevel: leveled.level,
    },
  }
}
