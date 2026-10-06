import { STARTING_DIAMONDS, START_NODE_ID, CONTENT_VERSION } from './types'
import type { PlayerState } from './types'

export function createPlayer(id: string, now = Date.now()): PlayerState {
  return {
    id,
    level: 1,
    xp: 0,
    gold: 0,
    diamonds: STARTING_DIAMONDS,
    scrap: 0,
    realmId: 1,
    highestRealmId: 1,
    realmProgress: 0,
    monsterIndex: 0,
    queuedMonsterIndex: 0,
    skillPointsUnspent: 3,
    allocatedNodeIds: [START_NODE_ID],
    lastSettledAt: now,
    contentVersion: CONTENT_VERSION,
  }
}
