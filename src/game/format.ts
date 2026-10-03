import { STAT_LABELS, type Affix, type StatKey } from './types'

export function isPercentStat(stat: StatKey): boolean {
  return (
    stat === 'critChance' ||
    stat === 'block' ||
    stat === 'itemDrop' ||
    stat === 'materialDrop' ||
    stat === 'critMulti' ||
    stat === 'xpMod' ||
    stat === 'goldMod' ||
    stat === 'lifeSteal'
  )
}

export function formatAffix(affix: Affix): string {
  const label = STAT_LABELS[affix.stat]
  const sign = affix.value >= 0 ? '+' : ''
  if (affix.stat === 'hpRegen') {
    return `${sign}${affix.value.toFixed(1)}/s ${label}`
  }
  if (isPercentStat(affix.stat)) {
    return `${sign}${(affix.value * 100).toFixed(affix.stat === 'critMulti' || affix.stat === 'xpMod' || affix.stat === 'goldMod' || affix.stat === 'lifeSteal' ? 0 : 1)}% ${label}`
  }
  return `${sign}${affix.value} ${label}`
}
