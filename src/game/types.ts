export const CONTENT_VERSION = 1
export const REALM_PROGRESS_CAP = 10_000
export const TICK_MS = 125
export const PERSIST_MS = 12_000
export const STARTING_DIAMONDS = 50
export const OFFLINE_CAP_HOURS = 10
export const XP_BASE = 80
export const XP_GROWTH = 1.32
export const START_NODE_ID = 0
export const PLAYER_SWING_MS = 800
export const MONSTER_SWING_MS = 1_150
export const DEATH_COOLDOWN_MS = 5_000
export const DESPAWN_MS = 700
export const MAX_INVENTORY = 30

export const EQUIP_SLOTS = [
  'helmet',
  'amulet',
  'weapon_main',
  'weapon_offhand',
  'armour',
  'belt',
  'ring_1',
  'ring_2',
  'gloves',
  'boots',
] as const

export type EquipSlot = (typeof EQUIP_SLOTS)[number]

export const SLOT_TYPES = [
  'helmet',
  'amulet',
  'weapon',
  'armour',
  'belt',
  'ring',
  'gloves',
  'boots',
] as const

export type SlotType = (typeof SLOT_TYPES)[number]

export const WEAPON_HANDS = ['one_hand', 'two_hand', 'offhand'] as const
export type WeaponHand = (typeof WEAPON_HANDS)[number]

export const RARITIES = ['common', 'magic', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]

export const STAT_KEYS = [
  'hp',
  'attack',
  'defense',
  'str',
  'dex',
  'int',
  'critChance',
  'critMulti',
  'block',
  'xpMod',
  'goldMod',
  'itemDrop',
  'materialDrop',
  'hpRegen',
  'lifeSteal',
] as const

export type StatKey = (typeof STAT_KEYS)[number]

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  str: 'Strength',
  dex: 'Dexterity',
  int: 'Intelligence',
  critChance: 'Crit Chance',
  critMulti: 'Crit Multi',
  block: 'Block',
  xpMod: 'XP',
  goldMod: 'Gold Find',
  itemDrop: 'Item Drop',
  materialDrop: 'Material Drop',
  hpRegen: 'HP Regen',
  lifeSteal: 'Life Steal',
}

export const STAT_HELP: Record<StatKey, string> = {
  hp: 'Your life. At 0 you are downed 5s and the monster fully heals.',
  attack: 'Hit damage. Enemy Defense cuts it by 40% of their DEF.',
  defense: 'Reduces incoming hits by 40% of this value.',
  str: '1 STR → +2 HP, +0.35 ATK, +0.15 DEF, +0.02 HP regen/s.',
  dex: '1 DEX → +0.25 ATK, +0.1% crit, +0.04% item drop, +0.03% life steal.',
  int: '1 INT → +0.2% XP, +0.04% material drop.',
  critChance: 'Chance a hit uses Crit Multi. Capped at 75%.',
  critMulti: 'Damage multiplier applied on a crit.',
  block: 'Chance to ignore a monster hit. Capped at 60%.',
  xpMod: 'Multiplies XP gained from kills.',
  goldMod: 'Multiplies gold gained from kills.',
  itemDrop: 'Chance a kill drops gear.',
  materialDrop: 'Chance a kill drops scrap.',
  hpRegen: 'HP recovered per second in combat. Kills do not refill life.',
  lifeSteal: 'Percent of damage dealt returned as HP.',
}

export type Affix = {
  stat: StatKey
  value: number
}

export type Item = {
  id: string
  playerId: string
  slotType: SlotType
  weaponHand: WeaponHand | null
  rarity: Rarity
  baseId: string
  name: string
  affixes: Affix[]
  equippedSlot: EquipSlot | null
  locked: boolean
}

export type PlayerState = {
  id: string
  level: number
  xp: number
  gold: number
  diamonds: number
  scrap: number
  realmId: number
  highestRealmId: number
  realmProgress: number
  monsterIndex: number
  queuedMonsterIndex: number
  skillPointsUnspent: number
  allocatedNodeIds: number[]
  lastSettledAt: number
  contentVersion: number
}

export type DerivedStats = Record<StatKey, number>

export type MonsterDef = {
  id: string
  name: string
  image: string
  hp: number
  attack: number
  defense: number
  xp: number
  gold: number
  progress: number
  itemDrop: number
  materialDrop: number
}

export type RealmDef = {
  id: number
  name: string
  blurb: string
  image: string
  theme: RealmTheme
  monsters: MonsterDef[]
}

export type NodeKind = 'small' | 'notable' | 'keystone'
export type ClusterId = 'hub' | 'str' | 'dex' | 'int'

export type SkillNode = {
  id: number
  x: number
  y: number
  kind: NodeKind
  cluster: ClusterId
  name: string
  bonuses: Affix[]
}

export type SkillEdge = {
  a: number
  b: number
}

export type SkillTree = {
  nodes: SkillNode[]
  edges: SkillEdge[]
  byId: Map<number, SkillNode>
  adj: Map<number, number[]>
}

export type LiveMonster = {
  def: MonsterDef
  hp: number
  maxHp: number
}

export type CombatLogEntry = {
  id: number
  text: string
  rarity?: Rarity
}

export type FloatingHit = {
  id: number
  text: string
  kind: 'player' | 'monster' | 'crit' | 'block' | 'loot' | 'heal'
}

export type CombatSnapshot = {
  monster: LiveMonster
  playerHp: number
  playerMaxHp: number
  playerSwing: number
  monsterSwing: number
  deathCooldownMs: number
  despawnMs: number
  encounter: number
  log: CombatLogEntry[]
  floats: FloatingHit[]
}

export type RealmTheme = {
  from: string
  to: string
  accent: string
}

export type KillReward = {
  xp: number
  gold: number
  scrap: number
  item: Item | null
  leveled: boolean
  newLevel: number
}

export type OfflineGrant = {
  player: PlayerState
  items: Item[]
  kills: number
  xp: number
  gold: number
  scrap: number
  drops: number
  seconds: number
}

export type ItemBase = {
  id: string
  name: string
  slotType: SlotType
  weaponHand: WeaponHand | null
  implicit: Affix
}
