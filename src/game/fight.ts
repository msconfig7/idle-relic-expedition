import { MONSTER_SWING_MS } from './types'
import type { LiveMonster, MonsterTrait } from './types'

export const DOT_MS = 3_200

export function foeName(monster: LiveMonster): string {
  return monster.elite ? `Elite ${monster.def.name}` : monster.def.name
}

export function isEnraged(monster: LiveMonster): boolean {
  const below = monster.def.trait.enrageBelow
  if (below == null || monster.maxHp <= 0) return false
  return monster.hp / monster.maxHp <= below
}

export function monsterSwingLimit(monster: LiveMonster): number {
  const trait = monster.def.trait
  let scale = trait.swingScale ?? 1
  if (isEnraged(monster) && trait.enrageSwing) scale *= trait.enrageSwing
  return Math.max(320, Math.round(MONSTER_SWING_MS * scale))
}

export function attackScale(monster: LiveMonster, ambushReady: boolean): { scale: number; ambushReady: boolean } {
  const trait = monster.def.trait
  let scale = 1
  let ready = ambushReady
  if (isEnraged(monster) && trait.enrageAttack) scale *= trait.enrageAttack
  if (ready && trait.ambush) {
    scale *= trait.ambush
    ready = false
  }
  return { scale, ambushReady: ready }
}

export function avoided(monster: LiveMonster, rng: () => number): 'guard' | 'phase' | null {
  const trait = monster.def.trait
  if (trait.block && rng() < trait.block) return 'guard'
  if (trait.phase && rng() < trait.phase) return 'phase'
  return null
}

export function thornsDamage(monster: LiveMonster, dealt: number): number {
  const thorns = monster.def.trait.thorns ?? 0
  if (thorns <= 0 || dealt <= 0) return 0
  return Math.max(1, Math.round(dealt * thorns))
}

export function leechHeal(monster: LiveMonster, dealt: number): number {
  const leech = monster.def.trait.leech ?? 0
  if (leech <= 0 || dealt <= 0) return 0
  return Math.max(1, Math.round(dealt * leech))
}

export function suppressRegen(monster: LiveMonster): number {
  return Math.min(1, Math.max(0, monster.def.trait.suppressRegen ?? 0))
}

export function auraDps(monster: LiveMonster): number {
  const aura = monster.def.trait.auraBurn ?? 0
  if (aura <= 0) return 0
  return monster.def.attack * aura
}

export function hitDots(monster: LiveMonster): { burn: number; poison: number } {
  const trait: MonsterTrait = monster.def.trait
  return {
    burn: trait.burn ? monster.def.attack * trait.burn : 0,
    poison: trait.poison ? monster.def.attack * trait.poison : 0,
  }
}

export function amplifyTrait(trait: MonsterTrait): MonsterTrait {
  const scale = (value: number | undefined, mul: number, cap: number) =>
    value == null ? undefined : Math.min(cap, Math.round(value * mul * 1000) / 1000)
  const add = (value: number | undefined, extra: number, cap: number) =>
    value == null ? undefined : Math.min(cap, Math.round((value + extra) * 1000) / 1000)
  return {
    ...trait,
    regen: scale(trait.regen, 1.4, 0.05),
    phase: add(trait.phase, 0.05, 0.4),
    thorns: scale(trait.thorns, 1.25, 0.4),
    burn: scale(trait.burn, 1.3, 0.6),
    poison: scale(trait.poison, 1.3, 0.6),
    auraBurn: scale(trait.auraBurn, 1.3, 0.45),
    leech: scale(trait.leech, 1.15, 0.65),
    block: add(trait.block, 0.05, 0.45),
    ambush: scale(trait.ambush, 1.1, 3.2),
    enrageAttack: scale(trait.enrageAttack, 1.08, 2.2),
  }
}
