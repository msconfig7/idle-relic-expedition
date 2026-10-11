import { withHunt, huntFromUnknown } from './contracts'
import { nextRealm } from './combat'
import { CONTENT_VERSION, REALM_PROGRESS_CAP } from './types'
import type { PlayerState } from './types'

export function migratePlayer(player: PlayerState): PlayerState {
  const progressRealmId = player.progressRealmId || player.realmId
  const seeded = withHunt(
    { ...player, progressRealmId },
    huntFromUnknown(player.hunt) ?? {
      killsTowardElite: 0,
      board: 1,
      finalBossCleared: false,
      contracts: [],
    },
  )
  if ((player.contentVersion ?? 1) >= 3) return seeded
  let highestRealmId = seeded.highestRealmId
  if (seeded.realmProgress >= REALM_PROGRESS_CAP && seeded.progressRealmId === seeded.realmId) {
    const nxt = nextRealm(seeded.realmId)
    if (nxt) highestRealmId = Math.max(highestRealmId, nxt.id)
  }
  return { ...seeded, highestRealmId, contentVersion: CONTENT_VERSION }
}
