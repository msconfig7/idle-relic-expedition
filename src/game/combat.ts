import { realms } from '../content/realms'
import { REALM_PROGRESS_CAP } from './types'
import type { LiveMonster, MonsterDef, RealmDef } from './types'

export function getRealm(realmId: number): RealmDef {
  return realms.find((realm) => realm.id === realmId) ?? realms[0]
}

export function nextRealm(realmId: number): RealmDef | undefined {
  return realms.find((realm) => realm.id === realmId + 1)
}

export function canAdvanceRealm(realmId: number, progress: number): boolean {
  return progress >= REALM_PROGRESS_CAP && Boolean(nextRealm(realmId))
}

export function pickMonster(realm: RealmDef, killIndex: number): MonsterDef {
  return realm.monsters[killIndex % realm.monsters.length]
}

export function spawnMonster(def: MonsterDef): LiveMonster {
  return { def, hp: def.hp, maxHp: def.hp }
}

export function strikeDamage(
  attack: number,
  defense: number,
  critChance: number,
  critMulti: number,
  rng: () => number,
): { damage: number; crit: boolean } {
  const raw = Math.max(1, attack - defense * 0.4)
  const spread = 0.85 + rng() * 0.3
  const crit = rng() < critChance
  const damage = Math.max(1, Math.floor(raw * spread * (crit ? critMulti : 1)))
  return { damage, crit }
}

export function averageTimeToKillMs(
  playerAttack: number,
  playerCritChance: number,
  playerCritMulti: number,
  monsterHp: number,
  monsterDef: number,
  swingMs: number,
): number {
  const hit = Math.max(1, playerAttack - monsterDef * 0.4)
  const expected = hit * (1 - playerCritChance + playerCritChance * playerCritMulti)
  const hits = Math.max(1, Math.ceil(monsterHp / expected))
  return hits * swingMs
}

export function averageRealmTimeToKillMs(
  realm: RealmDef,
  playerAttack: number,
  critChance: number,
  critMulti: number,
  swingMs: number,
): number {
  const times = realm.monsters.map((monster) =>
    averageTimeToKillMs(playerAttack, critChance, critMulti, monster.hp, monster.defense, swingMs),
  )
  return times.reduce((a, b) => a + b, 0) / times.length
}
