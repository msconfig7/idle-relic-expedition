import { bossForRealm } from '../content/bosses'
import { nextRealm } from './combat'
import { REALM_PROGRESS_CAP } from './types'
import type { PlayerState } from './types'

export type RealmDoor = {
  title: string
  body: string
  nextRealmId: number | null
}

export function wardenAwaits(player: PlayerState, realmId = player.realmId): boolean {
  if (realmId !== player.highestRealmId) return false
  if (player.realmProgress < REALM_PROGRESS_CAP) return false
  if (player.progressRealmId !== realmId) return false
  if (nextRealm(realmId)) return true
  return !player.hunt.finalBossCleared
}

export function grantBossVictory(player: PlayerState): { player: PlayerState; door: RealmDoor } {
  const boss = bossForRealm(player.realmId)
  const name = boss?.name ?? 'The warden'
  const nxt = nextRealm(player.realmId)
  if (nxt) {
    return {
      player: { ...player, highestRealmId: Math.max(player.highestRealmId, nxt.id) },
      door: {
        title: `${name} falls`,
        body: `${nxt.name} is open.`,
        nextRealmId: nxt.id,
      },
    }
  }
  return {
    player: { ...player, hunt: { ...player.hunt, finalBossCleared: true } },
    door: {
      title: `${name} falls`,
      body: 'The last realm is quiet. No further road is marked.',
      nextRealmId: null,
    },
  }
}
