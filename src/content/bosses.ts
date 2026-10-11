import type { MonsterDef } from '../game/types'

export type BossDef = MonsterDef & { timeLimitMs: number }

export const bosses: BossDef[] = [
  {
    id: 'waystone-colossus',
    name: 'Waystone Colossus',
    image: '/monsters/waystone-brute.png',
    hp: 980,
    attack: 36,
    defense: 22,
    xp: 420,
    gold: 90,
    progress: 0,
    itemDrop: 1,
    materialDrop: 1,
    timeLimitMs: 42_000,
    trait: {
      name: 'Living Waystone',
      blurb: 'The milestone strikes back, and it rages as it cracks.',
      thorns: 0.18,
      enrageBelow: 0.3,
      enrageAttack: 1.55,
    },
  },
  {
    id: 'drowned-hierophant',
    name: 'Drowned Hierophant',
    image: '/monsters/drowned-acolyte.png',
    hp: 2200,
    attack: 64,
    defense: 26,
    xp: 1600,
    gold: 180,
    progress: 0,
    itemDrop: 1,
    materialDrop: 1,
    timeLimitMs: 48_000,
    trait: {
      name: 'Tide of Salt',
      blurb: 'Saltwater prayers swallow healing and let blows slip past.',
      phase: 0.16,
      suppressRegen: 1,
    },
  },
  {
    id: 'ashen-sovereign',
    name: 'Ashen Sovereign',
    image: '/monsters/ember-tyrant.png',
    hp: 3600,
    attack: 98,
    defense: 48,
    xp: 9000,
    gold: 360,
    progress: 0,
    itemDrop: 1,
    materialDrop: 1,
    timeLimitMs: 54_000,
    trait: {
      name: 'Crown of Cinders',
      blurb: 'A crown of fire burns the air, hotter once the sovereign bleeds.',
      auraBurn: 0.16,
      enrageBelow: 0.4,
      enrageAttack: 1.45,
    },
  },
  {
    id: 'blight-matriarch',
    name: 'Blight Matriarch',
    image: '/monsters/blight-regent.png',
    hp: 5800,
    attack: 148,
    defense: 66,
    xp: 32000,
    gold: 780,
    progress: 0,
    itemDrop: 1,
    materialDrop: 1,
    timeLimitMs: 60_000,
    trait: {
      name: 'Heart of the Fen',
      blurb: 'She drinks the fight, knits rot into her wounds, and leaves venom.',
      leech: 0.28,
      regen: 0.008,
      poison: 0.2,
    },
  },
]

const byRealm = new Map(bosses.map((boss, index) => [index + 1, boss]))

export function bossForRealm(realmId: number): BossDef | undefined {
  return byRealm.get(realmId)
}
