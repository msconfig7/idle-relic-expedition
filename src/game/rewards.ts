import { essenceDef } from '../content/essences'
import { getRealm } from './combat'
import { rollItemDrop, rollScrap } from './drops'
import { grantXp } from './xp'
import type { DerivedStats, EssenceCounts, Item, KillReward, LiveMonster, PlayerState } from './types'
import { bagCapacity } from './bag'
import { REALM_PROGRESS_CAP } from './types'

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
  const essenceKey = monster.boss ? getRealm(player.realmId).monsters.at(-1)?.id : monster.def.id
  const essenceId = scrap > 0 && essenceKey && essenceDef(essenceKey) ? essenceKey : null
  const currentEssences = player.essences ?? {}
  const essences: EssenceCounts = essenceId
    ? { ...currentEssences, [essenceId]: (currentEssences[essenceId] ?? 0) + 1 }
    : currentEssences
  const itemChance = monster.boss ? 1 : monster.def.itemDrop * (stats.itemDrop / 0.08)
  const bagCount = items.filter((entry) => !entry.equippedSlot).length
  const item =
    bagCount >= bagCapacity(player.bagLevel) ? null : rollItemDrop(rng, player.id, player.realmId, itemChance)
  const leveled = grantXp(player.xp, player.level, player.skillPointsUnspent, xpGain)
  const nextItems = item ? [...items, item] : items
  const tracking =
    player.realmId === player.highestRealmId && player.progressRealmId === player.realmId && !monster.boss
  const nextProgress = tracking
    ? Math.min(REALM_PROGRESS_CAP, player.realmProgress + monster.def.progress)
    : player.realmProgress
  const nextPlayer: PlayerState = {
    ...player,
    xp: leveled.xp,
    level: leveled.level,
    skillPointsUnspent: leveled.skillPointsUnspent,
    gold: player.gold + goldGain,
    scrap: player.scrap + scrap,
    essences,
    realmProgress: nextProgress,
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
