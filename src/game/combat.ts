import { realms } from '../content/realms'
import { amplifyTrait } from './fight'
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

export function huntIndex(realm: RealmDef, index: number | undefined): number {
  const count = realm.monsters.length
  if (!count) return 0
  const value = Math.floor(index ?? 0)
  if (!Number.isFinite(value) || value < 0) return 0
  return value % count
}

export function pickMonster(realm: RealmDef, killIndex: number): MonsterDef {
  return realm.monsters[huntIndex(realm, killIndex)]
}

export function eliteScaled(def: MonsterDef): MonsterDef {
  return {
    ...def,
    hp: Math.max(1, Math.round(def.hp * 1.8)),
    attack: Math.max(1, Math.round(def.attack * 1.35)),
    defense: Math.max(0, Math.round(def.defense * 1.2)),
    xp: Math.max(1, Math.round(def.xp * 2.4)),
    gold: Math.max(1, Math.round(def.gold * 2.4)),
    progress: Math.max(1, Math.round(def.progress * 1.75)),
    itemDrop: def.itemDrop * 2.2,
    materialDrop: Math.min(0.9, def.materialDrop * 1.8),
    trait: amplifyTrait(def.trait),
  }
}

export function spawnMonster(def: MonsterDef, elite = false): LiveMonster {
  const next = elite ? eliteScaled(def) : def
  return { def: next, hp: next.hp, maxHp: next.hp, elite, boss: false }
}

export function spawnBoss(def: MonsterDef): LiveMonster {
  return { def, hp: def.hp, maxHp: def.hp, elite: false, boss: true }
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

export function timeToKillMs(
  attack: number,
  critChance: number,
  critMulti: number,
  def: MonsterDef,
  swingMs: number,
): number {
  const avoid = Math.min(0.75, (def.trait.phase ?? 0) + (def.trait.block ?? 0))
  const hit = Math.max(1, attack - def.defense * 0.4)
  const expected = hit * (1 - critChance + critChance * critMulti) * (1 - avoid)
  const regenPerHit = (def.trait.regen ?? 0) * def.hp * (swingMs / 1000)
  const net = expected - regenPerHit
  if (net <= 0.25) return def.hp * swingMs * 4
  return Math.max(swingMs, Math.ceil(def.hp / net) * swingMs)
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
