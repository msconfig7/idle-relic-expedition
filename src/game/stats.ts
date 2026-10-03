import { skillTree } from '../content/skillTree'
import { equippedItems } from './equipment'
import type { Affix, DerivedStats, Item, PlayerState, StatKey } from './types'

function addAffixes(stats: DerivedStats, affixes: Affix[]): void {
  for (const affix of affixes) {
    stats[affix.stat] += affix.value
  }
}

export function baseStats(level: number): DerivedStats {
  return {
    hp: 80 + level * 12,
    attack: 8 + level * 2,
    defense: 4 + level,
    str: 5 + Math.floor(level * 0.6),
    dex: 5 + Math.floor(level * 0.6),
    int: 5 + Math.floor(level * 0.6),
    critChance: 0.05,
    critMulti: 1.5,
    block: 0.02,
    xpMod: 1,
    goldMod: 1,
    itemDrop: 0.08,
    materialDrop: 0.18,
    hpRegen: 0.35,
    lifeSteal: 0,
  }
}

export function deriveStats(player: PlayerState, items: Item[]): DerivedStats {
  const stats = baseStats(player.level)
  for (const item of equippedItems(items)) {
    addAffixes(stats, item.affixes)
  }
  for (const nodeId of player.allocatedNodeIds) {
    const node = skillTree.byId.get(nodeId)
    if (node) addAffixes(stats, node.bonuses)
  }
  stats.hp += stats.str * 2
  stats.attack += Math.floor(stats.str * 0.35 + stats.dex * 0.25)
  stats.defense += Math.floor(stats.str * 0.15)
  stats.critChance += stats.dex * 0.001
  stats.itemDrop += stats.dex * 0.0004
  stats.xpMod += stats.int * 0.002
  stats.materialDrop += stats.int * 0.0004
  stats.hpRegen += stats.str * 0.02
  stats.lifeSteal += stats.dex * 0.0003
  stats.hp = Math.max(1, Math.floor(stats.hp))
  stats.attack = Math.max(1, Math.floor(stats.attack))
  stats.defense = Math.max(0, Math.floor(stats.defense))
  stats.critChance = Math.min(0.75, stats.critChance)
  stats.block = Math.min(0.6, stats.block)
  stats.critMulti = Math.max(1.2, stats.critMulti)
  stats.xpMod = Math.max(0.1, stats.xpMod)
  stats.goldMod = Math.max(0.1, stats.goldMod)
  stats.itemDrop = Math.min(0.95, Math.max(0, stats.itemDrop))
  stats.materialDrop = Math.min(0.95, Math.max(0, stats.materialDrop))
  stats.hpRegen = Math.max(0, stats.hpRegen)
  stats.lifeSteal = Math.min(0.35, Math.max(0, stats.lifeSteal))
  return stats
}

export function formatStat(stat: StatKey, value: number): string {
  if (
    stat === 'critChance' ||
    stat === 'block' ||
    stat === 'itemDrop' ||
    stat === 'materialDrop'
  ) {
    return `${(value * 100).toFixed(1)}%`
  }
  if (stat === 'critMulti' || stat === 'xpMod' || stat === 'goldMod' || stat === 'lifeSteal') {
    return `${(value * 100).toFixed(0)}%`
  }
  if (stat === 'hpRegen') {
    return `${value.toFixed(1)}/s`
  }
  return String(Math.round(value))
}
