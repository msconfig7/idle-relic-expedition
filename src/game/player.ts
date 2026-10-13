import { migratePlayer } from './migrate'
import { STARTING_DIAMONDS, CONTENT_VERSION } from './types'
import type { PlayerState } from './types'

export function createPlayer(id: string, now = Date.now()): PlayerState {
  return migratePlayer({
    id,
    level: 1,
    xp: 0,
    gold: 0,
    diamonds: STARTING_DIAMONDS,
    scrap: 0,
    essences: {},
    realmId: 1,
    highestRealmId: 1,
    realmProgress: 0,
    progressRealmId: 1,
    monsterIndex: 0,
    queuedMonsterIndex: 0,
    hunt: {
      killsTowardElite: 0,
      board: 1,
      finalBossCleared: false,
      contracts: [],
      nextBoardAt: null,
      diamondRewardBoard: null,
      unconfirmedSealBoard: null,
    },
    skillPointsUnspent: 3,
    allocatedNodeIds: [],
    bagLevel: 1,
    lastSettledAt: now,
    contentVersion: CONTENT_VERSION,
  })
}
